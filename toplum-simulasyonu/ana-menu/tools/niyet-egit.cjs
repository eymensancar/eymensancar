// Niyet modeli egitimi:  node tools/niyet-egit.cjs [--kuru]
//
// Iki model turu dener: Naive Bayes ('nb') ve cok terimli lojistik regresyon ('lr', deterministik SGD).
// 5 katli capraz dogrulama (CV) ile model turunu, ayarlarini ve karma (kural + model) parametrelerini secer,
// sonra tum veriyle egitip modeli npc-dil.js icindeki /*MODEL-BASLA*/ ... /*MODEL-BITIS*/ arasina gomer.
// --kuru: yalniz olcer, dosyaya yazmaz.
//
// Egitim verisi YALNIZ: korpus3/egitim.json ve korpus4/egitim.json (sentetik), korpus*/tekil-gelistirme.json, korpus*/diyalog-gelistirme.json ilk turlari,
// tools/npc-dil-test.cjs icindeki ORNEK dizisi. Sakli dosyalar (*-sakli.json, tekil.json, diyalog.json) OKUNMAZ.
// Kurallar CV sirasinda sabittir (zaten bu veriye bakilarak yazildi); modelin katkisini karmanin CV'si gosterir.
'use strict';
const fs = require('fs');
const path = require('path');

const DOSYA = path.join(__dirname, '..', 'npc-dil.js');
const KURU = process.argv.includes('--kuru');

function dilYukle() { delete require.cache[require.resolve(DOSYA)]; return require(DOSYA); }
const D = dilYukle();
const E = D._egitim;
const NIYET = D.NIYETLER, C = NIYET.length;
const IDX = {};
NIYET.forEach((n, i) => { IDX[n] = i; });

// ---------------- veri ----------------
const veri = [];
const gor = new Set();
function ekle(m, niyet, kaynak) {
  if (!m || IDX[niyet] == null) return;
  const a = D.normal(m).katli + '|' + niyet;
  if (gor.has(a)) return;
  gor.add(a);
  veri.push({ m, niyet, kaynak });
}
for (const k of ['korpus', 'korpus2', 'korpus5', 'korpus6', 'korpus7']) {
  const tek = path.join(__dirname, k, 'tekil-gelistirme.json');
  const dia = path.join(__dirname, k, 'diyalog-gelistirme.json');
  if (fs.existsSync(tek)) JSON.parse(fs.readFileSync(tek, 'utf8')).forEach(x => ekle(x.m, x.niyet, k));
  if (fs.existsSync(dia)) JSON.parse(fs.readFileSync(dia, 'utf8')).forEach(x => { const t = x.turlar && x.turlar[0]; if (t) ekle(t.m, t.konu, k); });
}
if (!process.argv.includes('--k3yok')) { const k3 = path.join(__dirname, 'korpus3', 'egitim.json'); if (fs.existsSync(k3)) JSON.parse(fs.readFileSync(k3, 'utf8')).forEach(x => ekle(x.m, x.niyet, 'korpus3')); }
if (!process.argv.includes('--k4yok')) { const k4 = path.join(__dirname, 'korpus4', 'egitim.json'); if (fs.existsSync(k4)) JSON.parse(fs.readFileSync(k4, 'utf8')).forEach(x => ekle(x.m, x.niyet, 'korpus4')); }
{
  const src = fs.readFileSync(path.join(__dirname, 'npc-dil-test.cjs'), 'utf8');
  const a = src.indexOf('const ORNEK = [');
  const b = src.indexOf('\n];', a);
  Function('return ' + src.slice(a + 'const ORNEK = '.length, b + 2))().forEach(([m, n]) => ekle(m, n, 'test'));
}
veri.forEach(x => {
  const r = D.niyetBul(x.m, { adlar: [] }, { model: false });
  x.katli = r._katli; x.puan = r.puanlar; x.kural = r.niyet; x.kufur = r.kufur;
  x.c = IDX[x.niyet];
});
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
veri.sort((a, b) => fnv(a.m) - fnv(b.m) || (a.m < b.m ? -1 : 1));
veri.forEach((x, i) => { x.kat = i % 5; });
const BIT = 15;
veri.forEach(x => { x.f = E.ozellikler(x.katli, BIT); });

