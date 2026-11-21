// Burger Ustası denge botu (6. tur: Eymen'in resmindeki mutfak). www/js/veri.js değerleriyle oynar.
//
//   node scripts/denge.mjs [N] [md]          1–15. günler, her düzeyde N oyun (varsayılan 300)
//   node scripts/denge.mjs saat [K] [md]     uzun oyun: her düzeyde K oyuncu, dükkândaki her şey alınana kadar
//   node scripts/denge.mjs plan [K] [md]     uzun oyun + ÖNERİ: sonraki malzemeler (VERI.GELECEK) mutfağa yer
//                                            açılıp satılsaydı; "24 saatte son ürüne ulaşılamaz" kuralını ölçer
//   node scripts/denge.mjs tavan [N] [md]    zorluk tavanı (belli günlerde kazanma oranı)
//
// Mutfak (VERI.MUTFAK): 2 açık ızgara (+2 kilitli), köfte 8 sn pişer, kendiliğinden hazneye (en çok 6); çiğ patatese
// 10 dokunuş → fritöz 15 sn → dokununca hazneye (4 porsiyon); fritöz doluyken doğrama yok. Tezgâhta tek burger
// (alt ekmek ilk, üst ekmek son), iki tepsi. Gün başında hazneler dolu (6 köfte, 4 patates).
// Oyuncu modeli: tek parmak, her dokunuş B.tap sn (0,8–1,25 kat oynar), doğrama dokunuşu B.dogra sn.
// Öncelik: tepsiyi müşteriye ver (2 dokunuş) > fritözü boşalt > ızgarayı doldur > burgeri tepsiye koy (2) > tepsiye
// patates (2) > doğra (10) > burgere sıradaki malzeme (1). Hata: burger erken kapanır (üst ekmek), fark edilmez
// (çöp yok), yanlış teslim edilir (ödeme yok, seri sıfırlanır).
// 9. tur (Eymen, 21 Kasım): can yok; her gün sonuna kadar oynanır (kaybedilen gün yok). "Kârlı gün" = net kâr ≥ kira.
// Dükkânda yalnız VERI.SATILIK (ızgara kilidi, sabırlı müşteri, cömert bahşiş); "Hızlı ızgara" kalktı.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const V = require('../www/js/veri.js');
if (process.env.DENGE_AYAR) Object.assign(V.AYAR, JSON.parse(process.env.DENGE_AYAR));

const MOD = ['saat', 'plan', 'tavan'].includes(process.argv[2]) ? process.argv[2] : 'gun';
const N = +(process.argv[MOD === 'gun' ? 2 : 3] || (MOD === 'gun' ? 300 : MOD === 'tavan' ? 200 : 8));
const MD = process.argv[MOD === 'gun' ? 3 : 4] === 'md';
const GUNLER = 15, GUN_ARASI = 10, SAAT_MAX = +(process.env.SAAT_MAX || 80);
const M = V.MUTFAK;

const BECERI = {
  yavas: { ad: 'Yavaş', tap: 0.85, dogra: 0.30, dusun: 1.6, hata: 0.04, ileri: 0 },
  orta:  { ad: 'Orta',  tap: 0.60, dogra: 0.22, dusun: 0.9, hata: 0.03, ileri: 1 },
  hizli: { ad: 'Hızlı', tap: 0.40, dogra: 0.16, dusun: 0.5, hata: 0.015, ileri: 1 },
};
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// plan modunda sipariş: SIPARIS0 + sonradan açılan malzemelerden ekstra (eski kural: ekstraAralik, satis ağırlıklı)
function siparisPlan(d, R, gelecek) {
  const s = V.siparis6();
  if (!gelecek.length) return s;
  const e = d < 2 ? [0, 1] : d < 5 ? [0, 1] : d < 11 ? [0, 2] : [1, 2];
  const h = gelecek.slice();
  const n = Math.min(h.length, e[0] + Math.floor(R() * (e[1] - e[0] + 1)));
  const ek = [];
  for (let i = 0; i < n; i++) {
    let top = 0; for (const k of h) top += V.katmanSatis(k);
    let x = R() * top, j = 0;
    for (; j < h.length - 1; j++) { x -= V.katmanSatis(h[j]); if (x < 0) break; }
    ek.push(h.splice(j, 1)[0]);
  }
  s.katmanlar = ['bunBot', 'patty', 'cheese', 'pickle', ...ek, 'bunTop'];
  return s;
}

