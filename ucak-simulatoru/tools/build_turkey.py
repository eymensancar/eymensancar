"""Türkiye geneli veri: arazi (3 kademe), kıyı ve göller, arazi örtüsü, ayrıntılı bölgeler, binalar, havalimanları, harita.

Girdi (depoya girmez, tools/raw/):
  dem/z7_*, z9_*, z11_*, z12_*.png   AWS Terrain Tiles (fetch_dem_tr.py, fetch_dem.py)
  osm/*.geojsonseq, osm/bina_*.geojsonseq   OpenStreetMap Türkiye özütünden (openstreetmap.fr, osmium ile; ODbL)
  ne/ne_10m_*                        Natural Earth (kamu malı)
Önce: python3 tools/build_data.py (İstanbul zemin dokusu ve maskesi).
Çıktı: www/data/tr/ (dizin.json ve PNG içine paketlenmiş ikili veriler, bkz. README).

İkili veri "PNG kabı": baytlar RGB piksellere sırayla yazılır (alfa yok), ilk 4 bayt uzunluk. Tarayıcı PNG'yi kendisi açar;
base64'ten %25 küçük, sıkıştırma bedava. Kayıpsız olduğundan veri bozulmaz.
"""
import json, glob, math, os, struct, sys, random, time
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import orjson

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lcc
RAW = os.path.join(HERE, 'raw'); OSM = os.path.join(RAW, 'osm'); NE = os.path.join(RAW, 'ne')
OUT = os.path.join(HERE, '..', 'www', 'data', 'tr'); os.makedirs(OUT, exist_ok=True)
IST = os.path.join(HERE, '..', 'www', 'data')
ONLY = set(sys.argv[1:])     # boşsa hepsi; örn: python3 build_turkey.py arazi bina
def want(k): return not ONLY or k in ONLY
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.0f}s]', *a, flush=True)

# ---------------- kök alan (oyundaki dörtlü ağaçla aynı) ----------------
RX0, RY0, RS = -448000.0, -768000.0, 2048000.0       # 2048 km kare; en ince düğüm 2 km, köşe aralığı 62.5 m
OV = dict(x0=RX0, y0=-768000.0, s=2000.0, nx=1025, ny=545)          # genel bakış 2 km (y: -768..+320 km)
BS, BT = 500.0, 512                                                   # temel ızgara 500 m, karo 512 aralık (256 km)
LC = dict(x0=RX0, y0=-736000.0, s=500.0, nx=4096, ny=2048)           # örtü dokusu 500 m (y: -736..+288 km)
MS = 125.0                                                            # ara maske çözünürlüğü
REG = json.load(open(os.path.join(HERE, 'bolgeler.json')))['bolgeler']
IST_REG = {'id': 'istanbul', 'ad': 'İstanbul', 'lat': lcc.LAT0, 'lon': lcc.LON0, 'binalar': True, 'rect': (-14375.0, -14500.0, 14375.0, 14500.0)}

# ---------------- PNG kabı ----------------
def write_png_bytes(path, data):
    data = struct.pack('<I', len(data)) + bytes(data)
    W = 2048
    npx = (len(data) + 2) // 3
    H = (npx + W - 1) // W
    buf = np.zeros(W * H * 3, np.uint8); buf[:len(data)] = np.frombuffer(data, np.uint8)
    Image.fromarray(buf.reshape(H, W, 3), 'RGB').save(path, optimize=True, compress_level=9)
    return os.path.getsize(path)

def grid_bytes(H, x0, y0, s):
    """Yükseklik ızgarası: 'YKH2', nx, ny, x0, y0 (f64), s (f32), sonra satır satır int16 farkları (0.5 m)."""
    ny, nx = H.shape
    q = np.clip(np.round(H * 2), -32000, 32000).astype(np.int32)
    d = q.copy(); d[:, 1:] = q[:, 1:] - q[:, :-1]
    d = np.clip(d, -32768, 32767).astype('<i2')
    return b'YKH2' + struct.pack('<iiddf', nx, ny, x0, y0, s) + d.tobytes()

# ---------------- yükseklik karoları ----------------
_tiles = {}
def tile(z, x, y):
    k = (z, x, y)
    if k not in _tiles:
        f = os.path.join(RAW, 'dem', f'z{z}_{x}_{y}.png')
        if os.path.exists(f):
            a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
            _tiles[k] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
        else: _tiles[k] = None
    return _tiles[k]
def dem(z, lat, lon):
    """Vektörel çift doğrusal örnekleme (Web Mercator karoları)."""
    n = 2 ** z
    tx = (lon + 180) / 360 * n
    r = np.radians(lat)
    ty = (1 - np.log(np.tan(r) + 1 / np.cos(r)) / np.pi) / 2 * n
    px, py = tx * 256 - 0.5, ty * 256 - 0.5
    out = np.full(lat.shape, np.nan, np.float32)
    x0 = np.floor(px).astype(np.int64); y0 = np.floor(py).astype(np.int64)
    fx = (px - x0).astype(np.float32); fy = (py - y0).astype(np.float32)
    acc = np.zeros(lat.shape, np.float32); wsum = np.zeros(lat.shape, np.float32)
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        gx, gy = x0 + dx, y0 + dy
        w = (fx if dx else 1 - fx) * (fy if dy else 1 - fy)
        tix, tiy = gx // 256, gy // 256
        keys = np.unique(np.stack([tix.ravel(), tiy.ravel()], 1), axis=0)
        val = np.full(lat.shape, np.nan, np.float32)
        for kx, ky in keys:
            t = tile(z, int(kx), int(ky))
            if t is None: continue
            m = (tix == kx) & (tiy == ky)
            val[m] = t[(gy[m] - ky * 256), (gx[m] - kx * 256)]
        ok = ~np.isnan(val)
        acc[ok] += val[ok] * w[ok]; wsum[ok] += w[ok]
    good = wsum > 0.5
    out[good] = acc[good] / wsum[good]
    return out
