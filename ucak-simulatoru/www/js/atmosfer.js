// Atmosfer: fiziksel gökyüzü (Rayleigh: zenit koyu mavi, ufukta optik derinlik artınca açılan pus; Mie: güneş çevresinde
// sıcak hale; güneş alçalınca Kasten-Young hava kütlesiyle kızaran güneş ışığı ve ufuk kuşağı), yüksekliğe göre azalan
// üstel sis (hava perspektifi: uzaklar o yöndeki ufuk rengine, güneş yönünde sıcak tona kayar), ACES ton eşleme, güneş
// gölgeleri (yüksek kalite), hacimli görünen bulutlar (aşağıda).
// Sis three.js'in fog parçaları değiştirilerek bütün malzemelere uygulanır (FogExp2 nesnesi yalnızca anahtar olarak kalır:
// fogDensity = deniz seviyesindeki yoğunluk, 1/m; fogColor = sis rengine çarpan, bulut içinde beyaza çekilir).
// Gökyüzü ve sis aynı skyAt() işlevini kullanır; ikisi de ekran renginde.
// Günün saati: adreste ?saat=16.5 (yerel saat, 22 Kasım, İstanbul enlemi). Yoksa öğleden sonra (güneybatıdan güneş).
import * as THREE from '../vendor/three.module.min.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------- güneşin konumu ----------
function sunFromClock(h) {
  // basit güneş konumu: enlem 41°, eğim -20° (Kasım sonu), yerel saat UTC+3 ve 29° D => güneş öğlesi ~12:50
  const phi = 41 * Math.PI / 180, dec = -20.2 * Math.PI / 180, H = (h - 12.83) * 15 * Math.PI / 180;
  let el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)); // güneyden batıya
  el = Math.max(el, 1.2 * Math.PI / 180); // gece yok: en fazla ufka değen güneş
  // three: X doğu, Z güney. az = 0 güney, + batı
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}
const QP = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); } })();
const SAAT = QP.has('saat') ? parseFloat(QP.get('saat')) : NaN;
export const SUN = isFinite(SAAT) ? sunFromClock(SAAT) : new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
export const FOG_B = 1 / 1900;    // sis yüksekliğe göre e katı azalma (1/m)
const EL = Math.asin(SUN.y) * 180 / Math.PI; // güneş yüksekliği (°)

// güneş ışığının rengi: Rayleigh + aerosol sönümü, Kasten-Young hava kütlesi; 33°'de beyaza yakın olacak biçimde ölçekli
function sunTrans(elDeg) {
  const y = Math.sin(elDeg * Math.PI / 180), am = 1 / (y + 0.50572 * Math.pow(elDeg + 6.07995, -1.6364));
  const tau = [0.034, 0.068, 0.155]; // R G B: Rayleigh ~ λ^-4 + biraz pus
  return tau.map((t) => Math.exp(-t * am));
}
const T0 = sunTrans(33.4), TS = sunTrans(EL);
export const SUN_COL = TS.map((v, i) => Math.min(1.08, v / T0[i]) * [1.0, 0.95, 0.86][i]);
const DAY = sm(1, 22, EL);       // 0: gün batımı, 1: gündüz
const GOLD = 1 - sm(3, 28, EL);   // altın saat ağırlığı
// zenit, ufuk ve güneş yönündeki ufuk kuşağı renkleri (ekran rengi). Gündüz değerleri eski gökyüzüyle aynı.
const ZEN = lerp3([0.13, 0.22, 0.42], [0.26, 0.47, 0.80], sm(0, 25, EL));
const HOR = lerp3([0.64, 0.56, 0.58], [0.70, 0.79, 0.88], sm(2, 30, EL));
const GLOW = lerp3([1.0, 0.50, 0.20], [1.0, 0.90, 0.74], sm(0, 30, EL));
const GLOW_K = 0.12 + 0.6 * GOLD;
export const SKY_INFO = { el: EL, day: DAY, gold: GOLD, zen: ZEN, hor: HOR, sunCol: SUN_COL };

const v3 = (v) => `vec3(${v.x.toFixed(5)}, ${v.y.toFixed(5)}, ${v.z.toFixed(5)})`;
const c3 = (c) => `vec3(${c.map((x) => x.toFixed(4)).join(', ')})`;

