// Tarayıcı denemesi (Playwright): sayfa açılır, konsol hatası aranır, Cessna klavyeyle kalkar, F-16 sınıfı jetle
// takla ve tonoz yapılır (test kancası __ucak), Türkiye'nin çeşitli yerlerinden ekran görüntüleri docs/ekran/ içine alınır.
// Önce: (cd www && python3 -m http.server 8765)   Çalıştır: node tests/tarayici-test.cjs [adres]
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const URL = process.argv[2] || 'http://localhost:8765/index.html';
const OUT = path.join(__dirname, '..', 'docs', 'ekran');
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (k) => !ONLY || ONLY.includes(k);
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function settle(p, ms = 90000) {
  const t0 = Date.now();
  await sleep(2500);
  while (Date.now() - t0 < ms) { const s = await p.evaluate(() => __ucak.stats()); if (s.pending === 0) return s; await sleep(700); }
  console.log('  (veri tam yüklenmedi)'); return p.evaluate(() => __ucak.stats());
}
async function shot(p, name) { await p.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 72, timeout: 180000 }); console.log('  görüntü:', name); }
async function page(b, opt, store) {
  const p = await b.newPage(opt);
  await p.addInitScript((s) => localStorage.setItem('istanbul-ucusu-v1', JSON.stringify(Object.assign({ v2: true }, s))), store);
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.__ucak && window.__ucak.ready, null, { timeout: 120000 });
  return p;
}
async function begin(p, start, plane = 'f16') {
  await p.evaluate(([s, pl]) => { __ucak.settings.start = s; __ucak.settings.plane = pl; return __ucak.start(); }, [start, plane]);
  await p.waitForFunction(() => __ucak.ac, null, { timeout: 120000 });
}

async function takeoff(p) {
  await begin(p, 'pist', 'c172');
  await settle(p, 40000);
  await p.keyboard.press('Digit0');
  let t = 0, rotated = false, lift = null;
  const x0 = await p.evaluate(() => [__ucak.ac.pos[0], __ucak.ac.pos[1]]);
  while (t < 300) {
    await sleep(250); t += 0.25;
    const s = await p.evaluate(() => { const a = __ucak.ac, q = a.q; return { v: a.out.V / 0.514444, alt: a.alt, g: a.onGround, c: a.crashed, n: a.pos[0], e: a.pos[1],
      psi: Math.atan2(2 * (q[0] * q[3] + q[1] * q[2]), 1 - 2 * (q[2] * q[2] + q[3] * q[3])) - __ucak.world.rw.heading, phi: Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])),
      th8: Math.asin(Math.max(-1, Math.min(1, 2 * (q[0] * q[2] - q[3] * q[1])))) > 0.105 }; });
    if (s.c) { console.log('  KAZA:', s.c); break; }
    for (const k of ['KeyA', 'KeyD', 'KeyQ', 'KeyE']) await p.keyboard.up(k);
    if (s.g) { const k = s.psi > 0.02 ? 'KeyQ' : s.psi < -0.02 ? 'KeyE' : null; if (k) { await p.keyboard.down(k); await sleep(90); await p.keyboard.up(k); } }
    else { if (s.phi > 0.05) await p.keyboard.down('KeyA'); else if (s.phi < -0.05) await p.keyboard.down('KeyD'); }
    if (!rotated && s.v > 60) { rotated = true; console.log(`  rotasyon: ${s.v.toFixed(0)} kt`); }
    if (rotated) { if (s.th8) await p.keyboard.up('KeyS'); else await p.keyboard.down('KeyS'); }
    if (rotated && !s.g && lift == null) { lift = Math.hypot(s.n - x0[0], s.e - x0[1]); console.log(`  teker kesti: ${lift.toFixed(0)} m, ${s.v.toFixed(0)} kt`); }
    if (lift != null && s.alt > 120) { console.log(`  tırmanış: ${s.alt.toFixed(0)} m, ${s.v.toFixed(0)} kt`); break; }
  }
  await p.keyboard.up('KeyS');
  const res = await p.evaluate(() => ({ alt: __ucak.ac.alt, crashed: __ucak.ac.crashed }));
  console.log('  Cessna kalkış:', JSON.stringify(res), 'mesafe', lift && Math.round(lift));
  if (lift == null || res.crashed) errors.push('Cessna kalkışı başarısız');
}

