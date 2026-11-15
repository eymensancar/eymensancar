/* Part 8 · NUMBER NINE — Animatör B: cümle 14–29 ve bitiş görüntüsü. Başlangıç (S13.t1 + S14.t0) / 2 ≈ 25,88 sn → tl.duration.
   YERLEŞİM (dünya = C.drawWaitingRoom varsayılan alanı {0,0,1080,1920}; A'nın notu gelirse ona uyulur):
   • SALON: zemin çizgisi y 1267; numaratör kutusu x 670–951, y 230–422 ("NOW SERVING" altında); pano x 86–475, y 192–576.
     Sıra: üç koltuk, ayak ortası y 1651, ölçek 1.728 (koltuk ortaları x 212 / 540 / 868; oturak üstü y≈1381).
     Hale SOLDA (212,1651) s 1.66 'sit' (koltuk salonunki: seat:false); ortadaki koltuk BOŞ; Kaan SAĞDA (868,1651) s 1.8 'sit'.
     Kaan'ın cebinde katlı liste (göğüs cebi, ceketin sol yanı, ekranda Kaan'ın sağ göğsü).
   • NUMARALAR: ekran önce NUM.prev, "They called his number"da NUM.hale (Hale'in fişi), Kaan'ın fişi NUM.kaan.
   • TERS AÇI (bitiş): pencere duvarı (numaratörün karşısı): pencere x 120–960, y 170–640; dışarıda kaldırımda Daisy (540,628) s .5,
     uyarı ışığı ekranda ≈(540,455). Gişe (sağda) x 700–1010, tezgâh üstü y 1240. Hale arkadan, gişeye yürür.
   • HATIRA (sepya, P5 a05 fotoğrafındaki iki genç adamın büyütülmüş çizimi): genç Kaya ince, şapkasız, koyu iş ceketi;
     genç Hale iri, şapkalı, açık renk takım. Tek renk: tabeladaki altın "HALE".
   Her şey timeline'dan (times()); karakterler ikişerli, kamera/ışık birerli; bitiş bipinde ışıktan başka her şey donar. */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;
  const NUM = { prev: '087', hale: '088', kaan: '089' };

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

  /* ================= SALON ================= */
  const ROOM_K = 1920 / 1000 * .9, FL = 1920 * .66, ROWY = FL + 1920 * .2;     // koltuk ölçeği, zemin, sıra ayak çizgisi
  const SEATX = [540 - 190 * ROOM_K, 540, 540 + 190 * ROOM_K];
  const HALE = { x: SEATX[0], y: ROWY, s: 1.66 }, KAAN = { x: SEATX[2], y: ROWY, s: 1.8 };
  function room(num, blur) {
    return cached('salon-' + num + (blur ? '-b' + blur : ''), 1080, 1920, g => {
      if (blur) { g.filter = `blur(${blur}px)`; g.drawImage(room(num, 0), 0, 0); g.filter = 'none'; return; }
      C.drawWaitingRoom(g, { seed: 7, number: num, chairs: 3 });
    });
  }
  function roomBg(ctx, num, blur) {   // dünya koordinatında (kameranın içinde) çizilir; kenar dışı salon rengi
    ctx.fillStyle = P.hall; ctx.fillRect(-1200, -1200, 3480, FL + 1200); ctx.fillStyle = '#d6d1c2'; ctx.fillRect(-1200, FL, 3480, 2400);
    if (blur) ctx.drawImage(room(num, blur), -30, -30, 1140, 1980); else ctx.drawImage(room(num, 0), 0, 0);
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
  // Fiş (numara kâğıdı)
  function ticket(ctx, num, lw) {
    C.seed(5201); C.shape(ctx, [[-70, -40], [70, -44], [72, 44], [-68, 46]], '#f3eee2', { lw, shade: c => { c.fillStyle = 'rgba(21,18,13,.12)'; c.fillRect(-70, 22, 140, 22); } });
    ctx.save(); ctx.font = '700 46px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink; ctx.fillText(num, 0, -2);
    ctx.font = '500 12px Rubik'; ctx.fillText('CITY HALL · PERMITS', 0, 30); ctx.restore();
  }
  // Odadaki iki kişi (ikili planlar). o: {hale:{...}, kaan:{...}, num}
  function haleSit(ctx, h) {
    const o = Object.assign({ x: HALE.x, y: HALE.y, s: HALE.s, seed: 41, pose: 'sit', seat: false, hat: true, phone: true, expr: 'serious' }, h);
    haleTalk(ctx, o, h.headRot || 0, h.headDy || 0, h.lean || 0);
  }
  function kaanSit(ctx, kk) {
    C.drawKaan(ctx, Object.assign({ x: KAAN.x, y: KAAN.y, s: KAAN.s, seed: 11, pose: 'sit', seat: false, hands: 'phone', expr: 'calm' }, kk));
    if (kk.list !== false) { ctx.save(); ctx.translate(KAAN.x, KAAN.y); ctx.scale(KAAN.s, KAAN.s); pocketList(ctx, 5.2 / Math.sqrt(KAAN.s)); ctx.restore(); }
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

  /* ================= TERS AÇI: PENCERE DUVARI + DAISY + GİŞE ================= */
  const WIN = { x0: 120, x1: 960, y0: 170, y1: 640 };
  const DZ = { x: 540, y: 628, s: .5 };
  const BEACON = [DZ.x, DZ.y - 364 * DZ.s];
  function drawBeacon(ctx, v) { // pilotla aynı: yalnız uyarı ışığı (farlar değişmez)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(q => { const r = 40 + q * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - q * .2) * Math.min(1, v * 1.5), null, .5); }));
  }
  function windowWall() {
    return cached('pencere-duvar', 1080, 1920, g => {
      const lw = 3.8;
      g.fillStyle = P.hall; g.fillRect(0, 0, 1080, FL);
      g.fillStyle = '#b8bdb0'; g.fillRect(0, FL * .55, 1080, FL * .45); C.line(g, [[0, FL * .55], [1080, FL * .55]], 3, '#8e938a');
      [.25, .7].forEach(u => C.shape(g, [[1080 * u - 90, 20], [1080 * u + 90, 20], [1080 * u + 90, 36], [1080 * u - 90, 36]], '#f6f7ee', { lw: 3 }));
      // pencere: dışarısı (gündüz sokak, karşı binalar, kaldırım), Daisy kaldırımda
      g.save(); g.beginPath(); g.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); g.clip();
      const sk = g.createLinearGradient(0, WIN.y0, 0, 560); sk.addColorStop(0, '#8fbadb'); sk.addColorStop(.6, '#c9dbe0'); sk.addColorStop(1, '#f0e2c2'); g.fillStyle = sk; g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, 400);
      let cx = WIN.x0 - 20; C.seed(5301);
      while (cx < WIN.x1) { const bw = 70 + rnd(cx + 11) * 110, bh = 120 + rnd(cx + 13) * 200; C.shape(g, [[cx, 560], [cx, 560 - bh], [cx + bw, 560 - bh], [cx + bw, 560]], rnd(cx) < .5 ? P.far : '#c2c9c4', { lw: 1.8, ink: P.far2, amp: .4, shade: c => { c.fillStyle = 'rgba(158,173,183,.6)'; for (let yy = 560 - bh + 16; yy < 550; yy += 28) for (let xx = cx + 10; xx < cx + bw - 14; xx += 24) c.fillRect(xx, yy, 12, 14); } }); cx += bw + 6; }
      // tek ağaç (canlılık için önbellekte sabit, gövde)
      g.fillStyle = '#9a8a6a'; g.fillRect(860, 470, 10, 100); C.seed(5302); C.shape(g, C.ell(866, 450, 58, 50, 16), '#8b9a5a', { lw: 2, ink: '#5e6a3a', shade: c => C.blot(c, C.ell(890, 470, 40, 30, 10), '#6f7d45', .7) });
      g.fillStyle = '#9b958a'; g.fillRect(WIN.x0, 560, WIN.x1 - WIN.x0, 40); g.fillStyle = '#7d786f'; g.fillRect(WIN.x0, 596, WIN.x1 - WIN.x0, 50);
      C.line(g, [[WIN.x0, 600], [WIN.x1, 600]], 2, '#6a655c');
      g.save(); g.globalAlpha = .9; for (let x = WIN.x0; x < WIN.x1; x += 70) { g.fillStyle = '#c9c3b5'; g.fillRect(x, 618, 36, 4); } g.restore();
      C.drawDaisy(g, { x: DZ.x, y: DZ.y, s: DZ.s, seed: 23, beep: 0, mood: 'sleepy', hook: 0 });
      g.fillStyle = 'rgba(200,225,240,.16)'; g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);   // cam
      g.fillStyle = 'rgba(255,255,255,.14)'; [[200, 120], [560, 90], [760, 60]].forEach(([x, w]) => { g.beginPath(); g.moveTo(x, WIN.y0); g.lineTo(x + w, WIN.y0); g.lineTo(x + w - 200, WIN.y1); g.lineTo(x - 200, WIN.y1); g.fill(); });
      g.restore();
      // kasa + kayıtlar (mullion'lar ışığın iki yanında)
      C.seed(5303); C.shape(g, [[WIN.x0, WIN.y0], [WIN.x1, WIN.y0], [WIN.x1, WIN.y1], [WIN.x0, WIN.y1]], null, { lw: lw * 1.6 });
      [400, 680].forEach(x => C.shape(g, [[x - 7, WIN.y0], [x + 7, WIN.y0], [x + 7, WIN.y1], [x - 7, WIN.y1]], '#e9ebe3', { lw: 2.6 }));
      C.shape(g, [[WIN.x0 - 16, WIN.y1], [WIN.x1 + 16, WIN.y1], [WIN.x1 + 22, WIN.y1 + 22], [WIN.x0 - 22, WIN.y1 + 22]], '#e9ebe3', { lw: 3 });
      // gişe (sağda): cam bölme, numara lambası, tezgâh
      const gx = 700, gw = 310, gt = 760, gb = 1240;
      C.shape(g, [[gx, gt - 60], [gx + gw, gt - 60], [gx + gw, gb], [gx, gb]], '#cdbfa2', { lw, shade: c => C.blot(c, [[gx + gw * .7, gt - 70], [gx + gw + 10, gt - 70], [gx + gw + 10, gb], [gx + gw * .75, gb]], '#ac9f84', .6) });
      C.shape(g, [[gx + 30, gt], [gx + gw - 30, gt], [gx + gw - 30, gb - 120], [gx + 30, gb - 120]], '#a9c4cf', { lw: lw * .9, shade: c => { c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(gx + 60, gt); c.lineTo(gx + 110, gt); c.lineTo(gx + 50, gb - 120); c.lineTo(gx + 30, gb - 120); c.fill(); c.fillStyle = 'rgba(60,70,70,.35)'; c.fillRect(gx + 30, gb - 260, gw - 60, 140); } });
      C.shape(g, [[gx + gw / 2 - 60, gb - 150], [gx + gw / 2 + 60, gb - 150], [gx + gw / 2 + 60, gb - 120], [gx + gw / 2 - 60, gb - 120]], '#2a2d34', { lw: 2.4 });
      C.shape(g, [[gx + gw / 2 - 46, gt - 50], [gx + gw / 2 + 46, gt - 50], [gx + gw / 2 + 46, gt - 8], [gx + gw / 2 - 46, gt - 8]], '#14161b', { lw: 2.6 });
      g.save(); g.font = '400 34px "Lilita One"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(255,59,47,.8)'; g.shadowBlur = 8; g.fillStyle = P.beaconOn; g.fillText('3', gx + gw / 2, gt - 28); g.restore();
      C.shape(g, [[gx - 20, gb - 14], [gx + gw + 20, gb - 14], [gx + gw + 30, gb + 16], [gx - 30, gb + 16]], P.wood, { lw });
      C.shape(g, [[gx - 10, gb + 16], [gx + gw + 10, gb + 16], [gx + gw + 10, gb + 230], [gx - 10, gb + 230]], '#8a6a48', { lw, shade: c => C.blot(c, [[gx + gw * .7, gb + 10], [gx + gw + 20, gb + 10], [gx + gw + 20, gb + 240], [gx + gw * .72, gb + 240]], '#6a4f33', .6) });
      // sol: saksı + "PERMITS" levhası
      C.shape(g, [[60, 860], [300, 860], [300, 940], [60, 940]], '#2c4f66', { lw: 3 });
      g.save(); g.font = '700 34px Rubik'; g.fillStyle = '#f1e8d4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PERMITS', 180, 902); g.restore();
      C.shape(g, [[80, 1180], [170, 1180], [160, 1260], [90, 1260]], P.brick, { lw: 3 });
      C.seed(5304); for (let i = 0; i < 6; i++) C.shape(g, C.ell(125 + (i - 2.5) * 16, 1120 - (i % 3) * 30, 18, 40, 10, 0, TAU), '#6f7d45', { lw: 2.4 });
      // zemin
      g.fillStyle = '#d6d1c2'; g.fillRect(0, FL, 1080, 1920 - FL);
      g.strokeStyle = 'rgba(21,18,13,.2)'; g.lineWidth = 2; for (let i = -10; i < 20; i++) { g.beginPath(); g.moveTo(540 + i * 40, FL); g.lineTo(540 + i * 160, 1920); g.stroke(); }
      for (let yy = FL; yy < 1920; yy += (yy - FL) * .35 + 18) { g.beginPath(); g.moveTo(0, yy); g.lineTo(1080, yy); g.stroke(); }
      C.line(g, [[0, FL], [1080, FL]], lw, '#8e938a');
      // ışık penceresinden zemine düşen aydınlık
      g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,240,200,.5)'; g.beginPath(); g.moveTo(WIN.x0, FL); g.lineTo(WIN.x1, FL); g.lineTo(WIN.x1 + 300, 1920); g.lineTo(WIN.x0 - 300, 1920); g.fill(); g.restore();
    });
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
    C.shape(ctx, [[-48, -470], [-44, -500], [46, -500], [50, -470], [40, -448], [-38, -448]], P.gray, { lw: lw * .8 });
    C.shape(ctx, C.ell(-48, -466, 9, 13, 12), P.hSkinDk, { lw }); C.shape(ctx, C.ell(52, -466, 9, 13, 12), P.hSkinDk, { lw });
    if (o.hat !== false) { ctx.save(); ctx.translate(2, -514); hat(ctx, lw); ctx.restore(); }
    ctx.restore();
  }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 14a: Hale'in telefonu yakın (iri eller, krem kol); gerçek oyun: Old Textile Mill, C4 --- */
  function phoneBg(ctx, num) {
    ctx.drawImage(room(num || NUM.prev, 14), -200, -240, 1480, 2630);
    ctx.fillStyle = 'rgba(30,26,22,.35)'; ctx.fillRect(0, 0, 1080, 1920);
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
    // başparmak tıklar gibi bekler (aceleci): ekranın sağ altında iki kez iner
    const tap = Math.floor((t - k.start) * 3.2) % 2 === 0 ? 0 : 12;
    thumb(ctx, BWd / 2 + 10, 150, 300 + tap, P.hSkin, P.hSkinDk, 6, 183);
    ctx.restore();
    finish(ctx);
  });

  /* --- 14b: "the same game as me." İki telefon yan yana: solda Hale'in (krem kol), sağdan Kaan'ın (yeşil kol, sarı reflektör) girer --- */
  shot('p8b14-iki', k => k.two, k => k.bad, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = .66 * lerp(1, 1.03, E.io(u));
    phoneBg(ctx);
    const kin = E.outC(seg(tw, k.kIn, k.kIn + .3));
    ctx.save(); ctx.translate(lerp(540, 330, E.ioC(seg(t, k.two, k.kIn + .2))), 900); ctx.rotate(.04); ctx.scale(z, z);
    haleHand(ctx, -BWd / 2 + 4, 10, false, 7); phone(ctx, gameImgs[haleIdx(t)]); haleHand(ctx, BWd / 2 - 4, 10, true, 7);
    ctx.restore();
    if (kin > 0) {
      ctx.save(); ctx.translate(lerp(1300, 790, kin), 910 + Math.sin(tw * 1.4) * 3); ctx.rotate(-.05); ctx.scale(z, z);
      kaanHand(ctx, -BWd / 2 + 10, 0, false, 7); phone(ctx, gameImgs[kaanIdx(t)]); kaanHand(ctx, BWd / 2 - 10, 0, true, 7);
      ctx.restore();
    }
    finish(ctx);
  });

  /* --- 15: "Badly." Hale'in ekranı büyük: TIME'S UP iner; sonuç kartı; kalın başparmak "Try again"e bastırır (kuru) --- */
  shot('p8b15-kotu', k => k.bad, k => k.look0, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = 1.42 * lerp(1, 1.04, E.io(u));
    phoneBg(ctx);
    ctx.save(); ctx.translate(540, 700); ctx.rotate(.02); ctx.scale(z, z);
    haleHand(ctx, -BWd / 2 + 4, 10, false, 6);
    const tx = (TRY[0] - .5) * SWd, ty = (TRY[1] - .5) * SHd;
    const rd = t - k.tap;
    phone(ctx, gameImgs[haleIdx(t)], c => { if (rd >= 0 && rd < .4) { c.strokeStyle = `rgba(255,255,255,${.9 * (1 - rd / .4)})`; c.lineWidth = 8; c.beginPath(); c.arc(tx, ty, 26 + rd * 220, 0, TAU); c.stroke(); } });
    haleHand(ctx, BWd / 2 - 4, 10, true, 6);
    // başparmak: kart gelince yavaşça "Try again"e gelir, bir kez sertçe bastırır
    const come = E.ioC(seg(tw, k.badly + .45, k.tap - .1)), press = t >= k.tap - .08 && t < k.tap + .12 ? 1 : 0, away = E.inQ(seg(tw, k.tap + .2, k.tap + .5));
    thumb(ctx, BWd / 2 + 10, lerp(180, tx + 30, come) + away * 160, lerp(330, ty + 46, come) + (press ? 10 : -14) * come + away * 260, P.hSkin, P.hSkinDk, 6, 183);
    ctx.restore();
    finish(ctx);
  });

  /* --- 16: "He looked at my screen." İkili: Hale (solda) boş koltuğun üstünden eğilip Kaan'ın ekranına bakar --- */
  function twoShot(ctx, t, o) {
    roomBg(ctx, o.num || NUM.prev, 0);
    o.hale && haleSit(ctx, o.hale);
    o.kaan && kaanSit(ctx, o.kaan);
    o.hale && o.hale.phone !== false && smallScreen(ctx, 'hale', gameImgs[o.haleFrame || haleIdx(t)], o.hale.lean);
    o.kaan && o.kaan.hands !== 'knees' && smallScreen(ctx, 'kaan', gameImgs[o.kaanFrame || 55]);
  }
  shot('p8b16-bakti', k => k.look0, k => k.cu1, (ctx, t, u) => {
    const k = times(), tw = twos(t), lk = E.ioC(seg(tw, k.look - .05, k.look + .35));
    const z = lerp(1.02, 1.12, E.io(u));
    ctx.save(); cam(ctx, z, lerp(560, 600, E.io(u)), 1080, 540, 760);
    twoShot(ctx, t, {
      hale: { expr: 'serious', look: lerp(.3, 1, lk), lean: .12 * lk, headRot: .08 * lk, headDy: 6 * lk, blink: blinkAt(tw, [k.look0 + .2]) },
      kaan: { expr: lk > .5 ? 'surprised' : 'calm', look: lerp(.2, -.8, seg(tw, k.look + .3, k.look + .5)), glow: .25, blink: 0 },
      haleFrame: Math.min(150, haleIdx(t)), kaanFrame: 55
    });
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 17: "You rush the first move." Hale yakın; gözü Kaan'ın ekranında (aşağı-sağ) --- */
  function haleCU(ctx, t, o, cz) {
    ctx.save(); cam(ctx, cz[0], cz[1], cz[2], 540, cz[3] || 760);
    roomBg(ctx, o.num || NUM.prev, 10);
    haleSit(ctx, o);
    if (o.phone) smallScreen(ctx, 'hale', gameImgs[150], o.lean);
    ctx.restore();
    vignette(ctx, .3);
  }
  shot('p8b17-hale', k => k.cu1, k => k.kr1, (ctx, t, u) => {
    const k = times(), tw = twos(t), talking = tw >= times().cu1 + .2 && tw < TB.sentence(17).t1;
    const nod = talking ? Math.sin(tw * 7) * .03 : 0;
    haleCU(ctx, t, { expr: talking ? talkExpr(tw, 3, ['serious', 'confident', 'serious', 'tired']) : 'serious', look: .9, headRot: .1 + nod, headDy: 8, lean: .06, blink: blinkAt(tw, [k.cu1 + .9]), phone: true }, [lerp(2.3, 2.42, E.io(u)), HALE.x + 40, 1020]);
    finish(ctx);
  });

  /* --- Kaan'ın kısa tepkisi (cümle arası): ekranından başını kaldırır --- */
  function kaanCU(ctx, t, o, cz) {
    ctx.save(); cam(ctx, cz[0], cz[1], cz[2], 540, cz[3] || 780);
    roomBg(ctx, NUM.prev, 10);
    kaanSit(ctx, o);
    smallScreen(ctx, 'kaan', gameImgs[55]);
    ctx.restore();
    vignette(ctx, .3);
  }
  shot('p8b17-kaan', k => k.kr1, k => k.cu2, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    kaanCU(ctx, t, { expr: tw < k.kr1 + .16 ? 'calm' : 'sheepish', look: -1, glow: .2 }, [lerp(2.2, 2.26, u), KAAN.x - 30, 1000]);
    finish(ctx);
  });

  /* --- 18: "So did Kaya." Hale yakın (biraz daha sıkı): gözü telefondan Kaan'ın yüzüne kalkar; "Kaya"da kaşlar yumuşar --- */
  shot('p8b18-kaya', k => k.cu2, k => k.kr2, (ctx, t, u) => {
    const k = times(), tw = twos(t), up = E.ioC(seg(tw, k.cu2 + .05, k.cu2 + .3)), soft = tw >= k.kaya;
    const talking = tw < TB.sentence(18).t1;
    const expr = soft ? (tw < k.kaya + .3 ? 'calm' : 'tired') : talkExpr(tw, 5, ['serious', 'confident']);
    haleCU(ctx, t, { expr, look: lerp(.9, .6, up), headRot: lerp(.1, -.02, up) + (talking && !soft ? Math.sin(tw * 7) * .02 : 0), headDy: lerp(8, 0, up), lean: .06, blink: blinkAt(tw, [k.kaya + .45]), phone: true }, [lerp(2.7, 2.78, E.io(u)), HALE.x + 30, 1000, 740]);
    finish(ctx);
  });

  /* --- Kaan: dedenin adı ("Kaya") — şaşkın, telefon iner --- */
  shot('p8b18-kaan', k => k.kr2, k => k.hat0, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    kaanCU(ctx, t, { expr: tw < k.kr2 + .14 ? 'calm' : 'surprised', look: -1, glow: .15, blink: 0 }, [lerp(2.3, 2.42, E.io(u)), KAAN.x - 20, 990]);
    finish(ctx);
  });

  /* --- 19: "Then he said the rest, quietly." Orta plan: Hale telefonu bırakır, şapkasını çıkarıp dizine koyar --- */
  function hatState(tw) {   // 0 başta, 1 elde havada, 2 dizde
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
    ctx.save(); cam(ctx, z, HALE.x + 40, 1000, 540, 640);
    roomBg(ctx, NUM.prev, 8);
    haleWithHat(ctx, tw, { expr: hs.knee > .5 ? 'tired' : 'serious', look: hs.knee > .5 ? .3 : .6, headRot: lerp(.02, .08, hs.knee), headDy: lerp(0, 10, hs.knee), blink: blinkAt(tw, [k.hat0 + .3]) }, hs);
    // boş koltuk sağda; Kaan'ın dizi kadraj kenarında
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 20: "The cheap concrete…" Hale yakın, şapkasız, alçak sesle (gözler aşağıda) --- */
  function haleKnee(ctx, base) {   // şapka kucakta, telefon yok
    const s = HALE.s * 1.04, lw = 5.2 / Math.sqrt(s);
    haleSit(ctx, Object.assign({}, base, { hat: false, phone: false }));
    ctx.save(); ctx.translate(HALE.x, HALE.y); ctx.scale(s, s); hatOnKnee(ctx, lw, .1); ctx.restore();
  }
  shot('p8b20-hale', k => k.cu3, k => k.f1, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    ctx.save(); cam(ctx, lerp(2.5, 2.62, E.io(u)), HALE.x + 20, 1010, 540, 740);
    roomBg(ctx, NUM.prev, 10);
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

  /* --- 24: "I wanted your list so nobody would ever read it." Şimdi: Hale yakın (pişman, şapka kucakta) → bakışını izleyip Kaan'ın cebindeki listeye kayar --- */
  shot('p8b24-liste', k => k.list0, k => k.num, (ctx, t, u) => {
    const k = times(), tw = twos(t), p = E.ioC(seg(t, k.listW - .35, k.listW + .55));
    const z = lerp(2.3, 1.6, p) * lerp(1, 1.04, seg(t, k.listW + .55, k.num));
    const cx = lerp(HALE.x + 30, KAAN.x - 150, p), cy = lerp(1010, 1300, p);
    ctx.save(); cam(ctx, z, cx, cy, 540, 760);
    roomBg(ctx, NUM.prev, p < .5 ? 10 : 4);
    const talking = tw < TB.sentence(24).t1;
    haleKnee(ctx, { expr: talking ? talkExpr(tw, 11, ['regret', 'regret', 'tired', 'serious']) : 'regret', look: lerp(.4, 1, p), headRot: .1 + (talking ? Math.sin(tw * 6) * .012 : 0), headDy: 10, lean: .03, blink: blinkAt(tw, [k.list0 + .3]) });
    kaanSit(ctx, { expr: 'serious', look: -1, hands: 'knees', glow: 0, blink: blinkAt(tw, [k.listW + 1.1]) });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 25: "They called his number." Numaratör yakın: sayı değişir (ding), üç kez yanıp söner; altta Hale'in eli aynı numaralı fişi kaldırır --- */
  shot('p8b25-numara', k => k.num, k => k.stand0, (ctx, t, u) => {
    const k = times(), tw = twos(t), d = t - k.ding;
    const show = d < 0 ? NUM.prev : NUM.hale;
    const on = d < 0 ? 1 : d < 2 / FPS ? 0 : d < 1.0 ? (Math.floor((d - 2 / FPS) * 6) % 2 === 0 ? 1 : .25) : 1;
    // numaratör (yanıp sönme): dünya kutusu x 670–951, y 230–422
    ctx.save(); cam(ctx, lerp(2.4, 2.5, E.io(u)), 810, 420, 540, 620);
    roomBg(ctx, show, 0);
    if (on < 1) { ctx.fillStyle = `rgba(20,22,27,${1 - on})`; ctx.fillRect(674, 234, 273, 184); }
    if (d >= 0 && d < .5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(810, 336, 10, 810, 336, 260); g.addColorStop(0, `rgba(255,80,60,${.35 * (1 - d / .5)})`); g.addColorStop(1, 'rgba(255,80,60,0)'); ctx.fillStyle = g; ctx.fillRect(500, 100, 620, 500); ctx.restore(); }
    ctx.restore();
    // Hale'in eli fişle alttan girer (ding'den sonra)
    const hin = E.outC(seg(tw, k.ding + .2, k.ding + .55));
    if (hin > 0) {
      ctx.save(); ctx.translate(380, lerp(1500, 1010, hin)); ctx.rotate(-.12); ctx.scale(1.1, 1.1);
      haleHand(ctx, 0, -60, false, 6); ctx.save(); ctx.translate(30, 60); ctx.rotate(.05); ticket(ctx, NUM.hale, 4); ctx.restore();
      C.seed(5250); C.shape(ctx, [[-30, 110], [10, 70], [60, 80], [60, 130], [0, 150]], P.hSkin, { lw: 5 });   // başparmak fişin üstünde
      ctx.restore();
    }
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 26: "He stood up." İkili: Hale (şapka elde) kalkar; Kaan başını kaldırıp izler --- */
  function standHale(ctx, rise, o) {   // rise 0 oturuş → 1 ayakta (ikişerli üç poz)
    const s = HALE.s * 1.04;
    if (rise <= 0) return haleKnee(ctx, o);
    // koltuk sırtı Hale'in arkasında kalsın diye salonun koltuğu zaten çizili; ara poz: ayakta poz alçak ve öne eğik
    const r = rise >= 1 ? 1 : rise > .5 ? .7 : .35;
    ctx.save(); ctx.translate(0, (1 - r) * 120 * s);
    haleTalk(ctx, Object.assign({ x: HALE.x + 20 * r, y: HALE.y, s: HALE.s, seed: 41, pose: 'stand', hat: 'hand', expr: 'serious' }, o), o.headRot || 0, o.headDy || 0, (1 - r) * .22);
    ctx.restore();
  }
  shot('p8b26-kalkar', k => k.stand0, k => k.hatOn0, (ctx, t, u) => {
    const k = times(), tw = twos(t), rise = seg(tw, k.rise, k.rise + .4);
    const z = lerp(1.0, 1.06, E.io(u));
    ctx.save(); cam(ctx, z, 560, 1000 - 40 * E.io(rise), 540, 720);
    roomBg(ctx, NUM.hale, 0);
    standHale(ctx, rise, { expr: rise > .5 ? 'determined' : 'regret', look: rise > .5 ? .2 : .6, blink: blinkAt(tw, [k.stand0 + .2]) });
    kaanSit(ctx, { expr: rise > .3 ? 'surprised' : 'serious', look: -1, hands: 'knees', glow: 0, blink: 0 });
    ctx.restore();
    vignette(ctx, .25);
    finish(ctx);
  });

  /* --- 27: "He carried it for forty years." Orta plan: Hale ayakta, şapkayı elinden başına koyar --- */
  function haleStandHat(ctx, hu, o) {
    const s = HALE.s * 1.04, lw = 5.2 / Math.sqrt(s), x = HALE.x + 20;
    if (hu <= 0) return haleTalk(ctx, Object.assign({ x, y: HALE.y, s: HALE.s, seed: 41, pose: 'stand', hat: 'hand' }, o), o.headRot || 0, o.headDy || 0, 0);
    if (hu >= 1) return haleTalk(ctx, Object.assign({ x, y: HALE.y, s: HALE.s, seed: 41, pose: 'stand', hat: true }, o), o.headRot || 0, o.headDy || 0, 0);
    haleTalk(ctx, Object.assign({ x, y: HALE.y, s: HALE.s, seed: 41, pose: 'stand', hat: false }, o), o.headRot || 0, o.headDy || 0, 0);
    // şapka elden (30,-262 dönük) başa (2,-514): sağ kol kalkar
    ctx.save(); ctx.translate(x, HALE.y); ctx.scale(s, s);
    const hx = lerp(30, 2, hu), hy = lerp(-262 - 0, -514, hu) - Math.sin(Math.PI * hu) * 40, rot = lerp(-.22, 0, hu);
    C.tube(ctx, [[80, -392], [lerp(106, 120, hu), lerp(-320, -420, hu)], [hx + 40, hy + 10]], 46, 38, P.suit, lw);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(rot); ctx.scale(lerp(.9, 1, hu), lerp(.9, 1, hu)); hat(ctx, lw); ctx.restore();
    handR(ctx, hx + 44, hy + 6, 16, P.hSkin, lw);
    ctx.restore();
  }
  shot('p8b27-sapka', k => k.hatOn0, k => k.chest, (ctx, t, u) => {
    const k = times(), tw = twos(t), hu = E.ioC(seg(tw, k.hatOn, k.hatOn + .55));
    const talking = tw >= TB.sentence(27).t0 - .05 && tw < TB.sentence(27).t1;
    ctx.save(); cam(ctx, lerp(1.62, 1.72, E.io(u)), HALE.x + 30, 1180, 540, 900);
    roomBg(ctx, NUM.hale, 0);
    haleStandHat(ctx, hu, { expr: talking ? talkExpr(tw, 13, ['serious', 'tired', 'serious', 'determined']) : 'serious', look: .3, headRot: talking ? Math.sin(tw * 6) * .015 : 0, blink: blinkAt(tw, [k.hatOn0 + .3]) });
    ctx.restore();
    vignette(ctx, .28);
    finish(ctx);
  });

  /* --- 28: "I can carry the last one." Alt açı, yakın: omuzlar dikleşir (gövde yükselir), kararlı --- */
  shot('p8b28-omuz', k => k.chest, k => k.turn0, (ctx, t, u) => {
    const k = times(), tw = twos(t), up = E.outBack(seg(tw, k.straight, k.straight + .35));
    const talking = tw >= TB.sentence(28).t0 - .05 && tw < TB.sentence(28).t1;
    ctx.save(); cam(ctx, lerp(2.0, 2.12, E.io(u)), HALE.x + 30, 1060, 540, 900);
    roomBg(ctx, NUM.hale, 8);
    ctx.translate(HALE.x, HALE.y); ctx.scale(1, lerp(.975, 1.0, up)); ctx.translate(-HALE.x, -HALE.y);
    haleTalk(ctx, { x: HALE.x + 20, y: HALE.y - 14 * up, s: HALE.s, seed: 41, pose: 'stand', hat: true, expr: talking ? (up > .5 ? talkExpr(tw, 17, ['determined', 'serious']) : talkExpr(tw, 15, ['tired', 'serious'])) : 'determined', look: .2, blink: blinkAt(tw, [k.chest + .25]) }, (talking ? Math.sin(tw * 6) * .012 : 0) - .03 * up, lerp(10, -4, up), 0);
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 29: "Empty my tower." Hale kameraya döner (bakış ve baş), sade; sonra sessizlik --- */
  shot('p8b29-kamera', k => k.turn0, k => k.end0, (ctx, t, u) => {
    const k = times(), tw = twos(t), tu = E.ioC(seg(tw, k.turn, k.turn + .3));
    ctx.save(); cam(ctx, lerp(2.36, 2.44, E.io(u)), HALE.x + 24, 1000, 540, 860);
    roomBg(ctx, NUM.hale, 12);
    haleTalk(ctx, { x: HALE.x + 20, y: HALE.y - 14, s: HALE.s, seed: 41, pose: 'stand', hat: true, expr: tu > .5 ? 'determined' : 'serious', look: lerp(.8, 0, tu), blink: 0 }, lerp(.14, 0, tu), lerp(4, -4, tu), 0);
    ctx.restore();
    vignette(ctx, .34);
    finish(ctx);
  });

  /* --- Bitiş: ters açı. Pencere duvarı; Hale arkadan gişeye yürür; pencereden Daisy, uyarı ışığı üst üçte birde. TEK bip. --- */
  shot('p8b30-son', k => k.end0, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = frozen(t), ft = flow(t), tw = twos(tf);
    const e = E.io(seg(tf, k.end0, k.endF0 - .02)), after = E.io(seg(t, k.endF1, k.dur));
    const z = lerp(1.0, 1.08, e) + .04 * after;
    ctx.save(); cam(ctx, z, lerp(560, 580, e), lerp(900, 860, e) - 20 * after, 540, lerp(940, 920, e));
    ctx.drawImage(windowWall(), 0, 0);
    // pencerede canlılık: ağaç yaprağı salınımı + uzak kuş (bip penceresinde donar)
    const lv = Math.sin(ft * 1.7) * 4; ctx.save(); ctx.beginPath(); ctx.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); ctx.clip();
    C.seed(5302); C.shape(ctx, C.ell(866 + lv, 446, 50, 42, 14), '#93a262', { lw: 1.6, ink: '#5e6a3a' });
    ctx.restore();
    // Hale: yürüyüş (arkadan), gişeye
    const wu = seg(ft, k.end0 + .02, k.end0 + 2.0);
    const hx = lerp(330, 850, E.io(wu)), hy = lerp(1880, 1520, E.io(wu)), hs = lerp(1.5, 1.08, E.io(wu));
    const step = wu > 0 && wu < 1 ? (Math.floor(twos(ft) * 4) % 2 ? 1 : -1) : 0;
    haleBack(ctx, { x: hx, y: hy - (step ? 6 : 0), s: hs, step, hat: true });
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
    get numaratorDing() { return f3(times().ding); },              // numaratör "ding" + sayı yanıp söner
    get fis() { return f3(times().ding + .2); },                   // fiş kâğıdı
    get kalkar() { return f3(times().rise); },                     // koltuk gıcırtısı, kalkış
    get sapkaBasa() { return f3(times().hatOn); },                 // şapka başa
    get adimlarGise() { return f3(times().end0 + .05); },          // Hale gişeye yürür (ayakkabı, karo; bipte durur)
    get sonBip() { return f3(times().endBeep); }                   // tek bip; ışık +0,04–0,24
  };
})();
