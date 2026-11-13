// tools.js — hand brush (start tool), broom, ride-on vacuum cart: turning input into trash removal + bag, the view model,
// pickup / dust / sparkle juice, haptics. Owner: tools. Contract: docs/MIMARI.md §4.5, §4.9 (offers), §6.
// Notes, tunables and contract issues: docs/notlar/tools.md.
//
// Talks to trash / economy / player / world only through ctx.mods.<name>.<fn>() and to ui / audio only
// through bus events (tool:collect, tool:swing, tool:changed, tool:nozzle, tool:full, ui:toast).
// Hot paths do not allocate: every vector, payload and pool is created in init.
//
// Removal juice (items flying to the collector, dust per cleaned cell) is drawn by trash.js inside its own
// instanced meshes (MIMARI §4.3/§4.5, decided at integration). tools draws only what is tool-specific: the view
// model, the cart, broom stroke puffs and the valuable sparkle.
// Draw calls: view model 2-3 (brush: brush + dustpan + pile; broom: handle + head; hidden while driving),
// cart body + nozzle 2 (once bought), puffs/sparkle 1 (Points).
// v2: hand-picking was removed (owner: "the hand turned out silly"); the start tool is a small hand brush + dustpan
// that sweeps a narrow strip like a small broom. Brush and broom cap walking speed ONLY while they are sweeping
// (trash ahead and room in the bag), so moving between places is brisk.
// Tunables: CONFIG.tools (config.js is the single source).

const DEG = Math.PI / 180;
let ctx = null, THREE = null, bus = null, C = null, K = null, cam = null;
let types = [], VALUABLE = -1, NT = 6;

