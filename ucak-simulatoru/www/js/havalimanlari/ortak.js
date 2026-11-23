// Ayrıntılı havalimanları için ortak parçalar: terminal (cam cephe, saçak, çatı biçimleri, gece ışıkları), kuleler (lale
// biçimli, modern, klasik; eğik camlı kabin, anten, engel ışıkları), yolcu köprüleri (sabit geçit, rotunda, teleskopik
// tüneller, tekerlekli yürüyen ayak, kabin), park etmiş yolcu uçakları (markasız dar ve geniş gövde, iki ayrıntı düzeyi),
// apron araçları (çekici, bant yükleyici, bagaj treni, yakıt tankeri, ikram kamyonu, merdiven, otobüs, follow-me), apron
// ışık direkleri, park yeri numaraları ve durma çizgileri, hangarlar (kemerli ya da düz çatı, sürgülü kapı).
// Her terminal ayrı bir THREE.Group'tur: adı 'terminal:<kimlik>', userData = { id, ad, taban (yerel x doğu / y kuzey, m),
// yukseklik, katYuksekligi, kotu (havalimanı yüksekliğine göre) }. İç mekân eklenecekse bu gruba çocuk olarak eklenir;
// dış kabuk (cephe, çatı) ayrı ağlarda olduğu için gizlenebilir ya da kesit alınabilir.
// Başarım: her tür tek birleşik örgü ya da örneklenmiş çizim; uçaklar uzaklığa göre iki ayrıntı düzeyinde (kare başına
// değil, 8 karede bir yeniden dağıtılır), araçlar 600 m'lik parçalar hâlinde ve 2.5 km'den uzakta çizilmez.
// Gece: setNight(0..1) bütün pencere, kabin ve projektör ışıklarını açar (gündüz 0).
import * as THREE from '../../vendor/three.module.min.js';
import { ShapeUtils } from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, barrel, stands, decal } from '../havalimani.js';

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
function hash1(x, y) { let h = Math.imul(Math.round(x * 13) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(y * 7) + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }
const TAILS = [0x2f5d8a, 0xb23a3a, 0x3a8a6a, 0xe0a020, 0x5a4a9a, 0xd0d4d8, 0x1f6fb0, 0x7a2a4a, 0x2a2e36, 0xc8642c, 0x0f7f8f, 0x8a1c1c];

// ---------- gece ----------
const NIGHT = { value: 0 };
export function setNight(v) { NIGHT.value = clamp(+v || 0, 0, 1); }
// malzemenin ışımasını gece katsayısıyla çarp (gündüz kapalı)
function nightGlow(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = NIGHT;
    sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= uNight;');
  };
  mat.customProgramCacheKey = () => 'gece-' + key;
  return mat;
}

// ---------- ortak malzemeler (dünya başına bir kez) ----------
let OM = null;
function omats(ctx) {
  if (OM && OM.W === ctx.W) return OM;
  const env = ctx.W.envMap ? ctx.W.envMap() : null;
  const vc = (o = {}) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o));
  // terminal camı: 3 m x kat yüksekliği; dikey kayıtlar 1.5 m, kat döşemesi bandı, gece içerisi sıcak ışık
  const gc = document.createElement('canvas'); gc.width = 128; gc.height = 256;
  const g = gc.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#a9bfcf'); gr.addColorStop(0.75, '#7891a3'); gr.addColorStop(1, '#6a8192');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#3c4852'; g.fillRect(0, 222, 128, 34);                 // döşeme bandı (opak)
  g.fillStyle = '#d0d4d8'; g.fillRect(0, 0, 5, 256); g.fillRect(62, 0, 4, 222); g.fillRect(0, 218, 128, 5); g.fillRect(0, 96, 128, 3);
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 4;
  const ec = document.createElement('canvas'); ec.width = 64; ec.height = 128;
  const e = ec.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, 64, 128);
  const eg = e.createLinearGradient(0, 0, 0, 110); eg.addColorStop(0, '#fff1c8'); eg.addColorStop(1, '#a8885a');
  e.fillStyle = eg; e.fillRect(3, 0, 27, 109); e.fillRect(33, 0, 29, 109);
  const et = new THREE.CanvasTexture(ec); et.wrapS = et.wrapT = THREE.RepeatWrapping; et.colorSpace = THREE.SRGBColorSpace;
  const glass = nightGlow(new THREE.MeshStandardMaterial({ color: 0xffffff, map: gt, metalness: 0.6, roughness: 0.16, envMap: env, envMapIntensity: 1.15, emissive: 0xffe2b0, emissiveMap: et, emissiveIntensity: 1.0 }), 'cam');
  const sky = nightGlow(new THREE.MeshStandardMaterial({ color: 0x8fa6b6, metalness: 0.7, roughness: 0.12, envMap: env, emissive: 0xfff0d0, emissiveIntensity: 0.35 }), 'isiklik');
  const cab = nightGlow(new THREE.MeshStandardMaterial({ color: 0x3d5a6a, metalness: 0.75, roughness: 0.08, envMap: env, envMapIntensity: 1.2, emissive: 0xb8ffd8, emissiveIntensity: 0.55 }), 'kabin');
  const lamp = nightGlow(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 1.6 }), 'lamba');
  OM = { W: ctx.W, glass, sky, cab, lamp, vc: vc(), vcD: vc({ side: THREE.DoubleSide }), roof: new THREE.MeshStandardMaterial({ color: 0xc3c7ca, metalness: 0.35, roughness: 0.55, envMap: env, envMapIntensity: 0.6 }) };
  return OM;
}

// ---------- geometri yardımcıları (yerel: x doğu, y kuzey, h yukarı) ----------
const CB = () => new GB([['color', 3]]);
function paint(gb, s0, c) { const v = gb.a.color.v; for (let k = s0; k < gb.count; k++) { v[k * 3] = c[0]; v[k * 3 + 1] = c[1]; v[k * 3 + 2] = c[2]; } }
// dört köşeli yüz (yerel [x, y, h]); dönüş yönü normale göre kendiliğinden düzeltilir
function face(gb, P, n, col) {
  const s = gb.count;
  for (const p of P) gb.vert(p[0], p[2], p[1], n[0], n[2], n[1]);
  // three: (x, h, -y)
  const a = P[0], b = P[1], c = P[2];
  const e1 = [b[0] - a[0], b[2] - a[2], -(b[1] - a[1])], e2 = [c[0] - a[0], c[2] - a[2], -(c[1] - a[1])];
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const ok = cr[0] * n[0] + cr[1] * n[2] - cr[2] * n[1] >= 0;
  if (P.length === 4) { if (ok) gb.quad(s, s + 1, s + 2, s + 3); else gb.quad(s, s + 3, s + 2, s + 1); }
  else if (ok) gb.tri(s, s + 1, s + 2); else gb.tri(s, s + 2, s + 1);
  if (col) paint(gb, s, col);
}
// eğimli kutu: A -> B (taban orta noktaları, [x, y, h]), en w, yükseklik hh; renkler: yan, üst, alt, uç
function sbox(gb, A, B, w, hh, cs, ct, cb, ce) {
  let ux = B[0] - A[0], uy = B[1] - A[1]; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
  const vx = -uy * w / 2, vy = ux * w / 2;
  const P = (Q, sd, up) => [Q[0] + vx * sd, Q[1] + vy * sd, Q[2] + up * hh];
  const a0 = P(A, -1, 0), a1 = P(A, 1, 0), a2 = P(A, 1, 1), a3 = P(A, -1, 1), b0 = P(B, -1, 0), b1 = P(B, 1, 0), b2 = P(B, 1, 1), b3 = P(B, -1, 1);
  const sl = (B[2] - A[2]) / L, nl = Math.hypot(sl, 1);
  face(gb, [a1, b1, b2, a2], [-uy, ux, 0], cs); face(gb, [a0, a3, b3, b0], [uy, -ux, 0], cs);
  face(gb, [a3, a2, b2, b3], [-ux * sl / nl, -uy * sl / nl, 1 / nl], ct || cs);
  face(gb, [a0, b0, b1, a1], [ux * sl / nl, uy * sl / nl, -1 / nl], cb || cs);
  face(gb, [a0, a1, a2, a3], [-ux, -uy, 0], ce || cs); face(gb, [b0, b3, b2, b1], [ux, uy, 0], ce || cs);
}
// döner gövde: eksen A -> B üzerinde profil [[t (0..1), r], ...]
function tube(gb, A, B, prof, seg, col) {
  const ax = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...ax); ax[0] /= L; ax[1] /= L; ax[2] /= L;
  let p = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let u = [ax[1] * p[2] - ax[2] * p[1], ax[2] * p[0] - ax[0] * p[2], ax[0] * p[1] - ax[1] * p[0]]; const ul = Math.hypot(...u); u = u.map((q) => q / ul);
  const v = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
  const s0 = gb.count, n = prof.length;
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), d = [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
    for (const [t, r] of prof) gb.vert(A[0] + ax[0] * L * t + d[0] * r, A[2] + ax[2] * L * t + d[2] * r, A[1] + ax[1] * L * t + d[1] * r, d[0], d[2], d[1]);
  }
  // dönüş yönünü ilk dörtgenle sına
  const pp = gb.p, q = (i) => [pp[i * 3], pp[i * 3 + 1], pp[i * 3 + 2]];
  let flip = false;
  for (let j = 0; j < n - 1; j++) {
    const a0 = q(s0 + j), a1 = q(s0 + j + 1), b0 = q(s0 + n + j);
    const e1 = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], e2 = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (Math.hypot(...cr) < 1e-9) continue;
    const nn = [gb.n[(s0 + j) * 3], gb.n[(s0 + j) * 3 + 1], gb.n[(s0 + j) * 3 + 2]];
    flip = cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2] < 0; break;
  }
  for (let k = 0; k < seg; k++) for (let j = 0; j < n - 1; j++) { const a = s0 + k * n + j, b = a + n; if (flip) gb.quad(a, b, b + 1, a + 1); else gb.quad(a, a + 1, b + 1, b); }
  // uç kapakları
  for (const [j, e] of [[0, -1], [n - 1, 1]]) {
    if (prof[j][1] < 0.02) continue;
    const c0 = gb.count, t = prof[j][0];
    gb.vert(A[0] + ax[0] * L * t, A[2] + ax[2] * L * t, A[1] + ax[1] * L * t, ax[0] * e, ax[2] * e, ax[1] * e);
    for (let k = 0; k <= seg; k++) { const i = s0 + k * n + j; gb.vert(pp[i * 3], pp[i * 3 + 1], -pp[i * 3 + 2], ax[0] * e, ax[2] * e, ax[1] * e); }
    for (let k = 0; k < seg; k++) { if ((e > 0) !== flip) gb.tri(c0, c0 + 1 + k, c0 + 2 + k); else gb.tri(c0, c0 + 2 + k, c0 + 1 + k); }
  }
  if (col) paint(gb, s0, col);
}
const cyl = (gb, A, B, r, seg, col) => tube(gb, A, B, [[0, r], [1, r]], seg, col);
// yönlü kutu (renkli): merkez x, y, taban h0, boy L (ang yönünde), en W, yükseklik H
function cbox(gb, x, y, h0, L, W, H, ang, col) { const s = gb.count; gb.box(x, y, h0, L, W, H, ang); paint(gb, s, col); }
function mesh(gb, mat, name) { const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; return m; }
function shadowsOn(ctx, o, cast = true) { if (!ctx.W.shadows) return; o.traverse((q) => { if (q.isMesh) { q.castShadow = cast; q.receiveShadow = true; } }); }

// ---------- kare kancası: modül ctx.tick'i atasa da bizimkiler çalışır ----------
function onTick(ctx, fn) {
  if (!ctx._ortakTicks) {
    const list = (ctx._ortakTicks = []);
    let user = ctx.tick, busy = false;
    const all = (cam) => {
      if (busy) return; busy = true;
      try { for (const f of list) f(cam); if (user) user(cam); } finally { busy = false; }
    };
    Object.defineProperty(ctx, 'tick', { configurable: true, enumerable: true, get: () => all, set: (f) => { if (f !== all) user = f; } });
  }
  ctx._ortakTicks.push(fn);
}
const camLocal = (ctx, cam) => [cam.x - ctx.d.x, cam.y - ctx.d.y, Math.max(0, cam.h - ctx.d.elev)];

