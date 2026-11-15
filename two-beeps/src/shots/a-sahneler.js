/* Animatör A: 0 – 23.15 sn (cümle 1–12).
   Bütün kesmeler timeline'dan hesaplanır (cuts()); ses değişirse sahneler kayar.
   Karakterler/eller "ikişerli" (15 poz/sn: q2), kamera/ışık/toz birerli. Rastgelelik yalnız tohumlu. */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const S = i => TB.sentence(i);
  const W = (i, j) => TB.sentence(i).words[j - 1];
  const LEAD = 0.12;                       // kesme, cümleden 4 kare önce
  const q2 = t => Math.floor(t * 15 + 1e-6) / 15;   // ikişerli zaman
  const seg = TB.seg, lerp = TB.lerp, clamp = TB.clamp;

  // ---------- kesmeler (timeline'dan) ----------
  function cuts() {
    return {
      a01: 0,
      a02: S(2).t0 - LEAD, a03: S(3).t0 - LEAD, a04: S(4).t0 - LEAD, a05: S(5).t0 - LEAD,
      a06: S(6).t0 - LEAD, a07: S(8).t0 - LEAD, a08: S(10).t0 - LEAD, a09: S(11).t0 - LEAD,
      a10: S(12).t0 - LEAD,
      end: (S(12).t1 + S(13).t0) / 2          // 23.15: gece odasına sert kesme (B)
    };
  }
  const K = k => cuts()[k];
  const NEXT = { a01: 'a02', a02: 'a03', a03: 'a04', a04: 'a05', a05: 'a06', a06: 'a07', a07: 'a08', a08: 'a09', a09: 'a10', a10: 'end' };
  function shot(id, draw) {
    TB.shot({ id, get t0() { return K(id); }, get t1() { return K(NEXT[id]); }, draw });
  }

  // ---------- küçük yardımcılar ----------
  const cam = (ctx, fx, fy, z) => { ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-fx, -fy); };
  // punch: kesmeden sonra ilk ~5 karede 1.0'a oturan "pat" ölçeği
  const punch = (t, t0, amt, dur) => 1 + (amt || .08) * (1 - E.outC(seg(t, t0, t0 + (dur || .18))));
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

  // ---------- el yazısı rakamlar (dedenin eli) ----------
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
  // h: rakam yüksekliği; (x,y) sol üst. Döner: genişlik.
  function hand_num(ctx, str, x, y, h, lw, col, sd, alpha) {
    const sc = h / 1.6; let cx = x;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '.') { ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + lw * .6, y + h - lw * .5, lw * .75, 0, TAU); ctx.fill(); ctx.restore(); cx += lw * 2.6; continue; }
      const d = DIG[ch]; if (!d) { cx += sc * .5; continue; }
      C.seed(sd + i * 13 + ch.charCodeAt(0));
      const sl = .12; // sağa yatık el yazısı
      const pts = (ch === '0' ? d.concat([d[0]]) : smooth(d, 5)).map(([u, v]) => [cx + (u + (1.6 - v) * sl) * sc, y + v * sc]);
      stroke(ctx, pts, lw, col, alpha);
      cx += sc * (ch === '1' ? .78 : 1.08);
    }
    return cx - x;
  }
  // karalama el yazısı (okunmaz bitişik yazı): trokoid döngüler
  function scrawl(ctx, x, y, len, lw, col, sd, alpha) {
    const r = TB.rand; let cx = x, w = 0;
    while (cx < x + len) {
      const nL = 2 + Math.floor(r(sd + w * 7) * 6), pts = [];
      let th = 0; const base = y + (r(sd + w * 11) - .5) * 4;
      for (let L = 0; L < nL; L++) {
        const hh = 10 + r(sd + w * 31 + L * 5) * 10 + (r(sd + w * 17 + L * 3) < .22 ? 16 : 0);
        for (let k = 0; k < 8; k++) {
          const a = th + k / 8 * TAU; const px = cx + a * 2.6 - Math.sin(a) * 7, py = base - hh * (1 - Math.cos(a)) / 2;
          pts.push([px, py]);
        }
        th += TAU;
      }
      pts.push([cx + th * 2.6 + 4, base]);
      C.seed(sd + w * 3);
      stroke(ctx, pts, lw, col, alpha);
      cx += th * 2.6 + 18 + r(sd + w * 5) * 14; w++;
      if (w > 12) break;
    }
  }

  // ---------- ortak sahne parçaları ----------
  const WOOD = '#5e3b1d', WOOD_DK = '#3f2711', WOOD_LT = '#7a5130';
  function table(ctx, x0, y0, x1, y1) {
    ctx.fillStyle = WOOD; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    C.seed(301);
    for (let yy = Math.floor(y0 / 210) * 210; yy < y1; yy += 210) {
      C.line(ctx, [[x0, yy], [x1, yy + 6]], 4, WOOD_DK, 1.5);
      for (let g = 0; g < 7; g++) {
        const gy = yy + 20 + g * 27 + TB.rand(yy + g) * 10, pts = [];
        for (let gx = x0; gx <= x1; gx += 60) pts.push([gx, gy + Math.sin(gx * .006 + g + yy) * 6]);
        stroke(ctx, pts, 2, g % 2 ? WOOD_DK : WOOD_LT, .45);
      }
      // budak
      const kx = x0 + TB.rand(yy * 3 + 1) * (x1 - x0), ky = yy + 100;
      C.seed(yy + 5); C.shape(ctx, C.ell(kx, ky, 26, 11, 16), WOOD_DK, { lw: 0 });
      stroke(ctx, C.ell(kx, ky, 46, 20, 20), 2, WOOD_DK, .5);
    }
  }
  function lampLight(ctx, x, y, r, a) { // sıcak masa lambası ışığı + kenar kararma
    const g = ctx.createRadialGradient(x, y, r * .1, x, y, r);
    g.addColorStop(0, `rgba(255,210,122,${.18 * a})`); g.addColorStop(.55, 'rgba(255,210,122,0)'); g.addColorStop(1, `rgba(10,6,3,${.55 * a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  }
  function vignette(ctx, a) {
    const g = ctx.createRadialGradient(540, 900, 520, 540, 960, 1250); g.addColorStop(0, 'rgba(21,18,13,0)'); g.addColorStop(1, `rgba(21,18,13,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  }
  // sabah avlusu (bacasız): gök, bulut, uzak şehir, çit, zemin
  function yard(ctx, hz, drift, sd) {
    const g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, P.sky0); g.addColorStop(.6, P.sky1); g.addColorStop(1, P.sky2);
    ctx.fillStyle = g; ctx.fillRect(-400, -400, 1900, hz + 402);
    C.seed(sd + 1);
    const cloud = (cx, cy, sc) => { ctx.fillStyle = P.cloud; ctx.globalAlpha = .9; [[0, 0, 70, 26], [-60, 10, 50, 20], [55, 8, 56, 22], [10, -18, 46, 26]].forEach(([a, b, rx, ry]) => ctx.fill(C.pathOf(C.wobble(C.ell(cx + a * sc, cy + b * sc, rx * sc, ry * sc, 22), true, 2), true))); ctx.globalAlpha = 1; };
    cloud(240 + drift * 30, hz * .3, 1.2); cloud(820 + drift * 18, hz * .48, .85);
    C.seed(sd + 2); let cx = -300; let i = 0;
    while (cx < 1400) {
      const bw = 60 + TB.rand(sd * 9 + i) * 70, bh = 50 + TB.rand(sd * 7 + i) * 150;
      C.shape(ctx, [[cx, hz], [cx, hz - bh], [cx + bw, hz - bh], [cx + bw, hz]], P.far, { lw: 2, ink: P.far2, amp: .5 });
      ctx.fillStyle = P.farWin; for (let yy = hz - bh + 12; yy < hz - 10; yy += 18) for (let xx = cx + 8; xx < cx + bw - 10; xx += 16) if (TB.rand(xx * 3 + yy) < .45) ctx.fillRect(xx, yy, 6, 8);
      cx += bw + 6 + TB.rand(sd + i * 5) * 22; i++;
    }
    const hzg = ctx.createLinearGradient(0, hz - 110, 0, hz); hzg.addColorStop(0, 'rgba(240,226,194,0)'); hzg.addColorStop(1, 'rgba(240,226,194,.7)');
    ctx.fillStyle = hzg; ctx.fillRect(-400, hz - 110, 1900, 112);
    const gg = ctx.createLinearGradient(0, hz, 0, hz + 900); gg.addColorStop(0, P.groundLt); gg.addColorStop(.4, P.ground); gg.addColorStop(1, P.groundDk);
    ctx.fillStyle = gg; ctx.fillRect(-400, hz, 1900, 1500);
    C.seed(sd + 3);
    for (let k = 0; k < 18; k++) { const px = -200 + TB.rand(sd + k * 3) * 1500, py = hz + 30 + TB.rand(sd + k * 7) * 800, r = 30 + TB.rand(k) * 90; C.blot(ctx, C.ell(px, py, r, r * .22, 14), k % 2 ? P.groundDk : P.groundLt, .25); }
    // çit
    const fy = hz + 16;
    ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = P.dustDk; ctx.lineWidth = 1.2;
    for (let fx = -400; fx < 1500; fx += 14) { ctx.beginPath(); ctx.moveTo(fx, fy - 64); ctx.lineTo(fx + 36, fy); ctx.moveTo(fx + 36, fy - 64); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.restore();
    C.seed(sd + 4); C.line(ctx, [[-400, fy - 66], [1500, fy - 62]], 2.4, P.dustDk, .8);
    for (let fx = -370; fx < 1500; fx += 150) C.line(ctx, [[fx, fy - 70], [fx + 1, fy + 2]], 3.4, P.dustDk, .4);
  }
  function grain(ctx) { C.grain(ctx, 0, 0, 1080, 1920, .2); }

  // kart etiketi (dedenin numaralı etiketleri / JOB 1)
  function tag(ctx, x, y, sw, label, sd, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw); const sc = o.s || 1; ctx.scale(sc, sc);
    C.seed(sd); C.line(ctx, [[0, -(o.str || 70)], [0, 0]], 2.4, P.ink, .5);
    const w = o.w || 92, h = o.h || 120;
    C.seed(sd + 1);
    C.shape(ctx, [[-w / 2 + 14, 0], [w / 2 - 14, 0], [w / 2, 16], [w / 2, h], [-w / 2, h], [-w / 2, 16]], '#dcbb7f', {
      lw: 4, shade: c => C.blot(c, [[w * .1, -4], [w / 2 + 6, -4], [w / 2 + 6, h + 6], [w * .2, h + 6]], '#b8955a', .55)
    });
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 14, 6, 0, TAU); ctx.fill();
    if (o.font) {
      ctx.font = `400 ${o.font}px "Lilita One"`; ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.fillText(label, 0, h * .66 + o.font * .32);
    } else {
      const hh = h * .5; ctx.save(); ctx.globalAlpha = 1;
      const tw = label.length * hh / 1.6 * 1.05; hand_num(ctx, label, -tw / 2 - 2, h * .32, hh, 5, P.ink, sd + 3);
      ctx.restore();
    }
    ctx.restore();
  }
  // sarkaç: giriş + sönümlü salınım
  const swing = (t, t0, a0, f) => t < t0 ? a0 : a0 * Math.exp(-(t - t0) * 3.2) * Math.cos((t - t0) * (f || 7));

  // ---------- el (Kaan'ın eli; ucu (x,y), ang yönünü gösterir) ----------
  function drawHand(ctx, o) {
    const s = o.s || 1, lw = 5 / s;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang || 0); ctx.scale(s, s);
    C.seed(o.seed || 71);
    // kol (yeşil ceket kolu + sarı reflektör)
    C.shape(ctx, [[-760, -66], [-248, -60], [-236, 64], [-760, 70]], P.jacket, { lw, shade: c => C.blot(c, [[-760, 24], [-230, 22], [-230, 80], [-760, 80]], '#0b1f2a', .3) });
    C.shape(ctx, [[-286, -62], [-252, -61], [-246, 64], [-282, 66]], P.hazard, { lw: lw * .8 });
    // avuç
    C.shape(ctx, [[-252, -50], [-156, -58], [-114, -40], [-106, 8], [-118, 52], [-204, 60], [-250, 50]], P.skin, { lw, shade: c => C.blot(c, [[-260, 18], [-100, 18], [-100, 70], [-260, 70]], P.skinDk, .55) });
    // kıvrık parmaklar (alt)
    [[-128, 34], [-154, 48], [-182, 54]].forEach(([a, b], i) => { C.shape(ctx, C.ell(a, b, 22, 15, 14), i % 2 ? P.skinDk : P.skin, { lw: lw * .8 }); });
    // işaret parmağı
    const fp = [[-124, -36], [-60, -30], [-18, -24], [-2, -14], [4, 0], [-2, 13], [-20, 19], [-62, 14], [-122, 8]];
    C.shape(ctx, fp, P.skin, { lw, shade: c => C.blot(c, [[-130, 6], [10, 6], [10, 24], [-130, 24]], P.skinDk, .5) });
    C.line(ctx, [[-66, -26], [-62, -10]], lw * .5, P.skinDk, .3);
    if (o.pad) { // parmak ucu kameraya: mavi leke
      if (o.blue) {
        // yamuk, kenarı dağılmış mürekkep lekesi + parmak izi çizgileri
        C.seed(77); const sm = C.shape(ctx, [[-40, -10], [-24, -19], [-6, -15], [3, -3], [-2, 11], [-18, 17], [-36, 10], [-46, 2]], o.blue, { lw: 0, amp: 1.6 });
        ctx.save(); ctx.clip(sm); ctx.strokeStyle = 'rgba(160,190,255,.55)'; ctx.lineWidth = 1.6;
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(-16, 0, 6 + k * 6, 4 + k * 4, 0, Math.PI * .6, Math.PI * 1.9); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = BLUE; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(-54, 6, 3, 0, TAU); ctx.arc(-50, -12, 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    } else {
      C.shape(ctx, [[-34, -22], [-10, -18], [-6, -6], [-30, -8]], '#e2b58f', { lw: lw * .6, amp: .4 });
    }
    // başparmak (üstte)
    C.shape(ctx, [[-214, -50], [-160, -82], [-112, -76], [-112, -58], [-160, -46]], P.skin, { lw });
    ctx.restore();
  }

  // ---------- duman / toz topu ----------
  function puff(ctx, x, y, r, col, alpha, sd) {
    if (r <= 0 || alpha <= 0) return;
    const blobs = [[0, 0, 1], [-.62, .22, .62], [.6, .2, .66], [-.2, -.5, .6], [.34, -.44, .5]];
    ctx.save(); ctx.globalAlpha = alpha; C.seed(sd);
    const ps = blobs.map(([a, b, k], i) => C.pathOf(C.wobble(C.ell(x + a * r, y + b * r, r * k, r * k * .92, 18), true, r * .03, 8), true));
    ctx.strokeStyle = P.ink; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ps.forEach(p => ctx.stroke(p));
    ctx.fillStyle = col; ps.forEach(p => ctx.fill(p));
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x - r * .35, y - r * .42, r * .3, r * .16, -.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // =========================================================
  // LİSTE: kâğıt yerel koordinatı 700×1000. Kat çizgisi y=450 (ikiye katlı), alt kanat 900..1000 (arkaya katlı, 10. satır).
  // =========================================================
  const PAPER = '#eadfc2', PAPER_BK = '#d9caa5', INK_OLD = '#3a3026', BLUE = '#1f4fe0', BLUE_WET = '#3d74ff';
  const LX = 190, LY = 380; // kâğıdın dünya konumu
  const lineY = i => i <= 9 ? 150 + (i - 1) * 84 : 948;
  const lineLen = i => 300 + TB.rand(i * 97 + 3) * 210;
  function paperBase(ctx, y0, y1, back) {
    C.seed(401 + y0);
    C.shape(ctx, [[0, y0], [700, y0], [700, y1], [0, y1]], back ? PAPER_BK : PAPER, {
      lw: 3.2, amp: .8, shade: c => {
        // kenar yaşlanması
        const g = c.createLinearGradient(0, 0, 700, 0); g.addColorStop(0, 'rgba(150,110,60,.22)'); g.addColorStop(.1, 'rgba(150,110,60,0)'); g.addColorStop(.9, 'rgba(150,110,60,0)'); g.addColorStop(1, 'rgba(150,110,60,.25)');
        c.fillStyle = g; c.fillRect(0, y0, 700, y1 - y0);
        if (!back) {
          // kahve halkası + lekeler
          if (y0 < 260) { c.save(); c.globalAlpha = .28; c.strokeStyle = '#a07a45'; c.lineWidth = 7; C.seed(5); c.stroke(C.pathOf(C.wobble(C.ell(565, 190, 74, 70, 30), true, 3, 10), true)); c.restore(); }
          for (let k = 0; k < 22; k++) { const px = TB.rand(k * 5 + 1) * 700, py = TB.rand(k * 9 + 2) * 1000; if (py < y0 || py > y1) continue; c.fillStyle = `rgba(160,118,62,${.08 + TB.rand(k) * .14})`; c.beginPath(); c.arc(px, py, 3 + TB.rand(k * 3) * 10, 0, TAU); c.fill(); }
        } else {
          for (let k = 0; k < 8; k++) { c.fillStyle = 'rgba(120,90,50,.12)'; c.beginPath(); c.arc(TB.rand(k + 50) * 700, y0 + TB.rand(k + 70) * (y1 - y0), 6 + TB.rand(k) * 14, 0, TAU); c.fill(); }
        }
      }
    });
  }
  function listLine(ctx, i) {
    const y = lineY(i);
    hand_num(ctx, i + '.', 34, y - 30, 44, 4.2, INK_OLD, 900 + i * 31, .85);
    scrawl(ctx, i === 10 ? 132 : 122, y + 10, lineLen(i), 3.2, INK_OLD, 1200 + i * 57, .8);
  }
  function header(ctx) {
    // başlık: daire içinde "10" + karalama başlık + alt çizgi
    hand_num(ctx, '10', 52, 40, 54, 5, INK_OLD, 77, .9);
    C.seed(78); stroke(ctx, C.ell(92, 66, 62, 44, 22).concat([[148, 52]]), 3.6, INK_OLD, .8);
    scrawl(ctx, 190, 92, 300, 3.6, INK_OLD, 4400, .85);
    C.seed(79); stroke(ctx, [[186, 108], [360, 104], [520, 110]], 3, INK_OLD, .7);
  }
  // mavi karalama (10. satırın üstü). wet: ıslak parlaklık; glint: parıltı bandı konumu (0..1, <0 yok)
  function blueScratch(ctx, o) {
    const pts = []; const n = 26, x0 = 112, x1 = 640, y = lineY(10) - 4;
    for (let k = 0; k <= n; k++) { const u = k / n; pts.push([x0 + (x1 - x0) * u + (TB.rand(k * 7) - .5) * 14, y + (k % 2 ? -26 : 24) + (TB.rand(k * 3) - .5) * 10]); }
    const pts2 = []; for (let k = 0; k <= 18; k++) { const u = k / 18; pts2.push([x1 - 10 - (x1 - x0 - 30) * u, y + (k % 2 ? 18 : -18) + (TB.rand(k * 11) - .5) * 8]); }
    const all = [pts, pts2, [[x0 - 6, y + 2], [(x0 + x1) / 2, y - 6], [x1 + 8, y + 4]]];
    C.seed(512);
    const paths = all.map((p, i) => C.pathOf(C.wobble(p, false, 1.2, 6), false));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    paths.forEach((p, i) => { ctx.strokeStyle = BLUE; ctx.lineWidth = i === 2 ? 8 : 7; ctx.stroke(p); });
    // ıslak: içte açık mavi parlak çizgi
    if (o.wet) { ctx.globalAlpha = o.wet; paths.forEach(p => { ctx.strokeStyle = BLUE_WET; ctx.lineWidth = 3; ctx.stroke(p); }); ctx.globalAlpha = 1; }
    // parıltı: yalnız mürekkebin üstünde kayan beyaz bant
    if (o.glint != null && o.glint >= 0 && o.glint <= 1) {
      const gx = lerp(x0 - 120, x1 + 120, o.glint), a = Math.sin(Math.PI * o.glint);
      const g = ctx.createLinearGradient(gx - 70, 0, gx + 70, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(235,245,255,${.95 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 4.5; paths.forEach(p => ctx.stroke(p));
    }
    ctx.restore();
    // parmak izi lekesi (dokunulan yerde)
    if (o.smear) {
      ctx.save(); ctx.globalAlpha = .55 * o.smear; C.seed(530);
      C.shape(ctx, [[418, y - 14], [446, y - 18], [470, y - 6], [462, y + 12], [430, y + 14]], '#3f6ae8', { lw: 0, amp: 2 }); ctx.restore();
    }
  }
  // flip: 0 = katlı, 1 = açık. Üst yarı (0..450) kat çizgisinden aşağı katlanmış başlar. Alt kanat (900..1000) arkaya katlı başlar.
  function drawList(ctx, o) {
    o = o || {};
    const half = o.half == null ? 1 : o.half, flap = o.flap || 0;
    // alt yarı
    paperBase(ctx, 450, 900);
    ctx.save(); ctx.beginPath(); ctx.rect(-20, 450, 740, 452); ctx.clip(); for (let i = 5; i <= 9; i++) listLine(ctx, i); ctx.restore();
    // alt kanat (10. satır)
    const cf = -Math.cos(Math.PI * clamp(flap));
    if (cf > 0) {
      ctx.save(); ctx.translate(0, 900 * (1 - cf)); ctx.scale(1, cf);
      paperBase(ctx, 900, 1000);
      ctx.save(); ctx.beginPath(); ctx.rect(-20, 900, 740, 102); ctx.clip(); listLine(ctx, 10); blueScratch(ctx, o); ctx.restore();
      ctx.fillStyle = `rgba(40,25,10,${.35 * (1 - cf)})`; ctx.fillRect(0, 900, 700, 100);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = .35; C.seed(611); C.line(ctx, [[4, 900], [696, 901]], 2, '#8a6a40', .5); ctx.restore();
    } else {
      // katlı kenar: kalın alt kenar çizgisi + gölge
      ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = '#b39b6b'; ctx.fillRect(2, 892, 696, 8); ctx.restore();
    }
    // üst yarı
    const c = -Math.cos(Math.PI * clamp(half));
    const wv = 1 + .07 * Math.sin(Math.PI * clamp(half));
    ctx.save(); ctx.translate(350, 0); ctx.scale(wv, 1); ctx.translate(-350, 0);
    if (c >= 0) {
      ctx.translate(0, 450 * (1 - c)); ctx.scale(1, Math.max(c, .001));
      paperBase(ctx, 0, 450);
      ctx.save(); ctx.beginPath(); ctx.rect(-20, -10, 740, 460); ctx.clip(); header(ctx); for (let i = 1; i <= 4; i++) listLine(ctx, i); ctx.restore();
      ctx.fillStyle = `rgba(40,25,10,${.4 * (1 - c)})`; ctx.fillRect(0, 0, 700, 450);
    } else {
      const h = 450 * -c;
      ctx.save(); ctx.translate(0, 450); ctx.scale(1, -c); paperBase(ctx, 0, 450, true); ctx.restore();
      ctx.fillStyle = `rgba(40,25,10,${.3 * (1 + c)})`; ctx.fillRect(0, 450, 700, h);
    }
    ctx.restore();
    // kat izi
    if (half > .95) { ctx.save(); ctx.globalAlpha = .3; C.seed(612); C.line(ctx, [[4, 450], [696, 452]], 2.2, '#8a6a40', .6); ctx.restore(); }
  }
  // kâğıdın masa üstündeki gölgesi
  function listShadow(ctx, y0, y1, a) {
    ctx.save(); ctx.fillStyle = `rgba(10,5,2,${a == null ? .35 : a})`; C.seed(613);
    ctx.fill(C.pathOf(C.wobble([[14, y0 + 16], [722, y0 + 16], [722, y1 + 18], [14, y1 + 18]], true, 2, 12), true)); ctx.restore();
  }

  // =========================================================
  // a01  "Grandpa left me three things."  Kaan belden yukarı, üç numaralı etiket
  // =========================================================
  shot('a01', (ctx, t) => {
    const t0 = 0, t1 = K('a02'), u = seg(t, t0, t1);
    ctx.save();
    const z = 1 + .035 * E.io(u); cam(ctx, 540, 960 - 20 * u, z);
    yard(ctx, 1240, u, 31);
    // Kaan
    const tq = q2(t), breath = Math.sin(tq * 2.4) * 4;
    const thr = W(1, 4).t0;
    const look = lerp(0, .7, E.outC(seg(tq, thr - .1, thr + .25)));
    const blink = (tq > .9 && tq < 1.0) || (tq > thr + .55 && tq < thr + .65) ? 1 : 0;
    C.drawKaan(ctx, { x: 330, y: 2250 + breath, s: 2.6, expr: 'calm', look, blink, phone: false, seed: 11 });
    ctx.restore();
    // üç etiket: "three" ile sırayla pat diye düşer
    for (let i = 0; i < 3; i++) {
      const ti = thr - .04 + i * .16; if (t < ti) continue;
      const k = E.outBack(seg(t, ti, ti + .2));
      const x = 640 + i * 132, y = lerp(150, 262, k);
      tag(ctx, x, y, swing(q2(t), ti + .1, .28 * (i % 2 ? -1 : 1), 8), String(i + 1), 2000 + i * 17, { s: .95 });
    }
    vignette(ctx, .3); grain(ctx);
  });

  // =========================================================
  // a02  "A crane."  Daisy'nin bomu ve tehlike şeritli kancası, gökte. Etiket 1.
  // =========================================================
  shot('a02', (ctx, t) => {
    const t0 = K('a02'), t1 = K('a03'), u = seg(t, t0, t1);
    const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, P.sky0); g.addColorStop(.7, P.sky1); g.addColorStop(1, P.sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    C.seed(41); ctx.fillStyle = P.cloud; ctx.globalAlpha = .85;
    [[200, 520, 90, 30], [140, 540, 60, 22], [270, 536, 64, 24], [860, 1060, 80, 26], [800, 1076, 50, 18]].forEach(([a, b, rx, ry]) => ctx.fill(C.pathOf(C.wobble(C.ell(a - u * 30, b, rx, ry, 20), true, 2), true)));
    ctx.globalAlpha = 1;
    ctx.save();
    const z = punch(t, t0, .1) * (1 + .04 * u); cam(ctx, 540, 960, z);
    const tq = q2(t);
    const boom = .5 * (1 - E.outBack(seg(t, t0, t0 + .32)));
    const hook = swing(tq, t0 + .22, .34, 6.5) + .03;
    C.drawDaisy(ctx, { x: 860, y: 2020, s: 2.05, boom: -boom, hook, seed: 23 });
    ctx.restore();
    tag(ctx, 800, 250, swing(q2(t), t0, .18, 8), '1', 2000, { s: .8 });
    vignette(ctx, .25); grain(ctx);
  });

  // =========================================================
  // a03  "A debt."  masaya düşen banka mektubu, "debt" ile kırmızı damga. Etiket 2.
  // =========================================================
  const RED = '#c4302a';
  function letter(ctx) {
    C.seed(620);
    C.shape(ctx, [[0, 0], [620, 0], [620, 820], [0, 820]], '#f4efe2', { lw: 4, amp: .7, shade: c => C.blot(c, [[440, -10], [640, -10], [640, 830], [520, 830]], '#ddd4bf', .5) });
    // antet: genel banka (gerçek ad yok)
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
    // gövde metni: gri satırlar
    for (let k = 0; k < 9; k++) { C.seed(630 + k); C.shape(ctx, [[40, 430 + k * 34], [40 + 380 + TB.rand(k + 9) * 150, 430 + k * 34], [40 + 380 + TB.rand(k + 9) * 150, 442 + k * 34], [40, 442 + k * 34]], '#c9c0ad', { lw: 0, amp: .4 }); }
    C.seed(640); C.line(ctx, [[360, 770], [580, 768]], 2.4, P.ink, .4);
  }
  function stamp(ctx, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.rotate(-.2);
    C.seed(650);
    const p = C.pathOf(C.wobble([[-230, -64], [230, -64], [230, 64], [-230, 64]], true, 2, 14), true);
    ctx.strokeStyle = RED; ctx.lineWidth = 10; ctx.stroke(p);
    ctx.lineWidth = 3.5; ctx.save(); ctx.scale(.93, .82); ctx.stroke(p); ctx.restore();
    ctx.fillStyle = RED; ctx.font = '400 84px "Lilita One"'; ctx.textAlign = 'center'; ctx.fillText('FINAL NOTICE', 0, 30);
    // damga pürüzü: kâğıt rengi benekler
    ctx.fillStyle = '#f4efe2';
    for (let k = 0; k < 120; k++) { ctx.globalAlpha = a * (.4 + TB.rand(k) * .6); ctx.beginPath(); ctx.arc((TB.rand(k * 3 + 1) - .5) * 470, (TB.rand(k * 5 + 2) - .5) * 130, .8 + TB.rand(k * 7) * 2.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  shot('a03', (ctx, t) => {
    const t0 = K('a03'), t1 = K('a04'), u = seg(t, t0, t1);
    ctx.save(); cam(ctx, 540, 900, 1 + .05 * E.io(u));
    table(ctx, -300, -300, 1400, 2300);
    // mektup pat diye düşer
    const k = E.outC(seg(t, t0, t0 + .16)), sc = lerp(1.18, 1, k) * 1.2;
    ctx.save(); ctx.translate(540, 900); ctx.rotate(lerp(-.1, .05, k)); ctx.scale(sc, sc); ctx.translate(-310, -410);
    ctx.fillStyle = `rgba(8,4,2,${.45 * k})`; ctx.fillRect(18, 22 + 14 * (1 - k), 620, 820);
    letter(ctx);
    // damga: "debt" kelimesinde
    const ts = W(3, 2).t0;
    if (t >= ts - .1) {
      const ks = seg(t, ts - .1, ts);
      ctx.save(); ctx.translate(320, 560); const ss = lerp(1.7, 1, E.inQ(ks)); ctx.scale(ss, ss);
      stamp(ctx, ks < 1 ? .25 + .45 * ks : 1);
      ctx.restore();
      // damga anında mürekkep sıçraması
      if (t >= ts) { const kk = seg(t, ts, ts + .2); for (let j = 0; j < 7; j++) { const a = j / 7 * TAU + .3, r = 250 + kk * 30; ctx.fillStyle = RED; ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(320 + Math.cos(a) * r, 560 + Math.sin(a) * r * .4, 3 + TB.rand(j) * 4, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    }
    ctx.restore();
    ctx.restore();
    lampLight(ctx, 400, 700, 1300, 1);
    tag(ctx, 800, 250, swing(q2(t), t0, -.2, 8), '2', 2017, { s: .8 });
    grain(ctx);
  });

  // =========================================================
  // a04  "And a list, with one line I'm not allowed to read."  katlı kâğıt düşer, açılır; yavaş itme. Etiket 3.
  // =========================================================
  shot('a04', (ctx, t) => {
    const t0 = K('a04'), t1 = K('a05'), u = seg(t, t0, t1);
    const tu = W(4, 3).t0 - .22;                 // "list" ile açılır
    const half = E.io(seg(q2(t), tu, tu + .5));
    const pu = E.io(seg(t, tu + .3, t1));        // yavaş itme
    const fy = lerp(lerp(1080, 880, E.io(seg(t, tu, tu + .6))), 1010, pu);
    const z = punch(t, t0, .08) * lerp(.98, 1.12, pu);
    ctx.save(); cam(ctx, 540, fy, z);
    table(ctx, -400, -200, 1500, 2400);
    const k = E.outC(seg(t, t0, t0 + .15));
    ctx.translate(LX, LY + 30 * (1 - k));
    const topY = half < .5 ? 450 : 450 - 450 * (-Math.cos(Math.PI * half));
    listShadow(ctx, Math.min(topY, 450), 900, .35 * k);
    drawList(ctx, { half, flap: 0 });
    ctx.restore();
    lampLight(ctx, 500, 760, 1250, 1);
    tag(ctx, 800, 250, swing(q2(t), t0, .2, 8), '3', 2034, { s: .8 });
    grain(ctx);
  });

  // =========================================================
  // a05  "Ten buildings to take down."  daire içindeki "10"dan numaralar boyunca aşağı.
  // =========================================================
  shot('a05', (ctx, t) => {
    const t0 = K('a05'), t1 = K('a06');
    const tt = W(5, 2).t0 - .05;
    const k = E.io(seg(t, tt, t1 - .08));
    // dünya: başlık "10" (LX+92, LY+66) → 9. satır numarası
    const fx = lerp(LX + 200, LX + 250, k), fy = lerp(LY + 150, LY + lineY(9) - 60, k);
    const z = lerp(2.2, 1.55, k) * punch(t, t0, .06);
    ctx.save(); cam(ctx, fx, fy, z);
    table(ctx, -400, -200, 1500, 2400);
    ctx.translate(LX, LY); listShadow(ctx, 0, 900); drawList(ctx, { half: 1, flap: 0 });
    ctx.restore();
    lampLight(ctx, 540, 820, 1150, 1);
    grain(ctx);
  });

  // =========================================================
  // a06  "Nine, in old black ink. / The tenth is scratched out."  parmak 1→9 satırları izler, alt kanadı açar.
  // =========================================================
  function fingerOnList(ctx, camf, px, py, ang, s, o) { // kâğıt noktası → ekran
    const [fx, fy, z] = camf; const sx = 540 + (LX + px - fx) * z, sy = 960 + (LY + py - fy) * z;
    drawHand(ctx, Object.assign({ x: sx, y: sy, ang, s: s * z }, o || {}));
  }
  shot('a06', (ctx, t) => {
    const t0 = K('a06'), t1 = K('a07'), u = seg(t, t0, t1);
    const tq = q2(t);
    const s6 = S(6), s7 = S(7);
    const tf0 = W(7, 2).t0 - .1, tf1 = W(7, 4).t0 + .1;  // "tenth" → "scratched": kanat açılır
    const flap = E.io(seg(tq, tf0, tf1));
    const pu = E.io(u);
    const camf = [lerp(LX + 360, LX + 380, pu), lerp(LY + 560, LY + 860, pu), lerp(1.12, 1.55, pu)];
    ctx.save(); cam(ctx, camf[0], camf[1], camf[2]);
    table(ctx, -400, -200, 1500, 2400);
    ctx.translate(LX, LY); listShadow(ctx, 0, 900 + 100 * flap); drawList(ctx, { half: 1, flap, wet: .6 });
    ctx.restore();
    // parmak: 1'den 9'a iner (sentence 6), sonra kanat kenarını çeker (7), sonra çekilir
    const trace = E.io(seg(tq, s6.t0, s6.t1 + .1));
    const inA = E.outC(seg(tq, t0, s6.t0 + .1));
    let px = lerp(860, 128, inA), py = lerp(lineY(1) - 10, lineY(9) - 10, trace);
    let ang = Math.PI * .86;
    const toFlap = E.io(seg(tq, s6.t1 + .15, tf0));
    px = lerp(px, 300, toFlap); py = lerp(py, 908, toFlap); ang = lerp(ang, Math.PI * .62, toFlap);
    if (tq >= tf0) py = 900 + 100 * (-Math.cos(Math.PI * flap) > 0 ? -Math.cos(Math.PI * flap) : 0) + 8;
    const away = E.io(seg(tq, tf1 + .25, tf1 + .7));
    px = lerp(px, 760, away); py = lerp(py, 1000, away);
    fingerOnList(ctx, camf, px, py, ang, .9, { seed: 71 });
    lampLight(ctx, 540, 820, 1200, 1);
    grain(ctx);
  });

  // =========================================================
  // a07  "In blue. / And the blue is fresh."  karalamaya yakın plan; parmak dokunur, parıltı geçer, mavi parmak ucu.
  // =========================================================
  shot('a07', (ctx, t) => {
    const t0 = K('a07'), t1 = K('a08'), u = seg(t, t0, t1);
    const tq = q2(t);
    const tTouch = W(9, 3).t0, tLift = W(9, 4).t0 + .04, tGl = W(9, 5).t0;
    const pu = E.io(u);
    const camf = [lerp(LX + 380, LX + 420, pu), lerp(LY + 948, LY + 940, pu), lerp(2.25, 2.7, pu) * punch(t, t0, .07)];
    const glint = t >= tGl && t < tGl + .42 ? (t - tGl) / .42 : -1;
    const smear = seg(tq, tLift - .02, tLift + .05);
    ctx.save(); cam(ctx, camf[0], camf[1], camf[2]);
    table(ctx, -400, -200, 1500, 2400);
    ctx.translate(LX, LY); listShadow(ctx, 0, 1000); drawList(ctx, { half: 1, flap: 1, wet: .85, glint, smear });
    ctx.restore();
    // parıltı yıldızı (tek sefer, yanıp sönmeden)
    if (glint >= 0) {
      const gp = [540 + (LX + lerp(112 - 120, 640 + 120, glint) - camf[0]) * camf[2], 960 + (LY + lineY(10) - 20 - camf[1]) * camf[2]];
      const a = Math.sin(Math.PI * glint);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.translate(gp[0], gp[1]);
      ctx.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? 6 : 34 * a + 6, an = k / 8 * TAU; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // parmak: girer → dokunur → kalkar → ucu kameraya döner (mavi leke)
    const tIn = S(8).t1 + .05;
    if (tq >= tIn) {
      const inK = E.outC(seg(tq, tIn, tTouch));
      const lift = E.io(seg(tq, tLift, tGl - .02));            // kalkar ve sağa-aşağı çekilir: parıltı açıkta geçer
      const show = E.outC(seg(tq, tGl + .4, tGl + .8));        // parmak ucu (mavi) kameraya gelir
      // dokunma noktası (ekran)
      const tx = 540 + (LX + 444 - camf[0]) * camf[2], ty = 960 + (LY + lineY(10) - 6 - camf[1]) * camf[2];
      let x = lerp(1300, tx, inK), y = lerp(ty + 200, ty, inK), ang = Math.PI * .85, s = 1.6, pad = false;
      x = lerp(x, 1250, lift); y = lerp(y, ty + 420, lift);
      if (show > 0) { x = lerp(1250, 770, show); y = lerp(1500, 560, show); ang = Math.PI * 1.36; s = 2.7; pad = true; }
      drawHand(ctx, { x, y, ang, s, pad, blue: tq >= tLift ? BLUE : null, seed: 71 });
    }
    lampLight(ctx, 540, 900, 1100, 1);
    grain(ctx);
  });

  // =========================================================
  // a08  "The crane is called Daisy."  Daisy avluya kameraya doğru gelir, durur, yaylanır.
  // =========================================================
  function dustAt(ctx, x, y, t, ts, sd, sc) {
    const k = seg(t, ts, ts + 1.1); if (k <= 0 || k >= 1) return;
    for (let j = 0; j < 3; j++) puff(ctx, x + (j - 1) * 50 * sc - k * 40 * sc * (j - 1) * -1, y - k * 30 * sc - j * 6, (26 + 50 * E.outC(k)) * sc * (1 - j * .2), P.dustLt, .9 * (1 - k), sd + j);
  }
  shot('a08', (ctx, t) => {
    const t0 = K('a08'), t1 = K('a09'), u = seg(t, t0, t1);
    const tq = q2(t);
    const tStop = W(10, 4).t0;                    // "called" anında durur
    const arr = E.outC(seg(tq, t0, tStop));
    const rock = Math.sin(Math.max(0, tq - tStop) * 14) * Math.exp(-Math.max(0, tq - tStop) * 4) * (tq > tStop ? 1 : 0);
    ctx.save(); cam(ctx, 540, 960, 1 + .03 * E.io(u));
    yard(ctx, 1000, 1 + u, 37);
    const s = lerp(.5, .92, arr), x = lerp(700, 520, arr), y = lerp(1040, 1150, arr) + Math.abs(Math.sin(tq * 22)) * 4 * (1 - arr);
    // fren yaylanması: burun öne eğilir
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, 0, 1 - rock * .025, 0, 0); ctx.translate(-x, -y + rock * 6);
    C.drawDaisy(ctx, { x, y, s, seed: 23, hook: Math.sin(Math.max(0, tq - tStop) * 6) * Math.exp(-Math.max(0, tq - tStop) * 2) * .25 + (1 - arr) * .12 });
    ctx.restore();
    dustAt(ctx, x - 90 * s, y, t, tStop - .05, 900, s * .7);
    dustAt(ctx, x + 90 * s, y, t, tStop, 910, s * .7);
    ctx.restore();
    vignette(ctx, .25); grain(ctx);
  });

  // =========================================================
  // a09  "She is older than my dad, and she hates mornings."  kabine yakın: cıvata düşer; motor iki kez öksürür, duman topu.
  // =========================================================
  function coughOffset(t, tc) { // y sıçrama + titreme (ikişerli)
    const d = t - tc; if (d < 0 || d > .5) return [0, 0, 0];
    const up = d < .1 ? -16 * Math.sin(d / .1 * Math.PI) : 0;
    const sh = d < .45 ? (Math.floor(d * 15) % 2 ? 1 : -1) * 5 * (1 - d / .45) : 0;
    return [sh, up, d < .07 ? 1 : 0];
  }
  shot('a09', (ctx, t) => {
    const t0 = K('a09'), t1 = K('a10'), u = seg(t, t0, t1);
    const tq = q2(t);
    const tBolt = W(11, 3).t0, tC1 = W(11, 9).t0 + .02, tC2 = W(11, 10).t0 + .06, tC3 = S(11).t1 + .08;
    ctx.save(); cam(ctx, 540, 960, (1 + .05 * E.io(u)) * punch(t, t0, .05));
    yard(ctx, 1130, 2 + u, 37);
    const s = 1.55, bx = 470, by = 1200;
    let ox = 0, oy = 0, sq = 0;
    [tC1, tC2, tC3].forEach((tc, i) => { const [a, b, c] = coughOffset(tq, tc); const m = i === 2 ? 1.5 : 1; ox += a * m; oy += b * m; sq = Math.max(sq, c); });
    ctx.save(); ctx.translate(bx + ox, by + oy); ctx.scale(1 + sq * .03, 1 - sq * .04); ctx.translate(-bx, -by);
    C.drawDaisy(ctx, { x: bx, y: by, s, seed: 23, hook: Math.sin(tq * 2) * .03 });
    ctx.restore();
    // cıvata: aynadan düşer, yerde zıplar ("older than my dad")
    if (tq >= tBolt) {
      const d = tq - tBolt, gx = bx - 158 * s, gy0 = by - 204 * s, gy1 = by + 10;
      const fall = Math.min(1, d / .42); let y = lerp(gy0, gy1, fall * fall), x = gx - d * 30;
      if (d > .42) { const b = d - .42; y = gy1 - Math.max(0, Math.sin(b * 9) * 26 * Math.exp(-b * 6)); }
      ctx.save(); ctx.translate(x, y); ctx.rotate(d * 9); C.seed(940);
      C.shape(ctx, [[-9, -6], [9, -6], [9, 6], [-9, 6]], P.steelLt, { lw: 3.4, amp: .3 }); C.shape(ctx, [[-4, -6], [4, -6], [4, -20], [-4, -20]], P.steel, { lw: 3, amp: .3 });
      ctx.restore();
    }
    // duman topları (kabin arkasından)
    const ex = bx + (122 + .55 * 150) * s, ey = by + (-332 - .22 * 150) * s;
    [[tC1, .7, 960], [tC2, .85, 961], [tC3, 1.25, 962]].forEach(([tc, m, sd]) => {
      const d = t - tc; if (d < 0 || d > 2.6) return;
      const k = E.outC(Math.min(1, d / 1.4));
      const r = (40 + 110 * k) * m, a = d < 1.6 ? 1 : 1 - (d - 1.6) / 1;
      puff(ctx, ex + 30 * k * m + d * 40, ey - 150 * k * m - d * 30, r, P.dust, a * .95, sd);
    });
    ctx.restore();
    vignette(ctx, .25); grain(ctx);
  });

  // =========================================================
  // a10  "Job one: an old chimney, in an empty lot."  geniş plan: boş arsa, baca, çit. "JOB 1" etiketi.
  // =========================================================
  shot('a10', (ctx, t) => {
    const t0 = K('a10'), t1 = K('end'), u = seg(t, t0, t1);
    const tq = q2(t);
    ctx.save(); cam(ctx, lerp(500, 470, E.io(u)), lerp(980, 1000, E.io(u)), lerp(1.0, 1.08, E.io(u)));
    C.drawBackground(ctx, { x: -60, y: 0, w: 1200, h: 1960, horizon: .58, chimneyX: .4, seed: 5, dust: .3 });
    // savrulan toz zerreleri
    for (let i = 0; i < 26; i++) {
      const px = ((TB.rand(i * 3) * 1300 + t * (40 + TB.rand(i) * 60)) % 1300) - 100, py = 1050 + TB.rand(i * 7) * 260 + Math.sin(t * 2 + i) * 8;
      ctx.fillStyle = `rgba(216,202,176,${.35 + TB.rand(i * 5) * .4})`; ctx.beginPath(); ctx.arc(px, py, 2 + TB.rand(i * 11) * 3.5, 0, TAU); ctx.fill();
    }
    // yuvarlanan kuru ot ("empty lot")
    const tw = W(12, 8).t0 - .5, d = tq - tw;
    if (d > 0) {
      const x = -60 + d * 300, y = 1300 - Math.abs(Math.sin(d * 5)) * 30, r = 34;
      ctx.save(); ctx.translate(x, y); ctx.rotate(d * 7); C.seed(980);
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI; C.line(ctx, C.ell(0, 0, r, r * (.4 + .6 * Math.abs(Math.cos(a))), 16).map(([px, py]) => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)]), 2.6, '#8b7a4a', .8); }
      ctx.restore();
    }
    ctx.restore();
    // JOB 1 etiketi: "Job one" ile düşer
    const tj = W(12, 1).t0 - .04;
    if (t >= tj) {
      const k = E.outBack(seg(t, tj, tj + .22));
      tag(ctx, 740, lerp(170, 310, k), swing(q2(t), tj + .12, .22, 7), 'JOB 1', 2100, { s: 1, w: 200, h: 110, font: 54, str: 90 });
    }
    vignette(ctx, .25); grain(ctx);
  });

  // ---------- ses ekibi için önemli anlar (sn, timeline'dan) ----------
  const cue = {
    tagsDrop: () => W(1, 4).t0 - .04,                // üç etiket düşer (kâğıt "tık"lar, 0.16 sn arayla 3 kez)
    craneHookSwing: () => K('a02') + .22,            // kanca sallanır (zincir şıkırtısı)
    letterSlap: () => K('a03'),                       // mektup masaya çarpar
    debtStamp: () => W(3, 2).t0,                      // kırmızı damga "güm"
    listSlap: () => K('a04'),                         // katlı liste masaya düşer
    paperUnfold: () => W(4, 3).t0 - .22,              // kâğıt açılır (kagit-hisirti)
    fingerTrace: () => S(6).t0,                       // parmak satırlarda kayar
    flapUnfold: () => W(7, 2).t0 - .1,                // alt kanat açılır, mavi karalama görünür
    blueCloseup: () => K('a07'),                      // "In blue" yakın plan
    fingerTouch: () => W(9, 3).t0,                    // parmak ıslak mürekkebe değer
    inkGlint: () => W(9, 5).t0,                       // ıslak parıltı + ince "tink"
    silenceFrom: () => S(9).t1,                       // 0.8 sn sessizlik (yalnız oda tonu)
    daisyArrive: () => K('a08'),                      // Daisy yaklaşır (rölanti)
    daisyBrake: () => W(10, 4).t0,                    // fren + yaylanma + toz
    boltDrop: () => W(11, 3).t0,                      // aynadan cıvata düşer
    boltClink: () => W(11, 3).t0 + .42,               // cıvata yere değer
    cough1: () => W(11, 9).t0 + .02,                  // motor öksürüğü 1
    cough2: () => W(11, 10).t0 + .06,                 // motor öksürüğü 2
    cough3: () => S(11).t1 + .08,                     // büyük öksürük + duman topu
    lotWide: () => K('a10'),                          // boş arsa: rüzgâr (ortam-bos-arsa-dongu)
    job1Tag: () => W(12, 1).t0 - .04,                 // JOB 1 etiketi düşer
    tumbleweed: () => W(12, 8).t0 - .5,               // kuru ot yuvarlanır
    cutToNight: () => K('end')                        // sert kesme (B)
  };
  TB.cuesA = {};
  Object.keys(cue).forEach(k => Object.defineProperty(TB.cuesA, k, { enumerable: true, get: () => Math.round(cue[k]() * 1000) / 1000 }));
})();
