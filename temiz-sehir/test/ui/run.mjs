// UI test: drives www/ with fake world/trash/player/tools/economy (test/ui/fakes), real main/bus/config/ui/audio.
// Takes a screenshot of every HUD state and panel in landscape (844x390, 932x430) and portrait (390x844),
// checks tap targets (>= 44 px), HUD overlaps/off-screen, console errors, and measures ui.update cost.
// Usage: node test/ui/run.mjs [--three /path/three.min.js] [--vp land|land2|port] [--only name]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const threeLocal = arg('--three') || ['/tmp/claude-0/-home-user/8066dee7-8627-553b-a97c-0e1bfc2ce9b4/scratchpad/lib/three.min.js'].find((p) => fs.existsSync(p));
const onlyVp = arg('--vp'), only = arg('--only');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((q, s) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s);
}).listen(0);
const port = server.address().port;
const FAKES = ['world', 'trash', 'player', 'tools', 'economy', 'debug'];

const VPS = {
  land: { w: 844, h: 390, safe: { t: 0, r: 47, b: 21, l: 47 }, bg: '/test/spike/shots/05-cleaned-trail.png' },
  land2: { w: 932, h: 430, safe: { t: 0, r: 59, b: 21, l: 59 }, bg: '/test/spike/shots/02-street-north.png' },
  port: { w: 390, h: 844, safe: { t: 47, r: 0, b: 34, l: 0 }, bg: '/test/spike/shots/02-street-north.png' },
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const report = { errors: [], tapTargets: [], overlaps: [], perf: {}, shots: [] };

async function open(vp, query = '?manual&nosave', init) {
  const V = VPS[vp];
  const page = await browser.newPage({ viewport: { width: V.w, height: V.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: false });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') report.errors.push(vp + ' [' + m.type() + '] ' + m.text()); });
  page.on('pageerror', (e) => report.errors.push(vp + ' [pageerror] ' + e.message));
  if (threeLocal) await page.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
  for (const f of FAKES) await page.route('**/www/js/' + f + '.js', (r) => r.fulfill({ path: path.join(here, 'fakes', f + '.js'), contentType: 'text/javascript' }));
  await page.addInitScript(({ bg, safe }) => {
    window.__FK_BG = bg;
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sat:${safe.t}px!important;--sar:${safe.r}px!important;--sab:${safe.b}px!important;--sal:${safe.l}px!important}`;
      document.head.appendChild(s);
    });
  }, { bg: V.bg, safe: V.safe });
  if (init) await page.addInitScript(init);
  await page.goto(`http://127.0.0.1:${port}/www/index.html${query}`);
  await page.waitForFunction(() => window.__ctx && window.__fk && window.__fk.econ && !document.getElementById('boot'), null, { timeout: 30000 });
  await page.evaluate(() => { window.S = (n) => window.__ctx.step(n || 1, 1 / 60); window.W = (sec) => window.__ctx.step(Math.ceil(sec / 0.1), 0.1); });
  return page;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, vp, name, delay = 350) {
  if (only && !name.includes(only)) return;
  await wait(delay);
  const dir = path.join(here, 'shots', vp); fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, name + '.png') });
  report.shots.push(vp + '/' + name);
  await checkLayout(page, vp, name);
}
async function checkLayout(page, vp, name) {
  const r = await page.evaluate(() => {
    const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; let p = el; while (p) { if (p.hidden) return false; p = p.parentElement; } const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const out = { small: [], off: [], overlap: [] };
    const W = innerWidth, H = innerHeight;
    for (const b of document.querySelectorAll('#ui button')) {
      if (!vis(b)) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.small.push((b.className || b.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    const hud = ['.g-tl', '.g-tc', '.g-tr', '.act', '.tools'].map((s) => [s, document.querySelector('#ui ' + s)]).filter(([, e]) => vis(e) && !document.querySelector('#ui .mw'));
    for (const [s, e] of hud) { const r = e.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.off.push(s); }
    // overlap between HUD groups (children boxes, since groups are flex columns)
    const boxes = [];
    for (const [s, e] of hud) { const kids = e.matches('.act') ? [e] : [...e.children].filter(vis); for (const k of kids) boxes.push([s + '>' + (k.className.baseVal != null ? 'svg' : k.className.split(' ').slice(0, 2).join('.')), k.getBoundingClientRect()]); }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [na, a] = boxes[i], [nb, b] = boxes[j];
      if (na.split('>')[0] === nb.split('>')[0]) continue;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.overlap.push(na + ' x ' + nb);
    }
    // panel inside viewport
    const pn = document.querySelector('#ui .pn');
    if (pn && vis(pn)) { const r = pn.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.off.push('.pn'); }
    // clipped single-line text (ellipsis kicked in or overflow)
    out.clip = [];
    for (const el of document.querySelectorAll('#ui .gn, #ui .ms-t, #ui .card .nm, #ui .rrow .rn, #ui .toast, #ui .act .lb, #ui .bt')) { if (vis(el) && el.scrollWidth > el.clientWidth + 1) out.clip.push(el.className + ': ' + el.textContent.slice(0, 30)); }
    return out;
  });
  if (r.small.length) report.tapTargets.push(vp + '/' + name + ': ' + r.small.join(', '));
  if (r.off.length || r.overlap.length || r.clip.length) report.overlaps.push(vp + '/' + name + ': off=[' + r.off.join(',') + '] overlap=[' + r.overlap.join(', ') + '] clip=[' + r.clip.join(' | ') + ']');
}
async function tapEl(page, sel) {
  const loc = page.locator('#ui ' + sel).first();
  await loc.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
  const b = await loc.boundingBox();
  if (!b) throw new Error('no element ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

async function run(vp) {
  const V = VPS[vp];
  let page = await open(vp);
  const ev = (fn, a) => page.evaluate(fn, a);
  // 01 fresh start: one prompt on the button, endowed first goal
  await ev(() => S(30));
  await shot(page, vp, '01-start');
  // 02 picking: pickups (+N near the bag), stick visual
  await ev(() => {
    const fk = window.__fk;
    fk.player.input.stick.active = true; fk.player.input.stick.cx = 120; fk.player.input.stick.cy = innerHeight - 110; fk.player.input.stick.x = 150; fk.player.input.stick.y = innerHeight - 150;
    for (let i = 0; i < 9; i++) { fk.econ.bag++; fk.emit('tool:collect', { tool: 'hands', units: 1, byType: new Int32Array([1, 0, 0, 0, 0, 0]), x: 39, y: 0.1, z: 19, valuable: false }); S(8); }
  });
  await shot(page, vp, '02-picking', 120);
  // 03 bag full: red state, edge indicator to the shop behind, sell hint
  await ev(() => { const fk = window.__fk; fk.player.input.stick.active = false; fk.econ.bag = 15; fk.emit('economy:bagFull', { container: 'bag' }); S(12); });
  await shot(page, vp, '03-bag-full');
  // 03b looking sideways: indicator on the side edge
  await ev(() => { window.__fk.player.pose.yaw = Math.PI / 2; S(2); });
  await shot(page, vp, '03b-indicator-side', 100);
  // 04 sale: walk in facing the shop; coins fly to the counter
  await ev(() => { const fk = window.__fk; fk.player.pose.yaw = 0; fk.player.pose.z = 18; fk.econ.bag = 0; fk.econ.coins = 26; fk.emit('economy:sold', { pointId: 'shop', units: 15, coins: 26, x: 39, z: 13, by: 'player', valuable: false }); S(3); });
  await shot(page, vp, '04-sale-coins', 280);
  await ev(() => W(1));
  // 05 goal ready + shop offer on the button (inside the shop radius)
  await ev(() => { const fk = window.__fk; fk.econ.coins = 46; fk.player.pose.z = 15.4; S(20); });
  await shot(page, vp, '05-goal-ready-shop-offer', 600);
  // 06 open the shop by pressing the context button (real pointer path)
  await tapEl(page, '.act'); await ev(() => S(2));
  await shot(page, vp, '06-shop-first');
  // 07 buy the sack
  await tapEl(page, '.card[data-id="bag_1"] .buy'); await ev(() => S(4));
  await shot(page, vp, '07-shop-bought', 250);
  await tapEl(page, '.xb'); await ev(() => S(2));
  // 08 mid-game HUD: broom, robots, boost timer, compass markers, near goal, stick active
  await ev(() => {
    const fk = window.__fk, e = fk.econ;
    for (const id of ['bag_1', 'broom', 'bag_2', 'broom_w1', 'dropoff', 'bag_3', 'robot_1', 'robot_2']) e.owned[id] = true;
    e.coins = 1370; e.bag = 112; e.boostLeft = 87;
    e.robots = [{ id: 'r0', x: 30, z: 20, yaw: 0, state: 'clean', load: 22, cap: 60 }, { id: 'r1', x: 45, z: 28, yaw: 0, state: 'travel', load: 60, cap: 60 }];
    fk.tools.available = ['hands', 'broom']; fk.tools.current = 'broom'; fk.emit('tool:changed', { id: 'broom' });
    fk.trash.clean = 0.183; fk.player.pose.z = 22; fk.player.pose.yaw = Math.PI * 0.85;
    fk.player.input.stick.active = true; fk.player.input.stick.cx = 130; fk.player.input.stick.cy = innerHeight - 120; fk.player.input.stick.x = 150; fk.player.input.stick.y = innerHeight - 170;
    S(30);
  });
  await shot(page, vp, '08-midgame-hud', 500);
  // 09 shop mid-game with boost offer, robot list, promo slot
  await ev(() => { const e = window.__fk.econ; e.boostLeft = 0; e.cdLeft = 0; e.canOffer = true; window.__fk.player.input.stick.active = false; window.__ctx.mods.ui.openPanel('shop'); S(12); });
  await shot(page, vp, '09-shop-mid');
  await ev(() => { const s = document.querySelector('#ui .pn-bd'); s.scrollTop = s.scrollHeight; });
  await shot(page, vp, '09b-shop-mid-scrolled', 150);
  // 10 mock ad
  await tapEl(page, '.boostbx .ad'); await ev(() => { S(4); W(1.2); });
  await shot(page, vp, '10-mock-ad', 100);
  await ev(() => W(3.5));
  await shot(page, vp, '10b-shop-boost-on', 300);
  await tapEl(page, '.xb'); await ev(() => S(2));
  // 11 milestone 25 %
  await ev(() => { const fk = window.__fk; fk.trash.clean = 0.25; fk.econ.coins += 100; fk.emit('trash:milestone', { index: 0, at: 0.25, fraction: 0.25 }); S(10); });
  await shot(page, vp, '11-milestone-25', 450);
  await ev(() => W(5));
  // 12 milestone 50 % with the one-time boost offer
  await ev(() => { const fk = window.__fk; fk.econ.boostLeft = 0; fk.econ.cdLeft = 0; fk.trash.clean = 0.5; fk.emit('trash:milestone', { index: 1, at: 0.5, fraction: 0.5 }); S(10); });
  await shot(page, vp, '12-milestone-50-offer', 600);
  await ev(() => W(12));
  // 13 cart: tank meter, nozzle on the button
  await ev(() => { const fk = window.__fk; fk.econ.owned.cart = true; fk.tools.nearCart = true; S(4); });
  await shot(page, vp, '13a-cart-enter-offer', 300);
  await tapEl(page, '.act'); await ev(() => { const fk = window.__fk; fk.econ.tank = 340; fk.player.pose.speed = 4; S(12); });
  await shot(page, vp, '13b-cart-driving', 300);
  await tapEl(page, '.act'); await ev(() => S(4));    // nozzle via the big button (integration decision)
  await ev(() => { const fk = window.__fk; fk.econ.tank = 600; fk.emit('economy:bagFull', { container: 'tank' }); S(8); });
  await shot(page, vp, '13c-tank-full', 300);
  await tapEl(page, '.act2'); await ev(() => S(4));   // "İn" on the secondary button
  // 14 stragglers (≥ 90 %): red dots on the compass
  await ev(() => { const fk = window.__fk; window.__ctx.mods.player.dismount(); fk.tools.current = 'broom'; fk.tools.nearCart = false; fk.econ.bag = 40; fk.trash.clean = 0.934; const s = fk.trash.sums; s.fill(0); s[3] = 12; s[40] = 30; s[77] = 6; fk.player.pose.yaw = Math.PI * 1.1; S(30); });
  await shot(page, vp, '14-stragglers', 300);
  // 15 district cleaned: final sweep, camera lift wait, complete card
  await ev(() => { const fk = window.__fk; fk.econ.items = 13446; fk.econ.earned = 29880; fk.econ.playS = 1027; fk.trash.clean = 1; fk.emit('economy:finalSweep', { units: 190, coins: 410 }); fk.emit('trash:milestone', { index: 3, at: 1, fraction: 1 }); fk.emit('district:cleaned', { playS: 1027 }); W(5); }); // CONFIG.ui.completeDelayS 4.6 (integration)
  await shot(page, vp, '15-complete', 700);
  await ev(() => { const s = document.querySelector('#ui .pn-bd'); if (s) s.scrollTop = s.scrollHeight; });
  await shot(page, vp, '15b-complete-scrolled', 150);
  await tapEl(page, '.pfoot .bt'); await ev(() => S(2));
  // 16 pause / settings
  await tapEl(page, '.pause'); await ev(() => S(2));
  await shot(page, vp, '16-pause-settings');
  await tapEl(page, '[data-act="rask"]'); await ev(() => S(2));
  await shot(page, vp, '16b-reset-confirm', 150);
  await tapEl(page, '[data-act="rno"]');
  // 17 English
  await tapEl(page, '[data-act="set"][data-v="en"]'); await ev(() => S(2));
  await shot(page, vp, '17-settings-en', 150);
  await tapEl(page, '.pfoot .bt'); await ev(() => { window.__ctx.mods.ui.openPanel('shop'); S(4); });
  await shot(page, vp, '17b-shop-en', 250);
  await tapEl(page, '.xb'); await ev(() => S(4));
  await shot(page, vp, '17c-hud-en', 250);
  // perf: ui.update per frame in a busy state (stick active, indicator, compass, rolling counter)
  if (vp === 'land') {
    report.perf = await ev(() => {
      const ctx = window.__ctx, fk = window.__fk, ui = ctx.mods.ui, au = ctx.mods.audio;
      fk.econ.bag = 180; fk.player.input.stick.active = true; fk.trash.clean = 0.95;
      fk.econ.robots.push({ id: 'r2', x: 10, z: 40, state: 'clean', load: 1, cap: 60 });
      const N = 2000; let t0 = performance.now();
      for (let i = 0; i < N; i++) { ctx.time.dt = 1 / 60; fk.player.pose.yaw += 0.01; fk.player.input.stick.x = 150 + (i % 20); if (i % 30 === 0) fk.econ.coins += 7; ui.update(1 / 60); }
      const uiMs = (performance.now() - t0) / N;
      t0 = performance.now();
      for (let i = 0; i < N; i++) au.update(1 / 60);
      const auMs = (performance.now() - t0) / N;
      return { uiUpdateMs: +uiMs.toFixed(4), audioUpdateMs: +auMs.toFixed(4), frames: N, audioUnlocked: au.unlocked() };
    });
  }
  // ui:offer / input:button contract check: pressing the button emits down/up and the offer id
  report.contract = report.contract || {};
  report.contract[vp] = await ev(() => {
    const ctx = window.__ctx, got = [];
    const u1 = ctx.bus.on('input:button', (p) => got.push('btn:' + p.down)), u2 = ctx.bus.on('ui:offer', (p) => got.push('offer:' + p.id + '/' + p.owner));
    S(2);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    u1(); u2();
    return got.join(' ');
  });
  await page.close();

  // 18 "while you were away" (needs a save that is 3 h old + an economy catch-up)
  page = await open(vp, '?manual', () => {
    if (!sessionStorage.getItem('fk-seeded')) { sessionStorage.setItem('fk-seeded', '1'); localStorage.setItem('temizsehir.v1', JSON.stringify({ v: 1, savedAt: Date.now() - 3 * 3600 * 1000, playS: 600, mods: { ui: { v: 1, settings: { lang: 'tr', sound: true, music: true }, hintsDone: ['pick', 'sell', 'shop', 'walk'] } } })); }
    window.__FK_AWAY = { coins: 1980, units: 1240 };
  });
  await shot(page, vp, '18-away', 400);
  await page.evaluate(() => localStorage.clear());
  await page.close();
  // 19 debug overlay
  page = await open(vp, '?manual&nosave&debug');
  await page.evaluate(() => S(40));
  await shot(page, vp, '19-debug', 300);
  await page.close();
}

const vps = onlyVp ? [onlyVp] : ['land', 'land2', 'port'];
for (const vp of vps) { try { await run(vp); } catch (e) { report.errors.push(vp + ' [runner] ' + (e.stack || e.message)); } }
await browser.close(); server.close();
fs.writeFileSync(path.join(here, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ shots: report.shots.length, errors: report.errors, tapTargets: report.tapTargets, overlaps: report.overlaps, perf: report.perf, contract: report.contract }, null, 2));
// integration: a non-zero exit code for test/run-all.mjs (runner errors, small tap targets, overlaps/clipped text)
process.exit(report.errors.length || report.tapTargets.length || report.overlaps.length ? 1 : 0);
