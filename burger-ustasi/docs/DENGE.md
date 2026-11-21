# Burger Ustası: ekonomi ve denge (10. tur: malzeme bedava, saatli gün, 21 Kasım)

Değerler `www/js/veri.js` içinde (`BU.VERI`; `MUTFAK`, `SIPARIS0`, `gun6`, `gunSure`, `yildiz`, `koyKarar`; ince ayarlar `AYAR`; dükkânda satılanlar `SATILIK`). Tablolar denge botunun çıktısı:

- `node scripts/denge.mjs 300 md`: 1–15. günler (her düzeyde 300 oyun).
- `node scripts/denge.mjs saat 16 md`: uzun oyun, dükkândaki her şey alınana kadar.
- `SAAT_MAX=80 node scripts/denge.mjs plan 8 md`: uzun oyun + **öneri** (sonraki malzemeler mutfağa yer açılıp satılsaydı); "24 saatte son ürüne ulaşılamaz" kuralı.
- `node scripts/denge.mjs tavan 150 md`: zorluk tavanı.

Değer değiştirince botu yeniden çalıştır ve tabloları güncelle. Deneme: `DENGE_AYAR='{"sabir10":60}' node scripts/denge.mjs 100`.

## 10. tur: Eymen'in 21 Kasım kararları (docs/SHAWARMA_INCELEME.md)

- **Malzemeler bedava (S5).** Ekmek, köfte, peynir, turşu, patates para tutmaz (`AYAR.bedava`; `maliyet()` ve `katmanMaliyet()` 0 döner, eski `maliyet` değerleri MALZEME'de yalnız tarih için). Para yalnız **kira** ve **dükkân** için harcanır. Dokunuşta "−N" yazısı yok, gün sonu kartında "Gider" satırı yok.
- **Menü fiyatı düştü:** satış toplamı × `AYAR.fiyatKat` (0,65), 5'e yuvarlı: turşulu peynirli burger + patates **30** (eskiden 45). Bahşiş aynı formül (fiyatın %8–30'u, "Cömert bahşiş" +%25/düzey, seri payı +1…+5): tam sabırda 9.
- **Geç teslim (Y1):** sabır ≤ 1/3'te doğru teslim **fiyatı öder**, yalnız bahşiş yok (seri sıfırlanır). Yanlış teslim: ödemez, seri sıfırlanır (zarar yok, malzeme bedava).
- **Hazırdı (P8):** tepsi müşteri gelmeden tamdı ve müşteri geldikten sonraki 8 sn içinde verildi → mutlu teslimde **+1 bahşiş** (`AYAR.hazirBahsis`).
- **Gün saatle biter (P3):** `gunSure(d)`: 1. gün 90 sn, 10. gün 150 sn (her gün ~+6,7), sonra günde +2,5, 5'e yuvarlı, en çok 240 sn. Saat bitince yeni müşteri gelmez; içerdekiler gidince gün biter.
- **Tezgâhta hep 3 müşteri (P1):** günün ilk üçü 0., 2., 5. saniyede; boşalan yere 3–5 sn sonra yenisi (`AYAR.aralik10`). Rehberde (ilk oyun) önce tek müşteri, saat rehber bitince başlar.
- **Sabır (P2, P11):** `max(45, 55 − 0,6 × (zg − 1))` sn × (1 + %10 × "Sabırlı müşteri"); 1. gün ×1,6 (88 sn, "ilk gün herkes sabırlı"). 2. gün 54, 10. gün 50, 26. günden sonra 45 sn.
- **Zorluk günü (Y2):** `zg(d) = d` (d ≤ 10), sonra `10 + (d − 10)/2`; tavan yine 18 (26. günde ulaşılır). Siparişler aynı olduğu için zg yalnız sabrı etkiler.
- **Kira ×2:** `20 + 20 × ⌊√(gün − 1)⌋`, 5'e yuvarlı, en çok 240 (malzeme gideri kalktı; kira tek sabit gider).
- **Dükkân fiyatları** (üst düzeyler pahalandı): 3. ızgara 250, 4. ızgara 1.800; Sabırlı müşteri 350 / 750 / 1.600 / 3.400; Cömert bahşiş 400 / 900 / 1.900 / 4.000.
- **Yıldız (P9):** mutlu teslim / gelen müşteri: ≥ %80 → 3, ≥ %50 → 2, yoksa 1 (`yildiz()`).
- **Para tezgâha düşer (S4):** ödeme hesaba hemen yazılır (`S.kasa`), ama ekrandaki kasa yalnız toplanınca artar; toplanmayan para gün sonunda kendiliğinden kasaya girer. Ekonomiyi değiştirmez.

