# sancargames.com

Sitenin kaynağı. Yayın: Cloudflare Pages (`sancargames-site` projesi), domain sancargames.com.

- `python3 build.py` → `site/` içindeki sayfaları yeniden üretir (Türkçe kökte, İngilizce `en/` altında). Metinler build.py içinde.
- `site/assets/` stil ve görseller, `site/app-ads.txt` AdMob yayıncı satırı.
- Yayınlamak: `site` klasörünü `sancargames` adıyla kopyala, Cloudflare → Workers & Pages → sancargames-site → Create deployment → klasörü yükle.
