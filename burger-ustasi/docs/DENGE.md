# Burger Ustası: ekonomi ve denge (2. tur)

Değerlerin hepsi `www/js/veri.js` içinde (`BU.VERI`, ince ayarlar `BU.VERI.AYAR`). Tablolar denge botunun çıktısı:

- `node scripts/denge.mjs 400 md`: 1–15. günler (her düzeyde 400 oyun).
- `node scripts/denge.mjs saat 16 md`: uzun oyun, her düzeyde 16 oyuncu ilk günden premium malzemeye kadar (en çok 120 gerçek saat).
- `node scripts/denge.mjs tavan 200 md`: zorluk tavanı (belli günlerde kazanma oranı).

Değer değiştirince botu yeniden çalıştır ve tabloları güncelle. Deneme için: `DENGE_AYAR='{"sabirMin":11}' node scripts/denge.mjs tavan`.

## 2. turun ekonomisi kısaca

- Yeni oyuncu **50** parayla başlar (`BASLANGIC`). Başta yalnız ekmek ve köfte açık.
- Öbür 13 malzeme dükkânda **parayla, sırayla, birer kez** alınır (`SATIN_SIRA`, `fiyatAc`). Alınan malzemeyi müşteriler sipariş etmeye başlar; siparişler yalnız sahip olunan malzemelerden.
- Her gün sonunda **kira** düşer (`kira(gun)`, gün kaybedilse de). Kasa eksiye düşebilir; eksi kasayla dükkândan hiçbir şey alınamaz (`alabilir`). **3 gün art arda** eksi kalırsa dükkân kapanır, kasa **50**'ye döner, alınanlar kalır (`gunSonu`).
- Zorluk (müşteri sayısı, sabır, gelme aralığı, sipariş büyüklüğü) 18. güne kadar artar, sonra sabit kalır (`AYAR.zorTavan`). 300. gün 18. gün kadar zordur.
- Gerçek oynama: bir gün 1–2 dakikayla başlar, 15. günden sonra ~4 dakika (20 müşteri). Saatte ~15 gün.

## Malzemeler

Bütün paralar tam sayı. Malzeme tabağa konunca (köfte ızgaraya konunca) maliyeti kasadan düşer. Ekmek parası alt ekmekte bir kez; üst ekmek bedava.

| Sıra | Malzeme | Anahtar | Dükkân fiyatı | Porsiyon maliyeti | Menüye katkısı (`satis`) |
|---|---|---|---|---|---|
| | Ekmek (alt; üst bedava) | `bun` | başta açık | 2 | 5 |
| | Köfte | `patty` | başta açık | 6 | 14 |
| 1 | Peynir | `cheese` | 30 | 3 | 6 |
| 2 | Marul | `lettuce` | 80 | 1 | 6 |
| 3 | Domates | `tomato` | 160 | 2 | 6 |
| 4 | Soğan | `onion` | 500 | 1 | 7 |
| 5 | Turşu | `pickle` | 1.200 | 1 | 7 |
| 6 | Pastırma | `bacon` | 2.500 | 4 | 9 |
| 7 | Yumurta | `egg` | 5.000 | 2 | 10 |
| 8 | Sos (özel burger sosu) | `sauce` | 10.000 | 2 | 11 |
| 9 | Mantar | `mushroom` | 20.000 | 3 | 13 |
| 10 | Jalapeño | `jalapeno` | 40.000 | 3 | 15 |
| 11 | Soğan halkası | `onionring` | 80.000 | 4 | 18 |
| 12 | Avokado | `avocado` | 200.000 | 6 | 22 |
| 13 | **Trüf** (premium: trüf mantarı dilimleri / trüf sosu) | `truffle` | 600.000 | 10 | 32 |

Dükkân fiyatı her adımda ~2 katına çıkar (avokado ve trüf 2,5 ve 3 kat): ilk üçü 1–3. günde, ortadakiler birkaç saatte, son ikisi onlarca saatte gelir (aşağıdaki saat tablosu).

**Menü fiyatı** = alt ekmeğin ve ortadaki her katmanın `satis` değerinin toplamı, en yakın 5'e yuvarlanır (en az 15). Geliştirmeler fiyatı değiştirmez. `satis` dükkân sırası boyunca hiç azalmaz ve siparişte malzeme `satis` ağırlığıyla seçilir (pahalı malzeme daha sık istenir): böylece **her yeni malzeme ortalama burger fiyatını ve bahşişi artırır**.

