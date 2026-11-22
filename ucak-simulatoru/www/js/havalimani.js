// Havalimanları: Türkiye'deki bütün pistler, taksi yolları, apronlar ve havalimanı yapıları (OpenStreetMap, ODbL).
// - data/tr/hava.json: dizin (açılışta, ~50 KB). Ayrıntılar (taksi yolları, apronlar, park yerleri, binalar) uçak
//   yaklaşınca data/tr/hava/h_i_j.json gruplarından yüklenir; çizim 30 km içinde kurulur, 45 km dışında atılır.
// - Zemin: pist, taksi yolu, apron ayrı katmanlar (her biri tek çizim çağrısı); çizgiler parça gölgelendiricide hesaplanır
//   (eşik çizgileri, pist numaraları, orta çizgi, temas bölgesi, nişan noktası, kenar çizgileri, sarı taksi orta çizgisi).
//   Arazi araçla düzleştirildiği için yüzeyler araziyle aynı düzlemdedir; titreşmesin diye kırpma uzayında
//   sabit bir derinlik payıyla öne alınırlar (katmanlar arasında da sıra var).
// - Fizik: ground() pist, taksi yolu ve apronlarda {h, kind: 'runway'} döndürür (50 m'lik hücre ızgarası).
// - Işıklar: pist kenarı, eşik, son, yaklaşma ışık sistemi; PAPI renkleri bakış açısına göre gölgelendiricide.
// - Ayrıntılı havalimanları (İstanbul, Sabiha Gökçen, Atatürk, Esenboğa, Adnan Menderes, Antalya): js/havalimanlari/*.js
//   modülleri; her terminal ayrı, adlandırılmış bir THREE.Group (userData.id) — ileride iç mekân eklenebilsin diye.
import * as THREE from '../vendor/three.module.min.js';
import { ShapeUtils } from '../vendor/three.module.min.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
async function json(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
const DETAIL = { LTFM: 'ltfm', LTFJ: 'ltfj', LTBA: 'ltba', LTAC: 'ltac', LTBJ: 'ltbj', LTAI: 'ltai' };
export const BUILD_R = 30000, DROP_R = 45000, LOAD_R = 60000;

// ---------- derinlik payı (kırpma uzayında sabit): araziyle aynı düzlemdeki yüzeyler öne çıkar ----------
export function decal(mat, bias) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n gl_Position.z -= ${bias.toExponential(3)} * gl_Position.w;`);
  };
  mat.customProgramCacheKey = () => 'decal' + bias + (mat.userData.key || '');
  return mat;
}

// ---------- pist numarası yazı dokusu: 0-9, L, C, R ----------
function glyphTex() {
  const G = '0123456789LCR', W = 64, H = 128;
  const c = document.createElement('canvas'); c.width = W * G.length; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < G.length; i++) {
    g.save(); g.translate(i * W + W / 2, H / 2 + 4); g.scale(0.62, 1.0);
    g.font = 'bold 132px Arial, Helvetica, sans-serif'; g.fillText(G[i], 0, 0); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  return t;
}

// ---------- ortak malzemeler ----------
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const glyph = glyphTex();
  const noise = `
    float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
    float bnd(float x, float a, float b, float w){ return clamp(min(x - a, b - x) / w + 0.5, 0.0, 1.0); }
`;
  // pist: rw = (sağa uzaklık, a ucundan uzaklık) m; ri = (uzunluk, en (eksi: beton), a numarası, b numarası); numara = n*4 + harf (0 yok, 1 L, 2 C, 3 R)
  const runway = decal(new THREE.MeshLambertMaterial({ color: 0xffffff }), 3.6e-6);
  runway.userData.key = 'rw';
  runway.onBeforeCompile = ((prev) => (sh, r) => {
    prev(sh, r);
    sh.uniforms.glyphTex = { value: glyph };
    sh.vertexShader = 'attribute vec2 rw; attribute vec4 ri; varying vec2 vRw; varying vec4 vRi;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vRw = rw; vRi = ri;');
    sh.fragmentShader = 'uniform sampler2D glyphTex; varying vec2 vRw; varying vec4 vRi;\n' + noise + `
      float glyph(float g, vec2 q){ if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0; return texture2D(glyphTex, vec2((g + q.x) / 13.0, q.y)).r; }
      float desig(float code, vec2 p){
        // p.x: pilotun sağına, p.y: eşikten uzaklık (m)
        float num = floor(code / 4.0 + 0.01), let = code - num * 4.0;
        float y0 = 48.0, m = 0.0;
        if (let > 0.5) { m += glyph(9.0 + let, vec2((p.x + 2.1) / 4.2, (p.y - y0) / 9.0)); y0 += 12.0; }
        float t = floor(num / 10.0 + 0.01), o = num - t * 10.0;
        m += glyph(t, vec2((p.x + 4.6) / 4.2, (p.y - y0) / 9.0));
        m += glyph(o, vec2((p.x - 0.4) / 4.2, (p.y - y0) / 9.0));
        return m;
      }
      ` + sh.fragmentShader.replace('#include <map_fragment>', `
      float L = vRi.x, W = abs(vRi.y), hw = W * 0.5;
      float x = vRw.x, s = vRw.y;
      vec2 aa = max(fwidth(vRw), vec2(0.03)) * 0.75;
      bool bEnd = s > L * 0.5;
      float sl = bEnd ? L - s : s, xl = bEnd ? -x : x, ax = abs(x);
      float m = 0.0;
      // kenar çizgileri
      if (W >= 25.0) m += bnd(ax, hw - 1.4, hw - 0.5, aa.x);
      // eşik çizgileri (30 m, 1.8 m genişlik, 1.8 m ara; orta boşluk 3.6 m)
      float nb = W >= 58.0 ? 8.0 : W >= 43.0 ? 6.0 : W >= 28.0 ? 4.0 : W >= 21.0 ? 3.0 : 2.0;
      float tx = ax - 1.8, k = floor(tx / 3.6);
      if (tx > 0.0 && k < nb) m += bnd(tx - k * 3.6, 0.0, 1.8, aa.x) * bnd(sl, 6.0, 36.0, aa.y);
      // numara ve harf
      m += desig(bEnd ? vRi.w : vRi.z, vec2(xl, sl));
      // orta çizgi: 30 m çizgi, 20 m boşluk
      float cw = W >= 43.0 ? 0.9 : 0.45;
      float cl = s - 78.0;
      if (cl > 0.0 && s < L - 78.0) m += bnd(ax, -cw * 0.5, cw * 0.5, aa.x) * bnd(mod(cl, 50.0), 0.0, 30.0, aa.y);
      // nişan noktası ve temas bölgesi
      float aim = L >= 2400.0 ? 400.0 : L >= 1500.0 ? 300.0 : 250.0;
      float xi = W >= 43.0 ? 9.0 : W * 0.22, aw = W >= 43.0 ? 8.0 : 4.5;
      if (L >= 900.0) m += bnd(ax, xi, xi + aw, aa.x) * bnd(sl, aim, aim + (L >= 2400.0 ? 50.0 : 45.0), aa.y);
      float tz = floor(sl / 150.0 + 0.0001), tzs = sl - tz * 150.0;
      float tmax = L >= 2400.0 ? 6.0 : L >= 1500.0 ? 4.0 : L >= 1200.0 ? 3.0 : 0.0;
      if (tz >= 1.0 && tz <= tmax && abs(tz * 150.0 - aim) > 60.0) {
        float nbar = tz <= 2.0 ? 3.0 : tz <= 4.0 ? 2.0 : 1.0;
        float bx = ax - xi, bk = floor(bx / 3.3);
        if (bx > 0.0 && bk < nbar) m += bnd(bx - bk * 3.3, 0.0, 1.8, aa.x) * bnd(tzs, 0.0, 22.5, aa.y);
      }
      m = clamp(m, 0.0, 1.0);
      // kaplama: asfalt / beton, lastik izleri, yama ve derzler
      float n1 = vn(vRw * vec2(0.35, 0.05)), n2 = vn(vRw * vec2(2.0, 0.6));
      vec3 base = vRi.y < 0.0 ? vec3(0.20, 0.20, 0.19) : vec3(0.050, 0.051, 0.054);
      base *= 0.86 + 0.2 * n1 + 0.08 * n2;
      if (vRi.y < 0.0) base *= 1.0 - 0.18 * (1.0 - bnd(mod(s, 5.0), 0.06, 4.94, aa.y)) - 0.18 * (1.0 - bnd(mod(x + hw, 7.5), 0.06, 7.44, aa.x));
      float rub = (1.0 - smoothstep(4.0, 11.0, ax)) * bnd(sl, 150.0, 1100.0, 120.0) * (0.55 + 0.45 * vn(vec2(x * 1.3, s * 0.02)));
      base = mix(base, vec3(0.018), rub * 0.85);
      vec3 col = mix(base, vec3(0.78, 0.78, 0.76) * (1.0 - 0.6 * rub), m);
      diffuseColor.rgb = col;
      `);
  })(runway.onBeforeCompile);
  // taksi yolu ve apron: tw = (eksene uzaklık m, tür): 0 taksi yolu (asfalt, sarı orta çizgi), 1 park yolu (beton, orta çizgi), 2 durma yolu, 3 apron (beton), 4 asfalt alan, 5 omuz
  const mkTaxi = (bias, key) => {
    const m = decal(new THREE.MeshLambertMaterial({ color: 0xffffff }), bias);
    m.userData.key = key;
    m.onBeforeCompile = ((prev) => (sh, r) => {
      prev(sh, r);
      sh.vertexShader = 'attribute vec2 tw; varying vec2 vTw; varying vec2 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTw = tw; vWp = position.xz;');
      sh.fragmentShader = 'varying vec2 vTw; varying vec2 vWp;\n' + noise + sh.fragmentShader.replace('#include <map_fragment>', `
        float kind = floor(vTw.y + 0.5);
        float n1 = vn(vWp * 0.08), n2 = vn(vWp * 0.9);
        vec3 asph = vec3(0.058, 0.058, 0.060) * (0.85 + 0.22 * n1 + 0.08 * n2);
        vec3 conc = vec3(0.24, 0.24, 0.225) * (0.9 + 0.14 * n1 + 0.05 * n2);
        vec2 wa = max(fwidth(vWp), vec2(0.03));
        float j = (1.0 - bnd(mod(vWp.x, 5.0), 0.05, 4.95, wa.x)) + (1.0 - bnd(mod(vWp.y, 5.0), 0.05, 4.95, wa.y));
        conc *= 1.0 - 0.16 * clamp(j, 0.0, 1.0);
        vec3 col = (kind == 1.0 || kind == 3.0) ? conc : kind == 5.0 ? asph * 1.5 : asph;
        if (kind < 1.5) { float a2 = max(fwidth(vTw.x), 0.02); float ln = bnd(abs(vTw.x), -0.2, 0.2, a2 * 0.8); col = mix(col, vec3(0.62, 0.42, 0.04), ln * clamp(0.25 / a2, 0.0, 1.0)); }
        diffuseColor.rgb = col;
        `);
    })(m.onBeforeCompile || (() => {}));
    return m;
  };
  MATS = {
    runway, apron: mkTaxi(2.4e-6, 'ap'), taxi: mkTaxi(3.0e-6, 'tx'),
    paint: decal(new THREE.MeshLambertMaterial({ color: 0xc8a020 }), 4.2e-6),
    paintW: decal(new THREE.MeshLambertMaterial({ color: 0xd8d8d0 }), 4.2e-6),
    grassStrip: decal(new THREE.MeshLambertMaterial({ color: 0x6f7a4a }), 2.0e-6),
    metal: new THREE.MeshLambertMaterial({ color: 0xb8bcc0 }), dark: new THREE.MeshLambertMaterial({ color: 0x4a4e52 }),
    white: new THREE.MeshLambertMaterial({ color: 0xeeeeea }), red: new THREE.MeshLambertMaterial({ color: 0xc8402c }),
    orange: new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }), conc: new THREE.MeshLambertMaterial({ color: 0xd6d3cc }),
    hangarWall: new THREE.MeshLambertMaterial({ color: 0xc9ced3 }), hangarRoof: new THREE.MeshLambertMaterial({ color: 0x9aa3ab, side: THREE.DoubleSide }),
    roof: new THREE.MeshLambertMaterial({ color: 0xb4b8bb }), termWall: new THREE.MeshLambertMaterial({ color: 0xe4e2dc }),
    glass: null, cab: null,
  };
  return MATS;
}
// cam malzemesi: gökyüzü yansıması (ortam haritası) ve dikey kayıt çizgileri
export function glassMats(world) {
  const M = mats();
  if (M.glass) return M;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#9fb6c8'); gr.addColorStop(1, '#6f8798');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#c9ced2'; g.fillRect(0, 0, 4, 128); g.fillRect(0, 0, 64, 5); g.fillRect(0, 64, 64, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const env = world.envMap();
  M.glass = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, metalness: 0.55, roughness: 0.18, envMap: env, envMapIntensity: 1.1 });
  M.cab = new THREE.MeshStandardMaterial({ color: 0x4f6f80, metalness: 0.7, roughness: 0.1, envMap: env });
  M.body = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.25, roughness: 0.45, envMap: env, envMapIntensity: 0.8, side: THREE.DoubleSide });
  return M;
}

// ---------- geometri yardımcıları (yerel: x doğu, y kuzey; three: X = x, Z = -y) ----------
export class GB {
  constructor(attrs = []) { this.p = []; this.n = []; this.i = []; this.a = {}; for (const a of attrs) this.a[a[0]] = { size: a[1], v: [] }; this.uv = null; }
  get count() { return this.p.length / 3; }
  vert(x, h, y, nx = 0, ny = 1, nz = 0, at = {}) { this.p.push(x, h, -y); this.n.push(nx, ny, -nz); for (const k in this.a) { const v = at[k]; const s = this.a[k].size; for (let q = 0; q < s; q++) this.a[k].v.push(v ? v[q] : 0); } return this.count - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  // yatay çokgen (CCW halka + delikler), yükseklik h
  poly(rings, h, at = {}) {
    const outer = rings[0].map((p) => new THREE.Vector2(p[0], p[1]));
    if (ShapeUtils.isClockWise(outer)) outer.reverse();
    const holes = rings.slice(1).map((r) => { const v = r.map((p) => new THREE.Vector2(p[0], p[1])); if (!ShapeUtils.isClockWise(v)) v.reverse(); return v; });
    let tris; try { tris = ShapeUtils.triangulateShape(outer, holes); } catch (e) { return; }
    const all = outer.concat(...holes);
    const s = this.count;
    const fn = typeof at === 'function';
    for (const v of all) this.vert(v.x, h, v.y, 0, 1, 0, fn ? at(v.x, v.y) : at);
    for (const t of tris) this.tri(s + t[0], s + t[1], s + t[2]);
  }
  // yatay şerit (polyline boyunca genişlik w), at(dx) -> öznitelik
  ribbon(pts, w, h, at) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      const L = Math.hypot(bx - ax, by - ay); if (L < 0.05) continue;
      const nx = -(by - ay) / L * w / 2, ny = (bx - ax) / L * w / 2;
      const s = this.count;
      this.vert(ax - nx, h, ay - ny, 0, 1, 0, at(w / 2)); this.vert(bx - nx, h, by - ny, 0, 1, 0, at(w / 2));
      this.vert(bx + nx, h, by + ny, 0, 1, 0, at(-w / 2)); this.vert(ax + nx, h, ay + ny, 0, 1, 0, at(-w / 2));
      this.quad(s, s + 1, s + 2, s + 3);
    }
  }
  disc(x, y, r, h, at, seg = 12) {
    const s = this.count; this.vert(x, h, y, 0, 1, 0, at(0));
    for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2; this.vert(x + Math.cos(a) * r, h, y + Math.sin(a) * r, 0, 1, 0, at(r)); }
    for (let k = 0; k < seg; k++) this.tri(s, s + 1 + k, s + 1 + (k + 1) % seg);
  }
  // kutu: merkez (x, y), taban h0, boy (w doğrultu boyunca, d enine), yükseklik hh, yön açısı ang (x eksenine göre, radyan)
  box(x, y, h0, w, d, hh, ang = 0) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
    this.prism(P, h0, h0 + hh);
  }
  // dik prizma (CCW taban), duvarlar + tavan
  prism(P, h0, h1, top = true, bottom = false) {
    const n = P.length;
    for (let k = 0; k < n; k++) {
      const [ax, ay] = P[k], [bx, by] = P[(k + 1) % n];
      const L = Math.hypot(bx - ax, by - ay); if (L < 0.01) continue;
      const nx = (by - ay) / L, ny = -(bx - ax) / L;
      const s = this.count;
      this.vert(ax, h0, ay, nx, 0, ny); this.vert(bx, h0, by, nx, 0, ny); this.vert(bx, h1, by, nx, 0, ny); this.vert(ax, h1, ay, nx, 0, ny);
      this.quad(s, s + 1, s + 2, s + 3);
      if (this.uv) { const u0 = this._per || 0; this._per = u0 + L; this.uv.push(u0, h0, u0 + L, h0, u0 + L, h1, u0, h1); }
    }
    if (top) { const s0 = this.count; this.poly([P], h1); if (this.uv) for (let k = s0; k < this.count; k++) this.uv.push(this.p[k * 3], -this.p[k * 3 + 2]); }
    if (bottom) { const s = this.count; this.poly([P], h0); for (let k = s; k < this.count; k++) this.n[k * 3 + 1] = -1; for (let k = this.i.length - 3; k >= 0 && this.i[k] >= s; k -= 3) { const t = this.i[k + 1]; this.i[k + 1] = this.i[k + 2]; this.i[k + 2] = t; } }
  }
  // dönel cisim: profil [[r, h], ...], merkez (x, y)
  lathe(x, y, prof, seg = 16, h0 = 0) {
    const s0 = this.count;
    for (let k = 0; k <= seg; k++) {
      const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let j = 0; j < prof.length; j++) {
        const [r, h] = prof[j];
        const [r0, h0p] = prof[Math.max(0, j - 1)], [r1, h1p] = prof[Math.min(prof.length - 1, j + 1)];
        let nr = h1p - h0p, nh = -(r1 - r0); const l = Math.hypot(nr, nh) || 1; nr /= l; nh /= l;
        this.vert(x + c * r, h0 + h, y + s * r, c * nr, nh, s * nr);
      }
    }
    const P = prof.length;
    for (let k = 0; k < seg; k++) for (let j = 0; j < P - 1; j++) { const a = s0 + k * P + j, b = a + P; this.quad(a, b, b + 1, a + 1); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    for (const k in this.a) g.setAttribute(k, new THREE.Float32BufferAttribute(this.a[k].v, this.a[k].size));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- havalimanı yöneticisi ----------
export class Airports {
  constructor(world) {
    this.world = world; this.root = world.root; this.base = world.base;
    this.list = []; this.groups = new Map(); this.det = new Map(); this.built = new Map();
    this.near = []; this.frame = 0; this.modules = {};
  }
  async load() {
    const d = await json(this.base + 'hava.json');
    this.list = d.havalimanlari; this.patches = d.yamalar || [];
    for (const a of this.list) {
      a.rw = a.rws.map((r) => {
        const ax = a.x + r.a[0], ay = a.y + r.a[1], bx = a.x + r.b[0], by = a.y + r.b[1], L = Math.hypot(bx - ax, by - ay);
        return { ax, ay, ux: (bx - ax) / L, uy: (by - ay) / L, len: L, w: r.w, paved: r.paved, ref: r.d1 + '/' + r.d2 };
      });
    }
  }
  // eski arayüz: her havalimanının ana pisti (başlangıç noktaları, küçük ve büyük harita)
  mainRunways(prefer = {}) {
    const out = [];
    for (const a of this.list) {
      const cand = a.rw.filter((r) => r.paved);
      if (!cand.length) continue;
      let r = cand[0];
      if (prefer[a.id]) r = cand.find((q) => q.ref === prefer[a.id] || q.ref.split('/').reverse().join('/') === prefer[a.id]) || r;
      if (r.len < 1200 && !prefer[a.id]) continue;
      out.push({ code: a.id, name: a.ad, ref: r.ref, ax: r.ax, ay: r.ay, ux: r.ux, uy: r.uy, len: r.len, w: r.w, elev: a.elev, heading: Math.atan2(r.ux, r.uy) });
    }
    return out;
  }
  // bir noktanın çevresindeki ayrıntıları iste
  ensure(x, y, r = LOAD_R) {
    let pend = 0;
    for (const a of this.list) {
      if (Math.hypot(a.x - x, a.y - y) > r) continue;
      const g = this.groups.get(a.dosya);
      if (!g) {
        const e = { state: 1 };
        this.groups.set(a.dosya, e);
        json(this.base + a.dosya).then((arr) => { e.state = 2; for (const d of arr) this.det.set(d.id, d); this._index(arr); }).catch((err) => { console.warn(err); e.state = -1; });
        pend++;
      } else if (g.state === 1) pend++;
    }
    return pend;
  }
  // fizik için kaplamalı alan ızgarası
  _index(arr) {
    for (const d of arr) {
      const cells = new Map(), C = 50;
      const add = (shape, x0, y0, x1, y1) => {
        for (let j = Math.floor(y0 / C); j <= Math.floor(y1 / C); j++) for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) {
          const k = i * 100000 + j; let l = cells.get(k); if (!l) cells.set(k, (l = [])); l.push(shape);
        }
      };
      for (const r of d.rws) {
        if (!r.paved) continue;
        const ux = (r.b[0] - r.a[0]) / r.len, uy = (r.b[1] - r.a[1]) / r.len;
        const sh = { t: 0, ax: r.a[0], ay: r.a[1], ux, uy, len: r.len, hw: r.w / 2 + 8 };
        const xs = [r.a[0], r.b[0]], ys = [r.a[1], r.b[1]], m = r.w / 2 + 70;
        add(sh, Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m);
        sh.ax -= ux * 60; sh.ay -= uy * 60; sh.len += 120;
      }
      for (const t of d.twy) for (let k = 0; k < t.p.length - 1; k++) {
        const [ax, ay] = t.p[k], [bx, by] = t.p[k + 1], L = Math.hypot(bx - ax, by - ay); if (L < 0.1) continue;
        const sh = { t: 0, ax, ay, ux: (bx - ax) / L, uy: (by - ay) / L, len: L, hw: t.w / 2 + 3, cap: t.w / 2 + 3 };
        const m = t.w / 2 + 4; add(sh, Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m);
      }
      for (const pl of d.apron.concat(d.twa)) {
        const ring = pl[0]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        add({ t: 1, rings: pl }, x0 - 2, y0 - 2, x1 + 2, y1 + 2);
      }
      d.cells = cells; d.C = C;
    }
  }
  // fizik: kaplamalı yüzeyde mi? (mutlak x doğu, y kuzey)
  ground(x, y) {
    for (const a of this.near) {
      const d = this.det.get(a.id);
      const lx = x - a.x, ly = y - a.y;
      if (d && d.cells) {
        const l = d.cells.get(Math.floor(lx / d.C) * 100000 + Math.floor(ly / d.C));
        if (!l) continue;
        for (const s of l) {
          if (s.t === 0) {
            const px = lx - s.ax, py = ly - s.ay, al = px * s.ux + py * s.uy, cr = -px * s.uy + py * s.ux;
            if (Math.abs(cr) <= s.hw && ((al >= 0 && al <= s.len) || (s.cap && (al * al + cr * cr < s.cap * s.cap || (al - s.len) ** 2 + cr * cr < s.cap * s.cap)))) return { h: a.elev + 0.12, kind: 'runway' };
          } else if (pip(s.rings, lx, ly)) return { h: a.elev + 0.12, kind: 'runway' };
        }
      } else {
        for (const r of a.rw) {
          if (!r.paved) continue;
          const px = x - r.ax, py = y - r.ay, al = px * r.ux + py * r.uy, cr = -px * r.uy + py * r.ux;
          if (al >= -60 && al <= r.len + 60 && Math.abs(cr) <= r.w / 2 + 4) return { h: a.elev + 0.12, kind: 'runway' };
        }
      }
    }
    return null;
  }
  // her kare: yakındaki havalimanları, kurma ve atma (kare başına en çok bir havalimanı kurulur)
  update(cam) {
    this.frame++;
    if (this.frame % 15 === 1) {
      this.near = this.list.filter((a) => Math.hypot(a.x - cam.x, a.y - cam.y) < 9000);
      this.ensure(cam.x, cam.y);
    }
    let did = false;
    for (const a of this.list) {
      const d = Math.hypot(a.x - cam.x, a.y - cam.y);
      const b = this.built.get(a.id);
      if (b && d > DROP_R) { this._drop(a.id); continue; }
      if (!b && !did && d < BUILD_R && this.det.has(a.id)) {
        if (!this.world.heights.patchReady(a.x, a.y)) continue;
        did = true;
        try { this._build(a, this.det.get(a.id)); } catch (e) { console.error('Havalimanı ' + a.id, e); this.built.set(a.id, { grp: null }); }
      }
    }
    for (const [, b] of this.built) if (b.tick) b.tick(cam);
    this.pending = this.list.some((a) => !this.built.has(a.id) && this.det.has(a.id) && Math.hypot(a.x - cam.x, a.y - cam.y) < 12000) ? 1 : 0;
  }
  _drop(id) {
    const b = this.built.get(id); this.built.delete(id);
    if (!b || !b.grp) return;
    this.root.remove(b.grp);
    b.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  _build(a, d) {
    const W = this.world, M = mats();
    const grp = new THREE.Group(); grp.name = 'havalimani:' + a.id; grp.userData = { id: a.id, ad: a.ad };
    grp.position.set(d.x, d.elev, -d.y); grp.matrixAutoUpdate = false; grp.updateMatrix();
    const gh = (lx, ly) => W.terrainH(d.x + lx, d.y + ly) - d.elev;     // yerel arazi yüksekliği
    // 1) apron ve alanlar
    const ap = new GB([['tw', 2]]);
    for (const pl of d.apron) ap.poly(pl, 0.06, { tw: [0, 3] });
    for (const pl of d.twa) ap.poly(pl, 0.06, { tw: [0, 4] });
    // 2) taksi yolları: şerit + birleşim diskleri, omuzlar
    const tx = new GB([['tw', 2]]);
    const joints = new Map();
    for (const t of d.twy) {
      const kind = t.l === 2 ? 2 : t.l === 1 ? 1 : 0;
      tx.ribbon(t.p, t.w, 0.09, (o) => ({ tw: [o, kind] }));
      for (const p of [t.p[0], t.p[t.p.length - 1]]) { const k = Math.round(p[0]) + ':' + Math.round(p[1]); const j = joints.get(k); if (!j || j[2] < t.w) joints.set(k, [p[0], p[1], t.w, kind]); }
      for (let k = 1; k < t.p.length - 1; k++) tx.disc(t.p[k][0], t.p[k][1], t.w / 2, 0.09, (r) => ({ tw: [9, kind === 1 ? 1 : 4] }), 10);
    }
    for (const [, [x, y, w, kind]] of joints) tx.disc(x, y, w / 2, 0.09, () => ({ tw: [9, kind === 1 ? 1 : 4] }), 12);
    // 3) pistler (+ omuzlar)
    const rw = new GB([['rw', 2], ['ri', 4]]);
    const grass = new GB();
    const lights = []; // [x, y, h, r, g, b, boy]
    const papi = [];   // [x, y, h, eşik açısı]
    const furn = new GB();    // ışık direkleri, PAPI kutuları, rüzgar tulumu direği
    const sock = new GB();
    const code = (s) => { const n = parseInt(s, 10) || 0; const l = s.slice(-1); return n * 4 + (l === 'L' ? 1 : l === 'C' ? 2 : l === 'R' ? 3 : 0); };
    for (const r of d.rws) {
      const ux = (r.b[0] - r.a[0]) / r.len, uy = (r.b[1] - r.a[1]) / r.len, rx = uy, ry = -ux; // sağ = (uy, -ux)
      const L = r.len, hw = r.w / 2;
      if (!r.paved) {
        const P = [[-hw, 0], [hw, 0], [hw, L], [-hw, L]].map(([c, s]) => [r.a[0] + rx * c + ux * s, r.a[1] + ry * c + uy * s]);
        grass.poly([P], 0.05); continue;
      }
      const conc = /concrete|beton/.test(r.surf || '') && !/asph|asfal/.test(r.surf || '');
      const ri = [L, conc ? -r.w : r.w, code(r.d1), code(r.d2)];
      const seg = Math.max(1, Math.ceil(L / 400));
      for (let k = 0; k < seg; k++) {
        const s0 = L * k / seg, s1 = L * (k + 1) / seg;
        const v = (c, s) => rw.vert(r.a[0] + rx * c + ux * s, 0.12, r.a[1] + ry * c + uy * s, 0, 1, 0, { rw: [c, s], ri });
        const q0 = v(-hw, s0), q1 = v(hw, s0), q2 = v(hw, s1), q3 = v(-hw, s1);
        rw.quad(q0, q1, q2, q3);
      }
      // omuzlar (7.5 m) ve uçlar
      if (r.w >= 30) for (const sd of [-1, 1]) {
        const c0 = sd * hw, c1 = sd * (hw + 7.5);
        const P = [[c0, -30], [c1, -30], [c1, L + 30], [c0, L + 30]].map(([c, s]) => [r.a[0] + rx * c + ux * s, r.a[1] + ry * c + uy * s]);
        if (sd < 0) P.reverse();
        tx.poly([P], 0.09, { tw: [9, 5] });
      }
      for (const e of [0, 1]) {
        const s0 = e ? L : -60, s1 = e ? L + 60 : 0;
        const P = [[-hw, s0], [hw, s0], [hw, s1], [-hw, s1]].map(([c, s]) => [r.a[0] + rx * c + ux * s, r.a[1] + ry * c + uy * s]);
        tx.poly([P.reverse()], 0.09, { tw: [9, 2] });
      }
      // ışıklar: kenar (60 m), eşik (yeşil), son (kırmızı)
      const at = (c, s) => [r.a[0] + rx * c + ux * s, r.a[1] + ry * c + uy * s];
      for (let s = 0; s <= L; s += 60) for (const sd of [-1, 1]) { const [x, y] = at(sd * (hw + 1.5), s); lights.push([x, y, 0.5, 1, 0.95, 0.8, 1]); }
      for (let c = -hw; c <= hw + 0.1; c += 3) { let [x, y] = at(c, -1.5); lights.push([x, y, 0.4, 0.2, 1, 0.3, 1]); [x, y] = at(c, L + 1.5); lights.push([x, y, 0.4, 0.2, 1, 0.3, 1]); }
      // yaklaşma ışık sistemi (uzun pistlerde, iki uçta): 900 m, 30 m arayla, 300 m'de çapraz çubuk
      if (L >= 2400) for (const e of [0, 1]) {
        const sg = e ? 1 : -1, base = e ? L : 0;
        for (let dd = 30; dd <= 900; dd += 30) {
          const [x, y] = at(0, base + sg * dd);
          const g0 = gh(x, y), top = Math.max(g0, 0) + 1.2;
          furn.box(x, y, g0 - 0.5, 0.25, 0.25, top - g0 + 0.5, 0);
          const bar = dd === 300 ? 15 : 2.2;
          furn.box(x, y, top, 0.3, bar * 2, 0.25, Math.atan2(uy, ux));
          for (let c = -2; c <= 2; c++) { const q = at(c * 1.0, base + sg * dd); lights.push([q[0], q[1], top + 0.35, 1, 1, 0.92, 1.3]); }
          if (dd === 300) for (let c = -15; c <= 15; c += 1.5) { const q = at(c, base + sg * dd); lights.push([q[0], q[1], top + 0.35, 1, 1, 0.92, 1.3]); }
        }
      }
      // PAPI: OSM'de yoksa her iki uçta, nişan noktası hizasında solda 4 ünite
      if (!d.papi.length && L >= 1500) for (const e of [0, 1]) {
        const aim = L >= 2400 ? 400 : 300;
        for (let k = 0; k < 4; k++) {
          const c = -(hw + 15 + k * 9), s = e ? L - aim : aim;
          const [x, y] = e ? at(-c, s) : at(c, s);
          papi.push([x, y, 0.9, 2.5 + (3 - k) * 0.333, e ? -ux : ux, e ? -uy : uy]);
          furn.box(x, y, 0, 1.4, 0.9, 0.8, Math.atan2(uy, ux));
        }
      }
    }
    // OSM'deki PAPI'ler: en yakın pist ucuna göre
    if (d.papi.length) for (const [x, y] of d.papi) {
      let best = null, bd = 1e9;
      for (const r of d.rws) for (const e of [0, 1]) {
        const p = e ? r.b : r.a; const dd = Math.hypot(p[0] - x, p[1] - y); if (dd < bd) { bd = dd; best = [r, e]; }
      }
      if (!best || bd > 900) continue;
      const [r, e] = best, ux = (r.b[0] - r.a[0]) / r.len * (e ? -1 : 1), uy = (r.b[1] - r.a[1]) / r.len * (e ? -1 : 1);
      const thr = e ? r.b : r.a; const cr = Math.abs(-(x - thr[0]) * uy + (y - thr[1]) * ux);
      papi.push([x, y, 0.9, 2.5 + clamp((cr - r.w / 2 - 15) / 9, 0, 3) * 0.333, ux, uy]);
      furn.box(x, y, 0, 1.4, 0.9, 0.8, Math.atan2(uy, ux));
    }
    // 4) çizgiler: park yeri çizgileri (sarı), bekleme noktaları (4 çizgi)
    const pt = new GB();
    for (const p of d.pp) pt.ribbon(p.p, 0.3, 0.14, () => ({}));
    const segDir = (x, y) => {
      let best = null, bd = 1e9;
      for (const t of d.twy) for (let k = 0; k < t.p.length - 1; k++) {
        const [ax, ay] = t.p[k], [bx, by] = t.p[k + 1], L = Math.hypot(bx - ax, by - ay); if (L < 0.1) continue;
        const ux = (bx - ax) / L, uy = (by - ay) / L, al = clamp((x - ax) * ux + (y - ay) * uy, 0, L);
        const dd = Math.hypot(ax + ux * al - x, ay + uy * al - y); if (dd < bd) { bd = dd; best = [ux, uy, t.w, ax + ux * al, ay + uy * al]; }
      }
      return bd < 30 ? best : null;
    };
    for (const [x, y] of d.hold) {
      const s = segDir(x, y); if (!s) continue;
      const [ux, uy, w, cx2, cy2] = s, nx = -uy, ny = ux;
      for (let k = 0; k < 4; k++) {
        const o = (k - 1.5) * 0.9;
        const a0 = [cx2 + ux * o - nx * w / 2, cy2 + uy * o - ny * w / 2], a1 = [cx2 + ux * o + nx * w / 2, cy2 + uy * o + ny * w / 2];
        if (k < 2) pt.ribbon([a0, a1], 0.3, 0.14, () => ({}));
        else for (let q = 0; q < 8; q++) { const t0 = q / 8, t1 = t0 + 0.06; pt.ribbon([[a0[0] + (a1[0] - a0[0]) * t0, a0[1] + (a1[1] - a0[1]) * t0], [a0[0] + (a1[0] - a0[0]) * t1, a0[1] + (a1[1] - a0[1]) * t1]], 0.3, 0.14, () => ({})); }
      }
    }
    // rüzgar tulumları
    for (const [x, y] of d.tulum) {
      const g0 = Math.min(0, gh(x, y));
      furn.box(x, y, g0, 0.2, 0.2, 7 - g0, 0);
      // tulum: yatay kesik koni, rüzgar yönüne (poyraz) doğru
      const s0 = sock.count, prof = [[0, 0.45], [0.8, 0.42], [1.6, 0.38], [2.4, 0.33], [3.2, 0.28]];
      for (let k = 0; k <= 10; k++) { const an = k / 10 * Math.PI * 2; for (const [dx, r2] of prof) sock.vert(x + 0.3 + dx * 0.77, 6.4 + Math.cos(an) * r2 - dx * 0.12, y - dx * 0.64 + Math.sin(an) * r2, 0, Math.cos(an), Math.sin(an)); }
      for (let k = 0; k < 10; k++) for (let j = 0; j < prof.length - 1; j++) { const a2 = s0 + k * prof.length + j, b2 = a2 + prof.length; sock.quad(a2, a2 + 1, b2 + 1, b2); }
    }
    const meshes = [];
    const add = (gb, mat, ro, name) => { if (!gb.count) return null; const m = new THREE.Mesh(gb.geometry(), mat); m.renderOrder = ro; m.name = name; m.matrixAutoUpdate = false; grp.add(m); meshes.push(m); return m; };
    add(grass, M.grassStrip, 1, 'cim-pist');
    add(ap, M.apron, 2, 'apron');
    add(tx, M.taxi, 3, 'taksi');
    add(rw, M.runway, 4, 'pist');
    add(pt, M.paint, 5, 'cizgi');
    add(furn, M.metal, 0, 'donanim');
    add(sock, M.orange, 0, 'tulum');
    // ışıklar
    if (lights.length) grp.add(lightPoints(lights));
    if (papi.length) grp.add(papiPoints(papi));
    // 5) binalar (terminaller, hangarlar, kuleler) ve ayrıntılı modül
    const ctx = { W, a, d, grp, M: glassMats(W), gh, parts: new Map(), GB };
    ctx.part = (id, obj) => { obj.name = id; obj.userData.id = id; ctx.parts.set(id, obj); grp.add(obj); return obj; };
    const mod = DETAIL[a.id];
    genericBuildings(ctx, { terminals: !mod, towers: !mod });
    const b = { grp, ctx };
    this.built.set(a.id, b);
    this.root.add(grp);
    if (mod) {
      const load = this.modules[mod] || (this.modules[mod] = import('./havalimanlari/' + mod + '.js'));
      load.then((m) => { if (this.built.get(a.id) === b) { m.build(ctx); b.tick = ctx.tick; } }).catch((e) => console.error('Havalimanı modülü ' + mod, e));
    } else standsAndAircraft(ctx, { occ: 0.35 });
    grp.updateMatrixWorld(true);
  }
  stats() { return { built: this.built.size }; }
  // çarpışma: terminaller ve hangarlar (mutlak x doğu, y kuzey, h yükseklik)
  collide(x, y, h) {
    for (const a of this.near) {
      const b = this.built.get(a.id); if (!b || !b.ctx) continue;
      const lx = x - b.ctx.d.x, ly = y - b.ctx.d.y, lh = h - b.ctx.d.elev;
      if (lh > 120) continue;
      for (const [id, g] of b.ctx.parts) {
        const u = g.userData;
        if (id.startsWith('terminal:') && lh < u.yukseklik + 1.6 && pip([u.taban], lx, ly)) return (u.ad || 'Terminal') + ' binasına çarptınız';
      }
      for (const sld of b.ctx.solid || []) if (lh < sld.top && pip([sld.P], lx, ly)) return sld.ad + ' yapısına çarptınız';
    }
    return null;
  }
}

function pip(rings, x, y) {
  let c = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ---------- ışık noktaları ----------
const LIGHT_VS = `attribute vec3 color; attribute float sz; varying vec3 vC; varying float vF;
  void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
    gl_Position.z -= 4.0e-6 * gl_Position.w;
    float d = -mv.z; gl_PointSize = clamp(sz * 260.0 / d, 1.0, 6.0) * PR; vF = clamp((d - 2500.0) / 6000.0, 0.0, 1.0); }`;
const LIGHT_FS = `varying vec3 vC; varying float vF;
  void main(){ vec2 q = gl_PointCoord - 0.5; float r = dot(q, q); if (r > 0.25) discard; float a = 1.0 - smoothstep(0.05, 0.25, r);
    gl_FragColor = vec4(vC * (0.9 + 0.8 * a), (0.35 + 0.5 * a) * (1.0 - vF)); }`;
function lightPoints(L) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(L.flatMap((l) => [l[0], l[2], -l[1]]), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(L.flatMap((l) => [l[3], l[4], l[5]]), 3));
  g.setAttribute('sz', new THREE.Float32BufferAttribute(L.map((l) => l[6]), 1));
  g.computeBoundingSphere();
  const m = new THREE.ShaderMaterial({ vertexShader: LIGHT_VS.replace('PR', '(' + Math.min(2, devicePixelRatio).toFixed(1) + ')'), fragmentShader: LIGHT_FS, transparent: true, depthWrite: false });
  const p = new THREE.Points(g, m); p.name = 'isiklar'; p.renderOrder = 6; p.matrixAutoUpdate = false;
  return p;
}
// PAPI: bakış açısı eşikten büyükse beyaz, küçükse kırmızı
function papiPoints(P) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap((l) => [l[0], l[2], -l[1]]), 3));
  g.setAttribute('ang', new THREE.Float32BufferAttribute(P.map((l) => l[3] * Math.PI / 180), 1));
  g.setAttribute('dir', new THREE.Float32BufferAttribute(P.flatMap((l) => [l[4], -l[5]]), 2));
  g.computeBoundingSphere();
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `attribute float ang; attribute vec2 dir; varying vec3 vC; varying float vA;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vec3 d = cameraPosition - wp.xyz;
        float along = -dot(d.xz, dir); float e = atan(d.y, max(length(d.xz), 1.0));
        vC = e > ang ? vec3(1.0, 0.97, 0.9) : vec3(1.0, 0.12, 0.08); vA = along > 0.0 ? 1.0 : 0.0;
        vec4 mv = viewMatrix * wp; gl_Position = projectionMatrix * mv; gl_Position.z -= 4.0e-6 * gl_Position.w;
        gl_PointSize = clamp(1500.0 / -mv.z, 1.5, 8.0) * PR; }`.replace('PR', '(' + Math.min(2, devicePixelRatio).toFixed(1) + ')'),
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; if (dot(q,q) > 0.25 || vA < 0.5) discard; gl_FragColor = vec4(vC * 2.2, 1.0); }`,
  });
  const p = new THREE.Points(g, m); p.name = 'papi'; p.renderOrder = 6; p.matrixAutoUpdate = false;
  return p;
}

