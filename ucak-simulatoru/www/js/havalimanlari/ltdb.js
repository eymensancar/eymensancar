// Çukurova Uluslararası Havalimanı (LTDB, COV; Tarsus, 2024): ana terminal (OSM tabanı: kara tarafında geniş salon,
// apron boyunca iki katlı iskele, 8 sabit köprü kolu ve hareketli yolcu köprüleri), pamuk kozası gibi kabaran beyaz
// membran çatı ve narenciye turuncusu çatı altı, kalkış katı viyadüğü ve kanopi, ağaç biçimli kule (~52 m, gövdeden
// yükselen palmiye yaprağı gibi kaburgalar), VIP, genel havacılık ve kargo terminalleri (her biri ayrı parça),
// park etmiş uçaklar, apron araçları ve projektör direkleri.
// Bu dosyanın alt yarısı güneydeki öbür havalimanlarının da kullandığı ortak yardımcılardır (ltaj.js, ltcc.js).
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, barrel, stands, standsAndAircraft } from '../havalimani.js';
import { terminal as glassBox, vehicles } from './ortak.js';

export function build(ctx) {
  const { d } = ctx;
  hideGenericHangars(ctx);
  // --- park yerleri, uçaklar
  const S = stands(d);
  ctx.stands = S;
  standsAndAircraft(ctx, { occ: 0.6 });
  // --- ana terminal: OSM tabanı; iskele ekseni güney uçtan kuzey uca (sabit köprü kollarının dibi)
  const T = d.bina.find((b) => b.t === 'terminal' && /Terminal Binas/.test(b.n || ''));
  const kits = [];
  if (T) {
    const ax = frameFrom([-196.3, 434.3], [-32.4, 748.0]);              // iskelenin apron yüzü boyunca
    const W = 31.2;                                                     // iskele eni (OSM)
    const loc = T.p.map(([x, y]) => ax.to(x, y));
    // salon: iskelenin arkasında kalan köşeler (sırayla)
    const main = ccw(T.p.filter((p, i) => loc[i][1] > W - 1.5));
    let a0 = 1e9, a1 = -1e9;
    loc.forEach(([a, c]) => { if (c > -1 && c < W + 1) { a0 = Math.min(a0, a); a1 = Math.max(a1, a); } });
    const pier = ccw([ax.from(a0, 0), ax.from(a1, 0), ax.from(a1, W), ax.from(a0, W)]);
    const k = new Kit();
    const land = ax.dir(0, 1);
    // salon: 3 kat (giriş, kalkış, servis), çatı altı 21 m; kara tarafında 22 m saçak + kalkış viyadüğü
    hall(k, main, {
      h: 21, fl: 5.2, ov: 5, ovLand: 22, land, t: 1.4,
      shape: (ta, tb) => 4.5 * (1 - (2 * tb - 1) ** 2) + 1.6 * (0.5 - 0.5 * Math.cos(ta * Math.PI * 2 * 3)),
      roofTop: 0xf1f2f0, soffit: 0xe8873a, fascia: 0xf6f6f2, fin: 0xdfe2e4, band: 0xc9ccd0,
      columns: 'agac', colCol: 0xf2f2ee, viaduct: { z: 6.8, w: 15, ramp: 80 },
      nA: 36, nB: 12,
    });
    // iskele: 2 kat, hafif kavisli çatı; apron yüzü tam cam
    hall(k, pier, { h: 12.5, fl: 4.6, ov: 3.5, t: 1.0, shape: (ta, tb) => 1.6 * (1 - (2 * tb - 1) ** 2), roofTop: 0xeeefed, soffit: 0xe8873a, fascia: 0xf6f6f2, fin: 0xdfe2e4, band: 0xc9ccd0, nA: 30, nB: 4 });
    roofUnits(k, pier, 13.6, 7);
    const grp = finishTerminal(ctx, k, 'cov-ana', T.n, main, 21 + 6, 5.2);
    pushSolid(ctx, pier, 13.5, T.n + ' iskelesi');
    kits.push(k);
    void grp;
  }
  // --- yolcu köprüleri (sabit kollar + hareketli köprüler) ve projektör direkleri
  const bk = new Kit();
  bridges(ctx, bk, S, { z: 4.6 });
  if (T) floodMasts(bk, edgeMasts(d, frameFrom([-196.3, 434.3], [-32.4, 748.0]), -1, 120, 10), 26);
  addKit(ctx.grp, bk, ctx.M, 'kopruler');
  // --- küçük terminaller (ayrı parçalar)
  for (const b of d.bina) {
    if (b.t !== 'terminal' || b === T) continue;
    if (/Kargo/i.test(b.n || '')) cargo(ctx, 'cov-kargo', b.n, b.p, { h: 13 });
    else if (/VIP/.test(b.n || '')) glassBox(ctx, 'cov-vip', b.n, ccw(b.p), { h: 9, overhang: 3, roof: 'duz' });
    else glassBox(ctx, 'cov-ga', b.n || 'Terminal', ccw(b.p), { h: 10, overhang: 3, roof: 'isiklik', skyStep: 18 });
  }
  // --- kule: ağaç biçimli (OSM: "COV Hava Trafik Kontrol Kulesi", 52 m)
  const tw = d.bina.find((b) => b.t === 'tower' && b.p.length > 2) || d.bina.find((b) => b.t === 'tower');
  if (tw) { const [x, y] = centroid(tw.p); towerTree(ctx, x, y, Math.max(52, tw.h)); }
  // --- hangarlar (OSM'de varsa)
  const hk = new Kit();
  hangarsFromData(ctx, hk);
  addKit(ctx.grp, hk, ctx.M, 'hangarlar');
  vehicles(ctx, S);
}

// =====================================================================================================
// ortak güney yardımcıları
// =====================================================================================================
const _c = new THREE.Color();
export function rgb(hex) { _c.setHex(hex); return [_c.r, _c.g, _c.b]; }
let VCM = null;
export function vcMat() { return VCM || (VCM = new THREE.MeshLambertMaterial({ vertexColors: true })); }

