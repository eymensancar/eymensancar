# Two Beeps — üretim tanımı (bütün ekip önce bunu okur)

## Ne yapıyoruz
Sancar Games'in YouTube Shorts kanalı için 10 bölümlük dikey animasyon dizisi: **Two Beeps**. Her bölüm 55–60 sn, 1080×1920, 30 fps, İngilizce seslendirme. Senaryo kesinleşti: `docs/SENARYO.md`. Kurgu gerekçeleri (beş senarist, beş psikolog raporu): `docs/kurgu/`.

**Şu anki iş: yalnız 1. bölümün (Part 1 · The Chimney) pilotu.** Sahibi (Eymen) izleyecek; tarz, anlatım ve tempo oturmuşsa kalan dokuz bölüm aynı düzende yapılacak. Bu yüzden pilotta kurulan her şey (stil, karakterler, altyazı, açılış/bitiş kartı, ses dili) **dokuz bölümde yeniden kullanılacak** biçimde kurulur.

## Amaç (sahibinin sözleriyle)
- "Amacımız tamamen pazarlama. Sırf izlensin diye hikâye yapmıyoruz." Hem izlenecek hem "ben bu oyunu bir indireyim" dedirtecek.
- "Amacımız çok fazla etkileşim almak ve **oyunla bağını asla koparmamak**." İzleyenin %0,01'i indirse yeter; asıl ölçü etkileşim (izlenme süresi, yorum, sonraki bölümü arama).
- Oyun: **Demolition Master** (Türkçe adı Yıkım Ustası), iPhone, ücretsiz, App Store. Oyuncu binaları patlayıcı ve makinelerle yıkar, altın kazanır, makinelerini geliştirir. Oyunun kendisi bu makinede: `/home/user/clauderepo/www/` (tarayıcıda çalışır; `index.html?debug` ile `window.__yk` test kancası). **Gerçek oyun görüntüsü videoda kullanılabilir** (ör. telefonda oynanan oyun sahnesi); oyunun görsel dili (renkler, yıkım hissi) dizinin diline yakın durmalı ki bağ kopmasın. O depoda hiçbir dosyayı değiştirme, dal değiştirme.
- Abartı yok, yanıltıcı vaat yok: oyunda olmayan şey gösterilmez; oyun gerçek yıkım öğretmez.
- İzleyici genel, çocuklar da izler: korku, yaralanma yok.

## Biçim
- Her bölüm tek başına yayınlanabilir bir Short: başında bölüm etiketi (ve 2. bölümden itibaren çok kısa "önceki bölümde"), sonunda merak bırakan bitiş + sonraki bölüme çağrı. Bölümler arka arkaya eklenince tek uzun video da olur.
- Ses: anlatıcı kaydı sahibinden geliyor (Claude uygulamasının sesli okuması, tek uzun kayıt; yönetmen bölümlere ayırır, gerekirse kırpar/yavaşlatır). Kayıt gelene kadar süreler tahminidir (kelime sayısından); **her şey bir zaman çizelgesi dosyasından (`src/part1.timeline.json`) okunacak**, kayıt gelince yalnız o dosya güncellenecek.
- Görsel: kodla çizilen 2D animasyon (HTML/Canvas/SVG), Playwright ile kare kare kaydedilir, ffmpeg ile birleştirilir. Dış istek yok: font, ses, görsel hepsi `assets/` içinde. Yalnız telifsiz (CC0 ya da açıkça ticari kullanıma izinli) kaynak; her dış dosya `assets/LICENSES.md` içine kaynağı ve lisansıyla yazılır. Telifli karakter, gerçek marka yok.
- Karakterler: Kaan (19, anlatıcı, "Ant"), Daisy (eski sarı vinç; **iki bip** dizinin ana motifi), Defne (abla, mühendis), Mr. Hale (müteahhit), Grandpa (yalnız iz olarak: el yazısı, defter, telefon).

## Çalışma kuralları
- Klasör: `/home/user/eymensancar/two-beeps/`. Yalnız sana söylenen dosyalara yaz. Dal değiştirme, commit atma, push etme (yönetmen yapar).
- Belgeler Türkçe, kısa ve uygulanabilir: karar ver, gerekçeyi bir cümleyle yaz, seçenek sıralama.
- Yönetmen: Claude 2. Takıldığın şeyi raporunun sonunda "Yönetmene soru" diye yaz.

## Pilot üretim düzeni (15 Kasım)
- Zaman çizelgesi: `src/part1.timeline.json` (`python3 src/ses_kur.py` üretir; elle değiştirme). Süre 57,2 sn. Cümleler `sentences[i]` (t0, t1, words), işaretler `cues`: `beep` (iki bipin başladığı an, "Daisy beeped." ile "Twice." arasında 1 sn boşluk var), `fall`, `stamp`, `voiceEnd`, `endBeep` (bitişteki TEK bip), `endCard`.
- Motor: `src/motor.js` (sözleşme dosyanın başında). Sayfa `src/part1.html`. Her şey `renderAt(t)` ile zamandan çizilir; rastgelelik yalnız tohumlu.
- Dosya sahipliği: Animatör A `src/shots/a-sahneler.js` (0–23,15 sn, cümle 1–12), Animatör B `src/shots/b-sahneler.js` (23,15–57,2 sn, cümle 13–28 ve bitiş görüntüsü), paketleme `src/paket.js` + `src/kaydet.cjs`, ses `src/miks.py`, oyun görüntüsü `assets/img/oyun/`. Kimse başkasının dosyasına, `cizim.js`'e, `motor.js`'e ya da `part1.html`'e yazmaz; ortak bir yardımcı gerekiyorsa kendi dosyasında tanımlar.
- Yönetmen kararları: bölüm sonunda TEK bip (ikincisi bilerek yok). Bip anında başka hiçbir şey hareket etmez. İki bipin sesi `assets/sfx/daisy-beep.wav` (iki bip tek dosyada); görsel ışık ritmi STIL.md'deki gibi sesle aynı karede. Kaan'ın saç tutamı, yeşil ceketi ve Daisy'nin görünümü `cizim.js`'teki gibi kalır (karakter tutarlılığı).
- Yerel izleme: `cd two-beeps && python3 -m http.server 8800`, sonra `http://localhost:8800/src/part1.html?t=12.5` (boşluk tuşu oynatır). Kare almak için Playwright: sayfayı aç, `TB_READY` bekle, `renderAt(t)` çağır, tuvalin ekran görüntüsünü al.

## Ses kuralı (Eymen, 15 Kasım 2026, kalıcı; bütün projelerde geçerli)
Geçişlerde ve başka hiçbir yerde "whoosh/swoosh" türü gürültü süpürmesi (hışırtı, hava sesi, süpürge sürtünmesi gibi duyulan filtreli gürültü) kullanılmaz; Eymen kulak tırmalayıcı buluyor. Geçişler sessiz kalır ya da yumuşak, tonlu, kısa bir sesle vurgulanır. `baca-devrilme.wav` içindeki düşüş süpürmesi (1,9–2,75 sn) mikste kullanılmaz; yalnız yere çarpma kısmı kullanılır.
