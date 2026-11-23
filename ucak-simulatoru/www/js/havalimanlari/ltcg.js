// Trabzon Havalimanı (LTCG, TZX): denize paralel 11/29 pisti (2640 x 45 m), şehrin doğusunda sahil şeridinde; kuzeyde Karadeniz
// (pistin deniz kenarı taş tahkimatlı), güneyde sahil yolu ve şehir. Üç terminal (OSM tabanları, her biri ayrı parça:
// iç hatlar dalgalı çatılı, dış hatlar giden ışıklıklı, dış hatlar gelen düz çatılı), kule (~40 m), bakım hangarı,
// itfaiye binası, terminal önü otopark, park etmiş uçaklar.
// Bu dosyanın altındaki "kuzey parçaları" Samsun-Çarşamba (ltfh.js) ve Erzurum (ltce.js) tarafından da kullanılır.
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, barrel, decal } from '../havalimani.js';
import { standard, terminal, towerClassic, towerPos, pip, nearestEdge } from './ortak.js';

export function build(ctx) {
  const { d } = ctx;
  ccwTerminals(d);
  const R = standard(ctx, {
    occ: 0.6,
    terminal: (b, area) => {
      const n = b.n || '';
      if (/İç Hatlar/.test(n)) return { h: 15, roof: 'dalga', overhang: 5, skyStep: 22 };
      if (/Giden/.test(n)) return { h: 14, roof: 'isiklik', overhang: 5, skyStep: 18 };
      return { h: 11, roof: 'duz', overhang: 4 };
    },
  });
  // terminallere cephe ayrıntısı: kara tarafı (güney) saçağı, dikmeler, kat bantları, çatı makineleri
  for (const [id, g] of ctx.parts) if (id.startsWith('terminal:')) termExtras(ctx, g, { land: [0.12, -1], canopy: 13 });
  // kule: OSM (-561, -119), 40 m; iç ve dış hatlar terminallerinin arasında
  const t = towerPos(d, { x: -561, y: -119, h: 40 });
  towerClassic(ctx, t.x, t.y, Math.max(40, t.h || 0));
  const vc = new VC();
  // bakım hangarı (apronun doğu ucu, taksi yolunun güneyi) ve itfaiye (pistin ortasına yakın, hızlı çıkış)
  hangar(ctx, vc, rectP(250, -250, 62, 44, -0.27), { H: 17, door: [0.27, 1], ad: 'Bakım hangarı' });
  fireStation(ctx, vc, 480, -240, -0.27);
  // terminal önü otopark (sahil yolu ile terminaller arası)
  carPark(ctx, vc, rectP(-560, -205, 120, 34, -0.27), -0.27, 11);
  carPark(ctx, vc, rectP(-300, -245, 110, 30, -0.27), -0.27, 12);
  vc.mesh(ctx, 'hangar-kuzey');
  // denizden yana pist kenarı: taş tahkimat (OSM kıyı çizgisine göre değil; arazinin deniz seviyesine indiği yer)
  riprap(ctx, d.rws[0]);
  return R;
}

// ======================================================================================
// kuzey parçaları (LTCG, LTFH, LTCE ortak)
// ======================================================================================
const H1 = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const SNOW = [0.93, 0.95, 0.98];
// OSM terminal tabanlarını saat yönünün tersine çevir (cephe normalleri dışa baksın); yerinde, tekrar çağrılabilir
export function ccwTerminals(d) {
  for (const b of d.bina) {
    if (b.t !== 'terminal' && b.t !== 'hangar') continue;
    if (area2(b.p) < 0) b.p.reverse();
  }
}
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const ccw = (P) => (area2(P) < 0 ? P.slice().reverse() : P);
// döndürülmüş dikdörtgen (merkez, boy doğrultu boyunca, en, açı)
export function rectP(x, y, L, W, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
}