// katı (köşe renkli) ve cam (uv'li) geometri birlikte: bir terminal = 2 çizim çağrısı
export class Kit {
  constructor() { this.s = new GB([['color', 3]]); this.g = new GB(); this.g.uv = []; this.g._per = 0; this.fl = 4.5; }
  c(hex, fn) {
    const s0 = this.s.count; fn(this.s);
    const v = this.s.a.color.v, [r, g, b] = rgb(hex);
    for (let k = s0; k < this.s.count; k++) { v[k * 3] = r; v[k * 3 + 1] = g; v[k * 3 + 2] = b; }
  }
}
export function addKit(grp, k, M, name, fl) {
  const out = [];
  if (k.s.count) { const m = new THREE.Mesh(k.s.geometry(), vcMat()); m.name = name + '-govde'; m.matrixAutoUpdate = false; grp.add(m); out.push(m); }
  if (k.g.count) {
    const f = fl || k.fl;
    for (let i = 0; i < k.g.uv.length; i += 2) { k.g.uv[i] /= 3.0; k.g.uv[i + 1] /= f; }
    const m = new THREE.Mesh(k.g.geometry(), M.glass); m.name = name + '-cam'; m.matrixAutoUpdate = false; grp.add(m); out.push(m);
  }
  return out;
}
export function ccw(P) {
  let a = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; a += P[i][0] * q[1] - q[0] * P[i][1]; }
  return a < 0 ? P.slice().reverse() : P;
}
export function area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; a += P[i][0] * q[1] - q[0] * P[i][1]; } return Math.abs(a) / 2; }
// eksen çerçevesi: p0'dan p1'e a ekseni, c = sola dik
export function frameFrom(p0, p1) {
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ux = (p1[0] - p0[0]) / L, uy = (p1[1] - p0[1]) / L, vx = -uy, vy = ux;
  return {
    ux, uy, vx, vy,
    to: (x, y) => [(x - p0[0]) * ux + (y - p0[1]) * uy, (x - p0[0]) * vx + (y - p0[1]) * vy],
    from: (a, c) => [p0[0] + ux * a + vx * c, p0[1] + uy * a + vy * c],
    dir: (a, c) => [ux * a + vx * c, uy * a + vy * c],
  };
}
// iki nokta arasında çokgen kesitli çubuk (yerel: [x doğu, y kuzey, z yukarı])
export function strut(gb, a, b, r, n = 6, r2 = r) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1;
  d[0] /= L; d[1] /= L; d[2] /= L;
  const ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let e1 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
  const l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map((v) => v / l1);
  const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
  const s0 = gb.count;
  for (let k = 0; k <= n; k++) {
    const t = k / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const nx = e1[0] * c + e2[0] * s, ny = e1[1] * c + e2[1] * s, nz = e1[2] * c + e2[2] * s;
    gb.vert(a[0] + nx * r, a[2] + nz * r, a[1] + ny * r, nx, nz, ny);
    gb.vert(b[0] + nx * r2, b[2] + nz * r2, b[1] + ny * r2, nx, nz, ny);
  }
  for (let k = 0; k < n; k++) { const i = s0 + k * 2; gb.quad(i, i + 2, i + 3, i + 1); }
}
// eğimli kiriş / döşeme: a, b üst orta noktaları [x, y, z], en w, kalınlık th (yatay dik yönde)
export function beam(gb, a, b, w, th) {
  const dx = b[0] - a[0], dy = b[1] - a[1], Lh = Math.hypot(dx, dy) || 1, px = -dy / Lh * w / 2, py = dx / Lh * w / 2;
  const C = (p, sx, dz) => [p[0] + px * sx, p[1] + py * sx, p[2] + dz];
  const A = [C(a, -1, -th), C(a, 1, -th), C(a, 1, 0), C(a, -1, 0)], B = [C(b, -1, -th), C(b, 1, -th), C(b, 1, 0), C(b, -1, 0)];
  const face = (p, q, r, s) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = s[0] - p[0], vy = s[1] - p[1], vz = s[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const i = gb.count; for (const P of [p, q, r, s]) gb.vert(P[0], P[2], P[1], nx, nz, ny); gb.quad(i, i + 1, i + 2, i + 3);
  };
  face(A[3], A[2], B[2], B[3]);         // üst
  face(A[0], B[0], B[1], A[1]);         // alt
  face(A[1], B[1], B[2], A[2]);         // sağ
  face(A[0], A[3], B[3], B[0]);         // sol
  face(A[0], A[1], A[2], A[3]);         // a ucu
  face(B[1], B[0], B[3], B[2]);         // b ucu
}
// cam şerit: çokgen kenarı boyunca h0'dan değişken üst yüksekliğe (uv'li)
function skirt(g, ax, ay, bx, by, h0, top0, top1) {
  const L = Math.hypot(bx - ax, by - ay); if (L < 0.05) return;
  const nx = (by - ay) / L, ny = -(bx - ax) / L, s = g.count, u0 = g._per || 0;
  g.vert(ax, h0, ay, nx, 0, ny); g.vert(bx, h0, by, nx, 0, ny); g.vert(bx, top1, by, nx, 0, ny); g.vert(ax, top0, ay, nx, 0, ny);
  g.quad(s, s + 1, s + 2, s + 3); g.uv.push(u0, h0, u0 + L, h0, u0 + L, top1, u0, top0); g._per = u0 + L;
}
// OBB çerçevesi (a uzun eksen)
export function obbFrame(P) {
  const o = obbOf(P); const ux = o.c, uy = o.s, vx = -uy, vy = ux;
  return { o, ux, uy, vx, vy, A: o.L / 2, B: o.Wd / 2, at: (a, b) => [o.cx + ux * a + vx * b, o.cy + uy * a + vy * b], loc: (x, y) => [(x - o.cx) * ux + (y - o.cy) * uy, (x - o.cx) * vx + (y - o.cy) * vy] };
}

