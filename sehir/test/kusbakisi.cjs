/* Kuşbakışı harita: yükseklik gölgeli arazi + eş yükselti eğrileri + su + nesneler + tasarım ilkelleri + ilgi noktaları + ölçek + ızgara.
   Kullanım:
     node test/kusbakisi.cjs [--merkez x,z | --merkez dogus | --merkez <nokta id>] [--genislik 2000] [--bolge b001] [--tasarim deneme|yok]
                             [--egim] [--sade] [--nesnesiz] [--boyut 1600] [--es 5] [--cikti harita.png]
   --bolge     : görünümü o bölgenin sınır kutusuna (+%8 pay) oturtur (merkez/genişlik yerine)
   --egim      : eğim haritası (yeşil < %6 inşa edilebilir düz · sarı-yeşil < %20 · sarı < %45 · turuncu < %100 · kırmızı > %100 = 45°'den dik, geçilmez sayılır)
   --sade      : tasarım ilkellerinin çizgi/alan çizimleri olmadan (ilgi noktaları kalır)
   --nesnesiz  : ağaç/kaya noktaları olmadan (çok daha hızlı; 3 km'den geniş haritada kendiliğinden)
   --es        : eş yükselti aralığı (m); verilmezse genişliğe göre seçilir
   Renkler: su açık mavi = sığ (yürünür, < 1,3 m), koyu mavi = derin (yüzülür); kırmızı tarama = 45°'den dik yamaç.
   Nesneler: koyu yeşil = yapraklı ağaç, mavi-yeşil = çam, açık yeşil küçük = çalı, gri = kaya, koyu gri kare = düz tepeli (tırmanılır) kaya, mor = öbürleri.
   Koordinat: +x doğu (sağ), −z kuzey (yukarı). Kenardaki sayılar dünya koordinatıdır (m). */
const { ac, arglar, sayilar } = require('./ortak.cjs'); const fs = require('fs');
(async () => {
  const a = arglar(process.argv), N = +(a.boyut || 1600), cikti = a.cikti || 'kusbakisi.png', t0 = Date.now();
  const o = await ac({ boyut: [640, 360], tasarim: a.tasarim });
  try {
    const sonuc = await o.pg.evaluate(cizKusbakisi, { merkez: a.merkez || 'dogus', genislik: +(a.genislik || 2000), bolge: a.bolge || null, N, egim: !!a.egim, sade: !!a.sade, nesnesiz: !!a.nesnesiz, es: a.es ? +a.es : 0 });
    fs.writeFileSync(cikti, Buffer.from(sonuc.png.split(',')[1], 'base64')); delete sonuc.png;
    console.log(JSON.stringify(Object.assign(sonuc, { cikti, sure_sn: +((Date.now() - t0) / 1000).toFixed(1), hata: o.hatalar.slice(0, 5) })));
  } finally { await o.kapat(); }
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });

