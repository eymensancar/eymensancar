// Burger Ustası 9. tur (oyun hissi) inceleme görüntüleri: docs/inceleme/v5/
//
//   node scripts/inceleme-v5.cjs
//
// iPhone 15 (yatay) boyunda yeni anları çeker (müşteriler, para uçuşu, seri rozeti, doğrama, tablet → dükkân, gün sonu,
// ana menü) ve docs/inceleme/v4'teki eski görüntülerle yan yana "önce/sonra" yapar (python3 + Pillow).
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const KOK = path.join(__dirname, '..'), WWW = path.join(KOK, 'www'), OUT = path.join(KOK, 'docs', 'inceleme', 'v5');
fs.mkdirSync(OUT, { recursive: true });
const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const sunucu = http.createServer((q, r) => {
  const p = path.join(WWW, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(WWW) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TUR[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const bekle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => sunucu.listen(0, r));
  const port = sunucu.address().port;
  const br = await pw.chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('burgerustasi.v1', JSON.stringify({ day: 3, coins: 180, seen: ['tut3'], up: { cook: 0, pat: 0, tip: 0, slot: 0 } })); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--sl:59px!important;--sr:59px!important;--sb:21px!important}'; document.head.appendChild(s); });
  });
  await p.goto(`http://localhost:${port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu && document.fonts.status === 'loaded');
  await p.evaluate(() => window.__bu.fit()); await bekle(500);
  const cek = ad => p.screenshot({ path: path.join(OUT, ad + '.jpg'), quality: 80 });
  await cek('sonra-ana-menu');
  await p.evaluate(() => { window.__bu.startDay(3); window.__bu.basla(); });
  // üç müşteri gelsin
  await p.waitForFunction(() => window.__bu.S.cust.filter(Boolean).length >= 3, null, { timeout: 40000 }).catch(() => {});
  await bekle(1400);
  await cek('sonra-musteriler');
  // seri rozeti ve para uçuşu: hazır tepsi ver
  await p.evaluate(() => { const B = window.__bu; B.S.seri = 3; B.S.tepsi[0] = { b: ['bunBot', 'patty', 'cheese', 'pickle', 'bunTop'], f: true }; B.dokun('tepsi0'); const c = B.S.cust.filter(Boolean).sort((a, b) => b.p / b.max - a.p / a.max)[0]; c.p = c.max; B.musteri(c.i); });
  await bekle(980);
  await cek('sonra-para-ucusu-seri');
  // doğrama (6 dokunuş)
  for (let i = 0; i < 6; i++) { await p.evaluate(() => window.__bu.dokun('cig')); await bekle(120); }
  await bekle(80);
  await cek('sonra-dograma');
  // tablet → dükkân
  await p.evaluate(() => window.__bu.dokun('tablet')); await bekle(500);
  await cek('sonra-tablet-dukkan');
  await p.evaluate(() => window.__bu.shopKapat()); await bekle(300);
  // gün sonu
  await p.evaluate(() => window.__bu.bitir(true)); await bekle(2600);
  await cek('sonra-gun-sonu');
  await br.close(); sunucu.close();
  // önce (v4) / sonra yan yana
  const py = `
from PIL import Image, ImageDraw
import os
V4, V5 = ${JSON.stringify(path.join(KOK, 'docs', 'inceleme', 'v4'))}, ${JSON.stringify(OUT)}
for once, sonra, ad in [('cihaz-iphone15-servis', 'sonra-musteriler', 'oncesonra-musteriler'), ('cihaz-iphone15-gun-sonu', 'sonra-gun-sonu', 'oncesonra-gun-sonu')]:
    A, B = Image.open(os.path.join(V4, once + '.jpg')).convert('RGB'), Image.open(os.path.join(V5, sonra + '.jpg')).convert('RGB')
    s = 790 / A.width; A = A.resize((790, int(A.height * s)), Image.LANCZOS); B = B.resize(A.size, Image.LANCZOS)
    P = Image.new('RGB', (A.width * 2 + 30, A.height + 34), (40, 28, 22)); P.paste(A, (10, 30)); P.paste(B, (A.width + 20, 30))
    d = ImageDraw.Draw(P); d.text((14, 8), 'ONCE (8. tur)', fill=(255, 210, 170)); d.text((A.width + 24, 8), 'SONRA (9. tur)', fill=(150, 255, 160))
    P.save(os.path.join(V5, ad + '.jpg'), quality=80)
`;
  execFileSync('python3', ['-c', py], { stdio: 'inherit' });
  console.log('docs/inceleme/v5 hazır');
})();
