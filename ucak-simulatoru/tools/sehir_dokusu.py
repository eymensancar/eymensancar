"""Örtü dokusunun (www/data/tr/ortu.png) G kanalına (şehir) bina sıklığını ekler: bina paketlerindeki 1 km parça sayıları
500 m'lik örtü ızgarasına yumuşatılarak yazılır. Böylece binaların çizilmediği uzaklıkta da şehirler zeminde
şehir dokusuyla görünür (arazi gölgelendiricisi sokak ve çatı deseni çizer). Asıl örtü tools/raw/asil/ortu.png'de saklanır.
Önce: python3 tools/binalar_tr.py. Çalıştır: python3 tools/sehir_dokusu.py
"""
import json, os, struct
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'www', 'data', 'tr')
ASIL = os.path.join(HERE, 'raw', 'asil'); os.makedirs(ASIL, exist_ok=True)
IDX = json.load(open(os.path.join(OUT, 'dizin.json')))
O = IDX['ortu']
src = os.path.join(OUT, O['dosya']); keep = os.path.join(ASIL, 'ortu.png')
if not os.path.exists(keep): open(keep, 'wb').write(open(src, 'rb').read())
im = np.array(Image.open(keep).convert('RGBA'))
H, W = im.shape[:2]
dens = np.zeros((H, W), np.float32)    # bina / km²
for p in json.load(open(os.path.join(OUT, 'bina.json')))['paketler']:
    a = np.asarray(Image.open(os.path.join(OUT, p['dosya'])).convert('RGB')).reshape(-1)
    hdr = a[4:4 + 36].tobytes()
    n, x0, y0, ncx, ncy, ch = struct.unpack('<IddHHf', hdr[4:32])
    h0 = 36 if hdr[:4] == b'YKB4' else 32
    tbl = a[4 + h0:4 + h0 + ncx * ncy * 6].tobytes()
    cnt = np.frombuffer(tbl, dtype=[('o', '<u4'), ('c', '<u2')])['c'].reshape(ncy, ncx).astype(np.float32)
    # her 1 km parça örtü ızgarasında 2 x 2 piksel
    for j in range(ncy):
        row = cnt[j]
        if not row.any(): continue
        y = y0 + (j + 0.5) * ch
        pj = int((O['y0'] + O['ny'] * O['s'] - y) / O['s'])
        for i in np.nonzero(row)[0]:
            x = x0 + (i + 0.5) * ch
            pi = int((x - O['x0']) / O['s'])
            if 1 <= pi < W - 1 and 1 <= pj < H - 1:
                dens[pj - 1:pj + 1, pi - 1:pi + 1] = np.maximum(dens[pj - 1:pj + 1, pi - 1:pi + 1], row[i])
dens = ndimage.gaussian_filter(dens, 0.8)
urb = np.clip((dens - 40) / 900, 0, 1) ** 0.7 * 255
g = np.maximum(im[:, :, 1].astype(np.float32) * 0.6, urb)
im[:, :, 1] = np.clip(g, 0, 255).astype(np.uint8)
Image.fromarray(im, 'RGBA').save(src, optimize=True)
print('ortu.png', os.path.getsize(src), 'şehir pikseli', int((urb > 60).sum()))
