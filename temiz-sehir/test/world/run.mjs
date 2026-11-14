// World module test: API asserts, screenshots, draw-call/triangle and per-frame JS measurements.
// Usage: node test/world/run.mjs [--three /path/to/three.min.js] [--port 8741] [--only shots|api|perf]
// Serves www/ with python3 -m http.server; other modules are replaced by test fakes (trash = the spike's
// trash-core so the ground looks like the game; player/economy = controllable fakes; tools/ui/audio/debug
// = 404 → main's stubs). SwiftShader: numbers are for correctness, draw calls, triangles and JS cost, not fps.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const threeLocal = arg('--three', process.env.THREE_LOCAL || null);
const port = +arg('--port', 8741);
const only = arg('--only', 'all');

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(root, 'www'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const core = fs.readFileSync(path.join(root, 'test/spike/trash-core.js'), 'utf8').replace(/^export /gm, '');
const fakeTrash = fs.readFileSync(path.join(here, 'fake-trash.js'), 'utf8').replace('/*__CORE__*/', core);
const fakes = { 'trash.js': fakeTrash, 'player.js': fs.readFileSync(path.join(here, 'fake-player.js'), 'utf8'), 'economy.js': fs.readFileSync(path.join(here, 'fake-economy.js'), 'utf8') };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (/\[world\]/.test(m.text())) { out.initLog = m.text(); console.log('[page]', m.text()); } if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) { problems.push(`[${m.type()}] ${m.text()}`); console.log('[page]', m.type(), m.text()); } });
  page.on('pageerror', (e) => { problems.push('[pageerror] ' + e.message); console.log('[pageerror]', e.message); });
  if (threeLocal) await page.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
  await page.route('**/js/*.js', (r) => {
    const name = path.basename(new URL(r.request().url()).pathname);
    if (fakes[name]) return r.fulfill({ body: fakes[name], contentType: 'text/javascript' });
    if (['tools.js', 'ui.js', 'audio.js', 'debug.js'].includes(name)) return r.fulfill({ status: 404, body: '' });
    return r.continue();
  });
  await page.goto(`http://127.0.0.1:${port}/index.html?debug&nosave&manual`);
  await page.waitForFunction(() => window.__tsCtx && window.__tsCtx.time.frame >= 1 && window.__fakePlayer, null, { timeout: 120000 });
  await page.waitForTimeout(500); // boot curtain fade
  return page;
}
const shotsDir = path.join(here, 'shots'); fs.mkdirSync(shotsDir, { recursive: true });
const out = { views: {} };
let fails = 0;
const check = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if (!ok) fails++; };

const page = await open(1280, 590);
const view = async (name, v, pre) => {
  const st = await page.evaluate(([v, pre]) => {
    const c = window.__tsCtx;
    window.__fakePlayer.set(v.x, v.z, v.yaw, v.pitch || 0, v.y);
    if (pre) (new Function('c', pre))(c);
    c.step(2, 1 / 60);
    const i = c.renderer.info.render;
    return { calls: i.calls, triangles: i.triangles };
  }, [v, pre || null]);
  await page.screenshot({ path: path.join(shotsDir, name + '.png'), timeout: 180000 });
  out.views[name] = st; console.log('shot', name, JSON.stringify(st));
};