// köşe renkli birleşik örgü: her yapı tek çizim çağrısında
export class VC {
  constructor() { this.g = new GB([['color', 3]]); this.glass = new GB(); }
  get count() { return this.g.count; }
  // s0'dan sonraki köşeleri boya
  col(s0, rgb) { const v = this.g.a.color.v; for (let k = s0; k < this.g.count; k++) { v[k * 3] = rgb[0]; v[k * 3 + 1] = rgb[1]; v[k * 3 + 2] = rgb[2]; } }
  // yukarı bakan yüzeylere kar
  snow(s0, thr = 0.5) { const v = this.g.a.color.v, n = this.g.n; for (let k = s0; k < this.g.count; k++) if (n[k * 3 + 1] > thr) { v[k * 3] = SNOW[0]; v[k * 3 + 1] = SNOW[1]; v[k * 3 + 2] = SNOW[2]; } }
  box(rgb, ...a) { const s = this.g.count; this.g.box(...a); this.col(s, rgb); return s; }
  prism(rgb, ...a) { const s = this.g.count; this.g.prism(...a); this.col(s, rgb); return s; }
  mesh(ctx, name) {
    const grp = new THREE.Group(); grp.name = name; grp.matrixAutoUpdate = false;
    if (this.g.count) { const m = new THREE.Mesh(this.g.geometry(), kzMats(ctx).vc); m.matrixAutoUpdate = false; grp.add(m); }
    if (this.glass.count) { const m = new THREE.Mesh(this.glass.geometry(), ctx.M.glass); m.matrixAutoUpdate = false; grp.add(m); }
    if (grp.children.length) ctx.grp.add(grp);
    return grp;
  }
}
let KZ = null;
export function kzMats(ctx) {
  if (KZ) return KZ;
  KZ = {
    vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
    snowRoof: new THREE.MeshLambertMaterial({ color: 0xeef1f5 }),
  };
  return KZ;
}
// kule ve benzeri yapılar için çarpışma (yeniden kurulunca çoğalmasın)
export function addCol(ctx, c) {
  const W = ctx.W, k = Math.round(c.x) + ':' + Math.round(c.y);
  W._apCol = W._apCol || new Set();
  if (W._apCol.has(k)) return; W._apCol.add(k); W.lmCol.push(c);
}
// her kare çağrılan işler (radar dönüşü vb.)
export function onTick(ctx, fn) { const prev = ctx.tick; ctx.tick = prev ? (cam) => { prev(cam); fn(cam); } : fn; }
// havalimani.js'in genel hangarlarını kaldır (yerine ayrıntılıları kurulacaksa)
export function dropGenericHangars(ctx) {
  for (const c of ctx.grp.children.slice()) if (/^hangar-(duvar|cati|kenar)$/.test(c.name)) { ctx.grp.remove(c); c.geometry.dispose(); }
  ctx.solid = [];
}

// ---------- terminal cephe ayrıntısı (terminal grubunun içine: 'dis-ayrinti') ----------
// opt.land: kara tarafı yönü (x doğu, y kuzey), opt.canopy: saçak derinliği (m), opt.snow: çatıda kar
export function termExtras(ctx, grp, opt = {}) {
  const u = grp.userData, P = ccw(u.taban), h = u.yukseklik, base = u.kotu, fl = u.katYuksekligi || 4.5;
  const vc = new VC(), g = vc.g;
  const WALL = [0.86, 0.85, 0.82], COL = [0.80, 0.81, 0.82], SPAN = [0.30, 0.32, 0.34], DOOR = [0.16, 0.18, 0.2];
  // üstte opak kaplama bandı (parapet) ve kat döşemesi bantları
  vc.prism(WALL, inflate(P, 0.12), h - 2.0, h, false);
  for (let z = base + 0.6 + fl; z < h - 3; z += fl) vc.prism(SPAN, inflate(P, 0.06), z - 0.35, z + 0.35, false);
  vc.prism([0.55, 0.55, 0.53], inflate(P, 0.3), base, 0.25, false);
  const L = opt.land || [0, -1], ll = Math.hypot(L[0], L[1]), lx = L[0] / ll, ly = L[1] / ll;
  const cdep = opt.canopy || 12;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
    const E = Math.hypot(bx - ax, by - ay); if (E < 4) continue;
    const ux = (bx - ax) / E, uy = (by - ay) / E, nx = uy, ny = -ux;   // dış normal
    // dikmeler: 9 m arayla
    for (let s = 4.5; s < E - 2; s += 9) vc.box(COL, ax + ux * s + nx * 0.25, ay + uy * s + ny * 0.25, base, 0.6, 0.6, h - 2 - base, Math.atan2(uy, ux));
    // kara tarafı: saçak (sütunlu, 7.5 m'de), giriş kapıları
    if (nx * lx + ny * ly > 0.6 && E > 18) {
      const s0 = 3, s1 = E - 3, mx = ax + ux * (s0 + s1) / 2, my = ay + uy * (s0 + s1) / 2;
      const cx = mx + nx * cdep / 2, cy = my + ny * cdep / 2, ang = Math.atan2(uy, ux);
      const sc = vc.box(WALL, cx, cy, 7.2, s1 - s0, cdep, 0.7, ang);
      if (opt.snow) vc.snow(sc, 0.6);
      vc.box(SPAN, cx, cy, 7.9, s1 - s0 - 0.6, cdep - 0.6, 0.25, ang);
      for (let s = s0 + 4; s < s1 - 1; s += 14) vc.box(COL, ax + ux * s + nx * (cdep - 1.2), ay + uy * s + ny * (cdep - 1.2), base, 0.7, 0.7, 7.2 - base, ang);
      for (let s = s0 + 8; s < s1 - 6; s += 22) vc.box(DOOR, ax + ux * s + nx * 0.35, ay + uy * s + ny * 0.35, base, 4.2, 0.5, 3.0 - base, ang);
      // kaldırım
      vc.box([0.62, 0.61, 0.58], cx, cy, base, s1 - s0, cdep, 0.35 - base, ang);
    }
  }
  // çatı makineleri (iklimlendirme) ve çatı çıkışları
  const o = obbOf(P);
  let n = 0;
  for (let a = o.a0 + 10; a < o.a1 - 10 && n < 10; a += 21) for (let b = o.b0 + 10; b < o.b1 - 10 && n < 10; b += 17) {
    const x = a * o.c - b * o.s, y = a * o.s + b * o.c;
    if (H1(x, y) > 0.45 || !pip(P, x, y) || nearestEdge(P, x, y).d < 8) continue;
    const s = vc.box([0.62, 0.64, 0.66], x, y, h + 1.6, 5 + H1(y, x) * 4, 3.5, 1.8, o.ang); n++;
    if (opt.snow) vc.snow(s, 0.6);
  }
  const m = new THREE.Mesh(g.geometry(), kzMats(ctx).vc); m.name = 'dis-ayrinti'; m.matrixAutoUpdate = false;
  grp.add(m);
  return m;
}

