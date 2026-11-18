# Two Beeps: ses dili

Hepsi `assets/sfx/`, 48 kHz / 24 bit WAV, gerçek tepe ≤ −3 dBFS (çoğu −3,5), başı/sonu sessiz. Yeniden üretmek için `python3 src/sfx_uret.py` (aynı tohum, aynı dosya; `--yalniz-yeni` yalnız 2–10. bölüm kitaplığını üretir). Gerçek kayıtlar (CC0) `assets/sfx/kaynak/` altında, kaynakları `assets/LICENSES.md` içinde.

**Kalıcı kural (Eymen):** whoosh/swoosh, hava/hışırtı, fırça/silme gibi filtreli gürültü süpürmesi yok. Pilotta bu yüzden şunlar kullanılmıyor: `baca-devrilme.wav` 1,9–2,75 sn ve 3,4 sn sonrası, `oyun-yikim.wav` 0,1–0,9 sn, `damga-kesif.wav` 0–0,3 sn, `halat-gerilme.wav` tamamı. 2–10. bölüm sesleri tonlu gövdeyle kuruldu; gürültü yalnız ≤10 ms'lik vuruş başlangıcında ya da gerçek kayıt kesitinde (kâğıt, kalem, adım, dizel) var. Spektral düzlükle denetlendi: yeni sentez seslerde süpürme yok.

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
| Müzik | sabit seviye (Eymen: konuşmaya göre kısılmaz); yalnız sahne düzeyindeki sessiz anlarda solar |
| Ortam (`ortam`, `rolanti`) | −32 LUFS; rölanti anlatıcı altında −34 |
| Efektler (kâğıt, kalem, kol, halat) | −24 LUFS |
| Darbe, baca | tepe −6 dBFS, yalnız anlatıcı boşluğunda |
| İki bip | −18 LUFS, hiçbir şey kısılmaz, üstüne müzik çalmaz |

Kısma (ducking) kapalı (Eymen kararı). Darbe anlatıcıyla çakışırsa darbe kaydırılır. Döngülerin başına/sonuna kurguda 50 ms solma koy.

## İki bip kuralı

1. Bip yalnız Daisy'nin sesidir. Başka hiçbir yerde (geçiş, logo, bildirim) kullanılmaz; perdesi değiştirilmez, kesilmez, hızlandırılmaz.
2. Hikâyede her zaman iki bip. Tek istisna yönetmen kararı: bölüm sonundaki işaret `daisy-beep-tek.wav` (bilerek tek). Üç bip yok.
3. Bipten önce 0,3 sn ve sonra 0,5 sn içinde müzik ve başka efekt yok (ortam kalabilir). İzleyici onu tek başına duymalı.
4. Anlatıcı "beeped twice" dediğinde bip cümleden hemen önce (ya da "beeped" ile "Twice" arasında) duyulur; anlatıcının üstüne binmez.
5. Görselde Daisy'nin uyarı lambası her biple bir kez, toplam iki kez yanar.
6. `daisy-beep-soft.wav` yalnız 10. bölümde, veda anında bir kez çalar. Hatıralar (gri/sepya geri dönüşler) `daisy-beep-hatira.wav` ile; 9. bölümde "Daisy stayed silent" anında bip yok.
7. Açılış/bitiş kartına bip konmaz.

## 2–10. bölüm kitaplığı

Cue adları animatörlerin `TB.cuesA`/`TB.cuesB` adlarıdır (P2 = Part 2). Dosya başı = cue anı, tabloda başka bir an yazmıyorsa.

