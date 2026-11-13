// trash.js — the trash system of Temiz Şehir. Owner: trash. Contract: docs/MIMARI.md §4.3, §5, §6.
//
// Productionised from the architect's measured reference test/spike/trash-core.js (copied in: modules
// cannot import). Notes, tunables and measurements: docs/notlar/trash.md.
//
// Model
//   grid[j*N+i] = trash UNITS in cell (i,j), 0..K. 1 unit = 1 visible item = 1 bag slot. The grid is the
//   single source of truth; everything visible (far layer, near items, juice) and everything reported
//   (TrashResult, events, save) is derived from it, so they cannot disagree.
//   far layer : ONE ground mesh displaced/shaded by a LuminanceAlpha DataTexture (L = units, A = "cleaned"
//               flag for the washed look), changed rows uploaded with texSubImage2D.
//   near items: one InstancedMesh per shape; item k of cell c exists iff k < grid[c]; type/shape/pose/colour
//               from hash(cell, k). Removing a unit removes the top item k = units-1 and reports its type.
//   juice     : removed items that were visible fly to the collector inside the SAME instanced meshes
//               (tail of each list, 0 extra draw calls); a dust puff (1 Points draw, only while alive)
//               rises from cells that became clean near the camera.
//
// Hot paths (remove*, pick, consume, update) do not allocate. TrashResult / Picked / event payloads are
// reused objects: read or copy at once.

// ---------------------------------------------------------------- shapes and looks
const SHAPES = ['bag', 'bottle', 'can', 'box', 'paper', 'sheet', 'gem'];
const SHAPE_DEF = { // sink: metres below the trash surface (× scale); tilt: max random tilt (rad)
  bag: { sink: 0.07, tilt: 0.35 }, bottle: { sink: 0.015, tilt: 0.35 }, can: { sink: 0.012, tilt: 0.3 },
  box: { sink: 0.06, tilt: 0.45 }, paper: { sink: 0.015, tilt: 0.3 }, sheet: { sink: -0.004, tilt: 0.25 },
  gem: { sink: -0.01, tilt: 0.6 },
};
const PALETTES = { // sRGB
  garbage: ['#1c1d20', '#1c1d20', '#26282c', '#2e4a32', '#d4d3cb', '#3b5e95', '#5c5f63'],
  pet: ['#a9c8d6', '#8fb3c5', '#cfe0e6', '#5c8fb8', '#b8d0b0'],
  glass: ['#3f7a45', '#6b3f1f', '#7fa88a', '#2f5a3a'],
  can: ['#b8282a', '#c0c4c8', '#2c5db0', '#3f8f3f', '#d8b23a', '#202020'],
  cardboard: ['#a47c4e', '#8c6a43', '#b8925f', '#7a5a38'],
  paper: ['#e8e4d8', '#d5d0c2', '#c9c3b3', '#efe9d6'],
  news: ['#d8d4c8', '#cfcabb', '#bdb8aa', '#a8a399'],
  wrapper: ['#b8553a', '#3f86a6', '#d0a030', '#8a3a7a', '#e0e0e0'],
  gold: ['#f2c230', '#ffd75a', '#e8b020'],
};
// trash type id (CONFIG.trashTypes[].id) → [shape, weight, palette]; unknown ids fall back to paper
const DEFAULT_VISUALS = {
  paper: [['paper', 0.45, 'paper'], ['sheet', 0.35, 'news'], ['box', 0.2, 'cardboard']],
  plastic: [['bottle', 0.6, 'pet'], ['sheet', 0.4, 'wrapper']],
  can: [['can', 1, 'can']],
  glass: [['bottle', 1, 'glass']],
  bag: [['bag', 1, 'garbage']],
  valuable: [['gem', 1, 'gold']],
};
// palettes used by the far-layer tile painter (top-down drawings)
const TILE_PAL = {
  bag: PALETTES.garbage, bottle: PALETTES.pet.concat(PALETTES.glass), can: PALETTES.can,
  box: PALETTES.cardboard, paper: PALETTES.paper, sheet: PALETTES.news.concat(['#b8553a', '#3f86a6']),
};

// ---------------------------------------------------------------- hashing
function h32(a) {
  a |= 0;
  a = Math.imul(a ^ (a >>> 16), 0x7feb352d);
  a = Math.imul(a ^ (a >>> 15), 0x846ca68b);
  return (a ^ (a >>> 16)) >>> 0;
}
function mulberry(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- canvas textures
// Tileable top-down "pile of trash" tile. RGB = albedo with baked contact shadows,
// A = height (0 = gap between items, 1 = top of a bag).
function makeTrashTile(size, seed) {
  const rnd = mulberry(seed);
  const cA = document.createElement('canvas'); cA.width = cA.height = size;
  const cH = document.createElement('canvas'); cH.width = cH.height = size;
  const a = cA.getContext('2d'), h = cH.getContext('2d');
  a.fillStyle = '#2b2722'; a.fillRect(0, 0, size, size);
  h.fillStyle = '#000'; h.fillRect(0, 0, size, size);
  // dirt crumbs in the gaps
  for (let i = 0; i < 900; i++) {
    a.fillStyle = `rgba(${60 + rnd() * 50 | 0},${50 + rnd() * 40 | 0},${35 + rnd() * 30 | 0},0.6)`;
    a.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 4, 2 + rnd() * 4);
  }
  const pxPerM = size / 2.0; // tile covers 2 m × 2 m
  const items = [];
  const pick = (arr) => arr[(rnd() * arr.length) | 0];
  // layering: big bags & boxes first, then smaller stuff on top
  // roughly the street/plaza zone mix by area: paper-heavy, some bags (big), bottles, cans
  const plan = [['bag', 14], ['box', 18], ['sheet', 30], ['bag', 6], ['bottle', 30], ['can', 26], ['paper', 36], ['sheet', 14], ['can', 10], ['paper', 18]];
  let layer = 0;
  for (const [type, n] of plan) {
    for (let i = 0; i < n; i++) items.push({ type, x: rnd() * size, y: rnd() * size, r: rnd() * Math.PI * 2, s: 0.8 + rnd() * 0.45, c: pick(TILE_PAL[type]), layer, v: rnd() });
    layer++;
  }
  const L = layer;
  function blob(ctx, rx, ry, jit, seedv) {
    const r2 = mulberry((seedv * 1e6) | 0);
    const n = 10, pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, k = 1 + (r2() - 0.5) * jit;
      pts.push([Math.cos(t) * rx * k, Math.sin(t) * ry * k]);
    }
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const p = pts[0], q = pts[1];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    ctx.closePath();
  }
  function shade(hex, f) {
    const c = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((c >> 16) & 255) * f) | 0, g = Math.min(255, ((c >> 8) & 255) * f) | 0, b = Math.min(255, (c & 255) * f) | 0;
    return `rgb(${r},${g},${b})`;
  }
  function drawItem(it, ox, oy) {
    const s = it.s * pxPerM, base = (it.layer / L) * 0.45;
    for (const pass of [0, 1]) {
      const ctx = pass === 0 ? a : h;
      ctx.save();
      ctx.translate(it.x + ox, it.y + oy); ctx.rotate(it.r);
      if (pass === 0) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 0.05 * pxPerM; ctx.shadowOffsetX = 0.015 * pxPerM; ctx.shadowOffsetY = 0.02 * pxPerM; }
      const hv = (top) => { const v = Math.min(255, (base + top) * 255) | 0; return `rgb(${v},${v},${v})`; };
      switch (it.type) {
        case 'bag': {
          const rx = 0.22 * s, ry = 0.18 * s;
          blob(ctx, rx, ry, 0.35, it.v);
          if (pass === 0) {
            const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, rx * 0.1, 0, 0, rx * 1.1);
            g.addColorStop(0, shade(it.c, 1.9)); g.addColorStop(0.45, shade(it.c, 1.05)); g.addColorStop(1, shade(it.c, 0.55));
            ctx.fillStyle = g; ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = shade(it.c, 0.5); ctx.lineWidth = 0.008 * pxPerM;
            for (let k = 0; k < 4; k++) { ctx.beginPath(); const t = it.v * 9 + k * 1.7; ctx.moveTo(Math.cos(t) * rx * 0.2, Math.sin(t) * ry * 0.2); ctx.lineTo(Math.cos(t) * rx * 0.85, Math.sin(t) * ry * 0.85); ctx.stroke(); }
            ctx.fillStyle = shade(it.c, 0.7); ctx.beginPath(); ctx.arc(rx * 0.75, 0, 0.025 * pxPerM, 0, 7); ctx.fill();
          } else {
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.05);
            g.addColorStop(0, hv(0.5)); g.addColorStop(1, hv(0.12));
            ctx.fillStyle = g; ctx.fill();
          }
          break;
        }
        case 'box': {
          const w = 0.32 * s, d = 0.24 * s;
          if (pass === 0) {
            ctx.fillStyle = it.c; ctx.fillRect(-w / 2, -d / 2, w, d);
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = shade(it.c, 1.15); ctx.fillRect(-w / 2, -d / 2, w, d * 0.48);
            ctx.strokeStyle = shade(it.c, 0.65); ctx.lineWidth = 0.006 * pxPerM; ctx.strokeRect(-w / 2, -d / 2, w, d);
            ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
            ctx.fillStyle = 'rgba(220,200,150,0.7)'; ctx.fillRect(-0.025 * pxPerM, -d / 2, 0.05 * pxPerM, d);
          } else { ctx.fillStyle = hv(0.3); ctx.fillRect(-w / 2, -d / 2, w, d); }
          break;
        }
        case 'can': {
          const l = 0.12 * s, r = 0.034 * s;
          if (pass === 0) {
            ctx.fillStyle = it.c; ctx.fillRect(-l / 2, -r, l, 2 * r);
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = shade(it.c, 1.6); ctx.fillRect(-l / 2, -r * 0.55, l, r * 0.35);
            ctx.fillStyle = shade(it.c, 0.6); ctx.fillRect(-l / 2, r * 0.45, l, r * 0.55);
            ctx.fillStyle = '#c9ccd0'; ctx.fillRect(-l / 2 - 0.004 * pxPerM, -r, 0.01 * pxPerM, 2 * r); ctx.fillRect(l / 2 - 0.006 * pxPerM, -r, 0.01 * pxPerM, 2 * r);
          } else { ctx.fillStyle = hv(0.12); ctx.fillRect(-l / 2, -r, l, 2 * r); }
          break;
        }
        case 'bottle': {
          const l = 0.17 * s, r = 0.036 * s;
          ctx.beginPath(); ctx.moveTo(-l / 2, -r); ctx.lineTo(l * 0.18, -r); ctx.lineTo(l * 0.36, -r * 0.4); ctx.lineTo(l * 0.62, -r * 0.4); ctx.lineTo(l * 0.62, r * 0.4); ctx.lineTo(l * 0.36, r * 0.4); ctx.lineTo(l * 0.18, r); ctx.lineTo(-l / 2, r); ctx.closePath();
          if (pass === 0) {
            ctx.fillStyle = it.c; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-l * 0.45, -r * 0.6, l * 0.75, r * 0.25);
            ctx.fillStyle = it.v > 0.5 ? '#e8e8e8' : '#c03030'; ctx.fillRect(l * 0.6, -r * 0.42, 0.012 * pxPerM, r * 0.84);
            if (it.v > 0.4) { ctx.fillStyle = 'rgba(240,240,230,0.85)'; ctx.fillRect(-l * 0.25, -r, l * 0.22, 2 * r); }
          } else { ctx.fillStyle = hv(0.13); ctx.fill(); }
          break;
        }
        case 'paper': {
          const rr = 0.05 * s;
          blob(ctx, rr, rr * 0.9, 0.5, it.v);
          if (pass === 0) {
            ctx.fillStyle = it.c; ctx.fill(); ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'rgba(90,85,75,0.6)'; ctx.lineWidth = 0.004 * pxPerM;
            for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-rr * 0.7, (k - 1) * rr * 0.4); ctx.lineTo(rr * 0.6, (k - 1) * rr * 0.5 + rr * 0.2); ctx.stroke(); }
          } else { ctx.fillStyle = hv(0.12); ctx.fill(); }
          break;
        }
        case 'sheet': {
          const w = 0.28 * s, d = 0.2 * s;
          if (pass === 0) {
            ctx.fillStyle = it.c; ctx.fillRect(-w / 2, -d / 2, w, d); ctx.shadowColor = 'transparent';
            if (it.c !== '#b8553a' && it.c !== '#3f86a6') { // newspaper: text columns
              ctx.fillStyle = 'rgba(70,70,70,0.45)';
              for (let y = -d / 2 + 0.02 * pxPerM; y < d / 2 - 0.01 * pxPerM; y += 0.014 * pxPerM) { ctx.fillRect(-w / 2 + 0.015 * pxPerM, y, w * 0.42, 0.006 * pxPerM); ctx.fillRect(0.01 * pxPerM, y, w * 0.4, 0.006 * pxPerM); }
            } else { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-w / 2, -d / 2, w, d * 0.3); }
          } else { ctx.fillStyle = hv(0.04); ctx.fillRect(-w / 2, -d / 2, w, d); }
          break;
        }
      }
      ctx.restore();
    }
  }
  for (const it of items) {
    const m = 0.3 * pxPerM;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      if (it.x + ox < -m || it.x + ox > size + m || it.y + oy < -m || it.y + oy > size + m) continue;
      drawItem(it, ox, oy);
    }
  }
  const A = a.getImageData(0, 0, size, size).data, H = h.getImageData(0, 0, size, size).data;
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { out[i * 4] = A[i * 4]; out[i * 4 + 1] = A[i * 4 + 1]; out[i * 4 + 2] = A[i * 4 + 2]; out[i * 4 + 3] = H[i * 4]; }
  return out;
}

