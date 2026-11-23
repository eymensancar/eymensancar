// Erzurum Havalimanı (LTCE, ERZ): 1757 m'de, Erzurum Ovası'nın karlı yüksek platosunda askeri-sivil ortak meydan.
// İki paralel pist: 08L/26R (3785 x 45 m, sivil) ve 08R/26L (3805 x 30 m). Kuzeyde sivil terminal (OSM tabanı, ayrı parça,
// karlı çatı), yeni kule, itfaiye, otopark; batı ve doğu uçlarda askeri korunaklı uçak sığınakları (OSM tabanları, beton
// kemer, önlerinde gri jetler), güneyde büyük bakım hangarları, gözetim radarı. Çevrede kar örtüsü ve pist kenarında kürenmiş kar.
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, obbOf, barrel, decal } from '../havalimani.js';
import { standard, towerModern, pip, nearestEdge } from './ortak.js';
import { ccwTerminals, termExtras, VC, hangar, fireStation, carPark, rectP, dropGenericHangars, radar, kzMats, H1, SNOW, ccw } from './ltcg.js';

export function build(ctx) {
  const { d } = ctx;
  ccwTerminals(d);
  const R = standard(ctx, { occ: 0.5, terminal: (b, area) => (area > 5000 ? { h: 17, roof: 'kemer', rise: 5, overhang: 6 } : { h: 11 }) });
  for (const [id, g] of ctx.parts) if (id.startsWith('terminal:')) {
    const roof = g.children.find((c) => c.name === 'cati'); if (roof) roof.material = kzMats(ctx).snowRoof;
    termExtras(ctx, g, { land: [0, 1], canopy: 13, snow: true });
  }
  // yeni kule: terminalin batısında, kara tarafında
  towerModern(ctx, 500, 700, 44, 0.15);
  dropGenericHangars(ctx);
  const vc = new VC();
  const seen = new Set(), shelters = [];
  for (const b of d.bina) {
    if (b.t !== 'hangar') continue;
    const k = Math.round(b.p[0][0]) + ':' + Math.round(b.p[0][1]); if (seen.has(k)) continue; seen.add(k);
    const P = ccw(b.p), A = Math.abs(P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
    const [cx, cy] = centroid(P);
    if (A < 1000 && cy < 400) { shelters.push(shelter(ctx, vc, P)); continue; }
    // büyük hangarlar: kapı en yakın taksi yoluna / aprona doğru
    const t = nearestPaved(d, cx, cy);
    hangar(ctx, vc, P, { H: A > 4000 ? 22 : A > 1500 ? 16 : 11, door: t ? [t[0] - cx, t[1] - cy] : [0, 1], roof: A > 4000 ? 'kemer' : 'duz', snow: true, ad: 'Hangar', wall: [0.74, 0.76, 0.72] });
  }
  fireStation(ctx, vc, 330, 575, Math.PI, { snow: true });
  carPark(ctx, vc, rectP(640, 735, 150, 40, 0.17), 0.17, 31);
  vc.mesh(ctx, 'hangar-kuzey');
  radar(ctx, -260, -640, 22, { snow: true });
  // askeri jetler: sığınakların bir kısmının önünde ve doğu askeri apronda
  const jets = [];
  for (const s of shelters) if (s && H1(s.x, s.y) < 0.55) jets.push([s.x + s.dx * (s.L / 2 + 9), s.y + s.dy * (s.L / 2 + 9), Math.atan2(s.dy, s.dx)]);
  const east = d.apron.find((pl) => { const [x, y] = centroid(pl[0]); return x > 1100 && x < 1600 && y < 0; });
  if (east) {
    const o = obbOf(east[0]);
    for (let a = o.a0 + 18; a < o.a1 - 12; a += 22) {
      const b = (o.b0 + o.b1) / 2, x = a * o.c - b * o.s, y = a * o.s + b * o.c;
      if (pip(east[0], x, y)) jets.push([x, y, o.ang + Math.PI / 2]);
    }
  }
  militaryJets(ctx, jets);
  snowField(ctx, -3900, -2500, 3900, 2300);
  snowBanks(ctx);
  return R;
}

function nearestPaved(d, x, y) {
  let best = null, bd = 1e9;
  for (const t of d.twy) for (const p of t.p) { const dd = Math.hypot(p[0] - x, p[1] - y); if (dd < bd) { bd = dd; best = p; } }
  for (const pl of d.apron) { const [ax, ay] = centroid(pl[0]); const dd = Math.hypot(ax - x, ay - y) * 1.2; if (dd < bd) { bd = dd; best = [ax, ay]; } }
  return best;
}

// ---------- korunaklı uçak sığınağı: beton kemer, önde çelik kapı, arkada egzoz çıkışı, üstü karlı ----------
function shelter(ctx, vc, P) {
  const { d, gh } = ctx;
  const o = obbOf(P);
  const [cx, cy] = centroid(P);
  // uzun eksen = derinlik; kapı en yakın taksi yoluna bakan kısa uçta
  const long = o.L >= o.Wd, L = Math.max(o.L, o.Wd), S = Math.min(o.L, o.Wd);
  let ux = long ? o.c : -o.s, uy = long ? o.s : o.c;
  const t = nearestPaved(d, cx, cy);
  if (t && (t[0] - cx) * ux + (t[1] - cy) * uy < 0) { ux = -ux; uy = -uy; }
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5;
  const rise = Math.min(9.5, S * 0.42), CONC = [0.56, 0.55, 0.5], DOOR = [0.4, 0.42, 0.4];
  const s0 = vc.g.count;
  vc.g.prism(P, base, 0.7, false);
  barrel(vc.g, o, 0.7, 0.7 + rise, 12);
  vc.col(s0, CONC); vc.snow(s0, 0.45);
  const ang = Math.atan2(uy, ux), vx = -uy, vy = ux;
  // kapı çerçevesi (kalın beton alın) ve kapı kanatları
  const fx = cx + ux * (L / 2 + 0.8), fy = cy + uy * (L / 2 + 0.8);
  vc.box(CONC, fx, fy, base, 1.6, S + 1.2, rise + 0.9 - base, ang);
  const ds = vc.box(DOOR, fx + ux * 1.0, fy + uy * 1.0, base, 0.5, S * 0.86, rise * 0.82 - base, ang);
  for (let k = -2; k <= 2; k++) vc.box([0.3, 0.32, 0.3], fx + ux * 1.3 + vx * k * S * 0.2, fy + uy * 1.3 + vy * k * S * 0.2, base, 0.3, 0.4, rise * 0.82 - base, ang);
  const tp = vc.box(CONC, fx, fy, rise + 0.9, 2.2, S + 1.6, 0.6, ang); vc.snow(tp, 0.6);
  // arka egzoz bacası
  const bx = cx - ux * (L / 2 - 2), by = cy - uy * (L / 2 - 2);
  const ex = vc.box(CONC, bx, by, rise * 0.7, 3, 4, 2.2, ang); vc.snow(ex, 0.6);
  // önde beton saha
  vc.box([0.5, 0.5, 0.48], cx + ux * (L / 2 + 10), cy + uy * (L / 2 + 10), base, 18, S + 4, 0.1 - base, ang);
  (ctx.solid || (ctx.solid = [])).push({ P, top: rise + 0.7, ad: 'Uçak sığınağı' });
  return { x: cx, y: cy, dx: ux, dy: uy, L };
}

// ---------- gri askeri jet (kendi düşük poligonlu modelimiz, işaretsiz; ~15 m) ----------
let JET = null;
function jetGeom() {
  if (JET) return JET;
  const g = new GB([['color', 3]]);
  const G1 = [0.55, 0.58, 0.6], G2 = [0.45, 0.48, 0.5], CAN = [0.15, 0.17, 0.2], DK = [0.2, 0.2, 0.22];
  const c = (s0, col) => { const v = g.a.color.v; for (let k = s0; k < g.count; k++) { v[k * 3] = col[0]; v[k * 3 + 1] = col[1]; v[k * 3 + 2] = col[2]; } };
  // gövde: x ekseni boyunca (burun +x), dönel kesitler
  const secs = [[7.5, 0.05], [6.6, 0.45], [5.0, 0.8], [2.5, 0.95], [-3.5, 0.95], [-6.5, 0.7], [-7.4, 0.55]];
  const seg = 10, s0 = g.count;
  for (const [x, r] of secs) for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2, cy = Math.cos(a), sz = Math.sin(a); g.vert(x, 2.0 + sz * r, cy * r * 1.1, 0, sz, cy); }
  for (let j = 0; j < secs.length - 1; j++) for (let k = 0; k < seg; k++) { const a = s0 + j * (seg + 1) + k, b = a + seg + 1; g.quad(a, a + 1, b + 1, b); }
  c(s0, G1);
  // kanopi
  let s = g.count; g.lathe(0, 0, [[0.5, 0], [0.42, 0.45], [0.05, 0.6]], 8, 0);
  for (let k = s; k < g.count; k++) { g.p[k * 3] = 3.6 + g.p[k * 3] * 3.4; g.p[k * 3 + 1] += 2.75; g.p[k * 3 + 2] *= 1.0; }
  c(s, CAN);
  // kanatlar (ok açılı), yatay kuyruk, dikey kuyruk
  const plate = (pts, z, th, col) => { const s1 = g.count; for (const [x, y] of pts) g.vert(x, z, y, 0, 1, 0); for (const [x, y] of pts) g.vert(x, z - th, y, 0, -1, 0); const n = pts.length; for (let k = 1; k < n - 1; k++) { g.tri(s1, s1 + k + 1, s1 + k); g.tri(s1 + n, s1 + n + k, s1 + n + k + 1); } for (let k = 0; k < n; k++) { const a = s1 + k, b = s1 + (k + 1) % n; g.quad(a, b, b + n, a + n); } c(s1, col); };
  for (const sd of [-1, 1]) {
    plate([[1.8, sd * 0.9], [-2.6, sd * 0.9], [-3.6, sd * 4.9], [-2.2, sd * 4.9]].map(([x, y]) => [x, y]), 1.85, 0.2, G2);
    plate([[-5.0, sd * 0.6], [-7.2, sd * 0.6], [-7.6, sd * 2.9], [-6.6, sd * 2.9]], 2.0, 0.12, G2);
  }
  s = g.count;
  for (const e of [-0.1, 0.1]) for (const [x, z] of [[-4.6, 2.6], [-7.3, 2.6], [-7.8, 5.6], [-6.4, 5.6]]) g.vert(x, z, e, 0, 0, e > 0 ? 1 : -1);
  g.quad(s, s + 1, s + 2, s + 3); g.quad(s + 4, s + 7, s + 6, s + 5); g.quad(s + 3, s + 2, s + 6, s + 7); g.quad(s, s + 4, s + 5, s + 1);
  c(s, G2);
  // hava alığı ve lüle, takımlar
  s = g.count; g.box(1.5, 0, 0.9, 2.6, 1.3, 0.8, 0); c(s, G2);
  s = g.count; g.box(-7.6, 0, 1.55, 0.6, 1.1, 0.95, 0); c(s, DK);
  s = g.count; for (const [x, y] of [[4.4, 0], [-1.2, 1.3], [-1.2, -1.3]]) g.box(x, y, 0, 0.35, 0.35, 1.4, 0); c(s, DK);
  // GB.vert z'yi eksiye çevirir; gövde y'si yan doğrultu: hepsi aynı kurala uyduğu için düzeltme gerekmez
  JET = g.geometry();
  return JET;
}
function militaryJets(ctx, list) {
  if (!list.length) return;
  const G = jetGeom();
  const m = new THREE.InstancedMesh(G, ctx.M.body, list.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, y, a], i) => {
    o.position.set(x, 0.12, -y); o.rotation.set(0, a, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    c.setRGB(0.9 + H1(x, y) * 0.1, 0.92 + H1(x, y) * 0.08, 0.95); m.setColorAt(i, c);
  });
  m.computeBoundingSphere(); m.name = 'ucaklar'; m.matrixAutoUpdate = false; ctx.grp.add(m);
}