let cur = 'brush', prevTool = 'brush', cartMounted = false;
let warned = {};
function warnOnce(k, m) { if (warned[k]) return; warned[k] = true; console.warn('[tools] ' + m); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function wrapPi(a) { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; }
function P() { return ctx.mods.player; }
function T() { return ctx.mods.trash; }
function E() { return ctx.mods.economy; }
function W() { return ctx.mods.world; }

// reusable scratch
let v3a = null, v3b = null, m4 = null;
const aim = { x: 0, y: 0, z: 0, hit: false };
const fwd = { x: 0, z: 0 };
const col = { x: 0, z: 0, hit: false };
const cc = { x: 0, z: 0 };
let byOne = null; // Int32Array(NT) for single picks

// per-frame collect aggregation, one payload per tool (MIMARI §6: aggregated per frame per tool)
const agg = {};
function makeAgg(tool) { return { tool, units: 0, byType: new Int32Array(NT), x: 0, y: 0, z: 0, valuable: false }; }
function aggAdd(a, units, byType, x, y, z) {
  if (units <= 0) return;
  if (a.units === 0) { a.x = x; a.y = y; a.z = z; a.valuable = false; a.byType.fill(0); }
  a.units += units;
  for (let t = 0; t < NT; t++) a.byType[t] += byType[t];
  if (VALUABLE >= 0 && byType[VALUABLE] > 0) a.valuable = true;
}
const nozzleEv = { down: true };
const swingEv = { tool: 'broom', speed: 0 };
const changedEv = { id: 'brush' };
const fullEv = { tool: 'brush', container: 'bag' };
const toastEv = { key: 'bag_full', vars: null };

// ------------------------------------------------------------------------------------------ API
export function current() { return cur; }
export function available() {
  const out = ['brush'];
  const e = E();
  if (e.owned && e.owned('broom')) out.push('broom');
  if (e.owned && e.owned('cart')) out.push('cart');
  return out;
}
export function equip(id) {
  if (id === cur && !(id === 'cart' && !cartMounted)) return true;
  if (id === 'cart') { return tryEnterCart(); }
  if (id === 'hands') id = 'brush';   // v1 name
  if (id !== 'brush' && id !== 'broom') return false;
  if (id === 'broom' && !(E().owned && E().owned('broom'))) return false;
  if (cartMounted) return false; // get out of the cart first
  setTool(id, true);
  return true;
}

function setTool(id, anim) {
  cur = id;
  if (id !== 'cart') prevTool = id;
  applySpeedCap();
  showViewModel(anim);
  changedEv.id = id; bus.emit('tool:changed', changedEv);
}
let capNow = -1, capHold = 0;
// The sweep tools cap walking speed only while they sweep: trash on the strip ahead and room in the bag. Walking over
// the clean trail, or to the shop with a full bag, runs at full walking speed (v2). A short hold avoids flicker.
function sweepingAhead(ps) {
  if (space('bag') <= 0) return false;
  P().forward(fwd);
  const pr = K.sweepAheadProbeM || [0.5, 1.0];
  for (let i = 0; i < pr.length; i++) if (T().amountAt(ps.x + fwd.x * pr[i], ps.z + fwd.z * pr[i]) > 0) return true;
  // moving sideways or backwards: the strip is where you are heading
  const sp = ps.speed; if (sp > 0.5) { const vx = ps.vx / sp, vz = ps.vz / sp; if (T().amountAt(ps.x + vx * 0.8, ps.z + vz * 0.8) > 0) return true; }
  return false;
}
function applySpeedCap(dt, ps) {
  let want = null;
  if (cur === 'broom' || cur === 'brush') {
    if (ps && sweepingAhead(ps)) capHold = 0.25; else capHold -= dt || 0;
    if (capHold > 0) want = stat(cur === 'broom' ? 'broomSweepSpeed' : 'brushSweepSpeed');
  }
  if (want !== capNow) { capNow = want; P().setSpeedCap(want); }
}
function stat(name) {
  const e = E(), v = e.stat ? e.stat(name) : 0;
  if (v > 0) return v;
  switch (name) { // economy stub / not yet bought: level-0 values from config
    case 'broomWidth': return C.broom.widthM[0];
    case 'broomSweepSpeed': return C.broom.sweepSpeed[0];
    case 'brushWidth': return C.brush.widthM[0];
    case 'brushSweepSpeed': return C.brush.sweepSpeed[0];
    case 'cartNozzleWidth': return C.cart.nozzleWidthM[0];
    case 'cartCleanSpeed': return Array.isArray(C.cart.cleanSpeedMax) ? C.cart.cleanSpeedMax[0] : C.cart.cleanSpeedMax;
    default: return 0;
  }
}
function space(container) { const e = E(); return e.bagSpace ? e.bagSpace(container) : 0; }
function addToBag(units, byType, container) {
  if (units <= 0) return 0;
  const got = E().addToBag(units, byType, container);
  if (got < units) warnOnce('bag', 'economy.addToBag accepted ' + got + ' of ' + units + ' units (bagSpace said there was room)');
  return got;
}

// ------------------------------------------------------------------------------------------ init
export function init(c) {
  ctx = c; THREE = c.THREE; bus = c.bus; C = c.CONFIG; cam = c.camera;
  K = Object.assign({}, C.tools || {});
  types = (T().info && T().info().types) || C.trashTypes.map((t) => t.id);
  NT = Math.max(1, types.length); VALUABLE = types.indexOf('valuable');
  byOne = new Int32Array(NT);
  for (const t of ['brush', 'broom', 'cart']) agg[t] = makeAgg(t);
  v3a = new THREE.Vector3(); v3b = new THREE.Vector3(); m4 = new THREE.Matrix4();
  dustEvery = (C.feedback && C.feedback.dustPuffEveryS) || 0.3;

  buildViewModels();
  buildDust();

  bus.on('ui:tool', (e) => { if (e && e.id) equip(e.id); });
  bus.on('ui:offer', onOffer);
  bus.on('economy:purchased', onPurchased);
  bus.on('economy:bag', (e) => { if (e && (e.container || 'bag') === 'bag') bagFillTarget = e.cap > 0 ? e.units / e.cap : 0; });
  bus.on('player:dismount', onDismount);
  bus.on('game:ready', reconcile);
  showViewModel(false);
}

export function save() {
  const s = { v: 1, current: cartMounted ? prevTool : cur };
  if (cart) s.cart = { x: +cart.x.toFixed(3), z: +cart.z.toFixed(3), yaw: +cart.heading.toFixed(4), nozzle: cart.nozzleDown, mounted: cartMounted };
  return s;
}
let loaded = null;
export function load(d) { loaded = d && typeof d === 'object' ? d : null; }

// after every module loaded (economy loads after tools): spawn the cart, restore tool, re-mount
function reconcile() {
  const e = E(), d = loaded || {};
  if (e.owned && e.owned('cart') && !cart) {
    const c = d.cart;
    spawnCart(c && isFinite(+c.x) ? +c.x : null, c && isFinite(+c.z) ? +c.z : null, c && isFinite(+c.yaw) ? +c.yaw : null);
    if (c && c.nozzle === false) { cart.nozzleDown = false; cart.nozzleAnim = 0; }
  }
  const want = d.current === 'broom' && e.owned && e.owned('broom') ? 'broom' : 'brush';
  if (cur !== want && !cartMounted) setTool(want, false);
  else { applySpeedCap(0, P().pose()); showViewModel(false); }
  if (cart && d.cart && d.cart.mounted && !cartMounted) mountCart(true);
  loaded = null;
  syncBagLook();
}

function onPurchased(e) {
  if (!e) return;
  const id = e.id || '';
  if (id === 'broom') { if (!cartMounted) setTool('broom', true); }
  else if (id === 'cart') { if (!cart) spawnCart(null, null, null); }
  else if (id.indexOf('broom') === 0 && cur === 'broom') { capNow = -1; equipT = 0; }
  else if (id.indexOf('brush') === 0 && cur === 'brush') { capNow = -1; equipT = 0; }
  else if (id.indexOf('bag') === 0) { syncBagLook(); bagBounce = 1; if (cur === 'brush') equipT = 0; }
  else if (id.indexOf('cart') === 0 && cart) cartNozzleScale();
}
function onOffer(e) {
  if (!e) return;
  if (e.owner && e.owner !== 'tools') return;
  if (e.id === 'enter') tryEnterCart();
  else if (e.id === 'exit') { if (cartMounted) P().dismount(); }
  else if (e.id === 'nozzle') toggleNozzle();
}

// ------------------------------------------------------------------------------------------ update
let prevAction = false;
let fullT = 0; // time since the last "full" feedback
let bagBounce = 0, equipT = 1, bagFill = 0, bagFillTarget = 0, flickT = 0, flickPhase = 1, flickSide = 1;
let flickN = 0, strokePhase = 0, strokeT = 0, swingT = 0, dustEvery = 0.3, sweepActive = 0, lastSX = NaN, lastSZ = NaN;
let lookSway = 0, lookSwayY = 0;
const perf = { ms: 0, n: 0 };

export function update(dt) {
  const t0 = performance.now();
  const inp = P().input(), ps = P().pose();
  if (cartMounted && cur !== 'cart') cur = 'cart';
  fullT += dt;
  if (!cartMounted) applySpeedCap(dt, ps);
  offers(ps);

  if (dt > 0) {
    if (cartMounted) cartClean(dt);
    else if (cur === 'brush') brushUpdate(dt, inp, ps);
    else if (cur === 'broom') broomUpdate(dt, inp, ps);
  }
  prevAction = inp.action;
  if (cart && !cartMounted) cartIdle(dt);

  animViewModel(dt, inp, ps);
  updateDust(dt);
  if (cart) cartVisual(dt);
  flushCollect();
  perf.ms += performance.now() - t0; perf.n++;
}
// test helper (not in the contract): average JS ms per update since the last call
export function perfSample() { const r = perf.n ? perf.ms / perf.n : 0; perf.ms = 0; perf.n = 0; return r; }

function offers(ps) {
  // labels are STR keys (MIMARI §4.9); ui translates. In the cart both offers are always there: the nozzle on the
  // big button (90), getting out on ui's secondary button (80).
  if (cartMounted) {
    ctx.offer('nozzle', cart.nozzleDown ? 'act_nozzle_up' : 'act_nozzle_down', 90, 'tools');
    ctx.offer('exit', 'act_exit', 80, 'tools');
    return;
  }
  if (cart && cartDist(ps) <= C.cart.enterRadiusM) ctx.offer('enter', 'act_enter', 70, 'tools');
  if (cur === 'brush') ctx.offer('brush', space('bag') > 0 ? 'act_brush' : 'bag_full', 10, 'tools');
  else if (cur === 'broom') ctx.offer('sweep', space('bag') > 0 ? 'act_sweep' : 'bag_full', 5, 'tools');
}

function blocked(tool, container) {
  if (fullT < K.fullFeedbackS) return;
  fullT = 0;
  fullEv.tool = tool; fullEv.container = container; bus.emit('tool:full', fullEv);
  toastEv.key = container === 'tank' ? 'tank_full' : 'bag_full'; bus.emit('ui:toast', toastEv);
  ctx.haptic('full');
}

// ---- hand brush (v2 start tool): sweeps a narrow strip while walking (automatic), and, standing still with the
// button held, quick short flicks across the strip in front. Same feedback rules as the broom (collectResult).
function brushUpdate(dt, inp, ps) {
  P().forward(fwd);
  const B = C.brush, reachA = B.reachAheadM, cx = ps.x + fwd.x * reachA, cz = ps.z + fwd.z * reachA;
  const hw = stat('brushWidth') * 0.5, moving = ps.speed >= B.minMoveSpeedToSweep;
  sweepActive = Math.max(0, sweepActive - dt * 4);
  if (moving) {
    if (!(lastSX === lastSX)) { lastSX = cx; lastSZ = cz; }
    const room = space('bag');
    if (room <= 0) blocked('brush', 'bag');
    else collectResult(T().removeAlongSegment(lastSX, lastSZ, cx, cz, hw, room, 'brush'), 'brush');
    sweepActive = 1;
  }
  // the flick rhythm runs while sweeping (walking) or while the button is held standing still
  if (moving || inp.action) {
    flickT -= dt;
    if (flickT <= 0 || (inp.action && !prevAction)) {
      flickT = B.flickS; flickPhase = 0; flickSide = -flickSide;
      if (!moving) { // standing: one short flick across the strip in front, alternating sides
        const room = space('bag');
        if (room <= 0) blocked('brush', 'bag');
        else {
          const rx = -fwd.z * hw, rz = fwd.x * hw;
          let r = T().removeAlongSegment(cx - rx * flickSide, cz - rz * flickSide, cx + rx * flickSide + fwd.x * B.flickDepthM * 0.5, cz + rz * flickSide + fwd.z * B.flickDepthM * 0.5, B.flickDepthM, room, 'brush');
          // the strip in front is already clean: reach for the nearest dirty cell around the feet (never a held button
          // that silently does nothing, QA/integration D1); if nothing is within reach, the hint asks to walk
          if (!r || r.units <= 0) {
            const idx = T().nearestDirty ? T().nearestDirty(ps.x + fwd.x * 0.3, ps.z + fwd.z * 0.3, B.reachM || 1.3) : -1;
            if (idx >= 0) { T().cellCenter(idx, cc); r = T().removeAlongSegment(cc.x - rx * 0.4, cc.z - rz * 0.4, cc.x + rx * 0.4, cc.z + rz * 0.4, 0.3, room, 'brush'); }
          }
          collectResult(r, 'brush');
        }
        sweepActive = 1;
      }
      swingEv.tool = 'brush'; swingEv.speed = ps.speed; bus.emit('tool:swing', swingEv);
      if ((++flickN & 1) === 0) dustBurst(cx, T().surfaceAt(cx, cz) + 0.04, cz, 2, DUST_COL, 0.6);
    }
  }
  lastSX = cx; lastSZ = cz;
}

// ---- broom
function broomUpdate(dt, inp, ps) {
  P().forward(fwd);
  const reachA = C.broom.reachAheadM, cx = ps.x + fwd.x * reachA, cz = ps.z + fwd.z * reachA;
  const moving = ps.speed >= C.broom.minMoveSpeedToSweep;
  const hw = stat('broomWidth') * 0.5;
  sweepActive = Math.max(0, sweepActive - dt * 4);
  if (moving) {
    if (!(lastSX === lastSX)) { lastSX = cx; lastSZ = cz; }
    const room = space('bag');
    if (room <= 0) blocked('broom', 'bag');
    else {
      const r = T().removeAlongSegment(lastSX, lastSZ, cx, cz, hw, room, 'broom');
      collectResult(r, 'broom');
    }
    sweepActive = 1;
    strokeT += dt;
    if (strokeT >= dustEvery) {
      strokeT -= dustEvery;
      swingEv.tool = 'broom'; swingEv.speed = ps.speed; bus.emit('tool:swing', swingEv);
      dustBurst(cx, T().surfaceAt(cx, cz) + 0.06, cz, 4, DUST_COL, 1);
    }
  } else if (inp.action) {
    // standing still with the button held: short in-place strokes across the strip in front
    swingT -= dt;
    if (!prevAction || swingT <= 0) {
      swingT = K.swingInPlaceS;
      const room = space('bag');
      if (room <= 0) blocked('broom', 'bag');
      else {
        const rx = -fwd.z * hw, rz = fwd.x * hw, side = (strokePhase % (Math.PI * 2)) < Math.PI ? 1 : -1;
        const r = T().removeAlongSegment(cx - rx * side, cz - rz * side, cx + rx * side, cz + rz * side, K.swingDepthM, room, 'broom');
        collectResult(r, 'broom');
      }
      swingEv.tool = 'broom'; swingEv.speed = 0; bus.emit('tool:swing', swingEv);
      dustBurst(cx, T().surfaceAt(cx, cz) + 0.06, cz, 3, DUST_COL, 0.8);
    }
    sweepActive = 1;
  } else strokeT = dustEvery * 0.5;
  lastSX = cx; lastSZ = cz;
}

// shared by broom + cart: bag/tank, aggregation, flying copies, haptic
function collectResult(r, tool) {
  if (!r || r.units <= 0) return;
  addToBag(r.units, r.byType, tool === 'cart' ? 'tank' : 'bag');
  aggAdd(agg[tool], r.units, r.byType, r.n ? r.sx[0] : 0, r.n ? r.sy[0] : 0, r.n ? r.sz[0] : 0);
  for (let i = 0; i < r.n; i++) if (r.st[i] === VALUABLE) { sparkle(r.sx[i], r.sy[i] + 0.1, r.sz[i]); break; }   // rare valuables keep their sparkle
  ctx.haptic('light');
}

function flushCollect() {
  for (const k in agg) { const a = agg[k]; if (a.units > 0) { bus.emit('tool:collect', a); a.units = 0; } }
}

// ------------------------------------------------------------------------------------------ geometry helpers (init only)
function part(geo, color, x, y, z, rx, ry, rz, sx, sy, sz) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const e = new THREE.Euler(rx || 0, ry || 0, rz || 0);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(sx || 1, sy || 1, sz || 1));
  g.applyMatrix4(m);
  if (!g.attributes.normal) g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, ca = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  return g;
}
function merge(parts) {
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), colA = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); colA.set(g.attributes.color.array, o); o += g.attributes.position.count * 3; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  geo.computeBoundingSphere();
  return geo;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 8, 1);
