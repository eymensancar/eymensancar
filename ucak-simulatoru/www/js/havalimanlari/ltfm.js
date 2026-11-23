// İstanbul Havalimanı (LTFM, IST). Dış görünüş, gerçek ölçülere yakın (OSM tabanı + açık kaynaklardaki ölçüler):
// - Ana terminal (OSM tabanı, ~440 000 m² taban): ana salon ~34 m saçak, üstünde kare modüllü yastık tonozlar ve her
//   modülün tepesinde çatı ışıklığı; iskele kolları ~20 m, sırtlarında ışıklık dizisi; alt kat (apron hizmet katı) beton,
//   üst katlar cam; kara tarafında saçağı yolun üstüne uzanan kanopi ve ağaç sütunlar.
//   Terminal tek parça: ctx.parts.get('terminal:IST'), userData = { id, ad, taban, yukseklik, katYuksekligi, kotu,
//   anaSalon: { taban, yukseklik } } — iç mekân bu gruba çocuk olarak eklenecek.
// - Lale biçimli ana kule (90 m, Pininfarina/AECOM tasarımından esinlenen kendi geometrimiz): eliptik kesit, belde
//   incelip yukarıda tomurcuk gibi açılan gövde, iki kontrol katı, kabini saran üç taç yaprağı, gövdede burgulu cam yarıklar.
// - Apron kulesi, hangar kapıları, kargo binaları (SmartIST benzeri büyük kargo terminali), çok katlı otopark ve otel,
//   terminal önü yolu, gidiş katı viyadüğü ve rampaları, kapılara yanaşmış yolcu uçakları (ortak.js).
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, stands, standsAndAircraft } from '../havalimani.js';
import { terminal, jetBridges, vehicles, towerModern, towerPos, pip, nearestEdge } from './ortak.js';

const TERM_ID = 'IST';
const H_PIER = 20, H_HALL = 34, FLOOR = 4.6;
// ana salon kutusu (yerel m; OSM tabanından): kara tarafı cephesi y ≈ -1437, iskele kökleri y ≈ -1052
const HALL = [245, -1442, 1095, -1046];

