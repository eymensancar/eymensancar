// Burger Ustası denge botu: www/js/veri.js değerleriyle 1–15. günleri
// üç beceri düzeyinde (yavaş, orta, hızlı oyuncu) oynar.
//
//   node scripts/denge.mjs            özet tablolar (her düzeyde 300 oyun)
//   node scripts/denge.mjs 1000       oyun sayısı
//   node scripts/denge.mjs 300 md     docs/DENGE.md için Markdown tabloları
//
// Oyuncu modeli: tek bir parmak, her hamle bir süre alır.
//   - Malzeme koymak: kutuya dokun (seç) + tabağa dokun = 2 dokunuş; seçili
//     malzemeyi tekrar koymak 1 dokunuş.
//   - Izgaraya köfte koymak 1 dokunuş; köfte pişince kendiliğinden stoğa geçer.
//   - Yeni müşterinin siparişine bakmak "düşünme" süresi.
//   - Teslim ve çöp sürükleme süresi.
//   - Her dokunuş süresi 0,8–1,25 kat rastgele oynar.
//   - Hata: bir malzeme yerine yanlışı konur; oyuncu bunu burger bitince
//     belli bir olasılıkla fark eder ve çöpe atar, fark etmezse yanlış teslim eder.
//   - İki tabak: en acil iki müşteri için aynı anda burger yapılır.
//   - Izgara: bekleyen siparişlerin köftesi kadar (hızlı oyuncu biraz fazla) pişirilir.
//   - Kızgın müşteriye de burger verilir (can gitmesin diye).
// Gün sonunda kasadaki para kalır; her gün sonunda alınabilen en ucuz geliştirme alınır.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const V = require('../www/js/veri.js');
// deneme için: DENGE_AYAR='{"aralik0":8}' node scripts/denge.mjs
if (process.env.DENGE_AYAR) Object.assign(V.AYAR, JSON.parse(process.env.DENGE_AYAR));

const N = +(process.argv[2] || 300);
const MD = process.argv[3] === 'md';
const GUNLER = 15;

const BECERI = {
  yavas: { ad: 'Yavaş', tap: 0.85, dusun: 1.6, surukle: 1.4, hata: 0.04, fark: 0.6, ileri: 0 },
  orta:  { ad: 'Orta',  tap: 0.60, dusun: 0.9, surukle: 1.0, hata: 0.03, fark: 0.7, ileri: 1 },
  hizli: { ad: 'Hızlı', tap: 0.40, dusun: 0.5, surukle: 0.7, hata: 0.015, fark: 0.85, ileri: 2 },
};

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const orta = s => s.slice(1, -1);
function eksik(siparis, inanilan) {   // siparişte olup tabakta (oyuncunun sandığı) olmayanlar
  const r = orta(siparis).slice();
  for (const k of inanilan) { const j = r.indexOf(k); if (j >= 0) r.splice(j, 1); }
  return r;
}
function altKume(siparis, inanilan) {
  const r = orta(siparis).slice();
  for (const k of inanilan) { const j = r.indexOf(k); if (j < 0) return false; r.splice(j, 1); }
  return true;
}

