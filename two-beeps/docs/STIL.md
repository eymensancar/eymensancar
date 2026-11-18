# Two Beeps — stil rehberi

Kanıt: `src/stil.html` → `out/stil.png`. Çizimler `src/cizim.js` içinde; renkler `Cizim.PAL`'dan alınır.

## Görünüş: "mürekkep + kâğıt"
- **Çizgi:** her şekil mürekkeple (`#15120d`) çevrilir; tohumlu, yavaş dalgalanan el titremesiyle. Karakterlerde kalın (≈5 px), arka planda ince ve renkli; fark karakteri zeminden ayırır.
- **Boya:** düz renk + tek pürüzlü cel gölge (güneş sol üstten, gölge sağda). Degrade yalnız gökte ve ışıkta.
- **Doku:** en son tüm kareye kâğıt greni (`grain`, %20). Pas, göçük, eksik tuğla "kullanılmış" hissini verir.
- **Çizgi kaynatma yok:** seed sahne boyunca sabit.

## Palet
| Grup | Renkler |
|---|---|
| Ortak | mürekkep `#15120d`, kâğıt/altyazı `#f1e8d4`, tehlike sarısı `#f5b21c`, koyu sarı `#d98e0b` |
| Gündüz avlu | gök `#8fbadb → #c9dbe0 → #f0e2c2`, uzak şehir `#b3bfc6`, zemin `#e3cca0 / #cfb184 / #a88a5f`, tuğla `#b4532f / #86391f`, ot `#7d8a4a` |
| Gece ofis | gece `#070b18`, duvar `#1d2742`, lamba `#ffd27a`, ahşap `#5e3b1d`, telefon ekranı `#ffe27a` |
| Yıkım tozu | açık `#d8cab0`, orta `#988c7a` (oyundaki toz rengiyle aynı), koyu `#6e6457` |
| Kaan | ceket `#2f6f73 / #1f4d50`, pantolon `#3a3d45`, ten `#c68a5e / #a0663f`, saç `#2a1d16`, bot `#6b4423` |
| Daisy | gövde `#f5b21c`, yan `#df9d10`, gölge `#c07f08`, pas `#9a4b26`, cam `#2b4552`, uyarı ışığı kapalı `#7a2a1d` / yanık `#ff3b2f` |

Sarı yalnız Daisy, tehlike şeridi, oyun ekranı ve altyazı vurgusunda kullanılır; göz sarıyı "oyun/Daisy" diye okusun.