function makeNoise(size, seed) {
  const rnd = mulberry(seed), d = new Uint8Array(size * size * 4);
  for (let i = 0; i < d.length; i++) d[i] = (rnd() * 256) | 0;
  // one box-blur pass per channel so bilinear value noise is smoother
  const o = new Uint8Array(d.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += d[((((y + dy + size) % size) * size + ((x + dx + size) % size)) * 4) + c];
    o[(y * size + x) * 4 + c] = s / 9;
  }
  // stretch contrast back to ~0..255
  for (let i = 0; i < o.length; i++) o[i] = Math.max(0, Math.min(255, (o[i] - 128) * 2.6 + 128));
  return o;
}

// ---------------------------------------------------------------- item geometries
function finishGeo(THREE, g) {
  g.computeBoundingBox();
  const bb = g.boundingBox, pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (pos.getY(i) - bb.min.y) / Math.max(1e-6, bb.max.y - bb.min.y);
    const v = 0.5 + 0.5 * t; // baked contact darkening towards the bottom
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // origin at the item's resting point (bottom centre)
  g.translate(0, -bb.min.y, 0);
  g.computeBoundingSphere();
  return g;
}
function lumpy(THREE, g, amp, seed, sx, sy, sz) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = h32(((Math.round(x * 1000) * 73856093) ^ (Math.round(y * 1000) * 19349663) ^ (Math.round(z * 1000) * 83492791)) + seed) / 4294967296;
    const f = 1 + (k - 0.5) * amp;
    p.setXYZ(i, x * f * sx, y * f * sy, z * f * sz);
  }
  g.computeVertexNormals();
  return g;
}
function makeItemGeometries(THREE) {
  const G = {};
  // bag: lumpy flattened low sphere (6×4 segments = 36 tris) — the hero item
  G.bag = finishGeo(THREE, lumpy(THREE, new THREE.SphereGeometry(0.2, 6, 4), 0.4, 7, 1.15, 0.62, 0.95));
  const bottle = new THREE.LatheGeometry([new THREE.Vector2(0.0, -0.11), new THREE.Vector2(0.037, -0.105), new THREE.Vector2(0.037, 0.03), new THREE.Vector2(0.013, 0.075), new THREE.Vector2(0.0, 0.112)], 5);
  bottle.rotateZ(Math.PI / 2); G.bottle = finishGeo(THREE, bottle);
  const can = new THREE.CylinderGeometry(0.034, 0.034, 0.12, 7, 1); can.rotateZ(Math.PI / 2); G.can = finishGeo(THREE, can);
  const box = new THREE.BoxGeometry(0.32, 0.2, 0.24); G.box = finishGeo(THREE, box);
  G.paper = finishGeo(THREE, lumpy(THREE, new THREE.IcosahedronGeometry(0.055, 0), 0.5, 3, 1, 0.85, 1));
  // sheet: bent double-sided quad strip (newspaper / cardboard flat / wrapper)
  const sp = [], si = [], W = 0.28, D = 0.2, seg = 3;
  for (let s = 0; s <= 1; s++) for (let i = 0; i <= seg; i++) for (let j = 0; j <= 1; j++) {
    const x = -W / 2 + (W * i) / seg, z = -D / 2 + D * j;
    sp.push(x, 0.012 + Math.sin((i / seg) * Math.PI) * 0.025 + (s ? -0.002 : 0), z);
  }
  const row = (seg + 1) * 2;
  for (let s = 0; s <= 1; s++) for (let i = 0; i < seg; i++) {
    const o = s * row, a = o + i * 2, b = a + 1, c = a + 2, d = a + 3;
    if (s === 0) si.push(a, b, c, b, d, c); else si.push(a, c, b, b, c, d);
  }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sheet.setIndex(si); sheet.computeVertexNormals();
  G.sheet = finishGeo(THREE, sheet);
  G.gem = finishGeo(THREE, new THREE.OctahedronGeometry(0.045, 0)); // valuables: small gold glint
  return G;
}

// ---------------------------------------------------------------- visual tunables (engine look, not design data)
const LOOK = {
  layerHeight: 0.30,       // m, visual height of the layer at K units
  nearHalf: 18,            // near window = (2·nearHalf)² cells
  fadeStart: 6.2, fadeEnd: 8.5, // near items shrink into the far layer between these distances (m)
  tileMeters: 2.0, tileSize: 512, bump: 0.06, anisotropy: 4,
  meshInner: 32, meshOuter: 16, meshExtent: 300,
  outGround: '#3d3e40',
  // cleaned ground: washed = base·gain + lift; sheen = sky reflection at grazing angles (reads from 30+ m)
  cleanGain: 1.35, cleanLift: 0.035, cleanSheen: 0.32, cleanFadeMul: 1.6,   // integration: 1.5/0.045/0.55 read as snow at eye level
  rimHalo: 0.4,            // wide grime halo strength around trash (0..1); the narrow band at the edge is always drawn
  // juice
  flyMax: 160,             // pooled flying items (all shapes together)
  flySpawnPerFrame: 40,
  flyStagger: 0.012,       // s between items removed in one frame (cascade)
  flyHop: { brush: 0.28, broom: 0.35, cart: 0.18, robot: 0.10, debug: 0.2 },
  flySwirl: { brush: 0.03, broom: 0.06, cart: 0.32, robot: 0.18, debug: 0 },
  flyDurRobot: 0.34, gustDur: 1.1, gustDist: 4.5, gustRise: 2.6,
  handOffset: [-0.19, -0.26, -0.56],  // camera-local target for brush sweeps: the dustpan (x right, y up, -z forward)
  bagOffset: [0.2, -0.85, -0.3],      // broom: bag at the hip, yaw frame (x right, y below the eye, z back)
  collectY: 0.16,          // m, height of dustpan / intake / robot mouth
  dustMax: 96, dustPerFrame: 8, dustLife: 0.55, dustRange: 16, dustColor: '#b7aa94', dustAlpha: 0.38,
};
const BY_IDS = ['brush', 'broom', 'cart', 'robot', 'final', 'debug'];

// ---------------------------------------------------------------- shaders
const GROUND_VS = /* glsl */`
uniform sampler2D uDepth;
uniform float uSize, uUnit, uHPerUnit, uOutUnits;
varying vec3 vW;
#include <fog_pars_vertex>
float unitsAt(vec2 xz){
  vec2 uv = xz / uSize;
  float d = texture2D(uDepth, uv).r * uUnit;
  vec2 ins = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return mix(uOutUnits, d, ins.x * ins.y);
}
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y += unitsAt(w.xz) * uHPerUnit;
  vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const GROUND_FS = /* glsl */`
