// Ayrıntılı havalimanları için ortak parçalar: terminal (cam cephe, saçaklı çatı, çatı ışıklıkları, kemer),
// kuleler (lale biçimli, modern, klasik), yolcu köprüleri, park etmiş uçaklar, apron araçları.
// Her terminal ayrı bir THREE.Group'tur: adı 'terminal:<kimlik>', userData = { id, ad, taban (yerel x doğu / y kuzey, m),
// yukseklik, katYuksekligi, kotu (havalimanı yüksekliğine göre) }. İç mekân eklenecekse bu gruba çocuk olarak eklenir;
// dış kabuk (cephe, çatı) ayrı ağlarda olduğu için gizlenebilir ya da kesit alınabilir.
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, barrel, stands, standsAndAircraft } from '../havalimani.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export function pip(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// çokgen kenarına en yakın nokta
export function nearestEdge(P, x, y) {
  let best = null, bd = 1e18;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1);
    const px = ax + dx * t, py = ay + dy * t, d = Math.hypot(px - x, py - y);
    if (d < bd) { bd = d; best = { x: px, y: py, d, nx: dy / Math.sqrt(L2), ny: -dx / Math.sqrt(L2) }; }
  }
  return best;
}

// ---------- terminal ----------
// opt: { h: yükseklik, roof: 'duz' | 'isiklik' | 'kemer' | 'dalga', overhang, floor: kat yüksekliği, roofCol, skyAxis (radyan) }
export function terminal(ctx, id, ad, P, opt = {}) {
  const { M, gh } = ctx;
  const h = opt.h || 18, ov = opt.overhang != null ? opt.overhang : 4, fl = opt.floor || 4.5;
  const grp = new THREE.Group();
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.6;
  // cephe: cam (doku: 3 m x kat yüksekliği)
  const glass = new GB(); glass.uv = []; glass._per = 0;
  glass.prism(P, base, h, false);
  for (let k = 0; k < glass.uv.length; k += 2) { glass.uv[k] /= 3.0; glass.uv[k + 1] = (glass.uv[k + 1] - base) / fl; }
  // zemin şeridi (beton) ve çatı
  const plinth = new GB();
  plinth.prism(inflate(P, 0.15), base, 0.4, false);
  const roof = new GB();
  const R = inflate(P, ov);
  roof.prism(R, h, h + 1.6, true, true);
  const extra = new GB();
  const o = obbOf(P);
  const ax = opt.skyAxis != null ? opt.skyAxis : o.ang;
  if (opt.roof === 'isiklik' || opt.roof === 'dalga') {
    // çatı ışıklıkları: ana eksen boyunca, tabanın içinde kalan parçalar
    const ux = Math.cos(ax), uy = Math.sin(ax), vx = -uy, vy = ux;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    const [cx, cy] = centroid(P);
    for (const [x, y] of P) { const a = (x - cx) * ux + (y - cy) * uy, b = (x - cx) * vx + (y - cy) * vy; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const step = opt.skyStep || 36;
    for (let b = b0 + step / 2; b < b1; b += step) {
      let run = null;
      for (let a = a0; a <= a1 + 8; a += 8) {
        const x = cx + ux * a + vx * b, y = cy + uy * a + vy * b;
        const inside = a <= a1 && pip(P, x, y) && nearestEdge(P, x, y).d > 6;
        if (inside && !run) run = a;
        if (!inside && run !== null) {
          const L = a - run;
          if (L > 20) {
            const mx = cx + ux * (run + L / 2) + vx * b, my = cy + uy * (run + L / 2) + vy * b;
            if (opt.roof === 'dalga') extraVault(extra, mx, my, ax, L, 9, h + 1.6, 3.2);
            else extra.box(mx, my, h + 1.6, L, 5, 1.8, ax);
          }
          run = null;
        }
      }
    }
  }
  if (opt.roof === 'kemer') barrel(extra, { ...o, cx: o.cx, cy: o.cy, L: o.L * 0.92, Wd: o.Wd * 0.92 }, h + 1.6, h + 1.6 + (opt.rise || Math.min(o.L, o.Wd) * 0.12));
  const mk = (gb, mat, name) => { if (!gb.count) return; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; grp.add(m); };
  mk(glass, M.glass, 'cephe'); mk(plinth, M.conc, 'zemin'); mk(roof, opt.roofMat || M.roof, 'cati'); mk(extra, M.glass, 'isiklik');
  grp.userData = { id, ad, taban: P, yukseklik: h, katYuksekligi: fl, kotu: base };
  grp.matrixAutoUpdate = false;
  return ctx.part('terminal:' + id, grp);
}
function extraVault(gb, x, y, ang, L, W, h0, rise) {
  const c = Math.cos(ang), s = Math.sin(ang);
  barrel(gb, { c, s, cx: x, cy: y, L, Wd: W, ang }, h0, h0 + rise, 6);
}

// kule çarpışması (yeniden kurulunca çoğalmasın)
function addCol(ctx, c) {
  const W = ctx.W, k = Math.round(c.x) + ':' + Math.round(c.y);
  W._apCol = W._apCol || new Set();
  if (W._apCol.has(k)) return; W._apCol.add(k); W.lmCol.push(c);
}
// ---------- kuleler ----------
// lale biçimli kule (İstanbul Havalimanı kulesinden esinlenen kendi geometrimiz): ince gövde yukarıda açılıp taç yaprakları gibi
// kabina sarılır; gövdede burgulu altı kanat
export function towerTulip(ctx, x, y, H = 90) {
  const { M, gh } = ctx;
  const base = gh(x, y) - 0.5;
  const shell = new GB(), cab = new GB();
  const prof = [[10, 0], [8.2, 8], [6.4, 20], [5.6, 34], [5.4, 46], [6.2, 56], [8.2, 64], [10.6, 71], [12.2, H - 16], [12.6, H - 13]];
  const seg = 36, P = prof.length;
  const s0 = shell.count;
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2;
    for (let j = 0; j < P; j++) {
      const [r0, h] = prof[j];
      const tw = a + h * 0.018;
      const r = r0 * (1 + 0.07 * Math.cos(6 * tw)) * (H / 90);
      shell.vert(x + Math.cos(a) * r, base + h * H / 90, y + Math.sin(a) * r, Math.cos(a), 0.15, Math.sin(a));
    }
  }
  for (let k = 0; k < seg; k++) for (let j = 0; j < P - 1; j++) { const a = s0 + k * P + j, b = a + P; shell.quad(a, b, b + 1, a + 1); }
  const top = base + H - 13;
  cab.lathe(x, y, [[12.4, 0], [13.4, 6.5]], 24, top);
  shell.lathe(x, y, [[13.6, 6.5], [13.6, 7.4], [11, 9.5], [6, 11.5], [1.5, 13], [0.05, 13.2]], 24, top);
  shell.box(x, y, top + 13, 0.5, 0.5, 9, 0);
  const grp = new THREE.Group();
  for (const [gb, mat, nm] of [[shell, M.white, 'govde'], [cab, M.cab, 'kabin']]) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; grp.add(m); }
  grp.matrixAutoUpdate = false;
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 13, top: ctx.d.elev + base + H });
  return ctx.part('kule', grp);
}
// modern kule: üçgen kesitli beton gövde, çıkıntılı iki katlı kabin
export function towerModern(ctx, x, y, H = 70, rot = 0, name = 'kule') {
  const { M, gh } = ctx;
  const base = gh(x, y) - 0.5;
  const shaft = new GB(), cab = new GB(), dark = new GB();
  const tri = (r, a0) => [0, 1, 2].map((k) => [x + Math.cos(a0 + k * 2.094) * r, y + Math.sin(a0 + k * 2.094) * r]);
  shaft.prism(tri(6.5, rot), base, base + H - 12);
  shaft.prism(tri(7.5, rot + 1.047), base, base + 8);
  const ring = (r, n) => Array.from({ length: n }, (_, k) => [x + Math.cos(rot + k / n * Math.PI * 2) * r, y + Math.sin(rot + k / n * Math.PI * 2) * r]);
  dark.prism(ring(8.5, 8), base + H - 12, base + H - 8);
  cab.prism(ring(10, 8), base + H - 8, base + H - 2);
  shaft.prism(ring(11, 8), base + H - 2, base + H - 0.8);
  shaft.prism(ring(6, 8), base + H - 0.8, base + H + 1.5);
  shaft.box(x, y, base + H + 1.5, 0.4, 0.4, 8, 0);
  const grp = new THREE.Group();
  for (const [gb, mat, nm] of [[shaft, M.white, 'govde'], [cab, M.cab, 'kabin'], [dark, M.dark, 'teknik']]) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; grp.add(m); }
  grp.matrixAutoUpdate = false;
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 10, top: ctx.d.elev + base + H });
  return ctx.part(name, grp);
}
// klasik kule: silindir gövde, geniş sekizgen kabin, altında teknik kat
export function towerClassic(ctx, x, y, H = 45) {
  const { M, gh } = ctx;
  const base = gh(x, y) - 0.5;
  const shaft = new GB(), cab = new GB();
  shaft.lathe(x, y, [[5.2, 0], [4.6, H - 10]], 16, base);
  shaft.lathe(x, y, [[4.6, H - 10], [7.6, H - 8], [7.6, H - 6.5]], 8, base);
  cab.lathe(x, y, [[7.0, H - 6.5], [8.2, H - 1.2]], 8, base);
  shaft.lathe(x, y, [[8.6, H - 1.2], [8.6, H - 0.3], [2.5, H + 0.2], [0.05, H + 0.4]], 8, base);
  shaft.box(x, y, base + H, 0.3, 0.3, 6, 0);
  const grp = new THREE.Group();
  for (const [gb, mat, nm] of [[shaft, M.conc, 'govde'], [cab, M.cab, 'kabin']]) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; grp.add(m); }
  grp.matrixAutoUpdate = false;
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 8, top: ctx.d.elev + base + H });
  return ctx.part('kule', grp);
}