function oynaGun(d, up, coins, B, R) {
  const cfg = V.gun(d, up);
  const acik = V.acik(d).filter(k => k !== 'bun');
  const dt = 0.05, pis = V.pisme(up);
  const st = { gelir: 0, gider: 0, bahsis: 0, mutlu: 0, somurtkan: 0, kizgin: 0, kacan: 0, yanlis: 0, cop: 0 };
  let kasa = coins, can = 3, seri = 0, t = 0, kalan = cfg.musteri, sonraki = 1.0;
  const yer = [null, null, null];
  const tabak = [0, 1].map(() => ({ yig: [], inan: [], m: null, hata: false, copa: false }));
  const izg = Array.from({ length: 2 + up.slot }, () => ({ k: -1 }));   // k: kalan pişme; -1 boş; 0 pişti bekliyor
  let stok = 0, sec = null, mesgul = 0, is = null;
  const har = c => { kasa -= c; st.gider += c; };
  const sure = x => x * (0.8 + R() * 0.45);

  function gelen() {
    const bos = [0, 1, 2].filter(i => !yer[i]);
    if (!bos.length || yer.filter(Boolean).length >= cfg.sira || kalan <= 0) return false;
    const s = V.siparis(d, R), mx = cfg.sabirSiparis(s);
    yer[bos[Math.floor(R() * bos.length)]] = { s, mx, p: mx, tb: -1 };
    kalan--; return true;
  }
  function teslim(ti) {
    const tb = tabak[ti], m = tb.m;
    const o = V.odeme(m.s, tb.yig, Math.max(0, m.p / m.mx), up, seri);
    if (!o.dogru) { st.yanlis++; seri = 0; }
    else if (o.ruh === 'mutlu') { st.mutlu++; seri++; }
    else if (o.ruh === 'somurtkan') { st.somurtkan++; seri = 0; }
    else { st.kizgin++; seri = 0; }
    kasa += o.ucret + o.bahsis; st.gelir += o.ucret + o.bahsis; st.bahsis += o.bahsis; can -= o.can;
    yer[yer.indexOf(m)] = null;
    Object.assign(tb, { yig: [], inan: [], m: null, hata: false, copa: false });
  }
  function cope(ti) { st.cop++; if (tabak[ti].m) tabak[ti].m.tb = -1; Object.assign(tabak[ti], { yig: [], inan: [], m: null, hata: false, copa: false }); }
  function koy(ti, k) {
    const tb = tabak[ti];
    if (k === 'bun') { const kat = tb.yig.length ? 'bunTop' : 'bunBot'; tb.yig.push(kat); tb.inan.push(kat); har(V.katmanMaliyet(kat)); return; }
    let gercek = k;
    if (k !== 'patty' && R() < B.hata) { const yan = acik.filter(x => x !== k && x !== 'patty'); if (yan.length) gercek = yan[Math.floor(R() * yan.length)]; }
    if (gercek !== k) tb.hata = true;
    if (gercek === 'patty') stok--; else har(V.katmanMaliyet(gercek));
    tb.yig.push(gercek); tb.inan.push(k);
  }

  // bir sonraki hamleyi seç: [süre, etki]
  function karar() {
    const musteriler = yer.filter(Boolean);
    // 1) biten burgeri teslim et ya da çöpe at
    for (let i = 0; i < 2; i++) {
      const tb = tabak[i];
      if (tb.yig[tb.yig.length - 1] !== 'bunTop') continue;
      if (tb.copa) return [sure(B.surukle), () => cope(i)];
      if (tb.m && yer.includes(tb.m)) return [sure(B.surukle), () => { if (yer.includes(tb.m)) teslim(i); else tb.m = null; }];
    }
    // 2) sahipsiz kalmış yığın: uyan müşteriye ver, yoksa çöp
    for (let i = 0; i < 2; i++) {
      const tb = tabak[i];
      if (tb.m && !yer.includes(tb.m)) tb.m = null;
      if (!tb.m && tb.yig.length) {
        const kapali = tb.yig[tb.yig.length - 1] === 'bunTop';
        const aday = musteriler.filter(m => m.tb < 0 && (kapali ? V.dogruMu(m.s, tb.inan) : altKume(m.s, tb.inan.slice(1))))
          .sort((a, b) => a.p - b.p)[0];
        if (aday) { tb.m = aday; aday.tb = i; continue; }
        return [sure(B.surukle), () => cope(i)];
      }
    }
    // 3) ızgara
    const istenen = musteriler.reduce((a, m) => {
      if (m.tb >= 0) return a + eksik(m.s, tabak[m.tb].inan.slice(1)).filter(k => k === 'patty').length;
      return a + orta(m.s).filter(k => k === 'patty').length;
    }, 0) + (kalan > 0 ? B.ileri : 0);
    const pisen = izg.filter(g => g.k >= 0).length;
    const bosGoz = izg.find(g => g.k < 0);
    if (bosGoz && istenen > stok + pisen && stok + pisen < V.STOK_MAX)
      return [sure(B.tap), () => { bosGoz.k = pis; har(V.katmanMaliyet('patty')); }];
    // 4) boş tabağa en acil müşteriyi al (siparişi oku)
    for (let i = 0; i < 2; i++) {
      const tb = tabak[i];
      if (tb.m || tb.yig.length) continue;
      const m = musteriler.filter(m => m.tb < 0).sort((a, b) => a.p - b.p)[0];
      if (m) { m.tb = i; tb.m = m; return [sure(B.dusun), () => {}]; }
    }
    // 5) en acil müşterinin tabağına sıradaki malzeme
    const sira = [0, 1].filter(i => tabak[i].m).sort((a, b) => tabak[a].m.p - tabak[b].m.p);
    for (const i of sira) {
      const tb = tabak[i];
      let k;
      if (!tb.yig.length) k = 'bun';
      else {
        const e = eksik(tb.m.s, tb.inan.slice(1));
        if (!e.length) k = 'bun';
        else if (sec && sec !== 'bun' && e.includes(sec) && (sec !== 'patty' || stok > 0)) k = sec;
        else if (e.includes('patty') && stok > 0) k = 'patty';
        else k = e.find(x => x !== 'patty');
        if (!k) continue;   // köfte bekleniyor
      }
      const dok = sec === k ? 1 : 2;
      return [sure(B.tap) + (dok === 2 ? sure(B.tap) : 0), () => {
        if (k === 'patty' && stok <= 0) return;
        sec = k; koy(i, k);
        if (tb.yig[tb.yig.length - 1] === 'bunTop' && tb.hata && R() < B.fark) tb.copa = true;
      }];
    }
    return [0.1, () => {}];
  }

  while (t < 900) {
    t += dt;
    if (kalan > 0 && t >= sonraki) sonraki = gelen() ? t + cfg.aralik[0] + R() * (cfg.aralik[1] - cfg.aralik[0]) : t + 0.4;
    for (let i = 0; i < 3; i++) {
      const m = yer[i]; if (!m) continue;
      m.p -= dt;
      if (m.p <= 0) { yer[i] = null; st.kacan++; seri = 0; can--; }
    }
    for (const g of izg) {
      if (g.k > 0) { g.k -= dt; if (g.k <= 0) g.k = 0; }
      if (g.k === 0 && stok < V.STOK_MAX) { stok++; g.k = -1; }
    }
    if (can <= 0) break;
    if (t >= mesgul) {
      if (is) { is(); is = null; }
      if (can <= 0) break;
      const [s, f] = karar(); mesgul = t + s; is = f;
    }
    if (kalan <= 0 && !yer.some(Boolean)) break;
  }
  st.kazandi = can > 0;
  st.net = st.gelir - st.gider;
  st.kasa = Math.max(0, kasa);
  st.teslim = st.mutlu + st.somurtkan + st.kizgin + st.yanlis;
  st.musteri = cfg.musteri;
  st.sure = t;
  return st;
}

