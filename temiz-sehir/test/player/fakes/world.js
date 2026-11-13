// TEST FAKE of www/js/world.js (player/tools tests only). Layout, ground map, buildings, props, sky from
// test/spike/spike.js; collision = circle vs. block AABBs + district bounds. Not the real world module.
const DEG = Math.PI / 180;
let ctx, THREE, D, CELL, N, SIZE, SW, OFFS, layoutObj, gtex, light, sky, solids = [], pts = [];
const inRect = (x, z, r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function kindAtLocal(x, z, home) { for (const b of D.blocks) if (inRect(x, z, b.rect)) return (b.kind === 'plaza' && home) ? (inRect(x, z, D.shopKiosk.rect) ? 0 : 2) : 0; return 1; }
export function kindAt(x, z) { const home = x >= 0 && z >= 0 && x < SIZE && z < SIZE; const lx = ((x % SIZE) + SIZE) % SIZE, lz = ((z % SIZE) + SIZE) % SIZE; return kindAtLocal(lx, lz, home); }

export function init(c) {
  ctx = c; THREE = c.THREE; D = c.CONFIG.district; CELL = D.cellM; N = D.grid[0]; SIZE = D.sizeM[0]; SW = D.streetWidthM; OFFS = D.streetOffsetsM;
  const kind = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) kind[j * N + i] = kindAt((i + 0.5) * CELL, (j + 0.5) * CELL);
  const rnd = mulberry(42), buildings = [];
  const R = D.surroundings.neighbourRingDistricts;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const home = dx === 0 && dz === 0;
    for (const b of D.blocks) {
      if (b.kind === 'plaza' && home) continue;
      const [x0, z0, x1, z1] = b.rect, ox = dx * SIZE, oz = dz * SIZE, hr = b.heightM || [12, 30];
      const nz = rnd() < 0.5 ? 2 : 3;
      for (let a = 0; a < 2; a++) for (let cc = 0; cc < nz; cc++) {
        const w = (x1 - x0) / 2, d = (z1 - z0) / nz, h = home ? hr[0] + rnd() * (hr[1] - hr[0]) : 10 + rnd() * 26;
        buildings.push({ x0: ox + x0 + a * w, z0: oz + z0 + cc * d, x1: ox + x0 + (a + 1) * w, z1: oz + z0 + (cc + 1) * d, h, tint: (rnd() * 6) | 0 });
      }
    }
  }
  layoutObj = { size: SIZE, cell: CELL, N, bounds: { x0: 0, z0: 0, x1: SIZE, z1: SIZE }, kind, buildings };
  for (const b of D.blocks) if (b.kind === 'building') solids.push(b.rect);
  solids.push(D.shopKiosk.rect);
  const s = c.scene, FOG = new THREE.Color('#cdd7dc');
  s.fog = new THREE.Fog(FOG, 30, 230); s.background = FOG;
  const hemi = new THREE.HemisphereLight(0xbfd2e6, 0x6e6152, 0.62); s.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.62); sun.position.set(0.45, 0.8, 0.35); s.add(sun);
  light = { sunDir: sun.position.clone().normalize(), sunColor: sun.color.clone().multiplyScalar(sun.intensity), skyColor: hemi.color.clone().multiplyScalar(hemi.intensity), groundColor: hemi.groundColor.clone().multiplyScalar(hemi.intensity), fogColor: FOG };
  gtex = groundMap(kind);
  s.add(makeBuildings(buildings)); s.add(makeProps()); sky = makeSky(); s.add(sky);
  const P = c.CONFIG.player;
  pts = [{ id: 'spawn', x: P.startPos[0], z: P.startPos[1], r: 0, yaw: P.startYawDeg * DEG },
    { id: 'shop', x: c.CONFIG.sellPoints[0].pos[0], z: c.CONFIG.sellPoints[0].pos[1], r: 2.5, yaw: 0 }, { id: 'cartPark', x: c.CONFIG.cart.parkPos[0], z: c.CONFIG.cart.parkPos[1], r: 0, yaw: c.CONFIG.cart.parkYawDeg * DEG }];
}
export function update() { sky.position.copy(ctx.camera.position); }
export function layout() { return layoutObj; }
export function groundTexture() { return gtex; }
export function lighting() { return light; }
export function points() { return pts; }
export function point(id) { return pts.find((p) => p.id === id) || null; }
export function outsideUnits(i, j) { const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL; if (kindAt(x, z) === 0) return 0; const a = Math.imul((i * 73856093) ^ (j * 19349663), 0x27d4eb2d) >>> 0; return 1 + (a % 3); }
export function isBlocked(x, z, r = 0) {
  if (x < r || z < r || x > SIZE - r || z > SIZE - r) return true;
  for (const q of solids) { const cx = Math.max(q[0], Math.min(q[2], x)), cz = Math.max(q[1], Math.min(q[3], z)); const dx = x - cx, dz = z - cz; if (dx * dx + dz * dz < r * r || (x > q[0] && x < q[2] && z > q[1] && z < q[3])) return true; }
  return false;
}
export function collide(x, z, r, out) {
  let hit = false;
  for (let it = 0; it < 2; it++) for (const q of solids) {
    const inside = x > q[0] && x < q[2] && z > q[1] && z < q[3];
    if (inside) { // push out along the smallest axis
      const l = x - q[0], rr = q[2] - x, t = z - q[1], b = q[3] - z, m = Math.min(l, rr, t, b);
      if (m === l) x = q[0] - r; else if (m === rr) x = q[2] + r; else if (m === t) z = q[1] - r; else z = q[3] + r; hit = true; continue;
    }
    const cx = Math.max(q[0], Math.min(q[2], x)), cz = Math.max(q[1], Math.min(q[3], z)), dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-6, p = r - d; x += dx / d * p; z += dz / d * p; hit = true; }
  }
  const nx = Math.max(r, Math.min(SIZE - r, x)), nz = Math.max(r, Math.min(SIZE - r, z));
  if (nx !== x || nz !== z) hit = true;
  out.x = nx; out.z = nz; out.hit = hit; return out;
}
export function segmentClear(x0, z0, x1, z1, r) { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25) + 1; for (let k = 0; k <= n; k++) { const t = k / n; if (isBlocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r)) return false; } return true; }

