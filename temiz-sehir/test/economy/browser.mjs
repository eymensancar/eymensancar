// Browser test of economy.js + debug.js inside the real main.js (fake world/trash, stubs for player/tools/ui/audio).
// Run: node test/economy/browser.mjs [--three /path/to/three.min.js]
// Screenshots: test/economy/shots/. Headless Chromium + SwiftShader: correctness, draw calls and JS cost, NOT fps.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const ai = process.argv.indexOf('--three');
const SCRATCH_THREE = '/tmp/claude-0/-home-user/8066dee7-8627-553b-a97c-0e1bfc2ce9b4/scratchpad/lib/three.min.js';
const threeLocal = ai > 0 ? process.argv[ai + 1] : (fs.existsSync(SCRATCH_THREE) ? SCRATCH_THREE : null);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((q, s) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s);
}).listen(0);
const port = server.address().port;
const shots = path.join(here, 'shots'); fs.mkdirSync(shots, { recursive: true });

const fails = [], notes = [];
const check = (ok, msg) => { (ok ? notes : fails).push((ok ? 'ok   ' : 'FAIL ') + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 590 }, deviceScaleFactor: 1, hasTouch: true });
const errors = [];
async function open(query) {
  const page = await ctxB.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
  if (threeLocal) await page.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
  await page.goto(`http://127.0.0.1:${port}/test/economy/harness.html?${query}`);
  await page.waitForFunction(() => window.__ts && window.__ts.ready, null, { timeout: 60000 });
  return page;
}
const cam = (page, p, t) => page.evaluate(([p, t]) => { const c = __ts.ctx.camera; c.position.set(p[0], p[1], p[2]); c.lookAt(t[0], t[1], t[2]); __ts.ctx.step(1, 0); }, [p, t]);
const shot = (page, name) => page.screenshot({ path: path.join(shots, name + '.png') });

// ---------------------------------------------------------------- A: two robots cleaning a patch over time
const page = await open('debug&nosave');
const base = await page.evaluate(() => { __ts.teleport(20, 2.5); __ts.ctx.step(1, 0); return __ts.counters(); });
await page.evaluate(() => { __ts.own('robot_1'); __ts.own('robot_2'); });
const AER = [[44, 17, 33], [33, 0, 12]]; // aerial over the plaza, looking north-west at the dock and the shop
await cam(page, ...AER); await shot(page, 'a0-deployed');
const rc = await page.evaluate(() => { // same frame, robot meshes hidden vs shown
  const c = __ts.ctx, ms = []; c.scene.traverse((o) => { if (o.name === 'economy-robots') ms.push(o); });
  const vis = ms.map((m) => m.visible); ms.forEach((m) => { m.visible = false; }); c.renderer.render(c.scene, c.camera);
  const a = { calls: c.renderer.info.render.calls, tris: c.renderer.info.render.triangles };
  ms.forEach((m, i) => { m.visible = vis[i]; }); c.renderer.render(c.scene, c.camera);
  return { calls: c.renderer.info.render.calls - a.calls, tris: c.renderer.info.render.triangles - a.tris, meshes: ms.length };
});
check(rc.calls <= 3 && rc.tris < 5000, `2 robots add ${rc.calls} draw calls (≤ 3) and ${rc.tris} triangles (${rc.meshes} instanced meshes)`);
const timeline = [];
for (const [t, name] of [[8, 'a1-8s'], [30, 'a2-30s'], [90, 'a3-90s'], [180, 'a4-180s']]) {
  const s = await page.evaluate((t) => { const c = __ts.ctx; const g0 = c.time.game; __ts.fast(t - (window.__tA || 0), 1 / 30, false); window.__tA = t; return { econ: __ts.econ(), clean: c.mods.trash.cleanFraction(), coins: __ts.state().coins }; }, t);
  await cam(page, ...AER); await shot(page, name);
  timeline.push(`${t}s: clean ${(s.clean * 100).toFixed(2)} % coins ${s.coins} | ` + s.econ.robots.map((r) => `${r.id} ${r.state} (${r.x},${r.z}) ${r.load}/${r.cap}`).join(' | '));
}
const st = await page.evaluate(() => __ts.econ());
check(st.robots.every((r) => r.units > 50), 'both robots collected (' + st.robots.map((r) => r.units).join(', ') + ' units)');
check(st.stats.robotUnits > 0 && st.coins > 0, 'robots sold on their own: ' + st.coins + ' coins');
// close-up of a working robot (camera 1.6 m behind/above it)
await page.evaluate(() => __ts.fast(2, 1 / 30, false));
const rb = await page.evaluate(() => { const r = __ts.ctx.mods.economy.robots()[0]; return { x: r.x, z: r.z, yaw: r.yaw, state: r.state }; });
await cam(page, [rb.x - Math.sin(rb.yaw) * 1.6 + 0.6, 1.1, rb.z + Math.cos(rb.yaw) * 1.6 + 0.4], [rb.x, 0.1, rb.z]); await shot(page, 'a5-closeup');
// eye-level view along the street the robots work in
await cam(page, [rb.x - Math.sin(rb.yaw) * 7, 1.65, rb.z + Math.cos(rb.yaw) * 7], [rb.x, 0.2, rb.z]); await shot(page, 'a6-eye-level');