// ---------------- cogaltma (yalniz egitim katlarina; deterministik) ----------------
// Yeni yazim tarzlarina dayaniklilik: dolgu kelimesi, harf dusmesi/yer degistirme, ek kirpma (ana dili Turkce olmayanlar).
const DOLGU = ['ya', 'abi', 'kanka', 'xd', 'valla', 'hocam', 'yani', 'ama', 'bi', 'lan', 'aga', 'reis', 'pls', 'ok'];
function cogalt(x, adet) {
  if (!adet) return [x];
  const out = [x];
  const w = x.katli.split(' ').filter(Boolean);
  for (let v = 0; v < adet; v++) {
    const h = fnv(x.m + '#' + v);
    let y = w.slice();
    const tur = (h >>> 3) % 3;
    if (tur === 0) {                                   // dolgu
      const d = DOLGU[h % DOLGU.length];
      y = (h & 4) ? [d].concat(y) : y.concat([d]);
    } else if (tur === 1) {                            // yazim hatasi
      const adaylar = y.map((s, i) => [s, i]).filter(([s]) => s.length >= 4);
      if (adaylar.length) {
        const [s, i] = adaylar[h % adaylar.length];
        const p = 1 + ((h >>> 8) % (s.length - 2));
        y[i] = (h & 16) ? s.slice(0, p) + s.slice(p + 1) : s.slice(0, p) + s.charAt(p + 1) + s.charAt(p) + s.slice(p + 2);
      }
    } else {                                           // ek kirpma: ariyorum -> ariyor, istiyorum -> istiyor
      const i = y.length - 1 - ((h >>> 5) % Math.min(2, y.length || 1));
      if (y[i] && y[i].length >= 6) y[i] = y[i].replace(/(yor)(um|uz|sun|sunuz)$|(m|n|z|s[iu]n)$/, '$1');
    }
    const katli = y.join(' ');
    out.push({ c: x.c, f: E.ozellikler(katli, BIT) });
  }
  return out;
}
const cogaltilmis = (liste, adet) => [].concat(...liste.map(x => cogalt(x, adet)));

// ---------------- Naive Bayes ----------------
function egitNB(liste, ay) {
  const say = new Map(), n = new Array(C).fill(0);
  liste.forEach(x => {
    n[x.c]++;
    x.f.forEach(h => { let a = say.get(h); if (!a) { a = new Int32Array(C); say.set(h, a); } a[x.c]++; });
  });
  const kova = new Map(), t = new Array(C).fill(0);
  for (const [h, a] of say) {
    const d = [];
    for (let c = 0; c < C; c++) if (a[c]) { const v = Math.min(35, a[c]); d.push(c, v); t[c] += v; }
    kova.set(h, d);
  }
  return { tur: 'nb', b: BIT, a: ay.alfa, c: NIYET.slice(), t, n, N: liste.length, v: kova.size, kova };
}
function tahminNB(M, f) {
  const lA = Math.log(M.a), sk = new Array(C);
  for (let c = 0; c < C; c++) sk[c] = Math.log((M.n[c] + 1) / (M.N + C)) + f.length * (lA - Math.log(M.t[c] + M.a * M.v));
  for (const h of f) { const d = M.kova.get(h); if (d) for (let j = 0; j < d.length; j += 2) sk[d[j]] += Math.log(d[j + 1] + M.a) - lA; }
  return sk;
}

