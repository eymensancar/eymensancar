"""Türkiye yükseklik karoları: AWS Terrain Tiles (Terrarium PNG, herkese açık).
z7 genel bakış (22-48 D, 33.5-44.5 K), z9 temel (25-45.5 D, 35-43 K), z11 ayrıntı bölgeleri (bolgeler.json).
Çıktı: tools/raw/dem/z{Z}_{x}_{y}.png. Paralel indirir; var olanı atlar."""
import math, os, json, subprocess, concurrent.futures as cf
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'raw', 'dem'); os.makedirs(D, exist_ok=True)
def tx(lon, z): return int((lon + 180) / 360 * 2**z)
def ty(lat, z):
    r = math.radians(lat); return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**z)
jobs = set()
def box(z, s, n, w, e):
    for x in range(tx(w, z), tx(e, z) + 1):
        for y in range(ty(n, z), ty(s, z) + 1): jobs.add((z, x, y))
box(7, 33.5, 44.5, 22, 48)
box(9, 35, 43, 25, 45.5)
for b in json.load(open(os.path.join(HERE, 'bolgeler.json')))['bolgeler']:
    la, lo, h = b['lat'], b['lon'], b['yari'] * 1000 + 3000
    dla = h / 111000; dlo = h / (111000 * math.cos(math.radians(la)))
    box(11, la - dla, la + dla, lo - dlo, lo + dlo)
def get(j):
    z, x, y = j
    f = os.path.join(D, f'z{z}_{x}_{y}.png')
    if os.path.exists(f) and os.path.getsize(f) > 100: return 0
    for _ in range(4):
        r = subprocess.run(['curl', '-s', '-m', '90', '-o', f, '-w', '%{http_code}', f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], capture_output=True, text=True)
        if r.stdout == '200': return 1
    print('olmadı', j); return 0
print(len(jobs), 'karo')
with cf.ThreadPoolExecutor(12) as ex: n = sum(ex.map(get, sorted(jobs)))
print('indirilen', n)
