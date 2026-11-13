// v2: FORCED LANDSCAPE in a portrait viewport (390x844), with real CDP touch. The page renders rotated 90 deg; every
// touch here is given in GAME coordinates (u right, v down in the landscape picture the player sees) and mapped to the
// screen like a player holding the phone sideways (home indicator on the right). Covers: stick walk, look drag,
// sweeping, opening the shop and buying, scrolling the shop list, the settings slider (FOV), the "Dikey oyna" and
// "Ekranı çevir" switches, pause, a resize back to landscape and portrait while playing, and the finale card.
//   node test/e2e/rot.mjs [--shots DIR]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, openPage, ready, touchpad, center, check } from './lib.mjs';
import { install } from './autoplay.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('--shots', null); if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const R = [];
const server = await serve(path.join(ROOT, 'www'));
const browser = await launch();
const { page, errors } = await openPage(browser, { orient: 'port', dpr: 1 });
const st = () => page.evaluate(() => __ts.state());
const adv = (sec) => page.evaluate((s) => __ts.fast(s, 1 / 30, true), sec);
let V = null;
const view = async () => { V = await page.evaluate(() => ({ rot: __ts.ctx.view.rot | 0, w: __ts.ctx.view.w, h: __ts.ctx.view.h, iw: innerWidth, ih: innerHeight, safe: Object.assign({}, __ts.ctx.view.safe), fov: __ts.ctx.camera.fov })); return V; };
const dev = (u, v) => (V.rot === 90 ? { x: V.iw - v, y: u } : V.rot === -90 ? { x: v, y: V.ih - u } : { x: u, y: v });
let tp;
const G = {
  down: (id, u, v) => { const d = dev(u, v); return tp.down(id, d.x, d.y); },
  move: (id, u, v) => { const d = dev(u, v); return tp.move(id, d.x, d.y); },
  up: (id) => tp.up(id),
  async drag(id, u0, v0, du, dv, n = 8, ms = 10) { await G.down(id, u0, v0); for (let k = 1; k <= n; k++) { await G.move(id, u0 + du * k / n, v0 + dv * k / n); await page.waitForTimeout(ms); } await G.up(id); },
};
async function shot(name) {
  if (!SHOTS) return;
  await page.addStyleTag({ content: '.dbg{display:none!important}' }).catch(() => {});
  const p = path.join(SHOTS, name + '.png'); await page.screenshot({ path: p });
}
const t0 = Date.now();
try {
  await page.goto(`http://127.0.0.1:${server.port}/index.html?debug&nosave`);
  await ready(page); await install(page);
  await page.evaluate(() => { __ts.ctx.manual = true; });
  await page.waitForTimeout(700);
  tp = await touchpad(page);
  await view();
  check(R, V.rot === 90 && V.w === 844 && V.h === 390, 'portrait viewport → forced landscape: rotated 90°, game view 844×390 (' + JSON.stringify(V) + ')');
  check(R, V.fov > 55 && V.fov < 66, 'landscape FOV in the rotated view (vertical ' + V.fov.toFixed(1) + '°, default 104° horizontal)');
  const cv = await page.evaluate(() => { const c = document.getElementById('game'), b = c.getBoundingClientRect(); return { w: c.width, h: c.height, bw: Math.round(b.width), bh: Math.round(b.height) }; });
  check(R, cv.w === 844 && cv.h === 390 && cv.bw === 390 && cv.bh === 844, 'canvas buffer is landscape (844×390), on screen it fills the portrait screen (' + JSON.stringify(cv) + ')');
  check(R, V.safe.left === 47 || V.safe.left === 0, 'safe areas mapped to the rotated edges (notch side on the left): ' + JSON.stringify(V.safe));
  const actBox = await page.locator('.act').boundingBox();
  check(R, actBox && actBox.y > V.ih * 0.6 && actBox.x < V.iw * 0.5, 'the action button sits bottom-right of the landscape picture (screen: lower left half)');
  await shot('rot-start');

  // stick walk (game left half), straight ahead = east from the start (yaw 90)
  let s0 = await st();
  await G.down(1, 120, 300); await G.move(1, 120, 270); await G.move(1, 120, 240);
  await adv(1.0);
  let s1 = await st();
  await G.up(1); await adv(0.2);
  check(R, s1.pose.x - s0.pose.x > 0.8 && Math.abs(s1.pose.z - s0.pose.z) < 0.3, 'stick up (game space) walks forward (' + (s1.pose.x - s0.pose.x).toFixed(2) + ' m east)');
  check(R, s1.bag.units > s0.bag.units, 'walking sweeps with the hand brush (' + s1.bag.units + ')');
  // look drag right 100 px (game space) → +25° yaw
  s0 = await st();
  await G.drag(2, 560, 200, 100, 0, 8, 5); await adv(0.05);
  s1 = await st();
  const dyaw = ((s1.pose.yawDeg - s0.pose.yawDeg + 540) % 360) - 180;
  check(R, Math.abs(dyaw - 25) < 1, 'look drag 100 px right in the picture → +25° yaw (' + dyaw.toFixed(1) + '°)');
  // the stick visual is drawn where the thumb landed (game space)
  await G.down(1, 140, 290); await adv(0.05);
  const stk = await page.evaluate(() => { const e = document.querySelector('.stk'); return e && !e.hidden ? e.style.transform : null; });
  await G.up(1); await adv(0.05);
  check(R, stk && /140px,\s*290px/.test(stk.replace(/translate3d\(/, '')), 'stick ring drawn under the thumb in game space (' + stk + ')');

  // shop: earn, go to the kiosk, tap "Dükkan" (screen hit-test of the rotated DOM), buy
  await page.evaluate(() => { __ts.give(2000); const sp = __ts.ctx.CONFIG.sellPoints[0].pos; __ts.teleport(sp[0], sp[1] + 1.6, 0); __ts.fast(0.4, 1 / 30, true); });
  const a = await center(page, '.act'); await tp.tap(a.x, a.y); await adv(0.2); await page.waitForTimeout(400);
  check(R, await page.locator('.pn-shop').isVisible(), 'tap on "Dükkan" opens the shop');
  await shot('rot-shop');
  const b = page.locator('.card[data-id="bag_1"] .bt.buy'); const bb = await b.boundingBox();
  await tp.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await adv(0.3); await page.waitForTimeout(600);
  check(R, (await st()).owned.includes('bag_1'), 'tap on "Satın al" buys (rotated DOM hit-test)');
  // scroll the card list with a finger drag along the list (game space: right to left)
  const sc0 = await page.evaluate(() => { const e = document.querySelector('.pn-shop .pn-bd'); return { l: e.scrollLeft, t: e.scrollTop, sw: e.scrollWidth - e.clientWidth, sh: e.scrollHeight - e.clientHeight }; });
  const horiz = sc0.sw > sc0.sh;
  await G.drag(4, 520, 230, horiz ? -260 : 0, horiz ? 0 : -160, 10, 15); await adv(0.1); await page.waitForTimeout(300);
  const sc1 = await page.evaluate(() => { const e = document.querySelector('.pn-shop .pn-bd'); return { l: e.scrollLeft, t: e.scrollTop }; });
  check(R, (horiz ? sc1.l - sc0.l : sc1.t - sc0.t) > 60, 'dragging along the shop list scrolls it in the picture\'s direction (' + JSON.stringify({ sc0, sc1 }) + ')');
  check(R, (await st()).owned.length === 1, 'the scroll drag bought nothing');
  await shot('rot-shop-scrolled');
  const x = await center(page, '.pn-shop .xb'); await tp.tap(x.x, x.y); await adv(0.2); await page.waitForTimeout(400);

  // pause + settings: FOV slider by touch, then the two orientation switches
  const pz = await center(page, '.pause'); await tp.tap(pz.x, pz.y); await adv(0.2); await page.waitForTimeout(400);
  check(R, (await st()).paused, 'pause button pauses (settings panel open)');
  await page.evaluate(() => document.querySelector('.sld').scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
  const tr = await page.locator('.sld .trk').boundingBox();
  const trG = await page.evaluate(() => { const e = document.querySelector('.sld .trk'), r = e.getBoundingClientRect(), p = { x: 0, y: 0 }; __ts.ctx.view.toView(r.left + r.width / 2, r.top + r.height / 2, p); return { cx: p.x, cy: p.y, w: r.height }; });
  await G.drag(5, trG.cx, trG.cy, -trG.w * 0.45, 0, 8, 10); await page.waitForTimeout(400);
  const f1 = await page.evaluate(() => ({ s: __ts.ctx.state.settings.fov, cam: __ts.ctx.camera.fov }));
  check(R, tr && f1.s <= 90 && f1.cam < V.fov - 5, 'FOV slider dragged left in the picture → narrower view (' + JSON.stringify(f1) + ')');
  await G.drag(5, trG.cx, trG.cy, 0, 0, 2, 10); await page.waitForTimeout(300);
  const f2 = await page.evaluate(() => __ts.ctx.state.settings.fov);
  check(R, Math.abs(f2 - 100) <= 2, 'a tap in the middle of the track sets the middle value (' + f2 + '°)');
  await shot('rot-settings');
  // "Ekranı çevir": the picture turns 180° (rot -90) and touches still map
  const flip = page.locator('[data-act="tg"][data-k="flip"]'); await flip.evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200); const fb = await flip.boundingBox();
  await tp.tap(fb.x + fb.width / 2, fb.y + fb.height / 2); await page.waitForTimeout(400); await adv(0.1);
  await view();
  check(R, V.rot === -90, '"Ekranı çevir" flips the forced landscape (rot ' + V.rot + ')');
  const close = await center(page, '.pfoot .bt'); await tp.tap(close.x, close.y); await adv(0.2); await page.waitForTimeout(300);
  s0 = await st();
  await G.drag(2, 560, 200, 100, 0, 8, 5); await adv(0.05); s1 = await st();
  check(R, Math.abs((((s1.pose.yawDeg - s0.pose.yawDeg + 540) % 360) - 180) - 25) < 1, 'after the flip a look drag right still turns right');
  await page.evaluate(() => { __ts.ctx.state.settings.flip = false; __ts.ctx.bus.emit('ui:settings', __ts.ctx.state.settings); }); await adv(0.1); await view();
  // resize to a real landscape viewport while playing: nothing rotated; back to portrait: rotated again, state kept
  const before = await st();
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(300); await adv(0.1); await view();
  check(R, V.rot === 0 && V.w === 844, 'landscape viewport: no rotation');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await adv(0.1); await view();
  const after = await st();
  check(R, V.rot === 90 && after.coins === before.coins && after.owned.join() === before.owned.join(), 'back to portrait: rotated again, nothing lost');
  s0 = await st();
  await G.down(1, 120, 300); await G.move(1, 120, 240); await adv(0.6); await G.up(1); s1 = await st();
  check(R, Math.hypot(s1.pose.x - s0.pose.x, s1.pose.z - s0.pose.z) > 0.5, 'input works after the orientation switches');
  // "Dikey oyna": the old upright layout
  await page.evaluate(() => { __ts.ctx.state.settings.portrait = true; __ts.ctx.bus.emit('ui:settings', __ts.ctx.state.settings); }); await adv(0.1); await view();
  check(R, V.rot === 0 && V.h > V.w, '"Dikey oyna": upright portrait layout');
  await shot('rot-dikey');
  await page.evaluate(() => { __ts.ctx.state.settings.portrait = false; __ts.ctx.bus.emit('ui:settings', __ts.ctx.state.settings); }); await adv(0.1); await view();

  // finale card in forced landscape
  await page.evaluate(() => { __ts.own('robot_1'); __ts.setClean(0.986); });
  for (let k = 0; k < 40 && !(await page.evaluate(() => __ts.events('district:cleaned').length)); k++) await adv(0.5);
  await adv(8);
  check(R, await page.locator('.pn-done').isVisible(), 'finale card shown');
  await shot('rot-finale');
  const done = await center(page, '.pn-done .pfoot .bt'); await tp.tap(done.x, done.y); await adv(1.0);
  check(R, (await page.locator('.pn-done').count()) === 0, '"Devam" by touch closes the card');
} catch (e) { check(R, false, 'ABORTED: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
check(R, errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
console.log('[rot] ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
console.log(R.join('\n'));
console.log((R.length - (R.failed || 0)) + '/' + R.length + ' checks passed');
await browser.close(); server.close();
process.exit(R.failed ? 1 : 0);