| Burger | Maliyet | Fiyat | Bahşiş (sabır tam) | Bahşiş (sabır 2/3'ün az üstü) |
|---|---|---|---|---|
| Ekmek + köfte | 8 | 20 | 6 | 2 |
| + peynir | 11 | 25 | 8 | 2 |
| + peynir, marul, domates | 14 | 35 | 11 | 3 |
| Çift köfte, peynir, pastırma, yumurta | 23 | 60 | 18 | 5 |
| Köfte, sos, mantar, soğan halkası | 17 | 60 | 18 | 5 |
| Köfte, jalapeño, soğan halkası, avokado, trüf | 31 | 105 | 32 | 9 |
| Çift köfte, trüf, avokado, soğan halkası, jalapeño | 37 | 120 | 36 | 10 |

**Bahşiş** (yalnız doğru ve mutlu teslimde): fiyatın %8'i (sabır 2/3'teyken) ile %30'u (sabır doluyken) arası, kalan sabırla düz artar. "Cömert bahşiş" her düzeyde +%25. Art arda 3. mutlu teslimden sonra seri payı: +1, +2 … en çok +5. En az 1.

## Kira ve eksi kasa

Kira = 10 + 10 × ⌊√(gün − 1)⌋, 5'e yuvarlı, en çok 120 (`kira(gun)`):

| Gün | 1 | 2–4 | 5–9 | 10–16 | 17–25 | 26–36 | 37–49 | 50–64 | 65–81 | 82–100 | 101–121 | 122+ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Kira | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 |

İlk günlerde kira kârın küçük bir kısmı (1. gün orta oyuncu 84 kâr, 10 kira; 10. gün 305 kâr, 40 kira). 18. günden sonra orta oyuncu günde 500–1000, hızlı oyuncu 900–1700 kâr eder; 120 kira bunun %7–25'i.

`gunSonu(kasa, gun, eksiGun)`: kira düşülür; sonuç eksiyse `eksiGun` bir artar, değilse sıfırlanır; `eksiGun` 3 olursa `kapandi: true`, kasa 50, `eksiGun` 0.

## Ruh hâli ve ödeme

f = kalan sabır oranı (1 dolu, 0 boş).

| f | Ruh | Yüz | Doğru burgerde | Yanlış burgerde |
|---|---|---|---|---|
| f > 2/3 | mutlu | `happy` | fiyat + bahşiş | ödemez, −maliyet, 1 can |
| 2/3 ≥ f > 1/2 | somurtkan | `wait` | yalnız fiyat | ödemez, −maliyet, 1 can |
| 1/2 ≥ f > 1/3 | somurtkan | `imp` | yalnız fiyat | ödemez, −maliyet, 1 can |
| f ≤ 1/3 | kızgın | `angry` | ödemez, −maliyet (can gitmez) | ödemez, −maliyet, 1 can |
| f = 0 | kaçar | `angry` | (yemeği almadan gider, 1 can) | |

## Günler

Gelme aralığının ortası = 10,5 + 1,6 × (siparişte beklenen ortadaki katman sayısı) − 0,38 × (zorluk günü − 1) sn, en az 6; aralık bunun %75'i ile %125'i. Sabır = (taban + 3,5 × ortadaki katman sayısı) × (1 + %10 × "Sabırlı müşteri" düzeyi); taban 15,5 sn'den başlar, günde 0,35 sn azalır, en az 10. **Zorluk günü** = min(gün, 18): 18. günden sonra aralık, sabır, sipariş büyüklüğü değişmez. Beklenen katman sahip olunan malzemeye göre (az malzemeyle siparişler küçük, müşteriler biraz daha sık gelir).

