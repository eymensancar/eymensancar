// economy.js — bag/tank, coins, selling, shop/upgrades, boost, robots (simulation + meshes), final sweep,
// away catch-up. Owner: economy. Contract: docs/MIMARI.md §4.6 (API), §6 (events), §7 (frame order), §8 (save).
//
// Layout of this file
//   ECONOMY_DEFAULTS        tunables that config.js does not (yet) contain; CONFIG.robot / CONFIG.offline /
//                           CONFIG.selling override them field by field (see docs/notlar/economy.md).
//   createEconomyCore(o)    ALL rules and the robot simulation. Pure JS: no THREE, no DOM, no ctx. The Node
//                           balance bot (test/economy/bot.mjs) and the unit tests drive exactly this code with a
//                           model trash grid. It talks to the outside only through the functions passed in `o`.
//   init / update / ...     the module: wires the core to ctx (bus, trash, world, player, camera, offers) and
//                           draws the robots (3 draw calls: bodies, LEDs, ground decals = blob shadow + dust trail).
//
// Robots are real agents. Each picks a dirty area near itself and near its anchor (where it was deployed), cleans it
// in back-and-forth rows one cell wide, spreads away from the other robots, drives around buildings on a grid path,
// unloads at the nearer active sell point when full, then returns to where it stopped. Robots further than
// robot.farM from the camera run the SAME logic in coarse ticks (4 per second, sub-stepped by distance), so totals
// are identical and the hand-over to the per-frame mode is seamless; only the rendered pose is smoothed.

export const ECONOMY_DEFAULTS = {
  robot: {
    turnRateDeg: 300,          // in-place turning speed; the robot slows to a stop while badly misaligned
    farM: 30, farHysteresisM: 4, farTickS: 0.25, maxSubstepM: 0.2,
    anchorWeight: 0.5,         // target score = distance to robot + anchorWeight * distance to anchor (+ claims)
    claimPenaltyM: 10,         // a 6 m block another robot works in costs this much extra (spread out)
    localSearchCells: 2,       // after a row ends, look this many cells around before jumping to a new block
    waitMaxS: 2.0,             // waiting behind the player / another robot longer than this → go elsewhere
    stuckS: 4, banS: 20,       // no progress for stuckS → re-plan; the block is avoided for banS
    idleRetryS: 1.0,
    collectEventS: 0.25,       // robot:collect is aggregated to at most 4 per second per robot
    puffEveryS: 0.12, puffLifeS: 0.7, puffs: 6,
    rateWindowS: 10, rateTauS: 120,   // measured robot rate (units per robot-second, trips included): EMA
    ratePriorUps: 2.4,         // TASARIM: ~2.4 u/s per robot with its trips, at cleanSpeed[0]
    swathEps: 0.01,
    names: null,               // CONFIG.robot.names / STR robot_n1.. win; fallback FALLBACK_STR
    colors: ['#ff7a59', '#2fb5a3', '#f2b632', '#8a6cf0'],
    bodyRadiusM: 0.33, bodyHeightM: 0.2,
  },
  offline: {
    capS: 7200,                // PSIKOLOJI §6: robots keep working while away, capped at 2 hours of output ...
    maxFractionOfRemaining: 0.5, // ... and at 50 % of the remaining trash
    minSimS: 2,                // shorter absences are ignored (main's own away threshold)
    announceMinS: 60,          // the "while you were away" toast only for absences this long
  },
  selling: { resellDelayS: 1.0 }, // standing inside a sell zone: next sale at most this often (re-entering is instant)
  income: { windowS: 10, tauS: 60 },
};

// Player-facing texts that config.js does not have yet. ctx.STR wins when it defines the same key.
const FALLBACK_STR = {
  robot_name: { tr: 'Robot {n}: {name}', en: 'Robot {n}: {name}' },
  robot_n1: { tr: 'Pırıl', en: 'Pırıl' },
  robot_n2: { tr: 'Fıstık', en: 'Fıstık' },
  robot_n3: { tr: 'Bulut', en: 'Bulut' },
  robot_n4: { tr: 'Şimşek', en: 'Şimşek' },
  away_summary: { tr: 'Sen yokken robotların {n} parça topladı: +{m} altın', en: 'While you were away your robots collected {n} items: +{m} coins' },
  away_capped: { tr: '({h} saatlik sınır)', en: '({h}-hour limit)' },
};

function mergeFlat(a, b) { const o = Object.assign({}, a); if (b && typeof b === 'object') for (const k of Object.keys(b)) if (b[k] !== undefined && b[k] !== null) o[k] = b[k]; return o; }
const arrAt = (a, i) => (Array.isArray(a) && a.length ? a[Math.max(0, Math.min(a.length - 1, i | 0))] : 0);
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const TAU = Math.PI * 2;
function wrapAng(a) { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; }

