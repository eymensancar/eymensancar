/* Two Beeps Sokağı — yürüme prototipi. Çizimler animasyonla aynı kitaplıktan (cizim.js) gelir; sadeleştirme yok.
   Hız için: her şey bir kez çizilip tuvale saklanır (sokak 800 birimlik parçalar hâlinde, karakter pozları tek tek),
   ekranda görünmeyen parça hiç çizilmez, uzak şehir katmanları daha düşük çözünürlükte saklanır. */
(function () {
  'use strict';
  const S = Cizim, P = S.PAL, TAU = Math.PI * 2;
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const H = 1080, G = 850, WALK_Y = G + 40, WORLD = 10400, CH = 800, K = .5;
  let VW = 1920, PX = 1, camX = 0;
  const rnd = s => { let a = (s * 2654435761) >>> 0 || 9; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- saklanan tuvaller ---------- */
  function sprite(w, h, ox, oy, draw, scale, noGrain) {
    const sc = PX * (scale || 1), c = document.createElement('canvas'); c.width = Math.max(2, Math.ceil(w * sc)); c.height = Math.max(2, Math.ceil(h * sc));
    const g = c.getContext('2d'); g.scale(sc, sc); g.translate(ox, oy); draw(g);
    if (!noGrain) { const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0); S.grain(g, 0, 0, c.width, c.height, .2); g.globalCompositeOperation = 'destination-in'; g.drawImage(t, 0, 0); g.globalCompositeOperation = 'source-over'; }
    return { c, ox, oy, w, h };
  }
  const put = (sp, x, y) => ctx.drawImage(sp.c, Math.round((x - sp.ox) * PX) / PX, Math.round((y - sp.oy) * PX) / PX, sp.w, sp.h);

  /* ---------- bina ve sokak çizimleri (cizim.js'in kalemiyle) ---------- */
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
    g.font = `${Math.round(h * .66)}px 'Lilita One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = tcol || P.paper;
    let fs = h * .66; while (g.measureText(text).width > w - 24 && fs > 10) { fs -= 2; g.font = `${Math.round(fs)}px 'Lilita One', sans-serif`; }
    g.fillText(text, x + w / 2, y + h / 2 + 2);
  }
  function awning(g, x, y, w, col) {
    const p = S.shape(g, [[x, y], [x + w, y], [x + w + 16, y + 54], [x - 16, y + 54]], P.paper, { lw: 0 });
    g.save(); g.clip(p); g.fillStyle = col; for (let i = -1; i < w / 36 + 1; i += 2) g.fillRect(x - 16 + i * 36, y - 4, 36, 70); g.restore(); S.ink(g, p, 3.4);
    for (let i = 0; i < Math.floor((w + 32) / 32); i++) S.shape(g, S.ell(x - 16 + 16 + i * 32, y + 54, 16, 12, 10, 0, Math.PI), i % 2 ? col : P.paper, { lw: 2.6 });
  }
  function sideFace(g, x, w, h, d, col) { S.shape(g, [[x + w, G], [x + w + d, G - d * .4], [x + w + d, G - h - d * .4], [x + w, G - h]], col, { lw: 3.6 }); }
  function texture(c, x, y, w, h, r, lt, dk, n) { for (let i = 0; i < n; i++) { c.fillStyle = r() < .5 ? lt : dk; c.globalAlpha = .5; c.fillRect(x + r() * w, y + r() * h, 26 + r() * 18, 9); } c.globalAlpha = 1; }

  const TYPES = {
    brick: { col: P.brick, dk: P.brickDk, lt: P.brickLt, trim: P.mortar }, plaster: { col: '#d8c7a4', dk: '#b29f7c', lt: '#e9dcc0', trim: '#8a7a5c' },
    blue: { col: '#7f9aa3', dk: '#5c7780', lt: '#9db4bb', trim: P.paper }, rose: { col: '#c98d7c', dk: '#a36a5b', lt: '#dba898', trim: P.paper },
    green: { col: '#8b9a72', dk: '#687653', lt: '#a5b28d', trim: P.paper }, concrete: { col: P.concrete, dk: '#978c78', lt: '#d3c9b6', trim: '#7d7666' }
  };
  function apartment(g, b) {
    const r = rnd(b.seed), T = TYPES[b.type], { x, w, h } = b, top = G - h; S.seed(b.seed);
    sideFace(g, x, w, h, b.d || 46, T.dk);
    S.shape(g, rect(x, top, w, h), T.col, { lw: 4.2, shade: c => { texture(c, x, top, w, h, r, T.lt, T.dk, Math.round(w * h / 9000)); S.blot(c, [[x + w * .82, top - 10], [x + w + 10, top - 10], [x + w + 10, G + 10], [x + w * .78, G + 10], [x + w * .84, top + h * .5]], T.dk, .45); } });
    S.shape(g, rect(x - 10, top - 18, w + 20, 26), T.trim, { lw: 3.6 });
    const gf = 190, fl = Math.max(1, Math.round((h - gf - 30) / 140)), fh = (h - gf - 20) / fl, cols = Math.max(1, Math.floor((w - 50) / 118)), cw = (w - 50) / cols;
    for (let f = 0; f < fl; f++) for (let c = 0; c < cols; c++) {
      const wx = x + 25 + c * cw + (cw - 62) / 2, wy = top + 34 + f * fh;
      if (b.balcony && c % 2 === f % 2) { windowAt(g, wx, wy, 62, 96, r, { noSill: true }); S.shape(g, rect(wx - 18, wy + 70, 98, 34), T.dk, { lw: 3 }); for (let i = 0; i < 5; i++) S.line(g, [[wx - 10 + i * 20, wy + 72], [wx - 10 + i * 20, wy + 102]], 2, null, .3); }
      else windowAt(g, wx, wy, 62, 84, r, { sill: T.trim });
    }
    S.line(g, [[x, G - gf + 6], [x + w, G - gf + 4]], 3.4);
    if (b.shop) { // dükkân: tabela, tente, vitrin, kapı
      sign(g, x + 26, G - gf + 14, w - 52, 44, b.shop, b.signCol || P.ink, b.signCol ? P.ink : P.paper);
      const dw = 74, sx = x + 30, sw = w - 60 - dw - 16;
      S.shape(g, rect(sx, G - 118, sw, 96), '#6f95a8', { lw: 3.4, shade: c => { c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(sx, G - 60); c.lineTo(sx + 70, G - 118); c.lineTo(sx + 120, G - 118); c.lineTo(sx, G - 22); c.fill(); for (let i = 0; i < Math.floor(sw / 46); i++) { c.fillStyle = [P.hazardDeep, '#c9655a', P.paper, P.weed][i % 4]; c.beginPath(); c.arc(sx + 28 + i * 46, G - 40, 13, 0, TAU); c.fill(); } } });
      S.shape(g, rect(sx - 6, G - 22, sw + 12, 22), T.dk, { lw: 3 });
      S.shape(g, rect(x + w - 30 - dw, G - 132, dw, 132), b.door || '#3b5a4a', { lw: 3.6 }); S.shape(g, rect(x + w - 30 - dw + 12, G - 120, dw - 24, 54), '#6f95a8', { lw: 2.4 });
      awning(g, x + 22, G - gf + 62, w - 44, b.awn || '#c9655a');
    } else { // konut girişi
      const dx = x + w * (.3 + r() * .4) - 38;
      S.shape(g, rect(dx - 12, G - 152, 100, 12), T.trim, { lw: 3 }); S.shape(g, rect(dx, G - 140, 76, 140), b.door || '#4a3a2c', { lw: 3.6, shade: c => S.blot(c, rect(dx + 50, G - 150, 40, 160), '#000', .2) });
      S.shape(g, S.ell(dx + 62, G - 68, 4, 4, 8), P.hazard, { lw: 2 }); S.shape(g, rect(dx - 14, G - 8, 104, 10), P.concrete, { lw: 2.6 });
      for (let c = 0; c < cols; c++) { const wx = x + 25 + c * cw + (cw - 62) / 2; if (wx + 70 < dx - 16 || wx > dx + 96) windowAt(g, wx, G - gf + 40, 62, 84, r, { sill: T.trim }); }
    }
    // çatı ayrıntıları
    const k = r();
    if (k < .4) { const tx = x + w * (.2 + r() * .5); S.line(g, [[tx, top - 18], [tx, top - 54]], 4, P.steelDk); S.line(g, [[tx + 44, top - 18], [tx + 44, top - 54]], 4, P.steelDk); S.shape(g, rect(tx - 12, top - 104, 68, 54), '#7d6a52', { lw: 3.2, shade: c => S.blot(c, rect(tx + 34, top - 110, 30, 70), '#000', .22) }); }
    else if (k < .7) { const tx = x + w * (.3 + r() * .4); S.shape(g, rect(tx, top - 70, 34, 54), T.dk, { lw: 3.2 }); S.shape(g, rect(tx - 5, top - 80, 44, 12), P.soot, { lw: 2.6 }); }
    if (r() < .6) { const ax = x + w * (.1 + r() * .8); S.line(g, [[ax, top - 18], [ax, top - 96]], 3, P.steelDk); S.line(g, [[ax - 20, top - 84], [ax + 20, top - 88]], 2.4, P.steelDk); S.line(g, [[ax - 14, top - 70], [ax + 14, top - 72]], 2.4, P.steelDk); }
  }
  function haleTower(g, b) {
    const { x, w } = b, h = 1500, top = G - h, r = rnd(b.seed); S.seed(b.seed);
    S.shape(g, [[x + w, G], [x + w + 90, G - 36], [x + w + 90, top], [x + w, top]], '#4f7183', { lw: 3.8 });
    S.shape(g, rect(x, top, w, h), '#7fa3b8', { lw: 4.4, shade: c => { const gr = c.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(15,40,60,.3)'); c.fillStyle = gr; c.fillRect(x, top, w, h);
      for (let i = 0; i < 46; i++) { c.fillStyle = r() < .5 ? 'rgba(255,255,255,.2)' : 'rgba(20,50,70,.22)'; c.fillRect(x + Math.floor(r() * 6) * (w / 6), G - 150 - Math.floor(r() * 22) * 62, w / 6, 62); }
      c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(x, G - 500); c.lineTo(x + w, G - 900); c.lineTo(x + w, G - 760); c.lineTo(x, G - 360); c.fill(); } });
    for (let i = 1; i < 6; i++) S.line(g, [[x + i * w / 6, top], [x + i * w / 6, G - 150]], 2.4, '#3d5a69', .5);
    for (let yy = G - 150; yy > top; yy -= 62) S.line(g, [[x, yy], [x + w, yy]], 2.2, '#3d5a69', .5);
    S.shape(g, rect(x - 14, G - 150, w + 28, 150), '#d3c9b6', { lw: 4, shade: c => S.blot(c, rect(x + w * .8, G - 160, w * .3, 170), '#978c78', .5) });
    S.shape(g, rect(x + w / 2 - 80, G - 118, 160, 118), '#2b4552', { lw: 3.6 }); S.line(g, [[x + w / 2, G - 118], [x + w / 2, G]], 3);
    S.shape(g, rect(x + w / 2 - 110, G - 144, 220, 22), P.hazardDeep, { lw: 3 });
    g.font = "34px 'Lilita One', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = P.ink; g.strokeText('HALE TOWER', x + w / 2, G - 172); g.fillStyle = P.hazardHi; g.fillText('HALE TOWER', x + w / 2, G - 172);
    S.line(g, [[x + w * .2, G], [x + w * .24, G - 60], [x + w * .2, G - 110], [x + w * .25, G - 150]], 3, P.soot, 2);
  }
  function chimney(g, b) {
    const { x } = b, h = 620, r = rnd(b.seed); S.seed(b.seed);
    S.shape(g, [[x - 50, G], [x - 30, G - h], [x + 30, G - h], [x + 50, G]], P.brick, { lw: 4.4, shade: c => { texture(c, x - 50, G - h, 100, h, r, P.brickLt, P.brickDk, 60); S.blot(c, [[x + 14, G - h - 10], [x + 60, G - h - 10], [x + 60, G + 10], [x + 22, G + 10]], P.brickDk, .5); S.blot(c, rect(x - 40, G - h - 4, 80, 60), P.soot, .6); } });
    S.shape(g, rect(x - 38, G - h - 14, 76, 18), P.brickDk, { lw: 3.4 }); [.3, .6].forEach(u => S.line(g, [[x - 44 + u * 8, G - h * u], [x + 44 - u * 8, G - h * u - 2]], 5, P.steelDk, .5));
  }
  function waterTower(g, b) {
    const { x } = b, th = 560; S.seed(b.seed);
    [-110, -40, 40, 110].forEach(lx => S.line(g, [[x + lx, G], [x + lx * .55, G - th * .62]], 9, '#978c78', .5));
    for (let k = 1; k < 4; k++) { const yy = G - th * .62 * k / 4, f = 1 - .45 * k / 4; S.line(g, [[x - 110 * f, yy], [x + 110 * f, yy]], 5, '#978c78', .4); S.line(g, [[x - 110 * f, yy], [x + 110 * (1 - .45 * (k - 1) / 4), yy + th * .155]], 3, '#978c78', .4); }
    S.shape(g, [[x - 104, G - th * .62], [x + 104, G - th * .62], [x + 120, G - th * .92], [x, G - th], [x - 120, G - th * .92]], P.concrete, { lw: 4.2, shade: c => { S.blot(c, [[x + 30, G - th * 1.1], [x + 150, G - th * 1.1], [x + 150, G - th * .5], [x + 50, G - th * .5]], '#978c78', .55); S.blot(c, S.ell(x - 40, G - th * .7, 30, 50, 12), P.rust, .35); } });
    S.line(g, [[x - 118, G - th * .78], [x + 118, G - th * .78]], 3);
    for (let yy = G - th * .62; yy < G; yy += 24) S.line(g, [[x + 14, yy], [x + 40, yy]], 2.6, P.steelDk, .2); S.line(g, [[x + 14, G - th * .62], [x + 14, G]], 3, P.steelDk, .3); S.line(g, [[x + 40, G - th * .62], [x + 40, G]], 3, P.steelDk, .3);
  }
  function fence(g, b) {
    const { x, w } = b, h = b.h || 170; S.seed(b.seed);
    const p = S.pathOf(rect(x, G - h, w, h), true); g.save(); g.clip(p); g.strokeStyle = 'rgba(42,45,52,.5)'; g.lineWidth = 1.6; g.beginPath();
    for (let i = -h; i < w + h; i += 18) { g.moveTo(x + i, G); g.lineTo(x + i + h, G - h); g.moveTo(x + i, G - h); g.lineTo(x + i + h, G); } g.stroke(); g.restore();
    S.line(g, [[x, G - h], [x + w, G - h]], 5, P.steelDk, .8); for (let px = x; px <= x + w + 1; px += w / Math.round(w / 190)) S.line(g, [[px, G], [px, G - h - 10]], 7, P.steelDk, .5);
    if (b.sign) sign(g, x + w * (b.signU || .5) - 110, G - h + 24, 220, 54, b.sign, P.hazard, P.ink);
  }
  function shed(g, b) {
    const { x, w } = b, h = 300; S.seed(b.seed);
    S.shape(g, [[x + w, G], [x + w + 50, G - 20], [x + w + 50, G - h - 28], [x + w, G - h - 14]], '#7d887f', { lw: 3.6 });
    S.shape(g, [[x, G], [x, G - h], [x + w, G - h - 14], [x + w, G]], '#9aa59c', { lw: 4, shade: c => { c.strokeStyle = 'rgba(21,18,13,.18)'; c.lineWidth = 2; for (let xx = x + 10; xx < x + w; xx += 16) { c.beginPath(); c.moveTo(xx, G - h - 20); c.lineTo(xx, G); c.stroke(); } S.blot(c, S.ell(x + w * .7, G - 40, 60, 30, 12), P.rust, .4); } });
    S.shape(g, [[x - 14, G - h + 4], [x + w + 14, G - h - 12], [x + w + 14, G - h - 30], [x - 14, G - h - 14]], '#5d6862', { lw: 3.4 });
    S.shape(g, rect(x + 40, G - 190, 84, 190), P.wood, { lw: 3.6 }); S.shape(g, S.ell(x + 108, G - 96, 5, 5, 8), P.hazard, { lw: 2 });
    windowAt(g, x + 170, G - 210, 110, 80, rnd(5));
    sign(g, x + 150, G - h + 22, w - 180, 46, 'KAYA DEMOLITION', P.paper, P.ink);
  }
  function tree(g, b) {
    const { x } = b, r = rnd(b.seed), h = 250 + r() * 90; S.seed(b.seed);
    S.shape(g, [[x - 13, G + 6], [x - 8, G - h * .55], [x + 8, G - h * .55], [x + 14, G + 6]], '#6b4423', { lw: 3.6, shade: c => S.blot(c, rect(x + 2, G - h, 20, h + 10), '#000', .25) });
    [[0, -h * .78, 92, 80, '#6f8046'], [-64, -h * .6, 62, 54, P.weed], [62, -h * .62, 66, 56, '#62733d'], [8, -h * 1.02, 64, 54, P.weed]].forEach(([dx, dy, rx, ry, col]) =>
      S.shape(g, S.ell(x + dx, G + dy, rx, ry, 22), col, { lw: 3.6, amp: 4, shade: c => { S.blot(c, S.ell(x + dx + rx * .4, G + dy + ry * .4, rx * .8, ry * .7, 12), '#3f4d28', .4); S.blot(c, S.ell(x + dx - rx * .35, G + dy - ry * .4, rx * .4, ry * .3, 10), '#a5b46a', .5); } }));
    S.shape(g, rect(x - 34, G - 2, 68, 10), P.concrete, { lw: 2.6 });
  }
  function lamp(g, b) {
    const { x } = b; S.seed(b.seed); S.line(g, [[x, G + 62], [x, G - 330]], 9, P.steelDk, .6); S.line(g, [[x, G - 330], [x + 14, G - 356], [x + 70, G - 360]], 7, P.steelDk, .5);
    S.shape(g, [[x + 50, G - 362], [x + 104, G - 362], [x + 96, G - 340], [x + 58, G - 340]], P.steel, { lw: 3 }); S.shape(g, S.ell(x + 77, G - 338, 16, 8, 10, 0, Math.PI), P.lightOn, { lw: 2.4 });
    S.shape(g, rect(x - 12, G + 52, 24, 14), P.steelDk, { lw: 2.6 });
  }
  function bench(g, b) { const { x } = b; S.seed(b.seed); [0, 1, 2].forEach(i => S.shape(g, rect(x, G - 70 + i * 16, 170, 11), P.wood, { lw: 2.8 })); S.shape(g, rect(x - 6, G - 22, 182, 13), '#7a4e27', { lw: 3 }); [14, 150].forEach(dx => { S.line(g, [[x + dx, G - 74], [x + dx, G + 20]], 5, P.steelDk, .3); S.line(g, [[x + dx - 10, G + 22], [x + dx + 12, G + 22]], 5, P.steelDk, .2); }); }
  function hydrant(g, b) { const { x } = b; S.seed(b.seed); S.shape(g, [[x - 14, G + 60], [x - 12, G + 8], [x + 12, G + 8], [x + 14, G + 60]], '#c2452f', { lw: 3.2, shade: c => S.blot(c, rect(x + 3, G, 20, 70), '#000', .25) }); S.shape(g, S.ell(x, G + 6, 15, 11, 12, Math.PI, TAU), '#c2452f', { lw: 3 }); S.shape(g, rect(x - 22, G + 24, 44, 11), '#a03422', { lw: 2.6 }); }
  function barrier(g, b) { const { x, w } = b; S.seed(b.seed); const p = S.shape(g, rect(x, G - 2, w, 34), null, { lw: 0 }); S.hazardStripes(g, p, x - 4, G - 6, w + 8, 42, 18); S.ink(g, p, 3.4); for (let px = x + 12; px < x + w; px += (w - 24) / Math.max(1, Math.round(w / 220))) { S.line(g, [[px, G - 12], [px, G + 64]], 6, P.steelDk, .3); S.line(g, [[px - 16, G + 64], [px + 16, G + 64]], 6, P.steelDk, .2); } }
  function bin(g, b) { const { x } = b; S.seed(b.seed); S.shape(g, [[x - 22, G - 10], [x + 22, G - 10], [x + 18, G + 56], [x - 18, G + 56]], '#4f6b5a', { lw: 3.2, shade: c => { S.blot(c, rect(x + 4, G - 14, 24, 76), '#000', .25); c.strokeStyle = 'rgba(21,18,13,.3)'; c.lineWidth = 2; [-10, 0, 10].forEach(d => { c.beginPath(); c.moveTo(x + d, G); c.lineTo(x + d * .8, G + 50); c.stroke(); }); } }); S.shape(g, rect(x - 26, G - 18, 52, 10), '#3b5245', { lw: 2.8 }); }
  const DRAW = { apartment, haleTower, chimney, waterTower, fence, shed, tree, lamp, bench, hydrant, barrier, bin };

  /* ---------- dünya ---------- */
  const OBJ = []; // {k, x, w, ...}: çizim sırası listedeki sıra; span = [x-padL, x+w+padR]
  const add = (k, o) => { o.k = k; o.seed = o.seed || (OBJ.length * 37 + 11); OBJ.push(o); return o; };
  (function build() {
    add('fence', { x: 0, w: 760, h: 180, layer: 0 }); add('shed', { x: 60, w: 420, layer: 0 });
    add('fence', { x: 760, w: 380, h: 180, sign: 'KEEP OUT', layer: 0 }); add('tree', { x: 1180, layer: 0 });
    const row = [
      ['brick', 430, 640, 'CAFE', '#c9655a'], ['plaster', 360, 520, null], ['blue', 400, 760, 'BAKERY', '#d98e0b', 1], ['gap', 150], ['rose', 340, 470, null, null, 1], ['brick', 460, 700, 'TOOLS', '#3b5a4a'],
      ['lot', 620, 'chimney'], ['green', 380, 560, 'BOOKS', '#7f6aa0'], ['plaster', 440, 820, null, null, 1], ['concrete', 360, 600, 'LAUNDRY', '#5c7780'], ['gap', 140], ['brick', 400, 500, null],
      ['lot', 640, 'waterTower'], ['blue', 420, 660, 'GROCER', '#687653'], ['rose', 380, 780, null, null, 1], ['tower', 560], ['gap', 170], ['green', 420, 620, 'BARBER', '#c2452f'], ['plaster', 380, 520, null], ['brick', 460, 740, 'DINER', '#d98e0b', 1], ['concrete', 400, 580, null]
    ];
    let x = 1260; const L = {};
    row.forEach((b, i) => {
      if (b[0] === 'gap') { add('tree', { x: x + b[1] / 2, layer: 0 }); x += b[1]; }
      else if (b[0] === 'lot') { add('fence', { x: x + 20, w: b[1] - 40, h: 150, layer: 0, signU: .24, sign: b[2] === 'chimney' ? 'JOB 1' : 'JOB 2' }); add(b[2], { x: x + b[1] / 2, w: 0, pad: 160, layer: 0 }); L[b[2]] = x + b[1] / 2; x += b[1]; }
      else if (b[0] === 'tower') { add('haleTower', { x: x + 30, w: b[1] - 60, pad: 110, layer: 0 }); L.tower = x + b[1] / 2; x += b[1] + 60; }
      else { add('apartment', { x: x + 6, w: b[1] - 12, h: b[2], type: b[0], shop: b[3], awn: b[4], balcony: !!b[5], pad: 70, layer: 0, seed: 400 + i * 13 }); if (b[3] === 'CAFE') L.cafe = x + b[1] / 2; x += b[1]; }
    });
    add('barrier', { x: WORLD - 520, w: 520, layer: 0 });
    for (let lx = 900; lx < WORLD - 300; lx += 760) add('lamp', { x: lx, layer: 1, pad: 120 });
    [[1500, 'bench'], [2300, 'hydrant'], [2760, 'bin'], [4480, 'bench'], [5050, 'bin'], [6050, 'hydrant'], [7250, 'bench'], [8830, 'bin'], [9400, 'bench']].forEach(([px, k]) => add(k, { x: px, w: k === 'bench' ? 170 : 0, layer: k === 'bench' ? 0 : 1, pad: 40 }));
    build.L = L;
  })();
  const L = { daisy: 560, cafe: 1475, tower: 0 }; OBJ.forEach(o => { if (o.k === 'haleTower') L.tower = o.x + o.w / 2; if (o.k === 'chimney') L.chimney = o.x; });
  const span = o => [o.x - (o.pad || 30), o.x + (o.w || 0) + (o.pad || 30) + 60];

  function groundBack(g, x0) { // parçanın zemini: arka toprak şeridi, kaldırım, bordür, yol
    const r = rnd(x0 + 3);
    g.fillStyle = P.groundLt; g.fillRect(x0, G - 44, CH + 3, 46); for (let i = 0; i < 5; i++) { const wx = x0 + r() * CH; g.strokeStyle = P.weed; g.lineWidth = 3; g.beginPath(); g.moveTo(wx, G - 6); g.lineTo(wx - 6, G - 22); g.moveTo(wx, G - 6); g.lineTo(wx + 5, G - 26); g.stroke(); }
    g.fillStyle = 'rgba(21,18,13,.5)'; g.fillRect(x0, G - 46, CH + 3, 3);
  }
  function groundFront(g, x0) {
    const r = rnd(x0 + 5);
    g.fillStyle = '#cfc6b3'; g.fillRect(x0, G, CH + 3, 74); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x0, G, CH + 3, 8);
    g.strokeStyle = 'rgba(21,18,13,.28)'; g.lineWidth = 2; for (let jx = Math.ceil(x0 / 130) * 130; jx < x0 + CH; jx += 130) { g.beginPath(); g.moveTo(jx, G + 2); g.lineTo(jx - 16, G + 74); g.stroke(); }
    for (let i = 0; i < 4; i++) S.blot(g, S.ell(x0 + r() * CH, G + 20 + r() * 40, 30 + r() * 50, 6 + r() * 6, 10), '#a89f8c', .35);
    g.fillStyle = P.ink; g.fillRect(x0, G - 2, CH + 3, 4);
    g.fillStyle = '#9b927f'; g.fillRect(x0, G + 74, CH + 3, 16); g.fillStyle = P.ink; g.fillRect(x0, G + 73, CH + 3, 3); g.fillRect(x0, G + 89, CH + 3, 3);
    g.fillStyle = '#5b5a5c'; g.fillRect(x0, G + 92, CH + 3, H - G - 92); for (let i = 0; i < 8; i++) S.blot(g, S.ell(x0 + r() * CH, G + 110 + r() * 110, 40 + r() * 80, 6 + r() * 8, 10), r() < .5 ? '#4b4a4d' : '#6a696b', .5);
    g.fillStyle = P.paper; g.globalAlpha = .8; for (let dx = Math.floor(x0 / 260) * 260; dx < x0 + CH + 3; dx += 260) g.fillRect(dx, G + 178, 130, 10); g.globalAlpha = 1;
  }
  const chunks = new Map();
  function chunk(i) {
    let c = chunks.get(i); if (c) { c.t = performance.now(); return c; }
    const x0 = i * CH;
    c = sprite(CH + 3, H, -x0, 0, g => {
      g.beginPath(); g.rect(x0, 0, CH + 3, H); g.clip(); groundBack(g, x0);
      OBJ.forEach(o => { if (o.layer === 0) { const [a, b] = span(o); if (b > x0 && a < x0 + CH + 3) DRAW[o.k](g, o); } });
      groundFront(g, x0);
      OBJ.forEach(o => { if (o.layer === 1) { const [a, b] = span(o); if (b > x0 && a < x0 + CH) DRAW[o.k](g, o); } });
    });
    c.ox = 0; c.x0 = x0; c.t = performance.now(); chunks.set(i, c);
    if (chunks.size > 10) { let old = null; chunks.forEach((v, k) => { if (!old || v.t < chunks.get(old).t) old = k; }); chunks.delete(old); }
    return c;
  }

  /* ---------- uzak katmanlar ---------- */
  let skyCv, farCv = [], cloudSp = [];
  function buildFar() {
    skyCv = sprite(VW, H, 0, 0, g => { const gr = g.createLinearGradient(0, 0, 0, G); gr.addColorStop(0, P.sky0); gr.addColorStop(.6, P.sky1); gr.addColorStop(1, P.sky2); g.fillStyle = gr; g.fillRect(0, 0, VW, H); const sg = g.createRadialGradient(VW * .78, 170, 20, VW * .78, 170, 420); sg.addColorStop(0, 'rgba(255,244,214,.9)'); sg.addColorStop(.15, 'rgba(255,240,200,.45)'); sg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = sg; g.fillRect(0, 0, VW, G); });
    const TW = 2400;
    farCv = [[.18, P.far, '#a7b4bc', 150, 430, 31, .5], [.42, P.far2, '#8b9aa5', 110, 330, 57, .7]].map(([par, col, inkc, hmin, hmax, sd, sc]) => {
      const sp = sprite(TW, 700, 0, 0, g => { const r = rnd(sd); S.seed(sd); let x = 0; g.translate(0, 700 - G); while (x < TW) { const bw = 70 + r() * 110, bh = hmin + r() * (hmax - hmin), w2 = Math.min(bw, TW - x);
        S.shape(g, rect(x, G - 30 - bh, w2, bh + 40), col, { lw: 2.4, ink: inkc, amp: .7 });
        if (sc > .6) { g.fillStyle = P.farWin; g.globalAlpha = .55; for (let wy = G - 30 - bh + 22; wy < G - 60; wy += 34) for (let wx = x + 14; wx < x + w2 - 20; wx += 26) if (r() < .7) g.fillRect(wx, wy, 12, 16); g.globalAlpha = 1; }
        else if (r() < .3) { g.fillStyle = col; g.fillRect(x + w2 * .4, G - 30 - bh - 40, 6, 44); }
        x += bw + (r() < .25 ? 30 + r() * 60 : 0); } }, sc);
      sp.par = par; sp.TW = TW; return sp; });
    cloudSp = [0, 1, 2].map(i => sprite(420, 180, 210, 90, g => { S.seed(70 + i); g.globalAlpha = .9; [[0, 0, 120, 44], [-100, 16, 80, 32], [96, 12, 90, 36], [20, -28, 70, 30]].forEach(([dx, dy, rx, ry]) => S.blot(g, S.ell(dx, dy, rx * (1 + i * .15), ry, 20), P.cloud, 1)); }, .7));
  }

  /* ---------- karakterler ---------- */
  const cache = new Map();
  const noShadow = (g, fn) => { const oe = g.ellipse; let first = true; g.ellipse = function () { if (first) { first = false; return; } return oe.apply(this, arguments); }; fn(); g.ellipse = oe; };
  function kaanSp(o) {
    const key = 'k' + JSON.stringify(o); let sp = cache.get(key);
    if (!sp) { sp = sprite(190, 330, 95, 316, g => noShadow(g, () => S.drawKaan(g, Object.assign({ x: 0, y: 0, s: K }, o)))); cache.set(key, sp); }
    return sp;
  }
  function npcSp(fn, name, o, box) {
    const key = name + JSON.stringify(o); let sp = cache.get(key);
    if (!sp) { sp = sprite(box[0], box[1], box[2], box[3], g => S[fn](g, Object.assign({ x: 0, y: 0 }, o))); cache.set(key, sp); }
    return sp;
  }
  const npcs = [
    { fn: 'drawDefne', name: 'd', x: L.cafe + 150, y: WALK_Y - 26, o: { s: K, item: 'coffee', expr: 'calm' }, near: { expr: 'smile' }, box: [200, 320, 100, 306], say: 'Hey, Ant. Coffee?' },
    { fn: 'drawHale', name: 'h', x: L.tower - 250, y: WALK_Y - 26, o: { s: K, expr: 'confident' }, near: { expr: 'serious' }, box: [240, 340, 120, 324], say: 'You rush the first move.' }
  ];
  const daisy = { x: L.daisy, y: G - 6, beepT: -9 };
  const DBOX = [760, 700, 200, 660];
  const daisySp = on => npcSp('drawDaisy', 'D', { s: .6, beep: on ? 1 : 0, mood: on ? 'alert' : 'sleepy', boom: .35 }, DBOX);
  const car = { x: L.tower + 120, y: G + 200 };
  const carSp = () => npcSp('drawCar', 'C', { s: .62, view: 'side' }, [660, 260, 330, 236]);

  const pl = { x: 1000, y: 0, vy: 0, dir: 1, phase: 0, idle: 9, moving: false, blink: 0 };
  const keys = { l: 0, r: 0, run: 0, jump: 0, act: 0 };

  /* ---------- ses: iki bip ve adım ---------- */
  let AC = null;
  function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f, t0, d, v, type) { const a = audio(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0; o.type = type || 'square'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .012); g.gain.setValueAtTime(v, t + d - .03); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02); }
  function twoBeeps() { tone(1320, 0, .2, .09); tone(1320, .33, .2, .09); daisy.beepT = now; }
  function step() { const a = audio(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(70, t + .06); g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08); o.connect(g).connect(a.destination); o.start(t); o.stop(t + .1); }

  /* ---------- döngü ---------- */
  let now = 0, last = 0, fpsN = 0, fpsT = 0, slow = 0, ready = false, lastStepSign = 1;
  const fpsEl = document.getElementById('fps'), actBtn = document.getElementById('bAct');
  function update(dt) {
    const ax = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), sp = keys.run ? 520 : 270;
    if (ax) { pl.dir = ax; pl.x = clamp(pl.x + ax * sp * dt, 120, WORLD - 620); pl.phase += sp * dt / (keys.run ? 150 : 105); pl.idle = 0; pl.moving = true; }
    else { pl.moving = false; pl.idle += dt; }
    if (keys.jump && pl.y === 0) { pl.vy = -930; keys.jump = keys.jumpHeld ? 0 : 0; tone(520, 0, .07, .04, 'sine'); }
    if (pl.y < 0 || pl.vy < 0) { pl.vy += 2700 * dt; pl.y += pl.vy * dt; if (pl.y >= 0) { pl.y = 0; pl.vy = 0; step(); } }
    const sg = Math.sign(Math.sin(pl.phase)); if (pl.moving && pl.y === 0 && sg !== lastStepSign) { lastStepSign = sg; step(); }
    const nearD = Math.abs(pl.x - (daisy.x + 60)) < 330; if (actBtn.disabled === nearD) actBtn.disabled = !nearD;
    if (keys.act) { keys.act = 0; if (nearD && now - daisy.beepT > .9) twoBeeps(); }
    const target = clamp(pl.x - VW / 2 + pl.dir * VW * .12, 0, WORLD - VW); camX += (target - camX) * Math.min(1, dt * 3.2);
  }
  function bubble(x, y, text) {
    ctx.font = "30px 'Lilita One', sans-serif"; const w = ctx.measureText(text).width + 44; S.seed(88);
    S.shape(ctx, [[x - w / 2, y - 62], [x + w / 2, y - 62], [x + w / 2, y], [x + 26, y], [x + 8, y + 26], [x + 2, y], [x - w / 2, y]], P.paper, { lw: 3.6 });
    ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - 30);
  }
  function render() {
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    ctx.drawImage(skyCv.c, 0, 0, VW, H);
    cloudSp.forEach((sp, i) => { const span2 = VW + 500, cx = ((i * 760 + 200 - camX * .06 + now * (6 + i * 2)) % span2 + span2) % span2 - 250; put(sp, cx, 150 + i * 70); });
    farCv.forEach(sp => { const off = -((camX * sp.par) % sp.TW); for (let x = off; x < VW; x += sp.TW) ctx.drawImage(sp.c, x, G - 700 - (sp.par < .3 ? 26 : 0), sp.TW, 700); });
    const i0 = Math.floor(camX / CH), i1 = Math.floor((camX + VW) / CH);
    for (let i = i0; i <= i1; i++) { if (i < 0 || i * CH >= WORLD) continue; const c = chunk(i); ctx.drawImage(c.c, Math.round((c.x0 - camX) * PX) / PX, 0, c.c.width / PX, H); }
    // Daisy
    const bt = now - daisy.beepT, on = (bt >= 0 && bt < .2) || (bt >= .33 && bt < .53), dx = daisy.x - camX;
    if (dx > -700 && dx < VW + 300) { put(daisySp(on), dx, daisy.y);
      if (on) { ctx.strokeStyle = P.beaconOn; ctx.lineWidth = 5; ctx.lineCap = 'round'; [-1, 1].forEach(d => [34, 54].forEach(rr => { ctx.beginPath(); ctx.arc(dx + 8, daisy.y - 300, rr + 40, d > 0 ? -0.5 : Math.PI - .5, d > 0 ? .5 : Math.PI + .5); ctx.stroke(); })); } }
    // NPC'ler
    npcs.forEach(n => { const nx = n.x - camX; if (nx < -200 || nx > VW + 200) return; const near = Math.abs(pl.x - n.x) < 300, bl = ((now + n.x) % 3.7) < .12;
      put(npcSp(n.fn, n.name, Object.assign({}, n.o, near ? n.near : null, { look: clamp((pl.x - n.x) / 300, -1, 1) > .3 ? 1 : clamp((pl.x - n.x) / 300, -1, 1) < -.3 ? -1 : 0, blink: bl ? 1 : 0 }), n.box), nx, n.y);
      if (near) bubble(nx, n.y - 310, n.say); });
    // Kaan
    const kx = pl.x - camX, air = pl.y < 0, hgt = -pl.y;
    ctx.save(); ctx.globalAlpha = .24 * (1 - Math.min(.7, hgt / 260)); ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(kx + 3, WALK_Y + 1, 46 * (1 - Math.min(.5, hgt / 400)), 7, 0, 0, TAU); ctx.fill(); ctx.restore();
    let sp, bob = 0;
    if (air) sp = kaanSp({ pose: 'side', step: .75, flip: pl.dir < 0, expr: 'surprised' });
    else if (pl.moving || pl.idle < .18) { const q = Math.round(Math.sin(pl.phase) * 6) / 6; bob = -Math.abs(Math.cos(pl.phase)) * (keys.run ? 7 : 4); sp = kaanSp({ pose: 'side', step: pl.moving ? q : 0, flip: pl.dir < 0, expr: keys.run ? 'determined' : 'calm' }); }
    else { const bl = (now % 3.1) < .11; sp = kaanSp({ expr: pl.idle > 6 ? 'smile' : 'calm', look: pl.dir, blink: bl ? 1 : 0 }); }
    put(sp, kx, WALK_Y + pl.y + bob);
    // ön plan: yola park etmiş araba
    const cx = car.x - camX; if (cx > -400 && cx < VW + 400) put(carSp(), cx, car.y);
    if (Math.abs(pl.x - (daisy.x + 60)) < 330 && now - daisy.beepT > 1.2) bubble(dx + 150, daisy.y - 470, 'Press BEEP');
  }
  function frame(t) {
    requestAnimationFrame(frame); if (!ready) return;
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; now += dt;
    update(dt); render();
    fpsN++; if (t - fpsT > 500) { const f = fpsN * 1000 / (t - fpsT); fpsEl.textContent = Math.round(f) + ' kare/sn'; fpsN = 0; fpsT = t; }
    // sıradaki parçayı önceden hazırla (yürürken takılmasın)
    const ahead = Math.floor((camX + (pl.dir > 0 ? VW + CH * .6 : -CH * .6)) / CH); if (ahead >= 0 && ahead * CH < WORLD && !chunks.has(ahead)) chunk(ahead);
  }

  /* ---------- ekran ve kontroller ---------- */
  function resize() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (cv.width === w && cv.height === h) return;
    cv.width = w; cv.height = h; PX = h / H; VW = w / PX; chunks.clear(); cache.clear(); buildFar();
    document.getElementById('hint').hidden = r.width >= r.height;
    camX = clamp(pl.x - VW / 2, 0, Math.max(0, WORLD - VW));
  }
  const hold = (id, k) => { const el = document.getElementById(id); const dn = e => { e.preventDefault(); audio(); keys[k] = 1; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (x) { } }, up = e => { if (k !== 'jump' && k !== 'act') keys[k] = 0; el.classList.remove('on'); };
    el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up); el.addEventListener('contextmenu', e => e.preventDefault()); };
  hold('bL', 'l'); hold('bR', 'r'); hold('bRun', 'run'); hold('bJump', 'jump'); hold('bAct', 'act');
  const KM = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', Shift: 'run', ' ': 'jump', ArrowUp: 'jump', w: 'jump', W: 'jump', e: 'act', E: 'act', Enter: 'act' };
  addEventListener('keydown', e => { const k = KM[e.key]; if (!k) return; e.preventDefault(); audio(); if ((k === 'jump' || k === 'act') && e.repeat) return; keys[k] = 1; });
  addEventListener('keyup', e => { const k = KM[e.key]; if (k && k !== 'jump' && k !== 'act') keys[k] = 0; });
  addEventListener('blur', () => { keys.l = keys.r = keys.run = 0; });
  document.getElementById('full').addEventListener('click', async () => { try { const el = document.getElementById('wrap'); if (document.fullscreenElement) await document.exitFullscreen(); else { await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen()); try { await screen.orientation.lock('landscape'); } catch (e) { } } } catch (e) { } });
  addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
  window.__sokak = { pl, keys, L, get camX() { return camX; }, chunks, cache };

  (document.fonts && document.fonts.load ? document.fonts.load("30px 'Lilita One'").catch(() => { }) : Promise.resolve()).then(() => {
    resize(); for (let i = Math.floor(camX / CH); i <= Math.floor((camX + VW) / CH); i++) chunk(i);
    document.getElementById('load').hidden = true; ready = true;
  });
  requestAnimationFrame(frame);
})();