uniform sampler2D uDepth, uTrash, uNoise, uGround;
uniform float uSize, uUnit, uOutUnits, uTexel, uTile, uHPerUnit, uBump;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uOutGround;
uniform vec3 uClean; // x gain, y lift, z sheen
uniform float uRim;  // strength of the wide grime halo (the narrow edge band is always full)
varying vec3 vW;
#include <fog_pars_fragment>
float dAt(vec2 uv){
  float d = texture2D(uDepth, uv).r * uUnit;
  vec2 ins = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return mix(uOutUnits, d, ins.x * ins.y);
}
void main(){
  vec2 uv = vW.xz / uSize;
  vec2 ins = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  float inside = ins.x * ins.y;
  vec4 c0 = texture2D(uDepth, uv);
  float d = mix(uOutUnits, c0.r * uUnit, inside);
  float cl = c0.a * inside;                       // 1 = cleaned district ground (bilinear: soft edge)
  float o = uTexel * 1.5;
  float dl = dAt(uv - vec2(o, 0.0)), dr = dAt(uv + vec2(o, 0.0));
  float du = dAt(uv - vec2(0.0, o)), dd = dAt(uv + vec2(0.0, o));
  float blur = (dl + dr + du + dd) * 0.25;
  vec4 nM = texture2D(uNoise, vW.xz * (1.0 / 61.0));
  vec4 nF = texture2D(uNoise, vW.xz * (1.0 / 5.3));
  vec4 t1 = texture2D(uTrash, vW.xz * uTile);
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * vW.xz * (uTile * 0.71) + vec2(0.37, 0.61);
  vec4 t2 = texture2D(uTrash, q);
  float bias = (nM.r - 0.5) * 1.6;
  float pick2 = step(t1.a - bias, t2.a + bias);
  vec4 t = mix(t1, t2, pick2);
  float hh = t.a * 0.85 + 0.1 + (nF.g - 0.5) * 0.14;
  float thr = 1.15 - d * 1.15;
  float cover = smoothstep(thr - 0.05, thr + 0.05, hh);
  vec3 base = texture2D(uGround, uv).rgb;
  base = mix(uOutGround, base, inside);
  base *= 0.9 + 0.2 * nF.b;
  base = mix(base, base * uClean.x + uClean.y, cl);   // washed: lighter than ground that was never cleaned
  float g = max(smoothstep(0.04, 0.75, d), uRim * smoothstep(0.0, 1.0, blur)) * (0.55 + 0.45 * nM.g);
  base = mix(base, base * vec3(0.5, 0.46, 0.4), g);    // grimy rim next to trash (the dirty edge)
  vec4 nL = texture2D(uNoise, vW.xz * (1.0 / 173.0));
  vec3 tc = t.rgb * mix(vec3(0.8, 0.85, 0.95), vec3(1.12, 1.04, 0.86), smoothstep(0.2, 0.8, nL.b * 0.6 + nM.b * 0.4));
  tc *= 0.82 + 0.3 * nL.a;
  tc *= mix(1.06, 0.9, clamp((d - 1.0) / 3.0, 0.0, 1.0));
  tc *= 0.72 + 0.28 * smoothstep(0.0, 0.6, t.a);
  vec3 dpdx = dFdx(vW), dpdy = dFdy(vW);
  float dhx = dFdx(t.a), dhy = dFdy(t.a);
  vec3 N0 = vec3(0.0, 1.0, 0.0);
  vec3 r1 = cross(dpdy, N0), r2 = cross(N0, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  vec3 Nt = normalize(abs(det) * N0 - grad * uBump);
  float k = uHPerUnit / (2.0 * o * uSize);
  Nt = normalize(Nt + vec3(-(dr - dl) * k, 0.0, -(dd - du) * k));
  vec3 N = normalize(mix(N0, Nt, cover));
  float diff = max(dot(N, uSunDir), 0.0);
  vec3 hemi = mix(uGndCol, uSkyCol, N.y * 0.5 + 0.5);
  vec3 col = mix(base, tc, cover) * (hemi + uSunCol * diff);
  // wet sheen on cleaned ground: sky reflection that grows at grazing angles, so the trail reads from afar
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
  col += uSkyCol * (uClean.z * fres * cl * (1.0 - cover) * (1.0 - 0.6 * g));
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

const DUST_VS = /* glsl */`
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vA;
#include <fog_pars_vertex>
void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * uScale / max(0.2, -mvPosition.z);
  vA = aAlpha;
  #include <fog_vertex>
}`;
const DUST_FS = /* glsl */`
uniform vec3 uColor;
varying float vA;
#include <fog_pars_fragment>
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = dot(c, c) * 4.0;
  float e = max(0.0, 1.0 - r);
  float a = vA * e * e;
  if (a <= 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <fog_fragment>
}`;

// ---------------------------------------------------------------- the core
// createCore(o): adapted from test/spike/trash-core.js createTrashCore (same options, same mechanics) plus:
// LuminanceAlpha depth texture with a "cleaned" channel, removal hooks for juice, flying items in the tail
// of the per-shape instance lists, a dust Points cloud, full-grid candidate buffers, input-safe helpers.
function createCore(opts) {
  const THREE = window.THREE;
  const o = Object.assign({
    N: 108, cell: 0.5, K: 4, types: ['paper', 'plastic', 'can', 'glass', 'bag', 'valuable'], visuals: DEFAULT_VISUALS,
    zones: null, mixes: null, initial: null, outside: null, outsideZone: 1, outUnitsShader: 2,
    groundMap: null, light: null, fadeS: 0.2, seed: 1, renderer: null, camera: null,
  }, LOOK, opts || {});
  const N = o.N, K = o.K, CELL = o.cell, SIZE = N * CELL, NN = N * N;
  if (!(K >= 1 && K <= 8)) throw new Error('trash: K must be 1..8');
  const VS = Math.floor(255 / K);
  const renderer = o.renderer, camera = o.camera;
  const TYPES = o.types, NT = TYPES.length, NS = SHAPES.length;
  const outsideFn = typeof o.outside === 'function' ? o.outside : () => 2;
  const outsideSafe = (i, j) => { const v = outsideFn(i, j) | 0; return v < 0 ? 0 : v > K ? K : v; };

  // ---- grid state
  const grid = new Uint8Array(NN), initGrid = new Uint8Array(NN);
  const vis = new Uint8Array(NN * 2);              // interleaved: [units·VS, cleaned 0|255]
  const zones = o.zones || new Uint8Array(NN).fill(1);
  const BS = 12, B = Math.ceil(N / BS);
  const blockSum = new Int32Array(B * B);
  let total = 0, initialTotal = 0, trashCells0 = 0, cleanCells = 0;

  // ---- deterministic randomness per (cell, k)
  const SEED = h32(o.seed * 2654435761);
  const keyOf = (i, j) => ((j + 2048) << 12) | (i + 2048);
  const rnd = (key, k, n) => h32((key * 0x9E3779B1) ^ (k * 0x85EBCA77 + n * 0xC2B2AE3D) ^ SEED) / 4294967296;

  const nZones = Math.max(2, (o.mixes ? o.mixes.length : 2));
  const zoneCum = [];
  for (let z = 0; z < nZones; z++) {
    const m = (o.mixes && o.mixes[z]) || null, c = new Float32Array(NT);
    let s = 0;
    for (let t = 0; t < NT; t++) { s += m ? (m[TYPES[t]] || 0) : 1; c[t] = s; }
    for (let t = 0; t < NT; t++) c[t] = s > 0 ? c[t] / s : (t + 1) / NT;
    zoneCum.push(c);
  }
  const shapeIdx = Object.fromEntries(SHAPES.map((s, i) => [s, i]));
  const typeShapes = TYPES.map((id) => {
    const v = (o.visuals[id] || o.visuals.paper || DEFAULT_VISUALS.paper);
    let s = 0; const cum = [], shp = [], pal = [];
    for (const [shape, w, palName] of v) { s += w; cum.push(s); shp.push(shapeIdx[shape] ?? shapeIdx.paper); pal.push((PALETTES[palName] || PALETTES.paper).map((c) => new THREE.Color(c))); }
    return { cum: cum.map((x) => x / s), shp, pal };
  });
  const zoneAt = (i, j) => (i >= 0 && j >= 0 && i < N && j < N) ? zones[j * N + i] : o.outsideZone;
  function typeOf(i, j, key, k) {
    const c = zoneCum[zoneAt(i, j)] || zoneCum[1], r = rnd(key, k, 0);
    for (let t = 0; t < NT - 1; t++) if (r < c[t]) return t;
    return NT - 1;
  }
  function variantOf(t, key, k) { const ts = typeShapes[t], r = rnd(key, k, 8); for (let v = 0; v < ts.cum.length - 1; v++) if (r < ts.cum[v]) return v; return ts.cum.length - 1; }
  const visTarget = (idx) => grid[idx] * VS;
  const cleanTarget = (idx) => (grid[idx] === 0 && initGrid[idx] > 0 ? 255 : 0);

  function resetGrid() {
    total = 0; trashCells0 = 0; cleanCells = 0; blockSum.fill(0);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const idx = j * N + i;
      let u = zones[idx] === 0 ? 0 : (o.initial ? o.initial[idx] : 1 + ((rnd(keyOf(i, j), 9, 9) * K) | 0));
      u = Math.max(0, Math.min(K, u | 0));
      grid[idx] = initGrid[idx] = u; vis[idx * 2] = u * VS; vis[idx * 2 + 1] = 0;
      if (u > 0) trashCells0++;
      total += u; blockSum[((j / BS) | 0) * B + ((i / BS) | 0)] += u;
    }
    initialTotal = total;
  }
  resetGrid();

  // ---- textures
  // depth texture format: 'rgba' (default) mirrors vis into an RGBA8 buffer (R = G = B = units, A = cleaned) so the
  // vertex shader only ever samples the universally supported RGBA8/UNSIGNED_BYTE format; 'la' uploads the
  // interleaved LUMINANCE_ALPHA buffer directly (legacy unsized format). Neither needs a float extension.
  const RGBA = o.depthFormat !== 'la';
  const vis4 = RGBA ? new Uint8Array(NN * 4) : null;
  function mirror(r0, r1) { for (let q = r0 * N, e = (r1 + 1) * N; q < e; q++) { const v = vis[q * 2]; vis4[q * 4] = v; vis4[q * 4 + 1] = v; vis4[q * 4 + 2] = v; vis4[q * 4 + 3] = vis[q * 2 + 1]; } }
  if (RGBA) mirror(0, N - 1);
  const depthTex = RGBA ? new THREE.DataTexture(vis4, N, N, THREE.RGBAFormat, THREE.UnsignedByteType) : new THREE.DataTexture(vis, N, N, THREE.LuminanceAlphaFormat, THREE.UnsignedByteType);
  depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
  depthTex.generateMipmaps = false; depthTex.unpackAlignment = 1; depthTex.flipY = false;
  depthTex.needsUpdate = true;
  const TS = o.tileSize;
  const trashTex = new THREE.DataTexture(makeTrashTile(TS, o.seed + 11), TS, TS, THREE.RGBAFormat, THREE.UnsignedByteType);
  trashTex.wrapS = trashTex.wrapT = THREE.RepeatWrapping;
  trashTex.magFilter = THREE.LinearFilter; trashTex.minFilter = THREE.LinearMipmapLinearFilter; trashTex.generateMipmaps = true;
  if (renderer) trashTex.anisotropy = Math.min(o.anisotropy, renderer.capabilities.getMaxAnisotropy());
  trashTex.needsUpdate = true;
  const noiseTex = new THREE.DataTexture(makeNoise(128, o.seed + 5), 128, 128, THREE.RGBAFormat, THREE.UnsignedByteType);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = THREE.LinearFilter; noiseTex.minFilter = THREE.LinearMipmapLinearFilter; noiseTex.generateMipmaps = true;
  noiseTex.needsUpdate = true;
  let groundMap = o.groundMap, ownGroundMap = false;
  if (!groundMap) {
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const x = c.getContext('2d'); x.fillStyle = '#3d3e40'; x.fillRect(0, 0, 4, 4);
    groundMap = new THREE.CanvasTexture(c); ownGroundMap = true;
  }
  const textureBytes = NN * 2 + TS * TS * 4 * 4 / 3 + 128 * 128 * 4 * 4 / 3;

  // ---- ground mesh: camera-centred grid, 1-cell spacing near, geometric growth far
  const offs = [];
  {
    const inner = o.meshInner, outer = o.meshOuter, reach = o.meshExtent - inner * CELL;
    let lo = 1.01, hi = 3;
    for (let it = 0; it < 60; it++) { const r = (lo + hi) / 2; let s = 0, st = CELL; for (let k = 0; k < outer; k++) { st *= r; s += st; } if (s > reach) hi = r; else lo = r; }
    const r = (lo + hi) / 2, pos = [0];
    for (let k = 1; k <= inner; k++) pos.push(k * CELL);
    let p = inner * CELL, st = CELL; for (let k = 0; k < outer; k++) { st *= r; p += st; pos.push(p); }
    for (let k = pos.length - 1; k > 0; k--) offs.push(-pos[k]);
    for (const v of pos) offs.push(v);
  }
  const GV = offs.length;
  const gpos = new Float32Array(GV * GV * 3);
  for (let j = 0; j < GV; j++) for (let i = 0; i < GV; i++) { const q = (j * GV + i) * 3; gpos[q] = offs[i]; gpos[q + 2] = offs[j]; }
  const gidx = new Uint16Array((GV - 1) * (GV - 1) * 6);
  { let q = 0; for (let j = 0; j < GV - 1; j++) for (let i = 0; i < GV - 1; i++) { const a = j * GV + i, b = a + 1, c = a + GV, d = c + 1; gidx[q++] = a; gidx[q++] = c; gidx[q++] = b; gidx[q++] = b; gidx[q++] = c; gidx[q++] = d; } }
  const ggeo = new THREE.BufferGeometry();
  ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  ggeo.setIndex(new THREE.BufferAttribute(gidx, 1));
  ggeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), o.meshExtent * 1.5);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uDepth: { value: null }, uTrash: { value: null }, uNoise: { value: null }, uGround: { value: null },
    uSize: { value: SIZE }, uUnit: { value: 255 / VS }, uHPerUnit: { value: o.layerHeight / K },
    uOutUnits: { value: o.outUnitsShader }, uTexel: { value: 1 / N }, uTile: { value: 1 / o.tileMeters }, uBump: { value: o.bump },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() }, uSunCol: { value: new THREE.Color(0.75, 0.7, 0.62) },
    uSkyCol: { value: new THREE.Color(0.55, 0.6, 0.68) }, uGndCol: { value: new THREE.Color(0.3, 0.28, 0.25) },
    uOutGround: { value: new THREE.Color(o.outGround) },
    uClean: { value: new THREE.Vector3(o.cleanGain, o.cleanLift, o.cleanSheen) }, uRim: { value: o.rimHalo },
  }]);
  uniforms.uDepth.value = depthTex; uniforms.uTrash.value = trashTex; uniforms.uNoise.value = noiseTex; uniforms.uGround.value = groundMap;
  const groundMat = new THREE.ShaderMaterial({ uniforms, vertexShader: GROUND_VS, fragmentShader: GROUND_FS, fog: true });
  groundMat.extensions.derivatives = true;
  const groundMesh = new THREE.Mesh(ggeo, groundMat);
  groundMesh.frustumCulled = false; groundMesh.name = 'trashGround';
  const dustColor = new THREE.Color(o.dustColor);
  function setLight(l) {
    if (!l) return;
    if (l.sunDir) uniforms.uSunDir.value.copy(l.sunDir).normalize();
    if (l.sunColor) uniforms.uSunCol.value.copy(l.sunColor);
    if (l.skyColor) uniforms.uSkyCol.value.copy(l.skyColor);
    if (l.groundColor) uniforms.uGndCol.value.copy(l.groundColor);
    // dust is unlit: bake the light of an upward-facing surface into its colour
    const sd = uniforms.uSunDir.value, sc = uniforms.uSunCol.value, sk = uniforms.uSkyCol.value;
    const f = Math.max(0, sd.y);
    dustUniforms.uColor.value.setRGB(dustColor.r * (sk.r + sc.r * f), dustColor.g * (sk.g + sc.g * f), dustColor.b * (sk.b + sc.b * f));
  }

  // ---- near items: one InstancedMesh per shape, dense lists with swap-remove; fliers in the tail
  const W = o.nearHalf * 2, WW = W * W, FLY = o.flyMax;
  const geos = makeItemGeometries(THREE);
  const fadeU = { value: new THREE.Vector4(o.fadeStart, o.fadeEnd, 0, 0) };
  const itemMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  itemMat.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = fadeU;
    sh.vertexShader = 'uniform vec4 uFade;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float fdist = distance(instanceMatrix[3].xz, uFade.zw);
        transformed *= 1.0 - smoothstep(uFade.x, uFade.y, fdist);
      #endif`);
  };
  const group = new THREE.Group(); group.name = 'trash';
  group.add(groundMesh);
  const lists = [];
  const sinkS = new Float32Array(NS), tiltS = new Float32Array(NS);
  for (let s = 0; s < NS; s++) {
    const name = SHAPES[s], cap = WW * K + FLY;
    const mesh = new THREE.InstancedMesh(geos[name], itemMat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'trash_' + name;
    group.add(mesh);
    lists.push({ mesh, mat: mesh.instanceMatrix.array, col: mesh.instanceColor.array, owner: new Int32Array(cap), count: 0, fly: 0, dmin: 1e9, dmax: -1, pmin: 1e9, pmax: -1 });
    sinkS[s] = SHAPE_DEF[name].sink; tiltS[s] = SHAPE_DEF[name].tilt;
  }
  const slotOwner = new Int32Array(WW).fill(-1);
  const slotShown = new Uint8Array(WW);
  const itemDense = new Int32Array(WW * K).fill(-1);
  const itemShape = new Uint8Array(WW * K);
  const yStamp = new Uint32Array(WW);
  let stamp = 1, wi0 = -1e6, wj0 = -1e6, lastRenderFrame = -2;

  // ---- dust: one Points cloud, compacted every frame, hidden when empty
  const DM = o.dustMax;
  const dPos = new Float32Array(DM * 3), dSize = new Float32Array(DM), dAlpha = new Float32Array(DM);
  const dust = { x: new Float32Array(DM), y: new Float32Array(DM), z: new Float32Array(DM), vx: new Float32Array(DM), vz: new Float32Array(DM), age: new Float32Array(DM), life: new Float32Array(DM), s0: new Float32Array(DM), n: 0 };
  const dgeo = new THREE.BufferGeometry();
  const dPosAttr = new THREE.BufferAttribute(dPos, 3).setUsage(THREE.DynamicDrawUsage);
  const dSizeAttr = new THREE.BufferAttribute(dSize, 1).setUsage(THREE.DynamicDrawUsage);
  const dAlphaAttr = new THREE.BufferAttribute(dAlpha, 1).setUsage(THREE.DynamicDrawUsage);
  dgeo.setAttribute('position', dPosAttr); dgeo.setAttribute('aSize', dSizeAttr); dgeo.setAttribute('aAlpha', dAlphaAttr);
  dgeo.setDrawRange(0, 0);
  const dustUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 300 }, uColor: { value: new THREE.Color(0.7, 0.66, 0.6) } }]);
  const dustMat = new THREE.ShaderMaterial({ uniforms: dustUniforms, vertexShader: DUST_VS, fragmentShader: DUST_FS, fog: true, transparent: true, depthWrite: false });
  const dustPts = new THREE.Points(dgeo, dustMat);
  dustPts.frustumCulled = false; dustPts.visible = false; dustPts.name = 'trashDust'; dustPts.renderOrder = 2;
  group.add(dustPts);
  setLight(o.light);

  // ---- dirty tracking: cells (items) and rows (texture), plus the visual fade list
  const dirtyMark = new Uint8Array(NN);
  const DIRTY_CAP = 16384, dirtyList = new Int32Array(DIRTY_CAP);
  let dirtyCount = 0, dirtyOverflow = false, rowMin = N, rowMax = -1;
  // v2 (90 m district): per-row dirty column span, so an upload covers only the changed rectangles, not one band of
  // full rows from the northernmost to the southernmost change (with robots spread over a 180-cell grid that band
  // was most of the texture every frame)
  const rowC0 = new Int16Array(N).fill(N), rowC1 = new Int16Array(N).fill(-1);
  function markRC(i, j) { if (j < rowMin) rowMin = j; if (j > rowMax) rowMax = j; if (i < rowC0[j]) rowC0[j] = i; if (i > rowC1[j]) rowC1[j] = i; }
  const animMark = new Uint8Array(NN), animList = new Int32Array(NN);
  let animCount = 0;
  function cellChanged(idx, j) {
    if (o.fadeS > 0) { if (!animMark[idx]) { animMark[idx] = 1; animList[animCount++] = idx; } }
    else { vis[idx * 2] = visTarget(idx); vis[idx * 2 + 1] = cleanTarget(idx); markRC(idx - j * N, j); }
    if (dirtyMark[idx]) return;
    dirtyMark[idx] = 1;
    if (dirtyCount < DIRTY_CAP) dirtyList[dirtyCount++] = idx; else dirtyOverflow = true;
  }
  function stepFade(dt) {
    if (!animCount) return;
    const step = Math.max(1, Math.ceil((VS * dt) / o.fadeS));
    const stepC = Math.max(1, Math.ceil((255 * dt) / (o.fadeS * o.cleanFadeMul)));
    for (let a = animCount - 1; a >= 0; a--) {
      const idx = animList[a], q = idx * 2, target = visTarget(idx), ct = cleanTarget(idx), v = vis[q], c = vis[q + 1];
      const nv = v > target ? Math.max(target, v - step) : Math.min(target, v + step);
      const nc = c > ct ? Math.max(ct, c - stepC) : Math.min(ct, c + stepC);
      vis[q] = nv; vis[q + 1] = nc;
      const j = (idx / N) | 0; markRC(idx - j * N, j);
      if (nv === target && nc === ct) { animMark[idx] = 0; animList[a] = animList[--animCount]; }
    }
  }

  // ---- helpers
  const unitsAt = (i, j) => (i >= 0 && j >= 0 && i < N && j < N) ? grid[j * N + i] : outsideSafe(i, j);
  const HPU = o.layerHeight / K;
  function surfaceAt(x, z) {
    const gx = x / CELL - 0.5, gz = z / CELL - 0.5;
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const a = unitsAt(i, j), b = unitsAt(i + 1, j), c = unitsAt(i, j + 1), d = unitsAt(i + 1, j + 1);
    return ((a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz) * HPU;
  }
  const wslot = (i, j) => (((j % W) + W) % W) * W + (((i % W) + W) % W);
  const itemX = (i, key, k) => (i + 0.5 + (rnd(key, k, 1) - 0.5) * 1.3) * CELL;
  const itemZ = (j, key, k) => (j + 0.5 + (rnd(key, k, 2) - 0.5) * 1.3) * CELL;
  const itemS = (key, k) => 0.8 + rnd(key, k, 5) * 0.45;
  function itemColor(t, v, key, k, out) {
    const pal = typeShapes[t].pal[v], c = pal[(rnd(key, k, 6) * pal.length) | 0], jv = 0.85 + rnd(key, k, 7) * 0.3;
    out.r = c.r * jv; out.g = c.g * jv; out.b = c.b * jv; return out;
  }
  const tmpC = { r: 0, g: 0, b: 0 };
  // column-major T·Ry·Rx·S
  function writeMat(m, q, x, y, z, yaw, tilt, s) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt);
    m[q] = cy * s; m[q + 1] = 0; m[q + 2] = -sy * s; m[q + 3] = 0;
    m[q + 4] = sy * sx * s; m[q + 5] = cx * s; m[q + 6] = cy * sx * s; m[q + 7] = 0;
    m[q + 8] = sy * cx * s; m[q + 9] = -sx * s; m[q + 10] = cy * cx * s; m[q + 11] = 0;
    m[q + 12] = x; m[q + 13] = y; m[q + 14] = z; m[q + 15] = 1;
  }
  const itemYaw = (key, k) => rnd(key, k, 3) * 6.2832;
  const itemTilt = (sh, key, k) => (rnd(key, k, 4) - 0.5) * 2 * tiltS[sh];
  function writeItem(sh, d, t, v, key, k, i, j) {
    const Ls = lists[sh], s = itemS(key, k);
    const x = itemX(i, key, k), z = itemZ(j, key, k);
    writeMat(Ls.mat, d * 16, x, surfaceAt(x, z) - sinkS[sh] * s, z, itemYaw(key, k), itemTilt(sh, key, k), s);
    itemColor(t, v, key, k, tmpC);
    const cq = d * 3; Ls.col[cq] = tmpC.r; Ls.col[cq + 1] = tmpC.g; Ls.col[cq + 2] = tmpC.b;
    if (d < Ls.dmin) Ls.dmin = d; if (d > Ls.dmax) Ls.dmax = d;
  }
  function addItem(slot, k, key, i, j) {
    const id = slot * K + k, t = typeOf(i, j, key, k), v = variantOf(t, key, k), sh = typeShapes[t].shp[v];
    const Ls = lists[sh], d = Ls.count++;
    Ls.owner[d] = id; itemDense[id] = d; itemShape[id] = sh;
    writeItem(sh, d, t, v, key, k, i, j);
  }
  function removeItem(id) {
    const d = itemDense[id]; if (d < 0) return;
    const Ls = lists[itemShape[id]], last = --Ls.count;
    if (d !== last) {
      const m = Ls.mat, c = Ls.col;
      for (let e = 0; e < 16; e++) m[d * 16 + e] = m[last * 16 + e];
      c[d * 3] = c[last * 3]; c[d * 3 + 1] = c[last * 3 + 1]; c[d * 3 + 2] = c[last * 3 + 2];
      const moved = Ls.owner[last]; Ls.owner[d] = moved; itemDense[moved] = d;
      if (d < Ls.dmin) Ls.dmin = d; if (d > Ls.dmax) Ls.dmax = d;
    }
    itemDense[id] = -1;
  }
  function ownSlot(slot, i, j) {
    const key = keyOf(i, j);
    for (let k = slotShown[slot] - 1; k >= 0; k--) removeItem(slot * K + k);
    slotOwner[slot] = key; slotShown[slot] = 0;
    const n = Math.min(K, unitsAt(i, j));
    for (let k = 0; k < n; k++) addItem(slot, k, key, i, j);
    slotShown[slot] = n;
  }
  const inWin = (i, j) => i >= wi0 && i < wi0 + W && j >= wj0 && j < wj0 + W;
  function syncCell(i, j) {
    if (!inWin(i, j)) return;
    const slot = wslot(i, j), key = keyOf(i, j);
    if (slotOwner[slot] !== key) { ownSlot(slot, i, j); return; }
    const n = unitsAt(i, j), s = slotShown[slot];
    if (n < s) for (let k = s - 1; k >= n; k--) removeItem(slot * K + k);
    else for (let k = s; k < n; k++) addItem(slot, k, key, i, j);
    slotShown[slot] = n;
  }
  function refreshY(i, j) {
    if (!inWin(i, j)) return;
    const slot = wslot(i, j), key = keyOf(i, j);
    if (slotOwner[slot] !== key || yStamp[slot] === stamp) return;
    yStamp[slot] = stamp;
    for (let k = 0; k < slotShown[slot]; k++) {
      const id = slot * K + k, d = itemDense[id]; if (d < 0) continue;
      const sh = itemShape[id], Ls = lists[sh], q = d * 16;
      Ls.mat[q + 13] = surfaceAt(Ls.mat[q + 12], Ls.mat[q + 14]) - sinkS[sh] * itemS(key, k);
      if (d < Ls.dmin) Ls.dmin = d; if (d > Ls.dmax) Ls.dmax = d;
    }
  }
  function recenter(ci, cj) {
    const ni = ci - o.nearHalf, nj = cj - o.nearHalf;
    if (ni === wi0 && nj === wj0) return 0;
    const di = ni - wi0, dj = nj - wj0;
    let n = 0;
    wi0 = ni; wj0 = nj;
    if (Math.abs(di) >= W || Math.abs(dj) >= W) {
      for (let j = nj; j < nj + W; j++) for (let i = ni; i < ni + W; i++) { ownSlot(wslot(i, j), i, j); n++; }
      return n;
    }
    if (di !== 0) {
      const a = di > 0 ? ni + W - di : ni, b = di > 0 ? ni + W : ni - di;
      for (let i = a; i < b; i++) for (let j = nj; j < nj + W; j++) { const s = wslot(i, j); if (slotOwner[s] !== keyOf(i, j)) { ownSlot(s, i, j); n++; } }
    }
    if (dj !== 0) {
      const a = dj > 0 ? nj + W - dj : nj, b = dj > 0 ? nj + W : nj - dj;
      for (let j = a; j < b; j++) for (let i = ni; i < ni + W; i++) { const s = wslot(i, j); if (slotOwner[s] !== keyOf(i, j)) { ownSlot(s, i, j); n++; } }
    }
    return n;
  }

  // ---- juice: flying items + dust (driven by the hooks in takeFromCell)
  // juice.mode: 0 off, 1 camera-local target (hand), 2 yaw-frame target that follows the player (broom, cart),
  //             3 fixed world target (robot), 4 gust (final sweep)
  const juice = { mode: 0, tx: 0, ty: 0, tz: 0, hop: 0, swirl: 0, dur: 0.25, spawned: 0, dusted: 0 };
  const F = {
    sh: new Uint8Array(FLY), mode: new Uint8Array(FLY), t: new Float32Array(FLY), dur: new Float32Array(FLY), delay: new Float32Array(FLY),
    x: new Float32Array(FLY), y: new Float32Array(FLY), z: new Float32Array(FLY), yaw: new Float32Array(FLY), tilt: new Float32Array(FLY), s: new Float32Array(FLY),
    r: new Float32Array(FLY), g: new Float32Array(FLY), b: new Float32Array(FLY),
    tx: new Float32Array(FLY), ty: new Float32Array(FLY), tz: new Float32Array(FLY), hop: new Float32Array(FLY), swirl: new Float32Array(FLY), ph: new Float32Array(FLY),
    alive: new Uint8Array(FLY), head: 0, n: 0,
  };
  let camX = 0, camZ = 0; // camera at the last update (visibility of near items)
  function spawnFly(i, j, key, k, t) {
    if (juice.spawned >= o.flySpawnPerFrame) return;
    const x = itemX(i, key, k), z = itemZ(j, key, k);
    const dx = x - camX, dz = z - camZ;
    if (dx * dx + dz * dz > fadeU.value.y * fadeU.value.y || !inWin(i, j) || slotOwner[wslot(i, j)] !== key) return; // not visible as an item
    const v = variantOf(t, key, k), sh = typeShapes[t].shp[v], s = itemS(key, k);
    const f = F.head; F.head = (F.head + 1) % FLY;
    if (!F.alive[f]) F.n++;
    F.alive[f] = 1; F.sh[f] = sh; F.mode[f] = juice.mode; F.t[f] = 0;
    const jit = rnd(key, k, 11);
    F.delay[f] = Math.min(12, juice.spawned) * o.flyStagger;
    F.dur[f] = juice.dur * (0.85 + 0.3 * jit);
    F.x[f] = x; F.z[f] = z; F.y[f] = surfaceAt(x, z) - sinkS[sh] * s; // surface before this removal
    F.yaw[f] = itemYaw(key, k); F.tilt[f] = itemTilt(sh, key, k); F.s[f] = s;
    itemColor(t, v, key, k, tmpC); F.r[f] = tmpC.r; F.g[f] = tmpC.g; F.b[f] = tmpC.b;
    F.tx[f] = juice.tx; F.ty[f] = juice.ty; F.tz[f] = juice.tz; F.hop[f] = juice.hop * (0.7 + 0.6 * jit); F.swirl[f] = juice.swirl;
    F.ph[f] = jit * 6.2832;
    juice.spawned++;
  }
  function spawnDust(i, j) {
    if (juice.dusted >= o.dustPerFrame) return;
    const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, dx = x - camX, dz = z - camZ;
    if (dx * dx + dz * dz > o.dustRange * o.dustRange) return;
    let q = dust.n;
    if (q >= DM) { // replace the oldest
      let best = 0; for (let a = 1; a < DM; a++) if (dust.age[a] / dust.life[a] > dust.age[best] / dust.life[best]) best = a;
      q = best;
    } else dust.n++;
    const h = h32((i * 73856093) ^ (j * 19349663) ^ juice.dusted) / 4294967296;
    dust.x[q] = x + (h - 0.5) * 0.2; dust.z[q] = z + (h * 7 % 1 - 0.5) * 0.2; dust.y[q] = 0.06;
    dust.vx[q] = (h - 0.5) * 0.5; dust.vz[q] = ((h * 13) % 1 - 0.5) * 0.5;
    dust.age[q] = 0; dust.life[q] = o.dustLife * (0.8 + 0.4 * h); dust.s0[q] = 0.35 + 0.25 * h;
    juice.dusted++;
  }
  const qv = new THREE.Vector3();
  function stepJuice(dt) {
    // fliers: write each live one after the static items of its shape
    for (let s = 0; s < NS; s++) lists[s].fly = 0;
    if (F.n > 0) {
      let yaw = 0, cpx = 0, cpy = 0, cpz = 0;
      if (camera) { yaw = -camera.rotation.y; cpx = camera.position.x; cpy = camera.position.y; cpz = camera.position.z; }
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      for (let f = 0; f < FLY; f++) {
        if (!F.alive[f]) continue;
        F.t[f] += dt;
        const tt = F.t[f] - F.delay[f], u0 = tt / F.dur[f];
        if (u0 >= 1) { F.alive[f] = 0; F.n--; continue; }
        const u = u0 < 0 ? 0 : u0, sh = F.sh[f], Ls = lists[sh], d = Ls.count + Ls.fly;
        if (d >= Ls.owner.length) continue;
        Ls.fly++;
        let tx = F.tx[f], ty = F.ty[f], tz = F.tz[f];
        const m = F.mode[f];
        if (m === 1 && camera) { qv.set(tx, ty, tz).applyQuaternion(camera.quaternion); tx = cpx + qv.x; ty = cpy + qv.y; tz = cpz + qv.z; }
        else if (m === 2) { const lx = tx, lz = tz; tx = cpx + lx * cy - lz * sy; tz = cpz + lx * sy + lz * cy; } // local (right, back) → world
        let x, y, z, sc, yawF, tiltF;
        if (m === 4) { // gust: lift and blow away, tumbling
          x = F.x[f] + tx * u * o.gustDist; z = F.z[f] + tz * u * o.gustDist;
          y = F.y[f] + o.gustRise * (u * (2 - u)) * (0.6 + F.hop[f]);
          sc = F.s[f] * (1 - u * u); yawF = F.yaw[f] + u * 7; tiltF = F.tilt[f] + u * 9;
        } else { // pop up, then accelerate into the collector, shrinking and spinning
          const e = u * u;
          x = F.x[f] + (tx - F.x[f]) * e; z = F.z[f] + (tz - F.z[f]) * e;
          y = F.y[f] + (ty - F.y[f]) * e + F.hop[f] * 4 * u * (1 - u);
          if (F.swirl[f] > 0) { const a = F.ph[f] + u * 12.6, r = F.swirl[f] * (1 - u); x += Math.cos(a) * r; z += Math.sin(a) * r; }
          sc = F.s[f] * (1 - u * u * u); yawF = F.yaw[f] + u * 5; tiltF = F.tilt[f] + u * 2.5;
        }
        writeMat(Ls.mat, d * 16, x, y, z, yawF, tiltF, sc);
        const cq = d * 3; Ls.col[cq] = F.r[f]; Ls.col[cq + 1] = F.g[f]; Ls.col[cq + 2] = F.b[f];
      }
    }
    // dust
    if (dust.n > 0) {
      let w = 0;
      for (let a = 0; a < dust.n; a++) {
        const age = dust.age[a] + dt;
        if (age >= dust.life[a]) continue;
        // compact in place
        dust.x[w] = dust.x[a] + dust.vx[a] * dt; dust.z[w] = dust.z[a] + dust.vz[a] * dt; dust.y[w] = dust.y[a] + 0.45 * dt;
        dust.vx[w] = dust.vx[a] * 0.96; dust.vz[w] = dust.vz[a] * 0.96; dust.age[w] = age; dust.life[w] = dust.life[a]; dust.s0[w] = dust.s0[a];
        const k = age / dust.life[w];
        dPos[w * 3] = dust.x[w]; dPos[w * 3 + 1] = dust.y[w]; dPos[w * 3 + 2] = dust.z[w];
        dSize[w] = dust.s0[w] * (0.6 + 1.4 * Math.sqrt(k));
        dAlpha[w] = o.dustAlpha * (k < 0.15 ? k / 0.15 : (1 - k) / 0.85);
        w++;
      }
      dust.n = w;
      dgeo.setDrawRange(0, w);
      if (w > 0) {
        dPosAttr.updateRange.offset = 0; dPosAttr.updateRange.count = w * 3; dPosAttr.needsUpdate = true;
        dSizeAttr.updateRange.offset = 0; dSizeAttr.updateRange.count = w; dSizeAttr.needsUpdate = true;
        dAlphaAttr.updateRange.offset = 0; dAlphaAttr.updateRange.count = w; dAlphaAttr.needsUpdate = true;
        if (camera && renderer) dustUniforms.uScale.value = camera.projectionMatrix.elements[5] * renderer.domElement.height * 0.5;
      }
    }
    dustPts.visible = dust.n > 0;
  }
  function clearJuice() { F.alive.fill(0); F.n = 0; dust.n = 0; dgeo.setDrawRange(0, 0); dustPts.visible = false; }

  // ---- removal. All return the same reused result object `res`.
  const SAMPLES = 48;
  const res = { units: 0, cells: 0, cleaned: 0, value: 0, byType: new Int32Array(NT), n: 0, sx: new Float32Array(SAMPLES), sy: new Float32Array(SAMPLES), sz: new Float32Array(SAMPLES), st: new Uint8Array(SAMPLES), ss: new Uint8Array(SAMPLES), sc: new Uint32Array(SAMPLES) };
  function clearRes() { res.units = 0; res.cells = 0; res.cleaned = 0; res.value = 0; res.byType.fill(0); res.n = 0; return res; }
  function takeFromCell(i, j, max) {
    const idx = j * N + i, u = grid[idx];
    if (u === 0 || max <= 0) return 0;
    const take = u < max ? u : max, key = keyOf(i, j);
    for (let k = u - 1; k >= u - take; k--) {
      const t = typeOf(i, j, key, k); res.byType[t]++;
      if (res.n < SAMPLES) {
        const x = itemX(i, key, k), z = itemZ(j, key, k), v = variantOf(t, key, k), q = res.n;
        res.sx[q] = x; res.sz[q] = z; res.sy[q] = surfaceAt(x, z); res.st[q] = t; res.ss[q] = typeShapes[t].shp[v];
        itemColor(t, v, key, k, tmpC);
        res.sc[q] = ((Math.min(255, tmpC.r * 255) << 16) | (Math.min(255, tmpC.g * 255) << 8) | Math.min(255, tmpC.b * 255)) >>> 0;
        res.n++;
      }
      if (juice.mode) spawnFly(i, j, key, k, t);
    }
    grid[idx] = u - take; total -= take; blockSum[((j / BS) | 0) * B + ((i / BS) | 0)] -= take;
    if (u - take === 0 && initGrid[idx] > 0) { cleanCells++; res.cleaned++; if (juice.mode) spawnDust(i, j); }
    res.units += take; res.cells++;
    cellChanged(idx, j);
    return take;
  }
  // candidates: whole-grid buffers (no silent truncation), sorted by a packed key (distance or stroke t, then idx)
  const candIdx = new Int32Array(NN), candKey = new Float64Array(NN);
  function sortCand(n) {
    if (n < 2) return;
    if (n <= 96) { // insertion sort, no allocation
      for (let a = 1; a < n; a++) { const ki = candIdx[a], kd = candKey[a]; let b = a - 1; while (b >= 0 && candKey[b] > kd) { candIdx[b + 1] = candIdx[b]; candKey[b + 1] = candKey[b]; b--; } candIdx[b + 1] = ki; candKey[b + 1] = kd; }
      return;
    }
    // large (debug / huge radius): typed sort of the packed keys; idx is recoverable from the key
    const view = candKey.subarray(0, n); view.sort();
    for (let a = 0; a < n; a++) candIdx[a] = candKey[a] % 16384;
  }
  const packKey = (q, idx) => Math.round(q * 1e6) * 16384 + idx; // q ≤ ~6000 → < 2^53
  function removeInCircle(x, z, r, maxUnits) {
    clearRes();
    const i0 = Math.max(0, Math.floor((x - r) / CELL)), i1 = Math.min(N - 1, Math.floor((x + r) / CELL));
    const j0 = Math.max(0, Math.floor((z - r) / CELL)), j1 = Math.min(N - 1, Math.floor((z + r) / CELL));
    let n = 0; const r2 = r * r;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const idx = j * N + i;
      if (grid[idx] === 0) continue;
      const dx = (i + 0.5) * CELL - x, dz = (j + 0.5) * CELL - z, d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      candIdx[n] = idx; candKey[n] = packKey(d2, idx); n++;
    }
    sortCand(n);
    let left = maxUnits;
    for (let c = 0; c < n && left > 0; c++) { const idx = candIdx[c]; left -= takeFromCell(idx % N, (idx / N) | 0, left); }
    return res;
  }
  function removeAlongSegment(x0, z0, x1, z1, hw, maxUnits) {
    clearRes();
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - hw) / CELL)), i1 = Math.min(N - 1, Math.floor((Math.max(x0, x1) + hw) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(z0, z1) - hw) / CELL)), j1 = Math.min(N - 1, Math.floor((Math.max(z0, z1) + hw) / CELL));
    const ex = x1 - x0, ez = z1 - z0, el = ex * ex + ez * ez;
    let n = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const idx = j * N + i;
      if (grid[idx] === 0) continue;
      const px = (i + 0.5) * CELL - x0, pz = (j + 0.5) * CELL - z0;
      let t = el > 0 ? (px * ex + pz * ez) / el : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - ex * t, dz = pz - ez * t;
      if (dx * dx + dz * dz > hw * hw) continue;
      candIdx[n] = idx; candKey[n] = packKey(t, idx); n++;
    }
    sortCand(n);
    let left = maxUnits;
    for (let c = 0; c < n && left > 0; c++) { const idx = candIdx[c]; left -= takeFromCell(idx % N, (idx / N) | 0, left); }
    return res;
  }
  function removeCell(idx, maxUnits) { clearRes(); takeFromCell(idx % N, (idx / N) | 0, maxUnits); return res; }
  const picked = { type: -1, shape: -1, color: 0, x: 0, y: 0, z: 0, yaw: 0, scale: 1 };
  function pick(x, z, r) {
    let best = -1, bd = r * r;
    const i0 = Math.max(0, Math.floor((x - r) / CELL) - 1), i1 = Math.min(N - 1, Math.floor((x + r) / CELL) + 1);
    const j0 = Math.max(0, Math.floor((z - r) / CELL) - 1), j1 = Math.min(N - 1, Math.floor((z + r) / CELL) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const u = grid[j * N + i]; if (!u) continue;
      const key = keyOf(i, j), k = u - 1, ix = itemX(i, key, k), iz = itemZ(j, key, k);
      const d2 = (ix - x) * (ix - x) + (iz - z) * (iz - z);
      if (d2 < bd) { bd = d2; best = j * N + i; }
    }
    clearRes();
    if (best < 0) return null;
    const bi = best % N, bj = (best / N) | 0, key = keyOf(bi, bj), k = grid[best] - 1;
    takeFromCell(bi, bj, 1);
    picked.type = res.st[0]; picked.shape = res.ss[0]; picked.color = res.sc[0];
    picked.x = res.sx[0]; picked.y = res.sy[0]; picked.z = res.sz[0];
    picked.yaw = itemYaw(key, k); picked.scale = itemS(key, k);
    return picked;
  }
  function nearestDirty(x, z, maxR) {
    const ci = x / CELL, cj = z / CELL;
    let best = -1, bd = maxR / CELL; bd *= bd;
    const b0i = Math.max(0, Math.min(B - 1, Math.floor(ci / BS))), b0j = Math.max(0, Math.min(B - 1, Math.floor(cj / BS)));
    for (let ring = 0; ring < 2 * B; ring++) {
      const rmin = Math.max(0, ring - 1) * BS;
      if (rmin * rmin > bd) break;
      for (let bj = b0j - ring; bj <= b0j + ring; bj++) for (let bi = b0i - ring; bi <= b0i + ring; bi++) {
        if (bi < 0 || bj < 0 || bi >= B || bj >= B) continue;
        if (Math.max(Math.abs(bi - b0i), Math.abs(bj - b0j)) !== ring) continue;
        if (!blockSum[bj * B + bi]) continue;
        const nx = Math.max(bi * BS, Math.min(ci, bi * BS + BS)) - ci, nz = Math.max(bj * BS, Math.min(cj, bj * BS + BS)) - cj;
        if (nx * nx + nz * nz >= bd) continue;
        for (let j = bj * BS; j < Math.min(N, bj * BS + BS); j++) for (let i = bi * BS; i < Math.min(N, bi * BS + BS); i++) {
          if (!grid[j * N + i]) continue;
          const dx = i + 0.5 - ci, dz = j + 0.5 - cj, d2 = dx * dx + dz * dz;
          if (d2 < bd) { bd = d2; best = j * N + i; }
        }
      }
    }
    return best;
  }
  function consume(x, z, maxUnits, maxR) {
    clearRes();
    let left = maxUnits, guard = 0;
    while (left > 0 && guard++ < NN + 8) {
      const idx = nearestDirty(x, z, maxR); if (idx < 0) break;
      left -= takeFromCell(idx % N, (idx / N) | 0, left);
    }
    return res;
  }
  function clearAll() {
    clearRes();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (grid[j * N + i]) takeFromCell(i, j, K);
    return res;
  }

  // ---- per-frame update: call ONCE per frame after all removals of that frame
  const stats = { recentered: 0, synced: 0, rowsUploaded: 0, instances: 0, flying: 0, dust: 0, fading: 0, ms: 0, partialUploads: 0, fullUploads: 0 };
  function uploadRows() {
    if (rowMax < rowMin) return 0;
    const rows = rowMax - rowMin + 1;
    const props = renderer && renderer.properties.get(depthTex);
    const full = !props || !props.__webglTexture || props.__version !== depthTex.version;
    if (full) { if (RGBA) mirror(0, N - 1); depthTex.needsUpdate = true; stats.fullUploads++; }
    else {
      const gl = renderer.getContext(), gl2 = renderer.capabilities.isWebGL2;
      renderer.state.bindTexture(gl.TEXTURE_2D, props.__webglTexture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (gl2) gl.pixelStorei(gl.UNPACK_ROW_LENGTH, N);
      const bpp = RGBA ? 4 : 2, buf = RGBA ? vis4 : vis, fmt = RGBA ? gl.RGBA : gl.LUMINANCE_ALPHA;
      // dirty rectangles: runs of dirty rows (gaps of <= 2 clean rows merge), each with its column span
      let j = rowMin;
      while (j <= rowMax) {
        while (j <= rowMax && rowC1[j] < 0) j++;
        if (j > rowMax) break;
        const j0 = j; let c0 = N, c1 = -1, j1 = j, gap = 0;
        for (; j <= rowMax; j++) {
          if (rowC1[j] < 0) { if (++gap > 2) break; continue; }
          gap = 0; j1 = j; if (rowC0[j] < c0) c0 = rowC0[j]; if (rowC1[j] > c1) c1 = rowC1[j];
        }
        if (RGBA) mirror(j0, j1);
        const h = j1 - j0 + 1;
        if (gl2) gl.texSubImage2D(gl.TEXTURE_2D, 0, c0, j0, c1 - c0 + 1, h, fmt, gl.UNSIGNED_BYTE, buf, (j0 * N + c0) * bpp);
        else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, j0, N, h, fmt, gl.UNSIGNED_BYTE, buf.subarray(j0 * N * bpp, (j1 + 1) * N * bpp));
        stats.partialUploads++;
      }
      if (gl2) gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    }
    for (let r = rowMin; r <= rowMax; r++) { rowC0[r] = N; rowC1[r] = -1; }
    rowMin = N; rowMax = -1;
    return rows;
  }
  function update(cx, cz, dt) {
    const t0 = performance.now();
    stamp++;
    camX = cx; camZ = cz;
    stats.recentered = recenter(Math.floor(cx / CELL), Math.floor(cz / CELL));
    let synced = 0;
    if (dirtyOverflow) {
      for (let j = wj0; j < wj0 + W; j++) for (let i = wi0; i < wi0 + W; i++) syncCell(i, j);
      for (let j = wj0; j < wj0 + W; j++) for (let i = wi0; i < wi0 + W; i++) refreshY(i, j);
      dirtyMark.fill(0); dirtyOverflow = false; synced = WW;
    } else {
      for (let c = 0; c < dirtyCount; c++) {
        const idx = dirtyList[c], i = idx % N, j = (idx / N) | 0;
        dirtyMark[idx] = 0;
        if (inWin(i, j)) { syncCell(i, j); synced++; }
      }
      for (let c = 0; c < dirtyCount; c++) {
        const idx = dirtyList[c], i = idx % N, j = (idx / N) | 0;
        if (i < wi0 - 1 || i > wi0 + W || j < wj0 - 1 || j > wj0 + W) continue;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) refreshY(i + di, j + dj);
      }
    }
    dirtyCount = 0;
    stats.synced = synced;
    stepFade(dt); stats.fading = animCount;
    stats.rowsUploaded = uploadRows();
    stepJuice(dt);
    let inst = 0, fl = 0;
    // three uploads one updateRange per attribute at the next render: if update() ran again before a render
    // (tests, catch-up), merge with the range still pending instead of overwriting it
    const rf = renderer ? renderer.info.render.frame : -1, fresh = rf !== lastRenderFrame;
    lastRenderFrame = rf;
    for (let s = 0; s < NS; s++) {
      const Ls = lists[s], cnt = Ls.count + Ls.fly;
      Ls.mesh.count = cnt; Ls.mesh.visible = cnt > 0; inst += Ls.count; fl += Ls.fly;
      if (Ls.fly > 0) { if (Ls.count < Ls.dmin) Ls.dmin = Ls.count; if (cnt - 1 > Ls.dmax) Ls.dmax = cnt - 1; }
      if (fresh) { Ls.pmin = 1e9; Ls.pmax = -1; }
      if (Ls.dmax >= Ls.dmin) {
        if (Ls.dmin < Ls.pmin) Ls.pmin = Ls.dmin; if (Ls.dmax > Ls.pmax) Ls.pmax = Ls.dmax;
        const a = Ls.pmin, b = Math.min(Ls.pmax, cnt - 1);
        if (b >= a) {
          const im = Ls.mesh.instanceMatrix, ic = Ls.mesh.instanceColor;
          im.updateRange.offset = a * 16; im.updateRange.count = (b - a + 1) * 16; im.needsUpdate = true;
          ic.updateRange.offset = a * 3; ic.updateRange.count = (b - a + 1) * 3; ic.needsUpdate = true;
        }
        Ls.dmin = 1e9; Ls.dmax = -1;
      }
    }
    stats.instances = inst; stats.flying = fl; stats.dust = dust.n;
    groundMesh.position.set((Math.floor(cx / CELL) + 0.5) * CELL, 0, (Math.floor(cz / CELL) + 0.5) * CELL);
    fadeU.value.z = cx; fadeU.value.w = cz;
    juice.spawned = 0; juice.dusted = 0;
    stats.ms = performance.now() - t0;
    return stats;
  }
  function warmup() { if (renderer && renderer.initTexture) { renderer.initTexture(depthTex); renderer.initTexture(trashTex); renderer.initTexture(noiseTex); } }

  // ---- save / load: RLE over per-cell codes (255 = unchanged since the initial fill), base64
  function layoutHash() { let hsh = 2166136261; for (let i = 0; i < NN; i++) { hsh ^= initGrid[i] * 31 + zones[i]; hsh = Math.imul(hsh, 16777619); } return (hsh >>> 0).toString(36); }
  function serialize() {
    const out = []; let prev = -1, run = 0;
    for (let i = 0; i < NN; i++) {
      const c = grid[i] === initGrid[i] ? 255 : grid[i];
      if (c === prev && run < 255) run++; else { if (run) out.push(prev, run); prev = c; run = 1; }
    }
    out.push(prev, run);
    let s = ''; const u8 = new Uint8Array(out);
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return 'g1.' + N + '.' + K + '.' + layoutHash() + '.' + btoa(s);
  }
  function recount() {
    total = 0; cleanCells = 0; blockSum.fill(0);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const idx = j * N + i, v = grid[idx];
      total += v; blockSum[((j / BS) | 0) * B + ((i / BS) | 0)] += v; vis[idx * 2] = v * VS; vis[idx * 2 + 1] = cleanTarget(idx);
      if (v === 0 && initGrid[idx] > 0) cleanCells++;
    }
    animCount = 0; animMark.fill(0);
    dirtyCount = 0; dirtyMark.fill(0);
    rowMin = 0; rowMax = N - 1; rowC0.fill(0); rowC1.fill(N - 1); dirtyOverflow = true;
    clearJuice();
  }
  // {ok, exact}; exact=false: layout or K changed since saving (applied best-effort, never adds trash)
  function deserialize(str) {
    try {
      const p = String(str).split('.'); if (p.length !== 5 || p[0] !== 'g1' || +p[1] !== N) return { ok: false, exact: false };
      const exact = p[3] === layoutHash() && +p[2] === K;
      const bin = atob(p[4]);
      if (bin.length % 2) return { ok: false, exact: false };
      const tmp = new Uint8Array(NN); let c = 0;
      for (let q = 0; q < bin.length; q += 2) {
        const code = bin.charCodeAt(q), run = bin.charCodeAt(q + 1);
        for (let r = 0; r < run && c < NN; r++, c++) tmp[c] = zones[c] === 0 ? 0 : code === 255 ? initGrid[c] : Math.min(code, initGrid[c]);
      }
      if (c !== NN) return { ok: false, exact: false }; // truncated: refuse rather than half-apply
      grid.set(tmp);
      recount();
      return { ok: true, exact };
    } catch (e) { return { ok: false, exact: false }; }
  }
  function setCell(i, j, u) {
    const idx = j * N + i, old = grid[idx];
    u = zones[idx] === 0 ? 0 : Math.max(0, Math.min(K, u | 0)); if (u === old) return;
    grid[idx] = u; total += u - old; blockSum[((j / BS) | 0) * B + ((i / BS) | 0)] += u - old;
    if (initGrid[idx] > 0) { if (old > 0 && u === 0) cleanCells++; else if (old === 0 && u > 0) cleanCells--; }
    cellChanged(idx, j);
  }

  return {
    N, K, CELL, SIZE, W, TYPES, group, groundMesh, dustPts, lists, grid, initGrid, zones, uniforms, fade: fadeU, stats, juice,
    geometries: geos, itemMaterial: itemMat, textureBytes, groundTris: (GV - 1) * (GV - 1) * 2,
    unitsAt, surfaceAt, removeInCircle, removeAlongSegment, removeCell, pick, nearestDirty, consume, clearAll, setCell,
    clearRes, res, blockSums: blockSum, blocks: B, blockSize: BS, typeOf, keyOf, depthFormat: RGBA ? 'rgba' : 'la',
    totalUnits: () => total, initialUnits: () => initialTotal, trashCells: () => trashCells0, cleanCells: () => cleanCells,
    cleanFraction: () => (trashCells0 ? cleanCells / trashCells0 : 1),
    unitFraction: () => (initialTotal ? 1 - total / initialTotal : 1),
    update, warmup, serialize, deserialize, setLight, clearJuice,
    reset() { resetGrid(); recount(); },
    dispose() { ggeo.dispose(); groundMat.dispose(); itemMat.dispose(); depthTex.dispose(); trashTex.dispose(); noiseTex.dispose(); if (ownGroundMap) groundMap.dispose(); dgeo.dispose(); dustMat.dispose(); for (const g of Object.values(geos)) g.dispose(); },
  };
}

