# Burger Ustası 2.0: tasarım ve modül sözleşmesi

Bu belge bütün ajanların ortak sözleşmesidir. Her ajan YALNIZ kendi dosyalarına yazar; başka modülün dosyasına dokunmaz. Arayüz (fonksiyon adları, alanlar) burada yazıldığı gibi olmalı; değiştirmek gerekirse son raporda söyle, kendi başına değiştirme.

Oyun: dikey iPhone oyunu, saf HTML/CSS/JS, `www/` klasörü, claude.ai artifact'inde ve sonra Capacitor ile iOS. Diller: Türkçe ve İngilizce. Kayıt anahtarı `burgerustasi.v1` (eski kayıt bozulmamalı: `day, coins, stars, up{cook,pat,tip,slot}, lang, seen`).

## Kesin kurallar (Eymen)
- **Hiç emoji yok.** Para, can, duraklat, çöp, ateş, kum saati, kese, yıldız, kilit, ses, ev, tekrar… her simge kendi SVG'miz (`js/simge.js`). Metinde de emoji yok.
- **Küsurat yok.** Bütün fiyatlar, bahşişler, kasa tam sayı.
- Dış kaynak (görsel, ses, yazı tipi) yalnız ücretsiz ve telifsiz ise; tercihen kendi çizimimiz/sentezimiz. İnternetten bir şey eklenirse lisansı `README.md`'ye yazılır.
- Ses kuralı: whoosh/swoosh, hava süpürmesi gibi filtreli gürültü süpürmesi YOK. Izgara cızırtısı gibi kısa sabit gürültü olur.
- Müşteri yüzleri `www/musteri.js` + `www/karakterler.js` (200 elle ayarlanmış karakter). Bu iki dosyaya dokunulmaz. `Musteri.draw(k.m, duygu)` → SVG metni; duygular: `happy wait imp angry love sad`.

## Oynanış
1. **İki tabak** her zaman tezgâhta (tabak 1, tabak 2). Oyuncu tabak koymaz/almaz; tabaklar sabit.
2. **Seç → koy:** alttaki malzeme tepsisinde bir kutuya dokunulur → o malzeme **seçilir** ("avuçla aldı" hissi: kutudaki malzeme simgesinden bir parça yukarı kalkar, hafif büyür, gölgesi düşer, kutu basılı/parlak kenarlı görünür, küçük "kap" sesi). Sonra bir tabağa dokunulur → malzeme o tabaktaki yığının üstüne düşer (düşme animasyonu + ses). Seçim **kalır** (aynı malzemeden art arda koyulabilir); aynı kutuya tekrar dokununca ya da başka kutuya dokununca seçim değişir/kalkar.
   - Ekmek: tabak boşsa alt ekmek, doluysa üst ekmek olarak konur. Üst ekmek konmuş tabağa malzeme konmaz (kısa uyarı).
   - Ekmeksiz tabağa malzeme konmaz: "Önce ekmek!" (ekmek ilk katman olmalı).
   - Bir tabakta en çok 10 katman.
3. **Izgara:** ızgara gözüne dokununca çiğ köfte konur ve pişer (süre `VERI.pisme(up)`), maliyeti o an kasadan düşer. Pişen köfte **kendiliğinden alttaki tepsideki "Köfte" kutusuna** geçer; kutuda sayı rozeti (×3) görünür. Köfte kutusu boşsa sönük ve "0". Köfte kutusu da öbür malzemeler gibi seçilir ve tabağa konur. Ayrı "Hazır" rafı YOK. Köfte stoku en çok 6; doluysa pişen köfte ızgarada bekler (göz parlar).
4. **Teslim = sürükle-bırak:** tabaktaki yığına (en az bir katman) parmakla basılı tutup sürükle → yığın parmağı izleyen bir "hayalet" olur (gölgeli, hafif büyük). Bir müşterinin üstüne bırakınca teslim edilir (doğru ya da yanlış, ne olursa). Müşteri dışında bırakılırsa yığın tabağına geri uçar. Sürüklerken altında bulunan müşteri vurgulanır.
   - Yarım burger, yalnız ekmek… her şey verilebilir; siparişe uymuyorsa YANLIŞ.
   - Doğru = alt ekmek + siparişteki malzemelerin tam aynısı (sayılarıyla, sıra önemsiz) + üst ekmek.