// ---------- terminal salonu: cam cephe, kat bantları, dikey kanatlar, eğrisel çatı (üst, çatı altı, alın), saçak kolonları ----------
// opt: h (saçak altı), fl, ov (saçak), ovLand (kara tarafı saçağı), land [x, y] (kara yönü), t (çatı kalınlığı),
// shape(ta, tb, tl) >= 0 (çatı kabarması, m; tl: hava tarafından 0, kara tarafına 1), renkler, columns: 'duz' | 'agac' | 'v', viaduct: { z, w, ramp }, nA, nB
export function hall(k, P, opt) {
  const h = opt.h, fl = opt.fl || 4.5, base = -0.6;
  k.fl = fl;
  const F = obbFrame(P);
  // saçaklar: kara tarafı hangi kenar?
  const ov = { a0: opt.ov, a1: opt.ov, b0: opt.ov, b1: opt.ov };
  let side = null;
  if (opt.land) {
    const L = opt.land, cand = [['a1', F.ux, F.uy], ['a0', -F.ux, -F.uy], ['b1', F.vx, F.vy], ['b0', -F.vx, -F.vy]];
    side = cand.reduce((m, c) => (c[1] * L[0] + c[2] * L[1] > m[1] * L[0] + m[2] * L[1] ? c : m))[0];
    ov[side] = opt.ovLand || opt.ov;
  }
  const A0 = -F.A - ov.a0, A1 = F.A + ov.a1, B0 = -F.B - ov.b0, B1 = F.B + ov.b1;
  const tl = (ta, tb) => (side === 'b1' ? tb : side === 'b0' ? 1 - tb : side === 'a1' ? ta : side === 'a0' ? 1 - ta : tb);
  const sh = (a, b) => { if (!opt.shape) return 0; const ta = (a - A0) / (A1 - A0), tb = (b - B0) / (B1 - B0); return opt.shape(ta, tb, tl(ta, tb)); };
  // 1) cam cephe ve çatıya kadar cam şerit
  k.g.prism(P, base, h, false);
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 6));
    for (let j = 0; j < n; j++) {
      const t0 = j / n, t1 = (j + 1) / n;
      const x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, x1 = ax + (bx - ax) * t1, y1 = ay + (by - ay) * t1;
      const [p0, q0] = F.loc(x0, y0), [p1, q1] = F.loc(x1, y1);
      const z0 = h + sh(p0, q0), z1 = h + sh(p1, q1);
      if (z0 > h + 0.05 || z1 > h + 0.05) skirt(k.g, x0, y0, x1, y1, h, z0 + 0.05, z1 + 0.05);
    }
  }
  // 2) zemin şeridi, kat bantları, dikey kanatlar
  k.c(0xbdbab2, (g) => g.prism(inflate(P, 0.3), base, 0.5, false));
  k.c(opt.band || 0xc9ccd0, (g) => { for (let z = fl; z < h - 1.5; z += fl) g.prism(inflate(P, 0.25), z - 0.35, z + 0.35, false); });
  k.c(opt.fin || 0xdfe2e4, (g) => {
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, by - ay); if (L < 4) continue;
      const ux = (bx - ax) / L, uy = (by - ay) / L, nx = uy, ny = -ux, n = Math.max(1, Math.round(L / 9));
      for (let j = 0; j <= n; j++) { const x = ax + ux * L * j / n + nx * 0.45, y = ay + uy * L * j / n + ny * 0.45; g.box(x, y, base, 0.45, 0.9, h - base, Math.atan2(uy, ux)); }
    }
  });
  // 3) çatı kabuğu
  shellRoof(k, F, A0, A1, B0, B1, h, opt.t || 1.2, sh, opt.nA || 24, opt.nB || 8, opt.roofTop || 0xeeeeec, opt.soffit || 0xd8d8d4, opt.fascia || 0xf2f2f0);
  // 4) kara tarafı: saçak kolonları ve kalkış viyadüğü
  if (side && (opt.ovLand || 0) > 8) {
    const along = side[0] === 'a' ? 'b' : 'a';
    const lo = along === 'a' ? A0 : B0, hi = along === 'a' ? A1 : B1;
    const sg = side[1] === '1' ? 1 : -1, edge = side[0] === 'a' ? F.A : F.B, outer = edge + opt.ovLand;
    const pt = (s, o) => (along === 'a' ? F.at(s, sg * o) : F.at(sg * o, s));
    const shp = (s, o) => (along === 'a' ? sh(s, sg * o) : sh(sg * o, s));
    k.c(opt.colCol || 0xe8e8e4, (g) => {
      for (let s = lo + 10; s <= hi - 10 + 0.1; s += 18) {
        const [x, y] = pt(s, outer - 2.5), top = h + shp(s, outer - 2.5);
        if (opt.columns === 'agac') {
          strut(g, [x, y, base], [x, y, top - 5.5], 0.75, 8, 0.6);
          for (const [da, dc] of [[-3.2, -1.6], [3.2, -1.6], [-3.2, 1.6], [3.2, 1.6]]) {
            const [x2, y2] = pt(s + da, outer - 2.5 + dc);
            strut(g, [x, y, top - 5.6], [x2, y2, h + shp(s + da, outer - 2.5 + dc) + 0.1], 0.32, 6, 0.24);
          }
        } else if (opt.columns === 'v') {
          for (const da of [-3.5, 3.5]) { const [x2, y2] = pt(s + da, outer - 2.5); strut(g, [x, y, base], [x2, y2, h + shp(s + da, outer - 2.5) + 0.1], 0.38, 6, 0.3); }
        } else strut(g, [x, y, base], [x, y, top + 0.1], 0.55, 8);
      }
    });
    if (opt.viaduct) {
      const V = opt.viaduct, c0 = edge + 3.5, cm = c0 + V.w / 2;
      const s0 = lo + 2, s1 = hi - 2, R = V.ramp || 70;
      const P3 = (s, z) => { const [x, y] = pt(s, cm); return [x, y, z]; };
      k.c(0xc4c1ba, (g) => {
        beam(g, P3(s0, V.z), P3(s1, V.z), V.w, 1.3);
        beam(g, P3(s0 - R, 0.15), P3(s0, V.z), V.w * 0.6, 1.0);
        beam(g, P3(s1, V.z), P3(s1 + R, 0.15), V.w * 0.6, 1.0);
        for (let s = s0 + 6; s < s1; s += 22) { const [x, y] = pt(s, cm); g.box(x, y, base, 1.4, V.w * 0.45, V.z - 1.3 - base, along === 'a' ? Math.atan2(F.uy, F.ux) : Math.atan2(F.vy, F.vx)); }
      });
      k.c(0xe9e9e6, (g) => {
        for (const e of [-1, 1]) {
          const q = (s, z) => { const [x, y] = pt(s, cm + e * (V.w / 2 - 0.2)); return [x, y, z]; };
          beam(g, q(s0, V.z + 1.1), q(s1, V.z + 1.1), 0.3, 1.1);
        }
      });
      k.c(0x2c2f33, (g) => beam(g, P3(s0 + 1, V.z + 0.02), P3(s1 - 1, V.z + 0.02), V.w - 1.2, 0.05));   // asfalt
    }
  }
  return F;
}
// eğrisel çatı kabuğu: üst yüzey, çatı altı (soffit) ve alın bandı; a/b ızgarası OBB çerçevesinde
export function shellRoof(k, F, A0, A1, B0, B1, H, t, sh, nA, nB, cTop, cSof, cFas) {
  const grid = (dz, up) => {
    const g = k.s, s0 = g.count;
    for (let i = 0; i <= nA; i++) for (let j = 0; j <= nB; j++) {
      const a = A0 + (A1 - A0) * i / nA, b = B0 + (B1 - B0) * j / nB, e = 0.6;
      const z = H + sh(a, b) + dz;
      const za = (sh(a + e, b) - sh(a - e, b)) / (2 * e), zb = (sh(a, b + e) - sh(a, b - e)) / (2 * e);
      let nx = -(za * F.ux + zb * F.vx), ny = -(za * F.uy + zb * F.vy), nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      if (!up) { nx = -nx * 0.3; ny = -ny * 0.3; nz = -1; }
      const [x, y] = F.at(a, b); g.vert(x, z, y, nx, nz, ny);
    }
    for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
      const q = s0 + i * (nB + 1) + j;
      if (up) g.quad(q, q + nB + 1, q + nB + 2, q + 1); else g.quad(q, q + 1, q + nB + 2, q + nB + 1);
    }
  };
  k.c(cTop, () => grid(t, true));
  k.c(cSof, () => grid(0, false));
  // alın: (a, b) dikdörtgeninin çevresi saat yönü tersine
  const loop = [];
  for (let i = 0; i < nA; i++) loop.push([A0 + (A1 - A0) * i / nA, B0]);
  for (let j = 0; j < nB; j++) loop.push([A1, B0 + (B1 - B0) * j / nB]);
  for (let i = nA; i > 0; i--) loop.push([A0 + (A1 - A0) * i / nA, B1]);
  for (let j = nB; j > 0; j--) loop.push([A0, B0 + (B1 - B0) * j / nB]);
  k.c(cFas, (g) => {
    for (let i = 0; i < loop.length; i++) {
      const [a0, b0] = loop[i], [a1, b1] = loop[(i + 1) % loop.length];
      const [x0, y0] = F.at(a0, b0), [x1, y1] = F.at(a1, b1), L = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = (y1 - y0) / L, ny = -(x1 - x0) / L, s = g.count;
      const z0 = H + sh(a0, b0), z1 = H + sh(a1, b1);
      g.vert(x0, z0 - 0.2, y0, nx, 0, ny); g.vert(x1, z1 - 0.2, y1, nx, 0, ny); g.vert(x1, z1 + t, y1, nx, 0, ny); g.vert(x0, z0 + t, y0, nx, 0, ny);
      g.quad(s, s + 1, s + 2, s + 3);
    }
  });
}
// düz çatı üstü klima/makine kutuları
export function roofUnits(k, P, z, n, col = 0xa9adb1) {
  const F = obbFrame(P);
  k.c(col, (g) => {
    for (let i = 0; i < n; i++) {
      const a = (-0.8 + 1.6 * (i + 0.5) / n) * F.A, b = ((i % 3) - 1) * F.B * 0.35;
      const [x, y] = F.at(a, b); g.box(x, y, z, 6 + (i % 2) * 3, 3.5, 2.2, Math.atan2(F.uy, F.ux));
    }
  });
}
// terminal grubunu parça olarak kaydet (çarpışma: taban + yükseklik)
export function finishTerminal(ctx, k, id, ad, P, h, fl) {
  const grp = new THREE.Group();
  addKit(grp, k, ctx.M, 'terminal', fl);
  grp.userData = { id, ad, taban: P, yukseklik: h, katYuksekligi: fl, kotu: -0.6 };
  grp.matrixAutoUpdate = false;
  return ctx.part('terminal:' + id, grp);
}
export function pushSolid(ctx, P, top, ad) { (ctx.solid || (ctx.solid = [])).push({ P, top, ad }); }

