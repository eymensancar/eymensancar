// Headless balance bot. Plays the slice with the REAL economy rules and robot agents (createEconomyCore from
// www/js/economy.js) on a model trash grid built from config.js (same layout + trashGen as the spike), with a
// modelled human player. Prints the timeline of purchases / district % per player profile against the design's
// intended timeline (CONFIG.targets, docs/TASARIM.md stage table). Does not change config.js.
//
//   node test/economy/bot.mjs                 all profiles
//   node test/economy/bot.mjs average --log   one profile, with a per-purchase log
//   node test/economy/bot.mjs --json out.json also write the results
//
// Player model (the only invented part; robots, shop, selling, boost, milestones, final sweep are the game's code):
//   eff = 0.5 / 0.7 / 0.9 (slow / average / fast), the TASARIM "efficiency" (turns, overlap, looking around).
//   Active rate at eff 0.7: brush and broom cells/s = width*speed*2.4 (4 cells per m² swept × 0.6),
//   cart cells/s = nozzle*cleanSpeed*2.2; other profiles scale linearly with eff/0.7. Walking between places runs at
//   the walking speed (shoes level), not at the tool's sweep cap (v2: the cap applies only while sweeping).
//   It cleans nearest-first from where it works (the dirty edge drifts away as the cleared area grows), walks to the
//   sell point with the shortest PATH (BFS over the walkable grid, × walkFactor) plus tripS of overhead per trip
//   (turning round, finding the way), sells, buys at the shop, walks back.
//   Shopping and the mock ad pause the game (robots stop) but cost real time; targets are real minutes.
import fs from 'node:fs';
import { CONFIG } from '../../www/js/config.js';
import { createEconomyCore } from '../../www/js/economy.js';
import { makeCity, makeFakeWorld } from './fake-city.mjs';
import { makeModelTrash, makeBus } from './model-trash.mjs';

const PROFILES = {
  slow:    { eff: 0.5, walkF: 0.8, tripS: 4, shopS: 8, policy: 'next', boost: false },
  average: { eff: 0.7, walkF: 0.9, tripS: 2.5, shopS: 5, policy: 'next', boost: false },
  fast:    { eff: 0.9, walkF: 1.0, tripS: 1, shopS: 3, policy: 'next', boost: false },
  'average-designorder': { eff: 0.7, walkF: 0.9, tripS: 2.5, shopS: 5, policy: 'design', boost: false },
  'average-boost': { eff: 0.7, walkF: 0.9, tripS: 2.5, shopS: 5, policy: 'next', boost: true },
};
// v2 design order = the shop's price order (cheapest unlocked item first)
const DESIGN_ORDER = CONFIG.shop.items.slice().sort((a, b) => a.price - b.price).map((it) => it.id);
// v2 design intent (average player, minutes): docs/TASARIM.md §3a
const DESIGN_AVG = { bag_1: 1.8, broom: 6.57, robot_1: 13.53, cart: 26.9, complete: 38.23 };
const DESIGN_SENS = { slow: { broom: 8.97, robot_1: 17.83, cart: 34.45, complete: 49.07 }, fast: { broom: 4.93, robot_1: 10.48, cart: 22.33, complete: 31.38 } };

// --price id=value[,id=value…]: try shop prices without editing config.js (the bot works on a copy)
const priceArg = process.argv.indexOf('--price');
const CFG = priceArg > 0 ? structuredClone(CONFIG) : CONFIG;
if (priceArg > 0) for (const kv of process.argv[priceArg + 1].split(',')) { const [id, v] = kv.split('='); const it = CFG.shop.items.find((x) => x.id === id); if (!it) throw new Error('unknown item ' + id); it.price = +v; }
const city = makeCity(CONFIG);
const mmss = (m) => (m == null ? '  -  ' : `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`.replace(/:60$/, ':59'));