// ---------------- Lojistik regresyon (softmax, SGD; deterministik sira) ----------------
function egitLR(liste, ay) {
  const indeks = new Map();
  liste.forEach(x => x.f.forEach(h => { if (!indeks.has(h)) indeks.set(h, indeks.size); }));
  const F = indeks.size;
  const W = new Float64Array(F * C), B = new Float64Array(C);
  const X = liste.map(x => ({ f: x.f.map(h => indeks.get(h)), c: x.c, s: 1 / Math.sqrt(x.f.length || 1) }));
  const sira = X.map((_, i) => i);
  const p = new Float64Array(C);
  for (let ep = 0; ep < ay.devir; ep++) {
    sira.sort((a, b) => fnv(ep + ':' + a) - fnv(ep + ':' + b));
    const eta = ay.eta / (1 + ep * 0.15);
    for (const i of sira) {
      const x = X[i];
      let mx = -Infinity;
      for (let c = 0; c < C; c++) {
        let z = B[c];
        for (const j of x.f) z += W[j * C + c] * x.s;
        p[c] = z; if (z > mx) mx = z;
      }
      let top = 0;
      for (let c = 0; c < C; c++) { p[c] = Math.exp(p[c] - mx); top += p[c]; }
      for (let c = 0; c < C; c++) {
        const g = p[c] / top - (c === x.c ? 1 : 0);
        B[c] -= eta * g;
        for (const j of x.f) { const k = j * C + c; W[k] -= eta * (g * x.s + ay.l2 * W[k]); }
      }
    }
  }
  // nicemle + buda (runtime ile ayni)
  let mx = 0;
  for (let k = 0; k < W.length; k++) mx = Math.max(mx, Math.abs(W[k]));
  for (let c = 0; c < C; c++) mx = Math.max(mx, Math.abs(B[c]));
  const q = mx / 640, esik = ay.buda * mx;
  const kova = new Map();
  for (const [h, j] of indeks) {
    const d = [];
    for (let c = 0; c < C; c++) { const w = W[j * C + c]; if (Math.abs(w) >= esik) d.push(c, Math.round(w / q)); }
    if (d.length) kova.set(h, d);
  }
  return { tur: 'lr', b: BIT, c: NIYET.slice(), q, w0: Array.from(B, v => Math.round(v / q)), kova };
}
function tahminLR(M, f) {
  const s = 1 / Math.sqrt(f.length || 1), sk = M.w0.map(v => v * M.q);
  for (const h of f) { const d = M.kova.get(h); if (d) for (let j = 0; j < d.length; j += 2) sk[d[j]] += d[j + 1] * M.q * s; }
  return sk;
}
const egit = (l, ay) => { const L = cogaltilmis(l, ay.cog || 0); return ay.tur === 'lr' ? egitLR(L, ay) : egitNB(L, ay); };
const tahmin = (M, f) => E.logNormal(M.tur === 'lr' ? tahminLR(M, f) : tahminNB(M, f), NIYET);

// ---------------- capraz dogrulama ----------------
function cv(ay) {
  const sonuc = new Array(veri.length);
  for (let k = 0; k < 5; k++) {
    const M = egit(veri.filter(x => x.kat !== k), ay);
    veri.forEach((x, i) => { if (x.kat === k) sonuc[i] = tahmin(M, x.f); });
  }
  return sonuc;
}
function enIyi(o) { let en = null, p = -Infinity; for (const k in o) if (o[k] > p) { p = o[k]; en = k; } return en; }
function oran(f, filtre) {
  let d = 0, n = 0;
  veri.forEach((x, i) => { if (filtre && !filtre(x)) return; n++; if (f(x, i) === x.niyet) d++; });
  return { d, n, p: n ? d / n : 0 };
}
const yuzde = r => (100 * r.p).toFixed(1) + '% (' + r.d + '/' + r.n + ')';
const K1 = x => x.kaynak === 'korpus', K2 = x => x.kaynak === 'korpus2', KT = x => x.kaynak === 'test';

const MODELLER = [];
for (const cog of [0, 2]) {
  MODELLER.push({ tur: 'nb', alfa: 0.3, cog });
  for (const eta of [0.5, 1.5]) for (const l2 of [1e-4, 1e-3]) MODELLER.push({ tur: 'lr', eta, l2, devir: 25, buda: 0.03, cog });
}
const KARMA = { lambda: [0, 0.2, 0.35, 0.5, 0.65, 0.8], beta: [0.5, 1, 2], g: [0.5, 1, 2], T: [null, 3, 3.5, 4, 5] };

console.log('Egitim verisi: ' + veri.length + ' mesaj (korpus ' + veri.filter(K1).length + ', korpus2 ' + veri.filter(K2).length +
  ', test ' + veri.filter(KT).length + ')');
