/* Part 2 · THE ANT — Animatör B: cümle 15–31 + bitiş. Başlangıç (S14.t1+S15.t0)/2 ≈ 24,93 sn, bitiş tl.duration.
   AVLU YERLEŞİMİ (dünya = C.drawYard varsayılanı: {x:0,y:0,w:1080,h:1920}, seed 7, mode 'day', ufuk y≈1075):
   - baraka x 108–670, taban y 1267; pencere x 187–355, y 852–1048 (içinden alçak asılı takvim, P2 ipucu);
     ofis kapısı x 445–569, y 852–1267, topuz (544,1068), kapı levhası "OFFICE".
   - çit y≈1344, bahçe kapısı x 778–994; posta kutusu direği (670,1536), kutu x 636–704, y 1288–1336.
   - Daisy: s .8; kapının önünden geçip (620,1580)'de durur (bom ucu ≈(526,893), kanca ≈(526,1185)); bipte kapı arkada.
   - Kaan s .9 (telefon planında (360,1760)), Defne s .9 kahveyle (470,1745); bitişte Kaan (380,1560).
   Her şey timeline'dan (times()); karakterler ikişerli, kamera/toz birerli; bip penceresinde her şey donar. */
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
    k.start = (S(14).t1 + S(15).t0) / 2;                 // A ile ortak kesme
    k.locked = W(15, /^locked/i, 3).t0;
    k.rattle = [k.locked - .14, k.locked + .12];          // topuz iki kez takırdar
    k.drive = S(15).t1 + .29;                             // Daisy kapının önünden geçer
    k.cuBip = W(16, /^she/i, 7).t0 - .16;                 // kabin yakın plan
    k.alert = W(16, /^beeped/i, 8).t0;                    // siperlik bipten önce kalkar
    k.beep = c.beep; k.freeze0 = c.beep - .3; k.freeze1 = c.beep + .57 + 10 / FPS;
    k.stop = k.freeze0 - .15;                             // Daisy durur (donmadan önce)
    k.twice = S(17).t0;
    k.hook = S(17).t1 + .44;                              // boş kanca
    k.nothing = S(19).t0;
    k.phone = S(20).t0 - .46;
    k.study = S(21).t0 - .21; k.brow = S(21).t0 - .04;
    k.game = W(22, /^study/i, 3).t0 - .11;                // oyun ekranı ≤ 3 sn
    k.half = W(23, /^halfway/i, 4).t0;
    k.pocket = S(23).t1 + .07;
    k.pocketIn = W(24, /^pocket/i, 5).t0;
    k.walk = S(24).t1 - .05;
    k.turn = k.walk + .6;
    k.lid = W(25, /^mailbox/i, 4).t0 + .03;
    k.env = S(26).t0 - .14;
    k.city = W(27, /^city/i, 2).t0;
    k.face = S(27).t1 + .53;
    k.reported = W(28, /^reported/i, 2).t0;
    k.line = S(28).t1 + .39;
    k.sign = S(29).t1 + .58;
    k.ironline = W(30, /^Ironline/i, 3).t0;
    k.yard = S(30).t1 + .48;
    k.end = c.voiceEnd; k.endBeep = c.endBeep; k.endCard = c.endCard; k.dur = tl.duration;
    k.endF0 = k.endBeep - .3; k.endF1 = k.endBeep + .24 + 10 / FPS;
    K = k; return k;
  }

  /* İki bip (pilotla birebir): tonlar dosya başından 0,04–0,24 ve 0,37–0,57 sn; ışık 6 yanık / 4 sönük / 6 yanık. */
  const TONES = [[.04, .24], [.37, .57]];
  function beepAt(t, t0, n) {
    const d = t - t0; let v = 0;
    for (let i = 0; i < (n || 2); i++) if (d >= TONES[i][0] - 1e-6 && d < TONES[i][1] - 1e-6) v = i ? 1 : .8;
    return v;
  }
  // bip pencerelerinde zaman durur (ışıktan başka hiçbir şey kıpırdamaz)
  function frozen(t) {
    const k = times();
    if (t >= k.freeze0 && t < k.freeze1) return k.freeze0;
    if (t >= k.endF0 && t < k.endF1) return k.endF0;
    return t;
  }
  // donmayı çıkaran "sürekli" zaman (kanca salınımı bip sonrası kaldığı yerden sürer)
  function flow(t) { const k = times(); return t < k.freeze0 ? t : t < k.freeze1 ? k.freeze0 : t - (k.freeze1 - k.freeze0); }

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
  function limb(ctx, A, B, wa, wb, fill, sd) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    return C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 7, shade: c => C.blot(c, [[A[0] - nx * wa * .1, A[1] - ny * wa * .1], [B[0] - nx * wb * .1, B[1] - ny * wb * .1], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], P.jacketDk, .55) });
  }
  // Kaan'ın eli (yumruk/kavrama), ön kol sağ alttan gelir (pilottaki el ile aynı dil). rot ile döner, flip ile soldan.
  function grip(ctx, x, y, rot, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); if (o.flip) ctx.scale(-1, 1); if (o.s) ctx.scale(o.s, o.s);
    limb(ctx, [380, 300], [900, 520], 92, 118, P.jacket, 233);
    limb(ctx, [70, 20], [380, 300], 60, 86, P.jacket, 232);
    C.seed(234); C.shape(ctx, C.ell(380, 300, 82, 80, 20), P.jacket, { lw: 0 });
    C.shape(ctx, [[58, -44], [128, -14], [96, 76], [30, 46]], P.hazard, { lw: 6 });
    C.seed(235);
    C.shape(ctx, [[-78, -50], [36, -72], [70, 6], [34, 66], [-70, 60], [-98, 6]], P.skin, { lw: 6.5, shade: c => C.blot(c, [[10, -80], [90, -80], [90, 90], [20, 90]], P.skinDk, .5) });
    for (let i = 0; i < 3; i++) C.line(ctx, [[-94 + i * 4, -20 + i * 26], [-54 + i * 4, -16 + i * 26]], 4.2);
    C.shape(ctx, [[-62, -60], [28, -82], [42, -60], [-48, -36]], '#d79a6c', { lw: 5 });
    ctx.restore();
  }
  function airDust(ctx, t, n, sb, box, a) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(241,232,212,${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }

  /* ================= DÜNYA: AVLU ================= */
  const YD = (() => { const hz = 1920 * .56, bx = 108, bw = 561.6, by = hz + 192, bh = 576;
    return { hz, bx, bw, by, bh, wx: bx + bw * .14, wy: by - bh * .72, ww: bw * .3, wh: bh * .34, dx: bx + bw * .6, dw: bw * .22, dh: bh * .72,
      mx: 777.6 - 108, my: hz + 1920 * .14 + 192 }; })();
  const DAISY = { x: 620, y: 1580, s: .8 };
  const KAAN = { x: 360, y: 1760, s: .9 }, DEFNE = { x: 470, y: 1745, s: .9 };
  const TIP = [-117.6, -859.3], HOOKL = 360;                           // Daisy yerel bom ucu ve kanca halatı (boom 0)

  // pencere içi: loş oda, duvarda iğneli kâğıt, ALÇAK asılı takvim (söylenmez, işaretlenmez)
  function officeWindow(ctx) {
    const { wx, wy, ww, wh } = YD;
    ctx.save(); ctx.beginPath(); ctx.rect(wx + 2, wy + 2, ww - 4, wh - 4); ctx.clip();
    ctx.fillStyle = '#3b4744'; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#2e3836'; ctx.fillRect(wx, wy + wh * .82, ww, wh);                      // pencere altı gölge
    ctx.save(); ctx.translate(wx + ww * .12, wy + wh * .14); ctx.rotate(-.04); C.seed(611);
    C.shape(ctx, [[0, 0], [ww * .26, 0], [ww * .26, wh * .2], [0, wh * .2]], '#c9bfa6', { lw: 2 }); ctx.restore();
    // takvim: çivisi yukarıda, ip uzun, kâğıt pencerenin alt kenarına kadar sarkar
    const cx = wx + ww * .74, cw = ww * .26, ct = wy + wh * .56, chh = wh * .4;
    C.seed(612); C.line(ctx, [[cx, wy + wh * .12], [cx, ct]], 1.4, 'rgba(21,18,13,.8)', .1);
    C.shape(ctx, C.ell(cx, wy + wh * .12, 3, 3, 8), P.steel, { lw: 1.2 });
    ctx.save(); ctx.translate(cx, ct); ctx.rotate(.03);
    C.shape(ctx, [[-cw / 2, 0], [cw / 2, 0], [cw / 2, chh], [-cw / 2, chh]], '#d9cfb8', { lw: 2, shade: c => { c.fillStyle = '#8f4a2c'; c.fillRect(-cw / 2 - 2, -2, cw + 4, chh * .3); } });
    ctx.strokeStyle = 'rgba(21,18,13,.3)'; ctx.lineWidth = 1; for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) ctx.strokeRect(-cw * .42 + q * cw * .168, chh * .4 + r * chh * .14, cw * .168, chh * .14);
    ctx.restore();
    // cam: hafif mavi ton + yansıma
    ctx.fillStyle = 'rgba(43,69,82,.32)'; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(wx + ww * .18, wy); ctx.lineTo(wx + ww * .34, wy); ctx.lineTo(wx + ww * .14, wy + wh); ctx.lineTo(wx - ww * .02, wy + wh); ctx.fill();
    ctx.restore();
    C.seed(613); C.line(ctx, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], 2.5); C.line(ctx, [[wx, wy + wh / 2], [wx + ww, wy + wh / 2]], 2.5);
    C.shape(ctx, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], null, { lw: 3.6 });
  }
  // kapı levhası + anahtar deliği
  function doorDetail(ctx) {
    const { dx, dw, dh, by } = YD;
    ctx.save(); ctx.font = '700 15px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink;
    ctx.fillText('OFFICE', dx + dw * .5, by - dh * .73); ctx.restore();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(dx + dw * .8, by - dh * .48 + 16, 2.6, 0, TAU); ctx.fill(); ctx.fillRect(dx + dw * .8 - 1.2, by - dh * .48 + 16, 2.4, 6);
  }
  function grass(ctx, t, box) {
    const b = box || [-100, 1290, 1300, 640];
    for (let i = 0; i < 22; i++) {
      const r = j => rnd(1700 + i * 9 + j), x = b[0] + r(1) * b[2], y = b[1] + r(2) * b[3], ph = r(3) * 6;
      if (x > YD.bx - 10 && x < YD.bx + YD.bw + 10 && y < YD.by + 20) continue;
      for (let q = 0; q < 5; q++) {
        const sw = Math.sin(t * 2.4 + ph + q * .5) * 6 + Math.sin(t * 4.7 + ph) * 2, hh = 18 + r(4 + q) * 18;
        ctx.strokeStyle = P.weed; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + q * 4, y);
        ctx.quadraticCurveTo(x + q * 4 + (q - 2) * 3, y - hh * .6, x + q * 4 + (q - 2) * 4 + sw, y - hh); ctx.stroke();
      }
    }
  }
  function drawBeacon(ctx, v) { // pilotla aynı: bipte yalnız uyarı ışığı (farlar değişmez)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(k => { const r = 40 + k * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - k * .2) * Math.min(1, v * 1.5), null, .5); }));
  }
  function daisy(ctx, d) {
    C.drawDaisy(ctx, { x: d.x, y: d.y, s: d.s, seed: 23, beep: 0, mood: d.mood || 'sleepy', hook: d.hook || 0 });
    if (d.beep > 0) { ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.s, d.s); drawBeacon(ctx, d.beep); ctx.restore(); }
  }
  // Daisy'nin sürüşü: bahçe kapısından girer, ofis kapısının önünden geçer, DAISY noktasında durur.
  function daisyPos(t) {
    const k = times(), u = E.outC(seg(t, k.drive, k.stop)), x = lerp(960, DAISY.x, u), y = lerp(1395, DAISY.y, u), s = lerp(.62, DAISY.s, u);
    const moving = t > k.drive - .4 && t < k.stop;
    return { x, y: y + (moving ? Math.sin(twos(t) * 40) * 1.4 : 0), s };
  }
  function hookSw(t) { // sürüşte geride kalır, durunca öne salınıp söner; "Nothing."te durur
    const k = times(), ft = flow(t), fs = flow(k.stop);
    if (ft < fs) return .07 * Math.sin(Math.PI * seg(ft, k.drive, fs));
    const d = ft - fs, damp = 1 - E.io(seg(t, k.nothing - .7, k.nothing + .1));
    return -.17 * Math.exp(-.55 * d) * Math.sin(2.5 * d) * damp;
  }
  function hookWorld(d, sw) { const tx = d.x + TIP[0] * d.s, ty = d.y + TIP[1] * d.s; return [tx + Math.sin(sw) * HOOKL * d.s, ty + Math.cos(sw) * HOOKL * d.s]; }

  function world(ctx, t, o) {
    o = o || {};
    ctx.fillStyle = '#c9dbe0'; ctx.fillRect(-2000, -2000, 5000, YD.hz + 2000);       // avlu alanının dışı (kamera taşarsa)
    ctx.fillStyle = P.groundDk; ctx.fillRect(-2000, YD.hz, 5000, 4000);
    C.drawYard(ctx, { seed: 7, mode: 'day', letter: true });
    officeWindow(ctx); doorDetail(ctx);
    const items = [];
    if (o.daisy) items.push([o.daisy.y, () => daisy(ctx, o.daisy)]);
    if (o.defne) items.push([o.defne.y - .1, () => drawDefneLean(ctx, o.defne)]);
    if (o.kaan) items.push([o.kaan.y, () => o.kaan.draw ? o.kaan.draw(ctx) : C.drawKaan(ctx, Object.assign({ seed: 11 }, o.kaan))]);
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    if (!o.noGrass) grass(ctx, t);
  }
  function drawDefneLean(ctx, d) { // Defne, ayaklarından eğilebilir (omuz üstünden bakış)
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.lean || 0); ctx.translate(-d.x, -d.y);
    C.drawDefne(ctx, { x: d.x, y: d.y, s: d.s, seed: 31, expr: d.expr || 'calm', look: d.look || 0, blink: d.blink || 0, item: d.item === undefined ? 'coffee' : d.item, flip: d.flip });
    if (d.after) d.after(ctx);
    ctx.restore();
  }
  function blurredWorld(key, z, cx, cy, blur, o, sx, sy) {
    return cached(key, 1080, 1920, c => {
      const tmp = canvas(1080, 1920), g = tmp.getContext('2d');
      g.fillStyle = '#c9dbe0'; g.fillRect(0, 0, 1080, 1920);
      cam(g, z, cx, cy, sx, sy); world(g, 0, Object.assign({ noGrass: true }, o || {}));
      c.filter = `blur(${blur}px)`; c.drawImage(tmp, 0, 0); c.filter = 'none';
    });
  }

  /* ================= OYUN KARELERİ (gerçek: k2, fabrika kulesi devrilir) ================= */
  const gameImgs = {};
  for (let i = 56; i <= 92; i++) gameImgs[i] = TB.img('assets/img/oyun/f' + String(i).padStart(4, '0') + '.jpg');
  function gameFrameNo(t) {
    const k = times();
    if (t < k.game) return 56;
    return 56 + Math.round(36 * E.outC(seg(t, k.game, k.half)));      // "halfway"de kule yarıya yatmış (kare 92), orada kalır
  }
  const gameFrame = t => gameImgs[gameFrameNo(t)];

  // Kaan'ın elindeki küçük telefonun ekranına gerçek kare (drawKaan yerel: (92,-236), -0,22 rad)
  function kaanPhoneScreen(ctx, x, y, s, t) {
    const im = gameFrame(t); if (!im || !im.naturalWidth) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(92, -236); ctx.rotate(-.22);
    ctx.beginPath(); ctx.rect(-9.5, -24.5, 19, 40); ctx.clip(); ctx.drawImage(im, -11, -24.5, 22.5, 40); ctx.restore();
  }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* --- 15: kapı kolu, kilitli (iki takırtı) --- */
  shot('p2b-kilit', k => k.start, k => k.drive, (ctx, t, u) => {
    const k = times(), tw = twos(t), knob = [YD.dx + YD.dw * .8, YD.by - YD.dh * .48];
    const z = lerp(3.3, 3.45, E.io(u));
    // takırtı: topuz ±, kapı 1–2 px
    let rot = 0, jx = 0;
    k.rattle.forEach(r => { const d = t - r; if (d >= 0 && d < .2) { const f = Math.floor(d * FPS); rot += [.22, -.12, .16, -.06, .04, 0][f] || 0; jx += [2, -1.5, 1, 0, 0, 0][f] || 0; } });
    ctx.save(); cam(ctx, z, knob[0] - 40, knob[1] - 20, 540, 820);
    ctx.translate(jx / z, 0);
    world(ctx, t, {});
    ctx.restore();
    // el: sağ alttan gelir, topuzu kavrar, takırdatır, bırakır
    const s = z / 3.3, kx = 540 + 40 * z + jx, ky = 820 + 20 * z;
    const inU = E.outC(seg(tw, k.start + .05, k.start + .4)), outU = E.inQ(seg(tw, k.drive - .3, k.drive));
    const hx = kx + 30 + (1 - inU) * 520 + outU * 560, hy = ky + 10 + (1 - inU) * 640 + outU * 520;
    grip(ctx, hx, hy, -.25 + rot, { s: s * .95 });
    finish(ctx);
  });

  /* --- 16: Daisy ofis kapısının önünden geçer (geniş) --- */
  shot('p2b-surus', k => k.drive, k => k.cuBip, (ctx, t, u) => {
    const z = lerp(1.04, 1.1, E.io(u)), d = daisyPos(t);
    ctx.save(); cam(ctx, z, 560, 1230, 540, 900);
    world(ctx, t, { daisy: { x: d.x, y: d.y, s: d.s, hook: hookSw(t) } });
    // tekerlerin arkasında toz
    for (let i = 0; i < 10; i++) { const r = j => rnd(4400 + i * 7 + j), a = (t - (times().drive + r(1) * .8)); if (a < 0) continue;
      const life = clamp(1 - a / 1.4); ctx.fillStyle = `rgba(216,202,176,${.5 * life})`; ctx.beginPath(); ctx.arc(d.x + 140 * d.s + r(2) * 260 * d.s + a * 40, d.y - 10 - a * 30 - r(3) * 30, 14 + a * 40, 0, TAU); ctx.fill(); }
    airDust(ctx, t, 16, 31, [0, 900, 1080, 700], .8);
    ctx.restore();
    finish(ctx);
  });

  /* --- 16–17: kabin, arkada ofis kapısı; İKİ BİP (pencerede her şey donar) --- */
  shot('p2b-bip', k => k.cuBip, k => k.hook, (ctx, t, u) => {
    const k = times(), tf = frozen(t), d = daisyPos(tf);
    const zu = E.outC(seg(tf, k.cuBip, k.freeze0)), push = t >= k.freeze1 ? E.io(seg(t, k.freeze1, k.hook)) : 0;
    const z = lerp(1.62, 1.78, zu) + .08 * push;
    const idle = t < k.freeze0 && tf === t ? Math.sin(twos(t) * 40) * 1.1 : 0;
    ctx.save(); cam(ctx, z, DAISY.x - 10, DAISY.y - 300 + idle, 560, 760 + 40 * push);
    world(ctx, tf, { daisy: { x: d.x, y: d.y, s: d.s, hook: hookSw(t), mood: tf >= k.alert ? 'alert' : 'sleepy', beep: beepAt(t, k.beep) } });
    ctx.restore();
    finish(ctx);
  });

  /* --- 18–19: boş kanca, pencerede alçak takvim; kanca "Nothing."te durur --- */
  shot('p2b-kanca', k => k.hook, k => k.phone, (ctx, t, u) => {
    const sw = hookSw(t), hw = hookWorld(DAISY, 0), z = lerp(2.62, 2.78, E.io(u));
    ctx.save(); cam(ctx, z, hw[0], hw[1] - 30, 830, 900);
    world(ctx, t, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s, hook: sw } });
    airDust(ctx, t, 14, 33, [100, 850, 700, 400], .7);
    ctx.restore();
    finish(ctx);
  });

  /* --- 20: Defne omuz üstünden telefona bakar --- */
  function kaanWithPhone(t, o) {
    const kx = KAAN.x, ky = KAAN.y, s = KAAN.s;
    return { x: kx, y: ky, s, draw: ctx => { C.drawKaan(ctx, Object.assign({ x: kx, y: ky, s, seed: 11, phone: true }, o)); kaanPhoneScreen(ctx, kx, ky, s, t); } };
  }
  shot('p2b-telefon', k => k.phone, k => k.study, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(2.05, 2.15, E.io(u));
    const lean = -.13 * E.outBack(seg(tw, k.phone + .25, k.phone + .85));
    const dx = lerp(560, DEFNE.x, E.outC(seg(tw, k.phone, k.phone + .7)));
    const blink = (tw >= k.phone + 1.1 && tw < k.phone + 1.1 + 3 / FPS) ? 1 : 0;
    ctx.save(); cam(ctx, z, 420, 1420, 540, 860);
    world(ctx, t, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s }, defne: { x: dx, y: DEFNE.y, s: DEFNE.s, lean, look: -1, expr: 'calm' }, kaan: kaanWithPhone(t, { expr: 'calm', look: .6, blink }) });
    ctx.restore();
    finish(ctx);
  });

  /* --- 21: "Study notes?" Defne'nin kaşı kalkar; Kaan mahcup --- */
  shot('p2b-kas', k => k.study, k => k.game, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(3.0, 3.12, E.io(u));
    const tilt = .06 * E.outBack(seg(tw, k.brow, k.brow + .3));
    const dExpr = tw >= k.brow ? 'confident' : 'calm', kExpr = tw >= k.brow + .45 ? 'sheepish' : 'calm';
    ctx.save(); cam(ctx, z, 425, 1340, 540, 760);
    world(ctx, t, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s }, defne: { x: DEFNE.x, y: DEFNE.y, s: DEFNE.s, lean: -.13 + tilt, look: tw >= k.brow ? -.6 : -1, expr: dExpr }, kaan: kaanWithPhone(t, { expr: kExpr, look: tw >= k.brow + .45 ? .9 : .6 }) });
    ctx.restore();
    finish(ctx);
  });

  /* --- 22–23: telefon yakın plan, gerçek oyun: kule yarıya yatar (≤ 3 sn) --- */
  function drawHandSide(ctx, x, y, flip, lw) {
    C.seed(flip ? 162 : 161); ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -1 : 1, 1);
    C.shape(ctx, [[-30, 420], [-120, 520], [-60, 760], [150, 760], [120, 480]], P.jacketDk, { lw });
    C.shape(ctx, [[-100, 470], [100, 430], [110, 470], [-90, 515]], P.hazard, { lw: lw * .8 });
    C.shape(ctx, [[-70, 440], [-80, 260], [-40, 120], [0, 60], [36, 90], [30, 200], [70, 260], [100, 450]], P.skin, { lw, shade: c => C.blot(c, [[30, 60], [120, 60], [120, 460], [50, 460]], P.skinDk, .5) });
    C.line(ctx, [[-30, 300], [10, 330]], lw * .5, P.skinDk); C.line(ctx, [[-36, 220], [6, 248]], lw * .5, P.skinDk);
    ctx.restore();
  }
  const SW = 486, SH = 864, BWd = 548, BHt = 1000;
  function phoneBody(ctx, t) {
    C.seed(171); C.shape(ctx, rrectPts(-BWd / 2, -BHt / 2, BWd, BHt, 64, 6), P.steelDk, { lw: 7, shade: c => { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-BWd / 2, -BHt / 2, 30, BHt); } });
    C.shape(ctx, [[-60, -BHt / 2 + 24], [60, -BHt / 2 + 24], [60, -BHt / 2 + 36], [-60, -BHt / 2 + 36]], '#0b0c10', { lw: 0 });
    ctx.save(); rrect(ctx, -SW / 2, -SH / 2, SW, SH, 34); ctx.clip();
    const im = gameFrame(t); if (im && im.naturalWidth) ctx.drawImage(im, -SW / 2, -SH / 2, SW, SH); else { ctx.fillStyle = P.screen; ctx.fillRect(-SW / 2, -SH / 2, SW, SH); }
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(-SW / 2, -SH / 2 + 80); ctx.lineTo(-SW / 2 + 220, -SH / 2); ctx.lineTo(-SW / 2 + 300, -SH / 2); ctx.lineTo(-SW / 2, -SH / 2 + 180); ctx.fill();
    ctx.restore();
    C.seed(173); C.ink(ctx, (() => { const p = new Path2D(); const q = C.wobble(rrectPts(-SW / 2, -SH / 2, SW, SH, 34, 6), true, .5); p.moveTo(q[0][0], q[0][1]); q.forEach(v => p.lineTo(v[0], v[1])); p.closePath(); return p; })(), 4);
  }
  shot('p2b-oyun', k => k.game, k => k.pocket, (ctx, t, u) => {
    const k = times(), z = 1.24 * lerp(.97, 1.04, E.io(u));
    const bg = blurredWorld('bg-oyun', 2.4, 470, 1250, 10, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s } });
    ctx.drawImage(bg, 0, 0);
    ctx.fillStyle = 'rgba(21,18,13,.18)'; ctx.fillRect(0, 0, 1080, 1920);
    vignette(ctx, .45);
    const tw = twos(t), jx = Math.sin(tw * 2.1) * 3, jy = Math.sin(tw * 1.3 + 1) * 3, rot = -.06 + Math.sin(tw * .8) * .006;
    ctx.save(); ctx.translate(540 + jx, 740 + jy); ctx.rotate(rot * .6); ctx.transform(1, 0, -.03, 1, 0, 0); ctx.scale(z, z);
    drawHandSide(ctx, -BWd / 2 + 10, 0, false, 6);
    phoneBody(ctx, t);
    drawHandSide(ctx, BWd / 2 - 10, 0, true, 6);
    // sağ başparmak ekranın kenarında, oynamaz (dokunmuyor: kule kendiliğinden düşer)
    C.seed(172);
    C.shape(ctx, [[BWd / 2 + 60, 380], [300, 300], [262, 286], [236, 306], [244, 346], [BWd / 2 + 20, 470]], P.skin, { lw: 6 });
    ctx.restore();
    finish(ctx);
  });

  /* --- 24: telefon cebe (yakın plan) --- */
  shot('p2b-cep', k => k.pocket, k => k.walk, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1, 1.04, E.io(u));
    ctx.save(); cam(ctx, z, 540, 900);
    // ceket kumaşı
    C.seed(801);
    ctx.fillStyle = P.jacket; ctx.fillRect(-100, -100, 1300, 2200);
    C.blot(ctx, [[760, -100], [1200, -100], [1200, 2100], [820, 2100], [700, 900]], '#0b1f2a', .28);
    C.line(ctx, [[120, -100], [140, 700], [100, 1400], [130, 2100]], 5, P.jacketDk, 3);
    C.line(ctx, [[600, 1400], [660, 1700], [640, 2100]], 4, P.jacketDk, 3);
    const PY = 1080, PX0 = 200, PX1 = 900;
    // telefon + el
    const down = E.io(seg(tw, k.pocket + .15, k.pocketIn)), up = E.outQ(seg(tw, k.pocketIn + .02, k.walk + .1));
    const py = lerp(520, PY + 420, down);
    // cep içindeki çıkıntı (telefon girdikçe belirir) + kumaştan sızan ekran ışığı
    const inside = clamp((py + 360 - PY) / 720);
    if (inside > 0) {
      C.seed(802); C.shape(ctx, rrectPts(400, PY + 20, 350, Math.min(560, 640 * inside), 50, 4), P.jacket, { lw: 4, shade: c => C.blot(c, [[620, PY], [700, PY], [700, PY + 480], [640, PY + 480]], '#0b1f2a', .35) });
      ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(575, PY + 200, 10, 575, PY + 200, 260); g.addColorStop(0, `rgba(255,226,122,${.18 * inside * (1 - seg(tw, k.pocketIn, k.walk))})`); g.addColorStop(1, 'rgba(255,226,122,0)'); ctx.fillStyle = g; ctx.fillRect(300, PY - 100, 560, 700); ctx.restore();
    }
    ctx.save(); ctx.beginPath(); ctx.rect(-100, -200, 1300, PY + 200); ctx.clip();
    ctx.save(); ctx.translate(575, py); ctx.rotate(.04); ctx.scale(.68, .68);
    phoneBody(ctx, k.half);
    ctx.restore();
    ctx.restore();
    // cep ağzı (dikiş + kapak)
    C.seed(803); C.shape(ctx, [[PX0, PY - 14], [PX1, PY - 22], [PX1 + 6, PY + 10], [PX0 - 4, PY + 18]], P.jacketDk, { lw: 5 });
    C.line(ctx, [[PX0 + 10, PY + 30], [PX1 - 10, PY + 22]], 2.5, 'rgba(21,18,13,.5)', .6);
    // el: telefonun üstünü kavrar, cebe bırakır, yukarı çekilir
    // el telefonun üst kenarını yukarıdan tutar (kol sağ üstten); inerken bilek hafifçe döner, bırakınca yumuşakça sağ üste çekilir
    const wrist = Math.sin(Math.PI * down) * .14 + down * .1 - up * .3;
    const hx = 575 + 40 + up * 260 + Math.sin(Math.PI * down) * 14, hy = py - 330 - up * 520;
    grip(ctx, hx, hy, -1.72 + wrist, { s: .95 });
    ctx.restore();
    finish(ctx);
  });

  /* --- 24–25: Kaan sırıtır, posta kutusuna yürür --- */
  shot('p2b-posta', k => k.walk, k => k.lid, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1.62, 1.72, E.io(u));
    const wu = seg(tw, k.turn, k.lid - .15), kx = lerp(420, 585, E.io(wu)), ky = lerp(1700, 1590, E.io(wu));
    let kaan;
    if (tw < k.turn) kaan = { x: 420, y: 1700, s: KAAN.s, expr: 'smile', look: -.8, phone: false };
    else kaan = { x: kx, y: ky, s: KAAN.s, pose: 'side', step: wu < 1 ? Math.sin(wu * Math.PI * 4) : 0, expr: 'smile', phone: false };
    ctx.save(); cam(ctx, z, 560, 1400, 540, 900);
    world(ctx, t, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s }, defne: { x: 300, y: 1760, s: DEFNE.s, look: tw < k.turn ? .8 : 1, expr: 'serious', blink: (tw > k.walk + .9 && tw < k.walk + 1) ? 1 : 0 }, kaan });
    ctx.restore();
    finish(ctx);
  });

  /* --- 25: posta kutusunun kapağı açılır --- */
  const MB = { x: 540, y: 820, w: 520, h: 360 };
  function mailboxCU(ctx, open, envOut) {
    const { x, y, w, h } = MB, x0 = x - w / 2, y0 = y - h / 2;
    C.seed(821);
    C.line(ctx, [[x, y + h / 2], [x, 2100]], 70, P.steelDk, .4);
    C.shape(ctx, [[x0 + w, y0], [x0 + w + 120, y0 - 70], [x0 + w + 120, y0 + h - 60], [x0 + w, y0 + h]], '#2c4f66', { lw: 6 });
    C.shape(ctx, [[x0, y0], [x0 + w, y0], [x0 + w + 120, y0 - 70], [x0 + 120, y0 - 70]], '#5584a3', { lw: 6 });
    // iç (koyu) + zarf
    C.shape(ctx, [[x0 + 14, y0 + 14], [x0 + w - 14, y0 + 14], [x0 + w - 14, y0 + h - 14], [x0 + 14, y0 + h - 14]], '#16212b', { lw: 4 });
    if (envOut < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x0 + 16, y0 + 16, w - 32, h - 32); ctx.clip(); ctx.translate(x - 20, y + 70 - envOut * 400); ctx.rotate(-.06); C.seed(822);
      C.shape(ctx, [[-200, -90], [200, -96], [204, 90], [-196, 96]], P.paper, { lw: 4, shade: c => C.blot(c, [[-210, 20], [210, 20], [210, 100], [-210, 100]], P.paperDk, .6) }); ctx.restore(); }
    // kapak: alt menteşeden aşağı açılır (scaleY 1 → -0,35)
    const sy = lerp(1, -.35, open);
    ctx.save(); ctx.translate(x, y0 + h); ctx.scale(1, sy); C.seed(823);
    C.shape(ctx, [[-w / 2, -h], [w / 2, -h], [w / 2, 0], [-w / 2, 0]], sy > 0 ? '#3f6f8f' : '#2c4f66', { lw: 6, shade: c => { C.blot(c, [[w * .2, -h], [w / 2 + 10, -h], [w / 2 + 10, 10], [w * .26, 10]], '#2c4f66', .55); C.blot(c, [[-w / 2 + 20, -h * .3], [-w * .2, -h * .4], [-w * .25, -h * .1]], P.rust, .35); } });
    if (sy > 0) { C.line(ctx, [[-w * .32, -h * .72], [w * .32, -h * .72]], 6); C.shape(ctx, [[-30, -h + 30], [30, -h + 30], [30, -h + 54], [-30, -h + 54]], P.steelLt, { lw: 4 }); }
    ctx.restore();
  }
  shot('p2b-kapak', k => k.lid, k => k.env, (ctx, t, u) => {
    const k = times(), tw = twos(t), z = lerp(1, 1.05, E.io(u));
    const bg = blurredWorld('bg-posta', 2.2, 700, 1300, 9, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s } });
    ctx.drawImage(bg, 0, 0);
    const open = E.outBack(seg(tw, k.lid + .2, k.lid + .5));
    ctx.save(); cam(ctx, z, 540, 900);
    mailboxCU(ctx, open, 0);
    // el: kapağın üst kenarını tutar, aşağı çeker
    const lidTop = MB.y + MB.h / 2 - MB.h * lerp(1, -.35, open), inU = E.outC(seg(tw, k.lid, k.lid + .2));
    const outU = E.inQ(seg(tw, k.lid + .5, k.env));
    grip(ctx, lerp(-200, 380, inU) - outU * 500, lidTop - 30 + (1 - inU) * 300 + outU * 300, -.4, { flip: true, s: .9 });
    ctx.restore();
    finish(ctx);
  });

  /* --- 26–27: tek mektup; belediye mührü --- */
  function cityEnvelope(ctx) {
    const W = 760, H = 430; C.seed(831);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.fillRect(-W / 2 + 14, -H / 2 + 16, W, H); ctx.restore();
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], P.paper, { lw: 6, shade: c => C.blot(c, [[-W / 2, H * .3], [W / 2, H * .26], [W / 2, H / 2 + 4], [-W / 2, H / 2 + 4]], P.paperDk, .5) });
    ctx.save(); ctx.textAlign = 'left'; ctx.fillStyle = P.ink;
    ctx.font = '700 40px Rubik'; ctx.fillText('CITY HALL', -W / 2 + 150, -H / 2 + 74);
    ctx.font = '500 24px Rubik'; ctx.fillText('Building Safety Office', -W / 2 + 152, -H / 2 + 110);
    ctx.font = '500 30px Rubik'; ctx.fillText('KAAN KAYA', -60, 40); ctx.fillText('Kaya Yard', -60, 82);
    ctx.restore();
    // belediye mührü (mürekkep, kabartma çizgileri): kule + üç yıldız, çift halka
    ctx.save(); ctx.translate(-W / 2 + 82, -H / 2 + 88);
    ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.stroke(); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 47, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#3a3026'; ctx.fillRect(-14, -18, 28, 40); ctx.fillRect(-22, 14, 44, 8); for (let i = -1; i <= 1; i++) ctx.fillRect(i * 10 - 3, -26, 6, 8);
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * .55; ctx.beginPath(); ctx.arc(Math.cos(a) * 37, Math.sin(a) * 37 + 2, 3.5, 0, TAU); ctx.fill(); }
    ctx.restore();
    // pul + damga çizgileri (sağ üst)
    C.shape(ctx, [[W / 2 - 110, -H / 2 + 26], [W / 2 - 30, -H / 2 + 26], [W / 2 - 30, -H / 2 + 120], [W / 2 - 110, -H / 2 + 120]], '#c9bfa6', { lw: 3 });
    for (let i = 0; i < 4; i++) C.line(ctx, [[W / 2 - 190, -H / 2 + 50 + i * 16], [W / 2 - 60, -H / 2 + 46 + i * 16]], 2.5, 'rgba(21,18,13,.55)', 1.5);
  }
  shot('p2b-zarf', k => k.env, k => k.face, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredWorld('bg-posta', 2.2, 700, 1300, 9, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s } });
    ctx.drawImage(bg, 0, 0); ctx.fillStyle = 'rgba(21,18,13,.12)'; ctx.fillRect(0, 0, 1080, 1920);
    const rise = E.outC(seg(tw, k.env, k.env + .5));
    const pu = E.io(seg(t, k.city - .55, k.city + .1));               // "city"de mühre itme
    const z = lerp(1, 1.12, E.io(u)) * lerp(1, 1.75, pu);
    const cx = lerp(0, -298, pu), cy = lerp(0, -127, pu);
    ctx.save(); ctx.translate(540, lerp(1500, 700, rise) + lerp(0, 140, pu)); ctx.scale(z, z); ctx.translate(-cx, -cy); ctx.rotate(lerp(-.14, -.03, rise));
    cityEnvelope(ctx);
    grip(ctx, 300, 160, -.6, { s: .8 });
    ctx.restore();
    finish(ctx);
  });

  /* --- 28: Kaan'ın yüzü, ter damlası --- */
  shot('p2b-yuz', k => k.face, k => k.line, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurredWorld('bg-yuz', 1.4, 640, 1080, 8, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s } });
    ctx.drawImage(bg, 0, 0);
    const worried = tw >= k.reported + .1;
    const look = worried ? (Math.sin(tw * 3) > 0 ? -.3 : .2) : .3;
    const blink = (tw >= k.face + .35 && tw < k.face + .35 + 3 / FPS) ? 1 : 0;
    ctx.save(); cam(ctx, lerp(1, 1.06, E.io(u)), 540, 900);
    C.drawKaan(ctx, { x: 520, y: 2200, s: 3.2, seed: 11, expr: worried ? 'worried' : 'calm', look, blink, phone: false });
    // açık mektubun arkası (alt kenarda)
    ctx.save(); ctx.translate(560, 1720 - 20 * E.outBack(seg(tw, k.reported, k.reported + .3))); ctx.rotate(-.05); C.seed(841);
    C.shape(ctx, [[-330, -200], [330, -210], [340, 400], [-340, 400]], P.paper, { lw: 6, shade: c => { C.blot(c, [[120, -220], [360, -220], [360, 420], [160, 420]], P.paperDk, .6); for (let i = 0; i < 5; i++) c.fillStyle = 'rgba(21,18,13,.06)', c.fillRect(-280, -140 + i * 34, 520 - (i % 2) * 140, 8); } });
    C.line(ctx, [[-336, 40], [338, 30]], 2.5, 'rgba(21,18,13,.35)', .5);
    [-1, 1].forEach(d => C.shape(ctx, C.ell(d * 300, -196, 34, 46, 14), P.skin, { lw: 5, shade: c => C.blot(c, C.ell(d * 300 + 10, -186, 24, 32, 10), P.skinDk, .5) }));
    ctx.restore();
    ctx.restore();
    finish(ctx);
  });

  /* --- 29–30: mektup — UNSAFE WORK; imza Ironline, köşede silik kahve halkası --- */
  const LET = { s: 2.5 };
  const FOLD = 100, TOPF = -40;   // üç katlı kâğıt: alt kanat (imza + halka) katlı başlar ve 30. cümlede açılır; üst kanat (antet, To/About) hep arkaya katlı
  function complaint(ctx, f) {
    f = f == null ? 1 : f;
    ctx.save(); ctx.beginPath(); ctx.rect(-400, TOPF, 800, FOLD - TOPF); ctx.clip(); complaintFull(ctx); ctx.restore();
    C.seed(853); C.line(ctx, [[-170, TOPF], [170, TOPF + 1]], 4.4, P.ink, .4);
    if (f > .01) { ctx.save(); ctx.translate(0, FOLD); ctx.scale(1, f); ctx.translate(0, -FOLD); ctx.beginPath(); ctx.rect(-400, FOLD, 800, 400); ctx.clip(); complaintFull(ctx);
      ctx.fillStyle = `rgba(110,100,87,${.35 * (1 - f)})`; ctx.fillRect(-180, FOLD, 360, 140); ctx.restore(); }
    C.seed(852); C.line(ctx, [[-170, FOLD], [170, FOLD - 1]], f > .01 ? 1.6 : 4.4, f > .01 ? 'rgba(21,18,13,.3)' : P.ink, .4); // kat izi / katlı kenar
  }
  function complaintFull(ctx) {
    C.drawLetter(ctx, { kind: 'letter', x: 0, y: 0, s: 1, seed: 81, lines: ['To: Building Safety Office', 'About: the Kaya yard.', '', '', 'A 19-year-old on an', 'old crane. Stop him.'] });
    ctx.save(); ctx.fillStyle = P.ink; ctx.font = '700 30px Rubik'; ctx.textAlign = 'left'; ctx.fillText('UNSAFE WORK.', -142, -230 + 140 + 2.5 * 34); ctx.restore();
    ctx.save(); ctx.fillStyle = P.ink; ctx.font = '500 13px Rubik'; ctx.textAlign = 'left'; ctx.fillText('IRONLINE DEMOLITION', -128, 206); ctx.restore();
    // silik kahve halkası (sağ alt köşe; vurgu yok)
    ctx.save(); ctx.globalAlpha = .26; ctx.strokeStyle = P.coffee; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(118, 168, 44, .7, 5.9); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(118, 168, 37, 1.3, 4.2); ctx.stroke(); ctx.restore();
  }
  function letterShot(ctx, t, z, fx, fy, rot, sy, fold) {
    const bg = blurredWorld('bg-mektup', 3, 560, 1520, 12, {});
    ctx.drawImage(bg, 0, 0); ctx.fillStyle = 'rgba(21,18,13,.15)'; ctx.fillRect(0, 0, 1080, 1920);
    const tw = twos(t), jx = Math.sin(tw * 1.9) * 2.5, jy = Math.sin(tw * 1.2 + 2) * 2.5;
    ctx.save(); ctx.translate(540 + jx, (sy || 720) + jy); ctx.scale(z, z); ctx.rotate(rot); ctx.translate(-fx, -fy);
    complaint(ctx, fold);
    // başparmaklar (kâğıdın iki yanında)
    C.seed(851); [-1, 1].forEach(d => { C.shape(ctx, C.ell(d * 176, 40, 20, 30, 14), P.skin, { lw: 3.2, shade: c => C.blot(c, C.ell(d * 176 + 8, 48, 14, 22, 10), P.skinDk, .5) }); });
    ctx.restore();
    vignette(ctx, .35);
  }
  shot('p2b-satir', k => k.line, k => k.sign, (ctx, t, u) => {
    // yazılar y 330–1100 ve x ≤ 890 içinde (rozet, simge, altyazı bandı boş); imza katlı
    letterShot(ctx, t, lerp(2.96, 3.06, E.io(u)), -12, 0, -.03, 480, 0);
    finish(ctx);
  });
  shot('p2b-imza', k => k.sign, k => k.yard, (ctx, t, u) => {
    const k = times(), e = E.io(seg(t, k.sign, k.sign + .45));
    letterShot(ctx, t, lerp(3.06, 2.9, e) + .03 * E.io(seg(t, k.ironline, k.yard)), -12, 0, -.03, lerp(480, 458, e), E.outBack(seg(twos(t), k.sign + .15, k.sign + .5)));
    finish(ctx);
  });

  /* --- 31 + bitiş: Kaan ve Daisy avluda; ışık üst üçte birde; TEK bip --- */
  shot('p2b-son', k => k.yard, k => k.dur + 1, (ctx, t, u) => {
    const k = times(), tf = frozen(t), tw = twos(tf);
    const e = E.io(seg(tf, k.yard, k.endF0 - .05)), after = seg(t, k.endF1, k.dur);
    const z = lerp(1.04, 1.3, e) + .03 * E.io(after);
    const bx = DAISY.x, by = DAISY.y - 346 * DAISY.s;                     // uyarı ışığı (dünya)
    const sx = lerp(600, 610, e), sy = lerp(820, 560, e) - 10 * E.io(after);
    const kx = 380, ky = 1560, ks = .82;
    const blink = (tw >= k.yard + .7 && tw < k.yard + .7 + 3 / FPS) ? 1 : 0;
    const kaan = { x: kx, y: ky, s: ks, draw: c => { C.drawKaan(c, { x: kx, y: ky, s: ks, seed: 11, expr: 'serious', look: .9, blink, phone: false });
      c.save(); c.translate(kx + 96 * ks, ky - 222 * ks); c.rotate(.18); C.seed(861); C.shape(c, [[-18, -26], [18, -27], [19, 26], [-18, 27]], P.paper, { lw: 2.5 }); c.restore(); } };
    ctx.save(); cam(ctx, z, bx, by, sx, sy);
    world(ctx, tf, { daisy: { x: DAISY.x, y: DAISY.y, s: DAISY.s, beep: beepAt(t, k.endBeep, 1) }, kaan });
    airDust(ctx, tf, 18, 35, [0, 900, 1080, 600], .7);
    ctx.restore();
    // kart için yalnız alt kısım kararır; ışık açıkta
    const dk = .55 * E.io(seg(t, k.endCard - .1, k.endCard + .2)); if (dk > 0) { const g = ctx.createLinearGradient(0, 600, 0, 900); g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(1, `rgba(7,11,24,${dk})`); ctx.fillStyle = g; ctx.fillRect(0, 600, 1080, 1320); }
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const f3 = x => +x.toFixed(3);
  TB.cuesB = {
    get kilitTakirti1() { return f3(times().rattle[0]); },   // kilitli kapı kolu, 1. takırtı
    get kilitTakirti2() { return f3(times().rattle[1]); },   // 2. takırtı
    get daisyMotor() { return f3(times().drive - .4); },     // Daisy rölantiden harekete (motor)
    get daisyDurus() { return f3(times().stop); },           // Daisy durur (fren, motor rölantiye)
    get bip() { return f3(times().beep); },                  // daisy-beep.wav başlangıcı (ışık +0,04 / +0,37)
    get kancaGicirti() { return f3(times().hook + .15); },   // boş kanca sallanır (hafif zincir)
    get telefonCep() { return f3(times().pocketIn); },       // telefon cebe girer (kumaş)
    get adim() { return f3(times().turn); },                 // Kaan posta kutusuna yürür (adımlar buradan lid'e kadar)
    get postaKapagi() { return f3(times().lid + .2); },      // posta kutusu kapağı açılır (metal)
    get kagitZarf() { return f3(times().env); },             // zarf kutudan çekilir (kâğıt)
    get kagitMektup() { return f3(times().line); },          // mektup açık (kâğıt)
    get sonBip() { return f3(times().endBeep); }             // tek bip; ışık +0,04–0,24
  };
})();
