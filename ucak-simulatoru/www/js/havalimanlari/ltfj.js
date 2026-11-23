// Sabiha Gökçen Havalimanı (LTFJ, SAW). Dış görünüş, OSM tabanlarından ve gerçek yerleşimden:
// - Dış hatlar terminali (2009, Tekeli-Sisa; 48 m açıklıklı çelik çatı): ana kütlenin çatısı 6 x 3 kare kubbe modülü,
//   her kubbenin ortasında yuvarlak ışıklık; apron boyunca uzanan cam iskele ve kuzey iskele dalgalı çatılı;
//   kara tarafında geniş saçak, kalkış katı viyadüğü ve önünde çok katlı otopark (katlarda ve çatıda arabalar).
// - İç hatlar terminali (eski terminal binası, dalgalı ışıklıklı çatı), VIP terminali ve eski kule yanındaki küçük yapılar.
// - Yeni kule (91 m, 2023; lale esintili): yukarıda açılan üç yaprak kanat, iki kontrol katı (yer ve hava).
// - Eski kule (~40 m), bakım hangarları (geniş ve dar gövde, genel havacılık; markasız: büyük sürgülü kapılar, kapı
//   kirişi, yanda ofis bloğu), kargo terminali (batı apronu), apron projektör direkleri, OSM'deki yolcu köprüleri
//   (sabit bağlantı + döner gövde + apron sürüşlü tünel), park etmiş uçaklar ve apron araçları.
// Terminaller ayrı parça: ctx.parts.get('terminal:dis-hatlar'), 'terminal:ic-hatlar', 'terminal:vip' (userData.taban ...).
// Çizim: renkli yapılar köşe rengiyle tek ağda; ayrıntılar (otopark arabaları, köprüler, direkler) uzakta gizlenir.
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, barrel, stands, standsAndAircraft, genericTower } from '../havalimani.js';
import { terminal, vehicles, pip } from './ortak.js';

// ana eksen: apron iskelesi (OSM tabanının uzun kenarı), u iskele boyunca (doğu-kuzeydoğu), v kara tarafına doğru
const ANG = 0.46018;
const CA = Math.cos(ANG), SA = Math.sin(ANG);
const xy = (u, v) => [u * CA - v * SA, u * SA + v * CA];
const uv = (x, y) => [x * CA + y * SA, -x * SA + y * CA];
const rect = (u0, u1, v0, v1) => [xy(u0, v0), xy(u1, v0), xy(u1, v1), xy(u0, v1)];
const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const area = (P) => Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

let VC = null;   // köşe renkli ortak malzeme
const vcMat = () => VC || (VC = new THREE.MeshLambertMaterial({ vertexColors: true }));

// renk: gb'ye son eklenen köşeleri boya
function paint(gb, s, c) { const v = gb.a.color.v; for (let k = s; k < gb.count; k++) { v[k * 3] = c[0]; v[k * 3 + 1] = c[1]; v[k * 3 + 2] = c[2]; } }
const CB = () => new GB([['color', 3]]);
function cbox(gb, c, x, y, h0, w, d, hh, ang) { const s = gb.count; gb.box(x, y, h0, w, d, hh, ang); paint(gb, s, c); }
function cprism(gb, c, P, h0, h1, top = true) { const s = gb.count; gb.prism(P, h0, h1, top); paint(gb, s, c); }
function clathe(gb, c, x, y, prof, seg, h0) { const s = gb.count; gb.lathe(x, y, prof, seg, h0); paint(gb, s, c); }
// dörtgen yüz: yön, köşe normaline göre düzeltilir (sarım hatası olmasın)
function face(gb, a, b, c, d) {
  const P = gb.p, N = gb.n;
  const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
  const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
  const nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
  if (nx * N[a * 3] + ny * N[a * 3 + 1] + nz * N[a * 3 + 2] >= 0) gb.quad(a, b, c, d); else gb.quad(a, d, c, b);
}
// cam prizma (cephe dokusu: 3 m bölme x kat yüksekliği)
function glassPrism(gb, P, h0, h1, fl = 4.5) {
  const s = gb.uv.length; gb._per = 0;
  gb.prism(P, h0, h1, false);
  for (let k = s; k < gb.uv.length; k += 2) { gb.uv[k] /= 3.0; gb.uv[k + 1] = (gb.uv[k + 1] - h0) / fl; }
}
function mesh(grp, gb, mat, name) { if (!gb.count) return null; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; grp.add(m); return m; }