function play(name, P, log) {
  const bus = makeBus(), trash = makeModelTrash(CONFIG, city, bus), world = makeFakeWorld(CONFIG, city);
  const pose = { x: CONFIG.player.startPos[0], z: CONFIG.player.startPos[1], yaw: Math.PI, mounted: null };
  const core = createEconomyCore({ CONFIG: CFG, bus, trash, world, player: () => pose, camera: () => null });
  core.update(0);
  const out = { name, tripS: [], tripFootS: [], minute: [], purchases: [], milestones: {}, firstSale: null, complete: null, trips: 0, walkFullS: 0, cleanS: 0, walkFullAfterBag2S: 0, cleanAfterBag2S: 0, boostAt: null, coinsLeft: 0, robotUnits: 0, playerUnits: 0, t90: null, t985: null };
  let real = 0, game = 0;
  const N = city.N, CELL = city.CELL, DT = 0.1;
  bus.on('trash:milestone', (p) => { out.milestones[CONFIG.milestones[p.index].at] = real / 60; });
  bus.on('economy:sold', (p) => { if (p.by === 'player' && out.firstSale == null) out.firstSale = real / 60; });
  bus.on('economy:finalSweep', () => { out.t985 = real / 60; });
  const shop = core.sellPoints().find((p) => p.id === 'shop');
  let wx = pose.x, wz = pose.z; // work spot
  let acc = 0;
  const tick = (dt, paused) => { real += dt; if (!paused) { game += dt; core.update(dt); trash.update(); } else core.update(0); };
  const stand = (x, z) => { pose.x = x; pose.z = z; };
  const awayPose = () => stand(-100, -100); // while walking (abstracted) the player is not in the robots' way
  const pathM = (p, x, z) => { const c = Math.floor(z / CELL) * N + Math.floor(x / CELL); const f = p.field[c]; return (f === 65535 ? Math.hypot(p.x - x, p.z - z) / 0.75 : f * CELL) * 0.82; }; // 4-connected steps → walked metres
  const tool = () => (core.owned('cart') ? 'cart' : core.owned('broom') ? 'broom' : 'brush');
  const container = () => (tool() === 'cart' ? 'tank' : 'bag');
  const travelSpeed = () => (tool() === 'cart' ? CONFIG.cart.topSpeed : core.stat('walkSpeed')) * P.walkF;
  const afterBag2 = () => core.owned('bag_2');
  function walk(seconds, full) {
    awayPose(); let t = seconds;
    while (t > 0) { const d = Math.min(DT, t); tick(d, false); t -= d; if (full) { out.walkFullS += d; if (afterBag2()) out.walkFullAfterBag2S += d; } }
  }
  function wantNext() {
    if (P.policy === 'design') { for (const id of DESIGN_ORDER) if (!core.owned(id)) { const it = core.catalog().find((e) => e.id === id); return it && it.state === 'available' ? it : null; } return null; }
    return core.catalog().find((e) => e.next) || null;
  }
  function shopVisit() { // at the shop: buy while affordable (the panel pauses the game)
    let bought = 0;
    for (;;) { const it = wantNext(); if (!it || core.coins() < it.price) break; core.buy(it.id); bought++; out.purchases.push({ id: it.id, t: real / 60, pct: trash.cleanFraction() * 100, coins: core.coins() }); if (log) console.log(`  ${mmss(real / 60)} buy ${it.id.padEnd(14)} ${String(it.price).padStart(5)}  clean ${(trash.cleanFraction() * 100).toFixed(1)} %  robots ${core.robots().length}`); }
    if (bought) { let t = P.shopS; while (t > 0) { tick(Math.min(DT, t), true); t -= DT; } }
    if (P.boost && out.boostAt == null && real >= 8 * 60 && core.canOfferBoost()) { // the shop-panel button
      let t = CONFIG.boost.mockAdS; while (t > 0) { tick(Math.min(DT, t), true); t -= DT; }
      core.startBoost(); out.boostAt = real / 60;
    }
  }
  function sellTrip() {
    out.trips++;
    const pts = core.sellPoints().filter((p) => p.active);
    let best = pts[0], bd = Infinity; for (const p of pts) { const d = pathM(p, wx, wz); if (d < bd) { bd = d; best = p; } }
    out.tripS.push(bd / travelSpeed() + P.tripS); if (tool() !== 'cart') out.tripFootS.push(bd / travelSpeed() + P.tripS);
    walk(bd / travelSpeed() + P.tripS, true);
    pose.mounted = tool() === 'cart' ? 'cart' : null; stand(best.x, best.z);
    for (let k = 0; k < 8; k++) tick(DT, false); // dump anim (0.6 s) + coins
    pose.mounted = null;
    let back = bd;
    const it = wantNext();
    if (best.id !== 'shop' && it && core.coins() >= it.price) { // walk over to buy it
      const d = Math.hypot(best.x - shop.x, best.z - shop.z) / 0.75 * 0.82; walk(d / travelSpeed(), false);
      stand(shop.x, shop.z); tick(DT, false); back = pathM(shop, wx, wz);
    }
    if (Math.hypot(pose.x - shop.x, pose.z - shop.z) < 3) shopVisit();
    walk(back / travelSpeed(), false);
    stand(wx, wz);
  }
  const k = P.eff / 0.7;
  while (real < 90 * 60) {
    if (trash.totalUnits() === 0) { out.complete = real / 60; break; }
    const c = container();
    if (core.bagSpace(c) <= 0) { sellTrip(); continue; }
    // can already afford the next item and the shop is close: go buy it (players do)
    const it = wantNext();
    if (it && core.coins() >= it.price && pathM(shop, wx, wz) < 12) { const d = pathM(shop, wx, wz); walk(d / travelSpeed(), false); stand(shop.x, shop.z); tick(DT, false); shopVisit(); walk(d / travelSpeed(), false); stand(wx, wz); continue; }
    // clean for DT
    const t = tool();
    let rate, unitMode;
    if (t === 'brush') { rate = core.stat('brushWidth') * core.stat('brushSweepSpeed') * 2.4 * k; unitMode = false; }
    else if (t === 'broom') { rate = core.stat('broomWidth') * core.stat('broomSweepSpeed') * 2.4 * k; unitMode = false; }
    else { rate = core.stat('cartNozzleWidth') * core.stat('cartCleanSpeed') * 2.2 * k; unitMode = false; }
    acc += rate * DT;
    let extra = 0;
    while (acc >= 1 && core.bagSpace(c) > 0) {
      const idx = trash.nearestDirty(wx, wz); if (idx < 0) break;
      const x = (idx % N + 0.5) * CELL, z = (((idx / N) | 0) + 0.5) * CELL, d = Math.hypot(x - wx, z - wz);
      const reach = t === 'brush' ? 0.8 : t === 'broom' ? 1.2 : 2.0;
      if (d > reach) extra += (d - reach * 0.5) / ((t === 'cart' ? CONFIG.cart.topSpeed * 0.7 : core.stat('walkSpeed')) * P.walkF); // reposition over clean ground: not capped
      const r = trash.takeCell(idx, unitMode ? 1 : Math.min(4, core.bagSpace(c)), t);
      core.addToBag(r.units, r.byType, c); out.playerUnits += r.units;
      if (!unitMode || d > reach) { wx = x; wz = z; }
      acc -= 1;
    }
    stand(wx, wz);
    tick(DT + extra, false); // repositioning costs time too
    out.cleanS += DT + extra; if (afterBag2()) out.cleanAfterBag2S += DT + extra;
    const f = trash.cleanFraction(); if (out.t90 == null && f >= 0.9) out.t90 = real / 60;
    if (real / 60 >= out.minute.length + 1) { const ru = core._S.stats.robotUnits; out.minute.push({ t: real / 60, player: out.playerUnits - (out._pu || 0), robot: ru - (out._ru || 0) }); out._pu = out.playerUnits; out._ru = ru; }
  }
  { const ft = out.tripFootS.slice().sort((a, b) => a - b); out.tripFootMean = ft.reduce((a, b) => a + b, 0) / Math.max(1, ft.length); out.tripFootP90 = ft[Math.floor(ft.length * 0.9)] || 0; }
  // player vs robots per minute between robot_1 and the cart (psychology review: the player must stay the fastest cleaner)
  { const a = out.purchases.find((p) => p.id === 'robot_1'), b = out.purchases.find((p) => p.id === 'cart'); let pr = 0, ro = 0, n = 0;
    for (const m of out.minute) if (a && b && m.t > a.t && m.t <= b.t) { pr += m.player; ro += m.robot; n++; }
    out.robotShareBridge = pr + ro ? ro / (pr + ro) : 0; out.robotShareBridgeMax = Math.max(0, ...out.minute.filter((m) => a && b && m.t > a.t && m.t <= b.t).map((m) => (m.robot / Math.max(1, m.robot + m.player)))); }
  out.robotFirstClean = core.robots().map((r) => +r.firstCleanS.toFixed(1));
  out.coinsLeft = core.coins(); out.robotUnits = core._S.stats.robotUnits; out.gameMin = game / 60; out.real = real / 60;
  out.at = Object.fromEntries(out.purchases.map((p) => [p.id, p]));
  return out;
}

