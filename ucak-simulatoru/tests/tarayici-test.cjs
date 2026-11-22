// Tarayıcı denemesi (Playwright): sayfa açılır, konsol hatası aranır, klavyeyle kalkış yapılır,
// ekran görüntüleri docs/ekran/ içine alınır.  Önce: (cd www && python3 -m http.server 8765)
// Çalıştır: node tests/tarayici-test.cjs [adres]
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const URL = process.argv[2] || 'http://localhost:8765/index.html';
const OUT = path.join(__dirname, '..', 'docs', 'ekran');
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitWorld(p, ms = 60000) {
  await p.waitForFunction(() => { const w = __ucak.world; const c = __ucak.camera.position; return w.inflight === 0 && w.pendingNear(c, w.buildDist) === 0; }, null, { timeout: ms }).catch(() => console.log('  (binalar tam yüklenmedi)'));
}
async function shot(p, name) { await p.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 78 }); console.log('  görüntü:', name); }

async function takeoff(p) {
  // menüden başla (pistten kalk, Cessna)
  await p.click('[data-val="c172"]'); await p.click('[data-val="pist"]');
  await p.click('#bStart');
  await waitWorld(p);
  // kalkış: tam gaz
  await p.keyboard.press('Digit0');
  let shotDone = false; let t = 0, rotated = false, lift = null, x0 = await p.evaluate(() => [__ucak.ac.pos[0], __ucak.ac.pos[1]]);
  while (t < 300) {
    await sleep(250); t += 0.25;
    const s = await p.evaluate(() => ({ v: __ucak.ac.out.V / 0.514444, alt: __ucak.ac.alt, g: __ucak.ac.onGround, c: __ucak.ac.crashed, n: __ucak.ac.pos[0], e: __ucak.ac.pos[1], th: __ucak.ac.ctl.throttle, th8: Math.asin(Math.max(-1, Math.min(1, 2 * (__ucak.ac.q[0] * __ucak.ac.q[2] - __ucak.ac.q[3] * __ucak.ac.q[1])))) > 0.105 }));
    if (s.c) { console.log('  KAZA:', s.c); break; }
    // yerde pedalla (Q/E) pist eksenini tut, havada kanatçıkla (A/D) kanatları düz tut
    const att = await p.evaluate(() => { const q = __ucak.ac.q; return { psi: Math.atan2(2 * (q[0] * q[3] + q[1] * q[2]), 1 - 2 * (q[2] * q[2] + q[3] * q[3])) - __ucak.world.rw.heading, phi: Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) }; });
    for (const k of ['KeyA', 'KeyD', 'KeyQ', 'KeyE']) await p.keyboard.up(k);
    if (s.g) { const k = att.psi > 0.02 ? 'KeyQ' : att.psi < -0.02 ? 'KeyE' : null; if (k) { await p.keyboard.down(k); await sleep(90); await p.keyboard.up(k); } }
    else { if (att.phi > 0.05) await p.keyboard.down('KeyA'); else if (att.phi < -0.05) await p.keyboard.down('KeyD'); }
    if (!rotated && s.v > 60) { rotated = true; console.log(`  rotasyon: ${s.v.toFixed(0)} kt`); }
    // levyeyi yumuşak çek: burun 8°'ye gelene kadar
    if (rotated) { if (s.th8) await p.keyboard.up('KeyS'); else await p.keyboard.down('KeyS'); }
    if (rotated && !s.g && lift == null) { lift = Math.hypot(s.n - x0[0], s.e - x0[1]); console.log(`  teker kesti: ${lift.toFixed(0)} m, ${s.v.toFixed(0)} kt`); }
    if (!rotated && s.v > 45 && !shotDone) { shotDone = true; await shot(p, 'kalkis.jpg'); }
    if (lift != null && s.alt > 120) { console.log(`  tırmanış: ${s.alt.toFixed(0)} m, ${s.v.toFixed(0)} kt`); break; }
  }
  await p.keyboard.up('KeyS');
  const res = await p.evaluate(() => ({ alt: __ucak.ac.alt, crashed: __ucak.ac.crashed }));
  console.log('  kalkış sonucu:', JSON.stringify(res), 'mesafe', lift);
  if (lift == null || res.crashed) errors.push('kalkış başarısız');

}