if (only === 'all' || only === 'api') {
  const api = await page.evaluate(() => {
    const W = window.__tsCtx.mods.world, L = W.layout(), r = {};
    let solid = 0, street = 0, plaza = 0; for (const k of L.kind) { if (k === 0) solid++; else if (k === 1) street++; else plaza++; }
    r.counts = { solid, street, plaza, trash: street + plaza, buildings: L.buildings.length, home: L.buildings.filter((b) => !b.blockId.includes('@') && b.blockId !== 'skyline').length };
    r.bounds = L.bounds; r.N = L.N; r.size = L.size; r.cell = L.cell;
    r.kind = [W.kindAt(10, 10), W.kindAt(3, 3), W.kindAt(39, 9), W.kindAt(39, 15), W.kindAt(-10, 10), W.kindAt(-3, 10), W.kindAt(39 + 54, 15), W.kindAt(27, -30)];
    r.blocked = [W.isBlocked(10, 10), W.isBlocked(3, 3), W.isBlocked(-1, 3), W.isBlocked(0.2, 3, 0.35), W.isBlocked(39, 9), W.isBlocked(39, 13), W.isBlocked(23.8, 15, 0.35), W.isBlocked(24.4, 15, 0.35)];
    const o = { x: 0, z: 0, hit: false };
    const cc = (x, z, rr) => { W.collide(x, z, rr, o); return [+o.x.toFixed(4), +o.z.toFixed(4), o.hit]; };
    r.collide = [cc(23.9, 15, 0.35), cc(24.2, 15, 0.35), cc(-1, 30, 0.35), cc(27, 27, 0.35), cc(5.9, 5.9, 0.35), cc(39, 8.2, 0.35), cc(60, 60, 0.35)];
    r.seg = [W.segmentClear(3, 3, 51, 3, 0.3), W.segmentClear(3, 3, 51, 51, 0.3), W.segmentClear(27, 3, 27, 51, 0.3), W.segmentClear(30.5, 9, 45, 9, 0.3), W.segmentClear(30.5, 13, 45, 13, 0.3), W.segmentClear(5.75, 3, 5.75, 30, 0.3), W.segmentClear(5.55, 3, 5.55, 30, 0.3)];
    r.outside = [W.outsideUnits(-5, -5), W.outsideUnits(-5, -5), W.outsideUnits(-30, 20), W.outsideUnits(-2, 40)];
    let s = 0, n = 0, z = 0; for (let j = -40; j < 0; j++) for (let i = -40; i < 0; i++) { const u = W.outsideUnits(i, j); if (u === 0) z++; else { s += u; n++; } }
    r.outsideMean = +(s / n).toFixed(3); r.outsideZero = z;
    r.points = W.points().map((p) => p.id + ':' + p.x.toFixed(1) + ',' + p.z.toFixed(1) + ' r' + p.r + ' yaw' + p.yaw.toFixed(2));
    r.pointShop = W.point('shop') && W.point('shop').id; r.pointNone = W.point('nope');
    const l = W.lighting(); r.light = { sunDir: l.sunDir.isVector3 && +l.sunDir.length().toFixed(3), sun: l.sunColor.isColor, sky: l.skyColor.isColor, gnd: l.groundColor.isColor, fog: l.fogColor.getHexString() };
    const g = W.groundTexture(); r.ground = { isTexture: !!g.isTexture, flipY: g.flipY, mip: g.generateMipmaps, w: g.image.width };
    r.fog = { near: window.__tsCtx.scene.fog.near, far: window.__tsCtx.scene.fog.far };
    r.save = W.save();
    // neighbour buildings never inside the district rectangle
    r.buildingsInside = L.buildings.filter((b) => b.blockId.includes('@') && b.x1 > 0 && b.x0 < 54 && b.z1 > 0 && b.z0 < 54).length;
    // every home building footprint is solid in kind
    let bad = 0; for (const b of L.buildings) { if (b.blockId.includes('@') || b.blockId === 'skyline') continue; for (let zz = b.z0 + 0.25; zz < b.z1; zz += 0.5) for (let xx = b.x0 + 0.25; xx < b.x1; xx += 0.5) if (W.kindAt(xx, zz) !== 0) bad++; }
    r.buildingCellsNotSolid = bad;
    return r;
  });
  out.api = api; console.log(JSON.stringify(api, null, 1));
  check('trash cells = 7728', api.counts.trash === 7728, api.counts);
  check('plaza cells = 1248 (1296 - kiosk 48)', api.counts.plaza === 1248);
  check('kindAt', JSON.stringify(api.kind) === JSON.stringify([0, 1, 0, 2, 0, 1, 0, 1]), api.kind);
  check('isBlocked', JSON.stringify(api.blocked) === JSON.stringify([true, false, true, true, true, false, true, false]), api.blocked);
  check('collide pushes out', api.collide[0][0] === 24.35 && api.collide[0][2] && api.collide[1][0] === 24.35 && api.collide[2][0] === 0.35 && !api.collide[3][2] && api.collide[6][0] === 53.65, api.collide);
  check('collide corner', Math.hypot(api.collide[4][0] - 6, api.collide[4][1] - 6) >= 0.3499, api.collide[4]);
  check('segmentClear', JSON.stringify(api.seg) === JSON.stringify([true, false, true, false, true, false, true]), api.seg);
  check('outsideUnits deterministic, mean ~2, 0 under buildings', api.outside[0] === api.outside[1] && Math.abs(api.outsideMean - 2) < 0.1 && api.outsideZero > 0, [api.outside, api.outsideMean, api.outsideZero]);
  check('points', api.points.length === 6 && api.pointShop === 'shop' && api.pointNone === null, api.points);
  check('ground texture', api.ground.isTexture && api.ground.flipY === false && api.ground.mip);
  check('fog 30..230', api.fog.near === 30 && api.fog.far === 230);
  check('neighbour buildings outside district', api.buildingsInside === 0);
  check('home building footprints are solid cells', api.buildingCellsNotSolid === 0, api.buildingCellsNotSolid);
}

