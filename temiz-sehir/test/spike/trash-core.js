// trash-core.js — reference implementation of the Temiz Şehir trash system.
//
// Status: proven in the spike (test/spike/), measured; described in docs/MIMARI.md §5.
// The owner of www/js/trash.js copies this file's body into trash.js (minus `export` on the
// helpers it does not need to expose) and wraps it with the module contract: init/update/save/load,
// CONFIG → options, bus events. Do not import it from www/: the single-file build forbids
// imports between modules (MIMARI.md §9).
//
// Depends only on the global THREE (r128). Hot paths (remove*, pick, consume, update) do not
// allocate; their result objects are REUSED between calls: read or copy what you need at once.
//
// Model
//   The district is an N×N grid of cells of `cell` metres (config: 108×108 × 0.5 m = 54 m).
//   grid[j*N+i] = trash UNITS left in cell (i,j), 0..K (K = trashGen.depthMax = 4). 1 unit = 1 item.
//   Cell (i,j) covers x∈[i*cell,(i+1)*cell), z∈[j*cell,(j+1)*cell); y up; origin = district NW corner.
//   The grid is the single source of truth. Everything visible is derived from it:
//     far layer : ONE ground mesh (camera-centred, 1 draw call) displaced and shaded by a
//                 Luminance DataTexture `vis` (= units × VS, faded over `fadeS` when a cell
//                 changes). Changed rows are uploaded with texSubImage2D (no full re-upload).
//     near items: one InstancedMesh per SHAPE. Item k of cell c exists iff k < grid[c]. Its type
//                 (zone mix), shape, pose and colour come from hash(cell, k), so they are
//                 deterministic and agree with removal results: removing a unit removes the top
//                 item k = units-1, and byType reports exactly the type that item showed.
//   Outside the grid (neighbour districts, visual only) cells hold `outside(i,j)` units and are
//   never cleaned.

