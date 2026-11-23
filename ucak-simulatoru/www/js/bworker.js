// Bina işçisi: bina paketlerini (bina/q_*.png içindeki ikili veri) çözer; istenen ayrıntı düzeyinde birleşik geometri,
// 12.5 m'lik çarpışma ızgarası ve ağaç yerleri üretir. Ana iş parçacığı takılmasın diye ayrı çalışır.
// Ayrıntı düzeyleri: 0 = 1 km düğüm, tam taban, kırma/beşik çatı, korkuluk, çatı kulübesi; 1 = 2 km, sadeleşmiş taban, küçükler yok;
// 2 = 4 km, orta ve büyük binalar kutu; 3 = 8 km, yalnız yüksek ya da çok büyük binalar.
// Zemin yüksekliği: ana iş parçacığındaki arazi verisinin (terrain.js Heights) kopyası, aynı hesapla (bkz. HM).
import { ShapeUtils, Vector2 } from '../vendor/three.module.min.js';

const packs = new Map();
const treeR = [];     // ağaç rasterları {x0, y0, x1, y1, tw, th, tb}
const CS = 12.5, CN = 80; // çarpışma hücresi ve 1 km'deki hücre sayısı

class Grid {
  constructor(g) { Object.assign(this, g); this.x1 = this.x0 + (this.nx - 1) * this.s; this.y1 = this.y0 + (this.ny - 1) * this.s; }
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

// arazi yüksekliği: terrain.js Heights.h(…, 2) ile birebir (temel karolar + 1.5 km kenar geçişli ayrıntılı yamalar)
const HM = {
  tiles: new Map(), patches: [], sz: 256000, R0: [0, 0],
  h(x, y) {
    const t = this.tiles.get(Math.floor((x - this.R0[0]) / this.sz) + ',' + Math.floor((y - this.R0[1]) / this.sz));
    let h = t ? t.h(x, y) : 0;
    for (let k = 0; k < this.patches.length; k++) {
      const g = this.patches[k];
      if (x < g.x0 || x > g.x1 || y < g.y0 || y > g.y1) continue;
      const e = Math.min(x - g.x0, g.x1 - x, y - g.y0, g.y1 - y);
      const w = e >= 1500 ? 1 : (() => { const q = e / 1500; return q * q * (3 - 2 * q); })();
      const hp = g.h(x, y);
      h = w >= 1 ? hp : h + (hp - h) * w;
    }
    return h;
  },
};
function openPack(m) {
  const dv = new DataView(m.buf);
  const n = dv.getUint32(4, true), x0 = dv.getFloat64(8, true), y0 = dv.getFloat64(16, true);
  const ncx = dv.getUint16(24, true), ncy = dv.getUint16(26, true), CH = dv.getFloat32(28, true);
  const v4 = dv.getUint8(3) === 52;          // 'YKB4': yol bölümü var
  const tbl = v4 ? 36 : 32, body = tbl + ncx * ncy * 6;
  const P = { id: m.id, dv, n, x0, y0, ncx, ncy, CH, tbl, body, cache: new Map(), col: new Map(), style: 1, rcache: new Map() };
  if (v4) { P.rtbl = dv.getUint32(32, true); P.rbody = P.rtbl + ncx * ncy * 6; }
  packs.set(m.id, P);
  return P;
}

// yollar: 1 otoyol, 2 devlet yolu, 3 birincil, 4 ikincil, 5 üçüncül, 6 bağlantı; +16 köprü
function roadChunk(P, ci, cj) {
  if (!P.rtbl || ci < 0 || cj < 0 || ci >= P.ncx || cj >= P.ncy) return [];
  const k = cj * P.ncx + ci;
  let c = P.rcache.get(k);
  if (c) return c;
  const dv = P.dv;
  let p = P.rbody + dv.getUint32(P.rtbl + k * 6, true);
  const cnt = dv.getUint16(P.rtbl + k * 6 + 4, true);
  const ox = P.x0 + ci * P.CH, oy = P.y0 + cj * P.CH;
  c = [];
  for (let r = 0; r < cnt; r++) {
    const t = dv.getUint8(p), n = dv.getUint8(p + 1);
    let x = dv.getInt16(p + 2, true), y = dv.getInt16(p + 4, true); p += 6;
    const pts = new Float64Array(n * 2); pts[0] = ox + x / 2; pts[1] = oy + y / 2;
    for (let i = 1; i < n; i++) {
      let dx = dv.getInt8(p), dy;
      if (dx === -128) { dx = dv.getInt16(p + 1, true); dy = dv.getInt16(p + 3, true); p += 5; } else { dy = dv.getInt8(p + 1); p += 2; }
      x += dx; y += dy; pts[i * 2] = ox + x / 2; pts[i * 2 + 1] = oy + y / 2;
    }
    c.push({ cls: t & 15, bridge: !!(t & 16), pts, n });
  }
  P.rcache.set(k, c);
  if (P.rcache.size > 400) P.rcache.delete(P.rcache.keys().next().value);
  return c;
}
const RW = [0, 11, 9, 9, 7.5, 6.5, 6.5];   // yol genişliği (m)
// yol şeridi: yeniden örneklenmiş çizgi, köşelerde gönye, araziye oturur (köprüde uçlar arası doğrusal)
function roadRibbon(o, rd, cx, cy, step, wmul) {
  const pts = rd.pts, n = rd.n, w = RW[rd.cls] * wmul / 2;
  const R = [];
  for (let i = 0; i < n - 1; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[i * 2 + 2], by = pts[i * 2 + 3];
    const L = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < k; j++) R.push(ax + (bx - ax) * j / k, ay + (by - ay) * j / k);
  }
  R.push(pts[n * 2 - 2], pts[n * 2 - 1]);
  const m = R.length / 2;
  const H = new Float64Array(m);
  if (rd.bridge) {
    const h0 = HM.h(R[0], R[1]), h1 = HM.h(R[m * 2 - 2], R[m * 2 - 1]);
    if (h0 < 0.5 || h1 < 0.5) return;
    for (let i = 0; i < m; i++) H[i] = h0 + (h1 - h0) * i / (m - 1) + 0.5;
  } else for (let i = 0; i < m; i++) { const h = HM.h(R[i * 2], R[i * 2 + 1]); if (h < 0.3) return; H[i] = h + 0.25; }
  o.grow(m * 2, (m - 1) * 6);
  o.s = 32 + rd.cls;
  const s0 = o.v; let along = 0;
  const C = [255, 255, 255];
  for (let i = 0; i < m; i++) {
    const px = R[i * 2], py = R[i * 2 + 1];
    const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
    let dx = R[b * 2] - R[a * 2], dy = R[b * 2 + 1] - R[a * 2 + 1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    if (i > 0) along += Math.hypot(px - R[i * 2 - 2], py - R[i * 2 - 1]);
    const nx = -dy * w, ny = dx * w;
    o.vert(px - nx - cx, H[i], -(py - ny - cy), 0, 127, 0, C, 1, along);
    o.vert(px + nx - cx, H[i], -(py + ny - cy), 0, 127, 0, C, -1, along);
  }
  for (let i = 0; i < m - 1; i++) { const a = s0 + i * 2; o.tri(a, a + 2, a + 1); o.tri(a + 1, a + 2, a + 3); }
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
    const area = Math.abs(ar) / 2;
    if (h === 0) h = untagged(cx, cy, area, cnt, typ);
    let hmin = 1e9; for (let i = 0; i < n; i++) hmin = Math.min(hmin, HM.h(pts[i * 2], pts[i * 2 + 1]));
    const top = HM.h(cx, cy) + h;
    c.push({ pts, n, typ, h, cx, cy, area, base: hmin, top, bb: [x0, y0, x1, y1], ist: isIst(cx, cy, cnt) });
  }
  P.cache.set(k, c);
  if (P.cache.size > 400) { const f = P.cache.keys().next().value; P.cache.delete(f); }
  return c;
}

