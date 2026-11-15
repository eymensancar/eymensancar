/* Part 10 · BUILD SOMETHING — Animatör A: cümle 1–16. 0 → (S16.t1 + S17.t0)/2 ≈ 28,47 sn.
   AVLU YERLEŞİMİ (dünya = C.drawYard({seed:7, mode:'day'}) varsayılan alanı 0,0,1080,1920; P2/P7 ile AYNI; dışı ext() ile uzar):
   - ufuk y 1075; baraka (dedenin ofisi) x 108–670, taban y 1267; pencere x 187–355, y 852–1048; ofis kapısı x 445–569, y 852–1267
     (menteşe solda, topuz sağda). ADRES LEVHASI kapının sağında duvarda: orta (619,990), 84×60, "7 / Old Mill Lane".
   - Daisy'nin bu bölümdeki PARK YERİ: (900,1600) s .8, siperlik uykulu, bom 0 (bom ucu ≈(806,912), kanca ≈(806,1200)).
   - Kutu yığını (boşaltılan ofis): (250,1430) çevresi; Defne'nin çizim masası (p7-b drawDesk) (240,1700) s .85.
   - Kaan bu bölümde 9. cümleden itibaren DEDENİN ESKİ BARETİNİ takar (kirli beyaz, P4'te kapının yanında çividen alınır;
     tutam baretin tepesinden çıkar: kaanH() yardımcısı).
   - SÖKÜMDEN SONRA (13. cümleden itibaren): baraka Daisy'nin askısıyla bütün olarak kalkar ve avludan çıkar (kadrajdan yukarı).
     Yerinde: beton şerit (drawYard'ın x 102–676, y 1267–1281 temel şeridi) + çıplak toprak izi (arka kenar y≈1200, x 128–650)
     + köşelerde eski temel taşları. İLK TAŞ sol ön köşede (122,1262); altında teneke (kalktı). Çit, posta kutusu yerinde.
   - SON KARE (≈28,47 sn): teneke açık, KATLI not Kaan'ın iki elinde, ekran ortası ≈(540,760), not ekranda ≈560×340, -0,04 rad,
     tek kat (sağ yarı sola katlı); arkasından dedenin eğik el yazısı soluk sızar (aynalı, okunmaz). Not henüz açılmadı.
   Karakterler ikişerli (15 poz/sn), kamera/toz birerli; rastgelelik yalnız tohumlu. Hatıralar sepya/soluk ve sessiz. */
