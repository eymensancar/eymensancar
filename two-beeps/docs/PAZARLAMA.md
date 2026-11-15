# Two Beeps — dizi paketi (pilotta kurulur, 10 bölümde aynen kullanılır)

Bütün ölçüler 1080×1920 içindir. **Güvenli alan:** üst 220 px (arama/kamera simgeleri), alt 480 px (başlık, kanal adı, ses şeridi), sağ 190 px, y 1000–1750 arası (beğen/yorum/paylaş sütunu), sol 60 px boş kalır. Okunması gereken her yazı **x 60–890, y 220–1440** içinde durur.

## 1. Açılış (0–2 sn)

- **İlk kare boş kalmaz:** 0,0 sn'de hem görüntü hem ses var. Kanca cümlesi hemen başlar ("Grandpa left me three things."). Logo, giriş müziği yok.
- **Bölüm etiketi:** sol üstte, x 60, y 240, yükseklik 64 px, sarı (Daisy rengi) şerit, siyah yazı: `PART 1 · THE CHIMNEY`. 0,0–2,5 sn görünür, sonra 0,3 sn'de küçülerek köşede `1/10` rozetine döner (48 px) ve bölüm sonuna kadar orada kalır.
- **Dizi adı:** etiketin hemen altında 52 px, `TWO BEEPS`, kalın mürekkep konturlu, aynı 2,5 sn.
- **Kanca yazıyla da gösterilir:** ilk cümle, altyazıdan farklı olarak ekranın ortasında (y 690–910) büyük (110 px) **0. karede tam görünür**; okunan kelime sesle birlikte sarıya döner. Sessiz izleyen de kancayı ilk karede yakalar. Bu bantta karakter başı yok (baş üstü y ≥ 960).

## 2. Altyazı

- **Var, her bölümde.** Shorts'un çoğu sessiz başlar.
- **Biçim:** satır satır, en çok 2 satır, satır başına en çok 4 kelime; okunan kelime sarıya döner (karaoke).
- **Yer ve ölçü:** orta hizalı, satır merkezi y 1300, kutu y 1200–1420, x 90–870. Yazı tipi 72 px, kalın, beyaz, 8 px siyah kontur.

## 3. Bölüm sonu ve oyunla bağ

- **Son cümle hikâyenindir.** "Like she knew." sonrası Daisy'nin **iki bip'i** duyulur, ekran 0,3 sn sarıya yanıp söner. Bu ses her bölümün imzasıdır.
- **Bitiş kartı (`cues.endCard` = voiceEnd + 1,6 sn'den sona, ≈2,7 sn; sessiz anlatıcı):** tek yarı saydam koyu kart, x 60–890, y 752–1400, altında tehlike şeridi. Sahne kararmaz; Daisy'nin uyarı ışığı üst üçte birde açıkta kalır. Giriş 6 kare, sonra sabit.
  - `PART 2 · THE ANT →` (90 px, "THE ANT" ve ok sarı)
  - `Follow · Part 2 is next` (56 px)
  - oyun simgesi 128×128 (köşedeki simge uçup büyür) + `Search "Demolition Master: Tower Blast"` (≤52 px) + küçük `iPhone · free` (38 px, sarı)
- **Döngü:** kartın son karesi açılış karesine yumuşak bağlanır; Tekrar oynatmada iki bip'ten kancaya akış kesilmez.
- **Sabit marka öğesi: var.** Oyunun gerçek simgesi (`/home/user/clauderepo/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`), sağ üst köşe x 826–890, y 236–300 (64×64; sağ güvenli alanın içinde), köşeleri yuvarlatılmış, %70 opaklık. **3. saniyeden** itibaren görünür (ilk 3 saniye hikâyenindir), bitiş kartında büyük simgeye dönüşür. Yazısız: bağırmaz ama hep orada.
- **Oyun görüntüsü:** hikâyede oyun geçen satırda (1. bölümde "forty towers in Demolition Master") Kaan'ın telefonunda 2 sn gerçek oyun kaydı; senaryo dışına oyun sahnesi eklenmez.

## 4. "Önceki bölümde" (2–10. bölümler)

- **Ek süre yok, sesle okunmaz.** 0,0–2,5 sn, bölüm etiketinin altında (y 330) tek satır, 44 px, beyaz üstüne %60 siyah zemin: `Previously: The chimney fell the wrong way.` En çok 7 kelime, önceki bölümün son düğümünü söyler.
- Aynı anda kanca cümlesi sesle başlar

## 5. Yayın metinleri (1. bölüm)

**Başlık adayları:**
1. `My crane beeped twice. I ignored her. (Part 1)`
2. `Grandpa left me a crane, a debt and a secret list`
3. **`Grandpa left me a list. Line 10 is scratched out. (Part 1)`** ← seçilen: soru doğurur, dizi olduğunu söyler.

**Açıklama:**
```
Grandpa left me a crane, a debt and a list of ten buildings. Part 1 of 10.
Two Beeps is a made-up story by Sancar Games.
Demolition Master: Tower Blast is real: a free building-demolition game for iPhone.
Search "Demolition Master: Tower Blast" on the App Store.
It won't teach you real demolition. It's just fun to plan a fall.
https://apps.apple.com/app/id6823286892
#TwoBeeps #shorts #story #animation
```

**Sabit yorum:**
```
Daisy beeped twice right before the chimney fell. Luck or warning? 👀
Part 2 is next. The game is real: search "Demolition Master: Tower Blast" on the App Store (iPhone, free).
```
(Soru iki seçenekli, tek kelimeyle yanıtlanır; dürüst: cevap 4. bölümde. Yorumda bağlantı tıklanmaz, oyunun **tam mağaza adı** yazılır. Mağazadaki satıcı adı "Sancar Games" değil; "by Sancar Games" ile arama önerilmez.)

**Etiketler:** `two beeps, animated story, story time, mystery series, crane, demolition, grandpa, demolition master tower blast, demolition master, iphone game, free game, sancar games, shorts series`

**Ayar:** her bölümün "İlgili video" alanı sonrakine bağlanır; hepsi "Two Beeps" oynatma listesinde.

## 6. Ölçüm (yayından 7 gün sonra, YouTube Studio)

1. **İzlemeye devam edenler (stayed to watch) ≥ %70:** açılış ve kanca çalışıyor mu.
2. **Ortalama izlenme yüzdesi ≥ %90:** hikâye sonuna kadar taşıyor, döngü tekrar izletiyor mu.
3. **1000 izlenme başına yorum ≥ 4:** soru ve gizem etkileşim doğuruyor mu.

## Yönetmene soru

- App Store Connect'te kampanya bağlantısı (`ct=twobeeps`) için sağlayıcı kodu var mı? Varsa açıklamadaki bağlantı onunla değiştirilir, indirmeyi de ölçeriz.
