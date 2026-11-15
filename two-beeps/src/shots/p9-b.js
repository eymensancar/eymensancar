/* Part 9 · THE EMPTY TOWER — Animatör B: cümle 13–27 ve bitiş görüntüsü. Başlangıç (S12.t1 + S13.t0) / 2 ≈ 26,12 sn → tl.duration.
   YERLEŞİM (dünya koordinatları; z=1'de 1080×1920 kare):
   • KULE SAHASI (13a, geniş, şeridin arkasından kuleye bakış): ufuk y 1080; çöken kulenin enkaz tepesi + TB.zone (540,1185) w 760 h 190;
     uzak bariyer y≈1300 (kalabalık iki yanda, x<330 ve x>760); YAKIN HAT (bizim şerit) y≈1700, kadrajı boydan boya keser; ekip şeridin arkasında.
   • GÜVENLİ TARAF (13b–16, ters açı: kameranın arkasında kule): ufuk y 1060, cadde y 1060–1300, uzak bariyer y 1290 (arkasında 200 kişi alkışlar),
     Hale'in beyaz arabası (1300,1215) uzakta. Karakterler yerde y≈1780 ve kameraya (kuleye) bakar: Defne (175,1780) s .95, Kaan (380,1790) s .95,
     Hale (650,1780) s .95, Daisy (980,1750) s .8 (uyarı ışığı dünyada (980,1473)). YAKIN HAT önlerinde: direkler y 1880, şerit y≈1600.
   • GÜNDÜZ MASA (18–20): p7-b'deki Defne'nin çizim masası (üstten), pilot liste 700×1000; 1–8 çizili, 9 bu bölümde çizilir.
   • GECE ODA (21–26): Kaan'ın odası (pilot drawRoom), lamba listenin arkasında; liste C.drawListLamp (s .66, orta (600,520)).
   • BİTİŞ (27): Kaan'ın penceresinden gece avlusu: p7-b avlusu (C.drawYard seed 7), Daisy (640,1520) s .8, ışık dünyada (640,1243).
   Her şey timeline'dan (times()); karakterler ikişerli, kamera/toz birerli; bitiş bipinde ışıktan başka her şey donar. */
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
    k.start = (S(12).t1 + S(13).t0) / 2;                 // A ile ortak kesme (≈26,12)
    k.scratch = W(13, /^scratch/i, 3).t0;                 // rahatlama
    k.relief = W(13, /^got/i, 1).t0 + .05;                // ters açı: Kaan ve Defne
    k.hale = S(14).t0 - .17;                              // Hale, Daisy, Kaan yan yana
    k.haleW = W(14, /^hale/i, 1).t0;
    k.daisyW = W(14, /^daisy/i, 5).t0;
    k.hat0 = (S(14).t1 + S(15).t0) / 2 + .05;             // Hale yakın
    k.took = W(15, /^took/i, 1).t0;                        // şapka kalkar
    k.hatW = W(15, /^hat/i, 4).t0;
    k.silent0 = S(16).t0 - .18;                           // Daisy'nin ışığı, sönük
    k.silent = c.silent;                                  // ışık sönük kalır (sessizlik)
    k.once = W(17, /^once/i, 1).t0;                        // siperlik yavaşça iner
    k.list = (S(17).t1 + S(18).t0) / 2 + .2;               // liste (gündüz masa)
    k.strike9 = W(18, /^nine/i, 0).t0 - .02;               // 9. satır çizilir
    k.list2 = (S(18).t1 + S(19).t0) / 2;                   // bütün liste: kalem 1→9 tıklar
    const w19 = S(19).words; k.taps = []; { const a = w19[0].t0, b = w19[w19.length - 1].t1 - .12; for (let i = 0; i < 9; i++) k.taps.push(a + (b - a) * i / 8); }
    k.done = S(20).t0;                                    // kalem bırakılır
    k.night = (S(20).t1 + S(21).t0) / 2 + .03;             // gece oda
    k.up = W(21, /^up/i, 6).t0;                            // liste lambaya
    k.ink0 = (S(21).t1 + S(22).t0) / 2 + .02;              // mavi karalama yakın
    k.fresh = W(22, /^fresh/i, 4).t0;                      // parıltı ("tink")
    k.mem1 = S(23).t0 - .07;                              // gri hatıra: P1 parmak
    k.old = k.mem1 + .5;                                  // eski siyah → taze mavi
    k.year = W(23, /^this/i, 5).t0;
    k.mem2 = S(24).t0 - .11;                              // gri hatıra: P4 kalemlik
    k.lamp = k.mem2 + .5;                                 // lambaya yaklaşır
    k.rev0 = S(25).t0 - .2;                               // adres belirmeye başlar
    k.revCut = W(25, /^it/i, 1).t1 + .13;                  // adrese yakın
    k.rev1 = W(25, /^could/i, 3).t1 + .25;                 // adres tam okunur
    k.face = (S(25).t1 + S(26).t0) / 2 - .15;              // Kaan'ın yüzü
    k.knew = W(26, /^knew/i, 1).t0;
    k.known = W(27, /^known/i, 2).t0;
    k.whole = W(27, /^whole/i, 5).t0;
    k.win = W(27, /^life/i, 6).t0 + .2;                    // pencere: gece avlu, Daisy
    k.end = c.voiceEnd; k.endBeep = c.endBeep; k.endCard = c.endCard; k.dur = tl.duration;
    k.endF0 = k.endBeep - .3; k.endF1 = k.endBeep + .24 + 10 / FPS;
    K = k; return k;
  }
  const beepV = (t, t0) => { const d = t - t0; return d >= .04 - 1e-6 && d < .24 - 1e-6 ? 1 : 0; };
  function frozen(t) { const k = times(); return t >= k.endF0 && t < k.endF1 ? k.endF0 : t; }
  function flow(t) { const k = times(); return t < k.endF0 ? t : t < k.endF1 ? k.endF0 : t - (k.endF1 - k.endF0); }
  const blinkAt = (t, list) => list.some(b => t >= b && t < b + 3 / FPS) ? 1 : 0;

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
  const layers = {};
  function layer(key) { if (!layers[key]) layers[key] = canvas(1080, 1920); const g = layers[key].getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 1080, 1920); return g; }
  function airDust(ctx, t, n, sb, box, a, col) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(${col || '241,232,212'},${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }
  function glow(ctx, x, y, r, rgb, a) { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 4, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore(); }
  function smooth(pts, n) {
    n = n || 5; if (pts.length < 3) return pts; const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let q = 0; q < n; q++) { const u = q / n, u2 = u * u, u3 = u2 * u; out.push([0, 1].map(d => .5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3))); }
    }
    out.push(pts[pts.length - 1]); return out;
  }
  function stroke(ctx, pts, lw, col, alpha) {
    ctx.save(); if (alpha != null) ctx.globalAlpha *= alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.stroke(C.pathOf(C.wobble(pts, false, lw * .18, 6), false)); ctx.restore();
  }
  const SEPIA = 'grayscale(1) sepia(.25) brightness(.9) contrast(.92)';   // gri hatıra (P4/P5 hatıra karesinin gri hâli)

  /* ---------- liste (pilot a-sahneler / p7-b ile aynı kâğıt ve el yazısı) ---------- */
  const PAPER = '#eadfc2', INK_OLD = '#3a3026', BLUE = '#1f4fe0', BLUE_WET = '#3d74ff';
  const DIG = {
    '0': C.ell(.5, .8, .42, .78, 14), '1': [[.22, .3], [.6, 0], [.55, .8], [.52, 1.6]],
    '2': [[.08, .38], [.25, .06], [.58, 0], [.86, .24], [.78, .66], [.4, 1.1], [.06, 1.58], [.5, 1.52], [.96, 1.56]],
    '3': [[.1, .16], [.5, 0], [.86, .24], [.74, .6], [.4, .74], [.8, .86], [.95, 1.18], [.74, 1.5], [.32, 1.6], [.04, 1.4]],
    '4': [[.72, 1.6], [.7, .6], [.68, 0], [.36, .55], [.04, 1.06], [.5, 1.04], [.98, 1.02]],
    '5': [[.92, .02], [.5, 0], [.2, .02], [.14, .4], [.12, .72], [.5, .6], [.86, .82], [.94, 1.2], [.7, 1.54], [.3, 1.6], [.04, 1.4]],
    '6': [[.82, .06], [.42, .22], [.12, .8], [.1, 1.3], [.4, 1.6], [.8, 1.46], [.9, 1.06], [.55, .82], [.14, 1.02]],
    '7': [[.04, .06], [.5, .02], [.96, 0], [.66, .8], [.4, 1.6]],
    '8': [[.5, .76], [.16, .46], [.3, .05], [.7, .05], [.84, .44], [.5, .76], [.12, 1.1], [.26, 1.56], [.76, 1.56], [.9, 1.12], [.5, .76]],
    '9': [[.86, .52], [.5, .8], [.14, .58], [.2, .14], [.6, 0], [.9, .3], [.86, .9], [.62, 1.6]]
  };
  function handNum(ctx, str, x, y, h, lw, col, sd, alpha) {
    const sc = h / 1.6; let cx = x;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '.') { ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + lw * .6, y + h - lw * .5, lw * .75, 0, TAU); ctx.fill(); ctx.restore(); cx += lw * 2.6; continue; }
      const d = DIG[ch]; if (!d) { cx += sc * .5; continue; }
      C.seed(sd + i * 13 + ch.charCodeAt(0));
      const pts = (ch === '0' ? d.concat([d[0]]) : smooth(d, 5)).map(([u, v]) => [cx + (u + (1.6 - v) * .12) * sc, y + v * sc]);
      stroke(ctx, pts, lw, col, alpha);
      cx += sc * (ch === '1' ? .78 : 1.08);
    }
    return cx - x;
  }
  function scrawl(ctx, x, y, len, lw, col, sd, alpha) {
    const r = TB.rand; let cx = x, w = 0;
    while (cx < x + len) {
      const nL = 2 + Math.floor(r(sd + w * 7) * 6), pts = []; let th = 0; const base = y + (r(sd + w * 11) - .5) * 4;
      for (let L = 0; L < nL; L++) {
        const hh = 10 + r(sd + w * 31 + L * 5) * 10 + (r(sd + w * 17 + L * 3) < .22 ? 16 : 0);
        for (let q = 0; q < 8; q++) { const a = th + q / 8 * TAU; pts.push([cx + a * 2.6 - Math.sin(a) * 7, base - hh * (1 - Math.cos(a)) / 2]); }
        th += TAU;
      }
      pts.push([cx + th * 2.6 + 4, base]); C.seed(sd + w * 3); stroke(ctx, pts, lw, col, alpha);
      cx += th * 2.6 + 18 + r(sd + w * 5) * 14; w++; if (w > 12) break;
    }
  }
  const lineY = i => i <= 9 ? 150 + (i - 1) * 84 : 948;
  const lineLen = i => 300 + TB.rand(i * 97 + 3) * 210;
  function strikeLine(ctx, i, u) {   // siyah kalın çizgi (p7-b ile aynı)
    if (u <= 0) return; const y = lineY(i) - 4, x0 = 26, x1 = 128 + lineLen(i) + 30;
    const pts = []; for (let q = 0; q <= 10; q++) pts.push([lerp(x0, x1, q / 10), y + Math.sin(q * 1.3 + i) * 3 + (q / 10 - .5) * -6]);
    const n = Math.max(2, Math.round(pts.length * u)), pp = pts.slice(0, n); if (u < 1) { const last = lerp(x0, x1, u); pp[pp.length - 1] = [last, pp[pp.length - 1][1]]; }
    C.seed(1500 + i); stroke(ctx, pp, 13, P.ink, .95);
  }
  function blueScratchPaths() {   // pilot 10. satır karalaması
    const pts = [], n = 26, x0 = 112, x1 = 640, y = lineY(10) - 4;
    for (let q = 0; q <= n; q++) { const u = q / n; pts.push([x0 + (x1 - x0) * u + (TB.rand(q * 7) - .5) * 14, y + (q % 2 ? -26 : 24) + (TB.rand(q * 3) - .5) * 10]); }
    const pts2 = []; for (let q = 0; q <= 18; q++) { const u = q / 18; pts2.push([x1 - 10 - (x1 - x0 - 30) * u, y + (q % 2 ? 18 : -18) + (TB.rand(q * 11) - .5) * 8]); }
    C.seed(512); return [pts, pts2, [[x0 - 6, y + 2], [(x0 + x1) / 2, y - 6], [x1 + 8, y + 4]]].map(p => C.pathOf(C.wobble(p, false, 1.2, 6), false));
  }
  function listPaper() {   // açık liste 700×1000; 1–8 çizili (P7: 3-4-5, P8: 6-7-8), 9 açık
    return cached('liste', 760, 1060, c => {
      c.translate(30, 30);
      C.seed(401);
      C.shape(c, [[0, 0], [700, 0], [700, 1000], [0, 1000]], PAPER, {
        lw: 3.2, amp: .8, shade: cc => {
          const g = cc.createLinearGradient(0, 0, 700, 0); g.addColorStop(0, 'rgba(150,110,60,.22)'); g.addColorStop(.1, 'rgba(150,110,60,0)'); g.addColorStop(.9, 'rgba(150,110,60,0)'); g.addColorStop(1, 'rgba(150,110,60,.25)');
          cc.fillStyle = g; cc.fillRect(0, 0, 700, 1000);
          cc.save(); cc.globalAlpha = .28; cc.strokeStyle = '#a07a45'; cc.lineWidth = 7; C.seed(5); cc.stroke(C.pathOf(C.wobble(C.ell(565, 190, 74, 70, 30), true, 3, 10), true)); cc.restore();
          for (let q = 0; q < 22; q++) { const px = TB.rand(q * 5 + 1) * 700, py = TB.rand(q * 9 + 2) * 1000; cc.fillStyle = `rgba(160,118,62,${.08 + TB.rand(q) * .14})`; cc.beginPath(); cc.arc(px, py, 3 + TB.rand(q * 3) * 10, 0, TAU); cc.fill(); }
        }
      });
      c.save(); c.globalAlpha = .3; C.seed(612); C.line(c, [[4, 450], [696, 452]], 2.2, '#8a6a40', .6); C.seed(611); C.line(c, [[4, 900], [696, 901]], 2, '#8a6a40', .5); c.restore();
      handNum(c, '10', 52, 40, 54, 5, INK_OLD, 77, .9);
      C.seed(78); stroke(c, C.ell(92, 66, 62, 44, 22).concat([[148, 52]]), 3.6, INK_OLD, .8);
      scrawl(c, 190, 92, 300, 3.6, INK_OLD, 4400, .85);
      C.seed(79); stroke(c, [[186, 108], [360, 104], [520, 110]], 3, INK_OLD, .7);
      for (let i = 1; i <= 10; i++) { const y = lineY(i); handNum(c, i + '.', 34, y - 30, 44, 4.2, INK_OLD, 900 + i * 31, .85); scrawl(c, i === 10 ? 132 : 122, y + 10, lineLen(i), 3.2, INK_OLD, 1200 + i * 57, .8); }
      c.lineCap = 'round'; c.lineJoin = 'round'; blueScratchPaths().forEach((p, i) => { c.strokeStyle = BLUE; c.lineWidth = i === 2 ? 8 : 7; c.stroke(p); });
      for (let i = 1; i <= 8; i++) strikeLine(c, i, 1);
    });
  }
  function kaanHandPen(ctx, x, y, rot) {   // p7-b ile aynı: Kaan'ın eli, siyah keçeli kalem; uç (x,y)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); C.seed(3620);
    C.line(ctx, [[0, 0], [70, -96]], 20, P.ink, .2); C.line(ctx, [[0, 0], [70, -96]], 11, '#2b2b30', .2); C.line(ctx, [[2, -3], [14, -20]], 6, '#111', .1);
    C.shape(ctx, [[60, -150], [140, -170], [200, -90], [150, -20], [70, -40], [40, -100]], P.skin, { lw: 6, shade: c => C.blot(c, [[120, -170], [210, -170], [210, -20], [140, -20]], P.skinDk, .5) });
    C.line(ctx, [[86, -120], [130, -100]], 3, P.skinDk, .3);
    C.shape(ctx, [[150, -180], [220, -120], [196, -80], [126, -140]], P.hazard, { lw: 5 });
    C.shape(ctx, [[180, -170], [700, -10], [640, 200], [150, -60]], P.jacket, { lw: 6, shade: c => C.blot(c, [[200, -100], [680, 60], [640, 200], [180, -40]], P.jacketDk, .55) });
    ctx.restore();
  }
  function marker(ctx, x, y, rot) {   // masada yatan keçeli kalem (kapaklı), orta (x,y)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); C.seed(3630);
    ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = P.ink; ctx.fillRect(-96, -6, 200, 22); ctx.restore();
    C.shape(ctx, [[-100, -11], [60, -11], [60, 11], [-100, 11]], '#2b2b30', { lw: 5 });
    C.shape(ctx, [[60, -13], [104, -13], [110, 0], [104, 13], [60, 13]], P.ink, { lw: 5 });
    C.line(ctx, [[-60, -4], [20, -4]], 2, 'rgba(255,255,255,.3)', .2);
    ctx.restore();
  }
  function deskTop(ctx) {   // p7-b: Defne'nin çizim masası (üstten)
    const cv = cached('masa-ust', 1080, 2400, c => {
      c.fillStyle = '#d9d3bf'; c.fillRect(0, 0, 1080, 2400); C.seed(3701);
      for (let i = 0; i < 10; i++) C.blot(c, C.ell(rnd(3710 + i) * 1080, rnd(3720 + i) * 2400, 120 + rnd(3730 + i) * 160, 30 + rnd(3740 + i) * 30, 12), '#c4bca3', .5);
      c.strokeStyle = 'rgba(31,79,224,.07)'; c.lineWidth = 2; for (let x = 0; x < 1080; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 2400); c.stroke(); }
    });
    ctx.drawImage(cv, -540, -1200);
  }

  /* ================= KALABALIK + EKİP ================= */
  const CROWD_COL = ['#7d4f3f', '#3f6f8f', '#8a7a62', '#5b8a5a', '#a0663f', '#46505c', '#b4532f', '#6d6a8a', '#c9a26b', '#2c3a5e'];
  function person(ctx, x, y, s, sd, clap, cheer) {   // küçük uzak insan: gövde + baş + alkışlayan kollar (ikişerli)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd);
    const col = CROWD_COL[sd % CROWD_COL.length], skin = ['#c68a5e', '#e2b48e', '#a0663f', '#d9a27a'][sd % 4], lw = 6;
    C.shape(ctx, [[-30, -10], [-26, -150], [26, -150], [30, -10]], '#3a3d45', { lw, amp: .4 });
    C.shape(ctx, [[-40, -140], [-34, -260], [34, -260], [40, -140]], col, { lw, amp: .4 });
    if (cheer) { C.line(ctx, [[-30, -250], [-60, -320], [-50, -380]], 14, col, .3); C.line(ctx, [[30, -250], [60, -320], [50, -380]], 14, col, .3); }
    else {
      const hx = clap ? 4 : 24;
      C.line(ctx, [[-30, -250], [-44, -200], [-hx, -220]], 14, col, .3); C.line(ctx, [[30, -250], [44, -200], [hx, -224]], 14, col, .3);
      C.shape(ctx, C.ell(-hx, -222, 9, 9, 8), skin, { lw: lw * .7, amp: .2 }); C.shape(ctx, C.ell(hx, -226, 9, 9, 8), skin, { lw: lw * .7, amp: .2 });
    }
    C.shape(ctx, C.ell(0, -296, 30, 34, 14), skin, { lw, amp: .3 });
    if (sd % 3 === 0) C.shape(ctx, [[-30, -306], [-24, -330], [24, -330], [30, -306]], P.helmet, { lw: lw * .8, amp: .2 });
    else C.shape(ctx, [[-30, -300], [-26, -326], [0, -334], [26, -326], [30, -300], [20, -312], [-20, -312]], ['#2a1d16', '#4a2418', '#8e897f', '#2a1d16'][sd % 4], { lw: lw * .7, amp: .2 });
    ctx.restore();
  }
  function crowd(ctx, t, x0, x1, y, s, sd, gap, amp) {   // alkış: her kişi kendi fazında, ikişerli
    const tw = twos(t); let i = 0;
    for (let x = x0; x < x1; x += gap) {
      const r = j => rnd(sd * 100 + i * 7 + j), px = x + (r(1) - .5) * gap * .5, py = y + (r(2) - .5) * 26, ps = s * (.9 + r(3) * .2);
      const clap = Math.floor(tw * (6 + r(4) * 3) + r(5) * 2) % 2 === 0, cheer = r(6) < (amp || .12);
      person(ctx, px, py - (cheer && clap ? 6 : 0), ps, sd * 50 + i, clap, cheer && r(7) < .6 ? clap : false);
      i++;
    }
  }
  function worker(ctx, x, y, s, sd, ph, flag) {   // p3-b / p7-b ile aynı ekip (baretli, turuncu yelek)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd);
    const lw = 5 / Math.sqrt(s), body = '#46505c', bodyDk = '#343c46';
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 70, 11, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.shape(ctx, [[-34, -220], [-4, -220], [-10, -10], [-40, -10]], bodyDk, { lw }); C.shape(ctx, [[4, -220], [34, -220], [40, -10], [10, -10]], body, { lw });
    C.shape(ctx, [[-46, -14], [-6, -14], [0, 0], [-50, 0]], P.bootDk, { lw }); C.shape(ctx, [[8, -14], [46, -14], [54, 0], [6, 0]], P.bootDk, { lw });
    C.tube(ctx, [[-50, -360], [-66, -290], [-60, -228]], 34, 28, bodyDk, lw);
    C.shape(ctx, [[-56, -372], [56, -372], [62, -220], [-62, -220]], '#e0672a', { lw, shade: c => C.blot(c, [[20, -380], [70, -380], [70, -210], [26, -210]], '#b44e1c', .6) });
    C.line(ctx, [[-58, -290], [58, -290]], 7, P.paper, .3); C.line(ctx, [[-20, -372], [-20, -222]], 6, P.paper, .3); C.line(ctx, [[20, -372], [20, -222]], 6, P.paper, .3);
    if (flag) { C.tube(ctx, [[50, -360], [80, -400], [96, -450 + Math.sin(ph) * 10]], 34, 28, body, lw); C.shape(ctx, C.ell(98, -462 + Math.sin(ph) * 10, 14, 14, 10), '#a87a56', { lw: lw * .8 }); }
    else C.tube(ctx, [[50, -360], [66, -290], [60, -228]], 34, 28, body, lw);
    C.shape(ctx, C.ell(0, -414, 36, 40, 18), '#a87a56', { lw });
    C.shape(ctx, [[-44, -430], [-38, -462], [-16, -478], [16, -478], [38, -462], [44, -430], [52, -428], [52, -420], [-52, -420], [-52, -428]], P.helmet, { lw, shade: c => C.blot(c, [[10, -480], [56, -480], [56, -418], [18, -418]], P.helmetDk, .7) });
    ctx.restore();
  }
  function barrierLine(ctx, x0, x1, gy, ph, postGap, lw) {   // "the line": direkler + sarı-siyah şerit (hafif dalgalanır)
    lw = lw || 4; postGap = postGap || 260;
    for (let x = x0; x <= x1; x += postGap) { C.seed(2900 + Math.round(x)); C.line(ctx, [[x, gy - ph], [x + 2, gy]], lw * 2.6, P.ink, .3); C.line(ctx, [[x, gy - ph], [x + 2, gy]], lw * 1.1, '#d9c2a0', .2); }
    const n = Math.ceil((x1 - x0) / (lw * 7));
    for (let q = 0; q < n; q++) {
      const a = x0 + q * (x1 - x0) / n, b = x0 + (q + 1) * (x1 - x0) / n, sag = u => Math.sin(((u - x0) % postGap) / postGap * Math.PI) * ph * .07;
      ctx.strokeStyle = q % 2 ? P.ink : P.hazard; ctx.lineWidth = lw * 2.6; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(a, gy - ph * .82 + sag(a)); ctx.lineTo(b, gy - ph * .82 + sag(b)); ctx.stroke();
    }
  }

  /* ================= TOZ ================= */
  let dustCv = null;
  function dustBlobs(ctx, blobs, alpha) {   // p7-b dustCloud ile aynı boyama (koyu kenar, orta, açık, parlak)
    if (alpha <= .01 || !blobs.length) return;
    if (!dustCv) dustCv = canvas(1080, 1920);
    const d = dustCv.getContext('2d'), m = ctx.getTransform();
    d.setTransform(1, 0, 0, 1, 0, 0); d.clearRect(0, 0, 1080, 1920); d.setTransform(m);
    d.globalAlpha = .35; d.fillStyle = P.ink; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x, y, r + 3, 0, TAU); d.fill(); }); d.globalAlpha = 1;
    d.fillStyle = P.dust; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill(); });
    d.fillStyle = P.dustLt; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x - r * .16, y - r * .2, r * .8, 0, TAU); d.fill(); });
    d.fillStyle = 'rgba(241,232,212,.35)'; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x - r * .3, y - r * .38, r * .38, 0, TAU); d.fill(); });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(dustCv, 0, 0); ctx.restore();
  }

  /* ================= 13a: KULE SAHASI (geniş) ================= */
  const SITE = { hz: 1080, zx: 540, zy: 1185, zw: 760, zh: 190 };
  function siteBase() {
    return cached('saha', 1400, 2200, g => {
      g.translate(160, 140);
      const sg = g.createLinearGradient(0, -140, 0, SITE.hz); sg.addColorStop(0, '#9fbfd6'); sg.addColorStop(.6, '#cfd6d2'); sg.addColorStop(1, '#ead9b8'); g.fillStyle = sg; g.fillRect(-160, -140, 1400, SITE.hz + 140);
      [[P.far2, 160, 420, 300], [P.far, 70, 240, 310]].forEach(([col, hmin, hmax, sd], li) => { let cx = -170; let n = 0; while (cx < 1240) { const bw = 50 + rnd(sd + n) * 90, bh = hmin + rnd(sd + 50 + n) * (hmax - hmin); if (li === 0 || cx < 230 || cx > 820) { C.seed(sd + n); C.shape(g, [[cx, SITE.hz], [cx, SITE.hz - bh], [cx + bw, SITE.hz - bh], [cx + bw, SITE.hz]], col, { lw: 1.8, ink: P.far2, amp: .4, shade: c => { c.fillStyle = 'rgba(211,218,222,.55)'; for (let yy = SITE.hz - bh + 12; yy < SITE.hz - 10; yy += 18) for (let xx = cx + 8; xx < cx + bw - 8; xx += 16) if (rnd(xx * 3 + yy) < .4) c.fillRect(xx, yy, 6, 8); } }); } cx += bw + 4; n++; } });
      const hzg = g.createLinearGradient(0, SITE.hz - 260, 0, SITE.hz); hzg.addColorStop(0, 'rgba(234,217,184,0)'); hzg.addColorStop(1, 'rgba(234,217,184,.7)'); g.fillStyle = hzg; g.fillRect(-160, SITE.hz - 260, 1400, 260);
      const gg = g.createLinearGradient(0, SITE.hz, 0, 2060); gg.addColorStop(0, '#c9bfae'); gg.addColorStop(.25, P.ground); gg.addColorStop(1, P.groundDk); g.fillStyle = gg; g.fillRect(-160, SITE.hz, 1400, 2060 - SITE.hz);
      for (let i = 0; i < 26; i++) C.blot(g, C.ell(-150 + rnd(5100 + i) * 1380, 1150 + rnd(5200 + i) * 900, 50 + rnd(5300 + i) * 110, 8 + rnd(5400 + i) * 12, 12), i % 2 ? P.groundDk : P.groundLt, .22);
      TB.zone(g, SITE.zx, SITE.zy, SITE.zw, SITE.zh, 1);
      // enkaz tepesi: kule kendi alanına oturdu (cam, beton, kiriş uçları)
      C.seed(5601);
      C.shape(g, [[210, 1215], [260, 1150], [330, 1120], [400, 1090], [470, 1060], [540, 1050], [610, 1062], [690, 1092], [770, 1130], [840, 1170], [870, 1215]], P.concreteDk, { lw: 3.6, shade: c => { C.blot(c, [[560, 1040], [900, 1100], [900, 1230], [600, 1230]], P.dustDk, .5); } });
      for (let i = 0; i < 46; i++) { const r = j => rnd(5700 + i * 5 + j), x = 240 + r(1) * 600, y = 1210 - (1 - Math.pow((x - 540) / 320, 2)) * 150 * r(2), w = 14 + r(3) * 40; C.seed(5800 + i); C.shape(g, [[x - w / 2, y], [x + w / 2, y - r(4) * 10], [x + w / 2 - 4, y - 12 - r(5) * 16], [x - w / 2 + 6, y - 10 - r(6) * 10]], [P.concrete, P.dustLt, P.glassT, P.concreteDk, P.steelDk][i % 5], { lw: 2.2, amp: .4 }); }
      [[430, 1080, -.5, 120], [600, 1065, .35, 140], [520, 1060, .1, 90], [700, 1110, .8, 100]].forEach(([x, y, a, L], i) => { C.seed(5900 + i); C.line(g, [[x, y], [x + Math.sin(a) * L, y - Math.cos(a) * L]], 9, P.steelDk, .4); });
      C.seed(5990); C.line(g, [[210, 1215], [870, 1215]], 3, P.ink, .6);
      // uzak bariyer (kalabalık önünde) iki yanda
      barrierLine(g, -160, 300, 1320, 46, 120, 2.6); barrierLine(g, 790, 1240, 1320, 46, 120, 2.6);
    });
  }
  function siteDust(ctx, t) {   // yerleşen toz: yalnız alanın içinde, yavaşça iner ve incelir
    const k = times(), u = clamp((t - k.start + .6) / 2.4), blobs = [];
    for (let i = 0; i < 44; i++) {
      const r = j => rnd(6100 + i * 9 + j), x = SITE.zx + (r(1) - .5) * SITE.zw * .92 * (.6 + .4 * u), base = 1210 - r(2) * 60;
      const hgt = (20 + r(3) * r(3) * 380) * (1 - .75 * E.outQ(u)), rad = (60 + r(4) * 120) * (1 - .3 * u);
      blobs.push([x + Math.sin(t * .4 + r(5) * 6) * 10, base - hgt, rad]);
    }
    dustBlobs(ctx, blobs, 1 - .3 * E.io(u));
  }

  /* ================= GÜVENLİ TARAF (ters açı) ================= */
  const SAFE = { hz: 1060, gy: 1780 };
  const DEFNE = { x: 175, y: 1780, s: .95 }, KAAN = { x: 380, y: 1790, s: .95 }, HALE = { x: 650, y: 1780, s: .95 }, DAISY = { x: 980, y: 1750, s: .8 };
  const BEACON = [DAISY.x, DAISY.y - 346 * DAISY.s];
  function safeBase() {
    return cached('guvenli', 2000, 2600, g => {
      g.translate(500, 300);
      const sg = g.createLinearGradient(0, -300, 0, SAFE.hz); sg.addColorStop(0, '#9cbcd4'); sg.addColorStop(.65, '#cdd8d6'); sg.addColorStop(1, '#efdcb8'); g.fillStyle = sg; g.fillRect(-500, -300, 2000, SAFE.hz + 300);
      [[P.far2, 140, 380, 700], [P.far, 60, 220, 760]].forEach(([col, hmin, hmax, sd]) => { let cx = -510, n = 0; while (cx < 1500) { const bw = 60 + rnd(sd + n) * 100, bh = hmin + rnd(sd + 50 + n) * (hmax - hmin); C.seed(sd + n); C.shape(g, [[cx, SAFE.hz], [cx, SAFE.hz - bh], [cx + bw, SAFE.hz - bh], [cx + bw, SAFE.hz]], col, { lw: 1.8, ink: P.far2, amp: .4, shade: c => { c.fillStyle = 'rgba(211,218,222,.5)'; for (let yy = SAFE.hz - bh + 12; yy < SAFE.hz - 10; yy += 18) for (let xx = cx + 8; xx < cx + bw - 8; xx += 16) if (rnd(xx * 5 + yy) < .4) c.fillRect(xx, yy, 6, 8); } }); cx += bw + 5; n++; } });
      // cadde: kaldırım + asfalt
      g.fillStyle = '#b9b1a0'; g.fillRect(-500, SAFE.hz, 2000, 60); g.fillStyle = '#8d8a84'; g.fillRect(-500, SAFE.hz + 60, 2000, 180);
      g.save(); g.strokeStyle = 'rgba(241,232,212,.7)'; g.lineWidth = 6; g.setLineDash([60, 50]); g.beginPath(); g.moveTo(-500, SAFE.hz + 150); g.lineTo(1500, SAFE.hz + 150); g.stroke(); g.restore();
      C.seed(7101); C.line(g, [[-500, SAFE.hz], [1500, SAFE.hz]], 3, P.ink, .5); C.line(g, [[-500, SAFE.hz + 60], [1500, SAFE.hz + 60]], 2.4, 'rgba(21,18,13,.5)', .5);
      const gg = g.createLinearGradient(0, SAFE.hz + 240, 0, 2300); gg.addColorStop(0, P.groundLt); gg.addColorStop(.3, P.ground); gg.addColorStop(1, P.groundDk); g.fillStyle = gg; g.fillRect(-500, SAFE.hz + 240, 2000, 2300 - SAFE.hz - 240);
      for (let i = 0; i < 30; i++) C.blot(g, C.ell(-480 + rnd(7200 + i) * 1960, 1330 + rnd(7300 + i) * 900, 50 + rnd(7400 + i) * 110, 8 + rnd(7500 + i) * 12, 12), i % 2 ? P.groundDk : P.groundLt, .25);
      C.drawCar(g, { x: 1310, y: 1240, s: .3, view: 'side', seed: 61, flip: true });
    });
  }
  function grassT(ctx, t, y0, y1, sd) {
    for (let i = 0; i < 16; i++) {
      const r = j => rnd(sd + i * 9 + j), x = -300 + r(1) * 1700, y = y0 + r(2) * (y1 - y0), ph = r(3) * 6;
      for (let q = 0; q < 5; q++) {
        const sw = Math.sin(t * 2.4 + ph + q * .5) * 6 + Math.sin(t * 4.7 + ph) * 2, hh = 18 + r(4 + q) * 18;
        ctx.strokeStyle = P.weed; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + q * 4, y);
        ctx.quadraticCurveTo(x + q * 4 + (q - 2) * 3, y - hh * .6, x + q * 4 + (q - 2) * 4 + sw, y - hh); ctx.stroke();
      }
    }
  }
  function drawBeacon(ctx, v) { // pilotla aynı: yalnız uyarı ışığı (farlar değişmez)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(q => { const r = 40 + q * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - q * .2) * Math.min(1, v * 1.5), null, .5); }));
  }
  // siperlik (göz kapağı) ara konum: drawDaisy 'alert' çizilir, üstüne lid 0 (alert) … 1 (sleepy) kapağı (aynı biçim) çizilir
  function daisyLid(ctx, d, lid) {
    if (lid <= 0) return; const lidT = lerp(.12, .46, lid), tilt = lerp(-.04, .2, lid), lw = 5.6 / Math.sqrt(d.s);
    ctx.save(); ctx.translate(d.x, d.y + (d.bob || 0)); ctx.scale(d.s, d.s);
    [-1, 1].forEach(side_ => {
      const cx = side_ * 76, cy = -156; ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, 27, 27, 0, 0, TAU); ctx.clip();
      const y0 = cy - 27 + 54 * lidT, inner = y0 + 27 * tilt, outer = y0 - 8 * tilt;
      ctx.fillStyle = P.dShade; ctx.beginPath(); ctx.moveTo(cx - 40, cy - 40); ctx.lineTo(cx + 40, cy - 40); ctx.lineTo(cx + 40, side_ < 0 ? inner : outer); ctx.lineTo(cx - 40, side_ < 0 ? outer : inner); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = lw * .8; ctx.beginPath(); ctx.moveTo(cx - 40, side_ < 0 ? outer : inner); ctx.lineTo(cx + 40, side_ < 0 ? inner : outer); ctx.stroke();
      ctx.restore();
      C.seed(24 + side_); ctx.save(); ctx.strokeStyle = P.ink; ctx.lineWidth = lw * .7; ctx.beginPath(); ctx.ellipse(cx, cy, 27, 27, 0, 0, TAU); ctx.stroke(); ctx.restore();
    });
    ctx.restore();
  }
  function daisy(ctx, d) {
    C.drawDaisy(ctx, { x: d.x, y: d.y + (d.bob || 0), s: d.s, seed: 23, beep: 0, mood: d.mood || 'sleepy', hook: d.hook || 0, flip: d.flip });
    if (d.lid != null) daisyLid(ctx, d, d.lid);
    if (d.beep > 0) { ctx.save(); ctx.translate(d.x, d.y + (d.bob || 0)); ctx.scale(d.s, d.s); drawBeacon(ctx, d.beep); ctx.restore(); }
  }
  // Defne: boyundan bölünür (p7-b ile aynı)
  function drawDefneTalk(ctx, o, headRot, headDy, lean) {
    const s = (o.s || 1) * .9, neck = o.y - (o.pose === 'sit' ? 301 : 405) * s;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(lean || 0); ctx.translate(-o.x, -o.y);
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, neck, 9000, 9000); ctx.clip(); C.drawDefne(ctx, o); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, -9000, 9000, neck + 9000 + 1); ctx.clip();
    ctx.translate(o.x + 2 * s, neck + (headDy || 0)); ctx.rotate(headRot || 0); ctx.translate(-(o.x + 2 * s), -neck); C.drawDefne(ctx, o); ctx.restore();
    ctx.restore();
  }
  // Hale: boyundan bölünür (baş eğilir); arm verilirse sağ kol kırpılıp (p3-a haleWithArm gibi) yeniden çizilir, şapka elde taşınır
  const ARM_CUT = [[84, -410], [200, -410], [200, -190], [86, -190], [86, -262], [96, -330], [86, -400]];
  const hatSprites = {};
  function hatSprite(S) {   // drawHale'in şapkası (kendi çizgisiyle), yerel (-100,-610)…(100,-500), ölçek S
    const key = S.toFixed(3); if (hatSprites[key]) return hatSprites[key];
    const cv = canvas(Math.ceil(200 * S), Math.ceil(112 * S)), g = cv.getContext('2d');
    g.beginPath(); g.rect(0, 0, cv.width, (610 - 501) * S); g.clip();
    C.drawHale(g, { x: 100 * S, y: 610 * S, s: S / 1.04, seed: 41, hat: true, expr: 'regret' });
    return (hatSprites[key] = cv);
  }
  function drawHaleX(ctx, o, headRot, arm) {
    const s = (o.s || 1) * 1.04, neck = o.y - 405 * s, lw = 5.2 / Math.sqrt(s);
    const body = () => {
      if (!arm) { C.drawHale(ctx, o); return; }
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
      const cut = new Path2D(); cut.rect(-400, -800, 800, 900); cut.moveTo(ARM_CUT[0][0], ARM_CUT[0][1]); ARM_CUT.slice(1).forEach(p => cut.lineTo(p[0], p[1])); cut.closePath();
      ctx.clip(cut, 'evenodd'); ctx.scale(1 / s, 1 / s); ctx.translate(-o.x, -o.y);
      C.drawHale(ctx, o); ctx.restore();
    };
    const head = () => { ctx.save(); ctx.beginPath(); ctx.rect(-4000, -9000, 9000, neck + 9000 + 1); ctx.clip(); ctx.translate(o.x, neck); ctx.rotate(headRot || 0); ctx.translate(-o.x, -neck); body(); ctx.restore(); };
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, neck, 9000, 9000); ctx.clip(); body(); ctx.restore();
    if (arm) {   // kol + elde şapka (kol gövdenin önünde)
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s); C.seed(4401);
      C.shape(ctx, [[86, -262], [100, -252], [88, -212], [84, -212]], P.suitDk, { lw: 0 });
      C.line(ctx, [[98, -270], [100, -252], [88, -212]], lw);
      ctx.restore();
    }
    head();
    if (arm) {
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s); C.seed(4402);
      const sh = [78, -388], el = arm.el, hd = arm.hand;
      if (arm.hat) { const hs = hatSprite(s); ctx.save(); ctx.translate(arm.hat[0], arm.hat[1]); ctx.rotate(arm.hat[2] || 0); ctx.scale(1 / s, 1 / s); ctx.drawImage(hs, -102 * s, -96 * s); ctx.restore(); }
      C.tube(ctx, [sh, el, hd], 46, 36, P.suit, lw);
      const ang = Math.atan2(hd[1] - el[1], hd[0] - el[0]);
      ctx.save(); ctx.translate(hd[0], hd[1]); ctx.rotate(ang);
      C.shape(ctx, [[-14, -20], [2, -21], [2, 21], [-14, 20]], P.shirt, { lw: lw * .8 });
      C.shape(ctx, [[2, -16], [30, -18], [44, -10], [46, 6], [30, 16], [2, 14]], P.hSkin, { lw: lw * .9 });
      C.shape(ctx, C.ell(14, -20, 9, 7, 10), P.hSkin, { lw: lw * .7 });
      ctx.restore(); ctx.restore();
    }
  }
  function safeWorld(ctx, t, o) {
    o = o || {}; const tw = twos(t);
    ctx.drawImage(safeBase(), -500, -300);
    crowd(ctx, t, -480, 1500, 1288, .3, 71, 46, .2);
    barrierLine(ctx, -500, 1500, 1310, 52, 140, 2.6);
    // ekip: uzak bariyerin önünde iki işçi (rahat)
    worker(ctx, -120, 1360, .34, 401, tw * 3, true); worker(ctx, 1240, 1356, .34, 402, tw * 3 + 1, false);
    grassT(ctx, t, 1400, 1700, 7600);
    const items = [];
    if (o.daisy !== false) items.push([DAISY.y, () => daisy(ctx, Object.assign({ x: DAISY.x, y: DAISY.y, s: DAISY.s, hook: Math.sin(t * 1.1) * .025 }, o.daisy || {}))]);
    if (o.defne) items.push([DEFNE.y, () => drawDefneTalk(ctx, Object.assign({ x: DEFNE.x, y: DEFNE.y, s: DEFNE.s, seed: 31, item: 'helmet' }, o.defne), o.defne.headRot, 0, o.defne.lean)]);
    if (o.kaan) items.push([KAAN.y, () => C.drawKaan(ctx, Object.assign({ x: KAAN.x, y: KAAN.y, s: KAAN.s, seed: 11, phone: false }, o.kaan))]);
    if (o.hale) items.push([HALE.y, () => drawHaleX(ctx, Object.assign({ x: HALE.x, y: HALE.y, s: HALE.s, seed: 41 }, o.hale), o.hale.headRot, o.hale.arm)]);
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    if (o.line !== false) barrierLine(ctx, -500, 1500, 1900, 300, 520, 5);
  }
  function blurredSafe(key, z, cx, cy, blur, o, sx, sy) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      cam(g, z, cx, cy, sx, sy); safeWorld(g, 0, o || {});
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, -20, -20, 1120, 1960); c.filter = 'none';
    });
  }

  /* ================= GECE ODASI (pilot drawRoom) ================= */
  function drawRoom(ctx) {
    ctx.fillStyle = P.night2; ctx.fillRect(-400, -400, 1880, 2720);
    C.seed(141);
    for (let x = -300; x < 1400; x += 90) { ctx.fillStyle = 'rgba(7,11,24,.25)'; ctx.fillRect(x, -400, 40, 2800); }
    const wp = C.shape(ctx, [[60, 250], [420, 250], [420, 760], [60, 760]], P.night, { lw: 6 });
    ctx.save(); ctx.clip(wp);
    const sg = ctx.createLinearGradient(0, 250, 0, 760); sg.addColorStop(0, '#03050c'); sg.addColorStop(1, '#1d2742'); ctx.fillStyle = sg; ctx.fillRect(60, 250, 360, 510);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(238,242,255,${.3 + rnd(500 + i) * .6})`; ctx.fillRect(70 + rnd(600 + i) * 340, 260 + rnd(700 + i) * 300, 2.5, 2.5); }
    ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(330, 340, 34, 0, TAU); ctx.fill(); ctx.fillStyle = '#03050c'; ctx.beginPath(); ctx.arc(345, 332, 30, 0, TAU); ctx.fill();
    ctx.restore();
    C.line(ctx, [[240, 250], [240, 760]], 6); C.line(ctx, [[60, 505], [420, 505]], 6);
    C.shape(ctx, [[40, 760], [440, 760], [446, 790], [34, 790]], P.wood, { lw: 5 });
    C.shape(ctx, [[640, 420], [1020, 420], [1020, 440], [640, 440]], P.wood, { lw: 4 });
    C.shape(ctx, [[670, 330], [760, 330], [760, 420], [670, 420]], '#3a3d45', { lw: 4 });
    C.shape(ctx, [[790, 360], [900, 360], [900, 420], [790, 420]], P.brickDk, { lw: 4 });
  }
  function deskLamp(ctx, x, y, s, on) {   // gece masa lambası (kıskaçlı, p7-b masa lambası biçimi); taban (x,y), baş ışığı sola-yukarı
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(2851); const lw = 5;
    C.shape(ctx, [[-70, 0], [70, 0], [60, -24], [-60, -24]], P.steelDk, { lw });
    C.line(ctx, [[0, -24], [-20, -200], [-120, -300]], lw * 2.4, P.ink, .3); C.line(ctx, [[0, -24], [-20, -200], [-120, -300]], lw, P.steelLt, .2);
    C.shape(ctx, C.ell(-20, -200, 12, 12, 10), P.steel, { lw: lw * .7 });
    ctx.save(); ctx.translate(-120, -300); ctx.rotate(-.9);
    C.shape(ctx, [[-50, -20], [50, -20], [80, 50], [-80, 50]], P.steelDk, { lw });
    C.shape(ctx, C.ell(0, 50, 72, 16, 16), on ? '#fff3c4' : P.lightOff, { lw: lw * .6 });
    ctx.restore(); ctx.restore();
  }
  function darkness(ctx, holes, a) {   // gece: karanlık, ışık delikleri
    const d = layer('dark'); d.fillStyle = `rgba(4,6,16,${a})`; d.fillRect(0, 0, 1080, 1920); d.globalCompositeOperation = 'destination-out';
    holes.forEach(([x, y, r, s]) => { const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(.5, `rgba(0,0,0,${s * .55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(0, 0, 1080, 1920); });
    d.globalCompositeOperation = 'source-over'; ctx.drawImage(layers.dark, 0, 0);
  }
  function kaanBackRaised(ctx, kx, ky, s, hands, o) {   // Kaan arkadan; iki kol yukarıda (eller hands[0], hands[1] ekran koordinatı)
    o = o || {}; const lw = 5.2 / Math.sqrt(s);
    // kollar (ceket), omuzdan ellere
    const shL = [kx - 60 * s, ky - 388 * s], shR = [kx + 58 * s, ky - 388 * s];
    const elbow = (sh, h, d) => [lerp(sh[0], h[0], .45) + d * 70 * s, lerp(sh[1], h[1], .55) + 40 * s];
    C.seed(4501); C.tube(ctx, [shL, elbow(shL, hands[0], -1), hands[0]], 44 * s, 34 * s, P.jacketDk, lw * s);
    C.seed(4502); C.tube(ctx, [shR, elbow(shR, hands[1], 1), hands[1]], 44 * s, 34 * s, P.jacketDk, lw * s);
    // gövde + baş (arkadan); sarkan kollar kırpılır
    ctx.save(); ctx.beginPath(); ctx.rect(kx - 70 * s, -9000, 140 * s, 18000); ctx.rect(-9000, -9000, 18000, ky - 398 * s + 9000); ctx.clip();
    C.drawKaan(ctx, { x: kx, y: ky, s, seed: 11, pose: 'back', lw: o.lw }); ctx.restore();
  }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 13a: "Nobody got a scratch." geniş: toz alanın içinde iner, enkaz tepesi; uzakta kalabalık alkışlar; bizim şerit önde --- */
  shot('p9b13-saha', k => k.start, k => k.relief, (ctx, t, u) => {
    const k = times(), z = lerp(1.18, 1.24, E.io(seg(t, k.start, k.relief)));
    ctx.save(); cam(ctx, z, 540, 1200, 540, 1000);
    ctx.drawImage(siteBase(), -160, -140);
    crowd(ctx, t, -150, 290, 1300, .2, 81, 30, .25); crowd(ctx, t, 800, 1240, 1300, .2, 82, 30, .25);
    siteDust(ctx, t);
    // ekip bizim şeridin arkasında (kameraya yakın), sırtları dönük değil: yan duruyorlar, biri kolunu kaldırır
    [[120, 1760, 0, false], [980, 1750, 1, true]].forEach(([x, y, i, f]) => worker(ctx, x, y, .62, 420 + i, twos(t) * 7 + i, f));
    barrierLine(ctx, -200, 1300, 1830, 220, 330, 5);
    airDust(ctx, t, 18, 91, [-100, 800, 1300, 700], .6);
    ctx.restore();
    vignette(ctx, .2);
    finish(ctx);
  });

  /* --- 13b: ters açı: Kaan ve Defne şeridin arkasında; "scratch"ta derin nefes, gülümseme; arkada 200 kişi alkışlar --- */
  shot('p9b13-rahat', k => k.relief, k => k.hale, (ctx, t, u) => {
    const k = times(), tw = twos(t), rel = E.io(seg(tw, k.scratch - .1, k.scratch + .3));
    ctx.save(); cam(ctx, lerp(1.34, 1.4, E.io(u)), 280, 1350, 540, 900);
    safeWorld(ctx, t, {
      kaan: { y: KAAN.y + 6 * rel, expr: tw < k.scratch - .1 ? 'worried' : 'smile', look: tw < k.scratch ? 0 : -.5, blink: blinkAt(tw, [k.scratch + .25]) },
      defne: { expr: tw < k.scratch ? 'serious' : 'smile', look: tw < k.scratch + .2 ? 0 : 1, blink: blinkAt(tw, [k.relief + .4]), headRot: -.04 * rel, lean: -.01 * rel },
      hale: { expr: 'serious', look: -.3 }
    });
    // Kaan'ın nefesi: ağızdan küçük buhar yok (gündüz); omuz düşüşü yeterli. Hafif toz pusu sağdan geçer
    airDust(ctx, t, 22, 92, [-200, 900, 1300, 700], .7);
    ctx.restore();
    vignette(ctx, .2);
    finish(ctx);
  });

  /* --- 14: "Mr. Hale watched from beside Daisy." Kaan, Hale, Daisy yan yana; Hale izler, Kaan ona bakar --- */
  shot('p9b14-yanyana', k => k.hale, k => k.hat0, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    ctx.save(); cam(ctx, lerp(.98, 1.08, e), lerp(640, 720, e), lerp(1340, 1330, e), 540, 930);
    safeWorld(ctx, t, {
      defne: { expr: 'calm', look: .8, blink: blinkAt(tw, [k.hale + 1.3]) },
      kaan: { expr: tw < k.daisyW ? 'smile' : 'calm', look: tw < k.haleW + .1 ? .2 : 1, blink: blinkAt(tw, [k.hale + .7]) },
      hale: { expr: tw < k.daisyW - .2 ? 'serious' : 'regret', look: tw < k.haleW ? -.2 : -.6, blink: blinkAt(tw, [k.hale + 1.0]), headRot: .015 * Math.sin(tw * 1.3) },
      daisy: { mood: 'alert' }
    });
    airDust(ctx, t, 20, 93, [-200, 900, 1500, 700], .6);
    ctx.restore();
    vignette(ctx, .22);
    finish(ctx);
  });

  /* --- 15: "He took off his hat." Hale yakın; "took"ta el şapkaya, şapka kalkar, göğse iner; baş hafif eğilir --- */
  function hatArm(tw, k) {   // ikişerli dört poz → sonra drawHale hat:'hand'
    const d = tw - k.took;
    if (d < -.02) return null;
    if (d < .12) return { el: [118, -330], hand: [62, -520], hat: null, onHead: true };
    if (d < .26) return { el: [128, -360], hand: [70, -580], hat: [2, -560, -.12] };
    if (d < .4) return { el: [128, -300], hand: [96, -336], hat: [78, -318, -.7] };
    return 'hand';
  }
  shot('p9b15-sapka', k => k.hat0, k => k.silent0, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredSafe('bg-hale', 2.0, 700, 1340, 9, { kaan: { expr: 'calm' }, defne: { expr: 'calm' }, line: false }, 540, 900);
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + u * .03, 1 + u * .03); ctx.drawImage(bg, -540, -960); ctx.restore();
    const a = hatArm(tw, k), bow = a === 'hand' ? E.outC(seg(tw, k.took + .4, k.took + .8)) : 0;
    const o = { x: 640, y: 1800, s: 2.3, seed: 41, expr: a ? 'regret' : 'serious', look: a ? -.2 : -.5, blink: blinkAt(tw, [k.hat0 + .3, k.hatW + .45]) };
    ctx.save(); cam(ctx, lerp(1, 1.035, E.io(u)), 540, 960);
    if (!a) drawHaleX(ctx, Object.assign(o, { hat: true }), .01 * Math.sin(tw * 1.2));
    else if (a === 'hand') drawHaleX(ctx, Object.assign(o, { hat: 'hand' }), .07 * bow);
    else drawHaleX(ctx, Object.assign(o, { hat: a.onHead ? true : false }), 0, a);
    ctx.restore();
    // şapkadan dökülen ince toz (kaldırınca)
    if (tw >= k.took + .12) for (let i = 0; i < 14; i++) { const r = j => rnd(8100 + i * 7 + j), d = t - k.took - .12 - r(1) * .3; if (d < 0 || d > 1.6) continue; ctx.fillStyle = `rgba(216,202,176,${.7 * (1 - d / 1.6)})`; ctx.beginPath(); ctx.arc(640 + 30 + (r(2) - .5) * 260 + d * 20, 900 + d * d * 260 + r(3) * 80, 3 + r(4) * 4, 0, TAU); ctx.fill(); }
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 16–17: "Daisy stayed silent. For once." uyarı ışığı yakın, SÖNÜK; bekleriz, bip gelmez; bir toz tanesi ışığa konar; "once"ta siperlik yavaşça iner --- */
  shot('p9b16-sessiz', k => k.silent0, k => k.list, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredSafe('bg-daisy', 1.6, 980, 1420, 10, { kaan: { expr: 'calm' }, defne: { expr: 'calm' }, hale: { expr: 'regret', hat: 'hand' }, daisy: false, line: false }, 540, 700);
    ctx.drawImage(bg, 0, 0);
    ctx.fillStyle = 'rgba(21,18,13,.12)'; ctx.fillRect(0, 0, 1080, 1920);
    const push = E.io(seg(t, k.silent0, k.silent)), z = lerp(1.0, 1.16, push) + .02 * seg(t, k.silent, k.list);
    const lid = E.io(seg(t, k.once, k.once + .75));
    ctx.save(); cam(ctx, z, 540, 560, 540, 560);
    daisy(ctx, { x: 540, y: 1460, s: 2.6, mood: 'alert', lid, hook: Math.sin(t * .9) * .012 });
    // toz tanesi: yukarıdan süzülür, sönük ışığın kubbesine konar ve kalır (ışık yanmaz)
    const fall = seg(t, k.silent0 + .2, k.silent - .1), fx = 540 + 14 + Math.sin(fall * 7) * 26 * (1 - fall), fy = lerp(140, 1460 - 346 * 2.6 - 68, E.outQ(fall));
    ctx.fillStyle = 'rgba(216,202,176,.95)'; C.seed(8201); C.shape(ctx, C.ell(fx, fy, 6, 4.5, 8), P.dustLt, { lw: 2, amp: .3 });
    ctx.restore();
    airDust(ctx, t, 12, 94, [0, 0, 1080, 1100], .45);
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 18a: "Nine buildings." gündüz masa: Kaan 9. satırı kalın siyah çizgiyle çizer --- */
  shot('p9b18-cizgi', k => k.list, k => k.list2, (ctx, t, u) => {
    const k = times(), tw = t, pu = E.outQ(seg(tw, k.strike9, k.strike9 + .4));
    ctx.save(); const z = lerp(1.42, 1.5, E.io(u));
    ctx.translate(540, 760); ctx.scale(z, z); ctx.rotate(.04); ctx.translate(-330, -lineY(9) + 10);
    ctx.save(); ctx.translate(350, 440); deskTop(ctx); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(10,5,2,.3)'; ctx.fillRect(14, 16, 710, 1010); ctx.restore();
    ctx.drawImage(listPaper(), -30, -30);
    strikeLine(ctx, 9, pu);
    const y = lineY(9) - 4, x1 = 128 + lineLen(9) + 30, inU = E.outC(seg(tw, k.list, k.strike9 - .03)), outU = E.inQ(seg(tw, k.strike9 + .55, k.list2 + .05));
    kaanHandPen(ctx, lerp(26, x1, pu) + (1 - inU) * 500 + outU * 120, y + (1 - inU) * 400 - outU * 60, .1);
    ctx.restore();
    // ikindi güneşi
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(100, 200, 40, 100, 200, 1100); g.addColorStop(0, 'rgba(255,200,130,.16)'); g.addColorStop(1, 'rgba(255,200,130,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 18b–20: "Nine lines in black ink. Done." bütün liste; kalem 1→9 satırlara tıklar (ritim), "Done"da kalem bırakılır --- */
  shot('p9b19-liste', k => k.list2, k => k.night, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.save(); const z = lerp(.96, 1.0, E.io(u));
    ctx.translate(540, 730); ctx.scale(z, z); ctx.rotate(.03); ctx.translate(-350, -470);
    ctx.save(); ctx.translate(350, 440); deskTop(ctx); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(10,5,2,.3)'; ctx.fillRect(14, 16, 710, 1010); ctx.restore();
    ctx.drawImage(listPaper(), -30, -30);
    strikeLine(ctx, 9, 1);
    // tık: her satırın ucunda; uç arada kalkar (ikişerli)
    let q = -1; for (let j = 0; j < 9; j++) if (t >= k.taps[j] - .07) q = j;
    const tipX = i => 128 + lineLen(i) + 52, tipY = i => lineY(i) - 6;
    const dropU = E.outQ(seg(t, k.done - .05, k.done + .12)), away = E.inQ(seg(tw, k.done + .2, k.done + .55));
    if (t < k.done - .05) {
      let px, py, lift = 0;
      if (q < 0) { const inU = E.outC(seg(tw, k.list2, k.taps[0] - .07)); px = lerp(tipX(9) + 220, tipX(1), inU); py = lerp(lineY(9) + 180, tipY(1), inU); lift = 30 * (1 - inU); }
      else {
        const nxt = Math.min(8, q + 1), a = seg(t, k.taps[q], q < 8 ? k.taps[q + 1] - .07 : k.done - .1);
        px = lerp(tipX(q + 1), tipX(nxt + 1), q < 8 ? E.io(a) : 0); py = lerp(tipY(q + 1), tipY(nxt + 1), q < 8 ? E.io(a) : 0);
        const down = t - k.taps[q] < .06; lift = down ? 0 : 22 * Math.sin(Math.PI * clamp(a));
        if (q === 8) { const b = E.io(seg(tw, k.taps[8] + .1, k.done - .1)); px = lerp(px, 470, b); py = lerp(py, 1010, b); lift = 40 * b; }
      }
      kaanHandPen(ctx, px + lift * .4, py - lift, .1 - lift * .002);
      // tık izi: halka (yalnız uçta, kısa)
      if (q >= 0 && t >= k.taps[q] && t - k.taps[q] < .14) {   // halka yalnız tıktan sonra çizilir (eksi yarıçap üç kareyi bozuyordu) ctx.save(); ctx.strokeStyle = `rgba(21,18,13,${.5 * (1 - (t - k.taps[q]) / .14)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tipX(q + 1), tipY(q + 1), Math.max(0, 10 + (t - k.taps[q]) * 160), 0, TAU); ctx.stroke(); ctx.restore(); }
    } else {
      // kalem bırakılır: liste üstüne yatar, küçük sekme; el çekilir
      const bounce = dropU < 1 ? (1 - dropU) * 26 : Math.abs(Math.sin((t - k.done - .12) * 18)) * 6 * Math.exp(-(t - k.done - .12) * 8);
      marker(ctx, 470, 1010 - bounce, -.32 + .05 * (1 - dropU));
      if (away < 1) kaanHandPen(ctx, 470 + away * 700 - 80, 1000 - 40 * (1 - dropU) + away * 500, .1);
    }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(100, 200, 40, 100, 200, 1100); g.addColorStop(0, 'rgba(255,200,130,.16)'); g.addColorStop(1, 'rgba(255,200,130,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .25 + .1 * seg(t, k.done, k.night));
    finish(ctx);
  });

  /* --- 21: "That night I held the list up to the lamp." gece oda; Kaan arkadan, listeyi lambanın önüne kaldırır --- */
  const LIST_UP = { x: 600, y: 520, s: .66 };
  function listHold(t) { const k = times(), u = E.io(seg(twos(t), k.night + .1, k.up + .12)); return { x: lerp(560, LIST_UP.x, u), y: lerp(1060, LIST_UP.y, u), s: lerp(.6, LIST_UP.s, u), rot: lerp(-.12, .03, u), u }; }
  shot('p9b21-lamba', k => k.night, k => k.ink0, (ctx, t, u) => {
    const k = times(), tw = twos(t), L = listHold(t), z = lerp(1.0, 1.05, E.io(u));
    ctx.save(); cam(ctx, z, 540, 900, 540, 900);
    drawRoom(ctx);
    deskLamp(ctx, 930, 980, 1.3, true);
    // lamba ışığı (listenin arkasında): liste hizaya gelince parlar
    const lampX = 690, lampY = 520; glow(ctx, lampX, lampY, 520, '255,210,122', .35 + .25 * L.u);
    C.drawListLamp(ctx, { x: L.x, y: L.y, s: L.s, rot: L.rot, reveal: 0, address: ' ', seed: 99 });
    const c = Math.cos(L.rot), sn = Math.sin(L.rot), corner = (lx, ly) => [L.x + (lx * c - ly * sn) * L.s, L.y + (lx * sn + ly * c) * L.s];
    const hL = corner(-230, 330), hR = corner(230, 330);
    kaanBackRaised(ctx, 400, 1930 + 6 * Math.sin(tw * 2), 2.0, [hL, hR]);
    // başparmaklar kâğıdın önünde
    [hL, hR].forEach((h, i) => { C.seed(4600 + i); C.shape(ctx, C.ell(h[0], h[1] - 6, 26, 22, 14), P.skinDk, { lw: 4 }); C.shape(ctx, C.ell(h[0] + (i ? -8 : 8), h[1] - 28, 12, 18, 12), P.skin, { lw: 3.4 }); });
    const m = ctx.getTransform(); ctx.restore();
    darkness(ctx, [[m.a * lampX + m.e, m.d * lampY + m.f, 760, .97], [m.a * 930 + m.e, m.d * 900 + m.f, 300, .6]], .82);
    finish(ctx);
  });

  /* --- 22: "The blue ink was fresh." karalamaya yakın: ışıkta mavi; "fresh"te parıltı geçer (P1 a07'nin aynısı) --- */
  // drawListLamp yerel: W 520, H 700; 10. satır yy = 270; karalama x −184…166
  const LL = { W: 520, H: 700, yy: -350 + 80 + 9 * 60 };
  function lampScratch() { const pts = []; for (let q = 0; q < 26; q++) pts.push([-LL.W / 2 + 76 + q * 14, LL.yy - 12 + (q % 2 ? -12 : 10) + (rnd(q) - .5) * 6]); return pts; }
  function listCU(ctx, t, o) {   // lambaya tutulmuş liste, yakın; o: {cx,cy (yerel odak), z, rot, reveal, address, wet, glint}
    const tw = twos(t), jx = Math.sin(tw * 2.3) * 2.5, jy = Math.sin(tw * 1.7 + 1) * 2.5;
    ctx.fillStyle = '#0a0d18'; ctx.fillRect(0, 0, 1080, 1920);
    glow(ctx, 540, 820, 1100, '255,200,120', .25);
    ctx.save(); ctx.translate(540 + jx, (o.sy || 820) + jy); ctx.rotate(o.rot || 0); ctx.scale(o.z, o.z); ctx.translate(-o.cx, -o.cy);
    C.drawListLamp(ctx, { x: 0, y: 0, s: 1, rot: 0, reveal: o.reveal || 0, address: o.address || ' ', seed: 99 });
    if (o.addrA > 0) {   // adres: aynı kâğıt ikinci kez (adresli) üst katmanda, yalnız 10. satır, saydamlıkla (karalamanın ALTINDA kalır)
      const m = ctx.getTransform(), g = layer('adres'); g.setTransform(m);
      C.drawListLamp(g, { x: 0, y: 0, s: 1, rot: 0, reveal: o.reveal || 0, address: '7 Old Mill Lane', seed: 99 });
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath();
      const p0 = m.transformPoint(new DOMPoint(-LL.W / 2 + 70, LL.yy - 44)), p1 = m.transformPoint(new DOMPoint(LL.W / 2 - 20, LL.yy + 24));
      ctx.rect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)); ctx.clip();
      ctx.globalAlpha = o.addrA; ctx.drawImage(layers.adres, 0, 0); ctx.restore();
    }
    // ıslak parlaklık + parıltı (pilot blueScratch ile aynı fikir)
    const pts = lampScratch(), path = C.pathOf(pts, false);
    if (o.wet) { ctx.save(); ctx.globalAlpha = o.wet * (1 - .55 * (o.reveal || 0)); ctx.strokeStyle = BLUE_WET; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke(path); ctx.restore(); }
    if (o.glint != null && o.glint >= 0 && o.glint <= 1) {
      const x0 = -LL.W / 2 + 76, x1 = x0 + 25 * 14, gx = lerp(x0 - 60, x1 + 60, o.glint), a = Math.sin(Math.PI * o.glint);
      const g = ctx.createLinearGradient(gx - 40, 0, gx + 40, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(235,245,255,${.95 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = 3.4; ctx.lineJoin = 'round'; ctx.stroke(path); ctx.restore();
    }
    // başparmaklar (alt kenar): liste elde
    if (o.thumbs === true) [[-LL.W / 2 + 60, LL.H / 2 - 6, 0], [LL.W / 2 - 60, LL.H / 2 - 4, 1]].forEach(([x, y, i]) => { C.seed(4610 + i); C.shape(ctx, [[x - 34, y + 60], [x - 26, y - 14], [x - 6, y - 30], [x + 18, y - 22], [x + 26, y + 6], [x + 30, y + 60]], P.skin, { lw: 4, shade: c => C.blot(c, [[x + 6, y - 40], [x + 40, y - 40], [x + 40, y + 70], [x + 10, y + 70]], P.skinDk, .55) }); C.shape(ctx, [[x - 18, y - 16], [x + 4, y - 26], [x + 14, y - 14], [x - 8, y - 6]], '#e7b896', { lw: 2.2 }); });
    const m = ctx.getTransform(); ctx.restore();
    return m;
  }
  shot('p9b22-murekkep', k => k.ink0, k => k.mem1, (ctx, t, u) => {
    const k = times(), glint = t >= k.fresh && t < k.fresh + .42 ? (t - k.fresh) / .42 : -1;
    const m = listCU(ctx, t, { cx: lerp(-30, 0, E.io(u)), cy: LL.yy - 10, z: lerp(2.2, 2.55, E.io(u)), rot: -.02, wet: .9, glint, sy: 760 });
    if (glint >= 0) {   // parıltı yıldızı (tek sefer)
      const x0 = -LL.W / 2 + 76, x1 = x0 + 25 * 14, gp = m.transformPoint(new DOMPoint(lerp(x0 - 60, x1 + 60, glint), LL.yy - 16)), a = Math.sin(Math.PI * glint);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.translate(gp.x, gp.y);
      ctx.beginPath(); for (let q = 0; q < 8; q++) { const r = q % 2 ? 6 : 34 * a + 6, an = q / 8 * TAU; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
    }
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 23a: gri hatıra (0,5 sn, sessiz): P1 — Kaan'ın parmak ucunda taze mavi leke; leke mavi kalır --- */
  const WOOD = '#5e3b1d', WOOD_DK = '#3f2711', WOOD_LT = '#7a5130';
  function table(ctx, x0, y0, x1, y1) {   // pilot masa (ahşap)
    ctx.fillStyle = WOOD; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    C.seed(301);
    for (let yy = Math.floor(y0 / 210) * 210; yy < y1; yy += 210) {
      C.line(ctx, [[x0, yy], [x1, yy + 6]], 4, WOOD_DK, 1.5);
      for (let g = 0; g < 7; g++) { const gy = yy + 20 + g * 27 + TB.rand(yy + g) * 10, pts = []; for (let gx = x0; gx <= x1; gx += 60) pts.push([gx, gy + Math.sin(gx * .006 + g + yy) * 6]); stroke(ctx, pts, 2, g % 2 ? WOOD_DK : WOOD_LT, .45); }
    }
  }
  function drawFinger(ctx, o) {   // pilot drawHand (pad: parmak ucu kameraya); mavi lekeyi ayrı döndürür
    const s = o.s || 1, lw = 5 / s;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang || 0); ctx.scale(s, s); C.seed(71);
    C.shape(ctx, [[-760, -66], [-248, -60], [-236, 64], [-760, 70]], P.jacket, { lw, shade: c => C.blot(c, [[-760, 24], [-230, 22], [-230, 80], [-760, 80]], '#0b1f2a', .3) });
    C.shape(ctx, [[-286, -62], [-252, -61], [-246, 64], [-282, 66]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-252, -50], [-156, -58], [-114, -40], [-106, 8], [-118, 52], [-204, 60], [-250, 50]], P.skin, { lw, shade: c => C.blot(c, [[-260, 18], [-100, 18], [-100, 70], [-260, 70]], P.skinDk, .55) });
    [[-128, 34], [-154, 48], [-182, 54]].forEach(([a, b], i) => { C.shape(ctx, C.ell(a, b, 22, 15, 14), i % 2 ? P.skinDk : P.skin, { lw: lw * .8 }); });
    const fp = [[-124, -36], [-60, -30], [-18, -24], [-2, -14], [4, 0], [-2, 13], [-20, 19], [-62, 14], [-122, 8]];
    C.shape(ctx, fp, P.skin, { lw, shade: c => C.blot(c, [[-130, 6], [10, 6], [10, 24], [-130, 24]], P.skinDk, .5) });
    C.line(ctx, [[-66, -26], [-62, -10]], lw * .5, P.skinDk, .3);
    C.shape(ctx, [[-214, -50], [-160, -82], [-112, -76], [-112, -58], [-160, -46]], P.skin, { lw });
    if (o.blue) {
      C.seed(77); const sm = C.shape(ctx, [[-40, -10], [-24, -19], [-6, -15], [3, -3], [-2, 11], [-18, 17], [-36, 10], [-46, 2]], o.blue, { lw: 0, amp: 1.6 });
      ctx.save(); ctx.clip(sm); ctx.strokeStyle = 'rgba(160,190,255,.55)'; ctx.lineWidth = 1.6;
      for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.ellipse(-16, 0, 6 + q * 6, 4 + q * 4, 0, Math.PI * .6, Math.PI * 1.9); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = BLUE; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(-54, 6, 3, 0, TAU); ctx.arc(-50, -12, 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function memoryFrame(ctx, draw, colorDraw) {   // gri: önce sahne griye, sonra tek renkli öğe (mavi) üstte
    const m = layer('mem'); draw(m);
    ctx.fillStyle = '#211d19'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.filter = SEPIA; ctx.drawImage(layers.mem, 0, 0); ctx.filter = 'none';
    if (colorDraw) { const c2 = layer('memc'); colorDraw(c2); ctx.drawImage(layers.memc, 0, 0); }
    vignette(ctx, 0, 'rgba(20,16,12,.85)');
  }
  shot('p9b23-hatira1', k => k.mem1, k => k.old, (ctx, t, u) => {
    const z = 2.7 * (1 + .02 * u), LX = 190, LY = 380, fx = LX + 420, fy = LY + 940;
    const scene = (g, blueOnly) => {
      if (!blueOnly) { g.save(); cam(g, z, fx, fy); table(g, -400, -200, 1500, 2400); g.translate(LX, LY); g.fillStyle = 'rgba(10,5,2,.35)'; g.fillRect(14, 16, 710, 1010); g.drawImage(listPaper(), -30, -30); g.restore(); }
      if (!blueOnly) drawFinger(g, { x: 770, y: 560, ang: Math.PI * 1.36, s: 2.7 });
      else { g.save(); g.beginPath(); g.translate(770, 560); g.rotate(Math.PI * 1.36); g.scale(2.7, 2.7); g.rect(-60, -26, 70, 48); g.restore(); g.clip(); drawFinger(g, { x: 770, y: 560, ang: Math.PI * 1.36, s: 2.7, blue: BLUE }); }
    };
    memoryFrame(ctx, g => scene(g, false), g => scene(g, true));
    finish(ctx);
  });

  /* --- 23b: "…this year." lambada: eski siyah satırlar (sararmış) → aşağı kayar, taze mavi --- */
  shot('p9b23-eskiyeni', k => k.old, k => k.mem2, (ctx, t, u) => {
    const k = times(), e = E.io(seg(t, k.old, k.year + .1));
    listCU(ctx, t, { cx: lerp(40, -10, e), cy: lerp(-350 + 80 + 5 * 60, LL.yy - 10, e), z: lerp(1.7, 2.0, e), rot: lerp(.03, -.02, e), wet: .7, sy: 800 });
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 24a: gri hatıra (0,5 sn, sessiz): P4 — ofis masasında kalemlik, TEK mavi kalem; kalem mavi kalır --- */
  function penCupTop(ctx, blueOnly) {   // p4-a'daki üstten kalemlik (aynı ölçü, aynı açılar)
    ctx.save(); ctx.translate(0, 0); C.seed(621);
    if (!blueOnly) { ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(12, 14, 64, 64, 0, 0, TAU); ctx.fill(); ctx.restore(); C.shape(ctx, C.ell(0, 0, 62, 62, 24), P.steelLt, { lw: 4.4 }); C.shape(ctx, C.ell(0, 0, 50, 50, 20), '#3a3d45', { lw: 2 }); }
    [[-22, -10, -2.3, '#8b6a3e'], [20, 14, .7, P.brickDk], [6, -22, -1.2, BLUE], [-6, 22, 2.1, '#8b6a3e']].forEach(([x, y, a, col]) => {
      if (blueOnly !== (col === BLUE)) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); C.shape(ctx, [[0, -7], [92, -7], [104, 0], [92, 7], [0, 7]], col, { lw: 3 }); ctx.restore();
    });
    ctx.restore();
  }
  shot('p9b24-hatira2', k => k.mem2, k => k.lamp, (ctx, t, u) => {
    const z = 2.4 * (1 + .025 * u);
    const scene = (g, blueOnly) => {
      g.save(); g.translate(540, 820); g.scale(z, z); g.rotate(-.1); g.translate(-20, 30);
      if (!blueOnly) {
        g.fillStyle = P.wood; g.fillRect(-600, -600, 1200, 1200); C.seed(611);
        for (let i = -3; i < 4; i++) C.line(g, [[-600, 120 + i * 220], [600, 140 + i * 220 + (i % 2 ? 8 : -6)]], 2.6, 'rgba(21,18,13,.35)', 1.6);
        g.save(); g.translate(240, 120); g.rotate(-.12); C.seed(622); C.shape(g, [[-150, -24], [150, -24], [150, 24], [-150, 24]], '#dfe5e2', { lw: 4 }); g.restore();
        g.save(); g.translate(-250, 200); g.rotate(.05); C.seed(623); C.shape(g, [[-160, -120], [160, -120], [160, 140], [-160, 140]], '#e4ebe9', { lw: 4, shade: c => { c.strokeStyle = 'rgba(36,64,143,.4)'; c.lineWidth = 2; for (let q = 0; q < 6; q++) { c.beginPath(); c.moveTo(-130, -90 + q * 40); c.lineTo(120, -90 + q * 40); c.stroke(); } } }); g.restore();
      }
      penCupTop(g, blueOnly);
      g.restore();
    };
    memoryFrame(ctx, g => scene(g, false), g => scene(g, true));
    finish(ctx);
  });

  /* --- 24b–25a: "…pen. / Under it," liste lambaya yaklaşır; ışık güçlenir, karalamanın altı belirmeye başlar --- */
  function addrA(t) { const k = times(); return E.io(seg(t, k.rev0, k.rev1)); }
  shot('p9b25-yaklas', k => k.lamp, k => k.revCut, (ctx, t, u) => {
    const k = times(), r = addrA(t), e = E.io(u);
    listCU(ctx, t, { cx: lerp(20, 0, e), cy: lerp(80, LL.yy - 40, e), z: lerp(1.2, 1.55, e), rot: lerp(-.05, -.02, e), reveal: r * .6, addrA: r, wet: .5, sy: 760 });
    glow(ctx, 540, 700, 900, '255,226,150', .12 + .18 * e);
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 25b: "I could finally read an address." adrese yakın; mavi solar, el yazısı okunur: 7 Old Mill Lane --- */
  shot('p9b25-adres', k => k.revCut, k => k.face, (ctx, t, u) => {
    const k = times(), r = addrA(t), e = E.io(u);
    listCU(ctx, t, { cx: lerp(-20, 0, e), cy: LL.yy - 14, z: lerp(2.35, 2.5, e), rot: -.02, reveal: .6 + .4 * r, addrA: r, wet: .3, sy: 760 });
    glow(ctx, 540, 740, 700, '255,226,150', .22);
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 26–27a: "I knew that address. I have known it my whole life." Kaan'ın yüzü, listenin ışığında: şaşkın → kararlı; pencereye döner --- */
  shot('p9b26-yuz', k => k.face, k => k.win, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = cached('bg-oda', 1080, 1920, c => { const tmp = canvas(1080, 1920), g = tmp.getContext('2d'); cam(g, 1.5, 600, 700, 540, 800); drawRoom(g); deskLamp(g, 930, 980, 1.3, true); c.filter = 'blur(10px)'; c.drawImage(tmp, -20, -20, 1120, 1960); c.filter = 'none'; });
    ctx.drawImage(bg, 0, 0);
    ctx.fillStyle = 'rgba(4,6,16,.55)'; ctx.fillRect(0, 0, 1080, 1920);
    const turn = E.outC(seg(tw, k.whole, k.whole + .3));
    const expr = tw < k.knew ? 'calm' : tw < k.known ? 'surprised' : 'determined';
    const look = tw < k.knew ? .1 : tw < k.whole ? 0 : lerp(0, -1, turn);
    ctx.save(); cam(ctx, lerp(1.0, 1.06, E.io(u)), 540, 760, 540, 760);
    const ks = 3.2, ky = 640 + 468 * ks + 4 * Math.sin(tw * 2), kx = 520 - 30 * turn;
    C.drawKaan(ctx, { x: kx, y: ky, s: ks, seed: 11, expr, look, blink: blinkAt(tw, [k.face + .35, k.known - .25]), phone: false });
    // listenin arkası (alt önde, bulanık, ışık sızar)
    ctx.save(); ctx.filter = 'blur(6px)'; ctx.translate(560, 1560); ctx.rotate(.04); C.seed(4700);
    C.shape(ctx, [[-430, -170], [430, -180], [440, 520], [-440, 520]], '#f3dfb0', { lw: 6, shade: c => { const g = c.createRadialGradient(80, 40, 30, 80, 40, 520); g.addColorStop(0, 'rgba(255,250,225,.95)'); g.addColorStop(1, 'rgba(210,170,110,.7)'); c.fillStyle = g; c.fillRect(-500, -300, 1000, 900); } });
    ctx.restore();
    ctx.restore();
    // yüze aşağıdan sıcak ışık (kâğıttan yansır)
    glow(ctx, 540, 1250, 900, '255,214,140', .28);
    darkness(ctx, [[540, 900, 900, .9]], .35);
    finish(ctx);
  });

  /* --- 27b + bitiş: pencereden gece avlusu; Daisy avluda, ışık üst üçte birde; TEK bip, sonra kartın altında yavaş itme --- */
  const YD = { hz: 1920 * .56 };
  const YDAISY = { x: 640, y: 1520, s: .8 }, YBEACON = [640, 1520 - 346 * .8];
  function yardNight() {
    return cached('avlu-gece', 1500, 2700, g => {
      g.translate(210, 300);
      const sk = ['#03050c', '#0a1124', '#1d2742'], sg = g.createLinearGradient(0, -300, 0, YD.hz); sg.addColorStop(0, sk[0]); sg.addColorStop(.6, sk[1]); sg.addColorStop(1, sk[2]); g.fillStyle = sg; g.fillRect(-210, -300, 1500, YD.hz + 300);
      g.fillStyle = '#2a2f3a'; g.fillRect(-210, YD.hz, 1500, 2400 - YD.hz);
      C.drawYard(g, { seed: 7, mode: 'night', letter: false, lightOn: false });
      [[-210, 0], [1080, 1290]].forEach(([a, b]) => {
        g.save(); g.beginPath(); g.rect(a, YD.hz - 220, b - a, 2600); g.clip();
        let cx = a; while (cx < b) { const bw = 60 + rnd(cx + 9000) * 70, bh = 60 + rnd(cx + 9100) * 150; C.seed(5500 + Math.round(cx)); C.shape(g, [[cx, YD.hz], [cx, YD.hz - bh], [cx + bw, YD.hz - bh], [cx + bw, YD.hz]], '#161d2b', { lw: 2, ink: '#10161f', amp: .5 }); cx += bw + 10; }
        const gg = g.createLinearGradient(0, YD.hz, 0, 2400); gg.addColorStop(0, '#3a3a3a'); gg.addColorStop(1, '#2a2622'); g.fillStyle = gg; g.fillRect(a, YD.hz, b - a, 2400 - YD.hz);
        g.fillStyle = 'rgba(10,17,36,.55)'; g.fillRect(a, YD.hz - 220, b - a, 2620);
        g.restore();
      });
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(238,242,255,${.3 + rnd(8500 + i) * .6})`; g.fillRect(-200 + rnd(8600 + i) * 1480, -290 + rnd(8700 + i) * 820, 2.5, 2.5); }
    });
  }
  function windowFrame(ctx, a) {   // Kaan'ın penceresi (içeriden): kalın ahşap kasa, orta kayıt, camda soluk yansıma
    ctx.save(); ctx.globalAlpha = a;
    const X0 = 40, X1 = 1040, Y0 = 150, Y1 = 1800, Wd = 64;
    ctx.fillStyle = '#0e1220'; ctx.beginPath(); ctx.rect(-600, -600, 2280, 3120); ctx.rect(X1, Y0, X0 - X1, Y1 - Y0); ctx.fill('evenodd');
    C.seed(8801);
    C.shape(ctx, [[X0 - Wd, Y0 - Wd], [X1 + Wd, Y0 - Wd], [X1 + Wd, Y0], [X0 - Wd, Y0]], '#3f2711', { lw: 5 });
    C.shape(ctx, [[X0 - Wd, Y1], [X1 + Wd, Y1], [X1 + Wd + 20, Y1 + Wd], [X0 - Wd - 20, Y1 + Wd]], P.wood, { lw: 5 });
    C.shape(ctx, [[X0 - Wd, Y0], [X0, Y0], [X0, Y1], [X0 - Wd, Y1]], '#3f2711', { lw: 5 });
    C.shape(ctx, [[X1, Y0], [X1 + Wd, Y0], [X1 + Wd, Y1], [X1, Y1]], '#3f2711', { lw: 5 });
    C.shape(ctx, [[200 - 18, Y0], [200 + 18, Y0], [200 + 18, Y1], [200 - 18, Y1]], '#3f2711', { lw: 4 });
    C.shape(ctx, [[X0, 1480 - 16], [X1, 1480 - 16], [X1, 1480 + 16], [X0, 1480 + 16]], '#3f2711', { lw: 4 });
    ctx.fillStyle = 'rgba(160,190,230,.05)'; ctx.beginPath(); ctx.moveTo(X0 + 60, Y0); ctx.lineTo(X0 + 200, Y0); ctx.lineTo(X0 + 40, Y1); ctx.lineTo(X0, Y1); ctx.fill();
    ctx.restore();
  }
  shot('p9b27-pencere', k => k.win, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = frozen(t), ft = flow(t);
    const e = E.io(seg(tf, k.win, k.endF0)), after = E.io(seg(t, k.endF1, k.dur));
    const z = lerp(1.12, 1.3, e) + .04 * after, sy = lerp(560, 450, e) - 8 * after;
    ctx.save(); cam(ctx, z, YBEACON[0], YBEACON[1], 540, sy);
    ctx.drawImage(yardNight(), -210, -300);
    // ay ışığı Daisy'nin tavanında (ışık sönükken de okunur)
    glow(ctx, YBEACON[0] - 40, YBEACON[1] - 40, 300, '150,170,220', .2);
    daisy(ctx, { x: YDAISY.x, y: YDAISY.y, s: YDAISY.s, mood: 'sleepy', hook: Math.sin(ft * .9) * .02 });
    ctx.fillStyle = 'rgba(10,17,36,.5)'; ctx.fillRect(-300, -400, 1700, 2900);
    glow(ctx, YBEACON[0] - 30, YBEACON[1] + 30, 200, '170,190,235', .16);
    ctx.save(); ctx.translate(YDAISY.x, YDAISY.y); ctx.scale(YDAISY.s, YDAISY.s); C.seed(23);   // sönük ışık kubbesi, gecede seçilsin
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOff, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    drawBeacon(ctx, beepV(t, k.endBeep));
    ctx.restore();
    // otlar (rüzgâr); bip penceresinde donar
    for (let i = 0; i < 14; i++) {
      const r = j => rnd(9100 + i * 9 + j), x = -100 + r(1) * 1300, y = 1360 + r(2) * 600, ph = r(3) * 6;
      for (let q = 0; q < 5; q++) { const sw = Math.sin(ft * 2.2 + ph + q * .5) * 6, hh = 18 + r(4 + q) * 18; ctx.strokeStyle = '#3c4430'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + q * 4, y); ctx.quadraticCurveTo(x + q * 4 + (q - 2) * 3, y - hh * .6, x + q * 4 + (q - 2) * 4 + sw, y - hh); ctx.stroke(); }
    }
    ctx.restore();
    // pencere kasası: önde, kamera ilerledikçe kadrajdan çıkar (parallaks)
    const fz = lerp(1.0, 1.65, e) + .06 * after;
    ctx.save(); ctx.translate(540, 900); ctx.scale(fz, fz); ctx.translate(-540, -900); windowFrame(ctx, 1); ctx.restore();
    if (beepV(t, k.endBeep) > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,90,60,.05)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); }
    vignette(ctx, .35);
    const dk = .45 * E.io(seg(t, k.endCard - .1, k.endCard + .2)); if (dk > 0) { const g = ctx.createLinearGradient(0, 600, 0, 900); g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(1, `rgba(7,11,24,${dk})`); ctx.fillStyle = g; ctx.fillRect(0, 600, 1080, 1320); }
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const f3 = x => +x.toFixed(3);
  TB.cuesB = {
    get alkis() { return f3(times().start + .1); },                 // uzak kalabalık alkışı (13a–14 boyunca, yumuşak)
    get rahatNefes() { return f3(times().scratch); },               // Kaan derin nefes verir
    get sapkaKalkar() { return f3(times().took); },                 // Hale'in eli şapkada (kumaş)
    get sapkaGogse() { return f3(times().took + .4); },             // şapka göğse iner
    get sessizlikBas() { return f3(times().silent0); },             // Daisy yakın: müzik solar, BİP YOK (ışık sönük kalır)
    get sessizlikSon() { return f3(times().list); },
    get tozKonar() { return f3(times().silent - .1); },             // toz tanesi sönük ışığa konar (sessiz; ses koymayın)
    get siperlikIner() { return f3(times().once); },                // siperlik yavaşça iner (küçük metal gıcırtı, bip DEĞİL)
    get kalemCizgi9() { return f3(times().strike9); },              // keçeli kalem, 9. satır (0,4 sn)
    get kalemTik1() { return f3(times().taps[0]); }, get kalemTik2() { return f3(times().taps[1]); }, get kalemTik3() { return f3(times().taps[2]); },
    get kalemTik4() { return f3(times().taps[3]); }, get kalemTik5() { return f3(times().taps[4]); }, get kalemTik6() { return f3(times().taps[5]); },
    get kalemTik7() { return f3(times().taps[6]); }, get kalemTik8() { return f3(times().taps[7]); }, get kalemTik9() { return f3(times().taps[8]); },
    get kalemBirakilir() { return f3(times().done + .12); },        // kalem kâğıda düşer, küçük sekme
    get listeKaldirilir() { return f3(times().night + .1); },       // kâğıt hışırtısı DEĞİL: kısa kâğıt sesi (liste lambaya)
    get murekkepTink() { return f3(times().fresh); },               // parıltı: P1'deki "tink"in aynısı
    get hatiraP1() { return f3(times().mem1); },                    // gri hatıra (sessiz)
    get hatiraP4() { return f3(times().mem2); },                    // gri hatıra (sessiz)
    get adresBelirir() { return f3(times().rev0); },                // adres belirir (yumuşak ton, isteğe bağlı)
    get pencere() { return f3(times().win); },                      // gece avlusu: cırcır böceği, uzak rüzgâr
    get sonBip() { return f3(times().endBeep); }                    // tek bip; ışık +0,04–0,24
  };
})();