// ---------- terminal ----------
// çatı yüzeyi: çokgen üçgenlenir, uzun kenarlar bölünür (komşu üçgenler aynı kararı verir, çatlak olmaz), yükseklik f(x, y)
function roofMesh(gb, R, f, maxE) {
  let outer = R.map((p) => new THREE.Vector2(p[0], p[1]));
  if (ShapeUtils.isClockWise(outer)) outer = outer.reverse();
  let T; try { T = ShapeUtils.triangulateShape(outer, []); } catch (e) { return null; }
  const V = outer.map((v) => [v.x, v.y]);
  if (maxE) {
    const mid = new Map();
    const M = (a, b) => { const k = a < b ? a + ':' + b : b + ':' + a; let m = mid.get(k); if (m == null) { m = V.length; V.push([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]); mid.set(k, m); } return m; };
    const long = (a, b) => Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1]) > maxE;
    for (let it = 0; it < 7; it++) {
      const N = []; let any = false;
      for (const [a, b, c] of T) {
        const sab = long(a, b), sbc = long(b, c), sca = long(c, a);
        if (!sab && !sbc && !sca) { N.push([a, b, c]); continue; }
        any = true;
        const ab = sab ? M(a, b) : -1, bc = sbc ? M(b, c) : -1, ca = sca ? M(c, a) : -1;
        if (sab && sbc && sca) N.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
        else if (sab && sbc) N.push([a, ab, c], [ab, bc, c], [ab, b, bc]);
        else if (sbc && sca) N.push([a, b, bc], [a, bc, ca], [ca, bc, c]);
        else if (sab && sca) N.push([a, ab, ca], [ab, b, c], [ab, c, ca]);
        else if (sab) N.push([a, ab, c], [ab, b, c]);
        else if (sbc) N.push([a, b, bc], [a, bc, c]);
        else N.push([a, b, ca], [ca, b, c]);
      }
      T = N; if (!any) break;
    }
  }
  const s0 = gb.count, e = 0.8;
  for (const [x, y] of V) {
    const h = f(x, y), fx = (f(x + e, y) - f(x - e, y)) / (2 * e), fy = (f(x, y + e) - f(x, y - e)) / (2 * e), l = Math.hypot(fx, fy, 1);
    gb.vert(x, h, y, -fx / l, 1 / l, -fy / l);
  }
  // ShapeUtils üçgenleri yukarıdan bakınca CCW değil: yukarı bakacak biçimde sırala
  const edges = new Map();
  for (const t of T) {
    let [a, b, c] = t;
    const ar = (V[b][0] - V[a][0]) * (V[c][1] - V[a][1]) - (V[c][0] - V[a][0]) * (V[b][1] - V[a][1]);
    if (ar < 0) { const q = b; b = c; c = q; }
    gb.tri(s0 + a, s0 + b, s0 + c);
    for (const [i, j] of [[a, b], [b, c], [c, a]]) { const k = i < j ? i + ':' + j : j + ':' + i; const o = edges.get(k); if (o) o.n++; else edges.set(k, { i, j, n: 1 }); }
  }
  // sınır kenarları (CCW çevre yönünde: dış taraf sağda)
  const B = [];
  for (const o of edges.values()) if (o.n === 1) B.push([V[o.i], V[o.j]]);
  return B;
}
// opt: { h: yükseklik, roof: 'duz' | 'isiklik' | 'kemer' | 'dalga', overhang, floor: kat yüksekliği, roofCol, roofMat, skyAxis (radyan),
//        skyStep, rise (kemer / dalga yüksekliği), wave (dalga boyu, m), columns (saçak kolonları, varsayılan saçak >= 4 m ise) }
export function terminal(ctx, id, ad, P, opt = {}) {
  const { M, gh } = ctx, O = omats(ctx);
  const h = opt.h || 18, ov = opt.overhang != null ? opt.overhang : 4, fl = opt.floor || 4.5;
  const grp = new THREE.Group();
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.6;
  // cephe: cam (doku: 3 m x kat yüksekliği)
  const glass = new GB(); glass.uv = []; glass._per = 0;
  glass.prism(P, base, h, false);
  for (let k = 0; k < glass.uv.length; k += 2) { glass.uv[k] /= 3.0; glass.uv[k + 1] = (glass.uv[k + 1] - base) / fl; }
  // zemin şeridi (beton)
  const plinth = new GB();
  plinth.prism(inflate(P, 0.15), base, 0.4, false);
  // çatı: saçaklı taban (inflate), alt yüz (saçak altı), kenar bandı, üst yüz f(x, y)
  const R = ov > 0 ? inflate(P, ov) : P;
  const o = obbOf(P);
  let ax = opt.skyAxis != null ? opt.skyAxis : o.ang;
  if (opt.roof === 'kemer' && opt.skyAxis == null && o.L < o.Wd) ax += Math.PI / 2;
  const ux = Math.cos(ax), uy = Math.sin(ax), vx = -uy, vy = ux;
  const [cx, cy] = centroid(R);
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [x, y] of R) { const a = (x - cx) * ux + (y - cy) * uy, b = (x - cx) * vx + (y - cy) * vy; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const T = 1.4, top = h + T;
  const rise = opt.rise || (opt.roof === 'kemer' ? Math.min(o.L, o.Wd) * 0.12 : opt.roof === 'dalga' ? 3.5 : 0);
  const lam = opt.wave || 70;
  let f = () => top, sub = 0;
  if (opt.roof === 'kemer') { const bm = (b0 + b1) / 2, bw = (b1 - b0) / 2; f = (x, y) => { const b = ((x - cx) * vx + (y - cy) * vy - bm) / bw; return top + rise * Math.max(0, 1 - b * b); }; sub = Math.max(6, (b1 - b0) / 14); }
  else if (opt.roof === 'dalga') { f = (x, y) => { const a = (x - cx) * ux + (y - cy) * uy - a0; return top + rise * (0.5 - 0.5 * Math.cos(a / lam * Math.PI * 2)); }; sub = Math.min(lam / 3, 30); }
  const roof = new GB(), soffit = new GB(), fascia = roof;   // kenar bandı çatıyla aynı örgü ve malzeme
  const edge = roofMesh(roof, R, f, sub) || [];
  soffit.prism(R, h, h, false, true);
  for (const [A, B] of edge) {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 0.01) continue;
    const nx = (B[1] - A[1]) / L, ny = -(B[0] - A[0]) / L;     // CCW: dış taraf sağda
    const s = fascia.count;
    fascia.vert(A[0], h - 0.3, A[1], nx, 0, ny); fascia.vert(B[0], h - 0.3, B[1], nx, 0, ny);
    fascia.vert(B[0], f(B[0], B[1]) + 0.25, B[1], nx, 0, ny); fascia.vert(A[0], f(A[0], A[1]) + 0.25, A[1], nx, 0, ny);
    fascia.quad(s, s + 1, s + 2, s + 3);
  }
  // çatı ışıklıkları ve donanım
  const sky = new GB(), equip = new GB();
  const inside = (x, y, m) => pip(P, x, y) && nearestEdge(P, x, y).d > m;
  if (opt.roof === 'isiklik' || opt.roof === 'dalga' || opt.roof === 'kemer') {
    const step = opt.skyStep || 36;
    const rows = [];
    if (opt.roof === 'kemer') rows.push((b0 + b1) / 2);
    else for (let b = b0 + step / 2; b < b1; b += step) rows.push(b);
    const W = opt.roof === 'kemer' ? Math.min(12, (b1 - b0) * 0.12) : 5;
    for (const b of rows) {
      let run = null;
      for (let a = a0; a <= a1 + 8; a += 6) {
        const x = cx + ux * a + vx * b, y = cy + uy * a + vy * b;
        const ins = a <= a1 && inside(x, y, 8);
        if (ins && run === null) run = a;
        if (!ins && run !== null) {
          if (a - run > 18) {
            // ışıklık: çatıyı izleyen üçgen kesitli cam sırt (testere dişi değil, çift eğimli)
            const n = Math.max(1, Math.ceil((a - run) / 6));
            for (let k = 0; k < n; k++) {
              const t0 = run + (a - run) * k / n, t1 = run + (a - run) * (k + 1) / n;
              const pt = (t, sd, up) => { const x2 = cx + ux * t + vx * (b + sd * W / 2), y2 = cy + uy * t + vy * (b + sd * W / 2); return [x2, y2, f(x2, y2) + 0.15 + up]; };
              const rh = opt.roof === 'kemer' ? 0.9 : 1.4;
              const r0 = (t) => { const x2 = cx + ux * t + vx * b, y2 = cy + uy * t + vy * b; return [x2, y2, f(x2, y2) + 0.15 + rh]; };
              face(sky, [pt(t0, -1, 0), pt(t1, -1, 0), r0(t1), r0(t0)], [-vx * 0.6, -vy * 0.6, 0.8]);
              face(sky, [pt(t0, 1, 0), r0(t0), r0(t1), pt(t1, 1, 0)], [vx * 0.6, vy * 0.6, 0.8]);
            }
          }
          run = null;
        }
      }
    }
  }
  if (opt.roof !== 'dalga') {
    // klima ve havalandırma kutuları (konuma göre kararlı)
    const area = (o.L * o.Wd) || 1, n = Math.min(80, Math.floor(area / 2500));
    for (let k = 0; k < n * 3 && equip.count < n * 24; k++) {
      const x = cx + (hash1(k, cx) - 0.5) * o.L, y = cy + (hash1(cy, k) - 0.5) * o.Wd;
      if (!inside(x, y, 10)) continue;
      const big = hash1(x, y) < 0.3;
      equip.box(x, y, f(x, y), big ? 9 : 4, big ? 5 : 3, big ? 2.6 : 1.6, ax);
    }
  }
  // saçak kolonları
  const cols = soffit;   // kolonlar saçak altıyla aynı örgüde (tek çizim çağrısı)
  if ((opt.columns != null ? opt.columns : ov >= 5) && ov > 1.5) {
    const C = inflate(P, ov - 1.0);
    for (let i = 0; i < C.length; i++) {
      const [px, py] = C[i], [qx, qy] = C[(i + 1) % C.length], L = Math.hypot(qx - px, qy - py);
      const n = Math.floor(L / 18);
      for (let k = 0; k <= n; k++) { if (k === n && n > 0) continue; const t = n ? k / n : 0, x = px + (qx - px) * t, y = py + (qy - py) * t; cols.lathe(x, y, [[0.45, 0], [0.45, h - base]], 6, base); }
    }
  }
  const mk = (gb, mat, name) => { if (!gb.count) return; const m = mesh(gb, mat, name); grp.add(m); };
  mk(glass, O.glass, 'cephe'); mk(plinth, M.conc, 'zemin'); mk(roof, opt.roofMat || O.roof, 'cati');
  mk(soffit, M.white, 'sacak'); mk(sky, O.sky, 'isiklik'); mk(equip, M.metal, 'cati-donanim');
  grp.userData = { id, ad, taban: P, yukseklik: h, katYuksekligi: fl, kotu: base };
  grp.matrixAutoUpdate = false;
  return ctx.part('terminal:' + id, grp);
}

