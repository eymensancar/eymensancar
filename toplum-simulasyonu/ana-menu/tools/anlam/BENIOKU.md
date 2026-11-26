# Anlam modeli (deneme)

Bilgi bankası (SSS) araması kelime benzerliğine (TF-IDF) dayanıyor. Bu klasördeki küçük cümle gömme modeli, kelimeleri tutmayan
ama aynı anlama gelen soruları da bulmak için var. İnternetsiz çalışır. Henüz oyuna (index.html) bağlı değil.

- Model: multilingual-e5-small (MIT lisansı; Hugging Face `intfloat/multilingual-e5-small`, ONNX dönüşümü `Xenova/multilingual-e5-small`,
  `onnx/model_quantized.onnx`; 12 katman, 384 boyut, int8). Aslı 118 MB, sözlüğü 250 binden 40 bine budanınca 37,7 MB. Girdinin başına `query: ` eklenir.
  Kıyaslanan paraphrase-multilingual-MiniLM-L12-v2 (Apache-2.0, aynı boyut) bankada bir-dışarıda aramada daha zayıftı (%54 / %66; TF-IDF %46).
- `npc-yz.js`: `NPCYZ.gommeAyar(fn, {a, c0, c1})`. `fn(metin)` senkron, birim uzunlukta `Float32Array` ya da `null` döndürür.
  Kanca yoksa, `npc-sss-gomme.js` yüklenmemişse ya da banka değişip vektörler eskimişse (imza tutmazsa) eski davranış sürer.
  Skor = (1 − a) × kelime benzerliği + a × anlam; anlam = kosinüsün [c0, c1] aralığında 0-1'e çekilmiş hâli.
- `npc-sss-gomme.js` (kökte, üretilir): bankadaki her soruluşun iki vektörü (Türkçe harfli ve harfsiz yazılış), int8.
- Doğrulama (aynı onnxruntime ile budanmış / asıl): oyun metinlerinden 600 cümlede kosinüs 1,000000 (birebir); oyunda geçmeyen 80
  gündelik cümlede ortalama 0,9989, en düşük 0,983 (71/80 birebir). Model yeri bu oturumda: geçici klasör, `tools/anlam/model/model.onnx` bağlantısı.

## Dosyalar

| Dosya | Ne yapar |
| --- | --- |
| `anlam-sozcuk.js` | Unigram parçalayıcı (tarayıcı ve Node). Asıl parçalayıcıyla aynı sonucu verir (182 bin metinde fark yalnız 128 parçadan uzun 6 metinde, kırpma). |
| `sozluk.json` | Budanmış sözlük: 40.000 parça (`eski` = asıl modeldeki kimlikler). |
| `budama-sec.cjs` | Tutulacak parçaları seçer: oyunun Türkçe metinlerinde geçenler + harfler, rakamlar, noktalama + en sık Latin/Türkçe parçalar. |
| `budama.py` | ONNX'teki kelime gömme matrisinden yalnız tutulan satırları bırakır (ölçek aynı, satırlar birebir). |
| `anlam-node.cjs` | Node'da senkron sağlayıcı: onnxruntime-node bir işçide, ana iş parçacığı `Atomics.wait` ile bekler. İsteğe bağlı disk önbelleği. |
| `gomme-derle.cjs` | Bankanın vektörlerini hesaplayıp `npc-sss-gomme.js`'i yazar. **Banka (`npc-sss.js`) değişince yeniden çalıştırılır.** |
| `anlam-tarayici.js` | Tasarı: oyunda onnxruntime-web (wasm) ile aynı kancayı doldurmak. |
| `model/model.onnx` | Budanmış model. Depoya girmez (`.gitignore`). |

## Modeli yeniden üretmek

```bash
# 1) Asıl model: https://huggingface.co/Xenova/multilingual-e5-small → onnx/model_quantized.onnx ve tokenizer.json
# 2) Budama (Python'da onnx ve numpy gerekir: pip install onnx)
node tools/anlam/korpus.cjs            # -> tools/anlam/korpus.txt
node tools/anlam/budama-sec.cjs <tokenizer.json> tools/anlam/korpus.txt 40000 tools/anlam/sozluk.json
python3 tools/anlam/budama.py <model_quantized.onnx> tools/anlam/sozluk.json tools/anlam/model/model.onnx
# 3) Bankanın vektörleri (onnxruntime-node gerekir; başka klasördeyse ANLAM_MODUL=<node_modules'un bulunduğu klasör>)
node tools/anlam/gomme-derle.cjs
# 4) Ölçüm
node tools/sohbet-sinav.cjs --korpus7 --tohum=3 --anlam      # ANLAM_AYAR=a,c0,c1 ile karışım ayarı
```

`korpus.txt`: oyunun Türkçe metinleri, satır başına bir cümle (korpus3-4 eğitim, sss, iplik, npc-dil/npc-yz/npc-iplik metin
sabitleri, geliştirme diyalogları; saklı setler hariç).

## Ölçüm (26 Kasım 2026, geliştirme setleri, 3 tohum; tamamen doğru tur)

| Set | Önce | Anlam modeliyle |
| --- | --- | --- |
| korpus7 | 358/675 | 361/675 |
| korpus6 | 630/984 | 630/984 |
| korpus5 | 719/1065 | 732/1065 |
| korpus | 546/642 | 546/642 |
| korpus2 geliştirme | 283/360 | 283/360 |
| korpus8 geliştirme (ayarda kullanılmadı) | 351/942 | 370/942 |

Ayar: a = 0,4, c0 = 0,84, c1 = 0,95, yalnız son yolda (kurallar bir şey bulamayınca). Güçlü eşleşme ve erken cevap yollarına da
açınca korpus ve korpus2'de kötüleşti. Bu modelin kosinüsleri sıkışık (ilgisiz cümleler 0,80-0,86, aynı kayıt 0,84-0,94);
c0 o yüzden yüksek.

Hız: bir mesaj onnxruntime-node'da 2,7 ms, onnxruntime-web wasm (tek iş parçacığı, SIMD) ile 21 ms; banka taraması JS'te 5 ms;
modelin yüklenmesi 0,5 sn. Telefonda wasm 2-3 kat yavaş olabilir (40-60 ms), NPC'ler zaten "yazıyor…" ile cevap verdiği için fark edilmez.

## Tarayıcıya taşıma (yapılmadı)

`anlam-tarayici.js`: onnxruntime-web (wasm, tek iş parçacığı; iOS WKWebView'da SharedArrayBuffer yok) ile model açılıştan sonra
boşta yüklenir. Oyuncu mesaj gönderince `NPCYZ.oyuncuMesaji`'ndan önce `await AnlamTarayici.hazirla([metin, bağlam + ' ' + metin])`
vektörleri önbelleğe koyar; kanca senkron kalır ve önbellekte yoksa `null` döner (o arama eski yoldan). Uygulamaya eklenecekler:
model 37,7 MB + `sozluk.json` 1 MB + `npc-sss-gomme.js` 5,7 MB = 44,4 MB; çalıştırıcı onnxruntime-web'in `ort-wasm-simd-threaded.wasm`
dosyası da 14,8 MB (toplam ~59 MB diskte; sıkıştırılmış indirmede wasm ~4 MB'a iner). 50 MB'ın altına inmek için: sözlük 30 bine
(−3,8 MB), vektör dosyası ikili `.bin` (5,7 → 4,4 MB) ya da soruluş başına tek vektör (2,2 MB).
