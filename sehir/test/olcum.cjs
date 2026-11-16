/* Otomatik ölçümler (docs/HARITA_TASARIM.md hedefleri): Markdown rapor + JSON.
   Kullanım:
     node test/olcum.cjs [--bolge b001 | --merkez dogus|x,z|<nokta> --genislik 2000] [--tasarim deneme|yok] [--egim 45] [--hucre 4] [--bos 150] [--cikti olcum.md]
   Ölçülenler:
     1. Doğuştan ilk ağaca / kayaya / yerdeki dala / taşa / suya ulaşma süresi (ızgara üstünde en kısa yol; hafif koşu 3,6 m/sn ve yürüme 1,55 m/sn)
     2. Doğuştan görünen ilgi noktaları (göz 1,7 m; görüş çizgisi yalnız ARAZİYLE kesiştirilir, ağaçlar sayılmaz), görüş derinliği, görünen alan yüzdesi
     3. Düzlük oranı (eğim < %6) ve eğim dağılımı; "her yöne aynı görünen boş düzlük" listesi (--bos yarıçapında düz ve nesnesiz alanlar)
     4. Yerleşim alanları tablosu (boyut, eğim, su ve kaynak yakınlığı, doğuştan süre, görünürlük)
     5. Erişilebilirlik: eğim sınırı (--egim, derece; daha dik = geçilmez), derin su yüzerek geçilir; ulaşılamayan / yalnız yüzerek ulaşılan ilgi noktaları, kapalı cepler
     6. En uzun "olaysız" yürüyüş: 60 m içinde ağaç/kaya/ilgi noktası olmayan en geniş boşluklar (kaba ölçü)
   Yol modeli oyunun fiziğine göredir: karada hız eğimden etkilenmez; sığ suda (0,25–1,2 m) yarıya kadar yavaşlar; 1,3 m'den derinde yüzülür (1,45 m/sn).
   Not: oyunun fiziği dik yamacı engellemez; eğim sınırı tasarım kuralıdır (ilkeler: "geçilemeyen yamaç"). Ağaç/kaya gövdeleri engel sayılmaz. */
const { ac, arglar } = require('./ortak.cjs'); const fs = require('fs');
(async () => {
  const a = arglar(process.argv), cikti = a.cikti || 'olcum.md', t0 = Date.now();
  const o = await ac({ boyut: [480, 270], tasarim: a.tasarim });
  try {
    const R = await o.pg.evaluate(olc, { bolge: a.bolge || null, merkez: a.merkez || 'dogus', genislik: +(a.genislik || 2000), egim: +(a.egim || 45), hucre: +(a.hucre || 0), bos: +(a.bos || 150) });
    R.sure_sn = +((Date.now() - t0) / 1000).toFixed(1); R.hata = o.hatalar.slice(0, 5);
    fs.writeFileSync(cikti.replace(/\.md$/, '') + '.json', JSON.stringify(R, null, 1)); fs.writeFileSync(cikti, rapor(R));
    console.log(JSON.stringify({ cikti, json: cikti.replace(/\.md$/, '') + '.json', sure_sn: R.sure_sn, hedefler: R.hedefler, hata: R.hata }, null, 1));
  } finally { await o.kapat(); }
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });

