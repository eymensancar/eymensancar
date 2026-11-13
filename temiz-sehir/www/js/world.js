// world.js — the city district: layout and collision API, ground plan texture, buildings (one merged
// mesh with a canvas facade atlas), props (lamps, bins, benches, trees, barriers with "Yakında"
// signs, shop kiosk, drop-off container), sky, fog, lights, sell-point rings, the ground guide arrow,
// milestone city events (birds, streetlights, pedestrians, finale), plaza confetti, promo billboard.
// Owner: world. Contract: docs/MIMARI.md §4.2. Notes: docs/notlar/world.md.
//
// Draw calls (≤ 6 budget): city (buildings + props, MeshLambert with an atlas-tiling patch),
// glow (signs, lamp bulbs, landmark discs: MeshBasic), sky (MeshBasic, follows the camera),
// markers (sell rings, guide arrow, lamp halos: transparent MeshBasic), life (birds, pedestrians,
// confetti: one InstancedMesh, only while something is active) = 5.
// World does NOT draw the ground: trash.js's ground mesh does, with groundTexture().

// ---------------------------------------------------------------------------------- visual tunables
// Visual-only numbers (not game balance, so they live here rather than in config.js).
const VIS = {
  seed: 5150,
  groundPx: 1024,            // ground plan canvas (u = x / size)
  atlasPx: 1024,             // facade/sign atlas canvas
  pavementM: 1.5,            // pavement width along every block (street cells within this of a block)
  kerbM: 0.2,
  groundFloorM: 3.6, floorM: 3.0, corniceM: 0.5, tileM: 12,   // facade tile = 4 bays of 3 m
  neighbourHeightM: [10, 30],
  skyline: { count: 34, radius: [160, 214], height: [36, 84] },
  lampHeightM: 5.2, lampArmM: 1.15,
  pylonHeightM: 17, coinR: 1.45, beaconHeightM: 8.5, beaconR: 0.95,
  fog: { near: 30, far: 230 },
  skyRadius: 440,
  light: { sun: '#fff1d8', sunI: 0.74, sky: '#c4daf0', ground: '#a8987f', hemiI: 0.62, dir: [-0.42, 0.78, -0.46], fog: '#cdd7dc' },
  skyCol: { zenith: '#4d8ddb', mid: '#8dbbe7' },
  ring: { width: 0.32, seg: 56, lift: 0.05, shop: '#ffe14d', dropoff: '#ff9a3c', alpha: 0.42, alphaFull: 0.9 },
  arrow: { from: 1.4, step: 0.95, n: 3, size: [1.0, 0.75], lift: 0.22, speed: 1.3, color: '#ffe84a' },
  birds: 14, pedestrians: 12, confetti: 140,
};

// ---------------------------------------------------------------------------------- module state
let ctx = null, THREE = null, CFG = null;
let SIZE = 54, CELL = 0.5, N = 108, OFFS = null, BLOCKS = null, KIOSK = null;
let LAYOUT = null, LIGHT = null, PTS = null, PLAZA = null;
let SOL = null, nSol = 0, nSolBase = 0;     // solid AABBs (x0, z0, x1, z1): building blocks, kiosk, container
let BX0 = 0, BZ0 = 0, BX1 = 54, BZ1 = 54;   // walkable bounds
let WP = null, nWP = 0, WPC = null;         // guide waypoints (x, z) and their pairwise clearance
const R = {};                               // atlas regions: name -> [x, y, w, h] px
let groundTex = null, atlasTex = null, atlasCanvas = null, atlasLang = '';
let city = null, glow = null, sky = null, mark = null, life = null, hemi = null, sun = null;
let cityBase = 0, glowBase = 0, dropShown = false;
let bulbFrom = 0, bulbTo = 0, haloIdx = 0;
let ringFrom = 0, arrowFrom = 0, ringState = null;
let lampsOn = false, ev = 0;                // ev bits: 1 birds, 2 streetlights, 4 pedestrians, 8 finale
let tAnim = 0, pollT = 0, langT = 0, arrowOn = false, arrowPhase = 0, bagFull = false;
const route = { x: 0, z: 0, tx: 0, tz: 0, tr: 0, px: 0, pz: 0, ok: false };
let dummy = null, tmpCol = null, peds = null;
let cf = null, cfN = 0;                     // confetti state (typed arrays)
const bursts = new Float64Array(16), burstKind = new Uint8Array(8); let nBursts = 0;
const EV = { birds: 1, streetlights: 2, pedestrians: 4, finale: 8 };

