// Tarayıcı denemesi (Playwright): sayfa açılır, konsol hatası aranır, Cessna klavyeyle kalkar, F-16 sınıfı jetle
// takla ve tonoz yapılır (test kancası __ucak), Türkiye'nin çeşitli yerlerinden ekran görüntüleri docs/ekran/ içine alınır.
// 23 Kasım bölümleri: kokpit (üç uçağın içi, F-16 HUD), dugmeler (iPhone 13 ve SE yatay: simgeli düğmeler, 4 yön tuşu, çoklu
// dokunuş), takla (yön tuşuyla takla ve dik dalıştan çıkış, görüntü dizisi), gecis (geçiş kamerası titremesi ölçümü).
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
  await settle(p, 150000); // dünya büyüdü: yazılımsal WebGL'de veri daha geç oturur
  await p.keyboard.press('Digit0');
  let t = 0, rotated = false, lift = null;
  const x0 = await p.evaluate(() => [__ucak.ac.pos[0], __ucak.ac.pos[1]]);
  while (t < 900) {
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

// F-16 sahnede: verilen enlem, boylam, irtifa, baş ve hızla, kamerayla
async function fly(p, plane, [lat, lon, alt, hdg, kt], cam) {
  if (!(await p.evaluate((pl) => __ucak.ac && __ucak.settings.plane === pl, plane))) await begin(p, 'bogaz', plane);
  await p.evaluate(([la, lo, al, h, k, c]) => { __ucak.freeze(true); __ucak.place(la, lo, al, h, k); __ucak.setCam(c); __ucak.orbit(0, 0, 1); }, [lat, lon, alt, hdg, kt, cam]);
}

// kokpitler: üç uçağın içi, F-16'da geriye bakış ve HUD yakın görüntüsü
async function cockpits(b) {
  const p = await page(b, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, { quality: 'orta' });
  for (const [pl, kt] of [['f16', 340], ['c172', 100], ['jet', 260]]) {
    await fly(p, pl, [41.03, 29.012, 700, 25, kt], 1);
    await settle(p, 60000);
    await p.evaluate(() => { __ucak.freeze(false); __ucak.input.stick = { x: 0.25, y: -0.15 }; }); await sleep(3500);
    await p.evaluate(() => { __ucak.freeze(true); }); await sleep(800);
    const st = await p.evaluate(() => { const c = __ucak.cockpit; let n = 0, cv = 0; c.root.traverse((o) => { if (o.isMesh) n++; if (o.material && o.material.map && o.material.map.image && o.material.map.image.getContext && o.material.map.version > 1) cv++; }); return { meshes: n, liveScreens: cv, inExt: __ucak.model.root.parent !== __ucak.scene, fov: __ucak.camera.fov }; });
    console.log(`  kokpit ${pl}:`, JSON.stringify(st));
    if (st.meshes < 30 || st.liveScreens < 1 || !st.inExt) errors.push('kokpit eksik: ' + pl);
    await shot(p, `kokpit-${pl}.jpg`);
    if (pl === 'f16') {
      await p.screenshot({ path: path.join(OUT, 'kokpit-f16-hud.jpg'), type: 'jpeg', quality: 80, clip: { x: 430, y: 150, width: 420, height: 330 }, timeout: 180000 }); console.log('  görüntü: kokpit-f16-hud.jpg');
      await p.evaluate(() => __ucak.orbit(2.3, 0.25, 1)); await sleep(1500); await shot(p, 'kokpit-f16-geri.jpg');
      await p.evaluate(() => __ucak.orbit(0, 0, 1));
    }
    await p.evaluate(() => { __ucak.input.stick = null; __ucak.setCam(0); });
  }
  await p.close();
}

// dokunmatik düğmeler: iPhone 13 ve SE yatay; hepsi en az 44x44, ekranın içinde, üst üste değil; 4 yön tuşu çoklu dokunuş
async function buttons(b) {
  for (const [dev, name] of [['iPhone 13 landscape', 'dugmeler-iphone13.jpg'], ['iPhone SE (3rd gen) landscape', 'dugmeler-iphonese.jpg'], ['iPhone SE landscape', null]]) {
    const ip = await page(b, { ...pw.devices[dev], deviceScaleFactor: 2 }, { quality: 'dusuk', smoke: true });
    await begin(ip, 'bogaz', 'f16'); await ip.evaluate(() => __ucak.freeze(true)); await settle(ip, 60000);
    const rs = await ip.evaluate(() => [...document.querySelectorAll('#touch > *')].filter((e) => getComputedStyle(e).display !== 'none' && e.id !== 'touchInfo').map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, x: r.x, y: r.y, w: r.width, h: r.height }; }));
    const W = await ip.evaluate(() => [innerWidth, innerHeight]);
    const bad = rs.filter((r) => r.w < 44 || r.h < 44 || r.x < 0 || r.y < 0 || r.x + r.w > W[0] + 0.5 || r.y + r.h > W[1] + 0.5).map((r) => r.id);
    const over = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], c = rs[j]; if (a.x < c.x + c.w - 1 && c.x < a.x + a.w - 1 && a.y < c.y + c.h - 1 && c.y < a.y + a.h - 1) over.push(a.id + '/' + c.id); }
    console.log(`  ${dev}: ${rs.length} düğme`, bad.length ? 'küçük/dışarıda: ' + bad : 'boyut tamam', over.length ? 'üst üste: ' + over : 'çakışma yok');
    if (bad.length || over.length) errors.push(`${dev}: düğme yerleşimi (${bad} ${over})`);
    // yön tuşları: yukarı + sağ (iki parmak), yukarı + aşağı (birbirini götürür), yukarıdan sağa kaydırma
    const cdp = await ip.context().newCDPSession(ip);
    const key = async (d) => { const r = await ip.locator(`#dpad [data-dir="${d}"]`).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const [u, r, dn] = [await key('u'), await key('r'), await key('d')];
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    const stick = async () => { await ip.evaluate(() => __ucak.input.touchFrame()); return ip.evaluate(() => [__ucak.input.stick ? __ucak.input.stick.x : 0, __ucak.input.stick ? __ucak.input.stick.y : 0, [...document.querySelectorAll('#dpad [data-dir].on')].map((e) => e.dataset.dir).join('')]); };
    await touch('touchStart', [u]); await touch('touchStart', [u, r]); await sleep(300); const s1 = await stick();
    await touch('touchEnd', []); await touch('touchStart', [u]); await touch('touchStart', [u, dn]); await sleep(200); const s2 = await stick();
    await touch('touchEnd', []); await touch('touchStart', [u]); await touch('touchMove', [[(u[0] + r[0]) / 2 + 30, (u[1] + r[1]) / 2 + 25]]); await touch('touchMove', [r]); await sleep(200); const s3 = await stick();
    await touch('touchEnd', []); await sleep(100); const s4 = await stick();
    console.log('  yön tuşları: yukarı+sağ', JSON.stringify(s1), '· yukarı+aşağı', JSON.stringify(s2), '· kaydırınca', JSON.stringify(s3), '· bırakınca', JSON.stringify(s4));
    if (!(s1[0] > 0.3 && s1[1] < -0.3 && s1[2] === 'ur')) errors.push('yön tuşları: yukarı+sağ birlikte çalışmadı');
    if (!(s2[1] === 0 && s2[2] === 'ud')) errors.push('yön tuşları: yukarı+aşağı birbirini götürmedi');
    if (!(s3[0] > 0.3 && Math.abs(s3[1]) < 0.01 && s3[2] === 'r')) errors.push('yön tuşları: kaydırarak komşu tuşa geçilmedi');
    if (s4[2] !== '') errors.push('yön tuşları bırakılınca sönmedi');
    // takım düğmesi: dokununca hareket durumuna geçer (lambalar sarı)
    await ip.evaluate(() => __ucak.freeze(false)); await sleep(500);
    const g0 = await ip.evaluate(() => [document.querySelector('#bGear').dataset.state, __ucak.ac.ctl.gearDown]);
    { const gb = await ip.locator('#bGear').boundingBox(); const c = [gb.x + gb.width / 2, gb.y + gb.height / 2]; await touch('touchStart', [c]); await sleep(120); await touch('touchEnd', []); } await sleep(900);
    const g1 = await ip.evaluate(() => [document.querySelector('#bGear').dataset.state, __ucak.ac.ctl.gearDown]);
    console.log('  takım düğmesi:', JSON.stringify(g0), '->', JSON.stringify(g1)); if (g1[1] === g0[1] || g1[0] !== 'moving') errors.push('takım düğmesi durumu değişmedi');
    await ip.evaluate(() => __ucak.freeze(true)); await sleep(500);
    if (name) await shot(ip, name);
    await ip.close();
  }
}

