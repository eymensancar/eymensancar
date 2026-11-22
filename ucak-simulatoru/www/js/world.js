// İstanbul Uçuşu - dünya: arazi, su, gökyüzü, binalar, köprüler, simge yapılar, pist.
// Koordinatlar: veri dosyalarında x doğu, y kuzey (metre). three.js'te X = doğu, Y = yukarı, Z = güney (-kuzey).
import * as THREE from '../vendor/three.module.min.js';

export const LAT0 = 41.085, LON0 = 28.97;
const MLAT = 111319.49, MLON = 111319.49 * Math.cos(LAT0 * Math.PI / 180);
export const geo = (lat, lon) => ({ x: (lon - LON0) * MLON, y: (lat - LAT0) * MLAT });

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

async function bin(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }
async function json(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
function img(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(url)); i.src = url; }); }

// Simge yapılar (enlem, boylam). Konumlar OpenStreetMap / Vikipedi.
export const LANDMARKS = [
  { id: 'galata', name: 'Galata Kulesi', lat: 41.025658, lon: 28.974155 },
  { id: 'kiz', name: 'Kız Kulesi', lat: 41.021164, lon: 29.004092 },
  { id: 'ayasofya', name: 'Ayasofya', lat: 41.008583, lon: 28.980175 },
  { id: 'sultanahmet', name: 'Sultanahmet Camii', lat: 41.005410, lon: 28.976814 },
  { id: 'suleymaniye', name: 'Süleymaniye Camii', lat: 41.016111, lon: 28.963889 },
  { id: 'dolmabahce', name: 'Dolmabahçe Sarayı', lat: 41.039167, lon: 29.000556 },
  { id: 'rumeli', name: 'Rumeli Hisarı', lat: 41.084722, lon: 29.056111 },
  { id: 'camlicakule', name: 'Çamlıca Kulesi', lat: 41.01638, lon: 29.06554 },
  { id: 'camlicacami', name: 'Büyük Çamlıca Camii', lat: 41.0277, lon: 29.0697 },
];

export class World {
  constructor(renderer, scene, opts = {}) {
    this.renderer = renderer; this.scene = scene; this.opts = opts;
    this.chunks = []; this.colliders = []; this.decks = [];
    this.acAlt = 0;
    this.buildDist = opts.buildDist || 8000;
  }

  async load(progress = () => {}) {
    const base = 'data/';
    progress(0.05, 'Yükseklik verisi');
    const [hb, bb, br, rw, tex, mask, mini] = await Promise.all([
      bin(base + 'yukseklik.bin'), bin(base + 'binalar.bin'), json(base + 'kopruler.json'), json(base + 'pist.json'),
      img(base + 'zemin.webp'), img(base + 'maske.png'), img(base + 'harita.png'),
    ]);
    this.minimap = mini;
    progress(0.35, 'Arazi');
    this._heights(hb);
    this._mask(mask);
    this.runway = rw;
    this._rwSetup();
    this._sky();
    this._water();
    this._terrain(tex);
    this._runwayMesh();
    progress(0.5, 'Binalar');
    await this._buildingsParse(bb);
    this._landmarks();
    this._bridges(br);
    progress(0.6, 'Binalar');
  }

  // ---------- yükseklik ----------
  _heights(buf) {
    const dv = new DataView(buf);
    const n = dv.getUint16(4, true), m = dv.getUint16(6, true);
    this.HG = n;
    this.X0 = dv.getFloat32(8, true); this.X1 = dv.getFloat32(12, true); this.Y0 = dv.getFloat32(16, true); this.Y1 = dv.getFloat32(20, true);
    const raw = new Int16Array(buf.slice(24, 24 + n * m * 2));
    this.H = new Float32Array(n * m);
    for (let i = 0; i < raw.length; i++) this.H[i] = raw[i] / 10;
  }
  terrainH(x, y) {
    const n = this.HG;
    const fi = clamp((x - this.X0) / (this.X1 - this.X0) * (n - 1), 0, n - 1.0001);
    const fj = clamp((this.Y1 - y) / (this.Y1 - this.Y0) * (n - 1), 0, n - 1.0001);
    const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, H = this.H;
    const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
    // mesh üçgenleriyle aynı bölme (PlaneGeometry: a-c-b ve c-d-b)
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  _mask(im) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    this.MW = c.width; this.M = new Uint8Array(c.width * c.height);
    for (let i = 0; i < this.M.length; i++) this.M[i] = d[i * 4] > 127 ? 1 : 0;
  }
  isLand(x, y) {
    const W = this.MW;
    const i = Math.floor((x - this.X0) / (this.X1 - this.X0) * W), j = Math.floor((this.Y1 - y) / (this.Y1 - this.Y0) * W);
    if (i < 0 || j < 0 || i >= W || j >= W) return y > this.Y0 + 2000 || x < this.X0 || x > this.X1; // güney kenarı Marmara
    return this.M[j * W + i] === 1;
  }