function kampanya(B, R) {
  let coins = 0;
  const up = { cook: 0, pat: 0, tip: 0, slot: 0 };
  const gunler = [], alim = [];
  for (let d = 1; d <= GUNLER; d++) {
    let ilk = null, deneme = 0, st;
    do { st = oynaGun(d, { ...up }, coins, B, R); coins = st.kasa; deneme++; if (!ilk) ilk = st; } while (!st.kazandi && deneme < 5);
    ilk.deneme = deneme; ilk.sonundaKazandi = st.kazandi;
    // gün sonunda en ucuz geliştirmeyi al (günde en çok bir)
    const sec = Object.keys(V.GELISTIR).filter(k => up[k] < V.GELISTIR[k].max && (k !== 'slot' || d >= 4))
      .map(k => [k, V.GELISTIR[k].cost(up[k])]).filter(([, c]) => c <= coins).sort((a, b) => a[1] - b[1])[0];
    if (sec) { coins -= sec[1]; up[sec[0]]++; alim.push(d); }
    ilk.coins = coins; ilk.upTop = up.cook + up.pat + up.tip + up.slot;
    gunler.push(ilk);
  }
  return { gunler, alim };
}

const ort = a => a.reduce((x, y) => x + y, 0) / a.length;
const sonuc = {};
for (const [k, B] of Object.entries(BECERI)) {
  const R = mulberry(12345 + k.length * 777);
  const oyun = Array.from({ length: N }, () => kampanya(B, R));
  const satir = [];
  for (let d = 0; d < GUNLER; d++) {
    const g = oyun.map(o => o.gunler[d]);
    const tes = ort(g.map(x => x.teslim)) || 1;
    satir.push({
      gun: d + 1, musteri: g[0].musteri,
      kazan: ort(g.map(x => x.kazandi ? 1 : 0)), sonunda: ort(g.map(x => x.sonundaKazandi ? 1 : 0)),
      gelir: ort(g.map(x => x.gelir)), gider: ort(g.map(x => x.gider)), net: ort(g.map(x => x.net)),
      bahsis: ort(g.map(x => x.bahsis)), mutlu: ort(g.map(x => x.mutlu)), somurtkan: ort(g.map(x => x.somurtkan)),
      kizgin: ort(g.map(x => x.kizgin)), kacan: ort(g.map(x => x.kacan)), yanlis: ort(g.map(x => x.yanlis)),
      mutluOran: ort(g.map(x => x.mutlu)) / tes, coins: ort(g.map(x => x.coins)), up: ort(g.map(x => x.upTop)),
      sure: ort(g.map(x => x.sure)),
    });
  }
  const alimlar = oyun.map(o => o.alim.length);
  sonuc[k] = { satir, alim: ort(alimlar) };
}

