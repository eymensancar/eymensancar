// Bina işçisi: şehir paketlerini (bina_*.png içindeki ikili veri) çözer; istenen ayrıntı düzeyinde birleşik geometri,
// 12.5 m'lik çarpışma ızgarası ve ağaç yerleri üretir. Ana iş parçacığı takılmasın diye ayrı çalışır.
// Ayrıntı düzeyleri: 0 = 1 km düğüm, tam taban + kırma çatı; 1 = 2 km, sadeleşmiş taban, küçükler yok; 2 = 4 km, yalnız büyük/yüksek binalar kutu olarak.
import { ShapeUtils, Vector2 } from '../vendor/three.module.min.js';

const packs = new Map();
const CS = 12.5, CN = 80; // çarpışma hücresi ve 1 km'deki hücre sayısı

class Grid {
  constructor(g) { Object.assign(this, g); }
  h(x, y) {
    const nx = this.nx;
    let fi = (x - this.x0) / this.s, fj = (y - this.y0) / this.s;
    fi = fi < 0 ? 0 : fi > nx - 1.0001 ? nx - 1.0001 : fi; fj = fj < 0 ? 0 : fj > this.ny - 1.0001 ? this.ny - 1.0001 : fj;
    const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, H = this.H, k = j * nx + i;
    const a = H[k], b = H[k + 1], c = H[k + nx], d = H[k + nx + 1];
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
}

function openPack(m) {
  const dv = new DataView(m.buf);
  const n = dv.getUint32(4, true), x0 = dv.getFloat64(8, true), y0 = dv.getFloat64(16, true);
  const ncx = dv.getUint16(24, true), ncy = dv.getUint16(26, true), CH = dv.getFloat32(28, true);
  const tbl = 32, body = tbl + ncx * ncy * 6;
  const P = { id: m.id, dv, n, x0, y0, ncx, ncy, CH, tbl, body, grid: new Grid(m.grid), cache: new Map(), col: new Map(), style: m.style || 0 };
  if (m.trees) { const tv = new DataView(m.trees); P.tw = tv.getInt32(4, true); P.th = tv.getInt32(8, true); P.tb = new Uint8Array(m.trees, 12); }
  packs.set(m.id, P);
  return P;
}

function chunk(P, ci, cj) {
  if (ci < 0 || cj < 0 || ci >= P.ncx || cj >= P.ncy) return [];
  const k = cj * P.ncx + ci;
  let c = P.cache.get(k);
  if (c) return c;
  const dv = P.dv;
  let p = P.body + dv.getUint32(P.tbl + k * 6, true);
  const cnt = dv.getUint16(P.tbl + k * 6 + 4, true);
  const ox = P.x0 + ci * P.CH, oy = P.y0 + cj * P.CH;
  c = [];
  for (let b = 0; b < cnt; b++) {
    const n = dv.getUint8(p), typ = dv.getUint8(p + 1); p += 2;
    let h = dv.getUint8(p); p += 1;
    if (h === 255) { h = dv.getUint16(p, true) / 10; p += 2; } else h = h / 2;
    let x = dv.getInt16(p, true), y = dv.getInt16(p + 2, true); p += 4;
    const pts = new Float64Array(n * 2); pts[0] = ox + x / 2; pts[1] = oy + y / 2;
    for (let i = 1; i < n; i++) {
      let dx = dv.getInt8(p), dy;
      if (dx === -128) { dx = dv.getInt16(p + 1, true); dy = dv.getInt16(p + 3, true); p += 5; } else { dy = dv.getInt8(p + 1); p += 2; }
      x += dx; y += dy; pts[i * 2] = ox + x / 2; pts[i * 2 + 1] = oy + y / 2;
    }
    let cx = 0, cy = 0, ar = 0, x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18;
    for (let i = 0; i < n; i++) {
      const xi = pts[i * 2], yi = pts[i * 2 + 1], j = (i + 1) % n;
      cx += xi; cy += yi; ar += xi * pts[j * 2 + 1] - pts[j * 2] * yi;
      if (xi < x0) x0 = xi; if (xi > x1) x1 = xi; if (yi < y0) y0 = yi; if (yi > y1) y1 = yi;
    }
    cx /= n; cy /= n;
    const g = P.grid;
    let hmin = 1e9; for (let i = 0; i < n; i++) hmin = Math.min(hmin, g.h(pts[i * 2], pts[i * 2 + 1]));
    const top = g.h(cx, cy) + h;
    c.push({ pts, n, typ, h, cx, cy, area: Math.abs(ar) / 2, base: hmin, top, bb: [x0, y0, x1, y1] });
  }
  P.cache.set(k, c);
  if (P.cache.size > 400) { const f = P.cache.keys().next().value; P.cache.delete(f); }
  return c;
}

function pip(pts, n, x, y) {
  let c = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// 1 km parçanın çarpışma ızgarası (komşu parçalardaki taşan binalar da)
function collision(P, ci, cj) {
  const key = cj * P.ncx + ci;
  if (P.col.has(key)) return P.col.get(key);
  const ox = P.x0 + ci * P.CH, oy = P.y0 + cj * P.CH;
  const col = new Uint16Array(CN * CN);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    for (const b of chunk(P, ci + di, cj + dj)) {
      const [bx0, by0, bx1, by1] = b.bb;
      if (bx1 < ox || bx0 > ox + P.CH || by1 < oy || by0 > oy + P.CH) continue;
      const i0 = Math.max(0, Math.floor((bx0 - ox) / CS)), i1 = Math.min(CN - 1, Math.floor((bx1 - ox) / CS));
      const j0 = Math.max(0, Math.floor((by0 - oy) / CS)), j1 = Math.min(CN - 1, Math.floor((by1 - oy) / CS));
      const t = Math.min(65000, Math.round(b.top * 2 + 4000)); // +2000 m kayma: deniz seviyesinin altı da sığsın
      let any = false;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (pip(b.pts, b.n, ox + (i + 0.5) * CS, oy + (j + 0.5) * CS)) { any = true; const k = j * CN + i; if (col[k] < t) col[k] = t; }
      }
      if (!any && b.cx >= ox && b.cx < ox + P.CH && b.cy >= oy && b.cy < oy + P.CH) { const k = Math.floor((b.cy - oy) / CS) * CN + Math.floor((b.cx - ox) / CS); if (col[k] < t) col[k] = t; }
    }
  }
  P.col.set(key, col);
  return col;
}

