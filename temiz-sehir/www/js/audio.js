// audio.js — procedural Web Audio for Temiz Şehir. Owner: audio. Contract: docs/MIMARI.md §4.8, §6.
// Notes and measurements: docs/notlar/audio.md. No asset files: every sound is synthesised into an AudioBuffer
// (one-shots, generated lazily / in idle frames) or built from live nodes (loops: vacuum, broom, robot hum, city bed).
//
// Graph:  one-shots ─┐
//         loops ─────┼─ sfx bus ─┐
//         city bed ──── amb bus ─┴─ master ─ highpass (phone) ─ compressor ─ out gain ─ destination
// Voice limiting: per-sound max voices (oldest stolen) + min gap + a global cap, so 30 pickups/s cannot clip
// or pile up nodes. Pitch = playbackRate (cheap); positional = distance gain + StereoPanner (no HRTF).

// ------------------------------------------------------------------------------------------ tunables
const A = {
  master: 0.8, sfx: 0.9, amb: 0.55, highpassHz: 110, outGain: 1.0,
  comp: { threshold: -14, knee: 8, ratio: 5, attack: 0.003, release: 0.18 },
  maxVoices: 28,
  updateHz: 20,
  posMaxDist: 30,              // default falloff distance for positional one-shots (m)
  humVol: 0.11,                // robot hum at 0 m
  vacVol: 0.22, broomVol: 0.16,
  rumble: [0.30, 0.065], rumbleHz: [1100, 420],   // city bed at 0 % → 100 % clean
  flies: 0.045, fliesGoneAt: 0.6,
  air: [0.012, 0.05],
  birdRate: [0.04, 0.9],       // chirps per second at 0 % → 100 %
  hornEveryS: 14, hornGoneAt: 0.55,
  stepMaxPerS: 4,
};
// per sound: vol, max simultaneous voices, min gap (s), random pitch spread (semitones), bus
const SND = {
  pop:      { vol: 0.42, max: 6, gap: 0.028, vary: 0.35 },
  chime:    { vol: 0.55, max: 2, gap: 0.08, vary: 0 },
  coin:     { vol: 0.30, max: 18, gap: 0.0, vary: 0.15 },
  kaching:  { vol: 0.5, max: 2, gap: 0.1, vary: 0 },
  swish:    { vol: 0.32, max: 3, gap: 0.12, vary: 0.8 },
  thud:     { vol: 0.75, max: 1, gap: 0.3, vary: 0 },
  click:    { vol: 0.35, max: 3, gap: 0.03, vary: 0.4 },
  purchase: { vol: 0.62, max: 1, gap: 0.2, vary: 0 },
  ms1:      { vol: 0.6, max: 1, gap: 0.5, vary: 0 },
  ms2:      { vol: 0.6, max: 1, gap: 0.5, vary: 0 },
  ms3:      { vol: 0.62, max: 1, gap: 0.5, vary: 0 },
  fanfare:  { vol: 0.66, max: 1, gap: 1, vary: 0 },
  boost:    { vol: 0.45, max: 1, gap: 0.3, vary: 0 },
  open:     { vol: 0.22, max: 2, gap: 0.05, vary: 0 },
  close:    { vol: 0.2, max: 2, gap: 0.05, vary: 0 },
  equip:    { vol: 0.4, max: 1, gap: 0.1, vary: 0 },
  nozzleDown: { vol: 0.45, max: 1, gap: 0.1, vary: 0 },
  nozzleUp: { vol: 0.4, max: 1, gap: 0.1, vary: 0 },
  robot:    { vol: 0.35, max: 2, gap: 0.2, vary: 0 },
  crunch:   { vol: 0.16, max: 2, gap: 0.1, vary: 1.5 },
  rev:      { vol: 0.45, max: 1, gap: 0.3, vary: 0 },
  gust:     { vol: 0.6, max: 1, gap: 1, vary: 0 },
  horn:     { vol: 0.07, max: 1, gap: 2, vary: 1, bus: 'amb' },
  chirp:    { vol: 0.10, max: 3, gap: 0.05, vary: 1.5, bus: 'amb' },
};
const GEN_ORDER = ['pop', 'click', 'coin', 'thud', 'swish', 'kaching', 'chime', 'purchase', 'open', 'close', 'equip', 'chirp', 'crunch', 'robot', 'boost', 'nozzleDown', 'nozzleUp', 'rev', 'horn', 'ms1', 'ms2', 'ms3', 'gust', 'fanfare'];

// ------------------------------------------------------------------------------------------ state
let C = null, ac = null, G = null, SR = 24000;   // SR = generation rate of the synthesised buffers (browser resamples)
const GEN_SR = 24000;
const DATA = {};          // name -> Float32Array, synthesised in init() (behind the boot curtain, never mid-game)
const en = { sound: true, music: true };
const buffers = {};
const voices = {};       // name -> array of { src, end }
let activeVoices = 0;
let acc = 0;
const L = {               // live loop + mix state
  chain: 0, lastPick: -1,                 // pickup pitch ladder
  vac: null, broom: null, hum: [], amb: null,
  vacAct: 0, broomAct: 0, nozzleDown: true, mounted: false,
  clean: 0, cleanTarget: 0, birdT: 3, hornT: 6, stepT: 0,
  lastParams: new Float32Array(64),
};

