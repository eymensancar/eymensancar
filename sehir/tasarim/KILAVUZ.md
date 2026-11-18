# Elle tasarım katmanı: kılavuz

Tasarımcılar ve testçiler için. Bu belge + `docs/HARITA_TASARIM.md` (bağlayıcı ilkeler ve hedefler) çalışmak için yeterlidir.
Katmanın kodu `tasarim.js`; veriler `tasarim/<bölge>/*.js`; araçlar `test/*.cjs`.

## 1. Temel bilgiler

- **Koordinat:** birim metre. **+x doğu, −z kuzey** (haritada kuzey yukarı; z aşağı doğru artar). y yükseklik.
- **Yön (araçlarda):** pusula açısı, derece: 0 = kuzey (−z), 90 = doğu (+x), 180 = güney (+z), 270 = batı. (Oyunun iç `yaw`'ı radyan: ileri = (sin yaw, cos yaw); yaw = π − pusula.)
- **Su kuralı:** deniz, göl ve nehir yüzeyi dünyanın her yerinde **y = 0**'dır. Su isteyen yer 0'ın altına iner; nehir yatağı 0'ın altındadır ve çevre arazi nehre doğru alçalır. **Yüksekte akan nehir, yüksek göl, şelale YOK.** 0,25 m'den sığ su yürümeyi etkilemez; 0,25–1,2 m yavaşlatır; 1,3 m'den derinde karakter yüzer (1,45 m/sn).
- **Hızlar:** yürüme 1,55 · hafif koşu 3,6 · depar 6,4 m/sn. Karada hız eğimden etkilenmez; fizik dik yamacı engellemez. "45°'den dik = geçilmez" bir **tasarım kuralıdır**: ölçüm aracı böyle sayar, yürüme aracı böyle yerde `dik_yamac` olayı yazar.
- **Kaya kuralı:** kayalar su kıyısında, yamaç dibinde, uçurum kenarında olur; düzlük ortasında durup dururken kaya/ağaç olmaz.
- **Çözünürlük:** arazi ağı yakında 4 m aralıklıdır. 4 m'den dar şekiller (ince hendek, 2 m'lik patika basamağı) arazide görünmez; patika dokusu benekli çıkar. Uzakta (≈ 500 m ötesi) ızgara 16 m, daha uzakta 64 m'dir.

## 2. Dosya düzeni ve katmanlar

Her bölge bir klasördür. `b001` (doğuş bölgesi) için dosyalar hazır ve `index.html`'e bağlıdır (index.html'e dokunmanız gerekmez):

| Dosya | Katman | Sıra | İçerik |
|---|---|---|---|
| `tasarim/b001/bolge.js` | `bolge` | 0 | sınır, geçiş bandı, taban, mikro engebe, doğuş |
| `tasarim/b001/arazi.js` | `arazi` | 10 | tepe, sirt, vadi, ucurum, teras, cukur, kaya_cikinti |
| `tasarim/b001/su.js` | `su` | 20 | gol, nehir, kiyi |
| `tasarim/b001/yerlesim.js` | `yerlesim` | 30 | duzluk/plato, patika; yerleşim ve geçit noktaları |
| `tasarim/b001/bitki.js` | `bitki` | 40 | koru, aciklik, taslik, cali_alani, yasak, zemin, kaynak |
| `tasarim/b001/isaret.js` | `isaret` | 50 | tek tek nesneler, işaret/manzara/kaynak noktaları |

Her dosya `SO.tasarim.bolge({ id: 'b001', katman: '...', sekiller: [], alanlar: [], nesneler: [], noktalar: [] })` çağırır; aynı `id` ile yapılan her çağrı bölgeye katman ekler. **Her tasarımcı yalnız kendi dosyasını yazar.**

**Uygulama sırası:** önce katman sırası (yukarıdaki sayı; küçük olan önce), aynı katmanda dizideki sıra. Dosyaların yüklenme sırası önemsizdir. Şekiller o ana kadarki yüksekliğin üstüne işler: önce `arazi` (dağ, vadi), sonra `su` (nehir araziyi oyar), sonra `yerlesim` (düzlük ve patika en son, her şeyin üstüne). Bir katmanda her türden öğe yazılabilir (tablo yalnız iş bölümüdür); özel sıra gerekirse çağrıya `sira: 25` yazın.