// ekran rengi (ton eşlemeden sonra) olarak gökyüzü: d birim yön (three dünya ekseni)
export const SKY_GLSL = `
#define SKY_SUN ${v3(SUN)}
#define SKY_SUNCOL ${c3(SUN_COL)}
vec3 skyAt(vec3 d) {
  vec3 sunD = SKY_SUN;
  float y = clamp(d.y, -0.2, 1.0), yp = max(y, 0.0);
  float mu = dot(d, sunD);
  // Rayleigh: zenit koyu mavi, ufka doğru optik derinlik artınca açık, beyazımsı
  float od = 1.0 / (yp + 0.045);
  vec3 ext = exp(-vec3(0.014, 0.028, 0.060) * od);
  vec3 c = mix(${c3(HOR)}, ${c3(ZEN)}, ext * 0.95);
  c *= 0.92 + 0.12 * (1.0 + mu * mu) * 0.5;
  // ufuk pusu: en alttaki ince açık kuşak (aerosol)
  c = mix(c, ${c3(HOR)} * 1.04 + 0.03, exp(-yp * 38.0) * 0.45);
  // güneş yönündeki ufuk kuşağı (gün batımında turuncu, gündüz hafif sıcak)
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sunD.xz + 1e-5);
  float az = dot(dh, sh) * 0.5 + 0.5;
  c += ${c3(GLOW)} * ${GLOW_K.toFixed(3)} * pow(az, 3.0) * exp(-yp * ${(4 + 6 * (1 - GOLD)).toFixed(2)});
  // gün batımında karşı ufukta pembe Venüs kuşağı
  c += vec3(0.10, 0.03, 0.05) * ${(GOLD * GOLD).toFixed(3)} * pow(1.0 - az, 2.0) * exp(-abs(yp - 0.08) * 18.0);
  // Mie: güneş çevresinde sıcak hale (Henyey-Greenstein, g = 0.78) + geniş ön saçılma
  float g = 0.78, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
  c += SKY_SUNCOL * vec3(1.0, 0.88, 0.70) * hg * ${(0.018 * (1 + GOLD)).toFixed(4)} * (0.4 + 0.6 * (1.0 - yp));
  // ufuk altı: pus (yer yansıması)
  if (y < 0.0) c = mix(c, ${c3(lerp3([0.40, 0.36, 0.36], [0.62, 0.66, 0.68], DAY))}, clamp(-y * 6.0, 0.0, 0.6));
  return c;
}`;