// takla: yön tuşu yukarı basılı (rampa %35 -> %100), tam tur, dört görüntü; sonra dik dalıştan çıkış
async function loopTest(b) {
  const p = await page(b, { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, hasTouch: true }, { quality: 'dusuk', smoke: true });
  await begin(p, 'bogaz', 'f16');
  await fly(p, 'f16', [41.03, 29.012, 1300, 25, 380], 0);
  await p.evaluate(() => { __ucak.smoke(true); __ucak.input.throttle = 1; }); await settle(p, 60000);
  const fwd = () => p.evaluate(() => { const q = __ucak.ac.q; const m2 = 2 * (q[1] * q[3] - q[0] * q[2]), m0 = 1 - 2 * (q[2] * q[2] + q[3] * q[3]); return { a: Math.atan2(-m2, m0), t: __ucak.ac.time, alt: __ucak.ac.alt, c: __ucak.ac.crashed, al: __ucak.ac.out.alpha * 57.3, st: __ucak.ac.stallS, n: __ucak.ac.nz }; });
  // yön tuşunun kendisi: basma zamanı tarayıcının saatine göre; yavaş benzetimde rampa daha çabuk biter, zararsız
  await p.evaluate(() => { __ucak.freeze(false); __ucak.padPress = performance.now(); });
  let s = await fwd(), prev = s.a, acc = 0, amax = 0, nmax = 0, shotK = 1; const t0 = s.t, h0 = s.alt;
  await p.evaluate(() => { __ucak.loopTimer = setInterval(() => { const m = 0.35 + 0.65 * Math.min(1, (performance.now() - __ucak.padPress) / 1200); __ucak.input.stick = { x: 0, y: -m }; }, 30); });
  while (acc < 2 * Math.PI && s.t - t0 < 60) {
    await sleep(100); s = await fwd();
    let d = s.a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; acc += d; prev = s.a; amax = Math.max(amax, s.al); nmax = Math.max(nmax, s.n);
    if (s.c) break;
    if (acc > shotK * Math.PI / 2 && shotK <= 3) { await p.evaluate(() => __ucak.freeze(true)); await shot(p, `takla-${shotK}.jpg`); await p.evaluate(() => __ucak.freeze(false)); shotK++; }
  }
  await p.evaluate(() => { clearInterval(__ucak.loopTimer); __ucak.input.stick = null; });
  console.log(`  takla (yön tuşu): ${(acc * 57.3).toFixed(0)}°, ${(s.t - t0).toFixed(1)} sn uçuş, en büyük hücum ${amax.toFixed(1)}°, ${nmax.toFixed(1)} g, irtifa ${h0.toFixed(0)} -> ${s.alt.toFixed(0)} m, kaza: ${s.c}`);
  if (s.c || acc < 2 * Math.PI) errors.push('yön tuşuyla takla başarısız');
  await p.evaluate(() => __ucak.freeze(true)); await shot(p, 'takla-4.jpg');
  // dik dalış: burun tam aşağı, 300 kt; yukarı tuşu basılı; uçuş yolu yataya gelene dek irtifa kaybı
  const r = await p.evaluate(async () => {
    const U = __ucak; U.place(41.03, 29.012, 2600, 25, 300); const a = U.ac, h = a.ac || a;
    const hd = Math.atan2(2 * (a.q[0] * a.q[3] + a.q[1] * a.q[2]), 1 - 2 * (a.q[2] * a.q[2] + a.q[3] * a.q[3])), th = -89.5 * Math.PI / 180;
    const cp = Math.cos(th / 2), sp = Math.sin(th / 2), cy = Math.cos(hd / 2), sy = Math.sin(hd / 2);
    a.q = [cp * cy, -sp * sy, sp * cy, cp * sy]; const V = 300 * 0.514444; a.vel = [V * Math.cos(th) * Math.cos(hd), V * Math.cos(th) * Math.sin(hd), -V * Math.sin(th)]; a.w = [0, 0, 0]; a.prevPos = null; a.fbwS = null;
    const h0 = a.alt; U.freeze(false); const t0 = performance.now(); let rec = null;
    U.input.stick = { x: 0, y: -1 };
    while (!rec && performance.now() - t0 < 90000 && !a.crashed) { await new Promise((r) => setTimeout(r, 30)); if (-a.vel[2] >= 0) rec = h0 - a.alt; }
    U.input.stick = null; return { loss: rec, c: a.crashed };
  });
  console.log(`  dik dalıştan çıkış (300 kt, tam yukarı): irtifa kaybı ${r.loss && r.loss.toFixed(0)} m, kaza: ${r.c}`);
  if (r.c || r.loss == null || r.loss > 1200) errors.push('dik dalıştan çıkış başarısız');
  await p.close();
}

