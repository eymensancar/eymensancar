"""Türkiye'nin bütün havalimanları ve pistleri (OpenStreetMap, ODbL): pist, taksi yolu, apron, park yeri, kapı, körük,
bekleme noktası, PAPI, rüzgar tulumu, terminal ve hangar tabanları. Arazi her havalimanının altında düzleştirilir.

Girdi (tools/raw/, depoya girmez):
  osm/aero2.geojsonseq   osmium tags-filter turkey.osm.pbf nwr/aeroway (bkz. osm_ayikla.sh)
  osm/aerobina.geojsonseq havalimanı alanlarındaki binalar (bu betik osmium ile üretir)
  dem/z11_*.png          AWS Terrain Tiles; eksik karolar indirilir (herkese açık, Terrarium PNG)
Çıktı (www/data/tr/):
  hava.json              bütün havalimanlarının dizini (ad, kod, yükseklik, alan, pistler, ayrıntı dosyası)
  hava/h_<i>_<j>.json    ayrıntılar (256 km'lik temel karolara göre gruplu)
  hava/z_<i>_<j>.png     bölgelerin dışında kalan havalimanlarının 62.5 m yükseklik yamaları (çoklu ızgara)
  b_*.png, t_*.png       bölge ve temel yükseklik ızgaraları: havalimanlarının altı düzleştirilir (asılları tools/raw/asil/)
Çalıştır: python3 tools/havalimanlari.py
"""
import json, math, os, struct, sys, subprocess, statistics, concurrent.futures as cf
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import orjson
from shapely.geometry import shape, Point, LineString, Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely import prepared

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lcc
RAW = os.path.join(HERE, 'raw'); OSM = os.path.join(RAW, 'osm'); DEM = os.path.join(RAW, 'dem')
OUT = os.path.join(HERE, '..', 'www', 'data', 'tr'); HOUT = os.path.join(OUT, 'hava')
ASIL = os.path.join(RAW, 'asil'); os.makedirs(ASIL, exist_ok=True); os.makedirs(HOUT, exist_ok=True)
IDX = json.load(open(os.path.join(OUT, 'dizin.json')))
RX0, RY0 = IDX['kok'][0], IDX['kok'][1]
TS = IDX['temel']['s'] * IDX['temel']['n']     # 256 km
PS = 62.5
DECL = 5.5   # Türkiye'de manyetik sapma ~5-6° doğu (pist numaraları manyetik başa göre)

def log(*a): print(*a, flush=True)
def read_seq(path):
    with open(path, 'rb') as f:
        for line in f:
            line = line.strip().lstrip(b'\x1e')
            if line: yield orjson.loads(line)
def pj(coords):
    a = np.asarray(coords, np.float64)
    x, y = lcc.proj_np(a[:, 1], a[:, 0])
    return np.stack([x, y], 1)
def num(v, d=None):
    try: return float(str(v).replace(',', '.').split(';')[0].replace('m', '').strip())
    except Exception: return d

# ---------------- PNG kabı ve yükseklik ızgaraları (build_turkey.py ile aynı biçim) ----------------
def write_png_bytes(path, data):
    data = struct.pack('<I', len(data)) + bytes(data)
    W = 2048; npx = (len(data) + 2) // 3; H = (npx + W - 1) // W
    buf = np.zeros(W * H * 3, np.uint8); buf[:len(data)] = np.frombuffer(data, np.uint8)
    Image.fromarray(buf.reshape(H, W, 3), 'RGB').save(path, optimize=True, compress_level=9)
    return os.path.getsize(path)
def read_png_bytes(path):
    a = np.asarray(Image.open(path).convert('RGB')).reshape(-1)
    n = int(a[0]) | int(a[1]) << 8 | int(a[2]) << 16 | int(a[3]) << 24
    return a[4:4 + n].tobytes()
def grid_bytes(H, x0, y0, s):
    ny, nx = H.shape
    q = np.clip(np.round(H * 2), -32000, 32000).astype(np.int32)
    d = q.copy(); d[:, 1:] = q[:, 1:] - q[:, :-1]
    d = np.clip(d, -32768, 32767).astype('<i2')
    return b'YKH2' + struct.pack('<iiddf', nx, ny, x0, y0, s) + d.tobytes()
def grid_decode(b):
    nx, ny, x0, y0, s = struct.unpack('<iiddf', b[4:32])
    d = np.frombuffer(b[32:32 + nx * ny * 2], '<i2').reshape(ny, nx).astype(np.int32)
    return np.cumsum(d, 1).astype(np.float32) * 0.5, x0, y0, s

