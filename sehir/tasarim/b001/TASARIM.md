# b001 · "İki Irmak Arası" · doğuş bölgesi tasarım planı

Baş tasarımcının planı. Dört uzman bu belgeyi + `tasarim/KILAVUZ.md` + `docs/HARITA_TASARIM.md` okuyup **aynı anda**, yalnız kendi dosyasında çalışır.
İskelet (`bolge.js`) yazıldı ve çalışıyor; bu belgedeki bütün koordinatlar iskelet uygulanmış araziden ölçüldü (16 Kasım 2026).
Koordinat: metre, +x doğu, −z kuzey. Yön: pusula (0 kuzey, 90 doğu). Yükseklikler y (su = 0).

Hızlı bakış: `node test/kusbakisi.cjs --bolge b001 --cikti /tmp/b001.png` · `node test/manzara.cjs --nokta dogus --pano 8 --cikti /tmp/pano.png`

---

## 1. Fikir ve duygu

**Bir cümle:** iki ırmağın sardığı, güneyden iki kolun kucakladığı yeşil bir çanak; ortasında göl, karşı kıyıda sivri bir doruk.

Oyuncu güney yamacının dibinde, alçak bir sekide doğar ve kuzeye bakar. Önünde her şey aşağıda ve açık: solda göl, önde dere ve ırmağın dirseği, ırmağın ardında Nal Tepe'nin sivri doruğu. İki yanında ormanlık iki kol (Orta Sırt, Çanak kolu), arkasında uçurumlu bir seki (Yar). Korunaklı bir avuç içi; ama avucun dört yanında birer aralık var ve her aralığın ardı görünmüyor.

İlk 10 dakikada sırasıyla hissedilecekler:

| Süre | Oyuncu ne yapar | Ne hisseder |
|---|---|---|
| 0–20 sn | çevresine bakar; 10–30 m içinde dal, taş, ilk ağaçlar | "burası güvenli, elimin altında her şey var" |
| 20–60 sn | göl kıyısındaki düzlüğü (Göl Başı) ve ırmak dirseğindeki düzlüğü (Dere Ağzı) görür | "şuraya yerleşebilirim… ya da şuraya" |
| 1–3 dk | Seki altı çatalında üç yoldan birini seçer (göl / ırmak / yar rampası) | ilk anlamlı rota seçimi |
| 3–6 dk | arkasındaki uçurumu, karşıdaki doruğu, doğudaki kolun ardını merak eder | "şu sekinin üstü nasıl? karşıya nasıl geçerim? şu kolun arkasında ne var?" |
| 6–10 dk | bir tepeye çıkar (Yar, Orta Sırt ya da Nal) ve doğuştan görünmeyen yerleri görür | "burası sandığımdan büyükmüş" → yerleşim kararını yeniden düşünür |

**"Nereye yerleşsem" sorusu** gerçek bir ödünleşim olmalı: en yakın yer (Göl Başı) en açık ve en az taşlı olanı; en güzel manzaralı yer (Yar Sekisi) suya en uzak olanı; en korunaklı yer (Saklı Çanak) gizli ve ancak arayan bulur; en çok odun olan yer (Koru Açıklığı) en uzakta. Hiçbir alan her şeyde birinci değildir (§ 5 tablosu).

**Ne DEĞİL:** dört yanı duvar bir krater değil (halka sıradağ yasak). Çanağı kapatan şey, güney sırtından inen **iki ayrı kol** ve kuzeyde **ırmak**; kuzey tamamen açık ve manzara oradan gelir.

---

## 2. Sınır ve komşu coğrafya

**Sınır (çokgen, ≈ 4,3 km²), geçiş bandı 150 m:**
`(840,−600) (1450,−720) (1860,−610) (2040,−340) (2180,80) (2320,380) (2320,1250) (2200,1860) (1300,1900) (620,1860) (260,1560) (140,1150) (330,690) (720,380) (790,−200)`

**Taban: prosedürel, aynen (çarpan 1).** İki ırmak algoritmadan geliyor ve sınırda kopmadan sürüyor; sınırda yükseklik farkı sıfır. Tasarım, prosedürel arazinin ÜSTÜNE eklenen şekillerdir. Sonuç: geçiş bandında yalnız eklediğimiz şekiller silikleşir; **bandın içine (sınırdan 150 m) önemli hiçbir şey konmaz.**

`varsayilan: 0`: bölgede prosedürel ağaç/kaya YOK; her nesne tasarlanır. `engebe` yok (ırmak yatağını bozar). `mikro: .45 m`.

**Komşular (bölge dışı, prosedürel):**

| Yön | Ne var | Bölgeden nasıl görünür |
|---|---|---|
| Kuzey | Batı Irmağı'nın ötesinde 100–145 m'lik ormanlı yaylalar (ileride orman biyomu) | Koru Tepesi'nin ardında soluk sırtlar |
| Kuzeydoğu / doğu | Nal Tepe'nin arkasındaki büyük kütle (125 m), ırmağın doğu kolu, 3 km ötede ırmak kavşağı, 5 km ötede deniz körfezi | yalnız Nal doruğundan |
| Güneydoğu | Güneydoğu ırmağının vadisi (x ≈ 2150, z 1400–2200), ardında alçak ovalar | Güney Boğazı'nı aşınca |
| Güney | Güney Sırtı'nın doruk çizgisi (z ≈ 1900–2100, 100–135 m) | çanaktan yalnız Kartal Kayası; sırt çizgisi ufku kapatır |
| Batı | Batı Irmağı'nın karşı kıyısında dik yar ve 70–125 m'lik plato (uzakta karlı dağlar) | Orta Sırt'tan ve Batı terasından |

**Dört doğal çıkış** (hiçbiri koridor değil; hepsi arazinin kendi aralığı):

| Çıkış | Yer | Nitelik | Nereye |
|---|---|---|---|
| **Kuzey Boynu** | (1545, −400) | iki ırmak arasında 450 m'lik, 30–60 m'ye yükselen kara boynu; suya girmeden çıkılır | kuzey yaylaları / orman |
| **Batı Sığlığı** | (590, 790) | Batı Irmağı'nda yürünerek geçilen sığlık; karşıda 30 m'lik teras | batı platosu |
| **Güney Boğazı** | (1680, 1562) | güney sırtında eşiği 48 m olan geçit (çanaktan 35 m tırmanış) | güneydoğu ırmak vadisi, güney ovaları |
| **Kıstak** | (2000, 852) | Doğu Tepe'nin dik eteğiyle ırmak arasında 300 m'lik dar kıyı yolu | ırmak boyu doğuya, kavşağa ve denize |

Ayrıca her ırmak yüzülerek her yerden geçilebilir (50–70 m, ≈ 40–50 sn): riskli/kestirme güzergâh budur.

