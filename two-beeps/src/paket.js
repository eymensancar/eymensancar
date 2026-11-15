/* Two Beeps — paketleme katmanı (bütün bölümlerde aynı; docs/PAZARLAMA.md şartnamesi).
   TB.overlay ile sahnelerin üstüne çizilir. Bölüme özgü hiçbir sabit yok: her şey timeline'dan
   (tl.part, tl.title, tl.next, tl.sentences[].words, tl.cues.beep/voiceEnd/endCard, isteğe bağlı tl.parts) okunur.
   Katmanlar (alttan üste): vinyet → kanca yazısı (1. cümle) → altyazı → bölüm etiketi/rozet → köşe simgesi → bitiş kartı.
   Rastgelelik yok; her şey t'den hesaplanır. Bip anlarında katman hareketsizdir. */
(function (G) {
  'use strict';
  const TB = G.TB;
  const P = (G.Cizim && G.Cizim.PAL) || { ink: '#15120d', paper: '#f1e8d4', hazard: '#f5b21c', hazardDeep: '#d98e0b' };
  const ICON = 'assets/img/oyun-simge.png';
  TB.img(ICON);

  const F = 1 / 30;                      // bir kare
  const FONT = s => `400 ${s}px "Lilita One"`;
  const C = {
    // güvenli alan: okunacak yazı x 60–890, y 220–1440
    safeL: 60, safeR: 890,
    sub: { cx: 480, cy: 1300, maxW: 780, size: 72, minSize: 56, lh: 82, stroke: 8, maxWords: 4,
           lead: 2 * F, hold: 0.36, fadeIn: 3 * F, fadeOut: 4 * F, endFade: 3 * F },
    hook: { cx: 475, cy: 800, maxW: 800, size: 110, lh: 116, band: 240 },
    label: { x: 60, y: 240, h: 64, size: 42, pad: 22, until: 2.5, morph: 0.3, badgeH: 48, badgeSize: 32 },
    prev: { x: 60, y: 392, w: 830, pad: 22, size: 42, tag: 28, until: 2.2, fade: 0.2 },
    icon: { x: 826, y: 236, s: 64, alpha: 0.7, from: 3.0, fade: 0.3 },
    soru: { x0: 60, x1: 890, y0: 640, y1: 1400, yHead: 676, yDurum: 744, yChip: [806, 912], chipW: 760, chipH: 92, ySatir: 1050, yNext: 1126,
            yDiv: 1184, yGame: 1294, yGameBig: 1290, dChips: 0.2, dSatir: 1.2, dGame: 1.8 },
    end: { x0: 60, x1: 890, y0: 752, y1: 1400, yTitle: 834, yFollow: 942, yDiv: 1008, icon: 128, yIcon: 1040, ySearch: 1222, ySmall: 1294 }
  };
  const FUNC = new Set('a an the in to of with my i i\'m and is was she he it its that about before at on for than her me so as but or'.split(' '));
  const clean = w => w.toLowerCase().replace(/[^a-z']/g, '');
  const punct = w => /[,.:;!?]$/.test(w);

  /* ---------- yardımcı çizimler ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // konturlu yazı: dış kontur (ink), 5 px alt gölge, dolgu
  function outlined(ctx, txt, x, y, size, fill, stroke, shadow) {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = P.ink; ctx.lineWidth = stroke * 2;
    if (shadow) { ctx.fillStyle = P.ink; ctx.strokeText(txt, x, y + shadow); ctx.fillText(txt, x, y + shadow); }
    ctx.strokeText(txt, x, y); ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  }
  function stripes(ctx, x, y, w, h, band) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = P.hazard; ctx.fillRect(x, y, w, h); ctx.fillStyle = P.ink;
    for (let i = -h * 2; i < w + h; i += band * 2) {
      ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + band, y + h); ctx.lineTo(x + i + band + h, y); ctx.lineTo(x + i + h, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function icon(ctx, x, y, s, alpha) {
    const im = TB.pic(ICON); if (!im || !im.complete || !im.naturalWidth) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    rr(ctx, x, y, s, s, s * 0.2237); ctx.save(); ctx.clip(); ctx.drawImage(im, x, y, s, s); ctx.restore();
    ctx.lineWidth = Math.max(2, s * 0.035); ctx.strokeStyle = 'rgba(21,18,13,.85)'; ctx.stroke();
    ctx.restore();
  }
  function arrow(ctx, x, cy, h, fill) { // "→" (Lilita latin dosyasında yok; elle çizilir)
    const w = h * 1.1, t = h * 0.26;
    ctx.beginPath();
    ctx.moveTo(x, cy - t / 2); ctx.lineTo(x + w * 0.55, cy - t / 2); ctx.lineTo(x + w * 0.55, cy - h / 2);
    ctx.lineTo(x + w, cy); ctx.lineTo(x + w * 0.55, cy + h / 2); ctx.lineTo(x + w * 0.55, cy + t / 2); ctx.lineTo(x, cy + t / 2); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.fillStyle = fill; ctx.fill();
    return w;
  }

  /* ---------- vinyet (sabit, her karede aynı) ---------- */
  let vig = null;
  function vignette(ctx) {
    if (!vig) {
      vig = document.createElement('canvas'); vig.width = 1080; vig.height = 1920; const g = vig.getContext('2d');
      const gr = g.createRadialGradient(540, 900, 520, 540, 960, 1250);
      gr.addColorStop(0, 'rgba(10,8,5,0)'); gr.addColorStop(1, 'rgba(10,8,5,.22)');
      g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
    }
    ctx.drawImage(vig, 0, 0);
  }

  /* ---------- altyazı düzeni (timeline'dan bir kez) ---------- */
  let L = null;
  function layout(ctx, tl) {
    const S = C.sub; ctx.font = FONT(S.size);
    const width = (ws, size) => { ctx.font = FONT(size); const sp = ctx.measureText(' ').width; return ws.reduce((a, w) => a + ctx.measureText(w.w).width, 0) + sp * (ws.length - 1); };
    // en iyi satır bölme (bir öbek içinde): satır ≤4 kelime, genişliğe sığar; işlev kelimesiyle biten satır cezalı
    function splitPhrase(ws) {
      const n = ws.length, best = new Array(n + 1).fill(null); best[0] = { c: 0, cuts: [] };
      for (let j = 1; j <= n; j++) for (let k = 1; k <= S.maxWords && k <= j; k++) {
        const i = j - k; if (!best[i]) continue; const line = ws.slice(i, j);
        if (k > 1 && width(line, S.size) > S.maxW) continue;
        let c = best[i].c + 1 + (j < n && FUNC.has(clean(ws[j - 1].w)) ? 2.5 : 0);
        if (i > 0) c += 0.3 * Math.abs((j - i) - (best[i].cuts.length ? i - best[i].cuts[best[i].cuts.length - 1] : i));
        if (!best[j] || c < best[j].c) best[j] = { c, cuts: best[i].cuts.concat(i ? [i] : []) };
      }
      const cuts = best[n].cuts.concat([n]); const out = []; let a = 0; for (const b of cuts) { out.push(ws.slice(a, b)); a = b; } return out;
    }
    const pages = []; const sents = tl.sentences;
    sents.forEach((s, si) => {
      if (si === 0) return;                                   // 1. cümle kanca yazısıyla gösterilir
      const ws = s.words.map((w, k) => ({ w: w.w, t0: w.t0, t1: w.t1, k }));
      const phrases = []; let cur = [];
      ws.forEach(w => { cur.push(w); if (punct(w.w)) { phrases.push(cur); cur = []; } }); if (cur.length) phrases.push(cur);
      const lines = []; phrases.forEach((ph, pi) => splitPhrase(ph).forEach((ln, li, arr) => {
        const pv = lines[lines.length - 1];   // çok kısa öbekler tek satırda ("H, and K.")
        if (pv && pv.last && li === 0 && arr.length === 1 && pv.ws.length + ln.length <= 3 && width(pv.ws.concat(ln), S.size) <= S.maxW) pv.ws = pv.ws.concat(ln);
        else lines.push({ ws: ln, ph: pi, last: li === arr.length - 1 });
      }));
      // sayfalar: 1–2 satır; öbek ortasında sayfa kırmak cezalı
      const n = lines.length, best = new Array(n + 1).fill(null); best[0] = { c: 0, cuts: [] };
      for (let j = 1; j <= n; j++) for (let k = 1; k <= 2 && k <= j; k++) {
        const i = j - k; if (!best[i]) continue;
        const c = best[i].c + 1 + (j < n && !lines[j - 1].last ? 2 : 0);
        if (!best[j] || c < best[j].c) best[j] = { c, cuts: best[i].cuts.concat(i ? [i] : []) };
      }
      const cuts = best[n].cuts.concat([n]); let a = 0;
      cuts.forEach(b => {
        const ls = lines.slice(a, b).map(l => l.ws); a = b;
        let size = S.size; while (size > S.minSize && ls.some(l => width(l, size) > S.maxW)) size -= 2;
        pages.push({ si, lines: ls, size, t0: ls[0][0].t0, t1: ls[ls.length - 1].slice(-1)[0].t1, last: b === n });
      });
    });
    // görünme aralıkları
    const cues = tl.cues || {}, next = si => sents[si + 1];
    const quiet = [];                                        // altyazısız aralıklar
    if (cues.beep != null) { const ns = sents.find(s => s.t0 > cues.beep); quiet.push([cues.beep, ns ? ns.t0 : cues.beep + 1.4]); }
    if (cues.voiceEnd != null) quiet.push([cues.voiceEnd + C.sub.endFade, 1e9]);
    pages.forEach((p, k) => {
      p.show0 = p.t0 - S.lead;
      const nx = pages[k + 1];
      if (!p.last) { p.show1 = nx.t0 - S.lead; p.cont = true; }
      else { const ns = next(p.si); p.show1 = Math.min(p.t1 + S.hold, ns ? ns.t0 - S.lead - F : 1e9); p.cont = false; }
      if (k > 0 && p.show0 < pages[k - 1].show1) p.show0 = pages[k - 1].show1;
    });
    pages.forEach(p => quiet.forEach(([a, b]) => {
      if (p.show0 >= a && p.show0 < b) p.show0 = b;
      if (p.show0 < a && p.show1 > a) { p.show1 = a; p.cont = false; }
    }));
    // son cümle: ses biter bitmez kısa sönme (voiceEnd + 3 kare içinde tamamen yok)
    pages.forEach(p => { if (cues.voiceEnd != null && p.show1 > cues.voiceEnd + C.sub.endFade) p.show1 = cues.voiceEnd + C.sub.endFade; });
    return { pages: pages.filter(p => p.show1 > p.show0) };
  }

  function activeWord(sent, t) {
    const ws = sent.words;
    for (let k = 0; k < ws.length; k++) {
      const a = ws[k].t0 - F, b = k + 1 < ws.length ? ws[k + 1].t0 - F : ws[k].t1 + 0.12;
      if (t >= a && t < b) return k;
    }
    return -1;
  }

  function drawSubs(ctx, t, tl) {
    const S = C.sub;
    const p = L.pages.find(q => t >= q.show0 && t < q.show1); if (!p) return;
    const sent = tl.sentences[p.si], act = activeWord(sent, t);
    const uIn = TB.seg(t, p.show0, p.show0 + S.fadeIn);
    const fo = p.si === tl.sentences.length - 1 ? S.endFade : S.fadeOut;
    const aOut = p.cont ? 1 : TB.seg(p.show1 - t, 0, fo);
    const alpha = Math.min(TB.ease.outQ(uIn), aOut); if (alpha <= 0) return;
    const sc = 0.93 + 0.07 * TB.ease.outBack(uIn);     // yumuşak giriş, en çok ≈%1 taşma
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(S.cx, S.cy + (1 - uIn) * 10); ctx.scale(sc, sc);
    ctx.font = FONT(p.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const sp = ctx.measureText(' ').width, n = p.lines.length, lh = S.lh * p.size / S.size;
    p.lines.forEach((ln, li) => {
      const ws = ln.map(w => ctx.measureText(w.w).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ln.length - 1);
      let x = -tw / 2; const y = (li - (n - 1) / 2) * lh + p.size * 0.04;
      ln.forEach((w, k) => { outlined(ctx, w.w, x, y, p.size, w.k === act ? P.hazard : P.paper, S.stroke, 5); x += ws[k] + sp; });
    });
    ctx.restore();
  }

  /* ---------- kanca: 1. cümle ortada büyük, kelimeler sesle düşer ---------- */
  let H = null;
  function hookLayout(ctx, tl) {
    const s = tl.sentences[0], Hc = C.hook, OBJ = /^(me|him|her|it|us|them|you)$/;
    const ws = s.words.map((w, k) => ({ w: w.w, t0: w.t0, t1: w.t1, k }));
    const lw = l => ctx.measureText(l.map(x => x.w).join(' ')).width;
    // L satıra en dengeli bölme: en uzun satır + ceza (nesne zamiri fiilinden, satır sonu işlev kelimesinden ayrılmaz)
    function best(L) {
      let res = null; const n = ws.length;
      (function rec(i, cuts) {
        if (cuts.length === L - 1) {
          const ls = []; let a = 0; for (const c of cuts.concat([n])) { ls.push(ws.slice(a, c)); a = c; }
          let w = Math.max(...ls.map(lw)), raw = w;
          for (const c of cuts) {
            if (OBJ.test(clean(ws[c].w))) w += 400;
            if (FUNC.has(clean(ws[c - 1].w)) && !OBJ.test(clean(ws[c - 1].w))) w += 250;
          }
          if (!res || w < res.w - 1) res = { w, raw, lines: ls };
          return;
        }
        for (let c = i + 1; c <= n - (L - 1 - cuts.length); c++) rec(c, cuts.concat([c]));
      })(0, []);
      return res;
    }
    let size = Hc.size, pick = null;
    for (; size >= 56 && !pick; size -= 4) {
      ctx.font = FONT(size); const lh = Hc.lh * size / Hc.size;
      for (let L = 1; L <= Math.min(4, ws.length); L++) {
        if (L * lh > Hc.band) break;
        const r = best(L); if (r && r.raw <= Hc.maxW) { pick = { lines: r.lines, size }; break; }
      }
    }
    if (!pick) { size = 56; ctx.font = FONT(size); pick = { lines: best(Math.min(4, ws.length)).lines, size }; }
    const ns = tl.sentences[1];
    return { s, lines: pick.lines, size: pick.size, show1: Math.min(s.t1 + C.sub.hold + 0.1, ns ? ns.t0 - C.sub.lead - F : 1e9) };
  }
  function drawHook(ctx, t, tl) {
    const Hc = C.hook, h = H; if (t >= h.show1) return;
    const aOut = TB.seg(h.show1 - t, 0, C.sub.fadeOut); if (aOut <= 0) return;
    const act = activeWord(h.s, t);
    ctx.save(); ctx.font = FONT(h.size); ctx.textBaseline = 'middle';
    const sp = ctx.measureText(' ').width, lh = Hc.lh * h.size / Hc.size, n = h.lines.length;
    h.lines.forEach((ln, li) => {
      const ws = ln.map(w => ctx.measureText(w.w).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ln.length - 1);
      let x = Hc.cx - tw / 2; const y = Hc.cy + (li - (n - 1) / 2) * lh;
      ln.forEach((w, k) => {
        // 0. karede cümlenin tamamı görünür; okunan kelime sarıya döner ve 3 kare hafifçe kalkar
        const t0 = w.t0 - C.sub.lead, u = TB.seg(t, t0, t0 + 3 * F), done = t >= t0 ? 1 : 0;
        ctx.save(); ctx.globalAlpha = aOut;
        const dy = -8 * Math.sin(Math.PI * u) * done;
        outlined(ctx, w.w, x, y + dy, h.size, w.k === act ? P.hazard : P.paper, 10, 7);
        ctx.restore();
        x += ws[k] + sp;
      });
    });
    ctx.restore();
  }

  /* ---------- bölüm etiketi → "1/10" rozeti, dizi adı ---------- */
  function drawLabel(ctx, t, tl) {
    const Lb = C.label, total = tl.parts || 10;
    const label = `PART ${tl.part} · ${tl.title}`, badge = `${tl.part}/${total}`;
    ctx.font = FONT(Lb.size); const lw = ctx.measureText(label).width + Lb.pad * 2;
    ctx.font = FONT(Lb.badgeSize); const bw = ctx.measureText(badge).width + 30;
    const u = TB.ease.ioC(TB.seg(t, Lb.until, Lb.until + Lb.morph));
    const w = TB.lerp(lw, bw, u), h = TB.lerp(Lb.h, Lb.badgeH, u), x = Lb.x, y = Lb.y;
    // dizi adı (altında, aynı 2,5 sn; yukarı kayarak söner)
    const ta = 1 - TB.seg(t, Lb.until, Lb.until + Lb.morph * 0.7);
    if (ta > 0) {
      ctx.save(); ctx.globalAlpha = ta; ctx.font = FONT(52); ctx.textBaseline = 'middle';
      outlined(ctx, 'TWO BEEPS', x + 2, y + Lb.h + 44 - 14 * (1 - ta), 52, P.paper, 7, 4); ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = TB.lerp(1, 0.92, u);
    ctx.fillStyle = 'rgba(21,18,13,.55)'; rr(ctx, x + 3, y + 5, w, h, h * 0.22); ctx.fill();   // gölge
    rr(ctx, x, y, w, h, h * 0.22); ctx.fillStyle = P.hazard; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.save(); rr(ctx, x, y, w, h, h * 0.22); ctx.clip(); stripes(ctx, x, y + h - 9, w, 9, 9); ctx.restore();
    ctx.fillStyle = P.ink; ctx.textBaseline = 'middle';
    if (u < 0.6) { ctx.save(); ctx.globalAlpha *= 1 - TB.seg(u, 0, 0.5); ctx.font = FONT(Lb.size); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillText(label, x + Lb.pad, y + h / 2 - 3); ctx.restore(); }
    if (u > 0.4) { ctx.save(); ctx.globalAlpha *= TB.seg(u, 0.5, 1); ctx.font = FONT(Lb.badgeSize); ctx.textAlign = 'center'; ctx.fillText(badge, x + w / 2, y + h / 2 - 3); ctx.restore(); }
    ctx.restore();
  }

  /* ---------- "Previously" (2–10. bölümler): tl.prev, 0. kareden ~2,2 sn; etiketin altında küçük koyu bant ---------- */
  function wrap(ctx, text, maxW) {           // kelime kaydırma (ctx.font önceden ayarlı)
    const out = [[]]; text.split(/\s+/).forEach(w => { const l = out[out.length - 1], tr = l.concat([w]).join(' ');
      if (l.length && ctx.measureText(tr).width > maxW) out.push([w]); else l.push(w); });
    return out.map(l => l.join(' '));
  }
  function fitLines(ctx, text, maxW, size, minSize, maxLines) {
    for (; size > minSize; size -= 2) { ctx.font = FONT(size); const ls = wrap(ctx, text, maxW); if (ls.length <= maxLines && ls.every(l => ctx.measureText(l).width <= maxW)) return { size, lines: ls }; }
    ctx.font = FONT(minSize); return { size: minSize, lines: wrap(ctx, text, maxW) };
  }
  function drawPrev(ctx, t, tl) {
    const R = C.prev; if (!tl.prev || t >= R.until + R.fade) return;
    const a = 1 - TB.seg(t, R.until, R.until + R.fade);
    const text = String(tl.prev).replace(/^Previously:\s*/i, '');
    const f = fitLines(ctx, text, R.w - 2 * R.pad, R.size, 32, 2), lh = f.size * 1.12;
    const h = R.pad * 0.8 + R.tag + 8 + f.lines.length * lh + R.pad * 0.6;
    ctx.save(); ctx.globalAlpha = a;
    rr(ctx, R.x, R.y, R.w, h, 18); ctx.fillStyle = 'rgba(10,8,5,.62)'; ctx.fill();
    ctx.textBaseline = 'middle'; ctx.font = FONT(R.tag); ctx.fillStyle = P.hazard;
    ctx.fillText('PREVIOUSLY', R.x + R.pad, R.y + R.pad * 0.8 + R.tag / 2);
    ctx.font = FONT(f.size);
    f.lines.forEach((l, i) => outlined(ctx, l, R.x + R.pad, R.y + R.pad * 0.8 + R.tag + 8 + lh * (i + 0.5), f.size, P.paper, 5, 3));
    ctx.restore();
  }

  /* ---------- köşe simgesi ve bitiş kartı ---------- */
  function endLayout(ctx, tl) {
    const nx = tl.next || {};
    return { a: `PART ${nx.part} · `, b: nx.title || '', follow: 'Follow · Part 2 is next'.replace('2', nx.part),
      search: 'Search "Demolition Master: Tower Blast"', small: 'iPhone · free' };
  }
  const SORU_DUR = 4.7;     // YAYIN.md: soru kartı ekranda 4,7 sn; daha kısa kartta satır gecikmeleri orantılı kısalır
  const cardScale = tl => Math.min(1, (tl.duration - tl.cues.endCard) / SORU_DUR);
  const iconDelay = tl => tl.soru ? C.soru.dGame * cardScale(tl) : 0;
  function drawCornerIcon(ctx, t, tl) {
    const I = C.icon, ec = (tl.cues || {}).endCard; if (t < I.from) return;
    if (ec != null && t >= ec + iconDelay(tl)) return;       // bitiş kartında büyük simgeye dönüşür (drawEnd)
    icon(ctx, I.x, I.y, I.s, I.alpha * TB.ease.outQ(TB.seg(t, I.from, I.from + I.fade)));
  }
  /* Bitiş kartı: cues.endCard'dan sona. Tek kart, x 60–890, y 752–1400 (Shorts arayüzüne ve üst üçteki
     uyarı ışığına değmez); sahne kararmaz, kart yarı saydam. Giriş 6 kare. */
  function drawEnd(ctx, t, tl) {
    const ec = (tl.cues || {}).endCard; if (ec == null || t < ec) return;
    if (tl.soru || !tl.next) return drawSoru(ctx, t, tl);
    const E = endLayout(ctx, tl), K = C.end, k = (a, b) => TB.seg(t, ec + a * F, ec + b * F);
    const cx = (K.x0 + K.x1) / 2, kw = K.x1 - K.x0, kh = K.y1 - K.y0;
    const u0 = TB.ease.outC(k(0, 4));
    ctx.save(); ctx.globalAlpha = u0;
    ctx.translate(cx, K.y0 + kh / 2); const sc = TB.lerp(0.95, 1, u0); ctx.scale(sc, sc); ctx.translate(-cx, -(K.y0 + kh / 2));
    ctx.fillStyle = 'rgba(21,18,13,.45)'; rr(ctx, K.x0 + 4, K.y0 + 8, kw, kh, 30); ctx.fill();
    rr(ctx, K.x0, K.y0, kw, kh, 30); ctx.fillStyle = 'rgba(21,18,13,.78)'; ctx.fill();
    ctx.save(); rr(ctx, K.x0, K.y0, kw, kh, 30); ctx.clip(); stripes(ctx, K.x0, K.y1 - 18, kw, 18, 16);
    ctx.globalAlpha *= .55; stripes(ctx, K.x0 + 70, K.yDiv - 3, kw - 140, 6, 6); ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(245,178,28,.6)'; rr(ctx, K.x0, K.y0, kw, kh, 30); ctx.stroke();
    ctx.restore();
    const maxW = kw - 70;
    // PART 2 · THE ANT →
    { const u = TB.ease.outC(k(1, 6)); let size = 90; ctx.font = FONT(size);
      const tw0 = s => { ctx.font = FONT(s); return ctx.measureText(E.a + E.b).width + 18 + s * 0.66 * 1.1; };
      while (tw0(size) > maxW && size > 60) size -= 2;
      const tw = tw0(size); let x = cx - tw / 2; const y = K.yTitle + (1 - u) * 16;
      ctx.save(); ctx.globalAlpha = u; ctx.textBaseline = 'middle'; ctx.font = FONT(size);
      outlined(ctx, E.a, x, y, size, P.paper, 9, 6); x += ctx.measureText(E.a).width;
      outlined(ctx, E.b, x, y, size, P.hazard, 9, 6); x += ctx.measureText(E.b).width + 18;
      arrow(ctx, x, y + 2, size * 0.66, P.hazard); ctx.restore(); }
    // Follow · Part 2 is next
    { const u = TB.ease.outC(k(2, 6)); ctx.save(); ctx.globalAlpha = u; ctx.font = FONT(56); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      outlined(ctx, E.follow, cx, K.yFollow + (1 - u) * 12, 56, P.paper, 7, 4); ctx.restore(); }
    // oyun: simge köşeden uçup büyür, altında aranacak tam ad ve küçük satır
    { const u = TB.ease.ioC(k(0, 6)), I = C.icon, s = K.icon;
      icon(ctx, TB.lerp(I.x, cx - s / 2, u), TB.lerp(I.y, K.yIcon, u), TB.lerp(I.s, s, u), TB.lerp(I.alpha, 1, u));
      const ua = TB.ease.outC(k(2, 6));
      let size = 52; ctx.font = FONT(size); while (ctx.measureText(E.search).width > maxW && size > 34) { size -= 2; ctx.font = FONT(size); }
      ctx.save(); ctx.globalAlpha = ua; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      outlined(ctx, E.search, cx, K.ySearch + (1 - ua) * 10, size, P.paper, 6, 4);
      ctx.font = FONT(38); outlined(ctx, E.small, cx, K.ySmall + (1 - ua) * 10, 38, P.hazard, 5, 3);
      ctx.restore(); }
  }

  /* Soru kartı (YAYIN.md "Kart"): kutu x 60–890, y 640–1400; satırlar veriden (tl.soru: tur, baslik, durum, a, b, satir, cip).
     Sırayla: başlık + durum (0), A/B çipleri (0,2), çağrı satırı (1,2), sonraki bölüm + Follow ve oyun satırı (1,8).
     Sonraki bölüm yoksa (10. bölüm) o satır dizi kapanışıdır ve oyun satırı büyür. tl.soru yoksa yalnız kapanış + oyun. */
  function drawSoru(ctx, t, tl) {
    const Q = C.soru, S = tl.soru || {}, ec = tl.cues.endCard, sc = cardScale(tl);
    const at = (d, n) => TB.ease.outC(TB.seg(t, ec + d * sc, ec + d * sc + (n || 6) * F));
    const cx = (Q.x0 + Q.x1) / 2, kw = Q.x1 - Q.x0, kh = Q.y1 - Q.y0, maxW = kw - 70;
    // kutu (4 kare)
    const u0 = at(0, 4);
    ctx.save(); ctx.globalAlpha = u0;
    ctx.translate(cx, Q.y0 + kh / 2); const z = TB.lerp(0.95, 1, u0); ctx.scale(z, z); ctx.translate(-cx, -(Q.y0 + kh / 2));
    ctx.fillStyle = 'rgba(21,18,13,.45)'; rr(ctx, Q.x0 + 4, Q.y0 + 8, kw, kh, 30); ctx.fill();
    rr(ctx, Q.x0, Q.y0, kw, kh, 30); ctx.fillStyle = 'rgba(21,18,13,.80)'; ctx.fill();
    ctx.save(); rr(ctx, Q.x0, Q.y0, kw, kh, 30); ctx.clip(); stripes(ctx, Q.x0, Q.y1 - 18, kw, 18, 16);
    ctx.globalAlpha *= .5; stripes(ctx, Q.x0 + 70, Q.yDiv - 3, kw - 140, 6, 6); ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(245,178,28,.6)'; rr(ctx, Q.x0, Q.y0, kw, kh, 30); ctx.stroke();
    ctx.restore();
    const txt = (s, x, y, size, fill, a, align, st) => { ctx.save(); ctx.globalAlpha = a; ctx.font = FONT(size); ctx.textBaseline = 'middle'; ctx.textAlign = align || 'center'; outlined(ctx, s, x, y, size, fill, st || Math.max(4, size * .1), Math.max(3, size * .06)); ctx.restore(); };
    const fit1 = (s, size, w, min) => { for (; size > (min || 30); size -= 2) { ctx.font = FONT(size); if (ctx.measureText(s).width <= w) break; } return size; };
    if (S.durum) {
      const a = at(0, 4);
      txt(S.baslik || 'WHAT WOULD YOU DO?', cx, Q.yHead, 40, P.hazard, a);
      const f = fitLines(ctx, S.durum, maxW, 60, 40, 2), lh = f.size * 1.05;
      f.lines.forEach((l, i) => txt(l, cx, Q.yDurum + (i - (f.lines.length - 1) / 2) * lh + (1 - a) * 10, f.size, P.paper, a));
    }
    // çipler: A/B ya da (açık soru) iki bilgi satırı
    const chips = S.a || S.b ? [['A', S.a], ['B', S.b]] : (S.cip || []).map(c => [null, c]);
    chips.forEach(([L, s], i) => {
      if (!s) return; const a = at(Q.dChips + i * 0.08), y = Q.yChip[i], w = Q.chipW, h = Q.chipH, x = cx - w / 2 + (1 - a) * 30;
      ctx.save(); ctx.globalAlpha = a;
      rr(ctx, x, y, w, h, 22); ctx.fillStyle = 'rgba(241,232,212,.10)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = P.hazard; ctx.stroke();
      let tx = x + 28;
      if (L) { rr(ctx, x + 12, y + 12, h - 24, h - 24, 14); ctx.fillStyle = P.hazard; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
        ctx.font = FONT(50); ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(L, x + h / 2, y + h / 2 + 1); tx = x + h + 12; }
      const size = fit1(s, 50, x + w - 24 - tx, 30);
      ctx.restore();
      txt(s, L ? tx : cx + (1 - a) * 30, y + h / 2, size, P.paper, a, L ? 'left' : 'center');
    });
    if (S.satir) { const a = at(Q.dSatir); txt(S.satir, cx, Q.ySatir, fit1(S.satir, 40, maxW, 28), P.paper, a); }
    // sonraki bölüm + Follow, ya da dizi kapanışı
    const big = !tl.next, aN = at(Q.dGame);
    if (tl.next) {
      const A = `PART ${tl.next.part} · `, B = tl.next.title, Fw = 'Follow';
      let size = 68; const tw0 = s => { ctx.font = FONT(s); return ctx.measureText(A + B).width + 14 + s * .66 * 1.1 + 24 + ctx.measureText(Fw).width; };
      while (tw0(size) > maxW && size > 44) size -= 2;
      let x = cx - tw0(size) / 2; const y = Q.yNext + (1 - aN) * 12;
      ctx.save(); ctx.globalAlpha = aN; ctx.font = FONT(size); ctx.textBaseline = 'middle';
      outlined(ctx, A, x, y, size, P.paper, 8, 5); x += ctx.measureText(A).width;
      outlined(ctx, B, x, y, size, P.hazard, 8, 5); x += ctx.measureText(B).width + 14;
      x += arrow(ctx, x, y + 2, size * .66, P.hazard) + 24; ctx.font = FONT(size);
      outlined(ctx, Fw, x, y, size, P.paper, 8, 5); ctx.restore();
    } else txt('TWO BEEPS · THE END', cx, Q.yNext + (1 - aN) * 12, 64, P.hazard, aN);
    // oyun satırı: simge (köşeden uçar) + Search + "Demolition Master: Tower Blast" + iPhone · free
    { const s = big ? 128 : 96, gap = 22, nm = '"Demolition Master: Tower Blast"';
      const n1 = big ? 40 : 32, n3 = big ? 40 : 34; let n2 = big ? 56 : 48;
      n2 = fit1(nm, n2, maxW - s - gap, 30);
      ctx.font = FONT(n2); const bw = s + gap + ctx.measureText(nm).width, x0 = cx - bw / 2;
      const yc = big ? Q.yGameBig : Q.yGame, ui = TB.ease.ioC(TB.seg(t, ec + iconDelay(tl), ec + iconDelay(tl) + 6 * F)), I = C.icon;
      icon(ctx, TB.lerp(I.x, x0, ui), TB.lerp(I.y, yc - s / 2, ui), TB.lerp(I.s, s, ui), TB.lerp(I.alpha, 1, ui));
      const tx = x0 + s + gap, lh = (n1 + n2 + n3) * 0.5;
      txt('Search', tx, yc - lh + n1 * .2, n1, P.hazard, aN, 'left', 4);
      txt(nm, tx, yc + n2 * .02, n2, P.paper, aN, 'left');
      txt('iPhone · free', tx, yc + lh - n3 * .2, n3, P.hazard, aN, 'left', 4);
    }
  }

  TB.overlay(function (ctx, t, tl) {
    if (!L) { L = layout(ctx, tl); H = hookLayout(ctx, tl); TB.paket = { pages: L.pages, hook: H, C }; }
    vignette(ctx);
    drawHook(ctx, t, tl);
    drawSubs(ctx, t, tl);
    drawPrev(ctx, t, tl);
    drawLabel(ctx, t, tl);
    drawCornerIcon(ctx, t, tl);
    drawEnd(ctx, t, tl);
  });
})(window);
