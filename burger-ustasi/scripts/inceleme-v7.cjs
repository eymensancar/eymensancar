// Burger Ustası 11. tur önce/sonra görüntüleri: docs/inceleme/v7/
//
//   node scripts/inceleme-v7.cjs [eski www klasörü]
//
// Eski www verilmezse git'teki 10. tur sürümü (commit 1b1f42f; ONCE_REF ile değiştirilebilir) geçici klasöre çıkarılır. İki sürüm
// aynı anlarda (iPhone 15 yatay, 852×393) çekilir; her an için yan yana tek JPEG (python3 + Pillow). Anlar: ana menü, duraklatma,
// ayarlar (yeni), dükkân (tablet → mutfak içi dükkân ve açıklama kartı), tepsiye burger ve patates konma kareleri (dokunuştan
// sonra 0, 80, 160, 240, 400 ms; tepsinin çevresi 2× büyütülmüş), ilk gün (rehberden sonra 15. sn: tezgâhtaki müşteriler).
// Toplam ~4 MB altında kalır.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const KOK = path.join(__dirname, '..'), OUT = path.join(KOK, 'docs', 'inceleme', 'v7');
fs.mkdirSync(OUT, { recursive: true });
const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const bekle = ms => new Promise(r => setTimeout(r, ms));
function eskiWww() {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const ref = process.env.ONCE_REF || '1b1f42f';
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
async function sayfa(br, port, kayit) {
  const ctx = await br.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const p = await ctx.newPage();
  await p.addInitScript(k => {
    try { localStorage.clear(); localStorage.setItem('burgerustasi.v1', JSON.stringify(k)); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--sl:59px!important;--sr:59px!important;--sb:21px!important}'; document.head.appendChild(s); });
  }, kayit);
  await p.goto(`http://localhost:${port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu && document.fonts.status === 'loaded');
  await p.evaluate(() => window.__bu.fit()); await bekle(600);
  return { ctx, p };
}
const ORTA = { day: 8, coins: 700, seen: ['tut3', 'para', 'ilk'], stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 3, 6: 2, 7: 3 }, up: { cook: 0, pat: 1, tip: 0, slot: 1 }, son: { gun: 7, net: 640, mus: 17 } };
async function cek(br, WWW, etiket, kl) {
  const s = await sunucu(WWW), port = s.address().port;
  const foto = (p, ad, clip) => p.screenshot({ path: path.join(kl, `${etiket}-${ad}.png`), clip });
  // ana menü, duraklatma, ayarlar, dükkân
  { const { ctx, p } = await sayfa(br, port, ORTA);
    await foto(p, 'ana-menu');
    if (await p.evaluate(() => !!document.getElementById('ayarBtn'))) { await p.evaluate(() => document.getElementById('ayarBtn').click()); await bekle(600); await foto(p, 'ayarlar'); }
    await p.evaluate(() => { window.__bu.startDay(8); window.__bu.basla(); }); await bekle(3000);
    await p.evaluate(() => document.getElementById('durBtn').click()); await bekle(600); await foto(p, 'duraklatma');
    await p.evaluate(() => document.getElementById('rs').click()); await bekle(300);
    await foto(p, 'mutfak');
    await p.evaluate(() => window.__bu.dokun('tablet')); await bekle(700); await foto(p, 'dukkan');
    await p.evaluate(() => window.__bu.dkSec(window.__bu.DK.some(x => x.id === 'otoKofte') ? 'otoKofte' : 'tip')); await bekle(600); await foto(p, 'dukkan-kart');
    await ctx.close(); }
  // tepsiye konma kareleri: animasyonlar gerçek zamanda; her karede tepsinin çevresi
  { const { ctx, p } = await sayfa(br, port, ORTA);
    await p.evaluate(() => { window.__bu.startDay(8, true); const S = window.__bu.S; S.burger = ['bunBot', 'patty', 'cheese', 'pickle', 'bunTop']; window.__bu.dokun('tezgah'); });
    await bekle(400);
    const r = await p.evaluate(() => { const b = document.getElementById('tp0').getBoundingClientRect(); return { x: b.left - 30, y: b.top - 70, width: b.width + 60, height: b.height + 90 }; });
    // gerçek dokunuşla (eski sürümde ezilme dokunuş anında, pointerdown'da başlıyordu)
    const merkez = k => p.evaluate(k => { const b = window.__bu.hit(k).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, k);
    const tp = await merkez('tepsi0'), pt = await merkez('patates');
    for (const tur of ['burger', 'patates']) {
      if (tur === 'patates') { await p.touchscreen.tap(pt.x, pt.y); await bekle(250); }
      await p.touchscreen.tap(tp.x, tp.y);
      const t0 = Date.now();
      for (const ms of [0, 80, 160, 240, 400, 700]) { const w = ms - (Date.now() - t0); if (w > 0) await bekle(w); await foto(p, `tepsi-${tur}-${ms}`, r); }
      await bekle(500);
    }
    await ctx.close(); }
  // ilk gün: rehber görülmüş yeni oyuncu, günün 15. saniyesi
  { const { ctx, p } = await sayfa(br, port, { day: 1, coins: 50, seen: ['tut3', 'para', 'ilk'] });
    await p.evaluate(() => { window.__bu.startDay(1); window.__bu.basla(); }); await bekle(15000);
    await foto(p, 'ilk-gun');
    await ctx.close(); }
  s.close();
}
(async () => {
  const kl = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-v7-'));
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
def baslik(P, xy, t, c): ImageDraw.Draw(P).text(xy, t, fill=c, font=F)
W = 860
for an in ['ana-menu', 'duraklatma', 'ayarlar', 'mutfak', 'dukkan', 'dukkan-kart', 'ilk-gun']:
    a, b = os.path.join(K, 'once-' + an + '.png'), os.path.join(K, 'sonra-' + an + '.png')
    if not os.path.exists(b): continue
    B = Image.open(b).convert('RGB'); B = B.resize((W, int(B.height * W / B.width)), Image.LANCZOS)
    if os.path.exists(a):
        A = Image.open(a).convert('RGB').resize(B.size, Image.LANCZOS)
        P = Image.new('RGB', (W * 2 + 30, B.height + 40), (40, 28, 22)); P.paste(A, (10, 36)); P.paste(B, (W + 20, 36))
        baslik(P, (14, 8), 'ONCE (10. tur)', (255, 210, 170)); baslik(P, (W + 24, 8), 'SONRA (11. tur)', (150, 255, 160))
    else:
        P = Image.new('RGB', (W + 20, B.height + 40), (40, 28, 22)); P.paste(B, (10, 36)); baslik(P, (14, 8), 'SONRA (11. tur, yeni)', (150, 255, 160))
    P.save(os.path.join(O, an + '.jpg'), quality=72, optimize=True)
# tepsiye konma: iki satır (önce / sonra), altı kare
for tur in ['burger', 'patates']:
    kare = [0, 80, 160, 240, 400, 700]; sat = []
    for et in ['once', 'sonra']:
        ims = [Image.open(os.path.join(K, f'{et}-tepsi-{tur}-{ms}.png')).convert('RGB') for ms in kare]
        w, h = ims[0].size; s = 300 / w; ims = [i.resize((300, int(h * s)), Image.LANCZOS) for i in ims]; sat.append(ims)
    h = sat[0][0].height
    P = Image.new('RGB', (6 * 306 + 10, 2 * (h + 34) + 10), (40, 28, 22))
    for r, (et, ims) in enumerate(zip(['ONCE (10. tur)', 'SONRA (11. tur)'], sat)):
        baslik(P, (10, 6 + r * (h + 34)), et + '  ' + '   '.join(f'{ms} ms' for ms in kare), (255, 210, 170) if r == 0 else (150, 255, 160))
        for j, im in enumerate(ims): P.paste(im, (6 + j * 306, 32 + r * (h + 34)))
    P.save(os.path.join(O, 'tepsi-' + tur + '.jpg'), quality=74, optimize=True)
`;
  execFileSync('python3', ['-c', py, kl, OUT], { stdio: 'inherit' });
  const top = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  console.log('docs/inceleme/v7 hazır: ' + fs.readdirSync(OUT).join(', ') + ` (${(top / 1048576).toFixed(2)} MB)`);
})();
