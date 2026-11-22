// İstanbul Atatürk Havalimanı (LTBA, ISL). 2019'dan beri tarifeli yolcu uçuşu yok; kargo, genel havacılık ve bakım
// (THY Teknik hangarları) sürüyor. Pistlerden yalnız 05/23 kaldı (OSM); 17/35'lerin yeri millet bahçesi.
// Yapılanlar (hepsi OSM tabanlarından, ölçüler yaklaşık):
// - Dış hatlar terminali (2000): yüksek ana salon (kare kubbe modüllü çatı, geniş saçak, kara tarafında yükseltilmiş
//   gidiş yolu) ve alçak iskele kolları (beton alt kat, cam üst kat, beyaz çatı kenarı).
// - İç hatlar terminali: yıldız biçimli salon (ışıklık şeritli çatı) ve kolları.
// - OSM tabanındaki dar çıkıntılar yolcu köprüsü olarak (sabit geçit + döner gövde + toplanmış teleskopik tünel).
// - Yeni kule (OSM konumu, ~62 m) ve eski kule (iç hatlar yanında, ~34 m; konum yaklaşık).
// - Bakım hangarları (OSM tabanı, gerçek boylarına yakın yükseklik, apron yönünde büyük kapılar; biri açık),
//   kargo binası (OSM'de yok; güneydoğu apronunun kenarında, markasız), genel havacılık apronunda iş jetleri.
// Terminaller ayrı parçalar: ctx.parts.get('terminal:a14801825') (dış hatlar), 'terminal:a576395104' (iç hatlar).
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, stands, standsAndAircraft, airlinerGeoms, TAILS } from '../havalimani.js';
import { pip, nearestEdge, vehicles } from './ortak.js';

// OSM tabanlarının ayrıştırılmış hâli (salon / iskele kolu / yolcu köprüsü çıkıntıları; açma-kapama ile, bir kez hesaplandı)
const PARCA = {
  a14801825: {
    hall: [[-261.6,12.3],[-293.6,166.4],[-211.5,184.5],[-218.1,215.7],[25.7,264.1],[30.2,240.9],[77.4,248.3],[80.5,225.8],[124.5,233.1],[128.2,212.5],[179.7,220.4],[203.1,104.2]],
    piers: [[[-413.4,20.6],[-269.4,49.4],[-282.8,113.4],[-301.7,206.1],[-311.4,253.8],[-311.4,253.8],[-317.5,283.9],[-296.0,283.5],[-273.7,170.8],[-211.5,184.5],[-215.8,204.9],[-211.5,184.5],[-293.6,166.4],[-261.6,12.4],[-260.0,12.7],[-394.6,-14.7],[-395.7,-9.3],[-407.3,-11.8]],[[-217.1,215.9],[-144.5,231.5],[25.7,264.1],[30.2,240.9],[77.4,248.3],[80.5,225.8],[124.5,233.1],[128.2,212.5],[179.7,220.4],[196.6,136.5],[342.5,164.8],[337.6,190.8],[404.7,202.3],[403.8,211.4],[429.1,215.9],[431.0,206.9],[692.2,256.9],[696.3,235.3],[798.0,255.5],[799.9,240.1],[428.8,171.5],[362.0,157.9],[367.8,132.0],[350.7,127.7],[349.2,133.2],[-63.2,50.7],[-195.0,25.5],[203.1,104.3],[179.7,220.4],[128.2,212.5],[124.5,233.1],[80.5,225.8],[77.4,248.3],[30.2,240.9],[25.7,264.1]]],
    br: [[-412.7,17.6,-446.2,18.6],[-405.7,22.2,-430.3,49.8],[-355.0,32.5,-360.3,60.7],[-284.3,118.0,-315.1,111.7],[-293.8,164.8,-324.2,158.9],[-303.1,211.0,-333.1,205.7],[-312.0,255.1,-342.1,253.8],[815.7,259.4,823.9,212.2],[746.0,229.7,752.2,198.0],[666.8,215.1,673.3,183.3],[588.4,200.7,594.7,167.9],[476.2,179.8,483.1,144.8],[429.8,171.2,435.9,136.5],[382.0,162.1,388.8,126.6],[339.0,130.7,344.6,103.9],[287.6,120.5,292.6,93.6],[240.4,111.1,245.5,84.6],[193.5,101.8,198.7,75.6],[129.9,89.0,135.3,61.8],[49.6,72.9,54.1,46.6],[-7.6,61.7,-3.2,35.2],[-62.3,50.5,-57.6,24.8],[-113.3,40.6,-106.3,12.7],[-162.8,31.1,-157.8,3.7],[-213.2,21.7,-208.9,-6.0],[-263.8,11.7,-259.9,-15.7],[-315.3,0.6,-311.0,-25.2],[-370.0,-10.5,-365.3,-36.4],[-405.0,-9.0,-416.4,-43.7],[-407.2,-10.4,-439.7,-22.2]],
  },
  a576395104: {
    hall: [[-399.8,402.5],[-382.0,429.5],[-401.6,473.7],[-374.6,514.8],[-326.3,511.8],[-308.7,537.6],[-283.2,486.6],[-258.1,484.7],[-248.3,460.1],[-306.3,376.1],[-335.2,376.1],[-346.1,399.3]],
    piers: [[[-283.2,486.6],[-258.1,484.7],[-252.3,470.2],[-237.8,469.2],[-171.3,500.9],[-162.5,481.0],[-229.6,448.9],[-255.8,449.2],[-299.7,385.7],[-289.5,365.2],[-291.8,362.1],[-289.7,361.6],[-296.0,283.5],[-317.5,283.9],[-313.1,344.2],[-329.5,376.1],[-335.2,376.1],[-346.1,399.3],[-391.0,402.0],[-346.1,399.3],[-335.2,376.1],[-306.3,376.1],[-248.3,460.1],[-258.1,484.7]]],
    br: [[-401.5,475.0,-426.1,492.6],[-377.6,511.2,-400.0,526.5],[-361.2,514.6,-360.8,527.9],[-332.9,512.7,-331.8,532.5],[-311.1,531.6,-310.3,544.7],[-299.5,520.2,-287.4,526.1],[-286.9,494.7,-261.5,506.4],[-315.9,313.0,-341.0,314.7],[-312.9,347.3,-342.4,355.2],[-379.8,400.8,-381.1,375.7],[-392.2,414.5,-405.4,424.4],[-400.2,471.4,-423.0,470.0]],
  },
};
const DIS = 'a14801825', IC = 'a576395104';