// kule çarpışması (yeniden kurulunca çoğalmasın)
function addCol(ctx, c) {
  const W = ctx.W, k = Math.round(c.x) + ':' + Math.round(c.y);
  W._apCol = W._apCol || new Set();
  if (W._apCol.has(k)) return; W._apCol.add(k); W.lmCol.push(c);
}
// ---------- kuleler ----------
// kabin: dışa eğik cam (alttan üste %12 açılır), kayıtlar, dış yürüme yolu, çatı, antenler, radar kubbesi, engel ışıkları
function cabin(sh, cab, lamp, x, y, z0, r, n, hg, opt = {}) {
  const P = (rr, k) => [x + Math.cos(k / n * Math.PI * 2 + 0.2) * rr, y + Math.sin(k / n * Math.PI * 2 + 0.2) * rr];
  const r1 = r * 1.12;
  // alt döşeme ve yürüme yolu
  sh.lathe(x, y, [[r * 0.82, -0.6], [r + 1.1, -0.2], [r + 1.1, 0.2], [r * 0.95, 0.25]], n, z0);
  // eğik cam yüzler
  for (let k = 0; k < n; k++) {
    const [ax, ay] = P(r, k), [bx, by] = P(r, k + 1), [cx2, cy2] = P(r1, k + 1), [dx, dy] = P(r1, k);
    const m = (k + 0.5) / n * Math.PI * 2 + 0.2;
    face(cab, [[ax, ay, z0 + 0.25], [bx, by, z0 + 0.25], [cx2, cy2, z0 + hg], [dx, dy, z0 + hg]], [Math.cos(m) * 0.95, Math.sin(m) * 0.95, -0.3]);
    // kayıt (dikey)
    sbox(sh, [ax, ay, z0 + 0.25], [dx + (ax - x) * 0.001, dy + (ay - y) * 0.001, z0 + hg], 0.18, 0.12);
  }
  // çatı: saçak ve kat
  sh.lathe(x, y, [[r1 + 0.6, hg], [r1 + 0.6, hg + 0.7], [r1 * 0.9, hg + 1.1], [r * 0.7, hg + 1.3], [0.05, hg + 1.35]], n, z0);
  // antenler ve radar kubbesi
  const tz = z0 + hg + 1.35;
  const ant = opt.antennas || [[0, 0, 9], [r * 0.45, 0.6, 4.5], [r * 0.5, 2.4, 3.2], [r * 0.4, 4.0, 5.5]];
  for (const [ar, aa, ah] of ant) { const ax = x + Math.cos(aa) * ar, ay = y + Math.sin(aa) * ar; sh.box(ax, ay, tz, 0.22, 0.22, ah, 0); lamp.box(ax, ay, tz + ah, 0.45, 0.45, 0.45, 0); paint(lamp, lamp.count - 20, [1, 0.12, 0.08]); }
  sh.lathe(x + r * 0.35, y - r * 0.35, [[0.9, 0], [1.25, 0.6], [1.2, 1.4], [0.7, 2.0], [0.05, 2.25]], 10, tz);
  return tz;
}
function towerGroup(ctx, parts) {
  const grp = new THREE.Group();
  for (const [gb, mat, nm] of parts) if (gb.count) grp.add(mesh(gb, mat, nm));
  grp.matrixAutoUpdate = false;
  return grp;
}
// lale biçimli kule (İstanbul Havalimanı kulesinden esinlenen kendi geometrimiz): ince gövde yukarıda açılıp taç yaprakları gibi
// kabini sarar; gövdede burgulu altı kanat
export function towerTulip(ctx, x, y, H = 90) {
  const { M, gh } = ctx, O = omats(ctx);
  const base = gh(x, y) - 0.5, S = H / 90;
  const shell = new GB(), cab = new GB(), dark = new GB(), lamp = CB();
  const prof = [[10, 0], [8.2, 8], [6.4, 20], [5.6, 34], [5.4, 46], [6.2, 56], [8.2, 64], [10.6, 71], [12.0, 76.5], [12.4, 77]];
  const seg = 48, P = prof.length;
  const s0 = shell.count;
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2;
    for (let j = 0; j < P; j++) {
      const [r0, h] = prof[j];
      const tw = a + h * 0.018;
      const r = r0 * (1 + 0.08 * Math.cos(6 * tw)) * S;
      shell.vert(x + Math.cos(a) * r, base + h * S, y + Math.sin(a) * r, Math.cos(a), 0.15, Math.sin(a));
    }
  }
  for (let k = 0; k < seg; k++) for (let j = 0; j < P - 1; j++) { const a = s0 + k * P + j, b = a + P; shell.quad(a, b, b + 1, a + 1); }
  // taç yapraklarının arasındaki koyu oluklar (gövdede altı ince camlı yarık)
  for (let k = 0; k < 6; k++) {
    for (let j = 1; j < 7; j++) {
      const h0 = prof[j][1], h1 = prof[j + 1][1];
      const a0 = (k / 6) * Math.PI * 2 + Math.PI / 6 - h0 * 0.018, a1 = (k / 6) * Math.PI * 2 + Math.PI / 6 - h1 * 0.018;
      const r0 = prof[j][0] * 0.93 * S + 0.05, r1 = prof[j + 1][0] * 0.93 * S + 0.05;
      const w = 0.07;
      face(dark, [[x + Math.cos(a0 - w) * r0, y + Math.sin(a0 - w) * r0, base + h0 * S], [x + Math.cos(a0 + w) * r0, y + Math.sin(a0 + w) * r0, base + h0 * S],
        [x + Math.cos(a1 + w) * r1, y + Math.sin(a1 + w) * r1, base + h1 * S], [x + Math.cos(a1 - w) * r1, y + Math.sin(a1 - w) * r1, base + h1 * S]], [Math.cos(a0), Math.sin(a0), 0]);
    }
  }
  const top = base + 77 * S;
  const tz = cabin(shell, cab, lamp, x, y, top, 11.6 * S, 16, 6.2 * S, { antennas: [[0, 0, 12 * S], [5 * S, 0.6, 5], [5.5 * S, 2.4, 3.5], [4.5 * S, 4.0, 6]] });
  // gövde üstünde iki engel ışığı
  for (const a of [0.4, 3.5]) { lamp.box(x + Math.cos(a) * 12.1 * S, y + Math.sin(a) * 12.1 * S, top - 2, 0.5, 0.5, 0.5, 0); paint(lamp, lamp.count - 20, [1, 0.12, 0.08]); }
  // ayakta giriş binası
  dark.lathe(x, y, [[10.3 * S, 0], [10.3 * S, 4.2], [9.5 * S, 4.4]], 24, base);
  const grp = towerGroup(ctx, [[shell, M.white, 'govde'], [cab, O.cab, 'kabin'], [dark, O.cab, 'cam'], [lamp, O.lamp, 'isik']]);
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 13 * S, top: ctx.d.elev + tz + 12 * S });
  return ctx.part('kule', grp);
}
// modern kule: üçgen kesitli beton gövde, gövdede merdiven camı, çıkıntılı teknik kat ve eğik camlı kabin, alçak giriş binası
export function towerModern(ctx, x, y, H = 70, rot = 0, name = 'kule') {
  const { M, gh } = ctx, O = omats(ctx);
  const base = gh(x, y) - 0.5;
  const shaft = new GB(), cab = new GB(), dark = new GB(), lamp = CB();
  const sc = clamp(H / 70, 0.6, 1.4);
  const tri = (r, a0) => [0, 1, 2].map((k) => [x + Math.cos(a0 + k * 2.094) * r, y + Math.sin(a0 + k * 2.094) * r]);
  const ring = (r, n, a0 = rot) => Array.from({ length: n }, (_, k) => [x + Math.cos(a0 + k / n * Math.PI * 2) * r, y + Math.sin(a0 + k / n * Math.PI * 2) * r]);
  const zc = base + H - 9 * sc;            // kabin tabanı
  shaft.prism(tri(4.6 * sc, rot), base, zc - 4 * sc);
  // köşelerde yuvarlak ayaklar
  for (const [px, py] of tri(4.0 * sc, rot)) shaft.lathe(px, py, [[1.5 * sc, 0], [1.5 * sc, zc - 4 * sc - base]], 10, base);
  // merdiven camı (her yüzde dikey koyu şerit)
  for (let k = 0; k < 3; k++) {
    const a = rot + k * 2.094 + 1.047, r = 4.6 * sc * 0.5 + 0.06;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    dark.box(px, py, base + 6, 0.12, 1.4 * sc, zc - base - 12 * sc, a);
  }
  // teknik kat
  shaft.prism(ring(6.8 * sc, 10), zc - 4 * sc, zc - 0.6);
  dark.prism(ring(6.9 * sc, 10), zc - 3.0 * sc, zc - 1.6 * sc, false);
  const tz = cabin(shaft, cab, lamp, x, y, zc, 7.2 * sc, 10, 5.0 * sc);
  // giriş binası
  shaft.box(x - Math.cos(rot) * 9 * sc, y - Math.sin(rot) * 9 * sc, base, 22 * sc, 14 * sc, 7.5, rot);
  dark.box(x - Math.cos(rot) * 9 * sc, y - Math.sin(rot) * 9 * sc, base + 1, 22.2 * sc, 14.2 * sc, 2.4, rot);
  const grp = towerGroup(ctx, [[shaft, M.white, 'govde'], [cab, O.cab, 'kabin'], [dark, O.cab, 'teknik'], [lamp, O.lamp, 'isik']]);
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 9 * sc, top: ctx.d.elev + tz + 9 });
  return ctx.part(name, grp);
}
// klasik kule: silindir gövde, geniş sekizgen kabin, altında teknik kat, ayakta iki katlı blok
export function towerClassic(ctx, x, y, H = 45) {
  const { M, gh } = ctx, O = omats(ctx);
  const base = gh(x, y) - 0.5;
  const shaft = new GB(), cab = new GB(), dark = new GB(), lamp = CB();
  const zc = base + H - 7;
  shaft.lathe(x, y, [[4.2, 0], [3.6, zc - base - 5]], 16, base);
  shaft.lathe(x, y, [[3.6, zc - base - 5], [6.2, zc - base - 3], [6.2, zc - base - 0.6]], 8, base);
  dark.lathe(x, y, [[6.25, zc - base - 2.6], [6.25, zc - base - 1.4]], 8, base);
  // gövdede pencere sırası
  for (let z = base + 6; z < zc - 7; z += 3.2) dark.lathe(x, y, [[3.68 - (z - base) * 0.6 / (zc - base), z - base], [3.68 - (z - base) * 0.6 / (zc - base), z - base + 0.9]], 16, base);
  const tz = cabin(shaft, cab, lamp, x, y, zc, 5.6, 8, 4.2);
  shaft.box(x + 9, y, base, 18, 12, 7.5, 0);
  dark.box(x + 9, y, base + 1.2, 18.2, 12.2, 1.6, 0); dark.box(x + 9, y, base + 4.6, 18.2, 12.2, 1.6, 0);
  const grp = towerGroup(ctx, [[shaft, M.conc, 'govde'], [cab, O.cab, 'kabin'], [dark, O.cab, 'cam'], [lamp, O.lamp, 'isik']]);
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 8, top: ctx.d.elev + tz + 9 });
  return ctx.part('kule', grp);
}

