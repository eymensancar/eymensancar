/* Two Beeps — motor (yönetmenin sözleşmesi; ekip bunu DEĞİŞTİRMEZ, eksik bir şey varsa yönetmene yazar).
   Her şey zamandan (t, saniye) hesaplanır: aynı t = aynı kare. Math.random, Date.now, requestAnimationFrame'e bağlı durum YOK.

   Sahne ekleme (src/shots/*.js):
     TB.shot({ id:'a01-liste', t0:0, t1:2.6, draw(ctx, t, u, tl){ ... } })
       t  = bölüm zamanı (sn), u = sahne içi 0..1, tl = part1.timeline.json
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
