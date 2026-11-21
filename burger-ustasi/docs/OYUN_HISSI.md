# Oyun hissi: Shawarma Legend ve benzerleri neden "oyunsu", Burger Ustası'na ne yapalım

Araştırma: 21 Kasım 2026. Kaynaklar en altta (35 kaynak, numaralı). Metinde [n] o kaynağı gösterir. Kaynağa dayanmayan yerler **(tahmin)** diye işaretli.

**Eymen'in 21 Kasım kararı (bu belge buna göre yazıldı):** müşterilerin tek bir hâli var; kızgın, sabırsız, üzgün yüz yok. Süre dolunca müşteri sadece gider. Karakterler ChatGPT'den yeşil ekranlı tek görsel olarak gelecek (20 karakter). Bu yüzden aşağıda müşteri tepkisi hep **hareket, ses ve parçacıkla** anlatılıyor, yüz ifadesiyle değil.

**9. tur (21 Kasım) uygulandı:** A1 (gerçek sesler), A2 (para anı), A3 (görünür seri), A4 (müzik + yoğunluk katmanı + jingle; sözlü jingle yok), A5 (dokunuş tepkisi), A6 (doğrama gamı), A7 (tek görselli müşteri: yürüme, zıplama, titreyen baloncuk), A8 (burger kapanınca duraklama), A10 (sıradaki hedef), A12 (reklam yok). B5'in can kısmı uygulandı (can kalktı); öbür B maddeleri yapılmadı. Yapılmayanlar: A9 (yükseltmenin sahnede görünmesi), A11 (ilk 60 saniye), rekor rozeti. Ayrıntı `docs/TASARIM.md` → "9. tur".

---

## Kısaca (önce bunu oku)

1. Shawarma Legend'in oyunu çok basit, hatta "kaba". Onu tutturan üç şey: **akılda kalan bir şarkı ve komik seslendirme**, **her yükseltmenin bir dokunuşu ortadan kaldırması** (oyuncu her gün işinin kolaylaştığını eliyle hissediyor) ve **tezgâhta biriken parayı toplamak, hırsızı kovalamak gibi küçük eğlenceli işler** [7][8][9][10][6].
2. Bizim sesimizin "berbat" olmasının en büyük nedeni muhtemelen **her şeyin sentezle üretilmesi**: kare/üçgen dalga müzik "bip bip oyun" gibi duruyor, cızırtı filtrelenmiş gürültü. Shawarma Legend'de oyuncular "gerçekçi ses efektleri"ni övüyor [1]. Çözüm: mutfak sesleri için **gerçek kayıt** (CC0), müzik için **gerçek çalgılı hazır döngü**, üstüne bizim kendi imza jingle'ımız.
3. Paranın gelişi en tatlı an olmalı: para **akarak** artsın, her bozukluk **ayrı şıngırdasın**, art arda iyi servis yaptıkça ses **yarım ton yükselsin** (Candy Crush'ın yaptığı tam bu) [18].
4. Bütün bunlar Eymen'in kurallarını (8 sn ızgara, 10 doğrama, 15 sn fritöz, iki tepsi, tek burger, tepsi→müşteri) bozmadan yapılabiliyor. Kuralı değiştiren öneriler ayrı bölümde, "Eymen'e sor" diye.

---

## 1. Shawarma Legend nasıl oynanıyor

### Kimlik
- Adı: Shawarma Legend (Türkçe adıyla Döner Efsanesi). Geliştiren Eyad Al Shafei, yayıncı/telif Patates Games; Türkiye'de yaşayan tek kişilik bir geliştirici olarak anlatılıyor [1][2][8].
- Çıkış 19 Temmuz 2024. App Store'da 4,8 puan (115 bin değerlendirme), Steam'de %90 olumlu (706 yorum) [1][2].
- Çizim, müzik ve seslendirme yapay zekâyla (Suno gibi araçlarla) yapılmış; geliştirici bunu mağaza sayfasında söylüyor [2][7][8][10].
- Temmuz–Ağustos 2024'te pek fark edilmedi (App Store'da 307. sıraya kadar düştü), Eylül–Ekim'de Çin'de Douyin videolarıyla patladı: 2,5–3 milyar izlenme, 38 ülkede listelere girdi, toplam ~3,5 milyon indirme [7][8][9].

### Ekran ve çekirdek döngü
Tek sabit ekran: önde tezgâh, arkada sırayla gelen müşteriler, solda döner şişi, ortada hazırlık yeri, yanlarda patates, içecek makinesi, fritöz [3][4][10] (yerleşimin ayrıntısı **(tahmin)**, videolardan değil yazılardan derlendi).

Bir dürümün adımları (yazılardan ve rehberlerden birleştirildi [4][10][13][14][6]):
1. **Eti şişten kes**: bıçakla şişe dokunarak/sürükleyerek et kesilir, et tepsiye yığılır. Yükseltmeyle kesim iki kat hızlanır, sonra et azalınca kendiliğinden kesilir [5][6].
2. **Lavaşı koy**: başta elle; yükseltmeyle "lavaş fırlatan makine" kendiliğinden koyar [5][6].
3. **Malzemeleri ekle**: et, salatalık turşusu, sos/salata, patates kızartması. Başta her malzeme **3 dokunuş**; yükseltmeyle 2, sonra 1 [5][6][14].
4. **Sar**: dürüm sarılır [4][10].
5. **Paketle**: başta kâğıda **sürükle-bırak**; yükseltmeyle tek dokunuşla paketleyen makine, sonra kendiliğinden paketleme [5][6].
6. **Yan ürünler**: patates kızartması (fritöz başta 15 sn; patatesi doğrama, kutuya sürükleme), kola (bardağı elle musluğun altına koy, düğmeye bas, dolmasını bekle), sonra portakal suyu ve "kebbe" [5][6].
7. **Müşteriye ver**, müşteri parayı **tezgâha bırakır**; parayı oyuncu dokunarak toplar. Gün bitince tezgâhta kalan para **yanar** (o günün geliri sıfır olabilir) [6][13][14].

Yani Burger Ustası'na çok benziyor: birkaç istasyon, her istasyonda kısa elle iş, sonunda birleştirip müşteriye verme. Fark, onlarda "elle iş" yükseltmelerle **adım adım yok oluyor**.

