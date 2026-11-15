/* Part 3 · MR. HALE — Animatör B: cümle 13–25 ve bitiş görüntüsü. Kesme (S[12].t1 + S[13].t0) / 2 ≈ 26,08 sn → tl.duration.
   YERLEŞİM (dünya koordinatları; öbür yarı aynı mekânı kullanırsa bunlara uysun):
   • İş 2 sahası (su kulesi): kule tabanı ortası (0,0), yer çizgisi y=0; kule boyu 1000, ayaklar x ±280 (drawWaterTower, alan 2000×2000'den kesilmiş).
     Çit (drawWaterTower şeridi) y≈386, kulenin önünde boydan boya. Daisy (s=1, bom ucu sola) (585,200), çitin içinde, kulenin SAĞINDA.
     Planlanan alan TB.zone merkezi (-900,30), w 700: kule SOLA, alana düşer (1. bölümde baca alanın tersine düşmüştü).
     Ekip (baretli) çitin dışında x 1150–1550, y 560; Hale (1950,520), beyaz araba (2550,470) sağa bakar, sağa gider.
   • Damga: kulenin beton kaidesinin ön yüzü (yakın planda P1 ile aynı: STONE (560,760), rot −0,05, ekranda (540,480) civarı).
   • Avlu (akşam, drawYard 1080×1920 alanı): posta kutusu (670,1288–1336), kapı x 778; Daisy avluda YD noktasında.
   • Masa (akşam): pencere üstte (Daisy'nin uyarı ışığı pencereden görünür, y≈380), mektup masada. */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;

  /* ================= ZAMANLAR ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1], c = tl.cues;
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const k = {};
    k.start = (S(12).t1 + S(13).t0) / 2;                 // A ile ortak kesme
    k.tag = W(13, /^job/i, 0).t0;                         // JOB 2 etiketi düşer
    k.crew = S(14).t0 - .1;                               // ekip, çit
    k.pull = W(14, /^crew/i, 4).t0 + .15;                 // top geri çekilir
    k.site = W(14, /^everyone/i, 7).t0 - .35;             // boş alan, şeritli bölge
    k.clean = c.clean;                                     // "clean." sonu: kule oturdu
    k.land = c.clean - .08;                                // kule yere değer (sarsıntı 6 kare)
    k.fall0 = k.land - 1.1;                                // düşüş başı
    k.impact = k.fall0 - 8 / FPS;                          // top değer, 8 kare tutma
    k.release = k.impact - .5;                             // top bırakılır
    k.pushD = k.land + .2;                                 // Daisy'nin sönük ışığına itme
    k.plinth = S(16).t0 - .12;                             // kaide yakın
    k.wipe0 = W(16, /^stamp/i, 1).t0 - .05;               // el siler
    k.tight = S(17).t0 - .15;                              // damga, P1 açısı
    k.stamp = c.stamp;                                     // "tok"
    k.hale = S(18).t0 - .28;
    k.saw = W(18, /^saw/i, 2).t0;
    k.haleCU = S(19).t0 - .2;
    k.stop = W(19, /^stopped/i, 1).t0;                     // cümle yarıda: donar
    k.car = S(20).t0 - .17;
    k.drive = W(20, /^drove/i, 2).t0 - .05;
    k.yard = S(20).t1 + .55;                               // akşam avlu
    k.letter = c.letter;                                   // zarf posta kutusunda
    k.env = W(21, /^letter/i, 4).t0 - .05;                  // zarf masada, mektup çıkar
    k.sign = S(22).t0 - .12;                               // imza
    k.oneLine = S(23).t0 - .1;
    k.ant = S(24).t0 - .2;                                 // satır yazılır
    k.antW = S(24).words;
    k.desk = S(25).t0 - .3;                                // masa + pencere + gölge
    k.end = c.voiceEnd; k.endBeep = c.endBeep; k.endCard = c.endCard; k.dur = tl.duration;
    k.freeze0 = k.endBeep - .3; k.freeze1 = k.endBeep + .24 + 10 / FPS;
    K = k; return k;
  }
  const TONE1 = [.04, .24];
  const beepV = (t, t0) => { const d = t - t0; return d >= TONE1[0] - 1e-6 && d < TONE1[1] - 1e-6 ? 1 : 0; };

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
  function airDust(ctx, t, n, sb, box, a) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(216,202,176,${a * (.3 + r(5) * .5)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 4, 0, TAU); ctx.fill();
    }
  }
  // kart etiketi (A'nın JOB 1 etiketiyle aynı çizim)
  function tag(ctx, x, y, sw, label, sd, o) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw); ctx.scale(o.s || 1, o.s || 1);
    C.seed(sd); C.line(ctx, [[0, -(o.str || 70)], [0, 0]], 2.4, P.ink, .5);
    const w = o.w, h = o.h; C.seed(sd + 1);
    C.shape(ctx, [[-w / 2 + 14, 0], [w / 2 - 14, 0], [w / 2, 16], [w / 2, h], [-w / 2, h], [-w / 2, 16]], '#dcbb7f', { lw: 4, shade: c => C.blot(c, [[w * .1, -4], [w / 2 + 6, -4], [w / 2 + 6, h + 6], [w * .2, h + 6]], '#b8955a', .55) });
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 14, 6, 0, TAU); ctx.fill();
    ctx.font = `400 ${o.font}px "Lilita One"`; ctx.textAlign = 'center'; ctx.fillText(label, 0, h * .66 + o.font * .32);
    ctx.restore();
  }
  const swing = (t, t0, a0, f) => t < t0 ? a0 : a0 * Math.exp(-(t - t0) * 3.2) * Math.cos((t - t0) * (f || 7));
  function limb(ctx, A, B, wa, wb, fill, sd) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    return C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 7, shade: c => C.blot(c, [[A[0] - nx * wa * .1, A[1] - ny * wa * .1], [B[0] - nx * wb * .1, B[1] - ny * wb * .1], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], P.jacketDk, .55) });
  }
  // Kaan'ın eli üstten (P1 b-sahneler ile aynı): parmaklar sol yukarı, kol sağ alttan
  function drawFlatHand(ctx, x, y, rot, curl) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); C.seed(231);
    limb(ctx, [430, 250], [980, 120], 96, 120, P.jacket, 233);
    limb(ctx, [90, 0], [430, 250], 62, 86, P.jacket, 232);
    C.shape(ctx, C.ell(430, 250, 84, 82, 20), P.jacket, { lw: 0 }); C.line(ctx, [[380, 300], [440, 320], [490, 280]], 5, P.jacketDk);
    C.shape(ctx, [[70, -40], [140, -20], [100, 70], [40, 40]], P.hazard, { lw: 6 });
    const fl = 1 - (curl || 0) * .35;
    C.shape(ctx, [[60, 50], [-20, 70], [-120 * fl, 40], [-140 * fl, 10], [-130 * fl, -20], [-140 * fl, -48], [-118 * fl, -70], [-30, -72], [20, -110], [50, -100], [40, -60], [90, -40]], P.skin, { lw: 6, shade: c => C.blot(c, [[-140, 20], [80, 30], [80, 90], [-140, 90]], P.skinDk, .55) });
    for (let i = 0; i < 3; i++) C.line(ctx, [[-30, -40 + i * 28], [-120 * fl, -46 + i * 30]], 3.6, P.skinDk);
    ctx.restore();
  }

  // Daisy'nin yeni takılan eski lastiği (p3-a.js daisyTire ile aynı çizim, etiketsiz): yan ön teker
  function daisyTire(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.transform(.55, -.22, 0, 1, 120, 0);
    const lw = 5.6 / Math.sqrt(s) * 1.25, u = 100; C.seed(6101);
    C.shape(ctx, C.ell(u, -50, 51, 51, 28), '#45474c', { lw, shade: c => { C.blot(c, C.ell(u + 14, -40, 40, 44, 16), '#2c2e33', .6); C.blot(c, [[u - 40, -96], [u - 10, -100], [u - 16, -82], [u - 40, -80]], '#6c6f75', .7); } });
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .3; C.line(ctx, [[u + Math.cos(a) * 42, -50 + Math.sin(a) * 42], [u + Math.cos(a) * 49, -50 + Math.sin(a) * 49]], lw * .35, '#6c6f75', .1); }
    C.shape(ctx, C.ell(u, -50, 25, 25, 20), P.steel, { lw: lw * .7, shade: c => C.blot(c, C.ell(u + 8, -42, 22, 22, 16), P.steelDk, .6) });
    C.shape(ctx, C.ell(u, -50, 10, 10, 12), P.steelLt, { lw: lw * .6 });
    ctx.restore();
  }

  /* ================= SU KULESİ: sprite (drawWaterTower'dan, bir kez) ================= */
  const TW = { area: 2000, cx: 1000, base: 1320, x0: 640, y0: 296, w: 720, h: 1032 };   // sprite içinde taban ortası (360,1024)
  function towerSprite() {
    return cached('kule', TW.w, TW.h, c => {
      const a = canvas(TW.area, TW.area), b = canvas(TW.area, TW.area);
      C.drawWaterTower(a.getContext('2d'), { x: 0, y: 0, w: TW.area, h: TW.area, mode: 'day', towerX: .5 });
      C.drawWaterTower(b.getContext('2d'), { x: 0, y: 0, w: TW.area, h: TW.area, mode: 'day', towerX: -3 });
      const A = a.getContext('2d').getImageData(TW.x0, TW.y0, TW.w, TW.h), B = b.getContext('2d').getImageData(TW.x0, TW.y0, TW.w, TW.h);
      const O = c.createImageData(TW.w, TW.h);
      for (let i = 0; i < A.data.length; i += 4) {
        const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
        if (d > 10) { O.data[i] = A.data[i]; O.data[i + 1] = A.data[i + 1]; O.data[i + 2] = A.data[i + 2]; O.data[i + 3] = 255; }
      }
      c.putImageData(O, 0, 0);
    });
  }
  const SPR_BX = TW.cx - TW.x0, SPR_BY = TW.base - TW.y0;   // 360, 1024
  const LEG = 280, PIV = [-LEG, 0];
  const DZ = { x: 585, y: 200 };                               // Daisy
  const TIP = [DZ.x - 118.8, DZ.y - 858.1];
  const ROPE = 455, BALL_R = 58, SW0 = 1.0, SWH = -.4, OM = 2 * Math.acos(SWH / SW0);
  const ZONE = { x: -900, y: 30, w: 700, h: 190 };
  const CREW = [[1180, 560, 0], [1380, 575, 1], [1560, 552, 2]];
  const HALE = { x: 1950, y: 520 }, CAR = { x: 2550, y: 470 };
  const TH_MAX = 1.53;
  const WIDE = { z: .44, x: -130, y: -273 };

  function fallAngle(t) {
    const k = times(); if (t < k.fall0) return 0;
    if (t < k.land) return -TH_MAX * E.inQ(seg(t, k.fall0, k.land));
    const tau = t - k.land; return -TH_MAX + .045 * Math.exp(-tau * 7) * Math.abs(Math.sin(tau * 16));
  }
  function ballSw(t) {
    const k = times();
    const idle = .03 * Math.sin(t * 2.1);
    if (t < k.release) return idle * (1 - seg(t, k.pull, k.pull + .3)) + SW0 * E.io(seg(t, k.pull, k.release - .1));
    if (t < k.impact) return SW0 * Math.cos(OM * (t - k.release));
    const tau = t - k.impact; return SWH * Math.exp(-1.4 * tau) * Math.cos(OM * .7 * tau);
  }
  function ballPos(sw) { return [TIP[0] + Math.sin(sw) * ROPE, TIP[1] + Math.cos(sw) * ROPE]; }
  function drawBall(ctx, sw) {
    const [bx, by] = ballPos(sw), hk = [TIP[0] + Math.sin(sw) * 404, TIP[1] + Math.cos(sw) * 404];
    C.seed(71);
    C.line(ctx, [hk, [bx - Math.sin(sw) * BALL_R, by - Math.cos(sw) * BALL_R]], 6, P.ink, .2);
    C.line(ctx, [hk, [bx - Math.sin(sw) * BALL_R, by - Math.cos(sw) * BALL_R]], 2.4, P.steelLt, .2);
    C.shape(ctx, C.ell(bx, by, BALL_R, BALL_R, 26), P.steel, { lw: 5, shade: c => { C.blot(c, C.ell(bx + 18, by + 16, BALL_R * .9, BALL_R * .85, 18), P.steelDk, .8); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(bx - 20, by - 22, 14, 8, -.6, 0, TAU); c.fill(); } });
  }
  function drawTower(ctx, t) {
    const k = times(), a = fallAngle(t), sp = towerSprite();
    ctx.save();
    if (t >= k.land - .05) { ctx.beginPath(); ctx.rect(-3000, -3000, 6000, 3008); ctx.clip(); }   // yerin altına geçen kısım görünmez
    ctx.translate(PIV[0], PIV[1]); ctx.rotate(a); ctx.translate(-PIV[0], -PIV[1]);
    ctx.drawImage(sp, -SPR_BX, -SPR_BY);
    if (t >= k.impact) { // darbe noktası: sağ ön ayakta çatlak
      const g = E.outC(seg(t, k.impact, k.impact + .25)); C.seed(301);
      C.line(ctx, [[214, -250], [206, -232], [222, -214], [210, -196]].slice(0, 2 + Math.round(g * 2)), 4, P.ink, .5);
    }
    ctx.restore();
  }
  function drawPlinth(ctx, t) {
    const k = times(); C.seed(305);
    C.shape(ctx, [[-340, 18], [340, 18], [328, -16], [-328, -16]], P.concrete, { lw: 3.6, shade: c => C.blot(c, [[120, -24], [360, -24], [360, 24], [140, 24]], P.concreteDk, .45) });
    if (t >= k.fall0 + .3) { // kopan ayak kütükleri
      [-280, -100, 100, 280].forEach((x, i) => { C.seed(310 + i); C.shape(ctx, [[x - 14, -14], [x - 12, -40 - i % 2 * 12], [x - 2, -30], [x + 8, -46 + i % 2 * 10], [x + 14, -14]], P.concreteDk, { lw: 3 }); });
    }
  }
  /* parçacıklar (P1 ile aynı fizik; beton renkleri) */
  const GRAV = 2200;
  function chips(ctx, tau, n, sb, spawn, size, groundY) {
    if (tau < 0) return;
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 1000 + i * 13 + j), s = spawn(i, r), gy = (groundY || 0) + 6 + r(9) * 120;
      const vy = s.vy, A = .5 * GRAV, disc = vy * vy + 4 * A * Math.max(0, gy - s.y), tl = (-vy + Math.sqrt(disc)) / (2 * A);
      const tt = Math.min(tau, tl), x = s.x + s.vx * tt + (tau > tl ? s.vx * .08 * (1 - Math.exp(-(tau - tl) * 8)) : 0), y = s.y + vy * tt + A * tt * tt;
      const sz = (size || 1) * (8 + r(5) * 14), rot = r(6) * 6 + (r(7) - .5) * 18 * tt;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); C.seed(sb * 50 + i);
      C.shape(ctx, [[-sz, -sz * .5], [sz * .9, -sz * .55], [sz, sz * .45], [-sz * .8, sz * .5]], [P.concrete, P.concreteDk, P.dustLt, P.steelDk][i % 4], { lw: 2.6, amp: .5 });
      ctx.restore();
    }
  }
  let dustCv = null;
  function dustCloud(ctx, tau, n, sb, spawn, alpha, life) {
    if (tau < 0 || alpha <= .01) return;
    if (!dustCv) dustCv = canvas(1080, 1920);
    const d = dustCv.getContext('2d'), m = ctx.getTransform();
    d.setTransform(1, 0, 0, 1, 0, 0); d.clearRect(0, 0, 1080, 1920); d.setTransform(m);
    const blobs = [];
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 1000 + i * 17 + j), s = spawn(i, r), tt = tau - (s.delay || 0); if (tt < 0) continue;
      const grow = E.outC(clamp(tt / (s.grow || .9))), rad = s.r * (.25 + .75 * grow) * (1 + .1 * tt) * (life ? clamp(1.25 - tt / life, .35, 1) : 1);
      const rise = s.rise * (1 - Math.exp(-tt / 1.1)) - (s.sink || 0) * Math.max(0, tt - 1.6);
      blobs.push([s.x + s.vx * (1 - Math.exp(-tt * 1.6)) / 1.6, s.y - rise, rad]);
    }
    d.globalAlpha = .35; d.fillStyle = P.ink; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x, y, r + 3, 0, TAU); d.fill(); }); d.globalAlpha = 1;
    d.fillStyle = P.dust; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill(); });
    d.fillStyle = P.dustLt; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x - r * .16, y - r * .2, r * .8, 0, TAU); d.fill(); });
    d.fillStyle = 'rgba(241,232,212,.35)'; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x - r * .3, y - r * .38, r * .38, 0, TAU); d.fill(); });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha * .72; ctx.drawImage(dustCv, 0, 0); ctx.restore();
  }
  function impactFx(ctx, t) {
    const k = times(), tau = t - k.impact; if (tau < 0) return;
    chips(ctx, tau, 14, 7, (i, r) => ({ x: 214 - r(1) * 20, y: -240 + (r(2) - .5) * 50, vx: -100 - r(3) * 380, vy: -360 + r(4) * 300 }), .8);
    dustCloud(ctx, tau, 14, 8, (i, r) => ({ x: 214 - r(1) * 30, y: -240 + (r(2) - .5) * 60, r: 10 + r(3) * 22, vx: -60 - r(4) * 240, rise: -20 + r(5) * 90, grow: .25, delay: r(6) * .05, sink: 30 }), clamp(1.1 - tau / 1.0), 1.2);
  }
  function landFx(ctx, t) {
    const k = times(), tau = t - k.land; if (tau < 0) return;
    chips(ctx, tau, 34, 12, (i, r) => { const along = r(1); return { x: PIV[0] - 60 - along * 960, y: -30 - r(2) * 60, vx: (r(3) - .5) * 460 - 60, vy: -260 - r(4) * 620 * (1 - along * .3) }; }, 1);
    const a = tau < 2.5 ? 1 : clamp(1 - (tau - 2.5) / 5, .3, 1);
    dustCloud(ctx, tau, 100, 13, (i, r) => { const along = r(1); return { x: PIV[0] - 40 - along * 1040, y: -20 - r(2) * 40, r: 18 + r(3) * r(3) * 100, vx: (r(4) - .5) * 300 - 50 * along, rise: 30 + r(5) * r(5) * 560, grow: 1.0 + r(6) * .5, delay: (1 - along) * .1 + r(7) * .08, sink: 24 }; }, a, 9);
  }

  /* ---- ekip: baretli siluetler ---- */
  function worker(ctx, x, y, s, sd, ph, walk, flag) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd);
    const lw = 5 / Math.sqrt(s), st = walk ? Math.sin(ph) : 0, body = '#46505c', bodyDk = '#343c46';
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 70, 11, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.shape(ctx, [[-34, -220], [-4, -220], [-10 - st * 22, -10], [-40 - st * 22, -10]], bodyDk, { lw });
    C.shape(ctx, [[4, -220], [34, -220], [40 + st * 22, -10], [10 + st * 22, -10]], body, { lw });
    C.shape(ctx, [[-46 - st * 22, -14], [-6 - st * 22, -14], [0 - st * 22, 0], [-50 - st * 22, 0]], P.bootDk, { lw });
    C.shape(ctx, [[8 + st * 22, -14], [46 + st * 22, -14], [54 + st * 22, 0], [6 + st * 22, 0]], P.bootDk, { lw });
    C.tube(ctx, [[-50, -360], [-66 + st * 10, -290], [-60 + st * 18, -228]], 34, 28, bodyDk, lw);
    C.shape(ctx, [[-56, -372], [56, -372], [62, -220], [-62, -220]], '#e0672a', { lw, shade: c => C.blot(c, [[20, -380], [70, -380], [70, -210], [26, -210]], '#b44e1c', .6) });
    C.line(ctx, [[-58, -290], [58, -290]], 7, P.paper, .3); C.line(ctx, [[-20, -372], [-20, -222]], 6, P.paper, .3); C.line(ctx, [[20, -372], [20, -222]], 6, P.paper, .3);
    if (flag) { C.tube(ctx, [[50, -360], [80, -400], [96, -450]], 34, 28, body, lw); C.line(ctx, [[96, -440], [100, -560]], 5, P.ink, .2); C.shape(ctx, [[100, -560], [160, -548 + Math.sin(ph * 2) * 6], [100, -516]], '#c8362a', { lw: lw * .8 }); }
    else C.tube(ctx, [[50, -360], [66 - st * 10, -290], [60 - st * 18, -228]], 34, 28, body, lw);
    C.shape(ctx, C.ell(0, -414, 36, 40, 18), '#a87a56', { lw });
    C.shape(ctx, [[-44, -430], [-38, -462], [-16, -478], [16, -478], [38, -462], [44, -430], [52, -428], [52, -420], [-52, -420], [-52, -428]], P.helmet, { lw, shade: c => C.blot(c, [[10, -480], [56, -480], [56, -418], [18, -418]], P.helmetDk, .7) });
    ctx.restore();
  }
  function keepSign(ctx) { // çitte uyarı levhası
    C.seed(330); C.shape(ctx, [[-170, 270], [170, 270], [170, 360], [-170, 360]], P.paper, { lw: 4 });
    ctx.save(); ctx.font = '700 46px Rubik'; ctx.textAlign = 'center'; ctx.fillStyle = '#c8362a'; ctx.fillText('KEEP BACK', 0, 332); ctx.restore();
  }
  function chalkArrow(ctx) {
    ctx.save(); ctx.strokeStyle = 'rgba(248,244,232,.85)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.setLineDash([28, 20]);
    ctx.beginPath(); ctx.moveTo(-330, 50); ctx.quadraticCurveTo(-420, 80, -520, 64); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(-490, 40); ctx.lineTo(-526, 64); ctx.lineTo(-492, 90); ctx.stroke(); ctx.restore();
  }

  /* ---- saha dünyası ---- */
  const BGA = { x: -3600, y: -1900, w: 9000, h: 2330, horizon: .764, towerX: -3, mode: 'day', seed: 7 };
  function drawSite(ctx, t, o) {
    o = o || {}; const k = times();
    ctx.fillStyle = P.sky0; ctx.fillRect(-4000, -5000, 10000, 3110);
    ctx.fillStyle = P.groundDk; ctx.fillRect(-4000, 400, 10000, 3000);
    C.drawWaterTower(ctx, BGA);
    for (let i = 0; i < 26; i++) C.blot(ctx, C.ell(-3400 + rnd(4000 + i) * 6600, 440 + rnd(4100 + i) * 1600, 60 + rnd(4200 + i) * 90, 10 + rnd(4300 + i) * 10, 12), i % 2 ? P.ground : P.dustDk, .22);
    clouds(ctx, t);
    TB.zone(ctx, ZONE.x, ZONE.y, ZONE.w, ZONE.h, 1);
    chalkArrow(ctx);
    drawPlinth(ctx, t);
    if (!o.noTower) drawTower(ctx, t);
    if (!o.noFx) impactFx(ctx, t);
    if (!o.noBall) drawBall(ctx, ballSw(t));
    if (!o.noDaisy) { const dx = o.daisyX == null ? DZ.x : o.daisyX; C.drawDaisy(ctx, { x: dx, y: DZ.y + (o.bob || 0), s: 1, seed: 23, hook: ballSw(t), beep: 0, mood: 'sleepy' }); daisyTire(ctx, dx, DZ.y + (o.bob || 0), 1); }
    if (!o.noFx) landFx(ctx, t);
    ctx.save(); ctx.translate(1380, 0); keepSign(ctx); ctx.restore();
    if (o.crew !== false) CREW.forEach(([x, y, i]) => { const w = o.crewWalk ? o.crewWalk(i) : { dx: 0, ph: 0, walk: false }; worker(ctx, x + w.dx, y, .95, 400 + i * 7, w.ph, w.walk, i === 1); });
    if (o.hale) C.drawHale(ctx, Object.assign({ x: HALE.x, y: HALE.y, s: 1, seed: 41, expr: 'confident' }, o.hale));
    if (o.car !== false) C.drawCar(ctx, Object.assign({ x: CAR.x, y: CAR.y, s: 1, view: 'side', seed: 61 }, o.car || {}));
  }
  function clouds(ctx, t) {
    [[-1200, -1300, 2.2, 9], [800, -1500, 1.7, 6], [2200, -1250, 2, 7]].forEach(([x0, y, sc, v]) => {
      const x = x0 + t * v; ctx.fillStyle = P.cloud; ctx.globalAlpha = .9;
      [[0, 0, 80, 28], [-66, 12, 56, 22], [62, 10, 60, 24], [12, -20, 50, 28]].forEach(([a, b, rx, ry]) => { ctx.beginPath(); ctx.ellipse(x + a * sc, y + b * sc, rx * sc, ry * sc, 0, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
    });
  }
  function shake(ctx, t, t0) {
    const f = Math.floor((t - t0) * FPS + 1e-6);
    if (f >= 0 && f < 6) { const a = 22 * (1 - f / 6); ctx.translate((rnd(900 + f) - .5) * 2 * a, (rnd(950 + f) - .5) * 2 * a); }
  }
  function blurredSite(key, t, z, cx, cy, blur, o) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      g.save(); cam(g, z, cx, cy); drawSite(g, t, Object.assign({ noFx: true }, o || {})); g.restore();
      const tau = Math.max(0, t - times().land); if (tau > 0) { g.fillStyle = `rgba(216,202,176,${clamp(.3 - tau * .03, .12, .3)})`; g.fillRect(0, 0, 1080, 1920); }
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
  }
  function drawBlurBg(ctx, cv, z) { z = z || 1; ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.drawImage(cv, -540, -960); ctx.restore(); }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 13: "Job two was a small water tower." geniş plan; Daisy sahaya girer, JOB 2 etiketi düşer --- */
  shot('p3b13-kule', k => k.start, k => k.crew, (ctx, t, u) => {
    const k = times(), e = E.io(u);
    const arrive = E.outC(seg(t, k.start - .3, k.start + 1.3)), dx = lerp(1250, DZ.x, arrive), bob = arrive < 1 ? Math.sin(twos(t) * 30) * 2.5 : 0;
    ctx.save(); cam(ctx, lerp(.41, .44, e), -130, lerp(-300, -273, e));
    drawSite(ctx, t, { daisyX: dx, bob, hale: false, noFx: true });
    airDust(ctx, t, 40, 3, [-1700, -600, 3000, 900], .8);
    if (arrive < 1) { // Daisy'nin tekerleklerinden kalkan toz
      for (let i = 0; i < 8; i++) { const r = j => rnd(5100 + i * 7 + j), tt = (t * 1.3 + r(1)) % 1; ctx.fillStyle = `rgba(216,202,176,${.6 * (1 - tt) * (1 - arrive)})`; ctx.beginPath(); ctx.arc(dx + 120 + tt * 260 + r(2) * 200, DZ.y - 20 - tt * 80, 20 + tt * 50, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    if (t >= k.tag) { const q = E.outBack(seg(t, k.tag, k.tag + .22)); tag(ctx, 250, lerp(190, 330, q), swing(twos(t), k.tag + .12, .22, 7), 'JOB 2', 2100, { s: 1, w: 200, h: 110, font: 54, str: 90 }); }
    vignette(ctx, .2);
    finish(ctx);
  });

  /* --- 14a: "a licensed crew, a fence" ekip çitin dışına çekilir, top geri çekilir --- */
  shot('p3b14-ekip', k => k.crew, k => k.site, (ctx, t, u) => {
    const k = times(), e = E.io(u);
    const walk = i => { const w0 = k.crew + .1 + i * .15, w1 = w0 + 1.3, uu = seg(t, w0, w1); return { dx: lerp(-150 - i * 30, 40, E.io(uu)), ph: twos(t) * 9 + i, walk: uu > 0 && uu < 1 }; };
    ctx.save(); cam(ctx, lerp(.6, .63, e), lerp(820, 860, e), 250);
    drawSite(ctx, t, { crewWalk: walk, noFx: true });
    airDust(ctx, t, 30, 4, [-200, -300, 2000, 800], .7);
    ctx.restore();
    finish(ctx);
  });

  /* --- 14b: "everyone far back." boş şeritli alan; top sağdan girer --- */
  shot('p3b14-alan', k => k.site, k => k.release + .02, (ctx, t, u) => {
    const e = E.io(u);
    ctx.save(); cam(ctx, lerp(.62, .58, e), lerp(-900, -380, e), -160);
    drawSite(ctx, t, { noFx: true });
    airDust(ctx, t, 30, 5, [-1500, -500, 2200, 700], .7);
    ctx.restore();
    finish(ctx);
  });

  /* --- 15: "It came down clean." top vurur, kule alana iner; Daisy'nin ışığı sönük; ardından ışığa itme --- */
  shot('p3b15-dusus', k => k.release + .02, k => k.plinth, (ctx, t) => {
    const k = times(), p = E.io(seg(t, k.pushD, k.plinth));
    ctx.save(); shake(ctx, t, k.land);
    const z = lerp(WIDE.z, 1.7, p), sx = lerp(540 + (DZ.x - WIDE.x) * WIDE.z, 520, p), sy = lerp(960 + (DZ.y - 346 - WIDE.y) * WIDE.z, 640, p);
    cam(ctx, z, DZ.x, DZ.y - 346, sx, sy);
    drawSite(ctx, t, {});
    airDust(ctx, t, 40, 6, [-1600, -700, 2400, 900], .8);
    ctx.restore();
    finish(ctx);
  });

  /* --- 16–17: beton kaidede damga; el tozu siler, üfler; sonra P1 açısında damga --- */
  const STONE = { x: 560, y: 760, w: 330, h: 190, rot: -.05 };
  function drawSlab(ctx) {
    const cv = cached('kaide', 1400, 2200, c => {
      c.translate(160, 140);
      const g = c.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#cbbfa6'); g.addColorStop(1, '#a89c84'); c.fillStyle = g; c.fillRect(-200, -200, 1500, 2400);
      for (let i = 0; i < 46; i++) C.blot(c, C.ell(rnd(i + 300) * 1080, rnd(i + 350) * 1920, 50 + rnd(i + 390) * 110, 14 + rnd(i + 430) * 22, 12), i % 2 ? P.concreteDk : P.dustLt, .28);
      for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(110,100,87,.35)'; c.beginPath(); c.arc(rnd(i + 900) * 1100, rnd(i + 990) * 1950, 1.5 + rnd(i + 1090) * 3.5, 0, TAU); c.fill(); }
      // kalıp izleri (beton dökme çizgileri) + çatlak
      C.seed(320); [[-60, 300], [-60, 1240]].forEach(([x, y]) => C.line(c, [[x, y], [1200, y - 14]], 3, 'rgba(21,18,13,.3)', .6));
      C.line(c, [[880, 330], [840, 420], [870, 500], [820, 640]], 3.4, P.ink, .6);
      // kopmuş ayak kütükleri ve filizler (sol üst, sağ alt)
      [[150, 260, 0], [960, 1180, 1]].forEach(([x, y, i]) => {
        C.seed(340 + i);
        C.shape(c, [[x - 90, y + 40], [x - 84, y - 50], [x - 40, y - 20], [x - 10, y - 70], [x + 30, y - 30], [x + 86, y - 60], [x + 92, y + 40]], P.concreteDk, { lw: 5, shade: cc => C.blot(cc, [[x + 20, y - 80], [x + 100, y - 80], [x + 100, y + 50], [x + 30, y + 50]], '#6e6457', .5) });
        for (let q = 0; q < 3; q++) C.line(c, [[x - 50 + q * 45, y - 30], [x - 60 + q * 50, y - 150 - q * 16], [x - 40 + q * 50, y - 190 - q * 10]], 6, '#7a4a30', .6);
      });
      for (let i = 0; i < 26; i++) {
        const x = -60 + rnd(1600 + i) * 1200, y = -60 + rnd(1700 + i) * 2050;
        if (Math.abs(x - STONE.x) < STONE.w * .85 && Math.abs(y - STONE.y) < STONE.h * 1.1) continue;
        const w = 50 + rnd(1800 + i) * 70, h = 30 + rnd(1900 + i) * 30, r = (rnd(2000 + i) - .5) * 2;
        c.save(); c.translate(x, y); c.rotate(r); C.seed(650 + i);
        C.shape(c, [[-w / 2, -h / 2], [w / 2, -h / 2 + 6], [w / 2 - 6, h / 2], [-w / 2 + 4, h / 2 - 4]], [P.concrete, P.concreteDk, '#cbbfa6'][i % 3], { lw: 4, shade: cc => C.blot(cc, [[-w / 2, h * .1], [w / 2, h * .1], [w / 2, h], [-w / 2, h]], P.concreteDk, .55) });
        c.restore();
      }
      for (let i = 0; i < 24; i++) C.blot(c, C.ell(rnd(7000 + i) * 1080, rnd(7100 + i) * 1920, 10 + rnd(7200 + i) * 22, 4 + rnd(7300 + i) * 6, 10), P.dustLt, .3);
    });
    ctx.drawImage(cv, -160, -140);
    C.drawStamp(ctx, { x: STONE.x, y: STONE.y, s: 1, rot: STONE.rot, dust: 0 });
  }
  function stoneDust(ctx, cleanH, cleanK) { // P1 ile aynı toz (aynı tohumlar); el geçtikçe kaybolur
    ctx.save(); ctx.translate(STONE.x, STONE.y); ctx.rotate(STONE.rot);
    ctx.beginPath(); ctx.rect(-STONE.w / 2 - 4, -STONE.h / 2 - 4, STONE.w + 8, STONE.h + 8); ctx.clip();
    for (let i = 0; i < 150; i++) {
      const x = (rnd(8000 + i) - .5) * STONE.w, y = (rnd(8100 + i) - .5) * STONE.h, th = rnd(8200 + i) * .95 + .02;
      if ((x < 0 ? cleanH : cleanK) > th) continue;
      ctx.fillStyle = i % 3 ? 'rgba(216,202,176,.92)' : 'rgba(152,140,122,.85)';
      ctx.beginPath(); ctx.ellipse(x, y, 20 + rnd(8300 + i) * 26, 12 + rnd(8400 + i) * 12, rnd(8500 + i) * 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function wipe(t) {
    const k = times(), w1a = k.wipe0, w1b = w1a + .5, bA = w1b, bB = w1b + .3;
    return { w1a, w1b, bA, bB, cleanH: .1 + .9 * seg(t, w1a, w1b - .1), cleanK: .05 + .55 * seg(t, w1a + .1, w1b) + .4 * seg(t, bA, bB) };
  }
  function blowFx(ctx, t, bA) {
    const bt = t - bA; if (bt <= 0 || bt >= 1.1) return;
    for (let i = 0; i < 26; i++) { const r = j => rnd(9100 + i * 5 + j), tt = bt - r(1) * .2; if (tt < 0) continue; const x = STONE.x - 120 + r(2) * 260 - tt * (160 + r(3) * 260), y = STONE.y - 60 + r(4) * 100 - tt * (90 + r(5) * 160); ctx.fillStyle = `rgba(216,202,176,${.85 * (1 - tt / 1.1)})`; ctx.beginPath(); ctx.arc(x, y, 6 + r(6) * 12 + tt * 20, 0, TAU); ctx.fill(); }
  }
  shot('p3b16-kaide', k => k.plinth, k => k.tight, (ctx, t, u) => {
    const k = times(), tw = twos(t), W = wipe(tw);
    ctx.save(); cam(ctx, lerp(1.3, 1.42, E.io(u)), STONE.x, STONE.y, 540, 720);
    drawSlab(ctx); stoneDust(ctx, W.cleanH, W.cleanK); blowFx(ctx, t, W.bA);
    let hx, hy;
    if (tw < W.w1b) { const e = E.outC(seg(tw, k.plinth, W.w1a + .05)), sw = E.io(seg(tw, W.w1a, W.w1b)); hx = lerp(1150, STONE.x - 150 + sw * 300, e); hy = lerp(1300, STONE.y + 30 - Math.sin(sw * Math.PI) * 14, e); }
    else { const e = E.inQ(seg(tw, W.w1b, W.w1b + .22)); hx = lerp(STONE.x + 150, STONE.x + 650, e); hy = lerp(STONE.y + 30, STONE.y + 560, e); }
    if (tw < W.w1b + .22) drawFlatHand(ctx, hx, hy, -.35, 0);
    airDust(ctx, t, 18, 7, [0, 300, 1080, 1100], .8);
    ctx.restore();
    finish(ctx);
  });
  shot('p3b17-damga', k => k.tight, k => k.hale, (ctx, t, u) => {
    const k = times();
    ctx.save(); cam(ctx, lerp(1.9, 2.05, E.io(u)), STONE.x, STONE.y, 540, 480);
    drawSlab(ctx);
    airDust(ctx, t, 10, 8, [200, 560, 700, 400], .7);
    ctx.restore();
    const st = t - k.stamp; if (st >= 0 && st < 2 / FPS) { ctx.fillStyle = 'rgba(255,243,196,.12)'; ctx.fillRect(0, 0, 1080, 1920); }
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 18–19: Hale görür, cümlenin ortasında donar --- */
  // Hale'i boyundan ikiye bölerek çizer: baş eğilip döner (konuşma jesti), gövde hafif salınır.
  function drawHaleTalk(ctx, o, headRot, headDy, sway) {
    const s = (o.s || 1) * 1.04, neck = o.y - 409 * s;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(sway || 0); ctx.translate(-o.x, -o.y);
    ctx.save(); ctx.beginPath(); ctx.rect(-3000, neck, 9000, 6000); ctx.clip(); C.drawHale(ctx, o); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-3000, -6000, 9000, neck + 6000 + 1); ctx.clip();
    ctx.translate(o.x + 4 * s, neck + (headDy || 0)); ctx.rotate(headRot || 0); ctx.translate(-(o.x + 4 * s), -neck); C.drawHale(ctx, o); ctx.restore();
    ctx.restore();
  }
  // konuşma: ağız ifadeleri ikişerli değişir (dudak eşlemesi değil, "konuşuyor" bilgisi)
  const TALK = ['confident', 'serious', 'confident', 'smile', 'serious', 'confident'];
  function talkExpr(t, sd) { const i = Math.floor(t * 5 + rnd(sd) * 3); return TALK[i % TALK.length]; }
  shot('p3b18-hale', k => k.hale, k => k.haleCU, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredSite('bg-hale', k.land + 4, .95, 2150, 150, 7, { hale: false, crew: false });
    drawBlurBg(ctx, bg, 1 + u * .03);
    const sawU = E.io(seg(tw, k.saw - .1, k.saw + .3));
    const expr = tw < k.saw ? talkExpr(tw, 3) : (tw < k.saw + .5 ? 'serious' : talkExpr(tw, 5));
    const nod = (1 - sawU) * Math.sin(tw * 7) * .03, look = lerp(.6, -1, sawU);
    const blink = (tw >= k.hale + .55 && tw < k.hale + .55 + 3 / FPS) ? 1 : 0;
    ctx.save(); cam(ctx, lerp(1, 1.04, E.io(u)), 540, 960);
    drawHaleTalk(ctx, { x: 540, y: 2260, s: 2.55, seed: 41, expr, look, blink }, nod - .06 * sawU, -6 * sawU, Math.sin(tw * 2.2) * .006 * (1 - sawU));
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });
  shot('p3b19-donar', k => k.haleCU, k => k.car, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredSite('bg-hale-cu', k.land + 5, 1.3, 1800, -100, 10, { hale: false, crew: false });
    drawBlurBg(ctx, bg, 1.05);
    const frozen = tw >= k.stop;
    const expr = frozen ? (tw < k.car - .3 ? 'frozen' : 'serious') : talkExpr(tw, 9);
    const nod = frozen ? 0 : Math.sin(tw * 8) * .035;
    // donma: baş geri çekilir (küçük), sonra 18+ kare tamamen hareketsiz
    const back = frozen ? E.outC(seg(tw, k.stop, k.stop + .14)) : 0;
    const z = lerp(1, 1.035, E.io(seg(t, k.haleCU, k.stop)));
    ctx.save(); cam(ctx, z, 540, 960);
    drawHaleTalk(ctx, { x: 540, y: 2760, s: 4.1, seed: 41, expr, look: -.9, blink: 0 }, nod + .03 * back, -10 * back, 0);
    ctx.restore();
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 20: "Then he drove away." kapı kapanır, araba tozu bırakıp gider --- */
  const WIN = [[158, -288], [40, -290], [40, -206], [232, -204]];   // ön cam (araba yerel)
  shot('p3b20-araba', k => k.car, k => k.yard, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const go = seg(t, k.drive, k.drive + 1.2), dist = 1700 * E.inQ(go) + 260 * go, cx = CAR.x + dist;
    const door = tw < k.car + .3, slam = seg(t, k.car + .3, k.car + .4), bump = Math.sin(Math.PI * slam) * 4;
    ctx.save(); cam(ctx, .55, lerp(2350, 2700, E.io(seg(t, k.car, k.yard))), 120);
    drawSite(ctx, t, { crew: false, car: { x: cx, y: CAR.y + bump, door, dust: clamp(go * 2.2), wheel: dist / 62 } });
    // Hale ön camda (şapka + baş, cam arkasında koyu)
    ctx.save(); ctx.translate(cx, CAR.y + bump); ctx.beginPath(); WIN.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip();
    C.drawHale(ctx, { x: 120, y: -40, s: .42, seed: 41, expr: 'serious', look: 1 });
    ctx.fillStyle = 'rgba(43,69,82,.5)'; ctx.fillRect(0, -300, 260, 120); ctx.restore();
    if (go > 0) dustCloud(ctx, t - k.drive, 30, 17, (i, r) => ({ x: CAR.x - 420 + r(1) * dist, y: CAR.y - 20 - r(2) * 30, r: 30 + r(3) * 60, vx: -60 - r(4) * 120, rise: 40 + r(5) * 120, grow: .8, delay: r(1) * 1.0, sink: 0 }), .8, 3);
    airDust(ctx, t, 30, 9, [1700, -500, 1900, 800], .7);
    ctx.restore();
    finish(ctx);
  });

  /* ================= AKŞAM ================= */
  // Avlu (A ile aynı drawYard; Daisy'nin avludaki yeri):
  const YD = { x: 300, y: 1560, s: .55 };
  const MB = { x: 670, y: 1312 };                                   // posta kutusu (drawYard 1080×1920'de)
  function drawYardDusk(ctx, t, letter) {
    C.drawYard(ctx, { x: -600, y: 0, w: 2280, h: 1920, mode: 'dusk', letter: false, seed: 7 });
    void t; void letter;
  }
  shot('p3b21-posta', k => k.yard, k => k.env, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.save(); cam(ctx, lerp(1.35, 1.5, E.io(u)), MB.x - 40, MB.y + 40, 540, 760);
    C.drawYard(ctx, { x: 0, y: 0, w: 1080, h: 1920, mode: 'dusk', letter: false });
    // zarf yuvaya kayar (posta geldi): yuvadan aşağı kayıp ucu dışarıda kalır
    if (t >= k.letter - .25) {
      const q = E.outC(seg(t, k.letter - .25, k.letter + .1)), mx = MB.x, my = 1536 - 192 - 44 - 6 + lerp(-60, 0, q);
      ctx.save(); ctx.beginPath(); ctx.rect(mx - 60, 1000, 120, 1536 - 192 - 46 - 1000); ctx.clip();
      C.seed(360); C.shape(ctx, [[mx - 18, my], [mx + 16, my - 2], [mx + 18, my - 18], [mx - 16, my - 16]], P.paper, { lw: 2.6 }); ctx.restore();
      const jig = t >= k.letter && t < k.letter + 2 / FPS ? 1 : 0; void jig;
    }
    // Kaan avlunun içinden posta kutusuna yürür (profil)
    const wu = seg(tw, k.yard + .2, k.env - .25), kx = lerp(420, 600, E.io(wu));
    C.drawKaan(ctx, { x: kx, y: 1536, s: .5, seed: 11, pose: 'side', step: wu > 0 && wu < 1 ? Math.sin(tw * 9) : 0, expr: 'calm' });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* ---- masa (akşam lambası) ---- */
  function drawDesk(ctx, y0) {
    const cv = cached('masa', 1080, 2400, c => {
      c.fillStyle = P.wood; c.fillRect(0, 0, 1080, 2400); C.seed(380);
      for (let i = 0; i < 14; i++) C.line(c, [[-20, 60 + i * 170 + rnd(i) * 40], [500, 80 + i * 170], [1100, 50 + i * 170 + rnd(i + 9) * 30]], 2.4, 'rgba(21,18,13,.35)', 1.5);
      for (let i = 0; i < 8; i++) C.blot(c, C.ell(rnd(i + 60) * 1080, rnd(i + 70) * 2400, 120 + rnd(i + 80) * 140, 20 + rnd(i + 90) * 20, 12), '#4a2e17', .3);
    });
    ctx.drawImage(cv, 0, y0);
  }
  function lampLight(ctx, x, y, r, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 20, x, y, r); g.addColorStop(0, `rgba(255,210,122,${a})`); g.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
  }
  shot('p3b21-zarf', k => k.env, k => k.sign, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    drawDesk(ctx, -200);
    lampLight(ctx, 300, 300, 1100, .22);
    ctx.save(); cam(ctx, lerp(1, 1.05, E.io(u)), 540, 900);
    const pull = E.io(seg(tw, k.env + .25, k.sign - .1));
    // mektup zarfın arkasından yukarı çıkar
    ctx.save(); ctx.beginPath(); ctx.rect(0, -400, 1080, 1060 + 6); ctx.clip();
    C.drawLetter(ctx, { kind: 'letter', x: 540, y: lerp(980, 700, pull), s: 1.6, rot: -.02, lines: [], ring: true, seed: 81 });
    ctx.restore();
    C.drawLetter(ctx, { kind: 'envelope', x: 540, y: 880, s: 1.9, rot: -.03, seed: 82 });
    // Kaan'ın eli mektubun sağ üst köşesini tutar
    const hx = 540 + 272 * .95, hy = lerp(980, 700, pull) - 368 + 30;
    if (tw >= k.env + .1) drawFlatHand(ctx, lerp(hx + 400, hx + 60, E.outC(seg(tw, k.env + .1, k.env + .3))), hy, -1.1, .3);
    ctx.restore();
    vignette(ctx, .55);
    finish(ctx);
  });
  shot('p3b22-imza', k => k.sign, k => k.oneLine, (ctx, t, u) => {
    drawDesk(ctx, -300);
    lampLight(ctx, 200, 200, 1200, .2);
    const e = E.io(u);
    C.drawLetter(ctx, { kind: 'letter', x: lerp(780, 720, e), y: lerp(40, 70, e), s: 2.6, rot: -.02, lines: [], ring: true, seed: 81 });
    vignette(ctx, .5);
    finish(ctx);
  });
  // tek satır: el yazısı, harf harf (kelime zamanlarıyla)
  const LINE = '"The ant is not ready."';
  function lineChars(t) {
    const k = times(), ws = k.antW; let n = 0, idx = 0;
    const parts = LINE.split(' ');
    for (let i = 0; i < parts.length; i++) {
      const w = ws[Math.min(i, ws.length - 1)], len = parts[i].length + (i < parts.length - 1 ? 1 : 0);
      const f = clamp((t - w.t0 + .04) / Math.max(.12, w.t1 - w.t0));
      n = idx + Math.round(len * f); if (f < 1) return n; idx += len;
    }
    return LINE.length;
  }
  function letterWithLine(ctx, o, n) {
    C.drawLetter(ctx, Object.assign({ kind: 'letter', lines: [], ring: true, seed: 81 }, o));
    if (n > 0) { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(o.s, o.s); C.handwrite(ctx, LINE.slice(0, n), -146, -86, 23, P.ink, 17); ctx.restore(); }
  }
  shot('p3b23-satir', k => k.oneLine, k => k.ant, (ctx, t, u) => {
    drawDesk(ctx, -260);
    lampLight(ctx, 250, 250, 1200, .2);
    const e = E.io(u);
    ctx.save(); cam(ctx, lerp(1, 1.04, e), 540, 760);
    letterWithLine(ctx, { x: 540, y: 760, s: 2.2, rot: -.02 }, 0);
    ctx.restore();
    vignette(ctx, .5);
    finish(ctx);
  });
  shot('p3b24-ant', k => k.ant, k => k.desk, (ctx, t, u) => {
    drawDesk(ctx, -400);
    lampLight(ctx, 250, 150, 1200, .2);
    const e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.35, 1.42, e), 470, 600, 540, 520);
    letterWithLine(ctx, { x: 540, y: 760, s: 2.2, rot: -.02 }, lineChars(t));
    ctx.restore();
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 25 + bitiş: masa, pencere; Kaan'ın saç tutamının gölgesi mektupta; pencerede Daisy'nin ışığı (üst üçte bir), TEK bip --- */
  function kaanShadow() { // Kaan arkadan (saç tutamı), düz gölge silüeti
    return cached('kaan-golge', 900, 1300, c => {
      C.drawKaan(c, { x: 450, y: 1280 + 520 * 0, s: 2.2, seed: 11, pose: 'back' });
      c.globalCompositeOperation = 'source-in'; c.fillStyle = '#1a120c'; c.fillRect(0, 0, 900, 1300);
    });
  }
  const WINR = { x: 150, y: 120, w: 780, h: 470 };
  function drawWindowView(ctx, beep) {
    ctx.save(); ctx.beginPath(); ctx.rect(WINR.x, WINR.y, WINR.w, WINR.h); ctx.clip();
    // pencereden avlu: akşam, Daisy önde
    const sc = .62 / YD.s * .55, bx = 560, by = 560;
    ctx.save(); ctx.translate(bx, by); ctx.scale(sc, sc); ctx.translate(-YD.x, -YD.y);
    C.drawYard(ctx, { x: -600, y: 0, w: 2280, h: 1920, mode: 'dusk' });
    ctx.restore();
    C.drawDaisy(ctx, { x: bx, y: by, s: .62, seed: 23, beep: 0, mood: 'sleepy', hook: .02 });
    if (beep > 0) { ctx.save(); ctx.translate(bx, by); ctx.scale(.62, .62); drawBeacon(ctx, beep); ctx.restore(); }
    ctx.fillStyle = 'rgba(30,40,60,.18)'; ctx.fillRect(WINR.x, WINR.y, WINR.w, WINR.h);
    ctx.restore();
    // çerçeve
    C.seed(390); C.shape(ctx, [[WINR.x - 20, WINR.y - 20], [WINR.x + WINR.w + 20, WINR.y - 20], [WINR.x + WINR.w + 20, WINR.y + WINR.h + 26], [WINR.x - 20, WINR.y + WINR.h + 26]], null, { lw: 0 });
    ctx.save(); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.strokeRect(WINR.x, WINR.y, WINR.w, WINR.h); ctx.restore();
    C.line(ctx, [[WINR.x + 250, WINR.y], [WINR.x + 250, WINR.y + WINR.h]], 10, '#3f2711', .3);
    C.line(ctx, [[WINR.x + 250, WINR.y], [WINR.x + 250, WINR.y + WINR.h]], 4, P.ink, .3);
  }
  // Uyarı ışığı tek başına (P1 ile aynı)
  function drawBeacon(ctx, v) {
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(q => { const r = 40 + q * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - q * .2) * Math.min(1, v * 1.5), null, .5); }));
  }
  shot('p3b25-son', k => k.desk, k => k.dur + 1, (ctx, t) => {
    const k = times(), tf = t >= k.freeze0 && t < k.freeze1 ? k.freeze0 : t, tw = twos(tf);
    const b = beepV(t, k.endBeep);
    // oda: duvar + pencere üstte, masa altta
    ctx.fillStyle = '#3a2f2c'; ctx.fillRect(0, 0, 1080, 1920);
    const push = E.io(seg(tf, k.desk, k.end + .6)), post = Math.max(0, tf - k.freeze1) * .004 * (tf >= k.freeze1 ? 1 : 0);
    ctx.save(); cam(ctx, lerp(1, 1.06, push) + post, 540, lerp(820, 760, push), 540, 820);
    C.seed(395); for (let x = -100; x < 1200; x += 120) { ctx.fillStyle = 'rgba(7,11,24,.15)'; ctx.fillRect(x, -200, 50, 900); }
    drawWindowView(ctx, b);
    drawDesk(ctx, 660);
    C.shape(ctx, [[-60, 640], [1140, 640], [1140, 676], [-60, 676]], '#3f2711', { lw: 5 });    // masa kenarı (pencere altı)
    // mektup masada
    const lo = { x: 560, y: 1080, s: 1.55, rot: -.04 };
    letterWithLine(ctx, lo, LINE.length);
    // kahve fincanı (masada, sol üst köşe)
    C.coffeeCup && void 0;
    // Kaan'ın gölgesi: sağ alttan mektubun üstüne kayar; tutam satıra değer
    const sh = E.outC(seg(tw, k.desk + .25, k.desk + 1.5)), breath = Math.sin(tw * 1.6) * 6 * (tf >= k.end ? .5 : 1);
    ctx.save(); ctx.globalAlpha = .34; ctx.filter = 'blur(5px)';
    ctx.translate(lerp(980, 700, sh), lerp(1900, 1330, sh) + breath); ctx.rotate(-.18); ctx.transform(1, 0, -.15, 1, 0, 0);
    ctx.drawImage(kaanShadow(), -450, -300);
    ctx.restore();
    ctx.restore();
    lampLight(ctx, 120, 900, 1100, .16);
    // bip: odaya kırmızı yansıma (yalnız ışıkla aynı karede)
    if (b > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,90,60,.06)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); }
    vignette(ctx, .5);
    const dk = .55 * E.io(seg(t, k.endCard - .1, k.endCard + .2)); if (dk > 0) { const g = ctx.createLinearGradient(0, 600, 0, 900); g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(1, `rgba(7,11,24,${dk})`); ctx.fillStyle = g; ctx.fillRect(0, 600, 1080, 1320); }
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const f3 = x => +x.toFixed(3);
  TB.cuesB = {
    get daisyMotor() { return f3(times().start); },                // Daisy sahaya girer (motor, 1,4 sn)
    get etiketJob2() { return f3(times().tag); },                   // JOB 2 etiketi düşer
    get ekipAdim() { return f3(times().crew + .1); },               // ekip yürür (çakıl adımları)
    get topCekme() { return f3(times().pull); },                    // top geri çekilir (halat gerilir)
    get topBirak() { return f3(times().release); },
    get topDarbe() { return f3(times().impact); },                  // top ayağa değer
    get kuleDusus() { return f3(times().fall0); },
    get kuleYereCarpma() { return f3(times().land); },              // ağır darbe; ekran sarsıntısı 6 kare
    get tozSilme() { return f3(wipe(times().wipe0).w1a); },
    get ufleme() { return f3(wipe(times().wipe0).bA); },
    get damga() { return f3(times().stamp); },                      // "tok"
    get haleDonar() { return f3(times().stop); },                   // sessizlik
    get arabaKapi() { return f3(times().car + .3); },
    get arabaKalkis() { return f3(times().drive); },                // motor + çakıl
    get postaKutusu() { return f3(times().letter); },               // zarf kutuya düşer
    get mektupCekme() { return f3(times().env + .25); },            // kâğıt zarftan çıkar
    get kalemSatir() { return f3(times().antW[0].t0); },            // satır yazılır (hafif kalem cızırtısı, isteğe bağlı)
    get sonBip() { return f3(times().endBeep); }                    // tek bip; ışık +0,04–0,24
  };
})();
