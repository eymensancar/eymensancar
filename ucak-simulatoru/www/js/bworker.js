// Bina geometrisi işçisi: binalar.bin'i çözer, çarpışma ızgarasını ve parça (chunk) geometrilerini üretir.
// Ana iş parçacığı takılmasın diye ayrı çalışır.
import { ShapeUtils, Vector2 } from '../vendor/three.module.min.js';

let H, HG, X0, X1, Y0, Y1, chunks = [], dv;

function terrainH(x, y) {
  const n = HG;
  const fi = Math.min(Math.max((x - X0) / (X1 - X0) * (n - 1), 0), n - 1.0001);
  const fj = Math.min(Math.max((Y1 - y) / (Y1 - Y0) * (n - 1), 0), n - 1.0001);
  const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j;
  const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
function pip(pts, n, x, y) {
  let c = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function decode(off, count) {
  let p = off; const out = [];
  for (let k = 0; k < count; k++) {
    const n = dv.getUint8(p), typ = dv.getUint8(p + 1), h = dv.getUint16(p + 2, true) / 10;
    let x = dv.getInt16(p + 4, true), y = dv.getInt16(p + 6, true); p += 8;
    const pts = new Float32Array(n * 2); pts[0] = x / 2; pts[1] = y / 2;
    for (let i = 1; i < n; i++) {
      let dx = dv.getInt8(p), dy;
      if (dx === -128) { dx = dv.getInt16(p + 1, true); dy = dv.getInt16(p + 3, true); p += 5; } else { dy = dv.getInt8(p + 1); p += 2; }
      x += dx; y += dy; pts[i * 2] = x / 2; pts[i * 2 + 1] = y / 2;
    }
    let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += pts[i * 2]; cy += pts[i * 2 + 1]; }
    cx /= n; cy /= n;
    out.push({ pts, n, typ, h, cx, cy, top: terrainH(cx, cy) + h });
  }
  return out;
}

function raster(list, col, G, CW, CHh) {
  const mark = (x, y, top) => {
    const i = Math.floor((x - X0) / G), j = Math.floor((Y1 - y) / G);
    if (i < 0 || j < 0 || i >= CW || j >= CHh) return;
    const k = j * CW + i, t = Math.min(65000, Math.round(top * 2)); if (col[k] < t) col[k] = t;
  };
  for (const b of list) {
    const pts = b.pts, n = b.n;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) { const x = pts[i * 2], y = pts[i * 2 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const i0 = Math.floor((x0 - X0) / G), i1 = Math.floor((x1 - X0) / G), j0 = Math.floor((Y1 - y1) / G), j1 = Math.floor((Y1 - y0) / G);
    let any = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= CW || j >= CHh) continue;
      if (pip(pts, n, X0 + (i + 0.5) * G, Y1 - (j + 0.5) * G)) { any = true; mark(X0 + (i + 0.5) * G, Y1 - (j + 0.5) * G, b.top); }
    }
    if (!any) mark(b.cx, b.cy, b.top);
  }
}

const WALLS = [[236, 228, 212], [242, 238, 230], [226, 208, 178], [232, 214, 200], [214, 210, 204], [238, 226, 190], [222, 196, 170], [246, 244, 240]];
const ROOFS = [[170, 92, 70], [158, 84, 64], [184, 104, 78], [196, 192, 186], [176, 172, 166], [150, 146, 140]];
const UVS = 16; // uv tamsayı ölçeği (doku tekrarında 1/16 ile geri çevrilir)