**Bölge etkin değilken** (b001 şablonu: `sinir` yok) hiçbir şey değişmez; oyun yalnız algoritmayla çalışır. `sinir` yazıldığı an bölge etkinleşir.

**Deneme bölgesi:** `tasarim/deneme/bolge.js` bütün ilkelleri gösteren örnektir (oyuna dahil değil). Adres sonuna `?tasarim=deneme`, araçlarda `--tasarim deneme`. `?tasarim=yok` katmanı kapatır (karşılaştırma için). `?tasarim=a,b` yalnız o bölgeleri etkin bırakır; index.html'de satırı olmayan bölge `tasarim/<ad>/bolge.js` dosyasından yüklenir.

Veri dosyaları düz JavaScript'tir: döngü, yardımcı işlev, sabit kullanabilirsiniz. Rastgelelik gerekirse `SO.tasarim.rnd(tohum)` (tohumlu; `Math.random` KULLANMAYIN: dünya her açılışta aynı olmalı). Hatalı veri (bilinmeyen tip, eksik parametre) oyunun açılışında dosya/katman/sıra bilgisiyle hata verir; araçlar bu hatayı yazıp çıkar.

## 3. Bölge tanımı (`bolge.js`)

```js
SO.tasarim.bolge({
  id: 'b001', ad: 'Doğuş bölgesi',
  sinir: [[400, -100], [2400, -100], [2400, 1900], [400, 1900]],   // çokgen | { kutu: [x0, z0, x1, z1] } | { daire: [x, z, r] }
  gecis: 150,                      // sınırdan içeri bu kadar metrede prosedürel araziyle kaynaşır (100–200)
  taban: { kip: 'prosedurel' },    // aşağıya bakın
  engebe: { genlik: 4, olcek: 170 },   // isteğe bağlı orta ölçekli dalga (± genlik m, dalga boyu ≈ olcek m)
  mikro: { genlik: .4, olcek: 24 },    // küçük tümsekler (tepe-çukur ≈ genlik m); false = kapalı
  varsayilan: 1,                   // prosedürel ağaç/kaya yoğunluğu çarpanı: 1 = aynen, 0 = yalnız tasarlanan nesneler
  dogus: { x: 1290, z: 990, yon: 20 }   // doğuş noktası; çevresindeki 9 m nesnesiz kalır. Düzlüğünü siz kurarsınız (duzluk)
});
```

- **Geçiş bandı:** sınırın içindeki ilk `gecis` metrede tasarım ağırlığı 0'dan 1'e çıkar (yükseklik = prosedürel × (1 − w) + tasarım × w; nesneler de aynı ağırlıkla). Sınıra yakın şekiller silikleşir: **önemli her şeyi sınırdan en az `gecis` kadar içeride tutun.** Bandın iki ucundaki yükseklik farkı büyükse (tasarım 10 m, dışarısı 100 m) bantta dik ve düz bir şev oluşur: kenarlarda tabanı prosedürel araziye yakın tutun (`kusbakisi --tasarim yok` ile dışarının yüksekliklerine bakın).
- **Nehir sınırda biter:** bölge kenarına giden nehir geçiş bandında kaybolur. Nehri bölge içinde bir göle/kıyıya bağlayın ya da prosedürel bir suya doğru bitirin.
- **Bölge dışı:** hiçbir şey değişmez; maliyet yok.

### Taban

| `kip` | Anlamı | Parametreler |
|---|---|---|
| `prosedurel` (varsayılan) | algoritmanın arazisi kalır, şekiller ona eklenir | `carpan`, `orta`, `ek`: y = orta + (h − orta) × carpan + ek (ör. `carpan: .4, orta: 12` engebeyi kısar) |
| `duz` | tek yükseklik | `y` |
| `noktalar` | denetim noktalarından geçen yumuşak yüzey (prosedürel yok sayılır) | `noktalar: [[x, z, y], ...]` (en az 3; 10–40 nokta idealdir), `adim: 32` |
| `izgara` | kaba yükseklik ızgarası, arası yumuşak | `x0, z0, adim, nx, y: [satır satır nx × nz sayı]` (satırlar kuzeyden güneye, her satır batıdan doğuya) |

