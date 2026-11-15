/* Part 9 · THE EMPTY TOWER — Animatör A: cümle 1–12. Başlangıç 0, bitiş (S12.t1 + S13.t0) / 2 ≈ 26,12 sn.
   YERLEŞİM (dünya koordinatları; B aynı yerden devam eder):
   • KULE GECE (1–2): C.drawHaleTower {x:0,y:0,w:1080,h:1920,mode:'night',empty:true,towerX:.5,seed:9}: kule x 378–702, üst y 115, taban hz 1651,
     kat yüksekliği 38,4; giriş (lobi) x 475–605, y 1559–1651. Pencere ışıkları bu dosyada çizilir (drawHaleTower'ın gece deseni: hrand(k*6+q+9)<.35), tek tek söner.
   • SOKAK (gündüz, öğlen; kamera kuleye bakar): ufuk / kule tabanı HZ=1100; kule = drawHaleTower 'day' kulesinden kesilmiş görüntü, ölçek .55,
     orta x 540 → kule x 451–629, üst y 255 (anten ≈200), kat 21,1. Yol (450..630, 1100) → (−370..1450, 2160). Sol cephe uzak kenar x 330, sağ x 750.
     Perspektif ölçeği ps(y) = (y−1040)/880. Yıkım alanı TB.zone(540, 1112, 400, 64) (ön şerit y 1144, köşe direkleri x 340 / 740).
     BARİYER HATTI (Kaan'ın "çizgisi") y 1360, dört şeritli sehpa x 300, 450, 630, 780. Kaan (380,1400) s .9 · Defne (680,1400) s .9 · Daisy (860,1300) s .59.
     İzleyen kalabalık kaldırımlarda y 1165–1185 (sol x 280–390, sağ x 690–800). Yıkım: tl.cues.fall'da şarjlar, "forty"de iniş başlar, S11 başında kule tamamen tozun içinde.
     SON KARE (26,12): geniş plan cam z .9, merkez (540, 980): moloz yığını alanın içinde, büyük toz bulutu (henüz inmedi) → B tozun inişiyle devam eder.
     Toz fiziği dustAt(t) (blob listesi) window.P9A ile dışa açık.
   • TERS AÇI (bariyerin arkası, kameraya bakarlar): Kaan (300,1520) s 1.05, Defne (540,1520) s 1.05, Daisy (830,1480) s .8; bariyer önde y 1650.
   • GECE ODASI (7–9): pilot b-sahneler drawRoom ile aynı oda; Kaan (500,1880) s 2.5; komodin sağda x 950–1150, üst y 1170.
   Her şey timeline'dan (times()); karakterler ikişerli, kamera/ışık/toz birerli. Bu yarıda bip yok (bölüm "sessiz"). */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;
  const ones = t => Math.floor(t * FPS + 1e-6) / FPS;
  const D2R = Math.PI / 180;

  /* ================= ZAMANLAR ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1], c = tl.cues;
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const mid = i => (S(i).t1 + S(i + 1).t0) / 2;
    const k = {};
    k.c2 = mid(1);                                        // çalışanlar kahveyle
    k.lobbyOff = S(2).t1 - .12;                           // lobinin son ışığı söner: kule boş
    k.c3 = mid(2);                                        // takvim
    k.tear0 = k.c3 + .06; k.tearDt = Math.max(.08, (W(3, /^six/i, 2).t0 - .06 - k.tear0) / 5);
    k.c4 = mid(3);                                        // "Not us." gag
    k.grab = W(4, /^us/i, 1).t0 - .02;
    k.c5 = mid(4);                                        // uzmanlar, cihazlar
    k.c5b = W(5, /^from/i, 1).t0 - .1;                    // üç şehirden üç araç
    k.truck = [k.c5b + .04, W(5, /^three/i, 2).t0 - .3, W(5, /^cities/i, 3).t0 - .3];
    k.c6 = mid(5);                                        // sokağı boşalt: bariyer
    k.barSet = W(6, /^street/i, 6).t0 + .1;
    k.c6b = W(6, /^and/i, 7).t0 - .1;                     // çizginin arkasında bekle
    k.shift = W(6, /^wait/i, 8).t0;
    k.c7 = mid(6);                                        // gece odası
    k.look7 = W(7, /^open/i, 6).t0;
    k.c8 = mid(7);                                        // telefon ters çevrilir
    k.flip = W(8, /^practice/i, 4).t0 - .3;
    k.c9 = mid(8);                                        // yastığa düşer
    k.flop = W(9, /^needed/i, 1).t0 - .05;
    k.c10 = mid(9);                                       // öğlen, geniş
    k.fall = c.fall;
    k.sink0 = W(10, /^forty/i, 2).t0;                     // iniş başlar
    k.thump = k.sink0 + .3;                               // taban oturur: 6 kare sarsıntı
    k.sink1 = S(11).t0 - .1;                              // kule tamamen tozun içinde
    k.c10b = W(10, /^sat/i, 4).t0 + .18;                  // yakın: katlar tozun içine
    k.c11 = mid(10);                                      // "Slowly." omuz üstü
    k.c12 = mid(11);                                      // "Exactly..." alan şeridi
    k.pull = W(12, /^the$/i, 2).t0 - .15;
    k.end = mid(12);                                      // B ile ortak kesme
    K = k; return k;
  }
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });
  const blinkAt = (t, list) => list.some(b => t >= b && t < b + 3 / FPS) ? 1 : 0;

  /* ================= YARDIMCILAR ================= */
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
  function blurred(key, blur, fn) { return cached(key, 1080, 1920, c => { const tmp = canvas(1080, 1920); fn(tmp.getContext('2d')); c.filter = `blur(${blur}px)`; c.drawImage(tmp, -20, -20, 1120, 1960); c.filter = 'none'; }); }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function glow(ctx, x, y, r, rgb, a) { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 4, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore(); }
  let darkCv = null;
  function nightLight(ctx, holes, a, col) {
    if (!darkCv) darkCv = canvas(1080, 1920);
    const d = darkCv.getContext('2d'); d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, 1080, 1920);
    d.fillStyle = col || `rgba(4,6,16,${a})`; d.fillRect(0, 0, 1080, 1920); d.globalCompositeOperation = 'destination-out';
    holes.forEach(([x, y, r, s]) => { const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(.55, `rgba(0,0,0,${s * .55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(x - r, y - r, 2 * r, 2 * r); });
    d.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkCv, 0, 0); ctx.restore();
  }
  function airDust(ctx, t, n, sb, box, a, col) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(${col || '216,202,176'},${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }
  function shake(ctx, t, t0, amp) {
    const f = Math.floor((t - t0) * FPS + 1e-6);
    if (f >= 0 && f < 6) { const a = (amp || 14) * (1 - f / 6); ctx.translate((rnd(900 + f) - .5) * 2 * a, (rnd(950 + f) - .5) * 2 * a); }
  }
  // Toz bulutu (pilot/p7-b ile aynı): mürekkep kontur + koyu gölge + açık yüz, bütün olarak saydam.
  let dustCv = null;
  function dustCloud(ctx, blobs, alpha, raw) {
    if (!blobs.length || alpha <= .01) return;
    if (!dustCv) dustCv = canvas(1080, 1920);
    const d = dustCv.getContext('2d'), m = ctx.getTransform();
    d.setTransform(1, 0, 0, 1, 0, 0); d.clearRect(0, 0, 1080, 1920); d.setTransform(m);
    d.globalAlpha = .35; d.fillStyle = P.ink; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x, y, r + 3, 0, TAU); d.fill(); }); d.globalAlpha = 1;
    d.fillStyle = P.dust; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill(); });
    d.fillStyle = P.dustLt; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x - r * .16, y - r * .2, r * .8, 0, TAU); d.fill(); });
    d.fillStyle = 'rgba(241,232,212,.35)'; blobs.forEach(([x, y, r]) => { d.beginPath(); d.arc(x - r * .3, y - r * .38, r * .38, 0, TAU); d.fill(); });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = raw ? alpha : alpha * .8; ctx.drawImage(dustCv, 0, 0); ctx.restore();
  }

  /* ================= SİVİLLER (kuleden çıkan çalışanlar; yeni figür, aynı üslup) ================= */
  const CIV = [
    { coat: '#6b6f7a', coatDk: '#4f525b', pants: '#3a3d45', hair: '#2a1d16', skin: '#d9a27a', hairK: 0 },
    { coat: '#7a3b3b', coatDk: '#5a2a2a', pants: '#4a4036', hair: '#5a3220', skin: '#c68a5e', hairK: 1 },
    { coat: '#7a5a3c', coatDk: '#5b4229', pants: '#33363d', hair: '#8e897f', skin: '#e2b48e', hairK: 2 },
    { coat: '#5d6b4a', coatDk: '#465236', pants: '#3a3d45', hair: '#1d1410', skin: '#a0663f', hairK: 3 },
    { coat: '#8a8478', coatDk: '#6a655b', pants: '#2c2f36', hair: '#3a2418', skin: '#d9a27a', hairK: 1 }
  ];
  // Ayak ortası (x,y), yerel boy ≈ 530. o: s, look (palet), item 'coffee'|'box'|'bag'|'plant'|null, ph (yürüyüş evresi), expr, look, blink, flip, dark (gece silueti)
  function civ(ctx, o) {
    const s = o.s, pl = CIV[o.look % CIV.length], dark = o.dark, lw = 5 / Math.sqrt(Math.max(s, .05));
    const F = c => dark ? '#121622' : c, sw = Math.sin(o.ph || 0), bob = Math.abs(Math.cos(o.ph || 0)) * 5;
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.flip ? -s : s, s); C.seed(o.seed || 600);
    if (!dark) { ctx.save(); ctx.globalAlpha = .2; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 70, 11, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.translate(0, -bob);
    const legs = [[-18, -1], [18, 1]];
    legs.forEach(([hx, d], i) => {
      const fx = hx + d * sw * 30, fy = bob - 10;
      C.tube(ctx, [[hx, -250], [hx + d * sw * 14, -130], [fx, fy]], 36, 30, F(i ? pl.pants : '#2a2c33'), lw);
      C.shape(ctx, C.ell(fx + 10, fy + 2, 26, 12, 12), F('#3a2416'), { lw });
    });
    C.tube(ctx, [[-56, -392], [-66 - sw * 10, -320], [-62 - sw * 22, -252]], 32, 26, F(pl.coatDk), lw);
    if (o.item !== 'box') C.shape(ctx, C.ell(-62 - sw * 22, -244, 13, 14, 12), F(pl.skin), { lw });
    C.shape(ctx, [[-60, -404], [58, -404], [68, -236], [-68, -236]], F(pl.coat), { lw, shade: c => { if (!dark) C.blot(c, [[30, -410], [76, -410], [76, -230], [36, -230]], pl.coatDk, .55); } });
    if (!dark) { C.line(ctx, [[0, -398], [2, -240]], lw * .5); C.shape(ctx, [[-26, -406], [0, -372], [26, -406]], pl.coatDk, { lw: lw * .7 }); }
    C.shape(ctx, [[-13, -428], [15, -428], [16, -398], [-13, -396]], F(pl.skin), { lw });
    // baş + saç
    C.shape(ctx, C.ell(2, -466, 40, 48, 26), F(pl.skin), { lw, shade: c => { if (!dark) C.blot(c, [[24, -520], [50, -520], [50, -416], [22, -420]], 'rgba(120,70,40,1)', .25); } });
    const hk = pl.hairK;
    if (hk === 0) C.shape(ctx, [[-42, -470], [-40, -503], [-20, -518], [20, -518], [42, -500], [44, -470], [30, -492], [-30, -490]], F(pl.hair), { lw });
    else if (hk === 1) C.shape(ctx, [[-44, -420], [-46, -490], [-24, -518], [24, -518], [46, -490], [44, -420], [34, -440], [32, -490], [-30, -490], [-34, -440]], F(pl.hair), { lw });
    else if (hk === 2) { C.shape(ctx, [[-42, -450], [-42, -482], [-32, -488], [-30, -456]], F(pl.hair), { lw: lw * .8 }); C.shape(ctx, [[44, -450], [44, -482], [34, -488], [32, -456]], F(pl.hair), { lw: lw * .8 }); }
    else C.shape(ctx, [[-44, -478], [-40, -510], [-14, -526], [18, -526], [42, -510], [46, -478]], F(pl.hair), { lw });
    if (!dark) C.face(ctx, o.expr || 'calm', { L: [-12, -466], R: [18, -466], m: [4, -436], k: .9, lw, look: o.lk, blink: o.blink });
    // ön kol + eşya
    const it = o.item;
    if (it === 'coffee') { C.tube(ctx, [[56, -392], [78, -330], [44, -302]], 32, 26, F(pl.coat), lw); C.coffeeCup(ctx, 40, -312, lw, 1.5); C.shape(ctx, C.ell(48, -300, 13, 14, 12), F(pl.skin), { lw }); }
    else if (it === 'box' || it === 'plant') {
      C.tube(ctx, [[56, -392], [72, -330], [60, -300]], 32, 26, F(pl.coat), lw);
      if (it === 'plant') { ctx.save(); [-30, -8, 16, 34].forEach((a, j) => { C.seed(640 + j); C.shape(ctx, [[a * .3, -350], [a - 14, -420 - j % 2 * 20], [a + 4, -430 - j % 2 * 20], [a * .3 + 8, -350]], dark ? '#1c2420' : '#5d7a3a', { lw: lw * .7 }); }); ctx.restore(); }
      C.shape(ctx, [[-72, -356], [72, -356], [76, -262], [-76, -262]], dark ? '#2e261d' : P.box, { lw, shade: c => { if (!dark) C.blot(c, [[30, -360], [80, -360], [80, -258], [36, -258]], P.boxDk, .6); } });
      if (!dark) C.line(ctx, [[-60, -340], [60, -340]], lw * .5, P.boxDk, .3);
      C.shape(ctx, C.ell(-74, -300, 13, 14, 12), F(pl.skin), { lw }); C.shape(ctx, C.ell(74, -300, 13, 14, 12), F(pl.skin), { lw });
    } else if (it === 'bag') {
      C.tube(ctx, [[56, -392], [68 + sw * 6, -320], [66 + sw * 12, -252]], 32, 26, F(pl.coat), lw);
      C.shape(ctx, [[48 + sw * 12, -250], [100 + sw * 12, -250], [104 + sw * 12, -170], [44 + sw * 12, -170]], dark ? '#2a2118' : '#5e3b1d', { lw });
      C.shape(ctx, C.ell(66 + sw * 12, -246, 13, 14, 12), F(pl.skin), { lw });
    } else { C.tube(ctx, [[56, -392], [66 + sw * 10, -320], [62 + sw * 22, -252]], 32, 26, F(pl.coat), lw); C.shape(ctx, C.ell(62 + sw * 22, -244, 13, 14, 12), F(pl.skin), { lw }); }
    ctx.restore();
  }

  /* ================= KULE GECE (1–2) ================= */
  const TN = { tx: 378, tw: 324, hz: 1920 * .86, fh: 1920 * .8 / 40, ex: 378 + 324 * .3, ew: 324 * .4 };
  TN.eh = TN.fh * 2.4;
  function towerNight() { return cached('p9-kule-gece', 1080, 1920, g => C.drawHaleTower(g, { x: 0, y: 0, w: 1080, h: 1920, mode: 'night', empty: true, towerX: .5, seed: 9 })); }
  const litWin = (k, q) => rnd(k * 6 + q + 9) < .35;          // drawHaleTower'ın gece deseniyle aynı
  const winOff = (k, q) => .2 + rnd(9100 + k * 6 + q) * 3.7;    // her pencere kendi anında söner (0,2–3,9 sn)
  function towerLights(ctx, t) {
    const th = ones(t);
    ctx.save();
    for (let k = 0; k < 40; k++) for (let q = 0; q < 6; q++) {
      if (!litWin(k, q)) continue; const off = winOff(k, q); if (th >= off + 2 / FPS) continue;
      const a = th >= off ? .35 : 1, x = TN.tx + TN.tw * q / 6 + 3, y = TN.hz - (k + 1) * TN.fh + 3;
      ctx.fillStyle = `rgba(255,210,122,${.8 * a})`; ctx.fillRect(x, y, TN.tw / 6 - 6, TN.fh - 5);
      ctx.fillStyle = `rgba(255,236,190,${.35 * a})`; ctx.fillRect(x + 4, y + 3, 8, TN.fh - 11);
    }
    ctx.restore();
  }
  function lobby(ctx, on) {    // lobi içi: sıcak ışık, cam kapı kasası; ışık yerde öne doğru
    const { ex, ew, eh, hz } = TN;
    ctx.save();
    if (on > 0) {
      const g = ctx.createLinearGradient(0, hz - eh, 0, hz); g.addColorStop(0, `rgba(255,214,140,${.9 * on})`); g.addColorStop(1, `rgba(255,190,110,${.95 * on})`);
      ctx.fillStyle = g; ctx.fillRect(ex + 2, hz - eh + 2, ew - 4, eh - 3);
      ctx.globalCompositeOperation = 'lighter';
      const sp = ctx.createLinearGradient(0, hz, 0, hz + 220); sp.addColorStop(0, `rgba(255,200,120,${.38 * on})`); sp.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = sp; ctx.beginPath(); ctx.moveTo(ex, hz); ctx.lineTo(ex + ew, hz); ctx.lineTo(ex + ew + 150, hz + 230); ctx.lineTo(ex - 150, hz + 230); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    C.seed(911); C.line(ctx, [[ex + ew / 2, hz - eh], [ex + ew / 2, hz]], 2.4, P.ink, .3);
    C.line(ctx, [[ex + ew * .25, hz - eh * .55], [ex + ew * .25, hz - eh * .35]], 2, P.ink, .2); C.line(ctx, [[ex + ew * .75, hz - eh * .55], [ex + ew * .75, hz - eh * .35]], 2, P.ink, .2);
    ctx.restore();
  }
  // Kapıdan çıkan insanlar: içeriden (kapı içine kırpılı, küçük) gelir, eşikten çıkıp sağa/sola dağılır.
  const CROWD = [];
  for (let i = 0; i < 13; i++) CROWD.push({ ts: -2.2 + i * .34 + rnd(700 + i) * .12, dir: (i % 2 ? -1 : 1) * (rnd(710 + i) < .2 ? -1 : 1), dy: 16 + rnd(720 + i) * 100, x0: 540 + (rnd(730 + i) - .5) * 70, item: ['box', 'bag', 'coffee', 'plant', null][i % 5], look: i % 5, v: 46 + rnd(740 + i) * 14 });
  function doorPeople(ctx, t) {
    const tw = twos(t), { ex, ew, eh, hz } = TN, list = [];
    CROWD.forEach((c, i) => {
      const p = (tw - c.ts) * c.v; if (p < -40) return;
      const inside = p < 0, fwd = clamp(p, 0, c.dy), side = Math.max(0, p - c.dy);
      const x = c.x0 + c.dir * side * 1.15, y = hz + fwd + (inside ? p * .15 : 0), s = .15 * (1 + (y - hz) / 160 * .5) * (inside ? 1 + p / 160 : 1);
      if (x < 200 || x > 880) return;
      list.push({ y, f: () => {
        if (inside) { ctx.save(); ctx.beginPath(); ctx.rect(ex + 2, hz - eh + 2, ew - 4, eh); ctx.clip(); }
        civ(ctx, { x, y: inside ? hz : y, s, look: c.look, item: c.item, ph: p * .16, flip: side > 0 && c.dir < 0, dark: true, seed: 600 + i });
        if (inside) ctx.restore();
      } });
    });
    list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  }

  /* ================= KULE SAHASI (gündüz) — p9-b.js SITE yerleşimiyle birebir, geniş planlar için yanlara/yukarı uzatılmış ================= */
  const SITE = { hz: 1080, zx: 540, zy: 1185, zw: 760, zh: 190 };
  const HZ = SITE.hz, TBY = 1150, TS = 1.42;                    // kule tabanı y 1150, kule x 310–770
  const ps = y => (y - 1080) / 1095;                             // B'nin ekip/kalabalık ölçeği (480 birimlik insan)
  // B'nin yardımcıları (kopya): uzak insan, kalabalık, ekip, şerit hattı, toz boyaması
  const CROWD_COL = ['#7d4f3f', '#3f6f8f', '#8a7a62', '#5b8a5a', '#a0663f', '#46505c', '#b4532f', '#6d6a8a', '#c9a26b', '#2c3a5e'];
  function person(ctx, x, y, s, sd, clap, cheer) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd);
    const col = CROWD_COL[sd % CROWD_COL.length], skin = ['#c68a5e', '#e2b48e', '#a0663f', '#d9a27a'][sd % 4], lw = 6;
    C.shape(ctx, [[-30, -10], [-26, -150], [26, -150], [30, -10]], '#3a3d45', { lw, amp: .4 });
    C.shape(ctx, [[-40, -140], [-34, -260], [34, -260], [40, -140]], col, { lw, amp: .4 });
    if (cheer) { C.line(ctx, [[-30, -250], [-60, -320], [-50, -380]], 14, col, .3); C.line(ctx, [[30, -250], [60, -320], [50, -380]], 14, col, .3); }
    else {
      const hx = clap ? 4 : 24;
      C.line(ctx, [[-30, -250], [-44, -200], [-hx, -220]], 14, col, .3); C.line(ctx, [[30, -250], [44, -200], [hx, -224]], 14, col, .3);
      C.shape(ctx, C.ell(-hx, -222, 9, 9, 8), skin, { lw: lw * .7, amp: .2 }); C.shape(ctx, C.ell(hx, -226, 9, 9, 8), skin, { lw: lw * .7, amp: .2 });
    }
    C.shape(ctx, C.ell(0, -296, 30, 34, 14), skin, { lw, amp: .3 });
    if (sd % 3 === 0) C.shape(ctx, [[-30, -306], [-24, -330], [24, -330], [30, -306]], P.helmet, { lw: lw * .8, amp: .2 });
    else C.shape(ctx, [[-30, -300], [-26, -326], [0, -334], [26, -326], [30, -300], [20, -312], [-20, -312]], ['#2a1d16', '#4a2418', '#8e897f', '#2a1d16'][sd % 4], { lw: lw * .7, amp: .2 });
    ctx.restore();
  }
  // still=true: alkış yok (yıkım boyunca sessiz izlerler); alkış "engineers wanted"da başlar, B sürdürür
  function crowd(ctx, t, x0, x1, y, s, sd, gap, amp, still) {
    const tw = twos(t); let i = 0;
    for (let x = x0; x < x1; x += gap) {
      const r = j => rnd(sd * 100 + i * 7 + j), px = x + (r(1) - .5) * gap * .5, py = y + (r(2) - .5) * 26, pss = s * (.9 + r(3) * .2);
      const clap = still ? false : Math.floor(tw * (6 + r(4) * 3) + r(5) * 2) % 2 === 0, cheer = still ? false : r(6) < (amp || .12);
      person(ctx, px, py - (cheer && clap ? 6 : 0), pss, sd * 50 + i, clap, cheer && r(7) < .6 ? clap : false);
      i++;
    }
  }
  function worker(ctx, x, y, s, sd, ph, flag) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd);
    const lw = 5 / Math.sqrt(s), body = '#46505c', bodyDk = '#343c46';
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 70, 11, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.shape(ctx, [[-34, -220], [-4, -220], [-10, -10], [-40, -10]], bodyDk, { lw }); C.shape(ctx, [[4, -220], [34, -220], [40, -10], [10, -10]], body, { lw });
    C.shape(ctx, [[-46, -14], [-6, -14], [0, 0], [-50, 0]], P.bootDk, { lw }); C.shape(ctx, [[8, -14], [46, -14], [54, 0], [6, 0]], P.bootDk, { lw });
    C.tube(ctx, [[-50, -360], [-66, -290], [-60, -228]], 34, 28, bodyDk, lw);
    C.shape(ctx, [[-56, -372], [56, -372], [62, -220], [-62, -220]], '#e0672a', { lw, shade: c => C.blot(c, [[20, -380], [70, -380], [70, -210], [26, -210]], '#b44e1c', .6) });
    C.line(ctx, [[-58, -290], [58, -290]], 7, P.paper, .3); C.line(ctx, [[-20, -372], [-20, -222]], 6, P.paper, .3); C.line(ctx, [[20, -372], [20, -222]], 6, P.paper, .3);
    if (flag) { C.tube(ctx, [[50, -360], [80, -400], [96, -450 + Math.sin(ph) * 10]], 34, 28, body, lw); C.shape(ctx, C.ell(98, -462 + Math.sin(ph) * 10, 14, 14, 10), '#a87a56', { lw: lw * .8 }); }
    else C.tube(ctx, [[50, -360], [66, -290], [60, -228]], 34, 28, body, lw);
    C.shape(ctx, C.ell(0, -414, 36, 40, 18), '#a87a56', { lw });
    C.shape(ctx, [[-44, -430], [-38, -462], [-16, -478], [16, -478], [38, -462], [44, -430], [52, -428], [52, -420], [-52, -420], [-52, -428]], P.helmet, { lw, shade: c => C.blot(c, [[10, -480], [56, -480], [56, -418], [18, -418]], P.helmetDk, .7) });
    ctx.restore();
  }
  // B'nin "the line" hattı; xEnd verilirse şerit yalnız x0..xEnd arası (Kaan şeridi çekerken)
  function barrierLine(ctx, x0, x1, gy, ph, postGap, lw, xEnd) {
    lw = lw || 4; postGap = postGap || 260;
    for (let x = x0; x <= x1; x += postGap) { C.seed(2900 + Math.round(x)); C.line(ctx, [[x, gy - ph], [x + 2, gy]], lw * 2.6, P.ink, .3); C.line(ctx, [[x, gy - ph], [x + 2, gy]], lw * 1.1, '#d9c2a0', .2); }
    const n = Math.ceil((x1 - x0) / (lw * 7)), xe = xEnd == null ? x1 : xEnd;
    for (let q = 0; q < n; q++) {
      const a = x0 + q * (x1 - x0) / n, b0 = x0 + (q + 1) * (x1 - x0) / n; if (a >= xe) break; const b = Math.min(b0, xe), sag = u => Math.sin(((u - x0) % postGap) / postGap * Math.PI) * ph * .07;
      ctx.strokeStyle = q % 2 ? P.ink : P.hazard; ctx.lineWidth = lw * 2.6; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(a, gy - ph * .82 + sag(a)); ctx.lineTo(b, gy - ph * .82 + sag(b)); ctx.stroke();
    }
  }
  function airDustB(ctx, t, n, sb, box, a, col) {   // B'nin airDust'ı (aynı renk ve boy)
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(${col || '241,232,212'},${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }
  // gök (canlı, B'nin degradesi; −140'ın üstü aynı rengin koyulaşan uzantısı)
  function siteSky(ctx) {
    const g = ctx.createLinearGradient(0, -140, 0, SITE.hz); g.addColorStop(0, '#9fbfd6'); g.addColorStop(.6, '#cfd6d2'); g.addColorStop(1, '#ead9b8');
    ctx.fillStyle = g; ctx.fillRect(-1400, -140, 4000, SITE.hz + 142);
    const g2 = ctx.createLinearGradient(0, -2600, 0, -140); g2.addColorStop(0, '#86aac6'); g2.addColorStop(1, '#9fbfd6'); ctx.fillStyle = g2; ctx.fillRect(-1400, -2600, 4000, 2461);
    ctx.fillStyle = P.cloud; ctx.globalAlpha = .85;
    [[-260, -560, 1.6], [1180, -300, 1.2], [260, -1300, 1.9], [1500, -1500, 1.5]].forEach(([cx, cy, sc]) => [[0, 0, 70, 24], [-56, 8, 46, 18], [52, 6, 50, 20], [10, -16, 44, 22]].forEach(([a, b, rx, ry]) => { ctx.beginPath(); ctx.ellipse(cx + a * sc, cy + b * sc, rx * sc, ry * sc, 0, 0, TAU); ctx.fill(); }));
    ctx.globalAlpha = 1;
  }
  // zemin katmanı (önbellek, saydam gök): B'nin siteBase'i (silüet, pus, zemin, lekeler, TB.zone, uzak bariyer) — enkaz ayrı
  const SB = { x: -1260, y: 300, w: 3600, h: 2900 };
  function siteGround() {
    return cached('p9-saha', SB.w, SB.h, g => {
      g.translate(-SB.x, -SB.y);
      [[P.far2, 160, 420, 300], [P.far, 70, 240, 310]].forEach(([col, hmin, hmax, sd], li) => {
        const bld = (cx, bw, bh, s) => { C.seed(s); C.shape(g, [[cx, SITE.hz], [cx, SITE.hz - bh], [cx + bw, SITE.hz - bh], [cx + bw, SITE.hz]], col, { lw: 1.8, ink: P.far2, amp: .4, shade: c => { c.fillStyle = 'rgba(211,218,222,.55)'; for (let yy = SITE.hz - bh + 12; yy < SITE.hz - 10; yy += 18) for (let xx = cx + 8; xx < cx + bw - 8; xx += 16) if (rnd(xx * 3 + yy) < .4) c.fillRect(xx, yy, 6, 8); } }); };
        let cx = -170, n = 0; while (cx < 2340) { const bw = 50 + rnd(sd + n) * 90, bh = hmin + rnd(sd + 50 + n) * (hmax - hmin); if (li === 0 || cx < 230 || cx > 820) bld(cx, bw, bh, sd + n); cx += bw + 4; n++; }
        cx = -170; n = 0; while (cx > -1270) { const bw = 50 + rnd(sd + 900 + n) * 90, bh = hmin + rnd(sd + 950 + n) * (hmax - hmin); cx -= bw + 4; bld(cx, bw, bh, sd + 900 + n); n++; }
      });
      const hzg = g.createLinearGradient(0, SITE.hz - 260, 0, SITE.hz); hzg.addColorStop(0, 'rgba(234,217,184,0)'); hzg.addColorStop(1, 'rgba(234,217,184,.7)'); g.fillStyle = hzg; g.fillRect(SB.x, SITE.hz - 260, SB.w, 260);
      const gg = g.createLinearGradient(0, SITE.hz, 0, 2060); gg.addColorStop(0, '#c9bfae'); gg.addColorStop(.25, P.ground); gg.addColorStop(1, P.groundDk); g.fillStyle = gg; g.fillRect(SB.x, SITE.hz, SB.w, 2060 - SITE.hz);
      g.fillStyle = P.groundDk; g.fillRect(SB.x, 2059, SB.w, SB.y + SB.h - 2059);
      for (let i = 0; i < 26; i++) C.blot(g, C.ell(-150 + rnd(5100 + i) * 1380, 1150 + rnd(5200 + i) * 900, 50 + rnd(5300 + i) * 110, 8 + rnd(5400 + i) * 12, 12), i % 2 ? P.groundDk : P.groundLt, .22);
      for (let i = 0; i < 40; i++) { const x = rnd(5450 + i) < .5 ? -1250 + rnd(5460 + i) * 1100 : 1240 + rnd(5470 + i) * 1100; C.blot(g, C.ell(x, 1150 + rnd(5480 + i) * 1900, 50 + rnd(5490 + i) * 110, 8 + rnd(5495 + i) * 12, 12), i % 2 ? P.groundDk : P.groundLt, .22); }
      TB.zone(g, SITE.zx, SITE.zy, SITE.zw, SITE.zh, 1);
      barrierLine(g, -160, 300, 1320, 46, 120, 2.6); barrierLine(g, 790, 1240, 1320, 46, 120, 2.6);
      barrierLine(g, -1240, -160, 1320, 46, 120, 2.6); barrierLine(g, 1240, 2320, 1320, 46, 120, 2.6);
    });
  }
  // enkaz tepesi: B'nin siteBase'indeki yığının birebir kopyası (saydam katman); çöküş sırasında aşağıdan yukarı belirir
  function pileLayer() {
    return cached('p9-yigin', 800, 420, g => {
      g.translate(-150, -880); C.seed(5601);
      C.shape(g, [[210, 1215], [260, 1150], [330, 1120], [400, 1090], [470, 1060], [540, 1050], [610, 1062], [690, 1092], [770, 1130], [840, 1170], [870, 1215]], P.concreteDk, { lw: 3.6, shade: c => { C.blot(c, [[560, 1040], [900, 1100], [900, 1230], [600, 1230]], P.dustDk, .5); } });
      for (let i = 0; i < 46; i++) { const r = j => rnd(5700 + i * 5 + j), x = 240 + r(1) * 600, y = 1210 - (1 - Math.pow((x - 540) / 320, 2)) * 150 * r(2), w = 14 + r(3) * 40; C.seed(5800 + i); C.shape(g, [[x - w / 2, y], [x + w / 2, y - r(4) * 10], [x + w / 2 - 4, y - 12 - r(5) * 16], [x - w / 2 + 6, y - 10 - r(6) * 10]], [P.concrete, P.dustLt, P.glassT, P.concreteDk, P.steelDk][i % 5], { lw: 2.2, amp: .4 }); }
      [[430, 1080, -.5, 120], [600, 1065, .35, 140], [520, 1060, .1, 90], [700, 1110, .8, 100]].forEach(([x, y, a, L], i) => { C.seed(5900 + i); C.line(g, [[x, y], [x + Math.sin(a) * L, y - Math.cos(a) * L]], 9, P.steelDk, .4); });
      C.seed(5990); C.line(g, [[210, 1215], [870, 1215]], 3, P.ink, .6);
    });
  }
  function pile(ctx, f) {
    if (f <= .02) return; const top = lerp(1222, 880, E.outQ(clamp((f - .02) / .98)));
    ctx.save(); ctx.beginPath(); ctx.rect(-3000, top, 6000, 3000); ctx.clip(); ctx.drawImage(pileLayer(), 150, 880); ctx.restore();
  }
  // Kule görüntüsü: drawHaleTower 'day' kulesinden kesilir (gök piksel dışı); taban ortası kaynakta (540, 1651)
  let TSPR = null;
  function towerSprite() {
    if (TSPR) return TSPR;
    const a = canvas(1080, 1920), g = a.getContext('2d');
    C.drawHaleTower(g, { x: 0, y: 0, w: 1080, h: 1920, mode: 'day', towerX: .5, seed: 9 });
    const tx = 378, tw = 324, hz = Math.floor(TN.hz), ty = TN.hz - 1536, x0 = 366, w = 348, y0 = 0, h = hz + 1;
    const src = g.getImageData(x0, y0, w, h), O = new ImageData(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4, X = x0 + xx, Y = y0 + yy, r = src.data[i], gg = src.data[i + 1], b = src.data[i + 2], lum = r * .3 + gg * .59 + b * .11;
      const core = X >= tx + 2 && X <= tx + tw - 2 && Y >= ty + 2;
      const edge = X >= tx - 6 && X <= tx + tw + 6 && Y >= ty - 6 && lum < 110;
      const ant = Y < ty && Math.abs(X - 540) < 12 && (lum < 110 || (r > 180 && gg < 120));
      if (core || edge || ant) { O.data[i] = r; O.data[i + 1] = gg; O.data[i + 2] = b; O.data[i + 3] = 255; }
    }
    const cv = canvas(w, h); cv.getContext('2d').putImageData(O, 0, 0);
    TSPR = { cv, ox: 540 - x0, oy: TN.hz - y0, w, h }; return TSPR;
  }
  const TH = 1536 * TS, TTOP = TBY - TH, FH = TN.fh * TS;        // 2181; üst y −1031; kat 54,5
  function dropFrac(t) {   // kulenin inişi: kısa ivmelenme, sonra ağır ve düzenli
    const k = times(), u = seg(t, k.sink0, k.sink1), a = .2;
    return u < a ? u * u / (2 * a) / (1 - a / 2) : (u - a / 2) / (1 - a / 2);
  }
  function tAtDrop(f) { const k = times(), a = .2, f0 = a / 2 / (1 - a / 2); const u = f < f0 ? Math.sqrt(f * (1 - a / 2) * 2 * a) : f * (1 - a / 2) + a / 2; return lerp(k.sink0, k.sink1, u); }
  function drawTower(ctx, f) {
    const sp = towerSprite(), d = TH * f;
    ctx.save(); ctx.beginPath(); ctx.rect(-3000, -4000, 6000, TBY + 3 + 4000); ctx.clip();
    ctx.drawImage(sp.cv, 540 - sp.ox * TS, TBY - sp.oy * TS + d, sp.w * TS, sp.h * TS);
    ctx.restore();
  }
  // şarj pufları (ateş yok): alt katlarda ve ortada, küçük ve beyaz
  const CHG = [[1, -1], [1, 1], [2, -1], [2, 1], [3, -1], [3, 1], [12, -1], [12, 1], [24, -1], [24, 1]];
  function charges(ctx, t) {
    const k = times(), d = TH * dropFrac(t);
    CHG.forEach(([fl, sd], j) => {
      const tau = t - (k.fall + .12 + (j >> 1) * .09); if (tau < 0 || tau > 2.2) return;
      const x = 540 + sd * 232, y = TBY - fl * FH + (fl > 3 ? d : 0), r = 8 + 40 * E.outC(clamp(tau / .45)), a = clamp(1 - tau / 2.2);
      if (y > TBY) return;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(21,18,13,.35)'; ctx.beginPath(); ctx.arc(x + sd * r * .4, y, r + 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f1e8d4'; ctx.beginPath(); ctx.arc(x + sd * r * .4, y, r, 0, TAU); ctx.fill(); ctx.restore();
    });
  }
  // Toz: tabandan yükselir; her kat zemine geldikçe yanlardan yeni puf (kat kat). Yatayda alanın içinde kalır.
  function dustA(t) {
    const k = times(), tau = t - k.thump; if (tau < 0) return [];
    const blobs = [], N = 150, settle = E.io(seg(t, k.c12, k.end + 2));
    for (let i = 0; i < N; i++) {
      const r = j => rnd(31000 + i * 17 + j), fr = i / N, d0 = tAtDrop(fr * .97) - k.thump, tt = tau - Math.max(0, d0) - r(7) * .08; if (tt < 0) continue;
      const side = r(1) < .5 ? -1 : 1, x0 = 540 + side * (60 + r(2) * 170), vx = side * (40 + r(3) * 100);
      const R0 = 50 + r(4) * r(4) * 130 + fr * 40, rise = (60 + fr * 620 + r(5) * 200) * (1 - .45 * settle);
      const grow = E.outC(clamp(tt / (1 + r(6) * .6))), rad = R0 * (.3 + .7 * grow) * (1 + .05 * tt);
      const y = 1205 - rise * (1 - Math.exp(-tt / 1.4)), x = x0 + vx * (1 - Math.exp(-tt * 1.3)) / 1.3 + Math.sin(tt * .8 + i) * 8;
      blobs.push([x, y, rad]);
    }
    return blobs;
  }
  function dustBlend(t) {   // B'nin siteDust'ı (kesmede B'nin ilk karesiyle aynı toz) — kesmeden önce ona karışır
    const k = times(), u = clamp((t - k.end + .6) / 2.4), blobs = [];
    for (let i = 0; i < 44; i++) {
      const r = j => rnd(6100 + i * 9 + j), x = SITE.zx + (r(1) - .5) * SITE.zw * .92 * (.6 + .4 * u), base = 1210 - r(2) * 60;
      const hgt = (20 + r(3) * r(3) * 380) * (1 - .75 * E.outQ(u)), rad = (60 + r(4) * 120) * (1 - .3 * u);
      blobs.push([x + Math.sin(t * .4 + r(5) * 6) * 10, base - hgt, rad]);
    }
    return { blobs, a: 1 - .3 * E.io(u) };
  }
  function siteDustDraw(ctx, t) {
    const k = times(), w = E.io(seg(t, k.end - 1.0, k.end - .04));
    if (w < 1) dustCloud(ctx, dustA(t), .85 * (1 - w));
    if (w > 0) { const b = dustBlend(t); dustCloud(ctx, b.blobs, b.a * w, true); }
  }
  // Kaan arkadan / Defne arkadan (sahada, şeridin bu yanında)
  function defneBack(ctx, o) {
    C.drawDefne(ctx, Object.assign({ seed: 31 }, o));
    const s = (o.s || 1) * .9; ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s); const lw = 5.2 / Math.sqrt(s); C.seed(3131);
    C.shape(ctx, [[-54, -398], [54, -398], [50, -300], [48, -234], [-48, -234], [-50, -300]], P.vest, { lw, shade: c => C.blot(c, [[24, -400], [60, -400], [60, -230], [28, -230]], P.vestDk, .6) });
    C.shape(ctx, C.ell(2, -470, 43, 51, 26), P.dHair, { lw, shade: c => C.blot(c, [[20, -530], [60, -530], [60, -410], [24, -420]], '#2a120a', .4) });
    C.shape(ctx, C.ell(-6, -538, 24, 21, 20), P.dHair, { lw }); C.line(ctx, [[-30, -548], [8, -566]], lw * .8, P.pencil, .2);
    ctx.restore();
  }
  // Kamyon (arkadan): alt orta (x,y), s; renk ve kapı amblemi (şehir başına farklı biçim; yazı yok)
  const TRUCKS = [{ col: '#eeeae0', dk: '#c9c3b4', band: '#b8322a', mark: 0, x0: 120, x: 300, y: 1360 }, { col: '#7d8a6a', dk: '#5f6b4f', band: '#efe6d6', mark: 1, x0: 560, x: 560, y: 1335 }, { col: '#c46a3a', dk: '#9a4f28', band: '#15120d', mark: 2, x0: 1000, x: 800, y: 1375 }];
  function truck(ctx, tr, x, y, s, wob) {
    ctx.save(); ctx.translate(x, y + wob); ctx.scale(s, s); C.seed(1400 + tr.mark); const lw = 4.6 / Math.sqrt(Math.max(s, .1));
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(0, 0, 290, 26, 0, 0, TAU); ctx.fill(); ctx.restore();
    [-1, 1].forEach(d => C.shape(ctx, [[d * 150, -70], [d * 236, -70], [d * 236, 0], [d * 150, 0]], P.tire, { lw }));
    C.shape(ctx, [[-200, -600], [200, -600], [204, -560], [-204, -560]], tr.dk, { lw });
    C.shape(ctx, [[-252, -560], [252, -560], [252, -78], [-252, -78]], tr.col, { lw, shade: c => C.blot(c, [[150, -570], [262, -570], [262, -70], [160, -70]], tr.dk, .6) });
    C.line(ctx, [[0, -548], [0, -96]], lw * .8); [-1, 1].forEach(d => C.line(ctx, [[d * 26, -330], [d * 26, -260]], lw * 1.2, P.steelDk, .2));
    C.shape(ctx, [[-252, -230], [252, -230], [252, -196], [-252, -196]], tr.band, { lw: lw * .7 });
    ctx.save(); ctx.translate(-130, -410); ctx.fillStyle = '#f1e8d4'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * .8;
    if (tr.mark === 0) { ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = tr.band; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); }
    else if (tr.mark === 1) { ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(56, 44); ctx.lineTo(-56, 44); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(50, 0); ctx.lineTo(0, 58); ctx.lineTo(-50, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    const bp = C.shape(ctx, [[-266, -96], [266, -96], [266, -56], [-266, -56]], null, { lw: 0 }); C.hazardStripes(ctx, bp, -270, -100, 540, 48, 20); C.ink(ctx, bp, lw);
    [-1, 1].forEach(d => C.shape(ctx, [[d * 214, -150], [d * 244, -150], [d * 244, -112], [d * 214, -112]], '#c8362a', { lw: lw * .7 }));
    ctx.restore();
  }
  function truckPos(i, t) { const k = times(), tr = TRUCKS[i], u = E.outC(seg(t, k.truck[i], k.truck[i] + .75)); if (t < k.truck[i]) return null; const y = lerp(2900, tr.y, u), x = lerp(tr.x0, tr.x, u); return { x, y, s: 1.28 * ps(y), wob: u < 1 ? Math.sin(t * 40 + i) * 3 * ps(y) : 0 }; }

  // bizim taraf (şeridin kameraya yakın yanı): Kaan, Defne, Daisy
  const LINE = { x0: -1230, x1: 2300, gy: 1830, ph: 220, gap: 330, lw: 5 };     // B'nin yakın hattı (−200…1300 kısmı aynı direklerle)
  const KS = { x: 330, y: 1960 }, DS = { x: 660, y: 1975 }, DZ = { x: 920, y: 1930 };
  const kaanS = y => 1.42 * ps(y), daisyS = y => 1.2 * ps(y);
  // Saha dünyası. o: fall, still (kalabalık alkışlamaz), crew, line (true | {xEnd}), daisy, kaan/defne {..., back}, trucks, extra[[y,fn]]
  function site(ctx, t, o) {
    o = o || {}; const f = o.fall ? dropFrac(t) : 0, tw = twos(t);
    siteSky(ctx);
    ctx.drawImage(siteGround(), SB.x, SB.y);
    if (f < 1) drawTower(ctx, f);
    if (o.fall) charges(ctx, t);
    pile(ctx, f);
    crowd(ctx, t, -150, 290, 1300, .2, 81, 30, .25, o.still); crowd(ctx, t, 800, 1240, 1300, .2, 82, 30, .25, o.still);
    if (o.wideCrowd) { crowd(ctx, t, -1200, -150, 1300, .2, 83, 30, .25, o.still); crowd(ctx, t, 1240, 2300, 1300, .2, 84, 30, .25, o.still); }
    if (o.fall) siteDustDraw(ctx, t);
    const items = [];
    if (o.trucks) for (let i = 0; i < 3; i++) { const p = truckPos(i, t); if (p) items.push([p.y, () => truck(ctx, TRUCKS[i], p.x, p.y, p.s, p.wob)]); }
    if (o.crew !== false) { items.push([1760, () => worker(ctx, 120, 1760, .62, 420, tw * 7, false)]); items.push([1750, () => worker(ctx, 980, 1750, .62, 421, tw * 7 + 1, !!o.fall)]); }
    if (o.line) items.push([LINE.gy, () => barrierLine(ctx, LINE.x0 + 40, LINE.x1, LINE.gy, LINE.ph, LINE.gap, LINE.lw, o.line.xEnd)]);
    if (o.lineB) items.push([LINE.gy, () => barrierLine(ctx, -200, 1300, 1830, 220, 330, 5)]);   // B'nin 13a hattı (kesmede birebir)
    if (o.daisy) items.push([DZ.y, () => C.drawDaisy(ctx, Object.assign({ x: DZ.x, y: DZ.y, s: daisyS(DZ.y), seed: 23, beep: 0, mood: 'sleepy', hook: Math.sin(t * 1.1) * .03 }, o.daisy === true ? {} : o.daisy))]);
    if (o.kaan) items.push([o.kaan.y || KS.y, () => C.drawKaan(ctx, Object.assign({ x: KS.x, y: KS.y, s: kaanS(o.kaan.y || KS.y), seed: 11, phone: false }, o.kaan, o.kaan.back ? { pose: 'back' } : {}))]);
    if (o.defne) items.push([(o.defne.y || DS.y) - .5, () => (o.defne.back ? defneBack : C.drawDefne)(ctx, Object.assign({ x: DS.x, y: DS.y, s: kaanS(DS.y), seed: 31 }, o.defne))]);
    (o.extra || []).forEach(e => items.push(e));
    items.sort((a, b) => a[0] - b[0]).forEach(e => e[1]());
  }

  /* ================= GÜVENLİ TARAF (ters açı) — p9-b.js safeBase/safeWorld yerleşimiyle birebir (Hale henüz yok) ================= */
  const SAFE = { hz: 1060, gy: 1780 };
  const BDEFNE = { x: 175, y: 1780, s: .95 }, BKAAN = { x: 380, y: 1790, s: .95 }, BDAISY = { x: 980, y: 1750, s: .8 };
  function safeBase() {
    return cached('p9-guvenli', 2000, 2600, g => {
      g.translate(500, 300);
      const sg = g.createLinearGradient(0, -300, 0, SAFE.hz); sg.addColorStop(0, '#9cbcd4'); sg.addColorStop(.65, '#cdd8d6'); sg.addColorStop(1, '#efdcb8'); g.fillStyle = sg; g.fillRect(-500, -300, 2000, SAFE.hz + 300);
      [[P.far2, 140, 380, 700], [P.far, 60, 220, 760]].forEach(([col, hmin, hmax, sd]) => { let cx = -510, n = 0; while (cx < 1500) { const bw = 60 + rnd(sd + n) * 100, bh = hmin + rnd(sd + 50 + n) * (hmax - hmin); C.seed(sd + n); C.shape(g, [[cx, SAFE.hz], [cx, SAFE.hz - bh], [cx + bw, SAFE.hz - bh], [cx + bw, SAFE.hz]], col, { lw: 1.8, ink: P.far2, amp: .4, shade: c => { c.fillStyle = 'rgba(211,218,222,.5)'; for (let yy = SAFE.hz - bh + 12; yy < SAFE.hz - 10; yy += 18) for (let xx = cx + 8; xx < cx + bw - 8; xx += 16) if (rnd(xx * 5 + yy) < .4) c.fillRect(xx, yy, 6, 8); } }); cx += bw + 5; n++; } });
      g.fillStyle = '#b9b1a0'; g.fillRect(-500, SAFE.hz, 2000, 60); g.fillStyle = '#8d8a84'; g.fillRect(-500, SAFE.hz + 60, 2000, 180);
      g.save(); g.strokeStyle = 'rgba(241,232,212,.7)'; g.lineWidth = 6; g.setLineDash([60, 50]); g.beginPath(); g.moveTo(-500, SAFE.hz + 150); g.lineTo(1500, SAFE.hz + 150); g.stroke(); g.restore();
      C.seed(7101); C.line(g, [[-500, SAFE.hz], [1500, SAFE.hz]], 3, P.ink, .5); C.line(g, [[-500, SAFE.hz + 60], [1500, SAFE.hz + 60]], 2.4, 'rgba(21,18,13,.5)', .5);
      const gg = g.createLinearGradient(0, SAFE.hz + 240, 0, 2300); gg.addColorStop(0, P.groundLt); gg.addColorStop(.3, P.ground); gg.addColorStop(1, P.groundDk); g.fillStyle = gg; g.fillRect(-500, SAFE.hz + 240, 2000, 2300 - SAFE.hz - 240);
      for (let i = 0; i < 30; i++) C.blot(g, C.ell(-480 + rnd(7200 + i) * 1960, 1330 + rnd(7300 + i) * 900, 50 + rnd(7400 + i) * 110, 8 + rnd(7500 + i) * 12, 12), i % 2 ? P.groundDk : P.groundLt, .25);
      C.drawCar(g, { x: 1310, y: 1240, s: .3, view: 'side', seed: 61, flip: true });
    });
  }
  function grassT(ctx, t, y0, y1, sd) {
    for (let i = 0; i < 16; i++) {
      const r = j => rnd(sd + i * 9 + j), x = -300 + r(1) * 1700, y = y0 + r(2) * (y1 - y0), ph = r(3) * 6;
      for (let q = 0; q < 5; q++) {
        const sw = Math.sin(t * 2.4 + ph + q * .5) * 6 + Math.sin(t * 4.7 + ph) * 2, hh = 18 + r(4 + q) * 18;
        ctx.strokeStyle = P.weed; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + q * 4, y);
        ctx.quadraticCurveTo(x + q * 4 + (q - 2) * 3, y - hh * .6, x + q * 4 + (q - 2) * 4 + sw, y - hh); ctx.stroke();
      }
    }
  }
  function safeWorld(ctx, t, o) {
    const tw = twos(t);
    ctx.fillStyle = P.groundDk; ctx.fillRect(-500, 2000, 2000, 1200);
    ctx.drawImage(safeBase(), -500, -300);
    crowd(ctx, t, -480, 1500, 1288, .3, 71, 46, .2, true);
    barrierLine(ctx, -500, 1500, 1310, 52, 140, 2.6);
    worker(ctx, -120, 1360, .34, 401, tw * 3, true); worker(ctx, 1240, 1356, .34, 402, tw * 3 + 1, false);
    grassT(ctx, t, 1400, 1700, 7600);
    const items = [];
    items.push([BDAISY.y, () => C.drawDaisy(ctx, { x: BDAISY.x, y: BDAISY.y, s: BDAISY.s, seed: 23, beep: 0, mood: 'sleepy', hook: Math.sin(t * 1.1) * .025 })]);
    items.push([BDEFNE.y, () => C.drawDefne(ctx, Object.assign({ x: BDEFNE.x, y: BDEFNE.y, s: BDEFNE.s, seed: 31, item: 'helmet' }, o.defne))]);
    items.push([BKAAN.y, () => C.drawKaan(ctx, Object.assign({ x: BKAAN.x, y: BKAAN.y, s: BKAAN.s, seed: 11, phone: false }, o.kaan))]);
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    barrierLine(ctx, -500, 1500, 1900, 300, 520, 5);
  }

  /* ================= KOL OYUNU (Kaan el kaldırır, Defne indirir) ================= */
  // Kaan'ın ön kolunu kendi çizdiğimiz kolla değiştirir: gövde kenarının dışını kırpar, kolu omuzdan döndürür.
  const KARM = { S: [50, -388], L1: 74, L2: 70, au: [67.6, -35], af: [85, -90] };
  function kaanArmPts(a) {
    const au = lerp(KARM.au[0], KARM.au[1], a) * D2R, af = lerp(KARM.af[0], KARM.af[1], a) * D2R, S = KARM.S;
    const El = [S[0] + KARM.L1 * Math.cos(au), S[1] + KARM.L1 * Math.sin(au)], Wr = [El[0] + KARM.L2 * Math.cos(af), El[1] + KARM.L2 * Math.sin(af)];
    return { S, El, Wr, af };
  }
  function drawKaanRaise(ctx, o, a) {
    const s = o.s, toW = (p) => [o.x + p[0] * s, o.y + p[1] * s];
    ctx.save(); ctx.beginPath(); ctx.rect(-5000, -5000, 10000, 10000);
    const R = [[56, -440], [400, -440], [400, -190], [86, -190], [84, -228], [80, -310], [64, -398]].map(toW);
    ctx.moveTo(...R[0]); R.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.clip('evenodd');
    C.drawKaan(ctx, Object.assign({ seed: 11, phone: false }, o));
    ctx.restore();
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s); const lw = 5.2 / Math.sqrt(s);
    // gövde köşesine yama (kesilen bileklik/el kırıntısı)
    ctx.fillStyle = P.jacket; ctx.beginPath(); ctx.moveTo(62, -292); ctx.lineTo(80, -300); ctx.lineTo(84, -226); ctx.lineTo(62, -224); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(11,31,42,.3)'; ctx.fill(); C.seed(1501); C.line(ctx, [[80, -306], [84, -226]], lw);
    const { S, El, Wr, af } = kaanArmPts(a), cw = [Wr[0] - Math.cos(af) * 16, Wr[1] - Math.sin(af) * 16];
    C.seed(1502); C.tube(ctx, [S, El, cw], 34, 27, P.jacket, lw, { shade: c => C.blot(c, [[El[0], El[1] - 10], [El[0] + 30, El[1] - 10], [El[0] + 30, El[1] + 30], [El[0], El[1] + 30]], '#0b1f2a', .25) });
    const c0 = [Wr[0] - Math.cos(af) * 22, Wr[1] - Math.sin(af) * 22], nx = -Math.sin(af) * 14, ny = Math.cos(af) * 14;
    C.shape(ctx, [[c0[0] + nx, c0[1] + ny], [cw[0] + nx, cw[1] + ny], [cw[0] - nx, cw[1] - ny], [c0[0] - nx, c0[1] - ny]], P.hazard, { lw: lw * .7 });
    C.shape(ctx, C.ell(Wr[0], Wr[1], 15, 16, 18), P.skin, { lw });
    ctx.restore();
    const m = toW([(El[0] + Wr[0]) / 2, (El[1] + Wr[1]) / 2]); return m;      // ön kolun ortası (dünya)
  }
  // Defne (sola bakar, flip): ön kolu kendi kolumuz; T hedef bilek (dünya) ya da null
  function drawDefneReach(ctx, o, T, r) {
    const s = o.s * .9, toW = p => [o.x - p[0] * s, o.y + p[1] * s], toL = p => [-(p[0] - o.x) / s, (p[1] - o.y) / s];
    ctx.save(); ctx.beginPath(); ctx.rect(-5000, -5000, 10000, 10000);
    const R = [[30, -406], [400, -406], [400, -236], [30, -236]].map(toW); ctx.moveTo(...R[0]); R.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.clip('evenodd');
    C.drawDefne(ctx, Object.assign({ seed: 31, flip: true }, o));
    ctx.restore();
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(-s, s); const lw = 5.2 / Math.sqrt(s); C.seed(1511);
    C.shape(ctx, [[12, -398], [54, -398], [52, -300], [48, -234], [8, -234], [6, -300]], P.vest, { lw, shade: c => C.blot(c, [[30, -400], [60, -400], [60, -230], [34, -230]], P.vestDk, .6) });
    C.shape(ctx, [[18, -350], [40, -351], [40, -322], [18, -321]], P.paper, { lw: lw * .55 });
    const S = [54, -392], rest = [70, -250], tgt = T ? toL(T) : rest, W0 = [lerp(rest[0], tgt[0], r), lerp(rest[1], tgt[1], r)];
    const L1 = 78, L2 = 66, dx = W0[0] - S[0], dy = W0[1] - S[1], d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1), base = Math.atan2(dy, dx);
    const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), El = [S[0] + L1 * Math.cos(base - al), S[1] + L1 * Math.sin(base - al)];
    const fa = Math.atan2(W0[1] - El[1], W0[0] - El[0]), Wr = [El[0] + L2 * Math.cos(fa), El[1] + L2 * Math.sin(fa)], M = [lerp(El[0], Wr[0], .3), lerp(El[1], Wr[1], .3)];
    C.tube(ctx, [M, Wr], 30, 26, P.dSkin, lw); C.tube(ctx, [S, El, M], 40, 36, P.shirt, lw);
    C.shape(ctx, C.ell(Wr[0] + Math.cos(fa) * 8, Wr[1] + Math.sin(fa) * 8, 13, 14, 12), P.dSkin, { lw });
    ctx.restore();
  }

  /* ================= GECE ODASI (pilot b-sahneler drawRoom ile aynı) ================= */
  function drawRoom(ctx) {
    ctx.fillStyle = P.night2; ctx.fillRect(-300, -300, 1700, 2600);
    C.seed(141);
    for (let x = -100; x < 1300; x += 90) { ctx.fillStyle = 'rgba(7,11,24,.25)'; ctx.fillRect(x, -300, 40, 2600); }
    const wp = C.shape(ctx, [[60, 250], [420, 250], [420, 760], [60, 760]], P.night, { lw: 6 });
    ctx.save(); ctx.clip(wp);
    const sg = ctx.createLinearGradient(0, 250, 0, 760); sg.addColorStop(0, '#03050c'); sg.addColorStop(1, '#1d2742'); ctx.fillStyle = sg; ctx.fillRect(60, 250, 360, 510);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(238,242,255,${.3 + rnd(500 + i) * .6})`; ctx.fillRect(70 + rnd(600 + i) * 340, 260 + rnd(700 + i) * 300, 2.5, 2.5); }
    ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(330, 340, 34, 0, TAU); ctx.fill(); ctx.fillStyle = '#03050c'; ctx.beginPath(); ctx.arc(345, 332, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = '#161d2b'; for (let x = 60; x < 420; x += 44) { const h = 60 + rnd(x) * 130; ctx.fillRect(x, 760 - h, 40, h); for (let y = 770 - h; y < 750; y += 22) if (rnd(x * 7 + y) < .3) { ctx.fillStyle = 'rgba(255,210,122,.75)'; ctx.fillRect(x + 8, y, 7, 9); ctx.fillStyle = '#161d2b'; } }
    ctx.restore();
    C.line(ctx, [[240, 250], [240, 760]], 6); C.line(ctx, [[60, 505], [420, 505]], 6);
    C.shape(ctx, [[40, 760], [440, 760], [446, 790], [34, 790]], P.wood, { lw: 5 });
    C.shape(ctx, [[640, 420], [1020, 420], [1020, 440], [640, 440]], P.wood, { lw: 4 });
    C.shape(ctx, [[670, 330], [760, 330], [760, 420], [670, 420]], '#3a3d45', { lw: 4 });
    C.shape(ctx, [[790, 360], [900, 360], [900, 420], [790, 420]], P.brickDk, { lw: 4 });
    // komodin (sağda): üstünde yüzüstü telefon, saat, baret
    C.seed(1601);
    C.shape(ctx, [[950, 1200], [1160, 1200], [1150, 1700], [960, 1700]], '#4a2e17', { lw: 5 });
    C.shape(ctx, [[935, 1170], [1175, 1170], [1180, 1204], [930, 1204]], P.wood, { lw: 5 });
    C.shape(ctx, [[150, 980], [960, 980], [960, 1900], [150, 1900]], P.wood, { lw: 6, shade: c => C.blot(c, [[700, 960], [1000, 960], [1000, 1900], [740, 1900]], P.ink, .3) });
    C.shape(ctx, [[220, 1010], [880, 1000], [900, 1240], [200, 1250]], P.paperDk, { lw: 5, shade: c => C.blot(c, [[600, 1000], [920, 1000], [920, 1260], [640, 1260]], '#8f8775', .5) });
  }
  function nightstandTop(ctx, phoneDown) {
    C.seed(1602);
    if (phoneDown) C.shape(ctx, [[1000, 1166], [1060, 1162], [1064, 1172], [996, 1176]], P.steelDk, { lw: 2.6 });
    else C.shape(ctx, [[1000, 1166], [1060, 1162], [1064, 1172], [996, 1176]], '#0b0d12', { lw: 2.6 });
    C.shape(ctx, C.ell(1110, 1140, 26, 28, 16), '#c96a3e', { lw: 3 }); C.shape(ctx, C.ell(1110, 1140, 19, 21, 16), P.paper, { lw: 2 });
  }
  function drawBlanket(ctx, y0) {
    C.seed(152);
    C.shape(ctx, [[-40, y0 + 20], [300, y0 - 10], [620, y0 + 30], [1120, y0 - 6], [1120, 2000], [-40, 2000]], '#3b2a3a', {
      lw: 6, shade: c => { C.blot(c, [[700, y0 - 20], [1130, y0 - 20], [1130, 2000], [760, 2000]], P.ink, .3); for (let i = 0; i < 5; i++) C.line(c, [[100 + i * 210, y0 + 80], [160 + i * 200, y0 + 400]], 3, 'rgba(7,11,24,.6)', 2); }
    });
  }
  function darkPhoneInHand(ctx, kx, ky, s) {   // pilotla aynı yerde telefon; ekran KAPALI
    ctx.save(); ctx.translate(kx, ky); ctx.scale(s, s); ctx.translate(92, -236); ctx.rotate(-.22); C.seed(1603);
    C.shape(ctx, [[-14, -30], [14, -30], [14, 22], [-14, 22]], P.steelDk, { lw: 3.4 });
    C.shape(ctx, [[-10, -25], [10, -25], [10, 16], [-10, 16]], '#0b0d12', { lw: 0, amp: .4 });
    ctx.fillStyle = 'rgba(200,215,240,.18)'; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(0, -25); ctx.lineTo(5, -25); ctx.lineTo(-10, -4); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(kx, ky); ctx.scale(s, s); C.seed(1604); C.shape(ctx, C.ell(86, -240, 15, 15, 18), P.skin, { lw: 2.1 }); ctx.restore();
  }
  function moon(ctx, a) {   // pencereden mavimsi ay ışığı
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(240, 520, 40, 300, 700, 1100); g.addColorStop(0, `rgba(120,150,210,${.22 * a})`); g.addColorStop(1, 'rgba(120,150,210,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
  }

  /* ================= "PREVIOUSLY" köşe görüntüsü: ayağa kalkan Hale, şapka elinde ================= */
  function prevInset(ctx, t) {
    const a = 1 - seg(t, 2.2, 2.42); if (a <= 0) return;
    const x = 704, y = 232, w = 176, h = 140;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(.035); ctx.translate(-w / 2, -h / 2);
    C.seed(961); C.shape(ctx, [[-8, -8], [w + 8, -8], [w + 8, h + 8], [-8, h + 8]], P.paper, { lw: 4 });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    const im = cached('p9-prev', 352, 280, g => {
      g.fillStyle = P.wallOffice; g.fillRect(0, 0, 352, 280); g.fillStyle = 'rgba(255,210,122,.25)'; g.beginPath(); g.arc(70, 60, 120, 0, TAU); g.fill();
      C.seed(962); C.shape(g, [[230, 20], [330, 20], [330, 130], [230, 130]], '#1d2742', { lw: 3 });
      g.save(); g.translate(176, 140); g.scale(.62, .62); g.translate(-540, -940);
      C.drawHale(g, { x: 540, y: 1600, s: 1.25, pose: 'stand', hat: 'hand', expr: 'serious', seed: 41 }); g.restore();
    });
    ctx.drawImage(im, 0, 0, w, h);
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  }

  /* ================= SAHNELER ================= */

  /* --- 1: "Two hundred people walked out of a tower today." 0. kare: gece, kule kapısından sakin insan seli; pencereler tek tek söner --- */
  shot('p9a-01-kapi', k => 0, k => k.c2, (ctx, t, u) => {
    const e = E.io(u), z = lerp(2.0, 1.7, e), cy = lerp(1556, 1532, e);
    ctx.save(); cam(ctx, z, 540, cy);
    ctx.fillStyle = '#1d2028'; ctx.fillRect(-600, 1640, 2300, 900);
    ctx.drawImage(towerNight(), 0, 0);
    towerLights(ctx, t);
    lobby(ctx, 1);
    doorPeople(ctx, t);
    ctx.restore();
    glow(ctx, 540, 960 + (TN.hz - TN.eh / 2 - cy) * z, 260, '255,200,120', .18);
    vignette(ctx, .45);
    prevInset(ctx, t);
    finish(ctx);
  });

  /* --- 2: "Almost nobody knew the whole reason." çalışanlar kahveyle, rahat; arkalarında lobinin son ışığı söner --- */
  shot('p9a-02-kahve', k => k.c2, k => k.c3, (ctx, t, u) => {
    const k = times(), th = ones(t), tw = twos(t), on = th < k.lobbyOff ? 1 : th < k.lobbyOff + 2 / FPS ? .4 : 0;
    const bz = 3.4, bcy = 1520;
    ctx.drawImage(blurred('p9-lobi-bulanik', 9, g => { cam(g, bz, 540, bcy); g.drawImage(towerNight(), 0, 0); lobby(g, 0); }), 0, 0);
    ctx.save(); ctx.filter = 'blur(7px)'; cam(ctx, bz, 540, bcy); towerLights(ctx, t); lobby(ctx, on); ctx.restore();
    ctx.filter = 'none';
    glow(ctx, 540, 960 + (TN.hz - TN.eh / 2 - bcy) * bz, 620, '255,200,120', .22 * on);
    const d = (tw - k.c2) * 150;
    const P3 = [{ x: 1000 - d, look: 1, item: 'coffee', expr: 'smile', lk: 1, sd: 621 }, { x: 680 - d, look: 3, item: 'plant', expr: 'calm', lk: -1, sd: 622 }, { x: 340 - d, look: 2, item: 'coffee', expr: 'smile', lk: 1, sd: 623 }];
    ctx.save(); cam(ctx, lerp(1, 1.03, u), 540, 960);
    P3.forEach((p, i) => civ(ctx, { x: p.x, y: 1570 + i * 6, s: 1.45, look: p.look, item: p.item, ph: (tw - k.c2) * 9 + i * 2, expr: tw > k.c2 + .9 + i * .3 ? (i === 1 ? 'smile' : 'calm') : p.expr, lk: p.lk, blink: blinkAt(tw, [k.c2 + .6 + i * .5]), flip: true, seed: p.sd }));
    ctx.restore();
    nightLight(ctx, [[540, 900, 900, .9 * (.45 + .55 * on)]], .55);
    vignette(ctx, .5);
    finish(ctx);
  });

  /* --- 3: "It took six weeks." takvim yaprakları kopar: WEEK 1 → WEEK 6; duvarda güneş lekesi kayar --- */
  const CAL = { x: 540, y: 470, w: 560, h: 660 };
  function calPage(ctx, n) {
    const { w, h } = CAL; C.seed(1700 + n);
    C.shape(ctx, [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]], P.paper, { lw: 4, shade: c => C.blot(c, [[w * .3, -4], [w / 2 + 4, -4], [w / 2 + 4, h + 4], [w * .34, h + 4]], P.paperDk, .5) });
    ctx.save(); ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.font = '700 64px Rubik'; ctx.fillText('WEEK', 0, 120);
    ctx.font = '400 360px "Lilita One"'; ctx.fillText(String(n), 0, 450); ctx.restore();
    for (let d = 0; d < 7; d++) { const x = -w / 2 + 40 + d * ((w - 80) / 7); C.seed(1720 + d); C.shape(ctx, [[x + 4, 520], [x + 64, 520], [x + 64, 600], [x + 4, 600]], null, { lw: 2.4, ink: 'rgba(21,18,13,.55)' }); if (d < 5) C.line(ctx, [[x + 14, 560], [x + 30, 584], [x + 58, 532]], 4.4, '#3a3026', .6); }
  }
  shot('p9a-03-takvim', k => k.c3, k => k.c4, (ctx, t, u) => {
    const k = times(), th = ones(t);
    ctx.drawImage(cached('p9-duvar', 1080, 1920, g => {
      g.fillStyle = '#cfc6b0'; g.fillRect(0, 0, 1080, 1920); C.seed(1750);
      for (let x = 0; x < 1080; x += 120) C.line(g, [[x, 0], [x + 2, 1920]], 2, 'rgba(21,18,13,.18)', 1);
      C.shape(g, [[80, 1260], [460, 1240], [470, 1600], [90, 1620]], '#dfe6ea', { lw: 3, shade: c => { c.strokeStyle = 'rgba(31,79,224,.12)'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(110, 1280 + i * 36); c.lineTo(440, 1270 + i * 36); c.stroke(); } } });
      C.shape(g, [[820, 1240], [826, 1200], [850, 1176], [890, 1170], [928, 1182], [944, 1220], [952, 1244]], P.helmet, { lw: 4, shade: c => C.blot(c, [[890, 1160], [960, 1160], [960, 1250], [900, 1250]], P.helmetDk, .7) });
      C.line(g, [[886, 1172], [886, 1120]], 4); C.shape(g, C.ell(886, 1114, 8, 8, 10), P.steelDk, { lw: 3 });
    }), 0, 0);
    // geçen günler: duvarda güneş lekesi soldan sağa kayar
    const sx = lerp(-500, 1300, seg(t, k.c3, k.tear0 + k.tearDt * 5 + .2));
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,226,170,.28)'; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + 320, 0); ctx.lineTo(sx + 120, 1920); ctx.lineTo(sx - 200, 1920); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); cam(ctx, lerp(1, 1.05, E.io(u)), 540, 860);
    const torn = [1, 2, 3, 4, 5].filter(i => th >= k.tear0 + (i - 1) * k.tearDt + .08).length;
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.fillRect(CAL.x - CAL.w / 2 + 18, CAL.y + 20, CAL.w, CAL.h); ctx.restore();
    ctx.save(); ctx.translate(CAL.x, CAL.y); calPage(ctx, Math.min(6, torn + 1));
    // koparılan yaprak: alttan kalkar, sonra savrulur
    for (let i = 1; i <= 5; i++) {
      const tau = th - (k.tear0 + (i - 1) * k.tearDt); if (tau < 0 || tau > 1.2) continue;
      ctx.save();
      if (tau < .08) { const v = tau / .08; ctx.transform(1, 0, -.12 * v, 1 - .28 * v, 0, 0); calPage(ctx, i); }
      else { const q = tau - .08, sd = rnd(1760 + i); ctx.translate((620 + sd * 300) * q, CAL.h / 2 - 380 * q + 2600 * q * q); ctx.rotate((1.5 + sd * 2) * q * (i % 2 ? 1 : -1)); ctx.translate(0, -CAL.h / 2); calPage(ctx, i); }
      ctx.restore();
    }
    ctx.restore();
    // cilt + halkalar + kopuk kâğıt dişleri
    C.seed(1770); C.shape(ctx, [[CAL.x - 290, CAL.y - 44], [CAL.x + 290, CAL.y - 44], [CAL.x + 290, CAL.y + 8], [CAL.x - 290, CAL.y + 8]], '#2a2d34', { lw: 4 });
    if (torn > 0) for (let q = 0; q < 14; q++) { ctx.fillStyle = P.paper; ctx.fillRect(CAL.x - 270 + q * 39, CAL.y + 8, 22, 7 + rnd(1780 + q) * 6); }
    [-1, 1].forEach(dd => { C.seed(1771 + dd); C.shape(ctx, C.ell(CAL.x + dd * 170, CAL.y - 60, 16, 26, 14), null, { lw: 5 }); });
    C.line(ctx, [[CAL.x, CAL.y - 44], [CAL.x, CAL.y - 120]], 4); C.shape(ctx, C.ell(CAL.x, CAL.y - 124, 9, 9, 10), P.steelDk, { lw: 3 });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 4: "Not us." Kaan hevesle elini kaldırır; Defne bakmadan indirir --- */
  shot('p9a-04-bizdegil', k => k.c4, k => k.c5, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.drawImage(blurred('p9-sokak-bulanik', 9, g => { cam(g, .9, 540, 1500); site(g, 0, { line: true, daisy: true, still: true }); }), 0, 0);
    const up = E.outBack(seg(tw, k.c4 + .02, k.c4 + .3)), pull = E.ioC(seg(tw, k.grab + .06, k.grab + .36)), a = up * (1 - pull);
    const reach = E.outC(seg(tw, k.grab - .2, k.grab)) * (1 - E.io(seg(tw, k.grab + .42, k.grab + .7)));
    const KO = { x: 400, y: 1756, s: 2.0 }, DO = { x: 650, y: 1756, s: 2.0 };
    ctx.save(); cam(ctx, lerp(1, 1.03, E.io(u)), 540, 960);
    const kexpr = tw >= k.grab + .3 ? 'sheepish' : 'determined';
    const fm = drawKaanRaise(ctx, Object.assign({ expr: kexpr, look: tw >= k.grab + .3 ? 1 : -.2, blink: blinkAt(tw, [k.grab + .9]) }, KO), a);
    drawDefneReach(ctx, Object.assign({ expr: 'serious', look: 0, blink: blinkAt(tw, [k.c4 + .3]) }, DO), fm, reach);
    ctx.restore();
    finish(ctx);
  });

  /* --- 5a: "Specialists," baretli uzmanlar ve cihazları kulenin dibinde (biz değil) --- */
  function specialist(ctx, x, y, s, sd, vest, item, t) {   // p7-b'deki ekip çizimi + yelek rengi + cihaz
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd);
    const lw = 5 / Math.sqrt(s), body = '#46505c', bodyDk = '#343c46', vDk = 'rgba(21,18,13,.25)';
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 70, 11, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.shape(ctx, [[-34, -220], [-4, -220], [-10, -10], [-40, -10]], bodyDk, { lw }); C.shape(ctx, [[4, -220], [34, -220], [40, -10], [10, -10]], body, { lw });
    C.shape(ctx, [[-46, -14], [-6, -14], [0, 0], [-50, 0]], P.bootDk, { lw }); C.shape(ctx, [[8, -14], [46, -14], [54, 0], [6, 0]], P.bootDk, { lw });
    C.tube(ctx, [[-50, -360], [-66, -290], [-60, -228]], 34, 28, bodyDk, lw);
    C.shape(ctx, [[-56, -372], [56, -372], [62, -220], [-62, -220]], vest, { lw, shade: c => C.blot(c, [[20, -380], [70, -380], [70, -210], [26, -210]], vDk, .6) });
    C.line(ctx, [[-58, -290], [58, -290]], 7, P.paper, .3); C.line(ctx, [[-20, -372], [-20, -222]], 6, P.paper, .3); C.line(ctx, [[20, -372], [20, -222]], 6, P.paper, .3);
    if (item === 'tablet') {
      C.tube(ctx, [[50, -360], [70, -300], [20, -290]], 34, 28, body, lw);
      ctx.save(); ctx.translate(0, -300); ctx.rotate(-.12); C.shape(ctx, [[-56, -40], [56, -40], [56, 34], [-56, 34]], P.steelDk, { lw });
      ctx.fillStyle = '#cfe3d4'; ctx.fillRect(-48, -32, 96, 58); ctx.strokeStyle = '#2a4a3a'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const xx = -44 + i * 7.4, yy = -4 + Math.sin(i * 1.3 + t * 6) * 12 * (i / 12); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); ctx.restore();
      C.shape(ctx, C.ell(18, -290, 13, 14, 12), '#a87a56', { lw });
    } else if (item === 'sensor') {
      const r = Math.sin(t * 5) * 6;
      C.tube(ctx, [[50, -360], [96, -380 + r], [140, -400 + r]], 34, 28, body, lw);
      C.shape(ctx, [[130, -436 + r], [196, -436 + r], [196, -372 + r], [130, -372 + r]], '#e0d8c4', { lw, shade: c => { c.fillStyle = (Math.floor(t * 3) % 2) ? '#3a8a4a' : '#1f4a2a'; c.beginPath(); c.arc(184, -424 + r, 5, 0, TAU); c.fill(); } });
      C.shape(ctx, C.ell(140, -400 + r, 13, 14, 12), '#a87a56', { lw });
    } else {   // tripod üstünde ölçüm cihazı; baş yavaşça döner
      C.tube(ctx, [[50, -360], [92, -330], [120, -350]], 34, 28, body, lw);
      [[-1, 0], [0, 1], [1, 2]].forEach(([d]) => C.line(ctx, [[150, -380], [150 + d * 44, 0]], 6, P.ink, .2));
      const rot = Math.sin(t * 1.2) * .4; ctx.save(); ctx.translate(150, -400); ctx.scale(Math.cos(rot) * .3 + .7, 1);
      C.shape(ctx, [[-30, -40], [30, -40], [34, 16], [-34, 16]], '#e0d8c4', { lw }); C.shape(ctx, C.ell(0, -12, 16, 16, 12), P.steelDk, { lw }); ctx.restore();
      C.shape(ctx, C.ell(120, -350, 13, 14, 12), '#a87a56', { lw });
    }
    C.shape(ctx, C.ell(0, -414, 36, 40, 18), '#a87a56', { lw });
    C.face(ctx, 'serious', { L: [-12, -414], R: [14, -414], m: [2, -390], k: .8, lw, look: item === 'tablet' ? .3 : .8 });
    C.shape(ctx, [[-44, -430], [-38, -462], [-16, -478], [16, -478], [38, -462], [44, -430], [52, -428], [52, -420], [-52, -420], [-52, -428]], P.helmet, { lw, shade: c => C.blot(c, [[10, -480], [56, -480], [56, -418], [18, -418]], P.helmetDk, .7) });
    ctx.restore();
  }
  shot('p9a-05-uzman', k => k.c5, k => k.c5b, (ctx, t, u) => {
    const tw = twos(t);
    ctx.drawImage(blurred('p9-taban-bulanik', 8, g => { cam(g, 1.7, 540, 1060); site(g, 0, { still: true, crew: false }); }), 0, 0);
    ctx.fillStyle = 'rgba(241,232,212,.12)'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.save(); cam(ctx, lerp(1, 1.04, E.io(u)), 540, 960);
    specialist(ctx, 170, 1640, 1.25, 1801, '#b8322a', 'tripod', tw);
    specialist(ctx, 820, 1620, 1.25, 1803, '#6f7d3a', 'sensor', tw);
    specialist(ctx, 520, 1700, 1.35, 1802, '#e0672a', 'tablet', tw);
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 5b: "from three cities." üç ayrı şehrin aracı meydana girer, durur --- */
  shot('p9a-06-kamyon', k => k.c5b, k => k.c6, (ctx, t, u) => {
    ctx.save(); cam(ctx, lerp(.62, .65, E.io(u)), 540, 1240);
    site(ctx, t, { trucks: true, still: true, crew: false });
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 6a: "Our job was small: clear the street," Kaan şeridi direkten direğe çeker; Defne ve Daisy bu yanda --- */
  shot('p9a-07-serit', k => k.c6, k => k.c6b, (ctx, t, u) => {
    const k = times(), tw = twos(t), m = E.io(seg(tw, k.c6 + .05, k.barSet)), kx = lerp(80, 760, m), moving = tw < k.barSet, ky = 1880, ks = kaanS(ky);
    const back = E.io(seg(tw, k.barSet + .2, k.barSet + .8));
    ctx.save(); cam(ctx, lerp(.8, .83, E.io(u)), lerp(470, 540, E.io(u)), 1420);
    site(ctx, t, { line: { xEnd: moving ? kx + 40 * ks : null }, daisy: true, still: true,
      kaan: moving ? { x: kx, y: ky, s: ks, pose: 'side', step: Math.sin((tw - k.c6) * 9), expr: 'determined' } : { x: lerp(kx, KS.x, back), y: lerp(ky, KS.y, back), s: kaanS(lerp(ky, KS.y, back)), expr: 'smile', look: -.8, blink: blinkAt(tw, [k.barSet + 1]) },
      defne: { item: 'roll', expr: 'calm', look: -.7, blink: blinkAt(tw, [k.c6 + .9]) } });
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 6b: "and wait behind the line." ters açı (p9-b güvenli taraf): üçü şeridin arkasında, kuleye dönük bekler --- */
  shot('p9a-08-bekle', k => k.c6b, k => k.c7, (ctx, t, u) => {
    const k = times(), tw = twos(t), sh = tw >= k.shift ? Math.sin((tw - k.shift) * 5) * 6 : 0;
    ctx.save(); cam(ctx, lerp(.95, .99, E.io(u)), 640, 1405);
    safeWorld(ctx, t, {
      defne: { pose: 'cross', item: null, expr: tw >= k.shift + .4 ? 'calm' : 'serious', look: tw >= k.shift + .2 && tw < k.shift + 1 ? 1 : 0, blink: blinkAt(tw, [k.c6b + .5, k.shift + 1.2]) },
      kaan: { x: BKAAN.x + sh, y: BKAAN.y - Math.abs(sh) * .4, expr: tw >= k.shift ? 'tired' : 'calm', look: 0, blink: blinkAt(tw, [k.c6b + 1.1]) } });
    ctx.restore();
    vignette(ctx, .2);
    finish(ctx);
  });

  /* --- 7: "The night before, I did not open the game." pilotun gece odası, ama karanlık: telefon kapalı --- */
  function roomCam(ctx, z, cx, cy) { ctx.save(); cam(ctx, z, cx, cy); }
  shot('p9a-09-gece', k => k.c7, k => k.c8, (ctx, t, u) => {
    const k = times(), tw = twos(t), s = 2.5, kx = 500, ky = 1880, away = tw >= k.look7;
    roomCam(ctx, lerp(1, 1.06, E.io(u)), 560, 900);
    drawRoom(ctx); nightstandTop(ctx, false);
    C.drawKaan(ctx, { x: kx, y: ky, s, seed: 11, phone: false, expr: away ? 'tired' : 'calm', look: away ? -.8 : .5, blink: blinkAt(tw, [k.c7 + .7, k.look7 + .9]) });
    darkPhoneInHand(ctx, kx, ky, s);
    drawBlanket(ctx, ky - 200 * s + 10);
    const m = ctx.getTransform(); ctx.restore();
    const wX = m.a * 240 + m.e, wY = m.d * 505 + m.f, fX = m.a * (kx + 6 * s) + m.e, fY = m.d * (ky - 460 * s) + m.f;
    nightLight(ctx, [[wX, wY, 560, .6], [fX, fY, 380, .4]], .82);
    moon(ctx, 1);
    finish(ctx);
  });

  /* --- 8: "I did not need practice." komodin yakın: el telefonu yüzüstü çevirir --- */
  function phoneFlat(ctx, flip) {   // ekran (flip<.5) ya da sırt; scaleX = cos(πflip)
    const c = Math.cos(Math.PI * flip), W = 300, H = 560; ctx.save(); ctx.scale(Math.max(.02, Math.abs(c)), 1); C.seed(1810);
    if (c > 0) { C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], P.steelDk, { lw: 6 }); ctx.fillStyle = '#0b0d12'; rrect(ctx, -W / 2 + 16, -H / 2 + 22, W - 32, H - 44, 22); ctx.fill(); ctx.fillStyle = 'rgba(170,190,230,.16)'; ctx.beginPath(); ctx.moveTo(-W / 2 + 16, -H / 2 + 120); ctx.lineTo(-W / 2 + 160, -H / 2 + 22); ctx.lineTo(-W / 2 + 220, -H / 2 + 22); ctx.lineTo(-W / 2 + 16, -H / 2 + 200); ctx.fill(); }
    else { C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], '#3a3d45', { lw: 6, shade: cc => { cc.fillStyle = 'rgba(255,255,255,.06)'; cc.fillRect(-W / 2, -H / 2, 40, H); } }); C.shape(ctx, rrect.length ? [[-W / 2 + 26, -H / 2 + 26], [-W / 2 + 116, -H / 2 + 26], [-W / 2 + 116, -H / 2 + 116], [-W / 2 + 26, -H / 2 + 116]] : [], '#2a2d34', { lw: 4 }); C.shape(ctx, C.ell(-W / 2 + 71, -H / 2 + 71, 22, 22, 14), '#15171c', { lw: 3 }); }
    ctx.restore();
  }
  shot('p9a-10-telefon', k => k.c8, k => k.c9, (ctx, t, u) => {
    const k = times(), th = ones(t), tw = twos(t);
    ctx.drawImage(cached('p9-komodin', 1080, 1920, g => {
      g.fillStyle = P.night2; g.fillRect(0, 0, 1080, 1920);
      C.seed(1820); C.shape(g, [[-40, 520], [1120, 470], [1120, 1920], [-40, 1920]], P.wood, { lw: 6, shade: c => { for (let i = 0; i < 9; i++) C.line(c, [[-40, 600 + i * 150], [1120, 560 + i * 150]], 3, 'rgba(42,26,10,.45)', 3); C.blot(c, [[700, 470], [1130, 470], [1130, 1920], [760, 1920]], P.ink, .25); } });
      // saat 22:05 (erken yatış)
      const cx = 220, cy = 420, r = 110; C.seed(1821); C.shape(g, C.ell(cx, cy, r, r, 26), '#c96a3e', { lw: 6 }); C.shape(g, C.ell(cx, cy, r * .8, r * .8, 26), P.paper, { lw: 4 });
      [-1, 1].forEach(d => C.shape(g, C.ell(cx + d * r * .6, cy - r * .95, r * .26, r * .2, 10), P.steel, { lw: 4 }));
      for (let q = 0; q < 12; q++) { const a = q / 12 * TAU; g.fillStyle = P.ink; g.fillRect(cx + Math.cos(a) * r * .66 - 4, cy + Math.sin(a) * r * .66 - 4, 8, 8); }
      g.strokeStyle = P.ink; g.lineCap = 'round'; const ah = (10 + 5 / 60) / 12 * TAU - Math.PI / 2, am = 5 / 60 * TAU - Math.PI / 2;
      g.lineWidth = 10; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ah) * r * .4, cy + Math.sin(ah) * r * .4); g.stroke();
      g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(am) * r * .62, cy + Math.sin(am) * r * .62); g.stroke();
      // baret (yarın iş var; oyun değil)
      C.shape(g, [[740, 520], [748, 440], [800, 380], [880, 366], [960, 392], [994, 470], [1004, 524]], P.helmet, { lw: 6, shade: c => C.blot(c, [[900, 350], [1020, 350], [1020, 530], [920, 530]], P.helmetDk, .7) });
    }), 0, 0);
    // saniye ibresi (tık tık)
    const cx = 220, cy = 420, sa = Math.floor(th) / 60 * TAU * 6 - Math.PI / 2; ctx.save(); ctx.strokeStyle = '#b8322a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sa) * 80, cy + Math.sin(sa) * 80); ctx.stroke(); ctx.restore();
    const fl = E.ioC(seg(th, k.flip, k.flip + .3)), lift = Math.sin(Math.PI * fl) * 50, px = 560, py = 1000;
    const hin = E.outC(seg(tw, k.c8 + .02, k.flip - .02)), hout = E.inQ(seg(tw, k.flip + .45, k.flip + .85)), hx = lerp(1300, px + 150 * Math.abs(Math.cos(Math.PI * fl)) + 20, hin) + hout * 700, hy = py - lift + hout * 200;
    ctx.save(); ctx.translate(px, py - lift); ctx.rotate(-.1); ctx.scale(1 + lift / 600, 1 + lift / 600);
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = P.ink; ctx.fillRect(-150 + 20, -280 + 24 + lift, 300, 560); ctx.restore();
    phoneFlat(ctx, fl);
    ctx.restore();
    // el (sağdan): yeşil kol, sarı bileklik, parmaklar telefonun kenarında
    ctx.save(); ctx.translate(hx, hy); C.seed(1830);
    C.shape(ctx, [[60, -80], [700, -180], [760, 160], [60, 90]], P.jacket, { lw: 6, shade: c => C.blot(c, [[60, 30], [760, 60], [760, 170], [60, 100]], P.jacketDk, .6) });
    C.shape(ctx, [[40, -90], [100, -100], [110, 100], [50, 104]], P.hazard, { lw: 5 });
    C.shape(ctx, [[-40, -70], [50, -86], [60, 90], [-30, 80], [-60, 40], [-62, -30]], P.skin, { lw: 6, shade: c => C.blot(c, [[-70, 30], [60, 30], [60, 100], [-70, 100]], P.skinDk, .5) });
    [-46, -12, 22].forEach(y => C.line(ctx, [[-56, y], [-24, y + 4]], 3, P.skinDk, .3));
    ctx.restore();
    nightLight(ctx, [[560, 900, 820, .6], [250, 430, 300, .4]], .7);
    moon(ctx, .8);
    finish(ctx);
  });

  /* --- 9: "I needed sleep." Kaan yastığa düşer, gözler kapanır --- */
  shot('p9a-11-uyku', k => k.c9, k => k.c10, (ctx, t, u) => {
    const k = times(), tw = twos(t), s = 2.5, kx = 500, ky = 1880;
    const fallU = E.inQ(seg(tw, k.flop, k.flop + .22)), b = tw > k.flop + .22 ? Math.sin((tw - k.flop - .22) * 18) * 26 * Math.exp(-(tw - k.flop - .22) * 6) : 0;
    const drop = 450 * fallU - b, asleep = tw >= k.flop + .3;
    const breath = asleep ? Math.sin((t - k.flop) * 2.4) * 4 : 0;
    roomCam(ctx, lerp(1, 1.04, E.io(u)), 560, 1060);
    drawRoom(ctx); nightstandTop(ctx, true);
    // yastık çöker (puf)
    if (fallU > .9) { ctx.save(); ctx.globalAlpha = .5 * clamp(1 - (tw - k.flop - .22) / .5); ctx.fillStyle = P.paperDk; [-1, 1].forEach(d => { ctx.beginPath(); ctx.ellipse(kx + 30 + d * 230, 1120, 50, 18, 0, 0, TAU); ctx.fill(); }); ctx.restore(); }
    C.drawKaan(ctx, { x: kx, y: ky + drop, s, seed: 11, phone: false, expr: asleep ? 'calm' : 'tired', look: 0, blink: asleep ? 1 : blinkAt(tw, [k.c9 + .2]) });
    drawBlanket(ctx, ky - 200 * s + 10 - 60 * fallU - breath);
    const m = ctx.getTransform(); ctx.restore();
    const wX = m.a * 240 + m.e, wY = m.d * 505 + m.f, fX = m.a * (kx + 6 * s) + m.e, fY = m.d * (ky + drop - 460 * s) + m.f;
    nightLight(ctx, [[wX, wY, 560, .6], [fX, fY, 380, .45]], .84);
    moon(ctx, 1);
    finish(ctx);
  });

  /* --- 10: "At noon, forty floors sat down..." geniş plan: şarjlar, kule kendi tozuna oturur; tabanda 6 kare sarsıntı --- */
  const backs = { kaan: { back: true, expr: 'calm' }, defne: { back: true } };
  shot('p9a-12-genis', k => k.c10, k => k.c10b, (ctx, t, u) => {
    const k = times();
    ctx.save(); shake(ctx, t, k.thump, 16); cam(ctx, lerp(.55, .58, E.io(u)), 540, 980);
    site(ctx, t, Object.assign({ fall: true, line: true, daisy: true, still: true, wideCrowd: true }, backs));
    if (t > k.thump) airDustB(ctx, t, 40, 3, [-200, 400, 1500, 900], clamp((t - k.thump) / 1.5) * .8, '216,202,176');
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });
  /* --- 10b: yakın: katlar birer birer tozun içine iner, çatı ve anten en son --- */
  shot('p9a-13-katlar', k => k.c10b, k => k.c11, (ctx, t, u) => {
    ctx.save(); cam(ctx, 1.3, 540, lerp(740, 860, E.io(u)));
    site(ctx, t, { fall: true, still: true, crew: false });
    airDustB(ctx, t, 40, 5, [100, 300, 900, 900], .9, '216,202,176');
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });
  /* --- 11: "Slowly." omuz üstü: Kaan ve Defne arkadan, toz ağır ağır büyür; çok yavaş itme --- */
  shot('p9a-14-yavas', k => k.c11, k => k.c12, (ctx, t, u) => {
    ctx.save(); cam(ctx, lerp(.75, .78, E.io(u)), 560, 1350);
    site(ctx, t, Object.assign({ fall: true, line: true, daisy: true, still: true }, backs));
    airDustB(ctx, t * .6, 30, 6, [-100, 700, 1300, 900], .8, '216,202,176');
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });
  /* --- 12: "Exactly where the engineers wanted." alanın sağ ön direği yakın: toz şeridin içinde kalır; sonra B'nin geniş planına açılır --- */
  shot('p9a-15-tamyer', k => k.c12, k => k.end, (ctx, t, u) => {
    const k = times(), p = E.ioC(seg(t, k.pull, k.end - .1)), push = lerp(1, 1.03, E.io(seg(t, k.c12, k.pull)));
    const z = lerp(1.8 * push, 1.18, p), cx = lerp(800, 540, p), cy = lerp(1150, 1200, p), sy = lerp(960, 1000, p);
    ctx.save(); cam(ctx, z, cx, cy, 540, sy);
    site(ctx, t, { fall: true, lineB: true, still: t < k.pull + .2 });
    airDustB(ctx, t, 18, 91, [-100, 800, 1300, 700], .6);
    ctx.restore();
    vignette(ctx, .2);
    finish(ctx);
  });

  /* ================= B için dışa açılan yerleşim ================= */
  window.P9A = { SITE, TBY, TS, ps, LINE, KS, DS, DZ, endCam: { z: 1.18, cx: 540, cy: 1200, sx: 540, sy: 1000 }, dustA, dropFrac, site, drawTower };

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const f3 = x => +x.toFixed(3);
  TB.cuesA = {
    get adimlar() { return 0; },                                     // kalabalık sakin ayak sesleri, uğultu yok (0–4,5 sn)
    get isikTik() { return f3(winOff(0, 1)); },                       // pencere ışıkları tek tek söner: hafif şalter tıkları 0,2–3,9 sn boyunca
    get lobiIsik() { return f3(times().lobbyOff); },                 // lobinin son ışığı: tek, belirgin şalter
    get kagit1() { return f3(times().tear0); },                       // takvim yaprakları (5 kopma, aralık tearDt)
    get kagitAralik() { return f3(times().tearDt); },
    get elKalkar() { return f3(times().c4 + .02); },                  // kumaş hışırtısı değil: kısa "tık" / kıkırdama için boşluk
    get elTutar() { return f3(times().grab); },                       // Defne'nin eli Kaan'ın koluna: yumuşak pat
    get cihazTik() { return f3(times().c5 + .3); },                   // tablet/ölçüm cihazı küçük tık
    get kamyon1() { return f3(times().truck[0] + .7); },              // her biri: motor yavaşlar + fren
    get kamyon2() { return f3(times().truck[1] + .7); },
    get kamyon3() { return f3(times().truck[2] + .7); },
    get seritCekilir() { return f3(times().c6 + .05); },             // şerit makarası açılır (plastik tıkırtı)
    get seritBagla() { return f3(times().barSet); },                 // şerit son direğe bağlanır: kısa çıt
    get telefonTers() { return f3(times().flip + .3); },             // telefon komodine yüzüstü: kuru "tak"
    get yastik() { return f3(times().flop + .22); },                  // yastığa düşüş: yumuşak puf
    get sarjlar() { return f3(times().fall + .12); },                 // 5 küçük boğuk pat, 0,09 sn arayla
    get cokusBaslar() { return f3(times().sink0); },                  // derin gürleme başlar
    get darbe() { return f3(times().thump); },                        // taban oturur: ağır gümleme + 6 kare sarsıntı
    get katlar() { return f3(times().thump + .2); },                  // kat kat boğuk vuruşlar (≈ her 0,07 sn) iniş boyunca
    get cokusBiter() { return f3(times().sink1); }                    // son oturma; sonra toz sessizce büyür
  };
})();
