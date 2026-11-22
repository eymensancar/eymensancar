"""İstanbul Uçuşu - harita verisini hazırlar.

Girdi:  tools/raw/*.json (fetch_osm.sh, OpenStreetMap, ODbL) ve tools/raw/dem/*.png (fetch_dem.py, AWS Terrain Tiles)
Çıktı:  www/data/
  zemin.webp      4096x4096 zemin dokusu (RGBA; alfa = kara, su yerinde saydam)
  maske.png       2048x2048 kara/su maskesi (oyunda yer türü için)
  yukseklik.bin   Int16 yükseklik ızgarası (desimetre), başlıkta boyut
  binalar.bin     bina tabanları ve yükseklikleri (ikili, aşağıda biçim)
  kopruler.json   köprü eksenleri
  pist.json       Atatürk Havalimanı pisti
  harita.png      küçük harita (512x512)

Bina dosyası (küçük endian):
  'YKB1', uint32 bina sayısı, uint16 parça (chunk) kenar sayısı, uint16 parça boyu (m)
  her parça için uint32 başlangıç bayt ofseti, uint32 bina sayısı  (parça sırası: satır satır, kuzeyden)
  her bina: uint8 köşe sayısı n, uint8 tür, uint16 yükseklik (dm), int16 x0, int16 y0 (0.5 m birim, doğu/kuzey),
            sonra n-1 köşe için int8 dx, int8 dy (0.5 m); -128 gelirse ardından int16 dx, int16 dy.
"""
import json, glob, math, os, struct, sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', 'www', 'data')
os.makedirs(OUT, exist_ok=True)

S, N, W, E = 40.955, 41.215, 28.80, 29.14
LAT0, LON0 = (S + N) / 2, (W + E) / 2
MLAT = 111319.49 * 1.0
MLON = 111319.49 * math.cos(math.radians(LAT0))
X0, X1 = (W - LON0) * MLON, (E - LON0) * MLON      # doğu
Y0, Y1 = (S - LAT0) * MLAT, (N - LAT0) * MLAT      # kuzey
print('kapsam m:', round(X1 - X0), 'x', round(Y1 - Y0), 'merkez', LAT0, LON0)

def proj(lat, lon):
    return ((lon - LON0) * MLON, (lat - LAT0) * MLAT)

TEX = 4096
def tpx(x, y, size=TEX):
    return ((x - X0) / (X1 - X0) * size, (Y1 - y) / (Y1 - Y0) * size)

def load(name):
    p = os.path.join(RAW, name + '.json')
    if not os.path.exists(p): return []
    return json.load(open(p))['elements']

def assemble(lines):
    """Uç uca eklenmiş yolları kapalı halkalara birleştirir."""
    lines = [list(l) for l in lines if len(l) >= 2]
    rings = []
    key = lambda p: (round(p[0], 2), round(p[1], 2))
    while lines:
        cur = lines.pop()
        changed = True
        while key(cur[0]) != key(cur[-1]) and changed:
            changed = False
            for i, l in enumerate(lines):
                if key(l[0]) == key(cur[-1]): cur += l[1:]
                elif key(l[-1]) == key(cur[-1]): cur += l[::-1][1:]
                elif key(l[-1]) == key(cur[0]): cur = l[:-1] + cur
                elif key(l[0]) == key(cur[0]): cur = l[::-1][:-1] + cur
                else: continue
                lines.pop(i); changed = True; break
        if len(cur) >= 3: rings.append(cur)
    return rings

def way_rings(e):
    """eleman -> [(rol, [(x,y),...])]"""
    if e['type'] == 'way' and 'geometry' in e:
        return [('outer', [proj(g['lat'], g['lon']) for g in e['geometry']])]
    out = []
    if e['type'] == 'relation':
        by = {'outer': [], 'inner': []}
        for m in e.get('members', []):
            if m.get('type') == 'way' and 'geometry' in m:
                by['inner' if m.get('role') == 'inner' else 'outer'].append([proj(g['lat'], g['lon']) for g in m['geometry'] if g])
        for role in ('outer', 'inner'):
            for r in assemble(by[role]): out.append((role, r))
    return out

