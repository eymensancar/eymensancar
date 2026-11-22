// Antalya Havalimanı (LTAI, AYT). Terminaller OSM tabanlarından, her biri ayrı parça (ctx.parts 'terminal:<kimlik>'):
// Dış Hatlar Terminali 1 (rotunda kubbesi), Dış Hatlar Terminali 2 (dalgalı çatı, rotunda) ve batı kanadı, İç Hatlar
// Terminali, VIP, Genel Havacılık. Kat bantları, saçak kolonları, çatı makineleri, kara tarafı kanopileri.
// Ayrıca: kule (OSM, 77 m; kendi tasarımımız: eğik camlı kabin, kanatlı gövde, alt blok), kargo terminali (depo, yükleme
// kapıları, ULD konteynerleri, tır parkı), genel havacılık apronunun güneyinde iki büyük bakım hangarı, kara tarafı yolları,
// açık otoparklar ve iki katlı otoparklar (arabalar örneklenmiş), OSM'deki yolcu köprüleri (sabit koridor + teleskopik
// tünel + kabin), yoğun charter apronu (uzak park yerlerinde merdiven araçları, bagaj arabaları, bant yükleyiciler).
// Yerleşim pist eksenine hizalı bir (a, b) çerçevesinde: a pist boyunca kuzeye, b doğuya (m); boş alanlar OSM'ye göre denetlendi.
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, stands, standsAndAircraft } from '../havalimani.js';
import { terminal, pip, nearestEdge, vehicles } from './ortak.js';