// ---------------------------------------------------------------------------------- small helpers
function mulberry(seed) { let s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(i, j, s) { let a = Math.imul(i ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(j + 0x165667b1, 0xc2b2ae35) ^ s; a = Math.imul(a ^ (a >>> 15), 0x2c1b3c6d); a = Math.imul(a ^ (a >>> 12), 0x297a2d39); return (a ^ (a >>> 15)) >>> 0; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function C3(hex, k) { const c = new THREE.Color(hex); if (k != null) c.multiplyScalar(k); return c; }
function mulC(c, k) { return { r: c.r * k, g: c.g * k, b: c.b * k }; }
function warnOnce(key, msg) { warnOnce.s = warnOnce.s || {}; if (warnOnce.s[key]) return; warnOnce.s[key] = 1; console.warn('[world] ' + msg); }
function str(key, fallback) { try { const s = ctx.t(key); return s && s !== key ? s : fallback; } catch (e) { return fallback; } }
function lang() { return (ctx.state && ctx.state.settings && ctx.state.settings.lang) || 'tr'; }
function upper(s) { try { return s.toLocaleUpperCase(lang() === 'tr' ? 'tr-TR' : 'en'); } catch (e) { return s.toUpperCase(); } }

// ================================================================================== layout
function kindLocal(lx, lz, home) {
  for (let b = 0; b < BLOCKS.length; b++) {
    const B = BLOCKS[b];
    if (lx >= B.x0 && lx < B.x1 && lz >= B.z0 && lz < B.z1) {
      if (B.plaza && home) return (lx >= KIOSK.x0 && lx < KIOSK.x1 && lz >= KIOSK.z0 && lz < KIOSK.z1) ? 0 : 2;
      return 0;
    }
  }
  return 1;
}
function readConfig() {
  const D = CFG.district;
  SIZE = D.sizeM[0]; CELL = D.cellM; N = D.grid[0]; OFFS = D.streetOffsetsM.slice();
  BLOCKS = D.blocks.map((b) => ({ id: b.id, x0: b.rect[0], z0: b.rect[1], x1: b.rect[2], z1: b.rect[3], plaza: b.kind === 'plaza', h: b.heightM || VIS.neighbourHeightM, promo: !!b.promoBillboard }));
  const k = D.shopKiosk; KIOSK = { x0: k.rect[0], z0: k.rect[1], x1: k.rect[2], z1: k.rect[3], h: k.heightM };
  BX0 = 0; BZ0 = 0; BX1 = SIZE; BZ1 = SIZE;
}
function splitLen(len, parts, rnd) {
  // split len into `parts` pieces, multiples of the bay (3 m) when possible, each >= 2 bays
  const bay = VIS.floorM, bays = Math.floor(len / bay + 1e-6);
  parts = Math.max(1, Math.min(parts, Math.floor(bays / 2) || 1));
  const cuts = []; let left = bays;
  for (let p = 0; p < parts - 1; p++) { const rest = parts - 1 - p, mx = left - 2 * rest; const n = 2 + Math.floor(rnd() * Math.max(1, mx - 1)); cuts.push(Math.min(n, mx) * bay); left -= Math.min(n, mx); }
  let s = 0; for (const c of cuts) s += c; cuts.push(len - s);
  return cuts;
}
function makeLayout() {
  const kind = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) kind[j * N + i] = kindLocal((i + 0.5) * CELL, (j + 0.5) * CELL, true);
  const rnd = mulberry(VIS.seed), lots = [], buildings = [];
  const RING = Math.max(0, CFG.district.surroundings ? CFG.district.surroundings.neighbourRingDistricts | 0 : 2);
  const GH = VIS.groundFloorM, FH = VIS.floorM, CH = VIS.corniceM;
  for (let dz = -RING; dz <= RING; dz++) for (let dx = -RING; dx <= RING; dx++) {
    const ring = Math.max(Math.abs(dx), Math.abs(dz)), home = ring === 0;
    for (const B of BLOCKS) {
      if (B.plaza && home) continue;
      const ox = dx * SIZE, oz = dz * SIZE, w = B.x1 - B.x0, d = B.z1 - B.z0;
      const pmin = ring >= 2 ? 1 : 2, pmax = ring >= 2 ? 2 : 3;
      const xs = splitLen(w, pmin + Math.floor(rnd() * (pmax - pmin + 1)), rnd);
      const zs = splitLen(d, pmin + Math.floor(rnd() * (pmax - pmin + 1)), rnd);
      const hr = home ? B.h : VIS.neighbourHeightM;
      const fMin = Math.max(1, Math.round((hr[0] - GH - CH) / FH)), fMax = Math.max(fMin, Math.round((hr[1] - GH - CH) / FH));
      const grid = [];
      let zc = B.z0;
      for (let c = 0; c < zs.length; c++) {
        let xc = B.x0;
        for (let a = 0; a < xs.length; a++) {
          const floors = fMin + Math.floor(rnd() * (fMax - fMin + 1));
          const lot = {
            x0: ox + xc, z0: oz + zc, x1: ox + xc + xs[a], z1: oz + zc + zs[c], h: GH + floors * FH + CH,
            blockId: home ? B.id : B.id + '@' + dx + ',' + dz, home, ring, a, c, na: xs.length, nc: zs.length,
            up: (rnd() * 6) | 0, gr: (rnd() * 4) | 0, tint: (rnd() * 9) | 0, uoff: rnd() < 0.5 ? 0 : 0.5, r: rnd(),
          };
          grid.push(lot); lots.push(lot);
          buildings.push({ x0: lot.x0, z0: lot.z0, x1: lot.x1, z1: lot.z1, h: lot.h, blockId: lot.blockId });
          xc += xs[a];
        }
        zc += zs[c];
      }
      for (const l of grid) l.grid = grid;
    }
  }
  // far skyline: towers through the fog, off the street axes so street vistas stay open to the horizon
  const SK = VIS.skyline, cx = SIZE / 2;
  let tries = 0;
  for (let k = 0; k < SK.count && tries < 2000; tries++) {
    const ang = rnd() * Math.PI * 2, rad = SK.radius[0] + rnd() * (SK.radius[1] - SK.radius[0]);
    const x = cx + Math.cos(ang) * rad, z = cx + Math.sin(ang) * rad;
    const lx = ((x % SIZE) + SIZE) % SIZE, lz = ((z % SIZE) + SIZE) % SIZE;
    if (kindLocal(lx, lz, false) !== 0) continue;           // keep the street corridors clear
    const hw = 5 + rnd() * 6, hd = 5 + rnd() * 6, h = SK.height[0] + rnd() * (SK.height[1] - SK.height[0]);
    const lot = { x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd, h, blockId: 'skyline', home: false, ring: 3, up: rnd() < 0.5 ? 3 : 5, gr: 0, tint: (rnd() * 9) | 0, uoff: 0, r: rnd(), grid: null };
    lots.push(lot); buildings.push({ x0: lot.x0, z0: lot.z0, x1: lot.x1, z1: lot.z1, h, blockId: 'skyline' });
    k++;
  }
  return { layout: { size: SIZE, cell: CELL, N, bounds: { x0: BX0, z0: BZ0, x1: BX1, z1: BZ1 }, kind, buildings }, lots };
}

// ================================================================================== atlas (facades, signs)
function defRegions() {
  const r = (n, x, y, w, h) => { R[n] = [x, y, w, h]; };
  r('U0', 0, 0, 512, 128); r('U1', 512, 0, 512, 128); r('U2', 0, 128, 512, 128); r('U3', 512, 128, 512, 128); r('U4', 0, 256, 512, 128); r('U5', 512, 256, 512, 128);
  r('G0', 0, 384, 512, 160); r('G1', 512, 384, 512, 160); r('G2', 0, 544, 512, 160); r('G3', 512, 544, 512, 160);
  r('roof', 0, 704, 128, 128); r('roofTrash', 128, 704, 128, 128); r('kiosk', 256, 704, 256, 128); r('billboard', 512, 704, 256, 128); r('cloud1', 768, 704, 256, 128);
  r('shopSign', 0, 832, 256, 64); r('dropSign', 256, 832, 256, 64); r('soonSign', 512, 832, 256, 64); r('barrier', 768, 832, 128, 64); r('awn0', 896, 832, 64, 64); r('awn1', 960, 832, 64, 64);
  r('awn2', 0, 896, 64, 64); r('awn3', 64, 896, 64, 64); r('white', 128, 896, 64, 64); r('concrete', 192, 896, 64, 64); r('coin', 256, 896, 64, 64); r('drop', 320, 896, 64, 64);
  r('halo', 384, 896, 64, 64); r('chev', 448, 896, 64, 64); r('ring', 512, 896, 128, 64); r('cloud2', 640, 896, 256, 128); r('robot', 896, 896, 64, 64);
}
// rect for the tiling shader: (u0, vBottom, du, -dv) so uv (0,0) = bottom-left of the region
function rect(name, inset) { const [x, y, w, h] = R[name], a = VIS.atlasPx, i = inset == null ? 2 : inset; return [(x + i) / a, (y + h - i) / a, (w - 2 * i) / a, -(h - 2 * i) / a]; }
// direct uv inside a region (fu, fv in 0..1, fv = 0 bottom)
function ruv(name, fu, fv, inset) { const [x, y, w, h] = R[name], a = VIS.atlasPx, i = inset == null ? 2 : inset; return [(x + i + fu * (w - 2 * i)) / a, (y + h - i - fv * (h - 2 * i)) / a]; }

function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function speck(g, x, y, w, h, n, rnd, a, size) {
  for (let k = 0; k < n; k++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`; g.fillRect(x + rnd() * w, y + rnd() * h, size, size); }
}
function glass(g, x, y, w, h, tone) {
  const gr = g.createLinearGradient(x, y, x + w * 0.3, y + h);
  gr.addColorStop(0, tone ? '#c9dcea' : '#b7d3ea'); gr.addColorStop(0.45, '#7fa4c6'); gr.addColorStop(1, '#4b6884');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(x + w * 0.15, y + h); g.lineTo(x + w * 0.45, y + h); g.lineTo(x + w * 0.95, y); g.lineTo(x + w * 0.65, y); g.fill();
  g.restore();
}
function windowBox(g, x, y, w, h, frame, opts) {
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x - 3, y - 3, w + 6, h + 7);
  g.fillStyle = frame; g.fillRect(x - 4, y - 4, w + 8, h + 8);
  glass(g, x, y, w, h, opts && opts.light);
  if (opts && opts.curtain) { g.fillStyle = opts.curtain; g.fillRect(x, y, w * 0.28, h); g.fillRect(x + w * 0.72, y, w * 0.28, h); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + w * 0.27, y, 2, h); g.fillRect(x + w * 0.72, y, 2, h); }
  g.fillStyle = frame; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.36, w, 3);
}
function sill(g, x, y, w, col) { g.fillStyle = col || '#e2dbcf'; g.fillRect(x - 7, y, w + 14, 6); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x - 7, y + 6, w + 14, 3); }
function flowers(g, x, y, w, rnd) {
  g.fillStyle = '#8a5a3a'; g.fillRect(x, y, w, 9); g.fillStyle = '#6b4329'; g.fillRect(x, y + 7, w, 2);
  for (let k = 0; k < w / 3; k++) { g.fillStyle = '#4f9a45'; g.fillRect(x + rnd() * w, y - 4 - rnd() * 5, 3, 5); }
  const fc = ['#e64a4a', '#ff8fb0', '#ffd23f', '#ffffff', '#f06c9b'];
  for (let k = 0; k < w / 4; k++) { g.fillStyle = fc[(rnd() * fc.length) | 0]; g.beginPath(); g.arc(x + 2 + rnd() * (w - 4), y - 3 - rnd() * 6, 2.2, 0, 7); g.fill(); }
}
function wall(g, x, y, w, h, base, rnd, n) { g.fillStyle = base; g.fillRect(x, y, w, h); speck(g, x, y, w, h, n || 900, rnd, 0.06, 2); }
function brick(g, x, y, w, h, base, rnd) {
  g.fillStyle = '#d9cfc2'; g.fillRect(x, y, w, h);
  const bc = new THREE.Color(base);
  for (let row = 0, yy = y; yy < y + h; row++, yy += 8) for (let xx = x - (row & 1 ? 11 : 0); xx < x + w; xx += 22) {
    const k = 0.86 + rnd() * 0.22; g.fillStyle = `rgb(${(bc.r * 255 * k) | 0},${(bc.g * 255 * k) | 0},${(bc.b * 255 * k) | 0})`;
    g.fillRect(Math.max(x, xx + 1), yy + 1, Math.min(20, x + w - xx - 1), 6);
  }
}
function paintUpper(g, name, rnd) {
  const [x, y, w, h] = R[name];
  const bays = 4, bw = w / bays;
  if (name === 'U0') { // plaster, shutters, flower boxes
    wall(g, x, y, w, h, '#f4efe6', rnd);
    for (let b = 0; b < bays; b++) {
      const wx = x + b * bw + 39, wy = y + 26, ww = 50, wh = 70;
      windowBox(g, wx, wy, ww, wh, '#ffffff', { curtain: b === 1 ? '#f3d9b0' : null });
      const sh = b % 2 ? '#4e8f6d' : '#4a7cab';
      for (const s of [-1, 1]) { const sx = s < 0 ? wx - 27 : wx + ww + 5; g.fillStyle = sh; g.fillRect(sx, wy - 2, 22, wh + 4); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < wh; k += 6) g.fillRect(sx + 2, wy + k, 18, 2); }
      sill(g, wx, wy + wh + 4, ww);
      if (b === 0 || b === 2) flowers(g, wx - 4, wy + wh + 10, ww + 8, rnd);
    }
    g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x, y + h - 5, w, 5);
  } else if (name === 'U1') { // balconies with french windows
    wall(g, x, y, w, h, '#f2ebdf', rnd);
    for (let b = 0; b < bays; b++) {
      const wx = x + b * bw + 40, wy = y + 14, ww = 48, wh = 90;
      windowBox(g, wx, wy, ww, wh, '#f8f8f8', { curtain: b === 2 ? '#bfe0ef' : null });
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + b * bw + 14, y + 109, bw - 28, 7);
      g.fillStyle = '#e9e4dc'; g.fillRect(x + b * bw + 14, y + 102, bw - 28, 8);
      g.fillStyle = '#3b4248'; g.fillRect(x + b * bw + 16, y + 78, bw - 32, 4);
      for (let px = x + b * bw + 17; px < x + (b + 1) * bw - 16; px += 7) g.fillRect(px, y + 80, 2, 22);
      if (b === 1 || b === 3) { g.fillStyle = '#b5653f'; g.fillRect(x + b * bw + 20, y + 88, 12, 13); g.fillStyle = '#58a84a'; g.beginPath(); g.arc(x + b * bw + 26, y + 84, 9, 0, 7); g.fill(); }
    }
  } else if (name === 'U2') { // brick
    brick(g, x, y, w, h, '#c8785a', rnd);
    for (let b = 0; b < bays; b++) {
      const wx = x + b * bw + 37, wy = y + 28, ww = 54, wh = 68;
      g.fillStyle = '#efe7da'; g.fillRect(wx - 8, wy - 12, ww + 16, 9);
      windowBox(g, wx, wy, ww, wh, '#ffffff', { curtain: b === 3 ? '#e8c6c6' : null });
      sill(g, wx, wy + wh + 4, ww, '#efe7da');
    }
  } else if (name === 'U3') { // office ribbon windows
    wall(g, x, y, w, h, '#e6eaee', rnd, 500);
    glass(g, x, y + 24, w, 74, true);
    g.fillStyle = '#5d6872'; for (let px = x; px < x + w; px += 64) g.fillRect(px, y + 24, 5, 74);
    g.fillRect(x, y + 22, w, 4); g.fillRect(x, y + 97, w, 4);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, y + 101, w, 6);
  } else if (name === 'U4') { // classic arched windows, pilasters
    wall(g, x, y, w, h, '#f5e8d3', rnd);
    for (let b = 0; b < bays; b++) {
      const bx = x + b * bw;
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx, y, 10, h);
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(bx + 10, y, 3, h);
      const wx = bx + 40, wy = y + 30, ww = 48, wh = 70;
      g.fillStyle = '#e8dcc6'; g.beginPath(); g.arc(wx + ww / 2, wy + 2, ww / 2 + 8, Math.PI, 0); g.fill();
      g.save(); g.beginPath(); g.arc(wx + ww / 2, wy + 2, ww / 2, Math.PI, 0); g.rect(wx, wy + 2, ww, wh - 2); g.clip();
      glass(g, wx, wy - ww / 2, ww, wh + ww / 2); g.restore();
      g.fillStyle = '#ffffff'; g.fillRect(wx + ww / 2 - 2, wy - 20, 4, wh + 20); g.fillRect(wx, wy + 22, ww, 3);
      g.fillStyle = '#d8c8ad'; g.fillRect(wx + ww / 2 - 6, wy - ww / 2 - 8, 12, 12);
      sill(g, wx, wy + wh + 2, ww, '#e8dcc6');
      if (b === 1) flowers(g, wx - 2, wy + wh + 9, ww + 4, rnd);
    }
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x, y + 4, w, 4);
  } else { // U5 modern: big windows, colour panels
    wall(g, x, y, w, h, '#f6f6f3', rnd, 400);
    const pc = ['#f08a4b', '#3fa7a0', '#f2c14e', '#6c8fd6'];
    for (let b = 0; b < bays; b++) {
      const bx = x + b * bw;
      g.fillStyle = pc[b]; g.fillRect(bx + 8, y + 22, 22, 84);
      const wx = bx + 40, wy = y + 22, ww = 78, wh = 78;
      g.fillStyle = '#2f3a44'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      glass(g, wx, wy, ww, wh, true);
      g.fillStyle = '#2f3a44'; g.fillRect(wx + ww * 0.62, wy, 3, wh);
    }
    g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(x, y + h - 8, w, 8);
  }
}
function pictogram(g, kind, cx, cy, s) {
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineWidth = s * 0.12;
  if (kind === 0) { g.beginPath(); g.ellipse(cx, cy, s * 0.55, s * 0.32, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx + k * s * 0.2 - s * 0.08, cy - s * 0.2); g.lineTo(cx + k * s * 0.2 + s * 0.08, cy + s * 0.2); g.stroke(); } }
  else if (kind === 1) { g.fillRect(cx - s * 0.35, cy - s * 0.3, s * 0.55, s * 0.6); g.beginPath(); g.arc(cx + s * 0.25, cy, s * 0.18, -1.4, 1.4); g.stroke(); }
  else if (kind === 2) { for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.arc(cx + Math.cos(a) * s * 0.22, cy + Math.sin(a) * s * 0.22, s * 0.17, 0, 7); g.fill(); } g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(cx, cy, s * 0.13, 0, 7); g.fill(); }
  else { g.beginPath(); g.arc(cx - s * 0.18, cy + s * 0.05, s * 0.24, 0, 7); g.arc(cx + s * 0.2, cy + s * 0.05, s * 0.24, 0, 7); g.fill(); g.fillStyle = '#7bc96f'; g.fillRect(cx - s * 0.04, cy - s * 0.38, s * 0.1, s * 0.2); }
}
function shopfront(g, x, y, sign, pic, rnd, door) {
  // 256 px (6 m) x 160 px (3.6 m): sign band, display window, door
  g.fillStyle = sign; rrect(g, x + 10, y + 8, 236, 30, 4); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 14, y + 11, 228, 4);
  pictogram(g, pic, x + 40, y + 23, 24);
  g.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 5; k++) g.fillRect(x + 62 + k * 22, y + 19, 14, 7);
  g.fillStyle = '#3c4550'; g.fillRect(x + 12, y + 44, 168, 104);
  glass(g, x + 16, y + 48, 160, 96);
  const goods = ['#e85d4a', '#ffd23f', '#5fb85a', '#3d8fd6', '#f08a4b', '#ffffff'];
  for (let sy = 0; sy < 2; sy++) { g.fillStyle = 'rgba(70,50,30,0.7)'; g.fillRect(x + 20, y + 98 + sy * 28, 152, 4); for (let k = 0; k < 9; k++) { g.fillStyle = goods[(rnd() * goods.length) | 0]; g.fillRect(x + 24 + k * 16 + rnd() * 4, y + 80 + sy * 28, 10, 18); } }
  g.fillStyle = '#3c4550'; g.fillRect(x + 188, y + 46, 58, 114);
  glass(g, x + 194, y + 52, 46, 108); g.fillStyle = door; g.fillRect(x + 194, y + 120, 46, 40);
  g.fillStyle = '#d9d2c4'; g.fillRect(x + 230, y + 104, 4, 14);
}
function paintGroundFloor(g, name, rnd) {
  const [x, y, w, h] = R[name];
  if (name === 'G0') {
    wall(g, x, y, w, h, '#efe6d8', rnd);
    shopfront(g, x, y, '#e2574c', 0, rnd, '#3c4550'); shopfront(g, x + 256, y, '#3a86cf', 3, rnd, '#3c4550');
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 10, w, 10);
  } else if (name === 'G1') {
    wall(g, x, y, w, h, '#f6efe3', rnd);
    shopfront(g, x, y, '#3d9a68', 1, rnd, '#5a3b26'); shopfront(g, x + 256, y, '#e98a2e', 2, rnd, '#5a3b26');
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y + h - 10, w, 10);
  } else if (name === 'G2') { // residential: rusticated base, doors, small windows
    wall(g, x, y, w, h, '#e7dfd2', rnd);
    g.fillStyle = 'rgba(0,0,0,0.1)'; for (let yy = y + 20; yy < y + h; yy += 22) g.fillRect(x, yy, w, 3);
    for (let b = 0; b < 4; b++) {
      const bx = x + b * 128;
      if (b === 1 || b === 3) {
        g.fillStyle = '#d6cbb8'; g.fillRect(bx + 30, y + 28, 68, 132);
        g.fillStyle = b === 1 ? '#7a4b2e' : '#2f5d7a'; g.fillRect(bx + 38, y + 40, 52, 120);
        g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(bx + 42, y + 46, 20, 50); g.fillRect(bx + 66, y + 46, 20, 50);
        g.fillStyle = '#e8c547'; g.fillRect(bx + 80, y + 100, 4, 10);
        glass(g, bx + 42, y + 30, 44, 8);
      } else {
        windowBox(g, bx + 40, y + 40, 48, 56, '#ffffff', {});
        g.fillStyle = '#3b4248'; for (let k = 0; k < 6; k++) g.fillRect(bx + 42 + k * 8, y + 38, 2, 62);
        sill(g, bx + 40, y + 100, 48);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 10, w, 10);
  } else { // G3 brick, roller shutters, a florist
    brick(g, x, y, w, h, '#b9694c', rnd);
    g.fillStyle = '#9aa2a8'; g.fillRect(x + 12, y + 44, 168, 116);
    g.fillStyle = 'rgba(0,0,0,0.16)'; for (let yy = y + 48; yy < y + 160; yy += 6) g.fillRect(x + 12, yy, 168, 2);
    g.fillStyle = '#3c4550'; g.fillRect(x + 12, y + 120, 168, 40); glass(g, x + 16, y + 122, 160, 38);
    shopfront(g, x + 256, y, '#f2b632', 2, rnd, '#3c4550');
    g.fillStyle = '#5a3b26'; g.fillRect(x + 192, y + 52, 50, 108);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 10, w, 10);
  }
}
function paintMisc(g, rnd) {
  // roofs
  for (const n of ['roof', 'roofTrash']) {
    const [x, y, w, h] = R[n];
    g.fillStyle = '#8e8a83'; g.fillRect(x, y, w, h); speck(g, x, y, w, h, 1400, rnd, 0.22, 2);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + 62, w, 2); g.fillRect(x + 62, y, 2, h);
    if (n === 'roofTrash') {
      const tc = ['#1c1d20', '#2e4a32', '#e8e4d8', '#4fa3d9', '#c9483b', '#a47c4e', '#d0a030', '#3b5e95'];
      for (let k = 0; k < 420; k++) { g.fillStyle = tc[(rnd() * tc.length) | 0]; const s = 2 + rnd() * 5; g.fillRect(x + rnd() * (w - s), y + rnd() * (h - s), s, s * (0.5 + rnd())); }
    }
  }
  { const [x, y, w, h] = R.concrete; g.fillStyle = '#e7e1d6'; g.fillRect(x, y, w, h); speck(g, x, y, w, h, 200, rnd, 0.08, 2); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + h - 8, w, 8); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x, y, w, 4); }
  { const [x, y, w, h] = R.white; g.fillStyle = '#ffffff'; g.fillRect(x, y, w, h); }
  // awnings: stripes along u (1 m = 64 px), shading towards the lower edge
  const AW = [['#e2574c', '#fff6ec'], ['#3d9a68', '#f4fbef'], ['#3a86cf', '#f0f6ff'], ['#f08a2e', '#fff3d6']];
  for (let k = 0; k < 4; k++) {
    const [x, y, w, h] = R['awn' + k];
    for (let s = 0; s < 4; s++) { g.fillStyle = AW[k][s & 1]; g.fillRect(x + s * 16, y, 16, h); }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  // barrier: two 2 m water-filled blocks (red, white)
  { const [x, y, w, h] = R.barrier;
    for (let s = 0; s < 2; s++) { g.fillStyle = s ? '#f3f1ea' : '#e0432c'; rrect(g, x + s * 64 + 1, y + 2, 62, h - 4, 8); g.fill(); }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 63, y, 2, h); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h); }
  // kiosk front: counter, serving window with goods, coin band
  { const [x, y, w, h] = R.kiosk;
    g.fillStyle = '#2f9a6a'; g.fillRect(x, y, w, h);
    g.fillStyle = '#ffcf3f'; g.fillRect(x, y, w, 24); g.fillStyle = '#e9b520'; g.fillRect(x, y + 22, w, 3);
    for (let k = 0; k < 8; k++) { g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(x + 16 + k * 32, y + 12, 7, 0, 7); g.fill(); g.fillStyle = '#e9b520'; g.beginPath(); g.arc(x + 16 + k * 32, y + 12, 4, 0, 7); g.fill(); }
    g.fillStyle = '#25303a'; g.fillRect(x + 16, y + 32, w - 32, 50);
    const goods = ['#e85d4a', '#ffd23f', '#5fb85a', '#3d8fd6', '#f08a4b', '#ffffff', '#b07ad6'];
    for (let sy = 0; sy < 2; sy++) { g.fillStyle = '#c9a26e'; g.fillRect(x + 18, y + 56 + sy * 22, w - 36, 3); for (let k = 0; k < 16; k++) { g.fillStyle = goods[(rnd() * goods.length) | 0]; g.fillRect(x + 22 + k * 13.5, y + 40 + sy * 22, 9, 16); } }
    g.fillStyle = '#f4efe2'; g.fillRect(x + 10, y + 84, w - 20, 8);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 8; k++) g.fillRect(x + 8 + k * 31, y + 96, 20, 30); }
  // round icons (coin, drop-off, robot), halo, chevron, ring band
  { const [x, y, w] = R.coin, c = x + w / 2, cy = y + w / 2;
    g.fillStyle = '#e0a400'; g.beginPath(); g.arc(c, cy, 31, 0, 7); g.fill();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(c, cy, 26, 0, 7); g.fill();
    g.strokeStyle = '#f0b400'; g.lineWidth = 2.5; g.beginPath(); g.arc(c, cy, 20, 0, 7); g.stroke();
    g.fillStyle = '#fff6c9'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k & 1 ? 6 : 14; g.lineTo(c + Math.cos(a) * r, cy + Math.sin(a) * r); } g.fill(); }
  { const [x, y, w] = R.drop, c = x + w / 2, cy = y + w / 2;
    g.fillStyle = '#d9621a'; g.beginPath(); g.arc(c, cy, 31, 0, 7); g.fill(); g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(c, cy, 26, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(c - 15, cy + 2, 30, 14); g.fillRect(c - 17, cy - 1, 34, 4);
    g.beginPath(); g.moveTo(c, cy - 2); g.lineTo(c - 9, cy - 11); g.lineTo(c - 3, cy - 11); g.lineTo(c - 3, cy - 22); g.lineTo(c + 3, cy - 22); g.lineTo(c + 3, cy - 11); g.lineTo(c + 9, cy - 11); g.fill(); }
  { const [x, y, w] = R.robot, c = x + w / 2, cy = y + w / 2;
    g.fillStyle = '#2b6cc4'; g.beginPath(); g.arc(c, cy, 31, 0, 7); g.fill(); g.fillStyle = '#5aa2ff'; g.beginPath(); g.arc(c, cy, 25, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; rrect(g, c - 16, cy - 10, 32, 22, 6); g.fill(); g.fillStyle = '#2b6cc4'; g.beginPath(); g.arc(c - 7, cy, 4, 0, 7); g.arc(c + 7, cy, 4, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(c - 1.5, cy - 20, 3, 10); }
  { const [x, y, w] = R.halo, c = x + w / 2, cy = y + w / 2;
    const gr = g.createRadialGradient(c, cy, 0, c, cy, w / 2 - 2); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.clearRect(x, y, w, w); g.fillStyle = gr; g.fillRect(x, y, w, w); }
  { const [x, y, w] = R.chev; g.clearRect(x, y, w, w);
    g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath(); g.moveTo(x + 32, y + 6); g.lineTo(x + 58, y + 34); g.lineTo(x + 46, y + 34); g.lineTo(x + 32, y + 20); g.lineTo(x + 18, y + 34); g.lineTo(x + 6, y + 34); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + 32, y + 28); g.lineTo(x + 58, y + 56); g.lineTo(x + 46, y + 56); g.lineTo(x + 32, y + 42); g.lineTo(x + 18, y + 56); g.lineTo(x + 6, y + 56); g.closePath(); g.fill(); }
  { const [x, y, w, h] = R.ring; g.clearRect(x, y, w, h);
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h); }
  for (const n of ['cloud1', 'cloud2']) {
    const [x, y, w, h] = R[n]; g.clearRect(x, y, w, h);
    const lr = mulberry(n === 'cloud1' ? 11 : 23);
    for (let k = 0; k < 16; k++) {
      const cx = x + w * (0.18 + lr() * 0.64), cy = y + h * (0.45 + lr() * 0.25), r = h * (0.16 + lr() * 0.2);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0)';
  }
}
function fitText(g, text, cx, cy, maxW, px, color, weight) {
  let s = px; g.font = `${weight || 900} ${s}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  while (g.measureText(text).width > maxW && s > 8) { s -= 1; g.font = `${weight || 900} ${s}px "Arial Black", "Helvetica Neue", Arial, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, cx, cy);
}
function paintSigns(g) {
  { const [x, y, w, h] = R.shopSign; g.fillStyle = '#ffffff'; g.fillRect(x, y, w, h);
    g.fillStyle = '#2a9d63'; rrect(g, x + 3, y + 3, w - 6, h - 6, 10); g.fill(); g.strokeStyle = '#ffe066'; g.lineWidth = 3; rrect(g, x + 7, y + 7, w - 14, h - 14, 7); g.stroke();
    const [cx0, cy0, cw] = R.coin; g.drawImage(atlasCanvas, cx0, cy0, cw, cw, x + 12, y + 10, 44, 44);
    fitText(g, upper(str('sell_shop', 'Dükkan')), x + 148, y + h / 2 + 1, 170, 34, '#ffffff'); }
  { const [x, y, w, h] = R.dropSign; g.fillStyle = '#ffffff'; g.fillRect(x, y, w, h);
    g.fillStyle = '#f07a28'; rrect(g, x + 3, y + 3, w - 6, h - 6, 10); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 3; rrect(g, x + 7, y + 7, w - 14, h - 14, 7); g.stroke();
    const [dx0, dy0, dw] = R.drop; g.drawImage(atlasCanvas, dx0, dy0, dw, dw, x + 12, y + 10, 44, 44);
    fitText(g, upper(str('sell_dropoff', 'Konteyner')), x + 148, y + h / 2 + 1, 172, 30, '#ffffff'); }
  { const [x, y, w, h] = R.soonSign; g.fillStyle = '#ffd23f'; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, 40, h); g.rect(x + w - 40, y, 40, h); g.clip(); g.fillStyle = '#222222';
    for (let k = -4; k < 12; k++) { g.beginPath(); g.moveTo(x + k * 18, y + h); g.lineTo(x + k * 18 + 9, y + h); g.lineTo(x + k * 18 + 9 + h, y); g.lineTo(x + k * 18 + h, y); g.fill(); }
    g.restore(); g.fillStyle = '#222222'; g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3);
    fitText(g, upper(str('barrier_soon', 'Yakında')), x + w / 2, y + h / 2 + 1, w - 96, 32, '#222222'); }
  paintBillboard(g);
}
function paintBillboard(g) {
  const [x, y, w, h] = R.billboard;
  const bg = g.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, '#8fd0ff'); bg.addColorStop(1, '#e6f6ff'); g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.fillStyle = '#2b2d42'; g.fillRect(x, y, w, 22);
  fitText(g, str('promo_title', 'Sancar Games'), x + w / 2, y + 12, w - 16, 14, '#ffffff', 700);
  g.fillStyle = '#ffffff'; g.fillRect(x + w / 2 - 1, y + 26, 2, h - 30);
  // left: Yıkım Ustası — crane arm, wrecking ball, tumbling blocks
  const lx = x + 4, ly = y + 24, lw = w / 2 - 8;
  g.fillStyle = '#f2c14e'; g.fillRect(lx + 10, ly + 6, 6, 74); g.fillRect(lx + 10, ly + 6, 70, 6);
  g.strokeStyle = '#444'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx + 72, ly + 12); g.lineTo(lx + 84, ly + 46); g.stroke();
  g.fillStyle = '#3a3a44'; g.beginPath(); g.arc(lx + 86, ly + 52, 10, 0, 7); g.fill();
  const bc = ['#e2574c', '#f08a2e', '#3a86cf', '#ffd23f'];
  for (let k = 0; k < 7; k++) { g.fillStyle = bc[k % 4]; g.save(); g.translate(lx + 92 + (k % 3) * 11, ly + 72 - ((k / 3) | 0) * 11 - (k === 6 ? 8 : 0)); g.rotate(k === 6 ? 0.5 : (k % 2) * 0.12); g.fillRect(-5, -5, 10, 10); g.restore(); }
  fitText(g, str('promo_yikim', 'Yıkım Ustası'), lx + lw / 2, y + h - 12, lw - 6, 15, '#c0392b');
  // right: Sayı Yolu — a number grid with a path
  const rx = x + w / 2 + 6, ry = y + 30, cs = 15;
  g.strokeStyle = '#3a86cf'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); const path = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [3, 1], [3, 0], [4, 0]];
  path.forEach(([a, b], k) => { const px = rx + 16 + a * cs * 1.5, py = ry + 8 + b * cs * 1.5; if (k) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke();
  for (let b = 0; b < 3; b++) for (let a = 0; a < 5; a++) {
    const px = rx + 16 + a * cs * 1.5, py = ry + 8 + b * cs * 1.5, red = (a === 0 && b === 0) || (a === 3 && b === 2) || (a === 4 && b === 0);
    g.fillStyle = red ? '#e2574c' : '#ffffff'; g.beginPath(); g.arc(px, py, 8, 0, 7); g.fill();
    if (red) fitText(g, String(a === 0 ? 1 : a === 3 ? 10 : 13), px, py + 1, 14, 9, '#ffffff', 700);
  }
  fitText(g, str('promo_sayiyolu', 'Sayı Yolu'), rx + lw / 2 - 2, y + h - 12, lw - 6, 15, '#1f5fa8');
}
function makeAtlas() {
  const S = VIS.atlasPx, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); atlasCanvas = c;
  const rnd = mulberry(VIS.seed + 101);
  g.fillStyle = '#ece6dc'; g.fillRect(0, 0, S, S);
  for (const n of ['U0', 'U1', 'U2', 'U3', 'U4', 'U5']) paintUpper(g, n, rnd);
  for (const n of ['G0', 'G1', 'G2', 'G3']) paintGroundFloor(g, n, rnd);
  paintMisc(g, rnd);
  paintSigns(g); atlasLang = lang();
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; // v = canvas row / size
  t.anisotropy = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

// ================================================================================== ground plan texture
function paintGround() {
  const S = VIS.groundPx, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), s = S / SIZE, rnd = mulberry(VIS.seed + 7);
  const PW = VIS.pavementM, KW = VIS.kerbM;
  const M = (v) => v * s;
  // asphalt with grain, patches, cracks, oil stains
  g.fillStyle = '#5a5e64'; g.fillRect(0, 0, S, S);
  speck(g, 0, 0, S, S, 30000, rnd, 0.16, 1.6);
  for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '40,42,46' : '110,112,116'},0.18)`; const w = M(1 + rnd() * 3), h = M(0.6 + rnd() * 2); g.fillRect(rnd() * S, rnd() * S, w, h); }
  g.strokeStyle = 'rgba(30,30,32,0.35)'; g.lineWidth = 1.2;
  for (let k = 0; k < 60; k++) { let x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (rnd() - 0.5) * M(0.9); y += (rnd() - 0.5) * M(0.9); g.lineTo(x, y); } g.stroke(); }
  for (let k = 0; k < 18; k++) { const x = rnd() * S, y = rnd() * S, r = M(0.3 + rnd() * 0.5); g.fillStyle = 'rgba(25,25,30,0.22)'; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, 7); g.fill(); }
  // road markings (painted before pavements so pavements cover their ends)
  const roadOf = (o) => { // road span across a street at offset o: pavement only next to blocks (never at the district edge)
    const a = o === 0 ? 0 : o + PW, b = o + 6 >= SIZE ? SIZE : o + 6 - PW; return [a, b];
  };
  const inStreet = (v) => OFFS.some((o) => v >= o && v < o + 6);
  g.fillStyle = '#ecebe2';
  for (const o of OFFS) {
    const [a, b] = roadOf(o), cxm = (a + b) / 2;
    for (let t = 0; t < SIZE; t += 3) {
      if (inStreet(t) || inStreet(t + 1.5) || OFFS.some((q) => t + 1.5 > q - 3 && t < q + 9)) continue;
      g.fillRect(M(cxm - 0.06), M(t), M(0.12), M(1.5)); g.fillRect(M(t), M(cxm - 0.06), M(1.5), M(0.12));
    }
  }
  // zebra crossings and stop lines on every arm of every crossing
  for (const ox of OFFS) for (const oz of OFFS) {
    for (const arm of [0, 1, 2, 3]) {
      const vertical = arm < 2; // arms 0/1: north/south (street along z), 2/3: west/east
      const o = vertical ? ox : oz, [a, b] = roadOf(o);
      const base = vertical ? oz : ox, from = arm % 2 === 0 ? base - 2.6 : base + 6 + 0.4;
      if (from < 0 || from + 2.2 > SIZE) continue;
      for (let q = a + 0.25; q + 0.45 <= b - 0.1; q += 0.9) {
        g.fillStyle = 'rgba(240,240,232,0.92)';
        if (vertical) g.fillRect(M(q), M(from), M(0.45), M(2.2)); else g.fillRect(M(from), M(q), M(2.2), M(0.45));
      }
      g.fillStyle = 'rgba(240,240,232,0.8)';
      const sl = arm % 2 === 0 ? from - 0.6 : from + 2.2 + 0.3;
      if (vertical) g.fillRect(M(a + 0.1), M(sl), M((b - a) / 2), M(0.2)); else g.fillRect(M(sl), M((a + b) / 2), M(0.2), M((b - a) / 2 - 0.1));
    }
  }
  // pavements (rounded at corners), slab joints, kerb stones, drains
  for (const B of BLOCKS) {
    const x0 = B.x0 - PW, z0 = B.z0 - PW, w = B.x1 - B.x0 + 2 * PW, d = B.z1 - B.z0 + 2 * PW;
    g.fillStyle = '#b9b5ad'; rrect(g, M(x0), M(z0), M(w), M(d), M(PW)); g.fill();
    g.save(); rrect(g, M(x0), M(z0), M(w), M(d), M(PW)); g.clip();
    for (let k = 0; k < 900; k++) { const q = 0.75; const xx = Math.floor((x0 + rnd() * w) / q) * q, zz = Math.floor((z0 + rnd() * d) / q) * q; g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(M(xx), M(zz), M(q), M(q)); }
    g.fillStyle = 'rgba(70,66,60,0.35)';
    for (let v = x0; v < x0 + w; v += 0.75) g.fillRect(M(v), M(z0), 1, M(d));
    for (let v = z0; v < z0 + d; v += 0.75) g.fillRect(M(x0), M(v), M(w), 1);
    speck(g, M(x0), M(z0), M(w), M(d), 1500, rnd, 0.12, 1.5);
    g.restore();
    g.strokeStyle = '#d8d4cb'; g.lineWidth = M(KW); rrect(g, M(x0 + KW / 2), M(z0 + KW / 2), M(w - KW), M(d - KW), M(PW - KW / 2)); g.stroke();
    g.strokeStyle = 'rgba(30,30,34,0.45)'; g.lineWidth = M(0.07); rrect(g, M(x0 - 0.03), M(z0 - 0.03), M(w + 0.06), M(d + 0.06), M(PW + 0.03)); g.stroke();
    g.fillStyle = '#3a3c40';
    for (let t = 3; t < 18; t += 9) { g.fillRect(M(B.x0 + t), M(z0 - 0.32), M(0.6), M(0.26)); g.fillRect(M(B.x0 + t), M(B.z1 + PW + 0.06), M(0.6), M(0.26)); g.fillRect(M(x0 - 0.32), M(B.z0 + t), M(0.26), M(0.6)); g.fillRect(M(B.x1 + PW + 0.06), M(B.z0 + t), M(0.26), M(0.6)); }
  }
  // blocks: plaza tiles + mosaic; under buildings (never seen) a dark fill
  for (const B of BLOCKS) {
    if (!B.plaza) { g.fillStyle = '#3a3633'; g.fillRect(M(B.x0), M(B.z0), M(B.x1 - B.x0), M(B.z1 - B.z0)); continue; }
    const x0 = B.x0, z0 = B.z0, w = B.x1 - B.x0, d = B.z1 - B.z0;
    g.fillStyle = '#b8765a'; g.fillRect(M(x0), M(z0), M(w), M(d));
    const tones = ['#e2cfae', '#d9c3a0', '#e8d7b8', '#d4bc98'];
    for (let zz = z0 + 0.6; zz < z0 + d - 0.6 - 1e-6; zz += 1) for (let xx = x0 + 0.6; xx < x0 + w - 0.6 - 1e-6; xx += 1) {
      g.fillStyle = tones[(hash2(Math.round(xx * 2), Math.round(zz * 2), 3) & 3)]; g.fillRect(M(xx) + 1, M(zz) + 1, M(1) - 2, M(1) - 2);
    }
    // mosaic star between the kiosk and the plaza's south edge
    const mx = (KIOSK.x0 + KIOSK.x1) / 2, mz = z0 + d - 4.8;
    const ringC = ['#b8765a', '#f3e6cc', '#4f86b8', '#f3e6cc', '#e0a740'];
    for (let k = 0; k < ringC.length; k++) { g.fillStyle = ringC[k]; g.beginPath(); g.arc(M(mx), M(mz), M(3.6 - k * 0.62), 0, 7); g.fill(); }
    g.fillStyle = '#c4553e'; g.beginPath();
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r = k & 1 ? 0.9 : 2.6; g.lineTo(M(mx + Math.cos(a) * r), M(mz + Math.sin(a) * r)); } g.fill();
    g.fillStyle = '#f3e6cc'; g.beginPath(); g.arc(M(mx), M(mz), M(0.5), 0, 7); g.fill();
    speck(g, M(x0), M(z0), M(w), M(d), 3000, rnd, 0.1, 1.5);
  }
  // sell zones painted on the ground (dashed circles), kiosk footprint
  const sps = CFG.sellPoints || [];
  for (const sp of sps) {
    const isShop = sp.id === 'shop';
    g.strokeStyle = isShop ? 'rgba(255,214,64,0.95)' : 'rgba(255,150,50,0.95)'; g.lineWidth = M(0.16); g.setLineDash([M(0.6), M(0.35)]);
    g.beginPath(); g.arc(M(sp.pos[0]), M(sp.pos[1]), M(sp.radiusM - 0.1), 0, 7); g.stroke(); g.setLineDash([]);
    if (!isShop) { g.save(); g.beginPath(); g.arc(M(sp.pos[0]), M(sp.pos[1]), M(sp.radiusM - 0.3), 0, 7); g.clip(); g.strokeStyle = 'rgba(255,170,60,0.35)'; g.lineWidth = M(0.2); for (let k = -6; k < 6; k++) { g.beginPath(); g.moveTo(M(sp.pos[0] + k), M(sp.pos[1] - 3)); g.lineTo(M(sp.pos[0] + k + 6), M(sp.pos[1] + 3)); g.stroke(); } g.restore(); }
  }
  g.fillStyle = '#2d2a27'; g.fillRect(M(KIOSK.x0), M(KIOSK.z0), M(KIOSK.x1 - KIOSK.x0), M(KIOSK.z1 - KIOSK.z0));
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; // canvas row 0 = z 0, same as the trash grid
  t.anisotropy = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ================================================================================== geometry builders
function mkB(atlas) { return { P: [], Nn: [], T: [], A: atlas ? [] : null, K: [], I: [] }; }
function quad(B, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, u0, v0, u1, v1, rc, cb, ct) {
  const o = B.P.length / 3;
  B.P.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = dx - ax, e2y = dy - ay, e2z = dz - az;
  let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  B.Nn.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
  B.T.push(u0, v0, u1, v0, u1, v1, u0, v1);
  if (B.A) for (let k = 0; k < 4; k++) B.A.push(rc[0], rc[1], rc[2], rc[3]);
  ct = ct || cb;
  B.K.push(cb.r, cb.g, cb.b, cb.r, cb.g, cb.b, ct.r, ct.g, ct.b, ct.r, ct.g, ct.b);
  B.I.push(o, o + 1, o + 2, o, o + 2, o + 3);
}
function tri(B, ax, ay, az, bx, by, bz, cx, cy, cz, ua, va, ub, vb, uc, vc, rc, c) {
  const o = B.P.length / 3;
  B.P.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  B.Nn.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  B.T.push(ua, va, ub, vb, uc, vc);
  if (B.A) for (let k = 0; k < 3; k++) B.A.push(rc[0], rc[1], rc[2], rc[3]);
  B.K.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
  B.I.push(o, o + 1, o + 2);
}
// vertical quad from (ax, az) to (bx, bz), y0..y1; its normal is (-e.z, e.x) with e = b - a
function vquad(B, ax, az, bx, bz, y0, y1, u0, v0, u1, v1, rc, cb, ct) { quad(B, ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az, u0, v0, u1, v1, rc, cb, ct); }
// axis-aligned box; faces: 1 +z, 2 -z, 4 +x, 8 -x, 16 top, 32 bottom (default all but bottom)
function box(B, x0, y0, z0, x1, y1, z1, c, rc, faces, ctop) {
  const f = faces == null ? 31 : faces, u = 0.5, v = 0.5;
  rc = rc || RW;
  if (f & 1) quad(B, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, u, v, u, v, rc, c);
  if (f & 2) quad(B, x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, u, v, u, v, rc, c);
  if (f & 4) quad(B, x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, u, v, u, v, rc, c);
  if (f & 8) quad(B, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, u, v, u, v, rc, c);
  if (f & 16) quad(B, x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, u, v, u, v, rc, ctop || c);
  if (f & 32) quad(B, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, u, v, u, v, rc, c);
}
function cyl(B, cx, cz, y0, y1, r, seg, c, ctop) {
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
    quad(B, x1, y0, z1, x0, y0, z0, x0, y1, z0, x1, y1, z1, 0.5, 0.5, 0.5, 0.5, RW, c);
    if (ctop) tri(B, cx, y1, cz, x1, y1, z1, x0, y1, z0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, RW, ctop);
  }
}
function blob(B, cx, cy, cz, r, sy, c, rnd) { // low-poly faceted crown (icosahedron)
  const geo = new THREE.IcosahedronGeometry(1, 0), p = geo.attributes.position;
  for (let k = 0; k < p.count; k += 3) {
    const sh = 0.9 + rnd() * 0.2, cc = mulC(c, sh);
    tri(B, cx + p.getX(k) * r, cy + p.getY(k) * r * sy, cz + p.getZ(k) * r, cx + p.getX(k + 1) * r, cy + p.getY(k + 1) * r * sy, cz + p.getZ(k + 1) * r,
      cx + p.getX(k + 2) * r, cy + p.getY(k + 2) * r * sy, cz + p.getZ(k + 2) * r, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, RW, cc);
  }
  geo.dispose();
}
// basic (unlit) fan disc in a vertical plane: centre (cx,cy,cz), facing direction (fx,fz), icon region
function fan(B, cx, cy, cz, fx, fz, r, seg, region, c) {
  const rx = fz, rz = -fx; // right vector seen from the facing side: (fz, -fx) — so u grows to the viewer's right
  const [uc, vc] = ruv(region, 0.5, 0.5, 3);
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
    const p0x = Math.cos(a0), p0y = Math.sin(a0), p1x = Math.cos(a1), p1y = Math.sin(a1);
    const [u0, v0] = ruv(region, 0.5 + p0x * 0.5, 0.5 + p0y * 0.5, 3), [u1, v1] = ruv(region, 0.5 + p1x * 0.5, 0.5 + p1y * 0.5, 3);
    tri(B, cx, cy, cz, cx + rx * p0x * r, cy + p0y * r, cz + rz * p0x * r, cx + rx * p1x * r, cy + p1y * r, cz + rz * p1x * r, uc, vc, u0, v0, u1, v1, null, c);
  }
}
// basic (unlit) image quad in a vertical plane centred at (cx, cy, cz), facing (fx, fz)
function panel(B, cx, cy, cz, fx, fz, w, h, region, c) {
  const rx = fz, rz = -fx, hw = w / 2, hh = h / 2;
  const [u0, v0] = ruv(region, 0, 0), [u1, v1] = ruv(region, 1, 1);
  quad(B, cx - rx * hw, cy - hh, cz - rz * hw, cx + rx * hw, cy - hh, cz + rz * hw, cx + rx * hw, cy + hh, cz + rz * hw, cx - rx * hw, cy + hh, cz - rz * hw, u0, v0, u1, v1, null, c);
}
let RW = null; // atlas rect of the white region (props), set in init
function toGeometry(B, normals) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.P, 3));
  if (normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(B.Nn, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(B.T, 2));
  if (B.A) g.setAttribute('atlas', new THREE.Float32BufferAttribute(B.A, 4));
  g.setAttribute('color', new THREE.Float32BufferAttribute(B.K, 3));
  g.setIndex(B.I);
  g.computeBoundingSphere();
  return g;
}
// MeshLambertMaterial whose map is tiled inside an atlas region: uv is in tile units, the `atlas`
// attribute gives the region (u0, vBottom, du, -dv). Gradients come from the unwrapped uv so the
// tile seams do not pick the smallest mip level.
function atlasLambert(map) {
  const m = new THREE.MeshLambertMaterial({ map, vertexColors: true });
  m.extensions = m.extensions || {}; m.extensions.derivatives = true; m.extensions.shaderTextureLOD = true;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 atlas;\nvarying vec4 vAtlas;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAtlas = atlas;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vAtlas;')
      .replace('#include <map_fragment>', [
        '#ifdef USE_MAP',
        '  vec2 tuvR = vUv * vAtlas.zw;',
        '  vec2 tuv = vAtlas.xy + fract(vUv) * vAtlas.zw;',
        '  #if __VERSION__ >= 300 || defined(GL_EXT_shader_texture_lod)',
        '    vec4 texelColor = texture2DGradEXT(map, tuv, dFdx(tuvR), dFdy(tuvR));',
        '  #else',
        '    vec4 texelColor = texture2D(map, tuv);',
        '  #endif',
        '  texelColor = mapTexelToLinear(texelColor);',
        '  diffuseColor *= texelColor;',
        '#endif'].join('\n'));
  };
  m.customProgramCacheKey = () => 'ts-world-atlas';
  return m;
}

