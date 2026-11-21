"""Önce/sonra karşılaştırması: iki inceleme klasöründeki (scripts/inceleme.cjs) aynı adlı kırpmaları yan yana koyar.

    python3 tools/burger/karsilastir.py <önce klasörü> <sonra klasörü> <çıktı klasörü>

Her kırpma için <çıktı>/oncesonra-<ad>.jpg (solda ÖNCE, sağda SONRA; JPEG, en çok 1600 px genişlik)."""
import sys, os
from PIL import Image, ImageDraw
once, sonra, cikti = sys.argv[1:4]
os.makedirs(cikti, exist_ok=True)
SECIM = ['01-ana-menu', '02-dukkan', '03-gun-basi', '04-mutfak', '05-ust-sol-rozetler', '05b-ust-sag-rozetler', '07-musteri-balon',
         '08-tahta-tepsiler-bos', '09-ipucu', '10-burger-2-kofte', '10-burger-3-peynir', '10-burger-4-tursu', '10-burger-5-tamam',
         '11-izgara-cig', '11-izgara-yarim', '12-burger-secili', '14-tepsi-dolu', '15-dograma', '23-musteriler', '24-gun-sonu']
for ad in SECIM:
    a, b = os.path.join(once, ad + '.jpg'), os.path.join(sonra, ad + '.jpg')
    if not (os.path.exists(a) and os.path.exists(b)): continue
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    s = min(1, 790 / A.width, 900 / A.height)
    A = A.resize((int(A.width * s), int(A.height * s)), Image.LANCZOS); B = B.resize(A.size, Image.LANCZOS)
    P = Image.new('RGB', (A.width * 2 + 30, A.height + 34), (40, 28, 22))
    P.paste(A, (10, 30)); P.paste(B, (A.width + 20, 30))
    d = ImageDraw.Draw(P); d.text((14, 8), 'ONCE: ' + ad, fill=(255, 210, 170)); d.text((A.width + 24, 8), 'SONRA', fill=(150, 255, 160))
    P.save(os.path.join(cikti, 'oncesonra-' + ad + '.jpg'), quality=82)
print('tamam')
