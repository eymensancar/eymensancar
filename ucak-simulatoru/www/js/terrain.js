// Türkiye arazisi: üç kademeli yükseklik verisi ve uzaklığa göre ayrıntı (dörtlü ağaç) ile çizim.
//  - genel bakış 2 km (açılışta), temel karolar 500 m (256 km'lik, uçağın çevresinde yüklenir),
//  - ayrıntılı bölgeler 62.5 m (şehirler, dağlar, havalimanları; yaklaşınca yüklenir).
// Örgü düğümleri kendi merkezine göre yerel köşelerle kurulur; dünya kökü kaydırılarak (kayan orijin) uzakta da hassasiyet korunur.
import * as THREE from '../vendor/three.module.min.js';
import { pngBytes, decodeGrid } from './veri.js';

const G = 32;                 // düğüm başına aralık sayısı
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class Heights {
  constructor(idx, base) {
    this.idx = idx; this.base = base;
    this.ov = null; this.tiles = new Map(); this.patches = [];
    this.loading = new Set(); this.listeners = [];
    const T = idx.temel; this.BS = T.s; this.BT = T.n;
    this.tileList = new Map(T.karolar.map(([i, j, f]) => [i + ',' + j, f]));
    this.patchList = idx.bolgeler.map((b) => ({ ...b, grid: null }));
    this.R0 = idx.kok;
    this.lc = null;
    this.files = new Map();
  }
  // havalimanı yamaları (çoklu ızgara dosyalarında): {id, ad, rect, dosya, k}
  addPatches(list) { for (const p of list) this.patchList.push({ ...p, grid: null }); }
  _file(f) { let p = this.files.get(f); if (!p) { p = pngBytes(this.base + f); this.files.set(f, p); } return p; }
  // bir dikdörtgenin bütün yükseklik verisini iste; hepsi geldiyse true
  ensureRect(x0, y0, x1, y1) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.max(x1 - x0, y1 - y0) / 2;
    this.ensure(cx, cy, r - 20000 > 0 ? r - 20000 : 0);
    let ok = true;
    const sz = this.BS * this.BT;
    for (let j = Math.floor((y0 - this.R0[1]) / sz); j <= Math.floor((y1 - this.R0[1]) / sz); j++) for (let i = Math.floor((x0 - this.R0[0]) / sz); i <= Math.floor((x1 - this.R0[0]) / sz); i++) {
      const k = i + ',' + j; if (this.tileList.has(k) && !this.tiles.has(k) && this.tiles.get(k) !== null) ok = false;
    }
    for (const p of this.patchList) { const [a, b, c, d] = p.rect; if (c > x0 && a < x1 && d > y0 && b < y1 && !p.grid && !p.failed) ok = false; }
    return ok;
  }
  // bir noktadaki bütün yükseklik verisi hazır mı (temel karo ve yamalar)
  patchReady(x, y) {
    const sz = this.BS * this.BT, k = Math.floor((x - this.R0[0]) / sz) + ',' + Math.floor((y - this.R0[1]) / sz);
    if (this.tileList.has(k) && !this.tiles.has(k)) return false;
    for (const p of this.patchList) { const [a, b, c, d] = p.rect; if (x > a && x < c && y > b && y < d && !p.grid && !p.failed) return false; }
    return true;
  }
  async init() {
    this.ov = decodeGrid(await pngBytes(this.base + this.idx.genel.dosya));
  }
  onData(fn) { this.listeners.push(fn); }
  _emit(rect, level, grid, kind, key) { for (const f of this.listeners) f(rect, level, grid, kind, key); }
  _tileKey(x, y) { const sz = this.BS * this.BT; return [Math.floor((x - this.R0[0]) / sz), Math.floor((y - this.R0[1]) / sz)]; }
  // Bir noktanın çevresindeki verileri iste (r metre). Döndürür: bekleyen yükleme sayısı.
  ensure(x, y, r) {
    const sz = this.BS * this.BT;
    const [i0, j0] = this._tileKey(x - r, y - r), [i1, j1] = this._tileKey(x + r, y + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = i + ',' + j, f = this.tileList.get(k);
      if (!f || this.tiles.has(k) || this.loading.has(k)) continue;
      this.loading.add(k);
      pngBytes(this.base + f).then((b) => { const g = decodeGrid(b); this.tiles.set(k, g); this.loading.delete(k); this._emit([g.x0, g.y0, g.x1, g.y1], 1, g, 'tile', k); })
        .catch((e) => { console.warn(e); this.loading.delete(k); this.tiles.set(k, null); });
    }
    for (const p of this.patchList) {
      if (p.grid || p.loading || p.failed) continue;
      const [a, b, c, d] = p.rect;
      const dx = Math.max(a - x, 0, x - c), dy = Math.max(b - y, 0, y - d);
      if (dx * dx + dy * dy > (r + 20000) ** 2) continue;
      p.loading = true; this.loading.add(p.id);
      (p.k != null ? this._file(p.dosya) : pngBytes(this.base + p.dosya)).then((buf) => { p.grid = decodeGrid(buf, p.k); p.loading = false; this.loading.delete(p.id); this.patches.push(p); this._emit(p.rect, 2, p.grid, 'patch', p.id); })
        .catch((e) => { console.warn(e); p.failed = true; this.loading.delete(p.id); });
    }
    return this.loading.size;
  }
  // level: 0 yalnız genel, 1 temel, 2 hepsi
  h(x, y, level = 2) {
    let h = null;
    if (level >= 1) {
      const sz = this.BS * this.BT;
      const i = Math.floor((x - this.R0[0]) / sz), j = Math.floor((y - this.R0[1]) / sz);
      const t = this.tiles.get(i + ',' + j);
      if (t) h = t.h(x, y);
    }
    if (h === null) h = this.ov.h(x, y);
    if (level >= 2) {
      for (let k = 0; k < this.patches.length; k++) {
        const g = this.patches[k].grid;
        if (x < g.x0 || x > g.x1 || y < g.y0 || y > g.y1) continue;
        const e = Math.min(x - g.x0, g.x1 - x, y - g.y0, g.y1 - y);
        const w = sstep(0, 1500, e);
        const hp = g.h(x, y);
        h = w >= 1 ? hp : h + (hp - h) * w;
      }
    }
    return h;
  }
  maxLevelAt(x0, y0, x1, y1) {
    for (const p of this.patchList) { const [a, b, c, d] = p.rect; if (x1 > a && x0 < c && y1 > b && y0 < d) return 2; }
    return 1;
  }
  inPatch(x0, y0, x1, y1) { for (const p of this.patchList) { const [a, b, c, d] = p.rect; if (x1 > a && x0 < c && y1 > b && y0 < d) return true; } return false; }
}