function lumpy(g, amp, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(x * 91.7 + y * 47.3 + z * 13.1 + seed) * 43758.5453, f = 1 + ((h - Math.floor(h)) - 0.5) * amp;
    p.setXYZ(i, x * f, y * f, z * f);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------ view models
// Camera space: x right, y up, -z forward. The group is laid out for landscape; in portrait (narrow
// horizontal FOV) lateral offsets are pulled towards the centre so the tools stay in frame.
// Draw calls: brush 3 (right glove + hand brush; left glove + dustpan; the pile in the pan that grows with the bag),
// broom 2 (handle; bristle head that leans). v2: laid out for the wide default FOV (61 deg vertical in landscape):
// both tools sit low and to the sides, the centre of the screen stays free.
let vmRoot = null, brushG = null, brushM = null, panG = null, pileMesh = null, broomG = null, broomHead = null;
const BRUSH = { x: 0.33, y: -0.175, z: -0.46 }, PAN = { x: -0.38, y: -0.235, z: -0.56 }, BROOM = { x: 0.17, y: -0.35, z: -0.22 };
const BROOM_HEAD = { x: -0.15, y: 0.075, z: -0.55 }; // head relative to the broom pivot (the upper hand, below the frame)
// cylinder from a to b (init only)
function tube(a, b, r0, r1, color, seg) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg || 7, 1).toNonIndexed();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1)));
  return part(g, color);
}
function buildViewModels() {
  const root = P().viewModel && P().viewModel();
  if (!root) { warnOnce('vm', 'player.viewModel() returned nothing; tools draw no view model'); return; }
  vmRoot = new THREE.Group(); vmRoot.name = 'toolsVM'; root.add(vmRoot);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const GLOVE = '#ee8a2a', GLOVE_D = '#cf7420', SLEEVE = '#2f4a6b', BAND = '#e9e35a';

  // hand brush in the right glove. Origin = the grip; the short wooden handle points forward and down to a
  // block with stiff bristles (bristles down). A flick rotates the whole thing about the grip.
  const hb = [];
  hb.push(tube([0.03, -0.13, 0.14], [0.006, -0.012, 0.035], 0.032, 0.03, SLEEVE));
  hb.push(tube([0.012, -0.03, 0.06], [0.006, -0.016, 0.042], 0.032, 0.032, BAND));
  hb.push(part(box(0.066, 0.056, 0.074), GLOVE, 0, 0, 0, 0.25, 0.1, 0));
  hb.push(part(box(0.07, 0.02, 0.03), GLOVE_D, 0.0, 0.02, -0.022, 0.25, 0.1, 0));         // knuckles over the handle
  hb.push(tube([0.0, 0.0, 0.03], [-0.01, -0.02, -0.1], 0.012, 0.011, '#c98b4a'));         // handle
  hb.push(part(box(0.1, 0.028, 0.055), '#8a5a32', -0.012, -0.034, -0.13, 0.2, 0, 0));     // brush block
  hb.push(part(box(0.104, 0.008, 0.059), '#3f9a5a', -0.012, -0.018, -0.127, 0.2, 0, 0));  // painted top stripe
  for (let i = 0; i < 6; i++) hb.push(part(box(0.016, 0.04, 0.05), i & 1 ? '#d9b352' : '#e8c86a', -0.054 + i * 0.0168, -0.062, -0.136, 0.2 + (i % 3 - 1) * 0.06, 0, (i - 2.5) * 0.03));
  brushM = new THREE.Mesh(merge(hb), mat); brushM.frustumCulled = false;
  brushG = new THREE.Group(); brushG.add(brushM);
  // dustpan in the left glove: short handle towards the hand, a flat pan with a back wall and side lips, its open
  // lip facing forward-right where the brush flicks. The pile inside (separate mesh) grows with the bag.
  const dp = [];
  dp.push(tube([-0.03, -0.12, 0.13], [-0.004, -0.01, 0.035], 0.032, 0.03, SLEEVE));
  dp.push(tube([-0.01, -0.028, 0.058], [-0.004, -0.014, 0.04], 0.032, 0.032, BAND));
  dp.push(part(box(0.06, 0.054, 0.066), GLOVE, 0, 0, 0, 0.2, -0.2, 0));
  dp.push(tube([0.0, 0.0, 0.0], [0.012, -0.03, -0.075], 0.011, 0.011, '#2b6cb0'));        // handle
  const PC = '#3d86d6', PD = '#2b6cb0';
  dp.push(part(box(0.14, 0.006, 0.1), PC, 0.02, -0.04, -0.12, -0.12, 0, 0));              // pan floor
  dp.push(part(box(0.14, 0.045, 0.008), PD, 0.02, -0.02, -0.07, -0.12, 0, 0));            // back wall
  dp.push(part(box(0.006, 0.032, 0.1), PD, -0.05, -0.026, -0.12, -0.12, 0, 0));           // side lips
  dp.push(part(box(0.006, 0.032, 0.1), PD, 0.09, -0.026, -0.12, -0.12, 0, 0));
  const panM = new THREE.Mesh(merge(dp), mat); panM.frustumCulled = false;
  const pl = [];
  const TR = ['#e8e2d0', '#4fa3d9', '#c9483b', '#3f9a5a', '#6b6155', '#e8e2d0', '#4fa3d9'];
  for (let k = 0; k < 7; k++) pl.push(part(lumpy(new THREE.SphereGeometry(0.016 + (k % 3) * 0.004, 7, 5), 0.35, k), TR[k], -0.035 + (k % 4) * 0.025, 0.0, -0.01 - ((k / 4) | 0) * 0.03, 0, 0, 0, 1.2, 0.6, 1.1));
  pileMesh = new THREE.Mesh(merge(pl), mat); pileMesh.frustumCulled = false;
  pileMesh.position.set(0.02, -0.032, -0.11); pileMesh.rotation.set(-0.12, 0, 0);
  panG = new THREE.Group(); panG.add(panM); panG.add(pileMesh);
  const handsG = new THREE.Group(); handsG.name = 'brushVM'; handsG.add(brushG); handsG.add(panG);
  brushVM = handsG;
  vmRoot.add(handsG);

  // broom: the pivot (upper hand) is below the frame, the handle rises into view towards the head that rests
  // on the ground ahead. Swinging rotates the group about the pivot, so the head sweeps an arc.
  const H = BROOM_HEAD, br = [];
  br.push(tube([0.02, 0.0, 0.08], [H.x, H.y + 0.02, H.z], 0.013, 0.012, '#d9b25a'));
  br.push(tube([0.06, -0.05, 0.15], [0.0, 0.0, 0.0], 0.042, 0.038, SLEEVE));
  br.push(part(box(0.062, 0.058, 0.07), GLOVE, 0, 0, 0, 0.3, 0.2, 0));
  br.push(part(box(0.062, 0.058, 0.07), GLOVE, H.x * 0.35, H.y * 0.35, H.z * 0.35, 0.3, 0.2, 0));
  br.push(tube([H.x * 0.35 + 0.05, H.y * 0.35 - 0.06, H.z * 0.35 + 0.17], [H.x * 0.35, H.y * 0.35, H.z * 0.35], 0.04, 0.036, SLEEVE));
  br.push(part(box(0.32, 0.034, 0.065), '#8a5a32', H.x, H.y, H.z));
  br.push(part(box(0.3, 0.012, 0.068), '#3f6f9a', H.x, H.y + 0.022, H.z));
  broomG = new THREE.Group();
  const bm = new THREE.Mesh(merge(br), mat); bm.frustumCulled = false;
  const bb = [];
  for (let i = 0; i < 8; i++) bb.push(part(box(0.038, 0.075, 0.05), i & 1 ? '#c49a42' : '#ddb95c', -0.133 + i * 0.038, -0.052, 0, (i % 3 - 1) * 0.07, 0, (i % 2 - 0.5) * 0.08));
  broomHead = new THREE.Group(); broomHead.position.set(H.x, H.y - 0.01, H.z);
  const bristles = new THREE.Mesh(merge(bb), mat); bristles.frustumCulled = false;
  broomHead.add(bristles);
  broomG.add(bm); broomG.add(broomHead);
  vmRoot.add(broomG);
}
let brushVM = null;
function showViewModel(anim) {
  if (!vmRoot) return;
  brushVM.visible = cur === 'brush';
  broomG.visible = cur === 'broom';
  vmRoot.visible = !cartMounted;
  if (anim) equipT = 0;
}
function syncBagLook() {
  const cap = E().bagCapacity ? E().bagCapacity('bag') : C.bag.capacity[0];
  const u = E().bagUnits ? E().bagUnits('bag') : 0; bagFillTarget = cap > 0 ? u / cap : 0;
}
function vmDepthScale() { return ctx.view.portrait ? 1 : Math.tan(30 * DEG) / Math.tan(cam.fov * 0.5 * DEG); }
const backOut = (t) => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
function animViewModel(dt, inp, ps) {
  if (!vmRoot) return;
  const lifting = P().liftState ? P().liftState() !== 0 : false;
  vmRoot.visible = !cartMounted && !lifting;
  if (!vmRoot.visible) return;
  const rdt = dt > 0 ? dt : 0;
  const lat = ctx.view.portrait ? K.portraitLateral : 1; // keep hands inside the narrow portrait frame
  // portrait: push the whole view model a little further away (smaller, nearer the centre of the narrow frame)
  if (ctx.view.portrait) vmRoot.position.set(K.portraitOffset[0], K.portraitOffset[1], K.portraitOffset[2]); else vmRoot.position.set(0, 0, 0);
  // the view model was laid out for a 60 deg vertical FOV; main now derives a narrower one from the horizontal target in
  // landscape. Stretching depth by tan(30)/tan(fov/2) keeps every part at the same screen position and size.
  vmRoot.scale.z = vmDepthScale();
  // equip bounce: rises from below with a small overshoot
  equipT = Math.min(1, equipT + rdt / K.equipS);
  const eq = backOut(equipT), lower = (1 - eq) * -0.22;
  // look sway: the tool lags a hair behind fast look moves (weight), springs back
  const tx = clamp(-inp.lookDX * 0.0006, -0.03, 0.03), ty = clamp(inp.lookDY * 0.0006, -0.03, 0.03);
  const k = 1 - Math.exp(-rdt / 0.08);
  lookSway += (tx - lookSway) * k; lookSwayY += (ty - lookSwayY) * k;
  if (cur === 'brush') {
    // quick short flick: fast down-forward stroke (25 % of the beat), slower lift back; the pan tips to meet it
    flickPhase = Math.min(1, flickPhase + rdt / Math.max(0.08, C.brush.flickS));
    const f = flickPhase < 0.25 ? flickPhase / 0.25 : 1 - (flickPhase - 0.25) / 0.75, e = f * f * (3 - 2 * f);
    brushG.position.set(BRUSH.x * lat + lookSway - e * 0.03 * flickSide, BRUSH.y + lower + lookSwayY - e * 0.03, BRUSH.z - e * 0.05);
    brushG.rotation.set(0.05 - e * 0.5, 0.25 + e * 0.25 * flickSide, -0.2 - e * 0.1 * flickSide);
    bagBounce = Math.max(0, bagBounce - rdt / K.bagBounceS);
    bagFill += (bagFillTarget - bagFill) * (1 - Math.exp(-rdt / 0.15));
    const sq = Math.sin(bagBounce * Math.PI) * 0.12;
    panG.position.set(PAN.x * lat + lookSway, PAN.y + lower + lookSwayY - sq * 0.02 + e * 0.008, PAN.z);
    panG.rotation.set(0.45 + e * 0.08, 0.45, 0.1);
    const ps2 = 0.15 + 0.95 * Math.min(1, bagFill);
    pileMesh.scale.set(ps2 * (1 + sq), Math.max(0.05, ps2 * (1 - sq)), ps2);
    pileMesh.visible = bagFill > 0.02;
  } else if (cur === 'broom') {
    // stroke: the head swings across, bristles lean against the motion, rhythm follows walking speed
    const sweepSp = stat('broomSweepSpeed');
    const going = ps.speed >= C.broom.minMoveSpeedToSweep || (inp.action && sweepActive > 0);
    const rate = going ? Math.PI / Math.max(0.2, dustEvery) * (ps.speed > 0.3 ? clamp(ps.speed / sweepSp, 0.7, 1.2) : 1) : 0;
    strokePhase += rate * rdt;
    if (!going) strokePhase += (Math.round(strokePhase / Math.PI) * Math.PI - strokePhase) * (1 - Math.exp(-rdt / 0.12));
    const sw = Math.sin(strokePhase), vel = Math.cos(strokePhase) * (going ? 1 : 0);
    broomG.position.set(BROOM.x * lat + lookSway, BROOM.y + lower + lookSwayY, BROOM.z);
    broomG.rotation.set(-0.03 * Math.abs(sw), sw * 0.2, -sw * 0.05);
    broomHead.rotation.set(-vel * 0.2, 0, vel * 0.3);
  }
}

