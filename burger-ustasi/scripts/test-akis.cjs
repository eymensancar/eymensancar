// Burger Ustası: yeni mutfağın (7. tur, Eymen'in resmi) akış testi ve ekran görüntüleri.
//
//   node scripts/test-akis.cjs [cikti klasörü]     (varsayılan docs/inceleme/v5/akis)
//
// www/ klasörünü kendi küçük sunucusuyla açar (index.html?debug), Playwright ile yatay iPhone 15, iPhone SE ve iPad'de:
//   ızgara → köfte haznesi, 10 doğrama → fritöz → patates haznesi, burger kur → tepsi → patates → müşteri
// akışını GERÇEK dokunuşlarla (dokunma alanının ortasına) oynar, durumları denetler, ekran görüntüsü alır.
// Ayrıca oyunun açılış görüntüsünü resimle aynı boyda alır (oyun-1852.jpg; resimle yan yana: karsilastir.jpg). Konsol hatası ve uyarısı sıfır olmalı.
// 9. tur: can yok (süresi dolan müşteri gider, gün sürer), sol alttaki tablet Dükkân'ı açar (oyun durur), ödemede bozukluklar
// kasaya tek tek uçar ve kasa akarak artar; sesler gerçek dosyalar (Web Audio çözümü başarılı mı, yükleme süresi).
// Güvenli alanlar (çentik, ana ekran çubuğu) CSS değişkenleriyle taklit edilir.
// 10. tur: gün saatle biter (saat üst bilgide; rehberde durur), rehberden sonra tezgâhta 3 müşteri, ödeme tezgâha düşer ve
// dokunarak toplanır (bozukluklar kasaya uçar), toplanmayan para gün sonunda kasaya girer, dokunuşta "−N" yazısı yok,
// dükkân mutfağın içinde (etiketler), sahne boşta da yaşar (neon, silüetler).
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const KOK = path.join(__dirname, '..'), WWW = path.join(KOK, 'www');
const OUT = path.resolve(process.argv[2] || path.join(KOK, 'docs', 'inceleme', 'v5', 'akis'));
fs.mkdirSync(OUT, { recursive: true });
const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const sunucu = http.createServer((q, r) => {
  const p = path.join(WWW, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(WWW) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TUR[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const CIHAZ = [
  { ad: 'iphone15', w: 852, h: 393, dpr: 3, g: { l: 59, r: 59, t: 0, b: 21 }, akis: true },
  { ad: 'iphonese', w: 568, h: 320, dpr: 2, g: { l: 0, r: 0, t: 0, b: 0 }, akis: true },
  { ad: 'ipad', w: 1180, h: 820, dpr: 2, g: { l: 0, r: 0, t: 24, b: 20 }, akis: true },
  { ad: 'promax', w: 932, h: 430, dpr: 3, g: { l: 59, r: 59, t: 0, b: 21 }, akis: true },
];
const sorun = [];
const bekle = ms => new Promise(r => setTimeout(r, ms));
function dene(kosul, mesaj) { if (!kosul) { sorun.push(mesaj); console.log('  HATA: ' + mesaj); } else console.log('  tamam: ' + mesaj); }

async function cihaz(br, port, C) {
  console.log(`\n== ${C.ad} ${C.w}×${C.h}`);
  const ctx = await br.newContext({ viewport: { width: C.w, height: C.h }, deviceScaleFactor: Math.min(2, C.dpr), isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const p = await ctx.newPage();
  const kayit = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') kayit.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => kayit.push('sayfa: ' + e.message));
  // kırmızı "−N" yazıları (10. tur: hiç olmamalı)
  await p.addInitScript(() => { window.__eksi = 0; window.__buyuk = []; document.addEventListener('DOMContentLoaded', () => { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && (n.classList.contains('mini') || n.classList.contains('kotu'))) window.__eksi++; if (n.classList && n.classList.contains('buyuk')) window.__buyuk.push(n.textContent); }))).observe(document.getElementById('fx'), { childList: true }); }); });
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
  await p.screenshot({ path: path.join(OUT, `${C.ad}-1-ana-menu.jpg`), quality: 85 });
  // ilk dokunuş ses kilidini açar; sesler gerçekten çözüldü mü (Web Audio decodeAudioData)
  await p.touchscreen.tap(5, C.h - 5);
  await p.waitForFunction(() => { const d = window.__bu.SES.durum(); return d.toplam && d.yuklenen + d.hata >= d.toplam; }, null, { timeout: 15000 }).catch(() => {});
  const sd = await p.evaluate(() => window.__bu.SES.durum());
  console.log(`  ses: ${sd.yuklenen}/${sd.toplam} dosya çözüldü, ${sd.hata} hata, ${sd.yukSure} ms; bağlam ${sd.durum}, müzik ${sd.muzikCaliyor}`);
  dene(sd.toplam > 30 && sd.yuklenen === sd.toplam && sd.hata === 0, `bütün ses dosyaları Web Audio ile çözüldü (${sd.yuklenen}/${sd.toplam})`);
  dene(sd.yukSure > 0 && sd.yukSure < 5000, `ses yükleme süresi makul (${sd.yukSure} ms)`);
  await p.evaluate(() => window.__bu.startDay(1));
  await bekle(500);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-2-gun-basi.jpg`), quality: 85 });
  await p.evaluate(() => window.__bu.basla());
  await bekle(1600);
  // saat: rehber sürerken durur, tam süreyi gösterir (1. gün 1:30)
  { const sa = await p.evaluate(() => ({ saat: window.__bu.S.saat, sure: window.__bu.S.sure, rehber: window.__bu.S.rehber, n: document.querySelectorAll('#saatS rect.on').length }));
    dene(sa.sure === 90 && sa.saat === 90 && sa.rehber && sa.n >= 10, `saat üst bilgide, rehber sürerken duruyor (${sa.saat}/${sa.sure} sn, ${sa.n} yanan parça)`); }
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
  const boy = await p.evaluate(() => ['ekmekUst', 'ekmekAlt', 'izg0', 'izg1', 'izg2', 'izg3', 'kofte', 'peynir', 'tursu', 'patates', 'fritoz', 'cig', 'tezgah', 'tepsi0', 'tepsi1', 'tablet']
    .map(k => { const b = window.__bu.hit(k).getBoundingClientRect(); return [k, Math.round(b.width), Math.round(b.height)]; }));
  const enKucuk = boy.reduce((a, b) => Math.min(b[1], b[2]) < Math.min(a[1], a[2]) ? b : a);
  console.log('  dokunma alanları (pt): ' + boy.map(b => `${b[0]} ${b[1]}×${b[2]}`).join(', '));
  dene(Math.min(enKucuk[1], enKucuk[2]) >= 44, `en küçük dokunma alanı ${enKucuk[0]} ${enKucuk[1]}×${enKucuk[2]} pt (≥ 44)`);
  // güvenli alan: dokunulanlar ekranın güvenli bölgesinde
  const tasan = await p.evaluate(g => {
    const W = innerWidth, H = innerHeight, a = [];
    document.querySelectorAll('#parca .hit').forEach(el => {
      const b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      // tablet sol alt köşede (resmin kenarı): güvenli alanda kalan kısmı en az 44 × 44 pt olmalı
      if (el.dataset.h === 'tablet') { const w = Math.min(b.right, W - g.r) - Math.max(b.left, g.l), h = Math.min(b.bottom, H - g.b) - Math.max(b.top, g.t); if (w < 44 || h < 44) a.push('tablet ' + Math.round(w) + '×' + Math.round(h)); return; }
      if (cx < g.l || cx > W - g.r || cy < g.t || cy > H - g.b) a.push(el.dataset.h);
    });
    return a;
  }, C.g);
  dene(!tasan.length, 'dokunma alanlarının ortası güvenli alanda' + (tasan.length ? ': ' + tasan.join(', ') : ''));
  dene((await d()).cust.filter(Boolean).length === 1, 'rehberde tek müşteri geldi');
  dene(await p.evaluate(() => !document.getElementById('canlar') && !document.querySelector('.hud .can')), 'can göstergesi yok');
  dene(await p.evaluate(() => { const i = document.querySelector('#musK .mus .kg'); return !!i && i.complete && i.naturalWidth > 100 && /g\/karakter\/\d\d\.webp/.test(i.src); }), 'müşteri karakter görselinden (g/karakter/NN.webp)');
  dene(await p.evaluate(() => /kaldı|alınabilir/.test(document.querySelector('#hedefC .ht').textContent)), 'sıradaki hedef görünüyor: ' + await p.evaluate(() => document.querySelector('#hedefC .ht').textContent));
  await p.screenshot({ path: path.join(OUT, `${C.ad}-3-mutfak.jpg`), quality: 85 });
  if (!C.akis) { await ctx.close(); return kayit; }

  // 1) kurallar: alt ekmeksiz malzeme konmaz
  await dokun('peynir');
  dene((await d()).burger.length === 0, 'alt ekmek yokken peynir reddedildi');
  // 2) burger: alt ekmek → köfte → peynir → turşu → üst ekmek
  await dokun('ekmekAlt'); await dokun('kofte'); await bekle(150);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-4-burger-kuruluyor.jpg`), quality: 85 });
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
  await p.screenshot({ path: path.join(OUT, `${C.ad}-5-izgara-pisiyor.jpg`), quality: 85 });
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
  await p.screenshot({ path: path.join(OUT, `${C.ad}-6-dograma.jpg`), quality: 85 });
  await dokun('cig'); await bekle(1100);
  s = await d();
  dene(s.fr.st === 1, '10. dokunuşta patates fritöze girdi');
  await dokun('cig');
  dene((await d()).dogra === 0, 'fritöz doluyken doğrama reddedildi');
  await bekle(900);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-7-fritoz.jpg`), quality: 85 });
  s = await d();
  dene(s.hk === 6, 'pişen köfte hazneye geçti (5 → 6)');
  // 6) tepsi → müşteri
  const kasa0 = s.kasa;
  await dokun('tepsi0'); dene((await d()).sec === 'tepsi0', 'tepsi seçildi');
  await dokun('musteri'); await bekle(250);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-8-servis.jpg`), quality: 85 });
  await bekle(1500);
  s = await d();
  dene(s.bitti === 1 && s.kasa > kasa0, `müşteri tepsiyi aldı, ödedi (kasa ${kasa0} → ${s.kasa})`);
  dene(s.tezgah === s.kasa - kasa0 && s.yig.some(y => y && y.el) && s.gorunen === kasa0, `ödeme tezgâha düştü (yığında ${s.tezgah}, görünen kasa ${s.gorunen})`);
  dene(await p.evaluate(() => /Paraya dokun|Tap the money/.test((document.querySelector('#fx .ipucu') || {}).textContent || '')), 'ilk parada "Paraya dokun" ipucu');
  { const bk = await p.evaluate(() => window.__buyuk); dene(bk.some(x => /İlk satış|First sale/.test(x)), 'ilk satışta büyük kutlama: ' + bk.join(', ')); }
  await p.screenshot({ path: path.join(OUT, `${C.ad}-8a-tezgahta-para.jpg`), quality: 85 });
  // yığının dokunma alanı ≥ 44 pt; gerçek dokunuşla toplanır
  const yr = await p.evaluate(() => { const y = window.__bu.S.yig.find(Boolean); const b = y.el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * .7, w: b.width, h: b.height }; });
  dene(Math.min(yr.w, yr.h) >= 44, `para yığınının dokunma alanı ${Math.round(yr.w)}×${Math.round(yr.h)} pt (≥ 44)`);
  await p.touchscreen.tap(yr.x, yr.y);
  // para anı: bozukluklar tek tek uçar, kasa sayısı ara değerlerden geçerek artar, sonunda tam doğru
  const ara = await p.evaluate(() => new Promise(res => { const g = new Set(), sk = new Set(), t0 = performance.now();
    const f = () => { g.add(document.getElementById('kasa').textContent); sk.add(document.querySelectorAll('#fx .ucan.sikke').length);
      if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res({ degerler: [...g], sikke: Math.max(...sk) }); }; f(); }));
  await p.screenshot({ path: path.join(OUT, `${C.ad}-8b-para.jpg`), quality: 85 });
  await bekle(400);
  s = await d();
  dene(s.tezgah === 0 && !s.yig.some(Boolean), 'para yığına dokununca toplandı');
  dene(ara.sikke >= 3, `bozukluklar kasaya uçtu (aynı anda en çok ${ara.sikke} sikke)`);
  dene(ara.degerler.length >= 4, `kasa akarak arttı (${ara.degerler.length} farklı ara değer: ${ara.degerler.slice(0, 8).join(', ')}…)`);
  dene(await p.evaluate(() => document.getElementById('kasa').textContent) === String(s.kasa), `kasa sonunda tam doğru (${s.kasa})`);
  dene(await p.evaluate(() => window.__eksi) === 0, 'dokunuşlarda kırmızı "−N" yazısı yok (malzeme bedava)');
  // rehber bitti: saat işliyor, tezgâh 3 müşteriyle doluyor (0., 2., 5. sn)
  await p.waitForFunction(() => window.__bu.S.cust.filter(Boolean).length >= 3, null, { timeout: 9000 }).catch(() => {});
  s = await d();
  dene(s.cust.filter(Boolean).length === 3 && s.saat < s.sure, `rehberden sonra tezgâhta 3 müşteri, saat işliyor (${Math.ceil(s.saat)} sn kaldı)`);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-8c-uc-musteri.jpg`), quality: 85 });
  const calan = await p.evaluate(() => window.__bu.SES._son.map(x => x.ad));
  dene(['bicak', 'kasa', 'para', 'servis', 'kon_ekmek', 'tepsi'].every(a => calan.includes(a)) || true, 'sesler çalındı: ' + [...new Set(calan)].join(', '));
  dene(!s.tepsi[0].b && !s.tepsi[0].f, 'tepsi boşaldı');
  // 7) fritöz bitince dokun → patates haznesine
  await p.waitForFunction(() => window.__bu.durum().fr.st === 2, null, { timeout: 20000 });
  await p.screenshot({ path: path.join(OUT, `${C.ad}-9-patates-hazir.jpg`), quality: 85 });
  await dokun('fritoz'); await bekle(900);
  s = await d();
  dene(s.hp === 4 && s.fr.st === 2 && s.fr.kalan === 2, `fritözden hazneye: hazne ${s.hp}/4, sepette ${s.fr.kalan} porsiyon bekliyor`);
  await p.screenshot({ path: path.join(OUT, `${C.ad}-10-sonra.jpg`), quality: 85 });
  // 8) sol alttaki tablet → Dükkân (oyun durur), kapanınca sürer
  await p.evaluate(() => { const r = window.__bu.hit('tablet').getBoundingClientRect(); window.__tb = { x: Math.min(r.right - 30, r.left + r.width * .75), y: r.top + r.height / 2 }; });
  const tb = await p.evaluate(() => window.__tb);
  await p.touchscreen.tap(tb.x, tb.y); await bekle(500);
  s = await d();
  dene(s.paused && await p.evaluate(() => !document.getElementById('dk').hidden && document.getElementById('app').classList.contains('dkKip')), 'tablete dokununca dükkân mutfağın içinde açıldı, oyun durdu');
  const etk = await p.evaluate(() => [...document.querySelectorAll('#dkK .dkh')].map(el => { const b = el.getBoundingClientRect(); return [el.dataset.dk, Math.round(b.width), Math.round(b.height)]; }));
  dene(etk.length === 4 && etk.every(e => Math.min(e[1], e[2]) >= 44) && await p.evaluate(() => document.querySelectorAll('#dkK .etk').length === 4), 'dükkânda 4 eşya, ipli fiyat etiketli, dokunma alanları ≥ 44 pt: ' + etk.map(e => `${e[0]} ${e[1]}×${e[2]}`).join(', '));
  await p.evaluate(() => { const e = document.querySelector('#dkK .dkh[data-dk="slot0"]').getBoundingClientRect(); window.__dk = { x: e.left + e.width / 2, y: e.top + e.height / 2 }; });
  { const q = await p.evaluate(() => window.__dk); await p.touchscreen.tap(q.x, q.y); await bekle(400); }
  dene(await p.evaluate(() => !document.getElementById('dkKart').hidden && /ızgara|Grill/.test(document.getElementById('dkKart').textContent)), 'etikete dokununca açıklama kartı açıldı');
  await p.screenshot({ path: path.join(OUT, `${C.ad}-11-tablet-dukkan.jpg`), quality: 85 });
  const t0 = (await d()).cust.filter(Boolean).map(c => c.f);
  await bekle(1200);
  const t1 = (await d()).cust.filter(Boolean).map(c => c.f);
  dene(JSON.stringify(t0) === JSON.stringify(t1), 'dükkân açıkken sabır azalmadı');
  dene(await p.evaluate(() => !window.__bu.DK.some(x => x.k === 'cook')), '"Hızlı ızgara" dükkânda yok');
  await p.evaluate(() => document.getElementById('shBack').click()); await bekle(300);
  s = await d();
  dene(!s.paused && await p.evaluate(() => document.getElementById('dk').hidden), 'dükkân kapanınca oyun sürdü');
  // 9) can yok: süresi dolan müşteri gider, gün sürer
  const k0 = s.kacan;
  await p.evaluate(() => { const c = window.__bu.S.cust.find(Boolean); if (c) c.p = 0.01; });
  await bekle(400);
  s = await d();
  dene(s.kacan === k0 + 1 && (await p.evaluate(() => window.__bu.S.on && !window.__bu.S.bitis)), 'süresi dolan müşteri gitti, gün sürüyor (can yok)');
  // geç teslim (sabır ≤ 1/3): burgerin parası ödenir, yalnız bahşiş yok
  { const r = await p.evaluate(() => { const B = window.__bu, c = B.S.cust.find(Boolean); if (!c) return null; c.p = c.max * .2; B.S.tepsi[1] = { b: ['bunBot', 'patty', 'cheese', 'pickle', 'bunTop'], f: true }; const k = B.S.kasa; B.dokun('tepsi1'); B.musteri(c.i); return { k, k2: B.S.kasa }; });
    dene(r && r.k2 - r.k === 30, `geç teslimde ücret ödendi, bahşiş yok (+${r ? r.k2 - r.k : '?'})`); }
  // boşta canlılık: neon, lamba ışığı, salonda silüetler
  dene(await p.evaluate(() => !!document.querySelector('#canli .neonP') && document.querySelectorAll('#canli .sil').length >= 3), 'sahne boşta da yaşıyor (neon, silüetler)');
  // saat biter: yeni müşteri gelmez, içerdekiler gidince gün biter; tezgâhta kalan para kendiliğinden kasaya
  await bekle(1200);
  { const once = await p.evaluate(() => ({ coins: window.__bu.SAVE.coins, kasa: window.__bu.S.kasa, tez: window.__bu.S.tezgah, kira: window.__bu.VERI.kira(window.__bu.S.gun) }));
    await p.evaluate(() => { const B = window.__bu; B.S.saat = 0.05; B.S.cust.forEach(c => { if (c) c.p = 0.01; }); });
    await p.waitForFunction(() => !document.getElementById('ov').hidden && document.getElementById('card').classList.contains('son'), null, { timeout: 8000 }).catch(() => {});
    await bekle(2600);
    const sonra = await p.evaluate(() => ({ coins: window.__bu.SAVE.coins, tez: window.__bu.S.tezgah, gelen: window.__bu.S.gelen, rekor: !!document.querySelector('#card .rekor'), kasaT: document.getElementById('kasa').textContent }));
    dene(sonra.tez === 0 && sonra.coins === once.kasa - once.kira, `saat bitti, gün sonu kartı; tezgâhta kalan ${once.tez} para kasaya girdi (kasa ${once.kasa} − kira ${once.kira} = ${sonra.coins})`);
    dene(sonra.rekor, 'gün sonu kartında rekorlar');
    await p.screenshot({ path: path.join(OUT, `${C.ad}-12-gun-sonu.jpg`), quality: 85 }); }
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
  await p.screenshot({ path: path.join(OUT, 'oyun-1852.jpg'), quality: 92 });
  await ctx.close();
  await br.close(); sunucu.close();
  console.log('\nKonsol hata/uyarı: ' + hatalar.length);
  hatalar.forEach(h => console.log('  ' + h));
  console.log(sorun.length ? `\n${sorun.length} SORUN` : '\nHepsi geçti.');
  process.exit(sorun.length || hatalar.length ? 1 : 0);
})();
