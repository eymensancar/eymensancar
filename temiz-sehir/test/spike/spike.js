// Spike: the config.js district (54 m, 108×108 cells) buried in trash, rendered with trash-core.js,
// plus a measuring harness driven by test/spike/run.mjs through window.__spike.
// Throwaway code. layout / trashGen / ground map / buildings here are a REFERENCE for world.js and
// trash.js (MIMARI.md §4, §5), not a contract.
import { createTrashCore } from './trash-core.js';
import { CONFIG } from '../../www/js/config.js';

const THREE = window.THREE;
const D = CONFIG.district, CELL = D.cellM, N = D.grid[0], SIZE = D.sizeM[0];
const SW = D.streetWidthM, OFFS = D.streetOffsetsM;
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- layout (reference for world.js)
// kind per cell: 0 solid (building/kiosk), 1 street, 2 plaza. Neighbour districts repeat the layout
// with period SIZE (visual only; their plaza block is built up).
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inRect = (x, z, r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];
function kindAtLocal(x, z, home) { // x,z inside [0,SIZE)
  for (const b of D.blocks) if (inRect(x, z, b.rect)) return (b.kind === 'plaza' && home) ? (inRect(x, z, D.shopKiosk.rect) ? 0 : 2) : 0;
  return 1;
}
function kindAt(x, z) {
  const home = x >= 0 && z >= 0 && x < SIZE && z < SIZE;
  const lx = ((x % SIZE) + SIZE) % SIZE, lz = ((z % SIZE) + SIZE) % SIZE;
  return kindAtLocal(lx, lz, home);
}
function makeLayout() {
  const kind = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) kind[j * N + i] = kindAt((i + 0.5) * CELL, (j + 0.5) * CELL);
  const rnd = mulberry(42), buildings = [];
  const R = D.surroundings.neighbourRingDistricts;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const home = dx === 0 && dz === 0;
    for (const b of D.blocks) {
      if (b.kind === 'plaza' && home) continue;
      const [x0, z0, x1, z1] = b.rect, ox = dx * SIZE, oz = dz * SIZE;
      const hr = b.heightM || [12, 30];
      const nx = 2, nz = rnd() < 0.5 ? 2 : 3;
      for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
        const w = (x1 - x0) / nx, d = (z1 - z0) / nz;
        const h = home ? hr[0] + rnd() * (hr[1] - hr[0]) : 10 + rnd() * 26;
        buildings.push({ x0: ox + x0 + a * w, z0: oz + z0 + c * d, x1: ox + x0 + (a + 1) * w, z1: oz + z0 + (c + 1) * d, h, tint: (rnd() * 6) | 0 });
      }
    }
  }
  return { kind, buildings };
}

// ---------------------------------------------------------------- trashGen (reference for trash.js)
// depth = clamp(round(zoneBase + noiseAmp·n(x/s, z/s) + pileBonus + shift), min, max), shift solved
// so that the mean over trash cells == targetMeanDepth.
function valueNoise(seed) {
  const h = (x, z) => { let a = (x * 374761393 + z * 668265263 + seed * 2246822519) | 0; a = Math.imul(a ^ (a >>> 13), 1274126177); return (((a ^ (a >>> 16)) >>> 0) / 4294967296) * 2 - 1; };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = s(x - xi), fz = s(z - zi);
    const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz; };
}
function trashGen(kind) {
  const G = CONFIG.trashGen, rnd = mulberry(G.seed), n = valueNoise(G.seed);
  const zones = new Uint8Array(N * N); // 0 none, 1 street, 2 plaza, 3 pile
  for (let i = 0; i < N * N; i++) zones[i] = kind[i] === 1 ? 1 : kind[i] === 2 ? 2 : 0;
  // piles at building-block corners (pushed 1 m diagonally into the street)
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
  let lo = -3, hi = 3, r;
  for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; r = apply(m); if (r.mean > G.targetMeanDepth) hi = m; else lo = m; }
  r = apply((lo + hi) / 2);
  const mixes = [null, 'street', 'plaza', 'pile'].map((z) => z && Object.assign({}, CONFIG.zoneMix[z], { valuable: CONFIG.valuableChance[z] }));
  return { zones, initial, mixes, stats: r };
}

