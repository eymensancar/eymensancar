#!/bin/bash
# Oyunun tarayıcıda anlam modelini çalıştırması için anlam/ klasörünü doldurur (bu dosyalar depoya girmez):
#   anlam/ort.wasm.min.js, ort-wasm-simd-threaded.mjs, ort-wasm-simd-threaded.wasm  (onnxruntime-web 1.22.0, yalnız wasm)
#   anlam/model.onnx.1 .. N  (tools/anlam/model/model.onnx, 12 MB'lık parçalar: artifact'te dosya başına 15 MB sınırı var)
#   anlam/model.json         (parçaların listesi)
# Kullanım (ana-menu klasöründe): bash tools/anlam/tarayici-dosyalari.sh
set -e
cd "$(dirname "$0")/../.."
ORT=1.22.0; MODEL=${ANLAM_MODEL:-tools/anlam/model/model.onnx}
[ -f "$MODEL" ] || { echo "model yok: $MODEL (BENIOKU.md: modeli yeniden üretmek)"; exit 1; }
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
curl -sfL "https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-$ORT.tgz" | tar xz -C "$t"
mkdir -p anlam
for f in ort.wasm.min.js ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm; do cp "$t/package/dist/$f" anlam/; done
sed -i '/sourceMappingURL/d' anlam/ort.wasm.min.js anlam/ort-wasm-simd-threaded.mjs
rm -f anlam/model.onnx.*
split -b 12000000 -d -a 1 "$MODEL" anlam/model.onnx.
node -e "const fs=require('fs');const p=fs.readdirSync('anlam').filter(f=>/^model\.onnx\.\d$/.test(f)).sort();fs.writeFileSync('anlam/model.json',JSON.stringify({parcalar:p,bayt:fs.statSync('$MODEL').size}));console.log('anlam/model.json:',p.join(' '))"
du -cb anlam/* npc-sss-gomme.bin anlam-sozcuk.js anlam-tarayici.js | tail -1 | awk '{printf "toplam %.1f MB (anlam/ + npc-sss-gomme.bin + js)\n", $1/1e6}'