// =====================================================================================================
// Core: rules + simulation (pure)
// o = { CONFIG, bus, trash, world,
//       player() → pose {x, z, yaw, mounted} | null, camera() → {x, z} | null,
//       offer(id, label, priority, owner)?, t(key, vars)?, hasStr(key)?, lang()?, playS()? }
// =====================================================================================================
export function createEconomyCore(o) {
  const C = o.CONFIG, bus = o.bus, trash = o.trash, world = o.world || {};
  const RC = mergeFlat(ECONOMY_DEFAULTS.robot, C.robot);
  const OFF = mergeFlat(ECONOMY_DEFAULTS.offline, C.offline);
  const SELLX = mergeFlat(ECONOMY_DEFAULTS.selling, C.selling);
  const INC = mergeFlat(ECONOMY_DEFAULTS.income, C.income);
  const DEG = Math.PI / 180;
  const warned = {};
  function warnOnce(k, msg) { if (!warned[k]) { warned[k] = 1; console.warn('[economy] ' + msg); } }
  const has = (m, f) => !!m && typeof m[f] === 'function';
  for (const f of ['info', 'amountAt', 'removeAlongSegment', 'consume', 'clearAll', 'blockSums', 'cleanFraction', 'totalUnits'])
    if (!has(trash, f)) warnOnce('trash.' + f, 'trash.' + f + '() missing: contract §4.3 violated');

  // ---- strings
  function txt(key, vars) {
    if (o.hasStr && o.hasStr(key) && o.t) return o.t(key, vars);
    const e = FALLBACK_STR[key]; const lang = o.lang ? o.lang() : 'tr';
    let s = e ? (e[lang] != null ? e[lang] : e.tr) : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
  function fmt(n) { try { return Math.round(n).toLocaleString((o.lang ? o.lang() : 'tr') === 'en' ? 'en-US' : 'tr-TR'); } catch (e) { return String(Math.round(n)); } }

  // ---- trash types and values
  const tinfo = has(trash, 'info') ? trash.info() : null;
  const TYPES = tinfo && tinfo.types && tinfo.types.length ? tinfo.types.slice() : C.trashTypes.map((t) => t.id);
  const NT = TYPES.length;
  const VALUE = new Float64Array(NT);
  for (let t = 0; t < NT; t++) { const d = C.trashTypes.find((x) => x.id === TYPES[t]); VALUE[t] = d ? d.value : 0; }
  const VAL_IDX = TYPES.indexOf('valuable');
  const priceMul = num(C.selling && C.selling.priceMultiplier, 1);

  // ---- grid
  const D = C.district || {};
  const N = (tinfo && tinfo.N) || (D.grid && D.grid[0]) || 108;
  const CELL = (tinfo && tinfo.cell) || D.cellM || 0.5;
  const SIZE = N * CELL;
  const walk = new Uint8Array(N * N);
  // blocks of blockSums(): derive the cell size from the block COUNT (info().blockSize may be cells or metres)
  const NB = (tinfo && tinfo.blocks) || Math.ceil(N / 12);
  const BS = Math.ceil(N / NB);
  let walkDirty = true;
  function buildWalk() {
    const lay = has(world, 'layout') ? world.layout() : null;
    const kind = lay && lay.kind && lay.kind.length === N * N ? lay.kind : null;
    if (!kind) warnOnce('layout', 'world.layout().kind missing: robots treat every cell as walkable');
    const blk = has(world, 'isBlocked');
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const idx = j * N + i; let w = kind ? kind[idx] !== 0 : 1;
      if (w && blk && world.isBlocked((i + 0.5) * CELL, (j + 0.5) * CELL, 0)) w = 0;
      walk[idx] = w ? 1 : 0;
    }
    walkDirty = false;
  }
  const cellOf = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); return (i < 0 || j < 0 || i >= N || j >= N) ? -1 : j * N + i; };
  const cx = (idx) => (idx % N + 0.5) * CELL;
  const cz = (idx) => (((idx / N) | 0) + 0.5) * CELL;
  const dirtyIdx = (idx) => idx >= 0 && trash.amountAt(cx(idx), cz(idx)) > 0;
  function walkAt(x, z) { const c = cellOf(x, z); return c >= 0 && walk[c] === 1; }
  // swept-circle line of sight on the walk grid (radius 0.15 m, 0.25 m samples)
  function los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.sqrt(dx * dx + dz * dz), n = Math.max(1, Math.ceil(L / 0.25)), rr = 0.15;
    for (let k = 1; k <= n; k++) { // k = 0 skipped: a robot standing in a clipped corner may still leave it
      const x = x0 + dx * k / n, z = z0 + dz * k / n;
      const ia = Math.floor((x - rr) / CELL), ib = Math.floor((x + rr) / CELL), ja = Math.floor((z - rr) / CELL), jb = Math.floor((z + rr) / CELL);
      if (ia < 0 || ja < 0 || ib >= N || jb >= N) return false;
      if (!walk[ja * N + ia] || !walk[ja * N + ib] || !walk[jb * N + ia] || !walk[jb * N + ib]) return false;
    }
    return true;
  }

  // ---- BFS distance fields (4-connected) on the walk grid. Seeds may be solid (sell point inside a container).
  const INF = 65535;
  const queue = new Int32Array(N * N);
  function bfs(field, seeds, nSeeds) {
    field.fill(INF); let qh = 0, qt = 0;
    for (let s = 0; s < nSeeds; s++) { const c = seeds[s]; if (c >= 0 && field[c] === INF) { field[c] = 0; queue[qt++] = c; } }
    while (qh < qt) {
      const c = queue[qh++], d = field[c] + 1, i = c % N, j = (c / N) | 0;
      if (i > 0) { const q = c - 1; if (walk[q] && field[q] === INF) { field[q] = d; queue[qt++] = q; } }
      if (i < N - 1) { const q = c + 1; if (walk[q] && field[q] === INF) { field[q] = d; queue[qt++] = q; } }
      if (j > 0) { const q = c - N; if (walk[q] && field[q] === INF) { field[q] = d; queue[qt++] = q; } }
      if (j < N - 1) { const q = c + N; if (walk[q] && field[q] === INF) { field[q] = d; queue[qt++] = q; } }
    }
  }
  const scratchField = new Uint16Array(N * N);
  const seedBuf = new Int32Array(256);
  const chain = new Int32Array(N * 4);

  // ---- sell points, dock
  const sellPts = (C.sellPoints || []).map((p) => ({ id: p.id, x: p.pos[0], z: p.pos[1], r: p.radiusM, cartR: p.cartRadiusM || p.radiusM, active: false, unlockId: p.unlockId || null, field: new Uint16Array(N * N), strId: p.strId }));
  const shopPt = sellPts.find((p) => p.id === 'shop') || sellPts[0] || null;
  let dockX = C.robot.dockPos[0], dockZ = C.robot.dockPos[1];
  const dockField = new Uint16Array(N * N);
  function refreshPoints() {
    if (has(world, 'point')) {
      for (const p of sellPts) { const w = world.point(p.id); if (w && isFinite(w.x) && isFinite(w.z)) { p.x = w.x; p.z = w.z; } }
      const d = world.point('dock'); if (d && isFinite(d.x)) { dockX = d.x; dockZ = d.z; }
    }
  }
  function seedsAround(x, z, r) {
    let n = 0; const r2 = r * r;
    const i0 = Math.max(0, Math.floor((x - r) / CELL)), i1 = Math.min(N - 1, Math.floor((x + r) / CELL));
    const j0 = Math.max(0, Math.floor((z - r) / CELL)), j1 = Math.min(N - 1, Math.floor((z + r) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * N + i, dx = cx(c) - x, dz = cz(c) - z;
      if (walk[c] && dx * dx + dz * dz <= r2 && n < seedBuf.length) seedBuf[n++] = c;
    }
    if (!n) { const c = cellOf(x, z); if (c >= 0) seedBuf[n++] = c; }
    return n;
  }
  function buildFields() {
    for (const p of sellPts) bfs(p.field, seedBuf, seedsAround(p.x, p.z, Math.max(0.5, p.r * 0.5)));
    bfs(dockField, seedBuf, seedsAround(dockX, dockZ, 0.6));
  }
  function rebuildNav() { buildWalk(); buildFields(); }

  // ---- economy state
  const S = {
    coins: 0, purchases: 0,
    fx: {},                 // effect path -> value, derived from owned items
    owned: new Set(),
    boostLeft: 0, boostCd: 0, boostTick: 0,
    swept: false, msPaid: [],
    stats: { items: 0, earned: 0, spent: 0, robotUnits: 0, sales: 0, awayUnits: 0, awayCoins: 0 },
    playS: 0,
    income: { acc: 0, t: 0, ema: 0 },
    rate: { units: 0, robotS: 0, t: 0, ema: 0, samples: 0 },
    insideId: null, lastSaleT: -1e9,
  };
  function makeBox(name) { return { name, units: 0, by: new Int32Array(NT), dUnits: 0, dBy: new Int32Array(NT), dCoins: 0, dT: 0, dS: 0, full: false, eu: -1, ec: -1 }; }
  const bag = makeBox('bag'), tank = makeBox('tank');
  const box = (c) => (c === 'tank' ? tank : bag);

  // ---- shop
  const ITEMS = (C.shop && C.shop.items) || [];
  const itemById = {}; for (const it of ITEMS) itemById[it.id] = it;
  const sortedItems = ITEMS.slice().sort((a, b) => a.price - b.price);
  const catalogList = sortedItems.map((it) => ({ id: it.id, price: it.price, state: 'locked', next: false, affordable: false, strName: it.strName, strDesc: it.strDesc, requires: it.requires || [] }));
  const reqsMet = (it) => (it.requires || []).every((r) => S.owned.has(r));
  function applyEffect(eff) {
    if (!eff || !eff.set) return;
    const v = eff.value, cur = S.fx[eff.set];
    S.fx[eff.set] = typeof v === 'number' ? Math.max(typeof cur === 'number' ? cur : 0, v) : v;
  }
  function recomputeFx() { S.fx = {}; for (const it of sortedItems) if (S.owned.has(it.id)) applyEffect(it.effect); }
  const lvl = (p) => { const v = S.fx[p]; return typeof v === 'number' ? v : (v ? 1 : 0); };

  function stat(name) {
    switch (name) {
      case 'bagCapacity': return arrAt(C.bag.capacity, lvl('bag.level'));
      case 'broomWidth': return arrAt(C.broom.widthM, lvl('broom.widthLevel'));
      case 'broomSweepSpeed': return arrAt(C.broom.sweepSpeed, lvl('broom.speedLevel'));
      case 'handsReach': return C.hands.reachM;
      case 'cartNozzleWidth': return arrAt(C.cart.nozzleWidthM, lvl('cart.widthLevel'));
      case 'cartTank': return arrAt(C.cart.tank, lvl('cart.tankLevel'));
      case 'robotCount': return Math.min(C.robot.maxCount || 4, lvl('robot.count'));
      case 'robotCleanSpeed': return arrAt(C.robot.cleanSpeed, lvl('robot.speedLevel'));
      case 'robotMoveSpeed': return arrAt(C.robot.moveSpeed, lvl('robot.speedLevel'));
      case 'robotCapacity': return arrAt(C.robot.capacity, lvl('robot.capLevel'));
      case 'boostMultiplier': return S.boostLeft > 0 ? C.boost.multiplier : 1;
      default: warnOnce('stat.' + name, 'stat("' + name + '") is not a known stat (MIMARI §4.6)'); return 0;
    }
  }
  function owned(id) { return S.owned.has(id); }

  // ---- coins
  const coinEv = { coins: 0, delta: 0, reason: '' };
  function emitCoins(delta, reason) { coinEv.coins = S.coins; coinEv.delta = delta; coinEv.reason = reason; bus.emit('economy:coins', coinEv); }
  function earn(amount, reason = 'earn') {
    amount = Math.round(num(amount, 0)); if (!amount) return;
    S.coins = Math.max(0, S.coins + amount);
    if (amount > 0) { S.stats.earned += amount; if (reason === 'sale' || reason === 'robot') S.income.acc += amount; }
    emitCoins(amount, reason);
  }
  function valueOf(by) { let v = 0; for (let t = 0; t < NT; t++) v += by[t] * VALUE[t]; return v; }
  function saleCoins(by) { return Math.round(valueOf(by) * priceMul * stat('boostMultiplier')); }

  // ---- bag / tank
  function capOf(c) { return c === 'tank' ? (owned('cart') ? stat('cartTank') : 0) : stat('bagCapacity'); }
  function shownUnits(b) { return b.units + (b.dUnits > 0 ? Math.ceil(b.dUnits * Math.max(0, 1 - b.dT / b.dS)) : 0); }
  function bagUnits(c = 'bag') { return shownUnits(box(c)); }
  function bagCapacity(c = 'bag') { return capOf(c); }
  function bagSpace(c = 'bag') { return Math.max(0, capOf(c) - shownUnits(box(c))); }
  function addToBag(units, byType, c = 'bag') {
    units = Math.floor(num(units, 0)); if (units <= 0) return 0;
    const b = box(c), acc = Math.min(units, bagSpace(c));
    if (acc <= 0) return 0;
    if (!byType || byType.length < NT) { warnOnce('byType', 'addToBag without byType: counted as ' + TYPES[0]); b.by[0] += acc; }
    else if (acc === units) for (let t = 0; t < NT; t++) b.by[t] += byType[t];
    else { // partial: keep the most valuable first (caller should have asked for bagSpace() units)
      warnOnce('overfill', 'addToBag got more units than bagSpace(); the excess is dropped (caller should cap removal at bagSpace)');
      let left = acc;
      for (let t = NT - 1; t >= 0 && left > 0; t--) { const k = Math.min(left, byType[t]); b.by[t] += k; left -= k; }
    }
    b.units += acc; S.stats.items += acc;
    return acc;
  }

  // ---- selling
  const soldEv = { pointId: '', units: 0, coins: 0, byType: new Int32Array(NT), valuable: false, x: 0, z: 0, by: 'player', container: 'bag', robotId: null, dumpS: 0 };
  function emitSold(p, units, coins, by, who, container, robotId, dumpS) {
    soldEv.pointId = p.id; soldEv.units = units; soldEv.coins = coins; soldEv.byType.set(by);
    soldEv.valuable = VAL_IDX >= 0 && by[VAL_IDX] > 0; soldEv.x = p.x; soldEv.z = p.z; soldEv.by = who;
    soldEv.container = container; soldEv.robotId = robotId; soldEv.dumpS = dumpS;
    bus.emit('economy:sold', soldEv);
  }
  function startDump(b, p) {
    const units = b.units; if (units <= 0 || b.dUnits > 0) return false;
    b.dUnits = units; b.dBy.set(b.by); b.dCoins = saleCoins(b.by); b.dT = 0; b.dS = Math.max(0.01, num(C.selling && C.selling.dumpAnimS, 0.6));
    b.units = 0; b.by.fill(0); S.stats.sales++;
    emitSold(p, units, b.dCoins, b.dBy, 'player', b.name, null, b.dS);
    return true;
  }
  function stepDump(b, dt) {
    if (b.dUnits <= 0) return;
    b.dT += dt;
    if (b.dT >= b.dS) { const c = b.dCoins; b.dUnits = 0; b.dCoins = 0; b.dT = 0; b.dBy.fill(0); earn(c, 'sale'); }
  }
  function updateSelling() {
    const pose = o.player ? o.player() : null;
    if (!pose) return;
    const mounted = !!pose.mounted;
    let inside = null;
    for (let k = 0; k < sellPts.length; k++) {
      const p = sellPts[k]; if (!p.active) continue;
      const dx = pose.x - p.x, dz = pose.z - p.z, r = mounted ? p.cartR : p.r;
      if (dx * dx + dz * dz <= r * r) { inside = p; break; }
    }
    if (inside) {
      const entered = S.insideId !== inside.id;
      if (entered || S.playS - S.lastSaleT >= SELLX.resellDelayS) {
        let sold = false;
        if (mounted) sold = startDump(tank, inside) || sold;
        sold = startDump(bag, inside) || sold;
        if (sold) S.lastSaleT = S.playS;
      }
    }
    S.insideId = inside ? inside.id : null;
  }
  const bagEv = { container: 'bag', units: 0, cap: 0 }, fullEv = { container: 'bag' };
  function emitBoxes() {
    for (let k = 0; k < 2; k++) {
      const b = k ? tank : bag, u = shownUnits(b), cap = capOf(b.name);
      if (u !== b.eu || cap !== b.ec) { b.eu = u; b.ec = cap; bagEv.container = b.name; bagEv.units = u; bagEv.cap = cap; bus.emit('economy:bag', bagEv); }
      const full = cap > 0 && u >= cap;
      if (full && !b.full) { fullEv.container = b.name; bus.emit('economy:bagFull', fullEv); }
      b.full = full;
    }
  }

  // ---- shop rules
  function nextItem() { for (const it of sortedItems) if (!S.owned.has(it.id) && reqsMet(it)) return it; return null; }
  function catalog() {
    const nx = nextItem();
    for (let k = 0; k < catalogList.length; k++) {
      const e = catalogList[k], it = sortedItems[k];
      e.state = S.owned.has(it.id) ? 'owned' : reqsMet(it) ? 'available' : 'locked';
      e.next = !!nx && nx.id === it.id; e.affordable = e.state === 'available' && S.coins >= it.price;
    }
    return catalogList;
  }
  const purEv = { id: '', price: 0 };
  function grantInternal(id, paid) {
    const it = itemById[id];
    S.owned.add(id); S.purchases++; recomputeFx();
    if (it.effect && it.effect.set === 'sell.dropoff') walkDirty = true; // the container may block cells
    syncRobots();
    purEv.id = id; purEv.price = paid ? it.price : 0;
    bus.emit('economy:purchased', purEv);
    bus.emit('game:saveNow', null);
  }
  function buy(id) {
    const it = itemById[id];
    if (!it) { warnOnce('buy.' + id, 'buy("' + id + '"): unknown item'); return false; }
    if (S.owned.has(id) || !reqsMet(it) || S.coins < it.price) return false;
    S.coins -= it.price; S.stats.spent += it.price;
    emitCoins(-it.price, 'buy');
    grantInternal(id, true);
    return true;
  }
  function grant(id) { // debug/test: own an item (and its prerequisites) without paying
    const it = itemById[id]; if (!it) return false;
    for (const r of it.requires || []) if (!S.owned.has(r)) grant(r);
    if (!S.owned.has(id)) grantInternal(id, false);
    return true;
  }

  // ---- boost (mock rewarded ad), runs on game time
  const B = C.boost;
  const boostEv = { active: false, left: 0 };
  function emitBoost() { boostEv.active = S.boostLeft > 0; boostEv.left = Math.ceil(S.boostLeft); bus.emit('economy:boost', boostEv); }
  const boostActive = () => S.boostLeft > 0;
  const boostLeft = () => S.boostLeft;
  const boostCooldownLeft = () => (S.boostLeft > 0 ? S.boostLeft + B.cooldownS : S.boostCd);
  function incomeRate() { return S.income.ema; }
  function nextAwayS() {
    const it = nextItem(); if (!it) return -1;
    const need = it.price - S.coins; if (need <= 0) return 0;
    const r = incomeRate(); return r > 1e-3 ? need / r : Infinity;
  }
  function canOfferBoost(where = 'shop') {
    if (S.boostLeft > 0 || S.boostCd > 0) return false;
    if (where === 'milestone') return true; // the 50 % card: ui shows it once (CONFIG.boost.offerOnMilestone)
    if (S.purchases < B.offerMinPurchases) return false;
    return nextAwayS() >= B.offerWhenNextItemAwayS;
  }
  function startBoost() {
    if (S.boostLeft > 0 || S.boostCd > 0) { warnOnce('boost', 'startBoost() while active or cooling down: ignored'); return false; }
    S.boostLeft = B.durationS; S.boostTick = Math.ceil(B.durationS); emitBoost();
    return true;
  }
  function updateBoost(dt) {
    if (S.boostLeft > 0) {
      S.boostLeft -= dt;
      if (S.boostLeft <= 0) { S.boostLeft = 0; S.boostCd = B.cooldownS; emitBoost(); }
      else if (Math.ceil(S.boostLeft) < S.boostTick) { S.boostTick = Math.ceil(S.boostLeft); emitBoost(); }
    } else if (S.boostCd > 0) S.boostCd = Math.max(0, S.boostCd - dt);
  }

  // ---- income EMA (sales only; drives the boost offer rule)
  function updateIncome(dt) {
    const I = S.income; I.t += dt;
    if (I.t >= INC.windowS) { const sample = I.acc / I.t, a = Math.min(1, I.t / INC.tauS); I.ema = I.ema === 0 ? sample : I.ema + (sample - I.ema) * a; I.acc = 0; I.t = 0; }
  }

  // =================================================================================================== robots
  const robots = [];
  const PMAX = 48;
  let vMove = 0, vClean = 0, rCap = 0; // robot stats cached once per update (hot path: no stat() calls)
  function cacheRobotStats() { vMove = stat('robotMoveSpeed'); vClean = stat('robotCleanSpeed'); rCap = stat('robotCapacity'); }
    function robotName(k) {
    const n = k + 1;
    let nm = RC.names && RC.names[k] ? RC.names[k] : null;
    if (nm && o.hasStr && o.hasStr(nm)) nm = txt(nm);
    if (!nm) nm = txt('robot_n' + n);
    return txt('robot_name', { n, name: nm });
  }
  function makeRobot(k) {
    const r = {
      id: 'robot_' + (k + 1), index: k, name: robotName(k), color: RC.colors[k % RC.colors.length],
      x: dockX + k * 0.8, z: dockZ + 0.6, yaw: Math.PI, state: 'idle', load: 0, cap: stat('robotCapacity'),
      by: new Int32Array(NT), mode: 0, // 0 none, 1 work, 2 sell, 3 dock
      path: new Float32Array(PMAX * 2), pn: 0, pi: 0, partial: false,
      hx: 1, hz: 0, sx: 0, sz: 1, tCell: -1, block: -1,
      ax: dockX, az: dockZ, ban: new Float32Array(NB * NB),
      sell: null, saleCoins: 0, unloadT: 0, wait: 0, waits: 0, freeT: 0, ghost: 0, stuckT: 0, px: 0, pz: 0, idleT: RC.idleRetryS,
      resX: 0, resZ: 0, hasRes: false,
      far: false, farAcc: 0, collectAcc: 0, collectT: 0, cleanT: 0, hum: 0, led: 0,
      units: 0, firstCleanS: -1, spawnS: S.playS,
      ev: { id: 'robot_' + (k + 1), units: 0, x: 0, z: 0 },
    };
    r.px = r.x; r.pz = r.z;
    r.farAcc = (k / Math.max(1, C.robot.maxCount || 4)) * RC.farTickS; // stagger the far ticks
    return r;
  }
  const addEv = { id: '' };
  function syncRobots(silent) {
    const want = stat('robotCount');
    while (robots.length < want) {
      const r = makeRobot(robots.length); robots.push(r);
      if (!silent) { addEv.id = r.id; bus.emit('robot:added', addEv); }
    }
  }
  // path helpers
  function setDirect(r, x, z) { r.path[0] = x; r.path[1] = z; r.pn = 1; r.pi = 0; r.partial = false; }
  function pathFromField(r, field, endX, endZ) {
    let c = cellOf(r.x, r.z);
    if (c < 0 || field[c] === INF) { // standing in a solid/unreached cell: start from the best neighbour
      let best = -1, bd = INF; const i0 = c >= 0 ? c % N : Math.max(0, Math.min(N - 1, Math.floor(r.x / CELL))), j0 = c >= 0 ? (c / N) | 0 : Math.max(0, Math.min(N - 1, Math.floor(r.z / CELL)));
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const q = j * N + i; if (field[q] < bd) { bd = field[q]; best = q; }
      }
      if (best < 0) return false; c = best;
    }
    let n = 0; chain[n++] = c;
    while (field[c] > 0 && n < chain.length) {
      const i = c % N, j = (c / N) | 0, d = field[c]; let nx = -1;
      if (i > 0 && field[c - 1] < d) nx = c - 1; else if (i < N - 1 && field[c + 1] < d) nx = c + 1;
      else if (j > 0 && field[c - N] < d) nx = c - N; else if (j < N - 1 && field[c + N] < d) nx = c + N;
      if (nx < 0) break; c = nx; chain[n++] = c;
    }
    // string-pull: from the current point jump to the farthest chain cell still in line of sight
    let ax = r.x, az = r.z, i = 0, w = 0;
    while (i < n - 1 && w < PMAX - 1) {
      let k = i + 1;
      while (k + 1 < n && los(ax, az, cx(chain[k + 1]), cz(chain[k + 1]))) k++;
      ax = cx(chain[k]); az = cz(chain[k]); r.path[w * 2] = ax; r.path[w * 2 + 1] = az; w++; i = k;
    }
    r.partial = i < n - 1;
    if (!r.partial && endX != null && w < PMAX && los(ax, az, endX, endZ)) { r.path[w * 2] = endX; r.path[w * 2 + 1] = endZ; w++; }
    if (w === 0) { r.path[0] = endX != null ? endX : r.x; r.path[1] = endZ != null ? endZ : r.z; w = 1; }
    r.pn = w; r.pi = 0;
    return true;
  }
  function planTo(r, x, z) { // to an arbitrary point (work target / resume point)
    if (los(r.x, r.z, x, z)) { setDirect(r, x, z); return true; }
    const c = cellOf(x, z); if (c < 0) return false;
    seedBuf[0] = c; bfs(scratchField, seedBuf, 1);
    const rc = cellOf(r.x, r.z);
    if (rc >= 0 && scratchField[rc] === INF && walk[rc]) return false;
    return pathFromField(r, scratchField, x, z);
  }
  function goSell(r) {
    let best = null, bd = INF;
    const c = cellOf(r.x, r.z);
    for (const p of sellPts) { if (!p.active) continue; const d = c >= 0 ? p.field[c] : INF; if (d < bd) { bd = d; best = p; } }
    if (!best) { // unreachable on the grid: nearest active point in a straight line
      for (const p of sellPts) if (p.active) { const d = (p.x - r.x) ** 2 + (p.z - r.z) ** 2; if (!best || d < bd) { bd = d; best = p; } }
      if (!best) { r.state = 'idle'; r.mode = 0; return; }
      setDirect(r, best.x, best.z);
    } else { const ox = (r.index - 1.5) * 0.7; pathFromField(r, best.field, walkAt(best.x + ox, best.z) ? best.x + ox : best.x, best.z); }
    if (!r.hasRes && r.mode === 1) { r.resX = r.x; r.resZ = r.z; r.hasRes = true; }
    r.sell = best; r.mode = 2; r.state = 'travel'; r.stuckT = 0; r.px = r.x; r.pz = r.z;
  }
  function goDock(r) {
    if (los(r.x, r.z, dockX + r.index * 0.8, dockZ + 0.6)) setDirect(r, dockX + r.index * 0.8, dockZ + 0.6);
    else pathFromField(r, dockField, dockX + r.index * 0.8, dockZ + 0.6);
    r.mode = 3; r.state = 'travel'; r.hasRes = false; r.stuckT = 0; r.px = r.x; r.pz = r.z;
  }
  // free = dirty, walkable and not next to another robot's target/body
  function freeCell(r, c) {
    if (c < 0 || !walk[c] || !dirtyIdx(c)) return false;
    const x = cx(c), z = cz(c);
    const pose = o.player ? o.player() : null;
    if (pose) { const px = pose.x - x, pz = pose.z - z, lim = C.robot.avoidPlayerM + (pose.mounted ? 1 : 0.3); if (px * px + pz * pz < lim * lim) return false; } // not at the player's feet
    for (let k = 0; k < robots.length; k++) {
      const q = robots[k]; if (q === r || q.mode !== 1) continue;
      const dx = q.x - x, dz = q.z - z; if (dx * dx + dz * dz < 1.0) return false;
      if (q.tCell >= 0) { const ex = cx(q.tCell) - x, ez = cz(q.tCell) - z; if (ex * ex + ez * ez < 0.6) return false; }
    }
    return true;
  }
  function dirtyRun(c, di, dj, max) { // dirty walkable cells in a straight line from c (exclusive)
    const i = c % N, j = (c / N) | 0; let n = 0;
    for (let s = 1; s <= max; s++) { const ii = i + di * s, jj = j + dj * s; if (ii < 0 || jj < 0 || ii >= N || jj >= N) break; const q = jj * N + ii; if (!walk[q] || !dirtyIdx(q)) break; n++; }
    return n;
  }
  function chooseAxes(r, c) { // rows along the longer dirty run; first side = the dirtier one
    const px = dirtyRun(c, 1, 0, 12), nx = dirtyRun(c, -1, 0, 12), pz = dirtyRun(c, 0, 1, 12), nzr = dirtyRun(c, 0, -1, 12);
    if (px + nx >= pz + nzr) { r.hx = px >= nx ? 1 : -1; r.hz = 0; r.sx = 0; r.sz = dirtyRun(c, 0, 1, 6) >= dirtyRun(c, 0, -1, 6) ? 1 : -1; }
    else { r.hx = 0; r.hz = pz >= nzr ? 1 : -1; r.sz = 0; r.sx = dirtyRun(c, 1, 0, 6) >= dirtyRun(c, -1, 0, 6) ? 1 : -1; }
  }
  function cellRel(c, di, dj) { const ii = c % N + di, jj = ((c / N) | 0) + dj; return (ii < 0 || jj < 0 || ii >= N || jj >= N) ? -1 : jj * N + ii; }
  function chooseWork(r) {
    if (!has(trash, 'blockSums') || trash.totalUnits() <= 0) return false;
    const sums = trash.blockSums();
    const straggler = trash.cleanFraction() >= (C.robot.priorityStragglersAt || 0.9);
    const aw = straggler ? 0 : RC.anchorWeight;
    const bm = BS * CELL;
    for (let attempt = 0; attempt < 4; attempt++) {
      let bestB = -1, bestS = Infinity;
      for (let b = 0; b < NB * NB; b++) {
        if (!sums[b] || r.ban[b] > S.playS) continue;
        const bi = b % NB, bj = (b / NB) | 0, x0 = bi * bm, z0 = bj * bm;
        const nx = Math.max(x0, Math.min(r.x, x0 + bm)) - r.x, nz = Math.max(z0, Math.min(r.z, z0 + bm)) - r.z;
        const ax = x0 + bm / 2 - r.ax, az = z0 + bm / 2 - r.az;
        let s = Math.sqrt(nx * nx + nz * nz) + aw * Math.sqrt(ax * ax + az * az);
        for (let k = 0; k < robots.length; k++) {
          const q = robots[k]; if (q === r || q.mode !== 1 || q.block < 0) continue;
          if (q.block === b) s += RC.claimPenaltyM;
          else if (Math.abs((q.block % NB) - bi) <= 1 && Math.abs(((q.block / NB) | 0) - bj) <= 1) s += RC.claimPenaltyM * 0.3;
        }
        if (s < bestS) { bestS = s; bestB = b; }
      }
      if (bestB < 0) return false;
      // nearest free dirty cell of that block
      const bi = bestB % NB, bj = (bestB / NB) | 0;
      let best = -1, bd = Infinity;
      for (let j = bj * BS; j < Math.min(N, bj * BS + BS); j++) for (let i = bi * BS; i < Math.min(N, bi * BS + BS); i++) {
        const c = j * N + i; if (!freeCell(r, c)) continue;
        const dx = cx(c) - r.x, dz = cz(c) - r.z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = c; }
      }
      if (best < 0 || !planTo(r, cx(best), cz(best))) { r.ban[bestB] = S.playS + (best < 0 ? 2 : RC.banS); continue; }
      r.block = bestB; r.tCell = best; chooseAxes(r, best);
      r.mode = 1; r.state = 'clean'; r.stuckT = 0; r.px = r.x; r.pz = r.z;
      return true;
    }
    return false;
  }
  function decide(r) {
    r.cap = stat('robotCapacity');
    const left = has(trash, 'totalUnits') ? trash.totalUnits() : 0;
    if (r.load >= r.cap || (r.load > 0 && (left <= 0 || S.swept))) { goSell(r); return; }
    if (r.hasRes && left > 0) { r.hasRes = false; if (planTo(r, r.resX, r.resZ)) { r.mode = 1; r.state = 'clean'; r.tCell = cellOf(r.resX, r.resZ); r.block = -1; return; } }
    if (left > 0 && !S.swept && chooseWork(r)) return;
    const atDock = (r.x - dockX - r.index * 0.8) ** 2 + (r.z - dockZ - 0.6) ** 2 < 0.2;
    if (!atDock) goDock(r); else { r.state = 'idle'; r.mode = 0; r.idleT = 0; }
  }
  function nextRowCell(r) {
    if (r.load >= r.cap) { goSell(r); return; }
    const c = cellOf(r.x, r.z);
    if (c < 0) { decide(r); return; }
    let t = cellRel(c, r.hx, r.hz);
    if (freeCell(r, t)) { r.tCell = t; setDirect(r, cx(t), cz(t)); return; }
    t = cellRel(c, r.sx, r.sz);
    if (freeCell(r, t)) { r.hx = -r.hx; r.hz = -r.hz; r.tCell = t; setDirect(r, cx(t), cz(t)); return; }
    // short local search (prefer the side we are progressing towards, then the row behind)
    const L = RC.localSearchCells; let best = -1, bs = Infinity, bdi = 0, bdj = 0;
    for (let dj = -L; dj <= L; dj++) for (let di = -L; di <= L; di++) {
      if (!di && !dj) continue; const q = cellRel(c, di, dj); if (!freeCell(r, q)) continue;
      const along = di * r.sx + dj * r.sz;
      const s = Math.abs(di) + Math.abs(dj) + (along < 0 ? 2.5 : 0);
      if (s < bs && los(r.x, r.z, cx(q), cz(q))) { bs = s; best = q; bdi = di; bdj = dj; }
    }
    if (best >= 0) {
      if (bdi * r.sx + bdj * r.sz < 0) { r.sx = -r.sx; r.sz = -r.sz; }
      if (bdi * r.hx + bdj * r.hz < 0) { r.hx = -r.hx; r.hz = -r.hz; }
      r.tCell = best; setDirect(r, cx(best), cz(best)); return;
    }
    if (!chooseWork(r)) decide(r);
  }
  function arrived(r) {
    if (r.partial) { // long path was truncated: plan the rest
      const x = r.mode === 2 && r.sell ? r.sell.x : r.mode === 3 ? dockX : r.tCell >= 0 ? cx(r.tCell) : r.x;
      const z = r.mode === 2 && r.sell ? r.sell.z : r.mode === 3 ? dockZ : r.tCell >= 0 ? cz(r.tCell) : r.z;
      if (r.mode === 2 && r.sell) pathFromField(r, r.sell.field, x, z); else if (r.mode === 3) pathFromField(r, dockField, x, z); else planTo(r, x, z);
      return;
    }
    if (r.mode === 1) { r.state = 'clean'; nextRowCell(r); return; }
    if (r.mode === 2) { startUnload(r); return; }
    if (r.mode === 3) { r.mode = 0; r.state = 'idle'; r.idleT = 0; return; }
    decide(r);
  }
  function startUnload(r) {
    const p = r.sell; r.mode = 0; r.state = 'unload'; r.unloadT = num(C.robot.unloadS, 2);
    if (r.load > 0 && p) { r.saleCoins = saleCoins(r.by); S.stats.sales++; emitSold(p, r.load, r.saleCoins, r.by, 'robot', 'robot', r.id, r.unloadT); }
    else r.saleCoins = 0;
  }
  function finishUnload(r) {
    if (r.saleCoins) earn(r.saleCoins, 'robot');
    r.saleCoins = 0; r.load = 0; r.by.fill(0); r.state = 'idle'; r.idleT = 0;
    decide(r);
  }
  function blocked(r, fx, fz) { // (fx, fz) = unit direction of travel
    if (r.ghost > 0) return false;
    const pose = o.player ? o.player() : null;
    if (pose) {
      const lim = pose.mounted ? C.robot.avoidPlayerM + 0.8 : C.robot.avoidPlayerM; // the cart is bigger
      const dx = pose.x - r.x, dz = pose.z - r.z, d2 = dx * dx + dz * dz;
      if (d2 < lim * lim && dx * fx + dz * fz > 0.25 * Math.sqrt(d2)) return true;
    }
    for (let k = 0; k < r.index; k++) { // lower index has right of way: no deadlock
      const q = robots[k]; const dx = q.x - r.x, dz = q.z - r.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.85 * 0.85 && dx * fx + dz * fz > 0.3 * Math.sqrt(d2)) return true;
    }
    return false;
  }
  const halfSwath = () => C.robot.swathM / 2 + RC.swathEps;
  function drive(r, dt) {
    if (r.ghost > 0) r.ghost -= dt;
    let left = dt, guard = 0;
    // time left after reaching a waypoint carries over to the next one (no per-cell time loss, so per-frame
    // and coarse far ticks clean at the same rate)
    while (left > 1e-6 && guard++ < 8) {
      if (r.state === 'unload' || r.state === 'idle') break;
      if (r.pi >= r.pn) { arrived(r); continue; }
      const tx = r.path[r.pi * 2], tz = r.path[r.pi * 2 + 1];
      const dx = tx - r.x, dz = tz - r.z, dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1e-4) { r.pi++; if (r.pi >= r.pn) arrived(r); continue; }
      if (blocked(r, dx / dist, dz / dist)) {
        r.wait += left; r.freeT = 0;
        if (r.wait > RC.waitMaxS) {
          r.wait = 0; r.waits++;
          if (r.mode === 1 && r.waits < 2) { if (r.block >= 0) r.ban[r.block] = S.playS + 3; if (!chooseWork(r)) r.ghost = 1.5; }
          else { r.ghost = 1.5; r.waits = 0; } // still in the way: pass by (robots are small; never stuck)
        }
        break;
      }
      r.wait = 0; r.freeT += left; if (r.freeT > 3) r.waits = 0;
      const want = Math.atan2(dx, -dz), diff = wrapAng(want - r.yaw), maxT = RC.turnRateDeg * DEG * left;
      const turn = diff > maxT ? maxT : diff < -maxT ? -maxT : diff;
      r.yaw = wrapAng(r.yaw + turn);
      const mis = Math.cos(diff - turn), fac = mis <= 0.5 ? 0 : (mis - 0.5) * 2;
      const working = r.mode === 1 && r.load < r.cap;
      let v = vMove;
      if (working) {
        const ax = r.x + Math.sin(r.yaw) * 0.3, az = r.z - Math.cos(r.yaw) * 0.3;
        if (trash.amountAt(ax, az) > 0 || trash.amountAt(r.x, r.z) > 0) v = vClean;
      }
      const full = v * fac * left, step = Math.min(dist, full);
      if (step > 0) {
        const nx = r.x + dx / dist * step, nz = r.z + dz / dist * step;
        if (working) {
          const res = trash.removeAlongSegment(r.x, r.z, nx, nz, halfSwath(), r.cap - r.load, 'robot');
          if (res && res.units > 0) {
            r.load += res.units; for (let t = 0; t < NT; t++) r.by[t] += res.byType[t];
            r.collectAcc += res.units; r.units += res.units; r.cleanT = 0.35; S.stats.robotUnits += res.units; S.stats.items += res.units; S.rate.units += res.units;
            if (r.firstCleanS < 0) r.firstCleanS = S.playS - r.spawnS;
          }
        }
        r.x = nx; r.z = nz;
      }
      left = full > 0 && step < full ? left * (1 - step / full) : 0;
      if (dist - step < 0.02) { r.pi++; if (r.pi >= r.pn) arrived(r); }
      if (working && r.load >= r.cap) goSell(r);
    }
    if (r.mode === 1) r.state = r.cleanT > 0 ? 'clean' : 'travel';
    // progress watchdog (only while actually trying to move)
    if (r.state === 'unload' || r.state === 'idle') { r.stuckT = 0; return; }
    r.stuckT += dt;
    if (r.stuckT >= RC.stuckS) {
      const mx = r.x - r.px, mz = r.z - r.pz;
      if (mx * mx + mz * mz < 0.09 && r.mode !== 0) {
        if (r.block >= 0) r.ban[r.block] = S.playS + RC.banS;
        if (r.mode === 1) { if (!chooseWork(r)) decide(r); } else if (r.mode === 2) goSell(r); else goDock(r);
        r.ghost = 1.0;
      }
      r.stuckT = 0; r.px = r.x; r.pz = r.z;
    }
  }
  function robotTick(r, dt) {
    if (r.cleanT > 0) r.cleanT -= dt;
    if (r.state === 'unload') { r.unloadT -= dt; if (r.unloadT <= 0) finishUnload(r); return; }
    if (r.state === 'idle') { r.idleT += dt; if (r.idleT >= RC.idleRetryS) { r.idleT = 0; decide(r); } return; }
    drive(r, dt);
  }
  function stepRobot(r, dt) {
    if (dt <= 0) return;
    r.cap = rCap;
    const vmax = vMove > vClean ? vMove : vClean;
    const n = Math.max(1, Math.ceil(vmax * dt / RC.maxSubstepM)), h = dt / n;
    for (let s = 0; s < n; s++) robotTick(r, h);
    // aggregated events + presentation hints
    r.collectT += dt;
    if (r.collectT >= RC.collectEventS) {
      if (r.collectAcc > 0) { r.ev.units = r.collectAcc; r.ev.x = r.x; r.ev.z = r.z; bus.emit('robot:collect', r.ev); }
      r.collectAcc = 0; r.collectT = 0;
    }
    r.hum = r.state === 'idle' ? 0 : r.state === 'unload' ? 0.35 : r.cleanT > 0 ? 1 : 0.6;
    r.led = r.state === 'idle' ? 3 : (r.state === 'unload' || (r.mode === 2 && r.load >= r.cap)) ? 2 : 1;
  }
  function updateRobots(dt) {
    if (dt <= 0) return;
    cacheRobotStats();
    const cam = o.camera ? o.camera() : null;
    let active = 0;
    for (let k = 0; k < robots.length; k++) {
      const r = robots[k];
      if (r.state !== 'idle') active++;
      if (cam) { const dx = cam.x - r.x, dz = cam.z - r.z, d2 = dx * dx + dz * dz, lim = r.far ? RC.farM - RC.farHysteresisM : RC.farM; r.far = d2 > lim * lim; }
      else r.far = true;
      if (r.far) { r.farAcc += dt; if (r.farAcc >= RC.farTickS) { const s = r.farAcc; r.farAcc = 0; stepRobot(r, s); } }
      else { if (r.farAcc > 0) { const s = r.farAcc; r.farAcc = 0; stepRobot(r, s); } stepRobot(r, dt); }
    }
    // measured rate per robot (units per robot-second, trips included) for the away catch-up
    const R = S.rate; R.robotS += active * dt; R.t += dt;
    if (R.t >= RC.rateWindowS) {
      if (R.robotS > 0) { const sample = R.units / R.robotS, a = Math.min(1, R.robotS / RC.rateTauS); R.ema = R.samples ? R.ema + (sample - R.ema) * a : sample; R.samples++; }
      R.units = 0; R.robotS = 0; R.t = 0;
    }
  }
  function robotRate() { // units per robot-second used while away
    const prior = RC.ratePriorUps * stat('robotCleanSpeed') / (C.robot.cleanSpeed[0] || 1);
    return S.rate.samples >= 3 ? S.rate.ema : prior;
  }

  // ---- final sweep + milestones
  const sweepEv = { units: 0, coins: 0, durationS: 0 };
  function checkFinalSweep() {
    if (S.swept || !has(trash, 'clearAll') || !(trash.trashCells && trash.trashCells() > 0)) return;
    if (trash.cleanFraction() < C.completion.finalSweepAt) return;
    S.swept = true;
    const res = trash.clearAll('final');
    const units = res ? res.units : 0, coins = res ? saleCoins(res.byType) : 0;
    S.stats.items += units;
    sweepEv.units = units; sweepEv.coins = coins; sweepEv.durationS = C.completion.finalSweepS;
    bus.emit('economy:finalSweep', sweepEv);
    earn(coins, 'finalSweep');
    bus.emit('game:saveNow', null);
  }
  function onMilestone(p) {
    const i = p ? p.index | 0 : -1, m = C.milestones[i];
    if (!m || S.msPaid[i]) return;
    S.msPaid[i] = 1;
    if (m.bonus > 0) earn(m.bonus, 'milestone');
    bus.emit('game:saveNow', null);
  }

  // ---- away / offline catch-up (PSIKOLOJI §6)
  const awayBy = new Int32Array(NT);
  const awayEv = { awayS: 0, simS: 0, capped: false, limitedByRemaining: false, units: 0, coins: 0, robots: 0, rateUps: 0, capS: 0 };
  function catchUp(awayS) {
    awayS = num(awayS, 0);
    if (awayS < OFF.minSimS || robots.length === 0 || S.swept || !has(trash, 'consume')) return null;
    const simS = Math.min(awayS, OFF.capS), rate = robotRate();
    const want = Math.floor(rate * robots.length * simS);
    const maxU = Math.floor(trash.totalUnits() * OFF.maxFractionOfRemaining);
    const target = Math.max(0, Math.min(want, maxU));
    awayBy.fill(0); let units = 0, carried = 0;
    for (let k = 0; k < robots.length; k++) {
      const r = robots[k];
      const share = Math.floor(target / robots.length) + (k < target % robots.length ? 1 : 0);
      if (share > 0) {
        const x = r.hasRes ? r.resX : r.x, z = r.hasRes ? r.resZ : r.z;
        const res = trash.consume(x, z, share, 1e9, 'robot');
        if (res) { units += res.units; for (let t = 0; t < NT; t++) awayBy[t] += res.byType[t]; }
      }
      // what the robot carried or was unloading has been sold meanwhile
      if (r.state === 'unload' && r.saleCoins) { earn(r.saleCoins, 'robot'); r.saleCoins = 0; r.load = 0; r.by.fill(0); }
      if (r.load > 0) { for (let t = 0; t < NT; t++) awayBy[t] += r.by[t]; carried += r.load; r.load = 0; r.by.fill(0); }
      r.state = 'idle'; r.mode = 0; r.idleT = RC.idleRetryS; r.hasRes = false; r.pn = 0; r.pi = 0;
    }
    const coins = Math.round(valueOf(awayBy) * priceMul); // never boosted
    S.stats.items += units; S.stats.robotUnits += units; S.stats.awayUnits += units; S.stats.awayCoins += coins;
    earn(coins, 'away');
    Object.assign(awayEv, { awayS, simS, capped: awayS > OFF.capS, limitedByRemaining: want > maxU, units: units + carried, coins, robots: robots.length, rateUps: rate, capS: OFF.capS });
    bus.emit('economy:away', awayEv);
    if (awayS >= OFF.announceMinS && units + carried > 0) {
      let text = txt('away_summary', { n: fmt(units + carried), m: fmt(coins) });
      if (awayEv.capped) text += ' ' + txt('away_capped', { h: fmt(OFF.capS / 3600) });
      bus.emit('ui:toast', { text });
    }
    bus.emit('game:saveNow', null);
    return awayEv;
  }

  // ---- per frame
  function update(dt) {
    if (walkDirty) rebuildNav();
    for (let k = 0; k < sellPts.length; k++) { const p = sellPts[k]; p.active = !p.unlockId || S.owned.has(p.unlockId); }
    if (dt > 0) {
      S.playS += dt;
      updateSelling();
      stepDump(bag, dt); stepDump(tank, dt);
      updateRobots(dt);
      updateBoost(dt);
      updateIncome(dt);
      checkFinalSweep();
    }
    emitBoxes();
    // shop offer (§4.9)
    if (o.offer) {
      const pose = o.player ? o.player() : null, sp = shopPt;
      if (pose && sp) { const dx = pose.x - sp.x, dz = pose.z - sp.z, R = C.shop.openRadiusM; if (dx * dx + dz * dz <= R * R) o.offer('shop', o.t ? o.t('act_shop') : 'Dükkan', 60, 'economy'); }
    }
  }

  // ---- save / load
  const byToObj = (by) => { const out = {}; for (let t = 0; t < NT; t++) if (by[t]) out[TYPES[t]] = by[t]; return out; };
  function objToBy(obj, out) { out.fill(0); if (!obj || typeof obj !== 'object') return 0; let s = 0; for (let t = 0; t < NT; t++) { const v = Math.max(0, Math.floor(num(obj[TYPES[t]], 0))); out[t] = v; s += v; } return s; }
  function save() {
    // fold in-flight sales so a save never loses or doubles coins
    let coins = S.coins + bag.dCoins + tank.dCoins;
    for (const r of robots) if (r.state === 'unload') coins += r.saleCoins;
    return {
      v: 1, coins,
      bag: { units: bag.units, byType: byToObj(bag.by) },
      tank: { units: tank.units, byType: byToObj(tank.by) },
      owned: Array.from(S.owned), levels: Object.assign({}, S.fx),
      boost: { left: +S.boostLeft.toFixed(2), cd: +S.boostCd.toFixed(2) },
      robots: robots.map((r) => ({ x: +r.x.toFixed(2), z: +r.z.toFixed(2), yaw: +r.yaw.toFixed(3), load: r.state === 'unload' ? 0 : r.load, byType: r.state === 'unload' ? {} : byToObj(r.by), ax: r.ax, az: r.az, units: r.units })),
      stats: Object.assign({}, S.stats), purchases: S.purchases, swept: S.swept, msPaid: S.msPaid.slice(),
      rate: { ema: S.rate.ema, samples: S.rate.samples }, income: S.income.ema,
    };
  }
  function resetState() {
    S.coins = num(C.player && C.player.startCoins, 0); S.purchases = 0; S.owned.clear(); S.fx = {};
    S.boostLeft = 0; S.boostCd = 0; S.swept = false; S.msPaid = [];
    for (const k of Object.keys(S.stats)) S.stats[k] = 0;
    S.income.acc = 0; S.income.t = 0; S.income.ema = 0;
    S.rate.units = 0; S.rate.robotS = 0; S.rate.t = 0; S.rate.ema = 0; S.rate.samples = 0;
    for (const b of [bag, tank]) { b.units = 0; b.by.fill(0); b.dUnits = 0; b.dCoins = 0; b.dT = 0; b.full = false; b.eu = -1; b.ec = -1; }
    robots.length = 0;
  }
  function load(d) {
    resetState();
    if (!d || typeof d !== 'object') return;
    if (d.v != null && d.v !== 1) warnOnce('savev', 'economy save v' + d.v + ' is newer than this build: read best-effort');
    S.coins = Math.max(0, Math.floor(num(d.coins, S.coins)));
    if (Array.isArray(d.owned)) for (const id of d.owned) if (itemById[id]) S.owned.add(id);
    // fill missing prerequisites (older/partial saves) so the shop state is always consistent
    let added = true; while (added) { added = false; for (const id of Array.from(S.owned)) for (const r of itemById[id].requires || []) if (!S.owned.has(r) && itemById[r]) { S.owned.add(r); added = true; } }
    recomputeFx(); S.purchases = Math.max(S.owned.size, Math.floor(num(d.purchases, 0)));
    for (const [b, src] of [[bag, d.bag], [tank, d.tank]]) {
      if (!src) continue;
      const s = objToBy(src.byType, b.by);
      b.units = Math.min(capOf(b.name), Math.max(0, Math.floor(num(src.units, s))));
      if (s !== b.units) { b.by.fill(0); b.by[0] = b.units; } // inconsistent save: keep the count, value as paper
    }
    if (d.boost) { S.boostLeft = Math.max(0, Math.min(B.durationS, num(d.boost.left, 0))); S.boostCd = Math.max(0, Math.min(B.cooldownS, num(d.boost.cd, 0))); S.boostTick = Math.ceil(S.boostLeft); }
    if (d.stats) for (const k of Object.keys(S.stats)) S.stats[k] = Math.max(0, num(d.stats[k], 0));
    S.swept = !!d.swept;
    if (Array.isArray(d.msPaid)) S.msPaid = d.msPaid.map((v) => (v ? 1 : 0));
    if (d.rate) { S.rate.ema = Math.max(0, num(d.rate.ema, 0)); S.rate.samples = Math.max(0, num(d.rate.samples, 0) | 0); }
    S.income.ema = Math.max(0, num(d.income, 0));
    syncRobots(true);
    if (Array.isArray(d.robots)) for (let k = 0; k < robots.length && k < d.robots.length; k++) {
      const r = robots[k], s = d.robots[k]; if (!s) continue;
      const x = num(s.x, r.x), z = num(s.z, r.z);
      if (x >= 0 && z >= 0 && x <= SIZE && z <= SIZE) { r.x = x; r.z = z; }
      r.yaw = num(s.yaw, r.yaw); r.ax = num(s.ax, r.ax); r.az = num(s.az, r.az); r.units = num(s.units, 0);
      r.cap = stat('robotCapacity');
      const sum = objToBy(s.byType, r.by);
      r.load = Math.min(r.cap, Math.max(0, Math.floor(num(s.load, sum))));
      if (sum !== r.load) { r.by.fill(0); r.by[0] = r.load; }
      r.px = r.x; r.pz = r.z;
    }
    walkDirty = true;
  }

  function debugState() {
    return {
      coins: S.coins, purchases: S.purchases, owned: Array.from(S.owned), fx: Object.assign({}, S.fx),
      bag: { units: bag.units, draining: bag.dUnits, cap: capOf('bag') }, tank: { units: tank.units, draining: tank.dUnits, cap: capOf('tank') },
      boost: { left: S.boostLeft, cd: S.boostCd }, income: S.income.ema, robotRate: robotRate(), rateSamples: S.rate.samples,
      swept: S.swept, msPaid: S.msPaid.slice(), stats: Object.assign({}, S.stats), playS: S.playS,
      next: (nextItem() || {}).id || null, nextAwayS: nextAwayS(),
      robots: robots.map((r) => ({ id: r.id, name: r.name, x: +r.x.toFixed(2), z: +r.z.toFixed(2), state: r.state, mode: r.mode, load: r.load, cap: r.cap, far: r.far, units: r.units, firstCleanS: r.firstCleanS, block: r.block })),
    };
  }

  refreshPoints();
  bus.on('ui:buy', (p) => { if (p && p.id) buy(p.id); });
  bus.on('ui:adWatched', (p) => { if (!p || !p.kind || p.kind === 'boost') startBoost(); });
  bus.on('trash:milestone', onMilestone);
  bus.on('game:ready', (p) => { if (p && p.awayS > 0) catchUp(p.awayS); });
  bus.on('app:resume', (p) => { if (p && p.awayS > 0) catchUp(p.awayS); });

  return {
    update, save, load, refreshPoints, rebuildNav,
    coins: () => S.coins, earn, bagUnits, bagCapacity, bagSpace, addToBag, stat, owned, catalog, buy, grant,
    boostActive, boostLeft, boostCooldownLeft, canOfferBoost, startBoost,
    robots: () => robots, sellPoints: () => sellPts,
    stats: () => ({ items: S.stats.items, coins: S.stats.earned, playS: o.playS ? o.playS() : S.playS }),
    catchUp, debugState, nextItem, nextAwayS, robotRate, incomeRate,
    _S: S, _walk: walk, N, CELL,
  };
}