// ------------------------------------------------------------------------------------------ public API
export function init(ctx) {
  C = ctx;
  const s = ctx.state && ctx.state.settings;
  if (s) { en.sound = s.sound !== false; en.music = s.music !== false; }
  const unlock = () => ensureContext(true);
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'mousedown']) addEventListener(ev, unlock, { capture: true, passive: true });
  bindBus(ctx.bus);
  // synthesise every sample now: no AudioContext is needed for the data, and doing it here keeps it off game frames
  const t0 = performance.now();
  for (const n of GEN_ORDER) { seed = 12345 + n.length * 977 + n.charCodeAt(0); DATA[n] = GEN[n](); }
  for (const n of ['white', 'brown']) DATA['loop_' + n] = makeLoop(n);
  genMs = performance.now() - t0;
}
let genMs = 0;

export function update() {
  if (!ac || !G) return;
  acc += (C.time && C.time.dt) || 0;
  if (acc < 1 / A.updateHz) return;
  const step = acc; acc = 0;
  updateLoops(step);
}

export function play(name, opts) {
  if (!ac || !G || !en.sound) return;
  const d = SND[name]; if (!d) return;
  const t = ac.currentTime + ((opts && opts.delay) || 0);
  if (d.last != null && t - d.last < d.gap && t >= d.last) return;
  let vol = d.vol * (opts && opts.vol != null ? opts.vol : 1);
  let pan = 0;
  if (opts && opts.x != null && opts.z != null) {
    const p = listener();
    if (p) {
      const dx = opts.x - p.x, dz = opts.z - p.z, dist = Math.sqrt(dx * dx + dz * dz);
      const maxD = opts.maxDist || A.posMaxDist;
      if (dist >= maxD) return;
      const k = 1 - dist / maxD; vol *= k * k;
      // right vector of yaw (forward = (sin, -cos)) → (cos, sin)
      if (dist > 0.5) pan = Math.max(-0.85, Math.min(0.85, (dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw)) / dist));
    }
  }
  if (vol < 0.004) return;
  let semis = opts && opts.pitchSemis != null ? opts.pitchSemis : 0;
  if (d.vary) semis += (Math.random() * 2 - 1) * d.vary;
  d.last = t;
  voice(name, d, t, Math.pow(2, semis / 12), vol, pan);
}

export function setEnabled(sound, music) {
  en.sound = !!sound; en.music = !!music;
  if (!G) return;
  const t = ac.currentTime;
  G.sfx.gain.setTargetAtTime(en.sound ? A.sfx : 0, t, 0.05);
  G.amb.gain.setTargetAtTime(en.sound && en.music ? A.amb : 0, t, en.sound && en.music ? 0.3 : 0.05);
  // nothing audible: suspend the context so the audio thread costs nothing
  if (!en.sound && !en.music) { if (ac.state === 'running' && ac.suspend) ac.suspend().catch(noop); }
  else if (ac.state === 'suspended' && L.gestured) resume();
}

export function unlocked() { return !!ac && ac.state === 'running'; }

export function save() { return null; }
export function load() { /* nothing persisted: settings live in ui's save */ }

// ------------------------------------------------------------------------------------------ context + graph
function noop() {}
function resume() { try { const r = ac.resume && ac.resume(); if (r && r.catch) r.catch(noop); } catch (e) { /* offline contexts */ } }
function ensureContext(fromGesture) {
  if (fromGesture) L.gestured = true;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ac = new AC(); } catch (e2) { return; } }
    buildGraph();
    // iOS: playing a buffer inside the gesture unlocks output
    const b = ac.createBuffer(1, 1, SR), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0);
    setEnabled(en.sound, en.music);
  }
  if (ac.state !== 'running' && (en.sound || en.music)) resume();
}
function buildGraph() {
  const g = {};
  g.out = ac.createGain(); g.out.gain.value = A.outGain;
  g.comp = ac.createDynamicsCompressor();
  for (const k of Object.keys(A.comp)) g.comp[k].value = A.comp[k];
  g.hp = ac.createBiquadFilter(); g.hp.type = 'highpass'; g.hp.frequency.value = A.highpassHz; g.hp.Q.value = 0.7;
  g.master = ac.createGain(); g.master.gain.value = A.master;
  g.sfx = ac.createGain(); g.sfx.gain.value = en.sound ? A.sfx : 0;
  g.amb = ac.createGain(); g.amb.gain.value = en.sound && en.music ? A.amb : 0;
  g.sfx.connect(g.master); g.amb.connect(g.master);
  g.master.connect(g.hp); g.hp.connect(g.comp); g.comp.connect(g.out); g.out.connect(ac.destination);
  G = g;
  startAmbient();
}

function getBuffer(name) {
  let b = buffers[name];
  if (b) return b;
  const data = DATA[name]; if (!data) return null;
  b = ac.createBuffer(1, data.length, GEN_SR);
  b.getChannelData(0).set(data);
  buffers[name] = b;
  return b;
}

// one-shot voice with limiting
function voice(name, d, when, rate, vol, pan) {
  const buf = getBuffer(name); if (!buf) return;
  let list = voices[name]; if (!list) list = voices[name] = [];
  const now = ac.currentTime;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].end <= now) { list.splice(i, 1); activeVoices--; }
  if (list.length >= d.max) { const old = list.shift(); activeVoices--; try { old.g.gain.setTargetAtTime(0, now, 0.01); old.src.stop(now + 0.05); } catch (e) { /* already stopped */ } }
  if (activeVoices >= A.maxVoices) return;
  const src = ac.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(g);
  let tail = g;
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
  tail.connect(d.bus === 'amb' ? G.amb : G.sfx);
  src.start(when);
  const v = { src, g, end: when + buf.duration / rate + 0.02 };
  list.push(v); activeVoices++;
  src.onended = () => { try { tail.disconnect(); } catch (e) { /* ignore */ } const i = list.indexOf(v); if (i >= 0) { list.splice(i, 1); activeVoices--; } };
}

