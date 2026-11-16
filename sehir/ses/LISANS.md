# Sesler: kaynak ve lisans

Bütün sesler gerçek kayıttır; sentez ses, müzik ve hava/süpürme (whoosh) sesi yoktur. Hepsi kamu malıdır (CC0 ya da Public Domain Mark): atıf zorunlu değildir, ticari kullanım ve yeniden dağıtım serbesttir. Lisans her kaynağın kendi sayfasında 16 Kasım 2026'da görülmüştür.

| Kaynak | Yapan | Lisans |
|---|---|---|
| BigSoundBank (bigsoundbank.com), her sesin sayfasında "License CC0 (public domain)" | Joseph SARDIN | CC0 1.0 |
| Internet Archive, "Various Walking Sounds D.D.Teoli Jr." | D.D.Teoli Jr. | Public Domain Mark 1.0 |

## Dosyalar

| Dosya | Ne | Kaynak kayıt | Lisans |
|---|---|---|---|
| `asfalt_yuru1…6.mp3` | asfaltta yürüme, tek adım | "Walking on asphalt 8", D.D.Teoli Jr. https://archive.org/details/walking-on-asphalt-8-d.-d.-teoli-jr. (kayıttaki 7,70 / 8,80 / 12,18 / 22,30 / 25,72 / 26,99. sn) | Public Domain Mark 1.0 |
| `asfalt_kos1…5.mp3` | sert zeminde spor ayakkabıyla koşu, tek adım (kayıt betonda yapılmış; asfalt koşusu için kullanılıyor) | "Footsteps, Shoe on Concrete" (no 514), Joseph SARDIN https://bigsoundbank.com/footsteps-shoe-on-concrete-s0514.html (0,73 / 1,79 / 4,97 / 7,13 / 9,38. sn) | CC0 |
| `kaldirim_yuru1…6.mp3` | betonda yürüme, tek adım | "Fast Steps on Concrete" (no 1318), Joseph SARDIN https://bigsoundbank.com/fast-steps-on-concrete-s1318.html (16,91 / 21,64 / 26,24 / 36,58 / 45,14 / 58,84. sn) | CC0 |
| `kaldirim_kos1…5.mp3` | betonda koşu, tek adım | "Fast Steps on Concrete" (no 1319, "Running on concrete"), Joseph SARDIN https://bigsoundbank.com/fast-steps-on-concrete-s1319.html (15,05 / 18,24 / 19,40 / 22,56 / 37,10. sn) | CC0 |
| `cim_yuru1…5.mp3` | çimde yavaş adım | "Steps in the Grass, Slow" (no 1253), Joseph SARDIN https://bigsoundbank.com/steps-in-the-grass-slow-s1253.html (4,06 / 7,02 / 14,57 / 17,55 / 22,60. sn) | CC0 |
| `cim_kos1…6.mp3` | çimde hızlı adım | "Steps in the grass, quick" (no 1254), Joseph SARDIN https://bigsoundbank.com/steps-in-the-grass-quick-s1254.html (4,41 / 12,47 / 14,07 / 18,24 / 22,09 / 25,64. sn) | CC0 |
| `zipla_sert1.mp3`, `in_sert1.mp3` | betonda çift ayak sıçrama: kalkış anı (ayakkabının itişi + giysi) ve iniş vuruşu | "Jumping on concrete #1" (no 1835), Joseph SARDIN https://bigsoundbank.com/jumping-on-concrete-1-s1835.html | CC0 |
| `zipla_sert2.mp3`, `in_sert2.mp3` | aynısı, ikinci kayıt | "Jumping on Concrete #2" (no 1836) https://bigsoundbank.com/jumping-on-concrete-2-s1836.html | CC0 |
| `zipla_cim1.mp3`, `in_cim1.mp3` | çimde çift ayak sıçrama: kalkış ve iniş | "Jumping on Grass #1" (no 1839) https://bigsoundbank.com/jumping-on-grass-1-s1839.html | CC0 |
| `zipla_cim2.mp3`, `in_cim2.mp3` | aynısı, ikinci kayıt | "Jumping on grass #2" (no 1840) https://bigsoundbank.com/jumping-on-grass-2-s1840.html | CC0 |
| `ortam_sehir.mp3` | sakin şehir uğultusu (uzak yol sesi, gece) | "Night after rain" (no 621), Joseph SARDIN https://bigsoundbank.com/night-after-rain-s0621.html (12–48. sn) | CC0 |
| `ortam_park.mp3` | şehirde bahçe tarafı kuşları (karatavuk, çalıkuşu, ötleğen) | "Birds in the City #1" (no 3575), Joseph SARDIN https://bigsoundbank.com/birds-in-the-city-1-s3575.html (42,5–78,5. sn) | CC0 |

## Yapılan işlem

- **Adımlar:** kaynak kayda hafif gürültü azaltma (tayf kapısı, en çok 10 dB), 70 Hz altı kesildi (çimde 120 Hz altı ve 6,5 kHz üstü). Tek adımlar vuruşun 3 ms öncesinden kırpıldı (çimde hışırtının en gür yerinden 120 ms önce), sonu kısıldı, tek kanala indirildi, 44,1 kHz. Hepsi aynı gürlüğe getirildi (en gür 100 ms'lik bölümün ortalaması −24 dBFS; tepe en çok −3 dBFS).
- **Zıplama/iniş:** her sıçrama kaydı ikiye bölündü. Kalkış: inişten önceki 0,28 sn (5,5 kHz üstü kesildi, 17–29 dB yükseltildi: kayıtta çok kısık). İniş: vuruştan başlayan 0,42 sn.
- **Ortam:** 36 sn'lik bölüm kırpıldı, stereo. Şehir: 45 Hz altı ve 5,5 kHz üstü kesildi (kayıt cihazı hışırtısı), −26 LUFS. Kuşlar: 6 kHz üstü 4 dB kısıldı, −29 LUFS. Dikişsiz döngü dosyada değil kodda yapılır (`ses.js` → `donguYap`).
- **Biçim:** MP3 (LAME), adımlar tek kanal 112 kb/sn, ortam stereo 96 kb/sn. Toplam 43 dosya, 1,08 MB.