# ---------------- yükseklik verisi (Terrarium karoları) ----------------
_tiles = {}
def tile(z, x, y):
    k = (z, x, y)
    if k not in _tiles:
        f = os.path.join(DEM, f'z{z}_{x}_{y}.png')
        if os.path.exists(f):
            a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
            _tiles[k] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
        else: _tiles[k] = None
    return _tiles[k]
def tiles_for(z, la0, lo0, la1, lo1):
    n = 2 ** z
    def t(la, lo): return int((lo + 180) / 360 * n), int((1 - math.log(math.tan(math.radians(la)) + 1 / math.cos(math.radians(la))) / math.pi) / 2 * n)
    x0, y1 = t(la0, lo0); x1, y0 = t(la1, lo1)
    return [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
def fetch_tiles(keys, z=11):
    import requests
    need = [k for k in keys if not os.path.exists(os.path.join(DEM, f'z{z}_{k[0]}_{k[1]}.png'))]
    def get(k):
        u = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{k[0]}/{k[1]}.png'
        for _ in range(3):
            try:
                r = requests.get(u, timeout=30)
                if r.status_code == 200:
                    open(os.path.join(DEM, f'z{z}_{k[0]}_{k[1]}.png'), 'wb').write(r.content); return True
            except Exception: pass
        return False
    if need:
        log('yükseklik karosu indiriliyor:', len(need))
        with cf.ThreadPoolExecutor(8) as ex: list(ex.map(get, need))
def dem(z, lat, lon):
    n = 2 ** z
    tx = (lon + 180) / 360 * n
    r = np.radians(lat)
    ty = (1 - np.log(np.tan(r) + 1 / np.cos(r)) / np.pi) / 2 * n
    px, py = tx * 256 - 0.5, ty * 256 - 0.5
    x0 = np.floor(px).astype(np.int64); y0 = np.floor(py).astype(np.int64)
    fx = (px - x0).astype(np.float32); fy = (py - y0).astype(np.float32)
    acc = np.zeros(lat.shape, np.float32); wsum = np.zeros(lat.shape, np.float32)
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        gx, gy = x0 + dx, y0 + dy
        w = (fx if dx else 1 - fx) * (fy if dy else 1 - fy)
        tix, tiy = gx // 256, gy // 256
        val = np.full(lat.shape, np.nan, np.float32)
        for kx, ky in np.unique(np.stack([tix.ravel(), tiy.ravel()], 1), axis=0):
            t = tile(z, int(kx), int(ky))
            if t is None: continue
            m = (tix == kx) & (tiy == ky)
            val[m] = t[(gy[m] - ky * 256), (gx[m] - kx * 256)]
        ok = ~np.isnan(val)
        acc[ok] += val[ok] * w[ok]; wsum[ok] += w[ok]
    out = np.full(lat.shape, np.nan, np.float32); good = wsum > 0.5
    out[good] = acc[good] / wsum[good]
    return out
def dem_xy(X, Y, z=11):
    la, lo = lcc.inv_np(X, Y)
    H = dem(z, la, lo)
    bad = np.isnan(H)
    if bad.any(): H[bad] = dem(9, la[bad], lo[bad])
    return np.nan_to_num(H, nan=0.0)

# ================= 1. OSM özellikleri =================
log('aeroway özellikleri...')
SEEN = set()
F = {'aerodrome': [], 'runway': [], 'taxi': [], 'apron': [], 'pp': [], 'ppt': [], 'gate': [], 'bridge': [], 'hold': [], 'papi': [], 'sock': [], 'terminal': [], 'hangar': [], 'tower': [], 'twyarea': []}
BAD_SURF = {'grass', 'dirt', 'ground', 'unpaved', 'gravel', 'sand', 'earth', 'compacted', 'fine_gravel'}
for f in read_seq(os.path.join(OSM, 'aero2.geojsonseq')):
    p = f['properties']; g = f['geometry']; a = p.get('aeroway'); t = g['type']
    key = (a, json.dumps(g['coordinates'])[:200], len(json.dumps(g['coordinates'])))
    if key in SEEN: continue
    SEEN.add(key)
    if p.get('disused') == 'yes' or p.get('abandoned') == 'yes' or p.get('landuse') == 'construction' or p.get('usage') == 'under construction' or p.get('construction:aeroway'): continue
    poly = t in ('Polygon', 'MultiPolygon')
    if a == 'aerodrome': F['aerodrome'].append(f)
    elif a == 'runway' and t == 'LineString': F['runway'].append(f)
    elif a == 'runway' and poly and p.get('surface') not in BAD_SURF: F['twyarea'].append(f)
    elif a in ('taxiway', 'taxilane') and t == 'LineString' and p.get('area') != 'yes': F['taxi'].append(f)
    elif a in ('taxiway', 'taxilane', 'stopway', 'blast_pad', 'turn_pad') and poly: F['twyarea'].append(f)
    elif a == 'stopway' and t == 'LineString': F['taxi'].append(f)
    elif a == 'apron' and poly: F['apron'].append(f)
    elif a == 'parking_position' and t == 'LineString': F['pp'].append(f)
    elif a == 'parking_position' and t == 'Point': F['ppt'].append(f)
    elif a == 'gate' and t == 'Point': F['gate'].append(f)
    elif a == 'jet_bridge' and t == 'LineString': F['bridge'].append(f)
    elif a == 'holding_position' and t == 'Point': F['hold'].append(f)
    elif a in ('navigationaid', 'approch_papi') and t == 'Point' and (p.get('navigationaid') in ('papi', 'apapi') or a == 'approch_papi'): F['papi'].append(f)
    elif a == 'windsock' and t == 'Point': F['sock'].append(f)
    elif a == 'terminal' and poly: F['terminal'].append(f)
    elif a == 'hangar' and poly: F['hangar'].append(f)
    elif a == 'tower': F['tower'].append(f)
for k, v in F.items(): log(' ', k, len(v))

# ---------------- havalimanı alanları ----------------
def proj_geom(g):
    t = g['type']
    if t == 'Point': x, y = lcc.proj(g['coordinates'][1], g['coordinates'][0]); return Point(x, y)
    if t == 'LineString': return LineString(pj(g['coordinates']))
    if t == 'Polygon': return Polygon(pj(g['coordinates'][0]), [pj(h) for h in g['coordinates'][1:] if len(h) >= 4])
    if t == 'MultiPolygon':
        ps = [Polygon(pj(c[0]), [pj(h) for h in c[1:] if len(h) >= 4]) for c in g['coordinates'] if len(c[0]) >= 4]
        return MultiPolygon(ps).buffer(0) if len(ps) > 1 else ps[0].buffer(0)
    return None
AD = []
for f in F['aerodrome']:
    p = f['properties']; g = proj_geom(f['geometry'])
    if g is None or g.is_empty: continue
    AD.append({'icao': p.get('icao'), 'iata': p.get('iata'), 'name': p.get('name:tr') or p.get('name') or p.get('name:en'), 'geom': g, 'rw': [], 'military': p.get('military') or (p.get('aerodrome:type') or '').startswith('military') and 'mil'})
# aynı ICAO'lu alanları birleştir
byc = {}
for a in AD:
    k = a['icao'] or id(a)
    if k in byc and a['geom'].geom_type != 'Point':
        b = byc[k]; b['geom'] = unary_union([b['geom'], a['geom']]) if b['geom'].geom_type != 'Point' else a['geom']
        if a['name'] and (not b['name'] or 'Havalimanı' in a['name'] or 'Havaalanı' in a['name']): b['name'] = a['name']
    elif k not in byc: byc[k] = a
AD = list(byc.values())
AD.sort(key=lambda a: (not a['icao'], a['geom'].area if a['geom'].geom_type != 'Point' else 1e12))   # önce ICAO kodlu, küçük alanlı
for a in AD: a['prep'] = prepared.prep(a['geom'].buffer(300)) if a['geom'].geom_type != 'Point' else None
def find_ad(pt, lim=4000):
    for a in AD:
        if a['prep'] is not None and a['prep'].contains(pt): return a
    best, bd = None, lim
    for a in AD:
        d = a['geom'].distance(pt)
        if d < bd: best, bd = a, d
    return best

# ---------------- pistler ----------------
def bearing_true(x0, y0, x1, y1):
    la0, lo0 = lcc.inv(x0, y0); la1, lo1 = lcc.inv(x1, y1)
    p0, p1, dl = math.radians(la0), math.radians(la1), math.radians(lo1 - lo0)
    return (math.degrees(math.atan2(math.sin(dl) * math.cos(p1), math.cos(p0) * math.sin(p1) - math.sin(p0) * math.cos(p1) * math.cos(dl))) + 360) % 360
def parse_ref(ref):
    out = []
    for s in str(ref or '').replace(' ', '').split('/'):
        d = ''.join(ch for ch in s if ch.isdigit()); l = ''.join(ch for ch in s if ch in 'LCR')[:1]
        if d: out.append((int(d), l))
    return out
RWS = []
for f in F['runway']:
    p = f['properties']; pts = pj(f['geometry']['coordinates'])
    if len(pts) < 2: continue
    surf = (p.get('surface') or '').lower()
    paved = not any(s in BAD_SURF for s in surf.split(';')) if surf else True
    RWS.append({'pts': pts, 'ref': p.get('ref'), 'w': num(p.get('width')), 'surface': surf, 'paved': paved, 'disp': p.get('runway') == 'displaced_threshold'})
# aynı numaralı ya da aynı doğrultudaki parçaları birleştir
groups = []
for r in RWS:
    c = r['pts'].mean(0); d = r['pts'][-1] - r['pts'][0]; L = np.hypot(*d)
    if L < 50: continue
    u = d / L
    placed = False
    for g in groups:
        gu = g['u']; ang = abs(u[0] * gu[1] - u[1] * gu[0])
        off = abs((c - g['c'])[0] * gu[1] - (c - g['c'])[1] * gu[0])
        al = abs((c - g['c']) @ gu)
        same_ref = r['ref'] and g['ref'] and parse_ref(r['ref']) == parse_ref(g['ref'])
        if ang < 0.035 and off < 20 and al < 6000 and (same_ref or not r['ref'] or not g['ref']):
            g['parts'].append(r); g['ref'] = g['ref'] or r['ref']; placed = True; break
    if not placed: groups.append({'c': c, 'u': u, 'ref': r['ref'], 'parts': [r]})
runways = []
for g in groups:
    P = np.vstack([r['pts'] for r in g['parts']]); c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c, full_matrices=False); ax = vt[0]
    pr = (P - c) @ ax; a, b = c + ax * pr.min(), c + ax * pr.max(); L = float(pr.max() - pr.min())
    if L < 250: continue
    ws = [r['w'] for r in g['parts'] if r['w'] and 8 <= r['w'] <= 80]
    paved = any(r['paved'] for r in g['parts'])
    w = max(ws) if ws else (45.0 if L >= 2400 else 30.0 if L >= 1200 else 23.0 if paved else 20.0)
    hd = bearing_true(*a, *b)
    if hd >= 180: a, b = b, a; hd -= 180
    surf = next((r['surface'] for r in g['parts'] if r['surface']), '')
    # numaralar: OSM ref ile baş tutarlıysa ondan, değilse manyetik baştan
    refs = parse_ref(g['ref'])
    m1 = round(((hd - DECL) % 360) / 10) or 36; m2 = round(((hd + 180 - DECL) % 360) / 10) or 36
    d1, d2 = (m1, ''), (m2, '')
    if len(refs) == 2:
        r1, r2 = sorted(refs, key=lambda q: abs(((q[0] * 10 - (hd - DECL)) + 180) % 360 - 180))
        if abs(((r1[0] * 10 - (hd - DECL)) + 180) % 360 - 180) < 25 and abs(((r2[0] * 10 - (hd + 180 - DECL)) + 180) % 360 - 180) < 25: d1, d2 = r1, r2
    elif len(refs) == 1 and abs(((refs[0][0] * 10 - (hd - DECL)) + 180) % 360 - 180) < 25: d1 = refs[0]
    runways.append({'a': a, 'b': b, 'len': L, 'w': float(w), 'hd': hd, 'paved': paved, 'surface': surf, 'd1': d1, 'd2': d2})