**Ufuk hedefleri:** nesneler 440 m'den öte çizilmediği için (bkz. § 10) uzak hedefler **arazi biçimidir**: Nal Tepe doruğu (≈ 180 m; doğuştan 31°, 745 m), Kartal Kayası (≈ 110 m), Koru Tepesi (≈ 57 m, kuzey ufku).

---

## 3. Yükselti iskeleti (`bolge.js`'te, hazır)

"Odalar": bölge, birbirinden sırt/ırmak/tepecikle ayrılan sekiz odadan oluşur. Her oda 250–500 m'dir; hiçbir odadan komşusunun tamamı görünmez.

| Oda | Kapsam (yaklaşık) | Yükseklik | Karakter |
|---|---|---|---|
| O1 Doğuş çanağı | x 1050–1620, z 880–1300 | 1–20 m | göl, dere, çayır; bölgenin kalbi |
| O2 Batı terası | x 430–720, z 820–1380 | 12–27 m | Batı Irmağı'nın 15 m üstünde, karşı yara bakan çayır teras |
| O3 Boğaz çayırı | x 1000–1300, z 250–800 | 2–18 m | iki ırmak arasında alçak boyun |
| O4 Ulu Koru (kuzey dili) | x 1000–1500, z −480–230 | 10–57 m | sık orman, tepesi ve açıklığıyla |
| O5 Güney yamaçları | x 850–1650, z 1300–1700 | 20–110 m | Yar sekisi, Kartal Kayası, çam |
| O6 Saklı Çanak | x 1700–1880, z 1020–1260 | 22–30 m | asılı, gizli çanak |
| O7 Doğu yamacı + Kıstak | x 1850–2170, z 800–1450 | 5–100 m | ormanlı yamaç, dar kıyı yolu |
| O8 Nal Tepe | x 1400–2050, z 300–900 | 0–180 m | ırmağın sardığı sivri doruk; "karşı kıyı" |

**Büyük formlar** (hepsi `bolge.js`, katman `bolge`, sıra 0; uzmanlar bunları DEĞİŞTİRMEZ, üstüne işler):

| # | Ad | İlkel | Yer | Sonuç |
|---|---|---|---|---|
| 1 | Nal Tepe gövdesi + doruğu | `tepe` + `sirt` (sivri) | sırt (1640,715)→(1835,545)→(2000,330); yan kol kuzeye (1795,445) | doruk ≈ 180 m (1805,553); sırt GB–KD; güney yüzü dik |
| 2 | Orta Sırt | `sirt` | (850,1410)→(800,1150)→(790,1020)→(748,800) | ≈ 70 m; güney sırtından kuzeye inen batı kolu |
| 3 | Çanak kolu + Saklı Çanak tabanı | `sirt` + eksi `tepe` | kol (1655,1380)→(1640,1150)→(1688,1052)→(1812,958); çanak (1778,1150) | kol 50–55 m, çanak tabanı 22–26 m; ağız KD'de (1825,1005) |
| 4 | Yar burnu | `tepe` (plato) | (1210,1410), 180 × 95 m | üstü 55–67 m; çanak tabanından 45 m yüksek |
| 5 | Kartal Kayası | `sirt` (sivri) | (900,1640)→(1110,1625)→(1290,1662) | ≈ 110 m sivri doruk |
| 6 | Güney Boğazı | `vadi` (kot 48) | (1520,1462)→(1675,1562)→(1900,1665) | eşik 48 m; doğu ucunda 20 m'lik iniş |
| 7 | Koru Tepesi | `tepe` | (1195,−285), 235 × 190 m | ≈ 57 m |
| 8 | Boğaz tümseği | `tepe` (sivri) | (1150,425) | ≈ 20 m; boynu iki yola ayırır |
| 9 | Göl Tepeciği | `tepe` | (1175,895), 150 × 105 m | ≈ 20–25 m; gölü Boğaz'dan ayırır |
| 10 | Göl çanağı | `vadi` (kot 1) | (1165,1085)→(1310,1050) | taban ≈ +1 m; göl buraya |
| 11 | Doğuş sekisi + doğuş düzlüğü | `tepe` (plato) + `duzluk` (sıra 36) | (1420,1190) | y ≈ 13,4; çanak tabanından 6–8 m yüksek |

Doğal (prosedürel) olarak zaten var ve korunuyor: iki ırmak, güney sırtının ana yamacı, Doğu Tepe (2250,900; ≈ 105 m, bandın içinde), Batı Irmağı'nın karşı yarı (x ≈ 300, z 1000–1450).

---

## 4. Su (kural: yüzey her yerde y = 0)

| Su | Durum | Yer |
|---|---|---|
| **Batı Irmağı** | prosedürel, dokunulmaz | (1050,−550) → (960,0) → (900,450) → (680,720) → (590,790) → (400,1000) → (330,1250) → (420,1550) → batı. 50–70 m geniş, 2,8 m derin |
| **Nal Irmağı** (doğu ırmağı) | prosedürel, dokunulmaz | (1900,−430) → (1600,−50) → (1450,180) → (1300,480) → (1350,700) → (1440,840) → (1560,895) → (1850,880) → (2000,800) → (2100,600) → doğu |
| **Ayna Göl** | YENİ (`su.js`) | çanağın en alçak yeri; ≈ 230 × 130 m; köşeler: (1105,1075) (1140,1030) (1210,1012) (1290,1020) (1335,1055) (1325,1105) (1270,1140) (1190,1150) (1125,1125). Ortasında adacık (1215,1078) |
| **Göl Ayağı** (dere) | YENİ (`su.js`) | gölden ırmağa: (1328,1052) → (1368,1010) → (1402,962) → (1436,918) → (1468,890). 8–9 m geniş, 0,55 m derin: her yerinden yürünerek geçilir |
| **Sığlıklar** | YENİ (`su.js`) | Batı Sığlığı (590,790) · Dirsek Sığlığı (1560,895) · Nal Sığlığı (1305,479) |
| Kuru dere | YENİ (`arazi.js`, `oluk`) | Güney Boğazı ağzından göle inen kuru yatak: (1500,1440) → (1440,1345) → (1375,1250) → (1340,1170) → (1322,1110). Su yok (yüksekte su olmaz); çakıl, çalı, taş |

Yüksekte nehir/göl/şelale YOK. Saklı Çanak (22 m) ve Yar Sekisi (60 m) bilerek susuzdur.

---

## 5. Doğuş ve altı yerleşim alanı

### Doğuş: (1420, 1190), y 13,4, yön 8° (kuzey, hafif doğu)

