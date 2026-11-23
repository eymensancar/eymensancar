// İzmir Adnan Menderes Havalimanı (LTBJ, ADB). OSM tabanlarından, gerçeğe yakın biçimde:
// - İç Hatlar Terminali (2014, güneyde): uzunlamasına dalgalanan beyaz çatı, kara tarafında geniş saçak ve sütunlar,
//   dalga tepelerinde çatı ışıklıkları. ctx.parts.get('terminal:ic-hatlar')
// - Dış Hatlar Terminali (2006, kuzeyde): enine kemerli gümüş çatı, sırtında ışıklık bandı. ctx.parts.get('terminal:dis-hatlar')
//   (OSM'de iki terminal tek çokgen; ara bağlantının hizasından ikiye kesilir.)
// - Gidiş katı viyadüğü (rampalarıyla), iki katlı otopark (açık katlar, cephe kanatları, arabalar),
//   kargo terminali (oluklu sac, yükleme kapıları, ULD konteynerleri), kule, hangarlar (kayar kapılar),
//   yolcu köprüleri (sabit cam koridor + döner gövde + teleskopik tünel; uçak varsa kapısına uzanır, yoksa geri çekik).
// Yakın ayrıntılar (arabalar, sütunlar, kanatlar, konteynerler) 4.5 km dışında gizlenir (ctx.tick).
import * as THREE from '../../vendor/three.module.min.js';
import { ShapeUtils } from '../../vendor/three.module.min.js';
import { GB, centroid, obbOf, barrel, stands, standsAndAircraft } from '../havalimani.js';
import { pip, nearestEdge, vehicles } from './ortak.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const TAU = Math.PI * 2;
function hash(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }
function area(P) { let s = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; }
const ccw = (P) => (area(P) < 0 ? P.slice().reverse() : P.slice());
// çokgeni yarı düzlemle kırp: nx*x + ny*y <= c kalır (Sutherland-Hodgman)
function clipHalf(P, nx, ny, c) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const da = a[0] * nx + a[1] * ny - c, db = b[0] * nx + b[1] * ny - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

// ---------- malzemeler (havalimanı yeniden kurulsa da bir kez) ----------
let MT = null;
function ribTex(base, dark, n = 8) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 64, 8);
  for (let k = 0; k < n; k++) { g.fillStyle = dark; g.fillRect(k * 64 / n, 0, 2, 8); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(k * 64 / n + 2, 0, 1, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function mats(W, M) {
  if (MT) return MT;
  const env = W.envMap();
  MT = {
    roofW: new THREE.MeshStandardMaterial({ color: 0xeef0f1, metalness: 0.3, roughness: 0.42, envMap: env, envMapIntensity: 0.9 }),
    roofS: new THREE.MeshStandardMaterial({ color: 0xaeb6bd, metalness: 0.65, roughness: 0.32, envMap: env, envMapIntensity: 1.0 }),
    soffit: new THREE.MeshLambertMaterial({ color: 0xdedcd6 }),
    panel: new THREE.MeshLambertMaterial({ color: 0xd9d9d4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.5, roughness: 0.4, envMap: env, envMapIntensity: 0.7 }),
    rib: new THREE.MeshLambertMaterial({ map: ribTex('#cfd4d8', '#9aa1a8') }),
    ribBlue: new THREE.MeshLambertMaterial({ map: ribTex('#6f8597', '#4c5f70', 10) }),
    asph: new THREE.MeshLambertMaterial({ color: 0x3a3c40 }),
    car: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    glass: M.glass, conc: M.conc, dark: M.dark, white: M.white, cab: M.cab,
  };
  return MT;
}

// ---------- geometri yardımcıları ----------
// dörtgen yüz (dışarıdan bakınca saat yönünün tersine), normal (doğu, yukarı, kuzey), uv isteğe bağlı
function q4(gb, A, B, C, D, n, uv, col) {
  const s = gb.count, at = col ? { color: col } : undefined;
  for (const p of [A, B, C, D]) gb.vert(p[0], p[2], p[1], n[0], n[1], n[2], at);
  gb.quad(s, s + 1, s + 2, s + 3);
  if (gb.uv) gb.uv.push(...(uv || [0, 0, 1, 0, 1, 1, 0, 1]));
}
// iki nokta arasında eğimli kutu: taban orta çizgisi p0 -> p1 ([x, y, h]), genişlik w, yükseklik hh
function slab(gb, p0, p1, w, hh, col, sides = true, uvS = 3) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy * w / 2, ny = ux * w / 2;
  const sl = (p1[2] - p0[2]) / L, tl = Math.hypot(sl, 1);
  const a0 = [p0[0] - nx, p0[1] - ny, p0[2]], a1 = [p1[0] - nx, p1[1] - ny, p1[2]], b0 = [p0[0] + nx, p0[1] + ny, p0[2]], b1 = [p1[0] + nx, p1[1] + ny, p1[2]];
  const up = (p) => [p[0], p[1], p[2] + hh];
  const U = L / uvS, V = hh / uvS;
  q4(gb, up(a0), up(a1), up(b1), up(b0), [-ux * sl / tl, 1 / tl, -uy * sl / tl], [0, 0, U, 0, U, 1, 0, 1], col);   // tavan
  q4(gb, a0, b0, b1, a1, [ux * sl / tl, -1 / tl, uy * sl / tl], [0, 0, 1, 0, 1, U, 0, U], col);                  // taban
  if (sides) {
    q4(gb, a0, a1, up(a1), up(a0), [uy, 0, -ux], [0, 0, U, 0, U, V, 0, V], col);       // sağ
    q4(gb, b1, b0, up(b0), up(b1), [-uy, 0, ux], [0, 0, U, 0, U, V, 0, V], col);       // sol
  }
  q4(gb, b0, a0, up(a0), up(b0), [-ux, 0, -uy], [0, 0, w / uvS, 0, w / uvS, V, 0, V], col);
  q4(gb, a1, b1, up(b1), up(a1), [ux, 0, uy], [0, 0, w / uvS, 0, w / uvS, V, 0, V], col);
}
// eksene hizalı kutu (renkli ya da değil)
function cbox(gb, x, y, h0, w, d, hh, ang, col) {
  const c = Math.cos(ang), s = Math.sin(ang);
  slab(gb, [x - c * w / 2, y - s * w / 2, h0], [x + c * w / 2, y + s * w / 2, h0], d, hh, col);
}
// dikey duvar şeridi: çokgen kenarları boyunca, üst yükseklik top(x, y) ile (çatıyı izler); kenarlar seg m'ye bölünür
function walls(gb, P, h0, top, seg = 8, fl = 4.5, filt = null) {
  let per = 0;
  for (let k = 0; k < P.length; k++) {
    const [ax, ay] = P[k], [bx, by] = P[(k + 1) % P.length];
    const L = Math.hypot(bx - ax, by - ay); if (L < 0.05) continue;
    const nx = (by - ay) / L, ny = -(bx - ax) / L;
    if (filt && !filt(nx, ny)) { per += L; continue; }
    const n = Math.max(1, Math.ceil(L / seg));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, x1 = ax + (bx - ax) * t1, y1 = ay + (by - ay) * t1;
      const z0 = typeof top === 'function' ? top(x0, y0) : top, z1 = typeof top === 'function' ? top(x1, y1) : top;
      const u0 = (per + L * t0) / 3, u1 = (per + L * t1) / 3;
      q4(gb, [x0, y0, h0], [x1, y1, h0], [x1, y1, z1], [x0, y0, z0], [nx, 0, ny], [u0, h0 / fl, u1, h0 / fl, u1, z1 / fl, u0, z0 / fl]);
    }
    per += L;
  }
}
// yatay çokgen (yukarı ya da aşağı bakan)
function flat(gb, P, h, down = false, col) {
  const V = P.map((p) => new THREE.Vector2(p[0], p[1]));
  let tris; try { tris = ShapeUtils.triangulateShape(V, []); } catch (e) { return; }
  const s = gb.count, at = col ? { color: col } : undefined;
  for (const p of P) gb.vert(p[0], h, p[1], 0, down ? -1 : 1, 0, at);
  if (gb.uv) for (const p of P) gb.uv.push(p[0] / 4, p[1] / 4);
  for (const t of tris) if (down) gb.tri(s + t[0], s + t[2], s + t[1]); else gb.tri(s + t[0], s + t[1], s + t[2]);
}
function column(gb, x, y, h0, h1, r0, r1 = r0, seg = 8) { gb.lathe(x, y, [[r0, 0], [r1, h1 - h0]], seg, h0); }