// ------------------------------------------------------------------------------------------- report
const args = process.argv.slice(2);
const only = args.filter((a) => PROFILES[a]);
if (priceArg > 0) console.log('price overrides: ' + process.argv[priceArg + 1]);
const logOne = args.includes('--log');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const names = only.length ? only : Object.keys(PROFILES);
const T = CONFIG.targets;
const results = {};
for (const n of names) { if (logOne) console.log(`\n== ${n}`); results[n] = play(n, PROFILES[n], logOne); }

const rows = [['firstSale', 'first sale', T.firstSale], ['first', 'first buy', T.firstBuy], ['bag_1', 'bag_1', T.bag1], ['brush_w1', 'brush_w1', T.brushW1], ['broom', 'broom', T.broom], ['bag_2', 'bag_2', T.bag2], ['shoes_1', 'shoes_1', T.shoes1], ['robot_1', 'robot_1', T.robot1], ['bag_3', 'bag_3', T.bag3], ['dropoff', 'dropoff', T.dropoff], ['robot_2', 'robot_2', T.robot2], ['cart', 'cart', T.cart], ['m0.5', '50 %', T.percent50], ['m0.75', '75 %', T.percent75], ['complete', '100 %', T.complete]];
const val = (r, key) => key === 'first' ? (r.purchases[0] && r.purchases[0].t) : key === 'firstSale' ? r.firstSale : key === 'complete' ? r.complete : key.startsWith('m') ? r.milestones[+key.slice(1)] : r.at[key] && r.at[key].t;
console.log('\nTimeline vs CONFIG.targets (average target; slow/fast complete targets in brackets). Times m:ss real time.');
console.log('event       target   ' + names.map((n) => n.padStart(20)).join(''));
for (const [key, label, tgt] of rows) {
  let tg = mmss(tgt);
  console.log(label.padEnd(11) + ' ' + tg.padStart(6) + '   ' + names.map((n) => { const v = val(results[n], key); const d = v != null && tgt != null && n.startsWith('average') ? ` (${v - tgt >= 0 ? '+' : ''}${((v - tgt) * 60).toFixed(0)}s)` : ''; return (mmss(v) + d).padStart(20); }).join(''));
}
console.log('complete targets: slow ' + mmss(T.completeSlowPlayer) + ', fast ' + mmss(T.completeFastPlayer) + ' | design sensitivity slow: broom ' + mmss(DESIGN_SENS.slow.broom) + ' robot_1 ' + mmss(DESIGN_SENS.slow.robot_1) + ' cart ' + mmss(DESIGN_SENS.slow.cart) + '; fast: broom ' + mmss(DESIGN_SENS.fast.broom) + ' robot_1 ' + mmss(DESIGN_SENS.fast.robot_1) + ' cart ' + mmss(DESIGN_SENS.fast.cart));

