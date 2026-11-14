// Pure (no THREE, no DOM) copy of the reference layout + trashGen from test/spike/spike.js, so the economy tests
// and the balance bot use the same district as the game. Not a contract: world.js / trash.js own the real ones.
export function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeCity(CONFIG) {
  const D = CONFIG.district, CELL = D.cellM, N = D.grid[0], SIZE = D.sizeM[0];
  const inRect = (x, z, r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];
  function kindAtLocal(x, z, home) {
    for (const b of D.blocks) if (inRect(x, z, b.rect)) return (b.kind === 'plaza' && home) ? (inRect(x, z, D.shopKiosk.rect) ? 0 : 2) : 0;
    return 1;
  }
  function kindAt(x, z) {
    const home = x >= 0 && z >= 0 && x < SIZE && z < SIZE;
    const lx = ((x % SIZE) + SIZE) % SIZE, lz = ((z % SIZE) + SIZE) % SIZE;
    return kindAtLocal(lx, lz, home);
  }
  const kind = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) kind[j * N + i] = kindAt((i + 0.5) * CELL, (j + 0.5) * CELL);
  // buildings (district + neighbours), same RNG sequence as the spike
  const rnd = mulberry(42), buildings = [], R = D.surroundings.neighbourRingDistricts;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const home = dx === 0 && dz === 0;
    for (const b of D.blocks) {
      if (b.kind === 'plaza' && home) continue;
      const [x0, z0, x1, z1] = b.rect, ox = dx * SIZE, oz = dz * SIZE, hr = b.heightM || [12, 30];
      const nx = 2, nz = rnd() < 0.5 ? 2 : 3;
      for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
        const w = (x1 - x0) / nx, d = (z1 - z0) / nz;
        const h = home ? hr[0] + rnd() * (hr[1] - hr[0]) : 10 + rnd() * 26;
        buildings.push({ x0: ox + x0 + a * w, z0: oz + z0 + c * d, x1: ox + x0 + (a + 1) * w, z1: oz + z0 + (c + 1) * d, h, tint: (rnd() * 6) | 0 });
      }
    }
  }
  // trashGen
  const G = CONFIG.trashGen;
  function valueNoise(seed) {
    const h = (x, z) => { let a = (x * 374761393 + z * 668265263 + seed * 2246822519) | 0; a = Math.imul(a ^ (a >>> 13), 1274126177); return (((a ^ (a >>> 16)) >>> 0) / 4294967296) * 2 - 1; };
    const s = (t) => t * t * (3 - 2 * t);
    return (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = s(x - xi), fz = s(z - zi);
      const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
      return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz; };
  }
  const grnd = mulberry(G.seed), noise = valueNoise(G.seed);
  const zones = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) zones[i] = kind[i] === 1 ? 1 : kind[i] === 2 ? 2 : 0;
  const corners = [];
  for (const b of D.blocks) if (b.kind === 'building') { const [x0, z0, x1, z1] = b.rect; corners.push([x0 - 1, z0 - 1], [x1 + 1, z0 - 1], [x0 - 1, z1 + 1], [x1 + 1, z1 + 1]); }
  const piles = [];
  for (let k = 0; k < G.piles.count; k++) { const c = corners[(grnd() * corners.length) | 0]; piles.push([c[0] + (grnd() - 0.5) * 3, c[1] + (grnd() - 0.5) * 3, G.piles.radiusM[0] + grnd() * (G.piles.radiusM[1] - G.piles.radiusM[0])]); }
  const raw = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const idx = j * N + i; if (!zones[idx]) continue;
    const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    let v = (zones[idx] === 2 ? G.zoneBase.plaza : G.zoneBase.street) + G.noiseAmp * noise(x / G.noiseScaleM, z / G.noiseScaleM);
    for (const [px, pz, r] of piles) { const d = Math.hypot(x - px, z - pz); if (d < r) { v += G.piles.add * (1 - d / r); zones[idx] = 3; } }
    raw[idx] = v;
  }
  const initial = new Uint8Array(N * N);
  const apply = (shift) => { let s = 0, c = 0; for (let i = 0; i < N * N; i++) { if (!zones[i]) continue; const u = Math.max(G.depthMin, Math.min(G.depthMax, Math.round(raw[i] + shift))); initial[i] = u; s += u; c++; } return { mean: s / c, cells: c, total: s }; };
  let lo = -3, hi = 3, st;
  for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; st = apply(m); if (st.mean > G.targetMeanDepth) hi = m; else lo = m; }
  st = apply((lo + hi) / 2);
  const mixes = [null, 'street', 'plaza', 'pile'].map((z) => z && Object.assign({}, CONFIG.zoneMix[z], { valuable: CONFIG.valuableChance[z] }));
  const outsideUnits = (i, j) => { const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL; if (kindAt(x, z) === 0) return 0; const a = Math.imul((i * 73856093) ^ (j * 19349663), 0x27d4eb2d) >>> 0; return 1 + (a % 3); };
  return { N, CELL, SIZE, kind, kindAt, buildings, zones, initial, mixes, stats: st, outsideUnits };
}

// Minimal world API (§4.2 subset the economy uses) on top of the city layout. Pure.
export function makeFakeWorld(CONFIG, city, extraBlocked) {
  const { N, CELL, SIZE, kind } = city;
  const pts = [
    { id: 'spawn', x: CONFIG.player.startPos[0], z: CONFIG.player.startPos[1], r: 0, yaw: Math.PI },
    { id: 'shop', x: CONFIG.sellPoints[0].pos[0], z: CONFIG.sellPoints[0].pos[1], r: CONFIG.sellPoints[0].radiusM, yaw: 0 },
    { id: 'dropoff', x: CONFIG.sellPoints[1].pos[0], z: CONFIG.sellPoints[1].pos[1], r: CONFIG.sellPoints[1].radiusM, yaw: 0 },
    { id: 'dock', x: CONFIG.robot.dockPos[0], z: CONFIG.robot.dockPos[1], r: 0.5, yaw: 0 },
    { id: 'cartPark', x: CONFIG.cart.parkPos[0], z: CONFIG.cart.parkPos[1], r: 1, yaw: Math.PI },
  ];
  const solidAt = (x, z) => { if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) return true; const i = Math.floor(x / CELL), j = Math.floor(z / CELL); return kind[j * N + i] === 0 || !!(extraBlocked && extraBlocked(x, z)); };
  return {
    layout: () => ({ size: SIZE, cell: CELL, N, bounds: { x0: 0, z0: 0, x1: SIZE, z1: SIZE }, kind, buildings: city.buildings }),
    points: () => pts, point: (id) => pts.find((p) => p.id === id) || null,
    kindAt: (x, z) => city.kindAt(x, z), outsideUnits: city.outsideUnits,
    isBlocked: (x, z, r = 0) => solidAt(x, z) || (r > 0 && (solidAt(x - r, z) || solidAt(x + r, z) || solidAt(x, z - r) || solidAt(x, z + r))),
    collide(x, z, r, out) { out.x = Math.max(r, Math.min(SIZE - r, x)); out.z = Math.max(r, Math.min(SIZE - r, z)); out.hit = out.x !== x || out.z !== z; return out; },
    segmentClear: () => true,
  };
}