let MAT = null;
function mats() {
  if (MAT) return MAT;
  const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  MAT = {
    roofW: L(0xe9e8e3), fascia: L(0xf4f4f0), plinth: L(0xa9a59c), deck: L(0x8f8d88), road: L(0x3c3d40),
    door: L(0x8a929a), doorDark: L(0x2a2d31), clad: L(0xd5d9dc), cladRoof: L(0xa7adb3), stripe: L(0x6f7983),
    shaft: L(0xdcdad4), bridge: L(0xc3c7cb), bridgeDark: L(0x56595e), cargo: L(0xc4c1b8), vc: L(0xffffff, { vertexColors: true }),
  };
  return MAT;
}

// ---------- geometri yardımcıları ----------
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const ccw = (P) => (area2(P) < 0 ? P.slice().reverse() : P);
// genel altı yüzlü: alt 4 köşe + üst 4 köşe ([x, y, h]); yüzler dışa bakacak biçimde sıralanır
function hexa(gb, Q) {
  const cx = Q.reduce((s, q) => s + q[0], 0) / 8, cy = Q.reduce((s, q) => s + q[1], 0) / 8, ch = Q.reduce((s, q) => s + q[2], 0) / 8;
  const F = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  for (const f of F) {
    let P = f.map((i) => Q[i]);
    // three koordinatı: (x, h, -y)
    const T = P.map((q) => [q[0], q[2], -q[1]]);
    const e1 = [T[1][0] - T[0][0], T[1][1] - T[0][1], T[1][2] - T[0][2]], e2 = [T[2][0] - T[0][0], T[2][1] - T[0][1], T[2][2] - T[0][2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (Math.hypot(...n) < 1e-9) { const e3 = [T[3][0] - T[0][0], T[3][1] - T[0][1], T[3][2] - T[0][2]]; n = [e2[1] * e3[2] - e2[2] * e3[1], e2[2] * e3[0] - e2[0] * e3[2], e2[0] * e3[1] - e2[1] * e3[0]]; }
    const fc = [(T[0][0] + T[2][0]) / 2 - cx, (T[0][1] + T[2][1]) / 2 - ch, (T[0][2] + T[2][2]) / 2 + cy];
    if (n[0] * fc[0] + n[1] * fc[1] + n[2] * fc[2] < 0) { P = P.slice().reverse(); n = n.map((v) => -v); }
    const l = Math.hypot(...n) || 1;
    const s = gb.count;
    for (const q of P) gb.vert(q[0], q[2], q[1], n[0] / l, n[1] / l, -n[2] / l);
    gb.quad(s, s + 1, s + 2, s + 3);
  }
}
// eğik kiriş: (x0,y0) -> (x1,y1), genişlik w, alt/üst yükseklikler iki uçta
function beam(gb, x0, y0, x1, y1, w, b0, t0, b1, t1) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L * w / 2, ny = (x1 - x0) / L * w / 2;
  hexa(gb, [[x0 - nx, y0 - ny, b0], [x1 - nx, y1 - ny, b1], [x1 + nx, y1 + ny, b1], [x0 + nx, y0 + ny, b0],
    [x0 - nx, y0 - ny, t0], [x1 - nx, y1 - ny, t1], [x1 + nx, y1 + ny, t1], [x0 + nx, y0 + ny, t0]]);
}
// kare kubbe modülü (alçak, eğri yüzeyli), merkez (cx, cy), kenar s, yön ang
function dome(gb, cx, cy, ang, s, h0, rise, n = 6) {
  const c = Math.cos(ang), sn = Math.sin(ang), st = gb.count;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const u = -1 + 2 * i / n, v = -1 + 2 * j / n;
    const h = h0 + rise * (1 - u * u) * (1 - v * v);
    const ga = rise * -2 * u * (1 - v * v) * 2 / s, gbv = rise * -2 * v * (1 - u * u) * 2 / s;
    const a = u * s / 2, b = v * s / 2;
    // yerel (a, b) eğimleri dünyaya döndür: dünya eğimi = R * (ga, gbv)
    const nx = -(ga * c - gbv * sn), ny = -(ga * sn + gbv * c);
    const l = Math.hypot(nx, 1, ny);
    gb.vert(cx + a * c - b * sn, h, cy + a * sn + b * c, nx / l, 1 / l, ny / l);
  }
  const id = (i, j) => st + i * (n + 1) + j;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) gb.quad(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
}
// cam cephe prizması (doku: 3 m x kat yüksekliği)
function glassWall(gb, P, h0, h1, fl, base) {
  const s = gb.uv.length;
  gb._per = 0; gb.prism(P, h0, h1, false);
  for (let k = s; k < gb.uv.length; k += 2) { gb.uv[k] /= 3.0; gb.uv[k + 1] = (gb.uv[k + 1] - base) / fl; }
}
// çokgenin içinde, ana eksene hizalı ızgara noktaları (kenardan en az m uzakta)
function gridIn(P, ang, step, m) {
  const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux, [cx, cy] = centroid(P);
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [x, y] of P) { const a = (x - cx) * ux + (y - cy) * uy, b = (x - cx) * vx + (y - cy) * vy; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const out = [];
  for (let a = a0 + step / 2; a < a1; a += step) for (let b = b0 + step / 2; b < b1; b += step) {
    const x = cx + ux * a + vx * b, y = cy + uy * a + vy * b;
    if (pip(P, x, y) && nearestEdge(P, x, y).d > m) out.push([x, y]);
  }
  return out;
}
const mesh = (grp, gb, mat, name) => { if (!gb.count) return null; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; grp.add(m); return m; };
function addCol(ctx, c) {
  const W = ctx.W, k = Math.round(c.x) + ':' + Math.round(c.y);
  W._apCol = W._apCol || new Set();
  if (W._apCol.has(k)) return; W._apCol.add(k); W.lmCol.push(c);
}