// ---------------------------------------------------------------- initial district (CONFIG.trashGen)
// depth = clamp(round(zoneBase + noiseAmp·n(x/s, z/s) + pileBonus + shift), min, max); shift solved by
// bisection so the mean over trash cells == targetMeanDepth. Reference: test/spike/spike.js trashGen.
function genValueNoise(seed) {
  const h = (x, z) => { let a = (x * 374761393 + z * 668265263 + seed * 2246822519) | 0; a = Math.imul(a ^ (a >>> 13), 1274126177); return (((a ^ (a >>> 16)) >>> 0) / 4294967296) * 2 - 1; };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = s(x - xi), fz = s(z - zi);
    const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz; };
}
function genDistrict(C, kind, N, cell) {
  const G = C.trashGen || {}, D = C.district || {};
  const seed = G.seed | 0, rnd = mulberry(seed), n = genValueNoise(seed);
  const dMin = G.depthMin == null ? 1 : G.depthMin, dMax = G.depthMax || 4;
  const zb = G.zoneBase || { street: 1.6, plaza: 1.8 }, amp = G.noiseAmp == null ? 0.7 : G.noiseAmp, sc = G.noiseScaleM || 5;
  const zones = new Uint8Array(N * N); // 0 none, 1 street, 2 plaza, 3 pile
  for (let i = 0; i < N * N; i++) zones[i] = kind[i] === 1 ? 1 : kind[i] === 2 ? 2 : 0;
  const corners = [];
  for (const b of (D.blocks || [])) if (b.kind === 'building') { const [x0, z0, x1, z1] = b.rect; corners.push([x0 - 1, z0 - 1], [x1 + 1, z0 - 1], [x0 - 1, z1 + 1], [x1 + 1, z1 + 1]); }
  const P = G.piles || { count: 0 }, piles = [];
  if (corners.length) for (let k = 0; k < (P.count | 0); k++) { const c = corners[(rnd() * corners.length) | 0]; piles.push([c[0] + (rnd() - 0.5) * 3, c[1] + (rnd() - 0.5) * 3, P.radiusM[0] + rnd() * (P.radiusM[1] - P.radiusM[0])]); }
  const raw = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const idx = j * N + i; if (!zones[idx]) continue;
    const x = (i + 0.5) * cell, z = (j + 0.5) * cell;
    let v = (zones[idx] === 2 ? zb.plaza : zb.street) + amp * n(x / sc, z / sc);
    for (const [px, pz, r] of piles) { const d = Math.hypot(x - px, z - pz); if (d < r) { v += P.add * (1 - d / r); zones[idx] = 3; } }
    raw[idx] = v;
  }
  const initial = new Uint8Array(N * N);
  const apply = (shift) => { let s = 0, c = 0; for (let i = 0; i < N * N; i++) { if (!zones[i]) continue; const u = Math.max(dMin, Math.min(dMax, Math.round(raw[i] + shift))); initial[i] = u; s += u; c++; } return { mean: c ? s / c : 0, cells: c, total: s }; };
  let lo = -3, hi = 3, r;
  const target = G.targetMeanDepth || 1.74;
  for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; r = apply(m); if (r.mean > target) hi = m; else lo = m; }
  r = apply((lo + hi) / 2);
  // per-zone type mix; a valuable REPLACES the rolled type with probability valuableChance[zone]
  const mixes = [null, 'street', 'plaza', 'pile'].map((zn) => {
    if (!zn) return null;
    const base = (C.zoneMix && C.zoneMix[zn]) || {}, vc = (C.valuableChance && C.valuableChance[zn]) || 0;
    let s = 0; for (const k in base) s += base[k];
    const m = {}; for (const k in base) m[k] = s > 0 ? (base[k] / s) * (1 - vc) : 0;
    m.valuable = (m.valuable || 0) + vc;
    return m;
  });
  return { zones, initial, mixes, stats: { cells: r.cells, total: r.total, mean: r.mean, piles: piles.length } };
}