// ---------- büyük terminal çatısı ----------
// Çatı, terminal ekseni (a) boyunca step m'lik şeritlerden örülür; her şeridin enine (b) genişliği tabanın o şeritteki
// genişliği + saçaklardır (sınırlar komşu şeritlerle yumuşatılır). Yükseklik hf(a, t) (t: 0 hava tarafı .. 1 kara tarafı).
function roofShape(polys, ax, opt) {
  const ux = Math.cos(ax), uy = Math.sin(ax), vx = -uy, vy = ux;
  const [cx, cy] = centroid(polys[0]);
  const A = (x, y) => (x - cx) * ux + (y - cy) * uy, B = (x, y) => (x - cx) * vx + (y - cy) * vy;
  const XY = (a, b) => [cx + ux * a + vx * b, cy + uy * a + vy * b];
  let a0 = 1e9, a1 = -1e9;
  for (const P of polys) for (const [x, y] of P) { const a = A(x, y); a0 = Math.min(a0, a); a1 = Math.max(a1, a); }
  const step = opt.step || 6, oE = opt.ovEnd || 4;
  const N = Math.ceil((a1 - a0 + 2 * oE) / step), s0 = a0 - oE, st = (a1 - a0 + 2 * oE) / N;
  // şerit genişlikleri
  const ext = [];
  for (let i = 0; i < N; i++) {
    const lo = Math.max(a0 + 0.01, s0 + i * st), hi = Math.min(a1 - 0.01, s0 + (i + 1) * st);
    let bmin = 1e9, bmax = -1e9;
    for (const P of polys) {
      let Q = clipHalf(P, ux, uy, hi + cx * ux + cy * uy);
      Q = clipHalf(Q, -ux, -uy, -(lo + cx * ux + cy * uy));
      for (const [x, y] of Q) { const b = B(x, y); bmin = Math.min(bmin, b); bmax = Math.max(bmax, b); }
    }
    ext.push(bmin < bmax ? [bmin, bmax] : null);
  }
  for (let i = 0; i < N; i++) if (!ext[i]) { let j = 1; while (!ext[i - j] && !ext[i + j] && j < N) j++; ext[i] = (ext[i - j] || ext[i + j]).slice(); }
  // yumuşatma (pencere ±w şerit), sınırlar komşuların birleşimi
  const w = opt.smooth != null ? opt.smooth : 2;
  const sm = ext.map((_, i) => { let lo = 1e9, hi = -1e9; for (let j = Math.max(0, i - w); j <= Math.min(N - 1, i + w); j++) { lo = Math.min(lo, ext[j][0]); hi = Math.max(hi, ext[j][1]); } return [Math.min(lo + 0, ext[i][0]), hi]; });
  const bd = [];
  for (let j = 0; j <= N; j++) {
    const l = sm[Math.max(0, j - 1)], r = sm[Math.min(N - 1, j)];
    bd.push([Math.min(l[0], r[0]) - opt.ovAir, Math.max(l[1], r[1]) + opt.ovLand]);
  }
  const extAt = (a) => { const f = clamp((a - s0) / st, 0, N), j = Math.min(N - 1, Math.floor(f)), t = f - j; return [bd[j][0] + (bd[j + 1][0] - bd[j][0]) * t, bd[j][1] + (bd[j + 1][1] - bd[j][1]) * t]; };
  const tOf = (x, y) => { const a = A(x, y), e = extAt(a); return [a, clamp((B(x, y) - e[0]) / (e[1] - e[0]), 0, 1)]; };
  return { ux, uy, vx, vy, cx, cy, A, B, XY, N, s0, st, bd, extAt, tOf, a0, a1 };
}
// çatı kabuğu: üst (roof), alt yüzey (soffit), alın (fascia); NB enine bölüm
function roofMesh(R, hf, th, top, under, fasc, NB = 12) {
  const { N, s0, st, bd, XY } = R;
  const at = (j, k) => { const a = s0 + j * st, t = k / NB, b = bd[j][0] + (bd[j][1] - bd[j][0]) * t; const [x, y] = XY(a, b); return [x, y, hf(a, t), a, t]; };
  const G = [];
  for (let j = 0; j <= N; j++) { const r = []; for (let k = 0; k <= NB; k++) r.push(at(j, k)); G.push(r); }
  // normaller: sonlu farklar
  const nrm = (j, k) => {
    const p = G[j][k], pa = G[Math.min(N, j + 1)][k], pb = G[Math.max(0, j - 1)][k], qa = G[j][Math.min(NB, k + 1)], qb = G[j][Math.max(0, k - 1)];
    const e1 = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]], e2 = [qa[0] - qb[0], qa[1] - qb[1], qa[2] - qb[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[2] < 0) n = n.map((v) => -v);
    const l = Math.hypot(...n) || 1; return [n[0] / l, n[2] / l, n[1] / l];   // (doğu, yukarı, kuzey)
  };
  for (const [gb, dz, sgn] of [[top, th, 1], [under, 0, -1]]) {
    const s = gb.count;
    for (let j = 0; j <= N; j++) for (let k = 0; k <= NB; k++) { const p = G[j][k], n = nrm(j, k); gb.vert(p[0], p[2] + dz, p[1], n[0] * sgn, n[1] * sgn, n[2] * sgn); if (gb.uv) gb.uv.push(p[3] / 4, p[4] * 10); }
    for (let j = 0; j < N; j++) for (let k = 0; k < NB; k++) {
      const a = s + j * (NB + 1) + k, b = a + NB + 1;
      // a ekseni u, b ekseni v = u'nun solu: (u, v, yukarı) sağ elli, yukarıdan bakınca a->b->b+1 saat yönünün tersi
      if (sgn > 0) gb.quad(a, b, b + 1, a + 1); else gb.quad(a, a + 1, b + 1, b);
    }
  }
  // alın: çevre boyunca
  const ring = [];
  for (let j = 0; j <= N; j++) ring.push(G[j][0]);
  for (let k = 1; k <= NB; k++) ring.push(G[N][k]);
  for (let j = N - 1; j >= 0; j--) ring.push(G[j][NB]);
  for (let k = NB - 1; k >= 1; k--) ring.push(G[0][k]);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.01) continue;
    const nx = (q[1] - p[1]) / L, ny = -(q[0] - p[0]) / L;
    // çevre a+ yönünde ilerler ve v solda kalır => saat yönünün tersi; dışa normal sağda
    q4(fasc, [p[0], p[1], p[2] - 0.2], [q[0], q[1], q[2] - 0.2], [q[0], q[1], q[2] + th], [p[0], p[1], p[2] + th], [nx, 0, ny]);
  }
  return G;
}