| Gün | Müşteri | Aynı anda | Gelme aralığı (3 malzeme) | Gelme aralığı (13 malzeme) | Taban sabır | Ekstra malzeme | Sabır: köfte+peynir | Sabır: köfte + 4 malzeme | Kira |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 2 | 9.7–16.1 | 9.7–16.1 | 16 | 0–1 | 23 | 33 | 10 |
| 2 | 7 | 2 | 10.6–17.7 | 10.6–17.7 | 15 | 1–2 | 22 | 33 | 20 |
| 3 | 8 | 3 | 10.3–17.2 | 10.3–17.2 | 15 | 1–2 | 22 | 32 | 20 |
| 5 | 10 | 3 | 10.3–17.2 | 10.3–17.2 | 14 | 1–3 | 21 | 32 | 30 |
| 7 | 12 | 3 | 10.1–16.8 | 10.1–16.8 | 13 | 1–3 | 20 | 31 | 30 |
| 10 | 15 | 3 | 10.1–16.8 | 10.1–16.8 | 12 | 2–3 | 19 | 30 | 40 |
| 13 | 18 | 3 | 9.8–16.3 | 9.8–16.3 | 11 | 2–4 | 18 | 29 | 40 |
| 15 | 20 | 3 | 9.2–15.4 | 9.2–15.4 | 11 | 2–4 | 18 | 28 | 40 |
| 17 | 20 | 3 | 8.7–14.4 | 9.3–15.4 | 10 | 3–4 | 17 | 28 | 50 |
| 18 (tavan) | 20 | 3 | 8.4–14 | 9–15 | 10 | 3–4 | 17 | 28 | 50 |
| 50 | 20 | 3 | 8.4–14 | 9–15 | 10 | 3–4 | 17 | 28 | 80 |
| 300 | 20 | 3 | 8.4–14 | 9–15 | 10 | 3–4 | 17 | 28 | 120 |

- Müşteri sayısı 5 + gün (en çok 20). İlk iki gün aynı anda en çok 2 müşteri, sonra 3.
- Köfte her siparişte var. 6. günden sonra %25 çift köfte, 10. günden sonra %20 bir malzeme iki kez. Bir burger en çok 10 katman.
- İlk 3 gün köfte siparişte hep altta görünür, sonra sıra karışık (teslimde sıra önemsiz).
- Köfte pişme süresi 4 sn, "Hızlı ızgara" her düzeyde −0,5 sn (en hızlı 2 sn). Köfte stoğu en çok 6.

## Geliştirmeler

Uzun oyunda değerleri düşmesin diye 2. turda üst düzeyler pahalandı (her düzey 2 kat).

| Geliştirme | Etki | 1. düzey | 2. | 3. | 4. |
|---|---|---|---|---|---|
| Hızlı ızgara (`cook`) | köfte 0,5 sn daha çabuk | 300 | 600 | 1.200 | 2.400 |
| Sabırlı müşteri (`pat`) | sabır +%10 | 350 | 700 | 1.400 | 2.800 |
| Cömert bahşiş (`tip`) | bahşiş +%25 | 400 | 800 | 1.600 | 3.200 |
| Geniş ızgara (`slot`) | 3. ızgara gözü (4. günden sonra) | 1.000 | | | |

## Denge botu

Oyuncu modeli:
- Malzeme koymak = kutuya dokun + tabağa dokun (2 dokunuş); seçili malzemeyi yeniden koymak 1 dokunuş. Izgaraya köfte 1 dokunuş. Her dokunuşun süresi rastgele 0,8–1,25 kat oynar.
- Yeni müşterinin siparişine bakmak "okuma" süresi; teslim ve çöp birer sürükleme.
- İki tabakta en acil iki müşterinin burgeri birlikte yapılır; köfte stokta yoksa öbür malzemeler önce konur, köfte beklenir.
- Izgarada bekleyen siparişlerin köftesi kadar pişirilir (orta oyuncu 1, hızlı oyuncu 2 fazla).
- Hata: bir malzeme yerine yanlışı konur. Oyuncu burger bitince bunu fark ederse (yavaş %60, orta %70, hızlı %85) çöpe atar ve yeniden yapar, etmezse yanlış teslim eder.
- Kızgın müşteriye de burger verilir (can gitmesin diye). Gün, 3 can gitmeden bitince kazanılır; kaybedilen gün yeniden oynanır.
- **Gün sonu:** kira (`gunSonu`), sonra dükkân: sıradaki malzeme ve geliştirmelerin hangisi en ucuzsa o alınır, kasada ertesi günün iki kirası kalacak şekilde, para yettikçe (bir günde birden çok alım olabilir). Slot 4. günden önce alınmaz.
- **Gerçek süre** = günün oynanma süresi (ilk müşteri gelişinden son müşteri gidişine) + 10 sn (gün kartları, dükkân).

