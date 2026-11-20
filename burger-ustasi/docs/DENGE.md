# Burger Ustası: ekonomi ve denge

Değerlerin hepsi `www/js/veri.js` içinde (`BU.VERI`, ince ayarlar `BU.VERI.AYAR`). Bu sayfadaki sonuçlar `node scripts/denge.mjs 400 md` çıktısıdır. Değer değiştirince botu yeniden çalıştır ve tabloları güncelle.

## Fiyatlar

Bütün paralar tam sayı. Malzeme tabağa konunca (köfte ızgaraya konunca) parası kasadan düşer. Ekmek parası alt ekmek konunca bir kez alınır; üst ekmek bedava.

| Malzeme | Açıldığı gün | Maliyet |
|---|---|---|
| Ekmek (alt; üst bedava) | 1 | 2 |
| Köfte | 1 | 6 |
| Peynir | 1 | 3 |
| Marul | 2 | 1 |
| Domates | 3 | 2 |
| Soğan | 5 | 1 |
| Pastırma | 7 | 4 |
| Yumurta | 9 | 2 |
| Turşu | 11 | 1 |

**Menü fiyatı** = burger maliyeti × 2,25, en yakın 5'e yuvarlanır (en az 15). Geliştirmeler fiyatı değiştirmez.

| Burger | Maliyet | Fiyat | Bahşiş (sabır tam) | Bahşiş (sabır 2/3'ün az üstü) |
|---|---|---|---|---|
| Ekmek + köfte | 8 | 20 | 6 | 2 |
| + peynir | 11 | 25 | 8 | 3 |
| + peynir, marul, domates | 14 | 30 | 9 | 3 |
| Çift köfte, peynir, pastırma, yumurta | 23 | 50 | 15 | 5 |
| Çift köfte, peynir, pastırma, yumurta, domates, marul | 26 | 60 | 18 | 6 |

**Bahşiş** (yalnız doğru ve mutlu teslimde): fiyatın %8'i (sabır 2/3'teyken) ile %30'u (sabır doluyken) arası, kalan sabırla düz artar. "Cömert bahşiş" her düzeyde +%25. Art arda 3. mutlu teslimden sonra seri payı: +1, +2 … en çok +5. En az 1.

## Ruh hâli ve ödeme

f = kalan sabır oranı (1 dolu, 0 boş).

| f | Ruh | Yüz | Doğru burgerde | Yanlış burgerde |
|---|---|---|---|---|
| f > 2/3 | mutlu | `happy` | fiyat + bahşiş | ödemez, −maliyet, 1 can |
| 2/3 ≥ f > 1/2 | somurtkan | `wait` | yalnız fiyat | ödemez, −maliyet, 1 can |
| 1/2 ≥ f > 1/3 | somurtkan | `imp` | yalnız fiyat | ödemez, −maliyet, 1 can |
| f ≤ 1/3 | kızgın | `angry` | ödemez, −maliyet (can gitmez) | ödemez, −maliyet, 1 can |
| f = 0 | kaçar | `angry` | (yemeği almadan gider, 1 can) | |

Kızgın teslim gerçekten zarar: 25'lik burgerde 25 yerine −11 (malzeme parası boşa). Yine de kaçmasından iyidir, çünkü can gitmez.

## Günler

Gelme aralığının ortası = 10,5 + 1,6 × (siparişte beklenen ortadaki katman sayısı) − 0,38 × (gün − 1) sn; aralık bunun %75'i ile %125'i. Büyük siparişler daha seyrek gelir; zorluk sipariş büyüklüğünden ve kısalan sabırdan gelir.

Sabır = (taban + 3,5 × ortadaki katman sayısı) × (1 + %10 × "Sabırlı müşteri" düzeyi). Taban 15,5 sn'den başlar, günde 0,35 sn azalır, en az 10.

| Gün | Müşteri | Aynı anda | Gelme aralığı (sn) | Taban sabır (sn) | Ekstra malzeme | Sabır: köfte+peynir | Sabır: köfte + 4 malzeme |
|---|---|---|---|---|---|---|---|
| 1 | 6 | 2 | 9.7–16.1 | 16 | 0–1 | 23 | 33 |
| 2 | 7 | 2 | 10.6–17.7 | 15 | 1–2 | 22 | 33 |
| 3 | 8 | 3 | 10.3–17.2 | 15 | 1–2 | 22 | 32 |
| 5 | 10 | 3 | 10.3–17.2 | 14 | 1–3 | 21 | 32 |
| 7 | 12 | 3 | 10.1–16.8 | 13 | 1–3 | 20 | 31 |
| 9 | 14 | 3 | 10.1–16.8 | 13 | 2–3 | 20 | 30 |
| 11 | 16 | 3 | 10.4–17.3 | 12 | 2–4 | 19 | 30 |
| 13 | 18 | 3 | 9.8–16.3 | 11 | 2–4 | 18 | 29 |
| 15 | 20 | 3 | 9.2–15.4 | 11 | 2–4 | 18 | 28 |