log('pist', len(runways), 'kaplamalı', sum(r['paved'] for r in runways))

# ---------------- havalimanlarına dağıt ----------------
AP = {}
def ap_for(pt, lim=4000):
    a = find_ad(pt, lim)
    if a is None: return None
    k = a['icao'] or ('X%05d' % (abs(hash(round(a['geom'].centroid.x))) % 100000))
    if k not in AP:
        AP[k] = {'id': k, 'ad': a['name'] or k, 'iata': a['iata'], 'geom': a['geom'], 'rws': [], 'twy': [], 'twa': [], 'apron': [], 'pp': [], 'ppt': [], 'gate': [], 'bridge': [], 'hold': [], 'papi': [], 'sock': [], 'terminal': [], 'hangar': [], 'tower': [], 'mil': a['military']}
    return AP[k]
for r in runways:
    m = (r['a'] + r['b']) / 2
    ap = ap_for(Point(*m), 3000)
    if ap is None:
        k = 'P%d_%d' % (round(m[0] / 1000), round(m[1] / 1000))
        AP[k] = ap = {'id': k, 'ad': 'Pist', 'iata': None, 'geom': LineString([r['a'], r['b']]), 'rws': [], 'twy': [], 'twa': [], 'apron': [], 'pp': [], 'ppt': [], 'gate': [], 'bridge': [], 'hold': [], 'papi': [], 'sock': [], 'terminal': [], 'hangar': [], 'tower': [], 'mil': None}
    ap['rws'].append(r)
