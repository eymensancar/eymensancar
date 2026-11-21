#!/usr/bin/env python3
"""Burger Ustası: yeşil ekranlı karakter görsellerini oyuna hazırlar.

    python3 tools/karakter/yesil.py            (ham/ → www/g/karakter/)
    python3 tools/karakter/yesil.py --kontrol  (ayrıca docs/inceleme/v5/karakter-kontrol.jpg)

Girdi: tools/karakter/ham/cift-01 … cift-10 (.png ya da kayıpsız .webp; 1536×1024, saf yeşil zemin, yan yana 2 karakter,
ayak ucuna kadar tam boy). Çıktı: www/g/karakter/01.webp … 20.webp (cift-01 → 01 sol, 02 sağ …) ve manifest.json.

Adımlar:
 1. Chroma key: d = G − max(R, B) ("yeşillik"). Zeminin d'si ~235; karakterlerde yeşil giysi yok, d ≤ ~25.
    Alfa = (Dz − d) / (Dz − D0) (0…1); yarı saydam kenarda renk zeminden ayrıştırılır: C = (I − (1 − α)·K) / α (K = zemin rengi).
 2. Yeşil sızıntısı (despill): G = min(G, max(R, B)) bütün görselde (yeşil giysi olmadığı için güvenli). Gözlük camı gibi
    içeride kalan yeşil bölgeler saydam olur; 80 pikselden küçük kapalı delikler (kaş arası gibi) komşu renkle doldurulur.
 3. Kenar yumuşatma: alfa 0,7 px bulanıklaştırılır; çok küçük alfa (< 0,04) sıfırlanır; kopuk kırıntılar (< 300 px) atılır.
 4. İki karakter: alfa maskesinin sütun toplamında ortadaki en geniş boşluk; her yarı ayrı kırpılır (sıkı, 6 px pay).
 5. Aynı ölçek: hepsi ÖLCEK ile küçültülür (görseldeki boy oranları korunur), premultiplied alfa ile; webp q=82.
Manifest: ad, w, h (piksel), ayak (alttan saydam pay, px), bas (üstten saydam pay, px), boy (karakterin kendi boyu, px), olcek.
"""
import json, os, sys
import numpy as np
import cv2
from PIL import Image, ImageFilter

KOK = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HAM = os.path.join(KOK, 'tools', 'karakter', 'ham')
CIK = os.path.join(KOK, 'www', 'g', 'karakter')
OLCEK = 0.6   # kaynak pikseli → çıktı pikseli (oyunda 1 çıktı pikseli = 0,7 sahne birimi: oyun.js KAR_OLCEK)
D0 = 28.0
PAY = 6
ADLAR = ['isci', 'ofis', 'dede', 'nine', 'polis', 'itfaiyeci', 'isadami', 'ogrenci', 'motorcu', 'kurye',
         'doktor', 'rapci', 'turist', 'sporcu', 'balikci', 'ressam', 'taraftar', 'elestirmen', 'kaykayci', 'gencKiz']


def oku(i):
    for uz in ('png', 'webp'):
        p = os.path.join(HAM, f'cift-{i:02d}.{uz}')
        if os.path.exists(p):
            return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    raise FileNotFoundError(f'cift-{i:02d}')