function rapor(R) {
  const L = [], sn = v => v == null ? '—' : v < 90 ? v.toFixed(0) + ' sn' : (v / 60).toFixed(1) + ' dk', m = v => v == null ? '—' : Math.round(v) + ' m', ev = v => v ? 'evet' : 'hayır', tablo = (bas, sat) => { L.push('| ' + bas.join(' | ') + ' |', '|' + bas.map(() => '---').join('|') + '|'); sat.forEach(s => L.push('| ' + s.join(' | ') + ' |')); L.push(''); };
  L.push(`# Ölçüm raporu: ${R.alan.ad}`, '', `Alan: x ${R.alan.x0} … ${R.alan.x1}, z ${R.alan.z0} … ${R.alan.z1} (${(R.alan.km2).toFixed(2)} km²), ızgara ${R.alan.hucre} m. Doğuş: (${R.dogus.x}, ${R.dogus.z}), y = ${R.dogus.y}. Eğim sınırı ${R.egimSinir}° (daha dik = geçilmez). Süre ${R.sure_sn} sn.`, '');
  L.push('## Hedefler (docs/HARITA_TASARIM.md)', ''); tablo(['Hedef', 'Ölçülen', 'Sonuç'], R.hedefler.map(h => [h.ad, h.deger, h.ok == null ? '—' : h.ok ? 'TAMAM' : '**EKSİK**']));
  L.push('## 1. Doğuştan ilk kaynaklara', '', 'En kısa yol (ızgara üstünde; eğim sınırı ve su hızlarıyla). Kuş uçuşu uzaklık ayrıca verilir.', '');
  tablo(['Kaynak', 'Kuş uçuşu', 'Yol', 'Hafif koşu (3,6)', 'Yürüme (1,55)', 'Yer'], R.ilk.map(k => [k.ad, m(k.kus), m(k.yol), sn(k.kosu), sn(k.yuru), k.x == null ? '—' : `(${k.x}, ${k.z})`]));
  L.push(`Doğuşun 50 m çevresinde: ${R.cevre50.agac} ağaç, ${R.cevre50.kaya} kaya, ${R.cevre50.dal} dal, ${R.cevre50.tas} taş. 100 m çevresinde: ${R.cevre100.agac} ağaç, ${R.cevre100.kaya} kaya, ${R.cevre100.dal} dal, ${R.cevre100.tas} taş.`, '');
  L.push('## 2. Doğuştan görüş', '', `Göz 1,7 m. Görünen kara: alanın %${R.gorus.alanYuzde} (tek noktadan bütün harita görünmemeli). En yüksek görünen yer: ${R.gorus.tepe ? `${R.gorus.tepe.y} m, (${R.gorus.tepe.x}, ${R.gorus.tepe.z}), ${R.gorus.tepe.uzak} m uzakta, ${R.gorus.tepe.yon}° yönünde` : '—'}.`, '');
  tablo(['Yön', 'K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'], [['Görüş derinliği'].concat(R.gorus.yonler.map(v => m(v)))]);
  if (R.noktalar.length) tablo(['İlgi noktası', 'Tür', 'Uzaklık', 'Görünür mü', 'Yol (koşu)', 'Erişim'], R.noktalar.map(n => [n.ad || n.id, n.tur, m(n.kus), ev(n.gorunur), sn(n.kosu), n.erisim]));
  else L.push('_Tasarım ilgi noktası yok._', '');
  L.push('## 3. Düzlük ve eğim', '', `Kara: alanın %${R.egim.karaYuzde}; su %${R.egim.suYuzde} (derin %${R.egim.derinYuzde}).`, '');
  tablo(['Eğim', '< %6 (düz, inşa)', '%6–20', '%20–45', '%45–100', `> ${R.egimSinir}° (geçilmez)`], [['Karanın yüzdesi'].concat(R.egim.sinif.map(v => '%' + v))]);
  L.push(`### Boş düzlükler (${R.bosYaricap} m çevresi düz ve nesnesiz)`, '');
  if (R.bosDuzluk.length) { tablo(['Merkez', 'Yaklaşık alan', 'Düz oranı', 'Çevredeki ağaç+kaya', 'En yakın ilgi noktası'], R.bosDuzluk.map(b => [`(${b.x}, ${b.z})`, (b.alan / 10000).toFixed(1) + ' ha', '%' + b.duz, String(b.nesne), b.nokta ? `${b.nokta.ad} ${b.nokta.uzak} m` : '—'])); L.push('Bunlar "her yöne aynı görünen" yerlerdir: tepe, koru, kaya, su ya da ilgi noktasıyla bölünmeli.', ''); }
  else L.push('_Yok._', '');
  L.push('## 4. Yerleşim alanları', '');
  if (R.yerlesim.length) tablo(['Ad', 'Yarıçap', 'Alan', 'Ort. eğim', 'En çok eğim', 'Düz (< %6)', 'Yükseklik', 'Suya', 'Ağaç ≤150 m', 'Kaya ≤150 m', 'En yakın ağaç/kaya', 'Doğuştan (koşu)', 'Doğuştan görünür'], R.yerlesim.map(y => [y.ad, m(y.yaricap), Math.round(y.alan) + ' m²', '%' + y.egimOrt, '%' + y.egimEnCok, '%' + y.duz, `${y.yMin}…${y.yMax} m`, y.su == null ? '> 400 m' : m(y.su), String(y.agac), String(y.kaya), `${m(y.enAgac)} / ${m(y.enKaya)}`, sn(y.kosu), ev(y.gorunur)]));
  else L.push('_`tur: \'yerlesim\'` ilgi noktası yok._', '');
  L.push('## 5. Erişilebilirlik', '', `Yürünebilir kara (eğim ≤ ${R.egimSinir}°): karanın %${R.erisim.yurunurYuzde}. Doğuştan ulaşılan kara: %${R.erisim.ulasilanYuzde} (yüzmeden: %${R.erisim.karadanYuzde}).`, '');
  const ul = R.noktalar.filter(n => n.erisim !== 'yürüyerek'); if (ul.length) { L.push('Yürüyerek ulaşılamayan ilgi noktaları:', ''); ul.forEach(n => L.push(`- **${n.ad || n.id}** (${n.tur}) (${n.x}, ${n.z}): ${n.erisim}`)); L.push(''); } else if (R.noktalar.length) L.push('Bütün ilgi noktalarına yürüyerek ulaşılıyor.', '');
  if (R.erisim.cepler.length) { L.push('Kapalı cepler (yürünebilir ama doğuştan ulaşılamayan kara; alan kenarına değenler dışarıdan bağlı olabilir):', ''); tablo(['Merkez', 'Alan', 'Kenara değiyor', 'Neden'], R.erisim.cepler.map(c => [`(${c.x}, ${c.z})`, Math.round(c.alan) + ' m²', ev(c.kenar), c.neden])); } else L.push('Kapalı cep yok.', '');
  L.push('## 6. Olaysız yürüyüş', '', `Yürünebilir karada en yakın ağaç/kaya/ilgi noktasına uzaklık: ortanca ${R.olaysiz.ortanca} m, en çok ${R.olaysiz.enCok} m. Aşağıdakiler ${R.olaysiz.esik} m içinde hiçbir şey olmayan boşluklardır (uzunluk = boşluğun en geniş yeri).`, '');
  if (R.olaysiz.bosluk.length) tablo(['Merkez', 'Uzunluk', 'Koşuyla', 'Yürüyerek', 'Alan'], R.olaysiz.bosluk.map(b => [`(${b.x}, ${b.z})`, m(b.uzunluk), sn(b.uzunluk / 3.6), sn(b.uzunluk / 1.55), (b.alan / 10000).toFixed(1) + ' ha'])); else L.push('_Boşluk yok._', '');
  L.push('## Nesne sayımı', '', Object.keys(R.nesne).sort().map(k => `${k}: ${R.nesne[k]}`).join(' · ') || '—', '');
  return L.join('\n');
}