# yalnız pisti olan havalimanları; diğer özellikler en yakın pistli havalimanına
APL = [a for a in AP.values() if any(r['paved'] or r['len'] > 600 for r in a['rws'])]
for a in APL:
    a['zone'] = prepared.prep(unary_union([a['geom'].buffer(800)] + [LineString([r['a'], r['b']]).buffer(2500) for r in a['rws']]))
def owner(g):
    pt = g.representative_point() if g.geom_type != 'Point' else g
    for a in APL:
        if a['zone'].contains(pt): return a
    return None
def coords(g): return np.asarray(g.coords)
for f in F['taxi']:
    g = proj_geom(f['geometry']); a = owner(g)
    if not a: continue
    p = f['properties']; lane = p.get('aeroway') == 'taxilane'
    a['twy'].append({'pts': coords(g), 'w': num(p.get('width')), 'lane': lane, 'ref': p.get('ref'), 'stop': p.get('aeroway') == 'stopway'})
for key, dst in (('apron', 'apron'), ('twyarea', 'twa'), ('terminal', 'terminal'), ('hangar', 'hangar')):
    for f in F[key]:
        g = proj_geom(f['geometry'])
        if g is None or g.is_empty: continue
        a = owner(g)
        if not a: continue
        a[dst].append((g, f['properties']))
