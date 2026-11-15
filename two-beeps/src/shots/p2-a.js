/* Part 2 · THE ANT — Animatör A: cümle 1–14. 0 → (S14.t1 + S15.t0)/2 ≈ 24,93 sn.
   AVLU YERLEŞİMİ (dünya = C.drawYard({seed:7, mode:'day', letter:true}) varsayılan alanı 0,0,1080,1920; p2-b.js ile AYNI):
   - ufuk y 1075; baraka (dedenin ofisi) x 108–670, taban y 1267; pencere x 187–355, y 852–1048 (içinde alçak takvim);
     ofis kapısı x 445–569, y 852–1267, topuz (544,1068), "OFFICE" levhası.
   - çit: üst y 1234, taban y 1344; bahçe kapısı (açıklık) x 778–994, tehlike şeritli bar y≈1268–1288.
   - posta kutusu: kutu x 636–704, y 1288–1336 (zarf ucu görünür), direk (670,1344→1536).
   - Daisy'nin PARK YERİ: bahçe kapısının önü, ön yüz ortası (960,1395), s .62, siperlik uykulu; bom ucu ≈(887,862), kanca ≈(887,1085).
     (B'nin sürüşü buradan başlar.) 1080 dışı ve y>1920 için gök/zemin/çit uzatması bu dosyada (ext).
   - Kaan (400,1790) s .9; Defne (575,1800) s .9 (Kaan solda, Defne sağda). Kaan'ın sol elinde H K taşı, sağ eline kahve geçer;
     Defne'nin önde kendi kahvesi (item 'coffee'), koltuk altında beyaz baret + rulo çizim.
   - Kesmede (24,93): Kaan ve Defne bahçe kapısına yürüyor (Defne önde ≈(680,1620) s≈.72, Kaan arkada-solda ≈(610,1560) s≈.67); Daisy park yerinde.
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
    const S = i => tl.sentences[i - 1], c = tl.cues;
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const k = {};
    k.flick = .1;                                          // parmak tutamı bırakır (0. karede bastırıyor)
    k.lift0 = S(1).t1 + .44; k.lift1 = k.lift0 + .5;       // kanca yazısı gidince kamera yüzü altyazının üstüne kaldırır
    k.droop0 = S(2).t0 + .3; k.droop1 = S(3).t0 - .1;
    k.c3 = S(3).t0 - LEAD;                                 // defter: dedenin "Ant"ı
    k.c4 = S(4).t0 - LEAD;                                 // geniş: Defne avluya yürür
    k.c5 = S(5).t0 - LEAD;                                 // yaka kartı
    k.c6 = S(6).t0 - LEAD;                                 // ikili: kahve el değiştirir
    k.coffee = W(6, /^coffee/i, 6).t0; k.give = k.coffee + .05;
    k.bad = W(6, /^bad/i, 8).t0;
    k.c7 = S(7).t0 - LEAD;                                 // Defne yakın
    k.sell = S(7).t0;
    k.c8 = S(8).t0 - LEAD;
    k.crane = W(8, /^crane/i, 1).t0; k.land = W(8, /^land/i, 3).t0; k.list = W(8, /^list/i, 5).t0;
    k.c9 = S(9).t0 - LEAD;
    k.nineteen = W(9, /^nineteen/i, 2).t0;
    k.c10 = S(10).t0 - LEAD;                               // Kaan'ın gözünden: taş uzatılır
    k.stampW = W(10, /^stamp/i, 4).t0;
    k.c11 = W(10, /^chimney/i, 7).t0 + .1;                 // H K damgası (P1 açısı), ≥ 2 sn temiz
    k.stamp = c.stamp;                                     // "tok"
    k.c12 = S(12).t0 - LEAD;                               // Defne susar
    k.quiet = S(12).t0;
    k.c13 = S(13).t0 - LEAD;
    k.then = W(13, /^Then/i, 0).t0; k.changed = W(13, /^changed/i, 2).t0;
    k.c14 = S(14).t0 - LEAD;                               // geniş: ofise doğru
    k.end = (S(14).t1 + S(15).t0) / 2;
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
  function limb(ctx, A, B, wa, wb, fill, sd) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    return C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 7, shade: c => C.blot(c, [[A[0] - nx * wa * .1, A[1] - ny * wa * .1], [B[0] - nx * wb * .1, B[1] - ny * wb * .1], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], P.jacketDk, .55) });
  }
  // Kaan'ın kavrayan eli (pilot/B ile aynı dil): ön kol sağ alttan gelir; flip ile soldan.
  function grip(ctx, x, y, rot, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); if (o.flip) ctx.scale(-1, 1); if (o.s) ctx.scale(o.s, o.s);
    limb(ctx, [380, 300], [900, 520], 92, 118, P.jacket, 233);
    limb(ctx, [70, 20], [380, 300], 60, 86, P.jacket, 232);
    C.seed(234); C.shape(ctx, C.ell(380, 300, 82, 80, 20), P.jacket, { lw: 0 });
    C.shape(ctx, [[58, -44], [128, -14], [96, 76], [30, 46]], P.hazard, { lw: 6 });
    C.seed(235);
    C.shape(ctx, [[-78, -50], [36, -72], [70, 6], [34, 66], [-70, 60], [-98, 6]], P.skin, { lw: 6.5, shade: c => C.blot(c, [[10, -80], [90, -80], [90, 90], [20, 90]], P.skinDk, .5) });
    for (let i = 0; i < 3; i++) C.line(ctx, [[-94 + i * 4, -20 + i * 26], [-54 + i * 4, -16 + i * 26]], 4.2);
    C.shape(ctx, [[-62, -60], [28, -82], [42, -60], [-48, -36]], '#d79a6c', { lw: 5 });
    ctx.restore();
  }
  function airDust(ctx, t, n, sb, box, a) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(241,232,212,${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }
  // kahve buharı (birerli): üç ince kıvrım yükselir ve söner
  function steam(ctx, x, y, k, t, sd, a) {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = ((t * .55 + rnd(sd + i) ) % 1), h = 70 * k;
      ctx.strokeStyle = `rgba(255,252,240,${(a == null ? .5 : a) * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 3.2 * k;
      ctx.beginPath();
      for (let j = 0; j <= 10; j++) { const v = j / 10, yy = y - ph * h * .6 - v * h, xx = x + (i - 1) * 7 * k + Math.sin(v * 5 + t * 2.2 + i * 2) * 6 * k * v; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    ctx.restore();
  }
  // yürüyüş: ikişerli adım sekmesi + küçük yalpa
  function walk(t, t0, per) { const ph = Math.max(0, twos(t) - t0) / (per || .5); return { bob: -Math.abs(Math.sin(ph * Math.PI)) * 9, rot: Math.sin(ph * Math.PI) * .022 * (Math.floor(ph) % 2 ? 1 : -1), ph }; }
  // konuşma başı: verilen kelimelerde küçük baş/gövde vuruşu (ayaktan döndürme, radyan)
  function nod(t, words, amp) { let r = 0; const tw = twos(t); words.forEach(w => { const d = tw - w; if (d >= 0 && d < .4) r += Math.sin(d / .4 * Math.PI) * (amp || .018); }); return r; }

  /* ================= DÜNYA: AVLU ================= */
  const HZ = 1920 * .56;
  const YD = (() => { const hz = HZ, bx = 108, bw = 561.6, by = hz + 192, bh = 576;
    return { hz, bx, bw, by, bh, wx: bx + bw * .14, wy: by - bh * .72, ww: bw * .3, wh: bh * .34, dx: bx + bw * .6, dw: bw * .22, dh: bh * .72, fy: hz + 1920 * .14, gx: 777.6 }; })();
  const DAISY = { x: 960, y: 1395, s: .62 };
  const KAAN = { x: 400, y: 1790, s: .9 }, DEFNE = { x: 575, y: 1800, s: .9 };
  const TIP = [-117.6, -859.3];

  // 0–1080 dışı ve y>1920: aynı gök/zemin degradesi, uzak bloklar, çit devamı
  function ext(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, P.sky0); g.addColorStop(.6, P.sky1); g.addColorStop(1, P.sky2);
    ctx.fillStyle = g; ctx.fillRect(-1600, -2400, 4400, HZ + 2402);
    const gg = ctx.createLinearGradient(0, HZ, 0, 1920); gg.addColorStop(0, P.groundLt); gg.addColorStop(.4, P.ground); gg.addColorStop(1, P.groundDk);
    ctx.fillStyle = gg; ctx.fillRect(-1600, HZ, 4400, 3200);
    C.seed(901);
    for (const side of [-1, 1]) {
      let cx = side < 0 ? -1600 : 1080, i = 0;
      while (cx < (side < 0 ? 0 : 2800)) { const bw = 60 + rnd(920 + i * 3 + side) * 70, bh = 60 + rnd(940 + i * 7 + side) * 150;
        C.shape(ctx, [[cx, HZ], [cx, HZ - bh], [cx + bw, HZ - bh], [cx + bw, HZ]], P.far, { lw: 2, ink: P.far2, amp: .5 }); cx += bw + 6 + rnd(960 + i) * 16; i++; }
      for (let j = 0; j < 8; j++) C.blot(ctx, C.ell((side < 0 ? -1500 : 1100) + rnd(980 + j + side * 50) * 1400, HZ + 40 + rnd(990 + j) * 1600, 50 + rnd(995 + j) * 80, 9 + rnd(999 + j) * 8, 12), j % 2 ? P.groundDk : P.groundLt, .25);
    }
    const fy = YD.fy;
    ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = P.dustDk; ctx.lineWidth = 1.3;
    ctx.save(); ctx.beginPath(); ctx.rect(-1600, 0, 1600, 3000); ctx.rect(1080, 0, 1800, 3000); ctx.clip();
    for (let fx = -20 - 14 * 120; fx < 2800; fx += 14) { if (fx > -60 && fx < 1060) continue; ctx.beginPath(); ctx.moveTo(fx, fy - 110); ctx.lineTo(fx + 50, fy); ctx.moveTo(fx + 50, fy - 110); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.restore(); ctx.restore();
    C.seed(905); C.line(ctx, [[-1600, fy - 112], [0, fy - 112]], 3, P.dustDk, .8); C.line(ctx, [[1080, fy - 108], [2800, fy - 106]], 3, P.dustDk, .8);
    for (let px = -1530; px < 2800; px += 190) if (px < -10 || px > 1090) C.line(ctx, [[px, fy - 116], [px + 1, fy + 2]], 3.4, P.dustDk, .4);
  }
  // pencere içi (p2-b.js ile aynı çizim: loş oda + alçak asılı takvim; burada vurgu yok)
  function officeWindow(ctx) {
    const { wx, wy, ww, wh } = YD;
    ctx.save(); ctx.beginPath(); ctx.rect(wx + 2, wy + 2, ww - 4, wh - 4); ctx.clip();
    ctx.fillStyle = '#3b4744'; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#2e3836'; ctx.fillRect(wx, wy + wh * .82, ww, wh);
    ctx.save(); ctx.translate(wx + ww * .12, wy + wh * .14); ctx.rotate(-.04); C.seed(611);
    C.shape(ctx, [[0, 0], [ww * .26, 0], [ww * .26, wh * .2], [0, wh * .2]], '#c9bfa6', { lw: 2 }); ctx.restore();
    const cx = wx + ww * .74, cw = ww * .26, ct = wy + wh * .56, chh = wh * .4;
    C.seed(612); C.line(ctx, [[cx, wy + wh * .12], [cx, ct]], 1.4, 'rgba(21,18,13,.8)', .1);
    C.shape(ctx, C.ell(cx, wy + wh * .12, 3, 3, 8), P.steel, { lw: 1.2 });
    ctx.save(); ctx.translate(cx, ct); ctx.rotate(.03);
    C.shape(ctx, [[-cw / 2, 0], [cw / 2, 0], [cw / 2, chh], [-cw / 2, chh]], '#d9cfb8', { lw: 2, shade: c => { c.fillStyle = '#8f4a2c'; c.fillRect(-cw / 2 - 2, -2, cw + 4, chh * .3); } });
    ctx.strokeStyle = 'rgba(21,18,13,.3)'; ctx.lineWidth = 1; for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) ctx.strokeRect(-cw * .42 + q * cw * .168, chh * .4 + r * chh * .14, cw * .168, chh * .14);
    ctx.restore();
    ctx.fillStyle = 'rgba(43,69,82,.32)'; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(wx + ww * .18, wy); ctx.lineTo(wx + ww * .34, wy); ctx.lineTo(wx + ww * .14, wy + wh); ctx.lineTo(wx - ww * .02, wy + wh); ctx.fill();
    ctx.restore();
    C.seed(613); C.line(ctx, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], 2.5); C.line(ctx, [[wx, wy + wh / 2], [wx + ww, wy + wh / 2]], 2.5);
    C.shape(ctx, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], null, { lw: 3.6 });
  }
  function doorDetail(ctx) {
    const { dx, dw, dh, by } = YD;
    ctx.save(); ctx.font = '700 15px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink;
    ctx.fillText('OFFICE', dx + dw * .5, by - dh * .73); ctx.restore();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(dx + dw * .8, by - dh * .48 + 16, 2.6, 0, TAU); ctx.fill(); ctx.fillRect(dx + dw * .8 - 1.2, by - dh * .48 + 16, 2.4, 6);
  }
  function grass(ctx, t, box) {
    const b = box || [-100, 1290, 1300, 900];
    for (let i = 0; i < 26; i++) {
      const r = j => rnd(2700 + i * 9 + j), x = b[0] + r(1) * b[2], y = b[1] + r(2) * b[3], ph = r(3) * 6;
      if (x > YD.bx - 10 && x < YD.bx + YD.bw + 10 && y < YD.by + 20) continue;
      for (let q = 0; q < 5; q++) {
        const sw = Math.sin(t * 2.4 + ph + q * .5) * 6 + Math.sin(t * 4.7 + ph) * 2, hh = 18 + r(4 + q) * 18;
        ctx.strokeStyle = P.weed; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + q * 4, y);
        ctx.quadraticCurveTo(x + q * 4 + (q - 2) * 3, y - hh * .6, x + q * 4 + (q - 2) * 4 + sw, y - hh); ctx.stroke();
      }
    }
  }
  function daisyMood(t) { const k = times(); return t >= k.sell && t < k.nineteen ? 'alert' : 'sleepy'; }
  const hookSw = t => .035 * Math.sin(t * 1.25) + .012 * Math.sin(t * 2.9 + 1);
  function drawDaisyW(ctx, t, o) {
    o = o || {};
    C.drawDaisy(ctx, { x: DAISY.x, y: DAISY.y, s: DAISY.s, seed: 23, beep: 0, mood: o.mood || daisyMood(t), hook: hookSw(t) });
  }

  /* ---------- karakterler (dünya koordinatı) ---------- */
  const HELMET = [[-110, -300], [-112, -332], [-96, -360], [-62, -366], [-36, -350], [-30, -310], [-24, -298], [-118, -294]];
  // Defne: item 'coffee' (kendi kahvesi önde) + koltuk altında rulo ve baret (arkada) + arka elde Kaan'ın kahvesi (o.cup)
  function defne(ctx, d) {
    const sc = .9 * d.s, lw = 5.2 / Math.sqrt(sc);
    ctx.save(); ctx.translate(d.x, d.y + (d.bob || 0)); ctx.rotate(d.rot || 0); ctx.translate(-d.x, -d.y);
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(sc, sc); C.seed(511);
    if (d.roll !== false) { ctx.save(); ctx.translate(-78, -330); ctx.rotate(-.42); C.shape(ctx, [[-14, -120], [14, -120], [14, 110], [-14, 110]], P.page, { lw, shade: c => { c.strokeStyle = 'rgba(70,90,110,.35)'; c.lineWidth = 2; for (let i = -100; i < 110; i += 26) { c.beginPath(); c.moveTo(-14, i); c.lineTo(14, i + 10); c.stroke(); } } }); C.shape(ctx, C.ell(0, -120, 14, 6, 12), P.pageDk, { lw: lw * .7 }); ctx.restore(); }
    if (d.helmet !== false) { C.shape(ctx, HELMET, P.helmet, { lw, shade: c => C.blot(c, [[-70, -370], [-20, -370], [-20, -290], [-60, -296]], P.helmetDk, .7) }); C.line(ctx, [[-96, -362], [-80, -300]], lw * .5, P.helmetDk, .2); }
    ctx.restore();
    C.drawDefne(ctx, { x: d.x, y: d.y, s: d.s, seed: 31, expr: d.expr || 'calm', look: d.look || 0, blink: d.blink || 0, item: 'coffee' });
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(sc, sc);
    if (d.cup) { C.coffeeCup(ctx, -68, -268, lw, 1.3); C.seed(512); C.shape(ctx, C.ell(-66, -248, 12, 13, 14), P.dSkin, { lw }); }
    else { C.seed(513); C.shape(ctx, [[-80, -268], [-56, -268], [-55, -258], [-81, -258]], P.steelDk, { lw: lw * .6 }); C.shape(ctx, C.ell(-68, -263, 7, 6, 10), P.paper, { lw: lw * .5 }); } // saat
    ctx.restore();
    ctx.restore();
    if (d.steam) { const sc2 = sc; steam(ctx, d.x + 40 * sc2, d.y - 345 * sc2, sc2 * 1.2, d.t, 31, .45); if (d.cup) steam(ctx, d.x - 68 * sc2, d.y - 305 * sc2, sc2, d.t, 47, .4); }
  }
  // Kaan: sol (arka) elde H K taşı, sağ (ön) elde kahve (o.cup), göğüs cebinde katlı liste
  function kaan(ctx, o) {
    const s = o.s, lw = 5.2 / Math.sqrt(s);
    ctx.save(); ctx.translate(o.x, o.y + (o.bob || 0)); ctx.rotate(o.rot || 0); ctx.translate(-o.x, -o.y);
    if (o.stone !== false) C.drawStamp(ctx, { x: o.x - 92 * s, y: o.y - 206 * s, s: .25 * s, rot: -.12 });
    C.drawKaan(ctx, { x: o.x, y: o.y, s, seed: 11, expr: o.expr || 'calm', look: o.look || 0, blink: o.blink || 0, phone: false });
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s); C.seed(521);
    ctx.save(); ctx.translate(-42, -306); ctx.rotate(-.12); C.shape(ctx, [[-12, -16], [14, -18], [15, 8], [-12, 9]], P.page, { lw: lw * .55 }); C.line(ctx, [[-8, -8], [9, -9]], lw * .3, 'rgba(21,18,13,.5)', .2); ctx.restore();
    C.line(ctx, [[-58, -300], [-22, -302]], lw * .55);
    if (o.cup) { C.coffeeCup(ctx, 88, -262, lw, 1.25); C.seed(522); C.shape(ctx, C.ell(86, -244, 14, 15, 14), P.skin, { lw }); }
    ctx.restore();
    ctx.restore();
    if (o.cup && o.steam) steam(ctx, o.x + 88 * s, o.y - 300 * s, s * 1.1, o.t, 53, .4);
  }

  /* ---------- karakter durumları (zamandan; bütün planlar aynı durumu farklı kamerayla çizer) ---------- */
  function defneState(t) {
    const k = times(), tw = twos(t);
    let x = DEFNE.x, y = DEFNE.y, s = DEFNE.s, bob = 0, rot = 0;
    const wu = seg(t, k.c4 - .1, k.c6 + .35);
    if (t < k.c6 + .35) { x = lerp(1330, DEFNE.x, E.outQ(wu)); const w = walk(t, k.c4 - .1, .44); const fade = 1 - E.inQ(seg(t, k.c6 - .05, k.c6 + .35)); bob = w.bob * fade; rot = w.rot * fade; }
    if (t >= k.c14) { const u = seg(t, k.c14 - .2, k.end + 1.2); x = lerp(DEFNE.x, 800, u); y = lerp(DEFNE.y, 1470, u); s = .9 - (DEFNE.y - y) * .001; const w = walk(t, k.c14 - .2, .46); bob = w.bob * s; rot = w.rot; }
    let expr = 'calm', look = 0, blink = 0;
    if (t < k.c6) look = -.6;
    else if (t < k.bad) { expr = 'smile'; look = -.9; }
    else if (t < k.c7) { expr = 'serious'; look = -.9; }
    else if (t < k.c9) { expr = 'serious'; look = t < k.crane ? -.9 : t < k.land ? .9 : t < k.list ? .3 : -.9; }
    else if (t < k.c10) { expr = t < k.nineteen ? 'serious' : 'worried'; look = t < k.nineteen - .25 ? .9 : -.8; }
    else if (t < k.c12) { expr = t < k.stampW ? 'calm' : 'serious'; look = 0; }
    else if (t < k.c13) { expr = tw < k.quiet + .1 ? 'serious' : tw < k.quiet + .4 ? 'surprised' : 'pale'; look = tw < k.quiet + .4 ? 0 : -.35; }
    else if (t < k.c14) { expr = tw < k.changed ? 'pale' : 'smile'; look = tw < k.then + .1 ? -.9 : tw < k.changed ? -1 : .7; }
    else { expr = 'serious'; look = .6; }
    const bl = [k.c6 + .9, k.c8 + .7, k.quiet + 1.05, k.c13 + .35, k.c4 + 1.2];
    if (bl.some(b => tw >= b && tw < b + 3 / FPS)) blink = 1;
    // konuşma vuruşları (7–9)
    const S = i => TB.sentence(i);
    if (t >= k.c7 && t < k.c10) rot += nod(t, [S(7).t0, k.sell + .5, k.crane, k.land, k.list, S(9).t0, k.nineteen], .016) * (t < k.c9 ? 1 : .8);
    if (t >= k.c13 && t < k.c14) rot += -.02 * E.io(seg(tw, k.then, k.then + .3)) + .03 * E.io(seg(tw, k.changed, k.changed + .3));
    return { x, y, s, bob, rot, expr, look, blink, cup: t < k.give, t, steam: true };
  }
  function kaanState(t) {
    const k = times(), tw = twos(t);
    let x = KAAN.x, y = KAAN.y, s = KAAN.s, bob = 0, rot = 0;
    if (t >= k.c14) { const u = seg(t, k.c14 - .35, k.end + .55); x = lerp(KAAN.x, 660, u); y = lerp(KAAN.y, 1520, u); s = .9 - (KAAN.y - y) * .001; const w = walk(t, k.c14 - .35, .4); bob = w.bob * s; rot = w.rot; }
    let expr = 'calm', look = 0, blink = 0;
    if (t < k.c6) { expr = 'calm'; look = .7; }
    else if (t < k.bad) { expr = tw >= k.give - .1 ? 'smile' : 'calm'; look = .9; }
    else if (t < k.c7) { expr = 'worried'; look = .9; }
    else if (t < k.c8) { expr = 'surprised'; look = .9; }
    else if (t < k.c9) { expr = t < k.list ? 'worried' : 'determined'; look = t < k.list ? .9 : -.4; }
    else if (t < k.c10) { expr = t < k.nineteen ? 'determined' : 'sheepish'; look = .9; }
    else if (t < k.c14) { expr = t < k.changed ? 'serious' : 'surprised'; look = .9; }
    else { expr = 'determined'; look = .4; }
    const bl = [k.c6 + .35, k.c8 + 1.3, k.c13 + .7];
    if (bl.some(b => tw >= b && tw < b + 3 / FPS)) blink = 1;
    // kahveyi alınca omuz hafif kalkar
    if (t >= k.give && t < k.give + .5) bob -= 4 * Math.sin(seg(tw, k.give, k.give + .5) * Math.PI);
    return { x, y, s, bob, rot, expr, look, blink, cup: t >= k.give, t, steam: true };
  }
  // el değiştiren fincan: Defne'nin arka elinden Kaan'ın ön eline (dünya, 6 kare)
  function cupFlight(ctx, t) {
    const k = times(), u = seg(twos(t), k.give - .2, k.give); if (u <= 0 || u >= 1) return;
    const d = defneState(t), kk = kaanState(t), sd = .9 * d.s;
    const a = [d.x - 68 * sd, d.y - 268 * sd], b = [kk.x + 88 * kk.s, kk.y - 262 * kk.s], e = E.io(u);
    ctx.save(); ctx.translate(lerp(a[0], b[0], e), lerp(a[1], b[1], e) - Math.sin(e * Math.PI) * 18); ctx.rotate(Math.sin(e * Math.PI) * .12);
    C.seed(530); C.coffeeCup(ctx, 0, 0, 5, 1.3 * lerp(sd, kk.s, e)); ctx.restore();
  }

  function world(ctx, t, o) {
    o = o || {};
    ext(ctx);
    C.drawYard(ctx, { seed: 7, mode: 'day', letter: true });
    officeWindow(ctx); doorDetail(ctx);
    if (o.daisy !== false) drawDaisyW(ctx, t, o);
    const items = [];
    if (o.kaan) items.push([o.kaan.y, () => kaan(ctx, o.kaan)]);
    if (o.defne) items.push([o.defne.y, () => defne(ctx, o.defne)]);
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    if (o.kaan && o.defne) cupFlight(ctx, t);
    if (!o.noGrass) grass(ctx, t);
  }
  function blurredWorld(key, z, cx, cy, blur, o, sx, sy) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      cam(g, z, cx, cy, sx, sy); world(g, 0, Object.assign({ noGrass: true }, o || {}));
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
  }
  function drawBg(ctx, cv, z, ox, oy) { ctx.save(); ctx.translate(540 + (ox || 0), 960 + (oy || 0)); ctx.scale(z, z); ctx.drawImage(cv, -540, -960); ctx.restore(); }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 1–2: "My sister calls me Ant." Defne'nin parmağı tutamı yaylar; sonra tutam yavaşça iner --- */
  const TUFT = [[-12, -526], [-6, -552], [8, -572], [30, -580], [46, -570], [44, -556], [36, -548], [38, -562], [26, -562], [14, -550], [12, -530]];
  function tuftAngle(t) {
    const k = times(), tw = twos(t);
    if (tw < k.flick) return -.95 + .1 * seg(tw, 0, k.flick);
    const d = tw - k.flick;
    const spring = -.85 * Math.exp(-3.4 * d) * Math.cos(10.5 * d);
    return spring + .42 * E.io(seg(t, k.droop0, k.droop1));
  }
  function drawKaanTuft(ctx, x, y, s, ang, o) {
    // tutamsız Kaan (yalnız tutam bölgesi kırpılır) + kendi tutamımız kökünden döner
    ctx.save(); ctx.beginPath(); ctx.rect(-2000, y - 538 * s, 5000, 4000); ctx.clip();
    C.drawKaan(ctx, Object.assign({ x, y, s, seed: 11, phone: false }, o));
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(0, -531); ctx.rotate(ang); ctx.translate(0, 531);
    C.seed(541); C.shape(ctx, TUFT, P.hair, { lw: 5.2 / Math.sqrt(s) }); ctx.restore();
  }
  function defneFinger(ctx, fx, fy, rot) { // Defne'nin eli: işaret parmağı ucu (fx,fy), kol sağ dışarıdan
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(rot); C.seed(551);
    limbPlain(ctx, [170, 40], [700, 210], 54, 70, P.shirt);
    C.shape(ctx, [[150, -16], [196, -8], [186, 104], [136, 92]], P.shirtDk, { lw: 6 });              // kıvrık kol ucu
    C.shape(ctx, [[22, -14], [96, -38], [150, -20], [160, 50], [120, 84], [56, 70], [30, 34]], P.dSkin, { lw: 6, shade: c => C.blot(c, [[40, 40], [170, 40], [170, 100], [40, 100]], P.dSkinDk, .55) });
    for (let i = 0; i < 3; i++) C.shape(ctx, C.ell(52 + i * 26, 70 + i * 4, 20, 14, 12), i % 2 ? P.dSkinDk : P.dSkin, { lw: 5 });
    C.shape(ctx, [[-6, -12], [40, -22], [70, -24], [72, 4], [40, 8], [-4, 10], [-14, 0]], P.dSkin, { lw: 6 });   // işaret parmağı
    C.shape(ctx, [[-6, -8], [8, -10], [10, 4], [-6, 6]], '#ecc8a8', { lw: 3, amp: .3 });
    ctx.restore();
  }
  function limbPlain(ctx, A, B, wa, wb, fill) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 6, shade: c => C.blot(c, [[A[0] - nx * wa * .2, A[1] - ny * wa * .2], [B[0] - nx * wb * .2, B[1] - ny * wb * .2], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], P.shirtDk, .6) });
  }
  // "Previously" köşe görüntüsü: Daisy'nin yanan uyarı ışığı (P1 son karesi), etiketin sağında, x ≤ 882
  function prevInset(ctx, t) {
    const a = 1 - seg(t, 2.2, 2.42); if (a <= 0) return;
    const x = 704, y = 232, w = 176, h = 140;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(.035); ctx.translate(-w / 2, -h / 2);
    C.seed(561); C.shape(ctx, [[-8, -8], [w + 8, -8], [w + 8, h + 8], [-8, h + 8]], P.paper, { lw: 4 });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P.sky0); g.addColorStop(1, P.sky2); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h * .86); ctx.scale(.5, .5); ctx.translate(0, 300);
    C.drawDaisy(ctx, { x: 0, y: 0, s: 1, seed: 23, beep: 0, mood: 'sleepy', hook: .02 });
    drawBeacon(ctx, 1);
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  }
  function drawBeacon(ctx, v) { // pilot/B ile aynı uyarı ışığı (Daisy yerel, s=1)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(k => { const r = 40 + k * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - k * .2) * Math.min(1, v * 1.5), null, .5); }));
  }
  shot('p2a-01-ant', k => 0, k => k.c3, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const lift = E.io(seg(t, k.lift0, k.lift1)), push = E.io(seg(t, k.lift0, k.c3));
    const bg = blurredWorld('a-bg-ant', 1.7, 520, 1330, 9, {}, 540, 900);
    drawBg(ctx, bg, 1.16 + .05 * push, 0, -70 * lift);
    ctx.save();
    ctx.translate(540, 960); ctx.scale(1 + .07 * push, 1 + .07 * push); ctx.translate(-540, -960 - 480 * lift);
    const kx = 520, ky = 2770, s = 3.0, ang = tuftAngle(t);
    const expr = tw < .55 ? 'sheepish' : tw < k.droop0 ? 'smile' : 'tired';
    const blink = (tw >= .2 && tw < .3) || (tw >= 3.05 && tw < 3.15) ? 1 : 0;
    drawKaanTuft(ctx, kx, ky, s, ang, { expr, look: tw < .55 ? .6 : tw < k.droop0 ? .2 : -.3, blink });
    // "boing" çizgileri (bırakış sonrası)
    const bd = tw - k.flick;
    if (bd >= 0 && bd < .45) { ctx.save(); ctx.globalAlpha = 1 - bd / .45; ctx.translate(kx, ky); ctx.scale(s, s); C.seed(545);
      [-1, 1].forEach(dd => C.line(ctx, C.ell(14, -566, 44 + bd * 40, 34 + bd * 30, 6, dd < 0 ? Math.PI * .85 : -Math.PI * .15, dd < 0 ? Math.PI * 1.15 : Math.PI * .15), 3.4)); ctx.restore(); }
    // Defne'nin parmağı: 0. karede tutamın ucuna bastırır, kayar, sağa çekilir
    const tipX = kx + s * (Math.cos(-.95) * 30 - Math.sin(-.95) * -49), tipY = ky + s * (-531 + Math.sin(-.95) * 30 + Math.cos(-.95) * -49);
    const out = E.inQ(seg(tw, k.flick + .05, .75)), slide = E.outC(seg(tw, 0, k.flick + .05));
    if (tw < .8) defneFinger(ctx, tipX + 6 - slide * 50 + out * 700, tipY - 6 - slide * 34 - out * 120, -.12 - slide * .2);
    ctx.restore();
    finish(ctx);
    prevInset(ctx, t);
  });

  /* --- 3: "Grandpa." dedenin el yazısıyla "Ant" (defter kenarı). P6 aynı yazıyı kullanır: handwrite('Ant', size 118, inkOld, seed 51) --- */
  const DIGS = {};
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
  void DIGS;
  function antDoodle(ctx, x, y, k) { // küçük karınca karalaması: üç boğum, altı bacak, kıvrık anten (Kaan'ın tutamı gibi)
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); C.seed(571); const col = P.inkOld;
    [[0, 0, 15, 11], [24, -3, 9, 8], [42, -8, 11, 10]].forEach(([a, b, rx, ry]) => C.shape(ctx, C.ell(a, b, rx, ry, 12), col, { lw: 2.6, ink: col, amp: .5 }));
    [[-4, 6, -18, 22], [2, 8, 2, 26], [20, 4, 14, 24], [24, 4, 34, 22], [-6, -4, -20, -18], [26, -8, 30, -24]].forEach(([a, b, c2, d]) => C.line(ctx, [[a, b], [(a + c2) / 2 + 3, (b + d) / 2], [c2, d]], 2.6, col, .3));
    C.line(ctx, [[48, -16], [56, -36], [70, -44], [78, -36], [72, -30]], 2.6, col, .3);
    C.line(ctx, [[46, -16], [48, -34], [58, -48]], 2.4, col, .3);
    ctx.restore();
  }
  shot('p2a-03-dede', k => k.c3, k => k.c4, (ctx, t, u) => {
    const z = lerp(1.12, 1.24, E.io(u));
    ctx.fillStyle = '#5e3b1d'; ctx.fillRect(0, 0, 1080, 1920);
    C.seed(581); for (let i = 0; i < 14; i++) C.line(ctx, [[-20, 100 + i * 140 + rnd(i) * 30], [1100, 120 + i * 140 + rnd(i + 30) * 30]], 3, '#3f2711', 2);
    ctx.save(); ctx.translate(420, 800); ctx.scale(z, z); ctx.translate(-420, -800);
    ctx.save(); ctx.translate(760, 980); ctx.rotate(-.05);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(-470, -700, 1000, 1500); ctx.restore();
    C.seed(582); C.shape(ctx, [[-500, -720], [560, -730], [560, 800], [-500, 790]], P.page, { lw: 5, shade: c => { C.blot(c, [[-520, 500], [580, 480], [580, 820], [-520, 820]], P.pageDk, .5); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(154,120,70,.18)'; c.beginPath(); c.arc(-480 + rnd(600 + i) * 1020, -700 + rnd(700 + i) * 1480, 2 + rnd(800 + i) * 6, 0, TAU); c.fill(); } } });
    ctx.strokeStyle = 'rgba(90,110,130,.22)'; ctx.lineWidth = 2; for (let yy = -620; yy < 780; yy += 78) { ctx.beginPath(); ctx.moveTo(-500, yy); ctx.lineTo(560, yy); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(160,80,60,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-170, -730); ctx.lineTo(-170, 800); ctx.stroke();
    [-542, -464, -386, -308, -152, -74, 4, 82, 160].forEach((yy, i) => scrawl(ctx, -140, yy - 8, 560 - (i % 3) * 90, 4.2, P.inkOld, 4400 + i * 37));
    C.handwrite(ctx, 'Ant', -470, -170, 118, P.inkOld, 51, { bold: true });
    C.seed(583); C.line(ctx, [[-470, -140], [-370, -146], [-262, -138]], 4.4, P.inkOld, 1.2);
    antDoodle(ctx, -440, -40, 1.1);
    ctx.restore();
    ctx.restore();
    airDust(ctx, t, 20, 59, [0, 200, 1080, 1100], .7);
    const g = ctx.createRadialGradient(400, 760, 200, 540, 900, 1200); g.addColorStop(0, 'rgba(255,210,122,.10)'); g.addColorStop(1, 'rgba(20,10,4,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    finish(ctx);
  });

  /* --- 4: geniş: Defne avluya yürür (beyaz baret, rulo, iki kahve) --- */
  shot('p2a-04-gelis', k => k.c4, k => k.c5, (ctx, t, u) => {
    const z = lerp(.9, .93, E.io(u)), d = defneState(t), kk = kaanState(t);
    ctx.save(); cam(ctx, z, 640, 1450, 540, 950);
    world(ctx, t, { kaan: kk, defne: d });
    airDust(ctx, t, 18, 61, [-100, 900, 1400, 700], .7);
    ctx.restore();
    finish(ctx);
  });

  /* --- 5: "A real one." yaka kartı + koltuk altındaki rulo (adımla sallanır) --- */
  shot('p2a-05-kart', k => k.c5, k => k.c6, (ctx, t, u) => {
    const tw = twos(t), w = walk(t, times().c4 - .1, .44), sw = Math.sin(w.ph * Math.PI) * .07, by = w.bob * 1.6;
    ctx.save(); ctx.translate(lerp(-20, 20, u), by);
    // yelek (lacivert) + gömlek şeridi
    C.seed(591);
    ctx.fillStyle = P.vest; ctx.fillRect(-100, -100, 1300, 2200);
    C.blot(ctx, [[760, -100], [1200, -100], [1200, 2100], [820, 2100]], P.vestDk, .6);
    C.shape(ctx, [[-100, -100], [180, -100], [230, 2100], [-100, 2100]], P.shirt, { lw: 6, shade: c => C.blot(c, [[120, -100], [240, -100], [240, 2100], [150, 2100]], P.shirtDk, .6) });
    C.line(ctx, [[640, 1200], [940, 1190]], 5, P.vestDk, 2); C.line(ctx, [[640, 1200], [650, 1330], [930, 1320], [940, 1190]], 4, P.vestDk, 2);
    // rulo çizim: kolun altından geçer (sağ üst)
    ctx.save(); ctx.translate(900, 300); ctx.rotate(-.9 + sw * .3); C.seed(592);
    C.shape(ctx, [[-60, -700], [60, -700], [60, 700], [-60, 700]], P.page, { lw: 6, shade: c => { c.strokeStyle = 'rgba(70,90,110,.35)'; c.lineWidth = 4; for (let i = -680; i < 700; i += 90) { c.beginPath(); c.moveTo(-60, i); c.lineTo(60, i + 40); c.stroke(); } C.blot(c, [[20, -720], [80, -720], [80, 720], [26, 720]], P.pageDk, .7); } });
    ctx.restore();
    // kart: üstte metal klips, sallanır
    ctx.save(); ctx.translate(520, 330); ctx.rotate(sw); C.seed(593);
    C.shape(ctx, [[-30, -40], [30, -40], [30, 30], [-30, 30]], P.steelLt, { lw: 5 });
    C.line(ctx, [[0, 30], [0, 80]], 6, P.steelDk);
    ctx.translate(0, 80);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(-190, 16, 400, 560); ctx.restore();
    C.shape(ctx, [[-200, 0], [200, 0], [200, 560], [-200, 560]], '#f6f1e4', { lw: 6, shade: c => { c.fillStyle = P.vestDk; c.fillRect(-210, -10, 420, 96); C.blot(c, [[120, -10], [210, -10], [210, 570], [140, 570]], '#e3dccb', .7); } });
    C.shape(ctx, C.ell(0, 36, 28, 12, 14), P.steelLt, { lw: 4 });
    // fotoğraf: Defne'nin siluet portresi (topuz + gözlük)
    C.shape(ctx, [[-160, 120], [-20, 120], [-20, 300], [-160, 300]], '#c9dbe0', { lw: 4 });
    ctx.save(); ctx.beginPath(); ctx.rect(-160, 120, 140, 180); ctx.clip();
    C.shape(ctx, C.ell(-90, 300, 60, 50, 14), P.vest, { lw: 3 });
    C.shape(ctx, C.ell(-90, 216, 34, 40, 16), P.dSkin, { lw: 3 }); C.shape(ctx, C.ell(-96, 164, 18, 16, 12), P.dHair, { lw: 3 });
    C.shape(ctx, [[-124, 208], [-124, 186], [-104, 176], [-74, 178], [-56, 192], [-56, 208], [-80, 194], [-110, 196]], P.dHair, { lw: 3 });
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2.4; [[-102, 216], [-78, 216]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 9, 0, TAU); ctx.stroke(); });
    ctx.restore();
    ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 62px "Lilita One"'; ctx.fillText('DEFNE', 2, 196);
    ctx.font = '700 22px Rubik'; ctx.fillStyle = '#5d6b66'; ctx.fillText('STRUCTURAL', 4, 236); ctx.fillText('DEPT.', 4, 264);
    ctx.font = '700 36px Rubik'; ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.fillText('CIVIL ENGINEER', 0, 380);
    ctx.font = '500 22px Rubik'; ctx.fillStyle = '#5d6b66'; ctx.fillText('LICENSED · No. 0419', 0, 418);
    for (let i = 0; i < 34; i++) { ctx.fillStyle = P.ink; ctx.fillRect(-150 + i * 9, 460, rnd(5000 + i) < .5 ? 3 : 5, 60); }
    ctx.fillStyle = '#f2f4f6'; ctx.font = '700 26px Rubik'; ctx.fillText('SITE ACCESS', 0, 52);
    ctx.restore();
    ctx.restore();
    void tw;
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 6: ikili: kahve el değiştirir; "bad news"te yüzler değişir --- */
  shot('p2a-06-kahve', k => k.c6, k => k.c7, (ctx, t, u) => {
    const z = lerp(1.18, 1.24, E.io(u));
    ctx.save(); cam(ctx, z, lerp(690, 670, E.io(u)), 1385, 540, 820);
    world(ctx, t, { kaan: kaanState(t), defne: defneState(t) });
    airDust(ctx, t, 16, 63, [100, 900, 1200, 700], .7);
    ctx.restore();
    finish(ctx);
  });

  /* --- 7: "Sell it, Ant." Defne yakın (Kaan solda omuz) --- */
  shot('p2a-07-sat', k => k.c7, k => k.c8, (ctx, t, u) => {
    const z = lerp(2.0, 2.08, E.io(u));
    ctx.save(); cam(ctx, z, 560, 1430, 560, 780);
    world(ctx, t, { kaan: kaanState(t), defne: defneState(t), noGrass: true });
    ctx.restore();
    finish(ctx);
  });

  /* --- 8: "The crane, the land, the list." Kaan'a dönük ikili; "list"te cebindeki listeye itme --- */
  shot('p2a-08-liste', k => k.c8, k => k.c9, (ctx, t, u) => {
    const k = times(), lu = E.io(seg(t, k.list - .1, k.c9));
    const z = lerp(1.5, 1.56, E.io(u)) + .28 * lu;
    ctx.save(); cam(ctx, z, lerp(470, 440, lu), lerp(1390, 1420, lu), 540, 780);
    world(ctx, t, { kaan: kaanState(t), defne: defneState(t) });
    ctx.restore();
    finish(ctx);
  });

  /* --- 9: "You are nineteen." Defne solda, Daisy sağda; "nineteen"de siperlik iner --- */
  shot('p2a-09-ondokuz', k => k.c9, k => k.c10, (ctx, t, u) => {
    const k = times(), z = lerp(1.38, 1.46, E.io(u));
    // siperlik inince kamera 2 kare duraklar gibi küçük bir geri itme
    const nb = seg(t, k.nineteen, k.nineteen + .25);
    ctx.save(); cam(ctx, z - .02 * Math.sin(nb * Math.PI), 860, 1310, 540, 760);
    world(ctx, t, { kaan: kaanState(t), defne: defneState(t) });
    ctx.restore();
    finish(ctx);
  });

  /* --- 10: Kaan'ın gözünden: H K taşını Defne'ye uzatır (taşın sırtı bize dönük) --- */
  function stoneBack(ctx, x, y, s, rot) {
    const W = 330, H = 190; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); C.seed(700);
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2 + 4], [W / 2 + 4, H / 2], [-W / 2 - 2, H / 2 - 2]], '#bfae88', { lw: 5, shade: c => { C.blot(c, [[-W / 2, H * .1], [W / 2 + 10, H * .06], [W / 2 + 10, H], [-W / 2, H]], '#a08f6c', .7); for (let i = 0; i < 40; i++) { c.fillStyle = i % 3 ? 'rgba(216,202,176,.6)' : 'rgba(110,100,87,.4)'; c.beginPath(); c.arc((rnd(8800 + i) - .5) * W, (rnd(8900 + i) - .5) * H, 2 + rnd(8950 + i) * 7, 0, TAU); c.fill(); } } });
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2 + 4], [W / 2 - 10, -H / 2 - 22], [-W / 2 + 12, -H / 2 - 24]], '#d3c39e', { lw: 4 });
    ctx.restore();
  }
  shot('p2a-10-uzat', k => k.c10, k => k.c11, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredWorld('a-bg-pov', 1.3, 760, 1330, 8, {}, 540, 900);
    drawBg(ctx, bg, 1.05 + .03 * u);
    const d = defneState(t);
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + .04 * E.io(u), 1 + .04 * E.io(u)); ctx.translate(-540, -960);
    defne(ctx, { x: 540, y: 1900, s: 2.5, expr: d.expr, look: tw < k.c10 + .5 ? -.3 : 0, blink: d.blink, cup: false, t, steam: true, rot: nod(t, [k.stampW], .012) });
    ctx.restore();
    // taş aşağıdan kalkar (outBack), iki el altında
    const up = E.outBack(seg(tw, k.c10 + .1, k.c10 + .6)), sy = lerp(2050, 1250, up), jit = (rnd(Math.floor(tw * 15)) - .5) * 3;
    stoneBack(ctx, 560 + jit, sy, 1.2, .04);
    grip(ctx, 790 + jit, sy + 120, -.5, { s: .62 });
    grip(ctx, 330 + jit, sy + 120, -.5, { s: .62, flip: true });
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 11: H K (P1 damga planı: taş ekranın üst yarısında, aynı açı); "K." sonunda "tok" --- */
  shot('p2a-11-hk', k => k.c11, k => k.c12, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = cached('a-bg-hk', 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      cam(g, 1.25, 430, 1300, 540, 900); world(g, 0, { noGrass: true });
      g.setTransform(1, 0, 0, 1, 0, 0); C.drawKaan(g, { x: 540, y: 2420, s: 3.0, seed: 11, expr: 'determined', phone: false });
      c.filter = 'blur(10px)'; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
    drawBg(ctx, bg, 1.06 + .02 * u);
    ctx.fillStyle = 'rgba(21,18,13,.12)'; ctx.fillRect(0, 0, 1080, 1920);
    const z = lerp(1.9, 2.05, E.io(u)), jx = (rnd(Math.floor(tw * 15) + 300) - .5) * 2, jy = (rnd(Math.floor(tw * 15) + 600) - .5) * 2;
    C.drawStamp(ctx, { x: 540 + jx, y: 480 + jy, s: z, rot: -.05 });
    grip(ctx, 540 - 168 * z + jx, 480 + 70 * z + jy, -.15, { s: .55 * z / 2, flip: true });
    grip(ctx, 540 + 168 * z + jx, 480 + 76 * z + jy, .15, { s: .55 * z / 2 });
    const st = t - k.stamp; if (st >= 0 && st < 2 / FPS) { ctx.fillStyle = 'rgba(255,243,196,.12)'; ctx.fillRect(0, 0, 1080, 1920); }
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 12: "She went quiet." Defne'nin yüzü, 18 kare tepki; yalnız buhar ve yavaş itme --- */
  shot('p2a-12-sessiz', k => k.c12, k => k.c13, (ctx, t, u) => {
    const bg = blurredWorld('a-bg-pov', 1.3, 760, 1330, 8, {}, 540, 900);
    drawBg(ctx, bg, 1.1 + .03 * u);
    const d = defneState(t), z = lerp(1, 1.05, E.io(u));
    ctx.save(); ctx.translate(540, 760); ctx.scale(z, z); ctx.translate(-540, -760);
    defne(ctx, { x: 540, y: 1880, s: 2.7, expr: d.expr, look: d.look, blink: d.blink, cup: false, t, steam: true });
    ctx.restore();
    vignette(ctx, .4);
    finish(ctx);
  });

  /* --- 13: "Then she changed the subject." saate bakar, kahvesine döner --- */
  shot('p2a-13-konu', k => k.c13, k => k.c14, (ctx, t, u) => {
    const z = lerp(1.42, 1.36, E.io(u));
    ctx.save(); cam(ctx, z, lerp(520, 545, E.io(u)), 1400, 540, 800);
    world(ctx, t, { kaan: kaanState(t), defne: defneState(t) });
    ctx.restore();
    finish(ctx);
  });

  /* --- 14: "We tried Grandpa's office." geniş: ofis kapısına doğru yürürler; Daisy park yerinde --- */
  shot('p2a-14-ofis', k => k.c14, k => k.end, (ctx, t, u) => {
    const z = lerp(.86, .9, E.io(u));
    ctx.save(); cam(ctx, z, lerp(620, 600, E.io(u)), 1390, 540, 930);
    world(ctx, t, { kaan: kaanState(t), defne: defneState(t) });
    airDust(ctx, t, 18, 67, [-100, 900, 1400, 700], .7);
    ctx.restore();
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const r3 = x => +x.toFixed(3);
  TB.cuesA = {
    get tutamFiske() { return r3(times().flick); },                       // parmak tutamı bırakır: kısa "boing" (yumuşak, tonlu)
    get defterSessiz() { return r3(times().c3); },                         // dede yazısı: sessizlik (müzik inceltilebilir)
    get defneAdim() { const k = times(), o = []; for (let x = k.c4 - .1; x < k.c6 + .3; x += .44) o.push(r3(x)); return o; },  // adımlar (avlu toprağı)
    get kartSallanma() { return r3(times().c5); },                         // yaka kartı klipsi, hafif metal tıkırtı
    get kahveVer() { return r3(times().give); },                           // karton bardak el değiştirir
    get daisySiperlikKalkar() { return r3(times().sell); },                // "Sell it"te Daisy'nin siperliği kalkar (sessiz ya da çok hafif metal)
    get daisySiperlikIner() { return r3(times().nineteen); },              // "nineteen": siperlik iner, yumuşak hidrolik iç çekiş
    get tasKalkar() { return r3(times().c10 + .1); },                      // taş kaldırılır (taş sürtme, hafif)
    get damga() { return r3(times().stamp); },                              // damga-kesif.wav "tok" (P1 ile aynı)
    get sessizlik() { return r3(times().c12); },                            // Defne susar: müzik solar
    get adimlarOfis() { const k = times(), o = []; for (let x = k.c14 - .35; x < k.end; x += .4) o.push(r3(x)); return o; }     // ofise yürüyüş
  };
})();