| Gün | Süre | Sabır (geliştirmesiz) | Kira |
|---|---|---|---|
| 1 | 1:30 | 88 sn (ilk gün ×1,6) | 20 |
| 2 | 1:35 | 54 sn | 40 |
| 5 | 1:55 | 53 sn | 60 |
| 10 | 2:30 | 50 sn | 80 |
| 15 | 2:45 | 48 sn | 80 |
| 20 | 2:55 | 47 sn | 100 |
| 26 | 3:10 | 45 sn | 120 |
| 40 | 3:45 | 45 sn | 140 |

### Özet
- **Yavaş oyuncu artık batmıyor:** her gün kârlı (%100), 80 saatte **0 kapanış** (9. turda ~456). Dükkândaki her şeyi ~2,5 saatte (43. gün) alıyor. Ama bahşişi azalıyor (mutlu oranı %6–10): tezgâh hep dolu olduğu için müşteri ~25–30 sn bekliyor.
- **Orta oyuncu** her şeyi ~1,5 saatte (30. gün), **hızlı oyuncu** ~47 dakikada (18. gün) alıyor (9. turda 1,0 sa ve 54 dk).
- **24 saat kuralı sağlanıyor (öneri planıyla):** hızlı oyuncu son ürüne (Altın Wagyu, 400.000) ortanca **37,1 saatte** ulaşıyor (en erken 37,0); orta ve yavaş oyuncu 80 saatte ulaşamıyor.
- **Mutlu oranı:** hızlı oyuncu %90+; orta oyuncu geliştirmesiz %15–40, tam geliştirmeyle %50–80 (plan hedefi %50–70 yalnız geliştirmeyle tutuyor; bkz. SHAWARMA_INCELEME.md → "Kalan sorular").

## Dükkân

| Ürün | Mutfakta | Etki | Fiyatlar |
|---|---|---|---|
| **Izgara kilidi** (`slot`, sırayla) | resimdeki kilitli 3. ve 4. ızgara | aynı anda bir köfte daha | 250, 1.800 |
| Sabırlı müşteri (`pat`) | ön tezgâhta **radyo** (düzey ışıkları) | sabır +%10 | 350, 750, 1.600, 3.400 |
| Cömert bahşiş (`tip`) | ön tezgâhta **bahşiş kavanozu** (düzeyle dolar) | bahşiş +%25 | 400, 900, 1.900, 4.000 |
| ~~Hızlı ızgara~~ (`cook`) | — | 9. turda kalktı, alınmışsa parası iade | |

### Ne kadar sürede ne açılır (ortanca, gerçek saat ve oyundaki gün)

| Ürün | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| Izgara kilidi 3. ızgara | 250 | 4 dk, gün 2 | 2 dk, gün 1 | 2 dk, gün 1 |
| Sabırlı müşteri 1. düzey | 350 | 7 dk, gün 3 | 4 dk, gün 2 | 4 dk, gün 2 |
| Cömert bahşiş 1. düzey | 400 | 12 dk, gün 5 | 6 dk, gün 3 | 4 dk, gün 2 |
| Sabırlı müşteri 2. düzey | 750 | 17 dk, gün 7 | 11 dk, gün 5 | 6 dk, gün 3 |
| Cömert bahşiş 2. düzey | 900 | 26 dk, gün 10 | 16 dk, gün 7 | 10 dk, gün 5 |
| Sabırlı müşteri 3. düzey | 1.600 | 42 dk, gün 15 | 28 dk, gün 11 | 15 dk, gün 7 |
| Izgara kilidi 4. ızgara | 1.800 | 59 dk, gün 20 | 37 dk, gün 14 | 20 dk, gün 9 |
| Cömert bahşiş 3. düzey | 1.900 | 1.3 sa, gün 25 | 50 dk, gün 18 | 26 dk, gün 11 |
| Sabırlı müşteri 4. düzey | 3.400 | 1.9 sa, gün 34 | 1.1 sa, gün 23 | 35 dk, gün 14 |
| Cömert bahşiş 4. düzey | 4.000 | 2.5 sa, gün 43 | 1.5 sa, gün 30 | 47 dk, gün 18 |

