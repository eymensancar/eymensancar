// Full play-through of the slice like a player, with REAL touch (CDP multi-touch) on the real game:
// first launch → hand brush (hold, then walk) → follow the sell marker to the shop (stick + look drag) → first sale →
// shop panel (touch buy, double-tap guard)
// → broom sweep (stick) → drop-off sale → robots (name tags) → away return (reload with an old save) → cart (touch:
// get in, drive, nozzle, get out) → 50 % → 100 % finale → reload restores the save exactly. Long stretches between
// the stages are fast-forwarded with the autoplayer (test/e2e/autoplay.mjs); every KIND of action is done for real.
//
//   node test/e2e/play.mjs [--shots DIR] [--orient land|port] [--dpr 1]
// Exit code 1 on any failed check or any console/page error.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, openPage, ready, touchpad, center, check } from './lib.mjs';
import { install } from './autoplay.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('--shots', null), ORIENT = arg('--orient', 'land'), DPR = +arg('--dpr', 1);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const R = [];
const log = (m) => console.log(m);

const server = await serve(path.join(ROOT, 'www'));
const browser = await launch();
const { page, errors, context } = await openPage(browser, { orient: ORIENT, dpr: DPR });
const base = `http://127.0.0.1:${server.port}/index.html`;
const T = touchpad(page);
let tp = null;
const st = () => page.evaluate(() => __ts.state());
const ev = (n) => page.evaluate((n) => __ts.events(n).length, n);
const wait = (ms) => page.waitForTimeout(ms);
async function shot(name) {
  if (!SHOTS) return;
  if (ORIENT === 'port') name += '-dikey';
  await page.addStyleTag({ content: '.dbg{display:none!important}' }).catch(() => {});
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  log('  shot ' + name);
}
async function auto(seconds, opt) { return page.evaluate(([s, o]) => window.__auto(s, o), [seconds, opt || {}]); }
// The loop stays MANUAL: SwiftShader takes ~0.1 s per rendered frame, which would make the rAF loop clamp dt and
// delay touch events past the tap threshold. Touches are real (CDP); game time is advanced explicitly with adv()
// (gameplay + ui updates at 30 Hz, one render at the end).
const adv = (sec) => page.evaluate((sec) => __ts.fast(sec, 1 / 30, true), sec);
const realtime = () => adv(0.05);

