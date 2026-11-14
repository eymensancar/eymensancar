// tools.js tests: hand brush (hold to flick, walk to sweep, speed cap only while sweeping), bag full, broom (walk sweep, swing in place, rhythm), cart (enter,
// camera + tank steering, nozzle swath into the tank, wall bump, exit), feedback latency, haptics,
// draw calls, per-frame cost, and frame sequences in landscape 844x390 and portrait 390x844.
// Usage: THREE_LOCAL=/path/three.min.js node test/tools/run.cjs   (uses the fakes in test/player/fakes)
const H = require('../player/harness.cjs');
const fs = require('fs'), path = require('path');
const SHOTS = path.join(__dirname, 'shots');
const near = (a, b, e) => Math.abs(a - b) <= e;
const DEG = Math.PI / 180;
const VIB = `window.__vib = []; Object.defineProperty(navigator, 'vibrate', { value: (p) => { window.__vib.push(performance.now()); return true; }, configurable: true });`;

async function seq(page, name, frames, between) {
  const dir = path.join(SHOTS, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) { await between(i); await H.render(page); await page.screenshot({ path: path.join(dir, String(i).padStart(2, '0') + '.png') }); }
  H.sheet(dir, path.join(SHOTS, name + '.png'), 4);
}
const S = {
  bag: (page) => page.evaluate(() => window.__tsCtx.mods.economy.bagUnits('bag')),
  tank: (page) => page.evaluate(() => window.__tsCtx.mods.economy.bagUnits('tank')),
  ev: (page, n) => page.evaluate((n) => window.__fakeAudio.log[n].slice(), n),
  clear: (page) => page.evaluate(() => { window.__fakeAudio.clear(); window.__vib.length = 0; }),
  frame: (page) => page.evaluate(() => window.__tsCtx.time.frame),
  topOffer: (page) => page.evaluate(() => { const o = window.__tsCtx.offers; let t = null; for (let i = 0; i < o.count; i++) if (!t || o.list[i].priority > t.priority) t = o.list[i]; return t ? { id: t.id, label: window.__tsCtx.t(t.label), offers: Array.from({ length: o.count }, (_, i) => o.list[i].id + ':' + o.list[i].priority) } : null; }), // labels are STR keys (integration)
  calls: (page) => page.evaluate(() => window.__tsCtx.renderer.info.render.calls),
  look: (page, x, z, yaw, pitchDeg) => page.evaluate(([x, z, yaw, p]) => { const P = window.__tsCtx.mods.player; P.teleport(x, z, yaw); P.pose().pitch = p * Math.PI / 180; }, [x, z, yaw, pitchDeg]),
};
async function btn(page) { return page.evaluate(() => { const r = document.getElementById('fAct').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); }

async function landscape() {
  const { page, touch, errors, close } = await H.open({ width: 844, height: 390, initScript: VIB });
  await page.waitForTimeout(500);
  await H.step(page, 2);
  const b = await btn(page);

  // ---- hand brush (v2 start tool): standing + holding the button flicks, the first flick within the press frame
  const C = await page.evaluate(() => ({ brush: window.__tsCtx.CONFIG.brush, walk: window.__tsCtx.CONFIG.player.walkSpeed, broom: window.__tsCtx.CONFIG.broom, cart: window.__tsCtx.CONFIG.cart, shop: window.__tsCtx.CONFIG.sellPoints[0].pos }));
  await S.look(page, 31, 40, 0, -35);
  await H.step(page, 3);
  H.check('brush offer "Fırçala" (brush, priority 10)', (await S.topOffer(page)).id === 'brush' && (await S.topOffer(page)).label === 'Fırçala');
  await S.clear(page);
  const f0 = await S.frame(page);
  await touch.down(0, b.x, b.y);
  await H.step(page, 1);
  let col = await S.ev(page, 'tool:collect');
  H.check('press → swept into the dustpan on the very next frame (≤ 17 ms ≪ 100 ms)', col.length === 1 && col[0].f === f0 + 1 && col[0].tool === 'brush' && col[0].units >= 1, col);
  H.check('…bag grows, haptic tick, the swept items fly (trash juice), a flick sound event', (await S.bag(page)) >= 1 && (await page.evaluate(() => window.__vib.length)) === 1 && (await S.ev(page, 'tool:swing')).length === 1 && (await S.ev(page, 'tool:swing'))[0].tool === 'brush');
  await H.step(page, 122); // 2.05 s held
  await touch.up(0); await H.step(page, 1);
  let bag = await S.bag(page);
  const flicks = (await S.ev(page, 'tool:swing')).length;
  H.check('holding 2.05 s standing still: quick flicks (one per ' + C.brush.flickS + ' s) keep sweeping', flicks >= 8 && bag > 6, { flicks, bag });
  const handsCost = await page.evaluate(() => window.__tsCtx.mods.tools.perfSample());

  // ---- walking sweeps by itself (no button) at the brush's speed cap; walking over clean ground is not capped
  await page.evaluate(() => window.__fakeEco.empty('bag'));
  await S.look(page, 31, 46, 0, -20); await H.step(page, 2);
  const bw0 = await S.bag(page);
  await page.keyboard.down('KeyW'); await H.step(page, 40);
  const pb = await H.pose(page); await page.keyboard.up('KeyW'); await H.step(page, 10);
  H.check('brush: walking on trash sweeps a strip with no button, at the brush cap (' + C.brush.sweepSpeed[0] + ' m/s)', (await S.bag(page)) > bw0 + 2 && near(pb.speed, C.brush.sweepSpeed[0], 0.05), { speed: pb.speed, bag: await S.bag(page) });
  await page.evaluate(() => { const T = window.__tsCtx.mods.trash; T.removeInCircle(31, 30, 9, 1e9, 'debug'); window.__tsCtx.mods.player.teleport(31, 38, 0); });
  await H.step(page, 3);
  await page.keyboard.down('KeyW'); await H.step(page, 30);
  const pc = await H.pose(page); await page.keyboard.up('KeyW'); await H.step(page, 10);
  H.check('brush: walking over clean ground runs at walking speed (' + C.walk[0] + ' m/s), no sweep cap', near(pc.speed, C.walk[0], 0.05), pc.speed);

  // ---- bag full: no collecting, clear feedback, offer label says so, walking is NOT capped (psychology review A)
  await S.look(page, 31, 40, 0, -35);
  await page.evaluate(() => window.__fakeEco.fill('bag'));
  await H.step(page, 2);
  await S.clear(page);
  const units0 = await page.evaluate(() => window.__tsCtx.mods.trash.totalUnits());
  await touch.down(0, b.x, b.y); await H.step(page, 30); await touch.up(0);
  const fullEvs = await S.ev(page, 'tool:full');
  H.check('full bag: nothing removed from the street', (await page.evaluate(() => window.__tsCtx.mods.trash.totalUnits())) === units0);
  H.check('full bag: tool:full + toast "Çanta dolu" + haptic, rate-limited', fullEvs.length === 1 && (await page.evaluate(() => window.__fakeUi.log.toasts.slice(-1)[0])) === 'Çanta dolu' && (await page.evaluate(() => window.__vib.length)) === 1);
  H.check('full bag: the button reads "Çanta dolu"', (await S.topOffer(page)).label === 'Çanta dolu');
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(31, 50, 0)); await H.step(page, 2);
  await page.keyboard.down('KeyW'); await H.step(page, 30);
  const pf = await H.pose(page); await page.keyboard.up('KeyW'); await H.step(page, 10);
  H.check('full bag over trash: walking speed, not the sweep cap', near(pf.speed, C.walk[0], 0.05), pf.speed);
  await page.evaluate((sp) => window.__tsCtx.mods.player.teleport(sp[0], sp[1] + 0.5, 0), C.shop); await H.step(page, 2);
  H.check('walking into the shop sells (fake economy) and the brush works again', (await S.bag(page)) === 0 && (await S.topOffer(page)).label === 'Fırçala');

  // ---- brush frame sequence: hold to flick
  await S.look(page, 31, 44, 0, -30);
  await H.step(page, 2);
  await touch.down(0, b.x, b.y);
  await seq(page, 'brush-landscape', 8, async (i) => { await H.step(page, i === 0 ? 1 : 4); });
  await touch.up(0);
  await H.step(page, 30);

  // ---- broom: bought → equipped with a bounce, speed cap, sweeps a strip while walking
  await page.evaluate(() => { window.__fakeEco.own('bag_3'); window.__fakeEco.own('broom'); });
  await H.step(page, 1);
  const tb = await page.evaluate(() => ({ cur: window.__tsCtx.mods.tools.current(), avail: window.__tsCtx.mods.tools.available() }));
  H.check('purchase of the broom equips it', tb.cur === 'broom' && tb.avail.includes('broom'), tb);
  await S.look(page, 30.25, 50, 0, -8);
  await H.step(page, 2);
  await S.clear(page);
  const u0 = await page.evaluate(() => window.__tsCtx.mods.trash.totalUnits()), bagB0 = await S.bag(page);
  await touch.down(0, 160, 290); await touch.move(0, 160, 230);
  await seq(page, 'sweep-landscape', 8, async (i) => { await H.step(page, 8); });
  await H.step(page, 56); // 2 s walking in total
  await touch.up(0);
  await H.step(page, 20);
  const sw = await page.evaluate(() => {
    const T = window.__tsCtx.mods.trash, p = window.__tsCtx.mods.player.pose();
    let clean = 0, n = 0; for (let z = p.z + 0.4; z < 49.6; z += 0.5) { n++; if (T.amountAt(30.25, z) === 0) clean++; }
    return { z: p.z, clean, n, units: T.totalUnits() };
  });
  const swings = await S.ev(page, 'tool:swing');
  const gaps = swings.slice(1).map((s, i) => s.f - swings[i].f);
  H.check('broom: walking speed capped at the sweep speed while sweeping (' + C.broom.sweepSpeed[0] + ' m/s for 2 s)', near(50 - sw.z, C.broom.sweepSpeed[0] * 2 - 0.25, 0.4), sw.z);
  H.check('broom: the strip behind is clean', sw.n > 5 && sw.clean === sw.n, sw);
  H.check('broom: collected into the bag (= units removed)', (await S.bag(page)) - bagB0 === u0 - sw.units && u0 - sw.units > 20, { bag: await S.bag(page), removed: u0 - sw.units });
  H.check('broom: tool:swing ≤ 1 per 0.3 s, rhythmic', swings.length >= 5 && gaps.every((g) => g >= 17), { n: swings.length, gaps });
  const bc = (await S.ev(page, 'tool:collect')).filter((c) => c.tool === 'broom');
  H.check('broom: tool:collect aggregated ≤ 1 per frame', new Set(bc.map((c) => c.f)).size === bc.length, bc.length);
  const broomCost = await page.evaluate(() => window.__tsCtx.mods.tools.perfSample());
  // swing in place
  await S.look(page, 29, 50, 0, -8); await H.step(page, 2);
  const s0 = await S.bag(page);
  await touch.down(0, b.x, b.y); await H.step(page, 70); await touch.up(0);
  const s1 = await S.bag(page);
  H.check('broom: holding the button while standing sweeps in place (slower than walking)', s1 > s0 && s1 - s0 < (u0 - sw.units) / 2, { inPlace: s1 - s0 });
  // portrait broom frame sequence later; tool switch back and forth
  await page.evaluate(() => window.__tsCtx.bus.emit('ui:tool', { id: 'brush' })); await H.step(page, 1);
  await page.evaluate(() => { window.__tsCtx.mods.player.teleport(3, 70, 0); });
  await page.keyboard.down('KeyW'); await H.step(page, 30);
  const hs = (await H.pose(page)).speed; await page.keyboard.up('KeyW');
  H.check('switching to the brush: the brush cap applies on trash', near(hs, C.brush.sweepSpeed[0], 0.05), hs);
  await page.evaluate(() => window.__tsCtx.bus.emit('ui:tool', { id: 'broom' })); await H.step(page, 20);

  // ---- cart
  await page.evaluate(() => window.__fakeEco.own('cart'));
  await H.step(page, 1);
  const cs0 = await page.evaluate(() => window.__tsCtx.mods.tools.cartState());
  H.check('cart appears at CONFIG.cart.parkPos facing east', cs0 && near(cs0.x, C.cart.parkPos[0], 1e-6) && near(cs0.z, C.cart.parkPos[1], 1e-6) && near(cs0.heading, C.cart.parkYawDeg * DEG, 1e-6) && cs0.nozzleDown === true, cs0);
  await page.evaluate((c) => window.__tsCtx.mods.player.teleport(c.parkPos[0], c.parkPos[1] - 1.8, Math.PI / 2), C.cart); await H.step(page, 2);
  H.check('near the cart the button offers "Bin" (enter beats sweep)', (await S.topOffer(page)).label === 'Bin');
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(53, 53, Math.PI / 2)); await H.step(page, 2);
  H.check('away from the cart no enter offer', (await S.topOffer(page)).id === 'sweep');
  await page.evaluate((c) => window.__tsCtx.mods.player.teleport(c.parkPos[0], c.parkPos[1] - 1.8, Math.PI / 2), C.cart); await H.step(page, 2);
  await S.clear(page);
  await touch.down(0, b.x, b.y); await touch.up(0); await H.step(page, 1);
  let st = await page.evaluate(() => ({ cs: window.__tsCtx.mods.tools.cartState(), cur: window.__tsCtx.mods.tools.current(), m: window.__tsCtx.mods.player.pose().mounted }));
  H.check('press "Bin" → mounted, tool = cart, tool:changed + player:mount', st.cs.mounted && st.cur === 'cart' && st.m === 'cart' && (await S.ev(page, 'player:mount')).length === 1 && (await S.ev(page, 'tool:changed')).slice(-1)[0] !== undefined, st);
  await H.step(page, 30);
  { const t = await S.topOffer(page); H.check('in the cart: big button = nozzle (90), "İn" (exit, 80) offered for the secondary button', t.id === 'nozzle' && t.offers.includes('exit:80'), t); }
  // drive east along the street (camera mode: stick up = where the camera looks) — the camera looks east
  await S.clear(page);
  const t0 = await S.tank(page);
  await touch.down(0, 160, 290); await touch.move(0, 160, 230);
  await H.step(page, 30);
  H.check('moving: button offers the nozzle ("Emiciyi kaldır")', (await S.topOffer(page)).label === 'Emiciyi kaldır');
  await seq(page, 'drive-landscape', 8, async (i) => { await H.step(page, 6); });
  await touch.up(0); await H.step(page, 40);
  st = await page.evaluate(() => window.__tsCtx.mods.tools.cartState());
  const tank1 = await S.tank(page);
  const swath = await page.evaluate((c) => { const T = window.__tsCtx.mods.trash; let k = 0, n = 0; for (let x = c.parkPos[0] + 3; x <= c.parkPos[0] + 6; x += 0.5) for (let z = c.parkPos[1] - 0.6; z <= c.parkPos[1] + 0.6; z += 0.5) { n++; if (T.amountAt(x, z) === 0) k++; } return { c: k, n }; }, C.cart);
  H.check('cart drives where the camera looks (east), nozzle down', st.x > C.cart.parkPos[0] + 6 && near(st.z, C.cart.parkPos[1], 0.3), st);
  H.check('cart nozzle cleans a swath into the tank', tank1 - t0 > 40 && swath.c === swath.n, { tank: tank1 - t0, swath });
  const carts = (await S.ev(page, 'tool:collect')).filter((c) => c.tool === 'cart');
  H.check('cart tool:collect events', carts.length > 5);
  // camera mode turning: stick right → turns towards camera-right (west, since facing south) smoothly
  const h0 = st.heading;
  await touch.down(0, 160, 290); await touch.move(0, 220, 290);
  const yawRates = [];
  let prevH = h0;
  for (let i = 0; i < 30; i++) { await H.step(page, 1); const h = (await page.evaluate(() => window.__tsCtx.mods.tools.cartState())).heading; yawRates.push(((h - prevH + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * 60 / DEG); prevH = h; }
  await touch.up(0); await H.step(page, 60);
  const maxRate = Math.max(...yawRates.map(Math.abs)), maxJump = Math.max(...yawRates.slice(1).map((r, i) => Math.abs(r - yawRates[i])));
  H.check('camera mode: stick right turns the cart, ≤ 140°/s, damped (no yaw snaps)', maxRate <= 140.5 && maxRate > 60 && maxJump < 25, { maxRate: +maxRate.toFixed(1), maxJumpDegPerS: +maxJump.toFixed(1) });
  // nozzle toggle via ui:offer
  await page.evaluate(() => window.__tsCtx.bus.emit('ui:offer', { id: 'nozzle', owner: 'tools' })); await H.step(page, 20);
  st = await page.evaluate(() => window.__tsCtx.mods.tools.cartState());
  H.check('nozzle toggle → up, tool:nozzle {down:false}', st.nozzleDown === false && (await S.ev(page, 'tool:nozzle')).length === 1);
  // nozzle up: faster, no cleaning
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(59, 6, Math.PI)); await H.step(page, 2);
  await page.evaluate(() => { const P = window.__tsCtx.mods.player; P.pose().yaw = Math.PI; });
  const tk = await S.tank(page);
  await touch.down(0, 160, 290); await touch.move(0, 160, 230); await H.step(page, 120);
  st = await page.evaluate(() => window.__tsCtx.mods.tools.cartState());
  await touch.up(0);
  H.check('nozzle up: top speed (' + C.cart.topSpeed + ' m/s, the fastest thing), nothing collected', near(st.speed, C.cart.topSpeed, 0.05) && (await S.tank(page)) === tk, st);
  await H.step(page, 90);
  // wall bump: drive east into the W building block at x = 6 from the west edge street (x 1.5, z 40, facing east)
  await page.evaluate(() => { window.__tsCtx.mods.player.teleport(1.5, 40, Math.PI / 2); window.__tsCtx.mods.player.pose().yaw = Math.PI / 2; });
  await H.step(page, 2);
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(1.5, 40, Math.PI / 2)); // the W block starts at x = 6
  await page.evaluate(() => { window.__tsCtx.mods.player.pose().yaw = Math.PI / 2; });
  await touch.down(0, 160, 290); await touch.move(0, 160, 230);
  let hitSpeed = null, before = null;
  for (let i = 0; i < 150; i++) { await H.step(page, 1); const s = await page.evaluate(() => window.__tsCtx.mods.tools.cartState()); if (s.x < 6 - 1.21) before = s.speed; if (s.x >= 6 - 1.21) hitSpeed = hitSpeed === null ? s.speed : Math.min(hitSpeed, s.speed); } // front circle (0.4 ahead, r 0.8) touches x = 6
  st = await page.evaluate(() => window.__tsCtx.mods.tools.cartState());
  await touch.up(0); await H.step(page, 60);
  H.check('wall bump: the cart stops at the building (front at x = 6, no tunnelling at speed), speed cut by bumpSlowdown', near(st.x, 4.8, 0.02) && hitSpeed !== null && hitSpeed <= before * 0.6, { x: st.x, hitSpeed, before });
  // tank mode
  await page.evaluate(() => { window.__tsCtx.state.settings.steer = 'tank'; window.__tsCtx.mods.player.teleport(31, 40, 0); });
  await H.step(page, 30);
  const tm0 = await page.evaluate(() => ({ h: window.__tsCtx.mods.tools.cartState().heading, yaw: window.__tsCtx.mods.player.pose().yaw }));
  await touch.down(0, 160, 290); await touch.move(0, 210, 250); await H.step(page, 45);
  const tm1 = await page.evaluate(() => ({ h: window.__tsCtx.mods.tools.cartState().heading, yaw: window.__tsCtx.mods.player.pose().yaw, s: window.__tsCtx.mods.tools.cartState().speed }));
  await touch.up(0);
  H.check('tank mode: stick x turns, the view turns with the cart', tm1.h - tm0.h > 0.5 && near(tm1.yaw - tm0.yaw, tm1.h - tm0.h, 0.05) && tm1.s > 1, { tm0, tm1 });
  await H.step(page, 60);
  await page.evaluate(() => { window.__tsCtx.state.settings.steer = 'camera'; });
  // tank full
  await page.evaluate(() => { window.__tsCtx.mods.player.teleport(3, 40, 0); window.__fakeEco.fill('tank'); window.__tsCtx.bus.emit('ui:offer', { id: 'nozzle', owner: 'tools' }); });
  await S.clear(page);
  await touch.down(0, 160, 290); await touch.move(0, 160, 230); await H.step(page, 60); await touch.up(0);
  H.check('tank full: "Depo dolu" feedback, cart keeps driving', (await S.ev(page, 'tool:full')).length >= 1 && (await page.evaluate(() => window.__fakeUi.log.toasts.slice(-1)[0])) === 'Depo dolu' && (await page.evaluate(() => window.__tsCtx.mods.tools.cartState().z)) < 38);
  await H.step(page, 90);
  const driveCost = await page.evaluate(() => window.__tsCtx.mods.tools.perfSample());
  // exit
  await S.clear(page);
  await page.evaluate(() => window.__fakeEco.empty('tank'));
  // the fake ui has one button (top offer = nozzle): the real ui's secondary button emits this
  await page.evaluate(() => window.__tsCtx.bus.emit('ui:offer', { id: 'exit', owner: 'tools' })); await H.step(page, 30);
  st = await page.evaluate(() => ({ cs: window.__tsCtx.mods.tools.cartState(), cur: window.__tsCtx.mods.tools.current(), p: window.__tsCtx.mods.player.pose() }));
  H.check('press "İn" → on foot beside the cart, previous tool back', !st.cs.mounted && st.cur === 'broom' && st.p.mounted === null && Math.hypot(st.p.x - st.cs.x, st.p.z - st.cs.z) > 1.2, st);

  // ---- save / load of tools (cart position + mounted)
  const sv = await page.evaluate(() => window.__tsCtx.mods.tools.save());
  H.check('tools.save has current + cart', sv.v === 1 && sv.current === 'broom' && sv.cart && isFinite(sv.cart.x) && sv.cart.mounted === false, sv);

  // ---- draw calls added by tools: everything visible at once (broom VM, parked cart, flying items, dust)
  await page.evaluate(() => window.__tsCtx.mods.player.teleport(window.__tsCtx.mods.tools.cartState().x, window.__tsCtx.mods.tools.cartState().z + 3.5, 0));
  await touch.down(0, 160, 290); await touch.move(0, 140, 280); await H.step(page, 6);
  const dc = await page.evaluate(() => {
    const s = window.__tsCtx.scene, r = window.__tsCtx.renderer; const names = ['toolsDust', 'cartBody', 'cartNozzle'];
    const vis = Object.fromEntries(names.map((n) => [n, !!(s.getObjectByName(n) && s.getObjectByName(n).visible)]));
    r.render(s, window.__tsCtx.camera); const total = r.info.render.calls;
    // hide tools objects and re-render to isolate their share
    const objs = []; s.traverse((o) => { if (o.name === 'toolsVM' || o.name === 'cart' || o.name === 'toolsFly' || o.name === 'toolsDust') objs.push(o); });
    const was = objs.map((o) => o.visible); objs.forEach((o) => o.visible = false); r.render(s, window.__tsCtx.camera);
    const without = r.info.render.calls, trisWithout = r.info.render.triangles; objs.forEach((o, i) => o.visible = was[i]); r.render(s, window.__tsCtx.camera);
    return { vis, total, without, tools: total - without, toolsTris: r.info.render.triangles - trisWithout };
  });
  await touch.up(0);
  await H.render(page); await page.screenshot({ path: path.join(SHOTS, 'drawcalls-view.png') });
  H.check('tools add ≤ 6 draw calls and ≤ 10 k triangles', dc.tools <= 6 && dc.toolsTris <= 10000, dc);

  fs.writeFileSync(path.join(SHOTS, '_cost.json'), JSON.stringify({ toolsUpdateMs: { brush: handsCost, broom: broomCost, cart: driveCost } }));
  H.check('tools.update cost ≤ 0.4 ms/frame (desktop headless)', handsCost < 0.4 && broomCost < 0.4 && driveCost < 0.4, { handsCost, broomCost, driveCost });

  // ---- chase-camera driving sequence from the plaza down the middle street (look while driving)
  await page.evaluate(() => window.__fakeEco.empty('tank'));
  const be2 = await btn(page);
  await page.evaluate(() => { window.__tsCtx.mods.player.teleport(window.__tsCtx.mods.tools.cartState().x + 1.5, window.__tsCtx.mods.tools.cartState().z, 0); });
  await H.step(page, 2);
  await touch.down(0, be2.x, be2.y); await touch.up(0); await H.step(page, 30);
  await page.evaluate(() => { const T = window.__tsCtx.mods.tools; window.__tsCtx.mods.player.teleport(31, 52, 0); window.__tsCtx.mods.player.pose().yaw = 0; window.__tsCtx.mods.player.pose().pitch = -0.05; });
  await H.step(page, 30);
  const mounted = await page.evaluate(() => window.__tsCtx.mods.tools.cartState().mounted);
  if (mounted) {
    await touch.down(0, 160, 290); await touch.move(0, 160, 230);
    await touch.down(1, 600, 200);
    await seq(page, 'drive-chase', 8, async (i) => { if (i >= 4) await touch.move(1, 600 + (i - 3) * 12, 200); await H.step(page, 10); });
    await touch.up(1); await touch.up(0); await H.step(page, 40);
  }
  H.check('re-entered the cart for the chase sequence', mounted);
  await close();
  return errors;
}