function listener() { const pl = C.mods && C.mods.player; return pl && pl.pose ? pl.pose() : null; }

// ------------------------------------------------------------------------------------------ events
function bindBus(b) {
  b.on('tool:collect', (p) => {
    if (!p || !ac) return;
    const t = ac.currentTime;
    if (p.tool === 'cart') { L.vacAct = Math.min(1.5, L.vacAct + p.units * 0.04); }
    else {
      // rising pitch ladder: +step semitone per pickup inside the chain window, capped
      const F = (C.CONFIG && C.CONFIG.feedback) || {};
      const win = F.pickupChainWindowS || 0.6, stepS = F.pickupPitchStepSemis || 1, maxS = F.pickupPitchMaxSemis || 12;
      L.chain = (L.lastPick >= 0 && t - L.lastPick <= win) ? Math.min(maxS, L.chain + stepS) : 0;
      L.lastPick = t;
      if (p.tool === 'broom') { L.broomAct = Math.min(1.5, L.broomAct + p.units * 0.06); play('pop', { pitchSemis: L.chain, vol: 0.55 }); }
      else play('pop', { pitchSemis: L.chain });
    }
    if (p.valuable) play('chime');
  });
  b.on('tool:swing', (p) => play('swish', { vol: 0.45 + 0.55 * Math.min(1, ((p && p.speed) || 1.5) / 2.4) }));
  b.on('economy:sold', (p) => {
    if (!p || !ac) return;
    if (p.by === 'robot') { play('coin', { x: p.x, z: p.z, vol: 0.8, maxDist: 40 }); return; }
    // coin cascade over ~the counter roll time, rising
    const coins = p.coins || 0;
    const n = Math.max(3, Math.min(16, Math.round(3 + Math.log2(1 + coins) * 1.3)));
    const span = ((C.CONFIG && C.CONFIG.feedback && C.CONFIG.feedback.coinCounterRollS) || 0.8) * 0.9;
    const d = SND.coin, t0 = ac.currentTime + 0.12;
    for (let i = 0; i < n; i++) voice('coin', d, t0 + (span * i) / n + Math.random() * 0.012, Math.pow(2, (i * 7 / n + (Math.random() - 0.5) * 0.3) / 12), d.vol * (0.75 + 0.25 * (i / n)), (Math.random() - 0.5) * 0.4);
    if (coins >= 40 || p.valuable) voice('kaching', SND.kaching, t0 + span + 0.02, 1, SND.kaching.vol * (p.valuable ? 1.2 : 1), 0);
  });
  b.on('economy:bagFull', () => play('thud'));
  b.on('economy:purchased', () => play('purchase'));
  b.on('trash:milestone', (p) => {
    const ms = (C.CONFIG && C.CONFIG.milestones) || [];
    const m = p && ms[p.index];
    if (m && m.at >= 1) return;               // 100 %: district:cleaned plays the fanfare
    const i = Math.max(0, Math.min(2, (p && p.index) || 0));
    play('ms' + (i + 1));
  });
  b.on('district:cleaned', () => play('fanfare'));
  b.on('economy:finalSweep', () => play('gust'));
  b.on('economy:boost', (p) => { if (p && p.active) play('boost'); });
  b.on('ui:panel', (p) => play(p && p.open ? 'open' : 'close'));
  b.on('tool:changed', () => play('equip'));
  b.on('tool:nozzle', (p) => { L.nozzleDown = !!(p && p.down); play(L.nozzleDown ? 'nozzleDown' : 'nozzleUp'); });
  b.on('player:mount', () => { L.mounted = true; play('rev'); });
  b.on('player:dismount', () => { L.mounted = false; });
  b.on('player:step', () => { if (!L.mounted && ac && ac.currentTime - L.stepT > 1 / A.stepMaxPerS) { L.stepT = ac.currentTime; play('crunch'); } });
  b.on('robot:added', () => play('robot'));
  b.on('app:pause', () => { if (ac && ac.state === 'running' && ac.suspend) ac.suspend().catch(noop); });
  b.on('app:resume', () => { if (ac && (en.sound || en.music) && L.gestured) resume(); });
}

// ------------------------------------------------------------------------------------------ loops
function noiseSource(name) {
  const s = ac.createBufferSource(); s.buffer = getLoop(name); s.loop = true; return s;
}
const loops = {};
function getLoop(name) {
  if (loops[name]) return loops[name];
  const d = DATA['loop_' + name];
  const b = ac.createBuffer(1, d.length, GEN_SR); b.getChannelData(0).set(d);
  return (loops[name] = b);
}
function makeLoop(name) {
  seed = 777 + name.length;
  const sec = name === 'brown' ? 4 : 2, n = Math.ceil(sec * SR), d = new Float32Array(n);
  if (name === 'white') for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
  else { let y = 0; for (let i = 0; i < n; i++) { y = (y + 0.02 * (rnd() * 2 - 1)) * 0.997; d[i] = y; } normalize(d, 0.9); }
  // seamless loop: crossfade the last 0.25 s into the start
  const xf = Math.floor(0.25 * SR);
  for (let i = 0; i < xf; i++) { const k = i / xf; d[n - xf + i] = d[n - xf + i] * (1 - k) + d[i] * k; }
  return d;
}
function setP(slot, param, v, tc) {
  if (Math.abs(L.lastParams[slot] - v) < 1e-4) return;
  L.lastParams[slot] = v;
  param.setTargetAtTime(v, ac.currentTime, tc || 0.08);
}