// ---------------- dörtlü ağaç çizimi ----------------
class Node {
  constructor(x0, y0, size, depth, parent) { this.x0 = x0; this.y0 = y0; this.size = size; this.depth = depth; this.parent = parent; this.kids = null; this.mesh = null; this.dirty = false; this.used = 0; this.building = false; }
}
export class Terrain {
  constructor(heights, root, material, opt = {}) {
    this.H = heights; this.root = root; this.mat = material;
    const [x0, y0, s] = heights.R0;
    this.top = new Node(x0, y0, s, 0, null);
    this.K = opt.K || 2.0;
    this.maxDepth = 10; this.maxDepthOut = 8;
    this.maxDist = 400000; // sisin tamamen örttüğü uzaklıktan ötesi çizilmez
    this.budget = opt.budget || 4;
    this.frame = 0; this.count = 0; this.drawn = 0;
    this.queue = [];
    this.all = new Set();
    heights.onData((r, lvl) => this._invalidate(this.top, r, lvl));
  }
  _invalidate(n, r, lvl) {
    if (n.x0 > r[2] || n.x0 + n.size < r[0] || n.y0 > r[3] || n.y0 + n.size < r[1]) return;
    const sp = n.size / G;
    if (n.mesh && ((lvl === 1 && sp < 2000) || (lvl === 2 && sp < 500))) n.dirty = true;
    if (n.kids) for (const k of n.kids) this._invalidate(k, r, lvl);
  }
  levelFor(sp) { return sp >= 2000 ? 0 : sp >= 500 ? 1 : 2; }
  _build(n) {
    const sp = n.size / G, lvl = this.levelFor(sp), H = this.H;
    const cx = n.x0 + n.size / 2, cy = n.y0 + n.size / 2;
    const NV = (G + 1) * (G + 1), NS = 4 * G;
    const pos = new Float32Array((NV + NS + 4) * 3), nor = new Int8Array((NV + NS + 4) * 3);
    const hs = new Float32Array((G + 3) * (G + 3));
    let hmin = 1e9, hmax = -1e9;
    for (let j = -1; j <= G + 1; j++) for (let i = -1; i <= G + 1; i++) {
      const h = H.h(n.x0 + i * sp, n.y0 + j * sp, lvl);
      hs[(j + 1) * (G + 3) + (i + 1)] = h;
    }
    const at = (i, j) => hs[(j + 1) * (G + 3) + (i + 1)];
    let v = 0;
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      const h = at(i, j); if (h < hmin) hmin = h; if (h > hmax) hmax = h;
      pos[v * 3] = n.x0 + i * sp - cx; pos[v * 3 + 1] = h; pos[v * 3 + 2] = -(n.y0 + j * sp - cy);
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * sp), gy = (at(i, j + 1) - at(i, j - 1)) / (2 * sp);
      const l = Math.hypot(gx, gy, 1);
      nor[v * 3] = Math.round(-gx / l * 127); nor[v * 3 + 1] = Math.round(1 / l * 127); nor[v * 3 + 2] = Math.round(gy / l * 127);
      v++;
    }
    // etek: kenar köşeleri aşağı (komşu ayrıntı farkından doğan çatlakları gizler)
    const skirt = Math.max(15, sp * 1.5);
    const edge = [];
    for (let i = 0; i < G; i++) edge.push([i, 0]);
    for (let j = 0; j < G; j++) edge.push([G, j]);
    for (let i = G; i > 0; i--) edge.push([i, G]);
    for (let j = G; j > 0; j--) edge.push([0, j]);
    const s0 = v;
    for (const [i, j] of edge) {
      const k = j * (G + 1) + i;
      pos[v * 3] = pos[k * 3]; pos[v * 3 + 1] = pos[k * 3 + 1] - skirt; pos[v * 3 + 2] = pos[k * 3 + 2];
      nor[v * 3] = nor[k * 3]; nor[v * 3 + 1] = nor[k * 3 + 1]; nor[v * 3 + 2] = nor[k * 3 + 2];
      v++;
    }
    const idx = new Uint16Array(G * G * 6 + NS * 6);
    let q = 0;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const a = j * (G + 1) + i, b = a + 1, c = a + G + 1, d = c + 1;
      // three: -z kuzey; (i,j)->(x,-y). Ön yüz yukarı bakacak sıra
      idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = d; idx[q++] = c; idx[q++] = b;
    }
    for (let e = 0; e < NS; e++) {
      const [i, j] = edge[e], [i2, j2] = edge[(e + 1) % NS];
      const a = j * (G + 1) + i, b = j2 * (G + 1) + i2, sa = s0 + e, sb = s0 + (e + 1) % NS;
      idx[q++] = a; idx[q++] = sa; idx[q++] = b; idx[q++] = b; idx[q++] = sa; idx[q++] = sb;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, v * 3), 3, true));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const r = n.size * 0.7072;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, (hmin + hmax) / 2, 0), Math.hypot(r, (hmax - hmin) / 2 + skirt));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-n.size / 2, hmin - skirt, -n.size / 2), new THREE.Vector3(n.size / 2, hmax, n.size / 2));
    if (n.mesh) { n.mesh.geometry.dispose(); n.mesh.geometry = g; }
    else {
      const m = new THREE.Mesh(g, this.mat); m.matrixAutoUpdate = false;
      m.position.set(cx, 0, -cy); m.updateMatrix(); m.visible = false;
      this.root.add(m); n.mesh = m; this.all.add(n);
    }
    n.hmin = hmin; n.hmax = hmax; n.dirty = false;
  }
  _split(n) {
    if (n.kids) return n.kids;
    const h = n.size / 2;
    n.kids = [new Node(n.x0, n.y0, h, n.depth + 1, n), new Node(n.x0 + h, n.y0, h, n.depth + 1, n), new Node(n.x0, n.y0 + h, h, n.depth + 1, n), new Node(n.x0 + h, n.y0 + h, h, n.depth + 1, n)];
    return n.kids;
  }
  _want(n, cam) {
    const dx = Math.max(n.x0 - cam.x, 0, cam.x - (n.x0 + n.size));
    const dy = Math.max(n.y0 - cam.y, 0, cam.y - (n.y0 + n.size));
    const hz = n.mesh ? Math.max(0, cam.h - n.hmax, n.hmin - cam.h) : Math.max(0, cam.h - cam.gh);
    const d = Math.hypot(dx, dy, hz);
    n.far = d > this.maxDist;
    const md = this.H.inPatch(n.x0, n.y0, n.x0 + n.size, n.y0 + n.size) ? this.maxDepth : this.maxDepthOut;
    return n.depth < md && d < this.K * n.size;
  }
  // cam: {x, y, h, gh} mutlak koordinatlar
  update(cam) {
    this.frame++;
    const need = [];
    const draw = [];
    const visit = (n) => {
      n.used = this.frame;
      if (n.depth > 1) { const dx = Math.max(n.x0 - cam.x, 0, cam.x - (n.x0 + n.size)), dy = Math.max(n.y0 - cam.y, 0, cam.y - (n.y0 + n.size)); if (dx * dx + dy * dy > this.maxDist * this.maxDist) return; }
      if (this._want(n, cam)) {
        const kids = this._split(n);
        if (kids.every((k) => k.mesh)) { for (const k of kids) visit(k); return; }
        for (const k of kids) { if (!k.mesh) need.push(k); else k.used = this.frame; }
        if (!n.mesh || n.dirty) need.push(n);
        if (n.mesh) draw.push(n);
        return;
      }
      if (!n.mesh || n.dirty) need.push(n);
      if (n.mesh) draw.push(n);
    };
    visit(this.top);
    for (const n of this.all) n.mesh.visible = false;
    for (const n of draw) n.mesh.visible = true;
    this.drawn = draw.length;
    // en yakından başlayarak inşa et
    need.sort((a, b) => (a.depth - b.depth) || (dist2(a, cam) - dist2(b, cam)));
    let built = 0;
    const seen = new Set();
    for (const n of need) {
      if (seen.has(n)) continue; seen.add(n);
      if (built >= this.budget) break;
      this._build(n); built++;
    }
    // kullanılmayan düğümleri bellekten at
    if (this.all.size > 700 && this.frame % 30 === 0) {
      for (const n of this.all) {
        if (this.frame - n.used > 120 && n.depth > 2) { this.root.remove(n.mesh); n.mesh.geometry.dispose(); n.mesh = null; this.all.delete(n); if (n.parent && n.parent.kids && n.parent.kids.every((k) => !k.mesh && !k.kids)) {} }
      }
      const prune = (n) => { if (!n.kids) return; for (const k of n.kids) prune(k); if (n.kids.every((k) => !k.mesh && !k.kids) && this.frame - n.used > 120) n.kids = null; };
      prune(this.top);
    }
    this.pending = need.length;
    return need.length;
  }
}
function dist2(n, c) { const x = n.x0 + n.size / 2 - c.x, y = n.y0 + n.size / 2 - c.y; return x * x + y * y; }