def dem_grid(z, x0, y0, s, nx, ny, fallback=None):
    xs = x0 + np.arange(nx) * s; ys = y0 + np.arange(ny) * s
    X, Y = np.meshgrid(xs, ys)
    la, lo = lcc.inv_np(X, Y)
    H = dem(z, la, lo)
    if fallback is not None:
        bad = np.isnan(H)
        if bad.any(): H[bad] = fallback(X[bad], Y[bad])
    return np.nan_to_num(H, nan=-50)

# ---------------- coğrafi yardımcılar ----------------
def proj_ring(coords):
    a = np.array(coords, np.float64)
    x, y = lcc.proj_np(a[:, 1], a[:, 0])
    return np.stack([x, y], 1)
def read_seq(name):
    with open(os.path.join(OSM, name), 'rb') as f:
        for line in f:
            line = line.strip().lstrip(b'\x1e')
            if line: yield orjson.loads(line)
def polys(geom):
    t = geom['type']
    if t == 'Polygon': return [geom['coordinates']]
    if t == 'MultiPolygon': return geom['coordinates']
    return []
def shp_records(path):
    import shapefile
    r = shapefile.Reader(path)
    for sr in r.iterShapeRecords():
        yield sr.shape, sr.record.as_dict()

# ============ 1. kara/su maskesi (125 m ara raster) ============
MX0, MY0 = LC['x0'], LC['y0']
MNX, MNY = int(LC['nx'] * LC['s'] / MS), int(LC['ny'] * LC['s'] / MS)       # 16384 x 8192
def to_mpx(xy): return [((x - MX0) / MS, (MY0 + MNY * MS - y) / MS) for x, y in xy]   # satır 0 = kuzey

def build_land():
    cache = os.path.join(RAW, 'kara125.npy')
    if os.path.exists(cache): return np.load(cache)
    log('kıyı çizgisi...')
    img = Image.new('L', (MNX, MNY), 0); d = ImageDraw.Draw(img)
    sl, sw = [], []
    for f in read_seq('kiyi.geojsonseq'):
        g = f['geometry']
        if g['type'] != 'LineString': continue
        p = to_mpx(proj_ring(g['coordinates']))
        d.line(p, fill=255, width=1)
        for (ax, ay), (bx, by) in zip(p, p[1:]):
            dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy)
            if L < 1e-6: continue
            lx, ly = dy / L, -dx / L    # OSM: kara solda; resimde y aşağı
            for k in range(max(1, int(L / 2))):
                t = (k + 0.5) / max(1, int(L / 2)); px, py = ax + dx * t, ay + dy * t
                sl.append((px + lx * 1.5, py + ly * 1.5)); sw.append((px - lx * 1.5, py - ly * 1.5))
    bar = np.array(img) > 0
    log('etiketleme...')
    lab, n = ndimage.label(~bar)
    votes = np.zeros((n + 1, 2))
    for pts, k in ((sl, 0), (sw, 1)):
        a = np.array(pts); ix = a[:, 0].astype(int); iy = a[:, 1].astype(int)
        ok = (ix >= 0) & (iy >= 0) & (ix < MNX) & (iy < MNY)
        np.add.at(votes, (lab[iy[ok], ix[ok]], k), 1)
    # oyu olmayan parçalar (özütün dışı: Yunan adaları, komşular): Natural Earth karası
    log('Natural Earth karası...')
    ne = Image.new('L', (MNX, MNY), 0); dn = ImageDraw.Draw(ne)
    for shp, rec in shp_records(os.path.join(NE, 'ne_10m_land')):
        pts = shp.points; parts = list(shp.parts) + [len(pts)]
        for a, b in zip(parts, parts[1:]):
            ring = pts[a:b]
            if not any(20 < x < 50 and 30 < y < 46 for x, y in ring[::10] + [ring[0]]): continue
            dn.polygon(to_mpx(proj_ring(ring)), fill=255)
    ne = np.array(ne) > 0
    tot = votes[:, 0] + votes[:, 1]
    frac = votes[:, 0] / np.maximum(tot, 1)
    nef = ndimage.mean(ne, lab, index=np.arange(n + 1))
    clean = (tot > 20) & ((frac > 0.9) | (frac < 0.1))
    land_c = np.where(clean, frac > 0.5, nef > 0.5)
    m = land_c[lab]
    # karışık parçalar (kıyı çizgisi özütün kenarında açık kalınca kara ve deniz birleşir): kıyıya 1.5 km'den yakın
    # her piksel en yakın tohumun tarafını alır, uzakları Natural Earth'ten
    mixed = ~clean[lab]
    seed = np.zeros((MNY, MNX), np.uint8)
    for pts, k in ((sl, 1), (sw, 2)):
        a = np.array(pts); ix = a[:, 0].astype(int); iy = a[:, 1].astype(int)
        ok = (ix >= 0) & (iy >= 0) & (ix < MNX) & (iy < MNY)
        seed[iy[ok], ix[ok]] = k
    log('en yakın tohum...')
    dist, (ii, jj) = ndimage.distance_transform_edt(seed == 0, return_indices=True)
    near = seed[ii, jj] == 1
    pix = np.where(dist < 12, near, ne)
    m = np.where(mixed, pix, m)
    m[bar] = True
    np.save(cache, m)
    return m