## Tipografi
Oyunun kendi fontları (SIL OFL 1.1, `assets/fonts/`, lisans `assets/LICENSES.md`):
- **Lilita One:** altyazı, bölüm etiketi, bitiş kartı. Altyazı 64–68 px, kâğıt rengi, 13 px mürekkep kontur + 5 px alt gölge; vurgulanan tek kelime sarı. Satır başına en çok 4 kelime, en çok 2 satır, cümle sonunda satır kır.
- **Rubik 500/700:** küçük yazılar (tabela, ekran, Türkçe karakter gereken her yer; Lilita'da Ş Ğ İ yok).

## Kamera (1080×1920)
- **Güvenli alan:** üst 200 px, alt 480 px, sağ 140 px Shorts arayüzüne ait; yüz, uyarı ışığı, yazı buraya girmez.
- **Altyazı bölgesi:** taban çizgisi y 1180–1380. Altyazı yüzü ya da uyarı ışığını asla örtmez; bacak örtebilir.
- **Geniş plan:** ufuk %55–60, karakter boyu kadrajın %25–30'u. Mekânı kurar; bölümde en çok 2 kez.
- **Orta plan:** Daisy'nin kabini ya da Kaan belden yukarı. Diyaloğun çoğu burada.
- **Yakın plan:** gözler y≈640. Yalnız dönüm noktalarında (iki bip, "Like she knew").
- Kamera yavaş kayar ve yaklaşır; döndürme yok. Tek sarsıntı: yıkım anında 6 kare (oyundaki gibi).

## Hareket
- **Karakterler ikişerli** (15 poz/sn): elle yapılmış hissini verir. Kamera, ışık, toz birerli (30 kare/sn).
- **Eğriler:** giriş `easeOutCubic`, kamera `easeInOutSine`, Daisy'nin bomu/kancası `easeOutBack` (en çok %8 taşma) ve ardından sönümlü sallanma.
- **Tutma:** her poz en az 12 kare; tepki pozu 18 kare; altyazı sesten 2 kare önce gelir, sustuktan sonra 8 kare kalır.
- **Göz kırpma:** 3 kare (yarı-kapalı-yarı), 2–4 sn'de bir, düzensiz.
- **İki bip ritmi:** ışık 6 kare yanık, 4 kare sönük, 6 kare yanık, ardından 10 kare sessizlik. Farlar ilk bipte açılır, ikincide en parlak. Bu ritim dizinin imzası; bölüm sonu kartında da aynen kullanılır.
- Yıkım: 8 kare tutma, düşüş `easeInQuad`, toz yere değdikten sonra 1 sn büyür.

## Karakterler
Siluet testi: dördü de tek renk siyah gölge olarak ayırt edilmeli.
- **Kaan (19):** ince uzun, bol petrol yeşili iş ceketi, iri botlar, yukarı kıvrık tek saç tutamı ("Ant": anten). Bilekte sarı reflektör, elinde oyun açık telefon. Yüz: iki nokta göz, iki kaş, tek ağız, burun kıvrımı; ifade kaş ve ağızla. Endişede göz küçülür, ter damlası çıkar.
- **Daisy:** eski, kutu kabinli sarı mobil vinç. Ağzı yok. **Farlar göz,** farların üstündeki boyalı siperlik göz kapağı: normalde yarıya iner (uykulu, sabahları sevmez), iki bipte kalkar. Tavandaki uyarı ışığı iki bipte yanar; ses iki yanında iki kavisle gösterilir. Pas, göçük, eğri ayna yaşını anlatır. Kapıda elle boyanmış "DAISY".
- **Defne:** Kaan'dan kısa, dik; yüksek topuz + kalem, yuvarlak gözlük, lacivert yelek, krem gömlek, açık haki pantolon; elinde kahve, baret ya da rulo çizim. Sarı yok.
- **Mr. Hale:** iri gövde, geniş omuz, kenarlı açık şapka, krem takım. Kalın kaş, bıyık; ifadeyi kaşlar taşır.
- **Grandpa:** görünmez; yalnız elle çizilmiş el yazısı, defter, telefon.
Özgünlük kuralı: ön cama göz, tampona ağız konmaz; Daisy'nin yüzü yalnız far + siperlik + ışık.

## Oyunla bağ
- Aynı fontlar, aynı tehlike sarısı ve siyah şerit, aynı toz rengi (`#988c7a`).
- Tehlike şeridi her karede bir yerde görünür (tampon, kanca, tabela).
- Telefon ekranında gerçek oyun görüntüsü; çerçeve mürekkeple çizilir, içi değiştirilmez.
- Bölüm etiketi ve bitiş kartı oyunun açılış ekranı gibi: Lilita One, beyaz/sarı iki satır, altta şerit.

## API: 2–10. bölüm ekleri (`src/cizim.js`, kanıt `out/stil2.png`)
Pilot fonksiyonları değişmedi (`stil.png` piksel piksel aynı). Karakterler ayak ortasından `(x,y)` ve `s` ile çizilir; mekânlar `{x,y,w,h}` alanını kırpar, 1080 genişlikte tasarlandı (küçük kare için `ctx.scale` ile küçült). Hepsi `seed` alır; seed'i sahne boyunca sabit tut.
- **Ortak yüz:** `face(ctx, expr, {L,R,m,k,lw,look,blink})`, ifadeler `EXPR`: calm, smile, serious, worried, pale, surprised, sheepish, determined, tired, confident, frozen, regret. Her karakter aynı listeyi kullanır.
- `drawKaan(ctx, {..., expr, pose})`: yeni ifadeler surprised, sheepish, determined, tired, smile. `pose`: 'sit' (`hands` 'phone'|'knees', `seat`, `glow`), 'side' (`step` -1..1), 'back'. Varsayılan (stand + calm/worried) pilotla aynı.
- `drawDefne(ctx, {x,y,s,expr,pose,item,seat,look,blink})`: pose 'stand'|'sit'|'cross'; item 'coffee'|'helmet'|'roll'. Kaan'ın ~0.9'u; topuz + kalem, yuvarlak gözlük, lacivert yelek.
- `drawHale(ctx, {x,y,s,expr,pose,hat,phone,seat})`: pose 'stand'|'sit'|'carry'; hat true|false|'hand' (9. bölüm).
- **Mekânlar:** `drawYard` (mode 'day'|'dusk'|'night'|'rain', `letter`, `doorOpen`, `lightOn`, `t`), `drawOffice` (`calendarMoved` 0..1 çatlağı açar, `lamp`, `phoneOn`), `drawCabin` (gece yağmur, `people`, `glow`, `kaanExpr`, `defneExpr`, `t`), `drawWaitingRoom` (`number`, `chairs`), `drawWaterTower` (`mode`, `fall` 0..1), `drawOldBuilding` (`variant` 0 otopark, 1 tuğla blok, 2 depo, 3 sıvalı apartman, 4 eski sinema, 5 fabrika ofisi), `drawHaleTower` (`mode`, `empty`, `sink` 0..1), `drawCafe` (`letter`, `ring`, `fries` 0..1).
- **Nesneler** (orta `(x,y)`, `s`, `rot`): `drawLetter` (`kind` 'letter'|'envelope', `ring`, `lines`), `drawNotebook` (`lastPage`), `drawTin` (`open`, `text`), `drawStamp` (b-sahneler'deki "H K" kabartması, `dust` 0..1), `drawSensorPlan`, `drawListLamp` (`reveal` 0..1, `address`).
- `drawCar(ctx, {x,y,s,view,door,dust,wheel,flip})`: Hale'in beyaz, eski tarz sedanı (amblemsiz). view 'side' (sağa bakar) | 'front34'; `door` ön kapı açık; `dust` 0..1 arkada toz (uzaklaşırken); `wheel` jant dönüşü (radyan). Sola giderken `flip`.
- **Yardımcılar:** `handwrite(ctx, text, x, y, size, col, seed)` (el yazısı), `tube` (kol/bacak), `coffeeCup`, `waitChair`, `rainFx(ctx, alan, t)`.