// ---------------------------------------------------------------- module
let ctx = null, core = null, CFG = null, genStats = null, infoObj = null, typeValue = null, nTypes = 0;
let msReached = -1, sweepWait = -1, sweepWarned = false, readyForMilestones = false;
const warned = {};
function warnOnce(key, msg) { if (warned[key]) return; warned[key] = true; console.warn('[trash] ' + msg); }
const agg = { units: 0, cells: 0, cleaned: 0, by: { brush: 0, broom: 0, cart: 0, robot: 0, final: 0, debug: 0 } };
const changedPayload = { units: 0, cells: 0, cleaned: 0, by: { brush: 0, broom: 0, cart: 0, robot: 0, final: 0, debug: 0 }, fraction: 0 };
let emptyRes = null;
const tmpV = { x: 0, z: 0 };

const fin = (v) => typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity;
function units(maxUnits) { // undefined/null → unlimited; NaN/≤0 → 0; fractional → floor
  if (maxUnits == null) return 1e9;
  if (typeof maxUnits !== 'number' || maxUnits !== maxUnits) return 0;
  if (maxUnits >= 1e9) return 1e9;
  return maxUnits > 0 ? Math.floor(maxUnits) : 0;
}
function byId(by) {
  if (by === 'hands') return 'brush';   // v1 name
  if (by === 'brush' || by === 'broom' || by === 'cart' || by === 'robot' || by === 'final' || by === 'debug') return by;
  warnOnce('by:' + by, 'unknown remover "' + by + '", counted as "debug"');
  return 'debug';
}
function empty() { return core ? core.clearRes() : emptyRes; }
const MAX_R = 160; // m; covers the whole district (90 m, diagonal 127 m) from anywhere near it
function finish(res, by) {
  let v = 0; for (let t = 0; t < nTypes; t++) v += res.byType[t] * typeValue[t];
  res.value = v;
  if (res.units > 0 || res.cells > 0) { agg.units += res.units; agg.cells += res.cells; agg.cleaned += res.cleaned; agg.by[by] += res.units; }
  return res;
}
// juice target for a removal (see createCore: juice.mode)
function setJuice(by, mode, tx, tz) {
  const J = core.juice, fb = CFG.feedback || {};
  J.dur = fb.pickupArcS || 0.25; J.hop = LOOK.flyHop[by] || 0.2; J.swirl = LOOK.flySwirl[by] || 0;
  if (by === 'final') { J.mode = 4; J.tx = 0.8; J.ty = 0; J.tz = 0.6; J.dur = LOOK.gustDur; J.hop = 0.4; return; }
  if (by === 'debug' || mode === 0) { J.mode = 0; return; }
  const cam = ctx.camera;
  if (by === 'brush') { // the dustpan in the left glove (tools' view model): CONFIG.tools.brushTarget, portrait-adjusted
    const T = CFG.tools || {}, h = T.brushTarget || LOOK.handOffset, por = ctx.view && ctx.view.portrait, off = (por && T.portraitOffset) || null, lat = por ? (T.portraitLateral || 1) : 1;
    const zs = por ? 1 : Math.tan(Math.PI / 6) / Math.tan(ctx.camera.fov * Math.PI / 360); // tools' view-model depth stretch
    J.mode = 1; J.tx = h[0] * lat + (off ? off[0] : 0); J.ty = h[1] + (off ? off[1] : 0); J.tz = h[2] * zs + (off ? off[2] : 0); return;
  }
  if (by === 'robot') { J.mode = 3; J.tx = tx; J.ty = LOOK.collectY; J.tz = tz; J.dur = LOOK.flyDurRobot; return; }
  // broom / cart: the target follows the player rigidly, stored in the camera's yaw frame (x right, z back).
  // Broom: swept items fly up into the bag at the hip (TASARIM §1). Cart: into the intake at the stroke end.
  J.mode = 2;
  if (by === 'broom') { J.tx = LOOK.bagOffset[0]; J.tz = LOOK.bagOffset[2]; J.ty = cam.position.y + LOOK.bagOffset[1]; return; }
  const yaw = -cam.rotation.y, cy = Math.cos(yaw), sy = Math.sin(yaw), dx = tx - cam.position.x, dz = tz - cam.position.z;
  J.tx = dx * cy + dz * sy; J.tz = -dx * sy + dz * cy; J.ty = LOOK.collectY;
}
const juiceOff = () => { core.juice.mode = 0; };

