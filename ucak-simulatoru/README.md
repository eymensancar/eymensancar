# İstanbul Uçuşu

Tarayıcıda çalışan, İstanbul üzerinde geçen bir uçuş benzetimi. Boğaz, Haliç, Marmara kıyısı, tarihi yarımada, köprüler ve Levent-Maslak gökdelenleri gerçek konumlarında. Varsayılan kamera uçağın arkasından takip eder (dışarıdan görünüş); istenirse kokpit ve "geçiş" kamerası seçilir. Fizik oyun tipi değil, 6 serbestlik dereceli katı cisim modelidir ve gerçek uçak değerleriyle sınanmıştır (aşağıda).

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
| Yunuslama | `S` / aşağı ok: levye geri, burun yukarı. `W` / yukarı ok: burun aşağı | sağdaki sanal levye | sol çubuk |
| Yatış | `A` `D` / sol sağ ok | sanal levye | sol çubuk |
| Dümen | `Q` `E` | SOL DÜMEN / SAĞ DÜMEN | sağ çubuk |
| Gaz | `Shift` artır, `Ctrl` azalt; `+` `-`, `PageUp` `PageDown`; `1`…`9`, `0` = tam gaz | soldaki gaz kolu | RT / LT |
| Flap | `F` indir, `V` topla | FLAP+ / FLAP- | A / X |
| Fren | `B` ya da boşluk (basılı) | FREN (basılı) | B |
| Trim | `Z` burun aşağı, `X` burun yukarı, `T` o anki levyeyi trime al | TRİM YUKARI / AŞAĞI | LB (trime al) |
| İniş takımı (jet) | `G` | TAKIM | RB |
| Kamera | `C` (takip, kokpit, geçiş); fareyle sürükle: etrafına bak; tekerlek: uzaklık | KAMERA; boş yerde sürükle | Y |
| Diğer | `P` duraklat, `R` baştan, `M` ses, `L` motor kapat/aç, `H` yardım | DUR, BAŞTAN | Start, Back |

Menüde: uçak (Cessna 172 sınıfı ya da L-39 sınıfı jet eğitim uçağı), başlangıç (pistten kalk / havada başla / inişe yaklaş), rüzgar (yok / hafif poyraz 8 kt / kuvvetli 18 kt, hamleli), grafik kalitesi, otomatik dümen, yunuslama yönü, telefonda eğerek kumanda (deneysel, kapalı gelir).

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

Jet eğitim uçağı (L-39 sınıfı, 4400 kg): durum hızı 113 kt (flapsız) / 92 kt (tam flap), kalkış koşusu 717 m, azami hız 391 kt (deniz seviyesi), tırmanma 4650 ft/dk, yuvarlanma 161°/sn, 300 kt dengede sabit.

## Harita verisi ve lisanslar

- **isometricistanbul.com incelendi, kullanılmadı.** Site, İBB'nin 3B İstanbul modelinin görüntülerinden yeniden çizilmiş 2B izometrik bir resim haritası; indirilebilir 3B veri sunmuyor. Kullanım koşulları ticari kullanımı, görüntülerin toplu ve otomatik alınmasını ve yapay zekâ eğitiminde kullanılmasını izne bağlıyor; robots.txt yapay zekâ tarayıcılarını engelliyor. Bu yüzden sitenin hiçbir görseli ya da verisi alınmadı.
- **OpenStreetMap** (ODbL 1.0, © OpenStreetMap katkıda bulunanlar): kıyı çizgisi, göller, park ve ormanlar, yollar, demiryolu, havalimanı, köprüler ve bina tabanları (yükseklik ve kat etiketleriyle). Overpass API üzerinden alındı (overpass-api.de ve kumi.systems bu ortamdan erişilemedi; aynı Overpass yazılımını çalıştıran maps.mail.ru kullanıldı). Atıf oyunda menüde ve uçuş ekranının köşesinde yazılı. Türetilmiş veri (`www/data/`) de ODbL kapsamındadır.
- **Yükseklik:** AWS Terrain Tiles (Terrarium PNG, z12, herkese açık; kaynakları SRTM, GMTED2010, ETOPO1 vb., bkz. github.com/tilezen/joerd/blob/master/docs/attribution.md).
- **three.js** 0.160.0, MIT lisansı (`www/vendor/three.module.min.js`).
- Simge yapılar elle, basit şekillerle modellendi; konumları OpenStreetMap / bilinen koordinatlar.

