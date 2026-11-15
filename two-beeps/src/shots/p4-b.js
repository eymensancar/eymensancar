/* Part 4 · Animatör B: cümle 15–29 ve bitiş görüntüsü. Başlangıç (S14.t1+S15.t0)/2 ≈ 25,38 sn, bitiş tl.duration.
   YERLEŞİM: A'nın (src/shots/p4-a.js) dünyası birebir kopyalandı (drawWorld, deskTop, handOnRoll, lampWarm):
   - OFİS: drawOffice {x:0,y:0,w:1080,h:900,seed:21}; duvar/zemin çizgisi y=630, tavan çizgisi y=-60; kapı x -250…-40 (açık .92);
     takvim x 691–907, y 270–540; çatlak x≈800, y 630 → 0 (bu dosyada -60'taki tavana uzatılır). Lamba yanık, telefon Kaan'da.
     Takvim en çok calendarMoved .7 kayar (x 842–1058): drawOffice alanı x=1080'de kırptığı için 1'de takvim kesik görünür.
     Çatlağın takvim dışındaki kısmı takvim kaydırılana kadar çizilmez (drawOffice onu hep çizer; burada stroke kırpılır).
   - MASA (üstten): drawSensorPlan {x:540, y:820, s:1.1, rot:-.03}; rulo A'nın bıraktığı yerel x=-80'den açılır.
     Kâğıttaki ışık simgesi yerel (-200,-126); ekranda (470,583)'e oturur = gerçek Daisy'nin ışığı (cam z 2.3, odak (0,-346)).
   - AVLU (bugün gece / 2. bölüm kapı önü gündüz): drawYard varsayılan alan, seed 7; ofis kapısı x 445–569, alt y 1267;
     Daisy kapının sağ önünde drawDaisy {x:760, y:1420, s:.9, boom:1}.
   - 1. BÖLÜM ARSASI (hatıra): pilot b-sahneler.js dünyasının kopyası: baca tabanı (560,1100), Daisy (878,1180), alan TB.zone (800,1240). */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;          // karakterler/eller ikişerli
  const ones = t => Math.floor(t * FPS + 1e-6) / FPS;

  /* ================= ZAMANLAR (hepsi timeline'dan) ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1], c = tl.cues;
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const k = {};
    k.start = (S(14).t1 + S(15).t0) / 2;                 // A ile ortak kesme (≈25,38)
    k.rollEnd = k.start + .62;                            // rulo açılır
    k.enter = W(15, /^something/i, 2).t0 - .2;            // sol el (işaret parmağı) girer
    k.trace0 = W(15, /^something/i, 2).t0;                // parmak kabin içine yürür
    k.trace1 = W(15, /^her/i, 4).t0;                      // sensör kutusuna varır
    k.cu16 = S(16).t0 - .18;                              // "A sensor.": yakın
    k.tap = W(16, /^sensor/i, 1).t0;                      // parmak kutuya dokunur
    k.trace = S(17).t0 - .14;                             // kesikli çizgi boyunca ışığa
    k.lightArr = W(17, /^wrong/i, 7).t0;                  // parmak ışık simgesinde
    k.dis1 = W(17, /^beeps/i, 9).t0 - .5;                 // çizimden gerçek Daisy'ye geçiş (0,4 sn)
    k.dis2 = k.dis1 + .4;
    k.alert = W(17, /^beeps/i, 9).t0;                     // siperlik bipten önce kalkar
    k.beep = c.beep;                                      // iki bip (daisy-beep.wav başlangıcı)
    k.freeze0 = c.beep - .3; k.freeze1 = c.beep + .57 + 10 / FPS;
    k.stop = S(19).t0 - .42;                              // çizimde "STOP"
    k.grumpy = S(20).t0 - .3;                             // bugün: uykulu Daisy
    k.mem1 = S(21).t0 - .25;                              // sepya hatıra: bip
    k.memBeep = W(21, /^warning/i, 2).t0 - TONES[0][0];   // hatırada ışık iki kez ("warning"da)
    k.mem2 = S(22).t0 - .12;                              // sepya hatıra: baca yanlış yöne
    k.cal = S(23).t0 - .35;                               // ofis, takvim
    k.calWord = W(23, /^calendar/i, 4).t0;
    k.low = S(24).t0 - .2;                                // takvim çok alçakta
    k.move = S(25).t0 - .2;                               // el takvimi kaydırır
    k.grab = W(25, /^moved/i, 1).t0 - .05;
    k.slide1 = S(26).t0 - .15;                            // takvim yerinde (çatlak açıkta)
    k.crack = c.crack;                                    // ince çıtırtı: sıva tozu
    k.tilt = S(27).t0 - .1;                               // çatlak boyunca yukarı
    k.ceil = W(27, /^ceiling/i, 5).t0;
    k.face = S(28).t0 - .2;                               // Kaan'ın yüzü
    k.rem = W(28, /^remembered/i, 2).t0;
    k.door = S(29).t0 - .2;                               // sepya: 2. bölüm, kapı önü
    k.doorBeep = W(29, /^beeped/i, 1).t0 - TONES[0][0];
    k.endShot = S(29).t1 + .25;                           // bitiş görüntüsü
    k.endBeep = c.endBeep; k.endCard = c.endCard; k.dur = tl.duration;
    K = k; return k;
  }

  /* İki bip: daisy-beep.wav tonları 0,04–0,24 ve 0,37–0,57 sn. Işık sesle aynı karede: 6 kare yanık, 4 sönük, 6 yanık. */
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
  function airDust(ctx, t, n, sb, box, a) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (6 + r(2) * 18)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(216,202,176,${a * (.3 + r(5) * .5)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + r(6) * 3.4, 0, TAU); ctx.fill();
    }
  }
  const SEPIA = 'sepia(1) saturate(.55) brightness(.92) contrast(.92)';        // pilot hatıra karesi
  function memory(ctx, draw) {
    const m = layer('mem'); draw(m);
    ctx.fillStyle = '#2a2118'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.filter = SEPIA; ctx.drawImage(layers.mem, 0, 0); ctx.filter = 'none';
  }
  function limb(ctx, A, B, wa, wb, fill, sd) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    return C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 6, shade: c => C.blot(c, [[A[0] - nx * wa * .1, A[1] - ny * wa * .1], [B[0] - nx * wb * .1, B[1] - ny * wb * .1], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], P.jacketDk, .55) });
  }

  /* ================= İŞARET EDEN EL (üstten; parmak ucu (0,0), kol +y yönünde) ================= */
  function drawPointer(ctx, x, y, rot, s, press) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); C.seed(411);
    const lw = 6 / Math.sqrt(s) * 1.4;
    // gölge (ışık sol üstten)
    ctx.save(); ctx.globalAlpha = .22 * (1 - (press || 0) * .4); ctx.fillStyle = P.ink; ctx.translate(16, 20);
    ctx.beginPath(); ctx.moveTo(-16, 10); ctx.lineTo(16, 10); ctx.lineTo(80, 330); ctx.lineTo(120, 1000); ctx.lineTo(-120, 1000); ctx.lineTo(-80, 330); ctx.fill(); ctx.restore();
    limb(ctx, [0, 330], [10, 1100], 82, 104, P.jacket, 412);                                  // kol
    C.shape(ctx, [[-84, 340], [84, 336], [88, 378], [-86, 384]], P.hazard, { lw: lw * .8 });  // sarı bileklik
    C.shape(ctx, [[-58, 330], [-74, 230], [-62, 150], [-30, 112], [40, 108], [66, 150], [70, 240], [58, 330]], P.skin, { lw, shade: c => C.blot(c, [[30, 100], [90, 100], [90, 340], [40, 340]], P.skinDk, .5) });
    // kıvrık parmak boğumları
    [[-48, 132], [-22, 118], [6, 116]].forEach(([a, b]) => C.shape(ctx, C.ell(a, b, 17, 15, 12), P.skin, { lw: lw * .8 }));
    C.tube(ctx, [[-62, 236], [-92, 186], [-88, 138]], 40, 30, P.skin, lw);                  // başparmak
    C.tube(ctx, [[30, 132], [18, 64], [0, 6]], 40, 32, P.skin, lw, { shade: c => C.blot(c, [[18, 0], [50, 0], [50, 140], [30, 140]], P.skinDk, .45) });   // işaret parmağı
    C.shape(ctx, [[-8, 10], [10, 8], [12, 30], [-6, 32]], '#e7b896', { lw: lw * .5 });       // tırnak
    ctx.restore();
  }

  /* ================= MASA + SENSÖR ÇİZİMİ ================= */
  const PL = { x: 540, y: 820, s: 1.1, rot: -.03 };          // A ile aynı (PLAN)
  const PLAN = PL;
  const planW = (lx, ly) => { const c = Math.cos(PL.rot), s = Math.sin(PL.rot); return [PL.x + (lx * c - ly * s) * PL.s, PL.y + (lx * s + ly * c) * PL.s]; };
  // rulo A'nın bıraktığı yerden (yerel x=-80) sağa açılır, sensör kutusu görünür
  function rollX(t) { const k = times(); return lerp(-80, 520, E.io(seg(twos(t), k.start, k.rollEnd))); }
  function drawPlanScene(ctx, t) {
    const k = times(), rx = rollX(t);
    deskTop(ctx, t, rx);
    if (t < k.rollEnd + .4) { // A'nın sağ eli rulonun üstünde, ruloyla birlikte gider ve çekilir
      const [hx, hy] = planW(Math.min(rx, 330) + 24, 80), out = E.inQ(seg(twos(t), k.rollEnd - .1, k.rollEnd + .35));
      handOnRoll(ctx, hx + out * 260, hy + out * 700, -.2, false);
    }
  }
  function deskLight(ctx) { lampWarm(ctx, .5); vignette(ctx, .45); }
  // Parmak yolu (çizim yerel koordinatı)
  const PATH15 = [[-345, 10], [-270, 30], [-170, 60], [-90, 70], [-24, 74]];
  const PATH17 = [[-20, 46], [-20, -10], [-110, -10], [-200, -10], [-200, -60], [-200, -104]];
  function along(pts, u) {
    let L = 0; const ds = []; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); ds.push(d); L += d; }
    let r = clamp(u) * L; for (let i = 0; i < ds.length; i++) { if (r <= ds[i] || i === ds.length - 1) { const f = clamp(r / ds[i]); return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]; } r -= ds[i]; }
    return pts[pts.length - 1];
  }
  function fingerAt(t) { // çizim yerel koordinatında parmak ucu + kolun açısı
    const k = times(), tw = twos(t);
    if (tw < k.cu16) {
      const en = E.outC(seg(tw, k.enter, k.enter + .45));
      const p = along(PATH15, E.io(seg(tw, k.trace0 + .15, k.trace1)));
      return { p: [p[0] + (1 - en) * 520, p[1] + (1 - en) * 700], rot: .55, press: 0 };
    }
    if (tw < k.trace) {
      const press = Math.sin(Math.PI * seg(tw, k.tap, k.tap + .2));
      return { p: [-24 + press * 2, 104 + press * 3], rot: .5, press };
    }
    const p = along(PATH17, E.io(seg(tw, k.trace + .08, k.lightArr)));
    const out = E.inQ(seg(tw, k.lightArr + .12, k.dis1 + .1));           // ışığa varınca el çekilir
    return { p: [p[0] + out * 360, p[1] + 36 + out * 560], rot: .5, press: 0 };
  }

  /* ================= A'NIN DÜNYASI (src/shots/p4-a.js'den kopya: aynı ofis, aynı masa) ================= */
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const DOOR = { x0: -250, x1: -40, y0: 90, y1: 630 };
  const NAIL = [25, 250], PHONE = [528, 512], CUP = [300, 558], SOCKET = [700, 600];
  const SKETCH = [[150, 160, 190, 140, -.05, 0, '1981'], [390, 120, 170, 130, .04, 1, '1987'], [250, 360, 180, 130, .03, 2, '1994'], [480, 330, 160, 120, -.04, 3, '2003']];

  function sketch(ctx, cx, cy, w, h, rot, kind, year, sd) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); C.seed(sd);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.fillRect(-w / 2 + 5, -h / 2 + 6, w, h); ctx.restore();
    C.shape(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2 + 2], [w / 2 - 2, h / 2], [-w / 2 + 1, h / 2 - 1]], kind % 2 ? P.page : '#efe4c8', { lw: 2.6, shade: c => C.blot(c, [[w * .1, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [w * .2, h / 2]], P.pageDk, .5) });
    const pc = P.inkOld, gy = h * .32;
    C.line(ctx, [[-w * .42, gy], [w * .42, gy]], 1.6, pc, .6);
    if (kind === 0) {        // baca: dik + kesik yay + yerde
      C.line(ctx, [[-w * .25, gy], [-w * .25, -h * .36], [-w * .14, -h * .36], [-w * .14, gy]], 1.8, pc, .5);
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = pc; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-w * .2, gy, h * .62, -Math.PI / 2 + .15, -.25); ctx.stroke(); ctx.restore();
      C.line(ctx, [[-w * .12, gy - 4], [w * .38, gy - 4], [w * .38, gy - 13], [-w * .12, gy - 13]], 1.6, pc, .4);
    } else if (kind === 1) { // blok: kat çizgileri, X, ok
      C.line(ctx, [[-w * .3, gy], [-w * .3, -h * .3], [w * .1, -h * .3], [w * .1, gy]], 1.8, pc, .5);
      for (let i = 1; i < 4; i++) C.line(ctx, [[-w * .3, gy - i * h * .15], [w * .1, gy - i * h * .15]], 1, pc, .4);
      C.line(ctx, [[-w * .3, gy], [w * .1, -h * .3]], 1.2, pc, .4); C.line(ctx, [[w * .1, gy], [-w * .3, -h * .3]], 1.2, pc, .4);
      C.line(ctx, [[w * .16, -h * .2], [w * .34, -h * .02], [w * .34, gy - 6]], 1.4, pc, .4);
    } else if (kind === 2) { // kule + devrilme alanı (taralı)
      C.line(ctx, [[-w * .05, gy], [-w * .05, -h * .4], [w * .1, -h * .4], [w * .1, gy]], 1.8, pc, .5);
      ctx.save(); ctx.strokeStyle = pc; ctx.lineWidth = 1; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-w * .42 + i * 9, gy + 2); ctx.lineTo(-w * .42 + i * 9 + 10, gy - 8); ctx.stroke(); } ctx.restore();
      C.line(ctx, [[-w * .1, -h * .3], [-w * .32, -h * .08], [-w * .34, gy - 12]], 1.2, pc, .4);
    } else {                 // su kulesi
      C.line(ctx, [[-w * .2, -h * .38], [w * .16, -h * .38], [w * .12, -h * .14], [-w * .16, -h * .14], [-w * .2, -h * .38]], 1.8, pc, .5);
      C.line(ctx, [[-w * .14, -h * .14], [-w * .22, gy]], 1.4, pc, .4); C.line(ctx, [[w * .1, -h * .14], [w * .18, gy]], 1.4, pc, .4);
      C.line(ctx, [[-w * .18, h * .05], [w * .14, h * .05]], 1, pc, .3);
    }
    C.handwrite(ctx, year, w * .1, h * .46, 15, pc, sd + 3);
    C.shape(ctx, C.ell(0, -h / 2 + 7, 5, 5, 8), P.beaconOff, { lw: 1.6 });          // raptiye
    ctx.restore();
  }
  function helmet(ctx, x, y) { // eski baret, çivide çene kayışıyla asılı (sarı değil: kirli beyaz)
    C.seed(311);
    C.shape(ctx, C.ell(x, y - 2, 3, 3, 6), P.steel, { lw: 1.6 });
    C.line(ctx, [[x - 22, y + 46], [x, y + 2], [x + 22, y + 46]], 1.8, '#3a2c24', .3);
    ctx.save(); ctx.translate(x, y + 70); ctx.rotate(-.06);
    C.shape(ctx, [[-50, 8], [-46, -20], [-30, -40], [0, -48], [30, -40], [46, -20], [50, 8]], '#e3dccb', { lw: 2.6, shade: c => { C.blot(c, [[10, -50], [60, -50], [60, 10], [18, 10]], '#b9b0a0', .7); C.blot(c, C.ell(-18, -14, 9, 5, 8), '#9a8f7c', .5); } });
    C.shape(ctx, [[-62, 6], [62, 6], [58, 16], [-58, 16]], '#d5ccba', { lw: 2.4 });
    C.line(ctx, [[0, -48], [0, 6]], 1.4, 'rgba(21,18,13,.4)', .3);
    C.line(ctx, [[-30, -26], [-18, -30]], 1.2, '#6e6457', .3); C.line(ctx, [[22, -16], [34, -8]], 1.2, '#6e6457', .3);
    ctx.restore();
  }
  function penCup(ctx, x, y, k) { // kalemlik: iki kurşun kalem, bir kırmızı, TEK mavi (taze mürekkep)
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); C.seed(321);
    [[-8, -.24, '#8b6a3e'], [8, .22, P.brickDk], [0, .05, P.inkBlue], [-2, -.08, '#8b6a3e']].forEach(([dx, r, col], i) => {
      ctx.save(); ctx.translate(dx, -30); ctx.rotate(r); C.shape(ctx, [[-2.6, -40 - i * 4], [2.6, -40 - i * 4], [2.6, 0], [-2.6, 0]], col, { lw: 1.2 }); ctx.restore();
    });
    C.shape(ctx, [[-16, -34], [16, -34], [14, 0], [-14, 0]], P.steelLt, { lw: 2, shade: c => C.blot(c, [[4, -40], [20, -40], [20, 4], [6, 4]], P.steel, .6) });
    ctx.restore();
  }
  function drawWorld(ctx, t, o) {
    o = o || {}; C.seed(341);
    ctx.fillStyle = P.wallOffice; ctx.fillRect(-800, -700, 2600, 1330);
    for (let i = 0; i < 9; i++) { const x = [-700, -520, -330, -160, 1100, 1250, 1420, 1600, -60][i], y = 80 + rnd(i + 9) * 420; C.blot(ctx, C.ell(x, y, 80 + rnd(i) * 90, 40 + rnd(i + 3) * 50, 12), P.wallOfficeDk, .25); }
    ctx.fillStyle = '#2a302e'; ctx.fillRect(-800, -700, 2600, 640); C.line(ctx, [[-800, -60], [1800, -60]], 3);
    ctx.fillStyle = P.floorWood; ctx.fillRect(-800, 630, 2600, 1100);
    ctx.strokeStyle = 'rgba(21,18,13,.3)'; ctx.lineWidth = 2; for (let yy = 660; yy < 1720; yy += 36 + (yy - 630) * .08) { ctx.beginPath(); ctx.moveTo(-800, yy); ctx.lineTo(1800, yy + 4); ctx.stroke(); }
    drawOfficeClip(ctx, Object.assign({}, OFF, { lamp: o.lamp, calendarMoved: o.cm || 0 }), o.full ? null : [OF.kx - 120, OF.cy + 3, 240, OF.ch - 6]);
    if (o.full) { C.seed(351); C.line(ctx, [[OF.kx - 6, OF.top + 2], [OF.kx - 1, -30], [OF.kx - 4, -60]], 5, P.ink, 1.5); }
    C.line(ctx, [[-800, 630], [0, 630]], 3.8); C.line(ctx, [[1080, 630], [1800, 630]], 3.8);
    // kapı (arka duvarın solunda)
    const D = DOOR, dw = D.x1 - D.x0;
    C.shape(ctx, [[D.x0 - 14, D.y1], [D.x0 - 14, D.y0 - 14], [D.x1 + 14, D.y0 - 14], [D.x1 + 14, D.y1]], '#4a3420', { lw: 3 });
    const op = o.door || 0;
    if (op > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(D.x0, D.y0, dw, D.y1 - D.y0); ctx.clip();
      const g = ctx.createLinearGradient(0, D.y0, 0, D.y1); g.addColorStop(0, '#16224a'); g.addColorStop(.62, '#2a3a66'); g.addColorStop(.63, '#3a3f4e'); g.addColorStop(1, '#4a4a52');
      ctx.fillStyle = g; ctx.fillRect(D.x0, D.y0, dw, D.y1 - D.y0);
      ctx.fillStyle = 'rgba(238,242,255,.8)'; for (let i = 0; i < 6; i++) ctx.fillRect(D.x0 + 20 + rnd(i + 40) * 170, D.y0 + 20 + rnd(i + 50) * 200, 2.5, 2.5);
      C.line(ctx, [[D.x0, D.y0 + 345], [D.x1, D.y0 + 341]], 2, '#1d2742', .5);           // çit hattı
      ctx.restore();
      if (o.kaanDoor) o.kaanDoor(ctx);
    }
    const th = op * 1.35, fx = D.x1 - dw * Math.cos(th), sp = Math.sin(th);
    const panel = [[fx, D.y0 - 34 * sp], [D.x1, D.y0], [D.x1, D.y1], [fx, D.y1 + 26 * sp]];
    C.shape(ctx, panel, op > 0 ? '#5a4029' : '#6f5134', { lw: 3.2, shade: c => C.blot(c, [[D.x1 - dw * .3, D.y0 - 40], [D.x1 + 10, D.y0 - 40], [D.x1 + 10, D.y1 + 30], [D.x1 - dw * .25, D.y1 + 30]], '#3f2711', .45) });
    const kx = lerp(fx, D.x1, .14); C.shape(ctx, C.ell(kx, (D.y0 + D.y1) / 2 + 20, 6 * (1 - sp * .5) + 1, 6, 10), P.gold, { lw: 2 });
    // baret, eskizler
    helmet(ctx, NAIL[0], NAIL[1]);
    SKETCH.forEach(([x, y, w, h, r, kd, yr], i) => sketch(ctx, x, y, w, h, r, kd, yr, 400 + i * 10));
    // priz + kablo
    C.shape(ctx, [[SOCKET[0] - 14, SOCKET[1] - 18], [SOCKET[0] + 14, SOCKET[1] - 18], [SOCKET[0] + 14, SOCKET[1] + 14], [SOCKET[0] - 14, SOCKET[1] + 14]], '#d9d2c2', { lw: 1.8 });
    C.line(ctx, [[615, 648], [650, 652], [684, 640], [SOCKET[0], SOCKET[1] + 2]], 2.4, P.ink, .5);
    penCup(ctx, CUP[0], CUP[1], 1);
  }
  function deskTop(ctx, t, rx) {
    const bg = cached('masa-ust', 1080, 1920, c => {
      c.fillStyle = P.wood; c.fillRect(0, 0, 1080, 1920); C.seed(611);
      for (let i = 0; i < 9; i++) C.line(c, [[-20, 120 + i * 220], [1100, 140 + i * 220 + (i % 2 ? 8 : -6)]], 2.6, 'rgba(21,18,13,.35)', 1.6);
      for (let i = 0; i < 40; i++) C.line(c, [[rnd(i + 30) * 1080, rnd(i + 31) * 1920], [rnd(i + 30) * 1080 + 80 + rnd(i) * 120, rnd(i + 31) * 1920 + 4]], 1.4, 'rgba(63,39,17,.4)', 1);
      // diğer rulolar (üstte)
      [[340, 330, -.12, 300], [700, 300, .1, 240]].forEach(([x, y, r, L]) => { c.save(); c.translate(x, y); c.rotate(r); C.shape(c, [[-L / 2, -24], [L / 2, -24], [L / 2, 24], [-L / 2, 24]], '#dfe5e2', { lw: 4, shade: cc => C.blot(cc, [[-L / 2, 6], [L / 2, 6], [L / 2, 26], [-L / 2, 26]], '#b9c2bf', .7) }); C.shape(c, C.ell(L / 2, 0, 9, 24, 12), '#eef2f0', { lw: 3 }); c.restore(); });
    });
    ctx.drawImage(bg, 0, 0);
    // kalemlik (üstten): tek mavi kalem
    ctx.save(); ctx.translate(170, 470); C.seed(621);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(12, 14, 64, 64, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.shape(ctx, C.ell(0, 0, 62, 62, 24), P.steelLt, { lw: 4.4 }); C.shape(ctx, C.ell(0, 0, 50, 50, 20), '#3a3d45', { lw: 2 });
    [[-22, -10, -2.3, '#8b6a3e'], [20, 14, .7, P.brickDk], [6, -22, -1.2, P.inkBlue], [-6, 22, 2.1, '#8b6a3e']].forEach(([x, y, a, col]) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); C.shape(ctx, [[0, -7], [92, -7], [104, 0], [92, 7], [0, 7]], col, { lw: 3 }); ctx.restore();
    });
    ctx.restore();
    // çizim kâğıdı: açık kısım (yerel x < rx) + rulo
    ctx.save(); ctx.translate(PLAN.x, PLAN.y); ctx.rotate(PLAN.rot); ctx.scale(PLAN.s, PLAN.s);
    ctx.save(); ctx.beginPath(); ctx.rect(-420, -320, rx + 420, 640); ctx.clip();
    C.drawSensorPlan(ctx, { x: 0, y: 0, s: 1, seed: 97 });
    // dedenin el yazısıyla "DAISY" + bom çizgisi (Daisy olduğu okunsun)
    C.handwrite(ctx, 'DAISY', -362, -206, 34, P.inkOld, 631, { bold: true });
    ctx.save(); ctx.strokeStyle = '#24408f'; ctx.lineWidth = 2.4;
    ctx.stroke(C.pathOf(C.wobble([[-205, -110], [-100, -248]], false, .6), false)); ctx.stroke(C.pathOf(C.wobble([[-180, -110], [-86, -236]], false, .6), false));
    for (let i = 1; i < 6; i++) { const a = i / 6; ctx.beginPath(); ctx.moveTo(lerp(-205, -100, a), lerp(-110, -248, a)); ctx.lineTo(lerp(-180, -86, a + .08), lerp(-110, -236, a + .08)); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    // rulo silindiri
    C.seed(641);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(rx + 6, -280, 60, 576); ctx.restore();
    C.shape(ctx, [[rx, -284], [rx + 46, -284], [rx + 46, 284], [rx, 284]], '#e4ebe9', { lw: 4.4, shade: c => { C.blot(c, [[rx + 26, -290], [rx + 50, -290], [rx + 50, 290], [rx + 26, 290]], '#aeb9b6', .8); } });
    ctx.restore();
  }
  function handOnRoll(ctx, x, y, rot, flip) { // Kaan'ın kolu alttan gelir: ceket + sarı bileklik + el
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (flip) ctx.scale(-1, 1); C.seed(flip ? 652 : 651);
    C.shape(ctx, [[-60, 120], [60, 120], [70, 700], [-70, 700]], P.jacket, { lw: 6, shade: c => C.blot(c, [[20, 110], [80, 110], [80, 700], [30, 700]], '#0b1f2a', .3) });
    C.shape(ctx, [[-56, 100], [56, 100], [58, 136], [-58, 136]], P.hazard, { lw: 4.4 });
    C.shape(ctx, [[-52, 104], [-58, 30], [-40, -26], [-10, -44], [24, -40], [48, -16], [56, 40], [50, 104]], P.skin, { lw: 6, shade: c => C.blot(c, [[20, -50], [70, -50], [70, 110], [30, 110]], P.skinDk, .5) });
    C.line(ctx, [[-30, -20], [-26, 20]], 3, P.skinDk); C.line(ctx, [[-6, -32], [-4, 10]], 3, P.skinDk); C.line(ctx, [[18, -30], [16, 10]], 3, P.skinDk);
    ctx.restore();
  }
  function lampWarm(ctx, a) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const g = ctx.createRadialGradient(820, 380, 60, 640, 760, 1200);
    g.addColorStop(0, `rgba(255,214,140,${a})`); g.addColorStop(1, 'rgba(40,24,10,.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
  }

  /* ================= OFİS ================= */
  const OFF = { x: 0, y: 0, w: 1080, h: 900, seed: 21 };       // A ile aynı ofis
  const OF = (() => { const a = OFF, kx = a.x + a.w * .74; return { kx, fl: a.y + a.h * .7, top: a.y, cx0: kx - a.w * .1, cy: a.y + a.h * .3, cw: a.w * .2, ch: a.h * .3, tx: a.x + a.w * .04, tw: a.w * .62, ty: a.y + a.h * .62, lamp: [a.x + a.w * (.04 + .62 * .9), a.y + a.h * .62 - 70] }; })();
  // drawOffice çatlağı hep çizer; takvim kaydırılana kadar yalnız takvimin arkasındaki kısım kalsın diye çatlak çizgileri kırpılır.
  // (Çatlak, duvar çizimlerinden sonraki 11.–16. stroke çağrısıdır: 2 çizim × 5 + çatlak 3 çizgi × 2.)
  function drawOfficeClip(ctx, o, crackClip) {
    if (!crackClip) return C.drawOffice(ctx, o);
    let n = 0;
    const px = new Proxy(ctx, {
      get(tg, k) {
        if (k === 'stroke') return (...a) => {
          n++;
          if (n >= 11 && n <= 16) { tg.save(); tg.beginPath(); tg.rect(crackClip[0], crackClip[1], crackClip[2], crackClip[3]); tg.clip(); tg.stroke(...a); tg.restore(); }
          else tg.stroke(...a);
        };
        const v = tg[k]; return typeof v === 'function' ? v.bind(tg) : v;
      },
      set(tg, k, v) { tg[k] = v; return true; }
    });
    C.drawOffice(px, o);
  }
  const CM = .7;    // takvim en çok bu kadar kayar: drawOffice alanı x=1080'de kırpar, takvim alan içinde kalsın
  function drawRoom(ctx, cm, full) { drawWorld(ctx, TB.t, { lamp: true, door: .92, phone: false, cm: cm * CM, full }); }
  // Ofisin ışığı (gece): lamba havuzu + takvim/çatlak bölgesi; üst duvar ve köşeler karanlık
  function roomLight(ctx, S, extra, a, cry) {
    const [lx, ly] = S(OF.lamp[0], OF.lamp[1] + 30), [cx, cy] = S(OF.kx, OF.cy + OF.ch * .5), [, y0] = S(0, 0), [, y1] = S(0, 100), z = (y1 - y0) / 100;
    nightLight(ctx, [[lx, ly, 280 * z, .95, 220 * z], [cx, cy, 150 * z, .8, (cry || 230) * z]].concat(extra || []), a == null ? .78 : a);
  }
  // takvimi kaydıran el (sağa iter), kol soldan-alttan
  function drawSideHand(ctx, x, y, rot, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(-s, s); C.seed(431);
    limb(ctx, [430, 250], [1100, 160], 96, 120, P.jacket, 433);
    limb(ctx, [90, 0], [430, 250], 62, 86, P.jacket, 432);
    C.shape(ctx, C.ell(430, 250, 84, 82, 20), P.jacket, { lw: 0 }); C.line(ctx, [[380, 300], [440, 320], [490, 280]], 5, P.jacketDk);
    C.shape(ctx, [[70, -40], [140, -20], [100, 70], [40, 40]], P.hazard, { lw: 6 });
    C.shape(ctx, [[60, 50], [-20, 70], [-120, 40], [-140, 10], [-130, -20], [-140, -48], [-118, -70], [-30, -72], [20, -110], [50, -100], [40, -60], [90, -40]], P.skin, { lw: 6, shade: c => C.blot(c, [[-140, 20], [80, 30], [80, 90], [-140, 90]], P.skinDk, .55) });
    for (let i = 0; i < 3; i++) C.line(ctx, [[-30, -40 + i * 28], [-120, -46 + i * 30]], 3.6, P.skinDk);
    ctx.restore();
  }
  // el feneri (b27): sağ alttan tutulan küçük fener
  function drawTorch(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); C.seed(441);
    limb(ctx, [0, 120], [80, 900], 70, 96, P.jacket, 442);
    C.shape(ctx, [[-72, 150], [72, 140], [76, 182], [-74, 192]], P.hazard, { lw: 5 });
    C.shape(ctx, [[-50, 140], [50, 136], [56, 40], [-46, 44]], P.skin, { lw: 6 });
    C.shape(ctx, [[-26, 60], [26, 60], [26, -120], [-26, -120]], P.steelDk, { lw: 6 });
    C.shape(ctx, [[-36, -120], [36, -120], [30, -160], [-30, -160]], P.steel, { lw: 6 });
    ctx.restore();
  }
  // çatlaktan dökülen sıva zerreleri (çıtırtı anı)
  function plaster(ctx, t, t0, x, y) {
    const tau = t - t0; if (tau < 0 || tau > 1.6) return;
    for (let i = 0; i < 7; i++) {
      const r = j => rnd(5100 + i * 7 + j), d = tau - r(1) * .25; if (d < 0) continue;
      const px = x + (r(2) - .5) * 7 + d * (r(3) - .5) * 15, py = y + 4 + 260 * d * d;
      ctx.fillStyle = i % 2 ? 'rgba(216,202,176,.95)' : 'rgba(152,140,122,.9)'; ctx.beginPath(); ctx.arc(px, py, 1 + r(4) * 1.6, 0, TAU); ctx.fill();
    }
  }
  // çatlağın kendi çizgisi (ışık sızması için; drawOffice ile aynı noktalar)
  const CRACK = (() => { const a = OFF, kx = OF.kx; return [[kx - 4, -60], [kx - 1, -30], [kx - 6, a.y], [kx + 10, a.y + a.h * .12], [kx - 4, a.y + a.h * .24], [kx + 14, a.y + a.h * .36], [kx + 2, a.y + a.h * .48], [kx + 18, a.y + a.h * .6], [kx + 6, OF.fl]]; })();
  const crackX = y => { for (let i = 0; i < CRACK.length - 1; i++) if (y <= CRACK[i + 1][1]) return lerp(CRACK[i][0], CRACK[i + 1][0], (y - CRACK[i][1]) / (CRACK[i + 1][1] - CRACK[i][1])); return CRACK[CRACK.length - 1][0]; };

  /* ================= AVLU + DAISY (bugün gece / 2. bölüm gündüz) ================= */
  const YD = { x: 760, y: 1420, s: .9 };
  function yardBg(mode) { return blurred('avlu-' + mode, 7, g => { cam(g, 1.7, 700, 1100); C.drawYard(g, { mode, lightOn: true, seed: 7 }); }); }
  // Uyarı ışığı tek başına (Daisy yerel koordinatı): bipte yalnız bu değişir; farlar yanmaz. (pilotla aynı)
  function drawBeacon(ctx, v) {
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(k => { const r = 40 + k * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - k * .2) * Math.min(1, v * 1.5), null, .5); }));
  }

  /* ================= 1. BÖLÜM ARSASI (hatıra; pilot b-sahneler.js'den kopya) ================= */
  const WD = { hz: 1060, cx: 560, cb: 1100, H: 870, bw: 130, tw: 78, dX: 878, dY: 1180 };
  const BG = { x: -1100, y: -800, w: 3300, h: 3600, horizon: (1060 + 800) / 3600, chimneyX: -1, seed: 5, dust: .25 };
  const TIP = [WD.dX - 118.8, WD.dY - 858.1], ROPE = 455, BALL_R = 58, SW0 = 1.15;
  const PIV = [WD.cx - WD.bw / 2, WD.cb - 18];
  const ZONE = { x: 800, y: 1240, w: 360, h: 100 };
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
  function drawLot(ctx) {
    C.seed(61);
    ctx.save(); ctx.globalAlpha = .55;
    for (let i = 0; i < 8; i++) { const x = -720 + i * 150; C.line(ctx, [[x, 1122], [x - 60, 1290]], 7, P.paper, .6); }
    C.line(ctx, [[-760, 1290], [420, 1290]], 7, P.paper, .5);
    ctx.restore();
    for (let i = 0; i < 7; i++) { const x = -690 + i * 150; C.shape(ctx, [[x - 46, 1262], [x + 30, 1262], [x + 28, 1276], [x - 48, 1276]], P.concrete, { lw: 2.6, amp: .5 }); }
    C.line(ctx, [[-560, 1110], [-560, 960]], 6, P.steelDk, .3);
    C.shape(ctx, [[-604, 900], [-516, 900], [-516, 980], [-604, 980]], P.paper, { lw: 3.4 });
    ctx.save(); ctx.font = '700 64px Rubik'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.fillText('P', -560, 964); ctx.restore();
  }
  function drawChalkArrow(ctx) {
    ctx.save(); ctx.strokeStyle = 'rgba(248,244,232,.85)'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.setLineDash([26, 18]);
    ctx.beginPath(); ctx.moveTo(WD.cx + 70, WD.cb + 22); ctx.quadraticCurveTo(620, 1180, 660, 1214); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(632, 1214); ctx.lineTo(664, 1218); ctx.lineTo(662, 1186); ctx.stroke(); ctx.restore();
  }
  function drawPlinth(ctx) {
    const cx = WD.cx, cb = WD.cb, bw = WD.bw; C.seed(55);
    C.shape(ctx, [[cx - bw / 2 - 22, cb + 4], [cx + bw / 2 + 22, cb + 4], [cx + bw / 2 + 16, cb - 22], [cx - bw / 2 - 16, cb - 22]], P.concrete, { lw: 3.4, shade: c => C.blot(c, [[cx + 10, cb - 30], [cx + 100, cb - 30], [cx + 100, cb + 10], [cx + 20, cb + 10]], P.dustDk, .35) });
  }
  function drawBall(ctx, sw) {
    const bx = TIP[0] + Math.sin(sw) * ROPE, by = TIP[1] + Math.cos(sw) * ROPE, hk = [TIP[0] + Math.sin(sw) * 404, TIP[1] + Math.cos(sw) * 404];
    C.seed(71);
    C.line(ctx, [hk, [bx - Math.sin(sw) * BALL_R, by - Math.cos(sw) * BALL_R]], 6, P.ink, .2);
    C.shape(ctx, C.ell(bx, by, BALL_R, BALL_R, 26), P.steel, { lw: 5, shade: c => { C.blot(c, C.ell(bx + 18, by + 16, BALL_R * .9, BALL_R * .85, 18), P.steelDk, .8); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(bx - 20, by - 22, 14, 8, -.6, 0, TAU); c.fill(); } });
  }
  function drawP1World(ctx, o) {
    o = o || {};
    C.drawBackground(ctx, BG);
    drawLot(ctx); drawChalkArrow(ctx);
    const cv = chimneyCv(), ox = WD.cx - CH.cx, oy = WD.cb - CH.cb;
    ctx.save(); ctx.translate(PIV[0], PIV[1]); ctx.rotate(o.fall || 0); ctx.translate(-PIV[0], -PIV[1]); ctx.drawImage(cv, ox, oy); ctx.restore();
    drawPlinth(ctx);
    if (o.daisy !== false) { const sw = o.sw == null ? SW0 : o.sw; drawBall(ctx, sw); C.drawDaisy(ctx, { x: WD.dX, y: WD.dY, s: 1, seed: 23, hook: sw, beep: 0, mood: o.mood || 'sleepy' }); }
    TB.zone(ctx, ZONE.x, ZONE.y, ZONE.w, ZONE.h, 1);
  }
  const DAISY_CU = { z: 2.04, fx: 0, fy: -230, sx: 470, sy: 820 };      // pilotun bip yakın planı

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  // planCam: çizim sahnesi kamerası (z, odak dünya, ekran noktası)
  function planCam(t) {
    const k = times();
    if (t < k.cu16) { const u = E.io(seg(t, k.start, k.cu16)), a = planW(-210, -10), f = planW(-130, 40); return [lerp(1.55, 1.62, u), lerp(a[0], f[0], u), lerp(a[1], f[1], u), 540, 800]; }
    if (t < k.trace) { const u = E.io(seg(t, k.cu16, k.trace)), f = planW(-20, 66); return [lerp(2.3, 2.4, u), f[0], f[1], 540, 720]; }
    // ışığa doğru: odak parmakla yürür, sonunda ışık simgesi (470,583) ekran noktasına oturur (gerçek Daisy'nin ışığıyla aynı yer/boy)
    const u = E.io(seg(t, k.trace, k.lightArr + .1)), a = planW(-20, 30), b = planW(-200, -126);
    return [lerp(2.3, 2.1, u), lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(540, 470, u), lerp(760, 583, u)];
  }
  function planShot(ctx, t, withFinger) {
    const [z, fx, fy, sx, sy] = planCam(t);
    ctx.save(); cam(ctx, z, fx, fy, sx, sy);
    drawPlanScene(ctx, t);
    if (withFinger) { const f = fingerAt(t), w = planW(f.p[0], f.p[1]); drawPointer(ctx, w[0], w[1], f.rot + PL.rot, .62, f.press); }
    ctx.restore();
    deskLight(ctx);
  }

  /* --- 15: "Grandpa built something into her." parmak çizimde kabinin içine yürür --- */
  shot('p4b15-cizim', k => k.start, k => k.cu16, (ctx, t) => { planShot(ctx, t, true); finish(ctx); });
  /* --- 16: "A sensor." kutuya yakın, parmak dokunur --- */
  shot('p4b16-sensor', k => k.cu16, k => k.trace, (ctx, t) => { planShot(ctx, t, true); finish(ctx); });
  /* --- 17: kesikli çizgi boyunca ışığa; ışık simgesi gerçek Daisy'nin ışığına dönüşür --- */
  shot('p4b17-iz', k => k.trace, k => k.dis2, (ctx, t) => { planShot(ctx, t, true); finish(ctx); });

  /* --- 17–18: gerçek Daisy, gece; iki bip (bipte hiçbir şey kıpırdamaz) --- */
  function daisyCU(g, t) {
    const k = times(), tf = freezeIn(t, k.beep);
    let z;
    if (tf < k.freeze0) z = lerp(2.3, 2.04, E.outC(seg(tf, k.dis1, k.freeze0)));
    else z = 2.04 + .1 * E.io(seg(t, k.freeze1, k.stop));
    g.drawImage(yardBg('night'), 0, 0);
    g.save(); cam(g, z, 0, -346, 470, 583);
    C.drawDaisy(g, { x: 0, y: 0, s: 1, seed: 23, beep: 0, mood: tf >= k.alert ? 'alert' : 'sleepy', hook: .02, boom: 0 });
    drawBeacon(g, beepAt(t, k.beep));
    g.restore();
    // gece: kabinin önü avlu lambasıyla hafif aydınlık
    nightLight(g, [[470, 900, 700, .9, 900]], .45);
    vignette(g, .5);
  }
  shot('p4b17-daisy', k => k.dis1, k => k.stop, (ctx, t) => {
    const k = times(), a = E.io(seg(t, k.dis1, k.dis2));
    const g = layer('daisy'); daisyCU(g, t);
    ctx.globalAlpha = a; ctx.drawImage(layers.daisy, 0, 0); ctx.globalAlpha = 1;
    finish(ctx);
  });

  /* --- 19: "It means: stop." dedenin el yazısı, sessiz yakın plan --- */
  shot('p4b19-stop', k => k.stop, k => k.grumpy, (ctx, t, u) => {
    const f = planW(150, 100), z = lerp(2.65, 2.85, E.io(u));
    ctx.save(); cam(ctx, z, f[0], f[1], 540, 700);
    drawPlanScene(ctx, t);
    ctx.restore();
    deskLight(ctx);
    finish(ctx);
  });

  /* --- 20: "So Daisy was never grumpy." bugün, gece avluda uykulu Daisy --- */
  shot('p4b20-uykulu', k => k.grumpy, k => k.mem1, (ctx, t, u) => {
    const z = lerp(1.55, 1.68, E.io(u));
    ctx.save(); cam(ctx, z, YD.x - 10, YD.y - 150 * YD.s, 540, 800);
    C.drawYard(ctx, { mode: 'night', lightOn: true, seed: 7 });
    C.drawDaisy(ctx, { x: YD.x, y: YD.y, s: YD.s, seed: 23, beep: 0, mood: 'sleepy', hook: .02 * Math.sin(t * 1.3), boom: 1 });
    const S = toScr(z, YD.x - 10, YD.y - 150 * YD.s, 540, 800);
    ctx.restore();
    const [hx, hy] = S(YD.x, YD.y - 156 * YD.s);
    nightLight(ctx, [[hx, hy, 520, .85, 420]], .4);
    airDust(ctx, t, 18, 9, [0, 300, 1080, 900], .6);
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 21: "Daisy was warning me." sepya hatıra: 1. bölümün bip yakın planı, ışık iki kez --- */
  shot('p4b21-hatira', k => k.mem1, k => k.mem2, (ctx, t, u) => {
    const k = times(), tf = freezeIn(t, k.memBeep), uz = seg(tf, k.mem1, k.mem2), v = beepAt(t, k.memBeep);
    const bg = blurred('p1-daisy-bg', 7, g => { cam(g, 1.15, 1250, 800); drawP1World(g, { daisy: false }); });
    const z = DAISY_CU.z + .04 * uz;
    memory(ctx, m => {
      m.save(); m.translate(540, 960); m.scale(1.05, 1.05); m.drawImage(bg, -540, -960); m.restore();
      m.save(); cam(m, z, DAISY_CU.fx, DAISY_CU.fy, DAISY_CU.sx, DAISY_CU.sy);
      C.drawDaisy(m, { x: 0, y: 0, s: 1, seed: 23, beep: 0, mood: 'alert', hook: SW0 });
      m.restore();
    });
    if (v > 0) { // hatırada da ışık kırmızı yanar (tek renkli an), pilottaki gibi
      ctx.save(); cam(ctx, z, DAISY_CU.fx, DAISY_CU.fy, DAISY_CU.sx, DAISY_CU.sy); drawBeacon(ctx, v); ctx.restore();
    }
    vignette(ctx, 0, 'rgba(30,20,10,.85)');
    finish(ctx);
  });

  /* --- 22: "At the chimney, she was right." sepya: baca tebeşir okunun tersine yatar (ağır çekim) --- */
  shot('p4b22-baca', k => k.mem2, k => k.cal, (ctx, t, u) => {
    const e = E.io(u), fall = -.62 * E.inQ(seg(u, .05, 1));
    memory(ctx, m => {
      m.save(); cam(m, lerp(.8, .9, e), lerp(620, 520, e), lerp(1000, 900, e), 540, 900);
      drawP1World(m, { fall, sw: -.17 + .05 * Math.sin(t * 2), mood: 'alert' });
      // tabandan kalkan ince toz
      for (let i = 0; i < 9; i++) { const r = j => rnd(6100 + i * 5 + j), d = clamp(u * 1.3 - r(1) * .3); if (d <= 0) continue; m.fillStyle = `rgba(216,202,176,${.55 * (1 - d * .5)})`; m.beginPath(); m.arc(PIV[0] - 20 + r(2) * 160 - d * 120 * r(3), WD.cb - 10 - d * 70 * r(4), 14 + d * 40 * r(5), 0, TAU); m.fill(); }
      m.restore();
    });
    vignette(ctx, 0, 'rgba(30,20,10,.85)');
    finish(ctx);
  });

  /* --- 23: "Then I saw the calendar on the wall." ofis, Kaan takvime döner --- */
  shot('p4b23-ofis', k => k.cal, k => k.low, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u), z = lerp(1.45, 1.55, e), fx = lerp(600, 660, e), fy = lerp(450, 420, e);
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, 0, false);
    const look = tw < k.calWord - .2 ? .2 : 1;
    C.drawKaan(ctx, { x: 470, y: 780, s: 1.0, seed: 11, pose: 'side', expr: tw < k.calWord ? 'calm' : 'serious', look, step: 0 });
    const S = toScr(z, fx, fy);
    ctx.restore();
    roomLight(ctx, S, [[...S(480, 780 - 470), 260, .7]]);
    finish(ctx);
  });

  /* --- 24: "It was hanging very low." takvime yakın; çividen alt kenara, zemine eğilir --- */
  shot('p4b24-alcak', k => k.low, k => k.move, (ctx, t, u) => {
    const e = E.io(u), z = 3.0, fx = OF.kx - 10, fy = lerp(OF.cy - 40, OF.cy + OF.ch + 50, e);
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, 0, false);
    const S = toScr(z, fx, fy);
    ctx.restore();
    roomLight(ctx, S);
    airDust(ctx, t, 14, 12, [100, 300, 900, 800], .5);
    finish(ctx);
  });

  /* --- 25–26: "I moved it." el takvimi kaydırır; "Behind it, a crack." çatlak, sessiz, yavaş itme --- */
  function calMove(t) { const k = times(); return E.io(seg(twos(t), k.grab + .12, k.slide1)); }
  shot('p4b25-catlak', k => k.move, k => k.tilt, (ctx, t, u) => {
    const k = times(), tw = twos(t), cm = calMove(t);
    const pu = E.io(seg(t, k.slide1 - .2, k.tilt)), z = lerp(2.6, 3.7, pu), fx = (lerp(OF.kx + 40, OF.kx + 6, pu)), fy = lerp(OF.cy + OF.ch * .42, OF.cy + OF.ch * .32, pu);
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, cm, false);
    // el: soldan girer, takvimin sol kenarını kavrar, birlikte sağa iter, sonra çekilir
    const cx = OF.cx0 + cm * CM * OF.w * .2, ein = E.outC(seg(tw, k.move, k.grab + .1)), eout = E.inQ(seg(tw, k.slide1 + .02, k.slide1 + .4));
    const hx = cx + 6 - (1 - ein) * 260 - eout * 320, hy = OF.cy + OF.ch * .45 + (1 - ein) * 130 + eout * 210;
    if (eout < 1) drawSideHand(ctx, hx, hy, .3, .4);
    plaster(ctx, t, k.crack, crackX(OF.cy + OF.ch * .3), OF.cy + OF.ch * .3);
    const S = toScr(z, fx, fy);
    ctx.restore();
    roomLight(ctx, S, null, .82, 165);
    finish(ctx);
  });

  /* --- 27: "From the floor to the ceiling." fener çatlak boyunca yerden tavana --- */
  shot('p4b27-tavan', k => k.tilt, k => k.face, (ctx, t, u) => {
    const k = times(), e = E.io(seg(t, k.tilt, k.ceil + .2)), z = 2.3;
    const fy = lerp(OF.fl - 150, OF.top + 120, e), fx = OF.kx - 20;
    const by = lerp(OF.fl - 30, OF.top - 20, E.io(seg(t, k.tilt - .1, k.ceil + .1)));    // fener ışığı kameradan önde
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, 1, true);
    const S = toScr(z, fx, fy);
    ctx.restore();
    const [lx, lys] = S(crackX(by), by);
    roomLight(ctx, S, [[lx, lys, 330, 1, 300]], .86);
    glow(ctx, lx, lys, 300, '255,226,150', .22);
    finish(ctx);
  });

  /* --- 28: "And I remembered." Kaan'ın yüzü --- */
  shot('p4b28-yuz', k => k.face, k => k.door, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurred('ofis-bg', 8, g => { cam(g, 2.4, OF.kx - 60, 380); drawRoom(g, 1, true); nightLight(g, [[540 + 60 * 2.4, 960, 420, .9, 700]], .8); });
    ctx.drawImage(bg, 0, 0);
    const blink = tw >= k.rem + .45 && tw < k.rem + .45 + 3 / FPS ? 1 : 0;
    ctx.save(); cam(ctx, lerp(1, 1.04, E.io(u)), 540, 900);
    C.drawKaan(ctx, { x: 470, y: 2190, s: 3.2, seed: 11, expr: tw >= k.rem ? 'surprised' : 'serious', look: tw >= k.rem ? -.2 : .7, blink, phone: false });
    ctx.restore();
    nightLight(ctx, [[640, 640, 620, .9, 760]], .55);
    glow(ctx, 900, 520, 520, '255,210,122', .12);
    finish(ctx);
  });

  /* --- 29: "Daisy beeped at this door." sepya: 2. bölüm, kapalı ofis kapısı, önünde Daisy; ışık iki kez --- */
  shot('p4b29-kapi', k => k.door, k => k.endShot, (ctx, t, u) => {
    const k = times(), tf = freezeIn(t, k.doorBeep), e = E.io(seg(tf, k.door, k.endShot));
    const z = lerp(1.18, 1.26, e), fx = lerp(620, 640, e), fy = lerp(1090, 1080, e), v = beepAt(t, k.doorBeep);
    memory(ctx, m => {
      m.save(); cam(m, z, fx, fy);
      C.drawYard(m, { mode: 'day', seed: 7 });
      C.drawDaisy(m, { x: YD.x, y: YD.y, s: YD.s, seed: 23, beep: 0, mood: 'alert', hook: 0, boom: 1 });
      m.restore();
    });
    if (v > 0) { ctx.save(); cam(ctx, z, fx, fy); ctx.translate(YD.x, YD.y); ctx.scale(YD.s, YD.s); drawBeacon(ctx, v); ctx.restore(); }
    vignette(ctx, 0, 'rgba(30,20,10,.85)');
    finish(ctx);
  });

  /* --- Bitiş: çatlak üst üçte birde; endBeep'te TEK bip: Daisy'nin kırmızı ışığı çatlaktan bir kez sızar; kart altta --- */
  const END = { z: 2.6, fx: OF.kx - 60, fy: 292 };
  shot('p4b-son', k => k.endShot, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = freezeIn(t, k.endBeep, 1), v = beepAt(t, k.endBeep, 1);
    const z = END.z * (1 + .025 * E.outC(seg(tf, k.endShot, k.endBeep - .3)) + .012 * seg(t, k.endBeep + .6, k.dur)), fx = END.fx, fy = END.fy;
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, 1, true);
    const S = toScr(z, fx, fy);
    ctx.restore();
    roomLight(ctx, S, [[...S(OF.kx, 140), 380, .75, 520]], .82);
    if (v > 0) { // kırmızı ışık çatlaktan sızar (yalnız tonun 6 karesi)
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const pts = CRACK.map(([x, y]) => S(x, y));
      [[46, .22], [22, .45], [9, .9], [4, 1]].forEach(([w, a]) => { ctx.strokeStyle = w > 5 ? `rgba(255,59,47,${a * v})` : `rgba(255,214,190,${a * v})`; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); });
      ctx.restore();
      const [gx, gy] = S(crackX(120), 120); glow(ctx, gx, gy, 420, P.glow, .35 * v);
    }
    // kart için yalnız alt kısım kararır; çatlağın üstü açıkta
    const dk = .6 * E.io(seg(t, k.endCard - .1, k.endCard + .2));
    if (dk > 0) { const g = ctx.createLinearGradient(0, 600, 0, 900); g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(1, `rgba(7,11,24,${dk})`); ctx.fillStyle = g; ctx.fillRect(0, 600, 1080, 1320); }
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const r3 = x => +x.toFixed(3);
  TB.cuesB = {
    get parmakKagit() { return r3(times().trace0); },          // parmak ucu kâğıtta kayar (kısa kâğıt sürtmesi)
    get parmakDokunus() { return r3(times().tap); },           // "sensor"de kutuya dokunuş
    get bip() { return r3(times().beep); },                    // daisy-beep.wav başlangıcı (ışık +0,04 ve +0,37'de)
    get hatiraBip() { return r3(times().memBeep); },           // sepya hatıra, ışık iki kez (pilot b27 gibi; ses ekibi karar versin)
    get takvimTut() { return r3(times().grab + .12); },        // el takvimi kavrar (kâğıt)
    get takvimKay() { return r3(times().slide1); },             // takvim yerine oturur, çatlak açıkta
    get catlakCitirti() { return r3(times().crack); },         // ince çıtırtı, sıva zerreleri düşer
    get kapiHatiraBip() { return r3(times().doorBeep); },      // 2. bölüm kapı önü hatırası, ışık iki kez
    get sonBip() { return r3(times().endBeep); }               // tek bip; kırmızı ışık çatlaktan +0,04–0,24
  };
})();