// etiketsiz binaya kat: yerleşim sıklığına göre (1 km parçadaki bina sayısı), konuma bağlı kararlı rastgele
const IST_D = [2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7];
function isIst(x, y, cnt) { return x > -60000 && x < 50000 && y > -40000 && y < 40000 && cnt > 250; }
function untagged(x, y, area, cnt, typ) {
  const r = hash(Math.round(x * 3), Math.round(y * 3)) / 4294967296;
  let lv;
  if (isIst(x, y, cnt)) lv = IST_D[Math.floor(r * IST_D.length)];
  else if (cnt > 900) lv = area > 150 ? [2, 3, 4, 4, 5, 5, 6, 7, 8][Math.floor(r * 9)] : [1, 2, 2, 3][Math.floor(r * 4)];
  else if (cnt > 250) lv = area > 150 ? [2, 2, 3, 3, 4, 4, 5][Math.floor(r * 7)] : [1, 1, 2, 2][Math.floor(r * 4)];
  else lv = area > 200 ? [1, 2, 2, 3][Math.floor(r * 4)] : [1, 1, 1, 2][Math.floor(r * 4)];
  if (area > 1500 && cnt > 250) lv += 2;
  return lv * 3.0 + 1.0;
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
const WALLS = [[230, 214, 180], [222, 196, 178], [236, 228, 212], [242, 238, 230], [226, 208, 178], [232, 214, 200], [214, 210, 204], [238, 226, 190], [222, 196, 170], [246, 244, 240], [212, 196, 182], [228, 220, 206]];
const WALLS_B = [[226, 222, 214], [236, 232, 224], [222, 204, 180], [206, 204, 200], [232, 220, 196], [244, 240, 232], [230, 200, 176], [214, 218, 206], [238, 214, 190], [200, 196, 190],
  [236, 222, 170], [226, 190, 170], [204, 214, 200], [214, 200, 220], [240, 210, 160], [196, 206, 214], [230, 180, 150]]; // Anadolu şehirleri (pastel apartmanlar)
const TILE = [[166, 84, 60], [150, 74, 54], [182, 98, 70], [140, 70, 52], [176, 110, 80]];
const FLAT = [[176, 172, 166], [160, 156, 150], [190, 186, 178], [146, 142, 136], [170, 162, 150]];

function hash(x, y) { let h = (Math.imul((x * 73856093) | 0, 1) ^ Math.imul((y * 19349663) | 0, 1)) >>> 0; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; return (h ^ (h >>> 15)) >>> 0; }

class Out {
  constructor(nv, ni) { this.pos = new Float32Array(nv * 3); this.nor = new Int8Array(nv * 3); this.col = new Uint8Array(nv * 3); this.uv = new Int16Array(nv * 2); this.st = new Uint8Array(nv); this.idx = new Uint32Array(ni); this.v = 0; this.q = 0; this.s = 0; }
  grow(nv, ni) {
    if (this.v + nv > this.pos.length / 3) { const m = Math.max(this.pos.length / 3 * 2, this.v + nv); for (const [k, T, s] of [['pos', Float32Array, 3], ['nor', Int8Array, 3], ['col', Uint8Array, 3], ['uv', Int16Array, 2], ['st', Uint8Array, 1]]) { const a = new T(m * s); a.set(this[k]); this[k] = a; } }
    if (this.q + ni > this.idx.length) { const a = new Uint32Array(Math.max(this.idx.length * 2, this.q + ni)); a.set(this.idx); this.idx = a; }
  }
  vert(x, y, z, nx, ny, nz, c, u, v) {
    const i = this.v++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.nor[i * 3] = nx; this.nor[i * 3 + 1] = ny; this.nor[i * 3 + 2] = nz;
    this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    this.uv[i * 2] = Math.max(-32000, Math.min(32000, Math.round(u * 16))); this.uv[i * 2 + 1] = Math.max(-32000, Math.min(32000, Math.round(v * 16)));
    this.st[i] = this.s;
    return i;
  }
  tri(a, b, c) { this.idx[this.q++] = a; this.idx[this.q++] = b; this.idx[this.q++] = c; }
}

// Cephe stilleri (buildings.js'teki doku atlası ile aynı sıra): 0 sıva + pencere, 1 balkonlu apartman, 2 cam giydirme,
// 3 bant pencere (okul, hastane, yeni yapı), 4 taş / tarihi, 5 sanayi paneli, 6 dükkân (yalnız zemin katta, gölgelendirici seçer),
// 7 düz çatı (çakıl, membran), 8 kiremit. +16: zemin katı dükkân.
const ST = { plaster: 0, balcony: 1, glass: 2, band: 3, stone: 4, panel: 5, roof: 7, tile: 8, SHOP: 16 };
function colours(P, b) {
  const hs = hash(Math.round(b.cx), Math.round(b.cy));
  let wc, rc, st, fh = 3.1, bw = 3.4;
  const t = b.typ, ist = b.ist, r = (hs >>> 8) % 100;
  if (t === 3) { wc = [[150, 176, 196], [128, 150, 170], [176, 190, 200], [110, 132, 150], [190, 198, 204], [120, 150, 140]][hs % 6]; rc = [150, 150, 152]; st = r < 70 ? ST.glass : ST.band; fh = 3.8; bw = 1.6; if (st === ST.band) { wc = [[226, 224, 218], [204, 206, 210], [232, 226, 214]][hs % 3]; bw = 3; } }
  else if (t === 2 || t === 9) { wc = [[196, 198, 200], [176, 184, 190], [206, 200, 188], [190, 200, 210], [214, 208, 196]][hs % 5]; rc = [[186, 188, 190], [150, 160, 170], [170, 120, 100], [200, 202, 204]][(hs >>> 3) % 4]; st = ST.panel; fh = 6; bw = 6; }
  else if (t === 1) { wc = [236, 232, 222]; rc = [150, 156, 162]; st = ST.stone; fh = 5; }
  else if (t === 4) { wc = [[214, 196, 164], [200, 184, 160], [222, 210, 186]][hs % 3]; rc = [160, 90, 68]; st = ST.stone; fh = 4.2; }
  else if (t === 5) { wc = [244, 242, 236]; rc = [140, 148, 156]; st = ST.stone; fh = 4.5; }
  else if (t === 7) { wc = [[224, 222, 216], [200, 210, 220], [234, 226, 210], [180, 190, 200]][hs % 4]; rc = [170, 170, 168]; st = r < 55 ? ST.glass : ST.band; fh = 4.2; bw = r < 55 ? 2 : 3.5; st |= ST.SHOP; }
  else if (t === 8) { wc = [[230, 214, 186], [236, 226, 208], [214, 200, 190], [220, 220, 214]][hs % 4]; rc = [166, 100, 76]; st = ST.band; fh = 3.6; }
  else if (t === 6) { const W = ist ? WALLS : WALLS_B; wc = W[hs % W.length]; rc = FLAT[(hs >>> 4) % FLAT.length]; st = ST.plaster; fh = 2.9; bw = 3.2; }
  else {
    const W = ist ? WALLS : WALLS_B; wc = W[hs % W.length]; rc = FLAT[(hs >>> 4) % FLAT.length];
    st = b.h > 9 && r < (ist ? 55 : 40) ? ST.balcony : r > 92 && b.h > 14 ? ST.band : ST.plaster;
    if (b.h > 7 && b.area > 90 && (hs >>> 12) % 100 < (ist ? 45 : 25)) st |= ST.SHOP;
  }
  // parlaklık oynaması
  const k = 0.9 + ((hs >>> 20) % 21) / 100;
  wc = [Math.min(255, wc[0] * k), Math.min(255, wc[1] * k), Math.min(255, wc[2] * k)];
  return { wc, rc, hs, st, fh, bw };
}

// duvarlar: u = çevre / pencere aralığı, v = yükseklik / kat yüksekliği (kat 0 zeminde). Altta koyulaşma (ortam kapatma).
function walls(o, b, pts, n, y0, y1, cx, cy, C, yb) {
  let per = 0;
  const { wc, hs, st, fh, bw } = C;
  const ground = yb != null ? yb : y0;
  o.s = st;
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1], j = (i + 1) % n, bx = pts[j * 2], by = pts[j * 2 + 1];
    const L = Math.hypot(bx - ax, by - ay); if (L < 0.05) continue;
    const nx = (by - ay) / L, ny = -(bx - ax) / L;
    // pencere aralığı duvar boyuna tam sığsın
    const nb = Math.max(1, Math.round(L / bw)), u0 = per, u1 = per + nb; per = u1;
    const sh = 0.9 + 0.1 * ((i * 37 + hs) % 3) / 2;
    const c1 = [wc[0] * sh, wc[1] * sh, wc[2] * sh];
    const ao = Math.min(1, 0.62 + (y1 - y0) * 0.012);
    const c0 = [c1[0] * ao, c1[1] * ao, c1[2] * ao];
    const NX = Math.round(nx * 127), NZ = Math.round(-ny * 127);
    o.grow(4, 6);
    const v0 = (y0 - ground) / fh, v1 = (y1 - ground) / fh;
    const s = o.vert(ax - cx, y0, -(ay - cy), NX, 0, NZ, c0, u0, v0);
    o.vert(bx - cx, y0, -(by - cy), NX, 0, NZ, c0, u1, v0);
    o.vert(bx - cx, y1, -(by - cy), NX, 0, NZ, c1, u1, v1);
    o.vert(ax - cx, y1, -(ay - cy), NX, 0, NZ, c1, u0, v1);
    o.tri(s, s + 1, s + 2); o.tri(s, s + 2, s + 3);
  }
}
const tmpV = [];
function triangulate(pts, n) {
  if (n === 4) return [[0, 1, 2], [0, 2, 3]];
  if (n === 3) return [[0, 1, 2]];
  tmpV.length = 0;
  for (let i = 0; i < n; i++) tmpV.push(new Vector2(pts[i * 2], pts[i * 2 + 1]));
  try { return ShapeUtils.triangulateShape(tmpV, []); } catch (e) { return []; }
}
// düz çatı (taban saat yönü tersine: üçgenler yukarı bakar). uv: dünya konumu / 4 m (çakıl, membran deseni)
function flatRoof(o, pts, n, y1, cx, cy, rc, tris) {
  tris = tris || triangulate(pts, n);
  o.grow(n, tris.length * 3);
  o.s = ST.roof;
  const rs = o.v;
  for (let i = 0; i < n; i++) o.vert(pts[i * 2] - cx, y1, -(pts[i * 2 + 1] - cy), 0, 127, 0, rc, pts[i * 2] / 4, pts[i * 2 + 1] / 4);
  for (const t of tris) o.tri(rs + t[0], rs + t[1], rs + t[2]);
}
// içe kaydırılmış çokgen (korkuluk için)
function inset(pts, n, d) {
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, c = (i + 1) % n;
    let e1x = pts[i * 2] - pts[a * 2], e1y = pts[i * 2 + 1] - pts[a * 2 + 1], e2x = pts[c * 2] - pts[i * 2], e2y = pts[c * 2 + 1] - pts[i * 2 + 1];
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1; e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
    // sol normal (içeri, CCW)
    let mx = -e1y - e2y, my = e1x + e2x; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const cosv = Math.max(0.4, mx * -e1y + my * e1x);
    out[i * 2] = pts[i * 2] + mx * d / cosv; out[i * 2 + 1] = pts[i * 2 + 1] + my * d / cosv;
  }
  return out;
}
// korkuluklu düz çatı: dış duvar y1'e kadar, içte 0.9 m aşağıda çatı, üstte kapak şeridi
function parapetRoof(o, pts, n, y1, cx, cy, wc, rc) {
  const ins = inset(pts, n, 0.35), yr = y1 - 0.9;
  const cap = [Math.min(255, wc[0] * 1.05), Math.min(255, wc[1] * 1.05), Math.min(255, wc[2] * 1.05)];
  const inn = [wc[0] * 0.8, wc[1] * 0.8, wc[2] * 0.8];
  o.s = ST.roof;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
    const ix = ins[i * 2], iy = ins[i * 2 + 1], jx = ins[j * 2], jy = ins[j * 2 + 1];
    o.grow(8, 12);
    // kapak
    let s = o.vert(ax - cx, y1, -(ay - cy), 0, 127, 0, cap, 0, 0); o.vert(bx - cx, y1, -(by - cy), 0, 127, 0, cap, 0, 0);
    o.vert(jx - cx, y1, -(jy - cy), 0, 127, 0, cap, 0, 0); o.vert(ix - cx, y1, -(iy - cy), 0, 127, 0, cap, 0, 0);
    o.tri(s, s + 1, s + 2); o.tri(s, s + 2, s + 3);
    // iç yüz (içeri bakar)
    const L = Math.hypot(jx - ix, jy - iy) || 1, nx = -(jy - iy) / L, ny = (jx - ix) / L;
    const NX = Math.round(nx * 127), NZ = Math.round(-ny * 127);
    s = o.vert(ix - cx, yr, -(iy - cy), NX, 0, NZ, inn, 0, 0); o.vert(jx - cx, yr, -(jy - cy), NX, 0, NZ, inn, 0, 0);
    o.vert(jx - cx, y1, -(jy - cy), NX, 0, NZ, inn, 0, 0); o.vert(ix - cx, y1, -(iy - cy), NX, 0, NZ, inn, 0, 0);
    o.tri(s, s + 2, s + 1); o.tri(s, s + 3, s + 2);
  }
  flatRoof(o, ins, n, yr, cx, cy, rc);
}
// çatı üstü: merdiven / asansör kulübesi ya da su deposu (kutu)
function roofBox(o, x, y, w, d, ang, y0, h, cx, cy, c) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = new Float64Array(8);
  [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].forEach(([u, v], k) => { P[k * 2] = x + u * ca - v * sa; P[k * 2 + 1] = y + u * sa + v * ca; });
  const st = o.s;
  walls(o, null, P, 4, y0, y0 + h, cx, cy, { wc: c, hs: 0, st: ST.plaster, fh: 40, bw: 40 });
  flatRoof(o, P, 4, y0 + h, cx, cy, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8]);
  o.s = st;
}
// kırma çatı (4 köşe ya da dikdörtgene yakın taban, OBB üzerinde), saçak 0.4 m. Kalkan (beşik) çatı seçeneği.
function hipRoof(o, pts, y1, cx, cy, rc, wc, gable) {
  const ov = 0.4;
  const P = [[pts[0], pts[1]], [pts[2], pts[3]], [pts[4], pts[5]], [pts[6], pts[7]]];
  // saçak: köşeleri merkezden dışa it
  const mx = (P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4, my = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4;
  for (const q of P) { const dx = q[0] - mx, dy = q[1] - my, l = Math.hypot(dx, dy) || 1; q[0] += dx / l * ov * 1.41; q[1] += dy / l * ov * 1.41; }
  const e01 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), e12 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
  let a, b, c, d;
  if (e01 >= e12) { a = 0; b = 1; c = 2; d = 3; } else { a = 1; b = 2; c = 3; d = 0; }
  const L = Math.max(e01, e12), S = Math.min(e01, e12);
  const m1 = [(P[d][0] + P[a][0]) / 2, (P[d][1] + P[a][1]) / 2], m2 = [(P[b][0] + P[c][0]) / 2, (P[b][1] + P[c][1]) / 2];
  const ux = (m2[0] - m1[0]) / L, uy = (m2[1] - m1[1]) / L, inset2 = gable ? 0 : Math.min(S * 0.5, L * 0.45);
  const r1 = [m1[0] + ux * inset2, m1[1] + uy * inset2], r2 = [m2[0] - ux * inset2, m2[1] - uy * inset2];
  const ye = y1 - 0.25, rh = ye + S * 0.36;
  const faces = [[P[a], P[b], r2, r1], [P[c], P[d], r1, r2], [P[b], P[c], r2], [P[d], P[a], r1]];
  o.s = ST.tile;
  for (let fi = 0; fi < 4; fi++) {
    const f = faces[fi];
    const gableEnd = gable && fi >= 2;
    const p0 = [f[0][0], ye, f[0][1]], p1 = [f[1][0], ye, f[1][1]], p2 = [f[2][0], rh, f[2][1]];
    const ax = p1[0] - p0[0], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    let nx = -az * by, ny = az * bx - ax * bz, nz = ax * by;
    if (gableEnd) { ny = 0; const fx = (f[0][0] + f[1][0]) / 2 - mx, fy = (f[0][1] + f[1][1]) / 2 - my; if (nx * fx + nz * fy < 0) { nx = -nx; nz = -nz; } }
    else if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    const NX = Math.round(nx / l * 127), NY = Math.round(ny / l * 127), NZ = Math.round(-nz / l * 127);
    const cc = gableEnd ? wc : rc;
    if (gableEnd) o.s = ST.plaster;
    o.grow(f.length, (f.length - 2) * 3);
    const s = o.v;
    // kiremit uv: u yatay (mahyaya paralel), v eğim boyunca
    const ex = (f[1][0] - f[0][0]), ey = (f[1][1] - f[0][1]), el = Math.hypot(ex, ey) || 1;
    for (let k = 0; k < f.length; k++) {
      const px = f[k][0], py = f[k][1];
      const u = ((px - f[0][0]) * ex + (py - f[0][1]) * ey) / el;
      const vv = k < 2 ? 0 : S * 0.6;
      o.vert(px - cx, k < 2 ? ye : rh, -(py - cy), NX, NY, NZ, cc, gableEnd ? 0 : u / 2.5, gableEnd ? (k < 2 ? 0 : 1) : vv / 2.5);
    }
    o.tri(s, s + 1, s + 2); if (f.length === 4) o.tri(s, s + 2, s + 3);
    if (gableEnd) o.s = ST.tile;
  }
  // saçak altı (alttan görünür, koyu)
  o.grow(4, 6);
  const dk = [rc[0] * 0.45, rc[1] * 0.45, rc[2] * 0.45];
  const s = o.v;
  for (const k of [a, b, c, d]) o.vert(P[k][0] - cx, ye, -(P[k][1] - cy), 0, -127, 0, dk, 0, 0);
  o.tri(s, s + 2, s + 1); o.tri(s, s + 3, s + 2);
}