// ---------- kare kubbe (yastık biçimli), merkez (u, v), boyut su x sv, z0 tabanı ----------
function dome(gb, c, cu, cv, su, sv, z0, rise, n = 8) {
  const s0 = gb.count;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const a = i / n * 2 - 1, b = j / n * 2 - 1;
    const fa = 1 - a * a, fb = 1 - b * b;
    const z = z0 + rise * Math.pow(fa * fb, 0.75);
    const g = 0.75 * Math.pow(Math.max(fa * fb, 1e-3), -0.25) * rise;
    const du = g * (-2 * a) * fb / (su / 2), dv = g * (-2 * b) * fa / (sv / 2);
    const [x, y] = xy(cu + a * su / 2, cv + b * sv / 2);
    const nu = -du, nv = -dv, L = Math.hypot(nu, nv, 1);
    gb.vert(x, z, y, (nu * CA - nv * SA) / L, 1 / L, (nu * SA + nv * CA) / L);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = s0 + i * (n + 1) + j; face(gb, a, a + n + 1, a + n + 2, a + 1); }
  paint(gb, s0, c);
}
// dalgalı çatı şeridi: (u0, v0) -> (u1, v1) ekseni boyunca, en w, z = h + amp * dalga, kenarda alın bandı
function waveRoof(gb, c, u0, v0, u1, v1, w, h, amp, period) {
  const L = Math.hypot(u1 - u0, v1 - v0), tu = (u1 - u0) / L, tv = (v1 - v0) / L, nu = -tv, nv = tu;
  const N = Math.max(2, Math.ceil(L / 3));
  const zf = (t) => h + amp * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / period));
  const s0 = gb.count;
  for (let k = 0; k <= N; k++) {
    const t = k / N * L, z = zf(t), dz = (zf(t + 0.5) - zf(t - 0.5));
    const l = Math.hypot(dz, 1);
    const enu = -dz * tu / l, env = -dz * tv / l;
    for (const sd of [-1, 1]) {
      const [x, y] = xy(u0 + tu * t + nu * sd * w / 2, v0 + tv * t + nv * sd * w / 2);
      gb.vert(x, z, y, enu * CA - env * SA, 1 / l, enu * SA + env * CA);
    }
  }
  for (let k = 0; k < N; k++) { const a = s0 + k * 2; face(gb, a, a + 2, a + 3, a + 1); }
  // yan alın bantları
  for (const sd of [-1, 1]) {
    const s1 = gb.count, onx = nu * sd, ony = nv * sd;
    const n3 = [onx * CA - ony * SA, onx * SA + ony * CA];
    for (let k = 0; k <= N; k++) {
      const t = k / N * L, [x, y] = xy(u0 + tu * t + nu * sd * w / 2, v0 + tv * t + nv * sd * w / 2);
      gb.vert(x, h - 1.4, y, n3[0], 0, n3[1]); gb.vert(x, zf(t), y, n3[0], 0, n3[1]);
    }
    for (let k = 0; k < N; k++) { const a = s1 + k * 2; face(gb, a, a + 2, a + 3, a + 1); }
  }
  paint(gb, s0, c);
}