- Yavaş: ortalama 2.5 saatte 43 gün; kapanış 0.0. Son ürüne en erken 2.5 sa (16/16 oyuncu).
  - 1. sa: gün 22, 6515/sa
  - 2. sa: gün 38, 6198/sa

- Orta: ortalama 1.5 saatte 30 gün; kapanış 0.0. Son ürüne en erken 1.5 sa (16/16 oyuncu).
  - 1. sa: gün 22, 10353/sa

- Hızlı: ortalama 0.8 saatte 18 gün; kapanış 0.0. Son ürüne en erken 0.7 sa (16/16 oyuncu).

### Öneri: sonraki malzemeler (satılmıyor; `VERI.GELECEK`, fiyatlar aynı)

| Ürün | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| (öneri) Marul | 2.000 | 1.6 sa, gün 30 | 1.0 sa, gün 21 | 32 dk, gün 13 |
| (öneri) Domates | 4.000 | 2.7 sa, gün 45 | 1.7 sa, gün 32 | 51 dk, gün 19 |
| (öneri) Soğan | 7.000 | 4.3 sa, gün 66 | 2.7 sa, gün 46 | 1.3 sa, gün 27 |
| (öneri) Pastırma | 12.000 | 6.1 sa, gün 89 | 3.7 sa, gün 60 | 1.7 sa, gün 34 |
| (öneri) Yumurta | 20.000 | 9.4 sa, gün 132 | 5.6 sa, gün 85 | 2.6 sa, gün 46 |
| (öneri) Ketçap | 32.000 | 14.7 sa, gün 201 | 8.6 sa, gün 125 | 3.8 sa, gün 63 |
| (öneri) Mayonez | 50.000 | 22.9 sa, gün 306 | 13.3 sa, gün 189 | 5.8 sa, gün 91 |
| (öneri) Mantar | 80.000 | 35.7 sa, gün 472 | 20.8 sa, gün 289 | 9.0 sa, gün 135 |
| (öneri) Jalapeño | 130.000 | 55.7 sa, gün 730 | 32.5 sa, gün 446 | 14.1 sa, gün 205 |
| (öneri) Avokado | 220.000 | > 80 sa | 51.9 sa, gün 706 | 22.6 sa, gün 321 |
| (öneri) Altın Wagyu | 400.000 | > 80 sa | > 80 sa | 37.1 sa, gün 522 |
- Yavaş: ortalama 80.0 saatte 1045 gün; kapanış 0.0. Son ürüne 80 saatte ulaşan yok.
  - 1. sa: gün 22, 6498/sa
  - 2. sa: gün 38, 6502/sa
  - 5. sa: gün 78, 6752/sa
  - 10. sa: gün 144, 5940/sa
  - 20. sa: gün 274, 6048/sa
  - 30. sa: gün 405, 6324/sa
  - 41. sa: gün 536, 6545/sa
- Orta: ortalama 80.0 saatte 1083 gün; kapanış 0.0. Son ürüne 80 saatte ulaşan yok.
  - 1. sa: gün 23, 10394/sa
  - 2. sa: gün 39, 11210/sa
  - 5. sa: gün 81, 10991/sa
  - 10. sa: gün 151, 10484/sa
  - 21. sa: gün 291, 10698/sa
  - 31. sa: gün 431, 11144/sa
  - 42. sa: gün 571, 11293/sa
- Hızlı: ortalama 37.1 saatte 521 gün; kapanış 0.0. Son ürüne en erken 37.0 sa (8/8 oyuncu).
  - 1. sa: gün 23, 22161/sa
  - 2. sa: gün 40, 25191/sa
  - 5. sa: gün 82, 25274/sa
  - 10. sa: gün 152, 25382/sa
  - 20. sa: gün 292, 25920/sa
  - 31. sa: gün 432, 27828/sa

## Zorluk tavanı