# ---------------- kara / su maskesi ----------------
def build_mask(size):
    img = Image.new('L', (size, size), 0)       # 0 boş, 255 kıyı çizgisi (engel)
    d = ImageDraw.Draw(img)
    seeds_land, seeds_water = [], []
    for e in load('coast'):
        pts = [tpx(*proj(g['lat'], g['lon']), size) for g in e['geometry']]
        d.line(pts, fill=255, width=1)
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            dx, dy = bx - ax, by - ay
            L = math.hypot(dx, dy)
            if L < 1e-6: continue
            nx, ny = -dy / L, dx / L   # resim ekseninde (y aşağı) sol taraf
            # OSM: kara kıyı çizgisinin solundadır. Resimde y ters olduğundan sol = (dy, -dx)
            lx, ly = dy / L, -dx / L
            steps = max(1, int(L / 3))
            for k in range(steps):
                t = (k + 0.5) / steps
                px, py = ax + dx * t, ay + dy * t
                seeds_land.append((px + lx * 1.6, py + ly * 1.6))
                seeds_water.append((px - lx * 1.6, py - ly * 1.6))
    bar = np.array(img) > 0
    lab, n = ndimage.label(~bar)
    votes = np.zeros((n + 1, 2))
    def vote(pts, k):
        for x, y in pts:
            ix, iy = int(x), int(y)
            if 0 <= ix < size and 0 <= iy < size:
                votes[lab[iy, ix], k] += 1
    vote(seeds_land, 0); vote(seeds_water, 1)
    land = np.zeros(n + 1, bool)
    land[1:] = votes[1:, 0] >= votes[1:, 1]
    # oyu olmayan büyük parçalar: kenar kuzeyde ise kara (Karadeniz bu alanda yok)
    m = land[lab]
    m[bar] = True
    # göller ve su alanları
    wimg = Image.new('L', (size, size), 0); wd = ImageDraw.Draw(wimg)
    for e in load('water'):
        t = e.get('tags', {})
        if t.get('water') in ('reflecting_pool', 'fountain', 'basin', 'wastewater', 'pond') : continue
        for role, ring in way_rings(e):
            if len(ring) < 3: continue
            pts = [tpx(x, y, size) for x, y in ring]
            wd.polygon(pts, fill=0 if role == 'inner' else 255)
    m &= ~(np.array(wimg) > 0)
    return m

print('maske...')
mask = build_mask(TEX)
Image.fromarray((mask * 255).astype(np.uint8)).resize((2048, 2048), Image.BILINEAR).point(lambda v: 255 if v >= 128 else 0).convert('1').save(os.path.join(OUT, 'maske.png'), optimize=True)

# ---------------- yükseklik ----------------
print('yükseklik...')
Z = 12
def tile_xy(lat, lon):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    r = math.radians(lat)
    y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
    return x, y
tiles = {}
for f in glob.glob(os.path.join(RAW, 'dem', 'z12_*.png')):
    _, x, y = os.path.basename(f)[:-4].split('_')
    a = np.asarray(Image.open(f).convert('RGB')).astype(np.float64)
    tiles[(int(x), int(y))] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
def dem(lat, lon):
    tx, ty = tile_xy(lat, lon)
    ix, iy = int(tx), int(ty)
    t = tiles.get((ix, iy))
    if t is None: return 0.0
    px, py = (tx - ix) * 256 - 0.5, (ty - iy) * 256 - 0.5
    x0, y0 = int(max(0, min(254, math.floor(px)))), int(max(0, min(254, math.floor(py))))
    fx, fy = min(1, max(0, px - x0)), min(1, max(0, py - y0))
    return (t[y0, x0] * (1 - fx) * (1 - fy) + t[y0, x0 + 1] * fx * (1 - fy) + t[y0 + 1, x0] * (1 - fx) * fy + t[y0 + 1, x0 + 1] * fx * fy)

HG = 385
H = np.zeros((HG, HG))
for j in range(HG):        # j: kuzeyden güneye
    y = Y1 - (Y1 - Y0) * j / (HG - 1)
    lat = LAT0 + y / MLAT
    for i in range(HG):
        x = X0 + (X1 - X0) * i / (HG - 1)
        H[j, i] = dem(lat, LON0 + x / MLON)
# su: maske üzerinden. Kara en az 1.5 m, kıyıya yakın yumuşak iniş
msmall = np.array(Image.fromarray((mask * 255).astype(np.uint8)).resize((HG, HG), Image.BILINEAR)) / 255.0
H = np.maximum(H, 0)
H = ndimage.gaussian_filter(H, 0.6)
H = np.where(msmall > 0.5, np.maximum(H, 1.5 + 6 * (msmall - 0.5)), 0.0)

