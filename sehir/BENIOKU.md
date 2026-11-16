# Şehir Denemesi

Üç boyutlu, arkadan bakışlı (üçüncü şahıs) şehirde yürüme denemesi. Telefon için, hep yatay. Konu ve amaç henüz yok: önce görünüş ve hareket kalitesi. Çizim tarzı "mürekkep + düz renk" (Two Beeps animasyonunun kalemi), ama o dizinin ya da Yıkım Ustası'nın hiçbir karakteri, mekânı ve öğesi burada **yok** (Eymen, 16 Kasım 2026).

## Eymen'in kuralları
- Sıradan bir insan, sıradan bir şehir. İnşaat alanı, çatlak bina, vinç, dizi karakteri yok.
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
| `dunya.js` | şehir: bloklar, binalar, park, ağaç, lamba; `SO.world` (çarpışma, zemin yüksekliği, zemin türü) |
| `karakter.js` | model + hareket klipleri + çizgi film boyama; `SO.char` |
| `fizik.js` | hız, yerçekimi, zıplama anı, çarpışma |
| `kamera.js` | kamera; `SO.cam` |
| `ses.js`, `ses/` | sesler; `SO.ses` |
| `anim/*.js` | hareket katmanları (aşağıda) |
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
| `anim/hareket.js` | 10 | dur/yürü/hafif koşu/depar karışımı, `ps.gait`, `ps.phase`, `ps.stride`, adım olayı (`SO.ses.olay('adim', …)`) |
| `anim/ziplama.js` | 20 | `input.jump` tüketimi (arabellek 0,12 sn, kenar toleransı 0,10 sn), `ps.jumpNow`, `ps.airBlend` (hazırlık ve inişte yerdeyken de > 0 olabilir), `ps.jumpPhase` (`'' \| 'start' \| 'air' \| 'land'`), `ps.speedScale`, `ps.landK` (iniş şiddeti 0..1, yalnız `'land'` evresinde), zıplama/iniş olayları. `tune.gravity = 25`, `tune.jumpSpeed = 7` değerlerini bu katman kurar; ayarlar `SO.tune.ziplama`. Kenar toleransında (havadayken) kalkış hızını `ps.vy`/`ps.jumpedAt`/`ps.airTime` yazarak kendisi verir. `post`ta koşarak zıplamada `pelvis` ve `thigh_l/r` kemiklerini döndürür |
| `anim/canlilik.js` | 30 | nefes, ağırlık aktarma, baş bakışı, dururken küçük hareketler, atalet, iniş sarsıntısı (hepsi `post`, klip ağırlığına dokunmaz). Yazdığı alanlar: `ps.yorgunluk` (0..1), `ps.nefes` (-1..1), `ps.bakisYaw`, `ps.bakisPitch` (rad, gövdeye göre), `ps.agirlik` (-1..1; + = ağırlık sol bacakta), `ps.durusOlay`. Ayarlar `SO.tune.canlilik` (`siddet` hepsini kısar; 0 = kapalı). Dokunduğu kemikler: pelvis (en çok 2,5° dönüş, konum yok), spine_01–03, neck_01, Head, clavicle_l/r, upperarm_l/r |
| `anim/ayak.js` | 40 | ayakların zemine oturması, `ps.rootDy` |

`SO.ps` alanlarının tam listesi ve kimin yazdığı `cekirdek.js` başında. `SO.tune` içinde her katman kendi adında bir alt nesne açabilir (`SO.tune.hareket = {...}`).

Yön: ileri = `(sin yaw, cos yaw)`; model +Z'ye bakar. Birim metre, saniye, radyan. Hızlar: yürüme 1,55, hafif koşu 3,6, depar 6,4 m/sn (çubuk yarıdan azsa yürür, tam itilince hafif koşar, KOŞ basılıyken depar).

## Ses olayları (`SO.ses.olay(ad, bilgi)`)
- `adim` `{ zemin: 'asfalt' | 'kaldirim' | 'cim', hiz, ayak: 'l' | 'r' }`
- `zipla` `{}`
- `in` `{ hiz, zemin }` (yere değiş hızı m/sn)

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