// ---------- renkler ----------
const WALLS = [[236, 228, 212], [242, 238, 230], [226, 208, 178], [232, 214, 200], [214, 210, 204], [238, 226, 190], [222, 196, 170], [246, 244, 240], [212, 196, 182], [228, 220, 206]];
const WALLS_B = [[226, 222, 214], [236, 232, 224], [222, 204, 180], [206, 204, 200], [232, 220, 196], [244, 240, 232], [230, 200, 176], [214, 218, 206], [238, 214, 190], [200, 196, 190]]; // Anadolu şehirleri
const TILE = [[166, 84, 60], [150, 74, 54], [182, 98, 70], [140, 70, 52], [176, 110, 80]];
const FLAT = [[176, 172, 166], [160, 156, 150], [190, 186, 178], [146, 142, 136], [170, 162, 150]];

function hash(x, y) { let h = (Math.imul((x * 73856093) | 0, 1) ^ Math.imul((y * 19349663) | 0, 1)) >>> 0; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; return (h ^ (h >>> 15)) >>> 0; }

class Out {
  constructor(nv, ni) { this.pos = new Float32Array(nv * 3); this.nor = new Int8Array(nv * 3); this.col = new Uint8Array(nv * 3); this.uv = new Int16Array(nv * 2); this.idx = new Uint32Array(ni); this.v = 0; this.q = 0; }
  grow(nv, ni) {
    if (this.v + nv > this.pos.length / 3) { const m = Math.max(this.pos.length / 3 * 2, this.v + nv); for (const [k, T, s] of [['pos', Float32Array, 3], ['nor', Int8Array, 3], ['col', Uint8Array, 3], ['uv', Int16Array, 2]]) { const a = new T(m * s); a.set(this[k]); this[k] = a; } }
    if (this.q + ni > this.idx.length) { const a = new Uint32Array(Math.max(this.idx.length * 2, this.q + ni)); a.set(this.idx); this.idx = a; }
  }
  vert(x, y, z, nx, ny, nz, c, u, v) {
    const i = this.v++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.nor[i * 3] = nx; this.nor[i * 3 + 1] = ny; this.nor[i * 3 + 2] = nz;
    this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    this.uv[i * 2] = Math.max(-32000, Math.min(32000, Math.round(u * 16))); this.uv[i * 2 + 1] = Math.max(-32000, Math.min(32000, Math.round(v * 16)));
    return i;
  }
  tri(a, b, c) { this.idx[this.q++] = a; this.idx[this.q++] = b; this.idx[this.q++] = c; }
}

