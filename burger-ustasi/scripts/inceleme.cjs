// Burger Ustası: görsel inceleme. Oyunun her anını yatay iPhone 15 boyunda, deviceScaleFactor 3 ile açar ve
// sahne biriminde (resmin pikseli) tanımlı bölgeleri kırpıp JPEG olarak kaydeder (önce/sonra karşılaştırması için).
//
//   node scripts/inceleme.cjs <çıktı klasörü>
//
// Kırpmalar: <ad>.jpg. Aynı adlarla iki klasör alınıp tools/burger/karsilastir.py ile yan yana konur.
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const KOK = path.join(__dirname, '..'), WWW = path.join(KOK, 'www');
const OUT = path.resolve(process.argv[2] || 'inceleme-cikti');
fs.mkdirSync(OUT, { recursive: true });
const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const sunucu = http.createServer((q, r) => {
  const p = path.join(WWW, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(WWW) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TUR[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const bekle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => sunucu.listen(0, r));
  const port = sunucu.address().port;
  const br = await pw.chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const p = await ctx.newPage();
  const hatalar = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') hatalar.push(m.text()); });
  p.on('pageerror', e => hatalar.push('sayfa: ' + e.message));
  await p.addInitScript(() => {
    try { localStorage.clear(); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = ':root{--sl:59px!important;--sr:59px!important;--st:0px!important;--sb:21px!important}';
      document.head.appendChild(s);
    });
  });
  await p.goto(`http://localhost:${port}/index.html?debug`);
  await p.waitForFunction(() => window.__bu && document.fonts.status === 'loaded');
  await p.evaluate(() => window.__bu.fit());
  await bekle(500);
  // ekran kırpması (CSS px) ya da sahne kırpması (resmin pikseli)
  const ekran = async (ad, clip) => p.screenshot({ path: path.join(OUT, ad + '.jpg'), quality: 88, ...(clip ? { clip } : {}) });
  const sahne = async (ad, r) => {
    const c = await p.evaluate(r => { const L = window.__bu.LAY; return { x: L.ox + r[0] * L.s, y: L.oy + r[1] * L.s, width: r[2] * L.s, height: r[3] * L.s }; }, r);
    c.x = Math.max(0, c.x); c.y = Math.max(0, c.y); c.width = Math.min(852 - c.x, c.width); c.height = Math.min(393 - c.y, c.height);
    await ekran(ad, c);
  };
  const dok = async (k, ms = 0) => { await p.evaluate(k => window.__bu.dokun(k), k); if (ms) await bekle(ms); };

  // 1) ana menü ve dükkân
  await ekran('01-ana-menu');
  await ekran('01b-ana-menu-burger', { x: 120, y: 120, width: 340, height: 270 });
  await p.evaluate(() => window.__bu.openShop()); await bekle(400);
  await ekran('02-dukkan');
  await p.evaluate(() => window.__bu.openHome()); await bekle(200);
  // 2) gün başı kartı
  await p.evaluate(() => window.__bu.startDay(1)); await bekle(600);
  await ekran('03-gun-basi');
  await p.evaluate(() => window.__bu.basla()); await bekle(1800);
  await ekran('04-mutfak');
  await sahne('05-ust-sol-rozetler', [180, 0, 520, 200]);
  await sahne('05b-ust-sag-rozetler', [1400, 0, 460, 200]);
  await sahne('06-siparis-tableti', [0, 560, 260, 260]);
  await sahne('07-musteri-balon', [560, 90, 700, 240]);
  await sahne('08-tahta-tepsiler-bos', [360, 600, 960, 200]);
  // 3) burger kuruluyor: her katman, düşerken ve oturduktan sonra
  await dok('ekmekAlt', 120); await sahne('10-burger-1-alt-ucuyor', [380, 380, 260, 380]);
  await bekle(400); await sahne('10-burger-1-alt', [380, 500, 260, 280]);
  await dok('kofte', 200); await sahne('10-burger-2-kofte-dusuyor', [380, 500, 260, 280]);
  await bekle(400); await sahne('10-burger-2-kofte', [380, 500, 260, 280]);
  // düşüş kare kare (peynir): uçuş, süzülme yok, düşüş, ezilme
  await dok('peynir', 0);
  for (let f = 0; f < 12; f++) { await sahne('25-dusus-' + String(f).padStart(2, '0'), [380, 380, 280, 400]); await bekle(28); }
  await bekle(300); await sahne('10-burger-3-peynir', [380, 500, 260, 280]);
  await dok('tursu', 400); await sahne('10-burger-4-tursu', [380, 500, 260, 280]);
  await dok('ekmekUst', 0);
  for (let f = 0; f < 12; f++) { await sahne('26-kapanis-' + String(f).padStart(2, '0'), [380, 330, 280, 450]); await bekle(28); }
  await sahne('10-burger-5-ust-kapaniyor', [380, 480, 260, 300]);
  await bekle(500); await sahne('10-burger-5-tamam', [380, 480, 260, 300]);
  await sahne('09-ipucu', [380, 380, 1000, 420]);
  // 4) ızgara: çiğ, pişiyor, hazır
  await dok('izg0', 400); await sahne('11-izgara-cig', [560, 290, 480, 200]);
  await bekle(3600); await sahne('11-izgara-yarim', [560, 290, 480, 200]);
  await p.evaluate(() => { window.__bu.S.hk = 6; }); await bekle(4500); await sahne('11-izgara-hazir', [560, 290, 480, 200]);
  await p.evaluate(() => { window.__bu.S.hk = 5; }); await bekle(150); await sahne('11-izgara-ucus', [560, 250, 900, 260]);
  // 5) burger → tepsi, patates → tepsi
  await dok('tezgah', 200); await sahne('12-burger-secili', [360, 480, 300, 320]);
  await dok('tepsi0', 600);
  await dok('patates', 300); await sahne('13-patates-secili', [1200, 330, 300, 280]);
  await dok('tepsi0', 600); await sahne('14-tepsi-dolu', [360, 560, 960, 240]);
  await sahne('14b-tepsi-yakin', [680, 560, 330, 240]);
  // 6) doğrama ve fritöz
  await p.evaluate(() => { window.__bu.S.hp = 0; }); await dok('cig', 100); await dok('cig', 100); await dok('cig', 100); await dok('cig', 40);
  await sahne('15-dograma', [1600, 380, 252, 260]);
  for (let i = 0; i < 6; i++) await dok('cig', 90);
  await dok('cig', 300); await sahne('16-fritoze-ucus', [1420, 260, 432, 360]);
  await bekle(1400); await sahne('17-fritoz-kizariyor', [1420, 260, 300, 360]);
  // 7) servis
  await dok('tepsi0', 300); await sahne('18-tepsi-secili-musteri', [360, 90, 1100, 720]);
  await p.evaluate(() => window.__bu.musteri(1) || window.__bu.musteri(0) || window.__bu.musteri(2)); await bekle(260);
  await sahne('19-servis-ucus', [360, 90, 1100, 720]);
  await bekle(500); await sahne('19b-odeme', [400, 60, 900, 330]);
  // 8) fritöz hazır, patates hazneye
  await p.waitForFunction(() => window.__bu.durum().fr.st === 2, null, { timeout: 25000 });
  await bekle(200); await sahne('20-fritoz-hazir', [1420, 260, 300, 360]);
  await dok('fritoz', 200); await sahne('21-patates-ucus', [1200, 280, 520, 330]);
  await bekle(800); await ekran('22-mutfak-sonra');
  // 9) çok müşteri, sabır çubuğu
  await p.evaluate(() => { const b = window.__bu; b.S.nextAt = 0; for (let i = 0; i < 3; i++) { b.S.cfg.sira = 3; b.adim(0.01); b.S.nextAt = 0; } b.S.cust.forEach(c => { if (c) c.p = c.max * 0.35; }); b.adim(0.01); });
  await bekle(1200); await sahne('23-musteriler', [500, 60, 1000, 300]);
  // 10) gün sonu
  await p.evaluate(() => window.__bu.bitir(true)); await bekle(2600);
  await ekran('24-gun-sonu');
  await br.close(); sunucu.close();
  console.log('Kaydedildi: ' + OUT + '\nKonsol hata/uyarı: ' + hatalar.length);
  hatalar.forEach(h => console.log('  ' + h));
})();