const hash = (x, y) => { let h = Math.imul(Math.round(x * 7.3) ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(Math.round(y * 3.1) + 0x165667b1, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const ccw = (P) => (area2(P) < 0 ? P.slice().reverse() : P);

// ---------- yardımcılar ----------
let LM = null;   // bu modülün malzemeleri (bir kez)
function myMats() {
  if (LM) return LM;
  LM = {
    vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
    car: new THREE.MeshLambertMaterial({ vertexColors: true }),
    cladT2: new THREE.MeshLambertMaterial({ color: 0x8fb4cc }),     // T2 cephe paneli (açık mavi)
    deck: new THREE.MeshLambertMaterial({ color: 0xa9a7a1 }),
    cargoWall: new THREE.MeshLambertMaterial({ color: 0xb9c0c6 }),
    door: new THREE.MeshLambertMaterial({ color: 0x8c949b }),
  };
  return LM;
}
function colorFrom(gb, s, col) { const v = gb.a.color.v; for (let k = s; k < gb.count; k++) { v[k * 3] = col[0]; v[k * 3 + 1] = col[1]; v[k * 3 + 2] = col[2]; } }
// dörtgen yüz: köşeler (x, y, z yukarı) ve dışa normal; sarım normale göre düzeltilir
function face(gb, Q, n) {
  const s = gb.count;
  for (const [x, y, z] of Q) gb.vert(x, z, y, n[0], n[2], n[1]);
  const [a, b, c] = Q;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  // (x, y, z yukarı) -> three (X, Y, Z) = (x, z, -y) yönü korur: normale göre saat yönü tersi ön yüzdür
  if (cx * n[0] + cy * n[1] + cz * n[2] > 0) gb.quad(s, s + 1, s + 2, s + 3); else gb.quad(s, s + 3, s + 2, s + 1);
}
// iki 3B nokta arasında dikdörtgen kesitli kiriş (w yatay en, t dikey kalınlık)
function beam(gb, x0, y0, z0, x1, y1, z1, w, t) {
  let dx = x1 - x0, dy = y1 - y0, dz = z1 - z0; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
  let sx = -dy, sy = dx; const hl = Math.hypot(sx, sy); if (hl < 1e-4) { sx = 1; sy = 0; } else { sx /= hl; sy /= hl; }
  // yukarı = d x s
  let ux = dy * 0 - dz * sy, uy = dz * sx - dx * 0, uz = dx * sy - dy * sx; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  if (uz < 0) { ux = -ux; uy = -uy; uz = -uz; }
  const P = (e, i, j) => { const bx = e ? x1 : x0, by = e ? y1 : y0, bz = e ? z1 : z0; return [bx + sx * w / 2 * i + ux * t / 2 * j, by + sy * w / 2 * i + uy * t / 2 * j, bz + uz * t / 2 * j]; };
  face(gb, [P(0, -1, 1), P(1, -1, 1), P(1, 1, 1), P(0, 1, 1)], [ux, uy, uz]);
  face(gb, [P(0, -1, -1), P(0, 1, -1), P(1, 1, -1), P(1, -1, -1)], [-ux, -uy, -uz]);
  face(gb, [P(0, 1, -1), P(0, 1, 1), P(1, 1, 1), P(1, 1, -1)], [sx, sy, 0]);
  face(gb, [P(0, -1, -1), P(1, -1, -1), P(1, -1, 1), P(0, -1, 1)], [-sx, -sy, 0]);
  face(gb, [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)], [dx, dy, dz]);
  face(gb, [P(0, -1, -1), P(0, -1, 1), P(0, 1, 1), P(0, 1, -1)], [-dx, -dy, -dz]);
}
function mesh(gb, mat, name, ro = 0) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; m.renderOrder = ro; return m; }
function group(name, list) { const g = new THREE.Group(); g.name = name; g.matrixAutoUpdate = false; for (const [gb, mat, nm, ro] of list) if (gb.count) g.add(mesh(gb, mat, nm, ro)); return g; }

// ---------- kurulum ----------
export function build(ctx) {
  const { d, M, gh, W } = ctx;
  const L = myMats();
  // pist eksenine hizalı çerçeve (a kuzeye pist boyunca, b doğuya)
  const r0 = d.rws[0], rl = Math.hypot(r0.b[0] - r0.a[0], r0.b[1] - r0.a[1]);
  const ux = (r0.b[0] - r0.a[0]) / rl * Math.sign(r0.b[1] - r0.a[1] || 1), uy = (r0.b[1] - r0.a[1]) / rl * Math.sign(r0.b[1] - r0.a[1] || 1);
  const nx = uy, ny = -ux, ANG = Math.atan2(uy, ux);
  const XY = (a, b) => [ux * a + nx * b, uy * a + ny * b];
  const rect = (a0, a1, b0, b1) => ccw([XY(a0, b0), XY(a0, b1), XY(a1, b1), XY(a1, b0)]);
  const boxAB = (gb, a, b, h0, la, lb, hh) => { const [x, y] = XY(a, b); gb.box(x, y, h0, la, lb, hh, ANG); };
  const baseOf = (P) => Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5;
  const solid = (P, top, ad) => (ctx.solid || (ctx.solid = [])).push({ P, top, ad });
  const lod = [];   // [nesne, görünür kalma uzaklığı (m)]

  // ---------- 1) terminaller ----------
  const TC = {
    'Dış Hatlar Terminali 1': { id: 'dis-hatlar-1', h: 21, roof: 'isiklik', overhang: 6, floor: 5.2, skyStep: 26, dome: 1 },
    'Dış Hatlar Terminali 2': { id: 'dis-hatlar-2', h: 24, roof: 'dalga', overhang: 7, floor: 5.4, skyStep: 30, dome: 1, clad: 1 },
    'İç Hatlar Terminali': { id: 'ic-hatlar', h: 18, roof: 'isiklik', overhang: 5, floor: 5, skyStep: 24 },
    'VIP': { id: 'vip', ad: 'VIP Terminali', h: 9, roof: 'duz', overhang: 3, floor: 4.5 },
    'Genel Havacılık Terminali': { id: 'genel-havacilik', h: 9, roof: 'duz', overhang: 3, floor: 4.5 },
  };
  const terms = [], seen = new Set();
  let cargoB = null;
  for (const b of d.bina) {
    if (b.t !== 'terminal') continue;
    const key = b.p[0][0] + ':' + b.p[0][1]; if (seen.has(key)) continue; seen.add(key);
    if (b.n === 'Kargo Terminali') { cargoB = b; continue; }
    const P = ccw(b.p), ar = Math.abs(area2(P)) / 2;
    if (ar < 400) continue;
    let c = TC[b.n];
    if (!c) {
      const [cx, cy] = centroid(P), a = cx * ux + cy * uy;
      c = a < 300 ? { id: 'dis-hatlar-2-bati', ad: 'Dış Hatlar Terminali 2 (batı kanadı)', h: 15, roof: 'duz', overhang: 4, floor: 5.4, clad: 1 }
        : { id: 'ic-hatlar-ek', ad: 'İç Hatlar Terminali (ek bina)', h: 11, roof: 'duz', overhang: 3, floor: 5 };
    }
    const g = terminal(ctx, c.id, c.ad || b.n, P, { h: c.h, roof: c.roof, overhang: c.overhang, floor: c.floor, skyStep: c.skyStep });
    terms.push(P);
    termDetail(ctx, g, P, c);
  }

  // ---------- 2) kule ----------
  let tw = null;
  for (const b of d.bina) if (b.t === 'tower' && (!tw || b.h > tw.h)) tw = b;
  if (tw) { const [x, y] = centroid(tw.p); tower(ctx, x, y, Math.max(60, tw.h || 77), ANG); }

  // ---------- 3) uçaklar (yoğun charter apronu), köprüler, apron araçları ----------
  const S = stands(d); ctx.stands = S;
  standsAndAircraft(ctx, { occ: 0.8 });
  jetBridges(ctx);
  vehicles(ctx, S);
  const gse = gseFor(ctx, S);
  if (gse) lod.push([gse, 4500]);

  // ---------- 4) kargo terminali ----------
  if (cargoB) cargo(ctx, ccw(cargoB.p), XY, boxAB, ANG, lod);

  // ---------- 5) bakım hangarları (genel havacılık apronunun güneyi, kapılar apronda) ----------
  const hg = new GB(), hgRoof = new GB(), hgDoor = new GB(), hgW = new GB(), pad = new GB([['tw', 2]]);
  [[-2135, -2052, -150, -45, 'Bakım Hangarı 1'], [-2135, -2052, -15, 98, 'Bakım Hangarı 2']].forEach(([a0, a1, b0, b1, ad]) => {
    const P = rect(a0, a1, b0, b1), base = baseOf(P), H = 24;
    hg.prism(P, base, H, false);
    hgRoof.prism(rect(a0 - 0.5, a1 + 0.5, b0 - 0.5, b1 + 0.5), H, H + 1.2, true);
    // çatı fenerleri (boyuna şeritler)
    for (let b = b0 + 15; b < b1 - 10; b += 18) boxAB(hgRoof, (a0 + a1) / 2 - 4, b, H + 1.2, (a1 - a0) - 22, 4, 1.4);
    // kapı başlığı (kapının üstünde yüksek bant) ve kapı panelleri
    const W0 = b1 - b0;
    boxAB(hgW, a1 + 0.3, (b0 + b1) / 2, H - 4.5, 1.6, W0 + 1, 6.8);
    const np = 8, pw = (W0 - 4) / np;
    for (let k = 0; k < np; k++) boxAB(hgDoor, a1 + 0.2 + (k % 2) * 0.5, b0 + 2 + pw * (k + 0.5), base, 0.5, pw - 0.15, H - 4.5 - base);
    // yan duvarlarda pencere bandı
    for (const b of [b0 - 0.15, b1 + 0.15]) boxAB(hgDoor, (a0 + a1) / 2, b, 6, a1 - a0 - 8, 0.4, 1.4);
    // önündeki beton saha apronla birleşir
    pad.poly([rect(a1, -2028, b0 - 4, b1 + 4)], 0.07, { tw: [0, 3] });
    solid(P, H + 2, ad);
  });
  const hgGrp = group('hangar-bakim', [[hg, M.hangarWall, 'duvar'], [hgRoof, M.hangarRoof, 'cati'], [hgW, M.white, 'baslik'], [hgDoor, L.door, 'kapi'], [pad, M.apron, 'saha', 2]]);
  ctx.part('hangar-bakim', hgGrp);

  // ---------- 6) kara tarafı: yollar, kanopiler, otoparklar ----------
  landside(ctx, { XY, rect, boxAB, ANG, baseOf, solid, lod });

  // ---------- ayrıntı düzeyi ----------
  let fr = 0;
  ctx.tick = (cam) => {
    if (++fr % 12) return;
    const dd = Math.hypot(d.x - cam.x, d.y - cam.y, Math.max(0, cam.h - d.elev) * 0.5);
    for (const [o, r] of lod) o.visible = dd < r;
  };
}

// ---------- terminal ayrıntıları (terminal grubunun çocuğu: 'ayrinti') ----------
function termDetail(ctx, g, P, c) {
  const { M, gh } = ctx;
  const L = myMats();
  const h = c.h, ov = c.overhang, fl = c.floor;
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.6;
  const white = new GB(), dark = new GB(), clad = new GB(), cab = new GB();
  // kat döşemesi bantları (cam cephede yatay beyaz şeritler)
  const Pb = inflate(P, 0.3);
  for (let z = fl; z < h - 2; z += fl) white.prism(Pb, z - 0.45, z + 0.45, false);
  // çatı saçağının alnı (beyaz) ve parapet
  white.prism(inflate(P, ov + 0.2), h - 0.4, h + 2.1, false);
  // T2: alt kat opak panel bandı (mavi)
  if (c.clad) clad.prism(inflate(P, 0.12), base + 0.4, Math.min(h * 0.28, 6), false);
  // saçak kolonları: saçak kenarından 1.5 m içeride, 14 m arayla
  if (ov >= 4) {
    const Q = inflate(P, ov - 1.5);
    for (let i = 0; i < Q.length; i++) {
      const [ax, ay] = Q[i], [bx, by] = Q[(i + 1) % Q.length], Le = Math.hypot(bx - ax, by - ay);
      const n = Math.floor(Le / 14);
      for (let k = 0; k <= n; k++) {
        const t = n ? k / n : 0.5; if (n && k === n) continue;
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (nearestEdge(P, x, y).d < 2.5 || pip(P, x, y)) continue;
        white.lathe(x, y, [[0.5, 0], [0.5, h - base]], 8, base);
      }
    }
  }
  // çatı makineleri ve iklimlendirme kutuları (ışıklık şeritlerinin arasında)
  const o = obbOf(P), ax = o.ang, cx0 = Math.cos(ax), sy0 = Math.sin(ax);
  const [cx, cy] = centroid(P);
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [x, y] of P) { const a = (x - cx) * cx0 + (y - cy) * sy0, b = -(x - cx) * sy0 + (y - cy) * cx0; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const step = c.skyStep || 30;
  for (let b = b0 + step; b < b1 - 6; b += step) for (let a = a0 + 12; a < a1 - 12; a += 26) {
    const x = cx + cx0 * a - sy0 * b, y = cy + sy0 * a + cx0 * b;
    if (!pip(P, x, y) || nearestEdge(P, x, y).d < 10) continue;
    const r = hash(x, y);
    if (r < 0.45) dark.box(x, y, h + 1.6, 7 + r * 6, 3.6, 2.2, ax);
    else if (r < 0.6) { dark.lathe(x, y, [[1.6, 0], [1.6, 1.8]], 10, h + 1.6); dark.lathe(x + 4 * cx0, y + 4 * sy0, [[1.6, 0], [1.6, 1.8]], 10, h + 1.6); }
  }
  // rotunda kubbesi (yarım daire biçimli iskele ucunun merkezine uyan alçak kubbe + cam tepe)
  if (c.dome) {
    const fit = arcFit(P);
    if (fit) {
      const { x, y, r } = fit, R = r + ov;
      white.lathe(x, y, [[R, 0], [R * 0.9, 2.6], [R * 0.72, 4.8], [R * 0.5, 6.4], [R * 0.26, 7.3]], 32, h + 1.6);
      cab.lathe(x, y, [[R * 0.26, 7.3], [R * 0.13, 8.6], [0.05, 8.9]], 24, h + 1.6);
    }
  }
  const sub = group('ayrinti', [[white, M.white, 'bant'], [dark, M.dark, 'cati-makine'], [clad, L.cladT2, 'panel'], [cab, M.glass, 'kubbe-cam']]);
  g.add(sub);
}
// tabandaki en uzun yay parçasına daire uydur (ardışık kısa kenarlar, yön değişimi düzgün)
function arcFit(P) {
  const n = P.length; let best = null;
  for (let i = 0; i < n; i++) {
    let j = i, turn = 0;
    while (j - i < n - 2) {
      const a = P[j % n], b = P[(j + 1) % n], c = P[(j + 2) % n];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (l1 > 25 || l2 > 25) break;
      const t = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
      const tt = Math.atan2(Math.sin(t), Math.cos(t));
      if (Math.abs(tt) > 0.6 || Math.abs(tt) < 0.03 || (turn && Math.sign(tt) !== Math.sign(turn))) break;
      turn += tt; j++;
    }
    if (j - i >= 5 && (!best || Math.abs(turn) > Math.abs(best.turn))) best = { i, j: j + 2, turn };
  }
  if (!best || Math.abs(best.turn) < 2) return null;
  // üç nokta: baş, orta, son
  const A = P[best.i % n], B = P[Math.floor((best.i + best.j) / 2) % n], C = P[best.j % n];
  const dd = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])); if (Math.abs(dd) < 1e-6) return null;
  const s = (p) => p[0] * p[0] + p[1] * p[1];
  const x = (s(A) * (B[1] - C[1]) + s(B) * (C[1] - A[1]) + s(C) * (A[1] - B[1])) / dd, y = (s(A) * (C[0] - B[0]) + s(B) * (A[0] - C[0]) + s(C) * (B[0] - A[0])) / dd;
  const r = Math.hypot(A[0] - x, A[1] - y);
  return r > 15 && r < 90 ? { x, y, r } : null;
}