**Yavaş oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 8% / 326 | 100% / 6% / 401 | 100% / 6% / 438 | 100% / 6% / 451 | 100% / 5% / 556 | 100% / 5% / 595 |
| 4 ızgara, başka geliştirme yok | 100% / 8% / 325 | 100% / 7% / 403 | 100% / 6% / 438 | 100% / 6% / 451 | 100% / 5% / 555 | 100% / 4% / 588 |
| tam geliştirme | 100% / 17% / 341 | 100% / 13% / 411 | 100% / 11% / 450 | 100% / 11% / 465 | 100% / 7% / 580 | 100% / 6% / 622 |

**Orta oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 13% / 433 | 100% / 10% / 552 | 100% / 9% / 604 | 100% / 9% / 625 | 100% / 7% / 797 | 100% / 6% / 856 |
| 4 ızgara, başka geliştirme yok | 100% / 13% / 436 | 100% / 10% / 551 | 100% / 9% / 604 | 100% / 9% / 625 | 100% / 7% / 797 | 100% / 6% / 853 |
| tam geliştirme | 100% / 81% / 527 | 100% / 64% / 628 | 100% / 54% / 675 | 100% / 50% / 694 | 100% / 39% / 861 | 100% / 37% / 912 |

**Hızlı oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 79% / 721 | 100% / 60% / 867 | 100% / 55% / 957 | 100% / 53% / 974 | 100% / 52% / 1232 | 100% / 52% / 1347 |
| 4 ızgara, başka geliştirme yok | 100% / 81% / 724 | 100% / 65% / 865 | 100% / 57% / 957 | 100% / 54% / 975 | 100% / 53% / 1237 | 100% / 51% / 1343 |
| tam geliştirme | 100% / 98% / 941 | 100% / 98% / 1156 | 100% / 97% / 1274 | 100% / 97% / 1305 | 100% / 97% / 1644 | 100% / 97% / 1795 |

## Denge botu (oyuncu modeli)

- Tek parmak; her dokunuş B.tap sn (0,8–1,25 kat oynar), doğrama dokunuşu B.dogra sn. Tepsiyi müşteriye vermek, burgeri ya da patatesi tepsiye koymak 2 dokunuş; malzeme 1 dokunuş.
- Öncelik: dolu tepsiyi en acil müşteriye ver > fritözü boşalt > ızgarayı doldur (hazne + pişen < 6) > biten burgeri tepsiye > tepsiye patates > haznede ≤ 1 patates kalınca doğra > burgere sıradaki malzeme. Orta ve hızlı oyuncu sıradaki müşteri için bir burger önceden yapar.
- Hata: burger erken kapanır (üst ekmek); çöp olmadığı için fark edilmez, yanlış teslim edilir (ödeme yok, seri sıfırlanır).
- Gerçek süre = günün süresi + 10 sn (kartlar, dükkân). Can yok: her gün biter, bir sonrakine geçilir. Dükkânda yalnız `SATILIK`.

| Düzey | Dokunuş | Doğrama dokunuşu | Sipariş okuma | Burger başına hata |
|---|---|---|---|---|
| Yavaş | 0,85 sn | 0,30 sn | 1,6 sn | %4 |
| Orta | 0,6 sn | 0,22 sn | 0,9 sn | %3 |
| Hızlı | 0,4 sn | 0,16 sn | 0,5 sn | %1,5 |


Oyuncu modeli 10. turda: müşteriler yer yer gelir (ilk üçü 0, 2, 5 sn; boşalan yere 3–5 sn), saat bitince gelmez; maliyet 0. "Yıldız" sütunu = `yildiz(mutlu, gelen)` ortalaması.

## 1–15. günler (yeni oyuncu, 50 parayla)

Sayılar ortalama. Kârlı gün = net kâr ≥ kira. Kasa = gün sonu kira ve dükkândan sonra kalan.

### Yavaş oyuncu (dokunuş 0.85 sn, doğrama 0.3 sn, hata %4)