// =====================================================================================================
// Module wrapper (ctx, rendering)
// =====================================================================================================
let core = null, ctxRef = null, V = null;

export function init(ctx) {
  ctxRef = ctx;
  const mods = ctx.mods;
  const camPos = { x: 0, z: 0 };
  core = createEconomyCore({
    CONFIG: ctx.CONFIG, bus: ctx.bus, trash: mods.trash, world: mods.world,
    player: () => (mods.player && mods.player.pose ? mods.player.pose() : null),
    camera: () => { camPos.x = ctx.camera.position.x; camPos.z = ctx.camera.position.z; return camPos; },
    offer: (id, label, pr, owner) => ctx.offer(id, label, pr, owner),
    t: ctx.t, hasStr: (k) => !!(ctx.STR && ctx.STR[k]), lang: () => (ctx.state && ctx.state.settings && ctx.state.settings.lang) || 'tr',
    playS: () => ctx.time.game,
  });
  V = makeView(ctx);
}
export function update(dt) {
  if (!core) return;
  core.update(dt);
  if (V) renderRobots(ctxRef.time.dt || dt);
}
export function save() { return core ? core.save() : null; }
export function load(d) { if (core) core.load(d); }
export function coins() { return core ? core.coins() : 0; }
export function earn(amount, reason) { if (core) core.earn(amount, reason); }
export function bagUnits(c = 'bag') { return core ? core.bagUnits(c) : 0; }
export function bagCapacity(c = 'bag') { return core ? core.bagCapacity(c) : 0; }
export function bagSpace(c = 'bag') { return core ? core.bagSpace(c) : 0; }
export function addToBag(units, byType, c = 'bag') { return core ? core.addToBag(units, byType, c) : 0; }
export function stat(name) { return core ? core.stat(name) : 0; }
export function owned(id) { return core ? core.owned(id) : false; }
export function catalog() { return core ? core.catalog() : []; }
export function buy(id) { return core ? core.buy(id) : false; }
export function boostActive() { return core ? core.boostActive() : false; }
export function boostLeft() { return core ? core.boostLeft() : 0; }
export function boostCooldownLeft() { return core ? core.boostCooldownLeft() : 0; }
export function canOfferBoost(where = 'shop') { return core ? core.canOfferBoost(where) : false; }
export function startBoost() { return core ? core.startBoost() : false; }
export function robots() { return core ? core.robots() : []; }
export function sellPoints() { return core ? core.sellPoints() : []; }
export function stats() { return core ? core.stats() : { items: 0, coins: 0, playS: 0 }; }
// extensions (debug/test; see docs/notlar/economy.md "Sözleşme sorunları")
export function grant(id) { return core ? core.grant(id) : false; }
export function debugState() { return core ? core.debugState() : null; }
export function simulateAway(awayS) { return core ? core.catchUp(awayS) : null; }