function colours(P, b) {
  const hs = hash(Math.round(b.cx), Math.round(b.cy));
  let wc, rc;
  const t = b.typ;
  if (t === 3) { wc = [[150, 176, 196], [128, 150, 170], [176, 190, 200], [110, 132, 150], [190, 198, 204]][hs % 5]; rc = [150, 150, 152]; }
  else if (t === 2 || t === 9) { wc = [[196, 198, 200], [176, 184, 190], [206, 200, 188]][hs % 3]; rc = [[186, 188, 190], [150, 160, 170], [170, 120, 100]][(hs >>> 3) % 3]; }
  else if (t === 1) { wc = [236, 232, 222]; rc = [150, 156, 162]; }
  else if (t === 4) { wc = [214, 196, 164]; rc = [160, 90, 68]; }
  else if (t === 5) { wc = [244, 242, 236]; rc = [140, 148, 156]; }
  else if (t === 7) { wc = [[224, 222, 216], [200, 210, 220], [234, 226, 210]][hs % 3]; rc = [170, 170, 168]; }
  else if (t === 8) { wc = [[230, 214, 186], [236, 226, 208], [214, 200, 190]][hs % 3]; rc = [166, 100, 76]; }
  else { const W = P.style ? WALLS_B : WALLS; wc = W[hs % W.length]; rc = FLAT[(hs >>> 4) % FLAT.length]; }
  return { wc, rc, hs };
}

function walls(o, b, pts, n, y0, y1, cx, cy, wc, hs, fh) {
  let per = 0;
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1], j = (i + 1) % n, bx = pts[j * 2], by = pts[j * 2 + 1];
    const L = Math.hypot(bx - ax, by - ay); if (L < 0.05) continue;
    const nx = (by - ay) / L, ny = -(bx - ax) / L;
    const u0 = per / 4.2, u1 = (per + L) / 4.2; per += L;
    const v1 = (y1 - y0) / fh;
    const sh = 0.86 + 0.14 * ((i * 37 + hs) % 3) / 2;
    const c = [wc[0] * sh, wc[1] * sh, wc[2] * sh];
    const NX = Math.round(nx * 127), NZ = Math.round(-ny * 127);
    o.grow(4, 6);
    const s = o.vert(ax - cx, y0, -(ay - cy), NX, 0, NZ, c, u0, 0);
    o.vert(bx - cx, y0, -(by - cy), NX, 0, NZ, c, u1, 0);
    o.vert(bx - cx, y1, -(by - cy), NX, 0, NZ, c, u1, v1);
    o.vert(ax - cx, y1, -(ay - cy), NX, 0, NZ, c, u0, v1);
    o.tri(s, s + 1, s + 2); o.tri(s, s + 2, s + 3);
  }
}
const tmpV = [];
function flatRoof(o, pts, n, y1, cx, cy, rc) {
  tmpV.length = 0;
  for (let i = 0; i < n; i++) tmpV.push(new Vector2(pts[i * 2], pts[i * 2 + 1]));
  let tris;
  if (n === 4) tris = [[0, 1, 2], [0, 2, 3]];
  else { try { tris = ShapeUtils.triangulateShape(tmpV, []); } catch (e) { tris = []; } }
  o.grow(n, tris.length * 3);
  const rs = o.v;
  for (let i = 0; i < n; i++) o.vert(pts[i * 2] - cx, y1, -(pts[i * 2 + 1] - cy), 0, 127, 0, rc, 0, 0);
  for (const t of tris) o.tri(rs + t[0], rs + t[2], rs + t[1]);
}
// kırma çatı: dört köşeli tabanda uzun kenara paralel mahya
function hipRoof(o, pts, y1, cx, cy, rc) {
  const P = [[pts[0], pts[1]], [pts[2], pts[3]], [pts[4], pts[5]], [pts[6], pts[7]]];
  const e01 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), e12 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
  // mahya: kısa kenarların orta noktalarından içeri
  let a, b, c, d; // a-b uzun kenar, sonra c, d
  if (e01 >= e12) { a = 0; b = 1; c = 2; d = 3; } else { a = 1; b = 2; c = 3; d = 0; }
  const L = Math.max(e01, e12), S = Math.min(e01, e12);
  const m1 = [(P[d][0] + P[a][0]) / 2, (P[d][1] + P[a][1]) / 2], m2 = [(P[b][0] + P[c][0]) / 2, (P[b][1] + P[c][1]) / 2];
  const ux = (m2[0] - m1[0]) / L, uy = (m2[1] - m1[1]) / L, inset = Math.min(S * 0.5, L * 0.45);
  const r1 = [m1[0] + ux * inset, m1[1] + uy * inset], r2 = [m2[0] - ux * inset, m2[1] - uy * inset];
  const rh = y1 + S * 0.32;
  const faces = [[P[a], P[b], r2, r1], [P[c], P[d], r1, r2], [P[b], P[c], r2], [P[d], P[a], r1]];
  for (const f of faces) {
    // yüz normali
    const p0 = [f[0][0], y1, f[0][1]], p1 = [f[1][0], y1, f[1][1]], p2 = [f[2][0], rh, f[2][1]];
    const ax = p1[0] - p0[0], ay = 0, az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    // (x, h, y) uzayında çapraz çarpım; three ekseninde z = -y
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    const NX = Math.round(nx / l * 127), NY = Math.round(ny / l * 127), NZ = Math.round(-nz / l * 127);
    const sh = 0.9 + 0.1 * (NX > 0 ? 1 : 0);
    const cc = [rc[0] * sh, rc[1] * sh, rc[2] * sh];
    o.grow(f.length, (f.length - 2) * 3);
    const s = o.v;
    for (let k = 0; k < f.length; k++) o.vert(f[k][0] - cx, k < 2 ? y1 : rh, -(f[k][1] - cy), NX, NY, NZ, cc, 0, 0);
    // taban noktaları saat yönü tersine; ön yüz yukarı
    o.tri(s, s + 2, s + 1); if (f.length === 4) o.tri(s, s + 3, s + 2);
  }
}

