// player.js — input (touch + keyboard/mouse), first-person controller, camera pose, vehicle mounting,
// view-model root, final camera lift. Owner: player. Contract: docs/MIMARI.md §4.4 (+ §6 events, §7 order).
// Notes, tunables and contract issues: docs/notlar/player.md.
//
// Comfort rules (docs/PSIKOLOJI.md §4) built in: no head bob (optional, capped at 1 cm, off by default),
// never any roll, FOV untouched (main owns it), walking reaches top speed in controller.accelS (0.18 s, linear,
// no long ease), look applies raw deltas in the same frame (no smoothing = no added latency), vehicle
// turns are damped by tools.js (drive), mount/dismount and the finale lift are eased camera blends.
//
// Input model
//   pointer events on the canvas only: a touch that starts on a UI element never reaches the canvas, so
//   it is ignored by construction. Each pointer gets a role when it lands: 'stick' (left half, touch/pen),
//   'look' (right half, or a mouse anywhere), or 'none' (a third finger, or a second finger on a half that
//   is already in use). Roles keep their pointer until up/cancel, wherever the finger travels.
//   Moves are tracked on window with pointer capture, so a finger sliding over the HUD keeps working.
//   pointercancel / lostpointercapture / blur / hidden / panel open / orientation flip release everything.

// Tunables: CONFIG.player.controller (config.js is the single source).

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const MAXP = 6; // pointer slots

let ctx = null, THREE = null, cam = null, bus = null, C = null;
let K = null; // resolved tunables
let walkSpeed = 5, radius = 0.35, eyeH = 1.65, pitchMin = -70 * DEG, pitchMax = 60 * DEG;
let sensTouch = 0.25 * DEG, sensMouse = 0.15 * DEG;
let vm = null; // view-model group (child of the camera)

const PS = { x: 0, y: 1.65, z: 0, yaw: 0, pitch: 0, speed: 0, vx: 0, vz: 0, mounted: null };
const inp = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, action: false, stick: { active: false, cx: 0, cy: 0, x: 0, y: 0 } };

// pointers
const ptr = [];
for (let i = 0; i < MAXP; i++) ptr.push({ id: -1, role: 0, type: 0, x0: 0, y0: 0, t0: 0, x: 0, y: 0, maxD: 0 });
const R_NONE = 0, R_STICK = 1, R_LOOK = 2;
let stickSlot = -1, lookSlot = -1;
let accTX = 0, accTY = 0, accMX = 0, accMY = 0; // look deltas since the last update (touch / mouse)
let stickRawX = 0, stickRawY = 0;               // stick output before keyboard merge
let keys = 0;                                    // bitmask: 1 fwd, 2 back, 4 left, 8 right, 16 action (only if ui is a stub)
let actionHeld = false, actionLatch = false;     // input:button; latch keeps a press visible for ≥ 1 frame
let panelOpen = false, lastPortrait = false;
const tapEv = { x: 0, y: 0 };
const stepEv = { speed: 0 };
const mountEv = { vehicle: null };

// motion
let vx = 0, vz = 0, speedCap = null, stepDist = 0, bobPhase = 0, ySmooth = 1.65, ySnap = true;
const col = { x: 0, z: 0, hit: false };
// vehicle
let vehicle = null;
let blendT = 1, blendFromX = 0, blendFromY = 0, blendFromZ = 0, blendFromPitchOff = 0, curPitchOff = 0;
let chaseDist = 0;
// finale lift: 0 off, 1 rising, 2 holding, 3 returning
let lift = 0, liftT = 0, liftFromX = 0, liftFromY = 0, liftFromZ = 0, liftFromYaw = 0, liftFromPitch = 0;
let liftX = 0, liftY = 0, liftZ = 0, liftYaw = 0, liftPitch = 0, liftEndReq = false, liftForce = false; // force: the complete card was closed
const camOut = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
let warned = {};

