# Açık Dünya Denemesi

Üç boyutlu, arkadan bakışlı (üçüncü şahıs) açık dünyada yürüme denemesi. Telefon için, hep yatay. Oyun fikri `docs/FIKIR.md` içinde (açık dünyada gitgide gelişme); şimdilik yalnız dünya ve hareket kalitesi. Klasör adı `sehir` ilk denemeden kaldı. Çizim tarzı "mürekkep + düz renk" (Two Beeps animasyonunun kalemi), ama o dizinin ya da Yıkım Ustası'nın hiçbir karakteri, mekânı ve öğesi burada **yok** (Eymen, 16 Kasım 2026).

## Eymen'in kuralları
- Sıradan bir insan. İnşaat alanı, çatlak bina, vinç, dizi karakteri yok.
- Dünya şehir değil: biyom biyom açık harita (çayır, orman, çöl, karlı dağ, kızıl diyar); her biyomun gelişmişlik seviyesi ileride farklı olacak.
- Ekrandaki "tozlu" kâğıt greni filtresi yok.
- Ağaç, lamba gibi nesneler gerçek 3B.
- Hareketler çok gerçekçi olmalı (koşma, zıplama, dönme, her olasılık).
- Sesler gerçek kayıt (ücretsiz, lisansı açık kaynaklardan). Sentez "bip" sesi yok. **Hava/süpürme (whoosh, swoosh) sesi hiçbir yerde kullanılmaz.**
- Oyun hep yatay açılır; telefonun dönme kilidine bağlı değildir (ekran dikeyse sahne 90° döner).

## Dosyalar
| Dosya | İş |
|---|---|
| `index.html` | sayfa, düğmeler, betik sırası |
| `lib/` | three.js r128 ve GLTFLoader (yerel kopya) |
| `kalem.js` | çizim kalemi (Canvas 2B; `Cizim.shape/line/blot/...`). Yalnız dokuları çizmek için |
| `cekirdek.js` | `SO` ad alanı: yardımcılar, `SO.ps` (oyuncu durumu), `SO.input`, `SO.tune`, `SO.anim` (katman kaydı) |
| `arazi.js` | açık dünya: biyomlu ada (yükseklik ızgarası, biyom ağırlıkları, ağaç/kaya/kaktüs/kristal), deniz; `SO.world` (zemin yüksekliği, çarpışma, zemin türü, biyom, ortam sesi düzeyi, bölge gizleme) |
| `gorunum.js`, `doku/` | görünüm: arazi gölgelendiricisi (biyom ve eğime göre doku karışımı), nesne malzemesi, çim tutamları, su, gök; dokular CC0 (`doku/LISANS.md`); `SO.gorunum`, ayarlar `SO.tune.gorunum` |
| `karakter.js` | model + hareket klipleri + çizgi film boyama; `SO.char` |
| `fizik.js` | hız, yerçekimi, zıplama anı, çarpışma |
| `kamera.js` | kamera; `SO.cam` |
| `ses.js`, `ses/` | sesler; `SO.ses` |
| `anim/*.js` | hareket katmanları (aşağıda) |
| `harita.js` | küçük harita, tam harita, keşif sisi; `SO.harita` |
| `toplama.js` | yerdeki toplanabilir nesneler (dal, taş), AL düğmesi, sayaç, kayıt; `SO.toplama`, `SO.envanter` |
| `oyun.js` | oyun çekirdeği: can, açlık, seviye, teknoloji puanı, eşyalar, tarifler, teknoloji ağacı, el yuvaları (eldeki alet), vurma (kesme/kazma), kayıt; `SO.oyun`, `SO.oyuncu`, `SO.esya`, `SO.tarifler`, `SO.teknoloji`, `SO.eller`. Sözleşme `docs/OYUN_API.md` |
| `ana.js` | sahne, girdi, hep yatay ekran, döngü |
| `model/` | modeller, `LISANS.md`, `KLIPLER.md` |
| `test/cek.cjs` | başsız tarayıcıda sabit adımla çalıştırıp kare alan araç |

## Kare sırası (`ana.js` → `step(dt)`)
1. Girdi → `ps.wantX/wantZ/wantMag/wantRun` (kameraya göre istenen yön).
2. `SO.fizik.update(dt)`: hız, konum, yer/hava.
3. `SO.anim.update(dt)`: katmanların `update(ctx, dt)` → `mixer.update(dt)` → katmanların `post(ctx, dt)`.
4. Kök düğüm: konum `(ps.x, ps.y + ps.rootDy, ps.z)`, dönüş (YXZ) `(ps.leanFwd, ps.yaw, ps.lean)`.
5. `SO.kamera.update(cam, dt)`, `SO.ses.update(dt)`, `SO.harita.update(dt)`, `SO.toplama.update(dt)`, çizim.

## Hareket katmanları
Her katman tek dosyadır ve `SO.anim.register({ name, order, init(ctx), update(ctx, dt), post(ctx, dt) })` ile eklenir. `order` küçük olan önce çalışır.

