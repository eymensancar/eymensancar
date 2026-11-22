// Burger Ustası: gerçek dokunuşlu oturum ölçümü (docs/SHAWARMA_INCELEME.md → "Önce / sonra").
//
//   node scripts/oturum-olcum.cjs [www klasörü] [çıktı.json] [senaryolar]
//     www klasörü: varsayılan www/ (eski sürümü ölçmek için: git archive ile çıkarılmış bir www/)
//     senaryolar: virgülle (varsayılan hepsi): yeni1, alisik1, gun8, gun15, bosta; 11. tur: egri (1., 3., 6., 10. gün, iki oyuncu
//     hızıyla, bütün gün: aynı anda müşteri dağılımı; docs/DENGE.md → "11. tur")
//
// Yöntem (incelemedeki gibi): www/ yerel sunucuda index.html?debug, Playwright, yatay iPhone 15 (852×393). Bot GERÇEK
// dokunuşlarla (dokunma alanının ortası) bir insan gibi oynar: her dokunuştan sonra "alışmış" 0,38–0,6 sn, "yeni oyuncu"
// 0,9–1,1 sn (saniyede ~1 dokunuş); doğramada dokunuşlar arası 0,15–0,2 sn. Öncelik: hazır tepsiyi en acil müşteriye ver →
// (10. tur) tezgâhtaki parayı topla → biten burgeri tepsiye → patatesi tepsiye → fritözü boşalt → ızgarayı doldur →
// patates azalınca doğra → sıradaki malzeme; yapacak iş yoksa bekler ("boş bekleme").
// Ölçülenler: her 0,5 sn aynı anda tezgâhtaki müşteri sayısı; boş bekleme oranı; saniyede "iyi şey" (olumlu uçan yazı:
// ödeme, bahşiş, "alındı", büyük başlık; burger kapanması / doğrama bitmesi ("tamam" sesi); para toplama) ve "kötü şey"
// (kırmızı "−N", "Ödemedi!/Yanlış!" damgası); kasa değişimi (kira dahil); büyük kutlama sayısı (yazi.buyuk, konfeti).
// "bosta": 8. gün, müşteriler beklerken hiç dokunulmaz; 10 sn boyunca her 0,5 sn ekran görüntüsü, ardışık iki karede
// en az bir renk kanalı 16'dan çok değişen piksellerin oranı (ortalama).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const WWW = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www'));
const OUT = process.argv[3] ? path.resolve(process.argv[3]) : null;
const SEN = (process.argv[4] || 'yeni1,alisik1,gun8,gun15,bosta,egri').split(',');
const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const sunucu = http.createServer((q, r) => {
  const p = path.join(WWW, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(WWW) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TUR[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const bekle = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

// sayfaya: ses ve efekt sayaçları
const SAYAC = () => {
  window.__olc = { iyi: 0, kotu: 0, buyuk: 0, tamam: 0, topla: 0, konfeti: 0, ses: 0, yazi: [] };
  const bak = () => {
    const B = window.BU && window.BU.SES;
    if (!B || B.__sarili) return; B.__sarili = true;
    const c = B.cal; B.cal = function (ad, o) { window.__olc.ses++; if (ad === 'tamam') window.__olc.tamam++; return c.apply(this, arguments); };
  };
  document.addEventListener('DOMContentLoaded', () => {
    bak();
    const mo = new MutationObserver(ms => ms.forEach(m => {
      m.addedNodes.forEach(n => {
        if (!n.classList) return;
        if (n.classList.contains('yazi')) {
          const k = n.classList.contains('kotu') || n.classList.contains('mini');
          window.__olc[k ? 'kotu' : 'iyi']++; if (n.classList.contains('buyuk')) { window.__olc.buyuk++; window.__olc.yazi.push(n.textContent.trim()); }
        }
        if (n.classList.contains('damga')) window.__olc.kotu++;
        if (n.classList.contains('konfeti')) window.__olc.konfeti++;
      });
    }));
    const fx = document.getElementById('fx'); if (fx) mo.observe(fx, { childList: true });
    const pk = document.getElementById('paraK');
    if (pk) new MutationObserver(ms => ms.forEach(m => m.removedNodes.forEach(n => { if (n.classList && n.classList.contains('git')) window.__olc.topla++; }))).observe(pk, { childList: true });
  });
};

async function sayfa(br, port, kayit) {
  const ctx = await br.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const p = await ctx.newPage();
  const hata = [];
  p.on('console', m => { if (m.type() === 'error') hata.push(m.text()); });
  p.on('pageerror', e => hata.push(e.message));
  await p.addInitScript(k => {
    try { localStorage.clear(); if (k) localStorage.setItem('burgerustasi.v1', JSON.stringify(k)); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--sl:59px!important;--sr:59px!important;--sb:21px!important}'; document.head.appendChild(s); });
  }, kayit);
  await p.addInitScript(SAYAC);
  await p.goto(`http://localhost:${port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu && document.fonts.status === 'loaded');
  await p.evaluate(() => window.__bu.fit());
  await p.touchscreen.tap(5, 388);   // ses kilidi
  return { ctx, p, hata };
}

// oyun durumu + dokunulacak yerlerin ekran merkezleri
const DURUM = () => {
  const B = window.__bu, S = B.S, d = B.durum();
  const mr = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
  const hit = {}; ['ekmekUst', 'ekmekAlt', 'izg0', 'izg1', 'izg2', 'izg3', 'kofte', 'peynir', 'tursu', 'patates', 'fritoz', 'cig', 'tezgah', 'tepsi0', 'tepsi1'].forEach(k => hit[k] = mr(B.hit(k)));
  const cust = S.cust.map(c => c && !c.gitti ? { i: c.i, f: c.p / c.max, b: !!(c.durum && c.durum.burger), y: !!(c.durum && c.durum.yan), m: mr(c.hit) } : null);
  const yig = (S.yig || []).map(y => y && y.el ? mr(y.el.querySelector('.yg') || y.el) : null);
  const ov = !document.getElementById('ov').hidden;
  return { d, hit, cust, yig, ov, on: S.on, bitis: S.bitis, kasa: S.kasa, sec: S.sec, now: S.now, gun: S.gun };
};

async function oyna(p, { sure, aralik, ileri }) {
  const t0 = Date.now(), ornek = [], o = { bos: 0, dokunus: 0 };
  let sonOrnek = 0, kasa0 = null;
  const tap = async (pt, ms) => { if (!pt) return; await p.touchscreen.tap(pt.x, pt.y); o.dokunus++; await bekle(ms != null ? ms : rnd(aralik[0], aralik[1]) * 1000); };
  for (;;) {
    const s = await p.evaluate(DURUM);
    if (kasa0 == null) kasa0 = s.kasa;
    const gecen = (Date.now() - t0) / 1000;
    if (gecen - sonOrnek >= 0.5) { sonOrnek = gecen; if (s.on && !s.bitis) ornek.push(s.cust.filter(Boolean).length); }
    if (!s.on || s.bitis || s.ov || gecen > sure) { o.sure = gecen; break; }
    const D = s.d, tp = D.tepsi, cs = s.cust.filter(Boolean).sort((a, b) => a.f - b.f);
    const tam = i => tp[i].b && tp[i].f === true;
    // 1) seçili tam tepsi → en acil müşteri
    if (s.sec && s.sec.startsWith('tepsi') && tam(+s.sec[5])) { const c = cs.find(c => !c.b) || cs[0]; if (c) { await tap(c.m); continue; } }
    // 2) tam tepsi varsa ve müşteri bekliyorsa seç
    const ti = [0, 1].find(tam);
    if (ti != null && cs.some(c => !c.b)) { await tap(s.hit['tepsi' + ti]); continue; }
    // 3) tezgâhtaki para (10. tur)
    const yi = s.yig.findIndex(Boolean);
    if (yi >= 0 && !(s.sec && s.sec.startsWith('tepsi'))) { await tap(s.yig[yi]); continue; }
    // 4) biten burger → boş tepsi
    const bt = D.burger[D.burger.length - 1] === 'bunTop';
    if (bt) { const bos = [0, 1].find(i => !tp[i].b); if (bos != null) { await tap(s.sec === 'burger' ? s.hit['tepsi' + bos] : s.hit.tezgah); continue; } }
    // 5) burgerli tepsiye patates
    const pi = [0, 1].find(i => tp[i].b && !tp[i].f);
    if (pi != null && D.hp > 0) { await tap(s.sec === 'patates' ? s.hit['tepsi' + pi] : s.hit.patates); continue; }
    // 6) fritöz bekliyor
    if (D.fr.st === 2 && D.hp < 4) { await tap(s.hit.fritoz); continue; }
    // 7) ızgara
    const pisen = D.izg.filter(g => g.st > 0).length, bg = D.izg.findIndex(g => g.acik && g.st === 0);
    if (bg >= 0 && D.hk + pisen < 6) { await tap(s.hit['izg' + bg]); continue; }
    // 8) doğra
    if (D.fr.st === 0 && D.hp <= 1) { for (let k = 0; k < 10; k++) await tap(s.hit.cig, rnd(150, 200)); await bekle(rnd(aralik[0], aralik[1]) * 1000); continue; }
    // 9) burger kur (gereken: burgersiz müşteri − tepsideki burgerler; alışmış oyuncu bir tane önceden)
    const gerek = cs.filter(c => !c.b).length - tp.filter(x => x.b).length + (ileri ? 1 : 0);
    if (gerek > 0 && !bt) {
      const b = D.burger; let k = null;
      if (!b.length) k = 'ekmekAlt';
      else if (!b.includes('patty')) k = D.hk > 0 ? 'kofte' : null;
      else if (!b.includes('cheese')) k = 'peynir';
      else if (!b.includes('pickle')) k = 'tursu';
      else k = 'ekmekUst';
      if (k) { await tap(s.hit[k]); continue; }
    }
    // yapacak iş yok
    o.bos += 0.25; await bekle(250);
  }
  const s = await p.evaluate(DURUM);
  const olc = await p.evaluate(() => window.__olc);
  const dag = [0, 1, 2, 3].map(n => ornek.filter(x => x === n).length / Math.max(1, ornek.length));
  return { sure: +o.sure.toFixed(1), dokunusSn: +(o.dokunus / o.sure).toFixed(2), bosOran: +(o.bos / o.sure).toFixed(3),
    ayniAnda: { ort: +(ornek.reduce((a, b) => a + b, 0) / Math.max(1, ornek.length)).toFixed(2), enCok: Math.max(0, ...ornek), dagilim: dag.map(x => +x.toFixed(2)) },
    iyiSn: +((olc.iyi + olc.tamam + olc.topla) / o.sure).toFixed(2), kotuSn: +(olc.kotu / o.sure).toFixed(2), buyuk: olc.buyuk, buyukYazi: olc.yazi, konfeti: olc.konfeti,
    sesSn: +(olc.ses / o.sure).toFixed(2), servis: s.d.bitti - (s.d.kacan || 0), kacan: s.d.kacan || 0, kasaGun: s.kasa - kasa0 };
}

async function gunOyna(br, port, ad, kayit, gun, secenek) {
  const { ctx, p, hata } = await sayfa(br, port, kayit);
  await p.evaluate(g => window.__bu.startDay(g), gun); await bekle(300);
  const coins0 = await p.evaluate(() => window.__bu.SAVE.coins);
  await p.evaluate(() => window.__bu.basla()); await bekle(200);
  const r = await oyna(p, secenek);
  // gün bitene kadar bekle (kart), kira sonrası kasa
  await p.waitForFunction(() => !document.getElementById('ov').hidden, null, { timeout: 30000 }).catch(() => {});
  await bekle(600);
  r.kasaKiraSonrasi = (await p.evaluate(() => window.__bu.SAVE.coins)) - coins0;
  r.gunBitti = await p.evaluate(() => !window.__bu.S.on);
  r.hata = hata.length;
  await ctx.close();
  console.log(ad, JSON.stringify(r));
  return r;
}

async function bosta(br, port) {
  // 11. tur: 8. günde tezgâh artık nadiren dolar (müşteri eğrisi); boşta ölçümü dolu tezgâhla 16. günde
  const { ctx, p, hata } = await sayfa(br, port, { day: 16, coins: 500, seen: ['tut3', 'para', 'ilk'], up: { cook: 0, pat: 0, tip: 0, slot: 1 } });
  await p.evaluate(() => { window.__bu.startDay(16); window.__bu.basla(); });
  // müşteriler gelsin (en çok kaç gelirse: 10. turda 3, eskisinde 2–3), sonra hiç dokunma
  await p.waitForFunction(() => window.__bu.S.cust.filter(Boolean).length >= 3, null, { timeout: 25000 }).catch(() => {});
  await bekle(2500);
  const kl = fs.mkdtempSync(path.join(os.tmpdir(), 'bosta-'));
  for (let i = 0; i < 21; i++) { await p.screenshot({ path: path.join(kl, `${String(i).padStart(2, '0')}.png`) }); await bekle(500); }
  const n = await p.evaluate(() => window.__bu.S.cust.filter(Boolean).length);
  await ctx.close();
  const py = `
import sys, os
from PIL import Image, ImageChops
k = sys.argv[1]; f = sorted(os.listdir(k)); o = []
for a, b in zip(f, f[1:]):
    A = Image.open(os.path.join(k, a)).convert('RGB'); B = Image.open(os.path.join(k, b)).convert('RGB')
    d = ImageChops.difference(A, B).split(); m = ImageChops.lighter(ImageChops.lighter(d[0], d[1]), d[2])
    h = m.histogram(); o.append(sum(h[17:]) / (A.width * A.height))
print(sum(o) / len(o), max(o))
`;
  const [ort, en] = execFileSync('python3', ['-c', py, kl]).toString().trim().split(' ').map(Number);
  const r = { musteri: n, degisim: +(ort * 100).toFixed(2), enCok: +(en * 100).toFixed(2), hata: hata.length, kareler: kl };
  console.log('bosta', JSON.stringify(r));
  return r;
}

(async () => {
  await new Promise(r => sunucu.listen(0, r));
  const port = sunucu.address().port;
  const br = await pw.chromium.launch();
  const sonuc = { www: WWW };
  const AL = [0.38, 0.6], YENI = [0.9, 1.1];
  if (SEN.includes('yeni1')) sonuc.yeni1 = await gunOyna(br, port, 'yeni1', null, 1, { sure: 240, aralik: YENI, ileri: false });
  if (SEN.includes('alisik1')) sonuc.alisik1 = await gunOyna(br, port, 'alisik1', { day: 1, coins: 50, seen: ['tut3', 'para', 'ilk'] }, 1, { sure: 240, aralik: AL, ileri: true });
  if (SEN.includes('gun8')) sonuc.gun8 = await gunOyna(br, port, 'gun8', { day: 8, coins: 500, seen: ['tut3', 'para', 'ilk'], up: { cook: 0, pat: 0, tip: 0, slot: 1 } }, 8, { sure: 90, aralik: AL, ileri: true });
  if (SEN.includes('gun15')) sonuc.gun15 = await gunOyna(br, port, 'gun15', { day: 15, coins: 900, seen: ['tut3', 'para', 'ilk'], up: { cook: 0, pat: 1, tip: 1, slot: 2 } }, 15, { sure: 120, aralik: AL, ileri: true });
  if (SEN.includes('bosta')) sonuc.bosta = await bosta(br, port);
  // 11. tur: müşteri eğrisi. Her gün iki oyuncuyla (yeni: saniyede ~1 dokunuş; alışmış: 0,38–0,6 sn) bütün gün oynanır;
  // geliştirmeler o güne kadar orta bir oyuncunun aldıkları kadar (docs/DENGE.md). Her 0,5 sn tezgâhtaki müşteri sayısı.
  if (SEN.includes('egri')) {
    const UP = { 1: {}, 3: { slot: 1, pat: 1 }, 6: { slot: 1, pat: 2, tip: 1, dogra: 1 }, 10: { slot: 1, pat: 3, tip: 2, dogra: 1, kizart: 1 } };
    sonuc.egri = {};
    for (const g of (process.env.EGRI_GUN ? process.env.EGRI_GUN.split(',').map(Number) : [1, 3, 6, 10])) for (const [ad, ar, il] of [['yeni', YENI, false], ['alisik', AL, true]])
      sonuc.egri[`gun${g}-${ad}`] = await gunOyna(br, port, `egri gün ${g} ${ad}`, { day: g, coins: 300, seen: ['tut3', 'para', 'ilk'], up: UP[g] }, g, { sure: 400, aralik: ar, ileri: il });
  }
  await br.close(); sunucu.close();
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(sonuc, null, 1));
})();
