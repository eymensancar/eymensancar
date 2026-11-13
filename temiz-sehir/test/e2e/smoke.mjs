// End-to-end smoke test of the whole loop on the REAL game, quick enough for every run:
// boot → pick (real touch on the action button) → sell → buy the broom → sweep (virtual stick) → buy a robot →
// fast-forward to 100 % (final sweep, "district cleaned") → reload restores the save. No console/page errors.
//
//   node test/e2e/smoke.mjs [--target index|tek|iframe] [--orient land|port]
//   target index : www/index.html (ES modules)
//   target tek   : www/tek.html wrapped the way the artifact host does (doctype, charset, viewport, fragment in body)
//   target iframe: the same wrapper inside an <iframe> (the claude.ai artifact host shows the page in one)
//   target sandbox: inside an <iframe sandbox="allow-scripts"> (opaque origin: no localStorage, no reload check)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, openPage, touchpad, center, check } from './lib.mjs';
import { install } from './autoplay.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TARGET = arg('--target', 'index'), ORIENT = arg('--orient', 'land');
const R = [];
const tekPath = path.join(ROOT, 'www/tek.html');
const extra = {};
if (TARGET !== 'index') {
  if (!fs.existsSync(tekPath)) { console.log('www/tek.html missing: run python3 tools/build.py'); process.exit(1); }
  const tek = fs.readFileSync(tekPath, 'utf8');
  extra['/wrap.html'] = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + tek + '\n</body></html>';
  const sb = TARGET === 'sandbox' ? ' sandbox="allow-scripts"' : '';
  extra['/frame.html'] = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe' + sb + ' allow="autoplay" src="/wrap.html?debug"></iframe></body></html>';
}
const server = await serve(path.join(ROOT, 'www'), extra);
const browser = await launch();
const { page, errors } = await openPage(browser, { orient: ORIENT });
const url = `http://127.0.0.1:${server.port}` + (TARGET === 'index' ? '/index.html?debug' : TARGET === 'tek' ? '/wrap.html?debug' : '/frame.html');
let F = page; // the frame the game runs in
async function boot(q) {
  await page.goto(url + (q && TARGET !== 'iframe' && TARGET !== 'sandbox' ? q : ''));
  if (TARGET === 'iframe' || TARGET === 'sandbox') { await page.waitForSelector('iframe'); F = page.frames().find((f) => f !== page.mainFrame()); }
  await F.waitForFunction(() => window.__ts && window.__ts.ready, null, { timeout: 90000 });
  await F.evaluate(() => { __ts.ctx.manual = true; });
}
const st = () => F.evaluate(() => __ts.state());
const t0 = Date.now();
try {
  await boot('&reset');
  await install(F);
  let s = await st();
  check(R, s.coins === 0 && s.unitsLeft > 13000, 'boot: fresh game, district full');
  const tp = await touchpad(page);
  const act = await center(F, '.act');
  await tp.down(1, act.x, act.y);
  await F.evaluate(() => __ts.fast(3, 1 / 30, false));
  await tp.up(1);
  s = await st();
  check(R, s.bag.units > 0, 'pick: holding the action button (real touch) fills the bag (' + s.bag.units + ')');
  await F.evaluate(() => { __ts.teleport(39, 14.5); __ts.fast(1.5, 1 / 30, false); });
  s = await st();
  check(R, s.coins > 0 && s.bag.units === 0, 'sell: walked into the shop zone, ' + s.coins + ' coins');
  for (let k = 0; k < 20 && (await st()).coins < 340; k++) await F.evaluate(() => window.__auto(20, { buy: false }));
  const bought = await F.evaluate(() => { const E = __ts.ctx.mods.economy; return [E.buy('bag_1'), E.buy('broom')]; });
  s = await st();
  check(R, bought[0] && bought[1] && s.tool === 'broom', 'buy: sack + broom, broom in hand');
  const u0 = s.unitsLeft;
  await F.evaluate(() => { __ts.teleport(31, 26.5, 270); __ts.stick(0, 1); __ts.fast(3, 1 / 30, false); __ts.stick(0, 0); });
  s = await st();
  check(R, s.unitsLeft < u0 - 10 && s.pose.x < 27, 'sweep: walking with the broom clears a strip (' + (u0 - s.unitsLeft) + ' units)');
  const r = await F.evaluate(() => window.__auto(1500, { until: 'robot_1' }));
  check(R, r.state.robots === 1, 'robot: first robot bought by playing (' + r.t.toFixed(0) + ' s of play)');
  await F.evaluate(() => __ts.fast(5, 1 / 30, false));
  check(R, await F.evaluate(() => __ts.ctx.mods.economy.robots()[0].units > 0), 'robot cleans on its own');
  const r2 = await F.evaluate(() => window.__auto(5000, { stopClean: 0.97 }));
  for (let k = 0; k < 60 && !(await F.evaluate(() => __ts.events('district:cleaned').length)); k++) await F.evaluate(() => window.__auto(2, {}));
  await F.evaluate(() => __ts.fast(6, 1 / 30, true));
  s = await st();
  check(R, s.clean === 1 && (await F.evaluate(() => __ts.events('district:cleaned').length)) === 1, '100 %: district cleaned (' + (r2.t / 60).toFixed(1) + ' min of autoplay after the robot)');
  check(R, await F.locator('.pn-done').isVisible(), 'completion card shown');
  const counters = await F.evaluate(() => __ts.counters());
  check(R, counters.calls <= 40 && counters.triangles <= 150000, 'budget: ' + counters.calls + ' calls, ' + counters.triangles + ' triangles');
  if (TARGET !== 'sandbox') {
    // coins of a sale still in flight (robot unloading) are folded into the save on purpose: compare with the saved value
    const pre = await F.evaluate(() => { __ts.save(); const S = __ts.state(), d = JSON.parse(localStorage.getItem(__ts.ctx.save.key)); return JSON.stringify([d.mods.economy.coins, S.owned, S.clean, S.robots, S.tool]); });
    await boot();
    const post = await F.evaluate(() => { const S = __ts.state(); return JSON.stringify([S.coins, S.owned, S.clean, S.robots, S.tool]); });
    check(R, pre === post, 'reload restores the save exactly' + (pre === post ? '' : ': ' + pre + ' vs ' + post));
  } else check(R, true, 'sandboxed iframe: plays without storage (no save, no reload check)');
} catch (e) { check(R, false, 'ABORTED: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
const errs = errors.filter((e) => !/localStorage unavailable/.test(e));
check(R, errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
console.log('[' + TARGET + ' ' + ORIENT + '] ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
console.log(R.join('\n'));
console.log((R.length - (R.failed || 0)) + '/' + R.length + ' checks passed');
await browser.close(); server.close();
process.exit(R.failed ? 1 : 0);