(function () {
  'use strict';
  const C = window.Cizim, P = C.PAL, E = TB.ease, TAU = Math.PI * 2;
  const clamp = TB.clamp, lerp = TB.lerp, seg = TB.seg, rnd = TB.rand;
  const FPS = 30;
  const twos = t => Math.floor(t * 15 + 1e-6) / 15;

  /* ================= ZAMANLAR (hepsi timeline'dan) ================= */
  let _tl = null, K = null;
  function times() {
    const tl = TB.tl; if (K && _tl === tl) return K; _tl = tl;
    const S = i => tl.sentences[i - 1];
    const W = (i, re, n) => { const ws = S(i).words; return ws.find(x => re.test(x.w)) || ws[n == null ? 0 : Math.min(n, ws.length - 1)]; };
    const mid = i => (S(i).t1 + S(i + 1).t0) / 2;
    const k = {};
    k.grew = W(1, /^grew/i, 10).t0;                       // kamera kapıya/levhaya varır
    k.c2 = mid(1);                                         // liste güneşe tutulur: 10. satır
    k.c3 = mid(2);                                         // ofis kapısı açılır
    k.open = S(3).t0 - .05;
    k.c4 = mid(3);                                         // sepya: P4 çatlak (0,5 sn)
    k.c4b = k.c4 + .52;                                    // bugün: gün ışığında çatlak
    k.c5 = mid(4);                                         // avlu: Daisy, kapının önü
    k.mem5 = W(5, /^day/i, 6).t0 - .06; k.mem5b = k.mem5 + .52;   // sepya: 2. gün kapı bipi (sessiz)
    k.c6 = mid(5);                                         // soluk hatıra: dedenin eli yazar
    k.write0 = W(6, /^wrote/i, 1).t0 - .1; k.write1 = S(6).t1 + .1;
    k.c7 = mid(6);                                         // ... mavi kalemle karalar
    k.scr0 = W(7, /^scratched/i, 2).t0 - .12; k.scr1 = S(7).t1;
    k.c8 = mid(7);                                         // boş masa, mavi kalem
    k.c9 = mid(8);                                         // Kaan dedenin baretini takar
    k.helm = W(9, /^wait/i, 4).t0; k.helmOn = k.helm + .4;
    k.c10 = mid(9);                                        // ofisi boşaltırlar
    k.drop = S(10).t1 + .05;
    k.c11 = mid(10);                                       // Defne planı imzalar
    k.signW = W(11, /^signed/i, 1).t0;
    k.c12 = mid(11);                                       // Hale kutu taşır (şapka kutunun üstünde)
    k.c13 = mid(12);                                       // Daisy yakın: siperlik kalkar
    k.lid = W(13, /^daisy/i, 1).t0;
    k.c13b = W(13, /^last/i, 4).t0 - .12;                  // baraka bütün olarak kalkar
    k.c14 = mid(13);                                       // çıplak temel; Kaan ilk taşa
    k.c14b = W(14, /^first/i, 2).t0;                       // üstten: taş kalkar, teneke
    k.stone = W(14, /^stone/i, 3).t0;
    k.tin = W(14, /^tin/i, 7).t0;
    k.c15 = mid(14);                                       // kapak açılır, katlı not
    k.lidOff = W(15, /^inside/i, 0).t0;
    k.c16 = mid(15);                                       // not ele alınır, dedenin yazısı sızar
    k.pick = S(16).t0 - .15;
    k.end = (S(16).t1 + S(17).t0) / 2;
    K = k; return k;
  }

  /* ================= YARDIMCILAR ================= */
  function cam(ctx, z, cx, cy, sx, sy) { ctx.translate(sx == null ? 540 : sx, sy == null ? 960 : sy); ctx.scale(z, z); ctx.translate(-cx, -cy); }
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
  function blurred(key, blur, fn) { return cached(key, 1080, 1920, c => { const tmp = canvas(1080, 1920); fn(tmp.getContext('2d')); c.filter = `blur(${blur}px)`; c.drawImage(tmp, -20, -20, 1120, 1960); c.filter = 'none'; }); }
  const SEPIA = 'sepia(1) saturate(.55) brightness(.92) contrast(.92)';        // pilot/P4 hatıra karesi
  function memory(ctx, draw) {
    const m = layer('mem'); draw(m);
    ctx.fillStyle = '#2a2118'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.filter = SEPIA; ctx.drawImage(layers.mem, 0, 0); ctx.filter = 'none';
  }
  function limb(ctx, A, B, wa, wb, fill, sd) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; C.seed(sd);
    return C.shape(ctx, [[A[0] + nx * wa, A[1] + ny * wa], [B[0] + nx * wb, B[1] + ny * wb], [B[0] - nx * wb, B[1] - ny * wb], [A[0] - nx * wa, A[1] - ny * wa]], fill, { lw: 7, shade: c => C.blot(c, [[A[0] - nx * wa * .1, A[1] - ny * wa * .1], [B[0] - nx * wb * .1, B[1] - ny * wb * .1], [B[0] - nx * wb * 1.2, B[1] - ny * wb * 1.2], [A[0] - nx * wa * 1.2, A[1] - ny * wa * 1.2]], '#0b1f2a', .3) });
  }
  function airDust(ctx, t, n, sb, box, a, col) {
    for (let i = 0; i < n; i++) {
      const r = j => rnd(sb * 777 + i * 11 + j), x = box[0] + ((r(1) * box[2] + t * (8 + r(2) * 26)) % box[2]), y = box[1] + r(3) * box[3] + Math.sin(t * .7 + r(4) * 6) * 12;
      ctx.fillStyle = `rgba(${col || '241,232,212'},${a * (.25 + r(5) * .45)})`; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 3.5, 0, TAU); ctx.fill();
    }
  }
  function walk(t, t0, per) { const ph = Math.max(0, twos(t) - t0) / (per || .5); return { bob: -Math.abs(Math.sin(ph * Math.PI)) * 9, rot: Math.sin(ph * Math.PI) * .022 * (Math.floor(ph) % 2 ? 1 : -1), ph, step: Math.sin(ph * Math.PI) * (Math.floor(ph) % 2 ? 1 : -1) }; }
  const blinkAt = (tw, list) => list.some(b => tw >= b && tw < b + 3 / FPS) ? 1 : 0;
  function shake(t, t0, amp) { const d = t - t0; if (d < 0 || d > .2) return [0, 0]; const f = Math.floor(d * FPS); return [[1, -1, .6, -.4, .2, 0][f] * amp || 0, [-.6, .8, -.4, .2, 0, 0][f] * amp || 0]; }

  /* ================= DÜNYA: AVLU ================= */
  const HZ = 1920 * .56;
  const YD = (() => { const hz = HZ, bx = 108, bw = 561.6, by = hz + 192, bh = 576;
    return { hz, bx, bw, by, bh, wx: bx + bw * .14, wy: by - bh * .72, ww: bw * .3, wh: bh * .34, dx: bx + bw * .6, dw: bw * .22, dh: bh * .72, fy: hz + 1920 * .14 }; })();
  const DAISY = { x: 900, y: 1600, s: .8 };
  const PLATE = [619, 990];                               // adres levhası (dünya)
  const PILE = [250, 1430];
  const STONE = [122, 1262];                              // ilk taş (sol ön köşe)
  const TUFT = [[-12, -526], [-6, -552], [8, -572], [30, -580], [46, -570], [44, -556], [36, -548], [38, -562], [26, -562], [14, -550], [12, -530]];

  // 0–1080 dışı ve y>1920: aynı gök/zemin, uzak bloklar, çit devamı (p2-a ile aynı)
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
  // pencere içi (P2 ile aynı: loş oda + alçak asılı takvim)
  function officeWindow(ctx) {
    const { wx, wy, ww, wh } = YD;
    ctx.save(); ctx.beginPath(); ctx.rect(wx + 2, wy + 2, ww - 4, wh - 4); ctx.clip();
    ctx.fillStyle = '#3b4744'; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#2e3836'; ctx.fillRect(wx, wy + wh * .82, ww, wh);
    ctx.save(); ctx.translate(wx + ww * .12, wy + wh * .14); ctx.rotate(-.04); C.seed(611);
    C.shape(ctx, [[0, 0], [ww * .26, 0], [ww * .26, wh * .2], [0, wh * .2]], '#c9bfa6', { lw: 2 }); ctx.restore();
    const cx = wx + ww * .74, cw = ww * .26, ct = wy + wh * .56, chh = wh * .4;
    C.seed(612); C.line(ctx, [[cx, wy + wh * .12], [cx, ct]], 1.4, 'rgba(21,18,13,.8)', .1);
    C.shape(ctx, C.ell(cx, wy + wh * .12, 3, 3, 8), P.steel, { lw: 1.2 });
    ctx.save(); ctx.translate(cx, ct); ctx.rotate(.03);
    C.shape(ctx, [[-cw / 2, 0], [cw / 2, 0], [cw / 2, chh], [-cw / 2, chh]], '#d9cfb8', { lw: 2, shade: c => { c.fillStyle = '#8f4a2c'; c.fillRect(-cw / 2 - 2, -2, cw + 4, chh * .3); } });
    ctx.strokeStyle = 'rgba(21,18,13,.3)'; ctx.lineWidth = 1; for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) ctx.strokeRect(-cw * .42 + q * cw * .168, chh * .4 + r * chh * .14, cw * .168, chh * .14);
    ctx.restore();
    ctx.fillStyle = 'rgba(43,69,82,.32)'; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(wx + ww * .18, wy); ctx.lineTo(wx + ww * .34, wy); ctx.lineTo(wx + ww * .14, wy + wh); ctx.lineTo(wx - ww * .02, wy + wh); ctx.fill();
    ctx.restore();
    C.seed(613); C.line(ctx, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], 2.5); C.line(ctx, [[wx, wy + wh / 2], [wx + ww, wy + wh / 2]], 2.5);
    C.shape(ctx, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], null, { lw: 3.6 });
  }
  function doorDetail(ctx) {
    const { dx, dw, dh, by } = YD;
    ctx.save(); ctx.font = '700 15px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink;
    ctx.fillText('OFFICE', dx + dw * .5, by - dh * .73); ctx.restore();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(dx + dw * .8, by - dh * .48 + 16, 2.6, 0, TAU); ctx.fill(); ctx.fillRect(dx + dw * .8 - 1.2, by - dh * .48 + 16, 2.4, 6);
  }
  // adres levhası: krem emaye, mürekkep çerçeve, iki vida (9. bölümde okunan adres)
  function addrPlate(ctx) {
    const [x, y] = PLATE, w = 84, h = 60;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.025); C.seed(621);
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h); ctx.restore();
    C.shape(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], '#efe6cf', { lw: 3, shade: c => { C.blot(c, [[w * .1, -h], [w, -h], [w, h], [w * .2, h]], '#d9ccad', .6); C.blot(c, C.ell(-w * .32, h * .3, 8, 5, 8), P.rust, .45); } });
    ctx.strokeStyle = 'rgba(21,18,13,.7)'; ctx.lineWidth = 1.4; ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 30px Rubik'; ctx.fillText('7', 0, -7);
    ctx.font = '700 10.5px Rubik'; ctx.fillText('OLD MILL LANE', 0, 18);
    [-1, 1].forEach(d => { ctx.fillStyle = P.steel; ctx.beginPath(); ctx.arc(d * (w / 2 - 9), -h / 2 + 9, 2.4, 0, TAU); ctx.fill(); });
    ctx.restore();
  }
  // drawYard'ı barakasız çizer: baraka duvarı ('#9aa59c') ilk dolgusundan temel şeridi (P.concrete) dolgusuna kadar çizim komutları atlanır.
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
  const PW = 2400, PH = 2400, PX0 = -600;
  function plate(kind) {
    return cached('yard-' + kind, PW, PH, g => {
      g.translate(-PX0, 0); ext(g);
      const o = { seed: 7, mode: 'day', letter: false, doorOpen: kind === 'open' };
      if (kind === 'empty') { C.drawYard(skipShed(g), o); footprint(g); }
      else { C.drawYard(g, o); officeWindow(g); if (kind === 'closed') doorDetail(g); addrPlate(g); }
    });
  }
  // baraka (dünya koordinatlı sprite, köken (80,640)): kapalı kapılı plakadan kırpılır
  const SHED_O = [80, 640];
  function shedSprite() {
    return cached('shed', 640, 660, g => {
      g.translate(-SHED_O[0], -SHED_O[1]);
      g.beginPath(); [[84, 674], [696, 652], [696, 690], [674, 690], [674, 1268], [103, 1268], [103, 700], [84, 700]].forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
      g.drawImage(plate('closed'), PX0, 0);
    });
  }
  function grass(ctx, t, box) {
    const b = box || [-100, 1290, 1300, 900];
    for (let i = 0; i < 26; i++) {
      const r = j => rnd(2700 + i * 9 + j), x = b[0] + r(1) * b[2], y = b[1] + r(2) * b[3], ph = r(3) * 6;
      if (x > YD.bx - 10 && x < YD.bx + YD.bw + 10 && y < YD.by + 20) continue;
      for (let q = 0; q < 5; q++) {
        const sw = Math.sin(t * 2.4 + ph + q * .5) * 6 + Math.sin(t * 4.7 + ph) * 2, hh = 18 + r(4 + q) * 18;
        ctx.strokeStyle = P.weed; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + q * 4, y);
        ctx.quadraticCurveTo(x + q * 4 + (q - 2) * 3, y - hh * .6, x + q * 4 + (q - 2) * 4 + sw, y - hh); ctx.stroke();
      }
    }
  }
  const hookSw = t => .03 * Math.sin(t * 1.2) + .01 * Math.sin(t * 2.9 + 1);
  function daisy(ctx, d) { C.drawDaisy(ctx, { x: d.x, y: d.y, s: d.s, seed: 23, beep: 0, mood: d.mood || 'sleepy', hook: d.hook || 0, boom: d.boom || 0 }); }

  /* ---------- karakter parçaları ---------- */
  // dedenin eski bareti (P4'teki çividen alınan, kirli beyaz); yerel ölçek 1 ≈ Kaan başı
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
  function cardBox(ctx, x, y, w, h, lw, sd, o) {
    o = o || {}; C.seed(sd);
    C.shape(ctx, [[x - w / 2, y - h], [x + w / 2, y - h - 2], [x + w / 2 + 2, y], [x - w / 2, y + 1]], P.box, { lw, shade: c => { C.blot(c, [[x + w * .2, y - h - 10], [x + w, y - h - 10], [x + w, y + 10], [x + w * .26, y + 10]], P.boxDk, .55); c.fillStyle = 'rgba(240,226,194,.5)'; c.fillRect(x - w * .07, y - h - 4, w * .14, h + 8); } });
    if (o.label) C.line(ctx, [[x - w * .34, y - h * .55], [x - w * .08, y - h * .57]], lw * .5, P.ink, .4);
  }
  function kaanBox(ctx, pose, lw) {
    if (pose === 'side') { cardBox(ctx, 52, -228, 150, 108, lw, 661, { label: true }); C.shape(ctx, C.ell(100, -262, 14, 15, 14), P.skin, { lw }); }
    else { cardBox(ctx, 4, -222, 196, 120, lw, 662, { label: true }); C.shape(ctx, C.ell(-92, -262, 14, 15, 14), P.skinDk, { lw }); C.shape(ctx, C.ell(96, -262, 14, 15, 14), P.skin, { lw }); }
  }
  // Defne: elinde kutu (ön görünüş)
  function defneBox(ctx, d) {
    C.drawDefne(ctx, { x: d.x, y: d.y + (d.bob || 0), s: d.s, seed: 31, expr: d.expr || 'determined', look: d.look || 0, blink: d.blink || 0, item: null });
    const sc = .9 * d.s; ctx.save(); ctx.translate(d.x, d.y + (d.bob || 0)); ctx.scale(sc, sc); cardBox(ctx, 0, -200, 170, 104, 5.2 / Math.sqrt(sc), 671, {}); ctx.restore();
  }
  // Hale: kutu taşır, şapkasız; şapkası kutunun üstünde (gag)
  function haleCarry(ctx, h) {
    ctx.save(); ctx.translate(h.x, h.y + (h.bob || 0)); ctx.rotate(h.rot || 0); ctx.translate(-h.x, -h.y);
    C.drawHale(ctx, { x: h.x, y: h.y, s: h.s, seed: 41, pose: 'carry', hat: false, expr: h.expr || 'confident', look: h.look || 0, blink: h.blink || 0, flip: h.flip });
    const sc = 1.04 * h.s, lw = 5.2 / Math.sqrt(sc);
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(h.flip ? -sc : sc, sc); ctx.translate(18, 166 - (h.hatBob || 0)); ctx.rotate(-.08);
    C.seed(681);
    C.shape(ctx, C.ell(2, -514, 76, 13, 26), P.hat, { lw, shade: c => C.blot(c, C.ell(30, -508, 50, 8, 12), P.suitDk, .6) });
    C.shape(ctx, [[-44, -516], [-40, -566], [-14, -578], [0, -570], [16, -578], [42, -566], [46, -516]], P.hat, { lw, shade: c => C.blot(c, [[20, -590], [60, -590], [60, -510], [26, -510]], P.suitDk, .55) });
    C.shape(ctx, [[-45, -534], [46, -534], [46, -518], [-45, -518]], P.hatBand, { lw: lw * .8 });
    ctx.restore();
    ctx.restore();
  }
  // Kaan'ın elindeki katlı liste (pilot heldList ile aynı dil; Kaan yerel el (86,-240))
  const PAPER = '#eadfc2', PAPER_BK = '#d9caa5', INK_OLD = '#3a3026', BLUE = '#1f4fe0';
  function heldList(ctx, kx, ky, s, flut) {
    ctx.save(); ctx.translate(kx, ky); ctx.scale(s, s);
    ctx.translate(108, -262); ctx.rotate(-.12 + flut * .03);
    const w = 112, h = 146, lw = 4.2;
    C.seed(2201);
    C.shape(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], PAPER_BK, {
      lw, shade: c => {
        c.save(); c.globalAlpha = .22; for (let k = 0; k < 6; k++) { c.strokeStyle = INK_OLD; c.lineWidth = 2; c.beginPath(); const yy = -h / 2 + 22 + k * 20; c.moveTo(-w / 2 + 14, yy); for (let x = -w / 2 + 14; x < w / 2 - 12 - (k % 3) * 14; x += 6) c.lineTo(x, yy + Math.sin(x * .7 + k) * 3); c.stroke(); } c.restore();
        C.blot(c, [[w * .1, -h], [w, -h], [w, h], [w * .25, h]], '#b8a479', .45);
      }
    });
    C.seed(2202); C.line(ctx, [[-w / 2 + 4, 0], [w / 2 - 4, 2]], 2, '#8a6a40', .5);
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, h / 2 - 9, w, 12); ctx.clip();
    ctx.strokeStyle = BLUE; ctx.globalAlpha = .75; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let k = 0; k <= 12; k++) { const x = -w / 2 + 10 + k * (w - 26) / 12, y = h / 2 - 2 + (k % 2 ? -7 : 2); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    const lift = 10 + flut * 8;
    C.seed(2203); C.shape(ctx, [[w / 2, -h / 2], [w / 2 - 30, -h / 2], [w / 2 - lift * .6, -h / 2 + lift * .5], [w / 2, -h / 2 + 30]], PAPER, { lw: lw * .8, amp: .3 });
    ctx.restore();
    ctx.save(); ctx.translate(kx, ky); ctx.scale(s, s); C.seed(2204);
    C.shape(ctx, C.ell(86, -240, 15, 15, 18), P.skin, { lw: 5.2 / Math.sqrt(s) });
    C.line(ctx, [[78, -246], [92, -244]], 5.2 / Math.sqrt(s) * .45);
    ctx.restore();
  }
  // yandan gelen el (Kaan: yeşil ceket + sarı bileklik): parmak uçları (x,y), kol rot yönünde dışarı
  function sideHand(ctx, x, y, rot, s, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, o.flipY ? -s : s); C.seed(o.sd || 451);
    limb(ctx, [150, 10], [900, 40], 70, 96, P.jacket, (o.sd || 451) + 1);
    C.shape(ctx, [[130, -66], [178, -70], [184, 74], [136, 78]], P.hazard, { lw: 5 });
    C.shape(ctx, [[-20, -44], [40, -64], [128, -58], [140, 0], [128, 60], [40, 62], [-14, 40], [-30, 0]], P.skin, { lw: 6, shade: c => C.blot(c, [[40, 20], [150, 20], [150, 80], [40, 80]], P.skinDk, .5) });
    C.line(ctx, [[-4, -18], [40, -14]], 3, P.skinDk, .3); C.line(ctx, [[-6, 14], [38, 16]], 3, P.skinDk, .3);
    C.shape(ctx, [[40, -64], [10, -96], [-26, -92], [-20, -66], [20, -50]], P.skin, { lw: 5 });          // başparmak
    ctx.restore();
  }

  /* ================= OFİS (P4 dünyası, gün ışığında) ================= */
  const OFF = { x: 0, y: 0, w: 1080, h: 900, seed: 21 };
  const OF = (() => { const a = OFF, kx = a.x + a.w * .74; return { kx, fl: a.y + a.h * .7, top: a.y, cx0: kx - a.w * .1, cy: a.y + a.h * .3, cw: a.w * .2, ch: a.h * .3, tx: a.x + a.w * .04, tw: a.w * .62, ty: a.y + a.h * .62 }; })();
  const DOOR = { x0: -250, x1: -40, y0: 90, y1: 630 };
  const NAIL = [25, 250], CUP = [300, 558], SOCKET = [700, 600];
  const SKETCH = [[150, 160, 190, 140, -.05, 0, '1981'], [390, 120, 170, 130, .04, 1, '1987'], [250, 360, 180, 130, .03, 2, '1994'], [480, 330, 160, 120, -.04, 3, '2003']];
  const CM = .7;
  function sketch(ctx, cx, cy, w, h, rot, kind, year, sd) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); C.seed(sd);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.fillRect(-w / 2 + 5, -h / 2 + 6, w, h); ctx.restore();
    C.shape(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2 + 2], [w / 2 - 2, h / 2], [-w / 2 + 1, h / 2 - 1]], kind % 2 ? P.page : '#efe4c8', { lw: 2.6, shade: c => C.blot(c, [[w * .1, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [w * .2, h / 2]], P.pageDk, .5) });
    const pc = P.inkOld, gy = h * .32;
    C.line(ctx, [[-w * .42, gy], [w * .42, gy]], 1.6, pc, .6);
    if (kind === 0) {
      C.line(ctx, [[-w * .25, gy], [-w * .25, -h * .36], [-w * .14, -h * .36], [-w * .14, gy]], 1.8, pc, .5);
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = pc; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-w * .2, gy, h * .62, -Math.PI / 2 + .15, -.25); ctx.stroke(); ctx.restore();
      C.line(ctx, [[-w * .12, gy - 4], [w * .38, gy - 4], [w * .38, gy - 13], [-w * .12, gy - 13]], 1.6, pc, .4);
    } else if (kind === 1) {
      C.line(ctx, [[-w * .3, gy], [-w * .3, -h * .3], [w * .1, -h * .3], [w * .1, gy]], 1.8, pc, .5);
      for (let i = 1; i < 4; i++) C.line(ctx, [[-w * .3, gy - i * h * .15], [w * .1, gy - i * h * .15]], 1, pc, .4);
      C.line(ctx, [[-w * .3, gy], [w * .1, -h * .3]], 1.2, pc, .4); C.line(ctx, [[w * .1, gy], [-w * .3, -h * .3]], 1.2, pc, .4);
      C.line(ctx, [[w * .16, -h * .2], [w * .34, -h * .02], [w * .34, gy - 6]], 1.4, pc, .4);
    } else if (kind === 2) {
      C.line(ctx, [[-w * .05, gy], [-w * .05, -h * .4], [w * .1, -h * .4], [w * .1, gy]], 1.8, pc, .5);
      ctx.save(); ctx.strokeStyle = pc; ctx.lineWidth = 1; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-w * .42 + i * 9, gy + 2); ctx.lineTo(-w * .42 + i * 9 + 10, gy - 8); ctx.stroke(); } ctx.restore();
      C.line(ctx, [[-w * .1, -h * .3], [-w * .32, -h * .08], [-w * .34, gy - 12]], 1.2, pc, .4);
    } else {
      C.line(ctx, [[-w * .2, -h * .38], [w * .16, -h * .38], [w * .12, -h * .14], [-w * .16, -h * .14], [-w * .2, -h * .38]], 1.8, pc, .5);
      C.line(ctx, [[-w * .14, -h * .14], [-w * .22, gy]], 1.4, pc, .4); C.line(ctx, [[w * .1, -h * .14], [w * .18, gy]], 1.4, pc, .4);
      C.line(ctx, [[-w * .18, h * .05], [w * .14, h * .05]], 1, pc, .3);
    }
    C.handwrite(ctx, year, w * .1, h * .46, 15, pc, sd + 3);
    C.shape(ctx, C.ell(0, -h / 2 + 7, 5, 5, 8), P.beaconOff, { lw: 1.6 });
    ctx.restore();
  }
  function nailHelmet(ctx, x, y) {
    C.seed(311); C.shape(ctx, C.ell(x, y - 2, 3, 3, 6), P.steel, { lw: 1.6 });
    C.line(ctx, [[x - 22, y + 46], [x, y + 2], [x + 22, y + 46]], 1.8, '#3a2c24', .3);
    ctx.save(); ctx.translate(x, y + 70); ctx.rotate(-.06); helmetShape(ctx, 2.6); ctx.restore();
  }
  function penCup(ctx, x, y, k, noBlue) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); C.seed(321);
    [[-8, -.24, '#8b6a3e'], [8, .22, P.brickDk], [0, .05, P.inkBlue], [-2, -.08, '#8b6a3e']].forEach(([dx, r, col], i) => {
      if (noBlue && col === P.inkBlue) return;
      ctx.save(); ctx.translate(dx, -30); ctx.rotate(r); C.shape(ctx, [[-2.6, -40 - i * 4], [2.6, -40 - i * 4], [2.6, 0], [-2.6, 0]], col, { lw: 1.2 }); ctx.restore();
    });
    C.shape(ctx, [[-16, -34], [16, -34], [14, 0], [-14, 0]], P.steelLt, { lw: 2, shade: c => C.blot(c, [[4, -40], [20, -40], [20, 4], [6, 4]], P.steel, .6) });
    ctx.restore();
  }
  // drawOffice çatlağı hep çizer; takvim kenarda (cm>0) olduğundan burada kırpmaya gerek yok.
  function officeWorld(ctx, o) {
    o = o || {}; C.seed(341);
    ctx.fillStyle = P.wallOffice; ctx.fillRect(-800, -700, 2600, 1330);
    for (let i = 0; i < 9; i++) { const x = [-700, -520, -330, -160, 1100, 1250, 1420, 1600, -60][i], y = 80 + rnd(i + 9) * 420; C.blot(ctx, C.ell(x, y, 80 + rnd(i) * 90, 40 + rnd(i + 3) * 50, 12), P.wallOfficeDk, .25); }
    ctx.fillStyle = '#2a302e'; ctx.fillRect(-800, -700, 2600, 640); C.line(ctx, [[-800, -60], [1800, -60]], 3);
    ctx.fillStyle = P.floorWood; ctx.fillRect(-800, 630, 2600, 1100);
    ctx.strokeStyle = 'rgba(21,18,13,.3)'; ctx.lineWidth = 2; for (let yy = 660; yy < 1720; yy += 36 + (yy - 630) * .08) { ctx.beginPath(); ctx.moveTo(-800, yy); ctx.lineTo(1800, yy + 4); ctx.stroke(); }
    C.drawOffice(ctx, Object.assign({}, OFF, { lamp: !!o.lamp, calendarMoved: o.cm == null ? CM : o.cm }));
    C.seed(351); C.line(ctx, [[OF.kx - 6, OF.top + 2], [OF.kx - 1, -30], [OF.kx - 4, -60]], 5, P.ink, 1.5);
    C.line(ctx, [[-800, 630], [0, 630]], 3.8); C.line(ctx, [[1080, 630], [1800, 630]], 3.8);
    const D = DOOR, dw = D.x1 - D.x0;
    C.shape(ctx, [[D.x0 - 14, D.y1], [D.x0 - 14, D.y0 - 14], [D.x1 + 14, D.y0 - 14], [D.x1 + 14, D.y1]], '#4a3420', { lw: 3 });
    const op = o.door || 0;
    if (op > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(D.x0, D.y0, dw, D.y1 - D.y0); ctx.clip();
      const night = !!o.night, g = ctx.createLinearGradient(0, D.y0, 0, D.y1);
      if (night) { g.addColorStop(0, '#16224a'); g.addColorStop(.62, '#2a3a66'); g.addColorStop(.63, '#3a3f4e'); g.addColorStop(1, '#4a4a52'); }
      else { g.addColorStop(0, '#c9dbe0'); g.addColorStop(.6, '#f0e2c2'); g.addColorStop(.61, P.groundLt); g.addColorStop(1, P.ground); }
      ctx.fillStyle = g; ctx.fillRect(D.x0, D.y0, dw, D.y1 - D.y0);
      C.line(ctx, [[D.x0, D.y0 + 345], [D.x1, D.y0 + 341]], 2, night ? '#1d2742' : P.dustDk, .5);
      ctx.restore();
    }
    const th = op * 1.35, fx = D.x1 - dw * Math.cos(th), sp = Math.sin(th);
    const panel = [[fx, D.y0 - 34 * sp], [D.x1, D.y0], [D.x1, D.y1], [fx, D.y1 + 26 * sp]];
    C.shape(ctx, panel, op > 0 ? '#5a4029' : '#6f5134', { lw: 3.2, shade: c => C.blot(c, [[D.x1 - dw * .3, D.y0 - 40], [D.x1 + 10, D.y0 - 40], [D.x1 + 10, D.y1 + 30], [D.x1 - dw * .25, D.y1 + 30]], '#3f2711', .45) });
    const kx = lerp(fx, D.x1, .14); C.shape(ctx, C.ell(kx, (D.y0 + D.y1) / 2 + 20, 6 * (1 - sp * .5) + 1, 6, 10), P.gold, { lw: 2 });
    if (o.helmet !== false) nailHelmet(ctx, NAIL[0], NAIL[1]); else { C.seed(311); C.shape(ctx, C.ell(NAIL[0], NAIL[1] - 2, 3, 3, 6), P.steel, { lw: 1.6 }); }
    SKETCH.forEach(([x, y, w, h, r, kd, yr], i) => sketch(ctx, x, y, w, h, r, kd, yr, 400 + i * 10));
    C.shape(ctx, [[SOCKET[0] - 14, SOCKET[1] - 18], [SOCKET[0] + 14, SOCKET[1] - 18], [SOCKET[0] + 14, SOCKET[1] + 14], [SOCKET[0] - 14, SOCKET[1] + 14]], '#d9d2c2', { lw: 1.8 });
    penCup(ctx, CUP[0], CUP[1], 1, o.penOut);
    if (!o.night) { // gün ışığı: kapıdan sızan sıcak ışık
      ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const g2 = ctx.createRadialGradient(-150, 520, 40, 200, 600, 1100); g2.addColorStop(0, `rgba(255,232,180,${.55 * op})`); g2.addColorStop(1, 'rgba(255,232,180,0)'); ctx.fillStyle = g2; ctx.fillRect(-800, -700, 2600, 2400); ctx.restore();
    }
  }
  // ofis için ekran-uzayı ışık: gündüz hafif sıcak, kenarlar koyu
  function dayRoom(ctx, a) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const g = ctx.createRadialGradient(560, 760, 80, 560, 900, 1200);
    g.addColorStop(0, `rgba(255,226,170,${a})`); g.addColorStop(1, 'rgba(30,20,10,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
  }

  /* ================= LİSTE (drawListLamp düzeni; 9. bölüm) ================= */
  // Hatırada yazılırken: n = adresin yazılmış harf sayısı, scr = mavi karalamanın ilerleyişi (0..1). Kâğıt yerel W 520, H 700.
  const LW = 520, LH = 700, ADDR = '7 Old Mill Lane';
  const line10Y = -LH / 2 + 80 + 9 * 60;
  function scratchPts() { const pts = []; for (let q = 0; q < 26; q++) pts.push([-LW / 2 + 76 + q * 14, line10Y - 12 + (q % 2 ? -12 : 10) + (rnd(q) - .5) * 6]); return pts; }
  function addrX(n) { const c = layer('meas'); c.font = '500 30px Rubik'; let w = 0; for (let i = 0; i < n; i++) w += c.measureText(ADDR[i]).width * .92; return -LW / 2 + 80 + w; }
  function listMemory(ctx, n, scr) {
    C.seed(99);
    ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = P.ink; ctx.fillRect(-LW / 2 + 12, -LH / 2 + 14, LW, LH); ctx.restore();
    C.shape(ctx, [[-LW / 2, -LH / 2], [LW / 2, -LH / 2 + 6], [LW / 2 - 4, LH / 2], [-LW / 2 + 4, LH / 2 - 4]], '#f3e4bd', { lw: 4.4, shade: c => C.blot(c, [[LW * .2, -LH], [LW, -LH], [LW, LH], [LW * .3, LH]], '#e2cd9c', .5) });
    for (let i = 0; i < 10; i++) {
      const yy = -LH / 2 + 80 + i * 60;
      C.handwrite(ctx, (i + 1) + '.', -LW / 2 + 30, yy, 30, P.inkOld, 60 + i);
      if (i < 9) for (let q = 0; q < 3; q++) { ctx.fillStyle = 'rgba(58,48,38,.75)'; ctx.fillRect(-LW / 2 + 80 + q * 120, yy - 14, 90 + rnd(i * 3 + q) * 20, 5); }
    }
    if (n > 0) C.handwrite(ctx, ADDR.slice(0, n), -LW / 2 + 80, line10Y, 30, P.inkOld, 77);
    if (scr > 0) blueScratch(ctx, scr, 1);
  }
  function blueScratch(ctx, u, a) {
    const pts = scratchPts(), L = (pts.length - 1) * u, i0 = Math.floor(L), f = L - i0, sub = pts.slice(0, i0 + 1);
    if (i0 < pts.length - 1) sub.push([lerp(pts[i0][0], pts[i0 + 1][0], f), lerp(pts[i0][1], pts[i0 + 1][1], f)]);
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = P.inkBlue; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(C.pathOf(sub, false)); ctx.restore();
    return sub[sub.length - 1];
  }
  // dedenin eli + kalem (yüz yok): kalem ucu (x,y); kalem rengi col; soluk hırka kolu
  function oldHandPen(ctx, x, y, rot, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); C.seed(3620);
    C.line(ctx, [[0, 0], [70, -96]], 20, P.ink, .2); C.line(ctx, [[0, 0], [70, -96]], 11, col, .2); C.line(ctx, [[2, -3], [14, -20]], 6, '#111', .1);
    C.shape(ctx, [[60, -150], [140, -170], [200, -90], [150, -20], [70, -40], [40, -100]], '#cfa07e', { lw: 6, shade: c => { C.blot(c, [[120, -170], [210, -170], [210, -20], [140, -20]], '#a97d5c', .5); C.blot(c, C.ell(150, -118, 9, 6, 8), '#b07a54', .5); C.blot(c, C.ell(112, -70, 7, 5, 8), '#b07a54', .45); } });
    C.line(ctx, [[86, -120], [130, -100]], 3, '#a97d5c', .3); C.line(ctx, [[96, -86], [128, -76]], 2.4, '#a97d5c', .3); C.line(ctx, [[160, -60], [176, -84]], 2.2, '#a97d5c', .3);
    C.shape(ctx, [[150, -180], [220, -120], [196, -80], [126, -140]], '#7b6450', { lw: 5 });          // hırka manşeti
    C.shape(ctx, [[180, -170], [700, -10], [640, 200], [150, -60]], '#5f4a3c', { lw: 6, shade: c => C.blot(c, [[200, -100], [680, 60], [640, 200], [180, -40]], '#47362b', .55) });
    ctx.restore();
  }

  /* ================= TENEKE (üstten) ================= */
  // teneke kutu üstten (drawTin paleti): orta (x,y), s; lid: 0 kapalı .. 1 kaldırılmış (kapak kendi çizilir)
  function tinTop(ctx, x, y, s, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); C.seed(951);
    const W = 360, H = 230;
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#2a2118'; ctx.beginPath(); ctx.ellipse(10, 14, W * .62, H * .66, 0, 0, TAU); ctx.fill(); ctx.restore();
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2 + 3], [W / 2 + 2, H / 2], [-W / 2 + 2, H / 2 + 2]], '#8f9aa3', { lw: 5, shade: c => { C.blot(c, [[W * .25, -H], [W, -H], [W, H], [W * .3, H]], '#5d6873', .5); for (let i = 0; i < 7; i++) C.blot(c, C.ell(-W / 2 + rnd(960 + i) * W, -H / 2 + rnd(970 + i) * H, 8 + rnd(980 + i) * 16, 5 + rnd(990 + i) * 9, 8), P.rust, .5); } });
    // iç
    C.shape(ctx, [[-W / 2 + 16, -H / 2 + 16], [W / 2 - 16, -H / 2 + 18], [W / 2 - 14, H / 2 - 14], [-W / 2 + 16, H / 2 - 14]], '#4c565f', { lw: 3, shade: c => { C.blot(c, [[-W, -H / 2], [W, -H / 2], [W, -H / 2 + 46], [-W, -H / 2 + 40]], '#323a42', .7); } });
    if (o.note !== false) foldedNote(ctx, 6, 8, .62, .04, 1);
    ctx.restore();
  }
  function tinLid(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); C.seed(955);
    const W = 376, H = 246;
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2 + 2], [W / 2, H / 2], [-W / 2, H / 2 + 2]], '#a7b1b9', { lw: 5, shade: c => { C.blot(c, [[W * .2, -H], [W, -H], [W, H], [W * .28, H]], '#7d8890', .5); for (let i = 0; i < 9; i++) C.blot(c, C.ell(-W / 2 + rnd(1960 + i) * W, -H / 2 + rnd(1970 + i) * H, 6 + rnd(1980 + i) * 18, 4 + rnd(1990 + i) * 10, 8), P.rust, .45); } });
    ctx.strokeStyle = 'rgba(21,18,13,.35)'; ctx.lineWidth = 2.4; ctx.strokeRect(-W / 2 + 18, -H / 2 + 18, W - 36, H - 36);
    ctx.restore();
  }
  // katlı not: tek kat (sağ yarı sola katlı); arkasından soluk, aynalı el yazısı sızar. W 520 × H 330 (yerel, s=1)
  function foldedNote(ctx, x, y, s, rot, bleed) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); C.seed(961);
    const W = 520, H = 330;
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(-W / 2 + 10, -H / 2 + 12, W, H); ctx.restore();
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2 + 4], [W / 2 - 2, H / 2], [-W / 2 + 2, H / 2 - 2]], '#efe2c0', { lw: 4.4, shade: c => {
      C.blot(c, [[0, -H], [W, -H], [W, H], [0, H]], '#e2d1a8', .55);
      for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(160,118,62,${.06 + rnd(970 + i) * .1})`; c.beginPath(); c.arc(-W / 2 + rnd(975 + i) * W, -H / 2 + rnd(980 + i) * H, 4 + rnd(985 + i) * 12, 0, TAU); c.fill(); }
      if (bleed > 0) { // aynalı, soluk sızıntı: dedenin eğik yazısı (okunmaz)
        c.save(); c.globalAlpha = .11 * bleed; c.filter = 'blur(2.5px)'; c.scale(-1, 1);
        C.handwrite(c, 'Ant.', -W / 2 + 60, -50, 56, '#3a3026', 31);
        C.handwrite(c, 'Now build something.', -W / 2 + 60, 40, 44, '#3a3026', 33);
        c.restore();
      }
    } });
    C.line(ctx, [[2, -H / 2 + 6], [0, H / 2 - 4]], 3, 'rgba(138,106,64,.7)', .5);       // kat
    ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#8a6a40'; ctx.fillRect(0, -H / 2 + 6, 26, H - 10); ctx.restore();
    ctx.restore();
  }
  // toprak zemin (üstten), cached
  function dirt(ctx) {
    const cv = cached('toprak', 1600, 2400, c => {
      c.fillStyle = '#b89a6c'; c.fillRect(0, 0, 1600, 2400); C.seed(931);
      for (let i = 0; i < 140; i++) C.blot(c, C.ell(rnd(3000 + i) * 1600, rnd(3200 + i) * 2400, 20 + rnd(3400 + i) * 90, 10 + rnd(3600 + i) * 40, 10), i % 3 ? '#a88a5f' : '#cfb184', .45);
      for (let i = 0; i < 260; i++) { c.fillStyle = i % 2 ? 'rgba(110,100,87,.55)' : 'rgba(227,204,160,.6)'; c.beginPath(); c.arc(rnd(3800 + i) * 1600, rnd(4000 + i) * 2400, 2 + rnd(4200 + i) * 6, 0, TAU); c.fill(); }
    });
    ctx.drawImage(cv, -800, -1200);
  }
  // kazı çukuru (taşın yatağı) + yarı gömülü teneke; üstten, yerel köken = taşın yatağının ortası
  function stoneBed(ctx, tinA) {
    C.seed(941);
    C.shape(ctx, [[-260, -150], [250, -164], [270, 150], [-250, 160]], '#7f6646', { lw: 0, shade: c => { C.blot(c, [[-260, -160], [270, -170], [270, -90], [-260, -80]], '#5e4a32', .7); } });
    ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = '#5e4a32'; ctx.lineWidth = 3; ctx.stroke(C.pathOf(C.wobble([[-260, -150], [250, -164], [270, 150], [-250, 160]], true, 4, 10), true)); ctx.restore();
    if (tinA > 0) { ctx.save(); ctx.globalAlpha = tinA; tinTop(ctx, 0, 0, .9, { note: false }); tinLid(ctx, 0, 0, .9 * .98, 0); ctx.restore(); }
  }
  function bigStone(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); C.seed(945);
    C.shape(ctx, [[-300, -150], [-260, -200], [250, -210], [310, -140], [300, 170], [240, 210], [-270, 200], [-310, 140]], '#b9ab8e', { lw: 7, shade: c => {
      C.blot(c, [[120, -230], [330, -230], [330, 230], [140, 230]], '#8f846f', .55); C.blot(c, [[-330, 120], [330, 110], [330, 240], [-330, 240]], '#8f846f', .45);
      for (let i = 0; i < 26; i++) { c.fillStyle = i % 2 ? 'rgba(110,100,87,.4)' : 'rgba(230,220,196,.5)'; c.beginPath(); c.arc(-280 + rnd(5000 + i) * 560, -180 + rnd(5100 + i) * 360, 3 + rnd(5200 + i) * 9, 0, TAU); c.fill(); }
      C.blot(c, C.ell(-120, -60, 70, 30, 12), '#cfc4aa', .5); C.line(c, [[-60, -190], [-20, -80], [-50, 40]], 3, 'rgba(21,18,13,.4)', 1.5);
    } });
    ctx.restore();
  }

  /* ================= SAHNELER ================= */
  const shot = (id, f0, f1, draw) => TB.shot({ id, get t0() { return f0(times()); }, get t1() { return f1(times()); }, draw });

  /* "Previously" köşe görüntüsü: P9'un son karesi, lambaya tutulan liste (p2-a prevInset düzeni) */
  function prevInset(ctx, t) {
    const a = 1 - seg(t, 2.2, 2.42); if (a <= 0) return;
    const x = 704, y = 232, w = 176, h = 140;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.rotate(.035); ctx.translate(-w / 2, -h / 2);
    C.seed(1061); C.shape(ctx, [[-8, -8], [w + 8, -8], [w + 8, h + 8], [-8, h + 8]], P.paper, { lw: 4 });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.fillStyle = '#1d2742'; ctx.fillRect(0, 0, w, h);
    C.drawListLamp(ctx, { x: w * .5, y: h * .2, s: .36, rot: -.06, reveal: 1 });
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.strokeRect(0, 0, w, h);
    ctx.restore();
  }

  /* --- 1: "The last building on Grandpa's list is the one I grew up in." Kaan listeyle; kamera listeden ofis kapısına, adres levhası --- */
  const KAAN1 = { x: 990, y: 1880, s: 1.12 };
  shot('p10a-01-liste', k => 0, k => k.c2, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const e = E.io(seg(t, .5, k.grew + .25));
    const z = lerp(1.18, 2.15, e), cx = lerp(880, PLATE[0] - 40, E.outQ(seg(t, .45, k.grew))), cy = lerp(1490, PLATE[1] + 40, e), sy = lerp(1270, 1130, e);
    ctx.save(); cam(ctx, z, cx, cy, 540, sy);
    ctx.drawImage(plate('closed'), PX0, 0);
    daisy(ctx, Object.assign({ hook: hookSw(t) }, DAISY));
    const breath = Math.sin(tw * 2.4) * 3, look = tw < .9 ? .3 : -1;
    kaanH(ctx, { x: KAAN1.x, y: KAAN1.y + breath, s: KAAN1.s, expr: tw < 1.6 ? 'calm' : 'serious', look, blink: blinkAt(tw, [1.25]) });
    const flut = Math.sin(t * 9) * .5 + Math.sin(t * 5.3) * .5;
    heldList(ctx, KAAN1.x, KAAN1.y + breath + 20 * (1 - E.outC(seg(tw, 0, .4))), KAAN1.s, flut);
    grass(ctx, t);
    airDust(ctx, t, 14, 61, [0, 700, 1080, 900], .7);
    ctx.restore();
    finish(ctx);
    prevInset(ctx, t);
  });

  /* --- 2: "Line ten is our yard." liste güneşe tutulur; mavi karalamanın altında adres --- */
  shot('p10a-02-satir', k => k.c2, k => k.c3, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#8fbadb'); g.addColorStop(.55, '#c9dbe0'); g.addColorStop(1, '#f0e2c2'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    const sg = ctx.createRadialGradient(640, 860, 20, 640, 860, 700); sg.addColorStop(0, 'rgba(255,248,220,.95)'); sg.addColorStop(.3, 'rgba(255,240,200,.5)'); sg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, 1080, 1920);
    const s = lerp(1.42, 1.68, e), sway = Math.sin(t * 1.7) * 4, ly = 1020 - line10Y * s;
    const rot = -.03 + Math.sin(t * 1.3) * .008;
    C.drawListLamp(ctx, { x: 540 + sway - 60 * e, y: ly, s, rot, reveal: lerp(.75, 1, E.outC(seg(t, k.c2, S1(1).t0 + .9))) });
    // eller: alt köşelerden (sarı bileklik)
    const bx = 540 + sway - 60 * e, by = ly + LH / 2 * s;
    sideHand(ctx, bx - LW / 2 * s + 30, by - 40, Math.PI * .62, .75, { sd: 461 });
    sideHand(ctx, bx + LW / 2 * s - 30, by - 50, Math.PI * .38, .75, { sd: 471, flipY: true });
    finish(ctx);
  });
  const S1 = i => TB.sentence(i + 1);

  /* --- 3: "His office." kapı açılır (menteşe solda, içe), içerisi loş --- */
  shot('p10a-03-kapi', k => k.c3, k => k.c4, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    const z = lerp(1.9, 2.05, e), op = E.outC(seg(tw, k.open, k.open + .5));
    ctx.save(); cam(ctx, z, YD.dx + YD.dw * .75, YD.by - YD.dh * .52, 540, 900);
    ctx.drawImage(plate(op > 0 ? 'open' : 'closed'), PX0, 0);
    if (op > 0) { // içeri açılan kapı kanadı + içeriden takvim ışığı
      const { dx, dw, dh, by } = YD, w = dw * Math.cos(op * 1.25);
      ctx.save(); ctx.beginPath(); ctx.rect(dx, by - dh, dw, dh); ctx.clip();
      const g = ctx.createLinearGradient(dx, 0, dx + dw, 0); g.addColorStop(0, 'rgba(93,107,102,.0)'); g.addColorStop(1, `rgba(93,107,102,${.5 * op})`); ctx.fillStyle = g; ctx.fillRect(dx, by - dh, dw, dh);
      ctx.fillStyle = `rgba(255,232,180,${.18 * op})`; ctx.beginPath(); ctx.moveTo(dx + dw, by - dh); ctx.lineTo(dx + dw, by); ctx.lineTo(dx + w + 30, by); ctx.lineTo(dx + w, by - dh); ctx.fill();
      ctx.restore();
      C.seed(633); C.shape(ctx, [[dx, by], [dx, by - dh], [dx + w, by - dh + 10 * op], [dx + w, by - 8 * op]], '#5a4029', { lw: 3.4, shade: c => C.blot(c, [[dx + w * .55, by - dh - 10], [dx + w + 10, by - dh], [dx + w + 10, by + 10], [dx + w * .6, by + 10]], '#3f2711', .45) });
      if (w > 30) { ctx.save(); ctx.font = '700 15px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink; ctx.translate(dx + w * .5, by - dh * .73); ctx.scale(Math.max(.05, w / dw), 1); ctx.fillText('OFFICE', 0, 0); ctx.restore(); }
    }
    // el kapıyı iter (sağ alttan)
    const hin = E.outC(seg(tw, k.c3, k.open)), hout = E.inQ(seg(tw, k.open + .35, k.c4));
    const hx = YD.dx + YD.dw * .8 + 40 + (1 - hin) * 260 + hout * 300 - op * 40, hy = YD.by - YD.dh * .45 + (1 - hin) * 240 + hout * 260;
    sideHand(ctx, hx, hy, .5, .42, { sd: 481 });
    ctx.restore();
    finish(ctx);
  });

  /* --- 4a: "The cracked wall..." sepya hatıra: P4 gecesi, takvim kayar, çatlak (0,5 sn, sessiz) --- */
  shot('p10a-04-hatira', k => k.c4, k => k.c4b, (ctx, t, u) => {
    const cm = lerp(.15, CM, E.io(u)), z = 2.9;
    memory(ctx, m => {
      m.save(); cam(m, z, OF.kx + 30, OF.cy + OF.ch * .4);
      officeWorld(m, { lamp: true, door: .92, night: true, cm });
      m.restore();
      m.fillStyle = 'rgba(4,6,16,.35)'; m.fillRect(0, 0, 1080, 1920);
    });
    vignette(ctx, 0, 'rgba(30,20,10,.85)');
    finish(ctx);
  });
  /* --- 4b: "...behind the calendar." bugün, gün ışığı: çatlak boyunca yavaş itme, sıva tozu --- */
  shot('p10a-04-catlak', k => k.c4b, k => k.c5, (ctx, t, u) => {
    const e = E.io(u), z = lerp(2.4, 2.75, e), fx = OF.kx + lerp(60, 20, e), fy = lerp(OF.cy + OF.ch * .55, OF.cy + OF.ch * .25, e);
    ctx.save(); cam(ctx, z, fx, fy);
    officeWorld(ctx, { door: .92 });
    ctx.restore();
    dayRoom(ctx, .45);
    airDust(ctx, t, 18, 71, [200, 200, 800, 1000], .8);
    vignette(ctx, .35);
    finish(ctx);
  });

  /* --- 5: "Daisy tried to tell me on day two." avlu: kapı ve Daisy; "day two"da sepya 2. gün (Daisy kapının önünde, ışık yanık; sessiz) --- */
  function daisyDoorShot(ctx, t, u) {
    const e = E.io(u), z = lerp(1.32, 1.4, e);
    ctx.save(); cam(ctx, z, lerp(700, 720, e), 1290, 540, 900);
    ctx.drawImage(plate('closed'), PX0, 0);
    daisy(ctx, Object.assign({ hook: hookSw(t) }, DAISY));
    grass(ctx, t);
    ctx.restore();
  }
  shot('p10a-05-daisy', k => k.c5, k => k.c6, (ctx, t, u) => {
    const k = times();
    if (t >= k.mem5 && t < k.mem5b) { // sepya hatıra: P2'deki kapı önü bipi (pilot/P4 düzeni: tek renkli an kırmızı ışık)
      const D2 = { x: 620, y: 1580, s: .8 }, z = 1.7, uu = seg(t, k.mem5, k.mem5b);
      memory(ctx, m => {
        m.save(); cam(m, z + .04 * uu, D2.x - 10, D2.y - 300, 560, 760);
        m.drawImage(plate('closed'), PX0, 0);
        C.drawDaisy(m, { x: D2.x, y: D2.y, s: D2.s, seed: 23, beep: 0, mood: 'alert', hook: 0 });
        m.restore();
      });
      ctx.save(); cam(ctx, z + .04 * uu, D2.x - 10, D2.y - 300, 560, 760); ctx.translate(D2.x, D2.y); ctx.scale(D2.s, D2.s); drawBeacon(ctx, .9); ctx.restore();
      vignette(ctx, 0, 'rgba(30,20,10,.85)');
      finish(ctx); return;
    }
    daisyDoorShot(ctx, t, u);
    finish(ctx);
  });
  function drawBeacon(ctx, v) { // pilotla aynı uyarı ışığı (Daisy yerel, s=1)
    if (v <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -364, 8, 0, -364, 170); g.addColorStop(0, `rgba(${P.glow},${.85 * v})`); g.addColorStop(.4, `rgba(${P.glow},${.25 * v})`); g.addColorStop(1, `rgba(${P.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -364, 170, 0, TAU); ctx.fill(); ctx.restore();
    C.seed(23);
    C.shape(ctx, C.ell(0, -346, 21, 25, 20, Math.PI, TAU), P.beaconOn, { lw: 5.6, shade: c => { c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.ellipse(-7, -360, 4, 8, .3, 0, TAU); c.fill(); } });
    [-1, 1].forEach(d => [0, 1].forEach(q => { const r = 40 + q * 22, a0 = d < 0 ? Math.PI * .82 : -Math.PI * .18, a1 = d < 0 ? Math.PI * 1.18 : Math.PI * .18; C.line(ctx, C.ell(0, -352, r, r * .9, 8, a0, a1), 5.6 * (1 - q * .2) * Math.min(1, v * 1.5), null, .5); }));
  }

  /* --- 6–7: soluk hatıra: dedenin eli 10. satırı yazar; sonra mavi kalemle karalar (yalnız el ve kalem) --- */
  const LIST_M = { x: 520, y: 690, s: 1.5, rot: -.05 };
  function listToScr(lx, ly) { const c = Math.cos(LIST_M.rot), s = Math.sin(LIST_M.rot); return [LIST_M.x + (lx * c - ly * s) * LIST_M.s, LIST_M.y + (lx * s + ly * c) * LIST_M.s]; }
  function memoryDesk(ctx, t, n, scr, pen) {
    const k = times();
    const z = lerp(1, 1.06, E.io(seg(t, k.c6, k.c8)));
    ctx.save(); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540, -900);
    // masa (ahşap) üstten
    ctx.fillStyle = P.wood; ctx.fillRect(-200, -200, 1480, 2400); C.seed(611);
    for (let i = -2; i < 11; i++) C.line(ctx, [[-220, 120 + i * 220], [1300, 140 + i * 220 + (i % 2 ? 8 : -6)]], 2.6, 'rgba(21,18,13,.35)', 1.6);
    penCup(ctx, 960, 620, 2.2, pen === 'blue');
    ctx.save(); ctx.translate(LIST_M.x, LIST_M.y); ctx.rotate(LIST_M.rot); ctx.scale(LIST_M.s, LIST_M.s);
    listMemory(ctx, n, 0);
    ctx.restore();
    // soluk perde (hatıra): sıcak kâğıt tonu, kenarlar açık
    ctx.fillStyle = 'rgba(245,234,206,.38)'; ctx.fillRect(-400, -400, 1880, 2800);
    // taze mavi: sahnedeki tek doygun renk (perdenin üstünde)
    let tip = null;
    if (scr > 0) { ctx.save(); ctx.translate(LIST_M.x, LIST_M.y); ctx.rotate(LIST_M.rot); ctx.scale(LIST_M.s, LIST_M.s); tip = blueScratch(ctx, scr, 1); ctx.restore(); }
    // el + kalem
    let px, py;
    if (pen === 'dark') { const [x, y] = listToScr(addrX(n) + 2, line10Y - 6); px = x; py = y; }
    else { const p = tip || scratchPts()[0]; [px, py] = listToScr(p[0], p[1]); }
    return { px, py, z };
  }
  function handAt(ctx, px, py, col, lift, z) {
    ctx.save(); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540, -900);
    ctx.save(); ctx.globalAlpha = .82; oldHandPen(ctx, px + lift * 30, py - lift * 50, -.05, col); ctx.restore();
    ctx.restore();
  }
  function memWash(ctx) {
    const g = ctx.createRadialGradient(540, 860, 260, 540, 900, 1200); g.addColorStop(0, 'rgba(250,240,215,0)'); g.addColorStop(1, 'rgba(250,240,215,.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  }
  shot('p10a-06-yazdi', k => k.c6, k => k.c7, (ctx, t, u) => {
    const k = times(), tw = twos(t), n = Math.round(ADDR.length * E.io(seg(tw, k.write0, k.write1)));
    const r = memoryDesk(ctx, t, n, 0, 'dark');
    ctx.restore();
    const wig = n > 0 && n < ADDR.length ? Math.sin(tw * 40) * 3 : 0;
    const lift = 1 - E.outC(seg(tw, k.c6, k.write0));
    handAt(ctx, r.px, r.py + wig, '#3a3026', lift, r.z);
    memWash(ctx);
    finish(ctx);
  });
  shot('p10a-07-karaladi', k => k.c7, k => k.c8, (ctx, t, u) => {
    const k = times(), tw = twos(t), scr = E.io(seg(tw, k.scr0, k.scr1));
    const r = memoryDesk(ctx, t, ADDR.length, scr, 'blue');
    ctx.restore();
    // tereddüt: kalem satırın başında asılı, hafifçe iner-kalkar; sonra karalar; bitince kalkar
    const hes = 1 - E.io(seg(tw, k.scr0 - .25, k.scr0)), hov = Math.sin(tw * 3.2) * .25 * hes;
    const lift = Math.max(.35 * hes + hov, E.io(seg(tw, k.scr1 + .05, k.c8)) * .8);
    handAt(ctx, r.px, r.py + (scr > 0 && scr < 1 ? Math.sin(tw * 46) * 4 : 0), P.inkBlue, lift, r.z);
    memWash(ctx);
    finish(ctx);
  });

  /* --- 8: "I think he could not ask me." boş masa, mavi kalem; toz, sessizlik --- */
  shot('p10a-08-masa', k => k.c8, k => k.c9, (ctx, t, u) => {
    const e = E.io(u), z = lerp(2.5, 2.75, e), fx = lerp(330, 345, e), fy = lerp(470, 480, e);
    ctx.save(); cam(ctx, z, fx, fy, 540, 820);
    officeWorld(ctx, { door: .92, penOut: true, helmet: true });
    // masada yatan mavi kalem (dedenin kalemi)
    ctx.save(); ctx.translate(392, 552); ctx.rotate(-.06); C.seed(691);
    C.shape(ctx, [[-44, -3.4], [40, -3.4], [48, 0], [40, 3.4], [-44, 3.4]], P.inkBlue, { lw: 1.6 }); C.shape(ctx, [[-44, -3.6], [-30, -3.6], [-30, 3.6], [-44, 3.6]], '#cfd6dc', { lw: 1.2 });
    ctx.restore();
    ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = P.ink; ctx.fillRect(350, 555, 90, 3); ctx.restore();
    ctx.restore();
    dayRoom(ctx, .35);
    airDust(ctx, t, 22, 81, [0, 300, 1080, 900], .85);
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 9: "So I did not wait to be asked." Kaan dedenin eski baretini takar; kararlı --- */
  shot('p10a-09-baret', k => k.c9, k => k.c10, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurred('ofis-kapi-bg', 9, g => { cam(g, 1.5, 120, 330); officeWorld(g, { door: .92, helmet: false }); dayRoom(g, .5); });
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + .03 * E.io(u), 1 + .03 * E.io(u)); ctx.translate(-540, -960); ctx.drawImage(bg, 0, 0); ctx.restore();
    const kx = 540, ky = 2120, s = 2.55, pz = 1 + .025 * E.io(u);
    const on = E.io(seg(tw, k.helm - .35, k.helmOn)), settle = tw >= k.helmOn ? -6 * Math.exp(-(tw - k.helmOn) * 9) * Math.cos((tw - k.helmOn) * 30) : 0;
    const expr = tw < k.helm - .5 ? 'serious' : 'determined', blink = blinkAt(tw, [k.c9 + .45, k.helmOn + .5]);
    ctx.save(); ctx.translate(540, 1100); ctx.scale(pz, pz); ctx.translate(-540, -1100);
    C.drawKaan(ctx, { x: kx, y: ky, s, seed: 11, expr, look: tw < k.helm - .5 ? -.3 : 0, blink, phone: false });
    // baret: üstten iner (iki el kenarından tutar), oturur; tutam tepeden çıkar
    const h = HEAD.stand, hy = ky + h[1] * s - (1 - on) * 520 + settle, hx = kx + h[0] * s;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-.06 * (1 - on)); ctx.scale(h[2] * s, h[2] * s); helmetShape(ctx, 5.2 / Math.sqrt(s) / h[2]); ctx.restore();
    if (on >= 1) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1080, hy - 44 * s * h[2]); ctx.clip(); ctx.translate(kx, ky); ctx.scale(s, s); C.seed(541); C.shape(ctx, TUFT, P.hair, { lw: 5.2 / Math.sqrt(s) }); ctx.restore(); }
    // eller baretin kenarında; oturunca aşağı çekilir
    const hand = E.inQ(seg(tw, k.helmOn + .1, k.helmOn + .45));
    if (hand < 1) {
      const by = hy + 6 * s + hand * 600;
      sideHand(ctx, hx - 64 * s * h[2] - 10 - hand * 200, by, Math.PI * .72, .9, { sd: 491 });
      sideHand(ctx, hx + 64 * s * h[2] + 10 + hand * 200, by, Math.PI * .28, .9, { sd: 495, flipY: true });
    }
    ctx.restore();
    vignette(ctx, .4);
    finish(ctx);
  });

  /* --- 10: "We emptied the office." geniş: kutular hızla dışarı (Kaan baretli, Defne), yığın büyür --- */
  function pile(ctx, n) {
    const B = [[0, 0, 100, 70], [96, 4, 92, 66], [-92, 6, 90, 62], [44, -68, 96, 64], [-48, -64, 90, 60], [140, -60, 80, 58], [0, -128, 88, 60]];
    for (let i = 0; i < Math.min(n, B.length); i++) { const [x, y, w, h] = B[i]; cardBox(ctx, PILE[0] + x * .9, PILE[1] + y * .9, w * .9, h * .9, 3.2, 700 + i, { label: i % 2 === 0 }); }
  }
  shot('p10a-10-bosalt', k => k.c10, k => k.c11, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.6, 1.68, e), lerp(420, 400, e), 1330, 540, 900);
    ctx.drawImage(plate('open'), PX0, 0);
    // Kaan: kapıdan çıkar, sola yığına yürür (yan, sola bakar); "office"te kutuyu bırakır
    const ku = E.io(seg(tw, k.c10 - .1, k.drop)), kxw = lerp(510, 330, ku), kyw = lerp(1300, 1440, ku), ks = .9 - (1790 - kyw) * .001;
    const w = walk(t, k.c10, .32), moving = ku < 1;
    const n = 4 + (tw >= k.drop ? 1 : 0) + (tw >= k.c10 + .25 ? 1 : 0);
    pile(ctx, n);
    // Defne: kapıdan çıkar, kutuyla (önden)
    const du = E.io(seg(tw, k.c10 + .5, k.c11 + .2)), dxw = lerp(510, 430, du), dyw = lerp(1290, 1380, du), ds = .9 - (1790 - dyw) * .001, wd = walk(t, k.c10 + .5, .3);
    const items = [];
    items.push([dyw, () => { if (tw >= k.c10 + .5) defneBox(ctx, { x: dxw, y: dyw, s: ds, bob: wd.bob * ds * (du < 1 ? 1 : 0), expr: 'determined', look: -.6 }); }]);
    items.push([kyw, () => kaanH(ctx, { x: kxw, y: kyw, s: ks, pose: 'side', flip: true, step: moving ? w.step * .8 : 0, bob: moving ? w.bob * ks : 0, rot: moving ? w.rot : 0, expr: 'determined', helmet: true, box: tw < k.drop })]);
    items.push([DAISY.y, () => daisy(ctx, Object.assign({ hook: hookSw(t) }, DAISY))]);
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    // yığına düşen kutunun tozu
    const dd = t - k.drop; if (dd > 0 && dd < .8) for (let i = 0; i < 7; i++) { const r = j => rnd(7100 + i * 7 + j); ctx.fillStyle = `rgba(216,202,176,${.6 * (1 - dd / .8)})`; ctx.beginPath(); ctx.arc(PILE[0] - 60 + r(1) * 160 + (r(2) - .5) * dd * 120, PILE[1] + 10 - dd * 40 * r(3), 8 + dd * 30, 0, TAU); ctx.fill(); }
    grass(ctx, t);
    ctx.restore();
    finish(ctx);
  });

  /* --- 11: "Defne signed the plan." masa üstü: söküm planı, Defne'nin eli "Defne Kaya" yazar --- */
  function planDoc(ctx, signN) {
    const W = 720, H = 960; C.seed(3601);
    ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = P.ink; ctx.fillRect(-W / 2 + 16, -H / 2 + 18, W, H); ctx.restore();
    C.shape(ctx, [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]], '#e4ebe9', { lw: 5, shade: c => { c.strokeStyle = 'rgba(31,79,224,.1)'; c.lineWidth = 1; for (let xx = -W / 2; xx < W / 2; xx += 24) { c.beginPath(); c.moveTo(xx, -H / 2); c.lineTo(xx, H / 2); c.stroke(); } for (let yy = -H / 2; yy < H / 2; yy += 24) { c.beginPath(); c.moveTo(-W / 2, yy); c.lineTo(W / 2, yy); c.stroke(); } } });
    const B = '#24408f';
    ctx.save(); ctx.fillStyle = P.ink; ctx.textAlign = 'left';
    ctx.font = '700 50px Rubik'; ctx.fillText('SITE PLAN', -W / 2 + 50, -H / 2 + 96);
    ctx.font = '500 27px Rubik';
    [['Site:', '7 Old Mill Lane'], ['Work:', 'remove office shed'], ['Method:', 'crane lift, slow, fenced']].forEach(([a, b], i) => { ctx.fillStyle = 'rgba(21,18,13,.65)'; ctx.fillText(a, -W / 2 + 50, -H / 2 + 160 + i * 46); ctx.fillStyle = P.ink; ctx.fillText(b, -W / 2 + 196, -H / 2 + 160 + i * 46); });
    ctx.restore();
    // çizim: baraka + kanca + yukarı ok (kesikli)
    ctx.save(); ctx.strokeStyle = B; ctx.lineWidth = 3;
    ctx.stroke(C.pathOf(C.wobble([[-220, 220], [-220, 40], [120, 30], [120, 220]], false, .8), false));
    ctx.stroke(C.pathOf(C.wobble([[-250, 222], [150, 222]], false, .6), false));
    ctx.strokeRect(-170, 80, 70, 60); ctx.strokeRect(10, 90, 60, 130);
    ctx.setLineDash([10, 8]);
    ctx.stroke(C.pathOf(C.wobble([[-220, 40], [-50, -110], [120, 30]], false, .5), false));
    ctx.stroke(C.pathOf(C.wobble([[-50, -110], [-50, -200]], false, .4), false)); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(-64, -180); ctx.lineTo(-50, -206); ctx.lineTo(-36, -180); ctx.stroke();
    ctx.restore();
    C.handwrite(ctx, 'lift 1 / 1', 160, -120, 26, B, 381);
    ctx.save(); ctx.font = '500 24px Rubik'; ctx.fillStyle = 'rgba(21,18,13,.65)'; ctx.fillText('Engineer of record', -W / 2 + 50, H / 2 - 190); ctx.restore();
    C.seed(3602); C.line(ctx, [[-W / 2 + 50, H / 2 - 120], [W / 2 - 250, H / 2 - 122]], 3, P.ink, .5);
    ctx.save(); ctx.font = '500 22px Rubik'; ctx.fillStyle = 'rgba(21,18,13,.6)'; ctx.fillText('Defne Kaya, P.Eng.', -W / 2 + 50, H / 2 - 88); ctx.restore();
    if (signN > 0) C.handwrite(ctx, 'Defne Kaya'.slice(0, signN), -W / 2 + 64, H / 2 - 132, 58, P.ink, 371, { bold: true, track: .86 });
  }
  function defneHand(ctx, x, y, rot, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(o.s || 1, o.s || 1); C.seed(3610);
    C.shape(ctx, [[30, 40], [120, 10], [700, 300], [600, 420]], P.shirt, { lw: 6, shade: c => C.blot(c, [[60, 60], [700, 340], [620, 430], [40, 90]], P.shirtDk, .6) });
    C.shape(ctx, [[60, 0], [140, -24], [168, 60], [92, 92]], P.shirtDk, { lw: 5 });
    if (o.pen) { C.line(ctx, [[-60, -66], [70, 26]], 14, P.ink, .2); C.line(ctx, [[-60, -66], [70, 26]], 7, '#3a3d45', .2); }
    C.shape(ctx, [[-50, -40], [20, -50], [80, -10], [90, 50], [40, 70], [-30, 50], [-60, 0]], P.dSkin, { lw: 6, shade: c => C.blot(c, [[10, 20], [100, 20], [100, 80], [10, 80]], P.dSkinDk, .5) });
    C.line(ctx, [[-40, -20], [10, -6]], 3, P.dSkinDk, .3); C.line(ctx, [[-36, 10], [16, 22]], 3, P.dSkinDk, .3);
    ctx.restore();
  }
  shot('p10a-11-imza', k => k.c11, k => k.c12, (ctx, t, u) => {
    const k = times(), tw = twos(t), n = Math.round(10 * seg(tw, k.signW, k.signW + .85));
    ctx.fillStyle = '#d9d3bf'; ctx.fillRect(0, 0, 1080, 1920);
    const z = lerp(1.32, 1.46, E.io(u));
    ctx.save(); ctx.translate(540, 700); ctx.scale(z, z); ctx.rotate(-.04); ctx.translate(30, -150);
    C.seed(3701); for (let i = 0; i < 8; i++) C.blot(ctx, C.ell(-700 + rnd(3710 + i) * 1400, -900 + rnd(3720 + i) * 1800, 120 + rnd(3730 + i) * 160, 30 + rnd(3740 + i) * 30, 12), '#c4bca3', .5);
    planDoc(ctx, n);
    const W = 720, H = 960; ctx.save(); ctx.font = '500 58px Rubik'; const wd = ctx.measureText('Defne Kaya'.slice(0, n)).width * .86; ctx.restore();
    const inU = E.outC(seg(tw, k.c11, k.signW)), outU = E.inQ(seg(tw, k.signW + .95, k.c12));
    const px = -W / 2 + 64 + wd + (1 - inU) * 500 + outU * 600, py = H / 2 - 140 + Math.sin(tw * 30) * (n > 0 && n < 10 ? 8 : 0) + (1 - inU) * 300 + outU * 200;
    defneHand(ctx, px + 66, py + 74, -.15, { pen: true, s: .85 });
    ctx.restore();
    vignette(ctx, .3);
    finish(ctx);
  });

  /* --- 12: "Mr. Hale carried boxes." Hale kutuyla (şapkası kutunun üstünde) kapıdan yığına; Kaan güler --- */
  shot('p10a-12-hale', k => k.c12, k => k.c13, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.55, 1.62, e), lerp(420, 380, e), 1250, 540, 900);
    ctx.drawImage(plate('open'), PX0, 0);
    pile(ctx, 6);
    const hu = seg(tw, k.c12 - .2, k.c13 + .3), hx = lerp(560, 360, hu), hy = lerp(1450, 1500, hu), hs = .78, w = walk(t, k.c12 - .2, .36);
    const hb = w.bob * hs, hatBob = Math.abs(Math.sin(w.ph * Math.PI)) * 5;
    const items = [];
    items.push([1470, () => kaanH(ctx, { x: 175, y: 1470, s: .74, expr: tw > k.c12 + .55 ? 'smile' : 'surprised', look: .9, blink: blinkAt(tw, [k.c12 + 1.1]), helmet: true })]);
    items.push([hy, () => haleCarry(ctx, { x: hx, y: hy, s: hs, bob: hb, rot: w.rot, flip: true, expr: 'confident', look: -.4, hatBob, blink: blinkAt(tw, [k.c12 + .8]) })]);
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    grass(ctx, t);
    airDust(ctx, t, 12, 91, [0, 900, 1080, 600], .6);
    ctx.restore();
    finish(ctx);
  });

  /* --- 13a: "And Daisy made her last lift." Daisy yakın: siperlik kalkar, motor titrer (kanca kadraj üstünde) --- */
  shot('p10a-13-daisy', k => k.c13, k => k.c13b, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const z = lerp(3.5, 3.62, E.io(u)), vib = tw >= k.lid ? Math.sin(t * 60) * .8 : 0;
    ctx.save(); cam(ctx, z, DAISY.x, 1245 + vib / z, 540, 0);
    ctx.drawImage(plate('closed'), PX0, 0);
    daisy(ctx, Object.assign({}, DAISY, { mood: tw >= k.lid ? 'alert' : 'sleepy', hook: 0, boom: .12 * E.outBack(seg(tw, k.lid + .2, k.c13b + .3)) }));
    ctx.restore();
    // sabah güneşi: sağ üstten sıcak
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const g = ctx.createRadialGradient(900, 200, 40, 700, 600, 1300); g.addColorStop(0, 'rgba(255,236,190,.6)'); g.addColorStop(1, 'rgba(60,40,20,.3)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    finish(ctx);
  });

  /* --- 13b: baraka bütün olarak, yavaşça kalkar; dört sapan yukarıda kancada birleşir; tabandan toz dökülür --- */
  function rise(t) { const k = times(), a = Math.max(0, t - k.c13b), b = Math.max(0, t - k.c14); return 260 * E.outQ(clamp(a / .35)) * .35 + 260 * Math.max(0, a - .35) + 1100 * b * b; }
  function shedLifted(ctx, t, r) {
    // gölge (zeminde, yükseldikçe solar ve genişler)
    ctx.save(); ctx.globalAlpha = .3 * (1 - clamp(r / 700)); ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(390, 1262, 300 + r * .08, 22 + r * .02, 0, 0, TAU); ctx.fill(); ctx.restore();
    const sw = Math.sin(t * 1.6) * .006 * clamp(r / 60);
    ctx.save(); ctx.translate(390, 960 - r); ctx.rotate(sw); ctx.translate(-390, -960);
    // alt yüz (döşeme altı): koyu şerit
    C.seed(721); C.shape(ctx, [[104, 1266], [674, 1266], [668, 1282], [110, 1282]], '#4a463f', { lw: 3 });
    ctx.drawImage(shedSprite(), SHED_O[0], SHED_O[1]);
    // sapanlar: çatı köşelerinden kancaya (kadraj üstünde)
    const hook = [392, 280];
    [[96, 676], [300, 668], [486, 662], [684, 655]].forEach(([x, y], i) => { C.seed(731 + i); C.line(ctx, [[x, y], hook], 4.4, P.ink, .2); C.line(ctx, [[x, y], hook], 2, P.steelLt, .1); C.shape(ctx, C.ell(x, y + 2, 7, 6, 10), P.steel, { lw: 2 }); });
    // kanca bloğu + halat (Daisy'nin kancası: tehlike şeritli)
    ctx.save(); ctx.translate(hook[0], hook[1] - 34); C.seed(741);
    C.line(ctx, [[0, -40], [0, -900]], 4, P.ink, .3);
    const hb = C.shape(ctx, [[-30, -48], [30, -48], [32, 10], [-32, 10]], null, { lw: 0 }); C.hazardStripes(ctx, hb, -34, -52, 68, 66, 14); C.ink(ctx, hb, 4.4);
    ctx.restore();
    ctx.restore();
    // tabandan dökülen toz/sıva
    if (r > 2) for (let i = 0; i < 18; i++) { const q = j => rnd(7300 + i * 7 + j), ph = ((t * (.6 + q(1) * .5) + q(2)) % 1); const x = 112 + q(3) * 556, y0 = 1270 - r + ph * (r + 10); if (y0 > 1268) continue; ctx.fillStyle = `rgba(216,202,176,${.7 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x + Math.sin(ph * 6 + i) * 6, y0, 2 + q(4) * 3.5, 0, TAU); ctx.fill(); }
  }
  function liftDust(ctx, t) {
    const k = times(), a = t - k.c13b; if (a < 0) return;
    for (let i = 0; i < 12; i++) { const q = j => rnd(7400 + i * 9 + j), life = clamp((a - q(1) * .5) / 1.6); if (life <= 0 || life >= 1) continue; ctx.fillStyle = `rgba(216,202,176,${.5 * (1 - life)})`; ctx.beginPath(); ctx.arc(110 + q(2) * 560 + (q(3) - .5) * life * 140, 1268 - life * 50 * q(4), 14 + life * 46, 0, TAU); ctx.fill(); }
  }
  shot('p10a-13-kalkis', k => k.c13b, k => k.c14, (ctx, t, u) => {
    const z = lerp(1.35, 1.32, E.io(u));
    ctx.save(); cam(ctx, z, 372, 1000, 540, 960);
    ctx.drawImage(plate('empty'), PX0, 0);
    stoneBlock(ctx, STONE[0], STONE[1], 64, 34, 650);
    liftDust(ctx, t);
    shedLifted(ctx, t, rise(t));
    grass(ctx, t);
    ctx.restore();
    finish(ctx);
  });

  /* --- 14a: baraka kadrajdan yukarı çıkar; çıplak temel; Kaan ilk taşa eğilir, Defne ve Hale (şapka elde) bakar --- */
  shot('p10a-14-temel', k => k.c14, k => k.c14b, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    ctx.save(); cam(ctx, lerp(1.6, 1.68, e), 390, 1250, 540, 860);
    ctx.drawImage(plate('empty'), PX0, 0);
    stoneBlock(ctx, STONE[0], STONE[1], 64, 34, 650);
    liftDust(ctx, t);
    const r = rise(t); if (r < 1300) shedLifted(ctx, t, r);
    const ku = E.io(seg(tw, k.c14, k.c14b - .1)), kx = lerp(70, 168, ku), ky = lerp(1360, 1318, ku), ks = .9 - (1790 - ky) * .001, w = walk(t, k.c14, .3);
    const lean = .32 * E.io(seg(tw, k.c14b - .3, k.c14b));
    const items = [];
    items.push([ky, () => kaanH(ctx, { x: kx, y: ky, s: ks, pose: 'side', flip: true, step: ku < 1 ? w.step : 0, bob: ku < 1 ? w.bob * ks : 0, rot: -lean, expr: 'serious', helmet: true })]);
    items.push([1372, () => C.drawDefne(ctx, { x: 560, y: 1372, s: .55, seed: 31, expr: 'serious', look: -1, item: 'helmet', blink: blinkAt(tw, [k.c14 + .2]) })]);
    items.push([1392, () => C.drawHale(ctx, { x: 668, y: 1392, s: .56, seed: 41, hat: 'hand', expr: 'regret', look: -1 })]);
    items.sort((a, b) => a[0] - b[0]).forEach(f => f[1]());
    grass(ctx, t);
    ctx.restore();
    finish(ctx);
  });

  /* --- 14b: üstten: iki el taşı kaldırır; altında teneke ("tin"de itme) --- */
  shot('p10a-14-taş', k => k.c14b, k => k.c15, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const lu = E.inQ(seg(tw, k.stone - .05, k.stone + .45)), push = E.io(seg(t, k.tin - .25, k.c15));
    const z = lerp(1, 1.18, push) * lerp(1, 1.03, u);
    ctx.save(); ctx.translate(540, 760); ctx.scale(z, z); ctx.translate(-540, -760);
    ctx.save(); ctx.translate(540, 760); dirt(ctx); stoneBed(ctx, 1); ctx.restore();
    // taş: kalkar, kameraya yaklaşır, sağ üstten çıkar
    const sx = 540 + lu * 520, sy = 760 - lu * 760, ss = 1.02 + lu * .55, sr = lu * .25;
    ctx.save(); ctx.globalAlpha = .35 * (1 - lu); ctx.fillStyle = '#2a2118'; ctx.beginPath(); ctx.ellipse(560 + lu * 200, 790, 330, 230, 0, 0, TAU); ctx.fill(); ctx.restore();
    if (lu < 1) {
      bigStone(ctx, sx, sy, ss, sr);
      const grip = E.outC(seg(tw, k.c14b, k.stone - .1));
      sideHand(ctx, sx - (300 + (1 - grip) * 260) * ss, sy + 20 * ss + (1 - grip) * 200, Math.PI * .9, .9 * ss, { sd: 501 });
      sideHand(ctx, sx + (300 + (1 - grip) * 260) * ss, sy + 30 * ss + (1 - grip) * 200, Math.PI * .1, .9 * ss, { sd: 505, flipY: true });
    }
    // kalkan taşın altından düşen toprak
    if (lu > 0) for (let i = 0; i < 14; i++) { const q = j => rnd(7500 + i * 7 + j), d = clamp(lu * 1.4 - q(1) * .4); if (d <= 0 || d >= 1) continue; ctx.fillStyle = `rgba(122,96,64,${.8 * (1 - d)})`; ctx.beginPath(); ctx.arc(sx + (q(2) - .5) * 400 * ss, sy + 150 * ss + d * 300, 3 + q(3) * 6, 0, TAU); ctx.fill(); }
    ctx.restore();
    airDust(ctx, t, 16, 101, [100, 300, 880, 900], .6, '216,202,176');
    vignette(ctx, .4);
    finish(ctx);
  });

  /* --- 15: "Inside, a note." kapak kalkar; içinde katlı not --- */
  shot('p10a-15-not', k => k.c15, k => k.c16, (ctx, t, u) => {
    const k = times(), tw = twos(t), e = E.io(u);
    const z = lerp(1.25, 1.42, e);
    ctx.save(); ctx.translate(540, 760); ctx.scale(z, z); ctx.translate(-540, -760);
    ctx.save(); ctx.translate(540, 760); dirt(ctx); stoneBed(ctx, 0); tinTop(ctx, 0, 0, .9, {}); ctx.restore();
    const lo = E.io(seg(tw, k.lidOff - .05, k.lidOff + .45));
    const lx = 540 - lo * 560, ly = 760 - lo * 420, lr = -lo * .5;
    if (lo < 1) {
      ctx.save(); ctx.globalAlpha = .3 * (1 - lo); ctx.fillStyle = '#2a2118'; ctx.fillRect(lx - 150 + lo * 60, ly - 90 + lo * 60, 340, 230); ctx.restore();
      tinLid(ctx, lx, ly, .9 * (1 + lo * .35), lr);
      const grip = E.outC(seg(tw, k.c15, k.lidOff - .1));
      sideHand(ctx, lx + 150 * (1 + lo * .35) + (1 - grip) * 300, ly + 60 + (1 - grip) * 260, Math.PI * .15 + lr, .8 * (1 + lo * .35), { sd: 511, flipY: true });
    }
    ctx.restore();
    airDust(ctx, t, 14, 111, [100, 300, 880, 900], .6, '216,202,176');
    vignette(ctx, .45);
    finish(ctx);
  });

  /* --- 16: "Grandpa's handwriting." Kaan'ın elleri katlı notu kaldırır; arkasından dedenin eğik yazısı soluk sızar. Not KATLI kalır. --- */
  const NOTE_END = { x: 540, y: 760, s: 1.08, rot: -.04 };
  shot('p10a-16-yazi', k => k.c16, k => k.end, (ctx, t, u) => {
    const k = times(), tw = twos(t);
    const bg = blurred('teneke-acik', 10, g => { g.translate(540, 760); g.scale(1.6, 1.6); g.translate(-540, -760); g.save(); g.translate(540, 760); dirt(g); stoneBed(g, 0); tinTop(g, 0, 0, .9, { note: false }); g.restore(); });
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + .03 * u, 1 + .03 * u); ctx.translate(-540, -960); ctx.drawImage(bg, 0, 0); ctx.restore();
    ctx.fillStyle = 'rgba(30,22,14,.25)'; ctx.fillRect(0, 0, 1080, 1920);
    const pu = E.outC(seg(tw, k.pick, k.pick + .55));
    const x = lerp(546, NOTE_END.x, pu), y = lerp(770, NOTE_END.y, pu) + Math.sin(t * 2.1) * 3 * pu, s = lerp(.62 * 1.44, NOTE_END.s, pu), rot = lerp(.04, NOTE_END.rot, pu);
    const bleed = .35 + .65 * E.io(seg(t, S1(15).t0 + .05, S1(15).t1));
    foldedNote(ctx, x, y, s, rot, bleed);
    // iki el notu kenarlarından tutar
    const c = Math.cos(rot), sn = Math.sin(rot), hw = 260 * s;
    sideHand(ctx, x - hw * c + 30, y - hw * sn + 60 * s, Math.PI * .78, .8, { sd: 521 });
    sideHand(ctx, x + hw * c - 30, y + hw * sn + 60 * s, Math.PI * .22, .8, { sd: 525, flipY: true });
    vignette(ctx, .45);
    finish(ctx);
  });

  /* ================= SES EKİBİNE İŞARETLER (sn, bölüm zamanı) ================= */
  const r3 = x => +x.toFixed(3);
  TB.cuesA = {
    get listeKagit() { return 0; },                               // 0. kare: rüzgârda liste kâğıdı
    get kapiAcilir() { return r3(times().open); },                // ofis kapısı açılır (gıcırtı)
    get hatiraCatlak() { return r3(times().c4); },                // sepya P4 çatlak (sessiz hatıra, 0,5 sn)
    get hatiraKapiBip() { return r3(times().mem5); },             // sepya P2 kapı önü, ışık yanık ama SESSİZ
    get kalemYazar() { return r3(times().write0); },              // hatıra: kalem kâğıtta (yumuşak, soluk)
    get maviKaralar() { return r3(times().scr0); },               // hatıra: mavi kalem karalar
    get baretTakilir() { return r3(times().helmOn); },            // baret başa oturur (tok)
    get kutuBirakilir() { return r3(times().drop); },             // kutu yığına (karton)
    get imzaKalem() { return r3(times().signW); },                // kalem kâğıtta (0,85 sn)
    get haleAdim() { return r3(times().c12); },                   // Hale'nin ağır adımları başlar
    get siperlikKalkar() { return r3(times().lid); },             // Daisy uyanır, motor rölanti
    get barakaKalkar() { return r3(times().c13b); },              // vinç halatı gerilir, baraka zeminden kopar (gıcırtı, sac)
    get tasKalkar() { return r3(times().stone); },                // taş toprağı sıyırarak kalkar
    get teneke() { return r3(times().tin); },                     // tenekeye itme (ince metal tını)
    get kapakAcilir() { return r3(times().lidOff); },             // teneke kapağı açılır (pas, metal)
    get notAlinir() { return r3(times().pick); }                  // kâğıt hışırtısı
  };
})();
