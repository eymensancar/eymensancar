// Node unit tests of the economy rules + robot simulation (createEconomyCore, no THREE, no browser).
// Run: node test/economy/unit.mjs
import assert from 'node:assert/strict';
import { CONFIG } from '../../www/js/config.js';
import { createEconomyCore } from '../../www/js/economy.js';
import { makeCity, makeFakeWorld } from './fake-city.mjs';
import { makeModelTrash, makeBus } from './model-trash.mjs';

const city = makeCity(CONFIG);
function setup(opts = {}) {
  const bus = makeBus(), trash = makeModelTrash(CONFIG, city, bus), world = makeFakeWorld(CONFIG, city);
  const pose = { x: 39, z: 17, yaw: 0, mounted: null }, cam = { x: 39, z: 17 };
  const events = [];
  bus.setTrace((n, p) => events.push({ n, p: p && typeof p === 'object' ? JSON.parse(JSON.stringify(p, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))) : p }));
  const offers = [];
  const core = createEconomyCore({ CONFIG, bus, trash, world, player: () => pose, camera: () => (opts.noCam ? null : cam), offer: (id) => offers.push(id) });
  core.update(0);
  const step = (s, dt = 1 / 30) => { const n = Math.round(s / dt); for (let i = 0; i < n; i++) { core.update(dt); trash.update(); } };
  const ev = (n) => events.filter((e) => e.n === n);
  return { bus, trash, world, pose, cam, core, step, events, ev, offers };
}
let passed = 0; const results = [];
async function test(name, fn) { try { await fn(); passed++; results.push('ok   ' + name); } catch (e) { results.push('FAIL ' + name + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n     ')); } }
const valueOf = (byObj) => Object.entries(byObj).reduce((s, [t, n]) => s + n * CONFIG.trashTypes.find((x) => x.id === t).value, 0);
const TYPES = CONFIG.trashTypes.map((t) => t.id);
const byArr = (o) => TYPES.map((t) => o[t] || 0);

await test('shop: catalog states, next, prerequisites, prices', () => {
  const { core, ev } = setup();
  let cat = core.catalog();
  assert.equal(cat.length, CONFIG.shop.items.length);
  for (let i = 1; i < cat.length; i++) assert.ok(cat[i].price >= cat[i - 1].price, 'sorted by price');
  assert.equal(cat.find((e) => e.next).id, 'bag_1');
  assert.equal(cat.find((e) => e.id === 'bag_2').state, 'locked');
  assert.equal(core.buy('bag_1'), false, 'no money');
  core.earn(40, 'test');
  assert.equal(core.catalog().find((e) => e.id === 'bag_1').affordable, true);
  assert.equal(core.buy('bag_2'), false, 'prerequisite missing');
  assert.equal(core.buy('bag_1'), true);
  assert.equal(core.coins(), 0);
  assert.equal(core.stat('bagCapacity'), 40);
  assert.equal(core.buy('bag_1'), false, 'twice');
  assert.equal(ev('economy:purchased').length, 1); assert.equal(ev('economy:purchased')[0].p.id, 'bag_1');
  assert.ok(ev('game:saveNow').length >= 1);
  // buy everything greedily with enough money: total price matches config
  core.earn(1e6, 'test'); let spent = 0, guard = 0;
  while (guard++ < 50) { const nx = core.catalog().find((e) => e.next); if (!nx) break; assert.ok(core.buy(nx.id)); spent += nx.price; }
  assert.equal(spent + 40, CONFIG.shop.totalPrice);
  assert.equal(core.stat('robotCount'), 4); assert.equal(core.robots().length, 4);
  assert.equal(core.stat('bagCapacity'), 180); assert.equal(core.stat('broomWidth'), 1.3); assert.equal(core.stat('broomSweepSpeed'), 2.4);
  assert.equal(core.stat('cartTank'), 1000); assert.equal(core.stat('cartNozzleWidth'), 2.2);
  assert.equal(core.stat('robotCleanSpeed'), 2.1); assert.equal(core.stat('robotMoveSpeed'), 4.0); assert.equal(core.stat('robotCapacity'), 100);
  assert.equal(ev('robot:added').length, 4);
});

await test('bag: capacity, byType, bagFull once, tank only with cart', () => {
  const { core, ev, step } = setup();
  const by = byArr({ paper: 10, can: 2 });
  assert.equal(core.addToBag(12, by), 12);
  assert.equal(core.bagSpace(), 3);
  assert.equal(core.addToBag(5, byArr({ glass: 5 })), 3, 'capped at space');
  step(0.1);
  assert.equal(core.bagUnits(), 15);
  assert.equal(ev('economy:bagFull').length, 1);
  step(0.5); assert.equal(ev('economy:bagFull').length, 1, 'once per transition');
  assert.equal(core.bagCapacity('tank'), 0); assert.equal(core.addToBag(5, by, 'tank'), 0);
  core.grant('cart'); assert.equal(core.bagCapacity('tank'), 600);
});

await test('selling: auto-dump in radius, coins arrive after dumpAnimS, exact value, drop-off locked', () => {
  const { core, ev, step, pose } = setup();
  core.addToBag(12, byArr({ paper: 6, plastic: 3, can: 2, valuable: 1 }));
  const expect = 6 * 1 + 3 * 2 + 2 * 3 + 50;
  pose.x = 3; pose.z = 51; step(1); // drop-off not bought
  assert.equal(ev('economy:sold').length, 0);
  pose.x = 39; pose.z = 13.5; step(1 / 30);
  const s = ev('economy:sold'); assert.equal(s.length, 1);
  assert.equal(s[0].p.coins, expect); assert.equal(s[0].p.units, 12); assert.equal(s[0].p.valuable, true); assert.equal(s[0].p.by, 'player');
  assert.equal(core.coins(), 0, 'coins not yet credited during the dump');
  assert.ok(core.bagUnits() > 0, 'bag drains visibly');
  step(CONFIG.selling.dumpAnimS + 0.05);
  assert.equal(core.coins(), expect); assert.equal(core.bagUnits(), 0);
  const c = ev('economy:coins').pop().p; assert.equal(c.delta, expect); assert.equal(c.reason, 'sale');
  // standing inside: a new small load sells again only after resellDelayS
  core.addToBag(1, byArr({ paper: 1 })); step(0.3); assert.equal(ev('economy:sold').length, 1);
  step(1.0); assert.equal(ev('economy:sold').length, 2);
  // drop-off works once bought; tank sells only when mounted, with cartR
  core.grant('dropoff'); core.grant('cart'); step(0.1);
  core.addToBag(10, byArr({ paper: 10 }), 'tank'); pose.x = 3 + 3.2; pose.z = 51; step(0.5);
  assert.equal(ev('economy:sold').length, 2, 'on foot at 3.2 m: outside 2.5 m');
  pose.mounted = 'cart'; step(0.1);
  assert.equal(ev('economy:sold').length, 3); assert.equal(ev('economy:sold')[2].p.pointId, 'dropoff'); assert.equal(ev('economy:sold')[2].p.container, 'tank');
});

await test('shop offer only within shop.openRadiusM', () => {
  const { pose, offers, step } = setup();
  pose.x = 39; pose.z = 15.9; step(1 / 30); assert.ok(offers.includes('shop'));
  offers.length = 0; pose.z = 16.2; step(1 / 30); assert.ok(!offers.includes('shop'));
});

await test('boost: 2x sales for 120 s, then 300 s cooldown; offer rules; ui:adWatched', () => {
  const { core, step, ev, bus, pose } = setup();
  pose.x = 20; pose.z = 3; // away from sell points
  assert.equal(core.canOfferBoost(), false, 'fewer than 3 purchases');
  assert.equal(core.canOfferBoost('milestone'), true);
  core.grant('bag_1'); core.grant('broom'); core.grant('bag_2');
  assert.equal(core.canOfferBoost(), true, '3 purchases, no income yet → next item is far away');
  bus.emit('ui:adWatched', { kind: 'boost' });
  assert.equal(core.boostActive(), true); assert.equal(core.stat('boostMultiplier'), 2);
  assert.equal(core.startBoost(), false, 'cannot stack');
  core.addToBag(10, byArr({ can: 10 })); pose.x = 39; pose.z = 13; step(1);
  assert.equal(core.coins(), 60, 'doubled sale');
  pose.x = 20; pose.z = 3;
  step(118.9); assert.equal(core.boostActive(), true);
  step(0.2); assert.equal(core.boostActive(), false);
  assert.ok(Math.abs(core.boostCooldownLeft() - 300) < 0.3, 'cooldown starts at the end');
  assert.equal(core.canOfferBoost(), false); assert.equal(core.canOfferBoost('milestone'), false); assert.equal(core.startBoost(), false);
  core.addToBag(10, byArr({ can: 10 })); pose.x = 39; pose.z = 13; step(1); assert.equal(core.coins(), 90, 'not doubled after');
  pose.x = 20; pose.z = 3; step(298.5); assert.ok(core.boostCooldownLeft() > 0); step(1); assert.equal(core.boostCooldownLeft(), 0);
  assert.equal(core.startBoost(), true);
  const b = ev('economy:boost'); assert.ok(b.length >= 120, 'ticks once per second while active (' + b.length + ')');
});

await test('boost offer: hidden when the next item is < 60 s of income away', () => {
  const { core, step, pose } = setup();
  core.grant('bag_1'); core.grant('broom'); core.grant('bag_2');
  for (let k = 0; k < 6; k++) { core.addToBag(40, byArr({ bag: 40 })); pose.x = 39; pose.z = 13; step(1); pose.x = 20; pose.z = 3; step(9); } // ~20 c/s
  const away = core.nextAwayS(); assert.ok(away < 60, 'next ' + core.nextItem().id + ' is ' + away.toFixed(1) + ' s away');
  assert.equal(core.canOfferBoost(), false);
});

await test('away: capped at 2 h of robot output and 50 % of remaining, honest coins, no boost, event only', () => {
  const { core, trash, ev, step, pose } = setup();
  core.grant('robot_2'); pose.x = 20; pose.z = 3; step(30);
  core.startBoost();
  const before = trash.totalUnits(), coins0 = core.coins();
  const r = core.catchUp(10 * 3600);
  assert.ok(r.capped, 'capped flag'); assert.equal(r.simS, 7200);
  assert.ok(r.units <= Math.floor(before * 0.5) + 2 * CONFIG.robot.capacity[0] + 1, 'at most half the remaining (+ what robots carried)');
  assert.ok(trash.totalUnits() >= before - Math.floor(before * 0.5));
  const a = ev('economy:away').pop().p; assert.equal(a.coins, core.coins() - coins0, 'coins already added, equal to the summary');
  assert.ok(!ev('ui:toast').length, 'no toast: ui shows one card from economy:away (integration decision)');
  // value honesty: coins == value of what disappeared (no boost)
  assert.ok(a.coins > 0 && a.coins < a.units * 3, 'coins plausible for the units: ' + a.coins + ' for ' + a.units);
  assert.ok(trash.cleanFraction() < CONFIG.completion.finalSweepAt, 'never finishes the district while away');
  // short absences do nothing; long but uncapped absence is not flagged
  assert.equal(core.catchUp(1), null);
  const r2 = core.catchUp(600); assert.equal(r2.capped, false); assert.ok(r2.units > 0);
  const expect = Math.min(Math.floor(core.robotRate() * 2 * 600), Math.floor(trash.totalUnits() * 2)); // generous bound
  assert.ok(r2.units <= expect + 1);
});

await test('away: no robots → nothing; game:ready / app:resume trigger catch-up', () => {
  const { core, bus, ev } = setup();
  bus.emit('game:ready', { fresh: false, awayS: 5000 }); assert.equal(ev('economy:away').length, 0);
  core.grant('robot_1'); bus.emit('app:resume', { awayS: 120 }); assert.equal(ev('economy:away').length, 1);
});

await test('save → JSON → load round trip; tolerant of junk; in-flight sale folded in', () => {
  const A = setup(); const { core, step, pose } = A;
  core.earn(5000, 'test'); for (const id of ['bag_1', 'broom', 'bag_2', 'robot_1', 'robot_2']) assert.ok(core.buy(id));
  core.addToBag(20, byArr({ paper: 10, glass: 10 })); core.startBoost(); pose.x = 20; pose.z = 3; step(20);
  pose.x = 39; pose.z = 13; step(1 / 30); // dump in progress
  const pending = A.ev('economy:sold').filter((e) => e.p.by === 'player').pop().p.coins;
  const data = JSON.parse(JSON.stringify(core.save()));
  assert.equal(data.v, 1);
  assert.equal(data.coins, core.coins() + pending + core.robots().filter((r) => r.state === 'unload').reduce((s, r) => s + r.saleCoins, 0));
  const B = setup(); B.core.load(data);
  const sa = core.debugState(), sb = B.core.debugState();
  assert.equal(sb.coins, data.coins); assert.deepEqual(sb.owned.sort(), sa.owned.sort()); assert.deepEqual(sb.fx, sa.fx);
  assert.equal(sb.robots.length, 2); assert.equal(sb.robots[0].x, +core.robots()[0].x.toFixed(2));
  assert.ok(Math.abs(sb.boost.left - sa.boost.left) < 0.01);
  assert.deepEqual(B.core.save().owned.sort(), data.owned.sort());
  assert.equal(B.ev('robot:added').length, 0, 'no robot:added toasts on load');
  // junk
  const C2 = setup();
  C2.core.load(null); assert.equal(C2.core.coins(), 0);
  C2.core.load({}); assert.equal(C2.core.coins(), 0);
  C2.core.load({ coins: 'lots', owned: ['nope', 'robot_2'], bag: { units: 999, byType: { paper: 'x' } }, robots: [{ x: -50, z: 'a' }], boost: { left: 1e9 } });
  assert.equal(C2.core.coins(), 0); assert.ok(C2.core.owned('robot_1') && C2.core.owned('broom'), 'prerequisites filled');
  assert.equal(C2.core.bagUnits(), 15, 'clamped to capacity'); assert.equal(C2.core.robots().length, 2);
  assert.ok(C2.core.robots()[0].x >= 0); assert.equal(C2.core.boostLeft(), CONFIG.boost.durationS);
  C2.core.load({ v: 2, coins: 7, futureField: { a: 1 } }); assert.equal(C2.core.coins(), 7);
});

await test('milestone bonus paid once; final sweep at 98.5 % pays the rest once', () => {
  const { core, trash, bus, step, ev, pose } = setup();
  pose.x = 20; pose.z = 3;
  bus.emit('trash:milestone', { index: 0, at: 0.25 }); bus.emit('trash:milestone', { index: 0, at: 0.25 });
  assert.equal(core.coins(), CONFIG.milestones[0].bonus);
  // clean to just below the threshold, then over it
  while (trash.cleanFraction() < 0.98) trash.consume(27, 27, 5, 1e9, 'debug');
  step(0.1); assert.equal(ev('economy:finalSweep').length, 0);
  while (trash.cleanFraction() < CONFIG.completion.finalSweepAt) trash.consume(27, 27, 5, 1e9, 'debug');
  const left = trash.totalUnits();
  step(0.1);
  const f = ev('economy:finalSweep'); assert.equal(f.length, 1); assert.equal(f[0].p.units, left);
  assert.equal(trash.totalUnits(), 0); assert.ok(f[0].p.coins > 0);
  step(1); assert.equal(ev('economy:finalSweep').length, 1);
});

// ---- robots
function trackRobots(S, seconds, dt = 1 / 30) {
  const n = Math.round(seconds / dt), rs = S.core.robots();
  const m = rs.map(() => ({ still: 0, maxStill: 0, path: 0, revs: 0, lastDir: null, solid: 0 }));
  const prev = rs.map((r) => ({ x: r.x, z: r.z }));
  for (let i = 0; i < n; i++) {
    S.core.update(dt); S.trash.update();
    rs.forEach((r, k) => {
      const q = m[k], dx = r.x - prev[k].x, dz = r.z - prev[k].z, d = Math.hypot(dx, dz);
      q.path += d;
      if (r.state !== 'idle' && r.state !== 'unload' && d < 1e-4) { q.still += dt; q.maxStill = Math.max(q.maxStill, q.still); } else q.still = 0;
      if (d > 1e-4) { const dir = [dx / d, dz / d]; if (q.lastDir && dir[0] * q.lastDir[0] + dir[1] * q.lastDir[1] < -0.9) q.revs++; q.lastDir = dir; }
      if (S.world.isBlocked(r.x, r.z, 0)) q.solid += dt;
      prev[k].x = r.x; prev[k].z = r.z;
    });
  }
  return m;
}

await test('robots: 4 robots × 10 min: rate ≈ design, never stuck, no jitter, never in buildings, spread out', () => {
  const S = setup(); S.pose.x = 20; S.pose.z = 3; // player out of the way
  for (const id of ['robot_1', 'robot_2', 'robot_3', 'robot_4']) S.core.grant(id);
  let spreadSum = 0, spreadN = 0;
  S.bus.on('robot:collect', () => { const rs = S.core.robots(); let mn = 1e9; for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) if (rs[a].state === 'clean' && rs[b].state === 'clean') mn = Math.min(mn, Math.hypot(rs[a].x - rs[b].x, rs[a].z - rs[b].z)); if (mn < 1e9) { spreadSum += mn; spreadN++; } });
  const m = trackRobots(S, 600);
  const units = S.core._S.stats.robotUnits, rate = units / 600 / 4;
  console.log('    robots 10 min: units', units, 'per robot u/s', rate.toFixed(2), 'clean %', (S.trash.cleanFraction() * 100).toFixed(1), 'coins', S.core.coins(),
    '\n    maxStill s', m.map((q) => q.maxStill.toFixed(1)).join(' '), ' reversals/min', m.map((q) => (q.revs / 10).toFixed(1)).join(' '), ' path m', m.map((q) => q.path.toFixed(0)).join(' '),
    '\n    mean nearest distance between cleaning robots', (spreadSum / Math.max(1, spreadN)).toFixed(1), 'm; first clean after spawn s', S.core.robots().map((r) => r.firstCleanS.toFixed(1)).join(' '));
  assert.ok(rate > 1.6 && rate < 3.5, 'rate per robot ' + rate);
  for (const q of m) { assert.ok(q.maxStill < 6, 'stalled ' + q.maxStill); assert.equal(q.solid, 0, 'inside a building'); }
  assert.ok(spreadSum / spreadN > 3, 'robots spread out');
});

await test('robots: far (coarse ticks) and near (per frame) give the same totals', () => {
  // The simulation is chaotic (one different choice changes the whole route; every trip moves a 60-unit chunk),
  // so compare far against the spread of several per-frame runs over 15 minutes, not one run against one run.
  const run = (near, dt) => {
    const S = setup(); S.pose.x = 20; S.pose.z = 3; S.core.grant('robot_2');
    if (!near) { S.cam.x = -500; S.cam.z = -500; }
    const rs = S.core.robots();
    for (let i = 0; i < 900 / dt; i++) { if (near) { S.cam.x = rs[0].x; S.cam.z = rs[0].z; } S.core.update(dt); S.trash.update(); }
    return S.core._S.stats.robotUnits;
  };
  const near = [1 / 60, 1 / 45, 1 / 30].map((dt) => run(true, dt)), far = run(false, 1 / 60);
  const mean = near.reduce((a, b) => a + b) / near.length, lo = Math.min(...near), hi = Math.max(...near);
  console.log('    15 min, 2 robots: per-frame runs', near.join(' '), '(mean ' + mean.toFixed(0) + ') | coarse far ticks', far, '(' + ((far - mean) / mean * 100).toFixed(1) + ' %)');
  assert.ok(Math.abs(far - mean) / mean < 0.06 || (far >= lo && far <= hi), 'far differs from per-frame mean by ' + ((far - mean) / mean * 100).toFixed(1) + ' %');
});

await test('robots: avoid the player standing in their way (wait, then go elsewhere), no deadlock', () => {
  const S = setup(); S.core.grant('robot_1');
  S.step(6);
  const r = S.core.robots()[0];
  // stand right in front of the robot for 20 s
  const m = { stillMax: 0 }; let still = 0, px = r.x, pz = r.z;
  for (let i = 0; i < 20 * 30; i++) {
    S.pose.x = r.x + Math.sin(r.yaw) * 0.8; S.pose.z = r.z - Math.cos(r.yaw) * 0.8;
    S.core.update(1 / 30); S.trash.update();
    const d = Math.hypot(r.x - px, r.z - pz); if (d < 1e-4 && r.state !== 'unload') { still += 1 / 30; m.stillMax = Math.max(m.stillMax, still); } else still = 0; px = r.x; pz = r.z;
  }
  console.log('    longest wait behind a player who keeps stepping in front:', m.stillMax.toFixed(1), 's');
  assert.ok(m.stillMax < 6);
});

await test('robots: first robot starts cleaning quickly from the dock', () => {
  const S = setup(); S.pose.x = 38; S.pose.z = 14; S.core.grant('robot_1');
  S.step(10);
  const r = S.core.robots()[0];
  assert.ok(r.firstCleanS >= 0 && r.firstCleanS < 3, 'first clean after ' + r.firstCleanS);
});

await test('robots: unload at the nearer active sell point; coins arrive at the end of unloadS', () => {
  const S = setup(); S.pose.x = 20; S.pose.z = 3; S.core.grant('robot_1'); S.core.grant('dropoff');
  const r = S.core.robots()[0]; r.x = 4; r.z = 40; r.px = 4; r.pz = 40; // west street, near the drop-off
  let guard = 0; while (S.ev('economy:sold').length === 0 && guard++ < 30 * 200) { S.core.update(1 / 30); S.trash.update(); }
  const sale = S.ev('economy:sold')[0].p; assert.equal(sale.by, 'robot'); assert.equal(sale.pointId, 'dropoff');
  const c0 = S.core.coins(); S.step(CONFIG.robot.unloadS - 0.2); assert.equal(S.core.coins(), c0);
  S.step(0.4); assert.equal(S.core.coins(), c0 + sale.coins);
  assert.ok(S.ev('robot:collect').length > 0);
  const ts = S.ev('robot:collect').length / (S.core._S.playS); assert.ok(ts <= 4.01, 'robot:collect ≤ 4/s per robot (' + ts.toFixed(2) + ')');
});

console.log(results.join('\n'));
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