5. **Çöp:** tabaktaki yığın çöp kutusuna sürüklenip bırakılırsa atılır (para geri gelmez).
6. **Sabır çubuğu:** her müşterinin baloncuğunun altında. Dolu başlar, zamanla azalır; rengi **sürekli gradyan**: yeşil (#3cc45a) → sarı (#f2c230) → turuncu → kırmızı (#e5322b), doluluk oranına göre (aşamalı değil, kesintisiz).
7. **Ruh hâli (doluluk f'ye göre):**
   - f > 2/3 → **mutlu** (yüz `happy`)
   - 2/3 ≥ f > 1/3 → **somurtkan** (yüz önce `wait`, f ≤ 0,5'te `imp`)
   - f ≤ 1/3 → **kızgın** (yüz `angry`)
   - f = 0 → kızgın, yemeği almadan gider (yüz `sad` değil `angry` ile çıkar), **bir can** gider.
8. **Ödeme (teslimde):**
   - Doğru + mutlu → menü fiyatı + **bahşiş**. Uçan yazı yeşil: `+fiyat` ve ayrı `+bahşiş` (bahşiş ayrı, daha parlak yeşil, "bahşiş"/"tip" küçük yazısıyla). Yüz `love`, para sesi + zil.
   - Doğru + somurtkan → yalnız menü fiyatı. **Hiç efekt yok** (yalnız kasa sayısı artar, sade para sesi). Yüz `wait`→ teşekkürsüz gider.
   - Doğru + kızgın → **ödemez.** Kırmızı uçan yazı: `−maliyet` (o burgerin malzeme maliyeti; zarar). Yüz `angry`, homurtu sesi.
   - Yanlış (her ruh hâlinde) → **ödemez**, kızar, gider; kırmızı `−maliyet`; **bir can** gider.
   - 3 can gidince gün kaybedilir.
9. **Kasa:** gün başında `SAVE.coins`. Malzeme tabağa konunca, köfte ızgaraya konunca maliyeti kasadan düşer (küçük kırmızı `−2` tabakta/ızgarada kısa görünür; çok kalabalık olmasın: 0,6 sn, küçük). Kasa eksiye düşebilir (kırmızı görünür). Gün sonunda `SAVE.coins = max(0, kasa)`.
10. **Gün:** müşteri sayısı, gelme aralığı, aynı anda en çok kaç müşteri (2–3), sabır süresi, sipariş büyüklüğü güne göre (`VERI.gun(d)`). Yeni malzemeler belirli günlerde açılır (eskisi gibi: 1 peynir, 2 marul, 3 domates, 5 soğan, 7 pastırma, 9 yumurta, 11 turşu). Gün sonu kartı: gelir, gider, net kâr, bahşiş, mutlu/somurtkan/kızgın sayıları, yıldız (3 − kaçan/yanlış sayısı; en az 1 ile kazanılır).
11. **Geliştirmeler** (ana menü, eskisi gibi): hızlı ızgara, sabırlı müşteri, cömert bahşiş, 3. ızgara gözü. Simgeleri kendi SVG'miz.
12. **İlk gün rehberi:** sıradaki doğru hamleyi parlatır ve kısa yazı gösterir (ekmeği seç → tabağa dokun → ızgaraya dokun → köfteyi seç → tabağa dokun → peynir… → ekmekle kapat → burgeri müşteriye sürükle). Rehberde müşteri çok sabırlı.

## Ekran düzeni (dikey, en çok 540 px genişlik; ölçüler cqw)
Yukarıdan aşağı: üst bilgi (kasa, gün, canlar, ses, duraklat) → gün ilerleme çubuğu → sokak/tente altında **3 müşteri yeri** (baloncuk: sipariş simgeleri + sabır çubuğu; altında yüz) → tezgâh: solda **ızgara** (2–3 göz), ortada **iki tabak** yan yana, sağda **çöp** → altta **malzeme tepsisi** (ekmek, köfte (stok rozeti), peynir… 10 kutu; 5×2 ızgara; kilitliler "Gün N"). Her dokunma alanı en az 44×44 pt. iPhone SE (320×568) ile Pro Max (430×932) ve iPad (büyütülmüş) arası bozulmadan sığmalı; çentik ve alt çubuk güvenli alan.

## Modüller ve dosyalar (her biri bir ajanın)
Genel ad alanı: `window.BU = window.BU || {}`. Her dosya kendi alt nesnesini tanımlar. Yükleme sırası `index.html`'de: musteri.js, karakterler.js, js/veri.js, js/simge.js, js/ses.js, js/burger.js, js/oyun.js.

### A. `www/js/veri.js` → `BU.VERI` (ekonomi ve denge; DOM yok, Node'da da çalışır: sonda `if(typeof module!=='undefined')module.exports=BU.VERI`)
- `MALZEME`: dizi `{k, gun, maliyet}`; k ∈ `bun patty cheese lettuce tomato onion bacon egg pickle`. Maliyetler tam sayı, gerçekçi oran (köfte en pahalı; marul/soğan/turşu en ucuz, en ucuzu 1). Ekmek maliyeti alt ekmek konunca bir kez alınır (üst ekmek bedava ya da yarısı; tam sayı kalsın).
- `acik(gun)` → o gün açık malzeme anahtarları (bun ve patty her zaman).
- `maliyet(katmanlar)` → tam sayı (katmanlar: `['bunBot','patty','cheese','bunTop']` biçimi).
- `fiyat(siparis, up)` → müşterinin ödediği menü fiyatı (tam sayı; maliyetin yaklaşık 2–2,5 katı, yuvarlak sayılar tercih).
- `bahsis(siparis, f, up, seri)` → tam sayı ≥1 (mutlu teslimde). f: kalan sabır oranı; seri: art arda mutlu teslim sayısı.
- `ruh(f)` → `'mutlu'|'somurtkan'|'kizgin'`; `yuz(f)` → `'happy'|'wait'|'imp'|'angry'` (yukarıdaki eşikler).
- `dogruMu(siparis, katmanlar)` → bool.
- `odeme(siparis, katmanlar, f, up, seri)` → `{dogru, ruh, ucret, bahsis, kayip, can}`: ucret ödenen menü fiyatı (0 olabilir), bahsis, kayip (kızgın/yanlışta gösterilecek maliyet), can (1 ise can gider).
- `gun(d, up)` → `{musteri, aralik:[min,max] sn, sira (aynı anda en çok), sabir (sn, siparişe göre artar: sabirSiparis(siparis)), ekstra:[min,max]}`.
- `siparis(gun, rastgele)` → `['bunBot', ...ortadakiler, 'bunTop']` (ilk günlerde köfte hep var; aynı malzeme iki kez olabilir ileride, ör. çift köfte, gün ≥ 6).
- `pisme(up)` → köfte pişme süresi (sn). `STOK_MAX = 6`.
- `GELISTIR`: `{cook:{max,cost(l)}, pat:{...}, tip:{...}, slot:{...}}` (eski değerlere yakın).
- Denge botu: `scripts/denge.mjs` (Node): üç beceri düzeyinde (yavaş, orta, hızlı oyuncu: her hamle süresi) 1–15. günleri simüle eder; gün başına gelir, gider, kâr, kaçan, mutlu oranı yazar. Hedef: orta oyuncu her günü kazanır, mutlu oranı %40–60; yavaş oyuncu ilk 5 günü kazanır; kâr günlere göre artar; geliştirmeler 2–3 günde bir alınabilir. Rapor `docs/DENGE.md`.

### B. `www/js/simge.js` → `BU.SIMGE`
- `BU.SIMGE.svg(ad, sinif='')` → `<svg class="ic ${sinif}" viewBox="0 0 48 48" aria-hidden="true">…</svg>` metni. Biçem: oyunla aynı çizgi film (kalın koyu çizgi #2a1a10, düz canlı renk, küçük parlama), 24–48 px'te okunur.
- Gerekli adlar: `para` (altın sikke, üstünde kendi işaretimiz), `kasa` (yazar kasa), `can`, `can_bos`, `duraklat`, `oynat`, `ses_acik`, `ses_kapali`, `muzik`, `cop`, `ates` (hızlı ızgara), `kumsaati` (sabır), `kese` (bahşiş), `izgara` (3. göz), `yildiz`, `yildiz_bos`, `kilit`, `ev`, `tekrar`, `ileri`, `tik`, `carpi`, `gulen`, `somurtkan`, `kizgin` (gün sonu sayaçları için küçük yüz simgeleri), `dil` (TR/EN), `el` (rehber için işaret eden el), `artı`.
- `BU.SIMGE.ADLAR` dizi. Deneme sayfası `tools/simge.html` (hepsi yan yana, 24/48/96 px).

### C. `www/js/ses.js` → `BU.SES` (Web Audio sentezi, dosya yok)
- `BU.SES.ac()` (ilk dokunuşta; iOS kilidi), `BU.SES.cal(ad)`, `BU.SES.muzik(acik:boolean)`, `BU.SES.ayar({efekt:bool, muzik:bool})`, `BU.SES.durdur()`.
- Adlar: `sec` (malzemeyi avuçla: yumuşak "pop"), `birak` (tabağa düşme: tok "tup", malzemeye göre hafif farklı perde: `birak:bun`, `birak:patty`… bilinmeyen alt ad sessizce varsayılana döner), `izgara` (çiğ köfte cızırtısı, kısa), `pisti` (ding), `al` (yığını parmağa alma), `geri` (yığın tabağa geri döner), `teslim_mutlu` (kasa "ka-ching" + parlak zil), `teslim_normal` (sade kasa), `teslim_kizgin` (homurtu: alçak, kısa), `yanlis`, `kacti`, `cop`, `uyari` (kısa "tık-tık"), `gun_basla`, `gun_bitti` (kısa zafer), `gun_kayip`, `tik` (düğme), `satin` (geliştirme), `can_gitti`.
- Müzik: neşeli, hafif, döngüsel bir dükkân müziği (sentez, ~16 ölçü döngü), sabit ses seviyesi, efektlerden kısık. `muzik(false)` yumuşak susar.
- Deneme sayfası `tools/ses.html` (her ses için düğme).

### D. `www/js/burger.js` → `BU.BURGER` (çizim; DOM yok, metin döndürür)
- `KATMAN`: eski `SV` katmanları (index.html'deki `SV` nesnesi: bunBot, patty, cheese, lettuce, tomato, onion, bacon, egg, pickle, bunTop; 200 birim genişlik). İyileştirilebilir ama aynı biçem.
- `yigin(katmanlar, {gen, yukMax})` → HTML metni: katmanlar alttan üste; toplam yükseklik `yukMax`'ı aşarsa katmanlar orantılı küçülür/üst üste daha çok biner, **asla taşmaz, asla birbirine kötü binmez**. `gen` ve `yukMax` CSS uzunluk dizesi (ör. `'28cqw'`) ya da px sayısı. Son eklenen katman `.yeni` sınıfı alır (düşme animasyonu oyun tarafında).
- `siparis(katmanlar, {gen})` → baloncuk içi HTML: malzeme simgeleri (ekmek ve köfte dahil; aynı malzeme ikiyse ×2 rozeti ya da iki simge). Simge sayısı 2–10 arasında; ızgara düzeni sayıya göre (2→1×2, 3–4→2×2, 5–6→3×2, 7–9→3×3, 10→4×3…), simgeler sığacak kadar küçülür, **üst üste binmez**, baloncuk genişliği müşteri yerini aşmaz (`gen`).
- `simge(k)` → tepsi ve sipariş için malzeme görseli HTML'i (`<img src="g/….webp">` ya da kendi SVG'miz: bun, cheese, patty, raw kendi SVG'lerimiz `g/*.svg`).
- Deneme sayfası `tools/burger.html`: 1–10 katmanlı yığınlar farklı boyutlarda, 2–10 malzemeli siparişler.

### E. `www/index.html` + `www/js/oyun.js` → oynanış, arayüz, ekranlar (çekirdek)
- index.html: yalnız düzen, CSS ve script etiketleri. Bütün mantık `js/oyun.js`.
- Yukarıdaki oynanışın tamamı: iki tabak, seç→koy, köfte stoğu, sürükle-bırak (Pointer Events; `touch-action:none` sürüklenen alanlarda; çoklu dokunuşa dayanma), çöp, sabır gradyanı, ruh hâli ve yüzler, ödeme ve uçan yazılar (yeşil +, kırmızı −; somurtkanda efekt yok), kasa, canlar, gün akışı, gün sonu kartı, ana menü, geliştirmeler, dil, ses düğmeleri (efekt/müzik), duraklat, ilk gün rehberi.
- Modüllerden: `BU.VERI`, `BU.SIMGE`, `BU.SES`, `BU.BURGER`. Modüller henüz yoksa geçici yedekle çalışmalı (`BU.SES||{cal(){}}` gibi) ama son hâlde gerçek modüller kullanılır.
- Test kancası: `index.html?debug` → `window.__bu = {S, SAVE, VERI, startDay, sec(k), koy(tabak), teslim(tabak, musteriYeri), izgara(i), bitir(win)}`.
- Kayıt: eski alanlar korunur; yeni alanlar (`ayar:{efekt,muzik}`) varsayılanla eklenir.