- Müşteri sayısı 5 + gün (en çok 20). İlk iki gün aynı anda en çok 2 müşteri, sonra 3.
- Köfte her siparişte var. 6. günden sonra %25 çift köfte, 10. günden sonra %20 bir malzeme iki kez. Bir burger en çok 10 katman.
- İlk 3 gün köfte siparişte hep altta görünür, sonra sıra karışık (teslimde sıra önemsiz).
- Köfte pişme süresi 4 sn, "Hızlı ızgara" her düzeyde −0,5 sn (en hızlı 2 sn). Köfte stoğu en çok 6.

## Geliştirmeler

| Geliştirme | Etki | 1. düzey | 2. | 3. | 4. |
|---|---|---|---|---|---|
| Hızlı ızgara (`cook`) | köfte 0,5 sn daha çabuk | 300 | 450 | 700 | 950 |
| Sabırlı müşteri (`pat`) | sabır +%10 | 350 | 500 | 750 | 1000 |
| Cömert bahşiş (`tip`) | bahşiş +%25 | 350 | 550 | 800 | 1100 |
| Geniş ızgara (`slot`) | 3. ızgara gözü | 800 | | | |

## Denge botu

`node scripts/denge.mjs [oyun sayısı] [md]`. Her beceri düzeyi 400 kez 1–15. günleri baştan oynar. Gün kaybedilirse aynı gün yeniden oynanır (en çok 5 deneme); gün sonunda kasa kalır (eksiye düşmüşse 0), alınabilen en ucuz geliştirme alınır (günde en çok bir). Tablolardaki sayılar ilk denemenin ortalamasıdır.

Oyuncu modeli:
- Malzeme koymak = kutuya dokun + tabağa dokun (2 dokunuş); seçili malzemeyi yeniden koymak 1 dokunuş. Izgaraya köfte 1 dokunuş. Her dokunuşun süresi rastgele 0,8–1,25 kat oynar.
- Yeni müşterinin siparişine bakmak "okuma" süresi; teslim ve çöp birer sürükleme.
- İki tabakta en acil iki müşterinin burgeri birlikte yapılır; köfte stokta yoksa öbür malzemeler önce konur, köfte beklenir.
- Izgarada bekleyen siparişlerin köftesi kadar pişirilir (orta oyuncu 1, hızlı oyuncu 2 fazla).
- Hata: bir malzeme yerine yanlışı konur. Oyuncu burger bitince bunu fark ederse (yavaş %60, orta %70, hızlı %85) çöpe atar ve yeniden yapar, etmezse yanlış teslim eder.
- Kızgın müşteriye de burger verilir (can gitmesin diye).
- Gün, 3 can (kaçan + yanlış) gitmeden bitince kazanılır.

| Düzey | Dokunuş | Sipariş okuma | Sürükleme | Malzeme başına hata |
|---|---|---|---|---|
| Yavaş | 0,85 sn | 1,6 sn | 1,4 sn | %4 |
| Orta | 0,6 sn | 0,9 sn | 1,0 sn | %3 |
| Hızlı | 0,4 sn | 0,5 sn | 0,7 sn | %1,5 |

## Sonuçlar

Özet:
- **Orta oyuncu** her günü kazanıyor (ilk denemede %91–100; ikinci denemede hepsi). Mutlu teslim oranı 15 günde ortalama ~%50 (ilk gün %85; 4–6. günlerde, sabır geliştirmesi alınmadan önce %16–37'ye iner, geliştirmelerle %45–60'a döner). Kâr 92'den 330'a çıkıyor. 15 günde 6,5 geliştirme: **2,3 günde bir**.
- **Yavaş oyuncu** ilk 4 günü %90+ ilk denemede, 5. günü %80 kazanıyor (yeniden denemeyle hepsi). Hiç mutlu teslim yapamıyor; 8. günden sonra zorlanıyor, 11. günden sonra ilk denemede çoğunlukla kaybediyor ve zarar ediyor. Bu düzeydeki oyuncu ancak hızlanarak ya da sabır geliştirmesiyle ilerler.
- **Hızlı oyuncu** her günü kazanıyor, teslimlerin %95'i mutlu; kâr 96'dan 600'e çıkıyor, 1,7 günde bir geliştirme alıyor.
- Kızgın teslim kârı doğrudan düşürür: yavaş oyuncunun 9. günden sonraki zararının ana nedeni kızgın teslimler.