// ---------- terminaller ----------
// opt: { hallH, pierH, fl, roof: 'kubbe' | 'isik', ang, viaduct }
function terminalLTBA(ctx, b, parca, opt) {
  const { M, gh } = ctx, X = mats();
  const P = b.p, base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.6;
  const grp = new THREE.Group();
  const glass = new GB(); glass.uv = [];
  const conc = new GB(), roof = new GB(), white = new GB(), skyl = new GB(), dark = new GB();
  const pH = opt.pierH, hH = opt.hallH, fl = opt.fl || 4.5;
  // iskele kolları: beton servis katı, cam yolcu katı, ince çatı, beyaz çatı kenarı, çatıda teknik kutular
  for (const Q0 of parca.piers) {
    const Q = ccw(Q0);
    conc.prism(Q, base, 4.6, false);
    glassWall(glass, inflate(Q, -0.4), 4.6, pH, fl, base);
    roof.prism(inflate(Q, 1.2), pH, pH + 0.9, true, true);
    white.prism(inflate(Q, 1.5), pH - 0.9, pH + 1.5, false);
    white.prism(inflate(Q, 1.5), pH + 1.45, pH + 1.5, true);
    const o = obbOf(Q);
    for (const [x, y] of gridIn(Q, o.ang, 34, 6)) dark.box(x, y, pH + 1.5, 6, 3.5, 1.8, o.ang);
  }
  // salon
  const H = ccw(parca.hall);
  conc.prism(H, base, 1.2, false);
  glassWall(glass, inflate(H, -0.2), 1.2, hH, fl, base);
  const ov = opt.overhang || 6;
  roof.prism(inflate(H, ov), hH, hH + 1.0, false, true);
  white.prism(inflate(H, ov), hH + 0.9, hH + 1.8, true);
  // saçak kenarı ve taşıyıcı dikmeler (saçak boyunca)
  const R = inflate(H, ov);
  for (let i = 0; i < R.length; i++) {
    const [ax, ay] = R[i], [bx, by] = R[(i + 1) % R.length], L = Math.hypot(bx - ax, by - ay);
    const n = Math.floor(L / 18);
    for (let k = 1; k < n; k++) { const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, e = nearestEdge(H, x, y); if (e.d > ov * 0.6) { const px = e.x + (x - e.x) * 0.75, py = e.y + (y - e.y) * 0.75; white.box(px, py, base, 0.8, 0.8, hH - base, 0); } }
  }
  const ang = opt.ang;
  if (opt.roof === 'kubbe') {
    const s = 22;
    for (const [x, y] of gridIn(H, ang, s, 9)) {
      dome(white, x, y, ang, s - 1.2, hH + 1.8, 3.4, 6);
      skyl.box(x, y, hH + 1.8 + 2.6, 3.2, 3.2, 1.3, ang);
    }
  } else {
    // ışıklık şeritleri (eksen boyunca, kesik kesik)
    for (const [x, y] of gridIn(H, ang, 14, 7)) skyl.box(x, y, hH + 1.8, 10, 3.2, 1.6, ang);
  }
  mesh(grp, glass, M.glass, 'cephe'); mesh(grp, conc, X.plinth, 'zemin'); mesh(grp, roof, M.roof, 'cati');
  mesh(grp, white, X.roofW, 'cati-ust'); mesh(grp, skyl, M.glass, 'isiklik'); mesh(grp, dark, M.dark, 'teknik');
  // kara tarafında yükseltilmiş gidiş yolu (viyadük, rampalar, ayaklar)
  if (opt.viaduct) viaduct(ctx, grp, opt.viaduct, base);
  grp.userData = { id: b.id, ad: b.n, taban: P, yukseklik: pH, katYuksekligi: fl, kotu: base, salon: H, salonYuksekligi: hH };
  grp.matrixAutoUpdate = false;
  ctx.part('terminal:' + b.id, grp);
  (ctx.solid || (ctx.solid = [])).push({ P: H, top: hH + 5.5, ad: b.n || 'Terminal' });
}
// v: { p0: [x, y] başlangıç, ang, len, h, w, west: kuzeye inen rampa yönü }
function viaduct(ctx, grp, v, base) {
  const X = mats(), deck = new GB(), road = new GB(), barr = new GB();
  const ux = Math.cos(v.ang), uy = Math.sin(v.ang), nx = -uy, ny = ux;
  const segs = [];
  const P0 = v.p0, P1 = [P0[0] + ux * v.len, P0[1] + uy * v.len];
  segs.push([P0, P1, v.h, v.h]);
  // doğu ucu: eksen boyunca inen rampa; batı ucu: kuzeye inen rampa
  segs.push([P1, [P1[0] + ux * 120, P1[1] + uy * 120], v.h, 0.2]);
  const W0 = [P0[0] + nx * (v.w / 2 - 4) - ux * (v.w / 2 - 4), P0[1] + ny * (v.w / 2 - 4) - uy * (v.w / 2 - 4)];
  segs.push([W0, [W0[0] + nx * 120, W0[1] + ny * 120], v.h, 0.2]);
  for (const [A, B, h0, h1] of segs) {
    const w = A === W0 ? 9 : v.w;
    beam(deck, A[0], A[1], B[0], B[1], w, h0 - 1.4, h0, h1 - 1.4, h1);
    beam(road, A[0], A[1], B[0], B[1], w - 1.0, h0 + 0.02, h0 + 0.06, h1 + 0.02, h1 + 0.06);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]), ex = (B[0] - A[0]) / L, ey = (B[1] - A[1]) / L, qx = -ey, qy = ex;
    for (const sd of [-1, 1]) beam(barr, A[0] + qx * sd * (w / 2 - 0.25), A[1] + qy * sd * (w / 2 - 0.25), B[0] + qx * sd * (w / 2 - 0.25), B[1] + qy * sd * (w / 2 - 0.25), 0.4, h0, h0 + 1.0, h1, h1 + 1.0);
    // ayaklar
    for (let t = 12; t < L; t += 24) {
      const hh = h0 + (h1 - h0) * t / L - 1.4; if (hh < 1.5) continue;
      const x = A[0] + ex * t, y = A[1] + ey * t;
      for (const sd of (w > 10 ? [-1, 1] : [0])) deck.box(x + qx * sd * w * 0.28, y + qy * sd * w * 0.28, base, 1.3, 1.3, hh - base, Math.atan2(ey, ex));
      deck.box(x, y, hh - 0.9, 1.6, w * 0.8, 0.9, Math.atan2(ey, ex));
    }
  }
  mesh(grp, deck, X.deck, 'viyaduk'); mesh(grp, road, X.road, 'viyaduk-yol'); mesh(grp, barr, X.fascia, 'viyaduk-korkuluk');
}