function startAmbient() {
  const a = {};
  a.rumble = noiseSource('brown');
  a.rlp = ac.createBiquadFilter(); a.rlp.type = 'lowpass'; a.rlp.frequency.value = A.rumbleHz[0]; a.rlp.Q.value = 0.5;
  a.rg = ac.createGain(); a.rg.gain.value = A.rumble[0];
  a.rumble.connect(a.rlp); a.rlp.connect(a.rg); a.rg.connect(G.amb);
  // flies: two detuned saws, band-passed, amplitude-wobbled — the "dirty" signifier that fades with cleaning
  a.f1 = ac.createOscillator(); a.f1.type = 'sawtooth'; a.f1.frequency.value = 212;
  a.f2 = ac.createOscillator(); a.f2.type = 'sawtooth'; a.f2.frequency.value = 226;
  a.fbp = ac.createBiquadFilter(); a.fbp.type = 'bandpass'; a.fbp.frequency.value = 900; a.fbp.Q.value = 1.4;
  a.fam = ac.createGain(); a.fam.gain.value = 0.5;
  a.lfo = ac.createOscillator(); a.lfo.frequency.value = 5.3; a.lfoG = ac.createGain(); a.lfoG.gain.value = 0.45;
  a.lfo.connect(a.lfoG); a.lfoG.connect(a.fam.gain);
  a.fg = ac.createGain(); a.fg.gain.value = A.flies;
  a.f1.connect(a.fbp); a.f2.connect(a.fbp); a.fbp.connect(a.fam); a.fam.connect(a.fg); a.fg.connect(G.amb);
  // air: soft breeze that opens up as the district gets clean
  a.air = noiseSource('white');
  a.abp = ac.createBiquadFilter(); a.abp.type = 'bandpass'; a.abp.frequency.value = 1400; a.abp.Q.value = 0.6;
  a.ag = ac.createGain(); a.ag.gain.value = A.air[0];
  a.air.connect(a.abp); a.abp.connect(a.ag); a.ag.connect(G.amb);
  const t = ac.currentTime;
  a.rumble.start(t); a.f1.start(t); a.f2.start(t); a.lfo.start(t); a.air.start(t);
  L.amb = a;
}

function startVac() {
  const v = {};
  v.n = noiseSource('white');
  v.bp = ac.createBiquadFilter(); v.bp.type = 'bandpass'; v.bp.frequency.value = 900; v.bp.Q.value = 0.9;
  v.ng = ac.createGain(); v.ng.gain.value = 0;
  v.m = ac.createOscillator(); v.m.type = 'sawtooth'; v.m.frequency.value = 110;
  v.lp = ac.createBiquadFilter(); v.lp.type = 'lowpass'; v.lp.frequency.value = 1100; v.lp.Q.value = 2;
  v.mg = ac.createGain(); v.mg.gain.value = 0;
  v.n.connect(v.bp); v.bp.connect(v.ng); v.ng.connect(G.sfx);
  v.m.connect(v.lp); v.lp.connect(v.mg); v.mg.connect(G.sfx);
  const t = ac.currentTime; v.n.start(t); v.m.start(t);
  L.vac = v;
}
function stopVac() { const v = L.vac; if (!v) return; const t = ac.currentTime; try { v.n.stop(t + 0.3); v.m.stop(t + 0.3); } catch (e) { /* */ } L.vac = null; for (let i = 10; i < 16; i++) L.lastParams[i] = -1; }
function startBroom() {
  const b = {};
  b.n = noiseSource('white');
  b.bp = ac.createBiquadFilter(); b.bp.type = 'bandpass'; b.bp.frequency.value = 2600; b.bp.Q.value = 1.1;
  b.g = ac.createGain(); b.g.gain.value = 0;
  b.n.connect(b.bp); b.bp.connect(b.g); b.g.connect(G.sfx);
  b.n.start(ac.currentTime);
  L.broom = b;
}
function stopBroom() { const b = L.broom; if (!b) return; try { b.n.stop(ac.currentTime + 0.3); } catch (e) { /* */ } L.broom = null; for (let i = 16; i < 20; i++) L.lastParams[i] = -1; }
function startHum(i) {
  const h = {};
  h.o1 = ac.createOscillator(); h.o1.type = 'triangle'; h.o1.frequency.value = 196 * (1 + 0.045 * i);
  h.o2 = ac.createOscillator(); h.o2.type = 'sawtooth'; h.o2.frequency.value = 196 * (1 + 0.045 * i) * 3.01;
  h.o2g = ac.createGain(); h.o2g.gain.value = 0.18;
  h.lp = ac.createBiquadFilter(); h.lp.type = 'lowpass'; h.lp.frequency.value = 1800;
  h.g = ac.createGain(); h.g.gain.value = 0;
  h.p = ac.createStereoPanner ? ac.createStereoPanner() : null;
  h.o1.connect(h.lp); h.o2.connect(h.o2g); h.o2g.connect(h.lp); h.lp.connect(h.g);
  if (h.p) { h.g.connect(h.p); h.p.connect(G.sfx); } else h.g.connect(G.sfx);
  const t = ac.currentTime; h.o1.start(t); h.o2.start(t);
  L.hum[i] = h;
}