function oynaGun(d, up, coins, B, R, gelecek = []) {
  const cfg = V.gun6(d, up);
  const dt = 0.05, pis = V.izgaraPisme(up), fpis = V.fritozPisme(up);
  const st = { gelir: 0, gider: 0, bahsis: 0, mutlu: 0, somurtkan: 0, kizgin: 0, kacan: 0, yanlis: 0 };
  let kasa = coins, seri = 0, t = 0, kalan = cfg.musteri, sonraki = 1.0;
  const yer = [null, null, null];
  const izg = Array.from({ length: V.izgaraGoz(up) }, () => ({ k: -1 }));   // -1 boş, >0 pişiyor, 0 pişti bekliyor
  let hk = M.hazir.patty, hp = M.hazir.fries, fr = { st: 0, k: 0, kalan: 0 };   // fritöz: 0 boş, 1 kızarıyor, 2 bekliyor
  let tez = [], tezInan = [], tezHedef = null;   // tezgâhtaki burger; inan: oyuncunun yaptığını sandığı (erken kapatınca sipariş)
  const tep = [0, 1].map(() => ({ b: null, f: false }));
  let mesgul = 0, is = null;
  const har = c => { kasa -= c; st.gider += c; };
  const sure = x => x * (0.8 + R() * 0.45);
  const ekAralik = gelecek.length ? 1.6 * (d < 11 ? 0.5 : 1.5) : 0;

  function gelen() {
    const bos = [0, 1, 2].filter(i => !yer[i]);
    if (!bos.length || yer.filter(Boolean).length >= cfg.sira || kalan <= 0) return false;
    const sip = siparisPlan(d, R, gelecek), mx = cfg.sabirSiparis(sip);
    yer[bos[Math.floor(R() * bos.length)]] = { sip, durum: V.yeniDurum(sip), mx, p: mx, okundu: false };
    kalan--; return true;
  }
  const musteriler = () => yer.filter(Boolean);
  function ver(m, parca) {
    const o = V.teslimParca(m.durum, parca, Math.max(0, m.p / m.mx), up, seri);
    m.durum = o.durum;
    if (o.sonuc === 'parca') { m.p = Math.min(m.mx, m.p + o.sabirEk * m.mx); return; }
    if (o.sonuc === 'yanlis') { st.yanlis++; seri = 0; }
    else if (o.ruh === 'mutlu') { st.mutlu++; seri++; }
    else if (o.ruh === 'somurtkan') { st.somurtkan++; seri = 0; }
    else { st.kizgin++; seri = 0; }
    kasa += o.ucret + o.bahsis; st.gelir += o.ucret; st.bahsis += o.bahsis;
    const i = yer.indexOf(m); if (i >= 0) yer[i] = null;
  }
  // bekleyen burger sayısı: müşteriler (burgersiz) − tepsilerdeki burgerler − tezgâhtaki
  function karar() {
    const ms = musteriler();
    // 1) dolu tepsiyi en acil (eksiği uyan) müşteriye ver
    for (const tp of tep) {
      if (!tp.b && !tp.f) continue;
      // burger, siparişine uyan müşteriye (yanlış kurulmuşsa oyuncu fark etmez: uyması gereken müşteriye verir)
      const uy = m => !tp.b || V.dogruMu(m.sip.katmanlar, tp.bInan || tp.b);
      const ok = ms.filter(m => (!tp.b || !m.durum.burger) && (!tp.f || !m.durum.yan) && uy(m)).sort((a, b) => a.p - b.p);
      const tam = tp.b && tp.f;
      const m = ok[0];
      if (m && (tam || (tp.b && m.durum.yan) || (tp.f && m.durum.burger) || m.p / m.mx < 0.3))
        return [sure(B.tap) * 2, () => { if (!yer.includes(m)) return; const p = {}; if (tp.b) p.katmanlar = tp.b; if (tp.f) p.yan = 'fries'; tp.b = null; tp.f = false; ver(m, p); }];
    }
    // 2) fritöz bekliyor: hazneye al
    if (fr.st === 2 && hp < M.haznePatates) return [sure(B.tap), () => { const n = Math.min(M.haznePatates - hp, fr.kalan); hp += n; fr.kalan -= n; if (!fr.kalan) fr.st = 0; }];
    // 3) ızgara: hazne + pişen < 6 ise doldur
    const pisen = izg.filter(g => g.k >= 0).length, bosG = izg.find(g => g.k < 0);
    if (bosG && hk + pisen < M.hazneKofte) return [sure(B.tap), () => { if (bosG.k < 0) { bosG.k = pis; har(V.katmanMaliyet('patty')); } }];
    // 4) biten burgeri boş tepsiye
    if (tez[tez.length - 1] === 'bunTop') {
      const tp = tep.find(x => !x.b);
      if (tp) return [sure(B.tap) * 2, () => { tp.b = tez; tp.bInan = tezInan.length ? tezInan : tez; tez = []; tezInan = []; }];
    }
    // 5) burgerli tepsiye patates (ya da müşterisi burger almış olana)
    const bekYan = ms.filter(m => !m.durum.yan).length - tep.filter(x => x.f).length;
    if (hp > 0 && bekYan > 0) {
      const tp = tep.find(x => x.b && !x.f) || tep.find(x => !x.f && !x.b && ms.some(m => m.durum.burger && !m.durum.yan));
      if (tp) return [sure(B.tap) * 2, () => { if (hp > 0) { hp--; tp.f = true; } }];
    }
    // 6) doğra: fritöz boşsa ve patates azaldıysa
    const yanIhtiyac = ms.filter(m => !m.durum.yan).length + (kalan > 0 ? 2 : 0) - tep.filter(x => x.f).length;
    if (fr.st === 0 && hp <= 1 && yanIhtiyac > hp)
      return [sure(B.dogra) * M.dograma, () => { fr = { st: 1, k: fpis, kalan: M.haznePatates }; har(M.haznePatates * V.maliyet([], 'fries')); }];
    // 7) burger kur: gereken burger varsa sıradaki malzeme
    // hangi müşteriler için tepside burger yok (sipariş uyan burgerle eşleşir)
    const tepB = tep.filter(x => x.b).map(x => x.bInan || x.b), acik = [];
    for (const m of ms.filter(m => !m.durum.burger).sort((a, b) => a.p - b.p)) {
      const j = tepB.findIndex(b => V.dogruMu(m.sip.katmanlar, b)); if (j >= 0) tepB.splice(j, 1); else acik.push(m);
    }
    const ayni = !gelecek.length;   // herkes aynı siparişi veriyorsa sıradaki müşteri için önceden yapılır
    const gerek = acik.length + (ayni && kalan > 0 ? B.ileri : 0);
    if (gerek > 0 && tez[tez.length - 1] !== 'bunTop') {
      if (!tez.length || !tezHedef) tezHedef = (acik[0] || { sip: V.siparis6() }).sip.katmanlar;
      const hedef = tezHedef;
      let k;
      if (!tez.length) k = 'bunBot';
      else {
        const kalanK = hedef.slice(1, -1); for (const x of tez.slice(1)) { const j = kalanK.indexOf(x); if (j >= 0) kalanK.splice(j, 1); }
        if (!kalanK.length) k = 'bunTop';
        else if (R() < B.hata / Math.max(1, kalanK.length)) { k = 'bunTop'; tezInan = hedef; }   // erken kapattı (fark etmedi)
        else k = kalanK.includes('patty') ? (hk > 0 ? 'patty' : kalanK.find(x => x !== 'patty')) : kalanK[0];
      }
      if (k) {
        const okuma = !tez.length ? sure(B.dusun) * 0.5 : 0;
        return [sure(B.tap) + okuma, () => {
          if (k === 'patty') { if (hk <= 0) return; hk--; } else har(V.katmanMaliyet(k));
          tez.push(k);
          if (k === 'bunTop') { if (!tezInan.length) tezInan = tez.slice(); tezHedef = null; }
        }];
      }
    }
    return [0.1, () => {}];
  }

  while (t < 1200) {
    t += dt;
    if (kalan > 0 && t >= sonraki) sonraki = gelen() ? t + cfg.aralik[0] + ekAralik + R() * (cfg.aralik[1] - cfg.aralik[0]) : t + 0.4;
    for (let i = 0; i < 3; i++) {
      const m = yer[i]; if (!m) continue;
      m.p -= dt;
      if (m.p <= 0) { yer[i] = null; st.kacan++; seri = 0; }
    }
    for (const g of izg) {
      if (g.k > 0) { g.k -= dt; if (g.k <= 0) g.k = 0; }
      if (g.k === 0 && hk < M.hazneKofte) { hk++; g.k = -1; }
    }
    if (fr.st === 1) { fr.k -= dt; if (fr.k <= 0) fr.st = 2; }
    if (t >= mesgul) {
      if (is) { is(); is = null; }
      const [s, f] = karar(); mesgul = t + s; is = f;
    }
    if (kalan <= 0 && !yer.some(Boolean)) break;
  }
  st.kazandi = true;   // can yok: gün hep biter
  st.net = st.gelir + st.bahsis - st.gider;
  st.kasa = kasa; st.musteri = cfg.musteri; st.sure = t;
  st.teslim = st.mutlu + st.somurtkan + st.kizgin + st.yanlis;
  return st;
}

