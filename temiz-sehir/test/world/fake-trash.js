// TEST FAKE of trash.js for world tests (served in place of www/js/trash.js by run.mjs).
// run.mjs prepends test/spike/trash-core.js (exports stripped) where the marker below is.
// Uses world's contract only: layout().kind, groundTexture(), lighting(), outsideUnits().
/*__CORE__*/
let C = null, core = null;
function mulberryT(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function valueNoise(seed) {
  const h = (x, z) => { let a = (x * 374761393 + z * 668265263 + seed * 2246822519) | 0; a = Math.imul(a ^ (a >>> 13), 1274126177); return (((a ^ (a >>> 16)) >>> 0) / 4294967296) * 2 - 1; };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = s(x - xi), fz = s(z - zi);
    const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz; };
}
function trashGen(CONFIG, kind, N, CELL) { // copy of the spike's reference generator
  const D = CONFIG.district, G = CONFIG.trashGen, rnd = mulberryT(G.seed), n = valueNoise(G.seed);
  const zones = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) zones[i] = kind[i] === 1 ? 1 : kind[i] === 2 ? 2 : 0;
  const corners = [];
  for (const b of D.blocks) if (b.kind === 'building') { const [x0, z0, x1, z1] = b.rect; corners.push([x0 - 1, z0 - 1], [x1 + 1, z0 - 1], [x0 - 1, z1 + 1], [x1 + 1, z1 + 1]); }
  const piles = [];
  for (let k = 0; k < G.piles.count; k++) { const c = corners[(rnd() * corners.length) | 0]; piles.push([c[0] + (rnd() - 0.5) * 3, c[1] + (rnd() - 0.5) * 3, G.piles.radiusM[0] + rnd() * (G.piles.radiusM[1] - G.piles.radiusM[0])]); }
  const raw = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const idx = j * N + i; if (!zones[idx]) continue;
    const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    let v = (zones[idx] === 2 ? G.zoneBase.plaza : G.zoneBase.street) + G.noiseAmp * n(x / G.noiseScaleM, z / G.noiseScaleM);
    for (const [px, pz, r] of piles) { const d = Math.hypot(x - px, z - pz); if (d < r) { v += G.piles.add * (1 - d / r); zones[idx] = 3; } }
    raw[idx] = v;
  }
  const initial = new Uint8Array(N * N);
  const apply = (shift) => { let s = 0, c = 0; for (let i = 0; i < N * N; i++) { if (!zones[i]) continue; const u = Math.max(G.depthMin, Math.min(G.depthMax, Math.round(raw[i] + shift))); initial[i] = u; s += u; c++; } return { mean: s / c, cells: c, total: s }; };
  let lo = -3, hi = 3;
  for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; const r = apply(m); if (r.mean > G.targetMeanDepth) hi = m; else lo = m; }
  apply((lo + hi) / 2);
  const mixes = [null, 'street', 'plaza', 'pile'].map((z) => z && Object.assign({}, CONFIG.zoneMix[z], { valuable: CONFIG.valuableChance[z] }));
  return { zones, initial, mixes };
}
export function init(ctx) {
  C = ctx; const W = ctx.mods.world, L = W.layout();
  const gen = trashGen(ctx.CONFIG, L.kind, L.N, L.cell);
  core = createTrashCore({
    N: L.N, cell: L.cell, K: ctx.CONFIG.trashGen.depthMax, renderer: ctx.renderer, seed: 3,
    types: ctx.CONFIG.trashTypes.map((t) => t.id), zones: gen.zones, mixes: gen.mixes, initial: gen.initial,
    outside: W.outsideUnits, outsideZone: 1, outUnitsShader: 2, groundMap: W.groundTexture(), light: W.lighting(), fadeS: 0,
  });
  ctx.scene.add(core.group); core.warmup();
  window.__fakeTrash = {
    core,
    carve(list) { for (const c of list) { if (c.seg) core.removeAlongSegment(c.seg[0], c.seg[1], c.seg[2], c.seg[3], c.hw, 1e9); else core.removeInCircle(c.x, c.z, c.r, 1e9); } return core.cleanFraction(); },
  };
}
export function update(dt) { const p = C.camera.position; core.update(p.x, p.z, dt); }
export function surfaceAt(x, z) { return core.surfaceAt(x, z); }
export function amountAt(x, z) { return core.amountAt(x, z); }
export function cleanFraction() { return core.cleanFraction(); }