// ---------- kule: kanatlı beton gövde, eğik camlı kabin, alt teknik blok ----------
function tower(ctx, x, y, H, ANG) {
  const { M, gh, W, d } = ctx;
  const base = gh(x, y) - 0.5;
  const sh = new GB(), cab = new GB(), dark = new GB(), blk = new GB(), glass = new GB(); glass.uv = []; glass._per = 0;
  const T = base + H;
  // gövde: hafif daralan silindir + iki yanda dikey kanat (merdiven ve asansör çekirdeği)
  sh.lathe(x, y, [[5.4, 0], [4.9, H * 0.5], [4.5, H - 17]], 20, base);
  const c = Math.cos(ANG), s = Math.sin(ANG);
  sh.box(x + c * 5.2, y + s * 5.2, base, 3.2, 2.4, H - 15, ANG);
  sh.box(x - c * 4.4, y - s * 4.4, base, 2.2, 6.2, H - 21, ANG);
  // gövde boyunca dar pencere yarığı
  dark.box(x - s * 4.6, y + c * 4.6, base + 6, 0.9, 0.5, H - 26, ANG);
  // kabin altı: açılan teknik katlar
  sh.lathe(x, y, [[4.5, H - 17], [7.5, H - 14.5], [9.6, H - 12.6], [9.6, H - 12]], 20, base);
  dark.lathe(x, y, [[9.2, H - 12], [9.2, H - 9.2]], 20, base);
  sh.lathe(x, y, [[10.2, H - 9.2], [10.2, H - 8.6]], 20, base);         // yürüme yolu
  // kabin: dışa eğik cam (12 kenar), tavan saçağı
  cab.lathe(x, y, [[9.4, H - 8.6], [11.0, H - 3.4]], 12, base);
  sh.lathe(x, y, [[11.8, H - 3.4], [11.8, H - 2.4], [9, H - 1.4], [4, H - 0.8], [0.05, H - 0.6]], 12, base);
  // tepe: radar kubbesi, anten direği
  sh.lathe(x, y, [[2.2, 0], [2.2, 1.4], [1.8, 2.6], [0.9, 3.2], [0.05, 3.4]], 12, T - 0.6);
  dark.box(x + c * 3, y + s * 3, T - 0.8, 0.25, 0.25, 9, 0);
  // alt teknik blok (2 kat): gövdenin doğusunda
  const B0 = [[-14, -22], [14, -22], [14, -6], [-14, -6]].map(([a, b]) => [x + c * a - s * b, y + s * a + c * b]);
  const bb = Math.min(base, ...B0.map(([p, q]) => gh(p, q) - 0.5));
  glass.prism(ccw(B0), bb, bb + 9, false);
  for (let k = 0; k < glass.uv.length; k += 2) { glass.uv[k] /= 3.0; glass.uv[k + 1] = (glass.uv[k + 1] - bb) / 4.5; }
  blk.prism(inflate(ccw(B0), 0.3), bb + 4.2, bb + 4.9, false);
  blk.prism(inflate(ccw(B0), 1.2), bb + 9, bb + 10, true);
  // gövdeye bağlantı koridoru
  blk.box(x - s * 3, y + c * 3 - 0, bb, 3, 5, 9.5, ANG + Math.PI / 2);
  const grp = group('kule', [[sh, M.white, 'govde'], [cab, M.cab, 'kabin'], [dark, M.dark, 'teknik'], [glass, M.glass, 'blok-cam'], [blk, M.white, 'blok']]);
  const k = Math.round(d.x + x) + ':' + Math.round(d.y + y);
  W._apCol = W._apCol || new Set();
  if (!W._apCol.has(k)) { W._apCol.add(k); W.lmCol.push({ x: d.x + x, y: d.y + y, r: 12, top: d.elev + base + H + 3 }); }
  (ctx.solid || (ctx.solid = [])).push({ P: B0, top: bb + 10, ad: 'Kule bloğu' });
  return ctx.part('kule', grp);
}