// ---------- dış hatlar terminali ----------
const WHITE = [0.93, 0.93, 0.91], ROOFC = [0.82, 0.83, 0.84], CONC = [0.74, 0.73, 0.70], DARK = [0.22, 0.24, 0.27], STEEL = [0.62, 0.65, 0.68];
function intlTerminal(ctx, b) {
  const { M, gh } = ctx;
  const P = b.p;
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.6;
  const grp = new THREE.Group();
  const glass = new GB(); glass.uv = [];
  const sky = new GB(); sky.uv = [];
  const solid = CB();
  // iskeleler (OSM tabanının tamamı): 13 m cam cephe, düz çatı + dalgalı çatı
  const hP = 13;
  glassPrism(glass, P, base, hP);
  cprism(solid, CONC, inflate(P, 0.15), base, 0.5, false);
  cprism(solid, ROOFC, inflate(P, 2.5), hP, hP + 1.0);
  waveRoof(solid, WHITE, 462, 1050, 1120, 1050, 36, hP + 1.2, 2.4, 43);
  waveRoof(solid, WHITE, 1016, 1066, 1016, 1260, 34, hP + 1.2, 2.4, 43);
  // ana kütle: 26 m cam, 6 x 3 kare kubbe (her biri ~46 x 43 m), ortalarında ışıklık
  const U0 = 666, U1 = 941, V0 = 1060, V1 = 1189, hM = 25;
  const MB = rect(U0, U1, V0, V1);
  glassPrism(glass, MB, base, hM, 5.0);
  cprism(solid, WHITE, inflate(MB, 2.0), hM, hM + 2.4);
  const nu = 6, nv = 3, su = (U1 - U0 + 4) / nu, sv = (V1 - V0 + 4) / nv;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const cu = U0 - 2 + su * (i + 0.5), cv = V0 - 2 + sv * (j + 0.5);
    dome(solid, WHITE, cu, cv, su - 0.6, sv - 0.6, hM + 2.4, 6.5, 8);
    const [x, y] = xy(cu, cv);
    sky.lathe(x, y, [[4.6, 0], [4.6, 1.1], [3.4, 2.0], [0.05, 2.5]], 10, hM + 2.4 + 6.5 - 0.6);
  }
  // kara tarafı saçağı (20 m) ve ağaç kolonlar
  const cnp = rect(U0 - 10, U1 + 10, V1, V1 + 21);
  cprism(solid, WHITE, cnp, hM - 3.2, hM - 2.0);
  for (let u = U0 + 8; u < U1; u += 26) {
    const [x, y] = xy(u, V1 + 14);
    clathe(solid, STEEL, x, y, [[0.55, 0], [0.45, 12], [1.6, 16], [3.2, hM - 3.2 - base]], 8, base);
  }
  // kalkış katı viyadüğü (+7 m), korkuluk ve ayaklar
  const vd0 = V1 + 4, vd1 = V1 + 26, hv = 6.5;
  cprism(solid, CONC, rect(U0 - 60, U1 + 60, vd0, vd1), hv, hv + 1.0);
  cprism(solid, CONC, rect(U0 - 60, U1 + 60, vd1 - 0.4, vd1), hv + 1.0, hv + 2.1);
  for (let u = U0 - 50; u <= U1 + 50; u += 24) { const [x, y] = xy(u, (vd0 + vd1) / 2); cbox(solid, CONC, x, y, base, 1.6, 12, hv - base, ANG); }
  // rampalar (iki uçta, viyadükten yere)
  for (const e of [-1, 1]) {
    const ue = e < 0 ? U0 - 60 : U1 + 60, s0 = solid.count;
    const tq = (u, v, h) => { const [x, y] = xy(u, v); return solid.vert(x, h, y, 0, 1, 0); };
    const gl = (u, v) => Math.max(base, gh(...xy(u, v)) + 0.1);
    const ue2 = ue + e * 90;
    face(solid, tq(ue, vd0 + 6, hv + 1.0), tq(ue2, vd0 + 6, gl(ue2, vd0 + 6)), tq(ue2, vd1, gl(ue2, vd1)), tq(ue, vd1, hv + 1.0));
    paint(solid, s0, CONC);
  }
  // çatı üstü teknik kutular
  for (let k = 0; k < 4; k++) { const [x, y] = xy(500 + k * 150, 1058); cbox(solid, STEEL, x, y, hP + 1.0, 14, 6, 2.6, ANG); }
  mesh(grp, glass, M.glass, 'cephe'); mesh(grp, sky, M.glass, 'isiklik'); mesh(grp, solid, vcMat(), 'cati');
  grp.userData = { id: 'dis-hatlar', ad: 'Dış Hatlar Terminali', taban: P, yukseklik: hM + 2.4, katYuksekligi: 5.0, kotu: base, anaKutle: MB, iskeleYuksekligi: hP };
  grp.matrixAutoUpdate = false;
  return ctx.part('terminal:dis-hatlar', grp);
}

// ---------- çok katlı otopark (dış hatlar terminalinin önünde) ----------
function carPark(ctx, det) {
  const { gh } = ctx;
  const U0 = 700, U1 = 910, V0 = 1250, V1 = 1338, lv = 3, fh = 3.2;
  const R = rect(U0, U1, V0, V1);
  const base = Math.min(...R.map(([x, y]) => gh(x, y))) - 0.4;
  const gb = CB(), cars = CB();
  const CARS = [[0.85, 0.85, 0.86], [0.12, 0.12, 0.13], [0.55, 0.57, 0.6], [0.42, 0.12, 0.1], [0.15, 0.22, 0.38], [0.9, 0.9, 0.88], [0.35, 0.36, 0.38]];
  for (let k = 0; k <= lv; k++) {
    const h = base + k * fh + 0.4;
    cprism(gb, CONC, inflate(R, k ? 0 : 0.2), h - 0.4, h);
    if (k) for (const [a, b2] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
      // korkuluk bandı (kenar boyunca ince duvar)
      const [ax, ay] = R[a], [bx, by] = R[b2], L = Math.hypot(bx - ax, by - ay), an = Math.atan2(by - ay, bx - ax);
      const nx = (by - ay) / L, ny = -(bx - ax) / L;
      cbox(gb, k === lv ? CONC : [0.80, 0.79, 0.76], (ax + bx) / 2 - nx * 0.15, (ay + by) / 2 - ny * 0.15, h, L, 0.3, 1.05, an);
    }
    // arabalar: sıralar v boyunca 16 m arayla, her sırada iki dizi
    for (let v = V0 + 8; v < V1 - 4; v += 16) for (const off of [-2.6, 2.6]) for (let u = U0 + 4; u < U1 - 4; u += 2.6) {
      const r = hash(u * 1.3 + k * 7, v + off);
      if (r > (k === lv ? 0.45 : 0.5)) continue;
      if (k === 0 || (k < lv && Math.abs(v + off - (V0 + V1) / 2) < 38 && u > U0 + 12 && u < U1 - 12)) continue;   // alt katlarda yalnız kenardan görünenler
      const [x, y] = xy(u, v + off);
      cbox(cars, CARS[Math.floor(hash(u, v * 3 + k) * CARS.length)], x, y, h, 1.8, 4.4, 1.45, ANG + Math.PI / 2);
    }
  }
  // kolonlar
  for (let u = U0 + 8; u < U1; u += 16) for (let v = V0 + 8; v < V1; v += 16) { const [x, y] = xy(u, v); cbox(gb, CONC, x, y, base, 0.6, 0.6, lv * fh + 0.4, ANG); }
  // sarmal rampa kulesi ve merdiven/asansör kuleleri
  const [rx, ry] = xy(U1 + 18, (V0 + V1) / 2);
  for (let k = 0; k < lv * 2; k++) clathe(gb, CONC, rx, ry, [[15, 0], [15, 0.4], [16, 0.4], [16, 1.4]], 20, base + k * fh / 2);
  clathe(gb, CONC, rx, ry, [[6, 0], [6, lv * fh + 1.5]], 14, base);
  for (const u of [U0 + 2, (U0 + U1) / 2]) { const [x, y] = xy(u, V0 - 3); cbox(gb, [0.3, 0.42, 0.5], x, y, base, 8, 6, lv * fh + 3.5, ANG); }
  // kara tarafı geliş yolu: zemin seviyesinde otobüs ve taksiler (renkli kutular)
  for (let u = 640; u < 1000; u += 11) { const r = hash(u, 7); if (r > 0.55) continue; const [x, y] = xy(u, 1189 + 14); cbox(cars, r < 0.25 ? [0.95, 0.78, 0.1] : [0.9, 0.9, 0.9], x, y, Math.max(base, gh(x, y)) + 0.1, r < 0.12 ? 12 : 4.5, r < 0.12 ? 2.5 : 1.8, r < 0.12 ? 3.1 : 1.5, ANG); }
  const g = new THREE.Group(); g.name = 'otopark'; g.matrixAutoUpdate = false;
  mesh(g, gb, vcMat(), 'otopark-yapi');
  const cm = mesh(det, cars, vcMat(), 'otopark-arabalar');
  void cm;
  ctx.grp.add(g);
  (ctx.solid || (ctx.solid = [])).push({ P: R, top: base + lv * fh + 1.5, ad: 'Otopark' });
}