// ---------- park etmiş yolcu uçakları (markasız, gerçek oranlı) ----------
// n: dar gövde (A320 / B737 sınıfı: 37.6 m boy, 35.8 m açıklık, 3.95 m gövde), w: geniş gövde (çift motorlu, 63.7 m, 60.9 m, 6.1 m)
// Ölçüler: s burundan uzaklık, yc gövde ekseni yüksekliği, sill kapı eşiği (köprü kabini buraya oturur), doors kapıların s'si.
export const AC_TYPES = {
  n: { L: 37.6, R: 1.98, yc: 3.9, sill: 3.35, nose: 6.2, tail: 12.5, doors: [5.2], win: [6.4, 27.0],
    wing: { s: 13.4, root: 6.3, kink: 6.4, tip: 1.55, span: 17.9, sweep: 8.4, y: -0.62, dih: 0.092, th: 0.13 }, winglet: 2.4,
    eng: { s: 11.3, len: 4.4, r: 1.02, z: 5.75, y: 1.75 }, fin: { s: 29.6, root: 6.0, tip: 1.9, h: 5.9, sweep: 4.8 }, stab: { s: 32.2, root: 3.4, tip: 1.2, span: 6.2, sweep: 3.0, y: 0.35 },
    gear: { nose: 5.2, main: 17.8, track: 3.8, wr: 0.57, nw: 2, axles: 1 } },
  w: { L: 63.7, R: 3.05, yc: 5.55, sill: 4.8, nose: 9.5, tail: 18.5, doors: [8.6, 20.5], win: [9.8, 50.0],
    wing: { s: 23.5, root: 11.5, kink: 9.5, tip: 2.4, span: 30.4, sweep: 17.5, y: -0.6, dih: 0.1, th: 0.12 }, winglet: 0,
    eng: { s: 20.0, len: 7.0, r: 1.85, z: 9.7, y: 2.95 }, fin: { s: 49.5, root: 10.0, tip: 3.1, h: 9.2, sweep: 7.8 }, stab: { s: 54.0, root: 6.2, tip: 2.0, span: 10.8, sweep: 5.6, y: 0.6 },
    gear: { nose: 7.6, main: 34.0, track: 5.5, wr: 0.68, nw: 2, axles: 3 } },
};
// uçak örgüsü (three yerel: +X burun, +Y yukarı, +Z sağ kanat); öznitelikler: color, uv (pencere dokusu), liv (kuyruk rengi payı)
class AB {
  constructor() { this.p = []; this.c = []; this.uv = []; this.l = []; this.i = []; }
  get count() { return this.p.length / 3; }
  v(x, y, z, col, u = 0, w = 0, liv = 0) { this.p.push(x, y, z); this.c.push(col[0], col[1], col[2]); this.uv.push(u, w); this.l.push(liv); return this.count - 1; }
  // dörtgen: hint dışa bakan yön (yaklaşık)
  q(a, b, c, d, hint) {
    const P = this.p, ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
    const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] >= 0) this.i.push(a, b, c, a, c, d); else this.i.push(a, d, c, a, c, b);
  }
  t(a, b, c, hint) {
    const P = this.p, ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
    const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  // döner cisim: merkez o, eksen e (birim), dik u, v; profil [[d (eksen boyunca), r, renk]]
  rev(o, e, u, w, prof, seg, liv = 0) {
    const s0 = this.count, n = prof.length;
    for (let k = 0; k <= seg; k++) {
      const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const dx = u[0] * c + w[0] * s, dy = u[1] * c + w[1] * s, dz = u[2] * c + w[2] * s;
      for (const [d, r, col] of prof) this.v(o[0] + e[0] * d + dx * r, o[1] + e[1] * d + dy * r, o[2] + e[2] * d + dz * r, col, 0, 0, liv);
    }
    for (let j = 0; j < n - 1; j++) {
      const dd = prof[j + 1][0] - prof[j][0], dr = prof[j + 1][1] - prof[j][1];
      if (Math.abs(dd) + Math.abs(dr) < 1e-6) continue;
      // profilin normali (yürüyüş yönünü +90° döndür): eksenel -dr, radyal +dd
      for (let k = 0; k < seg; k++) {
        const a = (k + 0.5) / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const rx = u[0] * c + w[0] * s, ry = u[1] * c + w[1] * s, rz = u[2] * c + w[2] * s;
        const h = [-e[0] * dr + rx * dd, -e[1] * dr + ry * dd, -e[2] * dr + rz * dd];
        const A = s0 + k * n + j, B = A + n; this.q(A, A + 1, B + 1, B, h);
      }
    }
  }
  box(cx, cy, cz, lx, ly, lz, col) {
    const s0 = this.count;
    for (let k = 0; k < 8; k++) this.v(cx + (k & 1 ? lx : -lx) / 2, cy + (k & 2 ? ly : -ly) / 2, cz + (k & 4 ? lz : -lz) / 2, col);
    const F = [[0, 1, 3, 2, [0, 0, -1]], [4, 6, 7, 5, [0, 0, 1]], [0, 4, 5, 1, [0, -1, 0]], [2, 3, 7, 6, [0, 1, 0]], [0, 2, 6, 4, [-1, 0, 0]], [1, 5, 7, 3, [1, 0, 0]]];
    for (const [a, b, c, d, h] of F) this.q(s0 + a, s0 + b, s0 + c, s0 + d, h);
  }
  geometry() {
    // sert kenarlar için üçgen başına normal yerine köşe normali: önce dizinsiz değil, dizinli ortalama
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('liv', new THREE.Float32BufferAttribute(this.l, 1));
    g.setIndex(this.i);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
const C_W = [0.94, 0.94, 0.95], C_BELLY = [0.8, 0.81, 0.83], C_DK = [0.07, 0.09, 0.11], C_WING = [0.8, 0.81, 0.83], C_WINGL = [0.66, 0.67, 0.7];
const C_MET = [0.62, 0.63, 0.66], C_FAN = [0.12, 0.12, 0.13], C_TIRE = [0.08, 0.08, 0.08], C_GEAR = [0.55, 0.56, 0.58];
// kanat profili kesitleri boyunca örgü; secs: [{x (hücum kenarı, three x), y, z, c (veter), t (kalınlık oranı)}], kalınlık ekseni ax ('y' ya da 'z')
function foil(ab, secs, ax, colTop, colBot, liv, xs) {
  const X = xs || [0, 0.03, 0.12, 0.3, 0.55, 0.8, 1];
  const half = (x) => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const ring = [];
  for (const x of X) ring.push([x, 1]);
  for (let k = X.length - 2; k >= 1; k--) ring.push([X[k], -1]);
  const n = ring.length, s0 = ab.count;
  for (const S of secs) for (const [xc, sd] of ring) {
    const d = half(xc) * S.t * S.c * (sd > 0 ? 1.1 : 0.8) * sd;
    const px = S.x - xc * S.c;
    if (ax === 'y') ab.v(px, S.y + d, S.z, sd > 0 ? colTop : colBot, 0, 0, liv); else ab.v(px, S.y, S.z + d, colTop, 0, 0, liv);
  }
  for (let j = 0; j < secs.length - 1; j++) for (let k = 0; k < n; k++) {
    const a = s0 + j * n + k, b = s0 + j * n + (k + 1) % n, c = b + n, d = a + n;
    const sd = ring[k][1], h = ax === 'y' ? [0, sd, 0] : [0, 0, sd];
    if (ring[k][0] === 0 && ring[(k + 1) % n][0] !== 0) h[0] = 0.3;
    ab.q(a, b, c, d, h);
  }
  // uç kapağı
  const j = secs.length - 1, A = secs[j], B = secs[j - 1];
  const hint = [A.x - B.x, A.y - B.y, A.z - B.z];
  for (let k = 1; k < n - 1; k++) ab.t(s0 + j * n, s0 + j * n + k, s0 + j * n + k + 1, hint);
}
function buildAirliner(T, lo) {
  const ab = new AB();
  const { L, R, yc } = T, X = (s) => L / 2 - s;
  // ---- gövde: halkalar (s, r, dy, pencere bandı) ----
  const rings = [];
  const ns = lo ? [0, 0.6, 2.0, 4.0] : [0, 0.2, 0.7, 1.5, 2.5, 3.6, 4.9];
  for (const s0 of ns) { const t = Math.min(1, s0 / T.nose); rings.push([s0 * T.nose / 6.2, Math.max(0.06, R * Math.pow(1 - (1 - t) ** 2.3, 0.5)), -0.38 * R * (1 - t) ** 2, 0]); }
  rings.push([T.nose, R, 0, 0]);
  if (!lo) { rings.push([T.win[0], R, 0, 0], [T.win[0], R, 0, 1], [T.win[1], R, 0, 1], [T.win[1], R, 0, 0]); }
  const ts = L - T.tail;
  const tl = lo ? [0, 0.35, 0.7, 1] : [0, 0.2, 0.42, 0.64, 0.84, 0.96, 1];
  for (const t of tl) rings.push([ts + t * T.tail, R - (R - 0.3 * R / 1.98) * Math.pow(t, 1.15), (R * 0.68) * Math.pow(t, 1.35), 0]);
  // halka açıları: alttan başlar (dikiş altta), pencere bandı kenarları eklenir
  const seg = lo ? 12 : 18, A = [];
  for (let k = 0; k <= seg; k++) A.push(-Math.PI / 2 + k / seg * Math.PI * 2);
  const yb0 = 0.18, yb1 = 0.84;   // pencere bandı (eksenden yukarı, m)
  if (!lo) { const a0 = Math.asin(yb0 / R), a1 = Math.asin(yb1 / R); A.push(a0, a1, Math.PI - a0, Math.PI - a1); A.sort((p, q) => p - q); }
  const n = A.length, s0 = ab.count;
  for (const [s, r, dy, band] of rings) for (const a of A) {
    const sa = Math.sin(a), ca = Math.cos(a);
    const y = yc + dy + sa * r, z = ca * r;
    let col = sa < -0.55 ? C_BELLY : C_W;
    if (s > 1.7 && s < 3.4 && sa > 0.18 && sa < 0.62 && Math.abs(ca) < 0.8) col = C_DK;       // kokpit camları
    if (s < 0.5) col = [0.86, 0.86, 0.87];
    let w = 0;
    if (band) { const yy = sa * r; w = yy <= yb0 + 1e-4 ? 0 : yy >= yb1 - 1e-4 ? 1 : (yy - yb0) / (yb1 - yb0); if (Math.abs(ca) < 0.05) w = 1; }
    ab.v(X(s), y, z, col, s / 0.53, band ? w : 0);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < n - 1; k++) {
    const a = s0 + j * n + k, b = a + n, h = [0, Math.sin((A[k] + A[k + 1]) / 2), Math.cos((A[k] + A[k + 1]) / 2)];
    ab.q(a, a + 1, b + 1, b, h);
  }
  // kokpit camlarının kenarı için ince koyu çerçeve gerekmez; burun ucu kapalı (r 0.06)
  // ---- kanatlar ----
  const Wg = T.wing, wy = yc + Wg.y * R;
  const xs = lo ? [0, 0.3, 1] : null;
  for (const sd of [1, -1]) {
    const z0 = R * 0.6, zk = Wg.kink * 0.95, zt = Wg.span;
    const sec = (z, x, c, t) => ({ x, y: wy + (z - z0) * Wg.dih, z: z * sd, c, t });
    const xr = X(Wg.s), xk = xr - (zk - z0) / (zt - z0) * Wg.sweep, xt = xr - Wg.sweep;
    const ck = Wg.root - (Wg.root - Wg.tip) * 0.25 - (xr - xk) * 0.25;
    foil(ab, [sec(z0, xr, Wg.root, Wg.th), sec(zk, xk, ck + (xr - xk) * 0.0, Wg.th * 0.82), sec(zt, xt, Wg.tip, Wg.th * 0.7)], 'y', C_WING, C_WINGL, 0, xs);
    if (T.winglet && !lo) { const ty = wy + (zt - z0) * Wg.dih; foil(ab, [{ x: xt, y: ty, z: zt * sd, c: Wg.tip, t: 0.1 }, { x: xt - 1.2, y: ty + T.winglet, z: (zt + 0.35) * sd, c: Wg.tip * 0.55, t: 0.1 }], 'z', [1, 1, 1], [1, 1, 1], 1); }
    // yatay kuyruk
    const S = T.stab, sy = yc + S.y * R;
    foil(ab, [{ x: X(S.s), y: sy, z: 0.4 * sd, c: S.root, t: 0.1 }, { x: X(S.s) - S.sweep, y: sy + S.span * 0.06, z: S.span * sd, c: S.tip, t: 0.09 }], 'y', C_WING, C_WINGL, 0, xs);
    // motor: kaporta, fan yüzü, göbek, lüle
    const E = T.eng, ez = E.z * sd, ex = X(E.s), r = E.r;
    const prof = lo ? [[0.05, 0.85 * r, C_FAN], [0, 0.93 * r, C_MET], [0.6, r, C_W], [E.len * 0.65, 0.95 * r, C_W], [E.len, 0.62 * r, C_MET], [E.len + 0.7, 0.1, C_MET]]
      : [[0.25, 0.02, C_FAN], [0.55, 0.85 * r, C_FAN], [0.02, 0.92 * r, C_MET], [0.3, r, C_W], [E.len * 0.62, 0.96 * r, C_W], [E.len * 0.85, 0.74 * r, C_W], [E.len * 0.85, 0.6 * r, C_MET], [E.len + 0.9 * r / 1.02, 0.08, [0.4, 0.4, 0.42]]];
    ab.rev([ex, E.y, ez], [-1, 0, 0], [0, 0, 1], [0, 1, 0], prof, lo ? 8 : 12);
    // pilon
    const py0 = E.y + r * 0.8, py1 = wy + (Math.abs(ez) - z0) * Wg.dih - 0.1;
    ab.box(ex - E.len * 0.55, (py0 + py1) / 2 + 0.2, ez, E.len * 0.9, Math.max(0.6, py1 - py0 + 0.6), 0.45, C_W);
  }
  // ---- dikey kuyruk (kuyruk rengi) ----
  const F = T.fin, fy = yc + R * 0.55;
  foil(ab, [{ x: X(F.s), y: fy, z: 0, c: F.root, t: 0.11 }, { x: X(F.s) - 0.3, y: yc + R * 0.95, z: 0, c: F.root * 0.97, t: 0.11 }, { x: X(F.s) - F.sweep, y: yc + R + F.h, z: 0, c: F.tip, t: 0.1 }], 'z', [1, 1, 1], [1, 1, 1], 1, xs);
  // kuyruk konisi üstü (sırt yüzgeci)
  if (!lo) {
    // APU egzozu
    ab.rev([X(L - 0.05), yc + R * 0.68, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], [[0, 0.02, C_FAN], [0.01, 0.2, C_FAN], [0.4, 0.27, C_MET]], 8);
    // iniş takımları: ön (iki tekerlek), ana (tek ya da üç dingilli boji)
    const G = T.gear, bot = yc - R;
    const wheel = (x, z, r, w) => ab.rev([x, r, z - w / 2], [0, 0, 1], [1, 0, 0], [0, 1, 0], [[0, 0.02, C_GEAR], [0, r, C_TIRE], [w, r, C_TIRE], [w, 0.02, C_GEAR]], 8);
    ab.box(X(G.nose), (bot + 0.4) / 2 + 0.2, 0, 0.22, bot + 0.2, 0.22, C_GEAR);
    for (const sd of [-1, 1]) wheel(X(G.nose), sd * 0.32, 0.4, 0.26);
    for (const sd of [-1, 1]) {
      const z = sd * G.track, gx = X(G.main);
      const wy0 = yc + Wg.y * R;
      ab.box(gx, (wy0 + G.wr) / 2, z, 0.32, wy0 - G.wr + 0.3, 0.32, C_GEAR);
      const ax = G.axles === 1 ? [0] : [-1.45, 0, 1.45];
      if (G.axles > 1) ab.box(gx, G.wr, z, 3.4, 0.25, 0.3, C_GEAR);
      for (const dx of ax) for (const zz of [-0.45, 0.45]) wheel(gx + dx, z + zz * (G.axles > 1 ? 1.45 : 1.0), G.wr, 0.38);
    }
    // gövde altı kanat-gövde birleşimi (karın kaportası)
    ab.box(X(Wg.s + Wg.root * 0.45), yc - R * 0.72, 0, Wg.root * 1.2, R * 0.55, R * 1.35, C_BELLY);
  }
  return ab.geometry();
}
let ACG = null;
function airlinerSet() {
  if (ACG) return ACG;
  ACG = {};
  for (const k of ['n', 'w']) ACG[k] = { hi: buildAirliner(AC_TYPES[k], false), lo: buildAirliner(AC_TYPES[k], true) };
  return ACG;
}
let ACM = null;
function airlinerMat(ctx) {
  if (ACM && ACM.W === ctx.W) return ACM.m;
  // pencere dokusu: u = 0.53 m'lik pencere aralığı, v = pencere bandı; kenar satırlar beyaz (bant dışı)
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#1a2129'; g.beginPath();
  if (g.roundRect) g.roundRect(9, 7, 14, 18, 6); else g.rect(9, 7, 14, 18);
  g.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const env = ctx.W.envMap ? ctx.W.envMap() : null;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: t, metalness: 0.3, roughness: 0.38, envMap: env, envMapIntensity: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float liv;\n' + sh.vertexShader.replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      vColor *= color;
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz = mix(vColor.xyz, vColor.xyz * instanceColor.xyz, liv);
      #endif`);
  };
  m.customProgramCacheKey = () => 'ucak-liv';
  ACM = { W: ctx.W, m };
  return m;
}
// park yerlerine uçak koy; her yerin s.ac'si: { x, y, hx, hy, L, sc, type, T } (uçak merkezi, burun yönü)
// opt: { occ: doluluk, hiR: ayrıntılı çizim uzaklığı (m) }
export function parkedAircraft(ctx, opt = {}) {
  const { d, grp } = ctx;
  const S = ctx.stands || stands(d);
  const occ = opt.occ != null ? opt.occ : 0.6;
  const pick = S.filter((s) => !s.pt && hash1(s.x, s.y) < (s.gate ? occ + 0.2 : occ));
  if (!pick.length) return [];
  const G = airlinerSet(), mat = airlinerMat(ctx);
  const recs = { n: [], w: [] };
  const o = new THREE.Object3D(), col = new THREE.Color();
  for (const s of pick) {
    const type = s.space > 62 && hash1(s.y, s.x) < 0.45 ? 'w' : 'n', T = AC_TYPES[type];
    const hx = s.ux || 1, hy = s.uy || 0, L = T.L;
    const cx = s.x - hx * (L / 2 + 2), cy = s.y - hy * (L / 2 + 2);
    o.position.set(cx, 0.12, -cy); o.rotation.set(0, Math.atan2(hy, hx), 0); o.scale.set(1, 1, 1); o.updateMatrix();
    col.setHex(TAILS[Math.floor(hash1(s.x + 3, s.y) * TAILS.length)]);
    s.ac = { x: cx, y: cy, hx, hy, L, sc: L / 37.6, type, T };
    recs[type].push({ m: o.matrix.clone(), c: col.clone(), x: cx, y: cy });
  }
  const meshes = [];
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const s of pick) { bx0 = Math.min(bx0, s.ac.x); by0 = Math.min(by0, s.ac.y); bx1 = Math.max(bx1, s.ac.x); by1 = Math.max(by1, s.ac.y); }
  const sphere = new THREE.Sphere(new THREE.Vector3((bx0 + bx1) / 2, 10, -(by0 + by1) / 2), Math.hypot(bx1 - bx0, by1 - by0) / 2 + 70);
  const sets = [];
  for (const k of ['n', 'w']) {
    const R = recs[k]; if (!R.length) continue;
    const hi = new THREE.InstancedMesh(G[k].hi, mat, R.length), lo = new THREE.InstancedMesh(G[k].lo, mat, R.length);
    hi.name = 'ucaklar-yakin'; lo.name = 'ucaklar-uzak';
    for (const m of [hi, lo]) { m.matrixAutoUpdate = false; m.boundingSphere = sphere; m.setColorAt(0, R[0].c); grp.add(m); meshes.push(m); shadowsOn(ctx, m); }
    sets.push({ R, hi, lo, sig: '' });
  }
  const hiR = opt.hiR || 520;
  const place = (cam) => {
    const [x, y, hh] = cam ? camLocal(ctx, cam) : [1e9, 1e9, 0];
    const far = cam && Math.hypot(x, y, hh * 0.5) > 7500;
    for (const st of sets) {
      if (far) { st.hi.visible = st.lo.visible = false; st.sig = ''; continue; }
      let sig = '', nh = 0, nl = 0;
      const near = st.R.map((r) => Math.hypot(r.x - x, r.y - y, hh) < hiR);
      for (const q of near) sig += q ? '1' : '0';
      if (sig === st.sig) continue;
      st.sig = sig;
      st.R.forEach((r, i) => { const m = near[i] ? st.hi : st.lo, j = near[i] ? nh++ : nl++; m.setMatrixAt(j, r.m); m.setColorAt(j, r.c); });
      st.hi.count = nh; st.lo.count = nl;
      for (const m of [st.hi, st.lo]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.visible = m.count > 0; }
    }
  };
  place(null);
  let fr = 0;
  onTick(ctx, (cam) => { if (fr++ % 8 === 0) place(cam); });
  return pick;
}