### Müşteriler ve siparişler
- Tezgâhta başta en çok 3, dekor yükseltmesiyle 4 ve 5 müşteri [5][6].
- Başta siparişler sade ve hep benzer; yükseltmeler açıldıkça çeşitleniyor (içecek, portakal suyu, ızgara, nar ekşisi sosu). En son "malzeme seçme" yükseltmesiyle müşteri bazı malzemeleri istemiyor, oyun bir anda zorlaşıyor; rehberler bunu "en sona bırak" diye üç kez uyarıyor [6][11][14].
- Bekleyen müşterinin bir sabır göstergesi var [12]; beklerse kızgın gidiyor ama **ceza yok**, sadece o satış kaçıyor. "Mükemmellik oranı" diye bir zorunluluk yok; kötü yapılmış dürüm uyuyan çalışana (bir çeşit çöp) verilebiliyor [6][13].
- İki "baş belası" karakter: **dilenci** (10. günden itibaren; dürümü alıp parasını vermiyor, kafasına dokununca ödüyor) ve **hırsız** (20. günden itibaren; tezgâhtaki paraları kapıp kaçıyor, birkaç kez dokununca geri veriyor; otomatik para toplayıcı alınınca hiç gelmiyor). Oyuncular bunları hem sinir bozucu hem komik buluyor, "insanı uyanık tutuyor" diyorlar [1][6][9][12][13].
- Yanda uyuklayan bir yaşlı adam var; yoğun anlarda uyanık tutman gerekiyor [9][10].

### İlerleme ve ekonomi
- Gün gün oynanıyor; her günün sonunda dükkândan yükseltme alınıyor [6][13].
- Yükseltme listesi (fiyatlar rehberlerden [5][6]): patates (250 → 1.600), et kesme (350 → 2.400), malzeme dokunuşu 3→2→1 (250 → 2.100), paketleme (800 → 2.400), fritöz 15→10→5 sn (1.000 → 4.500), kola makinesi 4 basamak (800, 2.100, 1.200, 3.500), çalışan (2.100–2.400: bütün malzemeleri tek dokunuşla doldurur), dekor (müşteri sayısı 4 ve 5: 1.200, 3.500), "fırça" (fiyat +1: 650, 3.500), para alarmı ve otomatik para toplayıcı (1.000, 3.100), ızgara (1.600, 2.700) ve diğerleri.
- **En önemli nokta:** yükseltmelerin çoğu bir **dokunuşu ya da sürüklemeyi ortadan kaldırıyor**. Oyuncu "işim hafifledi" duygusunu her gün elinde hissediyor. Bazı yükseltmeler başta işi zorlaştırıyor (ızgaranın 1. basamağı yemek yakıyor), bu da topluluğun "hangi sırayla alınır" diye konuşmasını sağlıyor [5][6][11][14].
- Fiyat: tam dolu dürüm 7, ızgara +3, nar sosu +2, portakal suyu ve kebbe 6, patates ve içecek 9 [14].
- Hedef: "Efsane" olmak için toplam ~50.000 para; oyuncular 84–102 günde, ~8 saatte bitirdiğini yazıyor. Bitince ekran kararıyor, havai fişek, "Artık Shawarma Efsanesisin" yazısı [6][14].
- Oyuncuların bir kısmı her şeyi otomatikleştiriyor, bir kısmı "hiç otomatik alma, bütün zevk elde" diyor; bu iki grup birbirinin videolarını izleyip yarışıyor [7][11].

### Ses ve müzik
- Menüde yapay zekâyla yapılmış, sözlü, çok basit, sürekli "shawarma" kelimesini tekrarlayan bir şarkı çalıyor. Şarkının farklı dillerde farklı ezgili sürümleri var (Çince, İngilizce, Arapça, Almanca, Türkçe; güncelleme notlarında "Türkçe ve Almanca şarkı eklendi", "Çince şarkı eklendi" yazıyor). Çin'deki patlamanın 1 numaralı nedeni bu şarkı ve tuhaf aksanlı seslendirme olarak gösteriliyor [1][7][8][9][10][11].
- Karakter seslendirmesi 13–14 dilde, bilerek "beceriksiz", aksanlı. İnsanlar bunu taklit edip video yapmış [8][10].
- Oyuncular "gerçekçi ses efektleri"ni ve "akıcı oynanış"ı övüyor [1]. Oyun içinde arka planda şarkının mı yoksa başka bir döngünün mü çaldığını kaynaklardan kesin çıkaramadım **(tahmin: menüde şarkı, oyunda daha hafif döngü)**.
- Eleştiri: Steam'de bir kısım oyuncu yapay zekâ müziğine ve görseline karşı olumsuz yorum yazmış [3].

### Reklamlar
- Mobilde reklamlar **her günün sonunda ve menü açılınca** geliyor; ilk sürümlerde neredeyse her işten sonra geliyordu. En çok şikâyet bu. Güncelleme notlarında 5 kez "daha az reklam" yazıyor; 2,99 $'a reklam kaldırma eklendi [1].
- Oyuncu yorumu: "reklamlar uzun ve geçilemiyor, oyunu silip sonra geri döneceğim" [1].

### İlk 5 dakika
Kaynaklarda ayrıntılı anlatım bulamadım. **(tahmin)**: ilk gün yükseltmesiz, yalnız et + malzeme + sarma + paketleme; patates, içecek gibi istasyonlar sonra açılıyor. Rehberlerin "patates ve içeceği erken açma, işin artar" demesi bunu destekliyor [6][13].

### Zorluk eğrisi
Zorluk iki yerden geliyor: (1) gün ilerledikçe gelen müşteri artıyor, (2) oyuncunun **kendisi** yeni istasyon (içecek, sos, malzeme seçme) açtıkça iş artıyor. Yani zorluğu bir yerde oyuncu seçiyor [6][11][13][14]. Oyuncular "o kadar çok tıklama var ki elim uyuştu" diye şikâyet ediyor [3].

---

## 2. Neden "oyunsu" ve tatmin edici: somut mekanizmalar

Her madde: ne, neden, kaynak.