| Gün | Müşteri | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Yıldız | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 9.9 | 100% | 121 | 276 | 11 | 1.0 | 287 | 20 | 2.4 | 6.8 | 0.0 | 0.0 | 0.7 | 24% | 2.4 | 0.0 | 214 |
| 2 | 10.0 | 100% | 122 | 282 | 5 | 1.0 | 287 | 40 | 1.0 | 8.2 | 0.3 | 0.0 | 0.6 | 10% | 3.0 | 0.0 | 314 |
| 3 | 10.9 | 100% | 132 | 304 | 5 | 1.0 | 309 | 40 | 0.9 | 8.9 | 0.3 | 0.0 | 0.8 | 9% | 3.0 | 1.0 | 233 |
| 4 | 11.0 | 100% | 133 | 308 | 5 | 1.0 | 312 | 40 | 1.0 | 9.3 | 0.0 | 0.0 | 0.8 | 9% | 3.0 | 1.4 | 341 |
| 5 | 11.5 | 100% | 139 | 324 | 5 | 1.0 | 329 | 60 | 0.9 | 9.8 | 0.0 | 0.0 | 0.7 | 8% | 3.0 | 2.0 | 374 |
| 6 | 12.4 | 100% | 150 | 343 | 6 | 1.0 | 348 | 60 | 0.9 | 10.5 | 0.0 | 0.0 | 1.0 | 8% | 3.0 | 2.0 | 662 |
| 7 | 13.0 | 100% | 160 | 360 | 6 | 1.0 | 365 | 60 | 0.9 | 11.0 | 0.0 | 0.0 | 1.0 | 7% | 3.0 | 2.9 | 282 |
| 8 | 13.2 | 100% | 162 | 367 | 7 | 1.0 | 374 | 60 | 1.1 | 11.1 | 0.0 | 0.0 | 0.9 | 8% | 3.0 | 3.0 | 531 |
| 9 | 14.0 | 100% | 172 | 393 | 6 | 1.0 | 400 | 60 | 1.0 | 12.1 | 0.0 | 0.0 | 0.9 | 7% | 3.0 | 3.0 | 871 |
| 10 | 14.2 | 100% | 174 | 399 | 6 | 1.0 | 406 | 80 | 1.0 | 12.3 | 0.0 | 0.0 | 0.9 | 7% | 3.0 | 3.9 | 345 |
| 11 | 14.9 | 100% | 182 | 415 | 7 | 1.0 | 422 | 80 | 0.9 | 12.9 | 0.0 | 0.0 | 1.1 | 6% | 3.0 | 4.0 | 639 |
| 12 | 14.9 | 100% | 182 | 413 | 7 | 1.0 | 421 | 80 | 1.0 | 12.8 | 0.0 | 0.0 | 1.2 | 7% | 3.0 | 4.0 | 980 |
| 13 | 15.1 | 100% | 184 | 419 | 7 | 1.0 | 426 | 80 | 1.0 | 13.0 | 0.0 | 0.0 | 1.1 | 6% | 3.0 | 4.0 | 1325 |
| 14 | 15.1 | 100% | 184 | 422 | 7 | 1.0 | 429 | 80 | 1.0 | 13.1 | 0.0 | 0.0 | 1.0 | 6% | 3.0 | 4.2 | 1354 |
| 15 | 15.7 | 100% | 190 | 435 | 7 | 1.0 | 442 | 80 | 1.0 | 13.5 | 0.0 | 0.0 | 1.2 | 6% | 3.0 | 5.0 | 447 |

### Orta oyuncu (dokunuş 0.6 sn, doğrama 0.22 sn, hata %3)

