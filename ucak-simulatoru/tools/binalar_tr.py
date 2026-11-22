"""Türkiye'nin bütün OpenStreetMap binaları ve ana yolları (ODbL) -> www/data/tr/bina/q_<boy>_<i>_<j>.png paketleri ve bina.json dizini.

Girdi: tools/raw/osm/bina_tr.geojsonseq
  (osmium export bina.pbf -f geojsonseq -o bina_tr.geojsonseq --geometry-types=polygon --add-unique-id=type_id)
  tools/raw/hava_haric.json (havalimanlari.py: ayrıca çizilen terminal, hangar ve kuleler)
Yollar: tools/raw/osm/yol.geojsonseq (osmium export yol.pbf ... --geometry-types=linestring; osm_ayikla.sh): otoyol, devlet yolu,
  birincil, ikincil yollar ve bağlantıları her yerde; üçüncül yollar yalnız yerleşim içinde (parçada en az 30 bina).
Paket biçimi (YKB4, bworker.js okur): başlık 'YKB4', bina sayısı, x0, y0 (f64), ncx, ncy (u16), parça boyu 1000 m (f32), yol bölümünün konumu (u32);
  her 1 km parça için (konum u32, adet u16); bina: köşe sayısı u8, tür u8, yükseklik u8 (yarım metre; 255 ise u16 desimetre;
  0: etiketsiz, oyun yerleşim sıklığına göre kat verir), ilk köşe int16 x 2 (yarım metre, parça köşesine göre), sonra farklar int8 x 2
  (taşarsa -128 ve int16 x 2).
Yol bölümü: her parça için (konum u32, adet u16), sonra yol parçaları: tür u8 (1 otoyol, 2 devlet, 3 birincil, 4 ikincil,
  5 üçüncül, 6 bağlantı; +16 köprü), köşe sayısı u8, ilk köşe int16 x 2 (yarım metre, parça köşesine göre), farklar binalardaki gibi.
Paketler dörtlü ağaçla bölünür: 128 km'lik karelerden başlanır, 260 000 binadan fazlası dörde bölünür (en küçük 32 km).
Çalıştır: python3 tools/binalar_tr.py
"""
import json, math, os, struct, sys, time, random
import multiprocessing as mp
import numpy as np
from PIL import Image
import orjson

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lcc
RAW = os.path.join(HERE, 'raw'); OSM = os.path.join(RAW, 'osm')
OUT = os.path.join(HERE, '..', 'www', 'data', 'tr'); BOUT = os.path.join(OUT, 'bina'); os.makedirs(BOUT, exist_ok=True)
SRC = os.path.join(OSM, 'bina_tr.geojsonseq')
IDX = json.load(open(os.path.join(OUT, 'dizin.json')))
RX0, RY0 = IDX['kok'][0], IDX['kok'][1]
CH = 1000.0
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.0f}s]', *a, flush=True)

IST_LM = [(41.025658, 28.974155, 25), (41.021164, 29.004092, 40), (41.008583, 28.980175, 75), (41.005410, 28.976814, 80), (41.016111, 28.963889, 70),
          (41.084722, 29.056111, 130), (41.01638, 29.06554, 35), (41.0277, 29.0697, 60),
          (39.925054, 32.836952, 120), (39.885, 32.856, 30), (39.9168, 32.8604, 70), (38.4189, 27.1287, 18)]
LMP = [(lcc.proj(a, b), r) for a, b, r in IST_LM]
TYPE = {'mosque': 1, 'industrial': 2, 'warehouse': 2, 'hangar': 9, 'church': 4, 'castle': 4, 'tower': 4, 'palace': 5, 'house': 6, 'detached': 6, 'semidetached_house': 6,
        'bungalow': 6, 'hut': 6, 'shed': 6, 'garage': 6, 'garages': 6, 'farm': 6, 'barn': 6, 'cabin': 6, 'farm_auxiliary': 6, 'stable': 6, 'commercial': 7, 'retail': 7,
        'supermarket': 7, 'office': 3, 'school': 8, 'university': 8, 'college': 8, 'hospital': 8, 'public': 8, 'government': 8, 'civic': 8, 'train_station': 8,
        'transportation': 9, 'stadium': 8, 'sports_hall': 8, 'greenhouse': 2, 'service': 2, 'kindergarten': 8, 'dormitory': 0, 'apartments': 0, 'residential': 0, 'hotel': 7}