| Düzey | Dokunuş | Sipariş okuma | Sürükleme | Malzeme başına hata |
|---|---|---|---|---|
| Yavaş | 0,85 sn | 1,6 sn | 1,4 sn | %4 |
| Orta | 0,6 sn | 0,9 sn | 1,0 sn | %3 |
| Hızlı | 0,4 sn | 0,5 sn | 0,7 sn | %1,5 |

## Sonuçlar

Özet:
- **Kesin şart sağlanıyor:** hızlı oyuncu premium malzemeye (trüf) ancak **~54 gerçek saatte** (799. gün) ulaşıyor; 16 hızlı oyuncunun en erkeni 54,0 saat. 24 saat aralıksız oynayan hızlı oyuncu ancak avokadoya (23,5 sa) varır, trüf için 600.000 paranın üçte birini bile biriktiremez. Hızlı oyuncunun gelir hızı müşteri akışıyla sınırlı (günün süresi beceriden çok müşterilerin gelişine bağlı: gün başına ~245 sn), o yüzden bottan daha iyi bir insan da kayda değer biçimde hızlı olamaz.
- **Orta oyuncu** trüfe ~96 saatte (1.262. gün) ulaşıyor. İlk üç malzeme 1–3. günde (5 dakikada), soğan ilk yarım saatte, turşu–mantar 1–8 saatte, jalapeño–soğan halkası 13–22 saatte, avokado 42 saatte.
- **İlerleme hissi:** her yeni malzeme saatlik kazancı artırıyor. Hızlı oyuncu: 2. saatte 10,6 bin/sa (6 malzeme), 6. saatte 15 bin (9), 10. saatte 16 bin (10), 20. saatte 17,6 bin (11), 41. saatte 19,4 bin (12). Orta oyuncu: 5 bin → 7,5 → 8,3 → 9 → 10,2 → 11,3 bin/sa.
- **İlk günler rahat:** 1. gün kâr 72–86, kira 10; 2. gün kâr 98–129, kira 20. Peynir 1. gün, marul 2. gün, domates 3. gün (orta ve hızlı) alınıyor.
- **Zorluk tavanı (18. gün):** orta oyuncu geliştirmesiz ilk denemede %70–80, tam geliştirmeyle %90+ kazanıyor (mutlu oranı %55); 40. ve 300. gün 18. günle aynı. Hızlı oyuncu her günü kazanıyor (%91–95 mutlu).
- **Yavaş oyuncu** (1. turdaki gibi) ilk 5 günü %86+ kazanıyor, 10. günde %34, 13. günden sonra neredeyse hiç. Uzun oyunda 16–17. günde takılıyor: kaybettiği günlerde kira ve malzeme parası yüzünden kasası eksiye düşüyor, sık sık "dükkân kapandı" (kasa 50'ye döner) yaşıyor ve 3 malzemede kalıyor. Bu oyuncu ancak hızlanarak ilerler; istenirse bir "kolay" ayar ya da 15. günden sonra daha yavaş artan zorluk düşünülebilir (Eymen'in kararı).

### Her malzemeye ulaşma (ortanca; gerçek saat ve oyundaki gün)

| Malzeme | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| Peynir | 30 | 1 dk, gün 1 | 1 dk, gün 1 | 1 dk, gün 1 |
| Marul | 80 | 3 dk, gün 2 | 3 dk, gün 2 | 3 dk, gün 2 |
| Domates | 160 | 7 dk, gün 4 | 5 dk, gün 3 | 5 dk, gün 3 |
| Soğan | 500 | > 120 sa | 29 dk, gün 11 | 21 dk, gün 9 |
| Turşu | 1200 | > 120 sa | 1.3 sa, gün 22 | 48 dk, gün 16 |
| Pastırma | 2500 | > 120 sa | 2.8 sa, gün 42 | 1.6 sa, gün 27 |
| Yumurta | 5000 | > 120 sa | 4.6 sa, gün 63 | 2.4 sa, gün 40 |
| Sos | 10000 | > 120 sa | 5.9 sa, gün 81 | 3.2 sa, gün 51 |
| Mantar | 20000 | > 120 sa | 8.4 sa, gün 114 | 4.6 sa, gün 71 |
| Jalapeño | 40000 | > 120 sa | 13.3 sa, gün 179 | 7.2 sa, gün 110 |
| Soğan halkası | 80000 | > 120 sa | 22.3 sa, gün 294 | 12.2 sa, gün 182 |
| Avokado | 200000 | > 120 sa | 42.1 sa, gün 554 | 23.5 sa, gün 348 |
| Trüf (premium) | 600000 | > 120 sa | 96.0 sa, gün 1262 | 54.5 sa, gün 799 |
| Geliştirme cook (tam) |  | > 120 sa | 2.5 sa, gün 38 | 1.4 sa, gün 24 |
| Geliştirme pat (tam) |  | > 120 sa | 3.3 sa, gün 48 | 1.8 sa, gün 31 |
| Geliştirme tip (tam) |  | > 120 sa | 3.8 sa, gün 54 | 2.0 sa, gün 34 |
| Geliştirme slot (tam) |  | > 120 sa | 1.1 sa, gün 20 | 44 dk, gün 15 |