// ---------- ayrıntılı hangar ----------
// P: taban, opt: { H yükseklik, door: kapı yönü (dışa), roof: 'kemer' | 'duz', snow, ad, wall: renk }
export function hangar(ctx, vc, P, opt = {}) {
  const { gh } = ctx;
  P = ccw(P);
  const H = opt.H || 16, base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5;
  const WALL = opt.wall || [0.78, 0.81, 0.84], ROOF = [0.6, 0.64, 0.68], DOOR = [0.66, 0.70, 0.74], RIB = [0.5, 0.53, 0.56], TRIM = [0.25, 0.3, 0.42];
  const o = obbOf(P), eave = opt.roof === 'duz' ? H : H * 0.8;
  vc.prism(WALL, P, base, eave, opt.roof === 'duz');
  if (opt.roof === 'duz') { const s = vc.prism(ROOF, inflate(P, 0.3), eave, eave + 1.0); if (opt.snow) vc.snow(s, 0.6); }
  else { const s = vc.g.count; barrel(vc.g, o, eave, H, 12); vc.col(s, ROOF); if (opt.snow) vc.snow(s, 0.35); }
  // alt kenarda koyu süpürgelik
  vc.prism(TRIM, inflate(P, 0.06), base, 1.2, false);
  // kapı: kapı yönüne en iyi bakan kenar
  const D = opt.door || [0, -1];
  let best = null;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length], E = Math.hypot(bx - ax, by - ay); if (E < 8) continue;
    const ux = (bx - ax) / E, uy = (by - ay) / E, dd = uy * D[0] - ux * D[1];
    if (!best || dd > best.dd) best = { dd, ax, ay, ux, uy, E };
  }
  if (best) {
    const { ax, ay, ux, uy, E } = best, nx = uy, ny = -ux, ang = Math.atan2(uy, ux);
    const dw = E * 0.9, dh = Math.min(eave - 1.5, H * 0.72), mx = ax + ux * E / 2, my = ay + uy * E / 2;
    vc.box(DOOR, mx + nx * 0.35, my + ny * 0.35, base, dw, 0.7, dh - base, ang);
    // kapı kanatları arasındaki dikey raylar ve üst kiriş
    const nPan = Math.max(3, Math.round(dw / 7));
    for (let k = 0; k <= nPan; k++) { const s = -dw / 2 + dw * k / nPan; vc.box(RIB, mx + ux * s + nx * 0.8, my + uy * s + ny * 0.8, base, 0.5, 0.5, dh - base, ang); }
    vc.box(TRIM, mx + nx * 0.6, my + ny * 0.6, dh, dw + 1, 1.2, 1.6, ang);
    // kapı ray kılavuzu (zeminde)
    vc.box([0.3, 0.3, 0.3], mx + nx * 1.4, my + ny * 1.4, 0, dw, 0.5, 0.18, ang);
    // yan ofis bloğu (büyük hangarlarda): kapının solundaki uçta, 2 kat, cam bant
    if (E > 40 && opt.office !== false) {
      const ox = ax - ux * 6 + nx * (-8), oy = ay - uy * 6 + ny * (-8);
      vc.box(WALL, ox, oy, base, 12, 16, 8.5 - base, ang);
      const so = vc.box(ROOF, ox, oy, 8.5, 12.6, 16.6, 0.6, ang); if (opt.snow) vc.snow(so, 0.6);
      for (const z of [1.2, 4.8]) vc.glass.box(ox, oy, z, 12.15, 16.15, 1.8, ang);
    }
  }
  (ctx.solid || (ctx.solid = [])).push({ P, top: H, ad: opt.ad || 'Hangar' });
  return o;
}

