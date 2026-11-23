# İstanbul Uçuşu

Tarayıcıda çalışan, İstanbul'dan başlayıp bütün Türkiye üzerinde geçen bir uçuş benzetimi. Boğaz, Haliç, Marmara kıyısı, tarihi yarımada, köprüler ve Levent-Maslak gökdelenleri gerçek konumlarında; İstanbul'un bütün binaları (~396 000) üç boyutlu. Türkiye'nin bütün arazisi (dağlar, göller, kıyılar), 17 şehirde OpenStreetMap binaları, on havalimanı, Anıtkabir, Atakule, Kocatepe, İzmir Saat Kulesi, Kapadokya peri bacaları ve balonları. Uçaklar: F-16 sınıfı savaş uçağı (akrobasi, menüde öne çıkan), Cessna 172 sınıfı ve L-39 sınıfı jet eğitim uçağı. Varsayılan kamera uçağın arkasından takip eder (dışarıdan görünüş); istenirse kokpit ve "geçiş" kamerası seçilir. Fizik oyun tipi değil, 6 serbestlik dereceli katı cisim modelidir ve gerçek uçak değerleriyle sınanmıştır (aşağıda).

Saf HTML/CSS/JavaScript, three.js 0.160.0 (`www/vendor/` içinde, internet gerekmez). Giriş sayfası `www/index.html`. claude.ai artifact'i olarak yayınlanacak; bütün dosyalar göreli yollarla yüklenir.

## Çalıştırma

```
cd ucak-simulatoru/www && python3 -m http.server 8765
# tarayıcıda: http://localhost:8765/
```

`file://` ile açılmaz (modüller ve veri dosyaları `fetch` ile yüklenir). iPhone'da Safari'de açılır; telefonu yatay çevirin.

## Kumandalar