- Yavaş: 120.0 saatte 3916 gün oynandı (ulaşılan gün 17, kaybedilen 3900, kapanış 1271.9); gün başına 110 sn. Premiuma ulaşan yok.
  - 2. sa: gün 15, 348/sa, 3.0 malzeme
  - 6. sa: gün 16, -7/sa, 3.0 malzeme
  - 10. sa: gün 16, -16/sa, 3.0 malzeme
  - 20. sa: gün 17, 8/sa, 3.0 malzeme
  - 40. sa: gün 17, 23/sa, 3.0 malzeme
  - 61. sa: gün 17, 5/sa, 3.0 malzeme
  - 81. sa: gün 17, -14/sa, 3.0 malzeme
  - 101. sa: gün 17, -7/sa, 3.0 malzeme

- Orta: 95.8 saatte 1380 gün oynandı (ulaşılan gün 1256, kaybedilen 125, kapanış 0.0); gün başına 250 sn. En erken premium: 93.4 sa (16/16 oyuncu ulaştı).
  - 2. sa: gün 33, 5047/sa, 5.0 malzeme
  - 6. sa: gün 86, 7545/sa, 7.8 malzeme
  - 10. sa: gün 139, 8251/sa, 9.0 malzeme
  - 20. sa: gün 272, 9045/sa, 10.0 malzeme
  - 41. sa: gün 537, 10150/sa, 11.1 malzeme
  - 61. sa: gün 802, 11043/sa, 12.0 malzeme
  - 81. sa: gün 1069, 11335/sa, 12.0 malzeme

- Hızlı: 54.4 saatte 799 gün oynandı (ulaşılan gün 799, kaybedilen 1, kapanış 0.0); gün başına 245 sn. En erken premium: 54.0 sa (16/16 oyuncu ulaştı).
  - 2. sa: gün 35, 10613/sa, 6.0 malzeme
  - 6. sa: gün 95, 15027/sa, 9.0 malzeme
  - 10. sa: gün 154, 16085/sa, 10.0 malzeme
  - 20. sa: gün 303, 17620/sa, 11.0 malzeme
  - 41. sa: gün 602, 19435/sa, 12.0 malzeme

### Zorluk tavanı

Her hücre: ilk denemede kazanma oranı / mutlu teslim oranı / günün kârı (kira öncesi). "4 malzeme" = peynir, marul, domates, soğan.

**Yavaş oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| 4 malzeme, geliştirmesiz | 84% / 0% / 127 | 38% / 0% / 26 | 0% / 1% / -65 | 0% / 2% / -70 | 0% / 2% / -72 | 0% / 1% / -73 |
| 4 malzeme, tam geliştirme | 98% / 5% / 146 | 66% / 0% / 114 | 3% / 0% / -26 | 0% / 0% / -36 | 0% / 1% / -41 | 0% / 1% / -43 |
| 13 malzeme, geliştirmesiz | 80% / 0% / 213 | 35% / 0% / 96 | 0% / 0% / -79 | 0% / 0% / -95 | 0% / 0% / -95 | 0% / 0% / -89 |
| 13 malzeme, tam geliştirme | 95% / 5% / 249 | 62% / 0% / 232 | 1% / 0% / -6 | 0% / 0% / -39 | 0% / 0% / -39 | 0% / 0% / -41 |

