"""Burger Ustası, 3. mutfak (Eymen'in resmi): oyunun görsellerini resimden üretir.

    python3 tools/mutfak-v3/hazirla.py            (opencv-python-headless, numpy, Pillow)

Kaynak: docs/referans/mutfak-v3-eymen.png (1852x849). Resmin kendisi arka plandır; burada yalnız
  - kenarları uzatılmış arka plan (www/g/v3/mutfak.webp; resim değişmeden ortada, dört yanda pay),
  - resimde olmayan hâller resmin kendi piksellerinden yamanarak (boş küvetler, açılmış ızgaralar,
    boş gösterge, fritözde patates) ve
  - köfte, patates tutamı gibi parçalar resimden kırpılarak
üretilir. Hamburger katmanları, tahta, tepsi, patates kutusu ve çiğ köfte resimden değil, resmin biçeminde
vektörle çizilir: tools/burger/ (node tools/burger/uret.mjs). Bu betikten SONRA çalıştırılmalı. Koordinatlar resmin pikselleri (oyunda da sahne birimi bu).
"""
import json, os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter

KOK = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(KOK, 'docs', 'referans', 'mutfak-v3-eymen.png')
OUT = os.path.join(KOK, 'www', 'g', 'v3')
os.makedirs(OUT, exist_ok=True)
IM = np.array(Image.open(SRC).convert('RGB'))
H, W = IM.shape[:2]
MAN = {}   # yerleşim: parçanın sahnedeki dikdörtgeni (oyun.js okur: g/v3/yer.json)


def kaydet(ad, rgba, x, y, q=88):
    """rgba: HxWx4 uint8 dizisi; sahnede (x, y) sol üst köşesine oturur."""
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, ad + '.webp'), 'WEBP', quality=q, method=6)
    MAN[ad] = [int(x), int(y), int(rgba.shape[1]), int(rgba.shape[0])]


def maske_ss(cizim, w, h, k=4, yumusak=0.0):
    """Kenarı yumuşak maske: cizim(draw, k) k kat büyük tuvale çizer."""
    m = Image.new('L', (w * k, h * k), 0)
    cizim(ImageDraw.Draw(m), k)
    m = m.resize((w, h), Image.LANCZOS)
    if yumusak:
        m = m.filter(ImageFilter.GaussianBlur(yumusak))
    return np.array(m)


def kes(x0, y0, x1, y1, a=None):
    rgb = IM[y0:y1, x0:x1].copy()
    if a is None:
        a = np.full(rgb.shape[:2], 255, np.uint8)
    return np.dstack([rgb, a]).astype(np.uint8)


def doygunluk(rgb):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    return hsv[..., 1].astype(float) / 255, hsv[..., 2].astype(float) / 255


# ---------------- boş küvet: yiyecek maskesi içi resmin kendi çeliğiyle doldurulur ----------------
def bos_kuvet(x0, y0, x1, y1, ic, ad):
    """ic: küvetin iç dikdörtgeni (resimde), yuvarlak köşeli. Yiyecek (doygun ya da çok koyu) maskelenir,
    cv2.inpaint ile kenardaki çelikten doldurulur, sonra iç gölge ve hafif ışık eklenir."""
    rgb = IM[y0:y1, x0:x1].copy()
    s, v = doygunluk(rgb)
    yemek = ((s > 0.42) & (v > 0.18)) | (v < 0.16)
    ix0, iy0, ix1, iy1 = [c - o for c, o in zip(ic, (x0, y0, x0, y0))]
    icm = np.zeros(yemek.shape, bool)
    icm[iy0:iy1, ix0:ix1] = True
    yemek &= icm
    yemek = cv2.dilate(yemek.astype(np.uint8) * 255, np.ones((7, 7), np.uint8))
    yemek &= icm.astype(np.uint8) * 255
    dol = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), yemek, 9, cv2.INPAINT_TELEA)
    dol = cv2.cvtColor(dol, cv2.COLOR_BGR2RGB).astype(float)
    # pürüzsüzleştir: inpaint lekeleri kalmasın (yalnız iç alan)
    bl = cv2.GaussianBlur(dol, (0, 0), 7)
    w = cv2.GaussianBlur(icm.astype(float), (0, 0), 4)[..., None]
    w2 = cv2.GaussianBlur((yemek > 0).astype(float), (0, 0), 5)[..., None]
    dol = dol * (1 - w2) + bl * w2
    # iç gölge: dip (alt) ve kenarlar biraz koyu, arka duvar (üst) biraz açık
    hh, ww = dol.shape[:2]
    yy = (np.arange(hh)[:, None] - iy0) / max(1, iy1 - iy0)
    golge = np.clip(1 - np.abs(yy - 0.55) * 0.0, 0, 1)
    kenar = cv2.GaussianBlur((~icm).astype(float), (0, 0), 6)
    dol = dol * (1 - 0.35 * kenar[..., None] * icm[..., None])
    dol = dol * (0.92 + 0.1 * np.clip(1 - yy, 0, 1))[..., None]
    out = rgb.astype(float) * (1 - w) + dol * w
    a = np.clip(w[..., 0] * 255 * 1.0, 0, 255)
    rgba = np.dstack([np.clip(out, 0, 255), a]).astype(np.uint8)
    kaydet(ad, rgba, x0, y0)
    return rgba