// per-frame JS cost of economy.update with 4 robots near the camera (removal included), and when far
const perf = await page.evaluate(() => {
  const c = __ts.ctx, E = c.mods.economy, T = c.mods.trash; __ts.own('robot_4');
  const meas = (n) => { const ts = []; for (let i = 0; i < n; i++) { const a = performance.now(); E.update(1 / 60); const b = performance.now(); T.update(1 / 60); ts.push(b - a); } ts.sort((x, y) => x - y); return { avg: +(ts.reduce((s, v) => s + v, 0) / n).toFixed(4), p95: +ts[Math.floor(n * 0.95)].toFixed(3), max: +ts[n - 1].toFixed(3) }; };
  E.update(1 / 60);
  const r0 = E.robots()[0]; c.camera.position.set(r0.x, 1.6, r0.z);
  const near = meas(900);
  c.camera.position.set(-300, 1.6, -300);
  const far = meas(900);
  return { near, far, robots: E.robots().map((r) => r.state + (r.far ? '/far' : '/near')) };
});
notes.push(`economy.update ms/frame (4 robots, SwiftShader desktop CPU, performance.now() coarsened): near ${JSON.stringify(perf.near)} far ${JSON.stringify(perf.far)}`);
check(perf.near.avg < 0.5, 'economy.update average < 0.5 ms (budget §9)');

// boost timing + away cap through the hook
const bt = await page.evaluate(() => {
  const c = __ts.ctx, E = c.mods.economy; const out = {};
  c.bus.emit('ui:adWatched', { kind: 'boost' }); out.active0 = E.boostActive(); out.mul = E.stat('boostMultiplier');
  __ts.fast(119, 1 / 30, false); out.active119 = E.boostActive();
  __ts.fast(2, 1 / 30, false); out.active121 = E.boostActive(); out.cd = E.boostCooldownLeft();
  out.away = __ts.away(10 * 3600);
  out.toast = __ts.events('ui:toast').map((e) => e.payload.text);
  out.boostEvents = __ts.events('economy:boost').length;
  return out;
});
check(bt.active0 && bt.mul === 2 && bt.active119 && !bt.active121 && bt.cd > 297, `boost 2x for 120 s then cooldown ${bt.cd.toFixed(1)} s (${bt.boostEvents} economy:boost events)`);
check(bt.away && bt.away.capped && bt.away.simS === 7200, `away 10 h → simulated ${bt.away && bt.away.simS} s, ${bt.away && bt.away.units} items, +${bt.away && bt.away.coins} coins (ui shows the card from economy:away; no toast since integration)`);
await cam(page, ...AER); await shot(page, 'a7-after-away');
const c2 = await page.evaluate(() => __ts.counters());
notes.push(`counters after: calls ${c2.calls}, triangles ${c2.triangles}, instances ${c2.instances}`);
notes.push('timeline:\n     ' + timeline.join('\n     '));
await page.close();