function updateLoops(step) {
  const mods = C.mods || {};
  const p = listener();
  const paused = !!(C.state && C.state.paused);
  const tools = mods.tools, econ = mods.economy, trash = mods.trash;
  // --- vacuum cart: pitch follows speed, brightness follows suction (nozzle down + recent pickups)
  const mounted = !!(p && p.mounted) || L.mounted;
  if (mounted && !paused && en.sound) { if (!L.vac) startVac(); }
  else if (L.vac) stopVac();
  if (L.vac) {
    const sp = p ? Math.min(1, Math.abs(p.speed || 0) / 8) : 0;
    const suck = L.nozzleDown ? 1 : 0;
    setP(10, L.vac.m.frequency, 95 + 150 * sp + 25 * L.vacAct);
    setP(11, L.vac.lp.frequency, 700 + 900 * sp + 400 * suck);
    setP(12, L.vac.bp.frequency, 800 + 900 * sp + 900 * suck + 500 * L.vacAct);
    setP(13, L.vac.ng.gain, A.vacVol * (0.35 + 0.45 * suck + 0.35 * Math.min(1, L.vacAct)));
    setP(14, L.vac.mg.gain, A.vacVol * (0.25 + 0.35 * sp));
  }
  // --- broom: continuous swish texture whose level follows walking speed + amount swept
  const broomOn = tools && tools.current && tools.current() === 'broom' && !mounted && !paused && en.sound;
  if (broomOn) { if (!L.broom) startBroom(); } else if (L.broom) stopBroom();
  if (L.broom) {
    const sp = p ? Math.min(1, Math.abs(p.speed || 0) / 2.4) : 0;
    setP(16, L.broom.g.gain, A.broomVol * (sp > 0.12 ? 0.25 + 0.5 * sp + 0.4 * Math.min(1, L.broomAct) : 0), 0.06);
    setP(17, L.broom.bp.frequency, 1900 + 1400 * sp + 600 * L.broomAct);
  }
  L.vacAct *= Math.pow(0.08, step); L.broomAct *= Math.pow(0.08, step);
  // --- robot hum: distance gain + pan, max 4 voices
  const rs = econ && econ.robots ? econ.robots() : null;
  const maxD = (C.CONFIG && C.CONFIG.feedback && C.CONFIG.feedback.robotHumMaxDistM) || 15;
  for (let i = 0; i < 4; i++) {
    const r = rs && i < rs.length ? rs[i] : null;
    if (r && !L.hum[i]) startHum(i);
    const h = L.hum[i]; if (!h) continue;
    let g = 0, pan = 0;
    if (r && p && !paused && en.sound) {
      const dx = r.x - p.x, dz = r.z - p.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < maxD) { const k = 1 - d / maxD; g = A.humVol * k * k * (r.state === 'clean' ? 1 : 0.6); }
      if (d > 0.5) pan = Math.max(-0.9, Math.min(0.9, (dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw)) / d));
    }
    setP(20 + i * 3, h.g.gain, g, 0.12);
    if (h.p) setP(21 + i * 3, h.p.pan, pan, 0.1);
    setP(22 + i * 3, h.o1.frequency, 196 * (1 + 0.045 * i) * (r && r.state === 'travel' ? 1.12 : 1), 0.2);
  }
  // --- city bed: calmer and cleaner as the district % rises (the reward you hear)
  if (trash && trash.cleanFraction) L.cleanTarget = trash.cleanFraction() || 0;
  L.clean += (L.cleanTarget - L.clean) * Math.min(1, step * 0.5);
  const f = Math.max(0, Math.min(1, L.clean)), a = L.amb;
  if (a) {
    setP(40, a.rg.gain, lerp(A.rumble[0], A.rumble[1], f), 0.8);
    setP(41, a.rlp.frequency, lerp(A.rumbleHz[0], A.rumbleHz[1], f), 0.8);
    setP(42, a.fg.gain, A.flies * Math.max(0, 1 - f / A.fliesGoneAt), 0.8);
    setP(43, a.ag.gain, lerp(A.air[0], A.air[1], f), 0.8);
  }
  if (!paused && en.music && en.sound) {
    L.birdT -= step;
    if (L.birdT <= 0) {
      const rate = lerp(A.birdRate[0], A.birdRate[1], Math.pow(f, 1.3));
      L.birdT = -Math.log(1 - Math.random() * 0.999) / rate;
      const pan = (Math.random() - 0.5) * 1.4, n = 1 + Math.floor(Math.random() * 3), base = (Math.random() - 0.5) * 4;
      for (let i = 0; i < n; i++) voice('chirp', SND.chirp, ac.currentTime + i * 0.13, Math.pow(2, (base + i * 1.5) / 12), SND.chirp.vol * (0.5 + 0.6 * f), pan);
    }
    L.hornT -= step;
    if (L.hornT <= 0) {
      L.hornT = A.hornEveryS * (0.5 + Math.random());
      if (f < A.hornGoneAt && Math.random() < 1 - f / A.hornGoneAt) voice('horn', SND.horn, ac.currentTime, Math.pow(2, (Math.random() - 0.5) * 2 / 12), SND.horn.vol, (Math.random() - 0.5) * 1.6);
    }
  }
}
function lerp(a, b, t) { return a + (b - a) * t; }

