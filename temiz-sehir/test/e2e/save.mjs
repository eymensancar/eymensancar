// v2: saving. (1) normal storage: autosave + an immediate save after a sale and a purchase, the "Kaydedildi" tick,
// a reload restores exactly (coins, bag, owned, tool, robots, trash grid, position, settings incl. FOV, play time)
// and starts straight in the game; (2) localStorage AND sessionStorage throwing (sandboxed / third-party iframe):
// IndexedDB takes over and a reload still restores; (3) only sessionStorage: honest "only this tab" notice;
// (4) no storage at all: memory, the "Bu önizlemede ilerleme kaydedilemiyor" notice, the game plays on, no errors;
// (5) a v1 save from the old district starts fresh but keeps the settings; (6) "Baştan başla" behind a confirm.
//   node test/e2e/save.mjs
import path from 'node:path';
import { ROOT, serve, launch, openPage, ready, touchpad, center, check } from './lib.mjs';

const R = [];
const server = await serve(path.join(ROOT, 'www'));
const browser = await launch();
const base = `http://127.0.0.1:${server.port}/index.html`;
const NO_LOCAL = `(() => { const thrower = { get() { throw new DOMException('denied', 'SecurityError'); } }; Object.defineProperty(window, 'localStorage', thrower); })();`;
const NO_SESSION = `(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); })();`;
const NO_IDB = `(() => { Object.defineProperty(window, 'indexedDB', { get() { return undefined; } }); })();`;
async function fresh(init = []) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  for (const s of init) await ctx.addInitScript(s);
  const { page, errors } = await openPage(browser, { context: ctx });
  return { ctx, page, errors };
}
async function go(page, q = '') { await page.goto(base + '?debug' + q); await ready(page); await page.evaluate(() => { __ts.ctx.manual = true; }); }
const snap = (page) => page.evaluate(() => { const S = __ts.state(), M = __ts.ctx.mods; return { coins: S.coins, bag: S.bag.units, owned: S.owned.slice().sort().join(), tool: S.tool, robots: M.economy.robots().map((r) => r.x.toFixed(1) + ',' + r.z.toFixed(1) + ',' + r.state).join(';'), units: S.unitsLeft, x: S.pose.x.toFixed(2), z: S.pose.z.toFixed(2), fov: __ts.ctx.state.settings.fov, playS: Math.floor(__ts.ctx.time.game) }; });
const t0 = Date.now();
try {
  // ---- 1. normal storage
  { const { ctx, page, errors } = await fresh();
    await go(page, '&reset');
    check(R, await page.evaluate(() => __ts.ctx.save.status.kind === 'local' && __ts.ctx.save.status.persistent), 'storage probe: localStorage (write + read back works)');
    await page.evaluate(() => { __ts.hold(true); __ts.fast(3, 1 / 30, false); __ts.hold(false); __ts.clearEvents(); const sp = __ts.ctx.CONFIG.sellPoints[0].pos; __ts.teleport(sp[0], sp[1] + 1); __ts.fast(0.2, 1 / 30, false); });
    await page.waitForTimeout(1300);   // the save after a sale is debounced by save.soonS (1 s, real time)
    const afterSale = await page.evaluate(() => __ts.events('game:saved').map((e) => e.payload.reason));
    check(R, afterSale.includes('soon'), 'a sale saves within about a second (' + afterSale.join(',') + ')');
    check(R, await page.evaluate(() => document.querySelector('.svd').classList.contains('on')), '"Kaydedildi" tick shown near the pause button');
    await page.evaluate(() => { __ts.give(5000); __ts.ctx.mods.economy.buy('bag_1'); __ts.ctx.mods.economy.buy('brush_w1'); __ts.ctx.mods.economy.buy('broom'); __ts.ctx.mods.economy.buy('robot_1'); __ts.ctx.state.settings.fov = 96; __ts.ctx.bus.emit('ui:settings', __ts.ctx.state.settings); __ts.teleport(59, 26, 0); __ts.stick(0, 1); __ts.fast(2, 1 / 30, false); __ts.stick(0, 0); __ts.fast(3, 1 / 30, false); });
    await page.waitForTimeout(1300);
    const a = await snap(page);
    // no explicit save: the debounced saves (purchase, settings) and pagehide must carry everything
    await go(page);
    const b = await snap(page);
    // the robots kept working for the few real seconds of the reload (away catch-up, by design): take that out
    const aw = await page.evaluate(() => { const e = __ts.events('economy:away'); return e.length ? e[e.length - 1].payload : null; });
    if (aw) { b.coins -= aw.coins; b.units = a.units; b.robots = a.robots; }
    check(R, JSON.stringify(a) === JSON.stringify(b), 'reload restores exactly (money, bag, upgrades, tool, robots, grid, position, FOV, play time): ' + (JSON.stringify(a) === JSON.stringify(b) ? JSON.stringify(b) : JSON.stringify(a) + ' vs ' + JSON.stringify(b)));
    check(R, !(await page.evaluate(() => __ts.state().paused)) && (await page.locator('.mw').count()) === 0, 'an existing save starts straight in the game (no menu, not paused)');
    // "Baştan başla" behind a confirm
    const tp = await touchpad(page);
    const pz = await center(page, '.pause'); await tp.tap(pz.x, pz.y); await page.evaluate(() => __ts.fast(0.2)); await page.waitForTimeout(400);
    await page.locator('[data-act="rask"]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    const ra = await center(page, '[data-act="rask"]'); await tp.tap(ra.x, ra.y); await page.waitForTimeout(400);
    check(R, /silinsin/.test(await page.locator('.pn-pause').innerText()) && (await page.locator('[data-act="ryes"]').count()) === 1, '"Baştan başla" asks for a confirmation first');
    await page.locator('[data-act="ryes"]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    const ry = await center(page, '[data-act="ryes"]');
    await Promise.all([page.waitForNavigation(), tp.tap(ry.x, ry.y)]);
    await ready(page);
    const c = await page.evaluate(() => __ts.state());
    check(R, c.coins === 0 && c.owned.length === 0 && c.tool === 'brush', 'confirmed: the game starts over');
    check(R, errors.length === 0, 'normal storage: no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await ctx.close(); }

  // ---- 2. localStorage + sessionStorage throw → IndexedDB
  { const { ctx, page, errors } = await fresh([NO_LOCAL, NO_SESSION]);
    await go(page);
    const st = await page.evaluate(() => __ts.ctx.save.status);
    check(R, st.kind === 'idb' && st.persistent, 'localStorage/sessionStorage throwing → IndexedDB fallback (' + JSON.stringify(st) + ')');
    await page.evaluate(() => { __ts.give(777); __ts.save(); });
    await page.waitForTimeout(300);
    await go(page);
    check(R, (await page.evaluate(() => __ts.state().coins)) === 777, 'IndexedDB: a reload restores the progress');
    check(R, !(await page.locator('.snote').isVisible()), 'no "cannot save" notice when IndexedDB works');
    check(R, errors.length === 0, 'IndexedDB fallback: no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await ctx.close(); }

  // ---- 3. only sessionStorage
  { const { ctx, page, errors } = await fresh([NO_LOCAL]);
    await go(page);
    const st = await page.evaluate(() => __ts.ctx.save.status);
    check(R, st.kind === 'session' && !st.persistent, 'only sessionStorage → kept while the tab lives (' + JSON.stringify(st) + ')');
    check(R, /yalnız bu sekme/.test(await page.locator('.snote').innerText()), 'honest notice: "İlerleme yalnız bu sekme açıkken kalır"');
    check(R, errors.length === 0, 'session fallback: no console errors');
    await ctx.close(); }

  // ---- 4. nothing at all → memory + notice, game plays on
  { const { ctx, page, errors } = await fresh([NO_LOCAL, NO_SESSION, NO_IDB]);
    await go(page);
    const st = await page.evaluate(() => __ts.ctx.save.status);
    check(R, st.kind === 'memory' && !st.persistent, 'no storage → in-memory store (' + JSON.stringify(st) + ')');
    check(R, await page.locator('.snote').isVisible() && /Bu önizlemede ilerleme kaydedilemiyor/.test(await page.locator('.snote').innerText()), 'non-blocking notice "Bu önizlemede ilerleme kaydedilemiyor"');
    const r = await page.evaluate(() => { __ts.hold(true); __ts.fast(2, 1 / 30, false); __ts.hold(false); return { bag: __ts.state().bag.units, saved: __ts.save() }; });
    check(R, r.bag > 0, 'the game plays on without storage');
    check(R, !(await page.evaluate(() => document.querySelector('.svd').classList.contains('on'))), 'no "Kaydedildi" tick when nothing is kept');
    check(R, errors.length === 0, 'no storage: no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await ctx.close(); }

  // ---- 5. a v1 save (old 54 m district, hands) → fresh game, settings kept
  { const { ctx, page, errors } = await fresh([`if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('temizsehir.v1', JSON.stringify({ v: 1, savedAt: Date.now() - 60000, playS: 300, mods: { economy: { v: 1, coins: 999, owned: ['bag_1', 'broom'] }, tools: { v: 1, current: 'hands' }, trash: { g: 'g1.108.4.x.AAAA', ms: 0 }, ui: { v: 1, settings: { lang: 'en', sound: false } } } })); }`]);
    await go(page);
    const s = await page.evaluate(() => ({ st: __ts.state(), lang: __ts.ctx.state.settings.lang, sound: __ts.ctx.state.settings.sound }));
    check(R, s.st.coins === 0 && s.st.owned.length === 0 && s.st.tool === 'brush' && s.lang === 'en' && s.sound === false, 'v1 save (old district): starts fresh, settings kept (' + JSON.stringify({ coins: s.st.coins, tool: s.st.tool, lang: s.lang }) + ')');
    check(R, errors.length === 0, 'v1 save: no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await ctx.close(); }
} catch (e) { check(R, false, 'ABORTED: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
console.log('[save] ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
console.log(R.join('\n'));
console.log((R.length - (R.failed || 0)) + '/' + R.length + ' checks passed');
await browser.close(); server.close();
process.exit(R.failed ? 1 : 0);