if (only === 'all' || only === 'shots') {
  await view('01-start', { x: 39, z: 17, yaw: 180, pitch: -4 });
  await view('02-shop-kiosk', { x: 37.5, z: 21.5, yaw: 15, pitch: 6 });
  await view('03-street-north', { x: 27, z: 52, yaw: 0, pitch: -3 });
  await view('04-west-edge', { x: 5, z: 29, yaw: 280, pitch: -4 });
  await view('05-crossing', { x: 26, z: 28.5, yaw: 50, pitch: 2 });
  await view('06-skyline', { x: 51, z: 52, yaw: 135, pitch: 8 });
  // carve: plaza ring, a broom strip, a crossing, so the ground plan shows
  await page.evaluate(() => window.__fakeTrash.carve([
    { seg: [26.2, 53, 26.2, 31], hw: 0.55 }, { seg: [27.2, 53, 27.2, 40], hw: 0.55 }, { seg: [25.0, 50, 29.8, 50], hw: 2.2 },
    { x: 39, z: 15, r: 6.5 }, { x: 27, z: 27, r: 3.8 }, { seg: [3, 53, 3, 30], hw: 1.1 }, { x: 3, z: 51, r: 3.2 },
  ]));
  await view('07-cleaned-street', { x: 27, z: 53.3, yaw: 0, pitch: -14 });
  await view('08-cleaned-plaza', { x: 34, z: 21, yaw: 35, pitch: -18 });
  await view('09-crossing-clean', { x: 27, z: 33, yaw: 0, pitch: -22 });
  // bag full → arrow; drop-off owned → container + second ring
  await view('10-arrow-to-shop', { x: 20, z: 27, yaw: 70, pitch: -30 }, "window.__fakeEco.space = 0; c.step(20, 1/60);");
  await view('11-dropoff', { x: 7.5, z: 46, yaw: 235, pitch: -6 }, "window.__fakeEco.owned.dropoff = true; window.__fakeEco.space = 0; c.step(20, 1/60);");
  // city events: birds, streetlights, pedestrians + confetti
  await view('12-events', { x: 33, z: 20, yaw: 60, pitch: 10 }, "window.__fakeEco.space = 5; for (const i of [0,1,2]) c.bus.emit('trash:milestone', { index: i, at: c.CONFIG.milestones[i].at, fraction: c.CONFIG.milestones[i].at }); c.step(25, 1/60);");
  await view('13-aerial', { x: 27, y: 45, z: 78, yaw: 0, pitch: -38 });
  await view('14-finale-high', { x: 27, y: 85, z: 95, yaw: 0, pitch: -45 }, "c.bus.emit('district:cleaned', { playS: 1000 }); c.step(30, 1/60);");
  await view('15-billboard', { x: 39, z: 21, yaw: 180, pitch: 12 });
  await view('20-lang-en', { x: 39, z: 15.5, yaw: 0, pitch: 14 }, "c.state.settings.lang = 'en'; c.step(70, 1/60);");
  await page.evaluate(() => { window.__tsCtx.state.settings.lang = 'tr'; window.__tsCtx.step(70, 1/60); });
  await view('18-find-shop-north-street', { x: 8, z: 3, yaw: 92, pitch: 8 });
  await view('19-find-shop-middle-street', { x: 27.5, z: 47, yaw: 14, pitch: 9 });
}