// v2: in a portrait viewport the game is rotated 90 deg (forced landscape). Touches are given in GAME coordinates
// (u right, v down in the landscape picture) and mapped to the screen here, the way a player holding the phone
// sideways touches it. GW/GH = game view size.
let ROT = 0, GW = 0, GH = 0, IW = 0, IH = 0;
async function view() { const v = await page.evaluate(() => ({ rot: __ts.ctx.view.rot | 0, w: __ts.ctx.view.w, h: __ts.ctx.view.h, iw: innerWidth, ih: innerHeight })); ROT = v.rot; GW = v.w; GH = v.h; IW = v.iw; IH = v.ih; }
const dev = (u, v) => (ROT === 90 ? { x: IW - v, y: u } : ROT === -90 ? { x: v, y: IH - u } : { x: u, y: v });
const G = {
  down: (id, u, v) => { const d = dev(u, v); return tp.down(id, d.x, d.y); },
  move: (id, u, v) => { const d = dev(u, v); return tp.move(id, d.x, d.y); },
  up: (id) => tp.up(id),
  tap: (u, v) => { const d = dev(u, v); return tp.tap(d.x, d.y); },
  async drag(id, u0, v0, du, dv, n = 10, ms = 30) { await G.down(id, u0, v0); for (let k = 1; k <= n; k++) { await G.move(id, u0 + du * k / n, v0 + dv * k / n); await page.waitForTimeout(ms); } await G.up(id); },
};
async function boot(query) {
  await page.goto(base + '?debug' + (query || ''));
  await ready(page);
  await install(page);
  await page.evaluate(() => { __ts.ctx.manual = true; });
  await wait(700); // boot curtain fade (CSS)
  tp = await T;
  await view();
}
// v2 (QA #1): follow the sell marker like a new player: turn towards an edge arrow, walk towards the pin
async function followMarker(maxSteps = 60) {
  for (let k = 0; k < maxSteps; k++) {
    const ind = await page.evaluate(() => { const e = document.querySelector('.ind'); if (!e || e.hidden) return null; const m = /translate3d\((-?[\d.]+)px/.exec(e.style.transform) || /translate\((-?[\d.]+)px/.exec(e.style.transform); return { edge: e.classList.contains('edge'), back: e.classList.contains('back'), left: e.style.getPropertyValue('--nx').trim().startsWith('-'), x: m ? +m[1] : NaN }; });
    if (!ind) return true;   // marker gone: arrived (sold)
    if (ind.edge) await G.drag(2, GW * 0.62, GH * 0.45, ind.left ? -100 : 100, 0, 6, 5);
    else {
      if (ind.x < GW * 0.4) await G.drag(2, GW * 0.62, GH * 0.45, -24, 0, 4, 5); else if (ind.x > GW * 0.6) await G.drag(2, GW * 0.62, GH * 0.45, 24, 0, 4, 5);
      const sx0 = GW * 0.16, sy0 = GH * 0.7; await G.down(3, sx0, sy0); await G.move(3, sx0, sy0 - 60); await adv(0.35); await G.up(3);
    }
    await adv(0.1);
  }
  return false;
}

async function run() {
// ------------------------------------------------------------------------------------ 1. first launch
log('1. first launch');
await boot('&reset');
let s = await st();
check(R, s.coins === 0 && s.bag.units === 0 && s.tool === 'brush' && s.unitsLeft > 30000, 'fresh start: 0 coins, empty bag, hand brush, district full (' + s.unitsLeft + ' units)');
check(R, ORIENT !== 'port' || (ROT === 90 && GW > GH), 'portrait viewport: the game runs in forced landscape (rot ' + ROT + ', ' + GW + 'x' + GH + ')');
const vp = page.viewportSize();
check(R, await page.locator('.act').isVisible(), 'action button visible');
check(R, /Fırçala/.test(await page.locator('.act .lb').innerText()), 'action button offers "Fırçala"');
check(R, /Basılı tut ve yürü/.test(await page.locator('.hint .bub').innerText().catch(() => '')), 'first hint: "Basılı tut ve yürü" over the stick');
await shot('01-ilk-an');

// ------------------------------------------------------------------------------------ 2. hand brush (hold, then walk)
log('2. hand brush');
const sx = GW * 0.16, sy = GH * 0.7;   // stick (game coordinates, left half)
await G.down(3, sx, sy); await G.move(3, sx, sy - 30); await G.move(3, sx, sy - 60);
await adv(1.2);
await G.up(3); await adv(0.1);
s = await st();
check(R, s.bag.units > 0, 'walking with the stick (no button) sweeps with the brush (' + s.bag.units + ')');
const before = s.bag.units;
const act = await center(page, '.act');
await tp.down(1, act.x, act.y);
await adv(0.6);
// stop right after a flick so the shot shows items on their way into the dustpan
await page.evaluate(() => { const n = __ts.events('tool:collect').length; for (let k = 0; k < 40 && __ts.events('tool:collect').length === n; k++) __ts.fast(1 / 60, 1 / 60, false); __ts.fast(5 / 60, 1 / 60, true); });
await shot('02-el-fircasi');
await tp.up(1);
await adv(0.05);
s = await st();
check(R, s.bag.units > before, 'holding the button standing still flicks trash into the dustpan (' + before + ' → ' + s.bag.units + ')');
// fill the bag
await tp.down(1, act.x, act.y);
for (let k = 0; k < 60 && (await st()).bag.units < (await st()).bag.cap; k++) await adv(0.5);
await tp.up(1);
await adv(0.1);
s = await st();
check(R, s.bag.units === s.bag.cap, 'bag full (' + s.bag.units + '/' + s.bag.cap + ')');
check(R, /dolu/i.test(await page.locator('.act .lb').innerText()), 'button says the bag is full');

// ------------------------------------------------------------------------------------ 3. follow the marker to the shop, first sale
log('3. follow the sell marker and sell');
const soldBefore = await ev('economy:sold');
await page.evaluate(() => __ts.look(270, -6)); await adv(0.1);   // the shop is now behind-right: the marker must say so
const edge0 = await page.evaluate(() => document.querySelector('.ind').classList.contains('edge'));
check(R, edge0, 'shop behind the player: the marker sits on the screen edge with a turn arrow (not the in-view pin)');
const arrived = await followMarker();
await adv(0.3);
await shot('03-satis');
await adv(1.2);
s = await st();
check(R, arrived && (await ev('economy:sold')) > soldBefore && s.coins > 0, 'following the marker (turn, then walk) reached the shop and sold: ' + s.coins + ' coins');

// ------------------------------------------------------------------------------------ 4. earn, open the shop, buy by touch
log('4. shop panel, buy by touch');
await page.evaluate(() => __ts.step(0.02));
// keep playing (hands, selling) until the sack and the broom are affordable
let r;
for (let k = 0; k < 60 && (await st()).coins < 1450; k++) r = await auto(20, { buy: false });
await page.evaluate(() => { const sp = __ts.ctx.CONFIG.sellPoints[0].pos; __ts.teleport(sp[0], sp[1] + 1.6, 0); __ts.look(0, -8); __ts.fast(0.5, 1 / 30, true); });
check(R, /Dükkan/.test(await page.locator('.act .lb').innerText()), 'at the kiosk the button offers "Dükkan"');
const a2 = await center(page, '.act');
await tp.tap(a2.x, a2.y);
await page.waitForSelector('.pn-shop', { timeout: 5000 }).catch(() => {});
if (!(await page.locator('.pn-shop').count())) console.log('DIAG', JSON.stringify(a2), await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return (e.closest('[class]') || e).className + ' | ' + JSON.stringify(__ts.events('input:button').slice(-4).map((e) => e.payload)) + ' | ' + JSON.stringify(__ts.events('ui:offer').slice(-3).map((e) => e.payload)) + ' panel=' + document.querySelector('.mwrap').innerHTML.slice(0, 80); }, [a2.x, a2.y]));
check(R, await page.locator('.pn-shop').isVisible(), 'tapping the button opens the shop panel');
await adv(0.3); await wait(300);
await shot('05-dukkan');
{ // the sack first (stays open), then close with X, reopen and buy the broom (the shop closes itself on a new tool)
  // QA #3: a quick double tap on "Satın al" buys only that item (the card sliding into its place is not bought)
  const owned0 = (await st()).owned.length;
  const b = page.locator('.card[data-id="bag_1"] .bt.buy'); const c = await b.boundingBox();
  await tp.tap(c.x + c.width / 2, c.y + c.height / 2); await wait(70); await tp.tap(c.x + c.width / 2, c.y + c.height / 2); await adv(0.3); await wait(300);
  check(R, (await st()).owned.length === owned0 + 1, 'double tap on buy: exactly one purchase (' + (await st()).owned.join(',') + ')');
  const x = await center(page, '.pn-shop .xb'); await tp.tap(x.x, x.y); await adv(0.3); await wait(300);
  check(R, (await page.locator('.mw').count()) === 0, 'X closes the shop');
  const a3 = await center(page, '.act'); await tp.tap(a3.x, a3.y); await adv(0.2); await wait(300);
  const b2 = page.locator('.card[data-id="broom"] .bt.buy'); await b2.scrollIntoViewIfNeeded(); const c2 = await b2.boundingBox(); await tp.tap(c2.x + c2.width / 2, c2.y + c2.height / 2); await adv(0.5); await wait(500);
}
s = await st();
check(R, s.owned.includes('bag_1') && s.owned.includes('broom'), 'bought the sack and the broom by touch (' + s.owned.join(',') + ')');
check(R, (await page.locator('.mw').count()) === 0, 'the shop closed itself after the broom (new tool in hand)');
check(R, !s.paused, 'game not paused');
check(R, s.tool === 'broom', 'the broom is in hand after buying it');

// ------------------------------------------------------------------------------------ 5. sweep with the broom
log('5. broom sweep');
const cleanBefore = s.unitsLeft;
await page.evaluate(() => { __ts.teleport(59, 26.5, 0); __ts.look(0, -16); });
await adv(0.1);
await G.down(3, sx, sy); await G.move(3, sx, sy - 30); await G.move(3, sx, sy - 60);
await adv(1.6);
await shot('04-supurge');
await adv(1.6);
await G.up(3);
await adv(0.1);
s = await st();
check(R, s.unitsLeft < cleanBefore - 15, 'walking with the broom sweeps a strip (' + (cleanBefore - s.unitsLeft) + ' units)');
check(R, s.pose.z < 24, 'stick moved the player north (z ' + s.pose.z + ')');

// ------------------------------------------------------------------------------------ 6. drop-off container
log('6. drop-off');
r = await auto(3000, { until: 'dropoff' });
check(R, r.state.owned.includes('dropoff'), 'drop-off bought at game time ' + r.t.toFixed(0) + ' s of autoplay');
// fill the bag by sweeping near the SW corner, then walk into the drop-off zone
await auto(300, { buy: false, untilFull: true });
await page.evaluate(() => { const d = __ts.ctx.CONFIG.sellPoints[1].pos; __ts.teleport(d[0], d[1] - 6, 180); __ts.look(180, -10); });
const soldB = await ev('economy:sold');
await G.down(3, sx, sy); await G.move(3, sx, sy - 60);
for (let k = 0; k < 40 && (await ev('economy:sold')) === soldB; k++) await adv(0.1);
await G.up(3); await adv(0.1);
const lastSale = await page.evaluate(() => { const e = __ts.events('economy:sold'); return e[e.length - 1].payload; });
check(R, lastSale.pointId === 'dropoff', 'sold at the drop-off container (' + lastSale.pointId + ', ' + lastSale.coins + ' coins)');

// ------------------------------------------------------------------------------------ 7. robots
log('7. robots');
r = await auto(3000, { until: 'robot_1' });
check(R, r.state.robots >= 1, 'first robot bought at autoplay ' + r.t.toFixed(0) + ' s');
// v2 (psychology review B): a robot bought now appears in front of the player, its name tag large for a few seconds
await page.evaluate(() => { const E = __ts.ctx.mods.economy; __ts.give(20000); __ts.look(__ts.state().pose.yawDeg, -12); E.buy(E.owned('robot_2') ? 'robot_3' : 'robot_2'); __ts.fast(0.3, 1 / 30, true); });
check(R, (await page.locator('.rtag.big:not([hidden])').count()) >= 1, 'the new robot is in view at once, with a large name tag');
await auto(8, { buy: false });
await page.evaluate(() => { const rb = __ts.ctx.mods.economy.robots()[0]; const yaw = Math.atan2(rb.x - (rb.x + 2.2), -(rb.z - (rb.z + 2.2))); __ts.teleport(rb.x + 2.2, rb.z + 2.2, yaw); __ts.look(yaw * 180 / Math.PI, -24); __ts.fast(0.2); });
const tags = await page.locator('.rtag:not([hidden])').allInnerTexts();
check(R, tags.some((t) => /Robot 1: Pırıl/.test(t)), 'robot name tag visible: ' + JSON.stringify(tags));
await shot('06-robot');

// away return: an old save (2.5 h ago) → robots worked, one honest card
log('7b. away return');
const away0 = await st();
// age the save by 2.5 h, then stop this page from writing it again on pagehide (as if the app had been killed)
await page.evaluate(() => { __ts.save(); const k = __ts.ctx.save.key, d = JSON.parse(localStorage.getItem(k)); d.savedAt -= 2.5 * 3600 * 1000; localStorage.setItem(k, JSON.stringify(d)); Storage.prototype.setItem = function () {}; });
await page.goto(base + '?debug');
await ready(page); await install(page); await page.evaluate(() => { __ts.ctx.manual = true; }); await adv(0.2); await wait(700);
const away1 = await st();
const awayEv = await page.evaluate(() => { const e = __ts.events('economy:away'); return e.length ? e[e.length - 1].payload : null; });
check(R, awayEv && (awayEv.capped || awayEv.limitedByRemaining) && awayEv.units > 0 && awayEv.simS <= 600 && awayEv.coins <= 1.4 * (await page.evaluate(() => (__ts.ctx.mods.economy.catalog().find((e) => e.next) || { price: 1e9 }).price)) + 600, 'away catch-up ran, capped (' + (awayEv && awayEv.limitBy) + ': ' + (awayEv && awayEv.units) + ' units, ' + (awayEv && awayEv.coins) + ' coins)');
check(R, away1.unitsLeft < away0.unitsLeft && away1.coins > away0.coins, 'robots cleaned and earned while away');
check(R, await page.locator('.pn-away').isVisible(), 'one "welcome back" card shown');
const awayText = await page.locator('.pn-away').innerText().catch(() => '');
check(R, /Sen yokken/.test(awayText) && /sınır/.test(awayText), 'card text is honest Turkish and names the limit that applied');
check(R, (await page.locator('.toast').count()) === 0 || !(await page.locator('.toasts').innerText()).includes('Sen yokken'), 'no duplicate away toast');
if (SHOTS) await shot('06b-donus');
if (await page.locator('.pn-away').count()) { const b = await center(page, '.pn-away .pfoot .bt'); await tp.tap(b.x, b.y); await adv(0.2); }

// ------------------------------------------------------------------------------------ 8. the cart
log('8. cart');
r = await auto(4000, { until: 'cart' });
check(R, r.state.owned.includes('cart'), 'cart bought (autoplay ' + r.t.toFixed(0) + ' s)');
await page.evaluate(() => { const c = __ts.ctx.mods.tools.cartState(); if (__ts.ctx.mods.player.mounted()) __ts.ctx.mods.player.dismount(); __ts.teleport(c.x + 1.6, c.z, 270); __ts.look(270, -12); __ts.fast(0.2); });
check(R, /Bin/.test(await page.locator('.act .lb').innerText()), 'next to the cart the button offers "Bin"');
{ const b = await center(page, '.act'); await tp.tap(b.x, b.y); await adv(0.7); }
s = await st();
check(R, s.tool === 'cart', 'tapping "Bin" gets in the cart');
check(R, /Emiciyi/.test(await page.locator('.act .lb').innerText()) && await page.locator('.act2').isVisible() && /İn/.test(await page.locator('.act2 .lb').innerText()), 'in the cart: big button = nozzle, secondary = "İn"');
await page.evaluate(() => { const c = __ts.ctx.mods.tools.cartState(); __ts.look(c.heading * 180 / Math.PI, -8); });   // straight ahead along the street
const tank0 = (await st()).tank.units;
await G.down(3, sx, sy); await G.move(3, sx, sy - 60);
await adv(1.8);
await shot('07-araba');
await adv(1.5);
await G.up(3); await adv(0.1);
s = await st();
check(R, s.tank.units > tank0, 'driving with the nozzle down fills the tank (' + tank0 + ' → ' + s.tank.units + ')');
const noz0 = await ev('tool:nozzle');
{ const b = await center(page, '.act'); await tp.tap(b.x, b.y); await adv(0.3); await tp.tap(b.x, b.y); await adv(0.3); }
check(R, (await ev('tool:nozzle')) === noz0 + 2, 'nozzle up/down by touch');
{ const b = await center(page, '.act2'); await tp.tap(b.x, b.y); await adv(0.6); }
s = await st();
check(R, s.tool !== 'cart', 'secondary button "İn" gets out (' + s.tool + ')');

// ------------------------------------------------------------------------------------ 9. half clean: the trail from afar
log('9. 50 %');
r = await auto(6000, { stopClean: 0.5 });
s = await st();
check(R, s.clean >= 0.5, 'half the district clean at autoplay ' + r.t.toFixed(0) + ' s, owned: ' + s.owned.length);
check(R, await page.evaluate(() => __ts.events('trash:milestone').some((e) => e.payload.index === 1)), 'the 50 % milestone fired');
// stand at the east end of the middle street and look back west along it, the plaza on the right
await page.evaluate(() => { const P = __ts.ctx.mods.player, TL = __ts.ctx.mods.tools; if (P.mounted()) P.dismount(); const c = TL.cartState(); if (c) TL.equip('brush'); __ts.teleport(88.5, 59, 270); __ts.look(270, -3); __ts.fast(10); });
await shot('08-yari-temiz');

// ------------------------------------------------------------------------------------ 10. 100 %: finale
log('10. 100 %');
r = await auto(8000, { stopClean: 0.97 });
// the last stretch at a watchable pace: the final sweep, the camera lift, then the card
for (let k = 0; k < 120 && !(await ev('district:cleaned')); k++) await auto(2, {});
await adv(3.5);
await shot('09a-kalkis');
await adv(4.0);   // v2: the card comes part-way through the slow 10 s lift
s = await st();
check(R, s.clean === 1 && s.unitsLeft === 0, 'district 100 % clean (autoplay ' + r.t.toFixed(0) + ' s)');
check(R, (await ev('district:cleaned')) === 1 && (await ev('economy:finalSweep')) === 1, 'final sweep and "district cleaned" fired once');
await wait(400);
check(R, await page.locator('.pn-done').isVisible(), 'the "Mahalle tertemiz!" card is shown');
await shot('09-final');
const done = await page.locator('.pn-done').innerText();
check(R, /Mahalle tertemiz/.test(done), 'card title');
{ const b = await center(page, '.pn-done .pfoot .bt'); await tp.tap(b.x, b.y); await adv(2.0); }

// ------------------------------------------------------------------------------------ 11. reload restores the save
log('11. reload');
const pre = await page.evaluate(() => { __ts.save(); const S = __ts.state(); return { coins: S.coins, owned: S.owned, clean: S.clean, x: S.pose.x, z: S.pose.z, tool: S.tool, robots: S.robots }; });
await page.goto(base + '?debug');
await ready(page);
const post = await page.evaluate(() => { const S = __ts.state(); return { coins: S.coins, owned: S.owned, clean: S.clean, x: S.pose.x, z: S.pose.z, tool: S.tool, robots: S.robots }; });
check(R, JSON.stringify(pre) === JSON.stringify(post), 'reload restores exactly: ' + JSON.stringify(post));
check(R, (await page.locator('.pn-done').count()) === 0, 'finale not shown again after reload');

}
try { await run(); } catch (e) { check(R, false, 'ABORTED: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
// ------------------------------------------------------------------------------------ done
check(R, errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
console.log(R.join('\n'));
console.log((R.length - (R.failed || 0)) + '/' + R.length + ' checks passed');
await browser.close(); server.close();
process.exit(R.failed ? 1 : 0);