| İş | Klavye | Dokunmatik | Oyun kumandası |
|---|---|---|---|
| Yunuslama | `S` / aşağı ok: levye geri, burun yukarı. `W` / yukarı ok: burun aşağı | sağda 4 yön tuşu (yukarı = burun yukarı; Ayarlar'dan analog) | sol çubuk |
| Yatış | `A` `D` / sol sağ ok | yön tuşları (aynı anda birden çok) | sol çubuk |
| Dümen | `Q` `E` | SOL DÜMEN / SAĞ DÜMEN | sağ çubuk |
| Gaz | `Shift` artır, `Ctrl` azalt; `+` `-`, `PageUp` `PageDown`; `1`…`9`, `0` = tam gaz | soldaki gaz kolu | RT / LT |
| Flap | `F` indir, `V` topla | FLAP+ / FLAP- | A / X |
| Fren | `B` ya da boşluk (basılı) | FREN (basılı) | B |
| Trim | `Z` burun aşağı, `X` burun yukarı, `T` o anki levyeyi trime al | TRİM YUKARI / AŞAĞI | LB (trime al) |
| İniş takımı (jetler) | `G` | TAKIM | RB |
| Duman izi (akrobasi) | `K` | DUMAN | sol çubuğa basma (L3) |
| Türkiye haritası | `N` | HARİTA | — |
| Kamera | `C` (takip, kokpit, geçiş); fareyle sürükle: etrafına bak; tekerlek: uzaklık | KAMERA; boş yerde sürükle | Y |
| Diğer | `P` duraklat, `R` baştan, `M` ses, `L` motor kapat/aç, `H` yardım | DUR, BAŞTAN | Start, Back |

Menüde: uçak (F-16 sınıfı savaş uçağı "YENİ" etiketiyle ilk sırada, Cessna 172 sınıfı, L-39 sınıfı), başlangıç (İstanbul: pistten kalk, Kız Kulesi açıkları, Boğaz üzerinde akrobasi, inişe yaklaş, İstanbul Havalimanı; Türkiye'de havada: Kapadokya, Ağrı Dağı, Ankara, İzmir Körfezi, Bursa ve Uludağ; havalimanından kalk: Esenboğa, Adnan Menderes, Antalya, Kapadokya, Kayseri, Trabzon, Erzurum, Van), rüzgar (yok / hafif poyraz 8 kt / kuvvetli 18 kt, hamleli), grafik kalitesi, otomatik dümen, yunuslama yönü, telefonda eğerek kumanda (deneysel, kapalı gelir).

Gösterge (Türkçe): gösterge hızı (kt) ve yer hızı, irtifa (m ve ft), yerden yükseklik, dikey hız (ft/dk), baş, gaz, devir (jette N1), flap, trim, takım, hücum açısı çubuğu, yük faktörü, yapay ufuk, kuzeyi yukarıda küçük harita, yakındaki simge yapının adı. Tutunma kaybına 2.5° kala kırmızı "TUTUNMA KAYBI" uyarısı ve korna sesi.

## Fizik modeli (`www/js/fdm.js`)

- **Katı cisim:** konum ve hız NED dünya ekseninde, yönelim birim kuaterniyon, açısal hız gövde ekseninde; Euler denklemleri `I·ω̇ = M − ω × Iω`. Sabit 240 Hz adım, yarı örtük Euler (kare süresi adımlara bölünür, en çok 0.1 sn).
- **Atmosfer:** ISA (sıcaklık, basınç, yoğunluk, ses hızı yüksekliğe göre). Motor gücü Gagg-Ferrar bağıntısıyla yoğunlukla düşer.
- **Kaldırma:** `CL(α)` doğrusal bölge, tepeye yakın yumuşak yuvarlanma, 16°'den sonra kopma (CL düşer), büyük açılarda düz levha davranışı; ters uçuşta −13°'de kopma. Yunuslama hızı (`CLq`), α̇ ve elevatör katkısı. Flap: ΔCL, ek sürükleme, burun aşağı moment, kopma açısını 2° düşürür.
- **Sürükleme:** `CD0 + K·(CL − CLminD)²` (K = 1/(π·e·AR)), flap, yan kayma, kopmuş akımın büyük sürüklemesi, jette takım sürüklemesi ve 0.72 Mach sonrası sıkıştırılabilirlik artışı.
- **Yer etkisi:** kanat yerden kanat açıklığı kadar yükseğe inince indüklenmiş sürükleme azalır, kaldırma biraz artar.
- **Yan kuvvet ve momentler:** kararlılık türevleri `CYβ`, `Cmα`, `Cmq`, `Cmα̇`, `Clβ` (dihedral etkisi), `Clp` (yuvarlanma sönümü), `Clr`, `Cnβ` (rüzgar gülü), `Cnr` (sapma sönümü), `Cnp`; kumanda türevleri elevatör, kanatçık (ters sapma `Cnδa` ile), dümen. Tutunma kaybında yuvarlanma sönümü kaybolur ve kanat düşer (vril girişi mümkün), burun aşağı moment gelir. Değerler Roskam ve JSBSim'deki C172 verilerine yakındır.
- **Kumanda yüzeyleri:** sınırlı hızla hareket eder (C172 70°/sn); trim elevatöre eklenir.
- **Pervane (C172):** sabit hatveli 1.905 m pervane, `CT(J)` ve `CP(J)` eğrileri, motor 160 hp (2700 rpm), sürtünme gücü ve pervane eylemsizliğiyle devir dinamiği. İtki hızla düşer; rölantide pervane fren yapar. Pervane torku ve iz akımı uçağı sola çevirir; seyirde ayar tırnağıyla dengelidir, torkun çoğu kanat ayarıyla karşılanmış sayılır (oynanabilirlik için). Tam gazda tırmanırken hafif sola yatma ve sapma kalır; sağ pedal ve hafif sağ kanatçık gerekir.
- **Jet:** 16.9 kN, türbin devri gecikmesi (rölantiden yavaş açılır), itki yoğunluk ve Mach ile değişir.
- **F-16 sınıfı (11.5 t):** 76 kN, gaz %90'ın üstünde ard yakıcı 125 kN (itki/ağırlık ~1.1), ard yakıcı kısa gecikmeyle yanar; ses ötesi dalga sürüklemesi (M 0.88'den sonra). Kaldırma eğrisi girdap kaldırmasıyla 32°'ye kadar doğrusal.
- **Fly-by-wire (yalnız F-16):** levye yunuslamada yük faktörü ister (tam geri 9 g, tam ileri -3 g; takım açıkken 4 g), yatışta yuvarlanma hızı ister (tam levye 240°/sn). Levye ortadayken yerçekimi telafi edilir, uçak uçuş yolunu korur (ters uçuşta da düz gider). İstenen g'den gereken hücum açısı kaldırma eğrisinin tersinden hesaplanır, 25° (takım açıkken 15°) ile sınırlanır; elevatör ileri besleme (moment dengesi) + hücum açısı, α̇ ve yunuslama hızı geri beslemesiyle sürülür; kazançlar dinamik basınçla ayarlanır; g sınırlayıcı aşmayı keser. Yüksek hücum açısında yuvarlanma hızı azaltılır, yatış hız ekseni etrafında koordine edilir (kanatçık-dümen bağlantısı), dümen yan kaymayı siler. Oyun için bağışlayıcı iki kolaylık: eylemsizlik bağlaşımının %60'ı ve yan kaymanın bir kısmı "bilgisayarca" karşılanır (gerçekte daha zordur). Yerde doğrudan kumanda (kalkışta burun yumuşak kalkar). Bayılma (blackout) yok.
- **İniş takımı:** üç tekerlek yay-sönümleyici; yanal ve boyuna sürtünme (pist ve çim için ayrı), ana tekerlerde fren, burun tekeri dümenle döner (hızla sınırı azalır). Gövde, kuyruk, kanat ucu ve pervane temas noktaları ayrıca denetlenir.
- **Kaza:** 3.6 m/s'den (~700 ft/dk) sert dokunma, suya değme, pervanenin yere vurması, kanat ucu ya da gövdenin hızla yere çarpması, binaya, köprü tabliyesine ya da kuleye çarpma, yük faktörünün sınırın 1.5 katını aşması, azami hızın %20 aşılması. Kaza ekranında neden yazar; `R` baştan başlatır.
- **Rüzgar:** isteğe bağlı poyraz (040°'den), hamleler ve hafif türbülans, yere yaklaştıkça azalır.

### Fizik sınamaları

`node tests/fizik-test.mjs` (Node 18+; oyunla aynı `fdm.js` dosyasını kullanır). Son çalıştırma, bütün sınamalar geçti:

Cessna 172 sınıfı (1000 kg):

| Sınama | Sonuç | Gerçek uçak (C172 POH, 1043-1157 kg) |
|---|---|---|
| 100 kt dengede 60 sn eller serbest: irtifa / hız farkı | −0.01 m / 0.00 kt | — |
| 100 kt seyirde devir, gaz | 2299 rpm, %74 | ~2300 rpm |
| Durum hızı flapsız (1g; yavaşlarken uyarı anı) | 50.3 kt; 48.0 kt | 48 KIAS |
| Durum hızı tam flap | 42.8 kt; 40.8 kt | 40 KIAS |
| Kalkış koşusu (flap 10°, 51 kt rotasyon) | 362 m, 21.6 sn | ~293 m |
| 50 ft engel aşma | 616 m | ~512 m |
| 30° yatışlı koordineli dönüş: dönüş hızı, yük, yan kayma | 6.32°/sn (ideal 6.31), 1.16 g, 0.3° | — |
| Azami düz uçuş hızı (deniz seviyesi / 2500 m) | 120 kt / 114 kt | ~123 kt |
| Tırmanma (tam gaz, 74 kt) | 727 ft/dk | 730 ft/dk |
| Süzülme oranı (rölanti, 68 kt) | 10.6 : 1 | ~9 : 1 |
| Tam kanatçıkla yuvarlanma hızı (100 kt) | 62°/sn | — |
| Fugoid sönümü (ikinci 80 sn genliği / ilki) | 0.17 | sönümlü |
| 2 m/s dokunma / 5 m/s dokunma | kaza değil / kaza | — |

Tarayıcı denemesinde (Playwright, klavyeyle: tam gaz, pist ekseni Q/E ile, 60 kt'da S ile yumuşak çekiş) Cessna 323 m'de teker kesti ve 84 kt ile 120 m'ye tırmandı.

F-16 sınıfı (11 500 kg, fly-by-wire):

| Sınama | Sonuç | Gerçek uçak |
|---|---|---|
| 350 kt, 60 sn eller serbest: irtifa / hız farkı | −26 m / +2.5 kt | — |
| Tam levyeyle yuvarlanma hızı (350 kt) | 253°/sn | ~240-300°/sn |
| Takla (420 kt, ard yakıcı, levye %80): tam tur | 18.8 sn, en çok 25.2° hücum açısı, 9.2 g, tutunma kaybı yok | — |
| 160 / 220 kt levye tam geri 25 sn | en çok 25.2° / 27.1°, tutunma kaybı ve yan kayma yok; bırakınca hızlanıp toparlanır | AoA sınırı 25° |
| Çekerek tam yatış 15 sn (ayrılma denemesi) | en çok 26.7°, yan kayma 8.3°, tutunma kaybı yok | — |
| Ters uçuş 20 sn levye ortada | −72 m, yatış 173° | — |
| 450 kt levye tam geri | en çok 9.7 g (sınır 9 g, kaza 13.5 g) | 9 g |
| Ters takla (split-S) | baş 186°, 2385 m irtifa kaybı | — |
| Kalkış koşusu (ard yakıcı, 150 kt) | 686 m | ~450-600 m |
| Azami hız deniz seviyesi | 820 kt (M 1.24) | ~M 1.2 |
| 150 kt yaklaşma (takım + flap) | hücum açısı 10.6°, 30 sn'de −23 m | 11-13° |

Tarayıcıda (Playwright, test kancasıyla levye %80 geri, ard yakıcı, duman açık, Boğaz üzerinde 650 m): takla 362°, 17.6 sn, en çok 25.3° hücum, tutunma kaybı yok, 650 m'den 666 m'ye; ardından tonoz 264°/sn, kaza yok.

Jet eğitim uçağı (L-39 sınıfı, 4400 kg): durum hızı 113 kt (flapsız) / 92 kt (tam flap), kalkış koşusu 717 m, azami hız 391 kt (deniz seviyesi), tırmanma 4650 ft/dk, yuvarlanma 161°/sn, 300 kt dengede sabit.

## Harita verisi ve lisanslar

- **isometricistanbul.com incelendi, kullanılmadı.** Site, İBB'nin 3B İstanbul modelinin görüntülerinden yeniden çizilmiş 2B izometrik bir resim haritası; indirilebilir 3B veri sunmuyor ve koşulları yeniden kullanıma izin vermiyor.
- **OpenStreetMap** (ODbL 1.0, © OpenStreetMap katkıda bulunanlar): İstanbul zemin dokusu (yollar, parklar, kıyı) Overpass'tan (maps.mail.ru) alınan veriden; Türkiye geneli (kıyı çizgisi, göller, orman / şehir / tarla örtüsü, havalimanı pistleri, 18 bölgenin binaları, ağaç alanları) openstreetmap.fr'nin Türkiye özütünden (`download.openstreetmap.fr/extracts/europe/turkey-latest.osm.pbf`, 690 MB) `osmium` ile çıkarıldı. Bu oturumda Overpass sunucularının hepsi zaman aşımı veriyordu, Geofabrik erişilemedi. Türetilmiş veri (`www/data/`) de ODbL kapsamındadır; atıf menüde ve uçuş ekranında.
- **Natural Earth** (kamu malı): özütün dışında kalan kara (Yunan adaları, komşu ülkeler), büyük ırmaklar, şehir adları ve nüfusları (`ne_10m_land`, `ne_10m_rivers_lake_centerlines`, `ne_10m_populated_places_simple`).
- **Yükseklik:** AWS Terrain Tiles (Terrarium PNG, herkese açık; kaynakları SRTM, GMTED2010, ETOPO1 vb., bkz. github.com/tilezen/joerd/blob/master/docs/attribution.md): z7 (genel), z9 (Türkiye), z11-z12 (ayrıntılı bölgeler).
- **three.js** 0.160.0, MIT lisansı (`www/vendor/three.module.min.js`).
- Uçak modelleri ve simge yapılar elle, kodla modellendi (dışarıdan 3B model alınmadı); konumlar OpenStreetMap / bilinen koordinatlar.

### Veriyi yeniden üretmek

```
bash tools/fetch_osm.sh          # İstanbul OSM verisi (Overpass) -> tools/raw/ (depoya girmez)
python3 tools/fetch_dem.py       # İstanbul yükseklik karoları
python3 tools/fetch_dem_tr.py    # Türkiye yükseklik karoları (z7, z9, bölgeler için z11; bolgeler.json)
# Türkiye OSM özütü: bash tools/osm_ayikla.sh; python3 tools/osm_binalar.py (osmium-tool gerekir)
python3 tools/build_data.py      # İstanbul zemin dokusu, maske, köprüler, küçük harita -> www/data/
python3 tools/build_turkey.py    # Türkiye: arazi, örtü, bölgeler, ağaçlar -> www/data/tr/ ('bina' adımı artık kullanılmıyor)
python3 tools/havalimanlari.py   # bütün havalimanları -> hava.json, hava/; arazi havalimanlarının altında düzleşir (23 Kasım)
python3 tools/binalar_tr.py      # Türkiye'nin bütün binaları ve ana yolları -> bina.json, bina/q_*.png (23 Kasım)
python3 tools/sehir_dokusu.py    # bina sıklığı örtü dokusunun şehir kanalına (uzaktan şehir dokusu)
```
(numpy, scipy, Pillow, orjson, pyshp gerekir. `build_turkey.py arazi|ortu|harita|bina` ile parça parça çalışır.)
Yeni ayrıntılı bölge (şehir, dağ) eklemek için `tools/bolgeler.json`'a bir satır ekleyip yukarıdaki adımları çalıştırmak yeter.

### Veri dosyaları (`www/data/`)

İkili veriler **PNG kabında** taşınır: baytlar sırayla RGB piksellere yazılır, ilk 4 bayt uzunluk (`www/js/veri.js` açar). Artifact sunucusu `.bin` sunmuyor; PNG base64'ten ~%25 küçük, tarayıcı kendisi açar ve kayıpsızdır (önceki `.b64.txt` dosyaları kalktı).

- `data/zemin.webp` (İstanbul 4096² zemin dokusu, alfa = kara), `data/maske.png` (İstanbul kara/su), `data/kopruler.json`, `data/harita.png` (İstanbul küçük haritası).
- `data/tr/dizin.json`: kök alan, dosya listesi, bölgeler, paketler, havalimanları (OSM pist uçları, en, yükseklik), 83 şehir.
- `data/tr/genel.png`: 2 km yükseklik ızgarası (2048 × 1088 km), açılışta yüklenir.
- `data/tr/t_i_j.png` (35 karo): 500 m yükseklik, 256 km'lik karolar; uçağın 140 km çevresindekiler yüklenir.
- `data/tr/b_*.png` (19 bölge): 62.5 m yükseklik (İstanbul, Ankara, İzmir, Bursa-Uludağ, Antalya, Konya, Adana, Mersin, Gaziantep, Kayseri-Erciyes, Kapadokya, Trabzon, Samsun, Eskişehir, Diyarbakır, Erzurum-Palandöken, Van, Ağrı Dağı, Kaçkarlar, İstanbul Havalimanı); içlerindeki havalimanlarının altı düzleştirilmiş.
- `data/tr/bina.json` + `data/tr/bina/q_<boy>_<i>_<j>.png` (95 paket, 5.71 milyon bina ve ana yollar, ~71 MB; 23 Kasım), `data/tr/agac_*.png` (16 m'lik ağaç alanı rasterı, bölgelerde).
- `data/tr/hava.json` + `data/tr/hava/h_<i>_<j>.json` (112 havalimanı, 145 pist ve bütün taksi yolu / apron / park yeri / bina tabanları) ve `data/tr/hava/z_<i>_<j>.png` (bölge dışındaki havalimanlarının 62.5 m yükseklik yamaları, çoklu ızgara; 23 Kasım).
- `data/tr/ortu.png`: 4096 × 2048, 500 m: R orman, G şehir, B tarla, A su oranı (OSM + Natural Earth).
- `data/tr/harita.webp`: Türkiye haritası (1 km/piksel), menü arka planı, küçük ve büyük harita.

## Dünya nasıl çiziliyor

- **İzdüşüm:** küresel Lambert konik konform, standart paraleller 37° ve 41°, merkez İstanbul (41.085 K, 28.97 D) = (0, 0) (`www/js/geo.js`, `tools/lcc.py`). Türkiye'de ölçek hatası binde 3'ün altında, açılar korunur. İstanbul'da ızgara kuzeyi gerçek kuzeydir; doğuda fark büyür (Van'da 9°), pusula gerçek başı gösterir.
- **Kayan orijin:** fizik mutlak konumla, çift duyarlıkla çalışır. Bütün dünya nesneleri bir kök grubun altındadır ve kendi merkezlerine göre yerel köşelerle kurulur; kamera 3 km uzaklaşınca kök kaydırılır. Van'da (1300 km) da titreme olmaz.
- **Arazi:** dörtlü ağaç (kök 2048 km, düğüm başına 32 × 32 aralık, eteklerle çatlaksız). Düğüm, kameraya uzaklığı ayrıntı katsayısı × boyundan azsa bölünür; en ince düğüm ayrıntılı bölgelerde 2 km (62.5 m köşe aralığı, veriyle birebir), dışarıda 8 km (250 m). Sisin tamamen örttüğü uzaklıktan ötesi çizilmez (yükseldikçe sis açılır, görüş 150 km'yi geçer). Kare başına sınırlı sayıda düğüm kurulur; veri gelince ilgili düğümler yenilenir. Fizikteki yer yüksekliği aynı veriden, aynı üçgen bölmesiyle hesaplanır.
- **Zemin rengi** gölgelendiricide: konuma göre iklim (Karadeniz nemli yeşil, iç Anadolu bozkır, Ege ve Akdeniz zeytin yeşili, doğu yayla), OSM orman / şehir / tarla oranı, düz ovalarda tarla yama deseni, eğimde kaya, kar sınırı (~2950 m, kuzeyde ve doğuda daha aşağıda, gürültülü), göller (yükseklikteki su yüzeyi parlar), yakın ayrıntı gürültüsü. İstanbul dikdörtgeninde 7 m'lik OSM zemin dokusu (kenarda karışır). Deniz: arazi deniz seviyesinin altında kalan yerde atılır, altta dalgalı su düzlemi (kamerayla gezer, dalgalar dünyaya bağlı) görünür; kıyıda çakışma titremesi olmaz.
- **Binalar:** (23 Kasım'da yenilendi, aşağıya bakın) 18 şehir paketinin hepsi 3B (İstanbul'daki bütün OSM binaları). Bir Web Worker paketleri 1 km'lik parçalar hâlinde çözer ve uzaklığa göre üç ayrıntı düzeyinde birleşik örgü üretir: 1 km düğümde tam taban + dört köşeli küçük binalarda kırma kiremit çatı; 2 km düğümde sadeleştirilmiş taban, küçük binalar yok; 4 km düğümde yalnız yüksek ya da büyük binalar kutu olarak. Düğüm başına bir çizim çağrısı, çerçeve dışı düğümler çizilmez, kullanılmayanlar bellekten atılır. Cephe pencereleri tek bir tekrarlanan dokuyla (UV kat ve bölmeye göre), renkler köşe rengiyle. Camilere kubbe ve minare (örneklenmiş). Çarpışma 12.5 m'lik ızgarayla, yalnız uçağın çevresindeki parçalar için.
- **Ağaçlar:** OSM orman, park, mezarlık ve çalılık alanlarında, 16 m'lik ızgarada (binalı hücreler atlanır) iğne yapraklı ve yayvan iki düşük poligonlu ağaç, 1 km parça başına örneklenmiş (instanced) çizim, kameraya 1.6 km (yüksek kalitede 2.4 km) içinde.
- **Elle modellenenler:** İstanbul'dakiler (Galata Kulesi, Kız Kulesi, Ayasofya, Sultanahmet, Süleymaniye, Rumeli Hisarı, Çamlıca Kulesi, Büyük Çamlıca Camii, köprüler) ve yeni: Anıtkabir (tören meydanı, Aslanlı Yol, sütunlu Şeref Holü), Atakule (125 m), Kocatepe Camii (4 minare, 88 m), İzmir Saat Kulesi, Kapadokya'da ~950 peri bacası (şapkalı ve şapkasız, örneklenmiş), Uçhisar Kalesi ve 24 sıcak hava balonu (balona çarpmak kazadır).
- **Havalimanları:** (23 Kasım'dan beri bütün Türkiye, aşağıya bakın) OSM pist uçlarından: Atatürk (05/23), İstanbul Havalimanı, Esenboğa, Adnan Menderes, Antalya, Kapadokya, Kayseri, Trabzon, Erzurum, Van. Pist işaretleri (numaralar OSM'deki adından), çevresinde apron şeridi.

## Alınan kararlar (kullanıcı uyurken, sorulmadan)

1. **Harita kaynağı:** isometricistanbul.com 3B veri vermediği ve koşulları yeniden kullanıma izin vermediği için OpenStreetMap kullanıldı.
2. **Pist:** Atatürk Havalimanı'nın 17/35 pistleri kaldırıldığı için (OSM'de yok) bugün duran 05/23 pisti (OSM koordinatları, 2713 m, 60 m) seçildi. Kalkış 05 yönünde (058°), şehir önde.
3. **Başlangıç seçenekleri:** "Pistten kalk", "Havada başla" (Kız Kulesi açıkları, 450 m, kuzeye Boğaz'a dönük, dengeli) ve iniş alıştırması için "İnişe yaklaş" (pist 05, 3° süzülüş, flap 20°).
4. **İkinci uçak:** L-39 sınıfı jet eğitim uçağı (uç tankları, katlanır takım). Gerçek bir kuruluşun renkleri ya da işareti kullanılmadı.
5. **Yunuslama yönü:** uçuş benzetimlerindeki kural (yukarı tuşu/levye ileri = burun aşağı); menüden ters çevrilebilir.
6. **Ctrl tuşu:** istendiği gibi gazı azaltır, ama tarayıcılar Ctrl+W gibi kısayolları engellemeye izin vermez; bu yüzden `-`, `PageDown` ve rakam tuşları da eklendi ve yardımda uyarı var.
7. **Otomatik dümen** varsayılan açık: havada yan kaymayı siler, yerde levyenin yatış girdisi burun tekerini çevirir (dokunmatikte pedal tutmak zor olduğu için). Kapatılınca dümen tamamen elle.
8. **Eğerek kumanda** kapalı gelir; açılınca iOS izin ister.
9. **Bina sayısı:** başta 120 000 ile sınırlıydı; 22-23 Kasım'da kalktı (bkz. 17). Etiketsiz binalara konuma göre kararlı rastgele kat verilir (İstanbul 2-7, Anadolu şehirleri büyüklüğe göre 1-8).
10. **Grafik kalitesi** dokunmatik cihazda "orta", masaüstünde "yüksek" (ayrıntılar 20. maddede); "düşük" İstanbul dokusunu 2048'e indirir.
11. Günün saati sabit (öğleden sonra, güneybatıdan güneş), gölge yok (performans için).
12. Ayarlar `localStorage` anahtarı `istanbul-ucusu-v1` altında saklanır. Yeni sürüm ilk açılışta F-16'yı bir kez seçili getirir (`v2` bayrağı), sonra oyuncunun seçimi kalır.

### 22-23 Kasım kararları (jet, 3B İstanbul, Türkiye)

13. **Yeni uçak: F-16 sınıfı savaş uçağı.** Gerçek uçak tipine benzeyen kendi modelimiz (dışarıdan model bulunmadı; CC0/CC-BY, girişsiz indirilebilir ve lisansı açık bir F-16 modeli ararken güvenilir kaynak çıkmadı, ağ erişimi de kısıtlıydı). Gövde kesitlerden örülerek (loft), kanatlar ve kuyruk yuvarlak kenarlı levhalar, çene altı hava alığı, kabarcık kanopi (altın tonlu cam), içinde pilot ve koltuk, sırt, karın yüzgeçleri, uç rayları, yapraklı lüle. PBR malzemeler (MeshStandardMaterial) ve gökyüzünden üretilen ortam haritası (PMREM), panel çizgileri gölgelendiricide (doku gerekmez). Hareketli yüzeyler: stabilatörler (yunuslama + yatışta farklı), flaperonlar, hücum açısıyla açılan hücum kenarı flapları, dümen; içeri katlanan iniş takımı; ard yakıcı alevi (üç katmanlı ışıyan koni, şok elmasları, titreme) ve parıltı; seyrüsefer lambaları ve kuyruk çakarı. **Boyama nötr:** açık/orta gri, koyu radom, siyah parlama önleyici, turkuaz kuyruk ucu ve "İU 01" (İstanbul Uçuşu); hiçbir hava kuvveti ya da gösteri takımı işareti yok.
14. **Zorluk:** gerçeğinden kolay: fly-by-wire tutunma kaybını ve vrili imkânsız kılar, bayılma yok, kanat dengeleyici dik uçuşta ve çok yatıkken karışmaz (akrobasi serbest), otomatik dümen F-16'da bilgisayarın içinde.
15. **Takip kamerası:** uçağın yönelimini yumuşakça (kuaterniyon slerp) izler; kameranın yukarısı uçağın yukarısıyla dünyanın yukarısının karışımı (uçak ters dönünce uçağınki), böylece taklada dik çıkışta ve tepede kamera ters dönüp sıçramaz.
16. **Duman izi:** `K` / DUMAN; 2400 parçacıklık örneklenmiş kareler, yaşla büyür ve saydamlaşır (45 sn).
17. **Bütün İstanbul 3B:** 120 000 sınırı kalktı; OSM'deki bütün binalar (395 645, sadeleştirilmiş tabanlar). Ayrıntı düzeyleri yukarıda. Zemin dokusundaki tabanlar uzak görünüm için kaldı.
18. **Bütün Türkiye:** bütün ülkenin binası boyut sınırına sığmaz; arazi bütün Türkiye ve komşuları için, binalar 17 şehirde gerçek (İstanbul, Ankara, İzmir, Bursa, Antalya, Konya, Adana, Mersin, Gaziantep, Kayseri, Nevşehir/Kapadokya, Trabzon, Samsun, Eskişehir, Diyarbakır, Erzurum, Van) ve İstanbul Havalimanı'nda. Diğer şehirler zeminde şehir rengi ve adıyla. Arazi 500 m (Türkiye) / 62.5 m (bölgeler) / 2 km (genel); 500 m'lik ızgara Ağrı'nın zirvesini 5060 m'ye yuvarlar, Ağrı bölgesinde 62.5 m ile 5100 m.
19. **Akış:** açılışta yalnız dizin, genel ızgara, örtü ve harita (~2.5 MB) yüklenir; temel karolar 140 km, bölgeler 20 km, bina paketleri 24 km yaklaşınca yüklenir. Başlangıç noktası seçilince "Uç" o noktanın verisini bekler.
20. **Grafik kalitesi:** yüksek (piksel 2, bina 2.2/6/13 km, ağaç 2.4 km, arazi katsayısı 1.6), orta (dokunmatik varsayılanı: 1.5, 1.5/4.2/9 km, 1.6 km, 1.15), düşük (1, 1/3/6 km, 0.9 km, 0.9).

## Testler

- `node tests/fizik-test.mjs`: fizik sınamaları (yukarıdaki tablolar; F-16 için takla, yuvarlanma hızı, levye tam geri ayrılma denemeleri, ters uçuş, split-S, 9 g sınırı, kalkış, azami hız, yaklaşma). Son çalıştırma: hepsi geçti.
- `node tests/tarayici-test.cjs [adres] [bölümler]`: önce `www/` içinde `python3 -m http.server 8765`. Bölümler: `kalkis` (Cessna klavyeyle kalkar: 323 m'de teker kesti, 120 m'ye 85 kt ile tırmandı), `menu`, `akrobasi` (F-16 Boğaz üzerinde takla + tonoz, duman açık), `ekran` (görüntüler), `iphone` (iPhone 13 yatay, dokunmatik düğmeler ekranda mı, DUMAN düğmesi). Konsol hatası varsa başarısız sayılır. Son çalıştırma: hata yok.
- Test kancası `window.__ucak`: `ac` uçak durumu, `world`, `input` (`input.stick = {x, y}` dokunmatik levye gibi), `place(enlem, boylam, irtifa, gerçek baş, kt)`, `prepare(enlem, boylam)` (veriyi yükle), `freeze(true|false)`, `smoke(v)`, `map(v)`, `setCam(0|1|2)`, `orbit(yaw, pitch, uzaklık)`, `stats()` (çizim çağrısı, üçgen, düğüm sayıları, bekleyen yükleme), `STARTS`.

### Başarım (yazılımsal WebGL ölçümü; çizim çağrısı ve üçgen sayısı cihazdan bağımsızdır)

| Görünüm | Kalite | Çizim çağrısı | Çizilen üçgen |
|---|---|---|---|
| Boğaz, 650 m, iPhone 13 yatay | orta | 147 | 0.68 milyon |
| Boğaz yakın jet, 420 m | yüksek | 187 | 1.4 milyon |
| İstanbul tarihi yarımada üstü, 700 m | yüksek | 194 | 1.3 milyon |
| Ankara, Anıtkabir | yüksek | 202 | 1.0 milyon |
| Kapadokya | yüksek | 244 | 0.39 milyon |
| Ağrı Dağı, 4400 m | yüksek | 153 | 0.18 milyon |

Arazi düğümü başına ~2 200 üçgen, bina düğümü başına bir çizim çağrısı. Gerçek iPhone'da kare hızı ölçülemedi; orta kalitedeki yük (≈150 çağrı, ≈0.7 milyon üçgen, gölgesiz) iPhone 12 ve sonrası için 60 kare/sn hedefine uygun görünüyor; yetmezse "Düşük" seçilmeli. `www/` toplam ~35 MB, 114 dosya; açılışta ~3 MB yüklenir.

## Bilinen eksikler

- Binalar prizma; dört köşeli küçük binalarda kırma çatı var, diğerleri düz. Uzak ayrıntı düzeylerinde küçük binalar görünmez (İstanbul'da zemin dokusunda tabanları kalır, Anadolu şehirlerinde kalmaz).
- 17 şehrin dışındaki şehirlerde bina yok (yalnız zeminde şehir rengi ve adı). Arazi bölgelerin dışında 500 m çözünürlükte (dağlar yumuşak, vadiler sığ).
- Kıyı bölgelerin dışında 500 m'lik ızgarayla çizilir; küçük koylar ve adacıklar kaybolur. Göller örtü dokusundan (500 m), kenarları bulanık.
- Arazi örtüsü OSM'de işaretlenmiş alan kadar: tarla az işaretli olduğu için düz ovalarda genel bir tarla deseni kullanıldı.
- F-16 modeli kodla yapıldı; gerçek uçağın bütün ayrıntıları (anten, sensör, kapak çizgileri birebir) yok. Fly-by-wire, oyun için bilerek bağışlayıcı (eylemsizlik bağlaşımı ve yan kayma kısmen "bilgisayarca" karşılanır).
- Köprü yaklaşma viyadükleri basit; kablolar çarpışmaya girmez. Büyük Çamlıca Camii konumu yaklaşık.
- Gölge, gece, bulut, gerçek su yansıması yok. Güneş sabit.
- Yerde burun tekeri hızlı ve tam girdiyle salınım yapabilir.

## 22 Kasım: Eymen'in istekleri
- Telefonda dümen düğmeleri kalktı; sağdaki levye her şeyi yapıyor (yerde burun tekeri, havada yatış; dümen dokunmatikte her zaman otomatik).
- Uçağın kendiliğinden sağa/sola çekmesi: rüzgâr değil, pervane torku ve iz akımının gaz değişince bozulan dengesiydi. İkisi de kapatıldı (`torqueRoll`, `slipYaw` = 0).
- Yeni ayar "Kanat dengeleyici" (varsayılan açık): levye ortadayken uçak yatışını sıfırlar, düz gider.

## 22-23 Kasım (ikinci tur): Eymen'in istekleri
1. "Gerçek bir jet, çok kaliteli, akrobasi yapabilsin, gerçek kadar zor olmasın": F-16 sınıfı savaş uçağı eklendi (yukarıda 13-16. kararlar), menüde ilk sırada "YENİ" etiketiyle ve bir kez seçili gelir. Takla, tonoz, Immelmann, ters takla, ters uçuş, bıçak sırtı benzeri uçuş yapılabilir; tutunma kaybı ve vril olmaz.
2. "Bütün harita 3 boyutlu olsun, optimizasyonu da yap": İstanbul'daki bütün binalar 3B (395 645), üç ayrıntı düzeyi, işçide birleşik örgü, çerçeve dışı ayıklama, ağaçlar örneklenmiş çizim, zemin ayrıntısı gölgelendiricide.
3. "Bütün Türkiye'yi yap": bütün Türkiye arazisi (dörtlü ağaç, akışlı yükleme, kayan orijin), denizler ve göller, iklime göre zemin, 17 şehirde gerçek binalar, simge yapılar, on havalimanı, Türkiye haritası; menüde yeni başlangıç noktaları.

## 22 Kasım (akşam): kolay kumanda

Eymen: "analog solda, gaz sağda; trim, flap olmasın; yukarıysa yukarı, ne kadar çekersen o kadar."

- **Yerleşim (dokunmatik):** analog sol altta, gaz kolu sağ altta. Ekranda yalnız DUR, BAŞTAN, KAMERA, DUMAN; harita küçük haritaya dokununca.
- **Kolay kumanda** (Ayarlar, varsayılan açık):
  - Analog doğrusal: ne kadar itilirse o kadar yönelir (ortada %5 ölü bölge). Yukarı = burun yukarı, sağ = sağa yatış.
  - Cessna ve L-39'a da uçuş bilgisayarı takılır (`EASY_FBW`, `easyPlane()` in `fdm.js`): levye g ve yuvarlanma hızı ister, ortadayken uçuş yolu korunur, trim gerekmez, hücum açısı tutunma kaybının altında tutulur.
  - Dönüş telafisi (`turnComp`, F-16 dahil): levye ortadayken yatışta da irtifa korunur (n = cosθ/cosφ, 60°'den sonra ters uçuşa doğru eski davranışa yumuşak geçiş).
  - Flap hıza göre, iniş takımı kalkışta toplanır / alçak ve yavaş inerken açılır, yerde gaz kapalıyken fren (`autoSystems()` in `main.js`).
- **Gerçekçi** seçilirse eski düğmeler (flap, takım, fren, trim) geri gelir.
- Testler: `fizik-test` hepsi geçti; tarayıcıda kolay modda Cessna kalkışı 334 m, jet taklası 362°, tonoz 262°/sn; iPhone'da analog solda, gaz sağda, gizli düğmeler yok, analog yukarı → burun yukarı (37°/sn).

### 22 Kasım (gece): düzeltme

- Analog yine sağda, gaz solda. TAKIM ve FREN düğmeleri geri geldi (elle); kolay kumandada yalnız flap ve trim kendiliğinden.
- **Sarsıntı (hata):** analog bırakılınca uçuş bilgisayarı istenen g'ye bir anda atlıyor, aşıp yukarı-aşağı sallanıyordu (F-16 350 kt: −2,2 g'den +2,1 g'ye taşma, 200 kt'ta iki salınım). Levye komutu artık 0,3 sn'lik süzgeçten geçiyor (`_fbw`, `st.u`); bırakınca g tek yönde, taşmadan 1'e iner. Fizik testlerinin hepsi geçti.

### 23 Kasım: yön tuşları ve bağışlayıcı iniş

- **Yön tuşları** (varsayılan; Ayarlar'da "Analog" seçilebilir): sağ altta 4 ana, 4 ara yön. Parmak kaydırılarak tuştan tuşa geçilir; basılı tuttukça komut %35'ten %100'e çıkar (1,2 sn). `input.js` → `#dpad`.
- **İnişte her şeyin patlaması:** sınır 3,6 m/sn (700 ft/dk) alçalmaydı; 250 kt'ta 3°'lik süzülüş bile 6,7 m/sn olduğundan her iniş kazaydı. Kolay kumandada (`easyPlane`, F-16 dahil):
  - 3–9 m/sn arası "Sert iniş, uçak sağlam" uyarısı, kaza yalnız 9 m/sn (≈1800 ft/dk) üstü.
  - İniş yardımı (`fbw.flare`): takım açık, yere 20 m'den az kala alçalma ~1,5 m/sn'ye indirilir; burun 11°'yi geçince yardım azalır.
  - Takımsız gövde üstü iniş kayar; kuyruk sürtmesi 10 m/sn'ye kadar kaza değil.
  - İniş rehberi (300 m altı, alçalırken): takım kapalıysa uyarı, çok hızlıysa önerilen hız (Cessna 60, L-39 120, F-16 155 kt).
- Benzetimde eller serbest: F-16 250/155/200 kt, L-39 140/180 kt, Cessna 90 kt inişleri patlamadan; tarayıcıda F-16 son yaklaşmadan eller serbest 150 kt ile indi (`tarayici-test.cjs inis`).

## 23 Kasım: uçak ve kumanda

Eymen iPhone'da denedi; uçakla ilgili istekleri ve yapılanlar:

1. **Yön tuşları: 4 ana yön, aynı anda istediğin kadar** (`input.js` → `#dpad`). Sekiz yönlü tek tuş takımı yerine dört ayrı tuş (yukarı = burun yukarı, sağ = sağa yatış). Her parmak ayrı izlenir: yukarı + sağ birlikte basılır, yukarı + aşağı birbirini götürür; parmak kaydırılınca komşu tuşa geçer, iki tuşun arasına basınca ikisi birden basılır. Basılı tuttukça her eksenin komutu ayrı ayrı %35'ten %100'e çıkar (1,2 sn). "Analog" seçeneği aynen duruyor.
2. **Takla ve dik dalıştan çıkış** (`fdm.js` → `_fbw`). Nedenler:
   - *Asıl neden: iniş takımı.* Pistten kalkınca takım elle toplanıyor; açık kalırsa uçuş bilgisayarı yükü 4 g'ye, hücum açısını 15°'ye sınırlıyordu. Takla 42 sn sürüyor, 1,8 km tırmanıyor, 300 kt dik dalıştan çıkmak 1,5 km yiyordu. 400 kt'ta dalıştan çekerken yunuslama yasası elevatörün hız sınırına (60°/sn) takılıp büyüyen bir salınıma giriyor ve uçak −4,5 g'de "yapısal hasar"la dağılıyordu.
   - *Yunuslama yasası yeniden yazıldı:* istenen g'den hücum açısı (kaldırma eğrisinin tersi), hücum açısından yunuslama hızı isteği (α̇ = q − g(nz − cosθcosφ)/V, büyük farkta kök eğrisiyle sınırlı), elevatör de modelin tersinden (istenen yunuslama ivmesi için gereken moment; eylemsizlik bağlaşımı dahil). Kazançlar düşük dinamik basınçta azalır, g sınırlayıcı hücum açısı-g eğimine göre ölçeklenir ve kısa öngörüyle erken davranır, tümlev yalnız sakin uçuşta birikir. Levye bırakılınca uçuş yolu açısı tutulur (ters uçuşta da).
   - Kolay kumandada takım sınırı yalnız iniş düzeninde (400 m altı ve 240 kt altı); havada takım açıkken "Takım açık: TAKIM düğmesiyle toplayın" yazar.
   - Kolay kumandada F-16 daha çevik (oyun için): CLα ×1,2 (girdap kaldırması), kopma 35°, hücum açısı sınırı 28°, en çok 9,5 g, g daha çabuk gelir (çekişte 0,07 sn süzgeç, bırakışta 0,25 sn). Aşırı g kolay kumandada kaza değil.
   - Kanat dengeleyici ve dönüş telafisi dikey yakınında karışmıyor (zaten öyleydi, denendi).
3. **Simgeli düğmeler** (`index.html`): TAKIM, FREN, DUMAN, KAMERA, DUR, BAŞTAN ve yön tuşları gaz koluyla aynı görünümde (yuvarlak köşe, saydam koyu, 52 pt). Kendi çizdiğimiz SVG simgeler. Takım: açıkken yeşil üç lamba, kapalıyken sönük ve katlanmış teker, hareket ederken sarı yanıp söner. Fren basılıyken kırmızı, duman açıkken beyaz yanar, kamera düğmesinin altında kameranın adı. Dar ekranda (iPhone SE) üst bilgiler küçülür.
4. **Kokpit** (`cockpit.js`, yeni). Üç uçağa ayrıntılı iç mekân, her şey kodla ve kanvasla çizildi:
   - F-16 sınıfı: kabarcık kanopi (altın tonlu cam, gökyüzünü belli belirsiz yansıtır), arka kemer ve üç ayna, çalışan yeşil HUD (hız ve irtifa şeritleri, eğim merdiveni dünyaya bağlı, uçuş yolu işareti, gövde ekseni, baş şeridi, g, Mach, hücum açısı, en çok g, radar irtifası, GEAR / AB), combiner camı, iki MFD (hareketli harita; ufuk, hız, irtifa, devir, takım), ICP tuş takımı ve yeşil DED, yedek ufuk, yan konsollar (anahtar ve düğme dokusu), sağda girdiyle oynayan yan levye, solda gazla ileri giden gaz kolu, ACES II benzeri koltuk ve sarı-siyah ejeksiyon kolu, pilotun bacakları, oksijen hortumu.
   - Cessna sınıfı: altılı analog göstergeler (hız, ufuk, irtifa, dönüş koordinatörü, baş, dikey hız) ve devir, yakıt/yağ; radyo yığını, anahtarlar, pusula, ön cam ve ortadaki dikme, kapı pencereleri ve dikmeler, tavan, iki dümen simidi (yunuslamada ileri-geri, yatışta döner), gaz ve karışım düğmesi, koltuklar; ön camdan motor kaputu, pervane ve kanat dikmeleri görünür.
   - L-39 sınıfı: analog pano (hız, büyük ufuk, irtifa, dikey hız, baş, devir, g ölçer, takım lambaları), nişangâh, ön cam çerçevesi ve kanopi kemerleri, ortada levye, solda gaz kolu, arkada eğitmen kokpiti.
   - Çizim üç geçişte: dünya (yakın düzlem eskisi gibi uyarlanır), uçağın dışı (0,2 m), kokpit içi (0,01 m); her geçişten önce derinlik silinir. Uzak arazide derinlik titremesi olmaz, gözün 10 cm önü de kesilmez. Kokpitin ışığı dünyanın güneşini ve gök ışığını her karede kopyalar; orta ve yüksek kalitede kokpit gölgeleri var (kanopi kemeri ve çerçeveler panoya gölge düşürür).
   - Bakınma: boş yerde sürükle (baş boyun ekseni etrafında döner, geriye bakınca koltuk ve kanat görünür), 3 sn sonra ortalanır. Yük altında baş biraz çöker, yüksek hücum açısında ve yerde koşarken hafif sarsıntı.
   - Kokpitte ekrandaki gösterge kutuları gizlenir (F-16'da hepsi, diğerlerinde ufuk/baş).
   - Ses (`audio.js`): kokpitte motor kabin süzgecinden geçer (jette boğuk ve kısık), rüzgar hışırtısı artar, hızla ve sarsıntıyla artan kanopi uğultusu; kamera değişince 0,25 sn'de yumuşakça geçer. Dışarıdaki kameralarda ses uzaklıkla azalır, geçişte Doppler (uçak yaklaşırken tiz, uzaklaşırken pes).
5. **Geçiş kamerasında titreme.** İki neden:
   - *Kamera her karede yeniden yerleşiyordu:* kamera uçağın hız × 9 sn önüne konuyor, uçak 900 m'den uzaklaşınca yeniden konuyordu. Jette (100 m/sn üstü) bu uzaklık hep 900 m'den büyük olduğundan kamera her karede rastgele bir yan kaymayla yeniden konuyordu. Şimdi uçak geçip yerleşme uzaklığının 1,25 katı uzaklaşınca yeniden konur; yakınlaştırma uçağı ekranda aynı boyda tutar.
   - *Aradeğer yoktu:* fizik 240 Hz adımla ilerliyor, ekran her karede 3-5 adım görüyordu; uçak (takipte ise dünya) her karede bir adım (200 m/sn'de 0,8 m) ileri geri sıçrıyordu. Şimdi çizim son iki fizik adımı arasında aradeğerlenir (`ac.prevPos`, `ac.lerpK`, `planeThree()`); bütün kameralar bundan yararlanır.
6. **Dış görünüş:** kanat ucu girdapları (sert çekişte ya da yüksek hücum açısında), 7300 m üstünde yoğuşma izi (jetler), F-16'da yüksek hücum açısında kanat kökü ve LEX üstünde buhar (`effects.js`, kendi gölgelendiricimiz). Dış F-16 kanopisi kokpite uyacak biçimde yükseltildi, pilot yeniden yerleştirildi.

### Sınamalar (23 Kasım)

`node tests/fizik-test.mjs` — yeni bölüm "Kolay kumanda": oyundaki kare döngüsü (60 kare/sn, kanat dengeleyici, hıza göre flap) ve yön tuşu rampasıyla. Son çalıştırma, hepsi geçti:

| Sınama (F-16, kolay kumanda) | Sonuç | Eski yasayla (takım kapalı / açık) |
|---|---|---|
| Takla 300 kt, yön tuşu | 20,2 sn, 694 m tırmanış, en çok 28,4° | 24,1 sn, 956 m / 41,8 sn, 1826 m |
| Takla 380 / 450 kt, yön tuşu | 18,4 sn / 17,3 sn | — |
| Takla 300 kt, sabit %35 | 21,8 sn | 26,2 sn |
| Dik dalıştan çıkış 250 / 300 / 400 kt (tam gaz) | 655 / 652 / 722 m, 6,5 / 5,8 / 4,9 sn | 814 / 816 / 810 m; takım açık 1459 m ve 400 kt'ta parçalanma |
| Dik dalış 300 kt, gaz %30 | 688 m | 875 m |
| Takım açık unutulmuş, dalıştan çıkış 300 / 400 kt | 651 / 655 m, salınım yok | 1459 m / −4,5 g'de kaza |
| Ters, 90° yatık, dik tırmanış 150 kt, yatık dalışta tam çekiş | 6 sn'de 136° / 120° / 103° / 122°, salınım ve tutunma kaybı yok | — |
| Çek-bırak (F-16 200/350/500 kt, L-39 250 kt, Cessna 100 kt) | uçuş yolu en çok bir kez yön değiştirir | — |
| Eller serbest iniş (F-16 155/200/250, L-39 140/180, Cessna 65/90 kt) | kaza yok | — |

Kolay kumandada Cessna'nın frenle burnu yere gömülüp pervanesinin vurması da giderildi (fren, burun öne yatınca gevşer).

Değiştirilen eski aralık: "450 kt levye tam geri: en büyük yük faktörü" sınaması 520 kt'ta yapılıyor (9,72 g, sınır 9 g). Eski yasa 450 kt / 3000 m'de 9,7 g'ye hücum açısını aşarak çıkıyordu; yeni yasa aşmıyor ve o hızda 25°'de erişilebilen yük ~8,1 g.

`node tests/tarayici-test.cjs http://localhost:8765/index.html kokpit,dugmeler,takla,gecis` — yeni bölümler: `kokpit` (üç uçağın içi, F-16 HUD yakın, geriye bakış; kokpit parçası ve canlı ekran sayısı denetlenir), `dugmeler` (iPhone 13, SE 3. kuşak ve SE 1. kuşak yatay: bütün düğmeler en az 44×44, ekran içinde, üst üste değil; yön tuşlarında iki parmak, yukarı+aşağı, kaydırma, bırakma; takım düğmesinin durumu), `takla` (yön tuşu rampasıyla takla, dört görüntü; dik dalıştan çıkış), `gecis` (geçiş kamerasının yeniden yerleşme sayısı ve uçağın ekranda kare kare sıçraması).

Son çalıştırma (yazılımsal WebGL, ~3-10 kare/sn): kokpitler F-16 72, Cessna 68, L-39 44 parça, canlı ekranlar tazeleniyor; iPhone 13, SE 3. ve 1. kuşak yatayda 8 düğmenin hepsi ≥44×44, ekran içinde, çakışma yok; yön tuşları yukarı+sağ (0,35 / 1,0), yukarı+aşağı (0), kaydırma (yalnız sağ), bırakınca sönük; takım düğmesi "hareket"e geçti. Yön tuşuyla takla 380 kt'tan 362°, 15,6 sn, en çok 28,3° hücum, 8,4 g, 1300 → 1378 m, kaza yok; 300 kt dik dalıştan tam yukarıyla çıkış 547 m. Geçiş kamerası 10 sn'de 0 yeniden yerleşme, 0 kamera sıçraması, uçağın kare başına hızı benzetim hızından %0,00 sapıyor (aradeğerli). Eski bölümler de geçti: Cessna klavyeyle 333 m'de teker kesti; F-16 son yaklaşmadan eller serbest 149 kt ile indi; Boğaz'da levye %80 ile takla 361°, 14,9 sn, en çok 28,0° (eskiden 17,6 sn), tonoz 258°/sn; iPhone 13 yatayda yukarı tuşu burnu kaldırdı. Konsol hatası yok.

Ekran görüntüleri (`docs/ekran/`): `kokpit-f16.jpg`, `kokpit-f16-hud.jpg`, `kokpit-f16-geri.jpg`, `kokpit-c172.jpg`, `kokpit-jet.jpg`, `dugmeler-iphone13.jpg`, `dugmeler-iphonese.jpg`, `takla-1.jpg` … `takla-4.jpg`, `gecis-kamerasi.jpg`.

### Bilinen eksikler (uçak)
- Kokpitler kodla yapıldı: düğme ve anahtarlar dokuda çizili, tek tek basılmaz. Pilotun elleri yok.
- Sıcak hava dalgalanması (lüle arkası kırılma) yok; ekran dokusu kopyalamak telefonda pahalı.
- Kokpit gölgesi yalnız kokpitin kendi parçalarından; uçağın dış gövdesi kokpite gölge düşürmez.

## 23 Kasım: dünya

Eymen'in iPhone denemesinden sonra istekler: "yollar bazen bozuk / tam görünmüyor, harita da; genel hata düzeltme", "pistler gerçek boyutta görünmüyor, Türkiye'deki bütün pistler gerçek ölçüleri ve taksi yollarıyla", "binalar çok küçük bir alanda var ve iki kâğıt gibi duruyor, gerçek 3B olsun", "İstanbul Havalimanı, Sabiha Gökçen, Atatürk, Esenboğa, Adnan Menderes (ve Antalya) gerçek gibi olsun; şimdilik dıştan, içini sonra ekleyeceğim", "dünya inanılmaz gerçekçi görünsün". Bu bölümdeki işler yalnız dünya tarafında (`world.js`, `terrain.js`, `buildings.js`, `bworker.js`, `veri.js`, yeni `havalimani.js`, `havalimanlari/`, `atmosfer.js`, `tools/`, `data/`); `main.js` ve `index.html`'e yalnız yeni başlangıç noktaları eklendi.

### Bulunan hatalar ve kökleri

- **"Kâğıt gibi" binalar:** çatı üçgenleri ters sırayla yazılıyordu (`bworker.js`: düz çatıda `tri(t0, t2, t1)`, kırma çatıda `tri(s, s+2, s+1)`); saat yönü tersine tabanda bu, yüzü aşağı çevirir. Malzeme tek yüzlü olduğundan çatılar yukarıdan hiç çizilmiyor, içi boş kutunun yalnız kameraya bakan iki duvarı görünüyordu. Üstelik binalar ışıkta düz, pencere dokusu tek tipti.
- **Binaların az yerde olması:** binalar yalnız 17 şehrin ~30 km'lik karelerinde vardı ve "orta" kalitede 7.5 km'den sonra hiç çizilmiyordu; 2 km'lik düğümün çocukları hazır değilken hazır olanların yalnız bir kısmı gösterildiği için arada boş bloklar kalıyordu.
- **Yolların bozuk / yarım görünmesi:** yollar yalnız İstanbul'un 7 m/piksellik zemin dokusunda vardı (28.75 × 29 km'lik dikdörtgen); dokunun kenarında birden bitiyor, alçak ve eğik bakışta 1-2 piksellik çizgiler doku küçültmesinde (mipmap) kayboluyordu. Dışarıda hiç yol yoktu.
- **Pistlerin bozuk görünmesi:** pist, araziden 12 cm yüksekte bir düzlemdi; arazi yalnız 62.5 m'lik bölge ızgarasında ve tek pist boyunca düzleştirildiği için uzaktaki kaba arazi düğümleri (500 m'lik veri) pistin içinden çıkıyor, pistle 5 cm altındaki "apron şeridi" uzaktan titreşiyordu (derinlik çakışması). Pistlerin eni 45-60 m'ye sıkıştırılmıştı, taksi yolu yoktu.
- **Harita:** küçük haritada İstanbul dikdörtgeninde başka, dışında başka harita (ölçek ve renk farkı) kullanılıyor; bu `main.js`'te olduğundan bu turda değiştirilmedi (bilinen eksik).

### Havalimanları (`js/havalimani.js`, `tools/havalimanlari.py`)

- **Veri:** OpenStreetMap'teki bütün `aeroway` nesneleri (osmium ile Türkiye özütünden): 112 havalimanı / pist alanı, 145 pist (141 kaplamalı), 4063 taksi yolu çizgisi, 418 apron, 2955 park yeri çizgisi, 250 yolcu köprüsü, 381 bekleme noktası, 352 PAPI, terminal ve hangar tabanları. Aynı pistin parçaları birleştirilir, uçlar gerçek konumlarında; en OSM `width` etiketinden (yoksa uzunluğa göre 45 / 30 / 23 m), taksi yolu 23 m (küçük meydanlarda 12-15 m). Pist numaraları OSM `ref`'ten, gerçek başla tutarsızsa manyetik baştan (sapma 5.5° D).
- **Arazi:** her havalimanının kaplamalı alanı (+ pist çevresinde 75 m, taksi yolunda 30 m pay) tek yükseklikte düzleştirilir, 450 m'de doğal araziye geçer. Bölgelerin içindekiler bölge ızgarasında (62.5 m), dışındakiler için AWS Terrain Tiles z11'den 62.5 m'lik ayrı yamalar (`hava/z_*.png`) üretilir; 500 m'lik temel karolar da kabaca düzleştirilir (uzaktan tepe gibi görünmesin). Asıl ızgaralar `tools/raw/asil/`'de saklanır, araç her çalıştırmada onlardan başlar.
- **Çizim:** havalimanı uçağa 30 km yaklaşınca kurulur, 45 km'de atılır. Katmanlar ayrı çizimler: apron (beton derzli), taksi yolları (asfalt, sarı orta çizgi, omuzlar, bağlantı diskleri), pist, çizgiler (park yeri, bekleme noktası). Pist çizgileri tek bir gölgelendiricide, gerçek ölçülerle hesaplanır (ICAO Ek 14): eşik çizgileri (pist enine göre 4-16 çizgi, 30 m), numara ve L/C/R harfi (9 m), 30 m çizgi / 20 m boşluklu orta çizgi, temas bölgesi çizgileri (150 m arayla), nişan noktası (400 m), kenar çizgileri, beton derzleri, lastik izleri. Arazi altında düzleştirildiği için yüzeyler araziyle aynı düzlemdedir; titreşmesin diye kırpma uzayında sabit bir derinlik payıyla öne alınırlar (katmanlar arasında da sıra var). Işıklar: pist kenarı (60 m), eşik (yeşil), uzun pistlerde 900 m yaklaşma ışık sistemi (direkler, 300 m çapraz çubuk), PAPI (OSM'den ya da nişan noktasında; ışık rengi bakış açısına göre gölgelendiricide beyaz/kırmızı), rüzgar tulumları.
- **Fizik:** `world.ground()` pist, taksi yolu ve apronlarda `{h: yükseklik + 0.12, kind: 'runway'}` döndürür (50 m'lik hücre ızgarası, çokgen içinde nokta). Terminal, hangar ve kulelere çarpmak kazadır.
- **Başlangıç noktaları:** eski arayüz korunur (`world.rws` her havalimanının ana pisti; `STARTS` aynı çalışır). Yeni: Sabiha Gökçen, Dalaman, Milas-Bodrum, Gaziantep, Diyarbakır, Samsun Çarşamba.
- **Bütün havalimanlarında:** OSM'deki terminaller cam cepheli, hangarlar kemerli çatılı, kuleler (OSM'de varsa) genel bir kule biçiminde; park yerlerinde (%35) kendi yaptığımız yolcu uçakları (A320 ve geniş gövde boyutunda, beyaz gövde, renkli kuyruk; hiçbir havayolunun işareti yok).

#### Ayrıntılı havalimanları ve iç mekân için yapı

`js/havalimanlari/<icao>.js` (ltfm, ltfj, ltba, ltac, ltbj, ltai) havalimanı kurulurken tembel yüklenir ve `build(ctx)` çağrılır. Ortak parçalar `js/havalimanlari/ortak.js`'te: `terminal()` (OSM tabanından cam cephe, saçaklı çatı, çatı ışıklıkları / dalgalı ışıklık / kemer), `towerTulip()` (İstanbul Havalimanı'nın lale biçimli kulesinden esinlenen burgulu gövde ve geniş kabin, 90 m), `towerModern()`, `towerClassic()`, `jetBridges()` (OSM'deki köprüler ya da terminale yakın park yerleri için kendiliğinden, döner gövde ve tekerlekli ayakla), `vehicles()` (apron otobüsü, yakıt tankeri, çekici), `standard()`.

- Her havalimanı `THREE.Group` adı `havalimani:<ICAO>`; içinde her terminal ayrı bir grup: ad `terminal:<OSM kimliği>`, `userData = { id, ad, taban (havalimanı merkezine göre yerel x doğu / y kuzey, m), yukseklik, katYuksekligi, kotu }`. Cephe (`cephe`), çatı (`cati`), ışıklık (`isiklik`), zemin şeridi (`zemin`) ayrı ağlardır. Kule `kule` (İstanbul'da apron kulesi `kule:apron`).
- İç mekân eklemek için: `ctx.parts.get('terminal:…')` grubuna çocuk olarak eklenir; dış kabuk ayrı ağlarda olduğu için uçak terminale yaklaşınca `cephe`/`cati` gizlenebilir ya da yarı saydam yapılabilir. Taban çokgeni ve kat yüksekliği iç planı oturtmak için hazır; havalimanı yüksekliği `ctx.d.elev`.
- Ayrıntılı modül bir terminali kendisi çizdiği için o terminalin OSM binası genel bina paketlerinden çıkarılır (`tools/raw/hava_haric.json`).

### Binalar (`js/buildings.js`, `js/bworker.js`, `tools/binalar_tr.py`)

- **Kapsam:** Türkiye'deki bütün OSM binaları: **5 711 490 bina**, 95 paket (`bina/q_*.png`, 128 km'lik karelerden başlayıp 260 000 binadan kalabalıkları 32 km'ye kadar bölen dörtlü ağaç), ~71 MB (yollarla). Paket, kamera 34 km'ye (orta kalitede ~24 km) yaklaşınca yüklenir. Etiketsiz binalara kat, bulunduğu 1 km'deki bina sıklığına göre verilir (köyde 1-2, kasabada 1-5, şehirde 2-8, İstanbul'da 2-7 kat), konuma bağlı kararlı rastgele.
- **Gerçek 3B:** çatılar düzeltildi; duvarlarda cephe dokusu atlası (kodla çizilen 9 karo: sıvalı pencereli, balkonlu apartman, cam giydirme, bant pencere, taş/kemerli, sanayi paneli, zemin katta dükkân vitrini, çakıllı düz çatı, kiremit), pencere sayısı duvar boyuna tam sığar, pencerelerde kat ve bölmeye göre ton farkı ve gökyüzü yansıması (Fresnel). Duvar dibi koyulaşır (ortam kapatma), yüzlerde güneşe göre ışık. Çatılar: küçük konutlarda saçaklı kırma ya da beşik (kalkanlı) kiremit çatı (dikdörtgene yakın tabanlarda), apartmanlarda korkuluklu düz çatı ve merdiven/asansör kulübesi, sanayide düz çatı.
- **Ayrıntı düzeyleri (LOD):** 1 km düğüm tam taban + çatı + korkuluk; 2 km sade taban (8'den çok köşe yönlü sınırlayıcı dikdörtgen), küçükler yok; 4 km orta/büyük binalar kutu; 8 km yalnız yüksek (≥ 28 m) ya da çok büyük binalar. Uzaklıklar (orta / yüksek): 1.2 / 2.2 km, 3.3 / 6 km, 10.9 / 18.9 km, 24 / 34 km. Daha uzakta şehirler zeminde: örtü dokusunun şehir kanalına bina sıklığı yazıldı (`tools/sehir_dokusu.py`), arazi gölgelendiricisi oralarda eğri sokak ızgarası, parsel parsel çatı renkleri ve yeşil adacıklar çizer (yakında düz kaldırım rengine döner). Geometri işçide, düğüm başına tek çizim çağrısı, çerçeve dışındakiler çizilmez; çocuk düğümler hazır değilse ebeveyn gösterilir (boşluk kalmaz).
- **Yollar:** otoyol, devlet yolu, birincil, ikincil yollar ve bağlantıları her yerde, üçüncül yollar yerleşim içinde (OSM `highway`, 300 m'lik parçalar, bina paketlerinin içinde). İşçide araziye oturan şeritler olarak üretilir (köprüler uçları arasında doğrusal, tünel yok); gölgelendiricide asfalt, kenar çizgileri, kesikli orta / şerit çizgisi. Yakında hepsi, uzaklaştıkça yalnız büyük yollar çizilir. İstanbul'daki zemin dokusunun üstüne de keskin çizilir.
- **Ağaçlar:** bölgelerde eski 16 m'lik OSM ağaç rasterı; bölgelerin dışında örtü dokusundaki orman oranına göre 1 km'lik hücrelere örneklenmiş ağaç (yüksekte iğne yapraklı).

### Atmosfer ve ışık (`js/atmosfer.js`)

- ACES ton eşleme; güneş 2.9, gök/yer yarımküre ışığı. Gökyüzü: Rayleigh benzeri mavi (ufka doğru optik derinlikle açılır), güneş çevresinde Mie (Henyey-Greenstein) parlaması, güneş diski.
- Sis three.js'in `fog` parçaları değiştirilerek bütün malzemelerde: yüksekliğe göre üstel azalan yoğunluk (1/1900 m), rengi bakış yönündeki ufuk gökyüzü (hava perspektifi; güneş tarafı sıcak). Arazi sisin %99 örttüğü uzaklıkta kesilir.
- Su: derin deniz rengi, aynı gökyüzü işleviyle Fresnel yansıması, güneş parıltısı.
- Kümülüs bulutları: 1700-2600 m'de, kameranın çevresinde sarmal 48 km'lik alanda ~800 yumuşak kare (tek örneklenmiş çizim), içinden geçerken saydamlaşır.
- Gölgeler yalnız "yüksek" kalitede: güneşten 2048² gölge haritası, uçağın çevresinde 640 m; uçak gölge düşürür.

### Başarım (yazılımsal WebGL, Playwright; çizim çağrısı ve üçgen cihazdan bağımsız)

Veri oturduktan sonra (kamera hareketsiz):

| Görünüm | Kalite | Çizim çağrısı | Çizilen üçgen | Önce (eski dünya) |
|---|---|---|---|---|
| Boğaz, 650 m, iPhone 13 yatay | orta | 187 | 1.06 milyon | 147 / 0.65 milyon |
| İstanbul, 600 m | orta | 180 | 1.19 milyon | — |
| İstanbul, 120 m (yoğun mahalle) | orta | 183 | 1.14 milyon | — |
| Levent-Maslak, 380 m | orta | 118 | 0.40 milyon | — |
| İstanbul Havalimanı, 300 m, terminal ve uçaklar | orta | 182 | 0.39 milyon | 142 / 0.89 milyon |
| Atatürk pisti, 8 m (yakın) | orta | 195 | 1.45 milyon | — |
| İstanbul, 600 m | yüksek | 254 | 2.49 milyon | 188 / 1.23 milyon |
| Eskişehir, 450 m | yüksek | 243 | 1.12 milyon | 192 / 0.70 milyon |
| İstanbul üstü, 3500 m | yüksek | 215 | 1.34 milyon | 132 / 0.27 milyon |

"Orta" (dokunmatik varsayılanı) hedefin içinde (≤ 250 çağrı, ~1.5 milyon üçgen); "yüksek" masaüstü içindir (gölgeler, daha uzak binalar). Uzak bir yere ışınlanınca (deneme kancasıyla) veri yüklenirken birkaç saniye eski ve yeni düğümler birlikte durduğu için sayılar geçici olarak yükselir. Yazılımsal WebGL'de dünya ağırlaştığı için `tarayici-test.cjs kalkis` verinin oturmasını daha uzun bekler; kalkış 335 m'de teker kesti, iPhone denemesi geçti, `node tests/fizik-test.mjs` hepsi geçti. Açılışta yüklenen ek veri yalnız `hava.json` (48 KB) ve `bina.json` (~10 KB); geri kalanı akışla gelir. `www/` toplam ~91 MB (en büyük dosya 3.6 MB).

### Ekran görüntüleri (`docs/ekran/`)

`once-*.jpg` değişiklikten önce, `son-*.jpg` sonra (aynı yerler): `istanbul-600` (İstanbul, 600 m), `levent-maslak`, `istanbul-alcak` (120 m), `ltfm`, `terminal-ltfm`, `pist-ltfm` (pist yakın: 17R işaretleri), `ltfj`, `ltba`, `pist-yakin` (Atatürk 05), `ltac`, `ltbj`, `ltai`, `kucuk-sehir` (Sivas), `eskisehir`, `yuksek-irtifa`, `telefon-bogaz` ve `telefon-ltfm` (iPhone 13 yatay, orta). Ölçümler `once-olcum.json` / `son-olcum.json`. Deneme: `node tests/dunya-test.cjs [adres] [önek] [görünümler] [kalite]` (önce `www/` içinde sunucu).

### Lisanslar (yeni)

Yeni dışarıdan varlık yok: bütün dokular (cephe atlası, pist yazıları, bulut, su dalgası) ve modeller (terminal, kule, yolcu uçağı, köprü, araç) kodla üretildi. Veri: OpenStreetMap (ODbL; havalimanları, binalar, yollar), AWS Terrain Tiles (havalimanı yamaları için z11 karoları; kaynakları SRTM vb.). Atıf menüde ve uçuş ekranında zaten var.

### Bilinen eksikler (dünya)

- Küçük harita İstanbul dikdörtgeninde başka, dışında başka resim kullanıyor (geçişte ölçek ve renk sıçraması); `main.js`'te, bu turda değiştirilmedi.
- Mahalle içi sokaklar (OSM `residential`) yok; yalnız ana yollar ve kasaba içindeki üçüncül yollar. İstanbul'da zemin dokusundaki sokaklar 7 m/piksel.
- Arazi bölgelerin ve havalimanı yamalarının dışında 500 m çözünürlükte; o şehirlerde binalar bu yüzeye oturur (tepeler yumuşak).
- Havalimanı yüksekliği tek değer (eğimli pistler düz); uçuşta düzleşme yalnız kaplamalı alan + 450 m.
- Terminaller OSM tabanından genel biçimde (cam cephe, saçak, ışıklık); gerçek çatı biçimleri ve iç mekân yok. Atatürk'ün yolcu terminali OSM'de `building=airport` olarak işaretli olduğundan genel biçimde çizilir.
- Park etmiş uçaklar tek gövde tipi (iki boy), iniş takımı ve kapı ayrıntısı basit; yolcu köprüleri yalnız OSM'de olan ya da terminale yakın park yerlerinde.
- Bulutlar düz kareler (hacimli değil), gölge düşürmez; gece yok, güneş sabit.
- Yazılımsal WebGL'de kare hızı düşük olduğundan gerçek iPhone'da ölçülmedi.