// ---------- yolcu köprüleri: OSM tabanındaki dar çıkıntılar (kök terminal duvarında, uç apronda) ----------
function bridges(ctx, list) {
  const X = mats(), tube = new GB(), dark = new GB(), glass = new GB();
  for (const [rx, ry, tx, ty] of list) {
    const L = Math.hypot(tx - rx, ty - ry); if (L < 3) continue;
    const ux = (tx - rx) / L, uy = (ty - ry) / L, ang = Math.atan2(uy, ux);
    const h = 4.9;
    // sabit geçit (cam yanlı)
    beam(tube, rx, ry, tx, ty, 3.2, h - 0.4, h, h - 0.4, h);
    beam(tube, rx, ry, tx, ty, 3.2, h + 2.8, h + 3.2, h + 2.8, h + 3.2);
    for (const sd of [-1, 1]) beam(glass, rx - uy * sd * 1.5, ry + ux * sd * 1.5, tx - uy * sd * 1.5, ty + ux * sd * 1.5, 0.12, h, h + 2.8, h, h + 2.8);
    for (let t = 6; t < L - 1; t += 9) dark.box(rx + ux * t, ry + uy * t, 0, 0.5, 0.5, h - 0.4, ang);
    // döner gövde ve kolonu
    dark.lathe(tx, ty, [[2.7, h - 0.6], [2.7, h + 3.4], [2.2, h + 3.7]], 10, 0);
    dark.lathe(tx, ty, [[0.7, 0], [0.7, h - 0.6]], 8, 0);
    // toplanmış teleskopik tünel: uçtan aynı yönde, hafif aşağı eğimli, iki iç içe parça
    const dir = ang;
    const cx = Math.cos(dir), cy = Math.sin(dir);
    const a0x = tx + cx * 2.5, a0y = ty + cy * 2.5, L1 = 13, L2 = 11;
    const b1x = a0x + cx * L1, b1y = a0y + cy * L1, b2x = b1x + cx * L2, b2y = b1y + cy * L2;
    const z0 = h, z1 = h - 0.35, z2 = h - 0.7;
    beam(tube, a0x, a0y, b1x, b1y, 3.6, z0 - 0.5, z0 + 3.0, z1 - 0.5, z1 + 3.0);
    beam(tube, b1x - cx, b1y - cy, b2x, b2y, 3.3, z1 - 0.45, z1 + 2.8, z2 - 0.45, z2 + 2.8);
    // tekerlekli ayak ve kabin (koyu, körüklü ağız)
    const fx = a0x + cx * (L1 + L2 * 0.45), fy = a0y + cy * (L1 + L2 * 0.45);
    dark.box(fx, fy, 0, 0.7, 2.8, z1 - 0.6, dir);
    dark.box(fx, fy, 0, 1.6, 3.8, 0.9, dir);
    dark.box(b2x + cx * 1.6, b2y + cy * 1.6, z2 - 0.6, 3.2, 4.2, 3.6, dir);
  }
  const grp = new THREE.Group(); grp.name = 'yolcu-kopruleri'; grp.matrixAutoUpdate = false;
  mesh(grp, tube, X.bridge, 'kopru'); mesh(grp, dark, X.bridgeDark, 'kopru-koyu'); mesh(grp, glass, ctx.M.cab, 'kopru-cam');
  ctx.grp.add(grp);
}

// ---------- kuleler ----------
// yeni kule: geniş tabanlı beton gövde, koyu teknik kat, dışa eğik camlı kabin, saçaklı çatı, anten direği; dibinde idari blok
function towerNew(ctx, x, y, H) {
  const { M, gh } = ctx, X = mats();
  const base = gh(x, y) - 0.5;
  const sh = new GB(), cab = new GB(), dark = new GB(), wh = new GB(), gl = new GB(); gl.uv = [];
  sh.lathe(x, y, [[6.4, 0], [5.4, 10], [4.6, H - 15]], 12, base);
  // gövde boyunca dikey cam şerit (merdiven kovası) ve yatay derzler
  for (let k = 0; k < 2; k++) { const a = k * Math.PI; dark.box(x + Math.cos(a) * 4.9, y + Math.sin(a) * 4.9, base + 9, 1.2, 1.4, H - 25, a); }
  for (let h = 12; h < H - 16; h += 8) wh.lathe(x, y, [[5.4 - h * 0.017, h], [5.6 - h * 0.017, h + 0.25], [5.4 - h * 0.017, h + 0.5]], 12, base);
  sh.lathe(x, y, [[4.6, H - 15], [8.6, H - 12.5], [9.0, H - 12]], 12, base);
  dark.lathe(x, y, [[8.6, H - 12], [8.6, H - 8.2]], 12, base);
  wh.lathe(x, y, [[9.4, H - 8.2], [9.4, H - 7.6], [8.0, H - 7.5]], 12, base);
  cab.lathe(x, y, [[8.0, H - 7.5], [9.6, H - 2.2]], 12, base);
  wh.lathe(x, y, [[10.4, H - 2.2], [10.4, H - 1.2], [6.0, H - 0.6], [3.5, H + 0.6], [0.05, H + 0.7]], 12, base);
  dark.box(x, y, base + H + 0.6, 0.35, 0.35, 9, 0);
  dark.box(x + 3, y, base + H + 0.2, 0.2, 0.2, 4, 0);
  // dibindeki iki katlı blok
  const blk = [[x - 6, y - 10], [x + 26, y - 10], [x + 26, y + 10], [x - 6, y + 10]];
  wh.prism(blk, base, base + 1.0, false);
  gl._per = 0; gl.prism(inflate(blk, -0.3), base + 1.0, base + 8.0, false);
  for (let k = 0; k < gl.uv.length; k += 2) { gl.uv[k] /= 3; gl.uv[k + 1] = (gl.uv[k + 1] - base) / 3.6; }
  wh.prism(inflate(blk, 0.6), base + 8.0, base + 9.2, true);
  const grp = new THREE.Group();
  mesh(grp, sh, X.shaft, 'govde'); mesh(grp, cab, M.cab, 'kabin'); mesh(grp, dark, M.dark, 'teknik'); mesh(grp, wh, X.fascia, 'beyaz'); mesh(grp, gl, M.glass, 'blok-cam');
  grp.matrixAutoUpdate = false;
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 10, top: ctx.d.elev + base + H + 1 });
  (ctx.solid || (ctx.solid = [])).push({ P: blk, top: base + 9.2, ad: 'Kule' });
  return ctx.part('kule:yeni', grp);
}
// eski kule: kare kesitli beton gövde, sekizgen kabin, dar balkon
function towerOld(ctx, x, y, H) {
  const { M, gh } = ctx, X = mats();
  const base = gh(x, y) - 0.5;
  const sh = new GB(), cab = new GB(), dark = new GB();
  const sq = (r, a = Math.PI / 4) => [0, 1, 2, 3].map((k) => [x + Math.cos(a + k * Math.PI / 2) * r, y + Math.sin(a + k * Math.PI / 2) * r]);
  sh.prism(sq(4.4), base, base + H - 9);
  for (let h = 6; h < H - 10; h += 3.2) dark.box(x + 3.12, y, base + h, 0.1, 1.2, 1.4, 0);
  const oct = (r) => Array.from({ length: 8 }, (_, k) => [x + Math.cos(k * Math.PI / 4 + Math.PI / 8) * r, y + Math.sin(k * Math.PI / 4 + Math.PI / 8) * r]);
  sh.prism(oct(6.4), base + H - 9, base + H - 7.8);
  dark.prism(oct(5.6), base + H - 7.8, base + H - 5.6);
  sh.prism(oct(6.8), base + H - 5.6, base + H - 5.2);
  cab.prism(oct(5.8), base + H - 5.2, base + H - 1.0);
  sh.prism(oct(6.6), base + H - 1.0, base + H);
  sh.box(x, y, base + H, 0.3, 0.3, 5, 0);
  const grp = new THREE.Group();
  mesh(grp, sh, X.shaft, 'govde'); mesh(grp, cab, M.cab, 'kabin'); mesh(grp, dark, M.dark, 'teknik');
  grp.matrixAutoUpdate = false;
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 7, top: ctx.d.elev + base + H });
  return ctx.part('kule:eski', grp);
}