function obb(pts, n) {
  let best = 0, ang = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; const L = Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]); if (L > best) { best = L; ang = Math.atan2(pts[j * 2 + 1] - pts[i * 2 + 1], pts[j * 2] - pts[i * 2]); } }
  const c = Math.cos(ang), s = Math.sin(ang);
  let a0 = 1e18, a1 = -1e18, b0 = 1e18, b1 = -1e18;
  for (let i = 0; i < n; i++) { const x = pts[i * 2], y = pts[i * 2 + 1]; const a = x * c + y * s, b = -x * s + y * c; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const P = new Float64Array(8);
  [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].forEach(([a, b], k) => { P[k * 2] = a * c - b * s; P[k * 2 + 1] = a * s + b * c; });
  P.area = (a1 - a0) * (b1 - b0); P.ang = ang; P.w = a1 - a0; P.d = b1 - b0;
  return P;
}

// lod 0 = 1 km düğüm: tam taban, çatılar, korkuluk, çatı kulübesi; 1 = 2 km: sadeleşmiş taban (8 köşeden fazlası OBB);
// 2 = 4 km: yalnız orta/büyük binalar OBB kutu; 3 = 8 km: yalnız yüksek ya da çok büyük binalar
function build(P, lod, ni, nj) {
  const span = 1 << lod;
  const ci0 = ni * span, cj0 = nj * span;
  const cx = P.x0 + (ci0 + span / 2) * P.CH, cy = P.y0 + (cj0 + span / 2) * P.CH;
  const o = new Out(4096, 8192);
  const mosques = [];
  for (let cj = cj0; cj < cj0 + span; cj++) for (let ci = ci0; ci < ci0 + span; ci++) {
    for (const b of chunk(P, ci, cj)) {
      const C = colours(P, b);
      const { wc, rc, hs } = C;
      const y0 = b.base - 1.5, y1 = b.top, yb = b.base;
      const resid = b.typ === 0 || b.typ === 6 || b.typ === 4 || b.typ === 8;
      if (lod === 0) {
        let roofPts = null;
        if (resid && b.h < 22 && b.area < 1200 && (hs % 100) < (b.ist ? 62 : b.typ === 6 ? 85 : 55)) {
          if (b.n === 4) roofPts = b.pts;
          else if (b.n <= 10) { const q = obb(b.pts, b.n); if (b.area / q.area > 0.86) roofPts = q; }
        }
        walls(o, b, b.pts, b.n, y0, y1, cx, cy, C, yb);
        if (roofPts) hipRoof(o, roofPts, y1, cx, cy, TILE[(hs >>> 5) % TILE.length], wc, (hs >>> 9) % 100 < 30);
        else if (b.h >= 9 && b.area >= 150 && b.n <= 12 && b.typ !== 2 && b.typ !== 9) parapetRoof(o, b.pts, b.n, y1, cx, cy, wc, rc);
        else flatRoof(o, b.pts, b.n, y1, cx, cy, rc);
        // çatı kulübesi (merdiven/asansör) ya da sanayi çatısında havalandırma
        if (!roofPts && b.h >= 12 && b.area >= 180 && (hs >>> 14) % 100 < 70) {
          const q = obb(b.pts, b.n), w = Math.min(4 + (hs % 3), q.w * 0.4), d = Math.min(3.5, q.d * 0.4);
          const mx = (q[0] + q[4]) / 2, my = (q[1] + q[5]) / 2;
          roofBox(o, mx, my, w, d, q.ang, y1 - 0.9, 2.6, cx, cy, [wc[0] * 0.92, wc[1] * 0.92, wc[2] * 0.92]);
        }
        if (b.typ === 1 && b.h >= 6 && b.area > 120) mosques.push({ x: b.cx, y: b.cy, top: y1, r: Math.sqrt(b.area) / 2.6, mx: b.pts[0], my: b.pts[1], h: b.h });
      } else if (lod === 1) {
        if (b.area < 130 && b.h < 12) continue;
        let pts = b.pts, n = b.n;
        if (n > 8) { pts = obb(b.pts, b.n); n = 4; }
        walls(o, b, pts, n, y0, y1, cx, cy, C, yb);
        const pitched = resid && b.n === 4 && b.h < 22 && (hs % 100) < (b.ist ? 62 : 55);
        if (pitched) hipRoof(o, pts, y1, cx, cy, TILE[(hs >>> 5) % TILE.length], wc, false);
        else flatRoof(o, pts, n, y1, cx, cy, rc);
        if (b.typ === 1 && b.h >= 6 && b.area > 120) mosques.push({ x: b.cx, y: b.cy, top: b.top, r: Math.sqrt(b.area) / 2.6, mx: b.pts[0], my: b.pts[1], h: b.h });
      } else if (lod === 2) {
        if (!(b.h >= 17 || b.area >= 800)) continue;
        const pts = obb(b.pts, b.n);
        walls(o, b, pts, 4, y0, y1, cx, cy, C, yb);
        flatRoof(o, pts, 4, y1, cx, cy, resid && b.h < 22 ? TILE[(hs >>> 5) % TILE.length] : rc);
      } else {
        if (!(b.h >= 28 || b.area >= 2500)) continue;
        const pts = obb(b.pts, b.n);
        walls(o, b, pts, 4, y0, y1, cx, cy, C, yb);
        flatRoof(o, pts, 4, y1, cx, cy, rc);
      }
    }
  }
  // yollar: yakında hepsi, uzaklaştıkça yalnız büyükler
  const maxCls = [6, 4, 3, 2][lod], step = [24, 40, 80, 150][lod], wm = [1, 1, 1.25, 1.6][lod];
  for (let cj = cj0; cj < cj0 + span; cj++) for (let ci = ci0; ci < ci0 + span; ci++) {
    for (const rd of roadChunk(P, ci, cj)) if (rd.cls <= maxCls || (rd.cls === 6 && lod <= 1)) roadRibbon(o, rd, cx, cy, step, wm);
  }
  const r = { pos: o.pos.slice(0, o.v * 3), nor: o.nor.slice(0, o.v * 3), col: o.col.slice(0, o.v * 3), uv: o.uv.slice(0, o.v * 2), st: o.st.slice(0, o.v), idx: o.idx.slice(0, o.q), mosques, cx, cy };
  return r;
}