// ---------- terminal ----------
function buildTerminal(ctx, mt, id, ad, polys, opt) {
  const { gh } = ctx;
  const grp = new THREE.Group();
  const all = polys.flat();
  const base = Math.min(0, ...all.map(([x, y]) => gh(x, y))) - 0.6;
  const R = roofShape(polys, opt.axis, opt);
  const hf = (a, t) => opt.hf(a, t, R);
  const top = new GB(), under = new GB(), fasc = new GB(), sky = new GB(); sky.uv = [];
  const G = roofMesh(R, hf, opt.th, top, under, fasc, opt.NB || 12);
  const roofUnder = (x, y) => { const [a, t] = R.tOf(x, y); return hf(a, t) - 0.05; };
  // cepheler: kara tarafı ve yanlar cam, hava tarafında alt kat opak (bagaj ve servis katı), kat döşemesi bandı
  const glass = new GB(); glass.uv = [];
  const solid = new GB(), slabB = new GB(), cols = new GB(), fins = new GB();
  const air = (nx, ny) => nx * R.vx + ny * R.vy < -0.35;          // hava tarafına bakan kenar
  const F1 = opt.floor1 || 5.2;
  for (const P0 of polys) {
    const P = ccw(P0);
    walls(glass, P, base, roofUnder, 8, 4.5, (nx, ny) => !air(nx, ny));
    walls(glass, P, F1 + 1.2, roofUnder, 8, 4.5, air);
    walls(solid, P, base, F1 + 1.2, 30, 4.5, air);
    // kat bandı (dışa 0.35 m taşan beton şerit) ve zemin şeridi
    const P2 = P.map(([x, y]) => { const [cx, cy] = centroid(P); return [x, y]; });
    walls(slabB, inflateSafe(P2, 0.35), F1, F1 + 1.0, 40);
    walls(slabB, inflateSafe(P2, 0.2), base, base + 0.7, 40);
    // dikey kayıtlar: kara tarafında her 9 m'de çelik dikme (cephenin önünde)
    for (let k = 0; k < P.length; k++) {
      const [ax, ay] = P[k], [bx, by] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, by - ay);
      if (L < 6) continue;
      const nx = (by - ay) / L, ny = -(bx - ax) / L;
      if (air(nx, ny)) continue;
      const n = Math.floor(L / 9);
      for (let i = 1; i < n; i++) {
        const x = ax + (bx - ax) * i / n + nx * 0.35, y = ay + (by - ay) * i / n + ny * 0.35;
        cbox(fins, x, y, base, 0.35, 0.7, roofUnder(x, y) - base, Math.atan2(by - ay, bx - ax));
      }
    }
  }
  // saçak sütunları: kara tarafı saçağının altında, tabanın dışında kalan yerlerde
  for (let j = 2; j < R.N - 1; j += opt.colEvery || 4) {
    for (const t of opt.colT || [0.95]) {
      const p = G[j][Math.round(t * (opt.NB || 12))];
      const [x, y] = [p[0], p[1]];
      if (polys.some((P) => pip(P, x, y)) || Math.min(...polys.map((P) => nearestEdge(P, x, y).d)) < 3) continue;
      const g0 = Math.min(0, gh(x, y)) - 0.3;
      if (opt.tree) {
        // ağaç sütun: gövde + çatıya açılan dört dal
        column(cols, x, y, g0, p[2] - 5, 0.75, 0.6);
        for (let q = 0; q < 4; q++) {
          const an = q * TAU / 4 + 0.785 + opt.axis, r = 3.2;
          slab(cols, [x, y, p[2] - 5.4], [x + Math.cos(an) * r, y + Math.sin(an) * r, p[2] - 0.3], 0.45, 0.45);
        }
      } else column(cols, x, y, g0, p[2], 0.6, 0.45);
    }
  }
  // ışıklıklar
  if (opt.sky) opt.sky(sky, G, R, hf);
  const mk = (gb, mat, name) => { if (!gb.count) return; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; grp.add(m); return m; };
  mk(glass, mt.glass, 'cephe'); mk(solid, mt.panel, 'cephe-opak'); mk(slabB, mt.conc, 'kat-bandi');
  mk(top, opt.roofMat, 'cati'); mk(under, mt.soffit, 'cati-alti'); mk(fasc, opt.fascMat || mt.steel, 'cati-alin'); mk(sky, mt.glass, 'isiklik');
  const det = new THREE.Group(); det.name = 'ayrinti-yakin'; det.matrixAutoUpdate = false; grp.add(det);
  for (const [gb, mat, nm] of [[cols, mt.white, 'sutunlar'], [fins, mt.steel, 'dikmeler']]) if (gb.count) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; det.add(m); }
  let hmax = 0; for (const r of G) for (const p of r) hmax = Math.max(hmax, p[2] + opt.th);
  grp.userData = { id, ad, taban: ccw(polys[0]), tabanlar: polys.map(ccw), yukseklik: hmax, katYuksekligi: 4.5, gidisKati: F1, kotu: base, eksen: opt.axis };
  grp.matrixAutoUpdate = false;
  for (const P of polys.slice(1)) (ctx.solid || (ctx.solid = [])).push({ P: ccw(P), top: hmax, ad });
  ctx.part('terminal:' + id, grp);
  return { grp, R, G, hf, base, hmax };
}
// açıortay büyütme (sivri köşelerde sınırlı)
function inflateSafe(P, d) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
    let e1x = b[0] - a[0], e1y = b[1] - a[1], e2x = c[0] - b[0], e2y = c[1] - b[1];
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1; e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
    let mx = e1y + e2y, my = -e1x - e2x; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const cosv = Math.max(0.5, mx * e1y - my * e1x);
    out.push([b[0] + mx * d / cosv, b[1] + my * d / cosv]);
  }
  return out;
}