| # | Mekanizma | Neden işe yarıyor | Kaynak |
|---|---|---|---|
| 1 | **Her dokunuşa anında, fazlasıyla tepki** (ses + kıpırdama + parçacık) | "Juice": girdiye gereğinden fazla geri bildirim, hareketi önemli hissettirir. Dikkat: deney bulguları "orta ve yüksek düzey juice, hiç olmamasından da aşırısından da iyi" diyor (Kao 2020); Juul'un deneyinde juicy sürüm daha kaliteli bulundu ama skor biraz düştü, yani fazlası dikkat dağıtır. | [15][16][17] |
| 2 | **Yükseltme = bir dokunuş eksik** | Oyuncu ilerlemeyi sayıda değil elinde hissediyor. Shawarma Legend'in bütün dükkânı bu (3→2→1 dokunuş, sürükle→tek dokunuş→otomatik). Good Pizza'daki "Autobuddy" yükseltmeleri de aynı fikir. | [5][6][19] |
| 3 | **Para sesi ve parayı görmek** | Kazanma sesi oyuncuyu canlandırıyor ve kazancı **olduğundan fazla** sandırıyor: slot deneyinde sesli oturumu oyuncuların %72,5'i seçti, kazanç sayısını sesliyken %24, sessizken %15 fazla tahmin ettiler. (Kumar araştırması; biz bunu dürüst kullanırız: gerçekten kazanılan parayı güzel duyurmak için.) | [20] |
| 4 | **Art arda yükselen perde (kombo)** | Candy Crush'ta aynı ses her ek satırda yarım ton yükseliyor; oyuncu "büyüyen ödül"ü kulağıyla duyuyor. Kötü harekette ses çok az ve şakacı. | [18] |
| 5 | **Toplanacak para / küçük işler** | Shawarma Legend'de para tezgâhta birikir, dokunarak toplanır; hırsız ve dilenci bu "küçük işi" heyecanlı yapıyor. Çinli yazar: "küçük dükkân kazıklanıyor" duygusu oyuncuyu "bir tur daha" oynatıyor. | [6][7][13] |
| 6 | **Hatanın cezası hafif** | Kızgın giden müşteri sadece satış kaybı; mükemmellik zorunluluğu yok, kötü dürüm atılabiliyor. Oyuncu korkmadan hızlanıyor. | [6][13] |
| 7 | **Kısa gün + gün sonu ödülü** | Her gün kısa bir tur; sonunda para sayımı ve dükkân. "Bir gün daha" demek kolay. Papa's serisinde de her müşteri sonunda istasyon istasyon puan çıkıyor, puan bahşişe dönüyor. | [6][21][22] |
| 8 | **Sürekli yeni şey** | Papa's'ta seviye atladıkça yeni malzeme ve yeni müşteri geliyor; Shawarma Legend'de her gün bir şey satın alınabiliyor; My Perfect Hotel ve Burger Please'te de alan alan açılıyor. | [5][21][24][25] |
| 9 | **Kimlik: şarkı ve karakter** | Shawarma Legend'in yayılmasını oyun değil şarkı, aksanlı ses ve kırmızı burunlu yaşlı adam gibi akılda kalan karakterler sağladı. | [7][8][9][10] |
| 10 | **Zaman baskısı ama dengeli** | Overcooked ekibi: "can" sistemi oyuncuyu kasıyordu, **zamanlayıcı** istedikleri telaşı verdi. Fazla iş + birden çok sayaç = eğlenceli kaos. | [23] |
| 11 | **Durma anı (hit-stop)** | Önemli anda 50–100 ms donma, darbeyi büyütür; güçlü olaya uzun, zayıfa kısa, ama üst sınırlı. Sakurai bunu ilk tasarım dersi olarak anlatıyor. Bizde "burger kapandı" ve "müşteri ödedi" anlarına uyar. | [26] |
| 12 | **Müziğin tempo etkisi** | Hızlı tempo uyarılmayı ve hızı artırıyor ama isabeti düşürüyor (sürüş oyunu deneyleri); ters U eğrisi. Gün başında sakin, yoğunlukta biraz daha hareketli olmalı, sürekli hızlı değil. | [27] |
| 13 | **İlk oturumda hızlı başarı** | İlk açılışta hemen eğlenceli bir şey yapmak, kendini başarılı hissetmek, uzun hedef görmek; öğretici adım adım ölçülüp nerede bırakıldığına bakılmalı. | [29][30] |

Hyper-casual "idle" restoranlardan (Burger Please, My Perfect Hotel) alınacak ders: çekirdek iş çok basit (yürü, al, koy), tatmin **para yığınlarının büyümesi ve yeni alan açılmasından** geliyor; ama Burger Please eleştirisi şu: reklam ödülleri ilerlemeyi fazla kolaylaştırınca ve bazı yükseltmelerin **görünür etkisi olmayınca** (ör. ocak) oyuncu bırakıyor [24][25]. Yani **her yükseltmenin ekranda görünen bir değişikliği olmalı**.

Cooking Fever'dan ters ders: oyuncular en çok ikinci para birimi (elmas) darboğazına ve ani zorluk sıçramalarına kızıyor [28].

Good Pizza Great Pizza'nın dersi: süre yok gibi sakin, "hamur bir tuval", müşteriler gerçek insanlardan esinli ve konuşan karakterler; ilk hâlinde tutundurma kötüydü, tasarım ve arayüz yeniden yapılınca günlük oyuncu 1.000'den 30.000'e çıktı [19].

---

## 3. Ses ve müzik