// ---------------------------------------------------------------- shapes and looks
export const SHAPES = ['bag', 'bottle', 'can', 'box', 'paper', 'sheet', 'gem'];
const SHAPE_DEF = { // sink: metres below the trash surface (× scale); tilt: max random tilt (rad)
  bag: { sink: 0.07, tilt: 0.35 }, bottle: { sink: 0.015, tilt: 0.35 }, can: { sink: 0.012, tilt: 0.3 },
  box: { sink: 0.06, tilt: 0.45 }, paper: { sink: 0.015, tilt: 0.3 }, sheet: { sink: -0.004, tilt: 0.25 },
  gem: { sink: -0.01, tilt: 0.6 },
};
export const PALETTES = { // sRGB
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
export const DEFAULT_VISUALS = {
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
varying vec3 vW;
#include <fog_pars_fragment>
// trash units at uv (bilinear between cell centres; outskirts = constant)
float dAt(vec2 uv){
  float d = texture2D(uDepth, uv).r * uUnit;
  vec2 ins = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return mix(uOutUnits, d, ins.x * ins.y);
}
void main(){
  vec2 uv = vW.xz / uSize;
  float d = dAt(uv);
  float o = uTexel * 1.5;
  float dl = dAt(uv - vec2(o, 0.0)), dr = dAt(uv + vec2(o, 0.0));
  float du = dAt(uv - vec2(0.0, o)), dd = dAt(uv + vec2(0.0, o));
  float blur = (dl + dr + du + dd) * 0.25;
  vec4 nM = texture2D(uNoise, vW.xz * (1.0 / 61.0));
  vec4 nF = texture2D(uNoise, vW.xz * (1.0 / 5.3));
  // two decorrelated samples of the trash tile, picked per pixel by height (reads as overlap)
  vec4 t1 = texture2D(uTrash, vW.xz * uTile);
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * vW.xz * (uTile * 0.71) + vec2(0.37, 0.61);
  vec4 t2 = texture2D(uTrash, q);
  float bias = (nM.r - 0.5) * 1.6;
  float pick2 = step(t1.a - bias, t2.a + bias);
  vec4 t = mix(t1, t2, pick2);
  // coverage: >= 1 unit covers the ground completely; between 0 and 1 (edges, fading cells)
  // only the tallest items of the tile survive, so a cleaned edge breaks up into single items
  float hh = t.a * 0.85 + 0.1 + (nF.g - 0.5) * 0.14;
  float thr = 1.15 - d * 1.15;
  float cover = smoothstep(thr - 0.05, thr + 0.05, hh);
  // ground with a soft grimy rim next to trash
  vec3 base = texture2D(uGround, uv).rgb;
  vec2 ins = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  base = mix(uOutGround, base, ins.x * ins.y);
  base *= 0.9 + 0.2 * nF.b;
  float g = smoothstep(0.0, 1.0, blur) * (0.55 + 0.45 * nM.g);
  base = mix(base, base * vec3(0.5, 0.46, 0.4), g);
  // trash colour: macro tint so tiling does not read
  vec4 nL = texture2D(uNoise, vW.xz * (1.0 / 173.0));
  vec3 tc = t.rgb * mix(vec3(0.8, 0.85, 0.95), vec3(1.12, 1.04, 0.86), smoothstep(0.2, 0.8, nL.b * 0.6 + nM.b * 0.4));
  tc *= 0.82 + 0.3 * nL.a;
  tc *= mix(1.06, 0.9, clamp((d - 1.0) / 3.0, 0.0, 1.0)); // deep piles read slightly darker
  tc *= 0.72 + 0.28 * smoothstep(0.0, 0.6, t.a);
  // normal: tile bump (derivative based) + slope of the trash layer
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
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

// ---------------------------------------------------------------- the core
// createTrashCore(options) → core. Options (all optional except renderer for partial uploads):
//   N=108, cell=0.5, K=4               grid size, cell size (m), max units per cell
//   layerHeight=0.30                   visual height of the layer at K units (m)
//   types=['paper','plastic','can','glass','bag','valuable']   byType index order (= CONFIG.trashTypes order)
//   visuals=DEFAULT_VISUALS            type id → [[shape, weight, paletteName], ...]
//   zones: Uint8Array(N*N)             0 = never trash (building, kiosk), z>0 = zone index into `mixes`
//   mixes: [null, {typeId: p, ...}, ...]  per-zone type probabilities (normalised here)
//   initial: Uint8Array(N*N)           initial units per cell (trash.js builds it from CONFIG.trashGen)
//   outside: (i,j) => units            units of a cell outside the grid (visual only); default 2
//   outsideZone=1, outUnitsShader=2    zone used for outside items; constant depth the shader draws outside
//   groundMap: THREE.Texture           district ground (asphalt/pavement), u = x/size, v = z/size, flipY=false
//   outGround='#3d3e40'                ground colour drawn outside the district (under the trash)
//   light: {sunDir, sunColor, skyColor, groundColor}  (colours already × intensity) — copy of world lighting
//   nearHalf=18                        near window = (2·nearHalf)² cells around the camera
//   fadeStart=6.2, fadeEnd=8.5         near items shrink into the layer between these distances (m)
//   fadeS=0.2                          seconds for a changed cell to fade in the far layer (0 = instant)
//   seed=1, renderer, anisotropy=4, tileMeters=2, tileSize=512, bump=0.06
//   meshInner=32, meshOuter=16, meshExtent=300   ground mesh rings (uniform 1-cell rings, then growing)
export function createTrashCore(opts) {
  const THREE = window.THREE;
  const o = Object.assign({
    N: 108, cell: 0.5, K: 4, layerHeight: 0.30,
    types: ['paper', 'plastic', 'can', 'glass', 'bag', 'valuable'], visuals: DEFAULT_VISUALS,
    zones: null, mixes: null, initial: null,
    outside: null, outsideZone: 1, outUnitsShader: 2,
    groundMap: null, outGround: '#3d3e40', light: null,
    nearHalf: 18, fadeStart: 6.2, fadeEnd: 8.5, fadeS: 0.2,
    seed: 1, renderer: null, anisotropy: 4, tileMeters: 2.0, tileSize: 512, bump: 0.06,
    meshInner: 32, meshOuter: 16, meshExtent: 300,
  }, opts || {});
  const N = o.N, K = o.K, CELL = o.cell, SIZE = N * CELL;
  if (K < 1 || K > 8) throw new Error('trash-core: K must be 1..8');
  const VS = Math.floor(255 / K); // visual texture value per unit
  const renderer = o.renderer;
  const TYPES = o.types, NT = TYPES.length, NS = SHAPES.length;
  const outsideFn = typeof o.outside === 'function' ? o.outside : () => (o.outside == null ? 2 : o.outside | 0);

  // ---- grid state
  const grid = new Uint8Array(N * N), initGrid = new Uint8Array(N * N), vis = new Uint8Array(N * N);
  const zones = o.zones || new Uint8Array(N * N).fill(1);
  const BS = 12, B = Math.ceil(N / BS);          // coarse blocks for robots / minimap
  const blockSum = new Int32Array(B * B);
  let total = 0, initialTotal = 0, trashCells0 = 0, cleanCells = 0;

  // ---- deterministic randomness per (cell, k)
  const SEED = h32(o.seed * 2654435761);
  const keyOf = (i, j) => ((j + 2048) << 12) | (i + 2048);
  const rnd = (key, k, n) => h32((key * 0x9E3779B1) ^ (k * 0x85EBCA77 + n * 0xC2B2AE3D) ^ SEED) / 4294967296;

  // per-zone cumulative type distribution
  const nZones = Math.max(2, (o.mixes ? o.mixes.length : 2));
  const zoneCum = [];
  for (let z = 0; z < nZones; z++) {
    const m = (o.mixes && o.mixes[z]) || null, c = new Float32Array(NT);
    let s = 0;
    for (let t = 0; t < NT; t++) { s += m ? (m[TYPES[t]] || 0) : 1; c[t] = s; }
    for (let t = 0; t < NT; t++) c[t] = s > 0 ? c[t] / s : (t + 1) / NT;
    zoneCum.push(c);
  }
  // per-type shape choice
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

  function resetGrid() {
    total = 0; trashCells0 = 0; cleanCells = 0; blockSum.fill(0);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const idx = j * N + i;
      let u = zones[idx] === 0 ? 0 : (o.initial ? o.initial[idx] : 1 + ((rnd(keyOf(i, j), 9, 9) * K) | 0));
      u = Math.max(0, Math.min(K, u | 0));
      grid[idx] = initGrid[idx] = u; vis[idx] = u * VS;
      if (u > 0) trashCells0++;
      total += u; blockSum[((j / BS) | 0) * B + ((i / BS) | 0)] += u;
    }
    initialTotal = total;
  }
  resetGrid();

  // ---- textures
  const depthTex = new THREE.DataTexture(vis, N, N, THREE.LuminanceFormat, THREE.UnsignedByteType);
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
  let groundMap = o.groundMap;
  if (!groundMap) {
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const x = c.getContext('2d'); x.fillStyle = '#3d3e40'; x.fillRect(0, 0, 4, 4);
    groundMap = new THREE.CanvasTexture(c);
  }
  const textureBytes = N * N + TS * TS * 4 * 4 / 3 + 128 * 128 * 4 * 4 / 3;

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
  }]);
  uniforms.uDepth.value = depthTex; uniforms.uTrash.value = trashTex; uniforms.uNoise.value = noiseTex; uniforms.uGround.value = groundMap;
  const groundMat = new THREE.ShaderMaterial({ uniforms, vertexShader: GROUND_VS, fragmentShader: GROUND_FS, fog: true });
  groundMat.extensions.derivatives = true;
  const groundMesh = new THREE.Mesh(ggeo, groundMat);
  groundMesh.frustumCulled = false; groundMesh.name = 'trashGround';
  function setLight(l) {
    if (!l) return;
    if (l.sunDir) uniforms.uSunDir.value.copy(l.sunDir).normalize();
    if (l.sunColor) uniforms.uSunCol.value.copy(l.sunColor);
    if (l.skyColor) uniforms.uSkyCol.value.copy(l.skyColor);
    if (l.groundColor) uniforms.uGndCol.value.copy(l.groundColor);
  }
  setLight(o.light);

  // ---- near items: one InstancedMesh per shape, dense lists with swap-remove
  const W = o.nearHalf * 2, WW = W * W;
  const geos = makeItemGeometries(THREE);
  // x,y = fade start/end (m), z,w = camera x,z (Lambert does not receive three's cameraPosition)
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
  // capacity per shape: worst case every slot of the window shows this shape
  for (let s = 0; s < NS; s++) {
    const name = SHAPES[s], cap = WW * K;
    const mesh = new THREE.InstancedMesh(geos[name], itemMat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.frustumCulled = false; mesh.name = 'trash_' + name;
    group.add(mesh);
    lists.push({ mesh, mat: mesh.instanceMatrix.array, col: mesh.instanceColor.array, owner: new Int32Array(cap), count: 0, dmin: 1e9, dmax: -1 });
    sinkS[s] = SHAPE_DEF[name].sink; tiltS[s] = SHAPE_DEF[name].tilt;
  }
  const slotOwner = new Int32Array(WW).fill(-1);
  const slotShown = new Uint8Array(WW);
  const itemDense = new Int32Array(WW * K).fill(-1);
  const itemShape = new Uint8Array(WW * K);
  const yStamp = new Uint32Array(WW);
  let stamp = 1, wi0 = -1e6, wj0 = -1e6; // window = [wi0, wi0+W) × [wj0, wj0+W) in cell coords

  // ---- dirty tracking: cells (items) and rows (texture), plus the visual fade list
  const dirtyMark = new Uint8Array(N * N);
  const DIRTY_CAP = 16384, dirtyList = new Int32Array(DIRTY_CAP);
  let dirtyCount = 0, dirtyOverflow = false, rowMin = N, rowMax = -1;
  const animMark = new Uint8Array(N * N), animList = new Int32Array(N * N);
  let animCount = 0;
  function cellChanged(idx, j) {
    if (o.fadeS > 0) { if (!animMark[idx]) { animMark[idx] = 1; animList[animCount++] = idx; } }
    else { vis[idx] = grid[idx] * VS; if (j < rowMin) rowMin = j; if (j > rowMax) rowMax = j; }
    if (dirtyMark[idx]) return;
    dirtyMark[idx] = 1;
    if (dirtyCount < DIRTY_CAP) dirtyList[dirtyCount++] = idx; else dirtyOverflow = true;
  }
  function stepFade(dt) {
    if (!animCount) return;
    const step = Math.max(1, Math.ceil((VS * dt) / o.fadeS));
    for (let a = animCount - 1; a >= 0; a--) {
      const idx = animList[a], target = grid[idx] * VS, v = vis[idx];
      const nv = v > target ? Math.max(target, v - step) : Math.min(target, v + step);
      vis[idx] = nv;
      const j = (idx / N) | 0; if (j < rowMin) rowMin = j; if (j > rowMax) rowMax = j;
      if (nv === target) { animMark[idx] = 0; animList[a] = animList[--animCount]; }
    }
  }

  // ---- helpers
  const unitsAt = (i, j) => (i >= 0 && j >= 0 && i < N && j < N) ? grid[j * N + i] : outsideFn(i, j);
  const HPU = o.layerHeight / K;
  // height of the (logical, un-faded) trash surface at x,z — bilinear between cell centres like the GPU
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
  function writeItem(sh, d, t, v, key, k, i, j) {
    const Ls = lists[sh], m = Ls.mat, q = d * 16;
    const x = itemX(i, key, k), z = itemZ(j, key, k);
    const yaw = rnd(key, k, 3) * 6.2832, tilt = (rnd(key, k, 4) - 0.5) * 2 * tiltS[sh], s = itemS(key, k);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt);
    // column-major T·Ry·Rx·S
    m[q] = cy * s; m[q + 1] = 0; m[q + 2] = -sy * s; m[q + 3] = 0;
    m[q + 4] = sy * sx * s; m[q + 5] = cx * s; m[q + 6] = cy * sx * s; m[q + 7] = 0;
    m[q + 8] = sy * cx * s; m[q + 9] = -sx * s; m[q + 10] = cy * cx * s; m[q + 11] = 0;
    m[q + 12] = x; m[q + 13] = surfaceAt(x, z) - sinkS[sh] * s; m[q + 14] = z; m[q + 15] = 1;
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
    if (di !== 0) { // entering columns
      const a = di > 0 ? ni + W - di : ni, b = di > 0 ? ni + W : ni - di;
      for (let i = a; i < b; i++) for (let j = nj; j < nj + W; j++) { const s = wslot(i, j); if (slotOwner[s] !== keyOf(i, j)) { ownSlot(s, i, j); n++; } }
    }
    if (dj !== 0) { // entering rows
      const a = dj > 0 ? nj + W - dj : nj, b = dj > 0 ? nj + W : nj - dj;
      for (let j = a; j < b; j++) for (let i = ni; i < ni + W; i++) { const s = wslot(i, j); if (slotOwner[s] !== keyOf(i, j)) { ownSlot(s, i, j); n++; } }
    }
    return n;
  }

  // ---- removal API. All return the same reused result object `res`:
  //   { units, cells (cells touched), cleaned (cells that reached 0), byType: Int32Array(NT),
  //     n, sx, sy, sz (Float32Array(48)), st (type), ss (shape), sc (0xRRGGBB) }  ← up to 48 removed-item samples
  const SAMPLES = 48;
  const res = { units: 0, cells: 0, cleaned: 0, byType: new Int32Array(NT), n: 0, sx: new Float32Array(SAMPLES), sy: new Float32Array(SAMPLES), sz: new Float32Array(SAMPLES), st: new Uint8Array(SAMPLES), ss: new Uint8Array(SAMPLES), sc: new Uint32Array(SAMPLES) };
  function clearRes() { res.units = 0; res.cells = 0; res.cleaned = 0; res.byType.fill(0); res.n = 0; return res; }
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
    }
    grid[idx] = u - take; total -= take; blockSum[((j / BS) | 0) * B + ((i / BS) | 0)] -= take;
    if (u - take === 0 && initGrid[idx] > 0) { cleanCells++; res.cleaned++; }
    res.units += take; res.cells++;
    cellChanged(idx, j);
    return take;
  }
  const candIdx = new Int32Array(4096), candD = new Float32Array(4096);
  function sortCand(n) { // insertion sort by key (n is small: a few hundred at most)
    for (let a = 1; a < n; a++) { const ki = candIdx[a], kd = candD[a]; let b = a - 1; while (b >= 0 && candD[b] > kd) { candIdx[b + 1] = candIdx[b]; candD[b + 1] = candD[b]; b--; } candIdx[b + 1] = ki; candD[b + 1] = kd; }
  }
  // all cells whose centre is within r of (x,z), nearest first, until maxUnits are taken
  function removeInCircle(x, z, r, maxUnits = 1e9) {
    clearRes();
    const i0 = Math.max(0, Math.floor((x - r) / CELL)), i1 = Math.min(N - 1, Math.floor((x + r) / CELL));
    const j0 = Math.max(0, Math.floor((z - r) / CELL)), j1 = Math.min(N - 1, Math.floor((z + r) / CELL));
    let n = 0; const r2 = r * r;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (grid[j * N + i] === 0) continue;
      const dx = (i + 0.5) * CELL - x, dz = (j + 0.5) * CELL - z, d2 = dx * dx + dz * dz;
      if (d2 > r2 || n >= 4096) continue;
      candIdx[n] = j * N + i; candD[n] = d2; n++;
    }
    if (maxUnits < 1e8) sortCand(n);
    let left = maxUnits;
    for (let c = 0; c < n && left > 0; c++) { const idx = candIdx[c]; left -= takeFromCell(idx % N, (idx / N) | 0, left); }
    return res;
  }
  // all cells whose centre is within halfWidth of the segment, in stroke order, until maxUnits are taken
  function removeAlongSegment(x0, z0, x1, z1, halfWidth, maxUnits = 1e9) {
    clearRes();
    const hw = halfWidth;
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - hw) / CELL)), i1 = Math.min(N - 1, Math.floor((Math.max(x0, x1) + hw) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(z0, z1) - hw) / CELL)), j1 = Math.min(N - 1, Math.floor((Math.max(z0, z1) + hw) / CELL));
    const ex = x1 - x0, ez = z1 - z0, el = ex * ex + ez * ez;
    let n = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (grid[j * N + i] === 0) continue;
      const px = (i + 0.5) * CELL - x0, pz = (j + 0.5) * CELL - z0;
      let t = el > 0 ? (px * ex + pz * ez) / el : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - ex * t, dz = pz - ez * t;
      if (dx * dx + dz * dz > hw * hw || n >= 4096) continue;
      candIdx[n] = j * N + i; candD[n] = t; n++;
    }
    if (maxUnits < 1e8) sortCand(n);
    let left = maxUnits;
    for (let c = 0; c < n && left > 0; c++) { const idx = candIdx[c]; left -= takeFromCell(idx % N, (idx / N) | 0, left); }
    return res;
  }
  // hand pick: removes the one TOP item whose position is nearest (x,z) within r.
  // Returns the reused `picked` object (type, shape, color, x,y,z, yaw, scale) or null.
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
    if (best < 0) return null;
    const bi = best % N, bj = (best / N) | 0, key = keyOf(bi, bj), k = grid[best] - 1;
    clearRes(); takeFromCell(bi, bj, 1);
    picked.type = res.st[0]; picked.shape = res.ss[0]; picked.color = res.sc[0];
    picked.x = res.sx[0]; picked.y = res.sy[0]; picked.z = res.sz[0];
    picked.yaw = rnd(key, k, 3) * 6.2832; picked.scale = itemS(key, k);
    return picked;
  }
  // nearest cell index with trash within maxR of (x,z), or -1. Skips clean blocks via blockSum.
  function nearestDirty(x, z, maxR = 1e9) {
    const ci = x / CELL, cj = z / CELL;
    let best = -1, bd = maxR / CELL; bd *= bd;
    const b0i = Math.max(0, Math.min(B - 1, (ci / BS) | 0)), b0j = Math.max(0, Math.min(B - 1, (cj / BS) | 0));
    for (let ring = 0; ring < B; ring++) {
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
  // numeric cleaning (robots away from the camera, offline catch-up, final sweep):
  // removes up to maxUnits from the dirty cells nearest (x,z) within maxR. ~0.01-0.05 ms per emptied cell.
  function consume(x, z, maxUnits, maxR = 1e9) {
    clearRes();
    let left = maxUnits, guard = 0;
    while (left > 0 && guard++ < 65536) {
      const idx = nearestDirty(x, z, maxR); if (idx < 0) break;
      left -= takeFromCell(idx % N, (idx / N) | 0, left);
    }
    return res;
  }

  // ---- per-frame update: call ONCE per frame after all removals of that frame
  const stats = { recentered: 0, synced: 0, rowsUploaded: 0, instances: 0, fading: 0, ms: 0, partialUploads: 0, fullUploads: 0 };
  function uploadRows() {
    if (rowMax < rowMin) return 0;
    const rows = rowMax - rowMin + 1;
    const props = renderer && renderer.properties.get(depthTex);
    // before three has uploaded the texture (or after a context loss) fall back to a full upload
    if (!props || !props.__webglTexture || props.__version !== depthTex.version) { depthTex.needsUpdate = true; stats.fullUploads++; }
    else {
      const gl = renderer.getContext();
      renderer.state.bindTexture(gl.TEXTURE_2D, props.__webglTexture); // keeps three's binding cache honest
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (renderer.capabilities.isWebGL2) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, rowMin, N, rows, gl.LUMINANCE, gl.UNSIGNED_BYTE, vis, rowMin * N);
      else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, rowMin, N, rows, gl.LUMINANCE, gl.UNSIGNED_BYTE, vis.subarray(rowMin * N, (rowMax + 1) * N));
      stats.partialUploads++;
    }
    rowMin = N; rowMax = -1;
    return rows;
  }
  function update(camX, camZ, dt = 1 / 60) {
    const t0 = performance.now();
    stamp++;
    stats.recentered = recenter(Math.floor(camX / CELL), Math.floor(camZ / CELL));
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
      for (let c = 0; c < dirtyCount; c++) { // neighbours' items rest on the changed surface
        const idx = dirtyList[c], i = idx % N, j = (idx / N) | 0;
        if (i < wi0 - 1 || i > wi0 + W || j < wj0 - 1 || j > wj0 + W) continue;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) refreshY(i + di, j + dj);
      }
    }
    dirtyCount = 0;
    stats.synced = synced;
    stepFade(dt); stats.fading = animCount;
    stats.rowsUploaded = uploadRows();
    let inst = 0;
    for (let s = 0; s < NS; s++) {
      const Ls = lists[s];
      Ls.mesh.count = Ls.count; inst += Ls.count;
      if (Ls.dmax >= Ls.dmin) {
        const a = Ls.dmin, b = Math.min(Ls.dmax, Ls.count - 1);
        if (b >= a) {
          const im = Ls.mesh.instanceMatrix, ic = Ls.mesh.instanceColor;
          im.updateRange.offset = a * 16; im.updateRange.count = (b - a + 1) * 16; im.needsUpdate = true;
          ic.updateRange.offset = a * 3; ic.updateRange.count = (b - a + 1) * 3; ic.needsUpdate = true;
        }
        Ls.dmin = 1e9; Ls.dmax = -1;
      }
    }
    stats.instances = inst;
    groundMesh.position.set((Math.floor(camX / CELL) + 0.5) * CELL, 0, (Math.floor(camZ / CELL) + 0.5) * CELL);
    fadeU.value.z = camX; fadeU.value.w = camZ;
    stats.ms = performance.now() - t0;
    return stats;
  }
  // optional: upload textures now so the first frame does not hitch
  function warmup() { if (renderer && renderer.initTexture) { renderer.initTexture(depthTex); renderer.initTexture(trashTex); renderer.initTexture(noiseTex); } }

  // ---- save / load: RLE over per-cell codes (255 = unchanged since the initial fill), base64.
  // A fresh district serialises to a few bytes; a typical half-cleaned one to a few KB.
  function layoutHash() { let hsh = 2166136261; for (let i = 0; i < N * N; i++) { hsh ^= initGrid[i] * 31 + zones[i]; hsh = Math.imul(hsh, 16777619); } return (hsh >>> 0).toString(36); }
  function serialize() {
    const out = []; let prev = -1, run = 0;
    for (let i = 0; i < N * N; i++) {
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
      total += v; blockSum[((j / BS) | 0) * B + ((i / BS) | 0)] += v; vis[idx] = v * VS;
      if (v === 0 && initGrid[idx] > 0) cleanCells++;
    }
    animCount = 0; animMark.fill(0);
    rowMin = 0; rowMax = N - 1; dirtyOverflow = true;
  }
  // returns {ok, exact}; exact=false means the layout changed since saving (applied best-effort)
  function deserialize(str) {
    try {
      const p = String(str).split('.'); if (p[0] !== 'g1' || +p[1] !== N) return { ok: false, exact: false };
      const exact = p[3] === layoutHash() && +p[2] === K;
      const bin = atob(p[4]); let c = 0;
      for (let q = 0; q < bin.length; q += 2) {
        const code = bin.charCodeAt(q), run = bin.charCodeAt(q + 1);
        for (let r = 0; r < run && c < N * N; r++, c++) grid[c] = zones[c] === 0 ? 0 : code === 255 ? initGrid[c] : Math.min(code, initGrid[c] || K);
      }
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
    N, K, CELL, SIZE, W, TYPES, SHAPES, group, groundMesh, lists, grid, zones, uniforms, fade: fadeU, stats,
    geometries: geos, itemMaterial: itemMat, textureBytes, groundTris: (GV - 1) * (GV - 1) * 2,
    amountAt(x, z) { return unitsAt(Math.floor(x / CELL), Math.floor(z / CELL)); },
    cellAt(x, z) { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); return (i < 0 || j < 0 || i >= N || j >= N) ? -1 : j * N + i; },
    cellCenter(idx, out) { out.x = (idx % N + 0.5) * CELL; out.z = (((idx / N) | 0) + 0.5) * CELL; return out; },
    surfaceAt, removeInCircle, removeAlongSegment, pick, nearestDirty, consume, setCell,
    blockSums: blockSum, blocks: B, blockSize: BS,
    totalUnits: () => total, initialUnits: () => initialTotal, trashCells: () => trashCells0, cleanCells: () => cleanCells,
    cleanFraction: () => (trashCells0 ? cleanCells / trashCells0 : 1),       // CONFIG: clean cells / initial trash cells
    unitFraction: () => (initialTotal ? 1 - total / initialTotal : 1),
    update, warmup, serialize, deserialize, setLight,
    reset() { resetGrid(); recount(); },
    dispose() { ggeo.dispose(); groundMat.dispose(); itemMat.dispose(); depthTex.dispose(); trashTex.dispose(); noiseTex.dispose(); for (const g of Object.values(geos)) g.dispose(); for (const l of lists) if (l.mesh.dispose) l.mesh.dispose(); },
  };
}