// ---------- yol viyadüğü (gidiş katı) ----------
// pts: [[x, y, yerden yükseklik], ...]
function viaduct(gb, dk, ctx, pts, w) {
  const { gh } = ctx;
  const P = pts.map(([x, y, h]) => [x, y, Math.min(0, gh(x, y)) + h]);
  let acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    slab(gb, [a[0], a[1], a[2] - 1.1], [b[0], b[1], b[2] - 1.1], w, 1.1);                    // tabliye
    slab(dk, [a[0], a[1], a[2]], [b[0], b[1], b[2]], w - 0.8, 0.05, null, false);              // asfalt
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
    for (const s of [-1, 1]) slab(gb, [a[0] + nx * s * (w / 2 - 0.2), a[1] + ny * s * (w / 2 - 0.2), a[2]], [b[0] + nx * s * (w / 2 - 0.2), b[1] + ny * s * (w / 2 - 0.2), b[2]], 0.4, 1.0);
    // ayaklar: her 24 m
    for (let d = (24 - acc % 24) % 24; d < L; d += 24) {
      const x = a[0] + ux * d, y = a[1] + uy * d, z = a[2] + (b[2] - a[2]) * d / L - 1.1, g = Math.min(0, gh(x, y)) - 0.3;
      if (z - g < 1.2) continue;
      cbox(gb, x, y, g, 1.6, w * 0.45, z - g, Math.atan2(uy, ux));
      cbox(gb, x, y, z - 1.0, 1.8, w * 0.9, 1.0, Math.atan2(uy, ux));
    }
    acc += L;
  }
}

// ---------- otopark (açık katlı) ----------
function carPark(ctx, gb, fin, carsOut, P0, H) {
  const { gh } = ctx;
  const P = ccw(P0);
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.3;
  const lv = Math.max(2, Math.round(H / 3.3) - 1), fh = 3.2;
  const o = obbOf(P);
  for (let k = 0; k <= lv; k++) {
    const z = base + k * fh;
    if (k > 0) { flat(gb, P, z, false); flat(gb, P, z - 0.4, true); walls(gb, P, z - 0.4, z, 60); }
    walls(gb, inflateSafe(P, 0.05), z + 0.4, z + 1.15, 60);          // korkuluk
  }
  // kolonlar (8 m ızgara), merdiven çekirdekleri
  for (let a = o.a0 + 4; a < o.a1 - 2; a += 8) for (let b = o.b0 + 4; b < o.b1 - 2; b += 8) {
    const x = a * o.c - b * o.s, y = a * o.s + b * o.c;
    if (!pip(P, x, y) || nearestEdge(P, x, y).d < 1.5) continue;
    cbox(gb, x, y, base, 0.6, 0.6, lv * fh, o.ang);
  }
  const corners = [[o.a0 + 4, o.b0 + 4], [o.a1 - 4, o.b1 - 4], [o.a0 + 4, o.b1 - 4]];
  for (const [a, b] of corners) {
    const x = a * o.c - b * o.s, y = a * o.s + b * o.c; if (!pip(P, x, y)) continue;
    cbox(gb, x, y, base, 6, 6, lv * fh + 3.2, o.ang);
  }
  // cephe kanatları (dikey alüminyum lameller, her 2.4 m)
  for (let k = 0; k < P.length; k++) {
    const [ax, ay] = P[k], [bx, by] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, by - ay);
    const nx = (by - ay) / L, ny = -(bx - ax) / L, n = Math.floor(L / 2.4);
    for (let i = 1; i < n; i++) { const x = ax + (bx - ax) * i / n + nx * 0.5, y = ay + (by - ay) * i / n + ny * 0.5; cbox(fin, x, y, base + 3.0, 0.12, 0.6, lv * fh - 1.6, Math.atan2(ny, nx)); }
  }
  // arabalar: çatıda her yer, alt katlarda cepheye yakın sıralar
  for (let k = 1; k <= lv; k++) {
    const z = base + k * fh;
    const roofLv = k === lv;
    for (let b = o.b0 + 4; b < o.b1 - 3; b += 7.5) for (let a = o.a0 + 2.5; a < o.a1 - 2; a += 2.7) {
      const x = a * o.c - b * o.s, y = a * o.s + b * o.c;
      if (!pip(P, x, y)) continue;
      const e = nearestEdge(P, x, y).d; if (e < 3) continue;
      if (!roofLv && e > 13) continue;
      if (hash(x * 1.3 + k, y) > (roofLv ? 0.5 : 0.78)) continue;
      carsOut.push([x, y, z, o.ang + Math.PI / 2 + ((Math.floor((b - o.b0) / 7.5) % 2) ? Math.PI : 0)]);
    }
    // alt katta da birkaç sıra (yerde)
  }
  (ctx.solid || (ctx.solid = [])).push({ P, top: base + lv * fh + 1.2, ad: 'Otopark' });
}
// araba geometrisi (örneklenmiş): gövde + kabin (koyu cam), 1 birim = 1 m, burun +x
let CAR = null;
function carGeom() {
  if (CAR) return CAR;
  const gb = new GB([['color', 3]]);
  cbox(gb, 0, 0, 0.18, 4.4, 1.78, 0.72, 0, [1, 1, 1]);
  cbox(gb, -0.25, 0, 0.9, 2.3, 1.6, 0.55, 0, [0.22, 0.24, 0.27]);
  CAR = gb.geometry();
  return CAR;
}
const CAR_COLS = [0xe8e8e6, 0xe8e8e6, 0x1c1d20, 0x9a9fa4, 0x9a9fa4, 0x5b6067, 0x8a1e1e, 0x1f3f78, 0xc8c2b0, 0x30503a, 0xd8d8d8];
function carInstances(list, mat) {
  const m = new THREE.InstancedMesh(carGeom(), mat, list.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, y, z, a], i) => {
    o.position.set(x, z, -y); o.rotation.set(0, a, 0); o.scale.set(1, 1, 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    c.setHex(CAR_COLS[Math.floor(hash(x, y * 1.7) * CAR_COLS.length)]); m.setColorAt(i, c);
  });
  m.computeBoundingSphere(); m.matrixAutoUpdate = false; m.name = 'arabalar';
  return m;
}