// dükkân: geliştirmeler (slot = kilitli ızgaralar) ve plan modunda sonraki malzemeler (sırayla)
function gunSonuAl(o, d, plan) {
  const gs = V.gunSonu(o.coins, d, o.eksi);
  o.coins = gs.kasa; o.eksi = gs.eksiGun; o.kira += gs.kira; if (gs.kapandi) o.kapanis++;
  const alinan = [];
  for (;;) {
    const yedek = 2 * V.kira(d + 1), ad = [];
    if (plan) { const s = V.GELECEK.find(g => !o.gelecek.includes(g.k)); if (s) ad.push({ k: s.k, tur: 'mal', c: s.fiyat }); }
    for (const k of V.SATILIK) if (o.up[k] < V.GELISTIR[k].max) ad.push({ k, tur: 'up', c: V.GELISTIR[k].cost(o.up[k]) });
    const sec = ad.filter(a => V.alabilir(o.coins - yedek, a.c)).sort((a, b) => a.c - b.c)[0];
    if (!sec) break;
    o.coins -= sec.c;
    if (sec.tur === 'mal') o.gelecek.push(sec.k); else o.up[sec.k]++;
    alinan.push(sec);
  }
  return alinan;
}
const yeniOyuncu = () => ({ coins: V.BASLANGIC, eksi: 0, kira: 0, kapanis: 0, gelecek: [], up: { cook: 0, pat: 0, tip: 0, slot: 0 } });

