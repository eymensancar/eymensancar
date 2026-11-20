# Burger Ustası: ekonomi ve denge (5. tur: mutfak)

Değerlerin hepsi `www/js/veri.js` içinde (`BU.VERI`, ince ayarlar `BU.VERI.AYAR`). Tablolar denge botunun çıktısı:

- `node scripts/denge.mjs 400 md`: 1–15. günler (her düzeyde 400 oyun).
- `node scripts/denge.mjs saat 16 md`: uzun oyun, her düzeyde 16 oyuncu ilk günden premium malzemeye kadar (en çok 120 gerçek saat).
- `node scripts/denge.mjs tavan 150 md`: zorluk tavanı (belli günlerde kazanma oranı).

Değer değiştirince botu yeniden çalıştır ve tabloları güncelle. Deneme için: `DENGE_AYAR='{"sabirMin":11}' node scripts/denge.mjs tavan`.

## Ekonomi kısaca

- Yeni oyuncu **50** parayla başlar (`BASLANGIC`). Başta yalnız ekmek ve köfte açık.
- Öbür **15** şey dükkânda **parayla, sırayla, birer kez** alınır (`SATIN_SIRA`, `fiyatAc`): 13 burger katmanı ve 2 **yan ürün** (patates kızartması, soğan halkası). Siparişler yalnız sahip olunanlardan.
- Her gün sonunda **kira** düşer (`kira(gun)`, gün kaybedilse de). Kasa eksiye düşebilir; eksi kasayla dükkândan hiçbir şey alınamaz (`alabilir`). **3 gün art arda** eksi kalırsa dükkân kapanır, kasa **50**'ye döner, alınanlar kalır (`gunSonu`).
- **Izgara 6 göz:** başta 2 açık; "Geniş ızgara" (`slot`) 4 düzey, her düzey bir göz (`izgaraGoz(up)` = 2 + slot).
- Zorluk (müşteri sayısı, sabır, gelme aralığı, sipariş büyüklüğü) 18. güne kadar artar, sonra sabit kalır (`AYAR.zorTavan`). 300. gün 18. gün kadar zordur.
- Gerçek oynama: bir gün 1–2 dakikayla başlar, 15. günden sonra ~4 dakika (20 müşteri). Saatte ~14 gün.
- 5. turda değişen denge değerleri: sabır tabanı 15,5 → 16 sn, katman başına sabır 3,5 → 3,7 sn (orta oyuncunun mutlu oranı 1–15. günlerde %8–44'ten %31–91'e, çoğu gün %40–65'e çıktı).

## Malzemeler ve yan ürünler

Bütün paralar tam sayı. Malzeme tabağa konunca (köfte ızgaraya, yan ürün fritöze konunca) maliyeti kasadan düşer. Ekmek parası alt ekmekte bir kez; üst ekmek bedava. `tur`: **katman** burgerin içine girer, **yan** fritözde pişen yan üründür ve **burgerin içine asla konmaz** (`siparis()` hiç yan ürün döndürmez; tabakta yan ürün olan burger `dogruMu` ile yanlıştır).

| Sıra | Malzeme | Anahtar | Tür | Dükkân fiyatı | Porsiyon maliyeti | Menüye katkısı (`satis`) |
|---|---|---|---|---|---|---|
| | Ekmek (alt; üst bedava) | `bun` | katman | başta açık | 2 | 5 |
| | Köfte | `patty` | katman | başta açık | 6 | 14 |
| 1 | Peynir | `cheese` | katman | 30 | 3 | 6 |
| 2 | Marul | `lettuce` | katman | 80 | 1 | 6 |
| 3 | Domates | `tomato` | katman | 160 | 2 | 6 |
| 4 | Soğan | `onion` | katman | 500 | 1 | 7 |
| 5 | Turşu | `pickle` | katman | 1.200 | 1 | 7 |
| 6 | Pastırma | `bacon` | katman | 2.500 | 4 | 9 |
| 7 | Yumurta | `egg` | katman | 5.000 | 2 | 10 |
| 8 | Ketçap | `sauce` | katman | 9.000 | 1 | 10 |
| 9 | Mayonez | `mayo` | katman | 15.000 | 1 | 11 |
| 10 | Mantar | `mushroom` | katman | 25.000 | 3 | 13 |
| 11 | Jalapeño | `jalapeno` | katman | 45.000 | 3 | 15 |
| 12 | **Patates kızartması** | `fries` | **yan** | 80.000 | 2 | 15 |
| 13 | Avokado | `avocado` | katman | 150.000 | 6 | 22 |
| 14 | **Soğan halkası** | `onionring` | **yan** | 250.000 | 3 | 24 |
| 15 | **Altın Wagyu** (premium; EN Golden Wagyu) | `premium` | katman | 550.000 | 10 | 32 |

Dükkân fiyatı her adımda ~1,6–2,5 katına çıkar: ilk üçü 1–3. günde (5 dakikada), ortadakiler birkaç saatte, son üçü onlarca saatte gelir (aşağıdaki saat tablosu). `satis` dükkân sırası boyunca hiç azalmaz.

**Menü fiyatı** = alt ekmeğin, ortadaki her katmanın ve (varsa) yan ürünün `satis` değerinin toplamı, bir kez en yakın 5'e yuvarlanır (en az 15). Geliştirmeler fiyatı değiştirmez. Siparişte katmanlar `satis` ağırlığıyla seçilir (pahalı malzeme daha sık istenir): **her yeni malzeme ortalama siparişi pahalılaştırır**.

| Sipariş | Maliyet | Fiyat | Bahşiş (sabır tam) | Bahşiş (sabır 0,7) |
|---|---|---|---|---|
| Ekmek + köfte | 8 | 20 | 6 | 2 |
| + peynir | 11 | 25 | 8 | 3 |
| + peynir, marul, domates | 14 | 35 | 11 | 4 |
| Köfte, peynir + patates | 13 | 40 | 12 | 4 |
| Çift köfte, peynir, pastırma, yumurta | 23 | 60 | 18 | 6 |
| Köfte, ketçap, mayonez, mantar | 13 | 55 | 17 | 6 |
| Köfte, ketçap, mayonez, mantar + patates | 15 | 70 | 21 | 7 |
| Köfte, jalapeño, avokado, Altın Wagyu + soğan halkası | 30 | 110 | 33 | 11 |
| Çift köfte, Altın Wagyu, avokado, jalapeño, mayonez + soğan halkası | 37 | 135 | 41 | 14 |

**Bahşiş** (yalnız doğru ve mutlu teslimde, tam siparişin fiyatından): fiyatın %8'i (sabır 2/3'teyken) ile %30'u (sabır doluyken) arası, kalan sabırla düz artar. "Cömert bahşiş" her düzeyde +%25. Art arda 3. mutlu teslimden sonra seri payı: +1, +2 … en çok +5. En az 1.