# ============ 2. arazi örtüsü (125 m ara raster -> 500 m doku) ============
FOREST = {('landuse', 'forest'): 255, ('natural', 'wood'): 255, ('natural', 'scrub'): 130, ('natural', 'heath'): 90, ('leisure', 'nature_reserve'): 0}
URBAN = {'residential': 255, 'industrial': 230, 'commercial': 255, 'retail': 255, 'construction': 160, 'brownfield': 140, 'railway': 160, 'military': 90, 'garages': 200}
FARM = {'farmland': 255, 'farmyard': 200, 'orchard': 200, 'vineyard': 200, 'meadow': 150, 'grass': 110, 'allotments': 200, 'greenhouse_horticulture': 220, 'plant_nursery': 200}
WATER_TAGS = lambda t: t.get('natural') == 'water' or t.get('landuse') in ('reservoir', 'basin') or t.get('waterway') == 'riverbank' or 'water' in t and t.get('natural') in (None, 'water')
def build_cover(land):
    cache = os.path.join(RAW, 'ortu125.npz')
    if os.path.exists(cache):
        z = np.load(cache); return z['f'], z['u'], z['a'], z['w']
    log('arazi örtüsü (OSM, uzun sürer)...')
    imgs = {k: Image.new('L', (MNX, MNY), 0) for k in 'fuaw'}
    dr = {k: ImageDraw.Draw(v) for k, v in imgs.items()}
    cnt = 0
    for f in read_seq('ortu.geojsonseq'):
        t = f['properties']; g = f['geometry']
        if WATER_TAGS(t) and t.get('water') not in ('fountain', 'reflecting_pool', 'wastewater', 'pond'):
            k, v = 'w', 255
        elif (('landuse', t.get('landuse')) in FOREST) or (('natural', t.get('natural')) in FOREST):
            v = FOREST.get(('landuse', t.get('landuse'))) or FOREST.get(('natural', t.get('natural'))) or 0; k = 'f'
        elif t.get('landuse') in URBAN: k, v = 'u', URBAN[t['landuse']]
        elif t.get('landuse') in FARM: k, v = 'a', FARM[t['landuse']]
        else: continue
        if not v: continue
        for poly in polys(g):
            outer = poly[0]
            if len(outer) < 4: continue
            p = to_mpx(proj_ring(outer))
            xs = [q[0] for q in p]; ys = [q[1] for q in p]
            if max(xs) < 0 or min(xs) > MNX or max(ys) < 0 or min(ys) > MNY: continue
            if max(xs) - min(xs) < 0.6 and max(ys) - min(ys) < 0.6: continue  # 125 m'den küçük
            dr[k].polygon(p, fill=v)
            for hole in poly[1:]:
                if len(hole) >= 4 and k == 'w': dr[k].polygon(to_mpx(proj_ring(hole)), fill=0)
        cnt += 1
        if cnt % 500000 == 0: log(' ', cnt)
    # büyük ırmaklar (Natural Earth)
    for shp, rec in shp_records(os.path.join(NE, 'ne_10m_rivers_lake_centerlines')):
        pts = shp.points
        if not pts or not any(25 < x < 46 and 35 < y < 43 for x, y in pts[::5]): continue
        parts = list(shp.parts) + [len(pts)]
        for a, b in zip(parts, parts[1:]):
            if b - a >= 2: dr['w'].line(to_mpx(proj_ring(pts[a:b])), fill=200, width=2)
    log('örtü bitti', cnt)
    F, U, A, W = (np.array(imgs[k]) for k in 'fuaw')
    W = np.maximum(W, (~land).astype(np.uint8) * 255)
    np.savez(cache, f=F, u=U, a=A, w=W)
    return F, U, A, W