**Orta oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| 4 malzeme, geliştirmesiz | 100% / 31% / 185 | 100% / 3% / 305 | 84% / 0% / 326 | 77% / 0% / 302 | 75% / 0% / 288 | 81% / 0% / 302 |
| 4 malzeme, tam geliştirme | 100% / 91% / 278 | 100% / 85% / 497 | 97% / 72% / 634 | 91% / 56% / 576 | 91% / 55% / 557 | 93% / 53% / 557 |
| 13 malzeme, geliştirmesiz | 99% / 31% / 312 | 99% / 3% / 556 | 86% / 0% / 662 | 68% / 0% / 517 | 73% / 0% / 596 | 74% / 0% / 581 |
| 13 malzeme, tam geliştirme | 100% / 93% / 481 | 100% / 86% / 876 | 93% / 69% / 1062 | 93% / 55% / 1065 | 91% / 53% / 1016 | 89% / 56% / 1050 |

**Hızlı oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| 4 malzeme, geliştirmesiz | 100% / 97% / 254 | 100% / 96% / 478 | 100% / 94% / 686 | 100% / 92% / 735 | 100% / 92% / 737 | 100% / 91% / 737 |
| 4 malzeme, tam geliştirme | 100% / 99% / 330 | 100% / 97% / 613 | 100% / 96% / 875 | 100% / 94% / 945 | 100% / 94% / 939 | 100% / 94% / 940 |
| 13 malzeme, geliştirmesiz | 100% / 97% / 426 | 100% / 96% / 837 | 100% / 93% / 1210 | 100% / 91% / 1318 | 100% / 90% / 1311 | 100% / 92% / 1333 |
| 13 malzeme, tam geliştirme | 100% / 99% / 548 | 100% / 97% / 1062 | 100% / 95% / 1534 | 100% / 94% / 1677 | 100% / 94% / 1684 | 100% / 93% / 1650 |

## 1–15. günler (yeni oyuncu, 50 parayla)

Tablolardaki sayılar ilk denemenin ortalaması. Kasa = gün sonu kira ve dükkân alışverişinden sonra kalan; Malzeme = alınmış malzeme sayısı (ekmek, köfte hariç).

### Yavaş oyuncu (dokunuş 0.85 sn, sipariş okuma 1.6 sn, sürükleme 1.4 sn, hata %4)

| Gün | Müşteri | Kazanma (ilk deneme) | Süre (sn) | Gelir | Gider | Net kâr | Kira | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Malzeme (alınan) | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 72 | 120 | 48 | 72 | 10 | 0 | 0.0 | 6.0 | 0.0 | 0.0 | 0.0 | 0% | 1.0 | 0.0 | 82 |
| 2 | 7 | 100% | 92 | 175 | 77 | 98 | 20 | 0 | 0.0 | 7.0 | 0.0 | 0.0 | 0.0 | 0% | 2.0 | 0.0 | 80 |
| 3 | 8 | 96% | 109 | 191 | 90 | 101 | 20 | 0 | 0.0 | 6.9 | 0.4 | 0.4 | 0.2 | 0% | 2.0 | 0.0 | 160 |
| 4 | 9 | 93% | 118 | 211 | 100 | 111 | 20 | 0 | 0.0 | 7.7 | 0.4 | 0.5 | 0.2 | 0% | 2.8 | 0.0 | 138 |
| 5 | 10 | 86% | 133 | 230 | 117 | 113 | 30 | 0 | 0.0 | 7.8 | 0.7 | 0.7 | 0.3 | 0% | 3.0 | 0.0 | 205 |
| 6 | 11 | 82% | 147 | 266 | 146 | 120 | 30 | 0 | 0.0 | 7.9 | 1.4 | 0.8 | 0.3 | 0% | 3.0 | 0.4 | 201 |
| 7 | 12 | 69% | 149 | 246 | 153 | 93 | 30 | 0 | 0.0 | 7.3 | 2.0 | 1.1 | 0.4 | 0% | 3.0 | 0.7 | 198 |
| 8 | 13 | 61% | 162 | 247 | 169 | 79 | 30 | 0 | 0.0 | 6.9 | 2.5 | 1.4 | 0.4 | 0% | 3.0 | 1.0 | 190 |
| 9 | 14 | 48% | 162 | 218 | 174 | 45 | 30 | 0 | 0.0 | 6.0 | 3.3 | 1.5 | 0.4 | 0% | 3.0 | 1.1 | 181 |
| 10 | 15 | 34% | 159 | 196 | 174 | 22 | 40 | 0 | 0.0 | 5.2 | 3.4 | 1.9 | 0.4 | 0% | 3.0 | 1.2 | 144 |
| 11 | 16 | 34% | 170 | 211 | 186 | 24 | 40 | 0 | 0.0 | 5.4 | 3.7 | 1.9 | 0.5 | 0% | 3.0 | 1.3 | 123 |
| 12 | 17 | 24% | 162 | 167 | 180 | -13 | 40 | 0 | 0.1 | 4.3 | 4.3 | 2.2 | 0.4 | 1% | 3.0 | 1.4 | 59 |
| 13 | 18 | 9% | 148 | 124 | 167 | -43 | 40 | 0 | 0.1 | 3.2 | 4.3 | 2.4 | 0.4 | 1% | 3.0 | 1.4 | 9 |
| 14 | 19 | 3% | 136 | 95 | 154 | -60 | 40 | 1 | 0.1 | 2.4 | 4.2 | 2.6 | 0.3 | 1% | 3.0 | 1.4 | -50 |
| 15 | 20 | 0% | 118 | 70 | 136 | -66 | 40 | 0 | 0.0 | 1.8 | 3.6 | 2.7 | 0.3 | 1% | 3.0 | 1.4 | -65 |

