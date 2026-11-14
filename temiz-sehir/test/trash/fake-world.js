// Minimal fake of world.js for trash tests (MIMARI §4.2 subset): layout, ground texture, lighting,
// outsideUnits, plus buildings, sky, lights and fog so screenshots have context. Layout / ground map /
// buildings follow the reference in test/spike/spike.js. Test-only: never loaded by the game.
let L = null, light = null, groundTex = null, CONFIG = null, sky = null, cam = null;

function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inRect = (x, z, r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];

function kindAtXZ(x, z) {
  const D = CONFIG.district, S = D.sizeM[0];
  const home = x >= 0 && z >= 0 && x < S && z < S;
  const lx = ((x % S) + S) % S, lz = ((z % S) + S) % S;
  for (const b of D.blocks) if (inRect(lx, lz, b.rect)) return (b.kind === 'plaza' && home) ? (inRect(lx, lz, D.shopKiosk.rect) ? 0 : 2) : 0;
  return 1;
}

export function init(ctx) {
  const THREE = ctx.THREE; CONFIG = ctx.CONFIG; cam = ctx.camera;
  const D = CONFIG.district, CELL = D.cellM, N = D.grid[0], S = D.sizeM[0], SW = D.streetWidthM, OFFS = D.streetOffsetsM;
  const kind = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) kind[j * N + i] = kindAtXZ((i + 0.5) * CELL, (j + 0.5) * CELL);
  const rnd = mulberry(42), buildings = [];
  const R = D.surroundings.neighbourRingDistricts;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const home = dx === 0 && dz === 0;
    for (const b of D.blocks) {
      if (b.kind === 'plaza' && home) continue;
      const [x0, z0, x1, z1] = b.rect, ox = dx * S, oz = dz * S, hr = b.heightM || [12, 30];
      const nz = rnd() < 0.5 ? 2 : 3;
      for (let a = 0; a < 2; a++) for (let c = 0; c < nz; c++) {
        const w = (x1 - x0) / 2, d = (z1 - z0) / nz;
        const h = home ? hr[0] + rnd() * (hr[1] - hr[0]) : 10 + rnd() * 26;
        buildings.push({ x0: ox + x0 + a * w, z0: oz + z0 + c * d, x1: ox + x0 + (a + 1) * w, z1: oz + z0 + (c + 1) * d, h, blockId: b.id, tint: (rnd() * 6) | 0 });
      }
    }
  }
  L = { size: S, cell: CELL, N, bounds: { x0: 0, z0: 0, x1: S, z1: S }, kind, buildings };

  // ground map
  const PX = 16, CS = S * PX, cv = document.createElement('canvas'); cv.width = cv.height = CS;
  const g = cv.getContext('2d'), gr = mulberry(7), cpx = CELL * PX;
  const nearB = (x, z) => D.blocks.some((b) => b.kind === 'building' && x > b.rect[0] - 1 && x < b.rect[2] + 1 && z > b.rect[1] - 1 && z < b.rect[3] + 1);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = kind[j * N + i], x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    g.fillStyle = k === 0 ? '#2a2a2a' : k === 2 ? '#a39684' : nearB(x, z) ? '#8e8b85' : '#3a3c3f';
    g.fillRect(i * cpx, j * cpx, cpx + 0.5, cpx + 0.5);
    if (k === 2 || (k === 1 && nearB(x, z))) { g.strokeStyle = 'rgba(60,58,55,0.45)'; g.lineWidth = 1; g.strokeRect(i * cpx + 0.5, j * cpx + 0.5, cpx - 1, cpx - 1); }
  }
  for (let k = 0; k < 40000; k++) { const v = 40 + gr() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},0.3)`; g.fillRect(gr() * CS, gr() * CS, 1.5, 1.5); }
  g.fillStyle = '#d8d6cc';
  for (const o of OFFS) for (let t = 0; t < S; t += 3) {
    const cx = o + SW / 2;
    if (!OFFS.some((q) => t + 1 > q && t < q + SW)) { g.fillRect((cx - 0.06) * PX, t * PX, 0.12 * PX, 1.5 * PX); g.fillRect(t * PX, (cx - 0.06) * PX, 1.5 * PX, 0.12 * PX); }
  }
  groundTex = new THREE.CanvasTexture(cv); groundTex.flipY = false;
  groundTex.anisotropy = Math.min(4, ctx.renderer.capabilities.getMaxAnisotropy());

  // lights, fog
  const fog = new THREE.Color('#cdd7dc');
  ctx.scene.fog = new THREE.Fog(fog, 30, 230); ctx.scene.background = fog;
  const hemi = new THREE.HemisphereLight(0xbfd2e6, 0x6e6152, 0.62); ctx.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.62); sun.position.set(0.45, 0.8, 0.35); ctx.scene.add(sun);
  light = { sunDir: sun.position.clone().normalize(), sunColor: sun.color.clone().multiplyScalar(sun.intensity), skyColor: hemi.color.clone().multiplyScalar(hemi.intensity), groundColor: hemi.groundColor.clone().multiplyScalar(hemi.intensity), fogColor: fog };

  // buildings: 1 merged mesh, plain tints (no facade texture needed for trash tests)
  const P = [], C = [], I = [];
  const TINTS = ['#f1e6d2', '#e8c9a0', '#d9d9d6', '#e3b39a', '#f4f1ea', '#c9d1c8'].map((c) => new THREE.Color(c));
  const quad = (a, b, c, d, col) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) C.push(col.r, col.g, col.b); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  const roof = new THREE.Color(0.32, 0.31, 0.3);
  for (const b of buildings) {
    const { x0, z0, x1, z1, h } = b, col = TINTS[b.tint];
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], col); quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], col);
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], col); quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], col);
    quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], roof);
  }
  const [kx0, kz0, kx1, kz1] = D.shopKiosk.rect, kh = D.shopKiosk.heightM, kc = new THREE.Color('#2f7d5b');
  quad([kx0, 0, kz1], [kx1, 0, kz1], [kx1, kh, kz1], [kx0, kh, kz1], kc); quad([kx1, 0, kz0], [kx0, 0, kz0], [kx0, kh, kz0], [kx1, kh, kz0], kc);
  quad([kx1, 0, kz1], [kx1, 0, kz0], [kx1, kh, kz0], [kx1, kh, kz1], kc); quad([kx0, 0, kz0], [kx0, 0, kz1], [kx0, kh, kz1], [kx0, kh, kz0], kc);
  quad([kx0, kh, kz1], [kx1, kh, kz1], [kx1, kh, kz0], [kx0, kh, kz0], new THREE.Color('#e9c46a'));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); geo.computeVertexNormals();
  ctx.scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // sky
  const sg = new THREE.SphereGeometry(440, 24, 12), sp = sg.attributes.position, scol = new Float32Array(sp.count * 3);
  const zen = new THREE.Color('#5f8fcf'), hor = new THREE.Color('#cdd7dc'), c = new THREE.Color();
  for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / 440; if (y >= 0) c.copy(hor).lerp(zen, Math.pow(y, 0.6)); else c.copy(hor); scol[i * 3] = c.r; scol[i * 3 + 1] = c.g; scol[i * 3 + 2] = c.b; }
  sg.setAttribute('color', new THREE.BufferAttribute(scol, 3));
  sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  ctx.scene.add(sky);
}
export function update() { if (sky) sky.position.copy(cam.position); }
export function layout() { return L; }
export function groundTexture() { return groundTex; }
export function lighting() { return light; }
export function points() { return []; }
export function point() { return null; }
export function kindAt(x, z) { const k = kindAtXZ(x, z); const S = CONFIG.district.sizeM[0]; return (x < 0 || z < 0 || x >= S || z >= S) && k === 2 ? 0 : k; }
export function outsideUnits(i, j) {
  const CELL = CONFIG.district.cellM, x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
  if (kindAtXZ(x, z) === 0) return 0;
  const a = Math.imul((i * 73856093) ^ (j * 19349663), 0x27d4eb2d) >>> 0; return 1 + (a % 3);
}
export function isBlocked() { return false; }
export function collide(x, z, r, out) { out.x = x; out.z = z; out.hit = false; return out; }
export function segmentClear() { return true; }