// kalite: dusuk / orta / yuksek (main.js'teki ayar world.opts'tan çıkarılır)
let QL = 'orta', SKYMAT = null;
export function setupAtmosphere(world, opts = {}) {
  const { scene, renderer } = world;
  const o = world.opts || {};
  QL = o.lowTex ? 'dusuk' : o.lod && o.lod[0] >= 2000 ? 'yuksek' : 'orta';
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  // sis parçaları
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogPos;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogPos = mvPosition.xyz;\n#endif';
  C.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogPos;
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear; uniform float fogFar;
    #endif
    ${SKY_GLSL}
  #endif`;
  C.fog_fragment = `#ifdef USE_FOG
    #ifdef FOG_EXP2
      vec3 fv = transpose(mat3(viewMatrix)) * vFogPos;
      float fd = length(fv); vec3 fdir = fv / max(fd, 0.001);
      float fb = ${FOG_B.toExponential(4)};
      float fk = fogDensity * exp(-fb * max(cameraPosition.y, 0.0));
      float fy = fdir.y * fd * fb;
      float fint = abs(fy) > 0.0005 ? (1.0 - exp(-fy)) / fy : 1.0 - 0.5 * fy;
      float fogFactor = 1.0 - exp(-fk * fd * fint);
      // sis rengi: o yöndeki ufuk; yukarıdan aşağı bakınca biraz koyulur (yerden yansıyan pus)
      vec3 fcol = skyAt(normalize(vec3(fdir.x, max(fdir.y, 0.0) * 0.35, fdir.z))) * fogColor;
      fcol *= 1.0 - 0.10 * clamp(-fdir.y * 1.5, 0.0, 1.0) * step(fogColor.r, 1.01);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, clamp(fogFactor, 0.0, 1.0));
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif
  #endif`;
  // fogColor: sis rengine çarpan (1 = gökyüzü ufku)
  scene.fog = new THREE.FogExp2(new THREE.Color(1, 1, 1), 0.00004);
  scene.fog.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
  // gökyüzü küresi (ekran renginde yazılır; ton eşlemeye girmez): güneş diski kenarı kararan, çevresinde parlama
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    vertexShader: 'varying vec3 vd; void main(){ vd = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    uniforms: { uCloud: { value: 0 } },
    fragmentShader: `varying vec3 vd; uniform float uCloud; ${SKY_GLSL}
      void main(){ vec3 d = normalize(vd); vec3 c = skyAt(d);
        float s = max(dot(d, SKY_SUN), 0.0);
        float disc = smoothstep(0.99955, 0.99972, s);
        float limb = sqrt(max(0.0, 1.0 - (1.0 - s) / 0.00045));
        c += SKY_SUNCOL * vec3(1.0, 0.95, 0.85) * disc * (0.6 + 0.4 * limb) * 2.0;
        c += SKY_SUNCOL * pow(s, 900.0) * 0.35;
        c = mix(c, ${c3(HOR)} * 1.25 + 0.06, uCloud);   // bulutun içinde gök görünmez
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  sky.scale.setScalar(1000); sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  // ışıklar: güneş rengi ve gücü güneşin yüksekliğine göre; gök ışığı zenit rengine
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x8a7d66, 1.05);
  hemi.color.setRGB(...lerp3([0.62, 0.62, 0.78], [0.81, 0.88, 1.0], DAY));
  hemi.groundColor.setRGB(...lerp3([0.40, 0.33, 0.28], [0.54, 0.49, 0.40], DAY));
  hemi.intensity = 1.05 * (0.55 + 0.45 * DAY);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.9);
  sun.color.setRGB(SUN_COL[0], SUN_COL[1] * 0.97, SUN_COL[2] * 0.92);
  sun.intensity = 2.9 * (0.45 + 0.55 * sm(0, 18, EL));
  sun.position.copy(SUN).multiplyScalar(1000);
  scene.add(sun); scene.add(sun.target);
  if (opts.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 320;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 10, far: 4000 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
    sun.shadow.camera.updateProjectionMatrix();
  }
  SKYMAT = skyMat;
  return { sky, skyMat, sun, hemi };
}

// her kare: gölge kamerasını uçağın / kameranın çevresine taşı, uçağın parçalarını gölge düşürür yap
export function updateShadows(world, camLocal) {
  const sun = world.sunLight;
  if (!sun || !sun.castShadow) return;
  // gölge merkezi: kameranın önünde, yere yakın (uçak genellikle oradadır)
  const t = world._shTarget || (world._shTarget = new THREE.Vector3());
  t.copy(world._acLocal || camLocal);
  // texel'e kilitle (kayarken gölge kenarları titremesin)
  const q = 640 / 2048;
  t.x = Math.round(t.x / q) * q; t.z = Math.round(t.z / q) * q; t.y = Math.round(t.y / q) * q;
  sun.target.position.copy(t);
  sun.position.copy(t).addScaledVector(SUN, 1800);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  // uçak, duman ve kameraya yakın sahne nesneleri (dünya kökü dışındakiler) gölge düşürür
  if ((world._shFrame = (world._shFrame || 0) + 1) % 30 === 1) {
    for (const o of world.scene.children) {
      if (o === world.root || o.isLight || o === world.sky || o === world.water || o.userData._sh || o.userData.noShadow) continue;
      o.userData._sh = true;
      o.traverse((m) => { if (m.isMesh && !m.material.transparent) m.castShadow = true; });
    }
  }
}

// ---------- bulutlar ----------
// Kümülüs: kameranın çevresinde dönen (sarmal) 48 km'lik alanda, tabanı 1500-2400 m'de, tepesi 3300 m'ye çıkabilen kümeler.
// Her küme 8-22 kameraya dönük "kabarcık"; kabarcık dokusu yalnız saydamlık değil, kubbe biçimli bir yüzeyin normalini ve
// kalınlığını da taşır (RG normal, B kalınlık, A örtü). Böylece her kabarcık güneşe göre aydınlanır: güneşe bakan yüzler
// parlak, alt taban gri-mavi, güneşe karşı bakınca ince kenarlarda gümüş ışık (ön saçılma), kalın yerlerde öz gölge.
// Kabarcıklar birkaç karede bir uzaktan yakına sıralanır (saydam karışım doğru olsun). Kameraya çok yaklaşan kabarcık
// saydamlaşır; kamera bulutun içindeyse sis yoğunlaşıp beyaza döner (bulutun içi). Hepsi tek örneklenmiş çizim.
// Sirrüs: 7-9 km'de yatay ince tül (orta ve yüksek kalitede), 1 çizim.
function rng(s) { let seed = s; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

// tekrar eden kafes üzerinde yumuşak değer gürültüsü (0-1)
const VN = (() => { const r = rng(91), a = new Float32Array(64 * 64); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
  const g = (i, j) => VN[((j & 63) << 6) | (i & 63)];
  const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * u, b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * u;
  return a + (b - a) * w;
}
function puffAtlas(T) {
  // 2 x 2 atlas, her biri T x T: kubbe yükseklik alanı (küreler birleşimi) -> normal, kalınlık, örtü
  const N = T * 2, data = new Uint8Array(N * N * 4), rnd = rng(11);
  const hf = new Float32Array(T * T);
  for (let v = 0; v < 4; v++) {
    hf.fill(0);
    const blobs = [];
    const nb = 9 + v * 3;
    for (let k = 0; k < nb; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.22;
      const cx = 0.5 + Math.cos(a) * r, cy = 0.46 + Math.sin(a) * r * 0.7 + (v === 3 ? -0.04 : 0);
      blobs.push([cx, cy, 0.09 + rnd() * 0.15 * (1 - r * 2)]);
    }
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const x = (i + 0.5) / T, y = (j + 0.5) / T;
      let h = 0;
      for (const [cx, cy, R] of blobs) { const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 < R * R) h = Math.max(h, Math.sqrt(R * R - d2) * (0.75 + 0.25 * (1 - cy))); }
      // yumuşak değer gürültüsü (kenar yırtıkları, yüzey kabarıklığı)
      h *= 0.78 + 0.22 * vnoise(x * 7 + v * 13, y * 7) + 0.08 * (vnoise(x * 17 + v * 5, y * 17 + 3) - 0.5);
      hf[j * T + i] = h;
    }
    const ox = (v % 2) * T, oy = (v >> 1) * T;
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const h = hf[j * T + i];
      const hx = (hf[j * T + Math.min(T - 1, i + 1)] - hf[j * T + Math.max(0, i - 1)]) * T * 0.5;
      const hy = (hf[Math.min(T - 1, j + 1) * T + i] - hf[Math.max(0, j - 1) * T + i]) * T * 0.5;
      let nx = -hx * 1.1, ny = -hy * 1.1; const nl = Math.hypot(nx, ny, 1); nx /= nl; ny /= nl;
      const k = ((oy + j) * N + ox + i) * 4;
      const al = sm(0.0, 0.09, h);
      data[k] = 128 + nx * 127; data[k + 1] = 128 + ny * 127; data[k + 2] = Math.min(255, h * 900); data[k + 3] = al * 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.flipY = false; tex.needsUpdate = true;
  return tex;
}

const LIGHT_GLSL = `
  vec3 cloudLight(vec3 nw, vec3 vdir, float thick, float hgt, float edge) {
    vec3 sunD = SKY_SUN;
    float ndl = dot(nw, sunD);
    // yaygın ışık + öz gölge (kalın yerlerde güneşten uzak yüz koyu), alt taban gri
    float dif = mix(0.30, 1.0, smoothstep(-0.55, 0.75, ndl));
    dif *= mix(0.55, 1.0, smoothstep(0.0, 0.75, hgt));
    dif *= 1.0 - 0.35 * thick * (1.0 - smoothstep(-0.2, 0.6, ndl));
    // ön saçılma: güneşe karşı bakınca ince kenarlar parlar (gümüş kenar)
    float mu = dot(vdir, sunD);
    float g = 0.6, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) * 0.08;
    float silver = hg * edge;
    vec3 amb = mix(${c3(lerp3(HOR, [0.5, 0.5, 0.55], 0.3))}, ${c3(ZEN)} * 1.35 + 0.18, clamp(nw.y * 0.5 + 0.5, 0.0, 1.0));
    amb = mix(amb * 0.75, amb, hgt);
    vec3 c = SKY_SUNCOL * vec3(1.0, 0.985, 0.96) * (dif * 0.78 + silver) * ${(0.55 + 0.45 * sm(0, 15, EL)).toFixed(3)} + amb * ${(0.42 + 0.3 * GOLD).toFixed(3)};
    return c;
  }`;

export function makeClouds(scene) {
  const Q = { dusuk: { n: 42, t: 64, mul: 0.75, cir: 0 }, orta: { n: 64, t: 96, mul: 1.0, cir: 24 }, yuksek: { n: 90, t: 128, mul: 1.25, cir: 40 } }[QL];
  const tex = puffAtlas(Q.t);
  const AREA = 48000, puffs = [], info = [], clouds = [];
  const rnd = rng(5);
  for (let i = 0; i < Q.n; i++) {
    const cx = rnd() * AREA, cy = rnd() * AREA, base = 1500 + rnd() * 900;
    const big = rnd() < 0.22; // kümülüs kongestus: yüksek kuleler
    const sz = (big ? 520 : 260) + rnd() * (big ? 520 : 380);
    const H = sz * (big ? 1.25 : 0.62) + rnd() * 120;
    const n = Math.round((8 + rnd() * 6 + (big ? 8 : 0)) * Q.mul);
    clouds.push({ x: cx, y: cy, r: sz, base, top: base + H });
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * sz;
      // tabanı düz, tepesi kubbe: merkezden uzaklaştıkça kabarcıklar alçalır; ilk kabarcıklar tabanı örter
      const top = 1 - (r / sz) ** 2;
      const hz = k < n * 0.35 ? rnd() * 0.18 : 0.15 + rnd() * 0.85 * top;
      const s = sz * (0.32 + rnd() * 0.32) * (k < n * 0.35 ? 1.15 : 1.0);
      puffs.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, base + s * 0.45 + hz * H, s);
      info.push(base, base + H, Math.floor(rnd() * 4), rnd() * 6.283);
    }
  }
  const N = puffs.length / 4;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const P0 = new Float32Array(puffs), I0 = new Float32Array(info);
  const pAttr = new THREE.InstancedBufferAttribute(new Float32Array(P0), 4), iAttr = new THREE.InstancedBufferAttribute(new Float32Array(I0), 4);
  pAttr.setUsage(THREE.DynamicDrawUsage); iAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('puff', pAttr); geo.setAttribute('info', iAttr);
  geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: tex }, wrap: { value: new THREE.Vector3() }, uIn: { value: 0 } }]),
    vertexShader: `attribute vec4 puff; attribute vec4 info; uniform vec3 wrap; uniform float uIn;
      varying vec2 vu; varying float va; varying float vh; varying vec2 vrot; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        // sarmal alan: bulutlar kamerayla birlikte gelir (wrap.xy = kamera mutlak konumu mod alan, z = alan)
        vec2 p = mod(puff.xy - wrap.xy + wrap.z * 0.5, wrap.z) - wrap.z * 0.5;
        vec3 wp = vec3(p.x, puff.z, -p.y) + vec3(cameraPosition.x, 0.0, cameraPosition.z);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        float d = length(mvPosition.xyz);
        va = smoothstep(puff.w * 0.5, puff.w * 1.6, d) * (1.0 - smoothstep(wrap.z * 0.36, wrap.z * 0.5, length(p)));
        va *= 1.0 - uIn * (1.0 - smoothstep(300.0, 1500.0, d)); // bulutun içindeyken yakın kabarcıklar yerine sis
        float c = cos(info.w), s = sin(info.w);
        vec2 q = mat2(c, s, -s, c) * position.xy;
        mvPosition.xy += q * puff.w;
        float v = info.z;
        vu = (position.xy * 0.5 + 0.5) * 0.5 + vec2(mod(v, 2.0), floor(v * 0.5)) * 0.5;
        vrot = vec2(c, s);
        vW = wp + vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) * q.x * puff.w + vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * q.y * puff.w;
        vh = clamp((vW.y - info.x) / max(info.y - info.x, 1.0), 0.0, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vu; varying float va; varying float vh; varying vec2 vrot; varying vec3 vW;
      #include <fog_pars_fragment>
      #ifndef USE_FOG
        ${SKY_GLSL}
      #endif
      ${LIGHT_GLSL}
      void main(){ vec4 t = texture2D(map, vu); float a = t.a * va; if (a < 0.01) discard;
        // kabarcık normali (görüş uzayı, kare döndürülmüşse normal de döner) -> dünya
        vec2 nxy = t.rg * 2.0 - 1.0;
        nxy = vec2(vrot.x * nxy.x - vrot.y * nxy.y, vrot.y * nxy.x + vrot.x * nxy.y);
        vec3 nv = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
        vec3 nw = normalize(transpose(mat3(viewMatrix)) * nv);
        vec3 vdir = normalize(vW - cameraPosition);
        float thick = t.b;
        vec3 c = cloudLight(nw, vdir, thick, vh, 1.0 - smoothstep(0.05, 0.6, thick));
        // ekran rengi (gökyüzüyle aynı uzay): yumuşak doyma
        c = 1.0 - exp(-c * 1.9);
        gl_FragColor = vec4(c, a * 0.92);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 8;
  mesh.userData.noShadow = true;
  scene.add(mesh);

  // sirrüs
  let cir = null;
  if (Q.cir) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d'); const r2 = rng(23);
    for (let k = 0; k < 140; k++) {
      const x = r2() * 256, y = 14 + r2() * 100, l = 30 + r2() * 90, w = 1.5 + r2() * 5;
      const gr = g.createLinearGradient(x - l, 0, x + l, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.08 + r2() * 0.16})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.save(); g.translate(x, y); g.rotate((r2() - 0.5) * 0.25); g.fillRect(-l, -w, 2 * l, 2 * w); g.restore();
    }
    // kenarları sıfıra indir
    const id = g.getImageData(0, 0, 256, 128);
    for (let j = 0; j < 128; j++) for (let i = 0; i < 256; i++) {
      const e = Math.min(1, Math.sin(Math.PI * i / 256) * 1.6) * Math.min(1, Math.sin(Math.PI * j / 128) * 1.6);
      id.data[(j * 256 + i) * 4 + 3] *= e;
    }
    g.putImageData(id, 0, 0);
    const ct = new THREE.CanvasTexture(c); ct.colorSpace = THREE.NoColorSpace;
    const CA = 140000, cp = [];
    for (let k = 0; k < Q.cir; k++) cp.push(r2() * CA, r2() * CA, 7200 + r2() * 1800, 3000 + r2() * 5000, r2() * 0.6 - 0.3 + 0.7);
    const cg = new THREE.InstancedBufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    cg.setIndex([0, 2, 1, 0, 3, 2]);
    const arr = new Float32Array(cp.length / 5 * 4), rot = new Float32Array(cp.length / 5);
    for (let k = 0; k < cp.length / 5; k++) { arr.set(cp.slice(k * 5, k * 5 + 4), k * 4); rot[k] = cp[k * 5 + 4]; }
    cg.setAttribute('puff', new THREE.InstancedBufferAttribute(arr, 4));
    cg.setAttribute('rot', new THREE.InstancedBufferAttribute(rot, 1));
    cg.instanceCount = Q.cir;
    const cmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: ct }, wrap: { value: new THREE.Vector3() } }]),
      vertexShader: `attribute vec4 puff; attribute float rot; uniform vec3 wrap; varying vec2 vu; varying float va; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){
          vec2 p = mod(puff.xy - wrap.xy + wrap.z * 0.5, wrap.z) - wrap.z * 0.5;
          float c = cos(rot), s = sin(rot);
          vec2 q = mat2(c, s, -s, c) * (position.xy * vec2(puff.w, puff.w * 0.45));
          vec3 wp = vec3(p.x + q.x, puff.z, -(p.y + q.y)) + vec3(cameraPosition.x, 0.0, cameraPosition.z);
          va = 1.0 - smoothstep(wrap.z * 0.3, wrap.z * 0.48, length(p));
          vu = position.xy * 0.5 + 0.5; vW = wp;
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vu; varying float va; varying vec3 vW;
        #include <fog_pars_fragment>
        #ifndef USE_FOG
          ${SKY_GLSL}
        #endif
        void main(){ vec4 t = texture2D(map, vu); float a = t.a * va; if (a < 0.004) discard;
          vec3 vd = normalize(vW - cameraPosition);
          float mu = dot(vd, SKY_SUN);
          vec3 c = mix(vec3(0.92, 0.94, 0.98), SKY_SUNCOL * vec3(1.05, 0.98, 0.92), 0.55) * (0.92 + 0.25 * pow(max(mu, 0.0), 6.0));
          gl_FragColor = vec4(c, a * 0.75);
          #include <fog_fragment>
        }`,
    });
    cir = new THREE.Mesh(cg, cmat); cir.frustumCulled = false; cir.renderOrder = 7; cir.userData.noShadow = true;
    scene.add(cir);
    cir.userData.area = CA;
  }

  // sıralama (uzaktan yakına) ve bulut içi denetimi
  const order = new Uint32Array(N), dist = new Float32Array(N);
  for (let i = 0; i < N; i++) order[i] = i;
  let lastSort = { x: 1e9, y: 1e9, h: 1e9 }, frame = 0, camH = 0, camX = 0, camY = 0;
  const wrapD = (d) => d - Math.round(d / AREA) * AREA;
  mesh.onBeforeRender = (r, s, cam) => { camH = cam.position.y; };
  function sort(ax, ay, h) {
    for (let i = 0; i < N; i++) {
      const dx = wrapD(P0[i * 4] - ax), dy = wrapD(P0[i * 4 + 1] - ay), dz = P0[i * 4 + 2] - h;
      dist[i] = dx * dx + dy * dy + dz * dz;
    }
    const ord = Array.from(order).sort((a, b) => dist[b] - dist[a]);
    const pa = pAttr.array, ia = iAttr.array;
    for (let k = 0; k < N; k++) { const i = ord[k]; for (let c = 0; c < 4; c++) { pa[k * 4 + c] = P0[i * 4 + c]; ia[k * 4 + c] = I0[i * 4 + c]; } }
    pAttr.needsUpdate = true; iAttr.needsUpdate = true;
  }
  // kameranın bulut içindeki yoğunluğu (0-1): küme elipsoidleri
  function inside(ax, ay, h) {
    let best = 0;
    for (const c of clouds) {
      if (h < c.base - 40 || h > c.top + 40) continue;
      const dx = wrapD(c.x - ax), dy = wrapD(c.y - ay);
      const mid = (c.base + c.top) * 0.5, hh = (c.top - c.base) * 0.5 + 30;
      const q = (dx * dx + dy * dy) / (c.r * c.r * 0.72) + ((h - mid) / hh) ** 2;
      if (q < 1) best = Math.max(best, sm(1.0, 0.45, q));
    }
    return best;
  }
  let dens = 0;
  return {
    mesh, cirrus: cir, clouds, quality: QL,
    // test için: kameraya en yakın bulut kümesinin ortası (mutlak x, y, yükseklik)
    findInside() {
      let b = null, bd = 1e18;
      for (const c of clouds) { const dx = wrapD(c.x - camX), dy = wrapD(c.y - camY), d = dx * dx + dy * dy; if (c.r > 380 && d < bd) { bd = d; b = { x: camX + dx, y: camY + dy, h: c.base + (c.top - c.base) * 0.4 }; } }
      return b;
    },
    get density() { return dens; },
    update(absX, absY) {
      camX = absX; camY = absY;
      mat.uniforms.wrap.value.set(((absX % AREA) + AREA) % AREA, ((absY % AREA) + AREA) % AREA, AREA);
      if (cir) { const A = cir.userData.area; cir.material.uniforms.wrap.value.set(((absX % A) + A) % A, ((absY % A) + A) % A, A); }
      frame++;
      const mv = Math.hypot(absX - lastSort.x, absY - lastSort.y, camH - lastSort.h);
      if (mv > 60 && frame % 4 === 0 || mv > 600) { sort(absX, absY, camH); lastSort = { x: absX, y: absY, h: camH }; }
      // bulutun içi: görüş 60-150 m'ye iner, sis beyaza döner (world.update sis yoğunluğunu her kare yeniden yazar)
      const d = inside(absX, absY, camH);
      dens += (d - dens) * 0.25;
      const f = scene.fog;
      if (dens > 0.01) {
        f.density = f.density + dens * dens * 0.08;
        const w = Math.min(1, dens * 1.4);
        f.color.setRGB(1 + w * 0.32, 1 + w * 0.25, 1 + w * 0.17, THREE.LinearSRGBColorSpace);
      } else if (f.color.r !== 1) f.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
      if (SKYMAT) SKYMAT.uniforms.uCloud.value = Math.min(1, dens * 1.6);
      mat.uniforms.uIn.value = Math.min(1, dens * 1.5);
    },
  };
}
