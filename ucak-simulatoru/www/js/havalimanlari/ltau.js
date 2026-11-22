// Kayseri Erkilet Havalimanı (LTAU, ASR): askeri-sivil ortak meydan. Güneyde sivil taraf: yeni terminal (2024, 6 yolcu
// köprüsü; OSM tabanı) ve eski iç / dış hat terminalleri, sivil kule, otopark. Kuzeyde 12. Hava Ulaştırma Ana Üssü:
// büyük nakliye apronu (A400M / C-130 boyutunda kendi nakliye uçaklarımız), bakım hangarları (kuzeybatı: 2. Hava İkmal
// Bakım Merkezi), askeri kule, apron ışık direkleri.
// Bu dosya Konya (ltan.js) ve Nevşehir (ltaz.js) modüllerinin de kullandığı askeri / sivil yardımcıları dışa açar:
// hangarlar (kapılı), uçak sığınakları, askeri uçaklar (örneklenmiş), otopark ve arabalar, terminal kanopisi, ışık direkleri.
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, obbOf, barrel, stands, standsAndAircraft, airlinerGeoms } from '../havalimani.js';
import { terminal, jetBridges, vehicles, towerModern, towerClassic, pip, nearestEdge } from './ortak.js';

// ---------- küçük yardımcılar ----------
const area = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
export const alan = (P) => Math.abs(area(P));
const ccw = (P) => (area(P) < 0 ? P.slice().reverse() : P);
function hash(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}
// en yakın kaplamalı yüzeye (taksi yolu ekseni, apron) uzaklık
export function pavedDist(d, x, y) {
  let m = 1e9;
  for (const t of d.twy) for (let k = 0; k < t.p.length - 1; k++) m = Math.min(m, segDist(x, y, t.p[k][0], t.p[k][1], t.p[k + 1][0], t.p[k + 1][1]) - t.w / 2);
  for (const pl of d.apron) { const R = pl[0]; if (pip(R, x, y)) return 0; m = Math.min(m, nearestEdge(R, x, y).d); }
  return m;
}
// taksi yolu eksenine uzaklık (kenardan)
export function twyDist(d, x, y) {
  let m = 1e9;
  for (const t of d.twy) for (let k = 0; k < t.p.length - 1; k++) m = Math.min(m, segDist(x, y, t.p[k][0], t.p[k][1], t.p[k + 1][0], t.p[k + 1][1]) - t.w / 2);
  return m;
}
export function runwayDist(d, x, y) {
  let m = 1e9;
  for (const r of d.rws) m = Math.min(m, segDist(x, y, r.a[0], r.a[1], r.b[0], r.b[1]) - r.w / 2);
  return m;
}
// tek renk boya: GB'deki s'den sonraki köşeler
function paint(gb, s, col) { const v = gb.a.color.v; for (let k = s; k < gb.count; k++) { v[k * 3] = col[0]; v[k * 3 + 1] = col[1]; v[k * 3 + 2] = col[2]; } }
// üçgen sarımını köşe normallerine uydur (yansıtma ve elle kurulan yüzeyler için)
function fixWinding(gb, i0 = 0) {
  const p = gb.p, n = gb.n, I = gb.i;
  for (let k = i0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = n[a] + n[b] + n[c], ny = n[a + 1] + n[b + 1] + n[c + 1], nz = n[a + 2] + n[b + 2] + n[c + 2];
    if (fx * nx + fy * ny + fz * nz < 0) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
  }
}
// yatay gövde (burun +x): kesitler [a (burundan, m), yarıçap, merkez yüksekliği, dikey ölçek], L toplam boy
function tube(gb, L, secs, seg, col, colFn) {
  const s0 = gb.count;
  for (const [a, r, zc, k = 1] of secs) for (let q = 0; q <= seg; q++) {
    const an = q / seg * Math.PI * 2, c = Math.cos(an), s = Math.sin(an);
    const cl = colFn ? colFn(a, s, c) || col : col;
    gb.vert(L / 2 - a, zc + s * r * k, c * r, 0, s, c, { color: cl });
  }
  const i0 = gb.i.length;
  for (let j = 0; j < secs.length - 1; j++) for (let q = 0; q < seg; q++) { const a = s0 + j * (seg + 1) + q, b = a + seg + 1; gb.quad(a, a + 1, b + 1, b); }
  fixWinding(gb, i0);
}
// yatay levha (kanat, yatay kuyruk): P [a, yan] burundan; iki yana aynalanır; h kalınlığın altı, t kalınlık, dz uca doğru yükselme
function plate(gb, L, P, h, t, col, mirror = true, dz = 0) {
  for (const sd of mirror ? [1, -1] : [1]) {
    const Q = ccw(P.map(([a, y]) => [L / 2 - a, y * sd]));
    const s = gb.count, i0 = gb.i.length;
    gb.prism(Q, h, h + t, true, true);
    if (dz) for (let k = s; k < gb.count; k++) gb.p[k * 3 + 1] += Math.abs(gb.p[k * 3 + 2]) * dz;
    paint(gb, s, col); fixWinding(gb, i0);
  }
}
// dikey levha (dikey kuyruk): P [a, yükseklik], t kalınlık, y0 yan konum
function fin(gb, L, P, t, col, y0 = 0) {
  const tmp = new GB();
  tmp.prism(ccw(P.map(([a, z]) => [L / 2 - a, z])), y0 - t / 2, y0 + t / 2, true, true);
  const s = gb.count, i0 = gb.i.length;
  for (let k = 0; k < tmp.count; k++) {
    const X = tmp.p[k * 3], H = tmp.p[k * 3 + 1], Z = tmp.p[k * 3 + 2];
    const nX = tmp.n[k * 3], nH = tmp.n[k * 3 + 1], nZ = tmp.n[k * 3 + 2];
    gb.p.push(X, -Z, -H); gb.n.push(nX, -nZ, -nH); gb.a.color.v.push(...col);
  }
  for (const i of tmp.i) gb.i.push(s + i);
  fixWinding(gb, i0);
}
// kutu (burundan a, yan y, taban h)
function cbox(gb, L, a, y, h, la, wy, hh, col) { const s = gb.count, i0 = gb.i.length; gb.box(L / 2 - a, y, h, la, wy, hh, 0); paint(gb, s, col); fixWinding(gb, i0); }
// iki yüzlü dörtgen (pervane palleri): üç boyutlu köşeler [x, h, yan]
function quad2(gb, P, col) {
  const [a, b, c] = P;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  for (const sg of [1, -1]) {
    const s = gb.count, i0 = gb.i.length;
    for (const p of P) gb.vert(p[0], p[1], p[2], nx * sg, ny * sg, nz * sg, { color: col });
    gb.quad(s, s + 1, s + 2, s + 3); fixWinding(gb, i0);
  }
}