### Veriyi yeniden üretmek

```
bash tools/fetch_osm.sh        # OSM ham verisi -> tools/raw/ (depoya girmez), parça parça, yavaş
python3 tools/fetch_dem.py     # yükseklik karoları -> tools/raw/dem/
python3 tools/build_data.py    # -> www/data/ (numpy, scipy, Pillow gerekir)
```

`www/data/` içeriği: `zemin.webp` (4096², kara dokusu; alfa = kara), `maske.png` (kara/su), `yukseklik.b64.txt` (385² ızgara), `binalar.b64.txt` (120 000 bina, 2 km'lik parçalar; ikisi de ikili verinin base64 hâli, çünkü artifact sunucusu .bin sunmuyor), `kopruler.json`, `pist.json`, `harita.png` (küçük harita).

## Dünya nasıl çiziliyor

- Alan: Atatürk Havalimanı ile Ataşehir arası doğu-batı, Yenikapı/Kadıköy ile Yavuz Sultan Selim Köprüsü arası kuzey-güney (yaklaşık 28.5 × 28.9 km; merkez 41.085 K, 28.97 D).
- Arazi tek örgü (385² köşe, kenarlarda sise karışan uzantı); üzerine OSM'den çizilmiş 4096² doku (yollar, parklar, ormanlar, bina tabanları). Kıyı keskin görünsün diye denizdeki pikseller dokunun alfa kanalıyla atılır ve altında parlayan su düzlemi görünür.
- Binalar: OSM tabanlarından yükseltilmiş prizmalar, pencere dokusu, kırmızı kiremit ya da gri çatı. 2 km'lik parçalar ayrı bir işçide (Web Worker) birleştirilip kameraya yakın olanlar yüklenir, uzaktakiler bellekten atılır. Camilere kubbe ve minare eklenir (örneklenmiş çizim).
- Elle modellenenler: Galata Kulesi, Kız Kulesi, Ayasofya, Sultanahmet Camii (6 minare), Süleymaniye, Rumeli Hisarı, Çamlıca Kulesi, Büyük Çamlıca Camii, 15 Temmuz Şehitler, Fatih Sultan Mehmet ve Yavuz Sultan Selim köprüleri (kuleler, ana kablolar, askılar), Galata ve Atatürk köprüleri. Dolmabahçe Sarayı OSM'deki ayrıntılı tabanlarından beyaz saray rengiyle çizilir. Levent-Maslak gökdelenleri OSM yükseklik etiketlerinden gelir.
- Köprülerin altından geçilebilir; tabliyeye, kulelere ve binalara çarpmak kazadır.

## Alınan kararlar (kullanıcı uyurken, sorulmadan)

1. **Harita kaynağı:** isometricistanbul.com 3B veri vermediği ve koşulları yeniden kullanıma izin vermediği için OpenStreetMap kullanıldı.
2. **Pist:** Atatürk Havalimanı'nın 17/35 pistleri kaldırıldığı için (OSM'de yok) bugün duran 05/23 pisti (OSM koordinatları, 2713 m, 60 m) seçildi. Kalkış 05 yönünde (058°), şehir önde.
3. **Başlangıç seçenekleri:** "Pistten kalk", "Havada başla" (Kız Kulesi açıkları, 450 m, kuzeye Boğaz'a dönük, dengeli) ve iniş alıştırması için "İnişe yaklaş" (pist 05, 3° süzülüş, flap 20°).
4. **İkinci uçak:** L-39 sınıfı jet eğitim uçağı (uç tankları, katlanır takım). Gerçek bir kuruluşun renkleri ya da işareti kullanılmadı.
5. **Yunuslama yönü:** uçuş benzetimlerindeki kural (yukarı tuşu/levye ileri = burun aşağı); menüden ters çevrilebilir.
6. **Ctrl tuşu:** istendiği gibi gazı azaltır, ama tarayıcılar Ctrl+W gibi kısayolları engellemeye izin vermez; bu yüzden `-`, `PageDown` ve rakam tuşları da eklendi ve yardımda uyarı var.
7. **Otomatik dümen** varsayılan açık: havada yan kaymayı siler, yerde levyenin yatış girdisi burun tekerini çevirir (dokunmatikte pedal tutmak zor olduğu için). Kapatılınca dümen tamamen elle.
8. **Eğerek kumanda** kapalı gelir; açılınca iOS izin ister.
9. **Bina sayısı** 120 000 ile sınırlandı (alandaki OSM binalarının bir kısmı): önce yükseklik etiketi olanlar, camiler, gökdelenler ve büyük tabanlılar tutulur. Atılan binalar zemin dokusunda taban olarak görünür. Etiketsiz binalara konuma göre kararlı rastgele 2-7 kat verildi.
10. **Grafik kalitesi** dokunmatik cihazda "orta" (piksel oranı 1.5, binalar 6.5 km), masaüstünde "yüksek" (2, 9 km); "düşük" dokuyu 2048'e indirir.
11. Günün saati sabit (öğleden sonra, güneybatıdan güneş), gölge yok (performans için).
12. Ayarlar `localStorage` anahtarı `istanbul-ucusu-v1` altında saklanır.

## Testler

- `node tests/fizik-test.mjs`: fizik sınamaları (yukarıdaki tablo).
- `node tests/tarayici-test.cjs`: önce `www/` içinde `python3 -m http.server 8765`. Playwright ile sayfayı açar, konsol hatası arar, klavyeyle kalkış yapar (pistte yön tutarak), manzara görüntülerini ve iPhone yatay (844×390, dokunmatik) görüntüsünü `docs/ekran/` içine alır, dokunmatik levyeyi dener.
- Test kancası: `window.__ucak` (`ac` uçak durumu, `world`, `input`, `place(enlem, boylam, irtifa, baş, kt)`, `setCam(0|1|2)`, `orbit(yaw, pitch, uzaklık)`).

## Bilinen eksikler

- Binalar basit prizma; çatı biçimleri ve doku çeşitliliği az. Bina sayısı sınırlı olduğu için yoğun mahallelerde küçük binaların bir kısmı yalnız zemin dokusunda.
- Köprülerin yaklaşma viyadükleri basitleştirildi; asma köprü kabloları çizgi olarak çizilir ve çarpışmaya girmez.
- Büyük Çamlıca Camii OSM'de bina olarak bulunamadı; konumu yaklaşık.
- Bina çarpışması 16 m'lik ızgarayla yapılır; ince binaların kenarında birkaç metre hata olabilir.
- Gölge, gece, bulut ve su yansıması yok (su parlaklığı ve Fresnel benzeri gökyüzü rengi var).
- Pervane etkileri (P etkisi, iz akımının kumanda yüzeylerine etkisi) basitleştirildi; jet modeli daha kabadır.
- Yazılımsal WebGL ile yapılan testlerde kare hızı ölçülemez; gerçek iPhone'da denenmedi. Masaüstü yüksek kalitede bir karede ~55 çizim çağrısı ve ~0.75-0.85 milyon üçgen çiziliyor.
- Yerde burun tekeri ve dümen hızlı, tam (açık-kapalı) girdiyle salınım yapabilir; kısa dokunuşlarla düzeltmek gerekir. Yanlamasına kayan uçak burnunun üstüne yatabilir (pervane yere vurur).
