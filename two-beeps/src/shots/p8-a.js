/* Part 8 · NUMBER NINE — Animatör A: 0 – kesme (S13.t1 + S14.t0) / 2 ≈ 25,88 sn (cümle 1–13).
   YERLEŞİM (dünya koordinatları; B aynı salonu ve pencereyi kullansın):
   • HALE TOWER: C.drawHaleTower {x:0,y:0,w:1080,h:1920,mode:'day',seed:5} → kule x 378–702, üst y 115, taban hz 1651;
     altın "HALE" tabelası x 469–611, y 1517–1555 (yazı ortası (540,1538)); giriş kapısı x 475–605, y 1559–1651.
   • BEKLEME SALONU, iki karşılıklı duvar, aynı ölçek (sandalye sırası ortası (540,1778), ölçek 2.07, koltuklar x 147 / 540 / 933):
     – DUVAR A (numaratör duvarı): C.drawWaitingRoom {x:-320,y:-200,w:1720,h:2300}; zemin çizgisi y 1318, lambri üstü y 635;
       numaratör kutusu x 746–1194, y 76–306 (rakam ortası (970,203)), pano x -182–437, y 30–490; duvar saati (591,190) r 85.
       Kaan 1. koltukta (147,1766) s 2.07, pose 'sit', hands 'knees', sağ elinde 104 numara; Defne 2. koltukta (540,1752) s 2.2 (×.9),
       kucağında "No. 9" rapor dosyası; 3. koltuk boş.
     – DUVAR B (pencere duvarı, kameranın arkası; ters açı): aynı duvar renkleri/lambri/zemin; pencere x 170–910, y 90–590
       (dışarıda sonbahar sokağı; Daisy karşı kaldırımda (705,566) s .3, uyarı ışığı dünyada ≈(705,462): üst üçte bir).
       Mr. Hale ortadaki koltukta (540,1766) s 1.99 (×1.04), şapkası başında; elinde 103 numara (S13'ten sonra telefon).
     – NUMARALAR: numaratör S9'da 088; "bir saat"te (S12) 088 → 101 akar. Hale 103, Kaan 104 (bir sonraki çağrılan Hale).
   • SONBAHAR YIKIMLARI (S3): yer y=0; 6: eski otopark (v0) x -870, 7: depo (v2) x 0, 8: eski sinema (v4) x 840; üçü de yerine çöker.
   Her şey timeline'dan (times()); karakterler ikişerli, kamera/toz/yaprak birerli. Bu yarıda iki bip yok (P8: –). */
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
    const mid = i => (S(i).t1 + S(i + 1).t0) / 2;
    const k = {};
    k.tilt = W(1, /^has/i, 3).t0 + .05;                 // kamera kapıdan kuleye kalkar
    k.c2 = mid(1);                                        // altın harfler yakın
    k.gold = c.gold;                                      // ışık harflerden geçer
    k.c3 = mid(2);                                        // sonbahar, üç bina
    k.land = [W(3, /^six/i, 0).t0 + .06, W(3, /^seven/i, 1).t0 + .08, W(3, /^eight/i, 3).t0 + .06];
    k.list = W(3, /^autumn/i, 8).t0 - .05;                // liste
    k.strike = [k.list + .2, k.list + .42, k.list + .64];
    k.tower = W(4, /^big/i, 3).t0 - .06;                  // "the big one" → kule alttan
    k.rep = mid(5);                                       // rapor
    k.crack = c.crack; k.crackEnd = c.crackEnd;
    k.years = mid(6);                                     // yıllar
    const w7 = S(7).words; k.flip = [1, 2, 3, 4].map(i => w7[i].t0 - .08);
    k.city = mid(7);                                      // belediye
    k.num = mid(8);                                       // numara makinesi
    k.pull = W(9, /^take/i, 4).t0;                        // fiş koparılır
    k.board = W(9, /^and/i, 7).t0 - .05;                  // fiş ↔ numaratör
    k.sit = mid(9);                                       // salonda oturur
    k.hale = W(10, /^Hale/i, 1).t0 - .12;                 // Hale
    k.tix = mid(10);                                      // iki fiş
    k.hour = mid(11);                                     // saat
    k.hour2 = W(12, /^nobody/i, 3).t0 - .08;              // geniş sessizlik
    k.look = mid(12);                                     // Kaan bakar
    k.phone = W(13, /^saw/i, 2).t0 + .06;                 // telefon
    k.end = mid(13);                                      // B'ye kesme
    K = k; return k;
  }
  const blinkAt = (t, list) => list.some(b => t >= b && t < b + 3 / FPS) ? 1 : 0;

  /* ================= YARDIMCILAR (p7-b ile aynı) ================= */
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

  /* ---------- sonbahar yaprakları (yeni nesne): düşer, salınır, döner ---------- */
  const LEAF = ['#c0612b', '#a8482a', '#d4893a', '#8a4f26', '#b9702e'];
  function leaf(ctx, x, y, sz, rot, col, flipY) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, flipY);
    ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.quadraticCurveTo(-sz * .2, -sz * .62, sz, 0); ctx.quadraticCurveTo(-sz * .2, sz * .62, -sz, 0); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(1.6, sz * .13); ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-sz * 1.25, 0); ctx.lineTo(sz * .7, 0); ctx.lineWidth = Math.max(1, sz * .08); ctx.stroke();
    ctx.restore();
  }
  function leaves(ctx, t, n, sb, box, size, speed) {   // box [x,y,w,h]: düşme alanı (döngülü)
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 313 + i * 17 + j), v = (speed || 1) * (110 + r(1) * 90), L = box[3] + 200;
      const ph = (r(2) * L + t * v) % L, y = box[1] - 100 + ph, sw = Math.sin(t * (1.4 + r(3)) + r(4) * 6);
      const x = box[0] + r(5) * box[2] + sw * 40 * (size || 1) + t * 25 * (r(6) - .3);
      const sz = (size || 1) * (11 + r(7) * 9), fl = Math.cos(t * (2.2 + r(8) * 2) + r(9) * 6);
      leaf(ctx, x, y, sz, sw * .9 + r(10) * 6, LEAF[i % LEAF.length], Math.abs(fl) < .15 ? .15 * Math.sign(fl || 1) : fl);
    }
  }
  function autumnTree(ctx, x, y, s, t, sd) {   // turuncu yapraklı ağaç; gövde (x,y) tabanı
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd || 811);
    const sw = Math.sin(t * 1.3 + (sd || 0)) * 4;
    C.shape(ctx, [[-22, 0], [22, 0], [16, -260], [40, -330], [10, -320], [-4, -380], [-20, -300], [-46, -340], [-14, -250]], '#4a3a2c', { lw: 5, shade: c => C.blot(c, [[4, 0], [30, 0], [30, -330], [6, -330]], '#2e241b', .5) });
    [[-80, -380, 110, 80, LEAF[0]], [70, -400, 120, 86, LEAF[2]], [0, -470, 130, 90, LEAF[4]], [-120, -460, 80, 60, LEAF[1]], [120, -480, 80, 64, LEAF[0]], [10, -540, 90, 60, LEAF[2]]].forEach(([fx, fy, rx, ry, col], i) => {
      C.seed((sd || 811) + i * 3); C.shape(ctx, C.ell(fx + sw * (1 + i * .2), fy, rx, ry, 20), col, { lw: 4.4, amp: 3, shade: c => C.blot(c, C.ell(fx + rx * .35 + sw, fy + ry * .3, rx * .6, ry * .5, 12), '#7a3418', .35) });
    });
    ctx.restore();
  }

  /* ---------- liste (pilot kâğıdı; p7-b ile aynı el yazısı) ---------- */
  const PAPER = '#eadfc2', INK_OLD = '#3a3026', BLUE = '#1f4fe0';
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
  function strikeLine(ctx, i, u) {
    if (u <= 0) return; const y = lineY(i) - 4, x0 = 26, x1 = 128 + lineLen(i) + 30;
    const pts = []; for (let q = 0; q <= 10; q++) pts.push([lerp(x0, x1, q / 10), y + Math.sin(q * 1.3 + i) * 3 + (q / 10 - .5) * -6]);
    const n = Math.max(2, Math.round(pts.length * u)), pp = pts.slice(0, n); if (u < 1) { const last = lerp(x0, x1, u); pp[pp.length - 1] = [last, pp[pp.length - 1][1]]; }
    C.seed(1500 + i); stroke(ctx, pp, 13, P.ink, .95);
  }
  function listPaper() {   // 1–5 çizili (P7 sonu); 6–8 canlı çizilir
    return cached('liste8', 760, 1060, c => {
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
      const pts = [], n = 26, x0 = 112, x1 = 640, y = lineY(10) - 4;
      for (let q = 0; q <= n; q++) { const u = q / n; pts.push([x0 + (x1 - x0) * u + (TB.rand(q * 7) - .5) * 14, y + (q % 2 ? -26 : 24) + (TB.rand(q * 3) - .5) * 10]); }
      const pts2 = []; for (let q = 0; q <= 18; q++) { const u = q / 18; pts2.push([x1 - 10 - (x1 - x0 - 30) * u, y + (q % 2 ? 18 : -18) + (TB.rand(q * 11) - .5) * 8]); }
      C.seed(512); const paths = [pts, pts2, [[x0 - 6, y + 2], [(x0 + x1) / 2, y - 6], [x1 + 8, y + 4]]].map(p => C.pathOf(C.wobble(p, false, 1.2, 6), false));
      c.lineCap = 'round'; c.lineJoin = 'round'; paths.forEach((p, i) => { c.strokeStyle = BLUE; c.lineWidth = i === 2 ? 8 : 7; c.stroke(p); });
      [1, 2, 3, 4, 5].forEach(i => strikeLine(c, i, 1));
    });
  }
  function deskTop(ctx) {   // p7-b'deki çizim masası üstü
    const cv = cached('masa-ust', 1080, 2400, c => {
      c.fillStyle = '#d9d3bf'; c.fillRect(0, 0, 1080, 2400); C.seed(3701);
      for (let i = 0; i < 10; i++) C.blot(c, C.ell(rnd(3710 + i) * 1080, rnd(3720 + i) * 2400, 120 + rnd(3730 + i) * 160, 30 + rnd(3740 + i) * 30, 12), '#c4bca3', .5);
      c.strokeStyle = 'rgba(31,79,224,.07)'; c.lineWidth = 2; for (let x = 0; x < 1080; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 2400); c.stroke(); }
    });
    ctx.drawImage(cv, -540, -1200);
  }
  function kaanHandPen(ctx, x, y, rot) {   // p7-b ile aynı el + keçeli kalem; uç (x,y)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); C.seed(3620);
    C.line(ctx, [[0, 0], [70, -96]], 20, P.ink, .2); C.line(ctx, [[0, 0], [70, -96]], 11, '#2b2b30', .2); C.line(ctx, [[2, -3], [14, -20]], 6, '#111', .1);
    C.shape(ctx, [[60, -150], [140, -170], [200, -90], [150, -20], [70, -40], [40, -100]], P.skin, { lw: 6, shade: c => C.blot(c, [[120, -170], [210, -170], [210, -20], [140, -20]], P.skinDk, .5) });
    C.line(ctx, [[86, -120], [130, -100]], 3, P.skinDk, .3);
    C.shape(ctx, [[150, -180], [220, -120], [196, -80], [126, -140]], P.hazard, { lw: 5 });
    C.shape(ctx, [[180, -170], [700, -10], [640, 200], [150, -60]], P.jacket, { lw: 6, shade: c => C.blot(c, [[200, -100], [680, 60], [640, 200], [180, -40]], P.jacketDk, .55) });
    ctx.restore();
  }
  function kaanHandPinch(ctx, x, y, rot, s, flip) {   // Kaan'ın eli: başparmak + işaret parmağı (x,y)'de buluşur; kol sağ alttan (flip: sol alttan) gelir
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); C.seed(3630);
    C.shape(ctx, [[150, -60], [700, 120], [620, 380], [110, 60]], P.jacket, { lw: 6, shade: c => C.blot(c, [[200, 20], [680, 160], [620, 380], [160, 90]], P.jacketDk, .55) });
    C.shape(ctx, [[120, -50], [196, -24], [168, 70], [96, 46]], P.hazard, { lw: 5 });
    C.shape(ctx, [[30, -70], [110, -80], [150, -20], [130, 50], [60, 60], [20, 10]], P.skin, { lw: 6, shade: c => C.blot(c, [[90, -80], [160, -80], [160, 60], [100, 60]], P.skinDk, .5) });
    C.shape(ctx, [[40, -66], [-6, -44], [-16, -22], [4, -14], [50, -34]], P.skin, { lw: 5.5 });     // işaret parmağı (üstte)
    C.shape(ctx, [[30, 30], [-4, 4], [-14, -10], [6, -16], [50, 10]], P.skinDk, { lw: 5.5 });       // başparmak (altta)
    C.line(ctx, [[60, -40], [80, -30]], 3, P.skinDk, .3);
    ctx.restore();
  }

  /* ---------- numara fişi (yeni nesne): orta (x,y), s; num metin ---------- */
  function ticket(ctx, x, y, s, rot, num, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    const W = 130, H = 84, pts = [];
    for (let q = 0; q <= 10; q++) pts.push([-W / 2 + q * W / 10, -H / 2 + (q % 2 ? 4 : 0)]);
    for (let q = 10; q >= 0; q--) pts.push([-W / 2 + q * W / 10, H / 2 - (q % 2 ? 4 : 0)]);
    C.seed(4101); C.shape(ctx, pts, '#f3ecd8', { lw: 3, amp: .3, shade: c => C.blot(c, [[W * .2, -H], [W, -H], [W, H], [W * .26, H]], '#ddd2b6', .5) });
    ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 11px Rubik'; ctx.fillText('CITY HALL', 0, -27);
    ctx.font = '700 44px Rubik'; ctx.fillText(num, 0, 4);
    ctx.font = '500 10px Rubik'; ctx.fillStyle = 'rgba(21,18,13,.7)'; ctx.fillText('PLEASE WAIT', 0, 31);
    ctx.restore();
  }

  /* ---------- "No. 9" rapor dosyası (p7-b drawFolder'ın kapalı hâli) ---------- */
  function folderClosed(ctx, x, y, s, rot) {
    const W = 720, H = 960; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); C.seed(3201);
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], '#b89463', { lw: 5 / s * .45 });
    C.seed(3202);
    C.shape(ctx, [[-W / 2, -H / 2 - 4], [W / 2 + 8, -H / 2 - 4], [W / 2 + 8, H / 2 + 4], [-W / 2, H / 2 + 4]], '#c9a26b', { lw: 5 / s * .45, shade: cc => { C.blot(cc, [[W * .2, -H / 2 - 10], [W / 2 + 14, -H / 2 - 10], [W / 2 + 14, H / 2 + 10], [W * .26, H / 2 + 10]], '#a88a5a', .4); } });
    C.shape(ctx, [[-W * .34, -H * .3], [W * .34, -H * .3], [W * .34, -H * .06], [-W * .34, -H * .06]], P.paper, { lw: 3.4 / s * .45 });
    C.handwrite(ctx, 'No. 9', -W * .26, -H * .14, 96, INK_OLD, 361, { bold: true });
    ctx.save(); ctx.globalAlpha = .22; ctx.strokeStyle = P.coffee; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(W * .24, H * .24, 60, .5, 5.6); ctx.stroke(); ctx.restore();
    ctx.restore();
  }

  /* ================= HALE TOWER ================= */
  const TW = { x: 0, y: 0, w: 1080, h: 1920, mode: 'day', seed: 5 };
  const TWR = { tx: 378, tw: 324, ty: 115.2, hz: 1651.2, fh: 38.4, ex: 475.2, ew: 129.6, eh: 92.16 };
  const SIGN = { x: 540, y: 1536.6 };
  function towerExtras(ctx, t) {   // kapı ayrıntısı + camda kayan yansıma (dünya koordinatı)
    const { ex, ew, eh, hz, tx, tw, ty } = TWR;
    C.seed(5101);
    // çift cam kapı
    [0, 1].forEach(d => {
      const x0 = ex + 8 + d * (ew - 16) / 2, x1 = x0 + (ew - 16) / 2 - 3;
      C.shape(ctx, [[x0, hz - eh + 10], [x1, hz - eh + 10], [x1, hz], [x0, hz]], '#2b3a48', { lw: 2.2, shade: c => { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x0 + 6, hz - eh + 10, 5, eh); } });
      C.shape(ctx, [[x1 - (d ? 46 : 12), hz - eh * .55], [x1 - (d ? 40 : 6), hz - eh * .55], [x1 - (d ? 40 : 6), hz - eh * .25], [x1 - (d ? 46 : 12), hz - eh * .25]].map(p => d ? [p[0] - (x1 - x0) + 52, p[1]] : p), P.gold, { lw: 1.4 });
    });
    // camda kayan bulut yansıması
    ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, hz - ty - eh - 46); ctx.clip();
    const sx = tx - 200 + ((t * 26) % (tw + 400));
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 60, ty); ctx.lineTo(sx + 60, ty); ctx.lineTo(sx - 140, hz); ctx.lineTo(sx - 260, hz); ctx.fill();
    ctx.restore();
  }
  function towerSky(ctx) { const g = ctx.createLinearGradient(0, -1400, 0, 0); g.addColorStop(0, '#6f9cc4'); g.addColorStop(1, P.sky0); ctx.fillStyle = g; ctx.fillRect(-2000, -1400, 5000, 1402); }

  /* --- 1: "Building number nine has Mr. Hale's name on the door." kapının altın tabelası; kamera kuleye kalkar --- */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });
  shot('p8a01-tabela', k => 0, k => k.c2, (ctx, t) => {
    const k = times(), e = E.io(seg(t, k.tilt, k.c2 + .1));
    const z = lerp(lerp(4.55, 4.85, E.io(seg(t, 0, k.tilt))), 1.32, E.ioC(seg(t, k.tilt, k.c2 + .1)));
    const cy = lerp(SIGN.y, 560, e), sy = lerp(1062, 960, e);
    ctx.save(); cam(ctx, z, lerp(SIGN.x, 548, e), cy, 540, sy);
    towerSky(ctx);
    C.drawHaleTower(ctx, TW);
    towerExtras(ctx, t);
    ctx.restore();
    // önde düşen yapraklar (büyük, kameraya yakın)
    leaves(ctx, t, 7, 81, [-60, 0, 1200, 1920], 2.4, 1.1);
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 2: "In gold." altın harfler yakın; ışık harflerin üstünden kayar --- */
  shot('p8a02-altin', k => k.c2, k => k.c3, (ctx, t, u) => {
    const k = times(), z = lerp(1, 1.06, E.io(u)), dx = lerp(-14, 10, u);
    ctx.fillStyle = '#4c6c82'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.save(); ctx.translate(540 + dx, 800); ctx.scale(z, z);
    // cam cephe (yukarıda) ve kapı (aşağıda)
    C.seed(5201);
    C.shape(ctx, [[-700, -1000], [700, -1000], [700, -240], [-700, -240]], P.glassT, { lw: 6, shade: c => { C.blot(c, [[260, -1010], [710, -1010], [710, -230], [300, -230]], P.glassTDk, .7); c.strokeStyle = 'rgba(21,18,13,.35)'; c.lineWidth = 6; for (let y = -900; y < -240; y += 190) { c.beginPath(); c.moveTo(-700, y); c.lineTo(700, y); c.stroke(); } for (let x = -560; x < 700; x += 270) { c.beginPath(); c.moveTo(x, -1000); c.lineTo(x, -240); c.stroke(); } } });
    C.shape(ctx, [[-700, 250], [700, 250], [700, 1200], [-700, 1200]], '#1c2836', { lw: 6, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-500, 250, 40, 950); c.fillRect(120, 250, 26, 950); } });
    // camda yansıma kayar
    ctx.save(); ctx.beginPath(); ctx.rect(-700, -1000, 1400, 760); ctx.clip(); ctx.globalCompositeOperation = 'screen';
    const rx = lerp(-900, 700, seg(t, k.c2, k.c3)); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(rx, -1000); ctx.lineTo(rx + 160, -1000); ctx.lineTo(rx - 80, -240); ctx.lineTo(rx - 240, -240); ctx.fill(); ctx.restore();
    // tabela paneli
    C.seed(5202);
    C.shape(ctx, [[-640, -230], [640, -230], [640, 230], [-640, 230]], '#14161b', { lw: 9, shade: c => { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(-640, -230, 1280, 40); } });
    [[-600, -190], [600, -190], [-600, 190], [600, 190]].forEach(([sx, sy]) => C.shape(ctx, C.ell(sx, sy, 11, 11, 10), '#5a5e66', { lw: 3 }));
    // harfler (önbellek: gölge + altın degrade), ışık bandı kaynak-üstü
    const txt = cached('altin-harf', 1240, 460, g => {
      g.translate(620, 240); g.font = '400 360px "Lilita One"'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#5a4210'; g.fillText('HALE', 9, 14);
      const gg = g.createLinearGradient(0, -150, 0, 150); gg.addColorStop(0, '#ffe08a'); gg.addColorStop(.55, P.gold); gg.addColorStop(1, P.goldDk); g.fillStyle = gg; g.fillText('HALE', 0, 0);
      g.lineWidth = 5; g.strokeStyle = 'rgba(90,66,16,.8)'; g.strokeText('HALE', 0, 0);
      g.fillStyle = 'rgba(255,248,220,.35)'; g.save(); g.beginPath(); g.rect(-620, -150, 1240, 60); g.clip(); g.fillText('HALE', -2, -3); g.restore();
    });
    const sw = canvas(1240, 460), sg = sw.getContext('2d'); sg.drawImage(txt, 0, 0);
    sg.globalCompositeOperation = 'source-atop';
    const bx = lerp(-200, 1440, E.io(seg(t, k.c2 + .1, k.gold + .3)));
    const lg = sg.createLinearGradient(bx - 140, 0, bx + 140, 0); lg.addColorStop(0, 'rgba(255,255,240,0)'); lg.addColorStop(.5, 'rgba(255,255,240,.85)'); lg.addColorStop(1, 'rgba(255,255,240,0)');
    sg.fillStyle = lg; sg.save(); sg.transform(1, 0, -.35, 1, 80, 0); sg.fillRect(bx - 160, 0, 320, 460); sg.restore();
    ctx.drawImage(sw, -620, -240);
    // ışıltı: "gold" anında E'nin köşesinde
    const gl = seg(t, k.gold - .12, k.gold + .1) * (1 - seg(t, k.gold + .1, k.gold + .5));
    if (gl > 0) { ctx.save(); ctx.translate(330, -120); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(t * 2); ctx.fillStyle = `rgba(255,250,215,${.9 * gl})`; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -60 * gl); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.fill(); } ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
    leaves(ctx, t, 3, 83, [100, 0, 900, 1920], 2.8, 1.2);
    vignette(ctx, .35);
    finish(ctx);
  });

  /* ================= SONBAHAR YIKIMLARI (S3) ================= */
  const BLD = {};
  const BSPEC = { 0: { w: .78, f: 4, up: 0, sign: true }, 2: { w: .84, f: 1, up: 230 }, 4: { w: .7, f: 2, up: 8 } };
  function building(v) {   // drawOldBuilding'den bina kesilir (p7-b yöntemi + çatı üstü)
    if (BLD[v]) return BLD[v];
    const a = canvas(1080, 1920), g = a.getContext('2d');
    C.drawOldBuilding(g, { x: 0, y: 0, w: 1080, h: 1920, variant: v, mode: 'day', seed: 100 + v });
    const sp = BSPEC[v], bw = 1080 * sp.w, fh = 1920 * (sp.f === 1 ? .22 : .5 / Math.max(3, sp.f)), bh = fh * sp.f, bx = (1080 - bw) / 2, by = 1344, top = by - bh;
    const up = sp.sign ? 80 : sp.up;
    const x0 = Math.floor(bx - 14), y0 = Math.floor(top - 12 - up), w = Math.ceil(bw + 28), h = Math.ceil(by - y0 + 2);
    const src = g.getImageData(x0, y0, w, h), O = new ImageData(w, h);
    const sky = g.getImageData(3, y0, 1, h).data;
    const sgn = sp.sign ? [bx + bw * .06 - 4, top - 74, bx + bw * .06 + 74, top] : null;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4, X = x0 + xx, Y = y0 + yy, d = src.data;
      const inside = X >= bx + 2 && X <= bx + bw - 2 && Y >= top + 2 && Y <= by;
      const lum = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
      let keep = inside || lum < 70;
      if (!keep && Y < top + 2) {
        if (sgn) keep = X >= sgn[0] && X <= sgn[2] && Y >= sgn[1] && Y <= sgn[3];
        else if (up > 20) keep = Math.abs(d[i] - sky[yy * 4]) + Math.abs(d[i + 1] - sky[yy * 4 + 1]) + Math.abs(d[i + 2] - sky[yy * 4 + 2]) > 40;
      }
      if (keep) { O.data[i] = d[i]; O.data[i + 1] = d[i + 1]; O.data[i + 2] = d[i + 2]; O.data[i + 3] = 255; }
    }
    const cv = canvas(w, h); cv.getContext('2d').putImageData(O, 0, 0);
    BLD[v] = { cv, bw, bh, ox: 540 - x0, oy: by - y0 };
    return BLD[v];
  }
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
  const FALL = { dur: .5 };
  const SITES8 = [{ n: 6, v: 0, x: -870 }, { n: 7, v: 2, x: 0 }, { n: 8, v: 4, x: 840 }];
  function autumnSiteBg(ctx, t) {
    const g = ctx.createLinearGradient(0, -2600, 0, 0); g.addColorStop(0, '#87a9c4'); g.addColorStop(.6, '#c6cfc9'); g.addColorStop(1, '#ecd2a8');
    ctx.fillStyle = g; ctx.fillRect(-3200, -3200, 6400, 3200);
    [[-1500, -1900, 3, 10], [900, -2200, 2.4, 7], [-200, -1500, 2, 12]].forEach(([x0, y, sc, v]) => {
      const x = x0 + t * v * 3; ctx.fillStyle = P.cloud; ctx.globalAlpha = .9;
      [[0, 0, 80, 28], [-66, 12, 56, 22], [62, 10, 60, 24], [12, -20, 50, 28]].forEach(([a, b, rx, ry]) => { ctx.beginPath(); ctx.ellipse(x + a * sc, y + b * sc, rx * sc, ry * sc, 0, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
    });
    let cx = -3200, n = 0; C.seed(851);
    while (cx < 3200) { const bw = 140 + rnd(8500 + n) * 220, bh = 140 + rnd(8600 + n) * 420; C.shape(ctx, [[cx, -60], [cx, -60 - bh], [cx + bw, -60 - bh], [cx + bw, -60]], P.far, { lw: 4, ink: P.far2, amp: .6 }); cx += bw + 16; n++; }
    const hzg = ctx.createLinearGradient(0, -320, 0, -40); hzg.addColorStop(0, 'rgba(236,210,168,0)'); hzg.addColorStop(1, 'rgba(236,210,168,.7)'); ctx.fillStyle = hzg; ctx.fillRect(-3200, -320, 6400, 282);
    const gg = ctx.createLinearGradient(0, -60, 0, 1600); gg.addColorStop(0, P.groundLt); gg.addColorStop(.35, P.ground); gg.addColorStop(1, P.groundDk);
    ctx.fillStyle = gg; ctx.fillRect(-3200, -60, 6400, 2400);
    for (let i = 0; i < 40; i++) C.blot(ctx, C.ell(-3000 + rnd(8700 + i) * 6000, -10 + rnd(8800 + i) * 1500, 60 + rnd(8900 + i) * 140, 10 + rnd(9000 + i) * 14, 12), i % 3 ? P.groundDk : '#b9702e', .22);
    // yerde yapraklar
    for (let i = 0; i < 70; i++) leaf(ctx, -3000 + rnd(9100 + i) * 6000, 30 + rnd(9200 + i) * 1300, 16 + rnd(9300 + i) * 14, rnd(9400 + i) * 6, LEAF[i % 5], .5);
  }
  function siteFence(ctx, fy) {
    ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = P.dustDk; ctx.lineWidth = 3;
    for (let fx = -3200; fx < 3200; fx += 30) { ctx.beginPath(); ctx.moveTo(fx, fy - 230); ctx.lineTo(fx + 110, fy); ctx.moveTo(fx + 110, fy - 230); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.restore();
    C.seed(2901); C.line(ctx, [[-3200, fy - 232], [3200, fy - 228]], 6, P.dustDk, 1);
    for (let fx = -3160; fx < 3200; fx += 420) C.line(ctx, [[fx, fy - 250], [fx + 2, fy + 4]], 12, P.steelDk, .4);
    const bar = C.shape(ctx, [[-3200, fy - 160], [3200, fy - 166], [3200, fy - 116], [-3200, fy - 110]], null, { lw: 0 });
    C.hazardStripes(ctx, bar, -3204, fy - 170, 6410, 62, 30); C.ink(ctx, bar, 6);
  }
  function drawSite8(ctx, st, t, land) {
    const b = building(st.v), f0 = land - FALL.dur, u = E.inQ(seg(t, f0, land)), tau = t - land;
    TB.zone(ctx, st.x, 40, b.bw * 1.3, 230, 1);
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 4000 + 26); ctx.clip();
    const sink = u * .82 + (tau > 0 ? .06 * (1 - Math.exp(-tau * 3)) : 0), sq = 1 - .1 * u;
    ctx.translate(st.x, b.bh * sink); ctx.scale(1 + .04 * u, sq);
    ctx.drawImage(b.cv, -b.ox, -b.oy);
    ctx.restore();
    if (t >= f0) dustCloud(ctx, t - f0, 26, 80 + st.n, (i, r) => ({ x: st.x + (r(1) - .5) * b.bw * 1.1, y: -10, r: 40 + r(3) * 120, vx: (r(4) - .5) * 200, rise: 20 + r(5) * 260, grow: .5, delay: r(7) * .3, sink: 0 }), .9, 6);
    if (tau >= 0) {
      chips(ctx, tau, 18, 60 + st.n, (i, r) => ({ x: st.x + (r(1) - .5) * b.bw, y: -20 - r(2) * 50, vx: (r(3) - .5) * 520, vy: -240 - r(4) * 520, col: [P.brick, P.concreteDk, P.dustLt, P.concrete][i % 4] }), 1.3);
      dustCloud(ctx, tau, 70, 70 + st.n, (i, r) => ({ x: st.x + (r(1) - .5) * b.bw * 1.1, y: -10 - r(2) * 40, r: 60 + r(3) * r(3) * 220, vx: (r(4) - .5) * 300, rise: 60 + r(5) * r(5) * 560, grow: .9 + r(6) * .5, delay: r(7) * .1, sink: 20 }), tau < 2 ? 1 : .8, 8);
    }
  }
  /* --- 3: "Six, seven and eight came down in the autumn." üç eski bina sırayla iner (6 kare sarsıntı), yapraklar --- */
  shot('p8a03-sonbahar', k => k.c3, k => k.list, (ctx, t, u) => {
    const k = times(), e = E.io(u);
    ctx.save();
    k.land.forEach(l => shake(ctx, t, l, 12));
    const z = lerp(.43, .45, e);
    ctx.translate(540, 1060); ctx.scale(z, z); ctx.translate(-lerp(-260, 110, e), 0);
    autumnSiteBg(ctx, t);
    // sıranın tersine çiz: öndeki toz arkadakini örtsün
    SITES8.forEach((st, i) => drawSite8(ctx, st, t, k.land[i]));
    siteFence(ctx, 330);
    ctx.restore();
    // önde ağaç dalı (sol üst) + yapraklar
    autumnTree(ctx, -40, 1060, 1.5, t, 821);
    leaves(ctx, t, 16, 85, [-40, 0, 1160, 1300], 1.6, 1);
    vignette(ctx, .22);
    finish(ctx);
  });

  /* --- 4: "That left the big one." liste: 6-7-8 çizilir; geriye 9 ve mavi 10 kalır --- */
  shot('p8a04-liste', k => k.list, k => k.tower, (ctx, t, u) => {
    const k = times(), tw = t, push = E.io(seg(t, k.strike[2] + .25, k.tower));
    ctx.save(); const z = lerp(.92, 1.18, push);
    ctx.translate(540, lerp(700, 640, push)); ctx.scale(z, z); ctx.rotate(.03); ctx.translate(-350, lerp(-440, -800, push));
    ctx.save(); ctx.translate(350, 440); deskTop(ctx); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(10,5,2,.3)'; ctx.fillRect(14, 16, 710, 1010); ctx.restore();
    ctx.drawImage(listPaper(), -30, -30);
    const prog = [6, 7, 8].map((i, q) => seg(tw, k.strike[q], k.strike[q] + .16));
    [6, 7, 8].forEach((i, q) => strikeLine(ctx, i, E.outQ(prog[q])));
    // masaya düşen yaprak (sonbahar)
    const lu = E.outC(seg(t, k.list, k.list + 1.1)); leaf(ctx, lerp(820, 600, lu), lerp(-200, 330, lu) + Math.sin(t * 5) * 20 * (1 - lu), 40, lerp(2, .5, lu) + Math.sin(t * 4) * .3 * (1 - lu), LEAF[0], lerp(.4, .7, lu));
    let q = 0; for (let j = 0; j < 3; j++) if (tw >= k.strike[j] - .1) q = j;
    const i = 6 + q, y = lineY(i) - 4, x1 = 128 + lineLen(i) + 30, pu = E.outQ(prog[q]);
    const inU = E.outC(seg(tw, k.list, k.strike[0] - .03)), outU = E.inQ(seg(tw, k.strike[2] + .2, k.strike[2] + .6));
    const between = q < 2 && prog[q] >= 1 ? E.io(seg(tw, k.strike[q] + .16, k.strike[q + 1])) : 0;
    let px = lerp(26, x1, pu), py = y;
    if (between > 0) { px = lerp(x1, 26, between); py = lerp(y, lineY(i + 1) - 4, between) - Math.sin(between * Math.PI) * 30; }
    px += (1 - inU) * 600 + outU * 700; py += (1 - inU) * 500 + outU * 600;
    if (outU < 1) kaanHandPen(ctx, px, py, .1);
    ctx.restore();
    vignette(ctx, .28);
    finish(ctx);
  });

  /* --- 5: "Hale Tower." kule alttan: 40 kat göğe daralır (dilimli perspektif) --- */
  function towerImg() { return cached('kule2x', 2160, 3640, g => { g.scale(2, 2); C.drawHaleTower(g, Object.assign({}, TW, { h: 1920 })); }); }
  shot('p8a05-kule', k => k.tower, k => k.rep, (ctx, t, u) => {
    const k = times(), e = E.io(u), img = towerImg();
    const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#5f8fbb'); g.addColorStop(.7, P.sky0); g.addColorStop(1, P.sky1); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    const Z = lerp(1.95, 2.08, e), Ys = lerp(1380, 1450, e), L = 1150, hz = TWR.hz;
    const map = y => { const h = hz - y, sc = 1 / (1 + Math.max(h, -300) / L); return [Ys - Z * h * sc, sc]; };
    for (let y = 0; y < 1820; y += 3) {
      const [a0, s0] = map(y), [a1] = map(y + 3), sc = s0;
      ctx.drawImage(img, 0, y * 2, 2160, 6, 540 - Z * 540 * sc, a0, Z * 1080 * sc, a1 - a0 + .8);
    }
    // camdan aşağı kayan güneş parıltısı (kule yamuğuna kırpılır)
    const [yt, st] = map(TWR.ty), [yb, sb] = map(hz - 4);
    ctx.save(); ctx.beginPath(); ctx.moveTo(540 - Z * 162 * st, yt); ctx.lineTo(540 + Z * 162 * st, yt); ctx.lineTo(540 + Z * 162 * sb, yb); ctx.lineTo(540 - Z * 162 * sb, yb); ctx.closePath(); ctx.clip();
    ctx.globalCompositeOperation = 'screen'; const gy = lerp(yt - 200, yb, seg(t, k.tower, k.rep + .4));
    const lg = ctx.createLinearGradient(0, gy - 140, 0, gy + 140); lg.addColorStop(0, 'rgba(255,250,225,0)'); lg.addColorStop(.5, 'rgba(255,250,225,.32)'); lg.addColorStop(1, 'rgba(255,250,225,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, gy - 140, 1080, 280); ctx.restore();
    // önde sonbahar dalları (kadrajın iki yanı) + yapraklar
    autumnTree(ctx, 1150, 900, 1.6, t, 831);
    leaves(ctx, t, 12, 87, [-40, 0, 1160, 1500], 1.8, .9);
    vignette(ctx, .25);
    finish(ctx);
  });

  /* ================= RAPOR (p7-b reportPage ile aynı sayfa) ================= */
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
      const gx = 120, gy = 520, gw = 520, gh = 330;
      C.seed(3011); stroke(c, [[gx, gy - gh], [gx, gy], [gx + gw, gy]], 4, INK_OLD, .9);
      for (let q = 0; q <= 4; q++) { const x = gx + q * gw / 4; C.seed(3020 + q); stroke(c, [[x, gy], [x, gy + 12]], 3, INK_OLD, .8); C.handwrite(c, String(1985 + q * 10), x - 34, gy + 46, 24, INK_OLD, 310 + q); }
      for (let q = 1; q <= 3; q++) { const y = gy - q * gh / 3.2; C.seed(3030 + q); stroke(c, [[gx - 12, y], [gx, y]], 3, INK_OLD, .8); C.handwrite(c, q * 2 + '', gx - 44, y + 9, 24, INK_OLD, 320 + q); }
      C.handwrite(c, 'mm', gx - 52, gy - gh - 14, 24, INK_OLD, 330);
      const pts = []; for (let q = 0; q <= 40; q++) { const u = q / 40, v = .03 + .97 * (Math.exp(u * 2.6) - 1) / (Math.exp(2.6) - 1); pts.push([gx + u * gw, gy - v * gh * .92 + (rnd(3500 + q) - .5) * 6]); }
      pts.forEach(([x, y], q) => { if (q % 4 === 0) { c.fillStyle = INK_OLD; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); } });
      C.seed(3040); stroke(c, smooth(pts.filter((p, q) => q % 4 === 0), 4), 3.4, INK_OLD, .9);
      const lp = pts[40]; C.seed(3041); stroke(c, C.ell(lp[0], lp[1], 26, 22, 18), 3.4, '#b8322a', .9);
      C.handwrite(c, 'still moving', gx + gw - 230, gy - gh + 40, 26, '#b8322a', 340);
      const sx = 120, sy = 640; C.handwrite(c, 'section A-A', sx, sy - 14, 24, INK_OLD, 350);
      C.seed(3050); C.shape(c, [[sx, sy], [sx + 480, sy], [sx + 480, sy + 70], [sx, sy + 70]], 'rgba(58,48,38,.08)', { lw: 3, ink: INK_OLD, amp: .6 });
      for (let q = 0; q < 5; q++) { const x = sx + 40 + q * 100; C.seed(3060 + q); C.shape(c, [[x, sy + 70], [x + 30, sy + 70], [x + 30, sy + 230], [x, sy + 230]], 'rgba(58,48,38,.06)', { lw: 2.6, ink: INK_OLD, amp: .5 }); }
      C.seed(3070); stroke(c, [[sx - 30, sy - 4], [sx + 520, sy - 4]], 2, INK_OLD, .5);
      for (let q = 0; q < 16; q++) { C.seed(3080 + q); stroke(c, [[sx - 20 + q * 34, sy + 260], [sx - 4 + q * 34, sy + 244]], 1.6, INK_OLD, .5); }
    });
    ctx.drawImage(pg, -30, -30);
    const sx = 120, sy = 640, cp = [[sx + 300, sy], [sx + 292, sy + 18], [sx + 306, sy + 34], [sx + 296, sy + 52], [sx + 310, sy + 70], [sx + 302, sy + 98], [sx + 318, sy + 124], [sx + 310, sy + 150]];
    const L = 2 + crack * (cp.length - 2), n = Math.floor(L), fr = L - n, pp = cp.slice(0, n);
    if (n < cp.length) pp.push([lerp(cp[n - 1][0], cp[n][0], fr), lerp(cp[n - 1][1], cp[n][1], fr)]);
    C.seed(3090); stroke(ctx, pp, 4, INK_OLD, .95);
    // dallar (çatlak yan kolları), çatlak ilerledikçe
    if (crack > .55) { C.seed(3091); stroke(ctx, [[sx + 296, sy + 52], [sx + 276, sy + 62], [sx + 262, sy + 60]].slice(0, 2 + (crack > .7 ? 1 : 0)), 3, INK_OLD, .9); }
    if (crack > .8) { C.seed(3092); stroke(ctx, [[sx + 302, sy + 98], [sx + 326, sy + 104], [sx + 340, sy + 118]], 3, INK_OLD, .9); }
  }
  function defneHand(ctx, x, y, rot, o) {   // p7-b ile aynı (krem gömlek kolu)
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(o.s || 1, o.s || 1); C.seed(3610);
    C.shape(ctx, [[30, 40], [120, 10], [700, 300], [600, 420]], P.shirt, { lw: 6, shade: c => C.blot(c, [[60, 60], [700, 340], [620, 430], [40, 90]], P.shirtDk, .6) });
    C.shape(ctx, [[60, 0], [140, -24], [168, 60], [92, 92]], P.shirtDk, { lw: 5 });
    C.shape(ctx, [[-50, -40], [20, -50], [80, -10], [90, 50], [40, 70], [-30, 50], [-60, 0]], P.dSkin, { lw: 6, shade: c => C.blot(c, [[10, 20], [100, 20], [100, 80], [10, 80]], P.dSkinDk, .5) });
    C.line(ctx, [[-40, -20], [10, -6]], 3, P.dSkinDk, .3); C.line(ctx, [[-36, 10], [16, 22]], 3, P.dSkinDk, .3);
    ctx.restore();
  }

  /* --- 6: "Grandpa's reports say the foundation is cracking." rapor: çizelgeden temel kesitine iner; çatlak uzar --- */
  shot('p8a06-rapor', k => k.rep, k => k.years, (ctx, t, u) => {
    const k = times(), tw = twos(t), d = E.ioC(seg(t, k.rep, k.crack + .5));
    ctx.save(); ctx.translate(540, 820);
    const z = lerp(1.2, 1.75, d) + .04 * seg(t, k.crack + .5, k.years); ctx.scale(z, z); ctx.rotate(-.03);
    ctx.translate(-lerp(380, 430, d), -lerp(330, 740, d));
    ctx.save(); ctx.translate(350, 470); deskTop(ctx); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(10,5,2,.3)'; ctx.fillRect(14, 16, 710, 950); ctx.restore();
    reportPage(ctx, lerp(.5, 1, E.io(seg(t, k.crack, k.crackEnd))));
    // Defne'nin parmağı çatlağın ucunu gösterir
    const hu = E.outC(seg(tw, k.crack + .6, k.crack + 1.1));
    if (hu > 0) defneHand(ctx, 420 + 60 + (1 - hu) * 300, 640 + 170 + (1 - hu) * 260, 1.0, { s: .55 });
    ctx.restore();
    vignette(ctx, .32);
    finish(ctx);
  });

  /* --- 7: "A little more every year." yıllık sayfalar çevrilir: 1985 → 2025, kesitteki çatlak her sayfada uzar --- */
  const YEARS = [[1985, '0.2 mm', .14], [1995, '0.6 mm', .3], [2005, '1.4 mm', .5], [2015, '2.9 mm', .74], [2025, '5.9 mm', 1]];
  function yearSheet(i) {
    return cached('yil' + i, 820, 1040, c => {
      c.translate(30, 30); const [yr, mm, f] = YEARS[i]; C.seed(3300 + i);
      C.shape(c, [[0, 0], [760, 0], [760, 980], [0, 980]], '#ece3cc', { lw: 3.6, amp: .7, shade: cc => {
        cc.strokeStyle = 'rgba(31,79,224,.10)'; cc.lineWidth = 1; for (let y = 60; y < 980; y += 28) { cc.beginPath(); cc.moveTo(0, y); cc.lineTo(760, y); cc.stroke(); }
        cc.strokeStyle = 'rgba(190,60,50,.25)'; cc.beginPath(); cc.moveTo(76, 0); cc.lineTo(76, 980); cc.stroke();
        for (let q = 0; q < 10; q++) { cc.fillStyle = `rgba(160,118,62,${.05 + rnd(3600 + q + i * 20) * .1})`; cc.beginPath(); cc.arc(rnd(3700 + q + i * 20) * 760, rnd(3800 + q + i * 20) * 980, 4 + rnd(3900 + q) * 10, 0, TAU); cc.fill(); }
      } });
      handNum(c, String(yr), 110, 70, 120, 7, INK_OLD, 4000 + i * 50, .95);
      C.handwrite(c, 'No. 9 - spring check', 116, 250, 30, INK_OLD, 410 + i);
      // kesit: döşeme + 5 kazık + zemin taraması
      const sx = 110, sy = 380; C.seed(3350 + i);
      C.shape(c, [[sx, sy], [sx + 560, sy], [sx + 560, sy + 90], [sx, sy + 90]], 'rgba(58,48,38,.08)', { lw: 3.4, ink: INK_OLD, amp: .6 });
      for (let q = 0; q < 5; q++) { const x = sx + 50 + q * 115; C.seed(3360 + q); C.shape(c, [[x, sy + 90], [x + 36, sy + 90], [x + 36, sy + 300], [x, sy + 300]], 'rgba(58,48,38,.06)', { lw: 2.8, ink: INK_OLD, amp: .5 }); }
      C.seed(3370); stroke(c, [[sx - 30, sy - 4], [sx + 600, sy - 4]], 2, INK_OLD, .5);
      for (let q = 0; q < 18; q++) { C.seed(3380 + q); stroke(c, [[sx - 20 + q * 36, sy + 330], [sx - 2 + q * 36, sy + 312]], 1.6, INK_OLD, .5); }
      // çatlak: döşemeden kazığa, yıl yıl uzar
      const cp = [[sx + 360, sy], [sx + 350, sy + 22], [sx + 366, sy + 44], [sx + 354, sy + 66], [sx + 370, sy + 90], [sx + 362, sy + 130], [sx + 380, sy + 170], [sx + 370, sy + 220], [sx + 384, sy + 270]];
      const L = 1 + f * (cp.length - 1), n = Math.floor(L), fr = L - n, pp = cp.slice(0, n);
      if (n < cp.length) pp.push([lerp(cp[n - 1][0], cp[n][0], fr), lerp(cp[n - 1][1], cp[n][1], fr)]);
      C.seed(3390); stroke(c, pp, 5 + f * 3, INK_OLD, .95);
      if (f > .45) { C.seed(3391); stroke(c, [[sx + 354, sy + 66], [sx + 330, sy + 78], [sx + 312, sy + 74]], 3.4, INK_OLD, .9); }
      if (f > .7) { C.seed(3392); stroke(c, [[sx + 362, sy + 130], [sx + 392, sy + 140], [sx + 410, sy + 158]], 3.4, INK_OLD, .9); }
      // ölçüm
      C.handwrite(c, 'crack:', 120, 790, 40, INK_OLD, 420 + i);
      C.handwrite(c, mm, 270, 790, 52, i === 4 ? '#b8322a' : INK_OLD, 430 + i, { bold: true });
      if (i === 4) { C.seed(3393); stroke(c, C.ell(355, 772, 120, 50, 22), 4, '#b8322a', .9); C.handwrite(c, 'still moving', 400, 880, 34, '#b8322a', 440); }
      // spiral delikleri (üstte)
      for (let q = 0; q < 9; q++) { c.fillStyle = '#3a3026'; c.beginPath(); c.arc(70 + q * 78, 22, 7, 0, TAU); c.fill(); }
    });
  }
  shot('p8a07-yillar', k => k.years, k => k.city, (ctx, t, u) => {
    const k = times(), z = lerp(.98, 1.06, E.io(u));
    ctx.save(); ctx.translate(540, 800); ctx.scale(z, z); ctx.rotate(.02);
    ctx.save(); ctx.translate(0, 0); deskTop(ctx); ctx.restore();
    const FD = .22; let cur = 0; for (let i = 0; i < 4; i++) if (t >= k.flip[i] + FD) cur = i + 1;
    // yığın (alttaki sayfalar biraz aşağıda görünür)
    ctx.save(); ctx.fillStyle = 'rgba(10,5,2,.28)'; ctx.fillRect(-370, -470, 790, 1020); ctx.restore();
    for (let j = 4; j > cur; j--) { if (j > cur + 1) continue; ctx.drawImage(yearSheet(j), -410, -520 + (j - cur) * 6); }
    for (let j = 0; j < 4 - cur; j++) { ctx.fillStyle = j % 2 ? '#e2d8bf' : '#d8cdb2'; ctx.fillRect(-380, 460 + 6 + j * 5, 760, 4); }
    // üstteki sayfa: çevriliyorsa üst kenardan yukarı katlanır
    const fi = cur < 4 ? cur : -1, fu = fi >= 0 ? seg(t, k.flip[fi], k.flip[fi] + FD) : 0;
    const top = yearSheet(cur);
    if (fu <= 0) ctx.drawImage(top, -410, -520);
    else {
      const c = Math.cos(Math.PI * fu);
      ctx.save(); ctx.translate(0, -490); ctx.scale(1, c); ctx.translate(0, 490);
      if (c > 0) ctx.drawImage(top, -410, -520); else { C.seed(3399); C.shape(ctx, [[-380, -490], [380, -490], [380, 490], [-380, 490]], '#d9ceb4', { lw: 3.6 }); }
      ctx.restore();
    }
    // spiral teller
    for (let q = 0; q < 9; q++) { C.seed(3450 + q); stroke(ctx, C.ell(-350 + q * 78, -500, 9, 22, 12, Math.PI * .9, Math.PI * 2.1), 5, '#5a5e66', 1); }
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* ================= BELEDİYE (dış) ================= */
  function cityHall(ctx) {
    const cv = cached('belediye', 1080, 1920, c => {
      C.seed(861);
      const sk = c.createLinearGradient(0, 0, 0, 1100); sk.addColorStop(0, '#87a9c4'); sk.addColorStop(1, '#ecd2a8'); c.fillStyle = sk; c.fillRect(0, 0, 1080, 1100);
      let x = -20, n = 0; while (x < 1100) { const bw = 70 + rnd(8610 + n) * 90, bh = 120 + rnd(8620 + n) * 240; C.shape(c, [[x, 700], [x, 700 - bh], [x + bw, 700 - bh], [x + bw, 700]], P.far, { lw: 2, ink: P.far2, amp: .5 }); x += bw + 6; n++; }
      // gövde
      C.shape(c, [[60, 330], [1020, 330], [1020, 1110], [60, 1110]], '#d9cfba', { lw: 5, shade: g => { for (let y = 360; y < 1110; y += 30) { g.strokeStyle = 'rgba(21,18,13,.07)'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, y); g.lineTo(1020, y); g.stroke(); } C.blot(g, [[820, 320], [1030, 320], [1030, 1120], [860, 1120]], '#b5a98f', .45); } });
      // alınlık
      C.shape(c, [[30, 340], [540, 150], [1050, 340]], '#e6ddca', { lw: 5, shade: g => C.blot(g, [[540, 140], [1060, 340], [700, 340]], '#c8bda5', .4) });
      C.shape(c, [[20, 330], [1060, 330], [1060, 368], [20, 368]], '#c4b89f', { lw: 5 });
      // mühür (izin belgesindeki ile aynı): kule + üç yıldız
      c.save(); c.translate(540, 262); c.strokeStyle = INK_OLD; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 52, 0, TAU); c.stroke(); c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 42, 0, TAU); c.stroke();
      c.fillStyle = INK_OLD; c.fillRect(-12, -16, 24, 36); c.fillRect(-20, 13, 40, 7); for (let i = -1; i <= 1; i++) c.fillRect(i * 9 - 3, -23, 6, 7);
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * .55; c.beginPath(); c.arc(Math.cos(a) * 33, Math.sin(a) * 33 + 2, 3.2, 0, TAU); c.fill(); }
      c.restore();
      // CITY HALL yazısı
      C.shape(c, [[300, 392], [780, 392], [780, 462], [300, 462]], '#efe6d2', { lw: 4 });
      c.font = '700 52px Rubik'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = P.ink; c.fillText('CITY HALL', 540, 430);
      // sütunlar
      [130, 290, 790, 950].forEach(cx0 => { C.shape(c, [[cx0 - 34, 500], [cx0 + 34, 500], [cx0 + 30, 1060], [cx0 - 30, 1060]], '#ece4d3', { lw: 4.4, shade: g => { C.blot(g, [[cx0 + 6, 490], [cx0 + 40, 490], [cx0 + 40, 1070], [cx0 + 10, 1070]], '#c9bfa8', .6); for (let q = -2; q <= 2; q++) { g.strokeStyle = 'rgba(21,18,13,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx0 + q * 11, 510); g.lineTo(cx0 + q * 10, 1050); g.stroke(); } } }); C.shape(c, [[cx0 - 46, 482], [cx0 + 46, 482], [cx0 + 46, 504], [cx0 - 46, 504]], '#d3c8b0', { lw: 4 }); });
      // pencereler
      [[175, 560], [175, 800], [835, 560], [835, 800]].forEach(([wx, wy]) => C.shape(c, [[wx, wy], [wx + 70, wy], [wx + 70, wy + 160], [wx, wy + 160]], '#6e8592', { lw: 4, shade: g => { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(wx + 12, wy, 10, 160); } }));
      // kapı (çift cam)
      C.shape(c, [[400, 640], [680, 640], [680, 1100], [400, 1100]], '#4d4a44', { lw: 5 });
      C.shape(c, [[414, 656], [536, 656], [536, 1100], [414, 1100]], '#7f97a3', { lw: 4, shade: g => { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(436, 650, 14, 450); } });
      C.shape(c, [[544, 656], [666, 656], [666, 1100], [544, 1100]], '#7f97a3', { lw: 4, shade: g => { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(566, 650, 14, 450); } });
      C.line(c, [[522, 860], [522, 920]], 6); C.line(c, [[558, 860], [558, 920]], 6);
      // basamaklar + kaldırım + yol
      [[330, 1100, 420], [290, 1132, 500], [250, 1164, 580]].forEach(([x, y, w]) => C.shape(c, [[x, y], [x + w, y], [x + w, y + 32], [x, y + 32]], '#c9c0ae', { lw: 4 }));
      c.fillStyle = '#b9b1a0'; c.fillRect(-20, 1196, 1120, 260); C.line(c, [[-20, 1196], [1100, 1196]], 4);
      for (let x0 = -20; x0 < 1100; x0 += 120) C.line(c, [[x0, 1200], [x0 - 30, 1450]], 2, 'rgba(21,18,13,.25)', .4);
      c.fillStyle = '#6f6a60'; c.fillRect(-20, 1456, 1120, 470); C.line(c, [[-20, 1456], [1100, 1456]], 5);
      for (let i = 0; i < 30; i++) leaf(c, rnd(8700 + i) * 1080, 1210 + rnd(8710 + i) * 640, 12 + rnd(8720 + i) * 10, rnd(8730 + i) * 6, LEAF[i % 5], .5);
    });
    ctx.drawImage(cv, 0, 0);
  }
  /* --- 8: "We took the reports to the city." belediye; Daisy kaldırımda, Kaan ve Defne (dosyayla) kapıya yürür --- */
  shot('p8a08-belediye', k => k.city, k => k.num, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u), z = lerp(1.0, 1.07, e);
    ctx.save(); cam(ctx, z, 520, 900, 540, 900);
    cityHall(ctx);
    autumnTree(ctx, 960, 1220, .9, t, 841);
    C.drawDaisy(ctx, { x: 700, y: 1480, s: .46, seed: 23, beep: 0, mood: 'sleepy', hook: Math.sin(t * 1.2) * .03 });
    const wu = seg(tw, k.city, k.num + .3), step = Math.sin(tw * 15 * Math.PI / 4);
    const kx = lerp(150, 400, wu), dx = lerp(-20, 250, wu);
    // Defne (dosya koltuğunda), arkada
    const dy = 1300 - Math.abs(Math.sin(tw * 15 * Math.PI / 4 + 1)) * 6;
    C.drawDefne(ctx, { x: dx, y: dy, s: .66, seed: 31, expr: 'determined', look: .9, blink: blinkAt(tw, [k.city + .7]) });
    folderClosed(ctx, dx + 50 * .66 * .9, dy - 290 * .66 * .9, .13, .12);
    C.drawKaan(ctx, { pose: 'side', x: kx, y: 1330 - Math.abs(step) * 4, s: .64, step: step * .8, expr: 'determined', seed: 11 });
    leaves(ctx, t, 10, 89, [-40, 0, 1160, 1400], 1.5, 1);
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* ================= BEKLEME SALONU ================= */
  const AR = { x: -320, y: -200, w: 1720, h: 2300 };
  const FL = AR.y + AR.h * .66, WAIN = AR.y + (FL - AR.y) * .55, ROWY = FL + AR.h * .2, CHS = AR.h / 1000 * .9;
  const NUM = { x: AR.x + AR.w * .62, y: AR.y + AR.h * .12, w: AR.w * .26, h: AR.h * .1 };
  const CLOCK = { x: 591, y: 190, r: 85 };
  const SEATX = [540 - 190 * CHS, 540, 540 + 190 * CHS];
  const KAAN = { x: SEATX[0], y: ROWY - (156 - 150) * CHS, s: CHS };
  const DEFNE = { x: SEATX[1], y: ROWY - (156 * CHS - 150 * 2.2 * .9), s: 2.2 };
  const HALE = { x: 540, y: ROWY - (156 - 150) * CHS, s: CHS / 1.04 };
  const numStr = n => String(n).padStart(3, '0');
  function boardNum(t) {   // numaratör: 088, "bir saat"te 101'e akar
    const k = times(); if (t < k.board + .3) return 87; if (t < k.hour + .3) return 88;
    return 88 + Math.floor(13 * clamp((t - k.hour - .3) / (k.look - .2 - k.hour - .3)));
  }
  function floorExt(ctx) {   // salonun alanı dışına taşan zemin/tavan (kamera uzaklaşınca)
    ctx.fillStyle = P.hallDk; ctx.fillRect(-2000, -2000, 5000, 1800 + 2);
    ctx.fillStyle = P.hall; ctx.fillRect(-2000, AR.y, 5000, FL - AR.y);
    ctx.fillStyle = '#d6d1c2'; ctx.fillRect(-2000, FL, 5000, 3000);
    ctx.strokeStyle = 'rgba(21,18,13,.2)'; ctx.lineWidth = 2; for (let yy = AR.y + AR.h; yy < 3200; yy += 90) { ctx.beginPath(); ctx.moveTo(-2000, yy); ctx.lineTo(3000, yy); ctx.stroke(); }
    C.seed(871); C.line(ctx, [[-2000, AR.y], [3000, AR.y]], 4, P.hallDk, .3);
  }
  function wallClock(ctx, minutes) {   // duvar saati (yeni nesne)
    const { x, y, r } = CLOCK; C.seed(881);
    C.shape(ctx, C.ell(x, y, r + 10, r + 10, 26), '#3a3d45', { lw: 4.4 });
    C.shape(ctx, C.ell(x, y, r, r, 26), '#f4f1e6', { lw: 3 });
    for (let q = 0; q < 12; q++) { const a = q / 12 * TAU; ctx.save(); ctx.translate(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8); ctx.rotate(a); ctx.fillStyle = P.ink; ctx.fillRect(-6, -2, q % 3 ? 8 : 14, q % 3 ? 4 : 6); ctx.restore(); }
    const am = minutes / 60 * TAU - Math.PI / 2, ah = (2 + minutes / 60) / 12 * TAU - Math.PI / 2;
    ctx.save(); ctx.strokeStyle = P.ink; ctx.lineCap = 'round';
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ah) * r * .48, y + Math.sin(ah) * r * .48); ctx.stroke();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(am) * r * .74, y + Math.sin(am) * r * .74); ctx.stroke();
    ctx.fillStyle = '#b8322a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.restore();
  }
  function sunPatch(ctx, u, wall) {   // karşı penceredan düşen güneş lekesi; u 0..1 saat ilerledikçe kayar
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .9;
    const x0 = lerp(-260, 420, u), y0 = wall === 'A' ? 380 : 1360, w = 640, h = wall === 'A' ? 720 : 520, sk = wall === 'A' ? 260 : -320;
    ctx.fillStyle = '#fff1c8'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w + sk, y0 + h); ctx.lineTo(x0 + sk, y0 + h); ctx.fill();
    ctx.restore();
  }
  // DUVAR A: numaratör, saat, pano; Kaan + Defne oturur
  function wallA(ctx, t, o) {
    o = o || {}; const k = times();
    floorExt(ctx);
    C.drawWaitingRoom(ctx, Object.assign({ seed: 7, number: numStr(o.num == null ? boardNum(t) : o.num) }, AR));
    wallClock(ctx, o.minutes == null ? 6 : o.minutes);
    if (o.sun != null) sunPatch(ctx, o.sun, 'A');
    // "PLEASE TAKE A NUMBER" küçük tabela (numaratörün altında, sağda)
    ctx.save(); C.seed(883); C.shape(ctx, [[NUM.x + 60, NUM.y + NUM.h + 92], [NUM.x + NUM.w - 60, NUM.y + NUM.h + 92], [NUM.x + NUM.w - 60, NUM.y + NUM.h + 150], [NUM.x + 60, NUM.y + NUM.h + 150]], '#efe6d2', { lw: 3 });
    ctx.font = '700 26px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink; ctx.fillText('PLEASE WAIT', NUM.x + NUM.w / 2, NUM.y + NUM.h + 122); ctx.restore();
    if (o.kaan !== false) {
      const ko = Object.assign({ seed: 11, pose: 'sit', hands: 'knees', seat: false, expr: 'calm', look: 0 }, KAAN, o.kaan || {});
      if (o.kaanHead) kaanTalk(ctx, ko, o.kaanHead[0], o.kaanHead[1]); else C.drawKaan(ctx, ko);
      ticket(ctx, ko.x + 70 * CHS, ko.y - 166 * CHS, .95, -.5, '104');
      C.seed(12); ctx.save(); ctx.translate(ko.x, ko.y); ctx.scale(CHS, CHS); ctx.beginPath(); ctx.ellipse(44, -152, 15, 16, 0, 0, TAU); ctx.fillStyle = P.skin; ctx.fill(); ctx.lineWidth = 3.6; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
    }
    if (o.defne !== false) {
      const dob = Object.assign({ seed: 31, pose: 'sit', seat: false, expr: 'serious', look: 0 }, DEFNE, o.defne || {});
      C.drawDefne(ctx, dob);
      const ds = dob.s * .9; folderClosed(ctx, dob.x, dob.y - 150 * ds, .3, -.06);
      ctx.save(); ctx.translate(dob.x, dob.y + 104 * ds); ctx.scale(ds, ds); [[-22, -280 - 104 - 40], [22, -282 - 104 - 40]].forEach(([hx, hy]) => { ctx.beginPath(); ctx.ellipse(hx * 1.6, hy, 12, 13, 0, 0, TAU); ctx.fillStyle = P.dSkin; ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = P.ink; ctx.stroke(); }); ctx.restore();
    }
  }
  // Kaan başını eğerek/çevirerek (boyundan bölünür; p7-b drawDefneTalk yöntemi)
  function kaanTalk(ctx, o, headRot, headDy) {
    const s = o.s, neck = o.y - (o.pose === 'sit' ? 300 : 404) * s;
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, neck, 9000, 9000); ctx.clip(); C.drawKaan(ctx, o); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, -9000, 9000, neck + 9000 + 1); ctx.clip();
    ctx.translate(o.x, neck + (headDy || 0)); ctx.rotate(headRot || 0); ctx.translate(-o.x, -neck); C.drawKaan(ctx, o); ctx.restore();
  }
  // DUVAR B: pencere (dışarıda sonbahar sokağı + Daisy), aynı sandalye sırası; Hale ortada
  function windowView(ctx, t) {
    const x0 = 170, y0 = 90, x1 = 910, y1 = 590;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#87a9c4'); g.addColorStop(1, '#ecd2a8'); ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    C.seed(891); let x = x0 - 10, n = 0;
    while (x < x1) { const bw = 80 + rnd(8910 + n) * 90, bh = 120 + rnd(8920 + n) * 200; C.shape(ctx, [[x, 520], [x, 520 - bh], [x + bw, 520 - bh], [x + bw, 520]], n % 2 ? '#c9b79a' : '#b9a78c', { lw: 2.4, shade: c => { for (let yy = 520 - bh + 20; yy < 500; yy += 40) for (let xx = x + 12; xx < x + bw - 16; xx += 30) { c.fillStyle = '#6e8592'; c.fillRect(xx, yy, 14, 20); } } }); x += bw + 4; n++; }
    ctx.fillStyle = '#b9b1a0'; ctx.fillRect(x0, 520, x1 - x0, 20); ctx.fillStyle = '#6f6a60'; ctx.fillRect(x0, 540, x1 - x0, 60); C.line(ctx, [[x0, 540], [x1, 540]], 2.4);
    autumnTree(ctx, 300, 545, .5, t, 851);
    C.drawDaisy(ctx, { x: 705, y: 566, s: .3, seed: 23, beep: 0, mood: 'sleepy', hook: Math.sin(t * 1.2) * .03 });
    autumnTree(ctx, 880, 560, .42, t, 853);
    leaves(ctx, t, 6, 93, [x0, y0, x1 - x0, y1 - y0], .5, .5);
    ctx.fillStyle = 'rgba(200,220,235,.12)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    C.seed(893);
    C.shape(ctx, [[x0 - 18, y0 - 18], [x1 + 18, y0 - 18], [x1 + 18, y1 + 22], [x0 - 18, y1 + 22]], null, { lw: 6 });
    [0, 1, 2].forEach(q => { const mx = x0 + (x1 - x0) * (q + 1) / 4; C.line(ctx, [[mx, y0], [mx, y1]], 9, '#e8e6dc', .3); C.line(ctx, [[mx - 5, y0], [mx - 5, y1]], 2, P.ink, .3); });
    C.line(ctx, [[x0, (y0 + y1) / 2 - 40], [x1, (y0 + y1) / 2 - 40]], 9, '#e8e6dc', .3);
    C.shape(ctx, [[x0 - 30, y1 + 14], [x1 + 30, y1 + 14], [x1 + 36, y1 + 40], [x0 - 36, y1 + 40]], '#e8e6dc', { lw: 4.4 });   // pencere eşiği
  }
  function wallB(ctx, t, o) {
    o = o || {};
    floorExt(ctx);
    const P0 = AR;
    ctx.save(); ctx.beginPath(); ctx.rect(P0.x, P0.y, P0.w, P0.h); ctx.clip();
    ctx.fillStyle = P.hall; ctx.fillRect(P0.x, P0.y, P0.w, FL - P0.y);
    ctx.fillStyle = '#b8bdb0'; ctx.fillRect(P0.x, WAIN, P0.w, FL - WAIN); C.seed(895); C.line(ctx, [[P0.x, WAIN], [P0.x + P0.w, WAIN]], 3, '#8e938a');
    [.25, .7].forEach(uu => C.shape(ctx, [[P0.x + P0.w * uu - 90, P0.y + 20], [P0.x + P0.w * uu + 90, P0.y + 20], [P0.x + P0.w * uu + 90, P0.y + 36], [P0.x + P0.w * uu - 90, P0.y + 36]], '#f6f7ee', { lw: 3 }));
    ctx.fillStyle = '#d6d1c2'; ctx.fillRect(P0.x, FL, P0.w, P0.y + P0.h - FL);
    ctx.strokeStyle = 'rgba(21,18,13,.2)'; ctx.lineWidth = 2; for (let i = -10; i < 20; i++) { ctx.beginPath(); ctx.moveTo(P0.x + P0.w / 2 + i * 40, FL); ctx.lineTo(P0.x + P0.w / 2 + i * 160, P0.y + P0.h); ctx.stroke(); }
    for (let yy = FL; yy < P0.y + P0.h; yy += (yy - FL) * .35 + 18) { ctx.beginPath(); ctx.moveTo(P0.x, yy); ctx.lineTo(P0.x + P0.w, yy); ctx.stroke(); }
    C.line(ctx, [[P0.x, FL], [P0.x + P0.w, FL]], 3.8, '#8e938a');
    // pencereden zemine düşen ışık
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = '#fff1c8'; ctx.globalAlpha = .8; const su = o.sun == null ? .3 : o.sun;
    ctx.beginPath(); ctx.moveTo(170 + su * 120, FL); ctx.lineTo(910 + su * 120, FL); ctx.lineTo(1100 + su * 300, P0.y + P0.h); ctx.lineTo(60 + su * 300, P0.y + P0.h); ctx.fill(); ctx.restore();
    // su sebili (sol) + saksı (sağ) + ilan
    C.seed(897);
    C.shape(ctx, [[-170, 1318], [-60, 1318], [-60, 900], [-170, 900]], '#e8e6dc', { lw: 4.4 });
    C.shape(ctx, C.ell(-115, 820, 52, 80, 20), '#a9cde0', { lw: 4.4, shade: c => { c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(-150, 760, 12, 110); } });
    C.shape(ctx, [[1120, 1318], [1240, 1318], [1220, 1190], [1140, 1190]], '#b4532f', { lw: 4.4 });
    [[1180, 1100, 70, 120], [1130, 1060, 40, 90], [1230, 1070, 40, 80]].forEach(([px, py, rx, ry], i) => C.shape(ctx, C.ell(px, py, rx, ry, 16), i ? '#6b7a3e' : P.weed, { lw: 4 }));
    C.shape(ctx, [[960, 700], [1180, 700], [1180, 860], [960, 860]], '#efe6d2', { lw: 3 });
    ctx.font = '700 24px Rubik'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.fillText('NO PHONE', 1070, 760); ctx.fillText('CALLS', 1070, 792); ctx.restore();
    windowView(ctx, t);
    // sandalye sırası (A ile aynı)
    ctx.save(); ctx.translate(540, ROWY); ctx.scale(CHS, CHS); C.waitChair(ctx, 0, 0, 3.8, 3); ctx.restore();
    if (o.hale !== false) {
      const ho = Object.assign({ seed: 41, pose: 'sit', seat: false, expr: 'serious', look: 0, phone: false }, HALE, o.hale || {});
      C.drawHale(ctx, ho);
      if (!ho.phone) { const hs = ho.s * 1.04; ticket(ctx, ho.x, ho.y + (-286 + 96) * hs, 1.3, .08, '103'); }
      if (ho.phone && o.glow) {
        const hs = ho.s * 1.04, px = ho.x, py = ho.y + (-292 + 96) * hs;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(px, py - 40, 10, px, py - 160, 300); g.addColorStop(0, `rgba(255,226,122,${.32 * o.glow})`); g.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g; ctx.fillRect(px - 400, py - 600, 800, 800); ctx.restore();
      }
    }
  }

  /* --- 9a: "They told us to take a number…" numara makinesi; Kaan'ın eli fişi koparır --- */
  function dispenser(ctx, x, y, s, pulled) {   // kırmızı numara makinesi (yeni nesne), direk üstünde
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(4201);
    C.line(ctx, [[0, 120], [0, 1400]], 30, P.ink, .2); C.line(ctx, [[0, 120], [0, 1400]], 18, P.steel, .2);
    C.shape(ctx, C.ell(0, 0, 170, 150, 30), '#c8362a', { lw: 7, shade: c => { C.blot(c, C.ell(70, 30, 120, 120, 20), '#94241b', .55); c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(-80, -70, 40, 18, -.5, 0, TAU); c.fill(); } });
    C.shape(ctx, [[-110, -64], [110, -64], [110, -4], [-110, -4]], '#f1e8d4', { lw: 4 });
    ctx.font = '700 30px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink; ctx.fillText('TAKE A', 0, -48 + 8); ctx.restore(); ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.font = '700 30px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink; ctx.fillText('NUMBER', 0, -20 + 2);
    C.seed(4202); C.shape(ctx, [[-70, 50], [70, 50], [70, 76], [-70, 76]], '#15120d', { lw: 3 });
    // dışarı sarkan fiş şeridi: kopunca bir sonraki (105) azıcık görünür
    const out = pulled ? 40 : 150;
    ctx.save(); ctx.beginPath(); ctx.rect(-80, 62, 160, 400); ctx.clip(); ticket(ctx, 0, 62 + out - 42 + 8, 1.0, 0, pulled ? '105' : '104'); ctx.restore();
    ctx.restore();
  }
  shot('p8a09-makine', k => k.num, k => k.board, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.0, 1.06, E.io(u));
    const bg = cached('bg-salonA', 1080, 1920, c => { const tmp = canvas(1080, 1920), g = tmp.getContext('2d'); cam(g, 1.6, 300, 900, 540, 960); wallA(g, 0, { kaan: false, defne: false, num: 88 }); c.filter = 'blur(10px)'; c.drawImage(tmp, -20, -20, 1120, 1960); c.filter = 'none'; });
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + u * .03, 1 + u * .03); ctx.drawImage(bg, -540, -960); ctx.restore();
    ctx.save(); cam(ctx, z, 540, 760, 540, 760);
    const pulled = t >= k.pull;
    dispenser(ctx, 470, 560, 1.25, pulled);
    // el: sağ alttan gelir, fişi tutar, koparır, aşağı çeker
    const inU = E.outC(seg(tw, k.num + .1, k.pull - .2)), pullU = E.outC(seg(tw, k.pull, k.pull + .35)), away = E.inQ(seg(tw, k.pull + .5, k.board));
    const tipX = 470 + 0, tipY = 560 + (62 + 150 - 42 + 8 + 30) * 1.25;
    const hx = lerp(tipX + 520, tipX + 6, inU) + pullU * 60 + away * 400, hy = lerp(tipY + 600, tipY, inU) + pullU * 170 + away * 300;
    if (pulled) ticket(ctx, hx - 4, hy - 30 * 1.25, 1.25, pullU * .25, '104');
    kaanHandPinch(ctx, hx, hy, -.2, 1.1);
    ctx.restore();
    // kopma anında kâğıt kırpıntısı
    if (t >= k.pull && t < k.pull + .3) { const a = 1 - seg(t, k.pull, k.pull + .3); for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(243,236,216,${a})`; ctx.fillRect(560 + (rnd(4300 + i) - .5) * 120 + (t - k.pull) * 200 * (rnd(4310 + i) - .5), 910 + (t - k.pull) * 300 * rnd(4320 + i), 8, 5); } }
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 9b: "…and wait." fiş 104 önde, numaratör 088 arkada (gag): 087 → 088 tık; el hafifçe iner --- */
  shot('p8a09-gag', k => k.board, k => k.sit, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(2.0, 2.1, E.io(u));
    ctx.save(); cam(ctx, z, NUM.x + NUM.w / 2 - 20, NUM.y + NUM.h * .7, 560, 470);
    wallA(ctx, t, { kaan: false, defne: false });
    ctx.restore();
    ctx.fillStyle = 'rgba(7,11,24,.12)'; ctx.fillRect(0, 0, 1080, 1920);
    const dn = E.io(seg(tw, k.board + .8, k.sit)) * 50;
    ctx.save(); ticket(ctx, 330, 940 + dn, 2.4, -.12 + dn * .002, '104'); kaanHandPinch(ctx, 330 - 80, 940 + dn + 90, -.7, 1.0, true); ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 10a: "Mr. Hale…" Kaan ve Defne oturur; Kaan karşıya bakar, şaşırır --- */
  shot('p8a10-oturur', k => k.sit, k => k.hale, (ctx, t, u) => {
    const k = times(), tw = twos(t), settle = (1 - E.outBack(seg(tw, k.sit, k.sit + .3))) * 26, z = lerp(1.22, 1.28, E.io(u));
    const up = tw >= k.sit + .5, sur = tw >= W10(k);
    ctx.save(); cam(ctx, z, 360, 1110, 540, 860);
    wallA(ctx, t, {
      kaan: { y: KAAN.y + settle, expr: sur ? 'surprised' : 'calm', look: up ? 0 : .5, blink: blinkAt(tw, [k.sit + .4]) },
      kaanHead: [up ? 0 : .12, up ? 0 : 10],
      defne: { y: DEFNE.y + settle * .8, expr: sur ? 'serious' : 'calm', look: sur ? -.2 : -.8, blink: blinkAt(tw, [k.sit + .7]) }
    });
    ctx.restore();
    vignette(ctx, .28);
    finish(ctx);
  });
  function W10(k) { return k.hale - .35; }

  /* --- 10b: "…was already there." ters açı: Hale karşı sırada, şapkası başında; pencerede sonbahar, Daisy kaldırımda --- */
  shot('p8a10-hale', k => k.hale, k => k.tix, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.0, 1.1, E.io(u));
    const glance = tw >= k.hale + .9 && tw < k.hale + 1.5;
    ctx.save(); cam(ctx, z, 540, lerp(1000, 980, u), 540, 900);
    wallB(ctx, t, { hale: { expr: 'serious', look: glance ? -.2 : .9, blink: blinkAt(tw, [k.hale + .5, k.hale + 1.7]) } });
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 11: "Waiting too." iki fiş: Hale'in elinde 103, önde Kaan'ın elinde 104 --- */
  shot('p8a11-fisler', k => k.tix, k => k.hour, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.7, 1.8, E.io(u));
    ctx.save(); cam(ctx, z, 560, 1240, 560, 740);
    wallB(ctx, t, { hale: { expr: 'serious', look: .4, blink: blinkAt(tw, [k.tix + .6]) } });
    ctx.restore();
    ctx.save(); ticket(ctx, 250, 1010 + Math.sin(tw * 3) * 3, 2.2, -.18, '104'); kaanHandPinch(ctx, 250 - 70, 1010 + 100, -.8, 1.0, true); ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 12a: "For an hour…" duvar saati döner (bir saat), numaratör akar --- */
  shot('p8a12-saat', k => k.hour, k => k.hour2, (ctx, t, u) => {
    const k = times(), z = lerp(1.3, 1.36, E.io(u)), m = 60 * E.io(seg(t, k.hour + .15, k.look - .1));
    ctx.save(); cam(ctx, z, 860, 230, 540, 560);
    wallA(ctx, t, { kaan: false, defne: false, minutes: 6 + m, sun: seg(t, k.hour, k.look) });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 12b: "…nobody spoke." geniş: ikisi kaskatı; güneş lekesi duvarda kayar; numaratör 101'e varır --- */
  shot('p8a12-sessiz', k => k.hour2, k => k.look, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(.78, .8, E.io(u)), m = 60 * E.io(seg(t, k.hour + .15, k.look - .1));
    const side = tw >= k.hour2 + .5 && tw < k.hour2 + 1.1;
    ctx.save(); cam(ctx, z, 637, 800, 540, 860);
    wallA(ctx, t, {
      minutes: 6 + m, sun: seg(t, k.hour, k.look),
      kaan: { expr: 'tired', look: side ? .9 : 0, blink: blinkAt(tw, [k.hour2 + .3]) },
      defne: { expr: 'serious', look: side ? -.6 : 0, blink: blinkAt(tw, [k.hour2 + .8]) }
    });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 13a: "Then I saw his phone." Kaan yakın: bakışı Hale'in ellerine kayar, kaşları kalkar --- */
  shot('p8a13-bakis', k => k.look, k => k.phone, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(2.5, 2.62, E.io(u)), dn = E.io(seg(tw, k.look + .2, k.phone - .25));
    ctx.save(); cam(ctx, z, KAAN.x + 20, KAAN.y - 360 * CHS, 540, 760);
    wallA(ctx, t, {
      minutes: 66, kaan: { expr: tw >= k.phone - .2 ? 'surprised' : 'tired', look: lerp(0, .7, dn), blink: blinkAt(tw, [k.look + .15]) },
      kaanHead: [-.08 * dn, 10 * dn], defne: { expr: 'serious', look: 0 }
    });
    ctx.restore();
    vignette(ctx, .32);
    finish(ctx);
  });

  /* --- 13b: Hale'in ellerinde telefon; ekran ışığı yüzünde; yavaş itme (B ekranı açar) --- */
  shot('p8a13-telefon', k => k.phone, k => k.end, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.85, 2.05, E.io(u));
    ctx.save(); cam(ctx, z, 540, lerp(1220, 1250, E.io(u)), 540, 760);
    wallB(ctx, t, { sun: .75, glow: 1, hale: { expr: 'serious', look: .1, phone: true, blink: blinkAt(tw, [k.phone + .5]) } });
    ctx.restore();
    vignette(ctx, .34);
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const f3 = x => +x.toFixed(3);
  TB.cuesA = {
    get altinParilti() { return f3(times().gold); },                       // harflerde ışık parıltısı (ince, tonlu "ting"; süpürme değil)
    get bina6Darbe() { return f3(times().land[0]); },                      // her biri yumuşak gürleme + 6 kare sarsıntı
    get bina7Darbe() { return f3(times().land[1]); },
    get bina8Darbe() { return f3(times().land[2]); },
    get kalemCizgi6() { return f3(times().strike[0]); },                   // keçeli kalem, satır 6
    get kalemCizgi7() { return f3(times().strike[1]); },
    get kalemCizgi8() { return f3(times().strike[2]); },
    get catlakBaslar() { return f3(times().crack); },                      // kâğıt üstünde kalem (çatlak çizgisi, 1,9 sn)
    get sayfa1995() { return f3(times().flip[0]); },                       // sayfa çevirme ×4
    get sayfa2005() { return f3(times().flip[1]); },
    get sayfa2015() { return f3(times().flip[2]); },
    get sayfa2025() { return f3(times().flip[3]); },
    get belediyeAdim() { return f3(times().city + .1); },                  // kaldırımda iki çift adım (1,9 sn)
    get fisKopar() { return f3(times().pull); },                           // numara fişi koparılır (kâğıt yırtılma)
    get numarator087_088() { return f3(times().board + .3); },             // numaratör tık (ding DEĞİL; ding B'de, Hale'in numarası)
    get oturma() { return f3(times().sit); },                              // plastik sandalyeye oturma
    get saatHizli() { return f3(times().hour + .15); },                    // hızlı tik-tak (saat ilerler) ~2 sn
    get numaratorAkar() { return f3(times().hour + .3); },                 // 088→101 hafif tıkırtılar
    get telefonIsik() { return f3(times().phone); }                        // telefon ekranı (sessiz; yalnız oda tonu)
  };
})();