// ================================================================================== city (buildings + props)
const TINTS = ['#fff4e2', '#ffdfc6', '#e3f1e2', '#e0ebf8', '#fff0bc', '#f9d9d2', '#ebe5f4', '#ffffff', '#f3e7d6'];
function facade(B, lot, ax, az, bx, bz, street, hFrom) {
  const len = Math.hypot(bx - ax, bz - az); if (len < 0.05) return;
  const GH = VIS.groundFloorM, FH = VIS.floorM, CH = VIS.corniceM, TM = VIS.tileM, h = lot.h;
  const tint = C3(TINTS[lot.tint]), u0 = lot.uoff, u1 = lot.uoff + len / TM;
  const simple = lot.ring >= 2;
  const top = simple ? h : h - CH;
  if (street && hFrom <= 0 && !simple) {
    quad(B, ax, 0, az, bx, 0, bz, bx, GH, bz, ax, GH, az, u0, 0, u1, 1, rect('G' + lot.gr), mulC(tint, 0.68), mulC(tint, 0.95));
    quad(B, ax, GH, az, bx, GH, bz, bx, top, bz, ax, top, az, u0, 0, u1, (top - GH) / FH, rect('U' + lot.up), mulC(tint, 0.93), tint);
  } else {
    const y0 = Math.max(hFrom, 0), vb = simple ? y0 / FH : (y0 - GH) / FH;
    if (top - y0 > 0.05) quad(B, ax, y0, az, bx, y0, bz, bx, top, bz, ax, top, az, u0, vb, u1, simple ? top / FH : (top - GH) / FH, rect('U' + lot.up), mulC(tint, hFrom > 0 ? 0.82 : 0.7), tint);
  }
  if (!simple) quad(B, ax, top, az, bx, top, bz, bx, h, bz, ax, h, az, 0, 0, len / 2, 1, rect('concrete'), mulC(tint, 0.97));
}
function awnings(B, lot, ax, az, bx, bz, rnd) {
  const len = Math.hypot(bx - ax, bz - az), ex = (bx - ax) / len, ez = (bz - az) / len, nx = -ez, nz = ex;
  const dep = 1.0, yT = 3.42, yL = 2.86, val = 0.24, white = { r: 1, g: 1, b: 1 }, dark = { r: 0.55, g: 0.55, b: 0.55 };
  const shift = (lot.uoff * VIS.tileM) % 6; // shopfront pattern is 6 m periodic in the tile
  for (let k = -1; k < 4; k++) {
    const s0 = k * 6 + 0.35 - shift, s1 = s0 + 3.8;
    if (s0 < 0.1 || s1 > len - 0.1) continue;
    const rc = rect('awn' + ((lot.tint + k + 4) % 4), 1);
    const p0x = ax + ex * s0, p0z = az + ez * s0, p1x = ax + ex * s1, p1z = az + ez * s1;
    const q0x = p0x + nx * dep, q0z = p0z + nz * dep, q1x = p1x + nx * dep, q1z = p1z + nz * dep;
    quad(B, q0x, yL, q0z, q1x, yL, q1z, p1x, yT, p1z, p0x, yT, p0z, 0, 0, s1 - s0, 1, rc, white);
    quad(B, q0x, yL - val, q0z, q1x, yL - val, q1z, q1x, yL, q1z, q0x, yL, q0z, 0, 0.75, s1 - s0, 1, rc, white);
    quad(B, q1x, yL, q1z, q0x, yL, q0z, p0x, yT, p0z, p1x, yT, p1z, 0, 0, s1 - s0, 1, rc, dark);
  }
  void rnd;
}
function buildCity(lots, rnd) {
  const B = mkB(true);
  for (const lot of lots) {
    const { x0, z0, x1, z1, h } = lot;
    const g = lot.grid, na = lot.na || 1, nc = lot.nc || 1;
    const nb = (da, dc) => { const a = lot.a + da, c = lot.c + dc; return (g && a >= 0 && c >= 0 && a < na && c < nc) ? g[c * na + a].h : -1; };
    // faces: north (-z), south (+z), east (+x), west (-x); interior faces only above the neighbour lot
    const sides = [[x1, z0, x0, z0, nb(0, -1)], [x0, z1, x1, z1, nb(0, 1)], [x1, z1, x1, z0, nb(1, 0)], [x0, z0, x0, z1, nb(-1, 0)]];
    for (const [ax, az, bx, bz, hn] of sides) {
      if (hn >= h - 0.01) continue;
      facade(B, lot, ax, az, bx, bz, hn < 0, hn < 0 ? 0 : hn);
      if (hn < 0 && lot.home && (lot.gr === 0 || lot.gr === 1)) awnings(B, lot, ax, az, bx, bz, rnd);
    }
    const rc = rect(lot.home ? 'roof' : 'roofTrash', 3), rcol = C3(lot.home ? '#c9c4bc' : '#bdb8b0');
    quad(B, x0, h, z1, x1, h, z1, x1, h, z0, x0, h, z0, x0 / 6, z1 / 6, x1 / 6, z0 / 6, rc, rcol);
    if (lot.home) { // rooftop clutter: AC unit, stair hut / water tank
      const w = x1 - x0, d = z1 - z0;
      const ax = x0 + 1 + lot.r * (w - 3), az = z0 + 1 + ((lot.r * 7.3) % 1) * (d - 3);
      box(B, ax, h, az, ax + 1.3, h + 0.85, az + 0.9, C3('#c9ced2'));
      if (lot.r > 0.4) { const sx = x0 + w * 0.5 - 1, sz = z0 + d * 0.5 - 1; box(B, sx, h, sz, sx + 2.2, h + 2.3, sz + 2.0, mulC(C3(TINTS[lot.tint]), 0.92), RW, 31, C3('#9a958e')); }
      else cyl(B, x0 + w * 0.7, z0 + d * 0.3, h, h + 1.6, 0.7, 8, C3('#9fb3c2'), C3('#7f93a2'));
    }
  }
  return B;
}
function buildProps(B, Gl, Mk, rnd) {
  const PW = VIS.pavementM;
  const pole = C3('#33544c'), lampHead = C3('#2c3b40'), binC = C3('#3f8f5a'), binLid = C3('#2d6b42');
  const lamps = [];
  // lamps along block sides (home district + the neighbour sides facing the district edge)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const Bk of BLOCKS) {
    const ox = dx * SIZE, oz = dz * SIZE, x0 = Bk.x0 + ox, z0 = Bk.z0 + oz, x1 = Bk.x1 + ox, z1 = Bk.z1 + oz;
    const off = PW - 0.35, w = x1 - x0, d = z1 - z0;
    const cand = [[x0 + w * 0.25, z0 - off, 0, -1], [x0 + w * 0.75, z0 - off, 0, -1], [x0 + w * 0.25, z1 + off, 0, 1], [x0 + w * 0.75, z1 + off, 0, 1], [x0 - off, z0 + d * 0.5, -1, 0], [x1 + off, z0 + d * 0.5, 1, 0]];
    for (const L of cand) if (L[0] > -7 && L[0] < SIZE + 7 && L[1] > -7 && L[1] < SIZE + 7 && !(dx === 0 && dz === 0 ? false : (L[0] > 0 && L[0] < SIZE && L[1] > 0 && L[1] < SIZE))) lamps.push(L);
  }
  const H = VIS.lampHeightM, ARM = VIS.lampArmM;
  bulbFrom = Gl.P.length / 3;
  for (const [x, z, fx, fz] of lamps) {
    box(B, x - 0.13, 0, z - 0.13, x + 0.13, 0.45, z + 0.13, pole);
    box(B, x - 0.06, 0.45, z - 0.06, x + 0.06, H, z + 0.06, pole, RW, 15);
    const hx = x + fx * ARM, hz = z + fz * ARM;
    box(B, Math.min(x, hx) - 0.04, H - 0.08, Math.min(z, hz) - 0.04, Math.max(x, hx) + 0.04, H, Math.max(z, hz) + 0.04, pole);
    box(B, hx - 0.26, H - 0.2, hz - 0.26, hx + 0.26, H - 0.06, hz + 0.26, lampHead, RW, 31, C3('#3c4e55'));
    box(Gl, hx - 0.2, H - 0.26, hz - 0.2, hx + 0.2, H - 0.2, hz + 0.2, LAMP_OFF, null, 47);
    // halos for the "streetlights" event (two crossed quads, drawn only once lights are on)
    const [hu0, hv0] = ruv('halo', 0, 0), [hu1, hv1] = ruv('halo', 1, 1), hs = 0.9, hy = H - 0.24, hc = C3('#ffd98a');
    quad(Mk, hx - hs, hy - hs, hz, hx + hs, hy - hs, hz, hx + hs, hy + hs, hz, hx - hs, hy + hs, hz, hu0, hv0, hu1, hv1, null, hc);
    quad(Mk, hx, hy - hs, hz - hs, hx, hy - hs, hz + hs, hx, hy + hs, hz + hs, hx, hy + hs, hz - hs, hu0, hv0, hu1, hv1, null, hc);
  }
  bulbTo = Gl.P.length / 3;
  haloIdx = Mk.I.length;
  // bins at block corners
  for (const Bk of BLOCKS) for (const [cx, cz] of [[Bk.x0 - 0.8, Bk.z0 - 0.8], [Bk.x1 + 0.8, Bk.z1 + 0.8]]) {
    if (cx < 0.5 || cz < 0.5 || cx > SIZE - 0.5 || cz > SIZE - 0.5) continue;
    cyl(B, cx, cz, 0, 0.85, 0.27, 8, binC, binLid);
    cyl(B, cx, cz, 0.85, 0.95, 0.3, 8, binLid, binLid);
  }
  // plaza: benches, trees, robot dock post
  const P = BLOCKS.find((b) => b.plaza);
  if (P) {
    const wood = C3('#b07a4a'), iron = C3('#3b4248');
    const bench = (cx, cz, alongX, face) => {
      const hl = 0.8, hd = 0.22;
      if (alongX) { box(B, cx - hl, 0.42, cz - hd, cx + hl, 0.5, cz + hd, wood); box(B, cx - hl, 0.5, cz + face * hd - 0.04, cx + hl, 0.92, cz + face * hd + 0.04, wood); box(B, cx - hl + 0.1, 0, cz - hd, cx - hl + 0.18, 0.42, cz + hd, iron, RW, 15); box(B, cx + hl - 0.18, 0, cz - hd, cx + hl - 0.1, 0.42, cz + hd, iron, RW, 15); }
      else { box(B, cx - hd, 0.42, cz - hl, cx + hd, 0.5, cz + hl, wood); box(B, cx + face * hd - 0.04, 0.5, cz - hl, cx + face * hd + 0.04, 0.92, cz + hl, wood); box(B, cx - hd, 0, cz - hl + 0.1, cx + hd, 0.42, cz - hl + 0.18, iron, RW, 15); box(B, cx - hd, 0, cz + hl - 0.18, cx + hd, 0.42, cz + hl - 0.1, iron, RW, 15); }
    };
    const midZ = (P.z0 + P.z1) / 2;
    bench(P.x0 + 1.0, midZ, false, -1); bench(P.x1 - 1.0, midZ, false, 1);
    bench(P.x0 + 6, P.z1 - 1.0, true, 1); bench(P.x1 - 6, P.z1 - 1.0, true, 1);
    const trunk = C3('#7a5236'), leaf = C3('#5fae4e'), leaf2 = C3('#4b9a43');
    for (const [tx, tz] of [[P.x0 + 2.3, P.z0 + 2.3], [P.x1 - 2.3, P.z0 + 2.3], [P.x0 + 2.3, P.z1 - 2.3], [P.x1 - 2.3, P.z1 - 2.3]]) {
      cyl(B, tx, tz, 0, 2.6, 0.17, 6, trunk);
      blob(B, tx, 3.5, tz, 1.55, 0.85, leaf, rnd); blob(B, tx + 0.5, 4.4, tz - 0.3, 1.05, 0.9, leaf2, rnd);
    }
    // robot dock: a short post with a glowing robot badge
    const dp = CFG.robot && CFG.robot.dockPos ? CFG.robot.dockPos : [KIOSK.x0 - 2, KIOSK.z1 + 2];
    const px = KIOSK.x0 - 0.35, pz = Math.min(KIOSK.z1 - 0.3, Math.max(KIOSK.z0 + 0.3, dp[1] - 1.5));
    box(B, px - 0.09, 0, pz - 0.09, px + 0.09, 1.25, pz + 0.09, C3('#dfe6ec'));
    fan(Gl, px - 0.1, 1.5, pz, -1, 0, 0.32, 12, 'robot', C3('#ffffff'));
    fan(Gl, px + 0.1, 1.5, pz, 1, 0, 0.32, 12, 'robot', C3('#ffffff'));
  }
  // kiosk: counter front (south), walls, roof slab, awning, roof sign, tall coin pylon
  { const K = KIOSK, kg = C3('#2f9a6a'), roofC = C3('#f4efe2');
    quad(B, K.x0, 0, K.z1, K.x1, 0, K.z1, K.x1, K.h, K.z1, K.x0, K.h, K.z1, 0.002, 0.002, 0.998, 0.998, rect('kiosk'), C3('#ffffff'));
    box(B, K.x0, 0, K.z0, K.x1, K.h, K.z1, kg, RW, 2 | 4 | 8);
    box(B, K.x0 - 0.3, K.h, K.z0 - 0.3, K.x1 + 0.3, K.h + 0.18, K.z1 + 0.5, roofC, RW, 63);
    const rc = rect('awn1', 1), white = { r: 1, g: 1, b: 1 };
    quad(B, K.x0, 2.3, K.z1 + 0.9, K.x1, 2.3, K.z1 + 0.9, K.x1, 2.75, K.z1, K.x0, 2.75, K.z1, 0, 0, K.x1 - K.x0, 1, rc, white);
    quad(B, K.x0, 2.08, K.z1 + 0.9, K.x1, 2.08, K.z1 + 0.9, K.x1, 2.3, K.z1 + 0.9, K.x0, 2.3, K.z1 + 0.9, 0, 0.75, K.x1 - K.x0, 1, rc, white);
    const sw = K.x1 - K.x0 - 0.4, sy = K.h + 0.18 + 0.55, szc = (K.z0 + K.z1) / 2;
    box(B, K.x0 + 0.2, K.h + 0.18, szc - 0.08, K.x1 - 0.2, K.h + 0.24, szc + 0.08, C3('#2a2f33'));
    box(B, K.x0 + 0.2, sy - 0.48, szc - 0.07, K.x1 - 0.2, sy + 0.48, szc + 0.07, C3('#1e6b47'), RW, 4 | 8 | 16);
    panel(Gl, (K.x0 + K.x1) / 2, sy, szc + 0.075, 0, 1, sw, 0.92, 'shopSign', C3('#ffffff'));
    panel(Gl, (K.x0 + K.x1) / 2, sy, szc - 0.075, 0, -1, sw, 0.92, 'shopSign', C3('#ffffff'));
    // pylon at the kiosk's back corner: visible over the rooftops, a big gold coin on top
    const px = K.x1 - 0.35, pz = K.z0 + 0.35, PH = VIS.pylonHeightM, CR = VIS.coinR;
    box(B, px - 0.17, K.h, pz - 0.17, px + 0.17, PH - CR + 0.1, pz + 0.17, C3('#2a6e50'));
    box(B, px - 0.06, PH - CR + 0.1, pz - 0.06, px + 0.06, PH + CR + 0.3, pz + 0.06, C3('#2a6e50'));
    const coinC = C3('#ffffff');
    fan(Gl, px, PH, pz + 0.08, 0, 1, CR, 20, 'coin', coinC); fan(Gl, px, PH, pz - 0.08, 0, -1, CR, 20, 'coin', coinC);
    fan(Gl, px + 0.08, PH, pz, 1, 0, CR, 20, 'coin', coinC); fan(Gl, px - 0.08, PH, pz, -1, 0, CR, 20, 'coin', coinC);
  }
  // barriers along the district edge (water-filled blocks), "Yakında" boards at every street end
  { const bH = 0.95, bD = 0.45, rc = rect('barrier', 1), white = C3('#ffffff'), top = C3('#e8e4dc');
    const e = 0.05, a = -0.6, b = SIZE + 0.6, L4 = (b - a) / 4, S = SIZE;
    // vquad faces (-e.z, e.x) with e = b - a. Inner faces look into the district.
    vquad(B, -e, b, -e, a, 0, bH, 0, 0, L4, 1, rc, white); vquad(B, -e - bD, a, -e - bD, b, 0, bH, 0, 0, L4, 1, rc, white); box(B, -e - bD, 0, a, -e, bH, b, top, RW, 16);
    vquad(B, S + e, a, S + e, b, 0, bH, 0, 0, L4, 1, rc, white); vquad(B, S + e + bD, b, S + e + bD, a, 0, bH, 0, 0, L4, 1, rc, white); box(B, S + e, 0, a, S + e + bD, bH, b, top, RW, 16);
    vquad(B, a, -e, b, -e, 0, bH, 0, 0, L4, 1, rc, white); vquad(B, b, -e - bD, a, -e - bD, 0, bH, 0, 0, L4, 1, rc, white); box(B, a, 0, -e - bD, b, bH, -e, top, RW, 16);
    vquad(B, b, S + e, a, S + e, 0, bH, 0, 0, L4, 1, rc, white); vquad(B, a, S + e + bD, b, S + e + bD, 0, bH, 0, 0, L4, 1, rc, white); box(B, a, 0, S + e, b, bH, S + e + bD, top, RW, 16);
    const legC = C3('#4a4f55'), backC = C3('#cfc9bd'), sw = 2.3, sh = 0.62, sy = 1.55, so = 0.75;
    const dsp = (CFG.sellPoints || []).find((q) => q.id === 'dropoff');
    for (const o of OFFS) {
      const c = o + 3;
      for (const [x, z, fx, fz] of [[-so, c, 1, 0], [SIZE + so, c, -1, 0], [c, -so, 0, 1], [c, SIZE + so, 0, -1]]) {
        if (dsp && Math.hypot(x - dsp.pos[0], z - dsp.pos[1]) < 5) continue; // the drop-off container stands there
        const rx = fz, rz = -fx;
        for (const s of [-1, 1]) { const lx = x + rx * s * (sw / 2 - 0.15), lz = z + rz * s * (sw / 2 - 0.15); box(B, lx - 0.04, 0, lz - 0.04, lx + 0.04, sy + sh / 2, lz + 0.04, legC); }
        panel(Gl, x + fx * 0.03, sy, z + fz * 0.03, fx, fz, sw, sh, 'soonSign', C3('#f2f2f2'));
        const bx0 = Math.min(x - rx * sw / 2, x + rx * sw / 2), bx1 = Math.max(x - rx * sw / 2, x + rx * sw / 2), bz0 = Math.min(z - rz * sw / 2, z + rz * sw / 2), bz1 = Math.max(z - rz * sw / 2, z + rz * sw / 2);
        box(B, bx0 - (fx ? 0.02 : 0), sy - sh / 2, bz0 - (fz ? 0.02 : 0), bx1 + (fx ? 0.02 : 0), sy + sh / 2, bz1 + (fz ? 0.02 : 0), backC, RW, fx > 0 ? 8 | 16 : fx < 0 ? 4 | 16 : fz > 0 ? 2 | 16 : 1 | 16);
      }
    }
  }
  // promo billboard on the promo block's face towards the plaza
  { const pb = BLOCKS.find((b) => b.promo), PB = CFG.promo && CFG.promo.billboard;
    if (pb && PB) {
      const [bw, bh] = PB.sizeM || [6, 3], plaza = BLOCKS.find((b) => b.plaza) || pb;
      const cx = clamp((plaza.x0 + plaza.x1) / 2, pb.x0 + bw / 2 + 0.5, pb.x1 - bw / 2 - 0.5), y0 = VIS.groundFloorM + 1.0, z = pb.z0;
      box(B, cx - bw / 2 - 0.15, y0 - 0.15, z - 0.28, cx + bw / 2 + 0.15, y0 + bh + 0.15, z, C3('#2b2d42'), RW, 2 | 4 | 8 | 16 | 32);
      box(B, cx - 0.1, 1.2, z - 0.2, cx + 0.1, y0 - 0.15, z - 0.05, C3('#2b2d42'), RW, 2 | 4 | 8);
      const [u0, v0] = ruv('billboard', 0, 0), [u1, v1] = ruv('billboard', 1, 1);
      quad(Gl, cx + bw / 2, y0, z - 0.29, cx - bw / 2, y0, z - 0.29, cx - bw / 2, y0 + bh, z - 0.29, cx + bw / 2, y0 + bh, z - 0.29, u0, v0, u1, v1, null, C3('#f4f4f4'));
      BILL.x = cx; BILL.z = z - 0.3; BILL.y = y0 + bh / 2; BILL.r = bw / 2;
    }
  }
}
const BILL = { x: 0, z: 0, y: 0, r: 3 };
let LAMP_OFF = null, LAMP_ON = null;
function buildContainer(B, Gl) {
  // drop-off container just outside the barrier next to its sell point (outside the walkable bounds,
  // so it never covers trash cells); drawn only once 'dropoff' is owned
  const sp = (CFG.sellPoints || []).find((s) => s.id === 'dropoff'); if (!sp) return null;
  const px = sp.pos[0], pz = sp.pos[1];
  const westish = px < SIZE / 2, x1 = westish ? -0.6 : SIZE + 2.6, x0 = westish ? -2.6 : SIZE + 0.6;
  const z0 = pz - 1.4, z1 = pz + 1.4, H = 1.55, oc = C3('#e8772e'), od = C3('#c95f1c');
  box(B, x0, 0.12, z0, x1, H, z1, oc, RW, 31);
  box(B, x0 + 0.1, 0, z0 + 0.2, x1 - 0.1, 0.12, z1 - 0.2, C3('#3b3f44'), RW, 15);
  for (let k = 1; k < 6; k++) { const z = z0 + k * (z1 - z0) / 6; box(B, (westish ? x1 : x0) - 0.03, 0.2, z - 0.05, (westish ? x1 : x0) + 0.03, H - 0.1, z + 0.05, od, RW, westish ? 4 : 8); }
  // lid tilted open towards the district
  const lidY = H + 0.05, fx = westish ? 1 : -1, hx = westish ? x0 : x1;
  quad(B, hx, lidY, z1, hx, lidY, z0, hx + fx * 0.6, lidY + 1.0, z0, hx + fx * 0.6, lidY + 1.0, z1, 0.5, 0.5, 0.5, 0.5, RW, C3('#2f7d5b'));
  quad(B, hx + fx * 0.6, lidY + 1.0, z1, hx + fx * 0.6, lidY + 1.0, z0, hx, lidY, z0, hx, lidY, z1, 0.5, 0.5, 0.5, 0.5, RW, C3('#245f45'));
  panel(Gl, westish ? x1 + 0.02 : x0 - 0.02, 1.22, pz, fx, 0, 2.4, 0.6, 'dropSign', C3('#ffffff'));
  // beacon pole with a round orange sign (the drop-off's landmark)
  const bx = westish ? x0 + 0.3 : x1 - 0.3, bz = z1 + 0.5, BH = VIS.beaconHeightM, BR = VIS.beaconR;
  box(B, bx - 0.09, 0, bz - 0.09, bx + 0.09, BH - BR + 0.05, bz + 0.09, C3('#4a4f55'));
  const cc = C3('#ffffff');
  fan(Gl, bx, BH, bz + 0.06, 0, 1, BR, 18, 'drop', cc); fan(Gl, bx, BH, bz - 0.06, 0, -1, BR, 18, 'drop', cc);
  fan(Gl, bx + 0.06, BH, bz, 1, 0, BR, 18, 'drop', cc); fan(Gl, bx - 0.06, BH, bz, -1, 0, BR, 18, 'drop', cc);
  return { x0, z0, x1, z1 };
}

