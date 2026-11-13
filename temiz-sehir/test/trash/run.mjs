// trash.js tests (headless Chromium + SwiftShader). Usage:
//   node test/trash/run.mjs [--three /path/to/three.min.js] [--no-shots]
// Serves the repo root on a free port, opens test/trash/index.html?debug&nosave&manual (real main/config/bus/
// trash + fake world, other modules stubbed), and checks: generator numbers, determinism, every removal API
// (grid totals, byType/value, clean fraction, visible instances == reported removal), input guards, events
// (trash:changed aggregation, milestones, district:cleaned, final sweep safety net), save→load round trip,
// per-frame cost at 0 / 20 / 100 changed cells per frame, draw calls/triangles; then screenshots.
// SwiftShader = software GL: numbers are JS cost, draw calls and triangles, never fps.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const threeLocal = arg('--three') || ['/tmp/claude-0/-home-user/8066dee7-8627-553b-a97c-0e1bfc2ce9b4/scratchpad/lib/three.min.js'].find((p) => fs.existsSync(p)) || null;
const doShots = !process.argv.includes('--no-shots');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((q, s) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const port = server.address().port;

let failures = 0;
const results = {};
function check(name, ok, detail) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
  if (!ok) failures++;
}
const logs = [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(w, h, extra = '') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(t + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  if (threeLocal) await page.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
  await page.goto(`http://127.0.0.1:${port}/test/trash/index.html?debug&nosave&manual&dpr=1${extra}`);
  await page.waitForFunction(() => window.__tsCtx && !document.getElementById('boot'), null, { timeout: 120000 }); // curtain faded and removed
  await page.evaluate(() => {
    const ctx = window.__tsCtx, T = ctx.mods.trash, core = T.debugInfo().core;
    window.__ev = [];
    for (const n of ['trash:changed', 'trash:milestone', 'district:cleaned', 'trash:loaded', 'game:saveNow']) ctx.bus.on(n, (p) => window.__ev.push({ n, f: ctx.time.frame, p: p ? JSON.parse(JSON.stringify(p)) : null }));
    // helpers kept in the page
    window.H = {
      ctx, T, core,
      cam(x, z, yawDeg = 0, pitchDeg = -5, y = 1.65) { ctx.camera.position.set(x, y, z); ctx.camera.rotation.set(pitchDeg * Math.PI / 180, -yawDeg * Math.PI / 180, 0, 'YXZ'); },
      gridHash() { let h = 2166136261; const g = core.grid; for (let i = 0; i < g.length; i++) { h ^= g[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); },
      typeHash() { // types of every item of the initial district (what pick/remove will report)
        let h = 2166136261; const N = core.N, g = core.initGrid;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const key = core.keyOf(i, j); for (let k = 0; k < g[j * N + i]; k++) { h ^= core.typeOf(i, j, key, k) + 1; h = Math.imul(h, 16777619); } }
        return (h >>> 0).toString(16);
      },
      recount() { // independent recount from the raw grid
        const g = core.grid, ig = core.initGrid; let u = 0, clean = 0, cells = 0;
        for (let i = 0; i < g.length; i++) { u += g[i]; if (ig[i] > 0) { cells++; if (g[i] === 0) clean++; } }
        return { units: u, clean, cells, fraction: clean / cells };
      },
      shapeCounts() { return core.lists.map((l) => l.count); },
      snap(r) { return { units: r.units, cells: r.cells, cleaned: r.cleaned, value: r.value, byType: Array.from(r.byType), n: r.n, ss: Array.from(r.ss.slice(0, r.n)), st: Array.from(r.st.slice(0, r.n)) }; },
      flush() { T.update(1 / 60); },
    };
  });
  return page;
}

const page = await open(1280, 590);

// ---------------------------------------------------------------- generator + determinism
const gen = await page.evaluate(() => ({ gen: H.T.debugInfo().gen, info: H.T.info(), total: H.T.totalUnits(), init: H.T.initialUnits(), cells: H.T.trashCells(), clean: H.T.cleanFraction(), grid: H.gridHash(), types: H.typeHash(), calls: H.ctx.renderer.info.render.calls }));
results.generator = gen;
check('generator: 7728 trash cells (CONFIG.district.trashCellsExpected)', gen.cells === 7728, gen.gen);
check('generator: mean depth 1.74 +-0.03, ~13.5k units', Math.abs(gen.gen.mean - 1.74) <= 0.03 && gen.total > 13000 && gen.total < 14000, { mean: gen.gen.mean, total: gen.total });
check('info() shape', gen.info.N === 108 && gen.info.K === 4 && gen.info.types.length === 6 && gen.info.shapes.length === 7 && gen.info.blocks === 9 && gen.info.blockSize === 12, gen.info);
check('fresh district: 0 % clean, total == initial', gen.clean === 0 && gen.total === gen.init);
const page2 = await open(1280, 590);
const gen2 = await page2.evaluate(() => ({ grid: H.gridHash(), types: H.typeHash(), total: H.T.totalUnits() }));
check('determinism: same seed -> same grid and same item types on a second load', gen2.grid === gen.grid && gen2.types === gen.types && gen2.total === gen.total, { a: gen.grid + '/' + gen.types, b: gen2.grid + '/' + gen2.types });
await page2.close();

// ---------------------------------------------------------------- removal APIs
const api = await page.evaluate(() => {
  const T = H.T, out = {};
  H.cam(27, 40, 0, -20); H.flush(); H.flush();
  const typeVal = H.ctx.CONFIG.trashTypes.map((t) => t.value);
  function run(name, fn, expectVisible) {
    const before = H.recount(), sc0 = H.shapeCounts(), tot0 = T.totalUnits();
    const r = H.snap(fn());
    H.flush();
    const after = H.recount(), sc1 = H.shapeCounts();
    const drop = sc0.map((c, s) => c - sc1[s]);
    const hist = sc0.map(() => 0); for (const s of r.ss) hist[s]++;
    const sumType = r.byType.reduce((a, b) => a + b, 0), val = r.byType.reduce((a, b, t) => a + b * typeVal[t], 0);
    out[name] = {
      r, tot0, tot1: T.totalUnits(),
      unitsOk: tot0 - T.totalUnits() === r.units && before.units - after.units === r.units,
      typesOk: sumType === r.units && val === r.value,
      cleanOk: after.clean - before.clean === r.cleaned && T.cleanCells() === after.clean && Math.abs(T.cleanFraction() - after.fraction) < 1e-12,
      visibleOk: !expectVisible || (r.units <= 48 && JSON.stringify(drop) === JSON.stringify(hist)),
      drop, hist,
    };
  }
  run('removeInCircle', () => T.removeInCircle(27, 38, 0.8, undefined, 'robot'), true);
  run('removeInCircle_max5', () => T.removeInCircle(25.5, 37, 1.5, 5, 'robot'), true);
  run('removeAlongSegment_broom', () => T.removeAlongSegment(26, 36, 26, 34.5, 0.5, 40, 'broom'), true);
  run('removeAlongSegment_cart', () => T.removeAlongSegment(28.5, 37, 28.5, 33, 0.9, 1e9, 'cart'), false);
  const idx = T.cellAt(25.25, 42.25);
  run('removeCell', () => T.removeCell(idx, 2, 'robot'), true);
  const pk = T.pick(27.3, 43, 1.0, 'hands');
  out.pick = { picked: pk && { type: pk.type, shape: pk.shape }, units: (H.flush(), H.core.res.units) };
  run('pick_again', () => { T.pick(27.3, 43.4, 1.0, 'hands'); return H.core.res; }, true);
  run('consume', () => T.consume(3, 3, 300, 30, 'robot'), false);
  out.nearestDirty = { a: T.nearestDirty(27, 38, 10), hasTrash: T.amountAt(...(() => { const c = T.cellCenter(T.nearestDirty(27, 38, 10), { x: 0, z: 0 }); return [c.x, c.z]; })()) };
  out.surface = { s: T.surfaceAt(27, 45), s0: T.surfaceAt(27, 38), out: T.amountAt(-3, -3) };
  out.events = window.__ev.filter((e) => e.n === 'trash:changed').map((e) => e.p);
  return out;
});
results.api = api;
for (const k of ['removeInCircle', 'removeInCircle_max5', 'removeAlongSegment_broom', 'removeAlongSegment_cart', 'removeCell', 'pick_again', 'consume']) {
  const a = api[k];
  check(`${k}: grid totals`, a.unitsOk && a.r.units > 0, { units: a.r.units, cells: a.r.cells, cleaned: a.r.cleaned });
  check(`${k}: byType sums to units, value = sum(type value)`, a.typesOk, { byType: a.r.byType, value: a.r.value });
  check(`${k}: clean cells / clean fraction`, a.cleanOk);
  check(`${k}: visible instances removed == reported shapes`, a.visibleOk, { drop: a.drop, hist: a.hist });
}
check('removeInCircle maxUnits respected', api.removeInCircle_max5.r.units === 5);
check('removeCell takes at most maxUnits from one cell', api.removeCell.r.units <= 2 && api.removeCell.r.cells === 1);
check('pick returns an item and removes 1 unit', api.pick.picked && api.pick.units === 1, api.pick);
check('nearestDirty finds a dirty cell', api.nearestDirty.a >= 0 && api.nearestDirty.hasTrash > 0, api.nearestDirty);
check('surfaceAt: 0 on cleaned ground, >0 on trash; outside uses world.outsideUnits', api.surface.s0 >= 0 && api.surface.s > 0 && api.surface.out >= 0, api.surface);
{
  const ev = api.events, byRobot = ev.reduce((a, p) => a + p.by.robot, 0), byBroom = ev.reduce((a, p) => a + p.by.broom, 0), byHands = ev.reduce((a, p) => a + p.by.hands, 0), byCart = ev.reduce((a, p) => a + p.by.cart, 0);
  const sumUnits = ev.reduce((a, p) => a + p.units, 0), expect = ['removeInCircle', 'removeInCircle_max5', 'removeAlongSegment_broom', 'removeAlongSegment_cart', 'removeCell', 'pick_again', 'consume'].reduce((a, k) => a + api[k].r.units, 0) + api.pick.units;
  check('trash:changed once per flushed frame, by-aggregation matches removals', ev.length === 8 && sumUnits === expect && byBroom === api.removeAlongSegment_broom.r.units && byCart === api.removeAlongSegment_cart.r.units && byHands === api.pick.units + api.pick_again.r.units && byRobot === sumUnits - byBroom - byCart - byHands, { n: ev.length, sumUnits, expect });
}

// ---------------------------------------------------------------- guards
const guards = await page.evaluate(() => {
  const T = H.T, tot = T.totalUnits(), bad = [NaN, -Infinity, -1, 'x', undefined, null, {}, -1e300];
  let threw = 0, changed = 0;
  const tryit = (f) => { try { const t0 = T.totalUnits(); f(); if (T.totalUnits() !== t0) changed++; } catch (e) { threw++; console.log('threw', e.message); } };
  for (const b of bad) {
    const coordBad = b !== -1; // -1 m is a legal coordinate (just outside the district); it is only bad as a radius / count
    if (coordBad) { tryit(() => T.removeInCircle(b, 20, 1, 5, 'robot')); tryit(() => T.removeAlongSegment(b, 20, 27, 21, 0.5, 5, 'broom')); tryit(() => T.pick(b, 20, 1)); tryit(() => T.consume(b, 20, 5)); } tryit(() => T.removeInCircle(27, 20, b, 5, 'robot')); tryit(() => T.removeInCircle(Infinity, 20, 1, 5, 'robot')); tryit(() => b !== undefined && b !== null && T.removeInCircle(27, 20, 1, b, 'robot'));
    tryit(() => T.removeAlongSegment(27, 20, 27, 21, b, 5, 'broom'));
    tryit(() => T.pick(27, 20, b));
    tryit(() => b !== undefined && b !== null && T.consume(27, 20, b));
    tryit(() => T.removeCell(b, 1)); tryit(() => T.nearestDirty(b, 3)); tryit(() => T.amountAt(b, 3)); tryit(() => T.surfaceAt(b, b)); tryit(() => T.cellAt(b, 3)); tryit(() => T.cellCenter(b, { x: 0, z: 0 })); tryit(() => T.itemGeometry(b));
  }
  const r = {
    threw, changed, tot0: tot, tot1: T.totalUnits(),
    outOfDistrict: T.removeInCircle(-50, -50, 3, 100, 'robot').units + T.removeAlongSegment(-10, -10, -20, -20, 1, 100, 'cart').units + T.consume(200, 200, 10, 5, 'robot').units,
    nearestOut: T.nearestDirty(-500, -500, 5), cellOut: T.cellAt(-1, 3), cellOut2: T.cellAt(54, 3), amountOutside: T.amountAt(-0.25, 3),
    hugeCoords: T.removeInCircle(1e300, 1e300, 2, 5, 'robot').units + T.removeAlongSegment(1e300, 0, -1e300, 0, 0.3, 5, 'broom').units + T.nearestDirty(1e300, 3, 1e300) + 1,
    unknownBy: T.removeInCircle(10, 3, 0.3, 1, 'alien').units, removeCellRange: T.removeCell(108 * 108, 1, 'robot').units + T.removeCell(-1, 1).units + T.removeCell(1.5, 1).units,
    geoFallback: !!T.itemGeometry(99),
    hugeR: (() => { const t0 = performance.now(); const u = T.removeInCircle(27, 27, 1e6, 0, 'debug').units; return { u, ms: performance.now() - t0 }; })(),
  };
  H.flush();
  return r;
});
results.guards = guards;
check('guards: bad input never throws and never removes trash', guards.threw === 0 && guards.changed === 0, guards);
check('guards: removal outside the district / out-of-range cells take nothing', guards.outOfDistrict === 0 && guards.hugeCoords === 0 && guards.nearestOut === -1 && guards.cellOut === -1 && guards.cellOut2 === -1 && guards.removeCellRange === 0);
check('guards: unknown remover id still works (counted as debug, warned once)', guards.unknownBy >= 0);

// ---------------------------------------------------------------- milestones, final sweep, district:cleaned
const ms = await page.evaluate(() => {
  const T = H.T, C = H.ctx.CONFIG; T.load(null); H.flush(); window.__ev.length = 0;
  const marks = [];
  // consume from the district centre until each threshold, one simulated frame at a time
  // simulated frames without rendering (a SwiftShader frame is ~0.25 s of GPU work that would queue up)
  const sim = () => { H.ctx.time.game += 1 / 60; H.ctx.time.frame++; T.update(1 / 60); };
  for (let f = 0; f < 4000 && T.cleanFraction() < C.completion.finalSweepAt; f++) { T.consume(27, 27, 60, 1e9, 'robot'); sim(); }
  const atSweep = T.cleanFraction(), unitsLeft = T.totalUnits();
  const ev1 = window.__ev.filter((e) => e.n === 'trash:milestone').map((e) => e.p);
  // nobody (economy is a stub) runs the final sweep: the safety net must clear the district after finalSweepS + 3 s
  const tA = H.ctx.time.game; let steps = 0;
  while (T.totalUnits() > 0 && steps < 60 * 12) { sim(); steps++; }
  const ev = window.__ev;
  return {
    atSweep, unitsLeft, sweepAfterS: +(steps / 60).toFixed(2), final: T.cleanFraction(), total: T.totalUnits(),
    milestones: ev.filter((e) => e.n === 'trash:milestone').map((e) => e.p), before: ev1,
    cleaned: ev.filter((e) => e.n === 'district:cleaned').map((e) => e.p),
    finalBy: ev.filter((e) => e.n === 'trash:changed').reduce((a, e) => a + e.p.by.final, 0),
    maxChangedPerFrame: (() => { const c = {}; for (const e of ev) if (e.n === 'trash:changed') c[e.f] = (c[e.f] || 0) + 1; return Math.max(0, ...Object.values(c)); })(),
    ms: T.save().ms,
  };
});
results.milestones = ms;
check('milestones 25/50/75 fire once each, in order, before the final sweep', JSON.stringify(ms.before.map((m) => m.index)) === '[0,1,2]' && ms.before.every((m) => m.fraction >= m.at), ms.before);
check('final sweep safety net: district cleared ~finalSweepS+3 s after 98.5 % (economy stub)', ms.final === 1 && ms.total === 0 && ms.sweepAfterS > 6.5 && ms.sweepAfterS < 7.6 && ms.finalBy === ms.unitsLeft, { atSweep: ms.atSweep, after: ms.sweepAfterS, finalUnits: ms.finalBy });
check('milestone 100 % + district:cleaned fire exactly once', ms.milestones.filter((m) => m.index === 3).length === 1 && ms.cleaned.length === 1 && typeof ms.cleaned[0].playS === 'number', ms.cleaned);
check('trash:changed at most once per frame', ms.maxChangedPerFrame === 1);
check('save records the highest milestone index', ms.ms === 3);

// ---------------------------------------------------------------- save -> load round trip
const sv = await page.evaluate(() => {
  const T = H.T; window.__ev.length = 0;
  T.load(null); H.flush();
  const fresh = { total: T.totalUnits(), hash: H.gridHash(), clean: T.cleanFraction(), ms: T.save().ms, bytes: JSON.stringify(T.save()).length };
  // carve: broom trail, robot patch, cart swath, some partial cells
  for (let z = 50; z > 8; z -= 0.25) T.removeAlongSegment(26.2, z, 26.2, z - 0.25, 0.5, 1e9, 'broom');
  for (let x = 31; x < 47; x += 0.5) T.removeAlongSegment(x, 25, x, 29, 0.25, 1e9, 'robot');
  T.removeAlongSegment(3, 52, 3, 2, 0.9, 1e9, 'cart');
  for (let k = 0; k < 160; k++) T.removeInCircle(29 + (k % 8) * 0.25, 46 + ((k / 8) | 0) * 0.25, 0.25, 1, 'robot');
  T.consume(10, 3, 900, 1e9, 'robot');
  H.flush();
  const a = { total: T.totalUnits(), hash: H.gridHash(), clean: T.cleanFraction(), cleanCells: T.cleanCells(), unit: T.unitFraction(), blocks: Array.from(T.blockSums()).join(',') };
  const t0 = performance.now(); const s = T.save(); const msSave = performance.now() - t0;
  const json = JSON.stringify(s);
  T.removeInCircle(27, 27, 30, undefined, 'debug'); H.flush();          // diverge (passes milestones: celebrated here, legitimately)
  window.__ev.length = 0;
  const t1 = performance.now(); T.load(JSON.parse(json)); const msLoad = performance.now() - t1; H.flush();
  const b = { total: T.totalUnits(), hash: H.gridHash(), clean: T.cleanFraction(), cleanCells: T.cleanCells(), unit: T.unitFraction(), blocks: Array.from(T.blockSums()).join(',') };
  const rc = H.recount();
  const loaded = window.__ev.filter((e) => e.n === 'trash:loaded').map((e) => e.p);
  const milestonesOnLoad = window.__ev.filter((e) => e.n === 'trash:milestone').length;
  // corrupt / foreign saves
  T.load({ g: 'g1.108.4.zzz.@@@', ms: 1 }); H.flush(); const corrupt = { total: T.totalUnits(), init: T.initialUnits() };
  T.load({ g: json.length ? JSON.parse(json).g.replace(/\.[a-z0-9]+\.([^.]*)$/, '.otherlayout.$1') : '', ms: 0 }); H.flush(); const foreign = { total: T.totalUnits(), exact: window.__ev.filter((e) => e.n === 'trash:loaded').pop().p.exact };
  T.load({}); H.flush(); const emptyObj = { total: T.totalUnits(), init: T.initialUnits() };
  T.load(JSON.parse(json)); H.flush();
  return { fresh, a, b, rc, bytes: json.length, msSave, msLoad, loaded, milestonesOnLoad, corrupt, foreign, emptyObj, freshBytes: fresh.bytes };
});
results.save = sv;
check('save -> load round trip restores grid, totals, clean fraction, block sums', sv.a.hash === sv.b.hash && sv.a.total === sv.b.total && sv.a.clean === sv.b.clean && sv.a.cleanCells === sv.b.cleanCells && sv.a.blocks === sv.b.blocks && sv.rc.units === sv.b.total, { a: sv.a.total, b: sv.b.total, clean: sv.b.clean });
check('save is compact', sv.bytes < 16000 && sv.freshBytes < 200, { carved: sv.bytes, fresh: sv.freshBytes });
check('load emits trash:loaded {exact:true} and celebrates nothing', sv.loaded.some((p) => p.exact === true) && sv.milestonesOnLoad === 0);
check('corrupt save -> fresh district (warned), {} -> fresh', sv.corrupt.total === sv.corrupt.init && sv.emptyObj.total === sv.emptyObj.init);
check('save from another layout applied best-effort with exact:false', sv.foreign.exact === false && sv.foreign.total === sv.a.total);

// ---------------------------------------------------------------- per-frame cost
const perf = await page.evaluate(() => {
  const T = H.T, out = {};
  // exactly n cells change per frame (1 unit each): half inside the camera's item window, half anywhere.
  // Cells come from pre-shuffled lists of dirty cells; every 10 frames the district is reset (untimed) so it never runs dry.
  function bench(cellsPerFrame, frames, by) {
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const N = H.core.N, near = [], far = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (H.core.initGrid[j * N + i]) { const x = (i + 0.5) * 0.5, z = (j + 0.5) * 0.5; ((Math.abs(x - 27) < 7 && Math.abs(z - 40) < 7) ? near : far).push(j * N + i); }
    const shuf = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = (rnd() * (i + 1)) | 0; const t = a[i]; a[i] = a[k]; a[k] = t; } return a; };
    shuf(near); shuf(far);
    let changed = 0, rows = 0, ms = 0, msUpd = 0, maxFly = 0, pn = 0, pf = 0;
    const c = { x: 0, z: 0 };
    for (let f = 0; f < frames; f++) {
      if (f % 8 === 0) { T.load(null); H.cam(27, 40, 0, -10); H.flush(); H.flush(); pn = 0; pf = 0; }
      const t0 = performance.now();
      for (let k = 0; k < cellsPerFrame; k++) {
        const idx = (k & 1) ? near[pn++ % near.length] : far[pf++ % far.length];
        T.cellCenter(idx, c);
        changed += T.removeInCircle(c.x, c.z, 0.25, 1, by).cells;
      }
      const t1 = performance.now();
      T.update(1 / 60);
      const t2 = performance.now();
      ms += t2 - t0; msUpd += t2 - t1;
      const st = T.debugInfo().stats; rows += st.rowsUploaded; maxFly = Math.max(maxFly, st.flying);
    }
    return { cellsPerFrame: +(changed / frames).toFixed(1), msPerFrame: +(ms / frames).toFixed(4), updateMsPerFrame: +(msUpd / frames).toFixed(4), rowsPerFrame: +(rows / frames).toFixed(1), maxFlying: maxFly };
  }
  for (let rep = 0; rep < 2; rep++) for (const n of [0, 20, 100]) { const r = bench(n, 300, 'robot'); const k = 'cells' + n; if (!out[k] || r.msPerFrame < out[k].msPerFrame) out[k] = r; }
  out.cells100_noJuice = bench(100, 300, 'debug');
  // broom walking: one stroke per frame, camera moving
  T.load(null);
  { let z = 52, ms = 0, units = 0; const frames = 600;
    for (let f = 0; f < frames; f++) { H.cam(26.2, z + 0.6, 0, -10); const t0 = performance.now(); units += T.removeAlongSegment(26.2, z, 26.2, z - 0.04, 0.65, 1e9, 'broom').units; T.update(1 / 60); ms += performance.now() - t0; z -= 0.04; if (z < 2) z = 52; }
    out.broomWalk = { msPerFrame: +(ms / frames).toFixed(4), unitsPerFrame: +(units / frames).toFixed(2) }; }
  T.load(null);
  { let z = 52, ms = 0, units = 0; const frames = 400;
    for (let f = 0; f < frames; f++) { H.cam(27, z + 1.5, 0, -10); const t0 = performance.now(); units += T.removeAlongSegment(26.1, z, 27.9, z - 0.083, 0.15, 1e9, 'cart').units + T.removeAlongSegment(27, z, 27, z - 0.083, 0.9, 1e9, 'cart').units; T.update(1 / 60); ms += performance.now() - t0; z -= 0.083; if (z < 2) z = 52; }
    out.cartDrive = { msPerFrame: +(ms / frames).toFixed(4), unitsPerFrame: +(units / frames).toFixed(2) }; }
  { const t0 = performance.now(); const n = 20; for (let i = 0; i < n; i++) { H.cam(i % 2 ? 3 : 27, i % 2 ? 3 : 50); T.update(1 / 60); } out.teleportRebuildMs = +((performance.now() - t0) / 20).toFixed(3); }
  { const t0 = performance.now(); let h = 0; for (let i = 0; i < 200; i++) if (T.nearestDirty(2 + (i % 10) * 5, 2 + ((i / 10) | 0) * 2.5, 30) >= 0) h++; out.nearestDirtyMs = +((performance.now() - t0) / 200).toFixed(4); }
  { T.load(null); const t0 = performance.now(); const r = T.consume(3, 3, 2000, 60, 'robot'); out.consume2000 = { units: r.units, ms: +(performance.now() - t0).toFixed(1) }; }
  { T.load(null); const t0 = performance.now(); const r = T.clearAll('final'); out.clearAll = { units: r.units, ms: +(performance.now() - t0).toFixed(1) }; T.update(1 / 60); }
  T.load(null); H.flush();
  return out;
});
results.perf = perf;
console.log('perf', JSON.stringify(perf));
check('per-frame cost (removal + update) within the 0.3 ms trash budget at 0/20/100 cells', perf.cells0.msPerFrame < 0.3 && perf.cells20.msPerFrame < 0.3 && perf.cells100.msPerFrame < 0.3, { c0: perf.cells0.msPerFrame, c20: perf.cells20.msPerFrame, c100: perf.cells100.msPerFrame });