| Gün | Müşteri | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Yıldız | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 12.6 | 100% | 109 | 355 | 79 | 3.0 | 434 | 20 | 11.8 | 0.0 | 0.0 | 0.0 | 0.7 | 94% | 3.0 | 0.0 | 214 |
| 2 | 13.1 | 100% | 115 | 370 | 10 | 1.0 | 380 | 40 | 2.0 | 10.3 | 0.0 | 0.0 | 0.7 | 15% | 3.0 | 1.0 | 208 |
| 3 | 14.0 | 100% | 121 | 399 | 14 | 1.0 | 413 | 40 | 3.4 | 9.9 | 0.0 | 0.0 | 0.7 | 24% | 3.0 | 2.0 | 194 |
| 4 | 14.8 | 100% | 128 | 420 | 17 | 1.0 | 437 | 40 | 3.5 | 10.5 | 0.0 | 0.0 | 0.8 | 24% | 3.0 | 2.0 | 574 |
| 5 | 15.0 | 100% | 129 | 426 | 16 | 1.0 | 443 | 60 | 3.1 | 11.1 | 0.0 | 0.0 | 0.8 | 21% | 3.0 | 2.9 | 252 |
| 6 | 16.5 | 100% | 143 | 469 | 27 | 1.1 | 497 | 60 | 6.1 | 9.5 | 0.0 | 0.0 | 0.9 | 37% | 3.0 | 3.0 | 643 |
| 7 | 17.1 | 100% | 150 | 485 | 27 | 1.0 | 512 | 60 | 6.0 | 10.2 | 0.0 | 0.0 | 0.9 | 35% | 3.0 | 3.8 | 342 |
| 8 | 17.9 | 100% | 155 | 504 | 29 | 1.0 | 533 | 60 | 5.3 | 11.5 | 0.0 | 0.0 | 1.0 | 30% | 3.0 | 4.0 | 668 |
| 9 | 18.8 | 100% | 162 | 536 | 27 | 1.0 | 563 | 60 | 4.8 | 13.1 | 0.0 | 0.0 | 1.0 | 25% | 3.0 | 4.0 | 1172 |
| 10 | 19.0 | 100% | 164 | 541 | 27 | 1.0 | 568 | 80 | 4.9 | 13.2 | 0.0 | 0.0 | 1.0 | 26% | 3.0 | 4.2 | 1420 |
| 11 | 19.8 | 100% | 170 | 560 | 29 | 1.0 | 589 | 80 | 5.3 | 13.3 | 0.0 | 0.0 | 1.1 | 27% | 3.0 | 5.0 | 569 |
| 12 | 19.7 | 100% | 169 | 560 | 46 | 1.3 | 606 | 80 | 8.8 | 9.8 | 0.0 | 0.0 | 1.1 | 45% | 3.0 | 5.0 | 1094 |
| 13 | 20.5 | 100% | 178 | 581 | 43 | 1.1 | 623 | 80 | 8.2 | 11.1 | 0.0 | 0.0 | 1.2 | 40% | 3.0 | 5.0 | 1638 |
| 14 | 20.5 | 100% | 179 | 585 | 43 | 1.1 | 628 | 80 | 8.3 | 11.2 | 0.0 | 0.0 | 1.0 | 41% | 4.0 | 5.0 | 416 |
| 15 | 21.1 | 100% | 185 | 600 | 42 | 1.1 | 642 | 80 | 8.1 | 11.9 | 0.0 | 0.0 | 1.1 | 38% | 4.0 | 5.0 | 948 |

### Hızlı oyuncu (dokunuş 0.4 sn, doğrama 0.16 sn, hata %1.5)

