// Dünya denemesi (Playwright): şehirler, havalimanları, pistler, yollar ve telefon görünümü için ekran görüntüleri
// ve çizim çağrısı / üçgen ölçümü. Konsol hatası varsa başarısız sayılır.
// Önce: (cd www && python3 -m http.server 8766)
// Çalıştır: node tests/dunya-test.cjs [adres] [önek] [görünümler,virgüllü] [kalite]
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const URL = process.argv[2] || 'http://localhost:8766/index.html';
const PRE = process.argv[3] || '';
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;
const QUAL = process.argv[5] || 'yuksek';
const OUT = path.join(__dirname, '..', 'docs', 'ekran');
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (k) => !ONLY || ONLY.includes(k);

// [ad, [enlem, boylam, irtifa (eksi: yerden), gerçek baş, kt], [kamera yaw, pitch, uzaklık], kamera kipi]
const VIEWS = [
  ['istanbul-600', [41.005, 28.94, 600, 60, 300], [0.0, 0.25, 1.0]],
  ['levent-maslak', [41.06, 28.985, 380, 20, 300], [0.4, 0.05, 0.9]],
  ['istanbul-alcak', [41.035, 28.96, -120, 60, 250], [0.0, 0.1, 1.0]],
  // havalimanları: ['ad', 'ICAO', merkezden uzaklık (m), yerden yükseklik, baş (°, ızgara), kamera]
  ['ltfm', 'LTFM', 3200, 380, 150, [0, -0.5, 3.2]],
  ['ltfj', 'LTFJ', 2600, 300, 30, [0, -0.5, 3.2]],
  ['ltba', 'LTBA', 2200, 260, 40, [0, -0.5, 3.2]],
  ['ltac', 'LTAC', 2600, 300, 300, [0, -0.5, 3.2]],
  ['ltbj', 'LTBJ', 2400, 280, 250, [0, -0.5, 3.2]],
  ['ltai', 'LTAI', 2400, 280, 60, [0, -0.5, 3.2]],
  ['pist-yakin', 'LTBA', -1, 9, 0, [0.5, -0.12, 1.4]],
  ['terminal-ltfm', 'LTFM', 857, 60, 180, [0.0, -0.3, 3.0], [657, -1057]],
  ['pist-ltfm', 'LTFM', -1, 10, 0, [0.6, -0.1, 1.4]],
  ['kucuk-sehir', [39.76, 37.00, -500, 20, 250], [0.0, 0.3, 1.0]],
  ['eskisehir', [39.75, 30.50, -450, 20, 250], [0.0, 0.3, 1.0]],
  ['yuksek-irtifa', [40.95, 29.10, 3500, 300, 300], [0.0, 0.35, 1.0]],
];

async function settle(p, ms = 120000) {
  const t0 = Date.now();
  await sleep(2500);
  while (Date.now() - t0 < ms) { const s = await p.evaluate(() => __ucak.stats()); if (s.pending === 0) return s; await sleep(700); }
  console.log('  (veri tam yüklenmedi)'); return p.evaluate(() => __ucak.stats());
}
async function shot(p, name) { await p.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 70, timeout: 180000 }); console.log('  görüntü:', name); }
async function page(b, opt, store) {
  const p = await b.newPage(opt);
  await p.addInitScript((s) => localStorage.setItem('istanbul-ucusu-v1', JSON.stringify(Object.assign({ v2: true }, s))), store);
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.__ucak && window.__ucak.ready, null, { timeout: 120000 });
  return p;
}
async function view(p, name, [lat, lon, alt, hdg, kt], orbit = [0, 0, 1], cam = 0, offs = null) {
  if (typeof lat === 'string') {
    // havalimanı görünümü: merkezden geriye 'lon' m, başı hdg olan, yerden 'alt' m yüksekte
    const r = await p.evaluate(([id, dist, agl, h, off]) => {
      const W = __ucak.world, a = W.hava.list.find((q) => q.id === id);
      let x, y, hd = h * Math.PI / 180;
      if (dist < 0) { const rw = W.rws.find((q) => q.code === id); x = rw.ax + rw.ux * 40; y = rw.ay + rw.uy * 40; hd = rw.heading; }
      else { x = a.x + off[0] - Math.sin(hd) * dist; y = a.y + off[1] - Math.cos(hd) * dist; }
      const g = __ucak.ungeo(x, y), n1 = __ucak.geo(g.lat + 0.01, g.lon), n0 = __ucak.geo(g.lat, g.lon), conv = Math.atan2(n1.x - n0.x, n1.y - n0.y); return [g.lat, g.lon, -agl, (hd - conv) * 180 / Math.PI];
    }, [lat, lon, alt, hdg, offs || [0, 0]]);
    [lat, lon, alt, hdg] = r; kt = 200;
  }
  await p.evaluate(([la, lo]) => __ucak.prepare(la, lo), [lat, lon]);
  await p.evaluate(([la, lo, al, h, k]) => { __ucak.freeze(true); if (al < 0) { const q = __ucak.geo(la, lo); al = Math.max(0, __ucak.world.terrainH(q.x, q.y)) - al; } __ucak.place(la, lo, al, h, k); }, [lat, lon, alt, hdg, kt]);
  await p.evaluate(([c, y, pi, d]) => { __ucak.setCam(c); __ucak.orbit(y, pi, d); }, [cam, ...orbit]);
  await settle(p);
  await sleep(1500);
  const s = await p.evaluate(() => __ucak.stats());
  const r = { name, calls: s.calls, tris: s.tris, terrain: s.terrainNodes, bina: s.bNodes };
  console.log('  ', JSON.stringify(r));
  await shot(p, PRE + name + '.jpg');
  return r;
}

(async () => {
  const b = await pw.chromium.launch({ args: ARGS });
  const res = [];
  const vs = VIEWS.filter((v) => want(v[0]));
  if (vs.length) {
    const p = await page(b, { viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 }, { quality: QUAL });
    await p.evaluate(() => { __ucak.settings.start = 'bogaz'; __ucak.settings.plane = 'f16'; return __ucak.start(); });
    await p.waitForFunction(() => __ucak.ac, null, { timeout: 120000 });
    for (const v of vs) { try { res.push(await (typeof v[1] === 'string' ? view(p, v[0], [v[1], v[2], v[3], v[4], 200], v[5], 0, v[6]) : view(p, v[0], v[1], v[2], v[3] || 0))); } catch (e) { errors.push(v[0] + ': ' + e.message); } }
    await p.close();
  }
  if (want('telefon')) {
    const dev = pw.devices['iPhone 13 landscape'];
    const ip = await page(b, { ...dev, deviceScaleFactor: 1 }, { quality: 'orta' });
    await ip.evaluate(() => { __ucak.settings.start = 'bogaz'; __ucak.settings.plane = 'f16'; return __ucak.start(); });
    await ip.waitForFunction(() => __ucak.ac, null, { timeout: 120000 });
    res.push(await view(ip, 'telefon-bogaz', [41.03, 29.012, 650, 25, 380], [0, 0, 1]));
    res.push(await view(ip, 'telefon-ltfm', [41.235, 28.715, -300, 20, 250], [0.3, 0.2, 1]));
    await ip.close();
  }
  fs.writeFileSync(path.join(OUT, PRE + 'olcum.json'), JSON.stringify(res, null, 1));
  await b.close();
  console.log(errors.length ? 'HATALAR:\n' + errors.join('\n') : 'Hata yok');
  process.exit(errors.length ? 1 : 0);
})();