// ---------------------------------------------------------------- B: save → reload → load round trip (real localStorage)
const p2 = await open('debug&reset');
const before = await p2.evaluate(() => { __ts.teleport(20, 2.5); __ts.give(5000); for (const id of ['bag_1', 'broom', 'robot_1']) __ts.ctx.mods.economy.buy(id); __ts.fast(15, 1 / 30, false); __ts.save(); return { s: __ts.state(), e: __ts.econ() }; });
await p2.goto(`http://127.0.0.1:${port}/test/economy/harness.html?debug`);
await p2.waitForFunction(() => window.__ts && window.__ts.ready, null, { timeout: 60000 });
const afterL = await p2.evaluate(() => ({ s: __ts.state(), e: __ts.econ(), away: __ts.events('economy:away').length }));
check(afterL.s.coins >= before.s.coins && JSON.stringify(afterL.s.owned.sort()) === JSON.stringify(before.s.owned.sort()) && afterL.e.robots.length === 1, `reload keeps coins ${before.s.coins}→${afterL.s.coins} (+ away catch-up), owned [${afterL.s.owned}], robot at (${afterL.e.robots[0].x}, ${afterL.e.robots[0].z}) was (${before.e.robots[0].x}, ${before.e.robots[0].z})`);
const saved = await p2.evaluate(() => JSON.parse(localStorage.getItem('temizsehir.v1')).mods.economy);
check(saved && saved.v === 1 && Array.isArray(saved.owned), 'save under temizsehir.v1 → mods.economy v1 (' + JSON.stringify(saved).length + ' bytes)');
await p2.evaluate(() => localStorage.removeItem('temizsehir.v1'));
await p2.close();

// ---------------------------------------------------------------- C: portrait smoke (robots render, no errors)
const p3 = await ctxB.newPage();
await p3.setViewportSize({ width: 390, height: 844 });
p3.on('pageerror', (e) => errors.push(e.message));
if (threeLocal) await p3.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
await p3.goto(`http://127.0.0.1:${port}/test/economy/harness.html?debug&nosave`);
await p3.waitForFunction(() => window.__ts && window.__ts.ready, null, { timeout: 60000 });
await p3.evaluate(() => { __ts.teleport(20, 2.5); __ts.own('robot_2'); __ts.fast(20, 1 / 30, false); });
const r3 = await p3.evaluate(() => __ts.ctx.mods.economy.robots()[0]).then((r) => ({ x: r.x, z: r.z }));
await cam(p3, [r3.x + 3, 4, r3.z + 5], [r3.x, 0, r3.z]); await shot(p3, 'c-portrait');
await p3.close();

// ---------------------------------------------------------------- D: the real shell (www/index.html), every other module a stub
const p4 = await ctxB.newPage();
p4.on('pageerror', (e) => errors.push(e.message)); p4.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
if (threeLocal) await p4.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
await p4.goto(`http://127.0.0.1:${port}/www/index.html?debug&nosave`);
await p4.waitForFunction(() => window.__ts && window.__ts.ready, null, { timeout: 60000 });
const d4 = await p4.evaluate(() => { __ts.give(2000); const ok = __ts.ctx.mods.economy.buy('robot_1') === false && __ts.own('robot_1'); __ts.step(0.5); return { ok, st: __ts.state(), stub: Object.fromEntries(Object.entries(__ts.ctx.mods).map(([k, m]) => [k, m.__stub])), cat: __ts.ctx.mods.economy.catalog().length, sp: __ts.ctx.mods.economy.sellPoints().map((p) => p.id + (p.active ? '+' : '-')) }; });
check(d4.ok && d4.st.robots === 1 && d4.cat === 17 && d4.stub.economy === false && d4.stub.debug === false, `www/index.html with stubs (${Object.entries(d4.stub).filter(([, v]) => v).map(([k]) => k).join(', ')}): economy + __ts work, sell points ${d4.sp.join(' ')}`);
await p4.close();

check(errors.length === 0, 'no page / console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
console.log(notes.join('\n')); console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'all browser checks passed');
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