// ---------- hangarlar ----------
// apron yönündeki kenara büyük kapı (açıksa karanlık iç), çatıda ışıklık şeritleri, cephede yatay şeritler
function apronDist(d, x, y) {
  let m = 1e9;
  for (const a of d.apron) { const e = nearestEdge(a[0], x, y); m = Math.min(m, pip(a[0], x, y) ? 0 : e.d); }
  for (const t of d.twy) for (const p of t.p) m = Math.min(m, Math.hypot(p[0] - x, p[1] - y) + 15);
  return m;
}
function hangars(ctx, spec) {
  const { d, gh } = ctx, X = mats();
  const wall = new GB(), roof = new GB(), door = new GB(), dk = new GB(), str = new GB(), wh = new GB();
  const front = [];
  for (const b of d.bina) {
    if (b.t !== 'hangar') continue;
    const P = ccw(b.p), o = obbOf(P);
    const area = Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    const sp = spec(b, area);
    const H = sp.h, base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5;
    wall.prism(P, base, H, false);
    roof.prism(inflate(P, 0.6), H, H + 1.4, true);
    for (let h = 4; h < H - 2; h += 6) str.prism(inflate(P, 0.08), h, h + 0.5, false);
    // OBB kenarları: apron tarafındakini bul
    const ux = o.c, uy = o.s, vx = -o.s, vy = o.c;
    const sides = [
      { m: [o.cx + ux * o.L / 2, o.cy + uy * o.L / 2], n: [ux, uy], len: o.Wd },
      { m: [o.cx - ux * o.L / 2, o.cy - uy * o.L / 2], n: [-ux, -uy], len: o.Wd },
      { m: [o.cx + vx * o.Wd / 2, o.cy + vy * o.Wd / 2], n: [vx, vy], len: o.L },
      { m: [o.cx - vx * o.Wd / 2, o.cy - vy * o.Wd / 2], n: [-vx, -vy], len: o.L },
    ];
    let best = null;
    for (const s of sides) { const dd = apronDist(d, s.m[0] + s.n[0] * 20, s.m[1] + s.n[1] * 20); if (!best || dd < best.dd) best = { ...s, dd }; }
    // kapının gerçek duvarı: OSM çokgeninin bu yöndeki en dış noktası
    let maxOut = -1e9; for (const [x, y] of P) maxOut = Math.max(maxOut, (x - o.cx) * best.n[0] + (y - o.cy) * best.n[1]);
    const nx = best.n[0], ny = best.n[1], tx = -ny, ty = nx;
    const mx = o.cx + nx * maxOut, my = o.cy + ny * maxOut;
    const DW = Math.min(best.len * 0.9, sp.doorW || 1e9), DH = H * 0.78, ang = Math.atan2(ty, tx);
    if (sp.open) {
      // açık kapı: kanatlar iki yana toplanmış, ortada karanlık açıklık
      dk.box(mx + nx * 0.12, my + ny * 0.12, base, DW * 0.62, 0.3, DH, ang);
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) door.box(mx + nx * (0.6 + k * 0.7) + tx * sd * (DW * 0.4 - k * 1.2), my + ny * (0.6 + k * 0.7) + ty * sd * (DW * 0.4 - k * 1.2), base, DW * 0.12, 0.5, DH, ang);
    } else {
      const nL = Math.max(4, Math.round(DW / 12)), lw = DW / nL;
      for (let k = 0; k < nL; k++) {
        const off = -DW / 2 + lw * (k + 0.5), dep = 0.45 + (k % 2) * 0.35;
        door.box(mx + nx * dep + tx * off, my + ny * dep + ty * off, base, lw - 0.35, 0.5, DH, ang);
        for (let h = 3; h < DH - 1; h += 3) str.box(mx + nx * (dep + 0.27) + tx * off, my + ny * (dep + 0.27) + ty * off, base + h, lw - 0.6, 0.06, 0.18, ang);
      }
    }
    // kapı üstü kiriş (beyaz)
    wh.box(mx + nx * 0.7, my + ny * 0.7, DH + base, DW + 2, 1.6, H - DH - base + 0.2, ang);
    // çatı ışıklıkları
    const lng = o.L >= o.Wd ? o.ang : o.ang + Math.PI / 2;
    for (const [x, y] of gridIn(P, lng, 30, 10)) wh.box(x, y, H + 1.4, 14, 3, 0.8, lng);
    for (const s of ctx.solid || []) if (s.P === b.p) s.top = H + 1.4;
    front.push({ x: mx, y: my, nx, ny, H, DW, open: sp.open, ad: b.n, area });
  }
  const grp = new THREE.Group(); grp.name = 'hangarlar'; grp.matrixAutoUpdate = false;
  mesh(grp, wall, X.clad, 'hangar-duvar'); mesh(grp, roof, X.cladRoof, 'hangar-cati'); mesh(grp, door, X.door, 'hangar-kapi');
  mesh(grp, dk, X.doorDark, 'hangar-koyu'); mesh(grp, str, X.stripe, 'hangar-serit'); mesh(grp, wh, X.fascia, 'hangar-kiris');
  ctx.grp.add(grp);
  return front;
}

