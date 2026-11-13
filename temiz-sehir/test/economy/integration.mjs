// Informational: robots inside the real game (all modules present in www/js), screenshots in test/economy/shots/e-*.
// Run: node test/economy/integration.mjs. Prints page errors (from any module) but does not fail on other modules' errors.
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const SCRATCH_THREE = '/tmp/claude-0/-home-user/8066dee7-8627-553b-a97c-0e1bfc2ce9b4/scratchpad/lib/three.min.js';
const ai = process.argv.indexOf('--three'); const threeLocal = ai > 0 ? process.argv[ai + 1] : (fs.existsSync(SCRATCH_THREE) ? SCRATCH_THREE : null);
const server = http.createServer((q, s) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' }); fs.createReadStream(p).pipe(s); }).listen(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 590 }, hasTouch: true });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
if (threeLocal) await page.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
await page.goto(`http://127.0.0.1:${server.address().port}/www/index.html?debug&nosave`);
await page.waitForFunction(() => window.__ts && window.__ts.ready, null, { timeout: 90000 });
const shots = path.join(here, 'shots');
const stubs = await page.evaluate(() => Object.entries(__ts.ctx.mods).filter(([, m]) => m.__stub).map(([k]) => k));
await page.evaluate(() => { __ts.teleport(27, 3, 180); __ts.own('robot_1'); __ts.own('robot_2'); __ts.fast(45, 1 / 30, true); });
const st = await page.evaluate(() => ({ e: __ts.econ().robots, s: __ts.state() }));
// eye level, player turned towards robot 1
const r = st.e[0];
await page.evaluate(([x, z]) => { const p = __ts.ctx.mods.player.pose(); const yaw = Math.atan2(x - p.x, -(z - p.z)) * 180 / Math.PI; __ts.teleport(x + 0, z + 5, 180 + 0); __ts.look(0, -20); __ts.step(0.05); }, [r.x, r.z]);
await page.screenshot({ path: path.join(shots, 'e1-game-eye.png') });
const c = await page.evaluate(() => __ts.counters());
console.log('stubs:', stubs.join(',') || 'none', '| robots', JSON.stringify(st.e.map((q) => [q.state, q.x, q.z, q.load])), '| calls', c.calls, 'tris', c.triangles, '| econ ms', (c.mods.economy || 0).toFixed(3));
console.log('page errors/warnings (any module):', errs.length ? '\n  ' + [...new Set(errs)].slice(0, 12).join('\n  ') : 'none');
await browser.close(); server.close();
