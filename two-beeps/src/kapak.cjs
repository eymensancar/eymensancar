/* Kapakları üretir: node src/kapak.cjs  → assets/kapak/part1.jpg … part10.jpg (+ out/kapak-kontak.jpg ffmpeg ile ayrıca). */
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2', '.js': 'text/javascript', '.json': 'application/json' };
(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const port = srv.address().port;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto(`http://127.0.0.1:${port}/src/kapak.html`);
  for (let n = 1; n <= 10; n++) {
    const tl = JSON.parse(fs.readFileSync(path.join(ROOT, `src/part${n}.timeline.json`), 'utf8'));
    const url = await p.evaluate(([n, t]) => window.kapak(n, t), [n, tl.title]);
    fs.writeFileSync(path.join(ROOT, `assets/kapak/part${n}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(n, tl.title);
  }
  await b.close(); srv.close();
})();