def down4(a):  # 125 m -> 500 m ortalama
    h, w = a.shape
    return a.reshape(h // 4, 4, w // 4, 4).astype(np.float32).mean((1, 3))

# ============ ana akış ============
land = build_land()
log('kara maskesi', land.shape, land.mean())
landf500 = down4(land)                         # 0..1, satır 0 kuzey
LANDF125 = land.astype(np.float32)
def mask_sample(X, Y, arr, s):
    """arr: kuzey-satır raster (MX0, MY0 tabanlı), çözünürlük s; en yakın komşu."""
    ny, nx = arr.shape
    i = np.clip(((X - MX0) / s).astype(int), 0, nx - 1); j = np.clip(((MY0 + ny * s - Y) / s).astype(int), 0, ny - 1)
    return arr[j, i]
def bil(X, Y, arr, s):
    ny, nx = arr.shape
    fx = (X - MX0) / s - 0.5; fy = (MY0 + ny * s - Y) / s - 0.5
    x0 = np.clip(np.floor(fx).astype(int), 0, nx - 2); y0 = np.clip(np.floor(fy).astype(int), 0, ny - 2)
    u = np.clip(fx - x0, 0, 1); v = np.clip(fy - y0, 0, 1)
    return arr[y0, x0] * (1 - u) * (1 - v) + arr[y0, x0 + 1] * u * (1 - v) + arr[y0 + 1, x0] * (1 - u) * v + arr[y0 + 1, x0 + 1] * u * v

if want('ortu') or want('arazi') or want('harita'):
    F, U, A, Wt = build_cover(land)

def coast_fix(H, X, Y, lf):
    """lf: kara oranı 0..1. Deniz en çok -5 m, kara en az 2 m (su yüzeyiyle çakışma olmasın)."""
    H = H.copy()
    sea = lf < 0.5
    H[sea] = np.minimum(H[sea], -5 - 10 * (0.5 - lf[sea]))
    H[~sea] = np.maximum(H[~sea], 2 + 4 * (lf[~sea] - 0.5))
    return H

index = {'kok': [RX0, RY0, RS], 'genel': None, 'temel': {'s': BS, 'n': BT, 'karolar': []}, 'bolgeler': [], 'paketler': [], 'havalimanlari': [], 'sehirler': []}
DLAT = lambda la, lo: None

# ---------- 3. genel bakış (2 km) ----------
if want('arazi'):
    log('genel bakış...')
    o = OV
    H = dem_grid(7, o['x0'], o['y0'], o['s'], o['nx'], o['ny'])
    xs = o['x0'] + np.arange(o['nx']) * o['s']; ys = o['y0'] + np.arange(o['ny']) * o['s']
    X, Y = np.meshgrid(xs, ys)
    inside = (X >= MX0) & (X < MX0 + MNX * MS) & (Y >= MY0) & (Y < MY0 + MNY * MS)
    lf = np.where(inside, bil(X, Y, landf500, 500.0), (H > 0).astype(np.float32))
    H = coast_fix(H, X, Y, lf)
    sz = write_png_bytes(os.path.join(OUT, 'genel.png'), grid_bytes(H, o['x0'], o['y0'], o['s']))
    log('genel.png', sz)
    np.save(os.path.join(RAW, 'genel.npy'), H)

# ---------- 4. temel karolar (500 m) ----------
def base_tile_bounds(ti, tj): return RX0 + ti * BS * BT, RY0 + tj * BS * BT
if want('arazi'):
    for tj in range(5):
        for ti in range(8):
            x0, y0 = base_tile_bounds(ti, tj)
            n = BT + 1
            xs = x0 + np.arange(n) * BS; ys = y0 + np.arange(n) * BS
            X, Y = np.meshgrid(xs, ys)
            la, lo = lcc.inv_np(X, Y)
            cov = (la > 34.6) & (la < 43.2) & (lo > 24.6) & (lo < 45.8)
            if cov.mean() < 0.02: continue
            inside = (X >= MX0) & (X < MX0 + MNX * MS) & (Y >= MY0) & (Y < MY0 + MNY * MS)
            lf = np.where(inside, bil(X, Y, landf500, 500.0), 0)
            if lf.max() < 0.3: continue
            H = dem(9, la, lo)
            bad = np.isnan(H)
            if bad.any(): H[bad] = dem(7, la[bad], lo[bad])
            H = np.nan_to_num(H, nan=-50)
            lf = np.where(inside, lf, (H > 0).astype(np.float32))
            H = coast_fix(H, X, Y, lf)
            name = f't_{ti}_{tj}.png'
            sz = write_png_bytes(os.path.join(OUT, name), grid_bytes(H, x0, y0, BS))
            index['temel']['karolar'].append([ti, tj, name])
            log(name, sz, 'en yüksek', round(float(H.max())))
    json.dump(index['temel'], open(os.path.join(RAW, 'temel.json'), 'w'))
else:
    index['temel'] = json.load(open(os.path.join(RAW, 'temel.json')))

# ---------- 5. havalimanları ----------
AIRPORTS = [
    ('LTBA', 'Atatürk Havalimanı', 40.9769, 28.8146, '05/23', 'istanbul'),
    ('LTFM', 'İstanbul Havalimanı', 41.2611, 28.7419, None, 'ist_havalimani'),
    ('LTAC', 'Ankara Esenboğa', 40.1281, 32.9951, None, 'ankara'),
    ('LTBJ', 'İzmir Adnan Menderes', 38.2924, 27.1570, None, 'izmir'),
    ('LTAI', 'Antalya Havalimanı', 36.8987, 30.8005, None, 'antalya'),
    ('LTAZ', 'Kapadokya Havalimanı', 38.7719, 34.5345, None, 'kapadokya'),
    ('LTAU', 'Kayseri Erkilet', 38.7704, 35.4954, None, 'kayseri'),
    ('LTCG', 'Trabzon Havalimanı', 40.9951, 39.7897, None, 'trabzon'),
    ('LTCE', 'Erzurum Havalimanı', 39.9565, 41.1702, None, 'erzurum'),
    ('LTCI', 'Van Ferit Melen', 38.4682, 43.3323, None, 'van'),
]
def find_runways():
    rws = []
    feats = [f for f in read_seq('aero.geojsonseq') if f['properties'].get('aeroway') == 'runway']
    for code, name, la, lo, ref, reg in AIRPORTS:
        cx, cy = lcc.proj(la, lo)
        best = None
        for f in feats:
            g = f['geometry']; p = f['properties']
            if ref and p.get('ref') != ref: continue
            if g['type'] == 'LineString': pts = proj_ring(g['coordinates'])
            elif g['type'] in ('Polygon', 'MultiPolygon'): pts = proj_ring(polys(g)[0][0])
            else: continue
            c = pts.mean(0)
            if math.hypot(c[0] - cx, c[1] - cy) > 6000: continue
            cc = pts - c; _, _, vt = np.linalg.svd(cc, full_matrices=False); ax = vt[0]
            pr = cc @ ax; L = pr.max() - pr.min()
            if L < 1200: continue
            if p.get('surface') in ('grass', 'dirt', 'gravel'): continue
            if best is None or L > best[0]:
                a, b = c + ax * pr.min(), c + ax * pr.max()
                wd = p.get('width');
                try: wd = float(str(wd).split()[0])
                except Exception: wd = 45.0
                if g['type'] != 'LineString':
                    nrm = np.array([-ax[1], ax[0]]); wd = float((cc @ nrm).max() - (cc @ nrm).min())
                best = (L, a, b, min(max(wd, 45), 60), p.get('ref', ''))
        if not best: log('pist bulunamadı', code); continue
        L, a, b, wd, rref = best
        # A ucu: başlığı küçük olan taraf (05, 03 ...)
        hd = (math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) + 360) % 360
        if hd >= 180: a, b = b, a; hd -= 180
        rws.append({'kod': code, 'ad': name, 'a': [round(float(a[0]), 1), round(float(a[1]), 1)], 'b': [round(float(b[0]), 1), round(float(b[1]), 1)],
                    'en': round(wd), 'uzunluk': round(float(L)), 'baslik': round(hd, 1), 'ref': rref, 'bolge': reg})
        log('pist', code, rref, round(L), 'm', round(hd, 1))
    return rws
RUNWAYS = find_runways()