// F-16: takla (levye %80 geri, ard yakıcı) ve tonoz; uçuş zamanı yazılımsal WebGL'de yavaş akar, gerçek süre beklenir
async function aerobatics(p) {
  await begin(p, 'bogaz', 'f16');
  await p.evaluate(() => { __ucak.freeze(true); __ucak.smoke(true); });
  await settle(p, 60000);
  await p.evaluate(() => { __ucak.input.throttle = 1; __ucak.freeze(false); });
  const fwd = () => p.evaluate(() => { const q = __ucak.ac.q; const m2 = 2 * (q[1] * q[3] - q[0] * q[2]), m0 = 1 - 2 * (q[2] * q[2] + q[3] * q[3]); return { a: Math.atan2(-m2, m0), t: __ucak.ac.time, alt: __ucak.ac.alt, c: __ucak.ac.crashed, al: __ucak.ac.out.alpha * 57.3, st: __ucak.ac.stallS, inv: (1 - 2 * (q[1] * q[1] + q[2] * q[2])) < -0.5 }; });
  let s = await fwd(); let prev = s.a, acc = 0, amax = 0, smax = 0, h0 = s.alt, invShot = false;
  await p.evaluate(() => { __ucak.input.stick = { x: 0, y: -0.8 }; });
  const t0 = s.t;
  while (acc < 2 * Math.PI && s.t - t0 < 60) {
    await sleep(120); s = await fwd();
    let d = s.a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; acc += d; prev = s.a;
    amax = Math.max(amax, s.al); smax = Math.max(smax, s.st);
    if (s.c) break;
    if (!invShot && s.inv && acc > 2.6) { invShot = true; await p.evaluate(() => { __ucak.freeze(true); __ucak.input.stick = null; __ucak.orbit(2.4, -0.3, 0.6); }); await sleep(3500); await shot(p, 'jet-takla-bogaz.jpg'); await p.evaluate(() => { __ucak.orbit(0, 0, 1); __ucak.input.stick = { x: 0, y: -0.8 }; __ucak.freeze(false); }); }
  }
  await p.evaluate(() => { __ucak.input.stick = null; });
  console.log(`  takla: ${(acc * 57.3).toFixed(0)}°, ${(s.t - t0).toFixed(1)} sn uçuş, en büyük hücum ${amax.toFixed(1)}°, tutunma ${smax.toFixed(2)}, irtifa ${h0.toFixed(0)} -> ${s.alt.toFixed(0)} m, kaza: ${s.c}`);
  if (s.c || acc < 2 * Math.PI || smax > 0.05) errors.push('takla başarısız');
  // tonoz: tam yatış 1.5 sn
  const r = await p.evaluate(async () => { const a = __ucak.ac; let pm = 0; __ucak.input.stick = { x: 1, y: 0 }; const t0 = a.time; while (a.time - t0 < 1.5) { await new Promise((r) => setTimeout(r, 30)); pm = Math.max(pm, a.w[0]); } __ucak.input.stick = null; return { pm: pm * 57.3, c: a.crashed }; });
  console.log(`  tonoz: en büyük yuvarlanma hızı ${r.pm.toFixed(0)}°/sn, kaza: ${r.c}`);
  if (r.c || r.pm < 180) errors.push('tonoz başarısız');
  await sleep(2500);
  const c = await p.evaluate(() => __ucak.ac.crashed);
  if (c) errors.push('akrobasi sonrası kaza: ' + c);
}

// bir noktaya uçağı koy, dondur, yükle, görüntü al
// alt < 0: yerden yükseklik (-alt)
async function view(p, name, [lat, lon, alt, hdg, kt], orbit = [0, 0, 1], cam = 0, extra = null) {
  await p.evaluate(([la, lo, al, h, k]) => { __ucak.freeze(true); if (al < 0) { const q = __ucak.geo(la, lo); al = __ucak.world.terrainH(q.x, q.y) - al; } __ucak.place(la, lo, al, h, k); }, [lat, lon, alt, hdg, kt]);
  await p.evaluate(([c, y, pi, d]) => { __ucak.setCam(c); __ucak.orbit(y, pi, d); }, [cam, ...orbit]);
  if (extra) await p.evaluate(extra);
  const st = await settle(p);
  await sleep(1500);
  const s2 = await p.evaluate(() => __ucak.stats());
  console.log('  ', name, JSON.stringify({ calls: s2.calls, tris: s2.tris, terrain: s2.terrainNodes, bina: s2.bNodes }));
  await shot(p, name);
}