// ---------- yolcu köprüleri ----------
// Rotunda terminal cephesinden çıkar (cephe uzaksa sabit geçitle bağlanır), teleskopik tüneller (kabin ucundaki en büyük)
// rotundadan kabine eğimle iner/çıkar; kabin uçağın sol ön kapısına, gövdeye paralel oturur; yürüyen ayak kabine yakın.
// Uçak yoksa köprü geri çekilmiş durur. opt: { h0: terminal kapı kotu (m), glass: camlı tünel, max: en uzun tünel (m) }
const BR_MET = [0.8, 0.81, 0.82], BR_TOP = [0.66, 0.67, 0.69], BR_DK = [0.2, 0.22, 0.24], BR_GL = [0.22, 0.3, 0.36], BR_TIRE = [0.07, 0.07, 0.07], BR_COL = [0.55, 0.56, 0.57];
function bridge(gb, F, ac, T, door, opt, rot) {
  const h0 = opt.h0 || 4.6, glass = opt.glass;
  const { hx, hy } = ac, lx = -hy, ly = hx;
  const nose = [ac.x + hx * T.L / 2, ac.y + hy * T.L / 2];
  const dax = nose[0] - hx * door, day = nose[1] - hy * door;          // kapı, gövde ekseninde
  const sill = T.sill;
  const cabD = 3.0, cabW = 3.6;
  // kabin merkezi: gövde yüzünden 0.25 m açıkta (uçak yoksa geri çekilmiş)
  let cx = dax + lx * (T.R + 0.25 + cabD / 2), cy = day + ly * (T.R + 0.25 + cabD / 2);
  const E0 = [cx + lx * cabD * 0.3, cy + ly * cabD * 0.3];
  // rotunda: cepheden dışarı; tünel 14..max m
  let fx = F.x, fy = F.y;
  const nx = F.nx, ny = F.ny;
  let D = Math.hypot(E0[0] - fx, E0[1] - fy);
  const max = opt.max || 36;
  let Rx = fx + nx * 3.2, Ry = fy + ny * 3.2;
  let fixed = 0;
  if (D > max + 4) { fixed = D - max; Rx = fx + (E0[0] - fx) / D * fixed; Ry = fy + (E0[1] - fy) / D * fixed; }
  if (rot) { Rx = rot[0]; Ry = rot[1]; fixed = Math.hypot(Rx - fx, Ry - fy); }
  if (!ac.real) { const k = 0.55; cx = Rx + (cx - Rx) * k; cy = Ry + (cy - Ry) * k; }
  const cabAng = Math.atan2(hy, hx);
  const E = ac.real ? [cx + lx * cabD * 0.3, cy + ly * cabD * 0.3] : [cx + lx * cabD * 0.3, cy + ly * cabD * 0.3];
  const hE = ac.real ? sill : (h0 + sill) / 2;
  // sabit geçit (cephe -> rotunda) ve dikmeleri
  if (fixed > 2) {
    sbox(gb, [fx, fy, h0 - 0.35], [Rx, Ry, h0 - 0.35], 2.9, 3.1, BR_MET, BR_TOP, BR_DK, BR_MET);
    if (glass) { sbox(gb, [fx, fy, h0 + 0.65], [Rx, Ry, h0 + 0.65], 2.96, 1.3, BR_GL); }
    const n = Math.max(1, Math.floor(fixed / 14));
    for (let k = 1; k <= n; k++) { const t = k / (n + 0.5), px = fx + (Rx - fx) * t, py = fy + (Ry - fy) * t; cbox(gb, px, py, 0, 0.6, 0.6, h0 - 0.35, 0, BR_COL); }
  }
  // rotunda: sütun üstünde silindir
  cyl(gb, [Rx, Ry, 0], [Rx, Ry, h0 - 0.5], 0.55, 10, BR_COL);
  cbox(gb, Rx, Ry, 0, 2.2, 2.2, 0.35, 0, BR_COL);
  cyl(gb, [Rx, Ry, h0 - 0.5], [Rx, Ry, h0 + 3.0], 2.4, 14, BR_MET);
  cyl(gb, [Rx, Ry, h0 + 3.0], [Rx, Ry, h0 + 3.25], 2.6, 14, BR_TOP);
  // teleskopik tüneller: A (rotunda) -> C (kabin); C en büyük ve en altta
  const ux = E[0] - Rx, uy = E[1] - Ry, LT = Math.hypot(ux, uy);
  if (LT < 6) return;
  const ex = ux / LT, ey = uy / LT;
  const st = [Rx + ex * 2.0, Ry + ey * 2.0];
  const len = LT - 2.0;
  const n = len > 22 ? 3 : 2;
  const fl = (t) => h0 + (hE - h0) * t;
  for (let k = 0; k < n; k++) {
    const t0 = Math.max(0, k / n - 0.04), t1 = Math.min(1, (k + 1) / n + (k < n - 1 ? 0.06 : 0));
    const A = [st[0] + ex * len * t0, st[1] + ey * len * t0, fl(t0) - 0.35 - 0.09 * k], B = [st[0] + ex * len * t1, st[1] + ey * len * t1, fl(t1) - 0.35 - 0.09 * k];
    const w = 2.75 + 0.16 * k, hh = 2.85 + 0.17 * k;
    sbox(gb, A, B, w, hh, BR_MET, BR_TOP, BR_DK, BR_DK);
    if (glass) sbox(gb, [A[0], A[1], A[2] + 1.0], [B[0], B[1], B[2] + 1.0], w + 0.05, 1.25, BR_GL);
    else sbox(gb, [A[0], A[1], A[2] + hh - 0.5], [B[0], B[1], B[2] + hh - 0.5], w + 0.04, 0.12, BR_DK);
    // tünel ağzı kasnağı
    const ta = Math.max(0, t0 + 0.004), tb = ta + 0.25 / len;
    sbox(gb, [st[0] + ex * len * ta, st[1] + ey * len * ta, fl(ta) - 0.42 - 0.09 * k], [st[0] + ex * len * tb, st[1] + ey * len * tb, fl(tb) - 0.42 - 0.09 * k], w + 0.16, hh + 0.14, BR_DK);
  }
  // yürüyen ayak: kabine yakın; iki kaldırma kolonu, kiriş, iki tekerlekli boji
  const td = Math.max(0.55, 1 - 6.5 / len);
  const wx = st[0] + ex * len * td, wy = st[1] + ey * len * td, wb = fl(td) - 0.35 - 0.09 * (n - 1);
  const vx = -ey, vy = ex;
  for (const sd of [-1, 1]) {
    const px = wx + vx * sd * 1.25, py = wy + vy * sd * 1.25;
    cbox(gb, px, py, 0.75, 0.42, 0.42, wb - 0.75, Math.atan2(ey, ex), BR_COL);
    cbox(gb, px, py, 0.95, 0.55, 0.55, Math.min(1.8, wb - 1.2), Math.atan2(ey, ex), BR_DK);
    cyl(gb, [px + vx * sd * 0.05 - ex * 0.0, py + vy * sd * 0.05, 0.5], [px + vx * sd * 0.5, py + vy * sd * 0.5, 0.5], 0.5, 10, BR_TIRE);
  }
  cbox(gb, wx, wy, 0.55, 1.1, 2.9, 0.5, Math.atan2(ey, ex), BR_COL);
  // kabin: gövdeye paralel; önünde körük (koyu), yanda küçük pencere
  const ch0 = hE - 0.5;
  cbox(gb, cx, cy, ch0, cabW, cabD, 3.1, cabAng, BR_MET);
  cbox(gb, cx, cy, ch0 + 3.1, cabW + 0.2, cabD + 0.2, 0.18, cabAng, BR_TOP);
  const fcx = cx - lx * (cabD / 2 + 0.25), fcy = cy - ly * (cabD / 2 + 0.25);
  cbox(gb, fcx, fcy, ch0 - 0.05, cabW + 0.4, 0.6, 3.2, cabAng, BR_DK);
  cbox(gb, cx + hx * (cabW / 2 + 0.02), cy + hy * (cabW / 2 + 0.02), ch0 + 1.2, 0.08, cabD * 0.6, 1.1, cabAng, BR_GL);
  // kabinden yere servis merdiveni
  const sx = cx - hx * (cabW / 2 + 0.6), sy = cy - hy * (cabW / 2 + 0.6);
  sbox(gb, [sx + lx * 1.2, sy + ly * 1.2, ch0], [sx + lx * 1.2 + lx * 3.5, sy + ly * 1.2 + ly * 3.5, 0.1], 0.9, 0.25, BR_COL);
}
// en yakın cephe noktası; normal her zaman dışa bakar
function facadeAt(terms, x, y) {
  let best = null;
  for (const P of terms) { const e = nearestEdge(P, x, y); if (!best || e.d < best.d) { best = e; best.P = P; } }
  if (best && pip(best.P, best.x + best.nx * 1.5, best.y + best.ny * 1.5)) { best.nx = -best.nx; best.ny = -best.ny; }
  return best;
}
// OSM'nin hareketli köprü çizgileri (kapalı olmayan, iki ucu da cepheden uzak): [iç uç (rotunda), dış uç (kabin)]
function osmBridgeLines(d, terms) {
  const out = [];
  for (const k of d.kopru || []) {
    if (k.length < 2) continue;
    const a = k[0], b = k[k.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 3) continue;           // çokgen (sabit geçit tabanı)
    const fa = facadeAt(terms, a[0], a[1]), fb = facadeAt(terms, b[0], b[1]);
    if (!fa || !fb) continue;
    out.push(fa.d < fb.d ? { inner: a, outer: b, fi: fa.d, fo: fb.d } : { inner: b, outer: a, fi: fb.d, fo: fa.d });
  }
  return out;
}
// OSM'de park yeri çizgisi olmayan köprülü kapılar (ör. Esenboğa) için park yeri üret: köprü çizgisinin kabin ucundan,
// yoksa kapı noktasından; burun cepheye dönük, köprü uçağın sol ön kapısına
export function synthStands(d, S, terms) {
  if (!terms.length) return [];
  const T = AC_TYPES.n, add = [];
  const doorOf = (s) => { const nx = s.x - s.ux * 2, ny = s.y - s.uy * 2; return [nx - s.ux * T.doors[0] - s.uy * (T.R + 1.75), ny - s.uy * T.doors[0] + s.ux * (T.R + 1.75)]; };
  const taken = (x, y) => S.concat(add).some((s) => { if (s.pt || !(s.ux || s.uy)) return false; const [dx, dy] = doorOf(s); return Math.hypot(dx - x, dy - y) < 22; });
  const onApron = (x, y) => (d.apron || []).some((pl) => pip(pl[0], x, y));
  const make = (cx, cy, F, osm) => {
    const hx = -F.nx, hy = -F.ny, lx = -hy, ly = hx;
    // uçak apronun üstünde olmalı (iç avlular, kara tarafı değil)
    if (!onApron(cx + hx * 10 - lx * 6, cy + hy * 10 - ly * 6) || !onApron(cx - hx * 20 - lx * 6, cy - hy * 20 - ly * 6)) return;
    const ax = cx - lx * (T.R + 0.25 + 1.5), ay = cy - ly * (T.R + 0.25 + 1.5);           // kapı (gövde ekseninde)
    const sx = ax + hx * (T.doors[0] + 2), sy = ay + hy * (T.doors[0] + 2);
    let ref = null, bd = 60;
    for (const g of d.gate || []) { const dd = Math.hypot(g.p[0] - cx, g.p[1] - cy); if (dd < bd) { bd = dd; ref = g.r; } }
    add.push({ x: sx, y: sy, ux: hx, uy: hy, ref: ref || '_s' + add.length, gate: true, synth: true, osm });
  };
  for (const b of osmBridgeLines(d, terms)) {
    if (b.fo < 15 || b.fo > 90) continue;
    if (taken(b.outer[0], b.outer[1])) continue;
    make(b.outer[0], b.outer[1], facadeAt(terms, b.outer[0], b.outer[1]), b);
  }
  // kapı noktalarından üretim yalnız OSM'de terminal önünde hiç park yeri yoksa (yoksa iç avlulara uçak düşer)
  const osmNear = S.some((s) => !s.pt && !s.synth && facadeAt(terms, s.x, s.y).d < 120);
  if (!osmNear) for (const g of d.gate || []) {
    const F = facadeAt(terms, g.p[0], g.p[1]); if (!F || F.d > 70) continue;
    const k = Math.max(0, 24 - F.d);
    const cx = g.p[0] + F.nx * k, cy = g.p[1] + F.ny * k;
    if (taken(cx, cy)) continue;
    // başka bir park yeri (OSM) zaten buradaysa üretme
    if (S.some((s) => !s.pt && Math.hypot(s.x - cx, s.y - cy) < 45)) continue;
    make(cx, cy, F, null);
  }
  for (const s of add) { S.push(s); }
  for (const s of add) { let m = 1e9; for (const q of S) if (q !== s && !q.pt) m = Math.min(m, Math.hypot(q.x - s.x, q.y - s.y)); s.space = m; }
  return add;
}
// OSM'deki köprüler (en az 4 tane varsa yalnız onların yanındaki kapılara) ya da terminale yakın her kapı yeri
export function jetBridges(ctx, terms, S, opt = {}) {
  terms = terms || []; S = S || ctx.stands || [];
  const { d } = ctx, O = omats(ctx);
  const gb = CB();
  const kp = [];
  for (const k of d.kopru || []) for (const p of k) kp.push(p);
  const lines = terms.length ? osmBridgeLines(d, terms) : [];
  const useOsm = (d.kopru || []).length >= 4;
  let n = 0;
  if (terms.length) for (const s of S) {
    if (s.pt || !(s.ux || s.uy)) continue;
    const real = !!s.ac;
    const T = real ? (s.ac.T || AC_TYPES[s.ac.sc > 1.3 ? 'w' : 'n']) : AC_TYPES.n;
    const ac = real ? { ...s.ac, real: true } : { x: s.x - s.ux * (T.L / 2 + 2), y: s.y - s.uy * (T.L / 2 + 2), hx: s.ux, hy: s.uy, real: false };
    const lx = -ac.hy, ly = ac.hx;
    const doors = T.doors.slice(0, opt.doors || 2);
    let made = 0;
    for (let di = 0; di < doors.length; di++) {
      const ds = doors[di];
      const nose = [ac.x + ac.hx * T.L / 2, ac.y + ac.hy * T.L / 2];
      const dx = nose[0] - ac.hx * ds, dy = nose[1] - ac.hy * ds;
      const cx = dx + lx * (T.R + 1.75), cy = dy + ly * (T.R + 1.75);       // kabin merkezi
      const qx = dx + lx * (T.R + 12), qy = dy + ly * (T.R + 12);
      // OSM köprü çizgisi bu kabine uzanıyor mu?
      let osm = s.osm && di === 0 ? s.osm : null;
      if (!osm) for (const b of lines) if (Math.hypot(b.outer[0] - cx, b.outer[1] - cy) < 18) { osm = b; break; }
      const best = facadeAt(terms, osm ? osm.inner[0] : qx, osm ? osm.inner[1] : qy);
      if (!best || (!osm && best.d > (opt.reach || 70))) break;
      // cephe uçağın solunda olmalı
      if (!osm && (best.x - qx) * lx + (best.y - qy) * ly < -16) break;
      if (di === 0 && useOsm && !osm) { let m = 1e9; for (const p of kp) m = Math.min(m, Math.hypot(p[0] - qx, p[1] - qy)); if (m > 55) break; }
      if (di === 0 && !useOsm && !s.gate && best.d > 45) break;
      if (di > 0 && (!real || best.d > 45)) break;
      bridge(gb, best, ac, T, ds, opt, osm && best.d > 4 ? osm.inner : null);
      made++; n++;
    }
    if (made) s.bridge = made;
  }
  if (!gb.count) return null;
  const m = mesh(gb, O.vc, 'yolcu-kopruleri');
  shadowsOn(ctx, m);
  ctx.grp.add(m);
  return m;
}

