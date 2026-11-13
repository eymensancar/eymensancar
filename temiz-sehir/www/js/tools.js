// tools.js — hands, broom, ride-on vacuum cart: turning input into trash removal + bag, the view model,
// pickup / dust / sparkle juice, haptics. Owner: tools. Contract: docs/MIMARI.md §4.5, §4.9 (offers), §6.
// Notes, tunables and contract issues: docs/notlar/tools.md.
//
// Talks to trash / economy / player / world only through ctx.mods.<name>.<fn>() and to ui / audio only
// through bus events (tool:collect, tool:swing, tool:changed, tool:nozzle, tool:full, ui:toast).
// Hot paths do not allocate: every vector, payload and pool is created in init.
//
// Draw calls (MIMARI §9: ≤ 6): view model 2 (hidden while driving), cart body (with contact shadow) + nozzle 2
// (only once bought, frustum-culled), flying items 1 (one InstancedMesh for all 7 shapes), dust/sparkle 1.

// Tunables that config.js does not define. A key of the same name in CONFIG.tools overrides the default.
const TL = {
  aimPickRadiusM: 0.35,     // hold-pick: pick radius around the crosshair hit
  tapPickRadiusM: 0.3,      // tap-pick: pick radius around the tap ray hit
  tapReachSlackM: 0.3,      // a tap may reach this much further than the hold reach (finger imprecision)
  coneStepM: 0.25, coneStepDeg: 10,
  flyPool: 40,              // flying item copies alive at once
  flyMaxPerFrame: 4,        // new flying copies per frame (broom/cart; the rest are counted, not drawn)
  flyArcM: 0.35,            // arc height for hand picks
  dustPool: 64,
  dustLifeS: 0.7,
  handReachS: 0.16,         // right-hand reach animation
  bagBounceS: 0.22,
  equipS: 0.22,             // tool appears with a bounce (PSIKOLOJI: in hand within 200 ms)
  broomStrokeS: 0.3,        // one stroke = one tool:swing + one dust puff (CONFIG.feedback.dustPuffEveryS wins)
  swingInPlaceS: 0.55,      // holding the button while standing: one in-place stroke per this
  swingDepthM: 0.22,        // half depth of an in-place stroke
  fullFeedbackS: 2.0,       // "bag full" toast/thump/haptic at most this often while trying to collect
  hapticMinGapMs: 66,       // ≤ 15 ticks/s (PSIKOLOJI §3)
  cartView: 'auto',         // 'auto' (camera mode → chase, tank mode → seat), 'chase', 'first'
  cartExitMaxSpeed: 0.4,    // 'exit' is offered only when the cart is (nearly) stopped, so 'nozzle' is reachable while driving
  cartReverseAngleDeg: 130, // camera mode: a stick direction further than this from the heading reverses
  cartReverseSpeed: 2.5,
  cartSteerGain: 3.0,       // yaw rate (rad/s) per rad of heading error, capped at CONFIG.cart.turnRateDeg
  cartTurnDampS: 0.12,      // yaw-rate smoothing: no sudden yaw snaps (PSIKOLOJI §4)
  cartRecentreS: 0.9,       // tank mode: free look springs back to the heading after 1 s without look input
  cartNozzleMoveS: 0.25,
  cartSurfaceRide: 0.85,    // the cart rides on this fraction of the trash surface height
};

const DEG = Math.PI / 180;
let ctx = null, THREE = null, bus = null, C = null, K = null, cam = null;
let types = [], VALUABLE = -1, NT = 6;

let cur = 'hands', prevTool = 'hands', cartMounted = false;
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
const changedEv = { id: 'hands' };
const fullEv = { tool: 'hands', container: 'bag' };
const toastEv = { key: 'bag_full', vars: null };