// ---------- küçük yardımcılar ----------
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const ccw = (P) => (area2(P) < 0 ? P.slice().reverse() : P);
// çokgeni eksene paralel dikdörtgene kırp (Sutherland-Hodgman)
function clipRect(P, x0, y0, x1, y1) {
  const planes = [[(p) => p[0] >= x0, 0, x0], [(p) => p[0] <= x1, 0, x1], [(p) => p[1] >= y0, 1, y0], [(p) => p[1] <= y1, 1, y1]];
  let out = P;
  for (const [ins, ax, v] of planes) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], ia = ins(a), ib = ins(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (v - a[ax]) / (b[ax] - a[ax]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    if (!out.length) return out;
  }
  // art arda aynı noktaları at
  return out.filter((p, i) => { const q = out[(i + 1) % out.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05; });
}
// cam cephe prizması (doku: 3 m bölme x kat yüksekliği)
function glassPrism(gb, P, h0, h1, fl) {
  if (!gb.uv) { gb.uv = []; }
  gb._per = 0;
  const s = gb.uv.length;
  gb.prism(P, h0, h1, false);
  for (let k = s; k < gb.uv.length; k += 2) { gb.uv[k] /= 3.0; gb.uv[k + 1] = (gb.uv[k + 1] - h0) / fl; }
}
// eğimli/yatay şerit: yol [[x, y, z]], en w, kalınlık t (0: yalnız üst yüzey), kenar korkuluğu par (m)
function strip(gb, pts, w, t = 0, par = 0, parGb = null) {
  const n = pts.length, L = [], R = [];
  for (let k = 0; k < n; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    L.push([pts[k][0] - dy * w / 2, pts[k][1] + dx * w / 2, pts[k][2]]);
    R.push([pts[k][0] + dy * w / 2, pts[k][1] - dx * w / 2, pts[k][2]]);
  }
  const s = gb.count;
  for (let k = 0; k < n; k++) { gb.vert(L[k][0], L[k][2], L[k][1], 0, 1, 0); gb.vert(R[k][0], R[k][2], R[k][1], 0, 1, 0); }
  for (let k = 0; k < n - 1; k++) { const a = s + k * 2; gb.quad(a, a + 1, a + 3, a + 2); }
  if (t > 0) {
    // alt yüzey ve yanlar
    const s2 = gb.count;
    for (let k = 0; k < n; k++) { gb.vert(L[k][0], L[k][2] - t, L[k][1], 0, -1, 0); gb.vert(R[k][0], R[k][2] - t, R[k][1], 0, -1, 0); }
    for (let k = 0; k < n - 1; k++) { const a = s2 + k * 2; gb.quad(a, a + 2, a + 3, a + 1); }
    for (const [S, sg] of [[L, 1], [R, -1]]) {
      const s3 = gb.count;
      for (let k = 0; k < n; k++) { gb.vert(S[k][0], S[k][2], S[k][1], 0, 0, 0); gb.vert(S[k][0], S[k][2] - t, S[k][1], 0, 0, 0); }
      for (let k = 0; k < n - 1; k++) { const a = s3 + k * 2; if (sg > 0) gb.quad(a, a + 2, a + 3, a + 1); else gb.quad(a, a + 1, a + 3, a + 2); }
    }
  }
  if (par > 0 && parGb) for (const S of [L, R]) for (let k = 0; k < n - 1; k++) {
    const [ax, ay, az] = S[k], [bx, by, bz] = S[k + 1];
    const len = Math.hypot(bx - ax, by - ay); if (len < 0.1) continue;
    const ang = Math.atan2(by - ay, bx - ax), steps = Math.max(1, Math.ceil(Math.abs(bz - az) / 0.5));
    for (let q = 0; q < steps; q++) {
      const t0 = q / steps, t1 = (q + 1) / steps;
      parGb.box(ax + (bx - ax) * (t0 + t1) / 2, ay + (by - ay) * (t0 + t1) / 2, az + (bz - az) * t0, len / steps + 0.05, 0.35, par, ang);
    }
  }
}
// noktaları sabit aralıkla yeniden örnekle
function resample(pts, step) {
  const out = [pts[0]];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
    for (let q = 1; q <= n; q++) { const t = q / n; out.push(a.map((v, i) => v + (b[i] - v) * t)); }
  }
  return out;
}
// yay: (cx, cy) merkezli, r yarıçaplı, a0..a1 açıları
const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
// iki 3B nokta arasında dört yüzlü kiriş (a, b: [x, y, z])
function beam(gb, a, b, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
  const t = [dx / L, dy / L, dz / L];
  let u = Math.abs(t[2]) < 0.9 ? [t[1], -t[0], 0] : [1, 0, 0]; const ul = Math.hypot(...u); u = u.map((v) => v / ul);
  const v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
  const s = gb.count;
  for (const p of [a, b]) for (let k = 0; k < 4; k++) {
    const an = k / 4 * Math.PI * 2 + Math.PI / 4, c = Math.cos(an) * r, sn = Math.sin(an) * r;
    const nx = u[0] * Math.cos(an) + v[0] * Math.sin(an), ny = u[1] * Math.cos(an) + v[1] * Math.sin(an), nz = u[2] * Math.cos(an) + v[2] * Math.sin(an);
    gb.vert(p[0] + u[0] * c + v[0] * sn, p[2] + u[2] * c + v[2] * sn, p[1] + u[1] * c + v[1] * sn, nx, nz, ny);
  }
  for (let k = 0; k < 4; k++) { const k1 = (k + 1) % 4; gb.quad(s + k, s + k1, s + 4 + k1, s + 4 + k); }
}
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function mesh(grp, gb, mat, name, normals = false) {
  if (!gb.count) return null;
  const g = gb.geometry(); if (normals) g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.name = name; m.matrixAutoUpdate = false; grp.add(m); return m;
}
// kule çarpışması (yeniden kurulunca çoğalmasın; ortak.js ile aynı anahtar)
function addCol(ctx, c) {
  const W = ctx.W, k = Math.round(c.x) + ':' + Math.round(c.y);
  W._apCol = W._apCol || new Set();
  if (W._apCol.has(k)) return; W._apCol.add(k); W.lmCol.push(c);
}