// ---------- apron araçları ----------
// her araç kendi küçük birleşik geometrisi; hepsi 600 m'lik parçalarda tek örgü (yerel konumlar, gölgesiz)
const V_TIRE = [0.06, 0.06, 0.06], V_GL = [0.12, 0.15, 0.18], V_DK = [0.25, 0.26, 0.28];
function wheels(gb, x, y, ang, xs, track, r) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const a of xs) for (const sd of [-1, 1]) {
    const px = x + c * a - s * sd * track / 2, py = y + s * a + c * sd * track / 2;
    cyl(gb, [px, py, r], [px - s * sd * 0.32, py + c * sd * 0.32, r], r, 6, V_TIRE);
  }
}
// kamyon kabini: x, y ön aks hizası; ang yön; renk
function truckCab(gb, x, y, ang, W, H, col) {
  const c = Math.cos(ang), s = Math.sin(ang);
  cbox(gb, x, y, 0.5, 2.2, W, H - 0.5, ang, col);
  cbox(gb, x + c * 0.35, y + s * 0.35, H - 1.25, 1.55, W + 0.04, 0.75, ang, V_GL);
}
function vehicle(gb, kind, x, y, ang, col) {
  const c = Math.cos(ang), s = Math.sin(ang), P = (a, b) => [x + c * a - s * b, y + s * a + c * b];
  if (kind === 'tug') {         // itme-çekme aracı (alçak, geniş)
    cbox(gb, x, y, 0.35, 6.2, 2.9, 1.15, ang, col); const [qx, qy] = P(-2.2, 0); cbox(gb, qx, qy, 1.5, 1.3, 2.0, 0.9, ang, V_GL);
    wheels(gb, x, y, ang, [-1.9, 1.9], 2.6, 0.55);
  } else if (kind === 'belt') { // bant yükleyici: şasi + eğik bant
    cbox(gb, x, y, 0.35, 7.0, 2.1, 0.7, ang, col); const [qx, qy] = P(-2.6, 0); truckCab(gb, qx, qy, ang, 1.6, 2.0, col);
    const A = P(-1.8, 0), B = P(3.8, 0); sbox(gb, [A[0], A[1], 1.0], [B[0], B[1], 3.2], 1.0, 0.35, V_DK, [0.18, 0.18, 0.18]);
    wheels(gb, x, y, ang, [-2.4, 2.2], 1.9, 0.38);
  } else if (kind === 'bagtug') { // bagaj çekicisi
    cbox(gb, x, y, 0.3, 2.9, 1.5, 0.9, ang, col); const [qx, qy] = P(-0.4, 0); cbox(gb, qx, qy, 1.2, 1.3, 1.5, 0.95, ang, V_GL);
    wheels(gb, x, y, ang, [-0.9, 0.9], 1.3, 0.33);
  } else if (kind === 'dolly') {  // bagaj arabası + konteyner
    cbox(gb, x, y, 0.4, 3.1, 1.75, 0.15, ang, V_DK);
    cbox(gb, x, y, 0.55, 1.55, 1.55, 1.6, ang, col);
    wheels(gb, x, y, ang, [-1.1, 1.1], 1.5, 0.22);
  } else if (kind === 'fuel') {   // yakıt tankeri
    const [ax, ay] = P(3.6, 0); truckCab(gb, ax, ay, ang, 2.5, 3.0, col);
    cbox(gb, x, y, 0.55, 9.6, 2.3, 0.4, ang, V_DK);
    const A = P(-4.4, 0), B = P(2.3, 0); tube(gb, [A[0], A[1], 2.05], [B[0], B[1], 2.05], [[0, 0.9], [0.02, 1.2], [0.98, 1.2], [1, 0.9]], 12, [0.86, 0.87, 0.88]);
    wheels(gb, x, y, ang, [-3.6, -2.4, 3.6], 2.1, 0.5);
  } else if (kind === 'cater') {  // ikram kamyonu: makaslı kaldırılmış kasa
    const [ax, ay] = P(3.4, 0); truckCab(gb, ax, ay, ang, 2.4, 2.8, [0.9, 0.9, 0.9]);
    cbox(gb, x, y, 0.55, 8.8, 2.2, 0.45, ang, V_DK);
    const A = P(-3.0, 0), B = P(1.8, 0); sbox(gb, [A[0], A[1], 1.0], [B[0], B[1], 2.7], 0.3, 0.25, V_DK); sbox(gb, [B[0], B[1], 1.0], [A[0], A[1], 2.7], 0.3, 0.25, V_DK);
    const [bx, by] = P(-0.8, 0); cbox(gb, bx, by, 2.9, 5.6, 2.5, 2.6, ang, col);
    wheels(gb, x, y, ang, [-2.8, 3.2], 2.1, 0.48);
  } else if (kind === 'stairs') { // yolcu merdiveni aracı (merdiven +x ucunda yükselir)
    const [ax, ay] = P(-2.6, 0); truckCab(gb, ax, ay, ang, 2.1, 2.3, col);
    cbox(gb, x, y, 0.5, 7.0, 2.1, 0.45, ang, V_DK);
    const A = P(-1.4, 0), B = P(3.4, 0); sbox(gb, [A[0], A[1], 1.0], [B[0], B[1], 3.2], 1.6, 0.35, [0.85, 0.85, 0.86]);
    for (const sd of [-1, 1]) { const A2 = P(-1.4, sd * 0.8), B2 = P(3.4, sd * 0.8); sbox(gb, [A2[0], A2[1], 2.0], [B2[0], B2[1], 4.2], 0.08, 0.12, col); }
    const [tx, ty] = P(3.9, 0); cbox(gb, tx, ty, 3.2, 1.2, 1.7, 0.2, ang, [0.85, 0.85, 0.86]);
    wheels(gb, x, y, ang, [-2.6, 2.4], 1.9, 0.42);
  } else if (kind === 'bus') {    // apron otobüsü
    cbox(gb, x, y, 0.45, 13.5, 2.9, 2.75, ang, col);
    cbox(gb, x, y, 1.6, 13.56, 2.96, 1.1, ang, V_GL);
    cbox(gb, x, y, 3.2, 12.5, 2.6, 0.28, ang, V_DK);
    wheels(gb, x, y, ang, [-4.4, 4.6], 2.6, 0.5);
  } else if (kind === 'gpu') {    // yer güç ünitesi
    cbox(gb, x, y, 0.35, 2.6, 1.5, 1.45, ang, col); wheels(gb, x, y, ang, [-0.8, 0.8], 1.3, 0.3);
  } else if (kind === 'follow') { // follow-me aracı: sarı, tavanda damalı tabela
    cbox(gb, x, y, 0.35, 4.6, 1.85, 0.85, ang, [0.98, 0.78, 0.05]);
    cbox(gb, x - c * 0.3, y - s * 0.3, 1.2, 2.4, 1.7, 0.6, ang, V_GL);
    for (let k = 0; k < 4; k++) { const [qx, qy] = P(-0.75 + k * 0.5 - 0.3, 0); cbox(gb, qx, qy, 1.85, 0.5, 1.1, 0.5, ang, k % 2 ? [0.05, 0.05, 0.05] : [0.98, 0.78, 0.05]); }
    wheels(gb, x, y, ang, [-1.4, 1.4], 1.7, 0.32);
  } else if (kind === 'cone') {
    gb.lathe(x, y, [[0.22, 0], [0.04, 0.72]], 6, 0.1); paint(gb, gb.count - 14, [1, 0.42, 0.06]);
  }
}
const VCOL = [[0.95, 0.95, 0.94], [0.98, 0.78, 0.08], [0.85, 0.32, 0.12], [0.22, 0.42, 0.7], [0.92, 0.92, 0.9], [0.3, 0.55, 0.35]];
export function vehicles(ctx, S, opt = {}) {
  S = S || ctx.stands || [];
  const O = omats(ctx);
  const cells = new Map(), CS = 600;
  const add = (kind, x, y, ang, col) => {
    const k = Math.floor(x / CS) + ':' + Math.floor(y / CS);
    let c = cells.get(k); if (!c) cells.set(k, (c = { gb: CB(), x: 0, y: 0, n: 0 }));
    vehicle(c.gb, kind, x, y, ang, col); c.x += x; c.y += y; c.n++;
  };
  let n = 0;
  const lim = opt.max || 900;
  for (const s of S) {
    if (!s.ac || n > lim) continue;
    const a = s.ac, T = a.T || AC_TYPES[a.sc > 1.3 ? 'w' : 'n'];
    const h = Math.atan2(a.hy, a.hx), hx = a.hx, hy = a.hy, rx = hy, ry = -hx;   // sağ = (hy, -hx)
    const at = (f, r) => [a.x + hx * f + rx * r, a.y + hy * f + ry * r];      // f: merkezden ileri, r: sağa
    const R = T.R, Lh = T.L / 2;
    const r1 = hash1(s.x * 1.7, s.y), r2 = hash1(s.y, s.x * 2.3), r3 = hash1(s.x + 11, s.y - 5);
    const col = VCOL[Math.floor(r3 * VCOL.length)];
    const remote = !s.bridge;
    if (r1 < 0.85) for (const [f, r] of [[Lh + 1.2, 0], [-Lh + 6, T.wing.span + 0.5], [-Lh + 6, -T.wing.span - 0.5]]) { const [x, y] = at(f, r); add('cone', x, y, 0); n++; }
    if (s.gate && !remote && r2 < 0.55) { const [x, y] = at(Lh + 5.2, 0); add('tug', x, y, h, [0.95, 0.95, 0.94]); n++; }
    if (r1 < 0.6) { const [x, y] = at(Lh - 8.5, R + 4.4); add('belt', x, y, h + Math.PI / 2, col); n++; }
    if (r2 < 0.55) {
      const f0 = Lh - 8.5 - 3.5; let [x, y] = at(f0, R + 10); add('bagtug', x, y, h, col);
      for (let k = 0; k < 3 + Math.floor(r3 * 2); k++) { [x, y] = at(f0 - 3.3 - k * 3.5, R + 10); add('dolly', x, y, h, k % 2 ? [0.78, 0.8, 0.82] : [0.7, 0.72, 0.75]); }
      n += 4;
    }
    if (r3 < 0.35) { const [x, y] = at(-T.wing.sweep * 0.2 + T.wing.root * 0.1, T.eng.z + 5.5); add('fuel', x, y, h + Math.PI, [0.9, 0.9, 0.92]); n++; }
    if (r2 > 0.62) { const [x, y] = at(-Lh + 8.5, R + 4.6); add('cater', x, y, h - Math.PI / 2, [0.95, 0.95, 0.95]); n++; }
    if (r3 > 0.5) { const [x, y] = at(Lh - 4, 4.2); add('gpu', x, y, h + 0.3, [0.92, 0.92, 0.9]); n++; }
    if (remote) {
      const nose = Lh;
      let [x, y] = at(nose - T.doors[0] - 0.4, -(R + 4.4)); add('stairs', x, y, h - Math.PI / 2, col);
      if (r1 < 0.75) { [x, y] = at(-Lh + 9, -(R + 4.4)); add('stairs', x, y, h - Math.PI / 2, col); }
      if (r2 < 0.6) { [x, y] = at(nose - 14, -(R + 16)); add('bus', x, y, h, [0.94, 0.94, 0.92]); }
      n += 3;
    }
  }
  // follow-me araçları: birkaç park yeri girişinde
  let fm = 0;
  for (const s of S) { if (!s.ac || fm >= (opt.follow || 4) || hash1(s.y * 3, s.x) > 0.06) continue; const a = s.ac; const x = a.x - a.hx * (a.L / 2 + 22), y = a.y - a.hy * (a.L / 2 + 22); add('follow', x, y, Math.atan2(a.hy, a.hx) + 1.2, null); fm++; }
  const out = [];
  for (const c of cells.values()) {
    const m = mesh(c.gb, O.vc, 'ortak-araclar');
    m.userData.c = [c.x / c.n, c.y / c.n];
    ctx.grp.add(m); out.push(m);
  }
  if (!out.length) return out;
  let fr = 3;
  onTick(ctx, (cam) => {
    if (fr++ % 12) return;
    const [x, y, h] = camLocal(ctx, cam);
    for (const m of out) m.visible = Math.hypot(m.userData.c[0] - x, m.userData.c[1] - y, h) < (opt.far || 2500);
  });
  return out;
}