// ---------- kargo binası (OSM'de yok; güneydoğu apronunun dış kenarında) ----------
function cargo(ctx, A, B, side) {
  const { M, gh } = ctx, X = mats();
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
  const nx = side * -uy, ny = side * ux, ang = Math.atan2(uy, ux);
  const len = Math.min(320, L * 0.55), dep = 58, H = 15;
  const cx = (A[0] + B[0]) / 2 + nx * (dep / 2 + 10), cy = (A[1] + B[1]) / 2 + ny * (dep / 2 + 10);
  const base = gh(cx, cy) - 0.5;
  const wall = new GB(), roof = new GB(), dk = new GB(), door = new GB(), wh = new GB(), gl = new GB(), uld = new GB([['color', 3]]); gl.uv = [];
  const corner = (a, b) => [cx + ux * a + nx * b, cy + uy * a + ny * b];
  const P = [corner(-len / 2, -dep / 2), corner(len / 2, -dep / 2), corner(len / 2, dep / 2), corner(-len / 2, dep / 2)];
  const Pc = side > 0 ? P : P.slice().reverse();
  wall.prism(Pc, base, H, false);
  roof.prism(inflate(Pc, 0.5), H, H + 1.2, true);
  // apron yüzü: ULD kapıları; kara yüzü: kamyon rampaları ve saçak
  for (let a = -len / 2 + 10; a < len / 2 - 8; a += 14) {
    const [x, y] = corner(a, -dep / 2);
    door.box(x - nx * 0.3, y - ny * 0.3, base, 9, 0.5, 6.5, ang);
    const [x2, y2] = corner(a, dep / 2);
    dk.box(x2 + nx * 0.3, y2 + ny * 0.3, base + 1.2, 3.2, 0.4, 3.4, ang);
    dk.box(x2 + nx * 0.3 + ux * 5, y2 + ny * 0.3 + uy * 5, base + 1.2, 3.2, 0.4, 3.4, ang);
  }
  const [qx, qy] = corner(0, dep / 2 + 4);
  wh.box(qx, qy, base + 5.2, len - 6, 8, 0.6, ang);
  wh.box(cx - nx * (dep / 2 + 0.6), cy - ny * (dep / 2 + 0.6), base + 8.2, len, 1.2, 1.4, ang);
  // uçta üç katlı ofis (cam)
  const [ox, oy] = corner(len / 2 + 11, -6);
  const O = [[ox - ux * 11 - nx * 20, oy - uy * 11 - ny * 20], [ox + ux * 11 - nx * 20, oy + uy * 11 - ny * 20], [ox + ux * 11 + nx * 20, oy + uy * 11 + ny * 20], [ox - ux * 11 + nx * 20, oy - uy * 11 + ny * 20]];
  const Oc = side > 0 ? O : O.slice().reverse();
  wh.prism(Oc, base, base + 1.0, false);
  gl._per = 0; gl.prism(inflate(Oc, -0.3), base + 1.0, base + 12, false);
  for (let k = 0; k < gl.uv.length; k += 2) { gl.uv[k] /= 3; gl.uv[k + 1] = (gl.uv[k + 1] - base) / 3.7; }
  wh.prism(inflate(Oc, 0.5), base + 12, base + 13.2, true);
  // apronda kargo konteynerleri ve paletler (renkli kutular)
  const cols = [[0.72, 0.74, 0.76], [0.62, 0.64, 0.66], [0.80, 0.55, 0.20], [0.35, 0.45, 0.60]];
  let r = 7;
  for (let a = -len / 2 + 14; a < len / 2 - 14; a += 9) {
    r = (r * 16807) % 2147483647;
    if (r % 3 === 0) continue;
    const [x, y] = corner(a, -dep / 2 - 14 - (r % 5));
    const n = 1 + (r % 4), col = cols[r % cols.length];
    for (let k = 0; k < n; k++) { const s = uld.count; uld.box(x + ux * k * 2.4, y + uy * k * 2.4, base + 0.5, 2.2, 3.0, 1.6, ang); for (let q = s; q < uld.count; q++) uld.a.color.v.splice(q * 3, 3, ...col); }
    // dolly
    const s = uld.count; uld.box(x + ux * (n - 1) * 1.2, y + uy * (n - 1) * 1.2, base, n * 2.4 + 0.4, 3.2, 0.5, ang); for (let q = s; q < uld.count; q++) uld.a.color.v.splice(q * 3, 3, 0.25, 0.25, 0.27);
  }
  const grp = new THREE.Group(); grp.matrixAutoUpdate = false;
  mesh(grp, wall, X.cargo, 'duvar'); mesh(grp, roof, X.cladRoof, 'cati'); mesh(grp, door, X.door, 'kapi'); mesh(grp, dk, X.doorDark, 'rampa');
  mesh(grp, wh, X.fascia, 'sacak'); mesh(grp, gl, M.glass, 'ofis'); mesh(grp, uld, X.vc, 'konteyner');
  ctx.part('kargo', grp);
  (ctx.solid || (ctx.solid = [])).push({ P: Pc, top: H + 1.2, ad: 'Kargo binası' }, { P: Oc, top: base + 13.2, ad: 'Kargo binası' });
  // kargo uçakları için park yerleri: binanın önünde, burun binaya dönük
  const out = [];
  for (const a of [-len * 0.33, 0, len * 0.33]) { const [x, y] = corner(a, -dep / 2 - 32); out.push({ x, y, hx: nx, hy: ny, sc: 1.7 }); }
  return out;
}

