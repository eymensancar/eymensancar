// Niyet modeli egitimi: node tools/niyet-egit.cjs [--kuru]
// Naive Bayes (ikili ozellikler, karma kovalar) egitir, 5 katli capraz dogrulama yapar
// (kural / model / karma), karma parametrelerini secer ve modeli npc-dil.js icine gomer.
//
// Egitim verisi YALNIZ: korpus*/tekil-gelistirme.json, korpus*/diyalog-gelistirme.json ilk turlari,
// tools/npc-dil-test.cjs icindeki ORNEK dizisi. Saklı dosyalar (*-sakli.json, tekil.json, diyalog.json) okunmaz.
'use strict';
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const DOSYA = path.join(KOK, 'npc-dil.js');
const KURU = process.argv.includes('--kuru');   // --kuru: yalniz olc, dosyaya yazma

// Modeli bos haliyle yukle (kural puanlari modelden bagimsiz olsun)
function dilYukle() {
  delete require.cache[require.resolve(DOSYA)];
  return require(DOSYA);
}
const D = dilYukle();
const E = D._egitim;
const NIYET = D.NIYETLER;
const IDX = {};
NIYET.forEach((n, i) => { IDX[n] = i; });

// ---------------- veri ----------------
const veri = [];
const gor = new Set();
function ekle(m, niyet, kaynak) {
  if (!m || IDX[niyet] == null) return;
  const anahtar = D.normal(m).katli;
  if (gor.has(anahtar + '|' + niyet)) return;
  gor.add(anahtar + '|' + niyet);
  veri.push({ m, niyet, kaynak });
}
for (const k of ['korpus', 'korpus2']) {
  const tek = path.join(__dirname, k, 'tekil-gelistirme.json');
  const dia = path.join(__dirname, k, 'diyalog-gelistirme.json');
  if (fs.existsSync(tek)) JSON.parse(fs.readFileSync(tek, 'utf8')).forEach(x => ekle(x.m, x.niyet, k));
  if (fs.existsSync(dia)) JSON.parse(fs.readFileSync(dia, 'utf8')).forEach(x => { const t = x.turlar && x.turlar[0]; if (t) ekle(t.m, t.konu, k); });
}
{
  const src = fs.readFileSync(path.join(__dirname, 'npc-dil-test.cjs'), 'utf8');
  const a = src.indexOf('const ORNEK = [');
  const b = src.indexOf('\n];', a);
  const ORNEK = Function('return ' + src.slice(a + 'const ORNEK = '.length, b + 2))();
  ORNEK.forEach(([m, n]) => ekle(m, n, 'test'));
}

// kural ciktilari (sabit; CV sirasinda degismez)
veri.forEach(x => {
  const r = D.niyetBul(x.m, { adlar: [] }, { model: false });
  x.katli = r._katli; x.puan = r.puanlar; x.kural = r.niyet; x.kufur = r.kufur;
});

// deterministik karistirma ve katlar
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
veri.sort((a, b) => fnv(a.m) - fnv(b.m) || (a.m < b.m ? -1 : 1));
veri.forEach((x, i) => { x.kat = i % 5; });

// ---------------- Naive Bayes ----------------
function egit(liste, bit, alfa, budama) {
  const C = NIYET.length;
  const say = new Map();           // kova -> Int32Array(C)
  const n = new Array(C).fill(0);
  liste.forEach(x => {
    const c = IDX[x.niyet];
    n[c]++;
    E.ozellikler(x.katli, bit).forEach(h => {
      let a = say.get(h);
      if (!a) { a = new Int32Array(C); say.set(h, a); }
      a[c]++;
    });
  });
  // budama: toplam sayisi `budama`dan az olan kovalari at
  const kova = new Map();
  const t = new Array(C).fill(0);
  for (const [h, a] of say) {
    let top = 0;
    for (let c = 0; c < C; c++) top += a[c];
    if (top < budama) continue;
    const d = [];
    for (let c = 0; c < C; c++) if (a[c]) { d.push(c, Math.min(35, a[c])); t[c] += Math.min(35, a[c]); }
    kova.set(h, d);
  }
  return { b: bit, a: alfa, c: NIYET.slice(), t, n, N: liste.length, v: kova.size, kova };
}
// runtime ile ayni hesap (npc-dil.js -> modelPuanla)
function tahmin(M, katli) {
  const C = M.c.length, lA = Math.log(M.a);
  const f = E.ozellikler(katli, M.b);
  const sk = new Array(C);
  for (let c = 0; c < C; c++) sk[c] = Math.log((M.n[c] + 1) / (M.N + C)) + f.length * (lA - Math.log(M.t[c] + M.a * M.v));
  for (const h of f) {
    const d = M.kova.get(h);
    if (!d) continue;
    for (let j = 0; j < d.length; j += 2) sk[d[j]] += Math.log(d[j + 1] + M.a) - lA;
  }
  return E.logNormal(sk, M.c);
}
function enIyi(o) { let en = null, p = -Infinity; for (const k in o) if (o[k] > p) { p = o[k]; en = k; } return en; }

// ---------------- capraz dogrulama ----------------
function cv(bit, alfa, budama) {
  const sonuc = veri.map(() => null);
  for (let k = 0; k < 5; k++) {
    const M = egit(veri.filter(x => x.kat !== k), bit, alfa, budama);
    veri.forEach((x, i) => { if (x.kat === k) sonuc[i] = tahmin(M, x.katli); });
  }
  return sonuc;
}
function oran(f, filtre) {
  const l = veri.map((x, i) => [x, i]).filter(([x]) => !filtre || filtre(x));
  const d = l.filter(([x, i]) => f(x, i) === x.niyet).length;
  return { d, n: l.length, p: l.length ? d / l.length : 0 };
}
const yuzde = r => (100 * r.p).toFixed(1) + '% (' + r.d + '/' + r.n + ')';
const k2 = x => x.kaynak === 'korpus2';