// ---------------- arazi malzemesi ----------------
// Renk parça gölgelendiricide hesaplanır: iklim taban rengi (konuma göre), OSM örtüsü (orman, şehir, tarla, su),
// yükseklik (kar sınırı), eğim (kaya), yakın ayrıntı gürültüsü. İstanbul dikdörtgeninde ayrıntılı zemin dokusu.
export function terrainMaterial(opt) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const U = {
    uOrigin: { value: new THREE.Vector2() }, uOriginMod: { value: new THREE.Vector2() },
    ortuTex: { value: opt.ortuTex }, ortuRect: { value: new THREE.Vector4(...opt.ortuRect) },
    istTex: { value: opt.istTex }, istRect: { value: new THREE.Vector4(...opt.istRect) },
    detailTex: { value: opt.detailTex },
  };
  mat.userData.U = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vW; varying vec3 vNw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNw = normal;');
    sh.fragmentShader = `uniform vec2 uOrigin, uOriginMod; uniform sampler2D ortuTex, istTex, detailTex; uniform vec4 ortuRect, istRect;
      varying vec3 vW; varying vec3 vNw;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      ` + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 A = vec2(vW.x, -vW.z) + uOrigin;            // mutlak x doğu, y kuzey
      vec2 L = vec2(vW.x, -vW.z) + uOriginMod;         // ayrıntı için küçük sayılar
      float h = vW.y;
      vec3 n = normalize(vNw);
      float slope = 1.0 - n.y;
      vec2 ou = vec2((A.x - ortuRect.x) / ortuRect.z, 1.0 - (A.y - ortuRect.y) / ortuRect.w);
      vec4 oc = texture2D(ortuTex, ou);
      // iklim: kuzey kıyı (Karadeniz) nemli yeşil, iç Anadolu bozkır, güney kıyı zeytin yeşili, doğu yüksek yayla
      float north = clamp((A.y + 60000.0) / 160000.0, 0.0, 1.0);
      float south = clamp((-A.y - 430000.0) / 150000.0, 0.0, 1.0);
      float west = clamp((150000.0 - A.x) / 300000.0, 0.0, 1.0);
      float east = clamp((A.x - 900000.0) / 400000.0, 0.0, 1.0);
      float nz = vnoise(L / 7000.0) * 0.6 + vnoise(L / 2300.0) * 0.4;
      vec3 steppe = mix(vec3(0.62, 0.55, 0.38), vec3(0.55, 0.50, 0.36), nz);
      vec3 lush = mix(vec3(0.30, 0.42, 0.22), vec3(0.36, 0.46, 0.25), nz);
      vec3 olive = mix(vec3(0.46, 0.47, 0.30), vec3(0.52, 0.50, 0.34), nz);
      vec3 high = mix(vec3(0.50, 0.50, 0.36), vec3(0.42, 0.45, 0.30), nz);
      vec3 base = steppe;
      base = mix(base, olive, max(west * 0.85, south * 0.8) * (1.0 - smoothstep(600.0, 1400.0, h)));
      base = mix(base, high, east * smoothstep(1200.0, 2200.0, h));
      base = mix(base, lush, north * north * (1.0 - smoothstep(1500.0, 2400.0, h)) * (0.75 + 0.25 * nz));
      // tarla: büyük ölçekli yama deseni (OSM tarlası + düz ovalarda genel ekin deseni)
      vec2 fq = L / 380.0 + vec2(vnoise(L / 1100.0), vnoise(L / 1300.0 + 7.0)) * 0.9;
      float fp = hash(floor(fq));
      float edge = smoothstep(0.0, 0.06, min(min(fract(fq.x), 1.0 - fract(fq.x)), min(fract(fq.y), 1.0 - fract(fq.y))));
      vec3 farm = mix(vec3(0.70, 0.60, 0.38), vec3(0.47, 0.52, 0.30), smoothstep(0.25, 0.75, fp));
      farm = mix(farm, vec3(0.58, 0.45, 0.32), step(0.84, fp));
      farm = mix(farm, vec3(0.80, 0.70, 0.46), step(0.93, fp));
      farm *= 0.9 + 0.1 * edge;
      float plain = (1.0 - smoothstep(0.03, 0.10, slope)) * (1.0 - smoothstep(1700.0, 2100.0, h)) * smoothstep(0.35, 0.6, vnoise(L / 9000.0 + 3.0));
      vec3 col = mix(base, farm, clamp(max(oc.b * 0.9, plain * 0.75), 0.0, 1.0));
      vec3 forest = mix(vec3(0.16, 0.26, 0.13), vec3(0.22, 0.30, 0.16), nz) * mix(1.0, 0.8, north);
      col = mix(col, forest, oc.r * 0.92);
      // şehir dokusu (binaların çizilmediği uzaklıkta şehir): eğri sokak ızgarası, parsellerde çatı renkleri, yeşil adacıklar
      float camD = length(cameraPosition - vW);
      vec2 uq = L / 75.0 + vec2(vnoise(L / 900.0), vnoise(L / 1100.0 + 5.0)) * 1.6;
      vec2 uf = fract(uq), ui = floor(uq);
      float fwq = fwidth(uq.x) + fwidth(uq.y);
      float patt = (1.0 - smoothstep(0.25, 0.7, fwq)) * smoothstep(700.0, 2200.0, camD);
      float street = 1.0 - smoothstep(0.05, 0.10, min(min(uf.x, 1.0 - uf.x), min(uf.y, 1.0 - uf.y)));
      float rb = hash(ui);
      vec2 lq = fract(uq * 3.0); float lot = hash(floor(uq * 3.0) + 17.0);
      vec3 roofc = lot < 0.38 ? vec3(0.66, 0.40, 0.31) : lot < 0.78 ? vec3(0.66, 0.64, 0.60) : vec3(0.80, 0.78, 0.74);
      float gap = 1.0 - smoothstep(0.07, 0.14, min(min(lq.x, 1.0 - lq.x), min(lq.y, 1.0 - lq.y)));
      vec3 upat = mix(roofc * (0.85 + 0.3 * rb), vec3(0.50, 0.49, 0.47), gap * 0.7);
      upat = mix(upat, vec3(0.38, 0.38, 0.39), street);
      upat = mix(upat, vec3(0.33, 0.41, 0.25), step(0.9, rb) * 0.85);
      vec3 uavg = vec3(0.60, 0.53, 0.48);
      vec3 upave = mix(vec3(0.55, 0.54, 0.51), vec3(0.62, 0.60, 0.56), vnoise(L / 40.0));
      vec3 urban = mix(mix(upave, uavg, smoothstep(700.0, 2200.0, camD)), upat, patt);
      col = mix(col, urban, smoothstep(0.08, 0.6, oc.g) * 0.95);
      // kaya ve kar
      float rock = smoothstep(0.28, 0.5, slope) * smoothstep(300.0, 900.0, h) + smoothstep(2400.0, 3000.0, h) * 0.5;
      col = mix(col, mix(vec3(0.45, 0.41, 0.37), vec3(0.55, 0.52, 0.48), nz), clamp(rock, 0.0, 1.0));
      float snowLine = 3300.0 - 300.0 * north - 250.0 * east + (vnoise(L / 900.0) - 0.5) * 500.0;
      float snow = smoothstep(snowLine - 80.0, snowLine + 120.0, h) * (1.0 - smoothstep(0.55, 0.8, slope));
      col = mix(col, vec3(0.93, 0.94, 0.97), snow);
      // göl ve ırmak (deniz zaten su düzleminde)
      col = pow(col, vec3(2.2));                       // sRGB -> doğrusal
      float wat = smoothstep(0.45, 0.7, oc.a) * step(0.5, h);
      // İstanbul ayrıntılı zemin dokusu
      vec2 iu = vec2((A.x - istRect.x) / (istRect.z - istRect.x), (A.y - istRect.y) / (istRect.w - istRect.y));
      if (iu.x > 0.0 && iu.y > 0.0 && iu.x < 1.0 && iu.y < 1.0) {
        vec4 ic = texture2D(istTex, iu);
        float e = min(min(iu.x, 1.0 - iu.x), min(iu.y, 1.0 - iu.y));
        float w = smoothstep(0.0, 0.015, e);
        if (ic.a < 0.5 && w > 0.5) discard;
        col = mix(col, ic.rgb, w);
        wat *= 1.0 - w;
      } else if (h < 0.0) discard;
      col = mix(col, vec3(0.010, 0.052, 0.100), wat);
      float dn = texture2D(detailTex, L / 23.0).r * 0.55 + texture2D(detailTex, L / 157.0).r * 0.45;
      col *= (0.82 + 0.36 * dn) * (1.0 - 0.0 * wat);
      diffuseColor.rgb = col;
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 vd = normalize(cameraPosition - vW); float fr = pow(1.0 - max(vd.y, 0.0), 4.0); totalEmissiveRadiance += wat * (vec3(0.55, 0.68, 0.80) * fr * 0.6 + vec3(0.03, 0.05, 0.07)); }`);
  };
  return mat;
}