`ctx`: `char, mixer, action(ad), bones, clips, ps, input, tune, world, time`.
- `ctx.action('Jog_Fwd_Loop')` klibin oynatıcısını verir: ağırlık 0 ile oynar durumda başlar; ağırlığı (`setEffectiveWeight`), zamanı (`.time`) ve hızı (`.timeScale`) katman yönetir.
- `update` içinde ağırlık/zaman ayarlanır. `post` içinde kemiklere elle dokunulur (mixer o karede kemikleri yazdıktan sonra): `bones.spine_02.quaternion.multiply(...)` gibi. `post`ta yapılan değişiklik bir sonraki karede mixer tarafından sıfırlanır, yani her kare yeniden uygulanır.
- Ağırlık paylaşımı: taban hareket (dur/yürü/koş) ağırlıklarını `1 - ps.airBlend` ile çarpar; hava klipleri `ps.airBlend` kadar ağırlık alır. Başka bir katman tam beden klibi oynatacaksa aynı yolu izler ve payını `SO.ps` içinde yeni bir alanla duyurur (alanı bu belgeye de yazar).

| Katman | `order` | Sahibi olduğu şeyler |
|---|---|---|
| `anim/donus.js` | 5 | `ps.yaw`, `ps.yawRate`, `ps.lean`, `ps.leanFwd`; dönüş, yatma. Ek alanlar: `ps.turnSlow` (hız çarpanı 0..1, 1 = kısma yok; fizik henüz okumuyor), `ps.pivot` (0 yok, 1 sert dönüşte fren, 2 dönme), `ps.turnTwist` (üst gövde + başa verilen ön dönüş, rad). `ps.lean` işareti: + = karakterin sağına (sola dönerken negatif). Ayarlar `SO.tune.donus` |
| `anim/hareket.js` | 10 | dur/yürü/hafif koşu/depar karışımı, evre eşleme, adım olayı (`SO.ses.olay('adim', …)`; evre 0 ve 0.5 geçişinde, temas başına bir kez). Yazdığı alanlar: `ps.gait` (0 dur, 1 yürü, 2 hafif koşu, 3 depar; kesirli), `ps.phase` (0..1 tam döngü; **0 = sol ayak yere değer, 0.5 = sağ ayak yere değer**; dururken 0.08'de bekler), `ps.stride` (o anki tam döngü uzunluğu, m; tek adım = yarısı), `ps.cadence` (döngü/sn; dakikadaki adım = ×120), `ps.strideScale`, `ps.plantL`, `ps.plantR` (0..1: kliplere göre o ayak yerde ve sabit mi; dururken 1). Kaymasızlık: evre hızı = zemin hızı / döngü uzunluğu. Kliplerin adımı oyun hızlarına göre çok uzun olduğundan `post` içinde **adım ölçekleme** yapar: thigh/calf/foot_l/r kemiklerini iki kemikli çözümle döndürüp ayağın kalçaya göre ileri-geri uzaklığını ölçekler (ayağın yüksekliği ve dünya yönü aynı kalır; pelvise dokunmaz). Sonraki katmanlar (`ayak.js`) bacak kemiklerini bu hâliyle görür. Kapatmak için `SO.tune.hareket.olcekle = false`. Ölçümler ve ayarlar dosya başında |
| `anim/ziplama.js` | 20 | `input.jump` tüketimi (arabellek 0,12 sn, kenar toleransı 0,10 sn), `ps.jumpNow`, `ps.airBlend` (hazırlık ve inişte yerdeyken de > 0 olabilir), `ps.jumpPhase` (`'' \| 'start' \| 'air' \| 'land'`), `ps.speedScale`, `ps.landK` (iniş şiddeti 0..1, yalnız `'land'` evresinde), zıplama/iniş olayları. `tune.gravity = 25`, `tune.jumpSpeed = 7` değerlerini bu katman kurar; ayarlar `SO.tune.ziplama`. Kenar toleransında (havadayken) kalkış hızını `ps.vy`/`ps.jumpedAt`/`ps.airTime` yazarak kendisi verir. Ek: `ps.jumpBasAt` (düğmeye son basış anı). Yüzerken zıplama isteği yutulur. `ps.kilit` sürerken durur; `ps.airBlend = max(kendi payı, ps.tirmanBlend)`. `post`ta koşarak zıplamada `pelvis` ve `thigh_l/r` kemiklerini döndürür |
| `anim/canlilik.js` | 30 | nefes, ağırlık aktarma, baş bakışı, dururken küçük hareketler, atalet, iniş sarsıntısı (hepsi `post`, klip ağırlığına dokunmaz). Yazdığı alanlar: `ps.yorgunluk` (0..1), `ps.nefes` (-1..1), `ps.bakisYaw`, `ps.bakisPitch` (rad, gövdeye göre), `ps.agirlik` (-1..1; + = ağırlık sol bacakta), `ps.durusOlay`. Ayarlar `SO.tune.canlilik` (`siddet` hepsini kısar; 0 = kapalı). Dokunduğu kemikler: pelvis (en çok 2,5° dönüş, konum yok), spine_01–03, neck_01, Head, clavicle_l/r, upperarm_l/r |
| `anim/durus.js` | 35 | duruş düzeltmesi (yalnız `post`, `ps`'e yazmaz). Klipler bu modelde kambur oynuyor (göğüs 25–30° öne kırık, baş 13–23° düşük; hafif koşu klibinde gövde 25°, deparda 39° öne): oynayan taban klibin ağırlığıyla karışan sabit açılar (`SO.tune.durus.duzelt`) pelvis → spine_01–03 → neck_01 → Head zincirinden geri alınır (sonuç: dur ≈ 1°, yürü ≈ 4°, hafif koşu ≈ 8°, depar ≈ 15°; baş 3–6°). Toplam gövde eğimi (pelvis → boyun, `ps.leanFwd` dahil) yerdeyken `egimEnCok` (25°) ile sınırlanır. Kalçanın dikey zıplaması ve uçuştaki ayak boşluğu adım ölçeğine uysun diye sıkıştırılır (`kalca`; "çömelerek koşma" bundan gidiyor), bilekler önceki dünya konumuna iki kemikli çözümle geri konur (ayak kayması değişmez). Dokunduğu kemikler: pelvis (dönüş + konum), spine_01–03, neck_01, Head, upperarm_l/r, thigh/calf/foot_l/r. Kapatmak: `SO.tune.durus.on = false`; ölçüm: `SO.durus` (`egim`, `kaldir`, `indir`, `kisit`). Klip ölçümleri dosya başında |
| `anim/yuzme.js` | 22 | sığ suda yürüme, yüzme klipleri, `ps.yuzmeBlend`, su olayları |
| `anim/tirmanma.js` | 24 (+ kol çözümü 45) | düz kayalara çıkma; tek düğme (zıplama). `ziplama.js` yerdeyken zıplama isteğinde `SO.tirman.dene(ctx)` sorar. Tepe − ayak: < 0,65 m normal zıplama (kayaya doğru hız tamamlanır, üstüne konar) · 0,65–1,35 m `'bel'`: elle destek alıp aşma (`ClimbUp_1m`) · 1,35–2,1 m `'boy'`: çömel, sıçra, tutun, asıl, çekil, aş · daha yüksek: zıplama. Havadayken çubuk kayaya itiliyorsa ya da zıplamaya yeniden basıldıysa ve tepe ayaktan 0,25–1,75 m yukarıdaysa kenarı yakalar (zıplayıp yetişilen daha yüksek kayalar böyle çıkılır). Yazdığı alanlar: `ps.kilit`, `ps.tirmanBlend` (0..1), `ps.tirman` (`'' \| 'bel' \| 'boy'`), `ps.tirmanFaz` (`'' \| 'hiza' \| 'sicra' \| 'asil' \| 'cek' \| 'as' \| 'cik'`); kilit altında `ps.x/y/z, yaw, yawRate, lean, leanFwd, vx/vy/vz, grounded (false)`; her kare `ps.airBlend = max(airBlend, tirmanBlend)` (taban hareket böyle bastırılır) ve `ps.ikKapat = max(ikKapat, tirmanBlend)`. Kayanın görünen ağına ışın atıp gerçek kenarı ve yüz eğimini ölçer; `post`ta (order 45, ayak katmanından sonra) `upperarm/lowerarm/hand_l/r` kemiklerini dünya uzayında iki kemikli çözümle kenara oturtur. Ayarlar `SO.tune.tirmanma`, ölçüm `SO.tirman.durum`; klip ölçümleri dosya başında |
| `anim/ayak.js` | 40 | ayakların zemine oturması, `ps.rootDy` |
| `anim/toplama.js` | 26 (+ gövde 36, kol 46) | yerden alma hareketi (`Farm_Harvest` zamanı sıkıştırılarak: iniş 0,30 sn, el değer, doğrulma 0,42 sn; sağ kol ters kinematikle nesneye uzanır, gerekirse kalça iner/bel eğilir). `toplama.js` `SO.toplaAnim.basla(x, y, z)` ile başlatır; el değdiği karede `SO.toplaAnim.durum.deger` true olur. Yazdığı alanlar: `ps.topla`, `ps.toplaFaz` (`'' \| 'in' \| 'tut' \| 'kalk'`), `ps.toplaBlend` (0..1), `ps.toplaYavas` (hız çarpanı 0..1; **fizik okumalı**, aşağıda). Her kare `ps.airBlend = max(ps.airBlend, ps.toplaBlend)` (taban hareket bastırılır); `ps.ikKapat`'a dokunmaz (ayak yerleştirme açık). Çubuk boşken `ps.yaw`'ı nesneye çevirir. Yerden kesilince/yüzünce/`ps.kilit` gelince iptal olur. Dokunduğu kemikler: pelvis (konum), spine_01, spine_03, neck_01, Head, thigh/calf/foot_l/r (order 36: `durus.js`'in 'hava' düzeltmesini kendi düzeltmesiyle değiştirir), upperarm_r, lowerarm_r (46). Ayarlar `SO.tune.toplama`; klip ölçümleri ve zaman çizelgesi dosya başında |
| `anim/vurus.js` | 28 | vuruş hareketi (tam beden klibi; kemiklere elle dokunmaz). `oyun.js` `SO.vurAnim.basla(tur, hx, hz)` ile başlatır; değme karesinde `SO.vurAnim.durum.deger` true olur. Türler: `balta` (`TreeChopping_Loop`, ilk değme 0,50 sn, art arda 0,88 sn), `kazma` (`Sword_Attack`, 0,35 / 0,90 sn), `yumruk` (`Punch_Cross`, 0,15 / 0,63 sn), `mizrak` (`Punch_Cross`, 0,15 / 0,73 sn), `ye` (`Consume`, sol el). Düğme basılı kaldıkça vuruşlar zincirlenir; bırakınca değmeden sonra taban harekete karışır. Yazdığı alanlar: `ps.vur`, `ps.vurTur`, `ps.vurBlend` (0..1), `ps.vurYavas` (hız çarpanı; **fizik okumalı**, aşağıda). Her kare `ps.airBlend = max(ps.airBlend, ps.vurBlend)`; çubuk boşken `ps.yaw`'ı hedefe çevirir. Havada/yüzerken/`ps.kilit`/yerden alma sırasında iptal. Ayarlar `SO.tune.vurus`; klip ölçümleri ve zaman çizelgesi dosya başında |

**Ayak katmanı (`anim/ayak.js`) notları:** `post` başında kökü `(ps.x, ps.y, ps.z)` + `(leanFwd, yaw, lean)` ile yerine koyup `updateMatrixWorld` çağırır (ana.js aynı değerleri `rootDy` ekleyerek hemen sonra yazar); bu yüzden `ps.yaw/lean/leanFwd` en geç `update` içinde yazılmış olmalı. Yalnız `thigh/calf/foot_l/r` kemiklerine ve `ps.rootDy`'ye dokunur; bacak kemiklerine `post`ta dokunan başka katman 40'tan küçük `order` ile çalışmalı. Her ayak, altındaki zemine (`world.groundY`) göre iki kemikli ters kinematikle oturur; kalça yere basan alçak ayağa göre iner/kalkar (`ps.y + ps.rootDy` fiziğin basamak yumuşatmasından bağımsızdır). Havada kapalıdır (yere değmeden hemen önce açılmaya başlar; iniş klibi sürerken açıktır). Dururken ayak dünya konumu kilitlenir. Ayarlar `SO.tune.ayak` (`on: false` katmanı kapatır), ölçüm için `SO.ayak` (`w` ağırlık, `legs[i].off/p/lockW`).

**Kamera (`kamera.js`) notları:** `SO.cam.yaw/pitch` oyuncunundur; kamera yalnız otomatik arkaya dönmede (elle çevirmeden 1,2 sn sonra, karakter yürürken, kameraya doğru gelmiyorsa) `yaw`'ı yavaşça değiştirir. `yaw`/`pitch`'e dışarıdan yazılan her değer "elle çevirme" sayılır (`SO.cam.manualAt`). `SO.cam.fov` temel görüş açısıdır (depar payı `cam.fov`'a ayrıca eklenir), `SO.cam.dist` temel uzaklıktır. Ek alanlar (salt okunur): `cur` (o anki uzaklık), `px/py/pz` (yumuşatılmış bakış noktası), `kick` (depar payı 0..1), `dip` (iniş çökmesi, m). Ayarlar `SO.tune.kamera`. 1 m'den ince engeller (ağaç gövdesi, direk) kamerayı yaklaştırmaz.

`SO.ps` alanlarının tam listesi ve kimin yazdığı `cekirdek.js` başında. `SO.tune` içinde her katman kendi adında bir alt nesne açabilir (`SO.tune.hareket = {...}`).

Yön: ileri = `(sin yaw, cos yaw)`; model +Z'ye bakar. Birim metre, saniye, radyan. Hızlar: yürüme 1,55, hafif koşu 3,6, depar 6,4 m/sn (çubuk yarıdan azsa yürür, tam itilince hafif koşar, KOŞ basılıyken depar).

## Dünya (`SO.world`, `arazi.js`)
32 km × 32 km, parça parça üretilir (hiçbir şey saklanmaz; tek bir yükseklik işlevi). Ortada yeşil vadi (başlangıç, ~9 km), kuzey orman, doğu çöl, batı karlı dağlar, güney kızıl diyar. Deniz ve nehir/göl yüzeyi her yerde y = 0 (`SO.world.SU`).
- `groundY(x, z)`: arazi yüksekliği (çizilen yüzeyle birebir). `suDerinlik(x, z)`: o noktadaki su derinliği (m; kara ise 0).
- `destekY(x, z, y)`: ayak altındaki destek: arazi ya da (ayak hizası tepesine yakınsa) üstünde durulan düz kaya.
- `collide(x, z, r, y)`: ağaç/kaya kutularının dışına iter; `y` verilirse üstünde durulan düz kaya itmez.
- `basamak(x, z, dx, dz, uzak, y)`: o yönde `uzak` m içinde tepesi şimdiki destekten ≥ 0,3 m yüksek ilk **düz tepeli kaya** → `{ top, yukseklik, x, z, ust: [x, z] }` ya da `null`. Düz kayalar üç boyda: 0,5 m (diz), 1,0 m (bel), 1,8 m (boy); enine ölçek 0,9–1,4.
- `solids`: yüklü hücrelerdeki çarpışma kutuları `{ x0, x1, z0, z1, top, duz }` (`duz`: üstüne çıkılabilir).
- `zemin(x, z)`: `'su'` (sığ su) | `'cim'` | `'kaldirim'`. `biyom(x, z)`: `'vadi' | 'orman' | 'col' | 'kar' | 'kizil'`. `ortam(x, z)`: ortam sesi düzeyleri. `renk(x, z)`: harita rengi `[r, g, b]`. `HALF` = 16000, `start` = doğuş noktası.
- `update(cam)`: her karede akış (parça üretimi, atma) ve gizleme (görüş alanı, mesafe, tepenin arkası).

## Harita (`SO.harita`, `harita.js`)
Sağ üstte küçük yuvarlak harita (`#hMini`, 72 px; 360 m'lik pencere, kuzey yukarı; oyuncu ortada yön oku, kameranın baktığı yöne soluk görüş konisi). Dokununca (ya da `M` tuşu) tam harita açılır (`#hTam`); küçük harita, kapat düğmesi ya da `Esc` kapatır. Tam harita açıkken oyun sürer; perdenin boş yerine dokunuş çubuğa/kameraya gider, panoya dokunuş gitmez.
- **Tam harita:** tek parmakla (ya da fareyle) sürükleme kaydırır; iki parmakla kıstırma, fare tekerleği ya da `+`/`−` yakınlaştırır (parmakların ortası sabit kalır). Sınırlar: en uzak bütün dünya (32 km), en yakın 360 m. Açılışta oyuncu ortada, 3 km. Ortala düğmesi (`#hOrtala`) oyuncuya döner ve onu izler; kaydırınca izleme biter. Oyuncu pencerenin dışındaysa kenarda kırmızı ok durur. Ölçek çizgisi ve kılavuz çizgileri yakınlığa göre değişir.
- **İşaret:** haritaya kısa dokunuş oraya işaret koyar (sisli yere de); işarete yeniden dokunmak ya da "işareti kaldır" düğmesi (`#hIsaretSil`) kaldırır. Tek işaret var. Oyuncudan işarete noktalı çizgi iki haritada da çizilir (noktalar dünya uzayında, işaretten başlayarak 25 m × 2^n aralıklı); küçük haritada işaret pencerenin dışındaysa kenarda sarı ok durur. `SO.harita.isaret` → `{ x, z }` ya da `null` (salt okunur); `SO.harita.isaretKoy(x, z)`, `SO.harita.isaretSil()`.
- **Simgeler (ileride haritaya konacak yerler):** `SO.harita.simgeEkle({ id, x, z, tur, ad, renk })` (aynı `id` üstüne yazar; `tur` şimdilik yalnız `'nokta'`; `renk` isteğe bağlı), `SO.harita.simgeSil(id)`. Tam haritada nokta + ad, küçük haritada nokta çizilir. Simgeler sisin üstünde de görünür (göstermek istemeyen, yer açılınca ekler: `SO.harita.acikMi(x, z)`) ve kaydedilmez (her açılışta ekleyen kod yeniden ekler).
- **Keşif sisi:** dünya 16 m'lik hücrelere bölünür (2000 × 2000, hücre başına 1 bit = 500 KB). Oyuncu her 8 m'de çevresindeki 100 m'yi açar; açılan yer kapanmaz. Gidilmeyen yer sistir (`--sis`).
- **Renk:** `SO.world.renk` yalnız açılan hücreler için, hücre başına bir kez çağrılır; kare başına en çok 48 hücre / 1,5 ms. Doku 2 km'lik karolarda, yalnız açılan karolar için ayrılır (karo başına 62 KB). Yakından bakınca hücreler keskin çizilir, sis kenarı yumuşak kalır; 16 km'den geniş görünüm 64 m'lik özet dokudan çizilir.
- **Kayıt:** `localStorage` anahtarı `acik-dunya-harita-v1` = `{ v, h, n, d, i }` (`d`: satır-uzunluk kodlaması + base64, yalnız açık/kapalı bilgisi; `i`: işaret `[x, z]`, yoksa alan yok). 10 sn'de bir ve sayfa gizlenirken yazılır; `?test` kipinde okunmaz/yazılmaz.
- **Deneme:** `SO.harita.durum()` (`acik` hücre sayısı, `bekleyen` renk sırası, `bellek`, `kayit` boyutu), `SO.harita.acikMi(x, z)`, `SO.harita.ac()/kapat()/ortala()`, `SO.harita.gorunum({ x, z, m })` (merkez ve genişlik; boş çağrı o anki görünümü verir), `SO.harita.ciz()` (hemen yeniden çiz), `SO.harita.kodla()/coz(metin)`.

## Toplama (`SO.toplama`, `SO.envanter`, `toplama.js`)
Yerde elle toplanabilen küçük nesneler: **dal** (0,5–0,9 m) ve **taş** (13–22 cm). Tür tablosu `SO.toplama.TUR` (yeni tür: `SO.toplama.turEkle(ad, tanim)`, `init`'ten önce).
- **Yerleşim:** 48 m'lik hücreler, oyuncunun çevresinde 5×5; hücre başına 16×16 aday nokta (tohum hücre koordinatından), kimlik = hücre + aday sırası. Dallar ağaç gövdelerinin 0,5–6,5 m çevresinde sık (ağaçlar `SO.world.solids`'ten okunur), açıkta seyrek; taşlar kayaların dibinde, su kıyısındaki alçak şeritte ve dik yamaç yakınında sık, çayırda seyrek. Çölde/kızıl diyarda dal neredeyse yok, taş çok. Suda, kutuların içinde, çok dik yerde yok. Doğuş noktasının 100 m çevresinde ≈ 26 dal, 47 taş.
- **Çizim:** tür × biçim başına tek ortak `InstancedMesh` (6 çizim çağrısı), ağaç/kaya ile aynı malzeme (`SO.gorunum.nesneGeo/nesneMat`); matrisler yalnız hücre kümesi değişince ya da nesne alınınca yazılır; 92 m'de küçülerek kaybolur. Alınabilecek nesne biraz parlar.
- **Alma:** 1,3 m içindeki en uygun nesne (öndeki öncelikli) `SO.toplama.yakin`; o varken `AL` düğmesi (`#bAl`) görünür. `AL` / `E` tuşu / `SO.input.act = true` → alış. Basılı tutulursa menzile giren her nesne sırayla alınır (art arda ≈ 0,4 sn). Yüzerken, tırmanırken, havadayken yok.
- **Sayaç:** `#envanter` (üst orta): tür simgesi + sayı, ilk nesneye kadar gizli. `SO.envanter.dal`, `.tas`, `.adet(tur)`, `.ekle(tur, adet)`, `.harca(tur, adet)` (yetmezse `false`), `.dinle(fn)`.
- **Kayıt:** `localStorage` anahtarı `acik-dunya-envanter-v1` = `{ v: 1, say: { dal, tas }, alinan: "hücre:ssss;..." }` (alınan nesnelerin kimlikleri; en çok 6000, dolunca en eski hücreler unutulur ve oradaki nesneler yeniden belirir; en çok ≈ 20 KB). Alıştan 2 sn sonra ve sayfa gizlenirken yazılır; `?test` kipinde okunmaz/yazılmaz.
- **Deneme:** `SO.toplama.durum()`, `SO.toplama.say(x, z, yaricap)` (tür başına sayı), `SO.toplama.al()`, `SO.toplama.kodla()/coz(metin)`, `SO.toplaAnim.durum`.

## Oyun çekirdeği (`SO.oyun`, `oyun.js`)
Arayüz ve inşa ile aradaki sözleşme `docs/OYUN_API.md`; değerler, eğriler ve kayıt biçimi `oyun.js` başında.
- **Değerler:** can 100 (+5/seviye), açlık 100 (dururken 0,05/sn, yürürken 0,08, deparda 0,16, yüzerken 0,12, vuruş başına 0,15; 0'da can 0,5/sn azalır, 60'ın üstünde can 0,4/sn dolar). Can 0 → doğuş noktasında yeniden doğuş. Seviye: `xpGerek(s) = 5 × yuvarla(8 × s^1,6)` (40, 120, 230, 370, 525 …); seviye atlayınca +2 teknoloji puanı (5. seviyeden sonra +1).
- **Eşyalar** `SO.esya`, **tarifler** `SO.tarifler` (`'el'`: her yerde; `'masa'`: üretim masasının 3,5 m yakınında), **teknoloji** `SO.teknoloji` (19 kalem, seviye 1–10; id listesi sözleşmede).
- **El yuvaları** `SO.eller`: 3 yuva; seçili alet sağ ele bağlı 3B ağ olarak görünür. Klavye: `1`/`2`/`3` yuva seçer, `F` vurur.
- **Vurma:** `SO.input.vur` basılıyken elindekiyle vurur. Nesne canı ölçekten: ağaç `25 + 22 s²`, kaya `20 + 35 s²` (düz kayalar 70/110/170 × s), çalı `10 + 6 s`, kaktüs 20. Hasar (ağaç/kaya/çalı): el 1/0/5, taş balta 10/0/9, taş kazma 3/10/5, mızrak 2/0/6. Baltayla her vuruşta +1 odun, kazmayla +1 taş; nesne bitince toplu düşüş ve `SO.world.nesneKaldir`. Kalan can kaydedilmez.
- **Kayıt:** `acik-dunya-oyun-v1` (oyuncu, eller, açık teknolojiler, kaldırılan nesneler (en çok 4000), keşif kareleri); eşya sayıları toplama kaydında.
- **Deneme:** `SO.oyun.durum()`, `.hedef` (önündeki vurulabilir nesne ve canı), `.hedefBul()`, `.bildirimler`, `.kodla()/coz()`, `.sifirla()`, `SO.vurAnim.durum`.

## Arayüz (`SO.arayuz`, `arayuz.js`; öğeler ve stil `index.html`)
Yalnız okur ve `docs/OYUN_API.md`'deki işlevleri çağırır; oyun durumu tutmaz. Sözleşmedeki her nesne isteğe bağlıdır (yoksa o yer boş/varsayılan görünür).
- **Düzen (sahne pikseli; sağ kenar payı `--kr` = 26, sol `--kl` = 22):** sol üst can + açlık çubukları (`#durum`, 94×13, simgeli; %25'in altında yanıp söner), altında kare sayacı (`#fps`, küçük) · üst orta seviye rozeti + xp çubuğu (`#seviye`) · altında bildirimler (`#bildirim`) · sağ üst küçük harita (72), hemen altında dikey çubuk (`#eller`: 3 el yuvası + çanta, bölme 44×44) · alt orta tablet + çekiç (`#padO`, 48) · sağ alt yay (`#padR`): köşede vur 64, solunda zıpla 60, üstünde AL 54, en solda KOŞ 56, gerektiğinde Sök 54.
- **Paneller:** tek kap `#panel` (çanta / çekiç / tablet), ortada, en çok 540 px; aynı anda biri açık; dışına (düğme olmayan yere) dokununca kapanır ve o dokunuş çubuğa/kameraya gider; harita ile birbirini kapatır. Gövde `#pGovde` parmakla sürüklenerek kayar (elle yazıldı: sahne 90° dönükken de parmağı izler). `SO.arayuz.ac('canta' | 'cekic' | 'tablet')`, `.kapat()`, `.acik`.
- **Yerleştirme kipi** (`SO.yapi.kip`): vur/zıpla/AL yerine Yerleştir / Döndür / İptal; `kip.uygun` false ise Yerleştir soluk, dokununca `kip.neden` yazılır. **Sök** düğmesi `SO.yapi.sokulebilir` doluyken görünür (`SO.yapi.sok()`).
- **Bildirim:** `SO.arayuz.bildir(metin, vurgu)`; 2,4 sn, en çok 4 satır; 0,4 sn içinde gelen aynı metin bir kez gösterilir. `oyun.js` kendi bildirimlerini gönderdiği sürece (`SO.oyun.bildirimler`) arayüz kazanım/seviye bildirimi üretmez; yoksa envanter farkından "+1 dal" üretir.
- **Güncelleme:** her bölümün imzası (gösterdiği değerler) 5 Hz'de yoklanır, `SO.oyun.dinle` / `SO.envanter.dinle` / `SO.yapi.dinle` olayında bir sonraki karede; DOM yalnız imza değişince yazılır. `SO.arayuz.yenile()` hemen yeniler (deneme).
- **Klavye:** `F` vur · `1/2/3` el yuvası · `I`/`Tab` çanta · `B` çekiç · `T` tablet · `Esc` kapat; kipte `Enter` yerleştir, `R` döndür, `Esc` iptal.
- **Deneme:** `.pad` sınıfı = arayüz parçası (`test/cek.cjs` gizler). `#envanter` sayacı CSS ile kapalı (yerini çanta ve bildirim aldı).

## Fizik durumları (`fizik.js`)
- Su: `ps.suDerin` (m). Sığda (0,25–1,2 m) hız yarıya kadar düşer. Derinlik 1,3 m'yi geçince `ps.yuzme = true`: karakter su yüzeyinde tutulur (`ps.y` ≈ −1,38), hız `tune.yuz` (1,45) / KOŞ ile `tune.yuzHizli` (2,3), zıplama yok; 1,1 m'nin altına inince biter. `ps.yuzmeAt` son değişim anı. Yüzerken `ps.grounded` true kalır.
- `ps.kilit = true`: fizik konuma dokunmaz; konumu bir katman (tırmanma) sürer, bitince `false` yapar ve hızları sıfırlar/ayarlar.
- `ps.ikKapat` (0..1): ayak yerleştirme ve duruş düzeltmesi bu kadar kapatılır. Yüzme katmanı her karenin başında kendi payına eşitler; tırmanma yalnız `Math.max` ile yükseltir.
- `ps.toplaYavas` (0..1; 1 = kısma yok): yerden alma sırasında hız çarpanı (`anim/toplama.js` yazar: inişte ve kavramada 0,1; doğrulurken 1'e döner). Fizik hedef hızı bununla çarpmalı (`ps.speedScale` ve `ps.turnSlow` gibi).
- `ps.vurYavas` (0..1; 1 = kısma yok): vuruş sırasında hız çarpanı (`anim/vurus.js` yazar: balta/kazma 0,12, mızrak 0,15, yumruk 0,2, yerken 0,5; vuruş bitince 1). Fizik hedef hızı bununla da çarpmalı (`ps.toplaYavas` gibi).
- Yüzme katmanının alanları: `ps.yuzmeBlend` (yüzme kliplerinin payı; taban hareket `1 − yuzmeBlend` ile çarpılır), `ps.yuzmeEvre`, `ps.yuzmeIleri`, `ps.yuzmeDy` (bilgi), `ps.adimAgir` (sığ suda kadans çarpanı).

## Ses olayları (`SO.ses.olay(ad, bilgi)`)
- `adim` `{ zemin: 'asfalt' | 'kaldirim' | 'cim', hiz, ayak: 'l' | 'r' }`
- `zipla` `{}`
- `in` `{ hiz, zemin }` (yere değiş hızı m/sn)
- `su_gir` `{ hiz }` (suya girip yüzmeye başlama), `su_cik` `{}`, `kulac` `{ hiz }` (yüzerken her kulaç), `adim` olayında `zemin: 'su'` (sığ suda yürüme)
- `tutun` `{}` (tırmanırken el kayaya değer), `tirman` `{ yukseklik }` (kendini yukarı çekme/üste çıkış)
- `al` `{ tur: 'dal' | 'tas' }` (yerden bir şey alındı: elin nesneye değdiği an; `toplama.js` gönderir)
- `vur` `{ hedef: 'agac' | 'kaya' | 'cali' | 'kaktus' | 'bos', alet: 'el' | 'tas_balta' | 'tas_kazma' | 'mizrak', etkisiz }` (vuruşun değdiği an; `etkisiz: true` = alet o nesneye işlemiyor; `oyun.js` gönderir)
- `kir` `{ hedef, tur, olcek }` (nesne bitti: ağaç devrildi, kaya kırıldı, çalı söküldü)
- `uret` `{ tarif }`, `seviye` `{ seviye }`, `teknoloji` `{ id }`, `ye` `{ tur }`, `hasar` `{ miktar, neden }`, `olum` `{}` (hepsi `oyun.js`; `ses.js` henüz bunları çalmıyor)

Sesler `ses/*.mp3` (gerçek kayıt, kamu malı; kaynaklar `ses/LISANS.md`). Su: sığ suda adım `ps.suDerin`'e göre hafiften dolguna gider; su ortamı (`ortam_su`) oyuncunun çevresinde `world.suDerinlik` örneklenerek (0,4 sn'de bir; 4, 10, 30 m halkaları) açılır, yüzerken biraz öne gelir. `'cim'` zemini çölde kum, karlı dağda kar adım takımına döner (`world.biyom`). `tirman` sesi ayrı kayıt değil, mevcut kayıtların birleşimidir. Zemin başına yürüme ve koşu için ayrı adım takımı var; 2,6 m/sn üstünde koşu takımı çalar. Ortam: şehir uğultusu hep çalar, parkta (şehir içindeki çim) üstüne kuş katmanı gelir. Düzeyler `SO.tune.ses` içinde; `SO.ses.durum()` yüklenen dosya sayısını, hataları ve çalınan ses sayılarını verir. Ses ilk dokunuşta açılır; `?test` kipinde `init()` çağrılmadıkça sessizdir.

## Deneme aracı
```
node test/cek.cjs '<senaryo JSON>' cikti.png [--olc]
```
Oyunu `?test` ile açar, 1/60 sn sabit adımla yürütür, istenen anlarda kare alıp yan yana dizer. `--olc` her adımda oyuncu durumunu ve ayak/kalça/baş kemiklerinin dünya konumunu `cikti.json` olarak yazar (ayak kayması, sıçrama yüksekliği gibi ölçümler için). Ayrıntı dosyanın başında. Örnek:
```
node test/cek.cjs '{"kamera":"yan","adimlar":[{"sure":0.5},{"sure":2,"jy":1},{"sure":1,"jy":1,"run":true}],"kareler":[0.4,1.0,1.5,2.0,2.5,3.2]}' /tmp/kos.png --olc
```
Kamera `yan`/`on`/`arka`/`capraz` karaktere sabit açıdan bakar; `takip` oyundaki kameradır. Başsız ortamda ekran kartı yok: kare hızı ölçümü anlamsızdır, yalnız görüntü ve sayılar geçerlidir.

## Varlıklar
Model ve hareketler CC0 (Quaternius): `model/LISANS.md`. Sesler: `ses/LISANS.md`.