function warnOnce(k, msg) { if (warned[k]) return; warned[k] = true; console.warn('[player] ' + msg); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function wrapPi(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
function smooth01(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
function world() { return ctx.mods.world; }
function trash() { return ctx.mods.trash; }

// ------------------------------------------------------------------------------------------ API
export function pose() { return PS; }
export function input() { return inp; }
export function forward(out) { out.x = Math.sin(PS.yaw); out.z = -Math.cos(PS.yaw); return out; }

// Crosshair ray (camera centre) against the trash surface / ground, within maxDist metres.
export function aimPoint(maxDist, out) {
  const cp = Math.cos(PS.pitch);
  const dx = Math.sin(PS.yaw) * cp, dy = Math.sin(PS.pitch), dz = -Math.cos(PS.yaw) * cp;
  return rayMarch(cam.position.x, cam.position.y, cam.position.z, dx, dy, dz, maxDist, out);
}
function rayMarch(ox, oy, oz, dx, dy, dz, maxDist, out) {
  out.hit = false; out.x = ox + dx * maxDist; out.y = oy + dy * maxDist; out.z = oz + dz * maxDist;
  if (dy >= -1e-4) return out; // looking at or above the horizon never meets the ground
  const T = trash(), W = world(), step = 0.08;
  let tPrev = 0;
  for (let t = step; t <= maxDist + 1e-6; t += step) {
    const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
    if (W.isBlocked(px, pz, 0)) return out;
    if (py <= T.surfaceAt(px, pz)) {
      let a = tPrev, b = t;
      for (let k = 0; k < 6; k++) { const m = (a + b) * 0.5; if (oy + dy * m <= T.surfaceAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
      out.hit = true; out.x = ox + dx * b; out.y = oy + dy * b; out.z = oz + dz * b;
      return out;
    }
    tPrev = t;
  }
  return out;
}

export function teleport(x, z, yaw) {
  if (vehicle && typeof vehicle.teleport === 'function') { vehicle.teleport(x, z, yaw); }
  else if (vehicle) dismount();
  PS.x = x; PS.z = z;
  if (yaw != null && isFinite(yaw)) PS.yaw = wrapPi(yaw);
  vx = vz = 0; PS.vx = PS.vz = PS.speed = 0; ySnap = true; blendT = 1;
  writeCamera(0);
}

export function mount(v) {
  if (!v || typeof v.drive !== 'function') { warnOnce('mount', 'mount() needs a vehicle descriptor { id, eyeHeight, drive(dt, input, PS), object3D }'); return false; }
  if (vehicle === v) return true;
  if (vehicle) dismount();
  vehicle = v;
  PS.mounted = v.id || 'vehicle';
  if (v.object3D) { PS.x = v.object3D.position.x; PS.z = v.object3D.position.z; }
  vx = vz = 0;
  chaseDist = 0;
  startBlend();
  mountEv.vehicle = PS.mounted; bus.emit('player:mount', mountEv);
  return true;
}

export function dismount() {
  if (!vehicle) return;
  const v = vehicle, o = v.object3D;
  const hx = o ? o.position.x : PS.x, hz = o ? o.position.z : PS.z;
  const heading = o ? -o.rotation.y : PS.yaw;
  // step out to the left of the seat; try left, right, back, front, then further out
  const side = (v.exitSideM != null ? v.exitSideM : 1.4);
  const fx = Math.sin(heading), fz = -Math.cos(heading), rx = Math.cos(heading), rz = Math.sin(heading);
  let px = hx - rx * side, pz = hz - rz * side, found = false;
  for (let ring = 1; ring <= 3 && !found; ring++) {
    const s = side * (1 + (ring - 1) * 0.5);
    for (let k = 0; k < 4; k++) {
      const ax = k === 0 ? -rx : k === 1 ? rx : k === 2 ? -fx : fx, az = k === 0 ? -rz : k === 1 ? rz : k === 2 ? -fz : fz;
      const tx = hx + ax * (k < 2 ? s : s + 0.6), tz = hz + az * (k < 2 ? s : s + 0.6);
      if (!world().isBlocked(tx, tz, radius)) { px = tx; pz = tz; found = true; break; }
    }
  }
  vehicle = null; PS.mounted = null;
  startBlend();
  PS.x = px; PS.z = pz;
  world().collide(PS.x, PS.z, radius, col); PS.x = col.x; PS.z = col.z;
  vx = vz = 0; ySnap = true;
  mountEv.vehicle = v.id || 'vehicle'; bus.emit('player:dismount', mountEv);
}
export function mounted() { return vehicle; }
// look(yawRad, pitchRad): set the view direction (tests, debug.js __ts.look); pitch is clamped
export function look(yaw, pitch) {
  if (yaw != null && isFinite(yaw)) PS.yaw = wrapPi(yaw);
  if (pitch != null && isFinite(pitch)) PS.pitch = clamp(pitch, pitchMin, pitchMax);
  writeCamera(0);
}
// setStick(x, y): a virtual stick (-1..1, +y forward) merged like the keyboard; setStick(0, 0) releases it
let virtX = 0, virtY = 0;
export function setStick(x, y) { virtX = clamp(+x || 0, -1, 1); virtY = clamp(+y || 0, -1, 1); }
export function setSpeedCap(mps) { speedCap = (mps == null || !(mps > 0)) ? null : +mps; }
export function viewModel() { return vm; }

// ------------------------------------------------------------------------------------------ lifecycle
export function init(c) {
  ctx = c; THREE = c.THREE; cam = c.camera; bus = c.bus; C = c.CONFIG;
  const P = C.player || {};
  K = Object.assign({}, P.controller || {});
  K.headBobM = clamp(+K.headBobM || 0, 0, 0.01);
  walkSpeed = P.walkSpeed || 5; radius = P.radiusM || 0.35; eyeH = P.eyeHeightM || 1.65;
  if (P.pitchLimitDeg) { pitchMin = P.pitchLimitDeg[0] * DEG; pitchMax = P.pitchLimitDeg[1] * DEG; }
  sensTouch = (P.lookSensitivityTouchDegPerPx || 0.25) * DEG;
  sensMouse = (P.lookSensitivityMouseDegPerPx || 0.15) * DEG;

  vm = new THREE.Group(); vm.name = 'viewModel';
  cam.add(vm);
  cam.rotation.order = 'YXZ';
  spawn();
  lastPortrait = !!ctx.view.portrait;

  const cv = ctx.canvas;
  cv.addEventListener('pointerdown', onDown, { passive: false });
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onCancel);
  cv.addEventListener('lostpointercapture', onCancel);
  cv.addEventListener('touchstart', prevent, { passive: false });   // no iOS scroll/zoom/callout from the canvas
  cv.addEventListener('contextmenu', prevent);
  document.addEventListener('gesturestart', prevent, { passive: false });
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  bus.on('input:button', (e) => {
    if (!e || (e.id != null && e.id !== 'action')) return;
    if (e.down) { actionHeld = true; actionLatch = true; } else actionHeld = false;
  });
  bus.on('ui:panel', (e) => { panelOpen = !!(e && e.open); if (panelOpen) releasePointers(); if (e && e.id === 'complete' && !e.open && lift && lift < 3) { liftEndReq = true; liftForce = true; } });
  bus.on('app:pause', releaseAll);
  bus.on('district:cleaned', startLift);
  writeCamera(0);
}

export function resize() {
  const p = !!ctx.view.portrait;
  if (p !== lastPortrait) releasePointers(); // orientation flip: fingers are re-placed by the user
  lastPortrait = p;
}

export function save() {
  return { v: 1, x: +PS.x.toFixed(3), z: +PS.z.toFixed(3), yaw: +PS.yaw.toFixed(4), pitch: +PS.pitch.toFixed(4), mounted: PS.mounted };
}
export function load(d) {
  if (!d || typeof d !== 'object') return;
  const x = +d.x, z = +d.z;
  if (isFinite(x) && isFinite(z) && !world().isBlocked(x, z, radius)) { PS.x = x; PS.z = z; }
  if (isFinite(+d.yaw)) PS.yaw = wrapPi(+d.yaw);
  if (isFinite(+d.pitch)) PS.pitch = clamp(+d.pitch, pitchMin, pitchMax);
  // d.mounted is informative: tools.js re-mounts its vehicle after its own load (it owns the descriptor)
  vx = vz = 0; ySnap = true;
  writeCamera(0);
}

function spawn() {
  const P = C.player || {};
  const sp = world().point && world().point('spawn');
  const start = P.startPos || [27, 27];
  PS.x = sp ? sp.x : start[0]; PS.z = sp ? sp.z : start[1];
  PS.yaw = sp && sp.yaw != null ? sp.yaw : (P.startYawDeg || 0) * DEG;
  PS.pitch = K.startPitchDeg * DEG;
  PS.y = eyeH; ySmooth = eyeH; ySnap = true;
}

// ------------------------------------------------------------------------------------------ input
function prevent(e) { if (e.cancelable) e.preventDefault(); }
function slotOf(id) { for (let i = 0; i < MAXP; i++) if (ptr[i].id === id) return i; return -1; }
function freeSlot() { for (let i = 0; i < MAXP; i++) if (ptr[i].id === -1) return i; return -1; }

function onDown(e) {
  if (e.cancelable) e.preventDefault();
  if (panelOpen || ctx.state.paused) return;
  if (lift === 2 && liftT >= K.liftHoldS) liftEndReq = true;
  if (slotOf(e.pointerId) >= 0) return;
  const s = freeSlot(); if (s < 0) return;
  const mouse = e.pointerType === 'mouse';
  if (mouse && e.button !== 0) return;
  const p = ptr[s], v = ctx.view, x = e.clientX, y = e.clientY;
  let role = mouse ? R_LOOK : (x < v.w * 0.5 ? R_STICK : R_LOOK);
  if (role === R_STICK && stickSlot >= 0) role = R_NONE;
  if (role === R_LOOK && lookSlot >= 0) role = R_NONE;
  p.id = e.pointerId; p.role = role; p.type = mouse ? 1 : 0;
  p.x0 = p.x = x; p.y0 = p.y = y; p.t0 = e.timeStamp || performance.now(); p.maxD = 0;
  try { ctx.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
  if (role === R_STICK) {
    stickSlot = s;
    const st = inp.stick, edge = Math.min(K.stickEdgePx, v.w * 0.25, v.h * 0.25);
    st.active = true;
    st.cx = clamp(x, v.safe.left + edge, v.w * 0.5); st.cy = clamp(y, v.safe.top + edge, v.h - v.safe.bottom - edge);
    st.x = x; st.y = y;
    stickFromThumb();
  } else if (role === R_LOOK) lookSlot = s;
}

function onMove(e) {
  const s = slotOf(e.pointerId); if (s < 0) return;
  if (e.cancelable) e.preventDefault();
  const p = ptr[s], x = e.clientX, y = e.clientY;
  const dx = x - p.x, dy = y - p.y;
  p.x = x; p.y = y;
  const d0 = Math.abs(x - p.x0) + Math.abs(y - p.y0); if (d0 > p.maxD) p.maxD = d0;
  if (p.role === R_LOOK) { if (p.type === 1) { accMX += dx; accMY += dy; } else { accTX += dx; accTY += dy; } }
  else if (p.role === R_STICK) { inp.stick.x = x; inp.stick.y = y; stickFromThumb(); }
}

function onUp(e) {
  const s = slotOf(e.pointerId); if (s < 0) return;
  const p = ptr[s];
  if (p.role === R_LOOK && !panelOpen) {
    const dt = (e.timeStamp || performance.now()) - p.t0;
    if (dt <= K.tapMaxMs && p.maxD <= K.tapMaxPx) { tapEv.x = p.x; tapEv.y = p.y; bus.emit('input:tap', tapEv); }
  }
  freePtr(s);
}
function onCancel(e) { const s = slotOf(e.pointerId); if (s >= 0) freePtr(s); }

function freePtr(s) {
  const p = ptr[s];
  if (s === stickSlot) { stickSlot = -1; inp.stick.active = false; stickRawX = stickRawY = 0; }
  if (s === lookSlot) lookSlot = -1;
  try { if (p.id >= 0 && ctx.canvas.hasPointerCapture && ctx.canvas.hasPointerCapture(p.id)) ctx.canvas.releasePointerCapture(p.id); } catch (err) { /* ignore */ }
  p.id = -1; p.role = R_NONE;
}
function releasePointers() { for (let i = 0; i < MAXP; i++) if (ptr[i].id !== -1) freePtr(i); accTX = accTY = accMX = accMY = 0; }
function releaseAll() { releasePointers(); keys = 0; actionHeld = false; actionLatch = false; virtX = virtY = 0; }

// thumb position → stick vector; the base follows a thumb that goes past the rim (floating stick)
function stickFromThumb() {
  const st = inp.stick, R = K.stickRadiusPx;
  let dx = st.x - st.cx, dy = st.y - st.cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > R) { const k = (d - R) / d; st.cx += dx * k; st.cy += dy * k; dx = st.x - st.cx; dy = st.y - st.cy; }
  const m = Math.min(1, d / R);
  if (m <= K.stickDeadZone || d < 1e-6) { stickRawX = stickRawY = 0; return; }
  const mm = Math.min(1, (m - K.stickDeadZone) / (K.stickFullAt - K.stickDeadZone));
  const inv = mm / Math.max(1e-6, Math.sqrt(dx * dx + dy * dy));
  stickRawX = dx * inv; stickRawY = -dy * inv; // +y = forward (thumb up)
}

function onKey(e) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  let bit = 0;
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': bit = 1; break;
    case 'KeyS': case 'ArrowDown': bit = 2; break;
    case 'KeyA': case 'ArrowLeft': bit = 4; break;
    case 'KeyD': case 'ArrowRight': bit = 8; break;
    case 'KeyE': case 'Space': if (ctx.mods.ui && ctx.mods.ui.__stub) bit = 16; break; // ui owns E/Space; fallback only without ui
    default: return;
  }
  if (!bit) return;
  if (e.type === 'keydown') {
    if (panelOpen) return;
    keys |= bit;
    if (bit === 16 && !e.repeat) actionLatch = true;
    if (lift === 2 && liftT >= K.liftHoldS) liftEndReq = true;
  } else keys &= ~bit;
  if (bit < 16 || e.code === 'Space') e.preventDefault();
}

// fold this frame's input into the live input object
function sampleInput() {
  let mx = stickRawX, my = stickRawY;
  if (Math.abs(virtX) + Math.abs(virtY) > Math.abs(mx) + Math.abs(my)) { mx = virtX; my = virtY; }
  if (keys & 15) {
    let kx = ((keys & 8) ? 1 : 0) - ((keys & 4) ? 1 : 0), ky = ((keys & 1) ? 1 : 0) - ((keys & 2) ? 1 : 0);
    const l = Math.sqrt(kx * kx + ky * ky); if (l > 0) { kx /= l; ky /= l; }
    if (Math.abs(kx) + Math.abs(ky) > Math.abs(mx) + Math.abs(my)) { mx = kx; my = ky; }
  }
  inp.moveX = mx; inp.moveY = my;
  inp.action = actionHeld || actionLatch || (keys & 16) !== 0;
  actionLatch = false;
  const s = ctx.state.settings || {}, sens = s.sens > 0 ? s.sens : 1;
  inp.lookDX = accTX + accMX; inp.lookDY = accTY + accMY;
  const inv = s.invertY ? -1 : 1;
  lookYaw = (accTX * sensTouch + accMX * sensMouse) * sens;
  lookPitch = -(accTY * sensTouch + accMY * sensMouse * (K.invertMouseY ? -1 : 1)) * sens * inv;
  accTX = accTY = accMX = accMY = 0;
}
let lookYaw = 0, lookPitch = 0;

// ------------------------------------------------------------------------------------------ update
export function update(dt) {
  sampleInput();
  if (lift) { updateLift(dt); inp.moveX = inp.moveY = 0; return; }
  if (panelOpen || dt <= 0) { lookYaw = lookPitch = 0; }
  PS.yaw = wrapPi(PS.yaw + lookYaw);
  PS.pitch = clamp(PS.pitch + lookPitch, pitchMin, pitchMax);
  if (dt <= 0) { writeCamera(0); return; }

  if (vehicle) {
    const px = PS.x, pz = PS.z;
    let bump = 0;
    try { bump = +vehicle.drive(dt, inp, PS) || 0; } catch (e) { warnOnce('drive', 'vehicle.drive threw: ' + (e && e.message)); }
    if (bump > 0) { shakeDur = ((C.feedback && C.feedback.cartShakeOnBump) || 0.15); shakeT = shakeDur; shakeAmp = Math.max(shakeAmp * (shakeT / shakeDur), K.shakeM * Math.min(1, bump)); }
    PS.vx = (PS.x - px) / dt; PS.vz = (PS.z - pz) / dt;
    PS.speed = Math.sqrt(PS.vx * PS.vx + PS.vz * PS.vz);
  } else walk(dt);
  writeCamera(dt);
}

function walk(dt) {
  const maxV = speedCap != null ? Math.min(walkSpeed, speedCap) : walkSpeed;
  const sy = Math.sin(PS.yaw), cy = Math.cos(PS.yaw);
  // stick: +y forward (sin yaw, -cos yaw), +x right (cos yaw, sin yaw)
  const tx = (sy * inp.moveY + cy * inp.moveX) * maxV, tz = (-cy * inp.moveY + sy * inp.moveX) * maxV;
  // linear approach: full speed in accelS, standstill in decelS
  const dvx = tx - vx, dvz = tz - vz, dl = Math.sqrt(dvx * dvx + dvz * dvz);
  if (dl > 1e-6) {
    const speeding = tx * tx + tz * tz >= vx * vx + vz * vz - 1e-6;
    const rate = (speeding ? walkSpeed / K.accelS : walkSpeed / K.decelS) * dt;
    const k = dl > rate ? rate / dl : 1;
    vx += dvx * k; vz += dvz * k;
  }
  const ox = PS.x, oz = PS.z;
  world().collide(ox + vx * dt, oz + vz * dt, radius, col);
  PS.x = col.x; PS.z = col.z;
  if (col.hit) { vx = (PS.x - ox) / dt; vz = (PS.z - oz) / dt; } // slide along walls, no speed build-up into them
  PS.vx = vx; PS.vz = vz;
  PS.speed = Math.sqrt(vx * vx + vz * vz);
  if (PS.speed > 0.3) {
    stepDist += PS.speed * dt;
    if (stepDist >= K.stepLengthM) { stepDist -= K.stepLengthM; stepEv.speed = PS.speed; bus.emit('player:step', stepEv); }
  }
}

function startBlend() {
  blendFromX = cam.position.x; blendFromY = cam.position.y; blendFromZ = cam.position.z;
  blendFromPitchOff = curPitchOff; blendT = 0;
}

// computes where the camera wants to be this frame (camOut), then blends/writes it
function writeCamera(dt) {
  const T = trash();
  let pitchOff = 0;
  if (vehicle) {
    const o = vehicle.object3D, baseY = (o ? o.position.y : 0) + (vehicle.eyeHeight || 2);
    const heading = o ? -o.rotation.y : PS.yaw;
    const view = vehicle.view || 'first';
    if (view === 'chase') {
      // behind the vehicle along the VIEW direction (orbit with the look), slides in before walls
      const fx = Math.sin(PS.yaw), fz = -Math.cos(PS.yaw);
      const chaseFull = K.chaseDistM * (ctx.view.portrait ? K.chasePortraitScale : 1);
      let want = chaseFull;
      const W = world();
      if (W.segmentClear && !W.segmentClear(PS.x, PS.z, PS.x - fx * want, PS.z - fz * want, 0.25, true)) {
        let a = K.chaseMinDistM, b = want;
        for (let k = 0; k < 5; k++) { const m = (a + b) * 0.5; if (W.segmentClear(PS.x, PS.z, PS.x - fx * m, PS.z - fz * m, 0.25, true)) a = m; else b = m; }
        want = a;
      }
      if (chaseDist <= 0) chaseDist = want;
      // come in fast (no wall clipping), go back out gently
      const kIn = want < chaseDist ? 1 - Math.exp(-dt / 0.05) : 1 - Math.exp(-dt / 0.45);
      chaseDist += (want - chaseDist) * (dt > 0 ? kIn : 1);
      camOut.x = PS.x - fx * chaseDist; camOut.z = PS.z - fz * chaseDist;
      camOut.y = baseY + K.chaseHeightM * (chaseDist / K.chaseDistM);
      pitchOff = K.chasePitchDeg * DEG;
    } else {
      camOut.x = PS.x - Math.sin(heading) * K.seatBackM; camOut.z = PS.z + Math.cos(heading) * K.seatBackM;
      camOut.y = baseY;
    }
    PS.y = camOut.y;
  } else {
    const target = eyeH + K.surfaceLift * T.surfaceAt(PS.x, PS.z);
    if (ySnap || dt <= 0) { if (ySnap) ySmooth = target; ySnap = false; }
    else ySmooth += (target - ySmooth) * (1 - Math.exp(-dt / K.eyeSmoothS));
    let bob = 0;
    if (K.headBobM > 0 && (ctx.state.settings || {}).headBob) { bobPhase += PS.speed * dt * Math.PI / K.stepLengthM; bob = Math.abs(Math.sin(bobPhase)) * K.headBobM * Math.min(1, PS.speed / walkSpeed); }
    camOut.x = PS.x; camOut.z = PS.z; camOut.y = ySmooth + bob;
    PS.y = camOut.y;
  }
  curPitchOff = pitchOff;
  let x = camOut.x, y = camOut.y, z = camOut.z, po = pitchOff;
  if (blendT < 1) {
    blendT = Math.min(1, blendT + (dt > 0 ? dt / K.mountBlendS : 0));
    const e = smooth01(blendT);
    x = blendFromX + (x - blendFromX) * e; y = blendFromY + (y - blendFromY) * e; z = blendFromZ + (z - blendFromZ) * e;
    po = blendFromPitchOff + (po - blendFromPitchOff) * e;
  }
  if (shakeT > 0) { // short vertical jolt on a cart bump (no roll, no yaw)
    shakeT = Math.max(0, shakeT - dt);
    y += Math.sin(shakeT * 70) * shakeAmp * (shakeT / shakeDur);
  }
  cam.position.set(x, y, z);
  cam.rotation.set(clamp(PS.pitch + po, -1.5, 1.5), -PS.yaw, 0, 'YXZ');
  cam.updateMatrixWorld();
}
let shakeT = 0, shakeDur = 0.15, shakeAmp = 0;

// ------------------------------------------------------------------------------------------ finale lift
function startLift() {
  if (lift === 1 || lift === 2) return;
  releasePointers();
  const D = C.district || {}, size = (D.sizeM && D.sizeM[0]) || 54;
  const cx = size / 2, cz = size / 2;
  let ax = PS.x - cx, az = PS.z - cz; const l = Math.sqrt(ax * ax + az * az);
  if (l < 1) { ax = 0; az = 1; } else { ax /= l; az /= l; }
  liftX = cx + ax * K.liftBackM; liftZ = cz + az * K.liftBackM; liftY = K.liftHeightM;
  liftYaw = Math.atan2(cx - liftX, -(cz - liftZ));
  // landscape: the completion card sits on the right, so turn a little right to put the district in the left half
  if (!ctx.view.portrait) liftYaw += (K.liftYawOffsetDeg || 0) * DEG;
  liftPitch = -Math.atan2(liftY, K.liftBackM);
  liftFromX = cam.position.x; liftFromY = cam.position.y; liftFromZ = cam.position.z;
  liftFromYaw = -cam.rotation.y; liftFromPitch = cam.rotation.x;
  lift = 1; liftT = 0; liftEndReq = false; liftForce = false;
}
function updateLift(dt) {
  const step = dt > 0 ? dt : (ctx.time && ctx.time.dt) || 0;
  liftT += step;
  let x, y, z, yaw, pitch;
  if (lift === 1) {
    const e = smooth01(liftT / K.liftRiseS);
    // rise first, then travel: the camera clears the rooftops before it moves sideways (never through walls)
    const eh = smooth01((liftT - K.liftRiseS * 0.3) / (K.liftRiseS * 0.7));
    x = liftFromX + (liftX - liftFromX) * eh; z = liftFromZ + (liftZ - liftFromZ) * eh;
    const ey = smooth01(liftT / (K.liftRiseS * 0.55));
    y = liftFromY + (liftY - liftFromY) * ey;
    yaw = liftFromYaw + wrapPi(liftYaw - liftFromYaw) * e; pitch = liftFromPitch + (liftPitch - liftFromPitch) * e;
    if (liftT >= K.liftRiseS) { lift = 2; liftT = 0; }
  } else if (lift === 2) {
    x = liftX; y = liftY; z = liftZ; yaw = liftYaw; pitch = liftPitch;
    if (liftEndReq && (liftT >= K.liftHoldS || liftForce)) { lift = 3; liftT = 0; liftEndReq = false; liftForce = false; }
  } else {
    // back down to the player's own eye
    const e = smooth01(liftT / K.liftReturnS);
    writeCamera(0); // computes camOut for the player pose
    const tx = camOut.x, ty = camOut.y, tz = camOut.z;
    x = liftX + (tx - liftX) * e; y = liftY + (ty - liftY) * e; z = liftZ + (tz - liftZ) * e;
    yaw = liftYaw + wrapPi(PS.yaw - liftYaw) * e; pitch = liftPitch + (PS.pitch - liftPitch) * e;
    if (liftT >= K.liftReturnS) { lift = 0; writeCamera(0); return; }
  }
  cam.position.set(x, y, z);
  cam.rotation.set(pitch, -yaw, 0, 'YXZ');
  cam.updateMatrixWorld();
}
// test/debug helpers (not part of the contract; harmless without calls)
export function liftState() { return lift; }
export function endLift() { if (lift) liftEndReq = true; if (lift === 2) liftT = Math.max(liftT, K.liftHoldS); }