// ------------------------------------------------------------------------------------------ API
export function current() { return cur; }
export function available() {
  const out = ['hands'];
  const e = E();
  if (e.owned && e.owned('broom')) out.push('broom');
  if (e.owned && e.owned('cart')) out.push('cart');
  return out;
}
export function equip(id) {
  if (id === cur && !(id === 'cart' && !cartMounted)) return true;
  if (id === 'cart') { return tryEnterCart(); }
  if (id !== 'hands' && id !== 'broom') return false;
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
let capNow = -1;
function applySpeedCap() {
  if (cur === 'broom') { const s = stat('broomSweepSpeed'); if (s !== capNow) { capNow = s; P().setSpeedCap(s); } }
  else if (capNow !== null) { capNow = null; P().setSpeedCap(null); }
}
function stat(name) {
  const e = E(), v = e.stat ? e.stat(name) : 0;
  if (v > 0) return v;
  switch (name) { // economy stub / not yet bought: level-0 values from config
    case 'broomWidth': return C.broom.widthM[0];
    case 'broomSweepSpeed': return C.broom.sweepSpeed[0];
    case 'handsReach': return C.hands.reachM;
    case 'cartNozzleWidth': return C.cart.nozzleWidthM[0];
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
  K = {}; const o = C.tools || {};
  for (const k in TL) K[k] = o[k] != null ? o[k] : TL[k];
  types = (T().info && T().info().types) || C.trashTypes.map((t) => t.id);
  NT = Math.max(1, types.length); VALUABLE = types.indexOf('valuable');
  byOne = new Int32Array(NT);
  for (const t of ['hands', 'broom', 'cart']) agg[t] = makeAgg(t);
  v3a = new THREE.Vector3(); v3b = new THREE.Vector3(); m4 = new THREE.Matrix4();
  dustEvery = (C.feedback && C.feedback.dustPuffEveryS) || K.broomStrokeS;

  buildViewModels();
  buildFly();
  buildDust();

  bus.on('input:tap', (e) => { if (e) { tapPending = true; tapX = e.x; tapY = e.y; } });
  bus.on('ui:tool', (e) => { if (e && e.id) equip(e.id); });
  bus.on('ui:offer', onOffer);
  bus.on('economy:purchased', onPurchased);
  bus.on('economy:sold', (e) => { if (e && e.by !== 'robot') haptic(H_MED); });
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
  const want = d.current === 'broom' && e.owned && e.owned('broom') ? 'broom' : 'hands';
  if (cur !== want && !cartMounted) setTool(want, false);
  else { applySpeedCap(); showViewModel(false); }
  if (cart && d.cart && d.cart.mounted && !cartMounted) mountCart(true);
  loaded = null;
  syncBagLook();
}

function onPurchased(e) {
  if (!e) return;
  haptic(H_HEAVY);
  const id = e.id || '';
  if (id === 'broom') { if (!cartMounted) setTool('broom', true); }
  else if (id === 'cart') { if (!cart) spawnCart(null, null, null); }
  else if (id.indexOf('broom') === 0 && cur === 'broom') { applySpeedCap(); equipT = 0; }
  else if (id.indexOf('bag') === 0) { syncBagLook(); bagBounce = 1; if (cur === 'hands') equipT = 0; }
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
let prevAction = false, holdT = 0, tapPending = false, tapX = 0, tapY = 0, tapCool = 0;
let fullT = 0; // time since the last "full" feedback
let reachT = 1, bagBounce = 0, equipT = 1, bagFill = 0, bagFillTarget = 0;
let strokePhase = 0, strokeT = 0, swingT = 0, dustEvery = 0.3, sweepActive = 0, lastSX = NaN, lastSZ = NaN;
let lookSway = 0, lookSwayY = 0;
const perf = { ms: 0, n: 0 };

export function update(dt) {
  const t0 = performance.now();
  const inp = P().input(), ps = P().pose();
  if (cartMounted && cur !== 'cart') cur = 'cart';
  fullT += dt; tapCool -= dt;
  applySpeedCap();
  offers(ps);

  if (dt > 0) {
    if (cartMounted) cartClean(dt);
    else if (cur === 'hands') handsUpdate(dt, inp, ps);
    else if (cur === 'broom') broomUpdate(dt, inp, ps);
    if (!cartMounted && cur !== 'hands') tapPending = false;
  }
  prevAction = inp.action;
  if (cart && !cartMounted) cartIdle(dt);

  animViewModel(dt, inp, ps);
  updateFly(dt);
  updateDust(dt);
  if (cart) cartVisual(dt);
  flushCollect();
  perf.ms += performance.now() - t0; perf.n++;
}
// test helper (not in the contract): average JS ms per update since the last call
export function perfSample() { const r = perf.n ? perf.ms / perf.n : 0; perf.ms = 0; perf.n = 0; return r; }

function offers(ps) {
  const t = ctx.t;
  if (cartMounted) {
    ctx.offer('nozzle', t(cart.nozzleDown ? 'act_nozzle_up' : 'act_nozzle_down'), 80, 'tools');
    if (Math.abs(cart.speed) < K.cartExitMaxSpeed) ctx.offer('exit', t('act_exit'), 90, 'tools');
    return;
  }
  if (cart && cartDist(ps) <= C.cart.enterRadiusM) ctx.offer('enter', t('act_enter'), 70, 'tools');
  if (cur === 'hands') ctx.offer('pick', t(space('bag') > 0 ? 'act_pick' : 'bag_full'), 10, 'tools');
  else if (cur === 'broom') ctx.offer('sweep', t(space('bag') > 0 ? 'act_sweep' : 'bag_full'), 5, 'tools');
}

function blocked(tool, container) {
  if (fullT < K.fullFeedbackS) return;
  fullT = 0;
  fullEv.tool = tool; fullEv.container = container; bus.emit('tool:full', fullEv);
  toastEv.key = container === 'tank' ? 'tank_full' : 'bag_full'; bus.emit('ui:toast', toastEv);
  haptic(H_FULL);
}

// ---- hands
function handsUpdate(dt, inp, ps) {
  const pressed = inp.action && !prevAction;
  if (pressed) { reachT = 0; holdT = 0; }
  if (inp.action) {
    holdT -= dt;
    if (pressed || holdT <= 0) { if (!pressed) holdT += C.hands.holdIntervalS; else holdT = C.hands.holdIntervalS; grabNearest(ps); }
  }
  if (tapPending) {
    tapPending = false;
    if (tapCool <= 0) { tapCool = C.hands.tapCooldownS; tapPick(ps); }
  }
}
function grabNearest(ps) {
  if (space('bag') <= 0) { blocked('hands', 'bag'); return; }
  const reach = stat('handsReach');
  // 1) the item under the crosshair, if within reach
  P().aimPoint(reach + 2, aim);
  if (aim.hit) {
    const dx = aim.x - ps.x, dz = aim.z - ps.z;
    if (dx * dx + dz * dz <= reach * reach && T().amountAt(aim.x, aim.z) > 0 && doPick(aim.x, aim.z, K.aimPickRadiusM)) return;
  }
  // 2) the nearest dirty spot in the cone in front (CONFIG.hands.coneDeg), nearest first
  P().forward(fwd);
  const half = C.hands.coneDeg * 0.5 * DEG, yaw = Math.atan2(fwd.x, -fwd.z), stepA = K.coneStepDeg * DEG;
  for (let d = K.coneStepM; d <= reach + 1e-6; d += K.coneStepM) {
    for (let k = 0; ; k++) {
      const a = (k & 1 ? -1 : 1) * Math.ceil(k / 2) * stepA; // 0, +10°, -10°, +20°, ...
      if (Math.abs(a) > half + 1e-6) break;
      const x = ps.x + Math.sin(yaw + a) * d, z = ps.z - Math.cos(yaw + a) * d;
      if (T().amountAt(x, z) > 0 && doPick(x, z, 0.3)) return;
    }
  }
}
function tapPick(ps) {
  if (space('bag') <= 0) { blocked('hands', 'bag'); reachT = 0; return; }
  // ray through the tap point
  const v = ctx.view;
  v3a.set((tapX / v.w) * 2 - 1, -(tapY / v.h) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
  const reach = stat('handsReach') + K.tapReachSlackM;
  const ox = cam.position.x, oy = cam.position.y, oz = cam.position.z, dx = v3a.x, dy = v3a.y, dz = v3a.z;
  if (dy >= -1e-4) return;
  const maxT = Math.sqrt(reach * reach + oy * oy) + 0.5;
  let prev = 0, hitT = -1;
  for (let t = 0.08; t <= maxT; t += 0.06) {
    const x = ox + dx * t, z = oz + dz * t;
    if (W().isBlocked(x, z, 0)) return;
    if (oy + dy * t <= T().surfaceAt(x, z)) {
      let a = prev, b = t;
      for (let k = 0; k < 6; k++) { const m = (a + b) * 0.5; if (oy + dy * m <= T().surfaceAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
      hitT = b; break;
    }
    prev = t;
  }
  if (hitT < 0) return;
  const hx = ox + dx * hitT, hz = oz + dz * hitT, ddx = hx - ps.x, ddz = hz - ps.z;
  if (ddx * ddx + ddz * ddz > reach * reach) return;
  reachT = 0;
  doPick(hx, hz, K.tapPickRadiusM);
}
// remove the single top item nearest (x, z); bag + juice. true if something was picked
function doPick(x, z, r) {
  const p = T().pick(x, z, r, 'hands');
  if (!p) return false;
  byOne.fill(0); if (p.type >= 0 && p.type < NT) byOne[p.type] = 1;
  addToBag(1, byOne, 'bag');
  aggAdd(agg.hands, 1, byOne, p.x, p.y, p.z);
  spawnFly(p.x, p.y + 0.03, p.z, p.shape, p.color, p.scale, p.yaw, 0);
  dustBurst(p.x, p.y + 0.05, p.z, 2, DUST_COL, 0.5);
  if (p.type === VALUABLE) sparkle(p.x, p.y + 0.1, p.z);
  reachT = 0;
  haptic(H_TICK);
  return true;
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
      collectResult(r, 'broom', 1);
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
        collectResult(r, 'broom', 1);
      }
      swingEv.tool = 'broom'; swingEv.speed = 0; bus.emit('tool:swing', swingEv);
      dustBurst(cx, T().surfaceAt(cx, cz) + 0.06, cz, 3, DUST_COL, 0.8);
    }
    sweepActive = 1;
  } else strokeT = dustEvery * 0.5;
  lastSX = cx; lastSZ = cz;
}

// shared by broom + cart: bag/tank, aggregation, flying copies, haptic
function collectResult(r, tool, kind) {
  if (!r || r.units <= 0) return;
  addToBag(r.units, r.byType, tool === 'cart' ? 'tank' : 'bag');
  const n = Math.min(r.n, K.flyMaxPerFrame);
  aggAdd(agg[tool], r.units, r.byType, r.n ? r.sx[0] : 0, r.n ? r.sy[0] : 0, r.n ? r.sz[0] : 0);
  for (let i = 0; i < n; i++) spawnFly(r.sx[i], r.sy[i] + 0.03, r.sz[i], r.ss[i], r.sc[i], 1, i * 1.7, kind);
  for (let i = 0; i < r.n; i++) if (r.st[i] === VALUABLE) { sparkle(r.sx[i], r.sy[i] + 0.1, r.sz[i]); break; }
  haptic(H_TICK);
}

function flushCollect() {
  for (const k in agg) { const a = agg[k]; if (a.units > 0) { bus.emit('tool:collect', a); a.units = 0; } }
}

// ------------------------------------------------------------------------------------------ haptics
const H_TICK = 1, H_MED = 2, H_HEAVY = 3, H_FULL = 4;
const VIB = [0, 8, 22, [18, 40, 28], [30, 60, 30]];
const CAP_STYLE = ['', 'LIGHT', 'MEDIUM', 'HEAVY', 'MEDIUM'];
let lastHaptic = -1e9;
function haptic(kind) {
  const s = ctx.state.settings || {};
  if (s.haptics === false) return;
  const now = performance.now();
  if (now - lastHaptic < K.hapticMinGapMs) return;
  lastHaptic = now;
  const cap = window.Capacitor, H = cap && cap.Plugins && cap.Plugins.Haptics;
  try {
    if (H && H.impact) { H.impact({ style: CAP_STYLE[kind] }); return; }
    if (navigator.vibrate) navigator.vibrate(VIB[kind]);
  } catch (e) { /* no haptics here */ }
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
// horizontal FOV) lateral offsets are pulled towards the centre so the hands stay in frame.
// Draw calls: hands 2 (reaching right glove; left glove + bag), broom 2 (handle; bristle head that leans).
let vmRoot = null, handsG = null, handR = null, bagMesh = null, bagCol = null, bagV0 = 0, bagV1 = 0, broomG = null, broomHead = null;
const HAND_R = { x: 0.15, y: -0.13, z: -0.4 }, BAG = { x: -0.17, y: -0.075, z: -0.43 }, BROOM = { x: 0.17, y: -0.35, z: -0.22 };
const BROOM_HEAD = { x: -0.15, y: 0.075, z: -0.55 }; // head relative to the broom pivot (the upper hand, below the frame)
const BAG_TINTS = ['#d6e8f0', '#b89a6a', '#9c7f52', '#3f6f9a'];
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

  // right glove, palm down, fingers forward: sleeve, reflective band, cuff, palm, 4 fingers, thumb. Origin = palm.
  const hp = [];
  hp.push(tube([0.035, -0.12, 0.13], [0.012, -0.018, 0.05], 0.031, 0.029, SLEEVE));
  hp.push(tube([0.016, -0.021, 0.062], [0.009, -0.012, 0.042], 0.031, 0.031, BAND));
  hp.push(tube([0.01, -0.013, 0.043], [0.0, 0.0, 0.012], 0.029, 0.027, GLOVE_D));
  hp.push(part(box(0.072, 0.028, 0.072), GLOVE, 0, 0, -0.018, -0.12, 0, 0));
  for (let f = 0; f < 4; f++) { const x = -0.026 + f * 0.0175; hp.push(tube([x, -0.002, -0.05], [x * 1.08, -0.026, -0.098 + Math.abs(f - 1.5) * 0.006], 0.0095, 0.0085, f & 1 ? GLOVE_D : GLOVE, 6)); }
  hp.push(tube([-0.03, -0.006, -0.01], [-0.052, -0.02, -0.05], 0.011, 0.0095, GLOVE, 6));
  handR = new THREE.Mesh(merge(hp), mat); handR.frustumCulled = false;
  // left glove holding a bag by its knot; bag vertices are recoloured per bag level (syncBagLook)
  const bp = [];
  bp.push(tube([-0.03, -0.12, 0.12], [-0.006, -0.008, 0.035], 0.031, 0.029, SLEEVE));
  bp.push(tube([-0.009, -0.024, 0.047], [-0.006, -0.008, 0.035], 0.031, 0.031, BAND));
  bp.push(part(box(0.058, 0.05, 0.06), GLOVE, 0, 0, 0, 0.2, 0.3, 0));
  bp.push(tube([0.0, -0.01, -0.005], [0.003, -0.06, -0.005], 0.008, 0.022, '#ffffff', 6));
  let nv = 0; for (const g of bp) nv += g.attributes.position.count;
  bagV0 = nv;
  bp.push(part(lumpy(new THREE.SphereGeometry(0.075, 10, 8), 0.3, 3), '#ffffff', 0.004, -0.115, -0.004, 0, 0, 0, 1.05, 1.15, 0.92));
  for (let k = 0; k < 3; k++) bp.push(tube([0.004, -0.06, -0.004], [0.004 + (k - 1) * 0.03, -0.075, -0.004 + (k === 1 ? -0.03 : 0.012)], 0.004, 0.003, '#ffffff', 4));
  const bagGeo = merge(bp); bagV1 = bagGeo.attributes.position.count;
  bagMesh = new THREE.Mesh(bagGeo, mat); bagMesh.frustumCulled = false;
  bagCol = bagGeo.attributes.color;
  bagV0 -= bp[3].attributes.position.count; // the knot takes the bag colour too
  handsG = new THREE.Group(); handsG.add(handR); handsG.add(bagMesh);
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
function showViewModel(anim) {
  if (!vmRoot) return;
  handsG.visible = cur === 'hands';
  broomG.visible = cur === 'broom';
  vmRoot.visible = !cartMounted;
  if (anim) equipT = 0;
}
function syncBagLook() {
  if (!bagCol) return;
  let lvl = 0; const caps = C.bag.capacity, cap = E().bagCapacity ? E().bagCapacity('bag') : caps[0];
  for (let i = 0; i < caps.length; i++) if (cap >= caps[i]) lvl = i;
  const c = new THREE.Color(BAG_TINTS[Math.min(lvl, BAG_TINTS.length - 1)]), a = bagCol.array; // purchase-time only
  for (let i = bagV0; i < bagV1; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  bagCol.needsUpdate = true;
  const u = E().bagUnits ? E().bagUnits('bag') : 0; bagFillTarget = cap > 0 ? u / cap : 0;
}
const backOut = (t) => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
function animViewModel(dt, inp, ps) {
  if (!vmRoot) return;
  const lifting = P().liftState ? P().liftState() !== 0 : false;
  vmRoot.visible = !cartMounted && !lifting;
  if (!vmRoot.visible) return;
  const rdt = dt > 0 ? dt : 0;
  const lat = ctx.view.portrait ? 0.62 : 1; // keep hands inside the narrow portrait frame
  // portrait: push the whole view model a little further away (smaller, nearer the centre of the narrow frame)
  if (ctx.view.portrait) vmRoot.position.set(0, -0.06, -0.24); else vmRoot.position.set(0, 0, 0);
  // equip bounce: rises from below with a small overshoot
  equipT = Math.min(1, equipT + rdt / K.equipS);
  const eq = backOut(equipT), lower = (1 - eq) * -0.22;
  // look sway: the tool lags a hair behind fast look moves (weight), springs back
  const tx = clamp(-inp.lookDX * 0.0006, -0.03, 0.03), ty = clamp(inp.lookDY * 0.0006, -0.03, 0.03);
  const k = 1 - Math.exp(-rdt / 0.08);
  lookSway += (tx - lookSway) * k; lookSwayY += (ty - lookSwayY) * k;
  if (cur === 'hands') {
    reachT = Math.min(1, reachT + rdt / K.handReachS);
    const r = Math.sin(reachT * Math.PI); // out and back
    handR.position.set(HAND_R.x * lat + lookSway - r * 0.04, HAND_R.y + lower + lookSwayY - r * 0.06, HAND_R.z - r * 0.12);
    handR.rotation.set(-r * 0.5, 0, 0);
    bagBounce = Math.max(0, bagBounce - rdt / K.bagBounceS);
    bagFill += (bagFillTarget - bagFill) * (1 - Math.exp(-rdt / 0.15));
    const s = 0.86 + 0.26 * bagFill, sq = Math.sin(bagBounce * Math.PI) * 0.12;
    bagMesh.position.set(BAG.x * lat + lookSway, BAG.y + lower + lookSwayY - sq * 0.02, BAG.z);
    bagMesh.scale.set(s * (1 + sq), s * (1 - sq), s * (1 + sq));
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

// ------------------------------------------------------------------------------------------ flying items
// One InstancedMesh holding all 7 item shapes merged; per instance `iShape` selects which shape's
// vertices are kept (the others collapse to a point). 1 draw call for every flying item.
let fly = null, flyGeo = null, flyShapeAttr = null, flyN = 0, nShapes = 1;
const FLY = { x0: null, y0: null, z0: null, t: null, dur: null, shape: null, kind: null, spin: null, s: null, col: null };
function buildFly() {
  const n = K.flyPool, tr = T();
  const parts = [];
  nShapes = (tr.info && tr.info().shapes && tr.info().shapes.length) || 0;
  for (let s = 0; s < nShapes; s++) {
    let g = tr.itemGeometry ? tr.itemGeometry(s) : null;
    if (!g) { parts.length = 0; break; }
    g = g.index ? g.toNonIndexed() : g.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    const cnt = g.attributes.position.count;
    if (!g.attributes.color) { const ca = new Float32Array(cnt * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); }
    g.setAttribute('aShape', new THREE.BufferAttribute(new Float32Array(cnt).fill(s), 1));
    parts.push(g);
  }
  if (!parts.length) { // trash stub: a small box stands in for every shape
    nShapes = 1;
    const g = new THREE.BoxGeometry(0.12, 0.08, 0.1).toNonIndexed();
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    g.setAttribute('aShape', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    parts.push(g);
  }
  let cnt = 0; for (const g of parts) cnt += g.attributes.position.count;
  const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), cl = new Float32Array(cnt * 3), sh = new Float32Array(cnt);
  let o = 0;
  for (const g of parts) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); cl.set(g.attributes.color.array, o * 3); sh.set(g.attributes.aShape.array, o); o += c; }
  flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  flyGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  flyGeo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  flyGeo.setAttribute('aShape', new THREE.BufferAttribute(sh, 1));
  flyShapeAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  flyShapeAttr.setUsage(THREE.DynamicDrawUsage);
  flyGeo.setAttribute('iShape', flyShapeAttr);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aShape;\nattribute float iShape;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (abs(aShape - iShape) > 0.5) transformed = vec3(0.0);');
  };
  fly = new THREE.InstancedMesh(flyGeo, mat, n);
  fly.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fly.setColorAt(0, new THREE.Color(1, 1, 1));
  fly.instanceColor.setUsage(THREE.DynamicDrawUsage);
  fly.count = 0; fly.visible = false; fly.frustumCulled = false; fly.name = 'toolsFly';
  ctx.scene.add(fly);
  for (const k of ['x0', 'y0', 'z0', 't', 'dur', 'spin', 's']) FLY[k] = new Float32Array(n);
  FLY.shape = new Uint8Array(n); FLY.kind = new Uint8Array(n); FLY.col = new Uint32Array(n);
}
function spawnFly(x, y, z, shape, color, scale, spin, kind) {
  if (!fly || flyN >= K.flyPool) return;
  const i = flyN++;
  FLY.x0[i] = x; FLY.y0[i] = y; FLY.z0[i] = z; FLY.t[i] = 0;
  FLY.dur[i] = (C.feedback && C.feedback.pickupArcS) || 0.25;
  FLY.shape[i] = shape >= 0 && shape < nShapes ? shape : 0; FLY.kind[i] = kind; FLY.spin[i] = spin || 0; FLY.s[i] = scale || 1; FLY.col[i] = color >>> 0;
}
// where the flying items go: 0 = hands bag, 1 = broom head, 2 = cart intake (world)
const anchor = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
function updateAnchors() {
  const lat = ctx.view.portrait ? 0.62 : 1;
  const ox = vmRoot ? vmRoot.position.y : 0, oz = vmRoot ? vmRoot.position.z : 0;
  v3a.set(BAG.x * lat, BAG.y - 0.04 + ox, BAG.z + oz).applyMatrix4(cam.matrixWorld); anchor[0].x = v3a.x; anchor[0].y = v3a.y; anchor[0].z = v3a.z;
  v3a.set(BROOM.x * lat + BROOM_HEAD.x, BROOM.y + BROOM_HEAD.y + 0.02 + ox, BROOM.z + BROOM_HEAD.z + oz).applyMatrix4(cam.matrixWorld); anchor[1].x = v3a.x; anchor[1].y = v3a.y; anchor[1].z = v3a.z;
  if (cart) { const f = cartNozzleFront(); anchor[2].x = cart.x + Math.sin(cart.heading) * (f - 0.25); anchor[2].z = cart.z - Math.cos(cart.heading) * (f - 0.25); anchor[2].y = cart.y + 0.35; }
}
const tmpCol = { r: 0, g: 0, b: 0 };
function updateFly(dt) {
  if (!fly) return;
  if (flyN === 0) { if (fly.visible) { fly.visible = false; fly.count = 0; } return; }
  updateAnchors();
  const m = fly.instanceMatrix.array, ca = fly.instanceColor.array, sa = flyShapeAttr.array, arc = K.flyArcM;
  for (let i = 0; i < flyN; i++) {
    FLY.t[i] += dt;
    if (FLY.t[i] >= FLY.dur[i]) { // swap-remove
      const l = --flyN;
      if (i !== l) for (const k in FLY) FLY[k][i] = FLY[k][l];
      i--; continue;
    }
  }
  for (let i = 0; i < flyN; i++) {
    const u = FLY.t[i] / FLY.dur[i], e = u * u * (3 - 2 * u), a = anchor[FLY.kind[i]];
    let x = FLY.x0[i] + (a.x - FLY.x0[i]) * e, y = FLY.y0[i] + (a.y - FLY.y0[i]) * e, z = FLY.z0[i] + (a.z - FLY.z0[i]) * e;
    if (FLY.kind[i] === 2) { // spiral into the intake
      const ang = FLY.spin[i] + u * 9, rr = (1 - u) * 0.25;
      x += Math.cos(ang) * rr; z += Math.sin(ang) * rr; y += Math.sin(u * Math.PI) * 0.25;
    } else y += Math.sin(u * Math.PI) * arc * (FLY.kind[i] === 0 ? 1 : 0.6);
    const s = FLY.s[i] * (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45) * 0.95, yaw = FLY.spin[i] + u * 7, tilt = u * 5;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt), q = i * 16;
    m[q] = cy * s; m[q + 1] = 0; m[q + 2] = -sy * s; m[q + 3] = 0;
    m[q + 4] = sy * sx * s; m[q + 5] = cx * s; m[q + 6] = cy * sx * s; m[q + 7] = 0;
    m[q + 8] = sy * cx * s; m[q + 9] = -sx * s; m[q + 10] = cy * cx * s; m[q + 11] = 0;
    m[q + 12] = x; m[q + 13] = y; m[q + 14] = z; m[q + 15] = 1;
    const c = FLY.col[i];
    tmpCol.r = ((c >> 16) & 255) / 255; tmpCol.g = ((c >> 8) & 255) / 255; tmpCol.b = (c & 255) / 255;
    ca[i * 3] = tmpCol.r; ca[i * 3 + 1] = tmpCol.g; ca[i * 3 + 2] = tmpCol.b;
    sa[i] = FLY.shape[i];
  }
  fly.count = flyN; fly.visible = flyN > 0;
  fly.instanceMatrix.updateRange.count = flyN * 16; fly.instanceMatrix.needsUpdate = true;
  fly.instanceColor.updateRange.count = flyN * 3; fly.instanceColor.needsUpdate = true;
  flyShapeAttr.updateRange.count = flyN; flyShapeAttr.needsUpdate = true;
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
  if (!quiet) haptic(H_MED);
  changedEv.id = 'cart'; bus.emit('tool:changed', changedEv);
  return true;
}
function onDismount(e) {
  if (!cartMounted || !e || e.vehicle !== 'cart') return;
  cartMounted = false;
  setTool(prevTool === 'broom' && E().owned && E().owned('broom') ? 'broom' : 'hands', true);
}
function toggleNozzle() {
  if (!cart || !cartMounted) return;
  cart.nozzleDown = !cart.nozzleDown; cart.lastNX = NaN;
  nozzleEv.down = cart.nozzleDown; bus.emit('tool:nozzle', nozzleEv);
  haptic(H_TICK);
}
function controlMode() { const s = ctx.state.settings || {}; return s.cartControl === 'tank' || s.cartControl === 'camera' ? s.cartControl : (C.cart.controlMode || 'camera'); }
function cartViewMode() { return K.cartView === 'chase' || K.cartView === 'first' ? K.cartView : (controlMode() === 'tank' ? 'first' : 'chase'); }

// vehicle.drive(dt, input, pose): called by player.update while mounted. Moves pose.x/z (and pose.yaw in
// tank mode, where the view turns with the cart). Returns a bump strength 0..1 for the camera shake.
function drive(dt, inp, ps) {
  if (!cart) return 0;
  const CC = C.cart, mode = controlMode();
  cartDesc.view = cartViewMode();
  const vmax = cart.nozzleDown ? CC.cleanSpeedMax : CC.topSpeed, turnMax = CC.turnRateDeg * DEG;
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
  const bump = moveCart(dt);
  ps.x = cart.x; ps.z = cart.z;
  if (mode === 'tank') {
    ps.yaw = wrapPi(ps.yaw + dYaw);
    cart.lookIdle = inp.lookDX !== 0 || inp.lookDY !== 0 ? 0 : cart.lookIdle + dt;
    if (cart.lookIdle > 1) ps.yaw = wrapPi(ps.yaw + wrapPi(cart.heading - ps.yaw) * (1 - Math.exp(-dt / K.cartRecentreS)));
  }
  if (bump > 0) haptic(H_MED);
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
  collectResult(r, 'cart', 2);
  if (r && r.units > 0) {
    cart.dustT += dt;
    if (cart.dustT >= dustEvery * 0.5) { cart.dustT = 0; const s = stat('cartNozzleWidth') * 0.5, rx = -Math.cos(cart.heading), rz = -Math.sin(cart.heading); dustBurst(nx + rx * s * 0.8, cart.y + 0.1, nz + rz * s * 0.8, 2, DUST_COL, 0.8); dustBurst(nx - rx * s * 0.8, cart.y + 0.1, nz - rz * s * 0.8, 2, DUST_COL, 0.8); }
  }
  cart.lastNX = nx; cart.lastNZ = nz;
}
// test helper (not in the contract)
export function cartState() { return cart ? { x: cart.x, z: cart.z, heading: cart.heading, speed: cart.speed, nozzleDown: cart.nozzleDown, mounted: cartMounted } : null; }
