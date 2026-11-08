# sancargames.com

Sitenin kaynağı. Yayın: Cloudflare Pages (`sancargames-site` projesi), domain sancargames.com.

- `python3 build.py` → `site/` içindeki sayfaları yeniden üretir (Türkçe kökte, İngilizce `en/` altında). Metinler build.py içinde.
- `site/assets/` stil ve görseller, `site/app-ads.txt` AdMob yayıncı satırı.
- Yayınlamak: `site` klasörünü `sancargames` adıyla kopyala, Cloudflare → Workers & Pages → sancargames-site → Create deployment → klasörü yükle.

## Yazı tipi (Archivo) ve İ harfi
Archivo'nun kendi İ harfi dar genişlikte bozuk (gövdesi ince, yanlarında boşluk). `assets/archivo-tr.woff2` düzeltilmiş hâli: İ, I harfinin üstüne nokta konarak yeniden kuruldu. Yeniden üretmek için:

```
python3 tools/fix-idot.py "Archivo[wdth,wght].ttf" fixed.ttf
pyftsubset fixed.ttf --text-file=tools/font-chars.txt --layout-features='*' --flavor=woff2 --output-file=site/assets/archivo-tr.woff2
```
Sitede yeni harf kullanılırsa `tools/font-chars.txt` dosyasına eklenir.