function build(list) {
  let nv = 0, ni = 0;
  for (const b of list) { nv += b.n * 5; ni += b.n * 6 + (b.n - 2) * 3; }
  const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 3), col = new Uint8Array(nv * 3), uv = new Int16Array(nv * 2);
  const idx = new Uint32Array(ni);
  let v = 0, q = 0;
  const mosques = [];
  const tmp = [];
  for (const b of list) {
    const n = b.n, P = b.pts;
    let hmin = 1e9;
    for (let i = 0; i < n; i++) hmin = Math.min(hmin, terrainH(P[i * 2], P[i * 2 + 1]));
    const y0 = hmin - 1.5, y1 = b.top;
    const hs = ((b.cx * 7.13 + b.cy * 3.71) | 0) & 1023;
    let wc, rc;
    if (b.typ === 3) { wc = [[150, 176, 196], [128, 150, 170], [176, 190, 200]][hs % 3]; rc = [150, 150, 152]; }
    else if (b.typ === 2) { wc = [[196, 198, 200], [176, 184, 190]][hs % 2]; rc = [186, 188, 190]; }
    else if (b.typ === 1) { wc = [236, 232, 222]; rc = [150, 156, 162]; }
    else if (b.typ === 4) { wc = [214, 196, 164]; rc = [160, 90, 68]; }
    else if (b.typ === 5) { wc = [244, 242, 236]; rc = [140, 148, 156]; }
    else { wc = WALLS[hs % WALLS.length]; rc = b.h < 22 && (hs % 5) < 3 ? ROOFS[hs % 3] : ROOFS[3 + (hs % 3)]; }
    const fh = b.typ === 3 ? 3.6 : 3.1;
    let per = 0;
    for (let i = 0; i < n; i++) {
      const ax = P[i * 2], ay = P[i * 2 + 1], j = (i + 1) % n, bx = P[j * 2], by = P[j * 2 + 1];
      const L = Math.hypot(bx - ax, by - ay); if (L < 0.01) continue;
      const nx = (by - ay) / L, ny = -(bx - ax) / L;
      const u0 = per / 4.2, u1 = (per + L) / 4.2; per += L;
      const v1 = (y1 - y0) / fh;
      const shade = 0.9 + 0.1 * ((i * 37 + hs) % 3) / 2;
      const quad = [[ax, y0, ay, u0, 0], [bx, y0, by, u1, 0], [bx, y1, by, u1, v1], [ax, y1, ay, u0, v1]];
      for (const [x, yy, z, uu, vv] of quad) {
        pos[v * 3] = x; pos[v * 3 + 1] = yy; pos[v * 3 + 2] = -z;
        nor[v * 3] = Math.round(nx * 127); nor[v * 3 + 1] = 0; nor[v * 3 + 2] = Math.round(-ny * 127);
        col[v * 3] = wc[0] * shade; col[v * 3 + 1] = wc[1] * shade; col[v * 3 + 2] = wc[2] * shade;
        uv[v * 2] = Math.max(-32000, Math.min(32000, Math.round(uu * UVS))); uv[v * 2 + 1] = Math.min(32000, Math.round(vv * UVS)); v++;
      }
      const s = v - 4;
      idx[q++] = s; idx[q++] = s + 1; idx[q++] = s + 2; idx[q++] = s; idx[q++] = s + 2; idx[q++] = s + 3;
    }
    tmp.length = 0;
    for (let i = 0; i < n; i++) tmp.push(new Vector2(P[i * 2], P[i * 2 + 1]));
    let tris;
    try { tris = ShapeUtils.triangulateShape(tmp, []); } catch (e) { tris = []; }
    const rs = v;
    for (let i = 0; i < n; i++) {
      pos[v * 3] = P[i * 2]; pos[v * 3 + 1] = y1; pos[v * 3 + 2] = -P[i * 2 + 1];
      nor[v * 3] = 0; nor[v * 3 + 1] = 127; nor[v * 3 + 2] = 0;
      col[v * 3] = rc[0]; col[v * 3 + 1] = rc[1]; col[v * 3 + 2] = rc[2];
      uv[v * 2] = 0; uv[v * 2 + 1] = 0; v++;
    }
    for (const t of tris) { if (q + 3 > idx.length) break; idx[q++] = rs + t[0]; idx[q++] = rs + t[2]; idx[q++] = rs + t[1]; }
    if (b.typ === 1 && b.h >= 6) {
      let ar = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; ar += P[i * 2] * P[j * 2 + 1] - P[j * 2] * P[i * 2 + 1]; }
      ar = Math.abs(ar) / 2;
      if (ar > 120) mosques.push({ x: b.cx, y: b.cy, top: y1, r: Math.sqrt(ar) / 2.6, mx: P[0], my: P[1], h: b.h });
    }
  }
  return { pos: pos.slice(0, v * 3), nor: nor.slice(0, v * 3), col: col.slice(0, v * 3), uv: uv.slice(0, v * 2), idx: idx.slice(0, q), mosques };
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    ({ H, HG, X0, X1, Y0, Y1 } = m);
    dv = new DataView(m.buf);
    const NC = dv.getUint16(8, true), tbl = 28, body = tbl + NC * NC * 8;
    const G = m.G, CW = Math.ceil((X1 - X0) / G), CHh = Math.ceil((Y1 - Y0) / G);
    const col = new Uint16Array(CW * CHh);
    for (let c = 0; c < NC * NC; c++) {
      const off = dv.getUint32(tbl + c * 8, true), n = dv.getUint32(tbl + c * 8 + 4, true);
      chunks[c] = n ? decode(body + off, n) : [];
      raster(chunks[c], col, G, CW, CHh);
    }
    postMessage({ type: 'col', col, CW, CHh }, [col.buffer]);
  } else if (m.type === 'build') {
    const r = build(chunks[m.idx]);
    postMessage({ type: 'chunk', ...r, idx: m.idx, index: r.idx }, [r.pos.buffer, r.nor.buffer, r.col.buffer, r.uv.buffer, r.idx.buffer]);
  }
};
