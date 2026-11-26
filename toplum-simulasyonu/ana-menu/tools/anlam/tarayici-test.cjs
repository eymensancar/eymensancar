// Anlam modeli tarayıcıda: yükleniyor mu, NPC sohbeti cevap veriyor mu, gömme kullanıldı mı, mesaj başına süre; dosya yokken eski yol.
// Kullanım: ana-menu klasöründe `python3 -m http.server 8850`, sonra `node tools/anlam/tarayici-test.cjs [chromium|webkit]`
// (önce bash tools/anlam/tarayici-dosyalari.sh). Tarayıcıda wasm tek iş parçacığı, çapraz köken yalıtımı yok (iOS'taki gibi).
const pw = require('playwright');
const URL = process.env.URL || 'http://localhost:8850/index.html', TUR = process.argv[2] || 'chromium';
let kaldi = 0; const ok = (ad, v, ek) => { if (!v) kaldi++; console.log(v ? 'GEÇTİ' : 'KALDI', ad, ek !== undefined ? JSON.stringify(ek) : ''); };
const MESAJ = ['kum saatini arkadasima gonderebilir miyim', 'maaşlar ne zmn yatiyo', 'muhasebecinin zammı ne sıklıkla geliyo', 'ayni anda iki kursa yazilabilir miyim', 'oyunun amaci ne tam olarak', 'kira ne zaman kesiliyo', 'peki ya dükkan'];
async function oturum(b, ad, ayar = {}) {
  console.log(`\n== ${TUR}: ${ad} ==`);
  const c = await b.newContext({ viewport: { width: 852, height: 393 } }), p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.route('**/index.html*', async r => { const res = await r.fetch(); r.fulfill({ body: '<meta charset="utf-8"><style>[hidden]{display:none!important}</style>' + (await res.body()).toString('utf8'), headers: { 'content-type': 'text/html; charset=utf-8' } }); });
  if (ayar.modelYok) await p.route('**/anlam/model.json', r => r.fulfill({ status: 404, body: '' }));
  const t0 = Date.now(); await p.goto(URL + (ayar.sorgu || '?nosplash'));
  await p.waitForSelector('#kAd'); await p.fill('#kAd', 'Deneme Oyuncu'); await p.click('#kBasla'); await p.waitForTimeout(300);
  await p.evaluate(() => sohbetAc('ulke')); await p.waitForTimeout(200);
  const gonder = async m => {
    const n0 = await p.evaluate(() => K.npc.kanal.ulke.length), s0 = await p.evaluate(() => ({ g: AnlamTarayici.ist.gomme, ms: AnlamTarayici.ist.gommeMs, k: NPCYZ.gommeKullanim.gomme, i: AnlamTarayici.ist.isabet }));
    await p.fill('#shGiris', m); const t = Date.now(); await p.press('#shGiris', 'Enter');
    await p.waitForFunction(n => K.npc.kanal.ulke.length > n, n0, { timeout: 5000 }); const benim = Date.now() - t; // oyuncunun mesajı kanala düştü
    let cevap = null; try { await p.waitForFunction(n => K.npc.kanal.ulke.slice(n).some(x => x.npcId), n0, { timeout: 15000 }); cevap = await p.evaluate(n => K.npc.kanal.ulke.slice(n).find(x => x.npcId).metin, n0); } catch (e) { }
    const s1 = await p.evaluate(() => ({ g: AnlamTarayici.ist.gomme, ms: AnlamTarayici.ist.gommeMs, k: NPCYZ.gommeKullanim.gomme, i: AnlamTarayici.ist.isabet }));
    return { m, benimMs: benim, cevap, gomme: s1.g - s0.g, gommeMs: Math.round(s1.ms - s0.ms), anlamArama: s1.k - s0.k, isabet: s1.i - s0.i };
  };
  // İlk mesaj model yüklenmeden (açılıştan hemen sonra): beklemeden eski yol
  const ilk = await gonder('selam millet nasilsiniz'); ok('ilk mesaj model yüklenmeden hemen gitti, cevap geldi', ilk.benimMs < 1000 && !!ilk.cevap, ilk);
  let durum; if (ayar.beklenen !== 'yok') try { await p.waitForFunction(() => ['hazir', 'hata'].includes(AnlamTarayici.ist.durum), null, { timeout: 90000 }); } catch (e) { }
  durum = await p.evaluate(() => Object.assign({}, AnlamTarayici.ist, { bellekMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }));
  console.log('  model durumu:', JSON.stringify(durum), 'sayfa açılışından', Date.now() - t0, 'ms');
  const sonuc = [];
  for (const m of MESAJ) { const r = await gonder(m); sonuc.push(r); console.log('  ', JSON.stringify(r)); await p.waitForTimeout(500); }
  if (ayar.beklenen === 'hazir') {
    ok('model yüklendi', durum.durum === 'hazir', durum.hata);
    ok('her mesaja NPC cevabı geldi', sonuc.every(r => r.cevap));
    ok('gömme hesaplandı ve anlam modeli aramada kullanıldı', sonuc.some(r => r.gomme > 0) && sonuc.some(r => r.anlamArama > 0 && r.isabet > 0));
    const ort = sonuc.filter(r => r.gomme).reduce((a, r) => a + r.gommeMs / r.gomme, 0) / Math.max(1, sonuc.filter(r => r.gomme).length);
    const tum = await p.evaluate(() => AnlamTarayici.ist); ok('kancanın istediği vektörler önceden hazırdı (isabet / ıska)', tum.isabet > 0 && tum.isabet >= tum.iska, [tum.isabet, tum.iska]);
    ok('mesaj başına gömme süresi makul (< 300 ms)', ort < 300, Math.round(ort) + ' ms/gömme');
    ok('oyuncunun mesajı gecikmedi (< 1 sn)', sonuc.every(r => r.benimMs < 1000), sonuc.map(r => r.benimMs));
  } else {
    ok('model yok/kapalı: durum ' + ayar.beklenen, durum.durum === ayar.beklenen, durum);
    ok('model yokken de her mesaja cevap geldi (eski yol)', sonuc.every(r => r.cevap));
    ok('model yokken gömme yok', sonuc.every(r => !r.gomme && !r.anlamArama));
  }
  ok('sayfa hatası yok', !errs.length, errs.slice(0, 3));
  await c.close();
}
(async () => {
  const b = await pw[TUR].launch();
  await oturum(b, 'model yükleniyor ve kullanılıyor', { beklenen: 'hazir' });
  await oturum(b, 'model dosyası yok: sessizce eski yol', { beklenen: 'hata', modelYok: true });
  await oturum(b, '?anlamyok: model hiç yüklenmez', { beklenen: 'yok', sorgu: '?nosplash&anlamyok' });
  await b.close();
  console.log(`\nSONUÇ: ${kaldi ? kaldi + ' KALDI' : 'hepsi GEÇTİ'}`); process.exit(kaldi ? 1 : 0);
})();
