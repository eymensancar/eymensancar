// Anlam modeli, Node için senkron gömme sağlayıcı (sınav ve derleme betikleri için).
// onnxruntime-node bir işçi iş parçacığında çalışır; ana iş parçacığı Atomics.wait ile sonucu bekler,
// böylece senkron çalışan sohbet-sinav.cjs içinden NPCYZ.gommeAyar(fn) ile kullanılabilir.
//   const g = require('./anlam-node.cjs')({ model, sozluk, modulKoku, onEk });  g('metin') -> Float32Array(384) (birim uzunlukta)
'use strict';
const { Worker, isMainThread, workerData, parentPort } = require('worker_threads');
const path = require('path'), fs = require('fs');
const BOY = 384;
if (isMainThread) {
  module.exports = function kur(o) {
    const sab = new SharedArrayBuffer(4 + 4 * BOY), bayrak = new Int32Array(sab, 0, 1), cikti = new Float32Array(sab, 4, BOY);
    const w = new Worker(__filename, { workerData: Object.assign({}, o, { sab }) }); w.unref();
    let hazir = false, yeni = 0; const bellek = new Map(); let sure = 0, sayi = 0;
    // İsteğe bağlı disk önbelleği (aynı metin bir daha hesaplanmaz; sınavı tekrar tekrar çalıştırırken hız için)
    const coz = v => { const b = Buffer.from(v, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
    if (o.onbellek && fs.existsSync(o.onbellek)) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(o.onbellek, 'utf8')))) bellek.set(k, coz(v));
    if (o.onbellek) process.on('exit', () => { if (!yeni) return; let eski = {}; try { eski = JSON.parse(fs.readFileSync(o.onbellek, 'utf8')); } catch (e) { } for (const [k, v] of bellek) if (!eski[k]) eski[k] = Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64'); fs.writeFileSync(o.onbellek, JSON.stringify(eski)); });
    function iste(msg) { Atomics.store(bayrak, 0, 0); w.postMessage(msg); while (Atomics.wait(bayrak, 0, 0, 120000) === 'timed-out') throw new Error('anlam modeli cevap vermedi'); if (bayrak[0] < 0) throw new Error('anlam modeli hata verdi'); }
    function gomme(metin) {
      metin = String(metin || '').trim(); if (!metin) return null;
      const b = bellek.get(metin); if (b) return b;
      if (!hazir) { iste({ tur: 'hazir' }); hazir = true; }
      const t0 = performance.now(); iste({ tur: 'gomme', metin }); sure += performance.now() - t0; sayi++;
      const v = Float32Array.from(cikti); bellek.set(metin, v); yeni++; return v;
    }
    gomme.istatistik = () => ({ sayi, ortMs: sayi ? sure / sayi : 0 });
    gomme.kapat = () => w.terminate();
    return gomme;
  };
} else {
  const { model, sozluk, modulKoku, onEk = '', sab } = workerData;
  const bayrak = new Int32Array(sab, 0, 1), cikti = new Float32Array(sab, 4, BOY);
  const ort = require(require.resolve('onnxruntime-node', { paths: [modulKoku || __dirname] }));
  const parcala = require(path.join(__dirname, 'anlam-sozcuk.js')).kur(JSON.parse(fs.readFileSync(sozluk, 'utf8')));
  let ses = null;
  const bitir = k => { Atomics.store(bayrak, 0, k); Atomics.notify(bayrak, 0); };
  parentPort.on('message', async m => {
    try {
      if (!ses) ses = await ort.InferenceSession.create(model, { intraOpNumThreads: 1, interOpNumThreads: 1, graphOptimizationLevel: 'all' });
      if (m.tur === 'gomme') {
        const ids = parcala(onEk + m.metin), n = ids.length;
        const big = a => BigInt64Array.from(a, x => BigInt(x));
        const r = await ses.run({ input_ids: new ort.Tensor('int64', big(ids), [1, n]), attention_mask: new ort.Tensor('int64', big(ids.map(() => 1)), [1, n]), token_type_ids: new ort.Tensor('int64', new BigInt64Array(n), [1, n]) });
        const h = r.last_hidden_state.data; cikti.fill(0);
        for (let t = 0; t < n; t++) for (let k = 0; k < BOY; k++) cikti[k] += h[t * BOY + k];
        let s = 0; for (let k = 0; k < BOY; k++) s += cikti[k] * cikti[k]; s = Math.sqrt(s) || 1; for (let k = 0; k < BOY; k++) cikti[k] /= s;
      }
      bitir(1);
    } catch (e) { console.error(e); bitir(-1); }
  });
}