| Dosya | Süre | Cue / bölüm |
|---|---|---|
| `daisy-beep-tek.wav` | 1,4 | her bölümün `sonBip`/`endBeep`'i (ton 0,04–0,24 sn; `daisy-beep.wav`'ın ilk tonuyla aynı) |
| `daisy-beep-hatira.wav` | 4,2 | P4 `hatiraBip`, `kapiHatiraBip`; P10 hatıralar (alçak geçiren, yankılı) |
| `daisy-motor-hareket.wav` | 3,0 | P2 `daisyMotor`, P3 `daisyMotor` (gerçek dizel, hızlanır; vites 0,32 sn) |
| `daisy-durus.wav` | 2,6 | P2 `daisyDurus` |
| `daisy-son-kaldiris.wav` | 7,0 | P10 "last lift" (yüklenme, hidrolik, tambur tıkları, yük 5,75 sn'de oturur) |
| `daisy-siperlik-iner.wav` / `-kalkar.wav` | 0,9 | P2 `daisySiperlikIner`/`Kalkar`, P3 `daisyLid` |
| `kanca-zincir.wav` | 2,0 | P2 `kancaGicirti` |
| `kapi-kolu-kilitli-1.wav` / `-2.wav` | 1,1 | P2 `kilitTakirti1`/`2` |
| `kapi-gicirti.wav` | 1,5 | P4 `kapiGicirti`, P10 ofis |
| `kapi-kapanis.wav` | 1,5 | P7 koridor kapısı |
| `posta-kapagi.wav` | 1,3 | P2 `postaKapagi` (klank 0,27 sn) |
| `posta-zarf-dusme.wav` | 0,7 | P3 `postaKutusu` |
| `adim-toprak-tek.wav` / `-4.wav` | 0,6 / 1,9 | P2 `defneAdim`, `adim`, `adimlarOfis` (dizi 0,44 sn arayla) |
| `adim-cakil-tek.wav` / `-4.wav` | 0,6 / 2,1 | P3 `haleStep`, `ekipAdim` (dizi 0,5 sn arayla) |
| `adim-tahta-tek.wav` / `-2.wav` | 1,0 / 1,1 | P4 `adim1` (+`adim2` 0,5 sn sonra) |
| `zarf-cekme.wav` | 0,6 | P2 `kagitZarf`, P3 `mektupCekme` |
| `mektup-acma.wav` | 0,9 | P2 `kagitMektup`, P5 defter, P10 not |
| `kagit-masaya.wav` | 0,3 | P6 zarf masaya |
| `kagit-rulo.wav` | 0,8 | P4 `kagitRulo` |
| `takvim-kavra.wav` / `takvim-oturma.wav` | 0,4 | P4 `takvimTut` / `takvimKay` |
| `liste-cebe.wav` | 0,4 | P3 `paperPocket` |
| `kalem-satir.wav` | 0,8 | P3 `kalemSatir`, P9 satır çizme (gerçek kalem; hafif kullan) |
| `kalem-tink.wav` | 0,6 | P9 mavi mürekkep (miks.py `@tink` ile aynı) |
| `parmak-dokunus.wav` | 0,3 | P3 `fingerTap`, P4 `parmakDokunus` |
| `kumas-pat.wav` / `-2.wav` | 0,4 / 0,6 | P3 `pat1` (+`pat2` 0,25 sn sonra) |
| `telefon-cebe.wav` | 0,5 | P2 `telefonCep` |
| `sapka-cikarma.wav` | 0,6 | P8 şapka dizine, P9 şapka |
| `para-fit.wav` / `para-sayma-7.wav` | 0,2 / 1,4 | P3 `billCount` (dizi 0,2 sn arayla, ilk fıt 0,005 sn) |
| `araba-yaklasma-durma.wav` | 3,9 | P3 araba gelişi (durma 2,4 sn) |
| `araba-yaylanma.wav` | 1,2 | P3 `carSettle` |
| `araba-kapi-acma.wav` / `-kapanis.wav` | 1,2 | P3 `doorOpen` / `arabaKapi` |
| `araba-kalkis.wav` | 5,1 | P3 `arabaKalkis` |
| `lastik-yuvarlanma.wav` / `lastik-oturma.wav` | 2,2 / 1,5 | P3 `tireRoll` / `tireStop` |
| `telefon-dokunus.wav` | 0,2 | P4 `dokunus1-3`, `dokunusBina`, `telefonaUzanma`; P5–P6 oyun |
| `fener-tik.wav` | 0,3 | P4 `fenerAcilir` |
| `lamba-dugme.wav` | 0,3 | P4 `lambaTik`, P9 lamba |
| `kart-klips.wav` | 0,3 | P2 `kartSallanma` |
| `tutam-boing.wav` | 0,5 | P2 `tutamFiske` |
| `karton-bardak.wav` | 0,4 | P2 `kahveVer`, P6 kahve/patates masaya |
| `cay-bardagi.wav` | 1,2 | P4 soğuk çay |
| `sandalye.wav`, `masa-koyma.wav`, `kutu-koyma.wav` | 1,5 / 1,4 / 1,0 | P7 masa avluya, P8 salon, P10 kutular |
| `oyun-timesup.wav`, `oyun-demolished.wav`, `oyun-kart.wav`, `oyun-kepenk.wav` | 0,3–0,8 | P3 `gameDemolished`, `gameCard`; P4 `timesUp`, `demolished`, `oyunKepenk` (oyunun kendi tınısı) |
| `su-kulesi-darbe.wav` | 3,3 | P3 `topDarbe` |
| `kule-egilme.wav` | 2,0 | P3 `kuleDusus` (tonlu metal inleme) |
| `su-kulesi-yere.wav` | 4,0 | P3 `kuleYereCarpma` |
| `beton-parcalari.wav` | 2,0 | P3 sonrası, P7 yıkımları |
| `siva-catlak.wav` | 0,9 | P4 `catlakCitirti` |
| `tas-kaldirma.wav`, `teneke-kapak.wav` | 1,5 / 2,0 | P2 `tasKalkar`; P10 taş ve teneke |
| `duduk-uzak.wav` | 2,2 | P3 ekip, P9 tahliye (tek kısa) |
| `kule-inis.wav` | 12,5 | P9 40 kat iner (son oturma 6,7 sn) |
| `sehir-uzak-dongu.wav` | 20, döngü, stereo | P9 tahliye |
| `yagmur-kabin-dongu.wav` | 12, döngü | P6 kabin (tonlu damlalar) |
| `kabin-cami-damla.wav` | 0,4 | P6 cama damla |
| `oda-tonu-dongu.wav` | 10, döngü | P8 bekleme salonu |
| `numarator-ding.wav` | 2,8 | P8 numara |
| `saat-tiktak-dongu.wav` | 4, döngü | P7 sınav, P8 bekleme |

Bilerek ses yok: P3 `tozSilme`, `ufleme` ve P4 `parmakKagit` (sürtünme/üfleme gürültüsü kuralı); P3 `landSweep` sessiz.
