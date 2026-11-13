// TEST FAKE of www/js/trash.js: wraps the spike reference core (test/spike/trash-core.js) with the
// MIMARI §4.3 API, enough for player/tools tests. Not the real trash module (no save, no milestones).
import { createTrashCore, SHAPES } from '/test/spike/trash-core.js';
let ctx, core, C, N, CELL;
const byAgg = { hands: 0, broom: 0, cart: 0, robot: 0, final: 0, debug: 0 };
const chEv = { units: 0, cells: 0, cleaned: 0, by: byAgg, fraction: 0 };
function valueNoise(seed) {
  const h = (x, z) => { let a = (x * 374761393 + z * 668265263 + seed * 2246822519) | 0; a = Math.imul(a ^ (a >>> 13), 1274126177); return (((a ^ (a >>> 16)) >>> 0) / 4294967296) * 2 - 1; };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = s(x - xi), fz = s(z - zi); const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1); return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz; };
}
function gen(kind) {
  const G = C.trashGen, n = valueNoise(G.seed), zones = new Uint8Array(N * N), initial = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) zones[i] = kind[i] === 1 ? 1 : kind[i] === 2 ? 2 : 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const idx = j * N + i; if (!zones[idx]) continue; const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL; initial[idx] = Math.max(1, Math.min(4, Math.round(1.75 + G.noiseAmp * n(x / G.noiseScaleM, z / G.noiseScaleM)))); }
  const mixes = [null, 'street', 'plaza', 'pile'].map((z) => z && Object.assign({}, C.zoneMix[z], { valuable: C.valuableChance[z] }));
  return { zones, initial, mixes };
}
export function init(c) {
  ctx = c; C = c.CONFIG; N = C.district.grid[0]; CELL = C.district.cellM;
  const W = c.mods.world, g = gen(W.layout().kind);
  core = createTrashCore({ N, cell: CELL, K: 4, renderer: c.renderer, seed: 3, types: C.trashTypes.map((t) => t.id), zones: g.zones, mixes: g.mixes, initial: g.initial,
    outside: W.outsideUnits, outsideZone: 1, outUnitsShader: 2, groundMap: W.groundTexture(), light: W.lighting(), fadeS: c.params.has('nofade') ? 0 : C.feedback.cellCleanFadeS });
  c.scene.add(core.group); core.warmup();
  window.__fakeTrash = core;
}
let units = 0, cells = 0, cleaned = 0;
function acc(r, by) { units += r.units; cells += r.cells; cleaned += r.cleaned; byAgg[by] = (byAgg[by] || 0) + r.units; return r; }
export function update(dt) {
  core.update(ctx.camera.position.x, ctx.camera.position.z, dt || 0);
  if (units) { chEv.units = units; chEv.cells = cells; chEv.cleaned = cleaned; chEv.fraction = core.cleanFraction(); ctx.bus.emit('trash:changed', chEv); }
  units = cells = cleaned = 0; for (const k in byAgg) byAgg[k] = 0;
}
export function info() { return { N, cell: CELL, K: 4, size: N * CELL, types: C.trashTypes.map((t) => t.id), shapes: SHAPES, blocks: core.blocks, blockSize: core.blockSize }; }
export function amountAt(x, z) { return core.amountAt(x, z); }
export function surfaceAt(x, z) { return core.surfaceAt(x, z); }
export function cellAt(x, z) { return core.cellAt(x, z); }
export function cellCenter(i, o) { return core.cellCenter(i, o); }
export function removeInCircle(x, z, r, m, by) { return acc(core.removeInCircle(x, z, r, m), by); }
export function removeAlongSegment(x0, z0, x1, z1, hw, m, by) { return acc(core.removeAlongSegment(x0, z0, x1, z1, hw, m), by); }
export function pick(x, z, r, by) { const p = core.pick(x, z, r); if (p) { units++; cells++; byAgg[by] = (byAgg[by] || 0) + 1; } return p; }
export function nearestDirty(x, z, r) { return core.nearestDirty(x, z, r); }
export function consume(x, z, m, r, by) { return acc(core.consume(x, z, m, r), by); }
export function clearAll() { return core.removeInCircle(27, 27, 1e3, 1e9); }
export function cleanFraction() { return core.cleanFraction(); }
export function unitFraction() { return core.unitFraction(); }
export function totalUnits() { return core.totalUnits(); }
export function initialUnits() { return core.initialUnits(); }
export function trashCells() { return core.trashCells(); }
export function cleanCells() { return core.cleanCells(); }
export function blockSums() { return core.blockSums; }
export function itemGeometry(i) { return core.geometries[SHAPES[i]] || null; }
export function itemMaterial() { return core.itemMaterial; }
