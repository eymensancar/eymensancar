// İstanbul Uçuşu - dünya: Türkiye arazisi (dörtlü ağaç), su, gökyüzü, şehir binaları, köprüler, simge yapılar, pistler.
// Koordinatlar: x doğu, y kuzey (m, Lambert konik izdüşümü, geo.js). three.js'te X = doğu, Y = yukarı, Z = güney (-kuzey).
// Kayan orijin: bütün dünya nesneleri this.root altında mutlak konumdadır; kök (-Ox, 0, Oy) kaydırılır, böylece
// kameranın çevresindeki sayılar hep küçük kalır (1000+ km uzakta da titreme olmaz).
import * as THREE from '../vendor/three.module.min.js';
import { geo, ungeo, convergence } from './geo.js';
import { pngBytes } from './veri.js';
import { Heights, Terrain, terrainMaterial } from './terrain.js';
import { Buildings, merge as mergeGeoms } from './buildings.js';
import { Airports } from './havalimani.js';
import { setupAtmosphere, updateShadows, makeClouds, SUN, FOG_B } from './atmosfer.js';
export { geo, ungeo, convergence };

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
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
  { id: 'anitkabir', name: 'Anıtkabir', lat: 39.925054, lon: 32.836952 },
  { id: 'atakule', name: 'Atakule', lat: 39.885670, lon: 32.855830 },
  { id: 'kocatepe', name: 'Kocatepe Camii', lat: 39.916820, lon: 32.860380 },
  { id: 'saatkulesi', name: 'İzmir Saat Kulesi', lat: 38.418910, lon: 27.128700 },
  { id: 'goreme', name: 'Göreme peri bacaları', lat: 38.6431, lon: 34.8289 },
  { id: 'pasabagi', name: 'Paşabağı peri bacaları', lat: 38.6720, lon: 34.8520 },
  { id: 'uchisar', name: 'Uçhisar Kalesi', lat: 38.6300, lon: 34.8050 },
];
// Dağlar (HUD'da ad için): zirve konumları
export const PEAKS = [
  { name: 'Ağrı Dağı (5137 m)', lat: 39.7019, lon: 44.2983 }, { name: 'Küçük Ağrı Dağı', lat: 39.6497, lon: 44.4114 },
  { name: 'Erciyes Dağı (3917 m)', lat: 38.5311, lon: 35.4472 }, { name: 'Hasan Dağı (3268 m)', lat: 38.1272, lon: 34.1675 },
  { name: 'Uludağ (2543 m)', lat: 40.0703, lon: 29.2214 }, { name: 'Kaçkar Dağı (3937 m)', lat: 40.8333, lon: 41.1622 },
  { name: 'Palandöken (3176 m)', lat: 39.8231, lon: 41.2933 }, { name: 'Süphan Dağı (4058 m)', lat: 38.9264, lon: 42.8264 },
  { name: 'Nemrut Dağı (2134 m)', lat: 37.9808, lon: 38.7408 }, { name: 'Cilo Dağı (4135 m)', lat: 37.4972, lon: 44.0453 },
  { name: 'Aladağlar (3756 m)', lat: 37.8500, lon: 35.1500 }, { name: 'Bolkar Dağları (3524 m)', lat: 37.4500, lon: 34.6000 },
  { name: 'Kaz Dağı (1774 m)', lat: 39.7000, lon: 26.8500 }, { name: 'Ilgaz Dağı (2587 m)', lat: 41.0700, lon: 33.7400 },
  { name: 'Munzur Dağları (3463 m)', lat: 39.3200, lon: 39.3400 }, { name: 'Tahtalı Dağı (2366 m)', lat: 36.5400, lon: 30.4400 },
  { name: 'Van Gölü', lat: 38.65, lon: 42.85 }, { name: 'Tuz Gölü', lat: 38.75, lon: 33.40 }, { name: 'Beyşehir Gölü', lat: 37.75, lon: 31.50 }, { name: 'Eğirdir Gölü', lat: 38.05, lon: 30.85 },
];

export class World {
  constructor(renderer, scene, opts = {}) {
    this.renderer = renderer; this.scene = scene; this.opts = opts;
    this.root = new THREE.Group(); scene.add(this.root);
    this.O = { x: 0, y: 0 };
    this.decks = []; this.colliders = []; this.lmCol = [];
    this.acAlt = 0;
    this.base = 'data/tr/';
    import('./simgeler-tr.js').then((m) => m.kur(this)); // İstanbul dışı simge yapılar (Ankara, İzmir, Bursa, Konya, Efes, Pamukkale, Nemrut, Sümela, Antalya, köprüler)
    import('./simgeler-ist.js').then((m) => m.kur(this));
  }
  setOrigin(x, y) { this.O.x = x; this.O.y = y; this.root.position.set(-x, 0, y); this.root.updateMatrixWorld(true); }

  async load(progress = () => {}) {
    progress(0.05, 'Dizin');
    const idx = this.idx = await json(this.base + 'dizin.json');
    progress(0.1, 'Arazi');
    this.heights = new Heights(idx, this.base);
    this.hava = new Airports(this);
    const [, ortu, ist, mask, br, mini, trmap, , bina] = await Promise.all([
      this.heights.init(), img(this.base + idx.ortu.dosya), img('data/zemin.webp'), img('data/maske.png'), json('data/kopruler.json'), img('data/harita.png'), img(this.base + idx.harita.dosya), this.hava.load(),
      json(this.base + 'bina.json').catch(() => ({ paketler: [] })),
    ]);
    this.binaIdx = bina;
    this.heights.addPatches(this.hava.patches);
    this.minimap = mini; this.trmap = trmap;
    this.istRect = [-14375, -14500, 14375, 14500]; this.X0 = -14375; this.X1 = 14375; this.Y0 = -14500; this.Y1 = 14500;
    this._mask(mask);
    this._ortu(ortu);
    progress(0.45, 'Gökyüzü ve su');
    this._sky();
    this._water();
    this._terrain(ist);
    this._runways();
    progress(0.6, 'Simge yapılar');
    this.buildings = new Buildings(this, this.root, bina.paketler, idx.paketler.filter((p) => p.agac), this.base, { lod: this.opts.lod, treeDist: this.opts.treeDist });
    this.cities = idx.sehirler;
    this._br = br;
    this.landmarkPos = LANDMARKS.map((l) => ({ ...geo(l.lat, l.lon), name: l.name, id: l.id }));
    this.peaks = PEAKS.map((p) => ({ ...geo(p.lat, p.lon), name: p.name }));
  }
  // Başlangıç konumu çevresindeki veriyi hazırla (bölge yüksekliği, binalar, simge yapılar)
  async prepare(x, y, progress = () => {}) {
    this.heights.ensure(x, y, 60000);
    this.hava.ensure(x, y, 20000);
    let t = 0;
    while ((this.heights.loading.size || this.hava.ensure(x, y, 20000)) && t < 400) { await new Promise((r) => setTimeout(r, 50)); t++; }
    this.hava.near = this.hava.list.filter((a) => Math.hypot(a.x - x, a.y - y) < 9000);
    this._landmarksOnce();
    progress(0.9, 'Hazır');
  }
  _landmarksOnce() {
    if (this._lmDone) return;
    // simge yapılar bölge yükseklikleri gelince kurulur (o bölgenin)
    const need = ['istanbul', 'ankara', 'izmir', 'kapadokya'];
    for (const id of need) {
      const p = this.heights.patchList.find((q) => q.id === id);
      if (!p || !p.grid || (this._lmBuilt || (this._lmBuilt = new Set())).has(id)) continue;
      this._lmBuilt.add(id);
      if (id === 'istanbul') { this._landmarksIstanbul(); this._bridges(this._br); }
      if (id === 'ankara') this._landmarksAnkara();
      if (id === 'izmir') this._landmarksIzmir();
      if (id === 'kapadokya') this._kapadokya();
    }
    this._lmDone = this._lmBuilt && this._lmBuilt.size === need.length;
  }