def flatten_runways(H, x0, y0, s, nx, ny, rws, sample_fn):
    xs = x0 + np.arange(nx) * s; ys = y0 + np.arange(ny) * s
    X, Y = np.meshgrid(xs, ys)
    for r in rws:
        A = np.array(r['a']); B = np.array(r['b']); L = np.linalg.norm(B - A); u = (B - A) / L
        if 'elev' not in r:
            t = np.linspace(0, 1, 40); px = A[0] + (B - A)[0] * t; py = A[1] + (B - A)[1] * t
            r['elev'] = round(float(np.median(sample_fn(px, py))), 2)
        al = (X - A[0]) * u[0] + (Y - A[1]) * u[1]; cr = -(X - A[0]) * u[1] + (Y - A[1]) * u[0]
        dd = np.maximum.reduce([np.abs(cr) - 120, -al - 150, al - L - 150, np.zeros_like(al)])
        w = np.clip(1 - dd / 500, 0, 1); w = w * w * (3 - 2 * w)
        H[:] = H * (1 - w) + r['elev'] * w
    return H

# ---------- 6. ayrıntılı bölgeler (62.5 m) ----------
PS = 62.5
def region_rect(b):
    if 'rect' in b: return b['rect']
    cx, cy = lcc.proj(b['lat'], b['lon']); h = b['yari'] * 1000
    return (math.floor((cx - h) / PS) * PS, math.floor((cy - h) / PS) * PS, math.ceil((cx + h) / PS) * PS, math.ceil((cy + h) / PS) * PS)
ALLREG = [IST_REG] + REG
GH = np.load(os.path.join(RAW, 'genel.npy')) if os.path.exists(os.path.join(RAW, 'genel.npy')) else None
def genel_at(X, Y):
    o = OV; fx = np.clip((X - o['x0']) / o['s'], 0, o['nx'] - 1.001); fy = np.clip((Y - o['y0']) / o['s'], 0, o['ny'] - 1.001)
    i = fx.astype(int); j = fy.astype(int); u = fx - i; v = fy - j
    return GH[j, i] * (1 - u) * (1 - v) + GH[j, i + 1] * u * (1 - v) + GH[j + 1, i] * (1 - u) * v + GH[j + 1, i + 1] * u * v
REGION_H = {}
if not (want('arazi') or want('bina')):
    for b in ALLREG:
        x0, y0, x1, y1 = region_rect(b); nx, ny = int(round((x1 - x0) / PS)) + 1, int(round((y1 - y0) / PS)) + 1
        index['bolgeler'].append({'id': b['id'], 'ad': b['ad'], 'rect': [x0, y0, x0 + (nx - 1) * PS, y0 + (ny - 1) * PS], 'dosya': f"b_{b['id']}.png"})
        cache = os.path.join(RAW, f"bolge_{b['id']}.npy")
        ers = {r['kod']: r for r in json.load(open(cache + '.rw.json'))}
        for r in RUNWAYS:
            if r['kod'] in ers: r['elev'] = ers[r['kod']]['elev']
if want('arazi') or want('bina'):
    ist_mask = np.array(Image.open(os.path.join(IST, 'maske.png')).convert('L')) > 127   # 2048², İstanbul dikdörtgeni, satır 0 kuzey
    for b in ALLREG:
        x0, y0, x1, y1 = region_rect(b)
        nx, ny = int(round((x1 - x0) / PS)) + 1, int(round((y1 - y0) / PS)) + 1
        cache = os.path.join(RAW, f"bolge_{b['id']}.npy")
        if want('arazi') or not os.path.exists(cache):
            z = 12 if b['id'] == 'istanbul' else 11
            H = dem_grid(z, x0, y0, PS, nx, ny, fallback=lambda X, Y: dem(9, *lcc.inv_np(X, Y)))
            xs = x0 + np.arange(nx) * PS; ys = y0 + np.arange(ny) * PS
            X, Y = np.meshgrid(xs, ys)
            if b['id'] == 'istanbul':
                # İstanbul: ayrıntılı OSM maskesi (7 m) ile, eski düzendeki gibi su 0, kara en az 1.5 m
                rx0, ry0, rx1, ry1 = b['rect']; MW = ist_mask.shape[0]
                ii = np.clip(((X - rx0) / (rx1 - rx0) * MW).astype(int), 0, MW - 1); jj = np.clip(((ry1 - Y) / (ry1 - ry0) * MW).astype(int), 0, MW - 1)
                lm = ndimage.uniform_filter(ist_mask.astype(np.float32), 9)[jj, ii]
                H = ndimage.gaussian_filter(np.maximum(H, 0), 0.6)
                H = np.where(lm > 0.5, np.maximum(H, 1.5 + 6 * (lm - 0.5)), -5.0)
            else:
                lf = bil(X, Y, LANDF125, MS)
                H = coast_fix(H, X, Y, lf)
            rws = [r for r in RUNWAYS if r['bolge'] == b['id']]
            def samp(px, py, H=H, x0=x0, y0=y0):
                i = np.clip(((px - x0) / PS).astype(int), 0, nx - 1); j = np.clip(((py - y0) / PS).astype(int), 0, ny - 1); return H[j, i]
            H = flatten_runways(H, x0, y0, PS, nx, ny, rws, samp)
            np.save(cache, H)
            json.dump([r for r in RUNWAYS if r['bolge'] == b['id']], open(cache + '.rw.json', 'w'))
        else:
            H = np.load(cache)
            ers = {r['kod']: r for r in json.load(open(cache + '.rw.json'))}
            for r in RUNWAYS:
                if r['kod'] in ers: r['elev'] = ers[r['kod']]['elev']
        REGION_H[b['id']] = (H, x0, y0)
        name = f"b_{b['id']}.png"
        if want('arazi'):
            sz = write_png_bytes(os.path.join(OUT, name), grid_bytes(H, x0, y0, PS))
            log(name, nx, ny, sz, 'en yüksek', round(float(H.max())))
        index['bolgeler'].append({'id': b['id'], 'ad': b['ad'], 'rect': [x0, y0, x0 + (nx - 1) * PS, y0 + (ny - 1) * PS], 'dosya': name})
index['havalimanlari'] = RUNWAYS