// ---------- kargo terminali: metal panel duvarlar, yükleme kapıları, cam ofis ucu ----------
export function cargo(ctx, id, ad, P0, opt = {}) {
  const P = ccw(P0), h = opt.h || 12, k = new Kit(), F = obbFrame(P);
  k.c(opt.wall || 0xd9dcdf, (g) => g.prism(P, -0.6, h, false));
  k.c(0x9ea4aa, (g) => g.prism(inflate(P, 0.6), h, h + 1.0, true));
  k.c(0xbfc3c7, (g) => g.prism(inflate(P, 0.35), h - 1.4, h, false));
  // yükleme kapıları: uzun kenarlarda 6 m arayla, koyu
  k.c(0x3f454c, (g) => {
    for (const sb of [-1, 1]) for (let a = -F.A + 6; a < F.A - 4; a += 7) {
      const [x, y] = F.at(a, sb * (F.B + 0.15)); g.box(x, y, 0.2, 4.2, 0.3, 4.6, Math.atan2(F.uy, F.ux));
    }
  });
  k.c(0x8f9396, (g) => { for (const sb of [-1, 1]) { const [x, y] = F.at(0, sb * (F.B + 2.2)); g.box(x, y, 5.3, F.A * 2 - 4, 4.2, 0.4, Math.atan2(F.uy, F.ux)); } });
  // ofis ucu (cam)
  const [ox, oy] = F.at(F.A + 4, 0);
  k.g.box(ox, oy, -0.6, 8, F.B * 1.6, 9.6, Math.atan2(F.uy, F.ux));
  k.c(0xbfc3c7, (g) => g.box(ox, oy, 9, 8.6, F.B * 1.6 + 0.6, 0.8, Math.atan2(F.uy, F.ux)));
  roofUnits(k, P, h + 1, 4);
  return finishTerminal(ctx, k, id, ad || 'Kargo Terminali', P, h + 1, 4.5);
}