// ağaçlar: 16 m hücreli 2 bit raster (1 orman, 2 park, 3 çalılık); binalı hücreler atlanır
function trees(P, ci, cj, col) {
  const ox = P.x0 + ci * P.CH, oy = P.y0 + cj * P.CH;
  const R = treeR.filter((t) => t.x1 > ox && t.x0 < ox + P.CH && t.y1 > oy && t.y0 < oy + P.CH);
  if (!R.length) return null;
  const out = [];
  for (const T of R) {
    const tw4 = T.tw / 4;
    for (let y = oy + 8; y < oy + P.CH; y += 16) for (let x = ox + 8; x < ox + P.CH; x += 16) {
      const ti = Math.floor((x - T.x0) / 16), tj = Math.floor((y - T.y0) / 16);
      if (ti < 0 || tj < 0 || ti >= T.tw || tj >= T.th) continue;
      const c = (T.tb[tj * tw4 + (ti >> 2)] >> ((ti & 3) * 2)) & 3;
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
        const g = HM.h(px, py);
        if (g < 0.5) continue;
        const s = c === 3 ? 0.45 + ((h2 >> 16) & 255) / 255 * 0.3 : 0.75 + ((h2 >> 16) & 255) / 255 * 0.6;
        out.push(px, py, g, s, (h2 >> 24) & 3);
      }
    }
  }
  return out.length ? new Float32Array(out) : null;
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'pack') { openPack(m); postMessage({ type: 'packReady', id: m.id }); }
  else if (m.type === 'grid') {
    const g = new Grid(m.grid);
    HM.sz = m.sz; HM.R0 = m.R0;
    if (m.kind === 'tile') HM.tiles.set(m.key, g);
    else { g.id = m.key; HM.patches = HM.patches.filter((q) => q.id !== m.key).concat([g]); }
  } else if (m.type === 'trees') {
    const tv = new DataView(m.buf);
    treeR.push({ x0: m.rect[0], y0: m.rect[1], x1: m.rect[2], y1: m.rect[3], tw: tv.getInt32(4, true), th: tv.getInt32(8, true), tb: new Uint8Array(m.buf, 12) });
  }
  else if (m.type === 'build') {
    const P = packs.get(m.id); if (!P) return;
    const r = build(P, m.lod, m.i, m.j);
    const tr = [r.pos.buffer, r.nor.buffer, r.col.buffer, r.uv.buffer, r.st.buffer, r.idx.buffer];
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
