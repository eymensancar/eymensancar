// Performance + robustness checks on the real game (headless Chromium + SwiftShader: draw calls, triangles and JS
// cost are meaningful, fps is NOT). node test/e2e/perf.mjs [--json out.json]
//  1. busiest moment: cart sweeping with the nozzle down + 4 robots + milestone effects (confetti, birds, people)
//  2. per-frame allocations: V8 sampling heap profiler over 20 s of busy play, attributed to our modules
//  3. hidden tab pauses the game; 4. adaptive resolution steps down when frames are slow; quality low/high
//  5. WebGL context loss: restore path and the no-restore reload path; 6. 30 vs 60 Hz give the same gameplay
//  7. depth texture: ?depth=la and the default RGBA8 path render the same picture
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, openPage, ready, check } from './lib.mjs';

const R = [], OUT = {};
const server = await serve(path.join(ROOT, 'www'));
const browser = await launch();
const base = `http://127.0.0.1:${server.port}/index.html`;
const allErrors = [];
async function game(query = '', opts = {}) {
  const g = await openPage(browser, opts);
  await g.page.goto(base + '?debug&nosave' + query);
  await ready(g.page);
  g.errors.forEach((e) => allErrors.push(e));
  g.page.on('pageerror', (e) => allErrors.push('[pageerror] ' + e.message));
  return g;
}
const SETUP_BUSY = () => {
  const T = __ts, M = T.ctx.mods;
  T.give(200000);
  for (const id of ['bag_1', 'broom', 'bag_2', 'broom_w1', 'bag_3', 'dropoff', 'robot_1', 'broom_s1', 'robot_2', 'cart', 'robot_3', 'robot_4', 'cart_tank_1', 'cart_width_1']) M.economy.buy(id);
  T.setClean(0.24); T.fast(3, 1 / 30, false);
  // cart on the west street (dirty), nozzle down, heading south; robots spread from the dock
  const c = M.tools.cartState(); M.player.teleport(c.x + 1.2, c.z, -Math.PI / 2); M.tools.equip('cart');
  M.player.teleport(3, 6, Math.PI); T.look(180, -12); M.player.setStick(0, 1);
  T.fast(1.5, 1 / 30, false);
};

