/* Two Beeps — ortak çizim kitaplığı (Canvas 2D, dış istek yok).
   Kullanım: <script src="cizim.js"></script> sonra window.Cizim.drawKaan(ctx, {...}) vb.
   Kurallar docs/STIL.md içinde. Bütün şekiller tohumlu (seed) "el titremesi" ile çizilir:
   aynı seed = aynı çizgi; çizgi kaynatma (line boil) için seed'i 4 karede bir değiştir. */
(function (G) {
  'use strict';

  const PAL = {
    ink: '#15120d', paper: '#f1e8d4', paperDk: '#ddd0b4',
    hazard: '#f5b21c', hazardDeep: '#d98e0b', hazardHi: '#ffd650',
    // gündüz avlu
    sky0: '#8fbadb', sky1: '#c9dbe0', sky2: '#f0e2c2', cloud: '#f8f1e2',
    far: '#b3bfc6', far2: '#9eadb7', farWin: '#d3dade',
    ground: '#cfb184', groundDk: '#a88a5f', groundLt: '#e3cca0', weed: '#7d8a4a',
    brick: '#b4532f', brickDk: '#86391f', brickLt: '#cf7349', mortar: '#d9c2a0', soot: '#3a2c24', concrete: '#bdb19b',
    // yıkım tozu
    dust: '#988c7a', dustLt: '#d8cab0', dustDk: '#6e6457',
    // gece ofis
    night: '#070b18', night2: '#1d2742', lamp: '#ffd27a', wood: '#5e3b1d', screen: '#ffe27a',
    // Kaan
    jacket: '#2f6f73', jacketDk: '#1f4d50', pants: '#3a3d45', pantsDk: '#272a31',
    skin: '#c68a5e', skinDk: '#a0663f', hair: '#2a1d16', boot: '#6b4423', bootDk: '#4a2e17',
    // Daisy
    dBody: '#f5b21c', dSide: '#df9d10', dShade: '#c07f08', dTop: '#ffd650', rust: '#9a4b26',
    glass: '#2b4552', glassHi: '#7fa3b8', steel: '#4a4e57', steelLt: '#9aa3ab', steelDk: '#2a2d34', tire: '#1d1f24',
    beaconOff: '#7a2a1d', beaconOn: '#ff3b2f', glow: '255,120,80', lightOff: '#e3dccb', lightOn: '#fff3c4'
  };

  /* ---------- el çizgisi altyapısı ---------- */
  function rng(seed) { let s = ((seed | 0) * 2654435761) >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  let R = rng(1);
  const seed = s => { R = rng(s); };
  const TAU = Math.PI * 2;

  // Noktaları düşük frekanslı sinüs gürültüsüyle titretir (beyaz gürültü değil: el gibi akar).
  function wobble(pts, closed, amp, step) {
    amp = amp == null ? 1.4 : amp; step = step || 12;
    const out = [], ph1 = R() * TAU, ph2 = R() * TAU, f1 = .018 + R() * .02, f2 = .07 + R() * .05;
    const n = pts.length, segs = closed ? n : n - 1; let dist = 0;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const k = Math.max(1, Math.ceil(L / step)), nx = -dy / L, ny = dx / L;
      for (let j = 0; j < k; j++) {
        const t = j / k, d = dist + L * t, o = amp * (Math.sin(d * f1 + ph1) * .65 + Math.sin(d * f2 + ph2) * .35);
        out.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
      }
      dist += L;
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  function ell(cx, cy, rx, ry, n, a0, a1) {
    n = n || 30; a0 = a0 || 0; a1 = a1 == null ? TAU : a1; const p = [];
    const full = Math.abs(a1 - a0) >= TAU - 1e-6, m = full ? n : n + 1;
    for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return p;
  }
  function pathOf(pts, closed) {
    const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    if (closed) p.closePath(); return p;
  }
  // Mürekkep: düz uçlu kalem hissi (yatay çizgiler biraz kalın, dikeyler ince).
  function ink(ctx, p, lw, col) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col || PAL.ink;
    ctx.lineWidth = lw; ctx.stroke(p);
    ctx.translate(lw * .12, lw * .3); ctx.lineWidth = lw * .75; ctx.stroke(p); ctx.restore();
  }
  // Doldur + (isteğe bağlı) gölge + mürekkep. Path2D döner (kırpma için).
  function shape(ctx, pts, fill, o) {
    o = o || {}; const closed = !o.open;
    const p = pathOf(wobble(pts, closed, o.amp, o.step), closed);
    if (fill) { ctx.fillStyle = fill; ctx.fill(p); }
    if (o.shade) { ctx.save(); ctx.clip(p); o.shade(ctx, p); ctx.restore(); }
    if (o.lw !== 0) ink(ctx, p, o.lw || 5, o.ink);
    return p;
  }
  function line(ctx, pts, lw, col, amp) { ink(ctx, pathOf(wobble(pts, false, amp == null ? 1 : amp, 8), false), lw, col); }
  // Gölge: kırpılmış alanda kaba kenarlı yarı saydam leke (cel gölge, fırça kenarı).
  function blot(ctx, pts, col, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = col;
    ctx.fill(pathOf(wobble(pts, true, 2.6, 9), true)); ctx.restore();
  }

  /* ---------- kâğıt dokusu ---------- */
  let grainCv = null;
  function grainCanvas() {
    if (grainCv) return grainCv;
    const r = rng(99), N = 384, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const sm = document.createElement('canvas'); sm.width = sm.height = 24; const s = sm.getContext('2d'), id = s.createImageData(24, 24);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - .5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    s.putImageData(id, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(sm, 0, 0, N, N);
    const f = g.getImageData(0, 0, N, N);
    for (let i = 0; i < f.data.length; i += 4) { const n = (r() - .5) * 70 + ((r() < .012) ? -60 : 0); f.data[i] += n; f.data[i + 1] += n; f.data[i + 2] += n; }
    // lif çizgileri
    g.putImageData(f, 0, 0); g.globalAlpha = .18; g.strokeStyle = '#000'; g.lineWidth = .7;
    for (let i = 0; i < 70; i++) { const x = r() * N, y = r() * N, a = r() * TAU, l = 6 + r() * 18; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * .5, y + Math.sin(a + 1) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    grainCv = c; return c;
  }
  function grain(ctx, x, y, w, h, alpha) {
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha == null ? .22 : alpha;
    ctx.fillStyle = ctx.createPattern(grainCanvas(), 'repeat'); ctx.fillRect(x, y, w, h); ctx.restore();
  }

  /* ---------- ortak parçalar ---------- */
  function hazardStripes(ctx, p, x, y, w, h, band) {
    band = band || 22; ctx.save(); ctx.clip(p); ctx.fillStyle = PAL.hazard; ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.fillStyle = PAL.ink;
    for (let i = -h * 2; i < w + h; i += band * 2) { ctx.beginPath(); ctx.moveTo(x + i, y + h + 4); ctx.lineTo(x + i + band, y + h + 4); ctx.lineTo(x + i + band + h + 8, y - 4); ctx.lineTo(x + i + h + 8, y - 4); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function lineW(o, s, base) { return o.lw || (base || 5.2) / Math.sqrt(s); }

  /* ================= KAAN =================
     Ayak ortası (x,y). Yerel boy ≈ 560 birim (s=1). opts: s, expr 'calm'|'worried', look (göz bebeği kayması -1..1),
     phone (bool, oyun ekranı açık telefon), flip, seed, blink (0..1). */
  function drawKaan(ctx, o) {
    o = o || {}; const s = o.s || 1, P = PAL, lw = lineW(o, s);
    seed(o.seed || 11); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -s : s, s);
    const shadeR = (pts) => (c) => blot(c, pts, '#0b1f2a', .28);

    // zemin gölgesi
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(6, 2, 92, 13, 0, 0, TAU); ctx.fill(); ctx.restore();

    // kapüşon (ensede)
    shape(ctx, ell(-2, -398, 52, 22, 22), P.jacketDk, { lw });
    // arka kol
    shape(ctx, [[-62, -392], [-90, -330], [-102, -248], [-76, -240], [-66, -312], [-42, -368]], P.jacketDk, { lw });
    shape(ctx, [[-101, -262], [-76, -255], [-76, -240], [-102, -246]], P.hazard, { lw: lw * .7 });
    shape(ctx, ell(-89, -228, 14, 16, 18), P.skinDk, { lw });
    // bacaklar
    shape(ctx, [[-44, -214], [-8, -214], [-14, -44], [-42, -44]], P.pantsDk, { lw });
    shape(ctx, [[4, -214], [42, -214], [46, -44], [14, -44]], P.pants, { lw, shade: shadeR([[30, -220], [50, -220], [50, -40], [36, -40]]) });
    shape(ctx, [[-45, -62], [-12, -62], [-12, -44], [-44, -44]], P.pants, { lw: lw * .8 });
    shape(ctx, [[12, -62], [47, -62], [47, -44], [13, -44]], P.pantsDk, { lw: lw * .8 });
    // botlar (iri: siluet işareti)
    shape(ctx, [[-50, -48], [-8, -48], [-4, -16], [-2, 0], [-66, 0], [-62, -20]], P.bootDk, { lw });
    shape(ctx, [[10, -48], [50, -48], [56, -24], [82, -12], [84, 0], [8, 0]], P.boot, { lw, shade: (c) => blot(c, [[8, -10], [90, -10], [90, 4], [8, 4]], P.bootDk, .9) });
    line(ctx, [[60, -27], [64, -18]], lw * .6);
    // gövde: bol, kutu gibi iş ceketi
    shape(ctx, [[-72, -398], [68, -398], [84, -300], [90, -198], [-84, -194], [-80, -300]], P.jacket, {
      lw, shade: (c) => { blot(c, [[40, -400], [100, -400], [100, -190], [52, -190], [58, -300]], '#0b1f2a', .3); blot(c, [[-90, -222], [100, -226], [100, -180], [-90, -180]], '#0b1f2a', .25); }
    });
    line(ctx, [[4, -392], [6, -300], [8, -198]], lw * .55);
    line(ctx, [[-60, -282], [-26, -284]], lw * .55); line(ctx, [[-60, -282], [-58, -252], [-28, -254], [-26, -284]], lw * .45);
    // yaka
    shape(ctx, [[-30, -402], [4, -366], [-18, -360], [-44, -392]], P.jacketDk, { lw: lw * .8 });
    shape(ctx, [[34, -402], [6, -366], [26, -360], [48, -392]], P.jacketDk, { lw: lw * .8 });
    // boyun
    shape(ctx, [[-14, -424], [16, -424], [18, -394], [-14, -392]], P.skin, { lw, shade: (c) => blot(c, [[-20, -430], [24, -430], [24, -408], [-20, -414]], P.skinDk, 1) });
    // ön kol + telefon (oyun bağı: ekran sarı)
    shape(ctx, [[50, -392], [84, -334], [98, -262], [72, -252], [62, -318], [36, -362]], P.jacket, { lw, shade: shadeR([[80, -340], [104, -340], [104, -250], [84, -250]]) });
    shape(ctx, [[97, -276], [72, -268], [72, -252], [98, -260]], P.hazard, { lw: lw * .7 });
    if (o.phone !== false) {
      ctx.save(); ctx.translate(92, -236); ctx.rotate(-.22);
      shape(ctx, [[-14, -30], [14, -30], [14, 22], [-14, 22]], P.steelDk, { lw: lw * .8 });
      const scr = shape(ctx, [[-10, -25], [10, -25], [10, 16], [-10, 16]], P.screen, { lw: 0, amp: .4 });
      ctx.save(); ctx.clip(scr); ctx.fillStyle = P.brick; ctx.fillRect(-4, -14, 8, 30); ctx.fillStyle = P.ink;
      for (let i = -2; i < 3; i++) { ctx.fillRect(-10 + i * 8, 10, 4, 6); } ctx.restore();
      ctx.restore();
    }
    shape(ctx, ell(86, -240, 15, 15, 18), P.skin, { lw });
    line(ctx, [[78, -246], [92, -244]], lw * .45);

    // KAFA
    shape(ctx, ell(-38, -470, 9, 13, 14), P.skinDk, { lw });
    const headPts = [];
    for (let i = 0; i < 34; i++) { const a = i / 34 * TAU; const ry = Math.sin(a) > 0 ? 56 : 52, rx = Math.sin(a) > 0 ? 42 - Math.sin(a) * 4 : 45; headPts.push([4 + Math.cos(a) * rx, -472 + Math.sin(a) * ry]); }
    shape(ctx, headPts, P.skin, { lw, shade: (c) => { blot(c, [[30, -540], [70, -540], [70, -400], [26, -410], [40, -470]], P.skinDk, .55); } });
    // saç: dağınık kâkül + yukarı kıvrık tutam (siluet imzası)
    shape(ctx, [[-44, -470], [-46, -505], [-30, -526], [-4, -534], [28, -530], [46, -512], [50, -486], [40, -490], [34, -500], [26, -490], [16, -502], [6, -492], [-6, -504], [-16, -492], [-26, -500], [-34, -478]], P.hair, { lw });
    shape(ctx, [[-2, -528], [6, -560], [26, -584], [48, -580], [40, -570], [26, -566], [18, -548], [16, -526]], P.hair, { lw });
    // YÜZ: iki nokta göz, iki kaş, tek ağız. Başka parça yok.
    const ex = o.expr || 'calm', lk = (o.look || 0) * 4, bl = o.blink || 0;
    const eyeY = -468;
    [[-10, eyeY], [24, eyeY]].forEach(([x, y]) => {
      if (bl > .5) { line(ctx, [[x - 6, y], [x + 6, y + 1]], lw * .7); return; }
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(x + lk, y, ex === 'worried' ? 4.6 : 5.6, ex === 'worried' ? 6.4 : 6.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + lk + 1.6, y - 2.2, 1.5, 0, TAU); ctx.fill();
    });
    if (ex === 'worried') {
      line(ctx, [[-22, -484], [-12, -490], [-2, -495]], lw * .8);
      line(ctx, [[14, -497], [24, -492], [36, -486]], lw * .8);
      line(ctx, [[2, -438], [7, -442], [12, -438], [17, -442], [22, -438]], lw * .65, null, .3);
      // ter damlası
      shape(ctx, [[48, -500], [54, -486], [52, -478], [44, -478], [43, -486]], '#cfe6f2', { lw: lw * .55, amp: .3 });
    } else {
      line(ctx, [[-22, -487], [-11, -490], [-1, -489]], lw * .8);
      line(ctx, [[14, -492], [25, -497], [36, -495]], lw * .8);
      line(ctx, [[0, -441], [12, -442], [22, -446], [27, -451]], lw * .65, null, .3);
    }
    line(ctx, [[14, -464], [19, -454], [13, -451]], lw * .45, P.skinDk, .2);
    ctx.restore();
  }

  /* ================= DAISY =================
     Ön yüz ortası alt (x,y). Ön yüz kameraya bakar, gövde sağa-arkaya uzanır (eğik izdüşüm).
     opts: s, beep (0..1: uyarı ışığı yoğunluğu), mood 'sleepy'|'alert', boom (0..1 bom açısı), hook (sallanma, radyan), seed, flip. */
  const DX = .55, DY = -.22, SIDE_X = 120;
  function side(ctx, fn) { ctx.save(); ctx.transform(DX, DY, 0, 1, SIDE_X, 0); fn(); ctx.restore(); }

  function drawDaisy(ctx, o) {
    o = o || {}; const s = o.s || 1, P = PAL, lw = lineW(o, s, 5.6), beep = o.beep || 0;
    const mood = o.mood || (beep > 0 ? 'alert' : 'sleepy');
    seed(o.seed || 23); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -s : s, s);

    // zemin gölgesi
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.beginPath();
    ctx.moveTo(-150, 6); ctx.lineTo(160 + DX * 660, 6 + DY * 660 + 10); ctx.lineTo(150 + DX * 660, 16 + DY * 660 + 30); ctx.lineTo(-160, 22); ctx.fill(); ctx.restore();

    // --- yan gövde (eğik düzlem) ---
    side(ctx, () => {
      const w = lw * 1.25;
      // şasi
      shape(ctx, [[0, -96], [660, -96], [660, -66], [0, -66]], P.steelDk, { lw: w });
      // taşıyıcı güverte
      shape(ctx, [[170, -176], [650, -176], [660, -96], [170, -96]], P.dSide, { lw: w, shade: (c) => { blot(c, [[160, -120], [680, -120], [680, -90], [160, -90]], P.dShade, .9); } });
      // döner tabla gövdesi + karşı ağırlık (tehlike şeritli)
      shape(ctx, [[380, -268], [600, -268], [620, -176], [380, -176]], P.dSide, { lw: w, shade: (c) => blot(c, [[520, -280], [640, -280], [640, -170], [540, -170]], P.dShade, .7) });
      const cw = shape(ctx, [[600, -262], [646, -262], [650, -180], [620, -180]], null, { lw: 0 });
      hazardStripes(ctx, cw, 596, -266, 60, 90, 18); ink(ctx, cw, w);
      for (let i = 0; i < 4; i++) line(ctx, [[410 + i * 26, -248], [410 + i * 26, -200]], w * .6);
      // kabin yanı
      shape(ctx, [[0, -330], [150, -330], [170, -306], [170, -96], [0, -96]], P.dSide, {
        lw: w, shade: (c) => { blot(c, [[0, -140], [180, -140], [180, -90], [0, -90]], P.dShade, .9); blot(c, [[8, -230], [60, -252], [90, -226], [30, -200]], P.rust, .35); }
      });
      shape(ctx, [[18, -306], [140, -306], [146, -214], [18, -214]], P.glass, { lw: w, shade: (c) => { c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(40, -320, 18, 140); } });
      line(ctx, [[4, -200], [164, -200]], w * .5); line(ctx, [[104, -206], [104, -110]], w * .5);
      // adı kapıda, elle boyanmış
      ctx.save(); ctx.translate(52, -150); ctx.rotate(-.03); ctx.font = '400 40px "Lilita One"'; ctx.textAlign = 'center';
      ctx.fillStyle = P.ink; ctx.fillText('DAISY', 2, 3); ctx.fillStyle = P.paper; ctx.fillText('DAISY', 0, 0); ctx.restore();
      // çamurluklar + tekerler
      [100, 450, 560].forEach((u) => {
        shape(ctx, ell(u, -62, 66, 46, 20, Math.PI, TAU), P.dShade, { lw: w, open: true });
        shape(ctx, ell(u, -50, 50, 50, 28), P.tire, { lw: w });
        shape(ctx, ell(u, -50, 26, 26, 20), P.steelLt, { lw: w * .7, shade: (c) => blot(c, ell(u + 8, -42, 24, 24, 16), P.steel, .7) });
        shape(ctx, ell(u, -50, 11, 11, 12), P.hazard, { lw: w * .6 });
      });
    });

    // --- tavan (açık sarı, güneş üstten) ---
    shape(ctx, [[-122, -332], [122, -332], [122 + DX * 160, -332 + DY * 160], [-122 + DX * 160, -332 + DY * 160]], P.dTop, { lw });

    // --- bom (kafes) + kanca ---
    const piv = [SIDE_X + DX * 470, -262 + DY * 470];
    const ang = -2.36 + (o.boom || 0) * .5, L = 700;
    const tip = [piv[0] + Math.cos(ang) * L, piv[1] + Math.sin(ang) * L];
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, bw = 30;
    const A = (t, k) => [piv[0] + ux * L * t + nx * bw * k, piv[1] + uy * L * t + ny * bw * k];
    const lace = []; for (let i = 0; i <= 14; i++) lace.push(A(.04 + i * .066, i % 2 ? 1 : -1));
    ctx.save(); ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 2.2; ctx.lineJoin = 'round'; ctx.stroke(pathOf(wobble(lace, false, .8, 10), false));
    ctx.strokeStyle = P.dShade; ctx.lineWidth = lw * .9; ctx.stroke(pathOf(lace, false)); ctx.restore();
    const chord = (k) => shape(ctx, [A(0, k - .22), A(1, k - .22), A(1, k + .22), A(0, k + .22)], P.dBody, { lw: lw * .9, amp: .8 });
    chord(-1); chord(1);
    shape(ctx, [A(.97, -1.3), A(1.03, -1.3), A(1.03, 1.3), A(.97, 1.3)], P.dBody, { lw: lw * .9 });
    shape(ctx, ell(tip[0], tip[1], 16, 16, 14), P.steel, { lw: lw * .8 });
    // hidrolik silindir
    line(ctx, [[SIDE_X + DX * 420, -176 + DY * 420], A(.3, 1)], lw * 2.6);
    line(ctx, [[SIDE_X + DX * 420, -176 + DY * 420], A(.3, 1)], lw * 1.2, P.steelLt, .2);
    shape(ctx, ell(piv[0], piv[1], 20, 20, 16), P.steel, { lw: lw * .8 });
    // kanca
    const sw = o.hook || 0, hl = 360, hx = tip[0] + Math.sin(sw) * hl, hy = tip[1] + Math.cos(sw) * hl;
    line(ctx, [[tip[0], tip[1] + 14], [hx, hy - 36]], lw * .55, null, .4);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-sw);
    const hb = shape(ctx, [[-24, -40], [24, -40], [26, 8], [-26, 8]], null, { lw: 0 });
    hazardStripes(ctx, hb, -28, -44, 56, 56, 12); ink(ctx, hb, lw * .8);
    ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 2.4; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, 22); ctx.arc(-10, 32, 12, -.3, Math.PI * .9, false); ctx.stroke();
    ctx.strokeStyle = P.steelLt; ctx.lineWidth = lw * .9; ctx.stroke(); ctx.restore();

    // --- ön yüz ---
    shape(ctx, [[-122, -332], [122, -332], [124, -96], [-124, -96]], P.dBody, {
      lw, shade: (c) => {
        blot(c, [[-130, -120], [130, -120], [130, -90], [-130, -90]], P.dShade, .7);
        blot(c, [[-128, -150], [-96, -160], [-86, -110], [-128, -104]], P.rust, .5);
        blot(c, [[70, -330], [104, -326], [112, -300], [84, -306]], P.rust, .38);
        R(); for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(154,75,38,.55)'; c.beginPath(); c.arc(-120 + R() * 240, -328 + R() * 230, .8 + R() * 2.2, 0, TAU); c.fill(); }
      }
    });
    line(ctx, [[40, -204], [52, -199], [60, -205]], lw * .4, P.dShade, .2); // göçük
    // yan ayna (eğri: yaşlı)
    line(ctx, [[-122, -268], [-150, -262], [-156, -238]], lw * .9);
    shape(ctx, [[-170, -250], [-146, -252], [-144, -206], [-168, -204]], P.steel, { lw: lw * .8 });
    // ön cam + güneşlik (alın)
    shape(ctx, [[-102, -314], [102, -314], [98, -214], [-98, -214]], P.glass, {
      lw, shade: (c) => {
        c.fillStyle = 'rgba(190,220,240,.22)'; c.beginPath(); c.moveTo(-60, -320); c.lineTo(-30, -320); c.lineTo(-80, -205); c.lineTo(-110, -205); c.fill();
        c.beginPath(); c.moveTo(30, -320); c.lineTo(42, -320); c.lineTo(0, -205); c.lineTo(-12, -205); c.fill();
      }
    });
    line(ctx, [[0, -314], [0, -214]], lw * .9);
    shape(ctx, [[-112, -326], [112, -326], [108, -310], [-108, -310]], P.steelDk, { lw: lw * .8 });
    // ızgara
    shape(ctx, [[-36, -196], [36, -196], [36, -116], [-36, -116]], P.steelDk, { lw });
    for (let i = -24; i <= 24; i += 12) line(ctx, [[i, -190], [i, -122]], lw * .45, P.steel, .3);
    // farlar = gözler
    const lit = beep > 0, lidT = mood === 'alert' ? .12 : .46, tilt = mood === 'alert' ? -.04 : .2;
    [-1, 1].forEach((side_) => {
      const cx = side_ * 76, cy = -156;
      if (lit) {
        const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 90); g.addColorStop(0, `rgba(255,243,196,${.55 * beep})`); g.addColorStop(1, 'rgba(255,243,196,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, TAU); ctx.fill();
      }
      shape(ctx, ell(cx, cy, 36, 36, 26), P.steelLt, { lw });
      const gl = shape(ctx, ell(cx, cy, 27, 27, 24), lit ? P.lightOn : P.lightOff, {
        lw: lw * .7, shade: (c) => {
          c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(cx - 9, cy - 9, 8, 5, -.7, 0, TAU); c.fill();
          // göz kapağı: farın boyalı siperliği
          const y0 = cy - 27 + 54 * lidT; const yi = y0 + side_ * 0, yo = y0;
          const inner = y0 + 27 * tilt, outer = y0 - 8 * tilt;
          c.fillStyle = P.dShade; c.beginPath(); c.moveTo(cx - 40, cy - 40);
          c.lineTo(cx + 40, cy - 40);
          c.lineTo(cx + 40, side_ < 0 ? inner : outer); c.lineTo(cx - 40, side_ < 0 ? outer : inner); c.closePath(); c.fill();
          c.strokeStyle = P.ink; c.lineWidth = lw * .8; c.beginPath(); c.moveTo(cx - 40, side_ < 0 ? outer : inner); c.lineTo(cx + 40, side_ < 0 ? inner : outer); c.stroke();
          void yi; void yo;
        }
      });
      void gl;
    });
    // tampon (tehlike şeridi: oyunla aynı)
    const bp = shape(ctx, [[-134, -100], [134, -100], [136, -66], [-136, -66]], null, { lw: 0 });
    hazardStripes(ctx, bp, -140, -104, 280, 42, 20); ink(ctx, bp, lw);
    // tavan uyarı ışığı = iki bip
    shape(ctx, [[-22, -346], [22, -346], [24, -332], [-24, -332]], P.steelDk, { lw: lw * .8 });
    if (lit) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * beep})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * beep})`); g.addColorStop(1, `rgba(${P.glow},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    }
    shape(ctx, ell(0, -346, 21, 25, 20, Math.PI, TAU), lit ? P.beaconOn : P.beaconOff, {
      lw, shade: (c) => { c.fillStyle = lit ? 'rgba(255,240,200,.9)' : 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); }
    });
    if (lit) { // iki bip = iki yay, iki yanda
      [-1, 1].forEach((d) => [0, 1].forEach((k) => {
        const r = 40 + k * 22; const a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18;
        line(ctx, ell(0, -352, r, r * .9, 8, a0, a1), lw * (1 - k * .2) * Math.min(1, beep * 1.5), null, .5);
      }));
    }
    ctx.restore();
  }

  /* ================= ARKA PLAN: bacalı boş arsa (gündüz) =================
     opts: x,y,w,h, horizon (oran), chimneyX (oran), seed, dust (0..1 havada toz) */
  function drawBackground(ctx, o) {
    o = o || {}; const P = PAL, x = o.x || 0, y = o.y || 0, w = o.w || 1080, h = o.h || 1920;
    const hz = y + h * (o.horizon || .58), lw = o.lw || 3.4;
    seed(o.seed || 5); ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // gök
    const g = ctx.createLinearGradient(0, y, 0, hz); g.addColorStop(0, P.sky0); g.addColorStop(.6, P.sky1); g.addColorStop(1, P.sky2);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, hz - y + 2);
    // bulutlar (çizgisiz, düz)
    const cloud = (cx, cy, sc) => { ctx.fillStyle = P.cloud; ctx.globalAlpha = .9; [[0, 0, 70, 26], [-60, 10, 50, 20], [55, 8, 56, 22], [10, -18, 46, 26]].forEach(([a, b, rx, ry]) => ctx.fill(pathOf(wobble(ell(cx + a * sc, cy + b * sc, rx * sc, ry * sc, 22), true, 2), true))); ctx.globalAlpha = 1; };
    cloud(x + w * .2, y + h * .12, 1.1); cloud(x + w * .78, y + h * .2, .8);
    // uzak şehir (ince renkli çizgi)
    const far = (col, wc, base, hmin, hmax, step) => {
      let cx = x - 20; while (cx < x + w) {
        const bw = step * (.6 + R() * .8), bh = hmin + R() * (hmax - hmin);
        shape(ctx, [[cx, base], [cx, base - bh], [cx + bw, base - bh], [cx + bw, base]], col, { lw: 2, ink: P.far2, amp: .5 });
        if (wc) { ctx.fillStyle = wc; for (let yy = base - bh + 12; yy < base - 10; yy += 18) for (let xx = cx + 8; xx < cx + bw - 10; xx += 16) if (R() < .5) ctx.fillRect(xx, yy, 6, 8); }
        cx += bw + 4 + R() * 20;
      }
    };
    far(P.far, P.farWin, hz - 6, 60, 190, 70);
    // uzak kule vinç silueti (oyunun açılış ekranına selam)
    ctx.save(); ctx.strokeStyle = P.far2; ctx.lineWidth = 3; const tx = x + w * .9, ty = hz - 330;
    line(ctx, [[tx, hz], [tx, ty]], 6, P.far2, .3); line(ctx, [[tx - 230, ty + 8], [tx + 80, ty + 8]], 5, P.far2, .3);
    line(ctx, [[tx - 230, ty + 8], [tx, ty - 40], [tx + 80, ty + 8]], 2.5, P.far2, .3); line(ctx, [[tx - 160, ty + 10], [tx - 160, ty + 120]], 2, P.far2, .2); ctx.restore();
    // pus
    const hzg = ctx.createLinearGradient(0, hz - 120, 0, hz); hzg.addColorStop(0, 'rgba(240,226,194,0)'); hzg.addColorStop(1, 'rgba(240,226,194,.65)');
    ctx.fillStyle = hzg; ctx.fillRect(x, hz - 120, w, 122);
    // zemin
    const gg = ctx.createLinearGradient(0, hz, 0, y + h); gg.addColorStop(0, P.groundLt); gg.addColorStop(.35, P.ground); gg.addColorStop(1, P.groundDk);
    ctx.fillStyle = gg; ctx.fillRect(x, hz, w, y + h - hz);
    for (let i = 0; i < 26; i++) { const px = x + R() * w, py = hz + 20 + R() * (y + h - hz), r = 30 + R() * 90; blot(ctx, ell(px, py, r, r * .22, 14), R() < .5 ? P.groundDk : P.groundLt, .25); }
    // tel örgü çit + tehlike panosu
    const fy = hz + 18;
    ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = P.dustDk; ctx.lineWidth = 1.2;
    for (let fx = x - 20; fx < x + w; fx += 14) { ctx.beginPath(); ctx.moveTo(fx, fy - 70); ctx.lineTo(fx + 40, fy); ctx.moveTo(fx + 40, fy - 70); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.restore();
    line(ctx, [[x, fy - 72], [x + w, fy - 68]], 2.4, P.dustDk, .8);
    for (let fx = x + 30; fx < x + w; fx += 150) line(ctx, [[fx, fy - 76], [fx + 1, fy + 2]], 3.4, P.dustDk, .4);
    const sign = shape(ctx, [[x + w * .62, fy - 48], [x + w * .62 + 150, fy - 50], [x + w * .62 + 150, fy - 24], [x + w * .62, fy - 22]], null, { lw: 0 });
    hazardStripes(ctx, sign, x + w * .62 - 4, fy - 54, 160, 36, 14); ink(ctx, sign, 2.6);
    // BACA
    const cx = x + w * (o.chimneyX || .38), cb = hz + 40, ct = y + h * .085, bwid = 130, twid = 78;
    const L = [[cx - bwid / 2, cb], [cx - twid / 2, ct], [cx + twid / 2, ct], [cx + bwid / 2, cb]];
    const lerpX = (yy, side_) => { const t = (cb - yy) / (cb - ct); return cx + side_ * (bwid / 2 + (twid / 2 - bwid / 2) * t); };
    shape(ctx, L, P.brick, {
      lw, shade: (c) => {
        // tuğla sıraları
        let row = 0; for (let yy = cb - 13; yy > ct; yy -= 13, row++) {
          const l = lerpX(yy, -1), r = lerpX(yy, 1);
          c.strokeStyle = 'rgba(217,194,160,.5)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(l, yy + R() * 1.2); c.lineTo(r, yy + R() * 1.2); c.stroke();
          for (let xx = l + (row % 2 ? 10 : 22); xx < r - 4; xx += 26) {
            c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + R() - .5, yy + 13); c.stroke();
            if (R() < .09) { c.fillStyle = R() < .5 ? P.brickLt : P.brickDk; c.fillRect(xx + 1, yy + 1, 24, 11); }
          }
        }
        // gölge yüzü (güneş sol üstten)
        blot(c, [[cx + 6, ct - 10], [cx + 80, ct - 10], [cx + 90, cb + 10], [cx + 14, cb + 10]], P.brickDk, .55);
        // is
        const sg = c.createLinearGradient(0, ct, 0, ct + 130); sg.addColorStop(0, 'rgba(58,44,36,.85)'); sg.addColorStop(1, 'rgba(58,44,36,0)');
        c.fillStyle = sg; c.fillRect(cx - 80, ct, 160, 130);
      }
    });
    // kuşaklar + başlık
    [.32, .7].forEach((t) => { const yy = cb - (cb - ct) * t, l = lerpX(yy, -1) - 6, r = lerpX(yy, 1) + 6; shape(ctx, [[l, yy - 9], [r, yy - 9], [r, yy + 7], [l, yy + 7]], P.brickDk, { lw: lw * .8 }); });
    shape(ctx, [[cx - twid / 2 - 12, ct + 18], [cx + twid / 2 + 12, ct + 18], [cx + twid / 2 + 8, ct - 6], [cx - twid / 2 - 8, ct - 6]], P.brickDk, { lw });
    shape(ctx, [[cx - twid / 2 - 4, ct - 6], [cx + twid / 2 + 4, ct - 6], [cx + twid / 2, ct - 14], [cx - twid / 2, ct - 14]], P.soot, { lw: lw * .8 });
    // çatlak (merak tohumu)
    line(ctx, [[cx - 14, cb - (cb - ct) * .46], [cx - 6, cb - (cb - ct) * .5], [cx - 12, cb - (cb - ct) * .55], [cx - 2, cb - (cb - ct) * .6]], 2.2, P.ink, .4);
    // kaide + moloz
    shape(ctx, [[cx - bwid / 2 - 22, cb + 4], [cx + bwid / 2 + 22, cb + 4], [cx + bwid / 2 + 16, cb - 22], [cx - bwid / 2 - 16, cb - 22]], P.concrete, { lw, shade: (c) => blot(c, [[cx + 10, cb - 30], [cx + 100, cb - 30], [cx + 100, cb + 10], [cx + 20, cb + 10]], P.dustDk, .35) });
    for (let i = 0; i < 16; i++) { const px = cx - 170 + R() * 340, py = cb + 6 + R() * 30, sz = 7 + R() * 12, cl = [P.brick, P.brickDk, P.concrete, P.dust][i % 4]; ctx.save(); ctx.translate(px, py); ctx.rotate(R() * 3); shape(ctx, [[-sz, -sz * .5], [sz * .8, -sz * .6], [sz, sz * .4], [-sz * .7, sz * .5]], cl, { lw: 2.2, amp: .4 }); ctx.restore(); }
    // ot öbekleri + teker izi
    for (let i = 0; i < 9; i++) { const px = x + R() * w, py = hz + 40 + R() * (y + h - hz - 60); for (let k = 0; k < 5; k++) line(ctx, [[px + k * 4, py], [px + k * 4 + (k - 2) * 4, py - 14 - R() * 12]], 2, P.weed, .3); }
    ctx.save(); ctx.globalAlpha = .28; for (let k = 0; k < 2; k++) { ctx.strokeStyle = P.groundDk; ctx.lineWidth = 16; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(x + w * .55 + k * 46, y + h); ctx.quadraticCurveTo(x + w * .7 + k * 40, hz + (y + h - hz) * .5, x + w + 40, hz + 70 + k * 18); ctx.stroke(); } ctx.restore();
    // havada toz
    const dn = Math.round((o.dust == null ? .4 : o.dust) * 40);
    for (let i = 0; i < dn; i++) { ctx.fillStyle = `rgba(216,202,176,${.25 + R() * .35})`; ctx.beginPath(); ctx.arc(x + R() * w, hz - 80 + R() * 260, 1.5 + R() * 3.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* ================= ALTYAZI =================
     opts: text, x (orta), y (ilk satır taban), size, maxW, hi (sarı vurgulanacak kelimeler) */
  function drawSubtitle(ctx, o) {
    const P = PAL, size = o.size || 68, maxW = o.maxW || 860, hi = (o.hi || []).map((s) => s.toLowerCase());
    ctx.save(); ctx.font = `400 ${size}px "Lilita One"`; ctx.textBaseline = 'alphabetic';
    const words = o.text.split(' '), lines = [[]]; let cur = 0; const sp = ctx.measureText(' ').width;
    words.forEach((wd) => { const ww = ctx.measureText(wd).width; if (cur + ww > maxW && lines[lines.length - 1].length) { lines.push([]); cur = 0; } lines[lines.length - 1].push(wd); cur += ww + sp; });
    lines.forEach((ln, li) => {
      const tw = ln.reduce((a, wd) => a + ctx.measureText(wd).width, 0) + sp * (ln.length - 1);
      let px = (o.x || 540) - tw / 2; const py = (o.y || 1300) + li * size * 1.12;
      ln.forEach((wd) => {
        const isHi = hi.includes(wd.toLowerCase().replace(/[^a-z]/g, '')) || hi.includes(wd.toLowerCase());
        ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink;
        ctx.lineWidth = size * .2; ctx.strokeText(wd, px, py + size * .07); // alt gölge
        ctx.strokeText(wd, px, py);
        ctx.fillStyle = isHi ? P.hazard : P.paper; ctx.fillText(wd, px, py);
        px += ctx.measureText(wd).width + sp;
      });
    });
    ctx.restore();
  }

  G.Cizim = { PAL, seed, wobble, ell, pathOf, ink, shape, line, blot, grain, hazardStripes, drawKaan, drawDaisy, drawBackground, drawSubtitle };
})(typeof window !== 'undefined' ? window : globalThis);
