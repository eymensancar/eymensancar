// Ankara Esenboğa Havalimanı (LTAC, ESB). Gerçek yerleşimden (OSM tabanları) kendi modelimiz:
// - Terminal (2006): hava tarafı dışbükey, kara tarafı içbükey hilal; OSM tabanı iki çembere çok iyi oturuyor
//   (hava cephesi C merkezli 668 m, kara cephesi L merkezli 487 m). Büyük düz çatı, kare ışıklık ızgarası ve yay boyunca
//   uzanan ana ışıklık, kat bantları, kara cephesinde dikey kanatlar, ağaç sütunlu geniş saçak. Ayrı parça:
//   ctx.parts.get('terminal:T1') (ortak.terminal() kabuğu + bu dosyanın süsleri, hepsi aynı grupta).
// - Terminalin önünde yay biçimli gidiş viyadüğü (rampalarıyla, ayaklı, korkuluklu), altında geliş yolu, çevre yolu,
//   şehre giden yol, üç katlı yay biçimli katlı otopark ve açık otopark (örneklenmiş arabalar), ağaçlar.
// - Kendine özgü kule (OSM: 77 m): mercek kesitli, iki yanında kaburgalı beton gövde, dikey cam yarık, açılan boyun,
//   teknik kat, dışa eğik çok yüzlü kabin, saçaklı çatı, radom ve anten; altında OSM tabanında yuvarlak hizmet binası.
//   Eski kule (45 m) klasik biçimde.
// - Sabit yolcu köprüleri (OSM köprü tabanlarından cam koridorlar), hangar kapıları, kargo binası (rampalı, tırlı,
//   ULD konteynerli) ve kargo uçağı, apron ışık direkleri. Uçaklar markasız.
// Küçük ayrıntılar (arabalar, ağaçlar, konteynerler) kameraya yakınken çizilir (ctx.tick).
import * as THREE from '../../vendor/three.module.min.js';
import { GB, obbOf, inflate, centroid, decal, airlinerGeoms, TAILS, stands, standsAndAircraft } from '../havalimani.js';
import { terminal, jetBridges, vehicles, pip, nearestEdge } from './ortak.js';

const D = Math.PI / 180;
const C = [-104, -1544], RC = 668;     // hava tarafı cephesi
const L = [-188, -1508], RL = 487;     // kara tarafı cephesi
const pol = (c, r, a) => [c[0] + Math.cos(a * D) * r, c[1] + Math.sin(a * D) * r];
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const hsh = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

// renkler (doğrusal)
const WHITE = [0.82, 0.83, 0.84], ROOFC = [0.62, 0.64, 0.66], CONC = [0.58, 0.57, 0.54], DARK = [0.10, 0.11, 0.12];
const STEEL = [0.45, 0.47, 0.5], CLAD = [0.66, 0.70, 0.74], CLAD2 = [0.55, 0.60, 0.66], ASPH = [0.055, 0.056, 0.06];
const PAVE = [0.36, 0.35, 0.33], LINE = [0.75, 0.75, 0.72], LINEY = [0.62, 0.45, 0.06], GRASS = [0.16, 0.2, 0.08];

// renkli geometri: vert() o anki rengi yazar
class CB extends GB {
  constructor() { super([['color', 3]]); this.c = WHITE; }
  vert(x, h, y, nx, ny, nz, at) { return super.vert(x, h, y, nx, ny, nz, at && at.color ? at : { color: this.c }); }
}
let MT = null;
function mats() {
  if (MT) return MT;
  MT = {
    col: new THREE.MeshLambertMaterial({ vertexColors: true }),
    road: decal(new THREE.MeshLambertMaterial({ vertexColors: true }), 3.0e-6),
    mark: decal(new THREE.MeshLambertMaterial({ vertexColors: true }), 4.0e-6),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff1d0 }),
  };
  MT.road.userData.key = 'ltac-yol'; MT.mark.userData.key = 'ltac-isaret';
  return MT;
}
function mesh(gb, mat, name, ro = 0) {
  if (!gb.count) return null;
  const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; m.renderOrder = ro; return m;
}
// cam: doku birimi 3 m x 4.5 m
function glassMesh(gl, M, name) {
  const m = mesh(gl, M.glass, name); if (!m) return null;
  const uv = m.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 3, uv.getY(k) / 4.5);
  return m;
}
function group(name, list) {
  const g = new THREE.Group(); g.name = name; g.matrixAutoUpdate = false;
  for (const m of list) if (m) g.add(m);
  return g;
}

