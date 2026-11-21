// Burger Ustası 10. tur (Shawarma incelemesinin planı) önce/sonra görüntüleri: docs/inceleme/v6/
//
//   node scripts/inceleme-v6.cjs [eski www klasörü]
//
// Eski www verilmezse git'teki 9. tur sürümü (commit 4359ff4; ONCE_REF ile değiştirilebilir) geçici klasöre çıkarılır. İki sürüm aynı anlarda (iPhone 15 yatay, 852×393)
// çekilir; her an için yan yana tek JPEG: docs/inceleme/v6/<an>.jpg (python3 + Pillow). Toplam ~4 MB altında kalır.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const KOK = path.join(__dirname, '..'), OUT = path.join(KOK, 'docs', 'inceleme', 'v6');
fs.mkdirSync(OUT, { recursive: true });
const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const bekle = ms => new Promise(r => setTimeout(r, ms));
function eskiWww() {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const ref = process.env.ONCE_REF || '4359ff4';
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-once-'));
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: KOK }).toString().trim(), rel = path.relative(top, path.join(KOK, 'www'));
  execFileSync('sh', ['-c', `git archive ${ref} ${rel} | tar -x -C ${d}`], { cwd: top });
  return path.join(d, rel);
}
function sunucu(WWW) {
  const s = http.createServer((q, r) => {
    const p = path.join(WWW, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(WWW) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': TUR[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
  return new Promise(r => s.listen(0, () => r(s)));
}
// her an: [ad, hazırlık (sayfada)]; yeni sürümde olmayan işlevler eskide atlanır
async function cek(br, WWW, etiket, kl) {
  const s = await sunucu(WWW), port = s.address().port;
  const ctx = await br.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('burgerustasi.v1', JSON.stringify({ day: 8, coins: 700, seen: ['tut3', 'para', 'ilk'], up: { cook: 0, pat: 1, tip: 0, slot: 1 }, son: { gun: 7, net: 640, mus: 17 } })); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--sl:59px!important;--sr:59px!important;--sb:21px!important}'; document.head.appendChild(s); });
  });
  await p.goto(`http://localhost:${port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu && document.fonts.status === 'loaded');
  await p.evaluate(() => window.__bu.fit()); await bekle(500);
  const foto = ad => p.screenshot({ path: path.join(kl, `${etiket}-${ad}.jpg`), quality: 80 });
  await foto('ana-menu');
  await p.evaluate(() => { window.__bu.startDay(8); window.__bu.basla(); });
  await p.waitForFunction(() => window.__bu.S.cust.filter(Boolean).length >= 3, null, { timeout: 30000 }).catch(() => {});
  await bekle(1800);
  await foto('mutfak');
  // ödeme anı: hazır tepsi en sabırlı müşteriye (seri 3)
  await p.evaluate(() => { const B = window.__bu; B.S.seri = 3; B.S.tepsi[0] = { b: ['bunBot', 'patty', 'cheese', 'pickle', 'bunTop'], f: true }; B.dokun('tepsi0'); const c = B.S.cust.filter(Boolean).sort((a, b) => b.p / b.max - a.p / a.max)[0]; c.p = c.max; B.musteri(c.i); });
  await bekle(950);
  await foto('odeme');
  await bekle(900);
  await foto('tezgahta-para');
  // dükkân (oyunda, tabletten)
  await p.evaluate(() => window.__bu.dokun('tablet')); await bekle(600);
  await foto('dukkan');
  if (await p.evaluate(() => !!window.__bu.dkSec)) { await p.evaluate(() => window.__bu.dkSec('tip')); await bekle(500); await foto('dukkan-kart'); }
  await p.evaluate(() => window.__bu.shopKapat()); await bekle(300);
  // gün sonu
  await p.evaluate(() => window.__bu.bitir(true)); await bekle(2800);
  await foto('gun-sonu');
  await ctx.close(); s.close();
}
(async () => {
  const kl = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-v6-'));
  const br = await pw.chromium.launch();
  await cek(br, eskiWww(), 'once', kl);
  await cek(br, path.join(KOK, 'www'), 'sonra', kl);
  await br.close();
  const py = `
import os, sys
from PIL import Image, ImageDraw, ImageFont
K, O = sys.argv[1], sys.argv[2]
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception: F = None
for an in ['ana-menu', 'mutfak', 'odeme', 'tezgahta-para', 'dukkan', 'dukkan-kart', 'gun-sonu']:
    a, b = os.path.join(K, 'once-' + an + '.jpg'), os.path.join(K, 'sonra-' + an + '.jpg')
    if not os.path.exists(b): continue
    B = Image.open(b).convert('RGB'); W = 860; B = B.resize((W, int(B.height * W / B.width)), Image.LANCZOS)
    if os.path.exists(a):
        A = Image.open(a).convert('RGB').resize(B.size, Image.LANCZOS)
        P = Image.new('RGB', (W * 2 + 30, B.height + 40), (40, 28, 22)); P.paste(A, (10, 36)); P.paste(B, (W + 20, 36))
        d = ImageDraw.Draw(P); d.text((14, 8), 'ONCE (9. tur)', fill=(255, 210, 170), font=F); d.text((W + 24, 8), 'SONRA (10. tur)', fill=(150, 255, 160), font=F)
    else:
        P = Image.new('RGB', (W + 20, B.height + 40), (40, 28, 22)); P.paste(B, (10, 36))
        d = ImageDraw.Draw(P); d.text((14, 8), 'SONRA (10. tur, yeni)', fill=(150, 255, 160), font=F)
    P.save(os.path.join(O, an + '.jpg'), quality=72, optimize=True)
`;
  execFileSync('python3', ['-c', py, kl, OUT], { stdio: 'inherit' });
  console.log('docs/inceleme/v6 hazır: ' + fs.readdirSync(OUT).join(', '));
})();