| Gün | Müşteri | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Yıldız | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 17.0 | 100% | 104 | 492 | 147 | 3.0 | 640 | 20 | 16.4 | 0.0 | 0.0 | 0.0 | 0.6 | 97% | 3.0 | 0.5 | 246 |
| 2 | 18.0 | 100% | 107 | 524 | 100 | 2.9 | 625 | 40 | 16.0 | 1.5 | 0.0 | 0.0 | 0.5 | 89% | 3.0 | 2.0 | 257 |
| 3 | 19.0 | 100% | 111 | 553 | 144 | 3.0 | 697 | 40 | 17.6 | 0.8 | 0.0 | 0.0 | 0.6 | 93% | 3.0 | 2.9 | 259 |
| 4 | 19.5 | 100% | 114 | 572 | 174 | 3.0 | 747 | 40 | 18.9 | 0.2 | 0.0 | 0.0 | 0.5 | 97% | 3.0 | 3.0 | 826 |
| 5 | 21.6 | 100% | 130 | 634 | 195 | 3.0 | 828 | 60 | 20.9 | 0.2 | 0.0 | 0.0 | 0.5 | 97% | 3.0 | 4.0 | 736 |
| 6 | 23.0 | 100% | 134 | 674 | 229 | 3.0 | 902 | 60 | 22.1 | 0.4 | 0.0 | 0.0 | 0.5 | 96% | 3.0 | 4.1 | 1392 |
| 7 | 23.0 | 100% | 134 | 674 | 230 | 3.0 | 904 | 60 | 22.2 | 0.3 | 0.0 | 0.0 | 0.5 | 96% | 3.0 | 5.0 | 823 |
| 8 | 24.2 | 100% | 144 | 704 | 257 | 3.0 | 960 | 60 | 23.5 | 0.0 | 0.0 | 0.0 | 0.7 | 97% | 3.1 | 5.0 | 1591 |
| 9 | 26.4 | 100% | 156 | 768 | 277 | 3.0 | 1045 | 60 | 25.6 | 0.0 | 0.0 | 0.0 | 0.8 | 97% | 4.0 | 5.0 | 908 |
| 10 | 27.0 | 100% | 158 | 789 | 282 | 3.0 | 1071 | 80 | 26.2 | 0.1 | 0.0 | 0.0 | 0.7 | 97% | 4.0 | 5.2 | 1544 |
| 11 | 27.1 | 100% | 158 | 791 | 288 | 3.0 | 1079 | 80 | 26.3 | 0.1 | 0.0 | 0.0 | 0.7 | 97% | 4.0 | 6.0 | 998 |
| 12 | 27.0 | 100% | 158 | 789 | 314 | 3.0 | 1103 | 80 | 26.2 | 0.1 | 0.0 | 0.0 | 0.7 | 97% | 4.0 | 6.0 | 2021 |
| 13 | 28.8 | 100% | 173 | 840 | 331 | 3.0 | 1171 | 80 | 27.8 | 0.2 | 0.0 | 0.0 | 0.8 | 97% | 4.0 | 6.0 | 3078 |
| 14 | 28.8 | 100% | 173 | 842 | 334 | 3.0 | 1176 | 80 | 27.9 | 0.2 | 0.0 | 0.0 | 0.7 | 97% | 4.0 | 7.0 | 819 |
| 15 | 30.0 | 100% | 178 | 877 | 362 | 3.0 | 1239 | 80 | 29.2 | 0.0 | 0.0 | 0.0 | 0.8 | 97% | 4.0 | 7.0 | 1966 |


## Önceki turlardan (tarih; 10. turla çelişirse 10. tur geçerli)

### 9. tur: can kalktı (Eymen, 21 Kasım)

