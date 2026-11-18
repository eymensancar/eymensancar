/* Part 3 · MR. HALE — Animatör A: 0 – (S12.t1+S13.t0)/2 ≈ 26,08 sn (cümle 1–12).
   AVLU YERLEŞİMİ (dünya koordinatı = drawYard varsayılanı, alan 0,0,1080,1920, mode 'day'; p2-a.js notu yoktu, bu yerleşim benim):
   - Ufuk y 1075. Baraka x 108–670, tabanı y 1267, kapısı x 445–569. Çit hattı y 1344, avlu kapısı (bariyerli) x 778–994. Posta kutusu ayağı (670,1536).
   - Çitin önü sokak: toprak yol bandı y 1600–1880 (bu dosyada çizilir; drawYard'ın altı groundDk ile y 2300'e uzatılır).
   - Daisy çitin ÖNÜNDE, solda park hâlinde: ön yüz ortası (180,1450), s .55 (bom sol üste, kanca ~ (115,980)). Çitin önünde ki çit üstüne binmesin.
   - Hale'in beyaz arabası sokakta, sola bakar (flip): zemin ortası (720,1730), s .72; ön kapı camı x 553–691, y 1521–1583; açık kapı x 488–550.
   - Kaan sokakta, arabanın önünde: (300,1800) s .62. Hale arabadan inince: (520,1775) s .60, Kaan'a dönük.
   Ölçek: Kaan 0.62 iken araba 0.72, Daisy 0.55 (pilottaki çizgi film oranı: Kaan ≈ Daisy kabini boyu).
   Zamanlar timeline'dan (cuts()); karakterler ikişerli (q2), kamera birerli. Rastgelelik yalnız tohumlu. */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const seg = TB.seg, lerp = TB.lerp, clamp = TB.clamp, rnd = TB.rand;
  const FPS = 30, q2 = t => Math.floor(t * 15 + 1e-6) / 15, q1 = t => Math.floor(t * FPS + 1e-6) / FPS;
  const S = i => TB.sentence(i);
  const Wd = (i, re, n) => { const ws = S(i).words; return ws.find(w => re.test(w.w)) || ws[Math.min(n || 0, ws.length - 1)]; };
  const LEAD = .12;

  /* ================= KESMELER ================= */
  let _tl = null, KK = null;
  function K() {
    if (KK && _tl === TB.tl) return KK; _tl = TB.tl;
    const k = {};
    k.s01 = 0;
    k.money = Wd(1, /^money/i, 9).t0;
    k.s02 = k.money - .1;                                   // Kaan'ın tepkisi
    k.s03 = S(2).t0 - LEAD;                                 // deste + liste yan yana
    k.paper = Wd(2, /^paper/i, 4).t0;
    k.s04 = S(3).t0 - LEAD;                                 // kapı açılır, Hale iner
    k.haleW = Wd(3, /^Hale/i, 4).t0;
    k.s05 = S(4).t0 - LEAD;                                 // şehir, vinçler
    k.s06 = S(5).t0 - LEAD;                                 // bakış listeye
    k.listW = Wd(5, /^list/i, 3).t0;
    k.s07 = S(6).t0 - LEAD;                                 // "Not the crane. Not the land."
    k.crane = Wd(6, /^crane/i, 2).t0; k.land = Wd(7, /^land/i, 2).t0;
    k.s08 = S(8).t0 - LEAD;                                 // parmak listede
    k.touch = Wd(8, /^list/i, 2).t0;
    k.s09 = S(9).t0 - LEAD;                                 // liste cebe
    k.s10 = S(10).t0 - LEAD;                                // para sayımı
    k.count0 = Wd(10, /^counted/i, 1).t0;
    k.s11 = S(11).t0 - LEAD;                                // "I thought:"
    k.game = Wd(11, /^in$/i, 2).t0 + .02;                   // telefon: gerçek oyun (≤ 3 sn)
    k.gold = Wd(11, /^gold/i, 5).t0; k.upg = Wd(11, /^upgrades/i, 7).t0;
    k.s12 = S(12).t0 - LEAD;                                // gerçek: tek eski lastik
    k.daisyW = Wd(12, /^Daisy/i, 3).t0;
    k.s12b = Wd(12, /^one/i, 4).t0 - .15;                   // lastik yakın, siperlik iner
    k.tire = Wd(12, /^tire/i, 6).t0;
    k.end = (S(12).t1 + S(13).t0) / 2;
    KK = k; return k;
  }
  const ORDER = ['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10', 's11', 'game', 's12', 's12b', 'end'];
  function shot(id, draw) {
    const nx = ORDER[ORDER.indexOf(id) + 1];
    TB.shot({ id: 'p3a-' + id, t0: () => K()[id], t1: () => K()[nx], draw: (ctx, t, u, tl) => { draw(ctx, t, u, K()); finish(ctx); } });
  }

  /* ================= YARDIMCILAR ================= */
  const cam = (ctx, z, cx, cy) => { ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-cx, -cy); };
  function finish(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; C.grain(ctx, 0, 0, 1080, 1920, .2); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const cache = {};
  function cached(key, w, h, fn) { if (!cache[key]) { const cv = canvas(w, h); fn(cv.getContext('2d')); cache[key] = cv; } return cache[key]; }
  function vignette(ctx, a) { const g = ctx.createRadialGradient(540, 880, 420, 540, 960, 1250); g.addColorStop(0, 'rgba(21,18,13,0)'); g.addColorStop(1, `rgba(21,18,13,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }
  const blinkAt = (t, list) => list.some(b => t >= b && t < b + 3 / FPS) ? 1 : 0;

  /* ================= DÜNYA: AVLU + SOKAK ================= */
  const WD = { daisy: [180, 1450, .55], car: [720, 1730, .72], kaan: [300, 1800, .62], hale: [520, 1775, .60] };
  function backdrop() {
    return cached('p3a-yard', 1080, 2300, g => {
      C.drawYard(g, { x: 0, y: 0, w: 1080, h: 1920, mode: 'day', seed: 7 });
      g.fillStyle = P.groundDk; g.fillRect(0, 1918, 1080, 400);
      // sokak: toprak yol + teker izleri
      C.seed(3301);
      C.shape(g, [[-20, 1600], [1100, 1590], [1100, 1880], [-20, 1890]], '#b89a6e', { lw: 0, amp: 3 });
      C.line(g, [[-20, 1600], [1100, 1590]], 3, P.dustDk, 1.5);
      g.save(); g.globalAlpha = .3; g.strokeStyle = P.groundDk; g.lineWidth = 18; g.setLineDash([12, 9]);
      [1680, 1800].forEach(y => { g.beginPath(); g.moveTo(-20, y); g.quadraticCurveTo(540, y - 8, 1100, y + 4); g.stroke(); }); g.restore();
      for (let i = 0; i < 14; i++) { const px = rnd(3400 + i) * 1080, py = 1600 + rnd(3500 + i) * 600; C.blot(g, C.ell(px, py, 30 + rnd(i) * 60, 6 + rnd(i + 9) * 6, 12), rnd(i + 2) < .5 ? P.groundDk : P.groundLt, .3); }
      for (let i = 0; i < 6; i++) { const px = rnd(3600 + i) * 1080, py = 1900 + rnd(3700 + i) * 380; for (let k = 0; k < 5; k++) C.line(g, [[px + k * 5, py], [px + k * 5 + (k - 2) * 5, py - 16 - rnd(i * 5 + k) * 14]], 2.4, P.weed, .3); }
    });
  }
  // Hale'in kolu: drawHale'in o tarafındaki kolu kırpılır, yerine verilen açıyla kol çizilir (yerel, s=1 birim).
  const ARM_CUT = [[84, -410], [200, -410], [200, -190], [86, -190], [86, -262], [96, -330], [86, -400]];
  function haleWithArm(ctx, o, arm) {
    if (!arm) { C.drawHale(ctx, o); return; }
    const s = (o.s || 1) * 1.04, lw = 5.2 / Math.sqrt(s);
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.flip ? -s : s, s);
    const cut = new Path2D(); cut.rect(-400, -800, 800, 900); cut.moveTo(ARM_CUT[0][0], ARM_CUT[0][1]); ARM_CUT.slice(1).forEach(p => cut.lineTo(p[0], p[1])); cut.closePath();
    ctx.clip(cut, 'evenodd');
    ctx.scale(o.flip ? -1 / s : 1 / s, 1 / s); ctx.translate(-o.x, -o.y);
    C.drawHale(ctx, o);
    ctx.restore();
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.flip ? -s : s, s);
    C.seed(4401);
    C.shape(ctx, [[86, -262], [100, -252], [88, -212], [84, -212]], P.suitDk, { lw: 0 });
    C.line(ctx, [[98, -270], [100, -252], [88, -212]], lw);
    const sh = [78, -388], el = arm.el, hd = arm.hand;
    C.tube(ctx, [sh, el, hd], 46, 36, P.suit, lw);
    const ang = Math.atan2(hd[1] - el[1], hd[0] - el[0]);
    ctx.save(); ctx.translate(hd[0], hd[1]); ctx.rotate(ang);
    C.shape(ctx, [[-14, -20], [2, -21], [2, 21], [-14, 20]], P.shirt, { lw: lw * .8 });
    C.shape(ctx, [[2, -16], [30, -18], [44, -10], [46, 6], [30, 16], [2, 14]], P.hSkin, { lw: lw * .9 });
    C.line(ctx, [[18, -6], [40, -6]], lw * .4, P.hSkinDk, .2); C.line(ctx, [[18, 4], [40, 4]], lw * .4, P.hSkinDk, .2);
    C.shape(ctx, C.ell(14, -20, 9, 7, 10), P.hSkin, { lw: lw * .7 });
    ctx.restore();
    ctx.restore();
  }
  // Para destesi: yerel ~180×74, orta (0,0). lift: üst banknotun köşesi kalkar (0..1).
  const BILL = '#b9c49a', BILL_DK = '#8a9a6c', BILL_ED = '#ebe4c9';
  function moneyStack(ctx, x, y, s, rot, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); C.seed(o.seed || 5101);
    const lw = 4.2, h = o.h || 60;
    C.shape(ctx, [[-90, -h / 2], [90, -h / 2], [92, h / 2], [-92, h / 2]], BILL_ED, { lw, shade: c => { c.strokeStyle = 'rgba(138,154,108,.9)'; c.lineWidth = 2.2; for (let yy = -h / 2 + 6; yy < h / 2; yy += 5.5) { c.beginPath(); c.moveTo(-92, yy); c.lineTo(92, yy + rnd(yy * 3 + 1) * 1.5); c.stroke(); } C.blot(c, [[40, -h], [100, -h], [100, h], [50, h]], BILL_DK, .35); } });
    C.shape(ctx, [[-90, -h / 2 - 20], [90, -h / 2 - 20], [90, -h / 2], [-90, -h / 2]], BILL, { lw, shade: c => { c.strokeStyle = BILL_DK; c.lineWidth = 2; c.strokeRect(-80, -h / 2 - 17, 160, 14); C.blot(c, C.ell(0, -h / 2 - 10, 16, 6, 12), BILL_DK, .8); } });
    C.shape(ctx, [[-20, -h / 2 - 24], [18, -h / 2 - 24], [20, h / 2 + 4], [-22, h / 2 + 4]], P.paper, { lw: lw * .8 });
    C.line(ctx, [[-10, -4], [8, -4]], 2.4, P.inkOld, .3); C.line(ctx, [[-10, 6], [6, 6]], 2.4, P.inkOld, .3);
    if (o.lift) { const L = o.lift; C.shape(ctx, [[90, -h / 2 - 20], [90 - 46, -h / 2 - 20], [90 - 30 * L, -h / 2 - 20 - 40 * L], [90 + 10 * L, -h / 2 - 20 - 28 * L]], BILL, { lw: lw * .8, amp: .3 }); }
    ctx.restore();
  }
  function looseBill(ctx, x, y, s, rot, flip) { // uçan tek banknot (sayım)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s * flip); C.seed(5201);
    C.shape(ctx, [[-90, -14], [90, -14], [90, 14], [-90, 14]], flip > 0 ? BILL : BILL_DK, { lw: 3.6, shade: c => { c.strokeStyle = BILL_DK; c.lineWidth = 2; c.strokeRect(-80, -10, 160, 20); } });
    ctx.restore();
  }
  // Katlı liste (pilot heldList ile aynı kâğıt): orta (0,0), 112×146
  const PAPER = '#eadfc2', PAPER_BK = '#d9caa5', INK_OLD = '#3a3026', BLUE = '#1f4fe0';
  function foldedList(ctx, x, y, s, rot, flut) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    const w = 112, h = 146, lw = 4.2; C.seed(2201);
    C.shape(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], PAPER_BK, {
      lw, shade: c => {
        c.save(); c.globalAlpha = .22; for (let k = 0; k < 6; k++) { c.strokeStyle = INK_OLD; c.lineWidth = 2; c.beginPath(); const yy = -h / 2 + 22 + k * 20; c.moveTo(-w / 2 + 14, yy); for (let xx = -w / 2 + 14; xx < w / 2 - 12 - (k % 3) * 14; xx += 6) c.lineTo(xx, yy + Math.sin(xx * .7 + k) * 3); c.stroke(); } c.restore();
        C.blot(c, [[w * .1, -h], [w, -h], [w, h], [w * .25, h]], '#b8a479', .45);
      }
    });
    C.seed(2202); C.line(ctx, [[-w / 2 + 4, 0], [w / 2 - 4, 2]], 2, '#8a6a40', .5);
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, h / 2 - 9, w, 12); ctx.clip();
    ctx.strokeStyle = BLUE; ctx.globalAlpha = .75; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let k = 0; k <= 12; k++) { const xx = -w / 2 + 10 + k * (w - 26) / 12, yy = h / 2 - 2 + (k % 2 ? -7 : 2); k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); ctx.restore();
    const lift = 10 + (flut || 0) * 8; C.seed(2203);
    C.shape(ctx, [[w / 2, -h / 2], [w / 2 - 30, -h / 2], [w / 2 - lift * .6, -h / 2 + lift * .5], [w / 2, -h / 2 + 30]], PAPER, { lw: lw * .8, amp: .3 });
    ctx.restore();
  }
  // Kaan'ın yumruğu (aşağıdan gelir, başparmak üstte). Orta (x,y) = avuç; rot: kolun yönü (0 = kol aşağı)
  function kaanFist(ctx, x, y, s, rot, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); C.seed(o.seed || 2301);
    const lw = 4.6;
    C.shape(ctx, [[-62, 40], [62, 40], [80, 700], [-80, 700]], P.jacket, { lw, shade: c => C.blot(c, [[20, 30], [90, 30], [90, 700], [34, 700]], '#0b1f2a', .3) });
    C.shape(ctx, [[-60, 40], [60, 40], [62, 74], [-62, 74]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-52, 44], [-58, -6], [-40, -34], [40, -34], [56, -4], [50, 44]], P.skin, { lw, shade: c => C.blot(c, [[10, -40], [70, -40], [70, 50], [24, 50]], P.skinDk, .5) });
    [-30, -8, 14, 36].forEach((fx, i) => C.line(ctx, [[fx, -30], [fx + 2, -6]], lw * .5, P.skinDk, .2));
    C.shape(ctx, [[-56, -10], [-62, -48 - (o.press || 0) * 4], [-40, -70 - (o.press || 0) * 6], [-18, -64], [-22, -30]], P.skin, { lw });
    ctx.restore();
  }
  // Hale'in işaret eden eli (pilot drawHand kalıbı; krem kol, beyaz manşet, altın yüzük). Uç (x,y), ang yön.
  function halePoint(ctx, o) {
    const s = o.s || 1, lw = 5 / s;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang || 0); ctx.scale(s, o.flipY ? -s : s); C.seed(4501);
    C.shape(ctx, [[-860, -76], [-262, -66], [-250, 70], [-860, 80]], P.suit, { lw, shade: c => C.blot(c, [[-860, 26], [-240, 24], [-240, 90], [-860, 90]], P.suitDk, .6) });
    C.shape(ctx, [[-300, -64], [-250, -62], [-244, 66], [-296, 68]], P.shirt, { lw: lw * .8 });
    C.shape(ctx, C.ell(-272, 4, 7, 7, 10), P.gold, { lw: lw * .6 });
    C.shape(ctx, [[-252, -52], [-156, -60], [-114, -42], [-106, 8], [-118, 54], [-204, 62], [-250, 52]], P.hSkin, { lw, shade: c => C.blot(c, [[-260, 18], [-100, 18], [-100, 70], [-260, 70]], P.hSkinDk, .55) });
    [[-128, 34], [-154, 48], [-182, 54]].forEach(([a, b], i) => C.shape(ctx, C.ell(a, b, 22, 15, 14), i % 2 ? P.hSkinDk : P.hSkin, { lw: lw * .8 }));
    C.shape(ctx, [[-124, -36], [-60, -30], [-18, -24], [-2, -14], [4, 0], [-2, 13], [-20, 19], [-62, 14], [-122, 8]], P.hSkin, { lw, shade: c => C.blot(c, [[-130, 6], [10, 6], [10, 24], [-130, 24]], P.hSkinDk, .5) });
    C.shape(ctx, [[-88, -32], [-74, -31], [-72, 15], [-86, 14]], P.gold, { lw: lw * .7 });   // altın yüzük
    C.shape(ctx, [[-34, -22], [-10, -18], [-6, -6], [-30, -8]], '#efcaa6', { lw: lw * .6, amp: .4 });
    C.shape(ctx, [[-214, -50], [-160, -82], [-112, -76], [-112, -58], [-160, -46]], P.hSkin, { lw });
    ctx.restore();
  }
  // Daisy + değiştirilmiş eski lastik (yan ön teker, u=100). used: 0..1 görünürlük
  function daisyTire(ctx, x, y, s, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.transform(.55, -.22, 0, 1, 120, 0);
    const lw = 5.6 / Math.sqrt(s) * 1.25, u = 100; C.seed(6101);
    C.shape(ctx, C.ell(u, -50, 51, 51, 28), '#45474c', { lw, shade: c => { C.blot(c, C.ell(u + 14, -40, 40, 44, 16), '#2c2e33', .6); C.blot(c, [[u - 40, -96], [u - 10, -100], [u - 16, -82], [u - 40, -80]], '#6c6f75', .7); } });
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .3; C.line(ctx, [[u + Math.cos(a) * 42, -50 + Math.sin(a) * 42], [u + Math.cos(a) * 49, -50 + Math.sin(a) * 49]], lw * .35, '#6c6f75', .1); }
    C.shape(ctx, C.ell(u, -50, 25, 25, 20), P.steel, { lw: lw * .7, shade: c => C.blot(c, C.ell(u + 8, -42, 22, 22, 16), P.steelDk, .6) });
    C.shape(ctx, C.ell(u, -50, 10, 10, 12), P.steelLt, { lw: lw * .6 });
    ctx.restore();
    if (o && o.tag) { // fiyat etiketi: ipte, el yazısı "USED"
      const tx = x + s * (120 + .55 * (u + 30)), ty = y + s * (-50 - .22 * (u + 30) - 40), sw = o.tagSwing || 0;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(sw); ctx.scale(s / 1.9, s / 1.9); C.seed(6102);
      C.line(ctx, [[0, 0], [8, 60]], 3, P.inkOld, .5);
      ctx.translate(8, 60); ctx.rotate(.12);
      C.shape(ctx, [[-10, 0], [10, 0], [44, 16], [44, 70], [-44, 70], [-44, 16]], '#dcbb7f', { lw: 4, shade: c => C.blot(c, [[10, -4], [48, -4], [48, 76], [18, 76]], '#b8955a', .5) });
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 12, 5, 0, TAU); ctx.fill();
      C.handwrite(ctx, 'USED', -34, 52, 26, P.ink, 7);
      ctx.restore();
    }
  }

  /* ---- dünya çizimi ---- */
  function drawWorld(ctx, t, o) {
    o = o || {}; const tw = q2(t);
    ctx.drawImage(backdrop(), 0, 0);
    const [dx, dy, ds] = WD.daisy;
    C.drawDaisy(ctx, Object.assign({ x: dx, y: dy, s: ds, seed: 23, beep: 0, mood: 'sleepy', boom: 0, hook: Math.sin(t * 1.3) * .03 }, o.daisy || {}));
    if (o.used) daisyTire(ctx, dx, dy, ds, { tag: true, tagSwing: Math.sin(t * 2.4) * .05 });
    if (o.preKaan) o.preKaan(ctx, tw);
    const [cx, cy, cs] = WD.car, bob = o.carBob || 0;
    if (o.haleInCar) { // Hale camda (araba gövdesinin arkasında kalsın diye önce, sonra araba camı açık bırakılır)
      ctx.save(); ctx.beginPath(); ctx.rect(553, 1515 + bob, 140, 70); ctx.clip();
      ctx.fillStyle = '#2a1d16'; ctx.fillRect(540, 1500, 170, 100);
      C.drawHale(ctx, { x: 628, y: 1856 + bob, s: .6, expr: o.haleInCar.expr || 'confident', look: o.haleInCar.look == null ? -.8 : o.haleInCar.look, blink: o.haleInCar.blink, seed: 41 });
      ctx.restore();
    }
    ctx.save(); ctx.translate(0, bob);
    if (o.haleInCar) { // camsız çizilen araba: cam bölgesini dışarıda bırak
      const cl = new Path2D(); cl.rect(0, 0, 1080, 2300); cl.rect(556, 1524, 132, 56); ctx.clip(cl, 'evenodd');
    }
    C.drawCar(ctx, { x: cx, y: cy, s: cs, view: 'side', flip: true, door: !!o.door, dust: o.dust || 0, seed: 61 });
    ctx.restore();
    if (o.doorMid) { // kapı yarı açık (yerel, flip'li araba koordinatı)
      ctx.save(); ctx.translate(cx, cy); ctx.scale(-cs, cs); C.seed(6201);
      C.shape(ctx, [[236, -292], [140, -284], [142, -84], [240, -90]], '#f2efe6', { lw: 5.4 / Math.sqrt(cs), shade: c => C.blot(c, [[180, -290], [250, -290], [250, -80], [190, -80]], '#cfcabd', .7) });
      C.shape(ctx, [[232, -280], [156, -272], [156, -200], [232, -206]], '#3a5566', { lw: 4 });
      ctx.restore();
    }
    if (o.moneyArm) o.moneyArm(ctx, tw);
    const items = [];
    if (o.hale) items.push([WD.hale[1], () => haleWithArm(ctx, Object.assign({ x: WD.hale[0], y: WD.hale[1], s: WD.hale[2], seed: 41, expr: 'confident' }, o.hale), o.haleArm)]);
    if (o.kaan) items.push([WD.kaan[1], () => C.drawKaan(ctx, Object.assign({ x: WD.kaan[0], y: WD.kaan[1], s: WD.kaan[2], seed: 11, phone: false }, o.kaan))]);
    items.sort((a, b) => a[0] - b[0]).forEach(i => i[1]());
    if (o.heldList) foldedList(ctx, WD.kaan[0] + 108 * WD.kaan[2], WD.kaan[1] - 262 * WD.kaan[2], WD.kaan[2] * .9, -.12 + Math.sin(tw * 3) * .02, Math.sin(tw * 2));
    if (o.heldList) { ctx.save(); ctx.translate(WD.kaan[0], WD.kaan[1]); ctx.scale(WD.kaan[2], WD.kaan[2]); C.seed(2204); C.shape(ctx, C.ell(86, -240, 15, 15, 18), P.skin, { lw: 5.2 / Math.sqrt(WD.kaan[2]) }); ctx.restore(); }
  }
  function blurWorld(key, z, cx, cy, blur, o) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d'); cam(g, z, cx, cy); drawWorld(g, 0, o || {});
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
  }
  // camdan uzanan kol + deste (dünya koordinatı). ext: 0..1
  function moneyArmFn(ext, wig) {
    return (ctx, tw) => {
      const hx = lerp(612, 520, ext), hy = 1566 + Math.sin(tw * 9) * 2 * wig;
      C.seed(5301);
      C.tube(ctx, [[660, 1556], [hx + 60, hy - 2], [hx + 26, hy]], 30, 26, P.suit, 3.6);
      C.shape(ctx, [[hx + 20, hy - 14], [hx + 34, hy - 15], [hx + 34, hy + 13], [hx + 20, hy + 12]], P.shirt, { lw: 3 });
      moneyStack(ctx, hx - 20, hy, .42, -.06 + Math.sin(tw * 9) * .02 * wig, { lift: .3 + .3 * Math.sin(tw * 6) });
      C.shape(ctx, [[hx - 6, hy - 16], [hx + 22, hy - 14], [hx + 22, hy + 12], [hx - 4, hy + 14], [hx - 12, hy]], P.hSkin, { lw: 3.2 });
      C.shape(ctx, C.ell(hx - 12, hy - 14, 9, 6, 10), P.hSkin, { lw: 2.8 });
    };
  }

  /* ================= SAHNELER ================= */
  // s01  "A man in a white car offered me…"  0. kare: camdan para destesi uzanıyor, araba yeni durmuş
  shot('s01', (ctx, t, u, k) => {
    const z = lerp(2.15, 2.3, E.io(u)), ext = .25 + .75 * E.outC(seg(t, 0, .9));
    const bob = 4 * Math.exp(-3 * t) * Math.sin(q2(t) * 12);
    ctx.save(); cam(ctx, z, 590, 1545);
    drawWorld(ctx, t, { haleInCar: { look: -.8, blink: blinkAt(t, [1.2]) }, carBob: bob, dust: .55 * (1 - seg(t, 0, 1.6)), moneyArm: moneyArmFn(ext, 1) });
    ctx.restore();
  });
  // s02  "…more money than this whole yard is worth."  Kaan'ın gözü desteye, arkasında Daisy ve avlu
  shot('s02', (ctx, t, u, k) => {
    const z = lerp(1.62, 1.72, E.io(u)), tw = q2(t);
    const yardW = Wd(1, /^yard/i, 13).t0;
    const expr = tw < k.money + .1 ? 'calm' : (tw < yardW + .2 ? 'surprised' : 'worried');
    const look = tw < k.money + .1 ? .3 : (tw < yardW ? .9 : -.6);
    ctx.save(); cam(ctx, z, lerp(410, 395, E.io(u)), 1420);
    drawWorld(ctx, t, { haleInCar: { look: -.8 }, moneyArm: moneyArmFn(1, 1), kaan: { expr, look, blink: blinkAt(t, [k.money + .7]) }, heldList: true });
    ctx.restore();
  });
  // s03  "For a piece of paper."  deste (Hale) ve katlı liste (Kaan) yan yana
  shot('s03', (ctx, t, u, k) => {
    const tw = q2(t);
    ctx.drawImage(blurWorld('p3a-b03', 1.5, 520, 1450, 9), 0, 0);
    vignette(ctx, .3);
    const pan = E.io(seg(t, k.s03, k.paper + .2)), dx = lerp(-70, 60, pan), z = lerp(1, 1.06, E.io(u));
    ctx.save(); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540 + dx, -900);
    // Hale'in eli sağdan, deste
    const bobY = Math.sin(tw * 5) * 6;
    C.seed(5401); C.tube(ctx, [[1300, 760 + bobY], [900, 800 + bobY], [800, 830 + bobY]], 150, 130, P.suit, 5);
    C.shape(ctx, [[760, 770 + bobY], [820, 766 + bobY], [826, 900 + bobY], [764, 900 + bobY]], P.shirt, { lw: 5 });
    moneyStack(ctx, 650, 840 + bobY, 2.1, .04, { lift: .4 + .4 * Math.sin(tw * 4), seed: 5102 });
    C.seed(5402); C.shape(ctx, [[600, 760 + bobY], [770, 772 + bobY], [776, 890 + bobY], [640, 900 + bobY], [596, 830 + bobY]], P.hSkin, { lw: 5.5, shade: c => C.blot(c, [[700, 740], [800, 740], [800, 920], [720, 920]], P.hSkinDk, .5) });
    C.shape(ctx, C.ell(600, 770 + bobY, 34, 22, 14), P.hSkin, { lw: 5 });
    // Kaan'ın eli soldan alttan, liste
    const press = seg(tw, k.paper, k.paper + .2), fl = Math.sin(tw * 2.6);
    foldedList(ctx, 270, 780 - press * 6, 2.4, -.1 + fl * .01, fl);
    kaanFist(ctx, 276, 975 - press * 6, 1.1, .04, { press });
    ctx.restore();
  });
  // s04  "His name is Mr. Hale."  kapı açılır, Hale iner, şapkasını düzeltir
  shot('s04', (ctx, t, u, k) => {
    const tw = q2(t), d0 = k.s04 + .08, z = lerp(1.62, 1.7, E.io(u));
    const door = tw >= d0 + .27, mid = tw >= d0 + .13 && !door, inCar = tw < d0 + .27;
    const rise = E.outC(seg(tw, d0 + .27, d0 + .87));
    ctx.save(); cam(ctx, z, 470, 1600);
    drawWorld(ctx, t, {
      door, doorMid: mid, haleInCar: inCar ? { look: -.8 } : null,
      kaan: { expr: tw < k.haleW ? 'calm' : 'serious', look: .8, blink: blinkAt(t, [k.haleW + .25]) }, heldList: true,
      preKaan: null
    });
    if (!inCar) {
      const nod = tw >= k.haleW && tw < k.haleW + .4 ? .05 : 0;
      ctx.save(); if (rise < 1) { ctx.beginPath(); ctx.rect(0, 0, 1080, 1735); ctx.clip(); }
      const hy = WD.hale[1] + (1 - rise) * 110, hx = WD.hale[0] + (1 - rise) * 20;
      ctx.translate(hx, hy - 260); ctx.rotate(nod); ctx.translate(-hx, -(hy - 260));
      C.drawHale(ctx, { x: hx, y: hy, s: WD.hale[2], seed: 41, expr: 'confident', look: -.7, flip: true });
      ctx.restore();
      // Kaan önde kalsın
      C.drawKaan(ctx, { x: WD.kaan[0], y: WD.kaan[1], s: WD.kaan[2], seed: 11, phone: false, expr: tw < k.haleW ? 'calm' : 'serious', look: .8, blink: blinkAt(t, [k.haleW + .25]) });
      foldedList(ctx, WD.kaan[0] + 108 * WD.kaan[2], WD.kaan[1] - 262 * WD.kaan[2], WD.kaan[2] * .9, -.12, Math.sin(tw * 2));
      ctx.save(); ctx.translate(WD.kaan[0], WD.kaan[1]); ctx.scale(WD.kaan[2], WD.kaan[2]); C.seed(2204); C.shape(ctx, C.ell(86, -240, 15, 15, 18), P.skin, { lw: 6.6 }); ctx.restore();
    }
    ctx.restore();
  });
  // s05  "He builds half the city."  alttan Hale, arkada vinçli şehir silueti
  function skyline(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, 1500); g.addColorStop(0, P.sky0); g.addColorStop(.6, P.sky1); g.addColorStop(1, P.sky2);
    ctx.fillStyle = g; ctx.fillRect(-200, -200, 1480, 2400);
    C.seed(7101); ctx.fillStyle = P.cloud; ctx.globalAlpha = .85;
    [[260, 360, 1.2], [820, 520, .9]].forEach(([x, y, s]) => [[0, 0, 70, 24], [-56, 8, 46, 18], [52, 6, 50, 20]].forEach(([a, b, rx, ry]) => ctx.fill(C.pathOf(C.wobble(C.ell(x + a * s + t * 6, y + b * s, rx * s, ry * s, 20), true, 2), true))));
    ctx.globalAlpha = 1;
    const base = 1460;
    // uzak katman
    let x = -160, i = 0;
    while (x < 1240) { const w = 70 + rnd(7200 + i) * 90, h = 160 + rnd(7300 + i) * 300; C.seed(7400 + i); C.shape(ctx, [[x, base], [x, base - h], [x + w, base - h], [x + w, base]], P.far2, { lw: 2, ink: '#8d9ca6', amp: .5 }); x += w + 4; i++; }
    // yakın katman: kuleler, yarım inşaatlar
    x = -120; i = 0;
    while (x < 1240) {
      const w = 90 + rnd(7500 + i) * 100, h = 240 + rnd(7600 + i) * 420, half = rnd(7700 + i) < .4; C.seed(7800 + i);
      if (half) { // iskelet kat
        const hh = h * .55; C.shape(ctx, [[x, base], [x, base - hh], [x + w, base - hh], [x + w, base]], P.far, { lw: 2.4, ink: P.far2, amp: .5 });
        for (let f = 1; f < 5; f++) C.line(ctx, [[x, base - hh - f * 40], [x + w, base - hh - f * 40]], 2.4, P.far2, .4);
        [0, .5, 1].forEach(q => C.line(ctx, [[x + w * q, base - hh], [x + w * q, base - hh - 160]], 2.6, P.far2, .4));
      } else {
        C.shape(ctx, [[x, base], [x, base - h], [x + w, base - h], [x + w, base]], P.far, { lw: 2.4, ink: P.far2, amp: .5 });
        ctx.fillStyle = P.farWin; for (let yy = base - h + 16; yy < base - 12; yy += 22) for (let xx = x + 10; xx < x + w - 12; xx += 18) if (rnd(xx * 3 + yy) < .5) ctx.fillRect(xx, yy, 7, 10);
      }
      x += w + 10 + rnd(7900 + i) * 30; i++;
    }
    // kule vinçler (bomları yavaşça döner)
    [[120, 600, .3, 1], [430, 520, 1.7, 1.15], [700, 640, 2.9, .9], [960, 560, 4.2, 1]].forEach(([cx, top, ph, sc], n) => {
      C.seed(8100 + n); const L = 300 * sc, c = Math.cos(t * .35 + ph);
      C.line(ctx, [[cx, base], [cx, top]], 9, '#66757f', .3);
      for (let yy = top + 20; yy < base; yy += 34) C.line(ctx, [[cx - 9, yy], [cx + 9, yy + 17]], 1.6, '#66757f', .2);
      C.line(ctx, [[cx - L * .3 * c, top + 6], [cx + L * c, top + 6]], 5, '#66757f', .3);
      C.line(ctx, [[cx - L * .3 * c, top + 6], [cx, top - 46], [cx + L * c, top + 6]], 2.2, '#66757f', .3);
      C.line(ctx, [[cx + L * .7 * c, top + 8], [cx + L * .7 * c, top + 150]], 1.8, '#66757f', .2);
      if (n === 1) { // karşı ağırlıkta krem afiş: HALE
        ctx.save(); ctx.translate(cx - L * .26 * c, top - 6); ctx.scale(Math.max(.15, Math.abs(c)), 1); C.seed(8199);
        C.shape(ctx, [[-60, -18], [60, -18], [60, 26], [-60, 26]], P.suit, { lw: 2.6, ink: '#6f7d87' });
        ctx.font = '700 30px Rubik'; ctx.textAlign = 'center'; ctx.fillStyle = '#6f5a3a'; ctx.fillText('HALE', 0, 16); ctx.restore();
      }
    });
    const hz = ctx.createLinearGradient(0, base - 140, 0, base); hz.addColorStop(0, 'rgba(240,226,194,0)'); hz.addColorStop(1, 'rgba(240,226,194,.6)'); ctx.fillStyle = hz; ctx.fillRect(-200, base - 140, 1480, 142);
    ctx.fillStyle = P.groundLt; ctx.fillRect(-200, base, 1480, 800);
  }
  shot('s05', (ctx, t, u, k) => {
    const z = lerp(1.0, 1.06, E.io(u)), tw = q2(t);
    ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540 + lerp(-20, 20, E.io(u)), -960);
    skyline(ctx, t);
    const turn = tw > S(4).words[2].t0 ? -.9 : -.5;
    C.drawHale(ctx, { x: 870, y: 2060, s: 1.7, seed: 41, expr: 'confident', look: turn, blink: blinkAt(t, [k.s05 + 1.3]) });
    ctx.restore();
  });
  // s06  "He wants Grandpa's list."  Hale yakın; bakışı öndeki listeye iner
  shot('s06', (ctx, t, u, k) => {
    const tw = q2(t), z = lerp(1, 1.05, E.io(u));
    ctx.drawImage(blurWorld('p3a-b06', 1.3, 640, 1300, 10, { kaan: null }), 0, 0);
    const down = E.io(seg(tw, k.listW - .35, k.listW + .1));
    ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960);
    const hx = 620, hy = 1950, s = 2.55, neck = [hx, hy - 420 * s * 1.04];
    ctx.save(); ctx.translate(neck[0], neck[1]); ctx.rotate(.09 * down); ctx.translate(-neck[0], -neck[1] + 26 * down);
    C.drawHale(ctx, { x: hx, y: hy, s, seed: 41, expr: down > .5 ? 'serious' : 'confident', look: lerp(0, -.7, down), blink: blinkAt(t, [k.s06 + .5]) });
    ctx.restore();
    const fl = Math.sin(tw * 2.4);
    foldedList(ctx, 250, 1000, 2.0, -.16 + fl * .01, fl);
    kaanFist(ctx, 262, 1165, 1.05, .2);
    ctx.restore();
    vignette(ctx, .25);
  });
  // s07  "Not the crane. Not the land."  Hale'in eli Daisy'yi, sonra avluyu geçer
  shot('s07', (ctx, t, u, k) => {
    const tw = q2(t);
    const a1 = E.outBack(seg(tw, k.crane - .35, k.crane)), a2 = E.io(seg(tw, k.land - .4, k.land + .1)), wav = Math.sin(tw * 18) * 8 * (seg(tw, k.crane - .1, k.crane + .1) - seg(tw, k.crane + .3, k.crane + .5));
    // kol pozları (Hale yerel, flip ile ekran soluna)
    const rest = { el: [106, -320], hand: [104, -254] };
    const up = { el: [150, -460], hand: [196, -566 + wav] }, low = { el: [170, -330], hand: [270, -300] }, low2 = { el: [150, -320], hand: [250, -262] };
    const mix = (A, B, w) => ({ el: [lerp(A.el[0], B.el[0], w), lerp(A.el[1], B.el[1], w)], hand: [lerp(A.hand[0], B.hand[0], w), lerp(A.hand[1], B.hand[1], w)] });
    let arm = mix(rest, up, clamp(a1, 0, 1.08));
    if (tw > k.land - .4) arm = mix(mix(up, low, a2), low2, E.io(seg(tw, k.land + .1, k.land + .6)));
    const daisyAlert = tw >= k.crane - .05 && tw < k.crane + .5;
    const camX = lerp(480, 425, E.io(seg(t, k.s07, k.land + .4))), z = lerp(1.25, 1.3, E.io(u));
    ctx.save(); cam(ctx, z, camX, 1500);
    drawWorld(ctx, t, {
      door: true, daisy: { mood: daisyAlert ? 'alert' : 'sleepy' },
      hale: { expr: tw < k.land + .3 ? 'serious' : 'confident', look: .8, flip: true, blink: blinkAt(t, [k.land + .55]) }, haleArm: arm,
      kaan: { expr: 'serious', look: .8, blink: blinkAt(t, [k.crane + .4]) }, heldList: true
    });
    ctx.restore();
  });
  // s08  "Just the list."  parmak listede durur
  shot('s08', (ctx, t, u, k) => {
    const tw = q1(t), th = q2(t);
    ctx.drawImage(blurWorld('p3a-b08', 2.2, 330, 1600, 12), 0, 0);
    vignette(ctx, .35);
    const z = lerp(1, 1.07, E.io(u));
    ctx.save(); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540, -900);
    const land = E.outC(seg(tw, k.touch - .45, k.touch)), press = seg(th, k.touch, k.touch + .1) * (1 - .5 * seg(th, k.touch + .4, k.touch + .9));
    foldedList(ctx, 520, 820 + press * 8, 3.3, -.06, 0);
    kaanFist(ctx, 520, 1080 + press * 8, 1.5, .08, { press });
    const tip = [lerp(980, 556, land), lerp(240, 778 + press * 8, land)];
    halePoint(ctx, { x: tip[0], y: tip[1], s: 1.35, ang: 2.2, flipY: true });
    ctx.restore();
  });
  // s09  "I said I would think about it."  liste ceketin göğüs cebine, iki pat
  shot('s09', (ctx, t, u, k) => {
    const tw = q2(t), t0 = k.s09, z = lerp(1, 1.04, E.io(u));
    const breath = Math.sin(t * 2.2) * 4;
    ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960 + breath);
    // ceket
    C.seed(9101); ctx.fillStyle = '#5b6a62'; ctx.fillRect(-200, -200, 1480, 2400);
    C.shape(ctx, [[-60, 120], [1140, 120], [1160, 2100], [-80, 2100]], P.jacket, { lw: 7, shade: c => { C.blot(c, [[760, 80], [1200, 80], [1200, 2100], [820, 2100]], '#0b1f2a', .3); } });
    C.shape(ctx, [[380, 60], [540, 520], [430, 560], [300, 120]], P.jacketDk, { lw: 7 }); C.shape(ctx, [[720, 60], [560, 520], [660, 560], [800, 120]], P.jacketDk, { lw: 7 });
    C.line(ctx, [[550, 520], [556, 2000]], 5);
    C.shape(ctx, [[360, -60], [720, -60], [690, 110], [380, 110]], P.skin, { lw: 7, shade: c => C.blot(c, [[340, -80], [740, -80], [740, 60], [340, 40]], P.skinDk, 1) });
    // cep (sol göğüs, ekranın solu): önce cep gövdesi, liste içine, sonra kapak
    const PX = 300, PY = 900;
    C.shape(ctx, [[PX - 150, PY], [PX + 150, PY], [PX + 144, PY + 300], [PX - 144, PY + 300]], P.jacket, { lw: 6, shade: c => C.blot(c, [[PX + 60, PY - 10], [PX + 160, PY - 10], [PX + 160, PY + 310], [PX + 80, PY + 310]], '#0b1f2a', .3) });
    const rise = E.outC(seg(tw, t0 + .1, t0 + .55)), dive = E.io(seg(tw, t0 + .6, t0 + 1.05));
    const pats = [t0 + 1.2, t0 + 1.45], pat = pats.reduce((a, p) => a + (tw >= p && tw < p + .14 ? 1 : 0), 0);
    const lx = lerp(560, PX, rise), ly = lerp(1700, PY - 90, rise) + dive * 250;
    if (dive < 1) { ctx.save(); ctx.beginPath(); ctx.rect(-200, -200, 1480, PY + 20 + 200); ctx.clip(); foldedList(ctx, lx, ly, 1.9, lerp(.3, .02, rise), 0); ctx.restore(); }
    C.shape(ctx, [[PX - 160, PY - 30], [PX + 160, PY - 30], [PX + 156, PY + 40], [PX + 10, PY + 70], [PX - 156, PY + 40]], P.jacketDk, { lw: 6 });
    C.shape(ctx, C.ell(PX, PY + 40, 12, 12, 12), P.steelDk, { lw: 4 });
    // el
    const hx = dive < 1 ? lx + 30 : lerp(PX + 40, PX + 60, seg(tw, t0 + 1.05, t0 + 1.2)), hy = dive < 1 ? ly + 120 : PY + 120 + pat * 26;
    kaanFist(ctx, hx, hy, 1.25, -.35, { seed: 2302 });
    ctx.restore();
    vignette(ctx, .3);
  });
  // s10  "He counted the money anyway."  Hale açık kapıya yaslanmış, desteyi sayar
  shot('s10', (ctx, t, u, k) => {
    const tw = q2(t), z = lerp(1.0, 1.05, E.io(u));
    ctx.drawImage(blurWorld('p3a-b10', 1.4, 400, 1420, 10, { kaan: { expr: 'serious', look: .8 }, heldList: false }), 0, 0);
    ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960);
    const hs = 2.0, hx = 540, hy = 1420;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1080, 1130); ctx.clip();
    C.drawHale(ctx, { x: hx, y: hy, s: hs, seed: 41, pose: 'sit', seat: false, phone: false, expr: 'confident', look: tw > k.count0 + .6 ? .6 : 0, blink: blinkAt(t, [k.count0 + 1.0]) });
    ctx.restore();
    // sayım: sol eldeki desteden sağdaki küçük yığına banknot
    const lh = [hx - 26 * hs * 1.04, hy - 182 * hs * 1.04], rh = [hx + 24 * hs * 1.04, hy - 184 * hs * 1.04];
    const per = .2, n = tw < k.count0 ? 0 : Math.min(7, Math.floor((tw - k.count0) / per) + 1), ph = tw < k.count0 ? 0 : ((tw - k.count0) % per) / per;
    moneyStack(ctx, lh[0] - 40, lh[1] - 16, .85, -.08, { h: 60 - n * 3, lift: ph < .5 && n < 8 && tw >= k.count0 ? ph * 2 : 0, seed: 5103 });
    if (n > 0) moneyStack(ctx, rh[0] + 40, rh[1] - 4, .8, .08, { h: 8 + n * 4, seed: 5104 });
    if (tw >= k.count0 && n <= 7 && ph >= .3) { const f = (ph - .3) / .7, bx = lerp(lh[0] + 10, rh[0] + 30, f), by = lh[1] - 40 - Math.sin(Math.PI * f) * 70; looseBill(ctx, bx, by, .8, lerp(-.1, .1, f), Math.cos(Math.PI * f) >= 0 ? Math.max(.15, Math.cos(Math.PI * f)) : -Math.max(.15, -Math.cos(Math.PI * f))); }
    // eller önde
    C.seed(5501); C.shape(ctx, C.ell(lh[0], lh[1] + 6, 30, 32, 16), P.hSkinDk, { lw: 5 }); C.shape(ctx, C.ell(rh[0], rh[1] + 6, 30, 32, 16), P.hSkin, { lw: 5 });
    // açık araba kapısı (önde, alt kısım)
    C.seed(5502);
    C.shape(ctx, [[60, 1120], [1020, 1100], [1040, 2000], [40, 2000]], '#f2efe6', { lw: 8, shade: c => { C.blot(c, [[40, 1500], [1060, 1500], [1060, 2000], [40, 2000]], '#cfcabd', .8); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(80, 1130, 920, 14); } });
    C.shape(ctx, [[110, 1150], [970, 1136], [960, 1430], [120, 1440]], '#3a5566', { lw: 6, shade: c => { c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(260, 1140); c.lineTo(340, 1140); c.lineTo(240, 1440); c.lineTo(160, 1440); c.fill(); c.beginPath(); c.moveTo(420, 1140); c.lineTo(450, 1140); c.lineTo(350, 1440); c.lineTo(320, 1440); c.fill(); } });
    C.line(ctx, [[60, 1500], [1030, 1490]], 14, '#c9ced3', 1);
    C.line(ctx, [[700, 1600], [800, 1598]], 10, '#7f868d', .5);
    ctx.restore();
    vignette(ctx, .2);
  });
  // s11  "I thought:"  Kaan düşünür, telefon elinde
  shot('s11', (ctx, t, u, k) => {
    const tw = q2(t), z = lerp(1, 1.06, E.io(u));
    ctx.drawImage(blurWorld('p3a-b11', 1.4, 400, 1380, 10, { hale: { look: -.8, flip: true }, door: true }), 0, 0);
    ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960);
    const up = tw > S(11).words[1].t0;
    C.drawKaan(ctx, { x: 520, y: 2060, s: 2.6, seed: 11, phone: true, expr: up ? 'smile' : 'calm', look: up ? -.8 : .5, blink: blinkAt(t, [k.s11 + .15]) });
    ctx.restore();
    vignette(ctx, .25);
  });
  // game  "…in Demolition Master, gold buys upgrades."  telefonda gerçek oyun (≤ 3 sn): 1–55 yıkım + altın, sonra 116–128 sonuç kartı (SHOP)
  const gameImgs = {};
  [...Array(55).keys()].map(i => i + 1).concat([...Array(13).keys()].map(i => i + 116)).forEach(i => { gameImgs[i] = TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg'); });
  function gameIdx(t, k) {
    const f = Math.floor((t - k.game) * FPS + 1e-6), n1 = 55;
    if (f < n1) return Math.max(1, f + 1);
    const t1 = k.game + n1 / FPS; return 116 + Math.min(12, Math.floor(13 * clamp((t - t1) / (k.s12 - t1))));
  }
  function drawHandSide(ctx, x, y, flip, lw) {
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], P.jacketDk, { lw });
    C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], P.skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], P.skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, P.skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, P.skinDk);
    ctx.restore();
  }
  shot('game', (ctx, t, u, k) => {
    ctx.drawImage(blurWorld('p3a-bgame', 1.6, 420, 1400, 16), 0, 0);
    vignette(ctx, .45);
    const tw = q2(t), z = 1.3 * lerp(.97, 1.03, E.io(u)), jx = Math.sin(tw * 2.1) * 3, jy = Math.sin(tw * 1.3 + 1) * 3, rot = -.07 + Math.sin(tw * .8) * .006;
    ctx.save(); ctx.translate(540 + jx, 770 + jy); ctx.rotate(rot * .6); ctx.transform(1, 0, -.035, 1, 0, 0); ctx.scale(z, z);
    const SW = 486, SH = 864, BWd = 548, BHt = 1000;
    drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6);
    C.seed(171); C.shape(ctx, rrectPts(-BWd / 2, -BHt / 2, BWd, BHt, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BWd / 2, -BHt / 2, 30, BHt); } });
    C.shape(ctx, [[-60, -BHt / 2 + 24], [60, -BHt / 2 + 24], [60, -BHt / 2 + 36], [-60, -BHt / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SW / 2, -SH / 2, SW, SH, 34); ctx.clip();
    const im = gameImgs[gameIdx(t, k)]; if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -SW / 2, -SH / 2, SW, SH); else { ctx.fillStyle = '#2f3a4b'; ctx.fillRect(-SW / 2, -SH / 2, SW, SH); }
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SW / 2, -SH / 2 + 80); ctx.lineTo(-SW / 2 + 220, -SH / 2); ctx.lineTo(-SW / 2 + 300, -SH / 2); ctx.lineTo(-SW / 2, -SH / 2 + 180); ctx.fill();
    ctx.restore();
    C.ink(ctx, (() => { const p = new Path2D(); const q = C.wobble(rrectPts(-SW / 2, -SH / 2, SW, SH, 34, 6), true, .5); p.moveTo(q[0][0], q[0][1]); q.forEach(v => p.lineTo(v[0], v[1])); p.closePath(); return p; })(), 4);
    // sağ başparmak: "upgrades"te SHOP düğmesinin üstüne gelir, basmaz (bekler)
    const SP = [(150 / 450 - .5) * SW, (574 / 800 - .5) * SH];
    const th = q1(t), inU = E.outC(seg(th, k.upg - .35, k.upg + .05));
    const tx = lerp(330, SP[0] + 34, inU), ty = lerp(560, SP[1] + 56, inU) + Math.sin(tw * 5) * 3 * inU;
    drawHandSide(ctx, BWd / 2 - 10, 0, true, 6);
    C.seed(172);
    C.shape(ctx, [[BWd / 2 + 60, 380], [tx + 50, ty - 30], [tx + 10, ty - 50], [tx - 30, ty - 30], [tx - 20, ty + 20], [BWd / 2 + 20, 470]], P.skin, { lw: 6, shade: c => C.blot(c, [[tx - 10, ty + 5], [BWd / 2 + 80, 420], [BWd / 2 + 80, 520], [tx, ty + 60]], P.skinDk, .5) });
    C.shape(ctx, [[tx - 22, ty - 34], [tx + 6, ty - 46], [tx + 18, ty - 24], [tx - 8, ty - 14]], '#e7b896', { lw: 3 });
    ctx.restore();
  });
  // s12  "Here it buys Daisy…"  gerçeğe dönüş: Kaan tek bir eski lastiği yuvarlayarak Daisy'ye getirir
  function rollingTire(ctx, x, y, s, ang, lean) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(lean || 0); ctx.scale(s, s); C.seed(6301);
    C.shape(ctx, C.ell(0, -60, 34, 60, 26), '#45474c', { lw: 5, shade: c => { C.blot(c, C.ell(10, -54, 26, 50, 16), '#2c2e33', .6); C.blot(c, [[-30, -110], [-6, -116], [-10, -96], [-30, -94]], '#6c6f75', .7); } });
    C.shape(ctx, C.ell(4, -60, 15, 30, 18), '#8a8f96', { lw: 4 });
    for (let i = 0; i < 6; i++) { const a = ang + i / 6 * TAU, yy = -60 + Math.sin(a) * 52; if (Math.cos(a) < 0) continue; C.line(ctx, [[-32 * Math.cos(Math.asin(clamp(Math.sin(a), -1, 1))) + 2, yy], [-24, yy + 2]], 3, '#6c6f75', .1); }
    ctx.restore();
  }
  shot('s12', (ctx, t, u, k) => {
    const tw = q2(t), z = lerp(1.95, 2.05, E.io(u));
    const roll = E.outQ(seg(tw, k.s12, k.daisyW - .1)), tX = lerp(600, 380, roll), tAng = -roll * 9;
    const settle = seg(tw, k.daisyW - .1, k.daisyW + .2), wob = Math.sin(settle * 10) * .12 * (1 - settle);
    const kx = lerp(680, 470, roll);
    ctx.save(); cam(ctx, z, 360, 1370);
    drawWorld(ctx, t, { daisy: { mood: tw >= k.daisyW ? 'alert' : 'sleepy' } });
    // tekerin izi
    ctx.save(); ctx.globalAlpha = .25; ctx.strokeStyle = P.groundDk; ctx.lineWidth = 8; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(620, 1512); ctx.lineTo(tX, 1512); ctx.stroke(); ctx.restore();
    rollingTire(ctx, tX, 1512, 1.0, tAng, roll >= 1 ? .08 + wob : 0);
    C.drawKaan(ctx, { x: kx + 40, y: 1560, s: .5, seed: 11, phone: false, expr: tw > k.daisyW ? 'sheepish' : 'calm', look: -.8, blink: blinkAt(t, [k.daisyW + .4]) });
    ctx.restore();
  });
  // s12b  "…one used tire."  yeni (eski) lastik takılı; siperlik iner
  shot('s12b', (ctx, t, u, k) => {
    const tw = q2(t), z = lerp(1, 1.04, E.io(u));
    ctx.drawImage(blurWorld('p3a-b12', 1.8, 300, 1300, 12, { daisy: { mood: 'sleepy' } }), 0, 0);
    ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960);
    const sag = E.outC(seg(tw, k.tire, k.tire + .3)) * 6, mood = tw >= k.tire - .1 ? 'sleepy' : 'alert';
    const dx = 330, dy = 1100, ds = 1.85;
    ctx.save(); ctx.translate(dx + 330, dy); ctx.rotate(sag * .004); ctx.translate(-dx - 330, -dy);
    C.drawDaisy(ctx, { x: dx, y: dy + sag, s: ds, seed: 23, beep: 0, mood, boom: 0, hook: Math.sin(t * 1.3) * .03 });
    daisyTire(ctx, dx, dy + sag, ds, { tag: true, tagSwing: Math.sin(t * 2.4) * .06 + (tw >= k.tire ? Math.sin((t - k.tire) * 14) * .2 * Math.exp(-(t - k.tire) * 3) : 0) });
    ctx.restore();
    ctx.restore();
    vignette(ctx, .25);
  });

  /* ================= SES EKİBİ İÇİN GÖRSEL ANLAR ================= */
  TB.cuesA = {};
  Object.defineProperty(TB, 'cuesA', {
    enumerable: true, get() {
      if (!TB.tl) return {};
      const k = K(), cue = {};
      cue.carSettle = 0;                                          // araba yeni durmuş, yaylanma
      cue.cashOut = .0;                                           // deste camdan uzanır (0–0,9)
      cue.doorOpen = +(k.s04 + .08 + .13).toFixed(2);             // kapı kilidi/açılış
      cue.haleStep = +(k.s04 + .08 + .87).toFixed(2);             // Hale ayağını yere basar
      cue.craneWave = +k.crane.toFixed(2);                        // el sallama "crane"
      cue.landSweep = +k.land.toFixed(2);
      cue.fingerTap = +k.touch.toFixed(2);                        // parmak listeye değer
      cue.paperPocket = +(k.s09 + .8).toFixed(2);                 // liste cebe kayar
      cue.pat1 = +(k.s09 + 1.2).toFixed(2); cue.pat2 = +(k.s09 + 1.45).toFixed(2);
      cue.billCount = [...Array(7).keys()].map(i => +(k.count0 + .06 + i * .2).toFixed(2));   // her banknot (kâğıt para sayımı)
      cue.gameIn = +k.game.toFixed(2);                            // telefon: oyun kareleri (oyunun kendi sesi kısık)
      cue.gameDemolished = +(k.game + 48 / FPS).toFixed(2);       // "DEMOLISHED!" damgası (kare ~49)
      cue.gameCard = +(k.game + 55 / FPS).toFixed(2);             // sonuç kartı (SHOP)
      cue.cutReal = +k.s12.toFixed(2);                            // gerçeğe dönüş: avlu
      cue.tireRoll = +k.s12.toFixed(2);                           // lastik yuvarlanır (toprakta)
      cue.tireStop = +(k.daisyW - .1).toFixed(2);                 // lastik durur, yalpalar
      cue.daisyLid = +(k.tire - .1).toFixed(2);                   // siperlik iner (küçük metal tık)
      cue.tagSwing = +k.tire.toFixed(2);
      return cue;
    }
  });
})();