// ------------------------------------------------------------------------------------------ synthesis
// Mono Float32Array generators at the context's sample rate. Tones use band-limited wavetables
// (no aliasing, one lookup per sample); noise is a seeded PRNG so every build sounds the same.
let seed = 1;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
const TN = 2048;
let TAB = null;
function tables() {
  if (TAB) return TAB;
  const mk = (h) => { const t = new Float32Array(TN + 1); for (let i = 0; i <= TN; i++) { let v = 0; for (const [n, a] of h) v += a * Math.sin(2 * Math.PI * n * i / TN); t[i] = v; } let m = 0; for (const v of t) m = Math.max(m, Math.abs(v)); for (let i = 0; i <= TN; i++) t[i] /= m; return t; };
  TAB = {
    sin: mk([[1, 1]]),
    tri: mk([[1, 1], [3, -1 / 9], [5, 1 / 25], [7, -1 / 49]]),
    saw: mk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, 1 / n])),
    sq: mk([[1, 1], [3, 1 / 3], [5, 1 / 5], [7, 1 / 7]]),
  };
  return TAB;
}
function look(tab, ph) { const x = (ph - Math.floor(ph)) * TN, i = x | 0, fr = x - i; return tab[i] + (tab[i + 1] - tab[i]) * fr; }
function arr(sec) { return new Float32Array(Math.ceil(sec * SR)); }
function normalize(d, peak) { let m = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > m) m = v; } if (m > 0) { const k = peak / m; for (let i = 0; i < d.length; i++) d[i] *= k; } return d; }
function fadeOut(d, sec) { const n = Math.min(d.length, Math.floor(sec * SR)); for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n; return d; }
// add a note: wavetable tone with attack/decay (exp) envelope
function note(d, tab, f, t0, dur, amp, att, dec) {
  const i0 = Math.floor(t0 * SR), n = Math.min(d.length - i0, Math.floor(dur * SR));
  let ph = 0; const inc = f / SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / att) * Math.exp(-t / dec) * (i > n - 64 ? (n - i) / 64 : 1);
    d[i0 + i] += amp * e * look(tab, ph); ph += inc;
  }
}
// add a bell: inharmonic partials [ratio, amp, decay]
function bell(d, f, t0, amp, parts) {
  const T = tables();
  for (const [r, a, dec] of parts) note(d, T.sin, f * r, t0, Math.min(dec * 6, d.length / SR - t0), amp * a, 0.002, dec);
}
// add filtered noise: band-pass (Chamberlin SVF) with time-varying centre fc(t) and envelope env(t)
function noiseBand(d, t0, dur, fc, q, env) {
  const i0 = Math.floor(t0 * SR), n = Math.min(d.length - i0, Math.floor(dur * SR));
  let low = 0, band = 0; const qq = 1 / q;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 2 * Math.sin(Math.PI * Math.min(fc(t), SR / 6.5) / SR);
    const x = rnd() * 2 - 1;
    low += f * band; const high = x - low - qq * band; band += f * high;
    d[i0 + i] += band * env(t);
  }
}
function sweepTone(d, tab, f0, f1, t0, dur, amp, curve) {
  const i0 = Math.floor(t0 * SR), n = Math.min(d.length - i0, Math.floor(dur * SR));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n, f = f0 * Math.pow(f1 / f0, curve ? Math.pow(k, curve) : k);
    ph += f / SR;
    const e = Math.min(1, i / (0.004 * SR)) * (1 - k) * (1 - k);
    d[i0 + i] += amp * e * look(tab, ph);
  }
}
function arpeggio(d, freqs, t0, gap, amp, lastLen) {
  const T = tables();
  freqs.forEach((f, i) => {
    const last = i === freqs.length - 1;
    note(d, T.tri, f, t0 + i * gap, last ? lastLen : 0.45, amp, 0.004, last ? lastLen * 0.45 : 0.16);
    note(d, T.sin, f * 2, t0 + i * gap, last ? lastLen : 0.3, amp * 0.25, 0.004, last ? 0.3 : 0.09);
  });
}