# ---------- 7. örtü dokusu ve harita ----------
if want('ortu') or want('arazi'):
    log('örtü dokusu...')
    ch = [down4(F), down4(U), down4(A), down4(Wt)]
    rgba = np.dstack([np.clip(c, 0, 255).astype(np.uint8) for c in ch])
    im = Image.fromarray(rgba, 'RGBA')
    im.save(os.path.join(OUT, 'ortu.png'), optimize=True)
    log('ortu.png', os.path.getsize(os.path.join(OUT, 'ortu.png')))
    index['ortu'] = {'x0': LC['x0'], 'y0': LC['y0'], 's': LC['s'], 'nx': LC['nx'], 'ny': LC['ny'], 'dosya': 'ortu.png'}

# şehirler (HUD ve harita adları): Natural Earth yerleşim yerleri, Türkiye'deki büyükler
CITIES = []
for shp, rec in shp_records(os.path.join(NE, 'ne_10m_populated_places_simple')):
    if rec.get('adm0name') != 'Turkey' and rec.get('sov0name') != 'Turkey': continue
    lo, la = shp.points[0]
    CITIES.append((rec.get('pop_max') or 0, rec.get('name'), la, lo))
CITIES.sort(key=lambda c: -c[0])
TRN = {'Icel': 'Mersin', 'Istanbul': 'İstanbul', 'Izmir': 'İzmir', 'Eskisehir': 'Eskişehir', 'Diyarbakir': 'Diyarbakır', 'Sanliurfa': 'Şanlıurfa', 'Kahramanmaras': 'Kahramanmaraş', 'Mugla': 'Muğla', 'Usak': 'Uşak', 'Nigde': 'Niğde', 'Kirsehir': 'Kırşehir', 'Kirikkale': 'Kırıkkale', 'Agri': 'Ağrı', 'Mus': 'Muş', 'Tekirdag': 'Tekirdağ', 'Corum': 'Çorum', 'Canakkale': 'Çanakkale', 'Bingol': 'Bingöl', 'Gumushane': 'Gümüşhane', 'Duzce': 'Düzce', 'Igdir': 'Iğdır', 'Sirnak': 'Şırnak', 'Cankiri': 'Çankırı', 'Elazig': 'Elazığ', 'Adapazari': 'Adapazarı', 'Izmit': 'İzmit', 'Iskenderun': 'İskenderun', 'Antakya': 'Antakya', 'Kutahya': 'Kütahya', 'Aydin': 'Aydın', 'Balikesir': 'Balıkesir', 'Denizli': 'Denizli', 'Sivas': 'Sivas', 'Malatya': 'Malatya', 'Batman': 'Batman', 'Siirt': 'Siirt', 'Bitlis': 'Bitlis', 'Hakkari': 'Hakkâri', 'Tunceli': 'Tunceli', 'Kars': 'Kars', 'Ardahan': 'Ardahan', 'Artvin': 'Artvin', 'Rize': 'Rize', 'Giresun': 'Giresun', 'Ordu': 'Ordu', 'Sinop': 'Sinop', 'Kastamonu': 'Kastamonu', 'Bartin': 'Bartın', 'Zonguldak': 'Zonguldak', 'Karabuk': 'Karabük', 'Bolu': 'Bolu', 'Bilecik': 'Bilecik', 'Yalova': 'Yalova', 'Afyon': 'Afyonkarahisar', 'Isparta': 'Isparta', 'Burdur': 'Burdur', 'Karaman': 'Karaman', 'Aksaray': 'Aksaray', 'Nevsehir': 'Nevşehir', 'Yozgat': 'Yozgat', 'Tokat': 'Tokat', 'Amasya': 'Amasya', 'Erzincan': 'Erzincan', 'Bayburt': 'Bayburt', 'Osmaniye': 'Osmaniye', 'Kilis': 'Kilis', 'Adiyaman': 'Adıyaman', 'Mardin': 'Mardin', 'Edirne': 'Edirne', 'Kirklareli': 'Kırklareli', 'Manisa': 'Manisa', 'Mersin': 'Mersin', 'Gaziantep': 'Gaziantep'}
seen = set()
for pop, nm, la, lo in CITIES[:90]:
    nm2 = TRN.get(nm, nm)
    if nm2 in seen: continue
    seen.add(nm2); x, y = lcc.proj(la, lo)
    index['sehirler'].append({'ad': nm2, 'x': round(x), 'y': round(y), 'nufus': int(pop)})
log('şehir', len(index['sehirler']))

if want('harita') or want('arazi'):
    log('Türkiye haritası...')
    # 2048 x 1024, x: -448..1600 km, y: -736..288 km (örtü dokusuyla aynı kapsam, 1 km/piksel)
    Wm, Hm = 2048, 1024
    xs = LC['x0'] + (np.arange(Wm) + 0.5) * 1000; ys = LC['y0'] + LC['ny'] * LC['s'] - (np.arange(Hm) + 0.5) * 1000
    X, Y = np.meshgrid(xs, ys)
    Hh = genel_at(X, Y)
    # temel karolardan daha ayrıntılı
    lf = bil(X, Y, landf500, 500.0)
    gy, gx = np.gradient(Hh, 1000.0)
    shade = np.clip(0.75 + (-gx * 0.7 + gy * 0.7) * 1.6, 0.35, 1.25)
    t = np.clip(Hh / 3000, 0, 1)
    low = np.array([118, 150, 92]); mid = np.array([196, 178, 128]); hi = np.array([150, 120, 96]); snow = np.array([240, 240, 240])
    col = np.where(t[..., None] < 0.33, low + (mid - low) * (t[..., None] / 0.33), mid + (hi - mid) * np.clip((t[..., None] - 0.33) / 0.5, 0, 1))
    col = np.where((Hh > 2900)[..., None], snow, col)
    fo = bil(X, Y, down4(F), 500.0)[..., None] / 255 if 'F' in globals() else 0
    col = col * (1 - 0.5 * fo) + np.array([60, 100, 55]) * 0.5 * fo
    col = col * shade[..., None]
    wat = (bil(X, Y, down4(Wt), 500.0) / 255) if 'Wt' in globals() else (1 - lf)
    water = np.array([70, 125, 170])
    col = np.where((wat > 0.5)[..., None] | (lf < 0.5)[..., None], water, col)
    Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, 'harita.webp'), quality=82, method=6)
    index['harita'] = {'x0': LC['x0'], 'y0': LC['y0'], 'w': Wm * 1000.0, 'h': Hm * 1000.0, 'dosya': 'harita.webp'}
    log('harita.webp', os.path.getsize(os.path.join(OUT, 'harita.webp')))

