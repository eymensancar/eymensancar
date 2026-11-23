// Binalar: Türkiye'nin bütün OpenStreetMap binaları (data/tr/bina.json dizini, bina/q_*.png paketleri), uzaklığa göre
// dört ayrıntı düzeyi (1/2/4/8 km düğümler), cephe dokusu atlası, çarpışma ızgarası, camiler (kubbe + minare), ağaçlar.
// Geometri bir Web Worker'da (bworker.js) üretilir; düğüm başına tek çizim çağrısı, çerçeve dışındakiler çizilmez,
// uzaklaşan düğümler bellekten atılır. Zemin yüksekliği için arazi verisi işçiye kopyalanır (aynı hesap).
import * as THREE from '../vendor/three.module.min.js';
import { pngBytes } from './veri.js';

const CS = 12.5, CN = 80;
function hash2(x, y) { let h = Math.imul(Math.round(x) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(Math.round(y) + 0x9e3779b9, 0x85ebca77); h ^= h >>> 15; h = Math.imul(h, 0xc2b2ae3d); h ^= h >>> 13; return h >>> 0; }
const SIZES = [1000, 2000, 4000, 8000];

// ---------- cephe dokusu atlası (4 x 4 karo, 256 piksel) ----------
// Karo = bir kat x bir pencere aralığı. RGB: duvar beyazı (köşe rengiyle çarpılır) ve gömülü derinlik gölgeleri (pencere
// girintisi, söve, denizlik, döşeme bandı), A: cam maskesi (yansıma ve gece ışığı). Maske ayrı tuvalde çizilip birleştirilir
// (tuval alfası önçarpımlı olduğu için RGB bozulmasın diye DataTexture).
// 0 sıva + pencere, 1 balkonlu, 2 cam giydirme, 3 bant pencere, 4 taş / tarihi, 5 sanayi paneli (bütün yükseklik tek karo),
// 6 dükkân (zemin kat), 7 düz çatı (membran), 8 kiremit, 9 sera camı, 10 taş kaplama ofis, 11 eski ev (kepenkli), 12 tuğla,
// 13 yeni konut, 14 metal çatı (kenet), 15 güneş paneli.
export const ATLAS_N = 4;
function facadeAtlas() {
  const T = 256, N = ATLAS_N, S = T * N;
  const mk = () => { const c = document.createElement('canvas'); c.width = S; c.height = S; return c; };
  const ca = mk(), cm = mk(), g = ca.getContext('2d'), m = cm.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tile = (k, fn) => { for (const q of [g, m]) { q.save(); q.translate((k % N) * T, Math.floor(k / N) * T); q.beginPath(); q.rect(0, 0, T, T); q.clip(); } fn(); g.restore(); m.restore(); };
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const M = (x, y, w, h, v = 1) => { const k = Math.round(v * 255); m.fillStyle = `rgb(${k},${k},${k})`; m.fillRect(x, y, w, h); };
  const vgrad = (x, y, w, h, stops) => { const gr = g.createLinearGradient(0, y, 0, y + h); stops.forEach(([t, c]) => gr.addColorStop(t, c)); g.fillStyle = gr; g.fillRect(x, y, w, h); };
  // sıva: düşük frekanslı, düşük genlikli lekeler (yüksek frekanslı gürültü uzakta karıncalanır)
  const stucco = (amt, n = 26) => { for (let i = 0; i < n; i++) { const x = rnd() * T, y = rnd() * T, r = 24 + rnd() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r); const c = rnd() < 0.5 ? '0,0,0' : '255,255,255'; gr.addColorStop(0, `rgba(${c},${amt * rnd()})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } };
  const wall = (c = '#f6f5f2', amt = 0.05) => { R(0, 0, T, T, c); stucco(amt); };
  // döşeme bandı (karonun altı = kat seviyesi): üstte ışık, altta gölge çizgisi
  const slab = (y = 236, c = '#e4e1dc') => { R(0, y, T, T - y, c); R(0, y, T, 2, 'rgba(255,255,255,0.7)'); R(0, T - 3, T, 3, 'rgba(0,0,0,0.10)'); };
  const glass = (x, y, w, h, a = ['#9cb0c0', '#5a6c7a', '#36424c']) => { vgrad(x, y, w, h, [[0, a[0]], [0.55, a[1]], [1, a[2]]]); M(x, y, w, h, 1); };
  // girinti: üstte ve solda gölge, sağda ve altta ışık (güneş sol üstten)
  const opening = (x, y, w, h, d = 10) => {
    R(x, y, w, h, '#a8a59e');
    vgrad(x, y, w, d * 1.4, [[0, 'rgba(40,38,36,0.85)'], [1, 'rgba(70,68,64,0.35)']]);
    R(x, y, Math.round(d * 0.7), h, 'rgba(60,58,55,0.45)');
    R(x + w - Math.round(d * 0.7), y, Math.round(d * 0.7), h, 'rgba(255,255,255,0.35)');
  };
  // pencere: girinti + çerçeve + cam + kayıt
  const window_ = (x, y, w, h, o = {}) => {
    const d = o.d || 10, fr = o.fr || 6, fc = o.fc || '#f4f4f2';
    opening(x, y, w, h, d);
    const ix = x + Math.round(d * 0.7), iy = y + Math.round(d * 0.9), iw = w - Math.round(d * 1.4), ih = h - Math.round(d * 0.9);
    R(ix, iy, iw, ih, fc);
    glass(ix + fr, iy + fr, iw - fr * 2, ih - fr * 2, o.ga);
    const mul = o.mul == null ? 1 : o.mul;
    for (let k = 1; k <= mul; k++) { const xx = ix + Math.round(iw * k / (mul + 1)) - fr / 2; R(xx, iy, fr, ih, fc); M(xx, iy, fr, ih, 0); }
    if (o.tr) { const yy = iy + Math.round(ih * o.tr); R(ix, yy, iw, fr, fc); M(ix, yy, iw, fr, 0); }
    if (o.sill !== false) { R(x - 6, y + h, w + 12, 7, '#f7f6f3'); R(x - 6, y + h + 7, w + 12, 5, 'rgba(0,0,0,0.16)'); }
  };
  // 0 sıva + iki kanatlı pencere (panjur kutusu)
  tile(0, () => { wall(); slab(); window_(70, 44, 116, 152, { mul: 1 }); R(77, 53, 102, 12, '#d9d6d0'); M(77, 53, 102, 12, 0); });
  // 1 balkon: üstteki balkonun gölgesi, geniş kapı + pencere, korkuluk, öne çıkan döşeme
  tile(1, () => {
    wall(); vgrad(0, 0, T, 22, [[0, 'rgba(0,0,0,0.38)'], [1, 'rgba(0,0,0,0)']]);
    window_(20, 28, 216, 196, { mul: 2, d: 12, sill: false });
    R(0, 222, T, 34, '#fbfaf8'); R(0, 222, T, 3, '#ffffff'); R(0, 252, T, 4, 'rgba(0,0,0,0.25)');
    R(0, 152, T, 5, '#5c6064'); M(0, 152, T, 5, 0);
    for (let x = 4; x < T; x += 11) { R(x, 157, 3, 65, 'rgba(70,74,78,0.95)'); M(x, 157, 3, 65, 0); }
  });
  // 2 cam giydirme: görüş camı, döşeme önünde opak bant (spandrel), alüminyum dikmeler
  tile(2, () => {
    vgrad(0, 0, T, 190, [[0, '#b4c4d0'], [0.4, '#7a8e9c'], [1, '#56646e']]); M(0, 0, T, 190, 1);
    R(0, 190, T, 52, '#4e5a62'); R(0, 190, T, 3, 'rgba(255,255,255,0.25)');
    R(0, 242, T, 14, '#b9c0c6'); R(0, 0, 4, T, '#aeb6bc'); R(T - 4, 0, 4, T, '#aeb6bc'); R(126, 0, 4, T, '#aeb6bc');
    M(0, 0, 4, T, 0); M(T - 4, 0, 4, T, 0); M(126, 0, 4, T, 0);
  });
  // 3 bant pencere (okul, hastane, yeni yapı)
  tile(3, () => {
    wall('#f3f2ef', 0.04); slab(226);
    opening(0, 62, T, 124, 9); glass(0, 72, T, 114);
    for (let x = 0; x < T; x += 64) { R(x, 70, 6, 116, '#e2e2e0'); M(x, 70, 6, 116, 0); }
    R(0, 186, T, 8, '#f8f8f6'); R(0, 194, T, 5, 'rgba(0,0,0,0.14)');
  });
  // 4 taş: sıra derzleri, kemerli pencere, kilit taşı, kat silmesi
  tile(4, () => {
    wall('#f2ede4', 0.07);
    g.fillStyle = 'rgba(0,0,0,0.07)'; for (let y = 0; y < T; y += 32) { g.fillRect(0, y, T, 2); for (let x = (y / 32) % 2 * 40; x < T; x += 80) g.fillRect(x, y, 2, 32); }
    const x = 86, w = 84, top = 56, bot = 204;
    g.fillStyle = 'rgba(40,36,30,0.55)'; g.beginPath(); g.moveTo(x - 10, bot); g.lineTo(x - 10, top + w / 2); g.arc(x + w / 2, top + w / 2, w / 2 + 10, Math.PI, 0); g.lineTo(x + w + 10, bot); g.fill();
    g.fillStyle = '#e8e1d4'; g.beginPath(); g.moveTo(x - 4, bot); g.lineTo(x - 4, top + w / 2); g.arc(x + w / 2, top + w / 2, w / 2 + 4, Math.PI, 0); g.lineTo(x + w + 4, bot); g.fill();
    g.save(); g.beginPath(); g.moveTo(x + 6, bot); g.lineTo(x + 6, top + w / 2); g.arc(x + w / 2, top + w / 2, w / 2 - 6, Math.PI, 0); g.lineTo(x + w - 6, bot); g.clip();
    glass(x, top, w, bot - top); R(x + w / 2 - 3, top, 6, bot - top, '#e8e1d4'); g.restore();
    // maske de kemer biçiminde
    M(x, top, w, bot - top, 0); m.fillStyle = '#fff'; m.beginPath(); m.moveTo(x + 6, bot); m.lineTo(x + 6, top + w / 2); m.arc(x + w / 2, top + w / 2, w / 2 - 6, Math.PI, 0); m.lineTo(x + w - 6, bot); m.fill(); M(x + w / 2 - 3, top, 6, bot - top, 0);
    R(x + w / 2 - 8, top - 12, 16, 16, '#fbf8f1');
    R(x - 14, bot, w + 28, 8, '#fbf8f1'); R(x - 14, bot + 8, w + 28, 5, 'rgba(0,0,0,0.2)');
    R(0, 236, T, 20, '#f7f3ea'); R(0, 236, T, 3, '#ffffff'); R(0, 252, T, 4, 'rgba(0,0,0,0.18)');
  });
  // 5 sanayi paneli (bütün duvar boyu tek karo): yumuşak trapez nervürler, üstte ışık bandı, altta beton süpürgelik
  tile(5, () => {
    R(0, 0, T, T, '#f2f2f1');
    for (let x = 0; x < T; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.10)'); g.fillStyle = gr; g.fillRect(x, 0, 32, T); }
    R(0, 0, T, 10, 'rgba(0,0,0,0.12)');
    opening(8, 30, 240, 30, 5); glass(12, 34, 232, 26, ['#a6b6c2', '#7d8e9a', '#62707a']);
    for (let x = 12; x < T; x += 58) { R(x, 34, 4, 26, '#d8dadc'); M(x, 34, 4, 26, 0); }
    R(0, 222, T, 34, '#c9c7c2'); R(0, 222, T, 3, 'rgba(255,255,255,0.4)');
  });
  // 6 dükkân: tabela bandı, vitrin, kapı
  tile(6, () => {
    wall('#f2f1ee', 0.04); R(0, 18, T, 46, '#40444a'); R(0, 18, T, 3, 'rgba(255,255,255,0.3)'); R(0, 61, T, 4, 'rgba(0,0,0,0.3)');
    R(26, 32, 110, 16, 'rgba(238,236,230,0.85)');
    opening(8, 72, 240, 160, 8); glass(14, 80, 228, 152, ['#8ea2b0', '#566673', '#3a4550']);
    R(14, 80, 4, 152, '#303438'); R(238, 80, 4, 152, '#303438'); R(150, 80, 5, 152, '#303438'); M(150, 80, 5, 152, 0);
    R(0, 232, T, 24, '#9c9a96'); R(0, 232, T, 3, 'rgba(255,255,255,0.35)');
  });
  // 7 düz çatı: açık gri membran, belli belirsiz ek yerleri
  tile(7, () => {
    R(0, 0, T, T, '#dededb'); stucco(0.07, 40);
    g.fillStyle = 'rgba(0,0,0,0.05)'; for (let k = 0; k < T; k += 64) { g.fillRect(k, 0, 2, T); g.fillRect(0, k, T, 2); }
  });
  // 8 kiremit: sıralar (üst ışık, alt gölge), dalgalı oluklar
  tile(8, () => {
    for (let y = 0; y < T; y += 32) {
      vgrad(0, y, T, 32, [[0, '#fbfbfb'], [0.7, '#dcdcdc'], [1, '#8c8c8c']]);
      for (let x = ((y / 32) % 2) * 11; x < T; x += 22) { const gr = g.createLinearGradient(x, 0, x + 22, 0); gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(x, y, 22, 32); }
    }
    stucco(0.06, 20);
  });
  // 9 sera: süt beyazı paneller, ince alüminyum kayıtlar (düzenli, gürültüsüz)
  tile(9, () => {
    vgrad(0, 0, T, T, [[0, '#f4f7f8'], [1, '#dfe6e8']]);
    g.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = 0; x < T; x += 64) g.fillRect(x + 6, 0, 18, T);
    g.fillStyle = '#b9c2c6'; for (let x = 0; x < T; x += 64) g.fillRect(x, 0, 3, T); for (let y = 0; y < T; y += 128) g.fillRect(0, y, T, 3);
  });
  // 10 taş kaplama ofis: derin girintili dikey pencereler
  tile(10, () => {
    wall('#e6e3de', 0.06); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, 2, T); g.fillRect(0, 126, T, 2);
    window_(40, 22, 176, 188, { mul: 1, d: 16, fr: 5, fc: '#9aa0a6', sill: false, ga: ['#8ea0ae', '#4e5e6a', '#2e3840'] });
    R(30, 210, 196, 6, 'rgba(0,0,0,0.12)'); slab(238, '#dcd9d3');
  });
  // 11 eski ev: uzun dar pencere, ahşap kepenkler, saçak gölgesi
  tile(11, () => {
    wall('#f7f5f0', 0.08); vgrad(0, 0, T, 16, [[0, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]);
    window_(94, 40, 68, 168, { mul: 0, tr: 0.32, d: 8, fr: 5, fc: '#efe9de' });
    for (const sx of [62, 164]) { R(sx, 40, 30, 168, '#6f7d6c'); for (let y = 46; y < 204; y += 9) R(sx + 3, y, 24, 3, 'rgba(0,0,0,0.25)'); R(sx + 30, 40, 3, 168, 'rgba(0,0,0,0.25)'); }
    slab(240, '#ebe7df');
  });
  // 12 tuğla: harç derzleri, beton lento, beyaz çerçeveli pencere
  tile(12, () => {
    R(0, 0, T, T, '#b86a4e');
    for (let y = 0; y < T; y += 16) { for (let x = ((y / 16) % 2) * 24; x < T + 48; x += 48) { const v = rnd() * 0.16 - 0.08; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(x - 48 + 2, y + 2, 44, 12); } }
    g.fillStyle = 'rgba(225,215,200,0.55)'; for (let y = 0; y < T; y += 16) { g.fillRect(0, y, T, 2); for (let x = ((y / 16) % 2) * 24; x < T; x += 48) g.fillRect(x, y, 2, 16); }
    R(62, 34, 132, 14, '#d6d1c8'); R(62, 48, 132, 4, 'rgba(0,0,0,0.25)');
    window_(70, 52, 116, 144, { mul: 1, fc: '#f2f2f0' });
  });
  // 13 yeni konut: iki geniş pencere, renkli dolgu paneli, belirgin döşeme bandı
  tile(13, () => {
    wall('#f8f8f6', 0.04);
    R(122, 30, 12, 180, '#d4d2cc');
    window_(14, 32, 104, 176, { mul: 1, d: 8, fr: 5, sill: false, fc: '#e6e8ea' });
    window_(138, 32, 104, 176, { mul: 0, tr: 0.7, d: 8, fr: 5, sill: false, fc: '#e6e8ea' });
    R(0, 214, T, 42, '#d8dbdd'); R(0, 214, T, 3, 'rgba(255,255,255,0.8)'); R(0, 252, T, 4, 'rgba(0,0,0,0.15)');
  });
  // 14 metal çatı: kenetli dikiş çizgileri (eğim boyunca), çok hafif
  tile(14, () => {
    R(0, 0, T, T, '#e6e8ea');
    for (let x = 0; x < T; x += 32) { R(x, 0, 3, T, 'rgba(255,255,255,0.55)'); R(x + 3, 0, 2, T, 'rgba(0,0,0,0.12)'); }
    stucco(0.04, 14);
  });
  // 15 güneş paneli (su ısıtıcısı): alüminyum çerçeve, koyu mavi hücreler
  tile(15, () => {
    R(0, 0, T, T, '#c8ccd0'); vgrad(10, 10, T - 20, T - 20, [[0, '#3a5278'], [1, '#18243a']]); M(10, 10, T - 20, T - 20, 1);
    g.fillStyle = 'rgba(150,170,200,0.35)'; for (let k = 10; k < T - 10; k += 30) { g.fillRect(k, 10, 2, T - 20); g.fillRect(10, k, T - 20, 2); }
  });
  // birleştir: RGB albedo + A maske, dikeyde çevir (v = 0 altta)
  const A = g.getImageData(0, 0, S, S).data, B = m.getImageData(0, 0, S, S).data;
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    const so = y * S * 4, d = (S - 1 - y) * S * 4;
    for (let x = 0; x < S * 4; x += 4) { out[d + x] = A[so + x]; out[d + x + 1] = A[so + x + 1]; out[d + x + 2] = A[so + x + 2]; out[d + x + 3] = B[so + x]; }
  }
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
// Bina malzemesi: tek atlas, tek program. Köşe özniteliği `st` stili seçer (0-15 karo, +16 zemin katı dükkân, 32-38 yol,
// 40 düz duvar, 41 saçak silmesi). Cephe ayrıntısı gölgelendiricide: kat/pencere ızgarası, cam yansıması (gökyüzü/yer),
// gece pencere ışıkları (uNight ya da güneş kararınca kendiliğinden), parlaklıktan kabartma (yakında), zemin ortam kapatması.
export function buildingMaterial(skyCol) {
  const atlas = facadeAtlas();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const night = { value: 0 };
  mat.userData.night = night;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.atlas = { value: atlas }; sh.uniforms.skyRef = { value: skyCol || new THREE.Color(0.55, 0.68, 0.82) }; sh.uniforms.uNight = night;
    sh.vertexShader = 'attribute float st; varying vec2 vB; varying float vSt;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vB = uv / 16.0; vSt = st;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n if (st > 31.5 && st < 39.5) gl_Position.z -= 2.6e-6 * gl_Position.w;');
    sh.fragmentShader = `uniform sampler2D atlas; uniform vec3 skyRef; uniform float uNight; varying vec2 vB; varying float vSt;
      float gGlass = 0.0, gLit = 0.0, gHgt = 0.0, gBump = 0.0; vec3 gLitC = vec3(0.0);
      float hb(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      vec4 atl(float tl, vec2 f, vec2 gx, vec2 gy) {
        vec2 off = vec2(mod(tl, ${ATLAS_N}.0), ${ATLAS_N - 1}.0 - floor(tl / ${ATLAS_N}.0)) / ${ATLAS_N}.0;
        return textureGrad(atlas, off + (f * 0.96 + 0.02) / ${ATLAS_N}.0, gx * ${(0.96 / ATLAS_N).toFixed(4)}, gy * ${(0.96 / ATLAS_N).toFixed(4)});
      }
      vec3 bumpN(vec3 p, vec3 n, vec2 dh, float fd) {
        vec3 sx = normalize(dFdx(p)), sy = normalize(dFdy(p));
        vec3 r1 = cross(sy, n), r2 = cross(n, sx);
        float det = dot(sx, r1) * fd;
        return normalize(abs(det) * n - sign(det) * (dh.x * r1 + dh.y * r2));
      }
      ` + sh.fragmentShader.replace('#include <color_fragment>', `
      vec2 dBx = dFdx(vB), dBy = dFdy(vB);
      float fw = max(length(dBx), length(dBy));            // piksel başına hücre
      vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      bool isWall = abs(dot(normalize(vNormal), upV)) < 0.5;
      float stf = floor(vSt + 0.5);
      vec3 bc = vColor;
      vec3 col;
      if (stf > 31.5 && stf < 39.5) {
        // yol: asfalt, kenar çizgileri, kesikli orta / şerit çizgisi
        float cls = stf - 32.0;
        float hw = cls < 1.5 ? 5.5 : cls < 3.5 ? 4.5 : cls < 4.5 ? 3.75 : 3.25;
        float xm = vB.x * hw, ax = abs(xm), along = vB.y;
        float aw = max((abs(dBx.x) + abs(dBy.x)) * hw, 0.02), vis = clamp(0.35 / aw, 0.0, 1.0);
        float n1 = hb(floor(vec2(xm * 2.0, along * 0.5))), n2 = hb(floor(vec2(along * 0.05, 3.0)));
        vec3 asph = vec3(0.075, 0.076, 0.08) * (0.85 + 0.15 * n1) * (0.9 + 0.2 * n2);
        asph *= 1.0 - 0.12 * smoothstep(0.4, 0.0, abs(ax - hw * 0.5));
        float ln = 0.0;
        if (cls < 4.5) ln += clamp(1.0 - abs(ax - (hw - 0.45)) / (0.12 + aw), 0.0, 1.0);
        float dash = cls < 1.5 ? step(mod(along, 12.0), 4.0) : step(mod(along, 9.0), 3.0);
        ln += clamp(1.0 - ax / (0.08 + aw), 0.0, 1.0) * dash;
        col = mix(asph, vec3(0.80, 0.80, 0.78), clamp(ln, 0.0, 1.0) * vis);
      } else if (stf > 39.5) {
        // düz duvar (çatı kulübesi, kalkan) ve saçak silmesi
        col = bc * (stf > 40.5 ? 1.04 : 0.97);
      } else {
        float shop = step(15.5, stf); float tl = stf - shop * 16.0;
        vec2 cell = floor(vB), f = fract(vB);
        bool fac = tl < 6.5 || (tl > 9.5 && tl < 13.5);
        if (shop > 0.5 && cell.y > -0.5 && cell.y < 0.5) tl = 6.0;
        vec4 tx = atl(tl, f, dBx, dBy);
        if (fac && isWall && cell.y < -0.5 && tl != 5.0) tx = vec4(0.80, 0.79, 0.77, 0.0);   // bodrum / temel
        float r = hb(cell + vec2(tl * 7.0, 0.0)), r2 = hb(cell * 1.37 + vec2(3.1, tl));
        float gm = tx.a;
        // kepenk / perde: bazı pencerelerin üstü kapalı
        if ((tl < 1.5 || tl == 11.0 || tl == 13.0) && r2 > 0.9 && f.y > 0.5) { gm *= 0.0; tx.rgb = mix(tx.rgb, vec3(0.86, 0.84, 0.8), tx.a); }
        float tint = tl == 2.0 ? 0.9 : 0.2;
        vec3 gl = tx.rgb * mix(vec3(1.0), bc * 1.2, tint) * (0.82 + 0.36 * r);
        gl = mix(gl, vec3(0.74, 0.71, 0.64), step(0.84, r) * (tl == 2.0 ? 0.15 : 0.5));
        col = mix(bc * tx.rgb, gl, gm);
        gGlass = gm * (tl == 9.0 ? 0.0 : 1.0);
        if (fac) {
          float litF = (tl == 2.0 || tl == 3.0 || tl == 10.0) ? 0.32 : tl == 6.0 ? 0.85 : 0.42;
          float on = step(r2, litF) * (0.6 + 0.8 * hb(cell + 5.7));
          gLit = gm * mix(on, litF, smoothstep(0.25, 1.0, fw));
          gLitC = (tl == 2.0 || tl == 3.0 || tl == 10.0) ? vec3(0.80, 0.88, 1.0) : tl == 6.0 ? vec3(1.0, 0.86, 0.62) : mix(vec3(1.0, 0.70, 0.40), vec3(1.0, 0.88, 0.66), hb(cell + 9.1));
        }
        // zemin ortam kapatması: kat koordinatıyla (sanayi ve serada bütün duvar tek karo)
        if (isWall) { float ao = (tl == 5.0 || tl == 9.0) ? smoothstep(-0.08, 0.28, vB.y) : smoothstep(-0.55, 0.85, vB.y); col *= 0.6 + 0.4 * ao; }
        gHgt = dot(tx.rgb, vec3(0.333)) - gm * 0.25;
        gBump = isWall && fac ? 1.0 - smoothstep(0.035, 0.12, fw) : 0.0;
      }
      vec2 gdH = vec2(dFdx(gHgt), dFdy(gHgt)) * gBump * 1.6;
      diffuseColor.rgb *= col;
      `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (gBump > 0.001) normal = bumpN(-vViewPosition, normal, gdH, faceDirection);
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float nightF = uNight;
        #if NUM_DIR_LIGHTS > 0
          nightF = max(nightF, 1.0 - smoothstep(0.35, 1.3, dot(directionalLights[0].color, vec3(0.2126, 0.7152, 0.0722))));
        #endif
        vec3 vd = normalize(vViewPosition);
        float fr = pow(1.0 - clamp(abs(dot(vd, normal)), 0.0, 1.0), 3.0);
        float ry = dot(reflect(-vd, normal), upV);
        vec3 env = mix(vec3(0.16, 0.16, 0.15), skyRef, smoothstep(-0.06, 0.2, ry));
        totalEmissiveRadiance += gGlass * env * (0.05 + 0.6 * fr) * (1.0 - 0.85 * nightF);
        totalEmissiveRadiance += gLit * gLitC * nightF * 1.1;
      }`);
  };
  mat.customProgramCacheKey = () => 'bina-atlas-2';
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