// ---------- malzemeler (bu modüle özgü) ----------
let MY = null;
function myMats(ctx) {
  if (MY) return MY;
  const env = ctx.W.envMap();
  MY = {
    roof: new THREE.MeshStandardMaterial({ color: 0xdfe2e4, metalness: 0.35, roughness: 0.42, envMap: env, envMapIntensity: 0.7, side: THREE.DoubleSide }),
    sky: new THREE.MeshStandardMaterial({ color: 0x7f97a8, metalness: 0.75, roughness: 0.08, envMap: env, envMapIntensity: 1.2, side: THREE.DoubleSide }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ef, metalness: 0.1, roughness: 0.38, envMap: env, envMapIntensity: 0.6, side: THREE.DoubleSide }),
    cab: new THREE.MeshStandardMaterial({ color: 0x40606f, metalness: 0.8, roughness: 0.06, envMap: env, envMapIntensity: 1.3, side: THREE.DoubleSide }),
    road: (() => { const m = new THREE.MeshLambertMaterial({ color: 0x3a3c3f, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); return m; })(),
    paint: new THREE.MeshLambertMaterial({ color: 0xe6e6de, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    deck: new THREE.MeshLambertMaterial({ color: 0xc9c6bf }),
    dark: new THREE.MeshLambertMaterial({ color: 0x33373b }),
    door: new THREE.MeshLambertMaterial({ color: 0xa9b2ba }),
    cargo: new THREE.MeshLambertMaterial({ color: 0xd9dcdf }),
    car: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  };
  return MY;
}

// ---------- ana terminal ----------
function mainTerminal(ctx, b) {
  const { M, gh } = ctx, my = myMats(ctx);
  const P = ccw(b.p);
  const grp = new THREE.Group();
  const base = Math.min(0, ...P.filter((_, i) => i % 4 === 0).map(([x, y]) => gh(x, y))) - 0.6;
  const Ph = ccw(clipRect(P, ...HALL));
  const glass = new GB(), conc = new GB(), roof = new GB(), sky = new GB(), dark = new GB();
  // cephe: alt kat beton (apron hizmet katı), üstü cam; ana salonun iskelelerden yüksek kalan duvarı da cam
  conc.prism(inflate(P, 0.35), base, 6.2, false);
  conc.prism(inflate(P, 0.6), 6.2, 7.0, false);                 // kat bandı
  glassPrism(glass, P, 7.0, H_PIER, FLOOR);
  glassPrism(glass, Ph, H_PIER, H_HALL, FLOOR);
  // çatılar: iskeleler (saçak 3 m), ana salon (saçak 6 m) ve kara tarafında yolun üstüne uzanan kanopi
  roof.prism(inflate(P, 3), H_PIER, H_PIER + 1.4, true, true);
  roof.prism(inflate(Ph, 6), H_HALL, H_HALL + 2.0, true, true);
  const canopy = [[372, -1500], [965, -1500], [965, -1436], [372, -1436]];
  roof.prism(canopy, H_HALL - 0.5, H_HALL + 1.5, true, true);
  // saçak altı koyu bant (gölge çizgisi)
  dark.prism(inflate(P, 2.6), H_PIER - 0.6, H_PIER, false);
  dark.prism(inflate(Ph, 5.6), H_HALL - 0.8, H_HALL, false);
  // kanopiyi taşıyan ağaç sütunlar (gövde + dört dal)
  for (let x = 390; x <= 950; x += 37.3) {
    const y = -1494, g0 = gh(x, y);
    conc.lathe(x, y, [[0.9, 0], [0.75, 18]], 8, g0);
    for (const [dx, dy] of [[1, 0.7], [-1, 0.7], [1, -0.7], [-1, -0.7]]) beam(conc, [x, y, g0 + 17.5], [x + dx * 8, y + dy * 7, H_HALL - 0.5], 0.45);
  }
  // kaldırım platformu: cephe ile viyadük arasında, gidiş katı hizasında
  conc.box(668, -1444, gh(668, -1470) + 8.0, 577, 13, 1.2, 0);
  // ana salon çatısı: 36 m'lik kare modüllerde yastık tonozlar, tepelerinde ışıklık
  const MOD = 36.6, rise = 4.2, n = 6;
  const hallMods = [];
  for (let x = HALL[0] + 6; x + MOD <= HALL[2] - 2; x += MOD) for (let y = HALL[1] + 4; y + MOD <= HALL[3] - 2; y += MOD) {
    const cs = [[x, y], [x + MOD, y], [x + MOD, y + MOD], [x, y + MOD], [x + MOD / 2, y + MOD / 2]];
    if (!cs.every(([px, py]) => pip(Ph, px, py))) continue;
    if (nearestEdge(Ph, x + MOD / 2, y + MOD / 2).d < MOD / 2 + 1) continue;
    hallMods.push([x, y]);
  }
  const h0 = H_HALL + 2.0;
  for (const [x, y] of hallMods) {
    const s = roof.count;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const u = i / n, v = j / n;
      const z = h0 + rise * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) - 0.02;
      roof.vert(x + u * MOD, z, y + v * MOD, 0, 1, 0);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = s + i * (n + 1) + j;
      if (i >= 2 && i < 4 && j >= 2 && j < 4) continue;       // tepe: ışıklık
      roof.quad(a, a + n + 1, a + n + 2, a + 1);
    }
    // ışıklık: tepedeki açıklığa oturan alçak cam piramit
    const cx = x + MOD / 2, cy = y + MOD / 2, e = MOD / 6, zt = h0 + rise * Math.sin(Math.PI / 3) ** 2;
    const s2 = sky.count;
    sky.vert(cx - e, zt, cy - e); sky.vert(cx + e, zt, cy - e); sky.vert(cx + e, zt, cy + e); sky.vert(cx - e, zt, cy + e);
    sky.vert(cx, zt + 1.8, cy);
    sky.tri(s2, s2 + 1, s2 + 4); sky.tri(s2 + 1, s2 + 2, s2 + 4); sky.tri(s2 + 2, s2 + 3, s2 + 4); sky.tri(s2 + 3, s2, s2 + 4);
  }
  // iskele sırtlarında ışıklıklar: tabanın derin içindeki noktalar, en yakın kenara paralel kısa tonozlar
  const o = obbOf(P);
  let nSky = 0;
  for (let x = -60; x < 1350; x += 27) for (let y = -1700; y < -400; y += 27) {
    if (x > HALL[0] - 4 && x < HALL[2] + 4 && y > HALL[1] - 4 && y < HALL[3] + 4) continue;
    if (!pip(P, x, y)) continue;
    const e = nearestEdge(P, x, y); if (e.d < 17) continue;
    const ang = Math.atan2(e.nx, -e.ny);
    const c = Math.cos(ang), s = Math.sin(ang), L = 16, Wd = 5.5;
    const s0 = sky.count, seg = 5;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg, v = (t - 0.5) * Wd, hz = H_PIER + 1.4 + 1.8 * Math.sin(Math.PI * t);
      for (const sd of [-1, 1]) sky.vert(x + c * sd * L / 2 - s * v, hz, y + s * sd * L / 2 + c * v);
    }
    for (let k = 0; k < seg; k++) { const a = s0 + k * 2; sky.quad(a, a + 2, a + 3, a + 1); }
    nSky++;
  }
  void o; void nSky;
  // çatı ekipmanı: ana salon kenarlarında birkaç teknik kutu
  for (let k = 0; k < 10; k++) {
    const x = 300 + k * 78, y = -1075;
    if (pip(Ph, x, y)) dark.box(x, y, H_HALL + 2, 9, 5, 2.4, 0);
  }
  mesh(grp, glass, M.glass, 'cephe'); mesh(grp, conc, M.conc, 'zemin'); mesh(grp, roof, my.roof, 'cati', true);
  mesh(grp, sky, my.sky, 'isiklik', true); mesh(grp, dark, my.dark, 'sacak');
  grp.userData = { id: TERM_ID, ad: 'İstanbul Havalimanı Terminal Binası', taban: P, yukseklik: H_PIER, katYuksekligi: FLOOR, kotu: base, anaSalon: { taban: Ph, yukseklik: H_HALL } };
  grp.matrixAutoUpdate = false;
  (ctx.solid || (ctx.solid = [])).push({ P: Ph, top: H_HALL + 2 + rise, ad: 'Terminal' }, { P: canopy, top: H_HALL + 1.5, ad: 'Terminal' });
  ctx.part('terminal:' + TERM_ID, grp);
  return P;
}

