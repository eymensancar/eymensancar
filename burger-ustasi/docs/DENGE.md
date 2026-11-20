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

### Yavaş oyuncu (dokunuş 0.85 sn, sipariş okuma 1.6 sn, sürükleme 1.4 sn, hata %4)

| Gün | Müşteri | Kazanma (ilk deneme) | Gelir | Gider | Net kâr | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Geliştirme (toplam) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 135 | 57 | 78 | 0 | 0.0 | 6.0 | 0.0 | 0.0 | 0.0 | 0% | 0.0 |
| 2 | 7 | 98% | 147 | 79 | 68 | 0 | 0.0 | 6.2 | 0.3 | 0.2 | 0.2 | 0% | 0.0 |
| 3 | 8 | 95% | 173 | 89 | 84 | 0 | 0.0 | 6.9 | 0.3 | 0.4 | 0.2 | 0% | 0.0 |
| 4 | 9 | 90% | 190 | 100 | 90 | 0 | 0.0 | 7.6 | 0.4 | 0.5 | 0.2 | 0% | 0.7 |
| 5 | 10 | 80% | 193 | 111 | 82 | 0 | 0.0 | 7.6 | 0.6 | 0.8 | 0.3 | 0% | 0.9 |
| 6 | 11 | 76% | 220 | 136 | 84 | 0 | 0.0 | 7.6 | 1.2 | 0.9 | 0.3 | 0% | 1.2 |
| 7 | 12 | 68% | 229 | 155 | 74 | 0 | 0.0 | 7.4 | 1.8 | 1.1 | 0.4 | 0% | 1.6 |
| 8 | 13 | 60% | 232 | 175 | 57 | 0 | 0.0 | 6.9 | 2.4 | 1.3 | 0.4 | 0% | 1.9 |
| 9 | 14 | 45% | 194 | 174 | 19 | 0 | 0.0 | 5.8 | 3.1 | 1.7 | 0.4 | 0% | 2.1 |
| 10 | 15 | 43% | 206 | 188 | 18 | 0 | 0.0 | 6.0 | 3.5 | 1.7 | 0.4 | 0% | 2.3 |
| 11 | 16 | 20% | 142 | 180 | -38 | 0 | 0.0 | 4.0 | 3.8 | 2.2 | 0.4 | 0% | 2.4 |
| 12 | 17 | 8% | 111 | 166 | -55 | 0 | 0.0 | 3.1 | 3.7 | 2.5 | 0.4 | 0% | 2.4 |
| 13 | 18 | 4% | 88 | 152 | -64 | 0 | 0.0 | 2.5 | 3.4 | 2.6 | 0.4 | 0% | 2.4 |
| 14 | 19 | 1% | 72 | 143 | -70 | 0 | 0.0 | 2.0 | 3.3 | 2.7 | 0.3 | 0% | 2.4 |
| 15 | 20 | 0% | 58 | 126 | -68 | 0 | 0.0 | 1.6 | 2.7 | 2.8 | 0.2 | 0% | 2.4 |

15 günde ortalama 2.4 geliştirme alındı (6.4 günde bir).

### Orta oyuncu (dokunuş 0.6 sn, sipariş okuma 0.9 sn, sürükleme 1 sn, hata %3)