// ---------- askeri uçaklar (kendi düşük poligonlu modellerimiz, işaretsiz; 1 birim = 1 m, burun +x) ----------
let MILG = null;
export function milGeoms() {
  if (MILG) return MILG;
  const Gr = [0.47, 0.5, 0.53], Gd = [0.4, 0.43, 0.46], Dk = [0.1, 0.11, 0.12], Cn = [0.16, 0.15, 0.1];
  // savaş uçağı (F-16 boyutunda: 15 m boy, 9.5 m açıklık, 5 m yükseklik)
  const f = new GB([['color', 3]]), FL = 15;
  tube(f, FL, [[0, 0.04, 1.95], [0.9, 0.3, 1.95], [2.4, 0.55, 1.98], [4.2, 0.66, 2.0, 1.05], [6.5, 0.78, 2.0, 1.0], [11.5, 0.8, 2.0], [14.0, 0.62, 2.0], [14.7, 0.55, 2.0]], 10, Gr, (a) => (a < 0.6 ? Gd : null));
  tube(f, FL, [[2.2, 0.04, 2.5], [2.9, 0.36, 2.52, 1.2], [4.0, 0.42, 2.5, 1.15], [5.4, 0.3, 2.45], [6.2, 0.04, 2.45]], 8, Cn);
  tube(f, FL, [[14.5, 0.58, 2.0], [15.3, 0.5, 2.0], [15.35, 0.3, 2.0]], 8, Dk);
  cbox(f, FL, 6.8, 0, 0.95, 5.2, 1.15, 0.85, Gd);                    // gövde altı hava alığı
  cbox(f, FL, 4.3, 0, 1.05, 0.8, 1.15, 0.75, Dk);                    // alık ağzı
  plate(f, FL, [[4.3, 0.55], [6.8, 0.72], [6.8, 1.25]], 1.98, 0.1, Gr); // kanat kökü uzantısı
  plate(f, FL, [[6.6, 0.7], [11.3, 0.7], [11.7, 4.75], [10.4, 4.75]], 1.95, 0.14, Gr);
  plate(f, FL, [[10.1, 4.6], [11.6, 4.6], [11.6, 4.85], [10.1, 4.85]], 1.88, 0.3, [0.85, 0.85, 0.85]); // kanat ucu füze rayı
  plate(f, FL, [[12.6, 0.6], [14.8, 0.6], [15.1, 2.9], [14.3, 2.9]], 1.9, 0.1, Gr);
  fin(f, FL, [[11.2, 2.55], [14.6, 2.55], [15.0, 5.05], [13.9, 5.05]], 0.16, Gr);
  for (const sd of [-1, 1]) fin(f, FL, [[12.6, 1.3], [14.3, 1.3], [14.4, 0.75], [13.2, 0.75]], 0.08, Gd, sd * 0.6); // karın kanatçıkları
  cbox(f, FL, 8.8, 0, 1.0, 3.0, 0.6, 0.45, Gd);                      // gövde altı yakıt tankı yerine merkez dikmesi
  cbox(f, FL, 2.4, 0, 0, 0.3, 0.3, 1.5, Dk); cbox(f, FL, 8.9, 1.2, 0, 0.6, 0.35, 1.3, Dk); cbox(f, FL, 8.9, -1.2, 0, 0.6, 0.35, 1.3, Dk);
  for (const sd of [-1, 1]) cbox(f, FL, 9.6, sd * 3.1, 1.25, 4.0, 0.42, 0.42, [0.62, 0.64, 0.65]); // kanat altı tank
  // nakliye uçağı (A400M boyutunda: 45 m boy, 42 m açıklık, 14.7 m yükseklik; yüksek kanat, T kuyruk, dört pervane)
  const t = new GB([['color', 3]]), TL = 45, Tg = [0.52, 0.55, 0.54], Td = [0.43, 0.46, 0.45];
  tube(t, TL, [[0, 0.1, 3.0], [0.8, 1.4, 3.15, 0.95], [2.6, 2.35, 3.45], [5.5, 2.85, 3.65, 1.06], [27.5, 2.85, 3.65, 1.06], [33.5, 2.45, 4.3, 1.0], [39.5, 1.45, 5.5], [44.4, 0.55, 6.4], [45, 0.15, 6.5]], 14, Tg,
    (a, s, c) => (a > 0.9 && a < 2.7 && s > 0.15 && Math.abs(c) < 0.8 ? Dk : s < -0.6 ? Td : null));
  cbox(t, TL, 19.5, 0, 5.6, 9.5, 3.4, 1.25, Tg);                      // kanat gövde birleşimi
  plate(t, TL, [[15.8, 1.6], [23.0, 1.6], [22.2, 21.1], [19.6, 21.1]], 6.2, 0.6, Tg, true, -0.01);
  for (const sd of [-1, 1]) {
    cbox(t, TL, 23.5, sd * 2.75, 0.55, 10.5, 1.4, 2.4, Td);           // iniş takımı kaportası
    for (const yy of [6.6, 12.4]) {
      const y = sd * yy;
      tube(t, TL, [[12.8, 0.15, 5.45, 1.0], [13.4, 0.85, 5.5, 1.1], [16.5, 0.95, 5.55, 1.15], [21.5, 0.6, 5.85], [22.5, 0.1, 6.0]], 10, Td);
      // gövde dışına kaydır: son eklenen nacelle köşelerini yana taşı
      shiftLast(t, 11 * 5, 0, 0, -y);
      const px = TL / 2 - 12.6, hz = 5.5;
      for (let b = 0; b < 8; b++) {
        const an = b / 8 * Math.PI * 2 + (yy > 10 ? 0.2 : 0), c = Math.cos(an), s = Math.sin(an), cp = Math.cos(an + 0.13), sp = Math.sin(an + 0.13);
        quad2(t, [[px, hz + s * 0.3, y + c * 0.3], [px, hz + s * 2.6, y + c * 2.6], [px - 0.05, hz + sp * 2.6, y + cp * 2.6], [px - 0.05, hz + sp * 0.3, y + cp * 0.3]], Dk);
      }
      tube(t, TL, [[12.2, 0.05, 5.5], [12.4, 0.35, 5.5], [12.9, 0.35, 5.5]], 8, Dk); shiftLast(t, 9 * 3, 0, 0, -y);
    }
  }
  fin(t, TL, [[33.5, 6.2], [41.8, 6.2], [44.8, 14.7], [41.9, 14.7]], 0.45, Tg);
  plate(t, TL, [[41.6, 0.2], [45.0, 0.2], [45.2, 9.8], [43.6, 9.8]], 14.35, 0.3, Tg);
  cbox(t, TL, 2.0, 0, 0, 0.5, 0.5, 1.4, Dk);
  // erken uyarı uçağı radarı (737 sırtındaki "şapka" anteni): iki dikme ve yassı kiriş
  const r = new GB([['color', 3]]), RL = 37.6, Rg = [0.6, 0.62, 0.64];
  cbox(r, RL, 20.5, 0, 4.6, 1.6, 0.5, 1.4, Rg); cbox(r, RL, 25.5, 0, 4.6, 1.6, 0.5, 1.4, Rg);
  cbox(r, RL, 23.0, 0, 6.0, 10.8, 0.7, 1.3, Rg); cbox(r, RL, 23.0, 0, 7.25, 4.0, 3.4, 0.22, Rg);
  for (const sd of [-1, 1]) fin(r, RL, [[31.5, 1.8], [34.5, 1.8], [34.2, 0.9], [32.5, 0.9]], 0.1, Rg, sd * 0.9);
  for (const g of [f, t, r]) for (let k = 0; k < g.n.length; k += 3) { const l = Math.hypot(g.n[k], g.n[k + 1], g.n[k + 2]) || 1; g.n[k] /= l; g.n[k + 1] /= l; g.n[k + 2] /= l; }
  MILG = { savas: f.geometry(), nakliye: t.geometry(), radar: r.geometry(), len: { savas: FL, nakliye: TL, aew: RL } };
  return MILG;
}
// son eklenen n köşeyi kaydır (GB depolaması: x, h, -yan)
function shiftLast(gb, n, dx, dh, dz) { for (let k = gb.count - n; k < gb.count; k++) { gb.p[k * 3] += dx; gb.p[k * 3 + 1] += dh; gb.p[k * 3 + 2] += dz; } }

