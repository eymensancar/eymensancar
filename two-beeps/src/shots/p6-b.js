/* Part 6 · IRONLINE — Animatör B: cümle 11–24 + bitiş. Başlangıç (S10.t1+S11.t0)/2 ≈ 23,68 sn, bitiş tl.duration.
   YERLEŞİM (dünya koordinatları; öbür yarı aynısını kullansın):
   - KAFE (yandan, göz hizası): duvar #e9d3a8 / lambri #8a5a34, pencere x 610–1010, y 300–900 (Defne'nin arkasında, sağda; dışarısı
     gri gün, sokak); masa üstü y 1250 (önde, kırmızı-krem), sarkıt lamba (430, 0→250). Defne masanın arkasında oturur:
     drawDefne {x:540, y:1640, s:2.6, pose:'sit', item:'coffee'} (baş ≈ (540, 790)). Kaan karşıda (ters plan): drawKaan sit
     {x:540, y:1660, s:2.4, hands:'knees'}, arkasında kapı + tabela. Patates kutusu masada solda, Defne'nin kahvesi elinde.
   - KABİN (Daisy içi, gece yağmur): C.drawCabin alanı CA {x:0, y:-200, w:1080, h:1920}; Kaan solda (324, 2142) s 3.53 sit/phone,
     Defne sağda (756, 2104) s 3.69 sit; baş merkezleri Kaan ≈ (330, 842), Defne ≈ (756, 897); telefon ≈ (303, 1500).
     Gösterge paneli üst kenarı y ≈ 1528→1490 (soldan sağa). Baret panelin sağında (905, 1520).
   - AVLU GECE (dış): C.drawYard {mode:'rain', seed:7} varsayılan alan; Daisy {x:640, y:1560, s:.8}; ışık dünyada (640, 1283).
   Zamanlar timeline'dan (times()); karakterler ikişerli, kamera/yağmur birerli; tek bipte (endBeep) ışıktan başka hiçbir şey kıpırdamaz. */
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
    const S = i => tl.sentences[i - 1], c = tl.cues;
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const k = {};
    k.start = (S(10).t1 + S(11).t0) / 2;                  // A ile ortak kesme (≈23,68)
    k.stop = W(11, /^stop/i, 4).t0;
    k.cu12 = S(12).t0 - .2;                               // "Before a building did.": yakın
    k.bld = W(12, /^building/i, 2).t0;
    k.down = c.confess + .05;                             // bakış yere
    k.kaan13 = c.confess + .55;                           // Kaan'ın yüzü (sessizlikten sonra)
    k.angry = W(13, /^angry/i, 4).t0;                     // kaşlar çatılır
    k.inhale = S(13).t1 + .05;                            // söze başlayacak: nefes alır
    k.win = S(14).t0 - .25;                               // pencere
    k.drop1 = W(14, /^started/i, 1).t0;                   // ilk damla
    k.drop2 = W(14, /^raining/i, 2).t0;
    k.drop3 = W(14, /^raining/i, 2).t1 - .08;
    k.rain = W(14, /^instead/i, 3).t0;                    // yağmur tam başlar
    k.ext = S(15).t0 - .35;                               // gece, dışarıdan Daisy
    k.cabin = W(15, /^and/i, 5).t0 - .05;                 // kabin içi
    k.lean = W(15, /^shared/i, 6).t0;                     // Defne ekrana eğilir
    k.kids = W(15, /^kids/i, 13).t0;
    k.game = S(16).t0 - .2;                               // telefon (gerçek oyun)
    k.tapK = W(16, /^Master/i, 1).t0 - .2;                // Kaan'ın turu
    k.hand0 = W(16, /^turn/i, 3).t0 - .12;                // telefon el değiştirir
    k.hand1 = k.hand0 + .42;
    k.voice = S(17).t0 - .25;                             // ikili: dede taklidi
    k.brows = W(17, /^Grandpa/i, 2).t0;                   // kaşlar kalınlaşır, çene içeri
    k.finger = S(18).t0 - .35;                            // yakın: parmak kalkar
    k.fingerUp = S(18).t0 - .05;
    k.wag = W(18, /^first/i, 1).t0;
    k.press = S(19).t0 - .2;                              // telefon: düğmeye basış
    k.tapD = W(19, /^press/i, 1).t0 + .1;
    k.eng = S(20).t0 - .1;                                // ikili: "I'll help you finish the list"
    k.helmCU = S(21).t0 - .25;                            // yakın: baret
    k.helmOn = W(21, /^engineer/i, 2).t1 - .05;           // baret başa oturur
    k.knock = k.helmOn + .3;                              // parmak boğumuyla baret "tok"
    k.serious = S(22).t0 - .1;                            // ikili: ciddileşir
    k.sober = W(22, /^serious/i, 3).t0;
    k.truth = S(23).t0 - .2;                              // yakın: Defne
    k.kaanCU = S(24).t0 - .25;                            // yakın: Kaan donar
    k.prof = W(24, /^professor/i, 3).t0;                  // sepya hatıra (P1 "my professor says")
    k.mem0 = k.prof + .08; k.mem1 = k.mem0 + .5;
    k.end = c.voiceEnd + .12;                             // bitiş planı (dış)
    k.endBeep = c.endBeep; k.endCard = c.endCard; k.dur = tl.duration;
    K = k; return k;
  }

  /* Tek bip: daisy-beep.wav ilk tonu 0,04–0,24 sn (6 kare). Bip penceresinde (−0,3 … +0,24+10 kare) her şey donar. */
  const TONES = [[.04, .24], [.37, .57]];
  function beepAt(t, t0, n) {
    const d = t - t0; let v = 0;
    for (let i = 0; i < (n || 2); i++) if (d >= TONES[i][0] - 1e-6 && d < TONES[i][1] - 1e-6) v = i ? 1 : .8;
    return v;
  }
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
  const layers = {};
  function layer(name) { if (!layers[name]) layers[name] = canvas(1080, 1920); const g = layers[name].getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 1080, 1920); return g; }
  function blurred(key, blur, fn) { return cached(key, 1080, 1920, c => { const tmp = canvas(1080, 1920); fn(tmp.getContext('2d')); c.filter = `blur(${blur}px)`; c.drawImage(tmp, 0, 0); c.filter = 'none'; }); }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }
  // Karanlık + ışık delikleri (ekran koordinatı): [x, y, rx, güç, ry]
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
  const SEPIA = 'sepia(1) saturate(.55) brightness(.92) contrast(.92)';        // pilot hatıra karesi
  function memory(ctx, draw) {
    const m = layer('mem'); draw(m);
    ctx.fillStyle = '#2a2118'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.filter = SEPIA; ctx.drawImage(layers.mem, 0, 0); ctx.filter = 'none';
  }
  function limb(ctx, A, B, wa, wb, fill, sd, lw) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    return C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: lw || 6 });
  }
  // konuşma: kelime başlarında küçük baş/gövde vuruşu (ikişerli)
  function talk(t, idx) {
    const tl = TB.tl; let v = 0;
    for (const i of idx) { const s = tl.sentences[i - 1]; if (t < s.t0 - .1 || t > s.t1 + .2) continue; for (const w of s.words) { const d = t - w.t0; if (d >= 0 && d < .35) v = Math.max(v, Math.sin(d / .35 * Math.PI)); } }
    return v;
  }
  const blinkAt = (t, list) => list.some(b => t >= b && t < b + 3 / FPS) ? 1 : 0;

  /* ================= OYUN KARELERİ (gerçek: assets/img/oyun) ================= */
  const GAME_N = 150, gameImgs = [];
  for (let i = 1; i <= GAME_N; i++) gameImgs.push(TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg'));
  // Kurgu: Kaan'ın turu "Shanty" (kare 1 → 55, DEMOLISHED!, 1,5 hız); el değişince kepenk (137 → 150, fabrika ayakta);
  // Defne'nin turu: 150'de bekler ("Plan first"), "press"te basar → 56 → 95 (fabrika devrilir; TIME'S UP'a gelmeden kesilir).
  function gameIdx(t) {
    const k = times(), f = x => Math.floor(x * FPS + 1e-6);
    if (t < k.tapK) return 0;
    if (t < k.hand0 + .2) return Math.min(54, 1 + Math.floor((t - k.tapK) * FPS * 1.5));
    if (t < k.tapD) return Math.min(149, 136 + f(t - (k.hand0 + .2)));
    return Math.min(94, 55 + f(t - k.tapD));
  }
  function gameFrame(t) {
    const im = gameImgs[gameIdx(t)];
    if (im && im.complete && im.naturalWidth > 0) return im;
    return cached('oyun-yok', 450, 800, g => { g.fillStyle = '#2f3a4b'; g.fillRect(0, 0, 450, 800); });
  }
  function frameBright(t) { const i = gameIdx(t); return i >= 1 && i < 30 || i >= 56 && i < 80 ? 1.15 : .9; }

  /* ================= KAFE (yandan) ================= */
  const CF = { wallTop: 0, wainY: 1020, winX: 610, winY: 300, winW: 400, winH: 600, tableY: 1250 };
  function cafeWindow(ctx, t, rainU, opts) {
    const { winX: x, winY: y, winW: w, winH: h } = CF; opts = opts || {};
    C.seed(611);
    const wp = C.shape(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#aeb9bd', { lw: 7 });
    ctx.save(); ctx.clip(wp);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, lerp(0, 1, rainU) > .5 ? '#7d8790' : '#9fb0b8'); g.addColorStop(1, '#c9cfc9'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // sokak: karşı binalar (gri), kaldırım
    C.seed(612);
    for (let i = 0; i < 5; i++) { const bx = x - 20 + i * 96, bh = 180 + rnd(620 + i) * 220; C.shape(ctx, [[bx, y + h * .78], [bx, y + h * .78 - bh], [bx + 88, y + h * .78 - bh], [bx + 88, y + h * .78]], i % 2 ? '#a9a59a' : '#b9b3a4', { lw: 2.5, ink: '#8e8a80' });
      for (let r = 0; r < 4; r++) { ctx.fillStyle = 'rgba(70,80,90,.35)'; ctx.fillRect(bx + 16, y + h * .78 - bh + 26 + r * 46, 20, 26); ctx.fillRect(bx + 52, y + h * .78 - bh + 26 + r * 46, 20, 26); } }
    ctx.fillStyle = '#8f8a80'; ctx.fillRect(x, y + h * .78, w, h * .22);
    ctx.fillStyle = 'rgba(70,74,80,.18)'; ctx.fillRect(x, y, w, h);
    if (rainU > 0) { ctx.save(); ctx.globalAlpha = .55 * rainU; C.rainFx(ctx, { x, y, w, h }, t); ctx.restore(); ctx.fillStyle = `rgba(60,70,82,${.22 * rainU})`; ctx.fillRect(x, y, w, h); }
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(x + w * .1, y); ctx.lineTo(x + w * .3, y); ctx.lineTo(x, y + h * .5); ctx.lineTo(x, y + h * .2); ctx.fill();
    if (opts.drops) opts.drops(ctx);
    ctx.restore();
    C.line(ctx, [[x + w / 2, y], [x + w / 2, y + h]], 9, '#6b4a2c');
    C.line(ctx, [[x, y + h * .42], [x + w, y + h * .42]], 9, '#6b4a2c');
    C.shape(ctx, [[x - 18, y + h], [x + w + 18, y + h], [x + w + 22, y + h + 22], [x - 22, y + h + 22]], '#8a5a34', { lw: 5 });
  }
  function cafeRoom(ctx, t, o) {
    o = o || {};
    ctx.fillStyle = '#e9d3a8'; ctx.fillRect(-400, -400, 1880, CF.wainY + 400);
    C.seed(601); for (let i = 0; i < 8; i++) C.blot(ctx, C.ell(rnd(601 + i) * 1080, rnd(640 + i) * 1000, 90 + rnd(660 + i) * 120, 50, 12), '#d8bf91', .35);
    // lambri
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(-400, CF.wainY, 1880, 1300);
    ctx.strokeStyle = 'rgba(21,18,13,.3)'; ctx.lineWidth = 3; for (let x = -380; x < 1480; x += 70) { ctx.beginPath(); ctx.moveTo(x, CF.wainY + 10); ctx.lineTo(x, 2400); ctx.stroke(); }
    C.line(ctx, [[-400, CF.wainY], [1480, CF.wainY]], 7, '#5e3b1d');
    if (o.side === 'kaan') {
      // Kaan'ın arkası: kapı (camlı) + menü tahtası
      C.seed(621); C.shape(ctx, [[60, 220], [400, 220], [400, 1020], [60, 1020]], '#6f5134', { lw: 6 });
      C.shape(ctx, [[110, 280], [350, 280], [350, 600], [110, 600]], '#b9c3c6', { lw: 5, shade: c => { c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(150, 270, 30, 340); } });
      C.shape(ctx, [[640, 260], [960, 250], [968, 640], [646, 650]], '#2b2f2a', { lw: 6 });
      ctx.save(); ctx.translate(800, 330); ctx.rotate(-.02); ctx.font = '400 54px "Lilita One"'; ctx.textAlign = 'center'; ctx.fillStyle = P.paper; ctx.fillText('MENU', 0, 20);
      ctx.font = '500 30px Rubik'; ['fries ....... 3', 'coffee ..... 2', 'tea ........... 1', 'pie ........... 4'].forEach((s, i) => ctx.fillText(s, 0, 90 + i * 56)); ctx.restore();
    } else {
      cafeWindow(ctx, t, o.rainU || 0);
      // duvarda küçük çerçeve (vinç çizimi)
      C.seed(631); C.shape(ctx, [[140, 360], [390, 350], [394, 560], [144, 570]], P.page, { lw: 5 });
      ctx.save(); ctx.strokeStyle = 'rgba(21,18,13,.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(190, 530); ctx.lineTo(190, 450); ctx.lineTo(260, 450); ctx.lineTo(260, 530); ctx.moveTo(225, 450); ctx.lineTo(340, 390); ctx.lineTo(340, 470); ctx.stroke(); ctx.restore();
    }
    // sarkıt lamba
    C.line(ctx, [[430, -200], [430, 210]], 4, P.ink, .3);
    C.seed(641); C.shape(ctx, [[370, 270], [490, 270], [460, 200], [400, 200]], '#2f6f73', { lw: 5 });
    glow(ctx, 430, 300, 320, '255,210,122', .22);
  }
  function cafeTable(ctx, o) {
    o = o || {};
    C.seed(651);
    C.shape(ctx, [[-60, CF.tableY], [1140, CF.tableY], [1140, CF.tableY + 60], [-60, CF.tableY + 60]], '#c96a3e', { lw: 7, shade: c => C.blot(c, [[-60, CF.tableY + 36], [1140, CF.tableY + 36], [1140, CF.tableY + 66], [-60, CF.tableY + 66]], '#a8532c', .8) });
    ctx.fillStyle = '#5e3b1d'; ctx.fillRect(-60, CF.tableY + 60, 1200, 1200);
    if (o.fries !== false) { // patates kutusu (masanın solunda)
      ctx.save(); ctx.translate(o.side === 'kaan' ? 860 : 190, CF.tableY + 6); C.seed(652);
      for (let i = 0; i < 7; i++) { ctx.save(); ctx.translate(-50 + i * 17, -96 + rnd(653 + i) * 18); ctx.rotate((rnd(660 + i) - .5) * .5); C.shape(ctx, [[-8, -40], [8, -40], [8, 50], [-8, 50]], i % 3 ? P.hazardHi : '#e8b65c', { lw: 3.4 }); ctx.restore(); }
      C.shape(ctx, [[-80, -80], [80, -80], [64, 0], [-64, 0]], P.paper, { lw: 5, shade: c => { c.fillStyle = P.beaconOn; for (let x = -80; x < 80; x += 36) c.fillRect(x, -90, 16, 100); } });
      ctx.restore();
    }
    if (o.letter) { // zarf masada (A'nın 8. cümlesi)
      ctx.save(); ctx.translate(o.side === 'kaan' ? 300 : 760, CF.tableY + 26); ctx.scale(1, .32); C.drawLetter(ctx, { x: 0, y: 0, s: .55, kind: 'envelope', ring: true }); ctx.restore();
    }
  }
  const DF_CAFE = { x: 540, y: 1640, s: 2.6 }, KN_CAFE = { x: 540, y: 1660, s: 2.4 };
  function drawDefneAt(ctx, d) { // Defne, kalçasından eğilebilir
    const piv = [d.x, d.y - 150 * d.s * .9];
    ctx.save(); ctx.translate(piv[0], piv[1]); ctx.rotate(d.lean || 0); ctx.translate(-piv[0], -piv[1] + (d.dy || 0));
    C.drawDefne(ctx, { x: d.x, y: d.y, s: d.s, seed: 31, pose: 'sit', seat: false, expr: d.expr || 'calm', look: d.look || 0, blink: d.blink || 0, item: d.item === undefined ? null : d.item });
    if (d.after) { ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.s * .9, d.s * .9); ctx.translate(0, 104); d.after(ctx); ctx.restore(); }
    ctx.restore();
  }
  function drawKaanAt(ctx, d) {
    const piv = [d.x, d.y - 150 * d.s];
    ctx.save(); ctx.translate(piv[0], piv[1]); ctx.rotate(d.lean || 0); ctx.translate(-piv[0], -piv[1] + (d.dy || 0));
    C.drawKaan(ctx, { x: d.x, y: d.y, s: d.s, seed: 11, pose: 'sit', seat: false, hands: d.hands || 'phone', glow: d.glow || 0, expr: d.expr || 'calm', look: d.look || 0, blink: d.blink || 0 });
    if (d.after) { ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.s, d.s); ctx.translate(0, 104); d.after(ctx); ctx.restore(); }
    ctx.restore();
  }

  /* ================= KABİN (Daisy içi, gece, yağmur) ================= */
  const CA = { x: 0, y: -200, w: 1080, h: 1920, seed: 41 };
  const KC = { x: 324, y: 2142, s: 3.533 }, DC = { x: 756, y: 2104, s: 3.686 };
  const PHONE_W = (() => { const a = .1; return { x: KC.x + (-6) * KC.s, y: KC.y + (104 - 286) * KC.s, rot: -a }; })();
  function phoneScreen(ctx, t, d) { // Kaan'ın elindeki küçük telefona gerçek oyun karesi (drawKaan sit 'phone' yerel koordinatı)
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.s, d.s); ctx.translate(0, 104); ctx.translate(-6, -286); ctx.rotate(-.1);
    ctx.beginPath(); ctx.rect(-12.5, -27.5, 25, 47); ctx.clip(); ctx.drawImage(gameFrame(t), -13, -28, 26.5, 48); ctx.restore();
  }
  function helmetShape(ctx, x, y, sc, rot) { // beyaz baret (Defne'nin; sarı değil)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(sc, sc); C.seed(671);
    C.shape(ctx, [[-70, 0], [-66, -40], [-44, -74], [0, -88], [44, -74], [66, -40], [70, 0]], P.helmet, { lw: 5, shade: c => C.blot(c, [[20, -90], [80, -90], [80, 4], [30, 4]], P.helmetDk, .7) });
    C.shape(ctx, [[-88, 0], [88, 0], [84, 14], [-84, 14]], P.helmetDk, { lw: 4.4 });
    C.line(ctx, [[0, -86], [0, -4]], 3.4, P.helmetDk, .2);
    ctx.restore();
  }
  function cabinScene(ctx, t, o) {
    o = o || {};
    C.drawCabin(ctx, Object.assign({}, CA, { people: false, t, glow: o.glow == null ? 1 : o.glow }));
    // insanlar panelin arkasında (panel üst kenarının altı kırpılır)
    ctx.save(); ctx.beginPath(); ctx.moveTo(-200, -400); ctx.lineTo(1300, -400); ctx.lineTo(1300, CA.y + CA.h * .88 + 6); ctx.lineTo(-200, CA.y + CA.h * .9 + 6); ctx.closePath(); ctx.clip();
    const kd = Object.assign({}, KC, o.kaan || {}), dd = Object.assign({}, DC, o.defne || {});
    drawKaanAt(ctx, kd);
    if (!o.noScreen) phoneScreen(ctx, t, kd);
    drawDefneAt(ctx, dd);
    ctx.restore();
    // panel (öne) yeniden: insanların alt kısmını keser
    C.seed(42); C.shape(ctx, [[CA.x - 10, CA.y + CA.h * .9], [CA.x + CA.w + 10, CA.y + CA.h * .88], [CA.x + CA.w + 10, CA.y + CA.h + 10], [CA.x - 10, CA.y + CA.h + 10]], P.steelDk, { lw: 4 });
    [.2, .32].forEach((u) => C.shape(ctx, C.ell(CA.x + CA.w * u, CA.y + CA.h * .95, 24, 24, 16), '#11151c', { lw: 2.8 }));
    if (o.helmetOnDash) helmetShape(ctx, 905, 1520, 1.05, .08);
  }
  // kabin ışığı: karanlık + telefon/yüz delikleri + sıcak ışık (ekran koordinatı için S dönüştürücü)
  function cabinLight(ctx, t, S, o) {
    o = o || {}; const br = o.br == null ? frameBright(t) : o.br;
    const [px, py] = S(PHONE_W.x, PHONE_W.y), [kx, ky] = S(KC.x + 6 * KC.s, 842), [dx, dy] = S(DC.x, 897), z = S(1, 0)[0] - S(0, 0)[0];
    nightLight(ctx, [[px, py, 560 * z, .95, 420 * z], [kx, ky + 30 * z, 300 * z, .75 * br, 340 * z], [dx, dy + 30 * z, 300 * z, .7 * br, 340 * z], [540, 300, 700, .5, 420]], o.dark == null ? .6 : o.dark);
    glow(ctx, px, py - 60 * z, 520 * z, '255,226,122', .2 * br);
    glow(ctx, (kx + dx) / 2, (ky + dy) / 2 + 80 * z, 520 * z, '255,214,150', .09 * br);
  }

  /* ================= TELEFON YAKIN PLANI (pilotun telefonu) ================= */
  function drawHandSide(ctx, x, y, flip, lw, who) { // telefonu tutan el; who 'kaan' (ceket + sarı bileklik) | 'defne' (krem gömlek)
    const kaan = who !== 'defne', skin = kaan ? P.skin : P.dSkin, skinDk = kaan ? P.skinDk : P.dSkinDk;
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], kaan ? P.jacketDk : P.shirt, { lw, shade: kaan ? null : c => C.blot(c, [[60, 420], [160, 420], [160, 770], [80, 770]], P.shirtDk, .7) });
    if (kaan) C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, skinDk);
    ctx.restore();
  }
  function thumb(ctx, tx, ty, who, from) { // dokunan başparmak (sağdan)
    const skin = who === 'defne' ? P.dSkin : P.skin, skinDk = who === 'defne' ? P.dSkinDk : P.skinDk;
    C.seed(172);
    C.shape(ctx, [[from[0] + 60, from[1] - 40], [tx + 50, ty - 30], [tx + 10, ty - 50], [tx - 30, ty - 30], [tx - 20, ty + 20], [from[0] + 20, from[1] + 50]], skin, { lw: 6, shade: c => C.blot(c, [[tx - 10, ty + 5], [from[0] + 80, from[1]], [from[0] + 80, from[1] + 100], [tx, ty + 60]], skinDk, .5) });
    C.shape(ctx, [[tx - 22, ty - 34], [tx + 6, ty - 46], [tx + 18, ty - 24], [tx - 8, ty - 14]], who === 'defne' ? '#f0c4a4' : '#e7b896', { lw: 3 });
  }
  const SW = 486, SH = 864, BWd = 548, BHt = 1000;
  function phoneBody(ctx, t, tap) {
    C.seed(171); C.shape(ctx, rrectPts(-BWd / 2, -BHt / 2, BWd, BHt, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BWd / 2, -BHt / 2, 30, BHt); } });
    C.shape(ctx, [[-60, -BHt / 2 + 24], [60, -BHt / 2 + 24], [60, -BHt / 2 + 36], [-60, -BHt / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SW / 2, -SH / 2, SW, SH, 34); ctx.clip();
    ctx.drawImage(gameFrame(t), -SW / 2, -SH / 2, SW, SH);
    // yağmurlu ön camın yansıması (çok hafif) + cam parlaması
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SW / 2, -SH / 2 + 80); ctx.lineTo(-SW / 2 + 220, -SH / 2); ctx.lineTo(-SW / 2 + 300, -SH / 2); ctx.lineTo(-SW / 2, -SH / 2 + 180); ctx.fill();
    if (tap) { const rd = t - tap[0]; if (rd >= 0 && rd < .4) { ctx.strokeStyle = `rgba(255,255,255,${.9 * (1 - rd / .4)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(tap[1], tap[2], 20 + rd * 220, 0, TAU); ctx.stroke(); } }
    ctx.restore();
    C.ink(ctx, (() => { const p = new Path2D(); const q = C.wobble(rrectPts(-SW / 2, -SH / 2, SW, SH, 34, 6), true, .5); p.moveTo(q[0][0], q[0][1]); q.forEach(v => p.lineTo(v[0], v[1])); p.closePath(); return p; })(), 4);
  }
  function phoneBg(ctx, t, br) {
    ctx.drawImage(cached('kabin-telefon-bg', 1080, 1920, c => {
      c.fillStyle = '#0c1226'; c.fillRect(0, 0, 1080, 1920);
      [[180, 300, 110, 'rgba(255,210,122,.14)'], [900, 260, 80, 'rgba(255,210,122,.12)'], [140, 1450, 150, 'rgba(240,160,80,.10)'], [980, 1200, 130, 'rgba(120,150,220,.10)'], [560, 160, 70, 'rgba(255,210,122,.16)']].forEach(([x, y, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    }), 0, 0);
    // arkada ön camdan süzülen yağmur damlaları (bulanık, birerli)
    for (let i = 0; i < 26; i++) { const x = rnd(900 + i) * 1080, y = (rnd(950 + i) * 1920 + t * (70 + rnd(990 + i) * 60)) % 1920; ctx.fillStyle = 'rgba(200,220,240,.10)'; ctx.beginPath(); ctx.ellipse(x, y, 10, 15, 0, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(540, 700, 200, 540, 700, 760); hg.addColorStop(0, `rgba(255,226,122,${.34 * br})`); hg.addColorStop(.5, `rgba(255,190,110,${.12 * br})`); hg.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .55);
  }

  /* ================= AVLU GECE + DAISY (dış) ================= */
  const YD = { x: 640, y: 1560, s: .8 };
  const BEACON_W = [YD.x, YD.y - 346 * YD.s];
  function drawBeacon(ctx, v) { // pilotla aynı (Daisy yerel koordinatı)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(k => { const r = 40 + k * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - k * .2) * Math.min(1, v * 1.5), null, .5); }));
  }
  // Daisy'nin ön camı (yerel x -102..102, y -314..-214): içeride telefon ışığı + iki siluet
  function windshieldInside(ctx, t, br, red) {
    ctx.save(); C.seed(24);
    const wp = C.shape(ctx, [[-100, -312], [100, -312], [96, -216], [-96, -216]], null, { lw: 0, amp: .2 });
    ctx.clip(wp);
    const g = ctx.createRadialGradient(-10, -226, 6, -10, -240, 120); g.addColorStop(0, `rgba(255,214,130,${.85 * br})`); g.addColorStop(1, 'rgba(120,80,40,.55)');
    ctx.fillStyle = '#1b2230'; ctx.fillRect(-110, -320, 220, 110); ctx.fillStyle = g; ctx.fillRect(-110, -320, 220, 110);
    // siluetler: Kaan (tutam) solda, Defne (topuz) sağda
    ctx.fillStyle = 'rgba(20,14,10,.92)';
    ctx.beginPath(); ctx.ellipse(-44, -244, 22, 26, 0, 0, TAU); ctx.fill(); ctx.fillRect(-74, -226, 60, 20);
    ctx.beginPath(); ctx.moveTo(-48, -268); ctx.quadraticCurveTo(-46, -290, -32, -292); ctx.quadraticCurveTo(-28, -284, -36, -280); ctx.quadraticCurveTo(-40, -280, -40, -268); ctx.fill();
    ctx.beginPath(); ctx.ellipse(40, -240, 20, 24, 0, 0, TAU); ctx.fill(); ctx.fillRect(14, -224, 54, 18);
    ctx.beginPath(); ctx.arc(38, -268, 10, 0, TAU); ctx.fill();
    // ekran noktası
    ctx.fillStyle = `rgba(255,236,160,${.9 * br})`; ctx.fillRect(-12, -222, 12, 8);
    // camda damlalar (yerinde; donmada da yerinde)
    for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(210,225,240,.45)'; ctx.beginPath(); ctx.ellipse(-100 + rnd(700 + i) * 200, -312 + rnd(760 + i) * 96, 2.2, 3, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(190,220,240,.12)'; ctx.beginPath(); ctx.moveTo(-60, -320); ctx.lineTo(-30, -320); ctx.lineTo(-80, -205); ctx.lineTo(-110, -205); ctx.fill();
    if (red > 0) { ctx.globalCompositeOperation = 'screen'; const rg = ctx.createLinearGradient(0, -314, 0, -214); rg.addColorStop(0, `rgba(255,59,47,${.7 * red})`); rg.addColorStop(1, `rgba(255,59,47,${.12 * red})`); ctx.fillStyle = rg; ctx.fillRect(-110, -320, 220, 110); }
    ctx.restore();
    C.line(ctx, [[0, -314], [0, -214]], 5, P.ink, .2);
  }
  function yardNightBg() { return blurred('avlu-yagmur', 5, g => { C.drawYard(g, { mode: 'rain', seed: 7, lightOn: true, t: 0 }); }); }
  function daisyNight(ctx, t, tf, o) {
    o = o || {};
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(yardNightBg(), 0, 0);
    ctx.fillStyle = 'rgba(4,8,20,.35)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    ctx.save(); ctx.translate(YD.x, YD.y); ctx.scale(YD.s, YD.s);
    C.drawDaisy(ctx, { x: 0, y: 0, s: 1, seed: 23, beep: 0, mood: 'sleepy', boom: 1, hook: 0 });
    ctx.restore();
  }
  function rainOver(ctx, tf, a) { ctx.save(); ctx.globalAlpha = a; C.rainFx(ctx, { x: 0, y: 0, w: 1080, h: 1920 }, tf); ctx.restore(); }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 11: "I wanted them to stop you." kafe, Defne karşıda (orta) --- */
  shot('p6b11-defne', k => k.start, k => k.cu12, (ctx, t, u) => {
    const k = times(), tw = twos(t), tk = talk(tw, [11]);
    ctx.save(); cam(ctx, lerp(1.12, 1.18, E.io(u)), 560, 900);
    cafeRoom(ctx, t, { rainU: 0 });
    drawDefneAt(ctx, { x: DF_CAFE.x, y: DF_CAFE.y, s: DF_CAFE.s, item: 'coffee', expr: tw >= k.stop ? 'worried' : 'serious', look: -.25, lean: -.015 * tk, dy: -6 * tk, blink: blinkAt(tw, [k.start + .5]) });
    cafeTable(ctx, { letter: true });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 12: "Before a building did." yakın; sonunda bakış yere --- */
  shot('p6b12-yakin', k => k.cu12, k => k.kaan13, (ctx, t, u) => {
    const k = times(), tw = twos(t), tk = talk(tw, [12]);
    ctx.save(); cam(ctx, lerp(1.75, 1.86, E.io(u)), 545, 800, 540, 760);
    cafeRoom(ctx, t, { rainU: 0 });
    drawDefneAt(ctx, { x: DF_CAFE.x, y: DF_CAFE.y, s: DF_CAFE.s, item: 'coffee', expr: tw >= k.down ? 'regret' : 'worried', look: tw >= k.down ? .2 : -.3, lean: -.012 * tk + (tw >= k.down ? .015 : 0), dy: -5 * tk + (tw >= k.down ? 6 : 0) });
    cafeTable(ctx, { letter: true });
    ctx.restore();
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 13: "I wanted to be angry." Kaan (ters plan): kaşlar çatılır, söze başlayacak --- */
  shot('p6b13-kaan', k => k.kaan13, k => k.win, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const inh = E.outC(seg(tw, k.inhale, k.inhale + .3));
    ctx.save(); cam(ctx, lerp(1.5, 1.6, E.io(u)), 540, 840, 540, 760);
    cafeRoom(ctx, t, { side: 'kaan' });
    drawKaanAt(ctx, { x: KN_CAFE.x, y: KN_CAFE.y, s: KN_CAFE.s, hands: 'knees', expr: tw >= k.angry ? 'determined' : 'serious', look: tw >= k.inhale + .35 ? .9 : 0, dy: -8 * inh, blink: blinkAt(tw, [k.kaan13 + .5]) });
    cafeTable(ctx, { side: 'kaan', letter: true });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 14: "It started raining instead." pencere: ilk damlalar, sonra yağmur --- */
  function drop(ctx, t, t0, x, y, r) { // cama çarpan damla: küçük sıçrama, sonra aşağı süzülür
    const d = t - t0; if (d < 0) return;
    const sl = Math.min(140, Math.max(0, d - .25) * 90);
    ctx.fillStyle = 'rgba(225,235,245,.8)'; ctx.beginPath(); ctx.ellipse(x, y + sl, r * (d < .06 ? 1.6 : 1), r * (d < .06 ? .8 : 1.25), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,40,50,.45)'; ctx.lineWidth = 2; ctx.stroke();
    if (sl > 0) { ctx.strokeStyle = 'rgba(225,235,245,.4)'; ctx.lineWidth = r * .7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + sl); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x - r * .3, y + sl - r * .3, r * .28, 0, TAU); ctx.fill();
  }
  shot('p6b14-yagmur', k => k.win, k => k.ext, (ctx, t, u) => {
    const k = times(), ru = E.inQ(seg(t, k.rain - .2, k.ext));
    ctx.save(); cam(ctx, lerp(2.3, 2.15, E.io(u)), 810, 560, 540, 760);
    cafeRoom(ctx, t, { rainU: ru });
    ctx.restore();
    ctx.save(); cam(ctx, lerp(2.3, 2.15, E.io(u)), 810, 560, 540, 760);
    ctx.beginPath(); ctx.rect(CF.winX, CF.winY, CF.winW, CF.winH); ctx.clip();
    drop(ctx, t, k.drop1, 760, 420, 9); drop(ctx, t, k.drop2, 880, 560, 11); drop(ctx, t, k.drop3, 700, 640, 8);
    for (let i = 0; i < 40; i++) drop(ctx, t, k.rain - .1 + rnd(300 + i) * .9, CF.winX + 10 + rnd(340 + i) * (CF.winW - 20), CF.winY + 10 + rnd(380 + i) * CF.winH * .8, 5 + rnd(420 + i) * 6);
    ctx.restore();
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 15a: gece, yağmurda Daisy; kabin camı telefonla ışık, tavanda ışık sönük --- */
  shot('p6b15-dis', k => k.ext, k => k.cabin, (ctx, t, u) => {
    const z = lerp(1.25, 1.4, E.io(u)), cx = YD.x + 60, cy = YD.y - 330;
    ctx.save(); cam(ctx, z, cx, cy, 540, 700);
    daisyNight(ctx, t, t);
    ctx.translate(YD.x, YD.y); ctx.scale(YD.s, YD.s); windshieldInside(ctx, t, frameBright(t), 0);
    ctx.restore();
    { const [wx, wy] = toScr(z, cx, cy, 540, 700)(YD.x, YD.y - 264 * YD.s); nightLight(ctx, [[wx, wy, 380, .9, 260]], .45); }
    rainOver(ctx, t, .9);
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 15b: kabin içi, sıkışık; tek telefon; Defne ekrana eğilir; "kids"te ikisi gülümser --- */
  shot('p6b15-kabin', k => k.cabin, k => k.game, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.0, 1.08, E.io(u)), fx = 540, fy = 960;
    const ln = E.io(seg(tw, k.lean, k.lean + .5));
    ctx.save(); cam(ctx, z, fx, fy);
    cabinScene(ctx, t, {
      kaan: { expr: tw >= k.kids ? 'smile' : 'calm', look: .3, glow: .6 },
      defne: { expr: tw >= k.kids ? 'smile' : 'calm', look: -.8, lean: -.07 * ln, blink: blinkAt(tw, [k.cabin + .7]) },
      helmetOnDash: true
    });
    ctx.restore();
    cabinLight(ctx, t, toScr(z, fx, fy));
    finish(ctx);
  });

  /* --- 16: telefon (gerçek oyun): Kaan'ın turu, sonra telefon Defne'nin ellerine geçer --- */
  shot('p6b16-oyun', k => k.game, k => k.voice, (ctx, t, u) => {
    const k = times(), br = frameBright(t), z = 1.22 * lerp(.97, 1.03, E.io(u));
    phoneBg(ctx, t, br);
    const tw = twos(t), hu = E.ioC(seg(tw, k.hand0, k.hand1));
    // telefon sola (Kaan) → sağa (Defne) kayar, hafif döner
    const px = lerp(500, 590, hu), py = 770 + Math.sin(hu * Math.PI) * -30, rot = lerp(-.06, .05, hu) + Math.sin(tw * .8) * .006;
    const TP = [0, (300 / 800 - .5) * SH];   // binaya dokunuş
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.scale(z, z);
    // eller: Kaan'ınkiler çekilir (aşağı), Defne'ninkiler gelir (aşağıdan)
    const kOut = hu, dIn = hu;
    if (kOut < 1) { ctx.save(); ctx.translate(0, kOut * 700); drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6, 'kaan'); ctx.restore(); }
    if (dIn > 0) { ctx.save(); ctx.translate(0, (1 - dIn) * 700); drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6, 'defne'); ctx.restore(); }
    phoneBody(ctx, t, [k.tapK, TP[0], TP[1]]);
    const th = ones(t), inU = E.outC(seg(th, k.tapK - .3, k.tapK)), outU = E.inQ(seg(th, k.tapK + .2, k.tapK + .45)), tu = inU * (1 - outU);
    if (kOut < 1) { ctx.save(); ctx.translate(0, kOut * 700); drawHandSide(ctx, BWd / 2 - 10, 0, true, 6, 'kaan'); thumb(ctx, lerp(330, TP[0] + 30, tu), lerp(560, TP[1] + 50, tu), 'kaan', [BWd / 2, 420]); ctx.restore(); }
    if (dIn > 0) { ctx.save(); ctx.translate(0, (1 - dIn) * 700); drawHandSide(ctx, BWd / 2 - 10, 0, true, 6, 'defne'); thumb(ctx, 330, 560, 'defne', [BWd / 2, 420]); ctx.restore(); }
    ctx.restore();
    finish(ctx);
  });

  /* --- 17: "She did Grandpa's voice." ikili: Defne kaşlarını kalınlaştırır, çene içeri; Kaan güler --- */
  function thickBrows(ctx, u, ex) { // Defne'nin kafa yerel koordinatı (sit, translate(0,104) içinde): dedenin gür kaşları
    if (u <= 0) return;
    const Ee = C.EXPR[ex] || C.EXPR.serious, k = .92;
    [[-12, -466], [18, -466]].forEach(([x, y], i) => {
      const dir = i === 0 ? 1 : -1, inner = Ee[0] + 4 * u, outer = Ee[1] - 2 * u;
      C.seed(681 + i);
      C.line(ctx, [[x - dir * 13 * k, y + outer * k], [x - dir * 1 * k, y + (inner + outer) / 2 * k - 3 * k], [x + dir * 10 * k, y + inner * k]], 5 * (1 + 1.4 * u), P.ink, .3);
    });
  }
  shot('p6b17-taklit', k => k.voice, k => k.finger, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.16, 1.24, E.io(u)), fx = 560, fy = 900;
    const bu = E.outBack(seg(tw, k.brows, k.brows + .35));
    ctx.save(); cam(ctx, z, fx, fy);
    cabinScene(ctx, t, {
      kaan: { expr: tw >= k.brows + .5 ? 'smile' : 'calm', look: tw >= k.voice + .4 ? .8 : .3, glow: .6, dy: tw >= k.brows + .5 ? -6 * Math.abs(Math.sin(tw * 9)) : 0 },
      defne: { expr: tw >= k.brows ? 'serious' : 'smile', look: -.6, lean: -.03 + .02 * bu, dy: 10 * bu, blink: blinkAt(tw, [k.voice + .3]), after: c => thickBrows(c, clamp(bu), tw >= k.brows ? 'serious' : 'smile') },
      helmetOnDash: true
    });
    ctx.restore();
    cabinLight(ctx, t, toScr(z, fx, fy));
    finish(ctx);
  });

  /* --- 18: "Plan first." yakın: Defne parmağını dede gibi kaldırır, "first"te sallar --- */
  function fingerHand(ctx, x, y, rot, s) { // işaret parmağı yukarı, kol aşağıdan (krem gömlek)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); C.seed(691);
    limb(ctx, [0, 60], [-20, 700], 46, 60, P.shirt, 692, 6);
    C.shape(ctx, [[-44, 70], [-52, 10], [-40, -30], [36, -34], [50, 10], [44, 70]], P.dSkin, { lw: 6, shade: c => C.blot(c, [[20, -40], [60, -40], [60, 80], [26, 80]], P.dSkinDk, .5) });
    [[-30, -28], [-6, -36]].forEach(([a, b]) => C.shape(ctx, C.ell(a, b, 15, 13, 12), P.dSkin, { lw: 5 }));
    C.tube(ctx, [[22, -20], [24, -90], [22, -150]], 32, 26, P.dSkin, 6);
    C.shape(ctx, [[14, -146], [30, -146], [30, -128], [14, -128]], '#f0c4a4', { lw: 3 });
    C.tube(ctx, [[-44, 30], [-70, -10], [-62, -40]], 30, 24, P.dSkin, 6);
    ctx.restore();
  }
  const DCU = { z: 1.95, fx: 730, fy: 860, sx: 540, sy: 780 };
  shot('p6b18-parmak', k => k.finger, k => k.press, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = DCU.z * lerp(1, 1.04, E.io(u));
    const up = E.outBack(seg(tw, k.fingerUp - .25, k.fingerUp + .05)), wag = tw >= k.wag && tw < k.wag + .5 ? Math.sin((tw - k.wag) / .5 * TAU * 2) * .12 : 0;
    ctx.save(); cam(ctx, z, DCU.fx, DCU.fy, DCU.sx, DCU.sy);
    cabinScene(ctx, t, { kaan: { expr: 'smile', look: .8, glow: .6 }, defne: { expr: 'serious', look: -.4, dy: 10, after: c => thickBrows(c, 1, 'serious') }, helmetOnDash: true });
    fingerHand(ctx, lerp(640, 600, up), lerp(1500, 860, up), -.12 + wag, 1.2);
    ctx.restore();
    cabinLight(ctx, t, toScr(z, DCU.fx, DCU.fy, DCU.sx, DCU.sy));
    finish(ctx);
  });

  /* --- 19: "Then press the button." telefon: Defne'nin başparmağı basar, fabrika devrilir --- */
  shot('p6b19-dugme', k => k.press, k => k.eng, (ctx, t, u) => {
    const k = times(), br = frameBright(t), z = 1.24 * lerp(1, 1.05, E.io(u));
    phoneBg(ctx, t, br);
    const tw = twos(t), jx = Math.sin(tw * 2.1) * 3, jy = Math.sin(tw * 1.3 + 1) * 3;
    const TP = [-20, (420 / 800 - .5) * SH];
    ctx.save(); ctx.translate(590 + jx, 770 + jy); ctx.rotate(.05); ctx.scale(z, z);
    drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6, 'defne');
    phoneBody(ctx, t, [k.tapD, TP[0], TP[1]]);
    drawHandSide(ctx, BWd / 2 - 10, 0, true, 6, 'defne');
    const th = ones(t), hover = E.io(seg(th, k.press, k.tapD - .35)), inU = E.outC(seg(th, k.tapD - .3, k.tapD)), outU = E.inQ(seg(th, k.tapD + .2, k.tapD + .5));
    const tu = Math.max(hover * .45, inU) * (1 - outU);
    thumb(ctx, lerp(330, TP[0] + 30, tu), lerp(560, TP[1] + 50, tu), 'defne', [BWd / 2, 420]);
    ctx.restore();
    // yıkım anında ekran 6 kare sarsılır (oyundaki gibi) — telefon değil, ışık titrer
    if (t >= k.tapD && t < k.tapD + 6 / FPS) glow(ctx, 590, 700, 600, '255,190,110', .12);
    finish(ctx);
  });

  /* --- 20: "I'll help you finish the list," ikili: Defne Kaan'a döner, gülümser --- */
  shot('p6b20-liste', k => k.eng, k => k.helmCU, (ctx, t, u) => {
    const k = times(), tw = twos(t), tk = talk(tw, [20]), z = lerp(1.1, 1.2, E.io(u)), fx = 560, fy = 900;
    ctx.save(); cam(ctx, z, fx, fy);
    cabinScene(ctx, t, {
      kaan: { expr: tw >= k.eng + .9 ? 'surprised' : 'smile', look: tw >= k.eng + .5 ? .9 : .2, glow: .6, blink: blinkAt(tw, [k.eng + 1.4]) },
      defne: { expr: 'smile', look: -.9, lean: -.04 - .012 * tk, dy: -5 * tk },
      helmetOnDash: true
    });
    ctx.restore();
    cabinLight(ctx, t, toScr(z, fx, fy));
    finish(ctx);
  });

  /* --- 21: "As your engineer." yakın: Defne baretini panelden alıp takar, parmak boğumuyla "tok" --- */
  function helmetArm(ctx, hx, hy, put) { // baret tutan el (krem gömlek kolu aşağıdan)
    limb(ctx, [hx + 60, hy + 40], [hx + 160, hy + 700], 40, 56, P.shirt, 701, 6);
    C.seed(702); C.shape(ctx, C.ell(hx + 62, hy + 20, 34, 40, 14), P.dSkin, { lw: 6 });
  }
  shot('p6b21-baret', k => k.helmCU, k => k.serious, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = DCU.z * lerp(1, 1.035, E.io(u));
    // baret: panelden (905,1520) kalkar, başın üstüne (756, 577) oturur
    const lift = E.ioC(seg(tw, k.helmCU + .05, k.helmOn)), hx = lerp(905, 756, lift), hy = lerp(1520, 600, lift) - Math.sin(lift * Math.PI) * 120;
    const settle = tw >= k.helmOn ? Math.exp(-(tw - k.helmOn) * 9) * Math.sin((tw - k.helmOn) * 30) * 6 : 0;
    const armOut = E.inQ(seg(tw, k.helmOn + .1, k.helmOn + .45)), knock = tw >= k.knock && tw < k.knock + .3 ? Math.sin(seg(tw, k.knock, k.knock + .3) * TAU) : 0;
    ctx.save(); cam(ctx, z, DCU.fx, DCU.fy, DCU.sx, DCU.sy);
    cabinScene(ctx, t, { kaan: { expr: 'smile', look: .8, glow: .6 }, defne: { expr: tw >= k.helmOn ? 'confident' : 'smile', look: -.5, dy: -4 * talk(tw, [21]) } });
    const onHead = tw >= k.helmOn;
    helmetShape(ctx, hx, hy + (onHead ? 22 + settle : 0) + (onHead ? 0 : 0), lerp(1.05, 1.32, lift), lerp(.08, -.04, lift));
    if (armOut < 1) { ctx.save(); ctx.translate(0, armOut * 800); helmetArm(ctx, hx, hy, true); ctx.restore(); }
    if (knock !== 0 || (tw >= k.knock - .15 && tw < k.knock + .5)) { // parmak boğumu baretin yanına iki kez
      const kk = E.io(seg(tw, k.knock - .15, k.knock)) * (1 - E.io(seg(tw, k.knock + .3, k.knock + .5)));
      ctx.save(); ctx.translate(0, (1 - kk) * 700); fingerHand(ctx, 650 + Math.max(0, knock) * 10, 640 + 60, -.5, 1.0); ctx.restore();
    }
    ctx.restore();
    cabinLight(ctx, t, toScr(z, DCU.fx, DCU.fy, DCU.sx, DCU.sy));
    finish(ctx);
  });

  /* --- 22: "Then she got serious." ikili: gülümseme söner; yağmur --- */
  function helmetOn(c) { helmetShape(c, 0, -540, 1.32 / (DC.s * .9), -.04); }
  shot('p6b22-ciddi', k => k.serious, k => k.truth, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.2, 1.3, E.io(u)), fx = 600, fy = 900;
    ctx.save(); cam(ctx, z, fx, fy);
    cabinScene(ctx, t, {
      kaan: { expr: 'smile', look: tw >= k.sober + .4 ? .8 : .2, glow: .6 },
      defne: { expr: tw >= k.sober ? 'serious' : 'smile', look: tw >= k.sober ? -.9 : -.5, lean: -.03 * E.io(seg(tw, k.sober, k.sober + .5)), blink: blinkAt(tw, [k.sober - .2]), after: helmetOn }
    });
    ctx.restore();
    cabinLight(ctx, t, toScr(z, fx, fy), { dark: .66 });
    finish(ctx);
  });

  /* --- 23: "But first, tell me the truth." yakın: Defne, ciddi, öne eğilir --- */
  shot('p6b23-gercek', k => k.truth, k => k.kaanCU, (ctx, t, u) => {
    const k = times(), tw = twos(t), tk = talk(tw, [23]), z = DCU.z * lerp(1.02, 1.1, E.io(u));
    ctx.save(); cam(ctx, z, DCU.fx, DCU.fy, DCU.sx, DCU.sy);
    cabinScene(ctx, t, { kaan: { expr: 'calm', look: .5, glow: .6 }, defne: { expr: 'serious', look: -.7, lean: -.03 - .01 * tk, dy: -4 * tk, blink: blinkAt(tw, [k.truth + 1.2]), after: helmetOn } });
    ctx.restore();
    cabinLight(ctx, t, toScr(z, DCU.fx, DCU.fy, DCU.sx, DCU.sy), { dark: .66 });
    finish(ctx);
  });

  /* --- 24: "Who is this professor…" yakın: Kaan donar; "professor"de 0,5 sn sepya hatıra (1. bölüm) --- */
  const KCU = { z: 1.95, fx: 330, fy: 820, sx: 540, sy: 780 };
  function p1Memory(ctx) { // 1. bölüm b22: toz içinde Kaan, "My professor says that's called luck."
    memory(ctx, m => {
      const g = m.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#c9dbe0'); g.addColorStop(.5, P.groundLt); g.addColorStop(1, P.groundDk); m.fillStyle = g; m.fillRect(0, 0, 1080, 1920);
      m.fillStyle = 'rgba(216,202,176,.35)'; m.fillRect(0, 0, 1080, 1920);
      for (let i = 0; i < 40; i++) { m.fillStyle = `rgba(216,202,176,${.3 + rnd(800 + i) * .5})`; m.beginPath(); m.arc(rnd(840 + i) * 1080, 300 + rnd(880 + i) * 1200, 2 + rnd(920 + i) * 4, 0, TAU); m.fill(); }
      m.save(); cam(m, 1.05, 540, 900); C.drawKaan(m, { x: 520, y: 2180, s: 3.2, seed: 11, expr: 'calm', phone: true }); m.restore();
    });
    vignette(ctx, 0, 'rgba(30,20,10,.85)');
  }
  shot('p6b24-kaan', k => k.kaanCU, k => k.end, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    if (t >= k.mem0 && t < k.mem1) { p1Memory(ctx); finish(ctx); return; }
    const after = t >= k.mem1, z = KCU.z * (after ? 1.08 : lerp(1, 1.05, E.io(seg(t, k.kaanCU, k.mem0))));
    const tg = after ? k.mem0 : t;   // oyun ekranı da donar
    ctx.save(); cam(ctx, z, KCU.fx, KCU.fy, KCU.sx, KCU.sy);
    cabinScene(ctx, tg, { kaan: { expr: after ? 'frozen' : tw >= k.prof - .3 ? 'pale' : 'smile', look: after ? 0 : .4, glow: .6 }, defne: { expr: 'serious', look: -.8, after: helmetOn } });
    ctx.restore();
    cabinLight(ctx, tg, toScr(z, KCU.fx, KCU.fy, KCU.sx, KCU.sy), { dark: .66 });
    finish(ctx);
  });

  /* --- Bitiş: dışarıdan Daisy, yağmur; ışık üst üçte birde; endBeep'te TEK yanış + ön camda kırmızı yansıma --- */
  const END = { z: 2.5, cx: YD.x, cy: YD.y - 300, sx: 540, sy: 400 };
  shot('p6b-son', k => k.end, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = freezeIn(t, k.endBeep, 1), v = beepAt(t, k.endBeep, 1);
    const z = END.z * (1 + .03 * E.outC(seg(tf, k.end, k.endBeep - .3)) + .015 * seg(t, k.endBeep + .6, k.dur));
    ctx.save(); cam(ctx, z, END.cx, END.cy, END.sx, END.sy);
    daisyNight(ctx, tf, tf);
    ctx.translate(YD.x, YD.y); ctx.scale(YD.s, YD.s);
    windshieldInside(ctx, tf, tf === t ? frameBright(k.mem0) : frameBright(k.mem0), v);
    drawBeacon(ctx, v);
    ctx.restore();
    const S = toScr(z, END.cx, END.cy, END.sx, END.sy), [bx, by] = S(BEACON_W[0], BEACON_W[1]), [wx, wy] = S(YD.x, YD.y - 264 * YD.s);
    nightLight(ctx, [[wx, wy, 420, .9, 260], [bx, by, 260, .5]], .4);
    if (v > 0) glow(ctx, bx, by, 380, P.glow, .3 * v);
    rainOver(ctx, tf, .85);
    vignette(ctx, .45);
    const dk = .6 * E.io(seg(t, k.endCard - .1, k.endCard + .2));
    if (dk > 0) { const g = ctx.createLinearGradient(0, 560, 0, 860); g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(1, `rgba(7,11,24,${dk})`); ctx.fillStyle = g; ctx.fillRect(0, 560, 1080, 1360); }
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const r3 = x => +x.toFixed(3);
  TB.cuesB = {
    get damla1() { return r3(times().drop1); },             // cama ilk damla ("tık")
    get damla2() { return r3(times().drop2); },
    get damla3() { return r3(times().drop3); },
    get yagmurBaslar() { return r3(times().rain - .2); },     // yağmur tam başlar (pencerede); kabinde sürer
    get kabinDis() { return r3(times().ext); },              // gece avlu, yağmur (dış ambiyans)
    get kabinIc() { return r3(times().cabin); },             // kabin içi: tavana vuran yağmur
    get dokunusKaan() { return r3(times().tapK); },          // Kaan'ın başparmağı ekrana (oyun patlaması)
    get telefonElDegistirir() { return r3(times().hand0); },
    get dokunusDefne() { return r3(times().tapD); },         // "press"te basış: oyunda fabrika devrilir
    get baretTakilir() { return r3(times().helmOn); },
    get baretTok() { return r3(times().knock); },            // parmak boğumuyla baret
    get hatira() { return r3(times().mem0); },               // sepya hatıra 0,5 sn (sessiz)
    get sonBip() { return r3(times().endBeep); }             // tek bip; ışık +0,04–0,24
  };
})();