- **Can yok.** Süresi dolan müşteri yalnız gider (yürüyerek çıkar, ceza sesi yok): o müşterinin parası ve seri kaçar, gün sürer. Gün, bütün müşteriler gelip gidince biter; **kaybedilen gün yok**, her gün sonunda bir sonraki güne geçilir.
- **Yanlış teslim** (yanlış ya da eksik kurulmuş burger, aynı parçayı ikinci kez vermek): müşteri **ödemez**, verilenlerin maliyeti zarardır (`−maliyet` yazısı), **seri sıfırlanır**, müşteri gider. Can gitmez.
- **Kira ve eksi kasa** kuralı aynen sürer: her gün sonunda kira düşer, kasa eksiye inebilir, 3 gün art arda eksi kalırsa dükkân kapanır (kasa 50'ye döner, alınanlar kalır). Oyunu "bitiren" tek şey artık budur.
- Yıldız: 3 − kaçan − yanlış (en az 1).
- **Kolaylaştırma** (eskiden "art arda kayıp"ta): müşterilerin üçte biri ya da fazlası kaçtıysa/yanlış aldıysa ertesi gün sabır +%15 (art arda en çok 3 kez, `SAVE.kolay`). Denge botu bunu oynamaz (tablolar kolaylaştırmasız).
- **"Hızlı ızgara" dükkândan kalktı** (Eymen: işi kısaltan yükseltme şimdilik yok). Köfte hep 8 sn, patates hep 15 sn (`izgaraPisme`, `fritozPisme` `up.cook`'u yok sayar). Eski kayıtta alınmış düzeylerin parası ilk açılışta **bir kez kasaya iade** edilir (`VERI.cookIade`: 300 + 600 + 1.200 + 2.400; `up.cook` 0 yapılır), ana menüde kısa bir not çıkar.
- Botta "kazanma oranı" yerine **"kârlı gün"** (net kâr ≥ kira) sütunu var.

### Önceki ekonomiden kalanlar

Kasa, kira (`kira(gun)`), eksi kasa ve 3 gün eksi kalınca kapanış (`gunSonu`, kasa 50'ye döner, alınanlar kalır), yeni oyuncuya 50 para, eksi kasayla alışveriş yok (`alabilir`), sabır eşikleri, ödeme kuralları (bahşişli: fiyat + bahşiş; sabır ortada: fiyat; sabır ≤ 1/3: ödemez; yanlış: ödemez), parça parça teslim (`teslimParca`: ilk doğru parçada sabır %15 dolar), bahşiş formülü, zorluğun 18. günde durması. Can kuralları 9. turda kalktı (yukarıda). Ruh hâli artık yalnız ödemeyi belirler; ekranda yüz ifadesi yok (müşteriler tek hâlli).

Kira = 10 + 10 × ⌊√(gün − 1)⌋, 5'e yuvarlı, en çok 120:

| Gün | 1 | 2–4 | 5–9 | 10–16 | 17–25 | 26–36 | 37–49 | 50–64 | 65–81 | 82–100 | 101–121 | 122+ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Kira | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 |

| f (kalan sabır) | Ruh (yalnız ödeme) | Doğru siparişte | Yanlış parçada |
|---|---|---|---|
| f > 2/3 | mutlu | fiyat + bahşiş, seri +1 | ödemez, −maliyet, seri 0 |
| 2/3 ≥ f > 1/3 | somurtkan | yalnız fiyat, seri 0 | ödemez, −maliyet, seri 0 |
| f ≤ 1/3 | kızgın | ödemez, −maliyet, seri 0 | ödemez, −maliyet, seri 0 |
| f = 0 | gider | para ve seri kaçar (can yok) | |

### 6. tur: yeni mutfak

- **Başta açık:** ekmek, köfte, **peynir, turşu, patates kızartması** (`MUTFAKTA`). Bunların hepsi resimde var; resimde yeri olmayan eski malzemeler (marul, domates, soğan, pastırma, yumurta, ketçap, mayonez, mantar, jalapeño, avokado, soğan halkası, Altın Wagyu) **siparişe girmez ve satılmaz**. Eski kayıtta alınmışlarsa `mal` alanında durur, kaybolmaz.
- **Sipariş:** herkes aynı: turşulu peynirli burger + patates (`SIPARIS0`). Fiyat 5 + 14 + 6 + 7 + 15 = 47 → **45**; maliyet 2 + 6 + 3 + 1 + 2 = **14**. Mutlu teslimde bahşiş 4–14.
- **Maliyet ne zaman düşer:** alt ekmek 2, peynir 3, turşu 1 burgere konunca; köfte 6 ızgaraya konunca; patates 8 (4 porsiyon × 2) doğranıp fritöze girince. Üst ekmek bedava. Hazneden köfte/patates almak para tutmaz (önceden ödendi).
- **Gün başında hazneler dolu** (6 köfte, 4 patates; `MUTFAK.hazir`), para düşmez: ilk görüntü resmin kendisi. Bu, gün başına ~44 paralık hediye; denge tablolarında hesaba katıldı.
- **Izgara:** köfte 8 sn (`izgaraPisme`), hazne 6. **Fritöz:** 15 sn (`fritozPisme`), hazne 4, doğrama 10 dokunuş; fritöz doluyken doğrama yok. Fritözdeki 4 porsiyondan hazneye sığmayan sepette bekler.
- **Zorluk** (`gun6`, `AYAR.aralik6`, `AYAR.sabir6`): müşteri sayısı 5 + gün (en çok 20), ilk 2 gün aynı anda 2, sonra 3 müşteri (eskisi gibi). Gelme aralığının ortası 15 − 0,38 × (zorluk günü − 1) sn (en az 6; aralık %75–125). Sabır = taban (16 sn, günde −0,35, en az 10) + 12 sn, "Sabırlı müşteri" ile +%10/düzey: 1. gün 28 sn, 18. günden sonra 22 sn.

| Gün | Müşteri | Aynı anda | Gelme aralığı (sn) | Sabır (sn, geliştirmesiz) | Kira |
|---|---|---|---|---|---|
| 1 | 6 | 2 | 11.3–18.8 | 28 | 10 |
| 5 | 10 | 3 | 10.1–16.9 | 27 | 30 |
| 10 | 15 | 3 | 8.7–14.5 | 25 | 40 |
| 15 | 20 | 3 | 7.3–12.1 | 23 | 40 |
| 18+ | 20 | 3 | 6.4–10.7 | 22 | 50… |