// ================================================================================== sky
function skyColor(y, out) {
  const hor = LIGHT.fogColor, zen = C3(VIS.skyCol.zenith), mid = C3(VIS.skyCol.mid);
  if (y <= 0) return out.copy(hor);
  if (y < 0.25) return out.copy(hor).lerp(mid, Math.pow(y / 0.25, 0.8));
  return out.copy(mid).lerp(zen, Math.pow((y - 0.25) / 0.75, 0.7));
}
function buildSky() {
  const RAD = VIS.skyRadius, B = mkB(false), c = new THREE.Color(), rnd = mulberry(VIS.seed + 31);
  const [wu, wv] = ruv('white', 0.5, 0.5);
  const SEG = 32, RINGS = [-0.5, -0.05, 0, 0.03, 0.08, 0.15, 0.25, 0.4, 0.6, 0.8, 1.0];
  for (let r = 0; r < RINGS.length - 1; r++) {
    const e0 = RINGS[r] * Math.PI / 2, e1 = RINGS[r + 1] * Math.PI / 2;
    const c0 = skyColor(Math.sin(e0), new THREE.Color()), c1 = skyColor(Math.sin(e1), new THREE.Color());
    for (let k = 0; k < SEG; k++) {
      const a0 = (k / SEG) * Math.PI * 2, a1 = ((k + 1) / SEG) * Math.PI * 2;
      const p = (a, e) => [Math.cos(a) * Math.cos(e) * RAD, Math.sin(e) * RAD, Math.sin(a) * Math.cos(e) * RAD];
      const A = p(a0, e0), Bv = p(a1, e0), Cv = p(a1, e1), D = p(a0, e1);
      quad(B, A[0], A[1], A[2], Bv[0], Bv[1], Bv[2], Cv[0], Cv[1], Cv[2], D[0], D[1], D[2], wu, wv, wu, wv, null, c0, c1);
    }
  }
  // sun glow
  const sd = LIGHT.sunDir, sR = RAD * 0.95, ss = 70;
  const up = Math.abs(sd.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const rgt = new THREE.Vector3().crossVectors(up, sd).normalize(), upv = new THREE.Vector3().crossVectors(sd, rgt).normalize();
  const sq = (cx, cy, cz, rx, ry, rz, ux, uy, uz, w, h, region, col) => {
    const [u0, v0] = ruv(region, 0, 0), [u1, v1] = ruv(region, 1, 1);
    quad(B, cx - rx * w - ux * h, cy - ry * w - uy * h, cz - rz * w - uz * h, cx + rx * w - ux * h, cy + ry * w - uy * h, cz + rz * w - uz * h,
      cx + rx * w + ux * h, cy + ry * w + uy * h, cz + rz * w + uz * h, cx - rx * w + ux * h, cy - ry * w + uy * h, cz - rz * w + uz * h, u0, v0, u1, v1, null, col);
  };
  // clouds: soft sprites low over the horizon, facing the centre
  for (let k = 0; k < 14; k++) {
    const az = (k / 14) * Math.PI * 2 + rnd() * 0.35, el = (5 + rnd() * 20) * Math.PI / 180, d = RAD * 0.93;
    const dx = Math.cos(az) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(az) * Math.cos(el);
    const rx = -Math.sin(az), rz = Math.cos(az), w = 40 + rnd() * 45, h = w * (0.32 + rnd() * 0.12);
    skyColor(dy, c); const cc = c.clone().lerp(new THREE.Color(1, 1, 1), 0.85);
    sq(dx * d, dy * d, dz * d, rx, 0, rz, -Math.sin(el) * Math.cos(az), Math.cos(el), -Math.sin(el) * Math.sin(az), w, h, k & 1 ? 'cloud2' : 'cloud1', cc);
  }
  sq(sd.x * sR, sd.y * sR, sd.z * sR, rgt.x, rgt.y, rgt.z, upv.x, upv.y, upv.z, ss, ss, 'halo', C3('#fff6d8'));
  sq(sd.x * sR, sd.y * sR, sd.z * sR, rgt.x, rgt.y, rgt.z, upv.x, upv.y, upv.z, ss * 0.3, ss * 0.3, 'halo', C3('#ffffff'));
  const geo = toGeometry(B, false);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  m.name = 'worldSky'; m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// ================================================================================== markers (rings, arrow)
function buildMarkers(Mk) {
  ringFrom = Mk.P.length / 3;
  const SEG = VIS.ring.seg, [ru, rv0] = ruv('ring', 0.5, 0, 1), [, rv1] = ruv('ring', 0.5, 1, 1);
  ringState = [];
  for (let r = 0; r < 2; r++) {
    const o = Mk.P.length / 3;
    for (let k = 0; k <= SEG; k++) { Mk.P.push(0, -50, 0, 0, -50, 0); Mk.T.push(ru, rv0, ru, rv1); Mk.K.push(1, 1, 1, 1, 1, 1); }
    for (let k = 0; k < SEG; k++) { const a = o + k * 2; Mk.I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    ringState.push({ id: '', x: 0, z: 0, r: -1, active: false, shown: false, base: o });
  }
  arrowFrom = Mk.P.length / 3;
  const [cu0, cv0] = ruv('chev', 0, 0, 1), [cu1, cv1] = ruv('chev', 1, 1, 1), ac = C3(VIS.arrow.color);
  for (let k = 0; k < VIS.arrow.n; k++) {
    const o = Mk.P.length / 3;
    Mk.P.push(0, -50, 0, 0, -50, 0, 0, -50, 0, 0, -50, 0); Mk.T.push(cu0, cv0, cu1, cv0, cu1, cv1, cu0, cv1);
    for (let q = 0; q < 4; q++) Mk.K.push(ac.r, ac.g, ac.b);
    Mk.I.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
}
function setRing(slot, x, z, r, active, color) {
  const st = ringState[slot], pos = mark.geometry.attributes.position, col = mark.geometry.attributes.color, a = pos.array;
  const SEG = VIS.ring.seg, W = VIS.ring.width, trash = ctx.mods.trash;
  st.x = x; st.z = z; st.r = r; st.active = active;
  for (let k = 0; k <= SEG; k++) {
    const ang = (k / SEG) * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang), q = (st.base + k * 2) * 3;
    if (!active) { a[q + 1] = -50; a[q + 4] = -50; continue; }
    const xi = x + cs * (r - W), zi = z + sn * (r - W), xo = x + cs * (r + W), zo = z + sn * (r + W);
    a[q] = xi; a[q + 1] = trash.surfaceAt(xi, zi) + VIS.ring.lift; a[q + 2] = zi;
    a[q + 3] = xo; a[q + 4] = trash.surfaceAt(xo, zo) + VIS.ring.lift; a[q + 5] = zo;
    const ci = (st.base + k * 2) * 3; col.array[ci] = col.array[ci + 3] = color.r; col.array[ci + 1] = col.array[ci + 4] = color.g; col.array[ci + 2] = col.array[ci + 5] = color.b;
  }
  pos.needsUpdate = true; col.needsUpdate = true;
}
let RING_SHOP = null, RING_DROP = null;

// ================================================================================== life (birds, people, confetti)
function buildLife() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const max = VIS.birds * 3 + VIS.pedestrians * 3 + VIS.confetti;
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), max);
  m.name = 'worldLife'; m.frustumCulled = false; m.visible = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // r128 setColorAt sizes the buffer from mesh.count: create it explicitly for all slots
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  // birds: dark grey; people: shirts, legs, skin
  const birdC = C3('#3b3f48'), wingC = C3('#4b5060');
  for (let b = 0; b < VIS.birds; b++) { m.setColorAt(b * 3, birdC); m.setColorAt(b * 3 + 1, wingC); m.setColorAt(b * 3 + 2, wingC); }
  const shirts = ['#e2574c', '#3a86cf', '#ffd23f', '#5fb85a', '#f08a2e', '#b07ad6', '#ffffff', '#2fb5a8'], legs = ['#2f3e5c', '#5b4a3a', '#3b3f48', '#7a6a55'], skin = ['#f1c9a5', '#d9a07a', '#a8714f', '#f6d8bf'];
  const rnd = mulberry(VIS.seed + 77), o = VIS.birds * 3;
  for (let p = 0; p < VIS.pedestrians; p++) { m.setColorAt(o + p * 3, C3(shirts[(rnd() * shirts.length) | 0])); m.setColorAt(o + p * 3 + 1, C3(legs[(rnd() * legs.length) | 0])); m.setColorAt(o + p * 3 + 2, C3(skin[(rnd() * skin.length) | 0])); }
  m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor.needsUpdate = true;
  m.count = 0;
  // pedestrian routes: loops around blocks on the pavement
  peds = [];
  const loops = BLOCKS.map((b) => ({ x0: b.x0 - 0.8, z0: b.z0 - 0.8, x1: b.x1 + 0.8, z1: b.z1 + 0.8 }));
  for (let p = 0; p < VIS.pedestrians; p++) {
    const L = loops[p % loops.length], per = 2 * (L.x1 - L.x0 + L.z1 - L.z0);
    peds.push({ L, per, s: rnd() * per, v: (0.9 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 6, h: 0.92 + rnd() * 0.16 });
  }
  const CF = VIS.confetti;
  cf = { p: new Float32Array(CF * 3), v: new Float32Array(CF * 3), r: new Float32Array(CF * 3), w: new Float32Array(CF * 3), life: new Float32Array(CF), n: 0, next: 0 };
  return m;
}
const CONF_COL = ['#e2574c', '#ffd23f', '#3a86cf', '#5fb85a', '#f08a2e', '#b07ad6', '#ffffff', '#ff8fb0'];
const LEAF_COL = ['#c9a14a', '#8fb04a', '#b5782f', '#e0c060', '#6f9a3a'];
function burst(x, y, z, n, spread, up, leaves) {
  if (!cf) return;
  const CF = VIS.confetti, o = VIS.birds * 3 + VIS.pedestrians * 3;
  for (let k = 0; k < n; k++) {
    const i = cf.next; cf.next = (cf.next + 1) % CF;
    const a = Math.random() * Math.PI * 2, s = Math.random() * spread;
    cf.p[i * 3] = x + (Math.random() - 0.5) * 0.6; cf.p[i * 3 + 1] = y; cf.p[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
    if (leaves) { cf.v[i * 3] = leaves[0] * (3 + Math.random() * 3) + (Math.random() - 0.5); cf.v[i * 3 + 1] = 0.5 + Math.random() * 1.5; cf.v[i * 3 + 2] = leaves[1] * (3 + Math.random() * 3) + (Math.random() - 0.5); }
    else { cf.v[i * 3] = Math.cos(a) * s; cf.v[i * 3 + 1] = up * (0.6 + Math.random() * 0.6); cf.v[i * 3 + 2] = Math.sin(a) * s; }
    cf.r[i * 3] = Math.random() * 6; cf.r[i * 3 + 1] = Math.random() * 6; cf.r[i * 3 + 2] = Math.random() * 6;
    cf.w[i * 3] = (Math.random() - 0.5) * 14; cf.w[i * 3 + 1] = (Math.random() - 0.5) * 10; cf.w[i * 3 + 2] = (Math.random() - 0.5) * 14;
    cf.life[i] = (CFG.feedback && CFG.feedback.milestoneConfettiS ? CFG.feedback.milestoneConfettiS : 2.5) + Math.random() * 1.2;
    tmpCol.set(leaves ? LEAF_COL[(Math.random() * LEAF_COL.length) | 0] : CONF_COL[(Math.random() * CONF_COL.length) | 0]);
    life.setColorAt(o + i, tmpCol);
  }
  life.instanceColor.needsUpdate = true;
}
function lifeUpdate(dt) {
  const birds = (ev & EV.birds) !== 0, people = (ev & EV.pedestrians) !== 0;
  let anyConf = false;
  for (let i = 0; i < VIS.confetti; i++) if (cf.life[i] > 0) { anyConf = true; break; }
  if (!birds && !people && !anyConf) { if (life.visible) { life.visible = false; life.count = 0; } return; }
  life.visible = true;
  const t = tAnim, trash = ctx.mods.trash, D = dummy;
  // birds circle over the plaza
  const P = PLAZA, pcx = (P.x0 + P.x1) / 2, pcz = (P.z0 + P.z1) / 2;
  for (let b = 0; b < VIS.birds; b++) {
    const i = b * 3;
    if (!birds) { zero(i); zero(i + 1); zero(i + 2); continue; }
    const rad = 9 + (b % 4) * 3.5, sp = 0.32 + (b % 3) * 0.05, a = t * sp + b * 0.9, y = 15 + (b % 5) * 1.6 + Math.sin(t * 0.7 + b) * 1.2;
    const x = pcx + Math.cos(a) * rad, z = pcz + Math.sin(a) * rad, yaw = -a, f = Math.sin(t * 11 + b * 1.7) * 0.6;
    D.position.set(x, y, z); D.rotation.set(0, yaw, 0, 'YXZ'); D.scale.set(0.14, 0.11, 0.42); D.updateMatrix(); life.setMatrixAt(i, D.matrix);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), hs = 0.3, cf_ = Math.cos(f), sf = Math.sin(f);
    D.position.set(x + rx * cf_ * hs, y + sf * hs, z + rz * cf_ * hs); D.rotation.set(0, yaw, f, 'YXZ'); D.scale.set(0.6, 0.03, 0.22); D.updateMatrix(); life.setMatrixAt(i + 1, D.matrix);
    D.position.set(x - rx * cf_ * hs, y + sf * hs, z - rz * cf_ * hs); D.rotation.set(0, yaw, -f, 'YXZ'); D.updateMatrix(); life.setMatrixAt(i + 2, D.matrix);
  }
  // people walk around the blocks on the pavement
  const po = VIS.birds * 3;
  for (let p = 0; p < VIS.pedestrians; p++) {
    const i = po + p * 3, q = peds[p];
    if (!people) { zero(i); zero(i + 1); zero(i + 2); continue; }
    q.s = (q.s + q.v * dt + q.per) % q.per;
    const L = q.L, w = L.x1 - L.x0, d = L.z1 - L.z0; let s = q.s, x, z, hx, hz;
    if (s < w) { x = L.x0 + s; z = L.z0; hx = 1; hz = 0; } else if ((s -= w) < d) { x = L.x1; z = L.z0 + s; hx = 0; hz = 1; } else if ((s -= d) < w) { x = L.x1 - s; z = L.z1; hx = -1; hz = 0; } else { s -= w; x = L.x0; z = L.z1 - s; hx = 0; hz = -1; }
    if (q.v < 0) { hx = -hx; hz = -hz; }
    const yaw = Math.atan2(hx, hz), gy = trash.surfaceAt(x, z), bob = Math.abs(Math.sin(t * 7 + q.ph)) * 0.04, k = q.h;
    D.rotation.set(0, yaw, 0, 'YXZ');
    D.position.set(x, gy + 0.78 * k + 0.33 * k + bob, z); D.scale.set(0.44 * k, 0.62 * k, 0.26 * k); D.updateMatrix(); life.setMatrixAt(i, D.matrix);
    D.position.set(x, gy + 0.39 * k + bob * 0.5, z); D.scale.set(0.34 * k, 0.78 * k, 0.2 * k); D.updateMatrix(); life.setMatrixAt(i + 1, D.matrix);
    D.position.set(x, gy + 1.56 * k + bob, z); D.scale.set(0.22 * k, 0.25 * k, 0.23 * k); D.updateMatrix(); life.setMatrixAt(i + 2, D.matrix);
  }
  // confetti: light gravity, drag, flutter; shrinks out at the end of its life
  const co = po + VIS.pedestrians * 3; let maxI = co;
  for (let k = 0; k < VIS.confetti; k++) {
    const i = co + k;
    if (cf.life[k] <= 0) { zero(i); continue; }
    cf.life[k] -= dt;
    const q = k * 3, drag = Math.max(0, 1 - 1.6 * dt);
    cf.v[q] *= drag; cf.v[q + 2] *= drag; cf.v[q + 1] = cf.v[q + 1] * drag - 3.2 * dt;
    if (cf.v[q + 1] < -1.4) cf.v[q + 1] = -1.4;
    cf.p[q] += (cf.v[q] + Math.sin(t * 5 + k) * 0.4) * dt; cf.p[q + 1] += cf.v[q + 1] * dt; cf.p[q + 2] += (cf.v[q + 2] + Math.cos(t * 4 + k) * 0.4) * dt;
    const gy = trash.surfaceAt(cf.p[q], cf.p[q + 2]) + 0.02;
    if (cf.p[q + 1] < gy) { cf.p[q + 1] = gy; cf.v[q] = cf.v[q + 1] = cf.v[q + 2] = 0; }
    else { cf.r[q] += cf.w[q] * dt; cf.r[q + 1] += cf.w[q + 1] * dt; cf.r[q + 2] += cf.w[q + 2] * dt; }
    const sc = Math.min(1, cf.life[k] / 0.5);
    D.position.set(cf.p[q], cf.p[q + 1], cf.p[q + 2]); D.rotation.set(cf.r[q], cf.r[q + 1], cf.r[q + 2], 'XYZ'); D.scale.set(0.13 * sc, 0.012 * sc, 0.09 * sc); D.updateMatrix(); life.setMatrixAt(i, D.matrix);
    maxI = i + 1;
  }
  life.count = anyConf ? maxI : po + VIS.pedestrians * 3;
  life.instanceMatrix.needsUpdate = true;
}
const ZERO_M = { e: null };
function zero(i) { if (!ZERO_M.e) ZERO_M.e = new THREE.Matrix4().makeScale(0, 0, 0); life.setMatrixAt(i, ZERO_M.e); }

// ================================================================================== city events
function setLamps(on) {
  lampsOn = on;
  const col = glow.geometry.attributes.color, c = on ? LAMP_ON : LAMP_OFF;
  for (let v = bulbFrom; v < bulbTo; v++) { col.array[v * 3] = c.r; col.array[v * 3 + 1] = c.g; col.array[v * 3 + 2] = c.b; }
  col.needsUpdate = true;
  mark.geometry.setDrawRange(on ? 0 : haloIdx, Infinity);
}
function enableEvent(name, celebrate) {
  const bit = EV[name] || 0;
  if (name === 'finale') { for (const k of ['birds', 'streetlights', 'pedestrians']) enableEvent(k, false); }
  if (bit) ev |= bit;
  if (name === 'streetlights' || name === 'finale') setLamps(true);
  if (!celebrate) return;
  const P = PLAZA, cam = ctx.camera.position;
  burst((P.x0 + P.x1) / 2, 7, (P.z0 + P.z1) / 2, 70, 6, 7);
  // a smaller burst in front of the camera, so the player sees it wherever they are
  const fx = -Math.sin(ctx.camera.rotation.y), fz = -Math.cos(ctx.camera.rotation.y);
  burst(cam.x + fx * 4, cam.y + 2.5, cam.z + fz * 4, 40, 2.5, 4);
  if (name === 'finale') { const now = tAnim; for (let k = 0; k < 4 && nBursts < 8; k++) { bursts[nBursts * 2] = now + 0.9 + k * 0.9; bursts[nBursts * 2 + 1] = 1; nBursts++; } }
}
function runBursts() {
  for (let k = 0; k < nBursts; k++) {
    if (tAnim < bursts[k * 2]) continue;
    const P = PLAZA;
    burst((P.x0 + P.x1) / 2 + (Math.random() - 0.5) * 8, 9 + Math.random() * 4, (P.z0 + P.z1) / 2 + (Math.random() - 0.5) * 8, 45, 7, 6);
    bursts[k * 2] = bursts[(nBursts - 1) * 2]; bursts[k * 2 + 1] = bursts[(nBursts - 1) * 2 + 1]; nBursts--; k--;
  }
}

// ================================================================================== guide arrow routing
function buildWaypoints() {
  const list = [];
  for (const ox of OFFS) for (const oz of OFFS) list.push(ox + 3, oz + 3);
  list.push(KIOSK.x0 - 1, KIOSK.z0 - 1, KIOSK.x1 + 1, KIOSK.z0 - 1, KIOSK.x0 - 1, KIOSK.z1 + 1, KIOSK.x1 + 1, KIOSK.z1 + 1);
  nWP = list.length / 2; WP = new Float64Array(list);
  WPC = new Uint8Array(nWP * nWP);
  for (let a = 0; a < nWP; a++) for (let b = 0; b < nWP; b++) WPC[a * nWP + b] = segmentClear(WP[a * 2], WP[a * 2 + 1], WP[b * 2], WP[b * 2 + 1], 0.3) ? 1 : 0;
}
// first waypoint from (px, pz) to (tx, tz); writes route.x/z, returns path length
function planRoute(px, pz, tx, tz) {
  const RR = 0.3;
  if (segmentClear(px, pz, tx, tz, RR)) { route.x = tx; route.z = tz; return Math.hypot(tx - px, tz - pz); }
  let best = 1e9, bx = tx, bz = tz;
  for (let a = 0; a < nWP; a++) {
    const ax = WP[a * 2], az = WP[a * 2 + 1];
    if (!segmentClear(px, pz, ax, az, RR)) continue;
    const da = Math.hypot(ax - px, az - pz);
    if (segmentClear(ax, az, tx, tz, RR)) { const c = da + Math.hypot(tx - ax, tz - az); if (c < best) { best = c; bx = ax; bz = az; } continue; }
    for (let b = 0; b < nWP; b++) {
      if (!WPC[a * nWP + b]) continue;
      const qx = WP[b * 2], qz = WP[b * 2 + 1];
      const c = da + Math.hypot(qx - ax, qz - az) + Math.hypot(tx - qx, tz - qz);
      if (c < best && segmentClear(qx, qz, tx, tz, RR)) { best = c; bx = ax; bz = az; }
    }
  }
  route.x = bx; route.z = bz;
  return best < 1e9 ? best : Math.hypot(tx - px, tz - pz);
}
function sellPointsNow() {
  const eco = ctx.mods.economy;
  if (eco && !eco.__stub && typeof eco.sellPoints === 'function') { const s = eco.sellPoints(); if (s && s.length) return s; }
  return FALLBACK_SP;
}
let FALLBACK_SP = null;
function poll() {
  const eco = ctx.mods.economy, player = ctx.mods.player;
  // drop-off container
  const owned = !!(eco && !eco.__stub && typeof eco.owned === 'function' && eco.owned('dropoff'));
  if (owned !== dropShown) showDropoff(owned);
  // sell rings
  const mounted = !!(player && typeof player.mounted === 'function' && player.mounted());
  const sps = sellPointsNow();
  for (let s = 0; s < 2; s++) {
    const sp = s < sps.length ? sps[s] : null, st = ringState[s];
    const active = !!(sp && sp.active !== false), r = sp ? (mounted && sp.cartR ? sp.cartR : sp.r) : 0;
    if (!sp) { if (st.active || st.r !== -2) { setRing(s, 0, 0, 0, false, RING_SHOP); st.r = -2; } continue; }
    // re-seat every poll while active (trash surface under the ring changes as it is cleaned)
    if (active || st.active) setRing(s, sp.x, sp.z, r, active, sp.id === 'dropoff' ? RING_DROP : RING_SHOP);
  }
  // bag full → guide arrow
  let full = false;
  if (eco && !eco.__stub && (typeof eco.bagSpace !== 'function' || typeof eco.bagCapacity !== 'function')) warnOnce('eco', 'economy lacks bagSpace/bagCapacity (MIMARI §4.6): no guide arrow');
  if (eco && !eco.__stub && typeof eco.bagSpace === 'function' && typeof eco.bagCapacity === 'function') {
    const cont = mounted ? 'tank' : 'bag';
    full = eco.bagCapacity(cont) > 0 && eco.bagSpace(cont) === 0;
  }
  bagFull = full;
  arrowOn = false;
  if (full) {
    const pp = playerXZ();
    let best = 1e9, bi = -1;
    for (let s = 0; s < sps.length; s++) {
      const sp = sps[s]; if (sp.active === false) continue;
      const d = planRoute(pp.x, pp.z, sp.x, sp.z);
      if (d < best) { best = d; bi = s; route.tx = route.x; route.tz = route.z; route.tr = mounted && sp.cartR ? sp.cartR : sp.r; route.ok = true; route.px = sp.x; route.pz = sp.z; }
    }
    if (bi >= 0) { route.x = route.tx; route.z = route.tz; arrowOn = Math.hypot(route.px - pp.x, route.pz - pp.z) > route.tr; }
  }
}
const PXZ = { x: 0, z: 0 };
function playerXZ() {
  const pl = ctx.mods.player;
  if (pl && !pl.__stub && typeof pl.pose === 'function') { const p = pl.pose(); if (p) { PXZ.x = p.x; PXZ.z = p.z; return PXZ; } }
  PXZ.x = ctx.camera.position.x; PXZ.z = ctx.camera.position.z; return PXZ;
}
function arrowUpdate(dt) {
  const pos = mark.geometry.attributes.position, a = pos.array, n = VIS.arrow.n;
  if (!arrowOn) {
    if (a[arrowFrom * 3 + 1] > -40) { for (let v = arrowFrom; v < arrowFrom + n * 4; v++) a[v * 3 + 1] = -50; pos.needsUpdate = true; }
    return;
  }
  const pp = playerXZ(), trash = ctx.mods.trash;
  let fx = route.x - pp.x, fz = route.z - pp.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
  const rx = -fz, rz = fx, w = VIS.arrow.size[0], h = VIS.arrow.size[1];
  arrowPhase = (arrowPhase + dt * VIS.arrow.speed) % 1;
  for (let k = 0; k < n; k++) {
    const d = VIS.arrow.from + (k + arrowPhase) * VIS.arrow.step, cx = pp.x + fx * d, cz = pp.z + fz * d;
    const y = trash.surfaceAt(cx, cz) + VIS.arrow.lift, o = (arrowFrom + k * 4) * 3;
    // corners: back-left, back-right, front-right, front-left (chevron points forward)
    a[o] = cx - fx * h / 2 + rx * w / 2; a[o + 1] = y; a[o + 2] = cz - fz * h / 2 + rz * w / 2;
    a[o + 3] = cx - fx * h / 2 - rx * w / 2; a[o + 4] = y; a[o + 5] = cz - fz * h / 2 - rz * w / 2;
    a[o + 6] = cx + fx * h / 2 - rx * w / 2; a[o + 7] = y; a[o + 8] = cz + fz * h / 2 - rz * w / 2;
    a[o + 9] = cx + fx * h / 2 + rx * w / 2; a[o + 10] = y; a[o + 11] = cz + fz * h / 2 + rz * w / 2;
  }
  pos.needsUpdate = true;
}
function showDropoff(on) {
  dropShown = on;
  city.geometry.setDrawRange(0, on ? Infinity : cityBase);
  glow.geometry.setDrawRange(0, on ? Infinity : glowBase);
  nSol = on && CONT ? nSolBase + 1 : nSolBase;
}
let CONT = null;

// ================================================================================== module API
export function init(c) {
  const t0 = performance.now();
  ctx = c; THREE = c.THREE || window.THREE; CFG = c.CONFIG;
  dummy = new THREE.Object3D(); tmpCol = new THREE.Color();
  readConfig(); defRegions();
  PLAZA = BLOCKS.find((b) => b.plaza) || BLOCKS[0];
  const L = VIS.light, sunDir = new THREE.Vector3(L.dir[0], L.dir[1], L.dir[2]).normalize();
  LIGHT = { sunDir, sunColor: C3(L.sun, L.sunI), skyColor: C3(L.sky, L.hemiI), groundColor: C3(L.ground, L.hemiI), fogColor: C3(L.fog) };
  LAMP_OFF = C3('#c9c6bd'); LAMP_ON = C3('#fff3c2'); RING_SHOP = C3(VIS.ring.shop); RING_DROP = C3(VIS.ring.dropoff);
  const built = makeLayout(); LAYOUT = built.layout;
  // solids for collision: the home district's building blocks, the kiosk; the container slot last
  const sol = [];
  for (const B of BLOCKS) if (!B.plaza) sol.push(B.x0, B.z0, B.x1, B.z1);
  sol.push(KIOSK.x0, KIOSK.z0, KIOSK.x1, KIOSK.z1);
  nSolBase = sol.length / 4;
  sol.push(0, 0, 0, 0);
  SOL = new Float64Array(sol); nSol = nSolBase;
  // points of interest
  const P = CFG.player || {}, sps = CFG.sellPoints || [], deg = Math.PI / 180;
  const spShop = sps.find((s) => s.id === 'shop'), spDrop = sps.find((s) => s.id === 'dropoff');
  FALLBACK_SP = [];
  if (spShop) FALLBACK_SP.push({ id: 'shop', x: spShop.pos[0], z: spShop.pos[1], r: spShop.radiusM, cartR: spShop.cartRadiusM, active: true });
  // ground and atlas textures, materials
  groundTex = paintGround();
  atlasTex = makeAtlas();
  RW = rect('white', 8);
  const rnd = mulberry(VIS.seed + 9);
  const CB = buildCity(built.lots, rnd), GL = mkB(false), MK = mkB(false);
  buildProps(CB, GL, MK, rnd);
  cityBase = CB.I.length; glowBase = GL.I.length;
  CONT = buildContainer(CB, GL);
  if (CONT) { SOL[nSolBase * 4] = CONT.x0; SOL[nSolBase * 4 + 1] = CONT.z0; SOL[nSolBase * 4 + 2] = CONT.x1; SOL[nSolBase * 4 + 3] = CONT.z1; }
  buildMarkers(MK);
  city = new THREE.Mesh(toGeometry(CB, true), atlasLambert(atlasTex)); city.name = 'worldCity';
  glow = new THREE.Mesh(toGeometry(GL, false), new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true })); glow.name = 'worldGlow';
  const mg = toGeometry(MK, false);
  mg.attributes.position.setUsage(THREE.DynamicDrawUsage); mg.attributes.color.setUsage(THREE.DynamicDrawUsage);
  mark = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: VIS.ring.alpha, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mark.name = 'worldMarkers'; mark.frustumCulled = false; mark.renderOrder = 2;
  sky = buildSky();
  life = buildLife();
  const s = ctx.scene;
  s.background = LIGHT.fogColor.clone();
  s.fog = new THREE.Fog(LIGHT.fogColor.getHex(), VIS.fog.near, VIS.fog.far);
  hemi = new THREE.HemisphereLight(C3(L.sky), C3(L.ground), L.hemiI); hemi.name = 'worldHemi'; s.add(hemi);
  sun = new THREE.DirectionalLight(C3(L.sun), L.sunI); sun.name = 'worldSun'; sun.position.copy(sunDir); s.add(sun); s.add(sun.target);
  s.add(city); s.add(glow); s.add(mark); s.add(sky); s.add(life);
  showDropoff(false); setLamps(false);
  PTS = [
    { id: 'spawn', x: (P.startPos || [SIZE / 2, SIZE / 2])[0], z: (P.startPos || [SIZE / 2, SIZE / 2])[1], r: P.radiusM || 0.35, yaw: (P.startYawDeg || 0) * deg },
    { id: 'shop', x: spShop ? spShop.pos[0] : (KIOSK.x0 + KIOSK.x1) / 2, z: spShop ? spShop.pos[1] : KIOSK.z1 + 2, r: spShop ? spShop.radiusM : 2.5, yaw: Math.PI },
    { id: 'dropoff', x: spDrop ? spDrop.pos[0] : 3, z: spDrop ? spDrop.pos[1] : SIZE - 3, r: spDrop ? spDrop.radiusM : 2.5, yaw: spDrop && spDrop.pos[0] < SIZE / 2 ? Math.PI / 2 : -Math.PI / 2 },
    { id: 'dock', x: CFG.robot && CFG.robot.dockPos ? CFG.robot.dockPos[0] : KIOSK.x0 - 2, z: CFG.robot && CFG.robot.dockPos ? CFG.robot.dockPos[1] : KIOSK.z1 + 2, r: (CFG.robot && CFG.robot.radiusM ? CFG.robot.radiusM : 0.35) * 2, yaw: Math.PI },
    { id: 'cartPark', x: CFG.cart && CFG.cart.parkPos ? CFG.cart.parkPos[0] : KIOSK.x1, z: CFG.cart && CFG.cart.parkPos ? CFG.cart.parkPos[1] : KIOSK.z1 + 9, r: CFG.cart && CFG.cart.enterRadiusM ? CFG.cart.enterRadiusM : 2, yaw: (CFG.cart && CFG.cart.parkYawDeg != null ? CFG.cart.parkYawDeg : 180) * deg },
    { id: 'billboard', x: BILL.x, z: BILL.z, r: BILL.r, yaw: 0, y: BILL.y },
  ];
  buildWaypoints();
  // events
  const bus = ctx.bus;
  bus.on('trash:milestone', (p) => {
    const ms = CFG.milestones || [], m = p && ms[p.index];
    if (m && m.cityEvent) enableEvent(m.cityEvent, true);
  });
  bus.on('district:cleaned', () => { if (!(ev & EV.finale)) enableEvent('finale', true); });
  bus.on('economy:purchased', (p) => { if (p && p.id === 'dropoff') pollT = 0; });
  bus.on('economy:bagFull', () => { pollT = 0; });
  bus.on('economy:finalSweep', () => { const cam = ctx.camera.position; burst(cam.x - 6, cam.y + 1, cam.z - 2, 60, 0, 0, WIND); burst(cam.x - 4, cam.y + 0.5, cam.z + 3, 40, 0, 0, WIND); });
  bus.on('game:ready', () => { syncEventsFromTrash(); fallbackGround(); });
  bus.on('gl:restored', () => { if (groundTex) groundTex.needsUpdate = true; if (atlasTex) atlasTex.needsUpdate = true; });
  sky.position.copy(ctx.camera.position);
  pollT = 0;
  if (ctx.debug) console.info('[world] init ' + (performance.now() - t0).toFixed(0) + ' ms, city ' + (CB.I.length / 3) + ' tris, glow ' + (GL.I.length / 3) + ', markers ' + (MK.I.length / 3));
}
// partial builds only: when trash.js is a stub nothing draws the ground, so world lays a flat plane
// with the ground plan (1 extra draw call, never present with the real trash module)
function fallbackGround() {
  const tr = ctx.mods.trash;
  if (!tr || !tr.__stub) return;
  warnOnce('ground', 'trash.js is a stub: drawing a fallback ground plane (MIMARI §4.2 says trash draws the ground)');
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: groundTex }));
  inner.position.set(SIZE / 2, 0, SIZE / 2); inner.name = 'worldFallbackGround';
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5f6166 }));
  outer.position.set(SIZE / 2, -0.01, SIZE / 2); outer.name = 'worldFallbackGround2';
  ctx.scene.add(inner); ctx.scene.add(outer);
}
const WIND = [0.8, 0.6];
function syncEventsFromTrash() {
  const tr = ctx.mods.trash;
  if (!tr || tr.__stub || typeof tr.cleanFraction !== 'function') return;
  const f = tr.cleanFraction(), ms = CFG.milestones || [];
  for (const m of ms) if (m.cityEvent && f >= m.at - 1e-9 && !(ev & (EV[m.cityEvent] || 0))) enableEvent(m.cityEvent, false);
}

