/* Part 4 · TWO BEEPS — Animatör A: 0 – kesme (S14.t1+S15.t0)/2 ≈ 25,38 sn (cümle 1–14).
   OFİS YERLEŞİMİ (B de aynısını kullansın) — dünya koordinatı = Cizim.drawOffice(ctx,{x:0,y:0,w:1080,h:900,seed:21}):
     arka duvar y 0–630, duvar/zemin çizgisi y=630; zemin aşağı doğru (ben 1700'e kadar uzatıyorum); duvar sola x=-700, sağa x=1700 uzar.
     masa: x 43–713, üst yüzey y=558, ayaklar y 828'e; soğuk çay bardağı x 411 (y 504–554); masa lambası x 646 (başı ≈(660,410)).
     şarjdaki telefon: dedenin telefonu küçük ayaklıkta, taban (525,552), ekran merkezi ≈(528,512); kablo masadan duvar prizine (700,600).
     kalemlik (tek mavi kalem): (300,558). Duvardaki yıkım eskizleri: A(150,160) B(390,120) C(250,360) D(480,330).
     TAKVİM (alçakta): x 691–907, y 270–540, çivi (799,198); arkasındaki çatlak x≈799, y 0–630 (calendarMoved 1 → takvim x 907–1123).
     OFİS KAPISI: arka duvarın solunda, x -250…-40, y 90–630, menteşe sağda (x=-40), içeri (kameraya doğru) açılır; dışarısı gece avlu.
     Eski baret: kapının sağında çivide, çivi (25,250).
     Bu yarıda kapı açık bırakıldı; lamba S11'den (≈19,24 sn) itibaren yanık; telefon S6'dan sonra Kaan'ın elinde.
   SON KARE (≈25,38 sn): üstten masa planı; drawSensorPlan merkezi ekranda (540,820), s 1.1, rot -0.03, kamera z≈1.55 (yerel (-210,-10)'a);
     çizim soldan rulo açılıyor, açık kısım yerel x < -80 (SENSOR yazısı/kutusu henüz rulonun altında); rulo yerel x=-80'de, Kaan'ın sağ eli rulonun ortasında. */
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
    k.c2 = mid(1);                          // telefona yakın (ayaklıkta)
    k.c3 = mid(2);                          // kapı
    k.door = S(3).t0 - .25;                 // kapı aralanır (gıcırtı)
    k.step = W(3, /^got/i, 2).t0 - .1;      // Kaan içeri adım atar
    k.c4 = mid(3);                          // toz / çizim / çay
    k.d2 = W(4, /^drawings/i, 1).t0 - .14;  // fener çizime kayar
    k.d3 = W(4, /^cold/i, 2).t0 - .14;      // fener çaya kayar
    k.c5 = mid(4);                          // kablo boyunca telefona
    k.reach = S(5).t1 - .2;                 // el telefona uzanır
    k.c6 = mid(5);                          // telefon Kaan'ın elinde
    k.tap1 = S(8).t0 - 60 / FPS;            // "Try again": 60 kare sonra TIME'S UP (kare 96) "He"de
    k.c7 = S(7).t0 - .1;                    // ekrana yakın + "12" notu
    k.c9 = mid(8);                          // baret
    k.c10 = mid(9);                         // duvardaki yıkım eskizleri
    k.c11 = mid(10);                        // Kaan masada, lamba yanar
    k.c12 = S(11).t1 + .02;                 // üç deneme
    k.tapA = S(12).t0 - .3; k.tapB = W(12, /^three/i, 3).t0 + .05; k.tapC = k.tapB + .25;
    k.c13 = S(13).t0 - .05;                 // masada rulo açılır
    k.c14 = mid(13);                        // Daisy'nin çizimi
    k.end = mid(14);
    K = k; return k;
  }
  function shot(id, t0, t1, draw) { TB.shot({ id, get t0() { return t0(times()); }, get t1() { return t1(times()); }, draw }); }

  /* ================= YARDIMCILAR ================= */
  function cam(ctx, z, cx, cy, sx, sy) { ctx.translate(sx == null ? 540 : sx, sy == null ? 960 : sy); ctx.scale(z, z); ctx.translate(-cx, -cy); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const cache = {};
  function cached(key, w, h, fn) { if (!cache[key]) { const cv = canvas(w, h); fn(cv.getContext('2d')); cache[key] = cv; } return cache[key]; }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }
  function finish(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; C.grain(ctx, 0, 0, 1080, 1920, .2); }
  function vignette(ctx, a) { const g = ctx.createRadialGradient(540, 860, 320, 540, 900, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(7,11,24,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); }
  const W2S = (m, x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];

  /* Karanlık + ışık delikleri (ekran koordinatı). holes: [x,y,r,s] daire ya da {cone:[x0,y0,x1,y1,w], s} fener konisi. */
  let darkCv = null;
  function darkness(ctx, holes, a) {
    if (!darkCv) darkCv = canvas(1080, 1920);
    const d = darkCv.getContext('2d'); d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, 1080, 1920);
    d.fillStyle = `rgba(4,6,16,${a})`; d.fillRect(0, 0, 1080, 1920); d.globalCompositeOperation = 'destination-out';
    holes.forEach(h => {
      if (h.cone) {
        const [x0, y0, x1, y1, w] = h.cone, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
        const g = d.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(0,0,0,${h.s * .9})`); g.addColorStop(1, `rgba(0,0,0,${h.s * .55})`);
        d.fillStyle = g; d.beginPath(); d.moveTo(x0 + nx * 8, y0 + ny * 8); d.lineTo(x1 + nx * w, y1 + ny * w); d.lineTo(x1 - nx * w, y1 - ny * w); d.lineTo(x0 - nx * 8, y0 - ny * 8); d.closePath(); d.fill();
        const g2 = d.createRadialGradient(x1, y1, 0, x1, y1, w * 1.3); g2.addColorStop(0, `rgba(0,0,0,${h.s})`); g2.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g2; d.fillRect(0, 0, 1080, 1920);
        return;
      }
      const [x, y, r, s] = h, g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(.5, `rgba(0,0,0,${s * .6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(0, 0, 1080, 1920);
    });
    d.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkCv, 0, 0); ctx.restore();
  }
  function glow(ctx, x, y, r, a, rgb) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, r); g.addColorStop(0, `rgba(${rgb || '255,226,122'},${a})`); g.addColorStop(1, `rgba(${rgb || '255,226,122'},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  // Havadaki toz zerreleri (birerli, tohumlu); ışıkta görünür. Dünya koordinatında bir kutu içinde.
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

  /* ================= OYUN KARELERİ ================= */
  const GAME_N = 150, gameImgs = [];
  for (let i = 1; i <= GAME_N; i++) gameImgs.push(TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg'));
  const fr = (t, a) => Math.floor((t - a) * FPS + 1e-6);
  // Her karenin dosya numarası (1–150). meta.json: 1–55 yıkım + DEMOLISHED!, 56–115 fabrika + TIME'S UP, 116–137 sonuç kartı/Try again/kepenk, 138–150 bölüm yeniden.
  const CARD = 125;
  function seqPhone(t) {          // S6–S8: dedenin kalan ekranı (Time's up kartı) → Kaan "Try again" → bölüm yeniden → TIME'S UP
    const k = times(); if (t < k.tap1) return CARD;
    const f = fr(t, k.tap1);
    if (f <= 6) return 131 + f; if (f <= 19) return 138 + f - 7; if (f <= 79) return 56 + f - 20; return 115;
  }
  function seqTries(t) {          // S11–S12: kart → dokun (2. deneme) → TIME'S UP → kart → dokun (3. deneme) → DEMOLISHED!
    const k = times();
    if (t < k.tapA) return CARD;
    const sA = k.tapA + 7 / FPS; if (t < sA) return 131 + fr(t, k.tapA);
    if (t < k.tapB - .12) return Math.min(115, 96 + fr(t, sA));
    if (t < k.tapB) return CARD;
    const sB = k.tapB + 7 / FPS; if (t < sB) return 131 + Math.min(6, fr(t, k.tapB));
    if (t < k.tapC) return 137;
    return Math.min(55, 14 + fr(t, k.tapC));
  }
  function frame(i) {
    const im = gameImgs[i - 1]; if (im && im.complete && im.naturalWidth > 0) return im;
    return cached('yer' + i, 450, 800, g => { g.fillStyle = '#2f3a4b'; g.fillRect(0, 0, 450, 800); g.fillStyle = '#F5B700'; g.font = '700 40px Rubik'; g.fillText('f' + i, 160, 400); });
  }
  const TRY_AGAIN = [225, 505], BUILDING = [225, 330];

  /* ================= DÜNYA: DEDENİN OFİSİ ================= */
  function officeCv(lamp) { return cached('ofis' + (lamp ? 1 : 0), 2160, 1800, c => { c.scale(2, 2); C.drawOffice(c, { x: 0, y: 0, w: 1080, h: 900, lamp, phoneOn: false, seed: 21 }); }); }
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
  function standPhone(ctx, t, idx) { // dedenin telefonu küçük ayaklıkta, şarjda
    const [x, y] = PHONE; C.seed(331);
    C.shape(ctx, [[x - 22, 556], [x + 22, 556], [x + 14, 540], [x - 4, 540]], P.steelDk, { lw: 1.8 });
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.05);
    C.shape(ctx, rrectPts(-18, -36, 36, 70, 6, 3), P.steelDk, { lw: 1.8 });
    ctx.save(); rrect(ctx, -15.5, -32, 31, 60, 3); ctx.clip(); ctx.drawImage(frame(idx), -15.5, -32, 31, 60); ctx.restore();
    ctx.restore();
    C.line(ctx, [[x + 2, 552], [x + 30, 560], [x + 60, 566]], 1.6, P.ink, .4);
  }
  function drawWorld(ctx, t, o) {
    o = o || {}; C.seed(341);
    ctx.fillStyle = P.wallOffice; ctx.fillRect(-800, -700, 2600, 1330);
    for (let i = 0; i < 9; i++) { const x = [-700, -520, -330, -160, 1100, 1250, 1420, 1600, -60][i], y = 80 + rnd(i + 9) * 420; C.blot(ctx, C.ell(x, y, 80 + rnd(i) * 90, 40 + rnd(i + 3) * 50, 12), P.wallOfficeDk, .25); }
    ctx.fillStyle = '#2a302e'; ctx.fillRect(-800, -700, 2600, 640); C.line(ctx, [[-800, -60], [1800, -60]], 3);
    ctx.fillStyle = P.floorWood; ctx.fillRect(-800, 630, 2600, 1100);
    ctx.strokeStyle = 'rgba(21,18,13,.3)'; ctx.lineWidth = 2; for (let yy = 660; yy < 1720; yy += 36 + (yy - 630) * .08) { ctx.beginPath(); ctx.moveTo(-800, yy); ctx.lineTo(1800, yy + 4); ctx.stroke(); }
    ctx.drawImage(officeCv(o.lamp), 0, 0, 1080, 900);
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
    if (o.phone !== false) standPhone(ctx, t, o.idx || CARD);
  }

  /* ================= TELEFONA YAKIN (pilotla aynı telefon) ================= */
  function drawHandSide(ctx, x, y, flip, lw) {
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], P.jacketDk, { lw });
    C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], P.skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], P.skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, P.skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, P.skinDk);
    ctx.restore();
  }
  const SW = 486, SH = 864, BWd = 548, BHt = 1000;
  function scrPt(p) { return [(p[0] / 450 - .5) * SW, (p[1] / 800 - .5) * SH]; }
  // o: cx, cy, z, rot, idx, hands, taps [{t, at}], note (dedenin "12" notu), stand, lit
  function phoneClose(ctx, t, o) {
    const tw = twos(t), jx = o.hands ? Math.sin(tw * 2.1) * 3 : 0, jy = o.hands ? Math.sin(tw * 1.3 + 1) * 3 : 0;
    ctx.save(); ctx.translate(o.cx + jx, o.cy + jy); ctx.rotate(o.rot || 0); ctx.transform(1, 0, -.035, 1, 0, 0); ctx.scale(o.z, o.z);
    if (o.stand) { // ayaklık + şarj kablosu
      C.seed(181); C.shape(ctx, [[-210, BHt / 2 - 30], [210, BHt / 2 - 30], [250, BHt / 2 + 90], [-250, BHt / 2 + 90]], P.steelDk, { lw: 7 });
      C.line(ctx, [[0, BHt / 2], [10, BHt / 2 + 160], [120, BHt / 2 + 260], [420, BHt / 2 + 300]], 12, P.ink, .6);
    }
    if (o.hands) drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6);
    C.seed(171); C.shape(ctx, rrectPts(-BWd / 2, -BHt / 2, BWd, BHt, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BWd / 2, -BHt / 2, 30, BHt); } });
    C.shape(ctx, [[-60, -BHt / 2 + 24], [60, -BHt / 2 + 24], [60, -BHt / 2 + 36], [-60, -BHt / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SW / 2, -SH / 2, SW, SH, 34); ctx.clip();
    ctx.drawImage(frame(o.idx), -SW / 2, -SH / 2, SW, SH);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SW / 2, -SH / 2 + 80); ctx.lineTo(-SW / 2 + 220, -SH / 2); ctx.lineTo(-SW / 2 + 300, -SH / 2); ctx.lineTo(-SW / 2, -SH / 2 + 180); ctx.fill();
    let thumb = null;
    (o.taps || []).forEach(tp => {
      const rd = t - tp.t, P0 = scrPt(tp.at);
      if (rd >= 0 && rd < .4) { ctx.strokeStyle = `rgba(255,255,255,${.9 * (1 - rd / .4)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(P0[0], P0[1], 20 + rd * 220, 0, TAU); ctx.stroke(); }
      const th = ones(t), u = E.outC(seg(th, tp.t - .26, tp.t)) * (1 - E.inQ(seg(th, tp.t + .12, tp.t + .34)));
      if (u > (thumb ? thumb.u : 0)) thumb = { u, P0 };
    });
    ctx.restore();
    C.ink(ctx, (() => { const p = new Path2D(); const q = C.wobble(rrectPts(-SW / 2, -SH / 2, SW, SH, 34, 6), true, .5); p.moveTo(q[0][0], q[0][1]); q.forEach(v => p.lineTo(v[0], v[1])); p.closePath(); return p; })(), 4);
    if (o.note) { // dedenin kâğıt notu, telefonun alt çerçevesine bantlı: "12"
      ctx.save(); ctx.translate(-BWd / 2 - 34, -170); ctx.rotate(-.16); C.seed(191);
      C.shape(ctx, [[-78, -44], [80, -48], [84, 46], [-80, 48]], P.page, { lw: 4, shade: c => C.blot(c, [[30, -50], [90, -50], [90, 50], [40, 50]], P.pageDk, .6) });
      ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = '#e8e2cf'; ctx.fillRect(-30, -62, 64, 26); ctx.restore();
      C.handwrite(ctx, 'Lv 12', -60, 18, 46, P.inkOld, 201, { bold: true });
      C.line(ctx, [[-66, 30], [-20, 38], [40, 32], [70, 22]], 2.6, P.inkOld, .6);
      ctx.restore();
    }
    if (o.hands) {
      const tu = thumb ? thumb.u : 0, tgt = thumb ? thumb.P0 : [0, 200];
      const tx = lerp(330, tgt[0] + 30, tu), ty = lerp(560, tgt[1] + 50, tu);
      drawHandSide(ctx, BWd / 2 - 10, 0, true, 6);
      C.seed(172);
      C.shape(ctx, [[BWd / 2 + 60, 380], [tx + 50, ty - 30], [tx + 10, ty - 50], [tx - 30, ty - 30], [tx - 20, ty + 20], [BWd / 2 + 20, 470]], P.skin, { lw: 6, shade: c => C.blot(c, [[tx - 10, ty + 5], [BWd / 2 + 80, 420], [BWd / 2 + 80, 520], [tx, ty + 60]], P.skinDk, .5) });
      C.shape(ctx, [[tx - 22, ty - 34], [tx + 6, ty - 46], [tx + 18, ty - 24], [tx - 8, ty - 14]], '#e7b896', { lw: 3 });
    }
    ctx.restore();
  }
  function darkRoomBg(ctx, lamp) {
    const bg = cached('yakin-bg' + (lamp ? 1 : 0), 1080, 1920, c => {
      c.fillStyle = lamp ? '#241c16' : '#0b1020'; c.fillRect(0, 0, 1080, 1920);
      const bl = lamp ? [[880, 520, 200, 'rgba(255,210,122,.32)'], [140, 360, 150, 'rgba(216,202,176,.12)'], [200, 1500, 220, 'rgba(122,81,48,.25)'], [960, 1300, 160, 'rgba(255,210,122,.1)']]
        : [[160, 380, 150, 'rgba(216,202,176,.08)'], [930, 300, 110, 'rgba(120,150,220,.1)'], [140, 1500, 200, 'rgba(122,81,48,.14)'], [980, 1250, 140, 'rgba(120,150,220,.07)']];
      bl.forEach(([x, y, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    });
    ctx.drawImage(bg, 0, 0);
  }
  function screenHalo(ctx, x, y, br) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(x, y, 200, x, y, 760); hg.addColorStop(0, `rgba(255,226,122,${.3 * br})`); hg.addColorStop(.5, `rgba(255,190,110,${.1 * br})`); hg.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
  }

  /* ================= SAHNELER ================= */
  /* a01 · S1 "Grandpa's phone had one app open." — karanlık ofis, şarjda yanan telefon (ekranda gerçek oyun: Time's up kartı). Yavaş itme, toz. */
  shot('a01-telefon', k => 0, k => k.c2, (ctx, t, u) => {
    const z = lerp(3.0, 3.45, E.io(u));
    ctx.save(); cam(ctx, z, 520, 470, 540, 1010);
    drawWorld(ctx, t, { lamp: false });
    motes(ctx, t, [400, 380, 260, 180], 40, 11, .8, 1.3);
    const m = ctx.getTransform(); ctx.restore();
    const [px, py] = W2S(m, PHONE[0], PHONE[1]);
    darkness(ctx, [[px, py, 330, .97], [px, py + 120, 520, .5]], .9);
    glow(ctx, px, py, 300, .28);
    vignette(ctx, .5); finish(ctx);
  });

  /* a02 · S2 "I did not expect it to be mine." — telefona yakın (ayaklıkta), oyunun gerçek ekranı büyük. */
  shot('a02-yakin', k => k.c2, k => k.c3, (ctx, t, u) => {
    darkRoomBg(ctx, false);
    screenHalo(ctx, 540, 820, 1);
    vignette(ctx, .55);
    phoneClose(ctx, t, { cx: 540, cy: 760, z: lerp(1.0, 1.1, E.io(u)), rot: -.02, idx: CARD, stand: true });
    ctx.save(); motes(ctx, t, [60, 200, 960, 1100], 30, 21, .35, 2.2); ctx.restore();
    finish(ctx);
  });

  /* a03 · S3 "I finally got into his office." — kapı aralanır (gıcırtı), Kaan'ın telefon feneri, içeri adım. */
  function kaanWalk(t) {
    const k = times(), u = E.io(seg(t, k.step, k.step + 1.15));
    const x = lerp(-150, 110, u), y = lerp(630, 700, u), s = lerp(.82, .95, u);
    const walking = t > k.step && t < k.step + 1.15, st = walking ? Math.sin(twos(t) * 9) : 0;
    return { x, y, s, st };
  }
  shot('a03-kapi', k => k.c3, k => k.c4, (ctx, t, u) => {
    const k = times(), op = E.outC(seg(t, k.door, k.door + .75)) * .92 + seg(t, k.door - .06, k.door) * .03;
    const kw = kaanWalk(t), inside = kw.x > -110;
    const drawK = c => C.drawKaan(c, { x: kw.x, y: kw.y, s: kw.s, pose: 'side', step: kw.st, expr: 'calm', seed: 11 });
    const z = lerp(1.36, 1.44, E.io(u));
    ctx.save(); cam(ctx, z, 140, 430);
    drawWorld(ctx, t, { lamp: false, door: op, kaanDoor: op > .25 && !inside ? drawK : null });
    if (inside) drawK(ctx);
    const hand = [kw.x + (18 + kw.st * 32) * kw.s, kw.y - 238 * kw.s];
    const aim = [lerp(260, 470, E.io(seg(t, k.door + .3, k.c4))), lerp(380, 540, E.io(seg(t, k.door + .3, k.c4)))];
    motes(ctx, t, [-200, 200, 700, 420], 50, 31, .5, 1.6);
    const m = ctx.getTransform(); ctx.restore();
    const on = seg(t, k.door + .3, k.door + .36);   // fener yanar
    const [hx, hy] = W2S(m, hand[0], hand[1]), [ax, ay] = W2S(m, aim[0], aim[1]);
    const [dx0, dy0] = W2S(m, DOOR.x0 + 105, DOOR.y0 + 300);
    const holes = [[dx0, dy0, 330, .55 * seg(op, .05, .5)]];
    if (on > 0) holes.push({ cone: [hx, hy, ax, ay, 150], s: .9 * on }, [hx, hy, 120, .6 * on]);
    darkness(ctx, holes, .9);
    if (on > 0) glow(ctx, ax, ay, 220, .16 * on, '255,243,196');
    vignette(ctx, .45); finish(ctx);
  });

  /* a04 · S4 "Dust, drawings, cold tea." — tek plan, fener nesneden nesneye kayar: masadaki toz → duvardaki çizim → soğuk çay. */
  function camPath(t, keys) { // keys: [[t, x, y, z, beamX, beamY]] arası kısa kaydırma (0,16 sn), arada yavaş sürüklenme
    let a = keys[0]; for (const kk of keys) if (t >= kk[0]) a = kk;
    const i = keys.indexOf(a), b = keys[i + 1], prev = keys[i - 1];
    let v = a.slice(1);
    if (prev) { const w = E.ioC(seg(t, a[0], a[0] + .18)); v = prev.slice(1).map((p, j) => lerp(p, a[j + 1], w)); }
    return v;
  }
  shot('a04-detay', k => k.c4, k => k.c5, (ctx, t, u) => {
    const k = times(), keys = [[k.c4, 190, 548, 3.2, 200, 548], [k.d2, 300, 210, 2.9, 300, 190], [k.d3, 411, 520, 3.6, 411, 522]];
    let [cx, cy, z, bx, by] = camPath(t, keys);
    cx += (t - k.c4) * 14; z *= 1 + (t - k.c4) * .02;
    ctx.save(); cam(ctx, z, cx, cy);
    drawWorld(ctx, t, { lamp: false, door: .92 });
    ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = P.dustLt; C.seed(51); for (let i = 0; i < 40; i++) ctx.fillRect(60 + rnd(i + 600) * 640, 553 + rnd(i + 700) * 6, 6 + rnd(i + 800) * 30, 2); ctx.restore();
    motes(ctx, t, [100, 380, 500, 200], 90, 41, .95, 1.4);
    const m = ctx.getTransform(); ctx.restore();
    const [sx, sy] = W2S(m, bx, by);
    darkness(ctx, [[sx, sy, 380, .98], { cone: [1180, 2100, sx, sy, 170], s: .45 }], .88);
    glow(ctx, sx, sy, 260, .14, '255,243,196');
    vignette(ctx, .4); finish(ctx);
  });

  /* a05 · S5 "And his phone, still on the charger." — kablo boyunca prizden telefona; sonda Kaan'ın eli uzanır. */
  shot('a05-sarj', k => k.c5, k => k.c6, (ctx, t, u) => {
    const k = times(), w = E.ioC(seg(t, k.c5 + .1, k.c5 + 1.5));
    const cx = lerp(660, 540, w), cy = lerp(615, 520, w), z = lerp(3.0, 3.5, w) + (t - k.c5) * .04;
    ctx.save(); cam(ctx, z, cx, cy);
    drawWorld(ctx, t, { lamp: false, door: .92 });
    motes(ctx, t, [430, 400, 300, 240], 50, 61, .7, 1.2);
    // el: sağdan telefona uzanır (ikişerli)
    const r = E.outC(seg(twos(t), k.reach, k.c6));
    if (r > 0) {
      ctx.save(); ctx.translate(lerp(720, 572, r), lerp(560, 520, r)); ctx.rotate(-.25); C.seed(71);
      C.shape(ctx, [[30, -26], [220, -40], [230, 40], [30, 26]], P.jacket, { lw: 2.4 });
      C.shape(ctx, [[22, -24], [36, -25], [36, 25], [22, 24]], P.hazard, { lw: 1.6 });
      C.shape(ctx, [[-30, -14], [-16, -26], [22, -22], [24, 20], [-12, 22], [-34, 4]], P.skin, { lw: 2.4, shade: c => C.blot(c, [[-40, 6], [30, 6], [30, 30], [-40, 30]], P.skinDk, .6) });
      ctx.restore();
    }
    const m = ctx.getTransform(); ctx.restore();
    const [px, py] = W2S(m, PHONE[0], PHONE[1]), [sx, sy] = W2S(m, lerp(SOCKET[0], PHONE[0], w), lerp(SOCKET[1], PHONE[1], w));
    darkness(ctx, [[px, py, 300, .96], [sx, sy, 360, .9], { cone: [1150, 2050, sx, sy, 160], s: .4 }], .9);
    glow(ctx, px, py, 280, .26);
    vignette(ctx, .45); finish(ctx);
  });

  /* a06 · S6 "On the screen: Demolition Master." — telefon Kaan'ın elinde; dedenin kalan "Time's up" kartı, Kaan "Try again"e basar. */
  shot('a06-ekran', k => k.c6, k => k.c7, (ctx, t, u) => {
    const k = times(), idx = seqPhone(t);
    darkRoomBg(ctx, false); screenHalo(ctx, 540, 700, 1); vignette(ctx, .55);
    phoneClose(ctx, t, { cx: 540, cy: 770, z: 1.25 * lerp(.97, 1.03, E.io(u)), rot: -.05, idx, hands: true, taps: [{ t: k.tap1, at: TRY_AGAIN }], note: true });
    finish(ctx);
  });

  /* a07 · S7–S8 "Level twelve. He was stuck." — ekrana yakın, parlak; dedenin "Lv 12" notu; bölüm baştan, kule yarıda kalır: TIME'S UP. */
  shot('a07-seviye', k => k.c7, k => k.c9, (ctx, t, u) => {
    const idx = seqPhone(t);
    darkRoomBg(ctx, false); screenHalo(ctx, 540, 640, 1.1); vignette(ctx, .5);
    phoneClose(ctx, t, { cx: 590, cy: 860, z: 1.32 * lerp(1, 1.04, E.io(u)), rot: .02, idx, hands: true, note: true });
    finish(ctx);
  });

  /* a08 · S9 "Grandpa." — kapının yanında çivide eski baret; fener üzerinde durur, sessizlik. */
  shot('a08-baret', k => k.c9, k => k.c10, (ctx, t, u) => {
    const z = lerp(3.0, 3.3, E.io(u));
    ctx.save(); cam(ctx, z, 10, 300, 560, 820);
    drawWorld(ctx, t, { lamp: false, door: .92 });
    motes(ctx, t, [-120, 180, 260, 260], 45, 81, .8, 1.3);
    const m = ctx.getTransform(); ctx.restore();
    const [hx, hy] = W2S(m, NAIL[0], NAIL[1] + 60), [dx, dy] = W2S(m, DOOR.x1 - 60, 360);
    darkness(ctx, [[hx, hy, 420, .97], [dx, dy, 300, .35], { cone: [1200, 1900, hx, hy, 190], s: .35 }], .9);
    glow(ctx, hx, hy, 260, .1, '255,243,196');
    vignette(ctx, .45); finish(ctx);
  });

  /* a09 · S10 "Who took down real buildings for forty years." — duvardaki yıkım eskizleri (1981…2003), fener soldan sağa gezer. */
  shot('a09-eskiz', k => k.c10, k => k.c11, (ctx, t, u) => {
    const w = E.ioC(u), cx = lerp(150, 470, w), cy = lerp(190, 300, w) + Math.sin(u * Math.PI) * 30, z = lerp(2.4, 2.7, u);
    ctx.save(); cam(ctx, z, cx, cy, 540, 840);
    drawWorld(ctx, t, { lamp: false, door: .92 });
    motes(ctx, t, [40, 40, 560, 420], 70, 91, .6, 1.3);
    const m = ctx.getTransform(); ctx.restore();
    const [bx, by] = W2S(m, cx + 10, cy);
    darkness(ctx, [[bx, by, 520, .97], { cone: [1150, 1950, bx, by, 220], s: .35 }], .88);
    glow(ctx, bx, by, 300, .1, '255,243,196');
    vignette(ctx, .45); finish(ctx);
  });

  /* a10 · S11 "I finished the level for him." — Kaan dedenin masasında oturur, lamba yanık; arkada alçak takvim (vurgusuz). */
  function deskFront(ctx, y0) {
    C.seed(501);
    C.shape(ctx, [[-40, y0 + 6], [1120, y0 - 6], [1120, 2000], [-40, 2000]], P.wood, { lw: 6, shade: c => { C.blot(c, [[-40, y0 + 30], [1120, y0 + 20], [1120, y0 + 60], [-40, y0 + 70]], '#3f2711', .5); for (let i = 0; i < 6; i++) C.line(c, [[-40, y0 + 120 + i * 90], [1120, y0 + 110 + i * 92]], 2, 'rgba(21,18,13,.25)', 1.5); } });
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = P.dustLt; for (let i = 0; i < 30; i++) ctx.fillRect(rnd(i + 900) * 1080, y0 + 4 + rnd(i + 950) * 14, 10 + rnd(i + 990) * 40, 2); ctx.restore();
    // soğuk çay (masanın solunda) + rulo
    const gx = 150, gy = y0 + 60;
    C.shape(ctx, [[gx - 42, gy - 160], [gx + 42, gy - 160], [gx + 24, gy - 90], [gx + 42, gy - 12], [gx - 42, gy - 12], [gx - 24, gy - 90]], 'rgba(220,235,240,.8)', { lw: 4 });
    C.shape(ctx, [[gx - 33, gy - 124], [gx + 33, gy - 124], [gx + 21, gy - 90], [gx + 36, gy - 21], [gx - 36, gy - 21], [gx - 21, gy - 90]], '#8a3a12', { lw: 0 });
    C.shape(ctx, C.ell(gx, gy - 6, 72, 15, 16), P.paper, { lw: 3.6 });
    ctx.save(); ctx.translate(760, y0 + 40); ctx.rotate(-.08); C.shape(ctx, [[-220, -26], [200, -26], [200, 26], [-220, 26]], P.pageDk, { lw: 4 }); C.shape(ctx, C.ell(200, 0, 12, 26, 12), P.page, { lw: 3 }); ctx.restore();
  }
  shot('a10-masa', k => k.c11, k => k.c12, (ctx, t, u) => {
    const k = times(), z = lerp(1.0, 1.06, E.io(u));
    ctx.save(); cam(ctx, z, 540, 960);
    ctx.save(); ctx.filter = 'blur(3px)'; cam(ctx, 1.45, 520, 430); drawWorld(ctx, t, { lamp: true, door: .92, idx: CARD, phone: false }); ctx.restore();
    ctx.fillStyle = 'rgba(12,14,24,.38)'; ctx.fillRect(-100, -100, 1300, 2200);
    { const g = ctx.createLinearGradient(560, 0, 1080, 0); g.addColorStop(0, 'rgba(12,14,24,0)'); g.addColorStop(1, 'rgba(12,14,24,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 2000); }
    const lean = E.ioC(seg(twos(t), k.c11 + .5, k.c11 + .9)) * 10, bl = (t > k.c11 + 1.05 && t < k.c11 + 1.05 + 3 / FPS) ? 1 : 0;
    C.drawKaan(ctx, { x: 450, y: 1225 + lean, s: 1.2, pose: 'sit', hands: 'phone', glow: .9, expr: 'determined', look: .2, blink: bl, seed: 11 });
    deskFront(ctx, 1110);
    ctx.restore();
    glow(ctx, 442, 1000, 260, .2); vignette(ctx, .5); finish(ctx);
  });

  /* a11 · S12 "It took me three tries." — telefon yakın, üç dokunuş: Try again → TIME'S UP → Try again → bina: DEMOLISHED! */
  shot('a11-deneme', k => k.c12, k => k.c13, (ctx, t, u) => {
    const k = times(), idx = seqTries(t);
    darkRoomBg(ctx, true); screenHalo(ctx, 540, 700, 1); vignette(ctx, .5);
    const bump = idx >= 28 && idx <= 55 ? 1 + .02 * (1 - E.outC(seg(t, k.tapC + 14 / FPS, k.tapC + 20 / FPS))) : 1;
    phoneClose(ctx, t, { cx: 540, cy: 760, z: 1.3 * bump * lerp(1, 1.04, E.io(u)), rot: -.04, idx, hands: true, note: true,
      taps: [{ t: k.tapA, at: TRY_AGAIN }, { t: k.tapB, at: TRY_AGAIN }, { t: k.tapC, at: BUILDING }] });
    finish(ctx);
  });

  /* a12–a13 · S13 "Then I looked at the drawings." / S14 "They were of Daisy." — üstten masa: rulo soldan açılır (Daisy'nin çizimi),
     kalemlikte tek mavi kalem; sonra çizime yakın. SENSOR yazısı rulonun altında kalır (B açar). */
  const PLAN = { x: 540, y: 820, s: 1.1, rot: -.03 };
  function rollX(t) {
    const k = times();
    if (t < k.c14) return lerp(-372, -175, E.outC(seg(t, k.c13 + .12, k.c14 - .1)));
    return lerp(-175, -80, E.io(seg(t, k.c14, k.end)));
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
  function planToScreen(lx, ly) { const c = Math.cos(PLAN.rot), s = Math.sin(PLAN.rot); return [PLAN.x + (lx * c - ly * s) * PLAN.s, PLAN.y + (lx * s + ly * c) * PLAN.s]; }
  shot('a12-rulo', k => k.c13, k => k.c14, (ctx, t, u) => {
    const rx = rollX(twos(t)), z = lerp(1.0, 1.06, E.io(u));
    ctx.save(); cam(ctx, z, 540, 860);
    deskTop(ctx, t, rx);
    const [hx, hy] = planToScreen(rx + 24, 80), [lx, ly] = planToScreen(-330, 230);
    handOnRoll(ctx, lx, ly + 40, .25, true);
    handOnRoll(ctx, hx, hy, -.2, false);
    ctx.restore();
    lampWarm(ctx, .5); vignette(ctx, .45); finish(ctx);
  });
  shot('a13-daisy', k => k.c14, k => k.end, (ctx, t, u) => {
    const rx = rollX(twos(t)), z = lerp(1.35, 1.55, E.io(u)), [fx, fy] = planToScreen(-210, -10);
    ctx.save(); cam(ctx, z, fx, fy, 540, 800);
    deskTop(ctx, t, rx);
    const [hx, hy] = planToScreen(rx + 24, 80);
    handOnRoll(ctx, hx, hy, -.2, false);
    ctx.restore();
    lampWarm(ctx, .5); vignette(ctx, .45); finish(ctx);
  });

  /* ================= SES EKİBİ İÇİN GÖRSEL ANLAR ================= */
  TB.cuesA = {
    get kapiGicirti() { return +times().door.toFixed(3); },            // kapı aralanır (gıcırtı, 0,75 sn)
    get fenerAcilir() { return +(times().door + .3).toFixed(3); },     // telefon feneri yanar (küçük tık)
    get adim1() { return +(times().step + .1).toFixed(3); },           // Kaan içeri: tahta zeminde 2 adım
    get adim2() { return +(times().step + .6).toFixed(3); },
    get telefonaUzanma() { return +times().reach.toFixed(3); },        // el telefonu ayaklıktan alır (hafif tık)
    get dokunus1() { return +times().tap1.toFixed(3); },               // "Try again" dokunuşu
    get oyunKepenk() { return +(times().tap1 + 1 / FPS).toFixed(3); },   // oyun içi kepenk (kare 131–137)
    get timesUp() { return +(times().tap1 + 60 / FPS).toFixed(3); },     // TIME'S UP damgası (kare 96)
    get lambaTik() { return +times().c11.toFixed(3); },                // masa lambası yanık (kesmede tık)
    get dokunus2() { return +times().tapA.toFixed(3); },
    get timesUp2() { return +(times().tapA + 7 / FPS).toFixed(3); },
    get dokunus3() { return +times().tapB.toFixed(3); },
    get dokunusBina() { return +times().tapC.toFixed(3); },            // yıkım başlar (kare 14), DEMOLISHED! ≈ +14 kare
    get demolished() { return +(times().tapC + 14 / FPS).toFixed(3); },
    get kagitRulo() { return +(times().c13 + .12).toFixed(3); }         // rulo açılır (kâğıt sesi, ≈0,8 sn)
  };
})();