function kampanya(B, R) {
  const o = yeniOyuncu(), gunler = [];
  for (let d = 1; d <= GUNLER; d++) {
    let ilk = null, deneme = 0, st;
    do {
      st = oynaGun(d, { ...o.up }, o.coins, B, R); o.coins = st.kasa; deneme++;
      if (!ilk) ilk = st;
      const k0 = o.kira, al = gunSonuAl(o, d, false); st.kira = o.kira - k0;
      if (deneme === 1) { ilk.kira = st.kira; ilk.al = al; }
    } while (false);
    ilk.coins = o.coins; ilk.upTop = o.up.pat + o.up.tip; ilk.karli = ilk.net - ilk.kira >= 0 ? 1 : 0; ilk.goz = V.izgaraGoz(o.up);
    gunler.push(ilk);
  }
  return gunler;
}
// uzun oyun: dükkânda alınacak bir şey kalmayana kadar (plan: sonraki malzemeler dahil) ya da SAAT_MAX
function uzun(B, R, plan) {
  const o = yeniOyuncu(), ulas = {}, dilim = [];
  let t = 0, d = 1, oynanan = 0, kayip = 0, son = 0, sonKasa = 0, harc = 0, sonHarc = 0;
  const bitti = () => V.SATILIK.every(k => o.up[k] >= V.GELISTIR[k].max) && (!plan || o.gelecek.length === V.GELECEK.length);
  while (t < SAAT_MAX * 3600 && !bitti()) {
    const st = oynaGun(d, { ...o.up }, o.coins, B, R, plan ? o.gelecek : []);
    o.coins = st.kasa; oynanan++; t += st.sure + GUN_ARASI;
    for (const a of gunSonuAl(o, d, plan)) { harc += a.c; ulas[a.tur === 'mal' ? a.k : a.k + o.up[a.k]] = { saat: t / 3600, gun: d }; }
    if (st.kazandi) d++; else kayip++;
    if (t - son >= 3600) {
      dilim.push({ saat: t / 3600, gun: d, saatlik: ((o.coins + harc) - (sonKasa + sonHarc)) / ((t - son) / 3600) });
      son = t; sonKasa = o.coins; sonHarc = harc;
    }
  }
  return { ulas, dilim, t, d, oynanan, kayip, kapanis: o.kapanis, hepsi: bitti() };
}