// ---------- itfaiye binası (ARFF): araç bölmeleri kırmızı kapılı salon, ofis ve gözetleme kulesi ----------
export function fireStation(ctx, vc, x, y, ang, opt = {}) {
  const { gh } = ctx;
  const base = gh(x, y) - 0.5, c = Math.cos(ang), s = Math.sin(ang);
  const at = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const WALL = [0.9, 0.88, 0.84], RED = [0.72, 0.12, 0.1], ROOF = [0.55, 0.56, 0.58];
  // salon: 40 x 20 x 8 (ön yüz +v yönünde)
  vc.box(WALL, x, y, base, 40, 20, 8.2 - base, ang);
  const r1 = vc.box(ROOF, x, y, 8.2, 40.6, 20.6, 0.6, ang); if (opt.snow) vc.snow(r1, 0.6);
  for (let k = 0; k < 5; k++) { const [px, py] = at(-16 + k * 8, 10.2); vc.box(RED, px, py, base, 5.6, 0.5, 6 - base, ang); }
  const [bx, by] = at(0, 10.4); vc.box([0.25, 0.25, 0.28], bx, by, 6.2, 40, 0.8, 0.8, ang);
  // ofis ve gözetleme kulesi
  const [ox, oy] = at(-27, 0); vc.box(WALL, ox, oy, base, 14, 16, 10 - base, ang);
  const r2 = vc.box(ROOF, ox, oy, 10, 14.6, 16.6, 0.5, ang); if (opt.snow) vc.snow(r2, 0.6);
  vc.glass.box(ox, oy, 1.4, 14.12, 16.12, 1.6, ang); vc.glass.box(ox, oy, 5.6, 14.12, 16.12, 1.6, ang);
  const [tx, ty] = at(-27, 4); vc.box(WALL, tx, ty, 10, 5, 5, 5, ang);
  vc.glass.box(tx, ty, 15, 5.6, 5.6, 2.6, ang);
  const r3 = vc.box(ROOF, tx, ty, 17.6, 6.4, 6.4, 0.5, ang); if (opt.snow) vc.snow(r3, 0.6);
  // önde beton saha
  const [fx, fy] = at(0, 22); vc.box([0.6, 0.6, 0.58], fx, fy, base, 44, 24, 0.12 - base + 0.02, ang);
  // önde park etmiş iki itfaiye aracı (kırmızı, 11 x 3 x 3.4)
  for (const u of [-16, -8]) { const [px, py] = at(u, 16); vc.box(RED, px, py, 0.3, 3, 10.5, 2.6, ang); vc.box([0.85, 0.85, 0.85], px, py, 2.9, 2.6, 6, 0.5, ang); vc.box([0.1, 0.1, 0.1], px, py, 0, 2.8, 9, 0.6, ang); }
  (ctx.solid || (ctx.solid = [])).push({ P: rectP(x, y, 40, 20, ang), top: 8.8, ad: 'İtfaiye binası' });
}