try {
  // ------------------------------------------------------------------------------- 1. busiest moment
  {
    const { page } = await game('&manual', { dpr: 2 });
    await page.evaluate(SETUP_BUSY);
    const r = await page.evaluate(() => {
      const T = __ts, c = T.ctx, M = c.mods, info = c.renderer.info.render;
      // cross 25 %: milestone confetti, birds, banner, while the cart is sweeping and 4 robots work
      const mid = M.trash.cleanFraction();
      T.setClean(0.255);
      let maxCalls = 0, maxTris = 0, frames = 0; const js = []; const mods = {};
      for (const k of Object.keys(c.perf.mods)) mods[k] = [];
      for (let f = 0; f < 90; f++) {
        const t0 = performance.now();
        c.step(1, 1 / 60);
        frames++;
        maxCalls = Math.max(maxCalls, info.calls); maxTris = Math.max(maxTris, info.triangles);
        js.push(c.perf.jsMs);
        for (const k of Object.keys(mods)) mods[k].push(c.perf.mods[k]);
      }
      const mean = (a) => a.slice(30).reduce((s, v) => s + v, 0) / (a.length - 30);
      const m = {}; for (const k of Object.keys(mods)) m[k] = +mean(mods[k]).toFixed(3);
      const st = T.state(), robots = M.economy.robots().map((r) => r.state);
      return { maxCalls, maxTris, jsMs: +mean(js).toFixed(3), mods: m, tank: st.tank, robots, clean0: mid, clean: st.clean, instances: T.counters().instances, textures: c.renderer.info.memory.textures, geometries: c.renderer.info.memory.geometries, dpr: c.view.dpr, milestones: T.events('trash:milestone').length };
    });
    OUT.busy = r;
    console.log('busiest moment:', JSON.stringify(r));
    check(R, r.robots.length === 4 && r.tank.units > 0 && r.milestones >= 1, 'busy scene: cart sweeping (tank ' + r.tank.units + '), 4 robots (' + r.robots.join(',') + '), 25 % milestone effects');
    check(R, r.maxCalls <= 40, 'draw calls ≤ 40 at the busiest moment (' + r.maxCalls + ')');
    check(R, r.maxTris <= 150000, 'triangles ≤ 150 k (' + r.maxTris + ')');
    check(R, r.jsMs <= 4, 'JS per frame ≤ 4 ms on this desktop CPU (' + r.jsMs + ' ms; device assumed ≤ 2×)');
    await page.screenshot({ path: path.join(ROOT, 'test/e2e/out-busy.png') }).catch(() => {});
    // ----------------------------------------------------------------------------- 2. allocations
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    await page.evaluate(() => { __ts.fast(2, 1 / 60, false); });
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512 });
    const heap0 = await cdp.send('Runtime.getHeapUsage');
    await page.evaluate(() => { const c = __ts.ctx; for (let f = 0; f < 1200; f++) { c.time.dt = 1 / 60; c.time.frame++; c.time.game += 1 / 60; c.offers.count = 0; for (const n of ['player', 'tools', 'economy', 'trash', 'world', 'audio', 'ui', 'debug']) c.mods[n].update(1 / 60); } });
    const heap1 = await cdp.send('Runtime.getHeapUsage');
    const prof = await cdp.send('HeapProfiler.stopSampling');
    // attribute sampled bytes to (file:function)
    const by = {};
    (function walk(n) {
      const f = n.callFrame, file = (f.url || '').split('/').pop() || '(native)';
      const self = n.selfSize || 0;
      if (self) { const k = file + ':' + (f.functionName || '(anon)') + ':' + (f.lineNumber + 1); by[k] = (by[k] || 0) + self; }
      for (const c of n.children || []) walk(c);
    })(prof.profile.head);
    const ours = Object.entries(by).filter(([k]) => /^(world|trash|player|tools|economy|audio|ui|debug|main)\.js/.test(k)).sort((a, b) => b[1] - a[1]);
    const total = ours.reduce((s, [, v]) => s + v, 0);
    OUT.alloc = { kbPer1200Frames: +(total / 1024).toFixed(1), heapGrowthKB: +((heap1.usedSize - heap0.usedSize) / 1024).toFixed(1), top: ours.slice(0, 12).map(([k, v]) => k + ' ' + (v / 1024).toFixed(1) + ' KB') };
    console.log('allocations (20 s at 60 Hz, gameplay updates):', JSON.stringify(OUT.alloc, null, 1));
    check(R, total / 1200 < 200, 'per-frame allocation in game modules < 200 B/frame (' + (total / 1200).toFixed(0) + ' B/frame sampled)');
    await page.close();
  }

  // ------------------------------------------------------------------------------- 3. hidden tab pauses
  {
    const { page } = await game('');
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const c = __ts.ctx, g0 = c.time.game;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 1200));
      const paused = c.state.paused, g1 = c.time.game;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 600));
      return { paused, frozen: Math.abs(g1 - c.time.game) > 0 && g1 - g0 < 0.3, resumed: !c.state.paused && c.time.game > g1, resumeEv: __ts.events('app:resume').length };
    });
    check(R, r.paused && r.resumed && r.resumeEv === 1, 'hidden tab pauses the game, visible again resumes (' + JSON.stringify(r) + ')');
    // ----------------------------------------------------------------------------- 4. adaptive resolution
    await page.close();
  }
  {
    const { page } = await game('', { dpr: 2 });
    const d0 = await page.evaluate(() => __ts.ctx.view.dpr);
    await page.waitForTimeout(9000); // SwiftShader frames are ≫ 19.5 ms: auto quality must step the render scale down
    const d1 = await page.evaluate(() => ({ dpr: __ts.ctx.view.dpr, ev: __ts.events('view:quality').map((e) => e.payload.dpr) }));
    check(R, d0 === 2 && d1.dpr < d0, 'adaptive resolution steps down on slow frames (' + d0 + ' → ' + JSON.stringify(d1) + ')');
    const q = await page.evaluate(() => {
      const c = __ts.ctx, st = c.state.settings;
      st.quality = 'high'; c.bus.emit('ui:settings', st); const hi = c.view.dpr;
      st.quality = 'low'; c.bus.emit('ui:settings', st); const lo = c.view.dpr;
      const fade = c.scene.getObjectByName ? null : null;
      st.quality = 'auto'; c.bus.emit('ui:settings', st);
      return { hi, lo, auto: c.view.dpr };
    });
    check(R, q.hi === 2 && q.lo === 1, 'quality setting: high pins DPR 2, low pins DPR 1 (' + JSON.stringify(q) + ')');
    await page.close();
  }

  // ------------------------------------------------------------------------------- 5. WebGL context loss
  {
    const { page, errors } = await game('');
    await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const c = __ts.ctx, gl = c.renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context');
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 300));
      const pausedLost = c.state.paused;
      ext.restoreContext();
      await new Promise((r) => setTimeout(r, 1500));
      __ts.clean(39, 22, 2);
      await new Promise((r) => setTimeout(r, 800));
      return { pausedLost, running: !c.state.paused, restored: __ts.events('gl:restored').length, lost: __ts.events('gl:lost').length };
    });
    await page.screenshot({ path: path.join(ROOT, 'test/e2e/out-gl-restored.png') });
    check(R, r.pausedLost && r.running && r.restored === 1, 'context lost → paused; restored → running again (' + JSON.stringify(r) + ')');
    check(R, errors.filter((e) => !/CONTEXT_LOST|context lost|WebGL: /i.test(e)).length === 0, 'no errors around the context restore' + (errors.length ? ' (' + errors.slice(0, 3).join(' | ') + ')' : ''));
    await page.close();
  }
  {
    // no restore: save + reload after render.glLostReloadS (save is ON here so the reload brings the state back)
    const g = await openPage(browser, {});
    await g.page.goto(base + '?debug&reset'); await ready(g.page);
    await g.page.goto(base + '?debug'); await ready(g.page);
    await g.page.evaluate(() => { __ts.give(777); __ts.ctx.save.now(); });
    const coins = await g.page.evaluate(() => __ts.state().coins);
    await g.page.evaluate(() => { const ext = __ts.ctx.renderer.getContext().getExtension('WEBGL_lose_context'); window.__stay = 1; ext.loseContext(); });
    await g.page.waitForFunction(() => !window.__stay && window.__ts && window.__ts.ready, null, { timeout: 15000 }).catch(() => {});
    const after = await g.page.evaluate(() => ({ reloaded: !window.__stay, coins: window.__ts ? __ts.state().coins : -1 }));
    check(R, after.reloaded && after.coins === coins, 'context lost for good → saved and reloaded, state kept (' + JSON.stringify(after) + ')');
    await g.page.close();
  }

  // ------------------------------------------------------------------------------- 6. 30 Hz vs 60 Hz
  {
    const { page } = await game('&manual');
    const run = (hz) => page.evaluate((hz) => {
      const T = __ts, M = T.ctx.mods; const out = {};
      M.player.teleport(39, 17, Math.PI); M.player.setStick(0, 1); T.fast(1.5, 1 / hz, false); M.player.setStick(0, 0); T.fast(0.5, 1 / hz, false);
      out.walk = +M.player.pose().z.toFixed(2);
      M.player.teleport(39, 30, Math.PI); T.hold(true); T.fast(4, 1 / hz, false); T.hold(false); T.fast(0.2, 1 / hz, false);
      out.picks = T.state().bag.units;
      return out;
    }, hz);
    const a = await run(60);
    await page.reload(); await ready(page);
    const b = await run(30);
    check(R, Math.abs(a.walk - b.walk) < 0.15 && a.picks === b.picks, 'gameplay is frame-rate independent: 60 Hz ' + JSON.stringify(a) + ' vs 30 Hz ' + JSON.stringify(b));
    await page.close();
  }

  // ------------------------------------------------------------------------------- 7. depth texture formats
  {
    const shots = [];
    for (const q of ['&depth=rgba', '&depth=la']) {
      const { page } = await game('&manual' + q);
      await page.evaluate(() => { __ts.clean(36, 20, 2.2); __ts.teleport(39, 17, Math.PI); __ts.look(180, -20); __ts.ctx.step(3, 1 / 60); });
      const fmt = await page.evaluate(() => __ts.ctx.mods.trash.info().depthFormat);
      await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 5000 }).catch(() => {}); // curtain gone
      shots.push({ fmt, png: await page.locator('#game').screenshot() });
      await page.close();
    }
    const diff = shots[0].png.length === shots[1].png.length && shots[0].png.equals(shots[1].png) ? 0 : Math.abs(shots[0].png.length - shots[1].png.length) / shots[0].png.length;
    fs.writeFileSync(path.join(ROOT, 'test/e2e/out-depth-la.png'), shots[1].png);
    check(R, shots[0].fmt === 'rgba' && shots[1].fmt === 'la' && diff < 0.02, 'RGBA8 (default) and LuminanceAlpha depth paths render the same picture (png size diff ' + (diff * 100).toFixed(2) + ' %)');
  }
} catch (e) { check(R, false, 'ABORTED: ' + (e && e.message ? e.message.split('\n')[0] : e)); }

const errs = allErrors.filter((e) => !/CONTEXT_LOST|context lost|WebGL: |GL_INVALID|GroupMarkerNotSet/i.test(e));
check(R, errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
console.log(R.join('\n'));
console.log((R.length - (R.failed || 0)) + '/' + R.length + ' checks passed');
const j = process.argv.indexOf('--json'); if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(OUT, null, 1));
await browser.close(); server.close();
process.exit(R.failed ? 1 : 0);