const GEN = {
  // pickup: a round, short "pop" (pitch-drop sine + 2nd harmonic + tiny click), ~0.13 s
  pop() {
    const d = arr(0.13); let ph = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / SR, f = 560 + 760 * Math.exp(-t / 0.011);
      ph += 2 * Math.PI * f / SR;
      const e = (1 - Math.exp(-t / 0.0015)) * Math.exp(-t / 0.036);
      d[i] = e * (Math.sin(ph) + 0.22 * Math.sin(2 * ph)) + (t < 0.004 ? (rnd() * 2 - 1) * 0.22 * (1 - t / 0.004) : 0);
    }
    return normalize(d, 0.9);
  },
  click() {
    const d = arr(0.045);
    for (let i = 0; i < d.length; i++) { const t = i / SR; d[i] = Math.sin(2 * Math.PI * 1850 * t) * Math.exp(-t / 0.007) + (rnd() * 2 - 1) * 0.3 * Math.exp(-t / 0.0015); }
    return normalize(d, 0.8);
  },
  coin() {
    const T = tables(), d = arr(0.34);
    note(d, T.sq, 1318.5, 0, 0.07, 0.7, 0.001, 0.05);
    note(d, T.sq, 1760, 0.055, 0.28, 0.8, 0.001, 0.09);
    note(d, T.sin, 3520, 0.055, 0.2, 0.15, 0.001, 0.05);
    return normalize(d, 0.85);
  },
  kaching() {
    const d = arr(0.8);
    noiseBand(d, 0, 0.05, () => 3400, 1.5, (t) => Math.exp(-t / 0.012) * 1.4);
    bell(d, 2093, 0.025, 0.7, [[1, 1, 0.22], [1.5, 0.5, 0.16], [2, 0.35, 0.12], [2.76, 0.2, 0.08]]);
    bell(d, 2637, 0.09, 0.55, [[1, 1, 0.25], [1.5, 0.4, 0.16], [2, 0.25, 0.1]]);
    return fadeOut(normalize(d, 0.85), 0.1);
  },
  chime() {
    const d = arr(1.0);
    bell(d, 1760, 0, 0.8, [[1, 1, 0.3], [1.5, 0.5, 0.22], [2, 0.4, 0.16], [3, 0.2, 0.1]]);
    bell(d, 2349, 0.09, 0.7, [[1, 1, 0.35], [1.5, 0.4, 0.2], [2, 0.3, 0.14]]);
    bell(d, 3136, 0.18, 0.5, [[1, 1, 0.3], [2, 0.3, 0.12]]);
    return fadeOut(normalize(d, 0.85), 0.15);
  },
  swish() {
    const dur = 0.3, d = arr(dur);
    noiseBand(d, 0, dur, (t) => 700 + 2600 * Math.pow(Math.sin(Math.PI * t / dur), 1.5), 1.2, (t) => Math.pow(Math.sin(Math.PI * t / dur), 1.2));
    return normalize(d, 0.8);
  },
  thud() {
    const d = arr(0.42); let ph = 0, lp = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / SR, f = 72 + 110 * Math.exp(-t / 0.04);
      ph += 2 * Math.PI * f / SR;
      const e = (1 - Math.exp(-t / 0.002)) * Math.exp(-t / 0.11);
      lp += 0.11 * ((rnd() * 2 - 1) - lp);
      d[i] = e * (Math.sin(ph) + 0.55 * Math.sin(2 * ph) + 0.35 * Math.sin(3 * ph) + 0.15 * Math.sin(5 * ph)) + lp * 1.6 * Math.exp(-t / 0.035);
    }
    return normalize(d, 0.9);
  },
  purchase() {
    const d = arr(1.4);
    noiseBand(d, 0, 0.05, () => 3000, 1.3, (t) => Math.exp(-t / 0.014) * 1.3);
    bell(d, 2093, 0.03, 0.55, [[1, 1, 0.3], [1.5, 0.45, 0.2], [2, 0.3, 0.14]]);
    arpeggio(d, [523.25, 659.25, 783.99, 1046.5], 0.1, 0.075, 0.55, 0.9);
    return fadeOut(normalize(d, 0.88), 0.2);
  },
  ms1() { const d = arr(1.3); arpeggio(d, [392, 493.9, 587.3, 784], 0, 0.085, 0.55, 0.9); shimmer(d, 0.25, 0.8, 0.12); return fadeOut(normalize(d, 0.85), 0.2); },
  ms2() { const d = arr(1.5); arpeggio(d, [440, 554.4, 659.3, 880, 1108.7], 0, 0.08, 0.55, 1.0); chord(d, [440, 554.4, 659.3], 0.4, 1.0, 0.18); shimmer(d, 0.3, 1.0, 0.14); return fadeOut(normalize(d, 0.86), 0.25); },
  ms3() { const d = arr(1.8); arpeggio(d, [493.9, 622.3, 740, 987.8, 1244.5, 1480], 0, 0.075, 0.55, 1.2); chord(d, [493.9, 622.3, 740, 987.8], 0.45, 1.25, 0.2); shimmer(d, 0.3, 1.3, 0.16); return fadeOut(normalize(d, 0.86), 0.3); },
  fanfare() {
    const d = arr(3.0);
    const seq = [[0, 0.28, [261.6, 329.6, 392]], [0.3, 0.28, [349.2, 440, 523.3]], [0.6, 0.28, [392, 493.9, 587.3]], [0.92, 1.9, [523.3, 659.3, 784, 1046.5]]];
    for (const [t0, len, fs] of seq) brass(d, fs, t0, len, 0.3);
    arpeggio(d, [1046.5, 1318.5, 1568, 2093], 0.95, 0.07, 0.25, 1.4);
    shimmer(d, 0.9, 2.0, 0.2);
    for (let k = 0; k < 12; k++) note(d, tables().sin, 2000 + rnd() * 3000, 1.0 + rnd() * 1.4, 0.15, 0.12, 0.002, 0.05);
    return fadeOut(normalize(d, 0.9), 0.4);
  },
  boost() {
    const T = tables(), d = arr(0.8);
    sweepTone(d, T.tri, 380, 1600, 0, 0.7, 0.7, 0.8);
    sweepTone(d, T.sin, 760, 3200, 0.05, 0.65, 0.3, 0.8);
    shimmer(d, 0.1, 0.65, 0.2);
    return normalize(d, 0.85);
  },
  open() { const d = arr(0.14); sweepTone(d, tables().sin, 380, 640, 0, 0.14, 1, 0.6); return normalize(d, 0.8); },
  close() { const d = arr(0.14); sweepTone(d, tables().sin, 620, 380, 0, 0.14, 1, 0.6); return normalize(d, 0.8); },
  equip() {
    const dur = 0.2, d = arr(0.24);
    noiseBand(d, 0, dur, (t) => 1200 + 3000 * t / dur, 1.0, (t) => Math.sin(Math.PI * t / dur) * 0.8);
    note(d, tables().tri, 1046.5, 0.16, 0.08, 0.6, 0.001, 0.03);
    return normalize(d, 0.8);
  },
  nozzleDown() {
    const d = arr(0.5);
    sweepTone(d, tables().sin, 220, 110, 0, 0.16, 1, 1);
    noiseBand(d, 0.05, 0.42, (t) => 700 + 2200 * (t / 0.42), 0.9, (t) => Math.min(1, t / 0.1) * (1 - t / 0.42) * 0.7);
    return normalize(d, 0.85);
  },
  nozzleUp() {
    const d = arr(0.4);
    noiseBand(d, 0, 0.38, (t) => 2600 - 2000 * (t / 0.38), 0.9, (t) => Math.min(1, t / 0.02) * Math.pow(1 - t / 0.38, 1.5));
    note(d, tables().sin, 330, 0, 0.1, 0.6, 0.002, 0.04);
    return normalize(d, 0.8);
  },
  robot() {
    const T = tables(), d = arr(0.3);
    note(d, T.sq, 880, 0, 0.08, 0.6, 0.002, 0.05);
    note(d, T.sq, 1318.5, 0.1, 0.12, 0.6, 0.002, 0.06);
    return normalize(d, 0.75);
  },
  crunch() {
    const d = arr(0.09);
    for (let g = 0; g < 5; g++) { const t0 = rnd() * 0.05; noiseBand(d, t0, 0.03, () => 1800 + rnd() * 2500, 0.8, (t) => Math.exp(-t / 0.005)); }
    return normalize(d, 0.7);
  },
  rev() {
    const T = tables(), d = arr(0.7);
    const n = d.length; let ph = 0, lp = 0;
    for (let i = 0; i < n; i++) { const k = i / n, f = 80 + 110 * Math.sin(Math.PI * Math.min(1, k * 1.4) / 2); ph += f / SR; const x = look(T.saw, ph); lp += 0.18 * (x - lp); d[i] = lp * Math.min(1, k * 20) * (1 - k * 0.7); }
    noiseBand(d, 0.05, 0.6, () => 1500, 0.7, (t) => 0.25 * Math.min(1, t / 0.2));
    return fadeOut(normalize(d, 0.8), 0.12);
  },
  gust() {
    const dur = 3.0, d = arr(dur);
    noiseBand(d, 0, dur, (t) => 300 + 2200 * Math.sin(Math.PI * Math.min(1, t / dur * 1.2)), 0.7, (t) => Math.pow(Math.sin(Math.PI * t / dur), 1.4));
    noiseBand(d, 0.3, 2.4, (t) => 4500 + 1500 * Math.sin(t * 3), 2, (t) => 0.3 * Math.sin(Math.PI * t / 2.4));
    return normalize(d, 0.85);
  },
  horn() {
    const T = tables(), d = arr(1.0);
    let ph1 = 0, ph2 = 0, lp = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / SR, e = Math.min(1, t / 0.03) * (t < 0.2 || (t > 0.35 && t < 0.85) ? 1 : 0.0);
      ph1 += 392 / SR; ph2 += 494 / SR;
      lp += 0.12 * ((look(T.saw, ph1) + look(T.saw, ph2)) * 0.5 - lp);
      d[i] = lp * e;
    }
    // soften gate edges
    let s = 0; for (let i = 0; i < d.length; i++) { s += 0.02 * (d[i] - s); d[i] = s; }
    return fadeOut(normalize(d, 0.8), 0.1);
  },
  chirp() {
    const dur = 0.15, d = arr(dur); let ph = 0; const T = tables();
    for (let i = 0; i < d.length; i++) { const t = i / SR, f = 2900 + 1100 * Math.sin(2 * Math.PI * 22 * t) + 1500 * t / dur; ph += f / SR; d[i] = look(T.sin, ph) * Math.pow(Math.sin(Math.PI * t / dur), 1.5); }
    return normalize(d, 0.8);
  },
};
function chord(d, freqs, t0, len, amp) { const T = tables(); for (const f of freqs) note(d, T.tri, f, t0, len, amp, 0.02, len * 0.6); }
function shimmer(d, t0, len, amp) { noiseBand(d, t0, len, (t) => 6500 + 1500 * Math.sin(t * 9), 3, (t) => amp * Math.sin(Math.PI * t / len)); }
function brass(d, freqs, t0, len, amp) {
  const T = tables();
  const i0 = Math.floor(t0 * SR), n = Math.min(d.length - i0, Math.floor(len * SR));
  for (const f of freqs) {
    let ph = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const e = Math.min(1, t / 0.03) * (t > len - 0.06 ? Math.max(0, (len - t) / 0.06) : 1) * (len > 1 ? Math.exp(-t / (len * 0.8)) : 1);
      const bright = 0.08 + 0.25 * Math.min(1, t / 0.08);
      ph += f / SR; lp += bright * (look(T.saw, ph) - lp);
      d[i0 + i] += amp * e * lp;
    }
  }
}
