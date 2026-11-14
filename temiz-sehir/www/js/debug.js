// debug.js — the `window.__ts` test hook (MIMARI.md §4.10, §12). Owner: economy programmer (debug/test).
// Installed ONLY with ?debug in the URL (reads window.__tsCtx, which main.js sets with ?debug). No gameplay effect
// unless a test calls it. Nothing here runs per frame except the optional overlay sampler (debug only).

const UPDATE_ORDER = ['player', 'tools', 'economy', 'trash', 'world', 'audio', 'ui']; // MIMARI §7 (debug itself excluded)
let ctxRef = null, hook = null;
const warned = {};
function warnOnce(k, msg) { if (!warned[k]) { warned[k] = 1; console.warn('[debug] ' + msg); } }

function copyPayload(p, depth = 0) { // events(): copies, so reused payload objects stay valid in the log
  if (p == null || typeof p !== 'object') return p;
  if (ArrayBuffer.isView(p)) return Array.from(p);
  if (depth > 3) return '[…]';
  if (Array.isArray(p)) return p.slice(0, 64).map((v) => copyPayload(v, depth + 1));
  if (p.isVector3 || p.isColor || p.isObject3D || p.isTexture) return '[THREE]';
  const o = {}; for (const k of Object.keys(p)) o[k] = copyPayload(p[k], depth + 1);
  return o;
}

