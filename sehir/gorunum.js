/* Görünüm: dokulu arazi gölgelendiricisi, nesne (ağaç/kaya) malzemesi ve UV'leri, yakın çevre çim tutamları, su, gök.
   arazi.js'ten ÖNCE yüklenir; arazi.js buradaki işlevleri çağırır (SO.gorunum). Dokular doku/ içinde (hepsi CC0, doku/LISANS.md).
   Dokular "ortalaması 0,5 gri" saklanır: gölgelendirici ×2 ile çarpıp köşeden gelen biyom rengiyle boyar; böylece renkler koddan ayarlanır.
   Ayarlar: SO.tune.gorunum (çalışırken değiştirilebilir).
   Arazi pikseli başına 7 doku örneği: çim, toprak, çakıl, paket (kar/kum/gürültü) yakın + paket uzak ölçek, kaya × 2 (yan izdüşümler). */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp;
  const ayar = SO.tune.gorunum = {
    cim: true,        // çim tutamları açık mı
    cimSayi: 3000,    // görünen daire içindeki yaklaşık tutam sayısı (tutam başına 9 üçgen)
    cimUzak: 32,      // tutamların göründüğü yarıçap (m); son %45'inde küçülerek kaybolur
    cimBoy: 1,        // tutam boyu çarpanı
    ruzgar: 1,        // salınım çarpanı (0 = durgun)
    cizgi: .5,        // ağaç/kaya mürekkep dış çizgisi kalınlık çarpanı (yalnız açılışta okunur)
    ayrintiYakin: 28, ayrintiUzak: 170 // arazi doku ayrıntısının sönmeye başladığı ve bittiği uzaklık (m)
  };
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hash(ix, iz, s) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz), a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
  const GUN = new T3.Vector3(-.5, .8, .35).normalize(); // arazi.js'teki SUN ile aynı
  const rgb = h => { const c = new T3.Color(h); return [c.r, c.g, c.b]; };

  /* ---------- dokular ---------- */
  const bekleyen = [], gri = new T3.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, T3.RGBAFormat); gri.needsUpdate = true;
  let aniso = 4;
  // yüklenene kadar düz gri (= düz renk) gösterilir; yüklenince `tak(doku)` çağrılır
  function doku(ad, tak) { bekleyen.push(new Promise(ok => new T3.TextureLoader().load('doku/' + ad + '.jpg', t => { t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = aniso; tak(t); ok(); }, undefined, () => { console.error('doku yüklenemedi: ' + ad); ok(); }))); }
  const bekle = () => Promise.all(bekleyen);

  /* ---------- arazi: köşe öznitelikleri ----------
     isik (3 × float): güneş/gölge çarpanı × ton oynaması · c0: çim rengi · c1: toprak rengi · cK: kaya rengi (biyoma göre)
     aw: toprak, kum, kar, çakıl ağırlıkları (çim = kalan) · ak: normal x, normal z, kaya ağırlığı, boş */
  const CIM = [rgb('#85994f'), rgb('#62793f')], KURU = rgb('#a39c52'), TOPRAK = [rgb('#8f7450'), rgb('#6d5a40'), rgb('#cdae7c'), rgb('#8f8c86'), rgb('#a8503a')],
    KAYA = [rgb('#978c78'), rgb('#8a826f'), rgb('#c9a074'), rgb('#93a0a8'), rgb('#5a2b2e')], GOLGE = [.64, .66, .74], AYDIN = [1.07, 1.045, .98];
  const yama = (x, z, orman) => { const f = vnoise(x / 26, z / 26, 91) * .6 + vnoise(x / 7, z / 7, 92) * .4; return sm(.64 - orman * .08, .8 - orman * .08, f) * .85; }; // çıplak toprak lekeleri
  function cimRenk(x, z, tw, out) { const t = tw[1] / (tw[0] + tw[1] + 1e-4), k = sm(.45, .8, vnoise(x / 120, z / 120, 93)) * .5 * (1 - t * .6); for (let q = 0; q < 3; q++) out[q] = lerp(lerp(CIM[0][q], CIM[1][q], t), KURU[q], k); return out; }
  function isikF(nx, ny, nz, x, z, out) { const d = nx * GUN.x + ny * GUN.y + nz * GUN.z, s = sm(.3, .93, d), ton = .93 + vnoise(x / 9, z / 9, 77) * .08 + vnoise(x / 70, z / 70, 78) * .08; for (let q = 0; q < 3; q++) out[q] = lerp(GOLGE[q], AYDIN[q], s) * ton; return out; }
  const diziler = nv => ({ isik: new Float32Array(nv * 3), c0: new Uint8Array(nv * 3), c1: new Uint8Array(nv * 3), cK: new Uint8Array(nv * 3), aw: new Uint8Array(nv * 4), ak: new Uint8Array(nv * 4) });
  const t3 = [0, 0, 0];
  // bir arazi köşesi: o = köşe sırası, (x, z, h), n = normal (THREE.Vector3), tw = biyom ağırlıkları [vadi, orman, çöl, kar, kızıl]
  function kose(A, o, x, z, h, n, tw) {
    const o3 = o * 3, o4 = o * 4, cimli = tw[0] + tw[1], kiyi = 1 - sm(.15, 1.0, h), deniz = sm(12200, 13400, Math.max(Math.abs(x), Math.abs(z))), dik = 1 - n.y;
    isikF(n.x, n.y, n.z, x, z, t3); A.isik[o3] = t3[0]; A.isik[o3 + 1] = t3[1]; A.isik[o3 + 2] = t3[2];
    cimRenk(x, z, tw, t3); const yuk = sm(120, 230, h) * .25; A.c0[o3] = lerp(t3[0], .62, yuk) * 255; A.c0[o3 + 1] = lerp(t3[1], .64, yuk) * 255; A.c0[o3 + 2] = lerp(t3[2], .5, yuk) * 255;
    for (let q = 0; q < 3; q++) { let a = 0, b = 0; for (let k = 0; k < 5; k++) { a += TOPRAK[k][q] * tw[k]; b += KAYA[k][q] * tw[k]; } A.c1[o3 + q] = a * 255; A.cK[o3 + q] = b * 255; }
    const toprak = Math.max(tw[4], cimli * Math.max(yama(x, z, tw[1]), sm(.07, .17, dik) * .45)), kum = Math.max(tw[2], kiyi * deniz), kar = Math.max(tw[3], sm(230, 290, h + (n.y - .8) * 120)), cakil = kiyi * (1 - deniz) * (1 - tw[2]) * (1 - tw[3] * .6);
    A.aw[o4] = toprak * 255; A.aw[o4 + 1] = kum * 255; A.aw[o4 + 2] = kar * 255; A.aw[o4 + 3] = cakil * 255;
    A.ak[o4] = (n.x * .5 + .5) * 255; A.ak[o4 + 1] = (n.z * .5 + .5) * 255; A.ak[o4 + 2] = sm(.12, .32, dik) * 255; A.ak[o4 + 3] = 0;
  }
  function etekKopya(A, s, o) { for (const k in A) { const a = A[k], n = k === 'aw' || k === 'ak' ? 4 : 3; for (let q = 0; q < n; q++) a[s * n + q] = a[o * n + q]; } }
  function geoBagla(g, A) { g.setAttribute('isik', new T3.BufferAttribute(A.isik, 3)); for (const k of ['c0', 'c1', 'cK']) g.setAttribute(k, new T3.BufferAttribute(A[k], 3, true)); g.setAttribute('aw', new T3.BufferAttribute(A.aw, 4, true)); g.setAttribute('ak', new T3.BufferAttribute(A.ak, 4, true)); }

  /* ---------- arazi malzemesi ---------- */
  const uZaman = { value: 0 }, uAyr = { value: new T3.Vector2(ayar.ayrintiYakin, ayar.ayrintiUzak) }, DERIN = rgb('#2f6f8a');
  let yerM;
  function yerMat() {
    const U = T3.UniformsUtils.merge([T3.UniformsLib.fog, { uKum: { value: new T3.Color('#e3cca0') }, uKar: { value: new T3.Color('#f1f4f2') }, uCakil: { value: new T3.Color('#9c8f76') }, uDerin: { value: new T3.Color('#2f6f8a') } }]);
    U.tCim = { value: gri }; U.tToprak = { value: gri }; U.tKaya = { value: gri }; U.tCakil = { value: gri }; U.tPaket = { value: gri }; U.uZaman = uZaman; U.uAyr = uAyr;
    yerM = new T3.ShaderMaterial({ uniforms: U, fog: true,
      vertexShader: `
attribute vec3 isik; attribute vec3 c0; attribute vec3 c1; attribute vec3 cK; attribute vec4 aw; attribute vec4 ak;
varying vec3 vP; varying vec3 vL; varying vec3 vC0; varying vec3 vC1; varying vec3 vCK; varying vec4 vW; varying vec4 vK; varying float vUz;
#include <fog_pars_vertex>
void main() {
  vP = position; vL = isik; vC0 = c0; vC1 = c1; vCK = cK; vW = aw; vK = ak;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vUz = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: `
uniform sampler2D tCim; uniform sampler2D tToprak; uniform sampler2D tKaya; uniform sampler2D tCakil; uniform sampler2D tPaket;
uniform vec3 uKum; uniform vec3 uKar; uniform vec3 uCakil; uniform vec3 uDerin; uniform float uZaman; uniform vec2 uAyr;
varying vec3 vP; varying vec3 vL; varying vec3 vC0; varying vec3 vC1; varying vec3 vCK; varying vec4 vW; varying vec4 vK; varying float vUz;
#include <fog_pars_fragment>
// ağırlık → keskin ama gürültülü sınır (w = 0 → 0, w = 1 → 1): katmanlar düz çizgiyle değil lekelerle geçer
float maske(float w, float n) { float e = clamp(n * 2.0 - .5, 0.0, 1.0) * .68; return smoothstep(e, e + .32, w); }
void main() {
  vec2 p = vP.xz;
  float ay = 1.0 - smoothstep(uAyr.x, uAyr.y, vUz);            // yakın doku ayrıntısının gücü (uzakta düz renge döner)
  vec3 mk = texture2D(tPaket, p * .015625).rgb;                 // uzak ölçek (64 m): tekrar kırıcı ton + maske gürültüsü
  vec3 pk = texture2D(tPaket, p * .25).rgb;                     // r: kar, g: kum, b: ince gürültü
  vec3 cim = texture2D(tCim, p * .25).rgb;
  vec3 top = texture2D(tToprak, p * .25).rgb;
  vec3 cak = texture2D(tCakil, p * .3125).rgb;
  vec2 nn = vK.xy * 2.0 - 1.0; nn *= nn;                         // dik yamaç: kaya dokusu yandan izdüşümle (uzamaz)
  vec3 kay = (texture2D(tKaya, vP.zy * .125).rgb * nn.x + texture2D(tKaya, vP.xy * .125).rgb * nn.y) / (nn.x + nn.y + .0001);
  float a2 = ay * 2.0, nA = mk.b * .6 + pk.b * .4, nB = mk.r * .55 + pk.b * .45;
  vec3 col = vC0 * (1.0 + (cim - .5) * a2 * .85) * (.88 + mk.g * .24);
  col = mix(col, vC1 * (1.0 + (top - .5) * a2), maske(vW.x, nA));
  col = mix(col, uKum * (1.0 + (pk.g - .5) * a2), maske(vW.y, nB));
  col = mix(col, uCakil * (1.0 + (cak - .5) * a2), maske(vW.w, nA));
  float mKar = maske(vW.z, nB); col = mix(col, uKar * (1.0 + (pk.r - .5) * ay), mKar);
  col = mix(col, vCK * (1.0 + (kay - .5) * (.6 + 1.4 * ay)), maske(vK.z, nA * .6 + (1.0 - kay.g) * .4));
  col *= vL * mix(.82 + mk.b * .36, 1.0, mKar * .75);
  // su kıyısı: ıslak koyuluk, kıyı çizgisinde açık köpük, derine doğru koyulaşma (su düzlemi y = 0)
  float y = vP.y + sin(uZaman * .9 + p.x * .31 + p.y * .23) * .025;
  col *= mix(.74, 1.0, smoothstep(.0, .5, y));
  col = mix(col, vec3(.93, .96, .94), (1.0 - smoothstep(.0, .07, abs(y - .015))) * .45);
  col = mix(col, uDerin, smoothstep(.1, -3.2, vP.y) * .9);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}` });
    doku('cim', t => { yerM.uniforms.tCim.value = t; }); doku('toprak', t => { yerM.uniforms.tToprak.value = t; }); doku('kaya', t => { yerM.uniforms.tKaya.value = t; }); doku('cakil', t => { yerM.uniforms.tCakil.value = t; });
    doku('paket', t => { yerM.uniforms.tPaket.value = t; if (suM) suM.uniforms.tPaket.value = t; });
    return yerM;
  }

  /* ---------- nesneler (ağaç, kaya, kaktüs...): atlas UV'li geometri + örneklenmiş malzeme ----------
     doku/nesne.jpg 2×2 karo: [kabuk, yaprak; kaya, ince kum]. Her karo çevresinde 16 px sarmalı pay var, UV karo içinde kalır (tekrar yok → mip dikişi yok).
     Köşe başına iki renk (aydınlık, gölge) + normal: ışık köşe gölgelendiricide örneğin dönüşüne göre hesaplanır (dönen ağacın gölgesi de döner). */
  const KARO = { kabuk: [0, 0], yaprak: [1, 0], kaya: [0, 1], ince: [1, 1] };
  function karoSec(ad, i, p) {
    if (ad.startsWith('yaprakli') || ad === 'cam1') return i === 0 ? 'kabuk' : 'yaprak'; if (ad === 'camKar') return i === 0 ? 'kabuk' : 'ince';
    if (ad === 'cali') return 'yaprak'; if (ad.startsWith('kaya') || ad.startsWith('duz')) return 'kaya'; return 'ince';
  }
  function nesneGeo(parts, ad) {
    const pos = [], col = [], col2 = [], nor = [], uv = [], a = new T3.Vector3(), b = new T3.Vector3(), c = new T3.Vector3(), n = new T3.Vector3(), cl = new T3.Color(), cd = new T3.Color(), nm = new T3.Matrix3();
    const sert = ad.startsWith('kaya') || ad.startsWith('duz') || ad.startsWith('kristal'); let y0 = 1e9, y1 = -1e9;
    parts.forEach((p, pi) => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); g.applyMatrix4(p.m); const A = g.attributes.position.array, N = g.attributes.normal ? g.attributes.normal.array : null, UV = g.attributes.uv ? g.attributes.uv.array : null;
      const [ki, kj] = KARO[karoSec(ad, pi, p)], silindir = !!p.tall && !!UV, kendiN = !sert && !!N; cl.set(p.lt); cd.set(p.dk);
      let E = 0; for (let i = 0; i < A.length; i += 3) E = Math.max(E, Math.abs(A[i] - p.center.x), Math.abs(A[i + 1] - p.center.y), Math.abs(A[i + 2] - p.center.z)); E *= 1.02;
      const koy = (u, v) => uv.push((ki * 512 + 16 + clamp(u, 0, 1) * 480) / 1024, 1 - (kj * 512 + 16 + (1 - clamp(v, 0, 1)) * 480) / 1024);
      for (let i = 0; i < A.length; i += 9) { a.set(A[i], A[i + 1], A[i + 2]); b.set(A[i + 3], A[i + 4], A[i + 5]); c.set(A[i + 6], A[i + 7], A[i + 8]); n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        for (let k = 0; k < 3; k++) { const q = i + k * 3, x = A[q], y = A[q + 1], z = A[q + 2]; pos.push(x, y, z); col.push(cl.r, cl.g, cl.b); col2.push(cd.r, cd.g, cd.b); if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (kendiN) nor.push(N[q], N[q + 1], N[q + 2]); else nor.push(n.x, n.y, n.z);
          if (silindir) { const t = (i / 3 + k) * 2; koy(UV[t], UV[t + 1]); }
          else { const lx = (x - p.center.x) / (2 * E), ly = (y - p.center.y) / (2 * E), lz = (z - p.center.z) / (2 * E); if (ay >= ax && ay >= az) koy(.5 + lx, .5 + lz); else if (ax >= az) koy(.5 + lz, .5 + ly); else koy(.5 + lx, .5 + ly); } } }
      g.dispose(); });
    // yerden yukarı hafif açılma (dip koyu): nesne yere oturmuş görünür
    for (let i = 0; i < pos.length; i += 3) { const k = lerp(.78, 1.06, sm(0, 1, (pos[i + 1] - y0) / Math.max(.01, y1 - y0))); for (let q = 0; q < 3; q++) { col[i + q] *= k; col2[i + q] *= k; } }
    const out = new T3.BufferGeometry(); out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); out.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); out.setAttribute('color2', new T3.Float32BufferAttribute(col2, 3)); out.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2)); return out;
  }
  // uFar/uCam: arazi.js'in "uzakta küçülme" değerleri (aynı nesneler)
  function nesneMat(uFar, uCam) {
    const m = new T3.MeshBasicMaterial({ vertexColors: true, map: gri });
    m.onBeforeCompile = s => { s.uniforms.uFar = uFar; s.uniforms.uCam = uCam; s.uniforms.uGun = { value: GUN };
      s.vertexShader = 'uniform float uFar; uniform vec3 uCam; uniform vec3 uGun; attribute vec3 color2;\n' + s.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING
  vec3 ipG = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec3 nG = normalize(mat3(instanceMatrix) * normal);
#else
  vec3 ipG = modelMatrix[3].xyz; vec3 nG = normal;
#endif
  float gK = smoothstep(-.2, .55, dot(nG, uGun));
  float h1 = fract(sin(dot(fract(ipG.xz * vec2(.1731, .2137)), vec2(12.9898, 78.233))) * 43758.5453), h2 = fract(h1 * 7.31 + .37); // örnek başına ton
  vColor.xyz = mix(color2, color, gK) * (.86 + .26 * h1) * vec3(1.0 + (h2 - .5) * .2, 1.0, 1.0 - (h2 - .5) * .16);`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n transformed *= 1.0 - smoothstep(uFar - 90.0, uFar, distance(ipG, uCam));\n#endif');
      s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', 'diffuseColor.rgb *= texture2D(map, vUv).rgb * 2.0;'); };
    doku('nesne', t => { t.wrapS = t.wrapT = T3.ClampToEdgeWrapping; m.map = t; });
    return m;
  }

  /* ---------- su ---------- */
  let suM;
  function suMat() {
    const U = T3.UniformsUtils.merge([T3.UniformsLib.fog, { uSig: { value: new T3.Color('#4f9db0') }, uAcik: { value: new T3.Color('#5fb0bd') }, uYansi: { value: new T3.Color('#bcd9e8') }, uGun: { value: GUN.clone() } }]);
    U.tPaket = { value: yerM ? yerM.uniforms.tPaket.value : gri }; U.uZaman = uZaman;
    suM = new T3.ShaderMaterial({ uniforms: U, fog: true, transparent: true,
      vertexShader: `
varying vec3 vP;
#include <fog_pars_vertex>
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: `
uniform sampler2D tPaket; uniform vec3 uSig; uniform vec3 uAcik; uniform vec3 uYansi; uniform vec3 uGun; uniform float uZaman;
varying vec3 vP;
#include <fog_pars_fragment>
void main() {
  vec3 V = cameraPosition - vP; float uz = length(V); V /= uz;
  vec2 p = vP.xz;
  float a = texture2D(tPaket, p * .045 + uZaman * vec2(.013, .008)).b, b = texture2D(tPaket, p * .11 - uZaman * vec2(.011, .017) + .37).b;
  float d = (a + b - 1.0) * (1.0 - smoothstep(60.0, 420.0, uz));    // küçük dalga deseni (uzakta söner)
  float f = 1.0 - V.y; f = clamp(f * f * f + d * .35, 0.0, 1.0);     // yatay bakışta gök yansır, dik bakışta dip görünür
  vec3 col = mix(mix(uSig, uAcik, smoothstep(-.25, .3, d)), uYansi, f);
  vec3 H = normalize(uGun + V); float par = pow(max(H.y + d * .06, 0.0), 220.0) + smoothstep(.2, .55, d) * .07; // güneş parıltısı + dalga tepesi
  col += vec3(1.0, .97, .88) * par;
  gl_FragColor = vec4(col, mix(.42, .96, f) + par);
  #include <fog_fragment>
}` });
    return suM;
  }

  /* ---------- gök: kameranın çevresinde kubbe (ufuk rengi = sis rengi; güneş yönünde hafif ışıma) ---------- */
  const SIS = 0xd3e4e8; let kubbe;
  function gok(scene) {
    scene.fog.color.set(SIS); scene.background = new T3.Color(SIS);
    kubbe = new T3.Mesh(new T3.SphereGeometry(1, 20, 10), new T3.ShaderMaterial({ side: T3.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { uUfuk: { value: new T3.Color(SIS) }, uOrta: { value: new T3.Color('#9cc6e2') }, uTepe: { value: new T3.Color('#4f8fcb') }, uGun: { value: GUN.clone() } },
      vertexShader: 'varying vec3 vD;\nvoid main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
uniform vec3 uUfuk; uniform vec3 uOrta; uniform vec3 uTepe; uniform vec3 uGun; varying vec3 vD;
void main() { vec3 d = normalize(vD); float h = max(d.y, 0.0);
  vec3 col = mix(uUfuk, uOrta, smoothstep(.0, .22, h)); col = mix(col, uTepe, smoothstep(.15, .85, h));
  float g = max(dot(d, uGun), 0.0); col += vec3(1.0, .93, .78) * (pow(g, 6.0) * .16 + pow(g, 90.0) * .5);
  gl_FragColor = vec4(col, 1.0); }` }));
    kubbe.scale.setScalar(7000); kubbe.renderOrder = -10; kubbe.frustumCulled = false; scene.add(kubbe);
  }

  /* ---------- çim tutamları: oyuncuyla kayan ızgara (8 m hücre), tek örneklenmiş ağ, tek çizim çağrısı ----------
     Hücre başına sabit sayıda yuva; hücre pencereden çıkınca yuvası yeni giren hücreyle doldurulur (zemin yüksekliği, eğim, biyom, toprak lekesi). */
  const HC = 8; let cimAg = null, cimK = 0, cimM = 0, cimYuva = null, cimKur = '', dunya = null, cimSahne = null;
  const uMerkez = { value: new T3.Vector3() }, uCim = { value: new T3.Vector3(34, 1, 1) }, tw = [0, 0, 0, 0, 0], tc = [0, 0, 0], tl = [0, 0, 0];
  function tutamGeo() { // birim tutam: 7 ince üçgen yaprak + tepesinde küçük çiçek (yalnız çiçekli örneklerde görünür)
    const r = SO.rnd(4242), pos = [], ton = [], cic = [];
    for (let i = 0; i < 7; i++) { const th = i / 7 * 6.283 + r() * .7, dx = Math.sin(th), dz = Math.cos(th), r0 = .03 + r() * .12, w = .075 + r() * .04, hh = .6 + r() * .4, egik = .12 + r() * .3, t = .8 + r() * .35;
      pos.push(dx * r0 - dz * w, 0, dz * r0 + dx * w, dx * r0 + dz * w, 0, dz * r0 - dx * w, dx * (r0 + egik), hh, dz * (r0 + egik)); ton.push(t, t, t); cic.push(0, 0, 0); }
    const s = .13; pos.push(-s, .93, 0, s, .93, 0, 0, .98, s * 1.1, s, .93, 0, -s, .93, 0, 0, .98, -s * 1.1); for (let i = 0; i < 6; i++) { ton.push(1); cic.push(1); }
    const g = new T3.InstancedBufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('ton', new T3.Float32BufferAttribute(ton, 1)); g.setAttribute('cic', new T3.Float32BufferAttribute(cic, 1)); return g;
  }
  function cimKurF() {
    if (cimAg) { cimSahne.remove(cimAg); cimAg.geometry.dispose(); cimAg.material.dispose(); cimAg = null; }
    const R = ayar.cimUzak; cimK = Math.ceil(2 * R / HC) + 1; cimM = Math.max(1, Math.round(ayar.cimSayi / (Math.PI * R * R) * HC * HC)); const n = cimK * cimK * cimM;
    const g = tutamGeo(); g.instanceCount = n; g.setAttribute('iPos', new T3.InstancedBufferAttribute(new Float32Array(n * 4), 4)); g.setAttribute('iRenk', new T3.InstancedBufferAttribute(new Float32Array(n * 4), 4));
    g.attributes.iPos.setUsage(T3.DynamicDrawUsage); g.attributes.iRenk.setUsage(T3.DynamicDrawUsage);
    const m = new T3.ShaderMaterial({ fog: true, side: T3.DoubleSide, uniforms: Object.assign(T3.UniformsUtils.merge([T3.UniformsLib.fog]), { uMerkez, uCim, uZaman }),
      vertexShader: `
attribute vec4 iPos; attribute vec4 iRenk; attribute float ton; attribute float cic;
uniform vec3 uMerkez; uniform vec3 uCim; uniform float uZaman; varying vec3 vC;
#include <fog_pars_vertex>
void main() {
  float tur = floor(iRenk.a), aci = (iRenk.a - tur) * 6.2832, cs = cos(aci), sn = sin(aci);
  float k = iPos.w * (1.0 - smoothstep(uCim.x * .55, uCim.x, distance(iPos.xz, uMerkez.xz)));
  vec3 q = position * mix(1.0, step(.5, tur), cic); q.xz = vec2(q.x * cs - q.z * sn, q.x * sn + q.z * cs); q.y *= uCim.y;
  vec3 w = iPos.xyz + q * k; float t = position.y;
  float rz = sin(uZaman * 1.7 + iPos.x * .43 + iPos.z * .31) + sin(uZaman * 2.9 + iPos.x * .17 - iPos.z * .23) * .5; w.xz += vec2(.055, .03) * rz * t * t * k * uCim.z;
  vec3 cicek = tur < 1.5 ? vec3(.97, .96, .9) : tur < 2.5 ? vec3(.96, .82, .25) : vec3(.72, .5, .86);
  vC = mix(iRenk.rgb * mix(.8, 1.24, t) * ton, cicek, cic);
  vec4 mvPosition = viewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: 'varying vec3 vC;\n#include <fog_pars_fragment>\nvoid main() { gl_FragColor = vec4(vC, 1.0);\n#include <fog_fragment>\n}' });
    cimAg = new T3.Mesh(g, m); cimAg.frustumCulled = false; cimAg.matrixAutoUpdate = false; cimSahne.add(cimAg);
    cimYuva = new Array(cimK * cimK).fill(null); cimKur = ayar.cimSayi + '/' + ayar.cimUzak;
  }
  function cimDoldur(yuva, ci, cj) {
    const P = cimAg.geometry.attributes.iPos.array, C = cimAg.geometry.attributes.iRenk.array, r = SO.rnd((ci * 73856093) ^ (cj * 19349663) ^ 4711), gy = dunya.groundY;
    dunya.agirlik((ci + .5) * HC, (cj + .5) * HC, tw); const cimli = tw[0] + tw[1];
    for (let m = 0; m < cimM; m++) { const o = (yuva * cimM + m) * 4, x = (ci + r()) * HC, z = (cj + r()) * HC, u = r(), u2 = r(), boy = r(), aci = r(), cc = r(); P[o + 3] = 0;
      let b = 0, acc = tw[0]; while (b < 4 && u > acc) { b++; acc += tw[b]; } if (b === 3) continue; // karda ot yok
      const h = gy(x, z); if (h < 1.15 || h > 225) continue; const hx = gy(x + 1, z) - gy(x - 1, z), hz = gy(x, z + 1) - gy(x, z - 1), L = Math.hypot(hx, 2, hz); if (Math.hypot(hx, hz) / 2 > .36) continue;
      let yog, s = .32 + boy * .26;
      if (b < 2) { yog = (1 - yama(x, z, tw[1])) * (.3 + .7 * sm(.3, .62, vnoise(x / 10, z / 10, 95))); cimRenk(x, z, tw, tc); }
      else if (b === 2) { yog = .14; tc[0] = .73; tc[1] = .66; tc[2] = .38; s *= .9; } else { yog = .16; tc[0] = .52; tc[1] = .2; tc[2] = .3; }
      if (u2 > yog) continue; isikF(-hx / L, 2 / L, -hz / L, x, z, tl);
      P[o] = x; P[o + 1] = h - .03; P[o + 2] = z; P[o + 3] = s; C[o] = tc[0] * tl[0]; C[o + 1] = tc[1] * tl[1]; C[o + 2] = tc[2] * tl[2];
      C[o + 3] = Math.min(.999, aci) + (b < 2 && cc < .1 ? 1 + Math.floor(cc * 30) : 0); } // %10'u çiçekli: 1 beyaz, 2 sarı, 3 mor
  }
  function cimGuncelle() {
    if (!ayar.cim) { if (cimAg) cimAg.visible = false; return; }
    if (!cimAg || cimKur !== ayar.cimSayi + '/' + ayar.cimUzak) cimKurF(); cimAg.visible = true;
    const px = SO.ps.x, pz = SO.ps.z, i0 = Math.floor(px / HC - cimK / 2 + .5), j0 = Math.floor(pz / HC - cimK / 2 + .5); let degisti = false;
    for (let b = 0; b < cimK; b++) for (let a = 0; a < cimK; a++) { const ci = i0 + a, cj = j0 + b, y = ((ci % cimK) + cimK) % cimK + (((cj % cimK) + cimK) % cimK) * cimK, anahtar = ci + ',' + cj; if (cimYuva[y] !== anahtar) { cimYuva[y] = anahtar; cimDoldur(y, ci, cj); degisti = true; } }
    if (degisti) { cimAg.geometry.attributes.iPos.needsUpdate = true; cimAg.geometry.attributes.iRenk.needsUpdate = true; }
    uMerkez.value.set(px, 0, pz); uCim.value.set(ayar.cimUzak, ayar.cimBoy, ayar.ruzgar);
  }

  /* ---------- kurulum ve kare ---------- */
  // d: arazi.js'ten { agirlik(x, z, out), groundY(x, z) }
  function kur(scene, renderer, d) { dunya = d; cimSahne = scene; aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy()); gok(scene); }
  function kare(cam) { uZaman.value = SO.time; uAyr.value.set(ayar.ayrintiYakin, ayar.ayrintiUzak); if (kubbe) kubbe.position.copy(cam.position); if (dunya) cimGuncelle(); }
  SO.gorunum = { ayar, kur, kare, bekle, yerMat, suMat, nesneMat, nesneGeo, diziler, kose, etekKopya, geoBagla, GUN,
    durum: () => ({ cimYuva: cimAg ? cimAg.geometry.instanceCount : 0, cimUcgen: cimAg && ayar.cim ? cimAg.geometry.instanceCount * 9 : 0 }) };
})();