// ---------- kargo terminali ----------
function cargo(ctx, mt, P0, ad, toward) {
  const { gh } = ctx;
  const P = ccw(P0);
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.4;
  const H = 13;
  const wall = new GB(); wall.uv = [];
  const roof = new GB(), dark = new GB(), conc = new GB();
  walls(wall, P, base + 1.2, H, 30, 3);
  walls(conc, P, base, base + 1.2, 40);
  flat(roof, P, H, false);
  walls(roof, inflateSafe(P, 0.3), H - 0.6, H + 0.8, 40);           // parapet
  // kara tarafı: kamyon rampası kapıları (her 5 m), hava tarafı: geniş kayar kapılar + saçak
  for (let k = 0; k < P.length; k++) {
    const [ax, ay] = P[k], [bx, by] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, by - ay);
    if (L < 15) continue;
    const nx = (by - ay) / L, ny = -(bx - ax) / L, ang = Math.atan2(by - ay, bx - ax);
    const airSide = nx * toward[0] + ny * toward[1] > 0.4;
    if (airSide) {
      const n = Math.floor(L / 14);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = ax + (bx - ax) * t + nx * 0.2, y = ay + (by - ay) * t + ny * 0.2; cbox(dark, x, y, base, 10, 0.4, 7.5, ang); }
      // saçak
      const c0 = [ax + nx * 6, ay + ny * 6], c1 = [bx + nx * 6, by + ny * 6];
      slab(roof, [(ax + c0[0]) / 2, (ay + c0[1]) / 2, 9.2], [(bx + c1[0]) / 2, (by + c1[1]) / 2, 9.2], 12.4, 0.6);
    } else if (nx * toward[0] + ny * toward[1] < -0.4) {
      const n = Math.floor(L / 5);
      for (let i = 1; i < n; i++) {
        const t = i / n, x = ax + (bx - ax) * t + nx * 0.2, y = ay + (by - ay) * t + ny * 0.2;
        cbox(dark, x, y, base + 1.2, 3.0, 0.4, 3.2, ang);
        cbox(conc, x + nx * 1.6, y + ny * 1.6, base, 3.4, 3.0, 1.2, ang);
      }
    }
  }
  // çatı üstü cihazlar
  const o = obbOf(P);
  for (let i = 0; i < 6; i++) {
    const a = o.a0 + (o.a1 - o.a0) * (0.15 + 0.7 * hash(i, 3)), b = o.b0 + (o.b1 - o.b0) * (0.2 + 0.6 * hash(3, i));
    const x = a * o.c - b * o.s, y = a * o.s + b * o.c; if (!pip(P, x, y)) continue;
    cbox(conc, x, y, H, 4 + 3 * hash(i, i), 3, 1.8, o.ang);
  }
  const grp = new THREE.Group();
  for (const [gb, mat, nm] of [[wall, mt.rib, 'duvar'], [roof, mt.steel, 'cati'], [dark, mt.dark, 'kapilar'], [conc, mt.conc, 'beton']]) if (gb.count) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; grp.add(m); }
  grp.userData = { ad, taban: P, yukseklik: H, kotu: base };
  grp.matrixAutoUpdate = false;
  (ctx.solid || (ctx.solid = [])).push({ P, top: H + 0.8, ad });
  return ctx.part('kargo', grp);
}
// ULD konteynerleri ve dolly'ler (örneklenmiş)
function ulds(list, x, y, ang, rows, cols) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    if (hash(x + r, y + k) < 0.25) continue;
    const a = k * 3.6, b = r * 4.2;
    list.push([x + a * c - b * s, y + a * s + b * c, ang, hash(r + x, k)]);
  }
}
function uldMesh(list, mt) {
  const gb = new GB([['color', 3]]);
  cbox(gb, 0, 0, 0.0, 3.2, 2.5, 0.5, 0, [0.25, 0.25, 0.27]);         // dolly
  cbox(gb, 0, 0, 0.5, 3.1, 2.4, 1.6, 0, [1, 1, 1]);                  // konteyner
  const m = new THREE.InstancedMesh(gb.geometry(), mt.car, list.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, y, a, r], i) => { o.position.set(x, 0.1, -y); o.rotation.set(0, a, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); c.setHex(r < 0.55 ? 0xb8bcc0 : r < 0.8 ? 0x8c9298 : 0xd0a040); m.setColorAt(i, c); });
  m.computeBoundingSphere(); m.matrixAutoUpdate = false; m.name = 'uld';
  return m;
}

// ---------- kule ----------
function tower(ctx, mt, x, y, H, ang) {
  const { gh } = ctx;
  const base = gh(x, y) - 0.5;
  const conc = new GB(), cab = new GB(), dark = new GB(), steel = new GB();
  // taban binası (iki kat, ışık şeritli)
  cbox(conc, x + Math.cos(ang) * 9, y + Math.sin(ang) * 9, base, 26, 15, 8.2, ang);
  cbox(dark, x + Math.cos(ang) * 9, y + Math.sin(ang) * 9, base + 1.2, 26.2, 15.2, 1.6, ang);
  cbox(dark, x + Math.cos(ang) * 9, y + Math.sin(ang) * 9, base + 5.0, 26.2, 15.2, 1.6, ang);
  // gövde: silindir + yanında asansör/merdiven çekirdeği
  const top = base + H - 11;
  conc.lathe(x, y, [[4.2, 0], [3.8, top - base]], 20, base);
  cbox(conc, x - Math.cos(ang) * 3.4, y - Math.sin(ang) * 3.4, base, 4.2, 4.2, top - base + 2.5, ang);
  // gövdede dikey ışık yarığı
  cbox(dark, x + Math.cos(ang + 1.57) * 3.75, y + Math.sin(ang + 1.57) * 3.75, base + 9, 0.3, 1.0, top - base - 12, ang + 1.57);
  // teknik katlar ve kabin (12 kenar, dışa eğik camlar)
  conc.lathe(x, y, [[3.8, 0], [6.5, 2.2], [7.2, 2.6]], 12, top);
  dark.lathe(x, y, [[7.0, 2.6], [7.0, 5.2]], 12, top);
  steel.lathe(x, y, [[7.6, 5.2], [7.6, 5.6], [7.3, 5.6]], 12, top);
  cab.lathe(x, y, [[7.1, 5.6], [8.0, 9.6]], 12, top);
  steel.lathe(x, y, [[8.4, 9.6], [8.4, 10.3], [6.5, 10.9], [2.0, 11.2], [0.05, 11.3]], 12, top);
  // kabin dikmeleri
  for (let k = 0; k < 12; k++) { const a = (k + 0.5) / 12 * TAU; steel.box(x + Math.cos(a) * 7.55, y + Math.sin(a) * 7.55, top + 5.6, 0.18, 0.18, 4.0, a); }
  // antenler ve radar
  steel.box(x + 2, y, top + 11.2, 0.25, 0.25, 7, 0); steel.box(x - 2, y + 1, top + 11.2, 0.2, 0.2, 5, 0);
  steel.lathe(x - 1, y - 2, [[0.9, 0], [0.9, 0.4]], 10, top + 11.2);
  const grp = new THREE.Group();
  for (const [gb, mat, nm] of [[conc, mt.white, 'govde'], [cab, mt.cab, 'kabin'], [dark, mt.dark, 'teknik'], [steel, mt.steel, 'celik']]) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; grp.add(m); }
  grp.matrixAutoUpdate = false;
  const W = ctx.W, key = Math.round(ctx.d.x + x) + ':' + Math.round(ctx.d.y + y);
  W._apCol = W._apCol || new Set();
  if (!W._apCol.has(key)) { W._apCol.add(key); W.lmCol.push({ x: ctx.d.x + x, y: ctx.d.y + y, r: 9, top: ctx.d.elev + base + H }); }
  return ctx.part('kule', grp);
}