// ---------- lale biçimli ana kule ----------
// eliptik kesit (uzun eksen rot yönünde, oran 0.8); profil [yarıçap, yükseklik] 90 m'ye göre
function tulipTower(ctx, x, y, H = 90, rot = 0.55) {
  const { M, gh } = ctx, my = myMats(ctx);
  const base = gh(x, y) - 0.5, k = H / 90;
  const shell = new GB(), cab = new GB(), slit = new GB(), conc = new GB(), dark = new GB();
  const E = 0.8, cr = Math.cos(rot), sr = Math.sin(rot);
  const P = (r, a, z) => { const ex = Math.cos(a) * r, ey = Math.sin(a) * r * E; return [x + ex * cr - ey * sr, y + ex * sr + ey * cr, base + z * k]; };
  const surf = (gb, prof, seg, topFn) => {
    const s0 = gb.count, np = prof.length;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2;
      for (let j = 0; j < np; j++) {
        let [r, z] = prof[j];
        if (topFn && j === np - 1) z = topFn(a);
        const tw = Math.sin(3 * a + z * 0.04);
        const [px, py, pz] = P(r * (1 + 0.035 * tw), a, z);
        gb.vert(px, pz, py);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < np - 1; j++) { const a = s0 + i * np + j, b = a + np; gb.quad(a, b, b + 1, a + 1); }
  };
  // gövde: geniş kaide, belde incelir, tomurcuk gibi açılır
  surf(shell, [[11.5, 0], [10.2, 4], [8.4, 12], [7.0, 24], [6.4, 36], [6.6, 46], [7.6, 54], [9.4, 61], [11.4, 66.5], [12.6, 71], [13.2, 74.5]], 48);
  // alt kontrol katı (cam bant) ve üst kabin
  surf(cab, [[9.0, 58.5], [9.75, 61.2]], 40);
  surf(cab, [[12.4, 74.5], [12.9, 82.5]], 40);
  surf(shell, [[13.2, 74.3], [12.4, 74.6]], 40);                                  // kabin altı tablası
  // taç yaprakları: kabini saran kabuk, üç sivri uç
  const petalTop = (a) => 85 + 6.5 * Math.pow(Math.max(0, Math.cos(1.5 * (a - 0.3)) ** 2), 3);
  surf(shell, [[13.25, 82.5], [13.7, 84.5], [13.3, 87]], 72, (a) => Math.max(87, petalTop(a)));
  surf(dark, [[12.9, 84.6], [7, 85.2], [0.2, 85.6]], 24);                        // kabin çatısı
  // burgulu cam yarıklar (gövde boyunca iki sarmal)
  for (const a0 of [0.4, 0.4 + Math.PI]) {
    const s0 = slit.count, prof = [[10.6, 5], [8.9, 12], [7.5, 24], [6.85, 36], [7.05, 46], [8.05, 54], [9.8, 61]];
    for (const [r, z] of prof) for (const da of [-0.09, 0.09]) {
      const a = a0 + da + z * 0.022, tw = Math.sin(3 * a + z * 0.04);
      const [px, py, pz] = P(r * (1 + 0.035 * tw) + 0.12, a, z);
      slit.vert(px, pz, py);
    }
    for (let j = 0; j < prof.length - 1; j++) { const a = s0 + j * 2; slit.quad(a, a + 1, a + 3, a + 2); }
  }
  // kaide binası ve anten direği
  const pod = Array.from({ length: 28 }, (_, i) => { const a = i / 28 * Math.PI * 2; const [px, py] = P(27, a, 0); return [px, py]; });
  conc.prism(ccw(pod), base, base + 8.5);
  dark.prism(ccw(pod.map(([px, py]) => [x + (px - x) * 1.02, y + (py - y) * 1.02])), base + 8.5, base + 9.3, true);
  conc.lathe(x, y, [[0.6, 0], [0.25, 10]], 6, base + 85.6 * k);
  const grp = new THREE.Group();
  mesh(grp, shell, my.white, 'govde', true); mesh(grp, cab, my.cab, 'kabin', true); mesh(grp, slit, my.cab, 'yarik', true);
  mesh(grp, conc, M.conc, 'kaide'); mesh(grp, dark, my.dark, 'cati', true);
  grp.matrixAutoUpdate = false;
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 14, top: ctx.d.elev + base + H + 2 });
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 27, top: ctx.d.elev + base + 9 });
  return ctx.part('kule', grp);
}