| Gün | Müşteri | Kazanma (ilk deneme) | Gelir | Gider | Net kâr | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Geliştirme (toplam) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 149 | 57 | 92 | 15 | 5.1 | 0.9 | 0.0 | 0.0 | 0.0 | 85% | 0.0 |
| 2 | 7 | 100% | 174 | 80 | 95 | 12 | 4.8 | 2.0 | 0.1 | 0.0 | 0.1 | 69% | 0.0 |
| 3 | 8 | 100% | 203 | 91 | 112 | 10 | 4.3 | 3.5 | 0.2 | 0.0 | 0.1 | 53% | 0.6 |
| 4 | 9 | 100% | 224 | 102 | 122 | 7 | 3.3 | 5.3 | 0.2 | 0.0 | 0.1 | 37% | 1.0 |
| 5 | 10 | 100% | 247 | 120 | 127 | 7 | 3.0 | 6.3 | 0.4 | 0.0 | 0.2 | 30% | 1.0 |
| 6 | 11 | 100% | 303 | 149 | 153 | 4 | 1.7 | 8.5 | 0.5 | 0.1 | 0.2 | 16% | 1.8 |
| 7 | 12 | 100% | 370 | 174 | 196 | 20 | 6.1 | 5.1 | 0.5 | 0.1 | 0.2 | 51% | 2.1 |
| 8 | 13 | 100% | 435 | 206 | 229 | 28 | 7.9 | 4.2 | 0.6 | 0.0 | 0.3 | 61% | 2.9 |
| 9 | 14 | 99% | 454 | 218 | 236 | 23 | 6.5 | 6.5 | 0.7 | 0.0 | 0.3 | 46% | 3.2 |
| 10 | 15 | 99% | 498 | 243 | 255 | 27 | 6.6 | 7.1 | 0.8 | 0.1 | 0.3 | 44% | 3.9 |
| 11 | 16 | 97% | 522 | 271 | 251 | 24 | 5.9 | 8.0 | 1.3 | 0.2 | 0.5 | 38% | 4.4 |
| 12 | 17 | 94% | 560 | 285 | 275 | 37 | 6.9 | 7.8 | 1.3 | 0.2 | 0.5 | 42% | 4.9 |
| 13 | 18 | 95% | 622 | 301 | 321 | 59 | 10.6 | 5.1 | 1.2 | 0.2 | 0.5 | 61% | 5.5 |
| 14 | 19 | 94% | 651 | 318 | 333 | 62 | 11.0 | 5.5 | 1.4 | 0.2 | 0.6 | 59% | 6.0 |
| 15 | 20 | 91% | 643 | 330 | 312 | 52 | 9.4 | 7.1 | 1.9 | 0.3 | 0.6 | 49% | 6.5 |

15 günde ortalama 6.5 geliştirme alındı (2.3 günde bir).

### Hızlı oyuncu (dokunuş 0.4 sn, sipariş okuma 0.5 sn, sürükleme 0.7 sn, hata %1.5)

| Gün | Müşteri | Kazanma (ilk deneme) | Gelir | Gider | Net kâr | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Geliştirme (toplam) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 159 | 63 | 96 | 24 | 5.6 | 0.4 | 0.0 | 0.0 | 0.0 | 93% | 0.0 |
| 2 | 7 | 100% | 199 | 85 | 114 | 34 | 6.8 | 0.1 | 0.0 | 0.0 | 0.0 | 97% | 0.0 |
| 3 | 8 | 100% | 242 | 95 | 147 | 43 | 7.8 | 0.2 | 0.0 | 0.0 | 0.0 | 98% | 1.0 |
| 4 | 9 | 100% | 276 | 106 | 169 | 52 | 8.8 | 0.2 | 0.0 | 0.0 | 0.0 | 98% | 1.0 |
| 5 | 10 | 100% | 314 | 124 | 190 | 59 | 9.7 | 0.2 | 0.0 | 0.0 | 0.1 | 97% | 2.0 |
| 6 | 11 | 100% | 398 | 153 | 245 | 75 | 10.7 | 0.3 | 0.0 | 0.0 | 0.0 | 97% | 2.2 |
| 7 | 12 | 100% | 465 | 177 | 288 | 89 | 11.6 | 0.3 | 0.0 | 0.0 | 0.1 | 97% | 3.0 |
| 8 | 13 | 100% | 551 | 205 | 347 | 117 | 12.6 | 0.4 | 0.0 | 0.0 | 0.1 | 97% | 4.0 |
| 9 | 14 | 100% | 588 | 218 | 370 | 125 | 13.5 | 0.4 | 0.0 | 0.0 | 0.1 | 96% | 4.6 |
| 10 | 15 | 100% | 652 | 244 | 408 | 138 | 14.3 | 0.6 | 0.0 | 0.0 | 0.1 | 95% | 5.1 |
| 11 | 16 | 100% | 725 | 270 | 456 | 155 | 15.3 | 0.6 | 0.0 | 0.0 | 0.1 | 95% | 6.0 |
| 12 | 17 | 100% | 792 | 288 | 504 | 187 | 16.1 | 0.7 | 0.0 | 0.0 | 0.1 | 95% | 6.9 |
| 13 | 18 | 100% | 836 | 303 | 533 | 197 | 17.1 | 0.8 | 0.0 | 0.0 | 0.1 | 95% | 7.2 |
| 14 | 19 | 100% | 882 | 320 | 562 | 208 | 18.0 | 0.9 | 0.0 | 0.0 | 0.1 | 95% | 8.0 |
| 15 | 20 | 100% | 939 | 336 | 603 | 229 | 19.0 | 0.9 | 0.0 | 0.0 | 0.1 | 95% | 9.0 |

15 günde ortalama 9.0 geliştirme alındı (1.7 günde bir).