# ============ 8. binalar ============
def ring_area(r):
    x, y = r[:, 0], r[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; ab = b - a; L = math.hypot(*ab)
    d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / L if L > 1e-9 else np.hypot(*(pts - a).T)
    i = int(np.argmax(d[1:-1])) + 1 if len(pts) > 2 else 0
    if d[i] > eps: return np.vstack([dp(pts[:i + 1], eps)[:-1], dp(pts[i:], eps)])
    return np.vstack([a, b])
def simplify(r, eps):
    if len(r) <= 4: return r
    far = int(np.argmax(np.hypot(*(r - r[0]).T)))
    a = dp(r[:far + 1], eps); b = dp(np.vstack([r[far:], r[:1]]), eps)
    return np.vstack([a[:-1], b[:-1]])
def num(v):
    try: return float(str(v).replace(',', '.').split(';')[0].replace('m', '').strip())
    except Exception: return None
IST_LM = [(41.025658, 28.974155, 25), (41.021164, 29.004092, 40), (41.008583, 28.980175, 75), (41.005410, 28.976814, 80), (41.016111, 28.963889, 70),
          (41.084722, 29.056111, 130), (41.01638, 29.06554, 35), (41.0277, 29.0697, 60),
          (39.925054, 32.836952, 120), (39.885, 32.856, 30), (39.9168, 32.8604, 70), (38.4189, 27.1287, 18)]   # Anıtkabir (yapı elle), Atakule, Kocatepe, Saat Kulesi
LMP = [(lcc.proj(a, b), r) for a, b, r in IST_LM]
TYPE = {'mosque': 1, 'industrial': 2, 'warehouse': 2, 'hangar': 9, 'church': 4, 'castle': 4, 'tower': 4, 'palace': 5, 'house': 6, 'detached': 6, 'semidetached_house': 6,
        'bungalow': 6, 'hut': 6, 'shed': 6, 'garage': 6, 'garages': 6, 'farm': 6, 'barn': 6, 'cabin': 6, 'commercial': 7, 'retail': 7, 'supermarket': 7, 'office': 3,
        'school': 8, 'university': 8, 'hospital': 8, 'public': 8, 'government': 8, 'civic': 8, 'train_station': 8, 'transportation': 9, 'stadium': 8, 'sports_hall': 8, 'greenhouse': 2}
CH = 1000.0
def build_pack(b):
    x0, y0, x1, y1 = region_rect(b)
    fn = os.path.join(OSM, f"bina_{b['id']}.geojsonseq")
    rnd0 = random.Random(7)
    blds = []
    for f in read_seq(os.path.basename(fn)):
        t = f['properties']; bt = t.get('building', 'yes')
        if bt in ('roof', 'construction', 'ruins', 'no', 'carport', 'canopy', 'collapsed', 'destroyed'): continue
        if t.get('location') == 'underground' or str(t.get('layer', '0')).startswith('-'): continue
        if t.get('building:part'): continue
        for poly in polys(f['geometry']):
            r = proj_ring(poly[0])
            if len(r) > 1 and np.allclose(r[0], r[-1]): r = r[:-1]
            if len(r) < 3: continue
            a = ring_area(r)
            if abs(a) < 25: continue
            if a < 0: r = r[::-1]
            cx, cy = r.mean(0)
            if not (x0 + 20 < cx < x1 - 20 and y0 + 20 < cy < y1 - 20): continue
            if any(math.hypot(cx - p[0], cy - p[1]) < rad for p, rad in LMP): continue
            h = num(t.get('height')) if t.get('height') else None
            lv = num(t.get('building:levels')) if t.get('building:levels') else None
            if h is None and lv is not None: h = lv * 3.1 + 1.5
            mosque = bt == 'mosque' or (t.get('amenity') == 'place_of_worship' and t.get('religion') == 'muslim')
            typ = 1 if mosque else TYPE.get(bt, 0)
            if t.get('historic') and typ == 0: typ = 4
            if 'Sarayı' in (t.get('name') or '') or t.get('historic') == 'palace': typ = 5
            rnd = random.Random(int(cx * 7 + cy * 13))
            if h is None:
                if typ == 1: h = 10
                elif typ in (2, 9): h = 7 + rnd.random() * 6
                elif typ == 6: h = 4 + rnd.random() * 3.5
                elif typ == 7: h = 6 + rnd.random() * 8
                elif typ == 8: h = 9 + rnd.random() * 9
                else:
                    if b['id'] == 'istanbul': lv = rnd.choice([2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7])
                    else: lv = rnd.choice([2, 3, 4, 4, 5, 5, 6, 7, 8]) if abs(a) > 150 else rnd.choice([1, 2, 2, 3])
                    if abs(a) > 1500: lv += 2
                    h = lv * 3.0 + 1.0
            h = max(3, min(h, 330))
            if typ == 0 and h >= 45: typ = 3
            eps = 0.6 if abs(a) < 2000 else 1.2
            rs = simplify(r, eps)
            while len(rs) > 24: eps *= 1.5; rs = simplify(r, eps)
            if len(rs) < 3 or ring_area(rs) <= 10: continue
            blds.append((rs, h, typ))
    # parçalara (1 km) ayır
    ncx, ncy = int(math.ceil((x1 - x0) / CH)), int(math.ceil((y1 - y0) / CH))
    chunks = [[] for _ in range(ncx * ncy)]
    for rs, h, typ in blds:
        cx, cy = rs.mean(0)
        ci = min(ncx - 1, int((cx - x0) // CH)); cj = min(ncy - 1, int((cy - y0) // CH))
        chunks[cj * ncx + ci].append((rs, h, typ))
    body = bytearray(); table = []
    for k, chk in enumerate(chunks):
        table.append((len(body), len(chk)))
        ci, cj = k % ncx, k // ncx; ox, oy = x0 + ci * CH, y0 + cj * CH
        for rs, h, typ in chk:
            q = np.round((rs - [ox, oy]) * 2).astype(int)
            q[:, 0] = np.clip(q[:, 0], -2000, 4000); q[:, 1] = np.clip(q[:, 1], -2000, 4000)
            hq = int(round(h * 2))
            body += struct.pack('<BB', len(q), typ)
            if hq < 255: body += struct.pack('<B', hq)
            else: body += struct.pack('<BH', 255, int(round(h * 10)))
            body += struct.pack('<hh', int(q[0, 0]), int(q[0, 1]))
            for (ax_, ay_), (bx_, by_) in zip(q, q[1:]):
                dx, dy = bx_ - ax_, by_ - ay_
                if -127 <= dx <= 127 and -127 <= dy <= 127: body += struct.pack('<bb', dx, dy)
                else: body += struct.pack('<bhh', -128, dx, dy)
    head = b'YKB3' + struct.pack('<IddHHf', len(blds), x0, y0, ncx, ncy, CH)
    for o, n in table: head += struct.pack('<IH', o, n)
    return head + bytes(body), len(blds)

# ağaç rasterı (16 m, 2 bit: 0 yok, 1 orman, 2 park/bahçe/mezarlık, 3 çalılık)
TREE_FOREST = {('landuse', 'forest'), ('natural', 'wood')}
TREE_PARK = {('leisure', 'park'), ('leisure', 'garden'), ('landuse', 'cemetery'), ('landuse', 'orchard'), ('leisure', 'golf_course'), ('landuse', 'recreation_ground')}
TREE_SCRUB = {('natural', 'scrub'), ('natural', 'heath')}
def tree_rasters():
    rects = {b['id']: region_rect(b) for b in ALLREG}
    imgs = {}
    for k, (x0, y0, x1, y1) in rects.items():
        imgs[k] = Image.new('L', (int(math.ceil((x1 - x0) / 16)), int(math.ceil((y1 - y0) / 16))), 0)
    drs = {k: ImageDraw.Draw(v) for k, v in imgs.items()}
    def cls(t):
        for kk in ('landuse', 'natural', 'leisure'):
            v = (kk, t.get(kk))
            if v in TREE_FOREST: return 1
            if v in TREE_PARK: return 2
            if v in TREE_SCRUB: return 3
        return 0
    for f in read_seq('ortu.geojsonseq'):
        c = cls(f['properties'])
        if not c: continue
        for poly in polys(f['geometry']):
            o = poly[0]
            lo0, la0 = o[0]
            r = None
            for k, (x0, y0, x1, y1) in rects.items():
                if r is None: r = proj_ring(o)
                if r[:, 0].max() < x0 or r[:, 0].min() > x1 or r[:, 1].max() < y0 or r[:, 1].min() > y1: continue
                pts = [((x - x0) / 16, (y1 - y) / 16) for x, y in r]
                drs[k].polygon(pts, fill=c)
                for hole in poly[1:]:
                    if len(hole) >= 4: drs[k].polygon([((x - x0) / 16, (y1 - y) / 16) for x, y in proj_ring(hole)], fill=0)
    out = {}
    for k, im in imgs.items():
        a = np.array(im)[::-1]      # satır 0 = güney (y0)
        h, w = a.shape
        w4 = (w + 3) // 4 * 4
        pad = np.zeros((h, w4), np.uint8); pad[:, :w] = a
        packed = (pad[:, 0::4] | (pad[:, 1::4] << 2) | (pad[:, 2::4] << 4) | (pad[:, 3::4] << 6)).astype(np.uint8)
        out[k] = b'YKA1' + struct.pack('<ii', w4, h) + packed.tobytes()
    return out

if want('bina'):
    log('ağaç rasterları...')
    trees = tree_rasters()
    tot = 0
    for b in ALLREG:
        x0, y0, x1, y1 = region_rect(b)
        entry = {'id': b['id'], 'rect': [x0, y0, x1, y1]}
        if b.get('binalar'):
            data, nb = build_pack(b)
            sz = write_png_bytes(os.path.join(OUT, f"bina_{b['id']}.png"), data); tot += sz
            entry['bina'] = f"bina_{b['id']}.png"; entry['adet'] = nb
            log('bina', b['id'], nb, sz)
        sz = write_png_bytes(os.path.join(OUT, f"agac_{b['id']}.png"), trees[b['id']]); tot += sz
        entry['agac'] = f"agac_{b['id']}.png"
        index['paketler'].append(entry)
    log('bina+ağaç toplam', tot)
    json.dump(index['paketler'], open(os.path.join(RAW, 'paketler.json'), 'w'))
else:
    p = os.path.join(RAW, 'paketler.json')
    index['paketler'] = json.load(open(p)) if os.path.exists(p) else []

if not index.get('ortu'): index['ortu'] = {'x0': LC['x0'], 'y0': LC['y0'], 's': LC['s'], 'nx': LC['nx'], 'ny': LC['ny'], 'dosya': 'ortu.png'}
if not index.get('harita'): index['harita'] = {'x0': LC['x0'], 'y0': LC['y0'], 'w': 2048000.0, 'h': 1024000.0, 'dosya': 'harita.webp'}
index['genel'] = {'dosya': 'genel.png', **{k: OV[k] for k in ('x0', 'y0', 's', 'nx', 'ny')}}
index['lcc'] = {'lat0': lcc.LAT0, 'lon0': lcc.LON0, 'p1': 37.0, 'p2': 41.0, 'R': lcc.R}
json.dump(index, open(os.path.join(OUT, 'dizin.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
log('dizin.json yazıldı')