for (const n of names) {
  const r = results[n];
  const gaps = []; let prev = 0; for (const p of r.purchases) { gaps.push([p.t - prev, p.id]); prev = p.t; }
  const maxGap = gaps.reduce((a, b) => (b[0] > a[0] ? b : a), [0, '']);
  const walkShare = r.walkFullAfterBag2S / Math.max(1, r.walkFullAfterBag2S + r.cleanAfterBag2S);
  console.log(`\n${n}: purchases ` + r.purchases.map((p) => `${p.id}@${mmss(p.t)}(${p.pct.toFixed(0)}%)`).join(' '));
  console.log(`  complete ${mmss(r.complete)} | 90 %→98.5 % ${r.t90 && r.t985 ? ((r.t985 - r.t90) * 60).toFixed(0) + ' s' : '-'} | longest gap ${(maxGap[0]).toFixed(1)} min (before ${maxGap[1]}) | walking full after bag_2 ${(walkShare * 100).toFixed(0)} % | trips ${r.trips} | sell trip on foot mean ${r.tripFootMean.toFixed(1)} s, p90 ${r.tripFootP90.toFixed(1)} s | robots' share robot_1→cart ${(r.robotShareBridge * 100).toFixed(0)} % (worst minute ${(r.robotShareBridgeMax * 100).toFixed(0)} %) | units player ${r.playerUnits} robots ${r.robotUnits} | coins left ${r.coinsLeft} | robots' first clean after deploy (s) ${r.robotFirstClean.join(' ')}${r.boostAt ? ' | boost at ' + mmss(r.boostAt) : ''}`);
  if (n === 'average' || n === 'average-designorder') console.log('  vs TASARIM stage table: ' + Object.keys(DESIGN_AVG).map((id) => { const v = id === 'complete' ? r.complete : r.at[id] && r.at[id].t; return v == null ? `${id} -` : `${id} ${v - DESIGN_AVG[id] >= 0 ? '+' : ''}${((v - DESIGN_AVG[id]) * 60).toFixed(0)}s`; }).join(', '));
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 1));
