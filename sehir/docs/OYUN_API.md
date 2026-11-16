# Oyun durumu ve arayüz sözleşmesi

Üç dosya aynı anda yazılıyor; hepsi bu sözleşmeye uyar. Değişiklik gerekirse buraya yazılır.

Betik sırası (index.html, sabit): … `toplama.js` → `oyun.js` → `yapi.js` → `arayuz.js` → `ana.js`. ana.js sırayla `SO.oyun.init()`, `SO.yapi.init()`, `SO.arayuz.init()` çağırır (dünya ve karakter kurulduktan sonra), her karede `update(dt)`.

## `oyun.js` (oyun çekirdeği) sağlar
- **`SO.oyuncu`**: `{ can, canMax, aclik, aclikMax, seviye, xp, xpGerek, puan }` (puan = harcanmamış teknoloji puanı). Yalnız oyun.js yazar.
- **`SO.envanter`** (toplama.js'te var; oyun.js genişletebilir): `adet(tur)`, `ekle(tur, adet)`, `harca(tur, adet)` → bool, `say` (tur → adet), `dinle(fn)`. Türler: `dal`, `tas`, `odun`, `lif`, … ve üretilen eşyalar (`tas_balta`, `tas_kazma`, `mizrak`, …).
- **`SO.esya`**: tür tablosu `id → { ad, sinif: 'malzeme' | 'alet' | 'silah' | 'yiyecek', simge }` (`simge`: 24×24 `viewBox`'lı SVG iç içeriği, `currentColor` ile; arayüz bunu çizer).
- **`SO.eller`**: `{ yuva: [id | null, id | null, id | null], secili: 0..2 | -1 }`; `SO.oyun.elSec(i)` (aynı yuvaya yeniden basınca elden bırakır: -1), `SO.oyun.kusan(id, i)` (çantadan yuvaya), `SO.oyun.cikar(i)`.
- **`SO.tarifler`**: `[{ id, ad, sinif: 'el' | 'masa', girdi: { tur: adet }, cikti: { tur: adet }, teknoloji: id | null }]`; `SO.oyun.uretebilir(id)` → `{ ok, eksik: { tur: adet }, kilitli }`, `SO.oyun.uret(id)` → bool. `sinif: 'masa'` tarifler yalnız üretim masasının yanında (`SO.yapi.yakin('uretim_masasi')`).
- **`SO.teknoloji`**: `[{ id, ad, seviye, puan, acik }]` (seviye: açılabildiği en düşük oyuncu seviyesi; puan: maliyet); `SO.oyun.teknolojiAc(id)` → `{ ok, neden }`.
- **`SO.oyun.dinle(fn)`**: durum her değiştiğinde (can, açlık, xp, seviye, eller, teknoloji) `fn(ne)` çağrılır (`ne`: `'can' | 'aclik' | 'xp' | 'seviye' | 'el' | 'teknoloji' | 'puan'`). Envanter için `SO.envanter.dinle`.
- **`SO.oyun.xpVer(n)`**, **`SO.oyun.puanVer(n)`**, **`SO.oyun.hasar(n)`**, **`SO.oyun.ye(id)`**.
- **Vurma:** `SO.input.vur` (düğme basılıyken true; arayüz ya da klavye `F` yazar). oyun.js okur: önündeki nesneye (ağaç, kaya) elindeki alete göre vurur; hareket katmanı `anim/vurus.js`.
- Kayıt: `localStorage` anahtarı `acik-dunya-oyun-v1` (try/catch; `?test` kipinde yok).

## `yapi.js` (inşa) sağlar
- **`SO.yapilar`**: `[{ id, ad, sinif: 'yapi' | 'esya', girdi: { tur: adet }, teknoloji: id | null, simge }]` (duvar, zemin, çatı, çit, kapı, yatak, masa, üretim masası, fırın, kamp ateşi…).
- **`SO.yapi.basla(id)`**: yerleştirme kipini açar (önünde yarı saydam önizleme; ızgaraya oturur); **`SO.yapi.onayla()`**, **`SO.yapi.iptal()`**, **`SO.yapi.dondur()`**; `SO.yapi.kip` (`null` | `{ id, uygun }`); **`SO.yapi.yakin(id, r)`** → yakındaki yapı ya da null; `SO.yapi.dinle(fn)`.
- Malzemeyi `SO.envanter.harca` ile düşer; `SO.oyun.uretebilir` benzeri denetim için `SO.yapi.yapabilir(id)` → `{ ok, eksik, kilitli }`.
- Çarpışma: yerleştirilen yapıların kutularını `SO.world.ekKutular` dizisine yazar (arazi.js bunu `solids`'e katar).
- Kayıt: `acik-dunya-yapi-v1`.

## `arayuz.js` (arayüz) sağlar
- Ekran düzeni `docs/YOL_HARITASI.md`'de. Yalnız okur ve yukarıdaki işlevleri çağırır; oyun durumunu kendi tutmaz.
- `SO.arayuz.bildir(metin)`: kısa bildirim (ör. "+1 odun", "Seviye 2").
- Paneller: çanta (envanter ızgarası; eşyaya dokununca yuvaya kuşanma/yeme), çekiç (iki sekme: "Yapı" = `SO.yapilar`, "El işi" = `SO.tarifler`; yapılabilenler belirgin, eksik malzeme kırmızı), tablet (`SO.teknoloji`: seviye sırasına göre; kilitli/açılabilir/açık).
- Yerleştirme kipindeyken (`SO.yapi.kip`) ekranda "Yerleştir", "Döndür", "İptal" düğmeleri.

## Teknoloji id'leri (`SO.teknoloji`, oyun.js; `SO.yapilar[].teknoloji` ve `SO.tarifler[].teknoloji` bunları kullanır)
`teknoloji: null` = kilitsiz. Açık mı diye bakmak için: **`SO.oyun.teknolojiAcik(id)`** → bool (`null`/tanımsız id için `true`). Tablo `oyun.js` yüklenirken (init'ten önce) hazırdır.

| id | Ad | Seviye | Puan | Açtığı şeyler (öneri) |
|---|---|---|---|---|
| `tas_alet` | Taş aletler | 1 | 0 (açık gelir) | taş balta, taş kazma, mızrak (el işi) |
| `kamp_atesi` | Kamp ateşi | 2 | 1 | yapı: kamp ateşi |
| `uretim_masasi` | Üretim masası | 2 | 1 | yapı: üretim masası; masa tarifleri (ip, tahta) |
| `ahsap_yapi` | Ahşap yapı | 3 | 2 | yapı: ahşap zemin, duvar, çatı, kapı |
| `cit` | Çit | 3 | 1 | yapı: çit |
| `firin` | Fırın | 4 | 2 | yapı: fırın |
| `yatak` | Yatak | 4 | 2 | yapı: yatak (ileride doğuş noktası), masa |
| `sandik` | Sandık | 5 | 2 | yapı: sandık |
| `tas_yapi` | Taş yapı | 5 | 3 | yapı: taş zemin, taş duvar |
| `yay` | Yay ve ok | 5 | 3 | ileride (masa tarifi: yay, ok; eşyaları henüz yok) |
| `demir_alet` | Demir aletler | 6 | 4 | masa tarifi: demir balta, demir kazma (ileride) |
| `tarla` | Tarla | 6 | 3 | yapı: tarla |
| `zirh` | Zırh | 7 | 4 | ileride |
| `kuyu` | Su kuyusu | 7 | 3 | yapı: kuyu |
| `degirmen` | Değirmen ve çark | 8 | 5 | ileride (ilk mekanik güç) |
| `barut` | Barut | 8 | 5 | ileride |
| `celik` | Çelik | 9 | 6 | ileride |
| `elektrik` | Elektrik | 9 | 8 | ileride |
| `atesli_silah` | Ateşli silah | 10 | 10 | ileride: tüfek |

Eşya id'leri (`SO.esya`): malzeme `dal`, `tas`, `odun`, `lif`, `cakmaktasi`, `ip`, `tahta`; alet `tas_balta`, `tas_kazma`; silah `mizrak`; yiyecek `bogurtlen`.

## oyun.js'in sözleşmeye ekledikleri (adlar/imzalar değişmedi; hepsi ek)
- `SO.oyun.teknolojiAcik(id)` → bool. `teknolojiAc` → `neden`: `'yok' | 'acik' | 'seviye' | 'puan'`.
- `SO.oyun.uretebilir(id)` sonucunda ek alan `masaGerek` (masa tarifi ve yakında üretim masası yok; o zaman `ok` false). Masa araması: `SO.yapi.yakin('uretim_masasi', 3.5)`.
- `SO.oyun.dinle` → `ne` değerlerine ek: `'olum'` (yeniden doğuş). `'can'` ve `'aclik'` tam sayı değişince gelir (her karede değil).
- `SO.oyun.kusan(id, i)`: `i` verilmezse ilk boş yuva; yalnız alet/silah/yiyecek kuşanılır (malzeme `false`). Eşya çantada kalır (yuva yalnız gösterir); sayısı 0'a inince yuva kendiliğinden boşalır. Üretilen yeni alet boş yuvaya kendiliğinden girer, el boşsa seçilir.
- `SO.oyun.eldeki()` → seçili eşya id'si ya da `null`. `SO.oyun.hedef` → önündeki vurulabilir nesne `{ id, sinif, tur, can, canMax, x, z }` ya da `null` (can çubuğu için; 0,12 sn'de bir yenilenir).
- `SO.esya[id]` ek alanları: alet/silah `vurus`, `hasar: { agac, kaya, cali, kaktus }`; yiyecek `besin`, `sifa`. `SO.tarifler[]` ek alan `xp`.
- Yiyecek seçiliyken `SO.input.vur` = ye (hareketli); `SO.oyun.ye(id)` doğrudan yer (hareketsiz).
- `SO.oyun.hasar(n, neden)`, `SO.oyun.xpIcin(seviye)`, `SO.oyun.bildirimler` (son 40 bildirim), `SO.oyun.durum()`, `kodla()/coz()`, `sifirla()`.
- `SO.envanter.ekle` artık `SO.esya`'daki bütün türleri kabul eder (önceden yalnız dal/taş).
- Klavye: `F` = `SO.input.vur`, `1`/`2`/`3` = `elSec` (oyun.js bağlar; arayüz ayrıca bağlamasın).
