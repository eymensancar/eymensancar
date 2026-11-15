/* Part 5 · H AND K — Animatör B: cümle 13–25 ve bitiş görüntüsü. Başlangıç (S12.t1+S13.t0)/2 ≈ 23,21 sn, bitiş tl.duration.
   YERLEŞİM (dünya koordinatları; A'nın p5-a.js'i ile aynı tutulur):
   - MASA (üstten, gece, lamba sağ üstte): DESK ahşap; dedenin defteri NB (drawNotebook lastPage) solda, liste LST (pilot
     a-sahneler drawList, 700×1000 yerel, katlı alt kanat = 10. satır görünmez) sağda. 9. satır yerel y 822 (karalama y 832).
   - TERS AÇI (masadan Kaan'a bakış; ofisin ön duvarı, solda tek pencere x 40–330, y 260–640 ekran): Kaan oturur, ön planda
     KA {x:420,y:2180,s:2.5}; Defne omzunun sağ arkasında DF {x:700,y:1800,s:2.3}; lamba ışığı önden-sağdan.
   - PENCERE (iç): çerçeve ahşap, dışarısı gece gök + uzak çit + avlu lambası; kuş yok.
   - 9 NUMARA: drawHaleTower {x:0,y:0,w:1080,h:1920,mode:'night',towerX:.62} → kule x 507–831, üst y 115, taban hz 1651;
     kapıdaki tabela (y≈1560–1600) hep önündeki eski çatıların (y>1330) arkasında kalır: okunmaz.
   - BİTİŞ: gece avlu; kule uzakta solda (ekranda üst y≈110, taban ≈880 eski çatıların arkasında), Daisy önde sağda
     {x:790,y:872,s:.8} (uyarı ışığı ≈(790,595): üst üçte bir). Tek bip endBeep'te; kart altta. */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;
  const ones = t => Math.floor(t * FPS + 1e-6) / FPS;

  /* ================= ZAMANLAR (hepsi timeline'dan) ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1], c = tl.cues;
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const mid = i => (S(i).t1 + S(i + 1).t0) / 2, L = .12;
    const k = {};
    k.start = mid(12);                                   // A ile ortak kesme (≈23,21)
    k.job = W(13, /^job/i, 6).t0;                         // eller masadan çekilir
    k.c14 = S(14).t0 - L;                                 // listenin üstü, yakın; sessizlik
    k.c15 = S(15).t0 - L;                                 // ters açı: Defne omzunun üstünden
    k.lean = W(15, /^over/i, 3).t0 - .1;                  // Defne eğilir
    k.c16 = S(16).t0 - L;                                 // iki yüz, sessizlik
    k.glance = W(16, /^long/i, 6).t0;                     // Kaan Defne'ye kaçamak bakar
    k.c17 = S(17).t0 - L;                                 // Defne yakın
    k.turn = W(17, /^asked/i, 2).t0;                      // Defne başını Kaan'a çevirir
    k.brow = W(17, /^exams/i, 5).t0 - .05;                // kaş kalkar
    k.q0 = W(17, /^how/i, 3).t0; k.q1 = S(17).t1;
    k.c18 = S(18).t0 - L;                                 // "Look, a bird." Kaan gösterir
    k.point = W(18, /^look/i, 2).t0 - .22;
    k.c19 = S(19).t0 - L;                                 // boş pencere
    k.c19b = S(19).t1 + .12;                              // Defne'nin bakışı; Kaan telefonu kaldırır
    k.lift = k.c19b + .25;
    k.c20 = W(20, /^game/i, 3).t0 - .12;                  // telefon yakın: gerçek oyun (≤3 sn)
    k.tap = k.c20 + .2;
    k.c21 = mid(20);                                      // sert kesme: listede 9. satır
    k.finger = c.address - .25;                           // parmak 9. satırın başına
    k.c22 = S(22).t0 - L;                                 // "Slowly." parmak satır boyunca
    k.c23 = mid(22);                                      // gece şehir, eski çatılar ve kule
    k.c24 = S(24).t0 - L;                                 // kule boyunca yukarı
    k.c25 = S(25).t0 - L;                                 // ışıklı pencerelerde insanlar
    k.endShot = S(25).t1 + .14;                           // bitiş görüntüsü
    k.endBeep = c.endBeep; k.endCard = c.endCard; k.dur = tl.duration;
    K = k; return k;
  }
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* Tek bip: daisy-beep.wav ilk tonu 0,04–0,24 sn (6 kare yanık). Bip penceresi (−0,3 … ton sonu + 10 kare) donar. */
  const TONES = [[.04, .24], [.37, .57]];
  function beepAt(t, t0, n) { const d = t - t0; let v = 0; for (let i = 0; i < (n || 2); i++) if (d >= TONES[i][0] - 1e-6 && d < TONES[i][1] - 1e-6) v = i ? 1 : .8; return v; }
  const freezeIn = (t, t0, n) => { const a = t0 - .3, b = t0 + TONES[(n || 2) - 1][1] + 10 / FPS; return t >= a && t < b ? a : t; };

  /* ================= YARDIMCILAR ================= */
  function cam(ctx, z, cx, cy, sx, sy) { ctx.translate(sx == null ? 540 : sx, sy == null ? 960 : sy); ctx.scale(z, z); ctx.translate(-cx, -cy); }
  const toScr = (z, cx, cy, sx, sy) => (x, y) => [(sx == null ? 540 : sx) + (x - cx) * z, (sy == null ? 960 : sy) + (y - cy) * z];
  function finish(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; C.grain(ctx, 0, 0, 1080, 1920, .2); }
  function vignette(ctx, a, col) {
    const g = ctx.createRadialGradient(540, 860, 300, 540, 900, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col || `rgba(7,11,24,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const cache = {};
  function cached(key, w, h, fn) { if (!cache[key]) { const cv = canvas(w, h); fn(cv.getContext('2d')); cache[key] = cv; } return cache[key]; }
  function blurred(key, blur, fn) { return cached(key, 1080, 1920, c => { const tmp = canvas(1080, 1920); fn(tmp.getContext('2d')); c.filter = `blur(${blur}px)`; c.drawImage(tmp, 0, 0); c.filter = 'none'; }); }
  let darkCv = null;
  function nightLight(ctx, holes, a, col) {
    if (!darkCv) darkCv = canvas(1080, 1920);
    const d = darkCv.getContext('2d'); d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, 1080, 1920);
    d.fillStyle = col || `rgba(4,6,16,${a})`; d.fillRect(0, 0, 1080, 1920); d.globalCompositeOperation = 'destination-out';
    holes.forEach(([x, y, r, s, ry]) => {
      d.save(); d.translate(x, y); d.scale(1, (ry || r) / r);
      const g = d.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(.55, `rgba(0,0,0,${s * .6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(-r, -r, 2 * r, 2 * r); d.restore();
    });
    d.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkCv, 0, 0); ctx.restore();
  }
  function glow(ctx, x, y, r, rgb, a) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 4, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore(); }
  function airDust(ctx, t, n, sb, box, a) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (6 + r(2) * 18)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(216,202,176,${a * (.3 + r(5) * .5)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + r(6) * 3.4, 0, TAU); ctx.fill();
    }
  }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }
  function limb(ctx, A, B, wa, wb, fill, sd) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    return C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 6, shade: c => C.blot(c, [[A[0] - nx * wa * .1, A[1] - ny * wa * .1], [B[0] - nx * wb * .1, B[1] - ny * wb * .1], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], P.jacketDk, .55) });
  }
  function stroke(ctx, pts, lw, col, alpha) {
    ctx.save(); if (alpha != null) ctx.globalAlpha *= alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.stroke(C.pathOf(C.wobble(pts, false, lw * .18, 6), false)); ctx.restore();
  }
  function smooth(pts, n) {
    n = n || 5; if (pts.length < 3) return pts; const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let q = 0; q < n; q++) { const t = q / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(d => .5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3))); }
    }
    out.push(pts[pts.length - 1]); return out;
  }

  /* ================= LİSTE (pilot a-sahneler.js'den kopya: aynı kâğıt, aynı satırlar) ================= */
  const PAPER = '#eadfc2', PAPER_BK = '#d9caa5', INK_OLD = '#3a3026';
  const lineY = i => i <= 9 ? 150 + (i - 1) * 84 : 948;
  const lineLen = i => 300 + TB.rand(i * 97 + 3) * 210;
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
  function hand_num(ctx, str, x, y, h, lw, col, sd, alpha) {
    const sc = h / 1.6; let cx = x;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '.') { ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + lw * .6, y + h - lw * .5, lw * .75, 0, TAU); ctx.fill(); ctx.restore(); cx += lw * 2.6; continue; }
      const d = DIG[ch]; if (!d) { cx += sc * .5; continue; }
      C.seed(sd + i * 13 + ch.charCodeAt(0));
      const pts = (ch === '0' ? d.concat([d[0]]) : smooth(d, 5)).map(([u, v]) => [cx + (u + (1.6 - v) * .12) * sc, y + v * sc]);
      stroke(ctx, pts, lw, col, alpha); cx += sc * (ch === '1' ? .78 : 1.08);
    }
    return cx - x;
  }
  function scrawl(ctx, x, y, len, lw, col, sd, alpha, upto) {
    const r = TB.rand; let cx = x, w = 0;
    while (cx < x + len) {
      if (upto != null && cx > upto) break;
      const nL = 2 + Math.floor(r(sd + w * 7) * 6), pts = [];
      let th = 0; const base = y + (r(sd + w * 11) - .5) * 4;
      for (let L = 0; L < nL; L++) {
        const hh = 10 + r(sd + w * 31 + L * 5) * 10 + (r(sd + w * 17 + L * 3) < .22 ? 16 : 0);
        for (let q = 0; q < 8; q++) { const a = th + q / 8 * TAU; pts.push([cx + a * 2.6 - Math.sin(a) * 7, base - hh * (1 - Math.cos(a)) / 2]); }
        th += TAU;
      }
      pts.push([cx + th * 2.6 + 4, base]);
      C.seed(sd + w * 3); stroke(ctx, pts, lw, col, alpha);
      cx += th * 2.6 + 18 + r(sd + w * 5) * 14; w++;
      if (w > 12) break;
    }
  }
  function paperBase(ctx, y0, y1) {
    C.seed(401 + y0);
    C.shape(ctx, [[0, y0], [700, y0], [700, y1], [0, y1]], PAPER, {
      lw: 3.2, amp: .8, shade: c => {
        const g = c.createLinearGradient(0, 0, 700, 0); g.addColorStop(0, 'rgba(150,110,60,.22)'); g.addColorStop(.1, 'rgba(150,110,60,0)'); g.addColorStop(.9, 'rgba(150,110,60,0)'); g.addColorStop(1, 'rgba(150,110,60,.25)');
        c.fillStyle = g; c.fillRect(0, y0, 700, y1 - y0);
        if (y0 < 260) { c.save(); c.globalAlpha = .28; c.strokeStyle = '#a07a45'; c.lineWidth = 7; C.seed(5); c.stroke(C.pathOf(C.wobble(C.ell(565, 190, 74, 70, 30), true, 3, 10), true)); c.restore(); }
        for (let q = 0; q < 22; q++) { const px = TB.rand(q * 5 + 1) * 700, py = TB.rand(q * 9 + 2) * 1000; if (py < y0 || py > y1) continue; c.fillStyle = `rgba(160,118,62,${.08 + TB.rand(q) * .14})`; c.beginPath(); c.arc(px, py, 3 + TB.rand(q * 3) * 10, 0, TAU); c.fill(); }
      }
    });
  }
  function listLine(ctx, i) { const y = lineY(i); hand_num(ctx, i + '.', 34, y - 30, 44, 4.2, INK_OLD, 900 + i * 31, .85); scrawl(ctx, 122, y + 10, lineLen(i), 3.2, INK_OLD, 1200 + i * 57, .8); }
  function header(ctx) {
    hand_num(ctx, '10', 52, 40, 54, 5, INK_OLD, 77, .9);
    C.seed(78); stroke(ctx, C.ell(92, 66, 62, 44, 22).concat([[148, 52]]), 3.6, INK_OLD, .8);
    scrawl(ctx, 190, 92, 300, 3.6, INK_OLD, 4400, .85);
    C.seed(79); stroke(ctx, [[186, 108], [360, 104], [520, 110]], 3, INK_OLD, .7);
  }
  // açık liste, alt kanat (10. satır) arkaya katlı: görünmez. Önbellekte tek görüntü (yerel 700×1000 → 2× çözünürlük).
  function listCv() {
    return cached('liste', 1480, 2000, c => {
      c.scale(2, 2); c.translate(20, 0);
      paperBase(c, 0, 900);
      header(c); for (let i = 1; i <= 9; i++) listLine(c, i);
      c.save(); c.globalAlpha = .5; c.fillStyle = '#b39b6b'; c.fillRect(2, 892, 696, 8); c.restore();
      c.save(); c.globalAlpha = .3; C.seed(612); C.line(c, [[4, 450], [696, 452]], 2.2, '#8a6a40', .6); c.restore();
    });
  }

  /* ================= MASA (üstten) ================= */
  const NB = { x: 300, y: 860, s: .6, rot: -.05 };         // dedenin defteri (son sayfa)
  const LST = { x: 610, y: 560, s: .5, rot: .035 };        // liste: sol üst köşe + ölçek
  const lstW = (lx, ly) => { const c = Math.cos(LST.rot), s = Math.sin(LST.rot); return [LST.x + (lx * c - ly * s) * LST.s, LST.y + (lx * s + ly * c) * LST.s]; };
  function deskBg() {
    return cached('masa', 2160, 2880, c => {
      c.translate(540, 480); c.fillStyle = P.wood; c.fillRect(-540, -480, 2160, 2880); C.seed(611);
      for (let i = -2; i < 11; i++) C.line(c, [[-560, 120 + i * 220], [1640, 140 + i * 220 + (i % 2 ? 8 : -6)]], 2.6, 'rgba(21,18,13,.35)', 1.6);
      for (let i = 0; i < 80; i++) { const x = -540 + rnd(i + 30) * 2160, y = -480 + rnd(i + 31) * 2880; C.line(c, [[x, y], [x + 80 + rnd(i) * 120, y + 4]], 1.4, 'rgba(63,39,17,.4)', 1); }
    });
  }
  function drawDesk(ctx) {
    ctx.drawImage(deskBg(), -540, -480);
    C.drawNotebook(ctx, { x: NB.x, y: NB.y, s: NB.s, rot: NB.rot, lastPage: true, seed: 91 });
    ctx.save(); ctx.translate(LST.x, LST.y); ctx.rotate(LST.rot); ctx.scale(LST.s, LST.s);
    ctx.fillStyle = 'rgba(10,5,2,.35)'; ctx.fillRect(14, 16, 708, 902);
    ctx.drawImage(listCv(), -20, 0, 740, 1000);
    ctx.restore();
  }
  function deskLight(ctx, a) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const g = ctx.createRadialGradient(860, 380, 60, 640, 760, 1200);
    g.addColorStop(0, `rgba(255,214,140,${a == null ? .5 : a})`); g.addColorStop(1, 'rgba(40,24,10,.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .5);
  }
  // Kaan'ın kolu alttan (masada duran el)
  function handOnDesk(ctx, x, y, rot, flip) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (flip) ctx.scale(-1, 1); C.seed(flip ? 652 : 651);
    C.shape(ctx, [[-60, 120], [60, 120], [70, 900], [-70, 900]], P.jacket, { lw: 6, shade: c => C.blot(c, [[20, 110], [80, 110], [80, 900], [30, 900]], '#0b1f2a', .3) });
    C.shape(ctx, [[-56, 100], [56, 100], [58, 136], [-58, 136]], P.hazard, { lw: 4.4 });
    C.shape(ctx, [[-52, 104], [-58, 30], [-40, -26], [-10, -44], [24, -40], [48, -16], [56, 40], [50, 104]], P.skin, { lw: 6, shade: c => C.blot(c, [[20, -50], [70, -50], [70, 110], [30, 110]], P.skinDk, .5) });
    C.line(ctx, [[-30, -20], [-26, 20]], 3, P.skinDk); C.line(ctx, [[-6, -32], [-4, 10]], 3, P.skinDk); C.line(ctx, [[18, -30], [16, 10]], 3, P.skinDk);
    ctx.restore();
  }
  // İşaret eden el (üstten; parmak ucu (0,0), kol +y)  — p4-b ile aynı el
  function drawPointer(ctx, x, y, rot, s, press) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); C.seed(411);
    const lw = 6 / Math.sqrt(s) * 1.4;
    ctx.save(); ctx.globalAlpha = .22 * (1 - (press || 0) * .4); ctx.fillStyle = P.ink; ctx.translate(16, 20);
    ctx.beginPath(); ctx.moveTo(-16, 10); ctx.lineTo(16, 10); ctx.lineTo(80, 330); ctx.lineTo(120, 1000); ctx.lineTo(-120, 1000); ctx.lineTo(-80, 330); ctx.fill(); ctx.restore();
    limb(ctx, [0, 330], [10, 1100], 82, 104, P.jacket, 412);
    C.shape(ctx, [[-84, 340], [84, 336], [88, 378], [-86, 384]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-58, 330], [-74, 230], [-62, 150], [-30, 112], [40, 108], [66, 150], [70, 240], [58, 330]], P.skin, { lw, shade: c => C.blot(c, [[30, 100], [90, 100], [90, 340], [40, 340]], P.skinDk, .5) });
    [[-48, 132], [-22, 118], [6, 116]].forEach(([a, b]) => C.shape(ctx, C.ell(a, b, 17, 15, 12), P.skin, { lw: lw * .8 }));
    C.tube(ctx, [[-62, 236], [-92, 186], [-88, 138]], 40, 30, P.skin, lw);
    C.tube(ctx, [[30, 132], [18, 64], [0, 6]], 40, 32, P.skin, lw, { shade: c => C.blot(c, [[18, 0], [50, 0], [50, 140], [30, 140]], P.skinDk, .45) });
    C.shape(ctx, [[-8, 10], [10, 8], [12, 30], [-6, 32]], '#e7b896', { lw: lw * .5 });
    ctx.restore();
  }

  /* ================= TERS AÇI: Kaan + Defne (ofisin ön duvarı, pencere solda) ================= */
  const KA = { x: 420, y: 2180, s: 2.5 }, DF = { x: 700, y: 1900, s: 2.5 };
  const WIN = { x: 40, y: 260, w: 290, h: 380 };         // ters açıda pencere (ekran)
  function nightOutside(g, x, y, w, h, sd) {           // pencereden görünen gece (boş gök, çit, uzak çatılar)
    const sk = g.createLinearGradient(0, y, 0, y + h); sk.addColorStop(0, '#03050c'); sk.addColorStop(.7, '#0d1630'); sk.addColorStop(1, '#1d2742');
    g.fillStyle = sk; g.fillRect(x, y, w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(238,242,255,${.35 + rnd(sd + i) * .5})`; g.fillRect(x + rnd(sd + i * 3) * w, y + rnd(sd + i * 7) * h * .6, 2.5, 2.5); }
    C.seed(sd); let cx = x - 10; let i = 0;
    while (cx < x + w) { const bw = w * (.12 + rnd(sd + i * 5) * .14), bh = h * (.06 + rnd(sd + i * 9) * .12); C.shape(g, [[cx, y + h], [cx, y + h * .86 - bh], [cx + bw, y + h * .86 - bh], [cx + bw, y + h]], '#121a2a', { lw: 1.6, ink: '#0b0f18', amp: .4 }); cx += bw + 4; i++; }
    g.save(); g.globalAlpha = .55; g.strokeStyle = '#3a4152'; g.lineWidth = 1.4;
    for (let fx = x - 20; fx < x + w; fx += 12) { g.beginPath(); g.moveTo(fx, y + h * .9 - h * .1); g.lineTo(fx + 30, y + h); g.moveTo(fx + 30, y + h * .8); g.lineTo(fx, y + h); g.stroke(); }
    g.restore();
  }
  function frontWall(g) {
    C.seed(361);
    g.fillStyle = P.wallOffice; g.fillRect(0, 0, 1080, 1920);
    for (let i = 0; i < 9; i++) C.blot(g, C.ell(rnd(i + 5) * 1080, rnd(i + 15) * 1500, 90 + rnd(i) * 120, 50 + rnd(i + 3) * 60, 12), P.wallOfficeDk, .3);
    // pencere
    const w = WIN;
    C.shape(g, [[w.x - 20, w.y - 20], [w.x + w.w + 20, w.y - 20], [w.x + w.w + 20, w.y + w.h + 30], [w.x - 20, w.y + w.h + 30]], P.wood, { lw: 4 });
    nightOutside(g, w.x, w.y, w.w, w.h, 51);
    C.line(g, [[w.x + w.w / 2, w.y], [w.x + w.w / 2, w.y + w.h]], 8, '#3f2711', .4); C.line(g, [[w.x, w.y + w.h * .48], [w.x + w.w, w.y + w.h * .48]], 8, '#3f2711', .4);
    C.shape(g, [[w.x - 30, w.y + w.h + 20], [w.x + w.w + 30, w.y + w.h + 20], [w.x + w.w + 30, w.y + w.h + 40], [w.x - 30, w.y + w.h + 40]], '#3f2711', { lw: 3 });
    // iğneli eski kâğıt + raf
    g.save(); g.translate(880, 360); g.rotate(.04); C.shape(g, [[-90, -70], [90, -70], [90, 70], [-90, 70]], P.page, { lw: 3 }); C.handwrite(g, '1979', -40, 40, 26, P.inkOld, 7); C.shape(g, C.ell(0, -60, 6, 6, 8), P.beaconOff, { lw: 1.6 }); g.restore();
    C.shape(g, [[560, 520], [1080, 520], [1080, 540], [560, 540]], P.wood, { lw: 3 });
    [[620, 520, 70, 90, '#86391f'], [700, 520, 50, 120, '#3f6f8f'], [760, 520, 60, 70, P.page]].forEach(([x, y, ww, hh, col], i) => { C.seed(370 + i); C.shape(g, [[x, y], [x + ww, y], [x + ww, y - hh], [x, y - hh]], col, { lw: 3 }); });
  }
  function revBg() { return blurred('ters-duvar', 7, g => frontWall(g)); }
  function revLight(ctx, extra, a) { nightLight(ctx, [[640, 980, 560, .95, 640], [180, 450, 260, .6, 300]].concat(extra || []), a == null ? .62 : a); glow(ctx, 880, 1300, 700, '255,200,120', .12); }
  // Defne: eğilme (kalça çevresinde döner), bakış, ifade, konuşma (baş sallanır)
  function defneAt(ctx, o) {
    const s = o.s || DF.s, x = o.x || DF.x, y = o.y || DF.y, pv = [x, y - 250 * s * .9];
    ctx.save(); ctx.translate(pv[0], pv[1]); ctx.rotate(-(o.lean || 0) * .12); ctx.translate(-pv[0] - (o.lean || 0) * 30, -pv[1] + (o.bob || 0) + (o.lean || 0) * 14);
    C.drawDefne(ctx, { x, y, s, seed: 31, expr: o.expr || 'serious', look: o.look || 0, blink: o.blink || 0 });
    ctx.restore();
  }
  function kaanAt(ctx, o) {
    C.drawKaan(ctx, { x: o.x || KA.x, y: (o.y || KA.y) + (o.bob || 0), s: o.s || KA.s, seed: 11, expr: o.expr || 'serious', look: o.look || 0, blink: o.blink || 0, phone: false });
  }
  const blinkAt = (t, list) => list.some(b => t >= b && t < b + 3 / FPS) ? 1 : 0;

  /* ================= OYUN KARELERİ ================= */
  const gameImgs = [];
  for (let i = 1; i <= 115; i++) gameImgs[i] = TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg');
  function gameIdx(t) { const k = times(); if (t < k.tap) return 1; return Math.min(115, 1 + Math.floor((t - k.tap) * FPS + 1e-6)); }
  const SW = 486, SH = 864, BWd = 548, BHt = 1000;
  function drawHandSide(ctx, x, y, flip, lw) {
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], P.jacketDk, { lw });
    C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], P.skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], P.skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, P.skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, P.skinDk);
    ctx.restore();
  }
  function phoneClose(ctx, t, o) {
    const tw = twos(t), jx = Math.sin(tw * 2.1) * 3, jy = Math.sin(tw * 1.3 + 1) * 3;
    ctx.save(); ctx.translate(o.cx + jx, o.cy + jy); ctx.rotate(o.rot || 0); ctx.transform(1, 0, -.035, 1, 0, 0); ctx.scale(o.z, o.z);
    drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6);
    C.seed(171); C.shape(ctx, rrectPts(-BWd / 2, -BHt / 2, BWd, BHt, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BWd / 2, -BHt / 2, 30, BHt); } });
    C.shape(ctx, [[-60, -BHt / 2 + 24], [60, -BHt / 2 + 24], [60, -BHt / 2 + 36], [-60, -BHt / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SW / 2, -SH / 2, SW, SH, 34); ctx.clip();
    const im = gameImgs[gameIdx(t)];
    if (im && im.naturalWidth) ctx.drawImage(im, -SW / 2, -SH / 2, SW, SH); else { ctx.fillStyle = P.screen; ctx.fillRect(-SW / 2, -SH / 2, SW, SH); }
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SW / 2, -SH / 2 + 80); ctx.lineTo(-SW / 2 + 220, -SH / 2); ctx.lineTo(-SW / 2 + 300, -SH / 2); ctx.lineTo(-SW / 2, -SH / 2 + 180); ctx.fill();
    const TP = [0, (560 / 800 - .5) * SH], rd = t - o.tap;          // oyunda dokunuş (ekranın alt-orta)
    if (rd >= 0 && rd < .4) { ctx.strokeStyle = `rgba(255,255,255,${.9 * (1 - rd / .4)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(TP[0], TP[1], 20 + rd * 220, 0, TAU); ctx.stroke(); }
    ctx.restore();
    C.ink(ctx, (() => { const p = new Path2D(); const q = C.wobble(rrectPts(-SW / 2, -SH / 2, SW, SH, 34, 6), true, .5); p.moveTo(q[0][0], q[0][1]); q.forEach(v => p.lineTo(v[0], v[1])); p.closePath(); return p; })(), 4);
    const th = ones(t), tu = E.outC(seg(th, o.tap - .26, o.tap)) * (1 - E.inQ(seg(th, o.tap + .12, o.tap + .34)));
    const tx = lerp(330, TP[0] + 30, tu), ty = lerp(560, TP[1] + 50, tu);
    drawHandSide(ctx, BWd / 2 - 10, 0, true, 6);
    C.seed(172);
    C.shape(ctx, [[BWd / 2 + 60, 380], [tx + 50, ty - 30], [tx + 10, ty - 50], [tx - 30, ty - 30], [tx - 20, ty + 20], [BWd / 2 + 20, 470]], P.skin, { lw: 6, shade: c => C.blot(c, [[tx - 10, ty + 5], [BWd / 2 + 80, 420], [BWd / 2 + 80, 520], [tx, ty + 60]], P.skinDk, .5) });
    C.shape(ctx, [[tx - 22, ty - 34], [tx + 6, ty - 46], [tx + 18, ty - 24], [tx - 8, ty - 14]], '#e7b896', { lw: 3 });
    ctx.restore();
  }

  /* ================= 9 NUMARA: kule ================= */
  const TW = { x: 0, y: 0, w: 1080, h: 1920, mode: 'night', towerX: .62, seed: 9 };
  const TG = (() => { const a = TW, tw = a.w * .3, tx = a.w * a.towerX - tw / 2, hz = a.h * .86, th = a.h * .8; return { tx, tw, hz, ty: hz - th, fh: th / 40 }; })();
  // tower penceresi yanık mı (cizim.js ile aynı tohum)
  const lit = (k, q) => rnd(k * 6 + q + 9) < .35;
  // önde eski, alçak çatılar (dünya koordinatı; kulenin tabanını ve kapı tabelasını kapatır)
  function oldRoofs(ctx, y0) {
    C.seed(381); let cx = -300, i = 0;
    while (cx < 1400) {
      const bw = 150 + rnd(i * 7 + 3) * 170, bh = 130 + rnd(i * 5 + 1) * 190, top = y0 - bh, kind = i % 3;
      const col = i % 2 ? '#1a2130' : '#202838';
      const pts = kind === 0 ? [[cx, 2400], [cx, top + 40], [cx + bw / 2, top - 30], [cx + bw, top + 40], [cx + bw, 2400]] : [[cx, 2400], [cx, top], [cx + bw, top], [cx + bw, 2400]];
      C.shape(ctx, pts, col, { lw: 3, ink: '#090c14', amp: .8, shade: c => { for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) if (rnd(i * 31 + r * 7 + q) < .3) { c.fillStyle = 'rgba(255,200,110,.55)'; c.fillRect(cx + 24 + q * (bw - 60) / 2.5, top + 60 + r * 70, 22, 30); } } });
      if (kind === 1) { C.line(ctx, [[cx + bw * .7, top], [cx + bw * .7, top - 60]], 5, '#0b0f18', .4); C.shape(ctx, [[cx + bw * .62, top - 60], [cx + bw * .82, top - 60], [cx + bw * .82, top - 76], [cx + bw * .62, top - 76]], '#2a2f3a', { lw: 2.4, ink: '#090c14' }); }   // baca
      if (kind === 2) C.shape(ctx, [[cx + 20, top], [cx + 20, top - 50], [cx + 70, top - 50], [cx + 70, top]], '#262c3a', { lw: 2.4, ink: '#090c14' });            // su deposu
      cx += bw + 10; i++;
    }
  }
  function towerWorld(ctx) { C.drawHaleTower(ctx, TW); oldRoofs(ctx, 1500); }
  // pencerelerde küçük insan siluetleri (dünya koordinatı; yakın planda görünür)
  function towerPeople(ctx, t, k0, k1, a) {
    const { tx, tw, hz, fh } = TG, cw = tw / 6, u = fh / 38, INKD = '#22180f';
    for (let k = k0; k <= k1; k++) for (let q = 0; q < 6; q++) {
      if (!lit(k, q)) continue;
      const x0 = tx + cw * q + 3, y0 = hz - (k + 1) * fh + 3, w = cw - 6, h = fh - 5, y1 = y0 + h;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
      const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(255,236,170,.95)'); g.addColorStop(1, 'rgba(232,170,90,.95)');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = 'rgba(255,250,225,.9)'; ctx.fillRect(x0 + w * .2, y0, w * .6, 2.2 * u);                // tavan lambası
      const r = rnd(k * 17 + q + 5), kind = r < .45 ? 0 : r < .75 ? 1 : 2, n = rnd(k * 13 + q * 3 + 1);
      if (n < .78) {
        ctx.globalAlpha = a; ctx.fillStyle = INKD;
        const sx = x0 + w * (.3 + rnd(k * 3 + q * 11) * .4) + (kind === 2 ? Math.sin(t * .6 + k * 1.3 + q) * w * .18 : 0);
        if (kind === 0) {           // masada oturan, önünde ekran
          ctx.fillRect(x0, y1 - 10 * u, w, 2.4 * u);
          ctx.fillStyle = 'rgba(200,225,255,.95)'; ctx.fillRect(sx + 7 * u, y1 - 19 * u, 9 * u, 6.5 * u); ctx.fillStyle = INKD; ctx.fillRect(sx + 11 * u, y1 - 13 * u, 1.6 * u, 3 * u);
          ctx.beginPath(); ctx.arc(sx, y1 - 21 * u, 3.6 * u, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(sx - 6 * u, y1 - 9 * u); ctx.quadraticCurveTo(sx - 6 * u, y1 - 17 * u, sx, y1 - 17 * u); ctx.quadraticCurveTo(sx + 6 * u, y1 - 17 * u, sx + 6 * u, y1 - 9 * u); ctx.fill();
        } else {                    // ayakta (biri yavaşça yürür)
          ctx.beginPath(); ctx.arc(sx, y1 - 25 * u, 3.4 * u, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(sx - 5 * u, y1 - 11 * u); ctx.quadraticCurveTo(sx - 5.5 * u, y1 - 21 * u, sx, y1 - 21 * u); ctx.quadraticCurveTo(sx + 5.5 * u, y1 - 21 * u, sx + 5 * u, y1 - 11 * u); ctx.fill();
          ctx.fillRect(sx - 3.6 * u, y1 - 12 * u, 3 * u, 12 * u); ctx.fillRect(sx + .6 * u, y1 - 12 * u, 3 * u, 12 * u);
          if (kind === 1) { ctx.fillStyle = P.paper; ctx.fillRect(sx + 5 * u, y1 - 16 * u, 2.6 * u, 3.4 * u); }   // elinde kâğıt bardak
        }
      }
      ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(21,18,13,.6)'; ctx.lineWidth = 1.2; ctx.strokeRect(x0, y0, w, h); ctx.restore();
    }
  }

  /* ================= DAISY (bitiş) ================= */
  function drawBeacon(ctx, v) {
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(q => { const r = 40 + q * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - q * .2) * Math.min(1, v * 1.5), null, .5); }));
  }

  /* ================= SAHNELER ================= */

  /* --- 13: "So the list is not a job." masa üstten: defter + liste yan yana; Kaan'ın elleri masadan çekilir, kamera geri --- */
  shot('p5b13-masa', k => k.start, k => k.c14, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u), z = lerp(1.22, .98, e), fx = lerp(540, 535, e), fy = lerp(830, 880, e);
    ctx.save(); cam(ctx, z, fx, fy);
    drawDesk(ctx);
    const out = E.inQ(seg(tw, k.job - .25, k.job + .45));
    handOnDesk(ctx, 260 - out * 60, 1130 + out * 760, .22, true);
    handOnDesk(ctx, 820 + out * 60, 1170 + out * 760, -.18, false);
    ctx.restore();
    deskLight(ctx); airDust(ctx, t, 14, 13, [0, 300, 1080, 1100], .5);
    finish(ctx);
  });

  /* --- 14: "It is an apology." listenin üstü yakın; sessiz, çok yavaş itme --- */
  shot('p5b14-ozur', k => k.c14, k => k.c15, (ctx, t, u) => {
    const e = E.io(u), [fx, fy] = lstW(330, 200), z = lerp(3.3, 3.55, e);
    ctx.save(); cam(ctx, z, fx + lerp(10, -6, e), fy, 540, 820);
    drawDesk(ctx);
    ctx.restore();
    deskLight(ctx, .45); airDust(ctx, t, 10, 14, [0, 300, 1080, 900], .55);
    finish(ctx);
  });

  /* --- 15: "Defne read it over my shoulder." ters açı; Defne omzunun üstünden eğilir --- */
  function twoShot(ctx, t, o) {
    ctx.drawImage(revBg(), 0, 0);
    ctx.save(); cam(ctx, o.z || 1, o.fx || 540, o.fy || 960);
    defneAt(ctx, o.d); if (o.mid) o.mid(ctx); kaanAt(ctx, o.k); if (o.top) o.top(ctx);
    ctx.restore();
    revLight(ctx, o.holes);
  }
  shot('p5b15-omuz', k => k.c15, k => k.c16, (ctx, t, u) => {
    const k = times(), tw = twos(t), lean = E.outC(seg(tw, k.lean, k.lean + .5)), z = lerp(1, 1.04, E.io(u));
    twoShot(ctx, t, { z, fy: 980,
      d: { lean, look: lerp(.3, -.5, lean), expr: 'serious', blink: blinkAt(tw, [k.c15 + .3]) },
      k: { expr: 'serious', look: lerp(.1, .7, E.io(seg(tw, k.lean + .3, k.lean + .6))), blink: blinkAt(tw, [k.c16 - .4]) } });
    finish(ctx);
  });

  /* --- 16: "She was quiet for a long time." iki yüz yakın; gerçek sessizlik: göz kırpma, kaçamak bakış, lamba --- */
  shot('p5b16-sessiz', k => k.c16, k => k.c17, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.42, 1.5, E.io(u));
    const g = E.io(seg(tw, k.glance, k.glance + .2)) * (1 - E.io(seg(tw, k.glance + .8, k.glance + 1)));
    twoShot(ctx, t, { z, fx: 570, fy: 900,
      d: { lean: 1, look: -.5, expr: 'serious', blink: blinkAt(tw, [k.c16 + 1.1]) },
      k: { expr: 'serious', look: lerp(-.2, .9, g), blink: blinkAt(tw, [k.c16 + .5]) } });
    finish(ctx);
  });

  /* --- 17: "Then she asked, 'How are your exams going?'" Defne yakın; başını çevirir, kaşı kalkar --- */
  shot('p5b17-sinav', k => k.c17, k => k.c18, (ctx, t, u) => {
    const k = times(), tw = twos(t), turn = E.io(seg(tw, k.turn, k.turn + .3));
    const talk = tw >= k.q0 && tw < k.q1 ? Math.abs(Math.sin((tw - k.q0) * 9)) * 6 : 0;
    ctx.drawImage(revBg(), 0, 0);
    ctx.save(); cam(ctx, lerp(1.02, 1.07, E.io(u)), 560, 900);
    C.drawDefne(ctx, { x: 600 - turn * 16, y: 2160 + talk, s: 3.3, seed: 31, expr: tw >= k.brow ? 'confident' : 'serious', look: lerp(.2, -.9, turn), blink: blinkAt(tw, [k.turn - .1]) });
    ctx.restore();
    // ön planda Kaan'ın omzu (bulanık, karanlık)
    ctx.save(); ctx.filter = 'blur(6px)'; ctx.fillStyle = '#10241f'; ctx.beginPath(); ctx.ellipse(-60, 1700, 330, 640, .1, 0, TAU); ctx.fill(); ctx.restore();
    nightLight(ctx, [[640, 860, 560, .95, 640]], .6); glow(ctx, 880, 1200, 700, '255,200,120', .12);
    finish(ctx);
  });

  /* --- 18: "I said, 'Look, a bird.'" Kaan mahcup, eliyle pencereyi (sol üst) gösterir; Defne ona bakar --- */
  shot('p5b18-kus', k => k.c18, k => k.c19, (ctx, t, u) => {
    const k = times(), tw = twos(t), up = E.outBack(seg(tw, k.point, k.point + .3)), z = lerp(1, 1.03, E.io(u));
    twoShot(ctx, t, { z, fy: 960,
      d: { lean: .6, look: -.9, expr: 'serious', blink: blinkAt(tw, [k.c19 - .3]) },
      k: { expr: 'sheepish', look: tw >= k.point ? -1 : .5 },
      top: c => { if (up > 0) drawPointer(c, lerp(260, 170, up), lerp(1900, 690, up), -.18, .8, 0); } });
    finish(ctx);
  });

  /* --- 19: "There was no bird." boş pencere: yalnız gece; hiçbir şey uçmaz --- */
  shot('p5b19-pencere', k => k.c19, k => k.c19b, (ctx, t, u) => {
    const z = lerp(1, 1.05, E.io(u));
    ctx.save(); cam(ctx, z, 540, 760, 540, 760);
    const bg = cached('pencere-ic', 1080, 1920, g => {
      g.fillStyle = P.wallOffice; g.fillRect(0, 0, 1080, 1920); C.seed(391);
      for (let i = 0; i < 7; i++) C.blot(g, C.ell(rnd(i + 25) * 1080, rnd(i + 35) * 1920, 120, 70, 12), P.wallOfficeDk, .3);
      const x = 150, y = 230, w = 780, h = 1000;
      C.shape(g, [[x - 50, y - 50], [x + w + 50, y - 50], [x + w + 50, y + h + 70], [x - 50, y + h + 70]], P.wood, { lw: 5, shade: c => C.blot(c, [[x + w, y - 50], [x + w + 50, y - 50], [x + w + 50, y + h + 70], [x + w, y + h + 70]], '#3f2711', .5) });
      nightOutside(g, x, y, w, h, 51);
      C.line(g, [[x + w / 2, y], [x + w / 2, y + h]], 16, '#3f2711', .6); C.line(g, [[x, y + h * .48], [x + w, y + h * .48]], 16, '#3f2711', .6);
      C.shape(g, [[x - 70, y + h + 50], [x + w + 70, y + h + 50], [x + w + 70, y + h + 96], [x - 70, y + h + 96]], '#3f2711', { lw: 4 });
      g.fillStyle = 'rgba(255,210,122,.08)'; g.fillRect(x + 40, y + 520, 140, 240);       // camda lamba yansıması
    });
    ctx.drawImage(bg, 0, 0);
    ctx.restore();
    nightLight(ctx, [[600, 1100, 700, .8, 800]], .35);
    vignette(ctx, .5);
    finish(ctx);
  });

  /* --- 19b–20: Defne'nin bakışı; Kaan ona bakmamak için telefonu yüzüne kaldırır (ekranın ışığı yüzünde) --- */
  shot('p5b20-bakis', k => k.c19b, k => k.c20, (ctx, t, u) => {
    const k = times(), tw = twos(t), lift = E.outC(seg(tw, k.lift, k.lift + .3));
    const px = KA.x + 20, py = lerp(1560, 1150, lift);
    twoShot(ctx, t, { z: lerp(1.08, 1.12, E.io(u)), fx: 560, fy: 960,
      d: { lean: .6, look: -.9, expr: 'tired', blink: 0 },
      k: { expr: 'sheepish', look: lift > .5 ? .1 : -.6, blink: 0 },
      top: c => { // telefonun arkası kameraya; iki el
        C.seed(181); c.save(); c.translate(px, py); c.rotate(-.06);
        C.shape(c, rrectPts(-80, -150, 160, 300, 26, 5), P.steelDk, { lw: 5, shade: g => g.fillRect(40, -150, 40, 300) });
        C.shape(c, C.ell(-44, -100, 22, 22, 14), '#1d1f24', { lw: 3 });
        C.shape(c, C.ell(-92, 40, 40, 70, 16), P.skin, { lw: 5 }); C.shape(c, C.ell(92, 40, 40, 70, 16), P.skinDk, { lw: 5 });
        c.restore();
      },
      holes: [[px, py - 160, 300, lift * .9, 260]] });
    if (lift > 0) glow(ctx, (px - 560) * 1.1 + 540, (py - 230 - 960) * 1.1 + 960, 300, '255,226,122', .35 * lift);
    finish(ctx);
  });

  /* --- 20: telefon yakın: gerçek oyun kareleri (dokunuş, yıkım, DEMOLISHED!, fabrika) --- */
  shot('p5b20-oyun', k => k.c20, k => k.c21, (ctx, t, u) => {
    const k = times();
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.save(); ctx.globalAlpha = .55; ctx.drawImage(revBg(), 0, 0); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(540, 740, 200, 540, 740, 760); hg.addColorStop(0, 'rgba(255,226,122,.3)'); hg.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .55);
    phoneClose(ctx, t, { cx: 520, cy: 760, z: 1.22 * lerp(.98, 1.03, E.io(u)), rot: -.05, tap: k.tap });
    finish(ctx);
  });

  /* --- 21–22: listede 9. satır (sert kesme); parmak satırın başına gelir, sonra satır boyunca yavaşça --- */
  const L9 = [122, lineY(9) + 4];
  function fingerOn9(t) {
    const k = times(), tw = twos(t), en = E.outC(seg(tw, k.finger, k.finger + .35)), sl = E.io(seg(tw, k.c22 + .1, k.c23 - .05));
    const lx = L9[0] - 6 + sl * (lineLen(9) - 10), ly = L9[1] + 30;
    const [x, y] = lstW(lx, ly);
    return { x: x + (1 - en) * 220, y: y + (1 - en) * 520, en };
  }
  function listCU(ctx, t, z, lx, ly, sy) {
    const [fx, fy] = lstW(lx, ly);
    ctx.save(); cam(ctx, z, fx, fy, 540, sy);
    drawDesk(ctx);
    const f = fingerOn9(t); if (f.en > 0) drawPointer(ctx, f.x, f.y, -.32 + LST.rot, .42, 0);
    ctx.restore();
    deskLight(ctx, .5);
  }
  shot('p5b21-dokuz', k => k.c21, k => k.c22, (ctx, t, u) => {
    listCU(ctx, t, lerp(2.0, 2.5, E.io(u)), lerp(380, 330, E.io(u)), lerp(640, lineY(9) - 10, E.io(u)), 820);
    finish(ctx);
  });
  shot('p5b22-yavas', k => k.c22, k => k.c23, (ctx, t, u) => {
    const k = times(), f = fingerOn9(t), sl = seg(t, k.c22 + .1, k.c23 - .05);
    listCU(ctx, t, lerp(3.1, 3.25, E.io(u)), lerp(170, 120 + lineLen(9) * .8, E.io(sl)), lineY(9) - 10, 820);
    void f; finish(ctx);
  });

  /* --- 23: "Number nine is not old." gece şehir: eski alçak çatılar, aralarından yeni cam kule yükselir --- */
  shot('p5b23-sehir', k => k.c23, k => k.c24, (ctx, t, u) => {
    const e = E.io(u), z = lerp(1.0, 1.06, e), fy = lerp(1330, 1300, e);
    ctx.save(); cam(ctx, z, 600, fy, 540, 960);
    towerWorld(ctx);
    ctx.restore();
    airDust(ctx, t, 8, 23, [0, 200, 1080, 900], .25);
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 24: "It has forty floors." kamera kule boyunca yukarı kalkar (kırk kat) --- */
  shot('p5b24-kirk', k => k.c24, k => k.c25, (ctx, t, u) => {
    const e = E.io(u), z = 1.55, cx = TG.tx + TG.tw / 2, fy = lerp(1180, 330, e);
    ctx.save(); cam(ctx, z, cx, fy, 540, 900);
    towerWorld(ctx);
    ctx.restore();
    vignette(ctx, .4);
    finish(ctx);
  });

  /* --- 25: "And people still work in it." ışıklı pencereler, içeride küçük insanlar --- */
  shot('p5b25-insan', k => k.c25, k => k.endShot, (ctx, t, u) => {
    const e = E.io(u), z = lerp(2.5, 2.65, e), cx = TG.tx + TG.tw * lerp(.42, .5, e), fy = TG.hz - 24.5 * TG.fh;
    ctx.save(); cam(ctx, z, cx, fy, 540, 820);
    towerWorld(ctx);
    towerPeople(ctx, t, 6, 36, .9);
    ctx.restore();
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- Bitiş: gece avlu; uzakta ışıklı kule (üst üçte bir), önde küçük Daisy; endBeep'te TEK bip; kart altta --- */
  const END = { z: .5, wx: 669, wy: 115, sx: 330, sy: 110 };   // kule: dünya (669,115) → ekran (330,110)
  const DY = { x: 790, y: 872, s: .8 };
  function endBg() {
    return cached('bitis', 1080, 1920, g => {
      const sk = g.createLinearGradient(0, 0, 0, 900); sk.addColorStop(0, '#03050c'); sk.addColorStop(.6, '#0a1124'); sk.addColorStop(1, '#1d2742');
      g.fillStyle = sk; g.fillRect(0, 0, 1080, 1920);
      for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(238,242,255,${.3 + rnd(i + 600) * .5})`; g.fillRect(rnd(i + 700) * 1080, rnd(i + 800) * 520, 2, 2); }
      // uzak şehir
      C.seed(611); let cx = -20, i = 0;
      while (cx < 1080) { const bw = 40 + rnd(i + 900) * 70, bh = 60 + rnd(i + 950) * 150; C.shape(g, [[cx, 900], [cx, 880 - bh], [cx + bw, 880 - bh], [cx + bw, 900]], '#121a28', { lw: 1.6, ink: '#0b0f18', amp: .4 }); g.fillStyle = 'rgba(255,210,122,.5)'; for (let yy = 890 - bh; yy < 880; yy += 14) for (let xx = cx + 6; xx < cx + bw - 6; xx += 12) if (rnd(xx * 3 + yy) < .18) g.fillRect(xx, yy, 4, 6); cx += bw + 3; i++; }
      // kule (yalnız gövde: kendi göğünü kırp)
      g.save(); cam(g, END.z, END.wx, END.wy, END.sx, END.sy);
      g.beginPath(); g.rect(TG.tx - 5, TG.ty - TW.h * .05 - 10, TG.tw + 10, TG.hz - TG.ty + TW.h * .05 + 10 - TG.fh * 4.5); g.rect(TG.tx + TG.tw / 2 - 8, TG.ty - TW.h * .05 - 10, 16, TW.h * .05 + 10); g.clip();
      C.drawHaleTower(g, TW);
      g.restore();
      // kulenin tabanı önündeki eski çatılar (tabela burada kalır)
      C.seed(621); cx = -30; i = 0;
      while (cx < 1080) { const bw = 90 + rnd(i + 1000) * 110, bh = 150 + rnd(i + 1050) * 60; C.shape(g, [[cx, 1000], [cx, 930 - bh], [cx + bw, 930 - bh], [cx + bw, 1000]], i % 2 ? '#161d2b' : '#1b2232', { lw: 2.2, ink: '#090c14', amp: .5 }); if (rnd(i + 1100) < .5) { g.fillStyle = 'rgba(255,200,110,.5)'; g.fillRect(cx + bw * .3, 950 - bh, 14, 18); } cx += bw + 4; i++; }
      // avlu zemini + çit
      const gg = g.createLinearGradient(0, 930, 0, 1920); gg.addColorStop(0, '#2a271f'); gg.addColorStop(1, '#121009'); g.fillStyle = gg; g.fillRect(0, 930, 1080, 990);
      g.save(); g.globalAlpha = .5; g.strokeStyle = '#4a4636'; g.lineWidth = 1.4; for (let fx = -20; fx < 1080; fx += 14) { g.beginPath(); g.moveTo(fx, 852); g.lineTo(fx + 40, 930); g.moveTo(fx + 40, 852); g.lineTo(fx, 930); g.stroke(); } g.restore();
      C.seed(631); C.line(g, [[0, 850], [1080, 852]], 3, '#4a4636', .8);
    });
  }
  shot('p5b-son', k => k.endShot, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = freezeIn(t, k.endBeep, 1), v = beepAt(t, k.endBeep, 1);
    const z = 1 + .03 * E.outC(seg(tf, k.endShot, k.endBeep - .3)) + .02 * seg(t, k.endBeep + .6, k.dur);
    ctx.save(); cam(ctx, z, 540, 420, 540, 420);
    ctx.drawImage(endBg(), 0, 0);
    // kartın altında da kule yaşar: iki pencerenin ışığı söner/yanar (bip penceresinin dışında)
    ctx.save(); cam(ctx, END.z, END.wx, END.wy, END.sx, END.sy);
    [[31, 2, k.endCard + 1.4], [35, 1, k.endCard + 2.2], [24, 4, k.endCard + 3.1]].forEach(([fk, q, at]) => {
      if (t < at) return;
      ctx.fillStyle = lit(fk, q) ? '#22344a' : 'rgba(255,210,122,.8)'; ctx.fillRect(TG.tx + TG.tw * q / 6 + 3, TG.hz - (fk + 1) * TG.fh + 3, TG.tw / 6 - 6, TG.fh - 5);
    });
    ctx.restore();
    ctx.filter = 'brightness(.62) saturate(.85)';                                                            // Daisy gece gölgesinde
    C.drawDaisy(ctx, { x: DY.x, y: DY.y, s: DY.s, seed: 23, beep: 0, mood: 'sleepy', hook: .02 * Math.sin(tf * 1.2), boom: 1 });
    ctx.filter = 'none';
    ctx.save(); ctx.translate(DY.x, DY.y); ctx.scale(DY.s, DY.s); drawBeacon(ctx, v); ctx.restore();
    ctx.restore();
    if (v > 0) glow(ctx, (DY.x - 540) * z + 540, (DY.y - 346 * DY.s - 420) * z + 420, 360, P.glow, .3 * v);
    vignette(ctx, .4);
    // kart için yalnız alt kısım kararır; kule ve ışık açıkta
    const dk = .55 * E.io(seg(t, k.endCard - .1, k.endCard + .2));
    if (dk > 0) { const g = ctx.createLinearGradient(0, 600, 0, 900); g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(1, `rgba(7,11,24,${dk})`); ctx.fillStyle = g; ctx.fillRect(0, 600, 1080, 1320); }
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const r3 = x => +x.toFixed(3);
  TB.cuesB = {
    get elCekilir() { return r3(times().job - .25); },         // eller masadan, kâğıt üstünden çekilir (hafif sürtünme)
    get defneEgilir() { return r3(times().lean); },            // Defne omzun üstüne eğilir (kumaş)
    get kasKalkar() { return r3(times().brow); },              // "exams"de kaş kalkar (ses yok, ritim anı)
    get isaret() { return r3(times().point); },                // Kaan kolunu kaldırıp pencereyi gösterir
    get bosPencere() { return r3(times().c19); },              // boş pencere: sessizlik
    get telefonKalkar() { return r3(times().lift); },          // telefon yüze kalkar
    get telefonDokunus() { return r3(times().tap); },          // oyunda dokunuş; yıkım kareleri başlar (f0001)
    get oyunDemolished() { return r3(times().tap + 40 / FPS); },// yaklaşık DEMOLISHED! damgası (kare ≈41; ses ekibi kareye göre ayarlasın)
    get parmakKagit() { return r3(times().finger + .35); },    // parmak 9. satıra değer
    get parmakKayar() { return r3(times().c22 + .1); },        // parmak satır boyunca kayar ("Slowly.")
    get sonBip() { return r3(times().endBeep); }               // tek bip; Daisy'nin ışığı +0,04–0,24
  };
})();