let MM = null;
function milMats(ctx) {
  if (MM) return MM;
  const env = ctx.W.envMap ? ctx.W.envMap() : null;
  MM = {
    ac: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.2, roughness: 0.55, envMap: env, envMapIntensity: 0.6 }),
    grey737: new THREE.MeshStandardMaterial({ color: 0x9da3a8, vertexColors: true, metalness: 0.25, roughness: 0.5, envMap: env, envMapIntensity: 0.7, side: THREE.DoubleSide }),
    sig: new THREE.MeshLambertMaterial({ color: 0xa9a294 }),
    door: new THREE.MeshLambertMaterial({ color: 0x6c7377 }),
    doorD: new THREE.MeshLambertMaterial({ color: 0x5a6266 }),
    hole: new THREE.MeshLambertMaterial({ color: 0x15171a }),
    wallW: new THREE.MeshLambertMaterial({ color: 0xd9d6cf }),
    stone: new THREE.MeshLambertMaterial({ color: 0xd8c29c }),
    car: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
  return MM;
}

// örneklenmiş uçak yerleştirme: list [{x, y, hx, hy, sc}]
export function placeAircraft(ctx, geom, list, mat) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geom, mat, list.length);
  const o = new THREE.Object3D();
  list.forEach((p, i) => {
    o.position.set(p.x, (p.z != null ? p.z : Math.max(-0.3, Math.min(0.3, ctx.gh(p.x, p.y)))) + 0.12, -p.y);
    o.rotation.set(0, Math.atan2(p.hy, p.hx), 0); const sc = p.sc || 1; o.scale.set(sc, sc, sc); o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.computeBoundingSphere(); m.matrixAutoUpdate = false; m.name = 'ucaklar';
  ctx.grp.add(m);
  return m;
}
// askeri uçak türleri: savas, nakliye, aew (737 gövdesi + radar)
export function militaryAircraft(ctx, list) {
  const G = milGeoms(), MT = milMats(ctx);
  const by = (k) => list.filter((p) => p.tip === k);
  placeAircraft(ctx, G.savas, by('savas'), MT.ac);
  placeAircraft(ctx, G.nakliye, by('nakliye'), MT.ac);
  const aew = by('aew');
  if (aew.length) {
    const A = airlinerGeoms();
    placeAircraft(ctx, A.body, aew, MT.grey737); placeAircraft(ctx, A.tail, aew, MT.grey737); placeAircraft(ctx, G.radar, aew, MT.ac);
  }
}
// apron üstünde uçak sırası: apron çokgeninin uzun ekseni boyunca, 'side' kenarından 'inset' içeride, burun 'toward' noktasına
// side: 'far' (varsayılan) sıra 'toward' noktasından uzak kenarda, 'near' yakın kenarda; burun 'toward' yönüne
export function flightLine(P, { tip, gap, inset, side = 'far', toward, n = 99, sc = 1, skip = 0, len = 15, flip = false, avoid = null }) {
  const o = obbOf(P), out = [];
  const u = [o.c, o.s], v = [-o.s, o.c];
  let hx = v[0], hy = v[1];
  const mx = o.cx, my = o.cy;
  if (toward && (toward[0] - mx) * hx + (toward[1] - my) * hy < 0) { hx = -hx; hy = -hy; }
  const plusTow = hx * v[0] + hy * v[1] > 0;   // burun +v yönünde mi
  const b = (side === 'far') === plusTow ? o.b0 + inset : o.b1 - inset;
  if (flip) { hx = -hx; hy = -hy; }
  if (inset === 'auto') {
    // en çok uçak sığan sıra (eşitlikte istenen kenara yakın olan)
    let best = null;
    for (let t = 10; t < o.Wd - 10; t += 4) {
      const r = flightLine(P, { tip, gap, inset: t, side, toward, n, sc, skip, len, flip, avoid });
      if (!best || r.length > best.length) best = r;
    }
    return best || [];
  }
  let k = 0;
  for (let a = o.a0 + gap * 0.6; a <= o.a1 - gap * 0.4 && out.length < n; a += gap) {
    const x = a * u[0] + b * v[0], y = a * u[1] + b * v[1];
    const L = len * sc;
    const ok = [[0, 0], [L / 2, 0], [-L / 2, 0], [0, L * 0.4], [0, -L * 0.4]].every(([p, q]) => pip(P, x + hx * p - hy * q, y + hy * p + hx * q));
    if (!ok || (avoid && avoid(x, y))) continue;
    if (k++ < skip) continue;
    out.push({ tip, x, y, hx, hy, sc });
  }
  return out;
}

// ---------- hangarlar: duvar, alçak tonoz çatı, apron tarafında sürgülü büyük kapı ----------
// blds: [{P, h?, ad?}]; ayrıca ctx.solid'e çarpışma eklenir
export function hangars(ctx, blds) {
  const { d, M, gh } = ctx, MT = milMats(ctx);
  const wall = new GB(), roof = new GB(), door = new GB(), doorD = new GB(), trim = new GB();
  for (const b of blds) {
    const P = ccw(b.P), o = obbOf(P), A = alan(P);
    const H = b.h || (A > 4500 ? 19 : A > 2500 ? 16 : A > 1200 ? 13 : 9);
    const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5;
    const eave = base + H * 0.78;
    wall.prism(P, base, eave, false);
    barrel(roof, o, eave, base + H, 10);
    trim.prism(P, eave - 0.01, eave + 0.35, true);
    (ctx.solid || (ctx.solid = [])).push({ P, top: base + H, ad: b.ad || 'Hangar' });
    // kapı: uzun kenarlardan apron / taksi yoluna yakın olanı
    const u = [o.c, o.s], v = [-o.s, o.c];
    const long = o.L >= o.Wd;
    const cands = long ? [[v, o.Wd, o.L], [[-v[0], -v[1]], o.Wd, o.L]] : [[u, o.L, o.Wd], [[-u[0], -u[1]], o.L, o.Wd]];
    let best = null;
    for (const [nv, depth, width] of cands) {
      const mx = o.cx + nv[0] * depth / 2, my = o.cy + nv[1] * depth / 2;
      const dd = pavedDist(d, mx + nv[0] * 15, my + nv[1] * 15);
      if (!best || dd < best.dd) best = { nv, depth, width, mx, my, dd };
    }
    const { nv, width, mx, my } = best;
    const ang = Math.atan2(nv[1], nv[0]) + Math.PI / 2;
    const dw = width * 0.86, dh = (eave - base) * 0.86, np = Math.max(3, Math.round(dw / 7));
    const pw = dw / np;
    for (let k = 0; k < np; k++) {
      const off = -dw / 2 + pw * (k + 0.5);
      const x = mx + Math.cos(ang) * off + nv[0] * 0.35, y = my + Math.sin(ang) * off + nv[1] * 0.35;
      (k % 2 ? doorD : door).box(x, y, base, pw - 0.25, 0.7, dh, ang);
    }
    // kapı rayı başlığı
    door.box(mx + nv[0] * 0.6, my + nv[1] * 0.6, base + dh, dw + 1.5, 1.2, 1.1, ang);
  }
  const add = (gb, mat, name) => { if (!gb.count) return; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; ctx.grp.add(m); };
  add(wall, M.hangarWall, 'hangar-duvar'); add(roof, M.hangarRoof, 'hangar-cati'); add(trim, M.hangarWall, 'hangar-kenar');
  add(door, MT.door, 'hangar-kapi'); add(doorD, MT.doorD, 'hangar-kapi2');
}

// ---------- uçak sığınakları (betonarme tonoz, ön alın duvarı, sürgülü çelik kapı; bazıları açık, içinde savaş uçağı) ----------
export function shelters(ctx, blds, { open = 0.4, fighter = 0.8 } = {}) {
  const { d, gh } = ctx, MT = milMats(ctx);
  const shell = new GB(), door = new GB(), hole = new GB();
  const jets = [];
  for (const b of blds) {
    const P = ccw(b.P), o = obbOf(P);
    const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.4;
    const S = Math.min(o.L, o.Wd), Lg = Math.max(o.L, o.Wd);
    const H = Math.min(9.5, S * 0.5);
    barrel(shell, o, base, base + H, 12);
    // uzun eksen ve kapı ucu (taksi yoluna yakın uç)
    const u = o.L >= o.Wd ? [o.c, o.s] : [-o.s, o.c], v = [-u[1], u[0]];
    let e = 1;
    if (pavedDist(d, o.cx - u[0] * (Lg / 2 + 12), o.cy - u[1] * (Lg / 2 + 12)) < pavedDist(d, o.cx + u[0] * (Lg / 2 + 12), o.cy + u[1] * (Lg / 2 + 12))) e = -1;
    const nx = u[0] * e, ny = u[1] * e, ang = Math.atan2(ny, nx) + Math.PI / 2;
    const fx = o.cx + nx * Lg / 2, fy = o.cy + ny * Lg / 2;
    // ön alın duvarı (kapı çerçevesi) ve arka egzoz bloğu
    shell.box(fx - nx * 0.6, fy - ny * 0.6, base, S + 3.2, 2.2, H + 1.0, ang);
    shell.box(fx + v[0] * (S / 2 + 1.0) + nx * 1.2, fy + v[1] * (S / 2 + 1.0) + ny * 1.2, base, 1.2, 2.4, H * 0.75, ang);
    shell.box(fx - v[0] * (S / 2 + 1.0) + nx * 1.2, fy - v[1] * (S / 2 + 1.0) + ny * 1.2, base, 1.2, 2.4, H * 0.75, ang);
    shell.box(o.cx - nx * (Lg / 2 + 1.5), o.cy - ny * (Lg / 2 + 1.5), base, 5, 3, H * 0.45, ang);
    const isOpen = hash(o.cx, o.cy) < open;
    const dw = S * 0.86, dh = H * 0.86;
    if (isOpen) {
      hole.box(fx + nx * 0.55, fy + ny * 0.55, base + 0.05, dw * 0.96, 0.1, dh * 0.96, ang);
      for (const sd of [-1, 1]) door.box(fx + nx * 0.9 + v[0] * sd * (S / 2 + dw / 4 + 1.6), fy + ny * 0.9 + v[1] * sd * (S / 2 + dw / 4 + 1.6), base, dw / 2, 1.2, dh, ang);
      if (hash(o.cy, o.cx) < fighter) jets.push({ tip: 'savas', x: fx - nx * 1.5, y: fy - ny * 1.5, hx: nx, hy: ny, z: Math.max(-0.3, Math.min(0.3, gh(fx, fy))) });
    } else {
      for (const sd of [-1, 1]) door.box(fx + nx * 0.9 + v[0] * sd * dw / 4, fy + ny * 0.9 + v[1] * sd * dw / 4, base, dw / 2 - 0.1, 1.2, dh, ang);
    }
    (ctx.solid || (ctx.solid = [])).push({ P, top: base + H + 1, ad: 'Uçak sığınağı' });
  }
  const add = (gb, mat, name) => { if (!gb.count) return; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; ctx.grp.add(m); };
  add(shell, MT.sig, 'hangar-siginak'); add(door, MT.door, 'hangar-siginak-kapi'); add(hole, MT.hole, 'hangar-siginak-ic');
  return jets;
}

// ---------- küçük yapılar: düz çatılı destek binası, itfaiye (kırmızı kapılı) ----------
export function smallBuildings(ctx, blds) {
  const { d, M, gh } = ctx, MT = milMats(ctx);
  const wall = new GB(), roof = new GB(), red = new GB();
  for (const b of blds) {
    const P = ccw(b.P), base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5, H = b.h || 6;
    wall.prism(P, base, base + H, false);
    roof.prism(P, base + H, base + H + 0.6, true);
    (ctx.solid || (ctx.solid = [])).push({ P, top: base + H, ad: b.ad || 'Bina' });
    if (b.itfaiye) {
      const o = obbOf(P), u = o.L >= o.Wd ? [o.c, o.s] : [-o.s, o.c], v = [-u[1], u[0]];
      const Lg = Math.max(o.L, o.Wd), S = Math.min(o.L, o.Wd);
      const nv = pavedDist(d, o.cx + v[0] * (S / 2 + 15), o.cy + v[1] * (S / 2 + 15)) < pavedDist(d, o.cx - v[0] * (S / 2 + 15), o.cy - v[1] * (S / 2 + 15)) ? v : [-v[0], -v[1]];
      const n = Math.max(2, Math.floor(Lg / 9)), ang = Math.atan2(u[1], u[0]);
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * (Lg / n);
        red.box(o.cx + u[0] * off + nv[0] * (S / 2 + 0.15), o.cy + u[1] * off + nv[1] * (S / 2 + 0.15), base, Lg / n - 2.2, 0.3, H * 0.72, ang);
      }
      // gözetleme kulübesi
      wall.box(o.cx - u[0] * Lg * 0.3, o.cy - u[1] * Lg * 0.3, base + H, 6, 6, 3.2, ang);
    }
  }
  const add = (gb, mat, name) => { if (!gb.count) return; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; ctx.grp.add(m); };
  add(wall, MT.wallW, 'hangar-bina'); add(roof, M.roof, 'hangar-bina-cati'); add(red, M.red, 'hangar-itfaiye-kapi');
}

