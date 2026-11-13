// player.js tests: real touch input (CDP multi-touch) in landscape 844x390 and portrait 390x844,
// keyboard/mouse, collision, comfort rules, mount/dismount, finale lift, per-frame cost, frame sequences.
// Usage: THREE_LOCAL=/path/three.min.js node test/player/run.cjs   (or --three /path; REAL=1 = no fakes)
const H = require('./harness.cjs');
const fs = require('fs'), path = require('path');
const SHOTS = path.join(__dirname, 'shots');
const near = (a, b, e) => Math.abs(a - b) <= e;
const DEG = Math.PI / 180;

async function seq(page, name, frames, between) { // record a frame sequence
  const dir = path.join(SHOTS, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) { await between(i); await H.render(page); await page.screenshot({ path: path.join(dir, String(i).padStart(2, '0') + '.png') }); }
  H.sheet(dir, path.join(SHOTS, name + '.png'), 4);
}

async function landscape() {
  const { page, touch, errors, close } = await H.open({ width: 844, height: 390, stub: ['tools'] });
  const probe = async (n) => { if (!process.env.PROBE) return; try { await page.screenshot({ path: '/tmp/claude-0/-home-user/8066dee7-8627-553b-a97c-0e1bfc2ce9b4/scratchpad/pt/probe.png', timeout: 8000 }); console.log('probe ok', n); } catch (e) { console.log('probe TIMEOUT', n); process.exit(2); } };
  await page.waitForTimeout(500); // boot curtain fade
  const ev = (n) => page.evaluate((n) => window.__fakeAudio.log[n].length, n);
  const clearEv = () => page.evaluate(() => window.__fakeAudio.clear());
  await H.step(page, 2);
  let p = await H.pose(page);
  const CF = await page.evaluate(() => ({ start: window.__tsCtx.CONFIG.player.startPos, yaw: window.__tsCtx.CONFIG.player.startYawDeg, walk: window.__tsCtx.CONFIG.player.walkSpeed[0] }));
  H.check('spawn at CONFIG start (v2: looking down a street)', near(p.x, CF.start[0], 1e-6) && near(p.z, CF.start[1], 1e-6) && near(p.yaw, CF.yaw * DEG, 1e-6), p);
  const fov0 = await page.evaluate(() => window.__tsCtx.camera.fov);
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(45, 40, Math.PI)); await H.step(page, 1);   // plaza, facing south

  // ---- stick: thumb lands in the left half, pushes up 60 px (full forward)
  await touch.down(0, 160, 290);
  let inp = await H.input(page);
  H.check('stick appears where the thumb lands', inp.stick.active && near(inp.stick.cx, 160, 1) && near(inp.stick.cy, 290, 1), inp.stick);
  await touch.move(0, 160, 230);
  await H.step(page, 1);
  inp = await H.input(page); p = await H.pose(page);
  H.check('stick → moveY ≈ +1 on the next frame, already moving', inp.moveY > 0.95 && Math.abs(inp.moveX) < 0.05 && p.speed > 0.3, { moveY: inp.moveY, speed: p.speed });
  // acceleration profile: full speed ≈ 0.18 s
  const speeds = [];
  for (let i = 0; i < 14; i++) { await H.step(page, 1); speeds.push((await H.pose(page)).speed); }
  const tFull = speeds.findIndex((s) => s >= CF.walk * 0.99) + 2; // frames incl. the first
  H.check('walk reaches top speed within 0.15–0.25 s', tFull / 60 >= 0.14 && tFull / 60 <= 0.26, { seconds: +(tFull / 60).toFixed(3), speeds: speeds.map((s) => +s.toFixed(2)) });
  p = await H.pose(page);
  H.check('forward = south (+z) for yaw 180°', p.z > 40.3 && near(p.x, 45, 0.02), p);

  // ---- second finger looks while the stick is held (two simultaneous touches)
  const yaw0 = p.yaw;
  await touch.down(1, 600, 180);
  for (let k = 1; k <= 5; k++) await touch.move(1, 600 + k * 20, 180);
  await H.step(page, 1);
  p = await H.pose(page); inp = await H.input(page);
  const dyaw = ((p.yaw - yaw0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  H.check('look drag 100 px right → +25° yaw (0.25°/px) while walking', near(dyaw / DEG, 25, 0.6) && inp.moveY > 0.95 && p.speed > 4, { dyawDeg: +(dyaw / DEG).toFixed(2), moveY: inp.moveY });
  await touch.move(1, 600 + 100, 140); // drag up 40 px = look up 10°
  await H.step(page, 1);
  const p2 = await H.pose(page);
  H.check('drag up → look up', near((p2.pitch - p.pitch) / DEG, 10, 0.5), { dpitch: (p2.pitch - p.pitch) / DEG });
  await touch.up(1);
  await H.step(page, 2);
  inp = await H.input(page);
  H.check('lifting the look finger keeps the stick', inp.stick.active && inp.moveY > 0.95);
  // third finger while both halves are busy → ignored
  await touch.down(1, 650, 200); await touch.down(2, 300, 200); await touch.move(2, 350, 150);
  await H.step(page, 1);
  inp = await H.input(page);
  H.check('a second finger on the stick half does not hijack the stick', near(inp.stick.cx, 160, 1) && inp.moveY > 0.95, inp.stick);
  await touch.up(2); await touch.up(1);
  // stick base follows a thumb that goes past the rim
  await touch.move(0, 160, 120);
  inp = await H.input(page);
  H.check('floating stick base follows the thumb past the rim', near(inp.stick.cy, 176, 1.5), inp.stick);
  await touch.up(0);
  await H.step(page, 1);
  inp = await H.input(page);
  H.check('stick released → input zero, stick hidden', !inp.stick.active && inp.moveX === 0 && inp.moveY === 0);
  for (let i = 0; i < 9; i++) await H.step(page, 1);
  p = await H.pose(page);
  H.check('stops within ~0.15 s after release', p.speed < 0.01, p.speed);

  await probe('// ---- taps on the right half');
  // ---- taps on the right half
  await clearEv();
  await touch.down(3, 700, 200); await H.step(page, 3); await touch.up(3); // 3 frames (~ instant in real time)
  H.check('short tap on the right half → input:tap', (await ev('input:tap')) === 1);
  await clearEv();
  await touch.down(3, 700, 200); await touch.move(3, 720, 200); await touch.up(3);
  H.check('a 20 px drag is not a tap', (await ev('input:tap')) === 0);
  await clearEv();
  await touch.down(3, 700, 200); await page.waitForTimeout(300); await touch.up(3);
  H.check('a 300 ms hold is not a tap', (await ev('input:tap')) === 0);
  await clearEv();
  await touch.down(3, 200, 200); await touch.up(3);
  H.check('a tap on the stick half is not a tap', (await ev('input:tap')) === 0);

  await probe('// ---- touch starting on a UI element');
  // ---- touch starting on a UI element is ignored (action button bottom-right, tool buttons)
  const btn = await page.evaluate(() => { const r = document.getElementById('fAct').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await H.step(page, 1); // flush look deltas left by the drag test above
  p = await H.pose(page);
  await touch.down(4, btn.x, btn.y);
  await H.step(page, 1);
  inp = await H.input(page);
  H.check('touch on the action button → action held, no look/stick', inp.action === true && !inp.stick.active);
  await touch.move(4, btn.x - 150, btn.y - 60); await H.step(page, 1);
  const p3 = await H.pose(page);
  H.check('dragging from the button does not look', near(p3.yaw, p.yaw, 1e-9) && near(p3.pitch, p.pitch, 1e-9));
  await touch.up(4); await H.step(page, 1);
  H.check('button release → action false', (await H.input(page)).action === false);
  // a press that starts and ends between two frames is still seen for one frame
  await touch.down(4, btn.x, btn.y); await touch.up(4);
  await H.step(page, 1);
  H.check('quick press between frames is latched for one frame', (await H.input(page)).action === true);
  await H.step(page, 1);
  H.check('…and released on the next', (await H.input(page)).action === false);

  await probe('// ---- cancel / blur / panel');
  // ---- cancel / blur / panel
  await touch.down(0, 160, 290); await touch.move(0, 160, 230); await H.step(page, 1);
  await touch.cancel(); await H.step(page, 1);
  inp = await H.input(page);
  H.check('touchcancel releases the stick', !inp.stick.active && inp.moveY === 0);
  await touch.down(0, 160, 290); await touch.move(0, 160, 230); await H.step(page, 1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await H.step(page, 1);
  inp = await H.input(page);
  H.check('window blur releases everything', !inp.stick.active && inp.moveY === 0);
  await touch.up(0);
  await page.evaluate(() => window.__tsCtx.bus.emit('ui:panel', { id: 'shop', open: true }));
  p = await H.pose(page);
  await touch.down(1, 600, 200); await touch.move(1, 700, 200); await touch.down(0, 160, 290); await touch.move(0, 160, 230); await H.step(page, 2);
  const p4 = await H.pose(page); inp = await H.input(page);
  H.check('panel open: look and stick ignored', near(p4.yaw, p.yaw, 1e-9) && !inp.stick.active && p4.speed === 0);
  await touch.up(1); await touch.up(0);
  await page.evaluate(() => window.__tsCtx.bus.emit('ui:panel', { id: 'shop', open: false }));

  await probe('// ---- keyboard + mouse');
  // ---- keyboard + mouse
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(45, 47, 0));
  await page.keyboard.down('KeyW'); await H.step(page, 30); await page.keyboard.up('KeyW');
  p = await H.pose(page);
  H.check('W walks forward (north = -z for yaw 0)', p.z < 46 && near(p.x, 45, 0.05), p);
  await page.keyboard.down('KeyD'); await H.step(page, 20); await page.keyboard.up('KeyD'); await H.step(page, 10);
  const p5 = await H.pose(page);
  H.check('D strafes right (east)', p5.x > 45.8, p5);
  await page.mouse.move(500, 200); await page.mouse.down(); await page.mouse.move(600, 200, { steps: 5 }); await page.mouse.up(); await H.step(page, 1);
  const p6 = await H.pose(page);
  H.check('mouse drag 100 px → +15° yaw (0.15°/px)', near((p6.yaw - p5.yaw) / DEG, 15, 0.5), (p6.yaw - p5.yaw) / DEG);

  await probe('// ---- collision with');
  // ---- collision with the kiosk [43,49,47,52] and the district edge (v2: at 7.5 m/s, sub-stepped)
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(45, 55, 0));
  await page.keyboard.down('KeyW'); await H.step(page, 90); await page.keyboard.up('KeyW');
  p = await H.pose(page);
  H.check('kiosk blocks: stops at radius from its south wall', near(p.z, 52 + 0.35, 0.02), p.z);
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(42.5, 55, 0.25));
  await page.keyboard.down('KeyW'); await H.step(page, 40);
  const ps40 = await H.pose(page); await page.keyboard.up('KeyW');
  H.check('walking diagonally into the kiosk slides along its wall instead of sticking (no jitter)', ps40.x > 43.3 && near(ps40.z, 52.35, 0.02) && ps40.speed > 1, ps40);
  // thin solids at speed: a lamp post is never tunnelled through, even with 50 ms frames
  const lamp = await page.evaluate(() => { const W = window.__tsCtx.mods.world; for (let x = 1; x < 89; x += 0.25) for (let z = 1; z < 89; z += 0.25) if (W.isBlocked(x, z, 0) && !W.isBlocked(x + 0.5, z, 0) && !W.isBlocked(x - 0.5, z, 0) && !W.isBlocked(x, z + 0.5, 0) && !W.isBlocked(x, z - 0.5, 0)) return { x, z }; return null; });
  if (lamp) {
    const tun = await page.evaluate((L) => { const P = window.__tsCtx.mods.player, W = window.__tsCtx.mods.world; let through = 0, n = 0;
      for (let a = 0; a < 16; a++) { const ang = a * Math.PI / 8; P.teleport(L.x - Math.sin(ang) * 1.5, L.z + Math.cos(ang) * 1.5, ang); if (W.isBlocked(P.pose().x, P.pose().z, 0.35)) continue; n++; P.setStick(0, 1); for (let i = 0; i < 20; i++) P.update(0.05); P.setStick(0, 0);
        const p = P.pose(), along = (p.x - L.x) * Math.sin(ang) - (p.z - L.z) * Math.cos(ang), side = Math.abs((p.x - L.x) * Math.cos(ang) + (p.z - L.z) * Math.sin(ang)); if (along > 0.3 && side < 0.15) through++; }
      return { through, n }; }, lamp);
    H.check('no tunnelling through thin solids at walking speed with 50 ms frames', tun.through === 0, { lamp, tun });
  }
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(2, 2, -Math.PI / 4));
  await page.keyboard.down('KeyW'); await H.step(page, 60); await page.keyboard.up('KeyW');
  p = await H.pose(page);
  H.check('district bounds hold', p.x >= 0.349 && p.z >= 0.349, p);

  await probe('// ---- speed cap');
  // ---- speed cap (broom)
  await page.evaluate(() => { window.__tsCtx.mods.player.teleport(31, 40, 0); window.__tsCtx.mods.player.setSpeedCap(2); });
  await page.keyboard.down('KeyW'); await H.step(page, 40);
  p = await H.pose(page);
  H.check('setSpeedCap(2) caps walking at 2 m/s', near(p.speed, 2, 0.01), p.speed);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => window.__tsCtx.mods.player.setSpeedCap(null));

  await probe('// ---- comfort:');
  // ---- comfort: no roll, FOV stable, no head bob (eye only follows the trash surface, smoothly)
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(31, 52, 0));
  await page.keyboard.down('KeyW');
  const ys = [], rolls = [], fovs = [];
  for (let i = 0; i < 120; i++) { await H.step(page, 1); const r = await page.evaluate(() => { const c = window.__tsCtx.camera; return [c.position.y, c.rotation.z, c.fov]; }); ys.push(r[0]); rolls.push(r[1]); fovs.push(r[2]); }
  await page.keyboard.up('KeyW');
  let maxJerk = 0; for (let i = 2; i < ys.length; i++) maxJerk = Math.max(maxJerk, Math.abs(ys[i] - 2 * ys[i - 1] + ys[i - 2]));
  H.check('no roll while walking', rolls.every((r) => r === 0));
  H.check('FOV untouched by player (main owns it)', fovs.every((f) => f === fov0), fov0);
  H.check('eye height: no bob, only a smooth surface follow (≤ 2 mm/frame² curvature)', maxJerk < 0.002 && Math.max(...ys) - Math.min(...ys) < 0.16, { range: +(Math.max(...ys) - Math.min(...ys)).toFixed(3), maxJerk: +maxJerk.toFixed(5) });
  H.check('player:step events while walking', (await ev('player:step')) > 3, await ev('player:step'));

  await probe('// ---- pitch clamp');
  // ---- pitch clamp
  await touch.down(1, 600, 385); for (let k = 1; k <= 8; k++) await touch.move(1, 600, 385 - k * 47); await touch.up(1); await H.step(page, 1);
  p = await H.pose(page);
  H.check('pitch clamped at +60°', near(p.pitch / DEG, 60, 0.01), p.pitch / DEG);
  await touch.down(1, 600, 10); for (let k = 1; k <= 8; k++) await touch.move(1, 600, 10 + k * 70); await touch.up(1); await H.step(page, 1);
  p = await H.pose(page);
  H.check('pitch clamped at -70°', near(p.pitch / DEG, -70, 0.01), p.pitch / DEG);

  await probe('// ---- aimPoint');
  // ---- aimPoint
  await page.evaluate(() => { const P = window.__tsCtx.mods.player; P.teleport(31, 40, 0); P.pose().pitch = -40 * Math.PI / 180; });
  await H.step(page, 1);
  const aim = await page.evaluate(() => window.__tsCtx.mods.player.aimPoint(5, { x: 0, y: 0, z: 0, hit: false }));
  H.check('aimPoint hits the trash ~1.7 m ahead when looking 40° down', aim.hit && near(aim.x, 31, 0.01) && aim.z < 39 && aim.z > 37.7 && aim.y >= 0 && aim.y <= 0.31, aim);
  const aim2 = await page.evaluate(() => { window.__tsCtx.mods.player.pose().pitch = 0.1; return window.__tsCtx.mods.player.aimPoint(5, { x: 0, y: 0, z: 0, hit: false }); });
  H.check('aimPoint above the horizon → no hit', aim2.hit === false);

  await probe('// ---- mount / dismount');
  // ---- mount / dismount with a minimal vehicle (the real cart is tested in test/tools)
  const m = await page.evaluate(() => {
    const T = window.THREE, P = window.__tsCtx.mods.player;
    P.teleport(31, 40, 0); P.pose().pitch = -0.1;
    const o = new T.Object3D(); o.position.set(32, 0, 40); o.rotation.y = 0;
    const veh = { id: 'testcar', eyeHeight: 2, object3D: o, view: 'first', drive(dt, inp, ps) { o.position.z -= 3 * dt; ps.x = o.position.x; ps.z = o.position.z; return 0; } };
    window.__veh = veh;
    const ok = P.mount(veh);
    return { ok, mounted: P.pose().mounted };
  });
  H.check('mount() accepts a vehicle descriptor', m.ok && m.mounted === 'testcar', m);
  await clearEv();
  const ys2 = [];
  for (let i = 0; i < 30; i++) { await H.step(page, 1); ys2.push(await page.evaluate(() => window.__tsCtx.camera.position.y)); }
  p = await H.pose(page);
  H.check('while mounted the vehicle drives the pose', near(p.z, 40 - 3 * 30 / 60, 0.01) && near(p.speed, 3, 0.05), p);
  H.check('camera blends up to the seat (no jump > 6 cm/frame)', ys2.every((y, i) => i === 0 || Math.abs(y - ys2[i - 1]) < 0.06) && near(ys2[ys2.length - 1], 2, 0.01), ys2.map((y) => +y.toFixed(3)).slice(0, 8));
  await page.evaluate(() => window.__tsCtx.mods.player.dismount());
  await H.step(page, 30);
  p = await H.pose(page);
  H.check('dismount: on foot beside the vehicle, events emitted', p.mounted === null && near(p.x, 30.6, 0.05) && (await ev('player:mount')) === 0 && (await ev('player:dismount')) === 1, p);

  await probe('// ---- save / load');
  // ---- save / load round trip
  const sv = await page.evaluate(() => { const P = window.__tsCtx.mods.player; P.teleport(30.5, 27.25, 1.0); P.pose().pitch = -0.2; const s = P.save(); P.teleport(45, 47, 0); P.load(s); const q = P.pose(); return { s, x: q.x, z: q.z, yaw: q.yaw, pitch: q.pitch }; });
  H.check('save/load round trip', near(sv.x, 30.5, 1e-3) && near(sv.z, 27.25, 1e-3) && near(sv.yaw, 1, 1e-3) && near(sv.pitch, -0.2, 1e-3), sv);
  const bad = await page.evaluate(() => { const P = window.__tsCtx.mods.player; P.teleport(31, 40, 0); P.load({ x: 45, z: 50.5 }); P.load({}); P.load(null); P.load({ x: 'x', yaw: NaN }); const q = P.pose(); return { x: q.x, z: q.z }; });
  H.check('load tolerates bad data (blocked spot, missing, NaN)', near(bad.x, 31, 1e-6) && near(bad.z, 40, 1e-6), bad);

  await probe('// ---- per-frame cost');
  // ---- per-frame cost (player.update alone, stick held + look)
  await touch.down(0, 160, 290); await touch.move(0, 160, 230);
  const cost = await page.evaluate(() => {
    const P = window.__tsCtx.mods.player; P.teleport(31, 40, 0);
    const n = 3000, t0 = performance.now();
    for (let i = 0; i < n; i++) P.update(1 / 60);
    return (performance.now() - t0) / n;
  });
  await touch.up(0);
  H.check('player.update ≤ 0.2 ms/frame (desktop headless)', cost < 0.2, { msPerFrame: +cost.toFixed(4) });
  fs.writeFileSync(path.join(SHOTS, '_cost.json'), JSON.stringify({ playerUpdateMs: cost }));

  await probe('// ---- frame sequences: walk');
  // ---- frame sequences: walk (stick) and look (drag), landscape
  await page.evaluate(() => { const P = window.__tsCtx.mods.player; P.teleport(31, 50, 0); P.pose().pitch = -6 * Math.PI / 180; });
  await H.step(page, 2);
  await touch.down(0, 150, 290);
  await seq(page, 'walk-landscape', 8, async (i) => { await touch.move(0, 150 + (i > 3 ? 25 : 0), 290 - Math.min(60, i * 20)); await H.step(page, 8); });
  await touch.up(0);
  await H.step(page, 10);
  await touch.down(1, 560, 200);
  await seq(page, 'look-landscape', 8, async (i) => { await touch.move(1, 560 + i * 25, 200 + (i < 4 ? -i * 8 : (i - 8) * 8)); await H.step(page, 1); });
  await touch.up(1);

  // ---- finale lift
  await page.evaluate(() => { const P = window.__tsCtx.mods.player; P.teleport(45, 47, Math.PI); P.pose().pitch = -0.1; });
  await H.step(page, 2);
  await page.evaluate(() => window.__tsCtx.bus.emit('district:cleaned', { playS: 1000 }));
  // v2 (psychology review F): slow and smooth: peak camera speed <= 12 m/s, no frame-to-frame yaw/pitch jump > 2 deg
  const motion = await page.evaluate(() => { const c = window.__tsCtx.camera, out = { vmax: 0, jump: 0, yaw0: -c.rotation.y, yawMax: 0 }; let px = c.position.x, py = c.position.y, pz = c.position.z, pr = c.rotation.x, pyw = c.rotation.y;
    for (let i = 0; i < 640; i++) { window.__tsCtx.step(1, 1 / 60); const v = Math.hypot(c.position.x - px, c.position.y - py, c.position.z - pz) * 60; out.vmax = Math.max(out.vmax, v); out.jump = Math.max(out.jump, Math.abs(c.rotation.x - pr) * 180 / Math.PI, Math.abs(c.rotation.y - pyw) * 180 / Math.PI); out.yawMax = Math.max(out.yawMax, Math.abs(-c.rotation.y - out.yaw0) * 180 / Math.PI); px = c.position.x; py = c.position.y; pz = c.position.z; pr = c.rotation.x; pyw = c.rotation.y; }
    out.vmax = +out.vmax.toFixed(2); out.jump = +out.jump.toFixed(2); out.yawMax = +out.yawMax.toFixed(1); return out; });
  H.check('finale lift: slow (peak <= 12 m/s), no jumps (<= 2 deg/frame), yaw turn <= 30 deg', motion.vmax <= 12 && motion.jump <= 2 && motion.yawMax <= 30.5, motion);
  await H.step(page, 40);   // (no screenshots up here: SwiftShader renders the whole city from 50 m too slowly)
  const lp = await page.evaluate(() => { const c = window.__tsCtx.camera; return { y: c.position.y, pitch: c.rotation.x / Math.PI * 180, roll: c.rotation.z, state: window.__tsCtx.mods.player.liftState() }; });
  H.check('district:cleaned lifts the camera to a bird\'s-eye view, no roll', lp.y > 40 && lp.pitch < -20 && lp.roll === 0 && lp.state === 2, lp);
  await touch.down(1, 600, 200); await touch.move(1, 700, 200);
  await H.step(page, 30);
  H.check('input during the lift does not move the player', near((await H.pose(page)).x, 45, 1e-6) && near((await H.pose(page)).z, 47, 1e-6));
  await touch.up(1);
  await page.evaluate(() => window.__tsCtx.bus.emit('ui:panel', { id: 'complete', open: false }));
  await H.step(page, 120);
  const back = await page.evaluate(() => ({ y: window.__tsCtx.camera.position.y, state: window.__tsCtx.mods.player.liftState() }));
  H.check('closing the complete card: a short fade, then a cut back to the eye (no dive)', back.state === 0 && back.y < 2, back);
  await H.render(page); await page.screenshot({ path: path.join(SHOTS, 'lift-back.png'), timeout: 60000 }).catch(() => console.log('(lift-back screenshot skipped: SwiftShader too slow)'));

  await close();
  return errors;
}

