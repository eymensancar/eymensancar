import json, math, subprocess, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lcc import proj, inv
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'raw', 'osm')
B = json.load(open(os.path.join(H, '..', '..', 'bolgeler.json')))['bolgeler']
B.append({'id': 'istanbul', 'lat': 41.085, 'lon': 28.97, 'yari': 15.5, 'binalar': True})
for b in B:
    if not b['binalar']: continue
    cx, cy = proj(b['lat'], b['lon']); h = b['yari'] * 1000 + 500
    pts = [inv(cx + sx * h, cy + sy * h) for sx in (-1, 1) for sy in (-1, 1)]
    s, n = min(p[0] for p in pts), max(p[0] for p in pts); w, e = min(p[1] for p in pts), max(p[1] for p in pts)
    out = os.path.join(H, f"bina_{b['id']}.geojsonseq")
    if os.path.exists(out): continue
    subprocess.run(['osmium', 'extract', '-b', f'{w},{s},{e},{n}', os.path.join(H, 'bina.pbf'), '-o', os.path.join(H, 'tmp.pbf'), '--overwrite', '-s', 'complete_ways'], check=True)
    subprocess.run(['osmium', 'export', os.path.join(H, 'tmp.pbf'), '-f', 'geojsonseq', '-o', out, '--overwrite', '--geometry-types=polygon'], check=True)
    print(b['id'], sum(1 for _ in open(out)))
