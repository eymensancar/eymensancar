// FAKE player.js: pose/input from window.__fk.player; writes the camera like the real one.
let C = null, F = null;
export function init(ctx) {
  C = ctx;
  window.__fk = window.__fk || {};
  F = window.__fk.player = {
    pose: { x: 39, y: 1.65, z: 17, yaw: Math.PI, pitch: -0.12, speed: 0, vx: 0, vz: 0, mounted: null },
    input: { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, action: false, stick: { active: false, cx: 0, cy: 0, x: 0, y: 0 } },
  };
  ctx.bus.on('input:button', (p) => { F.input.action = p.down; window.__fk.lastButton = p.down; });
  place();
}
function place() { const p = F.pose; C.camera.position.set(p.x, p.y, p.z); C.camera.rotation.set(p.pitch, -p.yaw, 0, 'YXZ'); }
export function update() { place(); }
export function pose() { return F.pose; }
export function input() { return F.input; }
export function forward(out) { out.x = Math.sin(F.pose.yaw); out.z = -Math.cos(F.pose.yaw); return out; }
export function aimPoint(d, out) { out.hit = false; return out; }
export function teleport(x, z, yaw) { F.pose.x = x; F.pose.z = z; if (yaw != null) F.pose.yaw = yaw; place(); }
export function mount(v) { F.pose.mounted = v.id || 'cart'; C.bus.emit('player:mount', { vehicle: F.pose.mounted }); return true; }
export function dismount() { F.pose.mounted = null; C.bus.emit('player:dismount', { vehicle: 'cart' }); }
export function mounted() { return F.pose.mounted; }
export function setSpeedCap() {}
export function viewModel() { return null; }
export function save() { return null; }
export function load() {}