function cizKusbakisi(A) {
  const SO = window.SO, W = SO.world, TS = SO.tasarim, TA = window.TA, N = A.N;
  let cx, cz, gen;
  if (A.bolge) { const B = TA.bolge(A.bolge); cx = (B.x0 + B.x1) / 2; cz = (B.z0 + B.z1) / 2; gen = Math.max(B.x1 - B.x0, B.z1 - B.z0) * 1.08; } else { const m = TA.nokta(A.merkez); cx = m.x; cz = m.z; gen = A.genislik; }
  const x0 = cx - gen / 2, z0 = cz - gen / 2, mpp = gen / N, G = Math.round(N / 2) + 1, ga = gen / (G - 1);
  // yükseklik ızgarası (2 pikselde bir örnek), sonra piksel başına çift doğrusal
  const t1 = performance.now(), H = new Float32Array(G * G); let hmin = 1e9, hmax = -1e9;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const h = W.yukseklikF(x0 + i * ga, z0 + j * ga); H[j * G + i] = h; if (h < hmin) hmin = h; if (h > hmax) hmax = h; }
  const tH = performance.now() - t1;
  const es = A.es || (gen <= 500 ? 1 : gen <= 1200 ? 2 : gen <= 3200 ? 5 : gen <= 8000 ? 10 : 50);
  const ML = 64, MT = 30, MR = 14, MB = 44, cv = document.createElement('canvas'); cv.width = N + ML + MR; cv.height = N + MT + MB; const g = cv.getContext('2d');
  g.fillStyle = '#f4efe2'; g.fillRect(0, 0, cv.width, cv.height);
  const im = g.createImageData(N, N), D = im.data, P = new Float32Array(N * N);
  for (let y = 0; y < N; y++) { const v = y / (N - 1) * (G - 1), j = Math.min(G - 2, Math.floor(v)), fv = v - j; for (let x = 0; x < N; x++) { const u = x / (N - 1) * (G - 1), i = Math.min(G - 2, Math.floor(u)), fu = u - i, q = j * G + i; P[y * N + x] = (H[q] * (1 - fu) + H[q + 1] * fu) * (1 - fv) + (H[q + G] * (1 - fu) + H[q + G + 1] * fu) * fv; } }
  const RAMPA = [[0, 168, 190, 122], [12, 146, 174, 100], [35, 176, 184, 112], [70, 198, 176, 122], [130, 176, 146, 112], [220, 172, 164, 156], [320, 244, 244, 244]];
  const renk = h => { let k = 0; while (k < RAMPA.length - 2 && h > RAMPA[k + 1][0]) k++; const a = RAMPA[k], b = RAMPA[k + 1], t = Math.max(0, Math.min(1, (h - a[0]) / (b[0] - a[0]))); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]; };
  const lx = -.5, lz = -.5, ly = .707; let duzAlan = 0, kara = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const q = y * N + x, h = P[q], xa = x > 0 ? x - 1 : x, xb = x < N - 1 ? x + 1 : x, ya = y > 0 ? y - 1 : y, yb = y < N - 1 ? y + 1 : y;
    const dx = (P[y * N + xb] - P[y * N + xa]) / ((xb - xa) * mpp), dz = (P[yb * N + x] - P[ya * N + x]) / ((yb - ya) * mpp), eg = Math.hypot(dx, dz), nl = 1 / Math.sqrt(dx * dx + dz * dz + 1);
    let s = (-dx * lx - dz * lz + ly) * nl; s = .9 + (s - .707) * 1.0; s = s < .58 ? .58 : s > 1.18 ? 1.18 : s; let r, gg, b;
    if (h < 0) { const d = -h; if (d < .25) { r = 172; gg = 214; b = 222; } else if (d < 1.3) { r = 118; gg = 190; b = 216; } else { const t = Math.min(1, (d - 1.3) / 8); r = 76 - 26 * t; gg = 138 - 36 * t; b = 184 - 34 * t; } s = .9 + (s - .9) * .25; }
    else { kara++; if (eg < .06) duzAlan++;
      if (A.egim) { if (eg < .06) { r = 96; gg = 176; b = 92; } else if (eg < .2) { r = 178; gg = 206; b = 104; } else if (eg < .45) { r = 240; gg = 222; b = 98; } else if (eg < 1) { r = 238; gg = 150; b = 62; } else { r = 208; gg = 54; b = 48; } s = .85 + (s - .85) * .45; }
      else { const c = renk(h); r = c[0]; gg = c[1]; b = c[2]; if (eg > 1 && ((x + y) & 3) < 2) { r = 214; gg = 70; b = 56; } } }
    // eş yükselti: komşuyla farklı basamaktaysa çizgi
    if (h >= 0) { const k0 = Math.floor(h / es), kr = Math.floor(P[y * N + xb] / es), kd = Math.floor(P[yb * N + x] / es); if (k0 !== kr || k0 !== kd) { const kk = Math.max(k0, kr, kd), ana = kk % 5 === 0, f = ana ? .5 : .78; r *= f; gg *= f; b *= f; } }
    else if (P[y * N + xb] >= 0 || P[yb * N + x] >= 0) { r = 30; gg = 80; b = 130; s = 1; }
    const o = q * 4; D[o] = Math.min(255, r * s); D[o + 1] = Math.min(255, gg * s); D[o + 2] = Math.min(255, b * s); D[o + 3] = 255; }
  g.putImageData(im, ML, MT);
  const X = x => ML + (x - x0) / mpp, Z = z => MT + (z - z0) / mpp;
  g.save(); g.beginPath(); g.rect(ML, MT, N, N); g.clip();
  // ızgara
  const adimlar = [25, 50, 100, 250, 500, 1000, 2000, 5000], ia = adimlar.find(v => gen / v <= 10) || 5000;
  g.strokeStyle = 'rgba(21,18,13,.22)'; g.lineWidth = 1; g.beginPath(); for (let v = Math.ceil(x0 / ia) * ia; v <= x0 + gen; v += ia) { g.moveTo(X(v) + .5, MT); g.lineTo(X(v) + .5, MT + N); } for (let v = Math.ceil(z0 / ia) * ia; v <= z0 + gen; v += ia) { g.moveTo(ML, Z(v) + .5); g.lineTo(ML + N, Z(v) + .5); } g.stroke();
  // nesneler
  let nesne = [], tN = 0; if (!A.nesnesiz && gen <= 3200) { const t2 = performance.now(); nesne = TA.tara(x0, z0, x0 + gen, z0 + gen); tN = performance.now() - t2; }
  const sayim = {}; for (const n of nesne) { sayim[n.tur] = (sayim[n.tur] || 0) + 1; const px = X(n.x), pz = Z(n.z), t = n.tur; let r, c, kare = false;
    if (t.startsWith('yaprakli') || t === 'devAgac') { r = 2.6 * n.s; c = '#1f4f1c'; } else if (t.startsWith('cam')) { r = 2.0 * n.s; c = '#0f5f6b'; } else if (t === 'cali') { r = 1.0 * n.s; c = '#9fd63a'; } else if (t.startsWith('kaya')) { r = 1.3 * n.s; c = '#5a5652'; } else if (t.startsWith('duz')) { r = 1.5 * n.s; c = '#2a2624'; kare = true; } else { r = 1.3 * n.s; c = '#b03fc0'; }
    r = Math.max(t === 'cali' ? 1.3 : 2, r / mpp); g.fillStyle = c; if (kare) g.fillRect(px - r, pz - r, 2 * r, 2 * r); else { g.beginPath(); g.arc(px, pz, r, 0, 6.2832); g.fill(); } if (r > 3) { g.strokeStyle = 'rgba(21,18,13,.55)'; g.lineWidth = 1; if (kare) g.strokeRect(px - r, pz - r, 2 * r, 2 * r); else g.stroke(); } }
  // tasarım ilkelleri
  const yazi = (s, x, y, renk, boy, hiza) => { g.font = '600 ' + (boy || 12) + 'px system-ui, sans-serif'; g.textAlign = hiza || 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,253,245,.9)'; g.lineWidth = 3.5; g.strokeText(s, x, y); g.fillStyle = renk || '#15120d'; g.fillText(s, x, y); };
  const yol = (pts, kapali) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); if (kapali) g.closePath(); };
  const alanCiz = (al, renk, dolgu, kesik) => { g.strokeStyle = renk; g.lineWidth = 1.6; g.setLineDash(kesik || []); let m; if (al.daire) { g.beginPath(); g.arc(X(al.daire[0]), Z(al.daire[1]), al.daire[2] / mpp, 0, 6.2832); m = [al.daire[0], al.daire[1]]; } else { const p = al.kutu ? [[al.kutu[0], al.kutu[1]], [al.kutu[2], al.kutu[1]], [al.kutu[2], al.kutu[3]], [al.kutu[0], al.kutu[3]]] : al; yol(p, true); m = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; } if (dolgu) { g.fillStyle = dolgu; g.fill(); } g.stroke(); g.setLineDash([]); return m; };
  const SR = { tepe: '#8a4b12', sirt: '#6b3410', vadi: '#356a8a', oluk: '#356a8a', duzluk: '#b8860b', plato: '#b8860b', ucurum: '#b02222', teras: '#8a6a12', cukur: '#55606a', gol: '#0d5c9c', nehir: '#0d5c9c', patika: '#7a4a1a', kiyi: '#0d7a8a', kaya_cikinti: '#4a4a4a' };
  const AR = { koru: ['#1d6b1d', 'rgba(40,140,40,.10)'], aciklik: ['#9aa832', 'rgba(230,240,120,.14)'], taslik: ['#555', 'rgba(90,90,90,.12)'], cali_alani: ['#6a9a2a', 'rgba(130,190,60,.10)'], serpme: ['#7a3a9a', 'rgba(150,80,190,.08)'], yasak: ['#c02a2a', 'rgba(210,60,60,.08)'], zemin: ['#8a6a3a', 'rgba(150,110,60,.12)'], kaynak: ['#c06a00', 'rgba(230,140,20,.10)'] };
  const bolgeler = TS ? TS.bolgeler : [];
  for (const B of bolgeler) { alanCiz(B.sinir, '#15120d', null, [10, 6]); if (A.sade) continue;
    for (const a of B.A) { const c = AR[a.tip] || AR.serpme, m = alanCiz(a.alan, c[0], c[1], [5, 3]); yazi(a.tip + (a.ad ? ' ' + a.ad : '') + ' ·' + a.katman[0] + a.no, X(m[0]), Z(m[1]), c[0], 11, 'center'); }
    for (const p of B.S) { const c = SR[p.tip] || '#000', et = p.tip + (p.ad ? ' ' + p.ad : '') + ' ·' + p.katman[0] + p.no; let m;
      if (p.cizgi) { for (const L of [p.cizgi].concat(p.kollar || [])) { yol(L, false); g.strokeStyle = c; g.lineWidth = p.tip === 'patika' ? 2.2 : 2; g.setLineDash(p.tip === 'patika' ? [7, 4] : p.tip === 'nehir' || p.tip === 'kiyi' ? [] : [2, 3]); g.stroke(); g.setLineDash([]); }
        if (p.tip === 'ucurum' || p.tip === 'kiyi') { const L = p.cizgi; for (let i = 0; i < L.length - 1; i++) { const dx = L[i + 1][0] - L[i][0], dz = L[i + 1][1] - L[i][1], l = Math.hypot(dx, dz), n = Math.max(1, Math.floor(l / (mpp * 26))); for (let k = 0; k < n; k++) { const t = (k + .5) / n, bx = X(L[i][0] + dx * t), bz = Z(L[i][1] + dz * t), sx = -dz / l * p.yon, sz = dx / l * p.yon; g.beginPath(); g.moveTo(bx, bz); g.lineTo(bx + sx * 7, bz + sz * 7); g.strokeStyle = c; g.lineWidth = 2; g.stroke(); } } } // çentikler: uçurumda yüksek yana, kıyıda suya bakar
        if (p.tip === 'nehir') for (const s of p.sg) { g.beginPath(); g.arc(X(s.x), Z(s.z), 6, 0, 6.2832); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.strokeStyle = c; g.lineWidth = 1.5; g.stroke(); }
        m = p.cizgi[Math.floor((p.cizgi.length - 1) / 2)]; g.fillStyle = c; g.beginPath(); g.arc(X(p.cizgi[0][0]), Z(p.cizgi[0][1]), 3, 0, 6.2832); g.fill(); }
      else if (p.alan) m = alanCiz(p.alan, c, null, [3, 3]);
      else if (p.merkez) { const r = Array.isArray(p.yaricap) ? p.yaricap : [p.yaricap, p.yaricap]; g.save(); g.translate(X(p.merkez[0]), Z(p.merkez[1])); g.rotate((p.aci || 0) * Math.PI / 180); g.beginPath(); g.ellipse(0, 0, r[0] / mpp, r[1] / mpp, 0, 0, 6.2832); g.restore(); g.strokeStyle = c; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]); m = p.merkez; }
      if (m) yazi(et, X(m[0]) + 5, Z(m[1]) - 8, c, 11); }
    for (const n of B.nesneler) if (!n.oto) { const px = X(n.x), pz = Z(n.z); g.beginPath(); g.moveTo(px, pz - 6); g.lineTo(px + 5, pz + 4); g.lineTo(px - 5, pz + 4); g.closePath(); g.fillStyle = '#b03fc0'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); yazi(n.tur + (n.s ? ' ×' + n.s : ''), px + 8, pz, '#7a2a8a', 10); }
  }
  // yükseklik noktaları (ızgara kesişimlerinde)
  if (gen / ia <= 10) for (let v = Math.ceil(z0 / ia) * ia; v <= z0 + gen; v += ia) for (let u = Math.ceil(x0 / ia) * ia; u <= x0 + gen; u += ia) { const h = W.yukseklikF(u, v); yazi(h < 0 ? h.toFixed(1) : String(Math.round(h)), X(u) + 3, Z(v) - 7, h < 0 ? '#0b3c6a' : 'rgba(60,40,20,.85)', 10); }
  // ilgi noktaları
  const NR = { dogus: '#e5482d', yerlesim: '#d98a00', isaret: '#8a2ac0', manzara: '#1a7ac0', kaynak: '#2a8a3a', gecit: '#0d5c9c', dugum: '#6a5a4a' }, NH = { dogus: 'D', yerlesim: 'Y', isaret: 'İ', manzara: 'M', kaynak: 'K', gecit: 'G', dugum: '·' };
  const nk = TA.noktalar(); if (!nk.some(n => n.tur === 'dogus')) { const d = TA.dogus(); nk.push({ tur: 'dogus', ad: 'Doğuş', x: d.x, z: d.z, yaricap: 0 }); }
  for (const n of nk) { const px = X(n.x), pz = Z(n.z), c = NR[n.tur] || '#333'; if (n.yaricap > 0) { g.beginPath(); g.arc(px, pz, n.yaricap / mpp, 0, 6.2832); g.strokeStyle = c; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); }
    g.beginPath(); g.arc(px, pz, 8, 0, 6.2832); g.fillStyle = c; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(NH[n.tur] || '?', px, pz + .5); if (n.ad) yazi(n.ad, px + 12, pz + 1, c, 13); }
  // ölçek çubuğu, kuzey oku
  const ob = [10, 20, 50, 100, 200, 500, 1000, 2000].reverse().find(v => v / mpp <= N * .22) || 10, bx = ML + N - 24 - ob / mpp, by = MT + N - 26;
  g.fillStyle = 'rgba(255,253,245,.85)'; g.fillRect(bx - 10, by - 22, ob / mpp + 20, 36); g.fillStyle = '#15120d'; g.fillRect(bx, by, ob / mpp, 5); g.fillStyle = '#fff'; g.fillRect(bx + ob / mpp / 4, by + 1, ob / mpp / 4, 3); g.fillRect(bx + ob / mpp * 3 / 4, by + 1, ob / mpp / 4, 3); yazi(ob + ' m', bx + ob / mpp / 2, by - 10, '#15120d', 13, 'center');
  g.fillStyle = 'rgba(255,253,245,.85)'; g.beginPath(); g.arc(ML + N - 34, MT + 40, 26, 0, 6.2832); g.fill(); g.fillStyle = '#15120d'; g.beginPath(); g.moveTo(ML + N - 34, MT + 20); g.lineTo(ML + N - 26, MT + 48); g.lineTo(ML + N - 34, MT + 42); g.lineTo(ML + N - 42, MT + 48); g.closePath(); g.fill(); yazi('K', ML + N - 34, MT + 58, '#15120d', 11, 'center');
  g.restore(); g.strokeStyle = '#15120d'; g.lineWidth = 1.5; g.strokeRect(ML - .5, MT - .5, N + 1, N + 1);
  // kenar koordinatları, başlık
  g.fillStyle = '#15120d'; g.font = '12px system-ui, sans-serif'; g.textBaseline = 'top'; g.textAlign = 'center'; for (let v = Math.ceil(x0 / ia) * ia; v <= x0 + gen; v += ia) g.fillText('x ' + v, X(v), MT + N + 5);
  g.textBaseline = 'middle'; g.textAlign = 'right'; for (let v = Math.ceil(z0 / ia) * ia; v <= z0 + gen; v += ia) g.fillText('z ' + v, ML - 5, Z(v));
  g.textAlign = 'left'; g.textBaseline = 'top'; g.font = '600 13px system-ui, sans-serif';
  g.fillText(`Merkez (${Math.round(cx)}, ${Math.round(cz)}) · genişlik ${Math.round(gen)} m · 1 piksel = ${mpp.toFixed(2)} m · eş yükselti ${es} m (kalın: ${es * 5} m) · yükseklik ${hmin.toFixed(1)} … ${hmax.toFixed(1)} m · ızgara ${ia} m · kuzey yukarı (−z)${A.egim ? ' · EĞİM HARİTASI' : ''}`, ML, 8);
  g.font = '12px system-ui, sans-serif'; g.fillText(A.egim ? 'Eğim: yeşil < %6 (düz) · sarı-yeşil < %20 · sarı < %45 · turuncu < %100 · kırmızı > %100 (45°, geçilmez)' : 'Su: açık = sığ (< 1,3 m, yürünür), koyu = derin (yüzülür) · kırmızı tarama: 45°\'den dik · D doğuş, Y yerleşim, İ işaret, M manzara, K kaynak, G geçit', ML, MT + N + 24);
  return { png: cv.toDataURL('image/png'), merkez: [Math.round(cx), Math.round(cz)], genislik: Math.round(gen), es, yukseklik: [+hmin.toFixed(1), +hmax.toFixed(1)], duz_yuzde: kara ? +(duzAlan / kara * 100).toFixed(1) : 0, su_yuzde: +((1 - kara / (N * N)) * 100).toFixed(1), nesne: sayim, yukseklikF_us: +(tH * 1000 / (G * G)).toFixed(2), nesne_tarama_sn: +(tN / 1000).toFixed(1) };
}