export function init(ctx) {
  ctxRef = ctx;
  if (!ctx.debug || !(ctx.params && ctx.params.has('debug'))) return;
  const c = window.__tsCtx || ctx;
  const M = c.mods, bus = c.bus, D2R = Math.PI / 180;
  const log = []; const LOG_MAX = 5000; let t0 = performance.now();
  if (bus.setTrace) bus.setTrace((name, payload) => { if (log.length >= LOG_MAX) log.shift(); log.push({ t: +((performance.now() - t0) / 1000).toFixed(3), game: +c.time.game.toFixed(3), name, payload: copyPayload(payload) }); });
  else warnOnce('trace', 'bus.setTrace missing: events() stays empty');
  let stickKeys = { x: 0, y: 0 };
  const overlay = { on: false, data: null };

  function keyEvent(type, code) { window.dispatchEvent(new KeyboardEvent(type, { code, key: code.replace('Key', '').toLowerCase(), bubbles: true })); }
  function pose() { return M.player.pose ? M.player.pose() : { x: 0, z: 0, yaw: 0, pitch: 0 }; }

  function fastStep(seconds, dt = 1 / 30, render = true) { // gameplay updates WITHOUT rendering each frame (balance tests)
    c.manual = true;
    const n = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < n; i++) {
      c.time.dt = dt; c.time.frame++; if (!c.state.paused) c.time.game += dt;
      c.offers.count = 0;
      const sdt = c.state.paused ? 0 : dt;
      for (const name of UPDATE_ORDER) { const m = M[name]; try { m.update(sdt); } catch (e) { console.error('[debug] ' + name + '.update threw', e); } }
    }
    if (render) c.step(1, 0); // one real frame so the picture matches the state (dt 0: no extra game time)
    return c.time.game;
  }

  hook = {
    ready: true, ctx: c,
    state() {
      const E = M.economy, p = pose();
      return {
        coins: E.coins(), bag: { units: E.bagUnits('bag'), cap: E.bagCapacity('bag') }, tank: { units: E.bagUnits('tank'), cap: E.bagCapacity('tank') },
        tool: M.tools.current ? M.tools.current() : 'brush', clean: M.trash.cleanFraction(), unitsLeft: M.trash.totalUnits(),
        pose: { x: +p.x.toFixed(3), z: +p.z.toFixed(3), yawDeg: +((p.yaw || 0) / D2R).toFixed(1) },
        owned: (M.economy.catalog() || []).filter((e) => e.state === 'owned').map((e) => e.id), robots: E.robots().length,
        paused: c.state.paused, frame: c.time.frame, gameS: +c.time.game.toFixed(3),
      };
    },
    teleport(x, z, yawDeg) { M.player.teleport(x, z, yawDeg == null ? undefined : yawDeg * D2R); },
    look(yawDeg, pitchDeg) {
      if (typeof M.player.look === 'function') return M.player.look(yawDeg * D2R, pitchDeg * D2R);
      const p = pose(); M.player.teleport(p.x, p.z, yawDeg * D2R);
      if (pitchDeg != null) warnOnce('look', 'player has no look(yaw, pitch): only yaw was set (contract gap, see docs/notlar/economy.md)');
    },
    give(coins) { M.economy.earn(coins, 'debug'); return M.economy.coins(); },
    own(id) {
      if (typeof M.economy.grant === 'function') return M.economy.grant(id);
      const it = (M.economy.catalog() || []).find((e) => e.id === id); if (!it) return false;
      M.economy.earn(it.price, 'debug'); return M.economy.buy(id);
    },
    setTool(id) { return M.tools.equip ? M.tools.equip(id) : false; },
    hold(down) { bus.emit('input:button', { id: 'action', down: !!down }); },
    stick(x, y) { // virtual stick until stick(0,0); player has no stick API in the contract → WASD key events
      if (typeof M.player.setStick === 'function') return M.player.setStick(x, y);
      const want = { x: Math.abs(x) > 0.3 ? Math.sign(x) : 0, y: Math.abs(y) > 0.3 ? Math.sign(y) : 0 };
      const map = { x: { 1: 'KeyD', '-1': 'KeyA' }, y: { 1: 'KeyW', '-1': 'KeyS' } };
      for (const ax of ['x', 'y']) if (want[ax] !== stickKeys[ax]) {
        if (stickKeys[ax]) keyEvent('keyup', map[ax][stickKeys[ax]]);
        if (want[ax]) keyEvent('keydown', map[ax][want[ax]]);
        stickKeys[ax] = want[ax];
      }
    },
    tap(px, py) { bus.emit('input:tap', { x: px, y: py }); },
    step(seconds, dt = 1 / 60) { c.manual = true; return c.step(Math.max(1, Math.round(seconds / dt)), dt); },
    fast: fastStep,
    resume() { c.manual = false; },
    clean(x, z, r) { const res = M.trash.removeInCircle(x, z, r, 1e9, 'debug'); return res ? res.units : 0; },
    setClean(fraction) {
      const info = M.trash.info ? M.trash.info() : { size: 54 }, mid = (info.size || 54) / 2; let guard = 0;
      while (M.trash.cleanFraction() < fraction && M.trash.totalUnits() > 0 && guard++ < 100000) { const r = M.trash.consume(mid, mid, 20, 1e9, 'debug'); if (!r || !r.units) break; }
      return M.trash.cleanFraction();
    },
    counters() {
      const r = c.renderer, info = r.info; let instances = 0;
      c.scene.traverse((o) => { if (o.isInstancedMesh && o.visible) instances += o.count; });
      return { fps: c.perf.fps, frameMs: c.perf.frameMs, jsMs: c.perf.jsMs, renderMs: c.perf.renderMs, mods: Object.assign({}, c.perf.mods),
        calls: info.render.calls, triangles: info.render.triangles, textures: info.memory.textures, geometries: info.memory.geometries, instances, dpr: c.view.dpr };
    },
    events(name) { return name ? log.filter((e) => e.name === name) : log.slice(); },
    clearEvents() { log.length = 0; t0 = performance.now(); },
    save() { return c.save.now(); },
    reload() { c.save.now(); location.reload(); },
    // extras for the economy / balance tests
    econ() { return M.economy.debugState ? M.economy.debugState() : null; },
    away(seconds) { return M.economy.simulateAway ? copyPayload(M.economy.simulateAway(seconds)) : null; },
    overlay(on) { overlay.on = on == null ? !overlay.on : !!on; bus.emit('debug:overlay', { on: overlay.on }); return overlay.on; },
    overlayData() { return overlay.data; },
  };
  hook.__overlay = overlay;
  window.__ts = hook;
}

export function update() {
  if (!hook || !hook.__overlay.on) return;
  // overlay data (ui.js may show it; ui owns the overlay DOM): sampled every 30 frames, debug only
  const c = hook.ctx; if (c.time.frame % 30) return;
  const E = c.mods.economy;
  hook.__overlay.data = { fps: c.perf.fps, jsMs: c.perf.jsMs, econMs: c.perf.mods.economy, calls: c.renderer.info.render.calls, tris: c.renderer.info.render.triangles,
    coins: E.coins(), robots: E.robots().map((r) => r.state + ' ' + r.load + '/' + r.cap + (r.far ? ' far' : '')), boost: E.boostLeft(), clean: c.mods.trash.cleanFraction() };
}