İlk kare (yatay görüş ≈ ±45°): **ortada** çayırdan aşağı inen patika, 230 m ötede dere geçidi ve ırmağın dirseği; **sağda** (31°) Nal Tepe doruğu, eteğinde ırmak kıyısındaki İğne kaya (24°, 415 m); **solda** (328°, 145 m) göl ayağındaki Ulu Çınar ve gölün doğu ucu, onun önünde Göl Başı düzlüğü; **en solda** Göl Tepeciği'nin korusu ve arkasında Boğaz'ın aralığı. Ön planda 15–30 m içinde: sağda Seki korusunun ilk ağaçları ve yamaç dibi taşları, yerde dal ve taş.
Arkasını dönünce (GB 230°, 300 m): Yar'ın uçurum yüzü ve üstündeki Yar dişi; "şunun üstüne çıkılır mı?"

**Doğuşun 40 m çevresi baş tasarımcınındır:** şekil (arazi/su/düzlük) yazılmaz. Yalnız `bitki.js` nesne koyar (aşağıdaki Seki korusu) ve `su.js`'in patikası doğuştan başlar. Doğuşun 9 m çevresi kendiliğinden nesnesizdir.

### Yerleşim alanları (noktalar `bolge.js`'te tanımlı: y1…y6; düzlükleri `yerlesim.js` kurar)

Ortak ölçü: içi eğimi < %6 olan **en az 3500 m²** (≈ 70 × 55 m), biçimi daire değil doğal (böbrek, damla, yay); `kenar` 25–40 m.

| id | Ad | Merkez | y | Karakter | Su | Ağaç (≤ 150 m) | Taş (≤ 150 m) | Güçlü yanı | Zayıf yanı | Doğuştan (koşu) | Doğuştan görünür |
|---|---|---|---|---|---|---|---|---|---|---|---|
| y2 | **Göl Başı** | (1368,1122) | 4,5 | göl kıyısı düzlüğü | göl 25 m, dere 60 m | orta (Seki korusu, Ulu Çınar) | az (yamaç dibi 120 m) | en yakın; göl; doğuşla göz göze | açık, taş uzak | 23 sn | evet |
| y1 | **Dere Ağzı** | (1345,905) | 5,5 | ırmak dirseği + dere ağzı düzlüğü | ırmak 45 m, dere 55 m | orta (Göl Tepeciği korusu 100 m) | çok (ırmak kıyısı taşlığı) | iki su, sığlık yanında, her yola yakın | en açık yer; karşı kıyıdan görülür | 86 sn | evet |
| y3 | **Yar Sekisi** | (1195,1425) | 60 | uçurum üstü plato | yok (göl 250 m, 55 m aşağıda) | orta (arkada çamlık) | çok (uçurum, kayalık) | manzara, savunma, tek girişli | susuz, her iş inip çıkmak | 90 sn | evet (üstü değil, yüzü) |
| y4 | **Saklı Çanak** | (1775,1150) | 23,5 | korunaklı asılı çanak | ırmak 200 m (ağızdan) | çok (çanağın yamaçları) | orta (kolun iç eteği) | üç yanı kapalı, gizli, sakin | görüş yok; suya yürünür | 1,7 dk | **hayır** |
| y6 | **Sığlık Başı** | (560,945) | 12 | geçit yanı ırmak terası | Batı Irmağı 60–80 m | orta (Orta Sırt batı yamacı) | çok (ırmak yarı, sığlık kayaları) | batı kapısı; karşı yar manzarası | doğuştan uzak, sırtın ardında | 4,4 dk | **hayır** |
| y5 | **Koru Açıklığı** | (1150,−30) | 27 | orman açıklığı | Batı Irmağı 180 m | en çok (Ulu Koru) | az (ırmak yarı 150 m) | odun bolluğu, kuzey kapısı | en uzak; taş az; ormanda görüş kısa | 6,1 dk | araziye göre evet, orman perdeler |

Yakın–orta–uzak kademesi bilinçlidir: 2 alan ilk dakikada (y2, y1), 2 alan iki dakikada (y3, y4), 2 alan keşifle (y6, y5).

---

## 6. Patika ağı (`su.js`; uçlar `bolge.js`'teki düğüm/geçit noktalarında buluşur)

