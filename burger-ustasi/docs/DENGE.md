# Burger Ustası: ekonomi ve denge (7. tur: Eymen'in resmindeki mutfak, 21 Kasım)

Değerler `www/js/veri.js` içinde (`BU.VERI`; yeni mutfak `MUTFAK`, `SIPARIS0`, `gun6`, `koyKarar`, `izgaraPisme`, `fritozPisme`; ince ayarlar `AYAR`). Tablolar denge botunun çıktısı:

- `node scripts/denge.mjs 300 md`: 1–15. günler (her düzeyde 300 oyun).
- `node scripts/denge.mjs saat 16 md`: uzun oyun, dükkândaki her şey alınana kadar.
- `SAAT_MAX=80 node scripts/denge.mjs plan 8 md`: uzun oyun + **öneri** (sonraki malzemeler mutfağa yer açılıp satılsaydı); "24 saatte son ürüne ulaşılamaz" kuralı.
- `node scripts/denge.mjs tavan 150 md`: zorluk tavanı.

Değer değiştirince botu yeniden çalıştır ve tabloları güncelle. Deneme: `DENGE_AYAR='{"aralik6":14}' node scripts/denge.mjs 100`.

## Önceki ekonomiden kalanlar

Kasa, kira (`kira(gun)`), eksi kasa ve 3 gün eksi kalınca kapanış (`gunSonu`, kasa 50'ye döner, alınanlar kalır), yeni oyuncuya 50 para, eksi kasayla alışveriş yok (`alabilir`), sabır ve ruh hâli eşikleri, ödeme kuralları (mutlu: fiyat + bahşiş; somurtkan: fiyat; kızgın: ödemez, can gitmez; yanlış: ödemez, bir can; kaçan: bir can), parça parça teslim (`teslimParca`: ilk doğru parçada sabır %15 dolar), bahşiş formülü, kolaylaştırma (art arda kayıpta +%15 sabır), zorluğun 18. günde durması. Hepsi aynen; aşağıdaki tablolar eski 5. turdan kalmadır ve değişmedi.

Kira = 10 + 10 × ⌊√(gün − 1)⌋, 5'e yuvarlı, en çok 120:

| Gün | 1 | 2–4 | 5–9 | 10–16 | 17–25 | 26–36 | 37–49 | 50–64 | 65–81 | 82–100 | 101–121 | 122+ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Kira | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 |

| f (kalan sabır) | Ruh | Yüz | Doğru siparişte | Yanlış parçada |
|---|---|---|---|---|
| f > 2/3 | mutlu | `happy` | fiyat + bahşiş | ödemez, −maliyet, 1 can |
| 2/3 ≥ f > 1/3 | somurtkan | `wait` / `imp` | yalnız fiyat | ödemez, −maliyet, 1 can |
| f ≤ 1/3 | kızgın | `angry` | ödemez, −maliyet (can gitmez) | ödemez, −maliyet, 1 can |
| f = 0 | kaçar | `angry` | (bir can) | |

## Değişen: yeni mutfak

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

## Dükkân (yeni mutfağa göre)

Satılanlar (`GELISTIR`; hepsi tam sayı, eksi kasayla alınmaz):

| Ürün | Etki | Fiyatlar |
|---|---|---|
| **Izgara kilidi** (`slot`, sırayla) | resimdeki kilitli 3. ve 4. ızgara açılır (aynı anda bir köfte daha) | 3. ızgara 250, 4. ızgara 1.500 |
| Hızlı ızgara (`cook`) | köfte −0,5 sn, patates −1 sn (en hızlı 6 sn / 11 sn); Eymen'in 8 ve 15 sn'si başlangıç değeri | 300, 600, 1.200, 2.400 |
| Sabırlı müşteri (`pat`) | sabır +%10 | 350, 700, 1.400, 2.800 |
| Cömert bahşiş (`tip`) | bahşiş +%25 | 400, 800, 1.600, 3.200 |

Eski kayıt: `slot` 1 → 3 ızgara, 2–4 → 4 ızgara (fazlası kırpılır); `cook`, `pat`, `tip` aynen kalır.

### Ne kadar sürede ne açılır (şimdiki dükkân; ortanca, gerçek saat ve oyundaki gün)

| Ürün | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| Izgara kilidi 3. ızgara | 250 | 4 dk, gün 2 | 3 dk, gün 2 | 3 dk, gün 2 |
| Hızlı ızgara 1. düzey | 300 | 6 dk, gün 3 | 5 dk, gün 3 | 5 dk, gün 3 |
| Sabırlı müşteri 1. düzey | 350 | 10 dk, gün 5 | 7 dk, gün 4 | 7 dk, gün 4 |
| Cömert bahşiş 1. düzey | 400 | 15 dk, gün 7 | 10 dk, gün 5 | 9 dk, gün 5 |
| Hızlı ızgara 2. düzey | 600 | 21 dk, gün 8 | 14 dk, gün 7 | 12 dk, gün 6 |
| Sabırlı müşteri 2. düzey | 700 | > 80 sa | 17 dk, gün 8 | 17 dk, gün 8 |
| Cömert bahşiş 2. düzey | 800 | > 80 sa | 23 dk, gün 10 | 20 dk, gün 9 |
| Hızlı ızgara 3. düzey | 1.200 | > 80 sa | 29 dk, gün 12 | 26 dk, gün 11 |
| Sabırlı müşteri 3. düzey | 1.400 | > 80 sa | 32 dk, gün 13 | 32 dk, gün 13 |
| Izgara kilidi 4. ızgara | 1.500 | > 80 sa | 39 dk, gün 15 | 36 dk, gün 14 |
| Cömert bahşiş 3. düzey | 1.600 | > 80 sa | 45 dk, gün 17 | 42 dk, gün 16 |
| Hızlı ızgara 4. düzey | 2.400 | > 80 sa | 56 dk, gün 20 | 50 dk, gün 19 |
| Sabırlı müşteri 4. düzey | 2.800 | > 80 sa | 1.1 sa, gün 24 | 59 dk, gün 21 |
| Cömert bahşiş 4. düzey | 3.200 | > 80 sa | 1.4 sa, gün 28 | 1.1 sa, gün 25 |

- Orta oyuncu dükkândaki her şeyi **~1,4 saatte** (28. gün), hızlı oyuncu **~1,1 saatte** alıyor; yavaş oyuncu 14–15. günde takılıyor (2. düzeylerden sonrasını alamıyor, aşağıya bak).
- **Kural:** "en iyi oyuncu 24 saat aralıksız oynasa son ürüne ulaşamamalı" şimdiki dükkânla **sağlanmıyor**: satılacak şey az (2 kilit + 12 geliştirme düzeyi). Resimde başka malzemeye yer olmadığı için bu bilerek böyle; kural, sonraki adımlarda mutfağa yer açılınca aşağıdaki öneriyle sağlanır.

### Öneri: sonraki adımlar (satılmıyor; `VERI.GELECEK`)

Resme yeni yerler eklendikçe (ör. ikinci küvet sırası, sos şişeleri, içecek makinesi) malzemeler sırayla satılır; sipariş "aynı sipariş" kuralından eski kurala döner (temel burger + 0–2 ekstra, pahalı malzeme daha sık). Bot bu planı oynadı (ekstra malzeme başına +1 dokunuş, +3,7 sn sabır):

| Ürün | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| (öneri) Marul | 2.000 | > 80 sa | 54 dk, gün 19 | 48 dk, gün 18 |
| (öneri) Domates | 4.000 | > 80 sa | 1.7 sa, gün 32 | 1.5 sa, gün 29 |
| (öneri) Soğan | 7.000 | > 80 sa | 2.2 sa, gün 38 | 1.9 sa, gün 35 |
| (öneri) Pastırma | 12.000 | > 80 sa | 2.9 sa, gün 48 | 2.5 sa, gün 44 |
| (öneri) Yumurta | 20.000 | > 80 sa | 4.1 sa, gün 66 | 3.5 sa, gün 61 |
| (öneri) Ketçap | 32.000 | > 80 sa | 6.2 sa, gün 94 | 5.2 sa, gün 87 |
| (öneri) Mayonez | 50.000 | > 80 sa | 9.2 sa, gün 138 | 7.8 sa, gün 127 |
| (öneri) Mantar | 80.000 | > 80 sa | 14.1 sa, gün 208 | 11.8 sa, gün 190 |
| (öneri) Jalapeño | 130.000 | > 80 sa | 21.9 sa, gün 322 | 18.3 sa, gün 291 |
| (öneri) Avokado | 220.000 | > 80 sa | 34.9 sa, gün 504 | 29.0 sa, gün 458 |
| (öneri) Altın Wagyu | 400.000 | > 80 sa | 57.0 sa, gün 818 | 47.5 sa, gün 748 |

- **Kural sağlanıyor:** hızlı oyuncu son ürüne (Altın Wagyu, 400.000) ortanca **47,5 saatte**, en erken 47,3 saatte ulaşıyor; orta oyuncu 57 saatte. 24 saat aralıksız oynayan hızlı oyuncu jalapeño ile avokado arasında (avokado 29 sa).
- Saatlik kazanç her yeni malzemeyle artıyor (hızlı: 1. saat 15,3 bin, 5. saat 19,4 bin, 31. saat 22 bin; orta: 13 → 16,4 → 18 bin).

## Zorluk tavanı


**Yavaş oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 96% / 0% / 278 | 75% / 0% / 118 | 0% / 0% / -22 | 0% / 0% / -27 | 0% / 0% / -29 | 0% / 0% / -25 |
| 4 ızgara, başka geliştirme yok | 99% / 0% / 279 | 81% / 0% / 123 | 0% / 0% / -22 | 0% / 0% / -31 | 0% / 0% / -26 | 0% / 0% / -27 |
| tam geliştirme | 97% / 58% / 332 | 91% / 10% / 328 | 1% / 0% / -2 | 0% / 0% / -11 | 0% / 0% / -13 | 0% / 0% / -10 |

**Orta oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 97% / 95% / 383 | 94% / 94% / 579 | 90% / 90% / 735 | 93% / 45% / 572 | 91% / 37% / 557 | 93% / 44% / 564 |
| 4 ızgara, başka geliştirme yok | 99% / 94% / 376 | 97% / 95% / 585 | 86% / 90% / 729 | 91% / 35% / 532 | 90% / 42% / 561 | 87% / 36% / 518 |
| tam geliştirme | 99% / 95% / 493 | 99% / 95% / 762 | 93% / 94% / 967 | 91% / 69% / 783 | 92% / 72% / 791 | 92% / 72% / 793 |

**Hızlı oyuncu**: kazanma oranı / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 99% / 98% / 414 | 97% / 97% / 626 | 96% / 97% / 839 | 99% / 97% / 830 | 99% / 97% / 834 | 99% / 96% / 825 |
| 4 ızgara, başka geliştirme yok | 100% / 97% / 411 | 99% / 97% / 631 | 99% / 97% / 839 | 97% / 96% / 823 | 99% / 97% / 829 | 98% / 95% / 816 |
| tam geliştirme | 99% / 97% / 530 | 99% / 97% / 816 | 99% / 97% / 1089 | 97% / 97% / 1075 | 99% / 98% / 1092 | 99% / 97% / 1086 |

- Herkes aynı siparişi verdiği için düşünme yok, iş hızı belirleyici: burgeri önceden hazırlayan (orta/hızlı) oyuncu müşteriyi hemen karşılıyor, mutlu oranı %90+. 18. günden sonra orta oyuncu geliştirmesiz %35–45 mutlu, tam geliştirmeyle %70.
- **Yavaş oyuncu** 10. güne kadar rahat, 12–15. günde takılıyor (eski düzende de 13. günden sonra takılıyordu). Bahşiş hiç almıyor (müşteriyi beklettiği için sabır 2/3'ün altına iniyor). İstenirse "kolay" ayar ya da 10. günden sonra daha yavaş artan zorluk düşünülebilir (Eymen'in kararı).

## Denge botu (oyuncu modeli)

- Tek parmak; her dokunuş B.tap sn (0,8–1,25 kat oynar), doğrama dokunuşu B.dogra sn. Tepsiyi müşteriye vermek, burgeri ya da patatesi tepsiye koymak 2 dokunuş; malzeme 1 dokunuş.
- Öncelik: dolu tepsiyi en acil müşteriye ver > fritözü boşalt > ızgarayı doldur (hazne + pişen < 6) > biten burgeri tepsiye > tepsiye patates > haznede ≤ 1 patates kalınca doğra > burgere sıradaki malzeme. Orta ve hızlı oyuncu sıradaki müşteri için bir burger önceden yapar.
- Hata: burger erken kapanır (üst ekmek); çöp olmadığı için fark edilmez, yanlış teslim edilir (bir can).
- Gerçek süre = günün süresi + 10 sn (kartlar, dükkân). Kaybedilen gün yeniden oynanır.

| Düzey | Dokunuş | Doğrama dokunuşu | Sipariş okuma | Burger başına hata |
|---|---|---|---|---|
| Yavaş | 0,85 sn | 0,30 sn | 1,6 sn | %4 |
| Orta | 0,6 sn | 0,22 sn | 0,9 sn | %3 |
| Hızlı | 0,4 sn | 0,16 sn | 0,5 sn | %1,5 |

## 1–15. günler (yeni oyuncu, 50 parayla)

Sayılar ilk denemenin ortalaması. Kasa = gün sonu kira ve dükkândan sonra kalan; Izgara = açık ızgara; Geliştirme = alınan geliştirme düzeyi toplamı.

### Yavaş oyuncu (dokunuş 0.85 sn, doğrama 0.3 sn, hata %4)

| Gün | Müşteri | Kazanma | Süre (sn) | Gelir | Bahşiş | Gider | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 88 | 250 | 0 | 78 | 172 | 10 | 0.0 | 5.6 | 0.0 | 0.0 | 0.4 | 0% | 2.0 | 0.0 | 212 |
| 2 | 7 | 99% | 101 | 293 | 0 | 91 | 202 | 20 | 0.0 | 6.5 | 0.0 | 0.0 | 0.5 | 0% | 3.0 | 0.0 | 147 |
| 3 | 8 | 100% | 113 | 338 | 0 | 109 | 228 | 20 | 0.0 | 7.5 | 0.0 | 0.0 | 0.5 | 0% | 3.0 | 0.6 | 170 |
| 4 | 9 | 98% | 125 | 373 | 0 | 121 | 252 | 20 | 0.0 | 8.3 | 0.0 | 0.0 | 0.7 | 0% | 3.0 | 1.0 | 287 |
| 5 | 10 | 98% | 135 | 413 | 0 | 133 | 280 | 30 | 0.0 | 9.2 | 0.1 | 0.0 | 0.7 | 0% | 3.0 | 2.0 | 207 |
| 6 | 11 | 97% | 144 | 454 | 0 | 145 | 309 | 30 | 0.0 | 10.1 | 0.1 | 0.0 | 0.7 | 0% | 3.0 | 2.6 | 251 |
| 7 | 12 | 96% | 153 | 482 | 0 | 159 | 323 | 30 | 0.0 | 10.7 | 0.3 | 0.0 | 0.8 | 0% | 3.0 | 3.0 | 383 |
| 8 | 13 | 96% | 165 | 484 | 0 | 175 | 309 | 30 | 0.0 | 10.8 | 1.2 | 0.0 | 0.9 | 0% | 3.0 | 3.6 | 315 |
| 9 | 14 | 91% | 172 | 445 | 0 | 183 | 262 | 30 | 0.0 | 9.9 | 2.7 | 0.1 | 0.9 | 0% | 3.0 | 3.9 | 394 |
| 10 | 15 | 85% | 180 | 363 | 0 | 191 | 171 | 40 | 0.0 | 8.1 | 5.1 | 0.5 | 1.0 | 0% | 3.0 | 4.1 | 429 |
| 11 | 16 | 70% | 183 | 290 | 0 | 193 | 97 | 40 | 0.0 | 6.4 | 6.7 | 1.0 | 1.0 | 0% | 3.0 | 4.2 | 430 |
| 12 | 17 | 42% | 180 | 233 | 0 | 190 | 43 | 40 | 0.0 | 5.2 | 7.6 | 1.5 | 1.0 | 0% | 3.0 | 4.3 | 366 |
| 13 | 18 | 16% | 168 | 189 | 0 | 178 | 12 | 40 | 0.0 | 4.2 | 7.4 | 1.9 | 0.9 | 0% | 3.0 | 4.3 | 248 |
| 14 | 19 | 1% | 149 | 153 | 0 | 158 | -5 | 40 | 0.0 | 3.4 | 6.7 | 2.1 | 0.9 | 0% | 3.0 | 4.3 | 92 |
| 15 | 20 | 0% | 134 | 133 | 0 | 142 | -9 | 40 | 0.0 | 3.0 | 6.0 | 2.2 | 0.8 | 0% | 3.0 | 4.3 | 0 |

### Orta oyuncu (dokunuş 0.6 sn, doğrama 0.22 sn, hata %3)

| Gün | Müşteri | Kazanma | Süre (sn) | Gelir | Bahşiş | Gider | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 79 | 254 | 60 | 102 | 212 | 10 | 5.6 | 0.0 | 0.0 | 0.0 | 0.4 | 94% | 2.0 | 0.0 | 252 |
| 2 | 7 | 100% | 92 | 299 | 74 | 114 | 258 | 20 | 6.6 | 0.0 | 0.0 | 0.0 | 0.4 | 95% | 3.0 | 0.0 | 240 |
| 3 | 8 | 99% | 104 | 341 | 87 | 134 | 294 | 20 | 7.6 | 0.0 | 0.0 | 0.0 | 0.4 | 95% | 3.0 | 1.0 | 219 |
| 4 | 9 | 98% | 114 | 381 | 99 | 146 | 334 | 20 | 8.5 | 0.0 | 0.0 | 0.0 | 0.5 | 94% | 3.0 | 1.9 | 207 |
| 5 | 10 | 99% | 125 | 427 | 116 | 158 | 386 | 30 | 9.5 | 0.0 | 0.0 | 0.0 | 0.5 | 95% | 3.0 | 2.9 | 204 |
| 6 | 11 | 98% | 134 | 470 | 153 | 170 | 453 | 30 | 10.4 | 0.0 | 0.0 | 0.0 | 0.5 | 95% | 3.0 | 3.3 | 423 |
| 7 | 12 | 99% | 142 | 511 | 169 | 189 | 491 | 30 | 11.3 | 0.0 | 0.0 | 0.0 | 0.6 | 95% | 3.0 | 4.0 | 435 |
| 8 | 13 | 97% | 150 | 550 | 184 | 200 | 534 | 30 | 12.2 | 0.0 | 0.0 | 0.0 | 0.7 | 94% | 3.0 | 4.9 | 321 |
| 9 | 14 | 97% | 159 | 593 | 204 | 212 | 585 | 30 | 13.2 | 0.0 | 0.0 | 0.0 | 0.7 | 95% | 3.0 | 5.4 | 520 |
| 10 | 15 | 97% | 166 | 636 | 235 | 224 | 648 | 40 | 14.1 | 0.0 | 0.0 | 0.0 | 0.8 | 95% | 3.0 | 6.0 | 652 |
| 11 | 16 | 94% | 169 | 672 | 270 | 241 | 702 | 40 | 14.9 | 0.0 | 0.0 | 0.0 | 0.8 | 95% | 3.0 | 6.6 | 642 |
| 12 | 17 | 94% | 174 | 713 | 284 | 253 | 744 | 40 | 15.8 | 0.0 | 0.0 | 0.0 | 0.9 | 95% | 3.0 | 7.0 | 859 |
| 13 | 18 | 93% | 179 | 754 | 300 | 264 | 789 | 40 | 16.7 | 0.0 | 0.0 | 0.0 | 1.0 | 94% | 3.0 | 7.8 | 603 |
| 14 | 19 | 92% | 181 | 797 | 316 | 275 | 838 | 40 | 17.7 | 0.0 | 0.0 | 0.0 | 1.0 | 95% | 3.1 | 8.0 | 963 |
| 15 | 20 | 91% | 185 | 833 | 324 | 291 | 866 | 40 | 18.5 | 0.0 | 0.0 | 0.0 | 1.1 | 94% | 4.0 | 8.0 | 641 |

### Hızlı oyuncu (dokunuş 0.4 sn, doğrama 0.16 sn, hata %1.5)

| Gün | Müşteri | Kazanma | Süre (sn) | Gelir | Bahşiş | Gider | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 78 | 263 | 71 | 103 | 230 | 10 | 5.8 | 0.0 | 0.0 | 0.0 | 0.2 | 97% | 2.0 | 0.0 | 270 |
| 2 | 7 | 100% | 90 | 307 | 86 | 115 | 277 | 20 | 6.8 | 0.0 | 0.0 | 0.0 | 0.2 | 97% | 3.0 | 0.0 | 277 |
| 3 | 8 | 100% | 103 | 351 | 101 | 135 | 316 | 20 | 7.8 | 0.0 | 0.0 | 0.0 | 0.2 | 97% | 3.0 | 1.0 | 273 |
| 4 | 9 | 100% | 114 | 395 | 116 | 147 | 363 | 20 | 8.8 | 0.0 | 0.0 | 0.0 | 0.2 | 97% | 3.0 | 2.0 | 267 |
| 5 | 10 | 100% | 124 | 436 | 133 | 159 | 410 | 30 | 9.7 | 0.0 | 0.0 | 0.0 | 0.3 | 97% | 3.0 | 3.0 | 252 |
| 6 | 11 | 100% | 134 | 484 | 181 | 171 | 494 | 30 | 10.7 | 0.0 | 0.0 | 0.0 | 0.2 | 98% | 3.0 | 3.8 | 226 |
| 7 | 12 | 99% | 142 | 524 | 195 | 191 | 528 | 30 | 11.7 | 0.0 | 0.0 | 0.0 | 0.3 | 97% | 3.0 | 4.0 | 609 |
| 8 | 13 | 100% | 152 | 570 | 214 | 203 | 582 | 30 | 12.7 | 0.0 | 0.0 | 0.0 | 0.3 | 97% | 3.0 | 5.0 | 468 |
| 9 | 14 | 100% | 159 | 613 | 236 | 215 | 634 | 30 | 13.6 | 0.0 | 0.0 | 0.0 | 0.4 | 97% | 3.0 | 5.9 | 312 |
| 10 | 15 | 100% | 165 | 658 | 296 | 227 | 727 | 40 | 14.6 | 0.0 | 0.0 | 0.0 | 0.4 | 98% | 3.0 | 6.0 | 956 |
| 11 | 16 | 99% | 170 | 696 | 312 | 245 | 763 | 40 | 15.5 | 0.0 | 0.0 | 0.0 | 0.5 | 97% | 3.0 | 7.0 | 493 |
| 12 | 17 | 99% | 175 | 743 | 336 | 258 | 822 | 40 | 16.5 | 0.0 | 0.0 | 0.0 | 0.5 | 97% | 3.0 | 7.0 | 1226 |
| 13 | 18 | 98% | 180 | 783 | 356 | 268 | 870 | 40 | 17.4 | 0.0 | 0.0 | 0.0 | 0.5 | 97% | 3.0 | 8.0 | 729 |
| 14 | 19 | 98% | 184 | 825 | 378 | 281 | 922 | 40 | 18.3 | 0.0 | 0.0 | 0.0 | 0.6 | 97% | 3.6 | 8.0 | 727 |
| 15 | 20 | 99% | 187 | 875 | 403 | 301 | 977 | 40 | 19.4 | 0.0 | 0.0 | 0.0 | 0.5 | 97% | 4.0 | 8.0 | 1037 |
