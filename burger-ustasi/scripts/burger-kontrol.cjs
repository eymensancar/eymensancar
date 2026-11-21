// Burger Ustası: hamburger katmanlarının kontrol görüntüsü. Köfte/peynir/turşunun 6 sırası (tam burger ve kapanmadan önce),
// kuruluş adımları ve küçük boylar (baloncuk, tepsi) tek resimde; oyunun kendi burgerHTML'iyle, tezgâh renginde.
//
//   node scripts/burger-kontrol.cjs [çıktı.jpg]     (varsayılan docs/inceleme/v4/hamburger-permutasyon.jpg)
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const KOK = path.join(__dirname, '..'), WWW = path.join(KOK, 'www');
const OUT = path.resolve(process.argv[2] || path.join(KOK, 'docs', 'inceleme', 'v4', 'hamburger-permutasyon.jpg'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const sunucu = http.createServer((q, r) => {
  const p = path.join(WWW, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(WWW) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TUR[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
(async () => {
  await new Promise(r => sunucu.listen(0, r));
  const br = await pw.chromium.launch();
  const p = await br.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
  await p.goto(`http://localhost:${sunucu.address().port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu && document.fonts.status === 'loaded');
  const h = await p.evaluate(() => {
    const B = window.__bu, ara = ['patty', 'cheese', 'pickle'], perm = [];
    const pr = (a, b = []) => { if (!a.length) perm.push(b); a.forEach((x, i) => pr(a.filter((_, j) => j !== i), [...b, x])); }; pr(ara);
    const ad = { bunBot: 'alt', patty: 'köfte', cheese: 'peynir', pickle: 'turşu', bunTop: 'üst' };
    const kutu = (ks, k, yazi) => { const y = B.burgerYuk(ks); return `<div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:flex-end;margin:6px 10px;vertical-align:bottom">
      <div style="position:relative;width:${140 * k}px;height:${(y + 8) * k}px"><div class="burger" style="left:0;bottom:${6 * k}px;width:140px;height:${y}px;transform:scale(${k});transform-origin:0 100%;position:absolute">${B.burgerHTML(ks)}</div></div>
      <small style="font:700 13px sans-serif;color:#4a2a18;margin-top:4px">${yazi || ks.filter(x => x !== 'bunBot' && x !== 'bunTop').map(x => ad[x]).join(' · ')}</small></div>`; };
    let h = '<div style="padding:14px;background:linear-gradient(#f6dccb,#efc9b2)">';
    h += '<div style="font:900 18px sans-serif;color:#4a2a18">6 sıra, tam burger (2,4×)</div>' + perm.map(ks => kutu(['bunBot', ...ks, 'bunTop'], 2.4)).join('');
    h += '<div style="font:900 18px sans-serif;color:#4a2a18;margin-top:6px">aynı sıralar, üst ekmek konmadan (2,4×)</div>' + perm.map(ks => kutu(['bunBot', ...ks], 2.4)).join('');
    const ad2 = [['bunBot'], ['bunBot', 'patty'], ['bunBot', 'patty', 'cheese'], ['bunBot', 'patty', 'cheese', 'pickle'], ['bunBot', 'patty', 'cheese', 'pickle', 'bunTop']];
    h += '<div style="font:900 18px sans-serif;color:#4a2a18;margin-top:6px">kuruluş (oyundaki boy ≈ 1×, iPhone 15\'te ekranda ≈ 0,44×) ve baloncuk boyu (0,57 × 0,44)</div>' + ad2.map(ks => kutu(ks, 1, ks.map(x => ad[x]).join('+'))).join('') +
      perm.map(ks => kutu(['bunBot', ...ks, 'bunTop'], 0.44, 'ekran')).join('') + perm.slice(0, 3).map(ks => kutu(['bunBot', ...ks, 'bunTop'], 0.25, 'balon')).join('');
    return h + '</div>';
  });
  await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="http://localhost:${sunucu.address().port}/index.html"></head><body style="margin:0"></body></html>`);
  // index.html stilleri: sayfanın kendisinden al
  await p.goto(`http://localhost:${sunucu.address().port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu);
  await p.evaluate(h => { document.body.innerHTML = h; document.body.style.overflow = 'visible'; document.documentElement.style.overflow = 'visible'; document.body.style.height = 'auto';
    document.querySelectorAll('img').forEach(i => i.src = i.src); }, h);
  await p.waitForTimeout(800);
  const yuk = await p.evaluate(() => document.body.firstElementChild.getBoundingClientRect().height);
  await p.setViewportSize({ width: 1500, height: Math.ceil(yuk) });
  await p.screenshot({ path: OUT, quality: 88, fullPage: true });
  await br.close(); sunucu.close(); console.log(OUT);
})();
