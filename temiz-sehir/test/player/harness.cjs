// Shared Playwright harness for test/player and test/tools.
// Serves the repo root, routes the three.js CDN to a local copy (THREE_LOCAL env or --three), and replaces
// the modules player/tools depend on (world, trash, economy, ui, audio, debug) with the fakes in
// test/player/fakes/ unless REAL=1 (then whatever is in www/js is used, stubs for the rest).
// Real touch input: CDP Input.dispatchTouchEvent (multi-touch) through the Touch helper below.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const FAKES = ['world', 'trash', 'economy', 'ui', 'audio', 'debug'];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };

function serve() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(r);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

function threePath() {
  const i = process.argv.indexOf('--three');
  return i > 0 ? process.argv[i + 1] : process.env.THREE_LOCAL || null;
}

async function open({ width = 844, height = 390, dpr = 1, query = 'debug&nosave&manual', fakes = !process.env.REAL, initScript = null } = {}) {
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: false });
  const page = await context.newPage();
  const errors = [];
  if (initScript) await page.addInitScript(initScript);
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); if (m.type() === 'warning' && /\[(player|tools)\]/.test(m.text())) errors.push('warn: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const tl = threePath();
  if (tl) await page.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: tl, contentType: 'text/javascript' }));
  if (fakes) for (const m of FAKES) {
    await page.route(new RegExp('/www/js/' + m + '\\.js(\\?.*)?$'), (r) => {
      const f = path.join(__dirname, 'fakes', m + '.js');
      if (fs.existsSync(f)) r.fulfill({ path: f, contentType: 'text/javascript' });
      else r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export function init(){}\nexport function update(){}\n' });
    });
  }
  await page.goto(`http://127.0.0.1:${port}/www/index.html?${query}`);
  await page.waitForFunction(() => window.__tsCtx && window.__tsCtx.time.frame >= 1, null, { timeout: 90000 });
  const cdp = await context.newCDPSession(page);
  const touch = new Touch(cdp);
  async function close() { await browser.close(); server.close(); }
  return { page, browser, cdp, touch, errors, close, port };
}

// Multi-touch through CDP: touchStart/touchMove carry every finger that is down; touchEnd carries only the
// fingers that lift (checked: pointerup fires for exactly those).
class Touch {
  constructor(cdp) { this.cdp = cdp; this.active = new Map(); }
  pts() { return [...this.active.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 8, radiusY: 8, force: 1 })); }
  async down(id, x, y) { this.active.set(id, { x, y }); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.pts() }); }
  async move(id, x, y) { this.active.set(id, { x, y }); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.pts() }); }
  async up(id) { // touchEnd ends exactly the listed points (verified: the others stay down)
    const p = this.active.get(id); if (!p) return;
    this.active.delete(id);
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id }] });
  }
  async cancel() { this.active.clear(); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); }
}

// run n manual frames of dt WITHOUT rendering: SwiftShader rasterises ~0.2–0.5 s per frame and queued
// frames back up the GPU process (screenshots then time out). Modules do not depend on render; call
// render(page) before a screenshot or a renderer.info read.
const step = (page, n, dt = 1 / 60) => page.evaluate(([n, dt]) => {
  const c = window.__tsCtx, r = c.renderer, real = r.render;
  r.render = function () {}; try { return c.step(n, dt); } finally { r.render = real; }
}, [n, dt]);
const render = (page) => page.evaluate(() => { const c = window.__tsCtx; c.renderer.render(c.scene, c.camera); });
const pose = (page) => page.evaluate(() => { const p = window.__tsCtx.mods.player.pose(); return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, speed: p.speed, mounted: p.mounted }; });
const input = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__tsCtx.mods.player.input())));

let failures = 0;
function check(name, ok, info) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); if (!ok) failures++; }
function done(errors) {
  if (errors && errors.length) { console.log('PAGE ERRORS:\n  ' + errors.join('\n  ')); failures++; }
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exitCode = failures ? 1 : 0;
}
function sheet(dir, out, cols = 4) { // contact sheet of a frame sequence (ImageMagick montage)
  const { execFileSync } = require('child_process');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && !f.startsWith('_')).sort().map((f) => path.join(dir, f));
  try { execFileSync('montage', [...files, '-tile', cols + 'x', '-geometry', '+2+2', '-pointsize', '12', out]); } catch (e) { console.log('montage failed', e.message); }
}
module.exports = { open, step, render, pose, input, check, done, sheet, root };