  // FDM için yer: {h, kind}. x doğu, y kuzey
  ground(x, y) {
    // köprü tabliyesi (uçak üstündeyse)
    for (const d of this.decks) {
      const px = x - d.ax, py = y - d.ay;
      const al = px * d.ux + py * d.uy, cr = -px * d.uy + py * d.ux;
      if (al >= 0 && al <= d.len && Math.abs(cr) <= d.w / 2) {
        const top = d.h0 + (d.h1 - d.h0) * (al / d.len);
        const hh = d.deckAt ? d.deckAt(al) : top;
        if (this.acAlt > hh - 3) return { h: hh, kind: 'runway' };
      }
    }
    const r = this.rw;
    const px = x - r.ax, py = y - r.ay;
    const al = px * r.ux + py * r.uy, cr = -px * r.uy + py * r.ux;
    if (al >= -60 && al <= r.len + 60 && Math.abs(cr) <= r.w / 2 + 4) return { h: r.elev + 0.12, kind: 'runway' };
    if (!this.isLand(x, y)) return { h: 0, kind: 'water' };
    const h = this.terrainH(x, y);
    const bt = this.buildingTop(x, y);
    if (bt > h + 1) return { h: bt, kind: 'building' };
    return { h, kind: 'land' };
  }

  _rwSetup() {
    const r = this.runway;
    const dx = r.b[0] - r.a[0], dy = r.b[1] - r.a[1], L = Math.hypot(dx, dy);
    this.rw = { ax: r.a[0], ay: r.a[1], ux: dx / L, uy: dy / L, len: L, w: r.width, elev: r.elev, heading: Math.atan2(dx, dy) };
  }

  // ---------- gökyüzü ----------
  _sky() {
    this.sunDir = new THREE.Vector3(-0.45, 0.55, 0.7).normalize(); // güneybatıdan öğleden sonra
    const geom = new THREE.SphereGeometry(1, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { sun: { value: this.sunDir }, top: { value: new THREE.Color(0x3d78c2) }, hor: { value: new THREE.Color(0xc9dbe8) } },
      vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `varying vec3 vd; uniform vec3 sun, top, hor;
        void main(){ float y = max(vd.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.55));
          if (vd.y < 0.0) c = hor * 0.95;
          float s = max(dot(normalize(vd), sun), 0.0);
          c += vec3(1.0,0.92,0.75) * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.18);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(geom, this.skyMat);
    this.sky.scale.setScalar(1000); this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    this.fogColor = new THREE.Color(0xc4d4df);
    this.scene.fog = new THREE.FogExp2(this.fogColor, 0.000085);
    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8a7f6a, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
    sun.position.copy(this.sunDir).multiplyScalar(1000);
    this.scene.add(sun); this.sunLight = sun;
  }

  // ---------- su ----------
  _water() {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); const id = g.createImageData(N, N);
    // dalga normal haritası: birkaç sinüsün toplamı (dikişsiz)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let hx = 0, hy = 0;
      const W = [[3, 1, 0.5], [1, 4, 0.4], [5, -2, 0.25], [-3, 6, 0.2], [9, 4, 0.1], [-7, -9, 0.08]];
      for (const [kx, ky, a] of W) { const ph = 2 * Math.PI * (kx * i + ky * j) / N + kx * 1.7; hx += a * kx * Math.cos(ph); hy += a * ky * Math.cos(ph); }
      const k = (j * N + i) * 4;
      id.data[k] = 128 + clamp(hx * 12, -127, 127); id.data[k + 1] = 128 + clamp(hy * 12, -127, 127); id.data[k + 2] = 255; id.data[k + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    const nm = new THREE.CanvasTexture(c); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.set(2200, 2200);
    nm.colorSpace = THREE.NoColorSpace;
    this.waterNormal = nm;
    const mat = new THREE.MeshPhongMaterial({ color: 0x1f5878, specular: 0xffffff, shininess: 140, normalMap: nm, normalScale: new THREE.Vector2(0.16, 0.16) });
    const skyHor = new THREE.Color(0xb8d0e2);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.skyHor = { value: skyHor };
      sh.fragmentShader = 'uniform vec3 skyHor;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
        `float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
         outgoingLight = mix(outgoingLight, skyHor, fr * 0.65);
         #include <opaque_fragment>`);
    };
    const w = new THREE.Mesh(new THREE.PlaneGeometry(240000, 240000), mat);
    w.rotation.x = -Math.PI / 2; w.renderOrder = -5;
    mat.depthWrite = false;
    this.water = w; this.scene.add(w);
  }