// ---------- hangar kapıları (genel hangarların apron tarafı) ----------
function hangarDoors(ctx) {
  const { d } = ctx, my = myMats(ctx);
  const door = new GB(), dark = new GB();
  const seen = new Set();
  const tw = []; for (const t of d.twy) for (const p of t.p) tw.push(p);
  for (const b of d.bina) {
    if (b.t !== 'hangar') continue;
    const key = b.p[0][0] + ':' + b.p[0][1]; if (seen.has(key)) continue; seen.add(key);
    const P = ccw(b.p), [cx, cy] = centroid(P);
    let near = null, nd = 1e9; for (const p of tw) { const q = Math.hypot(p[0] - cx, p[1] - cy); if (q < nd) { nd = q; near = p; } }
    if (!near) continue;
    // kapı: en yakın taksi yoluna bakan uzun kenar
    let best = null, bs = -1e9;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], c = P[(i + 1) % P.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 30) continue;
      const nx = (c[1] - a[1]) / L, ny = -(c[0] - a[0]) / L;
      const sc = (nx * (near[0] - cx) + ny * (near[1] - cy)) / (nd || 1) + L / 400;
      if (sc > bs) { bs = sc; best = { a, c, L, nx, ny }; }
    }
    if (!best) continue;
    const { a, c, L, nx, ny } = best, ang = Math.atan2(c[1] - a[1], c[0] - a[0]);
    const hh = b.h * 0.72 * 0.86, Wd = L * 0.9, mx = (a[0] + c[0]) / 2 + nx * 0.35, my2 = (a[1] + c[1]) / 2 + ny * 0.35;
    const g0 = Math.min(0, ctx.gh(mx, my2)) - 0.4;
    door.box(mx, my2, g0, Wd, 0.5, hh - g0, ang);
    dark.box(mx + nx * 0.2, my2 + ny * 0.2, hh, Wd + 2, 0.5, 1.6, ang);                // kapı kirişi
    const np = Math.max(3, Math.round(Wd / 9));
    for (let q = 1; q < np; q++) {
      const t = q / np - 0.5, px = mx + Math.cos(ang) * Wd * t + nx * 0.3, py = my2 + Math.sin(ang) * Wd * t + ny * 0.3;
      dark.box(px, py, g0, 0.35, 0.3, hh - g0, ang);
    }
    dark.box(mx + nx * 0.3, my2 + ny * 0.3, g0, Wd, 0.3, 0.5, ang);                     // kapı rayı
  }
  const grp = new THREE.Group(); grp.matrixAutoUpdate = false;
  mesh(grp, door, my.door, 'kapi'); mesh(grp, dark, my.dark, 'kapi-cizgi');
  ctx.part('hangar-kapilari', grp);
}

