/* Two Beeps Şehri — 3B, arkadan bakışlı yürüme denemesi.
   Görünüş animasyonla aynı kalemden (cizim.js): bina cepheleri, zemin ve tabelalar o kalemle dokuya çizilir ve 3B kutulara giydirilir;
   karakterler, Daisy, ağaçlar ve lambalar aynı çizimlerin kameraya dönük levhalarıdır. Çizimlerde sadeleştirme yok.
   Hız: görüş alanı dışındaki hiçbir şey çizilmez, uzaktaki dokular kendiliğinden küçülür (mipmap), en uzakta sis ve hazır şehir silueti var. */
(function () {
  'use strict';
  const S = Cizim, P = S.PAL, TAU = Math.PI * 2, T3 = THREE;
  const U = 1 / 60, CU = 1.8 / 560; // bina çizim birimi → metre; karakter çizim birimi → metre
  const stage = document.getElementById('stage'), cv = document.getElementById('c');
  const rnd = s => { let a = (s * 2654435761) >>> 0 || 9; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

  const renderer = new T3.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  const scene = new T3.Scene(), cam = new T3.PerspectiveCamera(58, 2, .3, 700);
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  scene.fog = new T3.Fog(0xcfdcdc, 70, 260);

  /* ---------- doku yapımı ---------- */
  function canvasOf(wU, hU, scale, draw, alpha, grainA) {
    const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(wU * scale)); c.height = Math.max(2, Math.round(hU * scale));
    const g = c.getContext('2d'); g.scale(scale, scale); draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (alpha) { const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0); S.grain(g, 0, 0, c.width, c.height, grainA == null ? .2 : grainA); g.globalCompositeOperation = 'destination-in'; g.drawImage(t, 0, 0); g.globalCompositeOperation = 'source-over'; }
    else S.grain(g, 0, 0, c.width, c.height, grainA == null ? .2 : grainA);
    return c;
  }
  const texCache = new WeakMap();
  function tex(c, repeat) { if (c.isTexture) return c; if (!repeat && texCache.has(c)) return texCache.get(c); const t = new T3.CanvasTexture(c); if (!repeat) texCache.set(c, t); t.anisotropy = maxAniso; if (repeat) { t.wrapS = t.wrapT = T3.RepeatWrapping; } return t; }
  const mat = (map, o) => new T3.MeshBasicMaterial(Object.assign({ map }, o || {}));

  /* ---------- cephe çizimi (2B sokaktaki apartmanla aynı kalem) ---------- */
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
      const front = tex(canvasOf(w, h, TS, g => facade(g, { w, h, type, shop, awn, balcony: !!balcony, seed: sd })));
      const side = tex(canvasOf(DEPTH / U, h, TS, g => facade(g, { w: DEPTH / U, h, type, seed: sd + 5, side: true })));
      const roof = new T3.MeshBasicMaterial({ color: new T3.Color(T.dk).multiplyScalar(.72) });
      const fm = mat(front), sm = mat(side);
      const geo = new T3.BoxGeometry(w * U, h * U, DEPTH); geo.clearGroups(); geo.addGroup(0, 12, 0); geo.addGroup(12, 12, 1); geo.addGroup(24, 12, 2);
      return { w: w * U, h: h * U, mats: [sm, roof, fm], trimCol: new T3.Color(T.trim).multiplyScalar(.9), geo, inst: [] };
    });
  }
  const inkLine = new T3.LineBasicMaterial({ color: 0x15120d });
  const solids = []; // çarpışma kutuları {x0,x1,z0,z1}
  // Çizim çağrısını azaltmak için: bütün saçaklar tek ağ, bütün mürekkep kenar çizgileri tek çizgi ağı, aynı cepheli binalar tek örneklenmiş ağ.
  const mergeP = [], mergeC = [], edgeP = [], M4 = new T3.Matrix4(), Q = new T3.Quaternion(), UP = new T3.Vector3(0, 1, 0), ONE = new T3.Vector3(1, 1, 1), tmpC = new T3.Color();
  const mat4 = (x, y, z, ry) => M4.compose(new T3.Vector3(x, y, z), Q.setFromAxisAngle(UP, ry || 0), ONE).clone();
  function addEdges(geo, m) { const e = new T3.EdgesGeometry(geo); e.applyMatrix4(m); const a = e.attributes.position.array; for (let i = 0; i < a.length; i++) edgeP.push(a[i]); e.dispose(); }
  function addSolidBox(w, h, d, m, color) { const g = new T3.BoxGeometry(w, h, d); addEdges(g, m); const n = g.toNonIndexed(); n.applyMatrix4(m); const a = n.attributes.position.array; tmpC.set(color); for (let i = 0; i < a.length; i += 3) { mergeP.push(a[i], a[i + 1], a[i + 2]); mergeC.push(tmpC.r, tmpC.g, tmpC.b); } g.dispose(); n.dispose(); }
  function flushMerged() { const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(mergeP, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(mergeC, 3)); const m = new T3.Mesh(g, new T3.MeshBasicMaterial({ vertexColors: true })); m.frustumCulled = false; scene.add(m);
    const eg = new T3.BufferGeometry(); eg.setAttribute('position', new T3.Float32BufferAttribute(edgeP, 3)); const l = new T3.LineSegments(eg, inkLine); l.frustumCulled = false; scene.add(l); }
  function instanced(geo, material, mats) { const im = new T3.InstancedMesh(geo, material, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; scene.add(im); return im; }
  // kameraya dönük levha grupları (ağaç, lamba): her doku için tek çizim çağrısı
  const boardSets = [];
  function boardSet(canvas, anchorY) { const g = new T3.PlaneGeometry(1, 1); g.translate(0, .5 - anchorY, 0); const set = { g, m: new T3.MeshBasicMaterial({ map: tex(canvas), alphaTest: .5, side: T3.DoubleSide }), items: [], add(x, y, z, w, h) { this.items.push([x, y, z, w, h]); } }; boardSets.push(set); return set; }
  const bP = new T3.Vector3(), bS = new T3.Vector3();
  function boardsUpdate() { boardSets.forEach(set => { if (!set.im) { if (!set.items.length) return; set.im = new T3.InstancedMesh(set.g, set.m, set.items.length); set.im.frustumCulled = false; scene.add(set.im); }
    set.items.forEach(([x, y, z, w, h], i) => { M4.compose(bP.set(x, y, z), Q.setFromAxisAngle(UP, Math.atan2(cam.position.x - x, cam.position.z - z)), bS.set(w, h, 1)); set.im.setMatrixAt(i, M4); }); set.im.instanceMatrix.needsUpdate = true; }); }
  function addBuilding(v, x, z, rot) { // rot: 0 → ön yüz +z, 1 → +x, 2 → -z, 3 → -x
    const ry = rot * Math.PI / 2; v.inst.push(mat4(x, v.h / 2 + .18, z, ry)); addEdges(v.geo, mat4(x, v.h / 2 + .18, z, ry));
    addSolidBox(v.w + .5, .5, DEPTH + .5, mat4(x, v.h + .18 + .1, z, ry), v.trimCol);
    const hw = (rot % 2 ? DEPTH : v.w) / 2, hd = (rot % 2 ? v.w : DEPTH) / 2; solids.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });
  }

  /* ---------- levhalar (kameraya dönük çizimler) ---------- */
  function board(c, wM, hM, anchorY, o) {
    const m = new T3.SpriteMaterial(Object.assign({ map: tex(c), alphaTest: .5, fog: true }, o || {})); const s = new T3.Sprite(m); s.scale.set(wM, hM, 1); s.center.set(.5, anchorY); return s;
  }
  const charTex = new Map();
  function charCanvas(fn, o, box, noShadow) { // box: [w,h,ox,oy] karakter biriminde (s=1)
    const key = fn + JSON.stringify(o); let t = charTex.get(key); if (t) return t;
    const sc = .8, c = canvasOf(box[0], box[1], sc, g => { g.translate(box[2], box[3]); const run = () => S[fn](g, Object.assign({ x: 0, y: 0, s: 1 }, o));
      if (noShadow) { const oe = g.ellipse; let first = true; g.ellipse = function () { if (first) { first = false; return; } return oe.apply(this, arguments); }; run(); g.ellipse = oe; } else run(); }, true, .16);
    t = tex(c); charTex.set(key, t); return t;
  }
  const KBOX = [380, 660, 190, 632];
  function treeCanvas(sd) { return canvasOf(360, 460, .8, g => { g.translate(180, 440); const x = 0, G = 0, r = rnd(sd), h = 250 + r() * 90; S.seed(sd);
    S.shape(g, [[x - 13, G + 6], [x - 8, G - h * .55], [x + 8, G - h * .55], [x + 14, G + 6]], '#6b4423', { lw: 3.6, shade: c => S.blot(c, rect(x + 2, G - h, 20, h + 10), '#000', .25) });
    [[0, -h * .78, 92, 80, '#6f8046'], [-64, -h * .6, 62, 54, P.weed], [62, -h * .62, 66, 56, '#62733d'], [8, -h * 1.02, 64, 54, P.weed]].forEach(([dx, dy, rx, ry, col]) =>
      S.shape(g, S.ell(x + dx, G + dy, rx, ry, 22), col, { lw: 3.6, amp: 4, shade: c => { S.blot(c, S.ell(x + dx + rx * .4, G + dy + ry * .4, rx * .8, ry * .7, 12), '#3f4d28', .4); S.blot(c, S.ell(x + dx - rx * .35, G + dy - ry * .4, rx * .4, ry * .3, 10), '#a5b46a', .5); } })); }, true); }
  function lampCanvas() { return canvasOf(240, 460, .8, g => { g.translate(90, 450); const x = 0, G = -62; S.seed(77); S.line(g, [[x, G + 62], [x, G - 330]], 9, P.steelDk, .6); S.line(g, [[x, G - 330], [x + 14, G - 356], [x + 70, G - 360]], 7, P.steelDk, .5);
    S.shape(g, [[x + 50, G - 362], [x + 104, G - 362], [x + 96, G - 340], [x + 58, G - 340]], P.steel, { lw: 3 }); S.shape(g, S.ell(x + 77, G - 338, 16, 8, 10, 0, Math.PI), P.lightOn, { lw: 2.4 }); S.shape(g, rect(x - 12, G + 52, 24, 14), P.steelDk, { lw: 2.6 }); }, true); }
  function bubbleCanvas(text) { return canvasOf(520, 120, 1, g => { g.font = "34px 'Lilita One', sans-serif"; const w = Math.min(500, g.measureText(text).width + 48), x = 260, y = 84; S.seed(88);
    S.shape(g, [[x - w / 2, y - 70], [x + w / 2, y - 70], [x + w / 2, y], [x + 26, y], [x + 8, y + 28], [x + 2, y], [x - w / 2, y]], P.paper, { lw: 4 }); g.fillStyle = P.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y - 34); }, true, 0); }
  function blob(r) { const m = new T3.Mesh(new T3.CircleGeometry(r, 20), new T3.MeshBasicMaterial({ color: 0x15120d, transparent: true, opacity: .26, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m; }

  /* ---------- dünya ---------- */
  const NB = 4, B = 64, RW = 16, HALF = (NB * B + (NB + 1) * RW) / 2, SW = 5;
  const b0 = i => -HALF + RW + i * (B + RW);
  const inBlock = (x, z) => { for (let i = 0; i < NB; i++) { const a = b0(i); if (x >= a && x <= a + B) { for (let j = 0; j < NB; j++) { const c = b0(j); if (z >= c && z <= c + B) return true; } } } return false; };
  const groundY = (x, z) => inBlock(x, z) ? .18 : 0;
  const YARD = [1, 1], TOWER = [2, 2], PARK = [0, 2];
  const npcs = []; let daisy = null, player, pShadow, hint;
  const tick = [];
  function buildWorld() {
    const R = rnd(2026);
    // gök ve uzak şehir
    scene.background = tex(canvasOf(16, 512, 1, g => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, P.sky0); gr.addColorStop(.55, P.sky1); gr.addColorStop(.8, P.sky2); gr.addColorStop(1, P.sky2); g.fillStyle = gr; g.fillRect(0, 0, 16, 512); }, false, .12));
    const ringC = canvasOf(2048, 300, 1, g => { [[P.far, '#a7b4bc', 60, 190, 31, 0], [P.far2, '#8b9aa5', 40, 130, 57, 1]].forEach(([col, inkc, hmin, hmax, sd, win]) => { const r = rnd(sd); S.seed(sd); let x = 0; while (x < 2048) { const bw = 40 + r() * 70, bh = hmin + r() * (hmax - hmin), w2 = Math.min(bw, 2048 - x);
      S.shape(g, rect(x, 300 - bh, w2, bh + 10), col, { lw: 2.4, ink: inkc, amp: .7 }); if (win) { g.fillStyle = P.farWin; g.globalAlpha = .55; for (let wy = 300 - bh + 14; wy < 290; wy += 24) for (let wx = x + 8; wx < x + w2 - 12; wx += 18) if (r() < .7) g.fillRect(wx, wy, 8, 11); g.globalAlpha = 1; } x += bw; } }); }, true);
    const rt = tex(ringC, true); rt.repeat.set(3, 1);
    const ring = new T3.Mesh(new T3.CylinderGeometry(330, 330, 95, 48, 1, true), new T3.MeshBasicMaterial({ map: rt, side: T3.BackSide, transparent: true, fog: false, depthWrite: false })); ring.position.y = 44; scene.add(ring);
    const cloudC = [0, 1, 2].map(i => canvasOf(420, 180, .7, g => { g.translate(210, 90); S.seed(70 + i); [[0, 0, 120, 44], [-100, 16, 80, 32], [96, 12, 90, 36], [20, -28, 70, 30]].forEach(([dx, dy, rx, ry]) => S.blot(g, S.ell(dx, dy, rx * (1 + i * .15), ry, 20), P.cloud, 1)); }, true, .1));
    for (let i = 0; i < 14; i++) { const a = R() * TAU, d = 200 + R() * 110, s = board(cloudC[i % 3], 70 + R() * 50, 30 + R() * 16, .5, { fog: false, alphaTest: 0, transparent: true, opacity: .92, depthWrite: false }); s.position.set(Math.sin(a) * d, 70 + R() * 50, Math.cos(a) * d); scene.add(s); }
    // zemin dokuları
    const asphalt = tex(canvasOf(512, 512, 1, g => { const r = rnd(5); g.fillStyle = '#5b5a5c'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 40; i++) S.blot(g, S.ell(r() * 512, r() * 512, 20 + r() * 60, 8 + r() * 20, 10), r() < .5 ? '#4b4a4d' : '#6a696b', .4); }), true);
    asphalt.repeat.set(HALF * 2 / 8, HALF * 2 / 8);
    const road = new T3.Mesh(new T3.PlaneGeometry(HALF * 2 + 300, HALF * 2 + 300), mat(asphalt)); asphalt.repeat.set((HALF * 2 + 300) / 8, (HALF * 2 + 300) / 8); road.rotation.x = -Math.PI / 2; scene.add(road);
    const paveC = canvasOf(256, 256, 1, g => { const r = rnd(8); g.fillStyle = '#cfc6b3'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 10; i++) S.blot(g, S.ell(r() * 256, r() * 256, 20 + r() * 40, 8 + r() * 14, 10), '#a89f8c', .3); g.strokeStyle = 'rgba(21,18,13,.4)'; g.lineWidth = 3; [0, 128].forEach(v => { g.beginPath(); g.moveTo(v, 0); g.lineTo(v + 3, 256); g.stroke(); g.beginPath(); g.moveTo(0, v); g.lineTo(256, v + 3); g.stroke(); }); });
    const grassC = canvasOf(256, 256, 1, g => { const r = rnd(9); g.fillStyle = '#8e9a5e'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 16; i++) S.blot(g, S.ell(r() * 256, r() * 256, 20 + r() * 40, 10 + r() * 20, 10), r() < .5 ? '#7d8a4a' : '#a5b46a', .4); g.strokeStyle = '#62733d'; g.lineWidth = 3; for (let i = 0; i < 40; i++) { const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y - 12); g.moveTo(x, y); g.lineTo(x + 5, y - 14); g.stroke(); } });
    const dirtC = canvasOf(256, 256, 1, g => { const r = rnd(10); g.fillStyle = P.ground; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 18; i++) S.blot(g, S.ell(r() * 256, r() * 256, 20 + r() * 50, 8 + r() * 14, 10), r() < .5 ? P.groundDk : P.groundLt, .35); });
    const dashT = tex(canvasOf(32, 512, 1, g => { g.fillStyle = P.paper; g.globalAlpha = .9; g.fillRect(4, 0, 24, 200); }, true, .1), true);
    const curbM = new T3.MeshBasicMaterial({ color: 0x8e8674 });
    const slabTex = (c, rep) => { const t = tex(c, true); t.repeat.set(rep, rep); return t; };
    const paveM = mat(slabTex(paveC, B / 4)), slabG = new T3.BoxGeometry(B, .18, B), slabM = [], grassM = [], innerR = B - (SW + DEPTH) * 2, grassG = new T3.PlaneGeometry(innerR, innerR); grassG.rotateX(-Math.PI / 2);
    const treeSets = treeC.map(c => boardSet(c, 20 / 460)), lampSet = boardSet(lampC, 10 / 460);
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const x0 = b0(i), z0 = b0(j), cx = x0 + B / 2, cz = z0 + B / 2;
      slabM.push(mat4(cx, .09, cz)); addEdges(slabG, mat4(cx, .09, cz));
      const isYard = i === YARD[0] && j === YARD[1], isTower = i === TOWER[0] && j === TOWER[1], isPark = i === PARK[0] && j === PARK[1];
      const inner = isYard || isPark ? B - SW * 2 : B - (SW + DEPTH) * 2, it = isYard ? dirtC : grassC;
      if (isYard || isPark) { const ip = new T3.Mesh(new T3.PlaneGeometry(inner, inner), mat(slabTex(it, inner / 5))); ip.rotation.x = -Math.PI / 2; ip.position.set(cx, .2, cz); scene.add(ip); } else if (!isTower) grassM.push(mat4(cx, .2, cz));
      // kaldırım ağaçları ve lambaları
      for (let k = 0; k < 4; k++) for (let t = 8; t < B - 4; t += 16) { const along = t + (k % 2 ? 8 : 0); if (along > B - 4) continue; const px = k === 0 || k === 2 ? x0 + along : (k === 1 ? x0 + B - 1.3 : x0 + 1.3), pz = k === 0 ? z0 + 1.3 : k === 2 ? z0 + B - 1.3 : z0 + along;
        if ((t / 16 + k) % 2 < 1) { const sc = .0125 * (1 + R() * .25); treeSets[Math.floor(R() * treeSets.length)].add(px, .18, pz, 360 * sc, 460 * sc); }
        else lampSet.add(px, .18, pz, 240 * .0135, 460 * .0135); }
      if (isYard) { buildYard(x0, z0); continue; }
      if (isTower) { buildTower(cx, cz); continue; }
      if (isPark) { buildPark(x0, z0, R, treeSets); continue; }
      // dört kenara binalar
      const line = (len, maxW) => { const out = []; let sum = 0, guard = 0; while (guard++ < 40) { const v = variants[Math.floor(R() * variants.length)]; if (sum + v.w > len) { if (len - sum < 11.5 || guard > 30) break; continue; } out.push(v); sum += v.w; } const gap = (len - sum) / (out.length + 1); return { out, gap }; };
      [0, 2].forEach(rot => { const { out, gap } = line(B - SW * 2); let px = x0 + SW + gap; out.forEach(v => { addBuilding(v, px + v.w / 2, rot === 0 ? z0 + B - SW - DEPTH / 2 : z0 + SW + DEPTH / 2, rot); px += v.w + gap; }); });
      [1, 3].forEach(rot => { const { out, gap } = line(B - (SW + DEPTH) * 2 - 1); let pz = z0 + SW + DEPTH + .5 + gap; out.forEach(v => { addBuilding(v, rot === 1 ? x0 + B - SW - DEPTH / 2 : x0 + SW + DEPTH / 2, pz + v.w / 2, rot); pz += v.w + gap; }); });
    }
    // yol çizgileri (tek örneklenmiş ağ)
    dashT.repeat.set(1, B / 8); const dashG = new T3.PlaneGeometry(.32, B); dashG.rotateX(-Math.PI / 2); const dashM = [];
    for (let k = 0; k <= NB; k++) { const c = -HALF + RW / 2 + k * (B + RW); for (let i = 0; i < NB; i++) { const a2 = b0(i) + B / 2; dashM.push(mat4(c, .02, a2, 0), mat4(a2, .02, c, Math.PI / 2)); } }
    instanced(dashG, new T3.MeshBasicMaterial({ map: dashT, alphaTest: .4 }), dashM);
    instanced(slabG, [curbM, curbM, paveM, curbM, curbM, curbM], slabM);
    instanced(grassG, mat(slabTex(grassC, innerR / 5)), grassM);
    variants.forEach(v => { if (v.inst.length) instanced(v.geo, v.mats, v.inst); });
    // dünya sınırı: tehlike şeritli bariyer
    const barC = canvasOf(512, 96, 1, g => { S.seed(3); const p = S.pathOf(rect(0, 8, 512, 60), true); S.hazardStripes(g, p, -4, 4, 520, 68, 26); g.fillStyle = P.ink; g.fillRect(0, 6, 512, 5); g.fillRect(0, 64, 512, 5); g.fillStyle = P.steelDk; [40, 296].forEach(x => g.fillRect(x, 60, 14, 36)); }, true);
    const bt = tex(barC, true); bt.repeat.set(HALF * 2 / 8, 1); const bm = new T3.MeshBasicMaterial({ map: bt, alphaTest: .4, side: T3.DoubleSide });
    [[0, -HALF + 2, 0], [0, HALF - 2, 0], [-HALF + 2, 0, 1], [HALF - 2, 0, 1]].forEach(([x, z, r]) => { const m = new T3.Mesh(new T3.PlaneGeometry(HALF * 2, 1.5), bm); m.position.set(x, .75, z); if (r) m.rotation.y = Math.PI / 2; scene.add(m); });
    flushMerged();
  }
  let treeC = [], lampC;
  function fenceRun(x0, z0, x1, z1, signText) {
    const len = Math.hypot(x1 - x0, z1 - z0); if (!fenceRun.c) fenceRun.c = canvasOf(256, 128, 1, g => { g.strokeStyle = 'rgba(42,45,52,.75)'; g.lineWidth = 2.4; g.beginPath(); for (let i = -128; i < 256 + 128; i += 21.33) { g.moveTo(i, 128); g.lineTo(i + 128, 0); g.moveTo(i, 0); g.lineTo(i + 128, 128); } g.stroke(); g.fillStyle = P.steelDk; g.fillRect(0, 0, 256, 7); g.fillRect(0, 121, 256, 7); g.fillRect(0, 0, 9, 128); }, true, .1);
    const t = tex(fenceRun.c, true); t.repeat.set(len / 4, 1);
    const m = new T3.Mesh(new T3.PlaneGeometry(len, 2.2), new T3.MeshBasicMaterial({ map: t, alphaTest: .35, side: T3.DoubleSide })); m.position.set((x0 + x1) / 2, .18 + 1.1, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); scene.add(m);
    const pad = .25; solids.push({ x0: Math.min(x0, x1) - pad, x1: Math.max(x0, x1) + pad, z0: Math.min(z0, z1) - pad, z1: Math.max(z0, z1) + pad });
    if (signText) { const c = canvasOf(420, 90, 1, g => sign(g, 8, 8, 404, 74, signText, P.hazard, P.ink), true, .12); const s = new T3.Mesh(new T3.PlaneGeometry(4.2, .9), new T3.MeshBasicMaterial({ map: tex(c), alphaTest: .4, side: T3.DoubleSide })); s.position.copy(m.position); s.position.y = 1.9; s.rotation.y = m.rotation.y; s.translateZ(.06); scene.add(s); }
  }
  function buildYard(x0, z0) {
    const a = x0 + SW, b = x0 + B - SW, c = z0 + SW, d = z0 + B - SW, gate = x0 + B / 2;
    fenceRun(a, c, b, c); fenceRun(a, c, a, d); fenceRun(b, c, b, d); fenceRun(a, d, gate - 5, d, 'KAYA DEMOLITION'); fenceRun(gate + 5, d, b, d, 'KEEP OUT');
    // baraka
    const sw = 9, sh = 3.8, sd = 6, fr = tex(canvasOf(sw / U, sh / U, TS, g => { const w = sw / U, h = sh / U; S.seed(9); S.shape(g, rect(0, 0, w, h), '#9aa59c', { lw: 6, shade: cc => { cc.strokeStyle = 'rgba(21,18,13,.18)'; cc.lineWidth = 2; for (let xx = 10; xx < w; xx += 16) { cc.beginPath(); cc.moveTo(xx, 0); cc.lineTo(xx, h); cc.stroke(); } S.blot(cc, S.ell(w * .7, h - 40, 60, 30, 12), P.rust, .4); } });
      S.shape(g, rect(50, h - 150, 84, 150), P.wood, { lw: 3.6 }); S.shape(g, S.ell(118, h - 72, 5, 5, 8), P.hazard, { lw: 2 }); windowAt(g, 200, h - 170, 120, 84, rnd(5)); sign(g, 170, 14, w - 200, 46, 'OFFICE', P.paper, P.ink); }));
    const sdT = tex(canvasOf(sd / U, sh / U, TS, g => { const w = sd / U, h = sh / U; S.seed(10); S.shape(g, rect(0, 0, w, h), '#8a958c', { lw: 6, shade: cc => { cc.strokeStyle = 'rgba(21,18,13,.18)'; cc.lineWidth = 2; for (let xx = 10; xx < w; xx += 16) { cc.beginPath(); cc.moveTo(xx, 0); cc.lineTo(xx, h); cc.stroke(); } } }); }));
    const roofM = new T3.MeshBasicMaterial({ color: 0x4f5953 }), shed = new T3.Mesh(new T3.BoxGeometry(sw, sh, sd), [mat(sdT), mat(sdT), roofM, roofM, mat(fr), mat(sdT)]); const sx = a + 9, sz = c + 7; shed.position.set(sx, sh / 2 + .2, sz); scene.add(shed);
    addEdges(shed.geometry, mat4(sx, sh / 2 + .2, sz)); solids.push({ x0: sx - sw / 2, x1: sx + sw / 2, z0: sz - sd / 2, z1: sz + sd / 2 });
    // Daisy
    const DB = [1300, 1180, 340, 1110], k = CU * 1.25; daisy = { x: b - 22, z: c + 20, beepT: -9, on: false, box: DB };
    daisy.tex = [charCanvas('drawDaisy', { beep: 0, mood: 'sleepy', boom: .35 }, DB), charCanvas('drawDaisy', { beep: 1, mood: 'alert', boom: .35 }, DB)];
    daisy.sp = new T3.Sprite(new T3.SpriteMaterial({ map: daisy.tex[0], alphaTest: .5, fog: true })); daisy.sp.scale.set(DB[0] * k, DB[1] * k, 1); daisy.sp.center.set(DB[2] / DB[0], 1 - DB[3] / DB[1]); daisy.sp.position.set(daisy.x, .2, daisy.z); scene.add(daisy.sp);
    solids.push({ x0: daisy.x - 1.6, x1: daisy.x + 3.4, z0: daisy.z - 1.4, z1: daisy.z + 1.4 });
    hint = board(bubbleCanvas('Press BEEP'), 5.2 * .7, 1.2 * .7, 0, { alphaTest: .3 }); hint.position.set(daisy.x + .6, 5.6, daisy.z); hint.visible = false; scene.add(hint);
  }
  function buildTower(cx, cz) {
    const w = 34, h = 78, c = canvasOf(680, 1560, 1, g => { const r = rnd(41); S.seed(41); const W = 680, Hh = 1560, base = 130;
      S.shape(g, rect(0, 0, W, Hh), '#7fa3b8', { lw: 8, shade: cc => { const gr = cc.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(15,40,60,.3)'); cc.fillStyle = gr; cc.fillRect(0, 0, W, Hh);
        for (let i = 0; i < 70; i++) { cc.fillStyle = r() < .5 ? 'rgba(255,255,255,.2)' : 'rgba(20,50,70,.22)'; cc.fillRect(Math.floor(r() * 8) * (W / 8), Math.floor(r() * 26) * 55, W / 8, 55); }
        cc.fillStyle = 'rgba(255,255,255,.16)'; cc.beginPath(); cc.moveTo(0, 900); cc.lineTo(W, 500); cc.lineTo(W, 640); cc.lineTo(0, 1040); cc.fill(); } });
      for (let i = 1; i < 8; i++) S.line(g, [[i * W / 8, 0], [i * W / 8, Hh - base]], 3.4, '#3d5a69', .6); for (let y = 55; y < Hh - base; y += 55) S.line(g, [[0, y], [W, y]], 3, '#3d5a69', .6);
      S.shape(g, rect(-10, Hh - base, W + 20, base + 10), '#d3c9b6', { lw: 6 }); S.shape(g, rect(W / 2 - 60, Hh - 96, 120, 96), '#2b4552', { lw: 4.4 }); S.line(g, [[W / 2, Hh - 96], [W / 2, Hh]], 3.4);
      g.font = "44px 'Lilita One', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = P.ink; g.strokeText('HALE TOWER', W / 2, Hh - 112); g.fillStyle = P.hazardHi; g.fillText('HALE TOWER', W / 2, Hh - 112);
      S.line(g, [[W * .2, Hh], [W * .24, Hh - 50], [W * .2, Hh - 96], [W * .25, Hh - 130]], 3.4, P.soot, 2); });
    const t = tex(c), fm = mat(t), sm = mat(t, { color: 0xd4dde2 }), rm = new T3.MeshBasicMaterial({ color: 0x4f7183 }), m = new T3.Mesh(new T3.BoxGeometry(w, h, w), [sm, sm, rm, rm, fm, fm]); m.position.set(cx, h / 2 + .18, cz); scene.add(m);
    addEdges(m.geometry, mat4(cx, h / 2 + .18, cz)); solids.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - w / 2, z1: cz + w / 2 });
    const z = cz + w / 2 + 6;
    addNpc('drawHale', { expr: 'confident' }, { expr: 'serious' }, [480, 680, 240, 648], cx - 5, z, 'You rush the first move.', 1);
    const CB = [1080, 420, 540, 390], car = board(charCanvas('drawCar', { view: 'side' }, CB), CB[0] * CU * 1.15, CB[1] * CU * 1.15, 1 - CB[3] / CB[1]); car.position.set(cx + 4, 0, cz + B / 2 + 3.2); scene.add(car); solids.push({ x0: cx + 1.2, x1: cx + 6.8, z0: cz + B / 2 + 2.2, z1: cz + B / 2 + 4.2 });
  }
  function buildPark(x0, z0, R, treeSets) {
    const cx = x0 + B / 2, cz = z0 + B / 2;
    for (let i = 0; i < 22; i++) { const px = x0 + 8 + R() * (B - 16), pz = z0 + 8 + R() * (B - 16); if (Math.hypot(px - cx, pz - cz) < 9) continue; const sc = .016 * (1 + R() * .3); treeSets[i % treeSets.length].add(px, .2, pz, 360 * sc, 460 * sc); solids.push({ x0: px - .35, x1: px + .35, z0: pz - .35, z1: pz + .35 }); }
    const bt = tex(canvasOf(512, 512, 1, g => { const r = rnd(12); g.fillStyle = P.brick; g.fillRect(0, 0, 512, 512); for (let y = 0; y < 512; y += 32) { g.fillStyle = 'rgba(21,18,13,.35)'; g.fillRect(0, y, 512, 3); for (let x = (y / 32 % 2) * 32; x < 512; x += 64) g.fillRect(x, y, 3, 32); } texture(g, 0, 0, 512, 512, r, P.brickLt, P.brickDk, 80); }), true); bt.repeat.set(3, 6);
    const ch = new T3.Mesh(new T3.CylinderGeometry(1.1, 1.8, 26, 14), mat(bt)); ch.position.set(cx, 13.2, cz); scene.add(ch);
    const top = new T3.Mesh(new T3.CylinderGeometry(1.35, 1.25, 1.2, 14), new T3.MeshBasicMaterial({ color: 0x3a2c24 })); top.position.set(cx, 26.4, cz); scene.add(top);
    solids.push({ x0: cx - 1.8, x1: cx + 1.8, z0: cz - 1.8, z1: cz + 1.8 });
  }
  function addNpc(fn, o, near, box, x, z, say, k) {
    const n = { fn, o, near, box, x, z, say, st: '' }; k = (k || 1) * CU;
    n.sp = new T3.Sprite(new T3.SpriteMaterial({ map: charCanvas(fn, o, box), alphaTest: .5, fog: true })); n.sp.scale.set(box[0] * k, box[1] * k, 1); n.sp.center.set(.5, 1 - box[3] / box[1]); n.sp.position.set(x, .18, z); scene.add(n.sp);
    n.bub = board(bubbleCanvas(say), 5.2 * .62, 1.2 * .62, 0, { alphaTest: .3 }); n.bub.position.set(x, .18 + box[3] * k + .15, z); n.bub.visible = false; scene.add(n.bub); npcs.push(n);
  }

  /* ---------- oyuncu ---------- */
  const pl = { x: 0, z: 0, y: 0, vy: 0, face: Math.PI, phase: 0, idle: 9, moving: false, speed: 0 };
  const camS = { yaw: Math.PI, pitch: .16, dist: 5.4 };
  const input = { jx: 0, jy: 0, run: 0, jump: 0, act: 0, kx: 0, ky: 0 };
  function collide(x, z, r) { for (let it = 0; it < 2; it++) for (const s of solids) { const nx = clamp(x, s.x0, s.x1), nz = clamp(z, s.z0, s.z1), dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz; if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; } else { const l = x - s.x0, rr = s.x1 - x, t = z - s.z0, b = s.z1 - z, m = Math.min(l, rr, t, b); if (m === l) x = s.x0 - r; else if (m === rr) x = s.x1 + r; else if (m === t) z = s.z0 - r; else z = s.z1 + r; } } } return [x, z]; }
  const inside = (x, z) => { for (const s of solids) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true; return false; };

  /* ---------- ses ---------- */
  let AC = null;
  function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f, t0, d, v, type) { const a = audio(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0; o.type = type || 'square'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .012); g.gain.setValueAtTime(v, t + d - .03); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02); }
  function stepSnd() { const a = audio(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(70, t + .06); g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08); o.connect(g).connect(a.destination); o.start(t); o.stop(t + .1); }

  /* ---------- döngü ---------- */
  let now = 0, last = 0, ready = false, fpsN = 0, fpsT = 0, lastSg = 1;
  const fpsEl = document.getElementById('fps'), actBtn = document.getElementById('bAct'), V = new T3.Vector3();
  function update(dt) {
    let jx = clamp(input.jx + input.kx, -1, 1), jy = clamp(input.jy + input.ky, -1, 1); const mag = Math.min(1, Math.hypot(jx, jy));
    const fx = Math.sin(camS.yaw), fz = Math.cos(camS.yaw), rx = -fz, rz = fx;
    if (mag > .12) {
      const sp = (input.run ? 7.2 : 3.4) * (mag > .6 ? 1 : mag / .6), mx = (fx * jy + rx * jx) / mag, mz = (fz * jy + rz * jx) / mag;
      const [nx, nz] = collide(pl.x + mx * sp * dt, pl.z + mz * sp * dt, .45); pl.x = clamp(nx, -HALF + 3, HALF - 3); pl.z = clamp(nz, -HALF + 3, HALF - 3);
      pl.face = Math.atan2(mx, mz); pl.phase += sp * dt * (input.run ? 1.5 : 2.3); pl.moving = true; pl.idle = 0; pl.speed = sp;
      if (jy > -.3) camS.yaw = wrapA(camS.yaw - jx * 1.25 * dt); // sağa-sola basınca kamera da döner (dönerek yürüme)
    } else { pl.moving = false; pl.idle += dt; }
    const gy = groundY(pl.x, pl.z);
    if (input.jump) { input.jump = 0; if (pl.y <= gy + .01) { pl.vy = 5.6; tone(520, 0, .07, .04, 'sine'); } }
    if (pl.vy !== 0 || pl.y > gy) { pl.vy -= 16 * dt; pl.y += pl.vy * dt; if (pl.y <= gy) { pl.y = gy; pl.vy = 0; stepSnd(); } } else pl.y += (gy - pl.y) * Math.min(1, dt * 14);
    const sg = Math.sign(Math.sin(pl.phase)); if (pl.moving && pl.vy === 0 && sg !== lastSg) { lastSg = sg; stepSnd(); }
    // Kaan'ın pozu: yürüdüğü yön ile kameranın baktığı yön arasındaki açıya göre arka / yan / ön çizim
    const rel = wrapA(pl.face - camS.yaw), ar = Math.abs(rel), air = pl.y > gy + .05;
    const st = air ? .7 : pl.moving ? Math.round(Math.sin(pl.phase) * 3) / 3 : 0; let o;
    if (ar < .87) o = { pose: 'back', step: st };
    else if (ar > 2.27) o = air ? { expr: 'surprised', step: st } : { expr: input.run && pl.moving ? 'determined' : pl.idle > 5 ? 'smile' : 'calm', step: st, blink: !pl.moving && (now % 3.1) < .11 ? 1 : 0 };
    else o = { pose: 'side', step: st, flip: rel > 0, expr: air ? 'surprised' : input.run ? 'determined' : 'calm' };
    const t = charCanvas('drawKaan', o, KBOX, true); if (player.material.map !== t) { player.material.map = t; }
    const bob = pl.moving && !air ? Math.abs(Math.cos(pl.phase)) * (input.run ? .07 : .04) : 0;
    player.position.set(pl.x, pl.y + bob, pl.z); pShadow.position.set(pl.x, gy + .03, pl.z); const hs = 1 - Math.min(.5, (pl.y - gy) / 3); pShadow.scale.set(hs, hs, 1);
    // Daisy ve kişiler
    const dd = Math.hypot(pl.x - daisy.x - 1, pl.z - daisy.z), nearD = dd < 7; if (actBtn.disabled === nearD) actBtn.disabled = !nearD;
    if (input.act) { input.act = 0; if (nearD && now - daisy.beepT > .9) { daisy.beepT = now; tone(1320, 0, .2, .09); tone(1320, .33, .2, .09); } }
    const bt = now - daisy.beepT, on = (bt >= 0 && bt < .2) || (bt >= .33 && bt < .53); if (on !== daisy.on) { daisy.on = on; daisy.sp.material.map = daisy.tex[on ? 1 : 0]; }
    hint.visible = nearD && bt > 1.2;
    npcs.forEach(n => { const near = Math.hypot(pl.x - n.x, pl.z - n.z) < 5.5, bl = ((now + n.x) % 3.7) < .12, key = (near ? 'n' : '') + (bl ? 'b' : ''); if (key !== n.st) { n.st = key; n.sp.material.map = charCanvas(n.fn, Object.assign({}, n.o, near ? n.near : null, { blink: bl ? 1 : 0 }), n.box); } n.bub.visible = near; });
    // kamera: oyuncunun arkasında; araya bina girerse yaklaşır
    const cp = Math.cos(camS.pitch), sp2 = Math.sin(camS.pitch), tx = pl.x, ty = pl.y + 1.45, tz = pl.z; let d = camS.dist;
    for (let k = 1; k <= 12; k++) { const dk = camS.dist * k / 12; if (inside(tx - fx * cp * dk, tz - fz * cp * dk)) { d = Math.max(1.2, camS.dist * (k - 1) / 12 - .3); break; } }
    camS.cur = camS.cur == null ? d : camS.cur + (d - camS.cur) * Math.min(1, dt * (d < camS.cur ? 18 : 4));
    cam.position.set(tx - fx * cp * camS.cur, Math.max(.5, ty + sp2 * camS.cur), tz - fz * cp * camS.cur); cam.lookAt(V.set(tx, ty + .35, tz)); boardsUpdate();
  }
  function frame(t) {
    requestAnimationFrame(frame); if (!ready) return;
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; now += dt; update(dt); renderer.render(scene, cam);
    fpsN++; if (t - fpsT > 500) { fpsEl.textContent = Math.round(fpsN * 1000 / (t - fpsT)) + ' kare/sn'; fpsN = 0; fpsT = t; }
  }

  /* ---------- hep yatay sahne ---------- */
  let rot = false, SWd = 800, SHt = 400;
  function layout() {
    const wr = document.getElementById('wrap').getBoundingClientRect(), W = wr.width, H = wr.height; rot = H > W;
    SWd = rot ? H : W; SHt = rot ? W : H; stage.style.width = SWd + 'px'; stage.style.height = SHt + 'px'; stage.style.transform = rot ? `translate(${W}px,0) rotate(90deg)` : 'none';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(SWd, SHt, false); cam.aspect = SWd / SHt; cam.fov = SWd / SHt > 1.9 ? 52 : 58; cam.updateProjectionMatrix();
  }
  const toStage = e => { const wr = document.getElementById('wrap').getBoundingClientRect(), x = e.clientX - wr.left, y = e.clientY - wr.top; return rot ? [y, wr.width - x] : [x, y]; };
  const joy = document.getElementById('joy'), knob = document.getElementById('knob'); let joyId = null, joyC = [0, 0], camId = null, camL = [0, 0];
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.btn')) return; e.preventDefault(); audio(); const [x, y] = toStage(e);
    if (joyId === null && x < SWd * .42) { joyId = e.pointerId; joyC = [clamp(x, 80, SWd * .42), clamp(y, 80, SHt - 80)]; joy.style.left = (joyC[0] - 66) + 'px'; joy.style.bottom = 'auto'; joy.style.top = (joyC[1] - 66) + 'px'; }
    else if (camId === null) { camId = e.pointerId; camL = [x, y]; }
    try { stage.setPointerCapture(e.pointerId); } catch (x2) { }
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerId === joyId) { const [x, y] = toStage(e); let dx = x - joyC[0], dy = y - joyC[1]; const m = Math.hypot(dx, dy), R = 52; if (m > R) { dx *= R / m; dy *= R / m; } input.jx = dx / R; input.jy = -dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === camId) { const [x, y] = toStage(e); camS.yaw = wrapA(camS.yaw - (x - camL[0]) * .0075); camS.pitch = clamp(camS.pitch + (y - camL[1]) * .005, -.12, 1.1); camL = [x, y]; }
  });
  const endP = e => { if (e.pointerId === joyId) { joyId = null; input.jx = input.jy = 0; knob.style.transform = 'none'; } if (e.pointerId === camId) camId = null; };
  stage.addEventListener('pointerup', endP); stage.addEventListener('pointercancel', endP); stage.addEventListener('contextmenu', e => e.preventDefault());
  const hold = (id, k, tap) => { const el = document.getElementById(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audio(); input[k] = 1; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (x) { } });
    const up = () => { if (!tap) input[k] = 0; el.classList.remove('on'); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up); };
  hold('bRun', 'run'); hold('bJump', 'jump', true); hold('bAct', 'act', true);
  const KD = {}; const keySync = () => { input.kx = (KD.d || KD.ArrowRight ? 1 : 0) - (KD.a || KD.ArrowLeft ? 1 : 0); input.ky = (KD.w || KD.ArrowUp ? 1 : 0) - (KD.s || KD.ArrowDown ? 1 : 0); };
  addEventListener('keydown', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift', 'e'].includes(k)) e.preventDefault(); audio(); KD[k] = 1; keySync(); if (k === 'Shift') input.run = 1; if (k === ' ' && !e.repeat) input.jump = 1; if (k === 'e' && !e.repeat) input.act = 1; });
  addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; KD[k] = 0; keySync(); if (k === 'Shift') input.run = 0; });
  addEventListener('blur', () => { for (const k in KD) KD[k] = 0; keySync(); input.run = 0; });
  addEventListener('resize', layout); if (window.ResizeObserver) new ResizeObserver(layout).observe(document.getElementById('wrap'));
  window.__sehir = { pl, camS, input, get rot() { return rot; }, solids, renderer, scene };

  (document.fonts && document.fonts.load ? document.fonts.load("30px 'Lilita One'").catch(() => { }) : Promise.resolve()).then(() => {
    layout(); buildVariants(); treeC = [1, 2, 3].map(i => treeCanvas(60 + i * 7)); lampC = lampCanvas(); buildWorld();
    // başlangıç: avlunun önündeki yolda, avluya bakarak
    pl.x = b0(YARD[0]) + B / 2; pl.z = b0(YARD[1]) + B + 6; pl.y = 0; camS.yaw = Math.PI;
    player = new T3.Sprite(new T3.SpriteMaterial({ map: charCanvas('drawKaan', { pose: 'back', step: 0 }, KBOX, true), alphaTest: .5, fog: true })); player.scale.set(KBOX[0] * CU, KBOX[1] * CU, 1); player.center.set(.5, 1 - KBOX[3] / KBOX[1]); scene.add(player);
    pShadow = blob(.42); scene.add(pShadow);
    addNpc('drawDefne', { item: 'coffee', expr: 'calm' }, { expr: 'smile' }, [400, 640, 200, 612], pl.x + 9, pl.z + 12.5, 'Hey, Ant. Coffee?', 1);
    update(0); renderer.render(scene, cam); document.getElementById('load').hidden = true; ready = true;
  });
  requestAnimationFrame(frame);
})();