const y = (x, n = 0) => x.toFixed(n);
const p = x => Math.round(x * 100) + '%';
for (const [k, r] of Object.entries(sonuc)) {
  const B = BECERI[k];
  if (MD) {
    console.log(`\n### ${B.ad} oyuncu (dokunuş ${B.tap} sn, sipariş okuma ${B.dusun} sn, sürükleme ${B.surukle} sn, hata %${B.hata * 100})\n`);
    console.log('| Gün | Müşteri | Kazanma (ilk deneme) | Gelir | Gider | Net kâr | Bahşiş | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Geliştirme (toplam) |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const s of r.satir) console.log(`| ${s.gun} | ${s.musteri} | ${p(s.kazan)} | ${y(s.gelir)} | ${y(s.gider)} | ${y(s.net)} | ${y(s.bahsis)} | ${y(s.mutlu, 1)} | ${y(s.somurtkan, 1)} | ${y(s.kizgin, 1)} | ${y(s.kacan, 1)} | ${y(s.yanlis, 1)} | ${p(s.mutluOran)} | ${y(s.up, 1)} |`);
    console.log(`\n15 günde ortalama ${y(r.alim, 1)} geliştirme alındı (${y(15 / Math.max(1, r.alim), 1)} günde bir).`);
  } else {
    console.log(`\n== ${B.ad} oyuncu (${N} oyun) — 15 günde ${y(r.alim, 1)} geliştirme`);
    console.log('gün müş kazan sonra  gelir  gider   net bahş  mutlu somur kızgn kaçan yanlş  m%   up  süre');
    for (const s of r.satir) console.log([s.gun, s.musteri].map(v => String(v).padStart(3)).join(' '), p(s.kazan).padStart(5), p(s.sonunda).padStart(5),
      y(s.gelir).padStart(6), y(s.gider).padStart(6), y(s.net).padStart(5), y(s.bahsis).padStart(4),
      [s.mutlu, s.somurtkan, s.kizgin, s.kacan, s.yanlis].map(v => y(v, 1).padStart(5)).join(' '), p(s.mutluOran).padStart(4), y(s.up, 1).padStart(4), y(s.sure).padStart(4));
  }
}