function obb(pts, n) {
  let best = 0, ang = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; const L = Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]); if (L > best) { best = L; ang = Math.atan2(pts[j * 2 + 1] - pts[i * 2 + 1], pts[j * 2] - pts[i * 2]); } }
  const c = Math.cos(ang), s = Math.sin(ang);
  let a0 = 1e18, a1 = -1e18, b0 = 1e18, b1 = -1e18;
  for (let i = 0; i < n; i++) { const x = pts[i * 2], y = pts[i * 2 + 1]; const a = x * c + y * s, b = -x * s + y * c; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const P = new Float64Array(8);
  [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].forEach(([a, b], k) => { P[k * 2] = a * c - b * s; P[k * 2 + 1] = a * s + b * c; });
  return P;
}

function build(P, lod, ni, nj) {
  const span = lod === 0 ? 1 : lod === 1 ? 2 : 4;
  const ci0 = ni * span, cj0 = nj * span;
  const cx = P.x0 + (ci0 + span / 2) * P.CH, cy = P.y0 + (cj0 + span / 2) * P.CH;
  const o = new Out(4096, 8192);
  const mosques = [];
  const ist = P.style === 0;
  for (let cj = cj0; cj < cj0 + span; cj++) for (let ci = ci0; ci < ci0 + span; ci++) {
    for (const b of chunk(P, ci, cj)) {
      const { wc, rc, hs } = colours(P, b);
      const fh = b.typ === 3 ? 3.6 : 3.1;
      if (lod === 0) {
        const y0 = b.base - 1.5, y1 = b.top;
        walls(o, b, b.pts, b.n, y0, y1, cx, cy, wc, hs, fh);
        const pitched = b.n === 4 && (b.typ === 0 || b.typ === 6 || b.typ === 4 || b.typ === 8) && b.h < 20 && b.area < 900 && (hs % 100) < (ist ? 70 : (b.typ === 6 ? 85 : 50));
        if (pitched) hipRoof(o, b.pts, y1, cx, cy, TILE[(hs >>> 5) % TILE.length]);
        else flatRoof(o, b.pts, b.n, y1, cx, cy, rc);
        if (b.typ === 1 && b.h >= 6 && b.area > 120) mosques.push({ x: b.cx, y: b.cy, top: y1, r: Math.sqrt(b.area) / 2.6, mx: b.pts[0], my: b.pts[1], h: b.h });
      } else if (lod === 1) {
        if (b.area < 130 && b.h < 12) continue;
        let pts = b.pts, n = b.n;
        if (n > 8) { pts = obb(b.pts, b.n); n = 4; }
        walls(o, b, pts, n, b.base - 1.5, b.top, cx, cy, wc, hs, fh);
        flatRoof(o, pts, n, b.top, cx, cy, b.n === 4 && b.h < 20 && (hs % 100) < (ist ? 70 : 50) ? TILE[(hs >>> 5) % TILE.length] : rc);
        if (b.typ === 1 && b.h >= 6 && b.area > 120) mosques.push({ x: b.cx, y: b.cy, top: b.top, r: Math.sqrt(b.area) / 2.6, mx: b.pts[0], my: b.pts[1], h: b.h });
      } else {
        if (!(b.h >= 18 || b.area >= 900)) continue;
        const pts = obb(b.pts, b.n);
        walls(o, b, pts, 4, b.base - 1.5, b.top, cx, cy, wc, hs, fh);
        flatRoof(o, pts, 4, b.top, cx, cy, rc);
      }
    }
  }
  const r = { pos: o.pos.slice(0, o.v * 3), nor: o.nor.slice(0, o.v * 3), col: o.col.slice(0, o.v * 3), uv: o.uv.slice(0, o.v * 2), idx: o.idx.slice(0, o.q), mosques, cx, cy };
  return r;
}