let sec = null;
for (const ay of MODELLER) {
  const pr = cv(ay);
  const mo = oran((x, i) => enIyi(pr[i]));
  let enK = null;
  for (const lambda of KARMA.lambda) for (const beta of KARMA.beta) for (const g of KARMA.g) for (const T of KARMA.T) {
    const kp = { lambda, beta, g, T };
    const f = (x, i) => E.karma(x, x.puan, pr[i], kp).niyet;
    const tum = oran(f), k2 = oran(f, K2);
    // secim olcutu: tum veri ve korpus2 (kurallarin hic gormedigi tarz) esit agirlikli
    const skor = tum.p + k2.p;
    if (!enK || skor > enK.skor) enK = { skor, kp, tum, k2 };
  }
  console.log('  ' + JSON.stringify(ay).padEnd(62) + ' model ' + yuzde(mo).padEnd(18) + ' karma ' + yuzde(enK.tum).padEnd(18) + ' korpus2 ' + yuzde(enK.k2));
  if (!sec || enK.skor > sec.skor) sec = { skor: enK.skor, ay, kp: enK.kp, pr };
}
const { ay, kp, pr } = sec;
const fKural = x => x.kural, fModel = (x, i) => enIyi(pr[i]), fKarma = (x, i) => E.karma(x, x.puan, pr[i], kp).niyet;
console.log('\nSecilen model: ' + JSON.stringify(ay) + '  karma: ' + JSON.stringify(kp));
console.log('\n5 katli capraz dogrulama (kurallar sabit):');
console.log('           tum veri            korpus              korpus2             test ornekleri');
for (const [ad, f] of [['kural', fKural], ['model', fModel], ['karma', fKarma]]) {
  console.log('  ' + ad.padEnd(8) + [null, K1, K2, KT].map(fl => yuzde(oran(f, fl)).padEnd(20)).join(''));
}
const duz = {}, boz = {};
veri.forEach((x, i) => {
  const a = fKural(x), b = fKarma(x, i);
  if (a !== x.niyet && b === x.niyet) { const k = x.niyet + ' <- ' + a; duz[k] = (duz[k] || 0) + 1; }
  if (a === x.niyet && b !== x.niyet) { const k = x.niyet + ' -> ' + b; boz[k] = (boz[k] || 0) + 1; }
});
const sirala = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => '    ' + v + '  ' + k).join('\n') || '    (yok)';
console.log('\nKarmanin duzelttigi (kural yanlis -> karma dogru):\n' + sirala(duz));
console.log('Karmanin bozdugu (kural dogru -> karma yanlis):\n' + sirala(boz));

// ---------------- son model: tum veriyle ----------------
const M = egit(veri, ay);
const kovalar = [...M.kova.keys()].sort((a, b) => a - b);
let onceki = 0;
const d = kovalar.map(h => {
  const g = M.kova.get(h);
  let s = (h - onceki).toString(36) + ':';
  for (let j = 0; j < g.length; j += 2) {
    s += g[j].toString(36);
    if (M.tur === 'lr') s += ('00' + Math.max(0, Math.min(1295, g[j + 1] + 648)).toString(36)).slice(-2);
    else s += g[j + 1] === 1 ? '0' : g[j + 1].toString(36);
  }
  onceki = h;
  return s;
}).join(';');
const nesne = M.tur === 'lr'
  ? { tur: 'lr', b: M.b, c: M.c, q: +M.q.toPrecision(6), w0: M.w0, k: kp, d }
  : { tur: 'nb', b: M.b, a: M.a, c: M.c, t: M.t, n: M.n, N: M.N, v: M.v, k: kp, d };
const metin = JSON.stringify(nesne);
console.log('\nModel: ' + M.tur + ', ' + kovalar.length + ' kova, ' + (metin.length / 1024).toFixed(1) + ' KB');

if (!KURU) {
  const src = fs.readFileSync(DOSYA, 'utf8');
  const re = /\/\*MODEL-BASLA\*\/[\s\S]*?\/\*MODEL-BITIS\*\//;
  if (!re.test(src)) throw new Error('npc-dil.js icinde MODEL isaretleri yok');
  fs.writeFileSync(DOSYA, src.replace(re, () => '/*MODEL-BASLA*/' + metin + '/*MODEL-BITIS*/'));
  const D2 = dilYukle();
  let ayni = 0;
  veri.forEach(x => { if (D2.niyetBul(x.m, { adlar: [] }).niyet === E.karma(x, x.puan, tahmin(M, x.f), kp).niyet) ayni++; });
  console.log('npc-dil.js guncellendi. Gomulu model = egitim modeli: ' + ayni + '/' + veri.length);
  const N = 3000, t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) D2.niyetBul(veri[i % veri.length].m, { adlar: ['Mehmet', 'Ayşe'] });
  console.log('Hiz: niyetBul ortalama ' + (Number(process.hrtime.bigint() - t0) / 1e6 / N).toFixed(3) + ' ms');
} else console.log('(--kuru: dosyaya yazilmadi)');
