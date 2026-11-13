// main.js — boot, renderer, adaptive resolution, main loop, save orchestration.
// Owner: architecture. Contract: docs/MIMARI.md (§3 ctx, §6 events, §7 frame order, §8 save, §9 build).
//
// Loads every module in MODULES. A module that is missing (404), fails to evaluate or throws in
// init() is replaced by a stub with the same API (STUBS below), so partial builds always run.
// Modules never import each other: they talk through ctx.mods.<name>.<fn>() and ctx.bus.

const MODULES = ['config', 'bus', 'world', 'trash', 'player', 'tools', 'economy', 'audio', 'ui', 'debug'];
const INIT_ORDER = ['world', 'trash', 'player', 'tools', 'economy', 'audio', 'ui', 'debug'];
const UPDATE_ORDER = ['player', 'tools', 'economy', 'trash', 'world', 'audio', 'ui', 'debug'];
const SAVE_MODULES = ['world', 'trash', 'player', 'tools', 'economy', 'audio', 'ui'];

// Engine-only fields that config.js does not carry (every gameplay/render number lives in config.js).
const MAIN_DEFAULTS = {
  loop: { maxDt: 0.05 },
  save: { intervalS: 5, soonS: 1.0, cloudMinGapS: 15, cloudWaitS: 3 },
};

const params = new URLSearchParams(location.search);
const now = () => performance.now();

// ------------------------------------------------------------------------------------------ loading
async function loadModule(name) {
  const reg = window.__TS_MODS; // single-file build (tek.html) registers modules here
  if (reg) return reg[name] || null;
  try { return await import('./' + name + '.js'); }
  catch (e) {
    if (!/Failed to fetch|Importing a module script failed|error loading dynamically imported module/i.test(String(e && e.message))) console.error('[main] module ' + name + ' failed to load', e);
    else console.info('[main] module ' + name + ' missing, using stub');
    return null;
  }
}
function deepMerge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for (const k of Object.keys(over)) out[k] = (base && typeof base[k] === 'object' && !Array.isArray(base[k])) ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

// ------------------------------------------------------------------------------------------ stubs
// Same exported API as the real modules (MIMARI.md §4), doing as little as possible.
function makeStubs(ctx) {
  const THREE = window.THREE, C = ctx.CONFIG, D = C.district || {};
  const size = (D.sizeM && D.sizeM[0]) || 90, cell = D.cellM || 0.5, N = (D.grid && D.grid[0]) || Math.round(size / cell);
  const start = (C.player && C.player.startPos) || [size / 2, size / 2];
  const types = (C.trashTypes || []).map((t) => t.id);
  const emptyRes = { units: 0, cells: 0, cleaned: 0, byType: new Int32Array(Math.max(1, types.length)), n: 0, sx: new Float32Array(1), sy: new Float32Array(1), sz: new Float32Array(1), st: new Uint8Array(1), ss: new Uint8Array(1), sc: new Uint32Array(1) };
  const noop = () => {};
  const layout = { size, cell, N, bounds: { x0: 0, z0: 0, x1: size, z1: size }, kind: new Uint8Array(N * N).fill(1), buildings: [] };
  const light = { sunDir: new THREE.Vector3(0.45, 0.8, 0.35).normalize(), sunColor: new THREE.Color(0.62, 0.59, 0.53), skyColor: new THREE.Color(0.47, 0.51, 0.56), groundColor: new THREE.Color(0.27, 0.24, 0.2), fogColor: new THREE.Color('#cdd7dc') };
  const pts = [{ id: 'spawn', x: start[0], z: start[1], r: 0, yaw: ((C.player && C.player.startYawDeg) || 0) * Math.PI / 180 }];
  const pose = { x: start[0], y: 1.65, z: start[1], yaw: pts[0].yaw, pitch: -0.1, speed: 0, vx: 0, vz: 0, mounted: null };
  const input = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, action: false, stick: { active: false, cx: 0, cy: 0, x: 0, y: 0 } };
  const placeCam = () => { ctx.camera.position.set(pose.x, pose.y, pose.z); ctx.camera.rotation.set(pose.pitch, -pose.yaw, 0, 'YXZ'); };
  return {
    world: {
      init(ctx) {
        const s = ctx.scene;
        s.background = light.fogColor.clone(); s.fog = new THREE.Fog(light.fogColor, 30, 230);
        s.add(new THREE.HemisphereLight(0xbfd2e6, 0x6e6152, 0.62));
        const sun = new THREE.DirectionalLight(0xfff0d8, 0.62); sun.position.copy(light.sunDir); s.add(sun);
        const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x55585c }));
        g.position.set(size / 2, 0, size / 2); s.add(g);
      },
      update: noop,
      layout: () => layout, groundTexture: () => null, lighting: () => light,
      points: () => pts, point: (id) => pts.find((p) => p.id === id) || null,
      kindAt: (x, z) => (x < 0 || z < 0 || x >= size || z >= size ? 0 : 1),
      outsideUnits: () => 0,
      isBlocked: (x, z, r = 0) => x < r || z < r || x > size - r || z > size - r,
      collide(x, z, r, out) { out.x = Math.max(r, Math.min(size - r, x)); out.z = Math.max(r, Math.min(size - r, z)); out.hit = out.x !== x || out.z !== z; return out; },
      segmentClear: () => true,
    },
    trash: {
      init: noop, update: noop, save: () => null, load: noop,
      info: () => ({ N, cell, K: 4, size, types, shapes: [], blocks: 1, blockSize: N }),
      amountAt: () => 0, surfaceAt: () => 0, cellAt: () => -1, cellCenter: (i, o) => o,
      removeInCircle: () => emptyRes, removeAlongSegment: () => emptyRes, pick: () => null,
      nearestDirty: () => -1, consume: () => emptyRes, clearAll: () => emptyRes,
      cleanFraction: () => 0, unitFraction: () => 0, totalUnits: () => 0, initialUnits: () => 0,
      trashCells: () => 0, cleanCells: () => 0, blockSums: () => new Int32Array(1),
      itemGeometry: () => null, itemMaterial: () => null,
    },
    player: {
      init() { placeCam(); }, update: noop, resize: noop, save: () => null, load: noop,
      pose: () => pose, input: () => input,
      forward(out) { out.x = Math.sin(pose.yaw); out.z = -Math.cos(pose.yaw); return out; },
      aimPoint(maxDist, out) { out.hit = false; return out; },
      teleport(x, z, yaw) { pose.x = x; pose.z = z; if (yaw != null) pose.yaw = yaw; placeCam(); },
      mount: () => false, dismount: noop, mounted: () => null, setSpeedCap: noop, viewModel: () => null,
    },
    tools: { init: noop, update: noop, save: () => null, load: noop, current: () => 'brush', equip: () => false, available: () => ['brush'] },
    economy: {
      init: noop, update: noop, save: () => null, load: noop,
      coins: () => 0, earn: noop, bagUnits: () => 0, bagCapacity: () => 0, bagSpace: () => 0, addToBag: () => 0,
      stat: () => 0, owned: () => false, catalog: () => [], buy: () => false,
      boostActive: () => false, boostLeft: () => 0, boostCooldownLeft: () => 0, canOfferBoost: () => false, startBoost: noop,
      robots: () => [], sellPoints: () => [], stats: () => ({ items: 0, coins: 0, playS: 0 }),
    },
    audio: { init: noop, update: noop, save: () => null, load: noop, play: noop, setEnabled: noop, unlocked: () => false },
    ui: { init: noop, update: noop, resize: noop, save: () => null, load: noop, toast: noop, openPanel: noop, closePanel: noop },
    debug: { init: noop, update: noop },
  };
}

