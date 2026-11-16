/* Dünya: sıradan bir şehir. Cepheler, zemin ve tabelalar kalemle (kalem.js) dokuya çizilir ve 3B kutulara giydirilir;
   ağaçlar ve lambalar gerçek 3B ağlardır (düz renk + iki tonlu gölge + mürekkep dış çizgisi). Kâğıt greni (gürültü filtresi) YOK.
   Hız: aynı cepheli binalar tek örneklenmiş ağ, bütün mürekkep kenarları tek çizgi ağı, ağaçlar/lambalar örneklenmiş. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, S = Cizim, P = S.PAL, TAU = Math.PI * 2, U = 1 / 60;
  const rnd = SO.rnd, clamp = SO.clamp, rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  let scene, maxAniso = 4;
  function canvasOf(wU, hU, scale, draw) { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(wU * scale)); c.height = Math.max(2, Math.round(hU * scale)); const g = c.getContext('2d'); g.scale(scale, scale); draw(g); return c; }
  const texCache = new WeakMap();
  function tex(c, repeat) { if (c.isTexture) return c; if (!repeat && texCache.has(c)) return texCache.get(c); const t = new T3.CanvasTexture(c); t.anisotropy = maxAniso; if (repeat) t.wrapS = t.wrapT = T3.RepeatWrapping; else texCache.set(c, t); return t; }
  const mat = (map, o) => new T3.MeshBasicMaterial(Object.assign({ map }, o || {}));

  function windowAt(g, x, y, w, h, r, o) {
    o = o || {}; const k = r();
    S.shape(g, rect(x - 5, y - 5, w + 10, h + 10), o.frame || P.paper, { lw: 3 });
    S.shape(g, rect(x, y, w, h), k < .2 ? '#3d5a69' : '#6f95a8', { lw: 2.4, amp: .6, shade: c => { c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(x, y + h * .7); c.lineTo(x + w * .7, y); c.lineTo(x + w, y); c.lineTo(x, y + h); c.fill();
      if (k > .55) { c.fillStyle = k > .8 ? '#e9d9b8' : '#c9655a'; c.fillRect(x, y, w * (k > .8 ? .42 : 1), k > .8 ? h : h * .3); } } });
    S.line(g, [[x + w / 2, y], [x + w / 2, y + h]], 2.2, null, .4);
    if (!o.noSill) S.shape(g, rect(x - 10, y + h + 4, w + 20, 9), o.sill || P.concrete, { lw: 2.6 });
    if (k > .86) { S.shape(g, rect(x - 6, y + h - 4, w + 12, 16), P.brickDk, { lw: 2.6 }); for (let i = 0; i < 4; i++) S.blot(g, S.ell(x + 6 + i * (w / 4), y + h - 8 - r() * 8, 11, 9, 10), i % 2 ? P.weed : '#c9655a', .95); }
  }
  function sign(g, x, y, w, h, text, col, tcol) {
    S.shape(g, rect(x, y, w, h), col, { lw: 3.4 });
    let fs = h * .66; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = tcol || P.paper; g.font = `${Math.round(fs)}px 'Lilita One', sans-serif`;
    while (g.measureText(text).width > w - 24 && fs > 10) { fs -= 2; g.font = `${Math.round(fs)}px 'Lilita One', sans-serif`; }
    g.fillText(text, x + w / 2, y + h / 2 + 2);
  }
  function awning(g, x, y, w, col) {
    const p = S.shape(g, [[x, y], [x + w, y], [x + w + 12, y + 54], [x - 12, y + 54]], P.paper, { lw: 0 });
    g.save(); g.clip(p); g.fillStyle = col; for (let i = -1; i < w / 36 + 1; i += 2) g.fillRect(x - 16 + i * 36, y - 4, 36, 70); g.restore(); S.ink(g, p, 3.4);
    for (let i = 0; i < Math.floor((w + 24) / 32); i++) S.shape(g, S.ell(x - 12 + 16 + i * 32, y + 54, 16, 12, 10, 0, Math.PI), i % 2 ? col : P.paper, { lw: 2.6 });
  }
  function texture(c, x, y, w, h, r, lt, dk, n) { for (let i = 0; i < n; i++) { c.fillStyle = r() < .5 ? lt : dk; c.globalAlpha = .5; c.fillRect(x + r() * w, y + r() * h, 26 + r() * 18, 9); } c.globalAlpha = 1; }
  const TYPES = {
    brick: { col: P.brick, dk: P.brickDk, lt: P.brickLt, trim: P.mortar }, plaster: { col: '#d8c7a4', dk: '#b29f7c', lt: '#e9dcc0', trim: '#8a7a5c' },
    blue: { col: '#7f9aa3', dk: '#5c7780', lt: '#9db4bb', trim: P.paper }, rose: { col: '#c98d7c', dk: '#a36a5b', lt: '#dba898', trim: P.paper },
    green: { col: '#8b9a72', dk: '#687653', lt: '#a5b28d', trim: P.paper }, concrete: { col: P.concrete, dk: '#978c78', lt: '#d3c9b6', trim: '#7d7666' }
  };
  function facade(g, b) { // b: w,h (birim), type, shop, awn, balcony, seed, side (yan cephe: dükkân ve kapı yok)
    const r = rnd(b.seed), T = TYPES[b.type], w = b.w, h = b.h, x = 0, top = 0, G = h; S.seed(b.seed);
    S.shape(g, rect(x, top, w, h), T.col, { lw: 6, shade: c => { texture(c, x, top, w, h, r, T.lt, T.dk, Math.round(w * h / 9000)); if (b.side) S.blot(c, rect(-10, -10, w + 20, h + 20), T.dk, .28); else S.blot(c, [[x + w * .86, top - 10], [x + w + 10, top - 10], [x + w + 10, G + 10], [x + w * .82, G + 10], [x + w * .88, top + h * .5]], T.dk, .35); } });
    S.shape(g, rect(x - 10, top - 4, w + 20, 24), T.trim, { lw: 3.6 });
    const gf = 190, fl = Math.max(1, Math.round((h - gf - 30) / 140)), fh = (h - gf - 20) / fl, cols = Math.max(1, Math.floor((w - 50) / 118)), cw = (w - 50) / cols;
    for (let f = 0; f < fl; f++) for (let c = 0; c < cols; c++) {
      const wx = x + 25 + c * cw + (cw - 62) / 2, wy = top + 40 + f * fh;
      if (b.balcony && !b.side && c % 2 === f % 2) { windowAt(g, wx, wy, 62, 96, r, { noSill: true }); S.shape(g, rect(wx - 18, wy + 70, 98, 34), T.dk, { lw: 3 }); for (let i = 0; i < 5; i++) S.line(g, [[wx - 10 + i * 20, wy + 72], [wx - 10 + i * 20, wy + 102]], 2, null, .3); }
      else windowAt(g, wx, wy, 62, 84, r, { sill: T.trim });
    }
    S.line(g, [[x, G - gf + 6], [x + w, G - gf + 4]], 3.4);
    if (b.side) { for (let c = 0; c < cols; c++) if (c % 2 === 0) windowAt(g, x + 25 + c * cw + (cw - 62) / 2, G - gf + 44, 62, 84, r, { sill: T.trim }); return; }
    if (b.shop) {
      sign(g, x + 26, G - gf + 14, w - 52, 44, b.shop, P.ink, P.paper);
      const dw = 78, sx = x + 30, sw = w - 60 - dw - 16;
      S.shape(g, rect(sx, G - 120, sw, 98), '#6f95a8', { lw: 3.4, shade: c => { c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(sx, G - 60); c.lineTo(sx + 70, G - 120); c.lineTo(sx + 120, G - 120); c.lineTo(sx, G - 22); c.fill(); for (let i = 0; i < Math.floor(sw / 46); i++) { c.fillStyle = [P.hazardDeep, '#c9655a', P.paper, P.weed][i % 4]; c.beginPath(); c.arc(sx + 28 + i * 46, G - 40, 13, 0, TAU); c.fill(); } } });
      S.shape(g, rect(sx - 6, G - 22, sw + 12, 22), T.dk, { lw: 3 });
      S.shape(g, rect(x + w - 30 - dw, G - 140, dw, 140), b.door || '#3b5a4a', { lw: 3.6 }); S.shape(g, rect(x + w - 30 - dw + 12, G - 128, dw - 24, 58), '#6f95a8', { lw: 2.4 });
      awning(g, x + 22, G - gf + 62, w - 44, b.awn || '#c9655a');
    } else {
      const dx = x + w * (.3 + r() * .4) - 38;
      S.shape(g, rect(dx - 12, G - 156, 104, 12), T.trim, { lw: 3 }); S.shape(g, rect(dx, G - 144, 80, 144), b.door || '#4a3a2c', { lw: 3.6, shade: c => S.blot(c, rect(dx + 52, G - 150, 40, 160), '#000', .2) });
      S.shape(g, S.ell(dx + 64, G - 70, 4, 4, 8), P.hazard, { lw: 2 }); S.shape(g, rect(dx - 14, G - 8, 108, 10), P.concrete, { lw: 2.6 });
      for (let c = 0; c < cols; c++) { const wx = x + 25 + c * cw + (cw - 62) / 2; if (wx + 70 < dx - 16 || wx > dx + 100) windowAt(g, wx, G - gf + 44, 62, 84, r, { sill: T.trim }); }
    }
  }
  const VAR = [['brick', 840, 780, 'CAFE', '#c9655a', 0], ['plaster', 720, 640, null, null, 0], ['blue', 900, 1060, 'BAKERY', '#d98e0b', 1], ['rose', 700, 640, null, null, 1], ['brick', 960, 920, 'TOOLS', '#3b5a4a', 0],
    ['green', 780, 780, 'BOOKS', '#7f6aa0', 0], ['plaster', 900, 1200, null, null, 1], ['concrete', 840, 920, 'LAUNDRY', '#5c7780', 0], ['blue', 760, 780, 'GROCER', '#687653', 0], ['rose', 960, 1340, 'DINER', '#d98e0b', 1]];

  const DEPTH = 12, TS = .72;
  let variants = [];
  function buildVariants() {
    variants = VAR.map(([type, w, h, shop, awn, balcony], i) => {
      const T = TYPES[type], sd = 400 + i * 13;
      const fm = mat(tex(canvasOf(w, h, TS, g => facade(g, { w, h, type, shop, awn, balcony: !!balcony, seed: sd }))));
      const sm = mat(tex(canvasOf(DEPTH / U, h, TS, g => facade(g, { w: DEPTH / U, h, type, seed: sd + 5, side: true }))));
      const roof = new T3.MeshBasicMaterial({ color: new T3.Color(T.dk).multiplyScalar(.72) });
      const geo = new T3.BoxGeometry(w * U, h * U, DEPTH); geo.clearGroups(); geo.addGroup(0, 12, 0); geo.addGroup(12, 12, 1); geo.addGroup(24, 12, 2);
      return { w: w * U, h: h * U, mats: [sm, roof, fm], trimCol: new T3.Color(T.trim).multiplyScalar(.9), geo, inst: [] };
    });
  }
  const INK = 0x15120d, inkLine = new T3.LineBasicMaterial({ color: INK });
  const solids = [];
  const mergeP = [], mergeC = [], edgeP = [], M4 = new T3.Matrix4(), Q = new T3.Quaternion(), UP = new T3.Vector3(0, 1, 0), tmpC = new T3.Color();
  const mat4 = (x, y, z, ry, s) => new T3.Matrix4().compose(new T3.Vector3(x, y, z), new T3.Quaternion().setFromAxisAngle(UP, ry || 0), new T3.Vector3(s || 1, s || 1, s || 1));
  function addEdges(geo, m) { const e = new T3.EdgesGeometry(geo); e.applyMatrix4(m); const a = e.attributes.position.array; for (let i = 0; i < a.length; i++) edgeP.push(a[i]); e.dispose(); }
  function addSolidBox(w, h, d, m, color) { const g = new T3.BoxGeometry(w, h, d); addEdges(g, m); const n = g.toNonIndexed(); n.applyMatrix4(m); const a = n.attributes.position.array; tmpC.set(color); for (let i = 0; i < a.length; i += 3) { mergeP.push(a[i], a[i + 1], a[i + 2]); mergeC.push(tmpC.r, tmpC.g, tmpC.b); } g.dispose(); n.dispose(); }
  function flushMerged() { const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(mergeP, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(mergeC, 3)); const m = new T3.Mesh(g, new T3.MeshBasicMaterial({ vertexColors: true })); m.frustumCulled = false; scene.add(m);
    const eg = new T3.BufferGeometry(); eg.setAttribute('position', new T3.Float32BufferAttribute(edgeP, 3)); const l = new T3.LineSegments(eg, inkLine); l.frustumCulled = false; scene.add(l); }
  function instanced(geo, material, mats) { if (!mats.length) return null; const im = new T3.InstancedMesh(geo, material, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; scene.add(im); return im; }
  function addBuilding(v, x, z, rot) { // rot: 0 → ön yüz +z, 1 → +x, 2 → -z, 3 → -x
    const ry = rot * Math.PI / 2, m = mat4(x, v.h / 2 + .18, z, ry); v.inst.push(m); addEdges(v.geo, m);
    addSolidBox(v.w + .5, .5, DEPTH + .5, mat4(x, v.h + .18 + .1, z, ry), v.trimCol);
    const hw = (rot % 2 ? DEPTH : v.w) / 2, hd = (rot % 2 ? v.w : DEPTH) / 2; solids.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });
  }

  /* ---------- 3B ağaç ve lamba: yüzey başına iki tonlu düz renk + ters kabuk mürekkep çizgisi ---------- */
  const SUN = new T3.Vector3(-.5, .8, .35).normalize();
  function partsToGeo(parts, outline) { // parts: [{geo, m (Matrix4), lt, dk, center (Vector3), r}]
    const pos = [], col = [], a = new T3.Vector3(), b = new T3.Vector3(), c = new T3.Vector3(), n = new T3.Vector3(), cl = new T3.Color(), cd = new T3.Color();
    parts.forEach(p => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); g.applyMatrix4(p.m); const A = g.attributes.position.array;
      if (outline) { const k = 1 + outline / p.r; for (let i = 0; i < A.length; i += 3) { A[i] = p.center.x + (A[i] - p.center.x) * k; A[i + 1] = p.center.y + (A[i + 1] - p.center.y) * (p.tall ? 1.002 : k); A[i + 2] = p.center.z + (A[i + 2] - p.center.z) * k; } }
      cl.set(p.lt); cd.set(p.dk);
      for (let i = 0; i < A.length; i += 9) { a.set(A[i], A[i + 1], A[i + 2]); b.set(A[i + 3], A[i + 4], A[i + 5]); c.set(A[i + 6], A[i + 7], A[i + 8]); n.copy(b).sub(a).cross(c.clone().sub(a)).normalize(); const lit = n.dot(SUN) > .12 ? cl : cd; for (let k = 0; k < 9; k++) pos.push(A[i + k]); for (let k = 0; k < 3; k++) col.push(lit.r, lit.g, lit.b); }
      g.dispose(); });
    const out = new T3.BufferGeometry(); out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); if (!outline) out.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); return out;
  }
  function treeParts(sd) {
    const r = rnd(sd), h = 3.4 + r() * 1.2, parts = [];
    const trunk = new T3.CylinderGeometry(.16, .26, h, 7); parts.push({ geo: trunk, m: mat4(0, h / 2, 0), lt: '#7a4e27', dk: '#55351a', center: new T3.Vector3(0, h / 2, 0), r: .22, tall: true });
    [[0, h + .5, 0, 1.75], [-1.15, h - .25, .25, 1.2], [1.1, h - .15, -.3, 1.25], [.15, h + 1.55, .1, 1.15], [-.1, h - .2, 1.0, 1.05], [.2, h - .1, -1.05, 1.1]].forEach(([x, y, z, rad], i) => {
      const g = new T3.IcosahedronGeometry(rad, 1), A = g.attributes.position.array; for (let k = 0; k < A.length; k += 3) { const hsh = Math.sin(A[k] * 12.9898 + A[k + 1] * 78.233 + A[k + 2] * 37.719 + sd) * 43758.5453, j = 1 + ((hsh - Math.floor(hsh)) - .5) * .22; A[k] *= j; A[k + 1] *= j * .86; A[k + 2] *= j; }
      parts.push({ geo: g, m: mat4(x, y, z, r() * TAU), lt: i % 2 ? '#7d8a4a' : '#6f8046', dk: i % 2 ? '#4f5f31' : '#46562b', center: new T3.Vector3(x, y, z), r: rad }); });
    return parts;
  }
  function lampParts() {
    const lt = '#4a4e57', dk = '#2a2d34', parts = [];
    parts.push({ geo: new T3.CylinderGeometry(.06, .09, 5.4, 7), m: mat4(0, 2.7, 0), lt, dk, center: new T3.Vector3(0, 2.7, 0), r: .08, tall: true });
    parts.push({ geo: new T3.BoxGeometry(1.3, .09, .09), m: mat4(.6, 5.4, 0), lt, dk, center: new T3.Vector3(.6, 5.4, 0), r: .3 });
    parts.push({ geo: new T3.BoxGeometry(.6, .14, .3), m: mat4(1.15, 5.3, 0), lt: '#9aa3ab', dk: '#4a4e57', center: new T3.Vector3(1.15, 5.3, 0), r: .3 });
    parts.push({ geo: new T3.BoxGeometry(.44, .05, .2), m: mat4(1.15, 5.2, 0), lt: '#fff3c4', dk: '#fff3c4', center: new T3.Vector3(1.15, 5.2, 0), r: .3 });
    parts.push({ geo: new T3.CylinderGeometry(.14, .16, .3, 7), m: mat4(0, .15, 0), lt, dk, center: new T3.Vector3(0, .15, 0), r: .15, tall: true });
    return parts;
  }
  function benchParts() {
    const lt = '#7a4e27', dk = '#55351a', st = '#2a2d34', parts = [], add = (w, h, d, x, y, z, a, b) => parts.push({ geo: new T3.BoxGeometry(w, h, d), m: mat4(x, y, z), lt: a, dk: b, center: new T3.Vector3(x, y, z), r: .4 });
    add(1.8, .08, .5, 0, .46, 0, lt, dk); add(1.8, .5, .07, 0, .82, -.24, lt, dk); [-.75, .75].forEach(x => { add(.08, .46, .5, x, .23, 0, st, st); add(.08, .5, .08, x, .7, -.24, st, st); });
    return parts;
  }
  const vcMat = new T3.MeshBasicMaterial({ vertexColors: true }), hullMat = new T3.MeshBasicMaterial({ color: INK, side: T3.BackSide });
  function propSet(parts, outline) { return { g: partsToGeo(parts), o: outline ? partsToGeo(parts, outline) : null, m: [] }; }
  function flushProp(set) { instanced(set.g, vcMat, set.m); if (set.o) instanced(set.o, hullMat, set.m); }

  /* ---------- şehir ---------- */
  const NB = 4, B = 64, RW = 16, HALF = (NB * B + (NB + 1) * RW) / 2, SW = 5;
  const b0 = i => -HALF + RW + i * (B + RW);
  const inBlock = (x, z) => { for (let i = 0; i < NB; i++) { const a = b0(i); if (x >= a && x <= a + B) { for (let j = 0; j < NB; j++) { const c = b0(j); if (z >= c && z <= c + B) return true; } } } return false; };
  const groundY = (x, z) => inBlock(x, z) ? .18 : 0;
  const PARK = [1, 1], PLAZA = [2, 2];
  function build(sc, renderer) {
    scene = sc; maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy()); buildVariants();
    const R = rnd(2026);
    // gök, uzak şehir silueti, bulutlar
    scene.background = tex(canvasOf(16, 512, 1, g => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#7fb0d8'); gr.addColorStop(.55, '#bcd7e6'); gr.addColorStop(.8, '#efe6cf'); gr.addColorStop(1, '#efe6cf'); g.fillStyle = gr; g.fillRect(0, 0, 16, 512); }));
    const ringC = canvasOf(2048, 300, 1, g => { [[P.far, '#a7b4bc', 60, 190, 31, 0], [P.far2, '#8b9aa5', 40, 130, 57, 1]].forEach(([col, inkc, hmin, hmax, sd, win]) => { const r = rnd(sd); S.seed(sd); let x = 0; while (x < 2048) { const bw = 40 + r() * 70, bh = hmin + r() * (hmax - hmin), w2 = Math.min(bw, 2048 - x);
      S.shape(g, rect(x, 300 - bh, w2, bh + 10), col, { lw: 2.4, ink: inkc, amp: .7 }); if (win) { g.fillStyle = P.farWin; g.globalAlpha = .55; for (let wy = 300 - bh + 14; wy < 290; wy += 24) for (let wx = x + 8; wx < x + w2 - 12; wx += 18) if (r() < .7) g.fillRect(wx, wy, 8, 11); g.globalAlpha = 1; } x += bw; } }); });
    const rt = tex(ringC, true); rt.repeat.set(3, 1);
    const ring = new T3.Mesh(new T3.CylinderGeometry(420, 420, 120, 48, 1, true), new T3.MeshBasicMaterial({ map: rt, side: T3.BackSide, transparent: true, fog: false, depthWrite: false })); ring.position.y = 56; scene.add(ring);
    const cloudC = [0, 1, 2].map(i => canvasOf(420, 180, .7, g => { g.translate(210, 90); S.seed(70 + i); [[0, 0, 120, 44], [-100, 16, 80, 32], [96, 12, 90, 36], [20, -28, 70, 30]].forEach(([dx, dy, rx, ry]) => S.blot(g, S.ell(dx, dy, rx * (1 + i * .15), ry, 20), P.cloud, 1)); }));
    for (let i = 0; i < 14; i++) { const a = R() * TAU, d = 240 + R() * 130, s = new T3.Sprite(new T3.SpriteMaterial({ map: tex(cloudC[i % 3]), fog: false, transparent: true, opacity: .95, depthWrite: false })); s.scale.set(80 + R() * 60, 34 + R() * 18, 1); s.position.set(Math.sin(a) * d, 90 + R() * 60, Math.cos(a) * d); scene.add(s); }
    // zemin dokuları
    const blotTex = (base, a, b, n, sd) => canvasOf(512, 512, 1, g => { const r = rnd(sd); g.fillStyle = base; g.fillRect(0, 0, 512, 512); for (let i = 0; i < n; i++) S.blot(g, S.ell(r() * 512, r() * 512, 20 + r() * 60, 8 + r() * 20, 10), r() < .5 ? a : b, .4); });
    const rep = (c, n) => { const t = tex(c, true); t.repeat.set(n, n); return t; };
    { const om = mat(rep(blotTex('#8e9a5e', '#7d8a4a', '#a5b46a', 40, 9), 60)), D = 600; // şehrin dışı: dört çim parçası (yolun altına girmesin diye tek parça değil)
      [[0, -(HALF + D / 2), HALF * 2 + D * 2, D], [0, HALF + D / 2, HALF * 2 + D * 2, D], [-(HALF + D / 2), 0, D, HALF * 2], [HALF + D / 2, 0, D, HALF * 2]].forEach(([x, z, w, d]) => { const m = new T3.Mesh(new T3.PlaneGeometry(w, d), om); m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); scene.add(m); }); }
    const road = new T3.Mesh(new T3.PlaneGeometry(HALF * 2, HALF * 2), mat(rep(blotTex('#5b5a5c', '#4b4a4d', '#6a696b', 40, 5), HALF * 2 / 8))); road.rotation.x = -Math.PI / 2; scene.add(road);
    const paveC = canvasOf(256, 256, 1, g => { const r = rnd(8); g.fillStyle = '#cfc6b3'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 10; i++) S.blot(g, S.ell(r() * 256, r() * 256, 20 + r() * 40, 8 + r() * 14, 10), '#a89f8c', .3); g.strokeStyle = 'rgba(21,18,13,.4)'; g.lineWidth = 3; [0, 128].forEach(v => { g.beginPath(); g.moveTo(v, 0); g.lineTo(v + 3, 256); g.stroke(); g.beginPath(); g.moveTo(0, v); g.lineTo(256, v + 3); g.stroke(); }); });
    const grassC = canvasOf(256, 256, 1, g => { const r = rnd(9); g.fillStyle = '#8e9a5e'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 16; i++) S.blot(g, S.ell(r() * 256, r() * 256, 20 + r() * 40, 10 + r() * 20, 10), r() < .5 ? '#7d8a4a' : '#a5b46a', .4); g.strokeStyle = '#62733d'; g.lineWidth = 3; for (let i = 0; i < 40; i++) { const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y - 12); g.moveTo(x, y); g.lineTo(x + 5, y - 14); g.stroke(); } });
    const dashT = tex(canvasOf(32, 512, 1, g => { g.fillStyle = '#f1e8d4'; g.globalAlpha = .9; g.fillRect(4, 0, 24, 200); }), true); dashT.repeat.set(1, B / 8);
    const curbM = new T3.MeshBasicMaterial({ color: 0x8e8674 }), paveM = mat(rep(paveC, B / 4)), slabG = new T3.BoxGeometry(B, .18, B), slabM = [], grassM = [], innerR = B - (SW + DEPTH) * 2, grassG = new T3.PlaneGeometry(innerR, innerR); grassG.rotateX(-Math.PI / 2);
    const trees = [propSet(treeParts(61), .05), propSet(treeParts(73), .05)], lamps = propSet(lampParts(), 0), benches = propSet(benchParts(), .025);
    const tree = (x, y, z, s) => { trees[Math.floor(R() * trees.length)].m.push(mat4(x, y, z, R() * TAU, s)); solids.push({ x0: x - .3, x1: x + .3, z0: z - .3, z1: z + .3 }); };
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const x0 = b0(i), z0 = b0(j), cx = x0 + B / 2, cz = z0 + B / 2; slabM.push(mat4(cx, .09, cz)); addEdges(slabG, mat4(cx, .09, cz));
      const isPark = i === PARK[0] && j === PARK[1], isPlaza = i === PLAZA[0] && j === PLAZA[1];
      // kaldırım ağaçları ve lambaları (lamba kolu yola bakar)
      for (let k = 0; k < 4; k++) for (let t = 8; t < B - 4; t += 16) { const along = t + (k % 2 ? 8 : 0); if (along > B - 4) continue; const px = k === 0 || k === 2 ? x0 + along : (k === 1 ? x0 + B - 1.3 : x0 + 1.3), pz = k === 0 ? z0 + 1.3 : k === 2 ? z0 + B - 1.3 : z0 + along;
        if ((t / 16 + k) % 2 < 1) tree(px, .18, pz, .8 + R() * .25); else { lamps.m.push(mat4(px, .18, pz, [Math.PI / 2, 0, -Math.PI / 2, Math.PI][k])); solids.push({ x0: px - .12, x1: px + .12, z0: pz - .12, z1: pz + .12 }); } }
      if (isPark) { const ip = new T3.Mesh(new T3.PlaneGeometry(B - SW * 2, B - SW * 2), mat(rep(grassC, (B - SW * 2) / 5))); ip.rotation.x = -Math.PI / 2; ip.position.set(cx, .2, cz); scene.add(ip);
        for (let n = 0; n < 26; n++) { const px = x0 + 8 + R() * (B - 16), pz = z0 + 8 + R() * (B - 16); if (Math.abs(px - cx) < 3 || Math.abs(pz - cz) < 3) continue; tree(px, .2, pz, 1 + R() * .5); }
        [[-6, 0], [6, Math.PI], [0, Math.PI / 2, 14], [0, -Math.PI / 2, -14]].forEach(([dx, ry, dz]) => { benches.m.push(mat4(cx + (dx ? dx * .45 : 0), .2, cz + (dz || 0) + (dx ? dx * 1.6 : 0), ry + Math.PI / 2)); });
        continue; }
      if (isPlaza) { buildTower(cx, cz); continue; }
      grassM.push(mat4(cx, .2, cz));
      const line = len => { const out = []; let sum = 0, guard = 0; while (guard++ < 40) { const v = variants[Math.floor(R() * variants.length)]; if (sum + v.w > len) { if (len - sum < 11.5 || guard > 30) break; continue; } out.push(v); sum += v.w; } return { out, gap: (len - sum) / (out.length + 1) }; };
      [0, 2].forEach(rot => { const { out, gap } = line(B - SW * 2); let px = x0 + SW + gap; out.forEach(v => { addBuilding(v, px + v.w / 2, rot === 0 ? z0 + B - SW - DEPTH / 2 : z0 + SW + DEPTH / 2, rot); px += v.w + gap; }); });
      [1, 3].forEach(rot => { const { out, gap } = line(B - (SW + DEPTH) * 2 - 1); let pz = z0 + SW + DEPTH + .5 + gap; out.forEach(v => { addBuilding(v, rot === 1 ? x0 + B - SW - DEPTH / 2 : x0 + SW + DEPTH / 2, pz + v.w / 2, rot); pz += v.w + gap; }); });
    }
    // şehrin çevresine ağaç sırası
    for (let t = -HALF - 6; t <= HALF + 6; t += 9) [[t, -HALF - 6], [t, HALF + 6], [-HALF - 6, t], [HALF + 6, t]].forEach(([x, z]) => tree(x + R() * 3, -.02, z + R() * 3, 1.1 + R() * .6));
    const dashG = new T3.PlaneGeometry(.32, B); dashG.rotateX(-Math.PI / 2); const dashM = [];
    for (let k = 0; k <= NB; k++) { const c = -HALF + RW / 2 + k * (B + RW); for (let i = 0; i < NB; i++) { const a2 = b0(i) + B / 2; dashM.push(mat4(c, .02, a2, 0), mat4(a2, .02, c, Math.PI / 2)); } }
    instanced(dashG, new T3.MeshBasicMaterial({ map: dashT, alphaTest: .4 }), dashM);
    instanced(slabG, [curbM, curbM, paveM, curbM, curbM, curbM], slabM);
    instanced(grassG, mat(rep(grassC, innerR / 5)), grassM);
    variants.forEach(v => instanced(v.geo, v.mats, v.inst));
    trees.forEach(flushProp); flushProp(lamps); flushProp(benches); flushMerged();
  }
  function buildTower(cx, cz) {
    const w = 34, h = 78, c = canvasOf(680, 1560, 1, g => { const r = rnd(41); S.seed(41); const W = 680, Hh = 1560, base = 130;
      S.shape(g, rect(0, 0, W, Hh), '#7fa3b8', { lw: 8, shade: cc => { const gr = cc.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(15,40,60,.3)'); cc.fillStyle = gr; cc.fillRect(0, 0, W, Hh);
        for (let i = 0; i < 70; i++) { cc.fillStyle = r() < .5 ? 'rgba(255,255,255,.2)' : 'rgba(20,50,70,.22)'; cc.fillRect(Math.floor(r() * 8) * (W / 8), Math.floor(r() * 26) * 55, W / 8, 55); }
        cc.fillStyle = 'rgba(255,255,255,.16)'; cc.beginPath(); cc.moveTo(0, 900); cc.lineTo(W, 500); cc.lineTo(W, 640); cc.lineTo(0, 1040); cc.fill(); } });
      for (let i = 1; i < 8; i++) S.line(g, [[i * W / 8, 0], [i * W / 8, Hh - base]], 3.4, '#3d5a69', .6); for (let y = 55; y < Hh - base; y += 55) S.line(g, [[0, y], [W, y]], 3, '#3d5a69', .6);
      S.shape(g, rect(-10, Hh - base, W + 20, base + 10), '#d3c9b6', { lw: 6 }); S.shape(g, rect(W / 2 - 60, Hh - 96, 120, 96), '#2b4552', { lw: 4.4 }); S.line(g, [[W / 2, Hh - 96], [W / 2, Hh]], 3.4); });
    const t = tex(c), fm = mat(t), sm = mat(t, { color: 0xd4dde2 }), rm = new T3.MeshBasicMaterial({ color: 0x4f7183 }), m = new T3.Mesh(new T3.BoxGeometry(w, h, w), [sm, sm, rm, rm, fm, fm]); m.position.set(cx, h / 2 + .18, cz); scene.add(m);
    addEdges(m.geometry, mat4(cx, h / 2 + .18, cz)); solids.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - w / 2, z1: cz + w / 2 });
  }
  // çarpışma: (x,z) merkezli r yarıçaplı daireyi kutuların dışına iter
  function collide(x, z, r) { for (let it = 0; it < 2; it++) for (const s of solids) { const nx = clamp(x, s.x0, s.x1), nz = clamp(z, s.z0, s.z1), dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz; if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; } else { const l = x - s.x0, rr = s.x1 - x, t = z - s.z0, b = s.z1 - z, m = Math.min(l, rr, t, b); if (m === l) x = s.x0 - r; else if (m === rr) x = s.x1 + r; else if (m === t) z = s.z0 - r; else z = s.z1 + r; } } } return [clamp(x, -HALF - 3, HALF + 3), clamp(z, -HALF - 3, HALF + 3)]; }
  const inside = (x, z) => { for (const s of solids) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true; return false; };
  // zemin türü (adım sesi için): park içi ve şehir dışı çim, bloklar kaldırım, gerisi asfalt
  const zemin = (x, z) => { if (Math.abs(x) > HALF || Math.abs(z) > HALF) return 'cim'; const px = b0(PARK[0]), pz = b0(PARK[1]); if (x > px + SW && x < px + B - SW && z > pz + SW && z < pz + B - SW) return 'cim'; return inBlock(x, z) ? 'kaldirim' : 'asfalt'; };
  SO.world = { build, solids, groundY, collide, inside, zemin, HALF, B, RW, b0, start: { x: b0(1) + B / 2, z: b0(1) + B + 6 } };
})();