// ---------- genel binalar: terminal (cam cephe), hangar (kemerli çatı), kule ----------
function dedupe(list) { const s = new Set(); return list.filter((b) => { const k = b.t + ':' + b.p[0][0] + ':' + b.p[0][1]; if (s.has(k)) return false; s.add(k); return true; }); }
export function genericBuildings(ctx, opt = {}) {
  const { d, M, grp, gh } = ctx;
  const glass = new GB(); glass.uv = [];
  const roof = new GB(), wall = new GB(), hw = new GB(), hr = new GB(), cab = new GB(), metal = new GB();
  for (const b of dedupe(d.bina)) {
    if (b.t === 'terminal' && opt.terminals === false) continue;
    if (b.t === 'tower' && opt.towers === false) continue;
    const P = b.p; if (!P.length) continue;
    const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.5;
    if (b.t === 'terminal') {
      const h = b.h;
      glass._per = 0; glass.prism(P, base, h, false);
      roof.prism(inflate(P, 2.5), h, h + 1.2);
    } else if (b.t === 'hangar') {
      const o = obbOf(P);
      (ctx.solid || (ctx.solid = [])).push({ P, top: b.h, ad: b.n || 'Hangar' });
      wall.prism(P, base, b.h * 0.72, false);
      barrel(hr, o, b.h * 0.72, b.h);
      hw.prism(P, b.h * 0.72 - 0.01, b.h * 0.72, true);
    } else if (b.t === 'tower') {
      const [cx, cy] = centroid(P);
      genericTower(metal, cab, cx, cy, base, Math.max(25, b.h));
    }
  }
  const add = (gb, mat, name) => { if (!gb.count) return; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; grp.add(m); };
  if (glass.count) { for (let k = 0; k < glass.uv.length; k += 2) { glass.uv[k] /= 3.0; glass.uv[k + 1] /= 8.0; } }
  add(glass, M.glass, 'terminal-cam'); add(roof, M.roof, 'terminal-cati'); add(wall, M.hangarWall, 'hangar-duvar'); add(hr, M.hangarRoof, 'hangar-cati'); add(hw, M.hangarWall, 'hangar-kenar');
  add(metal, M.conc, 'kule'); add(cab, M.cab, 'kule-cam');
}
export function centroid(P) { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; }
// çokgeni dışa büyüt (köşe açıortayı boyunca)
export function inflate(P, d) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
    let e1x = b[0] - a[0], e1y = b[1] - a[1], e2x = c[0] - b[0], e2y = c[1] - b[1];
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1; e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
    const n1x = e1y, n1y = -e1x, n2x = e2y, n2y = -e2x;
    let mx = n1x + n2x, my = n1y + n2y; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const cosv = Math.max(0.35, mx * n1x + my * n1y);
    out.push([b[0] + mx * d / cosv, b[1] + my * d / cosv]);
  }
  return out;
}
export function obbOf(P) {
  let best = 0, ang = 0;
  for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; const L = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]); if (L > best) { best = L; ang = Math.atan2(P[j][1] - P[i][1], P[j][0] - P[i][0]); } }
  const c = Math.cos(ang), s = Math.sin(ang);
  let a0 = 1e18, a1 = -1e18, b0 = 1e18, b1 = -1e18;
  for (const [x, y] of P) { const a = x * c + y * s, b = -x * s + y * c; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  return { c, s, a0, a1, b0, b1, cx: ((a0 + a1) / 2) * c - ((b0 + b1) / 2) * s, cy: ((a0 + a1) / 2) * s + ((b0 + b1) / 2) * c, L: a1 - a0, Wd: b1 - b0, ang };
}
// kemerli (beşik tonoz) çatı: OBB'nin kısa kenarı boyunca yay
export function barrel(gb, o, h0, h1, seg = 10) {
  const long = o.L >= o.Wd;
  const L = long ? o.L : o.Wd, S = long ? o.Wd : o.L;
  const ux = long ? o.c : -o.s, uy = long ? o.s : o.c, vx = -uy, vy = ux;
  const rise = h1 - h0;
  const s0 = gb.count;
  for (let k = 0; k <= seg; k++) {
    const t = k / seg, v = (t - 0.5) * S, hh = h0 + rise * (1 - (2 * t - 1) ** 2);
    const dh = -rise * 2 * (2 * t - 1) * 2 / S; const nl = Math.hypot(dh, 1);
    for (const e of [-1, 1]) {
      const x = o.cx + ux * e * L / 2 + vx * v, y = o.cy + uy * e * L / 2 + vy * v;
      gb.vert(x, hh, y, -vx * dh / nl, 1 / nl, -vy * dh / nl);
    }
  }
  for (let k = 0; k < seg; k++) { const a = s0 + k * 2; gb.quad(a, a + 2, a + 3, a + 1); }
  // alın duvarları
  for (const e of [-1, 1]) {
    const s1 = gb.count;
    const nx = ux * e, ny = uy * e;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg, v = (t - 0.5) * S, hh = h0 + rise * (1 - (2 * t - 1) ** 2);
      const x = o.cx + ux * e * L / 2 + vx * v, y = o.cy + uy * e * L / 2 + vy * v;
      gb.vert(x, h0, y, nx, 0, ny); gb.vert(x, hh, y, nx, 0, ny);
    }
    for (let k = 0; k < seg; k++) { const a = s1 + k * 2; if (e > 0) gb.quad(a, a + 2, a + 3, a + 1); else gb.quad(a, a + 1, a + 3, a + 2); }
  }
}
export function genericTower(metal, cab, x, y, base, H) {
  metal.lathe(x, y, [[4.2, 0], [3.4, H * 0.3], [3.0, H - 9]], 12, base);
  metal.lathe(x, y, [[3.0, H - 9], [6.5, H - 6.5], [6.8, H - 6]], 12, base);
  cab.lathe(x, y, [[6.0, H - 6], [6.8, H - 1.5]], 12, base);
  metal.lathe(x, y, [[7.2, H - 1.5], [7.2, H - 0.6], [2, H], [0.01, H + 0.4]], 12, base);
  metal.box(x, y, base + H, 0.3, 0.3, 6, 0);
}

