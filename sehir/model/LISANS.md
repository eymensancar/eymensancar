# Modeller ve hareketler

Hepsi **CC0 1.0 (kamu malı)**, yapımcı Quaternius (https://quaternius.com). Atıf zorunlu değil; teşekkür olarak adını anıyoruz.

| Dosya | Kaynak paket | Not |
|---|---|---|
| `hareketler.wasm` | Universal Animation Library [Standard] (itch.io: quaternius/universal-animation-library) | 43 hareket, 65 kemikli iskelet; yerinde (kök hareketsiz) sürüm |
| `hareketler2.wasm` | Universal Animation Library 2 [Standard] (itch.io: quaternius/universal-animation-library-2) | 42 hareket daha (1 m tırmanma, ağaç kesme, ekip biçme, taşıma, kılıç, kayma...); aynı iskelet |
| `insan.json`, `insan.wasm`, `ten.jpg`, `ten-koyu.jpg`, `goz.png` | Universal Base Characters [Standard] (Superhero_Male_FullBody) | Aynı iskelet. Normal ve pürüz haritaları çıkarıldı, ten dokusu 1024 px'e küçültüldü |
| `sac.json`, `sac.wasm` | Universal Base Characters [Standard] (Hair_SimpleParted) | Dokusuz; renk kodda veriliyor |

Dosya uzantıları: yayınlandığı yer `.glb`, `.gltf` ve `.bin` uzantılarını sunmadığı için model dosyaları `.wasm` (ikili veri) ve `.json` (glTF metni) adıyla duruyor. İçerik aynı: `hareketler.wasm` bir GLB dosyasıdır, `insan.json`/`sac.json` glTF'tir.
