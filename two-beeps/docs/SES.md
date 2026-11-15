# Two Beeps: ses dili

Hepsi `assets/sfx/`, 48 kHz / 24 bit WAV, gerçek tepe ≤ −3,5 dBFS. Yeniden üretmek için `python3 src/sfx_uret.py` (aynı tohum, aynı dosya). Ortam sesi dışında hepsi sentez; kaynaklar `assets/LICENSES.md` içinde.

## Dosyalar (1. bölüm)

| Dosya | Süre | Nerede |
|---|---|---|
| `daisy-beep.wav` | 1,4 sn | "Daisy beeped. Twice." ve dizideki her iki bip |
| `daisy-beep-soft.wav` | 2,4 sn | 10. bölüm, veda ("she beeped. Twice.") |
| `kagit-hisirti.wav` | 1,8 sn | Listenin açılışı ("a list with one line") |
| `kalem-karalama.wav` | 2,0 sn | "The tenth is scratched out" |
| `dizel-calistirma.wav` | 6,0 sn | Daisy'nin ilk görünüşü ("she hates mornings": marş öksürür, sonra tutar) |
| `dizel-rolanti-dongu.wav` | 6,0 sn, döngü | Daisy ekrandayken alt katman |
| `kol-cekme.wav` | 1,4 sn | "I pulled the lever" (klonk 0,44 sn'de) |
| `halat-gerilme.wav` | 3,3 sn | Top geri çekilirken, kol ile bip arası |
| `top-darbe.wav` | 2,6 sn | Top bacaya çarpar |
| `tugla-catirti.wav` | 3,1 sn | Çarpma sonrası ve "In the bricks I found" |
| `baca-devrilme.wav` | 9,9 sn | "fell the wrong way": çatlama 0–1,3, eğilme, yere çarpma 2,75 sn, toz 9 sn'ye kadar |
| `ortam-bos-arsa-dongu.wav` | 20 sn, döngü, stereo | Boş arsa; yıkım sonrası sessizlik |
| `damga-kesif.wav` | 3,3 sn | Taşta "H and K" damgası (zil Daisy'nin perdesinde: G#5 + D#6) |
| `oyun-yikim.wav` | 1,6 sn | Telefonda Demolition Master sahnesi (oyunun kendi WebAudio tınısı: blip, boom, kasa sesi) |

Adaylar: `adaylar/daisy-beep-a-geri-vites.wav` (modern, sert), `-b-eski-korna.wav` (seçilen), `-c-iki-ses.wav` (kamyon kornası). B seçildi: 830 Hz, sıcak ama telefonda net; hafif "cırp" ve röle tıkı eski makine kişiliği veriyor.

## Karışım

Anlatıcı her zaman önde. Bölüm sonu −14 LUFS (YouTube), gerçek tepe −1 dBTP.

| Katman | Seviye |
|---|---|
| Anlatıcı | −16 LUFS (kısa dönem), sabit |
| Müzik | anlatıcı konuşurken −30 LUFS, susunca −22 LUFS |
| Ortam (`ortam`, `rolanti`) | −32 LUFS; rölanti anlatıcı altında −34 |
| Efektler (kâğıt, kalem, kol, halat) | −24 LUFS |
| Darbe, baca | tepe −6 dBFS, yalnız anlatıcı boşluğunda |
| İki bip | −18 LUFS, hiçbir şey kısılmaz, üstüne müzik çalmaz |

Kısma (ducking): anlatıcı konuşurken müzik −8 dB, ortam/rölanti −4 dB, efektler −3 dB; atak 80 ms, bırakma 400 ms (sidechain anlatıcı kaydı). Darbe anlatıcıyla çakışırsa darbe kaydırılır. Döngülerin başına/sonuna kurguda 50 ms solma koy.

## İki bip kuralı

1. Bip yalnız Daisy'nin sesidir. Başka hiçbir yerde (geçiş, logo, bildirim) kullanılmaz; perdesi değiştirilmez, kesilmez, hızlandırılmaz.
2. Her zaman iki bip; tek bip ya da üç bip yok.
3. Bipten önce 0,3 sn ve sonra 0,5 sn içinde müzik ve başka efekt yok (ortam kalabilir). İzleyici onu tek başına duymalı.
4. Anlatıcı "beeped twice" dediğinde bip cümleden hemen önce (ya da "beeped" ile "Twice" arasında) duyulur; anlatıcının üstüne binmez.
5. Görselde Daisy'nin uyarı lambası her biple bir kez, toplam iki kez yanar.
6. `daisy-beep-soft.wav` yalnız 10. bölümde, veda anında bir kez çalar. Önceki bölümlerde kullanılmaz.
7. Açılış/bitiş kartına bip konmaz.
