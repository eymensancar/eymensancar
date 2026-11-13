// Full play-through of the slice like a player, with REAL touch (CDP multi-touch) on the real game:
// first launch → hand picks (hold + tap) → walk to the shop (stick + look drag) → first sale → shop panel (touch buy)
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

async function boot(query) {
  await page.goto(base + '?debug' + (query || ''));
  await ready(page);
  await install(page);
  await page.evaluate(() => { __ts.ctx.manual = true; });
  await wait(700); // boot curtain fade (CSS)
  tp = await T;
}

async function run() {
// ------------------------------------------------------------------------------------ 1. first launch
log('1. first launch');
await boot('&reset');
let s = await st();
check(R, s.coins === 0 && s.bag.units === 0 && s.tool === 'hands' && s.unitsLeft > 13000, 'fresh start: 0 coins, empty bag, hands, district full (' + s.unitsLeft + ' units)');
const vp = page.viewportSize();
check(R, await page.locator('.act').isVisible(), 'action button visible');
check(R, /Topla/.test(await page.locator('.act .lb').innerText()), 'action button offers "Topla"');
await shot('01-ilk-an');

// ------------------------------------------------------------------------------------ 2. hand picks (hold + tap)
log('2. hand picks');
const act = await center(page, '.act');
await tp.down(1, act.x, act.y);
await adv(1.5);
// stop right after a pick so the shot shows the item on its way into the bag
await page.evaluate(() => { const n = __ts.events('tool:collect').length; for (let k = 0; k < 40 && __ts.events('tool:collect').length === n; k++) __ts.fast(1 / 60, 1 / 60, false); __ts.fast(6 / 60, 1 / 60, true); });
await shot('02-elle');
await adv(1);
await tp.up(1);
await adv(0.05);
s = await st();
check(R, s.bag.units >= 3, 'holding the button picks items (' + s.bag.units + ' in 2.5 s)');
const before = s.bag.units;
// tap an item on the ground in front (right half, lower middle)
await page.evaluate(() => __ts.look(180, -38));
await adv(0.1);
for (let k = 0; k < 3; k++) { await tp.tap(vp.width * 0.62, vp.height * 0.72); await adv(0.2); }
s = await st();
check(R, s.bag.units > before, 'tapping an item picks it (' + before + ' → ' + s.bag.units + ')');
// fill the bag
await tp.down(1, act.x, act.y);
for (let k = 0; k < 60 && (await st()).bag.units < (await st()).bag.cap; k++) await adv(0.5);
await tp.up(1);
await adv(0.1);
s = await st();
check(R, s.bag.units === s.bag.cap, 'bag full (' + s.bag.units + '/' + s.bag.cap + ')');
check(R, /dolu/i.test(await page.locator('.act .lb').innerText()), 'button says the bag is full');

// ------------------------------------------------------------------------------------ 3. walk to the shop, first sale
log('3. walk to the shop and sell');
// turn around with look drags on the right half (0.25 deg/px: 720 px = 180 deg)
{ const n = Math.ceil(720 / (vp.width * 0.38)), px = 720 / n; // 0.25 deg/px: 720 px = 180 deg, in drags that fit the right half
  for (let k = 0; k < n; k++) { await tp.drag(2, vp.width * 0.56, vp.height * 0.45, px, 0, 8, 5); await adv(0.05); } }
await tp.drag(2, vp.width * 0.7, vp.height * 0.6, 0, -110, 8, 5); // drag up = look up, towards the kiosk
await adv(0.1);
s = await st();
check(R, Math.abs(Math.abs(s.pose.yawDeg) - 0) < 25 || Math.abs(Math.abs(s.pose.yawDeg) - 360) < 25, 'look drag turned the player round to face the shop (yaw ' + s.pose.yawDeg + ')');
const soldBefore = await ev('economy:sold');
const sx = vp.width * 0.18, sy = vp.height * 0.7;
await tp.down(3, sx, sy); await tp.move(3, sx, sy - 30); await tp.move(3, sx, sy - 60);
for (let k = 0; k < 40 && (await ev('economy:sold')) === soldBefore; k++) await adv(0.1);
await tp.up(3);
await adv(0.3);
await shot('03-satis');
await adv(1.2);
s = await st();
check(R, (await ev('economy:sold')) > soldBefore && s.coins > 0, 'walked into the shop zone: sold, ' + s.coins + ' coins');

// ------------------------------------------------------------------------------------ 4. earn, open the shop, buy by touch
log('4. shop panel, buy by touch');
await page.evaluate(() => __ts.step(0.02));
// keep playing (hands, selling) until the sack and the broom are affordable
let r;
for (let k = 0; k < 30 && (await st()).coins < 340; k++) r = await auto(20, { buy: false });
await page.evaluate(() => { __ts.teleport(39, 14.6, 0); __ts.look(0, -8); __ts.fast(0.5, 1 / 30, true); });
check(R, /Dükkan/.test(await page.locator('.act .lb').innerText()), 'at the kiosk the button offers "Dükkan"');
const a2 = await center(page, '.act');
await tp.tap(a2.x, a2.y);
await page.waitForSelector('.pn-shop', { timeout: 5000 }).catch(() => {});
if (!(await page.locator('.pn-shop').count())) console.log('DIAG', JSON.stringify(a2), await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return (e.closest('[class]') || e).className + ' | ' + JSON.stringify(__ts.events('input:button').slice(-4).map((e) => e.payload)) + ' | ' + JSON.stringify(__ts.events('ui:offer').slice(-3).map((e) => e.payload)) + ' panel=' + document.querySelector('.mwrap').innerHTML.slice(0, 80); }, [a2.x, a2.y]));
check(R, await page.locator('.pn-shop').isVisible(), 'tapping the button opens the shop panel');
await adv(0.3); await wait(300);
await shot('05-dukkan');
{ // the sack first (stays open), then close with X, reopen and buy the broom (the shop closes itself on a new tool)
  const b = page.locator('.card[data-id="bag_1"] .bt.buy'); const c = await b.boundingBox(); await tp.tap(c.x + c.width / 2, c.y + c.height / 2); await adv(0.3); await wait(300);
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
await page.evaluate(() => { __ts.teleport(31, 26.5, 270); __ts.look(270, -16); });
await adv(0.1);
await tp.down(3, sx, sy); await tp.move(3, sx, sy - 30); await tp.move(3, sx, sy - 60);
await adv(1.6);
await shot('04-supurge');
await adv(1.6);
await tp.up(3);
await adv(0.1);
s = await st();
check(R, s.unitsLeft < cleanBefore - 15, 'walking with the broom sweeps a strip (' + (cleanBefore - s.unitsLeft) + ' units)');
check(R, s.pose.x < 28, 'stick moved the player west (x ' + s.pose.x + ')');

// ------------------------------------------------------------------------------------ 6. drop-off container
log('6. drop-off');
r = await auto(1500, { until: 'dropoff' });
check(R, r.state.owned.includes('dropoff'), 'drop-off bought at game time ' + r.t.toFixed(0) + ' s of autoplay');
// fill the bag by sweeping near the SW corner, then walk into the drop-off zone
await auto(300, { buy: false, untilFull: true });
await page.evaluate(() => { __ts.teleport(3, 45.5, 180); __ts.look(180, -10); });
const soldB = await ev('economy:sold');
await tp.down(3, sx, sy); await tp.move(3, sx, sy - 60);
for (let k = 0; k < 40 && (await ev('economy:sold')) === soldB; k++) await adv(0.1);
await tp.up(3); await adv(0.1);
const lastSale = await page.evaluate(() => { const e = __ts.events('economy:sold'); return e[e.length - 1].payload; });
check(R, lastSale.pointId === 'dropoff', 'sold at the drop-off container (' + lastSale.pointId + ', ' + lastSale.coins + ' coins)');

// ------------------------------------------------------------------------------------ 7. robots
log('7. robots');
r = await auto(1500, { until: 'robot_1' });
check(R, r.state.robots >= 1, 'first robot bought at autoplay ' + r.t.toFixed(0) + ' s');
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
check(R, awayEv && awayEv.capped && awayEv.units > 0, 'away catch-up ran, capped at 2 h (' + (awayEv && awayEv.units) + ' units, ' + (awayEv && awayEv.coins) + ' coins)');
check(R, away1.unitsLeft < away0.unitsLeft && away1.coins > away0.coins, 'robots cleaned and earned while away');
check(R, await page.locator('.pn-away').isVisible(), 'one "welcome back" card shown');
const awayText = await page.locator('.pn-away').innerText().catch(() => '');
check(R, /Sen yokken/.test(awayText) && /2 saatlik sınır/.test(awayText), 'card text is honest Turkish with the 2 h cap');
check(R, (await page.locator('.toast').count()) === 0 || !(await page.locator('.toasts').innerText()).includes('Sen yokken'), 'no duplicate away toast');
if (SHOTS) await shot('06b-donus');
if (await page.locator('.pn-away').count()) { const b = await center(page, '.pn-away .pfoot .bt'); await tp.tap(b.x, b.y); await adv(0.2); }

// ------------------------------------------------------------------------------------ 8. the cart
log('8. cart');
r = await auto(2000, { until: 'cart' });
check(R, r.state.owned.includes('cart'), 'cart bought (autoplay ' + r.t.toFixed(0) + ' s)');
await page.evaluate(() => { const c = __ts.ctx.mods.tools.cartState(); if (__ts.ctx.mods.player.mounted()) __ts.ctx.mods.player.dismount(); __ts.teleport(c.x + 1.6, c.z, 270); __ts.look(270, -12); __ts.fast(0.2); });
check(R, /Bin/.test(await page.locator('.act .lb').innerText()), 'next to the cart the button offers "Bin"');
{ const b = await center(page, '.act'); await tp.tap(b.x, b.y); await adv(0.7); }
s = await st();
check(R, s.tool === 'cart', 'tapping "Bin" gets in the cart');
check(R, /Emiciyi/.test(await page.locator('.act .lb').innerText()) && await page.locator('.act2').isVisible() && /İn/.test(await page.locator('.act2 .lb').innerText()), 'in the cart: big button = nozzle, secondary = "İn"');
await page.evaluate(() => { const c = __ts.ctx.mods.tools.cartState(); const idx = __ts.ctx.mods.trash.nearestDirty(c.x, c.z, 80), cc = { x: 0, z: 0 }; __ts.ctx.mods.trash.cellCenter(idx, cc); __ts.look(Math.atan2(cc.x - c.x, -(cc.z - c.z)) * 180 / Math.PI, -8); });
const tank0 = (await st()).tank.units;
await tp.down(3, sx, sy); await tp.move(3, sx, sy - 60);
await adv(1.8);
await shot('07-araba');
await adv(1.5);
await tp.up(3); await adv(0.1);
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
r = await auto(3000, { stopClean: 0.5 });
s = await st();
check(R, s.clean >= 0.5, 'half the district clean at autoplay ' + r.t.toFixed(0) + ' s, owned: ' + s.owned.length);
check(R, (await ev('trash:milestone')) >= 2, 'milestones 25 % and 50 % fired');
// stand at the east end of the middle street and look back west along it, the plaza on the right
await page.evaluate(() => { const P = __ts.ctx.mods.player, TL = __ts.ctx.mods.tools; if (P.mounted()) P.dismount(); const c = TL.cartState(); if (c) TL.equip('hands'); __ts.teleport(53.3, 26.2, 285); __ts.look(285, -3); __ts.fast(10); });
await shot('08-yari-temiz');

// ------------------------------------------------------------------------------------ 10. 100 %: finale
log('10. 100 %');
r = await auto(4000, { stopClean: 0.97 });
// the last stretch at a watchable pace: the final sweep, the camera lift, then the card
for (let k = 0; k < 120 && !(await ev('district:cleaned')); k++) await auto(2, {});
await adv(2.2);
await shot('09a-kalkis');
await adv(3.0);
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