// ---------- yolcu köprüleri (OSM çizgileri: kapalı halka = sabit koridor, açık çizgi = rotunda + teleskopik tünel + kabin) ----------
function jetBridges(ctx) {
  const { d, M } = ctx;
  const tube = new GB(), metal = new GB(), glassy = new GB();
  for (const k of d.kopru) {
    if (k.length < 2) continue;
    const a = k[0], z = k[k.length - 1];
    let len = 0; for (let i = 1; i < k.length; i++) len += Math.hypot(k[i][0] - k[i - 1][0], k[i][1] - k[i - 1][1]);
    if (Math.hypot(z[0] - a[0], z[1] - a[1]) < 8 && len > 12) {
      // sabit koridor: halkanın yönlü kutusu, iki ayak üstünde
      const o = obbOf(k);
      if (o.L > 70 || o.Wd > 8) continue;
      const w = Math.max(2.8, Math.min(o.Wd, 4.5));
      tube.box(o.cx, o.cy, 4.6, o.L, w, 3.0, o.ang);
      glassy.box(o.cx, o.cy, 5.4, o.L - 1, w + 0.12, 1.3, o.ang);
      for (const t of [-0.3, 0.3]) metal.box(o.cx + o.c * o.L * t, o.cy + o.s * o.L * t, 0, 0.8, 0.8, 4.6, o.ang);
      continue;
    }
    if (len < 8 || len > 80) continue;
    // rotunda
    metal.lathe(a[0], a[1], [[2.4, 0], [2.4, 0.4], [0.9, 0.5], [0.9, 4.3]], 10, 0);
    metal.lathe(a[0], a[1], [[2.9, 4.3], [2.9, 7.5]], 12, 0);
    tube.lathe(a[0], a[1], [[3.0, 7.5], [2.4, 7.9], [0.05, 8.0]], 12, 0);
    let s = 0;
    for (let i = 0; i < k.length - 1; i++) {
      const [x0, y0] = k[i], [x1, y1] = k[i + 1], Ls = Math.hypot(x1 - x0, y1 - y0); if (Ls < 0.5) continue;
      const z0 = 4.6 - 0.9 * s / len, z1 = 4.6 - 0.9 * (s + Ls) / len; s += Ls;
      const last = i === k.length - 2;
      // teleskopik tünel: iki iç içe kesit
      const mx = x0 + (x1 - x0) * 0.5, my = y0 + (y1 - y0) * 0.5, mz = (z0 + z1) / 2;
      beam(tube, x0, y0, z0 + 1.45, mx + (x1 - x0) * 0.04, my + (y1 - y0) * 0.04, mz + 1.45, 3.4, 2.9);
      beam(tube, mx, my, mz + 1.45, x1, y1, z1 + 1.45, 3.0, 2.6);
      beam(glassy, x0, y0, z0 + 2.0, x1, y1, z1 + 2.0, 3.48, 0.9);
      beam(metal, x0, y0, z0 - 0.1, x1, y1, z1 - 0.1, 2.0, 0.35);   // alt taşıyıcı
      if (last) {
        // kabin (uçak kapısına dönük), sürüş ayağı ve tekerlek boji
        const ang = Math.atan2(y1 - y0, x1 - x0);
        metal.box(x1 - Math.cos(ang) * 1.1, y1 - Math.sin(ang) * 1.1, z1 - 0.2, 2.4, 4.2, 3.3, ang + 0.15);
        const fx = x0 + (x1 - x0) * 0.72, fy = y0 + (y1 - y0) * 0.72, fz = z0 + (z1 - z0) * 0.72;
        const px = -Math.sin(ang), py = Math.cos(ang);
        for (const sd of [-1, 1]) beam(metal, fx + px * sd * 1.1, fy + py * sd * 1.1, 0.6, fx + px * sd * 1.1, fy + py * sd * 1.1, fz, 0.45, 0.45);
        metal.box(fx, fy, 0, 1.3, 3.6, 0.9, ang);
        metal.box(fx, fy, fz - 0.5, 0.6, 3.0, 0.5, ang);
      }
    }
  }
  const L = myMats();
  ctx.grp.add(group('yolcu-kopruleri', [[tube, M.metal, 'tunel'], [glassy, M.dark, 'pencere'], [metal, M.dark, 'ayak']]));
}