// ---------- yol ve tabliye yardımcıları (noktalar [x, y, h]) ----------
function resample(pts, step) {
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let i = 0; i < n; i++) { const t = i / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
function frames(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [-ty / l, tx / l];      // sol
  });
}
// düz şerit (yüzey): en w, sola kayma off, yükseklik payı dh
function ribbon(g, pts, w, off = 0, dh = 0) {
  const F = frames(pts);
  const side = (i, o) => [pts[i][0] + F[i][0] * o, pts[i][1] + F[i][1] * o, pts[i][2] + dh];
  for (let i = 0; i < pts.length - 1; i++) {
    const r0 = side(i, off - w / 2), r1 = side(i + 1, off - w / 2), l1 = side(i + 1, off + w / 2), l0 = side(i, off + w / 2);
    const s = g.count;
    for (const q of [r0, r1, l1, l0]) g.vert(q[0], q[2], q[1], 0, 1, 0);
    g.quad(s, s + 1, s + 2, s + 3);
  }
}
// hacimli tabliye: üst, alt, iki yan (kalınlık t, üst yüz pts[].h)
function slab(g, pts, w, t, off = 0) {
  const F = frames(pts);
  const P = (i, o, dh) => [pts[i][0] + F[i][0] * o, pts[i][1] + F[i][1] * o, pts[i][2] + dh];
  const q4 = (a, b, c, d, nx, ny, nz) => { const s = g.count; for (const q of [a, b, c, d]) g.vert(q[0], q[2], q[1], nx, ny, nz); g.quad(s, s + 1, s + 2, s + 3); };
  for (let i = 0; i < pts.length - 1; i++) {
    const R = off - w / 2, Lf = off + w / 2;
    const r0 = P(i, R, 0), r1 = P(i + 1, R, 0), l1 = P(i + 1, Lf, 0), l0 = P(i, Lf, 0);
    const r0b = P(i, R, -t), r1b = P(i + 1, R, -t), l1b = P(i + 1, Lf, -t), l0b = P(i, Lf, -t);
    q4(r0, r1, l1, l0, 0, 1, 0);
    q4(l0b, l1b, r1b, r0b, 0, -1, 0);
    q4(r0b, r1b, r1, r0, -F[i][0], 0, -F[i][1]);
    q4(l1b, l0b, l0, l1, F[i][0], 0, F[i][1]);
  }
}
// kesikli çizgi
function dashes(g, pts, w, off, dash, gap, dh) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (s) => { let i = 1; while (i < pts.length - 1 && cum[i] < s) i++; const t = clamp((s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), 0, 1); const a = pts[i - 1], b = pts[i]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  for (let s = gap; s + dash < cum[cum.length - 1]; s += dash + gap) ribbon(g, [at(s), at(s + dash)], w, off, dh);
}
const arc = (c, r, a0, a1, step = 1.5) => { const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step)), out = []; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n, r2 = typeof r === 'function' ? r(a) : r; out.push([...pol(c, r2, a), 0]); } return out; };
// halka dilimi çokgeni (saat yönü tersine)
function sector(c, r0, r1, a0, a1, step = 2) {
  const n = Math.max(1, Math.ceil((a1 - a0) / step)), P = [];
  for (let k = 0; k <= n; k++) P.push(pol(c, r1, a0 + (a1 - a0) * k / n));
  for (let k = n; k >= 0; k--) P.push(pol(c, r0, a0 + (a1 - a0) * k / n));
  return P;
}
// mercek kesitli loft (kule gövdesi): rings [[h, A, B]]
function loft(g, x, y, rot, rings, seg = 28) {
  const s0 = g.count, cr = Math.cos(rot), sr = Math.sin(rot);
  const shp = (f, A, B) => { const c = Math.cos(f), s = Math.sin(f); return [A * Math.sign(c) * Math.pow(Math.abs(c), 0.85), B * Math.sign(s) * Math.pow(Math.abs(s), 1.35)]; };
  for (let k = 0; k <= seg; k++) {
    const f = k / seg * Math.PI * 2;
    for (const [h, A, B] of rings) {
      const [u, v] = shp(f, A, B), [u2, v2] = shp(f + 0.01, A, B);
      let nx = v2 - v, ny = -(u2 - u); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      g.vert(x + u * cr - v * sr, h, y + u * sr + v * cr, nx * cr - ny * sr, 0, nx * sr + ny * cr);
    }
  }
  const P = rings.length;
  for (let k = 0; k < seg; k++) for (let j = 0; j < P - 1; j++) { const a = s0 + k * P + j, b = a + P; g.quad(a, b, b + 1, a + 1); }
}
function addCol(ctx, c) {
  const W = ctx.W, k = Math.round(c.x) + ':' + Math.round(c.y);
  W._apCol = W._apCol || new Set();
  if (W._apCol.has(k)) return; W._apCol.add(k); W.lmCol.push(c);
}
function segDist(pts, x, y) {
  let m = 1e9;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1); m = Math.min(m, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return m;
}
const twyClear = (d, x, y, pad) => d.twy.every((t) => segDist(t.p, x, y) > t.w / 2 + pad) && d.rws.every((r) => segDist([r.a, r.b], x, y) > r.w / 2 + 120);

// ---------- örneklenmiş araba ve ağaç ----------
let CAR = null, TREE = null;
function carGeom() {
  if (CAR) return CAR;
  const g = new CB();
  g.c = [1, 1, 1]; g.box(0, 0, 0.12, 4.4, 1.8, 0.88, 0);
  g.c = [0.16, 0.18, 0.2]; g.box(-0.25, 0, 1.0, 2.4, 1.6, 0.55, 0);
  CAR = g.geometry(); return CAR;
}
function treeGeom() {
  if (TREE) return TREE;
  const g = new CB();
  g.c = [0.22, 0.16, 0.1]; g.box(0, 0, 0, 0.4, 0.4, 2.2, 0);
  g.c = [0.13, 0.22, 0.07]; g.lathe(0, 0, [[0.01, 1.4], [2.4, 2.6], [2.6, 4.2], [1.6, 6.2], [0.05, 7.4]], 7, 0);
  TREE = g.geometry(); return TREE;
}
const CARCOL = [[0.8, 0.8, 0.8], [0.06, 0.06, 0.07], [0.4, 0.42, 0.45], [0.8, 0.8, 0.8], [0.06, 0.06, 0.07], [0.62, 0.63, 0.64], [0.4, 0.05, 0.04], [0.08, 0.14, 0.3], [0.8, 0.8, 0.8], [0.25, 0.25, 0.27], [0.85, 0.65, 0.08]];
function instanced(geom, list, name) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geom, mats().col, list.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, y, h, ang, col, sc], i) => {
    o.position.set(x, h, -y); o.rotation.set(0, ang, 0); const s = sc || 1; o.scale.set(s, s, s); o.updateMatrix();
    m.setMatrixAt(i, o.matrix); c.setRGB(col[0], col[1], col[2]); m.setColorAt(i, c);
  });
  m.computeBoundingSphere(); m.name = name; m.matrixAutoUpdate = false;
  return m;
}