### Orta oyuncu (dokunuş 0.6 sn, sipariş okuma 0.9 sn, sürükleme 1 sn, hata %3)

| Gün | Müşteri | Kazanma (ilk deneme) | Süre (sn) | Gelir | Gider | Net kâr | Kira | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Malzeme (alınan) | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 67 | 132 | 48 | 84 | 10 | 12 | 4.8 | 1.2 | 0.0 | 0.0 | 0.0 | 80% | 1.0 | 0.0 | 94 |
| 2 | 7 | 100% | 87 | 187 | 77 | 110 | 20 | 12 | 4.7 | 2.3 | 0.0 | 0.0 | 0.0 | 68% | 2.0 | 0.0 | 105 |
| 3 | 8 | 100% | 105 | 224 | 91 | 133 | 20 | 11 | 4.2 | 3.5 | 0.1 | 0.0 | 0.1 | 53% | 2.8 | 0.0 | 88 |
| 4 | 9 | 100% | 115 | 245 | 102 | 143 | 20 | 8 | 3.2 | 5.4 | 0.2 | 0.0 | 0.1 | 36% | 3.0 | 0.0 | 181 |
| 5 | 10 | 100% | 134 | 290 | 125 | 165 | 30 | 8 | 3.0 | 6.4 | 0.4 | 0.0 | 0.2 | 30% | 3.0 | 0.2 | 263 |
| 6 | 11 | 99% | 149 | 348 | 156 | 192 | 30 | 4 | 1.7 | 8.5 | 0.5 | 0.1 | 0.2 | 16% | 3.0 | 1.0 | 190 |
| 7 | 12 | 100% | 158 | 378 | 168 | 210 | 30 | 2 | 0.8 | 10.4 | 0.5 | 0.0 | 0.2 | 7% | 3.0 | 1.3 | 264 |
| 8 | 13 | 100% | 177 | 442 | 199 | 244 | 30 | 10 | 2.8 | 9.1 | 0.7 | 0.1 | 0.3 | 22% | 3.0 | 1.9 | 243 |
| 9 | 14 | 100% | 186 | 489 | 213 | 276 | 30 | 20 | 6.1 | 6.8 | 0.7 | 0.0 | 0.3 | 44% | 3.0 | 2.5 | 279 |
| 10 | 15 | 98% | 199 | 539 | 234 | 305 | 40 | 24 | 6.2 | 7.6 | 0.8 | 0.1 | 0.4 | 41% | 3.0 | 3.0 | 343 |
| 11 | 16 | 98% | 218 | 586 | 256 | 330 | 40 | 28 | 6.5 | 7.9 | 1.0 | 0.1 | 0.4 | 41% | 3.7 | 3.0 | 295 |
| 12 | 17 | 96% | 225 | 626 | 271 | 355 | 40 | 17 | 3.6 | 11.1 | 1.4 | 0.2 | 0.5 | 22% | 4.0 | 3.2 | 394 |
| 13 | 18 | 94% | 232 | 670 | 285 | 385 | 40 | 18 | 3.6 | 11.8 | 1.6 | 0.2 | 0.5 | 21% | 4.0 | 3.8 | 386 |
| 14 | 19 | 92% | 236 | 676 | 298 | 377 | 40 | 10 | 2.0 | 13.7 | 2.0 | 0.3 | 0.5 | 11% | 4.0 | 4.2 | 441 |
| 15 | 20 | 88% | 238 | 705 | 308 | 397 | 40 | 22 | 3.9 | 12.2 | 2.1 | 0.4 | 0.6 | 21% | 4.0 | 4.8 | 434 |