// ---------- yolcu köprüleri: OSM çizgileri (bina içinde kalan kısım atlanır) ----------
function bridges(ctx, terms, det) {
  const { d } = ctx;
  const tube = CB(), sup = CB();
  const TUBE = [0.78, 0.80, 0.82], GL = [0.36, 0.45, 0.52];
  const inside = (x, y) => terms.some((P) => pip(P, x, y));
  for (const k of d.kopru) {
    // yakın noktaları birleştir
    const pts = [];
    for (const p of k) if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 2.5) pts.push(p);
    if (pts.length < 2) continue;
    // bina içindeki baştaki ve sondaki noktaları at (en az birini cephe noktası olarak tut)
    let i0 = 0; while (i0 < pts.length - 2 && inside(pts[i0 + 1][0], pts[i0 + 1][1])) i0++;
    let i1 = pts.length - 1; while (i1 > i0 + 1 && inside(pts[i1 - 1][0], pts[i1 - 1][1])) i1--;
    let Q = pts.slice(i0, i1 + 1);
    if (inside(Q[Q.length - 1][0], Q[Q.length - 1][1]) && !inside(Q[0][0], Q[0][1])) Q = Q.reverse();
    if (Q.length < 2) continue;
    const total = Q.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - Q[i - 1][0], p[1] - Q[i - 1][1]) : 0), 0);
    let run = 0;
    for (let i = 0; i < Q.length - 1; i++) {
      const [ax, ay] = Q[i], [bx, by] = Q[i + 1], L = Math.hypot(bx - ax, by - ay), an = Math.atan2(by - ay, bx - ax);
      const t0 = run / total, t1 = (run + L) / total; run += L;
      const h = 5.2 - 1.4 * (t0 + t1) / 2, last = i === Q.length - 2;
      const w = last ? 2.9 : 3.3, hh = last ? 2.7 : 3.0;
      cbox(tube, i === 0 ? GL : TUBE, (ax + bx) / 2, (ay + by) / 2, h, L + (last ? 0 : 1.2), w, hh, an);
      cbox(tube, DARK, (ax + bx) / 2, (ay + by) / 2, h + hh, L + (last ? 0 : 1.2), w + 0.2, 0.25, an);
      if (i > 0) {   // döner gövde ve ayak
        clathe(sup, STEEL, ax, ay, [[2.3, 0], [2.3, 3.6]], 10, h - 0.4);
        clathe(sup, DARK, ax, ay, [[0.45, 0], [0.45, h - 0.4]], 6, 0);
      }
      if (last) {
        // sürüş ayağı (iki tekerlek) ve uçak ucu kabini
        const fx = ax + (bx - ax) * 0.7, fy = ay + (by - ay) * 0.7;
        cbox(sup, DARK, fx, fy, 0.9, 0.5, 0.5, h - 0.9, an);
        cbox(sup, DARK, fx, fy, 0, 1.2, 3.6, 0.95, an);
        cbox(tube, TUBE, bx - Math.cos(an) * 1.3, by - Math.sin(an) * 1.3, h - 0.3, 2.6, 4.0, hh + 0.5, an);
        cbox(tube, DARK, bx - Math.cos(an) * 0.1, by - Math.sin(an) * 0.1, h, 0.4, 3.4, hh, an);
      } else if (i === 0 && L > 12) {
        // sabit bağlantının ayakları
        for (let s = 10; s < L - 4; s += 12) { const x = ax + (bx - ax) * s / L, y = ay + (by - ay) * s / L; cbox(sup, CONC, x, y, 0, 0.7, 0.7, h, an); }
      }
    }
  }
  const g = new THREE.Group(); g.name = 'yolcu-kopruleri'; g.matrixAutoUpdate = false;
  mesh(g, tube, vcMat(), 'kopru-tunel'); mesh(g, sup, vcMat(), 'kopru-ayak');
  det.add(g);
}