// ------------------------------------------------------------------------------------------ boot
async function boot() {
  const bootEl = document.getElementById('boot');
  const canvas = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  const loaded = {};
  for (const name of MODULES) loaded[name] = await loadModule(name);

  const cfgMod = loaded.config || {};
  const CONFIG = deepMerge(MAIN_DEFAULTS, cfgMod.CONFIG || {});
  const STR = cfgMod.STR || {};
  const bus = loaded.bus && loaded.bus.createBus ? loaded.bus.createBus() : fallbackBus();
  const STORE = await makeStore(CONFIG.saveKey, CONFIG.save, params);

  // shared state: main writes `paused`/`pauseReasons`; `settings` is written by ui.js (persisted in ui's save)
  // settings are written by ui.js (persisted in ui's save) and read by player (sens, invertY), tools (steer, haptics
  // via ctx.haptic), main (quality) and audio (sound, music)
  // v2 settings: fov (horizontal degrees in landscape), portrait ("Dikey oyna": no forced landscape), flip ("Ekranı çevir")
  const state = { settings: { lang: params.get('lang') === 'en' ? 'en' : 'tr', sound: true, music: true, sens: 1, invertY: false, haptics: true, steer: (CONFIG.cart && CONFIG.cart.controlMode) || 'camera', quality: 'auto', perfHud: false, fov: (CONFIG.player && CONFIG.player.fovHorizontalDegLandscape) || 104, portrait: false, flip: false }, paused: false, pauseReasons: {} };
  function t(key, vars) {
    const e = STR[key];
    let s = e ? (e[state.settings.lang] != null ? e[state.settings.lang] : (e.tr != null ? e.tr : key)) : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }

  const THREE = window.THREE;
  if (!THREE) return fatal(bootEl, t('boot_error'));
  if (!CONFIG.render) return fatal(bootEl, t('boot_error'));
  let renderer;
  try {
    // ?aa0: MSAA off (A/B for heat on device; perf review B3)
    renderer = new THREE.WebGLRenderer({ canvas, antialias: CONFIG.render.antialias && !params.has('aa0'), powerPreference: 'high-performance', stencil: false, alpha: false, preserveDrawingBuffer: params.has('debug') });
  } catch (e) { console.error(e); return fatal(bootEl, t('no_webgl')); }
  renderer.setClearColor(0xcdd7dc, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, CONFIG.render.near, CONFIG.render.far); // fov set by fovFor() in resize()
  camera.rotation.order = 'YXZ';
  scene.add(camera); // so view models parented to the camera render

  // ---- context action offers (cleared every frame, read by ui after all updates)
  const OFFER_MAX = 8, offerPool = [];
  for (let i = 0; i < OFFER_MAX; i++) offerPool.push({ id: '', label: '', priority: 0, owner: '', data: null });
  const offers = { list: offerPool, count: 0 };

  // perf.ring: the last 120 real frame times (ms) for the overlay's percentiles (?perf or settings.perfHud)
  const perf = { frameMs: 0, jsMs: 0, renderMs: 0, mods: {}, fps: 0, ring: new Float32Array(120), ringN: 0, p50: 0, p95: 0 };
  const ctx = {
    THREE, canvas, renderer, scene, camera, uiRoot, bus, CONFIG, STR, t, state,
    mods: {}, perf, params,
    debug: params.has('debug'),
    perfHud: params.has('perf'),           // ?perf: the overlay only (no preserveDrawingBuffer, no event trace, no __ts)
    isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
    isNative: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
    time: { game: 0, frame: 0, dt: 0, real: 0 },
    view: { w: 1, h: 1, dpr: 1, portrait: false, rot: 0, toView: null, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
    offers,
    offer(id, label, priority = 0, owner = '', data = null) {
      if (offers.count >= OFFER_MAX) return;
      const o = offerPool[offers.count++]; o.id = id; o.label = label; o.priority = priority; o.owner = owner; o.data = data;
    },
    setPaused(reason, on) { if (on) state.pauseReasons[reason] = true; else delete state.pauseReasons[reason]; state.paused = Object.keys(state.pauseReasons).length > 0; },
    save: { now: saveNow, soon: saveSoon, clear: clearSave, reset: resetSave, key: CONFIG.saveKey, status: null },
    haptic,                                  // haptic('light' | 'medium' | 'heavy' | 'full'): settings + rate limit
    step: manualStep, // (frames, dt) run updates + render synchronously (tests)
    manual: params.has('manual'),
    errors: {},
  };

  // ---- modules: real or stub, with any missing function filled from the stub
  const stubs = makeStubs(ctx);
  for (const name of INIT_ORDER) {
    const real = loaded[name], stub = stubs[name];
    if (real) {
      const api = Object.assign({}, real);
      for (const k of Object.keys(stub)) if (!(k in api)) api[k] = stub[k];
      api.__stub = false; ctx.mods[name] = api;
    } else { stub.__stub = true; ctx.mods[name] = stub; }
  }
  for (const name of INIT_ORDER) {
    try { await ctx.mods[name].init(ctx); }
    catch (e) {
      console.error('[main] ' + name + '.init failed, using stub', e); ctx.errors[name] = String(e && e.message);
      const stub = stubs[name]; stub.__stub = true; ctx.mods[name] = stub;
      try { stub.init(ctx); } catch (e2) { /* stub init must not break boot */ }
    }
  }

  // ---- resize + adaptive resolution
  const R = CONFIG.render;
  const devDpr = Math.max(1, window.devicePixelRatio || 1);
  const q = { max: Math.min(devDpr, R.maxDpr), min: Math.min(devDpr, R.minDpr), dpr: 1, acc: 0, n: 0, winStart: now(), good: 0, lastAvg: 0, lastDown: false, freezeUntil: 0, mode: 'auto' };
  q.dpr = Math.max(q.min, Math.min(q.max, params.has('dpr') ? +params.get('dpr') : R.startDpr));
  ctx.view.dpr = q.dpr;
  // quality setting (ui writes state.settings.quality): 'auto' adapts, 'high' pins maxDpr, 'low' pins lowDpr
  // and asks trash for the shorter 3D item band. Applied at boot (after load) and on ui:settings.
  function applyQuality() {
    const m = state.settings.quality === 'high' || state.settings.quality === 'low' ? state.settings.quality : 'auto';
    if (m === q.mode && q.applied) return;
    q.mode = m; q.applied = true;
    if (!params.has('dpr')) {
      if (m === 'high') q.dpr = q.max;
      else if (m === 'low') q.dpr = Math.min(devDpr, R.lowDpr || 1);
      else q.dpr = Math.max(q.min, Math.min(q.max, R.startDpr));
    }
    q.good = 0; q.lastDown = false; q.freezeUntil = 0;
    const tr = ctx.mods.trash; if (tr && tr.setQuality) try { tr.setQuality(m); } catch (e) { reportError('trash', e); }
    resize(); bus.emit('view:quality', { dpr: q.dpr, mode: m });
  }
  // FOV (v2): landscape from a horizontal target (settings.fov, default player.fovHorizontalDegLandscape = 104), the
  // vertical FOV that gives it clamped to fovVerticalClampDeg; a real portrait view ("Dikey oyna") a fixed vertical FOV.
  const P0 = CONFIG.player || {};
  function fovH() {
    const r = P0.fovRangeDeg || [85, 115], f = +state.settings.fov;
    return isFinite(f) && f > 0 ? Math.max(r[0], Math.min(r[1], f)) : (P0.fovHorizontalDegLandscape || 104);
  }
  function fovFor(w, h) {
    if (h > w) return P0.fovVerticalDegPortrait || 82;
    const hDeg = fovH(), cl = P0.fovVerticalClampDeg || [46, 80];
    const v = 2 * Math.atan(Math.tan(hDeg * Math.PI / 360) / (w / h)) * 180 / Math.PI;
    return Math.max(cl[0], Math.min(cl[1], v));
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;padding:var(--sat) var(--sar) var(--sab) var(--sal)';
  document.body.appendChild(probe);
  // ---- forced landscape (v2). A web page cannot rotate an iPhone, so when the viewport is portrait the game renders
  // rotated 90 degrees and the player holds the phone sideways. Canvas and HUD (#game, #ui) get the same CSS
  // transform; the browser hit-tests the rotated DOM, and ctx.view.toView maps screen coordinates to game coordinates
  // for the canvas-level stick/look maths. rot = 90: the phone turned counter-clockwise (home indicator on the right)
  // shows the game upright; settings.flip turns it 180 degrees (rot = -90). settings.portrait or ?dikey=1 keeps the
  // old upright portrait layout. A landscape viewport is never rotated. (The native app locks landscape itself.)
  const forcePortrait = params.get('dikey') === '1';
  const tvRot = { rot: 0, iw: 1, ih: 1 };
  function toView(x, y, out) {
    const r = tvRot.rot;
    if (r === 90) { out.x = y; out.y = tvRot.iw - x; } else if (r === -90) { out.x = tvRot.ih - y; out.y = x; } else { out.x = x; out.y = y; }
    return out;
  }
  function applyStage(rot, iw, ih, safe) {
    const de = document.documentElement;
    de.classList.toggle('rot', rot !== 0);
    const vw = rot ? ih : iw, vh = rot ? iw : ih;
    const tf = rot === 90 ? 'translate(' + iw + 'px,0) rotate(90deg)' : rot === -90 ? 'translate(0,' + ih + 'px) rotate(-90deg)' : '';
    for (const el of [canvas, uiRoot]) {
      const st = el.style;
      if (rot) { st.right = 'auto'; st.bottom = 'auto'; st.left = '0px'; st.top = '0px'; st.width = vw + 'px'; st.height = vh + 'px'; st.transformOrigin = '0 0'; st.transform = tf; }
      else { st.right = ''; st.bottom = ''; st.left = ''; st.top = ''; st.width = ''; st.height = ''; st.transformOrigin = ''; st.transform = ''; }
    }
    // the HUD's CSS reads --sat/--sar/--sab/--sal and --vw/--vh: give it the rotated (game-space) values
    const us = uiRoot.style;
    us.setProperty('--vw', vw + 'px'); us.setProperty('--vh', vh + 'px');
    if (rot) { us.setProperty('--sat', safe.top + 'px'); us.setProperty('--sar', safe.right + 'px'); us.setProperty('--sab', safe.bottom + 'px'); us.setProperty('--sal', safe.left + 'px'); }
    else { us.removeProperty('--sat'); us.removeProperty('--sar'); us.removeProperty('--sab'); us.removeProperty('--sal'); }
  }
  function resize() {
    const iw = Math.max(1, window.innerWidth), ih = Math.max(1, window.innerHeight);
    const cs = getComputedStyle(probe), v = ctx.view;
    const dt = parseFloat(cs.paddingTop) || 0, dr = parseFloat(cs.paddingRight) || 0, db = parseFloat(cs.paddingBottom) || 0, dl = parseFloat(cs.paddingLeft) || 0;
    const rot = ih > iw && !forcePortrait && !state.settings.portrait ? (state.settings.flip ? -90 : 90) : 0;
    tvRot.rot = rot; tvRot.iw = iw; tvRot.ih = ih;
    const w = rot ? ih : iw, h = rot ? iw : ih;
    v.w = w; v.h = h; v.portrait = h > w; v.dpr = q.dpr; v.rot = rot; v.toView = rot ? toView : null;
    // safe areas in game space: rot 90 puts the device top (notch / Dynamic Island) on the left, the bottom (home
    // indicator) on the right; rot -90 the other way round
    if (rot === 90) { v.safe.left = dt; v.safe.right = db; v.safe.top = dr; v.safe.bottom = dl; }
    else if (rot === -90) { v.safe.left = db; v.safe.right = dt; v.safe.top = dl; v.safe.bottom = dr; }
    else { v.safe.top = dt; v.safe.right = dr; v.safe.bottom = db; v.safe.left = dl; }
    applyStage(rot, iw, ih, v.safe);
    renderer.setPixelRatio(q.dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = fovFor(w, h);
    camera.updateProjectionMatrix();
    for (const name of INIT_ORDER) { const m = ctx.mods[name]; if (m.resize) try { m.resize(w, h); } catch (e) { reportError(name, e); } }
    bus.emit('view:resize', v);
  }
  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 60); };
  addEventListener('resize', onResize);
  addEventListener('orientationchange', onResize);
  if (window.visualViewport) visualViewport.addEventListener('resize', onResize);
  resize();

  // Adaptive resolution (v2, perf review F3): probe up to 2 steps down before calling it a refresh cap (30 Hz Low Power
  // Mode, throttled iframe, vsync-locked frame times); a refresh cap restores the DPR and freezes for 60 s (doubling).
  // The DPR that was too slow becomes a ceiling, retried only after a backoff of 30 s doubling to 240 s. Never above
  // render.maxDpr (2). Each change costs one long frame (resize), so changes are rare by design.
  q.probe = 0; q.probeFrom = q.dpr; q.probeAvg = 0; q.ceil = 9; q.ceilUntil = 0; q.backoff = 30000; q.capFreeze = 60000;
  function adapt(frameMs, tNow) {
    if (frameMs < 100) { perf.ring[perf.ringN++ % perf.ring.length] = frameMs; }
    if (!R.adaptive || params.has('dpr') || q.mode !== 'auto') { if (frameMs < 100) { q.acc += frameMs; q.n++; if (tNow - q.winStart >= 1000) { perf.fps = 1000 / (q.acc / q.n); q.acc = 0; q.n = 0; q.winStart = tNow; } } return; }
    if (frameMs > 250) return; // hitches, tab switches (a slow GPU frame is < 100 ms; > 250 ms is a stall)
    q.acc += frameMs; q.n++;
    if (tNow - q.winStart < 1000) return;
    const avg = q.acc / q.n; q.acc = 0; q.n = 0; q.winStart = tNow;
    perf.fps = 1000 / avg;
    if (tNow < q.freezeUntil) return;
    const d0 = q.dpr;
    if (avg > R.downMs && q.dpr > q.min) {
      if (q.probe === 0) { q.probe = 1; q.probeFrom = q.dpr; q.probeAvg = avg; }
      else if (avg <= q.probeAvg * 0.93) { q.probe = 1; q.probeFrom = q.dpr; q.probeAvg = avg; }   // the last step helped: keep going
      else if (++q.probe > 2) {   // two steps did not help: a refresh cap, not fill rate
        q.dpr = q.probeFrom; q.probe = 0; q.freezeUntil = tNow + q.capFreeze; q.capFreeze = Math.min(600000, q.capFreeze * 2);
        resize(); bus.emit('view:quality', { dpr: q.dpr }); return;
      }
      q.ceil = Math.min(q.ceil, q.dpr); q.ceilUntil = tNow + q.backoff; q.backoff = Math.min(240000, q.backoff * 2);
      q.dpr = Math.max(q.min, q.dpr * R.step); q.good = 0;
    } else if (avg < R.upMs) {
      q.probe = 0;
      const next = Math.min(q.max, q.dpr / R.step);
      if (++q.good >= R.upAfterS && q.dpr < q.max && (next < q.ceil - 1e-3 || tNow > q.ceilUntil)) { if (tNow > q.ceilUntil) q.ceil = 9; q.dpr = next; q.good = 0; }
    } else q.good = 0;
    if (q.dpr !== d0) { resize(); bus.emit('view:quality', { dpr: q.dpr }); }
  }
  function percentiles() {
    const n = Math.min(perf.ringN, perf.ring.length); if (!n) return;
    const a = Array.from(perf.ring.subarray(0, n)).sort((x, y) => x - y);
    perf.p50 = a[Math.floor(n * 0.5)]; perf.p95 = a[Math.min(n - 1, Math.floor(n * 0.95))];
  }
  ctx.perfStats = percentiles;

  // ---- save orchestration (one key, one object per module). v2: one small storage wrapper (`store`, built before
  // init by makeStore below) with a real write/read-back probe and fallbacks localStorage -> sessionStorage ->
  // IndexedDB -> memory, plus the claude.ai artifact's per-person database when the host offers it (the artifact
  // iframe may have no usable browser storage at all). ui shows "Kaydedildi" on each save and an honest notice when
  // progress cannot be kept (store.persistent false).
  const store = STORE;
  ctx.save.status = { kind: store.kind, persistent: store.persistent, cloud: store.cloud };
  if (!store.persistent) console.info('[main] no lasting storage here (' + store.kind + '): progress is kept only while this page is open');
  function readSave() {
    if (params.has('nosave') || params.has('reset')) return null;
    try { const s = store.get(); if (!s) return null; const d = JSON.parse(s); return d && typeof d === 'object' ? d : null; } catch (e) { console.warn('[main] save unreadable, starting fresh', e); return null; }
  }
  const savedEv = { kind: '', persistent: false, bytes: 0, reason: '' };
  function saveNow(reason) {
    if (params.has('nosave') || saveBlocked || !booted) return false;
    clearTimeout(soonTimer); soonTimer = 0;
    bus.emit('game:willSave', null);
    const data = { v: CONFIG.version || 1, savedAt: Date.now(), playS: ctx.time.game, mods: {} };
    for (const name of SAVE_MODULES) { const m = ctx.mods[name]; if (m.__stub || !m.save) continue; try { const d = m.save(); if (d != null) data.mods[name] = d; } catch (e) { reportError(name, e); } }
    if (prevSave && prevSave.mods) for (const k of Object.keys(prevSave.mods)) if (!(k in data.mods) && ctx.mods[k] && ctx.mods[k].__stub) data.mods[k] = prevSave.mods[k]; // keep data of modules missing in this build
    let str;
    try { str = JSON.stringify(data); } catch (e) { console.warn('[main] save failed', e); return false; }
    const ok = store.set(str);
    savedEv.kind = store.kind; savedEv.persistent = store.persistent; savedEv.bytes = str.length; savedEv.reason = typeof reason === 'string' ? reason : '';
    ctx.save.status.kind = store.kind; ctx.save.status.persistent = store.persistent;
    if (ok) bus.emit('game:saved', savedEv);
    return ok;
  }
  // a save soon (coalesces bursts: every sale, purchase, milestone asks for one)
  let soonTimer = 0;
  function saveSoon() { if (!soonTimer) soonTimer = setTimeout(() => { soonTimer = 0; saveNow('soon'); }, (CONFIG.save.soonS || 1) * 1000); }
  function clearSave() { store.remove(); }
  // reset: delete the save and reload WITHOUT the pagehide/visibility saves writing it back
  let saveBlocked = false, booted = false;
  function resetSave() { saveBlocked = true; clearSave(); setTimeout(() => { try { location.reload(); } catch (e) { /* ignore */ } }, store.cloud ? 400 : 0); }
  // haptics: one owner of the rate limit and the setting (ui: buttons, sale, purchase, milestone; tools: picks,
  // bumps). Capacitor Haptics plugin when present, else navigator.vibrate (no-op on iOS Safari).
  const HC = CONFIG.haptics || { lightMaxPerS: 15, minGapMs: 40 };
  const hz = { t: 0, n: 0, last: -1e9 };
  const HAPTIC_MS = { light: 6, medium: 16, heavy: 30, full: [18, 40, 28] };
  function haptic(kind) {
    if (state.settings.haptics === false) return;
    const tn = now();
    if (kind === 'light') {
      if (tn - hz.t > 1000) { hz.t = tn; hz.n = 0; }
      if (hz.n >= HC.lightMaxPerS || tn - hz.last < HC.minGapMs) return;
      hz.n++;
    }
    hz.last = tn;
    try {
      const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
      if (H && H.impact) { const pr = H.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'light' ? 'LIGHT' : 'MEDIUM' }); if (pr && pr.catch) pr.catch(() => {}); return; }
      if (ctx.isTouch && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(HAPTIC_MS[kind] || 10);
    } catch (e) { /* haptics are optional */ }
  }
  if (params.has('reset')) clearSave();
  let prevSave = readSave();
  // v2 changed the district (54 -> 90 m) and the tool ladder: a v1 save cannot be continued. Keep only the settings.
  if (prevSave && (prevSave.v | 0) < (CONFIG.version || 1)) {
    console.info('[main] save from format v' + prevSave.v + ' (old district): starting fresh, settings kept');
    const ui = prevSave.mods && prevSave.mods.ui;
    prevSave = { v: CONFIG.version, savedAt: 0, playS: 0, mods: ui && ui.settings ? { ui: { v: ui.v || 1, settings: ui.settings } } : {} };
  }
  for (const name of SAVE_MODULES) {
    const m = ctx.mods[name]; if (m.__stub || !m.load) continue;
    const d = prevSave && prevSave.mods ? prevSave.mods[name] : undefined;
    try { m.load(d == null ? null : d); } catch (e) { reportError(name, e); }
  }
  if (prevSave && prevSave.playS) ctx.time.game = prevSave.playS;
  const awayS = prevSave && prevSave.savedAt ? Math.max(0, (Date.now() - prevSave.savedAt) / 1000) : 0;
  const hadSave = !!(prevSave && prevSave.savedAt);

  // ---- loop
  function reportError(name, e) {
    const k = name || '?'; ctx.errors[k] = (ctx.errors[k] || 0) + 1;
    if (ctx.errors[k] <= 3) console.error('[main] ' + k + ' threw', e);
  }
  function tick(dt) {
    ctx.time.dt = dt; ctx.time.frame++;
    if (!state.paused) ctx.time.game += dt;
    offers.count = 0;
    const sdt = state.paused ? 0 : dt;
    const t0 = now();
    for (const name of UPDATE_ORDER) {
      const m = ctx.mods[name]; const a = now();
      try { m.update(sdt); } catch (e) { reportError(name, e); }
      perf.mods[name] = perf.mods[name] * 0.9 + (now() - a) * 0.1 || 0;
    }
    const t1 = now();
    renderer.render(scene, camera);
    const t2 = now();
    perf.jsMs = perf.jsMs * 0.9 + (t1 - t0) * 0.1; perf.renderMs = perf.renderMs * 0.9 + (t2 - t1) * 0.1;
  }
  let last = now(), raf = 0, saveTimer = 0;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const tNow = ts || now();
    const realMs = tNow - last; last = tNow;
    ctx.time.real += realMs / 1000;
    if (ctx.manual) return;
    perf.frameMs = perf.frameMs * 0.9 + realMs * 0.1;
    adapt(realMs, tNow);
    tick(Math.min(CONFIG.loop.maxDt, Math.max(0, realMs / 1000)));
    if (!state.paused && (saveTimer += realMs / 1000) > CONFIG.save.intervalS) { saveTimer = 0; saveNow('auto'); }
  }
  function manualStep(frames = 1, dt = 1 / 60) { for (let i = 0; i < frames; i++) tick(dt); return ctx.time.game; }

  // ---- lifecycle: hidden tab / app background, WebGL context loss
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); ctx.setPaused('hidden', true); saveNow('hidden'); bus.emit('app:pause', null); }
    else {
      const away = hiddenAt ? (Date.now() - hiddenAt) / 1000 : 0; hiddenAt = 0;
      ctx.setPaused('hidden', false); last = now();
      // the context may have been lost while hidden (iOS reclaims GL of background pages): re-arm the recovery (perf F2)
      if (state.pauseReasons.gl) { clearTimeout(glTimer); glTimer = setTimeout(() => { if (state.pauseReasons.gl && !document.hidden) { saveNow('gl'); location.reload(); } }, (R.glLostReloadS || 4) * 1000); }
      // the boost runs out in real time while away (QA #9): economy's catch-up handles awayS
      bus.emit('app:resume', { awayS: away });
    }
  });
  addEventListener('pagehide', () => saveNow('pagehide'));
  addEventListener('beforeunload', () => saveNow('unload'));
  addEventListener('blur', () => saveNow('blur'));
  document.addEventListener('freeze', () => saveNow('freeze'));
  // WebGL context loss (iOS under memory pressure / long background): pause, save, wait for the restore; three r128
  // re-creates its GL objects on restore and re-uploads textures and buffers lazily. If the browser does not
  // restore within render.glLostReloadS, save and reload the page (the save brings the player back exactly).
  let glTimer = 0;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); ctx.setPaused('gl', true); saveNow();
    bus.emit('gl:lost', null); bus.emit('ui:toast', { text: t('gl_lost') });
    clearTimeout(glTimer);
    glTimer = setTimeout(() => { if (state.pauseReasons.gl && !document.hidden) { saveNow(); location.reload(); } }, (R.glLostReloadS || 4) * 1000);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(glTimer); ctx.setPaused('gl', false); last = now();
    bus.emit('gl:restored', null); resize();
  });
  let lastLayout = '';
  bus.on('ui:settings', () => {
    applyQuality();
    const sig = state.settings.fov + '|' + !!state.settings.portrait + '|' + !!state.settings.flip;
    if (sig !== lastLayout) { lastLayout = sig; resize(); }
    saveSoon();
  });

  bus.on('game:saveNow', () => saveSoon());
  bus.on('economy:sold', (p) => { if (p && p.by === 'player') saveSoon(); });
  window.__tsCtx = ctx.debug ? ctx : undefined;

  applyQuality(); // after load: ui restored the saved settings
  // compile every shader program now (perf review F1: robots, dust, confetti and cart compiled mid-game, up to 69 ms
  // in SwiftShader, more on Metal). three r128 compile() traverses invisible objects too.
  try { renderer.compile(scene, camera); } catch (e) { console.warn('[main] precompile', e); }
  // first frame, then lift the curtain
  try { tick(0); } catch (e) { console.error(e); }
  lastLayout = state.settings.fov + '|' + !!state.settings.portrait + '|' + !!state.settings.flip;
  resize(); // settings restored by ui (fov, portrait, flip)
  booted = true;
  bus.emit('game:ready', { fresh: !hadSave, awayS, storage: ctx.save.status });
  bootEl.classList.add('off');
  setTimeout(() => bootEl.remove(), 400);
  last = now();
  raf = requestAnimationFrame(frame);
}