### 3.1 Başarılı yemek oyunlarında ne duyuluyor
- **Sürekli ortam sesi**: ızgara cızırtısı, fritöz kabarcığı. Yemek "canlı". Shawarma Legend yorumlarında "gerçekçi ses efektleri" övülüyor [1]. Bizde cızırtı yalnız köfte konunca kısa çalıyor; ızgarada köfte durdukça **devam etmeli** **(tahmin, ama türün genel kuralı)**.
- **Tok, kısa vuruşlar**: bıçak, tahta, ekmeğin konması. Gerçek foley (mutfakta kaydedilmiş ses) bunları "eline geliyor" gibi duyurur.
- **Para**: bozukluk şıngırtısı ve kasa. Slot tasarımında "parlak, hızlı yüksek notalar = para" [20].
- **Kombo**: aynı ses, her adımda yarım ton yukarı [18].
- **Ses ile karakter**: müşterinin kısa bir "mmm", gülme ya da "teşekkürler" demesi. Shawarma Legend'de çok dilli seslendirme var [2][10]. (Kenney'in CC0 "Voiceover Pack" paketi var ama sunucu/anons sesi; müşteri sesi için uygun olmayabilir **(tahmin)**.)
- **Müzik**: menüde akılda kalan bir parça, oyunda hafif ve döngüsel. Candy Crush analizinde eleştiri: tek parçanın sürekli dönmesi sıkıyor [18]. Çözüm literatürde: **dikey katman** (aynı parçanın davul, bas, melodi kanalları ayrı; yoğunlukta katman eklenir) [31].

### 3.2 Bizim neden "berbat" olduğumuz (muhtemel nedenler)
`www/js/ses.js` okunarak:
1. **Hepsi sentez.** Müzik 112 BPM, Do majör, melodi kare + üçgen dalga, marimba ve davul da sentez. Bu tını kulağa "eski telefon zil sesi / 8 bit" gibi gelir; resimdeki sıcak, gerçekçi mutfakla uyuşmuyor. Prosedürel ses araştırmacıları da "kayıtlı ses kadar geniş bir renk elde etmek ciddi teknik yatırım ister" diyor [32].
2. **Cızırtı ve kabarcık filtrelenmiş gürültü.** Gerçek yağ cızırtısı patlayan damlacıklardan oluşur; sabit filtreli beyaz gürültü "radyo hışırtısı" gibi duyulur **(tahmin, ama sentezin bilinen zayıflığı)**.
3. **Tek bir melodi döngüsü, hep aynı yoğunlukta.** Oyundaki telaşla müzik değişmiyor; ne sakin anı ne yoğun anı taşıyor [31].
4. **Seslerde çeşitleme yok (muhtemelen).** Aynı ses her seferinde birebir aynı çalınca kulak "makine" der. Her çalışta perdeyi ±%4–8 ve sesi ±2 dB oynatmak ya da 3–4 farklı kayıttan rastgele seçmek standart yöntem **(tahmin: türün yaygın uygulaması)**.
5. **Kimliğimiz yok.** Shawarma Legend'in her şeyi kaba ama bir şarkısı var. Bizim duyulunca "Burger Ustası" denecek bir sesimiz yok.
6. **Para anı sessiz kalıyor.** Kasa sayısı tek seferde değişiyor (`kasaYaz` sayıyı doğrudan yazıyor), para akmıyor, bozukluk tek tek şıngırdamıyor.

### 3.3 Çözüm: lisansı uygun hazır sesler ve müzik
Kural: **whoosh/swoosh yok.** Uçan malzeme için "hava" sesi değil, **konma** sesi (tok vuruş). Bütün dosyalar `www/` içine konur (dış istek yok), lisans `README.md`'ye yazılır.

**Efektler (CC0 = atıfsız, ticari serbest):**
| Kaynak | Ne alınır | Lisans |
|---|---|---|
| Kenney **Impact Sounds** (130 dosya, foley) | tahtaya ekmek/köfte konması, tepsi kayması değil tepsinin tezgâha oturması, bıçak vuruşu | CC0 [33] |
| Kenney **Casino Audio** (50 dosya: çip, kart, zar) | para/çip şıngırtısı, kasaya düşen bozukluk, bahşiş | CC0 [33] |
| Kenney **Interface Sounds** (100 dosya) | düğme, dükkân, menü tıkları | CC0 [33] |
| Kenney **Music Jingles** (85 dosya) | gün başı, gün sonu, yıldız, yükseltme alındı kısa müzikleri | CC0 [33] |
| **Freesound.org**, lisans süzgeci "Creative Commons 0" | ızgara cızırtısı döngüsü ("sizzle", "griddle", "burger"), fritöz ("deep fryer"), bıçakla doğrama ("knife chop"), kalabalık kafe uğultusu | her dosyanın sayfasında CC0 olduğu tek tek doğrulanır [34] |

**Müzik:**
| Kaynak | Örnek | Lisans |
|---|---|---|
| OpenGameArt (CC0) | "Happy Clappy Loop" (OwlishMedia, piyano, kesintisiz döngü), "Loop Town" (Fupi), "Urban Shop" (MintoDog, trompet/saksafon), "Quaint Town" (neonarkade), "Shop Theme" (CleytonKauffman, bossa nova; sayfasında atıf notu var, sor) | CC0 [35] |
| Pixabay Music | sıcak, akustik "cafe / cooking / jazz" döngüleri | Pixabay İçerik Lisansı: atıf gerekmez, oyunda kullanılır, yalnız sesi tek başına satmak/dağıtmak yasak [36] |
| Incompetech (Kevin MacLeod) | çok sayıda neşeli parça | CC BY 4.0: **atıf zorunlu** (Ayarlar → Emeği geçenler); atıfsız için ücretli lisans [37] |

Tavsiye edilen müzik biçimi: **akustik, sıcak çalgılar** (ukulele/akustik gitar, el çırpma, hafif davul, kontrbas ya da pizzicato yaylı), **100–120 BPM**, majör. Oyun içinde **iki katman**: (a) temel döngü hep çalar, (b) 2 ve üstü müşteri beklerken davul/perküsyon katmanı yumuşakça girer. Menüde ayrı bir parça.

**İmza jingle (önerinin en "Shawarma Legend" kısmı):** 3–5 saniyelik, sözlü "Bur-ger Us-ta-sı!" nakaratı. En ucuz ve telifsiz yolu: **Eymen'in ya da ailenin kendi sesiyle kaydı** (telefonla, sessiz odada), üstüne basit bir akor. Gün başında, rekor gününde ve ana menüde çalar. Yapay zekâ şarkısı (Suno vb.) da yol, ama ücretsiz planlar genelde ticari kullanıma izin vermiyor ve Steam'de yapay zekâ müziğine tepki var [3]; bu **Eymen'e sor**.