// ---------- uzak park yerlerinde charter yer hizmetleri: merdiven araçları, bant yükleyici, bagaj arabaları ----------
function gseFor(ctx, S) {
  const gb = new GB([['color', 3]]);
  const box = (x, y, h0, l, w, hh, ang, col) => { const s = gb.count; gb.box(x, y, h0, l, w, hh, ang); colorFrom(gb, s, col); };
  const bm = (x0, y0, z0, x1, y1, z1, w, t, col) => { const s = gb.count; beam(gb, x0, y0, z0, x1, y1, z1, w, t); colorFrom(gb, s, col); };
  const WH = [0.92, 0.92, 0.9], YE = [0.95, 0.72, 0.08], GR = [0.35, 0.37, 0.4], BL = [0.12, 0.28, 0.55], OR = [0.95, 0.45, 0.1];
  let n = 0;
  for (const s of S) {
    if (!s.ac || n > 220) continue;
    const { x, y, hx, hy, sc } = s.ac, L2 = s.ac.L / 2;
    const lx = -hy, ly = hx;                 // uçağın solu
    const r = hash(s.x, s.y + 11);
    const nose = [x + hx * L2, y + hy * L2];
    const sill = 3.0 * sc, rad = 2.05 * sc;
    const stairs = (along, side) => {
      // kapı: burundan 'along' m geride, solda
      const dx = nose[0] - hx * along * sc, dy = nose[1] - hy * along * sc;
      const tx = dx + lx * side * (rad + 0.4), ty = dy + ly * side * (rad + 0.4);
      const bx = dx + lx * side * (rad + 6.5), by = dy + ly * side * (rad + 6.5);
      bm(bx, by, 0.9, tx, ty, sill, 1.6, 0.35, WH);                                           // merdiven
      for (const e of [-1, 1]) bm(bx + hx * e * 0.8, by + hy * e * 0.8, 1.9, tx + hx * e * 0.8, ty + hy * e * 0.8, sill + 1.0, 0.08, 0.08, GR);  // korkuluk
      const cx = dx + lx * side * (rad + 6.0), cy = dy + ly * side * (rad + 6.0);
      box(cx, cy, 0.25, 6.5, 2.2, 0.9, Math.atan2(ly * side, lx * side), WH);                 // şasi
      box(dx + lx * side * (rad + 9.2), dy + ly * side * (rad + 9.2), 0.25, 1.8, 2.2, 2.0, Math.atan2(ly * side, lx * side), YE);  // kabin
    };
    if (!s.gate) {
      stairs(6.0, 1);
      if (r < 0.7) stairs(s.ac.L / sc - 6.5, 1);
      if (r > 0.25) { // apron otobüsü
        const bx = nose[0] - hx * 12 * sc + lx * (rad + 16), by = nose[1] - hy * 12 * sc + ly * (rad + 16);
        box(bx, by, 0.3, 13.5, 2.9, 2.9, Math.atan2(hy, hx), r > 0.6 ? BL : WH);
        box(bx, by, 1.6, 13.0, 2.95, 1.0, Math.atan2(hy, hx), [0.12, 0.14, 0.17]);
      }
    }
    // sağ tarafta bant yükleyici ve bagaj arabaları
    const fx = nose[0] - hx * 8 * sc - lx * (rad + 0.3), fy = nose[1] - hy * 8 * sc - ly * (rad + 0.3);
    const gx = fx - lx * 7, gy = fy - ly * 7;
    bm(gx, gy, 0.9, fx, fy, 1.9 * sc, 1.0, 0.25, GR);
    box(gx + lx * 1.2, gy + ly * 1.2, 0.25, 3.5, 1.8, 0.9, Math.atan2(-ly, -lx), YE);
    if (r < 0.75) for (let k = 0; k < 3; k++) {
      const cx = gx - lx * 4 - hx * (k * 3.6), cy = gy - ly * 4 - hy * (k * 3.6);
      box(cx, cy, 0.3, 3.0, 1.6, 1.7, Math.atan2(hy, hx), k ? GR : OR);
    }
    n++;
  }
  if (!gb.count) return null;
  const m = mesh(gb, myMats().vc, 'apron-ekip');
  ctx.grp.add(m);
  return m;
}