// ---------- yeni kule (91 m, lale esintili): ince gövde, yukarıda açılan üç yaprak, iki kontrol katı ----------
function towerSAW(ctx, x, y, H = 91) {
  const { M, gh } = ctx;
  const base = gh(x, y) - 0.5;
  const shell = new GB(), cab = new GB(), dark = new GB(), leaf = new GB();
  // gövde: dairesel, hafif incelen
  shell.lathe(x, y, [[8.5, 0], [7.2, 6], [6.0, 18], [5.4, H * 0.55], [5.6, H - 24]], 20, base);
  // yapraklar: gövdeden çıkıp kabini saran üç ince kabuk (her biri 70° yay)
  const prof = [[5.5, H * 0.36], [6.2, H * 0.52], [8.0, H * 0.66], [11.0, H - 23], [14.0, H - 15], [15.2, H - 8], [14.6, H - 2]];
  for (let p = 0; p < 3; p++) {
    const a0 = p * 2.094 + 0.35, a1 = a0 + 1.2, n = 10;
    for (const off of [0, -0.5]) {
      const s0 = leaf.count;
      for (let k = 0; k <= n; k++) {
        const a = a0 + (a1 - a0) * k / n, c = Math.cos(a), s = Math.sin(a);
        for (const [r, h] of prof) leaf.vert(x + c * (r + off), base + h, y + s * (r + off), c * (off ? -1 : 1), 0.1, s * (off ? -1 : 1));
      }
      const L = prof.length;
      for (let k = 0; k < n; k++) for (let j = 0; j < L - 1; j++) { const a = s0 + k * L + j; face(leaf, a, a + L, a + L + 1, a + 1); }
    }
  }
  // alt kontrol katı (yer trafiği) ve üst kontrol katı (hava trafiği)
  dark.lathe(x, y, [[5.6, 0], [8.6, 2.0], [9.2, 3.2]], 16, base + H - 24);
  cab.lathe(x, y, [[8.6, 0], [9.6, 4.2]], 16, base + H - 20.8);
  shell.lathe(x, y, [[9.9, 0], [9.9, 1.0], [8.4, 1.2], [8.6, 2.8]], 16, base + H - 16.6);
  cab.lathe(x, y, [[8.6, 0], [10.4, 5.4]], 16, base + H - 13.8);
  shell.lathe(x, y, [[11.0, 0], [11.0, 1.2], [7.0, 2.6], [3.0, 3.4], [0.05, 3.6]], 16, base + H - 8.4);
  shell.box(x, y, base + H - 5, 0.5, 0.5, 9, 0);
  // tabandaki teknik blok
  dark.box(x + 14, y - 6, base, 26, 16, 8, 0.4);
  shell.box(x + 14, y - 6, base + 8, 27, 17, 0.8, 0.4);
  const grp = new THREE.Group();
  for (const [gb, mat, nm] of [[shell, M.white, 'govde'], [leaf, M.metal, 'yaprak'], [cab, M.cab, 'kabin'], [dark, M.dark, 'teknik']]) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; grp.add(m); }
  grp.matrixAutoUpdate = false;
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 15, top: ctx.d.elev + base + H });
  return ctx.part('kule', grp);
}
function oldTower(ctx, x, y, H) {
  const { M, gh } = ctx;
  const metal = new GB(), cab = new GB();
  genericTower(metal, cab, x, y, gh(x, y) - 0.5, H);
  const grp = new THREE.Group();
  for (const [gb, mat] of [[metal, M.conc], [cab, M.cab]]) { const m = new THREE.Mesh(gb.geometry(), mat); m.matrixAutoUpdate = false; grp.add(m); }
  grp.matrixAutoUpdate = false;
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 7, top: ctx.d.elev + gh(x, y) + H });
  return ctx.part('kule-eski', grp);
}
function addCol(ctx, c) {
  const W = ctx.W, k = Math.round(c.x) + ':' + Math.round(c.y);
  W._apCol = W._apCol || new Set();
  if (W._apCol.has(k)) return; W._apCol.add(k); W.lmCol.push(c);
}