### Yan ürün kuralları

- **Fritöz:** her yan ürünün bir sepeti. Sepete dokununca bir porsiyon pişer (`yanPisme(up, k)`: patates 5 sn, soğan halkası 6 sn; "Hızlı ızgara" her düzeyde −0,5 sn, en az 2,5 sn), maliyeti o an düşer. Pişen porsiyon **hazır kutusuna** geçer; kutuda en çok `YAN_STOK_MAX` = **3** porsiyon (doluysa pişen sepette bekler, köfte gibi).
- **Sipariş:** müşteri burgerin yanında **en çok bir** yan ürün ister (`siparisTam(gun, R, sahip)` → `{katmanlar, yan}`). Olasılık `yanOlas(gun, sahip)` = min(%35, %25 + %1 × (zorluk günü − 1)), iki yan ürün de alınmışsa +%10 (tavanda %45). Yan ürün alınmamışsa hiç istenmez. İkisi de varsa `satis` ağırlığıyla seçilir (soğan halkası %62, patates %38).
- **Sabır:** yan ürün isteyen müşterinin sabrı +5 sn (`sabirYan`); gelme aralığı da yan ürün olasılığı × 2 sn uzar (`aralikYan`): fritöz işi müşteri akışına eklenir.
- **Teslim parça parça:** burger ve yan ürün ayrı ayrı (hangisi önce olursa) ya da birlikte verilir. Müşteri **ikisini de alınca öder**; fiyat tam siparişin fiyatı (burger + yan ürün, bir kez yuvarlanır), ruh hâli **son parçanın verildiği andaki** sabırdan.
- **İlk doğru parça verilince sabır %15 dolar** (`parcaYenile`, müşteri başına bir kez, en çok tama). Neden "dolar" (yavaşlamak yerine): oyuncu hemen görür (çubuk zıplar, yüz düzelebilir), yarım teslimi ödüllendirir (fritöz beklerken burgeri vermek boşa değildir), oyun tarafında tek satır (`c.p = min(c.max, c.p + sabirEk × c.max)`) ve döngüde ek durum gerektirmez; yavaşlama görünmez olurdu ve "neden bekliyor" sorusu doğardı. %15 küçük tutuldu: bahşişi tek başına kurtarmaz, iki parçayı gereksiz uzatmayı ödüllendirmez.
- **Yanlış:** yanlış burger, yanlış yan ürün, yan ürün istemeyene yan ürün, aynı parçayı ikinci kez vermek → müşteri ödemez, gider, **bir can**; kayıp = o müşteriye verilen her şeyin maliyeti (önce verilen doğru parça dahil).
- **Kızgın** (sipariş tamamlandığında f ≤ 1/3): ödemez, kayıp = verilenlerin maliyeti, can gitmez (burger kuralıyla aynı).
- **Kaçan:** sabrı biten müşteri parça almış olsa da gider (bir can); verilen parça geri gelmez.

## Kira ve eksi kasa

Kira = 10 + 10 × ⌊√(gün − 1)⌋, 5'e yuvarlı, en çok 120 (`kira(gun)`):

| Gün | 1 | 2–4 | 5–9 | 10–16 | 17–25 | 26–36 | 37–49 | 50–64 | 65–81 | 82–100 | 101–121 | 122+ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Kira | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 |

İlk günlerde kira kârın küçük bir kısmı (1. gün orta oyuncu 86 kâr, 10 kira; 10. gün 324 kâr, 40 kira). 18. günden sonra orta oyuncu günde 600–1400, hızlı oyuncu 950–2000 kâr eder; 120 kira bunun %6–20'si.