// ---------- otopark: asfalt saha + sıra sıra arabalar (örneklenmiş, renkli) ----------
export function carPark(ctx, vc, P, ang, seed = 1) {
  const { gh, M } = ctx;
  P = ccw(P);
  const [cx, cy] = centroid(P);
  const h0 = Math.max(0, ...P.map(([x, y]) => gh(x, y)));
  // saha (asfalt, beyaz çizgiler) ve kaldırım
  const pad = new GB([['tw', 2]]);
  pad.poly([P], h0 + 0.07, { tw: [0, 4] });
  const pm = new THREE.Mesh(pad.geometry(), M.apron); pm.renderOrder = 2; pm.name = 'otopark'; pm.matrixAutoUpdate = false; ctx.grp.add(pm);
  vc.prism([0.6, 0.6, 0.57], inflate(P, 0.4), h0 - 0.3, h0 + 0.2, false);
  // park yerleri: 2.6 m aralık, sıralar 16 m arayla (iki sıra sırt sırta + şerit)
  const c = Math.cos(ang), s = Math.sin(ang), o = obbOf(P);
  const spots = [], lines = new GB();
  for (let b = o.b0 + 3; b < o.b1 - 2; b += 16) for (const side of [0, 1]) {
    const bb = b + side * 5.2;
    if (bb > o.b1 - 2.5) continue;
    for (let a = o.a0 + 2; a < o.a1 - 2; a += 2.6) {
      const x = a * o.c - bb * o.s, y = a * o.s + bb * o.c;
      if (!pip(P, x, y)) continue;
      // çizgi (park yeri ayırıcı)
      const lx = (a - 1.3) * o.c - bb * o.s, ly = (a - 1.3) * o.s + bb * o.c;
      lines.box(lx, ly, h0 + 0.08, 0.12, 5, 0.03, o.ang);
      if (H1(x * 1.7 + seed, y) < 0.78) spots.push([x, y, o.ang + Math.PI / 2 + (side ? Math.PI : 0) + (H1(y, x) - 0.5) * 0.08]);
    }
  }
  if (lines.count) { const lm = new THREE.Mesh(lines.geometry(), M.paintW); lm.renderOrder = 5; lm.name = 'cizgi'; lm.matrixAutoUpdate = false; ctx.grp.add(lm); }
  if (!spots.length) return;
  const G = carGeom();
  const im = new THREE.InstancedMesh(G, kzMats(ctx).vc, spots.length);
  const ob = new THREE.Object3D(), col = new THREE.Color();
  const PAL = [0xf2f2f2, 0x1a1a1c, 0x8a8d90, 0xb0b4b8, 0x6b1a1a, 0x1f3550, 0xd8d0c0, 0x2e4a2e, 0x3a3a3e, 0xc0c4c8];
  spots.forEach(([x, y, a], i) => {
    ob.position.set(x, h0 + 0.05, -y); ob.rotation.set(0, a, 0); ob.updateMatrix(); im.setMatrixAt(i, ob.matrix);
    col.setHex(PAL[Math.floor(H1(x + 5, y + seed) * PAL.length)]); im.setColorAt(i, col);
  });
  im.computeBoundingSphere(); im.name = 'apron-araclari'; im.matrixAutoUpdate = false; ctx.grp.add(im);
}
let CAR = null;
function carGeom() {
  if (CAR) return CAR;
  const v = new VC();
  v.box([1, 1, 1], 0, 0, 0.22, 4.4, 1.8, 0.75, 0);
  v.box([0.32, 0.36, 0.4], -0.25, 0, 0.97, 2.4, 1.62, 0.55, 0);
  v.box([0.08, 0.08, 0.08], 0, 0, 0.0, 3.6, 1.86, 0.34, 0);
  CAR = v.g.geometry();
  return CAR;
}