// ---------- kargo binaları (kuzeybatı kargo apronunun kuzeyinde; SmartIST'e benzer büyük kargo terminali) ----------
function cargo(ctx) {
  const { M, gh } = ctx, my = myMats(ctx);
  const wall = new GB(), roof = new GB(), dark = new GB(), glass = new GB();
  const blds = [
    // [x0, y0, x1, y1, yükseklik]
    [-1795, 2715, -1180, 2850, 26],
    [-1760, 2865, -1440, 2905, 14],
  ];
  for (const [x0, y0, x1, y1, h] of blds) {
    const P = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const g0 = Math.min(...P.map(([x, y]) => gh(x, y)), 0) - 0.5;
    wall.prism(P, g0, h, false);
    roof.prism(inflate(P, 1.2), h, h + 1.2, true);
    // çatıda boyuna sırtlar (shed çatı izlenimi)
    for (let x = x0 + 20; x < x1 - 10; x += 30) roof.box(x, (y0 + y1) / 2, h + 1.2, 6, (y1 - y0) - 10, 1.6, 0);
    // ofis bandı (cam) ve yükleme kapıları (apron tarafı: güney)
    glassPrism(glass, [[x0 - 0.3, y0 - 0.3], [x0 + 80, y0 - 0.3], [x0 + 80, y1 + 0.3], [x0 - 0.3, y1 + 0.3]], h - 9, h - 1, 3.6);
    if (h > 20) for (let x = x0 + 100; x < x1 - 15; x += 14) dark.box(x, y0 - 0.25, g0, 9, 0.5, 9 - g0, 0);
  }
  // apron tarafında kamyon/ULD alanı çizgisi yerine ULD yığınları (küçük kutular)
  for (let k = 0; k < 40; k++) { const x = -1760 + k * 14 + hash(k, 1) * 4, y = 2700 - hash(k, 2) * 6; wall.box(x, y, gh(x, y), 3.1, 2.4, 1.6 + (k % 3 === 0 ? 1.6 : 0), 0); }
  const grp = new THREE.Group(); grp.matrixAutoUpdate = false;
  mesh(grp, wall, my.cargo, 'duvar'); mesh(grp, roof, M.roof, 'cati'); mesh(grp, dark, my.dark, 'kapi'); mesh(grp, glass, M.glass, 'cam');
  (ctx.solid || (ctx.solid = [])).push(...blds.map(([x0, y0, x1, y1, h]) => ({ P: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], top: h + 1.2, ad: 'Kargo' })));
  ctx.part('kargo', grp);
}

