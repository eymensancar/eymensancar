// TASARI (henüz index.html'e bağlı değil): oyunda anlam modelini onnxruntime-web (wasm) ile çalıştırır ve
// npc-yz.js'in senkron kancasını (NPCYZ.gommeAyar) önceden hesaplanmış vektörlerle doldurur.
// Gerekenler (www/ içine, internetsiz): ort.wasm.min.js + ort-wasm-simd-threaded.wasm (onnxruntime-web), anlam-sozcuk.js,
// anlam/model.onnx (budanmış, ~38 MB), anlam/sozluk.json, npc-sss-gomme.js.
// Akış:
//   1. Açılıştan sonra boşta: AnlamTarayici.yukle() modeli indirir/okur ve oturumu kurar (arka planda; oyunu bekletmez).
//   2. Oyuncu mesaj gönderince, NPCYZ.oyuncuMesaji'ndan ÖNCE: await AnlamTarayici.hazirla([metin, bağlam + ' ' + metin])
//      (NPC'ler zaten "yazıyor…" ile geç cevap verdiği için 10-40 ms fark edilmez). Hazır değilse beklemez.
//   3. Kanca senkron: önbellekte varsa vektörü verir, yoksa null (npc-yz o arama için eski kelime benzerliğine döner).
(function (g) {
  const BOY = 384, ON_EK = 'query: ';
  let ses = null, parcala = null, yukleniyor = null; const bellek = new Map();
  async function yukle(kok = 'anlam/') {
    if (ses) return true; if (yukleniyor) return yukleniyor;
    yukleniyor = (async () => {
      const ort = g.ort; if (!ort) return false;
      ort.env.wasm.numThreads = 1; // iOS WKWebView'da SharedArrayBuffer yok (çapraz köken yalıtımı gerekir): tek iş parçacığı
      parcala = g.AnlamSozcuk.kur(await (await fetch(kok + 'sozluk.json')).json());
      ses = await ort.InferenceSession.create(kok + 'model.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      g.NPCYZ && g.NPCYZ.gommeAyar(metin => bellek.get(String(metin).trim()) || null);
      return true;
    })().catch(e => { console.warn('anlam modeli yüklenemedi', e); return false; });
    return yukleniyor;
  }
  async function gomme(metin) {
    const ids = parcala(ON_EK + metin), n = ids.length, ort = g.ort;
    const t = a => new ort.Tensor('int64', BigInt64Array.from(a, x => BigInt(x)), [1, n]);
    const r = await ses.run({ input_ids: t(ids), attention_mask: t(ids.map(() => 1)), token_type_ids: t(ids.map(() => 0)) });
    const h = r.last_hidden_state.data, v = new Float32Array(BOY);
    for (let i = 0; i < n; i++) for (let k = 0; k < BOY; k++) v[k] += h[i * BOY + k];
    let s = 0; for (let k = 0; k < BOY; k++) s += v[k] * v[k]; s = Math.sqrt(s) || 1; for (let k = 0; k < BOY; k++) v[k] /= s;
    return v;
  }
  /** Metinleri npc-yz'nin arayacağı biçimde (normal().kucuk ve .katli) önceden hesaplar. */
  async function hazirla(metinler) {
    if (!ses) return false; const D = g.NPCDil;
    for (const m of metinler) { if (!m) continue; const n = D.normal(m); for (const x of new Set([n.kucuk, n.katli])) if (x && !bellek.has(x)) { bellek.set(x, await gomme(x)); if (bellek.size > 200) bellek.delete(bellek.keys().next().value); } }
    return true;
  }
  g.AnlamTarayici = { yukle, hazirla };
})(typeof window !== 'undefined' ? window : globalThis);