// ---------- yolcu köprüleri: sabit kollar (OSM çizgi ya da çokgen) + hareketli köprüler (döner gövde, teleskopik tünel,
// tekerlekli ayak, kabin); uçak varsa kabin ön sol kapıya dayanır, yoksa köprü toplanmış durur ----------
export function bridges(ctx, k, S, opt = {}) {
  const { d } = ctx;
  const zf = opt.z || 4.6;
  const K = d.kopru.map((p) => p.map((q) => [q[0], q[1]]));
  const ends = [];
  for (const p of K) { ends.push(p[0]); ends.push(p[p.length - 1]); }
  const fixed = [], moving = [];
  for (const p of K) {
    const closed = p.length >= 4 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 9;
    if (closed) { fixed.push({ poly: p }); continue; }
    const st = p[0];
    const isMov = K.some((q) => q !== p && q.some((v) => Math.hypot(v[0] - st[0], v[1] - st[1]) < 1.2));
    (isMov ? moving : fixed).push({ line: p });
  }
  // sabit kollar: cam koridor (zf..zf+3.8), ayaklar, uçta merdiven kulesi
  const corridor = (a, b, w) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    k.g.box(mx, my, zf, L, w, 3.6, ang);
    k.c(0xd4d7da, (g) => { g.box(mx, my, zf - 0.6, L + 0.3, w + 0.4, 0.6, ang); g.box(mx, my, zf + 3.6, L + 0.3, w + 0.5, 0.5, ang); });
    k.c(0xa7acb1, (g) => { for (let s = 8; s < L - 3; s += 12) { const x = a[0] + (b[0] - a[0]) * s / L, y = a[1] + (b[1] - a[1]) * s / L; g.box(x, y, -0.3, 0.8, 0.8, zf - 0.3, ang); } });
    k.c(0xcfd2d5, (g) => { const x = b[0] - Math.cos(ang) * 3, y = b[1] - Math.sin(ang) * 3; g.box(x + Math.sin(ang) * (w / 2 + 1.6), y - Math.cos(ang) * (w / 2 + 1.6), -0.3, 4, 3, zf + 3.4, ang); });
  };
  for (const f of fixed) {
    if (f.line) { const p = f.line; corridor(p[0], p[p.length - 1], 4.4); }
    else {
      // çokgen kol: dış ucu (hareketli köprünün başladığı uç) b olsun
      const F = obbFrame(ccw(f.poly)); let p0 = F.at(-F.A + 0.3, 0), p1 = F.at(F.A - 0.3, 0);
      const dm = (p) => Math.min(1e9, ...moving.map((m) => Math.hypot(m.line[0][0] - p[0], m.line[0][1] - p[1])));
      if (dm(p0) < dm(p1)) [p0, p1] = [p1, p0];
      corridor(p0, p1, Math.max(3.6, Math.min(5.5, F.B * 2)));
    }
  }
  // hareketli köprüler
  const acs = S.filter((s) => s.ac);
  for (const m of moving) {
    const p = m.line, st = p[0], en = p[p.length - 1];
    let best = null, bd = 30;
    for (const s of acs) { const dd = Math.hypot(s.x - en[0], s.y - en[1]); if (dd < bd) { bd = dd; best = s; } }
    let E, zE;
    if (best) {
      const a = best.ac, sc = a.sc, lx = -a.hy, ly = a.hx;
      const nx = best.x - a.hx * 2, ny = best.y - a.hy * 2;   // burun
      // kapı: burundan 6 m geride; köprü hangi yandan geliyorsa o yan (sol kapı esas)
      const side = ((st[0] - nx) * lx + (st[1] - ny) * ly) >= 0 ? 1 : -1;
      E = [nx - a.hx * 6.2 * sc + lx * side * (2.2 * sc + 1.9), ny - a.hy * 6.2 * sc + ly * side * (2.2 * sc + 1.9)];
      zE = 2.2 * sc;
    } else {
      const L = Math.hypot(en[0] - st[0], en[1] - st[1]); const r = Math.min(1, 20 / L);
      E = [st[0] + (en[0] - st[0]) * r, st[1] + (en[1] - st[1]) * r]; zE = zf - 0.6;
    }
    jetBridge(k, st, E, zf, zE);
  }
  return { fixed: fixed.length, moving: moving.length };
}
export function jetBridge(k, S0, E, zS, zE) {
  const L = Math.hypot(E[0] - S0[0], E[1] - S0[1]); if (L < 6) return;
  const ux = (E[0] - S0[0]) / L, uy = (E[1] - S0[1]) / L, ang = Math.atan2(uy, ux);
  const P = (s, z) => [S0[0] + ux * s, S0[1] + uy * s, z];
  const zAt = (s) => zS + (zE - zS) * s / L;
  // döner gövde (rotunda) ve sütunu
  k.c(0x8d9297, (g) => strut(g, [S0[0], S0[1], -0.3], [S0[0], S0[1], zS - 0.4], 0.9, 8));
  k.c(0xd2d5d8, (g) => g.lathe(S0[0], S0[1], [[2.7, 0], [2.7, 3.3], [2.2, 3.7]], 10, zS - 0.5));
  // teleskopik tünel: 3 kısım, içe geçmeli
  const t0 = 2.4, t1 = L - 3.0, n = 3, seg = (t1 - t0) / n;
  const cols = [0xd9dcdf, 0xcfd3d6, 0xc6cacd];
  for (let i = 0; i < n; i++) {
    const a = t0 + seg * i - (i ? 0.6 : 0), b = t0 + seg * (i + 1) + 0.3, w = 3.3 - i * 0.18, hh = 2.95 - i * 0.12;
    k.c(cols[i], (g) => beam(g, P(a, zAt(a) + hh), P(b, zAt(b) + hh), w, hh));
    k.c(0x4f5a63, (g) => { for (const e of [-1, 1]) { const off = e * (w / 2 + 0.02); const q = (s) => [S0[0] + ux * s - uy * off, S0[1] + uy * s + ux * off, zAt(s) + hh * 0.72]; beam(g, q(a + 0.4), q(b - 0.4), 0.04, 0.55); } });
  }
  // tekerlekli ayak (L'nin %72'si)
  const sw = t0 + (t1 - t0) * 0.78, [wx, wy] = P(sw, 0), zt = zAt(sw);
  k.c(0x6e757b, (g) => {
    for (const e of [-1, 1]) { const ox = -uy * e * 1.1, oy = ux * e * 1.1; strut(g, [wx + ox, wy + oy, 0.9], [wx + ox, wy + oy, zt], 0.22, 6); }
    g.box(wx, wy, 0.5, 1.6, 3.4, 0.7, ang);
  });
  k.c(0x1d2024, (g) => { for (const e of [-1, 1]) { const ox = -uy * e * 1.5, oy = ux * e * 1.5; strut(g, [wx + ox - ux * 0.45, wy + oy - uy * 0.45, 0.5], [wx + ox + ux * 0.45, wy + oy + uy * 0.45, 0.5], 0.5, 8); } });
  // kabin ve körük
  const [cx, cy] = P(L - 1.6, 0);
  k.c(0xcfd2d5, (g) => g.box(cx, cy, zE - 0.4, 3.2, 4.0, 3.4, ang));
  k.c(0x2a2d31, (g) => g.box(E[0] - ux * 0.1, E[1] - uy * 0.1, zE - 0.2, 0.9, 3.4, 3.0, ang));
}
// apron projektör direkleri: en büyük apronun uzak kenarı boyunca (çerçevenin c ekseninde sg yönünde), step arayla
export function edgeMasts(d, fr, sg, step, inset, near) {
  let best = null, ba = near ? -1e18 : 0;
  for (const ap of d.apron) {
    const a = near ? -Math.hypot(centroid(ap[0])[0] - near[0], centroid(ap[0])[1] - near[1]) : area(ap[0]);
    if (a > ba) { ba = a; best = ap[0]; }
  }
  if (!best) return [];
  const L = best.map(([x, y]) => fr.to(x, y));
  const cE = sg < 0 ? Math.min(...L.map((p) => p[1])) : Math.max(...L.map((p) => p[1]));
  const a0 = Math.min(...L.map((p) => p[0])) + 25, a1 = Math.max(...L.map((p) => p[0])) - 25, out = [];
  const n = Math.max(1, Math.round((a1 - a0) / step));
  for (let i = 0; i <= n; i++) out.push(fr.from(a0 + (a1 - a0) * i / n, cE - sg * inset));
  return out;
}
export function floodMasts(k, pts, H = 25) {
  k.c(0x9aa0a6, (g) => { for (const [x, y] of pts) strut(g, [x, y, -0.3], [x, y, H], 0.45, 8, 0.25); });
  k.c(0x40464c, (g) => { for (const [x, y] of pts) { g.box(x, y, H - 0.3, 4.2, 1.2, 1.8, 0.4); } });
  k.c(0xfff3d0, (g) => { for (const [x, y] of pts) { g.box(x + Math.cos(0.4 + 1.5708) * 0.65, y + Math.sin(0.4 + 1.5708) * 0.65, H, 3.8, 0.1, 1.2, 0.4); } });
}

