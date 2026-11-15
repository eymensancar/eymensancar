/* Animatör B: 23.15 sn – son (cümle 13–28 ve bitiş görüntüsü).
   Bütün zamanlar part1.timeline.json'dan okunur (times()); sahne sınırları getter, timeline yüklenince hesaplanır.
   Dünya (arsa) tek bir koordinat düzleminde kurulur: ufuk y=1060, baca tabanı (560,1100), Daisy önü (878,1180).
   Her plan aynı dünyayı başka bir kamerayla çizer; toz, tuğla ve top hep zamandan hesaplanır (tohumlu). */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;          // karakterler ikişerli
  const ones = t => Math.floor(t * FPS + 1e-6) / FPS;

  /* ================= ZAMANLAR ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1], c = tl.cues;
    const W = (i, re, n) => { const ws = S(i).words; const w = ws.find(x => re.test(x.w)); return w || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const k = {};
    k.start = S(12).t1 + (S(13).t0 - S(12).t1) / 2;      // A ile ortak kesme (23,15)
    k.phone = W(13, /^flattened/i, 4).t0;                  // telefona yakın plan
    k.tap = W(14, /^try/i, 5).t0 + .05;                    // "Try again" düğmesine basış (kare 131)
    k.gameK1 = W(13, /^Master/i, 9).t1 - 54 / FPS;         // k1 (kare 1–55): DEMOLISHED! "Master"da
    k.timesUp = S(14).t0 - .04;                            // k2 sonu (96–115): TIME'S UP
    k.cut15 = S(14).t1 + .25;                              // sert kesme: gündüz
    k.lever = S(16).t0 - .45;
    k.ant1 = W(16, /^pulled/i, 1).t0;                      // kol: beklenti
    k.clonk1 = W(16, /^pulled/i, 1).t1 + .12;              // kol yerine oturur
    k.daisy = S(17).t0 - .25;
    k.beep = c.beep;
    k.freeze0 = c.beep - .3; k.freeze1 = c.beep + .57 + 10 / FPS; // bipten önce/sonra hiçbir şey kıpırdamaz
    k.shrug = S(18).t1 + .25;
    k.impact = c.fall - 8 / FPS;                           // top bacaya değer; 8 kare tutma, sonra düşüş
    k.release = k.impact - .5;                             // top bırakılır
    k.insert = k.release - .25;                            // kol sonuna kadar
    k.shrugUp = k.insert - .5;
    k.clonk2 = k.insert + .12;
    k.fall = c.fall; k.ground = c.fall + 1.45;             // bacanın yere çarpması
    k.wide = S(21).t0 - .15;
    k.kaan = S(22).t0 - .1;
    k.luck = W(22, /^luck/i, 5).t0;
    k.rubble = S(23).t0 - .2;
    k.stone = S(24).t0 - .15;
    k.H = W(25, /^H/, 0).t0; k.K = W(25, /^K/, 2).t0; k.stamp = c.stamp;
    k.push = S(26).t0 - .15;
    k.flash = S(27).t0 - .18;
    k.twice = W(27, /^twice/i, 2).t0;
    k.eyes = S(28).t0 - .6;
    k.knew = W(28, /^knew/i, 2).t0;
    k.end = c.voiceEnd; k.endBeep = c.endBeep; k.endCard = c.endCard; k.dur = tl.duration;
    K = k; return k;
  }

  /* İki bip: daisy-beep.wav içinde tonlar 0,04–0,24 ve 0,37–0,57 sn (sfx_uret.py, aday B: açık 0,20, ara 0,13).
     Işık sesle aynı karede: 6 kare yanık, 4 sönük, 6 yanık. İlk bip .8, ikinci en parlak. */
  const TONES = [[.04, .24], [.37, .57]];
  function beepAt(t, t0, n) {
    const d = t - t0; let v = 0, idx = -1;
    for (let i = 0; i < (n || 2); i++) if (d >= TONES[i][0] - 1e-6 && d < TONES[i][1] - 1e-6) { v = i ? 1 : .8; idx = i; }
    return { v, idx, after: d >= TONES[0][0] - 1e-6 };
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
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }

  /* ================= OYUN KARELERİ ================= */
  const GAME_N = 150, gameImgs = [];
  for (let i = 1; i <= GAME_N; i++) gameImgs.push(TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg'));
    // Kareler gelmediyse aynı boyutta (450×800) yer tutucu: alacakaranlıkta oyun sahnesi, kuleler sırayla çöker.
  const ph = { cv: null, idx: -1 };
  // Kurgu (meta.json): gece planında k2 başı (56–95) döner; telefonda k1 1–55 ("forty towers", DEMOLISHED! "Master"da),
  // "In the game"de TIME'S UP (96–115), sonuç kartı (116–131) dokunuşa kadar yavaşlatılır, 131'de basılır, kepenk + yeniden (132–150).
  function gameSeqIdx(t) {
    const k = times(), f = x => Math.floor(x * FPS + 1e-6);
    if (t < k.gameK1) return 55 + f(t - k.start) % 40;
    if (t < k.timesUp) return Math.min(54, f(t - k.gameK1));
    const cardT = k.timesUp + 20 / FPS;
    if (t < cardT) return 95 + Math.min(19, f(t - k.timesUp));
    if (t < k.tap) return 115 + Math.min(14, Math.floor(15 * (t - cardT) / (k.tap - cardT)));
    return Math.min(149, 130 + f(t - k.tap));
  }
  function gameFrame(t) {
    const i = gameSeqIdx(t), im = gameImgs[i];
    if (im && im.complete && im.naturalWidth > 0) return im;
    if (!ph.cv) ph.cv = canvas(450, 800);
    const sec = i / FPS;
    if (ph.idx === i) return ph.cv; ph.idx = i;
    const g = ph.cv.getContext('2d'), tt = sec;
    const sk = g.createLinearGradient(0, 0, 0, 560); sk.addColorStop(0, '#17202c'); sk.addColorStop(.55, '#2f3a4b'); sk.addColorStop(.86, '#7d4f3f'); sk.addColorStop(1, '#c9713e');
    g.fillStyle = sk; g.fillRect(0, 0, 450, 800);
    g.fillStyle = '#2a3444'; for (let x = 0; x < 450; x += 38) { const h = 40 + rnd(x + 3) * 90; g.fillRect(x, 560 - h, 34, h); }
    g.fillStyle = '#3a2f26'; g.fillRect(0, 560, 450, 240); g.fillStyle = '#57452f'; g.fillRect(0, 560, 450, 8);
    const cyc = 1.25, ci = Math.floor(tt / cyc), ct = tt - ci * cyc;
    for (let b = 0; b < 3; b++) {
      const bx = 70 + b * 120, falling = (ci % 3) === b, u = falling ? clamp((ct - .25) / .6) : 0;
      for (let r = 0; r < 9; r++) for (let q = 0; q < 2; q++) {
        let x = bx + q * 34, y = 560 - (r + 1) * 30;
        if (falling && u > 0) { const sd = rnd(b * 99 + r * 7 + q); x += (sd - .5) * 160 * u; y += u * u * (r * 30 + 20) * (1 - r * .02); }
        g.fillStyle = r % 2 ? '#e8e4da' : '#c9c2b3'; g.fillRect(x, Math.min(y, 552), 32, 28); g.strokeStyle = '#141618'; g.lineWidth = 2; g.strokeRect(x, Math.min(y, 552), 32, 28);
      }
      if (falling && ct > .3) { g.fillStyle = `rgba(152,140,122,${.8 * (1 - (ct - .3) / .95)})`; for (let d = 0; d < 7; d++) { g.beginPath(); g.arc(bx + 34 + (rnd(d + ci * 13) - .5) * 160, 540 - rnd(d + 5) * 70, 26 + (ct - .3) * 70, 0, TAU); g.fill(); } }
      if (falling && ct > .7) { g.font = '700 34px Rubik'; g.fillStyle = '#F5B700'; g.textAlign = 'center'; g.fillText('+120', bx + 34, 420 - (ct - .7) * 120); }
    }
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, 450, 70); g.font = '700 30px Rubik'; g.fillStyle = '#F5B700'; g.textAlign = 'left'; g.fillText('● ' + (1240 + ci * 120), 20, 46);
    for (let x = -40; x < 450; x += 40) { g.fillStyle = '#F5B700'; g.fillRect(x, 760, 40, 40); g.fillStyle = '#141618'; g.beginPath(); g.moveTo(x, 800); g.lineTo(x + 20, 800); g.lineTo(x + 40, 760); g.lineTo(x + 20, 760); g.fill(); }
    g.font = '500 16px Rubik'; g.fillStyle = 'rgba(255,255,255,.5)'; g.textAlign = 'center'; g.fillText('yer tutucu · f' + String(i + 1).padStart(4, '0'), 225, 740);
    return ph.cv;
  }
  function frameBright(t) { const i = gameSeqIdx(t); return .75 + .25 * Math.abs(Math.sin(i * .37)) + (i % 37 < 3 ? .25 : 0); }

  /* ================= DÜNYA: ARSA ================= */
  const WD = { hz: 1060, cx: 560, cb: 1100, H: 870, bw: 130, tw: 78, dX: 878, dY: 1180, kX: 1100, kY: 1450, kS: 1.0 };
  const BG = { x: -1100, y: -800, w: 3300, h: 3600, horizon: (1060 + 800) / 3600, chimneyX: -1, seed: 5, dust: .25 };
  const TIP = [WD.dX - 118.8, WD.dY - 858.1];                 // Daisy'nin bom ucu (s=1, boom 0)
  const ROPE = 455, BALL_R = 58;
  const PIV = [WD.cx - WD.bw / 2, WD.cb - 18];               // devrilme ekseni: taban sol köşe
  const SW0 = 1.15, SWC = -.17, OM = 2 * Math.acos(SWC / SW0) ; // bırakıştan 0,5 sn sonra değme
  const HIT = [WD.cx + 56, 800];

  function ballSw(t) {
    const k = times();
    if (t < k.clonk1) return 0;
    if (t < k.release) return SW0 * E.io(seg(t, k.clonk1, k.clonk1 + 1.3));
    if (t < k.impact) return SW0 * Math.cos(OM * (t - k.release));
    const tau = t - k.impact, v0 = -SW0 * OM * Math.sin(OM * .5) * -.25;
    return Math.exp(-.55 * tau) * (SWC * Math.cos(OM * tau) + v0 / OM * Math.sin(OM * tau));
  }
  function ballPos(sw) { return [TIP[0] + Math.sin(sw) * ROPE, TIP[1] + Math.cos(sw) * ROPE]; }
  function drawBall(ctx, sw) {
    const [bx, by] = ballPos(sw), hk = [TIP[0] + Math.sin(sw) * 404, TIP[1] + Math.cos(sw) * 404];
    C.seed(71);
    C.line(ctx, [hk, [bx - Math.sin(sw) * BALL_R, by - Math.cos(sw) * BALL_R]], 6, P.ink, .2);
    C.line(ctx, [hk, [bx - Math.sin(sw) * BALL_R, by - Math.cos(sw) * BALL_R]], 2.4, P.steelLt, .2);
    C.shape(ctx, C.ell(bx, by, BALL_R, BALL_R, 26), P.steel, { lw: 5, shade: c => { C.blot(c, C.ell(bx + 18, by + 16, BALL_R * .9, BALL_R * .85, 18), P.steelDk, .8); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(bx - 20, by - 22, 14, 8, -.6, 0, TAU); c.fill(); } });
    C.shape(ctx, C.ell(bx - Math.sin(sw) * (BALL_R + 4), by - Math.cos(sw) * (BALL_R + 4), 12, 9, 12), P.steelDk, { lw: 3 });
  }

  // Baca: drawBackground'daki bacanın aynısı, kendi tuvalinde (devrilebilsin diye).
  const CH = { w: 300, h: 1000, cx: 150, cb: 960 };
  function chimneyCv() {
    return cached('baca', CH.w, CH.h, c => {
      const cx = CH.cx, cb = CH.cb, ct = cb - WD.H, bw = WD.bw, tw = WD.tw, lw = 3.4; let n = 0; const R = () => rnd(9000 + n++);
      const lx = (yy, s) => { const u = (cb - yy) / (cb - ct); return cx + s * (bw / 2 + (tw / 2 - bw / 2) * u); };
      C.seed(5);
      C.shape(c, [[cx - bw / 2, cb], [cx - tw / 2, ct], [cx + tw / 2, ct], [cx + bw / 2, cb]], P.brick, {
        lw, shade: g => {
          let row = 0; for (let yy = cb - 13; yy > ct; yy -= 13, row++) {
            const l = lx(yy, -1), r = lx(yy, 1);
            g.strokeStyle = 'rgba(217,194,160,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(l, yy + R() * 1.2); g.lineTo(r, yy + R() * 1.2); g.stroke();
            for (let xx = l + (row % 2 ? 10 : 22); xx < r - 4; xx += 26) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + R() - .5, yy + 13); g.stroke(); if (R() < .09) { g.fillStyle = R() < .5 ? P.brickLt : P.brickDk; g.fillRect(xx + 1, yy + 1, 24, 11); } }
          }
          C.blot(g, [[cx + 6, ct - 10], [cx + 80, ct - 10], [cx + 90, cb + 10], [cx + 14, cb + 10]], P.brickDk, .55);
          const sg = g.createLinearGradient(0, ct, 0, ct + 130); sg.addColorStop(0, 'rgba(58,44,36,.85)'); sg.addColorStop(1, 'rgba(58,44,36,0)'); g.fillStyle = sg; g.fillRect(cx - 80, ct, 160, 130);
        }
      });
      [.32, .7].forEach(u => { const yy = cb - (cb - ct) * u, l = lx(yy, -1) - 6, r = lx(yy, 1) + 6; C.shape(c, [[l, yy - 9], [r, yy - 9], [r, yy + 7], [l, yy + 7]], P.brickDk, { lw: lw * .8 }); });
      C.shape(c, [[cx - tw / 2 - 12, ct + 18], [cx + tw / 2 + 12, ct + 18], [cx + tw / 2 + 8, ct - 6], [cx - tw / 2 - 8, ct - 6]], P.brickDk, { lw });
      C.shape(c, [[cx - tw / 2 - 4, ct - 6], [cx + tw / 2 + 4, ct - 6], [cx + tw / 2, ct - 14], [cx - tw / 2, ct - 14]], P.soot, { lw: lw * .8 });
      C.line(c, [[cx - 14, cb - (cb - ct) * .46], [cx - 6, cb - (cb - ct) * .5], [cx - 12, cb - (cb - ct) * .55], [cx - 2, cb - (cb - ct) * .6]], 2.2, P.ink, .4);
    });
  }
  // Çatlaklar (darbe noktasından tabana), dünya koordinatında, bacayla birlikte döner.
  const CRACK = [[HIT[0] - 4, HIT[1]], [HIT[0] - 22, 838], [HIT[0] - 14, 880], [HIT[0] - 40, 930], [WD.cx - 6, 985], [WD.cx - 30, 1030], [WD.cx - 44, 1080]];
  const CRACK2 = [[HIT[0] - 6, HIT[1] - 6], [HIT[0] - 30, 760], [HIT[0] - 24, 716], [HIT[0] - 50, 676]];
  function crackPart(pts, g) { const n = pts.length - 1, f = g * n, i = Math.floor(f); const out = pts.slice(0, i + 1); if (i < n) out.push([lerp(pts[i][0], pts[i + 1][0], f - i), lerp(pts[i][1], pts[i + 1][1], f - i)]); return out; }

  function fallAngle(t) { const k = times(); return -Math.PI / 2 * E.inQ(seg(t, k.fall, k.ground)); }
  function drawChimney(ctx, t) {
    const k = times(), cv = chimneyCv(), ox = WD.cx - CH.cx, oy = WD.cb - CH.cb;
    if (t < k.ground) {
      ctx.save();
      const a = fallAngle(t);
      // darbe anında baca bir kez titrer (2 kare), sonra 8 kare tutma
      const jolt = (t >= k.impact && t < k.impact + 2 / FPS) ? -.006 : 0;
      ctx.translate(PIV[0], PIV[1]); ctx.rotate(a + jolt); ctx.translate(-PIV[0], -PIV[1]);
      ctx.drawImage(cv, ox, oy);
      if (t >= k.impact) {
        const g = E.outC(seg(t, k.impact, k.fall + .1));
        C.seed(81); C.line(ctx, crackPart(CRACK, g), 4.2, P.ink, .6);
        C.seed(82); C.line(ctx, crackPart(CRACK2, clamp(g * 1.4)), 3.2, P.ink, .5);
        // darbe noktası: kırık tuğlalar (eksik parça)
        C.seed(83); C.shape(ctx, [[HIT[0] + 2, HIT[1] - 30], [HIT[0] - 26, HIT[1] - 16], [HIT[0] - 22, HIT[1] + 18], [HIT[0] + 2, HIT[1] + 30]], P.brickDk, { lw: 3, amp: .8 });
      }
      ctx.restore();
    } else {
      // yerde: üç parçaya ayrılmış, kısa sekme
      const tau = t - k.ground;
      const parts = [[0, 300, 0, 0], [300, 600, -16, 1], [600, 900, -44, 2]];
      parts.forEach(([a0, a1, slide, i]) => {
        const b = Math.exp(-tau * 6) * Math.abs(Math.sin(tau * (13 + i * 3))) * (14 + i * 8), sl = slide * E.outC(clamp(tau / .35));
        ctx.save(); ctx.translate(sl, -b);
        ctx.translate(PIV[0], PIV[1]); ctx.rotate(-Math.PI / 2 + (i - 1) * .012 * E.outC(clamp(tau / .3))); ctx.translate(-PIV[0], -PIV[1]);
        ctx.beginPath(); ctx.rect(ox - 20, WD.cb - a1 - 10, CH.w + 40, a1 - a0 + (i ? 0 : 30)); ctx.clip();
        ctx.drawImage(cv, ox, oy);
        C.seed(81); C.line(ctx, CRACK, 4.2, P.ink, .6);
        ctx.restore();
      });
    }
  }
  function drawPlinth(ctx, t) {
    const k = times(), cx = WD.cx, cb = WD.cb, bw = WD.bw;
    C.seed(55);
    if (t >= k.fall) { // kırık kütük
      C.shape(ctx, [[cx - bw / 2 + 2, cb - 16], [cx - bw / 2 + 4, cb - 52], [cx - 30, cb - 40], [cx - 10, cb - 70], [cx + 14, cb - 46], [cx + 36, cb - 58], [cx + bw / 2 - 4, cb - 34], [cx + bw / 2 - 2, cb - 16]], P.brick, { lw: 3.4, shade: c => C.blot(c, [[cx + 10, cb - 80], [cx + 90, cb - 80], [cx + 90, cb], [cx + 20, cb]], P.brickDk, .55) });
    }
    C.shape(ctx, [[cx - bw / 2 - 22, cb + 4], [cx + bw / 2 + 22, cb + 4], [cx + bw / 2 + 16, cb - 22], [cx - bw / 2 - 16, cb - 22]], P.concrete, { lw: 3.4, shade: c => C.blot(c, [[cx + 10, cb - 30], [cx + 100, cb - 30], [cx + 100, cb + 10], [cx + 20, cb + 10]], P.dustDk, .35) });
  }
  // Boş otopark (bacanın düştüğü taraf) + planlanan yıkım alanını çeviren şeritli direkler.
  function drawLot(ctx) {
    C.seed(61);
    ctx.save(); ctx.globalAlpha = .55;
    for (let i = 0; i < 8; i++) { const x = -720 + i * 150; C.line(ctx, [[x, 1122], [x - 60, 1290]], 7, P.paper, .6); }
    C.line(ctx, [[-760, 1290], [420, 1290]], 7, P.paper, .5);
    ctx.restore();
    for (let i = 0; i < 7; i++) { const x = -690 + i * 150; C.shape(ctx, [[x - 46, 1262], [x + 30, 1262], [x + 28, 1276], [x - 48, 1276]], P.concrete, { lw: 2.6, amp: .5 }); }
    // P tabelası
    C.line(ctx, [[-560, 1110], [-560, 960]], 6, P.steelDk, .3);
    C.shape(ctx, [[-604, 900], [-516, 900], [-516, 980], [-604, 980]], P.paper, { lw: 3.4 });
    ctx.save(); ctx.font = '700 64px Rubik'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.fillText('P', -560, 964); ctx.restore();
  }
  const RING = { cx: 560, cy: 1112, rx: 250, ry: 42, n: 9 };
  function ringPt(i) { const a = Math.PI + i / RING.n * TAU; return [RING.cx + Math.cos(a) * RING.rx, RING.cy + Math.sin(a) * RING.ry]; }
  function drawRing(ctx, t, front) {
    const k = times(), broken = t >= k.ground;
    for (let i = 0; i < RING.n; i++) {
      const a = ringPt(i), b = ringPt(i + 1), mid = (a[1] + b[1]) / 2;
      if ((mid > RING.cy) !== front) continue;
      C.seed(300 + i);
      if (broken && !front && i === 0) { // devrilen baca şeridi kopardı: sarkan iki uç
        C.line(ctx, [[a[0], a[1] - 46], [a[0] + 30, a[1] - 20], [a[0] + 36, a[1] - 4]], 5, P.hazardDeep, .5);
        C.line(ctx, [[b[0], b[1] - 46], [b[0] - 26, b[1] - 18]], 5, P.hazardDeep, .5);
      } else {
        const sag = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 38;
        C.line(ctx, [[a[0], a[1] - 46], [sag, my], [b[0], b[1] - 46]], 6, P.ink, .3);
        C.line(ctx, [[a[0], a[1] - 46], [sag, my], [b[0], b[1] - 46]], 3.4, P.hazard, .3);
      }
    }
    for (let i = 0; i < RING.n; i++) {
      const a = ringPt(i); if ((a[1] > RING.cy + 1) !== front) continue;
      C.seed(400 + i);
      const p = C.shape(ctx, [[a[0] - 6, a[1]], [a[0] - 5, a[1] - 54], [a[0] + 5, a[1] - 54], [a[0] + 6, a[1]]], null, { lw: 0 });
      C.hazardStripes(ctx, p, a[0] - 8, a[1] - 56, 16, 58, 7); C.ink(ctx, p, 3);
    }
  }

  /* ---- parçacıklar: tuğla ve toz (tohumlu, tamamen zamandan) ---- */
  const GRAV = 2200;
  function brickSet(ctx, tau, n, sb, spawn, size, groundY) {
    if (tau < 0) return;
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 1000 + i * 13 + j), s = spawn(i, r), gy = (groundY || WD.cb) + 6 + r(9) * 120;
      const vy = s.vy, A = .5 * GRAV, disc = vy * vy + 4 * A * Math.max(0, gy - s.y), tl = (-vy + Math.sqrt(disc)) / (2 * A);
      const tt = Math.min(tau, tl), x = s.x + s.vx * tt + (tau > tl ? s.vx * .08 * (1 - Math.exp(-(tau - tl) * 8)) : 0), y = s.y + vy * tt + A * tt * tt;
      const sz = (size || 1) * (8 + r(5) * 14), rot = r(6) * 6 + (r(7) - .5) * 18 * tt;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); C.seed(sb * 50 + i);
      C.shape(ctx, [[-sz, -sz * .5], [sz * .9, -sz * .55], [sz, sz * .45], [-sz * .8, sz * .5]], [P.brick, P.brickDk, P.brickLt, P.concrete][i % 4], { lw: 2.6, amp: .5 });
      ctx.restore();
    }
  }
  // Toz bulutu: kendi tuvaline mürekkep konturu + koyu gölge + açık yüz olarak çizilir, sonra bir bütün olarak saydamlaşır.
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
    d.fillStyle = P.ink; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x, y, r + 6, 0, TAU); d.fill(); });
    d.fillStyle = P.dust; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill(); });
    d.fillStyle = P.dustLt; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x - r * .16, y - r * .2, r * .8, 0, TAU); d.fill(); });
    d.fillStyle = 'rgba(241,232,212,.5)'; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x - r * .3, y - r * .38, r * .38, 0, TAU); d.fill(); });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(dustCv, 0, 0); ctx.restore();
  }
  function impactFx(ctx, t) {
    const k = times(), tau = t - k.impact; if (tau < 0) return;
    brickSet(ctx, tau, 22, 7, (i, r) => ({ x: HIT[0] - r(1) * 20, y: HIT[1] + (r(2) - .5) * 50, vx: -150 - r(3) * 520, vy: -420 + r(4) * 380 }), .9);
    dustCloud(ctx, tau, 20, 8, (i, r) => ({ x: HIT[0] - 10 - r(1) * 30, y: HIT[1] + (r(2) - .5) * 60, r: 10 + r(3) * 24, vx: -80 - r(4) * 320, rise: -30 + r(5) * 110, grow: .25, delay: r(6) * .05, sink: 30 }), clamp(1.15 - tau / 1.1), 1.2);
  }
  function groundFx(ctx, t, alphaMul) {
    const k = times(), tau = t - k.ground; if (tau < -.6) return;
    // düşerken tepeden kopan birkaç tuğla
    const tf = t - k.fall;
    if (tf > 0) brickSet(ctx, tf - .35, 10, 11, (i, r) => { const a = fallAngle(k.fall + .35 + r(1) * .3), d = 420 + r(2) * 420; return { x: PIV[0] + d * Math.sin(a), y: PIV[1] - d * Math.cos(a), vx: -120 - r(3) * 200, vy: -60 + r(4) * 120 }; }, .8);
    if (tau < 0) return;
    brickSet(ctx, tau, 46, 12, (i, r) => { const along = r(1); return { x: PIV[0] - 40 - along * 860, y: WD.cb - 40 - r(2) * 60, vx: (r(3) - .5) * 520 - 80, vy: -300 - r(4) * 700 * (1 - along * .4) }; }, 1);
    const a = (alphaMul == null ? 1 : alphaMul) * (tau < 3 ? 1 : clamp(1 - (tau - 3) / 5, .25, 1));
    dustCloud(ctx, tau, 56, 13, (i, r) => { const along = r(1); return { x: PIV[0] + 40 - along * 960, y: WD.cb - 30 - r(2) * 40, r: 40 + r(3) * r(3) * 150 + (1 - along) * 20, vx: (r(4) - .5) * 220 - 60 * along, rise: 60 + r(5) * r(5) * 520, grow: 1.0 + r(6) * .5, delay: along * .12 + r(7) * .08, sink: 26 }; }, a, 9);
  }
  function airDust(ctx, t, n, sb, box, a) { // havada asılı, yavaş sürüklenen zerreler (birerli)
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(216,202,176,${a * (.3 + r(5) * .5)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 4, 0, TAU); ctx.fill();
    }
  }

  function daisyState(t) {
    const k = times(); const b = beepAt(t, k.beep);
    return { beep: b.v, mood: (t >= k.beep + TONES[0][0] && t < k.push) ? 'alert' : 'sleepy' };
  }
  // Bütün arsa, verilen zamanda.
  function drawWorld(ctx, t, o) {
    o = o || {}; const k = times();
    C.drawBackground(ctx, BG);
    drawLot(ctx);
    drawRing(ctx, t, false);
    drawChimney(ctx, t);
    drawPlinth(ctx, t);
    drawRing(ctx, t, true);
    if (!o.noBall) drawBall(ctx, ballSw(t));
    if (!o.noDaisy) { const ds = daisyState(t); C.drawDaisy(ctx, { x: WD.dX, y: WD.dY, s: 1, seed: 23, hook: ballSw(t), beep: ds.beep, mood: ds.mood }); }
    if (!o.noFx) { impactFx(ctx, t); groundFx(ctx, t, o.dustMul); }
    if (o.kaan) C.drawKaan(ctx, Object.assign({ x: WD.kX, y: WD.kY, s: WD.kS, seed: 11 }, o.kaan));
  }
  // Bulanık arka plan (yakın planlar için), bir kez çizilip saklanır.
  function blurredWorld(key, t, z, cx, cy, blur, o) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      cam(g, z, cx, cy); drawWorld(g, t, Object.assign({ noFx: true }, o || {}));
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
  }
  function drawBlurBg(ctx, cv, z) { z = z || 1; ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.drawImage(cv, -540, -960); ctx.restore(); }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 13: gece odası, yüz telefonun ışığında --- */
  function drawRoom(ctx, t, k) {
    ctx.fillStyle = P.night2; ctx.fillRect(-200, -200, 1480, 2320);
    C.seed(141);
    for (let x = -100; x < 1200; x += 90) { ctx.fillStyle = 'rgba(7,11,24,.25)'; ctx.fillRect(x, -200, 40, 2400); }
    // pencere: gece, ay, uzak şehir
    const wp = C.shape(ctx, [[60, 250], [420, 250], [420, 760], [60, 760]], P.night, { lw: 6 });
    ctx.save(); ctx.clip(wp);
    const sg = ctx.createLinearGradient(0, 250, 0, 760); sg.addColorStop(0, '#03050c'); sg.addColorStop(1, '#1d2742'); ctx.fillStyle = sg; ctx.fillRect(60, 250, 360, 510);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(238,242,255,${.3 + rnd(500 + i) * .6})`; ctx.fillRect(70 + rnd(600 + i) * 340, 260 + rnd(700 + i) * 300, 2.5, 2.5); }
    ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(330, 340, 34, 0, TAU); ctx.fill(); ctx.fillStyle = '#03050c'; ctx.beginPath(); ctx.arc(345, 332, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = '#161d2b'; for (let x = 60; x < 420; x += 44) { const h = 60 + rnd(x) * 130; ctx.fillRect(x, 760 - h, 40, h); for (let y = 770 - h; y < 750; y += 22) if (rnd(x * 7 + y) < .3) { ctx.fillStyle = 'rgba(255,210,122,.75)'; ctx.fillRect(x + 8, y, 7, 9); ctx.fillStyle = '#161d2b'; } }
    ctx.restore();
    C.line(ctx, [[240, 250], [240, 760]], 6); C.line(ctx, [[60, 505], [420, 505]], 6);
    C.shape(ctx, [[40, 760], [440, 760], [446, 790], [34, 790]], P.wood, { lw: 5 });
    // raf + kutular
    C.shape(ctx, [[640, 420], [1020, 420], [1020, 440], [640, 440]], P.wood, { lw: 4 });
    C.shape(ctx, [[670, 330], [760, 330], [760, 420], [670, 420]], '#3a3d45', { lw: 4 });
    C.shape(ctx, [[790, 360], [900, 360], [900, 420], [790, 420]], P.brickDk, { lw: 4 });
    // yatak başlığı + yastık
    C.shape(ctx, [[150, 980], [960, 980], [960, 1900], [150, 1900]], P.wood, { lw: 6, shade: c => C.blot(c, [[700, 960], [1000, 960], [1000, 1900], [740, 1900]], P.ink, .3) });
    C.shape(ctx, [[220, 1010], [880, 1000], [900, 1240], [200, 1250]], P.paperDk, { lw: 5, shade: c => C.blot(c, [[600, 1000], [920, 1000], [920, 1260], [640, 1260]], '#8f8775', .5) });
  }
  function drawBlanket(ctx, y0) {
    C.seed(152);
    C.shape(ctx, [[-40, y0 + 20], [300, y0 - 10], [620, y0 + 30], [1120, y0 - 6], [1120, 2000], [-40, 2000]], '#3b2a3a', {
      lw: 6, shade: c => { C.blot(c, [[700, y0 - 20], [1130, y0 - 20], [1130, 2000], [760, 2000]], P.ink, .3); for (let i = 0; i < 5; i++) C.line(c, [[100 + i * 210, y0 + 80], [160 + i * 200, y0 + 400]], 3, 'rgba(7,11,24,.6)', 2); }
    });
  }
  function kaanPhoneScreen(ctx, x, y, s, sec) { // Kaan'ın elindeki telefonun ekranına gerçek oyun karesi
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(92, -236); ctx.rotate(-.22);
    ctx.beginPath(); ctx.rect(-9.5, -24.5, 19, 40); ctx.clip(); ctx.drawImage(gameFrame(TB.t), -11, -24.5, 22.5, 40); ctx.restore();
  }
  let darkCv = null;
  function nightLight(ctx, holes, a) {
    if (!darkCv) darkCv = canvas(1080, 1920);
    const d = darkCv.getContext('2d'); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, 1080, 1920);
    d.fillStyle = `rgba(4,6,16,${a})`; d.fillRect(0, 0, 1080, 1920); d.globalCompositeOperation = 'destination-out';
    holes.forEach(([x, y, r, s]) => { const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(.5, `rgba(0,0,0,${s * .55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(0, 0, 1080, 1920); });
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkCv, 0, 0);
  }
  shot('b13-gece', k => k.start, k => k.phone, (ctx, t, u, tl) => {
    const k = times(), z = lerp(1, 1.07, E.io(u)), s = 2.5, kx = 500, ky = 1880;
    ctx.save(); cam(ctx, z, 560, 900);
    drawRoom(ctx, t, k);
    const blink = (t > k.start + .9 && t < k.start + .9 + 3 / FPS) ? 1 : 0;
    C.drawKaan(ctx, { x: kx, y: ky, s, seed: 11, expr: 'calm', look: .5, blink });
    kaanPhoneScreen(ctx, kx, ky, s);
    drawBlanket(ctx, ky - 200 * s + 10);
    const m = ctx.getTransform(); ctx.restore();
    // karanlık + telefon ışığı (ekran kareye göre hafifçe titrer)
    const pX = m.a * (kx + 92 * s) + m.e, pY = m.d * (ky - 236 * s) + m.f, fX = m.a * (kx + 6 * s) + m.e, fY = m.d * (ky - 460 * s) + m.f, br = frameBright(t);
    nightLight(ctx, [[pX, pY, 420, .95], [fX, fY, 420, .8 * br], [240, 500, 420, .45]], .8);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(pX, pY, 10, pX, pY, 420); g.addColorStop(0, `rgba(255,226,122,${.32 * br})`); g.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    const g2 = ctx.createRadialGradient(fX, fY + 40, 10, fX, fY + 40, 220); g2.addColorStop(0, `rgba(255,226,122,${.14 * br})`); g2.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, 1080, 1920);
    ctx.restore();
    finish(ctx);
  });

  /* --- 13–14: telefona yakın plan, ekranda gerçek oyun --- */
  function drawHandSide(ctx, x, y, flip, lw) { // telefonu tutan el (yandan, parmaklar arkada)
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], P.jacketDk, { lw });
    C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], P.skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], P.skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, P.skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, P.skinDk);
    ctx.restore();
  }
  shot('b13-telefon', k => k.phone, k => k.cut15, (ctx, t, u, tl) => {
    const k = times(), z = 1.3 * lerp(.97, 1.03, E.io(u)), br = frameBright(t);
    // oda: karanlık, bulanık
    ctx.fillStyle = '#070b18'; ctx.fillRect(0, 0, 1080, 1920);
    const bg = cached('telefon-bg', 1080, 1920, c => {
      c.fillStyle = '#0c1226'; c.fillRect(0, 0, 1080, 1920);
      [[160, 380, 120, 'rgba(255,210,122,.16)'], [920, 300, 90, 'rgba(238,242,255,.12)'], [120, 1500, 160, 'rgba(255,210,122,.08)'], [980, 1200, 130, 'rgba(120,150,220,.1)'], [300, 200, 60, 'rgba(255,210,122,.2)']].forEach(([x, y, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    });
    ctx.drawImage(bg, 0, 0);
    // hale
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(540, 700, 200, 540, 700, 760); hg.addColorStop(0, `rgba(255,226,122,${.34 * br})`); hg.addColorStop(.5, `rgba(255,190,110,${.12 * br})`); hg.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .55);
    // telefon (eğik), eller ikişerli titrer
    const tw = twos(t), jx = Math.sin(tw * 2.1) * 3, jy = Math.sin(tw * 1.3 + 1) * 3, rot = -.07 + Math.sin(tw * .8) * .006;
    ctx.save(); ctx.translate(540 + jx, 770 + jy); ctx.rotate(rot * .6); ctx.transform(1, 0, -.035, 1, 0, 0); ctx.scale(z, z);
    const SW = 486, SH = 864, BWd = 548, BHt = 1000;
    drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6);
    C.seed(171); C.shape(ctx, rrectPts(-BWd / 2, -BHt / 2, BWd, BHt, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BWd / 2, -BHt / 2, 30, BHt); } });
    C.shape(ctx, [[-60, -BHt / 2 + 24], [60, -BHt / 2 + 24], [60, -BHt / 2 + 36], [-60, -BHt / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SW / 2, -SH / 2, SW, SH, 34); ctx.clip();
    ctx.drawImage(gameFrame(t), -SW / 2, -SH / 2, SW, SH);
    // cam yansıması
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SW / 2, -SH / 2 + 80); ctx.lineTo(-SW / 2 + 220, -SH / 2); ctx.lineTo(-SW / 2 + 300, -SH / 2); ctx.lineTo(-SW / 2, -SH / 2 + 180); ctx.fill();
    // dokunma halkası ("try again": tekrar)
    const tapT = k.tap, rd = t - tapT, TP = [0, (505 / 800 - .5) * SH];   // "Try again" düğmesi (kare 116–131, y≈505)
    if (rd >= 0 && rd < .4) { ctx.strokeStyle = `rgba(255,255,255,${.9 * (1 - rd / .4)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(TP[0], TP[1], 20 + rd * 220, 0, TAU); ctx.stroke(); }
    ctx.restore();
    C.ink(ctx, (() => { const p = new Path2D(); const q = C.wobble(rrectPts(-SW / 2, -SH / 2, SW, SH, 34, 6), true, .5); p.moveTo(q[0][0], q[0][1]); q.forEach(v => p.lineTo(v[0], v[1])); p.closePath(); return p; })(), 4);
    // sağ başparmak: dokunmaya gelir, geri çekilir
    const th = ones(t), inU = E.outC(seg(th, k.tap - .3, k.tap)), outU = E.inQ(seg(th, k.tap + .2, k.tap + .45)), tu = inU * (1 - outU);
    const tx = lerp(330, TP[0] + 30, tu), ty = lerp(560, TP[1] + 50, tu);
    drawHandSide(ctx, BWd / 2 - 10, 0, true, 6);
    C.seed(172);
    C.shape(ctx, [[BWd / 2 + 60, 380], [tx + 50, ty - 30], [tx + 10, ty - 50], [tx - 30, ty - 30], [tx - 20, ty + 20], [BWd / 2 + 20, 470]], P.skin, { lw: 6, shade: c => C.blot(c, [[tx - 10, ty + 5], [BWd / 2 + 80, 420], [BWd / 2 + 80, 520], [tx, ty + 60]], P.skinDk, .5) });
    C.shape(ctx, [[tx - 22, ty - 34], [tx + 6, ty - 46], [tx + 18, ty - 24], [tx - 8, ty - 14]], '#e7b896', { lw: 3 });
    ctx.restore();
    finish(ctx);
  });

  /* --- 15: sert kesme, gündüz, sessiz arsa --- */
  shot('b15-arsa', k => k.cut15, k => k.lever, (ctx, t, u, tl) => {
    const z = lerp(.8, .815, u);
    ctx.save(); cam(ctx, z, 640, 760);
    drawWorld(ctx, t, { kaan: { expr: 'calm', look: -.6, phone: true } });
    airDust(ctx, t, 26, 3, [-100, 700, 1400, 500], .7);
    ctx.restore();
    finish(ctx);
  });

  /* --- 16 ve 19: kol, yakın plan (Daisy'nin yan paneli) --- */
  function leverAngle(t) {
    const k = times();
    let a = .42;
    // ilk çekiş: 6 kare ileri itme (beklenti), hızlı geri çekiş, küçük taşma, yerine oturma
    a += .1 * E.outC(seg(t, k.ant1, k.ant1 + .2)) * (1 - seg(t, k.clonk1 - .14, k.clonk1));
    a = lerp(a, -.32, E.inQ(seg(t, k.clonk1 - .14, k.clonk1)));
    if (t >= k.clonk1) a = -.32 - .07 * Math.sin(Math.PI * seg(t, k.clonk1, k.clonk1 + .16));
    // ikinci çekiş: sonuna kadar
    if (t >= k.insert) {
      const ant = .06 * Math.sin(Math.PI * seg(t, k.insert, k.clonk2 - .08));
      a = -.32 + ant - .52 * E.inQ(seg(t, k.clonk2 - .08, k.clonk2));
      if (t >= k.clonk2) a = -.84 - .05 * Math.sin(Math.PI * seg(t, k.clonk2, k.clonk2 + .13));
    }
    return a;
  }
  function drawLeverPanel(ctx, t) {
    C.seed(201);
    ctx.fillStyle = P.dSide; ctx.fillRect(-100, -100, 1280, 2120);
    C.blot(ctx, [[-100, 1450], [1200, 1420], [1200, 2100], [-100, 2100]], P.dShade, .8);
    C.blot(ctx, [[60, 200], [260, 170], [320, 330], [120, 380]], P.rust, .35);
    C.blot(ctx, [[820, 1250], [1000, 1230], [1040, 1380], [860, 1400]], P.rust, .4);
    C.line(ctx, [[-100, 160], [1200, 140]], 5); C.line(ctx, [[-100, 1420], [1200, 1400]], 5);
    for (let x = 60; x < 1080; x += 160) { [190, 1380].forEach(y => { C.shape(ctx, C.ell(x, y, 9, 9, 10), P.dShade, { lw: 3 }); }); }
    const hz = C.shape(ctx, [[-100, 1470], [1200, 1450], [1200, 1560], [-100, 1580]], null, { lw: 0 }); C.hazardStripes(ctx, hz, -110, 1440, 1320, 150, 46); C.ink(ctx, hz, 5);
    // kumanda kutusu
    C.shape(ctx, [[300, 420], [780, 410], [790, 1230], [290, 1240]], P.steelDk, { lw: 6, shade: c => C.blot(c, [[640, 400], [820, 400], [820, 1260], [660, 1260]], '#000', .3) });
    C.shape(ctx, [[340, 470], [740, 462], [748, 520], [344, 528]], P.steel, { lw: 4 });
    // kol yuvası ve çentikler
    C.shape(ctx, [[520, 700], [560, 700], [566, 1180], [516, 1180]], '#0b0c10', { lw: 4 });
    // gösterge
    C.shape(ctx, C.ell(400, 620, 44, 44, 22), P.paper, { lw: 4 }); C.line(ctx, [[400, 620], [430, 594]], 4);
  }
  function drawLeverAndHand(ctx, t, a) {
    const pv = [540, 1120], L = 640, KX = pv[0] + Math.sin(a) * L, KY = pv[1] - Math.cos(a) * L;
    C.seed(211);
    C.line(ctx, [pv, [KX, KY]], 30); C.line(ctx, [pv, [KX, KY]], 16, P.steelLt, .2);
    C.shape(ctx, C.ell(pv[0], pv[1], 46, 30, 18), P.steel, { lw: 5 });
    // el: topuzu kavrayan yumruk, kol sağ alttan gelir
    const ex = KX + 620, ey = KY + 900;
    C.seed(212);
    C.shape(ctx, [[KX + 40, KY - 50], [ex + 260, ey - 200], [ex - 40, ey + 160], [KX - 40, KY + 70]], P.jacket, { lw: 7, shade: c => C.blot(c, [[KX + 40, KY + 40], [ex + 200, ey - 40], [ex + 200, ey + 200], [KX, KY + 90]], P.jacketDk, .6) });
    C.shape(ctx, [[KX + 50, KY - 30], [KX + 120, KY + 30], [KX + 70, KY + 110], [KX - 4, KY + 60]], P.hazard, { lw: 6 });
    C.shape(ctx, C.ell(KX, KY, 50, 50, 22), '#1d1f24', { lw: 6 });
    C.shape(ctx, [[KX - 78, KY - 46], [KX + 40, KY - 70], [KX + 70, KY + 10], [KX + 30, KY + 70], [KX - 70, KY + 60], [KX - 96, KY + 6]], P.skin, { lw: 7, shade: c => C.blot(c, [[KX + 10, KY - 80], [KX + 90, KY - 80], [KX + 90, KY + 90], [KX + 20, KY + 90]], P.skinDk, .5) });
    for (let i = 0; i < 3; i++) C.line(ctx, [[KX - 92 + i * 4, KY - 18 + i * 26], [KX - 50 + i * 4, KY - 14 + i * 26]], 4.5);
    C.shape(ctx, [[KX - 60, KY - 58], [KX + 30, KY - 82], [KX + 44, KY - 60], [KX - 46, KY - 34]], '#d79a6c', { lw: 5 });
  }
  shot('b16-kol', k => k.lever, k => k.daisy, (ctx, t, u, tl) => {
    const k = times(), z = lerp(1, 1.05, u);
    // kol yerine oturunca kamera 2 kare sarsılmaz; sadece panel bir piksel titrer (ağırlık)
    ctx.save(); cam(ctx, z * 1.35, 560, 760);
    drawLeverPanel(ctx, t); drawLeverAndHand(ctx, t, leverAngle(twos(t)));
    ctx.restore();
    finish(ctx);
  });

  /* --- 17–18: Daisy, iki bip (bipte hiçbir şey kıpırdamaz) --- */
  const DAISY_CU = { z0: 1.86, z1: 2.04, fx: 0, fy: -230, sx: 470, sy: 820 };
  function drawDaisyCU(ctx, t, z, beepV, mood, bgKey, bgT) {
    const bg = bgKey === 'post' ? blurredWorld('bg-daisy-post', bgT, 1.15, 640, 800, 7, { noDaisy: true, noBall: true }) : blurredWorld('bg-daisy-pre', bgT, 1.15, 1250, 800, 7, { noDaisy: true, noBall: true });
    drawBlurBg(ctx, bg, 1 + (z - 1.8) * .06);
    ctx.save(); cam(ctx, z, DAISY_CU.fx, DAISY_CU.fy, DAISY_CU.sx, DAISY_CU.sy);
    C.drawDaisy(ctx, { x: 0, y: 0, s: 1, seed: 23, beep: beepV, mood, hook: SW0 });
    ctx.restore();
  }
  function frozen(t) { const k = times(); return t >= k.freeze0 && t < k.freeze1 ? k.freeze0 : t; }
  shot('b17-bip', k => k.daisy, k => k.shrug, (ctx, t, u, tl) => {
    const k = times(), tf = frozen(t);
    const zu = tf < k.freeze0 ? E.outC(seg(tf, k.daisy, k.freeze0)) : 1;
    let z = lerp(DAISY_CU.z0, DAISY_CU.z1, zu) + (t >= k.freeze1 ? .05 * E.io(seg(t, k.freeze1, k.shrug)) : 0);
    // rölantide kabin ikişerli titrer; donmada durur
    const idle = tf === t && t < k.freeze0 ? Math.sin(twos(t) * 40) * 1.2 : 0;
    const b = beepAt(t, k.beep);
    ctx.save(); ctx.translate(0, idle);
    drawDaisyCU(ctx, t, z, b.v, b.after ? 'alert' : 'sleepy', 'pre', k.daisy);
    ctx.restore();
    finish(ctx);
  });

  /* --- 19: Kaan omuz silker --- */
  function drawKaanSplit(ctx, o, headRot, rise) { // baş ayrı döner (boyun ekseni), gövde yükselir; ayaklar kadraj dışında
    const s = o.s, neckY = o.y - 422 * s - rise;
    ctx.save(); ctx.beginPath(); ctx.rect(-200, neckY, 1480, 2400); ctx.clip(); C.drawKaan(ctx, Object.assign({}, o, { y: o.y - rise })); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-200, -400, 1480, neckY + 400 + 1.5); ctx.clip();
    ctx.translate(o.x + 2 * s, neckY); ctx.rotate(headRot); ctx.translate(-(o.x + 2 * s), -neckY);
    C.drawKaan(ctx, Object.assign({}, o, { y: o.y - rise })); ctx.restore();
  }
  shot('b19-omuz', k => k.shrug, k => k.insert, (ctx, t, u, tl) => {
    const k = times(), tw = twos(t);
    const bg = blurredWorld('bg-kaan-pre', k.shrug, .9, 560, 640, 6, { noBall: true });
    drawBlurBg(ctx, bg, 1 + u * .02);
    const dip = Math.sin(Math.PI * seg(tw, k.shrugUp - .14, k.shrugUp)) * -10;
    const up = E.outBack(seg(tw, k.shrugUp, k.shrugUp + .14)) * 42;
    const rise = dip + up, headRot = -.13 * E.outC(seg(tw, k.shrugUp, k.shrugUp + .14));
    const look = tw >= k.shrugUp ? .8 : -.2;
    ctx.save(); cam(ctx, lerp(1, 1.03, u), 540, 960);
    drawKaanSplit(ctx, { x: 500, y: 2250, s: 3.4, seed: 11, expr: 'calm', look, blink: 0 }, headRot, rise);
    ctx.restore();
    finish(ctx);
  });
  shot('b19-kol', k => k.insert, k => k.release, (ctx, t, u, tl) => {
    ctx.save(); cam(ctx, 1.5, 520, 760);
    drawLeverPanel(ctx, t); drawLeverAndHand(ctx, t, leverAngle(ones(t)));
    ctx.restore();
    finish(ctx);
  });

  /* --- 20: top vurur, baca yanlış yöne devrilir --- */
  function shake(ctx, t) {
    const k = times(), f = Math.floor((t - k.impact) * FPS + 1e-6);
    if (f >= 0 && f < 6) { const a = 26 * (1 - f / 6); ctx.translate((rnd(900 + f) - .5) * 2 * a, (rnd(950 + f) - .5) * 2 * a); }
  }
  shot('b20-darbe', k => k.release, k => k.fall, (ctx, t, u, tl) => {
    const k = times(), cu = E.io(seg(t, k.release, k.impact));
    ctx.save(); shake(ctx, t);
    cam(ctx, lerp(1.12, 1.3, cu), lerp(780, 660, cu), lerp(700, 790, cu));
    drawWorld(ctx, t, {});
    ctx.restore();
    finish(ctx);
  });
  shot('b20-devrilme', k => k.fall, k => k.wide, (ctx, t, u, tl) => {
    const k = times(), cu = E.io(seg(t, k.fall, k.ground + .3));
    ctx.save(); cam(ctx, lerp(.98, .78, cu), lerp(520, 250, cu), lerp(780, 880, cu));
    drawWorld(ctx, t, {});
    ctx.restore();
    finish(ctx);
  });

  /* --- 21: geniş plan, toz iner, kimse yok --- */
  shot('b21-genis', k => k.wide, k => k.kaan, (ctx, t, u, tl) => {
    const z = lerp(.62, .64, E.io(u)), tw = twos(t);
    ctx.save(); cam(ctx, z, 480, 900);
    drawWorld(ctx, t, { kaan: { expr: 'worried', look: -.8, phone: true, blink: 0 } });
    airDust(ctx, t, 50, 4, [-500, 500, 1900, 800], .9);
    ctx.restore();
    void tw;
    finish(ctx);
  });

  /* --- 22: Kaan toz içinde ("that's called luck": küçük gülümseme) --- */
  shot('b22-kaan', k => k.kaan, k => k.rubble, (ctx, t, u, tl) => {
    const k = times(), tw = twos(t);
    const bg = blurredWorld('bg-kaan-post', k.ground + 4, .85, 250, 760, 7, {});
    drawBlurBg(ctx, bg, 1 + u * .03);
    // asılı toz perdesi
    ctx.fillStyle = `rgba(216,202,176,${.28 - .1 * u})`; ctx.fillRect(0, 0, 1080, 1920);
    airDust(ctx, t, 40, 5, [-100, 300, 1300, 1200], .9);
    const look = tw < k.kaan + .9 ? -.7 : 0, expr = tw >= k.luck ? 'calm' : 'worried';
    const blink = (tw >= k.kaan + .9 && tw < k.kaan + .9 + 3 / FPS) || (tw >= k.luck + .5 && tw < k.luck + .5 + 3 / FPS) ? 1 : 0;
    ctx.save(); cam(ctx, lerp(1, 1.05, E.io(u)), 540, 900);
    C.drawKaan(ctx, { x: 520, y: 2180, s: 3.2, seed: 11, expr, look, blink, phone: true });
    ctx.restore();
    airDust(ctx, t * 1.4, 18, 6, [-100, 200, 1300, 1400], 1);
    finish(ctx);
  });

  /* --- 23–25: moloz, el tozu siler, H K damgası --- */
  const STONE = { x: 560, y: 760, w: 330, h: 190, rot: -.05 };
  function drawRubble(ctx) {
    const cv = cached('moloz', 1400, 2200, c => {
      c.translate(160, 140);
      const g = c.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, P.groundLt); g.addColorStop(1, P.groundDk); c.fillStyle = g; c.fillRect(-200, -200, 1500, 2400);
      for (let i = 0; i < 40; i++) C.blot(c, C.ell(rnd(i) * 1080, rnd(i + 50) * 1920, 60 + rnd(i + 90) * 100, 18 + rnd(i + 130) * 20, 12), i % 2 ? P.groundDk : P.dustLt, .3);
      for (let i = 0; i < 64; i++) {
        const x = -60 + rnd(1000 + i) * 1200, y = -60 + rnd(2000 + i) * 2050;
        if (Math.abs(x - STONE.x) < STONE.w * .62 && Math.abs(y - STONE.y) < STONE.h * .7) continue;
        const w = 90 + rnd(3000 + i) * 60, h = 44 + rnd(4000 + i) * 16, r = (rnd(5000 + i) - .5) * 1.6;
        c.save(); c.translate(x, y); c.rotate(r); C.seed(600 + i);
        C.shape(c, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], [P.brick, P.brickDk, P.brickLt][i % 3], { lw: 4.4, shade: cc => { C.blot(cc, [[-w / 2, h * .1], [w / 2, h * .1], [w / 2, h], [-w / 2, h]], P.brickDk, .55); cc.fillStyle = 'rgba(216,202,176,.45)'; cc.fillRect(-w / 2, -h / 2, w * rnd(i) , h * .3); } });
        c.restore();
      }
      // köşe taşı
      c.save(); c.translate(STONE.x, STONE.y); c.rotate(STONE.rot); C.seed(700);
      C.shape(c, [[-STONE.w / 2, -STONE.h / 2], [STONE.w / 2, -STONE.h / 2 + 4], [STONE.w / 2 + 4, STONE.h / 2], [-STONE.w / 2 - 2, STONE.h / 2 - 2]], '#c9b892', {
        lw: 5, shade: cc => { C.blot(cc, [[-STONE.w / 2, STONE.h * .28], [STONE.w / 2 + 10, STONE.h * .24], [STONE.w / 2 + 10, STONE.h], [-STONE.w / 2, STONE.h]], '#a08f6c', .7); for (let i = 0; i < 30; i++) { cc.fillStyle = 'rgba(110,100,87,.35)'; cc.beginPath(); cc.arc((rnd(800 + i) - .5) * STONE.w, (rnd(900 + i) - .5) * STONE.h, 1 + rnd(950 + i) * 3, 0, TAU); cc.fill(); } }
      });
      // kabartma damga: çerçeve + H K
      C.line(c, [[-118, -62], [118, -60], [118, 58], [-118, 56], [-118, -62]], 3, 'rgba(21,18,13,.55)', .6);
      c.font = '700 112px Rubik'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#8a7a5a'; c.fillText('H  K', 5, 7);          // gölge (sağ alt)
      c.fillStyle = '#f2e6c8'; c.fillText('H  K', -3, -3);        // ışık (sol üst)
      c.fillStyle = '#d6c6a0'; c.fillText('H  K', 0, 0);
      c.lineWidth = 2.4; c.strokeStyle = 'rgba(21,18,13,.6)'; c.strokeText('H  K', 0, 0);
      c.restore();
      // tozu üstte, dağınık açık lekeler
      for (let i = 0; i < 60; i++) C.blot(c, C.ell(rnd(7000 + i) * 1080, rnd(7100 + i) * 1920, 20 + rnd(7200 + i) * 40, 10 + rnd(7300 + i) * 12, 10), P.dustLt, .35);
    });
    ctx.drawImage(cv, -160, -140);
  }
  // Taşın üstündeki toz: küçük lekeler; el geçtikçe eşik altına düşenler kaybolur (bölge: H sol, K sağ).
  function stoneDust(ctx, cleanH, cleanK) {
    ctx.save(); ctx.translate(STONE.x, STONE.y); ctx.rotate(STONE.rot);
    ctx.beginPath(); ctx.rect(-STONE.w / 2 - 4, -STONE.h / 2 - 4, STONE.w + 8, STONE.h + 8); ctx.clip();
    for (let i = 0; i < 150; i++) {
      const x = (rnd(8000 + i) - .5) * STONE.w, y = (rnd(8100 + i) - .5) * STONE.h, th = rnd(8200 + i) * .95 + .02;
      const cl = x < 0 ? cleanH : cleanK; if (cl > th) continue;
      ctx.fillStyle = i % 3 ? 'rgba(216,202,176,.92)' : 'rgba(152,140,122,.85)';
      ctx.beginPath(); ctx.ellipse(x, y, 20 + rnd(8300 + i) * 26, 12 + rnd(8400 + i) * 12, rnd(8500 + i) * 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawFlatHand(ctx, x, y, rot, curl) { // üstten el (parmaklar sol yukarı), kol sağ alttan
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); C.seed(231);
    C.shape(ctx, [[60, 30], [700, 360], [760, 120], [130, -60]], P.jacket, { lw: 7, shade: c => C.blot(c, [[60, 40], [760, 380], [780, 180], [100, 30]], P.jacketDk, .55) });
    C.shape(ctx, [[70, -40], [140, -20], [100, 70], [40, 40]], P.hazard, { lw: 6 });
    const fl = 1 - (curl || 0) * .35;
    C.shape(ctx, [[60, 50], [-20, 70], [-120 * fl, 40], [-140 * fl, 10], [-130 * fl, -20], [-140 * fl, -48], [-118 * fl, -70], [-30, -72], [20, -110], [50, -100], [40, -60], [90, -40]], P.skin, { lw: 6, shade: c => C.blot(c, [[-140, 20], [80, 30], [80, 90], [-140, 90]], P.skinDk, .55) });
    for (let i = 0; i < 3; i++) C.line(ctx, [[-30, -40 + i * 28], [-120 * fl, -46 + i * 30]], 3.6, P.skinDk);
    ctx.restore();
  }
  function stoneWipe(t) {
    const k = times();
    const w1a = k.stone + .15, w1b = k.H - .05, bA = k.H - .05, bB = k.H + .35, w2a = k.H + .4, w2b = k.K + .12;
    const cleanH = .15 + .62 * seg(t, w1a, w1b) + .23 * seg(t, bA, bB), cleanK = .1 + .35 * seg(t, bA, bB) + .55 * E.outQ(seg(t, w2a, w2b));
    return { cleanH: t >= k.stamp ? 1 : cleanH, cleanK: t >= k.stamp ? 1 : cleanK, w1a, w1b, bA, bB, w2a, w2b };
  }
  shot('b23-moloz', k => k.rubble, k => k.stone, (ctx, t, u, tl) => {
    const k = times(), tw = twos(t), z = lerp(1, 1.12, E.io(u));
    ctx.save(); cam(ctx, z, 560, 900);
    drawRubble(ctx);
    stoneDust(ctx, 0, 0);
    // taşın üstünde duran tuğlayı el iter
    const a = E.outC(seg(tw, k.rubble + .55, k.rubble + 1.15)), enter = E.outC(seg(tw, k.rubble + .1, k.rubble + .55));
    const bx = STONE.x + 20 - a * 380, by = STONE.y - 30 + a * 120;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(.3 + a * .5); C.seed(651); C.shape(ctx, [[-70, -26], [70, -26], [70, 26], [-70, 26]], P.brickDk, { lw: 4.4 }); ctx.restore();
    const hx = lerp(1150, bx + 110, enter) , hy = lerp(1500, by + 30, enter);
    drawFlatHand(ctx, hx - (tw > k.rubble + 1.2 ? E.inQ(seg(tw, k.rubble + 1.2, k.rubble + 1.6)) * -500 : 0), hy + (tw > k.rubble + 1.2 ? E.inQ(seg(tw, k.rubble + 1.2, k.rubble + 1.6)) * 500 : 0), -.35, .2);
    airDust(ctx, t, 20, 7, [0, 300, 1080, 1200], .8);
    ctx.restore();
    finish(ctx);
  });
  shot('b24-damga', k => k.stone, k => k.push, (ctx, t, u, tl) => {
    const k = times(), tw = twos(t), W = stoneWipe(tw);
    const z = lerp(1.9, 2.05, E.io(u));
    ctx.save(); cam(ctx, z, STONE.x, STONE.y, 540, 480);
    drawRubble(ctx);
    stoneDust(ctx, W.cleanH, W.cleanK);
    // el: H üstünde ileri-geri, üfleme için çekilir, K üstünde ileri-geri, damgada kadraj dışında
    let hx = 1000, hy = 1150, rot = -.35;
    const rub = (a, b) => { const s = seg(tw, a, b); return Math.sin(s * Math.PI * 4) * 60; };
    if (tw < W.w1b) { const e = E.outC(seg(tw, k.stone, W.w1a)); hx = lerp(1000, STONE.x - 40 + rub(W.w1a, W.w1b), e); hy = lerp(1150, STONE.y + 40, e); }
    else if (tw < W.w2a) { const e = E.outQ(seg(tw, W.bA, W.bA + .15)); hx = lerp(STONE.x - 40, STONE.x + 150, e); hy = lerp(STONE.y + 40, STONE.y + 240, e); }
    else if (tw < W.w2b) { const e = E.outC(seg(tw, W.w2a, W.w2a + .12)); hx = lerp(STONE.x + 150, STONE.x + 130 + rub(W.w2a + .1, W.w2b), e); hy = lerp(STONE.y + 240, STONE.y + 30, e); }
    else { const e = E.inQ(seg(tw, W.w2b, k.stamp - .04)); hx = lerp(STONE.x + 130, STONE.x + 600, e); hy = lerp(STONE.y + 30, STONE.y + 520, e); }
    // üfleme: toz sol üste savrulur + hava çizgileri
    const bt = t - W.bA;
    if (bt > 0 && bt < 1.1) {
      for (let i = 0; i < 26; i++) { const r = j => rnd(9100 + i * 5 + j), tt = bt - r(1) * .2; if (tt < 0) continue; const x = STONE.x - 120 + r(2) * 260 - tt * (160 + r(3) * 260), y = STONE.y - 60 + r(4) * 100 - tt * (90 + r(5) * 160); ctx.fillStyle = `rgba(216,202,176,${.85 * (1 - tt / 1.1)})`; ctx.beginPath(); ctx.arc(x, y, 6 + r(6) * 12 + tt * 20, 0, TAU); ctx.fill(); }
      if (bt < .4) { C.seed(240); for (let i = 0; i < 3; i++) C.line(ctx, [[STONE.x + 260 - bt * 200, STONE.y + 140 + i * 26], [STONE.x + 140 - bt * 200, STONE.y + 80 + i * 22]], 4, `rgba(21,18,13,${.6 * (1 - bt / .4)})`, 1); }
    }
    if (tw < k.stamp) drawFlatHand(ctx, hx, hy, rot, 0);
    ctx.restore();
    // damga anı: "tok" ile taş bir kare parlar
    const st = t - k.stamp; if (st >= 0 && st < 2 / FPS) { ctx.fillStyle = 'rgba(255,243,196,.12)'; ctx.fillRect(0, 0, 1080, 1920); }
    finish(ctx);
  });

  /* --- 26: Daisy'nin sönük ışığına yavaş itme --- */
  shot('b26-isik', k => k.push, k => k.flash, (ctx, t, u, tl) => {
    const k = times(), e = E.io(u);
    const bg = blurredWorld('bg-daisy-post', k.ground + 6, 1.15, 640, 800, 7, { noDaisy: true, noBall: true });
    drawBlurBg(ctx, bg, 1 + e * .12);
    ctx.save(); cam(ctx, lerp(1.6, 3.3, e), 0, lerp(-250, -340, e), 540, lerp(880, 640, e));
    C.drawDaisy(ctx, { x: 0, y: 0, s: 1, seed: 23, beep: 0, mood: 'sleepy', hook: .02 });
    ctx.restore();
    ctx.fillStyle = 'rgba(216,202,176,.12)'; ctx.fillRect(0, 0, 1080, 1920);
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 27: bip çekiminin hatırası (sepya, ışık iki kez) --- */
  let memCv = null;
  shot('b27-hatira', k => k.flash, k => k.eyes, (ctx, t, u, tl) => {
    const k = times(), b = beepAt(t, k.twice - TONES[0][0]);
    if (!memCv) memCv = canvas(1080, 1920);
    const m = memCv.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, 1080, 1920);
    drawDaisyCU(m, k.freeze0, DAISY_CU.z1 + .02 * u, 0, b.after ? 'alert' : 'sleepy', 'pre', k.daisy);
    ctx.fillStyle = '#2a2118'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.filter = 'sepia(1) saturate(.55) brightness(.92) contrast(.92)'; ctx.drawImage(memCv, 0, 0); ctx.filter = 'none';
    // ışık hatırada da kırmızı yanar (tek renkli an)
    if (b.v > 0) {
      ctx.save(); cam(ctx, DAISY_CU.z1 + .02 * u, DAISY_CU.fx, DAISY_CU.fy, DAISY_CU.sx, DAISY_CU.sy);
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(255,120,80,${.9 * b.v})`); g.addColorStop(.4, `rgba(255,120,80,${.3 * b.v})`); g.addColorStop(1, 'rgba(255,120,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; C.seed(23);
      C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6 / Math.sqrt(1), shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
      ctx.restore();
    }
    vignette(ctx, 0, 'rgba(30,20,10,.85)');
    finish(ctx);
  });

  /* --- 28: farlar (gözler) --- */
  shot('b28-gozler', k => k.eyes, k => k.end, (ctx, t, u, tl) => {
    const k = times(), tw = twos(t);
    const bg = blurredWorld('bg-daisy-post', k.ground + 6, 1.15, 640, 800, 7, { noDaisy: true, noBall: true });
    drawBlurBg(ctx, bg, 1.25);
    ctx.save(); cam(ctx, lerp(3.9, 4.25, E.io(u)), 0, -160, 540, 700);
    C.drawDaisy(ctx, { x: 0, y: 0, s: 1, seed: 23, beep: 0, mood: tw >= k.knew ? 'alert' : 'sleepy', hook: .02 });
    ctx.restore();
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- Bitiş: uyarı ışığı, tam durağan; endBeep'te TEK yanış; kartın altında hafif kararma --- */
  shot('b-son', k => k.end, k => k.dur + 1, (ctx, t, u, tl) => {
    const k = times(), b = beepAt(t, k.endBeep, 1);
    const bg = blurredWorld('bg-daisy-post', k.ground + 6, 1.15, 640, 800, 7, { noDaisy: true, noBall: true });
    drawBlurBg(ctx, bg, 1.3);
    ctx.save(); cam(ctx, 7.2, 0, -350, 520, 640);
    C.drawDaisy(ctx, { x: 0, y: 0, s: 1, seed: 23, beep: b.v, mood: 'sleepy', hook: .02 });
    ctx.restore();
    vignette(ctx, .5);
    finish(ctx, .5 * E.io(seg(t, k.endCard, k.endCard + .5)));
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  TB.cuesB = {
    get kolCekme() { return +times().clonk1.toFixed(3); },          // kol-cekme.wav "klonk"u (dosyada 0,44 sn) buraya
    get halatGerilme() { return +(times().clonk1 + .1).toFixed(3); }, // halat-gerilme.wav başlangıcı (top geri çekilir, 1,3 sn)
    get bip() { return +times().beep.toFixed(3); },                 // daisy-beep.wav başlangıcı (ışık +0,04 ve +0,37'de)
    get kolSonuna() { return +times().clonk2.toFixed(3); },          // ikinci kol çekişi, klonk
    get topBirak() { return +times().release.toFixed(3); },
    get topDarbe() { return +times().impact.toFixed(3); },           // top-darbe.wav; ekran sarsıntısı 6 kare
    get bacaDusus() { return +times().fall.toFixed(3); },
    get bacaYereCarpma() { return +times().ground.toFixed(3); },     // baca-devrilme.wav'daki 2,75 sn'lik darbe buraya
    get tozSilme1() { return +stoneWipe(times().stone + .3).w1a.toFixed(3); },
    get uffleme() { return +stoneWipe(times().stone + .3).bA.toFixed(3); },
    get tozSilme2() { return +stoneWipe(times().stone + .3).w2a.toFixed(3); },
    get damga() { return +times().stamp.toFixed(3); },               // damga-kesif.wav ("tok")
    get hatiraIsik() { return +(times().twice - TONES[0][0]).toFixed(3); }, // 27'deki hatıra: ışık iki kez (ses ekibi karar versin)
    get sonBip() { return +times().endBeep.toFixed(3); }             // tek bip; ışık +0,04–0,24
  };
})();