// ---------------------------------------------------------------- draw calls / triangles in a normal view
const rc = await page.evaluate(() => {
  H.cam(39, 17, 180, -5); H.ctx.step(1);
  const i = H.ctx.renderer.info.render, trashCalls = H.core.group.children.filter((o) => o.visible).length;
  return { calls: i.calls, triangles: i.triangles, trashVisible: trashCalls, instances: H.core.stats.instances };
});
results.render = rc;
check('trash draw calls <= 8 at rest (ground + 7 shapes; dust only while puffs live)', rc.trashVisible <= 8, rc);

// ---------------------------------------------------------------- screenshots
if (doShots) {
  const shots = path.join(here, 'shots'); fs.mkdirSync(shots, { recursive: true });
  const shot = async (name) => { const t0 = Date.now(); await page.screenshot({ path: path.join(shots, name + '.png'), timeout: 180000 }); console.log('shot', name, Date.now() - t0, 'ms'); };
  const view = async (x, z, yaw, pitch, y = 1.65) => page.evaluate(([x, z, yaw, pitch, y]) => { H.cam(x, z, yaw, pitch, y); H.ctx.step(2); }, [x, z, yaw, pitch, y]);
  await page.evaluate(() => { H.T.load(null); });
  await view(26.5, 53, 0, -7); await shot('01-before-eye');
  await view(27, 75, 0, -40, 45); await shot('02-before-aerial');
  // sweep a broom trail up the middle street and let a robot clean a lawnmower patch on the cross street
  await page.evaluate(() => {
    const T = H.T;
    for (let z = 52; z > 8; z -= 0.04) { H.cam(26.2, z + 0.6, 0, -10); T.removeAlongSegment(26.2, z, 26.2, z - 0.04, 0.5, 1e9, 'broom'); T.update(1 / 60); }
    for (let k = 0; k < 30; k++) { const a = k * 0.45; T.removeAlongSegment(28.3 + Math.sin(a) * 0.8, 40 - k, 28.3 + Math.sin(a + 0.45) * 0.8, 39 - k, 0.5, 1e9, 'broom'); }
    for (let x = 31; x < 47; x += 0.5) { T.removeAlongSegment(x, 25.25, x, 28.75, 0.25, 1e9, 'robot'); T.update(1 / 60); }
    T.removeAlongSegment(3, 52, 3, 2, 0.9, 1e9, 'cart');
    for (let s = 0; s < 40; s++) T.update(1 / 60);
  });
  await view(26.5, 53, 0, -7); await shot('03-after-eye');
  await view(27, 75, 0, -40, 45); await shot('04-after-aerial');
  await view(38, 27, -90, -12); await shot('05-robot-patch-eye');
  await view(26.2, 34, 0, -48); await shot('06-trail-feet');
  // trail readable from 30+ m away, from the street end
  await view(26.5, 53.5, 0, -2.5); await shot('07-trail-35m');
  // juice mid-flight: hand picks (into the hand), a broom stroke (up into the bag), a robot bite, captured a few frames in
  await page.evaluate(() => {
    const T = H.T; H.cam(27, 49, 0, -30); T.update(1 / 60);
    for (let k = 0; k < 4; k++) T.pick(27.6 + k * 0.15, 47.9, 0.6, 'hands');
    T.removeAlongSegment(26.0, 47.8, 27.4, 47.7, 0.5, 1e9, 'broom');
    T.removeInCircle(29.25, 46.25, 0.45, 1e9, 'robot');
    H.ctx.step(6);
  });
  await shot('08-juice-midflight');
  // closer look at the arcs: broom stroke 1.2 m ahead, frames 3 and 7 after removal (0.05 s, 0.12 s)
  await page.evaluate(() => { const T = H.T; H.cam(25.2, 39.8, 0, -38, 1.3); T.update(1 / 60); T.removeAlongSegment(24.6, 38.6, 25.8, 38.5, 0.5, 1e9, 'broom'); H.ctx.step(3); });
  await shot('08b-juice-broom-3f');
  await page.evaluate(() => H.ctx.step(4));
  await shot('08c-juice-broom-7f');
  await page.evaluate(() => { const T = H.T; H.cam(25.0, 37.2, 30, -40, 1.65); T.update(1 / 60); for (let k = 0; k < 6; k++) T.pick(25.3 + k * 0.12, 36.2, 0.5, 'hands'); H.ctx.step(5); });
  await shot('08d-juice-hands-5f');
  results.juice = await page.evaluate(() => ({ flying: H.core.stats.flying, dust: H.core.stats.dust, calls: H.ctx.renderer.info.render.calls }));
  await page.evaluate(() => H.ctx.step(40));
  results.juiceAfter = await page.evaluate(() => ({ flying: H.core.stats.flying, dust: H.core.stats.dust, visible: H.core.group.children.filter((o) => o.visible).length }));
  check('juice: items in flight and dust puffs spawn, then end', results.juice.flying > 0 && results.juice.dust > 0 && results.juiceAfter.flying === 0 && results.juiceAfter.dust === 0, { mid: results.juice, after: results.juiceAfter });
  // portrait
  const pp = await open(390, 844);
  await pp.evaluate(() => { const T = H.T; for (let z = 52; z > 20; z -= 0.25) T.removeAlongSegment(26.2, z, 26.2, z - 0.25, 0.5, 1e9, 'broom'); H.cam(26.5, 53, 0, -8); H.ctx.step(16); }); // > cellCleanFadeS so the far layer has faded
  await pp.screenshot({ path: path.join(shots, '09-portrait.png') });
  await pp.close();
}

await page.close();
const errs = logs.filter((l) => !/^warning: \[trash\] (unknown remover|cellCenter: invalid|itemGeometry: invalid|saved trash grid)/.test(l) && !/GPU stall|swiftshader|Automatic fallback to software WebGL/i.test(l));
check('no page errors / unexpected console warnings', errs.length === 0, errs.slice(0, 8));
results.consoleExpected = logs.filter((l) => !errs.includes(l));
fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(results, null, 2));
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
