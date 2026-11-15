/* Two Beeps — ortak çizim kitaplığı (Canvas 2D, dış istek yok).
   Kullanım: <script src="cizim.js"></script> sonra window.Cizim.drawKaan(ctx, {...}) vb.
   Kurallar docs/STIL.md içinde. Bütün şekiller tohumlu (seed) "el titremesi" ile çizilir:
   aynı seed = aynı çizgi. Seed'i bir karakter/sahne için sabit tut (kare kare değiştirme: titreme yapar). */
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
     phone (bool, oyun ekranı açık telefon), flip, seed, blink (0..1).
     EK (2–10): expr ayrıca 'surprised'|'sheepish'|'determined'|'tired'|'smile' (ve ortak EXPR listesi);
     pose 'stand' (varsayılan) | 'sit' (hands 'phone'|'knees', seat, glow) | 'side' (profil, step -1..1) | 'back'. */
  function drawKaan(ctx, o) {
    o = o || {}; const s = o.s || 1, P = PAL, lw = lineW(o, s);
    if (o.pose && o.pose !== 'stand') return drawKaanPose(ctx, o);
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
    shape(ctx, [[-42, -240], [-6, -240], [-14, -44], [-42, -44]], P.pantsDk, { lw });
    shape(ctx, [[4, -240], [40, -240], [46, -44], [14, -44]], P.pants, { lw, shade: shadeR([[30, -250], [50, -250], [50, -40], [36, -40]]) });
    shape(ctx, [[-45, -62], [-12, -62], [-12, -44], [-44, -44]], P.pants, { lw: lw * .8 });
    shape(ctx, [[12, -62], [47, -62], [47, -44], [13, -44]], P.pantsDk, { lw: lw * .8 });
    // botlar (iri: siluet işareti)
    shape(ctx, [[-50, -48], [-8, -48], [-4, -16], [-2, 0], [-66, 0], [-62, -20]], P.bootDk, { lw });
    shape(ctx, [[10, -48], [50, -48], [56, -24], [82, -12], [84, 0], [8, 0]], P.boot, { lw, shade: (c) => blot(c, [[8, -10], [90, -10], [90, 4], [8, 4]], P.bootDk, .9) });
    line(ctx, [[60, -27], [64, -18]], lw * .6);
    // gövde: bol, kutu gibi iş ceketi
    shape(ctx, [[-68, -398], [64, -398], [80, -310], [84, -228], [-80, -224], [-76, -310]], P.jacket, {
      lw, shade: (c) => { blot(c, [[38, -400], [100, -400], [100, -220], [50, -220], [56, -310]], '#0b1f2a', .3); blot(c, [[-90, -246], [100, -250], [100, -210], [-90, -210]], '#0b1f2a', .25); }
    });
    line(ctx, [[4, -392], [6, -310], [6, -228]], lw * .55);
    line(ctx, [[-56, -300], [-24, -302]], lw * .55); line(ctx, [[-56, -300], [-54, -270], [-26, -272], [-24, -302]], lw * .45);
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
    shape(ctx, [[-12, -526], [-6, -552], [8, -572], [30, -580], [46, -570], [44, -556], [36, -548], [38, -562], [26, -562], [14, -550], [12, -530]], P.hair, { lw });
    // YÜZ: iki nokta göz, iki kaş, tek ağız. Başka parça yok.
    const ex = o.expr || 'calm', lk = (o.look || 0) * 4, bl = o.blink || 0;
    const eyeY = -468;
    if (ex !== 'calm' && ex !== 'worried') { face(ctx, ex, { L: [-10, eyeY], R: [24, eyeY], m: [12, -441], lw, look: o.look, blink: bl }); line(ctx, [[14, -464], [19, -454], [13, -451]], lw * .45, P.skinDk, .2); ctx.restore(); return; }
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
      ctx.save(); ctx.translate(96, -150); ctx.rotate(-.03); ctx.font = '400 40px "Lilita One"'; ctx.textAlign = 'center';
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

    // ön tekerlerin önden görünen kısmı (kabin havada durmasın)
    [-1, 1].forEach((d) => shape(ctx, [[d * 88 - 26, -74], [d * 88 + 26, -74], [d * 88 + 24, -2], [d * 88 - 24, -2]], P.tire, { lw }));
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
    const lines = [[]]; let cur = 0; const sp = ctx.measureText(' ').width;
    o.text.split('\n').forEach((para, pi) => { if (pi) { lines.push([]); cur = 0; } para.split(' ').forEach((wd) => { const ww = ctx.measureText(wd).width; if (cur + ww > maxW && lines[lines.length - 1].length) { lines.push([]); cur = 0; } lines[lines.length - 1].push(wd); cur += ww + sp; }); });
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


  /* =====================================================================
     2–10. BÖLÜM EKLERİ. Aşağıdakiler pilottaki fonksiyonlara dokunmaz.
     Ortak kurallar: (x,y) = ayak ortası / alanın sol üstü; s = ölçek; seed sabit tutulur.
     ===================================================================== */
  const hrand = (n) => { let s = (Math.imul(n | 0, 2654435761) >>> 0) || 7; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  Object.assign(PAL, {
    // Defne
    vest: '#2c3a5e', vestDk: '#1d2742', shirt: '#efe6d6', shirtDk: '#cfc3ad', khaki: '#8a7a62', khakiDk: '#6b5d48',
    dSkin: '#d9a27a', dSkinDk: '#b57e58', dHair: '#4a2418', helmet: '#f3efe6', helmetDk: '#cfc8b8', pencil: '#5b8a5a',
    // Mr. Hale
    suit: '#e3d8bf', suitDk: '#bfb194', tie: '#7a2a1d', hSkin: '#e2b48e', hSkinDk: '#bd8c68', gray: '#b9b4ab', grayDk: '#8e897f', hat: '#d8ccb0', hatBand: '#3a2c24', shoeDk: '#3a2416',
    gold: '#d9a93a', goldDk: '#9c7420', box: '#c9a26b', boxDk: '#a07c48',
    // kâğıt / mürekkep
    page: '#eadfc2', pageDk: '#d9caa5', inkOld: '#3a3026', inkBlue: '#1f4fe0', coffee: '#7a4a24',
    // mekân
    wallOffice: '#5d6b66', wallOfficeDk: '#46514d', floorWood: '#7a5130', hall: '#cfd3c9', hallDk: '#a9aea3',
    glassT: '#8fb6cf', glassTDk: '#5d8199', concreteDk: '#8f846f', rain: 'rgba(200,215,235,.55)'
  });
  const P2 = PAL;

  // kalınlığı değişen boru (kol/bacak): noktalar + uçlardaki genişlikler
  function tube(ctx, pts, w0, w1, fill, lw, o) {
    const n = pts.length, L = [], Rr = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * i / (n - 1)) / 2;
      L.push([pts[i][0] - dy / l * w, pts[i][1] + dx / l * w]); Rr.push([pts[i][0] + dy / l * w, pts[i][1] - dx / l * w]);
    }
    return shape(ctx, L.concat(Rr.reverse()), fill, Object.assign({ lw }, o || {}));
  }
  const hand = (ctx, x, y, r, fill, lw) => shape(ctx, ell(x, y, r, r * 1.08, 16), fill, { lw });

  /* ---------- ortak yüz dili: iki göz, iki kaş, tek ağız (+ en çok bir ek) ----------
     f: { L:[x,y], R:[x,y], m:[x,y], k (özellik ölçeği), lw, look, blink, brow (kaş kalınlık çarpanı), browCol } */
  const EXPR = {
    calm: [-20, -19, 'smile1', 'dot'], smile: [-24, -21, 'smileBig', 'happy'], serious: [-15, -20, 'flat', 'dot'],
    worried: [-27, -17, 'wavy', 'small'], pale: [-25, -18, 'flatSmall', 'small'], surprised: [-31, -29, 'o', 'big'],
    sheepish: [-25, -19, 'side', 'dot'], determined: [-13, -23, 'firm', 'narrow'], tired: [-20, -15, 'down', 'half'],
    confident: [-18, -21, 'smirk', 'dot'], frozen: [-28, -28, 'open', 'pin'], regret: [-26, -14, 'down', 'half']
  };
  function face(ctx, ex, f) {
    const E = EXPR[ex] || EXPR.calm, k = f.k || 1, lw = f.lw, lk = (f.look || 0) * 4 * k;
    [f.L, f.R].forEach(([x, y], i) => {
      const dir = i === 0 ? 1 : -1;
      // göz
      ctx.fillStyle = P2.ink;
      if (f.blink > .5 && E[3] !== 'happy') line(ctx, [[x - 6 * k, y], [x + 6 * k, y + 1]], lw * .7);
      else if (E[3] === 'happy') line(ctx, [[x - 7 * k, y + 2 * k], [x, y - 5 * k], [x + 7 * k, y + 2 * k]], lw * .75, null, .2);
      else {
        const sz = { dot: [5.6, 6.6], small: [4.4, 6], big: [7, 8.6], narrow: [5.6, 6.2], half: [5.6, 6.6], pin: [3, 3.4] }[E[3]];
        ctx.beginPath(); ctx.ellipse(x + lk, y, sz[0] * k, sz[1] * k, 0, 0, TAU); ctx.fill();
        if (E[3] !== 'pin') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + lk + 1.6 * k, y - 2.2 * k, 1.5 * k, 0, TAU); ctx.fill(); }
        if (E[3] === 'half' || E[3] === 'narrow') {
          ctx.fillStyle = f.skin || P2.skin; const top = E[3] === 'half' ? y : y - 3 * k;
          ctx.fillRect(x + lk - 8 * k, top - 10 * k, 16 * k, 10 * k);
          line(ctx, [[x - 8 * k, top + (E[3] === 'half' ? 1 : 0) * k], [x + 8 * k, top]], lw * .6, null, .2);
        }
        if (E[3] === 'half') line(ctx, [[x - 6 * k, y + 11 * k], [x, y + 13 * k], [x + 6 * k, y + 11 * k]], lw * .35, f.skinDk || P2.skinDk, .2);
      }
      // kaş
      let inner = E[0], outer = E[1];
      if (ex === 'confident' && i === 1) { inner -= 5; outer -= 7; }
      ctx.save(); if (f.browCol) ctx.globalAlpha = 1;
      line(ctx, [[x - dir * 12 * k, y + outer * k], [x - dir * 1 * k, y + (inner + outer) / 2 * k - 2 * k], [x + dir * 9 * k, y + inner * k]], lw * .8 * (f.brow || 1), f.browCol, .3);
      ctx.restore();
    });
    // ağız
    const [mx, my] = f.m, w = 12 * k, ml = lw * .65;
    switch (E[2]) {
      case 'smile1': line(ctx, [[mx - w, my + 1 * k], [mx, my], [mx + w * .8, my - 4 * k], [mx + w * 1.2, my - 9 * k]], ml, null, .3); break;
      case 'smileBig': line(ctx, ell(mx, my - 6 * k, w * 1.15, 10 * k, 8, .15, Math.PI - .15), ml, null, .3); break;
      case 'flat': line(ctx, [[mx - w * .9, my], [mx + w * .9, my]], ml, null, .3); break;
      case 'flatSmall': line(ctx, [[mx - w * .5, my], [mx + w * .5, my + 1]], ml, null, .2); break;
      case 'wavy': line(ctx, [[mx - w, my], [mx - w / 2, my - 4 * k], [mx, my], [mx + w / 2, my - 4 * k], [mx + w, my]], ml, null, .3); break;
      case 'o': ctx.fillStyle = P2.ink; ctx.beginPath(); ctx.ellipse(mx, my, 5 * k, 7 * k, 0, 0, TAU); ctx.fill(); break;
      case 'side': line(ctx, [[mx, my], [mx + w * .7, my - 1 * k], [mx + w * 1.2, my - 5 * k]], ml, null, .2); break;
      case 'firm': line(ctx, [[mx - w, my + 3 * k], [mx - w * .7, my], [mx + w * .7, my], [mx + w, my + 3 * k]], ml, null, .2); break;
      case 'down': line(ctx, ell(mx, my + 7 * k, w * .9, 7 * k, 6, Math.PI + .3, TAU - .3), ml, null, .2); break;
      case 'smirk': line(ctx, [[mx - w, my], [mx + w * .4, my], [mx + w, my - 6 * k]], ml, null, .2); break;
      case 'open': shape(ctx, ell(mx, my, w * .7, 4 * k, 12), P2.ink, { lw: 0, amp: .3 }); break;
    }
    if (ex === 'sheepish') for (let i = 0; i < 3; i++) line(ctx, [[f.R[0] + (4 + i * 5) * k, f.R[1] + 12 * k], [f.R[0] + (1 + i * 5) * k, f.R[1] + 18 * k]], lw * .4, '#c0563a', .1);
    if (ex === 'surprised' || ex === 'frozen') { /* ek parça yok: ifade kaşta */ }
  }

  /* ================= KAAN: ek pozlar ('sit' | 'side' | 'back') ================= */
  function kaanHead(ctx, o, lw, view) {
    const P = P2;
    if (view === 'back') {
      shape(ctx, ell(-42, -470, 9, 13, 14), P.skinDk, { lw }); shape(ctx, ell(46, -470, 9, 13, 14), P.skinDk, { lw });
      shape(ctx, ell(2, -476, 46, 56, 30), P.hair, { lw, shade: (c) => blot(c, [[20, -540], [60, -540], [60, -410], [24, -420]], '#000', .25) });
      line(ctx, [[-30, -440], [-10, -430], [10, -432], [30, -440]], lw * .5, P.skinDk, .4);
    } else {
      shape(ctx, ell(-38, -470, 9, 13, 14), P.skinDk, { lw });
      const hp = []; for (let i = 0; i < 34; i++) { const a = i / 34 * TAU, ry = Math.sin(a) > 0 ? 56 : 52, rx = Math.sin(a) > 0 ? 42 - Math.sin(a) * 4 : 45; hp.push([4 + Math.cos(a) * rx, -472 + Math.sin(a) * ry]); }
      shape(ctx, hp, P.skin, { lw, shade: (c) => blot(c, [[30, -540], [70, -540], [70, -400], [26, -410], [40, -470]], P.skinDk, .55) });
      shape(ctx, [[-44, -470], [-46, -505], [-30, -526], [-4, -534], [28, -530], [46, -512], [50, -486], [40, -490], [34, -500], [26, -490], [16, -502], [6, -492], [-6, -504], [-16, -492], [-26, -500], [-34, -478]], P.hair, { lw });
    }
    shape(ctx, [[-12, -526], [-6, -552], [8, -572], [30, -580], [46, -570], [44, -556], [36, -548], [38, -562], [26, -562], [14, -550], [12, -530]], P.hair, { lw });
    if (view !== 'back') {
      face(ctx, o.expr || 'calm', { L: [-10, -468], R: [24, -468], m: [12, -441], lw, look: o.look, blink: o.blink });
      line(ctx, [[14, -464], [19, -454], [13, -451]], lw * .45, P.skinDk, .2);
      if ((o.expr || '') === 'worried') shape(ctx, [[48, -500], [54, -486], [52, -478], [44, -478], [43, -486]], '#cfe6f2', { lw: lw * .55, amp: .3 });
    }
  }
  function kaanTorso(ctx, lw, back) {
    const P = P2;
    if (!back) shape(ctx, ell(-2, -398, 52, 22, 22), P.jacketDk, { lw });
    shape(ctx, [[-68, -398], [64, -398], [80, -310], [84, -228], [-80, -224], [-76, -310]], P.jacket, {
      lw, shade: (c) => { blot(c, [[38, -400], [100, -400], [100, -220], [50, -220], [56, -310]], '#0b1f2a', .3); blot(c, [[-90, -246], [100, -250], [100, -210], [-90, -210]], '#0b1f2a', .25); }
    });
    if (back) { shape(ctx, [[-50, -404], [46, -404], [40, -350], [0, -336], [-44, -350]], P.jacketDk, { lw }); line(ctx, [[-2, -336], [0, -232]], lw * .45, '#0b1f2a'); return; }
    line(ctx, [[4, -392], [6, -310], [6, -228]], lw * .55);
    shape(ctx, [[-30, -402], [4, -366], [-18, -360], [-44, -392]], P.jacketDk, { lw: lw * .8 });
    shape(ctx, [[34, -402], [6, -366], [26, -360], [48, -392]], P.jacketDk, { lw: lw * .8 });
    shape(ctx, [[-14, -424], [16, -424], [18, -394], [-14, -392]], P.skin, { lw, shade: (c) => blot(c, [[-20, -430], [24, -430], [24, -408], [-20, -414]], P.skinDk, 1) });
  }
  function cuff(ctx, a, b, lw) { // sarı reflektör bileklik (Kaan imzası)
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy * 14, ny = ux * 14;
    const c0 = [b[0] - ux * 20, b[1] - uy * 20], c1 = [b[0] - ux * 6, b[1] - uy * 6];
    shape(ctx, [[c0[0] + nx, c0[1] + ny], [c1[0] + nx, c1[1] + ny], [c1[0] - nx, c1[1] - ny], [c0[0] - nx, c0[1] - ny]], P2.hazard, { lw: lw * .7 });
  }
  function phoneInHands(ctx, x, y, lw, rot, glowA) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    if (glowA) { const g = ctx.createRadialGradient(0, -10, 4, 0, -10, 140); g.addColorStop(0, `rgba(255,226,122,${glowA})`); g.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g; ctx.fillRect(-150, -160, 300, 300); }
    shape(ctx, [[-18, -34], [18, -34], [18, 26], [-18, 26]], P2.steelDk, { lw: lw * .8 });
    const scr = shape(ctx, [[-13, -28], [13, -28], [13, 20], [-13, 20]], P2.screen, { lw: 0, amp: .4 });
    ctx.save(); ctx.clip(scr); ctx.fillStyle = P2.brick; ctx.fillRect(-5, -16, 10, 34); ctx.fillStyle = P2.ink; for (let i = -2; i < 3; i++) ctx.fillRect(-13 + i * 10, 14, 5, 6); ctx.restore();
    ctx.restore();
  }
  function drawKaanPose(ctx, o) {
    const s = o.s || 1, P = P2, lw = lineW(o, s), pose = o.pose;
    seed((o.seed || 11) + 300); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -s : s, s);
    if (pose === 'sit') {
      const sh = 104; // üst gövde bu kadar iner
      if (o.seat !== false) { shape(ctx, [[-96, -150], [96, -150], [96, -126], [-96, -126]], P.steelDk, { lw }); line(ctx, [[-80, -126], [-80, 0]], lw * 1.4); line(ctx, [[80, -126], [80, 0]], lw * 1.4); }
      // bacaklar: kısalmış uyluk + dikey baldır + iri botlar
      shape(ctx, [[-46, -150], [-4, -150], [-8, -112], [-52, -110]], P.pantsDk, { lw });
      shape(ctx, [[2, -150], [46, -150], [54, -108], [8, -110]], P.pants, { lw });
      shape(ctx, [[-52, -122], [-12, -122], [-14, -44], [-46, -44]], P.pantsDk, { lw });
      shape(ctx, [[10, -122], [52, -122], [50, -44], [16, -44]], P.pants, { lw, shade: (c) => blot(c, [[34, -130], [60, -130], [60, -40], [40, -40]], '#0b1f2a', .28) });
      shape(ctx, [[-54, -48], [-10, -48], [-6, -16], [-4, 0], [-70, 0], [-66, -20]], P.bootDk, { lw });
      shape(ctx, [[12, -48], [52, -48], [58, -24], [84, -12], [86, 0], [10, 0]], P.boot, { lw });
      ctx.save(); ctx.translate(0, sh);
      tube(ctx, [[-62, -392], [-92, -320], [-60, -262]], 44, 34, P.jacketDk, lw);
      kaanTorso(ctx, lw);
      if (o.hands === 'knees') {
        tube(ctx, [[56, -392], [88, -320], [60, -262]], 44, 34, P.jacket, lw);
        ctx.restore(); hand(ctx, -42, -150, 15, P.skinDk, lw); hand(ctx, 44, -152, 15, P.skin, lw); ctx.save(); ctx.translate(0, sh);
      } else {
        tube(ctx, [[56, -392], [86, -320], [30, -276]], 44, 34, P.jacket, lw);
        cuff(ctx, [86, -320], [30, -276], lw); cuff(ctx, [-92, -320], [-60, -262], lw);
        phoneInHands(ctx, -6, -286, lw, -.1, o.glow || 0);
        hand(ctx, -26, -268, 14, P.skinDk, lw); hand(ctx, 18, -270, 14, P.skin, lw);
      }
      kaanHead(ctx, o, lw, 'front');
      ctx.restore();
    } else if (pose === 'back') {
      ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(0, 2, 92, 13, 0, 0, TAU); ctx.fill(); ctx.restore();
      shape(ctx, [[-42, -240], [-4, -240], [-12, -44], [-42, -44]], P.pants, { lw }); shape(ctx, [[4, -240], [42, -240], [44, -44], [12, -44]], P.pantsDk, { lw });
      shape(ctx, [[-52, -50], [-8, -50], [-6, 0], [-56, 0]], P.bootDk, { lw }); shape(ctx, [[8, -50], [50, -50], [54, 0], [6, 0]], P.boot, { lw });
      tube(ctx, [[-62, -392], [-88, -320], [-94, -250]], 44, 34, P.jacket, lw); tube(ctx, [[60, -392], [86, -320], [92, -250]], 44, 34, P.jacketDk, lw);
      cuff(ctx, [-88, -320], [-94, -250], lw); cuff(ctx, [86, -320], [92, -250], lw);
      hand(ctx, -94, -238, 14, P.skinDk, lw); hand(ctx, 92, -238, 14, P.skinDk, lw);
      kaanTorso(ctx, lw, true);
      shape(ctx, [[-14, -424], [16, -424], [18, -398], [-14, -398]], P.skinDk, { lw });
      kaanHead(ctx, o, lw, 'back');
    } else { // 'side': profil, sağa bakar
      ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(8, 2, 80, 12, 0, 0, TAU); ctx.fill(); ctx.restore();
      const st = o.step || 0; // -1..1 adım
      shape(ctx, [[-20, -240], [14, -240], [6 - st * 30, -44], [-24 - st * 30, -44]], P.pantsDk, { lw });
      shape(ctx, [[-36 - st * 30, -48], [6 - st * 30, -48], [24 - st * 30, -10], [26 - st * 30, 0], [-38 - st * 30, 0]], P.bootDk, { lw });
      tube(ctx, [[-10, -386], [-14 - st * 18, -312], [-6 - st * 34, -248]], 40, 30, P.jacketDk, lw);
      shape(ctx, [[-22, -240], [16, -240], [12 + st * 30, -44], [-18 + st * 30, -44]], P.pants, { lw });
      shape(ctx, [[-30 + st * 30, -48], [12 + st * 30, -48], [34 + st * 30, -14], [40 + st * 30, 0], [-32 + st * 30, 0]], P.boot, { lw });
      shape(ctx, ell(-34, -398, 26, 30, 18), P.jacketDk, { lw }); // kapüşon
      shape(ctx, [[-44, -398], [34, -398], [46, -310], [50, -228], [-48, -226], [-52, -310]], P.jacket, { lw, shade: (c) => blot(c, [[-60, -248], [60, -250], [60, -210], [-60, -210]], '#0b1f2a', .25) });
      shape(ctx, [[-4, -424], [22, -424], [22, -396], [-6, -396]], P.skin, { lw });
      // profil kafa
      const hp = [[-38, -500], [-20, -526], [12, -528], [40, -510], [50, -486], [52, -474], [62, -462], [52, -454], [52, -440], [44, -426], [20, -418], [-6, -426], [-30, -444], [-42, -472]];
      shape(ctx, hp, P.skin, { lw });
      shape(ctx, [[-44, -470], [-44, -504], [-24, -530], [12, -536], [40, -518], [44, -496], [30, -504], [18, -494], [8, -506], [-6, -496], [-16, -470], [-28, -458]], P.hair, { lw });
      shape(ctx, [[-14, -528], [-8, -554], [6, -574], [28, -582], [44, -572], [42, -558], [34, -550], [36, -564], [24, -564], [12, -552], [10, -530]], P.hair, { lw });
      shape(ctx, ell(-8, -466, 8, 12, 12), P.skinDk, { lw: lw * .8 });
      const ex = EXPR[o.expr || 'calm'] || EXPR.calm;
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(34, -470, ex[3] === 'big' ? 5.5 : 4.4, ex[3] === 'big' ? 7 : 6, 0, 0, TAU); ctx.fill();
      line(ctx, [[26, -470 + ex[1] + 2], [42, -470 + ex[0] + 2]], lw * .8);
      line(ctx, [[38, -440], [48, -441 + (ex[2].startsWith('smile') ? -3 : ex[2] === 'down' ? 3 : 0)]], lw * .6, null, .2);
      tube(ctx, [[2, -386], [8 + st * 18, -312], [16 + st * 30, -248]], 40, 30, P.jacket, lw);
      cuff(ctx, [8 + st * 18, -312], [16 + st * 30, -248], lw);
      hand(ctx, 18 + st * 32, -238, 14, P.skin, lw);
    }
    ctx.restore();
  }

  /* ================= DEFNE =================
     Kaan'ın ablası, mühendis. Kaan'dan kısa (≈ 0.9), dik duruş, yüksek topuz + kalem, yuvarlak gözlük, lacivert yelek, açık renk pantolon. Sarı yok.
     opts: x,y,s, expr 'calm'|'serious'|'worried'|'pale'|'smile' (ve ortak ifadeler), pose 'stand'|'sit'|'cross',
     item 'coffee'|'helmet'|'roll'|null, seat (oturuşta tabure, varsayılan true), look, blink, flip, seed. */
  function defneHead(ctx, o, lw) {
    const P = P2, pale = o.expr === 'pale';
    const skin = pale ? '#e6c9ae' : P.dSkin, skinDk = pale ? '#c9a68a' : P.dSkinDk;
    shape(ctx, [[-40, -500], [-46, -440], [-36, -414], [40, -414], [46, -440], [42, -500]], P.dHair, { lw }); // ense saçı
    shape(ctx, [[-12, -424], [14, -424], [14, -396], [-12, -396]], skinDk, { lw });
    const hp = []; for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; hp.push([2 + Math.cos(a) * (Math.sin(a) > 0 ? 38 - Math.sin(a) * 6 : 40), -468 + Math.sin(a) * (Math.sin(a) > 0 ? 50 : 46)]); }
    shape(ctx, hp, skin, { lw, shade: (c) => blot(c, [[26, -530], [60, -530], [60, -410], [22, -420], [34, -470]], skinDk, .5) });
    // topuz (yuvarlak siluet) + kalem
    line(ctx, [[-30, -548], [8, -566]], lw * 1.6, P.ink, .2); line(ctx, [[-30, -548], [8, -566]], lw * .8, P.pencil, .2);
    shape(ctx, ell(-6, -540, 24, 21, 20), P.dHair, { lw, shade: (c) => blot(c, ell(4, -532, 18, 14, 12), '#2a120a', .4) });
    // saç kapağı: yandan ayrık, düz
    shape(ctx, [[-42, -462], [-42, -494], [-28, -514], [0, -520], [30, -514], [44, -494], [44, -466], [34, -486], [14, -500], [-8, -498], [-26, -490], [-34, -476]], P.dHair, { lw });
    face(ctx, o.expr || 'calm', { L: [-12, -466], R: [18, -466], m: [4, -438], k: .92, lw, look: o.look, blink: o.blink, skin, skinDk });
    // yuvarlak gözlük (Defne imzası)
    ctx.save(); ctx.strokeStyle = P.ink; ctx.lineWidth = lw * .5;
    [[-12, -466], [18, -466]].forEach(([x, y]) => ctx.stroke(pathOf(wobble(ell(x, y, 12, 11, 18), true, .4), true)));
    ctx.beginPath(); ctx.moveTo(0, -468); ctx.lineTo(6, -468); ctx.moveTo(-24, -468); ctx.lineTo(-38, -472); ctx.stroke(); ctx.restore();
    line(ctx, [[6, -456], [9, -448], [4, -446]], lw * .4, skinDk, .2);
  }
  function defneTorso(ctx, lw) {
    const P = P2;
    shape(ctx, [[-52, -398], [52, -398], [48, -300], [44, -240], [-44, -240], [-48, -300]], P.shirt, { lw, shade: (c) => blot(c, [[20, -400], [60, -400], [60, -230], [24, -230]], P.shirtDk, .7) });
    shape(ctx, [[-54, -398], [-12, -398], [-6, -300], [-8, -234], [-48, -234], [-52, -300]], P.vest, { lw });
    shape(ctx, [[12, -398], [54, -398], [52, -300], [48, -234], [8, -234], [6, -300]], P.vest, { lw, shade: (c) => blot(c, [[30, -400], [60, -400], [60, -230], [34, -230]], P.vestDk, .6) });
    shape(ctx, [[18, -350], [40, -351], [40, -322], [18, -321]], P.paper, { lw: lw * .55 }); // kimlik kartı
    line(ctx, [[-40, -330], [-40, -346]], lw * .6, P.inkBlue, .1); // cepte kalem
    line(ctx, [[-50, -320], [-22, -320]], lw * .45);
  }
  function drawDefne(ctx, o) {
    o = o || {}; const s = (o.s || 1) * .9, P = P2, lw = lineW(o, s), pose = o.pose || 'stand', item = o.item;
    seed(o.seed || 31); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -s : s, s);
    const sitting = pose === 'sit', sh = sitting ? 104 : 0;
    if (!sitting) { ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 70, 11, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    if (sitting) {
      if (o.seat !== false) { shape(ctx, [[-80, -150], [80, -150], [80, -128], [-80, -128]], P.wood, { lw }); line(ctx, [[-66, -128], [-66, 0]], lw * 1.3); line(ctx, [[66, -128], [66, 0]], lw * 1.3); }
      shape(ctx, [[-40, -150], [-2, -150], [-6, -114], [-44, -112]], P.khakiDk, { lw }); shape(ctx, [[2, -150], [40, -150], [44, -112], [6, -114]], P.khaki, { lw });
      shape(ctx, [[-42, -122], [-8, -122], [-10, -26], [-38, -26]], P.khakiDk, { lw }); shape(ctx, [[8, -122], [42, -122], [40, -26], [12, -26]], P.khaki, { lw });
    } else {
      shape(ctx, [[-40, -250], [-2, -250], [-6, -26], [-38, -26]], P.khakiDk, { lw });
      shape(ctx, [[2, -250], [40, -250], [42, -26], [8, -26]], P.khaki, { lw, shade: (c) => blot(c, [[24, -260], [44, -260], [44, -20], [28, -20]], P.khakiDk, .5) });
    }
    shape(ctx, [[-44, -28], [-4, -28], [-2, 0], [-50, 0]], P.pants, { lw }); shape(ctx, [[6, -28], [42, -28], [60, -10], [60, 0], [4, 0]], P.pants, { lw });
    line(ctx, [[-48, -4], [-2, -4]], lw * .5, P.paper, .2); line(ctx, [[6, -4], [58, -4]], lw * .5, P.paper, .2);
    ctx.save(); ctx.translate(0, sh);
    const sleeve = (pts) => { const [a0, b0, c0] = pts, m = [b0[0] + (c0[0] - b0[0]) * .3, b0[1] + (c0[1] - b0[1]) * .3]; tube(ctx, [m, c0], 30, 26, P.dSkin, lw); tube(ctx, [a0, b0, m], 40, 36, P.shirt, lw); };
    // arka kol
    if (pose === 'cross') sleeve([[-54, -392], [-70, -310], [-70, -306]]);
    else if (sitting) sleeve([[-54, -392], [-68, -312], [-24, -282]]);
    else sleeve([[-54, -392], [-66, -316], [-68, -254]]);
    if (item === 'helmet' && pose === 'stand') { // baret koltuk altında (arka kol tarafı)
      shape(ctx, [[-110, -300], [-112, -332], [-96, -360], [-62, -366], [-36, -350], [-30, -310], [-24, -298], [-118, -294]], P.helmet, { lw, shade: (c) => blot(c, [[-70, -370], [-20, -370], [-20, -290], [-60, -296]], P.helmetDk, .7) });
      line(ctx, [[-96, -362], [-80, -300]], lw * .5, P.helmetDk, .2);
    }
    defneTorso(ctx, lw);
    if (pose === 'cross') {
      sleeve([[54, -392], [70, -310], [70, -306]]);
      tube(ctx, [[-70, -310], [24, -330]], 26, 24, P.dSkin, lw); hand(ctx, 30, -330, 12, P.dSkin, lw);
      tube(ctx, [[70, -306], [-24, -318]], 30, 26, P.shirt, lw); hand(ctx, -30, -318, 12, P.dSkin, lw);
    } else if (sitting) {
      sleeve([[54, -392], [68, -312], [24, -284]]);
      if (item === 'coffee') coffeeCup(ctx, 0, -300, lw, 1.4);
      hand(ctx, -22, -280, 12, P.dSkin, lw); hand(ctx, 22, -282, 12, P.dSkin, lw);
    } else {
      if (item === 'coffee') sleeve([[54, -392], [72, -320], [44, -290]]); else sleeve([[54, -392], [66, -316], [70, -254]]);
      if (item === 'coffee') coffeeCup(ctx, 40, -306, lw, 1.5);
      if (item === 'roll') { ctx.save(); ctx.translate(72, -250); ctx.rotate(-.5); shape(ctx, [[-90, -11], [70, -11], [70, 11], [-90, 11]], P.page, { lw }); shape(ctx, ell(70, 0, 6, 11, 10), P.pageDk, { lw: lw * .7 }); ctx.restore(); }
      hand(ctx, -68, -244, 13, P.dSkin, lw); if (item === 'coffee') hand(ctx, 52, -296, 13, P.dSkin, lw); else hand(ctx, 70, -244, 13, P.dSkin, lw);
    }
    defneHead(ctx, o, lw);
    ctx.restore(); ctx.restore();
  }
  function coffeeCup(ctx, x, y, lw, k) {
    k = k || 1; ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    shape(ctx, [[-14, -22], [14, -22], [11, 20], [-11, 20]], P2.paper, { lw });
    shape(ctx, [[-13, -6], [13, -6], [12, 8], [-12, 8]], P2.coffee, { lw: lw * .6 });
    shape(ctx, [[-16, -28], [16, -28], [15, -21], [-15, -21]], P2.paperDk, { lw: lw * .8 });
    ctx.restore();
  }

  /* ================= MR. HALE =================
     Yaşlıca müteahhit: iri, fıçı gövde, krem takım, koyu kırmızı kravat, kenarlı şapka, gri bıyık ve kalın kaş. Kaan'dan uzun ve çok daha geniş.
     opts: expr 'confident'|'frozen'|'regret' (ve ortak ifadeler), pose 'stand'|'sit'|'carry', hat true|false|'hand' (9. bölüm: elde),
     phone (oturuşta elinde telefon), seat, look, blink, flip, seed. */
  function haleHat(ctx, lw) {
    const P = P2;
    shape(ctx, ell(2, -514, 76, 13, 26), P.hat, { lw, shade: (c) => blot(c, ell(30, -508, 50, 8, 12), P.suitDk, .6) });
    shape(ctx, [[-44, -516], [-40, -566], [-14, -578], [0, -570], [16, -578], [42, -566], [46, -516]], P.hat, { lw, shade: (c) => blot(c, [[20, -590], [60, -590], [60, -510], [26, -510]], P.suitDk, .55) });
    shape(ctx, [[-45, -534], [46, -534], [46, -518], [-45, -518]], P.hatBand, { lw: lw * .8 });
  }
  function haleHead(ctx, o, lw) {
    const P = P2, hat = o.hat == null ? true : o.hat;
    shape(ctx, ell(-44, -466, 10, 14, 14), P.hSkinDk, { lw });
    const hp = []; for (let i = 0; i < 34; i++) { const a = i / 34 * TAU; hp.push([2 + Math.cos(a) * (Math.sin(a) > 0 ? 50 - Math.sin(a) * 4 : 46), -466 + Math.sin(a) * (Math.sin(a) > 0 ? 50 : 50)]); }
    shape(ctx, hp, P.hSkin, { lw, shade: (c) => blot(c, [[30, -530], [70, -530], [70, -400], [28, -414], [40, -470]], P.hSkinDk, .5) });
    // yan gri saç (tepe kel)
    shape(ctx, [[-48, -470], [-46, -500], [-30, -508], [-36, -486], [-38, -460]], P.gray, { lw: lw * .8 });
    shape(ctx, [[48, -470], [46, -498], [32, -506], [38, -484], [40, -460]], P.gray, { lw: lw * .8 });
    if (!hat || hat === 'hand') { line(ctx, [[-14, -512], [0, -518], [16, -512]], lw * .4, P.grayDk, .3); line(ctx, [[-20, -500], [-4, -508]], lw * .35, P.hSkinDk, .3); }
    face(ctx, o.expr || 'confident', { L: [-14, -470], R: [20, -470], m: [4, -430], k: 1, lw, look: o.look, blink: o.blink, brow: 1.9, skin: P.hSkin, skinDk: P.hSkinDk });
    line(ctx, [[-30, -448], [-26, -440]], lw * .35, P.hSkinDk, .2); line(ctx, [[34, -448], [30, -440]], lw * .35, P.hSkinDk, .2); // yaş çizgileri
    shape(ctx, [[-22, -446], [-6, -452], [4, -448], [14, -452], [30, -446], [26, -436], [12, -440], [4, -437], [-4, -440], [-18, -436]], P.gray, { lw: lw * .8 }); // bıyık
    line(ctx, [[6, -462], [10, -454], [4, -452]], lw * .45, P.hSkinDk, .2);
    if (hat === true) haleHat(ctx, lw);
  }
  function haleTorso(ctx, lw) {
    const P = P2;
    shape(ctx, [[-86, -400], [86, -400], [98, -322], [100, -252], [88, -212], [-88, -212], [-100, -252], [-98, -322]], P.suit, {
      lw, shade: (c) => { blot(c, [[44, -410], [110, -410], [110, -200], [56, -200], [70, -320]], P.suitDk, .7); }
    });
    shape(ctx, [[-30, -404], [30, -404], [10, -320], [-10, -320]], P.shirt, { lw: lw * .8 });
    shape(ctx, [[-8, -398], [8, -398], [12, -340], [0, -322], [-12, -340]], P.tie, { lw: lw * .8 });
    shape(ctx, [[-32, -404], [-8, -330], [-26, -318], [-52, -394]], P.suit, { lw: lw * .8 });
    shape(ctx, [[32, -404], [8, -330], [26, -318], [52, -394]], P.suitDk, { lw: lw * .8 });
    line(ctx, [[0, -322], [0, -214]], lw * .5);
    [-290, -250].forEach((yy) => shape(ctx, ell(-8, yy, 5, 5, 8), P.suitDk, { lw: lw * .5 }));
    shape(ctx, [[-70, -364], [-42, -366], [-44, -350], [-58, -346], [-70, -352]], P.paper, { lw: lw * .55 }); // mendil
  }
  function drawHale(ctx, o) {
    o = o || {}; const s = (o.s || 1) * 1.04, P = P2, lw = lineW(o, s), pose = o.pose || 'stand';
    seed(o.seed || 41); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale(o.flip ? -s : s, s);
    const sitting = pose === 'sit', sh = sitting ? 96 : 0;
    if (!sitting) { ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 104, 14, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    if (sitting) {
      if (o.seat !== false) waitChair(ctx, 0, 0, lw, 1);
      shape(ctx, [[-56, -150], [-4, -150], [-8, -108], [-60, -108]], P.suitDk, { lw }); shape(ctx, [[4, -150], [56, -150], [62, -108], [8, -108]], P.suit, { lw });
      shape(ctx, [[-60, -118], [-14, -118], [-16, -24], [-54, -24]], P.suitDk, { lw }); shape(ctx, [[14, -118], [60, -118], [56, -24], [18, -24]], P.suit, { lw });
    } else {
      shape(ctx, [[-50, -224], [-6, -224], [-12, -24], [-46, -24]], P.suitDk, { lw });
      shape(ctx, [[6, -224], [50, -224], [46, -24], [12, -24]], P.suit, { lw, shade: (c) => blot(c, [[30, -230], [56, -230], [56, -20], [34, -20]], P.suitDk, .6) });
    }
    const fx = sitting ? 4 : 0;
    shape(ctx, [[-58 + fx, -28], [-10 + fx, -28], [-8 + fx, 0], [-64 + fx, 0], [-62 + fx, -12]], P.shoeDk, { lw });
    shape(ctx, [[8 - fx, -28], [52 - fx, -28], [74 - fx, -10], [74 - fx, 0], [6 - fx, 0]], P.shoeDk, { lw, shade: (c) => { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(40 - fx, -24, 16, 5); } });
    ctx.save(); ctx.translate(0, sh);
    const arm = (pts, fill) => tube(ctx, pts, 46, 38, fill, lw);
    if (pose === 'carry') {
      arm([[-80, -392], [-108, -320], [-84, -270]], P.suitDk);
      haleTorso(ctx, lw);
      arm([[80, -392], [108, -320], [84, -270]], P.suit);
      shape(ctx, [[-96, -346], [96, -350], [100, -220], [-100, -216]], P.box, { lw, shade: (c) => { blot(c, [[40, -360], [110, -360], [110, -200], [50, -200]], P.boxDk, .6); c.fillStyle = 'rgba(240,226,194,.5)'; c.fillRect(-14, -352, 28, 140); } });
      line(ctx, [[-60, -300], [-20, -302]], lw * .6, P.ink, .4); line(ctx, [[-60, -286], [-30, -288]], lw * .5, P.ink, .4); // kutuda elle yazı
      hand(ctx, -98, -270, 15, P.hSkin, lw); hand(ctx, 98, -272, 15, P.hSkin, lw);
    } else if (sitting) {
      arm([[-80, -392], [-104, -320], [-30, -284]], P.suitDk);
      haleTorso(ctx, lw);
      arm([[80, -392], [104, -320], [30, -284]], P.suit);
      if (o.phone !== false) phoneInHands(ctx, 0, -292, lw, .08, 0);
      hand(ctx, -26, -278, 15, P.hSkinDk, lw); hand(ctx, 24, -280, 15, P.hSkin, lw);
    } else {
      arm([[-80, -392], [-106, -320], [-104, -254]], P.suitDk);
      hand(ctx, -104, -240, 16, P.hSkinDk, lw);
      haleTorso(ctx, lw);
      if (o.hat === 'hand') {
        arm([[80, -392], [106, -320], [56, -268]], P.suit);
        ctx.save(); ctx.translate(30, -262); ctx.rotate(-.22); ctx.scale(.9, .9); ctx.translate(-2, 540); haleHat(ctx, lw); ctx.restore();
        hand(ctx, 52, -272, 16, P.hSkin, lw);
      } else {
        arm([[80, -392], [106, -320], [104, -254]], P.suit);
        hand(ctx, 104, -240, 16, P.hSkin, lw);
      }
    }
    haleHead(ctx, o, lw);
    ctx.restore(); ctx.restore();
  }
  function waitChair(ctx, x, y, lw, n) { // belediye sıra sandalyesi (n koltuk), ayak ortası (x,y)
    const P = P2; n = n || 1;
    for (let i = 0; i < n; i++) {
      const cx = x + (i - (n - 1) / 2) * 190;
      shape(ctx, [[cx - 82, -330], [cx + 82, -330], [cx + 78, -150], [cx - 78, -150]], '#3f6f8f', { lw, shade: (c) => blot(c, [[cx + 40, -340], [cx + 90, -340], [cx + 90, -140], [cx + 44, -140]], '#2c4f66', .7) });
      shape(ctx, [[cx - 88, -156], [cx + 88, -156], [cx + 84, -126], [cx - 84, -126]], '#4a80a3', { lw });
    }
    line(ctx, [[x - (n - 1) * 95 - 90, -110], [x + (n - 1) * 95 + 90, -110]], lw * 1.6, P.steelDk);
    [-1, 1].forEach((d) => line(ctx, [[x + d * ((n - 1) * 95 + 60), -110], [x + d * ((n - 1) * 95 + 70), 0]], lw * 1.3, P.steelDk));
  }

  /* ================= MEKÂNLAR =================
     Hepsi drawBackground gibi: opts {x,y,w,h,seed, ...}; alanı kırpar, karakterleri sonra çağıran çizer. */
  function areaStart(ctx, o) { const x = o.x || 0, y = o.y || 0, w = o.w || 1080, h = o.h || 1920; seed(o.seed || 7); ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); return { x, y, w, h }; }
  const SKIES = { day: ['#8fbadb', '#c9dbe0', '#f0e2c2'], dusk: ['#2f3a4b', '#7d4f3f', '#e0a066'], night: ['#03050c', '#0a1124', '#1d2742'], rain: ['#5d6873', '#7d8790', '#9aa1a3'] };
  function sky(ctx, a, hz, mode) {
    const s = SKIES[mode] || SKIES.day, g = ctx.createLinearGradient(0, a.y, 0, hz);
    g.addColorStop(0, s[0]); g.addColorStop(.6, s[1]); g.addColorStop(1, s[2]); ctx.fillStyle = g; ctx.fillRect(a.x, a.y, a.w, hz - a.y + 2);
    if (mode === 'night') for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(238,242,255,${.3 + R() * .6})`; ctx.fillRect(a.x + R() * a.w, a.y + R() * (hz - a.y) * .7, 2, 2); }
    if (mode === 'day') { ctx.fillStyle = P2.cloud; ctx.globalAlpha = .85; [[.25, .1], [.75, .18]].forEach(([u, v]) => [[0, 0, 70, 24], [-56, 8, 46, 18], [52, 6, 50, 20]].forEach(([dx, dy, rx, ry]) => ctx.fill(pathOf(wobble(ell(a.x + a.w * u + dx, a.y + a.h * v + dy, rx, ry, 20), true, 2), true)))); ctx.globalAlpha = 1; }
  }
  function nightDim(mode) { return mode === 'night' ? .55 : mode === 'rain' ? .3 : mode === 'dusk' ? .2 : 0; }
  function ground(ctx, a, hz, mode) {
    const g = ctx.createLinearGradient(0, hz, 0, a.y + a.h); g.addColorStop(0, P2.groundLt); g.addColorStop(.4, P2.ground); g.addColorStop(1, P2.groundDk);
    ctx.fillStyle = g; ctx.fillRect(a.x, hz, a.w, a.y + a.h - hz);
    for (let i = 0; i < 18; i++) blot(ctx, ell(a.x + R() * a.w, hz + 20 + R() * (a.y + a.h - hz), 40 + R() * 80, 8 + R() * 10, 12), R() < .5 ? P2.groundDk : P2.groundLt, .25);
    if (mode === 'rain') for (let i = 0; i < 6; i++) blot(ctx, ell(a.x + R() * a.w, hz + 60 + R() * (a.y + a.h - hz - 80), 60 + R() * 70, 8 + R() * 6, 14), '#7d8790', .5);
  }
  function darken(ctx, a, v, col) { if (!v) return; ctx.save(); ctx.globalAlpha = v; ctx.fillStyle = col || '#0a1124'; ctx.fillRect(a.x, a.y, a.w, a.h); ctx.restore(); }
  function rainFx(ctx, a, t) {
    ctx.save(); ctx.strokeStyle = P2.rain; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const T = t || 0; for (let i = 0; i < 140; i++) { const x = a.x + ((hrand(i * 3 + 1) * a.w + T * 120) % a.w), y = a.y + ((hrand(i * 7 + 2) * a.h + T * 1400) % a.h); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 34); ctx.stroke(); }
    ctx.restore();
  }
  function windowLight(ctx, x, y, w, h, on) { if (!on) return; const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w * 1.6); g.addColorStop(0, 'rgba(255,210,122,.55)'); g.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = g; ctx.fillRect(x - w * 2, y - h * 2, w * 5, h * 5); }

  // 1) Şirket avlusu: çit, kapı, posta kutusu, dedenin ofis barakası.
  //    opts: mode 'day'|'dusk'|'night'|'rain', t (yağmur zamanı), doorOpen, letter (posta kutusunda zarf ucu)
  function drawYard(ctx, o) {
    o = o || {}; const a = areaStart(ctx, o), mode = o.mode || 'day', hz = a.y + a.h * (o.horizon || .56), P = P2, lw = 3.6;
    sky(ctx, a, hz, mode);
    ctx.save(); let cx = a.x - 10; while (cx < a.x + a.w) { const bw = 60 + R() * 70, bh = 60 + R() * 150; shape(ctx, [[cx, hz], [cx, hz - bh], [cx + bw, hz - bh], [cx + bw, hz]], mode === 'night' ? '#161d2b' : P.far, { lw: 2, ink: mode === 'night' ? '#10161f' : P.far2, amp: .5 }); cx += bw + 6 + R() * 16; } ctx.restore();
    ground(ctx, a, hz, mode);
    // baraka (dedenin ofisi): oluklu sac, tek pencere, kapı
    const bx = a.x + a.w * .1, bw = a.w * .52, by = hz + a.h * .1, bh = a.h * .3;
    shape(ctx, [[bx, by], [bx, by - bh], [bx + bw, by - bh - 14], [bx + bw, by]], '#9aa59c', { lw, shade: (c) => { c.strokeStyle = 'rgba(21,18,13,.18)'; c.lineWidth = 2; for (let xx = bx + 10; xx < bx + bw; xx += 16) { c.beginPath(); c.moveTo(xx, by - bh - 20); c.lineTo(xx, by); c.stroke(); } blot(c, [[bx + bw * .7, by - bh - 30], [bx + bw + 10, by - bh - 30], [bx + bw + 10, by + 10], [bx + bw * .75, by + 10]], '#5d6b66', .35); blot(c, [[bx + 20, by - 40], [bx + 80, by - 70], [bx + 120, by - 30]], P.rust, .3); } });
    shape(ctx, [[bx - 16, by - bh + 4], [bx + bw + 18, by - bh - 16], [bx + bw + 18, by - bh - 30], [bx - 16, by - bh - 10]], P.steelDk, { lw });
    const wx = bx + bw * .14, wy = by - bh * .72, ww = bw * .3, wh = bh * .34;
    windowLight(ctx, wx, wy, ww, wh, mode === 'night' || mode === 'rain' ? o.lightOn !== false : false);
    shape(ctx, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], (mode === 'night' || mode === 'rain') && o.lightOn !== false ? P.lamp : P.glass, { lw, shade: (c) => { c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(wx + ww * .2, wy - 10, ww * .12, wh + 20); } });
    line(ctx, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], lw * .7); line(ctx, [[wx, wy + wh / 2], [wx + ww, wy + wh / 2]], lw * .7);
    const dx = bx + bw * .6, dw = bw * .22, dh = bh * .72;
    shape(ctx, [[dx, by], [dx, by - dh], [dx + dw, by - dh], [dx + dw, by]], o.doorOpen ? P.ink : '#6f5134', { lw, shade: (c) => blot(c, [[dx + dw * .6, by - dh - 10], [dx + dw + 10, by - dh - 10], [dx + dw + 10, by + 10], [dx + dw * .65, by + 10]], '#3f2711', .5) });
    if (!o.doorOpen) { shape(ctx, ell(dx + dw * .8, by - dh * .48, 6, 6, 10), P.gold, { lw: lw * .7 }); shape(ctx, [[dx + dw * .25, by - dh * .8], [dx + dw * .75, by - dh * .8], [dx + dw * .75, by - dh * .66], [dx + dw * .25, by - dh * .66]], P.paper, { lw: lw * .7 }); }
    shape(ctx, [[bx - 6, by], [bx + bw + 6, by], [bx + bw + 6, by + 14], [bx - 6, by + 14]], P.concrete, { lw: lw * .8 });
    // çit + kapı (sağda), tehlike şeritli kapı kolu
    const fy = hz + a.h * .14, gx = a.x + a.w * .72;
    ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = P.dustDk; ctx.lineWidth = 1.3;
    for (let fx = a.x - 20; fx < a.x + a.w; fx += 14) { if (fx > gx - 20 && fx < gx + a.w * .2) continue; ctx.beginPath(); ctx.moveTo(fx, fy - 110); ctx.lineTo(fx + 50, fy); ctx.moveTo(fx + 50, fy - 110); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.restore();
    line(ctx, [[a.x, fy - 112], [gx, fy - 110]], 3, P.dustDk, .8); line(ctx, [[gx + a.w * .2, fy - 110], [a.x + a.w, fy - 108]], 3, P.dustDk, .8);
    [gx, gx + a.w * .2].forEach((px) => line(ctx, [[px, fy - 130], [px, fy + 4]], 7, P.steelDk, .4));
    const bar = shape(ctx, [[gx, fy - 76], [gx + a.w * .2, fy - 80], [gx + a.w * .2, fy - 60], [gx, fy - 56]], null, { lw: 0 }); hazardStripes(ctx, bar, gx - 4, fy - 84, a.w * .2 + 8, 30, 14); ink(ctx, bar, 3);
    // posta kutusu (kapının önünde)
    const mx = gx - a.w * .1, my = fy + a.h * .1;
    line(ctx, [[mx, my], [mx, my - a.h * .1]], 8, P.steelDk, .3);
    shape(ctx, [[mx - 34, my - a.h * .1 - 8], [mx + 34, my - a.h * .1 - 8], [mx + 34, my - a.h * .1 - 56], [mx - 34, my - a.h * .1 - 56]], '#3f6f8f', { lw, shade: (c) => blot(c, [[mx + 10, my - a.h * .2], [mx + 40, my - a.h * .2], [mx + 40, my], [mx + 14, my]], '#2c4f66', .7) });
    line(ctx, [[mx - 22, my - a.h * .1 - 40], [mx + 22, my - a.h * .1 - 40]], 3);
    if (o.letter) shape(ctx, [[mx - 18, my - a.h * .1 - 44], [mx + 16, my - a.h * .1 - 46], [mx + 18, my - a.h * .1 - 62], [mx - 16, my - a.h * .1 - 60]], P.paper, { lw: lw * .7 });
    darken(ctx, a, nightDim(mode));
    if (mode === 'night' || mode === 'rain') windowLight(ctx, wx, wy, ww, wh, o.lightOn !== false);
    if (mode === 'rain') rainFx(ctx, a, o.t);
    ctx.restore();
  }

  // 2) Dedenin ofisi (iç): toz, masa üstünde çizimler, soğuk çay, şarjda telefon, alçak asılı takvim, arkasında boydan boya çatlak.
  //    opts: calendarMoved (0..1: takvim kenara kayar, çatlak görünür), lamp (masa lambası yanık), phoneOn (ekran yanık)
  function drawOffice(ctx, o) {
    o = o || {}; const a = areaStart(ctx, o), P = P2, lw = 3.8, fl = a.y + a.h * .7;
    // duvar
    ctx.fillStyle = P.wallOffice; ctx.fillRect(a.x, a.y, a.w, fl - a.y);
    for (let i = 0; i < 10; i++) blot(ctx, ell(a.x + R() * a.w, a.y + R() * (fl - a.y), 60 + R() * 120, 30 + R() * 60, 12), P.wallOfficeDk, .25);
    // pencereden ışık şeridi
    ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.moveTo(a.x + a.w * .62, a.y); ctx.lineTo(a.x + a.w * .82, a.y); ctx.lineTo(a.x + a.w * .55, fl); ctx.lineTo(a.x + a.w * .32, fl); ctx.fill(); ctx.restore();
    // duvardaki çizimler (iğneli kâğıtlar)
    [[.06, .1, .2, .18, -.04], [.3, .06, .16, .14, .05]].forEach(([u, v, ww, hh, r], i) => {
      ctx.save(); ctx.translate(a.x + a.w * u, a.y + a.h * v); ctx.rotate(r); const W = a.w * ww, H = a.h * hh;
      shape(ctx, [[0, 0], [W, 0], [W, H], [0, H]], P.page, { lw: lw * .8 }); seed(70 + i);
      ctx.strokeStyle = 'rgba(31,79,224,.5)'; ctx.lineWidth = 2; ctx.strokeRect(W * .15, H * .3, W * .3, H * .5); ctx.strokeRect(W * .5, H * .15, W * .3, H * .65);
      ctx.beginPath(); ctx.moveTo(W * .1, H * .85); ctx.lineTo(W * .9, H * .85); ctx.stroke();
      shape(ctx, ell(W / 2, 8, 6, 6, 8), P.beaconOn, { lw: 2 }); ctx.restore();
    });
    // çatlak (takvimin arkasında, yerden tavana)
    const kx = a.x + a.w * .74;
    const crack = [[kx - 6, a.y], [kx + 10, a.y + a.h * .12], [kx - 4, a.y + a.h * .24], [kx + 14, a.y + a.h * .36], [kx + 2, a.y + a.h * .48], [kx + 18, a.y + a.h * .6], [kx + 6, fl]];
    line(ctx, crack, 5, P.ink, 1.5); line(ctx, [[kx + 2, a.y + a.h * .48], [kx + 40, a.y + a.h * .52]], 2.5, P.ink, 1);
    line(ctx, [[kx + 14, a.y + a.h * .36], [kx - 26, a.y + a.h * .4]], 2.5, P.ink, 1);
    // takvim: alçak asılı; calendarMoved ile sağa kayar
    const cm = o.calendarMoved || 0, cx = kx - a.w * .1 + cm * a.w * .2, cy = a.y + a.h * .3, cw = a.w * .2, ch = a.h * .3;
    ctx.save(); ctx.translate(cx + cw / 2, cy); ctx.rotate(cm * .08 - .02); ctx.translate(-cw / 2, 0);
    line(ctx, [[cw / 2, -a.h * .08], [cw / 2, 0]], 2, P.ink, .2); shape(ctx, ell(cw / 2, -a.h * .08, 5, 5, 8), P.steel, { lw: 2 });
    shape(ctx, [[0, 0], [cw, 0], [cw, ch], [0, ch]], P.paper, { lw, shade: (c) => { c.fillStyle = P.brick; c.fillRect(-5, -5, cw + 10, ch * .38); } });
    ctx.fillStyle = P.paper; ctx.font = `400 ${Math.round(cw * .16)}px "Lilita One"`; ctx.textAlign = 'center'; ctx.fillText('MARCH', cw / 2, ch * .26);
    ctx.strokeStyle = 'rgba(21,18,13,.35)'; ctx.lineWidth = 1.5; for (let r = 0; r < 5; r++) for (let q = 0; q < 7; q++) ctx.strokeRect(cw * .06 + q * cw * .125, ch * .44 + r * ch * .1, cw * .125, ch * .1);
    ctx.restore();
    // zemin
    ctx.fillStyle = P.floorWood; ctx.fillRect(a.x, fl, a.w, a.y + a.h - fl);
    ctx.strokeStyle = 'rgba(21,18,13,.3)'; ctx.lineWidth = 2; for (let yy = fl + 30; yy < a.y + a.h; yy += 36) { ctx.beginPath(); ctx.moveTo(a.x, yy); ctx.lineTo(a.x + a.w, yy + 4); ctx.stroke(); }
    line(ctx, [[a.x, fl], [a.x + a.w, fl]], lw);
    // masa
    const tx = a.x + a.w * .04, tw = a.w * .62, ty = a.y + a.h * .62;
    shape(ctx, [[tx, ty], [tx + tw, ty], [tx + tw, ty + 26], [tx, ty + 26]], P.wood, { lw });
    line(ctx, [[tx + 20, ty + 26], [tx + 20, a.y + a.h * .92]], lw * 2.4, '#3f2711'); line(ctx, [[tx + tw - 20, ty + 26], [tx + tw - 20, a.y + a.h * .92]], lw * 2.4, '#3f2711');
    // masada: rulo çizim, çay, şarjda telefon, lamba
    shape(ctx, [[tx + 30, ty - 6], [tx + tw * .45, ty - 10], [tx + tw * .45, ty], [tx + 30, ty]], P.page, { lw: lw * .7 });
    ctx.save(); ctx.translate(tx + tw * .12, ty - 16); ctx.rotate(-.1); shape(ctx, [[-60, -9], [70, -9], [70, 9], [-60, 9]], P.pageDk, { lw: lw * .7 }); ctx.restore();
    const gx = tx + tw * .55; // çay bardağı (ince belli), soğuk: buhar yok
    shape(ctx, [[gx - 14, ty - 54], [gx + 14, ty - 54], [gx + 8, ty - 30], [gx + 14, ty - 4], [gx - 14, ty - 4], [gx - 8, ty - 30]], 'rgba(220,235,240,.8)', { lw: lw * .7 });
    shape(ctx, [[gx - 11, ty - 42], [gx + 11, ty - 42], [gx + 7, ty - 30], [gx + 12, ty - 7], [gx - 12, ty - 7], [gx - 7, ty - 30]], '#8a3a12', { lw: 0 });
    shape(ctx, ell(gx, ty - 2, 24, 5, 14), P.paper, { lw: lw * .6 });
    const px = tx + tw * .72; line(ctx, [[px + 20, ty - 4], [px + 70, ty + 10], [px + 90, a.y + a.h * .72]], 2.5, P.ink, .6);
    ctx.save(); ctx.translate(px, ty - 6); ctx.rotate(-1.45);
    if (o.phoneOn) { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 120); g.addColorStop(0, 'rgba(255,226,122,.45)'); g.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g; ctx.fillRect(-130, -130, 260, 260); }
    shape(ctx, [[-10, -24], [10, -24], [10, 24], [-10, 24]], P.steelDk, { lw: lw * .7 }); shape(ctx, [[-7, -20], [7, -20], [7, 20], [-7, 20]], o.phoneOn ? P.screen : '#20242c', { lw: 0, amp: .3 }); ctx.restore();
    const lx = tx + tw * .9;
    line(ctx, [[lx, ty], [lx - 30, ty - 110], [lx + 10, ty - 160]], lw * 1.4, P.steelDk, .3);
    shape(ctx, [[lx - 14, ty - 170], [lx + 40, ty - 150], [lx + 20, ty - 126], [lx - 24, ty - 150]], '#2f6f73', { lw });
    if (o.lamp) { ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(lx + 6, ty - 120, 10, lx, ty - 40, 260); g.addColorStop(0, 'rgba(255,210,122,.7)'); g.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = g; ctx.fillRect(a.x, a.y, a.w, a.h); ctx.restore(); }
    // toz: havada zerre + masada ince katman
    for (let i = 0; i < 50; i++) { ctx.fillStyle = `rgba(216,202,176,${.2 + R() * .4})`; ctx.beginPath(); ctx.arc(a.x + a.w * .3 + R() * a.w * .5, a.y + R() * (fl - a.y), 1 + R() * 2.5, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.dustLt; ctx.fillRect(tx, ty - 2, tw, 5); ctx.restore();
    if (!o.lamp) darken(ctx, a, .12);
    ctx.restore();
  }

  // 3) Daisy'nin kabini (iç), gece, yağmur: ön camda damlalar, iki kişi tek telefon.
  //    opts: people (true: Kaan + Defne oturur), t (yağmur), glow (telefon ışığı 0..1)
  function drawCabin(ctx, o) {
    o = o || {}; const a = areaStart(ctx, o), P = P2, lw = 4;
    ctx.fillStyle = '#0d1322'; ctx.fillRect(a.x, a.y, a.w, a.h);
    // ön cam (arkada): gece + yağmur
    const gx = a.x + a.w * .06, gy = a.y + a.h * .08, gw = a.w * .88, gh = a.h * .42;
    const wp = shape(ctx, [[gx, gy], [gx + gw, gy], [gx + gw - 20, gy + gh], [gx + 20, gy + gh]], '#1a2436', { lw: lw * 1.4 });
    ctx.save(); ctx.clip(wp);
    for (let i = 0; i < 8; i++) { const bx = gx + R() * gw; ctx.fillStyle = `rgba(255,210,122,${.15 + R() * .25})`; ctx.beginPath(); ctx.arc(bx, gy + gh * (.55 + R() * .3), 10 + R() * 26, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 90; i++) { const x = gx + hrand(i * 5 + 3) * gw, y = gy + ((hrand(i * 9 + 4) * gh + (o.t || 0) * 60 * (1 + hrand(i))) % gh); ctx.fillStyle = 'rgba(200,220,240,.5)'; ctx.beginPath(); ctx.ellipse(x, y, 2.5, 4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(200,220,240,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 20 * hrand(i + 9)); ctx.stroke(); }
    ctx.restore();
    line(ctx, [[a.x + a.w / 2, gy], [a.x + a.w / 2, gy + gh]], lw * 2, '#0d1322');
    // tavan uyarı ışığının iç yansıması (kırmızı, sönük)
    shape(ctx, [[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, gy], [a.x, gy]], P.dShade, { lw });
    // koltuk sırtı + gösterge paneli
    const sy = a.y + a.h * .5;
    shape(ctx, [[a.x + a.w * .04, sy + 20], [a.x + a.w * .48, sy + 20], [a.x + a.w * .46, a.y + a.h], [a.x + a.w * .06, a.y + a.h]], '#3a2c24', { lw });
    shape(ctx, [[a.x + a.w * .52, sy + 20], [a.x + a.w * .96, sy + 20], [a.x + a.w * .94, a.y + a.h], [a.x + a.w * .54, a.y + a.h]], '#3a2c24', { lw });
    if (o.people !== false) {
      const k = a.h / 1000;
      drawKaan(ctx, { pose: 'sit', seat: false, x: a.x + a.w * .3, y: a.y + a.h * 1.22, s: 1.15 * k * 1.6, expr: o.kaanExpr || 'smile', hands: 'phone', glow: .5 * (o.glow == null ? 1 : o.glow), seed: 11 });
      drawDefne(ctx, { pose: 'sit', seat: false, x: a.x + a.w * .7, y: a.y + a.h * 1.2, s: 1.2 * k * 1.6, expr: o.defneExpr || 'smile', look: -.8, seed: 31 });
    }
    // alt gösterge paneli (kameraya yakın)
    shape(ctx, [[a.x - 10, a.y + a.h * .9], [a.x + a.w + 10, a.y + a.h * .88], [a.x + a.w + 10, a.y + a.h + 10], [a.x - 10, a.y + a.h + 10]], P.steelDk, { lw });
    [.2, .32].forEach((u) => shape(ctx, ell(a.x + a.w * u, a.y + a.h * .95, 24, 24, 16), '#11151c', { lw: lw * .7 }));
    // telefonun sıcak ışığı
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(a.x + a.w * .48, a.y + a.h * .78, 10, a.x + a.w * .48, a.y + a.h * .7, a.h * .5);
    g.addColorStop(0, `rgba(255,226,122,${.35 * (o.glow == null ? 1 : o.glow)})`); g.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g; ctx.fillRect(a.x, a.y, a.w, a.h); ctx.restore();
    ctx.restore();
  }

  // 4) Belediye bekleme salonu: numaratör (kırmızı rakam), sıra sandalyeler, pano.
  //    opts: number ('047'), chairs (adet, 3), people false (karakterleri çağıran oturtur)
  function drawWaitingRoom(ctx, o) {
    o = o || {}; const a = areaStart(ctx, o), P = P2, lw = 3.8, fl = a.y + a.h * .66;
    ctx.fillStyle = P.hall; ctx.fillRect(a.x, a.y, a.w, fl - a.y);
    ctx.fillStyle = '#b8bdb0'; ctx.fillRect(a.x, a.y + (fl - a.y) * .55, a.w, (fl - a.y) * .45); line(ctx, [[a.x, a.y + (fl - a.y) * .55], [a.x + a.w, a.y + (fl - a.y) * .55]], 3, '#8e938a');
    // floresan ışık
    [.25, .7].forEach((u) => { shape(ctx, [[a.x + a.w * u - 90, a.y + 20], [a.x + a.w * u + 90, a.y + 20], [a.x + a.w * u + 90, a.y + 36], [a.x + a.w * u - 90, a.y + 36]], '#f6f7ee', { lw: 3 }); });
    // numaratör
    const nx = a.x + a.w * .62, ny = a.y + a.h * .12, nw = a.w * .26, nh = a.h * .1;
    shape(ctx, [[nx, ny], [nx + nw, ny], [nx + nw, ny + nh], [nx, ny + nh]], '#14161b', { lw });
    ctx.save(); ctx.font = `400 ${Math.round(nh * .7)}px "Lilita One"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,59,47,.8)'; ctx.shadowBlur = 14; ctx.fillStyle = P.beaconOn; ctx.fillText(o.number || '047', nx + nw / 2, ny + nh * .55); ctx.restore();
    ctx.save(); ctx.font = `700 ${Math.round(nh * .2)}px Rubik`; ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.fillText('NOW SERVING', nx + nw / 2, ny + nh + nh * .3); ctx.restore();
    // pano + ilanlar
    const bx = a.x + a.w * .08, by = a.y + a.h * .1, bw = a.w * .36, bh = a.h * .2;
    shape(ctx, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], '#b88a5a', { lw });
    [[.06, .1, .3, .5, P.page], [.42, .08, .26, .38, '#e8eef2'], [.72, .14, .22, .6, P.paper], [.4, .55, .3, .36, P.page]].forEach(([u, v, ww, hh, col], i) => {
      ctx.save(); ctx.translate(bx + bw * u, by + bh * v); ctx.rotate((hrand(i + 40) - .5) * .1); shape(ctx, [[0, 0], [bw * ww, 0], [bw * ww, bh * hh], [0, bh * hh]], col, { lw: 2.4 });
      ctx.fillStyle = 'rgba(21,18,13,.35)'; for (let r = 0; r < 4; r++) ctx.fillRect(bw * ww * .12, bh * hh * (.2 + r * .18), bw * ww * (.5 + hrand(i * 9 + r) * .3), 3); ctx.restore();
    });
    // zemin karo
    ctx.fillStyle = '#d6d1c2'; ctx.fillRect(a.x, fl, a.w, a.y + a.h - fl);
    ctx.strokeStyle = 'rgba(21,18,13,.2)'; ctx.lineWidth = 2; for (let i = -10; i < 20; i++) { ctx.beginPath(); ctx.moveTo(a.x + a.w / 2 + i * 40, fl); ctx.lineTo(a.x + a.w / 2 + i * 160, a.y + a.h); ctx.stroke(); }
    for (let yy = fl; yy < a.y + a.h; yy += (yy - fl) * .35 + 18) { ctx.beginPath(); ctx.moveTo(a.x, yy); ctx.lineTo(a.x + a.w, yy); ctx.stroke(); }
    line(ctx, [[a.x, fl], [a.x + a.w, fl]], lw, '#8e938a');
    if (o.chairs !== 0) { const k = a.h / 1000; ctx.save(); ctx.translate(a.x + a.w * .5, fl + a.h * .2); ctx.scale(k * .9, k * .9); waitChair(ctx, 0, 0, lw, o.chairs || 3); ctx.restore(); }
    ctx.restore();
  }

  // 5) Su kulesi (iş 2): kafes ayaklar, tank, merdiven, çit, inşaat ekibi bariyeri.  opts: mode, fall (0..1 eğilme)
  function drawWaterTower(ctx, o) {
    o = o || {}; const a = areaStart(ctx, o), P = P2, mode = o.mode || 'day', hz = a.y + a.h * (o.horizon || .6), lw = 4;
    sky(ctx, a, hz, mode); ground(ctx, a, hz, mode);
    const cx = a.x + a.w * (o.towerX || .5), base = hz + a.h * .06, th = a.h * .5;
    ctx.save(); ctx.translate(cx, base); ctx.rotate((o.fall || 0) * 1.2);
    const legs = [[-a.w * .14, 0], [-a.w * .05, 0], [a.w * .05, 0], [a.w * .14, 0]];
    legs.forEach(([lx]) => line(ctx, [[lx, 0], [lx * .55, -th * .62]], lw * 2.2, P.concreteDk, .5));
    for (let k = 1; k < 4; k++) { const yy = -th * .62 * k / 4, f = 1 - .45 * k / 4; line(ctx, [[-a.w * .14 * f, yy], [a.w * .14 * f, yy]], lw * 1.2, P.concreteDk, .4); line(ctx, [[-a.w * .14 * f, yy], [a.w * .14 * (1 - .45 * (k - 1) / 4), yy + th * .62 / 4]], lw * .7, P.concreteDk, .4); }
    shape(ctx, [[-a.w * .13, -th * .62], [a.w * .13, -th * .62], [a.w * .15, -th * .92], [0, -th], [-a.w * .15, -th * .92]], P.concrete, { lw, shade: (c) => { blot(c, [[a.w * .03, -th * 1.1], [a.w * .2, -th * 1.1], [a.w * .2, -th * .5], [a.w * .05, -th * .5]], P.concreteDk, .5); for (let i = 0; i < 12; i++) blot(c, ell((R() - .5) * a.w * .25, -th * (.65 + R() * .3), 8 + R() * 14, 4 + R() * 6, 8), P.dustDk, .3); } });
    line(ctx, [[-a.w * .15, -th * .78], [a.w * .15, -th * .78]], lw * .6);
    for (let yy = -th * .62; yy < 0; yy += 22) line(ctx, [[a.w * .02, yy], [a.w * .05, yy]], 2.5, P.steelDk, .2);
    ctx.restore();
    const fy = hz + a.h * .22, bar = shape(ctx, [[a.x - 10, fy - 30], [a.x + a.w + 10, fy - 34], [a.x + a.w + 10, fy - 12], [a.x - 10, fy - 8]], null, { lw: 0 });
    hazardStripes(ctx, bar, a.x - 14, fy - 38, a.w + 30, 32, 18); ink(ctx, bar, 3);
    [.08, .5, .92].forEach((u) => line(ctx, [[a.x + a.w * u, fy - 40], [a.x + a.w * u, fy + 20]], 6, P.steelDk, .3));
    darken(ctx, a, nightDim(mode));
    ctx.restore();
  }

  // 6) Eski bina çeşitlemesi (iş 3–8): variant 0..5 → kat sayısı, malzeme, çatı, tahta kapalı pencere.
  //    0: eski otopark (açık katlar), 1: 3 katlı tuğla blok, 2: depo (testere çatı), 3: sıvalı apartman, 4: eski sinema, 5: fabrika ofisi
  function drawOldBuilding(ctx, o) {
    o = o || {}; const a = areaStart(ctx, o), P = P2, mode = o.mode || 'day', hz = a.y + a.h * (o.horizon || .62), lw = 4, v = (o.variant || 0) % 6;
    seed(o.seed || 100 + v); sky(ctx, a, hz, mode);
    let cx = a.x - 10; while (cx < a.x + a.w) { const bw = 50 + R() * 80, bh = 40 + R() * 120; shape(ctx, [[cx, hz], [cx, hz - bh], [cx + bw, hz - bh], [cx + bw, hz]], P.far, { lw: 2, ink: P.far2, amp: .5 }); cx += bw + 8; }
    ground(ctx, a, hz, mode);
    const spec = [{ f: 4, w: .78, col: P.concrete, dk: P.concreteDk, open: true }, { f: 3, w: .6, col: P.brick, dk: P.brickDk }, { f: 1, w: .84, col: '#a7a08f', dk: '#7d7666', saw: true }, { f: 5, w: .52, col: '#d8c7a4', dk: '#b09c76' }, { f: 2, w: .7, col: '#b07a5a', dk: '#7f5238', marquee: true }, { f: 3, w: .66, col: '#9aa59c', dk: '#6d7870' }][v];
    const bw = a.w * spec.w, fh = a.h * (spec.f === 1 ? .22 : .5 / Math.max(3, spec.f)), bh = fh * spec.f, bx = a.x + (a.w - bw) / 2, by = hz + a.h * .08;
    shape(ctx, [[bx, by], [bx, by - bh], [bx + bw, by - bh], [bx + bw, by]], spec.col, {
      lw, shade: (c) => {
        blot(c, [[bx + bw * .72, by - bh - 20], [bx + bw + 20, by - bh - 20], [bx + bw + 20, by + 20], [bx + bw * .76, by + 20]], spec.dk, .55);
        if (spec.col === P.brick) { c.strokeStyle = 'rgba(217,194,160,.4)'; c.lineWidth = 1.2; for (let yy = by - 12; yy > by - bh; yy -= 12) { c.beginPath(); c.moveTo(bx, yy); c.lineTo(bx + bw, yy); c.stroke(); } }
        for (let i = 0; i < 10; i++) blot(c, ell(bx + R() * bw, by - R() * bh, 10 + R() * 30, 6 + R() * 16, 10), P.dustDk, .22);
        const sg = c.createLinearGradient(0, by - 40, 0, by); sg.addColorStop(0, 'rgba(110,100,87,0)'); sg.addColorStop(1, 'rgba(110,100,87,.45)'); c.fillStyle = sg; c.fillRect(bx, by - 40, bw, 40);
      }
    });
    // pencereler / açık katlar
    for (let f = 0; f < spec.f; f++) {
      const fy = by - fh * (f + 1);
      if (spec.open) { shape(ctx, [[bx + 14, fy + fh * .22], [bx + bw - 14, fy + fh * .22], [bx + bw - 14, fy + fh * .9], [bx + 14, fy + fh * .9]], '#3a3d45', { lw: lw * .8 }); for (let q = 1; q < 6; q++) line(ctx, [[bx + bw * q / 6, fy + fh * .22], [bx + bw * q / 6, fy + fh * .9]], lw * 1.8, spec.col, .3); line(ctx, [[bx, fy + fh], [bx + bw, fy + fh]], lw * .7); continue; }
      if (spec.saw) continue;
      const nwin = Math.max(2, Math.round(bw / 120));
      for (let q = 0; q < nwin; q++) {
        const ww = bw / nwin * .5, wx = bx + bw / nwin * (q + .25), wy = fy + fh * .25, wh = fh * .5, boarded = R() < .45;
        shape(ctx, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], boarded ? '#8a6a44' : '#2b3a44', { lw: lw * .8, shade: (c) => { if (boarded) { c.strokeStyle = 'rgba(21,18,13,.5)'; c.lineWidth = 2; for (let yy = wy + 10; yy < wy + wh; yy += 12) { c.beginPath(); c.moveTo(wx, yy); c.lineTo(wx + ww, yy + 2); c.stroke(); } } else { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(wx + ww * .2, wy, ww * .15, wh); } } });
        if (boarded) line(ctx, [[wx - 4, wy + 4], [wx + ww + 4, wy + wh - 4]], lw * 1.2, '#6b4d2c', .3);
      }
    }
    if (spec.saw) { for (let q = 0; q < 5; q++) { const sx = bx + bw * q / 5; shape(ctx, [[sx, by - bh], [sx + bw / 5, by - bh], [sx + bw / 5, by - bh - fh * .5]], spec.dk, { lw: lw * .8 }); shape(ctx, [[sx + bw / 5 - 8, by - bh - 4], [sx + bw / 5 - 2, by - bh - fh * .45], [sx + bw / 5 - 2, by - bh - 4]], '#2b3a44', { lw: 0 }); } shape(ctx, [[bx + bw * .4, by], [bx + bw * .4, by - bh * .7], [bx + bw * .6, by - bh * .7], [bx + bw * .6, by]], '#6d6658', { lw }); }
    if (spec.marquee) { shape(ctx, [[bx + bw * .2, by - fh * 1.05], [bx + bw * .8, by - fh * 1.05], [bx + bw * .85, by - fh * .8], [bx + bw * .15, by - fh * .8]], '#7a2a1d', { lw }); for (let q = 0; q < 12; q++) shape(ctx, ell(bx + bw * (.2 + q * .055), by - fh * .92, 4, 4, 6), P.lightOff, { lw: 1.5 }); }
    if (spec.open) { const sg = shape(ctx, [[bx + bw * .06, by - bh - 70], [bx + bw * .06 + 70, by - bh - 70], [bx + bw * .06 + 70, by - bh], [bx + bw * .06, by - bh]], '#3f6f8f', { lw }); void sg; ctx.save(); ctx.font = '400 56px "Lilita One"'; ctx.fillStyle = P.paper; ctx.textAlign = 'center'; ctx.fillText('P', bx + bw * .06 + 35, by - bh - 14); ctx.restore(); }
    // çatı kenarı + çatlak + moloz
    line(ctx, [[bx - 8, by - bh], [bx + bw + 8, by - bh]], lw * 1.6);
    line(ctx, [[bx + bw * .3, by - bh], [bx + bw * .34, by - bh * .8], [bx + bw * .31, by - bh * .6]], 2.4, P.ink, .5);
    for (let i = 0; i < 8; i++) { const px = bx - 40 + R() * (bw + 80), py = by + 4 + R() * 24, sz = 6 + R() * 10; ctx.save(); ctx.translate(px, py); ctx.rotate(R() * 3); shape(ctx, [[-sz, -sz * .5], [sz, -sz * .6], [sz, sz * .4], [-sz * .7, sz * .5]], [spec.col, spec.dk, P.dust][i % 3], { lw: 2, amp: .3 }); ctx.restore(); }
    // güvenlik çiti (oyunla bağ: şerit)
    const fy = by + a.h * .1, bar = shape(ctx, [[a.x - 10, fy - 26], [a.x + a.w + 10, fy - 28], [a.x + a.w + 10, fy - 8], [a.x - 10, fy - 6]], null, { lw: 0 });
    hazardStripes(ctx, bar, a.x - 14, fy - 32, a.w + 30, 28, 16); ink(ctx, bar, 3);
    darken(ctx, a, nightDim(mode));
    ctx.restore();
  }

  // 7) Hale Tower: 40 katlı cam kule, kapıda altın harfli "HALE" tabela, şehir silueti.  opts: mode, empty (pencereler sönük), sink (0..1 çöküş, 9. bölüm)
  function drawHaleTower(ctx, o) {
    o = o || {}; const a = areaStart(ctx, o), P = P2, mode = o.mode || 'day', hz = a.y + a.h * (o.horizon || .86), lw = 3.6;
    sky(ctx, a, hz, mode);
    // şehir silueti (iki kat)
    [[P.far2, 120, 320], [P.far, 60, 200]].forEach(([col, hmin, hmax], li) => { let cx = a.x - 20; seed(200 + li); while (cx < a.x + a.w) { const bw = 40 + R() * 70, bh = hmin + R() * (hmax - hmin); shape(ctx, [[cx, hz], [cx, hz - bh], [cx + bw, hz - bh], [cx + bw, hz]], mode === 'night' ? (li ? '#161d2b' : '#10161f') : col, { lw: 1.6, ink: mode === 'night' ? '#0b0f18' : P.far2, amp: .4 }); if (mode === 'night') { ctx.fillStyle = 'rgba(255,210,122,.6)'; for (let yy = hz - bh + 10; yy < hz - 8; yy += 14) for (let xx = cx + 6; xx < cx + bw - 6; xx += 12) if (R() < .25) ctx.fillRect(xx, yy, 4, 6); } cx += bw + 3; } });
    // kule
    const sink = o.sink || 0, tw = a.w * .3, tx = a.x + a.w * (o.towerX || .5) - tw / 2, th = a.h * .8 * (1 - sink * .9), ty = hz - th, fh = (a.h * .8) / 40;
    shape(ctx, [[tx, hz], [tx, ty], [tx + tw, ty], [tx + tw, hz]], mode === 'night' ? '#22344a' : P.glassT, {
      lw, shade: (c) => {
        blot(c, [[tx + tw * .62, ty - 20], [tx + tw + 20, ty - 20], [tx + tw + 20, hz + 10], [tx + tw * .66, hz + 10]], mode === 'night' ? '#162536' : P.glassTDk, .7);
        c.strokeStyle = 'rgba(21,18,13,.35)'; c.lineWidth = 1.4; for (let k = 1; k < 40; k++) { const yy = hz - k * fh; if (yy < ty) break; c.beginPath(); c.moveTo(tx, yy); c.lineTo(tx + tw, yy); c.stroke(); }
        for (let q = 1; q < 6; q++) { c.beginPath(); c.moveTo(tx + tw * q / 6, ty); c.lineTo(tx + tw * q / 6, hz); c.stroke(); }
        c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(tx + tw * .1, ty); c.lineTo(tx + tw * .22, ty); c.lineTo(tx + tw * .02, ty + th * .5); c.lineTo(tx, ty + th * .5); c.fill();
        if (mode === 'night' && !o.empty) { for (let k = 0; k < 40; k++) for (let q = 0; q < 6; q++) if (hrand(k * 6 + q + 9) < .35) { c.fillStyle = 'rgba(255,210,122,.75)'; c.fillRect(tx + tw * q / 6 + 3, hz - (k + 1) * fh + 3, tw / 6 - 6, fh - 5); } }
      }
    });
    if (!sink) { line(ctx, [[tx + tw / 2, ty], [tx + tw / 2, ty - a.h * .05]], 3, P.ink, .3); shape(ctx, ell(tx + tw / 2, ty - a.h * .05, 4, 4, 6), P.beaconOn, { lw: 1.5 }); }
    // giriş + altın tabela
    const ex = tx + tw * .3, ew = tw * .4, eh = fh * 2.4;
    shape(ctx, [[ex, hz], [ex, hz - eh], [ex + ew, hz - eh], [ex + ew, hz]], '#1c2836', { lw });
    const sg = shape(ctx, [[ex - 6, hz - eh - fh * 1.1], [ex + ew + 6, hz - eh - fh * 1.1], [ex + ew + 6, hz - eh - 4], [ex - 6, hz - eh - 4]], '#14161b', { lw: lw * .8 });
    void sg; ctx.save(); const fs = Math.max(10, fh * .85); ctx.font = `400 ${fs}px "Lilita One"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const gg = ctx.createLinearGradient(0, hz - eh - fh, 0, hz - eh); gg.addColorStop(0, '#ffe08a'); gg.addColorStop(1, P.goldDk); ctx.fillStyle = gg; ctx.fillText('HALE', ex + ew / 2, hz - eh - fh * .55); ctx.restore();
    // zemin şeridi (kaldırım)
    ctx.fillStyle = mode === 'night' ? '#1d2028' : '#b9b1a0'; ctx.fillRect(a.x, hz, a.w, a.y + a.h - hz); line(ctx, [[a.x, hz], [a.x + a.w, hz]], lw);
    darken(ctx, a, mode === 'night' ? 0 : nightDim(mode));
    ctx.restore();
  }

  // 8) Kafe masası (üstten): patates kızartması, kahve bardağı, mektup zarfı.  opts: letter (true), ring (kahve halkası), fries (0..1 kalan)
  function drawCafe(ctx, o) {
    o = o || {}; const a = areaStart(ctx, o), P = P2;
    ctx.fillStyle = '#c96a3e'; ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.strokeStyle = 'rgba(21,18,13,.18)'; ctx.lineWidth = 3; for (let i = 0; i < a.w + a.h; i += 60) { ctx.beginPath(); ctx.moveTo(a.x + i, a.y); ctx.lineTo(a.x + i - a.h, a.y + a.h); ctx.stroke(); }
    for (let i = 0; i < 10; i++) blot(ctx, ell(a.x + R() * a.w, a.y + R() * a.h, 50 + R() * 90, 20 + R() * 40, 12), '#a8532c', .3);
    const k = Math.min(a.w, a.h) / 900;
    // patates (kâğıt kutuda)
    ctx.save(); ctx.translate(a.x + a.w * .28, a.y + a.h * .3); ctx.rotate(-.15); ctx.scale(k, k);
    shape(ctx, [[-120, -90], [120, -90], [100, 110], [-100, 110]], P.paper, { lw: 5, shade: (c) => { c.fillStyle = P.beaconOn; for (let i = -120; i < 120; i += 48) c.fillRect(i, -100, 22, 220); } });
    const nf = Math.round(26 * (o.fries == null ? 1 : o.fries));
    for (let i = 0; i < nf; i++) { ctx.save(); ctx.translate((hrand(i + 1) - .5) * 180, (hrand(i + 50) - .5) * 150); ctx.rotate(hrand(i + 90) * 3); shape(ctx, [[-50, -9], [50, -9], [50, 9], [-50, 9]], i % 3 ? P.hazardHi : '#e8b65c', { lw: 3.4, amp: .4 }); ctx.restore(); }
    ctx.restore();
    if (o.ring !== false && !o.letter) { ctx.save(); ctx.strokeStyle = 'rgba(122,74,36,.55)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(a.x + a.w * .72, a.y + a.h * .66, 52 * k, .3, 5.6); ctx.stroke(); ctx.restore(); }
    coffeeTop(ctx, a.x + a.w * .74, a.y + a.h * .3, k);
    if (o.letter !== false) drawLetter(ctx, { x: a.x + a.w * .5, y: a.y + a.h * .7, s: k * 1.1, rot: .08, kind: 'envelope', ring: o.ring !== false });
    ctx.restore();
  }
  function coffeeTop(ctx, x, y, k) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.globalAlpha = .25; ctx.fillStyle = P2.ink; ctx.beginPath(); ctx.ellipse(12, 14, 82, 82, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    shape(ctx, ell(0, 0, 80, 80, 30), P2.paper, { lw: 5 }); shape(ctx, ell(0, 0, 62, 62, 26), P2.coffee, { lw: 3.5, shade: (c) => blot(c, ell(-18, -16, 24, 14, 12), '#a7713e', .7) });
    ctx.restore();
  }

  /* ================= NESNELER ================= */
  // Elle yazı (dedenin eli ya da Kaan'ın notu): harf harf eğik, oynayan taban çizgisi.
  function handwrite(ctx, text, x, y, size, col, sd, o) {
    o = o || {}; ctx.save(); ctx.font = `500 ${size}px Rubik`; ctx.fillStyle = col || P2.inkOld; ctx.textBaseline = 'alphabetic';
    let cx = x; for (let i = 0; i < text.length; i++) {
      const ch = text[i], j = hrand((sd || 1) * 131 + i);
      ctx.save(); ctx.translate(cx, y + (j - .5) * size * .1); ctx.transform(1, 0, -.22, 1, 0, 0); ctx.rotate((hrand(i * 7 + (sd || 1)) - .5) * .12);
      ctx.fillText(ch, 0, 0); if (o.bold) ctx.fillText(ch, .8, 0); ctx.restore();
      cx += ctx.measureText(ch).width * (o.track || .92);
    }
    ctx.restore(); return cx - x;
  }
  // Şikâyet mektubu / zarf. opts: kind 'letter'|'envelope', ring (kahve halkası), lines (mektup gövdesi metni dizi), x,y orta, s, rot
  function drawLetter(ctx, o) {
    o = o || {}; const P = P2, kind = o.kind || 'letter', s = o.s || 1;
    seed(o.seed || 81); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; const W = kind === 'envelope' ? 380 : 340, H = kind === 'envelope' ? 220 : 460; ctx.fillRect(-W / 2 + 10, -H / 2 + 12, W, H); ctx.restore();
    shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], P.paper, { lw: 4.4 });
    ctx.textAlign = 'left';
    if (kind === 'envelope') {
      line(ctx, [[-W / 2, -H / 2], [0, 10], [W / 2, -H / 2]], 2.4, 'rgba(21,18,13,.4)', .5);
      ctx.font = '700 22px Rubik'; ctx.fillStyle = P.ink; ctx.fillText('IRONLINE DEMOLITION', -W / 2 + 22, -H / 2 + 36);
      ironMark(ctx, W / 2 - 50, -H / 2 + 36, 1);
      handwrite(ctx, 'To: Kaan', -40, 56, 30, P.ink, 5); line(ctx, [[-40, 66], [90, 64]], 2, 'rgba(21,18,13,.5)', .3);
    } else {
      ironMark(ctx, -W / 2 + 46, -H / 2 + 50, 1.2);
      ctx.font = '700 26px Rubik'; ctx.fillStyle = P.ink; ctx.fillText('IRONLINE', -W / 2 + 86, -H / 2 + 46); ctx.font = '500 16px Rubik'; ctx.fillText('DEMOLITION', -W / 2 + 88, -H / 2 + 68);
      line(ctx, [[-W / 2 + 24, -H / 2 + 88], [W / 2 - 24, -H / 2 + 88]], 2.4, P.ink, .4);
      const body = o.lines || null; ctx.font = '500 20px Rubik';
      if (body) body.forEach((t, i) => { ctx.fillStyle = P.ink; ctx.fillText(t, -W / 2 + 28, -H / 2 + 140 + i * 34); });
      else for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(21,18,13,.4)'; ctx.fillRect(-W / 2 + 28, -H / 2 + 130 + i * 30, (W - 56) * (i === 5 ? .5 : .85 + hrand(i) * .1), 6); }
      handwrite(ctx, 'Ironline', -W / 2 + 40, H / 2 - 50, 34, P.ink, 9);
    }
    if (o.ring) { ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = P.coffee; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(W * .22, H * .12, 56, .5, 5.7); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W * .22, H * .12, 48, 1, 4); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  function ironMark(ctx, x, y, k) { // Ironline amblemi: çapraz kiriş (kurgusal)
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    shape(ctx, [[-22, -22], [22, -22], [22, 22], [-22, 22]], P2.steelDk, { lw: 3 }); line(ctx, [[-14, 14], [14, -14]], 4, P2.paper, .2); line(ctx, [[-14, -14], [14, 14]], 4, P2.paper, .2);
    ctx.restore();
  }
  // Dedenin defteri (açık): sol sayfa el yazısı, sağ sayfa "H&K" bina planı. opts: x,y orta, s, rot, lastPage (5. bölüm son sayfa metni)
  function drawNotebook(ctx, o) {
    o = o || {}; const P = P2, s = o.s || 1; seed(o.seed || 91); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(-372, -232, 760, 490); ctx.restore();
    shape(ctx, [[-380, -250], [380, -250], [380, 250], [-380, 250]], '#4a2e17', { lw: 5 });
    shape(ctx, [[-364, -238], [-4, -232], [-4, 238], [-364, 236]], P.page, { lw: 3.6, shade: (c) => { const g = c.createLinearGradient(-60, 0, 0, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = g; c.fillRect(-60, -240, 60, 480); } });
    shape(ctx, [[4, -232], [364, -238], [364, 236], [4, 238]], P.page, { lw: 3.6, shade: (c) => { const g = c.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, -240, 60, 480); } });
    ctx.strokeStyle = 'rgba(31,79,224,.18)'; ctx.lineWidth = 1.4; for (let yy = -190; yy < 230; yy += 34) { ctx.beginPath(); ctx.moveTo(-350, yy); ctx.lineTo(-16, yy); ctx.moveTo(16, yy); ctx.lineTo(350, yy); ctx.stroke(); }
    const lp = o.lastPage ? ['They will not last.', 'I should have said no.', 'Take them down', 'before they fall.'] : ['No.3  Water tower', 'cheap mix. sand?', 'H. says fine.', 'I signed. Wrong.'];
    lp.forEach((t, i) => handwrite(ctx, t, -340, -160 + i * 68 + (o.lastPage ? 0 : 0), 30, P.inkOld, 11 + i));
    // sağ sayfa: bina kesiti + H&K
    ctx.save(); ctx.strokeStyle = P.inkOld; ctx.lineWidth = 2.4; ctx.setLineDash([]);
    ctx.stroke(pathOf(wobble([[60, 170], [60, -110], [200, -170], [300, -110], [300, 170]], false, 1.2), false));
    for (let k = 0; k < 5; k++) ctx.stroke(pathOf(wobble([[60, 170 - k * 56], [300, 170 - k * 56]], false, 1), false));
    ctx.setLineDash([8, 8]); ctx.stroke(pathOf(wobble([[40, 200], [320, 200]], false, 1), false)); ctx.setLineDash([]); ctx.restore();
    handwrite(ctx, 'H & K', 120, -190, 44, P.inkOld, 21, { bold: true });
    handwrite(ctx, '1979', 250, 220, 24, P.inkOld, 23);
    line(ctx, [[220, 90], [250, 60], [236, 44]], 3, P.beaconOn, .6); // kırmızı kalem: çatlak işareti
    ctx.restore();
  }
  // Teneke kutu + not. opts: open (kapak açık), note (true), text
  function drawTin(ctx, o) {
    o = o || {}; const P = P2, s = o.s || 1; seed(o.seed || 95); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(10, 120, 230, 30, 0, 0, TAU); ctx.fill(); ctx.restore();
    shape(ctx, [[-200, -40], [200, -40], [196, 110], [-196, 110]], '#8f9aa3', { lw: 5, shade: (c) => { blot(c, [[90, -50], [210, -50], [210, 120], [110, 120]], '#5d6873', .6); for (let i = 0; i < 9; i++) blot(c, ell(-180 + R() * 360, -30 + R() * 130, 8 + R() * 20, 5 + R() * 10, 8), P.rust, .5); } });
    line(ctx, [[-196, 0], [196, 0]], 2.6, 'rgba(21,18,13,.4)', .5);
    if (o.open) {
      shape(ctx, [[-206, -60], [206, -60], [200, -40], [-200, -40]], '#3a3d45', { lw: 4 });
      ctx.save(); ctx.translate(30, -52); ctx.rotate(-.06);
      shape(ctx, [[-150, -90], [140, -96], [146, 4], [-146, 10]], P.page, { lw: 4, shade: (c) => line(c, [[-150, -40], [146, -44]], 1.6, 'rgba(21,18,13,.25)', .3) });
      if (o.note !== false) { handwrite(ctx, 'Ant.', -126, -54, 34, P.inkOld, 31); handwrite(ctx, o.text || 'Now build something.', -126, -10, 28, P.inkOld, 33); }
      ctx.restore();
      ctx.save(); ctx.translate(-30, -150); ctx.rotate(-.25); shape(ctx, [[-206, -20], [206, -20], [206, 6], [-206, 6]], '#a7b1b9', { lw: 5 }); ctx.restore();
    } else shape(ctx, [[-206, -62], [206, -62], [206, -36], [-206, -36]], '#a7b1b9', { lw: 5, shade: (c) => blot(c, [[100, -70], [210, -70], [210, -30], [120, -30]], '#5d6873', .5) });
    ctx.restore();
  }
  // Köşe taşı damgası "H K" (b-sahneler.js'deki kabartma ile aynı görünüm). opts: x,y orta, s, rot, dust (0..1 üstteki toz)
  function drawStamp(ctx, o) {
    o = o || {}; const P = P2, s = o.s || 1, W = 330, H = 190; ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.rotate(o.rot == null ? -.05 : o.rot); ctx.scale(s, s);
    seed(700);
    shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2 + 4], [W / 2 + 4, H / 2], [-W / 2 - 2, H / 2 - 2]], '#c9b892', {
      lw: 5, shade: (cc) => { blot(cc, [[-W / 2, H * .28], [W / 2 + 10, H * .24], [W / 2 + 10, H], [-W / 2, H]], '#a08f6c', .7); for (let i = 0; i < 30; i++) { cc.fillStyle = 'rgba(110,100,87,.35)'; cc.beginPath(); cc.arc((hrand(800 + i) - .5) * W, (hrand(900 + i) - .5) * H, 1 + hrand(950 + i) * 3, 0, TAU); cc.fill(); } }
    });
    line(ctx, [[-118, -62], [118, -60], [118, 58], [-118, 56], [-118, -62]], 3, 'rgba(21,18,13,.55)', .6);
    ctx.font = '700 112px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8a7a5a'; ctx.fillText('H  K', 5, 7); ctx.fillStyle = '#f2e6c8'; ctx.fillText('H  K', -3, -3); ctx.fillStyle = '#d6c6a0'; ctx.fillText('H  K', 0, 0);
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(21,18,13,.6)'; ctx.strokeText('H  K', 0, 0);
    const d = o.dust || 0; for (let i = 0; i < 150 * d; i++) { ctx.fillStyle = i % 3 ? 'rgba(216,202,176,.92)' : 'rgba(152,140,122,.85)'; ctx.beginPath(); ctx.ellipse((hrand(8000 + i) - .5) * W, (hrand(8100 + i) - .5) * H, 20 + hrand(8300 + i) * 26, 12 + hrand(8400 + i) * 12, hrand(8500 + i) * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // Daisy'nin sensör çizimi (teknik resim): kabin ana hatları, sensör kutusu, ok, ölçü, antet.  opts: x,y orta, s, rot
  function drawSensorPlan(ctx, o) {
    o = o || {}; const P = P2, s = o.s || 1, W = 760, H = 540; seed(o.seed || 97); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(-W / 2 + 12, -H / 2 + 14, W, H); ctx.restore();
    shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], '#e4ebe9', { lw: 4.4, shade: (c) => { c.strokeStyle = 'rgba(31,79,224,.12)'; c.lineWidth = 1; for (let xx = -W / 2; xx < W / 2; xx += 20) { c.beginPath(); c.moveTo(xx, -H / 2); c.lineTo(xx, H / 2); c.stroke(); } for (let yy = -H / 2; yy < H / 2; yy += 20) { c.beginPath(); c.moveTo(-W / 2, yy); c.lineTo(W / 2, yy); c.stroke(); } } });
    const B = '#24408f';
    ctx.save(); ctx.strokeStyle = B; ctx.lineWidth = 2.6;
    const cab = [[-300, 150], [-300, -110], [-120, -110], [-80, -40], [120, -40], [120, 150]];
    ctx.stroke(pathOf(wobble(cab, true, .8), true));
    [[-220, 150], [60, 150]].forEach(([wx, wy]) => ctx.stroke(pathOf(wobble(ell(wx, wy, 44, 44, 24), true, .6), true)));
    ctx.stroke(pathOf(wobble([[-280, -90], [-140, -90], [-110, -40], [-280, -40]], true, .6), true));
    // ışık + sensör kutusu
    ctx.stroke(pathOf(wobble(ell(-200, -126, 18, 16, 14, Math.PI, TAU), false, .4), false));
    ctx.fillStyle = 'rgba(255,59,47,.25)'; ctx.fillRect(-60, 40, 80, 60); ctx.strokeRect(-60, 40, 80, 60);
    ctx.setLineDash([10, 6]); ctx.stroke(pathOf(wobble([[-20, 40], [-20, -10], [-200, -10], [-200, -110]], false, .5), false)); ctx.stroke(pathOf(wobble([[-20, 100], [-20, 200], [60, 200]], false, .5), false)); ctx.setLineDash([]);
    // ölçü çizgisi
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-300, 228); ctx.lineTo(120, 228); ctx.moveTo(-300, 218); ctx.lineTo(-300, 238); ctx.moveTo(120, 218); ctx.lineTo(120, 238); ctx.stroke();
    ctx.restore();
    handwrite(ctx, 'SENSOR', -50, 30, 22, B, 41);
    handwrite(ctx, 'load / ground wrong', 40, 80, 22, B, 43);
    handwrite(ctx, '= beep beep = STOP', 40, 116, 26, P.beaconOn, 45, { bold: true });
    handwrite(ctx, '4.20 m', -110, 222, 20, B, 47);
    // antet kutusu
    shape(ctx, [[180, 170], [360, 170], [360, 250], [180, 250]], null, { lw: 2.4, ink: B }); line(ctx, [[180, 205], [360, 205]], 1.6, B, .2);
    ctx.font = '700 16px Rubik'; ctx.fillStyle = B; ctx.fillText('DAISY · ALARM', 192, 196); handwrite(ctx, 'sheet 2 / 2', 192, 236, 18, B, 49);
    ctx.restore();
  }
  // Liste lambaya tutulmuş (9. bölüm): arkadan ışık, 9 siyah satır çizili, 10. satır mavi karalama ve altında okunur adres.
  //  opts: x,y orta, s, rot, reveal (0..1 adresin görünürlüğü), address
  function drawListLamp(ctx, o) {
    o = o || {}; const P = P2, s = o.s || 1, W = 520, H = 700; seed(o.seed || 99); ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    const g = ctx.createRadialGradient(40, 60, 30, 40, 60, 520); g.addColorStop(0, 'rgba(255,226,150,.85)'); g.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = g; ctx.fillRect(-700, -800, 1400, 1600);
    shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2 + 6], [W / 2 - 4, H / 2], [-W / 2 + 4, H / 2 - 4]], '#f7e9c4', { lw: 4.4, shade: (c) => { const gg = c.createRadialGradient(40, 60, 20, 40, 60, 380); gg.addColorStop(0, 'rgba(255,250,225,.95)'); gg.addColorStop(1, 'rgba(217,180,120,.6)'); c.fillStyle = gg; c.fillRect(-W, -H, W * 2, H * 2); } });
    ctx.font = '400 40px "Lilita One"'; ctx.fillStyle = P.inkOld; ctx.textAlign = 'left';
    for (let i = 0; i < 10; i++) {
      const yy = -H / 2 + 80 + i * 60;
      handwrite(ctx, (i + 1) + '.', -W / 2 + 30, yy, 30, P.inkOld, 60 + i);
      if (i < 9) { for (let q = 0; q < 3; q++) { ctx.fillStyle = 'rgba(58,48,38,.75)'; ctx.fillRect(-W / 2 + 80 + q * 120, yy - 14, 90 + hrand(i * 3 + q) * 20, 5); } line(ctx, [[-W / 2 + 70, yy - 12], [W / 2 - 40, yy - 14]], 3, P.ink, .8); }
      else {
        ctx.save(); ctx.globalAlpha = .25 + .75 * (o.reveal == null ? 1 : o.reveal); handwrite(ctx, o.address || '7 Old Mill Lane', -W / 2 + 80, yy, 30, P.inkOld, 77); ctx.restore();
        ctx.save(); ctx.globalAlpha = 1 - .55 * (o.reveal == null ? 1 : o.reveal); ctx.strokeStyle = P.inkBlue; ctx.lineWidth = 7; ctx.lineJoin = 'round';
        const pts = []; for (let q = 0; q < 26; q++) pts.push([-W / 2 + 76 + q * 14, yy - 12 + (q % 2 ? -12 : 10) + (hrand(q) - .5) * 6]); ctx.stroke(pathOf(pts, false)); ctx.restore();
      }
    }
    ctx.restore();
  }

  G.Cizim = { PAL, seed, wobble, ell, pathOf, ink, shape, line, blot, grain, hazardStripes, drawKaan, drawDaisy, drawBackground, drawSubtitle,
    tube, face, EXPR, handwrite, drawDefne, drawHale, coffeeCup, waitChair, rainFx,
    drawYard, drawOffice, drawCabin, drawWaitingRoom, drawWaterTower, drawOldBuilding, drawHaleTower, drawCafe,
    drawLetter, drawNotebook, drawTin, drawStamp, drawSensorPlan, drawListLamp };
})(typeof window !== 'undefined' ? window : globalThis);
