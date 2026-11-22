# Burger Ustası: ekonomi ve denge (11. tur: müşteri eğrisi, işi kısaltan geliştirmeler, 21 Kasım gece)

Değerler `www/js/veri.js` içinde (`BU.VERI`; `MUTFAK`, `SIPARIS0`, `gun6`, `gunSure`, `yildiz`, `koyKarar`; ince ayarlar `AYAR`; dükkânda satılanlar `SATILIK`). Tablolar denge botunun çıktısı:

- `node scripts/denge.mjs 300 md`: 1–15. günler (her düzeyde 300 oyun).
- `node scripts/denge.mjs saat 16 md`: uzun oyun, dükkândaki her şey alınana kadar.
- `SAAT_MAX=80 node scripts/denge.mjs plan 8 md`: uzun oyun + **öneri** (sonraki malzemeler mutfağa yer açılıp satılsaydı); "24 saatte son ürüne ulaşılamaz" kuralı.
- `node scripts/denge.mjs tavan 150 md`: zorluk tavanı.

Değer değiştirince botu yeniden çalıştır ve tabloları güncelle. Deneme: `DENGE_AYAR='{"sabir10":60}' node scripts/denge.mjs 100`.

## 11. tur: Eymen'in 21 Kasım gece kararları

- **Başlarda tempo kolay: müşteri eğrisi** (`VERI.musteriEgri`, `EGRI`). "Tezgâhta hep 3 müşteri" kalktı. İlk müşteri hemen gelir; tezgâhta n müşteri varken bir sonrakinin gelmesi için aşağıdaki süre geçer, tezgâhtaki sayı her değişince (gelen ya da giden) süre yeniden kurulur. Boş tezgâha yeni müşteri ilk üç gün 2–4 sn, sonra 3–5 sn. Sabır, süre, kira aynı (10. tur).

| Gün | Aynı anda en çok | 2. müşteri (1 müşteri varken, sn) | 3. müşteri (2 müşteri varken, sn) | Beklenen |
|---|---|---|---|---|
| 1 | 2 | 18–26 | – | çoğunlukla 1, arada 2 |
| 2 | 2 | 15–21 | – | çoğunlukla 1, arada 2 |
| 3 | 2 | 12–17 | – | çoğunlukla 1, daha sık 2 |
| 4 | 3 | 12–17 | 45–60 | 3. müşteri ilk kez, seyrek |
| 5 | 3 | 11–15 | 38–50 | |
| 6 | 3 | 10–14 | 32–44 | çoğunlukla 1–2 |
| 7 | 3 | 9–13 | 27–37 | |
| 8 | 3 | 8–11 | 23–31 | |
| 9 | 3 | 7–10 | 19–26 | |
| 10 | 3 | 6–9 | 16–22 | çoğunlukla 2 |
| 11 | 3 | 5–8 | 13–18 | |
| 12 | 3 | 4–7 | 10–14 | |
| 13 | 3 | 4–6 | 7–11 | |
| 14 | 3 | 3–5 | 5–8 | dolmaya başlar |
| 15+ | 3 | 3–5 | 3–5 | tam dolu tezgâh (10. turdaki gibi) |

