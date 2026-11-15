/* Part 10 · BUILD SOMETHING — Animatör B: cümle 17–35 ve bitiş (dizinin finali). Başlangıç (S16.t1 + S17.t0) / 2 ≈ 28,47 sn → tl.duration.
   YERLEŞİM (dünya koordinatları; p10-a ile aynı avlu, ofis sökülmüş hâl):
   • AVLU: p10-a ile birebir aynı "boş" plaka (ext + drawYard barakasız [skipShed] + footprint, kopya): ufuk y≈1075; çit üst y 1234,
     taban y 1344; bahçe kapısı x 778–994; posta kutusu direği (670,1536). Baraka söküldü: beton şerit x 102–676, y 1267–1281 + toprak izi;
     ilk taşın çukuru (122,1270), taş kenarda (40,1300).
   • Daisy A'nın park yeri (900,1600) s .8, siperlik yarı kapalı; uyarı ışığı dünyada (900,1323); bom ucu ≈(806,912). Kuş tavanda, Daisy yereli (70,-334).
   • Defne'nin çizim masası (A ile aynı) (240,1700) s .85, Defne masada oturur (240,1668). Kaan avluda dedenin bareti başında (A'nın kaanH'si).
   • NOT (17–18): A'nın son karesi: katlı not (540,760) s 1.08 iki elde, altında bulanık açık teneke; not ellerin hizasından ters çevrilir,
     (475,≈500)'e kalkar ve büyür (s≈1.45): dedenin yazısı üst üçte birde.
   • OKUL (19): p7-a'daki "SCHOOL OF ENGINEERING" binası (aynı çizim, yaz hâli); Kaan arkadan, açık kapıya yürür.
   • ÇAĞRI (30–35): düz kâğıt zemin (#f1e8d4), gerçek simge ve telefon (pilot telefonu, .7 ölçek) ortada x 475; önemli öğe bitişte y<600.
   Her şey timeline'dan (times()); karakterler ikişerli, kamera/toz birerli; bip penceresinde ışıktan başka hiçbir şey kıpırdamaz. Bitişte tek bip YOK. */
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
    k.start = (S(16).t1 + S(17).t0) / 2;                  // A ile ortak kesme (≈28,47)
    k.ant = S(17).t0; k.now = S(18).t0;
    k.f1 = k.start + .03;                                 // not elde ters çevrilir (yatay eksen), "Ant." kelimesinde ön yüz
    k.f2e = k.ant + .15;
    k.school = W(19, /^school/i, 4).t0 - .02;             // okul kapısı
    k.desk = (S(19).t1 + S(20).t0) / 2;                   // Defne masada
    k.top = W(20, /^new/i, 4).t0 - .12;                   // çizim (üstten)
    k.small = S(21).t0; k.strong = S(22).t0;
    k.yard = (S(22).t1 + S(23).t0) / 2;                   // avlu, güneş
    k.dmed = S(24).t0 - .1;                               // Daisy orta plan
    k.bird = W(24, /^yard/i, 4).t0 - .1;                  // kuş konar
    k.bcu = S(25).t0 - .25;                               // bip yakın planı
    k.alert = W(25, /^beeped/i, 3).t0;                    // siperlik bipten önce kalkar (pilot)
    k.beep = c.beep; k.fr0 = c.beep - .3; k.fr1 = c.beep + .57 + 10 / FPS;
    k.check = (S(26).t1 + S(27).t0) / 2;                  // kontrol montajı
    k.under = (S(27).t1 + S(28).t0) / 2;
    k.c1 = lerp(k.check, k.under, 1 / 3); k.c2 = lerp(k.check, k.under, 2 / 3);
    k.soft = W(28, /^understood/i, 2).t0;                 // yüz yumuşar
    k.bye = (S(28).t1 + S(29).t0) / 2;                    // veda planı
    k.glow = W(29, /^goodbye/i, 4).t0;                    // ışık son kez yumuşakça yanıp söner
    k.byeEnd = S(29).t1;
    k.cta = c.cta - .12;                                  // karakter dışı çağrı: kâğıt zemin
    k.dm = W(31, /^Demolition/i, 0).t0; k.master = W(31, /^Master/i, 1).t0;
    k.game = S(32).t0; k.teach = S(33).t0; k.plan = S(34).t0; k.we = S(35).t0;
    k.sancar = W(35, /^Sancar/i, 2).t0;
    k.endCard = c.endCard; k.dur = tl.duration;
    K = k; return k;
  }
  // İki bip: daisy-beep.wav tonları 0,04–0,24 ve 0,37–0,57 sn; ışık 6 kare yanık / 4 sönük / 6 yanık; ilk .8, ikinci en parlak (pilot).
  const TONES = [[.04, .24], [.37, .57]];
  function beepV(t, t0) { const d = t - t0; for (let i = 0; i < 2; i++) if (d >= TONES[i][0] - 1e-6 && d < TONES[i][1] - 1e-6) return i ? 1 : .8; return 0; }
  function frozen(t) { const k = times(); return t >= k.fr0 && t < k.fr1 ? k.fr0 : t; }
  function flow(t) { const k = times(); return t < k.fr0 ? t : t < k.fr1 ? k.fr0 : t - (k.fr1 - k.fr0); }
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
  function sun(ctx, a) {   // güneş: sol üstten sıcak ışık (ekran koordinatı)
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(120, 260, 40, 160, 360, 1500); g.addColorStop(0, `rgba(255,226,160,${.5 * a})`); g.addColorStop(.45, `rgba(255,214,150,${.18 * a})`); g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const cache = {};
  function cached(key, w, h, fn) { if (!cache[key]) { const cv = canvas(w, h); fn(cv.getContext('2d')); cache[key] = cv; } return cache[key]; }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }
  function airDust(ctx, t, n, sb, box, a, col) {   // güneşte asılı zerreler (birerli)
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (6 + r(2) * 18)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(${col || '255,244,214'},${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }
  function outlined(ctx, txt, x, y, fill, stroke, shadow) {   // paket.js ile aynı yazı: mürekkep kontur + alt gölge
    ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = P.ink; ctx.lineWidth = stroke * 2;
    if (shadow) { ctx.fillStyle = P.ink; ctx.strokeText(txt, x, y + shadow); ctx.fillText(txt, x, y + shadow); }
    ctx.strokeText(txt, x, y); ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  }
  const FONT = s => `400 ${s}px "Lilita One"`;

  /* ---------- Kaan'ın eli (yeni nesne): bilek (0,0), parmaklar −y yönünde; kol +y'ye uzanır ---------- */
  function kaanHand(ctx, x, y, rot, s, mode, sd) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); C.seed(sd || 601);
    const lw = 5.6 / Math.sqrt(s) * 1.6;
    C.shape(ctx, [[-60, 10], [60, 10], [84, 760], [-84, 760]], P.jacket, { lw, shade: c => C.blot(c, [[26, 0], [92, 0], [92, 760], [36, 760]], P.jacketDk, .6) });
    C.shape(ctx, [[-62, 12], [62, 12], [64, 46], [-64, 46]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-50, 4], [50, 4], [58, -64], [46, -118], [-44, -120], [-58, -66]], P.skin, { lw, shade: c => C.blot(c, [[22, -130], [64, -130], [64, 6], [30, 6]], P.skinDk, .5) });
    const grip = mode === 'grip';
    [[-34, .86], [-11, 1], [12, .95], [34, .78]].forEach(([fx, q], i) => {
      C.seed((sd || 601) + 10 + i);
      if (grip) C.tube(ctx, [[fx, -112], [fx * 1.02, -148 * q], [fx * .96, -138 * q + 18]], 25, 22, P.skin, lw * .8);
      else C.tube(ctx, [[fx, -112], [fx * 1.06, -150 - 26 * q], [fx * 1.12, -168 - 52 * q]], 25, 21, P.skin, lw * .8);
    });
    C.seed((sd || 601) + 20);
    C.tube(ctx, [[-46, -36], [-80, -66], [-98, grip ? -96 : -110]], 30, 23, P.skin, lw * .8);
    ctx.restore();
  }

  /* ================= GÜNEŞLİ AVLU (ofis sökülmüş) ================= */
  const YD = (() => { const hz = 1920 * .56, bx = 108, bw = 561.6, by = hz + 192, bh = 576; return { hz, bx, bw, by, bh, fy: hz + 1920 * .14, gx: 1080 * .72 }; })();
  const DAISY = { x: 900, y: 1600, s: .8 };
  const BEACON = [DAISY.x, DAISY.y - 346 * DAISY.s];
  const DESK = { x: 240, y: 1700, s: .85 }, SEAT = { x: 240, y: 1668 };
  /* avlu: p10-a ile birebir aynı 'boş' plaka (ext + drawYard barakasız + temel izi) */
  const HZ = YD.hz;
  const TUFT = [[-12, -526], [-6, -552], [8, -572], [30, -580], [46, -570], [44, -556], [36, -548], [38, -562], [26, -562], [14, -550], [12, -530]];
  function ext(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, P.sky0); g.addColorStop(.6, P.sky1); g.addColorStop(1, P.sky2);
    ctx.fillStyle = g; ctx.fillRect(-1600, -2400, 4400, HZ + 2402);
    const gg = ctx.createLinearGradient(0, HZ, 0, 1920); gg.addColorStop(0, P.groundLt); gg.addColorStop(.4, P.ground); gg.addColorStop(1, P.groundDk);
    ctx.fillStyle = gg; ctx.fillRect(-1600, HZ, 4400, 3200);
    C.seed(901);
    for (const side of [-1, 1]) {
      let cx = side < 0 ? -1600 : 1080, i = 0;
      while (cx < (side < 0 ? 0 : 2800)) { const bw = 60 + rnd(920 + i * 3 + side) * 70, bh = 60 + rnd(940 + i * 7 + side) * 150;
        C.shape(ctx, [[cx, HZ], [cx, HZ - bh], [cx + bw, HZ - bh], [cx + bw, HZ]], P.far, { lw: 2, ink: P.far2, amp: .5 }); cx += bw + 6 + rnd(960 + i) * 16; i++; }
      for (let j = 0; j < 8; j++) C.blot(ctx, C.ell((side < 0 ? -1500 : 1100) + rnd(980 + j + side * 50) * 1400, HZ + 40 + rnd(990 + j) * 1600, 50 + rnd(995 + j) * 80, 9 + rnd(999 + j) * 8, 12), j % 2 ? P.groundDk : P.groundLt, .25);
    }
    const fy = YD.fy;
    ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = P.dustDk; ctx.lineWidth = 1.3;
    ctx.save(); ctx.beginPath(); ctx.rect(-1600, 0, 1600, 3000); ctx.rect(1080, 0, 1800, 3000); ctx.clip();
    for (let fx = -20 - 14 * 120; fx < 2800; fx += 14) { if (fx > -60 && fx < 1060) continue; ctx.beginPath(); ctx.moveTo(fx, fy - 110); ctx.lineTo(fx + 50, fy); ctx.moveTo(fx + 50, fy - 110); ctx.lineTo(fx, fy); ctx.stroke(); }
    ctx.restore(); ctx.restore();
    C.seed(905); C.line(ctx, [[-1600, fy - 112], [0, fy - 112]], 3, P.dustDk, .8); C.line(ctx, [[1080, fy - 108], [2800, fy - 106]], 3, P.dustDk, .8);
    for (let px = -1530; px < 2800; px += 190) if (px < -10 || px > 1090) C.line(ctx, [[px, fy - 116], [px + 1, fy + 2]], 3.4, P.dustDk, .4);
  }
  function skipShed(g) {
    let st = 0; const DRAW = { fill: 1, stroke: 1, fillRect: 1, fillText: 1, strokeRect: 1, strokeText: 1 };
    return new Proxy(g, {
      get(tg, k) {
        if (DRAW[k]) return (...a) => {
          if (k === 'fill' && typeof tg.fillStyle === 'string') { const fs = tg.fillStyle.toLowerCase(); if (st === 0 && fs === '#9aa59c') st = 1; else if (st === 1 && fs === P.concrete) st = 2; }
          if (st === 1) return; tg[k](...a);
        };
        const v = tg[k]; return typeof v === 'function' ? v.bind(tg) : v;
      },
      set(tg, k, v) { tg[k] = v; return true; }
    });
  }
  // barakanın kalktığı yer: soluk toprak izi + eski temel taşları (ilk taş hariç: o canlı çizilir)
  function footprint(ctx) {
    C.seed(631);
    const Q = [[112, 1268], [664, 1268], [640, 1196], [134, 1200]];
    C.shape(ctx, Q, '#dcc79f', { lw: 0, shade: c => { C.blot(c, [[112, 1250], [664, 1250], [664, 1270], [112, 1270]], '#c6ad80', .7); for (let i = 0; i < 12; i++) C.blot(c, C.ell(150 + rnd(640 + i) * 480, 1205 + rnd(650 + i) * 55, 20 + rnd(660 + i) * 40, 4 + rnd(670 + i) * 4, 10), i % 2 ? '#c9b083' : '#eadbb8', .6); } });
    C.line(ctx, [[134, 1200], [640, 1196]], 2.4, 'rgba(110,100,87,.7)', .8);           // arka duvarın izi
    C.line(ctx, [[134, 1200], [112, 1266]], 2.4, 'rgba(110,100,87,.6)', .8); C.line(ctx, [[640, 1196], [664, 1266]], 2.4, 'rgba(110,100,87,.6)', .8);
    // eski temel taşları (köşeler + arka)
    [[656, 1262, 60, 30], [140, 1202, 40, 18], [634, 1198, 40, 18], [388, 1198, 34, 15]].forEach(([x, y, w, h], i) => stoneBlock(ctx, x, y, w, h, 640 + i));
  }
  function stoneBlock(ctx, x, y, w, h, sd) {
    C.seed(sd);
    C.shape(ctx, [[x - w / 2, y - h * .1], [x - w * .42, y - h], [x + w * .4, y - h * 1.04], [x + w / 2, y - h * .2], [x + w * .46, y + h * .12], [x - w * .46, y + h * .14]], '#b9ab8e', { lw: 2.6, shade: c => { C.blot(c, [[x - w, y - h * .3], [x + w, y - h * .3], [x + w, y + h], [x - w, y + h]], '#8f846f', .55); C.blot(c, C.ell(x - w * .15, y - h * .7, w * .2, h * .15, 8), '#d6cbb2', .6); } });
  }
  function helmetShape(ctx, lw) {
    C.seed(311);
    C.shape(ctx, [[-50, 8], [-46, -20], [-30, -40], [0, -48], [30, -40], [46, -20], [50, 8]], '#e3dccb', { lw, shade: c => { C.blot(c, [[10, -50], [60, -50], [60, 10], [18, 10]], '#b9b0a0', .7); C.blot(c, C.ell(-18, -14, 9, 5, 8), '#9a8f7c', .5); } });
    C.shape(ctx, [[-62, 6], [62, 6], [58, 16], [-58, 16]], '#d5ccba', { lw: lw * .9 });
    C.line(ctx, [[0, -48], [0, 6]], lw * .5, 'rgba(21,18,13,.4)', .3);
    C.line(ctx, [[-30, -26], [-18, -30]], lw * .45, '#6e6457', .3); C.line(ctx, [[22, -16], [34, -8]], lw * .45, '#6e6457', .3);
  }
  const HEAD = { stand: [6, -521, 1.12], side: [8, -524, 1.08], back: [4, -521, 1.12] };
  // Kaan (+ isteğe bağlı baret, kutu, liste). Tutam baretin tepesinden çıkar.
  function kaanH(ctx, o) {
    const pose = o.pose || 'stand', s = o.s, lw = 5.2 / Math.sqrt(s);
    ctx.save(); ctx.translate(o.x, o.y + (o.bob || 0)); ctx.rotate(o.rot || 0); ctx.translate(-o.x, -o.y);
    C.drawKaan(ctx, Object.assign({ seed: 11, phone: false }, o, { pose, bob: undefined }));
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.flip ? -s : s, s);
    if (o.box) kaanBox(ctx, pose, lw);
    if (o.helmet) {
      const h = HEAD[pose] || HEAD.stand;
      ctx.save(); ctx.translate(h[0], h[1]); ctx.scale(h[2], h[2]); helmetShape(ctx, lw / h[2]); ctx.restore();
      if (pose !== 'back') { ctx.save(); ctx.beginPath(); ctx.rect(-200, -700, 400, h[1] - 44 + 700); ctx.clip(); C.seed(541); C.shape(ctx, pose === 'side' ? TUFT.map(([x, y]) => [x - 2, y - 2]) : TUFT, P.hair, { lw }); ctx.restore(); }
      else { ctx.save(); ctx.beginPath(); ctx.rect(-200, -700, 400, h[1] - 44 + 700); ctx.clip(); C.seed(541); C.shape(ctx, TUFT, P.hair, { lw }); ctx.restore(); }
    }
    ctx.restore();
    ctx.restore();
  }
  const PX0 = -600;
  function yardBase() {   // dünya x −600…1800, y 0…2800
    return cached('avlu', 2400, 2800, g => {
      g.translate(-PX0, 0); ext(g);
      C.drawYard(skipShed(g), { seed: 7, mode: 'day', letter: false }); footprint(g);
      // ilk taşın çukuru (sol ön köşe) ve kenara konmuş taş
      C.seed(1009); C.shape(g, C.ell(122, 1270, 30, 9, 14), '#7d6a52', { lw: 2.2 });
      stoneBlock(g, 40, 1300, 70, 34, 1010);
    });
  }
  function grass(ctx, t) {
    for (let i = 0; i < 18; i++) {
      const r = j => rnd(1700 + i * 9 + j), x = -100 + r(1) * 1300, y = 1640 + r(2) * 500, ph = r(3) * 6;
      for (let q = 0; q < 5; q++) {
        const sw = Math.sin(t * 2.4 + ph + q * .5) * 6 + Math.sin(t * 4.7 + ph) * 2, hh = 18 + r(4 + q) * 18;
        ctx.strokeStyle = P.weed; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + q * 4, y);
        ctx.quadraticCurveTo(x + q * 4 + (q - 2) * 3, y - hh * .6, x + q * 4 + (q - 2) * 4 + sw, y - hh); ctx.stroke();
      }
    }
  }
  function drawBeacon(ctx, v) {   // pilotla aynı: yalnız uyarı ışığı (farlar değişmez)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(q => { const r = 40 + q * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - q * .2) * Math.min(1, v * 1.5), null, .5); }));
  }
  function drawEmber(ctx, v) {   // veda: ışık yumuşakça yanar ve söner (ses yayı YOK: bip değil)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -360, 6, 0, -360, 130); g.addColorStop(0, `rgba(255,150,100,${.55 * v})`); g.addColorStop(.5, `rgba(255,150,100,${.14 * v})`); g.addColorStop(1, 'rgba(255,150,100,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -360, 130, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = v * .85; C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), '#e8553c', { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,230,190,.7)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    ctx.restore();
  }
  /* ---------- kuş (5. bölümdeki "Look, a bird" şakasına sessiz gönderme): ayak ortası (x,y), sağa bakar ---------- */
  function bird(ctx, x, y, s, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(o.flip ? -s : s, s); C.seed(651);
    const lw = 3.4, body = '#8a6a4a', dk = '#5e4430';
    if (o.fly == null) { C.line(ctx, [[-3, -6], [-5, 2]], 2.4, P.ink, .1); C.line(ctx, [[6, -6], [7, 2]], 2.4, P.ink, .1); }
    C.shape(ctx, [[-18, -16], [-46, -8], [-44, -2], [-16, -8]], dk, { lw });
    C.shape(ctx, C.ell(0, -18, 25, 15, 16), body, { lw, shade: c => C.blot(c, C.ell(6, -10, 18, 7, 10), '#e8dcc4', .9) });
    const peck = o.peck || 0, hx = 22, hy = -30 + peck * 10;
    C.shape(ctx, C.ell(hx, hy, 12, 11, 12), body, { lw });
    C.shape(ctx, [[hx + 10, hy - 3], [hx + 23, hy + 1], [hx + 10, hy + 4]], '#c96a3e', { lw: lw * .7 });
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(hx + 4, hy - 2, 2.4, 0, TAU); ctx.fill();
    if (o.fly != null) { const a = o.fly; C.shape(ctx, [[-10, -24], [10, -26], [-2, -26 - 40 * a], [-24, -22 - 30 * a]], dk, { lw }); }
    else C.shape(ctx, [[-16, -24], [10, -26], [8, -14], [-20, -12]], dk, { lw });
    ctx.restore();
  }
  const PERCH = [70, -334];    // Daisy yereli: tavanın sağ ön köşesi
  function birdState(t) {      // konma: k.bird'den 0,6 sn uçuş, sonra oturur, ara ara gagalar
    const k = times(), u = seg(t, k.bird, k.bird + .6);
    if (t < k.bird) return null;
    if (u < 1) { const e = E.outQ(u), x = lerp(480, PERCH[0], e), y = lerp(-760, PERCH[1], e) - Math.sin(Math.PI * u) * 60, f = Math.floor((t - k.bird) * FPS);
      return { x, y, fly: f % 4 < 2 ? 1 : -.4 }; }
    const tw = twos(t), ph = (tw - k.bird) % 1.9;
    return { x: PERCH[0], y: PERCH[1], peck: ph > 1.2 && ph < 1.47 ? 1 : 0 };
  }
  function daisy(ctx, d) {
    C.drawDaisy(ctx, { x: d.x, y: d.y, s: d.s, seed: 23, beep: 0, mood: d.mood || 'sleepy', hook: d.hook || 0 });
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.s, d.s);
    if (d.beep > 0) drawBeacon(ctx, d.beep);
    if (d.ember > 0) drawEmber(ctx, d.ember);
    if (d.bird) bird(ctx, d.bird.x, d.bird.y, 1, d.bird);
    ctx.restore();
  }
  /* Defne'nin çizim masası: p7-b ile aynı nesne (kopya) */
  function drawDesk(ctx, x, y, s, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 4.4 / Math.sqrt(s);
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(6, 4, 210, 18, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(2801);
    [[-150, -248], [150, -248]].forEach(([lx, ly]) => C.line(ctx, [[lx, ly], [lx * .92, -10]], lw * 2.2, P.ink, .3));
    [[-150, -248], [150, -248]].forEach(([lx, ly]) => C.line(ctx, [[lx, ly], [lx * .92, -10]], lw * .9, P.floorWood, .2));
    C.line(ctx, [[-170, -60], [170, -60]], lw * 1.6, P.ink, .3); C.line(ctx, [[-170, -60], [170, -60]], lw * .6, P.floorWood, .2);
    C.shape(ctx, [[-196, -212], [196, -212], [176, -292], [-176, -292]], '#d9d3bf', { lw, shade: c => { C.blot(c, [[90, -300], [200, -300], [200, -205], [100, -205]], '#bdb59d', .6); } });
    C.shape(ctx, [[-198, -212], [198, -212], [198, -198], [-198, -198]], P.wood, { lw: lw * .9 });
    [-1, 1].forEach(d => { C.line(ctx, [[d * 182, -200], [d * 190, 0]], lw * 2.6, P.ink, .3); C.line(ctx, [[d * 182, -200], [d * 190, 0]], lw * 1.2, P.floorWood, .2); });
    C.shape(ctx, [[-120, -220], [60, -220], [52, -270], [-112, -270]], P.paper, { lw: lw * .7 });
    if (o.helmet !== false) C.shape(ctx, [[-188, -224], [-186, -250], [-172, -268], [-142, -272], [-118, -258], [-112, -228], [-104, -222], [-194, -220]], P.helmet, { lw, shade: c => C.blot(c, [[-150, -280], [-100, -280], [-100, -218], [-140, -222]], P.helmetDk, .7) });
    if (o.after) o.after(ctx, lw);
    ctx.restore();
  }
  // Defne konuşur/çizer: boyundan bölünür, baş eğilir (p7-b ile aynı)
  function drawDefneHead(ctx, o, headRot, headDy) {
    const s = (o.s || 1) * .9, neck = o.y - (o.pose === 'sit' ? 301 : 405) * s;
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, neck, 9000, 9000); ctx.clip(); C.drawDefne(ctx, o); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, -9000, 9000, neck + 9000 + 1); ctx.clip();
    ctx.translate(o.x + 2 * s, neck + (headDy || 0)); ctx.rotate(headRot || 0); ctx.translate(-(o.x + 2 * s), -neck); C.drawDefne(ctx, o); ctx.restore();
  }
  function world(ctx, t, o) {
    o = o || {};
    ctx.drawImage(yardBase(), PX0, 0);
    const items = [];
    if (o.daisy !== false) items.push([DAISY.y, () => daisy(ctx, Object.assign({ x: DAISY.x, y: DAISY.y, s: DAISY.s, hook: Math.sin(t * 1.1) * .025 }, o.daisy || {}))]);
    if (o.desk) items.push([DESK.y, () => drawDesk(ctx, DESK.x, DESK.y, DESK.s, o.desk)]);
    if (o.defne) items.push([SEAT.y - 1, () => drawDefneHead(ctx, Object.assign({ x: SEAT.x, y: SEAT.y, s: DESK.s, seed: 31, pose: 'sit' }, o.defne), o.defne.headRot, o.defne.headDy)]);
    if (o.kaan) items.push([o.kaan.y, () => kaanH(ctx, Object.assign({ seed: 11 }, o.kaan))]);
    (o.extra || []).forEach(e => items.push(e));
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    if (!o.noGrass) grass(ctx, t);
  }
  function blurredWorld(key, z, cx, cy, blur, o, sx, sy) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      cam(g, z, cx, cy, sx, sy); world(g, 0, Object.assign({ noGrass: true }, o || {}));
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, -20, -20, 1120, 1960); c.filter = 'none';
    });
  }
  const shot = (id, f0, f1, draw) => TB.shot({ id, t0: () => f0(times()), t1: () => f1(times()), draw });

  /* ================= 17–18: NOT =================
     A'nın son karesinden devam: aynı katlı not (arka yüz, aynalı soluk yazı), ekran ortası (540,760), s 1.08, −0,04 rad, aynı iki el ve
     aynı bulanık toprak/teneke zemini (p10-a dirt/stoneBed/tinTop/foldedNote/sideHand kopyası). Kaan notu tuttuğu yerden (yatay eksen)
     ters çevirir; not yukarı kalkar ve büyür: ön yüzde dedenin el yazısı üst üçte birde. */
  const INK_OLD = '#3a3026', NW = 520, NH = 330, NAX = 60;   // not yerel ölçüsü (A ile aynı), çevirme ekseni = ellerin tuttuğu çizgi
  const N0 = { x: 540, y: 760, s: 1.08, rot: -.04 }, N1 = { x: 475, y: 362, s: 1.36, rot: -.02 };
  function limb(ctx, A, B, wa, wb, fill, sd) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    return C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 7, shade: c => C.blot(c, [[A[0] - nx * wa * .1, A[1] - ny * wa * .1], [B[0] - nx * wb * .1, B[1] - ny * wb * .1], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], '#0b1f2a', .3) });
  }
  function sideHand(ctx, x, y, rot, s, o) {   // p10-a ile aynı el (yeşil ceket, sarı bileklik)
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, o.flipY ? -s : s); C.seed(o.sd || 451);
    limb(ctx, [150, 10], [900, 40], 70, 96, P.jacket, (o.sd || 451) + 1);
    C.shape(ctx, [[130, -66], [178, -70], [184, 74], [136, 78]], P.hazard, { lw: 5 });
    C.shape(ctx, [[-20, -44], [40, -64], [128, -58], [140, 0], [128, 60], [40, 62], [-14, 40], [-30, 0]], P.skin, { lw: 6, shade: c => C.blot(c, [[40, 20], [150, 20], [150, 80], [40, 80]], P.skinDk, .5) });
    C.line(ctx, [[-4, -18], [40, -14]], 3, P.skinDk, .3); C.line(ctx, [[-6, 14], [38, 16]], 3, P.skinDk, .3);
    C.shape(ctx, [[40, -64], [10, -96], [-26, -92], [-20, -66], [20, -50]], P.skin, { lw: 5 });
    ctx.restore();
  }
  function noteBg() {   // p10-a 'teneke-acik' ile aynı: toprak + taş yatağı + boş teneke, bulanık
    return cached('not-bg', 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      g.translate(540, 760); g.scale(1.6, 1.6);
      const dv = cached('toprak', 1600, 2400, d => {
        d.fillStyle = '#b89a6c'; d.fillRect(0, 0, 1600, 2400); C.seed(931);
        for (let i = 0; i < 140; i++) C.blot(d, C.ell(rnd(3000 + i) * 1600, rnd(3200 + i) * 2400, 20 + rnd(3400 + i) * 90, 10 + rnd(3600 + i) * 40, 10), i % 3 ? '#a88a5f' : '#cfb184', .45);
        for (let i = 0; i < 260; i++) { d.fillStyle = i % 2 ? 'rgba(110,100,87,.55)' : 'rgba(227,204,160,.6)'; d.beginPath(); d.arc(rnd(3800 + i) * 1600, rnd(4000 + i) * 2400, 2 + rnd(4200 + i) * 6, 0, TAU); d.fill(); }
      });
      g.drawImage(dv, -800, -1200);
      C.seed(941);
      C.shape(g, [[-260, -150], [250, -164], [270, 150], [-250, 160]], '#7f6646', { lw: 0, shade: c2 => { C.blot(c2, [[-260, -160], [270, -170], [270, -90], [-260, -80]], '#5e4a32', .7); } });
      g.save(); g.scale(.9, .9); C.seed(951); const W = 360, H = 230;
      g.save(); g.globalAlpha = .35; g.fillStyle = '#2a2118'; g.beginPath(); g.ellipse(10, 14, W * .62, H * .66, 0, 0, TAU); g.fill(); g.restore();
      C.shape(g, [[-W / 2, -H / 2], [W / 2, -H / 2 + 3], [W / 2 + 2, H / 2], [-W / 2 + 2, H / 2 + 2]], '#8f9aa3', { lw: 5, shade: c2 => C.blot(c2, [[W * .25, -H], [W, -H], [W, H], [W * .3, H]], '#5d6873', .5) });
      C.shape(g, [[-W / 2 + 16, -H / 2 + 16], [W / 2 - 16, -H / 2 + 18], [W / 2 - 14, H / 2 - 14], [-W / 2 + 16, H / 2 - 14]], '#4c565f', { lw: 3 });
      g.restore();
      c.filter = 'blur(10px)'; c.drawImage(tmp, -20, -20, 1120, 1960); c.filter = 'none';
      c.fillStyle = 'rgba(30,22,14,.25)'; c.fillRect(0, 0, 1080, 1920);
    });
  }
  function noteSheet(ctx, front) {   // yerel (0,0) orta, NW×NH; ön yüz: dedenin yazısı; arka: aynalı soluk sızıntı (A ile aynı)
    C.seed(961);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(-NW / 2 + 10, -NH / 2 + 12, NW, NH); ctx.restore();
    C.shape(ctx, [[-NW / 2, -NH / 2], [NW / 2, -NH / 2 + 4], [NW / 2 - 2, NH / 2], [-NW / 2 + 2, NH / 2 - 2]], '#efe2c0', { lw: 4.4, shade: c => {
      C.blot(c, front ? [[-NW, -NH], [0, -NH], [0, NH], [-NW, NH]] : [[0, -NH], [NW, -NH], [NW, NH], [0, NH]], '#e2d1a8', .55);
      for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(160,118,62,${.06 + rnd(970 + i) * .1})`; c.beginPath(); c.arc((front ? -1 : 1) * (-NW / 2 + rnd(975 + i) * NW), -NH / 2 + rnd(980 + i) * NH, 4 + rnd(985 + i) * 12, 0, TAU); c.fill(); }
      if (!front) { c.save(); c.globalAlpha = .2; c.scale(-1, 1); C.handwrite(c, 'Ant.', -NW / 2 + 60, -50, 56, INK_OLD, 31); C.handwrite(c, 'Now build something.', -NW / 2 + 60, 40, 44, INK_OLD, 33); c.restore(); }
    } });
    C.line(ctx, [[2, -NH / 2 + 6], [0, NH / 2 - 4]], 3, 'rgba(138,106,64,.7)', .5);
    ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#8a6a40'; ctx.fillRect(front ? -26 : 0, -NH / 2 + 6, 26, NH - 10); ctx.restore();
    if (front) {   // dedenin el yazısı (drawTin notuyla aynı iki satır), net
      C.handwrite(ctx, 'Ant.', -NW / 2 + 112, -40, 74, INK_OLD, 31, { bold: true });
      C.handwrite(ctx, 'Now build something.', -NW / 2 + 70, 66, 41, INK_OLD, 33, { bold: true });
    }
  }
  shot('p10b17-not', k => k.start, k => k.school, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.save(); ctx.translate(540, 960); const bz = 1.03 + .05 * u; ctx.scale(bz, bz); ctx.translate(-540, -960); ctx.drawImage(noteBg(), 0, 0); ctx.restore();
    ctx.fillStyle = 'rgba(30,22,14,.25)'; ctx.fillRect(0, 0, 1080, 1920);
    // not kalkar, büyür (birerli), elde ters çevrilir (ikişerli)
    const mv = E.ioC(seg(t, k.start, k.f2e + .1)), push = 1 + .05 * E.io(seg(t, k.f2e, k.school));
    const s = lerp(N0.s, N1.s, mv) * push, rot = lerp(N0.rot, N1.rot, mv) + Math.sin(tw * .9) * .004;
    const x = lerp(N0.x, N1.x, mv) + Math.sin(tw * 1.1 + 1) * 2, y = lerp(N0.y, N1.y, mv) + Math.sin(tw * 1.6) * 3 * mv;
    const fl = E.io(seg(tw, k.f1, k.ant - .02)), cy = Math.cos(Math.PI * fl);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.save();
    if (cy >= 0) { ctx.translate(0, NAX - cy * NAX); ctx.scale(1, Math.max(cy, .001)); noteSheet(ctx, false); }
    else { ctx.translate(0, NAX - cy * NAX); ctx.scale(1, -cy); noteSheet(ctx, true); }
    ctx.restore();
    if (Math.abs(cy) < .9) { ctx.save(); ctx.globalAlpha = .25 * (1 - Math.abs(cy)); ctx.fillStyle = P.ink; ctx.fillRect(-NW / 2, NAX - Math.abs(cy) * NH, NW, Math.abs(cy) * NH * 2); ctx.restore(); }
    ctx.restore();
    // iki el notu kenarlarından tutar (A ile aynı yerleşim; çevirme ekseni ellerin hizası)
    const c = Math.cos(rot), sn = Math.sin(rot), hw = 260 * s, hs = .8 * s / N0.s;
    sideHand(ctx, x - hw * c + 30 * hs / .8, y - hw * sn + NAX * s, Math.PI * .78, hs, { sd: 521 });
    sideHand(ctx, x + hw * c - 30 * hs / .8, y + hw * sn + NAX * s, Math.PI * .22, hs, { sd: 525, flipY: true });
    sun(ctx, .45 * mv);
    airDust(ctx, t, 14, 71, [100, 300, 880, 900], .6, '216,202,176');
    vignette(ctx, .45);
    finish(ctx);
  });

  /* ================= 19: OKUL (p7-a'daki bina; bu kez yaz, kapı açık, içeri giriyor) ================= */
  function drawSchool(ctx) {
    const cv = cached('okul', 1080, 1920, c => {
      C.seed(721);
      const sk = c.createLinearGradient(0, 0, 0, 1100); sk.addColorStop(0, '#8fbadb'); sk.addColorStop(1, '#e6e2cc'); c.fillStyle = sk; c.fillRect(0, 0, 1080, 1100);
      C.shape(c, [[-20, 260], [1100, 260], [1100, 1100], [-20, 1100]], '#c8b79a', { lw: 5, shade: g => { for (let y = 300; y < 1100; y += 26) { g.strokeStyle = 'rgba(21,18,13,.08)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, y); g.lineTo(1100, y); g.stroke(); } C.blot(g, [[820, 240], [1110, 240], [1110, 1110], [860, 1110]], '#9d8c70', .35); } });
      C.shape(c, [[-30, 230], [1110, 230], [1110, 268], [-30, 268]], '#8d7f6a', { lw: 5 });
      for (const wx of [40, 220, 760, 940]) for (const wy of [330, 620]) C.shape(c, [[wx, wy], [wx + 120, wy], [wx + 120, wy + 190], [wx, wy + 190]], '#6e8592', { lw: 4, shade: g => { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(wx + 20, wy - 10, 16, 210); } });
      C.shape(c, [[380, 470], [700, 470], [700, 1100], [380, 1100]], '#b3a284', { lw: 5 });
      C.shape(c, [[410, 690], [670, 690], [670, 1080], [410, 1080]], '#4d4a44', { lw: 5 });
      // sol kanat kapalı, sağ kanat açık: içeride sıcak koridor ışığı
      C.shape(c, [[426, 706], [536, 706], [536, 1080], [426, 1080]], '#7f97a3', { lw: 4, shade: g => { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(450, 700, 14, 400); } });
      C.shape(c, [[544, 706], [654, 706], [654, 1080], [544, 1080]], '#e9d6a8', { lw: 4, shade: g => { const gr = g.createLinearGradient(0, 706, 0, 1080); gr.addColorStop(0, 'rgba(255,236,190,.9)'); gr.addColorStop(1, 'rgba(200,170,120,.6)'); g.fillStyle = gr; g.fillRect(544, 706, 110, 374); g.fillStyle = 'rgba(120,96,64,.35)'; g.fillRect(560, 990, 80, 90); } });
      C.shape(c, [[654, 706], [690, 716], [690, 1070], [654, 1080]], '#6f8794', { lw: 4 });
      C.line(c, [[520, 880], [520, 930]], 6);
      C.shape(c, [[360, 520], [720, 520], [720, 640], [360, 640]], '#efe6d2', { lw: 5 });
      c.font = '700 40px Rubik'; c.textAlign = 'center'; c.fillStyle = P.ink; c.fillText('SCHOOL OF', 540, 570); c.fillText('ENGINEERING', 540, 618);
      c.fillStyle = '#9a9488'; c.fillRect(-20, 1100, 1120, 820);
      [[340, 1100, 400], [310, 1130, 460], [280, 1160, 520]].forEach(([x, y, w]) => C.shape(c, [[x, y], [x + w, y], [x + w, y + 30], [x, y + 30]], '#bdb5a4', { lw: 4 }));
      const gg = c.createLinearGradient(0, 1190, 0, 1920); gg.addColorStop(0, '#a19a8c'); gg.addColorStop(1, '#6f6a60'); c.fillStyle = gg; c.fillRect(-20, 1190, 1120, 730); C.line(c, [[-20, 1190], [1100, 1190]], 4);
      // yaz güneşi: duvarda yaprak gölgesi
      for (let i = 0; i < 14; i++) C.blot(c, C.ell(rnd(i + 900) * 340, 300 + rnd(i + 910) * 600, 30 + rnd(i + 920) * 40, 14 + rnd(i + 930) * 16, 10), '#9d8c70', .3);
    });
    ctx.drawImage(cv, 0, 0);
  }
  function drawTree(ctx, t) {   // p7-a'daki ağaç, bu kez yapraklı
    const sw = Math.sin(t * 1.6) * .03 + Math.sin(t * 2.7) * .012;
    C.seed(731);
    C.shape(ctx, [[110, 1500], [150, 1500], [146, 1060], [118, 1060]], '#4a3a2c', { lw: 5 });
    const tips = [];
    const br = (x, y, a, L, d, sd) => {
      const a2 = a + sw * (5 - d), x2 = x + Math.cos(a2) * L, y2 = y + Math.sin(a2) * L;
      C.seed(sd); C.line(ctx, [[x, y], [x2, y2]], Math.max(2, 9 - d * 2), '#4a3a2c', .6);
      if (d >= 3) { tips.push([x2, y2, sd]); return; }
      br(x2, y2, a - .45, L * .72, d + 1, sd * 2 + 1); br(x2, y2, a + .4, L * .7, d + 1, sd * 2 + 2);
    };
    br(132, 1070, -1.62, 190, 0, 7);
    tips.forEach(([x, y, sd], i) => { C.seed(sd + 50); C.shape(ctx, C.ell(x, y, 44 + rnd(sd) * 20, 34 + rnd(sd + 1) * 14, 12), i % 3 ? P.weed : '#95a35a', { lw: 3.2, shade: c => C.blot(c, C.ell(x + 14, y + 10, 30, 18, 10), '#5d6a34', .5) }); });
  }
  shot('p10b19-okul', k => k.school, k => k.desk, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u), z = lerp(1.0, 1.05, e);
    ctx.save(); cam(ctx, z, 540, 980);
    drawSchool(ctx);
    drawTree(ctx, t);
    // Kaan arkadan, çanta sırtında, açık kapıya yürür (ikişerli)
    const wu = seg(tw, k.school - .05, k.desk + .25), kx = lerp(430, 560, wu), ky = lerp(1600, 1215, E.outQ(wu)), ks = lerp(.74, .54, wu);
    const bob = Math.abs(Math.sin(tw * Math.PI * 2.4)) * 7;
    C.drawKaan(ctx, { pose: 'back', x: kx, y: ky - bob, s: ks, seed: 11 });
    ctx.save(); ctx.translate(kx, ky - bob); ctx.scale(ks, ks); C.seed(741);
    C.shape(ctx, [[-56, -392], [56, -392], [62, -250], [-62, -250]], '#7a4a32', { lw: 7, shade: c => C.blot(c, [[20, -400], [70, -400], [70, -240], [30, -240]], '#5a3422', .5) });
    C.shape(ctx, [[-36, -330], [36, -330], [38, -270], [-38, -270]], '#8c5a3e', { lw: 5 });
    C.line(ctx, [[-30, -392], [-40, -420]], 6); C.line(ctx, [[30, -392], [40, -420]], 6);
    ctx.restore();
    ctx.restore();
    sun(ctx, .55);
    vignette(ctx, .22);
    finish(ctx);
  });

  /* ================= 20: Defne masada, avluda ================= */
  shot('p10b20-masa', k => k.desk, k => k.top, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.55, 1.62, e), lerp(330, 310, e), 1540, 520, 880);
    const pen = Math.sin(tw * 9) * 10;
    world(ctx, t, {
      desk: { helmet: true, after: (c, lw) => { C.seed(2902); C.line(c, [[-60 + pen, -246], [-40 + pen, -262]], lw * 1.2, P.pencil, .1); } },
      defne: { expr: tw > k.desk + .6 ? 'smile' : 'calm', look: .2, blink: blinkAt(tw, [k.desk + .45]), headRot: .12 + Math.sin(tw * 2) * .015, headDy: 4 }
    });
    airDust(ctx, t, 16, 43, [0, 1000, 1080, 700], .7);
    ctx.restore();
    sun(ctx, .8);
    vignette(ctx, .2);
    finish(ctx);
  });

  /* ================= 20–22: çizim (üstten): küçük, sağlam ofis; "small." "strong." ================= */
  const GRAPH = '#4a4a50';
  const PLAN = [   // [t başlangıç oranı, süre oranı, noktalar] — k.top..k.small arası
    [0, .14, [[210, 830], [760, 830]]],                                     // zemin çizgisi
    [.12, .16, [[340, 830], [340, 590], [610, 590], [610, 830]]],          // duvarlar
    [.27, .1, [[316, 590], [634, 590], [634, 560], [316, 560], [316, 590]]],// kalın çatı plağı
    [.37, .1, [[440, 830], [440, 712], [500, 712], [500, 830]]],          // kapı
    [.47, .1, [[370, 640], [430, 640], [430, 690], [370, 690], [370, 640]]],// pencere
    [.57, .12, [[326, 830], [326, 880], [624, 880], [624, 830]]],          // temel
    [.7, .1, [[340, 940], [610, 940]]],                                     // ölçü çizgisi
    [.7, .05, [[340, 926], [340, 954]]], [.75, .05, [[610, 926], [610, 954]]]
  ];
  function plTime(t) { const k = times(); return seg(t, k.top + .08, k.small - .12); }
  function partial(pts, u) {
    if (u <= 0) return null; const L = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
    let rem = tot * u; const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) { if (rem >= L[i - 1]) { out.push(pts[i]); rem -= L[i - 1]; } else { const f = rem / L[i - 1]; out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; } }
    return out;
  }
  function deskTopBg() {
    return cached('masa-ust', 1080, 1920, c => {
      c.fillStyle = '#d9d3bf'; c.fillRect(0, 0, 1080, 1920); C.seed(3701);
      for (let i = 0; i < 10; i++) C.blot(c, C.ell(rnd(3710 + i) * 1080, rnd(3720 + i) * 1920, 120 + rnd(3730 + i) * 160, 30 + rnd(3740 + i) * 30, 12), '#c4bca3', .5);
      C.seed(3750); C.shape(c, [[130, 230], [840, 214], [860, 1330], [118, 1346]], P.paper, { lw: 4, shade: g => { g.strokeStyle = 'rgba(31,79,224,.07)'; g.lineWidth = 2; for (let x = 150; x < 850; x += 40) { g.beginPath(); g.moveTo(x, 230); g.lineTo(x, 1330); g.stroke(); } for (let y = 250; y < 1330; y += 40) { g.beginPath(); g.moveTo(130, y); g.lineTo(850, y); g.stroke(); } } });
      C.handwrite(c, 'NEW OFFICE', 230, 400, 54, GRAPH, 811, { bold: true });
      C.seed(3760); C.line(c, [[226, 418], [520, 414]], 3, GRAPH, .6);
    });
  }
  function hatch(ctx, u) {   // temelin içi tarama (sağlam)
    if (u <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(326, 830, 298 * u, 50); ctx.clip(); ctx.strokeStyle = GRAPH; ctx.lineWidth = 2.4;
    for (let x = 300; x < 660; x += 16) { ctx.beginPath(); ctx.moveTo(x, 880); ctx.lineTo(x + 40, 830); ctx.stroke(); } ctx.restore();
  }
  function wordReveal(ctx, txt, x, y, size, sd, u) {   // el yazısı soldan açılır; kalem ucunun yeri döner
    if (u <= 0) return null;
    ctx.save(); ctx.font = `500 ${size}px Rubik`; const w = ctx.measureText(txt).width * .95; ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x - 20, y - size * 1.2, w * u + 20, size * 1.6); ctx.clip(); C.handwrite(ctx, txt, x, y, size, GRAPH, sd, { bold: true }); ctx.restore();
    return [x + w * u, y - size * .3 + Math.sin(u * 30) * size * .18];
  }
  function pencilHand(ctx, tip, tw) {   // Defne'nin eli, kalemle (sağ alttan)
    const [x, y] = tip; ctx.save(); ctx.translate(x, y); ctx.scale(.82, .82); C.seed(2951);
    C.tube(ctx, [[90, 40], [180, 200], [250, 330]], 70, 78, P.dSkin, 6, { shade: c => C.blot(c, [[150, 80], [280, 300], [240, 340]], P.dSkinDk, .5) });
    C.shape(ctx, [[196, 330], [300, 286], [560, 900], [380, 980]], P.shirt, { lw: 6, shade: c => C.blot(c, [[290, 300], [560, 900], [500, 930]], P.shirtDk, .7) });
    C.line(ctx, [[204, 344], [302, 300]], 4, P.shirtDk, .3);
    C.line(ctx, [[0, 0], [150, -130]], 16, P.ink, .1); C.line(ctx, [[0, 0], [150, -130]], 9, P.pencil, .1);
    C.shape(ctx, [[-3, 3], [12, -20], [22, -10]], '#e7c8a0', { lw: 3 }); ctx.fillStyle = GRAPH; ctx.beginPath(); ctx.arc(1, 1, 4, 0, TAU); ctx.fill();
    C.shape(ctx, C.ell(84, 30, 62, 52, 18), P.dSkin, { lw: 6, shade: c => C.blot(c, C.ell(110, 50, 40, 30, 12), P.dSkinDk, .5) });
    C.tube(ctx, [[40, 0], [20, -26], [30, -50]], 26, 22, P.dSkin, 5);
    C.tube(ctx, [[60, -10], [40, -56], [56, -70]], 26, 22, P.dSkin, 5);
    ctx.restore();
  }
  shot('p10b20-cizim', k => k.top, k => k.yard, (ctx, t, u) => {
    const k = times(), tw = twos(t), pu = plTime(tw), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.0, 1.06, e), 480, lerp(700, 740, e), 480, 700);
    ctx.drawImage(deskTopBg(), 0, 0);
    let tip = null;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    PLAN.forEach(([a, d, pts], i) => { const q = seg(pu, a, a + d), pp = partial(pts, q); if (!pp) return; C.seed(3800 + i); C.line(ctx, pp, i === 2 || i === 5 ? 5 : 3.6, GRAPH, .25); if (q > 0 && q < 1) tip = pp[pp.length - 1]; });
    ctx.restore();
    hatch(ctx, seg(pu, .82, 1)); if (pu > .82 && pu < 1) tip = [326 + 298 * seg(pu, .82, 1), 856];
    const sm = wordReveal(ctx, 'small.', 650, 960, 66, 821, seg(tw, k.small, k.small + .42)); if (sm && tw < k.small + .42) tip = sm;
    // "strong." temelin yanında, kısa çizgiyle temele bağlanır
    const su = seg(tw, k.strong - .06, k.strong + .4);
    if (su > 0) { const lu = seg(su, 0, .25), pp = partial([[628, 860], [676, 846]], lu); if (pp) { C.seed(3900); C.line(ctx, pp, 3, GRAPH, .2); } }
    const st = wordReveal(ctx, 'strong.', 690, 870, 66, 831, seg(su, .2, 1)); if (st && su < 1) tip = st; else if (su > 0 && su < .2) tip = [676, 846];
    if (!tip) tip = tw < k.small ? [600 + Math.sin(tw * 3) * 6, 1010] : tw < k.strong ? [820, 990] : [900, 930];
    pencilHand(ctx, tip, tw);
    ctx.restore();
    sun(ctx, .35);
    vignette(ctx, .25);
    finish(ctx);
  });

  /* ================= 23–24: Daisy emekli, güneşte ================= */
  shot('p10b23-avlu', k => k.yard, k => k.dmed, (ctx, t, u) => {
    const k = times(), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.0, 1.06, e), lerp(640, 680, e), 1460, 540, 800);
    world(ctx, t, { desk: { helmet: true } });
    airDust(ctx, t, 22, 51, [-100, 600, 1300, 900], .8);
    ctx.restore();
    sun(ctx, 1);
    vignette(ctx, .18);
    finish(ctx);
  });
  shot('p10b24-daisy', k => k.dmed, k => k.bcu, (ctx, t, u) => {
    const k = times(), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.75, 1.86, e), 880, 1460, 540, 780);
    world(ctx, t, { daisy: { bird: birdState(t) } });
    airDust(ctx, t, 18, 53, [200, 700, 900, 900], .8);
    ctx.restore();
    sun(ctx, 1);
    vignette(ctx, .2);
    finish(ctx);
  });

  /* ================= 25–26: SON İKİ BİP (pilot kalıbı) ================= */
  const CU = { z0: 2.3, z1: 2.42, cx: 900, cy: 1410, sx: 500, sy: 830 };
  shot('p10b25-bip', k => k.bcu, k => k.check, (ctx, t, u) => {
    const k = times(), tf = frozen(t), ft = flow(t);
    const zu = tf < k.fr0 ? E.outC(seg(tf, k.bcu, k.fr0)) : 1;
    const z = lerp(CU.z0, CU.z1, zu) + (t >= k.fr1 ? .05 * E.io(seg(t, k.fr1, k.check)) : 0);
    const bg = blurredWorld('bg-bip', CU.z0, CU.cx, CU.cy, 7, { daisy: false, desk: { helmet: true } }, CU.sx, CU.sy);
    ctx.save(); ctx.translate(540, 960); const bz = 1 + (z - CU.z0) * .08; ctx.scale(bz, bz); ctx.drawImage(bg, -540, -960); ctx.restore();
    ctx.save(); cam(ctx, z, CU.cx, CU.cy, CU.sx, CU.sy);
    daisy(ctx, { x: DAISY.x, y: DAISY.y, s: DAISY.s, mood: tf >= k.alert ? 'alert' : 'sleepy', hook: Math.sin(ft * 1.1) * .025, beep: beepV(t, k.beep), bird: birdState(ft) });
    ctx.restore();
    airDust(ctx, ft, 12, 57, [0, 300, 1080, 900], .6);   // donmada zerreler de durur
    sun(ctx, .8);
    vignette(ctx, .3);
    finish(ctx);
  });

  /* ================= 27: "I checked everything." hızlı üçlü montaj ================= */
  function groundTex() {
    return cached('zemin', 1080, 1920, c => {
      const gg = c.createLinearGradient(0, 0, 0, 1920); gg.addColorStop(0, P.groundLt); gg.addColorStop(1, P.ground); c.fillStyle = gg; c.fillRect(0, 0, 1080, 1920);
      for (let i = 0; i < 160; i++) { C.seed(6100 + i); const x = rnd(6200 + i) * 1080, y = rnd(6300 + i) * 1920, r = 6 + rnd(6400 + i) * 22; C.shape(c, C.ell(x, y, r, r * .7, 9), [P.concrete, P.dustLt, '#b59a72', P.dust][i % 4], { lw: 2.4, amp: .6 }); }
      for (let i = 0; i < 20; i++) C.blot(c, C.ell(rnd(6500 + i) * 1080, rnd(6600 + i) * 1920, 60 + rnd(6700 + i) * 120, 20 + rnd(6800 + i) * 30, 12), P.groundDk, .3);
    });
  }
  function brickWall() {
    return cached('duvar', 1080, 1920, c => {
      c.fillStyle = P.mortar; c.fillRect(0, 0, 1080, 1920); C.seed(6901);
      for (let r = 0; r < 26; r++) for (let q = -1; q < 7; q++) { const x = q * 180 + (r % 2) * 90, y = r * 76; C.shape(c, [[x + 6, y + 6], [x + 174, y + 6], [x + 174, y + 70], [x + 6, y + 70]], (r * 7 + q) % 5 ? P.brick : P.brickLt, { lw: 3, amp: .6, shade: g => C.blot(g, [[x + 120, y + 4], [x + 176, y + 4], [x + 176, y + 72], [x + 130, y + 72]], P.brickDk, .4) }); }
    });
  }
  function hookCU(ctx, x, y, s, sw) {   // Daisy'nin kancası (drawDaisy'deki çizim), yakın
    ctx.save(); ctx.translate(x, y); ctx.rotate(-sw); ctx.scale(s, s); C.seed(23); const lw = 5.6;
    C.line(ctx, [[0, -900], [0, -40]], lw * .7, null, .3);
    const hb = C.shape(ctx, [[-24, -40], [24, -40], [26, 8], [-26, 8]], null, { lw: 0 });
    C.hazardStripes(ctx, hb, -28, -44, 56, 56, 12); C.ink(ctx, hb, lw * .8);
    ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw * 2.4; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, 22); ctx.arc(-10, 32, 12, -.3, Math.PI * .9, false); ctx.stroke();
    ctx.strokeStyle = P.steelLt; ctx.lineWidth = lw * .9; ctx.stroke();
    ctx.restore();
  }
  function level(ctx, x, y, rot, bub) {   // su terazisi: alüminyum gövde, yeşil cam, kabarcık
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); C.seed(7001);
    C.shape(ctx, [[-330, -46], [330, -46], [330, 46], [-330, 46]], P.steelLt, { lw: 6, shade: c => { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-330, -40, 660, 10); C.blot(c, [[-330, 20], [330, 20], [330, 50], [-330, 50]], P.steel, .5); } });
    C.shape(ctx, [[-90, -26], [90, -26], [90, 26], [-90, 26]], '#b9dca0', { lw: 4, shade: c => { c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-90, -24, 180, 8); } });
    C.line(ctx, [[-30, -26], [-30, 26]], 3); C.line(ctx, [[30, -26], [30, 26]], 3);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(bub * 60, 0, 22, 14, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  shot('p10b27-zemin', k => k.check, k => k.c1, (ctx, t, u) => {
    const k = times(), tw = ones(t), inU = E.outC(seg(tw, k.check, k.check + .14)), press = E.io(seg(tw, k.check + .14, k.check + .24));
    ctx.save(); ctx.translate(0, (1 - E.outC(seg(t, k.check, k.check + .12))) * -40); ctx.drawImage(groundTex(), 0, 0); ctx.restore();
    // avuç zemine basar; küçük toz
    if (press > 0) for (let i = 0; i < 10; i++) { const r = j => rnd(7100 + i * 5 + j), a = seg(t, k.check + .2, k.c1 + .1); ctx.fillStyle = `rgba(216,202,176,${.6 * (1 - a)})`; ctx.beginPath(); ctx.arc(520 + (r(1) - .5) * 420, 620 + (r(2) - .5) * 300 - a * 40, 10 + a * 30 * r(3), 0, TAU); ctx.fill(); }
    kaanHand(ctx, lerp(640, 540, inU), lerp(1500, 900, inU) + press * 10, -.08, lerp(2.3, 2.2 - press * .06, inU), 'flat', 621);
    vignette(ctx, .3);
    finish(ctx);
  });
  shot('p10b27-kanca', k => k.c1, k => k.c2, (ctx, t, u) => {
    const k = times(), tw = ones(t), g = seg(tw, k.c1 + .1, k.c1 + .2), tug = Math.sin(Math.PI * seg(tw, k.c1 + .2, k.c1 + .38)) * 26;
    const bg = blurredWorld('bg-kanca', 2.1, 800, 1250, 10, { daisy: false, desk: { helmet: true } }, 540, 760);
    ctx.save(); ctx.translate((1 - E.outC(seg(t, k.c1, k.c1 + .12))) * 50, 0); ctx.drawImage(bg, 0, 0); ctx.restore();
    const sw = .05 * Math.sin((t - k.c1) * 7) * Math.exp(-(t - k.c1) * 2) + (g > 0 ? -.02 * g : 0);
    hookCU(ctx, 470, 620 + tug, 5.2, sw);
    kaanHand(ctx, lerp(900, 640, E.outC(g)), lerp(1300, 860, E.outC(g)) + tug, -.55, 2.0, 'grip', 622);
    vignette(ctx, .3);
    finish(ctx);
  });
  shot('p10b27-duvar', k => k.c2, k => k.under, (ctx, t, u) => {
    const k = times(), tw = ones(t), inU = E.outC(seg(tw, k.c2, k.c2 + .14)), bub = lerp(1.3, 0, E.outBack(seg(t, k.c2 + .14, k.c2 + .42)));
    ctx.save(); ctx.translate(0, (1 - E.outC(seg(t, k.c2, k.c2 + .12))) * 50); ctx.drawImage(brickWall(), 0, 0); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,214,150,.12)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    level(ctx, lerp(300, 470, inU), 640, lerp(.12, 0, inU), bub);
    kaanHand(ctx, lerp(120, 300, inU), 800, -1.2, 1.6, 'flat', 623);
    vignette(ctx, .3);
    finish(ctx);
  });

  /* ================= 28: "Then I understood." Kaan durur, yüzü yumuşar ================= */
  shot('p10b28-anladi', k => k.under, k => k.bye, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    const bg = blurredWorld('bg-kaan', 1.6, 900, 1430, 9, { desk: { helmet: true } }, 700, 860);
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + u * .04, 1 + u * .04); ctx.drawImage(bg, -540, -960); ctx.restore();
    const expr = tw < k.soft - .05 ? 'worried' : tw < k.soft + .35 ? 'calm' : 'smile';
    const breath = Math.sin(tw * 1.5) * 5 + E.io(seg(tw, k.soft, k.soft + .4)) * 10;   // omuzlar iner: rahatlar
    ctx.save(); cam(ctx, lerp(1, 1.05, e), 540, 960);
    kaanH(ctx, { x: 420, y: 1960 + breath, s: 2.6, expr, look: .8, blink: blinkAt(tw, [k.soft + .02]), helmet: true, seed: 11 });
    ctx.restore();
    sun(ctx, .9);
    vignette(ctx, .25);
    finish(ctx);
  });

  /* ================= 29 + 2 sn sessizlik: veda; ışık son kez yumuşakça söner; çok yavaş geri çekilme ================= */
  shot('p10b29-veda', k => k.bye, k => k.cta + .3, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const pull = E.io(seg(t, k.bye, k.cta + .3));
    const ember = Math.min(E.outQ(seg(t, k.glow - .1, k.glow + .35)), 1 - E.io(seg(t, k.glow + .45, k.glow + 1.9)));
    const mood = t < k.glow + 1.2 ? 'alert' : 'sleepy';   // ışık sönünce siperlik yarıya iner: huzur
    ctx.save(); cam(ctx, lerp(1.42, 1.14, pull), lerp(830, 800, pull), lerp(1470, 1480, pull), 520, lerp(820, 780, pull));
    world(ctx, t, {
      desk: { helmet: true },
      daisy: { mood, ember, bird: birdState(t) },
      kaan: { x: 690, y: 1700, s: .82, helmet: true, expr: 'smile', look: 1, blink: blinkAt(tw, [k.bye + .8, k.glow + 1.6]), phone: false }
    });
    airDust(ctx, t, 20, 61, [0, 700, 1200, 900], .8);
    ctx.restore();
    sun(ctx, 1);
    vignette(ctx, .2);
    finish(ctx);
  });

  /* ================= 30–35: KARAKTER DIŞI ÇAĞRI (kâğıt zemin, gerçek simge, gerçek oyun kareleri) ================= */
  const ICON = 'assets/img/oyun-simge.png'; TB.img(ICON);
  const gameImgs = {};
  for (let i = 1; i <= 100; i++) gameImgs[i] = TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg');
  function gameIdx(t) {
    const k = times();
    if (t < k.plan - .2) return 1 + Math.min(54, Math.max(0, Math.floor((t - k.game - .1) * FPS)));      // k1: yıkım + DEMOLISHED!
    return 56 + Math.min(44, Math.max(0, Math.floor((t - k.plan - .05) * FPS)));                      // k2: kule planlı devrilir
  }
  function iconAt(ctx, cx, cy, s, a) {
    const im = TB.pic(ICON); if (!im || !im.naturalWidth || a <= 0 || s <= 0) return;
    const x = cx - s / 2, y = cy - s / 2, r = s * .2237;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.fillStyle = 'rgba(21,18,13,.22)'; rrect(ctx, x + s * .02, y + s * .045, s, s, r); ctx.fill();
    rrect(ctx, x, y, s, s, r); ctx.save(); ctx.clip(); ctx.drawImage(im, x, y, s, s); ctx.restore();
    ctx.lineWidth = Math.max(3, s * .028); ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.restore();
  }
  function phone(ctx, cx, cy, sc, a, img) {   // pilot telefonu (gövde 548×1000, ekran 486×864), eller yok
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.rotate(-.02); ctx.scale(sc, sc);
    const SW = 486, SH = 864, BW = 548, BH = 1000;
    ctx.fillStyle = 'rgba(21,18,13,.22)'; rrect(ctx, -BW / 2 + 16, -BH / 2 + 26, BW, BH, 64); ctx.fill();
    C.seed(171); C.shape(ctx, rrectPts(-BW / 2, -BH / 2, BW, BH, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BW / 2, -BH / 2, 30, BH); } });
    C.shape(ctx, [[-60, -BH / 2 + 24], [60, -BH / 2 + 24], [60, -BH / 2 + 36], [-60, -BH / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SW / 2, -SH / 2, SW, SH, 34); ctx.clip();
    if (img && img.naturalWidth) ctx.drawImage(img, -SW / 2, -SH / 2, SW, SH); else { ctx.fillStyle = '#2f3a4b'; ctx.fillRect(-SW / 2, -SH / 2, SW, SH); }
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SW / 2, -SH / 2 + 80); ctx.lineTo(-SW / 2 + 220, -SH / 2); ctx.lineTo(-SW / 2 + 300, -SH / 2); ctx.lineTo(-SW / 2, -SH / 2 + 180); ctx.fill();
    ctx.restore();
    C.seed(172); C.ink(ctx, C.pathOf(C.wobble(rrectPts(-SW / 2, -SH / 2, SW, SH, 34, 6), true, .5), true), 4);
    ctx.restore();
  }
  function paperBg(ctx) {
    ctx.drawImage(cached('kagit', 1080, 1920, c => {
      c.fillStyle = P.paper; c.fillRect(0, 0, 1080, 1920);
      const g = c.createRadialGradient(475, 640, 100, 475, 760, 1300); g.addColorStop(0, 'rgba(255,252,240,.55)'); g.addColorStop(1, 'rgba(200,180,140,.25)'); c.fillStyle = g; c.fillRect(0, 0, 1080, 1920);
      for (let q = 0; q < 16; q++) { c.fillStyle = `rgba(160,118,62,${.03 + rnd(9100 + q) * .04})`; c.beginPath(); c.arc(rnd(9200 + q) * 1080, rnd(9300 + q) * 1920, 20 + rnd(9400 + q) * 60, 0, TAU); c.fill(); }
    }), 0, 0);
  }
  // m: 0 = simge ortada büyük, 1 = üstte satır + telefon
  function ctaMix(t) {
    const k = times(), up = (a) => E.ioC(seg(t, a, a + .42));
    return up(k.game) - up(k.teach) + up(k.plan) - up(k.we);
  }
  shot('p10b30-cagri', k => k.cta, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), cx = 475;
    const fin = E.io(seg(t, k.cta, k.cta + .3));
    ctx.save(); ctx.globalAlpha = fin;
    paperBg(ctx);
    const m = ctaMix(t), end = E.io(seg(t, k.endCard - .05, k.endCard + .3));
    // başlık ölçüsü
    const tSize = lerp(88, 66, m); ctx.font = FONT(tSize); const sp = ctx.measureText(' ').width;
    const w1 = ctx.measureText('Demolition').width, w2 = ctx.measureText('Master').width, tw = w1 + sp + w2;
    const iS = lerp(250, 124, m), gap = 26;
    const rowW = iS + gap + tw;
    const iconC = [lerp(cx, cx - rowW / 2 + iS / 2, m), lerp(340, 392, m)];
    const titleL = [lerp(cx - tw / 2, cx - rowW / 2 + iS + gap, m), lerp(540, 394, m)];
    // simge: "Demolition" kelimesinde belirir
    const ia = seg(t, k.dm - .04, k.dm + .2), ip = E.outBack(ia);
    iconAt(ctx, iconC[0], iconC[1], iS * (.86 + .14 * ip), E.outQ(ia) * (1 - end));
    // "Demolition Master": kelimeler söylendiği anda
    ctx.save(); ctx.textBaseline = 'middle'; ctx.font = FONT(tSize);
    const a1 = E.outQ(seg(t, k.dm - 2 / FPS, k.dm + 3 / FPS)), a2 = E.outQ(seg(t, k.master - 2 / FPS, k.master + 3 / FPS));
    const st = Math.max(5, tSize * .085), sh = Math.max(4, tSize * .06);
    ctx.globalAlpha = fin * a1 * (1 - end); outlined(ctx, 'Demolition', titleL[0], titleL[1] + (1 - a1) * 10, P.hazard, st, sh);
    ctx.globalAlpha = fin * a2 * (1 - end); outlined(ctx, 'Master', titleL[0] + w1 + sp, titleL[1] + (1 - a2) * 10, P.hazard, st, sh);
    ctx.restore();
    // telefon: gerçek oyun kareleri, parlak
    const tm = clamp(m), py = lerp(1400, 0, E.outC(tm));
    const fl = Math.sin(t * 1.3) * 4;
    phone(ctx, cx, 852 + py + fl, .7, tm, gameImgs[gameIdx(t)]);
    // SANCAR GAMES (küçük düz yazı; bitiş kartı gelince kartın üstünde tek başına kalır)
    const ba = E.outQ(seg(t, k.sancar - 2 / FPS, k.sancar + 4 / FPS));
    if (ba > 0) {
      const bs = lerp(44, 64, end), by = lerp(628, 470, end);
      ctx.save(); ctx.globalAlpha = fin * ba; ctx.font = FONT(bs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const txt = 'SANCAR GAMES'; ctx.fillStyle = P.ink;
      ctx.letterSpacing = '4px'; ctx.fillText(txt, cx, by + (1 - ba) * 8); ctx.letterSpacing = '0px';
      ctx.restore();
    }
    ctx.restore();
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const f3 = x => +x.toFixed(3);
  TB.cuesB = {
    get notCevrilir() { return f3(times().f1); },         // not elde ters çevrilir (kâğıt, çok hafif)
    get okulKapisi() { return f3(times().school); },      // okul, açık kapı; adımlar
    get kalemCizim() { return f3(times().top + .08); },   // kurşun kalem kâğıtta (≈1 sn)
    get kalemSmall() { return f3(times().small); },       // "small." yazılır
    get kalemStrong() { return f3(times().strong); },     // "strong." yazılır
    get kusKonar() { return f3(times().bird); },          // kuş Daisy'nin tavanına konar (kanat, çok hafif)
    get siperlik() { return f3(times().alert); },         // siperlik kalkar (küçük metal tık, bip DEĞİL)
    get bip() { return f3(times().beep); },               // daisy-beep.wav başlangıcı (ışık +0,04 ve +0,37'de); SON iki bip
    get elZemin() { return f3(times().check + .2); },     // avuç zemine (çakıl)
    get elKanca() { return f3(times().c1 + .2); },        // kanca tutulur, çekilir (zincir/metal)
    get teraziDuvar() { return f3(times().c2 + .14); },   // su terazisi duvara (tok)
    get vedaIsik() { return f3(times().glow); },          // ışık yumuşakça yanıp söner (sessiz; ses gerekmez)
    get cagri() { return f3(times().cta); },              // hikâyeden çıkış: kâğıt zemin
    get simge() { return f3(times().dm); },               // gerçek simge belirir
    get telefon1() { return f3(times().game); },          // telefon girer, oyun karesi 1–55 (DEMOLISHED!)
    get telefon2() { return f3(times().plan); }           // telefon tekrar, kare 56–100 (planlı devrilme)
  };
})();