export function init(c) {
  ctx = c; CFG = c.CONFIG;
  const THREE = c.THREE, world = c.mods.world;
  const types = (CFG.trashTypes || []).map((t) => t.id);
  nTypes = types.length; typeValue = new Float64Array(nTypes);
  for (let t = 0; t < nTypes; t++) typeValue[t] = +CFG.trashTypes[t].value || 0;
  emptyRes = { units: 0, cells: 0, cleaned: 0, value: 0, byType: new Int32Array(Math.max(1, nTypes)), n: 0, sx: new Float32Array(48), sy: new Float32Array(48), sz: new Float32Array(48), st: new Uint8Array(48), ss: new Uint8Array(48), sc: new Uint32Array(48) };
  const D = CFG.district || {}, cell = D.cellM || 0.5, N = (D.grid && D.grid[0]) || 108;
  const lay = world.layout && world.layout();
  let kind = lay && lay.kind;
  if (!kind || kind.length !== N * N) { warnOnce('layout', 'world.layout().kind missing or wrong size; every cell treated as street'); kind = new Uint8Array(N * N).fill(1); }
  if (lay && lay.N && lay.N !== N) warnOnce('layoutN', 'world.layout().N (' + lay.N + ') != CONFIG grid (' + N + ')');
  const gen = genDistrict(CFG, kind, N, cell);
  genStats = gen.stats;
  if (D.trashCellsExpected && gen.stats.cells !== D.trashCellsExpected && !world.__stub) warnOnce('cells', 'generator made ' + gen.stats.cells + ' trash cells, CONFIG expects ' + D.trashCellsExpected);
  const G = CFG.trashGen || {}, RD = CFG.render || {};
  const fmtParam = c.params && c.params.get ? c.params.get('depth') : null;
  const depthFormat = fmtParam === 'la' || fmtParam === 'rgba' ? fmtParam : (RD.depthFormat || 'rgba');
  const fade = RD.nearFade || [LOOK.fadeStart, LOOK.fadeEnd];
  if (c.renderer && c.renderer.capabilities && !(c.renderer.capabilities.maxVertexTextures > 0)) warnOnce('vtf', 'no vertex texture units: the trash layer cannot be displaced on this GPU');
  core = createCore({
    depthFormat, fadeStart: fade[0], fadeEnd: fade[1],
    N, cell, K: G.depthMax || 4, types, zones: gen.zones, mixes: gen.mixes, initial: gen.initial,
    outside: world.outsideUnits ? (i, j) => world.outsideUnits(i, j) : null, outsideZone: 1, outUnitsShader: 2,
    groundMap: world.groundTexture ? world.groundTexture() : null, light: world.lighting ? world.lighting() : null,
    renderer: c.renderer, camera: c.camera, fadeS: (CFG.feedback && CFG.feedback.cellCleanFadeS) || 0.2, seed: G.seed | 0,
  });
  c.scene.add(core.group);
  core.warmup();
  // blockSize is in CELLS (12 = 6 m); blockSizeM in metres
  infoObj = { N, cell, K: core.K, size: core.SIZE, types, shapes: SHAPES.slice(), blocks: core.blocks, blockSize: core.blockSize, blockSizeM: core.blockSize * cell, depthFormat: core.depthFormat };
  msReached = -1; sweepWait = -1;
  // first frame: build the near window so the curtain lifts on a filled street
  const p = c.camera.position; core.update(p.x, p.z, 0);
  readyForMilestones = true;
}