- **"İşi kısaltan yükseltme yok" kuralı kalktı** (Eymen'in isteği). Yeni geliştirmeler pahalı ("pahalı yap, öyle ucuz olmaz, önemli bir geliştirme o"); dükkânda sıra zorunlu değil (ızgaralar ve düzeyler sırayla).

| Ürün | Mutfakta | Etki | Fiyat |
|---|---|---|---|
| 3. / 4. ızgara | kilitli ızgaralar | aynı anda bir köfte daha | 250 / 1.800 |
| Sabırlı müşteri | radyo | sabır +%10 / düzey | 350 / 750 / 1.600 / 3.400 |
| Cömert bahşiş | bahşiş kavanozu | bahşiş +%25 / düzey | 400 / 900 / 1.900 / 4.000 |
| **Hızlı doğrama** | çiğ patates | 10 → **8** → **6** dokunuş, 3. düzey **otomatik doğrama** (fritöz boşken kendiliğinden) | 600 / 2.500 / 15.000 |
| **Hızlı fritöz** | fritöz | 15 → **12** → **9** sn | 1.200 / 6.000 |
| **Otomatik turşu** | turşu haznesi | turşu dokunmadan burgere konur | 8.000 |
| **Otomatik peynir** | peynir haznesi | peynir kendiliğinden | 12.000 |
| **Otomatik alt ekmek** | alt raf | tahta boşken yeni burger kendiliğinden başlar | 18.000 |
| **Otomatik köfte** | köfte haznesi | köfte kendiliğinden (hazne boşsa bekler) | 26.000 |
| **Otomatik üst ekmek** | üst raf | ortadakiler tamamsa burger kendiliğinden kapanır | 40.000 |

Dükkânın tamamı 144.650 para (10. turda 15.350). Kural "en hızlı oyuncu 24 saatte son ürüne ulaşamaz" korunuyor: dükkân + öneri malzemeleri (`plan`) ile hızlı oyuncu Altın Wagyu'ya en erken **33,6 saatte** ulaşıyor (10. turda 37,0; otomatikler gelirini artırdığı için biraz erken, yine 24 saatin çok üstünde). Yavaş oyuncu batmıyor: hiçbir düzeyde kapanış yok, her gün kârlı.

### Ne zaman ne alınıyor (`node scripts/denge.mjs saat 16 md`; ortanca gerçek saat ve oyundaki gün)

| Ürün | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| Izgara kilidi 3. ızgara | 250 | 4 dk, gün 2 | 2 dk, gün 1 | 2 dk, gün 1 |
| Sabırlı müşteri 1. düzey | 350 | 8 dk, gün 4 | 3 dk, gün 2 | 3 dk, gün 2 |
| Cömert bahşiş 1. düzey | 400 | 10 dk, gün 5 | 5 dk, gün 3 | 5 dk, gün 3 |
| Hızlı doğrama (8 dokunuş) | 600 | 17 dk, gün 8 | 10 dk, gün 5 | 7 dk, gün 4 |
| Sabırlı müşteri 2. düzey | 750 | 23 dk, gün 10 | 12 dk, gün 6 | 10 dk, gün 5 |
| Cömert bahşiş 2. düzey | 900 | 29 dk, gün 12 | 17 dk, gün 8 | 12 dk, gün 6 |
| Hızlı fritöz (12 sn) | 1.200 | 42 dk, gün 16 | 22 dk, gün 10 | 17 dk, gün 8 |
| Sabırlı müşteri 3. düzey | 1.600 | 56 dk, gün 20 | 28 dk, gün 12 | 22 dk, gün 10 |
| Izgara kilidi 4. ızgara | 1.800 | 1.2 sa, gün 25 | 37 dk, gün 15 | 27 dk, gün 12 |
| Cömert bahşiş 3. düzey | 1.900 | 1.6 sa, gün 30 | 50 dk, gün 19 | 33 dk, gün 14 |
| Hızlı doğrama (6 dokunuş) | 2.500 | 2.0 sa, gün 36 | 1.1 sa, gün 23 | 39 dk, gün 16 |
| Sabırlı müşteri 4. düzey | 3.400 | 2.5 sa, gün 43 | 1.4 sa, gün 28 | 48 dk, gün 19 |
| Cömert bahşiş 4. düzey | 4.000 | 3.1 sa, gün 51 | 1.8 sa, gün 34 | 58 dk, gün 22 |
| Hızlı fritöz (9 sn) | 6.000 | 4.1 sa, gün 64 | 2.3 sa, gün 42 | 1.2 sa, gün 26 |
| Otomatik turşu | 8.000 | 5.5 sa, gün 82 | 3.1 sa, gün 53 | 1.5 sa, gün 32 |
| Otomatik peynir | 12.000 | 7.4 sa, gün 107 | 3.9 sa, gün 64 | 2.0 sa, gün 39 |
| Hızlı doğrama (otomatik doğrama) | 15.000 | 9.5 sa, gün 135 | 4.8 sa, gün 76 | 2.5 sa, gün 47 |
| Otomatik alt ekmek | 18.000 | 12.1 sa, gün 170 | 5.9 sa, gün 91 | 3.2 sa, gün 56 |
| Otomatik köfte | 26.000 | 15.1 sa, gün 210 | 7.1 sa, gün 107 | 4.1 sa, gün 69 |
| Otomatik üst ekmek | 40.000 | 18.0 sa, gün 249 | 8.6 sa, gün 129 | 5.6 sa, gün 91 |

- Yavaş: ortalama 18.0 saatte 249 gün; kapanış 0.0. Son ürüne en erken 17.9 sa (16/16 oyuncu).
  - 1. sa: gün 23, 6759/sa
  - 2. sa: gün 39, 6321/sa
  - 5. sa: gün 81, 5862/sa
  - 11. sa: gün 151, 6761/sa

- Orta: ortalama 8.6 saatte 129 gün; kapanış 0.0. Son ürüne en erken 8.5 sa (16/16 oyuncu).
  - 1. sa: gün 23, 12121/sa
  - 2. sa: gün 39, 10646/sa
  - 5. sa: gün 81, 17269/sa

- Hızlı: ortalama 5.6 saatte 91 gün; kapanış 0.0. Son ürüne en erken 5.5 sa (16/16 oyuncu).
  - 1. sa: gün 24, 21657/sa
  - 2. sa: gün 41, 25942/sa
  - 5. sa: gün 86, 26418/sa

### Öneri planıyla 24 saat kuralı (`SAAT_MAX=80 node scripts/denge.mjs plan 8 md`; öneri satırları)

| Ürün | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| (öneri) Marul | 2.000 | 1.8 sa, gün 34 | 1.0 sa, gün 22 | 39 dk, gün 16 |
| (öneri) Domates | 4.000 | 3.3 sa, gün 54 | 1.9 sa, gün 36 | 1.0 sa, gün 23 |
| (öneri) Soğan | 7.000 | 5.8 sa, gün 86 | 3.4 sa, gün 56 | 1.7 sa, gün 34 |
| (öneri) Pastırma | 12.000 | 8.8 sa, gün 124 | 4.9 sa, gün 76 | 2.4 sa, gün 44 |
| (öneri) Yumurta | 20.000 | 17.0 sa, gün 233 | 8.6 sa, gün 127 | 4.3 sa, gün 72 |
| (öneri) Ketçap | 32.000 | 22.5 sa, gün 306 | 11.1 sa, gün 161 | 6.1 sa, gün 97 |
| (öneri) Mayonez | 50.000 | 28.9 sa, gün 392 | 14.3 sa, gün 205 | 9.0 sa, gün 138 |
| (öneri) Mantar | 80.000 | 33.6 sa, gün 455 | 16.8 sa, gün 241 | 11.5 sa, gün 174 |
| (öneri) Jalapeño | 130.000 | 41.0 sa, gün 554 | 20.8 sa, gün 297 | 15.5 sa, gün 232 |
| (öneri) Avokado | 220.000 | 53.4 sa, gün 720 | 27.6 sa, gün 391 | 22.3 sa, gün 329 |
| (öneri) Altın Wagyu | 400.000 | 74.4 sa, gün 1004 | 39.1 sa, gün 552 | 33.8 sa, gün 494 |
- Yavaş: ortalama 74.4 saatte 1004 gün; kapanış 0.0. Son ürüne en erken 74.2 sa (8/8 oyuncu).
  - 1. sa: gün 23, 6748/sa
  - 2. sa: gün 39, 6414/sa
  - 5. sa: gün 79, 6775/sa
  - 10. sa: gün 145, 6795/sa
  - 21. sa: gün 285, 11588/sa
  - 31. sa: gün 425, 17078/sa
  - 42. sa: gün 565, 17821/sa
- Orta: ortalama 39.0 saatte 552 gün; kapanış 0.0. Son ürüne en erken 38.9 sa (8/8 oyuncu).
  - 1. sa: gün 23, 12153/sa
  - 2. sa: gün 39, 11421/sa
  - 5. sa: gün 81, 14121/sa
  - 10. sa: gün 151, 23503/sa
  - 21. sa: gün 294, 32145/sa
  - 31. sa: gün 438, 34885/sa
- Hızlı: ortalama 33.8 saatte 494 gün; kapanış 0.0. Son ürüne en erken 33.6 sa (8/8 oyuncu).
  - 1. sa: gün 24, 21650/sa
  - 2. sa: gün 41, 26923/sa
  - 5. sa: gün 86, 34738/sa
  - 10. sa: gün 161, 31687/sa
  - 21. sa: gün 311, 32745/sa
  - 31. sa: gün 461, 34490/sa

### Zorluk tavanı (`node scripts/denge.mjs tavan 150 md`)

**Yavaş oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 92% / 272 | 100% / 42% / 381 | 100% / 6% / 433 | 100% / 6% / 446 | 100% / 5% / 559 | 100% / 5% / 594 |
| 4 ızgara, başka geliştirme yok | 100% / 92% / 272 | 100% / 42% / 382 | 100% / 6% / 436 | 100% / 6% / 444 | 100% / 5% / 559 | 100% / 4% / 590 |
| ızgara + sabır + bahşiş tam | 100% / 92% / 326 | 100% / 93% / 489 | 100% / 12% / 449 | 100% / 12% / 462 | 100% / 9% / 587 | 100% / 8% / 620 |
| her şey (otomatikler dahil) | 100% / 100% / 703 | 100% / 100% / 936 | 100% / 100% / 1121 | 100% / 100% / 1155 | 100% / 100% / 1477 | 100% / 100% / 1571 |

**Orta oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 95% / 488 | 100% / 94% / 640 | 100% / 15% / 613 | 100% / 14% / 631 | 100% / 11% / 802 | 100% / 10% / 860 |
| 4 ızgara, başka geliştirme yok | 100% / 95% / 485 | 100% / 95% / 646 | 100% / 15% / 614 | 100% / 14% / 630 | 100% / 11% / 800 | 100% / 10% / 855 |
| ızgara + sabır + bahşiş tam | 100% / 95% / 590 | 100% / 95% / 777 | 100% / 58% / 691 | 100% / 55% / 711 | 100% / 43% / 874 | 100% / 41% / 934 |
| her şey (otomatikler dahil) | 100% / 100% / 861 | 100% / 100% / 1135 | 100% / 100% / 1340 | 100% / 100% / 1382 | 100% / 100% / 1787 | 100% / 100% / 1917 |

**Hızlı oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 97% / 616 | 100% / 98% / 860 | 100% / 97% / 1051 | 100% / 96% / 1066 | 100% / 96% / 1411 | 100% / 96% / 1510 |
| 4 ızgara, başka geliştirme yok | 100% / 97% / 613 | 100% / 98% / 862 | 100% / 97% / 1045 | 100% / 97% / 1074 | 100% / 96% / 1427 | 100% / 96% / 1517 |
| ızgara + sabır + bahşiş tam | 100% / 97% / 744 | 100% / 98% / 1042 | 100% / 97% / 1252 | 100% / 98% / 1296 | 100% / 97% / 1705 | 100% / 98% / 1829 |
| her şey (otomatikler dahil) | 100% / 100% / 1006 | 100% / 100% / 1321 | 100% / 100% / 1479 | 100% / 100% / 1523 | 100% / 100% / 2024 | 100% / 100% / 2160 |

### 1–15. günler (`node scripts/denge.mjs 300 md`; "Aynı anda" = saat işlerken tezgâhta 0/1/2/3 müşterinin süre payı)

Not: bot "insan"dan hızlı karar verir (okuma ve dolaşma yok); gerçek yeni oyuncu aynı gün daha çok 2 müşteri görür (aşağıdaki gerçek dokunuşlu ölçüm).

### Yavaş oyuncu (dokunuş 0.85 sn, doğrama 0.3 sn, hata %4)

| Gün | Müşteri | Aynı anda 0/1/2/3 (süre %) | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Yıldız | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6.8 | 20/80/0/0 | 100% | 97 | 188 | 44 | 2.9 | 233 | 20 | 6.3 | 0.0 | 0.0 | 0.0 | 0.6 | 92% | 2.0 | 0.0 | 263 |
| 2 | 7.0 | 19/81/0/0 | 100% | 100 | 195 | 38 | 2.9 | 233 | 40 | 6.5 | 0.0 | 0.0 | 0.0 | 0.5 | 93% | 3.0 | 0.0 | 205 |
| 3 | 7.9 | 20/80/0/0 | 100% | 113 | 222 | 46 | 2.9 | 267 | 40 | 7.4 | 0.0 | 0.0 | 0.0 | 0.5 | 93% | 3.0 | 0.5 | 261 |
| 4 | 7.7 | 25/75/0/0 | 100% | 116 | 216 | 44 | 2.9 | 260 | 40 | 7.2 | 0.0 | 0.0 | 0.0 | 0.5 | 94% | 3.0 | 1.0 | 304 |
| 5 | 8.2 | 21/78/1/0 | 100% | 119 | 228 | 48 | 2.9 | 277 | 60 | 7.6 | 0.0 | 0.0 | 0.0 | 0.5 | 93% | 3.0 | 1.5 | 314 |
| 6 | 9.4 | 15/81/4/0 | 100% | 130 | 261 | 60 | 2.9 | 321 | 60 | 8.7 | 0.0 | 0.0 | 0.0 | 0.7 | 92% | 3.0 | 2.0 | 380 |
| 7 | 10.4 | 9/82/9/0 | 100% | 136 | 286 | 69 | 2.9 | 355 | 60 | 9.5 | 0.0 | 0.0 | 0.0 | 0.8 | 92% | 3.0 | 2.0 | 489 |
| 8 | 11.8 | 1/78/21/0 | 100% | 145 | 329 | 70 | 2.9 | 399 | 60 | 10.7 | 0.3 | 0.0 | 0.0 | 0.8 | 90% | 3.0 | 2.0 | 416 |
| 9 | 12.9 | 1/71/29/0 | 100% | 158 | 361 | 59 | 2.6 | 420 | 60 | 10.8 | 1.3 | 0.0 | 0.0 | 0.9 | 83% | 3.0 | 2.1 | 679 |
| 10 | 13.1 | 0/62/37/0 | 100% | 159 | 361 | 46 | 2.2 | 407 | 80 | 9.5 | 2.5 | 0.0 | 0.0 | 1.0 | 73% | 3.0 | 2.9 | 393 |
| 11 | 13.8 | 0/54/45/0 | 100% | 168 | 386 | 50 | 2.3 | 436 | 80 | 10.3 | 2.5 | 0.0 | 0.0 | 0.9 | 75% | 3.0 | 3.0 | 706 |
| 12 | 13.9 | 0/46/54/0 | 100% | 169 | 385 | 35 | 1.9 | 420 | 80 | 8.5 | 4.4 | 0.0 | 0.0 | 1.1 | 61% | 3.0 | 3.5 | 633 |
| 13 | 14.9 | 0/22/65/13 | 100% | 180 | 413 | 19 | 1.1 | 432 | 80 | 4.2 | 9.6 | 0.0 | 0.0 | 1.1 | 28% | 3.0 | 4.0 | 514 |
| 14 | 15.0 | 0/3/54/43 | 100% | 182 | 417 | 10 | 1.0 | 426 | 80 | 1.6 | 12.3 | 0.0 | 0.0 | 1.2 | 11% | 3.0 | 4.0 | 845 |
| 15 | 15.8 | 0/2/34/64 | 100% | 191 | 440 | 9 | 1.0 | 449 | 80 | 1.5 | 13.1 | 0.0 | 0.0 | 1.1 | 10% | 3.0 | 4.0 | 1015 |

### Orta oyuncu (dokunuş 0.6 sn, doğrama 0.22 sn, hata %3)

| Gün | Müşteri | Aynı anda 0/1/2/3 (süre %) | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Yıldız | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 10.7 | 33/67/0/0 | 100% | 92 | 302 | 97 | 3.0 | 400 | 20 | 10.1 | 0.0 | 0.0 | 0.0 | 0.6 | 95% | 3.0 | 0.0 | 180 |
| 2 | 11.1 | 33/67/0/0 | 100% | 96 | 318 | 95 | 3.0 | 413 | 40 | 10.6 | 0.0 | 0.0 | 0.0 | 0.5 | 95% | 3.0 | 1.0 | 208 |
| 3 | 12.1 | 33/67/0/0 | 100% | 106 | 344 | 105 | 3.0 | 449 | 40 | 11.5 | 0.0 | 0.0 | 0.0 | 0.7 | 94% | 3.0 | 2.0 | 216 |
| 4 | 12.8 | 44/56/0/0 | 100% | 114 | 363 | 138 | 3.0 | 501 | 40 | 12.1 | 0.0 | 0.0 | 0.0 | 0.7 | 95% | 3.0 | 2.0 | 523 |
| 5 | 13.0 | 42/58/0/0 | 100% | 116 | 369 | 141 | 3.0 | 510 | 60 | 12.3 | 0.0 | 0.0 | 0.0 | 0.7 | 95% | 3.0 | 2.0 | 524 |
| 6 | 14.3 | 44/56/0/0 | 100% | 126 | 408 | 158 | 3.0 | 566 | 60 | 13.6 | 0.0 | 0.0 | 0.0 | 0.7 | 95% | 3.0 | 3.0 | 308 |
| 7 | 15.1 | 44/56/0/0 | 100% | 131 | 425 | 167 | 3.0 | 592 | 60 | 14.2 | 0.0 | 0.0 | 0.0 | 0.9 | 94% | 3.0 | 3.0 | 803 |
| 8 | 15.9 | 44/56/0/0 | 100% | 137 | 450 | 178 | 3.0 | 628 | 60 | 15.0 | 0.0 | 0.0 | 0.0 | 0.9 | 95% | 3.0 | 4.0 | 479 |
| 9 | 17.0 | 42/57/0/0 | 100% | 148 | 484 | 222 | 3.0 | 706 | 60 | 16.1 | 0.0 | 0.0 | 0.0 | 0.8 | 95% | 3.0 | 4.0 | 1090 |
| 10 | 17.5 | 36/61/3/0 | 100% | 152 | 497 | 220 | 3.0 | 717 | 80 | 16.6 | 0.0 | 0.0 | 0.0 | 0.9 | 95% | 3.0 | 4.0 | 562 |
| 11 | 18.7 | 10/71/19/0 | 100% | 160 | 529 | 204 | 3.0 | 733 | 80 | 17.6 | 0.0 | 0.0 | 0.0 | 1.1 | 94% | 3.0 | 4.0 | 1215 |
| 12 | 19.0 | 1/64/35/0 | 100% | 162 | 540 | 192 | 3.0 | 732 | 80 | 18.0 | 0.0 | 0.0 | 0.0 | 1.0 | 95% | 3.0 | 4.8 | 651 |
| 13 | 19.7 | 0/59/41/0 | 100% | 168 | 560 | 200 | 3.0 | 760 | 80 | 18.7 | 0.0 | 0.0 | 0.0 | 1.0 | 95% | 3.0 | 5.0 | 947 |
| 14 | 20.2 | 0/28/62/10 | 100% | 172 | 574 | 164 | 3.0 | 738 | 80 | 18.4 | 0.8 | 0.0 | 0.0 | 1.1 | 91% | 3.0 | 5.0 | 1563 |
| 15 | 21.3 | 0/6/47/47 | 100% | 183 | 604 | 47 | 1.1 | 651 | 80 | 7.5 | 12.7 | 0.0 | 0.0 | 1.2 | 35% | 3.9 | 5.0 | 599 |

### Hızlı oyuncu (dokunuş 0.4 sn, doğrama 0.16 sn, hata %1.5)

| Gün | Müşteri | Aynı anda 0/1/2/3 (süre %) | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Yıldız | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 13.0 | 40/60/0/0 | 100% | 93 | 380 | 137 | 3.0 | 516 | 20 | 12.7 | 0.0 | 0.0 | 0.0 | 0.3 | 97% | 3.0 | 0.0 | 296 |
| 2 | 13.3 | 40/60/0/0 | 100% | 95 | 390 | 130 | 3.0 | 520 | 40 | 13.0 | 0.0 | 0.0 | 0.0 | 0.3 | 98% | 3.0 | 1.1 | 369 |
| 3 | 15.3 | 42/58/0/0 | 100% | 106 | 448 | 159 | 3.0 | 607 | 40 | 14.9 | 0.0 | 0.0 | 0.0 | 0.4 | 97% | 3.0 | 2.0 | 539 |
| 4 | 14.8 | 51/49/0/0 | 100% | 110 | 434 | 181 | 3.0 | 615 | 40 | 14.5 | 0.0 | 0.0 | 0.0 | 0.4 | 97% | 3.0 | 2.0 | 569 |
| 5 | 15.8 | 53/47/0/0 | 100% | 116 | 462 | 195 | 3.0 | 656 | 60 | 15.4 | 0.0 | 0.0 | 0.0 | 0.4 | 97% | 3.0 | 3.0 | 420 |
| 6 | 17.0 | 51/49/0/0 | 100% | 128 | 498 | 213 | 3.0 | 711 | 60 | 16.6 | 0.0 | 0.0 | 0.0 | 0.4 | 98% | 3.0 | 3.7 | 438 |
| 7 | 17.4 | 50/50/0/0 | 100% | 130 | 504 | 239 | 3.0 | 743 | 60 | 16.8 | 0.0 | 0.0 | 0.0 | 0.6 | 97% | 3.0 | 4.0 | 849 |
| 8 | 18.6 | 50/49/1/0 | 100% | 135 | 543 | 271 | 3.0 | 815 | 60 | 18.1 | 0.0 | 0.0 | 0.0 | 0.5 | 97% | 3.0 | 4.0 | 439 |
| 9 | 21.1 | 56/44/0/0 | 100% | 146 | 614 | 314 | 3.0 | 928 | 60 | 20.5 | 0.0 | 0.0 | 0.0 | 0.6 | 97% | 3.0 | 4.0 | 1272 |
| 10 | 22.1 | 56/44/0/0 | 100% | 150 | 643 | 331 | 3.0 | 974 | 80 | 21.4 | 0.0 | 0.0 | 0.0 | 0.6 | 97% | 3.0 | 5.0 | 577 |
| 11 | 23.6 | 55/44/1/0 | 100% | 155 | 686 | 357 | 3.0 | 1042 | 80 | 22.9 | 0.0 | 0.0 | 0.0 | 0.7 | 97% | 3.0 | 5.0 | 1528 |
| 12 | 24.4 | 52/45/3/0 | 100% | 156 | 714 | 370 | 3.0 | 1083 | 80 | 23.8 | 0.0 | 0.0 | 0.0 | 0.6 | 97% | 4.0 | 5.0 | 738 |
| 13 | 25.7 | 49/47/4/0 | 100% | 161 | 751 | 388 | 3.0 | 1139 | 80 | 25.0 | 0.0 | 0.0 | 0.0 | 0.6 | 98% | 4.0 | 5.1 | 1607 |
| 14 | 26.8 | 41/46/13/0 | 100% | 160 | 783 | 398 | 3.0 | 1181 | 80 | 26.1 | 0.0 | 0.0 | 0.0 | 0.7 | 97% | 4.0 | 6.0 | 992 |
| 15 | 28.6 | 15/50/30/5 | 100% | 169 | 833 | 425 | 3.0 | 1258 | 80 | 27.8 | 0.0 | 0.0 | 0.0 | 0.8 | 97% | 4.0 | 6.0 | 2153 |

### Gerçek dokunuşlu ölçüm (`node scripts/oturum-olcum.cjs www çıktı.json egri`)

| Gün | Oyuncu | 10. tur: 0 / 1 / 2 / 3 müşteri (% süre) | 11. tur: 0 / 1 / 2 / 3 (% süre) | 11. tur en çok | Servis (10. → 11.) | Kaçan (10. → 11.) |
|---|---|---|---|---|---|---|
| 1 | yeni (~1 dokunuş/sn) | 0 / 13 / 31 / 56 | 22 / 78 / 0 / 0 | 1 | 9 → 6 | 0 → 0 |
| 1 | alışmış (0,4–0,6 sn) | 0 / 7 / 53 / 40 | 33 / 67 / 0 / 0 | 1 | 14 → 11 | 0 → 0 |
| 3 | yeni (~1 dokunuş/sn) | 0 / 11 / 32 / 57 | 22 / 78 / 0 / 0 | 1 | 10 → 7 | 0 → 0 |
| 3 | alışmış (0,4–0,6 sn) | 0 / 10 / 49 / 41 | 34 / 66 / 0 / 0 | 1 | 16 → 13 | 0 → 0 |
| 6 | yeni (~1 dokunuş/sn) | 0 / 10 / 30 / 60 | 0 / 82 / 18 / 0 | 2 | 11 → 9 | 0 → 0 |
| 6 | alışmış (0,4–0,6 sn) | 0 / 8 / 44 / 48 | 19 / 45 / 31 / 5 | 3 | 18 → 8 | 0 → 3 |
| 10 | yeni (~1 dokunuş/sn) | 0 / 10 / 28 / 63 | 0 / 59 / 41 / 0 | 2 | 13 → 12 | 0 → 0 |
| 10 | alışmış (0,4–0,6 sn) | 0 / 6 / 48 / 46 | 49 / 50 / 1 / 0 | 2 | 21 → 20 | 0 → 0 |

iPhone 15 yatay, Playwright, gerçek dokunuşlar (dokunma alanının ortası), her gün bütün gün; her 0,5 sn tezgâhtaki müşteri sayısı (saat işlerken). Geliştirmeler o güne kadar orta bir oyuncunun aldıkları kadar (3. gün: 3. ızgara + sabır 1; 6. gün: + sabır 2, bahşiş 1, hızlı doğrama 1; 10. gün: + sabır 3, bahşiş 2, hızlı fritöz 1). 10. tur = commit 1b1f42f.
- 1. ve 3. günde aynı anda **çoğunlukla 1 müşteri** (bu botlar müşteriyi 2. müşterinin gelme süresinden önce bitirdiği için 2'yi hiç görmedi; gerçek yeni oyuncu daha yavaş okur ve dolaşır, arada 2 görür; en çok 2). 10. turda aynı günlerde zamanın %56–57'si 3 müşteriyle geçiyordu.
- 6. günde yeni oyuncu çoğunlukla 1, arada 2; 10. günde yeni oyuncu %59 1, %41 2 müşteri; 3 müşteri yok. Alışmış oyuncu çok hızlı servis ettiği için 10. günde de tezgâh çoğunlukla 0–1.
- 6. gün alışmış ölçümünde bir kez bot takıldı (3 müşteri kaçtı, gün uzadı: 19 / 45 / 31 / 5); aynı senaryo yeniden ölçülünce 50 / 50 / 0 / 0, 16 servis, 0 kaçan. Konsol hatası yoktu; takılmanın nedeni bulunamadı, yeniden ölçümde tekrarlanmadı (kalan soru).
- Tam dolu tezgâh 15. günden sonra (bot tablosu yukarıda: 15. günde orta oyuncu %47 3 müşteri).

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

## Dükkân (10. tur; tarih, 11. turun tabloları yukarıda)

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

## Zorluk tavanı (10. tur; tarih)

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

- 11. tur: müşteriler `musteriEgri` ile gelir; malzeme otomatikleri 0,5 sn arayla sıradaki otomatik katmanı koyar (oyuncu yalnız elle konanları koyar; otomatik alt ekmek varken tahta boşsa burger kendiliğinden başlar); doğrama dokunuşu `dogramaSay`, otomatik doğramada oyuncu doğramaz (fritöz boşken 6 × 0,32 sn sonra dolar); fritöz `fritozPisme`. Dükkânda en ucuz alınabilir öğe önce, 2 günlük kira yedekte.

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

## 1–15. günler (10. tur; tarih)

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

