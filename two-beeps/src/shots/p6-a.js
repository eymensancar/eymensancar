/* Part 6 · IRONLINE — Animatör A: cümle 1–10. 0 → (S10.t1 + S11.t0)/2 ≈ 23,68 sn.
   KAFE MASASI — ÜSTTEN (dünya = C.drawCafe alanı 0,0,1080,1920; seed 7; masa her yöne uzar, Kaan tarafı kenarı y=1920):
   - Defne ÜSTTE oturur (omzu ≈(700,-700)), Kaan ALTTA (kolları alt kenardan gelir). Kızartma kutusu (302,576) rot −0,15 (drawCafe, k 1,2);
     Defne'nin kahvesi evde (799,576), ağız yarıçapı 80 (drawCafe'nin bardağı silindi, bardağı bu dosya çizer).
   - Zarf (8. cümlede konur): merkez (620,880), rot 0,04, s 80/56 ≈ 1,43 (drawLetter envelope, ring, köşede "TUE" posta damgası);
     halka merkezi ≈(738,922), yarıçap 80 = bardak ağzı. 8. cümle sonunda Defne bardağını halkaya oturtur: kesmede bardak (738,922).
   KAFE — KARŞIDAN (Kaan'ın omzundan; ekran koordinatı = dünya, z 1'de):
   - Defne oturur (560,1500) s 2,2 (pose 'sit', seat yok), yüz ≈(560,780); iki eli bardakta (516/604,1151). Masanın uzak kenarı y 1196.
   - Masada: zarf (483,1254) s .915, y yassı .32; bardak (560, taban 1262) coffeeCup k 3,2; kızartma kutusu sol (120–290, taban 1232).
   - Kaan arkadan sağ altta (930,2330) s 2 (tutam ≈1170). Pencere sağda x 640–1010, y 300–900 (bulutlu gün; yağmur henüz yok); sarkıt lamba (300,330).
   - Kesmede (23,68): karşıdan yakın plan, z 1,6, merkez (560,800) → ekran (540,760); Defne 'worried', bakış Kaan'a (look .3).
   Geri dönüşler: 3–4 sepya (avlu posta kutusu, p2-a yerleşimi; zarf + posta damgası), 6 sonu P2/P3 halkaları 0,5'er sn gri, 7 sepya (P2 defter "Ant" + tutam fiskesi).
   Karakterler ikişerli (15 poz/sn), kamera/toz/buhar birerli. Rastgelelik yalnız tohumlu (TB.rand). */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30, LEAD = .12;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;

  /* ================= ZAMANLAR (hepsi timeline'dan) ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1];
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const k = {};
    k.c2 = S(2).t0 - LEAD;                                   // geniş masa: karşıdaki el
    k.eating = W(2, /^eating/i, 6).t0; k.myFries = W(2, /^my/i, 7).t0; k.fries = W(2, /^fries/i, 8).t0;
    k.c3 = S(3).t0 - LEAD;                                   // sepya: posta kutusu
    k.came = W(3, /^came/i, 3).t0; k.tuesday = W(3, /^Tuesday/i, 6).t0;
    k.c4 = S(4).t0 - LEAD;                                   // sepya: zarfın üstündeki ad
    k.c5 = S(5).t0 - LEAD;                                   // masaya dönüş: zarf elde
    k.flip = W(5, /^looked/i, 4).t0;                         // zarf döner
    k.c6 = W(5, /^envelope/i, 7).t0 + .16;                   // halka yakın plan
    k.ring = W(6, /^ring/i, 4).t0;
    k.mem1 = S(6).t1 - .29;                                  // P2 halkası (gri, 0,5 sn)
    k.mem2 = k.mem1 + .5;                                    // P3 halkası (gri)
    k.c7 = S(7).t0 - LEAD;                                   // sepya: dedenin "Ant"ı
    k.c7b = W(7, /^called/i, 5).t0 - .04;                    // sepya: Defne'nin parmağı tutamda
    k.flick = W(7, /^Ant/i, 7).t0 - .04;
    k.c8 = S(8).t0 - LEAD;                                   // masa: zarf konur
    k.slap = W(8, /^put/i, 1).t0;
    k.drop = k.slap + .24;                                   // Defne kızartmayı bırakır
    k.cup0 = W(8, /^table/i, 5).t0 - .1; k.cup1 = k.cup0 + .45;   // bardak halkaya oturur
    k.c9 = S(9).t0 - LEAD;                                   // karşıdan: Defne
    k.not = W(9, /^not/i, 2).t0; k.pretend = W(9, /^pretend/i, 4).t0;
    k.c10 = S(10).t0 - LEAD;                                 // Defne konuşur
    k.w10 = S(10).words.map(w => w.t0);
    k.nineteen = W(10, /^nineteen/i, 2).t0; k.alone = W(10, /^alone/i, 4).t0; k.crane = W(10, /^crane/i, 7).t0; k.ant = W(10, /^Ant/i, 8).t0;
    k.c10b = k.alone - .15;                                  // daha yakın
    k.end = (S(10).t1 + S(11).t0) / 2;
    // kızartma çalmaları (r uzanır, g kapar, e çıkar)
    k.steals = [{ r: -.25, g: .55, e: 1.35 }, { r: 1.5, g: 2.05, e: 2.85 }, { r: 3.0, g: 3.45, e: 4.05 }, { r: k.fries - .55, g: k.fries + .02, e: k.fries + .62 },
      { r: k.c5 + .1, g: k.c5 + .62, e: k.c5 + 1.3 }, { r: k.c8 - .6, g: k.c8 - .15, e: 1e9 }];
    K = k; return k;
  }

  /* ================= YARDIMCILAR ================= */
  function cam(ctx, z, cx, cy, sx, sy) { ctx.translate(sx == null ? 540 : sx, sy == null ? 960 : sy); ctx.scale(z, z); ctx.translate(-cx, -cy); }
  function finish(ctx, dark) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (dark) { ctx.fillStyle = `rgba(7,11,24,${dark})`; ctx.fillRect(0, 0, 1080, 1920); }
    C.grain(ctx, 0, 0, 1080, 1920, .2);
  }
  function vignette(ctx, a, col) {
    const g = ctx.createRadialGradient(540, 860, 300, 540, 900, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col || `rgba(7,11,24,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const cache = {};
  function cached(key, w, h, fn) { if (!cache[key]) { const cv = canvas(w, h); fn(cv.getContext('2d')); cache[key] = cv; } return cache[key]; }
  // geri dönüş tonu: sahne geçici tuvale çizilir, filtreyle basılır (sepya: 3–4, 7; gri: hatıra kareleri)
  function toned(ctx, filter, warm, fn) {
    const cv = cached('ton', 1080, 1920, () => { }), g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 1080, 1920);
    g.save(); fn(g); g.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = filter; ctx.drawImage(cv, 0, 0); ctx.filter = 'none';
    if (warm) { ctx.fillStyle = warm; ctx.fillRect(0, 0, 1080, 1920); }
    ctx.restore();
  }
  const SEPIA = 'sepia(.78) saturate(.9) brightness(1.03) contrast(.95)', GRAY = 'grayscale(1) contrast(.82) brightness(1.06)';
  function airDust(ctx, t, n, sb, box, a) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(241,232,212,${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }
  function steam(ctx, x, y, k, t, sd, a) {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = ((t * .55 + rnd(sd + i)) % 1), h = 70 * k;
      ctx.strokeStyle = `rgba(255,252,240,${(a == null ? .5 : a) * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 3.2 * k;
      ctx.beginPath();
      for (let j = 0; j <= 10; j++) { const v = j / 10, yy = y - ph * h * .6 - v * h, xx = x + (i - 1) * 7 * k + Math.sin(v * 5 + t * 2.2 + i * 2) * 6 * k * v; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function nod(t, words, amp) { let r = 0; const tw = twos(t); words.forEach(w => { const d = tw - w; if (d >= 0 && d < .4) r += Math.sin(d / .4 * Math.PI) * (amp || .018); }); return r; }
  const rotP = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

  function limbPlain(ctx, A, B, wa, wb, fill, dk) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 6, shade: c => C.blot(c, [[A[0] - nx * wa * .2, A[1] - ny * wa * .2], [B[0] - nx * wb * .2, B[1] - ny * wb * .2], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], dk || P.shirtDk, .6) });
  }
  function limbJacket(ctx, A, B, wa, wb, sd) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], P.jacket, { lw: 7, shade: c => C.blot(c, [[A[0] - nx * wa * .1, A[1] - ny * wa * .1], [B[0] - nx * wb * .1, B[1] - ny * wb * .1], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], P.jacketDk, .55) });
  }
  // kızartma çubuğu (drawCafe'deki ile aynı: 100×18, sarı)
  function fryStick(ctx, i) { C.seed(4100 + i); C.shape(ctx, [[-50, -9], [50, -9], [50, 9], [-50, 9]], i % 3 ? P.hazardHi : '#e8b65c', { lw: 3.4, amp: .4 }); }

  /* Defne'nin eli üstten (P2 defneFinger dili: krem gömlek kolu, kıvrık kol ucu). (x,y) = parmak ucu; kol omza (sh) doğru uzar.
     o.fry: parmaklarda kızartma (indeks), o.cup: avuç bardağın ağzında */
  const SHOULDER = [700, -700];
  function defneHand(ctx, x, y, s, o) {
    o = o || {}; const ang = Math.atan2(SHOULDER[1] - y, SHOULDER[0] - x) - .31;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); C.seed(551);
    limbPlain(ctx, [170, 40], [1900, 600], 54, 74, P.shirt);
    C.shape(ctx, [[150, -16], [196, -8], [186, 104], [136, 92]], P.shirtDk, { lw: 6 });
    C.shape(ctx, [[22, -14], [96, -38], [150, -20], [160, 50], [120, 84], [56, 70], [30, 34]], P.dSkin, { lw: 6, shade: c => C.blot(c, [[40, 40], [170, 40], [170, 100], [40, 100]], P.dSkinDk, .55) });
    for (let i = 0; i < 3; i++) C.shape(ctx, C.ell(52 + i * 26, 70 + i * 4, 20, 14, 12), i % 2 ? P.dSkinDk : P.dSkin, { lw: 5 });
    if (o.fry != null) { ctx.save(); ctx.translate(-6, 8); ctx.rotate(1.1); ctx.scale(1.2, 1.2); fryStick(ctx, o.fry); ctx.restore(); }
    C.seed(552);
    C.shape(ctx, [[-6, -12], [40, -22], [70, -24], [72, 4], [40, 8], [-4, 10], [-14, 0]], P.dSkin, { lw: 6 });
    C.shape(ctx, [[-6, -8], [8, -10], [10, 4], [-6, 6]], '#ecc8a8', { lw: 3, amp: .3 });
    if (o.fry != null) C.shape(ctx, [[10, 14], [44, 18], [56, 34], [20, 34]], P.dSkinDk, { lw: 5 });   // başparmak kızartmayı sıkıştırır
    ctx.restore();
  }
  // Kaan'ın eli üstten (p3-b drawFlatHand ile aynı): parmaklar sol yukarı, kol (yeşil ceket + sarı bileklik) arkaya uzar
  function flatHand(ctx, x, y, rot, s, curl, flip) {
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.rotate(rot); ctx.scale(s, s); C.seed(231);
    limbJacket(ctx, [430, 250], [1900, -100], 96, 130, 233);
    limbJacket(ctx, [90, 0], [430, 250], 62, 86, 232);
    C.shape(ctx, C.ell(430, 250, 84, 82, 20), P.jacket, { lw: 0 }); C.line(ctx, [[380, 300], [440, 320], [490, 280]], 5, P.jacketDk);
    C.shape(ctx, [[70, -40], [140, -20], [100, 70], [40, 40]], P.hazard, { lw: 6 });
    const fl = 1 - (curl || 0) * .35;
    C.shape(ctx, [[60, 50], [-20, 70], [-120 * fl, 40], [-140 * fl, 10], [-130 * fl, -20], [-140 * fl, -48], [-118 * fl, -70], [-30, -72], [20, -110], [50, -100], [40, -60], [90, -40]], P.skin, { lw: 6, shade: c => C.blot(c, [[-140, 20], [80, 30], [80, 90], [-140, 90]], P.skinDk, .55) });
    for (let i = 0; i < 3; i++) C.line(ctx, [[-30, -40 + i * 28], [-120 * fl, -46 + i * 30]], 3.6, P.skinDk);
    ctx.restore();
  }

  /* ================= ÜSTTEN MASA ================= */
  const OFF = 300, BOX = [302.4, 576], BOXR = -.15, BOXK = 1.2, CUP_HOME = [799.2, 576], CUP_R = 80;
  const ENV = { x: 620, y: 880, rot: .04, s: 80 / 56 };
  const RING = (() => { const p = rotP([83.6 * ENV.s, 26.4 * ENV.s], ENV.rot); return [ENV.x + p[0], ENV.y + p[1]]; })();
  const NFRY = 24;
  function tableCv() {
    return cached('masa', 1080 + 2 * OFF, 1920 + 2 * OFF, g => {
      const W = 1080 + 2 * OFF, H = 1920 + 2 * OFF;
      g.fillStyle = '#c96a3e'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(21,18,13,.18)'; g.lineWidth = 3; for (let i = 0; i < W + H; i += 60) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - H, H); g.stroke(); }
      C.seed(6601); for (let i = 0; i < 10; i++) C.blot(g, C.ell(rnd(6610 + i) * W, (rnd(6630 + i) < .5 ? rnd(6650 + i) * OFF : H - rnd(6650 + i) * OFF), 50 + rnd(6670 + i) * 90, 20 + rnd(6690 + i) * 40, 12), '#a8532c', .3);
      C.drawCafe(g, { x: OFF, y: OFF, w: 1080, h: 1920, seed: 7, letter: false, ring: false, fries: 0 });
      // drawCafe'nin bardağını sil: boş masa parçası (çizgi deseni hizalı: dx+dy = 60'ın katı), yumuşak kenarlı
      const src = canvas(W, H); src.getContext('2d').drawImage(g.canvas, 0, 0);
      const pc = canvas(320, 320), pg = pc.getContext('2d'), sx = 575, sy = 1520;
      pg.drawImage(src, -(sx + OFF - 160), -(sy + OFF - 160));
      pg.globalCompositeOperation = 'destination-in'; const m = pg.createRadialGradient(160, 160, 128, 160, 160, 156); m.addColorStop(0, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)'); pg.fillStyle = m; pg.fillRect(0, 0, 320, 320);
      g.drawImage(pc, CUP_HOME[0] + 12 + OFF - 160, CUP_HOME[1] + 12 + OFF - 160);
      // Kaan tarafındaki masa kenarı + zemin
      const ey = 1920 + OFF;
      g.fillStyle = '#2b211c'; g.fillRect(0, ey + 46, W, H);
      C.seed(6602); C.shape(g, [[-20, ey], [W + 20, ey], [W + 20, ey + 46], [-20, ey + 46]], '#8a4426', { lw: 5 });
      C.line(g, [[-20, ey + 8], [W + 20, ey + 8]], 2.4, 'rgba(255,220,180,.25)', .6);
    });
  }
  function fryLocal(i) { return [(rnd(i + 1) - .5) * 180, (rnd(i + 50) - .5) * 150, rnd(i + 90) * 3]; }
  function fryWorld(i) { const f = fryLocal(i), p = rotP([f[0] * BOXK, f[1] * BOXK], BOXR); return [BOX[0] + p[0], BOX[1] + p[1]]; }
  function drawFries(ctx, n) {
    ctx.save(); ctx.translate(BOX[0], BOX[1]); ctx.rotate(BOXR); ctx.scale(BOXK, BOXK);
    for (let i = 0; i < n; i++) { const f = fryLocal(i); ctx.save(); ctx.translate(f[0], f[1]); ctx.rotate(f[2]); fryStick(ctx, i); ctx.restore(); }
    ctx.restore();
  }
  // bardak üstten (drawCafe coffeeTop ile aynı çizim; lift: kalkık, gölge açılır)
  function cupTop(ctx, x, y, lift, t) {
    const k = CUP_R / 80, l = lift || 0;
    ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = .25 * (1 - l * .4); ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse((12 + l * 26) * k, (14 + l * 30) * k, 82 * k, 82 * k, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.scale(k * (1 + l * .06), k * (1 + l * .06)); C.seed(6620);
    C.shape(ctx, C.ell(0, 0, 80, 80, 30), P.paper, { lw: 5 }); C.shape(ctx, C.ell(0, 0, 62, 62, 26), P.coffee, { lw: 3.5, shade: c => C.blot(c, C.ell(-18, -16, 24, 14, 12), '#a7713e', .7) });
    ctx.restore();
    if (t != null) steam(ctx, x + 4, y - 20, 1.3, t, 71, .35);
  }
  // posta damgası: "TUE" (zarfın sol ortası; zarf yerelinde)
  function postmark(ctx) {
    ctx.save(); ctx.translate(-128, -12); ctx.rotate(-.18); ctx.strokeStyle = 'rgba(58,48,38,.75)'; ctx.fillStyle = 'rgba(58,48,38,.8)';
    ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.stroke();
    ctx.font = '700 17px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TUE', 0, 1);
    ctx.lineWidth = 2.2; for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let x = 38; x <= 120; x += 4) { const y = -12 + i * 12 + Math.sin(x * .16) * 4; x === 38 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.restore();
  }
  function envFront(ctx, x, y, s, rot, sx) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx == null ? 1 : sx, 1);
    C.drawLetter(ctx, { kind: 'envelope', x: 0, y: 0, s, rot: 0, ring: true, seed: 82 });
    ctx.scale(s, s); postmark(ctx);
    ctx.restore();
  }
  function envBack(ctx, x, y, s, rot, sx) {
    const W = 380, H = 220;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale((sx == null ? 1 : sx) * s, s); C.seed(6630);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.fillRect(-W / 2 + 10, -H / 2 + 12, W, H); ctx.restore();
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], P.paper, { lw: 4.4 });
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [0, 34]], P.paperDk, { lw: 3.4 });
    C.line(ctx, [[-W / 2, H / 2], [-30, 10]], 2.4, 'rgba(21,18,13,.4)', .5); C.line(ctx, [[W / 2, H / 2], [30, 10]], 2.4, 'rgba(21,18,13,.4)', .5);
    ctx.restore();
  }

  /* ---------- masa durumu (zamandan) ---------- */
  const REST = [690, -260];   // Defne'nin eli masadan çekilince (kadraj dışı, omuz yönü)
  function friesLeft(t) { const k = times(); let n = NFRY; k.steals.forEach(s => { if (t >= s.g) n--; }); if (t >= k.drop + .12 && t < 1e8) n++; return Math.max(0, n); }
  function handState(t) {
    const k = times(), tw = twos(t);
    for (let j = 0; j < k.steals.length; j++) {
      const s = k.steals[j]; if (tw < s.r || tw >= s.e) continue;
      const nBefore = friesLeft(s.g - 1e-4), fi = nBefore - 1, tgt = fryWorld(fi);
      if (j === k.steals.length - 1) {                                // 8. cümle: kızartma elde, donar, bırakır, bardağa gider
        if (tw < s.g) { const u = E.outC(seg(tw, s.r, s.g)); return { x: lerp(REST[0], tgt[0], u), y: lerp(REST[1], tgt[1], u), fry: null }; }
        if (tw < k.slap) { const u = E.outQ(seg(tw, s.g, k.slap)); return { x: lerp(tgt[0], 520, u * .5), y: lerp(tgt[1], 300, u * .5), fry: fi }; }
        const hold = [lerp(tgt[0], 520, .5), lerp(tgt[1], 300, .5)];
        if (tw < k.drop) return { x: hold[0], y: hold[1], fry: fi };
        const cupGrab = [CUP_HOME[0] - 6, CUP_HOME[1] - 70];
        if (tw < k.cup0) { const u = E.io(seg(tw, k.drop, k.cup0)); return { x: lerp(hold[0], cupGrab[0], u), y: lerp(hold[1], cupGrab[1], u), fry: null, dropped: fi, du: seg(t, k.drop, k.drop + .12), from: hold }; }
        const u = E.io(seg(tw, k.cup0, k.cup1)), c = cupPos(t);
        return { x: c[0] - 6, y: c[1] - 70, fry: null, cup: true };
      }
      if (tw < s.g) { const u = E.outC(seg(tw, s.r, s.g)); return { x: lerp(REST[0], tgt[0], u), y: lerp(REST[1], tgt[1], u), fry: null }; }
      const u = E.inQ(seg(tw, s.g + .1, s.e)); return { x: lerp(tgt[0], REST[0], u), y: lerp(tgt[1], REST[1], u) - Math.sin(u * Math.PI) * 30, fry: fi };
    }
    return null;
  }
  function cupPos(t) {
    const k = times(), u = E.io(seg(twos(t), k.cup0, k.cup1));
    return [lerp(CUP_HOME[0], RING[0], u), lerp(CUP_HOME[1], RING[1], u)];
  }
  function cupLift(t) { const k = times(), tw = twos(t); return tw < k.cup0 || tw >= k.cup1 + .1 ? 0 : Math.sin(seg(tw, k.cup0 - .05, k.cup1 + .1) * Math.PI) * .9; }
  function envState(t) {           // 8. cümlede Kaan'ın eli zarfı aşağıdan getirir, "put"ta masaya
    const k = times(), tw = twos(t); if (tw < k.c8 - .2) return null;
    const u = E.outC(seg(tw, k.c8 - .05, k.slap));
    return { x: lerp(760, ENV.x, u), y: lerp(1560, ENV.y, u), rot: lerp(.42, ENV.rot, u), on: u >= 1 };
  }
  function tableTop(ctx, t, o) {
    o = o || {};
    ctx.drawImage(tableCv(), -OFF, -OFF);
    drawFries(ctx, friesLeft(t));
    const ev = o.env !== false ? envState(t) : null;
    if (ev) envFront(ctx, ev.x, ev.y, ENV.s, ev.rot);
    if (o.cup !== false) { const c = cupPos(t); cupTop(ctx, c[0], c[1], cupLift(t), t); }
    if (ev && o.kaanHand !== false) { // Kaan'ın eli zarfın sağ alt köşesinde; konunca çekilir
      const k = times(), tw = twos(t), back = E.inQ(seg(tw, k.slap + .12, k.slap + .5));
      const corner = rotP([150 * ENV.s, 80 * ENV.s], ev.rot);
      flatHand(ctx, ev.x + corner[0] + back * 160, ev.y + corner[1] + back * 700, 1.25, .78, .2);
    }
    const h = o.hand !== false ? handState(t) : null;
    if (h) {
      if (h.dropped != null && h.du < 1) { const tg = fryWorld(h.dropped), e = E.inQ(h.du); ctx.save(); ctx.translate(lerp(h.from[0], tg[0], e), lerp(h.from[1], tg[1], e)); ctx.rotate(lerp(1.1, fryLocal(h.dropped)[2], e)); ctx.scale(1.2, 1.2); fryStick(ctx, h.dropped); ctx.restore(); }
      defneHand(ctx, h.x, h.y, .82, { fry: h.fry });
    }
    if (o.kaanRest) { // Kaan'ın elleri masada (2. cümle); "my fries"te sağ el kutuya uzanır
      const k = times(), tw = twos(t), g = E.outC(seg(tw, k.myFries - .05, k.myFries + .3)) - E.io(seg(tw, k.fries + .5, k.c3));
      flatHand(ctx, lerp(780, 560, g), lerp(1330, 860, g), 1.25, .8, .1);
      flatHand(ctx, 330, 1350, 1.25, .8, .15, true);
    }
  }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  // "Previously" köşe görüntüsü: gece, ışıklı 40 katlı kule (P5 son karesi), x ≤ 882
  function prevInset(ctx, t) {
    const a = 1 - seg(t, 2.2, 2.42); if (a <= 0) return;
    const x = 704, y = 232, w = 176, h = 140;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(.035); ctx.translate(-w / 2, -h / 2);
    C.seed(561); C.shape(ctx, [[-8, -8], [w + 8, -8], [w + 8, h + 8], [-8, h + 8]], P.paper, { lw: 4 });
    const cv = cached('p6-onceki', 1080, 860, g => C.drawHaleTower(g, { x: 0, y: 0, w: 1080, h: 860, mode: 'night', seed: 5 }));
    ctx.drawImage(cv, 0, 0, w, h);
    ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  }

  /* --- 1: "I found Ironline Demolition." üstten kızartma; karşıdan bir el (0. karede uzanıyor) --- */
  shot('p6a-01-kizartma', k => 0, k => k.c2, (ctx, t, u) => {
    ctx.fillStyle = '#c96a3e'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.save(); cam(ctx, lerp(1.34, 1.42, E.io(u)), lerp(330, 345, E.io(u)), 600, 470, 1120);
    tableTop(ctx, t, { env: false });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
    prevInset(ctx, t);
  });

  /* --- 2: "It was sitting across from me, eating my fries." geniş üstten: Kaan'ın elleri altta, karşıdan el tekrar tekrar --- */
  shot('p6a-02-karsi', k => k.c2, k => k.c3, (ctx, t, u) => {
    ctx.fillStyle = '#c96a3e'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.save(); cam(ctx, lerp(.86, .82, E.io(u)), lerp(560, 570, E.io(u)), 860, 540, 760);
    tableTop(ctx, t, { env: false, kaanRest: true });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 3: geri dönüş (sepya): "The third letter came on a Tuesday." avlu, posta kutusu; zarf düşer, Kaan'ın eli çeker --- */
  const MB = { x: 669.6, slot: 1304, top: 1288 };
  function yardDay() { return cached('p6-avlu', 1080, 1920, g => C.drawYard(g, { seed: 7, mode: 'day', letter: false })); }
  shot('p6a-03-posta', k => k.c3, k => k.c4, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    toned(ctx, SEPIA, 'rgba(255,196,120,.07)', g => {
      cam(g, lerp(3.0, 3.25, E.io(u)), 690, 1290, 540, 860);
      g.drawImage(yardDay(), 0, 0);
      C.drawDaisy(g, { x: 960, y: 1395, s: .62, seed: 23, beep: 0, mood: 'sleepy', hook: .035 * Math.sin(t * 1.25) });
      // zarf: yuvaya düşer ("came"), "Tuesday"de el yukarı çeker
      const fall = E.outC(seg(t, k.came - .2, k.came + .08)), pull = E.ioC(seg(tw, k.tuesday - .05, k.c4 - .05));
      if (t >= k.came - .2) {
        const ey = lerp(MB.top - 70, MB.top, fall) - pull * 120, mx = MB.x;
        g.save(); g.beginPath(); g.rect(mx - 60, 900, 120, MB.slot - 900); g.clip();
        C.seed(360); C.shape(g, [[mx - 18, ey], [mx + 16, ey - 2], [mx + 18, ey - 22 - pull * 70], [mx - 16, ey - 20 - pull * 70]], P.paper, { lw: 2.6 });
        g.restore();
        if (tw >= k.tuesday - .35) { const hin = E.outC(seg(tw, k.tuesday - .35, k.tuesday - .05)); flatHand(g, mx + 14 + (1 - hin) * 60, ey - 26 - pull * 70 + (1 - hin) * 120, 1.05, .16, .55); }
      }
      airDust(g, t, 10, 81, [480, 1100, 420, 300], .7);
    });
    vignette(ctx, .45, 'rgba(40,24,10,.5)');
    finish(ctx);
  });

  /* --- 4: "Same name." (sepya) zarfın antedi + "TUE" posta damgası, Kaan'ın başparmakları --- */
  function envInHands(ctx, x, y, s, rot, back, sx, tw) {
    const jx = Math.sin(tw * 1.9) * 2.5, jy = Math.sin(tw * 1.2 + 2) * 2.5;
    if (back) envBack(ctx, x + jx, y + jy, s, rot, sx); else envFront(ctx, x + jx, y + jy, s, rot, sx);
    ctx.save(); ctx.translate(x + jx, y + jy); ctx.rotate(rot); C.seed(851);
    [-1, 1].forEach(d => C.shape(ctx, C.ell(d * (190 * s * Math.abs(sx) - 8 * s), 30 * s, 20 * s, 30 * s, 14), P.skin, { lw: 3.2 * Math.sqrt(s), shade: c => C.blot(c, C.ell(d * 190 * s * Math.abs(sx), 38 * s, 14 * s, 22 * s, 10), P.skinDk, .5) }));
    ctx.restore();
  }
  shot('p6a-04-ad', k => k.c4, k => k.c5, (ctx, t, u) => {
    toned(ctx, SEPIA, 'rgba(255,196,120,.07)', g => {
      g.drawImage(cached('p6-avlu-yakin', 1080, 1920, c => { const tmp = canvas(1080, 1920), q = tmp.getContext('2d'); cam(q, 3.4, 690, 1250, 540, 900); q.drawImage(yardDay(), 0, 0); c.filter = 'blur(12px)'; c.drawImage(tmp, 0, 0); c.filter = 'none'; }), 0, 0);
      g.fillStyle = 'rgba(21,18,13,.12)'; g.fillRect(0, 0, 1080, 1920);
      const z = lerp(3.0, 3.2, E.io(u));
      envInHands(g, 540 + 110 * z, 840 + 50 * z, z, -.04, false, 1, twos(t));
    });
    vignette(ctx, .45, 'rgba(40,24,10,.5)');
    finish(ctx);
  });

  /* --- 5: "But this time I looked at the envelope." masaya sert dönüş: zarf Kaan'ın elinde, "looked"ta döner --- */
  function tableBlur(key, z, cx, cy, sx, sy) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      g.fillStyle = '#c96a3e'; g.fillRect(0, 0, 1080, 1920);
      cam(g, z, cx, cy, sx, sy); g.drawImage(tableCv(), -OFF, -OFF); drawFries(g, NFRY - 4); cupTop(g, CUP_HOME[0], CUP_HOME[1], 0);
      c.filter = 'blur(9px)'; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
  }
  shot('p6a-05-zarf', k => k.c5, k => k.c6, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.drawImage(tableBlur('p6-masa-bulanik', .9, 560, 700, 540, 700), 0, 0);
    // arkada (bulanık) karşıdaki el bir kızartma daha alır
    ctx.save(); ctx.filter = 'blur(6px)'; cam(ctx, .9, 560, 700, 540, 700);
    const h = handState(t); if (h) defneHand(ctx, h.x, h.y, .82, { fry: h.fry });
    ctx.restore(); ctx.filter = 'none';
    ctx.fillStyle = 'rgba(21,18,13,.1)'; ctx.fillRect(0, 0, 1080, 1920);
    const f = seg(tw, k.flip, k.flip + .33), sx = Math.cos(f * Math.PI), z = lerp(2.05, 2.25, E.io(seg(t, k.flip + .3, k.c6)));
    const zx = lerp(540, 470, E.io(seg(t, k.flip + .3, k.c6))), zy = lerp(820, 790, E.io(seg(t, k.flip + .3, k.c6)));
    envInHands(ctx, zx, zy + Math.sin(f * Math.PI) * -30, z, lerp(.1, -.03, E.io(f)), f < .5, Math.max(.04, Math.abs(sx)) * (f < .5 ? 1 : 1), tw);
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 6: "There was a coffee ring on it." halka yakın plan + sessizlik; sonra P2 ve P3 halkaları 0,5'er sn gri --- */
  shot('p6a-06-halka', k => k.c6, k => k.mem1, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.drawImage(tableBlur('p6-masa-bulanik2', 1.2, 600, 760, 540, 900), 0, 0);
    ctx.fillStyle = 'rgba(21,18,13,.16)'; ctx.fillRect(0, 0, 1080, 1920);
    const z = lerp(4.0, 4.35, E.io(u)) + .1 * E.io(seg(t, k.ring - .1, k.ring + .4));
    const rx = 83.6, ry = 26.4;   // halka zarf yerelinde
    const jx = Math.sin(tw * 1.9) * 2, jy = Math.sin(tw * 1.2 + 2) * 2;
    ctx.save(); ctx.translate(540 + jx, 780 + jy); ctx.rotate(-.03); ctx.translate(-rx * z, -ry * z);
    envFront(ctx, 0, 0, z, 0);
    C.seed(852); C.shape(ctx, C.ell(190 * z - 6 * z, 30 * z, 20 * z, 30 * z, 14), P.skin, { lw: 3.2 * Math.sqrt(z), shade: c => C.blot(c, C.ell(190 * z, 38 * z, 14 * z, 22 * z, 10), P.skinDk, .5) });
    ctx.restore();
    vignette(ctx, .4);
    finish(ctx);
  });
  // P2 şikâyet kâğıdının köşesi (p2-b complaintFull ile aynı çizim, aynı açı: halka sağ altta)
  function complaintFull(ctx) {
    C.drawLetter(ctx, { kind: 'letter', x: 0, y: 0, s: 1, seed: 81, lines: ['To: Building Safety Office', 'About: the Kaya yard.', '', '', 'A 19-year-old on an', 'old crane. Stop him.'] });
    ctx.save(); ctx.fillStyle = P.ink; ctx.font = '700 30px Rubik'; ctx.textAlign = 'left'; ctx.fillText('UNSAFE WORK.', -142, -230 + 140 + 2.5 * 34); ctx.restore();
    ctx.save(); ctx.fillStyle = P.ink; ctx.font = '500 13px Rubik'; ctx.textAlign = 'left'; ctx.fillText('IRONLINE DEMOLITION', -128, 206); ctx.restore();
    ctx.save(); ctx.globalAlpha = .26; ctx.strokeStyle = P.coffee; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(118, 168, 44, .7, 5.9); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(118, 168, 37, 1.3, 4.2); ctx.stroke(); ctx.restore();
  }
  shot('p6a-06b-p2', k => k.mem1, k => k.mem2, (ctx, t, u) => {
    toned(ctx, GRAY, null, g => {
      g.fillStyle = '#6f6458'; g.fillRect(0, 0, 1080, 1920);
      const z = lerp(3.2, 3.3, u); g.translate(540, 820); g.scale(z, z); g.rotate(-.03); g.translate(-90, -150);
      complaintFull(g);
      C.seed(853); [-1, 1].forEach(d => C.shape(g, C.ell(d * 176, 40, 20, 30, 14), P.skin, { lw: 3.2 }));
    });
    vignette(ctx, .5);
    finish(ctx);
  });
  shot('p6a-06c-p3', k => k.mem2, k => k.c7, (ctx, t, u) => {
    toned(ctx, GRAY, null, g => {
      g.fillStyle = P.wood; g.fillRect(0, 0, 1080, 1920);
      C.seed(380); for (let i = 0; i < 14; i++) C.line(g, [[-20, 60 + i * 170 + rnd(i) * 40], [500, 80 + i * 170], [1100, 50 + i * 170 + rnd(i + 9) * 30]], 2.4, 'rgba(21,18,13,.35)', 1.5);
      const z = lerp(3.1, 3.2, u); g.translate(540, 820); g.scale(z, z); g.rotate(-.02); g.translate(-75, -55);
      C.drawLetter(g, { kind: 'letter', x: 0, y: 0, s: 1, rot: 0, lines: [], ring: true, seed: 81 });
      C.handwrite(g, '"The ant is not ready."', -146, -86, 23, P.ink, 17);
    });
    vignette(ctx, .5);
    finish(ctx);
  });

  /* --- 7a: "And only two people ever called me Ant." (sepya) dedenin defteri: el yazısı "Ant" (P2 ile aynı çizim) --- */
  function scrawl(ctx, x, y, len, lw, col, sd) {
    let cx = x, w = 0;
    while (cx < x + len && w < 12) {
      const nL = 2 + Math.floor(rnd(sd + w * 7) * 6), pts = []; let th = 0; const base = y + (rnd(sd + w * 11) - .5) * 4;
      for (let L = 0; L < nL; L++) { const hh = 10 + rnd(sd + w * 31 + L * 5) * 10 + (rnd(sd + w * 17 + L * 3) < .22 ? 16 : 0);
        for (let q = 0; q < 8; q++) { const a = th + q / 8 * TAU; pts.push([cx + a * 2.6 - Math.sin(a) * 7, base - hh * (1 - Math.cos(a)) / 2]); } th += TAU; }
      pts.push([cx + th * 2.6 + 4, base]);
      C.seed(sd + w * 3); ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(C.pathOf(C.wobble(pts, false, lw * .18, 6), false)); ctx.restore();
      cx += th * 2.6 + 18 + rnd(sd + w * 5) * 14; w++;
    }
  }
  function antDoodle(ctx, x, y, k) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); C.seed(571); const col = P.inkOld;
    [[0, 0, 15, 11], [24, -3, 9, 8], [42, -8, 11, 10]].forEach(([a, b, rx, ry]) => C.shape(ctx, C.ell(a, b, rx, ry, 12), col, { lw: 2.6, ink: col, amp: .5 }));
    [[-4, 6, -18, 22], [2, 8, 2, 26], [20, 4, 14, 24], [24, 4, 34, 22], [-6, -4, -20, -18], [26, -8, 30, -24]].forEach(([a, b, c2, d]) => C.line(ctx, [[a, b], [(a + c2) / 2 + 3, (b + d) / 2], [c2, d]], 2.6, col, .3));
    C.line(ctx, [[48, -16], [56, -36], [70, -44], [78, -36], [72, -30]], 2.6, col, .3);
    C.line(ctx, [[46, -16], [48, -34], [58, -48]], 2.4, col, .3);
    ctx.restore();
  }
  function notebookPage(g, t, z) {
    g.fillStyle = '#5e3b1d'; g.fillRect(0, 0, 1080, 1920);
    C.seed(581); for (let i = 0; i < 14; i++) C.line(g, [[-20, 100 + i * 140 + rnd(i) * 30], [1100, 120 + i * 140 + rnd(i + 30) * 30]], 3, '#3f2711', 2);
    g.save(); g.translate(420, 800); g.scale(z, z); g.translate(-420, -800);
    g.save(); g.translate(760, 980); g.rotate(-.05);
    g.save(); g.globalAlpha = .3; g.fillStyle = P.ink; g.fillRect(-470, -700, 1000, 1500); g.restore();
    C.seed(582); C.shape(g, [[-500, -720], [560, -730], [560, 800], [-500, 790]], P.page, { lw: 5, shade: c => { C.blot(c, [[-520, 500], [580, 480], [580, 820], [-520, 820]], P.pageDk, .5); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(154,120,70,.18)'; c.beginPath(); c.arc(-480 + rnd(600 + i) * 1020, -700 + rnd(700 + i) * 1480, 2 + rnd(800 + i) * 6, 0, TAU); c.fill(); } } });
    g.strokeStyle = 'rgba(90,110,130,.22)'; g.lineWidth = 2; for (let yy = -620; yy < 780; yy += 78) { g.beginPath(); g.moveTo(-500, yy); g.lineTo(560, yy); g.stroke(); }
    g.strokeStyle = 'rgba(160,80,60,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-170, -730); g.lineTo(-170, 800); g.stroke();
    [-542, -464, -386, -308, -152, -74, 4, 82, 160].forEach((yy, i) => scrawl(g, -140, yy - 8, 560 - (i % 3) * 90, 4.2, P.inkOld, 4400 + i * 37));
    C.handwrite(g, 'Ant', -470, -170, 118, P.inkOld, 51, { bold: true });
    C.seed(583); C.line(g, [[-470, -140], [-370, -146], [-262, -138]], 4.4, P.inkOld, 1.2);
    antDoodle(g, -440, -40, 1.1);
    g.restore(); g.restore();
    airDust(g, t, 20, 59, [0, 200, 1080, 1100], .7);
    const gr = g.createRadialGradient(400, 760, 200, 540, 900, 1200); gr.addColorStop(0, 'rgba(255,210,122,.10)'); gr.addColorStop(1, 'rgba(20,10,4,.55)'); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
  }
  shot('p6a-07-dede', k => k.c7, k => k.c7b, (ctx, t, u) => {
    toned(ctx, SEPIA, 'rgba(255,196,120,.06)', g => notebookPage(g, t, lerp(1.2, 1.3, E.io(u))));
    vignette(ctx, .4, 'rgba(40,24,10,.5)');
    finish(ctx);
  });

  /* --- 7b: (sepya) P2 açılışı: Defne'nin parmağı tutamı yaylar ("Ant"ta bırakır) --- */
  const TUFT = [[-12, -526], [-6, -552], [8, -572], [30, -580], [46, -570], [44, -556], [36, -548], [38, -562], [26, -562], [14, -550], [12, -530]];
  function tuftAngle(t) {
    const k = times(), tw = twos(t);
    if (tw < k.flick) return -.95 + .1 * seg(tw, k.c7b, k.flick);
    const d = tw - k.flick;
    return -.85 * Math.exp(-3.4 * d) * Math.cos(10.5 * d);
  }
  function drawKaanTuft(ctx, x, y, s, ang, o) {
    ctx.save(); ctx.beginPath(); ctx.rect(-2000, y - 538 * s, 5000, 4000); ctx.clip();
    C.drawKaan(ctx, Object.assign({ x, y, s, seed: 11, phone: false }, o));
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(0, -531); ctx.rotate(ang); ctx.translate(0, 531);
    C.seed(541); C.shape(ctx, TUFT, P.hair, { lw: 5.2 / Math.sqrt(s) }); ctx.restore();
  }
  function defneFinger(ctx, fx, fy, rot) {
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(rot); C.seed(551);
    limbPlain(ctx, [170, 40], [700, 210], 54, 70, P.shirt);
    C.shape(ctx, [[150, -16], [196, -8], [186, 104], [136, 92]], P.shirtDk, { lw: 6 });
    C.shape(ctx, [[22, -14], [96, -38], [150, -20], [160, 50], [120, 84], [56, 70], [30, 34]], P.dSkin, { lw: 6, shade: c => C.blot(c, [[40, 40], [170, 40], [170, 100], [40, 100]], P.dSkinDk, .55) });
    for (let i = 0; i < 3; i++) C.shape(ctx, C.ell(52 + i * 26, 70 + i * 4, 20, 14, 12), i % 2 ? P.dSkinDk : P.dSkin, { lw: 5 });
    C.shape(ctx, [[-6, -12], [40, -22], [70, -24], [72, 4], [40, 8], [-4, 10], [-14, 0]], P.dSkin, { lw: 6 });
    C.shape(ctx, [[-6, -8], [8, -10], [10, 4], [-6, 6]], '#ecc8a8', { lw: 3, amp: .3 });
    ctx.restore();
  }
  function yardBlur() {
    return cached('p6-avlu-bulanik', 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      cam(g, 1.7, 520, 1330, 540, 900); g.drawImage(yardDay(), 0, 0);
      C.drawDaisy(g, { x: 960, y: 1395, s: .62, seed: 23, beep: 0, mood: 'sleepy', hook: .02 });
      c.filter = 'blur(9px)'; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
  }
  shot('p6a-07b-tutam', k => k.c7b, k => k.c8, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    toned(ctx, SEPIA, 'rgba(255,196,120,.06)', g => {
      const push = E.io(u);
      g.save(); g.translate(540, 960); g.scale(1.16 + .05 * push, 1.16 + .05 * push); g.drawImage(yardBlur(), -540, -1030); g.restore();
      g.save(); g.translate(540, 960); g.scale(1.04 + .04 * push, 1.04 + .04 * push); g.translate(-540, -960 - 480);
      const kx = 520, ky = 2770, s = 3.0, ang = tuftAngle(t);
      const expr = tw < k.flick + .1 ? 'sheepish' : 'smile', blink = tw >= k.flick + .5 && tw < k.flick + .6 ? 1 : 0;
      drawKaanTuft(g, kx, ky, s, ang, { expr, look: tw < k.flick + .1 ? .6 : .2, blink });
      const bd = tw - k.flick;
      if (bd >= 0 && bd < .45) { g.save(); g.globalAlpha = 1 - bd / .45; g.translate(kx, ky); g.scale(s, s); C.seed(545);
        [-1, 1].forEach(dd => C.line(g, C.ell(14, -566, 44 + bd * 40, 34 + bd * 30, 6, dd < 0 ? Math.PI * .85 : -Math.PI * .15, dd < 0 ? Math.PI * 1.15 : Math.PI * .15), 3.4)); g.restore(); }
      const tipX = kx + s * (Math.cos(-.95) * 30 - Math.sin(-.95) * -49), tipY = ky + s * (-531 + Math.sin(-.95) * 30 + Math.cos(-.95) * -49);
      const inn = E.outC(seg(tw, k.c7b - .05, k.c7b + .25)), slide = E.outC(seg(tw, k.flick - .1, k.flick + .05)), out = E.inQ(seg(tw, k.flick + .05, k.flick + .7));
      defneFinger(g, tipX + 6 + (1 - inn) * 500 - slide * 50 + out * 700, tipY - 6 - slide * 34 - out * 120, -.12 - slide * .2);
      g.restore();
    });
    vignette(ctx, .4, 'rgba(40,24,10,.5)');
    finish(ctx);
  });

  /* --- 8: "I put it on the table." üstten masa: zarf konur; donmuş el kızartmayı bırakır, bardağını halkaya oturtur --- */
  shot('p6a-08-masa', k => k.c8, k => k.c9, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.fillStyle = '#c96a3e'; ctx.fillRect(0, 0, 1080, 1920);
    const fit = E.io(seg(t, k.cup1, k.c9 + .1));
    const jolt = t >= k.slap && t < k.slap + 2 / FPS ? 4 : 0;   // zarf masaya: 2 kare küçük sarsıntı
    ctx.save(); cam(ctx, lerp(1.0, 1.04, E.io(u)) + .1 * fit, lerp(600, 640, fit), lerp(780, 830, fit), 540, 800 + jolt);
    tableTop(ctx, t);
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
    void tw;
  });

  /* ================= KARŞIDAN: KAFE İÇİ ================= */
  const FV = { dx: 560, dy: 1500, ds: 2.2, edge: 1196, cupX: 560, cupBase: 1262, cupK: 3.2, envX: 483.5, envY: 1254, envS: .915 };
  function cafeRoom() {
    return cached('p6-kafe', 1080, 1920, g => {
      C.seed(6700);
      g.fillStyle = '#7d5541'; g.fillRect(0, 0, 1080, 1920);
      for (let i = 0; i < 9; i++) C.blot(g, C.ell(rnd(6710 + i) * 1080, rnd(6720 + i) * 1000, 80 + rnd(6730 + i) * 120, 30 + rnd(6740 + i) * 40, 12), '#6a4535', .35);
      // pencere (bulutlu gün; sokak, uzak bloklar)
      const wx = 640, wy = 300, ww = 370, wh = 600;
      const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#9aa7b0'); sky.addColorStop(1, '#cdd2cf'); g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
      g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
      let bx = wx - 10, i = 0; while (bx < wx + ww) { const bw = 50 + rnd(6750 + i) * 70, bh = 120 + rnd(6760 + i) * 230; C.shape(g, [[bx, wy + wh], [bx, wy + wh - bh], [bx + bw, wy + wh - bh], [bx + bw, wy + wh]], P.far, { lw: 2, ink: P.far2, amp: .5 }); bx += bw + 8; i++; }
      g.fillStyle = '#9b9488'; g.fillRect(wx, wy + wh - 60, ww, 60);
      C.line(g, [[wx + 280, wy + wh - 60], [wx + 280, wy + 160]], 6, P.steelDk, .4); C.shape(g, C.ell(wx + 280, wy + 150, 18, 12, 10), P.steelDk, { lw: 2.4 });
      g.restore();
      C.shape(g, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], null, { lw: 7 });
      C.line(g, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], 6); C.line(g, [[wx, wy + wh * .42], [wx + ww, wy + wh * .42]], 6);
      C.shape(g, [[wx - 20, wy + wh], [wx + ww + 20, wy + wh], [wx + ww + 20, wy + wh + 22], [wx - 20, wy + wh + 22]], '#5e3b1d', { lw: 4 });
      // lambri
      C.shape(g, [[-20, 980], [1100, 980], [1100, 1300], [-20, 1300]], '#5e3b1d', { lw: 4, shade: c => { c.strokeStyle = 'rgba(21,18,13,.35)'; c.lineWidth = 3; for (let x = 40; x < 1080; x += 120) { c.beginPath(); c.moveTo(x, 1000); c.lineTo(x, 1300); c.stroke(); } } });
      // duvarda çerçeve (çizim: vinç silueti, mürekkep)
      C.shape(g, [[110, 520], [330, 510], [334, 760], [114, 766]], P.page, { lw: 5 });
      C.line(g, [[150, 730], [150, 580], [300, 560]], 4, P.inkOld, .6); C.line(g, [[300, 560], [300, 640]], 2.4, P.inkOld, .4); C.line(g, [[130, 732], [200, 732]], 4, P.inkOld, .4);
    });
  }
  function pendant(ctx, t) {
    const sw = Math.sin(t * 1.1) * .015; ctx.save(); ctx.translate(300, -40); ctx.rotate(sw); C.seed(6780);
    C.line(ctx, [[0, 0], [0, 300]], 3, P.ink, .2);
    C.shape(ctx, [[-70, 370], [-34, 300], [34, 300], [70, 370]], P.jacketDk, { lw: 5 });
    C.shape(ctx, C.ell(0, 372, 24, 10, 12), P.lamp, { lw: 3 });
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const gl = ctx.createRadialGradient(300, 360, 20, 300, 420, 620); gl.addColorStop(0, 'rgba(255,210,122,.45)'); gl.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = gl; ctx.fillRect(-300, -200, 1300, 1400); ctx.restore();
  }
  function clouds(ctx, t) {
    ctx.save(); ctx.beginPath(); ctx.rect(640, 300, 370, 600); ctx.clip();
    for (let i = 0; i < 4; i++) { const x = 600 + ((rnd(6790 + i) * 500 + t * (6 + i * 3)) % 520), y = 330 + rnd(6795 + i) * 160; ctx.fillStyle = 'rgba(240,242,238,.5)'; ctx.beginPath(); ctx.ellipse(x, y, 70 + i * 12, 18 + i * 4, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function friesSide(ctx) {   // kızartma kutusu yandan (kırmızı çizgili kâğıt, üstte sarı çubuklar)
    C.seed(6800);
    for (let i = 0; i < 9; i++) { const x = 150 + i * 16 + (rnd(6810 + i) - .5) * 10, h = 60 + rnd(6820 + i) * 50, r = (rnd(6830 + i) - .5) * .5;
      ctx.save(); ctx.translate(x, 1120); ctx.rotate(r); C.shape(ctx, [[-8, -h], [8, -h], [8, 30], [-8, 30]], i % 3 ? P.hazardHi : '#e8b65c', { lw: 3.2, amp: .4 }); ctx.restore(); }
    C.shape(ctx, [[118, 1110], [302, 1110], [286, 1236], [134, 1236]], P.paper, { lw: 5, shade: c => { c.fillStyle = P.beaconOn; for (let x = 118; x < 300; x += 40) c.fillRect(x, 1100, 18, 150); } });
  }
  function tableFront(ctx) {
    C.seed(6840);
    C.shape(ctx, [[-30, FV.edge], [1110, FV.edge], [1110, 1960], [-30, 1960]], '#c96a3e', { lw: 6, shade: c => { c.strokeStyle = 'rgba(21,18,13,.16)'; c.lineWidth = 3; for (let i = -1200; i < 1400; i += 90) { c.beginPath(); c.moveTo(540 + i * .5, FV.edge); c.lineTo(540 + i * 1.6, 1960); c.stroke(); } C.blot(c, [[-30, FV.edge], [1110, FV.edge], [1110, FV.edge + 26], [-30, FV.edge + 26]], '#a8532c', .45); } });
  }
  function defneFront(ctx, d) {
    const sc = .9 * FV.ds, lw = 5.2 / Math.sqrt(sc);
    ctx.save(); ctx.translate(FV.dx, 1330 + (d.bob || 0)); ctx.rotate(d.rot || 0); ctx.translate(-FV.dx, -1330);
    C.drawDefne(ctx, { x: FV.dx, y: FV.dy, s: FV.ds, pose: 'sit', seat: false, seed: 31, expr: d.expr, look: d.look, blink: d.blink });
    ctx.restore();
    tableFront(ctx);
    friesSide(ctx);
    ctx.save(); ctx.translate(FV.envX, FV.envY); ctx.scale(1, .32); envFront(ctx, 0, 0, FV.envS, 0); ctx.restore();
    // bardak (halkanın üstünde) + iki el
    ctx.save(); ctx.translate(FV.dx, 1330 + (d.bob || 0)); ctx.rotate((d.rot || 0) * .4); ctx.translate(-FV.dx, -1330 - (d.bob || 0));
    C.seed(6850); C.coffeeCup(ctx, FV.cupX, FV.cupBase - 20 * FV.cupK, lw, FV.cupK);
    ctx.restore();
    ctx.save(); ctx.translate(FV.dx, 1330 + (d.bob || 0)); ctx.rotate(d.rot || 0); ctx.translate(-FV.dx, -1330);
    C.seed(6851); [[-22, -176], [22, -178]].forEach(([hx, hy]) => C.shape(ctx, C.ell(FV.dx + hx * sc * 1.05, FV.dy + hy * sc, 12 * sc, 13 * sc, 14), P.dSkin, { lw, shade: c => C.blot(c, C.ell(FV.dx + hx * sc * 1.05 + 4 * sc, FV.dy + hy * sc + 4 * sc, 9 * sc, 9 * sc, 10), P.dSkinDk, .5) }));
    ctx.restore();
    steam(ctx, FV.cupX, FV.cupBase - 48 * FV.cupK - 6, 1.8, d.t, 31, .45);
  }
  function kaanOTS(ctx, t) { // Kaan arkadan, sağ altta (omuz + tutam); hafif nefes
    const br = Math.sin(t * 1.5) * 4;
    C.drawKaan(ctx, { x: 930, y: 2330 + br, s: 2.0, seed: 11, pose: 'back' });
  }
  function defneState(t) {
    const k = times(), tw = twos(t);
    let expr = 'calm', look = .3, blink = 0, bob = 0, rot = 0;
    if (t < k.c10) {
      expr = tw < k.pretend + .1 ? 'calm' : 'serious';
      bob = -10 * Math.sin(seg(tw, k.pretend, k.pretend + .45) * Math.PI);            // küçük omuz silkme
      rot = .012 * Math.sin(seg(tw, k.pretend, k.pretend + .45) * Math.PI);
      look = tw < k.not ? .3 : tw < k.pretend ? .1 : .35;
    } else {
      expr = tw < k.alone ? 'serious' : 'worried';
      look = tw < k.ant ? .3 : .45;
      rot = nod(t, k.w10, .014) + (tw >= k.nineteen ? -.012 * E.io(seg(tw, k.nineteen, k.nineteen + .3)) : 0);
      bob = tw >= k.nineteen ? 6 * E.io(seg(tw, k.nineteen, k.nineteen + .3)) : 0;   // öne eğilir
    }
    const bl = [k.not + .05, k.c10 + .5, k.crane + .35, k.ant + .3];
    if (bl.some(b => tw >= b && tw < b + 3 / FPS)) blink = 1;
    return { expr, look, blink, bob, rot, t };
  }
  function frontScene(ctx, t, z, cx, cy, sx, sy) {
    ctx.save(); cam(ctx, z, cx, cy, sx, sy);
    ctx.drawImage(cafeRoom(), 0, 0); clouds(ctx, t);
    pendant(ctx, t);
    defneFront(ctx, defneState(t));
    kaanOTS(ctx, t);
    airDust(ctx, t, 14, 91, [0, 300, 1080, 900], .5);
    ctx.restore();
  }

  /* --- 9: "Defne did not even pretend." karşıdan: Defne'nin yüzü açılır, elleri bardakta --- */
  shot('p6a-09-defne', k => k.c9, k => k.c10, (ctx, t, u) => {
    frontScene(ctx, t, lerp(1.0, 1.08, E.io(u)), lerp(540, 560, E.io(u)), lerp(960, 930, E.io(u)), 540, 960);
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 10: "You were nineteen and alone on a crane, Ant." Defne konuşur: orta yakın → "alone"da yakın --- */
  shot('p6a-10-konusma', k => k.c10, k => k.c10b, (ctx, t, u) => {
    frontScene(ctx, t, lerp(1.28, 1.34, E.io(u)), 560, 860, 540, 800);
    vignette(ctx, .32);
    finish(ctx);
  });
  shot('p6a-10b-yakin', k => k.c10b, k => k.end, (ctx, t, u) => {
    frontScene(ctx, t, lerp(1.55, 1.62, E.io(u)), 560, 800, 540, 760);
    vignette(ctx, .36);
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const r3 = x => +x.toFixed(3);
  TB.cuesA = {
    get kizartmaKapma() { return times().steals.slice(0, 5).map(s => r3(s.g)); },   // karşıdaki el kızartma kapar (hafif kâğıt hışırtısı değil: tek kısa kâğıt tık)
    get postaZarf() { return r3(times().came); },                                   // sepya: zarf posta kutusuna düşer
    get zarfCekme() { return r3(times().tuesday); },                                // zarf kutudan çekilir (kâğıt)
    get zarfDonme() { return r3(times().flip); },                                   // zarf elde döner (kâğıt)
    get halkaSessizlik() { return r3(times().c6); },                                // halka yakın plan: müzik incelir/sessizlik
    get hatiraP2() { return r3(times().mem1); },                                    // gri hatıra kareleri (sessiz)
    get hatiraP3() { return r3(times().mem2); },
    get defterAnt() { return r3(times().c7); },                                     // sepya: dedenin defteri (sayfa)
    get tutamFiske() { return r3(times().flick); },                                 // P2'deki "boing" (yumuşak, tonlu)
    get zarfMasaya() { return r3(times().slap); },                                  // kâğıt masaya (plan: ses)
    get kizartmaBirak() { return r3(times().drop + .12); },
    get bardakKonur() { return r3(times().cup1); },                                 // karton bardak zarfa oturur (yumuşak tok)
    get defneYuz() { return r3(times().c9); }
  };
})();