export function update(dt) {
  const cam = ctx.camera.position;
  sky.position.copy(cam);
  tAnim += dt;
  const rdt = ctx.time && ctx.time.dt != null ? ctx.time.dt : dt;
  pollT -= rdt;
  if (pollT <= 0) { pollT = 0.25; poll(); }
  if ((langT -= rdt) <= 0) { langT = 1; if (lang() !== atlasLang) { paintSigns(atlasCanvas.getContext('2d')); atlasLang = lang(); atlasTex.needsUpdate = true; } }
  // ring pulse: gentle normally, strong while the bag is full
  const m = mark.material;
  m.opacity = bagFull ? VIS.ring.alphaFull * (0.75 + 0.25 * Math.sin(ctx.time.real * 6)) : VIS.ring.alpha * (0.85 + 0.15 * Math.sin(ctx.time.real * 2));
  arrowUpdate(rdt);
  if (nBursts) runBursts();
  lifeUpdate(dt);
}

export function save() { return { v: 1, ev }; }
export function load(d) {
  if (!d || typeof d !== 'object') return;
  const bits = d.ev | 0;
  if (bits & EV.birds) enableEvent('birds', false);
  if (bits & EV.streetlights) enableEvent('streetlights', false);
  if (bits & EV.pedestrians) enableEvent('pedestrians', false);
  if (bits & EV.finale) ev |= EV.finale;
}