`gunSonu(kasa, gun, eksiGun)`: kira düşülür; sonuç eksiyse `eksiGun` bir artar, değilse sıfırlanır; `eksiGun` 3 olursa `kapandi: true`, kasa 50, `eksiGun` 0.

## Ruh hâli ve ödeme

f = kalan sabır oranı (1 dolu, 0 boş). Yan ürünlü siparişte f, siparişin tamamlandığı (son parçanın verildiği) andaki oran.

| f | Ruh | Yüz | Doğru (tam) siparişte | Yanlış parçada |
|---|---|---|---|---|
| f > 2/3 | mutlu | `happy` | fiyat + bahşiş | ödemez, −maliyet, 1 can |
| 2/3 ≥ f > 1/2 | somurtkan | `wait` | yalnız fiyat | ödemez, −maliyet, 1 can |
| 1/2 ≥ f > 1/3 | somurtkan | `imp` | yalnız fiyat | ödemez, −maliyet, 1 can |
| f ≤ 1/3 | kızgın | `angry` | ödemez, −maliyet (can gitmez) | ödemez, −maliyet, 1 can |
| f = 0 | kaçar | `angry` | (siparişi tamamlanmadan gider, 1 can) | |

## Günler

Gelme aralığının ortası = 10,5 + 1,6 × (siparişte beklenen ortadaki katman sayısı) − 0,38 × (zorluk günü − 1) sn, en az 6, artı 2 × yan ürün olasılığı; aralık bunun %75'i ile %125'i. Sabır = (taban + 3,7 × ortadaki katman sayısı + yan ürün varsa 5) × (1 + %10 × "Sabırlı müşteri" düzeyi); taban 16 sn'den başlar, günde 0,35 sn azalır, en az 10. **Zorluk günü** = min(gün, 18). Tablodaki "Sabır" sütunları geliştirmesiz.

| Gün | Müşteri | Aynı anda | Gelme aralığı (3 malzeme) | Gelme aralığı (13 katman) | Gelme aralığı (hepsi, yan ürünlü) | Taban sabır | Ekstra malzeme | Sabır: köfte+peynir | Sabır: köfte + 5 malzeme | Sabır: köfte + 5 malzeme + yan ürün | Yan ürün olasılığı (ikisi de) | Kira |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 2 | 9.7–16.1 | 9.7–16.1 | 10.2–17 | 16 | 0–1 | 23 | 35 | 40 | %35 | 10 |
| 2 | 7 | 2 | 10.6–17.7 | 10.6–17.7 | 11.1–18.6 | 16 | 1–2 | 23 | 34 | 39 | %36 | 20 |
| 3 | 8 | 3 | 10.3–17.2 | 10.3–17.2 | 10.9–18.1 | 15 | 1–2 | 23 | 34 | 39 | %37 | 20 |
| 5 | 10 | 3 | 10.3–17.2 | 10.3–17.2 | 10.9–18.2 | 15 | 1–3 | 22 | 33 | 38 | %39 | 30 |
| 7 | 12 | 3 | 10.1–16.8 | 10.1–16.8 | 10.7–17.8 | 14 | 1–3 | 21 | 32 | 37 | %41 | 30 |
| 10 | 15 | 3 | 10.1–16.8 | 10.1–16.8 | 10.7–17.9 | 13 | 2–3 | 20 | 31 | 36 | %44 | 40 |
| 13 | 18 | 3 | 9.8–16.3 | 9.8–16.3 | 10.5–17.5 | 12 | 2–4 | 19 | 30 | 35 | %45 | 40 |
| 15 | 20 | 3 | 9.2–15.4 | 9.2–15.4 | 9.9–16.5 | 11 | 2–4 | 19 | 30 | 35 | %45 | 40 |
| 17 | 20 | 3 | 8.7–14.4 | 9.3–15.4 | 9.9–16.6 | 10 | 3–4 | 18 | 29 | 34 | %45 | 50 |
| 18 (tavan) | 20 | 3 | 8.4–14 | 9–15 | 9.6–16.1 | 10 | 3–4 | 17 | 29 | 34 | %45 | 50 |
| 50 | 20 | 3 | 8.4–14 | 9–15 | 9.6–16.1 | 10 | 3–4 | 17 | 29 | 34 | %45 | 80 |
| 300 | 20 | 3 | 8.4–14 | 9–15 | 9.6–16.1 | 10 | 3–4 | 17 | 29 | 34 | %45 | 120 |

- Müşteri sayısı 5 + gün (en çok 20). İlk iki gün aynı anda en çok 2 müşteri, sonra 3.
- Köfte her siparişte var. 6. günden sonra %25 çift köfte, 10. günden sonra %20 bir malzeme iki kez. Bir burger en çok 10 katman.
- İlk 3 gün köfte siparişte hep altta görünür, sonra sıra karışık (teslimde sıra önemsiz).
- Köfte pişme süresi 4 sn, "Hızlı ızgara" her düzeyde −0,5 sn (en hızlı 2 sn). Köfte stoğu en çok 6.

## Geliştirmeler

