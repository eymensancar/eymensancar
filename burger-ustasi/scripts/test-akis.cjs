// Burger Ustası: yeni mutfağın (7. tur, Eymen'in resmi) akış testi ve ekran görüntüleri.
//
//   node scripts/test-akis.cjs [cikti klasörü]     (varsayılan docs/inceleme/v3)
//
// www/ klasörünü kendi küçük sunucusuyla açar (index.html?debug), Playwright ile yatay iPhone 15, iPhone SE ve iPad'de:
//   ızgara → köfte haznesi, 10 doğrama → fritöz → patates haznesi, burger kur → tepsi → patates → müşteri
// akışını GERÇEK dokunuşlarla (dokunma alanının ortasına) oynar, durumları denetler, ekran görüntüsü alır.
// Ayrıca resmi oyunun açılış görüntüsüyle yan yana koyar (karsilastir.png). Konsol hatası ve uyarısı sıfır olmalı.
// Güvenli alanlar (çentik, ana ekran çubuğu) CSS değişkenleriyle taklit edilir.
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const KOK = path.join(__dirname, '..'), WWW = path.join(KOK, 'www');
const OUT = path.resolve(process.argv[2] || path.join(KOK, 'docs', 'inceleme', 'v3'));
fs.mkdirSync(OUT, { recursive: true });
const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const sunucu = http.createServer((q, r) => {
  const p = path.join(WWW, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(WWW) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TUR[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const CIHAZ = [
  { ad: 'iphone15', w: 852, h: 393, dpr: 3, g: { l: 59, r: 59, t: 0, b: 21 }, akis: true },
  { ad: 'iphonese', w: 568, h: 320, dpr: 2, g: { l: 0, r: 0, t: 0, b: 0 }, akis: true },
  { ad: 'ipad', w: 1180, h: 820, dpr: 2, g: { l: 0, r: 0, t: 24, b: 20 }, akis: true },
  { ad: 'promax', w: 932, h: 430, dpr: 3, g: { l: 59, r: 59, t: 0, b: 21 }, akis: false },
];
const sorun = [];
const bekle = ms => new Promise(r => setTimeout(r, ms));
function dene(kosul, mesaj) { if (!kosul) { sorun.push(mesaj); console.log('  HATA: ' + mesaj); } else console.log('  tamam: ' + mesaj); }

async function cihaz(br, port, C) {
  console.log(`\n== ${C.ad} ${C.w}×${C.h}`);
  const ctx = await br.newContext({ viewport: { width: C.w, height: C.h }, deviceScaleFactor: C.dpr, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const p = await ctx.newPage();
  const kayit = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') kayit.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => kayit.push('sayfa: ' + e.message));
  await p.addInitScript(g => {
    try { localStorage.clear(); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `:root{--sl:${g.l}px!important;--sr:${g.r}px!important;--st:${g.t}px!important;--sb:${g.b}px!important}`;
      document.head.appendChild(s);
    });
  }, C.g);
  await p.goto(`http://localhost:${port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu && document.fonts.status === 'loaded');
  await p.evaluate(() => window.__bu.fit());
  await bekle(400);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-1-ana-menu.png`) });
  await p.evaluate(() => window.__bu.startDay(1));
  await bekle(500);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-2-gun-basi.png`) });
  await p.evaluate(() => window.__bu.basla());
  await bekle(1600);
  const d = () => p.evaluate(() => window.__bu.durum());
  // dokunma alanının ortasına gerçek dokunuş
  const dokun = async (k, n = 1) => {
    for (let i = 0; i < n; i++) {
      const r = await p.evaluate(k => { const el = k === 'musteri' ? document.querySelector('#balonK .hit.mh') : window.__bu.hit(k); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; }, k);
      await p.touchscreen.tap(r.x, r.y);
      await bekle(n > 1 ? 90 : 140);
    }
  };
  // dokunma alanlarının boyu (pt): en küçükleri
  const boy = await p.evaluate(() => ['ekmekUst', 'ekmekAlt', 'izg0', 'izg1', 'izg2', 'izg3', 'kofte', 'peynir', 'tursu', 'patates', 'fritoz', 'cig', 'tezgah', 'tepsi0', 'tepsi1']
    .map(k => { const b = window.__bu.hit(k).getBoundingClientRect(); return [k, Math.round(b.width), Math.round(b.height)]; }));
  const enKucuk = boy.reduce((a, b) => Math.min(b[1], b[2]) < Math.min(a[1], a[2]) ? b : a);
  console.log('  dokunma alanları (pt): ' + boy.map(b => `${b[0]} ${b[1]}×${b[2]}`).join(', '));
  dene(Math.min(enKucuk[1], enKucuk[2]) >= 44, `en küçük dokunma alanı ${enKucuk[0]} ${enKucuk[1]}×${enKucuk[2]} pt (≥ 44)`);
  // güvenli alan: dokunulanlar ekranın güvenli bölgesinde
  const tasan = await p.evaluate(g => {
    const W = innerWidth, H = innerHeight, a = [];
    document.querySelectorAll('#parca .hit').forEach(el => {
      const b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      if (cx < g.l || cx > W - g.r || cy < g.t || cy > H - g.b) a.push(el.dataset.h);
    });
    return a;
  }, C.g);
  dene(!tasan.length, 'dokunma alanlarının ortası güvenli alanda' + (tasan.length ? ': ' + tasan.join(', ') : ''));
  dene((await d()).cust.some(Boolean), 'müşteri geldi');
  await p.screenshot({ path: path.join(OUT, `${C.ad}-3-mutfak.png`) });
  if (!C.akis) { await ctx.close(); return kayit; }

  // 1) kurallar: alt ekmeksiz malzeme konmaz
  await dokun('peynir');
  dene((await d()).burger.length === 0, 'alt ekmek yokken peynir reddedildi');
  // 2) burger: alt ekmek → köfte → peynir → turşu → üst ekmek
  await dokun('ekmekAlt'); await dokun('kofte'); await bekle(150);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-4-burger-kuruluyor.png`) });
  await dokun('peynir'); await dokun('tursu'); await dokun('peynir');
  dene((await d()).burger.filter(k => k === 'cheese').length === 1, 'ikinci peynir reddedildi');
  await dokun('ekmekUst'); await bekle(400);
  let s = await d();
  dene(JSON.stringify(s.burger) === '["bunBot","patty","cheese","pickle","bunTop"]', 'burger kuruldu (alt ekmek ilk, üst ekmek son): ' + s.burger.join(','));
  dene(s.hk === 5, 'köfte haznesinden bir köfte alındı (6 → 5)');
  // 3) ızgara: köfte pişer, kendiliğinden hazneye uçar
  await dokun('izg0'); await bekle(3500);
  s = await d();
  dene(s.izg[0].st === 1, 'ızgarada köfte pişiyor');
  await p.screenshot({ path: path.join(OUT, `${C.ad}-5-izgara-pisiyor.png`) });
  await dokun('izg2');
  dene((await d()).izg[2].st === 0, 'kilitli ızgara açılmadı');
  // 4) burger → tepsi, patates → tepsi
  await dokun('tezgah'); dene((await d()).sec === 'burger', 'burger seçildi');
  await dokun('tepsi0'); await bekle(450);
  dene(!!(await d()).tepsi[0].b, 'burger tepsiye geçti');
  await dokun('patates'); await dokun('tepsi0'); await bekle(450);
  s = await d();
  dene(s.tepsi[0].f === true && s.hp === 3, 'patates tepsiye geçti (hazne 4 → 3)');
  // 5) doğrama: 10 dokunuş → fritöz
  await dokun('patates'); await dokun('tepsi1'); await bekle(400);   // haznede 2 kalsın
  await dokun('cig', 9);
  dene((await d()).dogra === 9 && (await d()).fr.st === 0, '9 dokunuşta doğrama sürüyor');
  await p.screenshot({ path: path.join(OUT, `${C.ad}-6-dograma.png`) });
  await dokun('cig'); await bekle(1100);
  s = await d();
  dene(s.fr.st === 1, '10. dokunuşta patates fritöze girdi');
  await dokun('cig');
  dene((await d()).dogra === 0, 'fritöz doluyken doğrama reddedildi');
  await bekle(900);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-7-fritoz.png`) });
  s = await d();
  dene(s.hk === 6, 'pişen köfte hazneye geçti (5 → 6)');
  // 6) tepsi → müşteri
  const kasa0 = s.kasa;
  await dokun('tepsi0'); dene((await d()).sec === 'tepsi0', 'tepsi seçildi');
  await dokun('musteri'); await bekle(250);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-8-servis.png`) });
  await bekle(1300);
  s = await d();
  dene(s.bitti === 1 && s.kasa > kasa0, `müşteri tepsiyi aldı, ödedi (kasa ${kasa0} → ${s.kasa})`);
  dene(!s.tepsi[0].b && !s.tepsi[0].f, 'tepsi boşaldı');
  // 7) fritöz bitince dokun → patates haznesine
  await p.waitForFunction(() => window.__bu.durum().fr.st === 2, null, { timeout: 20000 });
  await p.screenshot({ path: path.join(OUT, `${C.ad}-9-patates-hazir.png`) });
  await dokun('fritoz'); await bekle(900);
  s = await d();
  dene(s.hp === 4 && s.fr.st === 2 && s.fr.kalan === 2, `fritözden hazneye: hazne ${s.hp}/4, sepette ${s.fr.kalan} porsiyon bekliyor`);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-10-sonra.png`) });
  await ctx.close();
  return kayit;
}

(async () => {
  await new Promise(r => sunucu.listen(0, r));
  const port = sunucu.address().port;
  const br = await pw.chromium.launch();
  const hatalar = [];
  for (const C of CIHAZ) { const k = await cihaz(br, port, C); k.forEach(x => hatalar.push(`${C.ad}: ${x}`)); }
  // resim ve oyunun açılış görüntüsü yan yana (aynı boyda: 1852×849, üst bilgi ve müşteri yok)
  const ctx = await br.newContext({ viewport: { width: 1852, height: 849 }, deviceScaleFactor: 1, locale: 'tr-TR' });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto(`http://localhost:${port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu);
  await p.evaluate(() => { window.__bu.startDay(1); window.__bu.basla(); window.__bu.S.kalan = 0; });
  await p.addStyleTag({ content: '.hud,.ipucu,#fx,.tahta,.tepsi{visibility:hidden!important}' });
  await bekle(800);
  await p.screenshot({ path: path.join(OUT, 'oyun-1852.png') });
  await ctx.close();
  await br.close(); sunucu.close();
  console.log('\nKonsol hata/uyarı: ' + hatalar.length);
  hatalar.forEach(h => console.log('  ' + h));
  console.log(sorun.length ? `\n${sorun.length} SORUN` : '\nHepsi geçti.');
  process.exit(sorun.length || hatalar.length ? 1 : 0);
})();