// ---------- iş jeti (markasız, düşük poligonlu; burun +x) ----------
let BIZ = null;
function bizjetGeom() {
  if (BIZ) return BIZ;
  const g = new GB([['color', 3]]);
  const W = [0.95, 0.95, 0.96], Gy = [0.62, 0.64, 0.68], Dk = [0.1, 0.12, 0.15], St = [0.25, 0.32, 0.45];
  const Lf = 19.6, seg = 12;
  const secs = [[0, 0.05, 1.95], [0.5, 0.45, 1.9], [1.6, 0.92, 1.95], [3.2, 1.08, 2.0], [12.5, 1.08, 2.05], [15.5, 0.8, 2.3], [18.6, 0.35, 2.6], [19.6, 0.1, 2.7]];
  const s0 = g.count;
  for (const [x, r, zc] of secs) for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    let col = s < -0.4 ? Gy : W;
    if (s > -0.25 && s < -0.05 && x > 2 && x < 16) col = St;                 // yan şerit
    if (s > 0.1 && s < 0.35 && x > 3.5 && x < 11.5 && (Math.floor(x / 0.9) % 2 === 0)) col = Dk;   // oval pencereler
    if (x < 2.2 && x > 0.6 && s > 0.25 && Math.abs(c) < 0.75) col = Dk;      // kokpit
    g.vert(Lf / 2 - x, zc + s * r, c * r, 0, s, c, { color: col });
  }
  for (let j = 0; j < secs.length - 1; j++) for (let k = 0; k < seg; k++) { const a = s0 + j * (seg + 1) + k, b = a + seg + 1; g.quad(a, a + 1, b + 1, b); }
  const plate = (pts, z, th, dz, col) => {
    const s = g.count;
    for (const [x, y] of pts) g.vert(x, z + Math.abs(y) * dz, y, 0, 1, 0, { color: col });
    for (const [x, y] of pts) g.vert(x, z + Math.abs(y) * dz - th, y, 0, -1, 0, { color: Gy });
    const n = pts.length;
    g.quad(s, s + 1, s + 2, s + 3); g.quad(s + n, s + n + 3, s + n + 2, s + n + 1);
    for (let k = 0; k < n; k++) { const a = s + k, b = s + (k + 1) % n; g.quad(a, b, b + n, a + n); }
  };
  // alçak kanat (ok açılı, winglet), T kuyruk
  for (const sd of [-1, 1]) {
    plate([[Lf / 2 - 6.6, 0.9 * sd], [Lf / 2 - 10.0, 0.9 * sd], [Lf / 2 - 12.4, 8.6 * sd], [Lf / 2 - 11.2, 8.6 * sd]], 1.25, 0.25, 0.06, W);
    plate([[Lf / 2 - 11.2, 8.6 * sd], [Lf / 2 - 12.4, 8.6 * sd], [Lf / 2 - 12.9, 8.75 * sd], [Lf / 2 - 12.3, 8.75 * sd]], 1.25 + 0.5, 0.05, 0.0, W);
    plate([[Lf / 2 - 17.4, 0.15 * sd], [Lf / 2 - 19.0, 0.15 * sd], [Lf / 2 - 20.0, 3.2 * sd], [Lf / 2 - 19.3, 3.2 * sd]], 5.6, 0.14, 0.02, W);
  }
  // dikey kuyruk
  const F = [[Lf / 2 - 15.0, 2.6], [Lf / 2 - 18.8, 2.8], [Lf / 2 - 19.6, 5.75], [Lf / 2 - 18.0, 5.75]];
  const fs = g.count;
  for (const e of [-0.12, 0.12]) for (const [x, z] of F) g.vert(x, z, e, 0, 0, e > 0 ? 1 : -1, { color: W });
  g.quad(fs, fs + 1, fs + 2, fs + 3); g.quad(fs + 4, fs + 7, fs + 6, fs + 5); g.quad(fs, fs + 4, fs + 5, fs + 1); g.quad(fs + 3, fs + 2, fs + 6, fs + 7); g.quad(fs + 2, fs + 1, fs + 5, fs + 6);
  // arka motorlar
  for (const sd of [-1, 1]) {
    const ex = Lf / 2 - 14.2, ey = 1.85 * sd, ez = 2.75, s = g.count;
    const pr = [[0.55, 0], [0.62, 0.5], [0.6, 2.4], [0.42, 3.2]];
    for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); for (const [r, x] of pr) g.vert(ex - x + 1.6, ez + sn * r, ey + c * r, 0, sn, c, { color: x < 0.2 ? Dk : W }); }
    for (let k = 0; k < 10; k++) for (let j = 0; j < pr.length - 1; j++) { const a = s + k * pr.length + j, b = a + pr.length; g.quad(a, a + 1, b + 1, b); }
    g.box(ex, ey * 0.6, ez - 0.15, 1.6, 0.9, 0.3, 0);
  }
  for (const [x, y] of [[Lf / 2 - 2.5, 0], [Lf / 2 - 11, 1.4], [Lf / 2 - 11, -1.4]]) g.box(x, y, 0, 0.35, 0.5, 1.2, 0);
  for (let k = 0; k < g.n.length; k += 3) { const l = Math.hypot(g.n[k], g.n[k + 1], g.n[k + 2]) || 1; g.n[k] /= l; g.n[k + 1] /= l; g.n[k + 2] /= l; }
  BIZ = { geo: g.geometry(), len: Lf };
  return BIZ;
}