// ---------- park yerleri ve park etmiş uçaklar ----------
let AIRLINER = null;
export function airlinerGeoms() {
  if (AIRLINER) return AIRLINER;
  // kendi düşük poligonlu yolcu uçağımız (A320 / B737 boyutunda; 1 birim = 1 m, burun +x)
  const body = new GB([['color', 3]]), tail = new GB([['color', 3]]);
  const W = [0.93, 0.93, 0.94], Gy = [0.55, 0.57, 0.6], Dk = [0.1, 0.12, 0.15], Wing = [0.72, 0.74, 0.77];
  const R = 1.98, Lf = 37.6;
  // gövde: kesitler (x, yarıçap, merkez yüksekliği)
  const secs = [[0, 0.05, 2.95], [0.8, 0.9, 2.85], [2.2, 1.6, 2.85], [4.5, R, 2.9], [Lf - 10, R, 2.9], [Lf - 5, 1.35, 3.35], [Lf - 1.5, 0.55, 3.85], [Lf, 0.15, 4.0]];
  const seg = 14;
  const s0 = body.count;
  for (const [x, r, zc] of secs) for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const z = zc + s * r, yv = c * r;
    let col = s < -0.35 ? Gy : W;
    if (s > 0.05 && s < 0.32 && x > 4 && x < Lf - 6) col = Dk;               // pencere bandı
    if (x < 2.6 && s > 0.2 && Math.abs(c) < 0.7 && x > 0.9) col = Dk;         // kokpit camları
    body.p.push(Lf / 2 - x, z, yv); body.n.push(0, s, c); body.a.color.v.push(...col);
  }
  for (let j = 0; j < secs.length - 1; j++) for (let k = 0; k < seg; k++) { const a = s0 + j * (seg + 1) + k, b = a + seg + 1; body.i.push(a, a + 1, b + 1, a, b + 1, b); }
  // kanatlar (ok açılı), motorlar, yatay kuyruk
  const wing = (rootX, rootY, z, span, cr, ct, sweep, dz, gb, col, th) => {
    for (const sd of [-1, 1]) {
      const P = [[rootX, rootY * sd], [rootX - cr, rootY * sd], [rootX - sweep - ct, (rootY + span) * sd], [rootX - sweep, (rootY + span) * sd]];
      const s = gb.count;
      for (const [x, y] of P) gb.vert(x, z + (Math.abs(y) - rootY) * dz, y, 0, 1, 0, { color: col });
      for (const [x, y] of P) gb.vert(x, z + (Math.abs(y) - rootY) * dz - th, y, 0, -1, 0, { color: Gy });
      if (sd > 0) { gb.quad(s, s + 3, s + 2, s + 1); gb.quad(s + 4, s + 5, s + 6, s + 7); } else { gb.quad(s, s + 1, s + 2, s + 3); gb.quad(s + 4, s + 7, s + 6, s + 5); }
      gb.quad(s, s + 4, s + 7, s + 3); gb.quad(s + 1, s + 2, s + 6, s + 5);
    }
  };
  wing(Lf / 2 - 14.5, 1.7, 1.6, 15.8, 6.6, 1.6, 7.5, 0.09, body, Wing, 0.35);
  wing(Lf / 2 - 33.2, 0.8, 3.95, 5.6, 3.4, 1.2, 3.0, 0.05, body, Wing, 0.2);
  for (const sd of [-1, 1]) {
    const ex = Lf / 2 - 13.2, ey = 5.75 * sd, ez = 1.4;
    const s = body.count;
    const pr = [[0.98, 0], [1.08, 0.6], [1.05, 2.8], [0.8, 4.0], [0.45, 4.6]];
    for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); for (const [r, x] of pr) body.vert(ex - x + 1.5, ez + sn * r, ey + c * r, 0, sn, c, { color: x < 0.3 ? Dk : Gy }); }
    for (let k = 0; k < 12; k++) for (let j = 0; j < pr.length - 1; j++) { const a = s + k * pr.length + j, b = a + pr.length; body.quad(a, a + 1, b + 1, b); }
    body.box(ex - 1.5, ey * 0.85, ez + 0.9, 3, 0.4, 1.0, 0);
  }
  // dikey kuyruk (renkli: örnek başına renk)
  const fs = tail.count;
  const F = [[Lf / 2 - 30.5, 4.25], [Lf / 2 - 36.8, 4.25], [Lf / 2 - 37.9, 12.2], [Lf / 2 - 35.0, 12.2]];
  for (const e of [-0.18, 0.18]) for (const [x, z] of F) tail.vert(x, z, e, 0, 0, e > 0 ? 1 : -1, { color: [1, 1, 1] });
  tail.quad(fs, fs + 1, fs + 2, fs + 3); tail.quad(fs + 4, fs + 7, fs + 6, fs + 5); tail.quad(fs, fs + 4, fs + 5, fs + 1); tail.quad(fs + 3, fs + 2, fs + 6, fs + 7); tail.quad(fs + 2, fs + 1, fs + 5, fs + 6);
  // iniş takımları (kısa koyu kutular)
  for (const [x, y] of [[Lf / 2 - 5, 0], [Lf / 2 - 17, 3.2], [Lf / 2 - 17, -3.2]]) body.box(x, y, 0, 0.6, 1.2, 1.6, 0);
  for (let k = 0; k < body.n.length; k += 3) { const l = Math.hypot(body.n[k], body.n[k + 1], body.n[k + 2]) || 1; body.n[k] /= l; body.n[k + 1] /= l; body.n[k + 2] /= l; }
  // GB.vert z'yi eksi yapar; gövde dizileri doğrudan yazıldı (z = yan): ikisini aynı eksene getir
  AIRLINER = { body: body.geometry(), tail: tail.geometry(), len: Lf };
  return AIRLINER;
}
// park yerlerini bul: OSM park çizgilerinin durma ucu (aynı ref'li çizgilerin ortak ucu ya da binaya yakın uç)
export function stands(d) {
  const byRef = new Map(), out = [];
  for (const p of d.pp) { const k = p.r || ('_' + out.length + Math.random()); if (!byRef.has(k)) byRef.set(k, []); byRef.get(k).push(p.p); }
  const blds = d.bina.filter((b) => b.t === 'terminal').map((b) => centroid(b.p));
  const gates = d.gate.map((g) => g.p).concat(d.kopru.map((k) => k[0]));
  const near = (x, y) => { let m = 1e9; for (const [gx, gy] of gates.concat(blds)) m = Math.min(m, Math.hypot(gx - x, gy - y)); return m; };
  for (const [ref, lines] of byRef) {
    let stop = null, prev = null;
    if (lines.length > 1) {
      const ends = new Map();
      for (const l of lines) for (const [i, j] of [[0, 1], [l.length - 1, l.length - 2]]) { const k = Math.round(l[i][0]) + ':' + Math.round(l[i][1]); const e = ends.get(k) || { p: l[i], prev: l[j], n: 0 }; e.n++; ends.set(k, e); }
      for (const e of ends.values()) if (e.n > 1) { stop = e.p; prev = e.prev; }
    }
    if (!stop) {
      const l = lines[0], a = l[0], b = l[l.length - 1];
      if (near(a[0], a[1]) < near(b[0], b[1])) { stop = a; prev = l[1]; } else { stop = b; prev = l[l.length - 2]; }
    }
    const hx = stop[0] - prev[0], hy = stop[1] - prev[1], L = Math.hypot(hx, hy) || 1;
    out.push({ x: stop[0], y: stop[1], ux: hx / L, uy: hy / L, ref, gate: near(stop[0], stop[1]) < 70 });
  }
  for (const p of d.ppt) out.push({ x: p.p[0], y: p.p[1], ux: 0, uy: 0, ref: p.r, pt: true });
  // komşu aralığı (geniş gövdeli uçak sığar mı?)
  for (const s of out) { let m = 1e9; for (const q of out) if (q !== s) m = Math.min(m, Math.hypot(q.x - s.x, q.y - s.y)); s.space = m; }
  return out;
}
function hash1(x, y) { let h = Math.imul(Math.round(x * 13) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(y * 7) + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }
export const TAILS = [0x2f5d8a, 0xb23a3a, 0x3a8a6a, 0xe0a020, 0x5a4a9a, 0xd0d4d8, 0x1f6fb0, 0x7a2a4a, 0x2a2e36, 0xc8642c];
// park yerlerine uçak koy (örneklenmiş: gövde + renkli kuyruk = 2 çizim çağrısı)
export function standsAndAircraft(ctx, opt = {}) {
  const { d, grp, M } = ctx;
  const S = ctx.stands || stands(d);
  const occ = opt.occ != null ? opt.occ : 0.6;
  const pick = S.filter((s) => !s.pt && hash1(s.x, s.y) < (s.gate ? occ + 0.2 : occ));
  if (!pick.length) return [];
  const G = airlinerGeoms();
  const bm = new THREE.InstancedMesh(G.body, M.body, pick.length), tm = new THREE.InstancedMesh(G.tail, M.body, pick.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  pick.forEach((s, i) => {
    const big = s.space > 62 && hash1(s.y, s.x) < 0.45;
    const sc = big ? 1.7 : 1.0;
    const hx = s.ux || 1, hy = s.uy || 0;
    const L = G.len * sc;
    const cx = s.x - hx * (L / 2 + 2), cy = s.y - hy * (L / 2 + 2);
    o.position.set(cx, 0.12, -cy); o.rotation.set(0, Math.atan2(hy, hx), 0); o.scale.set(sc, sc, sc); o.updateMatrix();
    bm.setMatrixAt(i, o.matrix); tm.setMatrixAt(i, o.matrix);
    c.setHex(TAILS[Math.floor(hash1(s.x + 3, s.y) * TAILS.length)]); tm.setColorAt(i, c);
    s.ac = { x: cx, y: cy, hx, hy, L, sc };
  });
  for (const m of [bm, tm]) { m.computeBoundingSphere(); m.matrixAutoUpdate = false; grp.add(m); }
  bm.name = 'ucaklar'; tm.name = 'ucak-kuyruk';
  return pick;
}