for key in ('pp', 'bridge'):
    for f in F[key]:
        g = proj_geom(f['geometry']); a = owner(g)
        if a: a[key].append((coords(g), f['properties']))
for key in ('ppt', 'gate', 'hold', 'papi', 'sock', 'tower'):
    for f in F[key]:
        g = proj_geom(f['geometry'])
        if g is None: continue
        a = owner(g)
        if a: a[key].append((g, f['properties']))
log('havalimanı', len(APL))

# ---------------- havalimanı binaları (bütün OSM binaları, alanların içinde) ----------------
AB = os.path.join(OSM, 'aerobina.geojsonseq')
if not os.path.exists(AB):
    log('havalimanı binaları (osmium)...')
    boxes = []
    for a in APL:
        x0, y0, x1, y1 = a['geom'].buffer(1500).bounds
        la0, lo0 = lcc.inv(x0, y0); la1, lo1 = lcc.inv(x1, y1)
        boxes.append(f'{min(lo0, lo1)},{min(la0, la1)},{max(lo0, lo1)},{max(la0, la1)}')
    tmp = os.path.join(OSM, 'aerobina_tmp.geojsonseq')
    with open(AB, 'wb') as out:
        for bb in boxes:
            subprocess.run(['osmium', 'extract', '-b', bb, os.path.join(OSM, 'bina.pbf'), '-o', os.path.join(OSM, 'ab.pbf'), '--overwrite', '-s', 'complete_ways'], check=True, capture_output=True)
            subprocess.run(['osmium', 'export', os.path.join(OSM, 'ab.pbf'), '-f', 'geojsonseq', '-o', tmp, '--overwrite', '--geometry-types=polygon', '--add-unique-id=type_id'], check=True, capture_output=True)
            out.write(open(tmp, 'rb').read())
BSEEN = set()
for f in read_seq(AB):
    oid = f.get('id') or json.dumps(f['geometry']['coordinates'])[:120]
    if oid in BSEEN: continue
    BSEEN.add(oid)
    p = f['properties']
    if p.get('building') in ('roof', 'construction', 'no', 'ruins') or p.get('building:part'): continue
    g = proj_geom(f['geometry'])
    if g is None or g.is_empty or g.area < 30: continue
    a = owner(g)
    if not a or not a['geom'].buffer(200).contains(g.representative_point()): continue
    a.setdefault('blds', []).append((g, p, oid))

# ================= 2. yükseklik ve düzleştirme =================
REG = [b for b in IDX['bolgeler']]
def in_region(rect):
    for b in REG:
        x0, y0, x1, y1 = b['rect']
        if rect[0] > x0 + 2500 and rect[1] > y0 + 2500 and rect[2] < x1 - 2500 and rect[3] < y1 - 2500: return b
    return None
OLD = {}
for fn in os.listdir(RAW):
    if fn.endswith('.rw.json'):
        for r in json.load(open(os.path.join(RAW, fn))): OLD[r['kod']] = r
def paved_geoms(a):
    out = []
    for r in a['rws']:
        if not r['paved']: continue
        u = (r['b'] - r['a']) / r['len']
        out.append((LineString([r['a'] - u * 60, r['b'] + u * 60]).buffer(r['w'] / 2 + 75, cap_style=2), 'rw'))
    for t in a['twy']: out.append((LineString(t['pts']).buffer((t['w'] or 23) / 2 + 30) if len(t['pts']) > 1 else None, 'tw'))
    for g, _ in a['apron'] + a['twa']: out.append((g.buffer(25), 'ap'))
    return [g for g, _ in out if g is not None and not g.is_empty]
for a in APL:
    pv = paved_geoms(a)
    a['paved_union'] = unary_union(pv) if pv else a['geom'].buffer(10)
    x0, y0, x1, y1 = a['paved_union'].bounds
    m = 3400
    a['prect'] = [math.floor((x0 - m) / PS) * PS, math.floor((y0 - m) / PS) * PS, math.ceil((x1 + m) / PS) * PS, math.ceil((y1 + m) / PS) * PS]
    a['region'] = in_region(a['prect'])