// ---------- terminal kanopisi ve otopark (kara tarafı) ----------
// kara tarafı yönü: terminal merkezinden apron merkezinin tersine; terminal grubuna 'kanopi' çocuğu eklenir
export function landside(ctx, tg, P, apronC, opt = {}) {
  const { M, gh } = ctx, MT = milMats(ctx);
  const o = obbOf(P), u = o.L >= o.Wd ? [o.c, o.s] : [-o.s, o.c];
  let v = [-u[1], u[0]];
  if ((apronC[0] - o.cx) * v[0] + (apronC[1] - o.cy) * v[1] > 0) v = [-v[0], -v[1]];
  const Lg = Math.max(o.L, o.Wd), S = Math.min(o.L, o.Wd);
  const [cx, cy] = [o.cx, o.cy];
  // cephe uzaklığı: dışarıdan içeri doğru ilk içerideki nokta
  let f = S / 2;
  for (let t = S; t > 0; t -= 1) if (pip(P, cx + v[0] * t, cy + v[1] * t)) { f = t; break; }
  const ang = Math.atan2(u[1], u[0]);
  const base = gh(cx + v[0] * (f + 6), cy + v[1] * (f + 6)) - 0.3;
  const can = new GB(), col = new GB();
  const cl = opt.canopyLen || Lg * 0.62, cd = opt.canopyDepth || 13, ch = opt.canopyH || 7.5;
  const ccx = cx + v[0] * (f + cd / 2), ccy = cy + v[1] * (f + cd / 2);
  can.box(ccx, ccy, base + ch, cl, cd, 0.9, ang);
  for (let a = -cl / 2 + 4; a <= cl / 2 - 3; a += 10) col.box(ccx + u[0] * a + v[0] * (cd / 2 - 1.2), ccy + u[1] * a + v[1] * (cd / 2 - 1.2), base, 0.7, 0.7, ch, ang);
  const mk = (gb, mat, nm) => { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; tg.add(m); };
  mk(can, M.white, 'kanopi'); mk(col, M.metal, 'kanopi-kolon');
  if (opt.park === false) return;
  // yol (kaldırım önü) ve otopark: araziye oturan ızgara, asfalt
  const asph = new GB([['tw', 2]]), lines = new GB(), cars = new GB([['color', 3]]);
  const grid = (ox, oy, A, B, st) => {
    const na = Math.max(1, Math.ceil(A / st)), nb = Math.max(1, Math.ceil(B / st)), s0 = asph.count;
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const a = -A / 2 + A * i / na, b = -B / 2 + B * j / nb, x = ox + u[0] * a + v[0] * b, y = oy + u[1] * a + v[1] * b;
      asph.vert(x, gh(x, y) + 0.05, y, 0, 1, 0, { tw: [9, 4] });
    }
    const i0 = asph.i.length;
    for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) { const a = s0 + j * (na + 1) + i; asph.quad(a, a + 1, a + na + 2, a + na + 1); }
    fixUp(asph, i0);
  };
  const roadOff = f + cd + 5, roadW = 12;
  grid(cx + v[0] * roadOff, cy + v[1] * roadOff, Lg * 1.05, roadW, 12);
  const pd = opt.parkDepth || 62, pl = opt.parkLen || Math.min(Lg * 0.9, 220);
  const pOff = roadOff + roadW / 2 + 10 + pd / 2;
  const pcx = cx + v[0] * pOff + u[0] * (opt.parkShift || 0), pcy = cy + v[1] * pOff + u[1] * (opt.parkShift || 0);
  grid(pcx, pcy, pl, pd, 12);
  // park yeri çizgileri ve arabalar: iki çift sıra (her biri 5 m derin, 2.6 m geniş)
  const PAL = [[0.85, 0.85, 0.86], [0.12, 0.12, 0.13], [0.55, 0.57, 0.6], [0.62, 0.1, 0.08], [0.15, 0.25, 0.5], [0.75, 0.75, 0.7], [0.3, 0.32, 0.34], [0.9, 0.9, 0.9]];
  for (const rb of [-pd / 2 + 6, -pd / 2 + 11, pd / 2 - 11, pd / 2 - 6]) {
    for (let a = -pl / 2 + 3; a <= pl / 2 - 3; a += 2.6) {
      const x = pcx + u[0] * a + v[0] * rb, y = pcy + u[1] * a + v[1] * rb;
      const h = gh(x, y);
      const lx = x + u[0] * 1.3, ly = y + u[1] * 1.3;
      lines.ribbon([[lx - v[0] * 2.4, ly - v[1] * 2.4], [lx + v[0] * 2.4, ly + v[1] * 2.4]], 0.12, h + 0.07, () => ({}));
      const r = hash(x, y);
      if (r < (opt.fill || 0.7)) {
        const c = PAL[Math.floor(hash(y, x) * PAL.length)], s = cars.count;
        cars.box(x, y, h + 0.25, 1.75, 4.3, 0.8, ang);
        cars.box(x + v[0] * (rb > 0 ? 0.25 : -0.25), y + v[1] * (rb > 0 ? 0.25 : -0.25), h + 1.05, 1.55, 2.3, 0.55, ang);
        paint(cars, s, c);
      }
    }
  }
  const addG = (gb, mat, nm, ro = 0) => { if (!gb.count) return; const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.renderOrder = ro; m.matrixAutoUpdate = false; ctx.grp.add(m); };
  addG(asph, M.apron, 'donanim-otopark', 2); addG(lines, M.paintW, 'cizgi', 5); addG(cars, MT.car, 'apron-araclari');
}
function fixUp(gb, i0) { for (let k = i0; k < gb.i.length; k += 3) { const p = gb.p, a = gb.i[k] * 3, b = gb.i[k + 1] * 3, c = gb.i[k + 2] * 3; const ny = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]); if (ny < 0) { const t = gb.i[k + 1]; gb.i[k + 1] = gb.i[k + 2]; gb.i[k + 2] = t; } } }

