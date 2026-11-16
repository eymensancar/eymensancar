/* Açık dünya: biyomlu bir ada. Ortada çayır (başlangıç), kuzeyde orman, doğuda çöl, batıda karlı dağlar, güneyde kızıl diyar; çevresi deniz.
   Arazi bir yükseklik ızgarasıdır (5 m aralık); zemin yüksekliği ızgaradaki üçgenlerden okunur (ayaklar tam oturur).
   Görünüş: düz renk + basamaklı gölge + kalemle çizilmiş leke dokusu; ağaç, kaya, kaktüs vb. gerçek 3B, mürekkep dış çizgili.
   Hız: nesneler 200 m'lik bölgelere ayrılır; görüş alanı ve sis mesafesi dışındaki bölgeler hiç çizilmez, uzak bölgelerde dış çizgi kapanır.
   SO.world arayüzü (şehirle aynı): build, groundY, collide, inside, zemin, solids, HALF, start; ek: update(cam), biyom(x,z), ortam(x,z). */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, S = Cizim, TAU = Math.PI * 2, rnd = SO.rnd, clamp = SO.clamp;
  const N = 240, CELL = 5, HALF = N * CELL / 2, R_ADA = 520, CH = 30, INK = 0x15120d;
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hash(ix, iz, s) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz), a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
  function fbm(x, z, s, oct) { let v = 0, a = .5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, z * f, s + i * 17); n += a; a *= .5; f *= 2; } return v / n; }

  /* ---------- biyomlar ---------- */
  const BIYOM = ['cayir', 'orman', 'col', 'kar', 'kizil'];
  const RENK = { cayir: '#8e9a5e', orman: '#6b7c45', col: '#e0c79a', kar: '#eef1ec', kizil: '#a8503a' }, KAYA = { cayir: '#978c78', orman: '#8a826f', col: '#c9a074', kar: '#93a0a8', kizil: '#5a2b2e' };
  const W = [0, 0, 0, 0, 0];
  function agirlik(x, z, out) { // [çayır, orman (kuzey), çöl (doğu), kar (batı), kızıl (güney)], toplam 1
    const wx = x + (fbm(x / 90, z / 90, 5, 2) - .5) * 130, wz = z + (fbm(x / 90, z / 90, 9, 2) - .5) * 130, r = Math.hypot(wx, wz), th = Math.atan2(wx, -wz);
    const m = 1 - sm(115, 185, r), sek = c => 1 - sm(.42, .58, Math.abs(SO.wrapA(th - c)) / (Math.PI / 2)), k = 1 - m;
    out[0] = m; out[1] = k * sek(0); out[2] = k * sek(Math.PI / 2); out[3] = k * sek(-Math.PI / 2); out[4] = k * sek(Math.PI); return out;
  }
  function yukseklikF(x, z) {
    const w = agirlik(x, z, W), r0 = Math.hypot(x, z), base = fbm(x / 140, z / 140, 1, 4), det = fbm(x / 28, z / 28, 2, 3);
    const hM = 2.4 + (base - .5) * 6 + (det - .5) * 1.2, hF = 4 + (base - .5) * 16 + (det - .5) * 2.6;
    const hD = 3 + (1 - Math.abs(2 * fbm(x / 60, z / 60, 3, 2) - 1)) * 7 + (base - .5) * 6;
    const hK = 7 + Math.pow(base, 1.5) * 78 * sm(150, 430, r0) + det * 5;
    const tv = fbm(x / 70, z / 70, 4, 3), hR = 4 + (Math.floor(tv * 5) + sm(.72, 1, (tv * 5) % 1)) * 3.2 + (det - .5) * 1.6;
    let h = w[0] * hM + w[1] * hF + w[2] * hD + w[3] * hK + w[4] * hR;
    h = SO.lerp(h, -7, sm(R_ADA - 120, R_ADA + 10, r0 + (fbm(x / 50, z / 50, 6, 2) - .5) * 60));
    return SO.lerp(h, 2.4, 1 - sm(30, 75, r0)); // başlangıç çevresi düz
  }
  const NV = N + 1, H = new Float32Array(NV * NV);
  // ızgaradaki üçgenlerden yükseklik (çizilen yüzeyle birebir aynı)
  function groundY(x, z) {
    const gx = clamp((x + HALF) / CELL, 0, N - 1e-4), gz = clamp((z + HALF) / CELL, 0, N - 1e-4), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, a = j * NV + i;
    const h00 = H[a], h10 = H[a + 1], h01 = H[a + NV], h11 = H[a + NV + 1];
    return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }
  const egim = (x, z) => { const e = 2.5; return Math.hypot(groundY(x + e, z) - groundY(x - e, z), groundY(x, z + e) - groundY(x, z - e)) / (2 * e); };
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
  function blob(rad, sd, sq) { const g = new T3.IcosahedronGeometry(rad, 1), A = g.attributes.position.array; for (let k = 0; k < A.length; k += 3) { const h = Math.sin(A[k] * 12.9898 + A[k + 1] * 78.233 + A[k + 2] * 37.719 + sd) * 43758.5453, j = 1 + ((h - Math.floor(h)) - .5) * .24; A[k] *= j; A[k + 1] *= j * (sq || .86); A[k + 2] *= j; } return g; }

  /* ---------- nesne türleri ---------- */
  function yaprakli(sd) { const r = rnd(sd), h = 3.2 + r() * 1.4, P = [part(new T3.CylinderGeometry(.16, .27, h, 7), mat4(0, h / 2, 0), '#7a4e27', '#55351a', 0, h / 2, 0, .22, true)];
    [[0, h + .5, 0, 1.75], [-1.15, h - .25, .25, 1.2], [1.1, h - .15, -.3, 1.25], [.15, h + 1.55, .1, 1.15], [0, h - .15, 1.0, 1.05]].forEach(([x, y, z, rad], i) => P.push(part(blob(rad, sd + i), mat4(x, y, z, r() * TAU), i % 2 ? '#7d8a4a' : '#6f8046', i % 2 ? '#4f5f31' : '#46562b', x, y, z, rad))); return P; }
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
  const TUR = { // ad: [parça üretici, dış çizgi kalınlığı, çarpışma yarıçapı]
    yaprakli1: [() => yaprakli(61), .05, .3], yaprakli2: [() => yaprakli(73), .05, .3], cam1: [() => cam(11, false), .05, .28], camKar: [() => cam(12, true), .05, .28], cali: [() => cali(21), .035, 0],
    kaya: [() => kaya(31, '#a89f8c', '#756c5b'), .04, .9], kayaCol: [() => kaya(32, '#d6b083', '#a67c52'), .04, .9], kayaKar: [() => kaya(33, '#dfe6ea', '#8b9aa5'), .04, .9], kayaKizil: [() => kaya(34, '#6e3438', '#3d1c20'), .04, .9],
    kaktus: [kaktus, .035, .4], kristalPembe: [() => kristal(41, '#f07a98', '#a1335c'), .045, .7], kristalTurkuaz: [() => kristal(42, '#6fe0d8', '#2a8c8a'), .045, .7], mantar: [() => mantar(51), .05, .45]
  };
  // biyom → [tür, aday nokta başına olasılık]
  const SAC = { cayir: [['yaprakli1', .022], ['yaprakli2', .02], ['cali', .035], ['kaya', .014]], orman: [['yaprakli1', .13], ['yaprakli2', .11], ['cam1', .12], ['cali', .05], ['kaya', .02]],
    col: [['kaktus', .035], ['kayaCol', .035]], kar: [['camKar', .075], ['kayaKar', .035]], kizil: [['kristalPembe', .03], ['kristalTurkuaz', .022], ['mantar', .035], ['kayaKizil', .03]] };

  const solids = [], bolgeler = [], BOLGE = 200, vcMat = new T3.MeshBasicMaterial({ vertexColors: true }), hullMat = new T3.MeshBasicMaterial({ color: INK, side: T3.BackSide });
  function build(sc, renderer) {
    scene = sc; maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    scene.fog = new T3.Fog(0xcfe2ea, 120, 400);
    scene.background = (() => { const t = new T3.CanvasTexture(canvasOf(16, 512, g => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#6fa8d6'); gr.addColorStop(.5, '#b4d4e6'); gr.addColorStop(.72, '#e6eef0'); gr.addColorStop(1, '#e6eef0'); g.fillStyle = gr; g.fillRect(0, 0, 16, 512); })); return t; })();
    const R = rnd(7);
    const cloudC = [0, 1, 2].map(i => canvasOf(300, 130, g => { g.scale(.7, .7); g.translate(210, 90); S.seed(70 + i); [[0, 0, 120, 44], [-100, 16, 80, 32], [96, 12, 90, 36], [20, -28, 70, 30]].forEach(([dx, dy, rx, ry]) => S.blot(g, S.ell(dx, dy, rx * (1 + i * .15), ry, 20), '#f8f1e2', 1)); }));
    const cloudT = cloudC.map(c => new T3.CanvasTexture(c));
    for (let i = 0; i < 18; i++) { const a = R() * TAU, d = 260 + R() * 260, s = new T3.Sprite(new T3.SpriteMaterial({ map: cloudT[i % 3], fog: false, transparent: true, opacity: .95, depthWrite: false })); s.scale.set(90 + R() * 70, 38 + R() * 20, 1); s.position.set(Math.sin(a) * d, 110 + R() * 70, Math.cos(a) * d); scene.add(s); }
    // yükseklik ızgarası
    for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) H[j * NV + i] = yukseklikF(-HALF + i * CELL, -HALF + j * CELL);
    // köşe renkleri: biyom rengi + dik yerde kaya + kıyıda kum, basamaklı gölge
    const col = new Float32Array(NV * NV * 3), cB = BIYOM.map(b => new T3.Color(RENK[b])), cK = BIYOM.map(b => new T3.Color(KAYA[b])), kum = new T3.Color('#e3cca0'), c = new T3.Color(), k2 = new T3.Color(), nrm = new T3.Vector3(), w = [0, 0, 0, 0, 0];
    for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
      const x = -HALF + i * CELL, z = -HALF + j * CELL, a = j * NV + i, h = H[a], hx = H[j * NV + Math.min(N, i + 1)] - H[j * NV + Math.max(0, i - 1)], hz = H[Math.min(N, j + 1) * NV + i] - H[Math.max(0, j - 1) * NV + i];
      nrm.set(-hx, 2 * CELL, -hz).normalize(); agirlik(x, z, w); c.setRGB(0, 0, 0); k2.setRGB(0, 0, 0);
      for (let b = 0; b < 5; b++) { c.r += cB[b].r * w[b]; c.g += cB[b].g * w[b]; c.b += cB[b].b * w[b]; k2.r += cK[b].r * w[b]; k2.g += cK[b].g * w[b]; k2.b += cK[b].b * w[b]; }
      c.lerp(k2, sm(.2, .42, 1 - nrm.y)); c.lerp(kum, (1 - sm(.5, 1.7, h)) * (1 - w[3] * .6));
      const d = nrm.dot(SUN), golge = d > .78 ? 1 : d > .62 ? .92 : d > .45 ? .82 : .7, ton = .96 + vnoise(x / 9, z / 9, 77) * .08;
      col[a * 3] = c.r * golge * ton; col[a * 3 + 1] = c.g * golge * ton; col[a * 3 + 2] = c.b * golge * ton;
    }
    const lekeT = new T3.CanvasTexture(canvasOf(512, 512, g => { const r = rnd(5); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 46; i++) { const koyu = r() < .55; S.blot(g, S.ell(r() * 512, r() * 512, 16 + r() * 46, 8 + r() * 18, 10), koyu ? '#8a8a8a' : '#ffffff', koyu ? .16 : .55); } g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 2.5; for (let i = 0; i < 30; i++) { const x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y - 12); g.moveTo(x, y); g.lineTo(x + 5, y - 14); g.stroke(); } }));
    lekeT.wrapS = lekeT.wrapT = T3.RepeatWrapping; lekeT.anisotropy = maxAniso;
    const yerMat = new T3.MeshBasicMaterial({ map: lekeT, vertexColors: true });
    for (let cj = 0; cj < N / CH; cj++) for (let ci = 0; ci < N / CH; ci++) {
      const n1 = CH + 1, pos = new Float32Array(n1 * n1 * 3), uv = new Float32Array(n1 * n1 * 2), cc = new Float32Array(n1 * n1 * 3), idx = [];
      for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) { const gi = ci * CH + i, gj = cj * CH + j, a = gj * NV + gi, o = j * n1 + i, x = -HALF + gi * CELL, z = -HALF + gj * CELL; pos[o * 3] = x; pos[o * 3 + 1] = H[a]; pos[o * 3 + 2] = z; uv[o * 2] = x / 14; uv[o * 2 + 1] = z / 14; cc[o * 3] = col[a * 3]; cc[o * 3 + 1] = col[a * 3 + 1]; cc[o * 3 + 2] = col[a * 3 + 2]; }
      for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) { const a = j * n1 + i; idx.push(a, a + n1, a + 1, a + 1, a + n1, a + n1 + 1); }
      const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(pos, 3)); g.setAttribute('uv', new T3.BufferAttribute(uv, 2)); g.setAttribute('color', new T3.BufferAttribute(cc, 3)); g.setIndex(idx); g.computeBoundingSphere();
      const m = new T3.Mesh(g, yerMat); m.matrixAutoUpdate = false; scene.add(m);
    }
    const su = new T3.Mesh(new T3.PlaneGeometry(5000, 5000), new T3.MeshBasicMaterial({ color: 0x6fa3b8, transparent: true, opacity: .86 })); su.rotation.x = -Math.PI / 2; su.position.y = 0; scene.add(su);
    // nesneleri saç: 7 m'lik titrek ızgara adayları; biyom ağırlığına göre tür seçilir
    const geo = {}; Object.keys(TUR).forEach(k => { const p = TUR[k][0](); geo[k] = { g: partsToGeo(p), o: partsToGeo(p, TUR[k][1]) }; });
    const grup = new Map(), ww = [0, 0, 0, 0, 0];
    for (let z = -R_ADA; z < R_ADA; z += 7) for (let x = -R_ADA; x < R_ADA; x += 7) {
      const px = x + (R() - .5) * 6, pz = z + (R() - .5) * 6, u = R(), u2 = R(), rs = R(), rr = R(); if (Math.hypot(px, pz) < 9) continue;
      const h = groundY(px, pz); if (h < 1.3) continue; agirlik(px, pz, ww);
      let b = 0, acc = ww[0]; while (b < 4 && u > acc) { b++; acc += ww[b]; }
      const tablo = SAC[BIYOM[b]]; let tur = null, t = 0; for (const [ad, p] of tablo) { t += p; if (u2 < t) { tur = ad; break; } } if (!tur) continue;
      const eg = egim(px, pz); if (eg > (tur.startsWith('kaya') ? .9 : .5)) continue;
      const s = (tur.startsWith('kaya') ? .6 + rs * 1.6 : tur === 'cali' ? .7 + rs * .7 : .85 + rs * .45) * (BIYOM[b] === 'orman' && tur.startsWith('yaprakli') ? 1.15 : 1);
      const key = Math.floor((px + HALF) / BOLGE) + ',' + Math.floor((pz + HALF) / BOLGE); let G = grup.get(key); if (!G) grup.set(key, G = {}); (G[tur] = G[tur] || []).push(mat4(px, h - .08, pz, rr * TAU, s));
      const cr = TUR[tur][2] * s; if (cr > 0) solids.push({ x0: px - cr, x1: px + cr, z0: pz - cr, z1: pz + cr });
    }
    grup.forEach((G, key) => { const [bi, bj] = key.split(',').map(Number), cx = -HALF + (bi + .5) * BOLGE, cz = -HALF + (bj + .5) * BOLGE, B = { c: new T3.Vector3(cx, groundY(cx, cz) + 10, cz), ana: [], cizgi: [] };
      Object.keys(G).forEach(tur => { const ms = G[tur], mk = (g, m, arr) => { const im = new T3.InstancedMesh(g, m, ms.length); ms.forEach((q, i) => im.setMatrixAt(i, q)); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.matrixAutoUpdate = false; scene.add(im); arr.push(im); }; mk(geo[tur].g, vcMat, B.ana); mk(geo[tur].o, hullMat, B.cizgi); });
      bolgeler.push(B); });
  }
  // her karede: görüş alanı ve mesafeye göre bölgeleri aç/kapat; uzak bölgelerde dış çizgi kapalı
  const fr = new T3.Frustum(), pm = new T3.Matrix4(), sph = new T3.Sphere(new T3.Vector3(), BOLGE * .75 + 30);
  function update(cam) {
    pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    for (const B of bolgeler) { const d = Math.hypot(B.c.x - cam.position.x, B.c.z - cam.position.z); sph.center.copy(B.c); const gor = d < 400 + BOLGE * .75 && fr.intersectsSphere(sph), yakin = gor && d < 170 + BOLGE * .75;
      for (const m of B.ana) m.visible = gor; for (const m of B.cizgi) m.visible = yakin; }
  }
  function collide(x, z, r) {
    for (let it = 0; it < 2; it++) for (const s of solids) { if (x < s.x0 - r || x > s.x1 + r || z < s.z0 - r || z > s.z1 + r) continue; const nx = clamp(x, s.x0, s.x1), nz = clamp(z, s.z0, s.z1), dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz; if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; } else { const l = x - s.x0, rr = s.x1 - x, t = z - s.z0, b = s.z1 - z, m = Math.min(l, rr, t, b); if (m === l) x = s.x0 - r; else if (m === rr) x = s.x1 + r; else if (m === t) z = s.z0 - r; else z = s.z1 + r; } } }
    for (let k = 0; k < 40 && groundY(x, z) < -.55; k++) { x *= .996; z *= .996; } // denize girme: dizin altında kal
    return [x, z];
  }
  const inside = (x, z) => { for (const s of solids) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true; return false; };
  // adım sesi için zemin türü: çayır/orman/kar/çöl yumuşak ('cim'), kızıl diyar ve dik kayalık sert ('kaldirim')
  const zemin = (x, z) => { const b = biyom(x, z); return b === 'kizil' || egim(x, z) > .45 ? 'kaldirim' : 'cim'; };
  // ortam sesi düzeyleri (0..1): şehir uğultusu yok; kuşlar çayır ve ormanda
  const ortam = (x, z) => { const w = agirlik(x, z, [0, 0, 0, 0, 0]); return { sehir: 0, kus: Math.round(clamp(w[0] * .8 + w[1], 0, 1) * 5) / 5 }; };
  SO.world = { build, update, solids, groundY, collide, inside, zemin, ortam, biyom, HALF, start: { x: 0, z: 0 } };
})();