// ---------- gözetim radarı: kafes kule ve dönen anten ----------
export function radar(ctx, x, y, H = 22, opt = {}) {
  const { gh } = ctx;
  const base = gh(x, y) - 0.5;
  const v = new VC(), STEEL = [0.7, 0.72, 0.74];
  const leg = (H) => 2.6 - H * 0.04;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const n = 6;
    for (let k = 0; k < n; k++) { const z0 = k * H / n, r = leg(z0 + H / n / 2); v.box(STEEL, x + sx * r, y + sy * r, base + z0, 0.35, 0.35, H / n + 0.05, 0); }
  }
  for (let k = 1; k <= 6; k++) { const z = base + k * H / 6, r = leg(z - base); v.box(STEEL, x, y - r, z - 0.15, 2 * r, 0.25, 0.25, 0); v.box(STEEL, x, y + r, z - 0.15, 2 * r, 0.25, 0.25, 0); v.box(STEEL, x - r, y, z - 0.15, 0.25, 2 * r, 0.25, 0); v.box(STEEL, x + r, y, z - 0.15, 0.25, 2 * r, 0.25, 0); }
  const top = base + H;
  const ps = v.box([0.85, 0.85, 0.82], x, y, top, 5.6, 5.6, 0.5, 0); if (opt.snow) v.snow(ps, 0.6);
  v.box([0.86, 0.86, 0.84], x, y, top + 0.5, 3.6, 3.6, 2.6, 0);
  // dönen anten: kendi örgüsü, merkezde (0, 0)
  const ant = new VC();
  ant.box([0.82, 0.84, 0.86], 0, 0, 0, 0.8, 0.8, 1.6, 0);
  for (let k = -3; k <= 3; k++) { const yy = k * 1.0, bend = 0.5 * (1 - (k / 3) ** 2); ant.box([0.78, 0.8, 0.82], 0.6 + bend, yy, 1.0, 0.25, 1.05, 2.6 - Math.abs(k) * 0.12, 0); }
  ant.box([0.5, 0.52, 0.55], -0.3, 0, 1.6, 1.6, 0.6, 0.8, 0);
  const grp = new THREE.Group(); grp.name = 'donanim-radar'; grp.matrixAutoUpdate = false;
  const tm = new THREE.Mesh(v.g.geometry(), kzMats(ctx).vc); tm.matrixAutoUpdate = false; grp.add(tm);
  const am = new THREE.Mesh(ant.g.geometry(), kzMats(ctx).vc); am.position.set(x, top + 3.1, -y); am.matrixAutoUpdate = false; am.updateMatrix(); grp.add(am);
  ctx.grp.add(grp);
  addCol(ctx, { x: ctx.d.x + x, y: ctx.d.y + y, r: 5, top: ctx.d.elev + top + 6 });
  const ph = H1(x, y) * 6;
  onTick(ctx, () => { if (!grp.visible) return; am.rotation.y = ph + performance.now() * 0.00126; am.updateMatrix(); });
  return grp;
}

// ---------- denize bakan pist kenarında taş tahkimat ----------
// pist boyunca, sol (kuzey) yanda karanın bittiği yeri bulur; şevi kaba kaya bloklarıyla kaplar
export function riprap(ctx, r, side = 1) {
  const { W, d, gh } = ctx;
  const ux = (r.b[0] - r.a[0]) / r.len, uy = (r.b[1] - r.a[1]) / r.len;
  const nx = -uy * side, ny = ux * side;   // side 1: pist yönünün solu
  const pts = [];
  for (let s = -250; s <= r.len + 250; s += 14) {
    let found = null;
    for (let o = 30; o < 450; o += 4) {
      const x = r.a[0] + ux * s + nx * o, y = r.a[1] + uy * s + ny * o;
      if (!W.isLand(d.x + x, d.y + y)) { found = [x, y, o]; break; }
    }
    pts.push(found);
  }
  const rock = new GB([['color', 3]]);
  let n = 0;
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k]; if (!p) continue;
    const [x, y, o] = p;
    // şev: kıyı çizgisinin iki yanında üç sıra iri blok
    for (let row = 0; row < 3; row++) for (let q = 0; q < 2; q++) {
      const t = (row - 1) * 6 + (H1(x + q, y + row) - 0.5) * 3, along = (q - 0.5) * 7 + (H1(y + q, x - row) - 0.5) * 3;
      const px = x - nx * t + ux * along, py = y - ny * t + uy * along;
      const g0 = Math.max(gh(px, py), -d.elev - 1.5);
      const sz = 2.4 + H1(px, py) * 2.2;
      const s0 = rock.count;
      rock.box(px, py, g0 - sz * 0.5, sz * (1 + H1(py, px) * 0.5), sz, sz * (0.8 + H1(px * 2, py) * 0.5), H1(px * 3, py * 3) * 3.14);
      const sh = 0.32 + H1(px * 5, py) * 0.18;
      const v = rock.a.color.v; for (let i = s0; i < rock.count; i++) { v[i * 3] = sh * 1.02; v[i * 3 + 1] = sh; v[i * 3 + 2] = sh * 0.95; }
      n++;
    }
  }
  if (!rock.count) return 0;
  const m = new THREE.Mesh(rock.geometry(), kzMats(ctx).vc); m.name = 'donanim-tahkimat'; m.matrixAutoUpdate = false; ctx.grp.add(m);
  return n;
}
export { H1, SNOW, ccw, area2, decal, inflate, obbOf, barrel, centroid, terminal, pip, nearestEdge };