// ---------- apron ışık direkleri: apron kenarlarında, pist ve taksi yollarından uzak ----------
export function floodMasts(ctx, polys, step = 140) {
  const { d, M, gh } = ctx;
  const gb = new GB();
  const terms = d.bina.filter((b) => b.t === 'terminal' || b.t === 'hangar').map((b) => b.p);
  for (const P0 of polys) {
    const P = ccw(P0), [mx, my] = centroid(P);
    let per = 0; const n = P.length;
    for (let k = 0; k < n; k++) {
      const [ax, ay] = P[k], [bx, by] = P[(k + 1) % n], L = Math.hypot(bx - ax, by - ay);
      for (let s = (step - per % step) % step; s < L; s += step) {
        const t = s / L; let x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        const nx = (by - ay) / L, ny = -(bx - ax) / L; x += nx * 4; y += ny * 4; // dışarı
        if (runwayDist(d, x, y) < 110) continue;
        let near = false;
        for (const tw of d.twy) for (let q = 0; q < tw.p.length - 1 && !near; q++) if (segDist(x, y, tw.p[q][0], tw.p[q][1], tw.p[q + 1][0], tw.p[q + 1][1]) < tw.w / 2 + 12) near = true;
        if (near || terms.some((T) => pip(T, x, y) || nearestEdge(T, x, y).d < 6)) continue;
        const g = gh(x, y) - 0.3, ang = Math.atan2(my - y, mx - x);
        gb.box(x, y, g, 1.4, 1.4, 0.6, ang);
        gb.lathe(x, y, [[0.45, 0], [0.22, 26]], 6, g);
        gb.box(x, y, g + 25.5, 1.0, 4.2, 1.6, ang);
      }
      per += L;
    }
  }
  if (!gb.count) return;
  const m = new THREE.Mesh(gb.geometry(), M.metal); m.name = 'donanim-direk'; m.matrixAutoUpdate = false; ctx.grp.add(m);
}