export function update(dt) {
  if (!core) return;
  const rdt = ctx.time && ctx.time.dt > 0 ? Math.min(0.05, ctx.time.dt) : 0;
  finalSweepRule(dt);
  const p = ctx.camera.position;
  core.update(p.x, p.z, rdt);
  if (agg.units > 0) {
    const P = changedPayload, A = agg;
    P.units = A.units; P.cells = A.cells; P.cleaned = A.cleaned; P.fraction = core.cleanFraction();
    for (let b = 0; b < BY_IDS.length; b++) { const id = BY_IDS[b]; P.by[id] = A.by[id]; A.by[id] = 0; }
    A.units = 0; A.cells = 0; A.cleaned = 0;
    ctx.bus.emit('trash:changed', P);
    checkMilestones();
  } else if (agg.cells) { agg.cells = 0; agg.cleaned = 0; }
}
function checkMilestones() {
  if (!readyForMilestones) return;
  const ms = CFG.milestones || [], f = core.cleanFraction();
  while (msReached + 1 < ms.length && f >= ms[msReached + 1].at - 1e-9) {
    msReached++;
    const m = ms[msReached];
    ctx.bus.emit('trash:milestone', { index: msReached, at: m.at, fraction: f });
    if (m.at >= 1) {
      const eco = ctx.mods.economy, st = eco && !eco.__stub && eco.stats ? eco.stats() : null;
      ctx.bus.emit('district:cleaned', { playS: st && fin(st.playS) ? st.playS : ctx.time.game });
    }
    ctx.bus.emit('game:saveNow', null);
  }
}
// Design: at CONFIG.completion.finalSweepAt a final sweep clears the stragglers (economy runs it and pays,
// MIMARI §4.6). Safety net owned here: if nobody has cleared the district finalSweepS + 3 s of game time
// after the threshold, trash clears it itself, so the district always reaches 100 %.
function finalSweepRule(dt) {
  const comp = CFG.completion || {};
  if (!(comp.finalSweepAt > 0) || !(dt > 0)) return;
  const f = core.cleanFraction();
  if (f < comp.finalSweepAt || core.totalUnits() === 0) { sweepWait = -1; return; }
  if (sweepWait < 0) sweepWait = 0;
  sweepWait += dt;
  if (sweepWait < (comp.finalSweepS || 4) + 3) return;
  const eco = ctx.mods.economy;
  if (eco && !eco.__stub && !sweepWarned) { sweepWarned = true; console.warn('[trash] economy did not run the final sweep; trash cleared the stragglers (unpaid)'); }
  sweepWait = -1;
  clearAll('final');
}

