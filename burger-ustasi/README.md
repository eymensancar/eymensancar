# Burger Ustası (çalışma adı)

Dikey oynanan, hafif yukarıdan bakılan sipariş oyunu: müşteriler tezgâha gelir, baloncuktaki burgeri aynı sırayla hazırlarsın (ekmek → ızgarada köfte → malzemeler → ekmek). Saf HTML/CSS/JS, tek dosya: `www/index.html`, görseller `www/g/`. Şimdilik claude.ai artifact'inde geliştiriliyor.

- **Akış:** ekmek → malzemeler (sıra serbest) → ekmekle kapat → burgeri **müşteriye sürükle**. Köfte ızgarada pişer, pişince tepsideki Köfte kutusuna geçer. İki tabak, çöp, sabır çubuğu, üç can.
- **Ekonomi (2. tur, 20 Kasım):** yeni oyuncu **50 parayla** başlar, yalnız ekmek ve köfte açık. Öbür 13 malzeme (peynir … avokado, en son **Altın Wagyu**) ana menüdeki **Dükkân**'dan **parayla, sırayla** alınır; müşteriler yalnız sahip olunan malzemeleri ister. Her gün sonunda **kira** düşer; kasa eksiye düşebilir, eksi kasayla alışveriş yok, 3 gün art arda eksi kalırsa dükkân kapanır (kasa 50, malzemeler kalır). Geliştirmeler de dükkânda. Ayrıntı ve denge tabloları `docs/DENGE.md`.
- **Hikâye:** ilk açılışta kısa açılış hikâyesi (rakip Bombastik Burger); ana menüdeki "Hikâye" ile yeniden izlenir.
- **Kayıt:** `localStorage` anahtarı `burgerustasi.v1` (eski kayıtlar korunur; eski oyuncu açtığı malzemeleri kaybetmez). Diller: Türkçe ve İngilizce (`js/oyun.js` içinde `T`).
- **Test kancası:** `index.html?debug` → `window.__bu` (`startDay`, `bitir`, `openShop`, `malAl`, `upAl`, `hikaye`, `SAVE`…); `?nostory` açılış hikâyesini atlar.
- **Dosyalar:** `www/index.html` (düzen, CSS), `www/js/oyun.js` (oynanış, ekranlar, dükkân), `js/veri.js` (ekonomi), `js/burger.js` (burger ve malzeme çizimi), `js/simge.js` (simgeler), `js/ses.js` (ses sentezi), `js/hikaye.js` (açılış hikâyesi), `musteri.js` + `karakterler.js` (müşteri yüzleri). Tasarım sözleşmesi `docs/TASARIM.md`, denge botu `scripts/denge.mjs`.

## Görseller (itch.io)
- Yiyecekler, tente, yıldız: **Food Icon Pack, Bluc** (https://bluc.itch.io/food-icon-pack). Ticari kullanım serbest, **atıf zorunlu** ("Icons by Bluc"; oyunda ana ekranın altında yazıyor, mağaza açıklamasına da eklenecek). Paketi olduğu gibi yeniden dağıtmak yasak: depoda yalnız oyunun kullandığı küçültülmüş görseller var.
- Müşteriler: **200 elle ayarlanmış karikatür insan**, kodla çizilir, telif bizim. Üretici `www/musteri.js` (parçalar, 6 duygu: happy, wait, imp, angry, love, sad), karakterler `www/karakterler.js` (birlestir.cjs üretir). Kaynak ve araçlar `tools/musteri/` (KILAVUZ.md, ciz.cjs, kontrol.html); her karakter `tools/musteri/karakterler/NNN.json`. Oyunda yüz sabra göre değişir: gelince mutlu, sonra bekliyor, yarı sabırda sabırsız, çeyrekte kızgın; doğru burgerde bayılır, kaçarsa üzgün gider; yanlış burgerde bir an kızar. Eski BITTI Studio görselleri (lisansı belirsizdi) çıkarıldı (20 Kasım).
- Yazı tipi: **Baloo 2** (Ek Type), SIL Open Font License 1.1; `www/fonts/` (woff2, @fontsource paketinden, Sayı Yolu'ndan kopyalandı), `www/fonts/fonts.css`. OFL: ücretsiz, oyunla birlikte dağıtılabilir; yazı tipi tek başına satılamaz.
- Ekmek, peynir ve köfte simgeleri de kendi çizimimiz (`g/bun.svg`, `cheese.svg`, `patty.svg`, `raw.svg`): açık renk ekmek, sarı cheddar, yuvarlak köfte.
- Tabaktaki burger katmanları (yandan görünüş) kodla çizildi (`SV` içindeki SVG'ler); itch.io'da uygun, ücretsiz, yandan görünen parça parça çizgi film burger seti bulunamadı.
- Siparişler baloncukta malzeme simgeleri olarak görünür (ekmek ve köfte dahil); sıra önemli değil, malzemeler tutmalı.