// ------------------------------------------------------------------------------------------ dust + sparkle (1 Points)
let dust = null, dN = 0, dPos = null, dCol = null, dA = null, dS = null, dVel = null, dLife = null, dAge = null, dGrow = null;
const DUST_COL = 0xb7ab94, GOLD_COL = 0xffd75a;
let rs = 1234567;
const rnd = () => ((rs = (Math.imul(rs, 1103515245) + 12345) | 0) >>> 0) / 4294967296;
function buildDust() {
  const n = K.dustPool;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  dPos = new Float32Array(n * 3); dCol = new Float32Array(n * 3); dA = new Float32Array(n); dS = new Float32Array(n);
  dVel = new Float32Array(n * 3); dLife = new Float32Array(n); dAge = new Float32Array(n); dGrow = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  const mk = (arr, k) => { const a = new THREE.BufferAttribute(arr, k); a.setUsage(THREE.DynamicDrawUsage); return a; };
  geo.setAttribute('position', mk(dPos, 3)); geo.setAttribute('color', mk(dCol, 3));
  geo.setAttribute('aAlpha', mk(dA, 1)); geo.setAttribute('aSize', mk(dS, 1));
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({ size: 0.3, map: tex, transparent: true, depthWrite: false, vertexColors: true, sizeAttenuation: true });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha;\nattribute float aSize;\nvarying float vA;')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize; vA = aAlpha;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vA;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vA );');
  };
  dust = new THREE.Points(geo, mat); dust.frustumCulled = false; dust.visible = false; dust.name = 'toolsDust';
  ctx.scene.add(dust);
}
function dustOne(x, y, z, colr, vx, vy, vz, life, size, grow) {
  if (!dust || dN >= K.dustPool) return;
  const i = dN++, q = i * 3;
  dPos[q] = x; dPos[q + 1] = y; dPos[q + 2] = z;
  dVel[q] = vx; dVel[q + 1] = vy; dVel[q + 2] = vz;
  dCol[q] = ((colr >> 16) & 255) / 255; dCol[q + 1] = ((colr >> 8) & 255) / 255; dCol[q + 2] = (colr & 255) / 255;
  dLife[i] = life; dAge[i] = 0; dS[i] = size; dGrow[i] = grow; dA[i] = 1;
}
function dustBurst(x, y, z, n, colr, strength) {
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2, sp = (0.25 + rnd() * 0.5) * strength;
    dustOne(x + (rnd() - 0.5) * 0.3, y, z + (rnd() - 0.5) * 0.3, colr, Math.cos(a) * sp, 0.25 + rnd() * 0.35 * strength, Math.sin(a) * sp, K.dustLifeS * (0.7 + rnd() * 0.6), 0.7 + rnd() * 0.6, 1.6);
  }
}
function sparkle(x, y, z) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    dustOne(x, y, z, GOLD_COL, Math.cos(a) * 0.6, 0.9 + rnd() * 0.6, Math.sin(a) * 0.6, 0.6, 0.35, -0.4);
  }
}
function updateDust(dt) {
  if (!dust) return;
  if (dN === 0) { if (dust.visible) { dust.visible = false; dust.geometry.setDrawRange(0, 0); } return; }
  for (let i = 0; i < dN; i++) {
    dAge[i] += dt;
    if (dAge[i] >= dLife[i]) {
      const l = --dN;
      if (i !== l) {
        const q = i * 3, ql = l * 3;
        for (let k = 0; k < 3; k++) { dPos[q + k] = dPos[ql + k]; dVel[q + k] = dVel[ql + k]; dCol[q + k] = dCol[ql + k]; }
        dLife[i] = dLife[l]; dAge[i] = dAge[l]; dS[i] = dS[l]; dGrow[i] = dGrow[l]; dA[i] = dA[l];
      }
      i--; continue;
    }
    const q = i * 3, u = dAge[i] / dLife[i];
    dPos[q] += dVel[q] * dt; dPos[q + 1] += dVel[q + 1] * dt; dPos[q + 2] += dVel[q + 2] * dt;
    const drag = 1 - Math.min(1, 2.5 * dt); dVel[q] *= drag; dVel[q + 2] *= drag; dVel[q + 1] = dVel[q + 1] * drag - (dGrow[i] < 0 ? 2.5 : 0.3) * dt;
    dS[i] = Math.max(0.05, dS[i] + dGrow[i] * dt);
    dA[i] = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * (dGrow[i] < 0 ? 1 : 0.65);
  }
  const g = dust.geometry;
  g.setDrawRange(0, dN); dust.visible = dN > 0;
  const at = g.attributes;
  at.position.updateRange.count = dN * 3; at.position.needsUpdate = true;
  at.color.updateRange.count = dN * 3; at.color.needsUpdate = true;
  at.aAlpha.updateRange.count = dN; at.aAlpha.needsUpdate = true;
  at.aSize.updateRange.count = dN; at.aSize.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------ cart
let cart = null, cartDesc = null;
function cartNozzleFront() { return C.cart.sizeM[1] * 0.5 + 0.18; }
// distance from the player to the cart's long axis (front and rear wheel-axle centres), so 'Bin' works the
// same from the side, the front or the back
function cartDist(ps) {
  const off = Math.max(0, C.cart.sizeM[1] * 0.5 - C.cart.sizeM[0] * 0.5), fx = Math.sin(cart.heading), fz = -Math.cos(cart.heading);
  const t = clamp((ps.x - cart.x) * fx + (ps.z - cart.z) * fz, -off, off), dx = cart.x + fx * t - ps.x, dz = cart.z + fz * t - ps.z;
  return Math.sqrt(dx * dx + dz * dz);
}
function spawnCart(x, z, yaw) {
  const pp = W().point && W().point('cartPark');
  const park = C.cart.parkPos;
  cart = {
    x: x != null ? x : (pp ? pp.x : park[0]), z: z != null ? z : (pp ? pp.z : park[1]),
    heading: yaw != null ? yaw : (pp && pp.yaw != null ? pp.yaw : C.cart.parkYawDeg * DEG),
    y: 0, speed: 0, yawVel: 0, nozzleDown: !!C.cart.nozzleStartsDown, nozzleAnim: C.cart.nozzleStartsDown ? 1 : 0,
    contact: false, lookIdle: 0, lastNX: NaN, lastNZ: NaN, dustT: 0, group: null, nozzle: null,
  };
  buildCartMesh();
  cartDesc = { id: 'cart', eyeHeight: C.cart.eyeHeightM, drive, object3D: cart.group, view: 'chase', exitSideM: C.cart.sizeM[0] * 0.5 + 0.6, teleport: cartTeleport };
  cartVisual(0);
}
function buildCartMesh() {
  const w = C.cart.sizeM[0], l = C.cart.sizeM[1];
  const GREEN = '#2f8f5b', WHITE = '#eef0ea', DARK = '#26292c', YEL = '#f2c230';
  const p = [];
  // chassis and hood (front = -z in local space, so heading math matches the player's yaw convention)
  p.push(part(box(w * 0.92, 0.32, l * 0.9), GREEN, 0, 0.42, 0.05));
  p.push(part(box(w * 0.94, 0.06, l * 0.92), WHITE, 0, 0.6, 0.05));
  p.push(part(box(w * 0.8, 0.22, 0.6), GREEN, 0, 0.72, -l * 0.3));
  // seat + back rest, steering column + wheel
  p.push(part(box(0.5, 0.1, 0.45), DARK, 0, 0.78, 0.25));
  p.push(part(box(0.5, 0.45, 0.08), DARK, 0, 1.0, 0.48));
  p.push(part(cyl(0.025, 0.025, 0.55, 6), DARK, 0, 0.95, -0.12, -0.6, 0, 0));
  p.push(part(cyl(0.16, 0.16, 0.035, 12), DARK, 0, 1.17, -0.24, -0.6, 0, 0));
  // rear collection tank (drum) with a band, hose to the nozzle
  p.push(part(cyl(0.42, 0.42, 0.75, 14), WHITE, 0, 0.98, l * 0.36, 0, 0, Math.PI / 2, 1, 1, 1));
  p.push(part(cyl(0.43, 0.43, 0.12, 14), GREEN, 0, 0.98, l * 0.36, 0, 0, Math.PI / 2));
  p.push(part(cyl(0.07, 0.07, 0.9, 8), '#59616a', w * 0.3, 0.52, -l * 0.42, 1.2, 0, 0));
  // wheels
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(part(cyl(0.27, 0.27, 0.2, 12), '#1b1c1e', sx * (w * 0.5 - 0.06), 0.27, sz * l * 0.32, 0, 0, Math.PI / 2));
  // beacon on a short pole
  p.push(part(cyl(0.02, 0.02, 0.5, 6), DARK, -0.35, 1.45, l * 0.36));
  p.push(part(cyl(0.07, 0.08, 0.1, 10), '#ffb300', -0.35, 1.73, l * 0.36));
  // stripes on the sides
  for (const sx of [-1, 1]) p.push(part(box(0.02, 0.08, l * 0.7), YEL, sx * w * 0.465, 0.45, 0.05));
  // contact shadow: a dark skirt just above the trash, a bit larger than the chassis (merged: no extra draw call)
  p.push(part(box(w * 1.12, 0.02, l * 1.04), '#151617', 0, 0.03, 0.02));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const body = new THREE.Mesh(merge(p), mat); body.name = 'cartBody';
  // nozzle: wide flat intake at the front (scaled to the nozzle width), moves up/down
  const np = [];
  np.push(part(box(1.8, 0.1, 0.4), '#3a3d40', 0, 0.07, 0));
  np.push(part(box(1.8, 0.05, 0.04), YEL, 0, 0.13, -0.2));
  np.push(part(box(0.25, 0.22, 0.25), '#3a3d40', w * 0.3 / 1, 0.2, 0.08));
  const nozzle = new THREE.Mesh(merge(np), mat); nozzle.name = 'cartNozzle';
  nozzle.position.set(0, 0, -cartNozzleFront() + 0.2);
  const grp = new THREE.Group(); grp.name = 'cart';
  grp.add(body); grp.add(nozzle);
  ctx.scene.add(grp);
  cart.group = grp; cart.nozzle = nozzle;
  cartNozzleScale();
}
function cartNozzleScale() { if (cart && cart.nozzle) cart.nozzle.scale.x = stat('cartNozzleWidth') / 1.8; }
function cartVisual(dt) {
  const rdt = dt > 0 ? dt : 0;
  const target = T().surfaceAt(cart.x, cart.z) * K.cartSurfaceRide;
  cart.y += (target - cart.y) * (rdt > 0 ? 1 - Math.exp(-rdt / 0.12) : 1);
  cart.nozzleAnim += ((cart.nozzleDown ? 1 : 0) - cart.nozzleAnim) * (rdt > 0 ? Math.min(1, rdt / K.cartNozzleMoveS * 2.5) : 1);
  const g = cart.group;
  g.position.set(cart.x, cart.y, cart.z);
  g.rotation.set(0, -cart.heading, 0);
  cart.nozzle.position.y = (1 - cart.nozzleAnim) * 0.3 - cart.y * 0.6;
}
function cartIdle(dt) { // parked: settle any leftover speed (after exit)
  if (dt <= 0 || Math.abs(cart.speed) < 1e-3) { cart.speed = 0; return; }
  const s = Math.max(0, Math.abs(cart.speed) - C.cart.brake * dt) * Math.sign(cart.speed);
  cart.speed = s; moveCart(dt);
}
function cartTeleport(x, z, yaw) { cart.x = x; cart.z = z; if (yaw != null && isFinite(yaw)) cart.heading = yaw; cart.speed = 0; cart.yawVel = 0; cart.lastNX = NaN; cartVisual(0); const ps = P().pose(); ps.x = x; ps.z = z; }

function tryEnterCart() {
  if (!cart || cartMounted) return false;
  if (cartDist(P().pose()) > C.cart.enterRadiusM) return false;
  return mountCart(false);
}
function mountCart(quiet) {
  cartDesc.view = cartViewMode();
  if (!P().mount(cartDesc)) return false;
  cartMounted = true; cart.lastNX = NaN; cart.lookIdle = 0;
  cur = 'cart'; P().setSpeedCap(null); capNow = null;
  showViewModel(false);
  if (!quiet) ctx.haptic('medium');
  changedEv.id = 'cart'; bus.emit('tool:changed', changedEv);
  return true;
}
function onDismount(e) {
  if (!cartMounted || !e || e.vehicle !== 'cart') return;
  cartMounted = false;
  setTool(prevTool === 'broom' && E().owned && E().owned('broom') ? 'broom' : 'brush', true);
}
function toggleNozzle() {
  if (!cart || !cartMounted) return;
  cart.nozzleDown = !cart.nozzleDown; cart.lastNX = NaN;
  nozzleEv.down = cart.nozzleDown; bus.emit('tool:nozzle', nozzleEv);
  ctx.haptic('light');
}
function controlMode() { const s = ctx.state.settings || {}; return s.steer === 'tank' || s.steer === 'camera' ? s.steer : (C.cart.controlMode || 'camera'); }
function cartViewMode() { return K.cartView === 'chase' || K.cartView === 'first' ? K.cartView : (controlMode() === 'tank' ? 'first' : 'chase'); }

// vehicle.drive(dt, input, pose): called by player.update while mounted. Moves pose.x/z (and pose.yaw in
// tank mode, where the view turns with the cart). Returns a bump strength 0..1 for the camera shake.
function drive(dt, inp, ps) {
  if (!cart) return 0;
  const CC = C.cart, mode = controlMode();
  cartDesc.view = cartViewMode();
  const vmax = cart.nozzleDown ? stat('cartCleanSpeed') : CC.topSpeed, turnMax = CC.turnRateDeg * DEG;
  const mx = inp.moveX, my = inp.moveY, m = Math.min(1, Math.sqrt(mx * mx + my * my));
  let tSpeed = 0, tYaw = 0;
  if (mode === 'tank') {
    tSpeed = my >= 0 ? my * vmax : my * K.cartReverseSpeed;
    tYaw = clamp(mx, -1, 1) * turnMax * (my < -0.1 ? -1 : 1);
  } else if (m > 0.05) {
    const desired = ps.yaw + Math.atan2(mx, my);
    let diff = wrapPi(desired - cart.heading);
    if (Math.abs(diff) <= K.cartReverseAngleDeg * DEG) {
      tYaw = clamp(diff * K.cartSteerGain, -turnMax, turnMax);
      tSpeed = m * vmax * Math.max(0.25, Math.cos(diff));
    } else {
      diff = wrapPi(desired + Math.PI - cart.heading);
      tYaw = clamp(diff * K.cartSteerGain, -turnMax, turnMax);
      tSpeed = -m * K.cartReverseSpeed * Math.max(0.3, Math.cos(diff));
    }
  }
  cart.yawVel += (tYaw - cart.yawVel) * (1 - Math.exp(-dt / K.cartTurnDampS));
  const dYaw = cart.yawVel * dt;
  cart.heading = wrapPi(cart.heading + dYaw);
  // speed: accelerate towards the target, brake harder when slowing or reversing
  const sp = cart.speed;
  const rate = (Math.sign(tSpeed) === Math.sign(sp) || sp === 0) && Math.abs(tSpeed) > Math.abs(sp) ? CC.accel : CC.brake;
  const d = tSpeed - sp, st = rate * dt;
  cart.speed = Math.abs(d) <= st ? tSpeed : sp + Math.sign(d) * st;
  // sub-steps: at 12 m/s a 50 ms frame moves 0.6 m; never move more than player.maxStepM * 2 between collision checks
  const maxStep = ((C.player && C.player.maxStepM) || 0.12) * 2, nSub = Math.min(8, Math.max(1, Math.ceil(Math.abs(cart.speed) * dt / maxStep)));
  let bump = 0;
  for (let k = 0; k < nSub; k++) bump = Math.max(bump, moveCart(dt / nSub));
  ps.x = cart.x; ps.z = cart.z;
  if (mode === 'tank') {
    ps.yaw = wrapPi(ps.yaw + dYaw);
    cart.lookIdle = inp.lookDX !== 0 || inp.lookDY !== 0 ? 0 : cart.lookIdle + dt;
    if (cart.lookIdle > 1) ps.yaw = wrapPi(ps.yaw + wrapPi(cart.heading - ps.yaw) * (1 - Math.exp(-dt / K.cartRecentreS)));
  }
  if (bump > 0) ctx.haptic('medium');
  return bump;
}
// integrate + collide (two circles along the body); returns bump strength on a fresh hit
function moveCart(dt) {
  const r = C.cart.sizeM[0] * 0.5, off = Math.max(0, C.cart.sizeM[1] * 0.5 - r);
  const fx = Math.sin(cart.heading), fz = -Math.cos(cart.heading);
  let x = cart.x + fx * cart.speed * dt, z = cart.z + fz * cart.speed * dt;
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const s = pass === 0 ? 1 : -1, cx = x + fx * off * s, cz = z + fz * off * s;
    W().collide(cx, cz, r, col);
    if (col.hit) { hit = true; x += col.x - cx; z += col.z - cz; }
  }
  W().collide(x, z, r, col); if (col.hit) { hit = true; x = col.x; z = col.z; }
  // robots are soft obstacles (QA #8: the cart drove through them): push the cart out of their circle and slow it
  const rs = E().robots ? E().robots() : null, rr = (C.robot.bodyRadiusM || 0.33) + 0.05;
  let soft = false;
  if (rs) for (let k = 0; k < rs.length; k++) {
    const rb = rs[k];
    for (let pass = -1; pass <= 1; pass++) {
      const cx = x + fx * off * pass, cz = z + fz * off * pass, dx = cx - rb.x, dz = cz - rb.z, d2 = dx * dx + dz * dz, R2 = r + rr;
      if (d2 < R2 * R2 && d2 > 1e-8) { const d = Math.sqrt(d2), push = (R2 - d) / d; x += dx * push; z += dz * push; soft = true; }
    }
  }
  if (soft) { cart.speed *= Math.max(0, 1 - 4 * dt); if (!W().isBlocked(x, z, r * 0.5)) { /* keep */ } else { x = cart.x; z = cart.z; } }
  let bump = 0;
  if (hit) {
    if (!cart.contact && Math.abs(cart.speed) > 1) { bump = Math.min(1, Math.abs(cart.speed) / C.cart.topSpeed); cart.speed *= C.cart.bumpSlowdown; }
    else cart.speed *= Math.max(0, 1 - 2 * dt);
  }
  cart.contact = hit;
  cart.x = x; cart.z = z;
  return bump;
}
function cartClean(dt) {
  const f = cartNozzleFront() - 0.05, nx = cart.x + Math.sin(cart.heading) * f, nz = cart.z - Math.cos(cart.heading) * f;
  if (!cart.nozzleDown || cart.nozzleAnim < 0.8) { cart.lastNX = NaN; return; }
  if (!(cart.lastNX === cart.lastNX)) { cart.lastNX = nx; cart.lastNZ = nz; }
  const ddx = nx - cart.lastNX, ddz = nz - cart.lastNZ;
  if (ddx * ddx + ddz * ddz < 1e-4) return;
  const room = space('tank');
  if (room <= 0) { blocked('cart', 'tank'); cart.lastNX = nx; cart.lastNZ = nz; return; }
  const r = T().removeAlongSegment(cart.lastNX, cart.lastNZ, nx, nz, stat('cartNozzleWidth') * 0.5, room, 'cart');
  collectResult(r, 'cart');
  cart.lastNX = nx; cart.lastNZ = nz;
}
// test helper (not in the contract)
export function cartState() { return cart ? { x: cart.x, z: cart.z, heading: cart.heading, speed: cart.speed, nozzleDown: cart.nozzleDown, mounted: cartMounted } : null; }
