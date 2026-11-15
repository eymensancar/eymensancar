/* Part 8 · NUMBER NINE — Animatör B: cümle 14–29 ve bitiş görüntüsü. Başlangıç (S13.t1 + S14.t0) / 2 ≈ 25,88 sn → tl.duration.
   YERLEŞİM: p8-a'nın salonu birebir (kod kopyası). AR {-320,-200,1720,2300}, zemin y 1318, sıra ayak çizgisi y 1778, koltuk ölçeği 2.07, koltuklar x 147/540/933.
   • DUVAR A (numaratör): Kaan 1. koltuk (147,1766) 'sit'; göğüs cebinde katlı liste; 14–18'de telefon elde (gerçek oyun), 24'ten sonra eller dizde, 104 fişi.
     Defne 2. koltuk, kucağında "No. 9". Numaratör 101 → 102 (tık) → 103 (ding, "They called his number"). Kutu x 746–1194, y 76–306.
   • DUVAR B (pencere, karşı sıra): Hale ortada (540,1766) s 1.99; 13'ten devam: telefon elde. 19'da şapka kucağa, 26'da kalkar, 27'de şapka başa.
     Pencere x 170–910, y 90–590; Daisy karşı kaldırımda (705,566) s .3, uyarı ışığı dünyada ≈(705,457) → bitişte ekranda ≈(705,357), üst üçte bir.
   • HATIRA (sepya, P5 a05 fotoğrafındaki iki genç adamın büyütülmüş çizimi): genç Kaya ince, şapkasız, koyu iş ceketi; genç Hale iri, şapkalı,
     açık renk takım. İmza kâğıdında "H." ve "K." satırları; "Kaya" P5 defterindeki imzayla aynı el yazısı (tohum 953). Tek renk: altın "HALE" levhası.
   Her şey timeline'dan (times()); karakterler ikişerli, kamera/ışık birerli; bitiş bipinde ışıktan başka her şey donar. */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;

  /* ================= ZAMANLAR ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1], c = tl.cues;
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const mid = i => (S(i).t1 + S(i + 1).t0) / 2;
    const k = {};
    k.start = mid(13);                                    // A ile ortak kesme
    k.two = W(14, /^game/i, 5).t0 - .12;                  // iki telefon yan yana
    k.kIn = W(14, /^me/i, 7).t0 - .22;                    // Kaan'ın telefonu girer
    k.bad = mid(14);                                      // Hale'in ekranı: TIME'S UP
    k.badly = S(15).t0;                                   // damga iner (f106)
    k.tap = S(15).t1 + .5;                                // "Try again"e kalın başparmak
    k.look0 = S(16).t0 - .1;                              // ikili: Hale eğilip bakar
    k.look = W(16, /^looked/i, 1).t0;
    k.cu1 = mid(16);                                      // Hale yakın: "You rush the first move."
    k.kr1 = S(17).t1 + .06; k.cu2 = S(18).t0 - .06;       // Kaan'ın kısa tepkisi (cümle arası)
    k.kaya = W(18, /^Kaya/i, 2).t0;                       // kaşlar yumuşar
    k.kr2 = S(18).t1 + .12;                               // Kaan: dedenin adı
    k.hat0 = S(19).t0 - .1;                               // şapka dizine
    k.hatOff = W(19, /^said/i, 2).t0; k.hatKnee = S(19).t1 + .2;
    k.cu3 = mid(19);                                      // Hale yakın: beton
    k.f1 = W(20, /^my/i, 4).t0 - .26;                     // hatıra 1: beton torbaları
    k.f2 = mid(20);                                       // hatıra 2: çatlak
    k.f3 = W(21, /^your/i, 4).t0 - .12;                   // hatıra 3: imza
    k.sign0 = W(21, /^signed/i, 6).t0 - .05; k.sign1 = S(21).t1 - .02;
    k.f4 = mid(21);                                       // hatıra 4: biri gider, biri tabela asar
    k.pan = S(22).t1 + .08; k.hang = W(23, /^company/i, 3).t0 - .04;
    k.list0 = mid(23);                                    // şimdi: Hale → listeye kayma
    k.listW = W(24, /^list/i, 3).t0;
    k.num = mid(24);                                      // numaratör
    k.ding = W(25, /^called/i, 1).t0 - .12;
    k.stand0 = mid(25); k.rise = S(26).t0 + .06;          // kalkar
    k.hatOn0 = mid(26); k.hatOn = W(27, /^forty/i, 4).t0 - .3;
    k.chest = mid(27); k.straight = W(28, /^carry/i, 2).t0 - .05;
    k.turn0 = mid(28); k.turn = S(29).t0 - .12;
    k.end0 = S(29).t1 + .12;                              // ters açı: pencere, gişe
    k.end = c.voiceEnd; k.endBeep = c.endBeep; k.endCard = c.endCard; k.dur = tl.duration;
    k.endF0 = k.endBeep - .3; k.endF1 = k.endBeep + .24 + 10 / FPS;
    K = k; return k;
  }
  const beepV = (t, t0) => { const d = t - t0; return d >= .04 - 1e-6 && d < .24 - 1e-6 ? 1 : 0; };
  function frozen(t) { const k = times(); return t >= k.endF0 && t < k.endF1 ? k.endF0 : t; }
  function flow(t) { const k = times(); return t < k.endF0 ? t : t < k.endF1 ? k.endF0 : t - (k.endF1 - k.endF0); }
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
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function rrectPts(x, y, w, h, r, n) { const p = []; n = n || 5; [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }); return p; }
  function motes(ctx, t, box, n, sd, a) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sd * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (6 + r(2) * 14)) % box[2]), y = box[1] + ((r(3) * box[3] - t * (4 + r(7) * 8)) % box[3] + box[3]) % box[3] + Math.sin(t * .7 + r(4) * 6) * 10;
      ctx.fillStyle = `rgba(250,246,230,${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + r(6) * 2.6, 0, TAU); ctx.fill();
    }
  }
  function partial(ctx, pts, u, lw, col, sd, amp) {
    if (u <= 0) return; C.seed(sd || 1); const w = C.wobble(pts, false, amp == null ? .8 : amp, 6);
    const L = [0]; for (let i = 1; i < w.length; i++) L.push(L[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
    const lim = L[L.length - 1] * clamp(u); ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col || P.inkOld; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(w[0][0], w[0][1]);
    for (let i = 1; i < w.length; i++) { if (L[i] <= lim) ctx.lineTo(w[i][0], w[i][1]); else { const f = (lim - L[i - 1]) / (L[i] - L[i - 1] || 1); ctx.lineTo(lerp(w[i - 1][0], w[i][0], f), lerp(w[i - 1][1], w[i][1], f)); break; } }
    ctx.stroke(); ctx.restore();
  }
  const SEPIA = 'sepia(1) saturate(.55) brightness(.92) contrast(.92)';   // P4/P5 hatıra karesi
  let memCv = null;
  function memory(ctx, draw) {
    if (!memCv) memCv = canvas(1080, 1920);
    const m = memCv.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, 1080, 1920); m.save(); draw(m); m.restore();
    ctx.fillStyle = '#2a2118'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.filter = SEPIA; ctx.drawImage(memCv, 0, 0); ctx.filter = 'none';
  }
  function memEdge(ctx) { // hatıra karesinin soluk kenarı
    const g = ctx.createRadialGradient(540, 880, 380, 540, 900, 1150); g.addColorStop(0, 'rgba(240,226,192,0)'); g.addColorStop(1, 'rgba(42,33,24,.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = 'rgba(240,226,192,.10)'; ctx.fillRect(0, 0, 1080, 1920);
  }

  /* ================= OYUN KARELERİ ================= */
  const gameImgs = [];
  for (let i = 1; i <= 150; i++) gameImgs[i] = TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg');
  const okImg = im => im && im.complete && im.naturalWidth > 0;
  // Hale: Old Textile Mill (56–95), TIME'S UP damgası f106 = "Badly." (S15.t0), sonuç kartı 116–130, dokunuş 131, kepenk, yeniden (138–150).
  function haleIdx(t) {
    const k = times(), f = x => Math.floor(x * FPS + 1e-6);
    if (t < k.badly) return Math.round(lerp(56, 106, clamp((t - k.start) / (k.badly - k.start))));
    const cardT = k.badly + 10 / FPS;
    if (t < cardT) return 106 + f(t - k.badly);
    if (t < k.tap) return 116 + Math.min(14, f(t - cardT));
    return Math.min(150, 131 + f(t - k.tap));
  }
  // Kaan: Shanty (1–55), içeri girdiği andan oynar; "He looked at my screen"de DEMOLISHED! (40–55) tutulur.
  function kaanIdx(t) { const k = times(); return Math.min(55, 1 + Math.floor((t - k.kIn + .4) * FPS + 1e-6)); }
  const TRY = [225 / 450, 516 / 800];   // sonuç kartındaki "Try again" düğmesi (oran)

  /* ================= TELEFON (pilot b13 ile aynı telefon: 548×1000 gövde, 486×864 ekran) ================= */
  const SWd = 486, SHd = 864, BWd = 548, BHt = 1000;
  let scrPath = null;
  function phone(ctx, im, extra) {
    C.seed(171); C.shape(ctx, rrectPts(-BWd / 2, -BHt / 2, BWd, BHt, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BWd / 2, -BHt / 2, 30, BHt); } });
    C.shape(ctx, [[-60, -BHt / 2 + 24], [60, -BHt / 2 + 24], [60, -BHt / 2 + 36], [-60, -BHt / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SWd / 2, -SHd / 2, SWd, SHd, 34); ctx.clip();
    if (okImg(im)) ctx.drawImage(im, -SWd / 2, -SHd / 2, SWd, SHd); else { ctx.fillStyle = P.screen; ctx.fillRect(-SWd / 2, -SHd / 2, SWd, SHd); }
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SWd / 2, -SHd / 2 + 80); ctx.lineTo(-SWd / 2 + 220, -SHd / 2); ctx.lineTo(-SWd / 2 + 300, -SHd / 2); ctx.lineTo(-SWd / 2, -SHd / 2 + 180); ctx.fill();
    if (extra) extra(ctx);
    ctx.restore();
    if (!scrPath) { scrPath = new Path2D(); C.seed(173); const q = C.wobble(rrectPts(-SWd / 2, -SHd / 2, SWd, SHd, 34, 6), true, .5); scrPath.moveTo(q[0][0], q[0][1]); q.forEach(v => scrPath.lineTo(v[0], v[1])); scrPath.closePath(); }
    C.ink(ctx, scrPath, 4);
  }
  // Kaan'ın eli (p7-b drawHandSide ile aynı): yeşil ceket + sarı reflektör
  function kaanHand(ctx, x, y, flip, lw) {
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], P.jacketDk, { lw });
    C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], P.skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], P.skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, P.skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, P.skinDk);
    ctx.restore();
  }
  // Hale'in eli: krem takım kolu, beyaz gömlek manşeti, iri el
  function haleHand(ctx, x, y, flip, lw) {
    C.seed(flip ? 182 : 181); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-40, 430], [-150, 530], [-90, 780], [170, 780], [140, 480]], P.suit, { lw, shade: c => C.blot(c, [[60, 420], [180, 420], [180, 800], [80, 800]], P.suitDk, .7) });
    C.shape(ctx, [[-112, 470], [112, 424], [122, 470], [-100, 520]], P.shirt, { lw: lw * .8 });
    C.shape(ctx, [[-86, 450], [-96, 250], [-52, 108], [-4, 44], [42, 80], [38, 196], [86, 256], [116, 440]], P.hSkin, { lw, shade: c => C.blot(c, [[36, 50], [140, 50], [140, 450], [60, 450]], P.hSkinDk, .55) });
    C.line(ctx, [[-36, 296], [10, 330]], lw * .5, P.hSkinDk); C.line(ctx, [[-44, 214], [4, 246]], lw * .5, P.hSkinDk);
    ctx.restore();
  }
  function thumb(ctx, side, tx, ty, skin, skinDk, lw, sd) { // başparmak: telefonun sağ kenarından ekrana
    C.seed(sd);
    C.shape(ctx, [[side + 60, 380], [tx + 50, ty - 30], [tx + 10, ty - 54], [tx - 34, ty - 32], [tx - 22, ty + 22], [side + 20, 470]], skin, { lw, shade: c => C.blot(c, [[tx - 10, ty + 5], [side + 80, 420], [side + 80, 520], [tx, ty + 60]], skinDk, .5) });
    C.shape(ctx, [[tx - 24, ty - 36], [tx + 6, ty - 50], [tx + 20, ty - 26], [tx - 8, ty - 14]], skin === P.hSkin ? '#efc8a6' : '#e7b896', { lw: 3 });
  }

  /* ================= SALON (p8-a ile aynı: iki karşılıklı duvar; kod p8-a'dan kopya) ================= */
  const LEAF = ['#c0612b', '#a8482a', '#d4893a', '#8a4f26', '#b9702e'];
  function leaf(ctx, x, y, sz, rot, col, flipY) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, flipY);
    ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.quadraticCurveTo(-sz * .2, -sz * .62, sz, 0); ctx.quadraticCurveTo(-sz * .2, sz * .62, -sz, 0); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(1.6, sz * .13); ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-sz * 1.25, 0); ctx.lineTo(sz * .7, 0); ctx.lineWidth = Math.max(1, sz * .08); ctx.stroke();
    ctx.restore();
  }
  function leaves(ctx, t, n, sb, box, size, speed) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 313 + i * 17 + j), v = (speed || 1) * (110 + r(1) * 90), L = box[3] + 200;
      const ph = (r(2) * L + t * v) % L, y = box[1] - 100 + ph, sw = Math.sin(t * (1.4 + r(3)) + r(4) * 6);
      const x = box[0] + r(5) * box[2] + sw * 40 * (size || 1) + t * 25 * (r(6) - .3);
      const sz = (size || 1) * (11 + r(7) * 9), fl = Math.cos(t * (2.2 + r(8) * 2) + r(9) * 6);
      leaf(ctx, x, y, sz, sw * .9 + r(10) * 6, LEAF[i % LEAF.length], Math.abs(fl) < .15 ? .15 * Math.sign(fl || 1) : fl);
    }
  }
  function autumnTree(ctx, x, y, s, t, sd) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(sd || 811);
    const sw = Math.sin(t * 1.3 + (sd || 0)) * 4;
    C.shape(ctx, [[-22, 0], [22, 0], [16, -260], [40, -330], [10, -320], [-4, -380], [-20, -300], [-46, -340], [-14, -250]], '#4a3a2c', { lw: 5, shade: c => C.blot(c, [[4, 0], [30, 0], [30, -330], [6, -330]], '#2e241b', .5) });
    [[-80, -380, 110, 80, LEAF[0]], [70, -400, 120, 86, LEAF[2]], [0, -470, 130, 90, LEAF[4]], [-120, -460, 80, 60, LEAF[1]], [120, -480, 80, 64, LEAF[0]], [10, -540, 90, 60, LEAF[2]]].forEach(([fx, fy, rx, ry, col], i) => {
      C.seed((sd || 811) + i * 3); C.shape(ctx, C.ell(fx + sw * (1 + i * .2), fy, rx, ry, 20), col, { lw: 4.4, amp: 3, shade: c => C.blot(c, C.ell(fx + rx * .35 + sw, fy + ry * .3, rx * .6, ry * .5, 12), '#7a3418', .35) });
    });
    ctx.restore();
  }
  const INK_OLD = '#3a3026';
  function ticket(ctx, x, y, s, rot, num) {   // numara fişi (p8-a)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    const W = 130, H = 84, pts = [];
    for (let q = 0; q <= 10; q++) pts.push([-W / 2 + q * W / 10, -H / 2 + (q % 2 ? 4 : 0)]);
    for (let q = 10; q >= 0; q--) pts.push([-W / 2 + q * W / 10, H / 2 - (q % 2 ? 4 : 0)]);
    C.seed(4101); C.shape(ctx, pts, '#f3ecd8', { lw: 3, amp: .3, shade: c => C.blot(c, [[W * .2, -H], [W, -H], [W, H], [W * .26, H]], '#ddd2b6', .5) });
    ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 11px Rubik'; ctx.fillText('CITY HALL', 0, -27);
    ctx.font = '700 44px Rubik'; ctx.fillText(num, 0, 4);
    ctx.font = '500 10px Rubik'; ctx.fillStyle = 'rgba(21,18,13,.7)'; ctx.fillText('PLEASE WAIT', 0, 31);
    ctx.restore();
  }
  function folderClosed(ctx, x, y, s, rot) {   // "No. 9" rapor dosyası (p8-a)
    const W = 720, H = 960; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); C.seed(3201);
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], '#b89463', { lw: 5 / s * .45 });
    C.seed(3202);
    C.shape(ctx, [[-W / 2, -H / 2 - 4], [W / 2 + 8, -H / 2 - 4], [W / 2 + 8, H / 2 + 4], [-W / 2, H / 2 + 4]], '#c9a26b', { lw: 5 / s * .45, shade: cc => { C.blot(cc, [[W * .2, -H / 2 - 10], [W / 2 + 14, -H / 2 - 10], [W / 2 + 14, H / 2 + 10], [W * .26, H / 2 + 10]], '#a88a5a', .4); } });
    C.shape(ctx, [[-W * .34, -H * .3], [W * .34, -H * .3], [W * .34, -H * .06], [-W * .34, -H * .06]], P.paper, { lw: 3.4 / s * .45 });
    C.handwrite(ctx, 'No. 9', -W * .26, -H * .14, 96, INK_OLD, 361, { bold: true });
    ctx.save(); ctx.globalAlpha = .22; ctx.strokeStyle = P.coffee; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(W * .24, H * .24, 60, .5, 5.6); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  const AR = { x: -320, y: -200, w: 1720, h: 2300 };
  const FL = AR.y + AR.h * .66, WAIN = AR.y + (FL - AR.y) * .55, ROWY = FL + AR.h * .2, CHS = AR.h / 1000 * .9;
  const NUMBOX = { x: AR.x + AR.w * .62, y: AR.y + AR.h * .12, w: AR.w * .26, h: AR.h * .1 };
  const CLOCK = { x: 591, y: 190, r: 85 };
  const SEATX = [540 - 190 * CHS, 540, 540 + 190 * CHS];
  const KAAN = { x: SEATX[0], y: ROWY - (156 - 150) * CHS, s: CHS };
  const DEFNE = { x: SEATX[1], y: ROWY - (156 * CHS - 150 * 2.2 * .9), s: 2.2 };
  const HALE = { x: 540, y: ROWY - (156 - 150) * CHS, s: CHS / 1.04 };
  const DZ = { x: 705, y: 566, s: .3 };                 // pencereden Daisy (p8-a), uyarı ışığı ≈(705,457)
  const numStr = n => String(n).padStart(3, '0');
  function floorExt(ctx) {
    ctx.fillStyle = P.hallDk; ctx.fillRect(-2000, -2000, 5000, 1800 + 2);
    ctx.fillStyle = P.hall; ctx.fillRect(-2000, AR.y, 5000, FL - AR.y);
    ctx.fillStyle = '#d6d1c2'; ctx.fillRect(-2000, FL, 5000, 3000);
    ctx.strokeStyle = 'rgba(21,18,13,.2)'; ctx.lineWidth = 2; for (let yy = AR.y + AR.h; yy < 3200; yy += 90) { ctx.beginPath(); ctx.moveTo(-2000, yy); ctx.lineTo(3000, yy); ctx.stroke(); }
    C.seed(871); C.line(ctx, [[-2000, AR.y], [3000, AR.y]], 4, P.hallDk, .3);
  }
  function wallClock(ctx, minutes) {
    const { x, y, r } = CLOCK; C.seed(881);
    C.shape(ctx, C.ell(x, y, r + 10, r + 10, 26), '#3a3d45', { lw: 4.4 });
    C.shape(ctx, C.ell(x, y, r, r, 26), '#f4f1e6', { lw: 3 });
    for (let q = 0; q < 12; q++) { const a = q / 12 * TAU; ctx.save(); ctx.translate(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8); ctx.rotate(a); ctx.fillStyle = P.ink; ctx.fillRect(-6, -2, q % 3 ? 8 : 14, q % 3 ? 4 : 6); ctx.restore(); }
    const am = minutes / 60 * TAU - Math.PI / 2, ah = (2 + minutes / 60) / 12 * TAU - Math.PI / 2;
    ctx.save(); ctx.strokeStyle = P.ink; ctx.lineCap = 'round';
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ah) * r * .48, y + Math.sin(ah) * r * .48); ctx.stroke();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(am) * r * .74, y + Math.sin(am) * r * .74); ctx.stroke();
    ctx.fillStyle = '#b8322a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.restore();
  }
  function sunPatch(ctx, u) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .9;
    const x0 = lerp(-260, 420, u), y0 = 380, w = 640, h = 720, sk = 260;
    ctx.fillStyle = '#fff1c8'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w + sk, y0 + h); ctx.lineTo(x0 + sk, y0 + h); ctx.fill();
    ctx.restore();
  }
  function kaanTalk(ctx, o, headRot, headDy) {
    const s = o.s, neck = o.y - (o.pose === 'sit' ? 300 : 404) * s;
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, neck, 9000, 9000); ctx.clip(); C.drawKaan(ctx, o); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-4000, -9000, 9000, neck + 9000 + 1); ctx.clip();
    ctx.translate(o.x, neck + (headDy || 0)); ctx.rotate(headRot || 0); ctx.translate(-o.x, -neck); C.drawKaan(ctx, o); ctx.restore();
  }
  // DUVAR A (numaratör): Kaan 1. koltuk (cebinde liste), Defne 2. koltuk (kucağında No. 9). o.kaan.hands 'phone' ise fiş elde değil.
  function wallA(ctx, t, o) {
    o = o || {};
    floorExt(ctx);
    C.drawWaitingRoom(ctx, Object.assign({ seed: 7, number: numStr(o.num == null ? 101 : o.num) }, AR));
    wallClock(ctx, o.minutes == null ? 66 : o.minutes);
    sunPatch(ctx, o.sun == null ? 1 : o.sun);
    ctx.save(); C.seed(883); C.shape(ctx, [[NUMBOX.x + 60, NUMBOX.y + NUMBOX.h + 92], [NUMBOX.x + NUMBOX.w - 60, NUMBOX.y + NUMBOX.h + 92], [NUMBOX.x + NUMBOX.w - 60, NUMBOX.y + NUMBOX.h + 150], [NUMBOX.x + 60, NUMBOX.y + NUMBOX.h + 150]], '#efe6d2', { lw: 3 });
    ctx.font = '700 26px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink; ctx.fillText('PLEASE WAIT', NUMBOX.x + NUMBOX.w / 2, NUMBOX.y + NUMBOX.h + 122); ctx.restore();
    if (o.numOff) { ctx.fillStyle = `rgba(20,22,27,${o.numOff})`; ctx.fillRect(NUMBOX.x + 4, NUMBOX.y + 4, NUMBOX.w - 8, NUMBOX.h - 8); }
    if (o.defne !== false) {
      const dob = Object.assign({ seed: 31, pose: 'sit', seat: false, expr: 'serious', look: 0 }, DEFNE, o.defne || {});
      C.drawDefne(ctx, dob);
      const ds = dob.s * .9; folderClosed(ctx, dob.x, dob.y - 150 * ds, .3, -.06);
      ctx.save(); ctx.translate(dob.x, dob.y + 104 * ds); ctx.scale(ds, ds); [[-22, -280 - 104 - 40], [22, -282 - 104 - 40]].forEach(([hx, hy]) => { ctx.beginPath(); ctx.ellipse(hx * 1.6, hy, 12, 13, 0, 0, TAU); ctx.fillStyle = P.dSkin; ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = P.ink; ctx.stroke(); }); ctx.restore();
    }
    if (o.kaan !== false) {
      const ko = Object.assign({ seed: 11, pose: 'sit', hands: 'knees', seat: false, expr: 'calm', look: 0 }, KAAN, o.kaan || {});
      if (o.kaanHead) kaanTalk(ctx, ko, o.kaanHead[0], o.kaanHead[1]); else C.drawKaan(ctx, ko);
      ctx.save(); ctx.translate(ko.x, ko.y); ctx.scale(CHS, CHS); pocketList(ctx, 5.2 / Math.sqrt(CHS)); ctx.restore();
      if (ko.hands === 'knees') {
        ticket(ctx, ko.x + 70 * CHS, ko.y - 166 * CHS, .95, -.5, '104');
        C.seed(12); ctx.save(); ctx.translate(ko.x, ko.y); ctx.scale(CHS, CHS); ctx.beginPath(); ctx.ellipse(44, -152, 15, 16, 0, 0, TAU); ctx.fillStyle = P.skin; ctx.fill(); ctx.lineWidth = 3.6; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
      } else if (o.kaanFrame) smallScreen(ctx, 'kaan', gameImgs[o.kaanFrame]);
    }
  }
  // DUVAR B (pencere): sonbahar sokağı + Daisy; sıra; Hale'i çağıran çizer
  function windowView(ctx, t) {
    const x0 = 170, y0 = 90, x1 = 910, y1 = 590;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#87a9c4'); g.addColorStop(1, '#ecd2a8'); ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    C.seed(891); let x = x0 - 10, n = 0;
    while (x < x1) { const bw = 80 + rnd(8910 + n) * 90, bh = 120 + rnd(8920 + n) * 200; C.shape(ctx, [[x, 520], [x, 520 - bh], [x + bw, 520 - bh], [x + bw, 520]], n % 2 ? '#c9b79a' : '#b9a78c', { lw: 2.4, shade: c => { for (let yy = 520 - bh + 20; yy < 500; yy += 40) for (let xx = x + 12; xx < x + bw - 16; xx += 30) { c.fillStyle = '#6e8592'; c.fillRect(xx, yy, 14, 20); } } }); x += bw + 4; n++; }
    ctx.fillStyle = '#b9b1a0'; ctx.fillRect(x0, 520, x1 - x0, 20); ctx.fillStyle = '#6f6a60'; ctx.fillRect(x0, 540, x1 - x0, 60); C.line(ctx, [[x0, 540], [x1, 540]], 2.4);
    autumnTree(ctx, 300, 545, .5, t, 851);
    C.drawDaisy(ctx, { x: DZ.x, y: DZ.y, s: DZ.s, seed: 23, beep: 0, mood: 'sleepy', hook: Math.sin(t * 1.2) * .03 });
    autumnTree(ctx, 880, 560, .42, t, 853);
    leaves(ctx, t, 6, 93, [x0, y0, x1 - x0, y1 - y0], .5, .5);
    ctx.fillStyle = 'rgba(200,220,235,.12)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    C.seed(893);
    C.shape(ctx, [[x0 - 18, y0 - 18], [x1 + 18, y0 - 18], [x1 + 18, y1 + 22], [x0 - 18, y1 + 22]], null, { lw: 6 });
    [0, 1, 2].forEach(q => { const mx = x0 + (x1 - x0) * (q + 1) / 4; C.line(ctx, [[mx, y0], [mx, y1]], 9, '#e8e6dc', .3); C.line(ctx, [[mx - 5, y0], [mx - 5, y1]], 2, P.ink, .3); });
    C.line(ctx, [[x0, (y0 + y1) / 2 - 40], [x1, (y0 + y1) / 2 - 40]], 9, '#e8e6dc', .3);
    C.shape(ctx, [[x0 - 30, y1 + 14], [x1 + 30, y1 + 14], [x1 + 36, y1 + 40], [x0 - 36, y1 + 40]], '#e8e6dc', { lw: 4.4 });
  }
  function wallB(ctx, t, o) {
    o = o || {};
    floorExt(ctx);
    const P0 = AR;
    ctx.save(); ctx.beginPath(); ctx.rect(P0.x, P0.y, P0.w, P0.h); ctx.clip();
    ctx.fillStyle = P.hall; ctx.fillRect(P0.x, P0.y, P0.w, FL - P0.y);
    ctx.fillStyle = '#b8bdb0'; ctx.fillRect(P0.x, WAIN, P0.w, FL - WAIN); C.seed(895); C.line(ctx, [[P0.x, WAIN], [P0.x + P0.w, WAIN]], 3, '#8e938a');
    [.25, .7].forEach(uu => C.shape(ctx, [[P0.x + P0.w * uu - 90, P0.y + 20], [P0.x + P0.w * uu + 90, P0.y + 20], [P0.x + P0.w * uu + 90, P0.y + 36], [P0.x + P0.w * uu - 90, P0.y + 36]], '#f6f7ee', { lw: 3 }));
    ctx.fillStyle = '#d6d1c2'; ctx.fillRect(P0.x, FL, P0.w, P0.y + P0.h - FL);
    ctx.strokeStyle = 'rgba(21,18,13,.2)'; ctx.lineWidth = 2; for (let i = -10; i < 20; i++) { ctx.beginPath(); ctx.moveTo(P0.x + P0.w / 2 + i * 40, FL); ctx.lineTo(P0.x + P0.w / 2 + i * 160, P0.y + P0.h); ctx.stroke(); }
    for (let yy = FL; yy < P0.y + P0.h; yy += (yy - FL) * .35 + 18) { ctx.beginPath(); ctx.moveTo(P0.x, yy); ctx.lineTo(P0.x + P0.w, yy); ctx.stroke(); }
    C.line(ctx, [[P0.x, FL], [P0.x + P0.w, FL]], 3.8, '#8e938a');
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = '#fff1c8'; ctx.globalAlpha = .8; const su = o.sun == null ? .75 : o.sun;
    ctx.beginPath(); ctx.moveTo(170 + su * 120, FL); ctx.lineTo(910 + su * 120, FL); ctx.lineTo(1100 + su * 300, P0.y + P0.h); ctx.lineTo(60 + su * 300, P0.y + P0.h); ctx.fill(); ctx.restore();
    C.seed(897);
    C.shape(ctx, [[-170, 1318], [-60, 1318], [-60, 900], [-170, 900]], '#e8e6dc', { lw: 4.4 });
    C.shape(ctx, C.ell(-115, 820, 52, 80, 20), '#a9cde0', { lw: 4.4, shade: c => { c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(-150, 760, 12, 110); } });
    C.shape(ctx, [[1120, 1318], [1240, 1318], [1220, 1190], [1140, 1190]], '#b4532f', { lw: 4.4 });
    [[1180, 1100, 70, 120], [1130, 1060, 40, 90], [1230, 1070, 40, 80]].forEach(([px, py, rx, ry], i) => C.shape(ctx, C.ell(px, py, rx, ry, 16), i ? '#6b7a3e' : P.weed, { lw: 4 }));
    C.shape(ctx, [[960, 700], [1180, 700], [1180, 860], [960, 860]], '#efe6d2', { lw: 3 });
    ctx.font = '700 24px Rubik'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink; ctx.fillText('NO PHONE', 1070, 760); ctx.fillText('CALLS', 1070, 792); ctx.restore();
    windowView(ctx, t);
    ctx.save(); ctx.translate(540, ROWY); ctx.scale(CHS, CHS); C.waitChair(ctx, 0, 0, 3.8, 3); ctx.restore();
  }
  // Önbellekli bulanık arka planlar (yakın planlar için; kamera dünyası aynı)
  function blurWall(key, wall, z, cx, cy, sx, sy, blur, t) {
    return cached('bw-' + key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d'); cam(g, z, cx, cy, sx, sy);
      if (wall === 'B') wallB(g, t || 54, {}); else wallA(g, t || 54, { kaan: false, defne: false });
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, -24, -24, 1128, 1968); c.filter = 'none';
    });
  }
  // Hale konuşurken: boyundan bölünür (p3-b drawHaleTalk), baş eğilir/döner; gövde kalçadan eğilebilir
  function haleTalk(ctx, o, headRot, headDy, lean) {
    const s = (o.s || 1) * 1.04, neck = o.y - (o.pose === 'sit' ? 313 : 409) * s, hip = o.y - (o.pose === 'sit' ? 130 : 224) * s;
    ctx.save(); if (lean) { ctx.translate(o.x, hip); ctx.rotate(lean); ctx.translate(-o.x, -hip); }
    ctx.save(); ctx.beginPath(); ctx.rect(-3000, neck, 9000, 6000); ctx.clip(); C.drawHale(ctx, o); if (o.after) o.after(ctx, s); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-3000, -6000, 9000, neck + 6000 + 1); ctx.clip();
    ctx.translate(o.x + 4 * s, neck + (headDy || 0)); ctx.rotate(headRot || 0); ctx.translate(-(o.x + 4 * s), -neck); C.drawHale(ctx, o); ctx.restore();
    ctx.restore();
  }
  // konuşma: ifade ikişerli değişir (dudak eşlemesi değil, "konuşuyor" bilgisi)
  const TALK_Q = ['serious', 'tired', 'serious', 'regret', 'tired', 'serious'];
  function talkExpr(t, sd, list) { const L = list || TALK_Q, i = Math.floor(t * 5 + rnd(sd) * 3); return L[i % L.length]; }
  // Şapka (cizim.js haleHat ile aynı biçim), siperlik ortası (0,0)
  function hat(ctx, lw) {
    C.seed(4101); ctx.save(); ctx.translate(-2, 514);
    C.shape(ctx, C.ell(2, -514, 76, 13, 26), P.hat, { lw, shade: c => C.blot(c, C.ell(30, -508, 50, 8, 12), P.suitDk, .6) });
    C.shape(ctx, [[-44, -516], [-40, -566], [-14, -578], [0, -570], [16, -578], [42, -566], [46, -516]], P.hat, { lw, shade: c => C.blot(c, [[20, -590], [60, -590], [60, -510], [26, -510]], P.suitDk, .55) });
    C.shape(ctx, [[-45, -534], [46, -534], [46, -518], [-45, -518]], P.hatBand, { lw: lw * .8 });
    ctx.restore();
  }
  const handR = (ctx, x, y, r, fill, lw) => C.shape(ctx, C.ell(x, y, r, r * 1.08, 16), fill, { lw });
  // Oturan Hale'in kucağında şapka (yerel, ayak ortası 0,0; s=1.04 ölçekli Hale birimleri). Eller şapkanın kenarında.
  function hatOnKnee(ctx, lw, turn) {
    ctx.save(); ctx.translate(0, -168); ctx.rotate(turn || 0); ctx.scale(.95, .95); hat(ctx, lw); ctx.restore();
    handR(ctx, -26, -182, 15, P.hSkinDk, lw); handR(ctx, 24, -184, 15, P.hSkin, lw);
  }
  // Kaan'ın cebindeki katlı liste (sit pozunda yerel; göğüs cebi -56…-24, y -300+104)
  function pocketList(ctx, lw) {
    ctx.save(); ctx.translate(-40, -196); ctx.rotate(-.12);
    C.seed(5101); C.shape(ctx, [[-14, 8], [-12, -30], [16, -34], [18, 6]], P.page, { lw: lw * .6, shade: c => { c.fillStyle = 'rgba(58,48,38,.55)'; c.fillRect(-8, -24, 18, 2.4); c.fillRect(-8, -16, 14, 2.4); } });
    C.line(ctx, [[-13, -12], [17, -15]], lw * .3, 'rgba(120,90,50,.6)', .2);
    ctx.restore();
    C.line(ctx, [[-58, -194], [-22, -198]], lw * .55);   // cep ağzı listeyi önden örter
  }
  /* ================= GENÇ İKİ ORTAK (P5 a05 fotoğrafındaki çizim, büyütülmüş) =================
     yerel birim = fotoğraftaki birim; ayak y 60, omuz y -20, baş ortası y -33. o: wide, suit, hat, step (-1..1), arms 'down'|'point'|'box'|'up'|'pen', look, brow */
  function youngMan(g, x, o) {
    const wide = !!o.wide, sh = wide ? 30 : 21, lw = o.lw || .9, suit = o.suit, st = o.step || 0;
    C.seed(o.seed || 941);
    const legC = '#4d4234';
    // bacaklar (adımda iki ayrı)
    C.shape(g, [[x - sh * .5 - st * 6, 60], [x - sh * .45, 18], [x - 1, 18], [x - 2 - st * 6, 60]], legC, { lw });
    C.shape(g, [[x + 2 + st * 6, 60], [x + 1, 18], [x + sh * .45, 18], [x + sh * .5 + st * 6, 60]], legC, { lw });
    C.shape(g, [[x - sh * .55 - st * 6, 56], [x - 1 - st * 6, 56], [x - st * 6, 61], [x - sh * .6 - st * 6, 61]], '#2a231b', { lw: lw * .8 });
    C.shape(g, [[x + 1 + st * 6, 56], [x + sh * .55 + st * 6, 56], [x + sh * .62 + st * 6, 61], [x + st * 6, 61]], '#2a231b', { lw: lw * .8 });
    const arm = (side, pts) => C.tube(g, pts.map(([a, b]) => [x + side * a, b]), wide ? 11 : 9, wide ? 9 : 7.5, suit, lw);
    const hand = (hx, hy) => C.shape(g, C.ell(hx, hy, 4.2, 4.6, 12), '#c7a57e', { lw: lw * .8 });
    const A = o.arms || 'down';
    // arka kol
    if (A === 'box') arm(-1, [[sh * .8, -12], [sh * .95, 6], [sh * .3, 10]]);
    else if (A === 'up') arm(-1, [[sh * .8, -12], [sh * 1.2, -34], [sh * .7, -58]]);
    else arm(-1, [[sh * .8, -12], [sh * 1.0, 8], [sh * .95, 24]]);
    // gövde
    C.shape(g, [[x - sh, 22], [x - sh * .9, -12], [x - sh * .4, -20], [x + sh * .4, -20], [x + sh * .9, -12], [x + sh, 22]], suit, { lw });
    if (wide) { C.shape(g, [[x - 5, -20], [x + 5, -20], [x + 3, 4], [x, 8], [x - 3, 4]], '#6a5a44', { lw: lw * .6 }); }
    else C.line(g, [[x, -18], [x, 20]], lw * .6, 'rgba(21,18,13,.6)');
    // baş
    C.shape(g, C.ell(x, -33, 11, 13, 14), '#c7a57e', { lw });
    const lk = (o.look || 0) * 1.6;
    g.fillStyle = '#3a3026'; g.fillRect(x - 5 + lk, -35, 2.2, 2.6); g.fillRect(x + 3 + lk, -35, 2.2, 2.6);
    const br = o.brow || 0;   // + endişe (iç uç yukarı)
    C.line(g, [[x - 7 + lk, -39 + br * .8], [x - 2 + lk, -40 - br]], lw * (wide ? 1 : .7), '#3a3026', .1);
    C.line(g, [[x + 2 + lk, -40 - br], [x + 7 + lk, -39 + br * .8]], lw * (wide ? 1 : .7), '#3a3026', .1);
    if (o.mouth === 'down') C.line(g, [[x - 3, -25], [x, -26.5], [x + 3, -25]], lw * .6, '#3a3026', .1);
    else if (o.mouth === 'smile') C.line(g, [[x - 3.5, -26.5], [x, -25], [x + 3.5, -26.5]], lw * .6, '#3a3026', .1);
    else C.line(g, [[x - 3, -26], [x + 3, -26]], lw * .6, '#3a3026', .1);
    if (o.hat) { C.shape(g, C.ell(x, -44, 20, 4.6, 14), '#d6c39c', { lw }); C.shape(g, [[x - 10, -45], [x - 8, -58], [x + 8, -58], [x + 10, -45]], '#d6c39c', { lw }); C.line(g, [[x - 10, -48], [x + 10, -48]], 2.4, '#5b4a36', .2); }
    else C.shape(g, [[x - 11, -36], [x - 10, -46], [x, -49], [x + 10, -46], [x + 11, -38], [x + 4, -43], [x - 4, -42]], '#3a3026', { lw: lw * .9 });
    // ön kol
    if (A === 'point') { arm(1, [[sh * .8, -12], [sh * 1.5, -4], [sh * 2.2, 2]]); hand(x + sh * 2.3, 3); }
    else if (A === 'pat') { arm(1, [[sh * .8, -12], [sh * 1.3, 4], [sh * 1.9, 14 + (o.pat || 0) * 4]]); hand(x + sh * 2.0, 15 + (o.pat || 0) * 4); }
    else if (A === 'box') {
      C.shape(g, [[x - sh * 1.05, -6], [x + sh * 1.05, -8], [x + sh * 1.1, 22], [x - sh * 1.1, 24]], '#b89a6a', { lw, shade: c => c.fillRect(x - 3, -7, 6, 30) });
      arm(1, [[sh * .8, -12], [sh * .95, 6], [sh * .3, 10]]); hand(x - sh * .9, 8); hand(x + sh * .9, 7);
    }
    else if (A === 'up') { arm(1, [[sh * .8, -12], [sh * 1.2, -34], [sh * .7, -58]]); hand(x - sh * .7, -60); hand(x + sh * .7, -60); }
    else { arm(1, [[sh * .8, -12], [sh * 1.0, 8], [sh * .95, 24]]); hand(x + sh * .95, 27); hand(x - sh * .95, 27); }
  }

  function drawBeacon(ctx, v) { // pilotla aynı: yalnız uyarı ışığı (farlar değişmez)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(q => { const r = 40 + q * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - q * .2) * Math.min(1, v * 1.5), null, .5); }));
  }
  // Hale arkadan (cizim.js'teki ayakta Hale'in arka yüzü; aynı ölçüler)
  function haleBack(ctx, o) {
    const s = (o.s || 1) * 1.04, lw = 5.2 / Math.sqrt(s), st = o.step || 0;
    C.seed(4201); ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(4, 2, 104, 14, 0, 0, TAU); ctx.fill(); ctx.restore();
    const lift = (d) => Math.max(0, d * st) * 26;
    C.shape(ctx, [[-50, -224], [-6, -224], [-12, -24 - lift(-1)], [-46, -24 - lift(-1)]], P.suit, { lw });
    C.shape(ctx, [[6, -224], [50, -224], [46, -24 - lift(1)], [12, -24 - lift(1)]], P.suitDk, { lw });
    C.shape(ctx, [[-56, -28 - lift(-1)], [-8, -28 - lift(-1)], [-8, -lift(-1)], [-58, -lift(-1)]], P.shoeDk, { lw });
    C.shape(ctx, [[8, -28 - lift(1)], [56, -28 - lift(1)], [58, -lift(1)], [6, -lift(1)]], P.shoeDk, { lw });
    C.tube(ctx, [[-80, -392], [-106 - st * 4, -320], [-104 - st * 10, -254]], 46, 38, P.suit, lw);
    C.tube(ctx, [[80, -392], [106 + st * 4, -320], [104 + st * 10, -254]], 46, 38, P.suitDk, lw);
    handR(ctx, -104 - st * 10, -240, 16, P.hSkinDk, lw); handR(ctx, 104 + st * 10, -240, 16, P.hSkinDk, lw);
    C.shape(ctx, [[-86, -400], [86, -400], [98, -322], [100, -252], [88, -212], [-88, -212], [-100, -252], [-98, -322]], P.suit, { lw, shade: c => C.blot(c, [[30, -410], [110, -410], [110, -200], [46, -200]], P.suitDk, .7) });
    C.line(ctx, [[0, -396], [0, -270], [-4, -212]], lw * .5); C.shape(ctx, [[-30, -404], [30, -404], [26, -392], [-26, -392]], P.shirt, { lw: lw * .7 });
    C.shape(ctx, [[-22, -430], [24, -430], [24, -398], [-22, -398]], P.hSkinDk, { lw });
    C.shape(ctx, C.ell(2, -466, 48, 50, 30), P.hSkin, { lw, shade: c => C.blot(c, [[20, -530], [70, -530], [70, -400], [24, -410]], P.hSkinDk, .5) });
    C.shape(ctx, [[-50, -486], [-44, -452], [0, -436], [44, -452], [52, -486], [40, -470], [0, -456], [-40, -470]], P.gray, { lw: lw * .8 });
    C.shape(ctx, C.ell(-48, -466, 9, 13, 12), P.hSkinDk, { lw }); C.shape(ctx, C.ell(52, -466, 9, 13, 12), P.hSkinDk, { lw });
    if (o.hat !== false) { ctx.save(); ctx.translate(2, -514); hat(ctx, lw); ctx.restore(); }
    ctx.restore();
  }

  // küçük telefonlara gerçek oyun karesi (phoneInHands ekranı: Hale yerel (0,-196) rot .08 ; Kaan yerel (-6,-182) rot -.1)
  function smallScreen(ctx, who, im, lean) {
    if (!okImg(im)) return;
    const H = who === 'hale', o = H ? HALE : KAAN, s = H ? o.s * 1.04 : o.s;
    ctx.save();
    if (H && lean) { const hip = o.y - 130 * s; ctx.translate(o.x, hip); ctx.rotate(lean); ctx.translate(-o.x, -hip); }
    ctx.translate(o.x, o.y); ctx.scale(s, s); ctx.translate(H ? 0 : -6, H ? -196 : -182); ctx.rotate(H ? .08 : -.1);
    ctx.save(); ctx.beginPath(); ctx.rect(-13, -28, 26, 48); ctx.clip(); ctx.drawImage(im, -13, -28, 26, 48); ctx.restore();
    ctx.restore();
  }
  function haleSit(ctx, h) {
    const o = Object.assign({ x: HALE.x, y: HALE.y, s: HALE.s, seed: 41, pose: 'sit', seat: false, hat: true, phone: true, expr: 'serious' }, h);
    haleTalk(ctx, o, h.headRot || 0, h.headDy || 0, h.lean || 0);
    if (o.phone && h.frame) smallScreen(ctx, 'hale', gameImgs[h.frame], h.lean);
    if (o.phone && h.glow) {
      const hs = o.s * 1.04, px = o.x, py = o.y + (-292 + 96) * hs;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(px, py - 40, 10, px, py - 160, 300); g.addColorStop(0, `rgba(255,226,122,${.32 * h.glow})`); g.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g; ctx.fillRect(px - 400, py - 600, 800, 800); ctx.restore();
    }
  }
  function haleKnee(ctx, base) {   // şapka kucakta, telefon yok
    const s = HALE.s * 1.04, lw = 5.2 / Math.sqrt(s);
    haleSit(ctx, Object.assign({}, base, { hat: false, phone: false }));
    ctx.save(); ctx.translate(HALE.x, HALE.y); ctx.scale(s, s); hatOnKnee(ctx, lw, .1); ctx.restore();
  }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 14a: Hale'in telefonu yakın (iri eller, krem kol); gerçek oyun: Old Textile Mill, C4 (A'nın 13b itişinin devamı) --- */
  function phoneBg(ctx) {
    ctx.drawImage(blurWall('tel', 'B', 2.25, 540, 1300, 540, 760, 14), 0, 0);
    ctx.fillStyle = 'rgba(30,26,22,.3)'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const hg = ctx.createRadialGradient(540, 760, 200, 540, 760, 760); hg.addColorStop(0, 'rgba(255,226,122,.18)'); hg.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    vignette(ctx, .45);
  }
  shot('p8b14-hale-tel', k => k.start, k => k.two, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = 1.18 * lerp(1, 1.06, E.io(u));
    phoneBg(ctx);
    const jx = Math.sin(tw * 1.7) * 3, jy = Math.sin(tw * 1.1 + 1) * 3;
    ctx.save(); ctx.translate(520 + jx, 740 + jy); ctx.rotate(.05 + Math.sin(tw * .7) * .006); ctx.scale(z, z);
    haleHand(ctx, -BWd / 2 + 4, 10, false, 6);
    phone(ctx, gameImgs[haleIdx(t)]);
    haleHand(ctx, BWd / 2 - 4, 10, true, 6);
    const tap = Math.floor((t - k.start) * 3.2) % 2 === 0 ? 0 : 12;     // aceleci başparmak
    thumb(ctx, BWd / 2 + 10, 150, 300 + tap, P.hSkin, P.hSkinDk, 6, 183);
    ctx.restore();
    finish(ctx);
  });

  /* --- 14b: "…the same game as me." Kaan'ın bakışı: karşıda Hale telefonuyla; önde Kaan'ın telefonu kadraja kalkar, aynı oyun --- */
  function kaanPhoneFg(ctx, t, x, y, z, rot, frame) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(z, z);
    kaanHand(ctx, -BWd / 2 + 10, 0, false, 7); phone(ctx, gameImgs[frame]); kaanHand(ctx, BWd / 2 - 10, 0, true, 7);
    ctx.restore();
  }
  shot('p8b14-iki', k => k.two, k => k.bad, (ctx, t, u) => {
    const k = times(), tw = twos(t), kin = E.outC(seg(tw, k.kIn, k.kIn + .3));
    ctx.save(); cam(ctx, lerp(1.5, 1.56, E.io(u)), 540, 1180, 360, 900);
    wallB(ctx, t, {});
    haleSit(ctx, { expr: 'serious', look: .1, headRot: .08, headDy: 8, phone: true, frame: haleIdx(t), glow: 1, blink: blinkAt(tw, [k.two + .4]) });
    ctx.restore();
    vignette(ctx, .25);
    if (kin > 0) kaanPhoneFg(ctx, t, lerp(1250, 790, kin), lerp(1300, 900, kin) + Math.sin(tw * 1.4) * 3, .56, -.06, kaanIdx(t));
    finish(ctx);
  });

  /* --- 15: "Badly." Hale'in ekranı büyük: TIME'S UP iner; sonuç kartı; kalın başparmak "Try again"e bastırır (kuru) --- */
  shot('p8b15-kotu', k => k.bad, k => k.look0, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = 1.42 * lerp(1, 1.04, E.io(u));
    phoneBg(ctx);
    ctx.save(); ctx.translate(540, 700); ctx.rotate(.02); ctx.scale(z, z);
    haleHand(ctx, -BWd / 2 + 4, 10, false, 6);
    const tx = (TRY[0] - .5) * SWd, ty = (TRY[1] - .5) * SHd, rd = t - k.tap;
    phone(ctx, gameImgs[haleIdx(t)], c => { if (rd >= 0 && rd < .4) { c.strokeStyle = `rgba(255,255,255,${.9 * (1 - rd / .4)})`; c.lineWidth = 8; c.beginPath(); c.arc(tx, ty, 26 + rd * 220, 0, TAU); c.stroke(); } });
    haleHand(ctx, BWd / 2 - 4, 10, true, 6);
    const come = E.ioC(seg(tw, k.badly + .45, k.tap - .1)), press = t >= k.tap - .08 && t < k.tap + .12 ? 1 : 0, away = E.inQ(seg(tw, k.tap + .2, k.tap + .5));
    thumb(ctx, BWd / 2 + 10, lerp(180, tx + 30, come) + away * 160, lerp(330, ty + 46, come) + (press ? 10 : -14) * come + away * 260, P.hSkin, P.hSkinDk, 6, 183);
    ctx.restore();
    finish(ctx);
  });

  /* --- 16: "He looked at my screen." İki ekran: önde Kaan'ın telefonu (DEMOLISHED!), karşıda Hale eğilip ona bakar; Hale'in kucağında yeniden başlayan bölüm --- */
  shot('p8b16-bakti', k => k.look0, k => k.cu1, (ctx, t, u) => {
    const k = times(), tw = twos(t), lk = E.ioC(seg(tw, k.look - .05, k.look + .35));
    ctx.save(); cam(ctx, lerp(1.5, 1.62, E.io(u)), 540, 1180, 360, 900);
    wallB(ctx, t, {});
    haleSit(ctx, { expr: lk > .5 ? 'surprised' : 'serious', look: lerp(.1, 1, lk), lean: .1 * lk, headRot: .1 * lk, headDy: 10 * lk, phone: true, frame: Math.min(150, haleIdx(t)), glow: .6, blink: blinkAt(tw, [k.look0 + .2]) });
    ctx.restore();
    vignette(ctx, .25);
    kaanPhoneFg(ctx, t, 800, 920 + Math.sin(tw * 1.4) * 3, .58, -.06 - .05 * lk, 55);
    finish(ctx);
  });

  /* --- 17: "You rush the first move." Hale yakın; gözü Kaan'ın ekranında (sağ-aşağı) --- */
  function haleCU(ctx, t, o, cz, key) {
    ctx.drawImage(blurWall(key || 'cuB', 'B', cz[0], cz[1], cz[2], 540, cz[3] || 760, 12), 0, 0);
    ctx.save(); cam(ctx, cz[0], cz[1], cz[2], 540, cz[3] || 760);
    haleSit(ctx, o);
    ctx.restore();
    vignette(ctx, .3);
  }
  shot('p8b17-hale', k => k.cu1, k => k.kr1, (ctx, t, u) => {
    const k = times(), tw = twos(t), talking = tw >= k.cu1 + .2 && tw < TB.sentence(17).t1;
    const nod = talking ? Math.sin(tw * 7) * .03 : 0;
    haleCU(ctx, t, { expr: talking ? talkExpr(tw, 3, ['serious', 'confident', 'serious', 'tired']) : 'serious', look: .9, headRot: .1 + nod, headDy: 8, lean: .06, blink: blinkAt(tw, [k.cu1 + .9]), phone: true, frame: 150 }, [lerp(2.1, 2.2, E.io(u)), HALE.x + 40, 1060], 'cu17');
    finish(ctx);
  });

  /* --- Kaan'ın kısa tepkisi (cümle arası): yakalanmış gibi --- */
  function kaanCU(ctx, t, o, cz) {
    ctx.save(); cam(ctx, cz[0], cz[1], cz[2], 540, cz[3] || 780);
    wallA(ctx, t, { kaan: o, kaanHead: o.head, kaanFrame: 55, defne: o.defne || {} });
    ctx.restore();
    vignette(ctx, .3);
  }
  shot('p8b17-kaan', k => k.kr1, k => k.cu2, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    kaanCU(ctx, t, { hands: 'phone', expr: tw < k.kr1 + .16 ? 'calm' : 'sheepish', look: .5, glow: .2, head: [.04, 4] }, [lerp(2.2, 2.26, u), KAAN.x + 20, KAAN.y - 360 * CHS]);
    finish(ctx);
  });

  /* --- 18: "So did Kaya." Hale yakın (daha sıkı): gözü telefondan Kaan'ın yüzüne kalkar; "Kaya"da kaşlar yumuşar --- */
  shot('p8b18-kaya', k => k.cu2, k => k.kr2, (ctx, t, u) => {
    const k = times(), tw = twos(t), up = E.ioC(seg(tw, k.cu2 + .05, k.cu2 + .3)), soft = tw >= k.kaya;
    const talking = tw < TB.sentence(18).t1;
    const expr = soft ? (tw < k.kaya + .3 ? 'calm' : 'tired') : talkExpr(tw, 5, ['serious', 'confident']);
    haleCU(ctx, t, { expr, look: lerp(.9, .35, up), headRot: lerp(.1, -.02, up) + (talking && !soft ? Math.sin(tw * 7) * .02 : 0), headDy: lerp(8, 0, up), lean: .04, blink: blinkAt(tw, [k.kaya + .45]), phone: true, frame: 150 }, [lerp(2.6, 2.68, E.io(u)), HALE.x + 20, 1010, 740], 'cu18');
    finish(ctx);
  });

  /* --- Kaan ve Defne: dedenin adı. İkisi de Hale'e döner (Defne dosyayı sıkar) --- */
  shot('p8b18-ikisi', k => k.kr2, k => k.hat0, (ctx, t, u) => {
    const k = times(), tw = twos(t), hit = tw >= k.kr2 + .14;
    ctx.save(); cam(ctx, lerp(1.5, 1.56, E.io(u)), 340, 1080, 540, 820);
    wallA(ctx, t, { kaan: { hands: 'phone', expr: hit ? 'surprised' : 'calm', look: .4, glow: .15, blink: 0 }, kaanFrame: 55, defne: { expr: hit ? 'surprised' : 'serious', look: hit ? .3 : -.7, blink: 0 } });
    ctx.restore();
    vignette(ctx, .28);
    finish(ctx);
  });

  /* --- 19: "Then he said the rest, quietly." Hale telefonu bırakmış; sağ eli şapkayı başından alıp kucağına indirir --- */
  function hatState(tw) {
    const k = times(); return { off: E.ioC(seg(tw, k.hatOff - .1, k.hatOff + .4)), knee: E.ioC(seg(tw, k.hatOff + .7, k.hatKnee)) };
  }
  function haleWithHat(ctx, tw, base, hs) {
    // sağ ön kol dirsekten kalkar, şapkayı başından alır (hs.off), sonra kucağa indirir (hs.knee). Eski ön kol + el boyayla örtülür.
    if (hs.off <= 0) return haleSit(ctx, Object.assign({}, base, { hat: true, phone: false }));
    const s = HALE.s * 1.04, lw = 5.2 / Math.sqrt(s);
    if (hs.knee >= 1) return haleKnee(ctx, base);
    haleSit(ctx, Object.assign({}, base, { hat: false, phone: false }));
    ctx.save(); ctx.translate(HALE.x, HALE.y); ctx.scale(s, s);
    C.seed(4301); C.shape(ctx, [[126, -252], [128, -196], [44, -160], [8, -168], [10, -204], [86, -244]], P.suit, { lw: 0, ink: P.suit });
    C.shape(ctx, [[100, -232], [106, -150], [96, -118], [60, -118], [70, -200]], P.suitDk, { lw: 0, ink: P.suitDk });
    C.line(ctx, [[0, -226], [0, -118]], lw * .5); C.shape(ctx, C.ell(-8, -194, 5, 5, 8), P.suitDk, { lw: lw * .5 }); C.shape(ctx, C.ell(-8, -154, 5, 5, 8), P.suitDk, { lw: lw * .5 });
    const reach = E.io(seg(hs.off, 0, .45)), lift = E.io(seg(hs.off, .45, 1)), up = reach * (1 - hs.knee);
    const hx = lerp(2 + 10 * lift, 10, hs.knee), hy = lerp(-418 - 40 * lift, -168, hs.knee), rot = lerp(.06 * lift, .1, hs.knee);
    const gx = lerp(lerp(30, hx + 64, reach), hx + 64, hs.knee), gy = lerp(lerp(-190, hy + 4, reach), hy + 4, hs.knee);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(rot); hat(ctx, lw); ctx.restore();
    C.tube(ctx, [[104, -224], [lerp(120, 150, up), lerp(-236, -300, up)], [gx, gy + 6]], 44, 38, P.suit, lw);
    handR(ctx, gx, gy, 16, P.hSkin, lw);
    ctx.restore();
  }
  shot('p8b19-sapka', k => k.hat0, k => k.cu3, (ctx, t, u) => {
    const k = times(), tw = twos(t), hs = hatState(tw);
    const z = lerp(2.3, 2.42, E.io(u));
    ctx.drawImage(blurWall('cu19', 'B', 2.36, HALE.x + 40, 1000, 540, 640, 10), 0, 0);
    ctx.save(); cam(ctx, z, HALE.x + 40, 1000, 540, 640);
    haleWithHat(ctx, tw, { expr: hs.knee > .5 ? 'tired' : 'serious', look: hs.knee > .5 ? .3 : .6, headRot: lerp(.02, .08, hs.knee), headDy: lerp(0, 10, hs.knee), blink: blinkAt(tw, [k.hat0 + .3]) }, hs);
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 20: "The cheap concrete…" Hale yakın, şapkasız, alçak sesle (gözler aşağıda) --- */
  shot('p8b20-hale', k => k.cu3, k => k.f1, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.drawImage(blurWall('cu20', 'B', 2.56, HALE.x + 20, 1010, 540, 740, 12), 0, 0);
    ctx.save(); cam(ctx, lerp(2.5, 2.62, E.io(u)), HALE.x + 20, 1010, 540, 740);
    const talking = tw >= TB.sentence(20).t0 - .05;
    haleKnee(ctx, { expr: talking ? talkExpr(tw, 7, ['regret', 'tired', 'regret', 'serious']) : 'tired', look: .2, headRot: .06 + (talking ? Math.sin(tw * 6) * .015 : 0), headDy: 10, blink: blinkAt(tw, [k.cu3 + .25]) });
    ctx.restore();
    vignette(ctx, .32);
    finish(ctx);
  });

  /* ================= HATIRA (sepya) ================= */
  // f1 · "…was my idea." Şantiye: genç Hale ucuz beton torbalarına vurur (−40%), genç Kaya arkada kuşkulu.
  function bags(g) {
    C.seed(6101);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) {
      const x = 560 + i * 120 + r * 60, y = 1160 - r * 78;
      C.shape(g, [[x - 58, y], [x - 54, y - 74], [x + 54, y - 76], [x + 58, y]], '#e2d6b8', { lw: 4, shade: c => C.blot(c, [[x + 20, y - 80], [x + 64, y - 80], [x + 64, y + 4], [x + 26, y + 4]], '#bfae88', .7) });
      if (r === 2 || i === 0) { g.save(); g.font = '700 26px Rubik'; g.textAlign = 'center'; g.fillStyle = '#4a3c2c'; g.fillText('MIX', x, y - 40); g.font = '700 20px Rubik'; g.fillText('-40%', x, y - 14); g.restore(); }
    }
  }
  function site(g) {
    const sk = g.createLinearGradient(0, 0, 0, 1000); sk.addColorStop(0, '#c9d6d8'); sk.addColorStop(1, '#efe2c2'); g.fillStyle = sk; g.fillRect(0, 0, 1080, 1920);
    g.fillStyle = '#d8c39a'; g.fillRect(0, 1000, 1080, 920);
    C.seed(6102);
    // yarım bina iskeleti (kolon + döşeme)
    for (let f = 0; f < 4; f++) C.shape(g, [[140, 1000 - f * 150 - 18], [940, 1000 - f * 150 - 18], [940, 1000 - f * 150], [140, 1000 - f * 150]], '#b7ab92', { lw: 3 });
    for (let c = 0; c < 5; c++) C.shape(g, [[150 + c * 190, 1000], [150 + c * 190, 400], [176 + c * 190, 400], [176 + c * 190, 1000]], '#c4b89e', { lw: 3 });
    C.line(g, [[940, 400], [1040, 220], [1040, 1000]], 5, '#6a5a44', .5);   // vinç direği (uzak)
    C.shape(g, [[60, 430], [330, 426], [334, 500], [62, 504]], '#7a6649', { lw: 3 });
    g.save(); g.font = '700 50px Rubik'; g.textAlign = 'center'; g.fillStyle = '#efe2c0'; g.fillText('H & K', 197, 484); g.restore();
    for (let i = 0; i < 30; i++) C.blot(g, C.ell(rnd(6200 + i) * 1080, 1020 + rnd(6300 + i) * 800, 40 + rnd(i) * 70, 8 + rnd(i + 3) * 10, 10), '#c4ab80', .4);
  }
  shot('p8b20-f-beton', k => k.f1, k => k.f2, (ctx, t, u) => {
    const k = times(), tw = twos(t), pat = Math.abs(Math.sin((tw - k.f1) * 10)) > .5 ? 1 : 0;
    memory(ctx, g => {
      cam(g, lerp(1, 1.06, E.io(u)), 560, 900, 540, 900);
      site(g); bags(g);
      g.save(); g.translate(0, 0);
      g.save(); g.translate(250, 1090); g.scale(5.4, 5.4); youngMan(g, 0, { wide: false, suit: '#5e5a48', hat: false, arms: 'down', look: .8, brow: 2.2, mouth: 'down', seed: 943 }); g.restore();
      g.save(); g.translate(500, 1200); g.scale(6.2, 6.2); youngMan(g, 0, { wide: true, suit: '#d9c8a2', hat: true, arms: 'pat', pat, look: -.6, mouth: 'smile', seed: 944 }); g.restore();
      g.restore();
    });
    memEdge(ctx);
    finish(ctx);
  });

  // f2 · "When it went wrong," beton duvarda çatlak yürür (P7/P8 çatlak çizgisi), küçük toz düşer
  const CRACK = [[300, 380], [350, 470], [330, 560], [420, 640], [400, 740], [500, 820], [480, 930], [600, 1010], [580, 1100], [690, 1180]];
  shot('p8b21-f-catlak', k => k.f2, k => k.f3, (ctx, t, u) => {
    const k = times(), cu = E.outQ(seg(t, k.f2 + .1, k.f2 + .75));
    memory(ctx, g => {
      cam(g, lerp(1.05, 1.12, E.io(u)), 520, 800, 540, 760);
      g.fillStyle = '#cfc3a8'; g.fillRect(-200, -200, 1500, 2400);
      C.seed(6401); for (let i = 0; i < 70; i++) C.blot(g, C.ell(rnd(6500 + i) * 1080, rnd(6600 + i) * 1920, 6 + rnd(i) * 18, 4 + rnd(i + 1) * 10, 8), i % 2 ? '#b9ac8f' : '#dccfb2', .6);
      for (let y = 300; y < 1500; y += 210) C.line(g, [[-200, y], [1300, y + 4]], 2, 'rgba(21,18,13,.18)', .6);   // kalıp izleri
      C.shape(g, [[700, 420], [930, 418], [932, 520], [702, 522]], '#8f7d5e', { lw: 3 });
      g.save(); g.font = '700 54px Rubik'; g.textAlign = 'center'; g.fillStyle = '#e8dcbc'; g.fillText('H & K', 816, 490); g.restore();
      partial(g, CRACK, cu, 7, '#2e261c', 6402, 2);
      partial(g, [[420, 640], [520, 610], [580, 640]], seg(cu, .4, .8), 4, '#2e261c', 6403, 1.4);
      partial(g, [[500, 820], [420, 870], [380, 860]], seg(cu, .6, 1), 4, '#2e261c', 6404, 1.4);
      for (let i = 0; i < 14; i++) { const st = k.f2 + .2 + rnd(6700 + i) * .5, d = t - st; if (d < 0) continue; const p = CRACK[2 + (i % 7)]; g.fillStyle = 'rgba(120,108,88,.8)'; g.beginPath(); g.arc(p[0] + (rnd(6800 + i) - .5) * 30, p[1] + d * d * 900 + d * 60, 3 + rnd(i) * 3, 0, TAU); g.fill(); }
    });
    memEdge(ctx);
    finish(ctx);
  });

  // f3 · "your grandfather signed the papers." Üstten masa: krem kol (Hale) kâğıdı iter, iki imza satırı "H." "K.";
  // koyu iş ceketli el (Kaya) K satırını imzalar (P5 defterindeki "Kaya" imzasıyla aynı el yazısı); H satırı boş kalır.
  const DOC = { x: 540, y: 820, rot: -.03 };
  function documentPaper(g, t) {
    const k = times();
    C.seed(6901); C.shape(g, [[-260, -340], [260, -344], [264, 340], [-256, 344]], '#efe6cf', { lw: 4, shade: c => { c.fillStyle = 'rgba(160,118,62,.1)'; c.fillRect(-260, -340, 520, 690); } });
    g.save(); g.font = '700 30px Rubik'; g.textAlign = 'center'; g.fillStyle = '#3a3026'; g.fillText('STATEMENT', 0, -270); g.restore();
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(58,48,38,.45)'; g.fillRect(-210, -210 + i * 40, 420 * (i === 6 ? .55 : .92 + rnd(i + 6910) * .06), 6); }
    // iki imza satırı
    [[-210, 'H.'], [40, 'K.']].forEach(([x, lab]) => { C.line(g, [[x, 230], [x + 180, 228]], 2.4, '#3a3026', .4); g.save(); g.font = '700 26px Rubik'; g.fillStyle = '#3a3026'; g.fillText(lab, x, 270); g.restore(); });
    // Kaya'nın imzası (P5: handwrite 'Kaya' 40px bold tohum 953 + alt çizgi 954)
    const su = seg(t, k.sign0, k.sign1);
    if (su > 0) {
      const n = Math.max(1, Math.floor(4 * clamp(su / .75) + 1e-6));
      g.save(); g.beginPath(); g.rect(40, 150, 40 + 180 * clamp(su / .75), 100); g.clip(); C.handwrite(g, 'Kaya', 60, 214, 40, P.inkOld, 953, { bold: true }); g.restore(); void n;
      partial(g, [[54, 226], [100, 232], [148, 228], [176, 220]], seg(su, .75, 1), 2.4, P.inkOld, 954);
    }
  }
  function penHand(g, x, y, sleeve) {   // kalem tutan el (koyu kol), (x,y) kalem ucu
    C.seed(6950); g.save(); g.translate(x, y);
    C.shape(g, [[40, 40], [260, 330], [180, 420], [-20, 120]], sleeve, { lw: 4 });
    C.shape(g, [[0, 30], [70, -10], [120, 40], [110, 120], [40, 140], [-10, 90]], '#c7a57e', { lw: 4 });
    C.line(g, [[0, 0], [90, -60]], 9, '#2a2620', .2); C.line(g, [[0, 0], [10, -6]], 4, '#15120d', .1);
    g.restore();
  }
  shot('p8b21-f-imza', k => k.f3, k => k.f4, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const slide = E.outC(seg(tw, k.f3, k.f3 + .45)), back = E.inQ(seg(tw, k.f3 + .55, k.f3 + .85));
    const su = seg(tw, k.sign0, k.sign1);
    const z = lerp(1.05, 1.4, E.io(seg(t, k.sign0 - .3, k.f4))), cx = lerp(540, 620, E.io(seg(t, k.sign0 - .3, k.f4))), cy = lerp(840, 1030, E.io(seg(t, k.sign0 - .3, k.f4)));
    memory(ctx, g => {
      cam(g, z, cx, cy, 540, 700);
      g.fillStyle = '#6b4a2c'; g.fillRect(-300, -300, 1700, 2600);
      C.seed(6960); for (let i = 0; i < 14; i++) C.line(g, [[-300, i * 150 + rnd(i) * 40], [1400, i * 150 + 20]], 2, 'rgba(30,20,10,.35)', 1.5);
      g.save(); g.translate(DOC.x - 300 * (1 - slide), DOC.y + 120 * (1 - slide)); g.rotate(DOC.rot - .1 * (1 - slide)); documentPaper(g, t); g.restore();
      // Hale'in eli (açık renk kol, beyaz manşet) kâğıdı iter, sonra çekilir
      if (back < 1) { g.save(); g.translate(DOC.x - 300 * (1 - slide) - 300 - back * 400, DOC.y + 100 + back * 200); g.rotate(-.5); C.seed(6970);
        C.shape(g, [[-500, 40], [0, 0], [20, 90], [-500, 140]], '#d9c8a2', { lw: 4 }); C.shape(g, [[-30, -6], [10, -10], [24, 96], [-14, 100]], '#efe6cf', { lw: 3 });
        C.shape(g, [[10, -10], [110, -20], [150, 30], [120, 100], [20, 96]], '#c7a57e', { lw: 4 }); g.restore(); }
      // Kaya'nın eli: imza boyunca sağa yürür
      const pin = E.outC(seg(tw, k.sign0 - .45, k.sign0 - .05)), pout = E.inQ(seg(tw, k.sign1 + .05, k.sign1 + .3));
      if (pin > 0 && pout < 1) {
        const px = DOC.x + 60 + 180 * clamp(su / .75) + (su > .75 ? lerp(-30, 120, seg(su, .75, 1)) : 0), py = DOC.y + 214 - 8 * Math.abs(Math.sin(su * 22));
        penHand(g, px + (1 - pin) * 300 + pout * 300, py + (1 - pin) * 400 + pout * 400, '#5e5a48');
      }
    });
    memEdge(ctx);
    finish(ctx);
  });

  // f4 · "He took the blame. I took the company." H & K ofisinin önü: genç Kaya kutusuyla sola yürüyüp gider;
  // kamera sağa kayar: genç Hale merdivende, "H & K" tabelasının üstüne altın "HALE" levhasını asar (tek renk: altın).
  const SIGN = { x: 1280, y: 560, w: 340, h: 90 };
  function facade(g) {
    const sk = g.createLinearGradient(0, -200, 0, 1000); sk.addColorStop(0, '#c9d6d8'); sk.addColorStop(1, '#efe2c2'); g.fillStyle = sk; g.fillRect(-400, -400, 2600, 1500);
    g.fillStyle = '#cdbb95'; g.fillRect(-400, 1060, 2600, 900);
    C.seed(7101);
    C.shape(g, [[880, 1060], [880, 380], [1700, 380], [1700, 1060]], '#c4b28c', { lw: 4, shade: c => { for (let y = 420; y < 1060; y += 34) { c.fillStyle = 'rgba(120,98,70,.25)'; c.fillRect(880, y, 820, 3); } C.blot(c, [[1500, 370], [1720, 370], [1720, 1070], [1520, 1070]], '#a8956f', .5); } });
    C.shape(g, [[960, 1060], [960, 820], [1100, 820], [1100, 1060]], '#5b4a36', { lw: 4 });
    [[1160, 720], [1420, 720]].forEach(([x, y]) => { C.shape(g, [[x, y], [x + 200, y], [x + 200, y + 200], [x, y + 200]], '#8a9aa0', { lw: 4 }); C.line(g, [[x + 100, y], [x + 100, y + 200]], 3); });
    C.shape(g, [[SIGN.x - SIGN.w / 2, SIGN.y - SIGN.h / 2], [SIGN.x + SIGN.w / 2, SIGN.y - SIGN.h / 2 - 2], [SIGN.x + SIGN.w / 2 + 2, SIGN.y + SIGN.h / 2], [SIGN.x - SIGN.w / 2 - 2, SIGN.y + SIGN.h / 2]], '#7a6649', { lw: 4 });
    g.save(); g.font = '700 60px Rubik'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#efe2c0'; g.fillText('H & K', SIGN.x, SIGN.y + 4); g.restore();
    // sol: yol, çit, uzak ev
    C.line(g, [[-400, 1060], [880, 1060]], 3, 'rgba(21,18,13,.4)');
    for (let x = -380; x < 860; x += 60) C.line(g, [[x, 1060], [x, 990]], 4, '#8a7656', .4);
    C.line(g, [[-400, 1000], [860, 1000]], 4, '#8a7656', .4);
    C.shape(g, [[-200, 1000], [-200, 800], [100, 760], [400, 800], [400, 1000]], '#b9a682', { lw: 3 });
    for (let i = 0; i < 26; i++) C.blot(g, C.ell(-380 + rnd(7200 + i) * 2400, 1080 + rnd(7300 + i) * 700, 40 + rnd(i) * 80, 8 + rnd(i + 2) * 10, 10), '#b9a07a', .4);
  }
  function goldPlate(ctx, x, y, s) {   // altın "HALE" levhası (renkli: hatıranın tek rengi)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    C.seed(7401); C.shape(ctx, [[-170, -46], [170, -48], [172, 46], [-168, 48]], '#14161b', { lw: 4 });
    ctx.font = '400 74px "Lilita One"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const gg = ctx.createLinearGradient(0, -40, 0, 40); gg.addColorStop(0, '#ffe08a'); gg.addColorStop(1, P.goldDk); ctx.fillStyle = gg; ctx.fillText('HALE', 0, 4);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(21,18,13,.6)'; ctx.strokeText('HALE', 0, 4);
    ctx.restore();
  }
  function f4Cam(t) {
    const k = times(), p = E.ioC(seg(t, k.pan, k.pan + .7));
    return [lerp(1.0, 1.06, seg(t, k.f4, k.list0)), lerp(560, 1260, p), lerp(780, 700, p)];
  }
  function f4Plate(t) {   // levhanın konumu (dünya) ve ölçeği
    const k = times(), h = E.outBack(seg(twos(t), k.hang - .3, k.hang));
    return [lerp(SIGN.x + 60, SIGN.x, h), lerp(SIGN.y + 190, SIGN.y, h), lerp(.85, 1, h), h];
  }
  shot('p8b22-f-tabela', k => k.f4, k => k.list0, (ctx, t, u) => {
    const k = times(), tw = twos(t), [z, cx, cy] = f4Cam(t);
    const wk = seg(tw, k.f4, k.f4 + 1.6), kx = lerp(760, 140, wk), step = Math.sin(wk * 14) > 0 ? 1 : -1;
    const [px, py, ps, h] = f4Plate(t);
    memory(ctx, g => {
      cam(g, z, cx, cy, 540, 760);
      facade(g);
      // genç Kaya: kutuyla sola, geriye bakmadan (bir kez omzunun üstünden)
      g.save(); g.translate(kx, 1060 - 60 * 5.2); g.scale(5.2, 5.2); g.translate(0, 0); youngMan(g, 0, { wide: false, suit: '#5e5a48', hat: false, arms: 'box', step: step * .8, look: wk < .3 ? .9 : -.6, brow: 1.4, mouth: 'flat', seed: 943 }); g.restore();
      // genç Hale: merdivende, tabelanın altında; kollar yukarı (levha elinde), asınca iner
      g.save(); C.seed(7501); C.line(g, [[1150, 1060], [1200, 720]], 9, '#6a5a44', .3); C.line(g, [[1300, 1060], [1260, 720]], 9, '#6a5a44', .3);
      for (let r = 0; r < 5; r++) C.line(g, [[1155 + r * 9, 1010 - r * 66], [1296 - r * 7, 1010 - r * 66]], 7, '#6a5a44', .3); g.restore();
      g.save(); g.translate(1230, 878 - 60 * 5.6 + 60 * 5.6); g.translate(0, -60 * 5.6); g.scale(5.6, 5.6);
      youngMan(g, 0, { wide: true, suit: '#d9c8a2', hat: true, arms: h < 1 ? 'up' : 'down', look: -.2, mouth: h >= 1 ? 'smile' : 'flat', seed: 944 }); g.restore();
    });
    // altın levha hatıranın üstünde, renkli (aynı kamera)
    ctx.save(); cam(ctx, z, cx, cy, 540, 760); goldPlate(ctx, px, py, ps);
    if (h >= 1) { const sh = seg(t, k.hang, k.hang + .6); if (sh < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 * (1 - sh); ctx.fillStyle = '#ffe08a'; ctx.fillRect(SIGN.x - 170 + sh * 340 - 30, SIGN.y - 46, 40, 92); ctx.restore(); } }
    ctx.restore();
    memEdge(ctx);
    finish(ctx);
  });

  /* --- 24a: "I wanted your list…" Hale yakın: pişman, şapka kucakta; bakışı karşıya, Kaan'ın göğsüne iner --- */
  shot('p8b24-hale', k => k.list0, k => k.listW - .12, (ctx, t, u) => {
    const k = times(), tw = twos(t), dn = E.ioC(seg(tw, k.list0 + .5, k.listW - .2));
    ctx.drawImage(blurWall('cu24', 'B', 2.5, HALE.x + 10, 1010, 540, 740, 12), 0, 0);
    ctx.save(); cam(ctx, lerp(2.44, 2.56, E.io(u)), HALE.x + 10, 1010, 540, 740);
    haleKnee(ctx, { expr: talkExpr(tw, 11, ['regret', 'regret', 'tired', 'serious']), look: lerp(.2, .5, dn), headRot: .02 + .06 * dn + Math.sin(tw * 6) * .012, headDy: 4 + 10 * dn, blink: blinkAt(tw, [k.list0 + .3]) });
    ctx.restore();
    vignette(ctx, .32);
    finish(ctx);
  });

  /* --- 24b: "…so nobody would ever read it." Hale'in omzunun üstünden: karşıda Kaan, cebinde katlı liste; Defne yanında. İtme listeye --- */
  shot('p8b24-liste', k => k.listW - .12, k => k.num, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.45, 1.62, e), lerp(300, KAAN.x - 30 * CHS, e), lerp(1100, KAAN.y - 196 * CHS, e), 560, lerp(820, 1010, e));
    wallA(ctx, t, {
      kaan: { hands: 'knees', expr: tw >= k.listW + 1.2 ? 'worried' : 'serious', look: .25, blink: blinkAt(tw, [k.listW + .9]) },
      kaanHead: [tw >= k.listW + 1.2 ? .05 : 0, tw >= k.listW + 1.2 ? 8 : 0],
      defne: { expr: 'serious', look: .2, blink: blinkAt(tw, [k.listW + .4]) }
    });
    ctx.restore();
    // önde Hale'in sırtı (bulanık, sol alt): şapkasız baş + omuz
    ctx.save(); ctx.filter = 'blur(3px)'; haleBack(ctx, { x: 120 - 40 * e, y: 2330, s: 2.3, hat: false }); ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 25: "They called his number." Numaratör yakın: 101 → 102 tık, sonra 103 + ding, üç kez yanıp söner; alttan Hale'in eli 103 numaralı fişi kaldırır --- */
  shot('p8b25-numara', k => k.num, k => k.stand0, (ctx, t, u) => {
    const k = times(), tw = twos(t), d = t - k.ding;
    const num = d >= 0 ? 103 : t >= k.num + .1 ? 102 : 101;
    const off = d < 0 ? 0 : d < 2 / FPS ? 1 : d < 1.0 ? (Math.floor((d - 2 / FPS) * 6) % 2 === 0 ? 0 : .75) : 0;
    const cx = NUMBOX.x + NUMBOX.w / 2, cy = NUMBOX.y + NUMBOX.h / 2;
    ctx.save(); cam(ctx, lerp(1.8, 1.88, E.io(u)), cx, cy + 60, 540, 520);
    wallA(ctx, t, { kaan: false, defne: false, num, numOff: off });
    if (d >= 0 && d < .5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 300); g.addColorStop(0, `rgba(255,80,60,${.35 * (1 - d / .5)})`); g.addColorStop(1, 'rgba(255,80,60,0)'); ctx.fillStyle = g; ctx.fillRect(cx - 320, cy - 320, 640, 640); ctx.restore(); }
    ctx.restore();
    const hin = E.outC(seg(tw, k.ding + .2, k.ding + .55));
    if (hin > 0) {
      ctx.save(); ctx.translate(360, lerp(1500, 1030, hin)); ctx.rotate(-.12);
      haleHand(ctx, 0, -40, false, 6); ticket(ctx, 20, 30, 2.3, .05, '103');
      C.seed(5250); C.shape(ctx, [[-60, 120], [-10, 60], [40, 70], [40, 120], [-20, 150]], P.hSkin, { lw: 5 });
      ctx.restore();
    }
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 26: "He stood up." Pencere duvarı: Hale (şapka elde) ortadaki koltuktan kalkar --- */
  function standHale(ctx, rise, o) {   // rise 0 oturuş → 1 ayakta (ikişerli üç poz)
    const s = HALE.s * 1.04;
    if (rise <= 0) return haleKnee(ctx, o);
    const r = rise >= 1 ? 1 : rise > .5 ? .7 : .35;
    ctx.save(); ctx.translate(0, (1 - r) * 120 * s);
    haleTalk(ctx, Object.assign({ x: HALE.x, y: HALE.y, s: HALE.s, seed: 41, pose: 'stand', hat: 'hand', expr: 'serious' }, o), o.headRot || 0, o.headDy || 0, (1 - r) * .22);
    ctx.restore();
  }
  shot('p8b26-kalkar', k => k.stand0, k => k.hatOn0, (ctx, t, u) => {
    const k = times(), tw = twos(t), rise = seg(tw, k.rise, k.rise + .4);
    ctx.save(); cam(ctx, lerp(1.0, 1.05, E.io(u)), 540, 1150 - 60 * E.io(rise), 540, 960);
    wallB(ctx, t, {});
    standHale(ctx, rise, { expr: rise > .5 ? 'determined' : 'regret', look: rise > .5 ? .1 : .4, blink: blinkAt(tw, [k.stand0 + .2]) });
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 27: "He carried it for forty years." Orta plan: Hale şapkayı elinden başına koyar --- */
  function haleStandHat(ctx, hu, o) {
    const s = HALE.s * 1.04, lw = 5.2 / Math.sqrt(s), x = HALE.x;
    if (hu <= 0) return haleTalk(ctx, Object.assign({ x, y: HALE.y, s: HALE.s, seed: 41, pose: 'stand', hat: 'hand' }, o), o.headRot || 0, o.headDy || 0, 0);
    if (hu >= 1) return haleTalk(ctx, Object.assign({ x, y: HALE.y, s: HALE.s, seed: 41, pose: 'stand', hat: true }, o), o.headRot || 0, o.headDy || 0, 0);
    haleTalk(ctx, Object.assign({ x, y: HALE.y, s: HALE.s, seed: 41, pose: 'stand', hat: false }, o), o.headRot || 0, o.headDy || 0, 0);
    ctx.save(); ctx.translate(x, HALE.y); ctx.scale(s, s);
    const hx = lerp(30, 2, hu), hy = lerp(-262, -514, hu) - Math.sin(Math.PI * hu) * 40, rot = lerp(-.22, 0, hu);
    C.tube(ctx, [[80, -392], [lerp(106, 120, hu), lerp(-320, -420, hu)], [hx + 40, hy + 10]], 46, 38, P.suit, lw);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(rot); ctx.scale(lerp(.9, 1, hu), lerp(.9, 1, hu)); hat(ctx, lw); ctx.restore();
    handR(ctx, hx + 44, hy + 6, 16, P.hSkin, lw);
    ctx.restore();
  }
  shot('p8b27-sapka', k => k.hatOn0, k => k.chest, (ctx, t, u) => {
    const k = times(), tw = twos(t), hu = E.ioC(seg(tw, k.hatOn, k.hatOn + .55));
    const talking = tw >= TB.sentence(27).t0 - .05 && tw < TB.sentence(27).t1;
    ctx.save(); cam(ctx, lerp(1.5, 1.58, E.io(u)), HALE.x + 10, 1180, 540, 980);
    wallB(ctx, t, {});
    haleStandHat(ctx, hu, { expr: talking ? talkExpr(tw, 13, ['serious', 'tired', 'serious', 'determined']) : 'serious', look: .3, headRot: talking ? Math.sin(tw * 6) * .015 : 0, blink: blinkAt(tw, [k.hatOn0 + .3]) });
    ctx.restore();
    vignette(ctx, .28);
    finish(ctx);
  });

  /* --- 28: "I can carry the last one." Alt açı, yakın: omuzlar dikleşir (gövde yükselir), kararlı --- */
  shot('p8b28-omuz', k => k.chest, k => k.turn0, (ctx, t, u) => {
    const k = times(), tw = twos(t), up = E.outBack(seg(tw, k.straight, k.straight + .35));
    const talking = tw >= TB.sentence(28).t0 - .05 && tw < TB.sentence(28).t1;
    ctx.drawImage(blurWall('cu28', 'B', 1.9, HALE.x + 10, 1000, 540, 900, 8), 0, 0);
    ctx.save(); cam(ctx, lerp(1.86, 1.96, E.io(u)), HALE.x + 10, 1000, 540, 900);
    ctx.translate(HALE.x, HALE.y); ctx.scale(1, lerp(.975, 1.0, up)); ctx.translate(-HALE.x, -HALE.y);
    haleTalk(ctx, { x: HALE.x, y: HALE.y - 14 * up, s: HALE.s, seed: 41, pose: 'stand', hat: true, expr: talking ? (up > .5 ? talkExpr(tw, 17, ['determined', 'serious']) : talkExpr(tw, 15, ['tired', 'serious'])) : 'determined', look: .2, blink: blinkAt(tw, [k.chest + .25]) }, (talking ? Math.sin(tw * 6) * .012 : 0) - .03 * up, lerp(10, -4, up), 0);
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 29: "Empty my tower." Hale kameraya döner (bakış ve baş), sade; arkada pencere --- */
  shot('p8b29-kamera', k => k.turn0, k => k.end0, (ctx, t, u) => {
    const k = times(), tw = twos(t), tu = E.ioC(seg(tw, k.turn, k.turn + .3));
    ctx.drawImage(blurWall('cu29', 'B', 2.3, HALE.x + 6, 790, 540, 860, 10), 0, 0);
    ctx.save(); cam(ctx, lerp(2.26, 2.34, E.io(u)), HALE.x + 6, 790, 540, 860);
    haleTalk(ctx, { x: HALE.x, y: HALE.y - 14, s: HALE.s, seed: 41, pose: 'stand', hat: true, expr: tu > .5 ? 'determined' : 'serious', look: lerp(.8, 0, tu), blink: 0 }, lerp(.14, 0, tu), lerp(4, -4, tu), 0);
    ctx.restore();
    vignette(ctx, .34);
    finish(ctx);
  });

  /* --- Bitiş: pencere duvarı geniş. Hale ayakta, şapka başında, gişeye (sola) birkaç adım; pencereden Daisy, ışık üst üçte birde. TEK bip. --- */
  shot('p8b30-son', k => k.end0, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = frozen(t), ft = flow(t), tw = twos(ft);
    const e = E.io(seg(tf, k.end0, k.endF0 - .02)), after = E.io(seg(t, k.endF1, k.dur));
    const z = lerp(1.36, 1.28, e) + .03 * after;
    ctx.save(); cam(ctx, z, 620, 660, 540, 580);
    wallB(ctx, tf, {});
    // yürüyüş: ayakta önden, sola; ikişerli adım (bipte durur), kart altında kadrajdan çıkar
    const w1 = seg(ft, k.end0 + .12, k.endF0 + .02), w2 = seg(ft, k.endF0 + .02, k.endF0 + 2.2);
    const hx = HALE.x - 150 * E.io(w1) - 760 * E.inQ(w2), moving = (w1 > 0 && w1 < 1) || (w2 > 0 && w2 < 1);
    const ph = Math.floor(tw * 15 / 4) % 2, bob = moving ? (ph ? -10 : 0) : 0, sway = moving ? (ph ? .02 : -.02) : 0;
    haleTalk(ctx, { x: hx, y: HALE.y + bob, s: HALE.s, seed: 41, pose: 'stand', hat: true, expr: 'determined', look: -.6, blink: blinkAt(tw, [k.end0 + .9]) }, -.04, 0, sway);
    if (beepV(t, k.endBeep) > 0) { ctx.save(); ctx.translate(DZ.x, DZ.y); ctx.scale(DZ.s, DZ.s); drawBeacon(ctx, 1); ctx.restore(); }
    ctx.restore();
    if (beepV(t, k.endBeep) > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,90,60,.05)'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); }
    vignette(ctx, .22);
    const dk = .55 * E.io(seg(t, k.endCard - .1, k.endCard + .2)); if (dk > 0) { const g = ctx.createLinearGradient(0, 600, 0, 900); g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(1, `rgba(7,11,24,${dk})`); ctx.fillStyle = g; ctx.fillRect(0, 600, 1080, 1320); }
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const f3 = x => +x.toFixed(3);
  TB.cuesB = {
    get telefonGirer() { return f3(times().kIn); },                // Kaan'ın telefonu kadraja kayar (hafif kumaş)
    get timesUp() { return f3(times().badly); },                   // oyunun TIME'S UP damgası (oyun sesi, kısık)
    get telefonDokunus() { return f3(times().tap); },              // Hale'in kalın başparmağı "Try again"e (tok tık)
    get sapkaCikar() { return f3(times().hatOff); },               // şapka başından kalkar (keçe, çok hafif)
    get sapkaDiz() { return f3(times().hatKnee); },                // şapka dizine iner
    get hatiraBeton() { return f3(times().f1); },                  // sepya hatıra başlar (sessiz ya da yumuşak ton)
    get torbaVurus() { return f3(times().f1 + .12); },             // genç Hale torbaya vurur (pat, 3 kez)
    get catlak() { return f3(times().f2 + .1); },                  // betonda çatlak yürür (kuru çıtırtı, 0,65 sn)
    get kagitKayar() { return f3(times().f3); },                   // kâğıt masada kayar
    get imzaKalem() { return f3(times().sign0); },                 // dolma kalem kâğıtta (≈0,9 sn)
    get adimlarKaya() { return f3(times().f4); },                  // genç Kaya uzaklaşır (adımlar, 1,6 sn)
    get tabelaAsilir() { return f3(times().hang); },               // altın levha yerine oturur (metal tık)
    get numaratorTik() { return f3(times().num + .1); },             // 101→102 küçük tık (ding DEĞİL)
    get numaratorDing() { return f3(times().ding); },              // numaratör "ding" + sayı yanıp söner
    get fis() { return f3(times().ding + .2); },                   // fiş kâğıdı
    get kalkar() { return f3(times().rise); },                     // koltuk gıcırtısı, kalkış
    get sapkaBasa() { return f3(times().hatOn); },                 // şapka başa
    get adimlarGise() { return f3(times().end0 + .05); },          // Hale gişeye yürür (ayakkabı, karo; bipte durur)
    get sonBip() { return f3(times().endBeep); }                   // tek bip; ışık +0,04–0,24
  };
})();