export function layout() { return LAYOUT; }
export function groundTexture() { return groundTex; }
export function lighting() { return LIGHT; }
export function points() { return PTS; }
export function point(id) { if (!PTS) return null; for (let k = 0; k < PTS.length; k++) if (PTS[k].id === id) return PTS[k]; return null; }

export function kindAt(x, z) {
  if (!LAYOUT) return 1;
  if (x >= 0 && z >= 0 && x < SIZE && z < SIZE) return LAYOUT.kind[Math.floor(z / CELL) * N + Math.floor(x / CELL)];
  const lx = ((x % SIZE) + SIZE) % SIZE, lz = ((z % SIZE) + SIZE) % SIZE;
  return kindLocal(lx, lz, false);
}
export function outsideUnits(i, j) {
  if (kindAt((i + 0.5) * CELL, (j + 0.5) * CELL) === 0) return 0;
  const h = hash2(i, j, 0x5e11) & 3;
  return h === 0 ? 1 : h === 3 ? 3 : 2;   // 1, 2, 2, 3: mean 2 = the far layer's constant outside depth
}
export function isBlocked(x, z, radius) {
  const r = radius > 0 ? radius : 0;
  if (x < BX0 + r || x > BX1 - r || z < BZ0 + r || z > BZ1 - r) return true;
  for (let k = 0; k < nSol; k++) {
    const o = k * 4, x0 = SOL[o], z0 = SOL[o + 1], x1 = SOL[o + 2], z1 = SOL[o + 3];
    if (x >= x0 && x < x1 && z >= z0 && z < z1) return true;
    if (r > 0) { const cx = x < x0 ? x0 : x > x1 ? x1 : x, cz = z < z0 ? z0 : z > z1 ? z1 : z, dx = x - cx, dz = z - cz; if (dx * dx + dz * dz < r * r) return true; }
  }
  return false;
}
export function collide(x, z, radius, out) {
  const r = radius > 0 ? radius : 0;
  let px = x, pz = z, hit = false;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (let k = 0; k < nSol; k++) {
      const o = k * 4, x0 = SOL[o], z0 = SOL[o + 1], x1 = SOL[o + 2], z1 = SOL[o + 3];
      if (px <= x0 - r || px >= x1 + r || pz <= z0 - r || pz >= z1 + r) continue;
      const inside = px > x0 && px < x1 && pz > z0 && pz < z1;
      if (!inside) {
        const cx = px < x0 ? x0 : px > x1 ? x1 : px, cz = pz < z0 ? z0 : pz > z1 ? z1 : pz, dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-12) { const d = Math.sqrt(d2), s = (r - d) / d + 1e-7; px += dx * s; pz += dz * s; hit = moved = true; continue; }
      }
      const l = px - x0, rr = x1 - px, t = pz - z0, bb = z1 - pz, m = Math.min(l, rr, t, bb);
      if (m === l) px = x0 - r - 1e-7; else if (m === rr) px = x1 + r + 1e-7; else if (m === t) pz = z0 - r - 1e-7; else pz = z1 + r + 1e-7;
      hit = moved = true;
    }
    if (!moved) break;
  }
  const lx = BX0 + r, hx = BX1 - r, lz = BZ0 + r, hz = BZ1 - r;
  if (px < lx) { px = lx; hit = true; } else if (px > hx) { px = hx; hit = true; }
  if (pz < lz) { pz = lz; hit = true; } else if (pz > hz) { pz = hz; hit = true; }
  out.x = px; out.z = pz; out.hit = hit;
  return out;
}
function ptBox2(x, z, x0, z0, x1, z1) { const cx = x < x0 ? x0 : x > x1 ? x1 : x, cz = z < z0 ? z0 : z > z1 ? z1 : z; return (x - cx) * (x - cx) + (z - cz) * (z - cz); }
function ptSeg2(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const qx = ax + dx * t - px, qz = az + dz * t - pz; return qx * qx + qz * qz; }
let _t0 = 0, _t1 = 1;
function clipT(p, q) { if (p === 0) return q >= 0; const t = q / p; if (p < 0) { if (t > _t1) return false; if (t > _t0) _t0 = t; } else { if (t < _t0) return false; if (t < _t1) _t1 = t; } return true; }
function segHitsBox(ax, az, bx, bz, x0, z0, x1, z1) { // Liang-Barsky, closed box, no allocation
  _t0 = 0; _t1 = 1; const dx = bx - ax, dz = bz - az;
  return clipT(-dx, ax - x0) && clipT(dx, x1 - ax) && clipT(-dz, az - z0) && clipT(dz, z1 - az);
}
export function segmentClear(x0, z0, x1, z1, radius) {
  const r = radius > 0 ? radius : 0;
  if (isBlocked(x0, z0, r) || isBlocked(x1, z1, r)) return false; // bounds shrunk by r are convex: endpoints inside => segment inside
  const r2 = r * r;
  for (let k = 0; k < nSol; k++) {
    const o = k * 4, bx0 = SOL[o], bz0 = SOL[o + 1], bx1 = SOL[o + 2], bz1 = SOL[o + 3];
    // quick reject on the swept bounds
    if (Math.max(x0, x1) < bx0 - r || Math.min(x0, x1) > bx1 + r || Math.max(z0, z1) < bz0 - r || Math.min(z0, z1) > bz1 + r) continue;
    if (segHitsBox(x0, z0, x1, z1, bx0, bz0, bx1, bz1)) return false;
    if (r > 0 && (ptBox2(x0, z0, bx0, bz0, bx1, bz1) < r2 || ptBox2(x1, z1, bx0, bz0, bx1, bz1) < r2 ||
      ptSeg2(bx0, bz0, x0, z0, x1, z1) < r2 || ptSeg2(bx1, bz0, x0, z0, x1, z1) < r2 || ptSeg2(bx0, bz1, x0, z0, x1, z1) < r2 || ptSeg2(bx1, bz1, x0, z0, x1, z1) < r2)) return false;
  }
  return true;
}