(async () => {
  const b = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  // 1) kalkış: küçük pencere, düşük grafik (yazılımsal WebGL'de kare hızı yetsin diye)
  const k = await b.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  await k.addInitScript(() => localStorage.setItem('istanbul-ucusu-v1', JSON.stringify({ quality: 'dusuk', plane: 'c172', start: 'pist' })));
  k.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  k.on('pageerror', (e) => errors.push(e.message));
  await k.goto(URL);
  await k.waitForFunction(() => window.__ucak && window.__ucak.ready, null, { timeout: 120000 });
  await takeoff(k);
  await k.close();

  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.addInitScript(() => localStorage.setItem('istanbul-ucusu-v1', JSON.stringify({ quality: 'yuksek' })));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.__ucak && window.__ucak.ready, null, { timeout: 120000 });
  await shot(p, 'menu.jpg');
  await p.click('[data-val="c172"]'); await p.click('[data-val="hava"]');
  await p.click('#bStart');
  // manzara görüntüleri (havada, dengeli uçuş)
  const scenes = [
    ['kopru-15temmuz.jpg', 41.030, 29.020, 180, 30, 100, 0.5, 0.05],
    ['tarihi-yarimada.jpg', 41.0125, 28.9935, 150, 245, 100, 0.55, 0.12],
    ['galata-halic.jpg', 41.0185, 28.977, 150, 340, 100, 0.9, 0.05],
    ['fsm-rumelihisari.jpg', 41.070, 29.048, 170, 15, 100, -0.4, 0.05],
  ];
  for (const [name, lat, lon, alt, hdg, kt, oy, op] of scenes) {
    await p.evaluate(([lat, lon, alt, hdg, kt, oy, op]) => { __ucak.setCam(0); __ucak.place(lat, lon, alt, hdg, kt); __ucak.orbit(oy, op, 1.3); }, [lat, lon, alt, hdg, kt, oy, op]);
    await waitWorld(p); await sleep(1500);
    await shot(p, name);
  }
  // kokpit
  await p.evaluate(() => { __ucak.place(41.035, 29.012, 220, 25, 100); __ucak.setCam(1); __ucak.orbit(0, 0); });
  await waitWorld(p); await sleep(1200); await shot(p, 'kokpit.jpg');
  // jet: Levent ve Maslak
  await p.evaluate(() => { __ucak.settings.plane = 'jet'; __ucak.settings.start = 'hava'; __ucak.start(); __ucak.setCam(0); __ucak.place(41.060, 29.025, 260, 330, 240); __ucak.orbit(2.6, 0.15, 1.2); });
  await waitWorld(p); await sleep(1500); await shot(p, 'levent-jet.jpg');
  const perf = await p.evaluate(() => ({ calls: __ucak.renderer.info.render.calls, tris: __ucak.renderer.info.render.triangles }));
  console.log('  çizim:', JSON.stringify(perf));
  await p.evaluate(() => { __ucak.settings.plane = 'c172'; __ucak.settings.start = 'pist'; });
  await p.close();

  // iPhone yatay (dokunmatik düzen)
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const m = await ctx.newPage();
  m.on('pageerror', (e) => errors.push('iphone: ' + e.message));
  await m.goto(URL);
  await m.waitForFunction(() => window.__ucak && window.__ucak.ready, null, { timeout: 120000 });
  await m.tap('[data-val="hava"]'); await m.tap('#bStart');
  await waitWorld(m); await sleep(1500);
  await m.screenshot({ path: path.join(OUT, 'iphone-yatay.jpg'), type: 'jpeg', quality: 78 }); console.log('  görüntü: iphone-yatay.jpg');
  // dokunmatik levye ve gaz kolu çalışıyor mu
  const box = await m.locator('#stick').boundingBox();
  await m.dispatchEvent('#stick', 'pointerdown', { pointerId: 7, clientX: box.x + box.width / 2 + 40, clientY: box.y + box.height / 2, isPrimary: true });
  await m.waitForFunction(() => __ucak.input.roll > 0.2, null, { timeout: 15000 }).catch(() => {});
  const st = await m.evaluate(() => __ucak.input.roll);
  await m.dispatchEvent('#stick', 'pointerup', { pointerId: 7 });
  console.log('  dokunmatik levye yatış girdisi:', st.toFixed(2));
  if (!(st > 0.2)) errors.push('dokunmatik levye çalışmadı');
  await b.close();
  console.log(errors.length ? 'HATALAR:\n' + errors.join('\n') : 'Konsol hatası yok, kalkış başarılı');
  process.exit(errors.length ? 1 : 0);
})();
