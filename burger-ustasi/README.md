# Burger Ustası (çalışma adı)

**Yatay** oynanan burger mutfağı oyunu. 21 Kasım'dan beri (7. tur) **Eymen'in çizdirdiği resim oyunun kendisi**: `docs/referans/mutfak-v3-eymen.png` arka plandır, değişen her şey (hazneler, ızgaradaki köfte, fritözdeki patates, açılan ızgaralar, sipariş ekranı, burger, tepsiler, müşteriler) aynı resmin parçalarıyla üstüne konur. Saf HTML/CSS/JS, giriş `www/index.html`, görseller `www/g/v3/`. Şimdilik claude.ai artifact'inde geliştiriliyor.

- **Akış:** açık ızgaraya dokun → köfte 8 sn pişer, kendiliğinden köfte haznesine uçar (en çok 6). Çiğ patatese 10 kez dokun → doğranır, kendiliğinden fritöze girer, 15 sn kızarır, fritöze dokununca patates haznesine geçer (4 porsiyon; fritöz doluyken doğrama yok). Malzemeye dokun → tezgâhtaki burgere konur (önce alt ekmek, en son üst ekmek). Biten burgere dokun → tepsiye dokun; patates haznesine dokun → tepsiye dokun; tepsiye dokun → müşteriye dokun. Herkes aynı şeyi ister: turşulu peynirli burger + patates (45 para). Ayrıntı `docs/TASARIM.md` → "7. tur".
- **Ekonomi:** 50 parayla başlangıç, kira, eksi kasa ve kapanış, sabır, ödeme kuralları eskisi gibi. Dükkânda resimdeki 2 kilitli ızgara ve geliştirmeler (hızlı ızgara, sabırlı müşteri, cömert bahşiş). Sonraki malzemeler için fiyat önerisi ve tablolar `docs/DENGE.md`, bot `scripts/denge.mjs`.
- **Kayıt:** `localStorage` anahtarı `burgerustasi.v1` (eski kayıtlar korunur; eski malzemeler `mal` alanında durur, ızgara geliştirmesi kilitlere çevrilir). Diller: Türkçe ve İngilizce (`js/oyun.js` içinde `T`).
- **Test:** `index.html?debug` → `window.__bu` (`startDay`, `basla`, `dokun(alan)`, `musteri(i)`, `durum()`, `hit(alan)`, `openShop`, `upAl`, `fit`, `LAY`, `S`, `SAVE`…). Akış testi ve ekran görüntüleri: `node scripts/test-akis.cjs` (Playwright; iPhone 15, SE, iPad, Pro Max; çıktı `docs/inceleme/v3/`). Kenar uyumu ve dokunma alanları da orada denetlenir.
- **Dosyalar:** `www/index.html` (düzen, CSS, müşteri gölge süzgeci `#musGolge`), `www/js/oyun.js` (oynanış, ekranlar, dükkân, ekran uyumu), `js/veri.js` (ekonomi), `js/simge.js` (simgeler), `js/ses.js` (ses sentezi), `musteri.js` + `karakterler.js` (müşteriler). Görselleri üreten betik `tools/mutfak-v3/hazirla.py` (opencv-python-headless, numpy, Pillow): resmin kenarlarını uzatır, boş küvetleri, açılmış ızgaraları, boş göstergeyi ve sipariş ekranını resmin kendi pikselleriyle yamar, burger katmanlarını resimden kırpar.

## Görseller
- **Mutfak:** Eymen'in resmi (`docs/referans/mutfak-v3-eymen.png`, 1852×849). Oyundaki her mutfak görseli bu resimden türetildi (`www/g/v3/`); tahta ve tepsi kodla, resmin biçeminde çizildi.
- **Müşteriler:** 200 elle ayarlanmış karikatür insan, kodla çizilir, telif bizim (`www/musteri.js`, `www/karakterler.js`; kaynak `tools/musteri/`). Yüz ve saçlar değişmedi; sahnede gölgeli (sıcak ışık, yumuşak gölge, kontur) çizilir. Duygular: mutlu, bekliyor, sabırsız, kızgın, bayıldı, üzgün.
- Eski Bluc (itch.io) yiyecek görselleri ve kendi SVG malzeme çizimlerimiz artık kullanılmıyor, depodan çıkarıldı (git geçmişinde duruyor); atıf gerekmiyor.
- Yazı tipi: **Baloo 2** (Ek Type), SIL Open Font License 1.1; `www/fonts/`.

## Artifact'e giden dosyalar
`index.html` ve yanında: `musteri.js`, `karakterler.js`, `js/veri.js`, `js/simge.js`, `js/ses.js`, `js/oyun.js`, `fonts/fonts.css`, `fonts/*.woff2` (4 dosya), `g/v3/*.webp` (25 dosya).