async function portrait() {
  const { page, touch, errors, close } = await H.open({ width: 390, height: 844, initScript: VIB });
  await page.waitForTimeout(500);
  await H.step(page, 2);
  const b = await btn(page);
  await S.look(page, 31, 44, 0, -30); await H.step(page, 2);
  await touch.down(0, b.x, b.y);
  await seq(page, 'brush-portrait', 6, async (i) => { await H.step(page, i === 0 ? 1 : 5); });
  await touch.up(0);
  H.check('portrait ("Dikey oyna"): brushing works', (await S.bag(page)) >= 2);
  await page.evaluate(() => { window.__fakeEco.own('bag_3'); window.__fakeEco.own('broom'); });
  await S.look(page, 30.25, 50, 0, -8); await H.step(page, 30);
  await touch.down(0, 100, 700); await touch.move(0, 100, 640);
  await seq(page, 'sweep-portrait', 6, async (i) => { await H.step(page, 8); });
  await touch.up(0);
  await page.evaluate(() => window.__fakeEco.own('cart')); await H.step(page, 1);
  await page.evaluate(() => { const c = window.__tsCtx.CONFIG.cart.parkPos; window.__tsCtx.mods.player.teleport(c[0], c[1] - 1.8, 0); }); await H.step(page, 2);
  await page.evaluate(() => window.__tsCtx.bus.emit('ui:offer', { id: 'enter', owner: 'tools' })); await H.step(page, 30);
  await page.evaluate(() => { window.__tsCtx.mods.player.teleport(31, 52, 0); window.__tsCtx.mods.player.pose().yaw = 0; window.__tsCtx.mods.player.pose().pitch = -0.05; });
  await H.step(page, 30);
  await touch.down(0, 100, 700); await touch.move(0, 100, 640);
  await seq(page, 'drive-portrait', 6, async (i) => { await H.step(page, 10); });
  await touch.up(0);
  H.check('portrait: driving works', (await S.tank(page)) > 30);
  await close();
  return errors;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const e1 = await landscape();
  const e2 = await portrait();
  H.done(e1.concat(e2));
})().catch((e) => { console.error(e); process.exitCode = 1; });