// ---------- hangarlar ----------
// genel (havalimani.js) hangar örgülerini gizle: kendi ayrıntılı hangarlarımız yerine gelir
export function hideGenericHangars(ctx) {
  for (const m of ctx.grp.children.slice()) if (/^hangar-/.test(m.name)) { ctx.grp.remove(m); if (m.geometry) m.geometry.dispose(); }
}
// en yakın taksi yolu / apron noktası (hangar kapısı ve sığınak ağzı oraya bakar)
export function nearestPave(d, x, y) {
  let best = null, bd = 1e18;
  for (const t of d.twy) for (let i = 0; i < t.p.length - 1; i++) {
    const [ax, ay] = t.p[i], [bx, by] = t.p[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const tt = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)), px = ax + dx * tt, py = ay + dy * tt, dd = (px - x) ** 2 + (py - y) ** 2;
    if (dd < bd) { bd = dd; best = [px, py]; }
  }
  for (const ap of d.apron) for (const r of ap) for (const p of r) { const dd = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (dd < bd) { bd = dd; best = p; } }
  return best;
}
// OSM hangarlarını tek tek kur (tekrarlar atılır); opt.shelter(b, area) true ise uçak sığınağı
export function hangarsFromData(ctx, k, opt = {}) {
  const seen = new Set(); let n = 0;
  for (const b of ctx.d.bina) {
    if (b.t !== 'hangar' || b.p.length < 3) continue;
    const key = Math.round(b.p[0][0]) + ':' + Math.round(b.p[0][1]); if (seen.has(key)) continue; seen.add(key);
    const P = ccw(b.p), ar = area(P), [cx, cy] = centroid(P), np = nearestPave(ctx.d, cx, cy);
    const dir = np ? [np[0] - cx, np[1] - cy] : [1, 0];
    let top;
    if (opt.shelter && opt.shelter(b, ar)) top = shelter(k, P, dir, ar);
    else top = hangar(k, P, dir, opt.h ? opt.h(ar) : Math.max(9, Math.min(20, Math.sqrt(ar) * 0.34)), opt);
    for (const s of ctx.solid || []) if (s.P === b.p || (Math.round(s.P[0][0]) + ':' + Math.round(s.P[0][1])) === key) s.top = top;
    n++;
  }
  return n;
}
// bakım hangarı: oluklu saç duvarlar, kemerli çatı, büyük sürgülü kapı (kanatlar), yan ofis bloğu
export function hangar(k, P, dir, H, opt = {}) {
  const F = obbFrame(P);
  const cand = [[F.ux, F.uy, F.A, F.B, 1], [-F.ux, -F.uy, F.A, F.B, 1], [F.vx, F.vy, F.B, F.A, 0], [-F.vx, -F.vy, F.B, F.A, 0]];
  const door = cand.reduce((m, c) => (c[0] * dir[0] + c[1] * dir[1] > m[0] * dir[0] + m[1] * dir[1] ? c : m));
  const [nx, ny, depth, half] = door;
  const eave = H * 0.78;
  k.c(opt.wall || 0xc5ccd2, (g) => g.prism(P, -0.5, eave, false));
  k.c(0xa9b1b8, (g) => g.prism(inflate(P, 0.12), -0.5, 1.2, false));
  const o = { ...F.o };
  k.c(opt.roof || 0x8f99a2, (g) => barrel(g, o, eave, H, 10));
  k.c(0xb4bcc3, (g) => g.prism(inflate(P, 0.25), eave - 0.6, eave, true));
  // kapı: 6 kanat, aralarında koyu derz; üstünde kapı kirişi
  const W = half * 2 * 0.9, dh = eave * 0.86, nL = 6;
  const cx = F.o.cx + nx * (depth + 0.35), cy = F.o.cy + ny * (depth + 0.35);
  const tx = -ny, ty = nx;
  for (let i = 0; i < nL; i++) {
    const s = -W / 2 + W * (i + 0.5) / nL;
    k.c(i % 2 ? 0x6f7f8d : 0x758697, (g) => g.box(cx + tx * s, cy + ty * s, 0, W / nL - 0.25, 0.5, dh, Math.atan2(ty, tx)));
  }
  k.c(0x505a63, (g) => g.box(cx + nx * 0.1, cy + ny * 0.1, dh, W + 1.2, 0.8, 1.4, Math.atan2(ty, tx)));
  // yan ofis bloğu (kapıya dik yanlardan birinde)
  const sx = F.o.cx + tx * (half + 3.2), sy = F.o.cy + ty * (half + 3.2);
  k.c(0xe2e0da, (g) => g.box(sx, sy, -0.5, Math.min(depth * 1.5, 40), 6, 7.5, Math.atan2(ny, nx)));
  k.g.box(sx + tx * 0.05, sy + ty * 0.05, 1.2, Math.min(depth * 1.5, 40) - 2, 6.1, 1.4, Math.atan2(ny, nx));
  k.g.box(sx + tx * 0.05, sy + ty * 0.05, 4.6, Math.min(depth * 1.5, 40) - 2, 6.1, 1.4, Math.atan2(ny, nx));
  return H + 0.5;
}
// sertleştirilmiş uçak sığınağı (HAS): beton tonoz, ağızda kalın sürgülü kapılar, arkada egzoz bacası
export function shelter(k, P, dir, ar) {
  const F = obbFrame(P);
  let ux = F.ux, uy = F.uy; if (ux * dir[0] + uy * dir[1] < 0) { ux = -ux; uy = -uy; }
  const vx = -uy, vy = ux, L = F.A * 2, W = F.B * 2, Hs = Math.max(5, Math.min(10.5, W * 0.43)), cx = F.o.cx, cy = F.o.cy;
  const prof = [];
  const n = 12;
  for (let i = 0; i <= n; i++) { const t = -1 + 2 * i / n, z = Hs * Math.pow(Math.max(0, 1 - t * t), 0.62); prof.push([t * W / 2, z]); }
  const at = (a, b) => [cx + ux * a + vx * b, cy + uy * a + vy * b];
  k.c(0xb7b2a6, (g) => {
    const s0 = g.count;
    for (const a of [-L / 2, L / 2 - 1.2]) for (let i = 0; i <= n; i++) {
      const [b, z] = prof[i], j = Math.max(0, i - 1), jj = Math.min(n, i + 1);
      const db = prof[jj][0] - prof[j][0], dz = prof[jj][1] - prof[j][1], l = Math.hypot(db, dz) || 1;
      const nb = -dz / l, nz = db / l;            // profilin dış normali (b, z)
      const [x, y] = at(a, b); g.vert(x, z - 0.4, y, vx * nb, nz, vy * nb);
    }
    for (let i = 0; i < n; i++) { const a = s0 + i, b = s0 + n + 1 + i; g.quad(a, b, b + 1, a + 1); }
    // arka duvar (yelpaze)
    const back = g.count, [bx, by] = at(-L / 2, 0); g.vert(bx, -0.4, by, -ux, 0, -uy);
    for (let i = 0; i <= n; i++) { const [x, y] = at(-L / 2, prof[i][0]); g.vert(x, prof[i][1] - 0.4, y, -ux, 0, -uy); }
    for (let i = 0; i < n; i++) g.tri(back, back + 1 + i, back + 2 + i);
    // ön alın duvarı: kapı çerçevesi (kalın beton)
    const [fx, fy] = at(L / 2 - 0.6, 0); g.box(fx, fy, -0.4, 1.6, W + 1.6, Hs + 0.6, Math.atan2(uy, ux));
    // egzoz bacası
    const [ex, ey] = at(-L / 2 + 3, 0); g.box(ex, ey, Hs * 0.6, 3, 3.4, Hs * 0.55, Math.atan2(uy, ux));
  });
  // kapı kanatları (koyu, ağızdan biraz önde)
  k.c(0x6a6c66, (g) => { for (const e of [-1, 1]) { const [x, y] = at(L / 2 + 0.6, e * W * 0.24); g.box(x, y, -0.3, 1.2, W * 0.5 - 0.3, Hs * 0.8, Math.atan2(uy, ux)); } });
  // önündeki beton platform
  k.c(0xc2beb4, (g) => { const [x, y] = at(L / 2 + 9, 0); g.box(x, y, -0.25, 16, W + 4, 0.38, Math.atan2(uy, ux)); });
  void ar;
  return Hs + 0.6;
}

