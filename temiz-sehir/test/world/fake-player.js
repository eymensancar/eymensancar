// TEST FAKE of player.js for world tests: holds a pose set by the test, writes the camera.
let C = null;
const P = { x: 39, y: 1.65, z: 17, yaw: Math.PI, pitch: -0.08, speed: 0, vx: 0, vz: 0, mounted: null, lift: 0.6, fixedY: null };
const inp = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, action: false, stick: { active: false, cx: 0, cy: 0, x: 0, y: 0 } };
function apply() {
  const tr = C.mods.trash, s = tr && tr.surfaceAt ? tr.surfaceAt(P.x, P.z) : 0;
  P.y = P.fixedY != null ? P.fixedY : C.CONFIG.player.eyeHeightM + s * P.lift;
  C.camera.position.set(P.x, P.y, P.z); C.camera.rotation.set(P.pitch, -P.yaw, 0, 'YXZ');
}
export function init(ctx) {
  C = ctx;
  window.__fakePlayer = { set(x, z, yawDeg, pitchDeg, y) { P.x = x; P.z = z; P.yaw = yawDeg * Math.PI / 180; P.pitch = (pitchDeg || 0) * Math.PI / 180; P.fixedY = y == null ? null : y; apply(); }, P };
  apply();
}
export function update() { apply(); }
export function pose() { return P; }
export function input() { return inp; }
export function forward(out) { out.x = Math.sin(P.yaw); out.z = -Math.cos(P.yaw); return out; }
export function teleport(x, z, yaw) { P.x = x; P.z = z; if (yaw != null) P.yaw = yaw; apply(); }
export function mounted() { return null; }