def elips_maske(w, h, elipsler, yumusak=0.6):
    def ciz(d, k):
        for (cx, cy, rx, ry) in elipsler:
            d.ellipse([(cx - rx) * k, (cy - ry) * k, (cx + rx) * k, (cy + ry) * k], fill=255)
    return maske_ss(ciz, w, h, yumusak=yumusak)


def kofte():
    # sol yığının en üstteki köftesi: üst yüz + kenar bandı (resimde 1037-1133 x, 357-410 y)
    x0, y0, x1, y1 = 1034, 354, 1136, 412
    el = [(1085 - x0, 380 - y0 + d, 48, 23) for d in range(0, 9)]
    a = elips_maske(x1 - x0, y1 - y0, el)
    pis = kes(x0, y0, x1, y1, a)
    kaydet('kofte', pis, x0, y0)
    # çiğ köfte: aynı biçim, pembe-kırmızı, ızgara izleri silik
    rgb = pis[..., :3].astype(np.uint8)
    yum = cv2.bilateralFilter(cv2.bilateralFilter(rgb, 9, 70, 9), 9, 70, 9)
    hsv = cv2.cvtColor(yum, cv2.COLOR_RGB2HSV).astype(float)
    hsv[..., 0] = (hsv[..., 0] * 0.15 + 176) % 180      # kırmızımsı pembe
    hsv[..., 1] = np.clip(hsv[..., 1] * 0.45 + 50, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * 1.1 + 40, 0, 255)
    cig = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(float)
    # koyu çizgi (kontur) korunur
    _, v = doygunluk(rgb)
    kont = (v < 0.22)[..., None]
    cig = np.where(kont, rgb * 0.9 + np.array([40, 0, 10]) * 0.1, cig)
    # çiğ köfte artık tools/burger/nesne.mjs'te çizilir (ızgara izi olmadan); bu ara sonuç kaydedilmez
    return pis


def kofte_kuveti(pis):
    # 0–5 köfte: boş küvete iki yığın (sağ yığın arkada); 6 = resmin kendisi
    bos = np.array(Image.open(os.path.join(OUT, 'kuvet-kofte-bos.webp')).convert('RGBA'))
    bx, by = MAN['kuvet-kofte-bos'][:2]
    yerler = [(1083, 427, 'L'), (1162, 429, 'R'), (1083, 405, 'L'), (1162, 407, 'R'), (1085, 383, 'L'), (1162, 385, 'R')]
    sp = Image.fromarray(pis, 'RGBA')
    for n in range(0, 6):
        tv = Image.fromarray(bos.copy(), 'RGBA')
        sec = yerler[:n]
        # önce sağ yığın (arkada), alttan üste; sonra sol yığın
        for taraf in ('R', 'L'):
            for (cx, cy, t) in sorted([y for y in sec if y[2] == taraf], key=lambda y: -y[1]):
                golge = Image.new('RGBA', sp.size, (0, 0, 0, 0))
                ga = np.array(sp)[..., 3]
                g = np.zeros((sp.size[1], sp.size[0], 4), np.uint8); g[..., 3] = (ga * 0.35).astype(np.uint8)
                golge = Image.fromarray(g, 'RGBA').filter(ImageFilter.GaussianBlur(3))
                px, py = cx - 51 - bx, cy - 26 - by
                tv.alpha_composite(golge, (px + 2, py + 4))
                tv.alpha_composite(sp, (px, py))
        arr = np.array(tv)
        kaydet('kuvet-kofte-%d' % n, arr, bx, by)