| Geliştirme | Etki | 1. düzey | 2. | 3. | 4. |
|---|---|---|---|---|---|
| Hızlı ızgara (`cook`) | köfte ve fritöz 0,5 sn daha çabuk | 300 | 600 | 1.200 | 2.400 |
| Sabırlı müşteri (`pat`) | sabır +%10 | 350 | 700 | 1.400 | 2.800 |
| Cömert bahşiş (`tip`) | bahşiş +%25 | 400 | 800 | 1.600 | 3.200 |
| Geniş ızgara (`slot`) | +1 ızgara gözü (3., 4., 5., 6. göz; 4. günden sonra) | 800 | 2.500 | 7.000 | 18.000 |

Eski kayıtta `slot: 1` (3. göz) aynen 3 göz olarak kalır.

## Denge botu

Oyuncu modeli:
- Malzeme koymak = kutuya dokun + tabağa dokun (2 dokunuş); seçili malzemeyi yeniden koymak 1 dokunuş. Izgaraya köfte 1 dokunuş. Her dokunuşun süresi rastgele 0,8–1,25 kat oynar.
- Yeni müşterinin siparişine bakmak "okuma" süresi; teslim ve çöp birer sürükleme.
- İki tabakta en acil iki müşterinin burgeri birlikte yapılır; köfte stokta yoksa öbür malzemeler önce konur, köfte beklenir.
- Izgarada (2 + slot göz) bekleyen siparişlerin köftesi kadar pişirilir (orta oyuncu 1, hızlı oyuncu 2 fazla).
- **Fritöz:** bekleyen yan ürün siparişi hazır + pişen porsiyondan fazlaysa sepete dokunur (1 dokunuş). Hazır yan ürünü bekleyen en acil müşteriye bir sürüklemeyle verir (burgerden önce de olabilir; ilk parçada sabır %15 dolar). İki yan ürün varsa yan üründe de hata olur (öbürü verilir → yanlış).
- Hata: bir malzeme yerine yanlışı konur. Oyuncu burger bitince bunu fark ederse (yavaş %60, orta %70, hızlı %85) çöpe atar ve yeniden yapar, etmezse yanlış teslim eder.
- Kızgın müşteriye de burger verilir (can gitmesin diye). Gün, 3 can gitmeden bitince kazanılır; kaybedilen gün yeniden oynanır.
- **Gün sonu:** kira (`gunSonu`), sonra dükkân: sıradaki malzeme ve geliştirmelerin hangisi en ucuzsa o alınır, kasada ertesi günün iki kirası kalacak şekilde, para yettikçe. Slot 4. günden önce alınmaz.
- **Gerçek süre** = günün oynanma süresi + 10 sn (gün kartları, dükkân).

| Düzey | Dokunuş | Sipariş okuma | Sürükleme | Malzeme başına hata |
|---|---|---|---|---|
| Yavaş | 0,85 sn | 1,6 sn | 1,4 sn | %4 |
| Orta | 0,6 sn | 0,9 sn | 1,0 sn | %3 |
| Hızlı | 0,4 sn | 0,5 sn | 0,7 sn | %1,5 |

## Sonuçlar