(async () => {
  const b = await pw.chromium.launch({ args: ARGS });
  if (want('kalkis')) { const k = await page(b, { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }, { quality: 'dusuk', plane: 'c172' }); await takeoff(k); await k.close(); }
  const p = await page(b, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, { quality: 'yuksek' });
  if (want('menu')) await shot(p, 'menu.jpg');
  if (want('akrobasi')) await aerobatics(p);
  if (want('ekran')) {
    if (!(await p.evaluate(() => __ucak.ac))) await begin(p, 'bogaz', 'f16');
    await p.evaluate(() => { __ucak.smoke(false); });
    await view(p, 'jet-yakin.jpg', [41.045, 29.02, 420, 25, 360], [2.3, 0.15, 0.62]);
    await view(p, 'istanbul-3b.jpg', [41.005, 28.955, 700, 40, 330], [0.0, 0.18, 1.0]);
    await view(p, 'levent-maslak.jpg', [41.06, 28.985, 380, 20, 300], [0.4, 0.05, 0.9]);
    await p.evaluate(() => __ucak.prepare(39.925, 32.837));
    await view(p, 'ankara-anitkabir.jpg', [39.9262, 32.8285, -170, 100, 280], [0.45, 0.2, 0.85]);
    await p.evaluate(() => __ucak.prepare(38.64, 34.83));
    await view(p, 'kapadokya.jpg', [38.622, 34.808, -230, 35, 280], [0.35, 0.08, 0.9]);
    await p.evaluate(() => __ucak.prepare(39.70, 44.30));
    await view(p, 'agri-dagi.jpg', [39.58, 44.10, 4400, 45, 330], [0.3, 0.02, 0.9]);
    await p.evaluate(() => __ucak.map(true)); await sleep(800); await shot(p, 'turkiye-haritasi.jpg'); await p.evaluate(() => __ucak.map(false));
  }
  await p.close();
  if (want('iphone')) {
    const dev = pw.devices['iPhone 13 landscape'];
    const ip = await page(b, { ...dev, deviceScaleFactor: 1 }, {});
    await shot(ip, 'iphone-menu.jpg');
    await begin(ip, 'bogaz', 'f16');
    await ip.evaluate(() => __ucak.freeze(true));
    await settle(ip); await sleep(1500);
    console.log('  iPhone (orta kalite) Boğaz:', JSON.stringify(await ip.evaluate(() => __ucak.stats())));
    await ip.evaluate(() => __ucak.freeze(false));
    // dokunmatik levye: sağ alt, yukarı-sağa sürükle
    const box = await ip.locator('#stick').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await ip.touchscreen.tap(cx, cy);
    // kolay kumanda: analog sağda, gaz solda; flap/trim düğmeleri yok, takım ve fren var
    const lay = await ip.evaluate(() => { const st = document.querySelector('#stick').getBoundingClientRect(), th = document.querySelector('#thr').getBoundingClientRect();
      return { stickRight: st.left > innerWidth / 2, thrLeft: th.right < innerWidth / 2, hidden: ['#bFlapD', '#bFlapU', '#bTrimU', '#bTrimD'].every((s) => getComputedStyle(document.querySelector(s)).display === 'none'), shown: ['#bGear', '#bBrake'].every((s) => getComputedStyle(document.querySelector(s)).display !== 'none') }; });
    console.log('  kolay kumanda yerleşimi:', JSON.stringify(lay));
    if (!lay.stickRight || !lay.thrLeft || !lay.hidden || !lay.shown) errors.push('kolay kumanda yerleşimi yanlış');
    // analog yukarı: burun yukarı (yunuslama hızı artı)
    await ip.evaluate(() => { const ac = __ucak.ac; __ucak.q0 = ac.out.alpha; });
    const cdp = await ip.context().newCDPSession(ip);
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await tp('touchStart', cx, cy); await tp('touchMove', cx, cy - box.height * 0.3);
    let qmax = -9; for (let i = 0; i < 8; i++) { await sleep(250); qmax = Math.max(qmax, await ip.evaluate(() => __ucak.ac.w[1])); }
    await tp('touchEnd', 0, 0);
    console.log('  analog yukarı: en büyük yunuslama hızı', (qmax * 57.3).toFixed(1), '°/sn');
    if (!(qmax > 0.02)) errors.push('analog yukarı burnu kaldırmadı');
    const ok = await ip.evaluate(() => ['#stick', '#thr', '#bSmoke', '#mini', '#bCam', '#bGear', '#bBrake'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), r.right <= innerWidth && r.bottom <= innerHeight && r.x >= 0 && r.y >= 0]; }));
    console.log('  dokunmatik düğmeler:', JSON.stringify(ok));
    if (ok.some((r) => !r[5])) errors.push('dokunmatik düğme ekran dışında');
    await ip.tap('#bSmoke'); await sleep(2500);
    const sm = await ip.evaluate(() => document.querySelector('#bSmoke').classList.contains('on'));
    if (!sm) errors.push('DUMAN düğmesi çalışmadı');
    await shot(ip, 'iphone-yatay.jpg');
    await ip.close();
  }
  await b.close();
  console.log(errors.length ? 'HATALAR:\n' + errors.join('\n') : 'Hata yok');
  process.exit(errors.length ? 1 : 0);
})();