// ağaçlar: 16 m hücreli 2 bit raster (1 orman, 2 park, 3 çalılık); binalı hücreler atlanır
function trees(P, ci, cj, col) {
  if (!P.tb) return null;
  const ox = P.x0 + ci * P.CH, oy = P.y0 + cj * P.CH;
  const out = [];
  const tw4 = P.tw / 4;
  for (let y = oy + 8; y < oy + P.CH; y += 16) for (let x = ox + 8; x < ox + P.CH; x += 16) {
    const ti = Math.floor((x - P.x0) / 16), tj = Math.floor((y - P.y0) / 16);
    if (ti < 0 || tj < 0 || ti >= P.tw || tj >= P.th) continue;
    const c = (P.tb[tj * tw4 + (ti >> 2)] >> ((ti & 3) * 2)) & 3;
    if (!c) continue;
    const hh = hash(ti, tj);
    const prob = c === 1 ? 0.95 : c === 2 ? 0.45 : 0.35;
    if ((hh % 1000) / 1000 > prob) continue;
    const k = c === 1 ? 2 : 1;
    for (let t = 0; t < k; t++) {
      const h2 = hash(ti * 3 + t, tj * 7 + t);
      const px = x + ((h2 & 255) / 255 - 0.5) * 14, py = y + (((h2 >> 8) & 255) / 255 - 0.5) * 14;
      const lx = Math.floor((px - ox) / CS), ly = Math.floor((py - oy) / CS);
      if (lx >= 0 && ly >= 0 && lx < CN && ly < CN && col[ly * CN + lx]) continue;
      const g = P.grid.h(px, py);
      if (g < 0.5) continue;
      const s = c === 3 ? 0.45 + ((h2 >> 16) & 255) / 255 * 0.3 : 0.75 + ((h2 >> 16) & 255) / 255 * 0.6;
      out.push(px, py, g, s, (h2 >> 24) & 3);
    }
  }
  return new Float32Array(out);
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'pack') { openPack(m); postMessage({ type: 'packReady', id: m.id }); }
  else if (m.type === 'build') {
    const P = packs.get(m.id); if (!P) return;
    const r = build(P, m.lod, m.i, m.j);
    const tr = [r.pos.buffer, r.nor.buffer, r.col.buffer, r.uv.buffer, r.idx.buffer];
    const res = { type: 'built', id: m.id, key: m.key, lod: m.lod, ...r, index: r.idx };
    if (m.lod === 0) {
      const col = collision(P, m.i, m.j);
      res.colData = col.slice(); tr.push(res.colData.buffer);
      const t = trees(P, m.i, m.j, col); if (t) { res.trees = t; tr.push(t.buffer); }
    }
    postMessage(res, tr);
  } else if (m.type === 'col') {
    const P = packs.get(m.id); if (!P) return;
    const col = collision(P, m.i, m.j).slice();
    postMessage({ type: 'col', id: m.id, i: m.i, j: m.j, colData: col }, [col.buffer]);
  }
};