// ---------- kuleler ----------
function towerCol(ctx, x, y, r, top) {
  const W = ctx.W, k = Math.round(ctx.d.x + x) + ':' + Math.round(ctx.d.y + y);
  W._apCol = W._apCol || new Set();
  if (W._apCol.has(k)) return; W._apCol.add(k); W.lmCol.push({ x: ctx.d.x + x, y: ctx.d.y + y, r, top: ctx.d.elev + top });
}
export function towerGroup(ctx, k, cab, name) {
  const grp = new THREE.Group();
  addKit(grp, k, ctx.M, 'kule');
  if (cab && cab.count) { const m = new THREE.Mesh(cab.geometry(), ctx.M.cab); m.name = 'kabin'; m.matrixAutoUpdate = false; grp.add(m); }
  grp.matrixAutoUpdate = false;
  return ctx.part(name || 'kule', grp);
}
// ağaç biçimli kule (Çukurova): tabanda geniş kök, ince gövde; gövdeden yükselip kabini saran 12 kaburga (palmiye yaprakları gibi)
export function towerTree(ctx, x, y, H = 52) {
  const k = new Kit(), cab = new GB();
  const z0 = ctx.gh(x, y) - 0.5;
  const zc = z0 + H - 9;             // kabin tabanı
  // teknik blok (tabanda, iki katlı)
  k.c(0xe9e7e1, (g) => { g.box(x + 16, y - 4, z0, 24, 14, 8.5, 0.3); });
  k.g.box(x + 16, y - 4, z0 + 1.5, 24.2, 14.2, 2.2, 0.3); k.g.box(x + 16, y - 4, z0 + 5.2, 24.2, 14.2, 2.2, 0.3);
  k.c(0xf2f1ec, (g) => {
    g.lathe(x, y, [[7.5, 0], [5.2, 4], [4.0, 10], [3.4, 22], [3.2, H - 20], [3.6, H - 14]], 14, z0);
  });
  // kaburgalar: gövdeden dışa ve yukarı kıvrılarak kabin saçağına
  k.c(0xf6f5f0, (g) => {
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2 + 0.13, c = Math.cos(a), s = Math.sin(a);
      const pts = [[3.4, H - 22], [5.0, H - 16], [7.4, H - 12], [9.6, H - 9.5], [10.8, H - 2], [10.2, H + 1.2]];
      for (let j = 0; j < pts.length - 1; j++) {
        const [r0, h0] = pts[j], [r1, h1] = pts[j + 1], tw = 0.04 * j;
        strut(g, [x + Math.cos(a + tw) * r0, y + Math.sin(a + tw) * r0, z0 + h0], [x + Math.cos(a + tw + 0.04) * r1, y + Math.sin(a + tw + 0.04) * r1, z0 + h1], 0.42 - j * 0.03, 5, 0.39 - j * 0.03);
      }
      void c; void s;
    }
  });
  // kabin altı teknik kat, kabin (cam), çatı
  k.c(0x7c8186, (g) => g.lathe(x, y, [[4.0, 0], [8.6, 3.4], [9.0, 3.6]], 16, zc - 3.6));
  cab.lathe(x, y, [[8.6, 0], [9.6, 5.6]], 16, zc);
  k.c(0xeceae4, (g) => g.lathe(x, y, [[10.1, 5.6], [10.1, 6.4], [7, 7.8], [2.5, 8.6], [0.05, 8.8]], 16, zc));
  k.c(0xb0b4b8, (g) => { strut(g, [x, y, zc + 8.6], [x, y, zc + 16], 0.25, 6, 0.12); g.box(x + 3.5, y, zc + 8.2, 2.2, 2.2, 2.2, 0); });
  towerCol(ctx, x, y, 11, z0 + H + 1);
  return towerGroup(ctx, k, cab);
}
// taş kaplı klasik kule (kare gövde, köşe pahlı; sekizgen kabin)
export function towerStone(ctx, x, y, H = 40, opt = {}) {
  const k = new Kit(), cab = new GB();
  const z0 = ctx.gh(x, y) - 0.5, zc = z0 + H - 7, rot = opt.rot || 0;
  const sq = (r, a0 = rot) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = a0 + Math.PI / 8 + i * Math.PI / 4; const rr = i % 2 ? r * 0.82 : r; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; });
  if (opt.base !== false) {
    k.c(opt.baseCol || 0xe6dfcf, (g) => g.box(x + Math.cos(rot) * 14, y + Math.sin(rot) * 14, z0, 22, 13, 7.5, rot));
    k.g.box(x + Math.cos(rot) * 14, y + Math.sin(rot) * 14, z0 + 3.5, 22.2, 13.2, 2, rot);
  }
  k.c(opt.stone || 0xd8c9a6, (g) => g.prism(ccw(sq(4.6)), z0, zc - 3));
  k.c(opt.trim || 0xbfae88, (g) => { for (let z = z0 + 8; z < zc - 4; z += 8) g.prism(ccw(sq(4.85)), z, z + 0.5, false); });
  // pencere yarığı (gövde boyunca dar koyu bant)
  k.c(0x3a4148, (g) => { const a = rot + Math.PI / 8; g.box(x + Math.cos(a) * 4.62, y + Math.sin(a) * 4.62, z0 + 4, 0.8, 0.2, zc - z0 - 9, a + Math.PI / 2); });
  k.c(opt.dark || 0x5c6166, (g) => g.lathe(x, y, [[4.4, 0], [7.4, 2.6], [7.6, 3.0]], 8, zc - 3));
  cab.lathe(x, y, [[7.0, 0], [8.0, 4.8]], 8, zc);
  k.c(0xe9e6de, (g) => g.lathe(x, y, [[8.4, 4.8], [8.4, 5.6], [3, 6.4], [0.05, 6.6]], 8, zc));
  k.c(0xb0b4b8, (g) => strut(g, [x, y, zc + 6.4], [x, y, zc + 13], 0.22, 6, 0.1));
  towerCol(ctx, x, y, 8.5, z0 + H + 1);
  return towerGroup(ctx, k, cab);
}