function olc(A) {
  const SO = window.SO, W = SO.world, TA = window.TA, d0 = TA.dogus();
  let X0, Z0, X1, Z1, ad;
  if (A.bolge) { const B = TA.bolge(A.bolge); X0 = B.x0; Z0 = B.z0; X1 = B.x1; Z1 = B.z1; ad = B.ad + ' (' + B.id + ')'; } else { const m = TA.nokta(A.merkez); X0 = m.x - A.genislik / 2; X1 = m.x + A.genislik / 2; Z0 = m.z - A.genislik / 2; Z1 = m.z + A.genislik / 2; ad = (m.ad || A.merkez) + ' çevresi'; }
  const c = A.hucre || (Math.max(X1 - X0, Z1 - Z0) > 3200 ? 8 : 4), nx = Math.ceil((X1 - X0) / c), nz = Math.ceil((Z1 - Z0) / c), n = nx * nz, LIM = Math.tan(A.egim * Math.PI / 180);
  const H = new Float32Array(n), E = new Float32Array(n), cx = i => X0 + (i + .5) * c, cz = j => Z0 + (j + .5) * c;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = W.yukseklikF(cx(i), cz(j));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = Math.max(0, i - 1), b = Math.min(nx - 1, i + 1), u = Math.max(0, j - 1), v = Math.min(nz - 1, j + 1); E[j * nx + i] = Math.hypot((H[j * nx + b] - H[j * nx + a]) / ((b - a) * c), (H[v * nx + i] - H[u * nx + i]) / ((v - u) * c)); }
  const ic = (x, z) => x >= X0 && x < X1 && z >= Z0 && z < Z1, hucre = (x, z) => Math.floor((z - Z0) / c) * nx + Math.floor((x - X0) / c);
  const nesne = TA.tara(X0, Z0, X1, Z1), agac = nesne.filter(q => q.sinif === 'agac' && q.tur !== 'cali'), kaya = nesne.filter(q => q.sinif === 'kaya'), sayim = {}; for (const q of nesne) sayim[q.tur] = (sayim[q.tur] || 0) + 1;
  TA.git(d0.x, d0.z); const yerde = TA.yerdekiler(), dy = W.groundY(d0.x, d0.z);
  const noktalar = TA.noktalar().filter(q => ic(q.x, q.z));
  // en kısa yol (Dijkstra, 8 komşu). hız: kara 3,6; sığ su yavaşlar; derin su yüzme 1,45 (yuzme = false ise geçilmez)
  function yol(yuzme) {
    const T = new Float32Array(n).fill(Infinity), hiz = new Float32Array(n);
    for (let q = 0; q < n; q++) { const d = -H[q]; hiz[q] = d > 1.2 ? (yuzme ? 1.45 : 0) : d > .25 ? 3.6 * (1 - .55 * Math.min(1, (d - .25) / .95)) : E[q] > LIM ? 0 : 3.6; }
    const heap = new Int32Array(n * 4 + 16), key = new Float32Array(n * 4 + 16); let hn = 0;
    const it = (q, k) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (key[p] <= k) break; heap[i] = heap[p]; key[i] = key[p]; i = p; } heap[i] = q; key[i] = k; };
    const cek = () => { const q = heap[0], lk = key[--hn], lq = heap[hn]; let i = 0; for (;;) { let ch = 2 * i + 1; if (ch >= hn) break; if (ch + 1 < hn && key[ch + 1] < key[ch]) ch++; if (key[ch] >= lk) break; heap[i] = heap[ch]; key[i] = key[ch]; i = ch; } heap[i] = lq; key[i] = lk; return q; };
    if (ic(d0.x, d0.z)) { const s = hucre(d0.x, d0.z); if (!hiz[s]) hiz[s] = 3.6; T[s] = 0; it(s, 0); }
    while (hn > 0) { const k = key[0], q = cek(); if (k > T[q]) continue; const i = q % nx, j = (q - i) / nx;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { if (!a && !b) continue; const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const r = jj * nx + ii; if (!hiz[r]) continue; const t = k + (a && b ? 1.4142 : 1) * c * 2 / (hiz[q] + hiz[r]); if (t < T[r]) { T[r] = t; if (hn < heap.length - 1) it(r, t); } } }
    return T;
  }
  const T = yol(true), Tk = yol(false);
  // yol uzunluğu yaklaşık: süre × 3,6 karada (suda daha kısa); ayrıca yürüme süresi için kara payı aynı oranla ölçeklenir
  const sureAl = (x, z) => { if (!ic(x, z)) return null; let en = Infinity; const q0 = hucre(x, z), i = q0 % nx, j = (q0 - i) / nx; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) en = Math.min(en, T[jj * nx + ii]); } return isFinite(en) ? en : null; };
  const enYakin = (L, adi) => { let en = null, es = Infinity, kus = null, kq = Infinity; for (const q of L) { const d = Math.hypot(q.x - d0.x, q.z - d0.z); if (d < kq) { kq = d; kus = q; } if (d > es * 3.6 + 30) continue; const s = sureAl(q.x, q.z); if (s != null && s < es) { es = s; en = q; } }
    return { ad: adi, kus: kus ? kq : null, yol: en ? es * 3.6 : null, kosu: en ? es : null, yuru: en ? es * 3.6 / 1.55 : null, x: en ? Math.round(en.x) : null, z: en ? Math.round(en.z) : null }; };
  const ilk = [enYakin(agac, 'İlk ağaç'), enYakin(kaya, 'İlk kaya'), enYakin(yerde.filter(q => q.tur === 'dal'), 'İlk dal (yerde)'), enYakin(yerde.filter(q => q.tur === 'tas'), 'İlk taş (yerde)')];
  { let es = Infinity, eq = -1, kq = Infinity; for (let q = 0; q < n; q++) if (H[q] < -.05) { const i = q % nx, j = (q - i) / nx, d = Math.hypot(cx(i) - d0.x, cz(j) - d0.z); if (d < kq) kq = d; if (T[q] < es) { es = T[q]; eq = q; } }
    ilk.push({ ad: 'Su', kus: isFinite(kq) ? kq : null, yol: eq >= 0 ? es * 3.6 : null, kosu: eq >= 0 ? es : null, yuru: eq >= 0 ? es * 3.6 / 1.55 : null, x: eq >= 0 ? Math.round(cx(eq % nx)) : null, z: eq >= 0 ? Math.round(cz(Math.floor(eq / nx))) : null }); }
  const cevre = r => ({ agac: agac.filter(q => Math.hypot(q.x - d0.x, q.z - d0.z) < r).length, kaya: kaya.filter(q => Math.hypot(q.x - d0.x, q.z - d0.z) < r).length, dal: yerde.filter(q => q.tur === 'dal' && Math.hypot(q.x - d0.x, q.z - d0.z) < r).length, tas: yerde.filter(q => q.tur === 'tas' && Math.hypot(q.x - d0.x, q.z - d0.z) < r).length });
  // görüş çizgisi (arazi): gözden hedefe 4 m adımla
  const hAl = (x, z) => ic(x, z) ? H[hucre(x, z)] : W.yukseklikF(x, z), gozY = Math.max(dy, 0) + 1.7;
  const gorunur = (x, z, y) => { const dx = x - d0.x, dz = z - d0.z, L = Math.hypot(dx, dz), m = Math.ceil(L / 4); for (let k = 1; k < m; k++) { const t = k / m; if (hAl(d0.x + dx * t, d0.z + dz * t) > gozY + (y - gozY) * t + .3) return false; } return true; };
  let gorK = 0, karaK = 0, tepe = null; const yonler = [0, 0, 0, 0, 0, 0, 0, 0], ks = Math.max(1, Math.round(16 / c));
  for (let j = 0; j < nz; j += ks) for (let i = 0; i < nx; i += ks) { const h = H[j * nx + i]; if (h < 0) continue; karaK++; const x = cx(i), z = cz(j); if (!gorunur(x, z, h + 1.5)) continue; gorK++; const d = Math.hypot(x - d0.x, z - d0.z), pus = (Math.atan2(x - d0.x, -(z - d0.z)) * 180 / Math.PI + 360) % 360, s = Math.round(pus / 45) % 8; if (d > yonler[s]) yonler[s] = d; if (d > 60 && (!tepe || h > tepe.y)) tepe = { y: Math.round(h), x: Math.round(x), z: Math.round(z), uzak: Math.round(d), yon: Math.round(pus) }; }
  const nk = noktalar.map(q => { const s = sureAl(q.x, q.z), q0 = hucre(q.x, q.z), kara = isFinite(Tk[q0]); return { id: q.id, ad: q.ad, tur: q.tur, x: Math.round(q.x), z: Math.round(q.z), kus: Math.hypot(q.x - d0.x, q.z - d0.z), gorunur: gorunur(q.x, q.z, Math.max(hAl(q.x, q.z), 0) + Math.max(1.5, q.yukseklik || 0)), kosu: s, erisim: s == null ? 'ULAŞILAMIYOR' : kara || isFinite(Math.min(Tk[q0], Tk[Math.max(0, q0 - 1)], Tk[Math.min(n - 1, q0 + 1)])) ? 'yürüyerek' : 'yalnız yüzerek' }; });
  // eğim sınıfları
  let kara = 0, su = 0, derin = 0; const sinif = [0, 0, 0, 0, 0];
  for (let q = 0; q < n; q++) { if (H[q] < 0) { su++; if (H[q] < -1.3) derin++; continue; } kara++; const e = E[q]; sinif[e < .06 ? 0 : e < .2 ? 1 : e < .45 ? 2 : e <= Math.min(1, LIM) ? 3 : 4]++; }
  // tümleşik görüntüler: düz kara, kara, nesne
  const NW = nx + 1, Id = new Float64Array(NW * (nz + 1)), Ik = new Float64Array(NW * (nz + 1)), In = new Float64Array(NW * (nz + 1)), nes = new Uint16Array(n);
  for (const q of agac.concat(kaya)) if (ic(q.x, q.z)) nes[hucre(q.x, q.z)]++;
  for (let j = 0; j < nz; j++) { let a = 0, b = 0, d = 0; for (let i = 0; i < nx; i++) { const q = j * nx + i; if (H[q] >= 0) { b++; if (E[q] < .06) a++; } d += nes[q]; const o = (j + 1) * NW + i + 1; Id[o] = Id[o - NW] + a; Ik[o] = Ik[o - NW] + b; In[o] = In[o - NW] + d; } }
  const kutu = (I, i0, j0, i1, j1) => I[j1 * NW + i1] - I[j0 * NW + i1] - I[j1 * NW + i0] + I[j0 * NW + i0];
  const br = Math.round(A.bos / c), ba = Math.max(1, Math.round(40 / c)), bos = [];
  for (let j = br; j + br <= nz; j += ba) for (let i = br; i + br <= nx; i += ba) { const kr = kutu(Ik, i - br, j - br, i + br, j + br), tum = 4 * br * br; if (kr < tum * .9) continue; const dz = kutu(Id, i - br, j - br, i + br, j + br) / kr, ns = kutu(In, i - br, j - br, i + br, j + br); if (dz > .7 && ns <= 3) bos.push({ i, j, dz, ns }); }
  const bosK = []; { const gor = new Set(), anah = b => b.i + ',' + b.j, M = new Map(bos.map(b => [anah(b), b])); for (const b of bos) { if (gor.has(anah(b))) continue; const yig = [b], grup = []; gor.add(anah(b)); while (yig.length) { const q = yig.pop(); grup.push(q); for (const [a, e] of [[ba, 0], [-ba, 0], [0, ba], [0, -ba]]) { const k = (q.i + a) + ',' + (q.j + e); if (M.has(k) && !gor.has(k)) { gor.add(k); yig.push(M.get(k)); } } }
      const mx = grup.reduce((s, q) => s + cx(q.i), 0) / grup.length, mz = grup.reduce((s, q) => s + cz(q.j), 0) / grup.length; let en = null; for (const q of noktalar) { const d = Math.hypot(q.x - mx, q.z - mz); if (!en || d < en.uzak) en = { ad: q.ad || q.id, uzak: Math.round(d) }; }
      bosK.push({ x: Math.round(mx), z: Math.round(mz), alan: 4 * A.bos * A.bos + (grup.length - 1) * (ba * c) * (ba * c), duz: Math.round(grup.reduce((s, q) => s + q.dz, 0) / grup.length * 100), nesne: Math.round(grup.reduce((s, q) => s + q.ns, 0) / grup.length), nokta: en }); } bosK.sort((p, q) => q.alan - p.alan); }
  // yerleşimler
  const suUzak = (x, z) => { let en = null; const i0 = Math.floor((x - X0) / c), j0 = Math.floor((z - Z0) / c), R = Math.ceil(400 / c); for (let j = Math.max(0, j0 - R); j < Math.min(nz, j0 + R); j++) for (let i = Math.max(0, i0 - R); i < Math.min(nx, i0 + R); i++) if (H[j * nx + i] < -.05) { const d = Math.hypot(cx(i) - x, cz(j) - z); if (en == null || d < en) en = d; } return en != null && en < 400 ? en : null; };
  const yerlesim = noktalar.filter(q => q.tur === 'yerlesim').map(q => { const r = q.yaricap || 30; let s = 0, m = 0, k = 0, dz = 0, y0 = 1e9, y1 = -1e9; for (let z = q.z - r; z <= q.z + r; z += c) for (let x = q.x - r; x <= q.x + r; x += c) { if (Math.hypot(x - q.x, z - q.z) > r || !ic(x, z)) continue; const o = hucre(x, z); k++; s += E[o]; if (E[o] > m) m = E[o]; if (E[o] < .06) dz++; y0 = Math.min(y0, H[o]); y1 = Math.max(y1, H[o]); }
    const ua = L => { let e = null; for (const p of L) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (e == null || d < e) e = d; } return e; }, sy = (L, R) => L.filter(p => Math.hypot(p.x - q.x, p.z - q.z) < R).length, o = nk.find(v => v.id === q.id);
    return { ad: q.ad || q.id, x: Math.round(q.x), z: Math.round(q.z), yaricap: r, alan: Math.PI * r * r, egimOrt: +(s / Math.max(1, k) * 100).toFixed(1), egimEnCok: +(m * 100).toFixed(1), duz: Math.round(dz / Math.max(1, k) * 100), yMin: +y0.toFixed(1), yMax: +y1.toFixed(1), su: suUzak(q.x, q.z), agac: sy(agac, 150), kaya: sy(kaya, 150), enAgac: ua(agac), enKaya: ua(kaya), kosu: o.kosu, gorunur: o.gorunur }; });
  // erişilebilirlik: cepler
  let yurunur = 0, ulas = 0, karadan = 0; const etiket = new Uint8Array(n), cepler = [];
  for (let q = 0; q < n; q++) if (H[q] >= 0 && E[q] <= LIM) { yurunur++; if (isFinite(T[q])) ulas++; if (isFinite(Tk[q])) karadan++; }
  for (let q = 0; q < n; q++) { if (etiket[q] || H[q] < 0 || E[q] > LIM || isFinite(T[q])) continue; const yig = [q]; etiket[q] = 1; let say = 0, sx = 0, sz = 0, kenar = false, dik = 0, suK = 0;
    while (yig.length) { const p = yig.pop(), i = p % nx, j = (p - i) / nx; say++; sx += cx(i); sz += cz(j); if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) kenar = true;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const r = jj * nx + ii; if (H[r] < 0) { suK++; continue; } if (E[r] > LIM) { dik++; continue; } if (!etiket[r] && !isFinite(T[r])) { etiket[r] = 1; yig.push(r); } } }
    if (say * c * c >= 300) cepler.push({ x: Math.round(sx / say), z: Math.round(sz / say), alan: say * c * c, kenar, neden: dik >= suK ? 'dik yamaçla çevrili' : 'su ve dik yamaç' }); }
  cepler.sort((p, q) => q.alan - p.alan);
  // olaysız: en yakın ağaç/kaya/ilgi noktasına uzaklık (iki geçişli uzaklık dönüşümü)
  const D = new Float32Array(n).fill(1e6); for (const q of agac.concat(kaya, noktalar)) if (ic(q.x, q.z)) D[hucre(q.x, q.z)] = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i; let v = D[q]; if (i > 0) v = Math.min(v, D[q - 1] + c); if (j > 0) { v = Math.min(v, D[q - nx] + c); if (i > 0) v = Math.min(v, D[q - nx - 1] + c * 1.414); if (i < nx - 1) v = Math.min(v, D[q - nx + 1] + c * 1.414); } D[q] = v; }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const q = j * nx + i; let v = D[q]; if (i < nx - 1) v = Math.min(v, D[q + 1] + c); if (j < nz - 1) { v = Math.min(v, D[q + nx] + c); if (i > 0) v = Math.min(v, D[q + nx - 1] + c * 1.414); if (i < nx - 1) v = Math.min(v, D[q + nx + 1] + c * 1.414); } D[q] = v; }
  const ESIK = 60, dl = [], et2 = new Uint8Array(n), bosluk = []; let enCok = 0; for (let q = 0; q < n; q += 7) if (H[q] >= 0 && isFinite(T[q])) { dl.push(D[q]); } for (let q = 0; q < n; q++) if (H[q] >= 0 && isFinite(T[q]) && D[q] > enCok && D[q] < 1e5) enCok = D[q]; dl.sort((p, q) => p - q);
  for (let q = 0; q < n; q++) { if (et2[q] || H[q] < 0 || !isFinite(T[q]) || D[q] <= ESIK) continue; const yig = [q]; et2[q] = 1; let say = 0, sx = 0, sz = 0, i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1, dm = 0;
    while (yig.length) { const p = yig.pop(), i = p % nx, j = (p - i) / nx; say++; sx += cx(i); sz += cz(j); i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); dm = Math.max(dm, D[p]); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const r = jj * nx + ii; if (!et2[r] && H[r] >= 0 && isFinite(T[r]) && D[r] > ESIK) { et2[r] = 1; yig.push(r); } } }
    if (say * c * c > 2000) bosluk.push({ x: Math.round(sx / say), z: Math.round(sz / say), uzunluk: Math.max(i1 - i0, j1 - j0) * c + 2 * ESIK, alan: say * c * c }); }
  bosluk.sort((p, q) => q.uzunluk - p.uzunluk);
  const kay = ilk.slice(0, 4).filter(k => k.kosu != null).map(k => k.kosu), ilkKaynak = kay.length ? Math.min(...kay) : null, ys = yerlesim.filter(y => y.kosu != null), ilkUs = ys.length ? Math.min(...ys.map(y => y.kosu)) : null, gorNk = nk.filter(q => q.gorunur && q.tur !== 'dogus' && q.kus > 30), f = v => v == null ? 'yok' : v.toFixed(0) + ' sn';
  const hedefler = [
    { ad: 'İlk temel kaynağa (ağaç/kaya/dal/taş) ulaşma: ≤ 20 sn (hafif koşu)', deger: f(ilkKaynak), ok: ilkKaynak != null && ilkKaynak <= 20 },
    { ad: 'İlk üs alanı: 60 sn içinde ulaşılır ya da doğuştan görünür yerleşim', deger: ys.length ? f(ilkUs) + ' · görünen: ' + yerlesim.filter(y => y.gorunur).length + '/' + yerlesim.length : 'yerleşim noktası yok', ok: ys.length ? ilkUs <= 60 || yerlesim.some(y => y.gorunur) : null },
    { ad: 'Doğuştan görünen keşif hedefi (işaret/manzara/yerleşim/geçit): ≥ 2', deger: gorNk.length + ' nokta' + (gorNk.length ? ' (' + gorNk.slice(0, 5).map(q => q.ad || q.id).join(', ') + ')' : ''), ok: noktalar.length ? gorNk.length >= 2 : null },
    { ad: 'Yerleşim seçeneği: 5–6', deger: String(yerlesim.length), ok: noktalar.length ? yerlesim.length >= 5 : null },
    { ad: 'Tek noktadan bütün harita görünmez: doğuştan görünen kara < %50', deger: '%' + (karaK ? Math.round(gorK / karaK * 100) : 0), ok: karaK ? gorK / karaK < .5 : null },
    { ad: 'Dev boş düzlük yok', deger: bosK.length + ' boş düzlük', ok: bosK.length === 0 },
    { ad: 'Uzun olaysız yürüyüş yok: en geniş boşluk < 150 m (≈ 40 sn koşu)', deger: bosluk.length ? Math.round(bosluk[0].uzunluk) + ' m' : 'boşluk yok', ok: !bosluk.length || bosluk[0].uzunluk < 150 },
    { ad: 'Bütün ilgi noktalarına yürüyerek erişim', deger: nk.filter(q => q.erisim !== 'yürüyerek').length + ' sorunlu', ok: noktalar.length ? nk.every(q => q.erisim === 'yürüyerek') : null },
    { ad: 'Kapalı cep yok (alan içinde, ≥ 300 m²)', deger: cepler.filter(q => !q.kenar).length + ' cep', ok: cepler.filter(q => !q.kenar).length === 0 }
  ];
  const yz = v => +(v / Math.max(1, kara) * 100).toFixed(1);
  return { alan: { ad, x0: Math.round(X0), z0: Math.round(Z0), x1: Math.round(X1), z1: Math.round(Z1), km2: (X1 - X0) * (Z1 - Z0) / 1e6, hucre: c }, dogus: { x: Math.round(d0.x), z: Math.round(d0.z), y: +dy.toFixed(1), alanda: ic(d0.x, d0.z) }, egimSinir: A.egim, bosYaricap: A.bos, hedefler, ilk, cevre50: cevre(50), cevre100: cevre(100),
    gorus: { alanYuzde: karaK ? Math.round(gorK / karaK * 100) : 0, tepe, yonler: yonler.map(v => v ? Math.round(v) : null) }, noktalar: nk,
    egim: { karaYuzde: +(kara / n * 100).toFixed(1), suYuzde: +(su / n * 100).toFixed(1), derinYuzde: +(derin / n * 100).toFixed(1), sinif: sinif.map(yz) }, bosDuzluk: bosK.slice(0, 12), yerlesim,
    erisim: { yurunurYuzde: yz(yurunur), ulasilanYuzde: yz(ulas), karadanYuzde: yz(karadan), cepler: cepler.slice(0, 15) },
    olaysiz: { esik: ESIK, ortanca: Math.round(dl[dl.length >> 1] || 0), enCok: Math.round(enCok), bosluk: bosluk.slice(0, 8) }, nesne: sayim };
}
