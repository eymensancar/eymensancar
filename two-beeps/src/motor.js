/* Two Beeps — motor (yönetmenin sözleşmesi; ekip bunu DEĞİŞTİRMEZ, eksik bir şey varsa yönetmene yazar).
   Her şey zamandan (t, saniye) hesaplanır: aynı t = aynı kare. Math.random, Date.now, requestAnimationFrame'e bağlı durum YOK.

   Sahne ekleme (src/shots/*.js):
     TB.shot({ id:'a01-liste', t0:0, t1:2.6, draw(ctx, t, u, tl){ ... } })
       t0/t1: sayı, getter ya da fonksiyon (tl => sayı); fonksiyonlar boot'ta timeline yüklendikten sonra çözülür.
       t  = bölüm zamanı (sn), u = sahne içi 0..1, tl = partN.timeline.json
   Bölüm sayfası: src/part.html?p=N → shots/pN-a.js, shots/pN-b.js (yoksa atlanır; Part 1 için eski adlar
     shots/a-sahneler.js / b-sahneler.js eşlenir), sonra paket.js, TB.boot('partN.timeline.json').
       Sahneler zamanı kendi aralarında boşluksuz kaplar; üst üste binerse sonra eklenen üstte çizilir (geçiş için).
       Sahne 1080×1920 tuvalin tamamını çizer (arka plan dahil). ctx her sahneden önce save/restore edilir.
   Üst katman (src/paket.js): TB.overlay(function(ctx, t, tl){ ... })  — altyazı, etiket, simge, bitiş kartı.
   Görseller: TB.img('assets/img/x.png') önceden yükler (boot beklemeye alır), TB.pic(yol) ile çizime hazır Image döner.
   Yardımcılar: TB.ease.*, TB.clamp, TB.lerp, TB.seg(t,a,b) (a..b arasını 0..1'e çevirir), TB.sentence(i) (1'den başlar), TB.rand(seed) (tohumlu 0..1).
   Kayıt: window.renderAt(t) kareyi çizer; window.TB_READY true olunca hazır. Tarayıcıda açınca boşluk tuşu oynatır, ←/→ 0,5 sn gezer. */
