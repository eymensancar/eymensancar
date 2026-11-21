# Burger Ustası: ekonomi ve denge (9. tur: can yok, 21 Kasım)

Değerler `www/js/veri.js` içinde (`BU.VERI`; yeni mutfak `MUTFAK`, `SIPARIS0`, `gun6`, `koyKarar`, `izgaraPisme`, `fritozPisme`; ince ayarlar `AYAR`; dükkânda satılanlar `SATILIK`). Tablolar denge botunun çıktısı:

- `node scripts/denge.mjs 300 md`: 1–15. günler (her düzeyde 300 oyun).
- `node scripts/denge.mjs saat 16 md`: uzun oyun, dükkândaki her şey alınana kadar.
- `SAAT_MAX=80 node scripts/denge.mjs plan 8 md`: uzun oyun + **öneri** (sonraki malzemeler mutfağa yer açılıp satılsaydı); "24 saatte son ürüne ulaşılamaz" kuralı.
- `node scripts/denge.mjs tavan 150 md`: zorluk tavanı.

Değer değiştirince botu yeniden çalıştır ve tabloları güncelle. Deneme: `DENGE_AYAR='{"aralik6":14}' node scripts/denge.mjs 100`.

## 9. tur: can kalktı (Eymen, 21 Kasım)

- **Can yok.** Süresi dolan müşteri yalnız gider (yürüyerek çıkar, ceza sesi yok): o müşterinin parası ve seri kaçar, gün sürer. Gün, bütün müşteriler gelip gidince biter; **kaybedilen gün yok**, her gün sonunda bir sonraki güne geçilir.
- **Yanlış teslim** (yanlış ya da eksik kurulmuş burger, aynı parçayı ikinci kez vermek): müşteri **ödemez**, verilenlerin maliyeti zarardır (`−maliyet` yazısı), **seri sıfırlanır**, müşteri gider. Can gitmez.
- **Kira ve eksi kasa** kuralı aynen sürer: her gün sonunda kira düşer, kasa eksiye inebilir, 3 gün art arda eksi kalırsa dükkân kapanır (kasa 50'ye döner, alınanlar kalır). Oyunu "bitiren" tek şey artık budur.
- Yıldız: 3 − kaçan − yanlış (en az 1).
- **Kolaylaştırma** (eskiden "art arda kayıp"ta): müşterilerin üçte biri ya da fazlası kaçtıysa/yanlış aldıysa ertesi gün sabır +%15 (art arda en çok 3 kez, `SAVE.kolay`). Denge botu bunu oynamaz (tablolar kolaylaştırmasız).
- **"Hızlı ızgara" dükkândan kalktı** (Eymen: işi kısaltan yükseltme şimdilik yok). Köfte hep 8 sn, patates hep 15 sn (`izgaraPisme`, `fritozPisme` `up.cook`'u yok sayar). Eski kayıtta alınmış düzeylerin parası ilk açılışta **bir kez kasaya iade** edilir (`VERI.cookIade`: 300 + 600 + 1.200 + 2.400; `up.cook` 0 yapılır), ana menüde kısa bir not çıkar.
- Botta "kazanma oranı" yerine **"kârlı gün"** (net kâr ≥ kira) sütunu var.

## Önceki ekonomiden kalanlar

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

Satılanlar (`SATILIK`; hepsi tam sayı, eksi kasayla alınmaz). 9. turdan beri dükkân oyunda da açılır: sol alttaki tablete dokununca oyun durur, günün kasasıyla alınır, alınan şey hemen işler.

| Ürün | Etki | Fiyatlar |
|---|---|---|
| **Izgara kilidi** (`slot`, sırayla) | resimdeki kilitli 3. ve 4. ızgara açılır (aynı anda bir köfte daha) | 3. ızgara 250, 4. ızgara 1.500 |
| Sabırlı müşteri (`pat`) | sabır +%10 | 350, 700, 1.400, 2.800 |
| Cömert bahşiş (`tip`) | bahşiş +%25 | 400, 800, 1.600, 3.200 |
| ~~Hızlı ızgara~~ (`cook`) | 9. turda kalktı, etkisi yok; alınmışsa parası iade | (300, 600, 1.200, 2.400) |

Eski kayıt: `slot` 1 → 3 ızgara, 2–4 → 4 ızgara (fazlası kırpılır); `pat`, `tip` aynen kalır; `cook` iade edilip 0 olur.

### Ne kadar sürede ne açılır (şimdiki dükkân; ortanca, gerçek saat ve oyundaki gün)

| Ürün | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| Izgara kilidi 3. ızgara | 250 | 3 dk, gün 2 | 3 dk, gün 2 | 3 dk, gün 2 |
| Sabırlı müşteri 1. düzey | 350 | 8 dk, gün 4 | 5 dk, gün 3 | 5 dk, gün 3 |
| Cömert bahşiş 1. düzey | 400 | 10 dk, gün 5 | 7 dk, gün 4 | 7 dk, gün 4 |
| Sabırlı müşteri 2. düzey | 700 | 18 dk, gün 8 | 12 dk, gün 6 | 12 dk, gün 6 |
| Cömert bahşiş 2. düzey | 800 | 28 dk, gün 11 | 17 dk, gün 8 | 17 dk, gün 8 |
| Sabırlı müşteri 3. düzey | 1.400 | > 80 sa | 23 dk, gün 10 | 23 dk, gün 10 |
| Izgara kilidi 4. ızgara | 1.500 | > 80 sa | 29 dk, gün 12 | 29 dk, gün 12 |
| Cömert bahşiş 3. düzey | 1.600 | > 80 sa | 36 dk, gün 14 | 35 dk, gün 14 |
| Sabırlı müşteri 4. düzey | 2.800 | > 80 sa | 48 dk, gün 18 | 45 dk, gün 17 |
| Cömert bahşiş 4. düzey | 3.200 | > 80 sa | 1.0 sa, gün 22 | 54 dk, gün 20 |

- Orta oyuncu dükkândaki her şeyi **~1,0 saatte** (22. gün), hızlı oyuncu **~54 dakikada** (20. gün) alıyor ("Hızlı ızgara" kalktığı için eskisinden ~25 dk erken).
- **Yavaş oyuncu artık takılıp kalmıyor ama batıyor:** can olmadığı için her gün bitiyor ve zorluk artmaya devam ediyor; 12–15. günden sonra gün kârı kirayı karşılamıyor, kasa 3 gün eksi kalınca dükkân kapanıyor (80 saatte ortalama ~456 kapanış; 2. düzeylerden sonrasını alamıyor). Eskiden bu oyuncu 14–15. günü tekrar tekrar oynuyordu. Oyunda "kolaylaştırma" (kötü günden sonra sabır +%15) var ama bot onu oynamıyor; **Eymen'e soru:** yavaş oyuncu için zorluk 10. günden sonra daha yavaş mı artsın, yoksa kapanış (kasa 50'ye döner) yeterli bir "ikinci şans" mı?
- **Kural:** "en iyi oyuncu 24 saat aralıksız oynasa son ürüne ulaşamamalı" şimdiki dükkânla **sağlanmıyor** (satılacak şey az); kural aşağıdaki öneriyle sağlanır.

### Öneri: sonraki adımlar (satılmıyor; `VERI.GELECEK`)

Resme yeni yerler eklendikçe (ör. ikinci küvet sırası, sos şişeleri, içecek makinesi) malzemeler sırayla satılır; sipariş "aynı sipariş" kuralından eski kurala döner (temel burger + 0–2 ekstra, pahalı malzeme daha sık). Bot bu planı oynadı (ekstra malzeme başına +1 dokunuş, +3,7 sn sabır):

| Ürün | Fiyat | Yavaş | Orta | Hızlı |
|---|---|---|---|---|
| (öneri) Marul | 2.000 | > 80 sa | 45 dk, gün 17 | 42 dk, gün 16 |
| (öneri) Domates | 4.000 | > 80 sa | 1.4 sa, gün 27 | 1.3 sa, gün 25 |
| (öneri) Soğan | 7.000 | > 80 sa | 1.8 sa, gün 34 | 1.6 sa, gün 31 |
| (öneri) Pastırma | 12.000 | > 80 sa | 2.5 sa, gün 45 | 2.2 sa, gün 40 |
| (öneri) Yumurta | 20.000 | > 80 sa | 3.8 sa, gün 65 | 3.3 sa, gün 57 |
| (öneri) Ketçap | 32.000 | > 80 sa | 5.8 sa, gün 96 | 4.9 sa, gün 83 |
| (öneri) Mayonez | 50.000 | > 80 sa | 8.9 sa, gün 146 | 7.5 sa, gün 124 |
| (öneri) Mantar | 80.000 | > 80 sa | 13.9 sa, gün 223 | 11.5 sa, gün 189 |
| (öneri) Jalapeño | 130.000 | > 80 sa | 21.6 sa, gün 345 | 18.0 sa, gün 292 |
| (öneri) Avokado | 220.000 | > 80 sa | 34.6 sa, gün 548 | 28.7 sa, gün 464 |
| (öneri) Altın Wagyu | 400.000 | > 80 sa | 56.6 sa, gün 896 | 47.2 sa, gün 758 |

- **Kural sağlanıyor:** hızlı oyuncu son ürüne (Altın Wagyu, 400.000) ortanca **47,2 saatte**, en erken 47,1 saatte ulaşıyor; orta oyuncu 56,6 saatte. 24 saat aralıksız oynayan hızlı oyuncu jalapeño ile avokado arasında (avokado 28,7 sa).
- Saatlik kazanç her yeni malzemeyle artıyor (hızlı: 1. saat 15,3 bin, 5. saat 19,3 bin, 31. saat 21,7 bin; orta: 13,5 → 16,5 → 17,1 bin).

## Zorluk tavanı

**Yavaş oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 0% / 280 | 65% / 0% / 116 | 1% / 0% / -100 | 0% / 0% / -121 | 0% / 0% / -116 | 0% / 0% / -120 |
| 4 ızgara, başka geliştirme yok | 100% / 0% / 283 | 73% / 0% / 139 | 1% / 0% / -94 | 0% / 0% / -117 | 0% / 0% / -118 | 0% / 0% / -119 |
| tam geliştirme | 100% / 58% / 328 | 99% / 10% / 338 | 12% / 0% / -43 | 0% / 0% / -84 | 0% / 0% / -85 | 0% / 0% / -86 |

**Orta oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 94% / 377 | 100% / 94% / 581 | 100% / 92% / 766 | 100% / 40% / 559 | 99% / 41% / 574 | 96% / 39% / 565 |
| 4 ızgara, başka geliştirme yok | 100% / 95% / 383 | 100% / 95% / 591 | 100% / 90% / 756 | 99% / 40% / 567 | 97% / 39% / 552 | 96% / 38% / 551 |
| tam geliştirme | 100% / 95% / 495 | 100% / 94% / 755 | 100% / 94% / 976 | 100% / 67% / 781 | 100% / 68% / 792 | 100% / 67% / 786 |

**Hızlı oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)