**Web Audio ile ne kalsın, ne gitsin:**
- Sentezde kalabilir: kombo perdesi (kayıtlı sesi `playbackRate` ile yarım ton yukarı çalmak), sabır çubuğunun son anındaki tik-tak, kısa "pop" ve tık sesleri, ızgara pişti zili (zil sentezi iyi çalışır).
- Kayda geçmeli: cızırtı, fritöz, bıçak, ekmek/köfte konması, para, müşteri sesi, müzik.
- Teknik: sesler bir kez `fetch` + `decodeAudioData` ile yüklenir, `AudioBufferSourceNode` ile çalınır; iPhone Safari için `.m4a` (AAC) ya da `.mp3` (Ogg'a güvenme); efektler mono, 44,1 kHz, kısa; toplam efekt boyutu birkaç yüz KB, müzik döngüsü 1–2 MB. Döngü noktası için `loopStart/loopEnd` kullanılır (MP3'ün başındaki sessizlik döngüyü bozar, OpenGameArt yorumunda da uyarı var [35]).

---

## 4. Burger Ustası'na uygulanacak öncelikli liste

Sıralama: en büyük etkiden en küçüğe. **A bölümü kuralları bozmaz.** B bölümü kural değiştirir, **Eymen'e sor**. Emoji yok, para tam sayı.

### A. Kuralları bozmayanlar

**A1. Mutfak seslerini gerçek kayda çevir, ızgarayı ve fritözü "canlı" yap.**
- Ne: Freesound CC0 cızırtı döngüsü; ızgarada kaç köfte varsa o kadar katman (1 köfte kısık, 4 köfte dolgun), köfte kalkınca o katman 0,2 sn'de söner. Fritöz 15 sn boyunca kabarcık döngüsü, bitince yağ "tıs" + zil. Doğramada gerçek bıçak-tahta vuruşu. Ekmek/köfte/peynir/turşu için ayrı tok konma sesleri (Kenney Impact). Her çalışta perde ±%5, ses ±2 dB, mümkünse 3 kayıttan rastgele.
- Neden: sesimizin ucuz durmasının ana nedeni sentez; oyuncular türde "gerçekçi ses"i övüyor [1][32].
- Ölçüm: Eymen'e eski/yeni sürümü sırayı söylemeden dinlet (kör karşılaştırma), hangisini seçti. `tools/ses.html` deneme sayfasında yan yana.

**A2. Para anını büyüt: akan sayaç, tek tek bozukluk, kasanın zıplaması.**
- Ne: müşteri ödeyince 3–6 bozukluk müşteriden kasa rozetine yay çizerek uçar; her biri vardığında ayrı şıngırtı (Kenney Casino) ve kasa rozeti %8 büyüyüp toparlanır; kasa sayısı 0,4–0,6 sn'de **akarak** artar (ara değerler tam sayı). Bahşiş ayrı renkte, ayrı ve daha parlak ses. Gün sonu kartında gelir/bahşiş/gider satırları da akarak sayılır, her satır bitince kısa ses.
- Neden: kazanç sesi ve görüntüsü oyuncuyu canlandırıyor, oyunun en "tatlı" anı [20][24].
- Ölçüm: ödeme anında ses gecikmesi (dokunuştan sese) 50 ms altında; test botu teslimden sonra kasa sayısının ara değerlerden geçtiğini ve sonunda tam doğru olduğunu denetler.

**A3. Seriyi görünür ve duyulur yap (kombo).**
- Ne: kodda `S.seri` zaten var ve 3. iyi servisten sonra bahşişe +1…+5 ekliyor (`veri.js` → `bahsis`), ama oyuncu bunu görmüyor. Her ardışık "sabır yüksekken teslim"de kasa sesi **yarım ton yükselir** (en çok 7 adım); 3'ten sonra tezgâhın üstünde küçük bir "Seri 3" rozeti ve bahşiş yazısının yanında "+seri" görünür. Bir müşteri giderse seri sessizce sıfırlanır (cezalandıran ses yok, rozet söner).
- Neden: Candy Crush'ın büyüyen ödül sesi [18]; hız ödülü oyuncuyu "bir tane daha" diye zorlar ama ekonomi değişmez (zaten var).
- Ölçüm: denge botuyla ortalama seri uzunluğu (orta oyuncu); Eymen oynarken seriyi fark etti mi, sorulur.

**A4. Müzik: hazır akustik döngü + yoğunluk katmanı + kendi jingle'ımız.**
- Ne: Bölüm 3.3'teki gibi. Gün başında temel katman; bekleyen müşteri 2'yi geçince perküsyon katmanı 1 sn'de girer, azalınca çıkar. Ana menü ayrı parça. Müzik efektlerin altında (şimdiki `SEV.muzik` oranı iyi bir başlangıç). Gün sonu ve yükseltme için Kenney jingle'ları.
- Neden: tek, sabit yoğunlukta sentez döngüsü sıkıyor ve oyunun durumunu taşımıyor [18][31]; tempo 100–120 dengeli [27]; kimlik şarkıdan geliyor [7][8].
- Ölçüm: Eymen 10 dakika oynayıp müziği kapattı mı; kapatma ayarının kullanımı kayıtta sayılabilir (yalnız cihazda).

**A5. Her dokunuşun anında karşılığı (60 ms kuralı).**
- Ne: dokunulan her nesne **basıldığı anda** (pointerdown) %6–8 ezilir, bırakınca hafif taşarak toparlanır (squash/stretch, 120–180 ms, "ease-out-back"); aynı anda kısa ses ve 3–6 parçacık (kırıntı, buhar, susam). Reddedilen dokunuşta (ör. fritöz doluyken doğrama) titreşim + yatay küçük sallanma + yumuşak "tık-tık"; kırmızı yazı kısa. iPhone'da `Haptics`: dokunuşta hafif, burger kapanınca orta, ödemede "success" bildirimi (kodda `tit()` var, bütün yerlere bağlanmalı).
- Neden: juice = girdiye bol geri bildirim [15][16]; ama **orta düzey** en iyisi, aşırısı skoru düşürüyor [16][17]: parçacıklar küçük ve kısa kalsın, ekran sallanması kullanma (yalnız tek nesne kıpırdasın).
- Ölçüm: Playwright testinde her dokunma alanı için "dokunuştan ilk görsel değişime" süre (hedef bir kare, ~16 ms) ve sesin tetiklendiği; ekran görüntüsünde parçacık sayısı sınırı.