if (only === 'all' || only === 'perf') {
  const perf = await page.evaluate(() => {
    const c = window.__tsCtx, W = c.mods.world, r = {};
    // world's own draw calls / triangles: render with only world objects visible
    const hidden = [];
    for (const o of c.scene.children) if (!/^world/.test(o.name) && o.visible && !o.isLight) { o.visible = false; hidden.push(o); }
    c.renderer.render(c.scene, c.camera);
    r.worldOnly = { calls: c.renderer.info.render.calls, triangles: c.renderer.info.render.triangles };
    for (const o of hidden) o.visible = true;
    r.meshes = c.scene.children.filter((o) => /^world/.test(o.name) && o.geometry).map((o) => ({ name: o.name, tris: o.geometry.index ? o.geometry.index.count / 3 : 0, verts: o.geometry.attributes.position.count, inst: o.isInstancedMesh ? o.count : undefined }));
    // per-frame JS of world.update with arrow, rings, birds, people, confetti active
    window.__fakeEco.space = 0; c.bus.emit('trash:milestone', { index: 0, at: 0.25, fraction: 0.25 });
    window.__fakePlayer.set(20, 27, 70, -10);
    for (let i = 0; i < 30; i++) W.update(1 / 60);
    const n = 2000; let t0 = performance.now();
    for (let i = 0; i < n; i++) W.update(1 / 60);
    r.updateMsActive = +((performance.now() - t0) / n).toFixed(4);
    window.__fakeEco.space = 5;
    for (let i = 0; i < 300; i++) W.update(1 / 60); // let confetti die
    t0 = performance.now(); for (let i = 0; i < n; i++) W.update(1 / 60);
    r.updateMsIdleEvents = +((performance.now() - t0) / n).toFixed(4);
    // collision API cost
    const o = { x: 0, z: 0, hit: false }; t0 = performance.now();
    for (let i = 0; i < 100000; i++) W.collide(20 + (i % 100) * 0.1, 15 + (i % 37) * 0.1, 0.35, o);
    r.collideUs = +((performance.now() - t0) / 100).toFixed(3);
    t0 = performance.now(); for (let i = 0; i < 100000; i++) W.segmentClear(3 + (i % 50), 3, 51 - (i % 40), 51, 0.35);
    r.segmentClearUs = +((performance.now() - t0) / 100).toFixed(3);
    t0 = performance.now(); let s = 0; for (let i = 0; i < 100000; i++) s += W.outsideUnits(-(i % 300), (i % 211) - 100);
    r.outsideUnitsUs = +((performance.now() - t0) / 100).toFixed(3);
    r.textures = c.renderer.info.memory.textures;
    r.atlasBytes = 1024 * 1024 * 4 * 4 / 3; r.groundBytes = 1024 * 1024 * 4 * 4 / 3;
    return r;
  });
  out.perf = perf; console.log(JSON.stringify(perf, null, 1));
  check('world draw calls <= 6', perf.worldOnly.calls <= 6, perf.worldOnly);
  check('world triangles <= 15k', perf.worldOnly.triangles <= 15000, perf.worldOnly);
  for (const [k, v] of Object.entries(out.views)) check('frame budget ' + k, v.calls <= 40 && v.triangles <= 150000, v);
  // portrait
  const pp = await open(390, 844);
  await pp.evaluate(() => { window.__fakePlayer.set(39, 17, 180, -4); window.__tsCtx.step(2); });
  await pp.screenshot({ path: path.join(shotsDir, '16-portrait.png'), timeout: 180000 });
  await pp.evaluate(() => { window.__fakePlayer.set(27, 52, 0, 2); window.__tsCtx.step(2); });
  await pp.screenshot({ path: path.join(shotsDir, '17-portrait-street.png'), timeout: 180000 });
  out.portrait = await pp.evaluate(() => window.__tsCtx.renderer.info.render.calls);
  await pp.close();
}
check('no console errors / page errors', problems.length === 0, problems.slice(0, 5));
fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(out, null, 1));
await browser.close(); server.kill();
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
