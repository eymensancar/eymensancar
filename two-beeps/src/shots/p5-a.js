/* Part 5 · H AND K — Animatör A: 0 – (S12.t1+S13.t0)/2 ≈ 23,21 sn (cümle 1–12).
   YERLEŞİM (B de aynısını kullansın):
   - DAMGA (gündüz moloz, P1 b24 ile aynı açı): taş C.drawStamp {x:560, y:760, s:1, rot:-.05}; tebeşir "HALE" taşın altında H'nin hizasında
     (taban y 955), "KAYA" K'nin hizasında (taban y 1060). Kaan'ın tebeşirli eli sağ alttan gelir.
   - DEDENİN MASASI ÜSTTEN (gece, lamba sağ üstte): p4-a deskTop'un ahşabı (dünya = ekran ölçeği). DEFTER C.drawNotebook {x:540, y:900, s:1}
     (yerel 760×500; sol sayfa yerel x -364…-4, sağ 4…364). LİSTE (pilot listesi, 700×1000 yerel, ölçek .524) defterin SOLUNDA:
     sol üst köşe dünya (-222, 651), sağ kenar x≈145; 1.–9. satırlar defterin sol sayfasındaki 1.–9. satırlarla aynı yükseklikte
     (dünya y = 730 + (i-1)·44). Alt kanat (10. mavi satır) arkaya katlı, görünmez. Rulo çizimler masanın üstünde (y≈300).
   - SON KARE (≈23,21 sn): defter SON SAYFADA açık; sol sayfada dedenin notu 4 satır tam ("They will not last." / "I should have said no." /
     "Take them down" / "before they fall."), sağ sayfa boş. Kamera z 1.6→1.66, dünya (356,860) ekranda (540,560); not ekranda y≈330–700.
     Kaan'ın sol eli sol sayfanın sol alt köşesinde (handOnRoll dünya (168,1162), rot .42, flip). Liste solda kadraj kenarında, kısmen görünür.
   Zamanlar timeline'dan (times()); eller ikişerli, kamera/ışık birerli. Rastgelelik yalnız tohumlu. */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;
  const ones = t => Math.floor(t * FPS + 1e-6) / FPS;

  /* ================= ZAMANLAR ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1];
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[Math.min(n || 0, ws.length - 1)]; };
    const mid = i => (S(i).t1 + S(i + 1).t0) / 2;
    const k = {};
    // damga + tebeşir
    k.hale0 = W(1, /^Hale/i, 3).t0 - .33;  k.hale1 = S(1).t1;             // "HALE" yazılır
    k.tilt0 = S(1).t1 + .46; k.tilt1 = k.tilt0 + .34;                      // kanca yazısı gidince kamera iner
    k.overK = S(2).t0 - .14;                                               // el K'nin üstünden geçer
    k.kaya0 = W(2, /^Kaya/i, 3).t0 - .28; k.kaya1 = S(2).t1 - .02;         // "KAYA" yazılır
    k.cA = mid(2);                                                         // borç mektubu (hatıra)
    k.push = W(3, /^Kaya/i, 0).t0 - .12;                                   // KAYA DEMOLITION satırına itme
    k.cB = mid(3);                                                         // Kaan masada
    k.cB2 = W(4, /^Grandpa/i, 4).t0 - .3;                                  // üstten: defter kapalı
    k.brush = k.cB2 + .08;                                                 // el kapaktaki tozu siler
    k.open0 = W(4, /^notebook/i, 5).t0 - .16; k.open1 = k.open0 + .5;      // kapak açılır
    k.cC = mid(4);                                                         // fotoğraf
    k.cD = mid(5);                                                         // sayfa → hızlı
    k.flipD = k.cD;
    k.b1 = S(6).t0; k.b2 = k.b1 + .26; k.b3 = k.b2 + .26;                  // üç bina çizilir
    k.cE = mid(6);                                                         // ucuz
    k.cF = mid(7);                                                         // sayfa → dokuz
    k.n0 = S(8).t0;                                                        // 9 bina art arda
    k.cG = mid(8);                                                         // liste yanına
    k.trace0 = S(9).t0 + .1; k.trace1 = S(9).t1 - .05;
    k.cH = mid(9);                                                         // son sayfaya kadar çevir
    k.cI = W(10, /^"?They/i, 6).t0 - .45;                                  // nota yakın
    k.l1 = [W(10, /^"?They/i, 6).t0 - .05, S(10).t1];                      // satır satır yazı
    k.l2 = [S(11).t0 - .05, S(11).t1];
    k.l3 = [S(12).t0 - .05, W(12, /^before/i, 3).t0 - .02];
    k.l4 = [W(12, /^before/i, 3).t0, S(12).t1];
    k.cJ = mid(11);
    k.end = mid(12);
    K = k; return k;
  }
  function shot(id, t0, t1, draw) { TB.shot({ id, get t0() { return t0(times()); }, get t1() { return t1(times()); }, draw }); }

  /* ================= YARDIMCILAR ================= */
  function cam(ctx, z, cx, cy, sx, sy) { ctx.translate(sx == null ? 540 : sx, sy == null ? 960 : sy); ctx.scale(z, z); ctx.translate(-cx, -cy); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const cache = {};
  function cached(key, w, h, fn) { if (!cache[key]) { const cv = canvas(w, h); fn(cv.getContext('2d')); cache[key] = cv; } return cache[key]; }
  function finish(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; C.grain(ctx, 0, 0, 1080, 1920, .2); }
  function vignette(ctx, a, col) { const g = ctx.createRadialGradient(540, 860, 320, 540, 900, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col || `rgba(7,11,24,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); }
  function lampWarm(ctx, a) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'soft-light'; const g = ctx.createRadialGradient(820, 380, 60, 640, 760, 1200);
    g.addColorStop(0, `rgba(255,214,140,${a})`); g.addColorStop(1, 'rgba(40,24,10,.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
  }
  function glow(ctx, x, y, r, a, rgb) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, r); g.addColorStop(0, `rgba(${rgb || '255,214,150'},${a})`); g.addColorStop(1, `rgba(${rgb || '255,214,150'},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function motes(ctx, t, box, n, sd, a, size) {
    const [x0, y0, w, h] = box, tt = ones(t);
    for (let i = 0; i < n; i++) {
      const r1 = rnd(sd + i * 7), r2 = rnd(sd + i * 7 + 1), r3 = rnd(sd + i * 7 + 2), sp = .3 + r3 * .7;
      const x = x0 + ((r1 * w + Math.sin(tt * .6 * sp + i) * 18 * sp + tt * 6 * sp) % w + w) % w;
      const y = y0 + ((r2 * h - tt * 10 * sp + Math.sin(tt * .9 + i * 2) * 8) % h + h) % h;
      const tw = .55 + .45 * Math.sin(tt * 2 * sp + i);
      ctx.fillStyle = `rgba(232,220,196,${a * tw})`; ctx.beginPath(); ctx.arc(x, y, (size || 1.6) * (.6 + r3), 0, TAU); ctx.fill();
    }
  }
  // Kamera anahtarları arası yumuşak geçiş: keys [[t, ...değerler]]
  function keyed(t, keys, dur) {
    let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
    const a = keys[i], prev = keys[i - 1]; if (!prev) return a.slice(1);
    const w = E.ioC(seg(t, a[0], a[0] + (dur || .3)));
    return a.slice(1).map((v, j) => lerp(prev[j + 1], v, w));
  }
  // Çizginin bir kısmını çiz (kendiliğinden çizilen kalem çizgisi)
  function partial(ctx, pts, u, lw, col, sd, amp) {
    if (u <= 0) return; C.seed(sd || 1); const w = C.wobble(pts, false, amp == null ? .8 : amp, 6);
    const L = [0]; for (let i = 1; i < w.length; i++) L.push(L[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
    const lim = L[L.length - 1] * clamp(u); ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col || P.inkOld; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(w[0][0], w[0][1]);
    for (let i = 1; i < w.length; i++) { if (L[i] <= lim) ctx.lineTo(w[i][0], w[i][1]); else { const f = (lim - L[i - 1]) / (L[i] - L[i - 1] || 1); ctx.lineTo(lerp(w[i - 1][0], w[i][0], f), lerp(w[i - 1][1], w[i][1], f)); break; } }
    ctx.stroke(); ctx.restore();
  }
  const SEPIA = 'sepia(1) saturate(.55) brightness(.92) contrast(.92)';   // pilot/P4 hatıra karesi
  let memCv = null;
  function memory(ctx, draw) {
    if (!memCv) memCv = canvas(1080, 1920);
    const m = memCv.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, 1080, 1920); m.save(); draw(m); m.restore();
    ctx.fillStyle = '#2a2118'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.filter = SEPIA; ctx.drawImage(memCv, 0, 0); ctx.filter = 'none';
  }

  /* ---------- pilot el yazısı (dedenin listesi; a-sahneler.js'den kopya) ---------- */
  function smooth(pts, n) {
    n = n || 5; if (pts.length < 3) return pts; const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => .5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]); return out;
  }
  function stroke(ctx, pts, lw, col, alpha) {
    ctx.save(); if (alpha != null) ctx.globalAlpha *= alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.stroke(C.pathOf(C.wobble(pts, false, lw * .18, 6), false)); ctx.restore();
  }
  const DIG = {
    '0': C.ell(.5, .8, .42, .78, 14),
    '1': [[.22, .3], [.6, 0], [.55, .8], [.52, 1.6]],
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
      const sl = .12;
      const pts = (ch === '0' ? d.concat([d[0]]) : smooth(d, 5)).map(([u, v]) => [cx + (u + (1.6 - v) * sl) * sc, y + v * sc]);
      stroke(ctx, pts, lw, col, alpha);
      cx += sc * (ch === '1' ? .78 : 1.08);
    }
    return cx - x;
  }
  function scrawl(ctx, x, y, len, lw, col, sd, alpha) {
    const r = TB.rand; let cx = x, w = 0;
    while (cx < x + len) {
      const nL = 2 + Math.floor(r(sd + w * 7) * 6), pts = [];
      let th = 0; const base = y + (r(sd + w * 11) - .5) * 4;
      for (let L = 0; L < nL; L++) {
        const hh = 10 + r(sd + w * 31 + L * 5) * 10 + (r(sd + w * 17 + L * 3) < .22 ? 16 : 0);
        for (let k = 0; k < 8; k++) { const a = th + k / 8 * TAU; pts.push([cx + a * 2.6 - Math.sin(a) * 7, base - hh * (1 - Math.cos(a)) / 2]); }
        th += TAU;
      }
      pts.push([cx + th * 2.6 + 4, base]);
      C.seed(sd + w * 3); stroke(ctx, pts, lw, col, alpha);
      cx += th * 2.6 + 18 + r(sd + w * 5) * 14; w++;
      if (w > 12) break;
    }
  }
  const INK_OLD = '#3a3026';
  const lineY = i => 150 + (i - 1) * 84;
  const lineLen = i => 300 + TB.rand(i * 97 + 3) * 210;
  function listLine(ctx, i) {     // pilot listesinin i. satırı (aynı tohum = aynı el yazısı)
    const y = lineY(i);
    hand_num(ctx, i + '.', 34, y - 30, 44, 4.2, INK_OLD, 900 + i * 31, .85);
    scrawl(ctx, 122, y + 10, lineLen(i), 3.2, INK_OLD, 1200 + i * 57, .8);
  }

  /* ================= 0–2,8 sn: H K DAMGASI (moloz, gündüz; P1 b24 ile aynı taş ve açı) ================= */
  const ST = { x: 560, y: 760, rot: -.05 };
  const R1Y = 955, R2Y = 1060;           // tebeşir satırlarının tabanı (dünya)
  function rubble() {
    return cached('p5a-moloz', 1400, 2200, c => {
      c.translate(160, 140);
      const g = c.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, P.groundLt); g.addColorStop(1, P.groundDk); c.fillStyle = g; c.fillRect(-200, -200, 1500, 2400);
      for (let i = 0; i < 40; i++) C.blot(c, C.ell(rnd(i) * 1080, rnd(i + 50) * 1920, 60 + rnd(i + 90) * 100, 18 + rnd(i + 130) * 20, 12), i % 2 ? P.groundDk : P.dustLt, .3);
      for (let i = 0; i < 34; i++) {
        const x = -60 + rnd(1000 + i) * 1200, y = -60 + rnd(2000 + i) * 2050;
        if (Math.abs(x - ST.x) < 330 * .85 && Math.abs(y - ST.y) < 190 * 1.1) continue;
        if (x > 300 && x < 960 && y > 850 && y < 1130) continue;           // tebeşir alanı boş
        const w = 90 + rnd(3000 + i) * 60, h = 44 + rnd(4000 + i) * 16, r = (rnd(5000 + i) - .5) * 1.6;
        c.save(); c.translate(x, y); c.rotate(r); C.seed(600 + i);
        C.shape(c, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], [P.brick, P.brickDk, P.brickLt][i % 3], { lw: 4.4, shade: cc => { C.blot(cc, [[-w / 2, h * .1], [w / 2, h * .1], [w / 2, h], [-w / 2, h]], P.brickDk, .55); cc.fillStyle = 'rgba(216,202,176,.45)'; cc.fillRect(-w / 2, -h / 2, w * rnd(i), h * .3); } });
        c.restore();
      }
      // tebeşir alanında düz, gölgeli beton parçası (yazı okunsun)
      C.seed(31); C.shape(c, [[340, 862], [520, 848], [610, 868], [760, 846], [940, 858], [958, 990], [932, 1128], [760, 1116], [600, 1140], [430, 1122], [318, 1132], [302, 1000]], '#8f846f', { lw: 4.4, shade: cc => { C.blot(cc, [[620, 830], [960, 830], [960, 1150], [700, 1150]], '#7a705d', .5); C.line(cc, [[610, 868], [640, 930], [612, 990]], 2.4, 'rgba(21,18,13,.55)', .6); C.line(cc, [[930, 1060], [880, 1090], [860, 1128]], 2.4, 'rgba(21,18,13,.55)', .6); for (let i = 0; i < 18; i++) C.blot(cc, C.ell(330 + rnd(70 + i) * 600, 850 + rnd(90 + i) * 280, 14 + rnd(i) * 30, 5 + rnd(i + 3) * 8, 10), '#a39883', .35); } });
      for (let i = 0; i < 24; i++) { const x = rnd(7000 + i) * 1080, y = rnd(7100 + i) * 1920; if (x > 300 && x < 960 && y > 830 && y < 1150) continue; C.blot(c, C.ell(x, y, 10 + rnd(7200 + i) * 22, 4 + rnd(7300 + i) * 6, 10), P.dustLt, .3); }
    });
  }
  let LET = null;
  function letters() {        // drawStamp içinde "H  K" harflerinin yerel x'leri
    if (LET) return LET;
    const g = canvas(4, 4).getContext('2d'); g.font = '700 112px Rubik';
    const w = g.measureText('H  K').width, wH = g.measureText('H').width, wK = g.measureText('K').width;
    LET = { H: -w / 2 + wH / 2, K: w / 2 - wK / 2 }; return LET;
  }
  const stampPt = (lx, ly) => [ST.x + lx * Math.cos(ST.rot) - ly * Math.sin(ST.rot), ST.y + lx * Math.sin(ST.rot) + ly * Math.cos(ST.rot)];
  // tebeşir kelimesi: önbellekli tuval (gölge + beyaz + toz dokusu)
  function chalkWord(txt, sd) {
    return cached('tebesir-' + txt, 420, 140, g => {
      const x0 = 24, y0 = 104, size = 82;
      g.save(); g.translate(4, 5); C.handwrite(g, txt, x0, y0, size, 'rgba(21,18,13,.55)', sd, { bold: true, track: .98 }); g.restore();
      const w = C.handwrite(g, txt, x0, y0, size, '#f7f2e4', sd, { bold: true, track: .98 });
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 520; i++) { g.fillStyle = `rgba(0,0,0,${.25 + rnd(sd * 900 + i) * .6})`; g.fillRect(rnd(sd * 1000 + i) * 420, rnd(sd * 1100 + i) * 140, 1 + rnd(sd * 1200 + i) * 3, 1 + rnd(sd * 1300 + i) * 1.5); }
      g.globalCompositeOperation = 'source-over';
      g.wpx = w; g.canvas.wpx = w;
    });
  }
  // tebeşirli el: tebeşir ucu (0,0), kol sağ alta
  function chalkHand(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(511);
    ctx.save(); ctx.globalAlpha = .2; ctx.fillStyle = P.ink; ctx.translate(26, 34); ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(120, 40); ctx.lineTo(700, 520); ctx.lineTo(560, 700); ctx.lineTo(60, 140); ctx.fill(); ctx.restore();
    C.shape(ctx, [[150, 90], [230, 150], [720, 470], [600, 720], [120, 200]], P.jacket, { lw: 6, shade: c => C.blot(c, [[160, 190], [700, 560], [640, 760], [100, 230]], P.jacketDk, .5) });
    C.shape(ctx, [[118, 100], [168, 76], [196, 170], [140, 196]], P.hazard, { lw: 5 });
    C.shape(ctx, [[-6, -4], [10, -14], [64, 40], [48, 54]], '#f4f0e4', { lw: 4, shade: c => C.blot(c, [[30, 20], [70, 40], [50, 60], [20, 40]], '#cfc8b4', .7) });   // tebeşir
    C.shape(ctx, [[40, 30], [96, 14], [150, 70], [158, 140], [116, 176], [60, 150], [30, 90]], P.skin, { lw: 6, shade: c => C.blot(c, [[90, 110], [170, 100], [170, 190], [90, 190]], P.skinDk, .55) });
    C.line(ctx, [[62, 70], [100, 92]], 3.6, P.skinDk); C.line(ctx, [[60, 100], [96, 122]], 3.6, P.skinDk); C.line(ctx, [[66, 128], [100, 146]], 3.6, P.skinDk);
    C.shape(ctx, [[30, 46], [62, 28], [86, 36], [70, 60], [40, 70]], P.skin, { lw: 5 });   // başparmak
    ctx.restore();
  }
  function chalkPlan(t) {            // el yolu (dünya), yazma ilerlemesi
    const k = times(), Lt = letters(), [hx, hy] = stampPt(Lt.H, 0), [kx, ky] = stampPt(Lt.K, 0);
    const w1 = chalkWord('HALE', 3).wpx || 180, w2 = chalkWord('KAYA', 5).wpx || 180;
    const r1x = hx - 50, r2x = kx - 50;
    const u1 = seg(t, k.hale0, k.hale1), u2 = seg(t, k.kaya0, k.kaya1);
    const rest = [kx + 260, 1230], rest2 = [kx + 420, 1360];
    const wr = (rx, ry, u, w) => [rx + 24 + u * w + 12, ry - 30 + Math.sin(u * 46) * 16];
    const keys = [
      [0, hx - 120, hy + 12], [.34, hx + 30, hy + 72], [k.hale0, ...wr(r1x, R1Y, 0, w1)], [k.hale1, ...wr(r1x, R1Y, 1, w1)],
      [k.hale1 + .34, ...rest], [k.overK - .16, ...rest], [k.overK + .1, kx - 110, ky + 14], [k.overK + .32, kx + 30, ky + 72],
      [k.kaya0, ...wr(r2x, R2Y, 0, w2)], [k.kaya1, ...wr(r2x, R2Y, 1, w2)], [k.kaya1 + .38, ...rest2]
    ];
    let p;
    if (t >= k.hale0 && t <= k.hale1) p = wr(r1x, R1Y, u1, w1);
    else if (t >= k.kaya0 && t <= k.kaya1) p = wr(r2x, R2Y, u2, w2);
    else {
      let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
      const a = keys[i], b = keys[i + 1] || a, f = b === a ? 0 : E.io(seg(t, a[0], b[0]));
      p = [lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
    }
    return { p, u1, u2, r1x, r2x, w1, w2 };
  }
  function drawChalk(ctx, img, x, base, u) {
    if (u <= 0) return; const w = img.wpx || 200;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 10, base - 140, 34 + u * w, 200); ctx.clip();
    ctx.drawImage(img, x, base - 104); ctx.restore();
  }
  // "Previously" köşe görüntüsü: P4 son karesi — takvim kaymış, arkasında tavana uzanan çatlak
  function prevInset(ctx, t) {
    const a = 1 - seg(t, 2.2, 2.42); if (a <= 0) return;
    const x = 704, y = 232, w = 176, h = 140;
    const img = cached('p5a-onceki', w * 2, h * 2, g => {
      g.scale(2, 2); g.fillStyle = P.wallOffice; g.fillRect(0, 0, w, h);
      g.save(); g.scale(.5, .5); g.translate(-712, -110); C.drawOffice(g, { x: 0, y: 0, w: 1080, h: 900, lamp: true, calendarMoved: .7, seed: 21 }); g.restore();
      const gr = g.createRadialGradient(w * .5, h * .45, 10, w * .5, h * .5, w * .8); gr.addColorStop(0, 'rgba(255,214,150,.15)'); gr.addColorStop(1, 'rgba(7,11,24,.6)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(.035); ctx.translate(-w / 2, -h / 2);
    C.seed(561); C.shape(ctx, [[-8, -8], [w + 8, -8], [w + 8, h + 8], [-8, h + 8]], P.paper, { lw: 4 });
    ctx.drawImage(img, 0, 0, w, h);
    ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  }

  /* a01 · S1–S2 "H is for Hale. K is for Kaya." — damga; parmak/tebeşir H'nin üstünden geçer, altına HALE; sonra K, altına KAYA. */
  shot('a01-damga', k => 0, k => k.cA, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const sy = lerp(1030, 700, E.ioC(seg(t, k.tilt0, k.tilt1))), z = lerp(1.3, 1.37, E.io(u));
    ctx.save(); cam(ctx, z, ST.x, ST.y, 540, sy);
    ctx.drawImage(rubble(), -160, -140);
    C.drawStamp(ctx, { x: ST.x, y: ST.y, s: 1, rot: ST.rot, dust: 0 });
    const cp = chalkPlan(tw);
    drawChalk(ctx, chalkWord('HALE', 3), cp.r1x, R1Y, t >= k.hale1 ? 1 : seg(tw, k.hale0, k.hale1));
    drawChalk(ctx, chalkWord('KAYA', 5), cp.r2x, R2Y, t >= k.kaya1 ? 1 : seg(tw, k.kaya0, k.kaya1));
    // tebeşir tozu (yazarken ucun altında)
    const writing = (tw > k.hale0 && tw < k.hale1 + .1) || (tw > k.kaya0 && tw < k.kaya1 + .1);
    if (writing) for (let i = 0; i < 7; i++) { const r = j => rnd(Math.floor(tw * 15) * 31 + i * 7 + j); ctx.fillStyle = `rgba(247,242,228,${.5 + r(1) * .4})`; ctx.beginPath(); ctx.arc(cp.p[0] - 6 + r(2) * 18, cp.p[1] + 8 + r(3) * 30, 1.5 + r(4) * 2.5, 0, TAU); ctx.fill(); }
    // parmak H/K üstünden geçerken taşta ince toz izi silinir (açık iz)
    chalkHand(ctx, cp.p[0], cp.p[1], .78);
    ctx.restore();
    vignette(ctx, .22, 'rgba(21,18,13,.22)');
    prevInset(ctx, t);
    finish(ctx);
  });

  /* ================= 2,8–4,6: P1 borç mektubu (sepya hatıra) — "KAYA DEMOLITION" ================= */
  const RED = '#c4302a';
  function letter(ctx) {     // a-sahneler.js a03'ün mektubu (kopya)
    C.seed(620);
    C.shape(ctx, [[0, 0], [620, 0], [620, 820], [0, 820]], '#f4efe2', { lw: 4, amp: .7, shade: c => C.blot(c, [[440, -10], [640, -10], [640, 830], [520, 830]], '#ddd4bf', .5) });
    C.seed(621); C.shape(ctx, [[40, 44], [104, 44], [104, 108], [40, 108]], P.steelDk, { lw: 3 });
    ctx.fillStyle = '#f4efe2'; ctx.font = '700 40px Rubik'; ctx.textAlign = 'center'; ctx.fillText('B', 72, 91);
    ctx.textAlign = 'left'; ctx.fillStyle = P.ink; ctx.font = '700 30px Rubik'; ctx.fillText('CITY LOAN OFFICE', 124, 76);
    ctx.font = '500 20px Rubik'; ctx.fillStyle = '#5a5246'; ctx.fillText('Accounts Department', 124, 104);
    C.seed(622); C.line(ctx, [[40, 136], [580, 138]], 3, P.ink, .4);
    ctx.font = '500 22px Rubik'; ctx.fillStyle = '#4a4338';
    ctx.fillText('Account holder:  KAYA DEMOLITION', 40, 190);
    ctx.fillText('Loan no.  0047-1186', 40, 226);
    ctx.font = '700 26px Rubik'; ctx.fillStyle = P.ink; ctx.fillText('AMOUNT DUE', 40, 300);
    ctx.font = '700 64px Rubik'; ctx.fillText('$48,600.00', 40, 372);
    for (let k = 0; k < 9; k++) { C.seed(630 + k); C.shape(ctx, [[40, 430 + k * 34], [40 + 380 + TB.rand(k + 9) * 150, 430 + k * 34], [40 + 380 + TB.rand(k + 9) * 150, 442 + k * 34], [40, 442 + k * 34]], '#c9c0ad', { lw: 0, amp: .4 }); }
    C.seed(640); C.line(ctx, [[360, 770], [580, 768]], 2.4, P.ink, .4);
    ctx.save(); ctx.translate(330, 600); ctx.rotate(-.2); C.seed(650);
    const p = C.pathOf(C.wobble([[-230, -64], [230, -64], [230, 64], [-230, 64]], true, 2, 14), true);
    ctx.strokeStyle = RED; ctx.lineWidth = 10; ctx.stroke(p); ctx.lineWidth = 3.5; ctx.save(); ctx.scale(.93, .82); ctx.stroke(p); ctx.restore();
    ctx.fillStyle = RED; ctx.font = '400 84px "Lilita One"'; ctx.textAlign = 'center'; ctx.fillText('FINAL NOTICE', 0, 30);
    ctx.fillStyle = '#f4efe2'; for (let k = 0; k < 120; k++) { ctx.globalAlpha = .4 + TB.rand(k) * .6; ctx.beginPath(); ctx.arc((TB.rand(k * 3 + 1) - .5) * 470, (TB.rand(k * 5 + 2) - .5) * 130, .8 + TB.rand(k * 7) * 2.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function woodTable(ctx) {
    const cv = cached('p5a-masa-yan', 1080, 1920, c => {
      c.fillStyle = P.wood; c.fillRect(0, 0, 1080, 1920); C.seed(301);
      for (let yy = -60; yy < 1920; yy += 210) { C.line(c, [[0, yy], [1080, yy + 6]], 4, '#3f2711', 1.5); for (let g = 0; g < 7; g++) { const gy = yy + 20 + g * 27; c.strokeStyle = g % 2 ? 'rgba(63,39,17,.5)' : 'rgba(122,81,48,.5)'; c.lineWidth = 2; c.beginPath(); for (let gx = 0; gx <= 1080; gx += 60) c.lineTo(gx, gy + Math.sin(gx * .006 + g + yy) * 6); c.stroke(); } }
    });
    ctx.drawImage(cv, -400, -300, 1880, 2700);
  }
  const LTR = { x: 230, y: 470 };
  shot('a02-mektup', k => k.cA, k => k.cB, (ctx, t, u) => {
    const k = times();
    const w = E.ioC(seg(t, k.push, k.push + .42));
    const z = lerp(1.08, 2.15, w) * (1 + .03 * seg(t, k.push + .42, k.cB));
    const cx = lerp(LTR.x + 310, LTR.x + 230, w), cy = lerp(LTR.y + 400, LTR.y + 183, w) - 4 * seg(t, k.push + .42, k.cB);
    memory(ctx, m => {
      m.save(); cam(m, z, cx, cy, 540, 880);
      woodTable(m);
      m.save(); m.globalAlpha = .3; m.fillStyle = P.ink; m.fillRect(LTR.x + 14, LTR.y + 18, 620, 820); m.restore();
      m.translate(LTR.x, LTR.y); letter(m);
      m.restore();
    });
    vignette(ctx, 0, 'rgba(30,20,10,.85)');
    finish(ctx);
  });

  /* ================= OFİS (gece, lamba yanık; P4 sonu: takvim kaymış, çatlak açıkta) ================= */
  function officeBlur() {
    return cached('p5a-ofis-bulanik', 1080, 1920, c => {
      c.filter = 'blur(3px)'; c.save(); cam(c, 1.45, 520, 430);
      c.fillStyle = P.wallOffice; c.fillRect(-800, -700, 2600, 1330);
      c.fillStyle = '#2a302e'; c.fillRect(-800, -700, 2600, 640);
      c.fillStyle = P.floorWood; c.fillRect(-800, 630, 2600, 1100);
      C.drawOffice(c, { x: 0, y: 0, w: 1080, h: 900, lamp: true, calendarMoved: .7, seed: 21 });
      c.restore(); c.filter = 'none';
      c.fillStyle = 'rgba(12,14,24,.38)'; c.fillRect(0, 0, 1080, 1920);
      const g = c.createLinearGradient(560, 0, 1080, 0); g.addColorStop(0, 'rgba(12,14,24,0)'); g.addColorStop(1, 'rgba(12,14,24,.55)'); c.fillStyle = g; c.fillRect(0, 0, 1080, 1920);
    });
  }
  function deskFront(ctx, y0) {
    C.seed(501);
    C.shape(ctx, [[-40, y0 + 6], [1120, y0 - 6], [1120, 2000], [-40, 2000]], P.wood, { lw: 6, shade: c => { C.blot(c, [[-40, y0 + 30], [1120, y0 + 20], [1120, y0 + 60], [-40, y0 + 70]], '#3f2711', .5); for (let i = 0; i < 6; i++) C.line(c, [[-40, y0 + 120 + i * 90], [1120, y0 + 110 + i * 92]], 2, 'rgba(21,18,13,.25)', 1.5); } });
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = P.dustLt; for (let i = 0; i < 30; i++) ctx.fillRect(rnd(i + 900) * 1080, y0 + 4 + rnd(i + 950) * 14, 10 + rnd(i + 990) * 40, 2); ctx.restore();
    const gx = 150, gy = y0 + 60;    // soğuk çay (P4'teki gibi)
    C.shape(ctx, [[gx - 42, gy - 160], [gx + 42, gy - 160], [gx + 24, gy - 90], [gx + 42, gy - 12], [gx - 42, gy - 12], [gx - 24, gy - 90]], 'rgba(220,235,240,.8)', { lw: 4 });
    C.shape(ctx, [[gx - 33, gy - 124], [gx + 33, gy - 124], [gx + 21, gy - 90], [gx + 36, gy - 21], [gx - 36, gy - 21], [gx - 21, gy - 90]], '#8a3a12', { lw: 0 });
    C.shape(ctx, C.ell(gx, gy - 6, 72, 15, 16), P.paper, { lw: 3.6 });
    // kapalı defter masada (hafif yukarıdan)
    ctx.save(); ctx.translate(640, y0 + 40); ctx.scale(1.35, 1.35); C.seed(521);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(16, 30, 200, 26, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.shape(ctx, [[-170, 10], [170, 6], [192, 30], [-188, 36]], P.page, { lw: 4 });
    C.shape(ctx, [[-176, -10], [166, -16], [190, 16], [-190, 22]], '#4a2e17', { lw: 4.4, shade: c => { C.blot(c, [[60, -20], [200, -20], [200, 30], [80, 30]], '#331f0e', .6); for (let i = 0; i < 10; i++) C.blot(c, C.ell(-170 + rnd(i + 60) * 340, -10 + rnd(i + 70) * 26, 14 + rnd(i) * 24, 3 + rnd(i + 2) * 4, 8), P.dustLt, .35); } });
    C.line(ctx, [[120, -15], [134, 19]], 4, '#2a1a0c', .3);
    ctx.restore();
  }
  /* a03 · S4a "I found it…" — Kaan dedenin masasında, lamba ışığında; önünde kapalı, tozlu defter. Öne eğilir. */
  shot('a03-kaan', k => k.cB, k => k.cB2, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.drawImage(officeBlur(), 0, 0);
    ctx.save(); cam(ctx, lerp(1.0, 1.07, E.io(u)), 540, 1000, 540, 1000);
    const lean = E.ioC(seg(tw, k.cB + .45, k.cB + .9));
    const bl = tw >= k.cB + .25 && tw < k.cB + .25 + 3 / FPS ? 1 : 0;
    C.drawKaan(ctx, { x: 450, y: 1340 + lean * 18, s: 1.5, pose: 'sit', hands: 'knees', expr: 'serious', look: .35, blink: bl, seed: 11 });
    deskFront(ctx, 1110);
    motes(ctx, t, [300, 500, 600, 600], 30, 41, .6, 1.6);
    ctx.restore();
    glow(ctx, 830, 760, 380, .16); vignette(ctx, .5); finish(ctx);
  });

  /* ================= MASA ÜSTTEN + DEFTER ================= */
  const NB = { x: 540, y: 900 };
  function deskBg(ctx) {
    const bg = cached('p5a-masa-ust', 2160, 2880, c => {
      c.translate(540, 480); c.fillStyle = P.wood; c.fillRect(-540, -480, 2160, 2880); C.seed(611);
      for (let i = -2; i < 11; i++) C.line(c, [[-560, 120 + i * 220], [1640, 140 + i * 220 + (i % 2 ? 8 : -6)]], 2.6, 'rgba(21,18,13,.35)', 1.6);
      for (let i = 0; i < 80; i++) { const x = -540 + rnd(i + 30) * 2160, y = -480 + rnd(i + 31) * 2880; C.line(c, [[x, y], [x + 80 + rnd(i) * 120, y + 4]], 1.4, 'rgba(63,39,17,.4)', 1); }
      [[340, 330, -.12, 300], [700, 300, .1, 240], [980, 420, .5, 360]].forEach(([x, y, r, L]) => { c.save(); c.translate(x, y); c.rotate(r); C.shape(c, [[-L / 2, -24], [L / 2, -24], [L / 2, 24], [-L / 2, 24]], '#dfe5e2', { lw: 4, shade: cc => C.blot(cc, [[-L / 2, 6], [L / 2, 6], [L / 2, 26], [-L / 2, 26]], '#b9c2bf', .7) }); C.shape(c, C.ell(L / 2, 0, 9, 24, 12), '#eef2f0', { lw: 3 }); c.restore(); });
    });
    ctx.drawImage(bg, -540, -480);
  }
  function handOnRoll(ctx, x, y, rot, flip) { // p4-a'dan: kol alttan, ceket + sarı bileklik + el
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (flip) ctx.scale(-1, 1); C.seed(flip ? 652 : 651);
    C.shape(ctx, [[-60, 120], [60, 120], [70, 700], [-70, 700]], P.jacket, { lw: 6, shade: c => C.blot(c, [[20, 110], [80, 110], [80, 700], [30, 700]], '#0b1f2a', .3) });
    C.shape(ctx, [[-56, 100], [56, 100], [58, 136], [-58, 136]], P.hazard, { lw: 4.4 });
    C.shape(ctx, [[-52, 104], [-58, 30], [-40, -26], [-10, -44], [24, -40], [48, -16], [56, 40], [50, 104]], P.skin, { lw: 6, shade: c => C.blot(c, [[20, -50], [70, -50], [70, 110], [30, 110]], P.skinDk, .5) });
    C.line(ctx, [[-30, -20], [-26, 20]], 3, P.skinDk); C.line(ctx, [[-6, -32], [-4, 10]], 3, P.skinDk); C.line(ctx, [[18, -30], [16, 10]], 3, P.skinDk);
    ctx.restore();
  }
  // İşaret eden el (pilot drawHand'den kısaltılmış kopya): parmak ucu (x,y), ang yönü
  function pointer(ctx, x, y, ang, s) {
    const lw = 5 / s; ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); C.seed(71);
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.translate(14, 22); ctx.fillRect(-760, -60, 760, 120); ctx.restore();
    C.shape(ctx, [[-760, -66], [-248, -60], [-236, 64], [-760, 70]], P.jacket, { lw, shade: c => C.blot(c, [[-760, 24], [-230, 22], [-230, 80], [-760, 80]], '#0b1f2a', .3) });
    C.shape(ctx, [[-286, -62], [-252, -61], [-246, 64], [-282, 66]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-252, -50], [-156, -58], [-114, -40], [-106, 8], [-118, 52], [-204, 60], [-250, 50]], P.skin, { lw, shade: c => C.blot(c, [[-260, 18], [-100, 18], [-100, 70], [-260, 70]], P.skinDk, .55) });
    [[-128, 34], [-154, 48], [-182, 54]].forEach(([a, b], i) => C.shape(ctx, C.ell(a, b, 22, 15, 14), i % 2 ? P.skinDk : P.skin, { lw: lw * .8 }));
    C.shape(ctx, [[-124, -36], [-60, -30], [-18, -24], [-2, -14], [4, 0], [-2, 13], [-20, 19], [-62, 14], [-122, 8]], P.skin, { lw, shade: c => C.blot(c, [[-130, 6], [10, 6], [10, 24], [-130, 24]], P.skinDk, .5) });
    C.shape(ctx, [[-34, -22], [-10, -18], [-6, -6], [-30, -8]], '#e2b58f', { lw: lw * .6, amp: .4 });
    C.shape(ctx, [[-214, -50], [-160, -82], [-112, -76], [-112, -58], [-160, -46]], P.skin, { lw });
    ctx.restore();
  }

  /* ---------- defter sayfaları (yerel; drawNotebook üstüne boş sayfa + içerik) ---------- */
  function pageBlank(ctx, side) {
    C.seed(side < 0 ? 931 : 932);
    const pts = side < 0 ? [[-359, -232], [-9, -227], [-9, 233], [-359, 231]] : [[9, -227], [359, -232], [359, 231], [9, 233]];
    ctx.save(); ctx.fillStyle = P.page; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.clip();
    const g = side < 0 ? ctx.createLinearGradient(-60, 0, 0, 0) : ctx.createLinearGradient(0, 0, 60, 0);
    g.addColorStop(side < 0 ? 0 : 1, 'rgba(0,0,0,0)'); g.addColorStop(side < 0 ? 1 : 0, 'rgba(0,0,0,.25)'); ctx.fillStyle = g; ctx.fillRect(side < 0 ? -60 : 0, -240, 60, 480);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(160,118,62,${.06 + rnd(i * 7 + (side + 5)) * .08})`; ctx.beginPath(); ctx.arc(side * (40 + rnd(i * 3 + side + 9) * 300), -220 + rnd(i * 5 + side + 7) * 440, 4 + rnd(i) * 10, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(31,79,224,.18)'; ctx.lineWidth = 1.4;
    for (let yy = -190; yy < 230; yy += 34) { ctx.beginPath(); if (side < 0) { ctx.moveTo(-350, yy); ctx.lineTo(-16, yy); } else { ctx.moveTo(16, yy); ctx.lineTo(350, yy); } ctx.stroke(); }
    ctx.restore();
  }
  // Eski, soluk fotoğraf: genç iki ortak (biri şapkalı), arkada "H & K" tabelası, el sıkışırlar.
  function photo(ctx) {
    const pc = cached('p5a-foto', 520, 380, g => {
      g.scale(2, 2); g.translate(130, 95);
      C.seed(941); C.shape(g, [[-125, -90], [125, -90], [125, 90], [-125, 90]], '#efe6cf', { lw: 2.4 });
      g.save(); g.beginPath(); g.rect(-113, -78, 226, 146); g.clip();
      const sk = g.createLinearGradient(0, -78, 0, 30); sk.addColorStop(0, '#cdbb95'); sk.addColorStop(1, '#e2d3b0'); g.fillStyle = sk; g.fillRect(-113, -78, 226, 146);
      g.fillStyle = '#a8916a'; g.fillRect(-113, 30, 226, 40);
      C.seed(942); for (let i = 0; i < 6; i++) C.shape(g, [[-113 + i * 40, 30], [-113 + i * 40, 30 - 20 - rnd(i + 3) * 30], [-80 + i * 40, 30 - 20 - rnd(i + 3) * 30], [-80 + i * 40, 30]], '#b9a682', { lw: 0 });
      // tabela
      C.line(g, [[-62, 30], [-62, -40]], 3, '#5b4a36', .3); C.line(g, [[62, 30], [62, -40]], 3, '#5b4a36', .3);
      C.shape(g, [[-78, -76], [78, -77], [80, -54], [-80, -53]], '#7a6649', { lw: 2.2 });
      g.font = '700 20px Rubik'; g.textAlign = 'center'; g.fillStyle = '#efe2c0'; g.fillText('H & K', 0, -58);
      g.translate(0, 8);
      // genç Kaya (solda, ince, şapkasız, iş ceketi) ve genç Hale (sağda, iri, şapkalı, açık renk takım)
      const man = (x, wide, suit, hat) => {
        const sh = wide ? 30 : 21;
        C.shape(g, [[x - sh * .55, 60], [x - sh * .45, 18], [x + sh * .45, 18], [x + sh * .55, 60]], '#4d4234', { lw: 1.6 });
        C.shape(g, [[x - sh, 22], [x - sh * .9, -12], [x - sh * .4, -20], [x + sh * .4, -20], [x + sh * .9, -12], [x + sh, 22]], suit, { lw: 1.8 });
        C.shape(g, C.ell(x, -33, 11, 13, 14), '#c7a57e', { lw: 1.6 });
        g.fillStyle = '#3a3026'; g.fillRect(x - 5, -35, 2, 2.4); g.fillRect(x + 3, -35, 2, 2.4);
        if (hat) { C.shape(g, C.ell(x, -44, 20, 4.6, 14), '#d6c39c', { lw: 1.6 }); C.shape(g, [[x - 10, -45], [x - 8, -58], [x + 8, -58], [x + 10, -45]], '#d6c39c', { lw: 1.6 }); C.line(g, [[x - 10, -48], [x + 10, -48]], 2.4, '#5b4a36', .2); }
        else C.shape(g, [[x - 11, -36], [x - 10, -46], [x, -49], [x + 10, -46], [x + 11, -38], [x + 4, -43], [x - 4, -42]], '#3a3026', { lw: 1.4 });
      };
      man(-36, false, '#5e5a48', false); man(38, true, '#d9c8a2', true);
      C.line(g, [[-22, -6], [-6, 8], [4, 8]], 6, '#5e5a48', .3); C.line(g, [[22, -6], [8, 8], [2, 8]], 7, '#d9c8a2', .3);
      C.shape(g, C.ell(3, 8, 5, 4, 10), '#c7a57e', { lw: 1.2 });
      g.restore();
      // solma + çizikler
      g.fillStyle = 'rgba(240,226,192,.28)'; g.fillRect(-113, -78, 226, 146);
      g.strokeStyle = 'rgba(255,250,235,.5)'; g.lineWidth = .8; for (let i = 0; i < 7; i++) { const x = -110 + rnd(i + 950) * 220; g.beginPath(); g.moveTo(x, -78); g.lineTo(x + (rnd(i + 960) - .5) * 30, 68); g.stroke(); }
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(21,18,13,.5)'; g.strokeRect(-113, -78, 226, 146);
    });
    ctx.save(); ctx.translate(-184, -86); ctx.rotate(-.045);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.fillRect(-121, -84, 254, 184); ctx.restore();
    ctx.drawImage(pc, -130, -95, 260, 190);
    ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = '#e8e2cf'; ctx.translate(-118, -84); ctx.rotate(-.6); ctx.fillRect(-26, -10, 52, 20); ctx.restore();
    ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = '#e8e2cf'; ctx.translate(118, -84); ctx.rotate(.6); ctx.fillRect(-26, -10, 52, 20); ctx.restore();
    ctx.restore();
  }
  function signatures(ctx) {
    C.handwrite(ctx, 'Hale', -320, 150, 40, P.inkOld, 951, { bold: true });
    partial(ctx, [[-326, 162], [-280, 168], [-230, 164], [-200, 158]], 1, 2.4, P.inkOld, 952);
    C.handwrite(ctx, 'Kaya', -150, 156, 40, P.inkOld, 953, { bold: true });
    partial(ctx, [[-156, 168], [-110, 174], [-62, 170], [-34, 162]], 1, 2.4, P.inkOld, 954);
    C.line(ctx, [[-340, 196], [-30, 194]], 1.4, 'rgba(58,48,38,.5)', .3);
  }
  // Hızlı: üç bina kendiliğinden çizilir (sol sayfa). u1..u3 0..1
  const BLD = [[-335, -255, 250, '6 wk'], [-232, -146, 176, '5 wk'], [-128, -38, 300, '4 wk']];
  function fastPage(ctx, us) {
    const g = 168;
    partial(ctx, [[-348, g], [-24, g + 2]], clamp(us[0] * 3), 2.6, P.inkOld, 961);
    BLD.forEach(([x0, x1, h, lab], i) => {
      const u = us[i]; if (u <= 0) return; const sd = 970 + i * 10;
      partial(ctx, [[x0, g], [x0, g - h], [x1, g - h], [x1, g]], seg(u, 0, .45), 3, P.inkOld, sd);
      const nf = Math.floor(h / 36);
      for (let f = 1; f < nf; f++) partial(ctx, [[x0, g - f * 36], [x1, g - f * 36]], seg(u, .4 + f * .05, .55 + f * .05), 1.6, P.inkOld, sd + f);
      for (let f = 0; f < nf; f++) for (let q = 0; q < 3; q++) { if (u < .6 + f * .04) continue; const wx = lerp(x0, x1, .2 + q * .3); ctx.fillStyle = 'rgba(58,48,38,.75)'; ctx.fillRect(wx - 5, g - f * 36 - 26, 10, 14); }
      if (u > .7) { ctx.save(); ctx.strokeStyle = 'rgba(58,48,38,.35)'; ctx.lineWidth = 1.4; for (let yy = g - h + 8; yy < g; yy += 12) { ctx.beginPath(); ctx.moveTo(x1 - 14, yy); ctx.lineTo(x1, yy - 8); ctx.stroke(); } ctx.restore(); }
      if (u > .8) C.handwrite(ctx, lab, x0 + 4, g + 40, 24, P.inkOld, sd + 7);
    });
  }
  // Ucuz: beton torbası (sağ sayfa)
  function cheapPage(ctx, u) {
    if (u <= 0) return;
    partial(ctx, [[96, -56], [292, -66], [306, 150], [78, 160], [96, -56]], seg(u, 0, .35), 3, P.inkOld, 981);
    partial(ctx, [[96, -56], [114, -88], [270, -94], [292, -66]], seg(u, .2, .4), 2.4, P.inkOld, 982);
    partial(ctx, [[124, 0], [262, -6], [264, 72], [120, 76], [124, 0]], seg(u, .3, .5), 2.2, P.inkOld, 983);
    if (u > .45) C.handwrite(ctx, 'MIX', 146, 56, 46, P.inkOld, 984, { bold: true });
    if (u > .58) { C.handwrite(ctx, 'cheap', 140, -24, 30, P.inkOld, 985); }
    if (u > .66) { partial(ctx, C.ell(300, -140, 44, 34, 20), seg(u, .66, .8), 2.4, P.inkOld, 986); if (u > .74) C.handwrite(ctx, '-40%', 266, -132, 26, P.inkOld, 987, { bold: true }); }
    if (u > .72) { ctx.save(); ctx.fillStyle = 'rgba(58,48,38,.55)'; for (let i = 0; i < 40; i++) { const a = rnd(i + 990) * Math.PI, r = rnd(i + 995) * 60; ctx.fillRect(190 + Math.cos(a) * r * 1.6, 176 - Math.sin(a) * r * .4, 2.2, 2.2); } ctx.restore(); partial(ctx, [[100, 180], [190, 156], [290, 180]], 1, 1.8, P.inkOld, 991); }
    if (u > .82) C.handwrite(ctx, 'sand?', 40, 222, 28, P.inkOld, 992);
  }
  // Dokuz bina: sol sayfada 1–9 satırları (listeyle aynı el yazısı), sağ sayfada 3×3 küçük foto
  function rowsPage(ctx) {
    for (let i = 1; i <= 9; i++) { ctx.save(); ctx.translate(-352, -170 + (i - 1) * 44 - .524 * lineY(i)); ctx.scale(.524, .524); listLine(ctx, i); ctx.restore(); }
  }
  function thumb(i) {
    return cached('p5a-kucuk' + i, 208, 256, g => {
      const tmp = canvas(208, 256), c = tmp.getContext('2d'), sc = 208 / 1080;
      c.save(); c.scale(sc, sc);
      const A = { x: 0, y: 0, w: 1080, h: 1330 };
      if (i === 1) {               // baca (P1)
        const sk = c.createLinearGradient(0, 0, 0, 900); sk.addColorStop(0, P.sky0); sk.addColorStop(1, P.sky2); c.fillStyle = sk; c.fillRect(0, 0, 1080, 1330);
        c.fillStyle = P.ground; c.fillRect(0, 900, 1080, 430); C.seed(1001);
        C.shape(c, [[450, 920], [480, 140], [600, 140], [630, 920]], P.brick, { lw: 14, shade: cc => C.blot(cc, [[560, 100], [700, 100], [700, 960], [580, 960]], P.brickDk, .6) });
        C.shape(c, [[440, 150], [640, 150], [640, 110], [440, 110]], P.brickDk, { lw: 14 });
      } else if (i === 3) C.drawWaterTower(c, Object.assign({ seed: 1003 }, A));
      else if (i === 9) {          // 9: uzun bir yapının alt kısmı; tepesi karenin dışında (açılmaz)
        const sk = c.createLinearGradient(0, 0, 0, 900); sk.addColorStop(0, P.sky0); sk.addColorStop(1, P.sky2); c.fillStyle = sk; c.fillRect(0, 0, 1080, 1330);
        c.fillStyle = P.ground; c.fillRect(0, 1000, 1080, 330); C.seed(1009);
        C.shape(c, [[330, 1010], [330, -60], [760, -60], [760, 1010]], P.glassTDk, { lw: 14, shade: cc => { for (let y = 40; y < 1000; y += 70) cc.fillRect(330, y, 430, 6); C.blot(cc, [[620, -80], [780, -80], [780, 1020], [640, 1020]], '#41606f', .5); } });
      } else C.drawOldBuilding(c, Object.assign({ variant: [0, 0, 0, 1, 2, 3, 4, 5][i - 1], seed: 1000 + i }, A));
      c.restore();
      g.filter = 'sepia(1) saturate(.5) brightness(.95) contrast(.9)'; g.drawImage(tmp, 0, 0); g.filter = 'none';
      g.fillStyle = 'rgba(240,226,192,.22)'; g.fillRect(0, 0, 208, 256);
      g.strokeStyle = '#efe6cf'; g.lineWidth = 12; g.strokeRect(6, 6, 196, 244);
      g.strokeStyle = 'rgba(21,18,13,.6)'; g.lineWidth = 2.4; g.strokeRect(1, 1, 206, 254);
    });
  }
  const TH = i => { const c = (i - 1) % 3, r = Math.floor((i - 1) / 3); return [74 + c * 112, -140 + r * 136, ((i * 37) % 7 - 3) * .012]; };
  function ninePage(ctx, t, n0) {
    for (let i = 1; i <= 9; i++) {
      const ti = n0 == null ? -1 : n0 + (i - 1) * .075; if (n0 != null && t < ti) continue;
      const a = n0 == null ? 1 : seg(t, ti, ti + 3 / FPS), sc = n0 == null ? 1 : lerp(1.22, 1, E.outC(seg(t, ti, ti + 4 / FPS)));
      const [x, y, r] = TH(i);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(r); ctx.scale(sc, sc);
      ctx.save(); ctx.globalAlpha *= .25; ctx.fillStyle = P.ink; ctx.fillRect(-48, -58, 104, 128); ctx.restore();
      ctx.drawImage(thumb(i), -52, -64, 104, 128);
      ctx.save(); ctx.globalAlpha *= .6; ctx.fillStyle = '#e8e2cf'; ctx.fillRect(-16, -72, 32, 14); ctx.restore();
      ctx.restore();
      if (a >= 1) C.handwrite(ctx, String(i), x - 50, y + 64, 20, P.inkOld, 1100 + i, { bold: true });
    }
  }
  const NOTE = ['They will not last.', 'I should have said no.', 'Take them down', 'before they fall.'];
  function lastPage(ctx, t) {
    const k = times(), R = [k.l1, k.l2, k.l3, k.l4];
    NOTE.forEach((s, i) => {
      const n = t >= R[i][1] ? s.length : Math.floor(s.length * seg(t, R[i][0], R[i][1]) + 1e-6); if (n <= 0) return;
      C.handwrite(ctx, s.slice(0, n), -340, -160 + i * 68, 30, P.inkOld, 11 + i);    // drawNotebook lastPage ile aynı yer ve tohum
    });
  }
  // Bir sayfa düzeni: id + durum. Yerel koordinat (defter ortası 0,0, s=1).
  function spread(ctx, id, st, t) {
    C.drawNotebook(ctx, { x: 0, y: 0, s: 1, seed: 91 });
    if (id === 'photo') { pageBlank(ctx, -1); photo(ctx); signatures(ctx); return; }
    pageBlank(ctx, -1); pageBlank(ctx, 1);
    if (id === 'fast') { fastPage(ctx, st.b || [0, 0, 0]); cheapPage(ctx, st.c || 0); }
    else if (id === 'nine') { rowsPage(ctx); ninePage(ctx, t, st.n0); }
    else if (id === 'last') lastPage(ctx, t);
  }
  // Sayfa çevirme: A'nın sağ yaprağı solda B olarak iner. ctx defter yerelinde.
  const RS = 2, SW = 820, SH = 560;
  const flipCv = [null, null];
  function spreadImg(j, id, st, t) {
    if (!flipCv[j]) flipCv[j] = canvas(SW * RS, SH * RS);
    const g = flipCv[j].getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SW * RS, SH * RS);
    g.setTransform(RS, 0, 0, RS, SW * RS / 2, SH * RS / 2); spread(g, id, st, t); return flipCv[j];
  }
  function flip(ctx, A, B, u, t) {
    const a = spreadImg(0, A[0], A[1], t), b = spreadImg(1, B[0], B[1], t), hw = SW / 2, hh = SH / 2;
    ctx.drawImage(a, 0, 0, hw * RS, SH * RS, -hw, -hh, hw, SH);
    ctx.drawImage(b, hw * RS, 0, hw * RS, SH * RS, 0, -hh, hw, SH);
    const c = Math.cos(Math.PI * u), lift = Math.sin(Math.PI * u);
    ctx.save(); ctx.globalAlpha = .25 * lift; ctx.fillStyle = P.ink; ctx.fillRect(c > 0 ? 0 : 364 * c, -240, Math.abs(364 * c) + 20, 490); ctx.restore();
    ctx.save(); ctx.translate(0, -lift * 6);
    if (c > 0) { ctx.scale(c, 1); ctx.beginPath(); ctx.rect(2, -246, 366, 494); ctx.clip(); ctx.drawImage(a, hw * RS, 0, hw * RS, SH * RS, 0, -hh, hw, SH); ctx.fillStyle = `rgba(40,25,10,${.25 * (1 - c)})`; ctx.fillRect(0, -250, 380, 500); }
    else { ctx.scale(-c, 1); ctx.beginPath(); ctx.rect(-368, -246, 366, 494); ctx.clip(); ctx.drawImage(b, 0, 0, hw * RS, SH * RS, -hw, -hh, hw, SH); ctx.fillStyle = `rgba(40,25,10,${.25 * (1 + c)})`; ctx.fillRect(-380, -250, 380, 500); }
    ctx.restore();
  }
  // Pilot listesi (katlı, alt kanat arkaya katlı → 10. satır görünmez). Yerel 700×1000.
  function paperBase(ctx, y0, y1) {
    C.seed(401 + y0);
    C.shape(ctx, [[0, y0], [700, y0], [700, y1], [0, y1]], P.page, {
      lw: 3.2, amp: .8, shade: c => {
        const g = c.createLinearGradient(0, 0, 700, 0); g.addColorStop(0, 'rgba(150,110,60,.22)'); g.addColorStop(.1, 'rgba(150,110,60,0)'); g.addColorStop(.9, 'rgba(150,110,60,0)'); g.addColorStop(1, 'rgba(150,110,60,.25)');
        c.fillStyle = g; c.fillRect(0, y0, 700, y1 - y0);
        if (y0 < 260) { c.save(); c.globalAlpha = .28; c.strokeStyle = '#a07a45'; c.lineWidth = 7; C.seed(5); c.stroke(C.pathOf(C.wobble(C.ell(565, 190, 74, 70, 30), true, 3, 10), true)); c.restore(); }
        for (let k = 0; k < 22; k++) { const px = TB.rand(k * 5 + 1) * 700, py = TB.rand(k * 9 + 2) * 1000; if (py < y0 || py > y1) continue; c.fillStyle = `rgba(160,118,62,${.08 + TB.rand(k) * .14})`; c.beginPath(); c.arc(px, py, 3 + TB.rand(k * 3) * 10, 0, TAU); c.fill(); }
      }
    });
  }
  function listHeader(ctx) {
    hand_num(ctx, '10', 52, 40, 54, 5, INK_OLD, 77, .9);
    C.seed(78); stroke(ctx, C.ell(92, 66, 62, 44, 22).concat([[148, 52]]), 3.6, INK_OLD, .8);
    scrawl(ctx, 190, 92, 300, 3.6, INK_OLD, 4400, .85);
    C.seed(79); stroke(ctx, [[186, 108], [360, 104], [520, 110]], 3, INK_OLD, .7);
  }
  const LIST = { x: -222, y: 651, s: .524 };
  function drawListObj(ctx, dx) {
    ctx.save(); ctx.translate(LIST.x + (dx || 0), LIST.y); ctx.scale(LIST.s, LIST.s);
    ctx.save(); ctx.fillStyle = 'rgba(10,5,2,.35)'; C.seed(613); ctx.fill(C.pathOf(C.wobble([[14, 16], [722, 16], [722, 918], [14, 918]], true, 2, 12), true)); ctx.restore();
    paperBase(ctx, 450, 900); for (let i = 5; i <= 9; i++) listLine(ctx, i);
    ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = '#b39b6b'; ctx.fillRect(2, 892, 696, 8); ctx.restore();
    paperBase(ctx, 0, 450); listHeader(ctx); for (let i = 1; i <= 4; i++) listLine(ctx, i);
    ctx.save(); ctx.globalAlpha = .3; C.seed(612); C.line(ctx, [[4, 450], [696, 452]], 2.2, '#8a6a40', .6); ctx.restore();
    ctx.restore();
  }
  // Ortak üstten plan: masa + (liste) + defter (draw(ctx) yerelde) + eller, sonra ışık
  function topView(ctx, t, z, cx, cy, sx, sy, o) {
    ctx.save(); cam(ctx, z, cx, cy, sx, sy);
    deskBg(ctx);
    if (o.list != null) drawListObj(ctx, o.list);
    ctx.save(); ctx.translate(NB.x, NB.y); o.book(ctx); ctx.restore();
    if (o.hands) o.hands(ctx);
    motes(ctx, t, [NB.x - 420, NB.y - 320, 840, 600], 40, 77, .45, 1.4);
    ctx.restore();
    lampWarm(ctx, .5); vignette(ctx, .45); finish(ctx);
  }

  /* a04 · S4b "…in Grandpa's notebook." — üstten: kapalı tozlu defter, el tozu siler, kapak açılır (fotoğraflı sayfa). */
  function closedCover(ctx, dust) {
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(10, -236, 380, 498); ctx.restore();
    C.seed(1201); C.shape(ctx, [[2, -244], [376, -244], [376, 248], [2, 248]], P.page, { lw: 3 });
    C.seed(1202); C.shape(ctx, [[0, -252], [380, -250], [382, 250], [0, 252]], '#4a2e17', { lw: 5, shade: c => { C.blot(c, [[250, -260], [400, -260], [400, 260], [270, 260]], '#331f0e', .5); [[0, -252], [380, -250], [382, 250], [0, 252]].forEach(([x, y]) => C.blot(c, C.ell(x, y, 40, 40, 10), '#2a1a0c', .55)); } });
    C.line(ctx, [[330, -250], [334, 250]], 7, '#2a1a0c', .4);
    if (dust > 0) { ctx.save(); for (let i = 0; i < 60; i++) { const x = 10 + rnd(i + 1210) * 360; if (x < 380 * (1 - dust)) continue; ctx.fillStyle = `rgba(216,202,176,${.35 + rnd(i + 1220) * .3})`; ctx.beginPath(); ctx.ellipse(x, -240 + rnd(i + 1230) * 480, 14 + rnd(i) * 26, 6 + rnd(i + 3) * 10, rnd(i + 5) * 3, 0, TAU); ctx.fill(); } ctx.restore(); }
  }
  shot('a04-kapak', k => k.cB2, k => k.cC, (ctx, t, u) => {
    const k = times(), tw = twos(t), fo = E.ioC(seg(tw, k.open0, k.open1));
    const bu = seg(tw, k.brush, k.brush + .42), dust = 1 - E.outQ(seg(tw, k.brush + .05, k.brush + .4));
    const z = lerp(1.12, 1.22, E.io(u)), cx = lerp(720, 560, E.io(seg(t, k.open0 - .1, k.open1 + .1)));
    topView(ctx, t, z, cx, 900, 540, 820, {
      book: c => {
        if (fo <= 0) { closedCover(c, dust); return; }
        if (fo >= 1) { spread(c, 'photo', {}, t); return; }
        const b = spreadImg(1, 'photo', {}, t), hw = SW / 2, cc = Math.cos(Math.PI * fo);
        c.drawImage(b, hw * RS, 0, hw * RS, SH * RS, 0, -SH / 2, hw, SH);
        c.save(); c.translate(0, -Math.sin(Math.PI * fo) * 8);
        if (cc > 0) { c.scale(cc, 1); closedCover(c, 0); }
        else { c.scale(-cc, 1); c.drawImage(b, 0, 0, hw * RS, SH * RS, -hw, -SH / 2, hw, SH); }
        c.restore();
      },
      hands: c => {
        if (tw < k.open0 - .05) {            // toz silen sağ el: kapak üstünde sağa süpürür
          const e = E.outC(seg(tw, k.cB2 - .2, k.brush)), sw = E.io(bu), away = E.inQ(seg(tw, k.brush + .45, k.open0 - .05));
          handOnRoll(c, lerp(lerp(1150, NB.x + 80, e), NB.x + 360, sw) + away * 60, lerp(lerp(1500, NB.y - 40, e), NB.y - 10, sw) + away * 340, -.35 + sw * .2, false);
        } else {                             // kapağın kenarını tutup açar
          const ex = NB.x + 380 * Math.cos(Math.PI * fo), away = E.inQ(seg(tw, k.open1 + .05, k.open1 + .35));
          handOnRoll(c, ex + (fo > .5 ? -20 : 20), NB.y + 150 + away * 420 - Math.sin(Math.PI * fo) * 30, fo > .5 ? .35 : -.2, fo > .5);
        }
        handOnRoll(c, NB.x - 300 + (fo > 0 ? 0 : 340), NB.y + 300, .2, true);   // sol el alt kenarda bekler
      }
    });
  });

  /* a05 · S5 "Forty years ago, he and Mr. Hale were partners." — eski fotoğraf (iki genç; şapkalı Hale, H & K tabelası), altında iki imza. */
  shot('a05-foto', k => k.cC, k => k.cD, (ctx, t, u) => {
    const e = E.io(u), z = lerp(2.0, 2.32, e);
    topView(ctx, t, z, lerp(352, 360, e), lerp(870, 900, e), 540, 760, { book: c => spread(c, 'photo', {}, t) });
  });

  /* a06 · S6 "They built fast." — sayfa çevrilir; üç bina hızla, art arda çizilir (her biri bir öncekinden kısa sürede: 6/5/4 hafta). */
  function fastState(t) { const k = times(); return { b: [seg(t, k.b1, k.b1 + .34), seg(t, k.b2, k.b2 + .3), seg(t, k.b3, k.b3 + .26)], c: 0 }; }
  shot('a06-hizli', k => k.cD, k => k.cE, (ctx, t, u) => {
    const k = times(), fu = E.ioC(seg(t, k.flipD + .02, k.flipD + .3));
    const [z0, cx, cy] = keyed(t, [[k.cD, 1.42, 470, 900], [k.flipD + .3, 1.75, 356, 905]], .25);
    const pun = [k.b1, k.b2, k.b3].reduce((a, b0) => a + .035 * (1 - E.outC(seg(t, b0, b0 + .16))) * (t >= b0 ? 1 : 0), 0);
    const st = fastState(t);
    topView(ctx, t, z0 * (1 + pun), cx, cy, 540, 780, {
      list: null, book: c => { if (fu < 1) flip(c, ['photo', {}], ['fast', st], fu, t); else spread(c, 'fast', st, t); },
      hands: c => { const a = 1 - E.inQ(seg(twos(t), k.flipD + .3, k.flipD + .6)); handOnRoll(c, NB.x + lerp(330, -300, fu), NB.y + 260 + (1 - a) * 400, fu > .5 ? .3 : -.25, fu > .5); }
    });
  });

  /* a07 · S7 "They built cheap." — sağ sayfa: ucuz beton torbası, "cheap", "-40%", "sand?" */
  shot('a07-ucuz', k => k.cE, k => k.cF, (ctx, t, u) => {
    const k = times(), w = E.ioC(seg(t, k.cE, k.cE + .28));
    const st = { b: [1, 1, 1], c: seg(t, k.cE + .06, W7(k) + .5) };
    topView(ctx, t, lerp(1.75, 1.82, u), lerp(356, 735, w), 905 - 10 * u, 540, 780, { book: c => spread(c, 'fast', st, t) });
  });
  function W7(k) { const ws = TB.tl.sentences[6].words; return (ws.find(x => /^cheap/i.test(x.w)) || ws[2]).t0; }

  /* a08 · S8 "Nine buildings." — sayfa çevrilir; sağda dokuz küçük bina fotoğrafı art arda belirir; solda 1–9 satırları. */
  shot('a08-dokuz', k => k.cF, k => k.cG, (ctx, t, u) => {
    const k = times(), fu = E.ioC(seg(t, k.cF + .02, k.cF + .28));
    const z = lerp(1.42, 1.56, E.io(u)), cx = lerp(640, 690, E.io(u));
    topView(ctx, t, z, cx, 900, 540, 760, {
      book: c => { const fs = { b: [1, 1, 1], c: 1 }; if (fu < 1) flip(c, ['fast', fs], ['nine', { n0: k.n0 }], fu, t); else spread(c, 'nine', { n0: k.n0 }, t); }
    });
  });

  /* a09 · S9 "The same nine on my list." — liste soldan defterin yanına kayar; satırlar aynı hizada, aynı el yazısı; parmak 1→9 iner. */
  shot('a09-liste', k => k.cG, k => k.cH, (ctx, t, u) => {
    const k = times(), tw = twos(t), slide = E.outC(seg(tw, k.cG + .04, k.cG + .5));
    const [z, cx, cy] = keyed(t, [[k.cG, 1.56, 690, 900], [k.cG + .02, 1.2, 160, 880]], .5);
    const dy = 26 * E.io(seg(t, k.trace0, k.cH));
    topView(ctx, t, z * (1 + .02 * seg(t, k.cG + .5, k.cH)), cx, cy + dy, 540, 760, {
      list: -460 * (1 - slide), book: c => spread(c, 'nine', {}, t),
      hands: c => {
        if (tw < k.cG + .62) { const a = E.inQ(seg(tw, k.cG + .45, k.cG + .62)); handOnRoll(c, LIST.x + 60 - 460 * (1 - slide) - a * 200, LIST.y + 360 + a * 300, .5, true); }
        const ent = E.outC(seg(tw, k.trace0 - .3, k.trace0)), tr = E.io(seg(tw, k.trace0, k.trace1)), away = E.inQ(seg(tw, k.trace1 + .2, k.cH));
        if (ent > 0) {
          const row = Math.min(8, Math.floor(tr * 9 + 1e-6)), yy = LIST.y + LIST.s * (lineY(row + 1) - 4);
          pointer(c, lerp(-480, LIST.x + LIST.s * 112, ent) - away * 300, lerp(yy + 300, yy, ent) + away * 300, -.45, .55);
        }
      }
    });
  });

  /* a10 · S10 "On the last page, Grandpa wrote:" — sayfalar hızla çevrilir, son sayfa boş açılır; nota itme. */
  const RIF = [0, .24, .48], RD = .26;
  shot('a10-sonsayfa', k => k.cH, k => k.cI, (ctx, t, u) => {
    const k = times(), t0 = k.cH + .04;
    const pu = E.io(seg(t, t0 + .8, k.cI)), z = lerp(1.2, 1.55, pu), cx = lerp(540, 380, pu), cy = lerp(900, 870, pu);
    const seq = [['nine', {}], ['blank', {}], ['blank', {}], ['last', {}]];
    let fi = -1, fu = 0; RIF.forEach((r, i) => { if (t >= t0 + r) { fi = i; fu = E.ioC(seg(t, t0 + r, t0 + r + RD)); } });
    topView(ctx, t, z, cx, cy, 540, 800, {
      list: 0,
      book: c => { if (fi < 0) spread(c, 'nine', {}, t); else if (fu < 1) flip(c, seq[fi], seq[fi + 1], fu, t); else spread(c, seq[fi + 1][0], seq[fi + 1][1], t); },
      hands: c => {
        const tw = twos(t), act = fi >= 0 && fu < 1, away = E.inQ(seg(tw, t0 + .85, t0 + 1.15));
        const ex = act ? NB.x + 360 * Math.cos(Math.PI * fu) : NB.x + 350;
        handOnRoll(c, ex + 10, NB.y + 210 + away * 500, fu > .5 && act ? .3 : -.25, fu > .5 && act);
        handOnRoll(c, NB.x - 372, NB.y + 262 + 60 * (1 - E.outC(seg(tw, t0 + .6, t0 + 1.2))), .42, true);
      }
    });
  });

  /* a11 · S10–S11 "They will not last." / "I should have said no." — son sayfaya yakın: dedenin eli satır satır belirir (üst üçte bir). */
  shot('a11-not', k => k.cI, k => k.cJ, (ctx, t, u) => {
    const z = lerp(1.9, 1.98, E.io(u));
    topView(ctx, t, z, 356, lerp(838, 846, u), 540, 520, { list: 0, book: c => spread(c, 'last', {}, t), hands: c => handOnRoll(c, NB.x - 372, NB.y + 262, .42, true) });
  });

  /* a12 · S12 "Take them down before they fall." — biraz geniş: tüm not + sol başparmak sayfa kenarında. Son kare B'ye. */
  shot('a12-not', k => k.cJ, k => k.end, (ctx, t, u) => {
    const z = lerp(1.6, 1.66, E.io(u));
    topView(ctx, t, z, 356, lerp(856, 862, u), 540, 560, { list: 0, book: c => spread(c, 'last', {}, t), hands: c => handOnRoll(c, NB.x - 370, NB.y + 258, .42, true) });
  });

  /* ================= SES EKİBİ İÇİN GÖRSEL ANLAR ================= */
  const r3 = x => +x.toFixed(3);
  TB.cuesA = {
    get tebesirHale() { return r3(times().hale0); },          // tebeşir taşta/betonda yazar (HALE, ≈0,55 sn)
    get tebesirKaya() { return r3(times().kaya0); },          // tebeşir (KAYA, ≈0,5 sn)
    get hatiraMektup() { return r3(times().cA); },            // sepya hatıra: borç mektubu (sessiz ya da yumuşak kâğıt)
    get tozSilme() { return r3(times().brush); },             // el defter kapağındaki tozu siler (kumaş/kâğıt sürtmesi)
    get defterKapak() { return r3(times().open1); },          // kapak açılıp masaya iner (yumuşak tok)
    get sayfa1() { return r3(times().flipD + .02); },         // sayfa çevrilir
    get kalem1() { return r3(times().b1); },                  // kalem hızla çizer (3 kısa çizgi sesi)
    get kalem2() { return r3(times().b2); },
    get kalem3() { return r3(times().b3); },
    get sayfa2() { return r3(times().cF + .02); },            // sayfa çevrilir
    get fotolar() { return r3(times().n0); },                 // 9 küçük foto art arda (0,075 sn arayla, çok hafif tık)
    get listeKayar() { return r3(times().cG + .04); },        // liste masada kayar (kâğıt)
    get parmakSatir() { return r3(times().trace0); },         // parmak satırlarda iner
    get sayfaHizli() { return r3(times().cH + .04); },        // üç sayfa hızla (0,24 sn arayla)
    get notYazi1() { return r3(times().l1[0]); },             // dedenin notu belirir (sessiz bırakılabilir)
    get notYazi2() { return r3(times().l2[0]); },
    get notYazi3() { return r3(times().l3[0]); }
  };
})();
