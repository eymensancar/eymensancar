// Binalar: Türkiye'nin bütün OpenStreetMap binaları (data/tr/bina.json dizini, bina/q_*.png paketleri), uzaklığa göre
// dört ayrıntı düzeyi (1/2/4/8 km düğümler), cephe dokusu atlası, çarpışma ızgarası, camiler (kubbe + minare), ağaçlar.
// Geometri bir Web Worker'da (bworker.js) üretilir; düğüm başına tek çizim çağrısı, çerçeve dışındakiler çizilmez,
// uzaklaşan düğümler bellekten atılır. Zemin yüksekliği için arazi verisi işçiye kopyalanır (aynı hesap).
import * as THREE from '../vendor/three.module.min.js';
import { pngBytes } from './veri.js';

const CS = 12.5, CN = 80;
function hash2(x, y) { let h = Math.imul(Math.round(x) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(Math.round(y) + 0x9e3779b9, 0x85ebca77); h ^= h >>> 15; h = Math.imul(h, 0xc2b2ae3d); h ^= h >>> 13; return h >>> 0; }
const SIZES = [1000, 2000, 4000, 8000];

// ---------- cephe dokusu atlası (4 x 3 karo, 256 piksel): alfa = cam maskesi ----------
// 0 sıva + pencere, 1 balkonlu, 2 cam giydirme, 3 bant pencere, 4 taş, 5 sanayi paneli, 6 dükkân, 7 düz çatı, 8 kiremit
function facadeAtlas() {
  const T = 256, c = document.createElement('canvas'); c.width = T * 4; c.height = T * 3;
  const g = c.getContext('2d');
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tile = (k, fn) => { g.save(); g.translate((k % 4) * T, Math.floor(k / 4) * T); g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(); g.restore(); };
  const glass = (x, y, w, h, a = 1) => {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, `rgba(120,146,168,${a})`); gr.addColorStop(0.55, `rgba(70,88,104,${a})`); gr.addColorStop(1, `rgba(52,62,72,${a})`);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  };
  const noise = (a) => { for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${a * rnd()})`; g.fillRect(rnd() * T, rnd() * T, 2, 2); } };
  // duvar = beyaz (köşe rengiyle çarpılır), cam = alfa 1 bölge
  tile(0, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, T, T); noise(0.05); g.fillStyle = '#e2e0dc'; g.fillRect(52, 50, 152, 142); glass(62, 58, 132, 124); g.fillStyle = '#f4f2ee'; g.fillRect(124, 58, 8, 124); g.fillRect(62, 112, 132, 6); g.fillStyle = '#c4c0b8'; g.fillRect(46, 190, 164, 12); g.fillStyle = '#d0ccc6'; g.fillRect(0, 238, T, 18); });
  tile(1, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, T, T); noise(0.05); glass(36, 30, 184, 172); g.fillStyle = '#efede8'; g.fillRect(124, 30, 8, 172); g.fillStyle = '#b8b4ae'; g.fillRect(14, 196, 228, 16); g.fillStyle = 'rgba(70,74,78,1)'; for (let x = 18; x < 240; x += 10) g.fillRect(x, 160, 3, 36); g.fillRect(14, 156, 228, 5); g.fillStyle = '#d6d2cc'; g.fillRect(0, 212, T, 44); });
  tile(2, () => { glass(0, 0, T, T); g.fillStyle = 'rgba(150,170,186,0.9)'; g.fillRect(0, 0, T, T * 0.15); g.fillStyle = '#c8ccd0'; g.fillRect(0, 0, 5, T); g.fillRect(126, 0, 4, T); g.fillRect(0, 232, T, 24); });
  tile(3, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, T, T); noise(0.04); glass(0, 70, T, 110); g.fillStyle = '#e8e6e2'; for (let x = 0; x < T; x += 64) g.fillRect(x, 70, 6, 110); g.fillStyle = '#cfccc6'; g.fillRect(0, 180, T, 10); });
  tile(4, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, T, T); noise(0.12); g.strokeStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < T; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(T, y); g.stroke(); }
    g.fillStyle = '#ddd6c8'; g.beginPath(); g.moveTo(80, 210); g.lineTo(80, 100); g.arc(128, 100, 48, Math.PI, 0); g.lineTo(176, 210); g.fill();
    g.save(); g.beginPath(); g.moveTo(90, 200); g.lineTo(90, 100); g.arc(128, 100, 38, Math.PI, 0); g.lineTo(166, 200); g.clip(); glass(88, 58, 80, 144); g.restore(); });
  tile(5, () => { g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, T, T); for (let x = 0; x < T; x += 16) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(x, 0, 3, T); } glass(20, 26, 216, 34); g.fillStyle = '#b0b2b4'; g.fillRect(0, 230, T, 26); });
  tile(6, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, T, T); glass(14, 70, 228, 160); g.fillStyle = '#eceae6'; g.fillRect(124, 70, 8, 160); const cs = ['#b8452e', '#2f6f8f', '#3d7a3d', '#8a6a2a', '#555c66']; g.fillStyle = cs[2]; g.fillRect(0, 28, T, 34); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(30, 38, 120, 12); g.fillStyle = '#8c8a86'; g.fillRect(0, 230, T, 26); });
  tile(7, () => { g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, T, T); for (let i = 0; i < 9000; i++) { const v = 150 + rnd() * 105; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * T, rnd() * T, 2, 2); } g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, 0, T, 3); g.fillRect(0, 0, 3, T); });
  tile(8, () => { for (let y = 0; y < T; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.75, '#d8d8d8'); gr.addColorStop(1, '#8a8a8a'); g.fillStyle = gr; g.fillRect(0, y, T, 32); for (let x = (y / 32) % 2 * 16; x < T; x += 32) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 3, 32); } } noise(0.06); });
  for (const k of [9, 10, 11]) tile(k, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, T, T); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return t;
}
export function buildingMaterial(skyCol) {
  const atlas = facadeAtlas();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.atlas = { value: atlas }; sh.uniforms.skyRef = { value: skyCol || new THREE.Color(0.55, 0.68, 0.82) };
    sh.vertexShader = 'attribute float st; varying vec2 vB; varying float vSt;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vB = uv / 16.0; vSt = st;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n if (st > 31.5) gl_Position.z -= 2.6e-6 * gl_Position.w;');
    sh.fragmentShader = `uniform sampler2D atlas; uniform vec3 skyRef; varying vec2 vB; varying float vSt; float gWin = 0.0;
      float hb(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      ` + sh.fragmentShader.replace('#include <map_fragment>', `
      float stf = floor(vSt + 0.5);
      if (stf > 31.5) {
        // yol: asfalt, kenar çizgileri, kesikli orta / şerit çizgisi
        float cls = stf - 32.0;
        float hw = cls < 1.5 ? 5.5 : cls < 3.5 ? 4.5 : cls < 4.5 ? 3.75 : 3.25;
        float xm = vB.x * hw, ax = abs(xm), along = vB.y;
        float aw = max(fwidth(xm), 0.02), vis = clamp(0.35 / aw, 0.0, 1.0);
        float n1 = hb(floor(vec2(xm * 2.0, along * 0.5))), n2 = hb(floor(vec2(along * 0.05, 3.0)));
        vec3 asph = vec3(0.075, 0.076, 0.08) * (0.85 + 0.15 * n1) * (0.9 + 0.2 * n2);
        asph *= 1.0 - 0.12 * smoothstep(0.4, 0.0, abs(ax - hw * 0.5));     // tekerlek izleri
        float ln = 0.0;
        if (cls < 4.5) ln += clamp(1.0 - abs(ax - (hw - 0.45)) / (0.12 + aw), 0.0, 1.0);
        float dash = cls < 1.5 ? step(mod(along, 12.0), 4.0) : step(mod(along, 9.0), 3.0);
        ln += clamp(1.0 - ax / (0.08 + aw), 0.0, 1.0) * dash;
        diffuseColor.rgb = mix(asph, vec3(0.80, 0.80, 0.78), clamp(ln, 0.0, 1.0) * vis);
      } else {
      float shop = step(15.5, stf); float tl = stf - shop * 16.0;
      vec2 cell = floor(vB), f = fract(vB);
      // zemin katı dükkân, bodrum (kat < 0) düz duvar
      if (shop > 0.5 && cell.y < 0.5 && cell.y > -0.5 && tl < 6.5) tl = 6.0;
      vec2 off = vec2(mod(tl, 4.0), 2.0 - floor(tl / 4.0)) / vec2(4.0, 3.0);
      vec2 gx = dFdx(vB) / vec2(4.0, 3.0), gy = dFdy(vB) / vec2(4.0, 3.0);
      vec4 tx = textureGrad(atlas, off + (f * 0.96 + 0.02) / vec2(4.0, 3.0), gx, gy);
      if (tl < 6.5 && cell.y < -0.5) tx = vec4(0.86, 0.85, 0.83, 0.0);
      float r = hb(cell + vec2(tl * 7.0, 0.0));
      vec3 win = tx.rgb * (0.75 + 0.5 * r);
      win = mix(win, vec3(0.82, 0.78, 0.68), step(0.9, r) * 0.6);
      gWin = tx.a * step(tl, 6.5);
      diffuseColor.rgb = mix(diffuseColor.rgb * tx.rgb, win, gWin);
      }
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 vd = normalize(vViewPosition); float fr = pow(1.0 - clamp(abs(dot(vd, normal)), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += gWin * skyRef * (0.06 + 0.5 * fr); }`);
  };
  mat.customProgramCacheKey = () => 'bina-atlas';
  return mat;
}

function minaretGeom() {
  const parts = [];
  const body = new THREE.CylinderGeometry(1.0, 1.2, 25, 8); body.translate(0, 12.5, 0); parts.push(body);
  const ser = new THREE.CylinderGeometry(1.6, 1.6, 0.6, 8); ser.translate(0, 19, 0); parts.push(ser);
  const cone = new THREE.ConeGeometry(1.1, 5, 8); cone.translate(0, 27.5, 0); parts.push(cone);
  return merge(parts);
}
export function merge(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  const hasCol = list.every((g) => g.attributes.color);
  const col = hasCol ? new Float32Array(nv * 3) : null;
  let v = 0, q = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3);
    if (col) col.set(g.attributes.color.array, v * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[q++] = g.index.array[i] + v;
    else for (let i = 0; i < g.attributes.position.count; i++) idx[q++] = v + i;
    v += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
// düşük poligon ağaç: gövde + iki katlı tepe, köşe renkli
function treeGeom(kind) {
  const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i), k = 0.75 + 0.35 * Math.min(1, y / 9); a[i * 3] = c[0] * k; a[i * 3 + 1] = c[1] * k; a[i * 3 + 2] = c[2] * k; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const trunk = paint(new THREE.CylinderGeometry(0.25, 0.35, 3, 5, 1, true).translate(0, 1.5, 0).toNonIndexed(), lin(0x5a4632));
  if (kind === 0) {
    const a = paint(new THREE.ConeGeometry(2.6, 6, 7, 1, true).translate(0, 5, 0).toNonIndexed(), lin(0x2f4a2a));
    const b = paint(new THREE.ConeGeometry(1.9, 4.5, 7, 1, true).translate(0, 8, 0).toNonIndexed(), lin(0x36552f));
    return merge([trunk, a, b].map((g) => { g.computeVertexNormals(); return g; }));
  }
  const a = paint(new THREE.IcosahedronGeometry(3.2, 1).scale(1, 0.85, 1).translate(0, 5.2, 0), lin(0x46612f));
  a.computeVertexNormals();
  trunk.computeVertexNormals();
  return merge([trunk, a]);
}

export class Buildings {
  // list: bina.json paketleri; trees: [{rect, agac}] ağaç rasterları
  constructor(world, root, list, trees, base, opt) {
    this.world = world; this.root = root; this.base = base;
    this.packs = list.map((p) => ({ ...p, state: 0, nodes: new Map(), col: new Map() }));
    const L = opt.lod || [1500, 4500, 9000];
    // ayrıntı uzaklıkları: 1 km tam, 2 km sade, 4 km kutu, 8 km yalnız büyükler (kaliteye göre)
    const q = opt.quality || (L[0] >= 2000 ? 'yuksek' : L[0] <= 1000 ? 'dusuk' : 'orta');
    this.D = q === 'yuksek' ? [L[0], L[1], L[2] * 1.45, Math.min(L[2] * 2.6, 34000)] : q === 'orta' ? [L[0], L[1], L[2] * 1.3, L[2] * 2.6] : [L[0] * 0.8, L[1] * 0.8, L[2] * 0.85, L[2] * 1.35];
    this.quality = q;
    this.treeDist = opt.treeDist || 1800;
    this.mat = buildingMaterial();
    this.treeMats = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.treeG = [treeGeom(0), treeGeom(1)];
    this.domeG = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    this.minG = minaretGeom();
    this.domeM = new THREE.MeshLambertMaterial({ color: 0x8a949e }); this.minM = new THREE.MeshLambertMaterial({ color: 0xe8e6e0 });
    this.worker = new Worker(new URL('./bworker.js', import.meta.url), { type: 'module' });
    this.inflight = 0; this.frame = 0;
    this.worker.onmessage = (e) => this._msg(e.data);
    this.worker.onerror = (e) => console.error('Bina işçisi:', e.message || e);
    this.stats = { nodes: 0, tris: 0 };
    this._mq = false;
    // arazi verisini işçiye kopyala (şimdiye kadar gelenler ve bundan sonra gelenler)
    const H = world.heights;
    this.sent = new Set();
    const send = (kind, key, g) => {
      if (!g || this.sent.has(kind + key)) return; this.sent.add(kind + key);
      this.worker.postMessage({ type: 'grid', kind, key, sz: H.BS * H.BT, R0: H.R0, grid: { nx: g.nx, ny: g.ny, x0: g.x0, y0: g.y0, s: g.s, H: g.H } });
    };
    for (const [k, g] of H.tiles) send('tile', k, g);
    for (const p of H.patches) send('patch', p.id, p.grid);
    H.onData((r, lvl, g, kind, key) => { if (g) send(kind, key, g); });
    this.treeList = (trees || []).map((t) => ({ ...t, state: 0 }));
  }
  _msg(m) {
    if (m.type === 'packReady') { const p = this.packs.find((q) => q.id === m.id); if (p) p.state = 3; return; }
    if (m.type === 'built') {
      this.inflight--;
      const p = this.packs.find((q) => q.id === m.id); if (!p) return;
      const nd = p.nodes.get(m.key); if (!nd) return;
      nd.pending = false;
      if (!m.index.length) { nd.mesh = 'empty'; nd.tris = 0; nd.mosques = []; }
      else {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3, true));
        g.setAttribute('color', new THREE.BufferAttribute(m.col, 3, true));
        g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
        g.setAttribute('st', new THREE.BufferAttribute(m.st, 1));
        g.setIndex(new THREE.BufferAttribute(m.index, 1));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, this.mat); mesh.matrixAutoUpdate = false;
        if (this.world.shadows) { mesh.receiveShadow = true; mesh.castShadow = m.lod === 0; }
        mesh.position.set(m.cx, 0, -m.cy); mesh.updateMatrix(); mesh.visible = false;
        this.root.add(mesh);
        nd.mesh = mesh; nd.tris = m.index.length / 3; nd.mosques = m.mosques;
      }
      if (m.colData) p.col.set(m.key, { x0: p.rect[0] + nd.i * 1000, y0: p.rect[1] + nd.j * 1000, d: m.colData });
      if (m.trees && m.trees.length) nd.trees = this._trees(m.trees, m.cx, m.cy);
      if (m.mosques && m.mosques.length) this._mq = true;
    } else if (m.type === 'col') {
      const p = this.packs.find((q) => q.id === m.id); if (!p) return;
      p.col.set('0:' + m.i + ':' + m.j, { x0: p.rect[0] + m.i * 1000, y0: p.rect[1] + m.j * 1000, d: m.colData });
      p.colPending && p.colPending.delete('0:' + m.i + ':' + m.j);
    }
  }
  _trees(arr, cx, cy) {
    const n = arr.length / 5, grp = new THREE.Group();
    const cnt = [0, 0];
    for (let i = 0; i < n; i++) cnt[arr[i * 5 + 4] & 1]++;
    const meshes = [0, 1].map((k) => { if (!cnt[k]) return null; const m = new THREE.InstancedMesh(this.treeG[k], this.treeMats, cnt[k]); m.count = 0; return m; });
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const k = arr[i * 5 + 4] & 1, m = meshes[k];
      const s = arr[i * 5 + 3];
      o.position.set(arr[i * 5] - cx, arr[i * 5 + 2] - 0.3, -(arr[i * 5 + 1] - cy)); o.scale.set(s, s * (0.85 + 0.3 * ((i * 7) % 5) / 4), s); o.rotation.y = i * 2.4; o.updateMatrix();
      m.setMatrixAt(m.count++, o.matrix);
    }
    for (const m of meshes) if (m) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); grp.add(m); }
    grp.position.set(cx, 0, -cy); grp.matrixAutoUpdate = false; grp.updateMatrix(); grp.visible = false;
    this.root.add(grp);
    return grp;
  }
  async _load(p) {
    p.state = 1;
    try {
      const buf = await pngBytes(this.base + p.dosya);
      this.worker.postMessage({ type: 'pack', id: p.id, buf }, [buf]);
      p.state = 2;
    } catch (e) { console.warn(e); p.state = -1; }
  }
  async _loadTrees(t) {
    t.state = 1;
    try { const buf = await pngBytes(this.base + t.agac); this.worker.postMessage({ type: 'trees', rect: t.rect, buf }, [buf]); t.state = 2; } catch (e) { console.warn(e); t.state = -1; }
  }
  // cam: mutlak {x, y, h}. ac: uçak konumu {x, y} (çarpışma ızgarası çevresinde hazır olsun)
  update(cam, ac) {
    this.frame++;
    const D = this.D, H = this.world.heights;
    const want = [];
    let tris = 0, nodes = 0;
    for (const t of this.treeList) {
      if (t.state) continue;
      const [x0, y0, x1, y1] = t.rect;
      if (Math.hypot(Math.max(x0 - cam.x, 0, cam.x - x1), Math.max(y0 - cam.y, 0, cam.y - y1)) < this.treeDist + 8000) this._loadTrees(t);
    }
    for (const p of this.packs) {
      const [x0, y0, x1, y1] = p.rect;
      const dp = Math.hypot(Math.max(x0 - cam.x, 0, cam.x - x1), Math.max(y0 - cam.y, 0, cam.y - y1));
      // paket, arazi verisi işçiye ulaşmışsa yüklenir (aynı yükseklikte otursun)
      if (p.state === 0 && dp < D[3] + 12000 && H.ensureRect(x0, y0, x1, y1)) this._load(p);
      if (p.state !== 3) continue;
      if (dp > D[3] + 4000) { if (p.nodes.size && this.frame % 60 === 0) this._purge(p, true); continue; }
      const dist = (l, i, j) => { const s = SIZES[l]; const ax = x0 + i * s, ay = y0 + j * s; const dx = Math.max(ax - cam.x, 0, cam.x - (ax + s)), dy = Math.max(ay - cam.y, 0, cam.y - (ay + s)); return Math.hypot(dx, dy, Math.max(0, cam.h - 150)); };
      const node = (l, i, j) => { const k = l + ':' + i + ':' + j; let n = p.nodes.get(k); if (!n) { n = { key: k, lod: l, i, j, mesh: null, pending: false, used: 0 }; p.nodes.set(k, n); } n.used = this.frame; return n; };
      const need = (n, d) => { if (!n.mesh && !n.pending) want.push([d + n.lod * 300, p, n]); };
      // seçim: düğüm uzaksa kendi düzeyi, yakınsa çocukları; çocuklar hazır değilse kendisi (hazırsa) ya da hazır çocuklar
      const visit = (l, i, j) => {
        const d = dist(l, i, j);
        const n = node(l, i, j);
        if (l === 0 || d > D[l - 1]) { need(n, d); return n.mesh ? [n] : null; }
        const s = SIZES[l - 1], out = []; let ok = true;
        for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
          const ii = i * 2 + a, jj = j * 2 + b;
          if (x0 + ii * s >= x1 || y0 + jj * s >= y1) continue;
          const r = visit(l - 1, ii, jj);
          if (r) out.push(...r); else ok = false;
        }
        if (ok) return out;
        need(n, d);
        if (n.mesh) return [n];
        return out.length ? out : null;
      };
      const nI = Math.ceil((x1 - x0) / 8000), nJ = Math.ceil((y1 - y0) / 8000);
      const show = [];
      for (let J = 0; J < nJ; J++) for (let I = 0; I < nI; I++) {
        if (dist(3, I, J) > D[3]) continue;
        const r = visit(3, I, J); if (r) show.push(...r);
      }
      for (const n of p.nodes.values()) { if (n.mesh && n.mesh !== 'empty') n.mesh.visible = false; if (n.trees) n.trees.visible = false; }
      for (const n of show) {
        if (!n.mesh || n.mesh === 'empty') continue;
        n.mesh.visible = true; tris += n.tris; nodes++;
        if (n.trees) { const d = dist(0, n.i, n.j); n.trees.visible = d < this.treeDist; }
      }
      p.shown = show;
      // uçağın çevresindeki çarpışma ızgaraları
      if (ac) {
        const ci = Math.floor((ac.x - x0) / 1000), cj = Math.floor((ac.y - y0) / 1000);
        p.colPending = p.colPending || new Set();
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
          const i = ci + a, j = cj + b; if (i < 0 || j < 0 || x0 + i * 1000 >= x1 || y0 + j * 1000 >= y1) continue;
          const k = '0:' + i + ':' + j;
          if (!p.col.has(k) && !p.colPending.has(k)) { p.colPending.add(k); this.worker.postMessage({ type: 'col', id: p.id, i, j }); }
        }
      }
      if (this.frame % 90 === 0) this._purge(p, false);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, p, n] of want) {
      if (this.inflight >= 3) break;
      n.pending = true; this.inflight++;
      this.worker.postMessage({ type: 'build', id: p.id, key: n.key, lod: n.lod, i: n.i, j: n.j });
    }
    if (this._mq && this.inflight === 0) { this._mq = false; this._mosques(); }
    this.forest(cam);
    this.stats.nodes = nodes; this.stats.tris = tris;
    this.pending = want.length + this.inflight;
    return this.pending;
  }
  _purge(p, all) {
    for (const [k, n] of p.nodes) {
      if (n.pending) continue;
      if (all || this.frame - n.used > 240) {
        if (n.mesh && n.mesh !== 'empty') { this.root.remove(n.mesh); n.mesh.geometry.dispose(); }
        if (n.trees) { this.root.remove(n.trees); n.trees.children.forEach((m) => m.dispose()); }
        if (n.mosques && n.mosques.length) this._mq = true;
        p.nodes.delete(k);
      }
    }
  }
  _mosques() {
    const M = [];
    for (const p of this.packs) for (const n of p.nodes.values()) if (n.mesh && n.mosques && n.lod < 2) M.push(...n.mosques);
    if (this.domeMesh) { this.root.remove(this.domeMesh); this.root.remove(this.minMesh); this.domeMesh.dispose(); this.minMesh.dispose(); this.domeMesh = null; }
    if (!M.length) return;
    const seen = new Set(), U = [];
    for (const m of M) { const k = Math.round(m.x) + ':' + Math.round(m.y); if (!seen.has(k)) { seen.add(k); U.push(m); } }
    const ox = U[0].x, oy = U[0].y;
    const dm = new THREE.InstancedMesh(this.domeG, this.domeM, U.length), mm = new THREE.InstancedMesh(this.minG, this.minM, U.length);
    const o = new THREE.Object3D();
    U.forEach((m, i) => {
      o.position.set(m.x - ox, m.top - 0.5, -(m.y - oy)); o.scale.set(m.r, m.r * 0.9, m.r); o.updateMatrix(); dm.setMatrixAt(i, o.matrix);
      const hh = Math.max(18, m.h * 1.9 + m.r);
      o.position.set(m.mx - ox, m.top - m.h, -(m.my - oy)); o.scale.set(1, hh / 30, 1); o.updateMatrix(); mm.setMatrixAt(i, o.matrix);
    });
    for (const x of [dm, mm]) { x.position.set(ox, 0, -oy); x.updateMatrix(); x.matrixAutoUpdate = false; x.computeBoundingSphere(); this.root.add(x); }
    this.domeMesh = dm; this.minMesh = mm;
  }
  // ayrıntılı ağaç rasteri olmayan yerlerde orman: örtü dokusundaki orman oranına (500 m) göre 1 km hücrelere örneklenmiş ağaç
  forest(cam) {
    const W = this.world, R = this.treeDist, C = 1000;
    this.fc = this.fc || new Map();
    const i0 = Math.floor((cam.x - R) / C), i1 = Math.floor((cam.x + R) / C), j0 = Math.floor((cam.y - R) / C), j1 = Math.floor((cam.y + R) / C);
    let built = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = i + ':' + j; let c = this.fc.get(k);
      const d = Math.hypot(Math.max(i * C - cam.x, 0, cam.x - (i + 1) * C), Math.max(j * C - cam.y, 0, cam.y - (j + 1) * C), Math.max(0, cam.h - 200));
      if (!c) {
        if (built >= 1 || d > R) continue;
        const x0 = i * C, y0 = j * C;
        if (this.treeList.some((t) => x0 + C > t.rect[0] && x0 < t.rect[2] && y0 + C > t.rect[1] && y0 < t.rect[3])) { this.fc.set(k, { g: null }); continue; }
        if (!W.heights.patchReady(x0 + C / 2, y0 + C / 2)) continue;
        built++;
        const arr = [];
        for (let y = y0 + 12; y < y0 + C; y += 24) for (let x = x0 + 12; x < x0 + C; x += 24) {
          const h1 = hash2(x, y), f = W.ortuAt(x + (h1 & 255) - 128, y + ((h1 >>> 8) & 255) - 128);
          if (f.water > 100 || h1 % 255 >= f.forest * 0.85) continue;
          const px = x + (((h1 >>> 16) & 255) / 255 - 0.5) * 20, py = y + (((h1 >>> 24) & 255) / 255 - 0.5) * 20;
          const g = W.terrainH(px, py);
          if (g < 1 || W.buildingTop(px, py) > 0) continue;
          arr.push(px, py, g, 0.8 + (h1 % 97) / 97 * 0.6, g > 900 || h1 % 3 === 0 ? 0 : 1);
        }
        c = { g: arr.length ? this._trees(new Float32Array(arr), x0 + C / 2, y0 + C / 2) : null };
        this.fc.set(k, c);
      }
      c.used = this.frame;
      if (c.g) c.g.visible = d < R;
    }
    if (this.frame % 120 === 0) for (const [k, c] of this.fc) if (this.frame - (c.used || 0) > 300) { if (c.g) { this.root.remove(c.g); c.g.children.forEach((m) => m.dispose()); } this.fc.delete(k); }
  }
  // bina tepesi (m) ya da 0; x doğu, y kuzey (mutlak)
  top(x, y) {
    for (const p of this.packs) {
      if (p.state !== 3) continue;
      const [x0, y0, x1, y1] = p.rect;
      if (x < x0 || y < y0 || x >= x1 || y >= y1) continue;
      const i = Math.floor((x - x0) / 1000), j = Math.floor((y - y0) / 1000);
      const c = p.col.get('0:' + i + ':' + j); if (!c) return 0;
      const li = Math.floor((x - c.x0) / CS), lj = Math.floor((y - c.y0) / CS);
      if (li < 0 || lj < 0 || li >= CN || lj >= CN) return 0;
      const v = c.d[lj * CN + li];
      return v ? (v - 4000) / 2 : 0;
    }
    return 0;
  }
}