Özet:
- **Kesin şart sağlanıyor:** hızlı oyuncu Altın Wagyu'ya ancak **~60 gerçek saatte** (846. gün) ulaşıyor; 16 hızlı oyuncunun en erkeni 59,9 saat (hedef ≥ 40). 24 saat aralıksız oynayan hızlı oyuncu avokadoya (23,5 sa) varır; soğan halkası 35,5 saatte, Altın Wagyu için o an 550.000 paranın onda biri bile yoktur. Hızlı oyuncunun gelir hızı müşteri akışıyla sınırlı (gün başına ~256 sn, %95 mutlu), o yüzden bottan iyi bir insan da kayda değer biçimde hızlı olamaz.
- **Orta oyuncu** Altın Wagyu'ya ~98 saatte (1.253. gün). İlk üç malzeme 1–3. günde (5 dakikada), soğan ilk yarım saatte, turşu–mayonez 1–9 saatte, mantar–patates 13–27 saatte, avokado 40, soğan halkası 59 saatte.
- **İlerleme hissi:** her yeni malzeme ve yan ürün saatlik kazancı artırıyor. Hızlı: 2. saatte 10,8 bin/sa (6 malzeme), 6. saatte 14,7 bin (9), 10. saatte 15,4 bin (10), 20. saatte 18,7 bin (12, patates dahil), 41. saatte 22,4 bin (14, iki yan ürün). Orta: 5,5 → 8,0 → 8,3 → 9,5 → 12,3 → 13,8 → 14,2 bin/sa.
- **Yan ürünler** gelir hızını ~%20 artırıyor (tavan, tam geliştirme: orta 13 katmanla 1.066/gün → 15 malzemeyle 1.353; hızlı 1.654 → 2.021) ve zorlaştırmıyor: fazladan sabır, gelme aralığı ve ilk parçadaki %15 yüzünden orta oyuncunun kazanma oranı aynı (%91–95), mutlu oranı %55'ten %64'e çıkıyor.
- **İlk günler rahat:** 1. gün kâr 72–90, kira 10; 2. gün kâr 98–129, kira 20. Peynir 1. gün, marul 2. gün, domates 3. gün.
- **Zorluk tavanı (18. gün):** orta oyuncu geliştirmeyle %91–97 kazanıyor (mutlu %55–64), geliştirmesiz %75–85; 40. ve 300. gün 18. günle aynı. Hızlı oyuncu her günü kazanıyor (%91–97 mutlu).
- **Yavaş oyuncu** ilk 5 günü %86+ kazanıyor, 10. günde ~%46, 13. günden sonra neredeyse hiç; uzun oyunda 17. günde takılıyor (sık "dükkân kapandı", 3 malzemede kalıyor). Bu 2. turdan beri böyle; istenirse bir "kolay" ayar ya da 15. günden sonra daha yavaş artan zorluk düşünülebilir (Eymen'in kararı).

### Her malzemeye ulaşma (ortanca; gerçek saat ve oyundaki gün)

| Malzeme | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| Peynir | 30 | 1 dk, gün 1 | 1 dk, gün 1 | 1 dk, gün 1 |
| Marul | 80 | 3 dk, gün 2 | 3 dk, gün 2 | 3 dk, gün 2 |
| Domates | 160 | 7 dk, gün 4 | 5 dk, gün 3 | 5 dk, gün 3 |
| Soğan | 500 | > 120 sa | 28 dk, gün 11 | 21 dk, gün 9 |
| Turşu | 1200 | > 120 sa | 1.1 sa, gün 20 | 48 dk, gün 16 |
| Pastırma | 2500 | > 120 sa | 2.6 sa, gün 38 | 1.6 sa, gün 27 |
| Yumurta | 5000 | > 120 sa | 4.5 sa, gün 64 | 2.6 sa, gün 42 |
| Ketçap | 9000 | > 120 sa | 6.6 sa, gün 91 | 3.8 sa, gün 59 |
| Mayonez | 15000 | > 120 sa | 8.5 sa, gün 115 | 4.8 sa, gün 75 |
| Mantar | 25000 | > 120 sa | 13.5 sa, gün 184 | 7.7 sa, gün 117 |
| Jalapeño | 45000 | > 120 sa | 18.5 sa, gün 248 | 10.6 sa, gün 159 |
| Patates kızartması (yan) | 80000 | > 120 sa | 26.8 sa, gün 355 | 15.4 sa, gün 230 |
| Avokado | 150000 | > 120 sa | 39.6 sa, gün 519 | 23.5 sa, gün 342 |
| Soğan halkası (yan) | 250000 | > 120 sa | 59.1 sa, gün 766 | 35.5 sa, gün 509 |
| Altın Wagyu (premium) | 550000 | > 120 sa | 98.0 sa, gün 1253 | 60.2 sa, gün 846 |
| Geliştirme cook (tam) |  | > 120 sa | 2.3 sa, gün 34 | 1.4 sa, gün 24 |
| Geliştirme pat (tam) |  | > 120 sa | 3.4 sa, gün 50 | 2.0 sa, gün 33 |
| Geliştirme tip (tam) |  | > 120 sa | 3.9 sa, gün 55 | 2.2 sa, gün 37 |
| Geliştirme slot (tam) |  | > 120 sa | 10.5 sa, gün 142 | 6.0 sa, gün 92 |

- Yavaş: 120.0 saatte 3738 gün oynandı (ulaşılan gün 17, kaybedilen 3722, kapanış 1211.5); gün başına 116 sn. Premiuma ulaşan yok.
  - 2. sa: gün 15, 359/sa, 3.0 malzeme
  - 6. sa: gün 16, -15/sa, 3.0 malzeme
  - 10. sa: gün 17, -19/sa, 3.0 malzeme
  - 20. sa: gün 17, 10/sa, 3.0 malzeme
  - 40. sa: gün 17, 36/sa, 3.0 malzeme
  - 61. sa: gün 17, -14/sa, 3.0 malzeme
  - 81. sa: gün 17, -43/sa, 3.0 malzeme
  - 101. sa: gün 17, 13/sa, 3.0 malzeme

- Orta: 97.7 saatte 1341 gün oynandı (ulaşılan gün 1253, kaybedilen 89, kapanış 0.0); gün başına 262 sn. En erken premium: 95.0 sa (16/16 oyuncu ulaştı).
  - 2. sa: gün 32, 5540/sa, 5.0 malzeme
  - 6. sa: gün 86, 7998/sa, 7.1 malzeme
  - 10. sa: gün 139, 8272/sa, 9.0 malzeme
  - 20. sa: gün 274, 9519/sa, 11.0 malzeme
  - 41. sa: gün 535, 12257/sa, 12.9 malzeme
  - 61. sa: gün 793, 13768/sa, 14.0 malzeme
  - 81. sa: gün 1048, 14180/sa, 14.0 malzeme

- Hızlı: 60.2 saatte 847 gün oynandı (ulaşılan gün 847, kaybedilen 0, kapanış 0.0); gün başına 256 sn. En erken premium: 59.9 sa (16/16 oyuncu ulaştı).
  - 2. sa: gün 35, 10764/sa, 6.0 malzeme
  - 6. sa: gün 95, 14687/sa, 9.0 malzeme
  - 10. sa: gün 155, 15441/sa, 10.0 malzeme
  - 20. sa: gün 300, 18704/sa, 12.0 malzeme
  - 41. sa: gün 580, 22423/sa, 14.0 malzeme

### Zorluk tavanı

Her hücre: ilk denemede kazanma oranı / mutlu teslim oranı / günün kârı (kira öncesi). "4 malzeme" = peynir, marul, domates, soğan; "13 katman" = yan ürünler hariç hepsi; "15 malzeme" = iki yan ürün dahil hepsi. Tam geliştirme = cook 4, pat 4, tip 4, slot 4 (6 göz).

**Yavaş oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| 4 malzeme, geliştirmesiz | 82% / 0% / 125 | 40% / 0% / 59 | 0% / 1% / -58 | 0% / 1% / -70 | 0% / 1% / -68 | 0% / 1% / -62 |
| 4 malzeme, tam geliştirme | 98% / 24% / 158 | 71% / 2% / 128 | 0% / 0% / -30 | 0% / 1% / -37 | 0% / 1% / -39 | 0% / 1% / -38 |
| 13 katman (yan ürünsüz), tam gel. | 95% / 23% / 264 | 64% / 2% / 266 | 3% / 0% / -4 | 0% / 0% / -33 | 0% / 0% / -21 | 0% / 0% / -29 |
| 15 malzeme, geliştirmesiz | 89% / 14% / 269 | 29% / 2% / 157 | 1% / 0% / -27 | 0% / 0% / -70 | 0% / 0% / -50 | 0% / 0% / -60 |
| 15 malzeme, tam geliştirme | 99% / 42% / 419 | 67% / 15% / 371 | 2% / 4% / 54 | 0% / 4% / -5 | 0% / 4% / 7 | 0% / 3% / -3 |

**Orta oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| 4 malzeme, geliştirmesiz | 99% / 64% / 199 | 98% / 17% / 295 | 89% / 2% / 381 | 75% / 0% / 300 | 79% / 0% / 295 | 81% / 0% / 334 |
| 4 malzeme, tam geliştirme | 100% / 92% / 287 | 99% / 86% / 507 | 97% / 71% / 620 | 97% / 57% / 588 | 96% / 59% / 595 | 94% / 53% / 577 |
| 13 katman (yan ürünsüz), tam gel. | 100% / 93% / 478 | 100% / 87% / 869 | 95% / 72% / 1099 | 92% / 55% / 1029 | 93% / 56% / 1062 | 95% / 58% / 1066 |
| 15 malzeme, geliştirmesiz | 100% / 76% / 455 | 97% / 48% / 765 | 91% / 32% / 931 | 84% / 26% / 864 | 82% / 27% / 841 | 85% / 27% / 903 |
| 15 malzeme, tam geliştirme | 100% / 92% / 611 | 99% / 89% / 1121 | 99% / 77% / 1480 | 93% / 63% / 1378 | 93% / 64% / 1398 | 91% / 64% / 1353 |

**Hızlı oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| 4 malzeme, geliştirmesiz | 100% / 97% / 256 | 100% / 95% / 482 | 100% / 94% / 686 | 100% / 91% / 738 | 99% / 93% / 747 | 100% / 93% / 748 |
| 4 malzeme, tam geliştirme | 100% / 100% / 335 | 100% / 98% / 624 | 100% / 95% / 878 | 100% / 95% / 956 | 100% / 94% / 945 | 100% / 95% / 954 |
| 13 katman (yan ürünsüz), tam gel. | 100% / 99% / 552 | 100% / 98% / 1046 | 100% / 95% / 1507 | 100% / 94% / 1644 | 100% / 93% / 1639 | 100% / 95% / 1654 |
| 15 malzeme, geliştirmesiz | 100% / 98% / 529 | 100% / 97% / 1024 | 100% / 96% / 1472 | 100% / 94% / 1567 | 100% / 95% / 1573 | 100% / 94% / 1566 |
| 15 malzeme, tam geliştirme | 100% / 99% / 691 | 100% / 99% / 1293 | 100% / 96% / 1886 | 100% / 97% / 2042 | 100% / 96% / 2040 | 100% / 96% / 2021 |

## 1–15. günler (yeni oyuncu, 50 parayla)

Tablolardaki sayılar ilk denemenin ortalaması. Kasa = gün sonu kira ve dükkân alışverişinden sonra kalan; Malzeme = alınmış malzeme sayısı (ekmek, köfte hariç). Bu günlerde yan ürün yok (ilk yan ürün ~230. günde).

### Yavaş oyuncu (dokunuş 0.85 sn, sipariş okuma 1.6 sn, sürükleme 1.4 sn, hata %4)

| Gün | Müşteri | Kazanma (ilk deneme) | Süre (sn) | Gelir | Gider | Net kâr | Kira | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Malzeme (alınan) | Geliştirme | Izgara gözü | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 72 | 120 | 48 | 72 | 10 | 0 | 0.0 | 6.0 | 0.0 | 0.0 | 0.0 | 0% | 1.0 | 0.0 | 2.0 | 82 |
| 2 | 7 | 100% | 92 | 175 | 77 | 98 | 20 | 0 | 0.0 | 7.0 | 0.0 | 0.0 | 0.0 | 0% | 2.0 | 0.0 | 2.0 | 80 |
| 3 | 8 | 97% | 109 | 194 | 90 | 105 | 20 | 0 | 0.0 | 7.1 | 0.4 | 0.3 | 0.1 | 0% | 2.0 | 0.0 | 2.0 | 161 |
| 4 | 9 | 96% | 119 | 220 | 100 | 119 | 20 | 0 | 0.0 | 8.0 | 0.3 | 0.3 | 0.2 | 0% | 2.8 | 0.0 | 2.0 | 140 |
| 5 | 10 | 86% | 134 | 239 | 118 | 121 | 30 | 0 | 0.0 | 8.1 | 0.6 | 0.6 | 0.3 | 0% | 3.0 | 0.0 | 2.0 | 221 |
| 6 | 11 | 79% | 144 | 260 | 142 | 118 | 30 | 0 | 0.0 | 7.8 | 1.1 | 0.9 | 0.3 | 0% | 3.0 | 0.4 | 2.0 | 198 |
| 7 | 12 | 71% | 150 | 259 | 153 | 107 | 30 | 0 | 0.0 | 7.7 | 1.6 | 1.1 | 0.3 | 0% | 3.0 | 0.7 | 2.0 | 215 |
| 8 | 13 | 63% | 163 | 260 | 171 | 89 | 30 | 0 | 0.0 | 7.2 | 2.4 | 1.2 | 0.5 | 0% | 3.0 | 1.1 | 2.0 | 203 |
| 9 | 14 | 51% | 166 | 233 | 178 | 55 | 30 | 0 | 0.1 | 6.3 | 3.3 | 1.5 | 0.4 | 1% | 3.0 | 1.2 | 2.0 | 201 |
| 10 | 15 | 46% | 168 | 227 | 183 | 44 | 40 | 0 | 0.0 | 6.1 | 3.5 | 1.6 | 0.5 | 0% | 3.0 | 1.4 | 2.0 | 161 |
| 11 | 16 | 40% | 176 | 247 | 192 | 56 | 40 | 0 | 0.1 | 6.4 | 3.3 | 1.7 | 0.5 | 1% | 3.0 | 1.5 | 2.0 | 164 |
| 12 | 17 | 30% | 173 | 202 | 191 | 11 | 40 | 0 | 0.1 | 5.2 | 4.2 | 2.0 | 0.5 | 1% | 3.0 | 1.6 | 2.0 | 113 |
| 13 | 18 | 17% | 164 | 152 | 184 | -32 | 40 | 0 | 0.1 | 3.9 | 4.8 | 2.3 | 0.5 | 1% | 3.0 | 1.6 | 2.0 | 34 |
| 14 | 19 | 9% | 153 | 126 | 175 | -48 | 40 | 1 | 0.1 | 3.2 | 4.8 | 2.5 | 0.4 | 1% | 3.0 | 1.6 | 2.0 | -26 |
| 15 | 20 | 1% | 128 | 91 | 149 | -58 | 40 | 1 | 0.1 | 2.3 | 3.9 | 2.7 | 0.3 | 1% | 3.0 | 1.6 | 2.0 | -64 |

### Orta oyuncu (dokunuş 0.6 sn, sipariş okuma 0.9 sn, sürükleme 1 sn, hata %3)

| Gün | Müşteri | Kazanma (ilk deneme) | Süre (sn) | Gelir | Gider | Net kâr | Kira | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Malzeme (alınan) | Geliştirme | Izgara gözü | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 66 | 134 | 48 | 86 | 10 | 14 | 5.0 | 1.0 | 0.0 | 0.0 | 0.0 | 83% | 1.0 | 0.0 | 2.0 | 96 |
| 2 | 7 | 100% | 88 | 197 | 77 | 120 | 20 | 22 | 6.3 | 0.7 | 0.0 | 0.0 | 0.0 | 91% | 2.0 | 0.0 | 2.0 | 116 |
| 3 | 8 | 100% | 105 | 236 | 91 | 145 | 20 | 22 | 6.3 | 1.5 | 0.1 | 0.0 | 0.1 | 79% | 2.9 | 0.0 | 2.0 | 93 |
| 4 | 9 | 100% | 116 | 260 | 103 | 157 | 20 | 19 | 6.2 | 2.6 | 0.1 | 0.0 | 0.1 | 69% | 3.0 | 0.0 | 2.0 | 218 |
| 5 | 10 | 100% | 133 | 300 | 126 | 174 | 30 | 19 | 6.0 | 3.4 | 0.3 | 0.0 | 0.2 | 60% | 3.0 | 0.6 | 2.0 | 190 |
| 6 | 11 | 100% | 149 | 362 | 154 | 208 | 30 | 13 | 4.5 | 5.9 | 0.4 | 0.0 | 0.2 | 41% | 3.0 | 1.0 | 2.0 | 246 |
| 7 | 12 | 99% | 158 | 386 | 169 | 216 | 30 | 10 | 3.7 | 7.5 | 0.5 | 0.1 | 0.2 | 31% | 3.0 | 1.6 | 2.0 | 201 |
| 8 | 13 | 99% | 177 | 473 | 199 | 275 | 30 | 36 | 7.7 | 4.4 | 0.6 | 0.0 | 0.3 | 59% | 3.0 | 2.1 | 2.0 | 288 |
| 9 | 14 | 99% | 186 | 529 | 214 | 316 | 30 | 56 | 10.7 | 2.3 | 0.6 | 0.0 | 0.3 | 77% | 3.0 | 2.8 | 2.0 | 277 |
| 10 | 15 | 99% | 198 | 559 | 235 | 324 | 40 | 47 | 9.5 | 4.1 | 0.8 | 0.1 | 0.4 | 64% | 3.4 | 3.0 | 2.0 | 326 |
| 11 | 16 | 99% | 219 | 643 | 256 | 387 | 40 | 58 | 10.4 | 4.3 | 0.8 | 0.1 | 0.4 | 65% | 3.9 | 3.1 | 2.0 | 379 |
| 12 | 17 | 97% | 225 | 681 | 272 | 410 | 40 | 54 | 9.8 | 5.1 | 1.3 | 0.1 | 0.5 | 59% | 4.0 | 3.6 | 2.0 | 363 |
| 13 | 18 | 95% | 231 | 694 | 286 | 409 | 40 | 37 | 7.2 | 8.2 | 1.6 | 0.2 | 0.5 | 41% | 4.0 | 4.1 | 2.0 | 444 |
| 14 | 19 | 92% | 238 | 740 | 300 | 440 | 40 | 48 | 8.5 | 7.7 | 1.6 | 0.2 | 0.6 | 46% | 4.0 | 4.8 | 2.0 | 431 |
| 15 | 20 | 94% | 244 | 799 | 316 | 483 | 40 | 68 | 10.4 | 6.8 | 1.7 | 0.2 | 0.6 | 53% | 4.0 | 5.3 | 2.0 | 466 |

### Hızlı oyuncu (dokunuş 0.4 sn, sipariş okuma 0.5 sn, sürükleme 0.7 sn, hata %1.5)

| Gün | Müşteri | Kazanma (ilk deneme) | Süre (sn) | Gelir | Gider | Net kâr | Kira | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Malzeme (alınan) | Geliştirme | Izgara gözü | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 65 | 144 | 54 | 90 | 10 | 24 | 5.9 | 0.1 | 0.0 | 0.0 | 0.0 | 98% | 1.0 | 0.0 | 2.0 | 100 |
| 2 | 7 | 100% | 86 | 212 | 83 | 129 | 20 | 37 | 7.0 | 0.0 | 0.0 | 0.0 | 0.0 | 100% | 2.0 | 0.0 | 2.0 | 129 |
| 3 | 8 | 100% | 102 | 267 | 96 | 171 | 20 | 48 | 7.8 | 0.1 | 0.0 | 0.0 | 0.0 | 98% | 3.0 | 0.0 | 2.0 | 121 |
| 4 | 9 | 100% | 113 | 303 | 107 | 196 | 20 | 56 | 8.8 | 0.2 | 0.0 | 0.0 | 0.0 | 98% | 3.0 | 0.0 | 2.0 | 297 |
| 5 | 10 | 100% | 130 | 366 | 129 | 237 | 30 | 67 | 9.7 | 0.3 | 0.0 | 0.0 | 0.0 | 97% | 3.0 | 1.0 | 2.0 | 204 |
| 6 | 11 | 100% | 145 | 451 | 157 | 294 | 30 | 81 | 10.7 | 0.3 | 0.0 | 0.0 | 0.1 | 97% | 3.0 | 1.9 | 2.0 | 148 |
| 7 | 12 | 100% | 155 | 496 | 170 | 327 | 30 | 94 | 11.7 | 0.3 | 0.0 | 0.0 | 0.1 | 97% | 3.0 | 2.2 | 2.0 | 336 |
| 8 | 13 | 100% | 173 | 579 | 199 | 381 | 30 | 111 | 12.5 | 0.4 | 0.0 | 0.0 | 0.1 | 96% | 3.0 | 3.0 | 2.0 | 364 |
| 9 | 14 | 100% | 182 | 640 | 214 | 426 | 30 | 135 | 13.5 | 0.4 | 0.0 | 0.0 | 0.1 | 96% | 4.0 | 3.0 | 2.0 | 263 |
| 10 | 15 | 100% | 195 | 738 | 225 | 513 | 40 | 153 | 14.4 | 0.5 | 0.0 | 0.0 | 0.1 | 96% | 4.0 | 3.7 | 2.0 | 290 |
| 11 | 16 | 100% | 216 | 853 | 258 | 595 | 40 | 170 | 15.1 | 0.7 | 0.0 | 0.0 | 0.1 | 95% | 4.0 | 4.2 | 2.0 | 570 |
| 12 | 17 | 100% | 222 | 909 | 272 | 637 | 40 | 185 | 16.2 | 0.7 | 0.0 | 0.0 | 0.1 | 95% | 4.0 | 5.0 | 2.0 | 584 |
| 13 | 18 | 100% | 230 | 967 | 287 | 679 | 40 | 202 | 17.1 | 0.8 | 0.0 | 0.0 | 0.1 | 95% | 4.0 | 6.0 | 2.0 | 425 |
| 14 | 19 | 100% | 237 | 1047 | 304 | 743 | 40 | 242 | 17.9 | 0.9 | 0.0 | 0.0 | 0.1 | 94% | 4.0 | 7.0 | 3.0 | 356 |
| 15 | 20 | 100% | 242 | 1105 | 318 | 787 | 40 | 258 | 19.0 | 0.9 | 0.0 | 0.0 | 0.1 | 95% | 4.1 | 7.0 | 3.0 | 979 |