// genel hangar / kule ağlarını kaldır (bu modüller kendileri çizer)
export function dropGeneric(ctx) {
  for (const c of ctx.grp.children.slice()) if (/^(hangar-duvar|hangar-cati|hangar-kenar)$/.test(c.name)) { ctx.grp.remove(c); c.geometry.dispose(); }
  ctx.solid = [];
}
// yinelenen OSM binalarını ayıkla (aynı taban iki kez: kimlikli ve kimliksiz)
export function uniq(bina) {
  const s = new Map();
  for (const b of bina) { const k = b.t + ':' + Math.round(b.p[0][0]) + ':' + Math.round(b.p[0][1]); const q = s.get(k); if (!q || (b.n && !q.n) || (b.id && !q.id)) s.set(k, b); }
  return [...s.values()];
}
// sivil kurulum: seçili terminaller, sivil park yerlerine yolcu uçakları, köprüler, araçlar
export function civil(ctx, { terminals, civilArea, occ = 0.55, bridges = true, kopru = null }) {
  const { d } = ctx;
  // aynı yeri gösteren park yerlerinden (201 / 201A / 201B gibi) yalnız biri
  const S = [];
  for (const s of stands(d)) if (civilArea(s.x, s.y) && (s.pt || !S.some((q) => !q.pt && Math.hypot(q.x - s.x, q.y - s.y) < 36))) S.push(s);
  ctx.stands = S;
  const terms = [], groups = [];
  for (const t of terminals) { groups.push(terminal(ctx, t.id, t.ad, t.P, t)); terms.push(t.P); }
  standsAndAircraft(ctx, { occ });
  const dd = kopru ? { ...d, kopru } : d;
  jetBridges({ ...ctx, d: dd }, bridges ? terms : [], S);
  vehicles(ctx, S);
  return groups;
}
// OSM köprü parçalarından köprü çizgileri: uzun parçalar, terminal ucu başta
export function bridgeLines(d, termP) {
  const out = [];
  for (const k of d.kopru) {
    const a = k[0], b = k[k.length - 1]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 12) continue;
    const da = nearestEdge(termP, a[0], a[1]).d, db = nearestEdge(termP, b[0], b[1]).d;
    out.push(da <= db ? [a, b] : [b, a]);
  }
  return out;
}