# indirilecek karolar: bölge dışındakilerin alanı
keys = set()
for a in APL:
    if a['region']: continue
    x0, y0, x1, y1 = a['prect']
    la0, lo0 = lcc.inv(x0, y0); la1, lo1 = lcc.inv(x1, y1); la2, lo2 = lcc.inv(x0, y1); la3, lo3 = lcc.inv(x1, y0)
    for k in tiles_for(11, min(la0, la1, la2, la3), min(lo0, lo1, lo2, lo3), max(la0, la1, la2, la3), max(lo0, lo1, lo2, lo3)): keys.add(k)
fetch_tiles(sorted(keys))
for a in APL:
    rp = [r for r in a['rws'] if r['paved']] or a['rws']
    old = [OLD[k] for k in (a['id'],) if k in OLD]
    if old: a['elev'] = float(old[0]['elev'])
    else:
        t = np.linspace(0, 1, 30)
        X = np.concatenate([r['a'][0] + (r['b'][0] - r['a'][0]) * t for r in rp]); Y = np.concatenate([r['a'][1] + (r['b'][1] - r['a'][1]) * t for r in rp])
        a['elev'] = round(float(np.median(dem_xy(X, Y))), 2)
    a['elev'] = max(a['elev'], 2.0)

def weight(a, X, Y, s):
    """Düzleştirme ağırlığı: kaplamalı alan + pay içinde 1, 450 m'de 0'a iner."""
    x0, y0 = X[0, 0], Y[0, 0]; ny, nx = X.shape
    k = 4   # 4 kat ince rasterla çiz, sonra uzaklık dönüşümü
    W, H = nx * k, ny * k
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    g = a['paved_union']
    polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    tp = lambda c: [((x - x0) / s * k + k / 2, (y - y0) / s * k + k / 2) for x, y in c]
    for p in polys:
        d.polygon(tp(p.exterior.coords), fill=255)
        for h in p.interiors: d.polygon(tp(h.coords), fill=0)
    m = np.array(im) > 0
    dist = ndimage.distance_transform_edt(~m) * (s / k)
    dist = dist[k // 2::k, k // 2::k][:ny, :nx]
    w = np.clip(1 - (dist - 40) / 420, 0, 1)
    return w * w * (3 - 2 * w)

def flatten_grid(H, x0, y0, s, aps):
    ny, nx = H.shape
    for a in aps:
        px0, py0, px1, py1 = a['prect']
        i0 = max(0, int((px0 - x0) // s)); i1 = min(nx, int((px1 - x0) // s) + 2); j0 = max(0, int((py0 - y0) // s)); j1 = min(ny, int((py1 - y0) // s) + 2)
        if i1 <= i0 or j1 <= j0: continue
        X, Y = np.meshgrid(x0 + np.arange(i0, i1) * s, y0 + np.arange(j0, j1) * s)
        w = weight(a, X, Y, s)
        sub = H[j0:j1, i0:i1]
        H[j0:j1, i0:i1] = sub * (1 - w) + a['elev'] * w
    return H

def original(name):
    """Düzleştirmeden önceki ızgara (ilk çalıştırmada asıl kopya saklanır)."""
    src = os.path.join(OUT, name); keep = os.path.join(ASIL, name)
    if not os.path.exists(keep): open(keep, 'wb').write(open(src, 'rb').read())
    return grid_decode(read_png_bytes(keep))

# bölge ızgaraları
for b in REG:
    aps = [a for a in APL if a['region'] is b]
    over = [a for a in APL if not a['region'] and a['prect'][2] > b['rect'][0] and a['prect'][0] < b['rect'][2] and a['prect'][3] > b['rect'][1] and a['prect'][1] < b['rect'][3]]
    if not aps and not over: continue
    H, x0, y0, s = original(b['dosya'])
    H = flatten_grid(H, x0, y0, s, aps + over)
    write_png_bytes(os.path.join(OUT, b['dosya']), grid_bytes(H, x0, y0, s))
    log('bölge', b['id'], [a['id'] for a in aps + over])
# temel karolar (500 m): kaba düzleştirme, uzaktan bakınca tepe gibi görünmesin
for ti, tj, fn in IDX['temel']['karolar']:
    H, x0, y0, s = original(fn)
    x1, y1 = x0 + (H.shape[1] - 1) * s, y0 + (H.shape[0] - 1) * s
    aps = [a for a in APL if a['prect'][2] > x0 and a['prect'][0] < x1 and a['prect'][3] > y0 and a['prect'][1] < y1]
    if not aps: continue
    H = flatten_grid(H, x0, y0, s, aps)
    write_png_bytes(os.path.join(OUT, fn), grid_bytes(H, x0, y0, s))
log('temel karolar düzleştirildi')

# bölge dışındakiler: 62.5 m yamalar, temel karo gruplarına göre çoklu ızgara dosyaları
def tkey(x, y): return int((x - RX0) // TS), int((y - RY0) // TS)
patches = {}
for a in APL:
    if a['region']: continue
    x0, y0, x1, y1 = a['prect']
    nx, ny = int(round((x1 - x0) / PS)) + 1, int(round((y1 - y0) / PS)) + 1
    X, Y = np.meshgrid(x0 + np.arange(nx) * PS, y0 + np.arange(ny) * PS)
    H = dem_xy(X, Y)
    H = flatten_grid(H, x0, y0, PS, [a])
    a['patch'] = (H, x0, y0)
    k = tkey((x0 + x1) / 2, (y0 + y1) / 2)
    patches.setdefault(k, []).append(a)
ap_patches = []
for (i, j), aps in sorted(patches.items()):
    fn = f'hava/z_{i}_{j}.png'
    body = b'YKHM' + struct.pack('<I', len(aps)); offs = []
    blobs = [grid_bytes(a['patch'][0], a['patch'][1], a['patch'][2], PS) for a in aps]
    o = 8 + 8 * len(aps)
    for bl in blobs: offs.append((o, len(bl))); o += len(bl)
    body += b''.join(struct.pack('<II', *q) for q in offs) + b''.join(blobs)
    sz = write_png_bytes(os.path.join(OUT, fn), body)
    for k, a in enumerate(aps):
        H, x0, y0 = a['patch']
        ap_patches.append({'id': 'ap_' + a['id'], 'ad': a['ad'], 'rect': [x0, y0, x0 + (H.shape[1] - 1) * PS, y0 + (H.shape[0] - 1) * PS], 'dosya': fn, 'k': k})
    log(fn, len(aps), sz)

# ================= 3. ayrıntı dosyaları =================
def R1(v): return round(float(v), 1)
def ring(c, cx, cy): return [[R1(x - cx), R1(y - cy)] for x, y in list(c)[:-1]]
def polyj(g, cx, cy):
    ps = [g] if g.geom_type == 'Polygon' else list(getattr(g, 'geoms', []))
    out = []
    for p in ps:
        if p.geom_type != 'Polygon' or p.area < 20: continue
        p = p.simplify(0.4)
        if p.is_empty or p.geom_type != 'Polygon': continue
        q = Polygon(p.exterior.coords[::-1] if not p.exterior.is_ccw else p.exterior.coords, [h.coords for h in p.interiors])
        out.append([ring(q.exterior.coords, cx, cy)] + [ring(h.coords, cx, cy) for h in q.interiors if len(h.coords) > 3])
    return out
def bh(p, kind):
    h = num(p.get('height')); lv = num(p.get('building:levels'))
    if h is None and lv is not None: h = lv * 4.0 + 2
    if h is None: h = {'terminal': 16.0, 'hangar': 18.0, 'tower': 40.0}.get(kind, 0.0)
    return max(3.0, min(h, 120.0))
idx_list = []; groups = {}; HARIC = set()
for a in APL:
    c = a['paved_union'].centroid; cx, cy = round(c.x), round(c.y)
    rws = []
    for r in a['rws']:
        rws.append({'a': [R1(r['a'][0] - cx), R1(r['a'][1] - cy)], 'b': [R1(r['b'][0] - cx), R1(r['b'][1] - cy)], 'w': r['w'], 'len': round(r['len']),
                    'd1': '%02d%s' % r['d1'], 'd2': '%02d%s' % r['d2'], 'paved': r['paved'], 'surf': r['surface'][:12], 'hd': round(r['hd'], 1)})
    rws.sort(key=lambda r: -r['len'] * (2 if r['paved'] else 1))
    small = max((r['len'] for r in a['rws']), default=0) < 1800
    twy = []
    for t in a['twy']:
        w = t['w'] if t['w'] and 5 <= t['w'] <= 60 else (15.0 if t['lane'] else 12.0 if small else 23.0)
        if t['stop']: w = max((r['w'] for r in a['rws']), default=45.0)
        ls = LineString(t['pts']).simplify(0.3)
        twy.append({'w': w, 'p': [[R1(x - cx), R1(y - cy)] for x, y in ls.coords], 'l': 1 if t['lane'] else 2 if t['stop'] else 0})
    apr = []
    for g, p in a['apron']: apr += polyj(g, cx, cy)
    twa = []
    for g, p in a['twa']: twa += polyj(g, cx, cy)
    pp = []
    for c2, p in a['pp']:
        ls = LineString(c2).simplify(0.3)
        if ls.length < 8: continue
        pp.append({'p': [[R1(x - cx), R1(y - cy)] for x, y in ls.coords], 'r': p.get('ref')})
    ppt = [{'p': [R1(g.x - cx), R1(g.y - cy)], 'r': p.get('ref')} for g, p in a['ppt']]
    gates = [{'p': [R1(g.x - cx), R1(g.y - cy)], 'r': p.get('ref')} for g, p in a['gate']]
    brs = [[[R1(x - cx), R1(y - cy)] for x, y in c2] for c2, p in a['bridge']]
    holds = [[R1(g.x - cx), R1(g.y - cy)] for g, p in a['hold'] if (p.get('holding_position:type') or 'runway') == 'runway']
    papi = [[R1(g.x - cx), R1(g.y - cy)] for g, p in a['papi']]
    socks = [[R1(g.x - cx), R1(g.y - cy)] for g, p in a['sock']]
    blds = []
    def addb(g, p, kind, oid=None):
        for pl in polyj(g, cx, cy):
            blds.append({'t': kind, 'h': round(bh(p, kind), 1), 'n': p.get('name'), 'id': oid, 'p': pl[0], 'r': p.get('roof:shape'), 'lv': num(p.get('building:levels'))})
    term_geoms = []
    for g, p in a['terminal']: addb(g, p, 'terminal'); term_geoms.append(g)
    for g, p in a['hangar']: addb(g, p, 'hangar')
    for g, p in a['tower']:
        if g.geom_type == 'Point': blds.append({'t': 'tower', 'h': bh(p, 'tower'), 'n': p.get('name'), 'p': [[R1(g.x - cx), R1(g.y - cy)]]})
        else: addb(g, p, 'tower')
    # havalimanı alanındaki diğer binalar (genel bina paketinde de var): terminal / hangar / kule olarak işaretli olanlar
    tu = prepared.prep(unary_union([g.buffer(2) for g in term_geoms])) if term_geoms else None
    excl = []
    for g, p, oid in a.get('blds', []):
        bt = p.get('building'); ae = p.get('aeroway')
        nm = (p.get('name') or '')
        kind = 'terminal' if (bt in ('terminal', 'airport_terminal', 'transportation', 'airport') or ae == 'terminal' or ('Terminal' in nm and g.area > 3000)) else 'hangar' if (bt == 'hangar' or ae == 'hangar') else 'tower' if (p.get('man_made') == 'tower' or ae in ('tower', 'control_tower') or bt == 'control_tower') else None
        rp = g.representative_point()
        if tu is not None and tu.contains(rp): excl.append(oid); continue
        if kind: addb(g, p, kind, oid); excl.append(oid)
    dist = 0
    small_ap = not any(r['paved'] and r['len'] >= 1500 for r in a['rws'])
    k = tkey(cx, cy); fn = f'hava/h_{k[0]}_{k[1]}.json'
    det = {'id': a['id'], 'x': cx, 'y': cy, 'elev': a['elev'], 'rws': rws, 'twy': twy, 'apron': apr, 'twa': twa, 'pp': pp, 'ppt': ppt, 'gate': gates, 'kopru': brs,
           'hold': holds, 'papi': papi, 'tulum': socks, 'bina': blds}
    groups.setdefault(fn, []).append(det)
    x0, y0, x1, y1 = a['paved_union'].bounds
    idx_list.append({'id': a['id'], 'ad': a['ad'], 'iata': a['iata'], 'x': cx, 'y': cy, 'elev': a['elev'], 'rect': [round(x0), round(y0), round(x1), round(y1)], 'dosya': fn,
                     'kucuk': small_ap, 'mil': bool(a['mil']), 'rws': [{k2: r[k2] for k2 in ('a', 'b', 'w', 'len', 'd1', 'd2', 'paved')} for r in rws]})
    HARIC.update(str(o) for o in excl)
for fn, lst in groups.items():
    open(os.path.join(OUT, fn), 'w').write(json.dumps(lst, ensure_ascii=False, separators=(',', ':')))
    log(fn, len(lst), os.path.getsize(os.path.join(OUT, fn)))
idx_list.sort(key=lambda a: (a['id'][0] != 'L', a['id']))
json.dump({'havalimanlari': idx_list, 'yamalar': ap_patches}, open(os.path.join(OUT, 'hava.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
# bina paketlerinin dışarıda bırakacağı OSM binaları (terminaller ayrıca çizilir)
json.dump(sorted(HARIC), open(os.path.join(RAW, 'hava_haric.json'), 'w'))
log('havalimanı', len(idx_list), 'pist', sum(len(a['rws']) for a in idx_list), 'kaplamalı', sum(1 for a in idx_list for r in a['rws'] if r['paved']))