def patates_kuveti():
    # 0–3 porsiyon; 4 = resmin kendisi. Yığın önden-alttan küçülür (resmin kendi patatesleri)
    bos = np.array(Image.open(os.path.join(OUT, 'kuvet-patates-bos.webp')).convert('RGBA')).astype(float)
    bx, by, bw, bh = MAN['kuvet-patates-bos']
    org = IM[by:by + bh, bx:bx + bw].astype(float)
    s, v = doygunluk(IM[by:by + bh, bx:bx + bw])
    yemek = np.clip((s - 0.38) * 6, 0, 1) * np.clip((v - 0.3) * 5, 0, 1)
    for n in range(0, 4):
        if n == 0:
            kaydet('kuvet-patates-0', bos.astype(np.uint8), bx, by); continue
        f = n / 4
        cx, cy = 1338 - bx, 566 - by
        rx, ry = 40 + 62 * f, 28 + 70 * f
        m = elips_maske(bw, bh, [(cx, cy, rx, ry)], yumusak=5) / 255.0
        a = (yemek * m)[..., None]
        out = bos[..., :3] * (1 - a) + org * a
        kaydet('kuvet-patates-%d' % n, np.dstack([out, bos[..., 3]]).astype(np.uint8), bx, by)


def izgara_ac():
    # kilitli ızgara gözleri açılınca: üstteki açık ızgaranın içi, alttaki gözün iç alanına
    ust = IM[338:446, 603:792]
    for ad, (x0, y0, x1, y1) in (('izgara-3', (583, 466, 791, 571)), ('izgara-4', (801, 466, 1009, 571))):
        rgb = IM[y0:y1, x0:x1].copy()
        _, v = doygunluk(rgb)
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        koyu = (hsv[..., 2] < 95).astype(np.uint8)
        # kilidin kendisi de (açık gri) iç alanda: iç alan = koyu bölgenin dolu kabuğu
        cnts, _ = cv2.findContours(koyu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = max(cnts, key=cv2.contourArea)
        ic = np.zeros_like(koyu); cv2.drawContours(ic, [c], -1, 1, -1)
        bx, by, bw, bh = cv2.boundingRect(c)
        yeni = cv2.resize(ust, (bw + 8, bh + 8), interpolation=cv2.INTER_LANCZOS4)[4:4 + bh, 4:4 + bw]
        out = rgb.copy(); out[by:by + bh, bx:bx + bw] = yeni
        a = cv2.GaussianBlur(cv2.erode(ic * 255, np.ones((3, 3), np.uint8)).astype(float), (0, 0), 1.0)
        kaydet(ad, np.dstack([out, a]).astype(np.uint8), x0, y0)


def gosterge_bos():
    # fritöz göstergesi: "0" silinir (ekran rengiyle), rakamlar oyunda çizilir
    x0, y0, x1, y1 = 1557, 522, 1614, 563
    rgb = IM[y0:y1, x0:x1].copy()
    s, v = doygunluk(rgb)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    kirmizi = ((hsv[..., 1] > 90) & ((hsv[..., 0] < 12) | (hsv[..., 0] > 165))).astype(np.uint8) * 255
    kirmizi = cv2.dilate(kirmizi, np.ones((5, 5), np.uint8))
    dol = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), kirmizi, 5, cv2.INPAINT_TELEA)
    dol = cv2.cvtColor(dol, cv2.COLOR_BGR2RGB)
    kaydet('gosterge-bos', np.dstack([dol, np.full(dol.shape[:2], 255, np.uint8)]), x0, y0)