// ---------- apron ışık direkleri ----------
// park yerlerinin burun tarafında (servis yolu hizası), komşu yerlerin arasında; 25-30 m, dört projektörlü başlık
export function apronLights(ctx, S, terms, opt = {}) {
  const { M } = ctx, O = omats(ctx);
  const pole = new GB(), lamp = CB();
  const pts = [];
  const H = opt.h || 28, gap = opt.spacing || 95;
  const ok = (x, y) => {
    for (const P of terms) { if (pip(P, x, y)) return false; if (nearestEdge(P, x, y).d < 6) return false; }
    for (const q of pts) if (Math.hypot(q[0] - x, q[1] - y) < gap) return false;
    for (const s of S) {
      if (Math.hypot(s.x - x, s.y - y) < 14) return false;
      if (s.ac) { const a = s.ac, px = x - a.x, py = y - a.y, al = px * a.hx + py * a.hy, cr = -px * a.hy + py * a.hx; if (Math.abs(al) < a.L / 2 + 4 && Math.abs(cr) < (a.T ? a.T.wing.span : 18) + 3) return false; }
    }
    return true;
  };
  for (const s of S) {
    if (s.pt || !(s.ux || s.uy)) continue;
    const lx = -s.uy, ly = s.ux, sp = Math.min(s.space || 50, 90) / 2;
    for (const [f, l] of [[s.bridge ? -6 : 10, sp], [s.bridge ? -6 : 10, -sp]]) {
      const x = s.x + s.ux * f + lx * l, y = s.y + s.uy * f + ly * l;
      if (ok(x, y)) pts.push([x, y, Math.atan2(-s.uy, -s.ux)]);
    }
  }
  for (const [x, y, a] of pts) {
    const z0 = ctx.gh(x, y) - 0.3;
    pole.lathe(x, y, [[0.9, 0], [0.9, 0.5], [0.5, 0.5], [0.22, H]], 8, z0);
    // başlık: platform + yön verilmiş projektörler
    const c = Math.cos(a), s = Math.sin(a);
    pole.box(x, y, z0 + H - 0.3, 2.0, 3.6, 0.25, a + Math.PI / 2);
    for (let k = 0; k < 4; k++) {
      const off = (k - 1.5) * 0.85, px = x - s * off + c * 0.4, py = y + c * off + s * 0.4;
      pole.box(px, py, z0 + H, 0.55, 0.75, 0.9, a);
      lamp.box(px + c * 0.29, py + s * 0.29, z0 + H + 0.1, 0.04, 0.6, 0.7, a); paint(lamp, lamp.count - 20, [1, 0.97, 0.88]);
    }
  }
  if (!pts.length) return null;
  const grp = new THREE.Group(); grp.name = 'isiklar-apron'; grp.matrixAutoUpdate = false;
  grp.add(mesh(pole, M.metal, 'direk')); grp.add(mesh(lamp, O.lamp, 'projektor'));
  shadowsOn(ctx, grp);
  ctx.grp.add(grp);
  return grp;
}