function groundMap(kind) {
  const PX = 16, S = SIZE * PX, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), rnd = mulberry(7), cell = CELL * PX;
  const near = (x, z) => D.blocks.some((b) => b.kind === 'building' && x > b.rect[0] - 1 && x < b.rect[2] + 1 && z > b.rect[1] - 1 && z < b.rect[3] + 1);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = kind[j * N + i], x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    g.fillStyle = k === 0 ? '#2a2a2a' : k === 2 ? '#a39684' : near(x, z) ? '#8e8b85' : '#3a3c3f';
    g.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
  }
  for (let k = 0; k < 40000; k++) { const v = 40 + rnd() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},0.3)`; g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  g.fillStyle = '#d8d6cc';
  for (const o of OFFS) for (let t = 0; t < SIZE; t += 3) { const cx = o + SW / 2; if (!OFFS.some((q) => t + 1 > q && t < q + SW)) { g.fillRect((cx - 0.06) * PX, t * PX, 0.12 * PX, 1.5 * PX); g.fillRect(t * PX, (cx - 0.06) * PX, 1.5 * PX, 0.12 * PX); } }
  const t = new THREE.CanvasTexture(c); t.flipY = false; return t;
}
function makeBuildings(list) {
  const P = [], C = [], I = [];
  const TINTS = ['#f1e6d2', '#e8c9a0', '#d9d9d6', '#e3b39a', '#f4f1ea', '#c9d1c8'].map((c) => new THREE.Color(c));
  const quad = (a, b, c, d, col) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) C.push(col.r, col.g, col.b); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  for (const b of list) {
    const { x0, z0, x1, z1, h } = b, col = TINTS[b.tint];
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], col); quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], col);
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], col); quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], col);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setIndex(I); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
function makeProps() {
  const P = [], C = [], I = [];
  const box = (x, y, z, sx, sy, sz, col) => { const o = P.length / 3, hx = sx / 2, hz = sz / 2; for (const p of [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [-hx, sy, -hz], [hx, sy, -hz], [hx, sy, hz], [-hx, sy, hz]]) { P.push(x + p[0], y + p[1], z + p[2]); C.push(col.r, col.g, col.b); } I.push(o, o + 1, o + 5, o, o + 5, o + 4, o + 1, o + 2, o + 6, o + 1, o + 6, o + 5, o + 2, o + 3, o + 7, o + 2, o + 7, o + 6, o + 3, o, o + 4, o + 3, o + 4, o + 7, o + 4, o + 5, o + 6, o + 4, o + 6, o + 7); };
  const [kx0, kz0, kx1, kz1] = D.shopKiosk.rect;
  box((kx0 + kx1) / 2, 0, (kz0 + kz1) / 2, kx1 - kx0, D.shopKiosk.heightM, kz1 - kz0, new THREE.Color('#2f7d5b'));
  box((kx0 + kx1) / 2, D.shopKiosk.heightM, (kz0 + kz1) / 2 + 0.2, kx1 - kx0 + 0.6, 0.15, kz1 - kz0 + 1.2, new THREE.Color('#e9c46a'));
  const red = new THREE.Color('#c8402c'), white = new THREE.Color('#e8e8e8');
  for (const o of OFFS) for (const edge of [0.3, SIZE - 0.3]) for (let k = 0; k < SW; k += 2) { box(o + k + 1, 0, edge, 1.8, 1.05, 0.15, (k / 2) & 1 ? red : white); box(edge, 0, o + k + 1, 0.15, 1.05, 1.8, (k / 2) & 1 ? red : white); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setIndex(I); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
function makeSky() {
  const geo = new THREE.SphereGeometry(440, 24, 12), p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const zen = new THREE.Color('#5f8fcf'), hor = new THREE.Color('#cdd7dc'), low = new THREE.Color('#b8c0c2'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 440; if (y >= 0) c.copy(hor).lerp(zen, Math.pow(y, 0.6)); else c.copy(hor).lerp(low, Math.min(1, -y * 4)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}