// ---------- kargo terminali: depo, yükleme kapıları, kanopi, ULD konteynerleri, tır parkı ----------
function cargo(ctx, P, XY, boxAB, ANG, lod) {
  const { M, gh } = ctx;
  const L = myMats();
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5, H = 13;
  const wall = new GB(), roof = new GB(), door = new GB(), white = new GB(), yard = new GB([['tw', 2]]), lines = new GB();
  wall.prism(P, base, H, false);
  roof.prism(inflate(P, 0.6), H, H + 1.1, true);
  white.prism(inflate(P, 0.15), base, 1.2, false);            // beton etek
  white.prism(inflate(P, 0.7), H + 0.2, H + 1.5, false);       // çatı alnı
  // ofis bloğu (cam) kuzey ucunda
  const ab = P.map(([x, y]) => [x * Math.cos(ANG) + y * Math.sin(ANG), x * Math.sin(ANG) - y * Math.cos(ANG)]);
  const amin = Math.min(...ab.map((p) => p[0])), amax = Math.max(...ab.map((p) => p[0])), bmin = Math.min(...ab.map((p) => p[1])), bmax = Math.max(...ab.map((p) => p[1]));
  // kara tarafı (batı, bmin): tır yükleme kapıları; hava tarafı (doğu, bmax): büyük kapılar + kanopi
  for (let a = amin + 8; a < amax - 8; a += 5.5) {
    const [x, y] = XY(a, bmin);
    if (nearestEdge(P, x, y).d > 3) continue;
    boxAB(door, a, bmin - 0.2, base + 1.2, 3.2, 0.6, 3.6);
    boxAB(white, a, bmin - 1.6, base, 3.6, 3.2, 1.2);             // rampa
  }
  for (let a = amin + 14; a < amax - 14; a += 16) {
    const [x, y] = XY(a, bmax); if (nearestEdge(P, x, y).d > 3) continue;
    boxAB(door, a, bmax + 0.25, base, 10, 0.6, 7.5);
  }
  boxAB(white, (amin + amax) / 2, bmax + 6, 9, amax - amin - 10, 12, 0.8);  // hava tarafı kanopi
  for (let a = amin + 10; a < amax - 5; a += 20) boxAB(white, a, bmax + 11.5, base, 0.6, 0.6, 9.2 - base);
  // ULD konteynerleri ve paletler (hava tarafı, iki sıra)
  const uld = new GB([['color', 3]]);
  for (let a = amin + 6; a < amax - 6; a += 2.1) for (const b of [bmax + 16, bmax + 18.4]) {
    const r = hash(a, b); if (r < 0.3) continue;
    const s = uld.count; const [x, y] = XY(a, b);
    uld.box(x, y, 0.3, 1.6, 1.6, r > 0.85 ? 1.0 : 1.6, ANG);
    colorFrom(uld, s, r > 0.85 ? [0.25, 0.3, 0.25] : [0.72, 0.74, 0.76]);
  }
  // tır parkı (kara tarafı) ve tırlar
  const y0 = bmin - 95, y1 = bmin - 8;
  const grid = (a0, a1, b0, b1) => { for (let a = a0; a < a1; a += 30) for (let b = b0; b < b1; b += 30) { const P4 = [XY(a, b), XY(a, Math.min(b + 30, b1)), XY(Math.min(a + 30, a1), Math.min(b + 30, b1)), XY(Math.min(a + 30, a1), b)]; yard.poly([ccw(P4)], 0.0, { tw: [0, 4] }); } };
  grid(amin - 20, amax + 20, y0, y1);
  for (let a = amin; a < amax; a += 4.5) {
    // park çizgileri
    const [x0, yy0] = XY(a, y0 + 3), [x1, yy1] = XY(a, y0 + 23);
    lines.ribbon([[x0, yy0], [x1, yy1]], 0.15, 0.1, () => ({}));
    if (hash(a, 3) < 0.55) {
      const s = uld.count, col = [[0.85, 0.85, 0.85], [0.6, 0.12, 0.1], [0.15, 0.3, 0.6], [0.9, 0.9, 0.88]][Math.floor(hash(a, 7) * 4)];
      const [x, y] = XY(a + 2.25, y0 + 12);
      uld.box(x, y, 0.4, 2.5, 13.6, 3.6, ANG); colorFrom(uld, s, col);
      const s2 = uld.count; const [xc, yc] = XY(a + 2.25, y0 + 20.5); uld.box(xc, yc, 0.4, 2.4, 2.4, 2.8, ANG); colorFrom(uld, s2, [0.9, 0.9, 0.9]);
    }
  }
  // yard zemini yüksekliği: arazi düzse 0; dalgalanmaya karşı kaldır
  const yz = Math.max(0, ...[XY(amin, y0), XY(amax, y0), XY(amin, y1), XY(amax, y1)].map(([x, y]) => gh(x, y)));
  for (let k = 1; k < yard.p.length; k += 3) yard.p[k] = yz + 0.08;
  for (let k = 1; k < lines.p.length; k += 3) lines.p[k] = yz + 0.12;
  const g = group('kargo', [[wall, L.cargoWall, 'duvar'], [roof, M.roof, 'cati'], [door, L.door, 'kapi'], [white, M.white, 'beyaz'], [yard, M.apron, 'tir-parki', 2], [lines, M.paintW, 'cizgi', 5]]);
  ctx.part('kargo', g);
  const u = mesh(uld, L.vc, 'kargo-yuk'); g.add(u); lod.push([u, 4000]);
  (ctx.solid || (ctx.solid = [])).push({ P, top: H + 1.5, ad: 'Kargo Terminali' });
}

