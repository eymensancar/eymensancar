// FAKE world.js for ui/audio tests (test/ui/run.mjs routes www/js/world.js here). Contract shape only.
// Draws a screenshot of the spike as the scene background so HUD shots are judged over the real look.
let C = null;
const pts = [];
export function init(ctx) {
  C = ctx;
  const P = (id, x, z, r) => pts.push({ id, x, z, r: r || 2.5, yaw: 0 });
  P('spawn', 39, 17); P('shop', 39, 13); P('dropoff', 3, 51); P('dock', 35, 13); P('cartPark', 39, 20); P('billboard', 39, 30);
  const THREE = ctx.THREE;
  ctx.scene.add(new THREE.HemisphereLight(0xbfd2e6, 0x6e6152, 0.8));
  const bg = window.__FK_BG;
  if (!bg) { ctx.scene.background = new THREE.Color(0x8a9aa8); return; }
  return new Promise((res) => {
    new THREE.TextureLoader().load(bg, (t) => { ctx.scene.background = t; res(); }, undefined, () => res());
  });
}
export function update() {}
export function layout() { return { size: 54, cell: 0.5, N: 108, bounds: { x0: 0, z0: 0, x1: 54, z1: 54 }, kind: new Uint8Array(108 * 108).fill(1), buildings: [] }; }
export function groundTexture() { return null; }
export function lighting() { const T = C.THREE; return { sunDir: new T.Vector3(0, 1, 0), sunColor: new T.Color(1, 1, 1), skyColor: new T.Color(1, 1, 1), groundColor: new T.Color(0.3, 0.3, 0.3), fogColor: new T.Color(0.8, 0.84, 0.86) }; }
export function points() { return pts; }
export function point(id) { return pts.find((p) => p.id === id) || null; }
export function kindAt() { return 1; }
export function outsideUnits() { return 0; }
export function isBlocked() { return false; }
export function collide(x, z, r, out) { out.x = x; out.z = z; out.hit = false; return out; }
export function segmentClear() { return true; }