# pist ve havalimanı düzlüğü
aero = load('aero')
rw = [e for e in aero if e.get('tags', {}).get('aeroway') == 'runway' and e['id'] in (865874754, 1024090849, 510404110)]
pts = []
for e in rw: pts += [proj(g['lat'], g['lon']) for g in e['geometry']]
pts = np.array(pts)
# uç noktalar: ana eksende en uzak iki nokta
c = pts.mean(0); u, s_, vt = np.linalg.svd(pts - c); ax = vt[0]
pr = (pts - c) @ ax
A, B = c + ax * pr.min(), c + ax * pr.max()
if A[0] > B[0]: A, B = B, A   # A güneybatı (05 başı)
rlen = float(np.linalg.norm(B - A))
hdg = (math.degrees(math.atan2(B[0] - A[0], B[1] - A[1])) + 360) % 360
# pist yüksekliği: eksen boyunca ortalama
samples = []
for t in np.linspace(0, 1, 40):
    p = A + (B - A) * t
    samples.append(dem(LAT0 + p[1] / MLAT, LON0 + p[0] / MLON))
relev = float(np.median(samples))
print('pist', round(rlen), 'm, yön', round(hdg, 1), 'yükseklik', round(relev, 1))
# pistin çevresinde düzleştir (600 m bant, yumuşak geçiş)
for j in range(HG):
    y = Y1 - (Y1 - Y0) * j / (HG - 1)
    for i in range(HG):
        x = X0 + (X1 - X0) * i / (HG - 1)
        p = np.array([x, y]) - A
        t = max(0, min(rlen, p @ ax * (1 if (B - A) @ ax > 0 else -1)))
        q = A + (B - A) / rlen * t
        d = math.hypot(x - q[0], y - q[1])
        along = p @ ((B - A) / rlen)
        dd = max(d, -along, along - rlen)
        if dd < 900 and msmall[j, i] > 0.5:
            w = 1 if dd < 450 else 1 - (dd - 450) / 450
            H[j, i] = H[j, i] * (1 - w) + relev * w
json.dump({'a': [round(A[0], 1), round(A[1], 1)], 'b': [round(B[0], 1), round(B[1], 1)], 'len': round(rlen, 1), 'width': 60, 'heading': round(hdg, 2), 'elev': round(relev, 2), 'name': 'LTBA 05/23'}, open(os.path.join(OUT, 'pist.json'), 'w'))
with open(os.path.join(OUT, 'yukseklik.bin'), 'wb') as f:
    f.write(b'YKH1'); f.write(struct.pack('<HHffff', HG, HG, X0, X1, Y0, Y1))
    f.write(np.clip(np.round(H * 10), -32000, 32000).astype('<i2').tobytes())
print('yükseklik en çok', H.max())

# ---------------- binalar ----------------
print('binalar...')
def ring_area(r):
    a = 0
    for (x1, y1), (x2, y2) in zip(r, r[1:] + r[:1]): a += x1 * y2 - x2 * y1
    return a / 2
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a; L = np.linalg.norm(ab)
    best, bi = 0, 0
    for i in range(1, len(pts) - 1):
        p = np.array(pts[i])
        d = np.linalg.norm(p - a) if L < 1e-9 else abs(ab[0] * (p - a)[1] - ab[1] * (p - a)[0]) / L
        if d > best: best, bi = d, i
    if best > eps:
        return dp(pts[:bi + 1], eps)[:-1] + dp(pts[bi:], eps)
    return [pts[0], pts[-1]]
