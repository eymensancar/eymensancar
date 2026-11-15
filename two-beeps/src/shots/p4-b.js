/* Part 4 · Animatör B: cümle 15–29 ve bitiş görüntüsü. Başlangıç (S14.t1+S15.t0)/2 ≈ 25,38 sn, bitiş tl.duration.
   YERLEŞİM (öbür yarı aynısını kullansın):
   - OFİS: C.drawOffice(ctx, {x:0,y:0,w:1080,h:1920, seed:7, lamp:true}) (varsayılan alan). Gece, masa lambası yanık.
     Çatlak x≈800 (alan.x + .74w), yerden (y 1344 = zemin çizgisi) tavana (y 0). Takvim kapalıyken x 691–907, y 576–1152;
     calendarMoved 1'de x 907–1123. Masa x 43–713, üst yüzü y 1190; lamba x≈645. Tavan pervazı y 0'ın üstünde (bu dosyada çizilir).
     Çatlağın takvim dışında kalan kısmı takvim kaydırılana kadar çizilmez (drawOffice onu hep çizer; burada kırpılır).
   - SENSÖR ÇİZİMİ: masada, üstten; C.drawSensorPlan(ctx, {x:540, y:760, s:1, rot:-.03}). Kâğıttaki ışık simgesi yerel (-200,-126).
   - AVLU (gece, şimdiki zaman / 2. bölüm kapı önü gündüz): C.drawYard varsayılan alan; ofis kapısı x 445–573, alt y 1267;
     Daisy kapının sağ önünde: drawDaisy {x:760, y:1420, s:.9, boom:1} (kanca kabinin üstünde kalır).
   - 1. BÖLÜM ARSASI (hatıra): pilotun b-sahneler.js dünyasının kopyası: baca tabanı (560,1100), Daisy (878,1180), alan TB.zone (800,1240). */
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
    k.enter = S(15).t0 - .1;                              // parmak girer
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
  const bx = (z, fx) => Math.min(fx, OFF.x + OFF.w - 540 / z);   // ofis kamerası alanın sağ kenarını aşmaz
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
  const PL = { x: 540, y: 760, s: 1, rot: -.03 };
  const planW = (lx, ly) => { const c = Math.cos(PL.rot), s = Math.sin(PL.rot); return [PL.x + (lx * c - ly * s) * PL.s, PL.y + (lx * s + ly * c) * PL.s]; };
  function drawDesk(ctx) {
    const cv = cached('masa', 2200, 2400, c => {
      c.translate(560, 500); c.scale(1.375, 1.5); c.fillStyle = P.wood; c.fillRect(-260, 0, 1600, 1600);
      C.seed(301);
      for (let y = -40; y < 1600; y += 150) { C.line(c, [[-260, y], [1340, y + 8]], 3, 'rgba(21,18,13,.55)', 1.2); for (let i = 0; i < 4; i++) C.line(c, [[-260 + rnd(y + i) * 600, y + 30 + i * 28], [200 + rnd(y + i + 9) * 1100, y + 34 + i * 28]], 1.6, 'rgba(63,39,17,.5)', 1.5); }
      for (let i = 0; i < 40; i++) C.blot(c, C.ell(-260 + rnd(500 + i) * 1600, rnd(600 + i) * 1600, 30 + rnd(700 + i) * 90, 8 + rnd(800 + i) * 14, 10), i % 3 ? '#4a2e16' : '#6e4a28', .35);
      c.fillStyle = 'rgba(216,202,176,.16)'; c.fillRect(-260, 0, 1600, 1600);                 // toz
    });
    ctx.drawImage(cv, -560, -500);
  }
  function drawPlanScene(ctx, t) {
    drawDesk(ctx);
    C.drawSensorPlan(ctx, { x: PL.x, y: PL.y, s: PL.s, rot: PL.rot, seed: 97 });
  }
  // masa sahnesinin ışığı: lamba sağ üstten sıcak, köşeler karanlık
  function deskLight(ctx) {
    glow(ctx, 760, 420, 900, '255,210,122', .16);
    vignette(ctx, .62);
  }
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
      const p = along(PATH15, E.io(seg(tw, k.trace0, k.trace1)));
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

  /* ================= OFİS ================= */
  const OFF = { x: 0, y: 0, w: 1080, h: 1920, seed: 7 };
  const OF = (() => { const a = OFF, kx = a.x + a.w * .74; return { kx, fl: a.y + a.h * .7, top: a.y, cx0: kx - a.w * .1, cy: a.y + a.h * .3, cw: a.w * .2, ch: a.h * .3, tx: a.x + a.w * .04, tw: a.w * .62, ty: a.y + a.h * .62, lamp: [a.x + a.w * (.04 + .62 * .9), a.y + a.h * .62 - 140] }; })();
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
  function drawCeiling(ctx) {
    C.seed(331);
    ctx.fillStyle = '#2a2f33'; ctx.fillRect(OFF.x - 400, OFF.y - 600, OFF.w + 800, 600);
    for (let x = OFF.x - 400; x < OFF.x + OFF.w + 400; x += 120) C.line(ctx, [[x, OFF.y - 600], [x + 30, OFF.y - 40]], 2, 'rgba(0,0,0,.4)', 1);
    C.shape(ctx, [[OFF.x - 400, OFF.y - 46], [OFF.x + OFF.w + 400, OFF.y - 46], [OFF.x + OFF.w + 400, OFF.y + 14], [OFF.x - 400, OFF.y + 14]], '#8d8a80', { lw: 4, shade: c => C.blot(c, [[OFF.x - 400, OFF.y - 4], [OFF.x + OFF.w + 400, OFF.y - 4], [OFF.x + OFF.w + 400, OFF.y + 16], [OFF.x - 400, OFF.y + 16]], '#5a5850', .8) });
  }
  // Ofis: cm takvim konumu; full true: çatlak bütün boyuyla
  function drawRoom(ctx, cm, full) {
    drawCeiling(ctx);
    const clip = full ? null : [OF.kx - 120, OF.cy + 4, 240, OF.ch - 8];
    drawOfficeClip(ctx, Object.assign({}, OFF, { lamp: true, calendarMoved: cm }), clip);
  }
  // Ofisin ışığı (gece): lamba havuzu + takvim/çatlak bölgesi; üst duvar ve köşeler karanlık
  function roomLight(ctx, S, extra, a, cry) {
    const [lx, ly] = S(OF.lamp[0], OF.lamp[1] + 60), [cx, cy] = S(OF.kx, OF.cy + OF.ch * .5), [, y0] = S(0, 0), [, y1] = S(0, 100), z = (y1 - y0) / 100;
    nightLight(ctx, [[lx, ly, 560 * z, .95, 440 * z], [cx, cy, 300 * z, .8, (cry || 460) * z]].concat(extra || []), a == null ? .78 : a);
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
      const px = x + (r(2) - .5) * 14 + d * (r(3) - .5) * 30, py = y + 4 + 520 * d * d;
      ctx.fillStyle = i % 2 ? 'rgba(216,202,176,.95)' : 'rgba(152,140,122,.9)'; ctx.beginPath(); ctx.arc(px, py, 2 + r(4) * 3, 0, TAU); ctx.fill();
    }
  }
  // çatlağın kendi çizgisi (ışık sızması için; drawOffice ile aynı noktalar)
  const CRACK = (() => { const a = OFF, kx = OF.kx; return [[kx - 6, a.y], [kx + 10, a.y + a.h * .12], [kx - 4, a.y + a.h * .24], [kx + 14, a.y + a.h * .36], [kx + 2, a.y + a.h * .48], [kx + 18, a.y + a.h * .6], [kx + 6, OF.fl]]; })();
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
    if (t < k.cu16) { const u = E.io(seg(t, k.start, k.cu16)), f = planW(-120, 40); return [lerp(1.2, 1.42, u), lerp(PL.x, f[0], u * .6), lerp(PL.y + 40, f[1] + 20, u * .6), 540, 700]; }
    if (t < k.trace) { const u = E.io(seg(t, k.cu16, k.trace)), f = planW(-20, 66); return [lerp(2.5, 2.62, u), f[0], f[1], 540, 720]; }
    // ışığa doğru: odak parmakla yürür, sonunda ışık simgesi (470,583) ekran noktasına oturur
    const u = E.io(seg(t, k.trace, k.lightArr + .1)), a = planW(-20, 30), b = planW(-200, -126);
    const z = lerp(2.5, 2.3, u), sx = lerp(540, 470, u), sy = lerp(760, 583, u);
    return [z, lerp(a[0], b[0], u), lerp(a[1], b[1], u), sx, sy];
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
    const f = planW(150, 100), z = lerp(2.9, 3.15, E.io(u));
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
    const k = times(), tw = twos(t), e = E.io(u), z = lerp(1.0, 1.08, e), fx = bx(z, lerp(540, 620, e)), fy = lerp(980, 940, e);
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, 0, false);
    const look = tw < k.calWord - .2 ? .2 : 1;
    C.drawKaan(ctx, { x: 360, y: 1800, s: 1.5, seed: 11, pose: 'side', expr: tw < k.calWord ? 'calm' : 'serious', look, step: 0 });
    const S = toScr(z, fx, fy);
    ctx.restore();
    roomLight(ctx, S, [[...S(360, 1800 - 470 * 1.5), 260, .7]]);
    finish(ctx);
  });

  /* --- 24: "It was hanging very low." takvime yakın; çividen alt kenara, zemine eğilir --- */
  shot('p4b24-alcak', k => k.low, k => k.move, (ctx, t, u) => {
    const e = E.io(u), z = 1.7, fx = bx(1.7, OF.kx - 10), fy = lerp(OF.cy - 60, OF.cy + OF.ch + 90, e);
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, 0, false);
    const S = toScr(z, fx, fy);
    ctx.restore();
    roomLight(ctx, S);
    airDust(ctx, t, 14, 12, [100, 200, 900, 1000], .5);
    finish(ctx);
  });

  /* --- 25–26: "I moved it." el takvimi kaydırır; "Behind it, a crack." çatlak, sessiz, yavaş itme --- */
  function calMove(t) { const k = times(); return E.io(seg(twos(t), k.grab + .12, k.slide1)); }
  shot('p4b25-catlak', k => k.move, k => k.tilt, (ctx, t, u) => {
    const k = times(), tw = twos(t), cm = calMove(t);
    const pu = E.io(seg(t, k.slide1 - .2, k.tilt)), z = lerp(1.32, 1.9, pu), fx = bx(z, lerp(OF.kx + 40, OF.kx + 6, pu)), fy = lerp(OF.cy + OF.ch * .42, OF.cy + OF.ch * .32, pu);
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, cm, false);
    // el: soldan girer, takvimin sol kenarını kavrar, birlikte sağa iter, sonra çekilir
    const cx = OF.cx0 + cm * OF.w * .2, ein = E.outC(seg(tw, k.move, k.grab + .1)), eout = E.inQ(seg(tw, k.slide1 + .02, k.slide1 + .4));
    const hx = cx + 10 - (1 - ein) * 520 - eout * 640, hy = OF.cy + OF.ch * .45 + (1 - ein) * 260 + eout * 420;
    if (eout < 1) drawSideHand(ctx, hx, hy, .3, .78);
    plaster(ctx, t, k.crack, crackX(OF.cy + OF.ch * .3), OF.cy + OF.ch * .3);
    const S = toScr(z, fx, fy);
    ctx.restore();
    roomLight(ctx, S, null, .82, 330);
    finish(ctx);
  });

  /* --- 27: "From the floor to the ceiling." fener çatlak boyunca yerden tavana --- */
  shot('p4b27-tavan', k => k.tilt, k => k.face, (ctx, t, u) => {
    const k = times(), e = E.io(seg(t, k.tilt, k.ceil + .2)), z = 1.25;
    const fy = lerp(OF.fl - 280, OF.top + 380, e), fx = bx(z, OF.kx - 20);
    const by = lerp(OF.fl - 60, OF.top + 90, E.io(seg(t, k.tilt - .1, k.ceil + .1)));    // fener ışığı kameradan önde
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
    const bg = blurred('ofis-bg', 8, g => { cam(g, 1.3, OF.x + OF.w - 540 / 1.3, 760); drawRoom(g, 1, true); nightLight(g, [[540 + 60 * 1.3, 960, 420, .9, 700]], .8); });
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
  const END = { z: 1.5, fx: OF.kx - 90, fy: 520 };
  shot('p4b-son', k => k.endShot, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = freezeIn(t, k.endBeep, 1), v = beepAt(t, k.endBeep, 1);
    const z = END.z * (1 + .025 * E.outC(seg(tf, k.endShot, k.endBeep - .3)) + .012 * seg(t, k.endBeep + .6, k.dur)), fx = bx(z, END.fx), fy = END.fy;
    ctx.save(); cam(ctx, z, fx, fy);
    drawRoom(ctx, 1, true);
    const S = toScr(z, fx, fy);
    ctx.restore();
    roomLight(ctx, S, [[...S(OF.kx, 300), 380, .75, 520]], .82);
    if (v > 0) { // kırmızı ışık çatlaktan sızar (yalnız tonun 6 karesi)
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const pts = CRACK.map(([x, y]) => S(x, y));
      [[46, .22], [22, .45], [9, .9], [4, 1]].forEach(([w, a]) => { ctx.strokeStyle = w > 5 ? `rgba(255,59,47,${a * v})` : `rgba(255,214,190,${a * v})`; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); });
      ctx.restore();
      const [gx, gy] = S(crackX(260), 260); glow(ctx, gx, gy, 420, P.glow, .35 * v);
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