Ana yol 3,5 m, yan patika 3 m (4 m'den dar şekil arazide kaybolur), keçi yolu 3 m ve `toprak: .5`. Çizgiler 80–150 m'de bir noktayla, kıvrımlı.

| # | Patika | Güzergâh (ana noktalar) | Not |
|---|---|---|---|
| P1 | **Ana yol (kuzey–güney)** | Kuzey Boynu (1545,−400) → (1400,−230) → Koru Açıklığı kenarı (1195,−20) → (1215,200) → Boğaz (1210,400) → Boğaz çatalı (1185,560) → (1265,730) → Dere Ağzı kenarı (1380,905) → Dere geçidi (1405,958) → Dirsek çatalı (1440,940) → (1435,1050) → Seki altı (1415,1150) → Doğuş (1420,1190) → Yar rampası başı (1395,1335) → (1520,1462) → Güney Boğazı (1680,1562) → (1900,1665) → (2040,1700) | bölgenin omurgası; Boğaz tümseğinin doğusundan geçer |
| P2 | **Irmak yolu (doğu)** | Dirsek çatalı (1440,940) → (1600,948) → (1750,952) → (1832,965) → (1930,925) → Kıstak (2000,852) → (2060,770) → (2140,640) | Kıstak'ta yamaca oyulur; bantta silikleşir |
| P3 | Çanak patikası (gizli) | (1832,965) → Çanak ağzı (1825,1005) → (1800,1080) → y4 (1775,1150) | ana yoldan ayrılışı belirsiz: ilk 40 m `toprak: .3` |
| P4 | **Göl–batı yolu** | Seki altı (1415,1150) → y2 (1368,1122) → göl ayağı (1338,1040) → Göl kuzeyi (1215,985) → (1050,965) → (900,865) → Sırt burnu (770,770) → (680,850) → y6 (560,945) | gölün kuzey kıyısını izler |
| P5 | Sığlık kolu (batı çıkışı) | Sırt burnu (770,770) → (660,790) → Batı Sığlığı (590,790) → (535,735) → (430,700) | karşı kıyıda bantta biter |
| P6 | **Yar rampası** | Yar rampası başı (1395,1335) → (1352,1395) → (1290,1428) → y3 (1195,1425) | `rampa: true`; Yar'a yürünen tek rahat yol |
| P7 | Yar keçi yolu (riskli kestirme) | göl güneyi (1190,1165) → (1150,1260) → (1085,1345) → (1110,1405) → y3 | uçurumun batı ucundan dik çıkış (%45–70) |
| P8 | Nal patikası | Dirsek Sığlığı kuzey kıyısı (1560,860) → (1612,790) → (1650,722) → (1740,635) → doruk (1800,560) | batı sırtından; son 100 m dik |
| P9 | Nal kuzey kolu | Boğaz çatalı (1185,560) → Nal Sığlığı (1305,479) → (1400,470) → (1560,470) → (1700,500) → doruk | P8 ile halka olur |
| P10 | Boğaz batı kolu | Boğaz çatalı (1185,560) → (1075,420) → (1040,200) → (1050,20) → Koru Açıklığı (1150,−30) | Batı Irmağı kıyısından; tümseğin batısı |
| P11 | Sırt patikası | Sırt burnu (770,770) → (772,895) → Orta Sırt seyri (797,1085) → Bel (812,1265) → (700,1300) → (560,1180) → y6 | Batı terasını dolaşan halka |
| P12 | Kartal izi | y3 (1195,1425) → (1150,1520) → Kartal Kayası (1110,1627) | silik (`toprak: .4`) |

**Seçim noktaları:** Seki altı (doğuştan 40 m: göl / ırmak / geri dönüp yar), Dirsek çatalı (kuzey / doğu / karşıya), Boğaz çatalı (üç yol), Sırt burnu (sığlık / teras / sırt).

**Gizli yerler (3):** (1) Saklı Çanak (y4). (2) **Kovuk**: Nal doruğunun kuzeydoğu ardında küçük çanak (1880,380); yalnız doruktan görünür; yıkık duvar + zengin taş. (3) **Göl adacığı** (1215,1078): 30 m yüzerek; tek ağaç, dal bolluğu.

---

## 7. İşaretler (landmark) ve görüş çizgileri

**Kural:** nesneler ≈ 440 m'den öte çizilmez. Uzak hedef = arazi biçimi (§ 2). İşaret NESNELERİ yakın yönlendirme içindir: her biri, görülmesi gereken noktaya **≤ 400 m** olmalı.

| id | Tür | Yer | Görülmesi gereken yer (uzaklık) | İşlevi |
|---|---|---|---|---|
| `ulu` | `devAgac` | (1345,1068), göl ayağının doğu kıyısı | doğuş (145 m), y1, göl çevresi | "göl ve ilk üs yeri burada"; suyun başında olduğu için doğal |
| `igne` | `sivriTas` | (1588,812), Nal eteğindeki kayalıkta | doğuş (415 m), y1 (260 m), ırmak yolu | Dirsek Sığlığı'nın karşı ucunu ve Nal patikasının başını gösterir |
| `yardisi` | `sivriTas` | (1118,1368), Yar'ın batı ucunda kenarda | doğuş (350 m), göl kıyısı | uçurum çizgisini ufukta işaretler: "orada bir şey var" |
| `kapi` | `tasKapi` | (1998,856), Kıstak yolunun üstünde, yola dik | Çanak ağzı kavşağı (180 m) | doğu çıkışının kapısı |
| `canakdikit` | `anitTas` | (1836,990), Çanak ağzının doğu yanında | ırmak yolu (30 m) | gizli patikanın tek ipucu |
| `canakduvar` | `yikikDuvar` | (1802,1118), çanağın içinde, düzlüğün kenarında | çanağa girince | ödül/hikâye: "burada biri yaşamış" |
| `bogazdikit` | `anitTas` | (1150,425), Boğaz tümseğinin tepesinde | Boğaz çatalı (140 m), Göl Tepeciği | boynun işareti; iki yolu ayırır |
| `ata` | `devAgac` | (1188,−108), Koru Açıklığı'nın kuzey kenarı | Boğaz (≈ 400 m; ormanın üstünden), açıklık | "ormanın içinde bir şey var" |
| `naldikit` | `anitTas` | (1806,556), Nal doruğu | Nal patikasının son 300 m'si | zirve ödülü |
| `kovukduvar` | `yikikDuvar` | (1880,380), Kovuk | yalnız doruktan | gizli yer |
| `gaga` | `sivriTas` | (1112,1622), Kartal Kayası doruğu | Yar Sekisi (200 m) | Yar'a çıkanın bir sonraki hedefi |
| `siglikdikit` | `anitTas` | (612,812), Batı Sığlığı'nın doğu ucu | Sırt burnu (160 m), y6 | sığlığın yerini gösterir |
| `guneydikit` | `anitTas` | (1592,1508), Güney Boğazı'nın kuzey ağzı | Yar rampası başı (260 m) | geçidin girişi |

Türler `arazi.js`'e bağlanana kadar yedek nesneyle görünür (kılavuz § 6); veriyi gerçek tür adıyla yazın.

### Görüş çizgileri tablosu

| Nereden | GÖRÜNMELİ | GİZLENMELİ (neyle) |
|---|---|---|
| **Doğuş** (1420,1190) | Nal doruğu, İğne, ırmak dirseği, göl doğu ucu + Ulu Çınar, y2, y1, Göl Tepeciği, Boğaz aralığı, Yar yüzü (arkada), Orta Sırt (batı), Çanak kolu (doğu) | Saklı Çanak (Çanak kolu) · Batı terası, Batı Irmağı, y6 (Orta Sırt) · Kartal Kayası (Yar burnu) · Kıstak (kolun burnu) · Güney Boğazı'nın içi (yamaç dönemeci) · Kovuk (doruk) · Kuzey Boynu (Koru Tepesi) |
| **Göl Başı** (y2) | gölün tamamı, adacık, Orta Sırt fonu, Yar yüzü (tam karşıda, güneyde) | ırmak (dere kıyısının sekisi ve Göl Tepeciği), Batı terası |
| **Dere Ağzı** (y1) | ırmak, karşıda İğne ve Nal yamacı, Kıstak yönü (doğu), Boğaz (kuzey) | göl (alçak eşik + koru), Saklı Çanak |
| **Yar Sekisi** (y3) | bütün Doğuş çanağı, göl, iki ırmak dirseği, Nal, Boğaz, Koru Tepesi; arkada Kartal Kayası | Saklı Çanak'ın tabanı (kolun sırtı; yalnız ağzı sezilir), Batı terası (Orta Sırt), güney ovaları (sırt çizgisi) |
| **Orta Sırt seyri** (797,1085) | iki yana birden: doğuda çanak ve göl, batıda teras, Batı Irmağı, karşı yar, Batı Sığlığı | Saklı Çanak, Kıstak, Kuzey Boynu |
| **Nal doruğu** (1805,553) | HER ŞEYİN özeti: çanak, Saklı Çanak'ın içi (ilk kez), Kıstak'ın ötesinde ırmağın doğu kolu, kuzeydoğu kütlesi, kuzey yaylaları, ayağının dibinde Kovuk | Batı terası (Orta Sırt), Güney Boğazı'nın ardı |
| **Boğaz** (1210,400) | iki ırmak birden (her iki yanda 150 m), güneyde çanak ve Yar, kuzeyde Koru Tepesi'nin ormanı, doğuda Nal'ın batı yüzü | Koru Açıklığı (orman), Kuzey Boynu (tepe) |
| **Koru Tepesi** (1197,−288) | Kuzey Boynu, kuzey yaylaları, iki ırmağın kuzey kolları | çanak (Boğaz tümseği + Göl Tepeciği yarı perdeler) |
| **Güney Boğazı eşiği** (1680,1562) | arkada çanağın bir dilimi; önde güneydoğu ırmak vadisi (ilk kez) | — |
| **Saklı Çanak** (y4) | yalnız gökyüzü, çanağın yamaçları, ağızdan bir dilim ırmak ve Nal'ın güney yüzü | geri kalan her şey |

Ölçülen (iskelet, ağaçsız): doğuştan görünen kara %31; görüş derinliği K 2060 m · KD 780 · D 260 · GD 535 · G 735 · GB 550 · B 690 · KB 2300. Her tepe en az bir yeni oda açar.

---

## 8. Kaynak bölgeleri, sakin bölgeler, ritim

**Kaya kuralı:** kaya ve büyük taş yalnız (a) ırmak/göl/dere kıyısında, (b) yamaç dibinde, (c) uçurum kenarı ve dibinde, (d) kuru dere yatağında. Çayırın ortasında tek kaya, tek ağaç YOK. Ağaç: koru olarak, su kenarında, tümsek/çukur kenarında, yamaçta. Tek ağaç ancak bir nedenle (su başı, kaya dibi, patika çatalı).

**Korular (`bitki.js`):**

| # | Koru | Alan | Yoğunluk · tür |
|---|---|---|---|
| K1 | **Ulu Koru** | kuzey dili: x 1020–1460, z −470…230 (Koru Açıklığı r 50 açık) | .40–.45 · yapraklı; tepede %30 çam |
| K2 | Göl Tepeciği korusu | (1175,895) çevresi, 130 × 90 m; güney etek göle iner | .30 · yapraklı + çalı |
| K3 | **Orta Koru** | Orta Sırt'ın iki yamacı: x 700–900, z 820–1400; doğu eteği göle doğru seyrelir | .38 · yapraklı, sırtta çam |
| K4 | **Seki korusu** | doğuşun doğu–güneydoğusu, yamaç dibi: (1450,1160)–(1500,1250) arası yay; **en yakın ağaç doğuşa 15–25 m** | .30 · yapraklı; 12–20 ağaç |
| K5 | Yar ardı çamlığı | x 1090–1330, z 1450–1570 | .30 · çam ağırlıklı |
| K6 | Çanak ormanı | Çanak kolunun sırtı ve çanağın iç yamaçları (taban açık) | .35 · karışık |
| K7 | Güney yamaç koruları | öbekler: (1380–1640, 1290–1440) ve (860–1050, 1390–1560) | .25 · karışık, `kume: .7` |
| K8 | Nal yamacı | batı ve kuzey yamaç seyrek çam (.12); güney yüzü ve doruk ÇIPLAK kaya; etekte ırmak boyu söğütlük | — |
| K9 | Batı terası öbekleri | 3–4 öbek, ırmak yarının kenarında ve tümsek yanında | .25, `kume: .8` |
| K10 | Doğu yamacı ormanı | x 1860–2150, z 1000–1420 | .35 · karışık |
| K11 | Kıyı şeritleri | iki ırmağın ve derenin kıyısında 15–30 m'lik kesik şeritler (çalı + yapraklı); sığlıklarda, y1 ve y6 önünde AÇIK | .2 |

**Taşlıklar (`yerlesim.js`, `taslik`):** T1 ırmak dirseği kıyısı (1405,850)–(1470,880) · T2 Seki yamaç dibi (1460,1245) r 28 (**en yakın kaya doğuşa ≤ 45 m**) · T3 Yar dibi (uçurumun `kayalar`'ı yetmezse) (1200,1325) şerit · T4 göl batı kıyısı (1108,1100) r 22 · T5 Dirsek Sığlığı iki ucu · T6 Batı Sığlığı iki ucu + Batı terası yar kenarı (440,1150) · T7 Çanak kolunun iç eteği (1700,1150) · T8 Kıstak yamaç dibi (2030,850) · T9 Boğaz tümseği eteği · T10 Koru Tepesi batı yarı (1010,−150) · T11 Güney Boğazı'nın iki yanı · T12 Nal eteği ve doruk çevresi · T13 kuru dere yatağı boyunca seyrek.

**Yerde dal/taş (`yerlesim.js`, `kaynak`):** doğuş çevresi şimdiden yeterli (50 m'de 9 dal, 6 taş); ek kümeler: Seki korusu (dal), T2 (taş), Göl Başı kenarı (dal), Dere Ağzı kıyısı (taş), adacık (dal), Kovuk (taş), Saklı Çanak (dal + taş).

**Sakin bölgeler (bilerek seyrek; yalnız çayır, tümsek, çiçek):** Boğaz çayırı (1050–1280, 500–800) · Doğu çayırı (1480–1610, 980–1260) · gölün güney kıyısı (1150–1320, 1150–1260) · Batı terasının ortası. Hiçbiri 200 m'den geniş olmamalı: kenarında koru/kıyı şeridi, içinde 1–2 tümsek.

**Ritim (ana yol boyunca, kuzeye):** doğuş [toplama] → 40 m çatal [seçim] → 230 m açık çayır [yolculuk, manzara] → dere geçidi + Dere Ağzı [su, taş, üs yeri] → 200 m ırmak kıyısı [toplama] → Boğaz çayırı [dinlenme, iki ırmak manzarası] → tümsek ve dikili taş [işaret, seçim] → Ulu Koru [kapalı, sık, odun] → açıklık [ferahlama, üs yeri] → Koru Tepesi ya da Kuzey Boynu [çıkış].

---

## 9. Ölçülebilir hedefler (b001)

Araç: `node test/olcum.cjs --bolge b001 --cikti /tmp/b001.md` (yol süreleri için § 10'daki uyarıya bakın) ve `test/yuru.cjs`.

| Hedef | Sayı | İskelette şimdi |
|---|---|---|
| İlk dal / taş (yerde) | ≤ 20 m (yürüyerek ≤ 13 sn) | 18 m / 12 m ✔ |
| İlk ağaç | ≤ 30 m (yürüyerek ≤ 20 sn) | yok (bitki.js) |
| İlk kaya | ≤ 45 m | yok (yerlesim.js T2) |
| İlk su | ≤ 110 m (koşu ≤ 30 sn) | 293 m (göl gelince ≈ 95 m) |
| İlk üs alanını görme / ulaşma | doğuştan ≥ 3 alan görünür; en yakını ≤ 30 sn koşu | 4 görünür; 23 sn ✔ |
| Gizli kalan yerleşim | ≥ 2 | 2 (y4, y6) ✔ |
| İlk keşif hedefi | doğuştan ≥ 2 arazi işareti + ≥ 2 nesne işareti (≤ 420 m) | arazi ✔; nesneler isaret.js |
| İlk rota seçimi | ≤ 60 sn içinde 3 kollu çatal (Seki altı, 40 m) | nokta var; patika su.js |
| Yerleşim | 6 alan; her biri ≥ 3500 m² düz (< %6); 150 m içinde ≥ 25 ağaç (y3: ≥ 15) ve ≥ 8 kaya (y5, y2: ≥ 4) | 6 nokta ✔; düzlükler yerlesim.js |
| Yerleşimlere süre (koşu) | y2 ≤ 30 sn · y1 ≤ 90 sn · y3 ≤ 110 sn · y4 ≤ 120 sn · y6 ≤ 4,5 dk · y5 ≤ 6,5 dk | 23 sn · 86 sn · 90 sn · 102 sn · 4,4 dk · 6,1 dk ✔ |
| Düzlük oranı | karanın **≤ %12**'si < %6 eğimli; **150 m yarıçaplı boş düzlük 0**; tümseksiz/ağaçsız düz yama ≤ 200 m | %9; 0 ✔ |
| Olaysız yürüyüş | hiçbir yürünür nokta en yakın ağaç/kaya/ilgi noktasına > 120 m değil; ana patikalarda `yuru` `en_uzun_bos_sn` ≤ 30 sn (koşu) | en çok 502 m (bitki.js) |
| Tek noktadan görüş | doğuştan görünen kara ≤ %40 | %31 ✔ |
| Geçilmez (> 45°) | karanın ≤ %1,5'i; kapalı cep 0 | %0,2; 0 ✔ |
| Erişim | bütün ilgi noktalarına yürüyerek (3 sığlık kurulunca "yalnız yüzerek" 0) | 4 nokta yalnız yüzerek (su.js) |
| Çıkış | 4 çıkışın her birine doğuştan yürüyerek ≤ 9 dk | Güney Boğazı 2,2 · Kıstak 3,3 · Batı Sığlığı 4,7 (sığlık kurulana dek son 60 m yüzerek) · Kuzey Boynu 8,2 dk ✔ |
| Sınır | banda (150 m) taşan tam güçte şekil yok; sınırda ırmak kesintisiz | ✔ |

---

## 10. İş bölümü

### Ortak kurallar
1. **Herkes yalnız kendi dosyasını yazar.** `bolge.js`'e ve başka katmana dokunulmaz. Bir değişiklik başka katmanı gerektiriyorsa raporunuza yazın (düzeltme turunda yapılır).
2. **`bolge.js`'teki noktalar hedeftir** (y1…y6, geçitler, düğümler, arazi işaretleri): şeklinizi o koordinata (± 20 m) kurun; **aynı noktayı kendi dosyanızda yeniden yazmayın** (ölçümde çift sayılır). Yalnız listede olmayan noktaları ekleyin.
3. **Uygulama sırası:** bolge 0 → arazi 10 → su 20 → yerlesim 30 → patikalar 32 (su.js'te ayrı çağrı) → doğuş düzlüğü 36 → bitki 40 → isaret 50. Sonraki, öncekinin üstüne işler. `y` verilmeyen düzlük ve patika, kendinden ÖNCEKİ her şeye göre yükseklik alır.
4. **Dokunulmaz yerler:** doğuşun 40 m çevresi (şekil yok) · prosedürel ırmak yatakları (yalnız su.js, yalnız üç sığlıkta) · sınırdan içeri 150 m (önemli hiçbir şey).
5. **Karşılıklı boşluklar** (aynı anda çalışıldığı için koordinatla sabitlendi): yerleşim dairelerinin (yarıçap + 25 m) içine arazi.js tümsek/uçurum, su.js su koymaz; göl çokgeninin 30 m çevresine arazi.js şekil koymaz; § 6'daki patika çizgilerinin 8 m yanına arazi.js `kaya_cikinti` ve dik uçurum koymaz (rampa gereken yer P6 ve Kıstak'tır).
6. Rastgelelik `SO.tasarim.rnd(tohum)`; işaret nesnelerine `id`.
7. Her uzman bitince: `kusbakisi --bolge b001`, kendi yerlerinin yakın planı (`--merkez x,z --genislik 500`, bir de `--egim`), `manzara --nokta dogus --pano 8`, `olcum`. Raporda: yaptıkları, koordinatla sapmalar, başka katmandan istekler.

### A · Arazi yontucusu → `tasarim/b001/arazi.js` (katman `arazi`, sıra 10)
Orta ve küçük arazi: ≤ 150 m ölçekli `tepe`, `ucurum`, `kaya_cikinti`, `oluk`/`vadi`, `cukur`, `teras`. Büyük formlar hazır; görev onlara **karakter** vermek ve düzlükleri bölmek.

| # | İş | Yer ve ölçü |
|---|---|---|
| A1 | **Yar uçurumu** | Yar burnunun kuzey kenarı boyunca `ucurum`: (1060,1372) → (1130,1352) → (1210,1345) → (1290,1352) → (1350,1376); güney yüksek (batıdan doğuya çizilirse `yan: 'sag'`); 14–18 m, `genislik` 6–8, `kayalar` 20–26. x > 1360 (rampa P6) ve batı uç (keçi yolu P7, x < 1090) açık kalır. Üstte y3 dairesine (r 70) şekil yok |
| A2 | **Nal Tepe kayalıkları** | güney/güneybatı yüzünde yarı yükseklikte kesik `ucurum` kuşakları (z 650–760, x 1680–1900; 10–16 m); doruk çevresinde 2–3 `kaya_cikinti`; **doruğa 12 m çaplı durulur yer** (1805,553). Batı sırtı (P8: (1650,722)→(1740,635)→doruk) ve kuzey yamaç (P9) ≤ %70 kalmalı. Etekte **İğne kayalığı**: `kaya_cikinti` (1588,812) r 16, 7 m |
| A3 | **Kovuk** (gizli) | doruğun KD ardında `cukur` (1880,380) r 35, 5 m; çevresi kaya; girişi doruktan inen dar oluk |
| A4 | **Kartal Kayası** | kuzey yüzünde `ucurum` (980,1610)→(1110,1590)→(1220,1612), 12–16 m; dorukta `kaya_cikinti`; güney sırtından çıkış (P12) açık |
| A5 | **Orta Sırt** | dorukta kayalık başlık (797,1090); doğu yüzünde 2 kısa yar; **Bel**: (812,1265)'te `oluk` ile eşiği ≈ 44 m'ye indir (P11 buradan aşar) |
| A6 | **Çanak ağzı kapı kayaları** | `kaya_cikinti` (1792,984) ve (1866,1012), 6–9 m; aralarında 35–40 m açıklık. Kolun dış (batı) yüzüne 1 kısa yar; çanağın içi yumuşak kalır |
| A7 | **Güney Boğazı** | taban cetvel gibi düz: 3–4 küçük `tepe` (±2 m) ve yanlarda 2 `kaya_cikinti` ((1700,1535), (1690,1598)) ile kır; doğu ucundaki dik inişi (1850–1930, 1640–1690) `oluk` ile ≤ %30'luk rampaya çevir |
| A8 | **Kuru dere** | `oluk`, `profil: 'v'`, 1,5–2,5 m derin, yarı genişlik 9–12: (1500,1440) → (1440,1345) → (1375,1250) → (1340,1170) → (1322,1110). Doğuşun 40 m'sine girmez |
| A9 | **Çanak tümsekleri** (düzlüğü böl) | 8–10 `tepe`, r 25–60, +2…+6 m, hepsi farklı: yaklaşık (1290,960) (1500,1060) (1550,1160) (1255,1235) (1045,1215) (1010,1010) (1120,690) (1235,640) (1085,545) (1270,300). Gerekirse 1–2 sığ `cukur`. Yerleşim daireleri, göl, dere ve patika çizgileri boş |
| A10 | **Kuzey dili** | Koru Tepesi dorukta kaya başlık; Batı Irmağı'na bakan **yar** (`ucurum` (1012,−260)→(1005,−120)→(1008,20), doğu yüksek, 8–10 m); Boğaz tümseğine `kaya_cikinti` (1150,425) r 14; açıklığın (y5, r 65) çevresi yumuşak |
| A11 | **Batı terası** | teras kenarını ırmağa bakan yara çevir: `ucurum` (455,1040)→(430,1160)→(420,1290), doğu yüksek, 8–12 m; terasta 3 tümsek ((610,1080) (540,1230) (650,1320)); y6 (r 65) ve sığlık inişi (P5) açık |
| A12 | **Kıstak** | yolun yamaç yanında `kaya_cikinti` (2035,842) ve kısa yar; ırmak yanı açık. x > 2170 banttır |
| A13 | Doğu yamacı / güney yamaç | 4–5 omuz ve sırtçık (`tepe`, kısa `sirt`) ile yamaçları tek düze olmaktan çıkar: (1950,1150) (2050,1280) (1560,1360) (940,1470) (1380,1520) |

Sınır: > 45° alan karanın %1,5'ini geçmesin; hiçbir ilgi noktası uçurumla kapanmasın (`olcum` § 5).

### B · Su ve patika → `tasarim/b001/su.js` (iki çağrı)
**Çağrı 1: katman `su` (sıra 20)**

| # | İş | Ayrıntı |
|---|---|---|
| S1 | **Ayna Göl** | `gol`, çokgen § 4'te; `derinlik` 3,5 · `sahanlik` 8 · `etki` 80 · `yamac` .12 (y2 ve doğuş sekisi alçalmasın) · `puruz` 5. Güney kıyı Yar'a doğru biraz daha dik olabilir |
| S2 | **Adacık** | gölden SONRA `tepe` (1215,1078) r 13, +3,8 m (üstü ≈ +1,5 m) |
| S3 | **Göl Ayağı deresi** | `nehir`, çizgi § 4'te; `genislik` 8–9 (ağızda 12) · `derinlik` .55 · `kiyi` 6 · `etki` 45 · `yamac` .2. **`sig` YAZMAYIN** (dere her yerde yürünür; "Dere geçidi" noktası bolge.js'te var, çift olur) |
| S4 | **Üç sığlık** | prosedürel ırmağın üstüne `duzluk`, `y: -.3`, `kenar: 12`, `zemin: 'cakil'` (denendi, çalışıyor). **Batı Sığlığı:** `[[553,765],[567,751],[632,815],[618,829]]`. **Dirsek Sığlığı:** `[[1550,862],[1570,862],[1570,928],[1550,928]]`. **Nal Sığlığı:** `[[1262,470],[1262,488],[1338,488],[1338,470]]`. Kenarları `puruz` olmadığından, uçlarına 1–2 küçük `tepe` (+.3) ile düzensizlik verin |
| S5 | Kıyı ayrıntısı (isteğe bağlı) | göl doğu ucunda küçük koy; ırmak iç dirseğinde (1420,860) çakıl dili (`duzluk y: .2`, `zemin: 'cakil'`, `bos: false`) |

**Çağrı 2: `katman: 'su', sira: 32`** (yerleşim düzlüklerinden SONRA uygulanır; patikalar düzlüklerin kenarına oturur)

| # | İş | Ayrıntı |
|---|---|---|
| S6 | **Patika ağı** | § 6'daki P1–P12, tablodaki genişliklerle. Uçlar `bolge.js` düğüm/geçit koordinatlarında birebir buluşur. P6 ve P2'nin Kıstak parçası `rampa`/yamaca oyma; P3'ün ilk 40 m'si ve P12 silik. Sığlıklarda patika suyun iki yanında biter (yatağa patika çizmeyin). Banda giren uçlar kendiliğinden silikleşir |
| S7 | Ek noktalar | yalnız listede olmayanlar: adacık (`isaret` değil `kaynak`), ek `dugum`ler (ör. Çanak kavşağı (1832,965), göl ayağı (1338,1040), Bel (812,1265)) |

Yerleşim düzlüklerinin `y` değerleri § 5 tablosundadır: patikalarınızı o yüksekliklere bağlanacak biçimde düşünün.

### C · Yerleşim ve kaynak → `tasarim/b001/yerlesim.js` (katman `yerlesim`, sıra 30)

| # | İş | Ayrıntı |
|---|---|---|
| Y1 | **Altı düzlük** | § 5 tablosundaki merkez ve `y` ile; her biri ≥ 3500 m², doğal biçimli çokgen. y1 Dere Ağzı ≈ 85 × 60 (uzun ekseni ırmağa koşut), `kenar` 30 · y2 Göl Başı ≈ 75 × 55 (göl çokgenine 12 m'den fazla yaklaşmaz; `y: 4.5`), `kenar` 28 · y3 Yar Sekisi `plato` ≈ 95 × 60, `y: 60`, `kenar` 30 (kuzey kenarı uçuruma 12 m) · y4 Saklı Çanak ≈ 85 × 65 oval, `y: 23.5`, `kenar` 35 · y5 Koru Açıklığı ≈ 80 × 65, `y: 27`, `kenar` 35 · y6 Sığlık Başı ≈ 75 × 55, `y: 12`, `kenar` 30. `zemin` yalnız y1'de `'toprak'` (hafif) |
| Y2 | **Küçük sekiler** (isteğe bağlı, nokta YAZMADAN) | 2–3 "ikinci üs" cebi: Boğaz çayırı (1140,640) r 22 · Nal batı omzu (1560,560) r 20 · Kartal altı (1010,1560) r 18. Ölçümde yerleşim sayılmaz; keşif ödülüdür |
| Y3 | **Taşlıklar** | § 8'deki T1–T13 (`taslik`; `yogunluk` .10–.18; yalnız kıyı / yamaç dibi / uçurum kenarı). T2 doğuşa en yakın kayayı ≤ 45 m'ye getirir. A1'in `ucurum.kayalar`'ı Yar dibini zaten doldurur: T3'ü ona göre seyrek tutun |
| Y4 | **Yerde dal/taş** | § 8'deki `kaynak` kümeleri (`dalEk`/`tasEk` .03–.07) + her biri için `kaynak` noktası |
| Y5 | **`yasak` alanları** | sığlık şeritleri ve iki ucu (r 14) · Çanak ağzı açıklığı (1829,1000) r 16 · Yar rampasının üst ucu · manzara noktaları (r 8) · doğuştan kuzeye bakış koridoru: (1420,1190)'dan 0–30° arasında 120 m'lik dilim (ilk kareyi ağaç kapatmasın). Düzlüklerin içi kendiliğinden boştur |

### D · Bitki örtüsü ve işaretler → `tasarim/b001/bitki.js` (sıra 40) + `tasarim/b001/isaret.js` (sıra 50)

| # | İş | Ayrıntı |
|---|---|---|
| B1 | **Korular** | § 8'deki K1–K11. Orman sınırı yönlendirir: Ulu Koru'nun güney kenarı Boğaz'da P1'e doğru huni yapar; Orta Koru göl batısında P4'e açılır. `kenar` 15–25 ile seyrelen kenarlar |
| B2 | **Açıklıklar** | Koru Açıklığı çevresi (r 55, düzlükten geniş) · Ulu Koru içinde P1 boyunca 2 küçük açıklık · Orta Sırt seyri (r 14) · Koru Tepesi doruğu (r 16) · Yar Sekisi'nin kuzey kenarı (manzara açık) |
| B3 | **Çalılıklar** | orman kenarları, kuru dere boyu, göl batı ve güney kıyısı (sazlık yerine çalı), yar dipleri |
| B4 | **Zemin** | `cakil`: sığlık uçları, ırmak iç dirsekleri, kuru dere · `kum`: gölün doğu ve kuzey kıyısı (y2 önü) · `toprak`: orman içi patika çatalları |
| B5 | **Sakin bölgeler** | § 8'deki dört çayır ağaçsız kalır; kenarlarında koru/şerit olduğundan hiçbir nokta ağaca > 120 m değil. `olcum` § 6'yı sıfırlayın |
| B6 | **Adacık** | (1215,1078): 1 yapraklı + 2 çalı (`nesneler`, id'li) |
| İ1 | **İşaret nesneleri** (`isaret.js`) | § 7 tablosundaki 13 nesne, id ve koordinatlarıyla; her biri için `isaret` noktası (`yukseklik`: devAgac 20, sivriTas 10, diğerleri 4). `tasKapi` yola dik döndürülür (`ry`) |
| İ2 | **Büyük tek kayalar** | sığlık uçlarında (Batı: (628,822) ve (548,758); Dirsek: (1560,935) ve (1558,856)) `kaya` s 2,5–3,2; göl ayağında 1; hepsi id'li |
| İ3 | Ek noktalar | `manzara`: Güney Boğazı eşiği (1680,1562 var; eklemeyin), Kıstak burnu (1960,905), göl güney kıyısı (1220,1160) · `kaynak` noktaları yerlesim.js'tedir, yazmayın |

İşaret nesnelerinin oturduğu kayalıklar arazi.js'tedir (A2 İğne kayalığı, A6 kapı kayaları): koordinatlar bu belgede sabittir; nesneyi aynı koordinata koyun.

---

## 11. Bilinçli tercihler ve açık sorular

**Tercihler**
- **Doğuş taşındı:** (1402,921) → (1420,1190). Eski yer dümdüz çanağın ortasıydı ve Göl Ayağı deresinin geçeceği yerdi. Yeni yer 270 m güneyde, yamaç dibinde, 6–8 m yüksekte: ilk karede çanak aşağıda okunuyor.
- **Prosedürel taban korunuyor**, çanak "sıfırdan" kurulmadı: ırmak sürekliliği ve kenar uyumu kesin; bedeli, ırmakların yerini ve genişliğini (50–70 m, derin) seçememek. Bu yüzden üç sığlık şart.
- **Bölge biraz büyük** (4,3 km²): Nal Tepe doruğu ve Kıstak'ın sığması için. İçerik yoğunluğu çanakta (≈ 1,5 km²); kuzey dili ve Nal daha seyrek, "yolculuk" bölgesi.
- **Nal Tepe bilerek abartıldı** (105 → 180 m): 745 m'den ufuk hedefi olması için. Arkasındaki 125 m'lik kütle artık onu gölgelemiyor.
- **Halka yok:** çanağı iki kol + ırmak kapatıyor; kollar farklı yükseklikte (70 / 53 m), farklı uzunlukta, biri hilal biri düz.
- **Susuz iki yerleşim** (y3, y4): su y = 0 kuralının sonucu; ödünleşim olarak tasarıma katıldı.

**Araç uyarıları (uzmanlar ve testçiler için)**
- `test/olcum.cjs` yol sürelerini 4 m ızgarada **fazla** hesaplıyor (ör. Güney Boğazı: araç 6,9 dk, gerçek 2,2 dk; `yuru` ile 131 sn). Neden: en kısa yol hesabında `T` ve `key` dizileri `Float32Array`; `Float64Array` yapılınca sonuç doğru çıkıyor. Düzeltilene kadar süreleri `--hucre 8` ile ya da `yuru` ile doğrulayın. Bu belgedeki süreler düzeltilmiş hesaptandır. "Erişim" sütunu (yürüyerek / yalnız yüzerek) etkilenmiyor.
- `vadi` + `kot`: kot noktadan noktaya DEĞİŞİRSE köşelerde yay biçimli 2–5 m'lik basamak kalıyor. Kotlu vadide bütün noktalara aynı kot verin.
- `engebe` ırmak yataklarını da oynatır; bu bölgede kullanılmıyor, eklemeyin.

**Açık sorular (ana oturuma)**
1. Nesne çizim uzaklığı 440 m (`arazi.js`, `uFar`): işaret türleri (devAgac, sivriTas…) için daha uzun menzil istenir mi? Olursa `ata` ve `igne` uzaktan da çalışır; plan olmadan da işliyor.
2. İşaret türleri `arazi.js`'e bağlı mı (`turBagli`)? Değilse yedek nesneler (büyütülmüş ağaç/kaya) görünür.
3. Bölge dışı prosedürel orman, bölge içi tasarlanmış ormanla sınırda yan yana gelecek: batı ve kuzey kenarı ırmağın karşı kıyısında olduğundan dikiş ırmakla örtülüyor; güney ve doğu kenarında bitki.js'in yoğunluğu dışarıya (≈ .2–.3) yaklaştırması gerekir.
4. Güney Boğazı'nın ötesi (güneydoğu ırmak vadisi) ve Kıstak'ın ötesi sonraki bölgelerin (b002, b003) işi; çıkışlar oraya "yarım cümle" olarak bırakıldı.
5. Köprü ilkeli yok; şimdilik sığlık + yüzme. İnşa sistemi köprü getirirse Dirsek ve Boğaz doğal köprü yerleridir.
