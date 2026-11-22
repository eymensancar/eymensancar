// Şehir binaları: paket yükleme, uzaklığa göre ayrıntı (1/2/4 km düğümler), çarpışma ızgarası, camiler (kubbe+minare), ağaçlar.
import * as THREE from '../vendor/three.module.min.js';
import { pngBytes } from './veri.js';

const CS = 12.5, CN = 80;

function windowTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  // pencere: koyu cam, gökyüzü yansıması, çerçeve, denizlik
  const gr = g.createLinearGradient(0, 30, 0, 96); gr.addColorStop(0, '#8fa3b5'); gr.addColorStop(0.5, '#6d7f90'); gr.addColorStop(1, '#55636f');
  g.fillStyle = gr; g.fillRect(30, 34, 68, 60);
  g.fillStyle = '#e8e8e6'; g.fillRect(62, 34, 4, 60); g.fillRect(30, 60, 68, 3);
  g.fillStyle = '#c9c6c0'; g.fillRect(26, 94, 76, 6);
  g.fillStyle = '#d7d4ce'; g.fillRect(0, 118, 128, 10);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.repeat.set(1 / 16, 1 / 16);
  return t;
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
// düşük poligon ağaç: gövde + iki katlı tepe (8 + 10 üçgen), köşe renkli
function treeGeom(kind) {
  const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const trunk = paint(new THREE.CylinderGeometry(0.25, 0.35, 3, 5, 1, true).translate(0, 1.5, 0).toNonIndexed(), lin(0x5a4632));
  if (kind === 0) { // iğne yapraklı
    const a = paint(new THREE.ConeGeometry(2.6, 6, 6, 1, true).translate(0, 5, 0).toNonIndexed(), lin(0x2f4a2a));
    const b = paint(new THREE.ConeGeometry(1.9, 4.5, 6, 1, true).translate(0, 8, 0).toNonIndexed(), lin(0x36552f));
    return merge([trunk, a, b].map((g) => { g.computeVertexNormals(); return g; }));
  }
  const a = paint(new THREE.IcosahedronGeometry(3.2, 0).scale(1, 0.85, 1).translate(0, 5.2, 0), lin(0x46612f));
  a.computeVertexNormals();
  trunk.computeVertexNormals();
  return merge([trunk, a]);
}

