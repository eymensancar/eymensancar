# Anlam modeli

Bilgi bankası (SSS) araması kelime benzerliğine (TF-IDF) dayanıyor. Küçük bir cümle gömme modeli, kelimeleri tutmayan ama aynı
anlama gelen soruları da bulur. İnternetsiz, telefonda çalışır. Oyuna bağlı (`index.html`); dosyalar yoksa ya da tarayıcı
desteklemiyorsa oyun sessizce eski yoldan devam eder.

- Model: multilingual-e5-small (MIT lisansı; Hugging Face `intfloat/multilingual-e5-small`, ONNX dönüşümü `Xenova/multilingual-e5-small`,
  `onnx/model_quantized.onnx`; 12 katman, 384 boyut, int8). Aslı 118 MB, sözlüğü 250 binden 30 bine budanınca 33,8 MB. Girdinin başına `query: ` eklenir.
  Kıyaslanan paraphrase-multilingual-MiniLM-L12-v2 (Apache-2.0, aynı boyut) bankada bir-dışarıda aramada daha zayıftı (%54 / %66; TF-IDF %46).
- `npc-yz.js`: `NPCYZ.gommeAyar(fn, ayar)` (kanca: `fn(metin)` senkron, birim uzunlukta `Float32Array` ya da `null`),
  `NPCYZ.gommeBanka(ArrayBuffer)` (bankanın vektörleri), `NPCYZ.gommeMetinleri(meta, kanal, metin)` (bu mesaj için kancanın
  isteyebileceği metinler; tarayıcı bunları önceden hesaplar), `NPCYZ.gommeKullanim` (sayaç).
  Kanca ya da vektörler yoksa, ya da banka değişip vektörler eskimişse (imza tutmazsa) eski davranış sürer.
  Skor = 0,6 × kelime benzerliği + 0,4 × anlam (kosinüs [0,84, 0,95] aralığında 0-1'e çekilir), yalnız kuralların bir şey
  bulamadığı son yolda. Güçlü eşleşme ve erken cevap yollarına da açınca korpus ve korpus2 geliştirmede kötüleşti.
- Doğrulama (aynı onnxruntime ile budanmış / asıl): oyun metinlerinden 600 cümlede kosinüs 1,000000 (birebir); oyunda geçmeyen 80
  gündelik cümlede ortalama 0,9985, en düşük 0,983 (68/80 birebir). Parçalayıcı asıl parçalayıcıyla 182 bin metinde aynı
  (fark yalnız 128 parçadan uzun 6 metinde, kırpma).

## Dosyalar

| Dosya | Depoda | Ne yapar |
| --- | --- | --- |
| `anlam-tarayici.js` | evet | Tarayıcı: modeli açılıştan 4 sn sonra boşta yükler, mesaj başına vektörleri önceden hesaplar, kancayı doldurur. |
| `anlam-sozcuk.js` | evet | Unigram parçalayıcı (tarayıcı ve Node). |
| `npc-sss-gomme.bin` | evet (2,2 MB) | Bankadaki 5724 soruluşun vektörleri (int8, soruluş başına bir, harfsiz yazılış). **`npc-sss.js` değişince `node tools/anlam/gomme-derle.cjs`.** |
| `anlam/sozluk.json` | evet | Budanmış sözlük (30.000 parça). |
| `anlam/model.onnx.0-2`, `model.json` | hayır | Budanmış model, 12 MB'lık parçalar (artifact'te dosya başına 15 MB sınırı). |
| `anlam/ort.wasm.min.js`, `ort-wasm-simd-threaded.{mjs,wasm}` | hayır | onnxruntime-web 1.22.0, yalnız wasm (SIMD; tek iş parçacığıyla çalışır). |
| `tools/anlam/model/model.onnx` | hayır | Budanmış modelin tek parça hâli (Node araçları için). |
| `tools/anlam/korpus.cjs` | evet | Oyunun Türkçe metinlerini toplar (saklı setler hariç) -> `korpus.txt`. |
| `tools/anlam/budama-sec.cjs`, `budama.py` | evet | Tutulacak parçaları seçer; ONNX'teki kelime gömme matrisini o satırlara indirir (birebir kopya). |
| `tools/anlam/sozluk-kimlik.json` | evet | Tutulan parçaların asıl modeldeki kimlikleri (budama.py için). |
| `tools/anlam/anlam-node.cjs` | evet | Node'da senkron sağlayıcı (onnxruntime-node bir işçide, `Atomics.wait`); isteğe bağlı disk önbelleği. |
| `tools/anlam/gomme-derle.cjs` | evet | `npc-sss-gomme.bin`'i üretir (`--iki`: soruluş başına iki vektör, 4,4 MB). |
| `tools/anlam/tarayici-dosyalari.sh` | evet | `anlam/` klasörünü doldurur (onnxruntime-web npm'den, model parçaları). |
| `tools/anlam/tarayici-test.cjs` | evet | Playwright: model yükleniyor mu, NPC cevap veriyor mu, gömme kullanıldı mı, süre; model yokken eski yol. |

## Boyut (diskte, oyuna eklenen)

| Dosya | MB |
| --- | --- |
| model (3 parça) | 33,81 |
| onnxruntime-web wasm | 11,21 |
| `npc-sss-gomme.bin` | 2,22 |
| `anlam/sozluk.json` | 0,59 |
| js (ort.wasm.min.js, .mjs, anlam-*.js) | 0,08 |
| **Toplam** | **47,9** |

Sıkıştırılınca (indirme) model 24,6 MB, wasm 2,9 MB. Seçenekler: soruluş başına iki vektör (+2,2 MB, geliştirme setlerinde
+3 tur), sözlük 40 bin (+3,8 MB, geliştirme setlerinde fark yok; oyunda geçmeyen cümlelerde kosinüs 0,9985 yerine 0,9987).
onnxruntime-web 1.17.3'ün iş parçacıksız `ort-wasm-simd.wasm`'ı 10,55 MB (0,66 MB küçük) ama eski sürüm, denenmedi.

## Hız

| Nerede | Yükleme | Bir mesajın gömmesi |
| --- | --- | --- |
| Node, onnxruntime-node | 0,5 sn | 2,7 ms |
| Chromium (masaüstü, Playwright), wasm tek iş parçacığı | 1,1 sn (açılıştan 4 sn sonra başlar) | 38 ms |
| WebKit (masaüstü, Playwright) | 1,0 sn | 32 ms |

Bir mesajda 1-3 metin hesaplanır (oyuncunun yazdığı, harfsiz hâli, kısa takip sorusunda önceki mesajla birlikte). Oyuncunun
mesajı en çok 0,4 sn bekletilir (ölçüm: 70-200 ms), sonra cevap akışı her zamanki gibi. Telefonda wasm 2-3 kat yavaş olabilir.
Model yüklenmeden gelen ilk mesaj beklemeden eski yoldan gider.

## Yeniden üretmek

```bash
cd toplum-simulasyonu/ana-menu
# 1) Asıl model: https://huggingface.co/Xenova/multilingual-e5-small -> onnx/model_quantized.onnx ve tokenizer.json
# 2) Budama (Python'da onnx ve numpy: pip install onnx)
node tools/anlam/korpus.cjs                       # -> tools/anlam/korpus.txt
node tools/anlam/budama-sec.cjs <tokenizer.json> tools/anlam/korpus.txt 30000 anlam/sozluk.json   # + anlam/sozluk-kimlik.json
mv anlam/sozluk-kimlik.json tools/anlam/
python3 tools/anlam/budama.py <model_quantized.onnx> tools/anlam/sozluk-kimlik.json tools/anlam/model/model.onnx
# 3) Bankanın vektörleri (onnxruntime-node; başka klasördeyse ANLAM_MODUL=<node_modules'un bulunduğu klasör>)
node tools/anlam/gomme-derle.cjs                  # -> npc-sss-gomme.bin
# 4) Tarayıcı dosyaları (model parçaları ve onnxruntime-web)
bash tools/anlam/tarayici-dosyalari.sh            # -> anlam/
# 5) Ölçüm ve deneme
node tools/sohbet-sinav.cjs --korpus7 --tohum=3 --anlam     # ANLAM_AYAR=a,c0,c1,yol ile karışım ayarı
python3 -m http.server 8850 & node tools/anlam/tarayici-test.cjs chromium
```

Not: `korpus.txt` budamada kullanılan metinler; içinde `npc-yz.js` vb. metin sabitleri olduğu için kod değişince biraz değişir,
bu yüzden aynı sözlüğü birebir yeniden üretmek için `anlam/sozluk.json` ve `tools/anlam/sozluk-kimlik.json` depoda tutulur:
yalnız 2. adımın `budama.py` satırı yeter.

Artifact'te yayınlarken `anlam/` dosyaları, `npc-sss-gomme.bin`, `anlam-sozcuk.js`, `anlam-tarayici.js` de dosya olarak gider.

## Ölçüm (26 Kasım 2026, geliştirme setleri, 3 tohum; tamamen doğru / cevabı doğru tur)

| Set | Önce | Anlam (30 bin sözlük, tek vektör; oyundaki) | Anlam (40 bin, iki vektör; ilk deneme) |
| --- | --- | --- | --- |
| korpus7 | 358 / 438 | 361 / 443 | 361 / 443 |
| korpus6 | 630 / 734 | 631 / 735 | 630 / 734 |
| korpus5 | 719 / 798 | 728 / 807 | 732 / 811 |
| korpus | 546 / 576 | 546 / 576 | 546 / 576 |
| korpus2 geliştirme | 283 / 320 | 283 / 320 | 283 / 320 |
| toplam | 2536 / 2866 | 2549 / 2881 | 2552 / 2884 |
| korpus8 geliştirme | 351 / 432 | 369 / 452 | 370 / 453 |
