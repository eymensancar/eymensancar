# Dış kaynaklar ve lisansları

Her dış dosya buraya kaynağı ve lisansıyla yazılır.

## Fontlar (`assets/fonts/`)

Demolition Master oyunundaki dosyaların birebir kopyası (`clauderepo/www/fonts/`, orada `@fontsource` paketlerinden alınmış; `www/fonts.css` başlığı: "SIL Open Font License 1.1"). Marka bağı için oyunla aynı fontlar.

| Dosya | Font | Telif | Lisans |
|---|---|---|---|
| `lilita-one-latin-400-normal.woff2`, `lilita-one-latin-ext-400-normal.woff2` | Lilita One | © 2011 Juan Montoreano | SIL OFL 1.1 |
| `rubik-latin-500-normal.woff2`, `rubik-latin-700-normal.woff2`, `rubik-latin-ext-500-normal.woff2`, `rubik-latin-ext-700-normal.woff2` | Rubik | © 2015 The Rubik Project Authors | SIL OFL 1.1 |

OFL 1.1 ticari kullanıma, videoya gömmeye ve dağıtmaya izin verir; fontun kendisi tek başına satılamaz. Lisans metni: https://openfontlicense.org/open-font-license-official-text/

Not: Lilita One'da Ş ş Ğ ğ İ yok (oyunda ayrı `lilita-one-turkish` dosyasıyla tamamlanıyor). Dizi İngilizce olduğu için kopyalanmadı; Türkçe başlık gerekirse Rubik kullanılır.

## Sesler (`assets/sfx/`)

`assets/sfx/` altındaki bütün efektler ve iki bip `src/sfx_uret.py` ile sentezlendi (dış kaynak yok), tek istisna ortam sesi:

| Dosya | Kaynak | Yazar | Lisans |
|---|---|---|---|
| `sfx/kaynak/park_ambience_birds_138-162s.wav` (`park_ambience_birds.wav` dosyasının 138–162. saniyesi) | https://opengameart.org/content/park-ambiences | Thimras | CC0 1.0 |
| `sfx/kaynak/park_ambience_wind_40-64s.wav` (`park_ambience_wind.wav` dosyasının 40–64. saniyesi) | https://opengameart.org/content/park-ambiences | Thimras | CC0 1.0 |

Bu iki kesitten `sfx/ortam-bos-arsa-dongu.wav` üretildi (filtre + karışım + döngü). CC0: atıf zorunlu değil, ticari kullanım serbest. Lisans: https://creativecommons.org/publicdomain/zero/1.0/

### Freesound'dan (Eymen buldu, 15 Kasım 2026; dördünün de sayfasında lisans "Creative Commons 0" yazıyor, Eymen doğruladı)

Sesler Freesound'un önizlemesinden ekran kaydıyla alındı ve kırpıldı. CC0: atıf zorunlu değil, ticari kullanım serbest.

| Dosya | Freesound'daki adı | Yükleyen | Lisans |
|---|---|---|---|
| `sfx/kaynak/fs-dizel-rolanti.wav` | G45-19-Submarine Motor Topside.wav | craigsmith | CC0 1.0 |
| `sfx/kaynak/fs-tugla-dusme.wav` | Bricks Falling 2.wav | Benboncan | CC0 1.0 |
| `sfx/kaynak/fs-kagit-hisirti.wav` | paper_rustling_03 | Spaghetto87 | CC0 1.0 |
| `sfx/kaynak/fs-kalem-karalama.wav` | Pen Strokes and Scribbling (Compilation) | Sheyvan | CC0 1.0 |

### OpenGameArt'tan adım sesleri (15 Kasım 2026)

| Dosya | Kaynak | Yazar | Lisans |
|---|---|---|---|
| `sfx/kaynak/fantozzi/Fantozzi-SandL1…R3.wav`, `Fantozzi-StoneL1…R3.wav` (12 dosya; `Fantozzi-footsteps.7z` içindeki FLAC'lardan 48 kHz WAV'a çevrildi) | https://opengameart.org/content/fantozzis-footsteps-grasssand-stone (asıl: https://freesound.org/people/Fantozzi/packs/10338/) | Fantozzi | CC0 1.0 |

Bunlardan `adim-toprak-*.wav` (Sand), `adim-cakil-*.wav` (Stone), `araba-kalkis.wav` ve `tas-kaldirma.wav` içindeki çakıl/toprak katmanları üretildi. `fs-dizel-rolanti.wav` → `daisy-motor-hareket`, `daisy-durus`, `daisy-son-kaldiris`; `fs-kagit-hisirti.wav` → `zarf-cekme`, `mektup-acma`, `kagit-*`, `takvim-*`, `liste-cebe`, `posta-zarf-dusme`; `fs-kalem-karalama.wav` → `kalem-satir`; park kuş kesiti → `sehir-uzak-dongu`.