### Hızlı oyuncu (dokunuş 0.4 sn, sipariş okuma 0.5 sn, sürükleme 0.7 sn, hata %1.5)

| Gün | Müşteri | Kazanma (ilk deneme) | Süre (sn) | Gelir | Gider | Net kâr | Kira | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Malzeme (alınan) | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 65 | 140 | 54 | 86 | 10 | 20 | 5.2 | 0.8 | 0.0 | 0.0 | 0.0 | 86% | 1.0 | 0.0 | 96 |
| 2 | 7 | 100% | 86 | 212 | 83 | 129 | 20 | 37 | 7.0 | 0.0 | 0.0 | 0.0 | 0.0 | 100% | 2.0 | 0.0 | 124 |
| 3 | 8 | 100% | 102 | 266 | 96 | 170 | 20 | 47 | 7.8 | 0.1 | 0.0 | 0.0 | 0.0 | 98% | 3.0 | 0.0 | 115 |
| 4 | 9 | 100% | 113 | 301 | 107 | 194 | 20 | 55 | 8.8 | 0.2 | 0.0 | 0.0 | 0.0 | 98% | 3.0 | 0.0 | 289 |
| 5 | 10 | 100% | 130 | 362 | 128 | 234 | 30 | 65 | 9.7 | 0.2 | 0.0 | 0.0 | 0.0 | 97% | 3.0 | 1.0 | 193 |
| 6 | 11 | 100% | 145 | 449 | 157 | 292 | 30 | 78 | 10.7 | 0.3 | 0.0 | 0.0 | 0.0 | 97% | 3.0 | 1.9 | 147 |
| 7 | 12 | 100% | 154 | 495 | 170 | 325 | 30 | 92 | 11.7 | 0.3 | 0.0 | 0.0 | 0.0 | 97% | 3.0 | 2.1 | 362 |
| 8 | 13 | 100% | 174 | 576 | 198 | 378 | 30 | 107 | 12.6 | 0.4 | 0.0 | 0.0 | 0.1 | 97% | 3.0 | 3.0 | 348 |
| 9 | 14 | 100% | 182 | 633 | 213 | 420 | 30 | 131 | 13.5 | 0.4 | 0.0 | 0.0 | 0.1 | 96% | 4.0 | 3.0 | 246 |
| 10 | 15 | 100% | 195 | 732 | 225 | 507 | 40 | 149 | 14.4 | 0.5 | 0.0 | 0.0 | 0.1 | 96% | 4.0 | 3.6 | 347 |
| 11 | 16 | 100% | 216 | 847 | 257 | 590 | 40 | 165 | 15.2 | 0.7 | 0.0 | 0.0 | 0.1 | 95% | 4.0 | 4.1 | 591 |
| 12 | 17 | 100% | 223 | 893 | 273 | 620 | 40 | 174 | 16.0 | 0.8 | 0.0 | 0.0 | 0.1 | 94% | 4.0 | 5.0 | 535 |
| 13 | 18 | 100% | 230 | 957 | 286 | 670 | 40 | 196 | 17.1 | 0.8 | 0.0 | 0.0 | 0.1 | 95% | 4.0 | 6.0 | 379 |
| 14 | 19 | 100% | 237 | 1038 | 305 | 733 | 40 | 234 | 17.9 | 0.9 | 0.0 | 0.0 | 0.1 | 94% | 4.0 | 6.5 | 601 |
| 15 | 20 | 100% | 242 | 1096 | 318 | 778 | 40 | 249 | 19.0 | 0.9 | 0.0 | 0.0 | 0.1 | 95% | 4.0 | 7.0 | 795 |
