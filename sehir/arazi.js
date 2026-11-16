/* Açık dünya: 32 km × 32 km (yaklaşık İstanbul ölçeği), parça parça üretilen arazi.
   Ortada yeşil vadi (başlangıç: nehirler, göller, korular, taşlıklar), çevresinde orman (kuzey), çöl (doğu), karlı dağlar (batı), kızıl diyar (güney).
   Arazi tek bir yükseklik işlevinden (yukseklikF) gelir; hiçbir şey önceden saklanmaz, oyuncunun çevresi üretilir, uzaklaşınca atılır.
   Üç ayrıntı düzeyi: yakın (128 m parça, 4 m ızgara), orta (512 m, 16 m), uzak (2 km, 64 m). Kaba parça, 16 ince çocuğu hazır olunca gizlenir.
   Nesneler (ağaç, kaya, kaktüs...) 256 m'lik hücrelerde, tohumlu rastgele; yaklaşık 520 m'den yakınken çizilir ve uzakta küçülerek kaybolur.
   Gizleme: görüş alanı dışı + sis mesafesi + "tepenin arkası" (kameradan hücreye giden doğrular araziyle kesiliyorsa o hücre çizilmez).
   SO.world: build, update(cam), groundY, destekY, suDerinlik, collide, inside, basamak, zemin, ortam, biyom, renk, solids, HALF, start. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, S = Cizim, TAU = Math.PI * 2, rnd = SO.rnd, clamp = SO.clamp, lerp = SO.lerp;
  const HALF = 16000, INK = 0x15120d, SU = 0, GR = SO.gorunum; // GR: görünüm (gorunum.js): malzemeler, dokular, köşe öznitelikleri, çim, gök
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hash(ix, iz, s) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz), a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
  function fbm(x, z, s, oct) { let v = 0, a = .5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, z * f, s + i * 17); n += a; a *= .5; f *= 2; } return v / n; }

  /* ---------- biyomlar ve yükseklik ---------- */
  const BIYOM = ['vadi', 'orman', 'col', 'kar', 'kizil'];
  const RENK = { vadi: '#8e9a5e', orman: '#6b7c45', col: '#e0c79a', kar: '#eef1ec', kizil: '#a8503a' }, KAYA = { vadi: '#978c78', orman: '#8a826f', col: '#c9a074', kar: '#93a0a8', kizil: '#5a2b2e' };
  const start = { x: 0, z: 0 };
  const TS = SO.tasarim || null; // elle tasarım katmanı (varsa): yukseklik(x,z,h), yerlesim(px,pz,d), ekNesneler(ci,cj,HUCRE), dogus
  function agirlik(x, z, out) { // [vadi (orta), orman (kuzey), çöl (doğu), kar (batı), kızıl (güney)], toplam 1
    const wx = x + (fbm(x / 3000, z / 3000, 5, 3) - .5) * 5200, wz = z + (fbm(x / 3000, z / 3000, 9, 3) - .5) * 5200, r = Math.hypot(wx, wz), th = Math.atan2(wx, -wz);
    const m = 1 - sm(3800, 5200, r), sek = c => 1 - sm(.42, .58, Math.abs(SO.wrapA(th - c)) / (Math.PI / 2)), k = 1 - m;
    out[0] = m; out[1] = k * sek(0); out[2] = k * sek(Math.PI / 2); out[3] = k * sek(-Math.PI / 2); out[4] = k * sek(Math.PI); return out;
  }
  const W = [0, 0, 0, 0, 0];
  function yukseklikF(x, z) {
    const w = agirlik(x, z, W), cont = fbm(x / 5200, z / 5200, 1, 3), rid = 1 - Math.abs(2 * fbm(x / 1300, z / 1300, 2, 3) - 1), hill = fbm(x / 420, z / 420, 3, 3), det = fbm(x / 70, z / 70, 4, 3);
    let h = 0;
    if (w[0] > 0) h += w[0] * (12 + cont * 12 + Math.pow(rid, 1.8) * 115 + (hill - .5) * 60 + (fbm(x / 170, z / 170, 14, 2) - .5) * 18 + (det - .5) * 3 + (fbm(x / 19, z / 19, 15, 2) - .5) * 1.1);
    if (w[1] > 0) h += w[1] * (18 + cont * 30 + Math.pow(rid, 1.8) * 115 + (hill - .5) * 42 + (det - .5) * 4);
    if (w[2] > 0) h += w[2] * (12 + cont * 14 + (1 - Math.abs(2 * fbm(x / 160, z / 160, 6, 2) - 1)) * 14 + sm(.6, .68, fbm(x / 900, z / 900, 7, 2)) * 58 + (det - .5) * 2);
    if (w[3] > 0) h += w[3] * (60 + cont * 120 + Math.pow(rid, 1.5) * 430 + (hill - .5) * 70 + (det - .5) * 8);
    if (w[4] > 0) { const tv = fbm(x / 800, z / 800, 8, 3) * 6; h += w[4] * (22 + (Math.floor(tv) + sm(.75, 1, tv % 1)) * 15 + Math.pow(rid, 3) * 60 + (det - .5) * 4); }
    // nehir vadileri ve göller (vadi ve ormanda tam, kızıl diyarda yarım): arazi nehre doğru alçalır, yatak deniz seviyesinin altına iner
    const rw = w[0] + w[1] + w[4] * .5;
    if (rw > .01) { const rv = Math.abs(fbm(x / 1150, z / 1150, 11, 2) - .5), vad = Math.pow(sm(0, .13, rv), .8), lk = sm(.63, .76, fbm(x / 600, z / 600, 12, 2));
      let hr = 1.6 + (h - 1.6) * vad; hr = lerp(hr, -2.8, 1 - sm(.004, .017, rv)); hr = lerp(hr, -3.6, lk * (1 - sm(25, 70, h))); h = lerp(h, hr, rw); }
    // kıyı: dünyanın kenarına doğru denize iner
    const kenar = Math.max(Math.abs(x), Math.abs(z)) + (fbm(x / 1500, z / 1500, 13, 2) - .5) * 1800; h = lerp(h, -40, sm(HALF - 2600, HALF - 500, kenar));
    if (TS && TS.yukseklik) return TS.yukseklik(x, z, h); // elle tasarım katmanı (tasarim.js): tasarlanmış bölgelerde yüksekliği biçimlendirir
    const ds = Math.hypot(x - start.x, z - start.z); if (ds < 60) h = lerp(h, start.h, 1 - sm(22, 60, ds)); // başlangıç düzlüğü
    return h;
  }
  function biyom(x, z) { const w = agirlik(x, z, [0, 0, 0, 0, 0]); let b = 0; for (let i = 1; i < 5; i++) if (w[i] > w[b]) b = i; return BIYOM[b]; }

  /* ---------- yardımcılar ---------- */
  let scene, maxAniso = 4;
  function canvasOf(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return c; }
  const UP = new T3.Vector3(0, 1, 0), SUN = new T3.Vector3(-.5, .8, .35).normalize();
  const mat4 = (x, y, z, ry, s, sy) => new T3.Matrix4().compose(new T3.Vector3(x, y, z), new T3.Quaternion().setFromAxisAngle(UP, ry || 0), new T3.Vector3(s || 1, (sy || s || 1), s || 1));
  const mrot = (x, y, z, rx, ry, rz) => new T3.Matrix4().compose(new T3.Vector3(x, y, z), new T3.Quaternion().setFromEuler(new T3.Euler(rx || 0, ry || 0, rz || 0)), new T3.Vector3(1, 1, 1));
  function partsToGeo(parts, outline) { // parça: { geo, m, lt, dk, center, r, tall }
    const pos = [], col = [], a = new T3.Vector3(), b = new T3.Vector3(), c = new T3.Vector3(), n = new T3.Vector3(), cl = new T3.Color(), cd = new T3.Color();
    parts.forEach(p => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); g.applyMatrix4(p.m); const A = g.attributes.position.array;
      if (outline) { const k = 1 + outline / p.r; for (let i = 0; i < A.length; i += 3) { A[i] = p.center.x + (A[i] - p.center.x) * k; A[i + 1] = p.center.y + (A[i + 1] - p.center.y) * (p.tall ? 1.004 : k); A[i + 2] = p.center.z + (A[i + 2] - p.center.z) * k; } }
      cl.set(p.lt); cd.set(p.dk);
      for (let i = 0; i < A.length; i += 9) { a.set(A[i], A[i + 1], A[i + 2]); b.set(A[i + 3], A[i + 4], A[i + 5]); c.set(A[i + 6], A[i + 7], A[i + 8]); n.copy(b).sub(a).cross(c.clone().sub(a)).normalize(); const lit = n.dot(SUN) > .12 ? cl : cd; for (let k = 0; k < 9; k++) pos.push(A[i + k]); for (let k = 0; k < 3; k++) col.push(lit.r, lit.g, lit.b); }
      g.dispose(); });
    const out = new T3.BufferGeometry(); out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); if (!outline) out.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); return out;
  }
  const part = (geo, m, lt, dk, cx, cy, cz, r, tall) => ({ geo, m, lt, dk, center: new T3.Vector3(cx, cy, cz), r, tall });
  function blob(rad, sd, sq, det) { const g = new T3.IcosahedronGeometry(rad, det == null ? 1 : det), A = g.attributes.position.array; for (let k = 0; k < A.length; k += 3) { const h = Math.sin(A[k] * 12.9898 + A[k + 1] * 78.233 + A[k + 2] * 37.719 + sd) * 43758.5453, j = 1 + ((h - Math.floor(h)) - .5) * .24; A[k] *= j; A[k + 1] *= j * (sq || .86); A[k + 2] *= j; } return g; }

  /* ---------- nesne türleri ---------- */
  function yaprakli(sd) { const r = rnd(sd), h = 3.2 + r() * 1.4, P = [part(new T3.CylinderGeometry(.16, .27, h, 7), mat4(0, h / 2, 0), '#7a4e27', '#55351a', 0, h / 2, 0, .22, true)];
    [[0, h + .5, 0, 1.75], [-1.15, h - .25, .25, 1.2], [1.1, h - .15, -.3, 1.25], [.15, h + 1.55, .1, 1.15], [0, h - .15, 1.0, 1.05]].forEach(([x, y, z, rad], i) => P.push(part(blob(rad, sd + i, .86, i === 0 ? 1 : 0), mat4(x, y, z, r() * TAU), i % 2 ? '#7d8a4a' : '#6f8046', i % 2 ? '#4f5f31' : '#46562b', x, y, z, rad))); return P; }
  function cam(sd, karli) { const r = rnd(sd), h = 1.6 + r() * .5, lt = karli ? '#eef2ee' : '#587552', dk = karli ? '#8fa79b' : '#36503c', P = [part(new T3.CylinderGeometry(.14, .22, h, 6), mat4(0, h / 2, 0), '#6b4423', '#4a2e17', 0, h / 2, 0, .2, true)];
    [[1.7, 2.6, 0], [1.3, 2.3, 1.5], [.9, 2.0, 2.9], [.5, 1.5, 4.0]].forEach(([rad, hh, y], i) => P.push(part(new T3.ConeGeometry(rad, hh, 8), mat4(0, h + y + hh / 2 - .5, 0, r() * TAU), i % 2 && karli ? '#dfe7e2' : lt, dk, 0, h + y + hh / 2 - .5, 0, rad * .8))); return P; }
  function cali(sd) { const r = rnd(sd); return [[0, .5, 0, .8], [.6, .4, .2, .55], [-.55, .38, -.15, .5]].map(([x, y, z, rad], i) => part(blob(rad, sd + i, .8), mat4(x, y, z, r() * TAU), '#7d8a4a', '#4f5f31', x, y, z, rad)); }
  function kaya(sd, lt, dk) { const r = rnd(sd); return [[0, .55, 0, 1.1, .7], [.9, .35, .3, .6, .75], [-.7, .3, -.4, .5, .8]].map(([x, y, z, rad, sq], i) => { const g = new T3.IcosahedronGeometry(rad, 0), A = g.attributes.position.array; for (let k = 0; k < A.length; k += 3) { const h = Math.sin(A[k] * 91.7 + A[k + 1] * 47.3 + A[k + 2] * 13.1 + sd + i) * 43758.5453, j = 1 + ((h - Math.floor(h)) - .5) * .5; A[k] *= j; A[k + 1] *= j * sq; A[k + 2] *= j; } return part(g, mat4(x, y, z, r() * TAU), lt, dk, x, y, z, rad); }); }
  function kaktus() { const lt = '#7a9a62', dk = '#4b6a44', P = [part(new T3.CylinderGeometry(.3, .36, 3.4, 8), mat4(0, 1.7, 0), lt, dk, 0, 1.7, 0, .33, true), part(new T3.SphereGeometry(.3, 8, 5), mat4(0, 3.4, 0), lt, dk, 0, 3.4, 0, .3)];
    [[1, 1.5, 1.3], [-1, 2.1, 1.0]].forEach(([d, y, hh]) => { P.push(part(new T3.CylinderGeometry(.2, .2, .8, 7), mrot(d * .5, y, 0, 0, 0, Math.PI / 2), lt, dk, d * .5, y, 0, .25)); P.push(part(new T3.CylinderGeometry(.2, .22, hh, 7), mat4(d * .9, y + hh / 2, 0), lt, dk, d * .9, y + hh / 2, 0, .22, true)); P.push(part(new T3.SphereGeometry(.2, 7, 4), mat4(d * .9, y + hh, 0), lt, dk, d * .9, y + hh, 0, .2)); }); return P; }
  function kristal(sd, lt, dk) { const r = rnd(sd); return [[0, 0, 0, .8, 6, 0, 0], [.9, 0, .3, .5, 3.6, .22, .3], [-.7, 0, -.4, .45, 2.8, -.28, -.2], [.2, 0, -.9, .35, 2.0, .1, -.35]].map(([x, y, z, rad, hh, rz, rx]) => part(new T3.ConeGeometry(rad, hh, 5), mrot(x, hh / 2 - .2, z, rx, r() * TAU, rz), lt, dk, x, hh / 2, z, rad * .9)); }
  function mantar(sd) { const P = [part(new T3.CylinderGeometry(.28, .42, 3.2, 8), mat4(0, 1.6, 0), '#eadcc4', '#b9a488', 0, 1.6, 0, .36, true)], cap = new T3.SphereGeometry(1.9, 10, 5, 0, TAU, 0, Math.PI / 2); cap.scale(1, .62, 1);
    P.push(part(cap, mat4(0, 3.0, 0), '#9a5cc0', '#5f3382', 0, 3.3, 0, 1.6)); P.push(part(new T3.CylinderGeometry(1.86, 1.86, .12, 10), mat4(0, 3.0, 0), '#e9d9c0', '#b9a488', 0, 3.0, 0, 1.8));
    const c2 = new T3.SphereGeometry(.9, 8, 4, 0, TAU, 0, Math.PI / 2); c2.scale(1, .62, 1); P.push(part(new T3.CylinderGeometry(.14, .2, 1.5, 6), mat4(1.3, .75, .6), '#eadcc4', '#b9a488', 1.3, .75, .6, .2, true)); P.push(part(c2, mat4(1.3, 1.4, .6), '#c06aa8', '#7a3a70', 1.3, 1.6, .6, .8)); return P; }

  // düz tepeli kaya: üstüne çıkılabilir (tırmanma için). yük: tepe yüksekliği (m), yar: yarıçap
  function duzKaya(sd, yuk, yar, lt, dk) { const g = new T3.CylinderGeometry(yar * .86, yar, yuk, 7), A = g.attributes.position.array; for (let k = 0; k < A.length; k += 3) { const h = Math.sin(A[k] * 31.7 + A[k + 2] * 17.3 + sd) * 43758.5453, j = 1 + ((h - Math.floor(h)) - .5) * .22; A[k] *= j; A[k + 2] *= j; }
    return [part(g, mat4(0, yuk / 2, 0), lt, dk, 0, yuk / 2, 0, yar, false)]; }
  const TUR = { // ad: [parça üretici, dış çizgi kalınlığı, çarpışma yarıçapı, üstüne çıkılabilir tepe yüksekliği (0 = çıkılmaz)]
    yaprakli1: [() => yaprakli(61), .05, .3, 0], yaprakli2: [() => yaprakli(73), .05, .3, 0], cam1: [() => cam(11, false), .05, .28, 0], camKar: [() => cam(12, true), .05, .28, 0], cali: [() => cali(21), .035, 0, 0],
    kaya: [() => kaya(31, '#a89f8c', '#756c5b'), .04, .72, 0], kayaCol: [() => kaya(32, '#d6b083', '#a67c52'), .04, .72, 0], kayaKar: [() => kaya(33, '#dfe6ea', '#8b9aa5'), .04, .72, 0], kayaKizil: [() => kaya(34, '#6e3438', '#3d1c20'), .04, .72, 0],
    duzAlcak: [() => duzKaya(35, .5, 1.5, '#b3aa96', '#7d7462'), .04, 1.05, .5], duzOrta: [() => duzKaya(36, 1.0, 1.7, '#a89f8c', '#756c5b'), .04, 1.18, 1.0], duzYuksek: [() => duzKaya(37, 1.8, 2.1, '#9d9482', '#6b6354'), .04, 1.45, 1.8],
    kaktus: [kaktus, .035, .4, 0], kristalPembe: [() => kristal(41, '#f07a98', '#a1335c'), .045, .7, 0], kristalTurkuaz: [() => kristal(42, '#6fe0d8', '#2a8c8a'), .045, .7, 0], mantar: [() => mantar(51), .05, .45, 0]
  };
  // biyom → (koru, taşlık) yoğunluğuna göre [tür, aday nokta başına olasılık] tablosu. koru/tas 0..1 (kümelenme gürültüsü)
  function tablo(b, koru, tas) {
    if (b === 0) return [['yaprakli1', .003 + koru * .11], ['yaprakli2', .003 + koru * .09], ['cam1', koru * .03], ['cali', .012 + koru * .03], ['kaya', .0006 + tas * .12], ['duzAlcak', tas * .03], ['duzOrta', tas * .024], ['duzYuksek', tas * .016]];
    if (b === 1) return [['yaprakli1', .03 + koru * .12], ['yaprakli2', .03 + koru * .1], ['cam1', .03 + koru * .1], ['cali', .04], ['kaya', .001 + tas * .1], ['duzOrta', tas * .016], ['duzYuksek', tas * .014]];
    if (b === 2) return [['kaktus', .006 + koru * .03], ['kayaCol', .004 + tas * .06]];
    if (b === 3) return [['camKar', koru * .09], ['kayaKar', .006 + tas * .06]];
    return [['kristalPembe', koru * .05], ['kristalTurkuaz', koru * .035], ['mantar', .004 + koru * .04], ['kayaKizil', .006 + tas * .05]];
  }

  /* ---------- arazi parçaları (üç düzey) ---------- */
  const LV = [{ size: 128, cell: 4, skirt: 6 }, { size: 512, cell: 16, skirt: 24 }, { size: 2048, cell: 64, skirt: 80 }], NC = 32, N1 = NC + 1;
  const dugum = [new Map(), new Map(), new Map()]; // düzey → 'i,j' → { i, j, lv, H (N1×N1), mesh, minY, maxY }
  const cB = BIYOM.map(b => new T3.Color(RENK[b])), cK = BIYOM.map(b => new T3.Color(KAYA[b])), kum = new T3.Color('#e3cca0'), karC = new T3.Color('#eef1ec'), tc = new T3.Color(), tk = new T3.Color(), tn = new T3.Vector3(), tw = [0, 0, 0, 0, 0];
  let yerMat;
  function uret(lv, i, j) {
    const L = LV[lv], x0 = i * L.size, z0 = j * L.size, c = L.cell, G = N1 + 2, hh = new Float32Array(G * G);
    for (let b = 0; b < G; b++) for (let a = 0; a < G; a++) hh[b * G + a] = yukseklikF(x0 + (a - 1) * c, z0 + (b - 1) * c);
    const nv = N1 * N1 + 4 * N1, pos = new Float32Array(nv * 3), A = GR.diziler(nv), H = new Float32Array(N1 * N1), idx = []; let minY = 1e9, maxY = -1e9;
    for (let b = 0; b < N1; b++) for (let a = 0; a < N1; a++) {
      const o = b * N1 + a, x = x0 + a * c, z = z0 + b * c, g = (b + 1) * G + a + 1, h = hh[g]; H[o] = h; if (h < minY) minY = h; if (h > maxY) maxY = h;
      tn.set(hh[g - 1] - hh[g + 1], 2 * c, hh[g - G] - hh[g + G]).normalize(); agirlik(x, z, tw);
      pos[o * 3] = x; pos[o * 3 + 1] = h; pos[o * 3 + 2] = z; GR.kose(A, o, x, z, h, tn, tw); // renk/doku ağırlıkları/ışık: gorunum.js
    }
    for (let b = 0; b < NC; b++) for (let a = 0; a < NC; a++) { const o = b * N1 + a; idx.push(o, o + N1, o + 1, o + 1, o + N1, o + N1 + 1); }
    // etek: komşu düzeyle arada açıklık görünmesin diye kenarlardan aşağı inen şerit
    let s = N1 * N1; const kenar = (get, ters) => { const b0 = s; for (let k = 0; k < N1; k++) { const o = get(k); pos[s * 3] = pos[o * 3]; pos[s * 3 + 1] = pos[o * 3 + 1] - L.skirt; pos[s * 3 + 2] = pos[o * 3 + 2]; GR.etekKopya(A, s, o); s++; }
      for (let k = 0; k < NC; k++) { const a = get(k), b = get(k + 1), c2 = b0 + k, d2 = b0 + k + 1; if (ters) idx.push(a, c2, b, b, c2, d2); else idx.push(a, b, c2, b, d2, c2); } };
    kenar(k => k, false); kenar(k => NC * N1 + k, true); kenar(k => k * N1, true); kenar(k => k * N1 + NC, false);
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(pos, 3)); GR.geoBagla(g, A); g.setIndex(idx);
    g.boundingSphere = new T3.Sphere(new T3.Vector3(x0 + L.size / 2, (minY + maxY) / 2, z0 + L.size / 2), Math.hypot(L.size * .71, (maxY - minY) / 2 + L.skirt));
    const m = new T3.Mesh(g, yerMat); m.matrixAutoUpdate = false; m.visible = false; scene.add(m);
    return { i, j, lv, H, mesh: m, minY, maxY, cx: x0 + L.size / 2, cz: z0 + L.size / 2, gizli: false };
  }
  function at(n) { scene.remove(n.mesh); n.mesh.geometry.dispose(); }
  // zemin yüksekliği: yakın parçanın ızgarasındaki üçgenlerden (çizilen yüzeyle birebir); parça yoksa işlevden aynı üçgenle
  const yakinOnbellek = new Map();
  function koseH(gi, gj) { const k = gi * 100003 + gj; let v = yakinOnbellek.get(k); if (v === undefined) { if (yakinOnbellek.size > 6000) yakinOnbellek.clear(); v = yukseklikF(gi * 4, gj * 4); yakinOnbellek.set(k, v); } return v; }
  function groundY(x, z) {
    const gx = x / 4, gz = z / 4, gi = Math.floor(gx), gj = Math.floor(gz), fx = gx - gi, fz = gz - gj, ci = Math.floor(gi / NC), cj = Math.floor(gj / NC), n = dugum[0].get(ci + ',' + cj);
    let h00, h10, h01, h11; if (n) { const a = (gj - cj * NC) * N1 + (gi - ci * NC); h00 = n.H[a]; h10 = n.H[a + 1]; h01 = n.H[a + N1]; h11 = n.H[a + N1 + 1]; } else { h00 = koseH(gi, gj); h10 = koseH(gi + 1, gj); h01 = koseH(gi, gj + 1); h11 = koseH(gi + 1, gj + 1); }
    return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }
  const egim = (x, z) => { const e = 2; return Math.hypot(groundY(x + e, z) - groundY(x - e, z), groundY(x, z + e) - groundY(x, z - e)) / (2 * e); };
  // kaba yükseklik (uzak düzeyin ızgarasından): "tepenin arkası" sınaması için ucuz örnekleme
  function kabaH(x, z) { const L = LV[2], i = Math.floor(x / L.size), j = Math.floor(z / L.size), n = dugum[2].get(i + ',' + j); if (!n) return -1e9; const a = clamp(Math.round((x - i * L.size) / L.cell), 0, NC), b = clamp(Math.round((z - j * L.size) / L.cell), 0, NC); return n.H[b * N1 + a]; }

  /* ---------- nesne hücreleri (256 m) ---------- */
  const HUCRE = 256, hucreler = new Map(), solids = [], geo = {}, uFar = { value: 440 }, uCam = { value: new T3.Vector3() };
  const kucul = m => { m.onBeforeCompile = s => { s.uniforms.uFar = uFar; s.uniforms.uCam = uCam; s.vertexShader = 'uniform float uFar; uniform vec3 uCam;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; transformed *= 1.0 - smoothstep(uFar - 90.0, uFar, distance(ip, uCam));\n#endif'); }; return m; };
  const vcMat = GR.nesneMat(uFar, uCam), hullMat = kucul(new T3.MeshBasicMaterial({ color: INK, side: T3.BackSide }));
  function hucreUret(ci, cj) {
    const R = rnd((ci * 73856093) ^ (cj * 19349663) ^ 911), x0 = ci * HUCRE, z0 = cj * HUCRE, G = {}, kutular = [], ww = [0, 0, 0, 0, 0]; let maxY = -1e9, minY = 1e9;
    const nesne = [], ekle = (tur, px, pz, h, s, ry, id) => { const T = TUR[tur], yuvarlak = tur.startsWith('kaya'); if (kaldirilan.has(id)) return;
      const L = (G[tur] = G[tur] || []); L.push(T[3] ? mat4(px, h - .15, pz, ry, s, 1 + .15 / T[3]) : mat4(px, h - .08, pz, ry, s));
      // çarpışma kutusu: görünen nesnenin içine sığan kare. Kayaların tepesine çıkılabilir (2,3 m'ye kadar).
      const cr = T[2] * s, ust = T[3] ? h + T[3] : yuvarlak ? h - .08 + 1.02 * s : h + 3, cikilir = !!T[3] || (yuvarlak && 1.02 * s <= 2.3); let kutu = null;
      if (cr > 0) { kutu = { x0: px - cr, x1: px + cr, z0: pz - cr, z1: pz + cr, top: ust, duz: cikilir }; kutular.push(kutu); }
      nesne.push({ id, tur, sinif: SINIF(tur), x: px, z: pz, h, s, kutu, sira: L.length - 1 }); if (h > maxY) maxY = h; if (h < minY) minY = h; };
    let say = -1;
    for (let z = 4; z < HUCRE; z += 8) for (let x = 4; x < HUCRE; x += 8) { say++;
      const px = x0 + x + (R() - .5) * 7, pz = z0 + z + (R() - .5) * 7, u = R(), u2 = R(), rs = R(), rr = R(); if (Math.hypot(px - start.x, pz - start.z) < 12) continue;
      const h = groundY(px, pz); if (h < .6) continue; agirlik(px, pz, ww);
      let b = 0, acc = ww[0]; while (b < 4 && u > acc) { b++; acc += ww[b]; }
      const eg = egim(px, pz);
      // taş kuralı (doğal görünüm): kayalar su kıyısında (alçak taşkın yatağı) ve dik yamaçların dibinde/üstünde toplanır; açık düzlükte neredeyse hiç olmaz
      const kiyi = (1 - sm(1.6, 6, h)) * .85, yamac = sm(.22, .5, Math.max(eg, egim(px + 9, pz + 4), egim(px - 6, pz + 8), egim(px + 3, pz - 9))), kume = .35 + .65 * sm(.4, .65, fbm(px / 90, pz / 90, 22, 2));
      const D = { b, biyom: BIYOM[b], h, egim: eg, koru: sm(.5, .68, fbm(px / 260, pz / 260, 21, 2)), tas: 0, yasak: false, tur: null, olcek: 0 };
      D.tas = b === 0 || b === 1 ? Math.max(kiyi, yamac) * kume : sm(.56, .72, fbm(px / 230, pz / 230, 22, 2));
      if (TS && TS.yerlesim) TS.yerlesim(px, pz, D); // tasarım katmanı yoğunlukları değiştirebilir, yasaklayabilir ya da türü doğrudan seçebilir
      if (D.yasak) continue;
      let tur = D.tur; if (!tur) { const tb = tablo(b, b === 1 ? .35 + D.koru * .65 : D.koru, D.tas); let t = 0; for (const [ad, p] of tb) { t += p; if (u2 < t) { tur = ad; break; } } } if (!tur || !TUR[tur]) continue;
      const T = TUR[tur], yuvarlak = tur.startsWith('kaya'), kayaMi = yuvarlak || tur.startsWith('duz'); if (eg > (kayaMi ? .9 : .5) || (T[3] && eg > .3)) continue; if (b === 3 && tur === 'camKar' && h > 260) continue;
      const s = D.olcek || (T[3] ? .9 + rs * .5 : (kayaMi ? .45 + rs * rs * 2.0 : tur === 'cali' ? .7 + rs * .7 : .85 + rs * .5) * (b === 1 && tur.startsWith('yaprakli') ? 1.2 : 1));
      ekle(tur, px, pz, h, s, rr * TAU, ci + ',' + cj + ',' + say);
    }
    // tasarım katmanının tek tek yerleştirdiği nesneler (işaret ağaçları, özel kayalar...): [{ tur, x, z, s, ry, id }]
    if (TS && TS.ekNesneler) for (const e of TS.ekNesneler(ci, cj, HUCRE) || []) if (TUR[e.tur]) ekle(e.tur, e.x, e.z, groundY(e.x, e.z), e.s || 1, e.ry || 0, e.id || ('t' + ci + ',' + cj + ',' + e.tur + ',' + Math.round(e.x) + ',' + Math.round(e.z)));
    const H = { ci, cj, kutular, nesne, ag: {}, ana: [], cizgi: [], c: new T3.Vector3(x0 + HUCRE / 2, (maxY > -1e8 ? (minY + maxY) / 2 : groundY(x0 + HUCRE / 2, z0 + HUCRE / 2)) + 4, z0 + HUCRE / 2), r: HUCRE * .75 + (maxY > -1e8 ? (maxY - minY) / 2 : 0) + 8, tepe: (maxY > -1e8 ? maxY : 0) + 9, gizli: false };
    Object.keys(G).forEach(tur => { const ms = G[tur], mk = (g, m, arr) => { const im = new T3.InstancedMesh(g, m, ms.length); ms.forEach((q, i) => im.setMatrixAt(i, q)); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.matrixAutoUpdate = false; scene.add(im); arr.push(im); }; H.ag[tur] = []; mk(geo[tur].g, vcMat, H.ana); H.ag[tur].push(H.ana[H.ana.length - 1]); mk(geo[tur].o, hullMat, H.cizgi); });
    return H;
  }
  /* nesne arayüzü (kesme/kazma için): sınıf 'agac' | 'kaya' | 'cali' | 'kaktus' | 'kristal' | 'mantar' */
  const SINIF = t => t.startsWith('yaprakli') || t.startsWith('cam') ? 'agac' : t.startsWith('kaya') || t.startsWith('duz') ? 'kaya' : t.startsWith('kristal') ? 'kristal' : t;
  const kaldirilan = new Set();
  // (x,z) çevresinde r içinde, filtreye uyan en yakın nesne → { id, tur, sinif, x, z, h, s } ya da null
  function yakinNesne(x, z, r, filtre) { let en = null, ed = r * r; hucreler.forEach(H => { if (x < H.ci * HUCRE - r || x > (H.ci + 1) * HUCRE + r || z < H.cj * HUCRE - r || z > (H.cj + 1) * HUCRE + r) return; for (const n of H.nesne) { if (n.yok) continue; const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z); if (d < ed && (!filtre || filtre(n))) { ed = d; en = n; } } }); return en; }
  // nesneyi dünyadan kaldırır (kesilen ağaç, kırılan kaya); kalıcıdır (kaldirilanlar() ile kaydedilir, kaldirilanYukle ile geri verilir)
  const SIFIR = new T3.Matrix4().makeScale(0, 0, 0);
  function nesneKaldir(id) { kaldirilan.add(id); let oldu = false; hucreler.forEach(H => { for (const n of H.nesne) if (n.id === id && !n.yok) { n.yok = true; oldu = true; const ag = H.ag[n.tur]; if (ag) { for (const m of ag) { m.setMatrixAt(n.sira, SIFIR); m.instanceMatrix.needsUpdate = true; } } const ci = H.cizgi.find(m => m.geometry === geo[n.tur].o); if (ci) { ci.setMatrixAt(n.sira, SIFIR); ci.instanceMatrix.needsUpdate = true; } if (n.kutu) { const k = H.kutular.indexOf(n.kutu); if (k >= 0) H.kutular.splice(k, 1); } } }); if (oldu) solidsYenile(); return oldu; }
  const kaldirilanlar = () => Array.from(kaldirilan), kaldirilanYukle = ids => { for (const id of ids || []) kaldirilan.add(id); };
  function hucreAt(H) { H.ana.concat(H.cizgi).forEach(m => { scene.remove(m); m.dispose && m.dispose(); }); }
  function solidsYenile() { solids.length = 0; hucreler.forEach(H => { for (const k of H.kutular) solids.push(k); }); }

  /* ---------- akış: istenen parçalar, üretim kuyruğu, görünürlük ---------- */
  let su, sonMerkez = null, kuyruk = [], sayac = 0;
  const anahtar = (i, j) => i + ',' + j;
  function istenenler(px, pz) {
    const w = [new Set(), new Set(), new Set()], i2 = Math.floor(px / 2048), j2 = Math.floor(pz / 2048);
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) w[2].add(anahtar(i2 + a, j2 + b));
    const q2i = Math.round(px / 2048) - 1, q2j = Math.round(pz / 2048) - 1; // oyuncuya en yakın 2×2 uzak parça → orta düzeye açılır
    for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) for (let d = 0; d < 4; d++) for (let c = 0; c < 4; c++) w[1].add(anahtar((q2i + a) * 4 + c, (q2j + b) * 4 + d));
    const q1i = Math.round(px / 512) - 1, q1j = Math.round(pz / 512) - 1; // en yakın 2×2 orta parça → yakın düzeye açılır
    for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) for (let d = 0; d < 4; d++) for (let c = 0; c < 4; c++) w[0].add(anahtar((q1i + a) * 4 + c, (q1j + b) * 4 + d));
    return w;
  }
  let istenen = [new Set(), new Set(), new Set()], istenenHucre = new Set();
  function planla(px, pz) {
    istenen = istenenler(px, pz); kuyruk = [];
    for (let lv = 2; lv >= 0; lv--) { dugum[lv].forEach((n, k) => { if (!istenen[lv].has(k)) { at(n); dugum[lv].delete(k); } }); const L = LV[lv], yeni = []; istenen[lv].forEach(k => { if (!dugum[lv].has(k)) { const [i, j] = k.split(',').map(Number); yeni.push({ lv, i, j, d: Math.hypot((i + .5) * L.size - px, (j + .5) * L.size - pz) }); } }); yeni.sort((a, b) => a.d - b.d); kuyruk.push(...yeni); }
    istenenHucre = new Set(); const hi = Math.floor(px / HUCRE), hj = Math.floor(pz / HUCRE); for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) if (Math.hypot((hi + a + .5) * HUCRE - px, (hj + b + .5) * HUCRE - pz) < uFar.value + HUCRE * .75) istenenHucre.add(anahtar(hi + a, hj + b));
    let degisti = false; hucreler.forEach((H, k) => { if (!istenenHucre.has(k)) { hucreAt(H); hucreler.delete(k); degisti = true; } }); if (degisti) solidsYenile();
    const yh = []; istenenHucre.forEach(k => { if (!hucreler.has(k)) { const [i, j] = k.split(',').map(Number); yh.push({ hucre: true, i, j, d: Math.hypot((i + .5) * HUCRE - px, (j + .5) * HUCRE - pz) }); } }); yh.sort((a, b) => a.d - b.d); kuyruk.push(...yh);
  }
  function isle(butce) { const t0 = performance.now(); let hucreEklendi = false;
    while (kuyruk.length && performance.now() - t0 < butce) { const q = kuyruk.shift(); if (q.hucre) { const k = anahtar(q.i, q.j); if (!hucreler.has(k) && istenenHucre.has(k)) { hucreler.set(k, hucreUret(q.i, q.j)); hucreEklendi = true; } } else { const k = anahtar(q.i, q.j); if (!dugum[q.lv].has(k) && istenen[q.lv].has(k)) dugum[q.lv].set(k, uret(q.lv, q.i, q.j)); } }
    if (hucreEklendi) solidsYenile(); }
  // kaba parça, 16 ince çocuğunun hepsi istenmiş ve hazırsa gizlenir
  function acik(lv, n) { if (lv === 0) return false; const m = dugum[lv - 1], s = istenen[lv - 1]; for (let d = 0; d < 4; d++) for (let c = 0; c < 4; c++) { const k = anahtar(n.i * 4 + c, n.j * 4 + d); if (!s.has(k) || !m.has(k)) return false; } return true; }
  const fr = new T3.Frustum(), pm = new T3.Matrix4(), sph = new T3.Sphere();
  // tepenin arkası: kameradan hedefe giden doğru boyunca kaba arazi doğrudan belirgin yüksekse hedef görünmez
  function kapali(cx, cy, cz, tx, ty, tz) { const dx = tx - cx, dy = ty - cy, dz = tz - cz, L = Math.hypot(dx, dz), n = Math.min(24, Math.ceil(L / 70)); for (let k = 1; k < n; k++) { const t = k / n; if (kabaH(cx + dx * t, cz + dz * t) > cy + dy * t + 6) return true; } return false; }
  function tepeArkasi(cam, x, z, yUst, yar) { const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, d = Math.hypot(x - cx, z - cz); if (d < yar + 140) return false; const nx = -(z - cz) / d * yar, nz = (x - cx) / d * yar;
    return kapali(cx, cy, cz, x, yUst, z) && kapali(cx, cy, cz, x + nx, yUst, z + nz) && kapali(cx, cy, cz, x - nx, yUst, z - nz); }
  function update(cam) {
    const px = SO.ps.x, pz = SO.ps.z;
    if (!sonMerkez || Math.hypot(px - sonMerkez[0], pz - sonMerkez[1]) > 24) { sonMerkez = [px, pz]; planla(px, pz); }
    isle(5); sayac++;
    pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    for (let lv = 0; lv < 3; lv++) { const yar = LV[lv].size * .71; let q = 0; dugum[lv].forEach(n => { q++; let g = !acik(lv, n); if (g && lv < 2) { if ((sayac + q) % 12 === 0) n.gizli = tepeArkasi(cam, n.cx, n.cz, n.maxY + 3, yar); g = !n.gizli; } n.mesh.visible = g; }); }
    let q = 0; hucreler.forEach(H => { q++; const d = Math.hypot(H.c.x - cam.position.x, H.c.z - cam.position.z); sph.center.copy(H.c); sph.radius = H.r; let gor = d < uFar.value + HUCRE * .75 && fr.intersectsSphere(sph);
      if (gor) { if ((sayac + q) % 10 === 0) H.gizli = tepeArkasi(cam, H.c.x, H.c.z, H.tepe, HUCRE * .6); gor = !H.gizli; } const yakin = gor && d < 190 + HUCRE * .75; for (const m of H.ana) m.visible = gor; for (const m of H.cizgi) m.visible = yakin; });
    su.position.set(cam.position.x, SU, cam.position.z); uCam.value.copy(cam.position); GR.kare(cam);
  }
  function build(sc, renderer) {
    scene = sc; maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    scene.fog = new T3.Fog(0xcfe2ea, 380, 3600);
    GR.kur(scene, renderer, { agirlik, groundY }); // gök kubbesi, sis rengi, çim tutamları
    SO.camera.far = 9000; SO.camera.updateProjectionMatrix();
    const R = rnd(7), cloudT = [0, 1, 2].map(i => new T3.CanvasTexture(canvasOf(300, 130, g => { g.scale(.7, .7); g.translate(210, 90); S.seed(70 + i); [[0, 0, 120, 44], [-100, 16, 80, 32], [96, 12, 90, 36], [20, -28, 70, 30]].forEach(([dx, dy, rx, ry]) => S.blot(g, S.ell(dx, dy, rx * (1 + i * .15), ry, 20), '#f8f1e2', 1)); })));
    const bulut = new T3.Group(); for (let i = 0; i < 22; i++) { const a = R() * TAU, d = 900 + R() * 2600, s = new T3.Sprite(new T3.SpriteMaterial({ map: cloudT[i % 3], fog: false, transparent: true, opacity: .95, depthWrite: false })); s.scale.set(380 + R() * 320, 150 + R() * 90, 1); s.position.set(Math.sin(a) * d, 520 + R() * 420, Math.cos(a) * d); bulut.add(s); } scene.add(bulut); build.bulut = bulut;
    yerMat = GR.yerMat();
    su = new T3.Mesh(new T3.PlaneGeometry(9000, 9000), GR.suMat()); su.rotation.x = -Math.PI / 2; su.renderOrder = 2; scene.add(su);
    Object.keys(TUR).forEach(k => { const p = TUR[k][0](); geo[k] = { g: GR.nesneGeo(p, k), o: partsToGeo(p, TUR[k][1] * GR.ayar.cizgi) }; });
    // başlangıç: merkezin yakınında, suya yakın, düz ve alçak bir yer ara
    start.h = 0; let en = null; for (let k = 0; k < 900; k++) { const a = k * 2.399963, r = 30 + k * 2.2, x = Math.cos(a) * r, z = Math.sin(a) * r; start.x = 1e9; const h = yukseklikF(x, z); if (h < 2.5 || h > 9) continue;
      const e = Math.hypot(yukseklikF(x + 12, z) - yukseklikF(x - 12, z), yukseklikF(x, z + 12) - yukseklikF(x, z - 12)) / 24; if (e > .06) continue; let suVar = false; for (let q = 0; q < 8 && !suVar; q++) suVar = yukseklikF(x + Math.cos(q * .785) * 70, z + Math.sin(q * .785) * 70) < -.5; if (!suVar) continue; en = { x, z, h }; break; }
    if (TS && TS.dogus) { start.x = 1e9; en = { x: TS.dogus.x, z: TS.dogus.z, h: 0 }; }
    if (!en) en = { x: 0, z: 0, h: Math.max(3, (start.x = 1e9, yukseklikF(0, 0))) }; start.x = en.x; start.z = en.z; start.h = en.h;
    planla(start.x, start.z); isle(1e9); sonMerkez = [start.x, start.z];
  }
  // çarpışma: y verilirse, tepesi ayak hizasının altında kalan (üstünde durulan) düz kayalar itmez
  function collide(x, z, r, y) {
    for (let it = 0; it < 2; it++) for (const s of solids) { if (x < s.x0 - r || x > s.x1 + r || z < s.z0 - r || z > s.z1 + r) continue; if (s.duz && y != null && y >= s.top - .28) continue;
      const nx = clamp(x, s.x0, s.x1), nz = clamp(z, s.z0, s.z1), dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz; if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; } else { const l = x - s.x0, rr = s.x1 - x, t = z - s.z0, b = s.z1 - z, m = Math.min(l, rr, t, b); if (m === l) x = s.x0 - r; else if (m === rr) x = s.x1 + r; else if (m === t) z = s.z0 - r; else z = s.z1 + r; } } }
    return [clamp(x, -HALF + 200, HALF - 200), clamp(z, -HALF + 200, HALF - 200)];
  }
  const inside = (x, z) => { for (const s of solids) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true; return false; };
  // destek yüksekliği: zemin ya da (ayak hizası tepesine yakınsa) üstünde durulan düz kaya
  function destekY(x, z, y) { let g = groundY(x, z); for (const s of solids) if (s.duz && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && (y == null || y >= s.top - .28) && s.top > g) g = s.top; return g; }
  // tırmanma için: (x,z)'den (dx,dz) yönünde en çok `uzak` m içinde, tepesi şimdiki destekten yüksek ilk düz kaya → { top, yukseklik, x, z (kenara temas noktası), ust: [x,z] (üstte durulacak nokta) }
  function basamak(x, z, dx, dz, uzak, y) { const g = destekY(x, z, y); let en = null;
    for (const s of solids) { if (!s.duz || s.top < g + .3) continue; let t0 = 0, t1 = uzak, ok = true; for (const [o, d, a, b] of [[x, dx, s.x0, s.x1], [z, dz, s.z0, s.z1]]) { if (Math.abs(d) < 1e-6) { if (o < a || o > b) ok = false; } else { let ta = (a - o) / d, tb = (b - o) / d; if (ta > tb) { const q = ta; ta = tb; tb = q; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); } } if (!ok || t0 > t1) continue;
      if (!en || t0 < en.t) en = { t: t0, top: s.top, yukseklik: s.top - g, x: x + dx * t0, z: z + dz * t0, ust: [clamp(x + dx * (t0 + .55), s.x0 + .3, s.x1 - .3), clamp(z + dz * (t0 + .55), s.z0 + .3, s.z1 - .3)] }; }
    return en; }
  const suDerinlik = (x, z) => Math.max(0, SU - groundY(x, z));
  // kamera için zemin: arazi, su yüzeyi ve içinde bulunulan kayanın tepesi (kamera kayanın/suyun içine girmesin)
  function kameraZemin(x, z) { let g = Math.max(groundY(x, z), SU + .15); for (const s of solids) if (s.duz && x > s.x0 - .4 && x < s.x1 + .4 && z > s.z0 - .4 && z < s.z1 + .4 && s.top > g) g = s.top; return g; }
  // adım sesi için zemin türü: sığ suda 'su'; vadi/orman/kar/çöl yumuşak ('cim'); kızıl diyar ve dik kayalık sert ('kaldirim')
  const zemin = (x, z) => { if (groundY(x, z) < SU - .08) return 'su'; const b = biyom(x, z); return b === 'kizil' || egim(x, z) > .45 ? 'kaldirim' : 'cim'; };
  const ortam = (x, z) => { const w = agirlik(x, z, [0, 0, 0, 0, 0]); return { sehir: 0, kus: Math.round(clamp(w[0] * .9 + w[1], 0, 1) * 5) / 5 }; };
  // harita rengi: (x,z) noktasının haritadaki rengi [r,g,b] 0..255 (su mavi; kara biyom rengi, yükseklikle açılır)
  function renk(x, z) { const h = yukseklikF(x, z); if (h < SU) return h < -6 ? [70, 130, 165] : [105, 165, 190]; const w = agirlik(x, z, [0, 0, 0, 0, 0]); let r = 0, g = 0, b = 0; for (let q = 0; q < 5; q++) { r += cB[q].r * w[q]; g += cB[q].g * w[q]; b += cB[q].b * w[q]; } const k = (h > 240 ? 1.12 : .82 + clamp(h / 320, 0, .3)) * 255; if (h > 240) { r = lerp(r, .93, .7); g = lerp(g, .95, .7); b = lerp(b, .93, .7); } return [Math.min(255, r * k) | 0, Math.min(255, g * k) | 0, Math.min(255, b * k) | 0]; }
  SO.world = { build, update, yakinNesne, nesneKaldir, kaldirilanlar, kaldirilanYukle, solids, groundY, destekY, kameraZemin, kameraEngel: false, suDerinlik, collide, inside, basamak, zemin, ortam, biyom, renk, yukseklikF, HALF, SU, start, durum: () => ({ dugum: dugum.map(m => m.size), hucre: hucreler.size, kuyruk: kuyruk.length, solids: solids.length }) };
})();