// ---------- kara tarafı ----------
function landside(ctx, F) {
  const { M, gh } = ctx;
  const { XY, rect, boxAB, ANG, solid, lod } = F;
  const L = myMats();
  const road = new GB([['tw', 2]]), paint = new GB(), paintY = new GB(), grass = new GB();
  const struct = new GB(), deck = new GB(), dark = new GB(), canopy = new GB(), wall = new GB();
  const cars = [];   // [x, y, z, açı, renk]
  const lift = (x, y) => Math.max(0, gh(x, y)) + 0.08;
  // asfalt alan: 25 m'lik ızgara, köşe başına arazi yüksekliği
  const pave = (a0, a1, b0, b1, kind = 4, gb = road) => {
    const st = 25, na = Math.max(1, Math.ceil((a1 - a0) / st)), nb = Math.max(1, Math.ceil((b1 - b0) / st));
    const s = gb.count;
    for (let i = 0; i <= na; i++) for (let j = 0; j <= nb; j++) {
      const [x, y] = XY(a0 + (a1 - a0) * i / na, b0 + (b1 - b0) * j / nb);
      gb.vert(x, lift(x, y), y, 0, 1, 0, gb.a.tw ? { tw: [0, kind] } : {});
    }
    for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
      const p = s + i * (nb + 1) + j;
      // (a, b) çerçevesi sol elli: sarım three'de yukarı bakacak şekilde
      gb.tri(p, p + 1, p + nb + 2); gb.tri(p, p + nb + 2, p + nb + 1);
    }
  };
  const line = (gb, a0, b0, a1, b1, w, dash = 0) => {
    const Ls = Math.hypot(a1 - a0, b1 - b0);
    const seg = dash ? Math.floor(Ls / dash) : 1;
    for (let k = 0; k < seg; k++) {
      const t0 = k / seg, t1 = dash ? t0 + 0.5 / seg : 1;
      const [x0, y0] = XY(a0 + (a1 - a0) * t0, b0 + (b1 - b0) * t0), [x1, y1] = XY(a0 + (a1 - a0) * t1, b0 + (b1 - b0) * t1);
      const s = gb.count;
      gb.ribbon([[x0, y0], [x1, y1]], w, 0, () => ({}));
      for (let q = s; q < gb.count; q++) gb.p[q * 3 + 1] = lift(gb.p[q * 3], -gb.p[q * 3 + 2]) + 0.05;
    }
  };
  // yol: a yönünde (along=true) ya da b yönünde, merkez çizgili
  const roadA = (a0, a1, b0, b1) => { pave(a0, a1, b0, b1); line(paint, a0 + 2, (b0 + b1) / 2, a1 - 2, (b0 + b1) / 2, 0.18, 9); line(paint, a0, b0 + 0.6, a1, b0 + 0.6, 0.15); line(paint, a0, b1 - 0.6, a1, b1 - 0.6, 0.15); };
  const roadB = (a0, a1, b0, b1) => { pave(a0, a1, b0, b1); line(paint, (a0 + a1) / 2, b0 + 2, (a0 + a1) / 2, b1 - 2, 0.18, 9); line(paint, a0 + 0.6, b0, a0 + 0.6, b1, 0.15); line(paint, a1 - 0.6, b0, a1 - 0.6, b1, 0.15); };
  // açık otopark: sırt sırta iki sıra (5 m) + 6.5 m koridor; hücre 2.6 m
  const lot = (a0, a1, b0, b1, occ = 0.72, bus = false) => {
    pave(a0, a1, b0, b1);
    line(paint, a0 + 0.5, b0 + 0.5, a0 + 0.5, b1 - 0.5, 0.15); line(paint, a1 - 0.5, b0 + 0.5, a1 - 0.5, b1 - 0.5, 0.15);
    const cw = bus ? 4.2 : 2.6, dep = bus ? 14 : 5, mod = dep * 2 + (bus ? 12 : 6.5);
    for (let a = a0 + (bus ? 12 : 6.5); a + dep * 2 <= a1 - 1; a += mod) {
      // ada (yeşil şerit) her dördüncü modülde
      for (let b = b0 + 4; b + cw <= b1 - 4; b += cw) {
        line(paint, a, b, a + dep * 2, b, 0.12);
        for (const [ac, dir] of [[a + dep / 2, 1], [a + dep * 1.5, -1]]) {
          const r = hash(ac + b * 0.37, b + ac * 0.11);
          if (r < occ) { const [x, y] = XY(ac + (r - 0.4) * 0.5, b + cw / 2); cars.push([x, y, lift(x, y), ANG + (dir > 0 ? 0 : Math.PI) + (r - 0.5) * 0.06, r, bus]); }
        }
      }
      line(paint, a + dep, b0 + 4, a + dep, b1 - 4, 0.12);
    }
  };
  // çok katlı otopark: döşemeler, parapetler, kolonlar, rampa, merdiven kuleleri, üst katta arabalar
  const garage = (a0, a1, b0, b1, nlev, ad) => {
    const P = rect(a0, a1, b0, b1), base = Math.min(...P.map(([x, y]) => gh(x, y))) - 0.3, fh = 3.1;
    for (let l = 1; l <= nlev; l++) {
      const z = base + l * fh;
      deck.prism(P, z - 0.45, z, l === nlev);
      wall.prism(inflate(P, 0.05), z, z + 1.05, false);
    }
    deck.prism(P, base + 0.05, base + 0.1, true);
    for (let a = a0 + 0.4; a <= a1; a += 8) for (const b of [b0 + 0.4, b1 - 0.4]) boxAB(struct, Math.min(a, a1 - 0.4), b, base, 0.6, 0.6, nlev * fh);
    for (let b = b0 + 8; b < b1 - 4; b += 8) for (const a of [a0 + 0.4, a1 - 0.4]) boxAB(struct, a, b, base, 0.6, 0.6, nlev * fh);
    // merdiven ve asansör kuleleri
    boxAB(dark, a0 + 3, b0 - 2.5, base, 6, 5, nlev * fh + 3.5);
    boxAB(dark, a1 - 3, b1 + 2.5, base, 6, 5, nlev * fh + 3.5);
    // dış rampa (b0 tarafında, iki kol)
    const [rx0, ry0] = XY(a1 - 6, b0 - 6), [rx1, ry1] = XY(a0 + 14, b0 - 6);
    beam(deck, rx0, ry0, base + 0.4, rx1, ry1, base + fh * 2, 7, 0.5);
    // içeride görünen ve üst kattaki arabalar
    for (let l = 1; l <= nlev; l++) for (let a = a0 + 4; a < a1 - 4; a += 2.6) for (const b of [b0 + 3, b0 + 8, b1 - 8, b1 - 3].concat(l === nlev ? [(b0 + b1) / 2 - 2.5, (b0 + b1) / 2 + 2.5] : [])) {
      const r = hash(a * 1.7 + l, b); if (r > (l === nlev ? 0.4 : 0.45)) continue;
      const [x, y] = XY(a, b); cars.push([x, y, base + l * fh - (l === nlev ? 0 : fh), ANG + Math.PI / 2 + (b < (b0 + b1) / 2 ? 0 : Math.PI), r, false]);
    }
    solid(P, base + nlev * fh + 1.2, ad);
  };
  // kanopi (yaya kaldırımı üstünde): ince çelik döşeme + kolonlar
  const canopyA = (a0, a1, b0, b1, h, colB) => {
    const P = rect(a0, a1, b0, b1), z = Math.max(...P.map(([x, y]) => gh(x, y)));
    canopy.prism(P, z + h, z + h + 0.7, true, true);
    for (let a = a0 + 4; a < a1 - 2; a += 12) boxAB(struct, a, colB, z, 0.5, 0.5, h);
  };
  const canopyB = (a0, a1, b0, b1, h, colA) => {
    const P = rect(a0, a1, b0, b1), z = Math.max(...P.map(([x, y]) => gh(x, y)));
    canopy.prism(P, z + h, z + h + 0.7, true, true);
    for (let b = b0 + 4; b < b1 - 2; b += 12) boxAB(struct, colA, b, z, 0.5, 0.5, h);
  };

  // --- Dış Hatlar 1 + İç Hatlar (doğu cephesi) ---
  pave(1150, 2160, 163, 178, 4);                  // kaldırım
  roadA(1100, 2200, 178, 206);                    // geliş-gidiş yolu (iki yönlü kıvrım)
  line(paintY, 1150, 192, 2150, 192, 0.3);        // ayrım çizgisi
  canopyA(1260, 1720, 160, 186, 9, 185.5);
  canopyA(1730, 2020, 170, 190, 10, 189.5);
  roadB(1110, 1130, 206, 645); roadB(2180, 2200, 206, 645); roadB(1495, 1512, 206, 625);
  roadA(900, 2200, 625, 645);
  lot(1160, 1490, 240, 420, 0.3); lot(1520, 1800, 240, 420, 0.32); lot(1160, 1490, 440, 615, 0.1); lot(1520, 1820, 440, 615, 0.08);
  garage(1850, 1990, 228, 340, 4, 'Otopark (Dış Hatlar 1)');
  roadA(1820, 2180, 206, 222);
  lot(2030, 2170, 240, 410, 0.7, true);           // otobüs ve transfer otoparkı (charter turları)
  lot(1850, 2170, 430, 615, 0.08);
  // --- Dış Hatlar 2 (kuzey cephesi) ---
  pave(110, 132, -40, 368, 4);
  roadB(132, 160, -40, 368);
  line(paintY, 146, -35, 146, 362, 0.3);
  canopyB(110, 131, -35, 366, 9, 131);
  roadA(160, 555, 345, 362);                      // doğu bağlantısı (tünele)
  roadB(535, 552, -30, 345);
  garage(178, 290, 150, 330, 4, 'Otopark (Dış Hatlar 2)');
  lot(178, 330, -28, 132, 0.38); lot(310, 525, 150, 335, 0.28); lot(345, 525, -28, 132, 0.3);
  // taksi yolu altından geçen yol tüneli: iki ağız (beton çerçeve + koyu açıklık)
  for (const [a, dir] of [[560, 1], [640, -1]]) {
    boxAB(struct, a, 342, -0.2, 5, 1.2, 7); boxAB(struct, a, 365, -0.2, 5, 1.2, 7);
    boxAB(struct, a, 353.5, 5.2, 5, 24.4, 1.6);
    boxAB(dark, a + dir * 0.2, 353.5, -0.2, 4.4, 21.6, 5.4);
    for (const b of [342, 365]) boxAB(wall, a - dir * 14, b, -0.2, 24, 0.6, 1.1);
  }
  roadA(640, 1110, 345, 362);

  // arabalar: örneklenmiş (gövde + kabin), bir çizim çağrısı; otobüsler ayrı geometri
  const PAL = [0xf2f2f0, 0x1a1c20, 0x9aa0a6, 0xc4c7cb, 0x2f4f7a, 0x8a2020, 0xe9e2cf, 0x54585e, 0x3a6a4a, 0xd8b830];
  const carsN = cars.filter((c) => !c[5]), busN = cars.filter((c) => c[5]);
  const mk = (list, len, wid, hgt, cabL, name, pal) => {
    if (!list.length) return null;
    const gb = new GB([['color', 3]]);
    let s = gb.count; gb.box(0, 0, 0.25, len, wid, hgt * 0.55, 0); colorFrom(gb, s, [1, 1, 1]);
    s = gb.count; gb.box(-len * 0.05, 0, 0.25 + hgt * 0.55, cabL, wid * 0.88, hgt * 0.45, 0); colorFrom(gb, s, pal ? [0.95, 0.95, 0.95] : [0.32, 0.34, 0.38]);
    const im = new THREE.InstancedMesh(gb.geometry(), L.car, list.length);
    const o = new THREE.Object3D(), c = new THREE.Color();
    list.forEach(([x, y, z, ang, r], i) => {
      o.position.set(x, z, -y); o.rotation.set(0, ang, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      c.setHex((pal || PAL)[Math.floor(hash(r * 97, x) * (pal || PAL).length)]); im.setColorAt(i, c);
    });
    im.computeBoundingSphere(); im.name = name; im.matrixAutoUpdate = false;
    return im;
  };
  const carM = mk(carsN, 4.5, 1.8, 1.45, 2.5, 'otopark-araba');
  const busM = mk(busN, 12.5, 2.55, 3.4, 12, 'otopark-otobus', [0xf4f4f2, 0x2a5aa0, 0xe8c020, 0xd8dadc]);
  const g = group('kara-tarafi', [[road, M.taxi, 'yol', 3], [paint, M.paintW, 'cizgi', 5], [paintY, M.paint, 'cizgi-sari', 5], [grass, M.grassStrip, 'cim', 1],
    [deck, L.deck, 'otopark-doseme'], [wall, M.conc, 'otopark-parapet'], [struct, M.conc, 'kolon'], [dark, M.dark, 'koyu'], [canopy, M.white, 'kanopi']]);
  ctx.grp.add(g);
  lod.push([g, 9000]);
  for (const m of [carM, busM]) if (m) { ctx.grp.add(m); lod.push([m, 3000]); }
}