// ---------- kara tarafı: yollar, gidiş viyadüğü, otopark, otel ----------
function landside(ctx) {
  const { M, gh } = ctx, my = myMats(ctx);
  const road = new GB(), paint = new GB(), deck = new GB(), parGb = new GB(), dark = new GB(), conc = new GB(), glass = new GB();
  const g0 = gh(668, -1470);
  const ground = (pts, step = 12) => resample(pts.map((p) => [p[0], p[1], 0]), step).map(([x, y]) => [x, y, gh(x, y) + 0.12]);
  const lanes = (pts, w, nl) => {
    // şerit çizgileri: kesikli beyaz (9 m çizgi, 9 m ara)
    const P = pts;
    for (let l = 1; l < nl; l++) {
      const off = -w / 2 + w * l / nl;
      let acc = 0;
      for (let k = 0; k < P.length - 1; k++) {
        const a = P[k], b = P[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
        const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
        for (let s = 0; s < L; s += 3) {
          if (((acc + s) % 18) < 9) {
            const t0 = s / L, t1 = Math.min(1, (s + 3) / L);
            const p0 = [a[0] + (b[0] - a[0]) * t0 + nx * off, a[1] + (b[1] - a[1]) * t0 + ny * off, a[2] + (b[2] - a[2]) * t0 + 0.06];
            const p1 = [a[0] + (b[0] - a[0]) * t1 + nx * off, a[1] + (b[1] - a[1]) * t1 + ny * off, a[2] + (b[2] - a[2]) * t1 + 0.06];
            strip(paint, [p0, p1], 0.18);
          }
        }
        acc += L;
      }
    }
  };
  // 1) gidiş katı viyadüğü: cephe önünde +9 m, iki uçta güneye inen rampalar
  const DZ = g0 + 9.2, Y = -1463, XW = 300, XE = 1036;
  const viaduct = [[XW + 40, Y], [XE - 40, Y]];
  const vpts = resample(viaduct.map(([x, y]) => [x, y, DZ]), 20);
  strip(deck, vpts, 24, 1.6, 1.1, parGb);
  lanes(vpts, 24, 6);
  // rampalar: viyadük ucundan yayla güneye dönüp yere iner
  const ramp = (sx) => {
    const c = [sx === -1 ? XW + 40 : XE - 40, Y - 40];
    const a0 = Math.PI / 2, a1 = sx === -1 ? Math.PI : 0;
    const curve = arc(c[0], c[1], 40, a0, a1, 8).map(([x, y]) => [x, y, DZ]);
    const xr = sx === -1 ? XW : XE;
    const down = [];
    for (let k = 1; k <= 16; k++) { const t = k / 16, y = Y - 40 - 300 * t; down.push([xr, y, DZ + (gh(xr, y) + 0.12 - DZ) * (t * t * (3 - 2 * t))]); }
    const pts = curve.concat(down);
    strip(deck, pts, 13, 1.4, 1.0, parGb);
    lanes(pts, 13, 2);
    return pts;
  };
  const rw = ramp(-1), re = ramp(1);
  // ayaklar: viyadük ve rampalar altında
  const piers = (pts, w, every) => {
    let acc = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc += L;
      if (acc < every) continue; acc = 0;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), z = b[2] - 1.5, gz = gh(b[0], b[1]) - 0.3;
      if (z - gz < 2.5) continue;
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      for (const o of w > 16 ? [-w * 0.3, w * 0.3] : [0]) conc.box(b[0] + nx * o, b[1] + ny * o, gz, 1.6, 1.6, z - gz, ang);
      conc.box(b[0], b[1], z - 1.2, 2.2, w - 2, 1.2, ang + Math.PI / 2);          // başlık kirişi
    }
  };
  piers(vpts, 24, 36); piers(rw, 13, 30); piers(re, 13, 30);
  // 2) zemin yolları: geliş yolu (viyadük altı), bağlantılar, otopark güneyindeki kavşak yolu, güneye ana yol
  const roads = [
    [[[XW + 50, Y - 6], [XE - 50, Y - 6]], 22, 5],
    [[[350, Y - 6], [350, -1770], [986, -1770], [986, Y - 6]], 12, 3],
    [[[XW, -1803], [XW, -1840], [XE, -1840], [XE, -1803]], 13, 2],
    [[[620, -1840], [620, -2900]], 14, 3],
    [[[716, -1840], [716, -2900]], 14, 3],
    [[[350, -1770], [350, -1840]], 12, 3],
    [[[986, -1770], [986, -1840]], 12, 3],
  ];
  for (const [pts, w, nl] of roads) { const g = ground(pts); strip(road, g, w); lanes(g, w, nl); }
  // 3) çok katlı otopark (5 kat, açık cepheli) ve çatıdaki arabalar
  const PK = [420, -1745, 916, -1590], LV = 5, LH = 3.3;
  const pz = Math.min(gh(PK[0], PK[1]), gh(PK[2], PK[3]), gh(PK[0], PK[3]), gh(PK[2], PK[1])) - 0.3;
  const PP = [[PK[0], PK[1]], [PK[2], PK[1]], [PK[2], PK[3]], [PK[0], PK[3]]];
  dark.prism(inflate(PP, -1.5), pz, pz + LV * LH, false);                               // içerisi (gölgeli açık katlar)
  for (let l = 0; l <= LV; l++) {
    const z = pz + l * LH;
    conc.prism(PP, z - 0.45, z + (l === 0 ? 0 : 1.05), l === LV);                      // döşeme kenarı + korkuluk
  }
  for (let x = PK[0]; x <= PK[2] + 0.1; x += 16.5) for (const y of [PK[1], PK[3]]) conc.box(x, y, pz, 0.9, 0.9, LV * LH, 0);
  for (let y = PK[1]; y <= PK[3] + 0.1; y += 16.5) for (const x of [PK[0], PK[2]]) conc.box(x, y, pz, 0.9, 0.9, LV * LH, 0);
  // köşelerde merdiven/asansör kuleleri
  for (const [x, y] of [[PK[0] + 6, PK[1] + 6], [PK[2] - 6, PK[1] + 6], [PK[0] + 6, PK[3] - 6], [PK[2] - 6, PK[3] - 6], [668, PK[3] - 6]]) {
    glassPrism(glass, [[x - 5, y - 5], [x + 5, y - 5], [x + 5, y + 5], [x - 5, y + 5]], pz, pz + LV * LH + 4, 3.3);
    conc.box(x, y, pz + LV * LH + 4, 11, 11, 0.8, 0);
  }
  // terminale yaya köprüleri (geliş yolunun üstünden, gidiş katı hizasında)
  for (const x of [520, 668, 816]) {
    const y0 = PK[3], y1 = -1500, z = DZ + 1;
    glassPrism(glass, [[x - 6, y0], [x + 6, y0], [x + 6, y1], [x - 6, y1]], z, z + 4.2, 4.2);
    conc.box(x, (y0 + y1) / 2, z - 0.6, 12.6, y1 - y0, 0.6, Math.PI / 2);
    conc.box(x, (y0 + y1) / 2, z + 4.2, 13, y1 - y0, 0.5, Math.PI / 2);
  }
  // 4) otel: otoparkın doğusunda 11 katlı cam cepheli blok
  const HT = [[1052, -1760], [1117, -1760], [1117, -1718], [1052, -1718]], hz = gh(1084, -1739) - 0.4;
  conc.prism(inflate(HT, 1.5), hz, hz + 7.5, false);
  glassPrism(glass, HT, hz + 7.5, hz + 44, 3.4);
  conc.prism(inflate(HT, 0.8), hz + 44, hz + 46.5, true);
  for (let k = 0; k < 10; k++) conc.prism(inflate(HT, 0.35), hz + 10.9 + k * 3.4, hz + 11.3 + k * 3.4, false);
  dark.box(1084, -1739, hz + 46.5, 22, 12, 3, 0);
  // çatıdaki ve zemin otoparkındaki arabalar (örneklenmiş)
  const cars = [];
  const rz = pz + LV * LH + 0.05;
  for (let x = PK[0] + 14; x < PK[2] - 14; x += 2.7) for (let r = 0; r < 8; r++) {
    const y = PK[1] + 12 + r * 18.5 + (r % 2) * 5.3;
    if (hash(x, r) < 0.72) cars.push([x, y, rz, Math.PI / 2 + (r % 2) * Math.PI]);
  }
  for (const yb of [-1880, -1990]) for (let x = 428; x < 596; x += 2.7) for (let r = 0; r < 2; r++) if (hash(x, yb + r) < 0.6) cars.push([x, yb + r * 6, gh(x, yb) + 0.12, Math.PI / 2]);
  // zemin otoparkı kaplaması
  for (const yb of [-1880, -1990]) { const g = ground([[420, yb + 3], [604, yb + 3]]); strip(road, g, 22); }
  // yoldaki araçlar (viyadükte ve geliş yolunda)
  for (let x = XW + 60; x < XE - 60; x += 11) {
    if (hash(x, 7) < 0.45) cars.push([x, Y + 6 - (Math.floor(hash(x, 8) * 3)) * 4, DZ + 0.05, 0]);
    if (hash(x, 9) < 0.4) cars.push([x, Y - 10 - (Math.floor(hash(x, 5) * 2)) * 4, gh(x, Y - 10) + 0.14, Math.PI]);
  }
  const grp = new THREE.Group(); grp.matrixAutoUpdate = false;
  mesh(grp, road, my.road, 'yol'); mesh(grp, paint, my.paint, 'yol-cizgi');
  mesh(grp, deck, my.deck, 'viyaduk'); mesh(grp, parGb, M.conc, 'korkuluk'); mesh(grp, conc, M.conc, 'beton'); mesh(grp, dark, my.dark, 'otopark-ic');
  mesh(grp, glass, M.glass, 'cam');
  if (cars.length) grp.add(carMesh(ctx, cars));
  (ctx.solid || (ctx.solid = [])).push({ P: PP, top: pz + LV * LH + 1.1, ad: 'Otopark' }, { P: HT, top: hz + 49.5, ad: 'Otel' });
  ctx.part('kara-tarafi', grp);
}
// araba: gövde + kabin (tek geometri), örnek başına renk
function carMesh(ctx, cars) {
  const gb = new GB();
  gb.box(0, 0, 0.25, 4.4, 1.8, 0.75, 0); gb.box(-0.2, 0, 1.0, 2.4, 1.6, 0.6, 0);
  const geo = gb.geometry();
  const m = new THREE.InstancedMesh(geo, myMats(ctx).car, cars.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  const COLS = [0xf0f0ee, 0xc8cacc, 0x222428, 0x8a8d90, 0x2a3f6a, 0x8a2020, 0xe8e2d0, 0x40464c];
  cars.forEach(([x, y, z, a], i) => {
    o.position.set(x, z, -y); o.rotation.set(0, a, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    c.setHex(COLS[Math.floor(hash(x * 1.3, y) * COLS.length)]); m.setColorAt(i, c);
  });
  m.computeBoundingSphere(); m.matrixAutoUpdate = false; m.name = 'arabalar';
  return m;
}

export function build(ctx) {
  const { d } = ctx;
  myMats(ctx);
  const S = stands(d);
  ctx.stands = S;
  // terminaller: ana terminal kendi modelimiz, diğerleri (VIP, ekip, JETEX) ortak düz çatılı terminal
  const terms = [], seen = new Set();
  for (const b of d.bina) {
    if (b.t !== 'terminal') continue;
    const key = b.p[0][0] + ':' + b.p[0][1]; if (seen.has(key)) continue; seen.add(key);
    const area = Math.abs(area2(b.p)) / 2;
    if (area < 400) continue;
    if (area > 100000) { terms.push(mainTerminal(ctx, b)); continue; }
    terminal(ctx, (b.id || 'T' + terms.length).toString(), b.n || 'Terminal', b.p, { h: b.lv ? b.lv * 4.5 + 4 : 12, roof: 'duz', overhang: 2.5 });
    terms.push(b.p);
  }
  // kapılara yanaşmış uçaklar: kapı park yerlerinin neredeyse hepsi dolu
  standsAndAircraft(ctx, { occ: 0.72 });
  jetBridges(ctx, terms, S);
  vehicles(ctx, S);
  // kuleler
  const t = towerPos(d, { x: -1416, y: 1325, h: 90 });
  tulipTower(ctx, t.x, t.y, 90);
  for (const b of d.bina) if (b.t === 'tower' && b.h < 80) { const [x, y] = centroid(b.p); towerModern(ctx, x, y, 42, 0.3, 'kule:apron'); break; }
  hangarDoors(ctx);
  cargo(ctx);
  landside(ctx);
  // yakın ayrıntılar (arabalar, yol çizgileri, korkuluklar) uzakta gizlenir
  const grp = ctx.parts.get('kara-tarafi'), det = grp ? grp.children.filter((c) => /^(arabalar|yol-cizgi|korkuluk)$/.test(c.name)) : [];
  let f = 0;
  ctx.tick = (cam) => {
    if (++f % 12) return;
    const dd = Math.hypot(ctx.d.x + 668 - cam.x, ctx.d.y - 1600 - cam.y, Math.max(0, cam.h - ctx.d.elev) * 0.6);
    for (const c of det) c.visible = dd < 4500;
  };
}
