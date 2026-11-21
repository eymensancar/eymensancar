"""Kırpmalardan pano (kontrol için): python3 tools/burger/pano.py <klasör> <çıktı.jpg> [desen ...] [--gen 1600]"""
import sys, glob, os
from PIL import Image, ImageDraw
args = [a for a in sys.argv[1:] if not a.startswith('--')]
gen = int(sys.argv[sys.argv.index('--gen') + 1]) if '--gen' in sys.argv else 1600
if '--gen' in sys.argv: args.remove(str(gen))
klasor, cikti, desen = args[0], args[1], args[2:] or ['*']
dosyalar = []
for d in desen: dosyalar += sorted(glob.glob(os.path.join(klasor, d + '.jpg')))
ims = [(os.path.basename(f)[:-4], Image.open(f).convert('RGB')) for f in dosyalar]
sat, x, y, h = [], 0, 0, 0
yer = []
for ad, im in ims:
    s = min(1, (gen - 8) / im.width, 420 / im.height)
    im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))))
    if x + im.width > gen: x = 0; y += h + 22; h = 0
    yer.append((ad, im, x, y)); x += im.width + 8; h = max(h, im.height)
P = Image.new('RGB', (gen, y + h + 22), (40, 30, 25))
d = ImageDraw.Draw(P)
for ad, im, x, y in yer:
    P.paste(im, (x, y + 18)); d.text((x + 2, y + 3), ad, fill=(255, 230, 180))
P.save(cikti, quality=85)