async function portrait() {
  const { page, touch, errors, close } = await H.open({ width: 390, height: 844, stub: ['tools'] });
  await page.waitForTimeout(500);
  await H.step(page, 2);
  const fov = await page.evaluate(() => window.__tsCtx.camera.fov);
  H.check('portrait ("Dikey oyna"): main applies the portrait vertical FOV', fov === 82, fov);
  await touch.down(0, 100, 700); await touch.move(0, 100, 640);
  await touch.down(1, 300, 400); await touch.move(1, 340, 400);
  await H.step(page, 20);
  const p = await H.pose(page), inp = await H.input(page);
  H.check('portrait: stick on the left half + look on the right half at once', inp.moveY > 0.95 && p.speed > 4.9 && p.yaw > -Math.PI + 9 * DEG - 1e-6 || p.yaw < 0, { yawDeg: p.yaw / DEG, speed: p.speed });
  await touch.up(1); await touch.up(0);
  await page.evaluate(() => { const P = window.__tsCtx.mods.player; P.teleport(31, 50, 0); P.pose().pitch = -6 * Math.PI / 180; });
  await H.step(page, 12);
  await touch.down(0, 90, 700);
  await seq(page, 'walk-portrait', 6, async (i) => { await touch.move(0, 90, 700 - Math.min(60, i * 20)); await H.step(page, 8); });
  await touch.up(0); await H.step(page, 10);
  await touch.down(1, 260, 420);
  await seq(page, 'look-portrait', 6, async (i) => { await touch.move(1, 260 + i * 18, 420); await H.step(page, 1); });
  await touch.up(1);
  // orientation flip releases fingers
  await touch.down(0, 100, 700); await touch.move(0, 100, 640); await H.step(page, 1);
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(200); await H.step(page, 1);
  H.check('orientation flip releases the stick', !(await H.input(page)).stick.active);
  await touch.up(0);
  await close();
  return errors;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const e1 = await landscape();
  const e2 = await portrait();
  H.done(e1.concat(e2));
})().catch((e) => { console.error(e); process.exitCode = 1; });