SKIP = {'roof', 'construction', 'ruins', 'no', 'carport', 'canopy', 'collapsed', 'destroyed', 'demolished', 'abandoned', 'proposed', 'tent', 'container'}

def write_png_bytes(path, data):
    data = struct.pack('<I', len(data)) + bytes(data)
    W = 2048; npx = (len(data) + 2) // 3; H = (npx + W - 1) // W
    buf = np.zeros(W * H * 3, np.uint8); buf[:len(data)] = np.frombuffer(data, np.uint8)
    Image.fromarray(buf.reshape(H, W, 3), 'RGB').save(path, optimize=True, compress_level=9)
    return os.path.getsize(path)
def num(v):
    try: return float(str(v).replace(',', '.').split(';')[0].replace('m', '').strip())
    except Exception: return None
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

HARIC = None
def work(args):
    """Dosyanın bir bölümünü işler: 1 km parçalara göre kodlanmış kayıtlar (bytes) ve sayılar."""
    start, end = args
    haric = set(json.load(open(os.path.join(RAW, 'hava_haric.json')))) if os.path.exists(os.path.join(RAW, 'hava_haric.json')) else set()
    out = {}; cnt = {}; n = 0; skipped = 0
    with open(SRC, 'rb') as f:
        f.seek(start)
        if start: f.readline()
        while f.tell() <= end:
            line = f.readline()
            if not line: break
            line = line.strip().lstrip(b'\x1e')
            if not line: continue
            ft = orjson.loads(line)
            t = ft['properties']; bt = t.get('building', 'yes')
            if bt in SKIP or t.get('building:part') or t.get('location') == 'underground' or str(t.get('layer', '0')).startswith('-'): continue
            if str(ft.get('id')) in haric: skipped += 1; continue
            g = ft['geometry']
            polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates'] if g['type'] == 'MultiPolygon' else []
            for poly in polys:
                c = np.asarray(poly[0], np.float64)
                if len(c) < 4: continue
                x, y = lcc.proj_np(c[:, 1], c[:, 0]); r = np.stack([x, y], 1)
                if np.allclose(r[0], r[-1]): r = r[:-1]
                if len(r) < 3: continue
                a = ring_area(r)
                if abs(a) < 20: continue
                if a < 0: r = r[::-1]
                cx, cy = r.mean(0)
                if any(math.hypot(cx - p[0], cy - p[1]) < rad for p, rad in LMP): continue
                h = num(t.get('height')) if t.get('height') else None
                lv = num(t.get('building:levels')) if t.get('building:levels') else None
                if h is None and lv is not None and 0 < lv < 120: h = lv * 3.1 + 1.5
                mosque = bt == 'mosque' or (t.get('amenity') == 'place_of_worship' and t.get('religion') == 'muslim')
                typ = 1 if mosque else TYPE.get(bt, 0)
                if t.get('historic') and typ == 0: typ = 4
                if 'Sarayı' in (t.get('name') or '') or t.get('historic') == 'palace': typ = 5
                if h is not None: h = max(3, min(h, 330))
                if h is None:
                    rnd = random.Random(int(cx * 7 + cy * 13))
                    if typ == 1: h = 10
                    elif typ in (2, 9): h = 7 + rnd.random() * 6
                    elif typ == 6: h = 4 + rnd.random() * 3.5
                    elif typ == 7: h = 6 + rnd.random() * 8
                    elif typ == 8: h = 9 + rnd.random() * 9
                    else: h = 0     # yerleşim sıklığına göre oyunda
                if typ == 0 and h >= 45: typ = 3
                eps = 0.6 if abs(a) < 2000 else 1.2
                rs = simplify(r, eps)
                while len(rs) > 24: eps *= 1.5; rs = simplify(r, eps)
                if len(rs) < 3 or ring_area(rs) <= 10: continue
                cx, cy = rs.mean(0)
                ci, cj = int((cx - RX0) // CH), int((cy - RY0) // CH)
                ox, oy = RX0 + ci * CH, RY0 + cj * CH
                q = np.round((rs - [ox, oy]) * 2).astype(int)
                q[:, 0] = np.clip(q[:, 0], -2000, 4000); q[:, 1] = np.clip(q[:, 1], -2000, 4000)
                hq = int(round(h * 2))
                rec = struct.pack('<BB', len(q), typ)
                if hq < 255: rec += struct.pack('<B', max(0, hq) if h > 0 else 0)
                else: rec += struct.pack('<BH', 255, int(round(h * 10)))
                rec += struct.pack('<hh', int(q[0, 0]), int(q[0, 1]))
                for (ax_, ay_), (bx_, by_) in zip(q, q[1:]):
                    dx, dy = bx_ - ax_, by_ - ay_
                    if -127 <= dx <= 127 and -127 <= dy <= 127: rec += struct.pack('<bb', dx, dy)
                    else: rec += struct.pack('<bhh', -128, dx, dy)
                k = (ci, cj)
                b = out.get(k)
                if b is None: out[k] = bytearray(rec); cnt[k] = 1
                else: b += rec; cnt[k] += 1
                n += 1
    return out, cnt, n, skipped

RCLS = {'motorway': 1, 'trunk': 2, 'primary': 3, 'secondary': 4, 'tertiary': 5, 'motorway_link': 6, 'trunk_link': 6, 'primary_link': 6}
def roads(counts):
    """Yolları 300 m'yi geçmeyen parçalara böler, orta noktasının 1 km parçasına kodlar."""
    out = {}; cnt = {}; n = 0
    with open(os.path.join(OSM, 'yol.geojsonseq'), 'rb') as f:
        for line in f:
            line = line.strip().lstrip(b'\x1e')
            if not line: continue
            ft = orjson.loads(line); t = ft['properties']
            c = RCLS.get(t.get('highway'))
            if not c or t.get('tunnel') in ('yes', 'building_passage') or t.get('area') == 'yes': continue
            co = np.asarray(ft['geometry']['coordinates'], np.float64)
            if len(co) < 2: continue
            x, y = lcc.proj_np(co[:, 1], co[:, 0]); r = dp(np.stack([x, y], 1), 2.0)
            br = 16 if t.get('bridge') in ('yes', 'viaduct') else 0
            # 300 m'lik parçalar
            seg = [r[0]]; acc = 0.0; pieces = []
            for k in range(1, len(r)):
                L = float(np.hypot(*(r[k] - r[k - 1])))
                while L > 0 and acc + L > 300:
                    t2 = (300 - acc) / L; pt = r[k - 1] + (r[k] - r[k - 1]) * t2
                    seg.append(pt); pieces.append(np.array(seg)); seg = [pt]; r[k - 1] = pt; L = float(np.hypot(*(r[k] - pt))); acc = 0.0
                seg.append(r[k]); acc += L
            if len(seg) > 1: pieces.append(np.array(seg))
            for pc in pieces:
                if len(pc) < 2 or len(pc) > 250: continue
                m = pc.mean(0)
                ci, cj = int((m[0] - RX0) // CH), int((m[1] - RY0) // CH)
                if c == 5 and counts.get((ci, cj), 0) < 30: continue
                ox, oy = RX0 + ci * CH, RY0 + cj * CH
                q = np.round((pc - [ox, oy]) * 2).astype(int)
                if np.abs(q).max() > 30000: continue
                rec = struct.pack('<BBhh', c | br, len(q), int(q[0, 0]), int(q[0, 1]))
                for (ax_, ay_), (bx_, by_) in zip(q, q[1:]):
                    dx, dy = bx_ - ax_, by_ - ay_
                    if -127 <= dx <= 127 and -127 <= dy <= 127: rec += struct.pack('<bb', dx, dy)
                    else: rec += struct.pack('<bhh', -128, dx, dy)
                k = (ci, cj)
                if k in out: out[k] += rec; cnt[k] += 1
                else: out[k] = bytearray(rec); cnt[k] = 1
                n += 1
    return out, cnt, n

if __name__ == '__main__':
    import pickle
    size = os.path.getsize(SRC); NP = max(1, os.cpu_count())
    cache = os.path.join(RAW, 'binalar_onbellek.pkl')
    import hashlib
    hp = os.path.join(RAW, 'hava_haric.json')
    hk = (os.path.getmtime(SRC), hashlib.md5(open(hp, 'rb').read()).hexdigest() if os.path.exists(hp) else '')
    if os.path.exists(cache):
        C = pickle.load(open(cache, 'rb'))
        if C['key'] != hk: C = None
    else: C = None
    if C: chunks, counts, tot = C['chunks'], C['counts'], C['tot']; log('önbellekten', tot, 'bina')
    else:
        parts = 64
        ranges = [(size * i // parts, size * (i + 1) // parts - 1) for i in range(parts)]
        log('işleniyor', size, 'bayt', NP, 'süreç')
        chunks = {}; counts = {}; tot = 0; sk = 0
        with mp.Pool(NP) as pool:
            for k, (o, c, n, s) in enumerate(pool.imap_unordered(work, ranges)):
                for key, b in o.items():
                    if key in chunks: chunks[key] += b; counts[key] += c[key]
                    else: chunks[key] = b; counts[key] = c[key]
                tot += n; sk += s
                if k % 8 == 0: log(k + 1, '/', parts, 'bina', tot)
        log('bina', tot, 'havalimanı yapısı dışarıda', sk, 'parça', len(chunks))
        pickle.dump({'key': hk, 'chunks': chunks, 'counts': counts, 'tot': tot}, open(cache, 'wb'))
    rchunks, rcounts, nroad = roads(counts)
    log('yol parçası', nroad, 'parça', len(rchunks))
    # dörtlü ağaç paketleri
    def count_in(i0, j0, sz):
        return sum(c for (i, j), c in counts.items() if i0 <= i < i0 + sz and j0 <= j < j0 + sz)
    keys = np.array(list(counts.keys())); vals = np.array([counts[tuple(k)] for k in keys])
    leaves = []
    def split(i0, j0, sz):
        m = (keys[:, 0] >= i0) & (keys[:, 0] < i0 + sz) & (keys[:, 1] >= j0) & (keys[:, 1] < j0 + sz)
        n = int(vals[m].sum())
        if n == 0: return
        if n > 260000 and sz > 32:
            h = sz // 2
            for dj in (0, h):
                for di in (0, h): split(i0 + di, j0 + dj, h)
        else: leaves.append((i0, j0, sz, n))
    TOP = 128
    for J in range(0, 2048, TOP):
        for I in range(0, 2048, TOP): split(I, J, TOP)
    log('paket', len(leaves))
    for f in os.listdir(BOUT):
        if f.startswith('q_'): os.remove(os.path.join(BOUT, f))
    index = []; total = 0
    for i0, j0, sz, n in leaves:
        # paketin dolu kısmına kırp (boş kenarlar tabloyu şişirmesin)
        ks = [(i, j) for (i, j) in list(counts) + list(rcounts) if i0 <= i < i0 + sz and j0 <= j < j0 + sz]
        a0 = min(k[0] for k in ks); a1 = max(k[0] for k in ks) + 1; b0 = min(k[1] for k in ks); b1 = max(k[1] for k in ks) + 1
        ncx, ncy = a1 - a0, b1 - b0
        body = bytearray(); table = []; nb = 0
        for j in range(b0, b1):
            for i in range(a0, a1):
                b = chunks.get((i, j)); c = counts.get((i, j), 0)
                table.append((len(body), c))
                if b: body += b; nb += c
        rbody = bytearray(); rtable = []
        for j in range(b0, b1):
            for i in range(a0, a1):
                b = rchunks.get((i, j)); c = rcounts.get((i, j), 0)
                rtable.append((len(rbody), c))
                if b: rbody += b
        x0, y0 = RX0 + a0 * CH, RY0 + b0 * CH
        hlen = 36 + ncx * ncy * 6
        roff = hlen + len(body)
        head = b'YKB4' + struct.pack('<IddHHfI', nb, x0, y0, ncx, ncy, CH, roff)
        for o, c in table: head += struct.pack('<IH', o, min(c, 65535))
        body = bytes(body) + b''.join(struct.pack('<IH', o, min(c, 65535)) for o, c in rtable) + bytes(rbody)
        name = f'bina/q_{sz}_{i0}_{j0}.png'
        s = write_png_bytes(os.path.join(OUT, name), head + bytes(body)); total += s
        index.append({'id': f'q{sz}_{i0}_{j0}', 'rect': [x0, y0, x0 + ncx * CH, y0 + ncy * CH], 'dosya': name, 'adet': nb})
        log(name, nb, s)
    json.dump({'paketler': index, 'toplam': tot}, open(os.path.join(OUT, 'bina.json'), 'w'), separators=(',', ':'))
    log('toplam', tot, 'bina', len(index), 'paket', total, 'bayt')
    # eski bölge paketleri (bina_<bölge>.png) artık kullanılmıyor: dizinden çıkar, dosyaları sil
    for p in IDX['paketler']:
        f = p.pop('bina', None); p.pop('adet', None)
        if f and os.path.exists(os.path.join(OUT, f)): os.remove(os.path.join(OUT, f))
    json.dump(IDX, open(os.path.join(OUT, 'dizin.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