`noktalar` kipinde yüzey noktaların arasında hafifçe taşabilir; köşelere ve kenar ortalarına nokta koyun. Üç katman kuralı: büyük yükselti = taban + şekiller, orta tepe = `engebe` + küçük `tepe`ler, küçük ayrıntı = `mikro`.

## 4. Şekil ilkelleri (`sekiller`)

Ortak: `tip` zorunlu; `ad` isteğe bağlı (haritada etiket). Çizgi = `cizgi: [[x, z], [x, z], ...]`. Alan = `alan:` çokgen `[[x, z], ...]` | `{ daire: [x, z, r] }` | `{ kutu: [x0, z0, x1, z1] }`. `puruz` kenarları ve yüzeyi gürültüyle doğallaştırır (0 = cetvelle çizilmiş gibi). Çizgileri az noktayla dümdüz çizmeyin: 100–200 m'de bir nokta, hafif kıvrımlı.

| `tip` | Ne yapar | Parametreler (varsayılan) |
|---|---|---|
| `tepe` | tek yükselti | `merkez: [x, z]`, `yaricap: r` ya da `[rx, rz]`, `aci` (derece, elips dönüşü), `yukseklik` (20; eksi = çanak), `profil`: `'yuvarlak'` \| `'sivri'` \| `'plato'`, `duz` (.45: platoda düz tepe oranı), `puruz` (.35) |
| `sirt` | çizgi boyunca dağ sırtı | `cizgi: [[x, z, yükseklik, yarıGenişlik], ...]` (3. ve 4. sayı noktaya özel; yoksa `yukseklik` (40), `genislik` (120 = sırttan eteğe)), `profil`: `'yuvarlak'` \| `'sivri'`, `kollar: [çizgi, çizgi]` (yan sırtlar; aynı nokta biçimi), `puruz` (.35), `kivrim` (genişliğin %35'i, m: sırt çizgisini doğal dalgalandırır). Uçlarda yüksekliği küçük verin, yoksa sırt yarım kubbeyle biter. Çakışan parçalar toplanmaz, en büyüğü alınır |
| `vadi` / `oluk` | çizgi boyunca alçaltma | `cizgi: [[x, z, derinlik, yarıGenişlik], ...]`, `derinlik` (10), `genislik` (60), `taban` (.3: düz taban oranı; `profil: 'v'` → 0), ya da `kot: y` (taban o mutlak yüksekliğe iner; yalnız alçaltır: dağ geçidi açmak için), `puruz`, `kivrim` |
| `duzluk` / `plato` | alanın içini tek yüksekliğe getirir (yerleşim alanı) | `alan`, `y` (verilmezse o yerin o andaki ortalama yüksekliği), `kenar` (40: dışarıda araziye kavuşma mesafesi), `mikro` (.2: içeride mikro engebenin kalan oranı), `bos` (true: üstünde nesne çıkmaz), `zemin`: `'toprak'` \| `'cakil'` \| `'kum'`. **Garanti:** alanın içinde eğim %2'nin altındadır (mikro 0,4 × 0,2). Dışarıdaki şevin eğimi ≈ 1,5 × yükseklik farkı / `kenar` |
| `ucurum` | çizgi boyunca basamak | `cizgi`, `yan`: `'sol'` \| `'sag'` (**yüksek kalan taraf**, çizginin çizilme yönüne göre: batıdan doğuya çizilen çizginin solu kuzeydir), `yukseklik` (12), `genislik` (8: yar yüzünün yatay eni; 12 m yükseklik / 8 m = çok dik), `etki` (90: yüksek yanın geri alçalma mesafesi), `kip`: `'yukselt'` (varsayılan) \| `'kes'` (alçak yanı oyar), `uc` (40: uçlarda sönme), `puruz` (5 m), `kayalar` (0: dibine serpilecek kaya sayısı). Haritada çentikler yüksek yanı gösterir |
| `teras` | alandaki yamacı basamaklar | `alan`, `basamak` (4 m), `dik` (.3: basamağın şev payı), `kenar` (30), `kot` (0) |
| `cukur` | kuru çanak | `alan`, `derinlik` (5), `kenar` (30), `puruz` (4 m) |
| `gol` | su altına inen havza | `alan`, `derinlik` (4), `sahanlik` (8: yürünen sığ kıyı şeridi), `inis` (14: sahanlıktan derine), `etki` (120: çevre arazinin kıyıya alçaldığı mesafe), `yamac` (.2: çevrenin en çok eğimi), `puruz` (5 m). Kıyı çizgisi alan sınırının ≈ 3 m içindedir. Yüzme derinliği (> 1,3 m) için `derinlik` ≥ 2 |
| `nehir` | çizgi boyunca yatak | `cizgi: [[x, z, genişlik], ...]`, `genislik` (14: su genişliği), `derinlik` (2,2: orta derinlik; < 1,2 yürünür), `kiyi` (10: kıyı sekisi eni), `kiyiY` (.7), `yamac` (.3: vadi yamacı), `etki` (140: nehrin araziyi alçalttığı en çok mesafe), `puruz` (3 m), `sig: [{ nokta: [x, z], uzunluk: 14, ad }]` (yürünerek geçilen sığ geçitler, derinlik `sigDerinlik` = .32; her biri kendiliğinden `gecit` ilgi noktası olur). Yüksek araziden geçirmeyin: `etki` içinde arazi `yamac` eğimiyle nehre iner, ötesi dik kalır; önce `vadi` ile yol açın |
| `patika` | yol | `cizgi`, `genislik` (3), `kenar` (3: yan şev), `guc` (1), `yumusat` (14 m: boyuna pürüz giderme), `rampa` (true: iki uç arasında sabit eğim; uçurumdan/sırttan geçit açar), `toprak` (.9: çıplak toprak dokusu). Patika enine düzleşir (yamaca oyulur), üstünde nesne çıkmaz, ot bitmez. Ağ için uçları aynı noktada buluşturun |
| `kiyi` | deniz/göl kıyı çizgisi | `cizgi` (kıyı çizgisi), `su`: `'sol'` \| `'sag'` (**suyun kaldığı taraf**), `derinlik` (5), `acik` (40: bu kadar açıkta tam derinlik), `suGenislik` (250: suyun çizgiden uzandığı mesafe), `sahil` (14: kumsal eni), `sahilY` (1,2), `yamac` (.25), `etki` (120), `uc` (60), `puruz` (6 m), `kum` (true). Kıyıyı iki yönden zorlar: su yanı 0'ın altına iner, kara yanı sudan çıkar |
| `kaya_cikinti` | yamaçta dik yüzlü kayalık | `merkez`, `yaricap` (16), `yukseklik` (8), `puruz` (.3), `kayalar` (yarıçapa göre; çevresine serpilen kaya sayısı). Dik yüzleri arazi kendiliğinden kaya dokusuyla boyar |

Dik yüzler (eğim ≳ %30) kendiliğinden kaya dokusu alır; `sirt`, `ucurum`, `kaya_cikinti` kayalık görünümü böyle verir.

## 5. Alan ilkelleri (`alanlar`)

Nesneler (ağaç, çalı, kaya) 8 m'lik aday ızgarasına yerleşir: **en sık yerleşim ≈ 8 m'de bir nesnedir** (`yogunluk: 1` = her adayda nesne). Ağaçlar eğimi %50'den, düz tepeli kayalar %30'dan dik yerde ve suda (y < 0,6) çıkmaz.

Ortak: `alan`, `kenar` (m: kenardan içeri bu mesafede yoğunluk 0'dan tama çıkar = kenar seyrelmesi), `puruz` (6 m: sınırın doğal dalgası), `ad`.

| `tip` | Ne yapar | Parametreler (varsayılan) |
|---|---|---|
| `koru` | ağaçlık | `yogunluk` (.3; sık orman .4–.5, seyrek .08–.15), `turler: { yaprakli1: 1, yaprakli2: 1 }` (tür: pay), `boy: [en az, en çok]` (ölçek; yoksa türün olağan boyu), `kenar` (18), `kume` (.4: 0 düzgün … 1 öbek öbek) |
| `taslik` | kaya kümesi | `yogunluk` (.12), `turler: { kaya: 3, duzAlcak: 1, duzOrta: .7, duzYuksek: .4 }`, `boy: [.5, 2.2]`, `kenar` (8), `kume` (.5). Yalnız su kıyısına, yamaç dibine, uçurum kenarına koyun |
| `cali_alani` | çalılık | `yogunluk` (.15), `kenar` (10) |
| `serpme` | herhangi tür karışımı | `turler` (zorunlu), `yogunluk` (.1), `boy`, `kenar`, `kume` |
| `aciklik` | ağaç ve çalıyı keser (tasarlanan + prosedürel); tasarlanan kayalar kalır | `kenar` (10) |
| `yasak` | bütün nesneleri keser | `kenar` (0) |
| `zemin` | zemin dokusu | `toprak`, `cakil`, `kum` (0..1), `kenar` (6) |
| `kaynak` | yerdeki dal/taş yoğunluğu | `dal`, `tas` (çarpan; 0 = yok), `dalEk`, `tasEk` (aday başına ek olasılık; .03–.08 belirgin küme yapar), `kenar` (6) |

- Serpme alanlarının içinde prosedürel nesneler kapanır (`varsayilan: 1` yazarsanız alanın içinde onlar da kalır). Bölgenin tamamında prosedürel nesneleri kapatmak için bölge tanımında `varsayilan: 0`.
- `aciklik` ve `yasak` sıradan bağımsız olarak her zaman kazanır. `patika` üstü, `duzluk`/`plato` içi (`bos: false` değilse) ve doğuşun 9 m çevresi kendiliğinden yasaktır.
- Üst üste binen serpme alanlarının yoğunlukları toplanır.

**Nesne türleri** (`arazi.js`, `TUR`): `yaprakli1`, `yaprakli2` (yapraklı ağaç ≈ 5–6 m), `cam1` (çam), `camKar` (karlı çam), `cali`, `kaya` (yuvarlak kaya; ölçek 1 ≈ 1,1 m yüksek; 2,3 m'ye kadar olanların üstüne çıkılır), `duzAlcak` / `duzOrta` / `duzYuksek` (düz tepeli, tırmanılan kaya: 0,5 / 1,0 / 1,8 m), `kayaCol`, `kayaKar`, `kayaKizil`, `kaktus`, `kristalPembe`, `kristalTurkuaz`, `mantar`.

## 6. Tek tek nesneler (`nesneler`) ve ilgi noktaları (`noktalar`)

```js
nesneler: [
  { id: 'ulu', tur: 'devAgac', x: 1490, z: 960 },                 // id verin: sıra değişse de kimlik (kesilme/kırılma kaydı) sabit kalır
  { id: 'kaya1', tur: 'kaya', x: 1360, z: 1145, s: 3.2, ry: 2 }   // s: ölçek, ry: dönüş (radyan)
],
noktalar: [
  { tur: 'yerlesim', ad: 'Göl başı', x: 1265, z: 1055, yaricap: 45 },
  { tur: 'isaret', ad: 'Ulu ağaç', x: 1490, z: 960, yukseklik: 20 }   // yukseklik: görünürlük sınamasında hedefin yerden yüksekliği
]
```

- Nesne zemine kendiliğinden oturur. Suyun içine de konabilir (denetlenmez).
- **İşaret türleri (yeni):** `devAgac` (≈ 24 m), `sivriTas` (≈ 11 m iğne kaya), `anitTas` (4,6 m dikili taş), `tasKapi` (taş kapı), `yikikDuvar`. Geometrileri hazır (`SO.tasarim.turler`) ama `arazi.js`'e bağlanana kadar yerlerinde **yedek** görünür: büyütülmüş `yaprakli1`, `kaya`, `duzYuksek`, `duzOrta`. Veriyi şimdiden gerçek tür adıyla yazın.
- **Nokta türleri:** `dogus` (kendiliğinden), `yerlesim` (üs alanı: `yaricap` zorunlu; ölçüm aracı tablosunu bundan çıkarır), `isaret` (uzaktan görülen hedef), `manzara` (bakış noktası), `kaynak` (kaynak kümesi), `gecit` (geçit, köprü, sığ geçit; nehir `sig`leri kendiliğinden), `dugum` (patika ağı düğümü). Alanlar: `id`, `tur`, `ad`, `x`, `z`, `yaricap`, `yukseklik`. Noktalar yalnız anlam verisidir (araziyi değiştirmez); araçlar ve ileride harita simgeleri `SO.tasarim.noktalar`'ı okur. **Her yerleşim alanı, işaret ve geçit için nokta yazın**: ölçümler ve testçilerin araçları bunlara göre çalışır; araçlarda nokta adı koordinat yerine kullanılabilir.

## 7. Araçlar

Hepsi depo kökünden çalışır, başsız tarayıcıda oyunu açar. Ortak seçenek: `--tasarim deneme` (ya da `yok`); b001 index.html'de olduğundan onun için seçenek gerekmez. Doğuş `SO.world.start`'tan okunur (koordinat ezberlemeyin). Nokta isteyen her yerde `dogus`, `x,z` ya da ilgi noktasının adı/id'si yazılabilir.

### 7.1 Kuşbakışı harita: `test/kusbakisi.cjs` (≈ 6–25 sn)

```
node test/kusbakisi.cjs --bolge b001 --cikti /tmp/b001.png                 # bütün bölge (nesnelerle)
node test/kusbakisi.cjs --merkez 1290,990 --genislik 600 --cikti /tmp/yakin.png   # yakın plan (1 piksel = 0,4 m)
node test/kusbakisi.cjs --bolge b001 --egim --sade --nesnesiz --cikti /tmp/egim.png  # eğim haritası (hızlı)
node test/kusbakisi.cjs --tasarim yok --merkez dogus --genislik 3000       # tasarımsız (prosedürel) hâli
```

Gösterir: gölgeli arazi, eş yükselti eğrileri (aralık başlıkta; her 5.'si kalın), ızgara kesişimlerinde yükseklik sayıları, su (açık mavi sığ, koyu derin), 45°'den dik yerlerde kırmızı tarama, nesneler (koyu yeşil yapraklı, mavi-yeşil çam, açık yeşil çalı, gri kaya, koyu kare düz tepeli kaya), tasarım şekilleri ve alanları (etiket: `tip ad ·katmanınİlkHarfi+sıra`, ör. `ucurum Sarp yar ·a6` = arazi katmanının 6. şekli), ilgi noktaları (D doğuş, Y yerleşim, İ işaret, M manzara, K kaynak, G geçit), bölge sınırı (kesikli), ölçek, kuzey oku, kenarlarda dünya koordinatları. Seçenekler: `--boyut 1600`, `--es 2`, `--sade`, `--nesnesiz`, `--egim`. Çıktıdaki JSON'da düzlük/su yüzdesi ve nesne sayıları var. 3,2 km'den geniş haritada nesneler çizilmez.

### 7.2 Manzara: `test/manzara.cjs` (kare başına ≈ 4–8 sn)

```
node test/manzara.cjs --nokta dogus --pano 8 --cikti /tmp/dogus.png              # göz hizası, 8 yön
node test/manzara.cjs --nokta "Göl başı; 1500,960" --yon 0,90 --cikti /tmp/m.png  # iki nokta, iki yön
node test/manzara.cjs --nokta 1340,1250 --yon 0,180 --kus 110 --cikti /tmp/kus.png   # 110 m yukarıdan eğik bakış
```

`--goz 1.7` göz yüksekliği, `--egik -2` dikey açı, `--fov 60`, `--boyut 800x450`, `--sutun 4`. `--kus N`: kamera noktanın N m üstünde, 1,5 N m gerisindedir ve verilen yöne doğru noktaya bakar (karakter ölçek için görünür). Her karenin üstünde sıra no, nokta, koordinat, yükseklik ve yön yazar.

### 7.3 Yürüme ("oynama"): `test/yuru.cjs`

```
node test/yuru.cjs senaryo.json /tmp/tur1.png
node test/yuru.cjs '{"basla":"dogus","bak":180,"kare":5,"komutlar":[{"topla":2},{"git":"Göl başı"},{"git":[1520,1310]},{"bak":270},{"bekle":1}]}' /tmp/t.png
```

Senaryo alanları: `basla` (nokta), `bak` (pusula), `tasarim`, `kare` (kaç saniyede bir kare; 0 = yalnız komut sonlarında; uzun turda 5–10 yazın), `gunluk` (günlük aralığı, 0,5 sn), `boyut` ([480, 270]), `sutun`, `enCok` (en çok oyun süresi, 900 sn). Komutlar:

| Komut | Anlamı |
|---|---|
| `{ "git": [x, z] }` ya da `{ "git": "nokta adı" }` | hedefe gider. `hiz`: `"yuru"` (1,55) \| `"kos"` (3,6; varsayılan) \| `"depar"` (6,4); `yakin` (1,5 m: varış mesafesi); `sure` (zaman aşımı) |
| `{ "bak": 90 }` | kamera ve karakter pusula yönüne döner |
| `{ "bekle": 2 }` | saniye |
| `{ "kos": true }` | sonraki `git`lerin varsayılan hızı depar olur (`false`: hafif koşu) |
| `{ "zipla": true }` | zıplar (kaya önündeyse tırmanır) |
| `{ "topla": 3, "uzak": 25 }` | en yakın dal/taşa gidip alır (sayı kadar) |

`git` dümdüz hedefe yürür (yol bulmaz): göl, uçurum, kaya araya girerse karakter yüzer, takılır ya da dik yamaçtan geçer; bunlar olay olarak yazılır. Dolanmak için ara noktalar verin. Takılırsa sırayla zıplar ve yandan dolanmayı dener; olmazsa `takildi` yazıp sıradaki komuta geçer.

Çıktı: kontak tabakası (`sıra · süre · konum · o anki komut`) ve `<çıktı>.json`:
- `ozet`: süre, yol, ortalama hız, envanter, olay sayıları, `ilk_agac_5m_sn` / `ilk_kaya_5m_sn` / `ilk_su_5m_sn`, `en_uzun_bos_sn` (40 m içinde ağaç/kaya/su, 60 m içinde ilgi noktası olmadan geçen en uzun süre).
- `komutlar`: her komutun sonucu (`tamam` \| `takildi` \| `zaman_asimi` \| `bulunamadi` \| `eksik`), süresi, yolu.
- `olaylar`: `vardi`, `takildi`, `kacinma`, `zipladi`, `tirmandi`, `yuzuyor`, `sudan_cikti`, `topladi`, `dik_yamac`, `zaman_asimi` (zaman ve konumla).
- `gunluk`: her 0,5 sn: `t, x, z, y, hiz, egim, biyom, su, yuzme, komut`, `onde { agac, kaya }` (öndeki 60° koni, 100 m; arkasında kalma hesaba katılmaz), `yakin { agac, kaya, su, dal, tas }` (m), `noktalar` (en yakın 4 ilgi noktası).

Oyun süresinin ≈ 5 katı hızla çalışır (yalnız kare anlarında çizer; sonuç her adımı çizmekle birebir aynıdır: `--ciz` ile doğrulanır, 20 kat yavaştır).

### 7.4 Ölçüm: `test/olcum.cjs` (4 km² için ≈ 80 sn)

```
node test/olcum.cjs --bolge b001 --cikti /tmp/b001.md          # + /tmp/b001.json
node test/olcum.cjs --merkez dogus --genislik 1500 --cikti /tmp/o.md
```

Rapor: (0) hedef tablosu (TAMAM / EKSİK), (1) doğuştan ilk ağaç/kaya/dal/taş/suya yol ve süre, 50 ve 100 m çevresindeki sayılar, (2) doğuştan görünen ilgi noktaları, yön yön görüş derinliği, görünen alan yüzdesi, (3) eğim dağılımı ve boş düzlük listesi (`--bos 150`: bu yarıçapta düz ve nesnesiz yerler), (4) yerleşim tablosu (alan, eğim, suya uzaklık, 150 m içindeki ağaç/kaya, doğuştan süre, görünürlük), (5) erişilebilirlik (`--egim 45`: geçilmez sınırı; ulaşılamayan / yalnız yüzerek ulaşılan noktalar, kapalı cepler), (6) olaysız yürüyüş (en yakın ağaç/kaya/ilgi noktasına uzaklık; 60 m içinde hiçbir şey olmayan boşluklar).

Sınırları: görünürlük yalnız araziyle sınanır (ağaçlar perdelemez); süreler ızgara üstünde en kısa yoldur (gerçek yürüyüş %5–10 uzun olabilir); doğuş alanın dışındaysa yol ölçümleri boş kalır; yerdeki dal/taş yalnız doğuşun ≈ 120 m çevresinde sayılır; alan kenarına değen "cep"ler dışarıdan bağlı olabilir.

## 8. Tipik iş akışı

**Tasarımcı:** dosyanı düzenle → `kusbakisi --bolge b001` (biçim, sıra, kenarlar) → `kusbakisi --egim` (düzlük ve geçilmez yerler) → `manzara` (doğuştan ve yerleşimlerden ne görünüyor; `--kus` ile şeklin kendisi) → `yuru` (ana güzergâhı bir kez yürüt) → `olcum` (hedef tablosu). Küçük değişiklikte yalnız ilgili yeri yakın plan çek (`--merkez x,z --genislik 500`).

**Testçi:** `olcum` raporunu oku → `manzara --nokta dogus --pano 8` (ilk izlenim: nereye gideceğimi anlıyor muyum?) → doğuştan görülen hedeflere `yuru` turları (kaynak topla, üs alanına git, işarete yürü, suyu geç; farklı oyuncu tiplerini canlandır) → kontak tabakası ve günlükten: ne kadar boş yürüdüm (`en_uzun_bos_sn`, `onde` sayıları), nerede takıldım/yüzdüm, varınca ne gördüm → kabul sorularına (ilkeler belgesi) göre bulguları koordinatla bildir.

## 9. Sık yapılan hatalar

- **z'nin yönü:** kuzey = eksi z. Haritada yukarı çıkmak için z'yi azaltın.
- **`ucurum.yan` / `kiyi.su`:** çizginin çizilme yönüne göredir; ters çıktıysa `sol` ↔ `sag` değiştirin ya da noktaları ters sıralayın. Haritadaki çentiklere bakın.
- **Yüksekte su:** göl/nehir bulunduğu yeri 0'a indirir; 40 m'lik yaylaya göl koyarsanız 40 m derin krater olur. Suyu alçak havzalara koyun, çevreyi `vadi`/taban ile önceden alçaltın.
- **Sıra:** `duzluk` nehirden önce uygulanırsa nehir düzlüğü oyar; yerleşim düzlüğünü `yerlesim` katmanına yazın. `y` verilmeyen düzlük, kendisinden ÖNCEKİ şekillere göre yükseklik alır.
- **Sınıra yakın tasarım:** geçiş bandındaki (ilk 150 m) şekiller silik çıkar; doğuş, yerleşim ve işaretleri bandın içine koymayın.
- **Düz çizgiler:** iki noktalı sırt/uçurum/nehir cetvel gibi durur. Nokta ekleyin, `puruz`/`kivrim` kullanın.
- **Çok sık orman:** `yogunluk` 1'in üstüne çıkamaz (8 m ızgara). Sıklık hissi için `kume` düşük, `cali` payı ekleyin.
- **Düzlük ortasında kaya:** `taslik`ı yalnız kıyı, yamaç dibi, uçurum kenarına koyun; `ucurum.kayalar` ve `kaya_cikinti` bunu kendiliğinden yapar.
- **Dev boş düzlük:** taban düz + `varsayilan: 0` + az alan = çıplak ova. `olcum` "boş düzlük" ve "olaysız yürüyüş" tablolarına bakın; koru, tepecik, taşlık, ilgi noktasıyla bölün.
- **İlgi noktası yazmamak:** nokta yoksa ölçüm ve yürüme araçları o yeri tanımaz.
- **`id` vermeden işaret nesnesi:** araya nesne eklenince kimlikler kayar (oyuncunun kestiği ağaç başka ağaca geçer).
- **`Math.random`:** kullanmayın; `SO.tasarim.rnd(tohum)`.
- **Dar şekil:** 4 m'den dar şey arazi ağında kaybolur (patika en az 3 m, nehir en az 8 m, uçurum `genislik` en az 4 m).