export function build(ctx) {
  const { d } = ctx;
  const lod = [];                       // [nesne, x, y, uzaklık]
  const mainB = d.bina.find((b) => b.t === 'terminal' && b.n === 'Esenboğa Terminal Binası');
  const mainOk = mainB && Math.hypot(centroid(mainB.p)[0] + 420, centroid(mainB.p)[1] + 1100) < 200;

  // ortak.standard() ile aynı sıra; uçaklar yerleştikten sonra üst üste binenler ayıklanır (araçlar ondan sonra)
  const S = stands(d); ctx.stands = S;
  const terms = [], seen = new Set();
  let k = 0, term = null;
  for (const b of d.bina) {
    if (b.t !== 'terminal') continue;
    const key = b.p[0][0] + ':' + b.p[0][1]; if (seen.has(key)) continue; seen.add(key);
    const area = Math.abs(b.p.reduce((s, p, i) => { const q = b.p[(i + 1) % b.p.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    if (area < 400) continue;
    const main = mainOk && b === mainB;
    const g = terminal(ctx, (b.id || 'T' + (++k)).toString(), b.n || 'Terminal', b.p, main ? { h: 22, roof: 'duz', overhang: 3 } : { h: 13, roof: 'duz', overhang: 2 });
    if (main) term = g;
    terms.push(b.p);
  }
  const pick = standsAndAircraft(ctx, { occ: 0.7 });
  declutter(ctx, pick);
  gateAircraft(ctx, S);
  jetBridges(ctx, terms, S);
  vehicles(ctx, S);
  if (term) {
    terminalDetails(ctx, term, mainB.p);
    landside(ctx, term.userData.kotu + 0.6, lod);
  }
  fixedLinks(ctx);
  towers(ctx);
  hangarDoors(ctx);
  cargo(ctx, lod);
  apronMasts(ctx, lod);

  let fr = 0;
  ctx.tick = (cam) => {
    if ((++fr & 15) !== 1) return;
    for (const [o, x, y, r] of lod) if (o) o.visible = Math.hypot(d.x + x - cam.x, d.y + y - cam.y, Math.max(0, cam.h - d.elev) * 0.6) < r;
  };
}

// ---------- üst üste binen park etmiş uçakları ayıkla (gövde ve kanat dikdörtgenleri, ayrık eksen sınaması) ----------
function rects(a) {
  const sc = a.sc, hx = a.hx, hy = a.hy;
  return [[a.x, a.y, hx, hy, a.L / 2 + 1, 2.4 * sc + 1], [a.x - hx * 2 * sc, a.y - hy * 2 * sc, hx, hy, 4.5 * sc, 17.5 * sc + 1.5]];
}
function rr(A, B) {
  for (const [ux, uy] of [[A[2], A[3]], [-A[3], A[2]], [B[2], B[3]], [-B[3], B[2]]]) {
    const pr = (R) => Math.abs(R[2] * ux + R[3] * uy) * R[4] + Math.abs(-R[3] * ux + R[2] * uy) * R[5];
    if (Math.abs((B[0] - A[0]) * ux + (B[1] - A[1]) * uy) > pr(A) + pr(B)) return false;
  }
  return true;
}
function declutter(ctx, pick) {
  const ms = ctx.grp.children.filter((o) => o.isInstancedMesh && (o.name === 'ucaklar' || o.name === 'ucak-kuyruk'));
  if (!pick || !pick.length || !ms.length) return;
  const kept = [], keep = [];
  const order = pick.map((s, i) => [s, i]).sort((a, b) => (b[0].gate ? 1 : 0) - (a[0].gate ? 1 : 0));
  for (const [s, i] of order) {
    const R = rects(s.ac);
    if (kept.some((Q) => Q.some((q) => R.some((r) => rr(q, r))))) { delete s.ac; continue; }
    kept.push(R); keep.push(i);
  }
  keep.sort((a, b) => a - b);
  // kalanları başa topla, sayıyı düşür (boş örnek çizilmesin)
  const mx = new THREE.Matrix4(), c = new THREE.Color();
  for (const m of ms) {
    keep.forEach((src, dst) => { m.getMatrixAt(src, mx); m.setMatrixAt(dst, mx); if (m.instanceColor) { m.getColorAt(src, c); m.setColorAt(dst, c); } });
    m.count = keep.length; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }
}

// ---------- kapılardaki uçaklar: OSM'de terminal apronunda park çizgisi yok; hareketli köprünün ucuna burnu içeride ----------
function gateAircraft(ctx, S) {
  const { d } = ctx;
  const ends = [];
  for (const k of d.kopru) {
    const a = k[0], b = k[k.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 9 || Math.hypot(a[0] - b[0], a[1] - b[1]) > 60) continue;
    // terminale uzak uç kapı ucudur
    const da = Math.hypot(a[0] - C[0], a[1] - C[1]), db = Math.hypot(b[0] - C[0], b[1] - C[1]);
    ends.push(db > da ? { e: b, s: a } : { e: a, s: b });
  }
  if (!ends.length) return;
  const G = airlinerGeoms(), list = [];
  const o = new THREE.Object3D();
  for (const { e, s } of ends) {
    const h0 = hsh(e[0], e[1]); if (h0 > 0.86) continue;
    let hx = C[0] - e[0], hy = C[1] - e[1]; const l = Math.hypot(hx, hy); hx /= l; hy /= l;   // burun terminale
    const lx = -hy, ly = hx;
    let gap = 1e9; for (const q of ends) if (q.e !== e) gap = Math.min(gap, Math.hypot(q.e[0] - e[0], q.e[1] - e[1]));
    const sc = gap > 62 && h0 < 0.3 ? 1.6 : 1.0;
    const side = (s[0] - e[0]) * lx + (s[1] - e[1]) * ly >= 0 ? 1 : -1;     // köprü uçağın solunda olmalı
    const dx = e[0] - lx * side * 1.8, dy = e[1] - ly * side * 1.8;          // ön sol kapı
    const nx = dx + hx * 6 * sc - lx * side * 2.1 * sc, ny = dy + hy * 6 * sc - ly * side * 2.1 * sc;
    const L = G.len * sc, cx = nx - hx * L / 2, cy = ny - hy * L / 2;
    list.push({ cx, cy, hx, hy, sc, L });
    S.push({ x: nx + hx * 2, y: ny + hy * 2, ux: hx, uy: hy, gate: true, space: gap, ac: { x: cx, y: cy, hx, hy, L, sc } });
  }
  if (!list.length) return;
  const bm = new THREE.InstancedMesh(G.body, ctx.M.body, list.length), tm = new THREE.InstancedMesh(G.tail, ctx.M.body, list.length);
  const c = new THREE.Color();
  list.forEach((a, i) => {
    o.position.set(a.cx, 0.12, -a.cy); o.rotation.set(0, Math.atan2(a.hy, a.hx), 0); o.scale.set(a.sc, a.sc, a.sc); o.updateMatrix();
    bm.setMatrixAt(i, o.matrix); tm.setMatrixAt(i, o.matrix);
    c.setHex(TAILS[Math.floor(hsh(a.cx + 3, a.cy) * TAILS.length)]); tm.setColorAt(i, c);
  });
  for (const m of [bm, tm]) { m.computeBoundingSphere(); m.matrixAutoUpdate = false; ctx.grp.add(m); }
  bm.name = 'ucaklar'; tm.name = 'ucak-kuyruk';
}

// ---------- terminal süsleri (terminal grubunun içinde) ----------
function terminalDetails(ctx, term, P) {
  const { M } = ctx;
  const h = term.userData.yukseklik, base = term.userData.kotu, fl = term.userData.katYuksekligi;
  const w = new CB(), gl = new GB(); gl.uv = [];
  // kat bantları (dışa taşan beyaz alın)
  const Pin = inflate(P, 0.35);
  w.c = WHITE;
  for (let z = fl; z < h - base - 2.5; z += fl) w.prism(Pin, base + z - 0.2 + 0.6, base + z + 0.7 + 0.6, false);
  w.prism(inflate(P, 0.35), base + 0.6, base + 1.2, false);
  // çatı: saçağın üstünde alın bandı (parapet) ve ışıklık ızgarası (C merkezli yaylar boyunca kare ışıklıklar)
  w.c = [0.75, 0.76, 0.78];
  w.prism(inflate(P, 3.2), h + 1.2, h + 2.4, false);
  const roofTop = h + 1.6;
  for (let r = RC - 18; r > 520; r -= 17) {
    const n = Math.floor((r * (150 - 86) * D) / 19);
    for (let k = 0; k <= n; k++) {
      const a = 86 + (150 - 86) * k / n, [x, y] = pol(C, r, a);
      if (!pip(P, x, y) || nearestEdge(P, x, y).d < 9) continue;
      if (Math.abs(r - (RC - 70)) < 10) continue;          // ana ışıklık bandı orada
      const ang = (a + 90) * D;
      w.c = WHITE; w.box(x, y, roofTop, 7.6, 7.6, 0.5, ang);
      gl.box(x, y, roofTop + 0.5, 6.4, 6.4, 0.9, ang);
    }
  }
  // ana ışıklık: hava cephesine paralel, yay boyunca sürekli (kademeli iki kat)
  const r0 = RC - 74, r1 = RC - 66;
  let a0 = 180, a1 = 0;
  for (let a = 84; a < 156; a += 0.5) { const [x, y] = pol(C, (r0 + r1) / 2, a); if (pip(P, x, y) && nearestEdge(P, x, y).d > 6) { a0 = Math.min(a0, a); a1 = Math.max(a1, a); } }
  if (a1 > a0) {
    w.c = WHITE; w.prism(sector(C, r0 - 1.2, r1 + 1.2, a0, a1, 1), roofTop, roofTop + 0.6, true);
    gl.prism(sector(C, r0, r1, a0, a1, 1), roofTop + 0.6, roofTop + 3.0, true);
    w.c = WHITE; for (let a = a0; a <= a1; a += 2.5) { const [x, y] = pol(C, (r0 + r1) / 2, a); w.box(x, y, roofTop + 3.0, 0.5, r1 - r0 + 1, 0.35, a * D); }
  }
  // çatı makine odaları
  w.c = [0.55, 0.57, 0.6];
  for (const [r, a, lw, ld] of [[RC - 105, 100, 22, 10], [RC - 105, 118, 26, 10], [RC - 100, 132, 18, 9], [RC - 40, 108, 14, 8]]) {
    const [x, y] = pol(C, r, a); if (pip(P, x, y)) w.box(x, y, roofTop, lw, ld, 2.6, (a + 90) * D);
  }
  // kara cephesi: dikey kanatlar ve geniş saçak (L merkezli), ağaç sütunlar
  w.c = [0.86, 0.87, 0.88];
  for (let a = 88; a <= 139; a += 1.15) { const [x, y] = pol(L, RL - 0.6, a); if (nearestEdge(P, x, y).d < 3) w.box(x, y, base + 1.2, 0.35, 1.4, h - 1.2 - base, a * D); }
  w.c = [0.78, 0.79, 0.8];
  w.prism(sector(L, RL - 30, RL + 2, 87, 140, 1), h + 0.2, h + 1.6, true, true);
  w.c = [0.7, 0.72, 0.74];
  w.prism(sector(L, RL - 30.6, RL - 29.4, 87, 140, 1), h - 0.6, h + 1.9, false);
  w.c = [0.9, 0.9, 0.9];
  for (let a = 89; a <= 138; a += 3.2) {
    const [x, y] = pol(L, RL - 28.5, a), g0 = ctx.gh(x, y) - 0.5;
    w.lathe(x, y, [[0.55, 0], [0.45, h - 4 - g0], [1.6, h - 1 - g0], [2.4, h + 0.2 - g0]], 8, g0);
  }
  const lw = mesh(w, mats().col, 'cephe-ayrinti'), lg = glassMesh(gl, M, 'isiklik');
  if (lw) term.add(lw); if (lg) term.add(lg);
}

// ---------- kara tarafı: viyadük, yollar, otopark, ağaçlar ----------
function landside(ctx, g0, lod) {
  const { gh } = ctx;
  const MM = mats();
  const con = new CB(), road = new CB(), mark = new CB();
  const H = g0 + 9.0;                                         // gidiş katı (terminalin 2. katı)
  // viyadük: 87°–138° arası yay, iki uçta içe kıvrılarak inen rampalar
  const vr = (a) => (a > 138 ? 473 - 46 * (a - 138) / 34 : a < 87 ? 473 - 46 * (87 - a) / 31 : 473);
  const vh = (a, x, y) => {
    const f = a > 138 ? (a - 138) / 34 : a < 87 ? (87 - a) / 31 : 0;
    const e = f * f * (3 - 2 * f);
    return Math.max(gh(x, y) + 0.3, H * (1 - e) + (gh(x, y) + 0.3) * e);
  };
  const vp = arc(L, vr, 172, 56, 1).map(([x, y], i, A) => { const a = 172 - (116 * i) / (A.length - 1); return [x, y, vh(a, x, y)]; });
  const V = resample(vp, 6);
  con.c = CONC; slab(con, V, 16, 1.5);
  con.c = [0.7, 0.69, 0.66];
  for (const s of [-1, 1]) slab(con, V.map((p) => [p[0], p[1], p[2] + 1.1]), 0.45, 1.1, s * 7.8);
  road.c = ASPH; ribbon(road, V, 14.6, 0, 0.02);
  mark.c = LINE; for (const s of [-1, 1]) ribbon(mark, V, 0.18, s * 6.6, 0.05); dashes(mark, V, 0.15, 0, 3, 6, 0.05);
  // ayaklar (çekiç başlı)
  const F = frames(V);
  for (let i = 2; i < V.length - 2; i += 4) {
    const [x, y, top] = V[i], gg = gh(x, y); if (top - gg < 3.5) continue;
    const ang = Math.atan2(F[i][1], F[i][0]);
    con.c = CONC; con.box(x, y, gg - 1, 1.6, 2.6, top - 1.5 - 0.9 - gg + 1, ang + Math.PI / 2);
    con.box(x, y, top - 1.5 - 0.9, 12, 2.2, 0.9, ang);
  }
  // terminal önünde kaldırım (gidiş katında)
  con.c = [0.6, 0.6, 0.58];
  const curb = arc(L, RL - 5.5, 139, 87, 1).map(([x, y]) => [x, y, H + 0.25]);
  slab(con, curb, 9, 0.25 + 1.5);
  // zemin yolları: geliş yolu (viyadüğün altında), çevre yolu, şehir yolu, bağlantılar
  const gr = (pts) => resample(pts, 8).map(([x, y]) => [x, y, gh(x, y) + 0.06]);
  const roads = [
    [gr(arc(L, 472, 154, 72, 1)), 22, 2],
    [gr(arc(L, 420, 186, 50, 1)), 15, 1],
    [gr([[...pol(L, 472, 154), 0], [...pol(L, 420, 168), 0]]), 12, 1],
    [gr([[...pol(L, 472, 72), 0], [...pol(L, 420, 58), 0]]), 12, 1],
  ];
  const e = pol(L, 420, 186), ux = -0.551, uy = -0.835;
  roads.push([gr([[e[0], e[1], 0], [e[0] + ux * 120 + 40, e[1] + uy * 120, 0], [e[0] + ux * 760 + 40, e[1] + uy * 760, 0]]), 19, 2]);
  // kaldırım: terminal cephesi önünde zeminde
  const walk = gr(arc(L, RL - 6, 139, 87, 1));
  con.c = [0.5, 0.5, 0.48]; slab(con, walk.map((p) => [p[0], p[1], p[2] + 0.22]), 10, 0.5);
  for (const [pts, w, lanes] of roads) {
    road.c = ASPH; ribbon(road, pts, w, 0, 0);
    mark.c = LINE; for (const s of [-1, 1]) ribbon(mark, pts, 0.18, s * (w / 2 - 0.7), 0.03);
    if (lanes === 2) { mark.c = LINEY; for (const s of [-1, 1]) ribbon(mark, pts, 0.15, s * 0.25, 0.03); mark.c = LINE; for (const s of [-1, 1]) dashes(mark, pts, 0.15, s * w / 4, 3, 6, 0.03); }
    else dashes(mark, pts, 0.15, 0, 3, 6, 0.03);
  }
  // katlı otopark (yay biçimli, zemin + 2 kat + açık çatı katı)
  const pr0 = 300, pr1 = 398, pa0 = 100, pa1 = 131;
  const PP = sector(L, pr0, pr1, pa0, pa1, 1.5);
  const pb = Math.min(...PP.map(([x, y]) => gh(x, y))) - 0.3;
  const lv = [pb + 0.3, pb + 3.4, pb + 6.5, pb + 9.6];
  con.c = [0.62, 0.61, 0.58];
  con.prism(PP, pb - 0.5, lv[0], true);
  for (let k = 1; k < 4; k++) {
    con.c = [0.6, 0.59, 0.56]; con.prism(PP, lv[k] - 0.4, lv[k], true, true);
    con.c = [0.72, 0.71, 0.68];
    con.prism(sector(L, pr1 - 0.3, pr1, pa0, pa1, 1.5), lv[k], lv[k] + 1.1, true);
    con.prism(sector(L, pr0, pr0 + 0.3, pa0, pa1, 1.5), lv[k], lv[k] + 1.1, true);
    con.prism(sector(L, pr0, pr1, pa0, pa0 + 0.06, 1), lv[k], lv[k] + 1.1, true);
    con.prism(sector(L, pr0, pr1, pa1 - 0.06, pa1, 1), lv[k], lv[k] + 1.1, true);
    con.c = [0.5, 0.36, 0.2]; con.prism(sector(L, pr1 - 0.32, pr1 + 0.02, pa0, pa1, 1.5), lv[k] - 0.4 - 0.5, lv[k] - 0.4, false);   // alın bandı (bakır tonu)
  }
  con.c = [0.66, 0.65, 0.62];
  for (let r = pr0 + 1; r < pr1; r += 8) for (let a = pa0 + 0.6; a < pa1; a += 8 / r / D) { const [x, y] = pol(L, r, a); con.box(x, y, lv[0], 0.6, 0.6, lv[3] - 0.4 - lv[0], a * D); }
  // merdiven / asansör kuleleri ve terminale yaya köprüleri
  const gl = new GB(); gl.uv = [];
  for (const a of [104, 115.5, 127]) {
    const [x, y] = pol(L, pr1 - 6, a);
    con.c = [0.8, 0.8, 0.8]; con.box(x, y, lv[3], 8.6, 8.6, 3.4, a * D); con.box(x, y, lv[3] + 3.4, 9.4, 9.4, 0.5, a * D);
    gl.box(x, y, lv[0], 8, 8, lv[3] - lv[0], a * D);
    // yaya köprüsü: otoparktan gidiş katına (viyadüğün üstünden)
    const [x2, y2] = pol(L, (pr1 + RL) / 2 - 0.5, a), len = RL - pr1 - 1;
    con.c = WHITE; con.box(x2, y2, H + 6.2, len, 4.6, 0.6, a * D); con.box(x2, y2, H + 9.6, len, 4.8, 0.5, a * D);
    gl.box(x2, y2, H + 6.8, len, 4.2, 2.8, a * D);
    for (const t of [-0.25, 0.25]) { const [x3, y3] = pol(L, (pr1 + RL) / 2 - 0.5 + t * len, a); con.box(x3, y3, gh(x3, y3) - 0.5, 0.9, 0.9, H + 6.2 - gh(x3, y3) + 0.5, a * D); }
  }
  ctx.solid = ctx.solid || [];
  ctx.solid.push({ P: PP, top: lv[3] + 1.1, ad: 'Otopark' });
  // arabalar: otopark çatısı ve açık otopark
  const cars = [], trees = [];
  const park = (r0, r1, a0, a1, h, fill, row = 6) => {
    for (let r = r0 + 3; r < r1 - 2; r += row) for (let a = a0 + 0.3; a < a1; a += 2.6 / r / D) {
      const [x, y] = pol(L, r, a); if (hsh(x, y) > fill) continue;
      cars.push([x, y, h == null ? gh(x, y) + 0.05 : h, a * D + (hsh(y, x) < 0.5 ? 0 : Math.PI), CARCOL[Math.floor(hsh(x + 1, y) * CARCOL.length)]]);
    }
  };
  park(pr0, pr1, pa0 + 0.6, pa1 - 0.6, lv[3], 0.55, 7.5);
  park(180, 285, 94, 137, null, 0.72, 7.5);
  const lotP = resample(arc(L, 232, 137, 94, 1), 8).map(([x, y]) => [x, y, gh(x, y) + 0.04]);
  ribbon(road, lotP, 108, 0, 0);
  for (let r = 186; r < 282; r += 7.5) { mark.c = LINE; ribbon(mark, resample(arc(L, r, 137, 94, 1), 8).map(([x, y]) => [x, y, gh(x, y) + 0.08]), 0.12, 0, 0); }
  // kaldırımdaki arabalar ve otobüsler (gidiş katında)
  for (let a = 90; a < 137; a += 1.3) {
    if (hsh(a, 3) > 0.45) continue;
    const [x, y] = pol(L, 470.5, a); const big = hsh(a, 7) < 0.18;
    cars.push([x, y, H + 0.02, (a + 90) * D, big ? [0.85, 0.85, 0.82] : CARCOL[Math.floor(hsh(a, 9) * CARCOL.length)], big ? 2.6 : 1]);
  }
  // ağaçlar: çevre yolunun iki yanında ve otopark aralarında
  for (let a = 52; a < 184; a += 1.6) for (const r of [404, 437]) {
    const [x, y] = pol(L, r + (hsh(a, r) - 0.5) * 3, a); if (r === 437 && (a > 136 || a < 89)) continue;
    trees.push([x, y, gh(x, y) - 0.3, hsh(a, r) * 6, [1, 1, 1], 0.8 + hsh(r, a) * 0.5]);
  }
  for (let a = 94; a < 138; a += 2.2) { const [x, y] = pol(L, 292, a); trees.push([x, y, gh(x, y) - 0.3, a, [1, 1, 1], 0.9]); }
  // çim adalar
  const grass = new CB(); grass.c = GRASS;
  ribbon(grass, resample(arc(L, 444, 182, 56, 1), 8).map(([x, y]) => [x, y, gh(x, y) + 0.03]), 34, 0, 0);
  ribbon(grass, resample(arc(L, 292, 137, 94, 1), 8).map(([x, y]) => [x, y, gh(x, y) + 0.03]), 9, 0, 0);
  // sokak lambaları (çevre yolunda)
  const lamp = new CB();
  for (let a = 52; a < 184; a += 3) {
    const [x, y] = pol(L, 411, a), gg = gh(x, y);
    con.c = STEEL; con.box(x, y, gg - 0.3, 0.22, 0.22, 10.3, 0); con.box(...pol(L, 412.5, a), gg + 9.7, 3, 0.2, 0.2, a * D);
    lamp.c = [1, 1, 1]; lamp.box(...pol(L, 414, a), gg + 9.45, 0.8, 0.4, 0.2, a * D);
  }
  const roadM = mesh(road, MM.road, 'yol', 2), markM = mesh(mark, MM.mark, 'yol-cizgi', 3), grassM = mesh(grass, MM.road, 'cim', 1);
  const conM = mesh(con, MM.col, 'beton');
  const glM = glassMesh(gl, ctx.M, 'cam');
  const carM = instanced(carGeom(), cars, 'arabalar'), treeM = instanced(treeGeom(), trees, 'agaclar');
  const lampM = mesh(lamp, MM.lamp, 'lambalar');
  ctx.part('viyaduk-otopark', group('viyaduk-otopark', [roadM, markM, grassM, conM, glM, carM, treeM, lampM]));
  lod.push([carM, -300, -1250, 2400], [treeM, -300, -1250, 3200], [markM, -300, -1250, 4000], [lampM, -300, -1250, 3000]);
  addCol(ctx, { x: ctx.d.x + pol(L, 350, 115)[0], y: ctx.d.y + pol(L, 350, 115)[1], r: 45, top: ctx.d.elev + lv[3] + 1 });
}

// ---------- sabit yolcu köprüleri (OSM köprü tabanlarından) ----------
function fixedLinks(ctx) {
  const { d, gh, M } = ctx;
  const w = new CB(), gl = new GB(); gl.uv = [];
  for (const k of d.kopru) {
    if (k.length < 4) continue;
    const a = k[0], b = k[k.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 9) continue;
    const o = obbOf(k); if (o.L < 10 || o.L > 80) continue;
    const wd = Math.min(Math.max(o.Wd, 3.6), 5), g0 = gh(o.cx, o.cy);
    w.c = [0.74, 0.76, 0.78]; w.box(o.cx, o.cy, g0 + 4.2, o.L, wd, 0.8, o.ang); w.box(o.cx, o.cy, g0 + 6.9, o.L, wd + 0.3, 0.5, o.ang);
    gl.box(o.cx, o.cy, g0 + 5.0, o.L - 0.2, wd - 0.3, 1.9, o.ang);
    w.c = STEEL;
    for (let t = -o.L / 2 + 6; t < o.L / 2 - 2; t += 12) for (const s of [-1, 1]) {
      const x = o.cx + o.c * t - o.s * s * (wd / 2 - 0.4), y = o.cy + o.s * t + o.c * s * (wd / 2 - 0.4);
      w.box(x, y, gh(x, y) - 0.3, 0.45, 0.45, 4.5, o.ang);
    }
  }
  const lw = mesh(w, mats().col, 'sabit-kopru'), lg = glassMesh(gl, M, 'sabit-kopru-cam');
  ctx.grp.add(group('sabit-kopruler', [lw, lg]));
}

// ---------- kuleler ----------
function towers(ctx) {
  const { d, gh, M } = ctx;
  const tw = d.bina.filter((b) => b.t === 'tower').sort((a, b) => b.h - a.h);
  const main = tw[0];
  const [x, y] = main ? centroid(main.p) : [149, -335];
  const H = main ? Math.max(70, main.h) : 77;
  const base = gh(x, y) - 0.5;
  const w = new CB(), cab = new GB(), gl = new GB(); gl.uv = [];
  const rot = 33 * D;                                       // mercek ekseni pistlere paralel
  // hizmet binası: OSM tabanı, iki kat, cam bant
  if (main) {
    const P = main.p;
    w.c = [0.8, 0.8, 0.78]; w.prism(P, base, base + 1.2, false); w.prism(inflate(P, 1.2), base + 8.6, base + 9.6, true);
    w.c = [0.74, 0.74, 0.72]; w.prism(inflate(P, 0.3), base + 4.7, base + 5.3, false);
    gl.prism(P, base + 1.2, base + 8.6, false);
    ctx.solid = ctx.solid || []; ctx.solid.push({ P, top: 9.6, ad: 'Kule binası' });
  }
  // gövde: mercek kesit, yukarıda incelir
  w.c = [0.86, 0.86, 0.85];
  const top = base + H - 17;
  loft(w, x, y, rot, [[base, 9.5, 4.6], [base + 10, 9.2, 4.6], [base + 40, 8.0, 4.6], [top, 7.0, 4.6]], 28);
  // iki uçta kaburgalar (yukarı doğru inceler)
  for (const s of [-1, 1]) {
    const pts = (A, wd) => { const cx = x + Math.cos(rot) * s * A, cy = y + Math.sin(rot) * s * A; return [cx, cy, wd]; };
    for (const [h0, h1, A, wd] of [[base, base + 30, 10.4, 1.4], [base + 30, top + 3, 8.6, 1.1]]) {
      const [cx, cy] = pts(A, wd); w.box(cx, cy, h0, 3.2, wd, h1 - h0, rot);
    }
  }
  // dikey cam yarıklar (asansör), iki düz yüzde
  for (const s of [-1, 1]) { const cx = x - Math.sin(rot) * s * 4.45, cy = y + Math.cos(rot) * s * 4.45; gl.box(cx, cy, base + 10, 2.0, 0.5, top - base - 12, rot); }
  // boyun, teknik kat, yürüme halkası, kabin, çatı, radom, anten
  w.c = [0.88, 0.88, 0.87];
  w.lathe(x, y, [[6.5, 0], [8.2, 2], [11.2, 5.4], [11.6, 6]], 16, top);
  w.c = DARK; w.lathe(x, y, [[11.0, 6], [11.0, 9.2]], 16, top);
  w.c = [0.7, 0.7, 0.7]; w.lathe(x, y, [[10.8, 9.2], [13.4, 9.2], [13.4, 9.7], [10.8, 9.7]], 16, top);
  cab.lathe(x, y, [[11.0, 9.7], [12.9, 15.6]], 12, top);
  w.c = [0.35, 0.37, 0.4]; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; w.box(x + Math.cos(a) * 12.0, y + Math.sin(a) * 12.0, top + 9.7, 0.3, 0.3, 5.9, a); }
  w.c = [0.9, 0.9, 0.9];
  w.lathe(x, y, [[13.8, 15.6], [14.2, 16.3], [14.2, 16.9], [10, 17.5], [5, 17.9], [0.05, 18.0]], 16, top);
  w.lathe(x, y, [[0.05, 18.0], [1.4, 18.4], [1.8, 19.6], [1.2, 20.8], [0.05, 21.1]], 10, top);
  w.c = [0.85, 0.2, 0.15]; w.box(x + 5, y, top + 17.6, 0.25, 0.25, 9, 0); w.box(x - 4, y + 2, top + 17.6, 0.2, 0.2, 6, 0);
  const grp = group('kule', [mesh(w, mats().col, 'govde'), mesh(cab, M.cab, 'kabin'), glassMesh(gl, M, 'cam')]);
  ctx.part('kule', grp);
  addCol(ctx, { x: d.x + x, y: d.y + y, r: 12, top: d.elev + base + H + 2 });
  // eski kule: silindir gövde, sekizgen kabin
  const old = tw.find((b) => b !== main);
  if (old) {
    const [ox, oy] = centroid(old.p), Ho = Math.max(30, old.h), ob = gh(ox, oy) - 0.5;
    const w2 = new CB(), c2 = new GB();
    w2.c = [0.78, 0.76, 0.72];
    w2.lathe(ox, oy, [[4.4, 0], [3.6, Ho - 10]], 12, ob);
    w2.lathe(ox, oy, [[3.6, Ho - 10], [6.8, Ho - 8], [6.8, Ho - 6.5]], 8, ob);
    w2.c = [0.9, 0.9, 0.88]; w2.box(ox, oy, ob, 14, 10, 6, rot);
    c2.lathe(ox, oy, [[6.2, Ho - 6.5], [7.2, Ho - 1.2]], 8, ob);
    w2.c = [0.8, 0.8, 0.8]; w2.lathe(ox, oy, [[7.6, Ho - 1.2], [7.6, Ho - 0.4], [2, Ho], [0.05, Ho + 0.3]], 8, ob);
    ctx.part('kule:eski', group('kule:eski', [mesh(w2, mats().col, 'govde'), mesh(c2, M.cab, 'kabin')]));
    addCol(ctx, { x: d.x + ox, y: d.y + oy, r: 7, top: d.elev + ob + Ho });
  }
}

// ---------- hangar kapıları: aprona / taksi yoluna bakan uzun kenarda teleskopik kapı ----------
function hangarDoors(ctx) {
  const { d, gh } = ctx;
  const w = new CB(), seen = new Set();
  const paved = [];
  for (const t of d.twy) for (const p of t.p) paved.push(p);
  for (const a of d.apron) for (const p of a[0]) paved.push(p);
  for (const b of d.bina) {
    if (b.t !== 'hangar') continue;
    const key = Math.round(b.p[0][0]) + ':' + Math.round(b.p[0][1]); if (seen.has(key)) continue; seen.add(key);
    const o = obbOf(b.p), ux = o.c, uy = o.s, vx = -uy, vy = ux;
    let best = null;
    for (const [nx, ny, half, len] of [[vx, vy, o.Wd / 2, o.L], [-vx, -vy, o.Wd / 2, o.L], [ux, uy, o.L / 2, o.Wd], [-ux, -uy, o.L / 2, o.Wd]]) {
      const mx = o.cx + nx * half, my = o.cy + ny * half;
      let m = 1e9; for (const p of paved) m = Math.min(m, Math.hypot(p[0] - mx, p[1] - my) + 0 * len);
      const score = m - len * 0.3;
      if (!best || score < best.s) best = { s: score, nx, ny, half, len, mx, my };
    }
    const g0 = Math.min(...b.p.map(([x, y]) => gh(x, y))) - 0.5;
    const wallH = b.h * 0.72, doorH = Math.min(wallH - 1.6, 16), dw = best.len * 0.86;
    const ang = Math.atan2(best.nx, -best.ny);       // kapı boyunca doğrultu
    const n = Math.max(3, Math.round(dw / 9)), lw = dw / n;
    for (let k = 0; k < n; k++) {
      const t = -dw / 2 + lw * (k + 0.5), off = 0.35 + (k % 2) * 0.45;
      const x = best.mx + best.nx * off + Math.cos(ang) * t, y = best.my + best.ny * off + Math.sin(ang) * t;
      w.c = k % 2 ? CLAD : CLAD2; w.box(x, y, g0, lw - 0.15, 0.4, doorH - g0 + 0.5, ang);
      w.c = [0.25, 0.3, 0.36]; w.box(x, y, doorH * 0.62, lw - 0.6, 0.5, 1.1, ang);    // pencere bandı
    }
    w.c = [0.3, 0.32, 0.36]; w.box(best.mx + best.nx * 0.5, best.my + best.ny * 0.5, doorH, best.len, 0.8, wallH - doorH + 0.1, ang);
    for (const s of [-1, 1]) { w.c = [0.8, 0.82, 0.84]; w.box(best.mx + best.nx * 0.6 + Math.cos(ang) * s * (dw / 2 + 0.6), best.my + best.ny * 0.6 + Math.sin(ang) * s * (dw / 2 + 0.6), g0, 1.2, 1.2, wallH - g0, ang); }
  }
  const m = mesh(w, mats().col, 'hangar-kapi');
  if (m) ctx.grp.add(m);
}

// ---------- kargo: küçük apronun yanında kargo binası, tır rampaları, konteynerler, kargo uçağı ----------
function cargo(ctx, lod) {
  const { d, gh, M } = ctx;
  // kargo apronu: (285, 263)–(391, 314) çevresindeki dikdörtgen apron
  const ap = d.apron.map((a) => a[0]).find((r) => { const [cx, cy] = centroid(r); return Math.hypot(cx - 338, cy - 288) < 40; });
  if (!ap) return;
  const o = obbOf(ap);
  const [acx, acy] = centroid(ap);
  // uzun kenarlardan taksi yollarından uzak olanı seç
  const ux = Math.cos(o.ang), uy = Math.sin(o.ang), long = o.L >= o.Wd;
  const ax = long ? ux : -uy, ay = long ? uy : ux;           // uzun eksen
  const nx = -ay, ny = ax, half = (long ? o.Wd : o.L) / 2, len = long ? o.L : o.Wd;
  let side = 1, bestD = -1;
  for (const s of [-1, 1]) { const x = acx + nx * s * (half + 30), y = acy + ny * s * (half + 30); let m = 1e9; for (const t of d.twy) m = Math.min(m, segDist(t.p, x, y) - t.w / 2); if (m > bestD) { bestD = m; side = s; } }
  const depth = 42, bl = Math.min(len + 10, 120), bh = 14;
  const bx = acx + nx * side * (half + 3 + depth / 2), by = acy + ny * side * (half + 3 + depth / 2);
  const ang = Math.atan2(ay, ax);
  const corner = (u, v) => [bx + ax * u + nx * side * v, by + ay * u + ny * side * v];
  const P = [corner(-bl / 2, -depth / 2), corner(bl / 2, -depth / 2), corner(bl / 2, depth / 2), corner(-bl / 2, depth / 2)];
  if (side < 0) P.reverse();
  const g0 = Math.min(...P.map(([x, y]) => gh(x, y))) - 0.5;
  const w = new CB(), gl = new GB(); gl.uv = [];
  w.c = [0.72, 0.74, 0.76]; w.prism(P, g0, bh, true);
  w.c = [0.6, 0.62, 0.65]; w.prism(inflate(P, 0.5), bh, bh + 1.2, true);
  // dikey kaplama nervürleri
  w.c = [0.64, 0.66, 0.69];
  for (let u = -bl / 2 + 3; u < bl / 2; u += 3) for (const v of [-depth / 2 - 0.15, depth / 2 + 0.15]) { const [x, y] = corner(u, v); w.box(x, y, g0 + 1, 0.3, 0.3, bh - g0 - 1, ang); }
  // apron tarafı: büyük kapılar; kara tarafı: tır rampaları
  for (let u = -bl / 2 + 10; u < bl / 2 - 6; u += 16) {
    const [x, y] = corner(u, -depth / 2 - 0.3); w.c = [0.3, 0.33, 0.38]; w.box(x, y, g0, 11, 0.5, 7.5 - g0, ang);
  }
  const trucks = [];
  for (let u = -bl / 2 + 5; u < bl / 2 - 4; u += 4.6) {
    const [x, y] = corner(u, depth / 2 + 0.3); w.c = [0.22, 0.24, 0.27]; w.box(x, y, g0 + 0.6, 3.2, 0.5, 3.6, ang);
    const [x2, y2] = corner(u, depth / 2 + 1.4); w.c = [0.4, 0.4, 0.4]; w.box(x2, y2, gh(x2, y2) - 0.3, 3.4, 2.4, 1.5, ang);
    if (hsh(u, 2) < 0.55) {
      const [tx, ty] = corner(u, depth / 2 + 10); const tc = [[0.85, 0.85, 0.85], [0.1, 0.3, 0.6], [0.7, 0.12, 0.1], [0.9, 0.7, 0.1]][Math.floor(hsh(u, 5) * 4)];
      const tg = gh(tx, ty);
      w.c = [0.82, 0.83, 0.84]; w.box(tx, ty, tg + 1.1, 2.5, 13.6, 2.9, ang);
      const [cx2, cy2] = corner(u, depth / 2 + 18.6); w.c = tc; w.box(cx2, cy2, tg + 0.4, 2.5, 2.4, 3.0, ang);
      w.c = DARK; w.box(cx2, cy2, tg, 2.4, 2.2, 0.9, ang);
    }
  }
  // tır sahası
  const road = new CB(); road.c = PAVE;
  ribbon(road, resample([[...corner(-bl / 2, depth / 2 + 17), 0], [...corner(bl / 2, depth / 2 + 17), 0]], 10).map(([x, y]) => [x, y, gh(x, y) + 0.05]), 34, 0, 0);
  // ofis bloğu (camlı, 3 kat) bir uçta
  const [ox, oy] = corner(bl / 2 + 9, 0);
  w.c = WHITE; w.box(ox, oy, g0, 18, depth, 1, ang); w.box(ox, oy, 11.5, 18.6, depth + 0.6, 1, ang);
  gl.box(ox, oy, g0 + 1, 17.6, depth - 0.4, 11.5 - g0 - 1, ang);
  ctx.solid = ctx.solid || []; ctx.solid.push({ P, top: bh + 1.2, ad: 'Kargo binası' });
  // ULD konteynerleri ve dolly'ler apron kenarında
  const uld = new CB();
  for (let u = -len / 2 + 6; u < len / 2 - 6; u += 2.4) for (const v of [-half + 4, -half + 6.4]) {
    if (hsh(u, v) > 0.7) continue;
    const x = acx + ax * u + nx * side * -v, y = acy + ay * u + ny * side * -v;
    uld.c = hsh(v, u) < 0.8 ? [0.7, 0.72, 0.74] : [0.25, 0.32, 0.4];
    uld.box(x, y, 0.5, 1.9, 1.5, 1.6, ang);
    uld.c = DARK; uld.box(x, y, 0.1, 2.2, 1.7, 0.4, ang);
  }
  // kargo uçağı (büyük gövde, markasız)
  const G = airlinerGeoms();
  const bm = new THREE.InstancedMesh(G.body, M.body, 1), tm = new THREE.InstancedMesh(G.tail, M.body, 1);
  const ob = new THREE.Object3D(), sc = Math.min(1.4, (len - 8) / G.len);
  ob.position.set(acx - nx * side * 4, 0.12, -(acy - ny * side * 4)); ob.rotation.set(0, Math.atan2(ay, ax), 0); ob.scale.set(sc, sc, sc); ob.updateMatrix();
  bm.setMatrixAt(0, ob.matrix); tm.setMatrixAt(0, ob.matrix); tm.setColorAt(0, new THREE.Color(TAILS[3]));
  for (const m of [bm, tm]) { m.computeBoundingSphere(); m.matrixAutoUpdate = false; }
  bm.name = 'kargo-ucak'; tm.name = 'kargo-ucak-kuyruk';
  const uldM = mesh(uld, mats().col, 'konteyner');
  ctx.part('kargo', group('kargo', [mesh(w, mats().col, 'bina'), glassMesh(gl, M, 'cam'), mesh(road, mats().road, 'saha', 2), uldM, bm, tm]));
  lod.push([uldM, acx, acy, 3000], [bm, acx, acy, 7000], [tm, acx, acy, 7000]);
}

// ---------- apron ışık direkleri ----------
function apronMasts(ctx, lod) {
  const { d, gh } = ctx;
  const w = new CB(), lamp = new CB();
  const spots = [];
  const ac = (ctx.stands || []).filter((s) => s.ac).map((s) => s.ac);
  const kop = d.kopru;
  const ok = (x, y) => d.apron.some((a) => pip(a[0], x, y)) && twyClear(d, x, y, 9) && spots.every(([a, b]) => Math.hypot(a - x, b - y) > 90)
    && ac.every((q) => Math.hypot(q.x - x, q.y - y) > q.L * 0.55 + 8) && kop.every((k) => segDist(k, x, y) > 10);
  // terminal apronu: hava cephesinin önünde, uçak burunlarının arasında
  for (let a = 88; a <= 150; a += 1.5) for (const r of [RC + 22, RC + 34]) { const [x, y] = pol(C, r, a); if (ok(x, y)) { spots.push([x, y]); break; } }
  // diğer apronlar: kenar çizgisi boyunca
  for (const ap of d.apron) {
    const R = ap[0]; let per = 0; for (let i = 0; i < R.length; i++) per += Math.hypot(R[(i + 1) % R.length][0] - R[i][0], R[(i + 1) % R.length][1] - R[i][1]);
    if (per < 300) continue;
    for (let i = 0; i < R.length; i++) {
      const A = R[i], B = R[(i + 1) % R.length], Ls = Math.hypot(B[0] - A[0], B[1] - A[1]);
      for (let s = 40; s < Ls - 30; s += 120) {
        const t = s / Ls, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t;
        const [cx, cy] = centroid(R), l = Math.hypot(cx - x, cy - y) || 1, xi = x + (cx - x) / l * 6, yi = y + (cy - y) / l * 6;
        if (ok(xi, yi)) spots.push([xi, yi]);
      }
    }
  }
  for (const [x, y] of spots) {
    const g0 = gh(x, y) - 0.3, Hm = 30;
    w.c = [0.6, 0.62, 0.64]; w.lathe(x, y, [[0.9, 0], [0.45, Hm]], 8, g0);
    w.c = CONC; w.box(x, y, g0, 2.4, 2.4, 1.0, 0);
    w.c = [0.35, 0.37, 0.4]; w.box(x, y, g0 + Hm, 4.6, 1.2, 1.6, 0.6);
    lamp.c = [1, 1, 1]; lamp.box(x, y, g0 + Hm - 0.1, 4.2, 0.9, 0.12, 0.6);
  }
  const m1 = mesh(w, mats().col, 'direk'), m2 = mesh(lamp, mats().lamp, 'direk-lamba');
  const g = group('apron-direkleri', [m1, m2]);
  ctx.grp.add(g);
  lod.push([g, -400, -800, 8000]);
}