// el ile yerleştirilen uçaklar (örneklenmiş): list = [{ x, y, hx, hy, sc }] (x, y burnun durduğu nokta)
function placeAirliners(ctx, list, name) {
  if (!list.length) return;
  const G = airlinerGeoms(), M = ctx.M;
  const bm = new THREE.InstancedMesh(G.body, M.body, list.length), tm = new THREE.InstancedMesh(G.tail, M.body, list.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((s, i) => {
    const L = G.len * s.sc, cx = s.x - s.hx * L / 2, cy = s.y - s.hy * L / 2;
    o.position.set(cx, 0.12, -cy); o.rotation.set(0, Math.atan2(s.hy, s.hx), 0); o.scale.setScalar(s.sc); o.updateMatrix();
    bm.setMatrixAt(i, o.matrix); tm.setMatrixAt(i, o.matrix);
    c.setHex(s.col != null ? s.col : TAILS[i * 7 % TAILS.length]); tm.setColorAt(i, c);
  });
  for (const m of [bm, tm]) { m.computeBoundingSphere(); m.matrixAutoUpdate = false; ctx.grp.add(m); }
  bm.name = name; tm.name = name + '-kuyruk';
}
function placeBizjets(ctx, list) {
  if (!list.length) return;
  const G = bizjetGeom();
  const m = new THREE.InstancedMesh(G.geo, ctx.M.body, list.length), o = new THREE.Object3D();
  list.forEach((s, i) => {
    const cx = s.x - s.hx * (G.len / 2 + 1.5), cy = s.y - s.hy * (G.len / 2 + 1.5);
    o.position.set(cx, 0.1, -cy); o.rotation.set(0, Math.atan2(s.hy, s.hx), 0); o.scale.setScalar(s.sc || 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
  });
  m.computeBoundingSphere(); m.matrixAutoUpdate = false; m.name = 'is-jetleri'; ctx.grp.add(m);
}

// ---------- kurulum ----------
export function build(ctx) {
  const { d, grp } = ctx;
  // genel hangar çizimini kaldır (yerine aşağıdaki ayrıntılı hangarlar)
  for (const nm of ['hangar-duvar', 'hangar-cati', 'hangar-kenar']) { const m = grp.getObjectByName(nm); if (m && m.parent === grp) { grp.remove(m); m.geometry.dispose(); } }
  const byId = new Map(d.bina.filter((b) => b.t === 'terminal').map((b) => [b.id, b]));
  // dış hatlar: ana eksen salonun apron kenarından (~11°)
  const dis = byId.get(DIS);
  if (dis && PARCA[DIS]) {
    const H = PARCA[DIS].hall, ang = Math.atan2(H[11][1] - H[0][1], H[11][0] - H[0][0]);
    const nA = [-Math.sin(ang), Math.cos(ang)];
    // gidiş katı yolu: salonun kuzey (kara) kenarına paralel, 17 m açıkta, 7.5 m yükseklikte
    const p0 = [H[3][0] + nA[0] * 17, H[3][1] + nA[1] * 17];
    terminalLTBA(ctx, dis, PARCA[DIS], { hallH: 21, pierH: 12.5, roof: 'kubbe', ang, overhang: 7, viaduct: { p0, ang, len: 330, h: 7.5, w: 16 } });
  }
  const ic = byId.get(IC);
  if (ic && PARCA[IC]) {
    const o = obbOf(PARCA[IC].hall);
    terminalLTBA(ctx, ic, PARCA[IC], { hallH: 16, pierH: 11, roof: 'isik', ang: o.ang, overhang: 4 });
  }
  // diğer (bilinmeyen) terminal tabanları: düz kutu
  for (const b of byId.values()) if (!PARCA[b.id]) terminalLTBA(ctx, b, { hall: b.p, piers: [] }, { hallH: 14, pierH: 14, roof: 'isik', ang: obbOf(b.p).ang });
  const br = [];
  for (const id of [DIS, IC]) if (byId.get(id) && PARCA[id]) br.push(...PARCA[id].br);
  bridges(ctx, br);
  // kuleler: yeni kule OSM konumunda (etiketteki 3 m yanlış), eski kule iç hatlar terminalinin kara tarafında
  let tw = null; for (const b of d.bina) if (b.t === 'tower') { tw = centroid(b.p); break; }
  towerNew(ctx, tw ? tw[0] : -342, tw ? tw[1] : -254, 62);
  towerOld(ctx, -214, 422, 34);
  // hangarlar: THY Teknik bakım hangarları gerçekte ~25-35 m; küçük genel havacılık hangarları ~12 m
  const front = hangars(ctx, (b, area) => {
    if (area < 3000) return { h: 12 };
    if (/Türk Hava Yolları/.test(b.n || '')) return { h: 34, open: true };
    if (/Eski/.test(b.n || '')) return { h: 26 };
    if (area > 25000) return { h: 30 };
    return { h: 24 };
  });
  // bakım için hangar önünde bekleyen uçaklar (burun kapıya dönük)
  const extra = [];
  for (const f of front) {
    if (f.area < 3000) continue;
    const big = f.H >= 30;
    const sc = big ? 1.7 : 1.0, gap = f.open ? -6 : 16;
    extra.push({ x: f.x + f.nx * gap, y: f.y + f.ny * gap, hx: -f.nx, hy: -f.ny, sc, col: 0xd0d4d8 });
  }
  // kargo: güneydoğu apronunun (en büyük ikinci apron) dış uzun kenarı
  let cap = null, capA = 0;
  for (const a of d.apron) { const r = a[0], [cx, cy] = centroid(r); if (cx < 200 || cy > -200) continue; const ar = Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2; if (ar > capA) { capA = ar; cap = r; } }
  if (cap) {
    // yalnız güney-doğuya bakan uzun kenar (pistten uzak taraf)
    let pick = null;
    for (let i = 0; i < cap.length; i++) {
      const A = cap[i], B = cap[(i + 1) % cap.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 300) continue;
      const [cx, cy] = centroid(cap), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      if (!pick || my - cy < pick.dy) pick = { A, B, dy: my - cy, side: ((B[0] - A[0]) * (cy - A[1]) - (B[1] - A[1]) * (cx - A[0])) > 0 ? -1 : 1 };
    }
    if (pick) extra.push(...cargo(ctx, pick.A, pick.B, pick.side).map((s) => ({ ...s, col: 0xe8e8e8 })));
  }
  placeAirliners(ctx, extra, 'ucaklar-bakim-kargo');
  // park yerleri: genel havacılık apronundakiler (kuzeybatı) iş jeti, diğerleri yolcu uçağı (yolcu trafiği yok: seyrek)
  const S = stands(d);
  const isGA = (s) => s.x < -1350 && s.y > 1700;
  ctx.stands = S.filter((s) => !isGA(s));
  standsAndAircraft(ctx, { occ: 0.3 });
  const ga = S.filter((s) => isGA(s) && !s.pt && ((Math.round(s.x * 7 + s.y * 3) % 5) !== 0)).map((s) => ({ x: s.x, y: s.y, hx: s.ux || 1, hy: s.uy || 0 }));
  placeBizjets(ctx, ga);
  vehicles(ctx, ctx.stands);
}