def anahtar(a):
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    d = G - np.maximum(R, B)
    zem = d > 150
    K = np.median(a[zem], axis=0)                       # zemin rengi
    Dz = float(K[1] - max(K[0], K[2])) - 8
    al = np.clip((Dz - d) / (Dz - D0), 0, 1)
    # renk ayrıştırma (yalnız yarı saydam kenarda)
    am = np.maximum(al, 1e-3)[..., None]
    c = (a - (1 - al[..., None]) * K) / am
    c = np.where((al > 0.02)[..., None] & (al < 0.98)[..., None], c, a)
    c = np.clip(c, 0, 255)
    # despill
    mx = np.maximum(c[..., 0], c[..., 2])
    c[..., 1] = np.minimum(c[..., 1], mx + 2)
    # küçük kapalı delikler (kaş arası, saç arası): komşu renkle doldur
    sert = (al > 0.5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(1 - sert, 8)
    H, W = sert.shape
    doldur = np.zeros_like(sert)
    for k in range(1, n):
        x, y, w, h, ar = st[k]
        if x == 0 or y == 0 or x + w >= W or y + h >= H:
            continue
        if ar < 80:
            doldur[lab == k] = 1
    if doldur.any():
        doldur = cv2.dilate(doldur, np.ones((3, 3), np.uint8))
        c8 = cv2.inpaint(np.clip(c, 0, 255).astype(np.uint8), doldur, 3, cv2.INPAINT_TELEA).astype(np.float32)
        c = np.where(doldur[..., None] > 0, c8, c)
        al = np.where(doldur > 0, 1.0, al)
    # kenar yumuşatma ve kırıntı temizliği
    al = cv2.GaussianBlur(al, (0, 0), 0.7)
    al[al < 0.04] = 0
    m = (al > 0.3).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    tut = np.zeros(n, bool)
    tut[1:] = st[1:, cv2.CC_STAT_AREA] >= 300
    yakin = cv2.dilate(tut[lab].astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    al = np.where(yakin, al, 0)
    return c, al


def bol(al):
    """İki karakteri ayıran sütun: ortadaki (%25–75) en geniş boş sütun dizisinin ortası."""
    col = (al > 0.1).sum(0)
    W = len(col)
    en, bas, iyi = 0, None, W // 2
    i = W // 4
    while i < 3 * W // 4:
        if col[i] == 0:
            j = i
            while j < 3 * W // 4 and col[j] == 0:
                j += 1
            if j - i > en:
                en, iyi = j - i, (i + j) // 2
            i = j
        else:
            i += 1
    if en == 0:   # boşluk yoksa en az dolu sütun
        iyi = W // 4 + int(np.argmin(col[W // 4:3 * W // 4]))
    return iyi


def kirp(c, al, x0, x1):
    a = al[:, x0:x1]
    ys, xs = np.where(a > 0.04)
    y0, y1 = max(0, ys.min() - PAY), min(a.shape[0], ys.max() + 1 + PAY)
    xa, xb = max(0, xs.min() - PAY), min(a.shape[1], xs.max() + 1 + PAY)
    rgb = c[y0:y1, x0 + xa:x0 + xb]
    aa = al[y0:y1, x0 + xa:x0 + xb]
    rgba = np.dstack([rgb, aa * 255]).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA'), int(ys.max() - ys.min() + 1)


def kucult(im):
    w, h = round(im.width * OLCEK), round(im.height * OLCEK)
    return im.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')


def main():
    os.makedirs(CIK, exist_ok=True)
    man = []
    no = 0
    for i in range(1, 11):
        a = oku(i)
        c, al = anahtar(a)
        s = bol(al)
        for x0, x1 in ((0, s), (s, al.shape[1])):
            no += 1
            im, boy = kirp(c, al, x0, x1)
            im = kucult(im)
            arr = np.asarray(im)[..., 3]
            rows = np.where(arr.max(1) > 10)[0]
            yol = os.path.join(CIK, f'{no:02d}.webp')
            im.save(yol, 'WEBP', quality=82, method=6, alpha_quality=90)
            man.append({'no': no, 'ad': ADLAR[no - 1], 'w': im.width, 'h': im.height,
                        'bas': int(rows.min()), 'ayak': int(im.height - 1 - rows.max()), 'boy': round(boy * OLCEK),
                        'kb': round(os.path.getsize(yol) / 1024, 1)})
            print(f'{no:02d} {ADLAR[no-1]:<11} {im.width}×{im.height}  {man[-1]["kb"]} KB')
    with open(os.path.join(CIK, 'manifest.json'), 'w') as f:
        json.dump({'olcek': OLCEK, 'kaynak': 'tools/karakter/ham/cift-NN (1536×1024)', 'karakter': man}, f, ensure_ascii=False, indent=1)
    # oyunun okuduğu liste (fetch gerekmesin diye JS): www/js/karakter.js
    js = '/* tools/karakter/yesil.py üretir; elle değiştirme. Müşteri görselleri www/g/karakter/NN.webp.\n' \
         '   w, h: görselin pikseli; bas: üstte saydam pay; ayak: altta saydam pay (px). Hepsi aynı ölçekte (OLCEK). */\n' \
         'window.BU=window.BU||{};BU.KARAKTER=' + json.dumps([{k: m[k] for k in ('no', 'ad', 'w', 'h', 'bas', 'ayak')} for m in man], separators=(',', ':')) + ';\n'
    open(os.path.join(KOK, 'www', 'js', 'karakter.js'), 'w').write(js)
    print('toplam', round(sum(m['kb'] for m in man)), 'KB')
    if '--kontrol' in sys.argv:
        kontrol(man)


def kontrol(man):
    """20 karakter, koyu ve açık zeminde (yeşil kenar kalmış mı); ayak çizgisi hizalı (gerçek boy oranı)."""
    out = os.path.join(KOK, 'docs', 'inceleme', 'v5')
    os.makedirs(out, exist_ok=True)
    ims = [Image.open(os.path.join(CIK, f'{m["no"]:02d}.webp')) for m in man]
    k = 0.5
    ims = [im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS) for im in ims]
    H = max(im.height for im in ims) + 20
    W = sum(im.width for im in ims[:10]) + 20 * 11
    tuval = Image.new('RGB', (W, H * 4), (0, 0, 0))
    zem = [(40, 22, 14), (246, 236, 214)]
    for z in range(2):
        for satir in range(2):
            y0 = (z * 2 + satir) * H
            tuval.paste(zem[z], (0, y0, W, y0 + H))
            x = 20
            for im in ims[satir * 10:(satir + 1) * 10]:
                tuval.paste(im, (x, y0 + H - 10 - im.height), im)
                x += im.width + 20
    tuval.save(os.path.join(out, 'karakter-kontrol.jpg'), quality=86)
    # yakın plan: yüzler (gözlük, kaş) 2× büyük, açık zeminde
    yak = []
    for no in (3, 15, 11, 1):
        im = Image.open(os.path.join(CIK, f'{no:02d}.webp'))
        y = man[no - 1]['bas']
        yak.append(im.crop((0, y, im.width, y + 300)))
    YW = sum(i.width for i in yak)
    t2 = Image.new('RGB', (YW, 600), (246, 236, 214))
    x = 0
    for im in yak:
        t2.paste((40, 22, 14), (x, im.height, x + im.width, im.height * 2))
        t2.paste(im, (x, 0), im); t2.paste(im, (x, im.height), im); x += im.width
    t2.save(os.path.join(out, 'karakter-yakin.jpg'), quality=86)


if __name__ == '__main__':
    main()