// ---------- park yeri numaraları ve durma çizgileri (zemine boyalı) ----------
const GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-';
let GLT = null;
function glyphAtlas() {
  if (GLT) return GLT;
  const n = GLYPHS.length + 1, W = 48, H = 64;
  const c = document.createElement('canvas'); c.width = W * n; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, H);
  g.fillStyle = '#e8b818'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 56px Arial, Helvetica, sans-serif';
  for (let i = 0; i < GLYPHS.length; i++) g.fillText(GLYPHS[i], i * W + W / 2, H / 2 + 3);
  g.fillRect((n - 1) * W, 0, W, H);   // son hücre: düz sarı (çizgiler için)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  GLT = { t, n };
  return GLT;
}
export function standMarkings(ctx, S) {
  const A = glyphAtlas();
  const gb = new GB(); gb.uv = [];
  const H0 = 0.15;
  const quad = (cx, cy, ux, uy, w, l, cell) => {
    // w: yana, l: ileri (u yönü); hücre dokusu
    const vx = uy, vy = -ux;   // sağ
    const s = gb.count;
    const P = [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]];
    for (const [a, b] of P) gb.vert(cx + vx * a + ux * b, H0, cy + vy * a + uy * b, 0, 1, 0);
    const u0 = cell / A.n, u1 = (cell + 1) / A.n;
    gb.uv.push(u0 + 0.002, 0, u1 - 0.002, 0, u1 - 0.002, 1, u0 + 0.002, 1);
    gb.quad(s, s + 1, s + 2, s + 3);
  };
  const solid = A.n - 1;
  for (const s of S) {
    if (s.pt || !(s.ux || s.uy)) continue;
    const ux = s.ux, uy = s.uy, rx = uy, ry = -ux;
    // durma çizgisi (burun tekerleği hizası), geniş gövde için ikinci
    const nb = AC_TYPES.n.gear.nose + 2, wb = AC_TYPES.w.gear.nose + 2;
    quad(s.x - ux * nb, s.y - uy * nb, ux, uy, 4.5, 0.35, solid);
    if ((s.space || 0) > 62) quad(s.x - ux * wb, s.y - uy * wb, ux, uy, 4.5, 0.35, solid);
    // numara: durma noktasının ötesinde (kokpitten okunur: yazının üstü u yönünde), siyah zemin
    const ref = (s.ref && !String(s.ref).startsWith('_') ? String(s.ref) : '').toUpperCase().replace(/[^0-9A-Z-]/g, '').slice(0, 5);
    if (!ref) continue;
    const cw = 1.5, ch = 2.2, f = 4.5;
    for (let i = 0; i < ref.length; i++) {
      const off = (i - (ref.length - 1) / 2) * cw;
      quad(s.x + ux * f + rx * off, s.y + uy * f + ry * off, ux, uy, cw, ch, GLYPHS.indexOf(ref[i]));
    }
  }
  if (!gb.count) return null;
  const mat = decal(new THREE.MeshLambertMaterial({ map: A.t }), 4.6e-6);
  mat.userData.key = 'kapino';
  const m = mesh(gb, mat, 'kapi-numaralari'); m.renderOrder = 6;
  if (ctx.W.shadows) m.receiveShadow = true;
  ctx.grp.add(m);
  let fr = 5;
  onTick(ctx, (cam) => { if (fr++ % 12) return; const [x, y, h] = camLocal(ctx, cam); m.visible = Math.hypot(x, y, h) < 6000; });
  return m;
}

// ---------- hangarlar ----------
// OSM tabanı; kapı apron ya da taksi yoluna bakan kenarda (kemerli çatıda alın kenarı, düz çatıda uzun kenar), sürgülü kanatlar
function apronSide(d, x, y) {
  for (const pl of d.apron) if (pip(pl[0], x, y)) return 2;
  for (const t of d.twy) for (let k = 0; k < t.p.length - 1; k++) {
    const [ax, ay] = t.p[k], [bx, by] = t.p[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const tt = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1);
    if (Math.hypot(ax + dx * tt - x, ay + dy * tt - y) < t.w / 2 + 25) return 1;
  }
  return 0;
}
export function hangars(ctx, opt = {}) {
  const { d, gh } = ctx, O = omats(ctx);
  const gb = CB();
  const seen = new Set();
  for (const b of d.bina) {
    if (b.t !== 'hangar' || !b.p || b.p.length < 3) continue;
    const key = b.p[0][0] + ':' + b.p[0][1]; if (seen.has(key)) continue; seen.add(key);
    const P = b.p, o = obbOf(P), H = b.h || 18;
    const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5;
    const area = o.L * o.Wd;
    const r = hash1(o.cx, o.cy);
    const arched = opt.roof ? opt.roof === 'kemer' : (area < 9000 ? r < 0.6 : r < 0.25);
    const wallC = r < 0.5 ? [0.82, 0.84, 0.86] : r < 0.8 ? [0.7, 0.74, 0.79] : [0.86, 0.85, 0.8];
    const hw = arched ? H * 0.7 : H;
    // duvarlar
    const s0 = gb.count; gb.prism(P, base, hw, false); paint(gb, s0, wallC);
    // duvar dibi ve üst bandı
    const s1 = gb.count; gb.prism(inflate(P, 0.06), base, 1.2, false); gb.prism(inflate(P, 0.08), hw - 1.0, hw, false); paint(gb, s1, [0.45, 0.48, 0.52]);
    // çatı
    if (arched) { const s2 = gb.count; barrel(gb, o, hw, H, 12); paint(gb, s2, [0.62, 0.66, 0.7]); }
    else { const s2 = gb.count; gb.prism(inflate(P, 0.3), hw, hw + 0.8, true); paint(gb, s2, [0.58, 0.6, 0.62]); }
    // kapı kenarı: dört OBB kenarından apron/taksi yoluna bakan
    const sides = [];
    for (const [e, longSide] of [[1, true], [-1, true], [1, false], [-1, false]]) {
      const nx = longSide ? -o.s * e : o.c * e, ny = longSide ? o.c * e : o.s * e;
      const half = longSide ? o.Wd / 2 : o.L / 2, len = longSide ? o.L : o.Wd;
      const mx = o.cx + nx * half, my = o.cy + ny * half;
      let sc = apronSide(d, mx + nx * 35, my + ny * 35) * 2 + apronSide(d, mx + nx * 12, my + ny * 12);
      if (arched ? !longSide : longSide) sc += 1.5;
      sides.push({ nx, ny, mx, my, len, sc });
    }
    sides.sort((p, q) => q.sc - p.sc);
    const sd = sides[0];
    const dw = sd.len * 0.86, dh = Math.min(hw * (arched ? 0.97 : 0.85), 28), ang = Math.atan2(sd.ny, sd.nx) + Math.PI / 2;
    const np = Math.max(2, Math.round(dw / 8));
    for (let k = 0; k < np; k++) {
      const t = (k + 0.5) / np - 0.5, ux = Math.cos(ang), uy = Math.sin(ang);
      const dep = k % 2 ? 0.35 : 0.6;
      const x = sd.mx + ux * t * dw + sd.nx * dep / 2, y = sd.my + uy * t * dw + sd.ny * dep / 2;
      cbox(gb, x, y, base, dw / np - 0.12, dep, dh, ang, k % 2 ? [0.6, 0.64, 0.68] : [0.66, 0.7, 0.74]);
      // kanatlarda yatay pencere şeridi
      cbox(gb, x + sd.nx * 0.02, y + sd.ny * 0.02, base + dh * 0.62, dw / np - 0.8, dep + 0.02, 1.4, ang, [0.25, 0.32, 0.38]);
    }
    // kapı üst kirişi
    cbox(gb, sd.mx + sd.nx * 0.5, sd.my + sd.ny * 0.5, base + dh, dw + 1.2, 1.0, Math.max(1.0, Math.min(2.2, hw - dh)), ang, [0.4, 0.43, 0.47]);
    // yan duvarda şerit pencereler
    for (const q of sides.slice(1)) { if (q.len < 20) continue; cbox(gb, q.mx + q.nx * 0.05, q.my + q.ny * 0.05, base + hw * 0.55, q.len * 0.8, 0.12, 1.1, Math.atan2(q.ny, q.nx) + Math.PI / 2, [0.28, 0.34, 0.4]); }
  }
  if (!gb.count) return null;
  const m = mesh(gb, O.vcD, 'hangar-ortak');
  shadowsOn(ctx, m);
  ctx.grp.add(m);
  return m;
}
// genel hangarları (havalimani.js genericBuildings) bizimkilerle değiştir: modül kendi hangarlarını kurduysa (genelleri
// kaldırdıysa) dokunma; ilk karede yapılır ki modülün build'i bitmiş olsun
function replaceGenericHangars(ctx, opt) {
  let done = false;
  onTick(ctx, () => {
    if (done) return; done = true;
    const gen = ctx.grp.children.filter((c) => /^hangar-(duvar|cati|kenar)$/.test(c.name));
    if (!gen.length) return;
    for (const c of gen) { ctx.grp.remove(c); if (c.geometry) c.geometry.dispose(); }
    const m = hangars(ctx, opt);
    if (m) m.updateMatrixWorld(true);
  });
}

// standart ayrıntılı kurulum: terminaller (OSM tabanları), hangarlar, uçaklar, köprüler, araçlar, ışık direkleri, park yeri numaraları
// opt: { occ, terminal(b, area) -> terminal seçenekleri, extraTerminals, bridge: { h0, glass, max }, hangars: false | { roof },
//        lights: false | { h, spacing }, markings: false, vehicles: false | { max, far } }
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
    terminal(ctx, (b.id || 'T' + (++k)).toString(), b.n || 'Terminal', b.p, { ...st, h: st.h || (b.lv ? b.lv * 4.5 + 3 : area > 30000 ? 24 : area > 8000 ? 18 : 12), roof: st.roof || (area > 20000 ? 'isiklik' : 'duz') });
    terms.push(b.p);
  }
  for (const t of opt.extraTerminals || []) { terminal(ctx, t.id, t.ad, t.p, t); terms.push(t.p); }
  if (opt.synth !== false) synthStands(d, S, terms);
  parkedAircraft(ctx, { occ: opt.occ != null ? opt.occ : 0.62, hiR: opt.hiR });
  jetBridges(ctx, terms, S, opt.bridge || {});
  if (opt.vehicles !== false) vehicles(ctx, S, opt.vehicles || {});
  if (opt.lights !== false) apronLights(ctx, S, terms, opt.lights || {});
  if (opt.markings !== false) standMarkings(ctx, S);
  if (opt.hangars !== false) replaceGenericHangars(ctx, opt.hangars || {});
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
