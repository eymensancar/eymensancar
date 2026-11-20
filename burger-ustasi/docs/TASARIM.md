# Burger Ustası 2.0: tasarım ve modül sözleşmesi

Bu belge bütün ajanların ortak sözleşmesidir. Her ajan YALNIZ kendi dosyalarına yazar; başka modülün dosyasına dokunmaz. Arayüz (fonksiyon adları, alanlar) burada yazıldığı gibi olmalı; değiştirmek gerekirse son raporda söyle, kendi başına değiştirme.

Oyun: **yatay** iPhone oyunu (21 Kasım'dan beri; aşağıdaki "3. tur" bölümüne bak; önceden dikeydi), saf HTML/CSS/JS, `www/` klasörü, claude.ai artifact'inde ve sonra Capacitor ile iOS. Diller: Türkçe ve İngilizce. Kayıt anahtarı `burgerustasi.v1` (eski kayıt bozulmamalı: `day, coins, stars, up{cook,pat,tip,slot}, lang, seen`).

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

## Ekran düzeni (ESKİ: dikey; 21 Kasım'dan beri yatay, bkz. "3. tur")
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

## 2. tur eklemeleri (Eymen, 20 Kasım)
Bu bölüm yukarıdakilerle çelişirse bu bölüm geçerlidir.

### Başlangıç, hikâye, kira
- **Yeni oyuncu 50 parayla başlar** (`SAVE.coins` yalnız hiç kayıt yoksa 50). Eski kayıtlar etkilenmez.
- ~~**Açılış hikâyesi**~~ **kaldırıldı (Eymen, 21 Kasım).** Eski tarif: (ilk açılışta bir kez; ana menüde "Hikâye" düğmesiyle yeniden izlenir; dokununca geçilebilir): şehirde büyük, gösterişli bir zincir burgerci var (kurgusal ad; gerçek bir markaya benzemeyen bir ad seç). Sahibi kibirli rakip. Kısa sahnelerle: rakip seni/eski küçük dükkânı küçümser ve sokaktan siler → cebinde yalnız 50 para kalırsın → sokağın karşısında küçük, eski bir dükkânı kiralarsın → "Kirayı öde, müşterileri kazan, rakibi geç!" Sahneler kodla çizilir (SVG/CSS animasyonu), karakterler `Musteri.draw` ile (rakip ve kahraman `KARAKTERLER` içinden ya da kendi `m` nesneleriyle), metin TR/EN, ses `BU.SES`. 20–30 sn, 5–7 sahne, her sahnede tek kısa cümle. Emoji yok.
- **Kira:** her gün sonunda kira kasadan düşer (gün sonu kartında ayrı satır). Kira günlere göre yavaş artar. Kira ödenemezse (kasa kiradan azsa) kasa eksiye düşer; eksi kasa ile yeni gün başlar ama malzeme ve geliştirme alınamaz; art arda 3 gün eksi kalırsa "dükkân kapandı" uyarısı ve kasa 50'ye sıfırlanır (satın alınanlar kalır). Kira, ilk günlerde kazancın küçük bir kısmı olmalı; oyuncu ilk 2–3 gün rahat kâr etmeli.

### Malzemeler parayla açılır (güne göre değil)
- Başta açık: ekmek, köfte. Diğer her malzeme **ana menüdeki Dükkân / Tedarikçi** ekranından parayla bir kez satın alınır; alınınca müşteriler onu sipariş etmeye başlar. Kilitli kutularda "Gün N" yerine kilit simgesi ve fiyat.
- **Satış sırası ve yeni malzemeler:** peynir, marul, domates, soğan, turşu, pastırma, yumurta, ardından yeni pahalı malzemeler: sos (ketçap/özel sos), mantar, jalapeño, soğan halkası, avokado ve en son **altın/premium bir malzeme** (ör. trüf soslu, wagyu köfte: karar ekonomi ajanında). Toplam 12–13 satın alınabilir malzeme.
- **Fiyat eğrisi (Eymen'in kesin şartı):** en iyi oyuncu bile **24 saat aralıksız oynasa son malzemeye ulaşamamalı.** İlk birkaç malzeme hızlı gelir (ilk 1–3 gün), sonra aralıklar uzar; ortalar birkaç saatlik oyun, sonlar onlarca saat. Her yeni malzeme menü fiyatını ve bahşişi artırdığı için yatırım hissi vermeli. Denge botu "gerçek oynama saati" (gün başına gerçek dakika) ile ölçer ve tablo verir: her malzemeye kaç saatte ulaşılıyor (yavaş/orta/hızlı).
- Gün zorluğu (müşteri sayısı, sabır, sipariş büyüklüğü) güne göre artmaya devam eder; ama siparişler yalnız **sahip olunan** malzemelerden oluşur.

### Bağlandı (2. tur, 20 Kasım)
- **Ad:** premium malzemenin anahtarı `premium` (çizim: altın taçlı wagyu köfte), TR "Altın Wagyu", EN "Golden Wagyu". Yeni malzemeler: sos/Sauce, mantar/Mushroom, jalapeño/Jalapeño, soğan halkası/Onion rings (tepside kısa ad "Halka"/"Rings"), avokado/Avocado.
- **Kayıt** (`burgerustasi.v1`): yeni alanlar `mal` (dükkânda alınanlar, SATIN_SIRA sırasında), `eksi` (art arda eksi gün), `hikaye` (açılış hikâyesi izlendi mi), `kolay` ({g: gün, n: o gün art arda kayıp}), `yeni` (son günden beri alınanlar: gün başı kartında ve tepside "YENİ"). Hiç kayıt yoksa `coins` = 50. Eski kayıtta `mal` yoksa `VERI.eskiSahip(day)` (1. turda açılmış olanlar kalır). `coins` artık eksi olabilir. Eski kayıtta `hikaye` yok, o yüzden hikâye bir kez gösterilir.
- ~~**Hikâye**~~ kaldırıldı (Eymen, 21 Kasım): `js/hikaye.js` ve `tools/hikaye.html` silindi, ana menüde Hikâye düğmesi yok, `?nostory` yok. Eski tarif: (`js/hikaye.js`): ilk açılışta ana menüden önce; ana menüdeki "Hikâye" düğmesiyle yeniden. `?nostory` açılışta atlar (deneme için). Dükkân kapanınca kartta Bombastik Bey (`BU.HIKAYE.RAKIP`) güler.
- **Dükkân** (ana menüdeki büyük sarı düğme; alınabilir şey varsa kırmızı rozette sayısı): iki sekme. *Malzemeler*: SATIN_SIRA sırasıyla kartlar (simge, ad, "+N menü fiyatına", porsiyon maliyeti, durum: Alındı / Satın al / kilit + fiyat "Önce öncekini al"); yalnız sıradaki alınır; eksi kasada üstte neden yazar, düğme kapalı. Satın alınca kart parlar, sikkeler kasadan karta akar, malzeme alttaki "Tepsin" şeridindeki yerine uçar, `satin` sesi. *Geliştirmeler*: ana menüden **buraya taşındı** (para harcanan tek yer dükkân; ana menü sadeleşti: Oyna, Dükkân, Hikâye).
- **Tepsi:** 15 kutu, 5×3. Kutu boyu `fit()` → `trayFit()` ile ekran yüksekliğinden (en az 46 px, en çok 15cqw); çok yatık ekranda 8+7'ye geçer (kutu ≥46 px kalıyorsa), o da olmazsa sokak biraz kısalır. Kilitli kutuda kilit ve fiyat; dokununca "Ana menüdeki Dükkân'dan alınır".
- **Siparişler** `VERI.siparis(gun, R, SAVE.mal)`, gün ayarı `VERI.gun(d, up, SAVE.mal)`. İlk gün rehberinin siparişi peynir yoksa ekmek + köfte.
- **Kira:** her oynanan günün sonunda (kazanılsın, kaybedilsin) `VERI.gunSonu`; gün sonu kartında ayrı satır (anahtar simgesi `kira`), net kâr kira düşülmüş. Eksi kasada kartta uyarı (n/3 gün); kapanınca ayrı kart. Gün başı kartında bugünün kirası. Eksi kasa üst bilgide ve ana menüde kırmızı. Gün yarıda bırakılırsa (duraklat → ana menü) kira alınmaz.
- **Kolaylaştırma:** aynı gün art arda kaybedilince sonraki denemede sabır her kayıpta +%15 (en çok +%45), gün kazanılınca sıfır; gün başı kartında not, kayıp kartında "sonraki denemede daha sabırlı".
- **Sesler:** `yildiz:1..3` (artan perdeli zil; gün sonu yıldızları), yeni malzemelerin `birak:*` sesleri. Ses bağlamı kullanıcı dokunmadan kurulmaz (konsolda tarayıcı uyarısı olmasın).
- **Simgeler:** `dukkan`, `kira`, `kitap` eklendi.
- Kart ekrandan uzunsa (kısa/yatık ekran) orantılı küçülür (`kartSigdir`); katman artık üstü kesilmeden kaydırılır.

## 3. tur: yatay ekran, hikâye yok (Eymen, 21 Kasım)
Bu bölüm yukarıdakilerle çelişirse bu bölüm geçerlidir.

- **Açılış hikâyesi kaldırıldı.** Oyun doğrudan ana menüyle açılır. Ana menüde yalnız OYNA ve Dükkân. "Dükkân kapandı" kartında Bombastik Bey yok; yerine kepengi inmiş, kilitli dükkân çizimi (kodla, `KEPENK`) ve "Kasa 3 gün art arda ekside kaldı…" yazısı. 50 parayla başlangıç, kira, eksi kasa, dükkân, malzemeler değişmedi. Kayıttaki `hikaye` alanı eski kayıtlarda kalabilir, okunmaz.
- **Oyun yatay.** Renkler, çizimler, simgeler, animasyonlar aynı; yalnız düzen yataya taşındı.
  - **Birim:** `1rem = 10 birim`, birim = min(güvenli yükseklik / 100, güvenli genişlik / 190) (`index.html`, `html{font-size}`). Bütün ölçüler bu birimle; JS'te `cq()` bir birimin px değeri. iPhone'da (19,5:9) yükseklik, iPad'de (4:3) ve bilgisayarda genişlik belirler; ikisinde de boş kenar ya da taşma olmaz, iPad'de fazladan yükseklik sokağa ve tepsiye gider.
  - **Güvenli alan:** `--sl --sr --st --sb` (env() değerleri). Yatay iPhone'da çentik ve ana ekran çubuğu yanlarda: üst bilgi, müşteri sırası, ızgara ve tepsi kutuları bu payların içinde; zemin (gök, tente, tezgâh, tepsi) kenara kadar uzanır.
  - **Düzen (`#app` ızgarası):** üstte boydan boya ince üst bilgi (kasa, gün, gün çubuğu, canlar, ses, duraklat). Solda sokak: tente (CSS çizimi, `g/awning.webp` renkleri), yan yana 3 müşteri, pervaz; altında tezgâh (yüksekliğin ~%36'sı): ızgara (gözler yan yana, 2 ya da 3), iki tabak, çöp. Sağda malzeme tepsisi: 15 kutu, 3 sütun × 5 satır, köfte stok rozetiyle.
  - **Ölçüler `fit()` içinde:** tepsi kutu yüksekliği `--kh` (en az 44 px), satır aralığı `--kg`; ızgara gözü `--gz` (en az 44 px); tabaktaki burgerin genişliği/yüksekliği `OLC` ve `--gen`; müşteri başına `custFit()`: sipariş hücresi (en çok 10 birim) baloncuğa, yüz (17–30 birim) kalan yüksekliğe; dükkân tepsisi `--tkw`.
  - **Sokak sahnesi** 1000×400 birimlik geniş SVG (`sokakCiz`), alttan hizalı.
  - **Kartlar** iki sütunlu (`.card.iki`, `.kol`), düğmeler yan yana (`.btns.yan`); kart yine sığmazsa `kartSigdir` küçültür.
  - **Ana menü:** solda logo ve burger (iki müşteri), sağda OYNA ve Dükkân, altta atıf. **Dükkân:** üstte geri, başlık, sekmeler, kasa; solda kayan liste, sağda "Tepsin" paneli (oyundaki tepsi gibi 3 sütun).
  - **Dik tutulursa** (`orientation: portrait`): "Telefonu yan çevir" ekranı (`#cevir`, kendi dönen telefon çizimimiz, emoji yok); oyun sürüyorsa duraklar (`yonKontrol`). Bilgisayarda dar/uzun pencerede de görünür ("pencereyi genişlet").
- **iOS paketlenince (Capacitor, `ios/` henüz yok):** `ios/App/App/Info.plist` içinde `UISupportedInterfaceOrientations` ve `UISupportedInterfaceOrientations~ipad` yalnız `UIInterfaceOrientationLandscapeLeft` ve `UIInterfaceOrientationLandscapeRight` olacak (Kedi Yuvası'ndaki gibi); `UIRequiresFullScreen` = YES (iPad'de bölünmüş ekranda dik pencere olmasın). Capacitor'da `viewport-fit=cover` zaten var; güvenli alan `env()` ile geliyor.
- **Deneme (yatay):** cihazlar SE 568×320, iPhone 15 852×393 (yan paylar 59, alt 21), Pro Max 932×430, iPad 1024×768 ve 1366×1024, bilgisayar 1280×800 ve 1440×900; ayrıca dik 393×852 ("çevir" ekranı).

## 4. Hedef görünüm: mutfak (Eymen, 21 Kasım)
Referans: `docs/referans/mutfak-gunduz.png` ve `mutfak-aksam.png` (ChatGPT ile üretilmiş taslak; kendisi oyunda kullanılmaz, yalnız yön). Eymen: "Tasarım bu olacak." Görseldeki kaymalar (ızgara vb.) yok sayılır; malzemeler bizim çizimlerimiz olur.
- **Önden bakılan, sıcak bir burger mutfağı:** kırmızı-beyaz damalı fayans duvar, paslanmaz davlumbaz, sarkan lambalar, duvarda neon burger tabelası, raflarda saksı ve paket kutuları, pencereden şehir; gündüz ve akşam ışığı (gün içinde ya da günlere göre değişebilir).
- **Ekmek dolabı** (camlı ısıtıcı, solda): ekmek buradan alınır.
- **Izgara** (ortada, 6 göz): başta 2 göz açık, diğerleri kilitli (asma kilit); geliştirmeyle açılır. Köfteler gözlerde pişer, duman çıkar.
- **Malzeme küvetleri** (paslanmaz, iki sıra): her malzeme kendi küvetinde, içi o malzemeyle dolu görünür; kilitliler kapalı/boş.
- **Soslar** (önde iki kâse, kaşıklı: ketçap, mayonez).
- **Hazırlık tahtası** (önde ortada ahşap kesme tahtası): burger burada yapılır. (Bizde iki tabak vardı; tahtada iki çalışma yeri ya da iki tahta olarak uyarlanır.)
- **Fritöz sepetleri** (sağ önde): ileri seviyelerde **patates kızartması** ve **soğan halkası** açılır; yan ürün olarak pişirilir, sipariş yanında istenir.
- **İçecek makinesi** (sağda, 3 musluk) ileride.
- Müşteriler ve siparişler bu mutfak görünümüyle nasıl birleşeceği uygulama turunda kararlaştırılır.

## 5. Mutfak turu: kararlar ve modül sözleşmesi (Eymen, 21 Kasım)
Bu bölüm öncekilerle çelişirse bu geçerlidir. Referans: `docs/referans/mutfak-gunduz.png`, `mutfak-aksam.png`.
- **Ekran (yatay):** bir kenarda müşteriler (varsayılan: solda dar sütun, sipariş penceresi/tezgâhı; 3 müşteri), kalan büyük alan mutfak. Burger tahtadan müşteriye sürüklenir.
- **Soğan halkası burgerin içine KONMAZ**; yalnız yan ürün. Yan ürünler: **patates kızartması (fries)** ve **soğan halkası (onionring)**: fritöz sepetinde pişer (dokun → pişer → hazır kutusuna geçer), siparişin yanında istenir (ileri seviyelerde, satın alınınca), burgerle birlikte ya da ayrı olarak müşteriye verilir; sipariş tam olmadan (burger + istenen yan ürün) ödeme olmaz/yanlış sayılmaz kuralını ekonomi ajanı netleştirir (öneri: müşteri iki parçayı da alınca öder; sabır sürer).
- **Soslar:** ketçap (`sauce` anahtarı ketçap olur) ve **mayonez (`mayo`, yeni)**: önde iki kâse; burger katmanı olarak eklenir.
- **Küvetler (2 sıra × 6):** üst: lettuce, tomato, pickle, onion, cheese, bacon; alt: mushroom, jalapeno, egg, avocado, premium, (1 boş yer: ileride). Ekmek camlı dolaptan, köfte ızgaradan (pişen köfte ızgarada hazır bekler ya da ızgaranın önündeki hazır tepsisine geçer: çekirdek ajanı ölçerek karar verir; stok sayısı görünür).
- **Izgara 6 göz:** başta 2 açık; `slot` geliştirmesi 4 düzeye çıkar (her düzey bir göz).
- **Hazırlık tahtası:** üstünde iki çalışma yeri (iki burger yan yana); seç→koy aynen.
- Gündüz/akşam: günün ilk yarısı gündüz, ikinci yarısı akşam ışığı (yumuşak geçiş).

### Modüller
- **`www/js/mutfak.js` → `BU.MUTFAK`** (çizim; DOM yok): `ciz({aksam:0..1})` → tek SVG metni (viewBox `0 0 1600 900`, sahnenin sabit arka planı: duvar, davlumbaz, lambalar, neon, raflar, pencere, tezgâh, ekmek dolabı gövdesi, ızgara gövdesi, boş küvetler, sos kâseleri, tahta, fritöz, içecek makinesi). `YER` = aynı koordinatlarda dokunma/yerleşim dikdörtgenleri: `{ekmek, izgara:[6], hazir, kuvet:{anahtar:rect}, sos:{sauce,mayo}, tahta:[2], fritoz:{fries,onionring}, yanHazir:{fries,onionring}, cop, icecek}`. Ayrıca parça çizimleri: `kilit()`, `izgaraGoz(durum)`, `duman()`, `neon(acik)`. Deneme: `tools/mutfak.html`.
- **`www/js/burger.js` (ek):** `KATMAN.mayo`; `onionring` katmanı kaldırılır (KATMAN'dan çıkar; simgesi kalır); `kuvetIci(k)` → küvetin içini dolduran o malzemenin yığını (SVG, 200×120 viewBox, bizim çizgi film biçemimiz, referanstaki gibi dolu görünen); `ekmekDolabi()` içi (raflarda ekmekler); `yan(k, durum)` → fries/onionring: 'cig' sepette, 'pisiyor', 'hazir' kutuda (servis kutusu, üstünde kendi işaretimiz); `sosKase(k)` içi; simgeler `g/s-mayo.svg`, `g/s-fries.svg`.
- **`www/js/veri.js` (ek):** yukarıdaki kuralların ekonomisi (mayo, fries, onionring yan ürün, 6 göz, sipariş yan ürünü, ödeme), denge botu ve DENGE.md.
- **Çekirdek (`index.html`, `oyun.js`)** bunlar bitince bağlanır.

### Bağlandı (mutfak turu, 21 Kasım)
Oyun ekranı artık mutfak görünümü. Bu bölüm yukarıdakilerle çelişirse bu geçerlidir.
- **Düzen** (`oyun.js` → `yerlesim()`, `fit()`): iki biçim, ölçerek seçilir.
  - **Sol** (telefonlar, 16:10 bilgisayar; ekran oranı ≥ 1,45): solda dar **sipariş penceresi** (sokak, ince tente, ahşap kasa; 3 müşteri alt alta, her birinin önünde pervaz), sağda sahne. Sütun genişliği güvenli yüksekliğin %36'sı (116–220 px); sahne kalan genişliğe göre ölçeklenir (852×393'te 0,37 px/birim). Artan yükseklik **duvarın yukarı uzamasıyla** dolar (lamba kabloları, baca uzar); üst bilgi duvarın üstünde, oyun alanına (185. birimin altı) inmez.
  - **Üst** (iPad, 4:3): üstte şerit (üst bilgi + 3 müşteri yan yana, sokak arkada), altında sahnenin tamamı tam genişlikte; şerit duvarın üstüne en çok 120 birim biner. Artan genişlik duvar ve tezgâhın yanlara uzamasıyla dolar.
  - Sahnenin alt kenarı (870. birim) alt güvenli alanın üstünde; tezgâhın ahşap önü aşağı uzar. Hiçbir boyda boş kenar yok.
  - `BU.MUTFAK.ciz({aksam, vb})`: `vb` ile görünür alan 0..1600×0..900'ün dışına uzar (mutfak.js'e eklendi).
- **Sahne çizimi bir kez:** gündüz ve akşam iki `<img>` (blob SVG), akşam katmanının saydamlığı günün müşteri ilerlemesiyle (%40'tan sonra, yumuşak, 4 sn geçiş). Küvet içleri, ekmek dolabı, sos kâseleri, fritöz sepetleri, kutular, ızgara gözü durumları da `<img>` (önbellekli); her karede hiçbir şey yeniden çizilmez.
- **Canlı katmanlar** (`#ic`, YER yüzdeleriyle; dokunma kutusu çizimin çevresindeki boşluğun yarısı kadar büyür, `HIT`): ekmek dolabı (dokun → ekmek seçilir), 6 ızgara gözü (açılma sırası alt sıra soldan sağa, sonra üst sıra; kilitlide "Dükkân'dan açılır"), **hazır köfte tepsisi** (ızgaranın sağ ucu; pişen köfte buraya uçar, üst üste en çok 6, ×N rozeti; dokun → köfte seçilir), 11 küvet (sahip olunmayanlarda kapak + fiyat), 2 sos kâsesi (kaşıklı; yoksa kilit + fiyat), tahtada 2 çalışma yeri (boşken kesik halka; yığın tahtanın üstünde yükselir, en çok 270 birim, gerekirse sıkışır), fritöz (sepete dokun → çiğ → pişiyor → hazır kutusuna uçar, en çok 3), yan ürün hazır tepsileri (kutuyu sürükle ya da dokun-seç → müşteriye dokun), çöp (bırakma hedefi). İçecek makinesi süs.
- **Teslim** `VERI.teslimParca`: 'parca' → baloncukta verilen parça soluklaşır, sabır %15 dolar, yeşil "alındı"; 'tamam' → ödeme ve eski efektler; 'yanlis' → damga, sarsıntı, kırık kalp. Sipariş `VERI.siparisTam`, baloncuk `BURGER.siparis(katmanlar,{yan, alindi, sutun, enAzSutun})` (`sutun`, `enAzSutun` burger.js'e eklendi: dar baloncukta sütun sayısı ölçülerek seçilir).
- **Müşteri yeri** (`custFit`): yüz solda + baloncuk sağda ya da baloncuk üstte + yüz altta; simge hücresi ve yüz boyu birlikte puanlanıp en iyisi seçilir. Yüzün alt %22'si (omuzlar) pervazın arkasında.
- **Dükkân:** 15 ürün, her kartta tür etiketi (Burger / Yan ürün). "Tepsin" paneli **"Mutfağın"** oldu (17 şeyin hepsi, yan ürünler sarı çerçeveli). Geniş ızgara açıklaması bir sonraki gözü söyler ("4. ızgara gözü"; tamamsa "6 göz açık").
- **Rehber:** Dolaptan ekmeği al → Tahtaya dokun → Izgaraya dokun → (pişiyor) → Hazır köfteyi al → Tahtaya dokun → (Peyniri al → Tahtaya dokun) → Dolaptan ekmekle kapat → Burgeri müşteriye sürükle. İpucu balonu hedefin üstünde, yer yoksa altında.
- **Test kancası** ek: `fritoz(k)`, `yanSec(k)`, `yanVer(k, müşteriYeri)`, `yanCope(k)`, `LAY` (düzen, ölçek), `MK()` (öğeler), `aksamGuncelle`, `hazirCiz`, `yanCiz`, `buildMutfak`. `teslim(tahta, müşteriYeri)` aynı.
- **Bilinen sınır:** iPhone SE (568×320, en dar) sahne 0,28 px/birim: küvet ve ızgara gözü dokunma kutuları ~34 px (44 pt altında). Sahnenin tamamı genişliğe sığmak zorunda olduğundan daha büyütülemedi.