**A6. Doğramayı (10 dokunuş) tatmin edici bir ritim oyununa çevir.**
- Ne: her dokunuşta bıçak sesi bir basamak yukarı (10 basamaklı bir gam, son dokunuş en tiz); patates gözle görülür küçülür, dilimler yana düşer; 10. dokunuşta kısa "tamam" akoru, çubuklar fritöze düşerken yağ tıslaması (whoosh değil). Kural aynı: 10 dokunuş.
- Neden: tekrar eden dokunuşu bir ilerleme melodisine çevirmek; Shawarma Legend'de en çok şikâyet "çok tıklama, elim uyuştu" [3]. Tıklamayı azaltamıyorsak (Eymen'in kuralı) en azından her tıklamayı ödüllendirelim.
- Ölçüm: Eymen'e "doğrama sıkıcı mı" diye 1–5 puan, önce/sonra.

**A7. Müşteri tepkisi tek görselle: hareket, ses, parçacık.**
- Ne (yeni karara göre, yüz ifadesi yok):
  - Geliş: aşağıdan yukarı hafif zıplayarak girer, kısa "selam" sesi (insan sesi ya da tahta zil).
  - Bekleme: hafif nefes alma (dikey %2 ölçek, 2 sn), sipariş baloncuğu yumuşak sallanır. Sabır çubuğu yeşilden kırmızıya akar; son %25'te çubuk ve baloncuk hafifçe titrer, kısık bir tik-tak başlar (görsel ifade değil, gösterge dili).
  - Teslim: müşteri yukarı zıplar (squash/stretch), başının üstünden konfeti/yıldız parçacıkları (kendi SVG'miz), memnun bir "mmm" ya da gülme sesi; sabır yüksekse daha büyük zıplama ve daha çok parçacık, bahşiş bozuklukları ayrıca uçar. Sabır ortadaysa küçük baş sallama, az parçacık.
  - Süre dolunca: tepki yok, müşteri yavaşça yana kayıp solar, alçalan iki yumuşak nota. Ceza sesi bağırmaz.
- Neden: tek görsel kararıyla yüz ifadesi gidiyor; "ne olduğunu" hareket ve ses anlatmalı. Good Pizza ve Shawarma Legend'de müşteriler oyunun kişiliği [9][19].
- Ölçüm: 20 karakterin her biri yeşil ekrandan kırpılınca (`tools/musteri/` benzeri betik) aynı tepki animasyonunun hepsinde düzgün çalıştığı ekran görüntüsüyle denetlenir.
- Not: `docs/TASARIM.md` ve `veri.js`'teki "mutlu/somurtkan/kızgın" ödeme kuralları sabır oranına göre çalışmaya devam edebilir; yalnız ekranda yüz yerine bu hareketler oynar. Kızgın teslimde "ödemez" kuralı yüz olmadan anlaşılmayabilir, **Eymen'e sor** (B5).

**A8. "Burger kapandı" anını büyüt (küçük durma anı).**
- Ne: üst ekmek oturunca 60–80 ms her şey durur (hit-stop), sonra burger "pof" (`tamamB` var) + susam parçacıkları + tok bir akor; tepsiye konunca tahta tık. Teslimde müşteri zıplamadan önce 50 ms durma.
- Neden: önemli anı durarak vurgulamak [26].
- Ölçüm: oyun döngüsü durma sırasında sayaçları (sabır, ızgara) durdurmalı mı? Hayır: yalnız görsel animasyon durur, zamanlayıcılar devam eder; test bunu denetler.

**A9. Her yükseltme ekranda görünsün.**
- Ne: Hızlı ızgara alınınca ızgaranın altında daha parlak alev, ilk köftede "yeni" parıltısı; Sabırlı müşteri alınınca tezgâha küçük bir çiçek/menü panosu; Cömert bahşiş alınınca kasanın yanında bahşiş kavanozu belirir ve bahşiş oraya düşer. Satın alma anında kısa jingle + o nesneye kamera değil ışık.
- Neden: Burger Please eleştirisi: etkisi görünmeyen yükseltme hiç alınmamış gibi [24].
- Ölçüm: her yükseltme için önce/sonra ekran görüntüsü (`scripts/inceleme.cjs`).

**A10. Sonraki hedef hep görünsün ("bir gün daha").**
- Ne: gün sonu kartında ve ana menüde "3. ızgaraya 120 para kaldı" gibi ilerleme çubuğu; para akarken çubuk da dolar. Rekor gün (en çok bahşiş, en uzun seri) küçük bir "yeni rekor" rozetiyle kutlanır.
- Neden: uzun hedef ve başarı hissi tutundurmanın temeli [29][30]; "number go up" [38].
- Ölçüm: yerel kayıtta (yalnız cihaz) oturum başına oynanan gün sayısı; değişiklikten önce/sonra Eymen'in ve test edenlerin ortalaması.

**A11. İlk 60 saniye.**
- Ne: açılışta ilk müşteri 2 sn içinde gelsin; rehber (`tut3`) her adımı tek parlayan nesneyle göstersin, yazı az; ilk teslimde normalden büyük kutlama (para yağmuru, jingle). Haznelerin gün başında dolu olması (zaten var) çok iyi: ilk burger hemen yapılabiliyor.
- Neden: "oyuncu açar açmaz eğlenceli bir şey yapmalı, kendini başarılı hissetmeli" [29][30].
- Ölçüm: test-akis ile "açılıştan ilk paraya" süre (hedef < 45 sn yeni oyuncuda); rehberin her adımında kaç kişi takıldı (Eymen'in denettirdiği kişilerle).

**A12. Reklam (yayına geçince).**
- Ne: Shawarma Legend'in 1 numaralı şikâyeti reklam [1]. Yalnız ödüllü reklam (ör. gün sonunda "bahşişi ikiye katla") ve gün içinde asla reklam yok; geçiş reklamı en erken 3. günden sonra, birkaç günde bir. Kardeş oyunlarımızdaki `ktKarar` düzeni kullanılabilir.
- Ölçüm: oturum uzunluğu ve ertesi gün geri gelme (yalnız cihazda).

### B. Kuralı değiştirenler (Eymen'e sor)

| # | Öneri | Neden (kaynak) | Hangi kurala dokunuyor |
|---|---|---|---|
| B1 | **"Dokunuşu azaltan" yükseltmeler**: örn. "Keskin bıçak" doğramayı 10'dan 7'ye, sonra 5'e indirir; "Patates kepçesi" fritözden hazneye kendiliğinden alır; "Tepsi yardımcısı" biten burgeri boş tepsiye kendiliğinden koyar. | Shawarma Legend'in bütün ilerleme hissi bu [5][6]. Bizim dükkânda yalnız 2 ızgara kilidi ve 3 sayısal geliştirme var; `DENGE.md` de "satılacak şey az" diyor. | 10 doğrama, tepsi akışı |
| B2 | **Para tezgâhta birikir, dokunarak toplanır** (gün sonunda toplanmayan para kaybolmaz, kendiliğinden kasaya gider; yükseltmeyle otomatik toplanır). | Shawarma Legend'in en sevilen "küçük işi" [6][13]; ama Eymen'in akışına bir dokunuş ekler. | Ödeme akışı |
| B3 | **Komik bir "baş belası"** (ör. ara sıra gelip patates kapan bir kedi ya da martı; dokununca kaçar ve bırakır). | Hırsız/dilenci oyuncuları uyanık tutuyor ve video malzemesi oluyor [1][7][9]; yalnız 10. günden sonra, seyrek. | Yeni mekanik |
| B4 | **Sipariş çeşitlenmesi** (ör. 5. günden sonra bazı müşteriler turşusuz ister ya da patatessiz). | Papa's ve Shawarma Legend'de çeşit seviye atladıkça açılıyor [6][21]; "herkes aynı" kuralı bot raporunda "düşünme yok, iş hızı belirleyici" diye geçiyor (`DENGE.md`). | "Herkes aynı sipariş" |
| B5 | **Cezayı hafiflet**: süre dolup giden müşteri can götürmesin, yalnız satış kaçsın; ya da kızgın teslimde "ödemez" yerine "bahşiş yok". Yüz ifadesi kalkınca "neden ödemedi" anlaşılmayabilir. | Shawarma Legend'de kaçan müşterinin cezası yok [6][13]; Good Pizza sakin [19]. | Can ve ödeme kuralları |
| B6 | **Dekor yükseltmesi = fiyat +1** (tabela, lamba, saksı; her biri tam sayı +1 para). Görünür ve basit. | Shawarma Legend'de "fırça" yükseltmesi [5][6]. | Ekonomi (`DENGE.md` yeniden çalıştırılır) |
| B7 | **Sözlü imza şarkısı** (Eymen'in sesiyle ya da yapay zekâyla). | Shawarma Legend'in patlama nedeni [7][8][9]; yapay zekâ seçeneğinde lisans ve oyuncu tepkisi riski [3]. | Ses kimliği, lisans |

---

## 5. Kaynakça

Shawarma Legend
1. App Store: Shawarma Legend (açıklama, sürüm geçmişi, uygulama içi satın almalar, yorumlar). https://apps.apple.com/us/app/-/id6479530421
2. Steam mağaza sayfası: Shawarma Legend. https://store.steampowered.com/app/3036080/Shawarma_Legend
3. Steam kullanıcı incelemeleri (en faydalı). https://steamcommunity.com/app/3036080/reviews/?browsefilter=toprated
4. BlueStacks: Döner Efsanesi / Shawarma Legend (Patates Games). https://www.bluestacks.com/apps/simulation/doner-efsanesi-on-pc.html
5. Grind n Strat: Shawarma Legend Upgrades Guide (yükseltmeler ve fiyatlar). https://grindnstrat.com/shawarma-legend-upgrades
6. Steam rehberi (Çince): 游戏系统介绍和科技树具体介绍 (oyun sistemleri ve yükseltme ağacı). https://steamcommunity.com/sharedfiles/filedetails/?id=3341305528
7. 17173: 沙威玛传奇 爆火 (oynanış, hırsız ve dilenci, şarkı, 2,53 milyar izlenme). https://news.17173.com/content/10152024/093317687.shtml
8. Jiemian (界面新闻): Shawarma Legend'in yapay zekâ müziği ve indirme sayıları. https://m.jiemian.com/article/11935940.html
9. Digitaling: 沙威玛传奇 neden yayıldı (yerelleştirme, şarkı, karakterler, tarihçe). https://www.digitaling.com/articles/1274685.html
10. NetEase 163: 沙威玛传奇 "3A" (oynanış, 14 dilde seslendirme, Suno şarkısı). https://m.163.com/dy/article/JFRPEHJ90530SFP3.html
11. TapTap rehber listesi (yükseltme sırası tartışmaları). https://www.taptap.cn/app/723122/strategy/entity/32316898
12. Steam tartışması: Shirrak3, tüm yükseltmelerden sonra geri bildirim (dilenci, ızgara, kurabiye). https://steamcommunity.com/app/3036080/discussions/0/4843148394001449862
13. 18183 rehberi: para toplama, dilenci 10. gün, hırsız 20. gün, kötü dürüm. https://www.18183.com/gonglue/202410/f3h06v18.html
14. TapTap rehber: fiyatlar, dürüm bileşimi, 50.000 hedefi, gün sayıları. https://www.taptap.cn/app/723122/strategy/entity/13666358
- Ek okuma: Gcores kültür yazısı https://www.gcores.com/articles/189510 ; Huxiu https://m.huxiu.com/article/3629076.html ; TapTap video rehberi https://www.taptap.cn/app/723122/strategy/entity/32316900 ; Steam rehber listesi https://steamcommunity.com/app/3036080/guides/

Oyun hissi ve juice
15. Jonasson & Purho, "Juice It or Lose It", GDC Europe 2012 (GDC Vault). https://gdcvault.com/play/1016487/Juice-It-or-Lose
16. Pichlmair & Johansen, "Designing Game Feel: A Survey" (2020, PDF; Swink'in tanımı, juice/tuning/streamlining, Kao 2020 bulgusu). https://arxiv.org/pdf/2011.09201
17. Juul & Begy, "Good Feedback for bad Players? A preliminary Study of 'juicy' Interface feedback" (FDG/DiGRA 2016, PDF). https://www.jesperjuul.net/text/juiciness.pdf
- Ek okuma: Jan Willem Nijman "The Art of Screenshake" özeti, Game Developer: https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games ; Folmer Kelly "Don't Juice It or Lose It" (GDC 2014): https://gdcvault.com/play/1020861/Don-t-Juice-It-or ; Steve Swink, *Game Feel* (2009, kitap; [16] içinde özetleniyor).

Ses
18. Belcher, "Why Candy Crush Saga is so engaging: an audio breakdown", Game Developer. https://www.gamedeveloper.com/audio/why-candy-crush-saga-is-so-engaging-an-audio-breakdown
20. Dixon ve ark., "The Impact of Sound in Modern Multiline Video Slot Machine Play" (J Gambling Studies, 2014). https://pmc.ncbi.nlm.nih.gov/articles/PMC4225056/
26. Sakurai, hit-stop: Famitsu sütunu çevirisi (Source Gaming) https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/ ve video özeti https://www.gonintendo.com/contents/13581-sakurai-s-latest-game-dev-video-features-8-hit-stop-techniques
27. Müzik temposu ve performans: Cassidy & MacDonald (sürüş oyunu) https://www.research.ed.ac.uk/en/publications/the-effects-of-music-on-time-perception-and-performance-in-a-driv/ ; Schubhan ve ark. 2024 (Tetris) https://umtl.cs.uni-saarland.de/paper_preprints/Schubhan2024Tetris.pdf
31. Winifred Phillips, "Pure vertical layering for game music composers" (GDC 2021 dizisi), Game Developer. https://www.gamedeveloper.com/game-platforms/pure-vertical-layering-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-
32. Designing Sound: Andy Farnell ile prosedürel ses röportajı https://designingsound.org/2012/01/18/procedural-audio-interview-with-andy-farnell/ ve "What's the deal with procedural game audio" https://designingsound.org/2014/10/whats-the-deal-with-procedural-game-audio/

Ses ve müzik kaynakları (lisans)
33. Kenney ses paketleri (CC0): Casino Audio https://kenney.nl/assets/casino-audio , Impact Sounds https://kenney.nl/assets/impact-sounds , Interface Sounds https://kenney.nl/assets/interface-sounds , Music Jingles https://kenney.nl/assets/music-jingles , hepsi https://kenney.nl/assets/category:Audio
34. Freesound (lisans süzgeci CC0 ile arama). https://freesound.org/search/?q=sizzle&f=license:%22Creative+Commons+0%22
35. OpenGameArt CC0 döngüler: Happy Clappy Loop https://opengameart.org/content/happy-clappy-loop , Shop Theme https://opengameart.org/content/shop-theme , Happy Adventure Loop (MP3 döngü uyarısı) https://opengameart.org/content/happy-adventure-loop
36. Pixabay İçerik Lisansı özeti. https://pixabay.com/service/license-summary/
37. Incompetech (Kevin MacLeod) lisanslar. https://incompetech.com/music/royalty-free/licenses/

Diğer yemek/servis oyunları ve mobil tasarım
19. Game Developer: "Good Pizza, Great Pizza would not exist if not for Costco". https://www.gamedeveloper.com/design/good-pizza-great-pizza-would-not-exist-if-not-for-costco ; tarihçe ve tutundurma (DAU 1.000 → 30.000): https://en.wikipedia.org/wiki/Good_Pizza,_Great_Pizza
21. Flipline: Papa's Pizzeria SSS (istasyon puanları, bahşiş). https://i.flipline.com/games/papaspizzeria/faq.html
22. Flipline blog (istasyon tasarımı üzerine). https://www.flipline.com/blog/archives/author/flipline_matt/page/18
23. MCV: The Develop Post-Mortem: Overcooked. https://mcvuk.com/the-develop-post-mortem-overcooked/
24. Udonis: Burger Please (döngü, reklam yerleri, eleştiri). https://blog.udonis.co/mobile-marketing/mobile-games/burger-please ; PocketGamer.biz Supercent vaka çalışması: https://www.pocketgamer.biz/case-study-how-supercents-games-made-it-to-the-top-in-a-stagnating-hypercasual-market/
25. SayGames: My Perfect Hotel https://blog.say.games/posts/my-perfect-hotel-saygames-latest-hybrid-casual-hit-becomes-the-most-downloaded-game-in-the-world ; Udonis: https://blog.udonis.co/mobile-marketing/mobile-games/my-perfect-hotel
28. App Store: Cooking Fever (kullanıcı yorumları: elmas darboğazı, zorluk). https://apps.apple.com/gb/app/cooking-fever/id714796093 ; Cooking Mama (dokunmatik mini oyunlar, eleştiriler): https://en.wikipedia.org/wiki/Cooking_Mama_(video_game)
29. GameAnalytics: Tips for a great FTUE in F2P games. https://gameanalytics.com/blog/tips-for-a-great-first-time-user-experience-ftue-in-f2p-games ; GameAnalytics 2025 kıyas raporu (2024 verisi: D1 üst %25 ≈ %27, D7 ortanca ≈ %3,5–4): https://investgame.net/wp-content/uploads/2025/02/2025-GameAnalytics-Mobile-Gaming-Benchmarks.pdf
30. Unity: 10 first-time user experience tips. https://unity.com/how-to/10-first-time-user-experience-tips-games
38. Envato Tuts+: "Numbers getting bigger: what are incremental games and why are they fun". https://code.tutsplus.com/numbers-getting-bigger-what-are-incremental-games-and-why-are-they-fun--cms-23925a

Not: YouTube oynanış videolarının sayfalarına ve transkriptlerine bu ortamdan erişilemedi (arama sayfası boş döndü). Shawarma Legend'in adım adım akışı bu yüzden rehberlerden ve yazılardan birleştirildi; ekran yerleşimi ve ilk 5 dakika "tahmin" olarak işaretli. Eymen oyunu telefonda açıp ilk 5 dakikayı ekran kaydıyla çekerse bu bölüm kesinleştirilebilir.