// geçiş kamerası: 10 sn boyunca kameranın yeniden yerleşme sayısı ve uçağın ekrandaki konumunun kare kare sıçraması
async function flybyTest(b) {
  const p = await page(b, { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }, { quality: 'dusuk' });
  await begin(p, 'bogaz', 'f16');
  await fly(p, 'f16', [41.03, 29.012, 900, 25, 380], 2); await settle(p, 60000);
  const r = await p.evaluate(async () => {
    // kamera durur, uçağa bakar. Ölçülen: yeniden yerleşme sayısı, yerleşme dışında kameranın kayması ve uçağın kare başına
    // yol farkının, benzetim zamanına göre beklenenden sapması (aradeğer yoksa adım sayısıyla sıçrar)
    const U = __ucak, cp = new U.THREE.Vector3(), mp = new U.THREE.Vector3(); let last = U.fly, moves = 0, camJumps = 0, n = 0, dev = 0;
    let prevC = null, prevM = null, prevT = null;
    U.freeze(false); const t0 = performance.now();
    await new Promise((res) => { const f = () => {
      const O = U.world.O; cp.set(U.camera.position.x + O.x, U.camera.position.y, U.camera.position.z - O.y); mp.set(U.model.root.position.x + O.x, U.model.root.position.y, U.model.root.position.z - O.y);
      const T = U.ac.time + U.ac.lerpK / 240;
      if (U.fly !== last) { moves++; last = U.fly; } else if (prevC && cp.distanceTo(prevC) > 0.5) camJumps++;
      if (prevM && T > prevT) { const v = mp.distanceTo(prevM) / (T - prevT), V = Math.hypot(...U.ac.vel); dev += Math.abs(v - V) / V; n++; }
      prevC = cp.clone(); prevM = mp.clone(); prevT = T;
      if (performance.now() - t0 < 10000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { frames: n, moves, camJumps, jitter: dev / Math.max(1, n), simT: U.ac.time };
  });
  console.log(`  geçiş kamerası: ${r.frames} kare, ${r.moves} yeniden yerleşme, ${r.camJumps} kamera sıçraması, uçağın kare başına hız sapması %${(r.jitter * 100).toFixed(2)}`);
  if (r.moves > Math.max(4, r.frames / 10) || r.camJumps > 0 || r.jitter > 0.03) errors.push('geçiş kamerası titriyor');
  await shot(p, 'gecis-kamerasi.jpg');
  await p.close();
}

(async () => {
  const b = await pw.chromium.launch({ args: ARGS });
  if (want('kokpit')) await cockpits(b);
  if (want('dugmeler')) await buttons(b);
  if (want('takla')) await loopTest(b);
  if (want('gecis')) await flybyTest(b);
  if (ONLY && !['kalkis', 'inis', 'menu', 'akrobasi', 'ekran', 'iphone'].some(want)) { await b.close(); console.log(errors.length ? 'HATALAR:\n' + errors.join('\n') : 'Hata yok'); process.exit(errors.length ? 1 : 0); }
  if (want('kalkis')) { const k = await page(b, { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }, { quality: 'dusuk', plane: 'c172' }); await takeoff(k); await k.close(); }
  if (want('inis')) {
    // kolay kumanda: F-16 son yaklaşmadan eller serbest iner, patlamamalı (iniş yardımı burnu kaldırır)
    const k = await page(b, { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }, { quality: 'dusuk' });
    await begin(k, 'yaklasma', 'f16'); await settle(k, 40000);
    // tarayıcıda benzetim yavaş koşar: süzülüş yolu üzerinde yere 60 m kalan noktaya atla
    await k.evaluate(() => { const a = __ucak.ac, vh = Math.hypot(a.vel[0], a.vel[1]), dh = a.out.agl - 60, d = dh * vh / a.vel[2]; a.pos[0] += a.vel[0] / vh * d; a.pos[1] += a.vel[1] / vh * d; a.pos[2] += dh; });
    await settle(k, 40000);
    let r = null;
    for (let i = 0; i < 90; i++) { await sleep(2000); r = await k.evaluate(() => ({ g: __ucak.ac.onGround, v: Math.round(__ucak.ac.out.V / 0.514444), agl: Math.round(__ucak.ac.out.agl), c: __ucak.ac.crashed, h: __ucak.ac.hardLanding ? Math.round(__ucak.ac.hardLanding.vz * 196.85) : 0 })); if (r.c || r.g) break; }
    await sleep(4000); r = Object.assign(r, await k.evaluate(() => ({ c: __ucak.ac.crashed, end: Math.round(__ucak.ac.out.V / 0.514444) })));
    console.log('  F-16 eller serbest iniş:', JSON.stringify(r));
    if (r.c || !r.g) errors.push('kolay kumandada iniş başarısız: ' + (r.c || 'yere inmedi'));
    await k.close();
  }
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
    const box = await ip.locator('#dpad').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    // kolay kumanda: analog sağda, gaz solda; flap/trim düğmeleri yok, takım ve fren var
    const lay = await ip.evaluate(() => { const st = document.querySelector('#dpad').getBoundingClientRect(), th = document.querySelector('#thr').getBoundingClientRect();
      return { stickRight: st.left > innerWidth / 2, thrLeft: th.right < innerWidth / 2, hidden: ['#bFlapD', '#bFlapU', '#bTrimU', '#bTrimD'].every((s) => getComputedStyle(document.querySelector(s)).display === 'none'), shown: ['#bGear', '#bBrake'].every((s) => getComputedStyle(document.querySelector(s)).display !== 'none') }; });
    console.log('  kolay kumanda yerleşimi:', JSON.stringify(lay));
    if (!lay.stickRight || !lay.thrLeft || !lay.hidden || !lay.shown) errors.push('kolay kumanda yerleşimi yanlış');
    // analog yukarı: burun yukarı (yunuslama hızı artı)
    await ip.evaluate(() => { const ac = __ucak.ac; __ucak.q0 = ac.out.alpha; });
    const cdp = await ip.context().newCDPSession(ip);
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await tp('touchStart', cx, cy - box.height * 0.36);
    let qmax = -9; for (let i = 0; i < 8; i++) { await sleep(250); qmax = Math.max(qmax, await ip.evaluate(() => __ucak.ac.w[1])); }
    await tp('touchEnd', 0, 0);
    console.log('  yukarı tuşu: en büyük yunuslama hızı', (qmax * 57.3).toFixed(1), '°/sn');
    if (!(qmax > 0.02)) errors.push('yukarı tuşu burnu kaldırmadı');
    const ok = await ip.evaluate(() => ['#dpad', '#thr', '#bSmoke', '#mini', '#bCam', '#bGear', '#bBrake'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), r.right <= innerWidth && r.bottom <= innerHeight && r.x >= 0 && r.y >= 0]; }));
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