def simplify(r, eps):
    # kapalı halka: en uzak iki noktadan böl
    if len(r) <= 4: return r
    i0 = 0; far = max(range(len(r)), key=lambda i: (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2)
    a = dp(r[:far + 1], eps); b = dp(r[far:] + [r[0]], eps)
    return a[:-1] + b[:-1]

def num(v):
    try:
        return float(str(v).replace(',', '.').split(';')[0].replace('m', '').strip())
    except Exception:
        return None

# el ile modellenen yapıların çevresindeki OSM binaları çıkarılır (enlem, boylam, yarıçap m)
LANDMARKS = [
    (41.025658, 28.974155, 25),   # Galata Kulesi
    (41.021164, 29.004092, 40),   # Kız Kulesi
    (41.008583, 28.980175, 75),   # Ayasofya
    (41.005410, 28.976814, 80),   # Sultanahmet
    (41.016111, 28.963889, 70),   # Süleymaniye
    (41.084722, 29.056111, 130),  # Rumeli Hisarı
    (41.01638, 29.06554, 35),     # Çamlıca Kulesi
    (41.0277, 29.0697, 60),       # Büyük Çamlıca Camii (yaklaşık)
]
LM = [(proj(a, b), r) for a, b, r in LANDMARKS]

seen = set(); blds = []
files = sorted(glob.glob(os.path.join(RAW, 'b_*.json')))
names = {}
for f in files:
    try:
        els = json.load(open(f))['elements']
    except Exception as ex:
        print('okunamadı', f, ex); continue
    for e in els:
        if e['type'] != 'way' or e['id'] in seen or 'geometry' not in e: continue
        seen.add(e['id'])
        t = e.get('tags', {})
        bt = t.get('building', 'yes')
        if bt in ('roof', 'construction', 'ruins', 'no', 'carport', 'canopy'): continue
        if t.get('location') == 'underground' or t.get('layer', '0').startswith('-'): continue
        r = [proj(g['lat'], g['lon']) for g in e['geometry']]
        if len(r) > 1 and r[0] == r[-1]: r = r[:-1]
        if len(r) < 3: continue
        a = ring_area(r)
        if abs(a) < 35: continue
        if a < 0: r = r[::-1]
        cx = sum(p[0] for p in r) / len(r); cy = sum(p[1] for p in r) / len(r)
        if not (X0 + 50 < cx < X1 - 50 and Y0 + 50 < cy < Y1 - 50): continue
        if any(math.hypot(cx - p[0], cy - p[1]) < rad for p, rad in LM): continue
        nm = t.get('name')
        if nm: names[nm] = (round(cx), round(cy))
        h = num(t.get('height')) if t.get('height') else None
        lv = num(t.get('building:levels')) if t.get('building:levels') else None
        tagged = h is not None or lv is not None
        if h is None and lv is not None: h = lv * 3.1 + 1.5
        rnd = random.Random(e['id'])
        mosque = bt == 'mosque' or (t.get('amenity') == 'place_of_worship' and t.get('religion') == 'muslim')
        if h is None:
            if mosque: h = 10
            elif bt in ('industrial', 'warehouse', 'hangar', 'retail', 'supermarket', 'commercial'): h = 8 + rnd.random() * 6
            elif bt in ('house', 'detached', 'hut', 'shed', 'garage', 'garages', 'kiosk', 'service', 'cabin'): h = 4 + rnd.random() * 4
            else:
                lvls = rnd.choice([2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7])
                if abs(a) > 1500: lvls += 2
                h = lvls * 3.0 + 1.0
        h = max(3, min(h, 320))
        typ = 0
        if mosque: typ = 1
        elif bt in ('industrial', 'warehouse', 'hangar'): typ = 2
        elif h >= 50: typ = 3
        elif bt == 'palace' or t.get('historic') == 'palace' or 'Sarayı' in (t.get('name') or ''): typ = 5
        elif t.get('historic') or bt in ('castle', 'church', 'tower'): typ = 4
        eps = 0.8 if abs(a) < 2000 else 1.5
        rs = simplify(r, eps)
        while len(rs) > 20: eps *= 1.6; rs = simplify(r, eps)
        if len(rs) < 3: continue
        if ring_area(rs) <= 10: continue
        score = abs(a) * (h + 6) * (8 if tagged else 1) * (50 if typ in (1, 3, 4, 5) else 1)
        blds.append((score, rs, h, typ, cx, cy))
print('okunan bina:', len(blds), 'dosya:', len(files))
json.dump(names, open(os.path.join(RAW, 'adlar.json'), 'w'), ensure_ascii=False)

MAXB = int(os.environ.get('MAXB', '120000'))
blds.sort(key=lambda b: -b[0])
keep, drop = blds[:MAXB], blds[MAXB:]
print('tutulan:', len(keep))

CH = 2000
NCX = int(math.ceil((X1 - X0) / CH)); NCY = int(math.ceil((Y1 - Y0) / CH)); NC = max(NCX, NCY)
chunks = [[] for _ in range(NC * NC)]
for b in keep:
    ci = int((b[4] - X0) // CH); cj = int((Y1 - b[5]) // CH)
    chunks[cj * NC + ci].append(b)
body = bytearray(); table = []
for ch in chunks:
    table.append((len(body), len(ch)))
    for score, rs, h, typ, cx, cy in ch:
        q = [(int(round(x * 2)), int(round(y * 2))) for x, y in rs]
        body += struct.pack('<BBHhh', len(q), typ, int(round(h * 10)), q[0][0], q[0][1])
        for (ax_, ay_), (bx_, by_) in zip(q, q[1:]):
            dx, dy = bx_ - ax_, by_ - ay_
            if -127 <= dx <= 127 and -127 <= dy <= 127: body += struct.pack('<bb', dx, dy)
            else: body += struct.pack('<bhh', -128, dx, dy)
with open(os.path.join(OUT, 'binalar.bin'), 'wb') as f:
    f.write(b'YKB1'); f.write(struct.pack('<IHHffff', len(keep), NC, CH, X0, X1, Y0, Y1))
    for o, n in table: f.write(struct.pack('<II', o, n))
    f.write(body)
print('binalar.bin', os.path.getsize(os.path.join(OUT, 'binalar.bin')))

# ---------------- köprüler ----------------
BR = {403255158: ('15 Temmuz Şehitler Köprüsü', 'asma', 64, 1074, 165),
      403376607: ('Fatih Sultan Mehmet Köprüsü', 'asma', 64, 1090, 110),
      1011426485: ('Yavuz Sultan Selim Köprüsü', 'karma', 64, 1408, 322),
      280961352: ('Galata Köprüsü', 'kiriş', 6, 0, 0),
      619249707: ('Atatürk Köprüsü', 'kiriş', 6, 0, 0)}
brs = []
for e in load('bridges'):
    if e['id'] not in BR or 'geometry' not in e: continue
    nm, kind, deck, span, tower = BR[e['id']]
    pts = np.array([proj(g['lat'], g['lon']) for g in e['geometry']])
    c = pts.mean(0); _, _, vt = np.linalg.svd(pts - c); ax = vt[0]; nrm = np.array([-ax[1], ax[0]])
    pa = (pts - c) @ ax; pn = (pts - c) @ nrm
    a, b = c + ax * pa.min(), c + ax * pa.max()
    width = float(pn.max() - pn.min())
    # kıyı geçişleri: eksen boyunca maskeye bak
    L = float(pa.max() - pa.min()); wet = []
    for k in range(400):
        p = a + (b - a) * (k / 399)
        ix, iy = tpx(p[0], p[1])
        wet.append(not mask[min(TEX - 1, max(0, int(iy))), min(TEX - 1, max(0, int(ix)))])
    ws = [k for k, w in enumerate(wet) if w]
    mid = (a + b) / 2
    if ws: mid = a + (b - a) * ((ws[0] + ws[-1]) / 2 / 399)
    brs.append({'name': nm, 'kind': kind, 'a': [round(a[0], 1), round(a[1], 1)], 'b': [round(b[0], 1), round(b[1], 1)],
                'mid': [round(mid[0], 1), round(mid[1], 1)], 'width': round(min(width, 45), 1), 'deck': deck, 'span': span, 'tower': tower,
                'wetLen': round(L * (len(ws) / 400), 1)})
    print('köprü', nm, round(L), 'm, su üstü', brs[-1]['wetLen'])
json.dump(brs, open(os.path.join(OUT, 'kopruler.json'), 'w'), ensure_ascii=False)

# ---------------- zemin dokusu ----------------
print('doku...')
rng = np.random.default_rng(1)
base = np.zeros((TEX, TEX, 3), np.float32)
# kentsel zemin rengi + yükseklikle hafif değişim + gürültü
Hb = np.array(Image.fromarray(H.astype(np.float32)).resize((TEX, TEX), Image.BILINEAR))
noise = ndimage.gaussian_filter(rng.standard_normal((TEX // 8, TEX // 8)), 1.5)
noise = np.array(Image.fromarray(noise.astype(np.float32)).resize((TEX, TEX), Image.BILINEAR))
noise /= (np.abs(noise).max() + 1e-6)
urban = np.array([178, 170, 152], np.float32)
base[:] = urban
base += noise[..., None] * 14
img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB')
d = ImageDraw.Draw(img)
ppm = TEX / (X1 - X0)
GREEN = {'forest': (88, 112, 66), 'wood': (84, 108, 62), 'scrub': (112, 124, 80), 'heath': (130, 132, 90), 'grassland': (128, 142, 88),
         'park': (112, 140, 82), 'garden': (110, 138, 80), 'golf_course': (120, 152, 86), 'pitch': (110, 146, 84), 'grass': (126, 146, 88),
         'meadow': (134, 148, 92), 'cemetery': (96, 118, 78), 'recreation_ground': (120, 144, 86), 'farmland': (150, 148, 104), 'orchard': (118, 136, 82)}
def poly_list(els, colfn):
    order = []
    for e in els:
        t = e.get('tags', {})
        col = colfn(t)
        if not col: continue
        for role, ring in way_rings(e):
            if len(ring) >= 3: order.append((role, ring, col))
    return order
gl = poly_list(load('green'), lambda t: GREEN.get(t.get('landuse')) or GREEN.get(t.get('natural')) or GREEN.get(t.get('leisure')))
for role, ring, col in sorted(gl, key=lambda r: -abs(ring_area(r[1]))):
    if role == 'inner': continue
    d.polygon([tpx(x, y) for x, y in ring], fill=col)
# havalimanı
for e in aero:
    t = e.get('tags', {}).get('aeroway')
    if t == 'apron':
        for role, ring in way_rings(e): d.polygon([tpx(x, y) for x, y in ring], fill=(132, 132, 128))
for e in aero:
    t = e.get('tags', {}).get('aeroway')
    if t == 'taxiway':
        d.line([tpx(*proj(g['lat'], g['lon'])) for g in e['geometry']], fill=(110, 110, 106), width=max(1, int(22 * ppm)))
# demiryolu ve yollar
for e in load('rail'):
    d.line([tpx(*proj(g['lat'], g['lon'])) for g in e['geometry']], fill=(128, 118, 108), width=1)
RW = {'motorway': (26, (118, 114, 108)), 'trunk': (22, (122, 118, 112)), 'primary': (16, (128, 124, 118)), 'secondary': (12, (134, 130, 124)),
      'tertiary': (9, (140, 136, 128)), 'motorway_link': (10, (122, 118, 112)), 'trunk_link': (9, (124, 120, 114))}
roads = load('roads')
for k in ['tertiary', 'secondary', 'primary', 'trunk_link', 'motorway_link', 'trunk', 'motorway']:
    wdt, col = RW[k]
    for e in roads:
        if e.get('tags', {}).get('highway') != k: continue
        d.line([tpx(*proj(g['lat'], g['lon'])) for g in e['geometry']], fill=col, width=max(1, int(round(wdt * ppm))), joint='curve')
# bina tabanları (uzakta binaların yerine geçer)
ROOF = [(168, 104, 82), (158, 96, 76), (190, 184, 174), (176, 170, 160), (150, 140, 128), (182, 120, 92)]
for score, rs, h, typ, cx, cy in blds:
    rnd = (int(cx * 7 + cy * 13)) % len(ROOF)
    col = ROOF[rnd] if typ in (0, 4) else ((170, 170, 168) if typ == 2 else (150, 156, 162) if typ == 5 else (196, 192, 184))
    d.polygon([tpx(x, y) for x, y in rs], fill=col)
arr = np.array(img).astype(np.float32)
# kıyıda hafif kum şeridi
dist = ndimage.distance_transform_edt(mask)
sand = (dist > 0) & (dist < 2.2)
arr[sand] = arr[sand] * 0.5 + np.array([196, 186, 160]) * 0.5
alpha = np.clip(ndimage.gaussian_filter(mask.astype(np.float32), 1.2) * 255, 0, 255).astype(np.uint8)  # yumuşak kıyı (alfa eşiği 0.5)
rgba = np.dstack([np.clip(arr, 0, 255).astype(np.uint8), alpha])
# saydam piksellerin rengi: kıyı rengini dışarı taşı (mip haritalarda kenar kararmasın)
im = Image.fromarray(rgba, 'RGBA')
rgb_bleed = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
ba = np.array(rgb_bleed); fa = np.array(im)
wm = ~mask
fa[wm, :3] = ba[wm]
Image.fromarray(fa, 'RGBA').save(os.path.join(OUT, 'zemin.webp'), quality=82, method=5)
print('zemin.webp', os.path.getsize(os.path.join(OUT, 'zemin.webp')))

# küçük harita
mm = Image.fromarray(np.where(mask[..., None], np.array([196, 190, 170], np.uint8), np.array([54, 104, 140], np.uint8)).astype(np.uint8)).resize((512, 512), Image.LANCZOS)
mm.save(os.path.join(OUT, 'harita.png'), optimize=True)
print('bitti')