// ---------- yolcu köprüleri ----------
// OSM'deki köprü çizgileri (terminal ucu -> uçak ucu) ve terminale 60 m'den yakın park yerleri için kendiliğinden köprüler
export function jetBridges(ctx, terms, S) {
  const { M, d } = ctx;
  const tube = new GB(), metal = new GB();
  const one = (tx, ty, dx, dy) => {
    const L = Math.hypot(dx - tx, dy - ty); if (L < 6 || L > 60) return;
    const ang = Math.atan2(dy - ty, dx - tx);
    const h0 = 4.2, h1 = 3.6;   // terminal kapısı ve uçak kapısı eşiği
    // tünel: iki parça (iç içe geçmeli), hafif eğimli
    const n = 2;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, w = 3.4 - k * 0.25;
      const x0 = tx + (dx - tx) * t0, y0 = ty + (dy - ty) * t0, x1 = tx + (dx - tx) * t1, y1 = ty + (dy - ty) * t1;
      const hh = h0 + (h1 - h0) * (t0 + t1) / 2;
      tube.box((x0 + x1) / 2, (y0 + y1) / 2, hh, Math.hypot(x1 - x0, y1 - y0) + 0.6, w, 2.9 - k * 0.15, ang);
    }
    // döner gövde (rotunda) ve tekerlekli ayak
    metal.lathe(tx, ty, [[2.6, 0], [2.6, h0 + 3.1]], 10, 0);
    const fx = tx + (dx - tx) * 0.78, fy = ty + (dy - ty) * 0.78;
    metal.box(fx, fy, 0, 0.6, 2.6, h1 + 0.2, ang);
    metal.box(fx, fy, 0, 1.4, 3.4, 0.9, ang);
    metal.box(dx - Math.cos(ang) * 1.2, dy - Math.sin(ang) * 1.2, h1 - 0.2, 2.6, 3.8, 3.4, ang);
  };
  for (const k of d.kopru) { const a = k[0], b = k[k.length - 1]; one(a[0], a[1], b[0], b[1]); }
  if (d.kopru.length < 4 && terms.length) for (const s of S) {
    if (!s.ac || s.pt) continue;
    // ön sol kapı: burundan 6 m geride, solda 2 m
    const nx = s.x - s.ac.hx * 2, ny = s.y - s.ac.hy * 2;
    const lx = -s.ac.hy, ly = s.ac.hx;
    const sc = s.ac.sc;
    const doorX = nx - s.ac.hx * 6 * sc + lx * 2.1 * sc, doorY = ny - s.ac.hy * 6 * sc + ly * 2.1 * sc;
    let best = null;
    for (const P of terms) { const e = nearestEdge(P, doorX, doorY); if (!best || e.d < best.d) best = e; }
    if (!best || best.d > 55 || best.d < 8) continue;
    one(best.x + best.nx * 1.0, best.y + best.ny * 1.0, doorX + lx * 1.8, doorY + ly * 1.8);
  }
  const grp = new THREE.Group(); grp.name = 'yolcu-kopruleri'; grp.matrixAutoUpdate = false;
  for (const [gb, mat] of [[tube, M.metal], [metal, M.dark]]) if (gb.count) { const m = new THREE.Mesh(gb.geometry(), mat); m.matrixAutoUpdate = false; grp.add(m); }
  ctx.grp.add(grp);
}