export function save() {
  if (!core) return null;
  return { g: core.serialize(), ms: msReached };
}
export function load(data) {
  if (!core) return;
  let exact = true, fresh = !data;
  if (data && typeof data.g === 'string') {
    const r = core.deserialize(data.g);
    if (!r.ok) { warnOnce('load', 'saved trash grid unreadable; starting from a fresh district'); core.reset(); exact = false; fresh = true; }
    else if (!r.exact) { exact = false; warnOnce('loadExact', 'saved trash grid was made for another layout; applied best-effort'); }
  } else core.reset();
  // milestones already passed are not celebrated again; a save without ms (older) counts what it shows
  const ms = CFG.milestones || [];
  let reached = -1; const f = core.cleanFraction();
  for (let k = 0; k < ms.length; k++) if (f >= ms[k].at - 1e-9) reached = k;
  msReached = (!fresh && data && Number.isInteger(data.ms)) ? Math.max(-1, Math.min(ms.length - 1, data.ms)) : reached;
  if (fresh) msReached = reached;
  agg.units = 0; agg.cells = 0; agg.cleaned = 0; for (const id of BY_IDS) agg.by[id] = 0;
  sweepWait = -1;
  const p = ctx.camera.position; core.update(p.x, p.z, 0);
  ctx.bus.emit('trash:loaded', { exact });
}

// ---- queries
// quality: 'low' pulls the 3D item band in (CONFIG.render.nearFadeLow), anything else uses render.nearFade
export function setQuality(mode) {
  if (!core) return;
  const RD = CFG.render || {}, f = (mode === 'low' ? RD.nearFadeLow : RD.nearFade) || [LOOK.fadeStart, LOOK.fadeEnd];
  core.fade.value.x = f[0]; core.fade.value.y = f[1];
}
export function info() { return infoObj || { N: 108, cell: 0.5, K: 4, size: 54, types: [], shapes: SHAPES.slice(), blocks: 9, blockSize: 12 }; }
export function amountAt(x, z) {
  if (!core || !fin(x) || !fin(z)) return 0;
  return core.unitsAt(Math.floor(x / core.CELL), Math.floor(z / core.CELL));
}
export function surfaceAt(x, z) { return core && fin(x) && fin(z) ? core.surfaceAt(x, z) : 0; }
export function cellAt(x, z) {
  if (!core || !fin(x) || !fin(z)) return -1;
  const N = core.N, i = Math.floor(x / core.CELL), j = Math.floor(z / core.CELL);
  return (i < 0 || j < 0 || i >= N || j >= N) ? -1 : j * N + i;
}
export function cellCenter(idx, out) {
  const o = out || tmpV;
  if (!core || !Number.isInteger(idx) || idx < 0 || idx >= core.N * core.N) { warnOnce('cellCenter', 'cellCenter: invalid cell index ' + idx); return o; }
  o.x = (idx % core.N + 0.5) * core.CELL; o.z = (((idx / core.N) | 0) + 0.5) * core.CELL;
  return o;
}

// ---- removal
export function removeInCircle(x, z, r, maxUnits, by) {
  if (!core) return emptyRes;
  const b = byId(by == null ? 'debug' : by), m = units(maxUnits);
  if (!fin(x) || !fin(z) || !fin(r) || r < 0 || m <= 0) return empty();
  setJuice(b, 1, x, z);
  const res = core.removeInCircle(x, z, Math.min(r, MAX_R), m);
  juiceOff();
  return finish(res, b);
}
export function removeAlongSegment(x0, z0, x1, z1, halfWidth, maxUnits, by) {
  if (!core) return emptyRes;
  const b = byId(by == null ? 'debug' : by), m = units(maxUnits);
  if (!fin(x0) || !fin(z0) || !fin(x1) || !fin(z1) || !fin(halfWidth) || halfWidth < 0 || m <= 0) return empty();
  // a stroke longer than the district is clamped to it (keeps the bounding box small)
  const L = Math.hypot(x1 - x0, z1 - z0);
  if (L > 2 * MAX_R) { const k = (2 * MAX_R) / L; x1 = x0 + (x1 - x0) * k; z1 = z0 + (z1 - z0) * k; }
  setJuice(b, 1, x1, z1);
  const res = core.removeAlongSegment(x0, z0, x1, z1, Math.min(halfWidth, MAX_R), m);
  juiceOff();
  return finish(res, b);
}
// extra (not yet in MIMARI §4.3, see docs/notlar/trash.md): empty up to maxUnits from one cell (robots per cell)
export function removeCell(idx, maxUnits, by) {
  if (!core) return emptyRes;
  const b = byId(by == null ? 'robot' : by), m = units(maxUnits);
  if (!Number.isInteger(idx) || idx < 0 || idx >= core.N * core.N || m <= 0) return empty();
  const c = cellCenter(idx, tmpV);
  setJuice(b, 1, c.x, c.z);
  const res = core.removeCell(idx, m);
  juiceOff();
  return finish(res, b);
}
export function pick(x, z, r, by) {
  if (!core) return null;
  const b = byId(by == null ? 'brush' : by);
  if (!fin(x) || !fin(z) || !fin(r) || r <= 0) { core.clearRes(); return null; }
  setJuice(b, 1, x, z);
  const p = core.pick(x, z, Math.min(r, MAX_R));
  juiceOff();
  finish(core.res, b);
  return p;
}
export function nearestDirty(x, z, maxR) {
  if (!core || !fin(x) || !fin(z)) return -1;
  const r = maxR == null ? 1e9 : maxR;
  if (typeof r !== 'number' || r !== r || r <= 0) return -1;
  return core.nearestDirty(x, z, r);
}
export function consume(x, z, maxUnits, maxR, by) {
  if (!core) return emptyRes;
  const b = byId(by == null ? 'robot' : by), m = units(maxUnits);
  const r = maxR == null ? 1e9 : maxR;
  if (!fin(x) || !fin(z) || typeof r !== 'number' || r !== r || r <= 0 || m <= 0) return empty();
  return finish(core.consume(x, z, m, r), b); // numeric: no juice (off-screen / offline)
}
export function clearAll(by) {
  if (!core) return emptyRes;
  const b = byId(by == null ? 'final' : by);
  setJuice(b, 1, 0, 0);
  const res = core.clearAll();
  juiceOff();
  sweepWait = -1;
  return finish(res, b);
}

// ---- totals
export function cleanFraction() { return core ? core.cleanFraction() : 0; }
export function unitFraction() { return core ? core.unitFraction() : 0; }
export function totalUnits() { return core ? core.totalUnits() : 0; }
export function initialUnits() { return core ? core.initialUnits() : 0; }
export function trashCells() { return core ? core.trashCells() : 0; }
export function cleanCells() { return core ? core.cleanCells() : 0; }
export function blockSums() { return core ? core.blockSums : new Int32Array(1); }

// ---- for flying copies drawn by other modules
export function itemGeometry(shapeIndex) {
  if (!core) return null;
  const s = SHAPES[shapeIndex | 0];
  if (!s || !Number.isInteger(shapeIndex)) { warnOnce('geo', 'itemGeometry: invalid shape index ' + shapeIndex); return core.geometries.paper; }
  return core.geometries[s];
}
export function itemMaterial() { return core ? core.itemMaterial : null; }

// ---- debug / tests (read-only view; not part of the gameplay contract)
export function debugInfo() {
  if (!core) return null;
  return { gen: genStats, stats: core.stats, msReached, groundTris: core.groundTris, textureBytes: core.textureBytes, window: core.W, core };
}