// ---------- hangarlar ----------
function hangars(ctx, mt, list, rws) {
  const { gh } = ctx;
  const wall = new GB(); wall.uv = [];
  const roof = new GB(), door = new GB(), conc = new GB(); door.uv = [];
  const near = (x, y) => {
    let best = null, bd = 1e18;
    for (const r of rws) { const dx = r.b[0] - r.a[0], dy = r.b[1] - r.a[1], L2 = dx * dx + dy * dy, t = clamp(((x - r.a[0]) * dx + (y - r.a[1]) * dy) / L2, 0, 1), px = r.a[0] + dx * t, py = r.a[1] + dy * t, d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = [(px - x) / d, (py - y) / d]; } }
    return best;
  };
  ctx.solid = (ctx.solid || []).filter((s) => s.ad !== 'Hangar');
  for (const b of list) {
    const P = ccw(b.p), o = obbOf(P);
    const ar = Math.abs(area(P));
    const H = clamp(6 + Math.sqrt(ar) * 0.33, 10, 20), eave = H * 0.68;
    const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.4;
    walls(wall, P, base, eave, 40, 3);
    barrel(roof, o, eave, H, 12);
    flat(roof, P, eave - 0.02, false);
    // kapı: piste en çok bakan kenar
    const dir = near(o.cx, o.cy) || [1, 0];
    let bestK = 0, bdot = -2;
    for (let k = 0; k < P.length; k++) { const [ax, ay] = P[k], [bx, by] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, by - ay); const dt = ((by - ay) / L) * dir[0] + (-(bx - ax) / L) * dir[1]; if (dt * Math.min(1, L / 15) > bdot) { bdot = dt * Math.min(1, L / 15); bestK = k; } }
    const [ax, ay] = P[bestK], [bx, by] = P[(bestK + 1) % P.length], L = Math.hypot(bx - ax, by - ay), nx = (by - ay) / L, ny = -(bx - ax) / L, ang = Math.atan2(by - ay, bx - ax);
    const np = Math.max(2, Math.round(L / 7));
    for (let i = 0; i < np; i++) {
      const t = (i + 0.5) / np, off = 0.25 + (i % 2) * 0.35;
      cbox(door, ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off, base, L / np - 0.15, 0.3, eave * 0.86, ang);
    }
    cbox(conc, (ax + bx) / 2 + nx * 0.5, (ay + by) / 2 + ny * 0.5, base + eave * 0.86, L + 0.6, 1.0, eave * 0.14 + 0.2, ang);
    // yan ek bina (atölye/ofis), uzun kenarda
    const sideK = (bestK + 1) % P.length;
    const [cx0, cy0] = P[sideK], [cx1, cy1] = P[(sideK + 1) % P.length], L2 = Math.hypot(cx1 - cx0, cy1 - cy0);
    if (L2 > 15) { const sx = (cy1 - cy0) / L2, sy = -(cx1 - cx0) / L2; cbox(conc, (cx0 + cx1) / 2 + sx * 3.2, (cy0 + cy1) / 2 + sy * 3.2, base, L2 * 0.7, 6, Math.min(7, eave - 1), Math.atan2(cy1 - cy0, cx1 - cx0)); }
    ctx.solid.push({ P, top: H, ad: 'Hangar' });
  }
  const grp = new THREE.Group(); grp.name = 'hangar-ltbj'; grp.matrixAutoUpdate = false;
  for (const [gb, mat, nm] of [[wall, mt.rib, 'duvar'], [roof, mt.steel, 'cati'], [door, mt.ribBlue, 'kapi'], [conc, mt.conc, 'ek']]) if (gb.count) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; grp.add(m); }
  ctx.grp.add(grp);
}

// ---------- yolcu köprüleri ----------
// OSM: sabit kol (dörtgen: cepheden döner gövdeye) + teleskopik tünel (iki noktalı çizgi: döner gövde -> uçak kapısı)
function bridges(ctx, mt, termPolys, S, F1) {
  const { d, gh } = ctx;
  const glass = new GB(); glass.uv = [];
  const steel = new GB(), dark = new GB();
  const rects = d.kopru.filter((k) => k.length >= 4), lines = d.kopru.filter((k) => k.length === 2);
  const doors = [];
  for (const s of S) if (s.ac) {
    const { x, y, hx, hy, L, sc } = s.ac, lx = -hy, ly = hx;
    const nx = x + hx * L / 2, ny = y + hy * L / 2;
    doors.push({ x: nx - hx * 5.6 * sc + lx * 2.0 * sc, y: ny - hy * 5.6 * sc + ly * 2.0 * sc, lx, ly, hx, hy, sc, used: false });
  }
  for (const r of rects) {
    const o = obbOf(r);
    const ux = o.L >= o.Wd ? o.c : -o.s, uy = o.L >= o.Wd ? o.s : o.c, len = Math.max(o.L, o.Wd), wd = clamp(Math.min(o.L, o.Wd), 2.8, 4.5);
    let e0 = [o.cx - ux * len / 2, o.cy - uy * len / 2], e1 = [o.cx + ux * len / 2, o.cy + uy * len / 2];
    const dT = (p) => Math.min(...termPolys.map((P) => nearestEdge(P, p[0], p[1]).d));
    if (dT(e1) < dT(e0)) [e0, e1] = [e1, e0];
    const hT = F1 - 0.4, hR = F1 - 0.9;
    // sabit kol: cam koridor, ayaklar
    slab(glass, [e0[0], e0[1], hT], [e1[0], e1[1], hR], wd, 2.9, null, true, 3);
    slab(steel, [e0[0], e0[1], hT + 2.9], [e1[0], e1[1], hR + 2.9], wd + 0.4, 0.35);
    slab(steel, [e0[0], e0[1], hT - 0.45], [e1[0], e1[1], hR - 0.45], wd + 0.2, 0.45);
    const lenF = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
    for (let t = 12; t < lenF - 4; t += 12) { const x = e0[0] + (e1[0] - e0[0]) * t / lenF, y = e0[1] + (e1[1] - e0[1]) * t / lenF; column(steel, x, y, Math.min(0, gh(x, y)) - 0.2, hT - 0.45, 0.3, 0.3, 6); }
    // döner gövde
    const [rx, ry] = e1;
    column(steel, rx, ry, Math.min(0, gh(rx, ry)) - 0.2, hR - 0.5, 0.75, 0.75, 10);
    steel.lathe(rx, ry, [[2.7, 0], [2.7, 3.3], [2.4, 3.6]], 12, hR - 0.6);
    // bu döner gövdeden çıkan tüneller
    for (const ln of lines) {
      const p0 = ln[0], p1 = ln[1];
      const d0 = Math.hypot(p0[0] - rx, p0[1] - ry), d1 = Math.hypot(p1[0] - rx, p1[1] - ry);
      if (Math.min(d0, d1) > 9) continue;
      const far = d0 < d1 ? p1 : p0;
      // yakında uçak kapısı var mı?
      let best = null, bd = 22;
      for (const q of doors) { if (q.used) continue; const dd = Math.hypot(q.x - far[0], q.y - far[1]); if (dd < bd) { bd = dd; best = q; } }
      let end, hE;
      if (best) {
        best.used = true;
        end = [best.x + best.lx * 1.9, best.y + best.ly * 1.9];
        hE = best.sc > 1.2 ? 4.4 : 2.9;
      } else {
        // uçak yok: tünel geri çekik, kabin aşağıda
        const L = Math.hypot(far[0] - rx, far[1] - ry);
        end = [rx + (far[0] - rx) * Math.min(1, 16 / L), ry + (far[1] - ry) * Math.min(1, 16 / L)];
        hE = 2.8;
      }
      tunnel(glass, steel, dark, ctx, [rx, ry, hR], end, hE, best);
    }
  }
  const grp = new THREE.Group(); grp.name = 'yolcu-kopruleri'; grp.matrixAutoUpdate = false;
  for (const [gb, mat] of [[glass, mt.glass], [steel, mt.steel], [dark, mt.dark]]) if (gb.count) { const m = new THREE.Mesh(gb.geometry(), mat); m.matrixAutoUpdate = false; grp.add(m); }
  ctx.grp.add(grp);
}
function tunnel(glass, steel, dark, ctx, R, end, hE, door) {
  const { gh } = ctx;
  const dx = end[0] - R[0], dy = end[1] - R[1], L = Math.hypot(dx, dy); if (L < 6) return;
  const ux = dx / L, uy = dy / L;
  const st = 2.7;   // döner gövde yarıçapı
  const sL = L - st - 2.8;     // kabin boyu 2.8
  const n = sL > 24 ? 3 : 2;
  for (let k = 0; k < n; k++) {
    const t0 = st + sL * k / n - (k ? 0.8 : 0), t1 = st + sL * (k + 1) / n;
    const h0 = R[2] + (hE - R[2]) * (t0 / L), h1 = R[2] + (hE - R[2]) * (t1 / L);
    const w = 2.9 + k * 0.22, hh = 2.6 + k * 0.18;
    slab(steel, [R[0] + ux * t0, R[1] + uy * t0, h0 - k * 0.09], [R[0] + ux * t1, R[1] + uy * t1, h1 - k * 0.09], w, hh);
    // yan pencere bandı
    slab(dark, [R[0] + ux * (t0 + 0.6), R[1] + uy * (t0 + 0.6), h0 + 1.0], [R[0] + ux * (t1 - 0.6), R[1] + uy * (t1 - 0.6), h1 + 1.0], w + 0.06, 0.6, null, true);
  }
  // sürüş ayağı ve tekerlek boji
  const tf = st + sL * 0.82, fx = R[0] + ux * tf, fy = R[1] + uy * tf, fh = R[2] + (hE - R[2]) * tf / L, g = Math.min(0, gh(fx, fy)) - 0.1;
  const nx = -uy, ny = ux;
  for (const s of [-1, 1]) cbox(steel, fx + nx * s * 1.1, fy + ny * s * 1.1, g + 0.9, 0.35, 0.35, fh - g - 0.9, Math.atan2(uy, ux));
  cbox(dark, fx, fy, g, 1.6, 3.6, 0.9, Math.atan2(uy, ux));
  // kabin ve körük
  const cx = R[0] + ux * (L - 1.4), cy = R[1] + uy * (L - 1.4);
  cbox(steel, cx, cy, hE - 0.3, 2.8, 3.8, 3.0, Math.atan2(uy, ux));
  if (door) cbox(dark, end[0] - ux * 0.1, end[1] - uy * 0.1, hE - 0.1, 0.6, 3.2, 2.6, Math.atan2(uy, ux));
}

