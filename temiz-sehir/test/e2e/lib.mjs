// Shared harness for the end-to-end tests: static server, Chromium (SwiftShader), three.js routing, real CDP touch.
// three.js: THREE_LOCAL=<path to three.min.js r128> (or test/.cache/three.min.js) serves it offline; otherwise the
// CDN is used. Every page error and console error/warning is collected in `errors`.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
const { chromium } = createRequire(import.meta.url)('playwright');

export function threeLocal() {
  for (const p of [process.env.THREE_LOCAL, path.join(ROOT, 'test/.cache/three.min.js'), '/tmp/claude-0/-home-user/8066dee7-8627-553b-a97c-0e1bfc2ce9b4/scratchpad/lib/three.min.js']) if (p && fs.existsSync(p)) return p;
  return null;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
// serves `dir`; `extra` = { '/path': html string } for generated wrapper pages
export function serve(dir, extra = {}) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (extra[u] != null) { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end(extra[u]); }
    const p = path.join(dir, u.endsWith('/') ? u + 'index.html' : u);
    if (!p.startsWith(dir)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port, close: () => srv.close() })));
}
export async function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
}
// a page with touch; viewport 'land' (844x390) or 'port' (390x844); context shared so localStorage persists across reloads
export async function openPage(browser, { orient = 'land', dpr = 1, context = null } = {}) {
  const vp = orient === 'port' ? { width: 390, height: 844 } : { width: 844, height: 390 };
  const ctx = context || await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const three = threeLocal();
  if (three) await page.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: three, contentType: 'text/javascript' }));
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push('[' + m.type() + '] ' + m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  return { page, errors, context: ctx, vp };
}
export async function ready(page, timeout = 90000) {
  await page.waitForFunction(() => window.__ts && window.__ts.ready, null, { timeout });
}
// --- real touch through CDP (multi-touch: every active point is sent with each event)
export async function touchpad(page) {
  const cdp = await page.context().newCDPSession(page);
  const pts = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.values()].map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 6, radiusY: 6, force: 1 })) });
  return {
    async down(id, x, y) { pts.set(id, { id, x, y }); await send('touchStart'); },
    async move(id, x, y) { const p = pts.get(id); if (!p) return; p.x = x; p.y = y; await send('touchMove'); },
    async up(id) { // touchEnd ends exactly the listed points; the others stay down (verified in test/player)
      const p = pts.get(id); if (!p) return; pts.delete(id);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id }] });
    },
    async tap(x, y, id = 9) { await this.down(id, x, y); await page.waitForTimeout(60); await this.up(id); },
    // drag a finger from (x0, y0) by (dx, dy) in n steps, waiting ms between steps
    async drag(id, x0, y0, dx, dy, n = 10, ms = 30) { await this.down(id, x0, y0); for (let k = 1; k <= n; k++) { await this.move(id, x0 + dx * k / n, y0 + dy * k / n); await page.waitForTimeout(ms); } await this.up(id); },
  };
}
export async function center(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('no box for ' + sel);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
}
export function check(list, ok, msg) { list.push((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) list.failed = (list.failed || 0) + 1; return ok; }