// ---------- kar örtüsü: araziyi izleyen ızgara (62.5 m), kenarlarda gürültüyle seyrelir; kaplamalı yüzeyler üstte kalır ----------
const NOISE = `
  float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
`;
let SNOWMAT = null;
function snowMat() {
  if (SNOWMAT) return SNOWMAT;
  const m = decal(new THREE.MeshLambertMaterial({ color: 0xffffff }), 1.4e-6);
  m.userData.key = 'kar';
  m.onBeforeCompile = ((prev) => (sh, r) => {
    prev(sh, r);
    sh.vertexShader = 'attribute float fade; varying float vF; varying vec2 vQ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vF = fade; vQ = position.xz;');
    sh.fragmentShader = 'varying float vF; varying vec2 vQ;\n' + NOISE + sh.fragmentShader.replace('#include <map_fragment>', `
      float n = vn(vQ * 0.0035) * 0.5 + vn(vQ * 0.019) * 0.32 + vn(vQ * 0.13) * 0.18;
      if (n > vF) discard;
      float e = clamp((vF - n) * 7.0, 0.0, 1.0);
      vec3 c = mix(vec3(0.55, 0.56, 0.52), vec3(0.86, 0.88, 0.92), e) * (0.95 + 0.05 * vn(vQ * 0.9));
      diffuseColor.rgb = c;
      `);
  })(m.onBeforeCompile);
  SNOWMAT = m;
  return m;
}
function snowField(ctx, x0, y0, x1, y1) {
  const { gh } = ctx;
  const S = 62.5, nx = Math.ceil((x1 - x0) / S), ny = Math.ceil((y1 - y0) / S);
  const g = new GB([['fade', 1]]);
  const edge = 1100;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * S, y = y0 + j * S, h = gh(x, y);
    const e = Math.min(x - x0, x1 - x, y - y0, y1 - y) / edge;
    const f = Math.min(0.97, Math.max(0, e) * 1.1);
    g.vert(x, h + (Math.abs(h) < 0.3 ? 0.03 : 0.45), y, 0, 1, 0, { fade: [f] });
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; g.quad(a, a + 1, b + 1, b); }
  // yüzey normalleri (arazi eğimi)
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const k = j * (nx + 1) + i, P = g.p;
    const hx = P[(j * (nx + 1) + Math.min(nx, i + 1)) * 3 + 1] - P[(j * (nx + 1) + Math.max(0, i - 1)) * 3 + 1];
    const hy = P[(Math.min(ny, j + 1) * (nx + 1) + i) * 3 + 1] - P[(Math.max(0, j - 1) * (nx + 1) + i) * 3 + 1];
    const nxv = -hx / (2 * S), nyv = -hy / (2 * S), l = Math.hypot(nxv, 1, nyv);
    g.n[k * 3] = nxv / l; g.n[k * 3 + 1] = 1 / l; g.n[k * 3 + 2] = -nyv / l;
  }
  const m = new THREE.Mesh(g.geometry(), snowMat()); m.name = 'kar'; m.renderOrder = 1; m.matrixAutoUpdate = false; m.receiveShadow = true;
  ctx.grp.add(m);
}
// pist kenarlarında kürenmiş kar sırtları (omuzların dışında; taksi yolu bağlantılarında açıklık)
function snowBanks(ctx) {
  const { d, gh } = ctx;
  const g = new GB([['color', 3]]);
  const segs = [];
  for (const t of d.twy) for (let k = 0; k < t.p.length - 1; k++) segs.push([t.p[k], t.p[k + 1], t.w]);
  const nearTw = (x, y) => {
    for (const [a, b, w] of segs) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, tt = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
      if (Math.hypot(a[0] + dx * tt - x, a[1] + dy * tt - y) < w / 2 + 22) return true;
    }
    return false;
  };
  for (const r of d.rws) {
    if (!r.paved) continue;
    const ux = (r.b[0] - r.a[0]) / r.len, uy = (r.b[1] - r.a[1]) / r.len, nx = -uy, ny = ux, ang = Math.atan2(uy, ux);
    for (const sd of [-1, 1]) for (let s = -40; s < r.len + 40; s += 16) {
      const off = sd * (r.w / 2 + 13 + H1(s, sd) * 1.5);
      const x = r.a[0] + ux * s + nx * off, y = r.a[1] + uy * s + ny * off;
      if (nearTw(x, y)) continue;
      const h = 0.6 + H1(x, y) * 0.6, w = 2.6 + H1(y, x) * 1.6, g0 = gh(x, y) - 0.2;
      const s0 = g.count;
      // iki kademeli sırt: alt geniş, üst dar
      g.box(x, y, g0, 17, w, h * 0.6 + 0.2, ang);
      g.box(x - nx * sd * 0.3, y - ny * sd * 0.3, g0 + h * 0.6 + 0.2, 15.5, w * 0.55, h * 0.4, ang);
      const v = g.a.color.v; for (let k = s0; k < g.count; k++) { const sh = 0.9 + H1(k, s) * 0.06; v[k * 3] = SNOW[0] * sh; v[k * 3 + 1] = SNOW[1] * sh; v[k * 3 + 2] = SNOW[2] * sh; }
    }
  }
  if (!g.count) return;
  const m = new THREE.Mesh(g.geometry(), kzMats(ctx).vc); m.name = 'donanim-kar'; m.matrixAutoUpdate = false; ctx.grp.add(m);
}