| Durum | Gün 5 | Gün 10 | Gün 15 | Gün 18 | Gün 40 | Gün 300 |
|---|---|---|---|---|---|---|
| geliştirmesiz (2 ızgara) | 100% / 98% / 414 | 100% / 98% / 640 | 100% / 97% / 843 | 100% / 97% / 833 | 100% / 96% / 823 | 100% / 96% / 823 |
| 4 ızgara, başka geliştirme yok | 100% / 98% / 411 | 100% / 97% / 634 | 100% / 97% / 844 | 100% / 96% / 827 | 100% / 97% / 834 | 100% / 96% / 824 |
| tam geliştirme | 100% / 97% / 531 | 100% / 96% / 808 | 100% / 97% / 1089 | 100% / 97% / 1073 | 100% / 97% / 1068 | 100% / 97% / 1068 |

- Herkes aynı siparişi verdiği için düşünme yok, iş hızı belirleyici: burgeri önceden hazırlayan (orta/hızlı) oyuncu müşteriyi hemen karşılıyor, mutlu oranı %90+. 18. günden sonra orta oyuncu geliştirmesiz %35–45 mutlu, tam geliştirmeyle %70.
- **Yavaş oyuncu** 10. güne kadar rahat, 12–15. günden sonra gün kârı kirayı karşılamıyor (can olmadığı için gün yine biter; zarar kasadan gider). Bahşiş hiç almıyor (müşteriyi beklettiği için sabır 2/3'ün altına iniyor).

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

## 1–15. günler (yeni oyuncu, 50 parayla)

Sayılar ortalama (her gün bir kez oynanır). Kârlı gün = net kâr ≥ kira. Kasa = gün sonu kira ve dükkândan sonra kalan; Izgara = açık ızgara; Geliştirme = alınan geliştirme düzeyi toplamı.

### Yavaş oyuncu (dokunuş 0.85 sn, doğrama 0.3 sn, hata %4)

| Gün | Müşteri | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Gider | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 88 | 249 | 0 | 78 | 171 | 10 | 0.0 | 5.5 | 0.0 | 0.0 | 0.5 | 0% | 2.0 | 0.0 | 211 |
| 2 | 7 | 100% | 100 | 289 | 0 | 90 | 199 | 20 | 0.0 | 6.4 | 0.0 | 0.0 | 0.6 | 0% | 3.0 | 0.0 | 146 |
| 3 | 8 | 100% | 113 | 335 | 0 | 109 | 226 | 20 | 0.0 | 7.4 | 0.0 | 0.0 | 0.6 | 0% | 3.0 | 0.2 | 271 |
| 4 | 9 | 100% | 125 | 376 | 0 | 122 | 254 | 20 | 0.0 | 8.4 | 0.0 | 0.0 | 0.6 | 0% | 3.0 | 1.0 | 232 |
| 5 | 10 | 100% | 135 | 417 | 0 | 133 | 283 | 30 | 0.0 | 9.3 | 0.0 | 0.0 | 0.7 | 0% | 3.0 | 1.6 | 236 |
| 6 | 11 | 100% | 144 | 452 | 0 | 145 | 307 | 30 | 0.0 | 10.1 | 0.1 | 0.0 | 0.9 | 0% | 3.0 | 2.0 | 361 |
| 7 | 12 | 99% | 155 | 484 | 0 | 160 | 323 | 30 | 0.0 | 10.7 | 0.5 | 0.0 | 0.8 | 0% | 3.0 | 2.1 | 577 |
| 8 | 13 | 98% | 166 | 485 | 0 | 176 | 309 | 30 | 0.0 | 10.8 | 1.2 | 0.0 | 1.0 | 0% | 3.0 | 2.9 | 315 |
| 9 | 14 | 99% | 176 | 495 | 0 | 188 | 307 | 30 | 0.0 | 11.0 | 1.9 | 0.1 | 1.1 | 0% | 3.0 | 3.0 | 529 |
| 10 | 15 | 87% | 186 | 418 | 0 | 198 | 220 | 40 | 0.0 | 9.3 | 4.3 | 0.2 | 1.1 | 0% | 3.0 | 3.2 | 518 |
| 11 | 16 | 66% | 194 | 320 | 0 | 203 | 116 | 40 | 0.0 | 7.1 | 7.0 | 0.9 | 1.0 | 0% | 3.0 | 3.4 | 477 |
| 12 | 17 | 44% | 200 | 248 | 0 | 208 | 40 | 40 | 0.0 | 5.5 | 8.8 | 1.5 | 1.1 | 0% | 3.0 | 3.4 | 431 |
| 13 | 18 | 29% | 207 | 214 | 0 | 214 | 0 | 40 | 0.0 | 4.7 | 9.9 | 2.1 | 1.2 | 0% | 3.0 | 3.4 | 387 |
| 14 | 19 | 9% | 211 | 171 | 0 | 216 | -44 | 40 | 0.0 | 3.8 | 11.1 | 3.0 | 1.2 | 0% | 3.0 | 3.4 | 303 |
| 15 | 20 | 1% | 217 | 148 | 0 | 221 | -73 | 40 | 0.0 | 3.3 | 11.9 | 3.7 | 1.1 | 0% | 3.0 | 3.4 | 196 |

### Orta oyuncu (dokunuş 0.6 sn, doğrama 0.22 sn, hata %3)

| Gün | Müşteri | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Gider | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 79 | 256 | 61 | 102 | 215 | 10 | 5.7 | 0.0 | 0.0 | 0.0 | 0.3 | 95% | 2.0 | 0.0 | 255 |
| 2 | 7 | 100% | 92 | 299 | 74 | 114 | 258 | 20 | 6.6 | 0.0 | 0.0 | 0.0 | 0.4 | 95% | 3.0 | 0.0 | 244 |
| 3 | 8 | 100% | 103 | 340 | 86 | 134 | 292 | 20 | 7.6 | 0.0 | 0.0 | 0.0 | 0.4 | 94% | 3.0 | 1.0 | 173 |
| 4 | 9 | 100% | 114 | 385 | 103 | 146 | 342 | 20 | 8.6 | 0.0 | 0.0 | 0.0 | 0.4 | 95% | 3.0 | 1.7 | 207 |
| 5 | 10 | 100% | 126 | 428 | 134 | 158 | 404 | 30 | 9.5 | 0.0 | 0.0 | 0.0 | 0.5 | 95% | 3.0 | 2.0 | 461 |
| 6 | 11 | 100% | 135 | 468 | 155 | 170 | 454 | 30 | 10.4 | 0.0 | 0.0 | 0.0 | 0.6 | 95% | 3.0 | 2.9 | 260 |
| 7 | 12 | 100% | 144 | 512 | 175 | 190 | 497 | 30 | 11.4 | 0.0 | 0.0 | 0.0 | 0.6 | 95% | 3.0 | 3.0 | 636 |
| 8 | 13 | 100% | 152 | 555 | 192 | 201 | 546 | 30 | 12.3 | 0.0 | 0.0 | 0.0 | 0.7 | 95% | 3.0 | 4.0 | 387 |
| 9 | 14 | 100% | 160 | 600 | 240 | 213 | 627 | 30 | 13.3 | 0.0 | 0.0 | 0.0 | 0.7 | 95% | 3.0 | 4.0 | 965 |
| 10 | 15 | 100% | 166 | 639 | 256 | 225 | 670 | 40 | 14.2 | 0.0 | 0.0 | 0.0 | 0.8 | 95% | 3.0 | 4.8 | 494 |
| 11 | 16 | 100% | 171 | 686 | 279 | 245 | 720 | 40 | 15.2 | 0.0 | 0.0 | 0.0 | 0.8 | 95% | 3.0 | 5.0 | 876 |
| 12 | 17 | 100% | 177 | 724 | 292 | 256 | 760 | 40 | 16.1 | 0.0 | 0.0 | 0.0 | 0.9 | 95% | 3.6 | 5.0 | 751 |
| 13 | 18 | 100% | 182 | 771 | 310 | 268 | 813 | 40 | 17.1 | 0.0 | 0.0 | 0.0 | 0.9 | 95% | 4.0 | 5.0 | 874 |
| 14 | 19 | 100% | 185 | 810 | 315 | 280 | 846 | 40 | 18.0 | 0.0 | 0.0 | 0.0 | 1.0 | 95% | 4.0 | 5.5 | 858 |
| 15 | 20 | 100% | 188 | 853 | 343 | 296 | 900 | 40 | 18.8 | 0.2 | 0.0 | 0.0 | 1.1 | 94% | 4.0 | 6.0 | 939 |

### Hızlı oyuncu (dokunuş 0.4 sn, doğrama 0.16 sn, hata %1.5)

| Gün | Müşteri | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Gider | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 100% | 78 | 262 | 70 | 103 | 229 | 10 | 5.8 | 0.0 | 0.0 | 0.0 | 0.2 | 97% | 2.0 | 0.0 | 267 |
| 2 | 7 | 100% | 91 | 307 | 86 | 115 | 278 | 20 | 6.8 | 0.0 | 0.0 | 0.0 | 0.2 | 98% | 3.0 | 0.0 | 277 |
| 3 | 8 | 100% | 103 | 349 | 100 | 135 | 313 | 20 | 7.8 | 0.0 | 0.0 | 0.0 | 0.2 | 97% | 3.0 | 1.0 | 221 |
| 4 | 9 | 100% | 114 | 397 | 120 | 147 | 370 | 20 | 8.8 | 0.0 | 0.0 | 0.0 | 0.2 | 98% | 3.0 | 1.9 | 192 |
| 5 | 10 | 100% | 125 | 436 | 158 | 159 | 436 | 30 | 9.7 | 0.0 | 0.0 | 0.0 | 0.3 | 97% | 3.0 | 2.0 | 576 |
| 6 | 11 | 100% | 134 | 483 | 181 | 171 | 493 | 30 | 10.7 | 0.0 | 0.0 | 0.0 | 0.3 | 98% | 3.0 | 3.0 | 339 |
| 7 | 12 | 100% | 143 | 524 | 199 | 191 | 533 | 30 | 11.6 | 0.0 | 0.0 | 0.0 | 0.4 | 97% | 3.0 | 3.5 | 436 |
| 8 | 13 | 100% | 151 | 569 | 238 | 203 | 604 | 30 | 12.6 | 0.0 | 0.0 | 0.0 | 0.4 | 97% | 3.0 | 4.0 | 616 |
| 9 | 14 | 100% | 159 | 611 | 273 | 214 | 670 | 30 | 13.6 | 0.0 | 0.0 | 0.0 | 0.4 | 97% | 3.0 | 4.0 | 1255 |
| 10 | 15 | 100% | 166 | 654 | 295 | 226 | 723 | 40 | 14.5 | 0.0 | 0.0 | 0.0 | 0.5 | 97% | 3.0 | 5.0 | 538 |
| 11 | 16 | 100% | 171 | 701 | 321 | 247 | 776 | 40 | 15.6 | 0.0 | 0.0 | 0.0 | 0.4 | 97% | 3.0 | 5.0 | 1274 |
| 12 | 17 | 100% | 176 | 744 | 340 | 258 | 826 | 40 | 16.5 | 0.0 | 0.0 | 0.0 | 0.5 | 97% | 4.0 | 5.0 | 565 |
| 13 | 18 | 100% | 181 | 791 | 362 | 270 | 883 | 40 | 17.6 | 0.0 | 0.0 | 0.0 | 0.4 | 98% | 4.0 | 5.0 | 1397 |
| 14 | 19 | 100% | 184 | 834 | 380 | 282 | 932 | 40 | 18.5 | 0.0 | 0.0 | 0.0 | 0.5 | 98% | 4.0 | 6.0 | 695 |
| 15 | 20 | 100% | 188 | 874 | 453 | 302 | 1025 | 40 | 19.4 | 0.0 | 0.0 | 0.0 | 0.6 | 97% | 4.0 | 6.0 | 1680 |