(function (G) {
  'use strict';
  const TB = G.TB = { shots: [], overlays: [], imgs: {}, tl: null };
  const pend = [];
  TB.shot = s => { TB.shots.push(s); };
  TB.overlay = f => { TB.overlays.push(f); };
  TB.img = p => { if (!TB.imgs[p]) { const im = new Image(); pend.push(new Promise(r => { im.onload = r; im.onerror = () => { console.error('görsel yok', p); r(); }; })); im.src = '../' + p; TB.imgs[p] = im; } return TB.imgs[p]; };
  TB.pic = p => TB.imgs[p] || TB.img(p);
  TB.clamp = (x, a, b) => Math.max(a == null ? 0 : a, Math.min(b == null ? 1 : b, x));
  TB.lerp = (a, b, u) => a + (b - a) * u;
  TB.seg = (t, a, b) => TB.clamp((t - a) / (b - a));
  TB.rand = seed => { let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 7; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  TB.ease = {
    lin: u => u, inQ: u => u * u, outQ: u => 1 - (1 - u) * (1 - u), io: u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2,
    outC: u => 1 - Math.pow(1 - u, 3), inC: u => u * u * u, ioC: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
    outBack: u => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2),
    outEl: u => u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - .75) * (2 * Math.PI) / 3) + 1
  };
  TB.sentence = i => TB.tl.sentences[i - 1];
  /* Ortak sahne öğesi: planlanan devrilme alanı ("drop zone"). İki animatör de bunu çağırır ki aynı görünsün.
     Yerde perspektifli bir dörtgen: dört kazık, sarı-siyah şerit, ortada tebeşirle büyük X.
     cx,cy = alanın yerdeki merkezi; w = genişlik; h = derinlik (perspektifle basık, ör. w*0.28); a = saydamlık. */
  TB.zone = (ctx, cx, cy, w, h, a) => {
    const k = .82, x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, bx0 = cx - w * k / 2, bx1 = cx + w * k / 2;
    const P = [[bx0, y0], [bx1, y0], [x1, y1], [x0, y1]], ph = Math.max(26, w * .13), lw = Math.max(3, w * .012);
    ctx.save(); ctx.globalAlpha = a == null ? 1 : a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(248,244,232,.92)'; ctx.lineWidth = lw * 2.2;                      // tebeşir X
    ctx.beginPath(); ctx.moveTo(TB.lerp(bx0, x0, .25) + w * .12, y0 + h * .22); ctx.lineTo(TB.lerp(bx1, x1, .75) - w * .12, y1 - h * .2);
    ctx.moveTo(TB.lerp(bx1, x1, .25) - w * .12, y0 + h * .22); ctx.lineTo(TB.lerp(bx0, x0, .75) + w * .12, y1 - h * .2); ctx.stroke();
    const tape = (A, B) => { const n = Math.max(4, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / (lw * 6)));   // sarı-siyah şerit
      for (let i = 0; i < n; i++) { ctx.strokeStyle = i % 2 ? '#15120d' : '#f5b21c'; ctx.lineWidth = lw * 2.4; ctx.lineCap = 'butt'; ctx.beginPath();
        ctx.moveTo(TB.lerp(A[0], B[0], i / n), TB.lerp(A[1], B[1], i / n) - ph * .62 + Math.sin(i / n * Math.PI) * ph * .12); ctx.lineTo(TB.lerp(A[0], B[0], (i + 1) / n), TB.lerp(A[1], B[1], (i + 1) / n) - ph * .62 + Math.sin((i + 1) / n * Math.PI) * ph * .12); ctx.stroke(); } };
    tape(P[0], P[1]); tape(P[1], P[2]); tape(P[3], P[0]); tape(P[2], P[3]);
    P.forEach((p, i) => { const s = i < 2 ? k : 1; ctx.strokeStyle = '#15120d'; ctx.lineWidth = lw * 2.6 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - ph * s); ctx.stroke();
      ctx.strokeStyle = '#d9c2a0'; ctx.lineWidth = lw * 1.3 * s; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - ph * s); ctx.stroke(); });
    ctx.restore();
  };
  let ctx;
  G.renderAt = t => {
    const tl = TB.tl; t = TB.clamp(t, 0, tl.duration - 1e-4); TB.t = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920);
    for (const s of TB.shots) if (t >= s.t0 && t < s.t1) { ctx.save(); try { s.draw(ctx, t, (t - s.t0) / (s.t1 - s.t0), tl); } catch (e) { console.error(s.id, e); } ctx.restore(); }
    for (const f of TB.overlays) { ctx.save(); try { f(ctx, t, tl); } catch (e) { console.error('overlay', e); } ctx.restore(); }
  };
  TB.boot = async url => {
    ctx = document.getElementById('c').getContext('2d');
    TB.tl = await (await fetch(url)).json();
    for (const s of TB.shots) for (const k of ['t0', 't1']) {       // fonksiyon t0/t1 → sayı (getter'lar olduğu gibi kalır)
      const d = Object.getOwnPropertyDescriptor(s, k);
      if (d && 'value' in d && typeof d.value === 'function') s[k] = +d.value(TB.tl);
    }
    await Promise.all(['400 40px "Lilita One"', '500 20px Rubik', '700 20px Rubik'].map(f => document.fonts.load(f, 'Aa')));
    await Promise.all(pend);
    renderAt(+new URLSearchParams(location.search).get('t') || 0);
    G.TB_READY = true;
    // elle izleme (kayıtta kullanılmaz)
    let playing = false, t0 = 0, p0 = 0, au = null;
    const tick = () => { if (!playing) return; const t = t0 + (performance.now() - p0) / 1000; if (t >= TB.tl.duration) { playing = false; return; } renderAt(t); requestAnimationFrame(tick); };
    addEventListener('keydown', e => {
      if (e.code === 'Space') { playing = !playing; if (playing) { t0 = TB.t || 0; p0 = performance.now(); if (!au) au = new Audio('../' + (new URLSearchParams(location.search).get('ses') || TB.tl.voice)); au.currentTime = t0; au.play().catch(() => { }); tick(); } else if (au) au.pause(); }
      if (e.code === 'ArrowRight') renderAt((TB.t || 0) + .5); if (e.code === 'ArrowLeft') renderAt((TB.t || 0) - .5);
    });
  };
})(window);