// ---------------------------------------------------------------- ground map (reference for world.js)
function makeGroundMap(renderer, kind) {
  const PX = 16, S = SIZE * PX, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), rnd = mulberry(7), cell = CELL * PX;
  // street cells within 1 m of a building block are pavement
  const nearBuilding = (x, z) => D.blocks.some((b) => b.kind === 'building' && x > b.rect[0] - 1 && x < b.rect[2] + 1 && z > b.rect[1] - 1 && z < b.rect[3] + 1);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = kind[j * N + i], x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    g.fillStyle = k === 0 ? '#2a2a2a' : k === 2 ? '#a39684' : nearBuilding(x, z) ? '#8e8b85' : '#3a3c3f';
    g.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
    if (k === 2 || (k === 1 && nearBuilding(x, z))) { g.strokeStyle = 'rgba(60,58,55,0.45)'; g.lineWidth = 1; g.strokeRect(i * cell + 0.5, j * cell + 0.5, cell - 1, cell - 1); }
  }
  for (let k = 0; k < 40000; k++) { const v = 40 + rnd() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},0.3)`; g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  g.fillStyle = '#d8d6cc'; // dashed centre lines
  for (const o of OFFS) for (let t = 0; t < SIZE; t += 3) {
    const cx = o + SW / 2;
    if (!OFFS.some((q) => t + 1 > q && t < q + SW)) { g.fillRect((cx - 0.06) * PX, t * PX, 0.12 * PX, 1.5 * PX); g.fillRect(t * PX, (cx - 0.06) * PX, 1.5 * PX, 0.12 * PX); }
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; // canvas row = +z, same as the trash grid
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return { tex: t, bytes: S * S * 4 * 4 / 3 };
}

// ---------------------------------------------------------------- buildings (1 merged mesh)
function makeFacade(renderer) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#e6e2da'; g.fillRect(0, 0, S, S);
  for (let k = 0; k < 2000; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * S, Math.random() * S, 3, 3); }
  for (let fy = 0; fy < 2; fy++) for (let fx = 0; fx < 2; fx++) {
    const x = fx * 128 + 30, y = fy * 128 + 26, w = 68, h = 76;
    g.fillStyle = '#9c978e'; g.fillRect(x - 5, y - 5, w + 10, h + 12);
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#5d7486'); gr.addColorStop(0.5, '#3a4a58'); gr.addColorStop(1, '#2a333b');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#d9d5cc'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.35, w, 3);
    g.fillStyle = '#7b766d'; g.fillRect(x - 7, y + h + 4, w + 14, 6);
  }
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 122, S, 6); g.fillRect(0, 250, S, 6);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const TINTS = ['#f1e6d2', '#e8c9a0', '#d9d9d6', '#e3b39a', '#f4f1ea', '#c9d1c8'].map((c) => new THREE.Color(c));
function makeBuildings(renderer, list) {
  const P = [], U = [], C = [], I = [];
  const quad = (a, b, c, d, ua, va, ub, vb, col) => {
    const o = P.length / 3; P.push(...a, ...b, ...c, ...d);
    U.push(ua, va, ub, va, ub, vb, ua, vb);
    for (let k = 0; k < 4; k++) C.push(col.r, col.g, col.b);
    I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  for (const b of list) {
    const { x0, z0, x1, z1, h } = b, col = TINTS[b.tint], fu = 1 / 6, fv = 1 / 6.4;
    const w = x1 - x0, d = z1 - z0;
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], 0, 0, w * fu, h * fv, col);   // +z
    quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], 0, 0, w * fu, h * fv, col);   // -z
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], 0, 0, d * fu, h * fv, col);   // +x
    quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], 0, 0, d * fu, h * fv, col);   // -x
    const rc = new THREE.Color(0.32, 0.31, 0.3);
    quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], 0.01, 0.01, 0.02, 0.02, rc); // roof
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: makeFacade(renderer), vertexColors: true }));
  mesh.name = 'buildings';
  return mesh;
}
// street lamps, kiosk, barriers at the district edge: 1 merged vertex-coloured mesh
function makeProps() {
  const P = [], C = [], I = [];
  const box = (x, y, z, sx, sy, sz, col) => {
    const o = P.length / 3, hx = sx / 2, hz = sz / 2;
    for (const p of [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [-hx, sy, -hz], [hx, sy, -hz], [hx, sy, hz], [-hx, sy, hz]]) { P.push(x + p[0], y + p[1], z + p[2]); C.push(col.r, col.g, col.b); }
    I.push(o, o + 1, o + 5, o, o + 5, o + 4, o + 1, o + 2, o + 6, o + 1, o + 6, o + 5, o + 2, o + 3, o + 7, o + 2, o + 7, o + 6, o + 3, o, o + 4, o + 3, o + 4, o + 7, o + 4, o + 5, o + 6, o + 4, o + 6, o + 7);
  };
  const pole = new THREE.Color('#3b4045'), lamp = new THREE.Color('#e8e4d0'), red = new THREE.Color('#c8402c'), white = new THREE.Color('#e8e8e8');
  for (const o of OFFS) for (let t = 3; t < SIZE; t += 9) {
    if (OFFS.some((q) => t > q - 1 && t < q + SW + 1)) continue;
    const px = o + 0.6;
    box(px, 0, t, 0.12, 5.5, 0.12, pole); box(px + 0.6, 5.4, t, 1.3, 0.1, 0.22, pole); box(px + 1.1, 5.25, t, 0.36, 0.14, 0.26, lamp);
    box(t, 0, px, 0.12, 5.5, 0.12, pole); box(t, 5.4, px + 0.6, 0.22, 0.1, 1.3, pole); box(t, 5.25, px + 1.1, 0.26, 0.14, 0.36, lamp);
  }
  const [kx0, kz0, kx1, kz1] = D.shopKiosk.rect;
  box((kx0 + kx1) / 2, 0, (kz0 + kz1) / 2, kx1 - kx0, D.shopKiosk.heightM, kz1 - kz0, new THREE.Color('#2f7d5b'));
  box((kx0 + kx1) / 2, D.shopKiosk.heightM, (kz0 + kz1) / 2 + 0.2, kx1 - kx0 + 0.6, 0.15, kz1 - kz0 + 1.2, new THREE.Color('#e9c46a'));
  for (const o of OFFS) for (const edge of [0.3, SIZE - 0.3]) for (let k = 0; k < SW; k += 2) {
    box(o + k + 1, 0, edge, 1.8, 1.05, 0.15, (k / 2) & 1 ? red : white);
    box(edge, 0, o + k + 1, 0.15, 1.05, 1.8, (k / 2) & 1 ? red : white);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); m.name = 'props';
  return m;
}
function makeSky() {
  const geo = new THREE.SphereGeometry(440, 24, 12), p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const zen = new THREE.Color('#5f8fcf'), hor = new THREE.Color('#cdd7dc'), low = new THREE.Color('#b8c0c2'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 440;
    if (y >= 0) c.copy(hor).lerp(zen, Math.pow(y, 0.6)); else c.copy(hor).lerp(low, Math.min(1, -y * 4));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.name = 'sky';
  return m;
}


// ---------------------------------------------------------------- scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: params.has('shots') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
const FOG = new THREE.Color('#cdd7dc');
scene.fog = new THREE.Fog(FOG, 30, 230);
scene.background = FOG;
const camera = new THREE.PerspectiveCamera(CONFIG.player.fovVerticalDegLandscape, innerWidth / innerHeight, 0.1, 480);
const hemi = new THREE.HemisphereLight(0xbfd2e6, 0x6e6152, 0.62); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 0.62); sun.position.set(0.45, 0.8, 0.35); scene.add(sun);

const layout = makeLayout();
const gen = trashGen(layout.kind);
const gmap = makeGroundMap(renderer, layout.kind);
const outside = (i, j) => { const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL; if (kindAt(x, z) === 0) return 0; const a = Math.imul((i * 73856093) ^ (j * 19349663), 0x27d4eb2d) >>> 0; return 1 + (a % 3); };
const core = createTrashCore({
  N, cell: CELL, K: CONFIG.trashGen.depthMax, renderer, seed: 3,
  types: CONFIG.trashTypes.map((t) => t.id), zones: gen.zones, mixes: gen.mixes, initial: gen.initial,
  outside, outsideZone: 1, outUnitsShader: 2, groundMap: gmap.tex,
  fadeS: params.has('shots') ? 0 : CONFIG.feedback.cellCleanFadeS,
  light: { sunDir: sun.position, sunColor: sun.color.clone().multiplyScalar(sun.intensity), skyColor: hemi.color.clone().multiplyScalar(hemi.intensity), groundColor: hemi.groundColor.clone().multiplyScalar(hemi.intensity) },
});
scene.add(core.group);
scene.add(makeBuildings(renderer, layout.buildings));
scene.add(makeProps());
const sky = makeSky(); scene.add(sky);

// view: yaw is a compass heading in radians (0 = north = -z, π/2 = east = +x); camera.rotation.y = -yaw
const view = { x: CONFIG.player.startPos[0], y: CONFIG.player.eyeHeightM, z: CONFIG.player.startPos[1], yaw: CONFIG.player.startYawDeg * Math.PI / 180, pitch: -0.08 };
function applyView() {
  camera.position.set(view.x, view.y + core.surfaceAt(view.x, view.z) * 0.6, view.z);
  camera.rotation.set(view.pitch, -view.yaw, 0, 'YXZ');
  sky.position.copy(camera.position);
}
function resize(w, h) {
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w >= h ? CONFIG.player.fovVerticalDegLandscape : CONFIG.player.fovVerticalDegPortrait; camera.updateProjectionMatrix();
}
resize(innerWidth, innerHeight);
addEventListener('resize', () => resize(innerWidth, innerHeight));
core.warmup();
let lastT = performance.now();
function frame() {
  applyView();
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const st = core.update(camera.position.x, camera.position.z, dt);
  renderer.render(scene, camera);
  return st;
}

// ---------------------------------------------------------------- harness
const info = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries });
function sweepStroke(x0, z0, x1, z1, hw) { return core.removeAlongSegment(x0, z0, x1, z1, hw); }
window.__spike = {
  core, renderer, scene, camera, view, frame, info, resize, layout, gen: gen.stats,
  setView(v) { Object.assign(view, v); return frame(); },
  textureBytes() {
    const inst = core.lists.reduce((s, l) => s + l.mat.byteLength + l.col.byteLength, 0);
    return { depth: N * N, trashTile: 512 * 512 * 4 * 4 / 3, noise: 128 * 128 * 4 * 4 / 3, groundMap: gmap.bytes, facade: 256 * 256 * 4 * 4 / 3, instanceBuffers: inst };
  },
  // carve trails so screenshots show cleaned ground: broom strip, wavy walk, robot patch, cart swath
  carve() {
    for (let z = 50; z > 8; z -= 0.5) sweepStroke(26.2, z, 26.2, z - 0.5, 0.5);            // 1.0 m broom strip up street x=24..30
    for (let k = 0; k < 30; k++) { const a = k * 0.45; sweepStroke(28.3 + Math.sin(a) * 0.8, 40 - k, 28.3 + Math.sin(a + 0.45) * 0.8, 39 - k, 0.5); }
    for (let x = 31; x < 47; x += 0.5) sweepStroke(x, 25, x, 29, 0.25);                     // robot lawnmower patch on the cross street
    sweepStroke(3, 52, 3, 2, 0.9);                                                           // 1.8 m cart swath down the west street
    core.removeInCircle(27, 51, 1.6, 1e9);                                                   // clean spot at the camera
    for (let k = 0; k < 160; k++) core.removeInCircle(29 + (k % 8) * 0.25, 46 + ((k / 8) | 0) * 0.25, 0.25, 1); // thinned patch
    return { cleanFraction: core.cleanFraction(), unitFraction: core.unitFraction() };
  },
  // per-frame JS cost of: player stroke (halfWidth hw) + R robots + update/flush over M frames.
  // performance.now() is coarsened to 0.1 ms here, so we report total/frames rather than per-frame percentiles.
  benchSweep(frames = 180, robots = 3, hw = 0.75, step = 0.07) {
    let cells = 0, units = 0, rows = 0, inst = 0, maxRows = 0;
    let x = 25, z = 52;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      const r = sweepStroke(x, z, x, z - step, hw); units += r.units; cells += r.cells;
      for (let k = 0; k < robots; k++) { const rr = core.removeInCircle(3 + (k % 3) * 24 + f * 0.03, 3 + ((k * 7) % 48), 0.45, 6); units += rr.units; cells += rr.cells; }
      const st = core.update(x, z, 1 / 60); rows += st.rowsUploaded; maxRows = Math.max(maxRows, st.rowsUploaded); inst = st.instances;
      z -= step; if (z < 2) { z = 52; x += 2 * hw; if (x > 30) x = 25; }
    }
    const ms = performance.now() - t0;
    renderer.render(scene, camera);
    return { frames, msPerFrame: +(ms / frames).toFixed(4), cellsPerFrame: +(cells / frames).toFixed(1), unitsPerFrame: +(units / frames).toFixed(1), rowsPerFrame: +(rows / frames).toFixed(1), maxRows, instances: inst };
  },
  // worst case: n random cells anywhere in the district lose a unit every frame (many robots + player)
  benchStress(frames = 200, n = 50) {
    const N = core.N; let seed = 12345, rows = 0, changed = 0;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      for (let k = 0; k < n; k++) {
        // half near the camera (inside the item window), half anywhere
        const near = k & 1, x = near ? 27 + (rnd() - 0.5) * 16 : rnd() * 54, z = near ? 40 + (rnd() - 0.5) * 16 : rnd() * 54;
        const i = Math.floor(x / 0.5), j = Math.floor(z / 0.5), u = core.grid[j * N + i];
        if (u) { core.setCell(i, j, u - 1); changed++; }
      }
      rows += core.update(27, 40, 1 / 60).rowsUploaded;
    }
    const ms = performance.now() - t0;
    renderer.render(scene, camera);
    return { frames, cellsPerFrame: +(changed / frames).toFixed(1), msPerFrame: +(ms / frames).toFixed(3), rowsPerFrame: +(rows / frames).toFixed(1) };
  },
  benchWalk(frames = 600, speed = 0.08) {
    let rec = 0, n = 0; let z = 53;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) { const st = core.update(27, z); if (st.recentered) { rec += st.recentered; n++; } z -= speed; if (z < 1) z = 53; }
    return { frames, msPerFrame: +((performance.now() - t0) / frames).toFixed(4), recenters: n, cellsPerRecenter: +(rec / Math.max(1, n)).toFixed(1) };
  },
  benchTeleport(n = 20) { const t0 = performance.now(); let st; for (let i = 0; i < n; i++) { st = core.update(i % 2 ? 3 : 27, i % 2 ? 3 : 50); } return { msPerFullRebuild: +((performance.now() - t0) / n).toFixed(3), cells: core.W * core.W, instances: st.instances }; },
  benchRender(n = 30) { const gl = renderer.getContext(), px = new Uint8Array(4); const t0 = performance.now(); for (let i = 0; i < n; i++) { renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } const a = (performance.now() - t0) / n; const t1 = performance.now(); for (let i = 0; i < n; i++) renderer.render(scene, camera); return { msRenderSubmitJS: +((performance.now() - t1) / n).toFixed(3), msRenderSwiftShaderSync: +a.toFixed(1) }; },
  benchSave() { const t0 = performance.now(); const s = core.serialize(); const a = performance.now() - t0; const before = core.totalUnits(); const t1 = performance.now(); const r = core.deserialize(s); const b = performance.now() - t1; core.update(camera.position.x, camera.position.z); return { bytes: s.length, msSave: +a.toFixed(1), msLoad: +b.toFixed(1), ok: r.ok, exact: r.exact, roundTrip: before === core.totalUnits() }; },
  benchNearest(n = 200) { const t0 = performance.now(); let hits = 0; for (let i = 0; i < n; i++) if (core.nearestDirty(2 + (i % 10) * 5, 2 + ((i / 10) | 0) * 2.5, 30) >= 0) hits++; return { msEach: (performance.now() - t0) / n, hits }; },
};
function summarize(o) {
  const r = {};
  for (const k in o) { const a = o[k].slice().sort((p, q) => p - q); const s = a.reduce((p, q) => p + q, 0); r[k] = { avg: +(s / a.length).toFixed(3), p95: +a[Math.floor(a.length * 0.95)].toFixed(3), max: +a[a.length - 1].toFixed(3) }; }
  return r;
}

// interactive mode: drag to look, WASD to move, space to sweep (for manual checking only)
if (!params.has('shots')) {
  const keys = {}; addEventListener('keydown', (e) => keys[e.code] = true); addEventListener('keyup', (e) => keys[e.code] = false);
  let drag = null; canvas.addEventListener('pointerdown', (e) => drag = [e.clientX, e.clientY]); addEventListener('pointerup', () => drag = null);
  addEventListener('pointermove', (e) => { if (!drag) return; view.yaw -= (e.clientX - drag[0]) * 0.004; view.pitch = Math.max(-1.4, Math.min(1.2, view.pitch - (e.clientY - drag[1]) * 0.004)); drag = [e.clientX, e.clientY]; });
  const hud = document.getElementById('hud'); let last = performance.now(), acc = 0, fr = 0;
  (function loop() {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sp = 4 * dt, sy = Math.sin(view.yaw), cy = Math.cos(view.yaw);
    view.x += (-sy * f + cy * s) * sp; view.z += (-cy * f - sy * s) * sp;
    if (keys.Space) sweepStroke(view.x - sy * 1.2, view.z - cy * 1.2, view.x - sy * 1.3, view.z - cy * 1.3, 0.8);
    frame(); acc += dt; fr++;
    if (acc > 0.5) { hud.textContent = `${(fr / acc).toFixed(0)} fps  calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}  inst ${core.stats.instances}  clean ${(core.cleanFraction() * 100).toFixed(2)}%`; acc = 0; fr = 0; }
    requestAnimationFrame(loop);
  })();
} else frame();
window.__spikeReady = true;
