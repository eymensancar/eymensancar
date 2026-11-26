// Anlam modeli, tarayıcı (ve iPhone uygulamasındaki WKWebView): onnxruntime-web (wasm, tek iş parçacığı) ile çalışır ve
// npc-yz.js'in senkron kancasını (NPCYZ.gommeAyar) önceden hesaplanmış vektörlerle doldurur.
// Dosyalar: anlam-sozcuk.js, npc-sss-gomme.bin, anlam/sozluk.json, anlam/model.json + model.onnx.N, anlam/ort.wasm.min.js,
// anlam/ort-wasm-simd-threaded.{mjs,wasm} (bash tools/anlam/tarayici-dosyalari.sh üretir).
// Akış:
//   1. AnlamTarayici.yukle(): açılıştan birkaç saniye sonra, boşta, arka planda. Oyunu bekletmez. Bir dosya yoksa ya da
//      tarayıcı desteklemiyorsa sessizce vazgeçer: NPC'ler eski kelime benzerliğiyle devam eder.
//   2. Oyuncu mesaj gönderince, NPCYZ.oyuncuMesaji / dmGonder'den ÖNCE: await AnlamTarayici.hazirla(NPCYZ.gommeMetinleri(...))
//      (yalnız model hazırsa; en çok BEKLE ms). NPC'ler zaten "yazıyor…" ile geç cevap verdiği için fark edilmez.
//   3. Kanca senkron: önbellekte varsa vektörü verir, yoksa null (o arama eski yoldan).
(function (g) {
  'use strict';
  const BOY = 384, ON_EK = 'query: ', BEKLE = 400;
  let ses = null, ort = null, parcala = null, yukleniyor = null, sira = Promise.resolve();
  const bellek = new Map();
  const ist = { durum: 'yok', yukMs: 0, gomme: 0, gommeMs: 0, isabet: 0, iska: 0, hata: null };
  const betik = src => new Promise((ok, red) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = () => red(new Error(src + ' yüklenemedi')); document.head.appendChild(s); });
  const al = async (url, tur) => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return tur === 'json' ? r.json() : r.arrayBuffer(); };
  /** Modeli yükler; true = hazır. Hata olursa false (bir daha denemez). */
  function yukle(o) {
    if (yukleniyor) return yukleniyor;
    const kok = (o && o.kok) || 'anlam/', t0 = performance.now(); ist.durum = 'yukleniyor';
    yukleniyor = (async () => {
      if (typeof WebAssembly !== 'object' || !g.NPCYZ || !g.NPCYZ.gommeAyar || !g.AnlamSozcuk) throw new Error('desteklenmiyor');
      // Önce küçük dosyalar: banka eskiyse (npc-sss.js değişip vektörler yeniden üretilmediyse) modeli hiç indirme
      if (!g.NPCYZ.gommeBanka(await al('npc-sss-gomme.bin'))) throw new Error('npc-sss-gomme.bin eski');
      parcala = g.AnlamSozcuk.kur(await al(kok + 'sozluk.json', 'json'));
      if (!g.ort) await betik(kok + 'ort.wasm.min.js'); ort = g.ort;
      ort.env.wasm.numThreads = 1; // iOS WKWebView'da SharedArrayBuffer yok (çapraz köken yalıtımı gerekir): tek iş parçacığı
      ort.env.wasm.wasmPaths = new URL(kok, location.href).href;
      const man = await al(kok + 'model.json', 'json'), bayt = new Uint8Array(man.bayt); let o2 = 0;
      for (const p of man.parcalar) { const b = new Uint8Array(await al(kok + p)); bayt.set(b, o2); o2 += b.length; }
      if (o2 !== man.bayt) throw new Error('model eksik');
      ses = await ort.InferenceSession.create(bayt, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      await gomme('merhaba'); // ilk çalıştırma yavaştır; oyuncunun ilk mesajına kalmasın
      g.NPCYZ.gommeAyar(metin => { const v = bellek.get(metin); if (v) { ist.isabet++; return v; } ist.iska++; return null; });
      ist.durum = 'hazir'; ist.yukMs = Math.round(performance.now() - t0); return true;
    })().catch(e => { ist.durum = 'hata'; ist.hata = String(e && e.message || e); ses = null; try { g.NPCYZ && g.NPCYZ.gommeAyar(null); } catch (e2) { } return false; });
    return yukleniyor;
  }
  async function gomme(metin) {
    const t0 = performance.now(), ids = parcala(ON_EK + metin), n = ids.length;
    const T = a => new ort.Tensor('int64', BigInt64Array.from(a, x => BigInt(x)), [1, n]);
    const r = await ses.run({ input_ids: T(ids), attention_mask: T(ids.map(() => 1)), token_type_ids: T(ids.map(() => 0)) });
    const h = r.last_hidden_state.data, v = new Float32Array(BOY);
    for (let i = 0; i < n; i++) for (let k = 0; k < BOY; k++) v[k] += h[i * BOY + k];
    let s = 0; for (let k = 0; k < BOY; k++) s += v[k] * v[k]; s = Math.sqrt(s) || 1; for (let k = 0; k < BOY; k++) v[k] /= s;
    ist.gomme++; ist.gommeMs += performance.now() - t0; return v;
  }
  /** Kancanın isteyeceği metinleri (NPCYZ.gommeMetinleri) önceden hesaplar. Model hazır değilse hemen döner; en çok BEKLE ms bekletir. */
  function hazirla(metinler) {
    if (!ses || !metinler || !metinler.length) return Promise.resolve(false);
    const is = sira.then(async () => { for (const m of metinler) if (m && !bellek.has(m)) { bellek.set(m, await gomme(m)); if (bellek.size > 300) bellek.delete(bellek.keys().next().value); } return true; });
    sira = is.catch(() => { });
    return Promise.race([is, new Promise(r => setTimeout(() => r(false), BEKLE))]).catch(() => false);
  }
  g.AnlamTarayici = { yukle, hazirla, hazir: () => !!ses, ist };
})(typeof window !== 'undefined' ? window : globalThis);
