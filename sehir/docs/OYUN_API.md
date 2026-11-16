# Oyun durumu ve arayüz sözleşmesi

Üç dosya aynı anda yazılıyor; hepsi bu sözleşmeye uyar. Değişiklik gerekirse buraya yazılır.

Betik sırası (index.html, sabit): … `toplama.js` → `oyun.js` → `yapi.js` → `arayuz.js` → `ana.js`. ana.js sırayla `SO.oyun.init()`, `SO.yapi.init()`, `SO.arayuz.init()` çağırır (dünya ve karakter kurulduktan sonra), her karede `update(dt)`.

## `oyun.js` (oyun çekirdeği) sağlar
- **`SO.oyuncu`**: `{ can, canMax, aclik, aclikMax, seviye, xp, xpGerek, puan }` (puan = harcanmamış teknoloji puanı). Yalnız oyun.js yazar.
- **`SO.envanter`** (toplama.js'te var; oyun.js genişletebilir): `adet(tur)`, `ekle(tur, adet)`, `harca(tur, adet)` → bool, `say` (tur → adet), `dinle(fn)`. Türler: `dal`, `tas`, `odun`, `lif`, … ve üretilen eşyalar (`tas_balta`, `tas_kazma`, `mizrak`, …).
- **`SO.esya`**: tür tablosu `id → { ad, sinif: 'malzeme' | 'alet' | 'silah' | 'yiyecek', simge }` (`simge`: 24×24 `viewBox`'lı SVG iç içeriği, `currentColor` ile; arayüz bunu çizer).
- **`SO.eller`**: `{ yuva: [id | null, id | null, id | null], secili: 0..2 | -1 }`; `SO.oyun.elSec(i)` (aynı yuvaya yeniden basınca elden bırakır: -1), `SO.oyun.kusan(id, i)` (çantadan yuvaya), `SO.oyun.cikar(i)`.
- **`SO.tarifler`**: `[{ id, ad, sinif: 'el' | 'masa', girdi: { tur: adet }, cikti: { tur: adet }, teknoloji: id | null }]`; `SO.oyun.uretebilir(id)` → `{ ok, eksik: { tur: adet }, kilitli }`, `SO.oyun.uret(id)` → bool. `sinif: 'masa'` tarifler yalnız üretim masasının yanında (`SO.yapi.yakin('uretim_masasi')`).
- **`SO.teknoloji`**: `[{ id, ad, seviye, puan, acik }]` (seviye: açılabildiği en düşük oyuncu seviyesi; puan: maliyet); `SO.oyun.teknolojiAc(id)` → `{ ok, neden }`.
- **`SO.oyun.dinle(fn)`**: durum her değiştiğinde (can, açlık, xp, seviye, eller, teknoloji) `fn(ne)` çağrılır (`ne`: `'can' | 'aclik' | 'xp' | 'seviye' | 'el' | 'teknoloji' | 'puan'`). Envanter için `SO.envanter.dinle`.
- **`SO.oyun.xpVer(n)`**, **`SO.oyun.puanVer(n)`**, **`SO.oyun.hasar(n)`**, **`SO.oyun.ye(id)`**.
- **Vurma:** `SO.input.vur` (düğme basılıyken true; arayüz ya da klavye `F` yazar). oyun.js okur: önündeki nesneye (ağaç, kaya) elindeki alete göre vurur; hareket katmanı `anim/vurus.js`.
- Kayıt: `localStorage` anahtarı `acik-dunya-oyun-v1` (try/catch; `?test` kipinde yok).

## `yapi.js` (inşa) sağlar
- **`SO.yapilar`**: `[{ id, ad, sinif: 'yapi' | 'esya', girdi: { tur: adet }, teknoloji: id | null, simge }]` (duvar, zemin, çatı, çit, kapı, yatak, masa, üretim masası, fırın, kamp ateşi…).
- **`SO.yapi.basla(id)`**: yerleştirme kipini açar (önünde yarı saydam önizleme; ızgaraya oturur); **`SO.yapi.onayla()`**, **`SO.yapi.iptal()`**, **`SO.yapi.dondur()`**; `SO.yapi.kip` (`null` | `{ id, uygun }`); **`SO.yapi.yakin(id, r)`** → yakındaki yapı ya da null; `SO.yapi.dinle(fn)`.
- Malzemeyi `SO.envanter.harca` ile düşer; `SO.oyun.uretebilir` benzeri denetim için `SO.yapi.yapabilir(id)` → `{ ok, eksik, kilitli }`.
- Çarpışma: yerleştirilen yapıların kutularını `SO.world.ekKutular` dizisine yazar (arazi.js bunu `solids`'e katar).
- Kayıt: `acik-dunya-yapi-v1`.

## `arayuz.js` (arayüz) sağlar
- Ekran düzeni `docs/YOL_HARITASI.md`'de. Yalnız okur ve yukarıdaki işlevleri çağırır; oyun durumunu kendi tutmaz.
- `SO.arayuz.bildir(metin)`: kısa bildirim (ör. "+1 odun", "Seviye 2").
- Paneller: çanta (envanter ızgarası; eşyaya dokununca yuvaya kuşanma/yeme), çekiç (iki sekme: "Yapı" = `SO.yapilar`, "El işi" = `SO.tarifler`; yapılabilenler belirgin, eksik malzeme kırmızı), tablet (`SO.teknoloji`: seviye sırasına göre; kilitli/açılabilir/açık).
- Yerleştirme kipindeyken (`SO.yapi.kip`) ekranda "Yerleştir", "Döndür", "İptal" düğmeleri.