def tablet_bos():
    # sipariş ekranı: yazı satırları silinir (burger simgesi kalır), oyunda sipariş yazılır
    x0, y0, x1, y1 = 34, 615, 226, 782
    rgb = IM[y0:y1, x0:x1].copy()
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    neon = ((hsv[..., 1] > 80) & (hsv[..., 2] > 120) & (hsv[..., 0] < 40)).astype(np.uint8) * 255
    kut = np.zeros_like(neon); kut[638 - y0:726 - y0, 131 - x0:204 - x0] = 1   # yalnız yazı satırları (burger simgesi kalır)
    neon = neon * kut
    neon = cv2.dilate(neon, np.ones((7, 7), np.uint8)) * kut
    dol = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), neon, 7, cv2.INPAINT_TELEA)
    dol = cv2.cvtColor(dol, cv2.COLOR_BGR2RGB)
    a = cv2.GaussianBlur(neon.astype(float), (0, 0), 1.5)
    a = np.clip(a * 2, 0, 255)
    kaydet('tablet-bos', np.dstack([dol, a]).astype(np.uint8), x0, y0)


def patates_tutam():
    # patates haznesindeki çubuklardan bir tutam (porsiyon kutusunun üstü, fritöz sepeti)
    x0, y0, x1, y1 = 1243, 476, 1434, 572
    rgb = IM[y0:y1, x0:x1]
    s, v = doygunluk(rgb)
    a = np.clip((s - 0.38) * 6, 0, 1) * np.clip((v - 0.3) * 5, 0, 1)
    a = cv2.GaussianBlur(a, (0, 0), 0.6)
    a = a * (elips_maske(x1 - x0, y1 - y0, [(95, 50, 84, 42)], yumusak=4) / 255.0)
    kaydet('patates-tutam', np.dstack([rgb, a * 255]).astype(np.uint8), x0, y0)
    return rgb, a


def fritoz_patates(rgb, a):
    # fritözde kızaran patates: sepetin yağ yüzeyine (resimde 1483-1653 x, 357-421 y) çubuklar biraz batmış
    x0, y0, x1, y1 = 1478, 350, 1660, 428
    yag = IM[y0:y1, x0:x1].astype(float)
    tut = cv2.resize(np.dstack([rgb, a * 255]).astype(np.float32), (x1 - x0, int((x1 - x0) * rgb.shape[0] / rgb.shape[1] * 0.72)))
    th = tut.shape[0]
    tv = np.zeros((y1 - y0, x1 - x0, 4), np.float32); oy = (y1 - y0 - th) // 2 + 2
    tv[max(0, oy):oy + th] = tut[max(0, -oy):(y1 - y0) - oy]
    # yalnız yağ yüzeyinin içi (dörtgen)
    def ciz(d, k):
        d.polygon([((1486 - x0) * k, (359 - y0) * k), ((1650 - x0) * k, (359 - y0) * k), ((1662 - x0) * k, (421 - y0) * k), ((1491 - x0) * k, (421 - y0) * k)], fill=255)
    m = maske_ss(ciz, x1 - x0, y1 - y0, yumusak=1.5) / 255.0
    al = tv[..., 3] / 255.0 * m
    for ad, renk, kuvvet, yagda in (('fritoz-pisiyor', (1.0, 0.86, 0.55), 0.55, 0.55), ('fritoz-hazir', (1.08, 0.82, 0.42), 1.0, 0.15)):
        c = tv[..., :3] * np.array(renk)
        # yağın içinde: çubuklar yağın rengine karışır (batmış)
        out = yag * (1 - al[..., None] * (1 - yagda)) + c * al[..., None] * (1 - yagda)
        out = np.clip(out, 0, 255)
        kaydet(ad, np.dstack([out, m * 255]).astype(np.uint8), x0, y0)