  // ---------- yer ----------
  terrainH(x, y) { return this.heights.h(x, y); }
  _mask(im) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    this.MW = c.width; this.M = new Uint8Array(c.width * c.height);
    for (let i = 0; i < this.M.length; i++) this.M[i] = d[i * 4] > 127 ? 1 : 0;
  }
  _ortu(im) {
    const o = this.idx.ortu;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    this.OW = c.width; this.OH = c.height; this.OA = new Uint8Array(c.width * c.height); this.OF = new Uint8Array(c.width * c.height);
    for (let i = 0; i < this.OA.length; i++) { this.OA[i] = d[i * 4 + 3]; this.OF[i] = d[i * 4]; }
    this.ortuRect = [o.x0, o.y0, o.nx * o.s, o.ny * o.s];
    const t = new THREE.Texture(im); t.needsUpdate = true; t.colorSpace = THREE.NoColorSpace; t.flipY = false;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
    // alfa önceden çarpılmasın (alfa su oranıdır)
    t.premultiplyAlpha = false;
    this.ortuTex = t;
  }
  ortuAt(x, y) {
    const [x0, y0, w, h] = this.ortuRect;
    const i = Math.floor((x - x0) / w * this.OW), j = Math.floor((1 - (y - y0) / h) * this.OH);
    if (i < 0 || j < 0 || i >= this.OW || j >= this.OH) return { water: 0, forest: 0 };
    const k = j * this.OW + i; return { water: this.OA[k], forest: this.OF[k] };
  }
  isLand(x, y) {
    if (x > this.X0 && x < this.X1 && y > this.Y0 && y < this.Y1) {
      const W = this.MW;
      const i = Math.floor((x - this.X0) / (this.X1 - this.X0) * W), j = Math.floor((this.Y1 - y) / (this.Y1 - this.Y0) * W);
      return this.M[j * W + i] === 1;
    }
    const h = this.terrainH(x, y);
    if (h < 0) return false;
    return this.ortuAt(x, y).water < 128 || h < 1;
  }
  // FDM için yer: {h, kind}. x doğu, y kuzey
  ground(x, y) {
    for (const d of this.decks) {
      const px = x - d.ax, py = y - d.ay;
      const al = px * d.ux + py * d.uy, cr = -px * d.uy + py * d.ux;
      if (al >= 0 && al <= d.len && Math.abs(cr) <= d.w / 2) { const hh = d.deckAt(al); if (this.acAlt > hh - 3) return { h: hh, kind: 'runway' }; }
    }
    const ag = this.hava.ground(x, y);
    if (ag) return ag;
    if (!this.isLand(x, y)) { const h = this.terrainH(x, y); return { h: h > 0 ? h : 0, kind: 'water' }; }
    const h = this.terrainH(x, y);
    const bt = this.buildings ? this.buildings.top(x, y) : 0;
    if (bt > h + 1) return { h: bt, kind: 'building' };
    return { h, kind: 'land' };
  }
  buildingTop(x, y) { return this.buildings ? this.buildings.top(x, y) : 0; }

  // ---------- pistler ----------
  // Bütün havalimanları js/havalimani.js içinde. Burada eski arayüz: her havalimanının ana pisti (başlangıç noktaları, haritalar).
  _runways() {
    this.rws = this.hava.mainRunways({ LTBA: '05/23' });
    this.airports = this.rws;
    this.rw = this.rws.find((r) => r.code === 'LTBA') || this.rws[0];
  }

  // ---------- gökyüzü ----------
  _sky() {
    const q = this.opts;
    this.shadows = q.shadows != null ? q.shadows : !!(q.lod && q.lod[0] >= 2000 && !q.lowTex);
    const A = setupAtmosphere(this, { shadows: this.shadows });
    this.sunDir = SUN; this.sky = A.sky; this.skyMat = A.skyMat; this.sunLight = A.sun;
    this.clouds = makeClouds(this.scene);
    this.fogColor = new THREE.Color(0xc4d4df);
  }
  // gökyüzünden ortam haritası (PBR malzemeler için)
  envMap() {
    if (this._env) return this._env;
    const pm = new THREE.PMREMGenerator(this.renderer);
    const sc = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), this.skyMat.clone()); sky.material.depthTest = true; sc.add(sky);
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(9.5, 32), new THREE.MeshBasicMaterial({ color: 0x6b6f5c })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -1.5; sc.add(gnd);
    this._env = pm.fromScene(sc, 0.02).texture; pm.dispose();
    return this._env;
  }

  // ---------- su ----------
  // Deniz: kamerayla gezen tek düzlem, dalgalar dünyaya bağlı. Gölgelendirici (ekran renginde, gökyüzüyle aynı uzay):
  // - dalga normalleri: tekrar etmeyen dalga tayfından üretilmiş eğim dokusu, dört ölçekte (330 / 110 / 33 / 11 m), farklı
  //   yönlerde ve hızlarda kayar; uzakta ince ölçekler söner, pürüzlülük artar (ufukta güneş yolu genişler)
  // - Fresnel (Schlick) gökyüzü yansıması (aynı skyAt), GGX güneş parıltısı, dalga tepelerinde güneşe karşı yeşil-mavi geçirgenlik
  // - kıyı: kameranın çevresinde karaya uzaklık alanı (kare kare hesaplanır), sığda turkuaz / yeşil, kıyı çizgisinde köpük
  // - akıntı: Boğaz'da (Karadeniz'den Marmara'ya) ve Çanakkale'de normaller akış yönünde sürüklenir (iki evreli akış haritası)
  // - bölge rengi: Karadeniz / Marmara daha yeşil-koyu, Ege ve Akdeniz berrak mavi
  _water() {
    const Qw = this.opts.lowTex ? 0 : this.opts.lod && this.opts.lod[0] >= 2000 ? 2 : 1;
    // eğim dokusu: 256 x 256, tam sayılı dalga sayılarıyla dikişsiz; R G eğim, B yükseklik
    const N = 256, data = new Uint8Array(N * N * 4);
    {
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const W = [];
      for (let k = 0; k < 46; k++) {
        const m = 2 + Math.pow(rnd(), 1.4) * 34, th = 0.5 + (rnd() - 0.5) * (k % 3 ? 1.6 : 3.4);
        const kx = Math.round(Math.cos(th) * m), ky = Math.round(Math.sin(th) * m);
        if (!kx && !ky) continue;
        W.push([kx, ky, Math.pow(Math.hypot(kx, ky), -1.25), rnd() * 6.283]);
      }
      const sx = new Float32Array(N * N), sy = new Float32Array(N * N), hh = new Float32Array(N * N);
      let mx = 0, mh = 0;
      for (const [kx, ky, a, ph] of W) {
        const fx = 2 * Math.PI * kx / N, fy = 2 * Math.PI * ky / N;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const p = fx * i + fy * j + ph, s = Math.sin(p), k = j * N + i;
          sx[k] -= a * kx * s; sy[k] -= a * ky * s; hh[k] += a * Math.cos(p);
        }
      }
      for (let k = 0; k < N * N; k++) { mx = Math.max(mx, Math.abs(sx[k]), Math.abs(sy[k])); mh = Math.max(mh, Math.abs(hh[k])); }
      for (let k = 0; k < N * N; k++) {
        data[k * 4] = 128 + sx[k] / mx * 127; data[k * 4 + 1] = 128 + sy[k] / mx * 127; data[k * 4 + 2] = 128 + hh[k] / mh * 127; data[k * 4 + 3] = 255;
      }
    }
    const nm = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.colorSpace = THREE.NoColorSpace;
    nm.minFilter = THREE.LinearMipmapLinearFilter; nm.magFilter = THREE.LinearFilter; nm.generateMipmaps = true;
    nm.anisotropy = Math.min(Qw ? 8 : 2, this.renderer.capabilities.getMaxAnisotropy()); nm.needsUpdate = true;
    this.WSIZE = 600000; this.WTILE = 110;
    this.waterNormal = nm;
    // kıyı alanı: SN x SN hücre, her biri SC m; R = karaya uzaklık (0-1, 600 m), G = derinlik (0-1, 40 m)
    const SN = [48, 96, 128][Qw], SC = [140, 80, 64][Qw];
    const shoreTex = new THREE.DataTexture(new Uint8Array(SN * SN * 4).fill(255), SN, SN, THREE.RGBAFormat);
    shoreTex.minFilter = shoreTex.magFilter = THREE.LinearFilter; shoreTex.colorSpace = THREE.NoColorSpace; shoreTex.needsUpdate = true;
    // akıntı yolları (enlem, boylam), yüzey akıntısının yönünde: Boğaz (Karadeniz -> Marmara), Çanakkale (Marmara -> Ege)
    const lines = [
      [[41.235, 29.13], [41.175, 29.08], [41.12, 29.07], [41.085, 29.056], [41.045, 29.03], [41.018, 29.003], [40.995, 28.99]],
      [[40.47, 26.75], [40.40, 26.68], [40.30, 26.58], [40.19, 26.39], [40.10, 26.30], [40.02, 26.18]],
    ];
    const segA = [];
    for (const l of lines) for (let i = 0; i + 1 < l.length; i++) { const a = geo(l[i][0], l[i][1]), b = geo(l[i + 1][0], l[i + 1][1]); segA.push([a.x, a.y, b.x, b.y]); }
    const NSEG = segA.length;
    const U = {
      tN: { value: nm }, uTime: { value: 0 }, uO: { value: new THREE.Vector2() },
      uShore: { value: shoreTex }, uShoreR: { value: new THREE.Vector4(0, 0, 1, 0) },
      uSeg: { value: segA.map(() => new THREE.Vector4()) },
      uDeep: { value: new THREE.Color() }, uShal: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      fog: true, toneMapped: false, depthWrite: false,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      defines: { NSEG, WQ: Qw },
      vertexShader: `varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D tN, uShore; uniform float uTime; uniform vec2 uO; uniform vec4 uShoreR; uniform vec4 uSeg[NSEG];
        uniform vec3 uDeep, uShal; varying vec3 vW;
        #include <fog_pars_fragment>
        vec2 slope(vec2 uv) { return texture2D(tN, uv).rg * 2.0 - 1.0; }
        // iki evreli akış haritası: akış yönünde sürüklenen doku, evre değişirken atlamasın diye karışık
        vec2 flowSlope(vec2 uv, vec2 fl, float t) {
          float p0 = fract(t), p1 = fract(t + 0.5);
          float w0 = 1.0 - abs(1.0 - 2.0 * p0);
          return slope(uv - fl * p0) * w0 + slope(uv - fl * p1 + 0.37) * (1.0 - w0);
        }
        void main(){
          vec2 L = vec2(vW.x, -vW.z);          // yerel (kayan orijine göre) doğu, kuzey
          vec2 A = L + uO;                     // tekrar eden dokular için küçük mutlak koordinat
          vec3 toC = cameraPosition - vW; float dist = length(toC); vec3 V = toC / dist;
          float t = uTime;
          // akıntı: en yakın akış çizgisi
          vec2 flowD = vec2(0.0); float fm = 0.0;
          for (int i = 0; i < NSEG; i++) {
            vec2 a = uSeg[i].xy, b = uSeg[i].zw, ab = b - a;
            float h = clamp(dot(L - a, ab) / dot(ab, ab), 0.0, 1.0);
            float d = length(L - a - ab * h);
            float m = 1.0 - smoothstep(250.0, 1100.0, d);
            if (m > fm) { fm = m; flowD = normalize(ab); }
          }
          // dalga eğimleri: dört ölçek
          float fine = 1.0 - smoothstep(250.0, 2200.0, dist), mid = 1.0 - smoothstep(1500.0, 12000.0, dist);
          vec2 s = slope(A / 330.0 + vec2(0.0021, 0.0013) * t) * 0.55;
          vec2 w1 = vec2(0.0063, 0.0031) * t, w2 = vec2(-0.0102, 0.0205) * t;
          if (fm > 0.01) {
            vec2 fl = flowD * fm * 1.8;          // ~1.8 m/sn yüzey akıntısı
            s += flowSlope(A / 110.0 + w1, fl * 5.0 / 110.0, t * 0.2) * 0.75 * mid;
            s += flowSlope(A / 33.0 + w2, fl * 5.0 / 33.0, t * 0.2) * 0.55 * fine;
          } else {
            s += slope(A / 110.0 + w1) * 0.75 * mid;
            s += slope(A / 33.0 + w2) * 0.55 * fine;
          }
          #if WQ > 1
            s += slope(A / 11.0 + vec2(0.031, -0.024) * t) * 0.3 * (1.0 - smoothstep(60.0, 500.0, dist));
          #endif
          // Boğaz'da akıntı çizgileri: akışa dik sıkışan küçük dalgacık şeritleri
          s *= 1.0 + fm * 0.35 * (0.5 + 0.5 * sin(dot(L, vec2(-flowD.y, flowD.x)) * 0.045 + texture2D(tN, A / 900.0).b * 6.0));
          float amp = 0.20 * (1.0 - 0.45 * smoothstep(3000.0, 30000.0, dist));
          vec3 n = normalize(vec3(-s.x * amp, 1.0, s.y * amp));
          // kıyı alanı
          vec2 su = (L - uShoreR.xy) / uShoreR.z;
          vec4 sh = texture2D(uShore, su);
          float inR = step(0.0, su.x) * step(su.x, 1.0) * step(0.0, su.y) * step(su.y, 1.0) * uShoreR.w;
          float edge = smoothstep(0.0, 0.12, min(min(su.x, su.y), min(1.0 - su.x, 1.0 - su.y)));
          float shore = mix(1.0, sh.r, inR * edge);                      // 0 = kıyı, 1 = açık deniz
          float depth = mix(1.0, sh.g, inR * edge);
          float shal = (1.0 - smoothstep(0.0, 0.55, shore)) * (1.0 - smoothstep(0.1, 0.9, depth) * 0.6);
          // kıyıda dalga küçülür
          n = normalize(mix(vec3(0.0, 1.0, 0.0), n, 0.55 + 0.45 * smoothstep(0.0, 0.25, shore)));
          // yansıma
          vec3 R = reflect(-V, n); R.y = abs(R.y) + 0.002;
          float cosv = clamp(dot(V, n), 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
          vec3 sky = pow(skyAt(normalize(R)), vec3(2.2));
          // su gövdesi (doğrusal renk): derin ve sığ renk, güneşin yüksekliğiyle aydınlanır
          vec3 sunD = SKY_SUN, sunC = SKY_SUNCOL;
          float lit = 0.35 + 0.65 * clamp(sunD.y * 1.6, 0.0, 1.0);
          vec3 body = mix(uDeep, uShal, shal) * lit;
          // dalga tepelerinde ışık geçirgenliği (güneşe karşı, yatay bakışta)
          float crest = texture2D(tN, A / 110.0 + w1).b;
          float sss = pow(clamp(dot(-V, normalize(vec3(sunD.x, 0.0, sunD.z))) * 0.5 + 0.5, 0.0, 1.0), 3.0) * smoothstep(0.45, 0.8, crest) * fine;
          body += vec3(0.02, 0.10, 0.09) * sss * lit * 0.6;
          vec3 col = mix(body, sky * 0.92, F);
          // güneş parıltısı: GGX, uzakta pürüzlülük artar
          vec3 H = normalize(V + sunD);
          float rgh = mix(0.06, 0.22, smoothstep(200.0, 20000.0, dist));
          float a2 = rgh * rgh, ndh = max(dot(n, H), 0.0), dd = ndh * ndh * (a2 - 1.0) + 1.0;
          float D = a2 / (3.14159 * dd * dd);
          float Fs = 0.02 + 0.98 * pow(1.0 - max(dot(V, H), 0.0), 5.0);
          col += sunC * D * Fs * 0.12 * step(0.0, dot(n, sunD));
          // kıyı köpüğü
          float foam = (1.0 - smoothstep(0.0, 0.06, shore)) * inR * smoothstep(0.35, 0.75, texture2D(tN, A / 23.0 + vec2(0.0, 0.03) * t).b + 0.2 * sin(t * 0.9 + A.x * 0.05));
          col = mix(col, vec3(0.75, 0.78, 0.80) * lit, foam * 0.55 * mid);
          // ekran rengi: parlak parıltı yumuşakça doysun
          col = col / (1.0 + max(col - 0.9, 0.0));
          gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
          #include <fog_fragment>
        }`,
    });
    Object.assign(mat.uniforms, U);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(this.WSIZE, this.WSIZE), mat);
    w.rotation.x = -Math.PI / 2; w.renderOrder = -5; w.frustumCulled = false;
    this.water = w; this.scene.add(w);
    // her kare: zaman, orijin, akış çizgileri, bölge rengi, kıyı alanı (birkaç satır)
    const T0 = performance.now();
    const deepC = { kara: [0.010, 0.040, 0.050], ege: [0.004, 0.030, 0.080] }, shalC = { kara: [0.05, 0.17, 0.15], ege: [0.05, 0.25, 0.27] };
    const fld = { cx: 1e12, cy: 1e12, row: SN, buf: new Uint8Array(SN * SN * 4), land: new Uint8Array(SN * SN), dep: new Float32Array(SN * SN), nx: 0, ny: 0 };
    let fr = 0;
    w.onBeforeRender = (r, s, cam) => {
      const O = this.O;
      U.uTime.value = (performance.now() - T0) / 1000;
      U.uO.value.set(((O.x % 3300) + 3300) % 3300, ((O.y % 3300) + 3300) % 3300);
      for (let i = 0; i < NSEG; i++) { const g = segA[i]; U.uSeg.value[i].set(g[0] - O.x, g[1] - O.y, g[2] - O.x, g[3] - O.y); }
      const ax = cam.position.x + O.x, ay = -cam.position.z + O.y;
      if (fr++ % 60 === 0) {
        // bölge: Ege / Akdeniz (berrak mavi) ile Marmara / Karadeniz (yeşilimsi) arasında
        const g = ungeo(ax, ay);
        const ege = clamp(Math.max((40.35 - g.lat) / 0.5, (37.4 - g.lat) / 0.4, (g.lon < 26.9 ? 1 : 0) * (41 - g.lat)), 0, 1);
        U.uDeep.value.setRGB(...deepC.kara.map((v, i) => v + (deepC.ege[i] - v) * ege), THREE.LinearSRGBColorSpace);
        U.uShal.value.setRGB(...shalC.kara.map((v, i) => v + (shalC.ege[i] - v) * ege), THREE.LinearSRGBColorSpace);
      }
      // kıyı alanı: kamera merkezden alanın dörtte biri uzaklaşınca yeniden; kare başına birkaç satır
      const half = SN * SC / 2;
      const stale = fld.dirty && fr % 90 === 0 && !this.pendingNear();
      if (fld.row >= SN && (stale || Math.abs(ax - fld.cx) > half * 0.45 || Math.abs(ay - fld.cy) > half * 0.45) && this.heights) {
        fld.nx = Math.round(ax / SC) * SC; fld.ny = Math.round(ay / SC) * SC; fld.row = 0;
      }
      if (fld.row < SN) {
        const x0 = fld.nx - half, y0 = fld.ny - half;
        for (let e = 0; e < 8 && fld.row < SN; e++, fld.row++) {
          const j = fld.row;
          for (let i = 0; i < SN; i++) {
            const x = x0 + (i + 0.5) * SC, y = y0 + (j + 0.5) * SC, k = j * SN + i;
            fld.land[k] = this.isLand(x, y) ? 1 : 0; fld.dep[k] = Math.max(0, -this.terrainH(x, y));
          }
        }
        if (fld.row >= SN) {
          // karaya uzaklık: iki geçişli yaklaşık öklid (chamfer 3-4) dönüşümü
          const D = new Float32Array(SN * SN);
          for (let k = 0; k < SN * SN; k++) D[k] = fld.land[k] ? 0 : 1e9;
          const c1 = SC, c2 = SC * 1.4142;
          for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
            const k = j * SN + i; let v = D[k];
            if (i > 0) v = Math.min(v, D[k - 1] + c1);
            if (j > 0) { v = Math.min(v, D[k - SN] + c1); if (i > 0) v = Math.min(v, D[k - SN - 1] + c2); if (i < SN - 1) v = Math.min(v, D[k - SN + 1] + c2); }
            D[k] = v;
          }
          for (let j = SN - 1; j >= 0; j--) for (let i = SN - 1; i >= 0; i--) {
            const k = j * SN + i; let v = D[k];
            if (i < SN - 1) v = Math.min(v, D[k + 1] + c1);
            if (j < SN - 1) { v = Math.min(v, D[k + SN] + c1); if (i < SN - 1) v = Math.min(v, D[k + SN + 1] + c2); if (i > 0) v = Math.min(v, D[k + SN - 1] + c2); }
            D[k] = v;
          }
          const b = shoreTex.image.data;
          for (let k = 0; k < SN * SN; k++) {
            // hücrenin ortası karaysa bile kıyı çizgisi hücrenin içinden geçer: yarım hücre kaydır
            const dm = fld.land[k] ? 0 : Math.max(0, D[k] - SC * 0.5);
            b[k * 4] = Math.min(255, dm / 600 * 255); b[k * 4 + 1] = Math.min(255, fld.dep[k] / 40 * 255); b[k * 4 + 2] = 0; b[k * 4 + 3] = 255;
          }
          shoreTex.needsUpdate = true;
          fld.cx = fld.nx; fld.cy = fld.ny; fld.dirty = this.pendingNear() > 0; // veri gelmemişse sonra yeniden
          fld.rx = fld.nx - half; fld.ry = fld.ny - half;
        }
      }
      if (fld.rx != null) U.uShoreR.value.set(fld.rx - O.x, fld.ry - O.y, SN * SC, 1);
    };
  }

  // ---------- arazi ----------
  _terrain(ist) {
    const tex = new THREE.Texture(ist); tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.flipY = true;
    if (this.opts.lowTex) { const c = document.createElement('canvas'); c.width = c.height = 2048; c.getContext('2d').drawImage(ist, 0, 0, 2048, 2048); tex.image = c; }
    // yakın ayrıntı gürültüsü
    const dc = document.createElement('canvas'); dc.width = dc.height = 256;
    const dg = dc.getContext('2d');
    const sm = document.createElement('canvas'); sm.width = sm.height = 32;
    const sg = sm.getContext('2d'); const sd = sg.createImageData(32, 32);
    for (let i = 0; i < 32 * 32; i++) { const v = 90 + Math.random() * 120; sd.data[i * 4] = sd.data[i * 4 + 1] = sd.data[i * 4 + 2] = v; sd.data[i * 4 + 3] = 255; }
    sg.putImageData(sd, 0, 0); dg.imageSmoothingEnabled = true;
    for (const [ox, oy] of [[0, 0], [-256, 0], [0, -256], [-256, -256]]) dg.drawImage(sm, ox, oy, 512, 512);
    const fd = dg.getImageData(0, 0, 256, 256);
    for (let i = 0; i < 256 * 256; i++) { const n = (Math.random() - 0.5) * 50; fd.data[i * 4] += n; fd.data[i * 4 + 1] += n; fd.data[i * 4 + 2] += n; }
    dg.putImageData(fd, 0, 0);
    const det = new THREE.CanvasTexture(dc); det.wrapS = det.wrapT = THREE.RepeatWrapping; det.colorSpace = THREE.NoColorSpace;
    this.tmat = terrainMaterial({ ortuTex: this.ortuTex, ortuRect: this.ortuRect, istTex: tex, istRect: this.istRect, detailTex: det });
    this.terrain = new Terrain(this.heights, this.root, this.tmat, { K: this.opts.terrainK || 2.0, budget: this.opts.terrainBudget || 4, shadows: this.shadows });
  }

  // Her kare: veri akışı, arazi ve bina ayrıntısı, kayan orijin. camLocal: kamera (sahne koordinatı)
  update(camLocal, ac) {
    const cx = camLocal.x + this.O.x, cy = -camLocal.z + this.O.y, ch = camLocal.y;
    // kayan orijin: kamera 4 km uzaklaşınca kök kaydırılır (çağıran tarafından sahne konumları yeniden hesaplanır)
    this.heights.ensure(cx, cy, 140000);
    const gh = this.terrainH(cx, cy);
    this.terrain.update({ x: cx, y: cy, h: ch, gh });
    this.buildings.update({ x: cx, y: cy, h: ch - Math.max(0, gh) }, ac);
    this.hava.update({ x: cx, y: cy, h: ch });
    this._landmarksOnce();
    // su düzlemi kamerayla gezer, dalgalar dünyaya bağlı kalır
    this.water.position.set(camLocal.x, 0, camLocal.z);
    const k = 1 / this.WTILE;
    this.waterNormal.offset.set(((cx * k) % 1 + 1) % 1, ((cy * k) % 1 + 1) % 1);
    const U = this.tmat.userData.U;
    U.uOrigin.value.set(this.O.x, this.O.y);
    U.uOriginMod.value.set(this.O.x % 3611, this.O.y % 3611);
    // sis: yüksekliğe göre azalan üstel sis (atmosfer.js); arazi, sisin %99 örttüğü uzaklıkta kesilir
    const fd = this.scene.fog.density = this.opts.lowTex ? 0.00009 : this.shadows ? 0.00005 : 0.00006;
    this.clouds.update(cx, cy);
    this.terrain.maxDist = Math.min(400000, 4.6 / (fd * Math.exp(-FOG_B * Math.max(0, ch))));
    if (this.shadows) { this._acLocal = ac ? (this._acL || (this._acL = new THREE.Vector3())).set(ac.x - this.O.x, this.acAlt || 0, -(ac.y - this.O.y)) : null; updateShadows(this, camLocal); }
  }
  pendingNear() { return (this.terrain.pending || 0) + (this.heights.loading.size || 0) + (this.hava.pending || 0); }

  // Uçağın çarpma denetimi: noktalar mutlak (x doğu, y kuzey, h yükseklik)
  collide(points) {
    for (const p of points) {
      const bt = this.buildingTop(p.x, p.y);
      if (bt > 0 && p.h < bt - 0.5 && p.h > this.terrainH(p.x, p.y) - 5) return 'Binaya çarptınız';
      for (const c of this.lmCol) if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < c.r * c.r && p.h < c.top) return 'Yapıya çarptınız';
      const ac = this.hava.collide(p.x, p.y, p.h); if (ac) return ac;
      for (const d of this.decks) {
        const px = p.x - d.ax, py = p.y - d.ay;
        const al = px * d.ux + py * d.uy, cr = -px * d.uy + py * d.ux;
        if (al >= 0 && al <= d.len && Math.abs(cr) <= d.w / 2) { const top = d.deckAt(al); if (p.h < top - 0.3 && p.h > top - 5) return d.name + ' tabliyesine çarptınız'; }
      }
      for (const c of this.colliders) if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < c.r * c.r && p.h < c.top && (c.bottom == null || p.h > c.bottom)) return c.balloon ? 'Sıcak hava balonuna çarptınız' : c.name + ' kulesine çarptınız';
    }
    return null;
  }

  // En yakın tanınan yer: simge yapılar (2.5 km), köprüler, havalimanları (6 km), dağlar (15 km), şehirler (25 km)
  nearestLandmark(x, y) {
    // öncelik: simge yapı/köprü (2.5 km), havalimanı (6 km), dağ/göl (15 km), şehir (nüfusa göre 18-30 km)
    const groups = [
      (this.landmarkPos || []).map((l) => [l, 2500, l.name]).concat((this.bridgeInfo || []).filter((b) => b.towers.length).map((b) => [{ x: (b.towers[0].x + b.towers[1].x) / 2, y: (b.towers[0].y + b.towers[1].y) / 2 }, 2500, b.name])),
      this.airports.map((a) => [{ x: a.ax + a.ux * a.len / 2, y: a.ay + a.uy * a.len / 2 }, 6000, a.name]),
      this.peaks.map((p) => [p, 15000, p.name]),
      this.cities.map((c) => [c, c.nufus > 1e6 ? 30000 : 18000, c.ad]),
    ];
    for (const g of groups) {
      let best = null, bd = 1e18;
      for (const [l, lim, name] of g) { const d = Math.hypot(l.x - x, l.y - y); if (d < lim && d < bd) { bd = d; best = { name, dist: d }; } }
      if (best) return best;
    }
    return null;
  }


  // ---------- simge yapılar ----------
  _landmarksIstanbul() {
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
    const reg = (p, r, top) => this.lmCol.push({ x: p.x, y: p.y, r, top: p.h + top });

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
      reg(p, 50, 43); this.lmCol.push({ x: p.x, y: p.y, r: 2, top: p.h + 64 }); }
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
    bakeStatic(S, this.root);
  }

  // ---------- köprüler ----------

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
    bakeStatic(S, this.root);
  }

  // ---------- Ankara: Anıtkabir, Atakule, Kocatepe Camii ----------
  _lmKit() {
    const M = this._lmMats || (this._lmMats = {
      trav: new THREE.MeshLambertMaterial({ color: 0xd9ccb0 }), travD: new THREE.MeshLambertMaterial({ color: 0xbfae8e }),
      white: new THREE.MeshLambertMaterial({ color: 0xf1eee6 }), lead: new THREE.MeshLambertMaterial({ color: 0x7d8a96 }),
      glass: new THREE.MeshLambertMaterial({ color: 0x86a2b8 }), conc: new THREE.MeshLambertMaterial({ color: 0xcfd0cc }),
      green: new THREE.MeshLambertMaterial({ color: 0x5d7a45 }), road: new THREE.MeshLambertMaterial({ color: 0xbdb4a2 }),
      tuff: new THREE.MeshLambertMaterial({ color: 0xd8c3a0 }), tuffD: new THREE.MeshLambertMaterial({ color: 0xa88f6e }), red: new THREE.MeshLambertMaterial({ color: 0xb04a2e }),
    });
    const box = (g, m, w, h, d, x, y, z, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.rotation.y = ry; g.add(o); return o; };
    const cyl = (g, m, r0, r1, h, x, y, z, seg = 12) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
    const dome = (g, m, r, x, y, z, sy = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); o.position.set(x, y, z); o.scale.y = sy; g.add(o); return o; };
    const half = (g, m, r, x, y, z, rot) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI, 0, Math.PI / 2), m); o.position.set(x, y, z); o.rotation.y = rot; g.add(o); return o; };
    const minaret = (g, x, z, h, base = 0, m = M.white) => {
      cyl(g, m, 2.2, 2.0, h * 0.82, x, base, z, 10); cyl(g, m, 2.8, 2.8, 0.8, x, base + h * 0.5, z, 10); cyl(g, m, 2.7, 2.7, 0.8, x, base + h * 0.64, z, 10); cyl(g, m, 2.6, 2.6, 0.7, x, base + h * 0.76, z, 10);
      const c = new THREE.Mesh(new THREE.ConeGeometry(2.1, h * 0.18, 10), M.lead); c.position.set(x, base + h * 0.82 + h * 0.09, z); g.add(c);
    };
    const at = (id) => { const L = LANDMARKS.find((l) => l.id === id); const p = geo(L.lat, L.lon); return { x: p.x, y: p.y, h: this.terrainH(p.x, p.y) }; };
    return { M, box, cyl, dome, half, minaret, at };
  }
  _landmarksAnkara() {
    const { M, box, cyl, dome, half, minaret, at } = this._lmKit();
    const S = new THREE.Group();
    // Anıtkabir: Rasattepe üstünde; tören meydanı (129 x 84 m), Aslanlı Yol (262 m), Şeref Holü (sütunlu, 72 x 52 m)
    { const p = at('anitkabir'); const O = new THREE.Group(); O.position.set(p.x, p.h, -p.y); O.rotation.y = -(-8) * Math.PI / 180; S.add(O);
      box(O, M.road, 170, 2.5, 120, 0, -1.5, 0);                     // tören meydanı ve teras
      box(O, M.travD, 84, 1.2, 129, 0, 1, 0);
      box(O, M.road, 22, 1.5, 262, -150, -1, 40, Math.PI / 2);        // aslanlı yol (batıya)
      for (let k = 0; k < 12; k++) for (const s of [-1, 1]) box(O, M.travD, 1.6, 2.2, 3.2, -40 - k * 21, 0.5, 40 + s * 11);
      box(O, M.trav, 60, 3, 72, 0, 2, -42);                           // kaide ve merdiven
      for (let k = 0; k < 6; k++) box(O, M.trav, 60, 1, 4, 0, 2 + k, -2 - k * 1.2);
      box(O, M.trav, 54, 6, 64, 0, 5, -46);
      // sütunlar: uzun kenarlarda 14, kısa kenarlarda 8
      for (let k = 0; k < 14; k++) for (const s of [-1, 1]) cyl(O, M.white, 1.1, 1.0, 14, s * 24, 11, -74 + k * 4.4, 12);
      for (let k = 0; k < 8; k++) for (const s of [-1, 1]) cyl(O, M.white, 1.1, 1.0, 14, -18 + k * 5.15, 11, -46 + s * 30, 12);
      box(O, M.trav, 40, 14, 54, 0, 11, -46);                         // iç hol
      box(O, M.trav, 54, 5, 66, 0, 25, -46);                          // saçak ve üst kat
      box(O, M.travD, 50, 1.4, 62, 0, 30, -46);
      // iki yanda kuleler (İstiklal, Hürriyet ...): küçük kare yapılar
      for (const [x, z] of [[-78, -55], [78, -55], [-78, 55], [78, 55], [-78, 0], [78, 0]]) { box(O, M.trav, 12, 12, 12, x, 1, z); box(O, M.travD, 13, 2, 13, x, 13, z); }
      this.lmCol.push({ x: p.x, y: p.y, r: 45, top: p.h + 32 });
    }
    // Atakule: 125 m, gövde ve küre biçimli dönen lokanta
    { const p = at('atakule'); const g = new THREE.Group(); g.position.set(p.x, p.h, -p.y); S.add(g);
      box(g, M.conc, 60, 10, 60, 0, 0, 0);                            // alışveriş merkezi
      cyl(g, M.conc, 6.5, 5.5, 100, 0, 10, 0, 16);
      cyl(g, M.glass, 6.2, 6.2, 70, 0, 25, 0, 6);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 14), M.glass); sp.scale.y = 0.75; sp.position.set(0, 112, 0); g.add(sp);
      cyl(g, M.conc, 14, 14, 3, 0, 108, 0, 24);
      cyl(g, M.conc, 1.2, 0.3, 14, 0, 121, 0, 8);
      this.lmCol.push({ x: p.x, y: p.y, r: 14, top: p.h + 125 });
    }
    // Kocatepe Camii: kubbe 25.5 m çap, 4 minare 88 m
    { const p = at('kocatepe'); const g = new THREE.Group(); g.position.set(p.x, p.h, -p.y); g.rotation.y = -(-30) * Math.PI / 180; S.add(g);
      box(g, M.white, 64, 24, 64, 0, 0, 0);
      cyl(g, M.white, 15, 15, 6, 0, 24, 0, 24); dome(g, M.lead, 15.5, 0, 30, 0, 0.95);
      for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) half(g, M.lead, 11, Math.sin(r) * 13, 25, Math.cos(r) * 13, r + Math.PI);
      for (const [x, z] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) { cyl(g, M.white, 6, 6, 3, x, 24, z, 12); dome(g, M.lead, 6, x, 27, z, 0.8); }
      box(g, M.conc, 70, 6, 60, 0, -6, -64);                          // avlu ve altındaki çarşı
      for (const [x, z] of [[-36, -36], [36, -36], [-36, 36], [36, 36]]) minaret(g, x, z, 88);
      this.lmCol.push({ x: p.x, y: p.y, r: 50, top: p.h + 48 });
    }
    this._bake(S);
  }
  _landmarksIzmir() {
    const { M, box, cyl, dome, at } = this._lmKit();
    const S = new THREE.Group();
    // Saat Kulesi (1901): 25 m, sekizgen, dört katlı, Konak Meydanı
    const p = at('saatkulesi'); const g = new THREE.Group(); g.position.set(p.x, Math.max(0.5, p.h), -p.y); S.add(g);
    cyl(g, M.trav, 9, 9, 1, 0, 0, 0, 8);
    cyl(g, M.trav, 4.2, 4.0, 7, 0, 1, 0, 8); cyl(g, M.travD, 4.6, 4.6, 0.8, 0, 8, 0, 8);
    cyl(g, M.trav, 3.6, 3.4, 6, 0, 8.8, 0, 8); cyl(g, M.travD, 4.0, 4.0, 0.7, 0, 14.8, 0, 8);
    cyl(g, M.trav, 3.0, 2.8, 5, 0, 15.5, 0, 8); cyl(g, M.white, 2.4, 2.2, 3, 0, 20.5, 0, 8);
    dome(g, M.lead, 2.3, 0, 23.5, 0, 0.9); cyl(g, M.lead, 0.2, 0.05, 2, 0, 25.5, 0, 6);
    for (const r of [0, 1, 2, 3]) { const f = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), M.white); f.position.set(Math.sin(r * Math.PI / 2) * 3.05, 18, Math.cos(r * Math.PI / 2) * 3.05); f.rotation.y = r * Math.PI / 2; g.add(f); }
    this.lmCol.push({ x: p.x, y: p.y, r: 6, top: p.h + 26 });
    this._bake(S);
  }
  // Kapadokya: peri bacaları (Göreme, Paşabağı, Uçhisar çevresi), Uçhisar Kalesi ve sıcak hava balonları
  _kapadokya() {
    const { M } = this._lmKit();
    const S = new THREE.Group();
    const cone = new THREE.ConeGeometry(1, 1, 9, 1, true); cone.translate(0, 0.5, 0);
    const cap = new THREE.ConeGeometry(1, 1, 9); cap.translate(0, 0.5, 0);
    const spots = [['goreme', 260, 900], ['pasabagi', 170, 600], ['uchisar', 140, 900], [null, 160, 1300, 38.660, 34.860], [null, 120, 900, 38.615, 34.850], [null, 120, 1000, 38.700, 34.900]];
    const pts = [];
    let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [id, n, rad, la, lo] of spots) {
      const c = id ? geo(LANDMARKS.find((l) => l.id === id).lat, LANDMARKS.find((l) => l.id === id).lon) : geo(la, lo);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * rad;
        const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
        if (this.buildingTop(x, y) > 0) continue;
        pts.push([x, y, this.terrainH(x, y), 8 + rnd() * 22, 2.2 + rnd() * 3, rnd() < 0.55]);
      }
    }
    const o0 = pts.length ? pts[0] : [0, 0, 0];
    const cm = new THREE.InstancedMesh(cone, M.tuff, pts.length), km = new THREE.InstancedMesh(cap, M.tuffD, pts.length);
    const o = new THREE.Object3D(); let nc = 0;
    for (const [x, y, h, H, R, hasCap] of pts) {
      o.position.set(x - o0[0], h - 1, -(y - o0[1])); o.scale.set(R, H, R); o.rotation.set(0, 0, 0); o.updateMatrix(); cm.setMatrixAt(nc, o.matrix);
      if (hasCap) { o.position.y = h - 1 + H * 0.92; o.scale.set(R * 0.85, R * 1.3, R * 0.85); o.updateMatrix(); } else { o.scale.set(0.001, 0.001, 0.001); o.updateMatrix(); }
      km.setMatrixAt(nc, o.matrix); nc++;
    }
    for (const m of [cm, km]) { m.position.set(o0[0], 0, -o0[1]); m.updateMatrix(); m.matrixAutoUpdate = false; m.computeBoundingSphere(); this.root.add(m); }
    // Uçhisar Kalesi: büyük kaya kütlesi
    { const p = geo(38.6300, 34.8050), h = this.terrainH(p.x, p.y); const g = new THREE.Group(); g.position.set(p.x, h, -p.y); S.add(g);
      const r1 = new THREE.Mesh(new THREE.ConeGeometry(70, 60, 10), M.tuff); r1.position.y = 25; g.add(r1);
      const r2 = new THREE.Mesh(new THREE.CylinderGeometry(22, 34, 35, 10), M.tuff); r2.position.y = 55; g.add(r2);
      this.lmCol.push({ x: p.x, y: p.y, r: 40, top: h + 72 }); }
    this._bake(S);
    // balonlar: Göreme üzerinde süzülür (çarpışma: balon gövdesi)
    const env = this.envMap();
    const bg = new THREE.SphereGeometry(1, 16, 12); bg.scale(1, 1.15, 1);
    const cols = [0xd7263d, 0xf46036, 0xffc914, 0x2e86ab, 0x1b998b, 0x8e44ad, 0xe84a5f, 0xf4d35e];
    this.balloons = [];
    const c = geo(38.6431, 34.8289); seed = 7;
    for (let k = 0; k < 24; k++) {
      const x = c.x + (rnd() - 0.5) * 5000, y = c.y + (rnd() - 0.5) * 4000, h = this.terrainH(x, y) + 120 + rnd() * 500;
      const g = new THREE.Group();
      const env1 = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: cols[k % cols.length], roughness: 0.7, metalness: 0, envMap: env })); env1.scale.setScalar(9); env1.position.y = 14; g.add(env1);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(9.1, 6.5, 4, 16, 1, true), new THREE.MeshStandardMaterial({ color: cols[(k + 3) % cols.length], roughness: 0.7, envMap: env, side: THREE.DoubleSide })); band.position.y = 10; g.add(band);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), new THREE.MeshLambertMaterial({ color: 0x6b4a2a })); bk.position.y = 0.6; g.add(bk);
      g.position.set(x, h, -y); this.root.add(g);
      this.balloons.push({ g, x, y, h, ph: rnd() * 6 });
      this.colliders.push({ type: 'balon', x, y, r: 9, top: h + 24, bottom: h, name: 'Sıcak hava balonu', balloon: true });
    }
  }
  // bir grubu malzemeye göre birleştirip yerel orijinle köke ekler (uzakta da hassas)
  _bake(S) {
    S.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(S); const c = box.getCenter(new THREE.Vector3());
    const byMat = new Map();
    S.traverse((o) => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld); g.translate(-c.x, 0, -c.z); if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); } for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(g); });
    for (const [mat, gs] of byMat) { const m = new THREE.Mesh(mergeGeoms(gs), mat); m.position.set(c.x, 0, c.z); m.updateMatrix(); m.matrixAutoUpdate = false; this.root.add(m); }
  }
}

function bakeStatic(root, target) {
  root.updateMatrixWorld(true);
  const byMat = new Map(); const lines = [];
  root.traverse((o) => {
    if (o.isLineSegments) { lines.push(o); return; }
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  for (const [mat, gs] of byMat) { const m = new THREE.Mesh(mergeGeoms(gs), mat); m.matrixAutoUpdate = false; target.add(m); }
  for (const l of lines) { l.removeFromParent(); target.add(l); }
}