const ort = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const y = (x, n = 0) => (+x).toFixed(n);
const p = x => Math.round(x * 100) + '%';
const sa = s => s < 1 ? `${Math.round(s * 60)} dk` : `${y(s, 1)} sa`;

if (MOD === 'tavan') {
  const tam = { cook: 0, pat: 4, tip: 4, slot: 2 }, yok = { cook: 0, pat: 0, tip: 0, slot: 0 }, iz = { cook: 0, pat: 0, tip: 0, slot: 2 };
  const durum = [['geliştirmesiz (2 ızgara)', yok], ['4 ızgara, başka geliştirme yok', iz], ['tam geliştirme', tam]];
  const gunler = [5, 10, 15, 18, 40, 300];
  for (const [k, B] of Object.entries(BECERI)) {
    const R = mulberry(777 + k.length);
    console.log(MD ? `\n**${B.ad} oyuncu**: kârlı gün oranı (net ≥ kira) / mutlu oranı / gün kârı (kira öncesi)\n` : `\n== ${B.ad}`);
    if (MD) { console.log('| Durum | ' + gunler.map(g => `Gün ${g}`).join(' | ') + ' |'); console.log('|---|' + gunler.map(() => '---|').join('')); }
    for (const [ad, up] of durum) {
      const h = gunler.map(d => {
        const r = Array.from({ length: N }, () => oynaGun(d, { ...up }, 1000, B, R));
        const tes = ort(r.map(x => x.teslim)) || 1;
        return `${p(ort(r.map(x => x.net - V.kira(d) >= 0 ? 1 : 0)))} / ${p(ort(r.map(x => x.mutlu)) / tes)} / ${y(ort(r.map(x => x.net)))}`;
      });
      console.log(MD ? `| ${ad} | ${h.join(' | ')} |` : ad.padEnd(32) + h.map(x => x.padStart(18)).join(''));
    }
  }
} else if (MOD === 'saat' || MOD === 'plan') {
  const plan = MOD === 'plan', sonuc = {};
  for (const [k, B] of Object.entries(BECERI)) { const R = mulberry(4242 + k.length * 991); sonuc[k] = Array.from({ length: N }, () => uzun(B, R, plan)); }
  const sutun = Object.keys(BECERI);
  const hucre = (oy, key) => {
    const u = oy.map(o => o.ulas[key]).filter(Boolean);
    if (u.length < oy.length / 2) return `> ${SAAT_MAX} sa`;
    return `${sa(med(u.map(x => x.saat)))}, gün ${med(u.map(x => x.gun))}`;
  };
  const AD = { cook: 'Hızlı ızgara', pat: 'Sabırlı müşteri', tip: 'Cömert bahşiş', slot: 'Izgara kilidi' };
  const satir = [];
  for (const k of V.SATILIK) for (let l = 1; l <= V.GELISTIR[k].max; l++)
    satir.push([`${AD[k]} ${k === 'slot' ? (l + 2) + '. ızgara' : l + '. düzey'}`, V.GELISTIR[k].cost(l - 1), k + l]);
  satir.sort((a, b) => a[1] - b[1]);
  if (plan) for (const g of V.GELECEK) satir.push([`(öneri) ${g.ad}`, g.fiyat, g.k]);
  if (MD) { console.log(`| Ürün | Fiyat | ${sutun.map(k => BECERI[k].ad).join(' | ')} |`); console.log('|---|---|' + sutun.map(() => '---|').join('')); }
  for (const [ad, f, key] of satir) {
    const h = sutun.map(k => hucre(sonuc[k], key));
    console.log(MD ? `| ${ad} | ${f.toLocaleString('tr-TR')} | ${h.join(' | ')} |` : ad.padEnd(34) + String(f).padStart(8) + h.map(x => x.padStart(20)).join(''));
  }
  for (const k of sutun) {
    const r = sonuc[k], son = satir[satir.length - 1][2];
    const ul = r.map(o => o.ulas[son]).filter(Boolean).map(x => x.saat);
    const line = `${BECERI[k].ad}: ortalama ${y(ort(r.map(o => o.t)) / 3600, 1)} saatte ${y(ort(r.map(o => o.oynanan)))} gün; kapanış ${y(ort(r.map(o => o.kapanis)), 1)}. ` +
      (ul.length ? `Son ürüne en erken ${y(Math.min(...ul), 1)} sa (${ul.length}/${r.length} oyuncu).` : `Son ürüne ${SAAT_MAX} saatte ulaşan yok.`);
    const dl = [0, 1, 4, 9, 19, 29, 39].filter(i => i < r[0].dilim.length).map(i => {
      const d = r.map(o => o.dilim[i]).filter(Boolean);
      return `${y(ort(d.map(x => x.saat)))}. sa: gün ${y(ort(d.map(x => x.gun)))}, ${y(ort(d.map(x => x.saatlik)))}/sa`;
    });
    console.log((MD ? '\n- ' : '\n') + line + (dl.length ? (MD ? '\n  - ' : '\n  ') + dl.join(MD ? '\n  - ' : '\n  ') : ''));
  }
} else {
  for (const [k, B] of Object.entries(BECERI)) {
    const R = mulberry(12345 + k.length * 777);
    const oyun = Array.from({ length: N }, () => kampanya(B, R));
    if (MD) {
      console.log(`\n### ${B.ad} oyuncu (dokunuş ${B.tap} sn, doğrama ${B.dogra} sn, hata %${B.hata * 100})\n`);
      console.log('| Gün | Müşteri | Kârlı gün | Süre (sn) | Gelir | Bahşiş | Gider | Net kâr | Kira | Mutlu | Somurtkan | Kızgın | Kaçan | Yanlış | Mutlu oranı | Izgara | Geliştirme | Kasa |');
      console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    } else console.log(`\n== ${B.ad} (${N} oyun)\ngün müş kârlı süre gelir bahş gider   net kira mutlu somur kızgn kaçan yanlş   m%  ızg   up  kasa`);
    for (let d = 0; d < GUNLER; d++) {
      const g = oyun.map(o => o[d]), tes = ort(g.map(x => x.teslim)) || 1, a = f => ort(g.map(f));
      const v = [d + 1, g[0].musteri, p(a(x => x.karli)), y(a(x => x.sure)), y(a(x => x.gelir)), y(a(x => x.bahsis)), y(a(x => x.gider)), y(a(x => x.net)), y(a(x => x.kira)),
        y(a(x => x.mutlu), 1), y(a(x => x.somurtkan), 1), y(a(x => x.kizgin), 1), y(a(x => x.kacan), 1), y(a(x => x.yanlis), 1), p(a(x => x.mutlu) / tes), y(a(x => x.goz), 1), y(a(x => x.upTop), 1), y(a(x => x.coins))];
      console.log(MD ? `| ${v.join(' | ')} |` : v.map((x, i) => String(x).padStart(i < 2 ? 3 : 5)).join(' '));
    }
  }
}