// ---------- bakım hangarları (markasız): kapı tarafı apron/taksi yoluna bakar ----------
function hangars(ctx) {
  const { d, gh, grp } = ctx;
  // genel kurulumun hangarlarını kaldır, yerine ayrıntılılarını kur
  for (const c of [...grp.children]) if (/^hangar-(duvar|cati|kenar)$/.test(c.name)) { grp.remove(c); c.geometry.dispose(); }
  ctx.solid = (ctx.solid || []).filter((s) => !/hangar/i.test(s.ad) && !d.bina.some((b) => b.t === 'hangar' && b.p === s.P));
  const gb = CB(), seen = new Set();
  const WALL = [0.80, 0.82, 0.84], RF = [0.66, 0.69, 0.72], DOOR = [0.58, 0.62, 0.66], DOOR2 = [0.66, 0.70, 0.74], HEAD = [0.92, 0.92, 0.9], OFF = [0.9, 0.89, 0.86], WIN = [0.2, 0.27, 0.33];
  const onPave = (x, y) => d.apron.some((pl) => pip(pl[0], x, y)) || d.twy.some((t) => t.p.some((p) => Math.hypot(p[0] - x, p[1] - y) < 40));
  for (const b of d.bina) {
    if (b.t !== 'hangar') continue;
    const key = b.p[0][0] + ':' + b.p[0][1]; if (seen.has(key)) continue; seen.add(key);
    const P = b.p, A = area(P), o = obbOf(P);
    const H = A > 30000 ? 30 : A > 12000 ? 24 : A > 6000 ? 16 : 11;
    const Hw = H - 3.5;
    const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5;
    cprism(gb, WALL, P, base, Hw, false);
    const s0 = gb.count; barrel(gb, o, Hw, H, 10); paint(gb, s0, RF);
    cprism(gb, RF, P, Hw - 0.02, Hw, true);
    // kapı tarafı: OBB'nin dört kenarından önünde kaplama olan, en uzun olanı
    const ux = o.c, uy = o.s, vx = -uy, vy = ux;
    const sides = [[ux, uy, o.Wd / 2, o.L], [-ux, -uy, o.Wd / 2, o.L], [vx, vy, o.L / 2, o.Wd], [-vx, -vy, o.L / 2, o.Wd]].map(([nx, ny, half, len]) => {
      // half: merkezden kenara uzaklık (nx yönünde); len: kenar boyu
      const off = nx === ux || nx === -ux ? o.L / 2 : o.Wd / 2;
      const mx = o.cx + nx * off, my = o.cy + ny * off;
      void half;
      return { nx, ny, mx, my, len: nx === ux || nx === -ux ? o.Wd : o.L, pave: onPave(mx + nx * 35, my + ny * 35) };
    });
    sides.sort((p, q) => (q.pave - p.pave) || (q.len - p.len));
    const S = sides[0];
    const an = Math.atan2(S.ny, S.nx) + Math.PI / 2;   // kenar boyunca
    const nP = Math.max(4, Math.round(S.len * 0.9 / 12));
    const pw = S.len * 0.9 / nP;
    for (let k = 0; k < nP; k++) {
      const t = (k + 0.5) * pw - S.len * 0.45;
      const x = S.mx + Math.cos(an) * t + S.nx * 0.5, y = S.my + Math.sin(an) * t + S.ny * 0.5;
      cbox(gb, k % 2 ? DOOR : DOOR2, x, y, base, pw - 0.25, 0.8, Hw * 0.8 - base, an);
    }
    cbox(gb, HEAD, S.mx + S.nx * 1.2, S.my + S.ny * 1.2, Hw * 0.8, S.len * 0.96, 2.4, Hw * 0.2 + 1.2, an);
    // ofis bloğu: karşı uzun kenar boyunca, 3 kat, pencere bantları
    if (A > 6000) {
      const B = sides.find((q) => Math.abs(q.nx + S.nx) < 1e-6 && Math.abs(q.ny + S.ny) < 1e-6) || sides[3];
      const dep = 12, ox = B.mx + B.nx * dep / 2, oy = B.my + B.ny * dep / 2, ol = B.len * 0.7;
      const fl = A > 30000 ? 4 : 3;
      cbox(gb, OFF, ox, oy, base, ol, dep, fl * 3.8 + 0.6, an);
      for (let f = 0; f < fl; f++) cbox(gb, WIN, ox, oy, 1.2 + f * 3.8, ol + 0.15, dep + 0.15, 1.5, an);
      (ctx.solid || (ctx.solid = [])).push({ P: [[ox - Math.cos(an) * ol / 2 - B.nx * dep / 2, oy - Math.sin(an) * ol / 2 - B.ny * dep / 2], [ox + Math.cos(an) * ol / 2 - B.nx * dep / 2, oy + Math.sin(an) * ol / 2 - B.ny * dep / 2], [ox + Math.cos(an) * ol / 2 + B.nx * dep / 2, oy + Math.sin(an) * ol / 2 + B.ny * dep / 2], [ox - Math.cos(an) * ol / 2 + B.nx * dep / 2, oy - Math.sin(an) * ol / 2 + B.ny * dep / 2]], top: fl * 3.8 + 0.6, ad: 'Hangar ofisi' });
    }
    // çatı ışıklık şeritleri
    for (let k = -1; k <= 1; k += 2) {
      const long = o.L >= o.Wd, L = long ? o.L : o.Wd;
      const ex = long ? ux : vx, ey = long ? uy : vy, px = -ey, py = ex;
      cbox(gb, [0.55, 0.62, 0.68], o.cx + px * k * (long ? o.Wd : o.L) * 0.18, o.cy + py * k * (long ? o.Wd : o.L) * 0.18, H - 0.7, L * 0.85, 3, 0.7, Math.atan2(ey, ex));
    }
    ctx.solid.push({ P, top: H, ad: b.n && !/technic|mytechnic/i.test(b.n) ? b.n : 'Hangar' });
  }
  const g = new THREE.Group(); g.name = 'hangarlar'; g.matrixAutoUpdate = false;
  mesh(g, gb, vcMat(), 'hangar-yapi');
  grp.add(g);
}