// ------------------------------------------------------------------------------- robot meshes (3 draw calls)
function makeView(ctx) {
  const THREE = ctx.THREE; if (!THREE) return null;
  const C = ctx.CONFIG, RC = mergeFlat(ECONOMY_DEFAULTS.robot, C.robot);
  const MAX = C.robot.maxCount || 4, PUFFS = RC.puffs, RAD = RC.bodyRadiusM, H = RC.bodyHeightM;

  // body: merged non-indexed parts, vertex colours (white parts take the robot's instance colour)
  const parts = [];
  const add = (g, col, y) => { g.translate(0, y, 0); const ng = g.index ? g.toNonIndexed() : g; parts.push([ng, col]); };
  add(new THREE.CylinderGeometry(RAD + 0.015, RAD + 0.02, 0.06, 28), [0.18, 0.19, 0.2], 0.03);           // bumper
  add(new THREE.CylinderGeometry(RAD, RAD, H - 0.07, 28), [1, 1, 1], 0.06 + (H - 0.07) / 2);               // shell (instance colour)
  add(new THREE.CylinderGeometry(RAD * 0.62, RAD * 0.7, 0.03, 24), [0.86, 0.86, 0.86], H + 0.005);        // lid (tinted, lighter look)
  add(new THREE.CylinderGeometry(0.075, 0.08, 0.07, 14), [0.15, 0.16, 0.17], H + 0.05);                   // lidar turret
  const front = new THREE.BoxGeometry(0.2, 0.05, 0.06); front.translate(0, 0, -RAD + 0.01);               // front sensor bar (yaw 0 = −z)
  add(front, [0.12, 0.12, 0.14], 0.13);
  let nv = 0; for (const [g] of parts) nv += g.attributes.position.count;
  const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), Cc = new Float32Array(nv * 3);
  let o = 0;
  for (const [g, col] of parts) {
    g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, cnt = g.attributes.position.count;
    P.set(p, o * 3); Nn.set(n, o * 3);
    for (let i = 0; i < cnt; i++) { Cc[(o + i) * 3] = col[0]; Cc[(o + i) * 3 + 1] = col[1]; Cc[(o + i) * 3 + 2] = col[2]; }
    o += cnt; g.dispose();
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  bodyGeo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), MAX);
  // LED: a small glowing dome on the lid's front edge
  const ledGeo = new THREE.SphereGeometry(0.035, 10, 6, 0, TAU, 0, Math.PI / 2); ledGeo.translate(0, H + 0.02, -RAD * 0.45);
  const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
  // ground decals: blob shadows (instances 0..MAX-1) + dust trail puffs
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.62)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const decalGeo = new THREE.PlaneGeometry(1, 1); decalGeo.rotateX(-Math.PI / 2);
  const decals = new THREE.InstancedMesh(decalGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), MAX * (1 + PUFFS));
  decals.renderOrder = 2;
  const col = new THREE.Color();
  for (const m of [bodies, leds, decals]) {
    m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // r128 sizes instanceColor from mesh.count on the first setColorAt: do it while count is still the maximum
    for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, col.set(0xffffff));
    m.count = 0;
    m.name = 'economy-robots';
    ctx.scene.add(m);
  }
  const colors = []; for (let k = 0; k < MAX; k++) colors.push(new THREE.Color(RC.colors[k % RC.colors.length]));
  const disp = [];
  for (let k = 0; k < MAX; k++) disp.push({ x: 0, y: 0, z: 0, yaw: 0, init: false, puffT: 0, pi: 0, px: new Float32Array(PUFFS), pz: new Float32Array(PUFFS), pa: new Float32Array(PUFFS).fill(99) });
  return { THREE, bodies, leds, decals, colors, disp, dummy: new THREE.Object3D(), col, MAX, PUFFS, RC, t: 0,
    shadowCol: new THREE.Color(0, 0, 0), puffCol: new THREE.Color(0.86, 0.82, 0.72),
    ledCol: [new THREE.Color(0x000000), new THREE.Color(0x4dff7a), new THREE.Color(0xffb02e), new THREE.Color(0x6aa8ff)] };
}
function renderRobots(dt) {
  const list = core.robots(), n = Math.min(list.length, V.MAX), d = V.dummy, trash = ctxRef.mods.trash;
  V.t += dt;
  const life = V.RC.puffLifeS;
  let nd = n;
  for (let k = 0; k < n; k++) {
    const r = list[k], q = V.disp[k];
    if (!q.init) { q.x = r.x; q.z = r.z; q.yaw = r.yaw; q.y = 0; q.init = true; }
    if (r.far) { // coarse ticks: smooth the shown pose
      const a = 1 - Math.exp(-dt * 10);
      q.x += (r.x - q.x) * a; q.z += (r.z - q.z) * a; q.yaw = wrapAng(q.yaw + wrapAng(r.yaw - q.yaw) * a);
    } else {
      const ex = r.x - q.x, ez = r.z - q.z;
      if (ex * ex + ez * ez > 0.25) { const a = 1 - Math.exp(-dt * 12); q.x += ex * a; q.z += ez * a; q.yaw = wrapAng(q.yaw + wrapAng(r.yaw - q.yaw) * a); } // hand-over from far
      else { q.x = r.x; q.z = r.z; q.yaw = r.yaw; }
    }
    const surf = trash && trash.surfaceAt ? trash.surfaceAt(q.x, q.z) : 0;
    q.y += (surf * 0.55 - q.y) * Math.min(1, dt * 10);
    d.position.set(q.x, q.y, q.z); d.rotation.set(0, -q.yaw, 0); d.scale.set(1, 1, 1);
    // tiny working wobble
    if (r.cleanT > 0) d.rotation.z = Math.sin(V.t * 31 + k) * 0.025;
    d.updateMatrix(); V.bodies.setMatrixAt(k, d.matrix); V.bodies.setColorAt(k, V.colors[k]);
    d.rotation.z = 0; d.updateMatrix(); V.leds.setMatrixAt(k, d.matrix);
    const blink = r.led === 1 ? (Math.sin(V.t * 18 + k) > -0.2 ? 1 : 0.15) : r.led === 2 ? (r.state === 'unload' ? (Math.sin(V.t * 30) > 0 ? 1 : 0.2) : 1) : 0.6;
    V.col.copy(V.ledCol[r.led] || V.ledCol[0]).multiplyScalar(blink); V.leds.setColorAt(k, V.col);
    // blob shadow
    d.position.set(q.x, q.y + 0.012, q.z); d.rotation.set(0, 0, 0); d.scale.set(0.95, 1, 0.95); d.updateMatrix();
    V.decals.setMatrixAt(k, d.matrix); V.decals.setColorAt(k, V.shadowCol);
    // dust trail: a puff behind the robot while it removes trash
    q.puffT -= dt;
    if (r.cleanT > 0 && q.puffT <= 0) {
      q.puffT = V.RC.puffEveryS; const p = q.pi; q.pi = (q.pi + 1) % V.PUFFS;
      q.px[p] = q.x - Math.sin(q.yaw) * 0.3 + (Math.random() - 0.5) * 0.12; q.pz[p] = q.z + Math.cos(q.yaw) * 0.3 + (Math.random() - 0.5) * 0.12; q.pa[p] = 0;
    }
    for (let p = 0; p < V.PUFFS; p++) {
      if (q.pa[p] >= life) continue;
      q.pa[p] += dt; const f = Math.max(0, 1 - q.pa[p] / life), s = 0.18 + 0.32 * (1 - f);
      d.position.set(q.px[p], q.y + 0.03 + 0.08 * (1 - f), q.pz[p]); d.scale.set(s * f, 1, s * f); d.updateMatrix();
      V.decals.setMatrixAt(nd, d.matrix); V.decals.setColorAt(nd, V.puffCol); nd++;
    }
  }
  V.bodies.count = n; V.leds.count = n; V.decals.count = nd;
  V.bodies.visible = V.leds.visible = n > 0; V.decals.visible = nd > 0;
  if (n > 0) {
    V.bodies.instanceMatrix.needsUpdate = true; V.leds.instanceMatrix.needsUpdate = true; V.decals.instanceMatrix.needsUpdate = true;
    V.bodies.instanceColor.needsUpdate = true; V.leds.instanceColor.needsUpdate = true; V.decals.instanceColor.needsUpdate = true;
  }
}
