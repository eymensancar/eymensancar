# Part 1 pazarlama incelemesi (part1.mp4, 57,2 sn)

Kanıt: `out/inceleme-paz/` (`kontak-01..04.png` 0,5 sn arayla; `oyun-kontak-*` 25–29 sn ve `bitis-kontak-*` 53–57,2 sn 1/10 sn arayla, bu iki sayfada zaman 0'dan sayılır; tam kareler `tam-*.png`).

## Değişiklikler (önem sırasıyla)

1. **Kritik: aranacak ad ve geliştirici adı.** App Store'da "Demolition Master" genel bir ifade, başka oyunlarla karışır; satıcı adı "SAMFA GAYRİMENKUL", "Sancar Games" değil. Sabit yorumdaki "by Sancar Games" ile arayan bulamaz. Bitiş kartı satırı: `Search "Demolition Master: Tower Blast"` + alt satır `free · App Store`. Sabit yorum ve açıklamada da aynı tam ad.
2. **Kritik: bitiş kartı 3 değil ~1,2 sn okunuyor** (`bitis-kontak-02`: kart 55,9'da giriyor, oyun satırı 56,1'de, video 57,2'de bitiyor). Ad ekranda sessiz okunacak tek yer burası. Ya kartı 55,4'e çek (bipten 0,5 sn sonra) ya da son karede 0,8 sn tut. Oyun satırını 40 px'ten 52 px'e büyüt, kart kutusunun içine al; şu an boşlukta kopuk duruyor (`tam-56.8.png`).
3. **Önemli: telefon sahnesinin "ben de oynarım" anı yok** (25,1–29). 25,1–26,4'te ekran karartılmış, yıkım yarıda kalıyor, ardından 0,8 sn "TIME'S UP" ve başarısızlık kutusu geliyor. "Forty towers" cümlesinde tam bir çöküş görünmeli: parlak (karartmasız) ekran, telefon kadrajın %80'ini doldursun, C4 patlar, bina çöker, "DEMOLISHED 100%" ve altın sayısı uçar. "Try again" cümlesinde başarısızlık kutusu 0,3 sn'ye insin, yeniden deneme dokunuşu kalsın.
4. **Önemli: sabit yorumun sorusu iki seçenekli yap.** "Guess what the two beeps mean" açık uçlu, cevap yazmak zor. Öneri: `Daisy beeped twice before the chimney fell. Luck 🍀 or warning ⚠️? Answer below.` Altına: `Part 2 tomorrow. The game Ant plays: search "Demolition Master: Tower Blast" (free, iPhone).` Ve "Answer revealed in Part 4" ekle; dürüst ve beklenti kurar.
5. **Önemli: takip çağrısı daha somut olsun.** "Follow so Daisy can find you." şirin ama ne kazanacağını söylemiyor. `Follow · Part 2 drops tomorrow` daha iyi dönüştürür; Daisy cümlesi ikinci bölümlerde değişken eğlence satırı olarak kalabilir. Shorts'ta bağlantı tıklanmadığı için sıralama: 1) sonraki bölüm, 2) takip, 3) arama adı.
6. **Önemli (ölçek): "free on the App Store" iPhone'u söylemiyor.** Android izleyicisi arar, bulamaz, kırgın yorum yazar. Kartta `iPhone · free`; açıklamada zaten var.
7. **Küçük: "TWO BEEPS" (36 px) seri adı zayıf.** 0–2,5 sn'de etiket iyi okunuyor (`tam-1.0.png`), ama dizi adı bulut üstünde kayboluyor. 48 px'e çıkar, beyaz konturlu. "1/10" rozeti iyi; bitiş kartında da `1/10 → 2/10` görünürse "hepsini izle" isteği artar.
8. **Küçük (ölçek): başlık kalıbı.** Seçilen başlık iyi; on bölümde hep `(Part N)` sonda kalsın, oynatma listesi adı "Two Beeps" ile aynı yazılsın. Etiketlere `demolition master tower blast` ekle.

Ek not (yönetmene, oyun deposu bize ait değil): İngilizce cihazda ana ekranda uygulama adı "Yıkım Ustası" görünüyor (`en.lproj/InfoPlist.strings` içinde `CFBundleDisplayName` yok). Videodan gelen kişi indirdiği oyunu ana ekranda bulamayabilir; oyun ekibine iletilmeli.

## Dürüstlük
Yanıltıcı bir şey yok: telefondaki görüntü gerçek oyun (Level 5 · Old Textile Mill, gerçek araç çubuğu), oyun "gerçek yıkım öğretmez" diye açıklamada yazıyor, "free" doğru. Tek risk 6. maddedeki iPhone eksikliği. 3. maddedeki öneri de gerçek bir oyun kaydı olmalı; sahne kurgusu değil.

## Dokunulmaması gerekenler
1. **Köşe simgesi** (3. sn'den itibaren, 64 px, %70): bağırmadan sürekli bağ; gerçek simge olduğu için mağazada tanınır.
2. **Oyunun anlatıcı cümlesine gömülmesi** ("forty towers in Demolition Master. In the game, you just try again. Real chimneys don't."): reklam gibi değil hikâye gibi duruyor, oyun ile gerçek yıkım arasındaki çizgiyi de kendisi çiziyor.
3. **Tek bip + kart sırası** (55,3'te ışık, sonra kart): merak ve seri imzası; kartı öne çekerken bip anının sessizliği bozulmasın.