  // ---------- arazi ----------
  _terrain(im) {
    const tex = new THREE.Texture(im); tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    // telefonda doku 2048'e indirilir (bellek)
    if (this.opts.lowTex) {
      const c = document.createElement('canvas'); c.width = c.height = 2048;
      c.getContext('2d').drawImage(im, 0, 0, 2048, 2048); tex.image = c;
    }
    const n = this.HG;
    const ext = [150, 400, 900, 2000, 4500, 9000, 18000, 40000];
    const xs = [], ys = [];
    const dx = (this.X1 - this.X0) / (n - 1), dy = (this.Y1 - this.Y0) / (n - 1);
    for (let k = ext.length - 1; k >= 0; k--) xs.push(this.X0 - ext[k]);
    for (let i = 0; i < n; i++) xs.push(this.X0 + i * dx);
    for (let k = 0; k < ext.length; k++) xs.push(this.X1 + ext[k]);
    for (let k = ext.length - 1; k >= 0; k--) ys.push(this.Y1 + ext[k]);
    for (let j = 0; j < n; j++) ys.push(this.Y1 - j * dy);
    for (let k = 0; k < ext.length; k++) ys.push(this.Y0 - ext[k]);
    const W = xs.length, Hh = ys.length;
    const pos = new Float32Array(W * Hh * 3), uv = new Float32Array(W * Hh * 2);
    const e = 0.5 / 4096;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const x = xs[i], y = ys[j];
      const cx = clamp(x, this.X0, this.X1), cy = clamp(y, this.Y0, this.Y1);
      const out = Math.max(Math.abs(x - cx), Math.abs(y - cy));
      let h = this.terrainH(cx, cy) * Math.max(0, 1 - out / 8000);
      const k = j * W + i;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -y;
      uv[k * 2] = clamp((x - this.X0) / (this.X1 - this.X0), e, 1 - e);
      uv[k * 2 + 1] = clamp((y - this.Y0) / (this.Y1 - this.Y0), e, 1 - e);
    }
    const idx = new Uint32Array((W - 1) * (Hh - 1) * 6); let q = 0;
    for (let j = 0; j < Hh - 1; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = c; idx[q++] = d; idx[q++] = b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    tex.flipY = true;
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
    // yakın ayrıntı: dünya koordinatından tekrarlanan gürültü (bulanık dokuyu kırar)
    const dc = document.createElement('canvas'); dc.width = dc.height = 256;
    const dg = dc.getContext('2d');
    const sm = document.createElement('canvas'); sm.width = sm.height = 32;
    const sg = sm.getContext('2d'); const sd = sg.createImageData(32, 32);
    for (let i = 0; i < 32 * 32; i++) { const v = 90 + Math.random() * 120; sd.data[i * 4] = sd.data[i * 4 + 1] = sd.data[i * 4 + 2] = v; sd.data[i * 4 + 3] = 255; }
    sg.putImageData(sd, 0, 0);
    dg.imageSmoothingEnabled = true;
    for (const [ox, oy] of [[0, 0], [-256, 0], [0, -256], [-256, -256]]) dg.drawImage(sm, ox + 0, oy + 0, 512, 512);
    const fd = dg.getImageData(0, 0, 256, 256);
    for (let i = 0; i < 256 * 256; i++) { const n = (Math.random() - 0.5) * 50; fd.data[i * 4] += n; fd.data[i * 4 + 1] += n; fd.data[i * 4 + 2] += n; }
    dg.putImageData(fd, 0, 0);
    const det = new THREE.CanvasTexture(dc); det.wrapS = det.wrapT = THREE.RepeatWrapping; det.colorSpace = THREE.NoColorSpace;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.detailMap = { value: det };
      sh.vertexShader = 'varying vec2 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWp = position.xz;');
      sh.fragmentShader = 'uniform sampler2D detailMap; varying vec2 vWp;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
         float dn = texture2D(detailMap, vWp / 23.0).r * 0.55 + texture2D(detailMap, vWp / 157.0).r * 0.45;
         diffuseColor.rgb *= 0.8 + 0.4 * dn;`);
    };
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
    this.terrain = m; this.scene.add(m);
  }

  _runwayMesh() {
    const r = this.rw;
    const CW = 128, CHh = 4096;
    const c = document.createElement('canvas'); c.width = CW; c.height = CHh;
    const g = c.getContext('2d');
    g.fillStyle = '#4a4b4d'; g.fillRect(0, 0, CW, CHh);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`; g.fillRect(Math.random() * CW, Math.random() * CHh, 2, 3); }
    // lastik izleri (dokunma bölgeleri)
    g.fillStyle = 'rgba(20,20,20,0.35)';
    for (const y0 of [CHh - 900 / (r.len / CHh), 300 / (r.len / CHh)]) for (let i = 0; i < 40; i++) g.fillRect(CW / 2 - 18 + Math.random() * 36, y0 - 200 + Math.random() * 400, 3, 60);
    const mpp = r.len / CHh; // metre / piksel (uzunlamasına)
    const ppw = CW / r.w;    // piksel / metre (enine)
    const X = (m) => CW / 2 + m * ppw;
    g.fillStyle = '#e8e8e4';
    // kenar çizgileri
    g.fillRect(X(-r.w / 2 + 1), 0, ppw * 0.9, CHh); g.fillRect(X(r.w / 2 - 1.9), 0, ppw * 0.9, CHh);
    // orta çizgi: 30 m çizgi, 20 m boşluk
    for (let s = 120; s < r.len - 120; s += 50) g.fillRect(X(-0.45), CHh - (s + 30) / mpp, ppw * 0.9, 30 / mpp);
    // eşik (piyano tuşları): 6+6 şerit, 30 m
    const piano = (y, dir) => { for (let k = 0; k < 6; k++) for (const sd of [-1, 1]) { const xm = sd * (3 + k * 3.6); g.fillRect(X(xm) - (sd < 0 ? ppw * 1.8 : 0), y, ppw * 1.8, dir * 30 / mpp); } };
    piano(CHh - 6 / mpp, -1); piano(6 / mpp, 1);
    const num = (txt, yMeters, rot) => {
      g.save(); g.translate(CW / 2, rot ? yMeters / mpp : CHh - yMeters / mpp); if (rot) g.rotate(Math.PI);
      g.scale(1, (1 / mpp) / ppw * 1.0); g.font = `bold ${Math.round(14 * ppw)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, 0, 0); g.restore();
    };
    num('05', 60, false); num('23', 60, true);
    // hedef noktası ve dokunma bölgesi işaretleri
    for (const s of [150, 300, 450]) for (const end of [0, 1]) for (const sd of [-1, 1]) {
      const yy = end ? s / mpp : CHh - (s + 22) / mpp; g.fillRect(X(sd * 9) - ppw, yy, ppw * 2, 22 / mpp);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(r.w, r.len + 2);
    const mat = new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const m = new THREE.Mesh(geo, mat);
    // PlaneGeometry: uzunluk +Y; X ekseninde -90° döndürünce -Z (kuzey), sonra grup baş yönüne çevrilir
    m.rotation.set(-Math.PI / 2, 0, 0);
    const grp = new THREE.Group(); grp.add(m);
    grp.rotation.y = -r.heading; // kuzeyden saat yönü
    grp.position.set(r.ax + r.ux * r.len / 2, r.elev + 0.12, -(r.ay + r.uy * r.len / 2));
    this.scene.add(grp);
  }

  // ---------- binalar ----------
  // Çözme, çarpışma ızgarası ve geometri bir işçide (js/bworker.js) yapılır.
  _buildingsParse(buf) {
    const dv = new DataView(buf);
    const NC = dv.getUint16(8, true), CH = dv.getUint16(10, true);
    this.NC = NC; this.CH = CH;
    const tbl = 28;
    for (let c = 0; c < NC * NC; c++) {
      const n = dv.getUint32(tbl + c * 8 + 4, true);
      if (!n) continue;
      const cx = c % NC, cy = (c / NC) | 0;
      this.chunks.push({ idx: c, n, x: this.X0 + (cx + 0.5) * CH, y: this.Y1 - (cy + 0.5) * CH, mesh: null, built: false, pending: false });
    }
    this.byIdx = new Map(this.chunks.map((c) => [c.idx, c]));
    this.CG = 16;
    this.mosqueMap = new Map();
    this.worker = new Worker(new URL('./bworker.js', import.meta.url), { type: 'module' });
    this.inflight = 0;
    return new Promise((res, rej) => {
      this.worker.onerror = (e) => rej(new Error('Bina işçisi: ' + (e.message || 'hata')));
      this.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'col') { this.col = m.col; this.CW = m.CW; this.CHh = m.CHh; res(); }
        else if (m.type === 'chunk') this._chunkArrived(m);
      };
      this.worker.postMessage({ type: 'init', buf, H: this.H, HG: this.HG, X0: this.X0, X1: this.X1, Y0: this.Y0, Y1: this.Y1, G: this.CG }, [buf]);
    });
  }
  _mark(x, y, top) {
    const i = Math.floor((x - this.X0) / this.CG), j = Math.floor((this.Y1 - y) / this.CG);
    if (i < 0 || j < 0 || i >= this.CW || j >= this.CHh) return;
    const k = j * this.CW + i, t = Math.min(65000, Math.round(top * 2));
    if (this.col[k] < t) this.col[k] = t;
  }
  _markDisc(x, y, r, top) { for (let a = -r; a <= r; a += this.CG / 2) for (let b = -r; b <= r; b += this.CG / 2) if (a * a + b * b <= r * r) this._mark(x + a, y + b, top); }
  buildingTop(x, y) {
    const i = Math.floor((x - this.X0) / this.CG), j = Math.floor((this.Y1 - y) / this.CG);
    if (i < 0 || j < 0 || i >= this.CW || j >= this.CHh) return 0;
    return this.col[j * this.CW + i] / 2;
  }

  _windowTex() {
    if (this.wtex) return this.wtex;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#a9b0b8'; g.fillRect(16, 18, 32, 28);
    g.fillStyle = '#8d949c'; g.fillRect(16, 18, 32, 5);
    g.fillStyle = '#eeeeee'; g.fillRect(31, 16, 2, 34);
    g.fillStyle = '#d9d6d0'; g.fillRect(0, 58, 64, 6);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    this.wtex = t; return t;
  }

  _chunkArrived(m) {
    this.inflight--;
    const ch = this.byIdx.get(m.idx); if (!ch) return;
    ch.pending = false;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(m.col, 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
    g.setIndex(new THREE.BufferAttribute(m.index, 1));
    g.computeBoundingSphere();
    if (!this.bmat) { const t = this._windowTex(); t.repeat.set(1 / 16, 1 / 16); this.bmat = new THREE.MeshLambertMaterial({ vertexColors: true, map: t }); }
    const mesh = new THREE.Mesh(g, this.bmat);
    mesh.matrixAutoUpdate = false;
    ch.mesh = mesh; ch.built = true;
    this.scene.add(mesh);
    if (m.mosques.length) { this.mosqueMap.set(m.idx, m.mosques); this._mqDirty = true; }
  }

  // Kameraya yakın parçaları işçiden iste; uzaktakileri gizle, çok uzaktakileri bellekten at.
  update(camPos) {
    const cx = camPos.x, cy = -camPos.z;
    const D2 = this.buildDist * this.buildDist;
    const want = [];
    for (const ch of this.chunks) {
      const d2 = (ch.x - cx) ** 2 + (ch.y - cy) ** 2;
      if (ch.built) {
        ch.mesh.visible = d2 < D2;
        if (d2 > D2 * 2.2) { this.scene.remove(ch.mesh); ch.mesh.geometry.dispose(); ch.mesh = null; ch.built = false; if (this.mosqueMap.delete(ch.idx)) this._mqDirty = true; }
      } else if (!ch.pending && d2 < D2 * 1.2) want.push([d2, ch]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, ch] of want) {
      if (this.inflight >= 2) break;
      ch.pending = true; this.inflight++;
      this.worker.postMessage({ type: 'build', idx: ch.idx });
    }
    if (this._mqDirty && this.inflight === 0) { this._mqDirty = false; this._mosqueInstances(); }
    return want.length + this.inflight;
  }
  pendingNear(camPos, r) {
    const cx = camPos.x, cy = -camPos.z;
    return this.chunks.filter((ch) => !ch.built && (ch.x - cx) ** 2 + (ch.y - cy) ** 2 < r * r).length;
  }

  // camiler: kubbe ve minare (örneklenmiş, 2 çizim çağrısı)
  _mosqueInstances() {
    const M = [].concat(...this.mosqueMap.values());
    if (this.domeMesh) { this.scene.remove(this.domeMesh); this.scene.remove(this.minMesh); this.domeMesh.dispose(); this.minMesh.dispose(); this.domeMesh = null; }
    if (!M.length) return;
    const dome = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const minG = minaretGeom();
    const dm = new THREE.InstancedMesh(dome, new THREE.MeshLambertMaterial({ color: 0x8a949e }), M.length);
    const mm = new THREE.InstancedMesh(minG, new THREE.MeshLambertMaterial({ color: 0xe8e6e0 }), M.length);
    const o = new THREE.Object3D();
    M.forEach((m, i) => {
      o.position.set(m.x, m.top - 0.5, -m.y); o.scale.set(m.r, m.r * 0.9, m.r); o.rotation.set(0, 0, 0); o.updateMatrix(); dm.setMatrixAt(i, o.matrix);
      const hh = Math.max(18, m.h * 1.9 + m.r);
      o.position.set(m.mx, m.top - m.h, -m.my); o.scale.set(1, hh / 30, 1); o.updateMatrix(); mm.setMatrixAt(i, o.matrix);
    });
    dm.frustumCulled = mm.frustumCulled = false;
    this.domeMesh = dm; this.minMesh = mm;
    this.scene.add(dm); this.scene.add(mm);
  }

  // ---------- simge yapılar ----------
  _landmarks() {
    const S = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: 0xcfc2a8 });
    const stoneDark = new THREE.MeshLambertMaterial({ color: 0xa89a82 });
    const lead = new THREE.MeshLambertMaterial({ color: 0x7d8a96 });
    const white = new THREE.MeshLambertMaterial({ color: 0xf1eee6 });
    const pink = new THREE.MeshLambertMaterial({ color: 0xd2a088 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fb4c4 });
    const at = (id) => { const L = LANDMARKS.find((l) => l.id === id); const p = geo(L.lat, L.lon); return { x: p.x, y: p.y, h: this.terrainH(p.x, p.y), name: L.name }; };
    const grp = (p, rotDeg = 0) => { const g = new THREE.Group(); g.position.set(p.x, p.h, -p.y); g.rotation.y = -rotDeg * Math.PI / 180; S.add(g); return g; };
    const box = (g, m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
    const cyl = (g, m, r0, r1, h, x, y, z, seg = 12) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
    const domeM = (g, m, r, x, y, z, sy = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); o.position.set(x, y, z); o.scale.y = sy; g.add(o); return o; };
    const halfDome = (g, m, r, x, y, z, rot) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI, 0, Math.PI / 2), m); o.position.set(x, y, z); o.rotation.y = rot; g.add(o); return o; };
    const minaret = (g, x, z, h, base = 0, m = white) => {
      cyl(g, m, 2.2, 2.0, h * 0.82, x, base, z, 10);
      cyl(g, m, 2.8, 2.8, 0.8, x, base + h * 0.55, z, 10);
      cyl(g, m, 2.6, 2.6, 0.7, x, base + h * 0.72, z, 10);
      const c = new THREE.Mesh(new THREE.ConeGeometry(2.1, h * 0.18, 10), lead); c.position.set(x, base + h * 0.82 + h * 0.09, z); g.add(c);
    };
    const reg = (p, r, top) => this._markDisc(p.x, p.y, r, p.h + top);
    this.landmarkPos = LANDMARKS.map((l) => ({ ...at(l.id), id: l.id }));

    // Galata Kulesi: 66.9 m
    { const p = at('galata'); const g = grp(p); cyl(g, stone, 9, 8.2, 51, 0, 0, 0, 16); cyl(g, stoneDark, 8.6, 8.6, 4, 0, 47, 0, 16);
      const c = new THREE.Mesh(new THREE.ConeGeometry(8.4, 16, 16), lead); c.position.set(0, 51 + 8, 0); g.add(c); reg(p, 10, 67); }
    // Kız Kulesi: adacık ve kule
    { const p = at('kiz'); p.h = 0; const g = grp(p, 20);
      cyl(g, stoneDark, 26, 24, 2.5, 0, -1, 0, 14); box(g, white, 24, 9, 12, -4, 1.5, 0); box(g, white, 10, 6, 8, 9, 1.5, 0);
      const t = cyl(g, white, 4.2, 4.2, 15, 4, 1.5, 0, 8); const c = new THREE.Mesh(new THREE.ConeGeometry(4.6, 7, 8), lead); c.position.set(4, 1.5 + 15 + 3.5, 0); g.add(c);
      reg(p, 14, 24); }
    // Ayasofya: kubbe 55.6 m, 4 minare
    { const p = at('ayasofya'); const g = grp(p, 33);
      box(g, pink, 70, 24, 74, 0, 0, 0); box(g, pink, 34, 34, 34, 0, 0, 0);
      cyl(g, pink, 17, 17, 6, 0, 34, 0, 24);
      domeM(g, lead, 16, 0, 40, 0, 0.75);
      halfDome(g, lead, 16, 0, 33, -17, 0); halfDome(g, lead, 16, 0, 33, 17, Math.PI);
      box(g, pink, 12, 30, 12, -26, 0, -26); box(g, pink, 12, 30, 12, 26, 0, -26); box(g, pink, 12, 30, 12, -26, 0, 26); box(g, pink, 12, 30, 12, 26, 0, 26);
      for (const [x, z] of [[-38, -40], [38, -40], [-38, 40], [38, 40]]) minaret(g, x, z, 60, 0, pink);
      reg(p, 45, 56); }
    // Sultanahmet: 6 minare, kubbe 43 m, avlu kuzeybatıda
    { const p = at('sultanahmet'); const g = grp(p, 147);
      box(g, white, 64, 22, 72, 0, 0, 0);
      cyl(g, white, 15, 15, 6, 0, 22, 0, 24); domeM(g, lead, 16.5, 0, 28, 0, 0.9);
      for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const hd = halfDome(g, lead, 12, Math.sin(r) * 14, 24, Math.cos(r) * 14, r + Math.PI); }
      for (const [x, z] of [[-24, -26], [24, -26], [-24, 26], [24, 26]]) { cyl(g, white, 7, 7, 3, x, 22, z, 12); domeM(g, lead, 7, x, 25, z, 0.8); }
      box(g, white, 64, 12, 64, 0, 0, -70); // avlu
      domeM(g, lead, 6, 0, 12, -70, 0.8);
      for (const [x, z] of [[-34, -38], [34, -38], [-34, 38], [34, 38], [-34, -104], [34, -104]]) minaret(g, x, z, 64);
      reg(p, 50, 43); this._markDisc(p.x, p.y, 2, p.h + 64); }
    // Süleymaniye: kubbe 53 m, 4 minare avlu köşelerinde
    { const p = at('suleymaniye'); const g = grp(p, 150);
      box(g, white, 58, 24, 62, 0, 0, 0); cyl(g, white, 14, 14, 10, 0, 24, 0, 24); domeM(g, lead, 13.5, 0, 34, 0, 1.0);
      halfDome(g, lead, 12, 0, 26, -14, Math.PI); halfDome(g, lead, 12, 0, 26, 14, 0);
      box(g, white, 58, 12, 58, 0, 0, -60);
      for (const [x, z, h] of [[-30, -32, 72], [30, -32, 72], [-30, -88, 56], [30, -88, 56]]) minaret(g, x, z, h);
      reg(p, 45, 53); }
    // Dolmabahçe Sarayı: OpenStreetMap'teki ayrıntılı tabanlarından (beyaz saray rengiyle) çizilir.
    // Rumeli Hisarı: üç büyük kule ve surlar (yamaçta)
    { const p = at('rumeli'); const g = grp(p, 20);
      const towers = [[-60, -70, 13, 28], [70, 0, 12, 33], [-40, 90, 11, 28], [-110, 10, 6, 15], [0, -110, 5, 12]];
      for (const [x, z, r, h] of towers) { const th = this.terrainH(p.x + x, p.y - z) - p.h; cyl(g, stone, r, r * 0.95, h + 6, x, th - 6, z, 14); }
      const walls = [[-60, -70, 70, 0], [70, 0, -40, 90], [-40, 90, -110, 10], [-110, 10, -60, -70]];
      for (const [x0, z0, x1, z1] of walls) {
        const L = Math.hypot(x1 - x0, z1 - z0); const th = this.terrainH(p.x + (x0 + x1) / 2, p.y - (z0 + z1) / 2) - p.h;
        const w = new THREE.Mesh(new THREE.BoxGeometry(4, 16, L), stone); w.position.set((x0 + x1) / 2, th + 2, (z0 + z1) / 2); w.rotation.y = Math.atan2(x1 - x0, z1 - z0); g.add(w);
      }
      reg(p, 30, 35); }
    // Çamlıca Kulesi: 369 m TV kulesi
    { const p = at('camlicakule'); const g = grp(p);
      cyl(g, white, 14, 7, 220, 0, 0, 0, 12); cyl(g, glass, 12, 16, 40, 0, 200, 0, 12); cyl(g, white, 16, 10, 12, 0, 240, 0, 12);
      cyl(g, white, 5, 2, 80, 0, 252, 0, 8); cyl(g, glass, 1.2, 0.4, 37, 0, 332, 0, 6);
      reg(p, 18, 369); }
    // Büyük Çamlıca Camii: 6 minare (4 x 107 m, 2 x 90 m), kubbe 72 m
    { const p = at('camlicacami'); const g = grp(p, 150);
      box(g, white, 70, 30, 74, 0, 0, 0); cyl(g, white, 17, 17, 12, 0, 30, 0, 24); domeM(g, lead, 17, 0, 42, 0, 1.4);
      for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) halfDome(g, lead, 12, Math.sin(r) * 16, 32, Math.cos(r) * 16, r + Math.PI);
      box(g, white, 70, 12, 60, 0, 0, -68);
      for (const [x, z, h] of [[-40, -40, 107], [40, -40, 107], [-40, 40, 107], [40, 40, 107], [-40, -100, 90], [40, -100, 90]]) minaret(g, x, z, h);
      reg(p, 50, 72); }
    bakeStatic(S, this.scene);
  }

  // ---------- köprüler ----------
  _bridges(list) {
    const S = new THREE.Group();
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x8c8f93 });
    const towerMat = new THREE.MeshLambertMaterial({ color: 0xd8dadc });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6b7178 });
    this.bridgeInfo = [];
    for (const b of list) {
      const ax = b.a[0], ay = b.a[1], bx = b.b[0], by = b.b[1];
      const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
      const nx = -uy, ny = ux;
      const midAl = (b.mid[0] - ax) * ux + (b.mid[1] - ay) * uy;
      const ha = this.isLand(ax, ay) ? this.terrainH(ax, ay) : b.deck, hb = this.isLand(bx, by) ? this.terrainH(bx, by) : b.deck;
      const deck = b.deck, W = b.width;
      const susp = b.kind !== 'kiriş';
      // tabliye yüksekliği boyunca: asma köprüde orta açıklık düz, kenarlarda araziye iner
      const deckAt = (al) => {
        if (!susp) return deck;
        const t0 = midAl - b.span / 2 - 60, t1 = midAl + b.span / 2 + 60;
        if (al < t0) return Math.max(ha + 1, deck - (t0 - al) * 0.04);
        if (al > t1) return Math.max(hb + 1, deck - (al - t1) * 0.04);
        return deck;
      };
      // tabliye geometrisi: bölümlere ayrılmış kutular
      const segs = Math.max(4, Math.round(L / 40));
      const pos = [], idx = [];
      const addBox = (x0, y0, x1, y1, h0, h1, th) => {
        // dört köşe üstte ve altta
        const s = pos.length / 3;
        const c = [[x0 + nx * W / 2, y0 + ny * W / 2, h0], [x0 - nx * W / 2, y0 - ny * W / 2, h0], [x1 - nx * W / 2, y1 - ny * W / 2, h1], [x1 + nx * W / 2, y1 + ny * W / 2, h1]];
        for (const [x, y, h] of c) pos.push(x, h, -y);
        for (const [x, y, h] of c) pos.push(x, h - th, -y);
        const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
        for (const t of f) idx.push(s + t[0], s + t[2], s + t[1]);
      };
      for (let k = 0; k < segs; k++) {
        const a0 = L * k / segs, a1 = L * (k + 1) / segs;
        addBox(ax + ux * a0, ay + uy * a0, ax + ux * a1, ay + uy * a1, deckAt(a0), deckAt(a1), susp ? 4 : 2.5);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      S.add(new THREE.Mesh(g, deckMat));
      this.decks.push({ ax, ay, ux, uy, len: L, w: W + 2, h0: deck, h1: deck, deckAt, name: b.name });
      const info = { name: b.name, towers: [] };
      if (!susp) {
        // ayaklar
        for (let k = 1; k < 8; k++) { const al = L * k / 8; const px = ax + ux * al, py = ay + uy * al;
          const m = new THREE.Mesh(new THREE.BoxGeometry(4, deck + 2, W * 0.8), deckMat); m.position.set(px, (deck - 2) / 2 - 1, -py); m.rotation.y = Math.atan2(ux, uy) + Math.PI / 2; S.add(m); }
        this.bridgeInfo.push(info); continue;
      }
      // kuleler
      const tH = b.tower, tAl = [midAl - b.span / 2, midAl + b.span / 2];
      const rot = Math.atan2(ux, uy);
      const tops = [];
      for (const al of tAl) {
        const px = ax + ux * al, py = ay + uy * al;
        const gh = this.isLand(px, py) ? this.terrainH(px, py) : 0;
        const tg = new THREE.Group(); tg.position.set(px, gh, -py); tg.rotation.y = rot; S.add(tg);
        const legH = tH - gh + (b.kind === 'karma' ? 0 : 0);
        for (const s of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5 > 6 ? 5 : 4, legH, 6), towerMat);
          leg.position.set(s * (W / 2 + 2), legH / 2, 0); tg.add(leg);
        }
        for (const hh of [deck - 6 - gh, legH * 0.55 + (deck - gh) * 0.45, legH - 4]) {
          if (hh < 4) continue;
          const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 4, 5), towerMat); beam.position.set(0, hh, 0); tg.add(beam);
        }
        tops.push({ al, h: tH, gh });
        info.towers.push({ x: px, y: py });
        this.colliders.push({ type: 'tower', x: px, y: py, r: W / 2 + 6, top: tH, name: b.name });
      }
      // ana kablolar ve askılar
      const lp = [];
      for (const s of [-1, 1]) {
        const off = s * (W / 2 + 2);
        const P = (al, h) => new THREE.Vector3(ax + ux * al + nx * off, h, -(ay + uy * al + ny * off));
        const pts = [];
        const A0 = 0, A1 = L;
        const sag = (a, b2, ha2, hb2, low) => (al) => { const t = (al - a) / (b2 - a); const lin = ha2 + (hb2 - ha2) * t; return lin - 4 * (lin - low) * t * (1 - t) * 0.0 - (4 * t * (1 - t)) * ((ha2 + hb2) / 2 - low); };
        const midC = sag(tAl[0], tAl[1], tH, tH, deck + 3);
        const steps = 48;
        // yan açıklıklar: kule tepesinden köprü ucuna düz
        pts.push(P(A0, deckAt(A0) + 1), P(tAl[0], tH));
        for (let k = 0; k <= steps; k++) { const al = tAl[0] + (tAl[1] - tAl[0]) * k / steps; pts.push(P(al, midC(al))); }
        pts.push(P(tAl[1], tH), P(A1, deckAt(A1) + 1));
        for (let k = 0; k < pts.length - 1; k++) lp.push(pts[k], pts[k + 1]);
        if (b.kind === 'karma') {
          // Yavuz Sultan Selim: kuleden eğik askı halatları (yelpaze)
          for (const ti of [0, 1]) for (let k = 1; k <= 12; k++) for (const dir of [-1, 1]) {
            const al = tAl[ti] + dir * k * 24; if (al < 0 || al > L) continue;
            lp.push(P(tAl[ti], tH - 10 - k * 4), P(al, deckAt(al)));
          }
        }
        for (let al = tAl[0] + 20; al < tAl[1] - 10; al += 20) lp.push(P(al, midC(al)), P(al, deck));
      }
      const lg = new THREE.BufferGeometry().setFromPoints(lp);
      S.add(new THREE.LineSegments(lg, lineMat));
      this.bridgeInfo.push(info);
    }
    bakeStatic(S, this.scene);
  }

  // Uçağın çarpma denetimi: noktalar dünya koordinatında (x doğu, y kuzey, h yükseklik)
  collide(points) {
    for (const p of points) {
      const bt = this.buildingTop(p.x, p.y);
      if (bt > 0 && p.h < bt - 0.5 && p.h > this.terrainH(p.x, p.y) - 5) return 'Binaya çarptınız';
      for (const d of this.decks) {
        const px = p.x - d.ax, py = p.y - d.ay;
        const al = px * d.ux + py * d.uy, cr = -px * d.uy + py * d.ux;
        if (al >= 0 && al <= d.len && Math.abs(cr) <= d.w / 2) {
          const top = d.deckAt(al);
          if (p.h < top - 0.3 && p.h > top - 5) return d.name + ' tabliyesine çarptınız';
        }
      }
      for (const c of this.colliders) {
        if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < c.r * c.r && p.h < c.top) return c.name + ' kulesine çarptınız';
      }
    }
    return null;
  }

  nearestLandmark(x, y) {
    let best = null, bd = 1e18;
    const all = this.landmarkPos.concat((this.bridgeInfo || []).map((b) => { const t = b.towers; return t.length ? { name: b.name, x: (t[0].x + t[1].x) / 2, y: (t[0].y + t[1].y) / 2 } : null; }).filter(Boolean));
    for (const l of all) { const d = (l.x - x) ** 2 + (l.y - y) ** 2; if (d < bd) { bd = d; best = l; } }
    return best ? { name: best.name, dist: Math.sqrt(bd) } : null;
  }
}

function pip(pts, n, x, y) {
  let c = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Bir gruptaki bütün sabit örgüleri malzemeye göre birleştirir (çizim çağrısı azalır). Çizgiler olduğu gibi kalır.
function bakeStatic(root, scene) {
  root.updateMatrixWorld(true);
  const byMat = new Map();
  const lines = [];
  root.traverse((o) => {
    if (o.isLineSegments) { lines.push(o); return; }
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  for (const [mat, gs] of byMat) { const m = new THREE.Mesh(mergeGeoms(gs), mat); m.matrixAutoUpdate = false; scene.add(m); }
  for (const l of lines) { l.removeFromParent(); scene.add(l); }
}

function minaretGeom() {
  // 30 m yüksekliğinde birim minare (ölçeklenir): gövde, şerefe, külah
  const parts = [];
  const body = new THREE.CylinderGeometry(1.0, 1.2, 25, 8); body.translate(0, 12.5, 0); parts.push(body);
  const ser = new THREE.CylinderGeometry(1.6, 1.6, 0.6, 8); ser.translate(0, 19, 0); parts.push(ser);
  const cone = new THREE.ConeGeometry(1.1, 5, 8); cone.translate(0, 27.5, 0); parts.push(cone);
  return mergeGeoms(parts);
}
export function mergeGeoms(list) {
  let nv = 0, ni = 0;
  const gs = list.map((g) => (g.index ? g : g));
  for (const g of gs) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let v = 0, q = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[q++] = g.index.array[i] + v;
    else for (let i = 0; i < g.attributes.position.count; i++) idx[q++] = v + i;
    v += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
