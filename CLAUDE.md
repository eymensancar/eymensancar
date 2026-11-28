# Eymen'in deposu: Claude için kalıcı notlar

Bu dosya her oturumun başında okunur. Sohbet uzayınca eski mesajlar sıkıştırılıp kaybolduğu için Eymen'in kalıcı istekleri burada tutulur. Yeni kalıcı bir istek gelince buraya eklenir.

## Kalıcı istekler (Eymen)

- **Instagram (ve benzeri) videoları (28 Kasım 2026):** Eymen bir reels ya da video linki atıp "izle" ya da "bak" derse izin zaten var; bir daha izin sorulmaz, "yapamıyorum" denmez. Yöntem:
  1. `pip install -q yt-dlp` (yoksa).
  2. `yt-dlp -q -o "reel.%(ext)s" "<link>"` ile video scratchpad'deki bir klasöre indirilir.
  3. `ffmpeg -i reel.mp4 -vf "fps=1/2,scale=360:-1,tile=4x2" kol%d.jpg` ile karelere ayrılır; kareler Read ile resim olarak okunur.
  4. Ses gerekirse `ffmpeg -i reel.mp4 -vn -ac 1 -ar 16000 ses.wav` ile çıkarılır; ekrandaki yazılar karelerden okunur.

  Otomatik izin denetimi ilk denemede engellerse Eymen'in bu kalıcı iznini söyleyip bir kez daha denenir; olmazsa başka araç aranmadan Eymen'e kısa bilgi verilir.
- **"Böyle bir oyunumuz var mı?" sorularında** cevaptan önce şunlara bakılır:
  - bütün artifact'ler (`Artifact` → `list`, gerekirse `read`);
  - bu depodaki klasörler;
  - ekibin öbür depoları (Yıkım Ustası, Fenerli Dedektif, Sayı Yolu, Kedi Yuvası, Toplum Simülasyonu, Arkeolog).

  Bakmadan "yok" denmez.
- **Basit isteklerde "yapamıyorum" demeden önce** araştırılır: GitHub, web, mevcut araçlar. Aynı başarısız yöntem tekrar tekrar denenmez; farklı yol aranır.

## Projeler (bilinenler)

| Proje | Nerede |
|---|---|
| Uçak oyunu: **İstanbul Uçuşu** | Kod `ucak-simulatoru/`, artifact https://claude.ai/artifact/4xfCvbTu7j42HWyyp29dRi. Haritası şu an zayıf (binalar ayırt edilmiyor, çok yerde boşluk); düzeltilmesi sonraya bırakıldı (Eymen, 28 Kasım). |
| Toplum Simülasyonu (ana menü ve NPC yapay zekâsı) | `toplum-simulasyonu/`, artifact https://claude.ai/artifact/EG64D5NXMPFWpfQe4LjrEF. Yapay zekâ ayrıca amcanın deposuna (`SunStroke5634/toplumsimulasyonu`) yalnız `yapay-zeka/` klasörüne gönderilir (`toplum-simulasyonu/esitle-toplum.sh`). |
| Öbür klasörler | `burger-ustasi/`, `mutfak-ustasi/`, `sehir/`, `temiz-sehir/`, `two-beeps/`, `sancargames-site/`. |
