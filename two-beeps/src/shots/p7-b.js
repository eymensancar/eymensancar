/* Part 7 · THE PROFESSOR — Animatör B: cümle 12–25 ve bitiş görüntüsü. Başlangıç (S11.t1 + S12.t0) / 2 ≈ 23,23 sn → tl.duration.
   YERLEŞİM (dünya koordinatları; öbür yarı aynı mekânları kullanırsa bunlara uysun):
   • ODA (şafak, 12): pilot b-sahneler drawRoom ile aynı oda (pencere x 60–420, y 250–760; yatak başlığı y 980; Kaan (500,1880) s 2.5);
     pencere şafakta ağarır. Telefon yakın planı pilot b13-telefon ile aynı telefon (548×1000 gövde, 486×864 ekran, ekran ortası ≈(540,770)).
   • AVLU (13–25): C.drawYard varsayılan alan {0,0,1080,1920}, seed 7 (P2 yerleşimi): ufuk y≈1075; baraka x 108–670, taban y 1267;
     ofis kapısı x 445–569; çit üst y 1234; bahçe kapısı x 778–994; posta kutusu direği (670,1536).
     Daisy (640,1520) s .8, siperlik uykulu (bom ucu ≈(546,833), kanca ≈(546,1121)); uyarı ışığı dünyada (640,1243).
     Kaan (290,1800) s .9 · Defne (470,1775) s .9 (konuşma). Defne'nin MASASI (çizim masası) ofis kapısından çıkıp (330,1700)'e gelir;
     Defne masanın arkasında oturur (330,1668). Uzakta cam kule (Hale Tower) ufukta x≈905, taban y 1075, boy 420 (bahçe kapısının üstünde).
   • YIKIM SAHALARI (18–19): her birinde bina tabanı ortası (0,0), yer y=0; bina drawOldBuilding'den kesilir (3: tuğla blok v1, 4: sıvalı apartman v3,
     5: fabrika ofisi v5); TB.zone binanın düştüğü yanda; çit y=260; ekip çitin dışında; Daisy sahanın sağında susar (ışık sönük).
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
    k.start = (S(11).t1 + S(12).t0) / 2;                  // A ile ortak kesme
    k.tap = W(12, /^working/i, 7).t0;                     // parmak ilk hamleyi seçer
    k.kface = W(12, /^out/i, 8).t0 + .08;                 // Kaan'ın yüzü, şafak
    k.smile = W(12, /^start/i, 11).t0;
    k.defne = (S(12).t1 + S(13).t0) / 2;                  // Defne yakın
    k.soft = W(13, /^shout/i, 3).t0;
    k.two = S(14).t0 - .25;                               // ikili plan
    k.okay = W(14, /okay/i, 2).t0;
    k.turn = S(15).t0 - .2;                               // Defne Daisy'ye döner
    k.dcu = W(15, /^daisy/i, 4).t0 - .08;                 // Daisy yakın, Defne önde
    k.lid = W(15, /^too/i, 5).t0 - .1;                    // siperlik kalkar ("duydu")
    k.desk = S(15).t1 + .45;                              // masa avluya
    k.sign = S(16).t1 + .42;                              // imza
    k.signW = W(17, /^signature/i, 2).t0 - .1;
    k.stampCut = W(17, /^city/i, 4).t0 + .1;
    k.stamp = W(17, /^permit/i, 8).t0 + .06;              // damga basılır
    k.list = S(17).t1 + .25;                              // liste: 3-4-5 çizilir
    const w18 = S(18).words;
    k.strike = [w18[0].t0 - .08, Math.max(w18[0].t1 + .1, w18[1].t0 + .06), w18[2].t0 + .06];
    k.b3 = S(18).t1 + .16;                                // üç bina
    k.b4 = k.b3 + .9; k.b5 = k.b4 + .9;
    k.rep = S(20).t0 - .1;                                // dosya
    k.open = W(20, /^nine/i, 7).t0 - .05;
    k.hour = S(21).t0 - .25;                              // bir saat
    k.pale0 = S(22).t0 - .3;                              // yakın yüz
    k.pale = W(22, /^pale/i, 3).t0;
    k.ant = S(23).t0 - .22;                               // başını kaldırır
    k.chart = S(24).t0 - .16;                             // rapor çizelgesi
    k.slow = S(25).t0 - .25;                              // son plan
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
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }
  function airDust(ctx, t, n, sb, box, a, col) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(${col || '241,232,212'},${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }
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
  function shake(ctx, t, t0, amp) {
    const f = Math.floor((t - t0) * FPS + 1e-6);
    if (f >= 0 && f < 6) { const a = (amp || 14) * (1 - f / 6); ctx.translate((rnd(900 + f) - .5) * 2 * a, (rnd(950 + f) - .5) * 2 * a); }
  }

  /* ---------- liste (pilot a-sahneler ile aynı kâğıt ve el yazısı) ---------- */
  const PAPER = '#eadfc2', PAPER_BK = '#d9caa5', INK_OLD = '#3a3026', BLUE = '#1f4fe0';
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
  function listPaper(ctx) {   // açık liste 700×1000 (pilotun kâğıdı; kat izleri)
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
      // mavi karalama (10. satır; pilotla aynı çizgi)
      const pts = [], n = 26, x0 = 112, x1 = 640, y = lineY(10) - 4;
      for (let q = 0; q <= n; q++) { const u = q / n; pts.push([x0 + (x1 - x0) * u + (TB.rand(q * 7) - .5) * 14, y + (q % 2 ? -26 : 24) + (TB.rand(q * 3) - .5) * 10]); }
      const pts2 = []; for (let q = 0; q <= 18; q++) { const u = q / 18; pts2.push([x1 - 10 - (x1 - x0 - 30) * u, y + (q % 2 ? 18 : -18) + (TB.rand(q * 11) - .5) * 8]); }
      C.seed(512); const paths = [pts, pts2, [[x0 - 6, y + 2], [(x0 + x1) / 2, y - 6], [x1 + 8, y + 4]]].map(p => C.pathOf(C.wobble(p, false, 1.2, 6), false));
      c.lineCap = 'round'; c.lineJoin = 'round'; paths.forEach((p, i) => { c.strokeStyle = BLUE; c.lineWidth = i === 2 ? 8 : 7; c.stroke(p); });
      // 1. ve 2. satır daha önce çizildi (baca, su kulesi)
      [1, 2].forEach(i => strikeLine(c, i, 1));
    });
  }
  function strikeLine(ctx, i, u) {   // siyah kalın çizgi, satırın üstünden; u 0..1 ilerleme
    if (u <= 0) return; const y = lineY(i) - 4, x0 = 26, x1 = 128 + lineLen(i) + 30;
    const pts = []; for (let q = 0; q <= 10; q++) pts.push([lerp(x0, x1, q / 10), y + Math.sin(q * 1.3 + i) * 3 + (q / 10 - .5) * -6]);
    const n = Math.max(2, Math.round(pts.length * u)), pp = pts.slice(0, n); if (u < 1) { const last = lerp(x0, x1, u); pp[pp.length - 1] = [last, pp[pp.length - 1][1]]; }
    C.seed(1500 + i); stroke(ctx, pp, 13, P.ink, .95);
  }

  /* ================= OYUN KARELERİ (gerçek: kepenk açılır, bina baştan ayakta; 138–150) ================= */
  const gameImgs = {};
  for (let i = 138; i <= 150; i++) gameImgs[i] = TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg');
  function gameFrame(t) { const k = times(), i = 138 + Math.min(12, Math.max(0, Math.floor((t - k.start - .1) * FPS))); return gameImgs[i]; }

  /* ================= ODA (şafak): pilot drawRoom, pencere ağarır ================= */
  function drawRoomDawn(ctx, dawn) {
    ctx.fillStyle = P.night2; ctx.fillRect(-200, -200, 1480, 2320);
    C.seed(141);
    for (let x = -100; x < 1200; x += 90) { ctx.fillStyle = 'rgba(7,11,24,.25)'; ctx.fillRect(x, -200, 40, 2400); }
    const wp = C.shape(ctx, [[60, 250], [420, 250], [420, 760], [60, 760]], P.night, { lw: 6 });
    ctx.save(); ctx.clip(wp);
    const sg = ctx.createLinearGradient(0, 250, 0, 760); sg.addColorStop(0, '#2f3a4b'); sg.addColorStop(.55, '#a7705a'); sg.addColorStop(1, '#f0b878');
    ctx.fillStyle = sg; ctx.fillRect(60, 250, 360, 510);
    ctx.fillStyle = `rgba(255,236,190,${.25 + .2 * dawn})`; ctx.beginPath(); ctx.arc(250, 790, 130, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a3340'; for (let x = 60; x < 420; x += 44) { const h = 60 + rnd(x) * 130; ctx.fillRect(x, 760 - h, 40, h); for (let y = 770 - h; y < 750; y += 22) if (rnd(x * 7 + y) < .2) { ctx.fillStyle = 'rgba(255,210,122,.6)'; ctx.fillRect(x + 8, y, 7, 9); ctx.fillStyle = '#3a3340'; } }
    ctx.restore();
    C.line(ctx, [[240, 250], [240, 760]], 6); C.line(ctx, [[60, 505], [420, 505]], 6);
    C.shape(ctx, [[40, 760], [440, 760], [446, 790], [34, 790]], P.wood, { lw: 5 });
    C.shape(ctx, [[640, 420], [1020, 420], [1020, 440], [640, 440]], P.wood, { lw: 4 });
    C.shape(ctx, [[670, 330], [760, 330], [760, 420], [670, 420]], '#3a3d45', { lw: 4 });
    C.shape(ctx, [[790, 360], [900, 360], [900, 420], [790, 420]], P.brickDk, { lw: 4 });
    C.shape(ctx, [[150, 980], [960, 980], [960, 1900], [150, 1900]], P.wood, { lw: 6, shade: c => C.blot(c, [[700, 960], [1000, 960], [1000, 1900], [740, 1900]], P.ink, .3) });
    C.shape(ctx, [[220, 1010], [880, 1000], [900, 1240], [200, 1250]], P.paperDk, { lw: 5, shade: c => C.blot(c, [[600, 1000], [920, 1000], [920, 1260], [640, 1260]], '#8f8775', .5) });
  }
  function drawBlanket(ctx, y0) {
    C.seed(152);
    C.shape(ctx, [[-40, y0 + 20], [300, y0 - 10], [620, y0 + 30], [1120, y0 - 6], [1120, 2000], [-40, 2000]], '#3b2a3a', {
      lw: 6, shade: c => { C.blot(c, [[700, y0 - 20], [1130, y0 - 20], [1130, 2000], [760, 2000]], P.ink, .3); for (let i = 0; i < 5; i++) C.line(c, [[100 + i * 210, y0 + 80], [160 + i * 200, y0 + 400]], 3, 'rgba(7,11,24,.6)', 2); }
    });
  }
  function drawHandSide(ctx, x, y, flip, lw) {
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], P.jacketDk, { lw });
    C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], P.skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], P.skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, P.skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, P.skinDk);
    ctx.restore();
  }

  /* ================= AVLU ================= */
  const YD = (() => { const hz = 1920 * .56, bx = 108, bw = 561.6, by = hz + 192, bh = 576;
    return { hz, bx, bw, by, bh, wx: bx + bw * .14, wy: by - bh * .72, ww: bw * .3, wh: bh * .34, dx: bx + bw * .6, dw: bw * .22, dh: bh * .72 }; })();
  const DAISY = { x: 640, y: 1520, s: .8 };
  const BEACON = [DAISY.x, DAISY.y - 346 * DAISY.s];
  const KAAN = { x: 290, y: 1800, s: .9 }, DEFNE = { x: 470, y: 1775, s: .9 };
  const DESK = { x: 330, y: 1700, s: .9 }, DESK0 = { x: 520, y: 1300 };
  const SEAT = { x: 330, y: 1668 };
  const TOWER = { x: 905, w: 50, h: 420 };
  function farTower(ctx, dusk) {   // uzakta cam kule (Hale Tower siluetinin uzak hâli)
    const hz = YD.hz, x0 = TOWER.x - TOWER.w / 2, top = hz - TOWER.h; C.seed(2701);
    C.shape(ctx, [[x0, hz], [x0, top], [x0 + TOWER.w, top], [x0 + TOWER.w, hz]], dusk ? '#6d8496' : P.glassT, { lw: 2, ink: P.far2, amp: .3, shade: c => {
      C.blot(c, [[x0 + TOWER.w * .6, top - 4], [x0 + TOWER.w + 4, top - 4], [x0 + TOWER.w + 4, hz], [x0 + TOWER.w * .62, hz]], dusk ? '#53687a' : P.glassTDk, .7);
      c.strokeStyle = 'rgba(21,18,13,.18)'; c.lineWidth = 1; for (let q = 1; q < 40; q++) { const y = hz - q * TOWER.h / 40; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + TOWER.w, y); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x0 + 6, top, 5, TOWER.h * .6);
      if (dusk) for (let q = 0; q < 40; q++) if (rnd(3100 + q) < .3) { c.fillStyle = 'rgba(255,210,122,.6)'; c.fillRect(x0 + 4 + rnd(3200 + q) * (TOWER.w - 12), hz - (q + 1) * TOWER.h / 40 + 2, 6, 5); }
    } });
    C.line(ctx, [[TOWER.x, top], [TOWER.x, top - 26]], 1.6, P.far2, .2);
  }
  function officeWindow(ctx, dusk) {
    const { wx, wy, ww, wh } = YD;
    ctx.save(); ctx.beginPath(); ctx.rect(wx + 2, wy + 2, ww - 4, wh - 4); ctx.clip();
    ctx.fillStyle = dusk ? '#4a4038' : '#3b4744'; ctx.fillRect(wx, wy, ww, wh);
    if (dusk) { const g = ctx.createRadialGradient(wx + ww * .5, wy + wh * .6, 4, wx + ww * .5, wy + wh * .6, ww); g.addColorStop(0, 'rgba(255,210,122,.65)'); g.addColorStop(1, 'rgba(255,210,122,.1)'); ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh); }
    ctx.fillStyle = 'rgba(43,69,82,.3)'; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(wx + ww * .18, wy); ctx.lineTo(wx + ww * .34, wy); ctx.lineTo(wx + ww * .14, wy + wh); ctx.lineTo(wx - ww * .02, wy + wh); ctx.fill();
    ctx.restore();
    C.seed(613); C.line(ctx, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], 2.5); C.line(ctx, [[wx, wy + wh / 2], [wx + ww, wy + wh / 2]], 2.5);
    C.shape(ctx, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], null, { lw: 3.6 });
    const { dx, dw, dh, by } = YD;
    ctx.save(); ctx.font = '700 15px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink; ctx.fillText('OFFICE', dx + dw * .5, by - dh * .73); ctx.restore();
  }
  function yardBase(mode) {   // avlu + dış uzantı (önbellek, 1500×2700; dünya x −210…1290, y −300…2400)
    return cached('avlu-' + mode, 1500, 2700, g => {
      g.translate(210, 300); const dusk = mode === 'dusk';
      const sk = dusk ? ['#2f3a4b', '#7d4f3f', '#e0a066'] : ['#8fbadb', '#c9dbe0', '#f0e2c2'];
      const sg = g.createLinearGradient(0, -300, 0, YD.hz); sg.addColorStop(0, sk[0]); sg.addColorStop(.6, sk[1]); sg.addColorStop(1, sk[2]); g.fillStyle = sg; g.fillRect(-210, -300, 1500, YD.hz + 300);
      const gg = g.createLinearGradient(0, YD.hz, 0, 2400); gg.addColorStop(0, P.groundLt); gg.addColorStop(.3, P.ground); gg.addColorStop(1, P.groundDk); g.fillStyle = gg; g.fillRect(-210, YD.hz, 1500, 2400 - YD.hz);
      for (let i = 0; i < 30; i++) C.blot(g, C.ell(-200 + rnd(5100 + i) * 1480, 1300 + rnd(5200 + i) * 1100, 50 + rnd(5300 + i) * 90, 8 + rnd(5400 + i) * 10, 12), i % 2 ? P.groundDk : P.groundLt, .25);
      C.drawYard(g, { seed: 7, mode, letter: false, lightOn: true });
      // kenar uzantıları: çit ve ufuk çizgisi 1080 dışına
      [[-210, 0], [1080, 1290]].forEach(([a, b]) => {
        g.save(); g.beginPath(); g.rect(a, YD.hz - 220, b - a, 520); g.clip();
        let cx = a; C.seed(5500 + a); while (cx < b) { const bw = 60 + rnd(cx + 9000) * 70, bh = 60 + rnd(cx + 9100) * 150; C.shape(g, [[cx, YD.hz], [cx, YD.hz - bh], [cx + bw, YD.hz - bh], [cx + bw, YD.hz]], P.far, { lw: 2, ink: P.far2, amp: .5 }); cx += bw + 10; }
        const fy = YD.hz + 1920 * .14; g.globalAlpha = .55; g.strokeStyle = P.dustDk; g.lineWidth = 1.3;
        for (let fx = a - 20; fx < b; fx += 14) { g.beginPath(); g.moveTo(fx, fy - 110); g.lineTo(fx + 50, fy); g.moveTo(fx + 50, fy - 110); g.lineTo(fx, fy); g.stroke(); }
        g.globalAlpha = 1; C.line(g, [[a, fy - 111], [b, fy - 110]], 3, P.dustDk, .8);
        g.restore();
      });
      farTower(g, dusk);
      // kule tabanını çit örtsün diye çit önden yeniden (yalnız kule bölgesi)
      officeWindow(g, dusk);
      if (dusk) { g.fillStyle = 'rgba(10,17,36,.18)'; g.fillRect(-210, -300, 1500, 2700); }
    });
  }
  function grass(ctx, t) {
    for (let i = 0; i < 18; i++) {
      const r = j => rnd(1700 + i * 9 + j), x = -100 + r(1) * 1300, y = 1360 + r(2) * 700, ph = r(3) * 6;
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
  function daisy(ctx, d) {
    C.drawDaisy(ctx, { x: d.x, y: d.y + (d.bob || 0), s: d.s, seed: 23, beep: 0, mood: d.mood || 'sleepy', hook: d.hook || 0 });
    if (d.beep > 0) { ctx.save(); ctx.translate(d.x, d.y + (d.bob || 0)); ctx.scale(d.s, d.s); drawBeacon(ctx, d.beep); ctx.restore(); }
  }
  // Defne konuşurken: boyundan bölünür, baş eğilir/döner; lean ayak ortasından eğilme. Oturuşta boyun 104 birim aşağıda.
  function drawDefneTalk(ctx, o, headRot, headDy, lean) {
    const s = (o.s || 1) * .9, neck = o.y - (o.pose === 'sit' ? 301 : 405) * s;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(lean || 0); ctx.translate(-o.x, -o.y);
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, neck, 9000, 9000); ctx.clip(); C.drawDefne(ctx, o); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, -9000, 9000, neck + 9000 + 1); ctx.clip();
    ctx.translate(o.x + 2 * s, neck + (headDy || 0)); ctx.rotate(headRot || 0); ctx.translate(-(o.x + 2 * s), -neck); C.drawDefne(ctx, o); ctx.restore();
    ctx.restore();
  }
  const TALK = ['calm', 'serious', 'calm', 'determined', 'serious', 'calm'];
  const talkExpr = (t, sd) => TALK[Math.floor(t * 5 + rnd(sd) * 3) % TALK.length];

  /* ---------- Defne'nin çizim masası (yeni nesne): ayak ortası (x,y), s ölçek ---------- */
  function drawDesk(ctx, x, y, s, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 4.4 / Math.sqrt(s);
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(6, 4, 210, 18, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(2801);
    // arka ayaklar + çapraz
    [[-150, -248], [150, -248]].forEach(([lx, ly]) => C.line(ctx, [[lx, ly], [lx * .92, -10]], lw * 2.2, P.ink, .3));
    [[-150, -248], [150, -248]].forEach(([lx, ly]) => C.line(ctx, [[lx, ly], [lx * .92, -10]], lw * .9, P.floorWood, .2));
    C.line(ctx, [[-170, -60], [170, -60]], lw * 1.6, P.ink, .3); C.line(ctx, [[-170, -60], [170, -60]], lw * .6, P.floorWood, .2);
    // eğik çizim tablası
    C.shape(ctx, [[-196, -212], [196, -212], [176, -292], [-176, -292]], '#d9d3bf', { lw, shade: c => { C.blot(c, [[90, -300], [200, -300], [200, -205], [100, -205]], '#bdb59d', .6); } });
    C.shape(ctx, [[-198, -212], [198, -212], [198, -198], [-198, -198]], P.wood, { lw: lw * .9 });
    // ön ayaklar
    [-1, 1].forEach(d => { C.line(ctx, [[d * 182, -200], [d * 190, 0]], lw * 2.6, P.ink, .3); C.line(ctx, [[d * 182, -200], [d * 190, 0]], lw * 1.2, P.floorWood, .2); });
    if (o.paper !== false) C.shape(ctx, [[-120, -220], [60, -220], [52, -270], [-112, -270]], P.paper, { lw: lw * .7 });
    if (o.roll !== false) { C.shape(ctx, [[60, -238], [168, -246], [170, -228], [62, -220]], P.page, { lw: lw * .8 }); C.shape(ctx, C.ell(168, -237, 5, 9, 10), P.pageDk, { lw: lw * .6 }); }
    if (o.helmet !== false) C.shape(ctx, [[-188, -224], [-186, -250], [-172, -268], [-142, -272], [-118, -258], [-112, -228], [-104, -222], [-194, -220]], P.helmet, { lw, shade: c => C.blot(c, [[-150, -280], [-100, -280], [-100, -218], [-140, -222]], P.helmetDk, .7) });
    if (o.lamp != null) {   // kıskaçlı masa lambası (arka sol)
      C.line(ctx, [[-160, -286], [-170, -380], [-110, -440]], lw * 1.4, P.ink, .3); C.line(ctx, [[-160, -286], [-170, -380], [-110, -440]], lw * .6, P.steelLt, .2);
      if (o.lamp > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(-80, -380, 6, -80, -330, 260); g.addColorStop(0, `rgba(255,210,122,${.55 * o.lamp})`); g.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = g; ctx.fillRect(-360, -640, 600, 500); ctx.restore(); }
      C.shape(ctx, [[-128, -462], [-80, -446], [-60, -402], [-104, -412]], P.steelDk, { lw });
      C.shape(ctx, C.ell(-82, -406, 20, 8, 12), o.lamp > 0 ? P.lightOn : P.lightOff, { lw: lw * .6 });
    }
    if (o.after) o.after(ctx, lw);
    ctx.restore();
  }
  function coffee(ctx, x, y, k, lw) { C.coffeeCup(ctx, x, y, lw, k); }
  function deskClock(ctx, x, y, r, minutes, lw) {   // küçük çalar saat: akrep/yelkovan
    C.seed(2811);
    C.shape(ctx, C.ell(x, y, r, r, 22), '#c96a3e', { lw });
    C.shape(ctx, C.ell(x, y, r * .78, r * .78, 22), P.paper, { lw: lw * .6 });
    [-1, 1].forEach(d => C.shape(ctx, C.ell(x + d * r * .6, y - r * .95, r * .26, r * .2, 10), P.steel, { lw: lw * .5 }));
    for (let q = 0; q < 12; q++) { const a = q / 12 * TAU; ctx.fillStyle = P.ink; ctx.fillRect(x + Math.cos(a) * r * .64 - 1.5, y + Math.sin(a) * r * .64 - 1.5, 3, 3); }
    const am = minutes / 60 * TAU - Math.PI / 2, ah = (5 + minutes / 60) / 12 * TAU - Math.PI / 2;
    ctx.save(); ctx.strokeStyle = P.ink; ctx.lineCap = 'round';
    ctx.lineWidth = lw * .9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ah) * r * .4, y + Math.sin(ah) * r * .4); ctx.stroke();
    ctx.lineWidth = lw * .6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(am) * r * .62, y + Math.sin(am) * r * .62); ctx.stroke(); ctx.restore();
  }

  /* ---------- avlu dünyası ---------- */
  function world(ctx, t, o) {
    o = o || {};
    const mode = o.mode || 'day';
    ctx.drawImage(yardBase(mode), -210, -300);
    if (o.duskMix > 0) { ctx.save(); ctx.globalAlpha = o.duskMix; ctx.drawImage(yardBase('dusk'), -210, -300); ctx.restore(); }
    const items = [];
    items.push([DAISY.y, () => daisy(ctx, Object.assign({ x: DAISY.x, y: DAISY.y, s: DAISY.s, hook: Math.sin(t * 1.1) * .025 }, o.daisy || {}))]);
    if (o.desk) items.push([o.desk.y, () => drawDesk(ctx, o.desk.x, o.desk.y, o.desk.s, o.desk)]);
    if (o.defne) items.push([o.defne.y - .5, () => drawDefneTalk(ctx, Object.assign({ seed: 31 }, o.defne), o.defne.headRot, o.defne.headDy, o.defne.lean)]);
    if (o.kaan) items.push([o.kaan.y, () => C.drawKaan(ctx, Object.assign({ seed: 11 }, o.kaan))]);
    (o.extra || []).forEach(e => items.push(e));
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    if (!o.noGrass) grass(ctx, t);
  }
  function blurredWorld(key, z, cx, cy, blur, o, sx, sy) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      cam(g, z, cx, cy, sx, sy); world(g, 0, Object.assign({ noGrass: true }, o || {}));
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, -20, -20, 1120, 1960); c.filter = 'none';
    });
  }

  /* ================= YIKIM SAHALARI ================= */
  // drawOldBuilding'den bina kesilir: 1080×1920 alanda bina tabanı (540, 1344), boy 960.
  const BLD = {};
  function building(v) {
    if (BLD[v]) return BLD[v];
    const a = canvas(1080, 1920), g = a.getContext('2d');
    C.drawOldBuilding(g, { x: 0, y: 0, w: 1080, h: 1920, variant: v, mode: 'day', seed: 100 + v });
    const spec = { 1: .6, 3: .52, 5: .66 }[v], bw = 1080 * spec, bh = 960, bx = (1080 - bw) / 2, by = 1344;
    const x0 = Math.floor(bx - 14), y0 = Math.floor(by - bh - 12), w = Math.ceil(bw + 28), h = Math.ceil(bh + 12 + 2);
    const src = g.getImageData(x0, y0, w, h), O = new ImageData(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4, X = x0 + xx, Y = y0 + yy;
      const inside = X >= bx + 2 && X <= bx + bw - 2 && Y >= by - bh + 2 && Y <= by;
      const lum = src.data[i] * .3 + src.data[i + 1] * .59 + src.data[i + 2] * .11;
      if (inside || lum < 70) { O.data[i] = src.data[i]; O.data[i + 1] = src.data[i + 1]; O.data[i + 2] = src.data[i + 2]; O.data[i + 3] = 255; }
    }
    const cv = canvas(w, h); cv.getContext('2d').putImageData(O, 0, 0);
    BLD[v] = { cv, bw, bh, ox: 540 - x0, oy: by - y0 };   // sprite içinde taban ortası
    return BLD[v];
  }
  const SITES = {
    3: { v: 1, dir: -1, seed: 31, sky: 0 },     // tuğla blok sola devrilir
    4: { v: 3, dir: 0, seed: 41, sky: 1 },      // sıvalı apartman yerine çöker
    5: { v: 5, dir: 1, seed: 51, sky: 2 }       // fabrika ofisi sağa devrilir
  };
  function zoneOf(st, b) { return st.dir === 0 ? { x: 0, y: 40, w: b.bw * 1.35, h: 230 } : { x: st.dir * (b.bw / 2 + b.bh * .52), y: 40, w: b.bh * 1.05, h: 240 }; }
  function siteBg(ctx, st, t) {
    const g = ctx.createLinearGradient(0, -1900, 0, 0); g.addColorStop(0, P.sky0); g.addColorStop(.6, P.sky1); g.addColorStop(1, P.sky2);
    ctx.fillStyle = g; ctx.fillRect(-2600, -2400, 5200, 2400);
    // bulutlar (kayar)
    [[-900, -1500, 2.2, 10], [700, -1700, 1.8, 7], [-200, -1180, 1.4, 12]].forEach(([x0, y, sc, v], i) => {
      const x = x0 + (st.sky * 300) + t * v; ctx.fillStyle = P.cloud; ctx.globalAlpha = .9;
      [[0, 0, 80, 28], [-66, 12, 56, 22], [62, 10, 60, 24], [12, -20, 50, 28]].forEach(([a, b, rx, ry]) => { ctx.beginPath(); ctx.ellipse(x + a * sc, y + b * sc, rx * sc, ry * sc, 0, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
    });
    let cx = -2600; C.seed(st.seed); let n = 0;
    while (cx < 2600) { const bw = 120 + rnd(st.seed * 100 + n) * 200, bh = 120 + rnd(st.seed * 100 + n + 50) * 380; C.shape(ctx, [[cx, -60], [cx, -60 - bh], [cx + bw, -60 - bh], [cx + bw, -60]], P.far, { lw: 3, ink: P.far2, amp: .6 }); cx += bw + 14; n++; }
    const hzg = ctx.createLinearGradient(0, -300, 0, -40); hzg.addColorStop(0, 'rgba(240,226,194,0)'); hzg.addColorStop(1, 'rgba(240,226,194,.65)'); ctx.fillStyle = hzg; ctx.fillRect(-2600, -300, 5200, 262);
    const gg = ctx.createLinearGradient(0, -60, 0, 1400); gg.addColorStop(0, P.groundLt); gg.addColorStop(.35, P.ground); gg.addColorStop(1, P.groundDk);
    ctx.fillStyle = gg; ctx.fillRect(-2600, -60, 5200, 1700); ctx.fillStyle = P.groundDk; ctx.fillRect(-2600, 1630, 5200, 2000);
    for (let i = 0; i < 24; i++) C.blot(ctx, C.ell(-2400 + rnd(st.seed + 4000 + i) * 4800, -20 + rnd(st.seed + 4100 + i) * 1200, 60 + rnd(4200 + i) * 120, 10 + rnd(4300 + i) * 12, 12), i % 2 ? P.groundDk : P.groundLt, .22);
  }
  function siteFence(ctx) {   // çit: tel örgü + şeritli bar (kameraya yakın, y=260)
    const fy = 260;
    ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = P.dustDk; ctx.lineWidth = 2;
    for (let fx = -2600; fx < 2600; fx += 22) { ctx.beginPath(); ctx.moveTo(fx, fy - 170); ctx.lineTo(fx + 80, fy); ctx.moveTo(fx + 80, fy - 170); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.restore();
    C.seed(2901); C.line(ctx, [[-2600, fy - 172], [2600, fy - 168]], 4, P.dustDk, 1);
    for (let fx = -2560; fx < 2600; fx += 300) C.line(ctx, [[fx, fy - 186], [fx + 2, fy + 4]], 9, P.steelDk, .4);
    const bar = C.shape(ctx, [[-2600, fy - 120], [2600, fy - 124], [2600, fy - 90], [-2600, fy - 86]], null, { lw: 0 });
    C.hazardStripes(ctx, bar, -2604, fy - 128, 5210, 44, 22); C.ink(ctx, bar, 4);
  }
  function worker(ctx, x, y, s, sd, ph, flag) {   // p3-b ile aynı ekip (baretli, turuncu yelek)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd);
    const lw = 5 / Math.sqrt(s), body = '#46505c', bodyDk = '#343c46';
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 70, 11, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.shape(ctx, [[-34, -220], [-4, -220], [-10, -10], [-40, -10]], bodyDk, { lw }); C.shape(ctx, [[4, -220], [34, -220], [40, -10], [10, -10]], body, { lw });
    C.shape(ctx, [[-46, -14], [-6, -14], [0, 0], [-50, 0]], P.bootDk, { lw }); C.shape(ctx, [[8, -14], [46, -14], [54, 0], [6, 0]], P.bootDk, { lw });
    C.tube(ctx, [[-50, -360], [-66, -290], [-60, -228]], 34, 28, bodyDk, lw);
    C.shape(ctx, [[-56, -372], [56, -372], [62, -220], [-62, -220]], '#e0672a', { lw, shade: c => C.blot(c, [[20, -380], [70, -380], [70, -210], [26, -210]], '#b44e1c', .6) });
    C.line(ctx, [[-58, -290], [58, -290]], 7, P.paper, .3); C.line(ctx, [[-20, -372], [-20, -222]], 6, P.paper, .3); C.line(ctx, [[20, -372], [20, -222]], 6, P.paper, .3);
    if (flag) { C.tube(ctx, [[50, -360], [80, -400], [96, -450]], 34, 28, body, lw); C.line(ctx, [[96, -440], [100, -560]], 5, P.ink, .2); C.shape(ctx, [[100, -560], [160, -548 + Math.sin(ph * 2) * 6], [100, -516]], '#c8362a', { lw: lw * .8 }); }
    else C.tube(ctx, [[50, -360], [66, -290], [60, -228]], 34, 28, body, lw);
    C.shape(ctx, C.ell(0, -414, 36, 40, 18), '#a87a56', { lw });
    C.shape(ctx, [[-44, -430], [-38, -462], [-16, -478], [16, -478], [38, -462], [44, -430], [52, -428], [52, -420], [-52, -420], [-52, -428]], P.helmet, { lw, shade: c => C.blot(c, [[10, -480], [56, -480], [56, -418], [18, -418]], P.helmetDk, .7) });
    ctx.restore();
  }
  /* parçacık + toz (p3-b ile aynı fizik) */
  const GRAV = 2200;
  function chips(ctx, tau, n, sb, spawn, size, groundY) {
    if (tau < 0) return;
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 1000 + i * 13 + j), s = spawn(i, r), gy = (groundY || 0) + 6 + r(9) * 90;
      const vy = s.vy, A = .5 * GRAV, disc = vy * vy + 4 * A * Math.max(0, gy - s.y), tl = (-vy + Math.sqrt(disc)) / (2 * A);
      const tt = Math.min(tau, tl), x = s.x + s.vx * tt, y = s.y + vy * tt + A * tt * tt;
      const sz = (size || 1) * (8 + r(5) * 14), rot = r(6) * 6 + (r(7) - .5) * 18 * tt;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); C.seed(sb * 50 + i);
      C.shape(ctx, [[-sz, -sz * .5], [sz * .9, -sz * .55], [sz, sz * .45], [-sz * .8, sz * .5]], s.col || [P.concrete, P.concreteDk, P.dustLt, P.steelDk][i % 4], { lw: 2.6, amp: .5 });
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
  // bina zamanı: tutma 0,12 → düşüş 0,5 sn (inQ) → yere değme
  const FALL = { hold: .12, dur: .5 };
  function drawSite(ctx, n, t, t0, o) {
    o = o || {}; const st = SITES[n], b = building(st.v), zn = zoneOf(st, b);
    const f0 = t0 + FALL.hold, land = f0 + FALL.dur, u = E.inQ(seg(t, f0, land)), tau = t - land;
    siteBg(ctx, st, t);
    TB.zone(ctx, zn.x, zn.y, zn.w, zn.h, 1);
    // tebeşirle başlık: numara (yerde, bina önünde)
    // bina
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 4000 + 26); ctx.clip();
    if (st.dir === 0) {   // yerine çöker: aşağı iner, alt kısım toz içinde
      const sink = u * .82 + (tau > 0 ? .06 * (1 - Math.exp(-tau * 3)) : 0), sq = 1 - .1 * u;
      ctx.translate(0, b.bh * sink); ctx.scale(1 + .04 * u, sq);
      ctx.drawImage(b.cv, -b.ox, -b.oy);
    } else {
      const piv = st.dir * b.bw / 2, a = st.dir * (Math.PI / 2) * u;
      let crush = tau > 0 ? E.outC(clamp(tau / .35)) * .45 : 0;
      ctx.translate(piv, 0); ctx.rotate(a); ctx.translate(-piv, 0);
      if (crush) { ctx.translate(piv, 0); ctx.scale(1 - crush, 1); ctx.translate(-piv, 0); }
      ctx.drawImage(b.cv, -b.ox, -b.oy);
    }
    ctx.restore();
    // darbe + toz
    if (tau >= 0) {
      const cx0 = st.dir === 0 ? 0 : zn.x, span = st.dir === 0 ? b.bw : b.bh;
      chips(ctx, tau, 26, 60 + n, (i, r) => ({ x: cx0 + (r(1) - .5) * span, y: -20 - r(2) * 50, vx: (r(3) - .5) * 520, vy: -240 - r(4) * 520, col: [P.brick, P.concreteDk, P.dustLt, P.concrete][i % 4] }), 1.2);
      const a = tau < 2 ? 1 : clamp(1 - (tau - 2) / 4, .3, 1);
      dustCloud(ctx, tau, 90, 70 + n, (i, r) => ({ x: cx0 + (r(1) - .5) * span * 1.05, y: -10 - r(2) * 40, r: 50 + r(3) * r(3) * 200, vx: (r(4) - .5) * 300, rise: 60 + r(5) * r(5) * 620, grow: .9 + r(6) * .5, delay: r(7) * .1, sink: 20 }), a, 8);
    }
    if (st.dir === 0 && t >= f0) dustCloud(ctx, t - f0, 30, 80 + n, (i, r) => ({ x: (r(1) - .5) * b.bw * 1.1, y: -10, r: 40 + r(3) * 120, vx: (r(4) - .5) * 200, rise: 20 + r(5) * 260, grow: .5, delay: r(7) * .3, sink: 0 }), .9, 6);
    // Daisy sahada, susar (ışık sönük)
    if (o.daisy !== false) { const dx = st.dir === 1 ? -b.bw / 2 - 900 : b.bw / 2 + 760; C.drawDaisy(ctx, { x: dx, y: 120, s: .95, seed: 23, beep: 0, mood: 'sleepy', hook: Math.sin(t * 1.2) * .03, flip: st.dir === 1 }); }
    siteFence(ctx);
    if (o.crew !== false) [[-560, 470, 0], [-260, 500, 1], [380, 486, 2], [700, 470, 3]].forEach(([x, y, i]) => worker(ctx, x + (st.dir === 1 ? -200 : 0), y, 1.0, 400 + i * 7 + n, t * 4 + i, i === 2));
    if (o.defne) drawDefneTalk(ctx, { x: o.defne.x, y: o.defne.y, s: 1.1, seed: 31, expr: o.defne.expr || 'determined', item: 'helmet', look: o.defne.look || 0 }, 0, 0, 0);
    return land;
  }

  /* ================= RAPOR (dedenin el yazısı): çatlak çizelgesi + temel kesiti ================= */
  const REP = { w: 700, h: 940 };
  function reportPage(ctx, crack) {
    const pg = cached('rapor', 760, 1000, c => {
      c.translate(30, 30); C.seed(3001);
      C.shape(c, [[0, 0], [REP.w, 0], [REP.w, REP.h], [0, REP.h]], '#ece3cc', { lw: 3.4, amp: .7, shade: cc => {
        cc.strokeStyle = 'rgba(31,79,224,.10)'; cc.lineWidth = 1; for (let y = 40; y < REP.h; y += 26) { cc.beginPath(); cc.moveTo(0, y); cc.lineTo(REP.w, y); cc.stroke(); }
        cc.strokeStyle = 'rgba(190,60,50,.25)'; cc.beginPath(); cc.moveTo(70, 0); cc.lineTo(70, REP.h); cc.stroke();
        for (let q = 0; q < 14; q++) { cc.fillStyle = `rgba(160,118,62,${.06 + rnd(3100 + q) * .1})`; cc.beginPath(); cc.arc(rnd(3200 + q) * REP.w, rnd(3300 + q) * REP.h, 4 + rnd(3400 + q) * 10, 0, TAU); cc.fill(); }
      } });
      C.handwrite(c, 'No. 9 - foundation', 92, 66, 40, INK_OLD, 301, { bold: true });
      C.handwrite(c, 'crack width, every spring', 96, 110, 26, INK_OLD, 303);
      // çizelge
      const gx = 120, gy = 520, gw = 520, gh = 330;
      C.seed(3011); stroke(c, [[gx, gy - gh], [gx, gy], [gx + gw, gy]], 4, INK_OLD, .9);
      for (let q = 0; q <= 4; q++) { const x = gx + q * gw / 4; C.seed(3020 + q); stroke(c, [[x, gy], [x, gy + 12]], 3, INK_OLD, .8); C.handwrite(c, String(1985 + q * 10), x - 34, gy + 46, 24, INK_OLD, 310 + q); }
      for (let q = 1; q <= 3; q++) { const y = gy - q * gh / 3.2; C.seed(3030 + q); stroke(c, [[gx - 12, y], [gx, y]], 3, INK_OLD, .8); C.handwrite(c, q * 2 + '', gx - 44, y + 9, 24, INK_OLD, 320 + q); }
      C.handwrite(c, 'mm', gx - 52, gy - gh - 14, 24, INK_OLD, 330);
      const pts = []; for (let q = 0; q <= 40; q++) { const u = q / 40, v = .03 + .97 * (Math.exp(u * 2.6) - 1) / (Math.exp(2.6) - 1); pts.push([gx + u * gw, gy - v * gh * .92 + (rnd(3500 + q) - .5) * 6]); }
      pts.forEach(([x, y], q) => { if (q % 4 === 0) { c.fillStyle = INK_OLD; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); } });
      C.seed(3040); stroke(c, smooth(pts.filter((p, q) => q % 4 === 0), 4), 3.4, INK_OLD, .9);
      // son nokta: dedenin kırmızı kalem halkası
      const lp = pts[40]; C.seed(3041); stroke(c, C.ell(lp[0], lp[1], 26, 22, 18), 3.4, '#b8322a', .9);
      C.handwrite(c, 'still moving', gx + gw - 230, gy - gh + 40, 26, '#b8322a', 340);
      // temel kesiti (sağ alt): döşeme + kazıklar; çatlak dışarıda (canlı) çizilir
      const sx = 120, sy = 640; C.handwrite(c, 'section A-A', sx, sy - 14, 24, INK_OLD, 350);
      C.seed(3050); C.shape(c, [[sx, sy], [sx + 480, sy], [sx + 480, sy + 70], [sx, sy + 70]], 'rgba(58,48,38,.08)', { lw: 3, ink: INK_OLD, amp: .6 });
      for (let q = 0; q < 5; q++) { const x = sx + 40 + q * 100; C.seed(3060 + q); C.shape(c, [[x, sy + 70], [x + 30, sy + 70], [x + 30, sy + 230], [x, sy + 230]], 'rgba(58,48,38,.06)', { lw: 2.6, ink: INK_OLD, amp: .5 }); }
      C.seed(3070); stroke(c, [[sx - 30, sy - 4], [sx + 520, sy - 4]], 2, INK_OLD, .5);
      for (let q = 0; q < 16; q++) { C.seed(3080 + q); stroke(c, [[sx - 20 + q * 34, sy + 260], [sx - 4 + q * 34, sy + 244]], 1.6, INK_OLD, .5); }
    });
    ctx.drawImage(pg, -30, -30);
    // çatlak: kesitteki döşemede, yavaşça uzar (crack 0..1)
    const sx = 120, sy = 640, cp = [[sx + 300, sy], [sx + 292, sy + 18], [sx + 306, sy + 34], [sx + 296, sy + 52], [sx + 310, sy + 70], [sx + 302, sy + 98], [sx + 318, sy + 124], [sx + 310, sy + 150]];
    const L = 2 + crack * (cp.length - 2), n = Math.floor(L), fr = L - n, pp = cp.slice(0, n);
    if (n < cp.length) pp.push([lerp(cp[n - 1][0], cp[n][0], fr), lerp(cp[n - 1][1], cp[n][1], fr)]);
    C.seed(3090); stroke(ctx, pp, 4, INK_OLD, .95);
  }
  function drawFolder(ctx, open, o) {   // dosya: kapak (dedenin yazısı) sağa açılır; open 0..1
    o = o || {}; const W = 720, H = 960; C.seed(3201);
    ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = P.ink; ctx.fillRect(-W / 2 + 18, -H / 2 + 22, W, H); ctx.restore();
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], '#b89463', { lw: 5 });
    for (let q = 0; q < 6; q++) C.line(ctx, [[-W / 2 + 10, H / 2 - 6 - q * 5], [W / 2 - 10, H / 2 - 4 - q * 5]], 1.6, 'rgba(21,18,13,.35)', .5);
    if (open > .02) { ctx.save(); ctx.translate(-W / 2 + 10, -H / 2 + 10); reportPage(ctx, 0); ctx.restore(); }
    const c = Math.cos(Math.PI * open);
    if (c > -.98) {
      ctx.save(); ctx.translate(-W / 2, 0); ctx.scale(c, 1); ctx.translate(W / 2, 0); C.seed(3202);
      C.shape(ctx, [[-W / 2, -H / 2 - 4], [W / 2 + 8, -H / 2 - 4], [W / 2 + 8, H / 2 + 4], [-W / 2, H / 2 + 4]], c > 0 ? '#c9a26b' : '#a07c48', { lw: 5, shade: cc => { C.blot(cc, [[W * .2, -H / 2 - 10], [W / 2 + 14, -H / 2 - 10], [W / 2 + 14, H / 2 + 10], [W * .26, H / 2 + 10]], '#a88a5a', .4); for (let q = 0; q < 8; q++) { cc.fillStyle = 'rgba(122,74,36,.12)'; cc.beginPath(); cc.arc(-W / 2 + rnd(3300 + q) * W, -H / 2 + rnd(3400 + q) * H, 6 + rnd(3500 + q) * 18, 0, TAU); cc.fill(); } } });
      if (c > 0) {
        C.shape(ctx, [[-W * .34, -H * .3], [W * .34, -H * .3], [W * .34, -H * .06], [-W * .34, -H * .06]], P.paper, { lw: 3.4 });
        C.handwrite(ctx, 'No. 9', -W * .26, -H * .14, 96, INK_OLD, 361, { bold: true });
        C.handwrite(ctx, 'reports 1985 -', -W * .28, H * .06, 40, INK_OLD, 363);
        C.handwrite(ctx, 'S. Kaya', W * .02, H * .38, 44, INK_OLD, 365);
        // dosya halkası
        ctx.save(); ctx.globalAlpha = .22; ctx.strokeStyle = P.coffee; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(W * .24, H * .24, 60, .5, 5.6); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
    }
  }

  /* ================= İZİN BELGESİ ================= */
  function permitDoc(ctx, signN, stampA) {
    const W = 720, H = 960; C.seed(3601);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.fillRect(-W / 2 + 16, -H / 2 + 18, W, H); ctx.restore();
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], P.paper, { lw: 5, shade: c => C.blot(c, [[W * .25, -H / 2 - 4], [W / 2 + 4, -H / 2 - 4], [W / 2 + 4, H / 2 + 4], [W * .3, H / 2 + 4]], P.paperDk, .45) });
    // belediye mührü (P2 zarfındaki ile aynı): kule + üç yıldız, çift halka
    ctx.save(); ctx.translate(-W / 2 + 96, -H / 2 + 98);
    ctx.strokeStyle = INK_OLD; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.stroke(); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 47, 0, TAU); ctx.stroke();
    ctx.fillStyle = INK_OLD; ctx.fillRect(-14, -18, 28, 40); ctx.fillRect(-22, 14, 44, 8); for (let i = -1; i <= 1; i++) ctx.fillRect(i * 10 - 3, -26, 6, 8);
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * .55; ctx.beginPath(); ctx.arc(Math.cos(a) * 37, Math.sin(a) * 37 + 2, 3.5, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.fillStyle = P.ink; ctx.textAlign = 'left';
    ctx.font = '700 40px Rubik'; ctx.fillText('CITY HALL', -W / 2 + 180, -H / 2 + 86);
    ctx.font = '500 24px Rubik'; ctx.fillText('Building Safety Office', -W / 2 + 182, -H / 2 + 122);
    ctx.font = '700 52px Rubik'; ctx.fillText('DEMOLITION PERMIT', -W / 2 + 50, -H / 2 + 250);
    ctx.font = '500 28px Rubik';
    [['Site:', 'Kaya Yard'], ['Work:', 'old buildings 3 - 10'], ['Method:', 'slow, fenced, licensed crew']].forEach(([a, b], i) => { ctx.fillStyle = 'rgba(21,18,13,.65)'; ctx.fillText(a, -W / 2 + 50, -H / 2 + 330 + i * 52); ctx.fillStyle = P.ink; ctx.fillText(b, -W / 2 + 200, -H / 2 + 330 + i * 52); });
    for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(21,18,13,.12)'; ctx.fillRect(-W / 2 + 50, -H / 2 + 500 + i * 30, W - 100 - (i % 2) * 160, 8); }
    ctx.font = '500 24px Rubik'; ctx.fillStyle = 'rgba(21,18,13,.65)'; ctx.fillText('Engineer of record', -W / 2 + 50, H / 2 - 190);
    ctx.restore();
    C.seed(3602); C.line(ctx, [[-W / 2 + 50, H / 2 - 120], [W / 2 - 250, H / 2 - 122]], 3, P.ink, .5);
    ctx.save(); ctx.font = '500 22px Rubik'; ctx.fillStyle = 'rgba(21,18,13,.6)'; ctx.fillText('Defne Kaya, P.Eng.', -W / 2 + 50, H / 2 - 88); ctx.restore();
    if (signN > 0) C.handwrite(ctx, 'Defne Kaya'.slice(0, signN), -W / 2 + 64, H / 2 - 132, 58, P.ink, 371, { bold: true, track: .86 });
    if (stampA > 0) permitStamp(ctx, 150, H / 2 - 270, stampA);
  }
  function permitStamp(ctx, x, y, a) {   // kırmızı lastik damga izi: PERMIT · APPROVED
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.14); ctx.globalAlpha = a * .88;
    const col = '#b8322a'; ctx.strokeStyle = col; ctx.fillStyle = col;
    rrect(ctx, -190, -70, 380, 140, 14); ctx.lineWidth = 8; ctx.stroke(); rrect(ctx, -176, -56, 352, 112, 8); ctx.lineWidth = 3; ctx.stroke();
    ctx.font = '700 46px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PERMIT', 0, -16);
    ctx.font = '700 30px Rubik'; ctx.fillText('· APPROVED ·', 0, 30);
    ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 70; i++) { ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc((rnd(3700 + i) - .5) * 380, (rnd(3800 + i) - .5) * 140, 1 + rnd(3900 + i) * 4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function defneHand(ctx, x, y, rot, o) {   // Defne'nin eli (krem gömlek kolu), kalem tutar
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(o.s || 1, o.s || 1); C.seed(3610);
    C.shape(ctx, [[30, 40], [120, 10], [700, 300], [600, 420]], P.shirt, { lw: 6, shade: c => C.blot(c, [[60, 60], [700, 340], [620, 430], [40, 90]], P.shirtDk, .6) });
    C.shape(ctx, [[60, 0], [140, -24], [168, 60], [92, 92]], P.shirtDk, { lw: 5 });
    if (o.pen) { C.line(ctx, [[-60, -66], [70, 26]], 14, P.ink, .2); C.line(ctx, [[-60, -66], [70, 26]], 7, '#3a3d45', .2); }
    C.shape(ctx, [[-50, -40], [20, -50], [80, -10], [90, 50], [40, 70], [-30, 50], [-60, 0]], P.dSkin, { lw: 6, shade: c => C.blot(c, [[10, 20], [100, 20], [100, 80], [10, 80]], P.dSkinDk, .5) });
    C.line(ctx, [[-40, -20], [10, -6]], 3, P.dSkinDk, .3); C.line(ctx, [[-36, 10], [16, 22]], 3, P.dSkinDk, .3);
    ctx.restore();
  }
  function kaanHandPen(ctx, x, y, rot) {   // Kaan'ın eli (yeşil ceket, sarı bileklik), siyah keçeli kalem; uç (x,y)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); C.seed(3620);
    C.line(ctx, [[0, 0], [70, -96]], 20, P.ink, .2); C.line(ctx, [[0, 0], [70, -96]], 11, '#2b2b30', .2); C.line(ctx, [[2, -3], [14, -20]], 6, '#111', .1);
    C.shape(ctx, [[60, -150], [140, -170], [200, -90], [150, -20], [70, -40], [40, -100]], P.skin, { lw: 6, shade: c => C.blot(c, [[120, -170], [210, -170], [210, -20], [140, -20]], P.skinDk, .5) });
    C.line(ctx, [[86, -120], [130, -100]], 3, P.skinDk, .3);
    C.shape(ctx, [[150, -180], [220, -120], [196, -80], [126, -140]], P.hazard, { lw: 5 });
    C.shape(ctx, [[180, -170], [700, -10], [640, 200], [150, -60]], P.jacket, { lw: 6, shade: c => C.blot(c, [[200, -100], [680, 60], [640, 200], [180, -40]], P.jacketDk, .55) });
    ctx.restore();
  }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 12a: şafak; telefon, parmak ilk hamleyi seçer (gerçek oyun: kepenk açılır, bina ayakta) --- */
  const SWd = 486, SHd = 864, BWd = 548, BHt = 1000;
  const TAP = [(282 / 450 - .5) * SWd, (497 / 800 - .5) * SHd];   // oyunun sarı kesik dairesinin ortası (bina tabanı)
  shot('p7b12-telefon', k => k.start, k => k.kface, (ctx, t, u) => {
    const k = times(), z = 1.3 * lerp(.98, 1.03, E.io(u)), tw = twos(t);
    const bg = cached('p7b-tel-bg', 1080, 1920, c => {
      const g = c.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#2a2433'); g.addColorStop(1, '#14121f'); c.fillStyle = g; c.fillRect(0, 0, 1080, 1920);
      [[180, 360, 220, 'rgba(240,176,120,.30)'], [120, 640, 160, 'rgba(255,210,150,.22)'], [920, 300, 90, 'rgba(238,242,255,.08)'], [980, 1300, 140, 'rgba(120,150,220,.08)'], [300, 220, 70, 'rgba(255,220,170,.25)']].forEach(([x, y, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    });
    ctx.drawImage(bg, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';     // sol üstten şafak ışığı + ekran halesi
    const dg = ctx.createRadialGradient(80, 200, 40, 80, 200, 900); dg.addColorStop(0, `rgba(240,170,110,${.18 + .1 * u})`); dg.addColorStop(1, 'rgba(240,170,110,0)'); ctx.fillStyle = dg; ctx.fillRect(0, 0, 1080, 1920);
    const hg = ctx.createRadialGradient(540, 760, 200, 540, 760, 760); hg.addColorStop(0, 'rgba(255,226,122,.26)'); hg.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .5);
    const jx = Math.sin(tw * 2.1) * 3, jy = Math.sin(tw * 1.3 + 1) * 3, rot = -.06 + Math.sin(tw * .8) * .006;
    ctx.save(); ctx.translate(540 + jx, 760 + jy); ctx.rotate(rot * .6); ctx.transform(1, 0, -.035, 1, 0, 0); ctx.scale(z, z);
    drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6);
    C.seed(171); C.shape(ctx, rrectPts(-BWd / 2, -BHt / 2, BWd, BHt, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BWd / 2, -BHt / 2, 30, BHt); } });
    C.shape(ctx, [[-60, -BHt / 2 + 24], [60, -BHt / 2 + 24], [60, -BHt / 2 + 36], [-60, -BHt / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SWd / 2, -SHd / 2, SWd, SHd, 34); ctx.clip();
    const im = gameFrame(t); if (im && im.naturalWidth) ctx.drawImage(im, -SWd / 2, -SHd / 2, SWd, SHd); else { ctx.fillStyle = P.screen; ctx.fillRect(-SWd / 2, -SHd / 2, SWd, SHd); }
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SWd / 2, -SHd / 2 + 80); ctx.lineTo(-SWd / 2 + 220, -SHd / 2); ctx.lineTo(-SWd / 2 + 300, -SHd / 2); ctx.lineTo(-SWd / 2, -SHd / 2 + 180); ctx.fill();
    const rd = t - k.tap; if (rd >= 0 && rd < .45) { ctx.strokeStyle = `rgba(255,255,255,${.9 * (1 - rd / .45)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(TAP[0], TAP[1], 20 + rd * 200, 0, TAU); ctx.stroke(); }
    ctx.restore();
    C.ink(ctx, (() => { const p = new Path2D(); const q = C.wobble(rrectPts(-SWd / 2, -SHd / 2, SWd, SHd, 34, 6), true, .5); p.moveTo(q[0][0], q[0][1]); q.forEach(v => p.lineTo(v[0], v[1])); p.closePath(); return p; })(), 4);
    // başparmak: binanın üstünde dolaşır ("nereden?"), sonra tabandaki noktaya dokunur
    const th = twos(t), hov = seg(th, k.start + .25, k.tap - .25);
    const ang = hov * TAU * 1.1, fade = 1 - seg(th, k.tap - .45, k.tap), hx = TAP[0] - 20 + Math.cos(ang) * 90 * fade, hy = TAP[1] - 120 * fade + Math.sin(ang) * 60 * fade;
    const inU = E.outC(seg(th, k.start, k.start + .35)), lift = t < k.tap ? 1 : 1 - .3 * seg(th, k.tap + .15, k.tap + .4);
    const tx = lerp(330, hx + 30, inU * lift), ty = lerp(560, hy + 50, inU * lift) - (t < k.tap - .08 ? 16 : 0);
    drawHandSide(ctx, BWd / 2 - 10, 0, true, 6);
    C.seed(172);
    C.shape(ctx, [[BWd / 2 + 60, 380], [tx + 50, ty - 30], [tx + 10, ty - 50], [tx - 30, ty - 30], [tx - 20, ty + 20], [BWd / 2 + 20, 470]], P.skin, { lw: 6, shade: c => C.blot(c, [[tx - 10, ty + 5], [BWd / 2 + 80, 420], [BWd / 2 + 80, 520], [tx, ty + 60]], P.skinDk, .5) });
    C.shape(ctx, [[tx - 22, ty - 34], [tx + 6, ty - 46], [tx + 18, ty - 24], [tx - 8, ty - 14]], '#e7b896', { lw: 3 });
    ctx.restore();
    finish(ctx);
  });

  /* --- 12b: Kaan'ın yüzü, şafak penceresi; "start"ta küçük gülümseme (sıcak an) --- */
  shot('p7b12-yuz', k => k.kface, k => k.defne, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.32, 1.4, E.io(u)), s = 2.5, kx = 500, ky = 1880;
    ctx.save(); cam(ctx, z, 470, 820, 540, 900);
    drawRoomDawn(ctx, u);
    const expr = tw >= k.smile ? 'smile' : 'calm', look = tw >= k.smile - .2 ? -.3 : .5;
    C.drawKaan(ctx, { x: kx, y: ky, s, seed: 11, expr, look, blink: blinkAt(tw, [k.kface + .35]), phone: true });
    drawBlanket(ctx, ky - 200 * s + 10);
    ctx.restore();
    // şafak: soldan sıcak ışık, oda hâlâ loş
    ctx.save(); ctx.fillStyle = 'rgba(12,10,24,.42)'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(140, 500, 40, 140, 500, 900); g.addColorStop(0, 'rgba(240,170,110,.42)'); g.addColorStop(.6, 'rgba(240,150,100,.12)'); g.addColorStop(1, 'rgba(240,150,100,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    const g2 = ctx.createRadialGradient(640, 980, 10, 640, 980, 360); g2.addColorStop(0, 'rgba(255,226,122,.18)'); g2.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, 1080, 1920);
    ctx.restore();
    finish(ctx);
  });

  /* --- 13: "Defne did not shout." Defne yakın, avlu; bağırmaz, kaşları yumuşar --- */
  shot('p7b13-defne', k => k.defne, k => k.two, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredWorld('bg-defne', 1.9, 560, 1300, 9, {});
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + u * .03, 1 + u * .03); ctx.drawImage(bg, -540, -960); ctx.restore();
    const soft = E.io(seg(tw, k.soft - .1, k.soft + .25));
    const expr = tw < k.soft - .1 ? 'serious' : (tw < k.two - .45 ? 'calm' : 'calm');
    const breath = Math.sin(tw * 1.7) * 4 + soft * 8;
    ctx.save(); cam(ctx, lerp(1, 1.04, E.io(u)), 540, 960);
    drawDefneTalk(ctx, { x: 520, y: 2280 + breath, s: 3.0, seed: 31, expr, look: -.4, blink: blinkAt(tw, [k.defne + .5, k.soft + .5]), item: 'coffee' }, -.03 * soft, 4 * soft, .01 * Math.sin(tw * 1.2));
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 14–15a: ikili plan; "Okay." başını sallar; sonra Daisy'ye döner --- */
  function duo(ctx, t, o) {
    const k = times(), tw = twos(t);
    const nod = t >= k.okay - .05 && t < k.okay + .45 ? Math.sin(seg(tw, k.okay - .05, k.okay + .45) * Math.PI * 2) * .07 : 0;
    const turnU = E.outBack(seg(tw, k.turn, k.turn + .35));
    const talking = (tw >= k.two + .25 && tw < k.two + .8) || (tw >= k.turn && tw < k.dcu);
    const dExpr = tw >= k.turn + .5 ? 'confident' : talking ? talkExpr(tw, 7) : 'calm';
    const kExpr = tw >= k.turn + .4 ? 'sheepish' : tw >= k.okay + .1 ? 'surprised' : 'sheepish';
    world(ctx, t, {
      defne: { x: DEFNE.x, y: DEFNE.y, s: DEFNE.s, expr: dExpr, item: 'coffee', look: lerp(-1, .9, turnU), blink: blinkAt(tw, [k.two + .9]), headRot: nod - .06 * turnU + .02 * Math.sin(tw * 3) * (talking ? 1 : 0), headDy: 0, lean: .05 * turnU },
      kaan: { x: KAAN.x, y: KAAN.y, s: KAAN.s, expr: kExpr, look: tw >= k.turn + .3 ? 1 : .8, blink: blinkAt(tw, [k.okay + .5]), phone: false }
    });
  }
  shot('p7b14-ikili', k => k.two, k => k.dcu, (ctx, t, u) => {
    const k = times(), e = E.io(seg(t, k.two, k.dcu)), tr = E.io(seg(t, k.turn, k.dcu));
    ctx.save(); cam(ctx, lerp(1.72, 1.66, e), lerp(400, 470, tr), lerp(1500, 1470, tr), 540, 880);
    duo(ctx, t);
    airDust(ctx, t, 14, 41, [0, 1100, 1080, 600], .7);
    ctx.restore();
    vignette(ctx, .2);
    finish(ctx);
  });

  /* --- 15b: Daisy yakın, Defne önde; "too": siperlik "duydu" gibi kalkar --- */
  shot('p7b15-daisy', k => k.dcu, k => k.desk, (ctx, t, u) => {
    const k = times(), tw = twos(t), up = tw >= k.lid;
    const hop = up ? -Math.sin(Math.PI * seg(t, k.lid, k.lid + .2)) * 10 * Math.exp(-(t - k.lid) * 2) : 0;
    const z = lerp(2.15, 2.25, E.io(u));
    ctx.save(); cam(ctx, z, DAISY.x - 40, DAISY.y - 190, 600, 760);
    world(ctx, t, { daisy: { mood: up ? 'alert' : 'sleepy', bob: hop / z, hook: Math.sin(t * 1.1) * .025 + (up ? .04 * Math.exp(-(t - k.lid) * 2) * Math.sin((t - k.lid) * 9) : 0) } });
    ctx.restore();
    // Defne önde solda (omuz + baş, Daisy'ye bakar)
    ctx.save();
    drawDefneTalk(ctx, { x: 130, y: 1980, s: 2.6, seed: 31, expr: tw < k.lid + .25 ? 'confident' : 'smile', item: 'coffee', look: 1, blink: blinkAt(tw, [k.lid + .55]) }, .04 + .02 * Math.sin(tw * 4) * (tw < k.lid ? 1 : 0), 0, .03);
    ctx.restore();
    vignette(ctx, .22);
    finish(ctx);
  });

  /* --- 16: "And she moved her desk into the yard." Defne masayı ofis kapısından Daisy'nin yanına iter --- */
  function deskPos(t) {
    const k = times(), u = E.io(seg(t, k.desk + .15, k.sign - .3));
    const x = lerp(DESK0.x, DESK.x, u), y = lerp(DESK0.y, DESK.y, u), s = lerp(.6, DESK.s, (y - DESK0.y) / (DESK.y - DESK0.y));
    return { x, y, s, u, moving: u > 0 && u < 1 };
  }
  shot('p7b16-masa', k => k.desk, k => k.sign, (ctx, t, u) => {
    const k = times(), tw = twos(t), d = deskPos(tw), e = E.io(u);
    const step = d.moving ? Math.abs(Math.sin(tw * 9)) * 6 * d.s : 0;
    ctx.save(); cam(ctx, lerp(1.08, 1.14, e), lerp(470, 400, e), lerp(1420, 1480, e), 540, 900);
    world(ctx, t, {
      extra: [[d.y - 30, () => drawDefneTalk(ctx, { x: d.x + 6, y: d.y - 30 * d.s - step, s: d.s, seed: 31, expr: d.moving ? 'determined' : 'calm', look: .2, blink: blinkAt(tw, [k.desk + 1.4]) }, 0, 0, d.moving ? .1 : .02)],
        [d.y, () => { drawDesk(ctx, d.x, d.y, d.s, {}); }]],
      kaan: { x: 130, y: 1830, s: KAAN.s, expr: tw > k.desk + 1.2 ? 'smile' : 'sheepish', look: 1, blink: blinkAt(tw, [k.desk + .6]) }
    });
    // masa ayaklarından çakıl tozu
    if (d.moving) for (let i = 0; i < 10; i++) { const r = j => rnd(4600 + i * 7 + j), a = ((t * 1.6 + r(1)) % 1); ctx.fillStyle = `rgba(216,202,176,${.5 * (1 - a)})`; ctx.beginPath(); ctx.arc(d.x + (r(2) - .5) * 360 * d.s + a * 30, d.y - 6 - a * 40, 8 + a * 26, 0, TAU); ctx.fill(); }
    airDust(ctx, t, 16, 43, [0, 1000, 1080, 700], .7);
    ctx.restore();
    finish(ctx);
  });

  /* --- 17a: imza (üstten masa): Defne "Defne Kaya" yazar --- */
  function deskTop(ctx, key) {
    const cv = cached('masa-ust', 1080, 2400, c => {
      c.fillStyle = '#d9d3bf'; c.fillRect(0, 0, 1080, 2400); C.seed(3701);
      for (let i = 0; i < 10; i++) C.blot(c, C.ell(rnd(3710 + i) * 1080, rnd(3720 + i) * 2400, 120 + rnd(3730 + i) * 160, 30 + rnd(3740 + i) * 30, 12), '#c4bca3', .5);
      c.strokeStyle = 'rgba(31,79,224,.07)'; c.lineWidth = 2; for (let x = 0; x < 1080; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 2400); c.stroke(); }
    });
    ctx.drawImage(cv, -540, -1200);
  }
  function signChars(t) { const k = times(), u = seg(t, k.signW, k.signW + .85); return Math.round(10 * u); }
  shot('p7b17-imza', k => k.sign, k => k.stampCut, (ctx, t, u) => {
    const k = times(), tw = twos(t), n = signChars(tw);
    ctx.save(); ctx.translate(540, 760); ctx.scale(lerp(1.5, 1.62, E.io(u)), lerp(1.5, 1.62, E.io(u))); ctx.rotate(-.04); ctx.translate(40, -300);
    deskTop(ctx);
    permitDoc(ctx, n, 0);
    // kalem ucu: yazılan son harfin sonunda
    const W = 720, H = 960; ctx.save(); ctx.font = '500 58px Rubik'; const wd = ctx.measureText('Defne Kaya'.slice(0, n)).width * .86; ctx.restore();
    const inU = E.outC(seg(tw, k.sign, k.signW)), outU = E.inQ(seg(tw, k.signW + .95, k.stampCut));
    const px = -W / 2 + 64 + wd + (1 - inU) * 500 + outU * 600, py = H / 2 - 140 + Math.sin(tw * 30) * (n > 0 && n < 10 ? 8 : 0) + (1 - inU) * 300 + outU * 200;
    defneHand(ctx, px + 66, py + 74, -.15, { pen: true, s: .85 });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 17b: belediye damgası: PERMIT · APPROVED --- */
  shot('p7b17-damga', k => k.stampCut, k => k.list, (ctx, t, u) => {
    const k = times(), tw = twos(t), down = t < k.stamp ? E.inQ(seg(t, k.stamp - .35, k.stamp)) : 1, up = E.outC(seg(t, k.stamp + .12, k.stamp + .5));
    ctx.save(); shake(ctx, t, k.stamp, 5);
    const z = lerp(1.2, 1.28, E.io(u));
    ctx.translate(540, 700); ctx.scale(z, z); ctx.rotate(-.04); ctx.translate(-120, -120);
    deskTop(ctx);
    permitDoc(ctx, 10, t >= k.stamp ? 1 : 0);
    // damga: tahta sap, yukarıdan iner, kalkar
    const sx = 150, sy = 960 / 2 - 270, lift = (1 - down) * 520 + up * 900;
    ctx.save(); ctx.translate(sx, sy - lift); ctx.rotate(-.14); C.seed(3801);
    ctx.save(); ctx.globalAlpha = .25 * (1 - clamp(lift / 600)); ctx.fillStyle = P.ink; ctx.fillRect(-200 + lift * .1, -70 + lift * .2, 400, 150); ctx.restore();
    C.shape(ctx, [[-200, -80], [200, -80], [200, 0], [-200, 0]], '#7a2a1d', { lw: 6 });
    C.shape(ctx, [[-180, -150], [180, -150], [190, -80], [-190, -80]], P.floorWood, { lw: 6 });
    C.shape(ctx, [[-40, -400], [40, -400], [50, -150], [-50, -150]], P.wood, { lw: 6 });
    C.shape(ctx, C.ell(0, -430, 80, 50, 20), P.wood, { lw: 6, shade: c => C.blot(c, C.ell(20, -420, 60, 40, 14), '#3f2711', .5) });
    // memurun eli (gri kol)
    C.shape(ctx, [[-60, -470], [60, -480], [70, -380], [-70, -380]], '#e2b48e', { lw: 6 });
    C.shape(ctx, [[-70, -480], [90, -490], [140, -1200], [-120, -1200]], '#7d8590', { lw: 6, shade: c => C.blot(c, [[30, -490], [120, -490], [160, -1200], [50, -1200]], '#5d646d', .6) });
    ctx.restore();
    ctx.restore();
    if (t >= k.stamp && t < k.stamp + 2 / FPS) { ctx.fillStyle = 'rgba(255,243,196,.10)'; ctx.fillRect(0, 0, 1080, 1920); }
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 18: "Three, four, five." liste avlu masasında; 3-4-5 çizilir; alttaki mavi karalama görünür --- */
  shot('p7b18-liste', k => k.list, k => k.b3, (ctx, t, u) => {
    const k = times(), tw = t;
    ctx.save(); const z = lerp(.9, .95, E.io(u));
    ctx.translate(540, 700); ctx.scale(z, z); ctx.rotate(.03); ctx.translate(-350, -440);
    ctx.save(); ctx.translate(350, 440); deskTop(ctx); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(10,5,2,.3)'; ctx.fillRect(14, 16, 710, 1010); ctx.restore();
    ctx.drawImage(listPaper(), -30, -30);
    const prog = [3, 4, 5].map((i, q) => seg(tw, k.strike[q], k.strike[q] + .16));
    [3, 4, 5].forEach((i, q) => strikeLine(ctx, i, E.outQ(prog[q])));
    // kalem ucu: o anki çizginin ucu
    let q = 0; for (let j = 0; j < 3; j++) if (tw >= k.strike[j] - .12) q = j;
    const i = 3 + q, y = lineY(i) - 4, x1 = 128 + lineLen(i) + 30, pu = E.outQ(prog[q]);
    const inU = E.outC(seg(tw, k.list, k.strike[0] - .05)), outU = E.inQ(seg(tw, k.strike[2] + .3, k.b3));
    const between = q < 2 && prog[q] >= 1 ? E.io(seg(tw, k.strike[q] + .16, k.strike[q + 1])) : 0;
    let px = lerp(26, x1, pu), py = y;
    if (between > 0) { px = lerp(x1, 26, between); py = lerp(y, lineY(i + 1) - 4, between) - Math.sin(between * Math.PI) * 30; }
    px += (1 - inU) * 600 + outU * 700; py += (1 - inU) * 500 + outU * 500;
    kaanHandPen(ctx, px, py, .1);
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 19: üç eski bina, yavaş ve güvenli; her biri TB.zone'a iner (6 kare sarsıntı) --- */
  function siteShot(n, t0f, t1f, camf, opt) {
    shot('p7b19-bina' + n, t0f, t1f, (ctx, t, u) => {
      const k = times(), t0 = t0f(k), land = t0 + FALL.hold + FALL.dur, c = camf(t, u, k);
      ctx.save(); shake(ctx, t, land, 12);
      ctx.translate(540 + (c.sx || 0), c.sy); ctx.scale(c.z, c.z); ctx.translate(-c.x, 0);
      drawSite(ctx, n, t, t0, opt ? opt(t, k) : {});
      airDust(ctx, t, 20, 50 + n, [-1400, -900, 2800, 900], .7);
      ctx.restore();
      vignette(ctx, .18);
      finish(ctx);
    });
  }
  siteShot(3, k => k.b3, k => k.b4, (t, u) => ({ z: lerp(.58, .6, u), x: lerp(-480, -500, u), sy: 1040 }));
  siteShot(4, k => k.b4, k => k.b5, (t, u) => ({ z: lerp(.62, .64, u), x: lerp(60, 40, u), sy: 1060 }));
  siteShot(5, k => k.b5, k => k.rep, (t, u, k) => { const w = E.io(seg(t, k.b5 + .75, k.rep)); return { z: lerp(.6, .42, w), x: lerp(480, 260, w), sy: lerp(1040, 960, w) }; },
    (t, k) => ({ defne: { x: -200, y: 620, expr: 'determined', look: 1 } }));

  /* --- 20: "Then she opened Grandpa's reports on number nine." dosya: No. 9 (dedenin yazısı), "nine"da açılır --- */
  shot('p7b20-dosya', k => k.rep, k => k.hour, (ctx, t, u) => {
    const k = times(), tw = twos(t), slide = E.outC(seg(tw, k.rep, k.rep + .45)), open = E.io(seg(tw, k.open, k.open + .4));
    ctx.save(); ctx.translate(540, 740); const z = lerp(.95, 1.02, E.io(u)); ctx.scale(z, z); ctx.rotate(-.03);
    deskTop(ctx);
    ctx.save(); ctx.translate(0, lerp(900, 0, slide)); ctx.rotate(lerp(.12, 0, slide));
    drawFolder(ctx, open);
    // iki el dosyanın kenarlarında; açarken sağ el kapağı götürür
    const hr = open > 0 ? [lerp(330, -330 - 300 * open, open), 380 - 260 * Math.sin(open * Math.PI)] : [330, 380];
    defneHand(ctx, -300, 440, 1.25, { s: .8 });
    defneHand(ctx, hr[0], hr[1], .75 + open * .7, { s: .8 });
    ctx.restore();
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 21: "She read for an hour." masada okur; saat döner, sayfalar çevrilir, gün akşama döner, lamba yanar --- */
  shot('p7b21-saat', k => k.hour, k => k.pale0, (ctx, t, u) => {
    const k = times(), tw = twos(t), h = E.io(seg(t, k.hour + .1, k.pale0 - .15)), lamp = E.outC(seg(t, k.pale0 - .45, k.pale0 - .3));
    ctx.save(); cam(ctx, lerp(1.5, 1.6, E.io(u)), 360, 1500, 540, 860);
    world(ctx, t, {
      duskMix: h,
      extra: [[SEAT.y, () => drawDefneTalk(ctx, { x: SEAT.x, y: SEAT.y, s: DESK.s, seed: 31, pose: 'sit', expr: 'serious', look: -.2 + .4 * Math.sin(tw * 5), blink: 0, seat: true }, .12 + .03 * Math.sin(tw * 2.3), 6, 0)],
        [DESK.y, () => drawDesk(ctx, DESK.x, DESK.y, DESK.s, { lamp: lamp, roll: false, helmet: true, after: (c, lw) => {
          // sayfa yığını: soldaki büyür (çevrilen), sağdaki azalır
          const turned = Math.floor(h * 14);
          for (let q = 0; q < 14; q++) { const left = q < turned; C.seed(3900 + q); C.shape(c, left ? [[-110 + q * .6, -222 - q * 1.6], [-10, -224 - q * 1.6], [-14, -256 - q * 1.6], [-106 + q * .6, -254 - q * 1.6]] : [[10, -222 - (13 - q) * 1.6], [110, -222 - (13 - q) * 1.6], [104, -254 - (13 - q) * 1.6], [14, -256 - (13 - q) * 1.6]], q === turned ? P.page : '#efe6d0', { lw: lw * .5 }); }
          const fl = (h * 14) % 1; if (h > 0 && h < 1) { c.save(); c.translate(0, -240); c.scale(Math.cos(fl * Math.PI), 1); C.seed(3950); C.shape(c, [[0, 18], [100, 18], [96, -16], [0, -16]], P.paper, { lw: lw * .5 }); c.restore(); }
          coffee(c, 150, -246, .9, lw); if (h > .45) coffee(c, 178, -230, .9, lw); if (h > .8) coffee(c, 126, -226, .9, lw);
          deskClock(c, -150, -260, 24, h * 60, lw);
        } })]],
      kaan: false
    });
    ctx.restore();
    // gölge kayması: masadan sağa uzayan uzun gölge (güneş alçalır)
    vignette(ctx, .25 + .15 * h);
    finish(ctx);
  });

  /* --- 22–23: "Then she went pale." yakın yüz, akşam; "Ant." başını kaldırır --- */
  shot('p7b22-soldu', k => k.pale0, k => k.chart, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredWorld('bg-soldu', 2.1, 700, 1180, 8, { mode: 'dusk', desk: null, noGrass: true });
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + u * .03, 1 + u * .03); ctx.drawImage(bg, -540, -960); ctx.restore();
    const paleU = seg(tw, k.pale - .05, k.pale + .1), lift = E.outBack(seg(tw, k.ant, k.ant + .3));
    const expr = paleU > 0 ? 'pale' : 'serious';
    const z = lerp(1, 1.06, E.io(seg(t, k.pale0, k.ant)));
    ctx.save(); cam(ctx, z, 540, 900);
    // lamba ışığı (sol alttan sıcak)
    drawDefneTalk(ctx, { x: 470, y: 2240, s: 3.1, seed: 31, expr, look: lift > .5 ? 0 : -.3, blink: blinkAt(tw, [k.pale0 + .35, k.pale + .45]), pose: 'stand' }, lerp(.1, 0, lift) + (paleU > 0 && lift === 0 ? .005 * Math.sin(tw * 20) : 0), lerp(14, 0, lift), 0);
    // elindeki rapor sayfasının üst kenarı (alt kadraj)
    ctx.save(); ctx.translate(560, 1760 - 30 * lift); ctx.rotate(-.04); C.seed(3990); C.shape(ctx, [[-380, -60], [380, -70], [390, 400], [-390, 400]], '#ece3cc', { lw: 6, shade: c => { C.blot(c, [[120, -80], [400, -80], [400, 420], [160, 420]], P.pageDk, .5); for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(58,48,38,.25)'; c.fillRect(-300, -20 + i * 36, 480 - (i % 2) * 160, 6); } } }); ctx.restore();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(160, 1500, 40, 160, 1500, 900); g.addColorStop(0, 'rgba(255,210,122,.22)'); g.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 24: "Number nine is already falling." rapor: yıllara göre büyüyen çatlak; Defne'nin parmağı eğriyi izler --- */
  shot('p7b24-cizelge', k => k.chart, k => k.slow, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.fillStyle = '#3a2f2c'; ctx.fillRect(0, 0, 1080, 1920);
    const bg = blurredWorld('bg-cizelge', 1.5, 760, 1150, 10, { mode: 'dusk', noGrass: true });
    ctx.drawImage(bg, 0, 0);
    ctx.fillStyle = 'rgba(21,18,13,.25)'; ctx.fillRect(0, 0, 1080, 1920);
    // Defne (sol üst, profilden değil: önden, başı eğik), sayfa önde
    drawDefneTalk(ctx, { x: 250, y: 1300, s: 1.9, seed: 31, expr: tw < k.chart + .6 ? 'pale' : talkExpr(tw, 13) === 'calm' ? 'pale' : 'worried', look: .8, blink: blinkAt(tw, [k.chart + 1.1]) }, .08 + .02 * Math.sin(tw * 5), 6, 0);
    const z = lerp(1.0, 1.05, E.io(u));
    ctx.save(); ctx.translate(610, 860); ctx.scale(z, z); ctx.rotate(.05); ctx.scale(.86, .86); ctx.translate(-350, -470);
    reportPage(ctx, .15 + .35 * seg(t, k.chart, k.slow));
    // parmak: eğriyi soldan sağa izler
    const gx = 120, gy = 520, gw = 520, gh = 330, pu = E.io(seg(tw, k.chart + .25, k.slow - .25)), v = .03 + .97 * (Math.exp(pu * 2.6) - 1) / (Math.exp(2.6) - 1);
    defneHand(ctx, gx + pu * gw + 10, gy - v * gh * .92 + 30, 1.05, { s: .7 });
    ctx.restore();
    // lamba ışığı
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(200, 600, 40, 200, 600, 900); g.addColorStop(0, 'rgba(255,210,122,.16)'); g.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 25 + bitiş: akşam avlusu; masa, Defne, Kaan, Daisy; ışık üst üçte birde; TEK bip --- */
  shot('p7b25-son', k => k.slow, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = frozen(t), tw = twos(tf), ft = flow(t);
    const e = E.io(seg(tf, k.slow, k.endF0 - .05)), after = seg(t, k.endF1, k.dur);
    const z = lerp(1.18, 1.36, e) + .03 * E.io(after);
    const sx = lerp(540, 600, e), sy = lerp(700, 470, e) - 10 * E.io(after);
    ctx.save(); cam(ctx, z, lerp(BEACON[0] - 60, BEACON[0], e), BEACON[1], sx, sy);
    const talking = tw >= k.slow + .25 && tw < k.end;
    world(ctx, ft, {
      mode: 'dusk',
      daisy: { beep: beepV(t, k.endBeep), hook: Math.sin(ft * 1.1) * .025 },
      extra: [[SEAT.y, () => drawDefneTalk(ctx, { x: SEAT.x, y: SEAT.y, s: DESK.s, seed: 31, pose: 'sit', expr: talking ? (Math.floor(tw * 5) % 3 ? 'pale' : 'worried') : 'pale', look: .9, blink: blinkAt(tw, [k.end + .4]), seat: true }, talking ? .03 * Math.sin(tw * 7) : 0, 0, 0)],
        [DESK.y, () => drawDesk(ctx, DESK.x, DESK.y, DESK.s, { lamp: 1, roll: false, after: (c, lw) => { c.save(); c.translate(-20, -246); c.scale(.16, .06); c.rotate(0); C.seed(3999); C.shape(c, [[-350, -470], [350, -470], [350, 470], [-350, 470]], '#ece3cc', { lw: 20 }); c.restore(); coffee(c, 150, -246, .9, lw); coffee(c, 178, -230, .9, lw); } })]],
      kaan: { x: 535, y: 1790, s: KAAN.s, expr: 'worried', look: .9, blink: blinkAt(tw, [k.slow + .9]), phone: false },
      noGrass: false
    });
    airDust(ctx, tf, 16, 61, [0, 900, 1080, 600], .6);
    ctx.restore();
    if (beepV(t, k.endBeep) > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,90,60,.05)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); }
    vignette(ctx, .3);
    const dk = .55 * E.io(seg(t, k.endCard - .1, k.endCard + .2)); if (dk > 0) { const g = ctx.createLinearGradient(0, 600, 0, 900); g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(1, `rgba(7,11,24,${dk})`); ctx.fillStyle = g; ctx.fillRect(0, 600, 1080, 1320); }
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const f3 = x => +x.toFixed(3);
  TB.cuesB = {
    get telefonDokunus() { return f3(times().tap); },              // başparmak ekrana dokunur (ilk hamle)
    get siperlik() { return f3(times().lid); },                     // Daisy'nin siperliği kalkar (küçük metal tık, bip DEĞİL)
    get masaSurtunme() { return f3(times().desk + .15); },          // masa ayakları çakılda sürtünür (≈1,9 sn)
    get imzaKalem() { return f3(times().signW); },                  // kalem kâğıtta (0,85 sn)
    get damga() { return f3(times().stamp); },                      // lastik damga "tok"
    get kalemCizgi3() { return f3(times().strike[0]); },            // keçeli kalem, satır 3
    get kalemCizgi4() { return f3(times().strike[1]); },
    get kalemCizgi5() { return f3(times().strike[2]); },
    get bina3Darbe() { return f3(times().b3 + FALL.hold + FALL.dur); },   // her biri yumuşak gürleme + 6 kare sarsıntı
    get bina4Darbe() { return f3(times().b4 + FALL.hold + FALL.dur); },
    get bina5Darbe() { return f3(times().b5 + FALL.hold + FALL.dur); },
    get dosyaKayar() { return f3(times().rep); },                   // dosya masada kayar (karton)
    get dosyaAcilir() { return f3(times().open); },                 // kapak açılır (kâğıt)
    get saatTikTak() { return f3(times().hour + .1); },             // masa saati, hızlı tik-tak (1,2 sn)
    get lambaYanar() { return f3(times().pale0 - .45); },           // masa lambası düğmesi
    get sonBip() { return f3(times().endBeep); }                    // tek bip; ışık +0,04–0,24
  };
})();
