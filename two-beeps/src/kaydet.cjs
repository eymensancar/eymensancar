#!/usr/bin/env node
/* Two Beeps — kare kare kayıt.
   node src/kaydet.cjs [--from 10 --to 14] [--out out/part1-video.mp4] [--scale 0.5] [--page src/part1.html] [--bg]
   Kendi yerel sunucusunu açar (port 8803; doluysa boş bir port), sayfayı 1080×1920 yükler, TB_READY bekler,
   her kare için renderAt(i/fps) çağırıp tuvali JPEG olarak alır ve ffmpeg'e (image2pipe) verir.
   Süre, fps ve boyut timeline'dan okunur. Çıktı: H.264, yuv420p, crf 16, sessiz. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.css': 'text/css', '.svg': 'image/svg+xml' };

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2), v = argv[i + 1];
    if (v == null || v.startsWith('--')) o[k] = true; else { o[k] = v; i++; }
  }
  return o;
}

function serve(port) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404); return res.end('yok'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d);
    });
  });
  return new Promise((ok, bad) => {
    srv.once('error', e => { if (e.code === 'EADDRINUSE') srv.listen(0, '127.0.0.1', () => ok(srv)); else bad(e); });
    srv.listen(port, '127.0.0.1', () => ok(srv));
  });
}

// sayfayı açar; { browser, page, srv, tl, base } döner
async function openPage(o = {}) {
  const { chromium } = require('playwright');
  const srv = await serve(o.port || 8803), port = srv.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/${o.page || 'src/part1.html'}`);
  await page.waitForFunction(() => window.TB_READY === true, null, { timeout: 60000 });
  if (o.bg) await page.evaluate(() => { // paket denemesi için düz gri/örnek arka plan (sahnelerin altına değil, yerine)
    TB.shots.length = 0;
    TB.shot({ id: 'deneme-bg', t0: 0, t1: 1e9, draw(c, t) {
      const g = c.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#8fbadb'); g.addColorStop(.58, '#c9dbe0'); g.addColorStop(.6, '#cfb184'); g.addColorStop(1, '#a88a5f');
      c.fillStyle = g; c.fillRect(0, 0, 1080, 1920); c.fillStyle = '#f5b21c'; c.fillRect(380, 820, 300, 300);
      c.strokeStyle = 'rgba(255,0,0,.6)'; c.lineWidth = 3; c.setLineDash([12, 8]);
      c.strokeRect(60, 220, 830, 1220); c.strokeRect(90, 1200, 780, 220);   // güvenli alan, altyazı kutusu
      c.fillStyle = 'rgba(255,0,0,.12)'; c.fillRect(890, 1000, 190, 750); c.fillRect(0, 1440, 1080, 480); c.fillRect(0, 0, 1080, 220);
      c.setLineDash([]); c.fillStyle = '#15120d'; c.font = '700 40px Rubik'; c.fillText('t=' + t.toFixed(2), 70, 1500);
    } });
  });
  const tl = await page.evaluate(() => TB.tl);
  return { browser, page, srv, tl, errors };
}

async function record(o) {
  const t0 = Date.now();
  const { browser, page, srv, tl, errors } = await openPage(o);
  const fps = tl.fps || 30, total = Math.round(tl.duration * fps);
  const f0 = o.from != null ? Math.max(0, Math.round(+o.from * fps)) : 0;
  const f1 = o.to != null ? Math.min(total, Math.round(+o.to * fps)) : total;
  const scale = +(o.scale || 1);
  const W = Math.round(tl.w * scale / 2) * 2, Hh = Math.round(tl.h * scale / 2) * 2;
  const out = path.resolve(o.out || path.join(ROOT, 'out', 'part1-video.mp4'));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((ok, bad) => ff.on('close', c => c === 0 ? ok() : bad(new Error('ffmpeg çıkış ' + c))));

  await page.evaluate(([W, H]) => { // küçültülmüş çıktı için yardımcı tuval
    window.__kc = document.getElementById('c');
    if (W !== window.__kc.width) { const s = document.createElement('canvas'); s.width = W; s.height = H; window.__ks = s; }
  }, [W, Hh]);

  const BATCH = 6; let done = 0;
  for (let i = f0; i < f1; i += BATCH) {
    const ids = []; for (let k = i; k < Math.min(f1, i + BATCH); k++) ids.push(k);
    const urls = await page.evaluate(([ids, fps]) => ids.map(k => {
      renderAt(k / fps);
      let c = window.__kc; if (window.__ks) { const s = window.__ks, g = s.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, s.width, s.height); c = s; }
      return c.toDataURL('image/jpeg', 0.92);
    }), [ids, fps]);
    for (const u of urls) {
      const buf = Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    done += urls.length;
    if (!o.quiet && (done % 150 < BATCH || i + BATCH >= f1)) process.stdout.write(`\r${done}/${f1 - f0} kare  ${((Date.now() - t0) / 1000).toFixed(1)} sn   `);
  }
  ff.stdin.end(); await ffDone;
  await browser.close(); srv.close();
  const sec = (Date.now() - t0) / 1000;
  console.log(`\n${out}: ${f1 - f0} kare (${((f1 - f0) / fps).toFixed(2)} sn video), ${W}×${Hh}, kayıt ${sec.toFixed(1)} sn`);
  if (errors.length) console.log(`sayfa hataları (${errors.length}, ilk 5):\n  ` + [...new Set(errors)].slice(0, 5).join('\n  '));
  return { frames: f1 - f0, sec, out, errors };
}

module.exports = { serve, openPage, record, args, ROOT };
if (require.main === module) record(args(process.argv.slice(2))).catch(e => { console.error(e); process.exit(1); });
