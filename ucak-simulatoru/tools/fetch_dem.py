"""Yukseklik verisi: AWS Terrain Tiles (Terrarium PNG, z12), herkese acik.
Kaynaklar: SRTM, GMTED, ETOPO1 vb. (bkz. https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
Cikti: tools/raw/dem/z12_x_y.png"""
import math, os, subprocess
Z = 12
S, N, W, E = 40.955, 41.215, 28.80, 29.14
def tx(lon): return int((lon + 180) / 360 * 2**Z)
def ty(lat):
    r = math.radians(lat)
    return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**Z)
d = os.path.join(os.path.dirname(__file__), 'raw', 'dem'); os.makedirs(d, exist_ok=True)
for x in range(tx(W), tx(E) + 1):
    for y in range(ty(N), ty(S) + 1):
        f = os.path.join(d, f'z{Z}_{x}_{y}.png')
        if not os.path.exists(f):
            subprocess.run(['curl', '-s', '-m', '60', '-o', f, f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'], check=True)
        print(f, os.path.getsize(f))