export function build(ctx) {
  const { d } = ctx;
  dropGeneric(ctx);
  const B = uniq(d.bina);
  const T = B.filter((b) => b.t === 'terminal');
  const byName = (re) => T.find((b) => re.test(b.n || ''));
  const yeni = T.find((b) => !b.n) || T.reduce((a, b) => (alan(b.p) > alan(a.p) ? b : a));
  const dis = byName(/Dış/), ic = byName(/İç/);
  // sivil alan: güneydeki apronlar (pistin güneyi)
  const r = d.rws[0], rux = (r.b[0] - r.a[0]) / r.len, ruy = (r.b[1] - r.a[1]) / r.len;
  const south = (x, y) => -(x - r.a[0]) * ruy + (y - r.a[1]) * rux < -40;
  const terms = [
    { id: (yeni.id || 'yeni').toString(), ad: 'Kayseri Havalimanı Yeni Terminal', P: yeni.p, h: 19, roof: 'dalga', overhang: 9, skyStep: 26 },
  ];
  if (dis) terms.push({ id: (dis.id || 'dis').toString(), ad: 'Dış Hatlar Terminali', P: dis.p, h: 11, roof: 'duz', overhang: 3 });
  if (ic) terms.push({ id: (ic.id || 'ic').toString(), ad: 'İç Hatlar Terminali', P: ic.p, h: 11, roof: 'duz', overhang: 3 });
  const kop = bridgeLines(d, yeni.p);
  const groups = civil(ctx, { terminals: terms, civilArea: south, occ: 0.6, kopru: kop });
  const civApr = d.apron.filter((pl) => south(...centroid(pl[0])));
  const apC = centroid(civApr.flatMap((pl) => pl[0]));
  landside(ctx, groups[0], yeni.p, apC, { canopyH: 8.5, canopyDepth: 14, parkLen: 230, parkDepth: 70 });
  for (const g of groups.slice(1)) landside(ctx, g, g.userData.taban, apC, { canopyH: 5.5, canopyDepth: 8, park: false });
  // sivil kule (DHMİ): eski terminallerle yeni terminal arasında, kara tarafında
  towerModern(ctx, -785, -770, 42, 0.35, 'kule');
  // askeri taraf: hangarlar (kuzeybatı bakım merkezi ve kuzeydoğu üs), küçük yapılar
  const H = B.filter((b) => b.t === 'hangar');
  hangars(ctx, H.filter((b) => alan(b.p) >= 1000).map((b) => ({ P: b.p, ad: 'Hangar' })));
  smallBuildings(ctx, H.filter((b) => alan(b.p) < 1000).map((b) => ({ P: b.p, h: 7, ad: 'Hizmet binası' })));
  const mt = towerClassic(ctx, -600, 70, 30); ctx.parts.delete('kule'); mt.name = 'kule:askeri'; mt.userData.id = 'kule:askeri'; ctx.parts.set('kule:askeri', mt);
  ctx.parts.set('kule', ctx.grp.children.find((c) => c.name === 'kule'));
  // nakliye uçakları: kuzeydoğu büyük apron (A400M ve C-130 boyutunda), kuzeybatı bakım apronu
  const north = d.apron.filter((pl) => !south(...centroid(pl[0])));
  const rc = [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2];
  const jets = [];
  for (const pl of north) {
    const big = alan(pl[0]) > 150000;
    const row = flightLine(pl[0], { tip: 'nakliye', gap: big ? 62 : 58, inset: big ? 70 : 50, toward: rc, n: big ? 99 : 6, len: 45 });
    row.forEach((p, i) => { if (hash(p.x, p.y) < (big ? 0.62 : 0.8)) { if (i % 3 === 2) p.sc = 0.68; jets.push(p); } });
  }
  militaryAircraft(ctx, jets);
  floodMasts(ctx, d.apron.map((pl) => pl[0]));
}