const IZGARA = { bit: [14, 15], alfa: [0.1, 0.3, 0.6], budama: [1, 2] };
const KARMA = { lambda: [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1], beta: [0.5, 1, 1.5, 2], g: [0.5, 1, 1.5, 2.5] };

console.log('Egitim verisi:', veri.length, 'mesaj (', ['korpus', 'korpus2', 'test'].map(k => k + ' ' + veri.filter(x => x.kaynak === k).length).join(', '), ')');
let enIyiAyar = null;
for (const bit of IZGARA.bit) for (const alfa of IZGARA.alfa) for (const budama of IZGARA.budama) {
  const pr = cv(bit, alfa, budama);
  const modelK2 = oran((x, i) => enIyi(pr[i]), k2);
  // karma parametreleri korpus2 (kurallarin hic gormedigi tarz) uzerinden secilir; esitlikte tum veri
  for (const lambda of KARMA.lambda) for (const beta of KARMA.beta) for (const g of KARMA.g) {
    const kp = { lambda, beta, g };
    const f = (x, i) => E.karma(x, x.puan, pr[i], kp).niyet;
    const rk2 = oran(f, k2), rt = oran(f);
    const skor = rk2.p * 1000 + rt.p;
    if (!enIyiAyar || skor > enIyiAyar.skor) enIyiAyar = { skor, bit, alfa, budama, kp, pr, modelK2 };
  }
}
const { bit, alfa, budama, kp, pr } = enIyiAyar;
const fKural = x => x.kural, fModel = (x, i) => enIyi(pr[i]), fKarma = (x, i) => E.karma(x, x.puan, pr[i], kp).niyet;
console.log('\nSecilen: bit', bit, 'alfa', alfa, 'budama', budama, 'karma', JSON.stringify(kp));
console.log('\n5 katli capraz dogrulama (kurallar sabit):');
console.log('                 tum veri            korpus              korpus2             test ornekleri');
for (const [ad, f] of [['kural', fKural], ['model', fModel], ['karma', fKarma]]) {
  console.log('  ' + ad.padEnd(8) + [null, x => x.kaynak === 'korpus', k2, x => x.kaynak === 'test'].map(fl => yuzde(oran(f, fl)).padEnd(20)).join(''));
}
// karma ile duzelen / bozulan karisikliklar
const duz = {}, boz = {};
veri.forEach((x, i) => {
  const a = fKural(x), b = fKarma(x, i);
  if (a !== x.niyet && b === x.niyet) { const k = x.niyet + ' <- ' + a; duz[k] = (duz[k] || 0) + 1; }
  if (a === x.niyet && b !== x.niyet) { const k = x.niyet + ' -> ' + b; boz[k] = (boz[k] || 0) + 1; }
});
const sirala = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => '    ' + v + '  ' + k).join('\n');
console.log('\nKarmanin duzelttigi (kural yanlis, karma dogru):\n' + sirala(duz));
console.log('Karmanin bozdugu (kural dogru, karma yanlis):\n' + sirala(boz));

// ---------------- son model: tum veriyle ----------------
const M = egit(veri, bit, alfa, budama);
const kovalar = [...M.kova.keys()].sort((a, b) => a - b);
let onceki = 0;
const d = kovalar.map(h => {
  const s = (h - onceki).toString(36) + ':' + M.kova.get(h).map((v, j) => (j % 2 === 0 ? v.toString(36) : (v === 1 ? '0' : v.toString(36)))).join('');
  onceki = h;
  return s;
}).join(';');
const nesne = { b: bit, a: alfa, c: M.c, t: M.t, n: M.n, N: M.N, v: M.v, k: kp, d };
const metin = JSON.stringify(nesne);
console.log('\nModel: ' + M.v + ' kova, ' + (metin.length / 1024).toFixed(1) + ' KB');

if (!KURU) {
  const src = fs.readFileSync(DOSYA, 'utf8');
  const re = /\/\*MODEL-BASLA\*\/[\s\S]*?\/\*MODEL-BITIS\*\//;
  if (!re.test(src)) throw new Error('npc-dil.js icinde MODEL isaretleri yok');
  fs.writeFileSync(DOSYA, src.replace(re, () => '/*MODEL-BASLA*/' + metin + '/*MODEL-BITIS*/'));
  // dogrulama: gomulu model egitimdekiyle ayni sonucu veriyor mu
  const D2 = dilYukle();
  let ayni = 0;
  veri.forEach(x => { const r = D2.niyetBul(x.m, { adlar: [] }); if (r.niyet === E.karma(x, x.puan, tahmin(M, x.katli), kp).niyet) ayni++; });
  console.log('npc-dil.js guncellendi. Gomulu model = egitim modeli: ' + ayni + '/' + veri.length);
  const t0 = process.hrtime.bigint();
  const N = 3000;
  for (let i = 0; i < N; i++) D2.niyetBul(veri[i % veri.length].m, { adlar: ['Mehmet', 'Ayşe'] });
  console.log('Hiz: niyetBul ortalama ' + (Number(process.hrtime.bigint() - t0) / 1e6 / N).toFixed(3) + ' ms');
} else console.log('(--kuru: dosyaya yazilmadi)');