// ---------- kargo terminali (batı apronu, kuzeybatı kenarında) ----------
function cargo(ctx, det) {
  const { gh } = ctx;
  // apron kenarı ~ (-1950, -10) .. (-1660, 135); bina kenarın 12 m gerisinde
  const [ua, va] = uv(-1950, -12), [ub] = uv(-1665, 133);
  const U0 = ua + 10, U1 = ub - 20, V0 = va + 14, V1 = V0 + 72;
  const R = rect(U0, U1, V0, V1);
  const base = Math.min(...R.map(([x, y]) => gh(x, y))) - 0.5;
  const gb = CB(), dt = CB();
  const H = 15;
  cprism(gb, [0.78, 0.8, 0.8], R, base, H);
  // apron tarafı: kademeli saçak ve yükleme kapıları
  cprism(gb, [0.9, 0.9, 0.88], rect(U0 - 2, U1 + 2, V0 - 14, V0), 9, 10);
  for (let u = U0 + 8; u < U1 - 4; u += 14) { const [x, y] = xy(u, V0 - 0.3); cbox(gb, [0.45, 0.5, 0.55], x, y, base, 8, 0.8, 7.5 - base, ANG); }
  // kara tarafı: kamyon rampaları ve tırlar
  for (let u = U0 + 6; u < U1 - 4; u += 6) {
    const [x, y] = xy(u, V1 + 0.3); cbox(gb, [0.35, 0.38, 0.42], x, y, base, 3.2, 0.8, 4.2 - base, ANG);
    if (hash(u, 3) < 0.45) { const [tx, ty] = xy(u, V1 + 10); cbox(dt, hash(u, 9) < 0.5 ? [0.85, 0.85, 0.85] : [0.6, 0.12, 0.1], tx, ty, Math.max(base, gh(tx, ty)), 2.5, 16.5, 4.0, ANG + Math.PI / 2); }
  }
  // ofis kulesi (köşede, 4 kat)
  const [ox, oy] = xy(U1 - 18, V1 - 14);
  cbox(gb, [0.9, 0.9, 0.88], ox, oy, base, 30, 24, 18.5 - base, ANG);
  for (let f = 0; f < 4; f++) cbox(gb, [0.2, 0.27, 0.33], ox, oy, base + 2 + f * 4, 30.2, 24.2, 1.6, ANG);
  cprism(gb, [0.6, 0.62, 0.65], inflate(R, 0.8), H, H + 0.8);
  // apronda ULD konteyner ve palet dizileri
  for (let u = U0 + 6; u < U1 - 6; u += 3.4) for (const v of [V0 - 22, V0 - 26]) {
    if (hash(u, v) > 0.6) continue; const [x, y] = xy(u, v);
    cbox(dt, hash(v, u) < 0.5 ? [0.72, 0.74, 0.76] : [0.42, 0.46, 0.5], x, y, Math.max(0, gh(x, y)) + 0.1, 3.1, 2.4, 1.6, ANG);
  }
  const g = new THREE.Group(); g.name = 'kargo'; g.matrixAutoUpdate = false;
  mesh(g, gb, vcMat(), 'kargo-yapi'); ctx.grp.add(g);
  mesh(det, dt, vcMat(), 'kargo-araclar');
  (ctx.solid || (ctx.solid = [])).push({ P: R, top: H + 1, ad: 'Kargo terminali' });
}

