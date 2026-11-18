/* Part 7 · THE PROFESSOR — Animatör A: 0 – kesme (S11.t1 + S12.t0) / 2 ≈ 23,23 sn (cümle 1–11).
   YERLEŞİM (B aynı mekânları kullanırsa aynısını alsın):
   - KABİN (bugün, gece yağmur): Cizim.drawCabin {x:0,y:0,w:1080,h:1000,seed:41, people:false}; ön cam yamuğu x 65–1015, y 80–500.
     Kaan oturur (pose 'sit', seat false) (324,1220) s 1.84; Defne oturur (700,1200) s 1.92, Kaan'a bakar (look -.8). Gösterge paneli y ≥ 880.
     Ön camda 1. bölümün "my professor says" planı gri hatıra olarak durur, S2'de söner.
   - SEPYA HATIRA (0. kare): pilot b22 planı yeniden kuruldu: P1 arsası (b-sahneler/p4-b kopyası, baca yatık), bulanık; Kaan s 3.2, x 520.
   - GECE ODASI (pilot b-sahneler drawRoom kopyası; pencere x 60–420, y 250–760): yatak, battaniye, Kaan (500,1880) s 2.5; pencere geceden şafağa.
   - TELEFON yakın planı pilotla aynı: gövde 548×1000, ekran 486×864, merkez (540,770), z 1.3; iki el yandan.
   - MASA (son kare ≈23,23 sn): üstten-3/4 masa, kapalı üç ders kitabı (x≈470–760, y≈560–900), üstünde sınavdaki kalem,
     yanında yüzüstü telefon (≈(250,820)); şafak ışığı soldan. B'nin 12. cümlesi (parmak ilk hamleyi seçer) buradan devralır. */
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
    const S = i => tl.sentences[i - 1];
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[Math.min(n || 0, ws.length - 1)]; };
    const k = {};
    k.today = W(1, /^since/i, 6).t0 - .1;                 // sepya hatıradan bugüne (kabin)
    k.hookEnd = Math.min(S(1).t1 + .46, S(2).t0 - .1);    // büyük yazı kalkar → kamera kalkar
    k.dont = W(2, /^don/i, 1).t0;                         // Kaan bakışını indirir
    k.fade0 = W(2, /^professor/i, 4).t0; k.fade1 = S(2).t1 + .35;   // ön camdaki gri hatıra söner
    k.c3 = S(2).t1 + .25;                                 // boş kürsü
    k.c4 = W(3, /^school/i, 3).t0 - .05;                  // okul kapısı, mart
    k.c5 = S(4).t0 - .12;                                 // sınav salonu
    k.sit = W(4, /^sat/i, 1).t0;                          // oturur
    k.c6 = S(5).t0 - .1;                                  // kâğıt: ilk cevap
    k.w0 = W(5, /^knew/i, 1).t0; k.w1 = S(5).t1 + .1;     // yazma
    k.c7 = S(6).t0 - .15;                                 // el durur
    k.stop = W(6, /^stopped/i, 3).t0;                     // kalem havada kalır
    k.c8 = S(6).t1 + .15;                                 // saat
    k.c9 = S(7).t0 - .15;                                 // koridor
    k.door = k.c9 + .62;                                  // kapı kapanır
    k.c10 = S(8).t0 - .2;                                 // mesaj yazılır, silinir
    k.type0 = S(8).t0; k.type1 = k.type0 + .55; k.del0 = S(8).t1 - .05; k.del1 = k.del0 + .4;
    k.c11 = S(9).t0 - .1;                                 // gerçek oyun (telefon)
    k.c12 = W(9, /^until/i, 6).t0 - .1;                   // oda, pencere ağarır
    k.c13 = S(10).t0 - .2;                                // şafak, telefon kapanır
    k.off = W(10, /^teach/i, 3).t0;                       // oyun kapanır
    k.c14 = S(11).t0 - .22;                               // kapalı kitaplar
    k.end = (S(11).t1 + S(12).t0) / 2;                    // B ile ortak kesme
    K = k; return k;
  }
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* ================= YARDIMCILAR ================= */
  function cam(ctx, z, cx, cy, sx, sy) { ctx.translate(sx == null ? 540 : sx, sy == null ? 960 : sy); ctx.scale(z, z); ctx.translate(-cx, -cy); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const cache = {};
  function cached(key, w, h, fn) { if (!cache[key]) { const cv = canvas(w, h); fn(cv.getContext('2d')); cache[key] = cv; } return cache[key]; }
  function blurred(key, blur, fn) { return cached(key, 1080, 1920, c => { const tmp = canvas(1080, 1920); fn(tmp.getContext('2d')); c.filter = `blur(${blur}px)`; c.drawImage(tmp, 0, 0); c.filter = 'none'; }); }
  const layers = {};
  function layer(name) { if (!layers[name]) layers[name] = canvas(1080, 1920); const g = layers[name].getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 1080, 1920); return g; }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }
  function finish(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; C.grain(ctx, 0, 0, 1080, 1920, .2); }
  function vignette(ctx, a, col) {
    const g = ctx.createRadialGradient(540, 860, 300, 540, 900, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col || `rgba(7,11,24,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  }
  function glow(ctx, x, y, r, rgb, a) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 4, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore(); }
  function motes(ctx, t, n, sb, box, a, col) { // havada yavaş süzülen zerreler (birerli)
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (5 + r(2) * 14)) % box[2]), y = box[1] + ((r(3) * box[3] - t * (3 + r(7) * 8)) % box[3] + box[3]) % box[3] + Math.sin(t * .7 + r(4) * 6) * 10;
      ctx.fillStyle = `rgba(${col || '216,202,176'},${a * (.3 + r(5) * .5)})`; ctx.beginPath(); ctx.arc(x, y, 1.4 + r(6) * 3, 0, TAU); ctx.fill();
    }
  }
  // tek tonlu el yazısı (kurşun kalem): görünür kısmı 0..1
  function pencilText(ctx, text, x, y, size, rev, sd) {
    ctx.save(); ctx.beginPath(); ctx.rect(x - 10, y - size * 1.4, (size * .62 * text.length + 20) * rev, size * 2); ctx.clip();
    C.handwrite(ctx, text, x, y, size, '#4a4741', sd); ctx.restore();
  }
  let darkCv = null;
  function nightLight(ctx, holes, a, col) {
    if (!darkCv) darkCv = canvas(1080, 1920);
    const d = darkCv.getContext('2d'); d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, 1080, 1920);
    d.fillStyle = col || `rgba(4,6,16,${a})`; d.fillRect(0, 0, 1080, 1920); d.globalCompositeOperation = 'destination-out';
    holes.forEach(([x, y, r, s]) => { const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(.5, `rgba(0,0,0,${s * .55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(0, 0, 1080, 1920); });
    d.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkCv, 0, 0); ctx.restore();
  }
  const SEPIA = 'sepia(1) saturate(.55) brightness(.92) contrast(.92)';       // pilot hatıra karesi (p4-b ile aynı)
  const GRAY = 'grayscale(1) brightness(.78) contrast(.9)';

  /* ================= OYUN KARELERİ (gerçek: assets/img/oyun) ================= */
  const GAME_N = 150, gameImgs = [];
  for (let i = 1; i <= GAME_N; i++) gameImgs.push(TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg'));
  function gameIdx(t) {   // 9: k1 (1–55) yıkım + DEMOLISHED!, sonra k2'nin ilk 36 karesi döner (başarısızlık kartı yok)
    const k = times(), f = x => Math.floor(x * FPS + 1e-6);
    if (t < k.c11 + 55 / FPS) return clamp(f(t - k.c11), 0, 54);
    return 55 + f(t - k.c11 - 55 / FPS) % 36;                            // k2'nin yıkım kısmı (56–91), TIME'S UP'a varmadan döner
  }
  function gamePic(t) { const im = gameImgs[gameIdx(t)]; return im && im.complete && im.naturalWidth ? im : null; }
  function drawGame(ctx, t, x, y, w, h) { const im = gamePic(t); if (im) ctx.drawImage(im, x, y, w, h); else { ctx.fillStyle = '#2f3a4b'; ctx.fillRect(x, y, w, h); } }

  /* ================= 1. BÖLÜM ARSASI (hatıra; pilot b-sahneler.js / p4-b kopyası) ================= */
  const WD = { hz: 1060, cx: 560, cb: 1100, H: 870, bw: 130, tw: 78, dX: 878, dY: 1180 };
  const BG = { x: -1100, y: -800, w: 3300, h: 3600, horizon: (1060 + 800) / 3600, chimneyX: -1, seed: 5, dust: .25 };
  const TIP = [WD.dX - 118.8, WD.dY - 858.1], ROPE = 455, BALL_R = 58;
  const PIV = [WD.cx - WD.bw / 2, WD.cb - 18];
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
        }
      });
      [.32, .7].forEach(u => { const yy = cb - (cb - ct) * u, l = lx(yy, -1) - 6, r = lx(yy, 1) + 6; C.shape(c, [[l, yy - 9], [r, yy - 9], [r, yy + 7], [l, yy + 7]], P.brickDk, { lw: lw * .8 }); });
      C.shape(c, [[cx - tw / 2 - 12, ct + 18], [cx + tw / 2 + 12, ct + 18], [cx + tw / 2 + 8, ct - 6], [cx - tw / 2 - 8, ct - 6]], P.brickDk, { lw });
    });
  }
  function drawP1World(ctx) {
    C.drawBackground(ctx, BG);
    const cv = chimneyCv(), ox = WD.cx - CH.cx, oy = WD.cb - CH.cb;
    ctx.save(); ctx.translate(PIV[0], PIV[1]); ctx.rotate(-Math.PI / 2 + .04); ctx.translate(-PIV[0], -PIV[1]); ctx.drawImage(cv, ox, oy); ctx.restore();
    // yatık bacanın çevresinde moloz + yerleşmiş toz
    for (let i = 0; i < 26; i++) { const x = PIV[0] - 880 + rnd(300 + i) * 860, y = WD.cb + 20 + rnd(400 + i) * 90, w = 30 + rnd(500 + i) * 40; ctx.save(); ctx.translate(x, y); ctx.rotate((rnd(600 + i) - .5) * 1.4); C.seed(800 + i); C.shape(ctx, [[-w / 2, -10], [w / 2, -10], [w / 2, 10], [-w / 2, 10]], [P.brick, P.brickDk, P.brickLt][i % 3], { lw: 2.6 }); ctx.restore(); }
    const sw = -.05, bx = TIP[0] + Math.sin(sw) * ROPE, by = TIP[1] + Math.cos(sw) * ROPE;
    C.seed(71); C.line(ctx, [[TIP[0] + Math.sin(sw) * 404, TIP[1] + Math.cos(sw) * 404], [bx, by - BALL_R]], 6, P.ink, .2);
    C.shape(ctx, C.ell(bx, by, BALL_R, BALL_R, 26), P.steel, { lw: 5, shade: c => C.blot(c, C.ell(bx + 18, by + 16, BALL_R * .9, BALL_R * .85, 18), P.steelDk, .8) });
    C.drawDaisy(ctx, { x: WD.dX, y: WD.dY, s: 1, seed: 23, hook: sw, beep: 0, mood: 'sleepy' });
  }
  // Sepya hatıra plakası: pilot b22 ("My professor says, that's called luck.") — Kaan tozun içinde, küçük gülümseme.
  const MEM = { kx: 520, ky: 2180, s: 3.2 };
  const memOff = t => lerp(880, 800, E.io(seg(t, 0, 2.2)));   // baş üstü ≈1060 → 980
  function memPlate(t, blink, kyOff) {
    const g = layer('mem');
    const bg = blurred('p1-bg-kaan', 7, c => { cam(c, .85, 250, 760); drawP1World(c); });
    g.save(); g.translate(540, 960); g.scale(1.03, 1.03); g.drawImage(bg, -540, -960); g.restore();
    g.fillStyle = 'rgba(216,202,176,.22)'; g.fillRect(0, 0, 1080, 1920);
    motes(g, t, 40, 5, [-100, 300, 1300, 1600], .9);
    C.drawKaan(g, { x: MEM.kx, y: MEM.ky + (kyOff || 0), s: MEM.s, seed: 11, expr: 'calm', look: 0, blink: blink ? 1 : 0, phone: true });
    motes(g, t * 1.4, 16, 6, [-100, 200, 1300, 1700], 1);
    return layers.mem;
  }

  /* ================= KABİN (bugün) ================= */
  const CAB = { x: 0, y: 0, w: 1080, h: 1000, seed: 41 }, WS = [[65, 80], [1015, 80], [995, 500], [85, 500]];
  const KC = { x: 324, y: 1220, s: 1.84 }, DC = { x: 700, y: 1200, s: 1.92 };
  function drawCabinScene(ctx, t, o) {
    ctx.fillStyle = '#0d1322'; ctx.fillRect(-500, -1400, 2100, 1400);
    C.drawCabin(ctx, Object.assign({}, CAB, { people: false, t, glow: .7 }));
    ctx.fillStyle = 'rgba(13,19,34,.6)'; ctx.fillRect(0, 0, 1080, 82);   // tavan (iç, gölgede)
    // ön camda gri hatıra (yağmurun arkasında)
    if (o.memA > 0) {
      ctx.save(); ctx.beginPath(); WS.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip();
      ctx.globalAlpha = o.memA; ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, 0, 1080, 520); ctx.filter = GRAY; ctx.drawImage(o.plate, 232, -348, 972, 1728); ctx.filter = 'none'; ctx.globalAlpha = 1;
      // yağmur damlaları hatıranın önünde
      for (let i = 0; i < 70; i++) { const x = 70 + rnd(9100 + i) * 940, y = 80 + ((rnd(9200 + i) * 420 + t * 50 * (1 + rnd(9300 + i))) % 420); ctx.fillStyle = 'rgba(200,220,240,.45)'; ctx.beginPath(); ctx.ellipse(x, y, 2.5, 4, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.save(); ctx.beginPath(); ctx.rect(-400, -400, 1900, 1280); ctx.clip();
    C.drawDefne(ctx, { pose: 'sit', seat: false, x: DC.x, y: DC.y, s: DC.s, expr: o.dExpr || 'serious', look: -.8, blink: o.dBlink || 0, seed: 31 });
    C.drawKaan(ctx, { pose: 'sit', seat: false, x: KC.x, y: KC.y, s: KC.s, expr: o.kExpr, look: o.kLook || 0, blink: o.kBlink || 0, hands: 'knees', seed: 11 });
    ctx.restore();
    // ön gösterge paneli (drawCabin'inkiyle aynı yer)
    C.seed(CAB.seed + 5);
    C.shape(ctx, [[-10, 900], [1090, 880], [1090, 1010], [-10, 1010]], P.steelDk, { lw: 4 });
    [.2, .32].forEach(u => C.shape(ctx, C.ell(1080 * u, 950, 24, 24, 16), '#11151c', { lw: 2.8 }));
    ctx.fillStyle = '#0d1322'; ctx.fillRect(-400, 1008, 1900, 1200);
  }

  /* ================= TELEFON (pilot b13-telefon ile aynı) ================= */
  const PH = { SW: 486, SH: 864, BW: 548, BH: 1000 };
  function drawHandSide(ctx, x, y, flip, lw) {
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], P.jacketDk, { lw });
    C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], P.skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], P.skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, P.skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, P.skinDk);
    ctx.restore();
  }
  // screen(ctx) ekran içini çizer (-SW/2..SW/2, -SH/2..SH/2); thumb [x,y] ya da null
  function phoneShot(ctx, t, z, screen, thumb, cy) {
    const tw = twos(t), jx = Math.sin(tw * 2.1) * 3, jy = Math.sin(tw * 1.3 + 1) * 3, rot = -.07 + Math.sin(tw * .8) * .006, { SW, SH, BW, BH } = PH;
    ctx.save(); ctx.translate(540 + jx, (cy || 770) + jy); ctx.rotate(rot * .6); ctx.transform(1, 0, -.035, 1, 0, 0); ctx.scale(z, z);
    drawHandSide(ctx, -BW / 2 + 10, 0, false, 6);
    C.seed(171); C.shape(ctx, rrectPts(-BW / 2, -BH / 2, BW, BH, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BW / 2, -BH / 2, 30, BH); } });
    C.shape(ctx, [[-60, -BH / 2 + 24], [60, -BH / 2 + 24], [60, -BH / 2 + 36], [-60, -BH / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SW / 2, -SH / 2, SW, SH, 34); ctx.clip();
    screen(ctx);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SW / 2, -SH / 2 + 80); ctx.lineTo(-SW / 2 + 220, -SH / 2); ctx.lineTo(-SW / 2 + 300, -SH / 2); ctx.lineTo(-SW / 2, -SH / 2 + 180); ctx.fill();
    ctx.restore();
    C.ink(ctx, (() => { const p = new Path2D(); const q = C.wobble(rrectPts(-SW / 2, -SH / 2, SW, SH, 34, 6), true, .5); p.moveTo(q[0][0], q[0][1]); q.forEach(v => p.lineTo(v[0], v[1])); p.closePath(); return p; })(), 4);
    drawHandSide(ctx, BW / 2 - 10, 0, true, 6);
    const tx = thumb ? thumb[0] : 330, ty = thumb ? thumb[1] : 560;
    C.seed(172);
    C.shape(ctx, [[BW / 2 + 60, 380], [tx + 50, ty - 30], [tx + 10, ty - 50], [tx - 30, ty - 30], [tx - 20, ty + 20], [BW / 2 + 20, 470]], P.skin, { lw: 6, shade: c => C.blot(c, [[tx - 10, ty + 5], [BW / 2 + 80, 420], [BW / 2 + 80, 520], [tx, ty + 60]], P.skinDk, .5) });
    C.shape(ctx, [[tx - 22, ty - 34], [tx + 6, ty - 46], [tx + 18, ty - 24], [tx - 8, ty - 14]], '#e7b896', { lw: 3 });
    ctx.restore();
  }

  /* ================= GECE ODASI (pilot b-sahneler drawRoom kopyası; pencere şafağa döner) ================= */
  function mixHex(a, b, u) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * u)).join(',')})`; }
  function drawRoom(ctx, dawn) {
    ctx.fillStyle = P.night2; ctx.fillRect(-200, -200, 1480, 2320);
    C.seed(141);
    for (let x = -100; x < 1200; x += 90) { ctx.fillStyle = 'rgba(7,11,24,.25)'; ctx.fillRect(x, -200, 40, 2400); }
    const wp = C.shape(ctx, [[60, 250], [420, 250], [420, 760], [60, 760]], P.night, { lw: 6 });
    ctx.save(); ctx.clip(wp);
    const sg = ctx.createLinearGradient(0, 250, 0, 760);
    sg.addColorStop(0, mixHex('#03050c', '#6f86a8', dawn)); sg.addColorStop(.6, mixHex('#0d1428', '#d9a37a', dawn)); sg.addColorStop(1, mixHex('#1d2742', '#f4c98f', dawn));
    ctx.fillStyle = sg; ctx.fillRect(60, 250, 360, 510);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(238,242,255,${(.3 + rnd(500 + i) * .6) * (1 - dawn)})`; ctx.fillRect(70 + rnd(600 + i) * 340, 260 + rnd(700 + i) * 300, 2.5, 2.5); }
    const my = 340 + dawn * 140;
    ctx.globalAlpha = 1 - dawn * .7; ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(330, my, 34, 0, TAU); ctx.fill(); ctx.fillStyle = mixHex('#03050c', '#8a96ad', dawn); ctx.beginPath(); ctx.arc(345, my - 8, 30, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    for (let x = 60; x < 420; x += 44) { const h = 60 + rnd(x) * 130; ctx.fillStyle = mixHex('#161d2b', '#5b5f70', dawn); ctx.fillRect(x, 760 - h, 40, h); for (let y = 770 - h; y < 750; y += 22) if (rnd(x * 7 + y) < .3 * (1 - dawn * .8)) { ctx.fillStyle = 'rgba(255,210,122,.75)'; ctx.fillRect(x + 8, y, 7, 9); } }
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
  function kaanPhoneScreen(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(92, -236); ctx.rotate(-.22);
    ctx.beginPath(); ctx.rect(-9.5, -24.5, 19, 40); ctx.clip(); drawGame(ctx, t, -11, -24.5, 22.5, 40); ctx.restore();
  }

  /* ================= SAHNELER ================= */

  /* "Previously" köşe görüntüsü: P6'nın son karesi, kabinde Defne'nin bakışı (p2-a prevInset düzeni) */
  function prevInset(ctx, t) {
    const a = 1 - seg(t, 2.2, 2.42); if (a <= 0) return;
    const x = 704, y = 232, w = 176, h = 140;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(.035); ctx.translate(-w / 2, -h / 2);
    C.seed(761); C.shape(ctx, [[-8, -8], [w + 8, -8], [w + 8, h + 8], [-8, h + 8]], P.paper, { lw: 4 });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.translate(w / 2, h / 2); ctx.scale(.42, .42); ctx.translate(-700, -560);
    C.drawCabin(ctx, Object.assign({}, CAB, { people: false, t: 0, glow: .7 }));
    C.drawKaan(ctx, { pose: 'sit', seat: false, x: KC.x, y: KC.y, s: KC.s, expr: 'sheepish', hands: 'phone', glow: .4, seed: 11 });
    C.drawDefne(ctx, { pose: 'sit', seat: false, x: DC.x, y: DC.y, s: DC.s, expr: 'serious', look: -.8, seed: 31 });
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  }

  /* --- 1a: 0. kare — sepya hatıra: 1. bölümün "My professor says" planı; toz süzülür, yavaşça iner --- */
  shot('p7a-01-hatira', k => 0, k => k.today, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    // kadraj: Kaan'ın baş üstü y ≥ 960 (büyük yazı bandının altında); Kaan yavaşça yükselir, arka plan yavaş itilir
    const plate = memPlate(t, tw >= 1.2 && tw < 1.2 + 3 / FPS, memOff(t));
    ctx.fillStyle = '#2a2118'; ctx.fillRect(0, 0, 1080, 1920);
    const z = lerp(1.0, 1.04, E.io(u));
    ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.filter = SEPIA; ctx.drawImage(plate, -540, -960); ctx.filter = 'none'; ctx.restore();
    vignette(ctx, 0, 'rgba(30,20,10,.85)');
    void k;
    finish(ctx);
    prevInset(ctx, t);
  });

  /* --- 1b–2: bugün, kabin, gece yağmur. Kaan kameraya; ön camda hatıra gri. "I don't have a professor." → bakış iner, gri kare söner --- */
  shot('p7a-02-kabin', k => k.today, k => k.c3, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const lift = E.io(seg(t, k.hookEnd - .05, k.hookEnd + .5)), push = E.io(seg(t, k.today, k.c3));
    const z = lerp(1.26, 1.34, push), fx = lerp(430, 450, push), fy = lerp(330, 600, lift);
    const memA = .62 * (1 - E.io(seg(t, k.fade0, k.fade1)));
    const plate = memA > 0 ? memPlate(t, false) : null;
    const down = tw >= k.dont;
    ctx.save(); cam(ctx, z, fx, fy);
    drawCabinScene(ctx, t, {
      memA, plate, kExpr: down ? 'regret' : 'sheepish', kLook: down ? -.4 : 0,
      kBlink: (tw >= k.today + .7 && tw < k.today + .7 + 3 / FPS) || (tw >= k.dont - .1 && tw < k.dont) ? 1 : 0,
      dExpr: tw >= k.fade0 + .2 ? 'worried' : 'serious', dBlink: tw >= k.fade0 + .5 && tw < k.fade0 + .5 + 3 / FPS ? 1 : 0
    });
    ctx.restore();
    vignette(ctx, .5);
    // geçiş: sepya plaka 6 karede çözülür
    const xa = 1 - seg(t, k.today, k.today + 6 / FPS);
    if (xa > 0) { ctx.save(); ctx.globalAlpha = xa; ctx.fillStyle = '#2a2118'; ctx.fillRect(0, 0, 1080, 1920); ctx.translate(540, 960); ctx.scale(1.04, 1.04); ctx.filter = SEPIA; ctx.drawImage(memPlate(t, false, memOff(k.today)), -540, -960); ctx.restore(); }
    finish(ctx);
  });

  /* --- 2 (sessizlik) – 3: boş amfi: boş kürsü, silinmiş tahta, boş sandalye; pencereden ışık, tebeşir tozu --- */
  function drawHall(ctx, t) {
    const cv = cached('amfi', 1080, 1920, c => {
      C.seed(711);
      const wg = c.createLinearGradient(0, 0, 0, 1300); wg.addColorStop(0, '#cfc3a6'); wg.addColorStop(1, '#e3d6b8'); c.fillStyle = wg; c.fillRect(0, 0, 1080, 1300);
      for (let i = 0; i < 12; i++) C.blot(c, C.ell(rnd(i + 3) * 1080, rnd(i + 40) * 1200, 80 + rnd(i + 80) * 120, 30 + rnd(i + 90) * 60, 12), '#b9ab8c', .25);
      // tahta
      C.shape(c, [[90, 260], [990, 260], [990, 860], [90, 860]], '#34443c', { lw: 6, shade: g => {
        for (let i = 0; i < 9; i++) { g.save(); g.globalAlpha = .07 + rnd(100 + i) * .06; g.fillStyle = '#e8eee6'; g.beginPath(); g.ellipse(200 + rnd(110 + i) * 700, 360 + rnd(120 + i) * 400, 160 + rnd(130 + i) * 120, 40 + rnd(140 + i) * 40, (rnd(150 + i) - .5) * .4, 0, TAU); g.fill(); g.restore(); }
        g.strokeStyle = 'rgba(232,238,230,.12)'; g.lineWidth = 3; for (let i = 0; i < 14; i++) { g.beginPath(); const x = 140 + rnd(160 + i) * 780, y = 320 + rnd(170 + i) * 480; g.moveTo(x, y); g.quadraticCurveTo(x + 60, y - 30, x + 160, y + 10); g.stroke(); }
      } });
      C.shape(c, [[70, 860], [1010, 860], [1010, 884], [70, 884]], '#8a6a46', { lw: 4 });
      C.shape(c, [[300, 852], [336, 850], [336, 860], [300, 862]], '#f1ede2', { lw: 2 }); C.shape(c, [[720, 854], [800, 852], [800, 862], [720, 862]], '#d9c8a9', { lw: 2 });
      // zemin (kürsü platformu)
      c.fillStyle = '#9b7b55'; c.fillRect(0, 1180, 1080, 740); C.line(c, [[0, 1180], [1080, 1180]], 5);
      c.strokeStyle = 'rgba(21,18,13,.25)'; c.lineWidth = 2; for (let y = 1220; y < 1920; y += 44) { c.beginPath(); c.moveTo(0, y); c.lineTo(1080, y + 6); c.stroke(); }
      // kürsü
      C.shape(c, [[560, 920], [820, 920], [800, 1220], [580, 1220]], '#6b4a2b', { lw: 6, shade: g => C.blot(g, [[720, 900], [840, 900], [820, 1240], [730, 1240]], '#3f2711', .5) });
      C.shape(c, [[540, 880], [840, 880], [840, 926], [540, 926]], '#7d5733', { lw: 6 });
      // boş sandalye (kürsünün yanında, hafif dönük)
      C.shape(c, [[300, 840], [420, 836], [416, 1010], [304, 1012]], '#5e3b1d', { lw: 6 });
      C.shape(c, [[270, 1010], [450, 1004], [470, 1050], [250, 1058]], '#7d5733', { lw: 6 });
      C.line(c, [[270, 1056], [262, 1200]], 9); C.line(c, [[456, 1050], [466, 1196]], 9); C.line(c, [[300, 1050], [306, 1170]], 6); C.line(c, [[420, 1046], [424, 1166]], 6);
      // pencere ışığı (soldan)
      c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .28; c.fillStyle = '#fff3c4';
      c.beginPath(); c.moveTo(-60, 120); c.lineTo(180, 120); c.lineTo(820, 1300); c.lineTo(380, 1300); c.fill(); c.restore();
      // ön sıra masa kenarı (kameraya yakın, koyu)
      C.shape(c, [[-20, 1560], [1100, 1530], [1100, 1960], [-20, 1960]], '#4a3420', { lw: 6, shade: g => C.blot(g, [[-20, 1600], [1100, 1580], [1100, 1960], [-20, 1960]], '#2a1c10', .5) });
    });
    ctx.drawImage(cv, 0, 0);
    motes(ctx, t, 34, 21, [60, 200, 760, 1000], .8, '248,240,220');
  }
  shot('p7a-03-kursu', k => k.c3, k => k.c4, (ctx, t, u) => {
    const z = lerp(1.0, 1.07, E.io(u));
    ctx.save(); cam(ctx, z, 560, 900, 540, 900); drawHall(ctx, t); ctx.restore();
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 3: "…school in March." okul binası, mart: çıplak ağaç, ilk tomurcuk, eriyen kar, su birikintisi; Kaan kapıya yürür --- */
  function drawSchool(ctx, t) {
    const cv = cached('okul', 1080, 1920, c => {
      C.seed(721);
      const sk = c.createLinearGradient(0, 0, 0, 1100); sk.addColorStop(0, '#8fa3b4'); sk.addColorStop(1, '#d8dcd4'); c.fillStyle = sk; c.fillRect(0, 0, 1080, 1100);
      // bina
      C.shape(c, [[-20, 260], [1100, 260], [1100, 1100], [-20, 1100]], '#c8b79a', { lw: 5, shade: g => { for (let y = 300; y < 1100; y += 26) { g.strokeStyle = 'rgba(21,18,13,.08)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, y); g.lineTo(1100, y); g.stroke(); } C.blot(g, [[820, 240], [1110, 240], [1110, 1110], [860, 1110]], '#9d8c70', .35); } });
      C.shape(c, [[-30, 230], [1110, 230], [1110, 268], [-30, 268]], '#8d7f6a', { lw: 5 });
      for (const wx of [40, 220, 760, 940]) for (const wy of [330, 620]) C.shape(c, [[wx, wy], [wx + 120, wy], [wx + 120, wy + 190], [wx, wy + 190]], '#6e8592', { lw: 4, shade: g => { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(wx + 20, wy - 10, 16, 210); } });
      // giriş: sütunlar, çift kapı, tabela
      C.shape(c, [[380, 470], [700, 470], [700, 1100], [380, 1100]], '#b3a284', { lw: 5 });
      C.shape(c, [[410, 690], [670, 690], [670, 1080], [410, 1080]], '#4d4a44', { lw: 5 });
      C.shape(c, [[426, 706], [536, 706], [536, 1080], [426, 1080]], '#7f97a3', { lw: 4, shade: g => { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(450, 700, 14, 400); } });
      C.shape(c, [[544, 706], [654, 706], [654, 1080], [544, 1080]], '#7f97a3', { lw: 4, shade: g => { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(568, 700, 14, 400); } });
      C.line(c, [[520, 880], [520, 930]], 6); C.line(c, [[560, 880], [560, 930]], 6);
      C.shape(c, [[360, 520], [720, 520], [720, 640], [360, 640]], '#efe6d2', { lw: 5 });
      c.font = '700 40px Rubik'; c.textAlign = 'center'; c.fillStyle = P.ink; c.fillText('SCHOOL OF', 540, 570); c.fillText('ENGINEERING', 540, 618);
      // basamaklar + zemin
      c.fillStyle = '#9a9488'; c.fillRect(-20, 1100, 1120, 820);
      [[340, 1100, 400], [310, 1130, 460], [280, 1160, 520]].forEach(([x, y, w]) => C.shape(c, [[x, y], [x + w, y], [x + w, y + 30], [x, y + 30]], '#bdb5a4', { lw: 4 }));
      const gg = c.createLinearGradient(0, 1190, 0, 1920); gg.addColorStop(0, '#a19a8c'); gg.addColorStop(1, '#6f6a60'); c.fillStyle = gg; c.fillRect(-20, 1190, 1120, 730); C.line(c, [[-20, 1190], [1100, 1190]], 4);
      // eriyen kar lekeleri + su birikintisi (gök yansıması)
      for (let i = 0; i < 7; i++) C.shape(c, C.ell(60 + rnd(i + 20) * 960, 1260 + rnd(i + 30) * 560, 60 + rnd(i + 40) * 90, 12 + rnd(i + 50) * 14, 16), '#eef0ec', { lw: 2.6 });
      C.shape(c, C.ell(700, 1500, 220, 40, 26), '#a9bccb', { lw: 3, shade: g => { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(560, 1490, 260, 6); } });
    });
    ctx.drawImage(cv, 0, 0);
  }
  function drawTree(ctx, t) { // çıplak ağaç, ince dallar rüzgârla salınır, uçlarda yeşil tomurcuk
    const sw = Math.sin(t * 1.6) * .03 + Math.sin(t * 2.7) * .012;
    C.seed(731);
    C.shape(ctx, [[110, 1500], [150, 1500], [146, 1060], [118, 1060]], '#4a3a2c', { lw: 5 });
    const br = (x, y, a, L, d, sd) => {
      const a2 = a + sw * (5 - d), x2 = x + Math.cos(a2) * L, y2 = y + Math.sin(a2) * L;
      C.seed(sd); C.line(ctx, [[x, y], [x2, y2]], Math.max(2, 9 - d * 2), '#4a3a2c', .6);
      if (d >= 3) { ctx.fillStyle = '#8fa35a'; ctx.beginPath(); ctx.arc(x2, y2, 4.5, 0, TAU); ctx.fill(); return; }
      br(x2, y2, a - .45, L * .72, d + 1, sd * 2 + 1); br(x2, y2, a + .4, L * .7, d + 1, sd * 2 + 2);
    };
    br(132, 1070, -1.62, 190, 0, 7);
  }
  shot('p7a-04-okul', k => k.c4, k => k.c5, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u), z = lerp(1.0, 1.05, e);
    ctx.save(); cam(ctx, z, 540, 960);
    drawSchool(ctx, t);
    drawTree(ctx, t);
    // Kaan: soldan kapıya yürür (profil, ikişerli adım)
    const wu = seg(tw, k.c4, k.c5 + .2), kx = lerp(250, 470, wu), step = Math.sin(tw * 15 * Math.PI / 4) ;
    C.drawKaan(ctx, { pose: 'side', x: kx, y: 1400 - Math.abs(step) * 4, s: .62, step: step * .8, expr: 'serious', seed: 11 });
    // sırt çantası (profil): arkada
    ctx.save(); ctx.translate(kx, 1400 - Math.abs(step) * 4); ctx.scale(.62, .62); C.seed(741);
    C.shape(ctx, [[-78, -392], [-40, -398], [-36, -262], [-80, -258]], '#7a4a32', { lw: 6 }); C.line(ctx, [[-40, -390], [-6, -380]], 4); ctx.restore();
    // çatıdan damlayan eriyik su
    for (let i = 0; i < 4; i++) { const ph = ((t * .9 + i * .27) % 1), x = 120 + i * 260; ctx.fillStyle = 'rgba(200,215,225,.8)'; ctx.beginPath(); ctx.ellipse(x, 270 + ph * 820, 3, 6, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 4: "I sat down for an exam." sınav salonu: sıralar, kâğıt, duvar saati; Kaan oturur --- */
  function drawExamRoom(ctx) {
    const cv = cached('sinav', 1080, 1920, c => {
      C.seed(751);
      c.fillStyle = '#c9c7b2'; c.fillRect(0, 0, 1080, 1300);
      for (let i = 0; i < 10; i++) C.blot(c, C.ell(rnd(i + 5) * 1080, rnd(i + 60) * 1200, 90 + rnd(i + 70) * 120, 30 + rnd(i + 75) * 50, 12), '#b2b09a', .3);
      // yüksek pencereler (sol), sıcak ışık
      for (const wx of [-40, 200]) C.shape(c, [[wx, 180], [wx + 180, 180], [wx + 180, 640], [wx, 640]], '#e9dcb8', { lw: 5, shade: g => { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(wx + 30, 170, 18, 480); } });
      c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .22; c.fillStyle = '#fff3c4'; c.beginPath(); c.moveTo(-40, 180); c.lineTo(380, 180); c.lineTo(980, 1400); c.lineTo(300, 1400); c.fill(); c.restore();
      c.fillStyle = '#a49376'; c.fillRect(0, 1060, 1080, 860); C.line(c, [[0, 1060], [1080, 1060]], 5);
      // arka sıralar: başı eğik, yüzsüz, bulanık öğrenciler (sessiz)
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      [[150, 1000, '#7f8b8f'], [360, 990, '#9a7c6a'], [730, 990, '#6f7f6c'], [930, 1000, '#8a7f9a']].forEach(([x, y, col], i) => {
        C.seed(760 + i);
        C.shape(g, [[x - 70, y], [x - 60, y - 90], [x + 60, y - 90], [x + 70, y]], col, { lw: 4 });
        C.shape(g, C.ell(x + 4, y - 128, 34, 38, 16), ['#a0663f', '#c68a5e', '#8a5a3a', '#d2a07a'][i], { lw: 4 });
        C.shape(g, C.ell(x + 4, y - 146, 36, 26, 16, Math.PI, TAU), ['#2a1d16', '#5b3a22', '#15120d', '#7a5030'][i], { lw: 4 });
        C.shape(g, [[x - 110, y - 10], [x + 110, y - 10], [x + 110, y + 14], [x - 110, y + 14]], '#8a6a46', { lw: 4 });
      });
      c.filter = 'blur(3px)'; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
    ctx.drawImage(cv, 0, 0);
  }
  function drawClock(ctx, x, y, r, t, lw) { // duvar saati: saniye ibresi her saniye bir tık
    const sec = Math.floor(t + 1e-6), base = 10 * 3600 + 41 * 60 + 12 + sec;
    C.seed(771);
    C.shape(ctx, C.ell(x, y, r, r, 40), '#f4f1e6', { lw: lw * 1.3, shade: g => C.blot(g, C.ell(x + r * .25, y + r * .3, r * .9, r * .9, 20), '#d8d2bf', .5) });
    C.shape(ctx, C.ell(x, y, r * .86, r * .86, 40), null, { lw: lw * .4 });
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, L = i % 5 ? .06 : .14; ctx.strokeStyle = P.ink; ctx.lineWidth = i % 5 ? lw * .25 : lw * .6; ctx.beginPath(); ctx.moveTo(x + Math.sin(a) * r * .84, y - Math.cos(a) * r * .84); ctx.lineTo(x + Math.sin(a) * r * (.84 - L), y - Math.cos(a) * r * (.84 - L)); ctx.stroke(); }
    const hand = (a, L, w, col) => { ctx.strokeStyle = col || P.ink; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * r * .12, y + Math.cos(a) * r * .12); ctx.lineTo(x + Math.sin(a) * r * L, y - Math.cos(a) * r * L); ctx.stroke(); };
    hand((base / 43200) * TAU, .5, lw * 1.1); hand(((base % 3600) / 3600) * TAU, .74, lw * .8);
    hand(((base % 60) / 60) * TAU, .8, lw * .35, '#86391f');
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x, y, lw * .9, 0, TAU); ctx.fill();
  }
  function examDesk(ctx, x, y, w, paper) { // önden sıra (üst yüzey + ön panel), üstünde kâğıt
    C.seed(781);
    C.shape(ctx, [[x - w / 2 - 20, y], [x + w / 2 + 20, y], [x + w / 2, y + 40], [x - w / 2, y + 40]], '#a07a4e', { lw: 5 });
    if (paper) C.shape(ctx, [[x - 120, y + 4], [x + 110, y + 2], [x + 118, y + 30], [x - 128, y + 32]], P.paper, { lw: 3 });
    C.shape(ctx, [[x - w / 2, y + 40], [x + w / 2, y + 40], [x + w / 2, y + 330], [x - w / 2, y + 330]], '#7d5b38', { lw: 5, shade: g => C.blot(g, [[x + w * .2, y + 30], [x + w / 2 + 10, y + 30], [x + w / 2 + 10, y + 340], [x + w * .25, y + 340]], '#4a3420', .45) });
    C.line(ctx, [[x - w / 2 + 30, y + 330], [x - w / 2 + 30, y + 470]], 10); C.line(ctx, [[x + w / 2 - 30, y + 330], [x + w / 2 - 30, y + 470]], 10);
  }
  shot('p7a-05-sinav', k => k.c5, k => k.c6, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.0, 1.06, e), 540, 900, 540, 900);
    drawExamRoom(ctx);
    drawClock(ctx, 760, 430, 78, t, 7);
    // Kaan: önce ayakta (sıranın arkasında), "sat"ta oturur; 2 karede çöküş + küçük yerleşme
    const sat = tw >= k.sit, settle = sat ? Math.sin(seg(tw, k.sit, k.sit + .4) * Math.PI) * 10 : 0;
    if (!sat) C.drawKaan(ctx, { x: 540, y: 1520, s: 1.5, seed: 11, expr: 'serious', look: -.2 });
    else C.drawKaan(ctx, { pose: 'sit', x: 540, y: 1560 + settle, s: 1.6, seed: 11, expr: 'serious', look: -.3, hands: 'knees', blink: tw >= k.sit + .5 && tw < k.sit + .5 + 3 / FPS ? 1 : 0 });
    examDesk(ctx, 540, 1250, 520, true);
    ctx.restore();
    motes(ctx, t, 20, 31, [80, 300, 700, 900], .7, '248,240,220');
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 5: "I knew the answers." kâğıt (üstten): 1. soru, kiriş çizimi; el kurşun kalemle ilk cevabı hızlı yazar --- */
  const PAPER = { x: 540, y: 760, w: 760, h: 1040, rot: -.035 };
  function drawPaper(ctx) {
    const cv = cached('kagit', 1080, 1920, c => {
      c.fillStyle = '#8a6a46'; c.fillRect(0, 0, 1080, 1920);
      C.seed(791); for (let i = 0; i < 16; i++) C.line(c, [[-20, 80 + i * 120 + rnd(i) * 20], [1100, 96 + i * 120 + rnd(i + 30) * 20]], 3, '#6f5236', 2);
      c.save(); c.translate(PAPER.x, PAPER.y); c.rotate(PAPER.rot);
      c.fillStyle = 'rgba(21,18,13,.25)'; c.fillRect(-PAPER.w / 2 + 14, -PAPER.h / 2 + 18, PAPER.w, PAPER.h);
      C.shape(c, [[-PAPER.w / 2, -PAPER.h / 2], [PAPER.w / 2, -PAPER.h / 2], [PAPER.w / 2, PAPER.h / 2], [-PAPER.w / 2, PAPER.h / 2]], '#f6f1e4', { lw: 4 });
      c.fillStyle = P.ink; c.textAlign = 'left';
      c.font = '700 34px Rubik'; c.fillText('FINAL EXAM · STATICS', -330, -440);
      c.font = '500 24px Rubik'; c.fillStyle = '#5c574e'; c.fillText('Name: ______________     Time: 90 min', -330, -400);
      C.line(c, [[-340, -376], [340, -376]], 2.4, '#5c574e', .3);
      c.fillStyle = P.ink; c.font = '700 30px Rubik'; c.fillText('1.', -330, -320);
      c.font = '500 26px Rubik'; c.fillText('Find the reaction at support A.', -284, -320);
      // kiriş: iki mesnet, ortada yük oku
      C.line(c, [[-200, -170], [200, -170]], 7);
      C.shape(c, [[-200, -166], [-226, -122], [-174, -122]], '#ddd5c2', { lw: 3.4 }); C.shape(c, C.ell(200, -150, 16, 16, 12), '#ddd5c2', { lw: 3.4 }); C.line(c, [[176, -132], [226, -132]], 3.4);
      C.line(c, [[40, -280], [40, -180]], 4); C.line(c, [[24, -204], [40, -178], [56, -204]], 4);
      c.font = '500 24px Rubik'; c.fillText('12 kN', 56, -250); c.fillText('A', -214, -92); c.fillText('B', 192, -92);
      C.line(c, [[-330, 30], [330, 30]], 1.6, '#c9c2b0', .2);
      c.font = '700 30px Rubik'; c.fillText('2.', -330, 120); c.font = '500 26px Rubik'; c.fillText('Find the force in member BC.', -284, 120);
      C.line(c, [[-180, 300], [0, 190], [180, 300], [-180, 300]], 5); C.line(c, [[0, 190], [0, 300]], 4);
      c.fillText('B', -8, 176); c.fillText('C', 192, 316);
      C.line(c, [[-330, 420], [330, 420]], 1.6, '#c9c2b0', .2);
      c.font = '700 30px Rubik'; c.fillText('3.', -330, 480);
      c.restore();
    });
    ctx.drawImage(cv, 0, 0);
  }
  const P2W = (lx, ly) => { const c = Math.cos(PAPER.rot), s = Math.sin(PAPER.rot); return [PAPER.x + lx * c - ly * s, PAPER.y + lx * s + ly * c]; };
  function writingHand(ctx, tip, lift, rot) { // kalem ucu tip (ekran), kol sağ alttan; lift: ucun kâğıttan yüksekliği
    const [x, y] = tip; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); C.seed(801);
    const ly = -lift;
    // gölge
    ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(200 + lift, 120); ctx.lineTo(560, 420); ctx.lineTo(420, 560); ctx.lineTo(120 + lift, 230); ctx.fill(); ctx.restore();
    ctx.translate(0, ly);
    C.shape(ctx, [[260, 240], [700, 520], [600, 760], [170, 420]], P.jacket, { lw: 6, shade: c => C.blot(c, [[200, 400], [700, 600], [600, 800], [160, 440]], P.jacketDk, .6) });
    C.shape(ctx, [[180, 250], [276, 230], [196, 430], [150, 400]], P.hazard, { lw: 5 });
    // kalem (ahşap, grafit uç)
    C.shape(ctx, [[0, 0], [16, -20], [150, 110], [130, 134]], '#c9a27a', { lw: 4.4 });
    C.shape(ctx, [[0, 0], [16, -20], [30, -6], [10, 10]], '#4a4741', { lw: 3 });
    C.shape(ctx, [[150, 110], [130, 134], [148, 152], [168, 128]], '#b4532f', { lw: 3.6 });
    // el
    C.shape(ctx, [[40, 40], [60, 10], [110, 20], [180, 70], [210, 160], [200, 260], [150, 330], [90, 300], [60, 200], [40, 120]], P.skin, { lw: 6, shade: c => C.blot(c, [[120, 140], [240, 120], [240, 340], [140, 340]], P.skinDk, .5) });
    C.shape(ctx, [[34, 44], [64, 22], [92, 46], [70, 70]], P.skin, { lw: 4.4 });
    C.line(ctx, [[80, 120], [120, 150]], 3, P.skinDk); C.line(ctx, [[90, 180], [140, 200]], 3, P.skinDk);
    ctx.restore();
  }
  const ANS1 = 'R = 6 kN', A1 = [-300, -40];
  shot('p7a-06-kagit', k => k.c6, k => k.c7, (ctx, t, u) => {
    const k = times(), th = ones(t), z = lerp(1.18, 1.26, E.io(u)), fx = 540, fy = lerp(620, 660, E.io(u));
    ctx.save(); cam(ctx, z, fx, fy, 540, 800);
    drawPaper(ctx);
    const rev = E.lin(seg(th, k.w0, k.w1));
    ctx.save(); ctx.translate(PAPER.x, PAPER.y); ctx.rotate(PAPER.rot); pencilText(ctx, ANS1, A1[0], A1[1], 54, rev, 811); ctx.restore();
    // kalem ucu: yazının ilerlediği yerde, küçük el titreşimi (harf harf)
    const lx = A1[0] + 34 * ANS1.length * rev * .62 * 1.0 + 6, wig = rev > 0 && rev < 1 ? Math.sin(th * 60) * 7 : 0;
    const lift = rev <= 0 ? 26 * (1 - seg(th, k.c6, k.w0)) + 4 : rev >= 1 ? 24 * seg(th, k.w1, k.w1 + .2) : 0;
    writingHand(ctx, P2W(lx, A1[1] - 18 + wig), lift, -.05);
    ctx.restore();
    // masa lambası değil: gün ışığı, sıcak
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,220,160,.35)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 6: "My hands just stopped." yakın: 2. soru, kalem havada; kayma yavaşlar, "stopped"ta durur. Sonra saat. --- */
  shot('p7a-07-durdu', k => k.c7, k => k.c8, (ctx, t, u) => {
    const k = times(), th = ones(t), z = lerp(1.7, 1.78, E.io(u));
    const [fx, fy] = P2W(-170, 300);
    ctx.save(); cam(ctx, z, fx, fy, 520, 640);
    drawPaper(ctx);
    ctx.save(); ctx.translate(PAPER.x, PAPER.y); ctx.rotate(PAPER.rot); pencilText(ctx, ANS1, A1[0], A1[1], 54, 1, 811); ctx.restore();
    // kalem 2. sorunun cevap yerine iner, giderek yavaşlar, "stopped"ta kâğıda değmeden durur (sonra hiç kıpırdamaz)
    const g = E.outC(seg(th, k.c7, k.stop)), lx = lerp(-60, -250, g), ly = lerp(340, 372, g), lift = lerp(60, 18, g);
    writingHand(ctx, P2W(lx, ly), lift, -.05);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,220,160,.35)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .35);
    finish(ctx);
  });
  shot('p7a-08-saat', k => k.c8, k => k.c9, (ctx, t, u) => {
    ctx.save(); cam(ctx, lerp(1.0, 1.05, E.io(u)), 540, 700, 540, 760);
    ctx.fillStyle = '#c9c7b2'; ctx.fillRect(-200, -200, 1480, 2320);
    for (let i = 0; i < 8; i++) C.blot(ctx, C.ell(rnd(i + 900) * 1080, rnd(i + 950) * 1400, 120, 60, 12), '#b2b09a', .3);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(560, 720, 300, 0, TAU); ctx.fill(); ctx.restore();
    drawClock(ctx, 540, 700, 300, t, 16);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .18; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.moveTo(-100, 0); ctx.lineTo(300, 0); ctx.lineTo(900, 1920); ctx.lineTo(400, 1920); ctx.fill(); ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 7: "I walked out and never went back." koridor (tek kaçış noktası): sınav kapısı kapanır, Kaan sırtı dönük çıkışa yürür --- */
  const VP = [540, 760], FOC = 900;
  const pr = (x, y, z) => [VP[0] + FOC * x / z, VP[1] + FOC * y / z];
  function quad(ctx, pts, fill, lw, sd) { C.seed(sd || 1); return C.shape(ctx, pts, fill, { lw: lw == null ? 3 : lw, amp: .6 }); }
  function drawCorridor(ctx) {
    const cv = cached('koridor', 1080, 1920, c => {
      const Z0 = .6, Z1 = 26, Wd = 1.6, Fy = 1.5, Cy = -1.6;
      c.fillStyle = '#d6cfbd'; c.fillRect(0, 0, 1080, 1920);
      quad(c, [pr(-Wd, Cy, Z0), pr(Wd, Cy, Z0), pr(Wd, Cy, Z1), pr(-Wd, Cy, Z1)], '#e4dfd2', 3, 821);           // tavan
      quad(c, [pr(-Wd, Fy, Z0), pr(Wd, Fy, Z0), pr(Wd, Fy, Z1), pr(-Wd, Fy, Z1)], '#9c8f78', 3, 822);           // zemin
      quad(c, [pr(-Wd, Cy, Z0), pr(-Wd, Cy, Z1), pr(-Wd, Fy, Z1), pr(-Wd, Fy, Z0)], '#cbc3ad', 3, 823);         // sol duvar
      quad(c, [pr(Wd, Cy, Z0), pr(Wd, Cy, Z1), pr(Wd, Fy, Z1), pr(Wd, Fy, Z0)], '#bfb7a1', 3, 824);             // sağ duvar
      // zemin karoları
      c.strokeStyle = 'rgba(21,18,13,.18)'; c.lineWidth = 2;
      for (let z = 1; z < Z1; z *= 1.22) { const a = pr(-Wd, Fy, z), b = pr(Wd, Fy, z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      for (let x = -Wd; x <= Wd + .01; x += .8) { const a = pr(x, Fy, Z0), b = pr(x, Fy, Z1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      // duvar alt şeridi
      [[-Wd, '#8d826b'], [Wd, '#857a63']].forEach(([x, col], i) => quad(c, [pr(x, .9, Z0), pr(x, .9, Z1), pr(x, Fy, Z1), pr(x, Fy, Z0)], col, 2.4, 830 + i));
      // tavan lambaları
      for (let z = 2.5; z < Z1; z += 3) { quad(c, [pr(-.4, Cy, z), pr(.4, Cy, z), pr(.4, Cy, z + .9), pr(-.4, Cy, z + .9)], '#fbf6e6', 2, 840 + z); }
      // sağ duvar dolapları (soluk yeşil-gri)
      for (let z = 2.2; z < 16; z += .7) quad(c, [pr(Wd, -.9, z), pr(Wd, -.9, z + .62), pr(Wd, .9, z + .62), pr(Wd, .9, z)], '#8d9a8e', 2, 850 + Math.round(z * 10));
      // sol duvar: uzak kapılar
      for (const z of [8, 13]) quad(c, [pr(-Wd, -.6, z), pr(-Wd, -.6, z + 1.1), pr(-Wd, Fy, z + 1.1), pr(-Wd, Fy, z)], '#8a6a46', 2.4, 870 + z);
      // sınav salonunun kapı kasası (sol, yakın): z 2.6–3.6
      quad(c, [pr(-Wd, -.75, 2.5), pr(-Wd, -.75, 3.7), pr(-Wd, Fy, 3.7), pr(-Wd, Fy, 2.5)], '#4b3a2a', 4, 880);
      // çıkış: uçta gün ışığı
      const e = [pr(-.7, -.9, Z1), pr(.7, -.9, Z1), pr(.7, Fy, Z1), pr(-.7, Fy, Z1)];
      const gl = c.createRadialGradient(VP[0], VP[1], 4, VP[0], VP[1], 520); gl.addColorStop(0, 'rgba(255,248,224,.85)'); gl.addColorStop(1, 'rgba(255,248,224,0)');
      quad(c, e, '#fff8e2', 3, 890); c.fillStyle = gl; c.fillRect(0, 0, 1080, 1920);
      // zeminde parlama
      c.save(); c.globalAlpha = .25; c.fillStyle = '#fff8e2'; c.beginPath(); const f0 = pr(-.5, Fy, Z1), f1 = pr(.5, Fy, Z1), f2 = pr(.9, Fy, 3), f3 = pr(-.9, Fy, 3); c.moveTo(f0[0], f0[1]); c.lineTo(f1[0], f1[1]); c.lineTo(f2[0], f2[1]); c.lineTo(f3[0], f3[1]); c.fill(); c.restore();
    });
    ctx.drawImage(cv, 0, 0);
  }
  function drawExamDoor(ctx, th) { // menteşe z=3.7 (uzak kenar), serbest kenar koridora açılır; th 0 = kapalı
    const hz = 3.7, L = 1.2, Wd = 1.6, fx = -Wd + Math.sin(th) * L, fz = hz - Math.cos(th) * L;
    const pts = [pr(-Wd, -.75, hz), pr(fx, -.75, fz), pr(fx, 1.5, fz), pr(-Wd, 1.5, hz)];
    C.seed(895); C.shape(ctx, pts, '#7d5b38', { lw: 5, shade: c => C.blot(c, [pts[1], pts[0], pts[3], pts[2]], '#4a3420', .35 * Math.cos(th)) });
    // küçük cam pencere + kol
    const w = (u, v) => { const x = lerp(-Wd, fx, u), z = lerp(hz, fz, u); return pr(x, lerp(-.75, 1.5, v), z); };
    C.shape(ctx, [w(.3, .12), w(.7, .12), w(.7, .4), w(.3, .4)], '#9fb2b8', { lw: 3 });
    C.line(ctx, [w(.86, .55), w(.94, .55)], 5);
  }
  function backpackKaan(ctx, x, y, s, step) {
    C.drawKaan(ctx, { pose: 'back', x, y, s, seed: 11 });
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(905);
    C.shape(ctx, [[-56, -384], [56, -384], [60, -250], [-60, -250]], '#7a4a32', { lw: 6, shade: c => C.blot(c, [[10, -390], [70, -390], [70, -240], [16, -240]], '#4f2e1e', .5) });
    C.shape(ctx, [[-40, -330], [40, -330], [42, -276], [-42, -276]], '#8f5a3e', { lw: 4.4 });
    C.line(ctx, [[-50, -390], [-46, -402]], 6); C.line(ctx, [[50, -390], [46, -402]], 6);
    void step; ctx.restore();
  }
  shot('p7a-09-koridor', k => k.c9, k => k.c10, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.save(); cam(ctx, lerp(1.0, 1.04, E.io(u)), 540, 900, 540, 900);
    drawCorridor(ctx);
    // Kaan: kapıdan çıkmış, çıkışa doğru yürür (z 2.4 → 10), ikişerli adım sallantısı
    const wz = lerp(2.3, 10.5, E.lin(seg(tw, k.c9 - .1, k.c10 + .1))), ph = tw * 15 * Math.PI / 4;
    const [kx, ky] = pr(.25 + Math.sin(ph) * .03, 1.5, wz), s = FOC * 1.78 / (wz * 580);
    backpackKaan(ctx, kx, ky - Math.abs(Math.sin(ph)) * 12 * s, s);
    // kapı: açık başlar, yavaşça kapanır (kapı kolu yayı), son anda küçük geri tepme
    const cu = seg(t, k.c9, k.door), th = cu < 1 ? 1.25 * (1 - E.inQ(cu)) : .025 * Math.sin(seg(t, k.door, k.door + .3) * Math.PI);
    drawExamDoor(ctx, th);
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 8: "I told nobody." telefon: Defne'nin sorusu, Kaan yazar, siler; imleç yanıp söner --- */
  const MSG_IN = 'How did the exam go?', MSG_TYPE = 'I walked out of the';
  function chatScreen(ctx, t) {
    const k = times(), { SW, SH } = PH, x0 = -SW / 2, y0 = -SH / 2;
    ctx.fillStyle = '#1c2230'; ctx.fillRect(x0, y0, SW, SH);
    ctx.fillStyle = '#262d3d'; ctx.fillRect(x0, y0, SW, 120);
    ctx.fillStyle = '#7b5a48'; ctx.beginPath(); ctx.arc(x0 + 70, y0 + 72, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f1e8d4'; ctx.font = '700 30px Rubik'; ctx.textAlign = 'left'; ctx.fillText('D', x0 + 60, y0 + 83);
    ctx.font = '700 32px Rubik'; ctx.fillText('Defne', x0 + 116, y0 + 84);
    ctx.font = '500 22px Rubik'; ctx.fillStyle = '#9aa3ab'; ctx.textAlign = 'center'; ctx.fillText('Today 18:42', 0, y0 + 190);
    // gelen balon
    rrect(ctx, x0 + 26, y0 + 220, 370, 82, 30); ctx.fillStyle = '#3a4255'; ctx.fill();
    ctx.fillStyle = '#f1e8d4'; ctx.font = '500 28px Rubik'; ctx.textAlign = 'left'; ctx.fillText(MSG_IN, x0 + 52, y0 + 271);
    // yazma alanı
    const n = t < k.del0 ? Math.round(MSG_TYPE.length * seg(ones(t), k.type0, k.type1)) : Math.round(MSG_TYPE.length * (1 - seg(ones(t), k.del0, k.del1)));
    const txt = MSG_TYPE.slice(0, n);
    rrect(ctx, x0 + 20, y0 + SH - 230, SW - 40, 76, 38); ctx.fillStyle = '#2b3243'; ctx.fill(); ctx.strokeStyle = '#4a5368'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '500 28px Rubik'; ctx.fillStyle = n ? '#f1e8d4' : '#6c7486'; ctx.fillText(n ? txt : 'Message', x0 + 50, y0 + SH - 182);
    const cx = x0 + 50 + (n ? ctx.measureText(txt).width + 3 : 0);
    if (Math.floor(t * 2.2) % 2 === 0 || (n > 0 && t < k.del1)) { ctx.fillStyle = '#f1e8d4'; ctx.fillRect(cx, y0 + SH - 206, 3, 34); }
    // klavye (sade, harfsiz tuşlar)
    ctx.fillStyle = '#141824'; ctx.fillRect(x0, y0 + SH - 140, SW, 140);
    for (let r = 0; r < 3; r++) for (let q = 0; q < 9; q++) { rrect(ctx, x0 + 14 + q * 51 + r * 14, y0 + SH - 130 + r * 42, 42, 34, 7); ctx.fillStyle = '#2b3243'; ctx.fill(); }
  }
  shot('p7a-10-mesaj', k => k.c10, k => k.c11, (ctx, t, u) => {
    const k = times(), th = ones(t);
    ctx.fillStyle = '#141a28'; ctx.fillRect(0, 0, 1080, 1920);
    glow(ctx, 540, 700, 760, '170,190,230', .18);
    vignette(ctx, .55);
    // başparmak: yazarken tuşlarda zıplar, silerken sağ altta (geri tuşu)
    const { SW, SH } = PH, typing = th >= k.type0 && th < k.type1, deleting = th >= k.del0 && th < k.del1;
    const hop = (typing || deleting) ? Math.abs(Math.sin(th * 30)) * 16 : 0;
    const thumb = deleting ? [SW / 2 - 40, SH / 2 - 70 - hop] : th >= k.del1 ? [SW / 2 + 30, SH / 2 + 10] : [SW / 2 - 150 + Math.sin(th * 13) * 50 * (typing ? 1 : 0), SH / 2 - 90 - hop];
    phoneShot(ctx, t, 1.24, c => chatScreen(c, t), [thumb[0] + 30, thumb[1] + 50], 760);
    finish(ctx);
  });

  /* --- 9: "That night I played Demolition Master until morning." telefon yakın: gerçek oyun kareleri; sonra oda, pencere ağarır --- */
  shot('p7a-11-oyun', k => k.c11, k => k.c12, (ctx, t, u) => {
    const k = times(), z = 1.3 * lerp(.97, 1.03, E.io(u));
    ctx.fillStyle = '#070b18'; ctx.fillRect(0, 0, 1080, 1920);
    const bg = cached('p7-telefon-bg', 1080, 1920, c => {
      c.fillStyle = '#0c1226'; c.fillRect(0, 0, 1080, 1920);
      [[160, 380, 120, 'rgba(255,210,122,.16)'], [920, 300, 90, 'rgba(238,242,255,.12)'], [120, 1500, 160, 'rgba(255,210,122,.08)'], [980, 1200, 130, 'rgba(120,150,220,.1)']].forEach(([x, y, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    });
    ctx.drawImage(bg, 0, 0);
    const i = gameIdx(t), br = .75 + .25 * Math.abs(Math.sin(i * .37)) + (i % 37 < 3 ? .25 : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(540, 700, 200, 540, 700, 760); hg.addColorStop(0, `rgba(255,226,122,${.34 * br})`); hg.addColorStop(.5, `rgba(255,190,110,${.12 * br})`); hg.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .55);
    // başparmak: yıkım düğmesine iki kez dokunur (aynı yerde, kısa)
    const th = ones(t), tap = [k.c11 + .15, k.c11 + 1.05], d = Math.min(...tap.map(a => Math.abs(th - a)));
    const press = clamp(1 - d / .18), { SW, SH } = PH;
    const TP = [(330 / 450 - .5) * SW, (700 / 800 - .5) * SH];
    phoneShot(ctx, t, z, c => drawGame(c, t, -SW / 2, -SH / 2, SW, SH), [lerp(330, TP[0] + 30, press * .9 + .1), lerp(560, TP[1] + 50, press * .9 + .1)]);
    finish(ctx);
  });
  function roomShot(ctx, t, dawn, z, expr, blink) {
    const s = 2.5, kx = 500, ky = 1880;
    ctx.save(); cam(ctx, z, 560, 900);
    drawRoom(ctx, dawn);
    C.drawKaan(ctx, { x: kx, y: ky, s, seed: 11, expr, look: .5, blink });
    kaanPhoneScreen(ctx, kx, ky, s, t);
    drawBlanket(ctx, ky - 200 * s + 10);
    const m = ctx.getTransform(); ctx.restore();
    const pX = m.a * (kx + 92 * s) + m.e, pY = m.d * (ky - 236 * s) + m.f, fX = m.a * (kx + 6 * s) + m.e, fY = m.d * (ky - 460 * s) + m.f;
    const wX = m.a * 240 + m.e, wY = m.d * 505 + m.f;
    nightLight(ctx, [[pX, pY, 420, .95], [fX, fY, 420, .8], [wX, wY, 420 + dawn * 500, .45 + dawn * .5]], .8 * (1 - dawn * .55));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(pX, pY, 10, pX, pY, 420); g.addColorStop(0, `rgba(255,226,122,${.3 * (1 - dawn * .5)})`); g.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    if (dawn > 0) { const g2 = ctx.createRadialGradient(wX, wY, 10, wX, wY, 900); g2.addColorStop(0, `rgba(255,190,130,${.22 * dawn})`); g2.addColorStop(1, 'rgba(255,190,130,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, 1080, 1920); }
    ctx.restore();
  }
  shot('p7a-12-safak', k => k.c12, k => k.c13, (ctx, t, u) => {
    const k = times(), tw = twos(t), dawn = E.io(seg(t, k.c12 + .1, k.c13 - .1));
    roomShot(ctx, t, dawn, lerp(1.0, 1.06, E.io(u)), dawn > .5 ? 'tired' : 'calm', tw >= k.c12 + .8 && tw < k.c12 + .8 + 3 / FPS ? 1 : 0);
    finish(ctx);
  });

  /* --- 10: "It did not teach me engineering." şafak, telefon yakın: oyun kapanır (küçülür), ekran kararır; camda pencere yansıması --- */
  shot('p7a-13-kapanir', k => k.c13, k => k.c14, (ctx, t, u) => {
    const k = times(), th = ones(t);
    const bg = blurred('p7-safak-bg', 14, c => { cam(c, 1.5, 300, 640); drawRoom(c, 1); });
    ctx.drawImage(bg, 0, 0);
    ctx.fillStyle = 'rgba(40,30,40,.35)'; ctx.fillRect(0, 0, 1080, 1920);
    glow(ctx, 180, 380, 700, '255,190,130', .25);
    vignette(ctx, .45);
    const { SW, SH } = PH, cu = seg(th, k.off, k.off + .2), off = th >= k.off + .2;
    const screen = c => {
      c.fillStyle = '#07080c'; c.fillRect(-SW / 2, -SH / 2, SW, SH);
      if (!off) { const sc = 1 - E.inQ(cu) * .82; c.save(); c.globalAlpha = 1 - E.inQ(cu) * .9; c.translate(0, E.inQ(cu) * SH * .25); c.scale(sc, sc); rrect(c, -SW / 2, -SH / 2, SW, SH, 34 / sc); c.clip(); drawGame(c, Math.min(t, k.off), -SW / 2, -SH / 2, SW, SH); c.restore(); }
      // kararmış camda pencere yansıması
      c.save(); c.globalAlpha = off ? .5 : .15 * cu; c.fillStyle = '#f4c98f'; c.beginPath(); c.moveTo(-SW / 2, -SH / 2 + 60); c.lineTo(-SW / 2 + 260, -SH / 2); c.lineTo(-SW / 2 + 330, -SH / 2); c.lineTo(-SW / 2, -SH / 2 + 190); c.fill();
      c.globalAlpha *= .6; c.fillRect(-SW / 2 + 40, -SH / 2 + 300, 120, 160); c.restore();
    };
    // başparmak: yan tuşa uzanır ve basar
    const reach = E.outC(seg(th, k.off - .35, k.off)), back = E.inQ(seg(th, k.off + .45, k.off + .9)), r = reach * (1 - back);
    phoneShot(ctx, t, lerp(1.22, 1.3, E.io(u)), screen, [lerp(330, 300, r), lerp(560, -160, r)], lerp(770, 790, E.io(u)));
    finish(ctx);
  });

  /* --- 11: "A game can't do that." masada kapalı ders kitapları, üstünde kalem, yanında yüzüstü telefon; şafak ışığı --- */
  function drawBooksDesk(ctx) {
    const cv = cached('kitaplar', 1080, 1920, c => {
      C.seed(931);
      c.fillStyle = '#6a4a2c'; c.fillRect(0, 0, 1080, 1920);
      for (let i = 0; i < 18; i++) C.line(c, [[-20, 60 + i * 110 + rnd(i + 7) * 20], [1100, 80 + i * 110 + rnd(i + 37) * 20]], 3, '#553a20', 2);
      // kitaplar (üstten-3/4, hafif kaymış yığın)
      const book = (x, y, w, h, d, rot, col, colDk, title, sd) => {
        c.save(); c.translate(x, y); c.rotate(rot); C.seed(sd);
        c.fillStyle = 'rgba(21,18,13,.3)'; c.fillRect(-w / 2 + 16, -h / 2 + 20, w, h + d);
        C.shape(c, [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, h / 2 + d], [-w / 2, h / 2 + d]], '#ece4cf', { lw: 4, shade: g => { for (let yy = h / 2 + 6; yy < h / 2 + d; yy += 5) { g.strokeStyle = 'rgba(21,18,13,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w / 2, yy); g.lineTo(w / 2, yy); g.stroke(); } } });
        C.shape(c, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], col, { lw: 5, shade: g => { C.blot(g, [[w * .1, -h / 2], [w / 2 + 10, -h / 2], [w / 2 + 10, h / 2 + 10], [w * .2, h / 2 + 10]], colDk, .35); g.fillStyle = colDk; g.fillRect(-w / 2, -h / 2, 26, h); } });
        c.font = '700 34px Rubik'; c.textAlign = 'center'; c.fillStyle = '#f1e8d4'; c.fillText(title, 14, -h / 2 + 76);
        C.line(c, [[-w / 2 + 70, -h / 2 + 100], [w / 2 - 44, -h / 2 + 100]], 3, '#f1e8d4', .3);
        c.restore();
      };
      book(610, 800, 440, 540, 46, .08, '#5f6e64', '#45524a', 'CALCULUS', 941);
      book(600, 730, 420, 520, 40, -.05, '#86391f', '#5e2814', 'MECHANICS', 942);
      book(616, 660, 400, 500, 44, .03, '#4f5866', '#3a414c', 'STATICS', 943);
      // sınavdaki kalem, kitabın üstünde
      c.save(); c.translate(640, 820); c.rotate(-.5); C.seed(951);
      C.shape(c, [[-150, -9], [130, -9], [130, 9], [-150, 9]], '#c9a27a', { lw: 4 }); C.shape(c, [[130, -9], [166, 0], [130, 9]], '#e8d2b0', { lw: 3 }); C.shape(c, [[156, -3], [166, 0], [156, 3]], '#4a4741', { lw: 2 });
      C.shape(c, [[-170, -9], [-150, -9], [-150, 9], [-170, 9]], '#b4532f', { lw: 3 }); c.restore();
      // yüzüstü telefon (solda)
      c.save(); c.translate(230, 960); c.rotate(.12); C.seed(961);
      c.fillStyle = 'rgba(21,18,13,.3)'; c.fillRect(-100 + 12, -190 + 16, 200, 380);
      C.shape(c, rrectPts(-100, -190, 200, 380, 34, 5), P.steelDk, { lw: 5, shade: g => { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(-100, -190, 20, 380); } });
      C.shape(c, C.ell(-48, -130, 22, 22, 14), '#1d1f24', { lw: 3 }); c.restore();
    });
    ctx.drawImage(cv, 0, 0);
  }
  shot('p7a-14-kitaplar', k => k.c14, k => k.end, (ctx, t, u) => {
    const e = E.io(u), z = lerp(1.0, 1.08, e);
    ctx.save(); cam(ctx, z, lerp(520, 560, e), lerp(820, 780, e), 540, 820);
    drawBooksDesk(ctx);
    ctx.restore();
    // şafak ışığı: soldan uzun pencere şeridi, çok yavaş kayar
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(30,20,40,.55)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .3; ctx.fillStyle = '#f4c98f';
    const sh = u * 40; ctx.beginPath(); ctx.moveTo(-200 + sh, 300); ctx.lineTo(260 + sh, 220); ctx.lineTo(1300 + sh, 1100); ctx.lineTo(700 + sh, 1300); ctx.fill(); ctx.restore();
    motes(ctx, t, 26, 41, [100, 200, 900, 1000], .7, '255,230,200');
    vignette(ctx, .45);
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const r3 = x => +x.toFixed(3);
  TB.cuesA = {
    get hatiraBitis() { return r3(times().today); },          // sepyadan kabine (yağmur sesi başlar)
    get hatiraSoner() { return r3(times().fade0); },          // ön camdaki gri kare söner (sessizlik)
    get okulKapisi() { return r3(times().c4); },              // mart, dış ortam; çatıdan damlayan su
    get oturma() { return r3(times().sit); },                 // sandalye, sıra
    get kalemYazar() { return r3(times().w0); },              // kurşun kalem kâğıtta (≈0,8 sn)
    get kalemDurur() { return r3(times().stop); },            // kalem havada kalır; ardından sessizlik
    get saatTik() { return r3(Math.ceil(times().c8)); },      // saniye ibresi her tam saniyede bir tık (c8 … c9)
    get kapiKapanir() { return r3(times().door); },           // sınav salonu kapısı kapanır (yumuşak klik)
    get adimlar() { return r3(times().c9); },                 // koridorda uzaklaşan adımlar
    get mesajYaz() { return r3(times().type0); },             // ekran klavyesi tıkları
    get mesajSil() { return r3(times().del0); },              // silme tıkları
    get oyunDokunus() { return r3(times().c11 + .15); },      // ekrana dokunuş (oyun sesi gerçek kareden)
    get safak() { return r3(times().c12); },                  // pencere ağarır
    get yanTus() { return r3(times().off); },                 // yan tuş: oyun kapanır, ekran kararır
    get kitaplar() { return r3(times().c14); }                // sessiz masa
  };
})();