def arka_plan(ML=240, MR=240, MT=380, MB=230):
    # resmin kendisi ortada, değişmeden. Kenarlar: resmin son satır/sütunları uzatılır, giderek bulanıklaşır ve
    # kararır (ekran resimden genişse ya da uzunsa görünür; telefonda çoğu çentik payında kalır).
    img = IM.astype(np.float32)
    big = cv2.copyMakeBorder(img, MT, MB, ML, MR, cv2.BORDER_REPLICATE)
    # zemin: resmin en altındaki tahta bandı (son 40 satır) aynalanarak aşağı tekrarlanır
    bant = 40
    for i in range(MB):
        j = i % (2 * bant)
        src = H - 1 - (j if j < bant else 2 * bant - 1 - j)
        big[MT + H + i] = big[MT + src]
    HH, WW = big.shape[:2]
    yy, xx = np.mgrid[0:HH, 0:WW].astype(np.float32)
    dx = np.maximum(ML - xx, xx - (ML + W - 1)).clip(0)
    dy_t = (MT - yy).clip(0); dy_b = (yy - (MT + H - 1)).clip(0)
    uz = np.maximum(dx, np.maximum(dy_t, dy_b))
    bl1 = cv2.GaussianBlur(big, (0, 0), 6); bl2 = cv2.GaussianBlur(big, (0, 0), 22)
    t = np.clip(uz / 60, 0, 1)[..., None]; t2 = np.clip((uz - 60) / 160, 0, 1)[..., None]
    out = big * (1 - t) + bl1 * t; out = out * (1 - t2) + bl2 * t2
    # kararma: tavan koyu sıcak kahve, yanlar ve zemin daha az
    tavan = np.array([30, 16, 12], np.float32)
    k_t = np.clip(dy_t / 90, 0, 1) ** 0.6 * 0.93
    k_y = np.clip(dx / 240, 0, 1) * 0.55
    k_b = np.clip(dy_b / 230, 0, 1) * 0.6
    k = np.maximum(k_t, np.maximum(k_y, k_b))[..., None]
    out = out * (1 - k) + tavan * k
    out[MT:MT + H, ML:ML + W] = img   # resim birebir
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'mutfak.webp'), 'WEBP', quality=92, method=6)
    MAN['mutfak'] = [-ML, -MT, WW, HH]


def menu_arka():
    # ana menü ve dükkân arka planı: resmin kendisi, bulanık, sıcak karartılmış, kenarları daha koyu (yazı ve düğmeler okunsun)
    img = cv2.resize(IM, (1200, int(1200 * H / W)), interpolation=cv2.INTER_AREA).astype(np.float32)
    img = cv2.GaussianBlur(img, (0, 0), 5)
    hh, ww = img.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    d = np.sqrt(((xx - ww * 0.4) / ww) ** 2 + ((yy - hh * 0.55) / hh) ** 2)
    k = (0.62 - np.clip(d - 0.2, 0, 1) * 0.55)[..., None]
    sicak = np.array([60, 26, 10], np.float32)
    out = img * k + sicak * (1 - k) * 0.6
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'menu-arka.webp'), 'WEBP', quality=80, method=6)


if __name__ == '__main__':
    bos_kuvet(1024, 340, 1212, 452, (1031, 346, 1206, 446), 'kuvet-kofte-bos')
    bos_kuvet(1236, 464, 1442, 578, (1243, 470, 1434, 572), 'kuvet-patates-bos')
    p = kofte()
    kofte_kuveti(p)
    patates_kuveti()
    izgara_ac()
    gosterge_bos()
    tablet_bos()
    # eski burger katmanları (ekmek-ust/alt, peynir, tursu) artık kullanılmaz: tools/burger
    r, a = patates_tutam()
    fritoz_patates(r, a)
    # porsiyon (patates kutusu) artık tools/burger/nesne.mjs'te çizilir
    arka_plan()
    menu_arka()
    # ara dosyalar (boş küvet; patates tutamı porsiyon kutusunda kullanıldı ama oyunda da uçuyor) oyuna girmez
    for ad in ('kuvet-kofte-bos', 'kuvet-patates-bos'):
        os.remove(os.path.join(OUT, ad + '.webp')); MAN.pop(ad, None)
    # yerleşim (oyun.js içindeki P sabitiyle aynı olmalı)
    json.dump(MAN, open(os.path.join(os.path.dirname(__file__), 'yer.json'), 'w'), indent=0)
    print(json.dumps(MAN))