// ---------- apron projektör direkleri ----------
function masts(ctx, det) {
  const { d } = ctx;
  const gb = CB();
  // apron üzerinde, taksi yollarından ve park etmiş uçaklardan uzak noktalar (iskele önü ve kargo apronu)
  const at = [];
  const free = (x, y) => d.apron.some((pl) => pip(pl[0], x, y))
    && !d.twy.some((t) => t.p.some((p, i) => { if (!i) return false; const q = t.p[i - 1], L = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1; const k = Math.max(0, Math.min(1, ((x - q[0]) * (p[0] - q[0]) + (y - q[1]) * (p[1] - q[1])) / (L * L))); return Math.hypot(q[0] + (p[0] - q[0]) * k - x, q[1] + (p[1] - q[1]) * k - y) < t.w / 2 + 14; }))
    && !(ctx.stands || []).some((s) => (s.ac && Math.hypot(s.ac.x - x, s.ac.y - y) < s.ac.L * 0.5 + 24) || Math.hypot(s.x - x, s.y - y) < 30)
    && !at.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < 90);
  for (let u = -2100; u <= 1300; u += 25) for (let v = 1030; v >= -600; v -= 8) { const [x, y] = xy(u, v); if (free(x, y)) at.push([x, y]); }
  for (const [x, y] of at) {
    const g0 = ctx.gh(x, y);
    clathe(gb, STEEL, x, y, [[0.45, 0], [0.25, 28]], 6, g0 - 0.3);
    cbox(gb, DARK, x, y, g0 + 27.5, 3.6, 1.2, 1.4, ANG);
  }
  mesh(det, gb, vcMat(), 'projektor');
}

// çapraz çizgili (iki farklı uçak tipine göre) park yerlerinde üst üste binen uçaklardan birini kaldır
function noOverlap(ctx, S) {
  const P = S.filter((s) => s.ac);
  const ms = ['ucaklar', 'ucak-kuyruk'].map((n) => ctx.grp.getObjectByName(n)).filter(Boolean);
  if (!ms.length || ms[0].count !== P.length) return;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const keep = [];
  P.forEach((s, i) => {
    const a = s.ac, r = 27 * a.sc;
    if (keep.some((b) => Math.hypot(b.x - a.x, b.y - a.y) < Math.max(r, 27 * b.sc))) { for (const m of ms) m.setMatrixAt(i, zero); delete s.ac; return; }
    keep.push(a);
  });
  for (const m of ms) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
}

export function build(ctx) {
  const { d } = ctx;
  const S = stands(d);
  ctx.stands = S;
  // ayrıntı grubu: yakında görünür (otopark arabaları, köprüler, kargo araçları, direkler)
  const det = new THREE.Group(); det.name = 'ltfj-ayrinti'; det.matrixAutoUpdate = false; ctx.grp.add(det);
  // terminaller
  const terms = [];
  const seen = new Set();
  let intl = null;
  for (const b of d.bina) {
    if (b.t !== 'terminal') continue;
    const key = b.p[0][0] + ':' + b.p[0][1]; if (seen.has(key)) continue; seen.add(key);
    const A = area(b.p);
    if (A > 40000) { intl = intlTerminal(ctx, b); terms.push(b.p); continue; }
    if (A > 12000) { terminal(ctx, 'ic-hatlar', 'İç Hatlar Terminali', b.p, { h: 14, roof: 'dalga', overhang: 6, skyStep: 18 }); terms.push(b.p); continue; }
    if (/vip/i.test(b.n || '')) { terminal(ctx, 'vip', 'VIP Terminali', b.p, { h: 9, roof: 'duz', overhang: 3 }); terms.push(b.p); continue; }
    if (A >= 400) { terminal(ctx, String(b.id || 'T' + terms.length), b.n || 'Terminal binası', b.p, { h: 8, roof: 'duz', overhang: 1.5 }); terms.push(b.p); }
  }
  if (intl) carPark(ctx, det);
  standsAndAircraft(ctx, { occ: 0.7 });
  noOverlap(ctx, S);
  bridges(ctx, terms, det);
  vehicles(ctx, S);
  hangars(ctx);
  cargo(ctx, det);
  masts(ctx, det);
  // kuleler: en yüksek OSM kulesi yeni kule (91 m), diğeri eski kule
  const tw = d.bina.filter((b) => b.t === 'tower').sort((p, q) => q.h - p.h);
  if (tw.length) { const [x, y] = centroid(tw[0].p); towerSAW(ctx, x, y, Math.max(85, tw[0].h)); }
  if (tw.length > 1) { const [x, y] = centroid(tw[1].p); oldTower(ctx, x, y, Math.max(32, tw[1].h)); }
  // uzaklığa göre ayrıntı: ayrıntı grubu 5 km içinde
  let f = 0;
  ctx.tick = (cam) => {
    if (++f % 10) return;
    const dd = Math.hypot(d.x - cam.x, d.y - cam.y, Math.max(0, cam.h - d.elev) * 0.5);
    det.visible = dd < 5000;
  };
}
