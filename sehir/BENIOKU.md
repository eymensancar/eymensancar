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
| `karakter.js` | model + hareket klipleri + çizgi film boyama; `SO.char` |
| `fizik.js` | hız, yerçekimi, zıplama anı, çarpışma |
| `kamera.js` | kamera; `SO.cam` |
| `ses.js`, `ses/` | sesler; `SO.ses` |
| `anim/*.js` | hareket katmanları (aşağıda) |
| `harita.js` | küçük harita, tam harita, keşif sisi; `SO.harita` |
| `ana.js` | sahne, girdi, hep yatay ekran, döngü |
| `model/` | modeller, `LISANS.md`, `KLIPLER.md` |
| `test/cek.cjs` | başsız tarayıcıda sabit adımla çalıştırıp kare alan araç |

## Kare sırası (`ana.js` → `step(dt)`)
1. Girdi → `ps.wantX/wantZ/wantMag/wantRun` (kameraya göre istenen yön).
2. `SO.fizik.update(dt)`: hız, konum, yer/hava.
3. `SO.anim.update(dt)`: katmanların `update(ctx, dt)` → `mixer.update(dt)` → katmanların `post(ctx, dt)`.
4. Kök düğüm: konum `(ps.x, ps.y + ps.rootDy, ps.z)`, dönüş (YXZ) `(ps.leanFwd, ps.yaw, ps.lean)`.
5. `SO.kamera.update(cam, dt)`, `SO.ses.update(dt)`, çizim.

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
| `anim/ziplama.js` | 20 | `input.jump` tüketimi (arabellek 0,12 sn, kenar toleransı 0,10 sn), `ps.jumpNow`, `ps.airBlend` (hazırlık ve inişte yerdeyken de > 0 olabilir), `ps.jumpPhase` (`'' \| 'start' \| 'air' \| 'land'`), `ps.speedScale`, `ps.landK` (iniş şiddeti 0..1, yalnız `'land'` evresinde), zıplama/iniş olayları. `tune.gravity = 25`, `tune.jumpSpeed = 7` değerlerini bu katman kurar; ayarlar `SO.tune.ziplama`. Kenar toleransında (havadayken) kalkış hızını `ps.vy`/`ps.jumpedAt`/`ps.airTime` yazarak kendisi verir. `post`ta koşarak zıplamada `pelvis` ve `thigh_l/r` kemiklerini döndürür |
| `anim/canlilik.js` | 30 | nefes, ağırlık aktarma, baş bakışı, dururken küçük hareketler, atalet, iniş sarsıntısı (hepsi `post`, klip ağırlığına dokunmaz). Yazdığı alanlar: `ps.yorgunluk` (0..1), `ps.nefes` (-1..1), `ps.bakisYaw`, `ps.bakisPitch` (rad, gövdeye göre), `ps.agirlik` (-1..1; + = ağırlık sol bacakta), `ps.durusOlay`. Ayarlar `SO.tune.canlilik` (`siddet` hepsini kısar; 0 = kapalı). Dokunduğu kemikler: pelvis (en çok 2,5° dönüş, konum yok), spine_01–03, neck_01, Head, clavicle_l/r, upperarm_l/r |
| `anim/durus.js` | 35 | duruş düzeltmesi (yalnız `post`, `ps`'e yazmaz). Klipler bu modelde kambur oynuyor (göğüs 25–30° öne kırık, baş 13–23° düşük; hafif koşu klibinde gövde 25°, deparda 39° öne): oynayan taban klibin ağırlığıyla karışan sabit açılar (`SO.tune.durus.duzelt`) pelvis → spine_01–03 → neck_01 → Head zincirinden geri alınır (sonuç: dur ≈ 1°, yürü ≈ 4°, hafif koşu ≈ 8°, depar ≈ 15°; baş 3–6°). Toplam gövde eğimi (pelvis → boyun, `ps.leanFwd` dahil) yerdeyken `egimEnCok` (25°) ile sınırlanır. Kalçanın dikey zıplaması ve uçuştaki ayak boşluğu adım ölçeğine uysun diye sıkıştırılır (`kalca`; "çömelerek koşma" bundan gidiyor), bilekler önceki dünya konumuna iki kemikli çözümle geri konur (ayak kayması değişmez). Dokunduğu kemikler: pelvis (dönüş + konum), spine_01–03, neck_01, Head, upperarm_l/r, thigh/calf/foot_l/r. Kapatmak: `SO.tune.durus.on = false`; ölçüm: `SO.durus` (`egim`, `kaldir`, `indir`, `kisit`). Klip ölçümleri dosya başında |
| `anim/yuzme.js` | 22 | sığ suda yürüme, yüzme klipleri, `ps.yuzmeBlend`, su olayları |
| `anim/tirmanma.js` | 24 | düz kayalara çıkma (`ps.kilit` ile konumu sürer), `ps.tirmanBlend` |
| `anim/ayak.js` | 40 | ayakların zemine oturması, `ps.rootDy` |

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
Sağ üstte küçük yuvarlak harita (`#hMini`, 72 px; oyuncu ortada ok, kuzey yukarı, 360 m'lik pencere). Dokununca (ya da `M` tuşu) tam harita açılır (`#hTam`); haritaya ya da `YAKIN`/`DÜNYA` düğmesine dokunmak "Tüm dünya" (32 km) ile oyuncu merkezli "Yakın" (3,2 km) arasında geçer; küçük harita, kapat düğmesi ya da `Esc` kapatır. Tam harita açıkken oyun sürer; perdenin boş yerine dokunuş çubuğa/kameraya gider, panoya dokunuş gitmez.
- **Keşif sisi:** dünya 16 m'lik hücrelere bölünür (2000 × 2000, hücre başına 1 bit = 500 KB). Oyuncu her 8 m'de çevresindeki 100 m'yi açar; açılan yer kapanmaz. Gidilmeyen yer sistir (`--sis`).
- **Renk:** `SO.world.renk` yalnız açılan hücreler için, hücre başına bir kez çağrılır; kare başına en çok 48 hücre / 1,5 ms. Doku 2 km'lik karolarda, yalnız açılan karolar için ayrılır (karo başına 62 KB).
- **Kayıt:** `localStorage` anahtarı `acik-dunya-harita-v1` (satır-uzunluk kodlaması + base64; yalnız açık/kapalı bilgisi, renk yok). 10 sn'de bir ve sayfa gizlenirken yazılır; `?test` kipinde okunmaz/yazılmaz.
- **Deneme:** `SO.harita.durum()` (`acik` hücre sayısı, `bekleyen` renk sırası, `bellek`, `kayit` boyutu), `SO.harita.acikMi(x, z)`, `SO.harita.ac()/kapat()`, `SO.harita.gorunum('dunya' | 'yakin')`, `SO.harita.ciz()` (hemen yeniden çiz), `SO.harita.kodla()/coz(metin)`.

## Fizik durumları (`fizik.js`)
- Su: `ps.suDerin` (m). Sığda (0,25–1,2 m) hız yarıya kadar düşer. Derinlik 1,3 m'yi geçince `ps.yuzme = true`: karakter su yüzeyinde tutulur (`ps.y` ≈ −1,38), hız `tune.yuz` (1,45) / KOŞ ile `tune.yuzHizli` (2,3), zıplama yok; 1,1 m'nin altına inince biter. `ps.yuzmeAt` son değişim anı. Yüzerken `ps.grounded` true kalır.
- `ps.kilit = true`: fizik konuma dokunmaz; konumu bir katman (tırmanma) sürer, bitince `false` yapar ve hızları sıfırlar/ayarlar.
- `ps.ikKapat` (0..1): ayak yerleştirme ve duruş düzeltmesi bu kadar kapatılır (yüzme, tırmanma sırasında).

## Ses olayları (`SO.ses.olay(ad, bilgi)`)
- `adim` `{ zemin: 'asfalt' | 'kaldirim' | 'cim', hiz, ayak: 'l' | 'r' }`
- `zipla` `{}`
- `in` `{ hiz, zemin }` (yere değiş hızı m/sn)
- `su_gir` `{ hiz }` (suya girip yüzmeye başlama), `su_cik` `{}`, `kulac` `{ hiz }` (yüzerken her kulaç), `adim` olayında `zemin: 'su'` (sığ suda yürüme)
- `tutun` `{}` (tırmanırken el kayaya değer), `tirman` `{ yukseklik }` (kendini yukarı çekme/üste çıkış)

Sesler `ses/*.mp3` (gerçek kayıt, kamu malı; kaynaklar `ses/LISANS.md`). Zemin başına yürüme ve koşu için ayrı adım takımı var; 2,6 m/sn üstünde koşu takımı çalar. Ortam: şehir uğultusu hep çalar, parkta (şehir içindeki çim) üstüne kuş katmanı gelir. Düzeyler `SO.tune.ses` içinde; `SO.ses.durum()` yüklenen dosya sayısını, hataları ve çalınan ses sayılarını verir. Ses ilk dokunuşta açılır; `?test` kipinde `init()` çağrılmadıkça sessizdir.

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