// ---------- kurulum ----------
export function build(ctx) {
  const { d, grp, gh } = ctx;
  const mt = mats(ctx.W, ctx.M);
  // genel hangarları kaldır (aşağıda ayrıntılıları kurulur)
  for (const c of grp.children.slice()) if (/^hangar-(duvar|cati|kenar)$/.test(c.name)) { grp.remove(c); c.geometry.dispose(); }
  // binaları ayır (OSM'de bazıları iki kez var)
  const seen = new Set(), B = [];
  for (const b of d.bina) { const k = b.t + ':' + Math.round(b.p[0][0]) + ':' + Math.round(b.p[0][1]); if (seen.has(k)) continue; seen.add(k); B.push({ ...b, ar: Math.abs(area(b.p)) }); }
  const terms = B.filter((b) => b.t === 'terminal');
  const parks = terms.filter((b) => /otopark/i.test(b.n || ''));
  const cargoB = terms.find((b) => /cargo|kargo/i.test(b.n || ''));
  const rest = terms.filter((b) => !parks.includes(b) && b !== cargoB).sort((a, b) => b.ar - a.ar);
  const main = rest[0], fill = rest.slice(1).filter((b) => main && b.p.some(([x, y]) => nearestEdge(main.p, x, y).d < 2));
  const termPolys = [];
  let F1 = 5.2;
  // ana çokgen: hava tarafı uzun cephesi eksen
  if (main) {
    const o = obbOf(main.p);
    let ax = o.ang; if (Math.sin(ax) < 0) ax += Math.PI;              // eksen kuzeye
    const ux = Math.cos(ax), uy = Math.sin(ax);
    // kesim: ara bağlantının (OSM'deki ikinci terminal parçası) güney ucu; yoksa ortası
    const proj = (p) => p[0] * ux + p[1] * uy;
    let cut = fill.length ? Math.min(...fill[0].p.map(proj)) : (Math.min(...main.p.map(proj)) + Math.max(...main.p.map(proj))) / 2;
    const south = clipHalf(main.p, ux, uy, cut), north = clipHalf(main.p, -ux, -uy, -cut);
    // İç Hatlar (güney): dalgalı çatı
    const ic = buildTerminal(ctx, mt, 'ic-hatlar', 'İç Hatlar Terminali', [south], {
      axis: ax, ovAir: 5, ovLand: 17, ovEnd: 6, th: 1.6, NB: 14, floor1: F1, roofMat: mt.roofW, fascMat: mt.roofW, tree: true, colT: [0.97], colEvery: 4,
      hf: (a, t, R) => {
        const wave = Math.sin((a - R.a0) / 66 * TAU - 1.2);
        return 19.5 + 3.6 * wave * (0.45 + 0.55 * t) + 3.2 * t * t - 1.2 * (1 - t) * (1 - t);
      },
      sky: (gb, G, R, hf) => {
        // dalga tepelerinde enine ışıklık şeritleri
        for (let k = 0; k < 40; k++) {
          const a = R.a0 + (k + 0.25 + 1.2 / TAU) * 66; if (a > R.a1 - 10) break; if (a < R.a0 + 8) continue;
          const e = R.extAt(a);
          for (let i = 1; i < 12; i++) {
            const t0 = 0.08 + i / 14, t1 = t0 + 1 / 14 - 0.004;
            const p0 = R.XY(a, e[0] + (e[1] - e[0]) * t0), p1 = R.XY(a, e[0] + (e[1] - e[0]) * t1);
            slab(gb, [p0[0], p0[1], hf(a, t0) + 1.35], [p1[0], p1[1], hf(a, t1) + 1.35], 7, 0.7, null, true, 2);
          }
        }
      },
    });
    // Dış Hatlar (kuzey): enine kemerli çatı, sırt ışıklığı
    const dis = buildTerminal(ctx, mt, 'dis-hatlar', 'Dış Hatlar Terminali', [north, ...fill.map((b) => b.p)], {
      axis: ax, ovAir: 4, ovLand: 15, ovEnd: 5, th: 1.4, NB: 12, floor1: F1, roofMat: mt.roofS, fascMat: mt.steel, colT: [0.95], colEvery: 3,
      hf: (a, t) => 15.5 + 6.0 * (1 - ((t - 0.42) / 0.58) ** 2) * (t < 0.42 ? 1 - ((0.42 - t) / 0.42) ** 2 * 0.35 : 1),
      sky: (gb, G, R, hf) => {
        for (let j = 1; j < R.N - 1; j++) {
          const a0 = R.s0 + j * R.st + 0.4, a1 = a0 + R.st - 0.8;
          for (const t of [0.42]) {
            const e0 = R.extAt(a0), e1 = R.extAt(a1);
            const p0 = R.XY(a0, e0[0] + (e0[1] - e0[0]) * t), p1 = R.XY(a1, e1[0] + (e1[1] - e1[0]) * t);
            slab(gb, [p0[0], p0[1], hf(a0, t) + 1.2], [p1[0], p1[1], hf(a1, t) + 1.2], 9, 0.8, null, true, 2);
          }
        }
      },
    });
    termPolys.push(south, north, ...fill.map((b) => b.p));
    // gidiş katı viyadüğü: her terminalin kara cephesinin önünde, rampalarla
    const conc = new GB(), asph = new GB(), fin = new GB(), cars = [];
    // tek parça viyadük: güneyden rampayla çıkar, iki terminalin kara cephesi önünden geçer, kuzeyde rampayla iner
    const H = F1 + 0.2, WD = 15, line = [];
    const front = (T) => { const R = T.R; let bl = -1e9; for (let a = R.a0 + 25; a <= R.a1 - 25; a += 6) bl = Math.max(bl, R.extAt(a)[1] - 17); return bl + 11; };
    const bI = front(ic), bD = front(dis);
    const xyh = (R, a, b, h) => { const [x, y] = R.XY(a, b); return [x, y, h]; };
    line.push(xyh(ic.R, ic.R.a0 - 120, bI + 10, 0.4), xyh(ic.R, ic.R.a0 - 35, bI + 3, H - 0.4), xyh(ic.R, ic.R.a0 + 5, bI, H), xyh(ic.R, ic.R.a1 - 15, bI, H));
    line.push(xyh(dis.R, dis.R.a0 + 15, bD, H), xyh(dis.R, dis.R.a1 - 5, bD, H), xyh(dis.R, dis.R.a1 + 35, bD + 3, H - 0.4), xyh(dis.R, dis.R.a1 + 120, bD + 10, 0.4));
    viaduct(conc, asph, ctx, line, WD);
    for (const [T, b] of [[ic, bI], [dis, bD]]) {
      const R = T.R;
      // viyadükte araçlar (taksi, otomobil)
      for (let a = R.a0 + 10; a < R.a1 - 20; a += 9) if (hash(a, b) < 0.35) { const sd = hash(b, a) < 0.5 ? -1 : 1, [x, y] = R.XY(a, b + sd * 3.5); cars.push([x, y, Math.min(0, gh(x, y)) + H + 0.05, ax + (sd < 0 ? 0 : Math.PI)]); }
      // geliş katı (zemin) yolunda bekleyen araçlar
      for (let a = R.a0 + 10; a < R.a1 - 20; a += 7) if (hash(a, b + 7) < 0.3) { const [x, y] = R.XY(a, b + 20); if (termPolys.some((Q) => pip(Q, x, y))) continue; cars.push([x, y, Math.min(0, gh(x, y)), ax]); }
    }
    for (const p of parks) carPark(ctx, conc, fin, cars, p.p, p.h || 16);
    const g2 = new THREE.Group(); g2.name = 'kara-tarafi'; g2.matrixAutoUpdate = false;
    for (const [gb, mat, nm] of [[conc, mt.conc, 'beton'], [asph, mt.asph, 'asfalt']]) if (gb.count) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = nm; m.matrixAutoUpdate = false; g2.add(m); }
    grp.add(g2);
    const near = new THREE.Group(); near.name = 'ayrinti-yakin'; near.matrixAutoUpdate = false;
    if (fin.count) { const m = new THREE.Mesh(fin.geometry(), mt.steel); m.name = 'lameller'; m.matrixAutoUpdate = false; near.add(m); }
    if (cars.length) near.add(carInstances(cars, mt.car));
    grp.add(near);
  } else {
    for (const b of rest) termPolys.push(b.p);
  }
  // kargo terminali: hava tarafı en yakın aprona bakar
  const uldList = [];
  if (cargoB) {
    const [cx, cy] = centroid(cargoB.p);
    let tw = [1, 0], bd = 1e18;
    for (const pl of d.apron) { const [ax2, ay2] = centroid(pl[0]); const dd = Math.hypot(ax2 - cx, ay2 - cy); if (dd < bd) { bd = dd; tw = [(ax2 - cx) / dd, (ay2 - cy) / dd]; } }
    if (bd > 600) tw = [1, 0];
    cargo(ctx, mt, cargoB.p, 'Kargo Terminali', tw);
    // konteyner sıraları: hava tarafındaki cephenin önünde
    const o = obbOf(cargoB.p);
    const ang = Math.abs(Math.cos(o.ang) * tw[0] + Math.sin(o.ang) * tw[1]) < 0.5 ? o.ang : o.ang + Math.PI / 2;
    const n = [Math.cos(ang - Math.PI / 2), Math.sin(ang - Math.PI / 2)], sgn = n[0] * tw[0] + n[1] * tw[1] > 0 ? 1 : -1;
    const P = ccw(cargoB.p); let far = 0; for (const [x, y] of P) far = Math.max(far, ((x - cx) * n[0] + (y - cy) * n[1]) * sgn);
    const ox = cx + n[0] * sgn * (far + 14), oy = cy + n[1] * sgn * (far + 14);
    ulds(uldList, ox - Math.cos(ang) * 40, oy - Math.sin(ang) * 40, ang, 3, 22);
  }
  // park yerleri, uçaklar, köprüler, apron araçları
  const S = stands(d); ctx.stands = S;
  standsAndAircraft(ctx, { occ: 0.66 });
  bridges(ctx, mt, termPolys.length ? termPolys : [[[0, 0], [1, 0], [0, 1]]], S, F1);
  vehicles(ctx, S);
  if (uldList.length) { const g = grp.children.find((c) => c.name === 'ayrinti-yakin') || grp; g.add(uldMesh(uldList, mt)); }
  // hangarlar
  hangars(ctx, mt, B.filter((b) => b.t === 'hangar'), d.rws);
  // kule (OSM: 45 m)
  let tw = null; for (const b of B) if (b.t === 'tower' && (!tw || b.h > tw.h)) tw = b;
  if (tw) { const [x, y] = centroid(tw.p); const o = main ? obbOf(main.p) : { ang: 0 }; tower(ctx, mt, x, y, Math.max(40, tw.h || 45), o.ang); }
  // yakın ayrıntıları uzakta gizle
  let fr = 0;
  const nearObjs = [];
  grp.traverse((o) => { if (o.name === 'ayrinti-yakin') nearObjs.push(o); });
  ctx.tick = (cam) => {
    if (++fr % 12) return;
    const dd = Math.hypot(d.x - cam.x, d.y - cam.y, Math.max(0, cam.h - d.elev) * 0.6);
    for (const o of nearObjs) o.visible = dd < 4500;
  };
}