// ---------- apron araçları (örneklenmiş kutular: otobüs, yakıt tankeri, çekici) ----------
export function vehicles(ctx, S) {
  const gb = new GB([['color', 3]]);
  const add = (x, y, ang, L, W, H, col) => { const s = gb.count; gb.box(x, y, 0.12, L, W, H, ang); const v = gb.a.color.v; for (let k = s; k < gb.count; k++) { v[k * 3] = col[0]; v[k * 3 + 1] = col[1]; v[k * 3 + 2] = col[2]; } };
  let n = 0;
  for (const s of S) {
    if (!s.ac || n > 160) continue;
    const r = (Math.sin(s.x * 12.9898 + s.y * 78.233) * 43758.5453) % 1;
    const hx = s.ac.hx, hy = s.ac.hy, lx = -hy, ly = hx;
    if (Math.abs(r) < 0.5) { const x = s.ac.x + lx * 9 + hx * 4, y = s.ac.y + ly * 9 + hy * 4; add(x, y, Math.atan2(hy, hx), 8.5, 2.5, 2.9, [0.85, 0.85, 0.2]); n++; }
    if (Math.abs(r) > 0.3) { const x = s.ac.x - lx * 8 - hx * 6, y = s.ac.y - ly * 8 - hy * 6; add(x, y, Math.atan2(hy, hx) + 0.4, 12, 2.6, 3.2, [0.92, 0.92, 0.9]); n++; }
    const x = s.x + hx * 3, y = s.y + hy * 3; add(x, y, Math.atan2(hy, hx), 4.2, 2.2, 1.5, [0.95, 0.75, 0.1]); n++;
  }
  if (!gb.count) return;
  const m = new THREE.Mesh(gb.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.name = 'apron-araclari'; m.matrixAutoUpdate = false; ctx.grp.add(m);
}

// standart ayrıntılı kurulum: terminaller (OSM tabanları), hangarlar, uçaklar, köprüler, araçlar
export function standard(ctx, opt = {}) {
  const { d } = ctx;
  const S = stands(d);
  ctx.stands = S;
  const terms = [];
  const seen = new Set();
  let k = 0;
  for (const b of d.bina) {
    if (b.t !== 'terminal') continue;
    const key = b.p[0][0] + ':' + b.p[0][1]; if (seen.has(key)) continue; seen.add(key);
    const area = Math.abs(b.p.reduce((s, p, i) => { const q = b.p[(i + 1) % b.p.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    if (area < 400) continue;
    const st = (opt.terminal && opt.terminal(b, area)) || {};
    terminal(ctx, (b.id || 'T' + (++k)).toString(), b.n || 'Terminal', b.p, { h: st.h || (b.lv ? b.lv * 4.5 + 3 : area > 30000 ? 24 : area > 8000 ? 18 : 12), roof: st.roof || (area > 20000 ? 'isiklik' : 'duz'), overhang: st.overhang, skyAxis: st.skyAxis, rise: st.rise });
    terms.push(b.p);
  }
  for (const t of opt.extraTerminals || []) { terminal(ctx, t.id, t.ad, t.p, t); terms.push(t.p); }
  standsAndAircraft(ctx, { occ: opt.occ != null ? opt.occ : 0.62 });
  jetBridges(ctx, terms, S);
  vehicles(ctx, S);
  return { S, terms };
}
// en yüksek OSM kulesinin konumu
export function towerPos(d, fallback) {
  let best = null;
  for (const b of d.bina) if (b.t === 'tower' && (!best || b.h > best.h)) best = b;
  if (!best) return fallback;
  const [x, y] = centroid(best.p);
  return { x, y, h: best.h };
}