// ------------------------------------------------------------------------------------------ storage
// One small wrapper: get() -> string | null (from a cache filled at boot), set(str) -> boolean, remove().
// Order: localStorage -> sessionStorage -> IndexedDB -> memory; each is accepted only after a real write + read-back
// (a sandboxed or third-party iframe can throw, or silently drop writes). kind says which one is used, persistent
// whether progress survives closing the page (memory: no; session: only while the tab lives). If the claude.ai
// artifact host offers its per-person database (window.claude.use('db') + 'user', declared as capabilities
// {db: {}, user: {}} when the artifact is published), it is used as well and wins when its save is newer.
async function makeStore(key, SC, params) {
  SC = SC || {};
  const probeKey = key + '.probe', token = String(Math.random()).slice(2, 10);
  const tryWeb = (name) => { try { const s = window[name]; if (!s) return null; s.setItem(probeKey, token); const ok = s.getItem(probeKey) === token; s.removeItem(probeKey); return ok ? s : null; } catch (e) { return null; } };
  let mem = null, kind = 'memory', persistent = false, web = null, idb = null;
  if (params.has('nostorage')) { /* tests: behave like a page without any storage */ }
  else if ((web = tryWeb('localStorage'))) { kind = 'local'; persistent = true; }
  else if ((web = tryWeb('sessionStorage'))) { kind = 'session'; persistent = false; }
  else {
    idb = await openIdb(key, 1500);
    if (idb) { kind = 'idb'; persistent = true; mem = idb.value; }
  }
  if (web) { try { mem = web.getItem(key); } catch (e) { mem = null; } }
  // optional cloud copy (claude.ai artifact host)
  let cloud = null;
  if (!params.has('nostorage') && !params.has('nocloud') && window.claude && typeof window.claude.use === 'function') cloud = await openCloud(key, (SC.cloudWaitS || 3) * 1000);
  if (cloud && cloud.value) {
    const at = (s) => { try { return (JSON.parse(s) || {}).savedAt || 0; } catch (e) { return 0; } };
    if (!mem || at(cloud.value) > at(mem)) mem = cloud.value;
  }
  let lastCloud = 0, cloudBusy = false, cloudPending = null, cloudTimer = 0;
  function pushCloud(str) {
    if (!cloud) return;
    cloudPending = str;
    const gap = (SC.cloudMinGapS || 15) * 1000, wait = Math.max(0, lastCloud + gap - Date.now());
    if (cloudBusy || cloudTimer) return;
    cloudTimer = setTimeout(async () => {
      cloudTimer = 0; if (cloudPending == null) return;
      const s = cloudPending; cloudPending = null; cloudBusy = true; lastCloud = Date.now();
      try { await cloud.write(s); } catch (e) { console.info('[main] cloud save failed', e && e.code); }
      cloudBusy = false; if (cloudPending != null) pushCloud(cloudPending);
    }, wait);
  }
  return {
    kind: cloud && kind !== 'local' ? 'cloud' : kind, persistent: persistent || !!cloud, cloud: !!cloud,
    get() { return mem; },
    set(str) {
      mem = str;
      let ok = true;
      if (web) { try { web.setItem(key, str); } catch (e) { ok = false; console.warn('[main] save failed', e); } }
      if (idb) idb.write(str);
      pushCloud(str);
      return ok;
    },
    remove() {
      mem = null;
      if (web) { try { web.removeItem(key); } catch (e) { /* ignore */ } }
      if (idb) idb.write(null);
      if (cloud) { cloudPending = null; clearTimeout(cloudTimer); cloudTimer = 0; cloud.write(null).catch(() => {}); }
    },
  };
}
function openIdb(key, timeoutMs) {
  return new Promise((resolve) => {
    let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => fin(null), timeoutMs);
    try {
      if (!window.indexedDB) return fin(null);
      const rq = indexedDB.open('temizsehir', 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore('kv'); } catch (e) { /* exists */ } };
      rq.onerror = () => fin(null);
      rq.onsuccess = () => {
        const db = rq.result;
        const write = (v) => { try { const tx = db.transaction('kv', 'readwrite'); if (v == null) tx.objectStore('kv').delete(key); else tx.objectStore('kv').put(v, key); } catch (e) { /* ignore */ } };
        try {
          // probe: write + read back
          const tx = db.transaction('kv', 'readwrite'), st = tx.objectStore('kv');
          st.put('1', key + '.probe');
          const g = st.get(key + '.probe'), gv = st.get(key);
          tx.oncomplete = () => fin(g.result === '1' ? { value: typeof gv.result === 'string' ? gv.result : null, write } : null);
          tx.onerror = () => fin(null);
        } catch (e) { fin(null); }
      };
    } catch (e) { fin(null); }
  });
}
async function openCloud(key, timeoutMs) {
  const timeout = new Promise((r) => setTimeout(() => r(null), timeoutMs));
  try {
    const got = await Promise.race([Promise.all([window.claude.use('db'), window.claude.use('user')]), timeout]);
    if (!got || !got[0] || !got[1]) return null;
    const [db, user] = got;
    const uid = await Promise.race([user.id(), timeout]);
    if (!uid) return null;
    const ref = db.doc('data/users/' + uid + '/' + key.replace(/[^\w-]/g, '_'));
    const snap = await Promise.race([ref.get(), timeout]);
    if (!snap) return null;
    const d = snap.exists && snap.data ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    return {
      value: d && typeof d.s === 'string' ? d.s : null,
      write: (s) => (s == null ? ref.delete() : ref.set({ s, at: Date.now() })),
    };
  } catch (e) { console.info('[main] artifact storage unavailable', e && (e.code || e.message)); return null; }
}

function fallbackBus() {
  const m = new Map();
  return {
    on(n, f) { (m.get(n) || m.set(n, []).get(n)).push(f); return () => this.off(n, f); },
    off(n, f) { const a = m.get(n); if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
    once(n, f) { const u = this.on(n, (p) => { u(); f(p); }); return u; },
    emit(n, p) { const a = m.get(n); if (!a) return 0; for (const f of a.slice()) try { f(p); } catch (e) { console.error(e); } return a.length; },
    count(n) { return (m.get(n) || []).length; }, setTrace() {}, errors: { count: 0 },
  };
}
function fatal(el, msg) { if (el) { el.textContent = msg; el.classList.remove('off'); } }

boot().catch((e) => { console.error('[main] boot failed', e); fatal(document.getElementById('boot'), 'Oyun başlatılamadı.'); });