export class Buildings {
  constructor(world, root, idx, base, opt) {
    this.world = world; this.root = root; this.base = base;
    this.packs = (idx.paketler || []).map((p) => ({ ...p, state: 0, nodes: new Map(), col: new Map() }));
    this.D = opt.lod || [1500, 4500, 9000];
    this.treeDist = opt.treeDist || 1800;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: windowTex() });
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
  }
  _msg(m) {
    if (m.type === 'packReady') { const p = this.packs.find((q) => q.id === m.id); if (p) p.state = 3; return; }
    if (m.type === 'built') {
      this.inflight--;
      const p = this.packs.find((q) => q.id === m.id); if (!p) return;
      const nd = p.nodes.get(m.key); if (!nd) return;
      nd.pending = false;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3, true));
      g.setAttribute('color', new THREE.BufferAttribute(m.col, 3, true));
      g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
      g.setIndex(new THREE.BufferAttribute(m.index, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.mat); mesh.matrixAutoUpdate = false;
      mesh.position.set(m.cx, 0, -m.cy); mesh.updateMatrix(); mesh.visible = false;
      this.root.add(mesh);
      nd.mesh = mesh; nd.tris = m.index.length / 3; nd.mosques = m.mosques;
      if (m.colData) p.col.set(m.key, { x0: p.rect[0] + nd.i * 1000, y0: p.rect[1] + nd.j * 1000, d: m.colData });
      if (m.trees && m.trees.length) nd.trees = this._trees(m.trees, m.cx, m.cy);
      if (m.mosques.length) this._mq = true;
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
    const hp = this.world.heights.patchList.find((q) => q.id === p.id);
    try {
      const [b, t] = await Promise.all([p.bina ? pngBytes(this.base + p.bina) : null, p.agac ? pngBytes(this.base + p.agac) : null]);
      // bölgenin yükseklik ızgarası gelene kadar bekle
      while (!hp.grid) { if (hp.failed) throw new Error('bölge yüksekliği yok: ' + p.id); await new Promise((r) => setTimeout(r, 100)); }
      const g = hp.grid;
      const buf = b || emptyPack(p.rect);
      this.worker.postMessage({ type: 'pack', id: p.id, buf, trees: t, style: p.id === 'istanbul' ? 0 : 1, grid: { nx: g.nx, ny: g.ny, x0: g.x0, y0: g.y0, s: g.s, H: g.H } }, [buf].concat(t ? [t] : []));
      p.state = 2;
    } catch (e) { console.warn(e); p.state = -1; }
  }
  // cam: mutlak {x, y, h}. ac: uçak konumu {x, y} (çarpışma ızgarası çevresinde hazır olsun)
  update(cam, ac) {
    this.frame++;
    const [D0, D1, D2] = this.D;
    const want = [];
    let tris = 0, nodes = 0;
    for (const p of this.packs) {
      const [x0, y0, x1, y1] = p.rect;
      const dxp = Math.max(x0 - cam.x, 0, cam.x - x1), dyp = Math.max(y0 - cam.y, 0, cam.y - y1);
      const dp = Math.hypot(dxp, dyp);
      if (p.state === 0 && dp < D2 + 15000) this._load(p);
      if (p.state !== 3) continue;
      if (dp > D2 + 4000) { if (p.nodes.size && this.frame % 60 === 0) this._purge(p, true); continue; }
      const nI = Math.ceil((x1 - x0) / 4000), nJ = Math.ceil((y1 - y0) / 4000);
      const show = [];
      const dist = (lod, i, j) => { const s = [1000, 2000, 4000][lod]; const ax = x0 + i * s, ay = y0 + j * s; const dx = Math.max(ax - cam.x, 0, cam.x - (ax + s)), dy = Math.max(ay - cam.y, 0, cam.y - (ay + s)); return Math.hypot(dx, dy, Math.max(0, cam.h - 150)); };
      const node = (lod, i, j) => { const k = lod + ':' + i + ':' + j; let n = p.nodes.get(k); if (!n) { n = { key: k, lod, i, j, mesh: null, pending: false, used: 0 }; p.nodes.set(k, n); } n.used = this.frame; return n; };
      const need = (n, d) => { if (!n.mesh && !n.pending) want.push([d + n.lod * 200, p, n]); };
      for (let J = 0; J < nJ; J++) for (let I = 0; I < nI; I++) {
        const d2 = dist(2, I, J);
        if (d2 > D2) continue;
        const n2 = node(2, I, J);
        if (d2 > D1) { need(n2, d2); if (n2.mesh) show.push(n2); continue; }
        // 2 km çocuklar
        const kids1 = [];
        for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const i = I * 2 + a, j = J * 2 + b; if (x0 + i * 2000 >= x1 || y0 + j * 2000 >= y1) continue; kids1.push([i, j]); }
        const list1 = [];
        let ready = true;
        for (const [i, j] of kids1) {
          const d1 = dist(1, i, j);
          if (d1 > D0) { const n1 = node(1, i, j); need(n1, d1); if (!n1.mesh) ready = false; list1.push([n1]); continue; }
          const ks = [];
          for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const ii = i * 2 + a, jj = j * 2 + b; if (x0 + ii * 1000 >= x1 || y0 + jj * 1000 >= y1) continue; const n0 = node(0, ii, jj); need(n0, dist(0, ii, jj)); ks.push(n0); }
          if (ks.every((n0) => n0.mesh)) list1.push(ks);
          else { const n1 = node(1, i, j); need(n1, d1); if (n1.mesh) list1.push([n1]); else { ready = false; list1.push(ks.filter((n0) => n0.mesh)); } }
        }
        if (ready) for (const l of list1) show.push(...l);
        else { need(n2, d2); if (n2.mesh) show.push(n2); else for (const l of list1) show.push(...l); }
      }
      for (const n of p.nodes.values()) { if (n.mesh) n.mesh.visible = false; if (n.trees) n.trees.visible = false; }
      for (const n of show) {
        if (!n.mesh) continue;
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
    this.stats.nodes = nodes; this.stats.tris = tris;
    this.pending = want.length + this.inflight;
    return this.pending;
  }
  _purge(p, all) {
    for (const [k, n] of p.nodes) {
      if (n.pending) continue;
      if (all || this.frame - n.used > 240) {
        if (n.mesh) { this.root.remove(n.mesh); n.mesh.geometry.dispose(); }
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
    // aynı caminin iki düzeyde tekrarı olmasın
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
function emptyPack(rect) {
  const ncx = Math.ceil((rect[2] - rect[0]) / 1000), ncy = Math.ceil((rect[3] - rect[1]) / 1000);
  const b = new ArrayBuffer(32 + ncx * ncy * 6); const dv = new DataView(b);
  dv.setUint8(0, 89); dv.setUint32(4, 0, true); dv.setFloat64(8, rect[0], true); dv.setFloat64(16, rect[1], true); dv.setUint16(24, ncx, true); dv.setUint16(26, ncy, true); dv.setFloat32(28, 1000, true);
  return b;
}
