// İstanbul Uçuşu - ana döngü, kamera, gösterge (HUD), menü, başlangıç noktaları, duman izi.
import * as THREE from '../vendor/three.module.min.js';
import { PLANES, Aircraft, advance, startTrimmed, quatToEuler, liftCurve, isa, KT, FT, trimLevel } from './fdm.js';
import { World, geo, ungeo, convergence } from './world.js';
import { buildC172, buildJet, buildF16, setCockpit } from './models.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const $ = (s) => document.querySelector(s);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const params = new URLSearchParams(location.search);

// ---------- ayarlar ----------
const SKEY = 'istanbul-ucusu-v1';
const saved = (() => { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } })();
const settings = Object.assign({ plane: 'f16', start: 'pist', wind: 'yok', quality: isTouch ? 'orta' : 'yuksek', autoRudder: true, level: true, tilt: false, invert: false, smoke: false }, saved);
if (!saved.v2) { settings.plane = 'f16'; settings.v2 = true; } // yeni sürümde vurgulanan uçak bir kez seçili gelir
const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { /* özel pencere */ } };
saveSettings();
// grafik kalitesi: piksel oranı, bina ayrıntı uzaklıkları (1/2/4 km düğümler), ağaç uzaklığı, arazi ayrıntı katsayısı
const Q = {
  yuksek: { pr: 2, lod: [2200, 6000, 13000], tree: 2400, K: 1.6, budget: 6, lowTex: false },
  orta: { pr: 1.5, lod: [1200, 3300, 7500], tree: 1300, K: 1.1, budget: 4, lowTex: false },
  dusuk: { pr: 1, lod: [1000, 3000, 6000], tree: 900, K: 0.9, budget: 3, lowTex: true },
};
const QS = Q[settings.quality] || Q.orta;

// ---------- başlangıç noktaları ----------
// pist: havalimanı kodu; hava: enlem, boylam, irtifa (m), baş (°, gerçek), hız (kt; jet için ayrı)
const STARTS = {
  pist: { rw: 'LTBA', name: 'Atatürk Havalimanı, pist 05' },
  hava: { lat: 41.0005, lon: 28.9935, alt: 450, hdg: 22, kt: 100, ktJet: 250, name: 'Kız Kulesi açıkları' },
  yaklasma: { rw: 'LTBA', approach: true, name: 'Pist 05, son yaklaşma' },
  bogaz: { lat: 41.03, lon: 29.012, alt: 650, hdg: 25, kt: 110, ktJet: 380, name: 'Boğaz üzerinde (akrobasi)' },
  isthl: { rw: 'LTFM', name: 'İstanbul Havalimanı' },
  esenboga: { rw: 'LTAC', name: 'Ankara Esenboğa' },
  adnan: { rw: 'LTBJ', name: 'İzmir Adnan Menderes' },
  antalya: { rw: 'LTAI', name: 'Antalya' },
  kapadokyahl: { rw: 'LTAZ', name: 'Kapadokya (Nevşehir)' },
  kayseri: { rw: 'LTAU', name: 'Kayseri Erkilet' },
  trabzon: { rw: 'LTCG', name: 'Trabzon' },
  erzurum: { rw: 'LTCE', name: 'Erzurum' },
  van: { rw: 'LTCI', name: 'Van Ferit Melen' },
  kapadokya: { lat: 38.612, lon: 34.775, alt: 1650, hdg: 40, kt: 100, ktJet: 300, name: 'Kapadokya üzerinde, balonlar' },
  agri: { lat: 39.56, lon: 44.03, alt: 4300, hdg: 50, kt: 110, ktJet: 330, name: 'Ağrı Dağı yakınında' },
  ankara: { lat: 39.905, lon: 32.775, alt: 1250, hdg: 70, kt: 100, ktJet: 300, name: 'Ankara üzerinde, Anıtkabir' },
  izmir: { lat: 38.45, lon: 27.03, alt: 450, hdg: 115, kt: 100, ktJet: 300, name: 'İzmir Körfezi' },
  uludag: { lat: 40.17, lon: 29.0, alt: 1900, hdg: 130, kt: 100, ktJet: 300, name: 'Bursa ve Uludağ' },
};
if (!STARTS[settings.start]) settings.start = 'pist';

// ---------- three.js ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QS.pr));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 1, 400000);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const world = new World(renderer, scene, { lod: QS.lod, treeDist: QS.tree, terrainK: QS.K, terrainBudget: QS.budget, lowTex: QS.lowTex });
const input = new Input();
const sound = new Sound();
input.invert = settings.invert;
if (isTouch) document.body.classList.add('touch');

let ac = null, model = null, running = false, paused = false, loaded = false, preparing = false;
let flapIdx = 0, camMode = 0, crashT = 0;
const camState = { fs: new THREE.Vector3(0, 0, -1), qs: new THREE.Quaternion(), yaw: 0, pitch: 0, dist: 1, lastDrag: -1e9, fly: null };
const fixed = { t: 0 };
let wind = [0, 0, 0], simTime = 0;

// ---------- yükleme ----------
const prog = (p, t) => { $('#loadBar').style.width = Math.round(p * 100) + '%'; $('#loadTxt').textContent = t; };
world.load(prog).then(() => {
  loaded = true; prog(1, 'Hazır');
  $('#bStart').disabled = false; $('#loadBox').classList.add('done');
  window.__ucak.ready = true;
  if (params.has('auto')) startFlight();
}).catch((e) => { console.error(e); $('#loadTxt').textContent = 'Veri yüklenemedi: ' + e.message; });

// ---------- menü ----------
function bindMenu() {
  const sel = (name) => {
    document.querySelectorAll(`[data-set="${name}"]`).forEach((b) => {
      b.classList.toggle('on', String(settings[name]) === b.dataset.val);
      b.onclick = () => { settings[name] = b.dataset.val === 'true' ? true : b.dataset.val === 'false' ? false : b.dataset.val; saveSettings(); sel(name);
        if (name === 'quality') location.reload(); };
    });
  };
  ['plane', 'start', 'wind', 'quality', 'autoRudder', 'level', 'tilt', 'invert'].forEach(sel);
  $('#bStart').onclick = async () => {
    if (settings.tilt && window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) {
      try { await DeviceOrientationEvent.requestPermission(); } catch (e) { /* izin yok */ }
    }
    startFlight();
  };
  $('#bHelp').onclick = () => $('#help').classList.toggle('show');
  $('#helpClose').onclick = () => $('#help').classList.remove('show');
  $('#bResume').onclick = () => setPause(false);
  $('#bMenu').onclick = () => { setPause(false); running = false; $('#menu').classList.remove('hide'); $('#hud').classList.add('hide'); };
  $('#bRetry').onclick = () => resetFlight();
  $('#bigmap').onclick = () => toggleMap(false);
  $('#mini').onclick = () => toggleMap(true);
}
bindMenu();

// başlangıç konumu (mutlak x doğu, y kuzey)
function startPos(key = settings.start) {
  const S = STARTS[key];
  if (S.rw) { const r = world.rws.find((q) => q.code === S.rw) || world.rw; return { x: r.ax + r.ux * r.len / 2, y: r.ay + r.uy * r.len / 2 }; }
  return geo(S.lat, S.lon);
}

async function startFlight() {
  if (!loaded || preparing) return;
  preparing = true;
  $('#bStart').disabled = true; $('#loadBox').classList.remove('done');
  const p = startPos();
  try { await world.prepare(p.x, p.y, prog); } catch (e) { console.warn(e); }
  preparing = false; $('#bStart').disabled = false; $('#loadBox').classList.add('done');
  if (!params.has('auto')) sound.start(settings.plane);
  input.invert = settings.invert;
  input.setTilt(settings.tilt && isTouch);
  if (model) scene.remove(model.root);
  ac = new Aircraft(PLANES[settings.plane]);
  model = settings.plane === 'jet' ? buildJet() : settings.plane === 'f16' ? buildF16(world.envMap()) : buildC172();
  scene.add(model.root);
  $('#gearRow').style.display = $('#vGear').style.display = ac.P.retract ? '' : 'none';
  $('#bGear').style.display = ac.P.retract ? '' : 'none';
  resetFlight();
  $('#menu').classList.add('hide'); $('#hud').classList.remove('hide');
  running = true;
  if (isTouch && document.documentElement.requestFullscreen && !params.has('auto')) document.documentElement.requestFullscreen().catch(() => {});
}

function resetFlight() {
  const P = ac.P;
  const S = STARTS[settings.start];
  ac.reset(); fixed.t = 0; crashT = 0; simTime = 0;
  $('#crash').classList.remove('show');
  smoke.clear();
  let hdg = 0;
  if (S.rw) {
    const rw = world.rws.find((q) => q.code === S.rw) || world.rw;
    hdg = rw.heading;
    if (!S.approach) {
      const along = 70;
      const x = rw.ax + rw.ux * along, y = rw.ay + rw.uy * along;
      const h = rw.elev + 0.12 + P.gear[1].p[2] - 0.06;
      ac.place({ n: y, e: x, alt: h, heading: hdg, pitch: 0 });
      ac.ctl.throttle = 0; input.throttle = 0; flapIdx = 0;
      if (P.kind === 'prop') ac.rpm = 700; else ac.spool = P.idleN;
    } else {
      const d = P.kind === 'jet' ? 7000 : 5000;
      const x = rw.ax - rw.ux * d, y = rw.ay - rw.uy * d;
      const alt = rw.elev + d * Math.tan(3 * D2R) + 15;
      flapIdx = P.flapDetents.length - 1 >= 2 && P.kind === 'prop' ? 2 : P.flapDetents.length > 2 ? 1 : P.flapDetents.length - 1;
      const fl = P.flapDetents[flapIdx] / P.flapDetents[P.flapDetents.length - 1];
      const spd = (P.id === 'f16' ? 150 : P.kind === 'jet' ? 135 : 70) * KT;
      startTrimmed(ac, { n: y, e: x, alt, heading: hdg, speed: spd, flaps: fl });
      ac.ctl.throttle = Math.max(0, ac.ctl.throttle - (P.kind === 'jet' ? 0.08 : 0.15)); input.throttle = ac.ctl.throttle;
      const g = 3 * D2R; ac.vel = [spd * Math.cos(g) * Math.cos(hdg), spd * Math.cos(g) * Math.sin(hdg), spd * Math.sin(g)];
    }
  } else {
    const p = geo(S.lat, S.lon);
    hdg = S.hdg * D2R + convergence(p.x, p.y); // gerçek baştan ızgara başına
    const spd = (P.kind === 'jet' ? S.ktJet : S.kt) * KT;
    const gh = world.terrainH(p.x, p.y);
    startTrimmed(ac, { n: p.y, e: p.x, alt: Math.max(S.alt, gh + 300), heading: hdg, speed: spd, gearUp: P.retract });
    input.throttle = ac.ctl.throttle; flapIdx = 0;
  }
  ac.ctl.flaps = P.flapDetents[flapIdx] / P.flapDetents[P.flapDetents.length - 1]; ac.surf.flap = ac.ctl.flaps;
  world.setOrigin(ac.pos[1], ac.pos[0]);
  camState.fs.set(Math.sin(hdg), 0, -Math.cos(hdg)); camState.yaw = 0; camState.pitch = 0; camState.fly = null;
  camState.qs.copy(planeThree().q);
  if (window.__ucak) window.__ucak.ac = ac;
  updateModel(0);
  updateCamera(0.016, true);
}

function setPause(v) { paused = v; $('#pause').classList.toggle('show', v); }

// ---------- rüzgar ----------
function updateWind(t, agl) {
  const W = { yok: 0, hafif: 8, kuvvetli: 18 }[settings.wind] * KT;
  if (!W) { wind = [0, 0, 0]; return; }
  const from = 40 * D2R;
  const gust = 1 + 0.25 * Math.sin(t * 0.63) + 0.15 * Math.sin(t * 1.71 + 1.3) + 0.1 * Math.sin(t * 3.3 + 0.4);
  const prof = clamp(Math.pow(Math.max(agl, 1) / 40, 0.16), 0.45, 1.1);
  const s = W * gust * prof;
  const turb = (W / (8 * KT)) * 0.5 * (Math.sin(t * 2.1) * Math.sin(t * 0.37 + 2) + 0.5 * Math.sin(t * 5.3 + 1));
  wind = [-s * Math.cos(from), -s * Math.sin(from), turb * clamp(agl / 30, 0, 1)];
}

const env = { ground: (n, e) => world.ground(e, n), get wind() { return wind; } };

// ---------- kamera ----------
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* yapay olay */ } });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  camState.yaw -= (e.clientX - drag.x) * 0.006; camState.pitch = clamp(camState.pitch + (e.clientY - drag.y) * 0.005, -1.2, 1.3);
  drag.x = e.clientX; drag.y = e.clientY; camState.lastDrag = performance.now();
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('wheel', (e) => { camState.dist = clamp(camState.dist * (1 + Math.sign(e.deltaY) * 0.1), 0.4, 4); e.preventDefault(); }, { passive: false });

const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
// NED (mutlak) -> sahne (kayan orijine göre): X = doğu, Y = yukarı, Z = -kuzey
function planeThree() {
  const p = new THREE.Vector3(ac.pos[1] - world.O.x, -ac.pos[2], -(ac.pos[0] - world.O.y));
  const q = new THREE.Quaternion(ac.q[2], -ac.q[3], -ac.q[1], ac.q[0]);
  return { p, q };
}
// kayan orijin: kamera 3 km uzaklaşınca kök kaydırılır; sahnedeki serbest nesneler de kaydırılır
function rebase() {
  const cx = camera.position.x, cz = camera.position.z;
  if (Math.hypot(cx, cz) < 3000) return;
  const dx = cx, dy = -cz;
  world.setOrigin(world.O.x + dx, world.O.y + dy);
  const d = new THREE.Vector3(-dx, 0, dy);
  camera.position.add(d);
  smoke.shift(d);
  for (const s of puffs) s.m.position.add(d);
  world.sky.position.copy(camera.position);
  updateModel(0);
}
function updateModel(dt) {
  const { p, q } = planeThree();
  model.root.position.copy(p); model.root.quaternion.copy(q);
  setCockpit(model, camMode === 1);
  model.update(ac, dt);
}
function updateCamera(dt, snap = false) {
  const { p, q } = planeThree();
  const idle = performance.now() - camState.lastDrag > 3000;
  if (idle && !drag) { camState.yaw *= Math.exp(-dt * 1.5); camState.pitch *= Math.exp(-dt * 1.5); }
  if (camMode === 1) {
    const e = ac.P.eye;
    tmpV.set(e[1], -e[2], -e[0]).applyQuaternion(q).add(p);
    camera.position.copy(tmpV);
    tmpQ.setFromEuler(new THREE.Euler(-camState.pitch * 0.8, camState.yaw, 0, 'YXZ'));
    camera.quaternion.copy(q).multiply(tmpQ);
    camera.near = 0.15; camera.fov = 70;
  } else if (camMode === 0) {
    // takip kamerası: uçağın yönelimini yumuşakça izler. Dik uçarken ya da ters dönünce takla atmaz:
    // kameranın yukarısı, uçağın yukarısıyla dünyanın yukarısının karışımıdır (uçak ters ise uçağınki).
    const k = snap ? 1 : 1 - Math.exp(-dt * (ac.P.fbw ? 4.5 : 3.5));
    camState.qs.slerp(q, k);
    const fs = new THREE.Vector3(0, 0, -1).applyQuaternion(camState.qs);
    const v = new THREE.Vector3(ac.vel[1], -ac.vel[2], -ac.vel[0]);
    if (v.length() > 15 && !ac.onGround) fs.lerp(v.normalize(), 0.25).normalize();
    const us = new THREE.Vector3(0, 1, 0).applyQuaternion(camState.qs);
    const upC = us.clone().addScaledVector(up, 1.6 * Math.max(0, us.y)).normalize();
    // kamera yukarısını ileri yöne dik yap
    upC.addScaledVector(fs, -upC.dot(fs)).normalize();
    const dist = ac.P.camDist * camState.dist;
    const back = fs.clone().negate();
    back.applyAxisAngle(upC, camState.yaw);
    const side = new THREE.Vector3().crossVectors(back, upC).normalize();
    back.applyAxisAngle(side, -camState.pitch);
    const pos = p.clone().addScaledVector(back, dist).addScaledVector(upC, ac.P.camUp * camState.dist);
    const gh = world.ground(pos.x + world.O.x, -pos.z + world.O.y).h;
    if (pos.y < gh + 1.5) pos.y = gh + 1.5;
    camera.position.copy(pos);
    camera.up.copy(upC);
    camera.lookAt(tmpV.copy(p).addScaledVector(upC, 1.2));
    camera.near = 1; camera.fov = 60;
  } else {
    // geçiş kamerası: uçağın önüne yerleşir (konum mutlak tutulur)
    const v = new THREE.Vector3(ac.vel[1], -ac.vel[2], -ac.vel[0]);
    const flyL = camState.fly ? new THREE.Vector3(camState.fly.x - world.O.x, camState.fly.y, -(camState.fly.z - world.O.y)) : null;
    if (!flyL || flyL.distanceTo(p) > 900 || snap) {
      const dir = v.length() > 5 ? v.clone().normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      const side = new THREE.Vector3().crossVectors(dir, up).normalize();
      const f = p.clone().addScaledVector(dir, Math.max(60, v.length() * 9)).addScaledVector(side, 30 + Math.random() * 30).addScaledVector(up, 6);
      const gh = world.terrainH(f.x + world.O.x, -f.z + world.O.y); f.y = Math.max(f.y, gh + 3);
      camState.fly = { x: f.x + world.O.x, y: f.y, z: -f.z + world.O.y };
    }
    camera.position.set(camState.fly.x - world.O.x, camState.fly.y, -(camState.fly.z - world.O.y)); camera.up.copy(up); camera.lookAt(p);
    camera.near = 1; camera.fov = clamp(40 * 200 / Math.max(50, camera.position.distanceTo(p)), 8, 60);
  }
  // yükseklere çıkınca yakın düzlem açılır (uzak dağlarda derinlik titremesi azalır)
  if (camMode !== 1) camera.near = clamp((camera.position.y - Math.max(0, world.terrainH(camera.position.x + world.O.x, -camera.position.z + world.O.y))) * 0.004, 0.8, 6);
  camera.updateProjectionMatrix();
  world.sky.position.copy(camera.position);
}

// ---------- duman izi (akrobasi) ----------
// örneklenmiş yüzen kareler; her duman topu yaşla büyür, saydamlaşır. Konumlar sahne koordinatında, orijin kayınca kaydırılır.
const smoke = (() => {
  const MAX = 2400;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(MAX * 3), born = new Float32Array(MAX).fill(-1e9), seed = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) seed[i] = Math.random();
  const aOff = new THREE.InstancedBufferAttribute(off, 3), aBorn = new THREE.InstancedBufferAttribute(born, 1), aSeed = new THREE.InstancedBufferAttribute(seed, 1);
  aOff.setUsage(THREE.DynamicDrawUsage); aBorn.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('offset', aOff); g.setAttribute('born', aBorn); g.setAttribute('seed', aSeed);
  g.instanceCount = MAX;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, life: { value: 45 } }]),
    vertexShader: `attribute vec3 offset; attribute float born; attribute float seed; uniform float t, life; varying vec2 vu; varying float va;
      #include <fog_pars_vertex>
      void main(){ float age = t - born; va = age < 0.0 || age > life ? 0.0 : (1.0 - age / life) * smoothstep(0.0, 0.3, age);
        float sz = 1.2 + 5.5 * sqrt(age) + seed * 1.5;
        vec4 mvPosition = modelViewMatrix * vec4(offset + vec3(0.0, age * 0.15, 0.0), 1.0);
        float a = seed * 6.28; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
        mvPosition.xy += R * position.xy * sz; vu = position.xy; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `varying vec2 vu; varying float va;
      #include <fog_pars_fragment>
      void main(){ float r = length(vu); if (r > 1.0 || va <= 0.0) discard; float a = (1.0 - r * r) * va * 0.55;
        gl_FragColor = vec4(vec3(0.97), a);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
  scene.add(mesh);
  let head = 0, acc = 0, time = 0;
  return {
    on: false,
    emit(pos, dt) {
      acc += dt;
      while (acc > 0.035) {
        acc -= 0.035;
        off[head * 3] = pos.x + (Math.random() - 0.5) * 0.6; off[head * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.6; off[head * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.6;
        born[head] = time;
        head = (head + 1) % MAX;
      }
      aOff.needsUpdate = true; aBorn.needsUpdate = true;
    },
    tick(dt) { time += dt; mat.uniforms.t.value = time; },
    shift(d) { for (let i = 0; i < MAX; i++) { off[i * 3] += d.x; off[i * 3 + 2] += d.z; } aOff.needsUpdate = true; },
    clear() { born.fill(-1e9); aBorn.needsUpdate = true; },
  };
})();
smoke.on = !!settings.smoke;

// ---------- gösterge ----------
const hud = {
  spd: $('#vSpd'), gs: $('#vGs'), alt: $('#vAlt'), altft: $('#vAltFt'), agl: $('#vAgl'), vs: $('#vVs'), hdg: $('#vHdg'),
  thr: $('#vThr'), thrBar: $('#thrBar'), rpm: $('#vRpm'), rpmL: $('#lRpm'), flap: $('#vFlap'), trim: $('#vTrim'), gear: $('#vGear'), brake: $('#vBrake'),
  ti: $('#touchInfo'), aoa: $('#aoaFill'), aoaV: $('#vAoa'), stall: $('#stall'), g: $('#vG'), near: $('#near'), msg: $('#msg'),
};
const mini = $('#mini'), mctx = mini.getContext('2d');
const att = $('#att'), actx = att.getContext('2d');
let hudT = 0;
function setT(el, s) { if (el._t !== s) { el._t = s; el.textContent = s; } }
function drawHUD(dt) {
  const o = ac.out, P = ac.P, e = quatToEuler(ac.q);
  const sig = isa(ac.alt).sigma;
  const ias = o.V * Math.sqrt(sig) / KT;
  const gs = Math.hypot(ac.vel[0], ac.vel[1]) / KT;
  const vs = -ac.vel[2];
  const as = P.fbw ? P.fbw.aMax + 4 * D2R : liftCurve(P, 0, ac.surf.flap).as;
  const airborne = !ac.onGround;
  const warn = airborne && !ac.crashed && (P.fbw ? (o.alpha > P.fbw.aMax + 4 * D2R || ac.stallS > 0.02) : (o.alpha > as - 2.5 * D2R || ac.stallS > 0.02)) && o.V > 5;
  const conv = convergence(ac.pos[1], ac.pos[0]);
  hudT += dt;
  if (hudT > 0.06) {
    hudT = 0;
    setT(hud.spd, Math.round(ias).toString());
    setT(hud.gs, 'YH ' + Math.round(gs) + ' kt' + (o.M > 0.6 ? '  M' + o.M.toFixed(2) : ''));
    setT(hud.alt, Math.round(ac.alt).toString());
    setT(hud.altft, Math.round(ac.alt / FT) + ' ft');
    setT(hud.agl, 'Yerden ' + Math.max(0, Math.round(o.agl - (P.gear[1].p[2]))) + ' m');
    setT(hud.vs, (vs >= 0 ? '+' : '') + Math.round(vs / FT * 60) + ' ft/dk');
    let h = Math.round((((e.psi - conv) * R2D) % 360 + 360) % 360); if (h === 0) h = 360;
    setT(hud.hdg, String(h).padStart(3, '0') + '°');
    setT(hud.thr, Math.round(ac.ctl.throttle * 100) + '%' + (ac.ab > 0.1 ? ' AY' : ''));
    hud.thrBar.style.width = (ac.ctl.throttle * 100) + '%';
    setT(hud.rpmL, P.kind === 'prop' ? 'DEVİR' : 'N1');
    setT(hud.rpm, P.kind === 'prop' ? Math.round(ac.rpm / 10) * 10 + '' : Math.round(ac.spool * 100) + '%');
    setT(hud.flap, P.flapDetents[flapIdx] + '°');
    setT(hud.trim, (ac.ctl.trim >= 0 ? '+' : '') + Math.round(ac.ctl.trim * 100));
    setT(hud.gear, ac.gearPos > 0.98 ? 'AÇIK' : ac.gearPos < 0.02 ? 'KAPALI' : 'HAREKETTE');
    setT(hud.brake, ac.ctl.brake ? 'FREN' : '');
    setT(hud.aoaV, (o.alpha * R2D).toFixed(1) + '°');
    hud.aoa.style.height = clamp((o.alpha * R2D + 5) / (as * R2D + 10) * 100, 0, 100) + '%';
    hud.aoa.classList.toggle('red', warn);
    setT(hud.g, ac.nz.toFixed(1) + ' g');
    if (isTouch) setT(hud.ti, 'GAZ ' + Math.round(ac.ctl.throttle * 100) + '%' + (ac.ab > 0.1 ? ' ARD YAKICI' : '') + '  ' + (P.kind === 'prop' ? Math.round(ac.rpm / 10) * 10 + ' rpm' : 'N1 ' + Math.round(ac.spool * 100) + '%') + '\nFLAP ' + P.flapDetents[flapIdx] + '°' + (P.fbw ? '' : '  TRİM ' + Math.round(ac.ctl.trim * 100)) + (P.retract ? '  TAKIM ' + (ac.gearPos > 0.98 ? 'AÇIK' : ac.gearPos < 0.02 ? 'KAPALI' : '...') : '') + (ac.ctl.brake ? '  FREN' : ''));
    const nl = world.nearestLandmark(ac.pos[1], ac.pos[0]);
    setT(hud.near, nl ? nl.name + ' · ' + (nl.dist < 1000 ? Math.round(nl.dist) + ' m' : (nl.dist / 1000).toFixed(1) + ' km') : '');
    let m = '';
    if (o.V > P.Vne * 0.95 && airborne) m = 'AZAMİ HIZ';
    else if (ac.nz > P.nMax) m = 'YÜK SINIRI AŞILDI';
    else if (STARTS[settings.start].rw && !STARTS[settings.start].approach && ac.onGround && ac.ctl.throttle < 0.05 && simTime < 8) m = P.fbw ? 'Tam gaz verin (ard yakıcı), 150 kt civarında levyeyi çekin' : 'Gazı açın (Shift / +), 55 kt civarında levyeyi çekin';
    setT(hud.msg, m);
    drawMini(e.psi);
    if (mapOpen) drawBigMap();
  }
  hud.stall.classList.toggle('show', warn);
  drawAtt(e);
  return warn;
}
function drawMini(psi) {
  const W = mini.width, H = mini.height;
  const x = ac.pos[1], y = ac.pos[0];
  mctx.fillStyle = '#2f6a8e'; mctx.fillRect(0, 0, W, H);
  const inIst = x > world.X0 + 3000 && x < world.X1 - 3000 && y > world.Y0 + 3000 && y < world.Y1 - 3000;
  const span = inIst ? 12000 : 60000;
  if (inIst) {
    const img = world.minimap;
    const sx = img.width / (world.X1 - world.X0), sy = img.height / (world.Y1 - world.Y0);
    const cx = (x - world.X0) * sx, cy = (world.Y1 - y) * sy, half = span / 2 * sx;
    mctx.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, W, H);
  } else {
    const hm = world.idx.harita, img = world.trmap;
    const sx = img.width / hm.w, cx = (x - hm.x0) * sx, cy = (hm.y0 + hm.h - y) * sx, half = span / 2 * sx;
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, W, H);
  }
  const k = W / span;
  const tp = (px, py) => [W / 2 + (px - x) * k, H / 2 - (py - y) * k];
  mctx.strokeStyle = '#222'; mctx.lineWidth = 3;
  for (const rw of world.rws) { const a = tp(rw.ax, rw.ay), b = tp(rw.ax + rw.ux * rw.len, rw.ay + rw.uy * rw.len); if (Math.abs(a[0] - W / 2) < W && Math.abs(a[1] - H / 2) < H) { mctx.beginPath(); mctx.moveTo(...a); mctx.lineTo(...b); mctx.stroke(); } }
  mctx.fillStyle = '#b3262e';
  for (const l of world.landmarkPos) { const [u, v] = tp(l.x, l.y); if (u > 0 && v > 0 && u < W && v < H) mctx.fillRect(u - 1.5, v - 1.5, 3, 3); }
  if (!inIst) {
    mctx.font = 'bold 10px system-ui,sans-serif'; mctx.fillStyle = '#fff'; mctx.strokeStyle = 'rgba(0,0,0,.6)'; mctx.lineWidth = 3;
    for (const c of world.cities) { const [u, v] = tp(c.x, c.y); if (u > 4 && v > 10 && u < W - 4 && v < H - 4) { mctx.strokeText(c.ad, u + 4, v + 3); mctx.fillText(c.ad, u + 4, v + 3); mctx.fillRect(u - 2, v - 2, 4, 4); } }
  }
  mctx.save(); mctx.translate(W / 2, H / 2); mctx.rotate(psi);
  mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.lineWidth = 1;
  mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(5, 6); mctx.lineTo(0, 3); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
  mctx.fillStyle = 'rgba(255,255,255,.85)'; mctx.font = 'bold 11px system-ui,sans-serif'; mctx.fillText('K', W / 2 - 3, 12);
}
// büyük Türkiye haritası (N / HARİTA)
let mapOpen = false;
const big = $('#bigmap'), bctx = big.getContext('2d');
function toggleMap(v = !mapOpen) { mapOpen = v; big.classList.toggle('show', v); if (v) drawBigMap(); }
function drawBigMap() {
  const hm = world.idx.harita, img = world.trmap;
  const r = big.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio);
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (big.width !== W || big.height !== H) { big.width = W; big.height = H; }
  // Türkiye'yi sığdır: x -350..1350 km, y -620..+180 km
  const X0 = -330000, X1 = 1330000, Y0 = -600000, Y1 = 190000;
  const s = Math.min(W / (X1 - X0), H / (Y1 - Y0));
  const ox = (W - (X1 - X0) * s) / 2, oy = (H - (Y1 - Y0) * s) / 2;
  const tp = (x, y) => [ox + (x - X0) * s, oy + (Y1 - y) * s];
  bctx.fillStyle = '#2f5f80'; bctx.fillRect(0, 0, W, H);
  const [ix, iy] = tp(hm.x0, hm.y0 + hm.h);
  bctx.drawImage(img, ix, iy, hm.w * s, hm.h * s);
  bctx.font = `${Math.round(11 * dpr)}px system-ui,sans-serif`; bctx.lineWidth = 3 * dpr; bctx.strokeStyle = 'rgba(0,0,0,.55)';
  for (const c of world.cities.slice(0, 40)) { const [u, v] = tp(c.x, c.y); bctx.fillStyle = '#fff'; bctx.fillRect(u - 2 * dpr, v - 2 * dpr, 4 * dpr, 4 * dpr); if (c.nufus > 250000) { bctx.strokeText(c.ad, u + 5 * dpr, v + 4 * dpr); bctx.fillText(c.ad, u + 5 * dpr, v + 4 * dpr); } }
  bctx.strokeStyle = '#ffcf33'; bctx.lineWidth = 3 * dpr;
  for (const a of world.rws) { const p1 = tp(a.ax, a.ay), p2 = tp(a.ax + a.ux * a.len, a.ay + a.uy * a.len); bctx.beginPath(); bctx.moveTo(...p1); bctx.lineTo(p2[0] + (p2[0] - p1[0]) * 3, p2[1] + (p2[1] - p1[1]) * 3); bctx.stroke(); }
  for (const p of world.peaks.slice(0, 10)) { const [u, v] = tp(p.x, p.y); bctx.fillStyle = '#fff'; bctx.beginPath(); bctx.moveTo(u, v - 5 * dpr); bctx.lineTo(u + 4 * dpr, v + 3 * dpr); bctx.lineTo(u - 4 * dpr, v + 3 * dpr); bctx.fill(); }
  if (ac) {
    const [u, v] = tp(ac.pos[1], ac.pos[0]); const psi = quatToEuler(ac.q).psi;
    bctx.save(); bctx.translate(u, v); bctx.rotate(psi); bctx.scale(dpr * 1.6, dpr * 1.6);
    bctx.fillStyle = '#ff4d4d'; bctx.strokeStyle = '#fff'; bctx.lineWidth = 1.5;
    bctx.beginPath(); bctx.moveTo(0, -9); bctx.lineTo(6, 7); bctx.lineTo(0, 3); bctx.lineTo(-6, 7); bctx.closePath(); bctx.fill(); bctx.stroke(); bctx.restore();
  }
  bctx.fillStyle = 'rgba(255,255,255,.9)'; bctx.font = `bold ${Math.round(13 * dpr)}px system-ui,sans-serif`;
  bctx.fillText('Türkiye · kapatmak için N ya da dokunun', 12 * dpr, 20 * dpr);
}
function drawAtt(e) {
  const W = att.width, H = att.height, r = W / 2 - 2;
  actx.save(); actx.clearRect(0, 0, W, H);
  actx.beginPath(); actx.arc(W / 2, H / 2, r, 0, Math.PI * 2); actx.clip();
  actx.translate(W / 2, H / 2); actx.rotate(-e.phi);
  const off = e.theta * R2D * (r / 30);
  actx.fillStyle = '#3d86c6'; actx.fillRect(-W, -W * 2 + off, W * 2, W * 2);
  actx.fillStyle = '#8a5a34'; actx.fillRect(-W, off, W * 2, W * 2);
  actx.strokeStyle = '#fff'; actx.lineWidth = 1.5;
  actx.beginPath(); actx.moveTo(-W, off); actx.lineTo(W, off); actx.stroke();
  actx.lineWidth = 1;
  for (const d of [-20, -10, 10, 20]) { const y = off - d * (r / 30); actx.beginPath(); actx.moveTo(-12, y); actx.lineTo(12, y); actx.stroke(); }
  actx.restore();
  actx.strokeStyle = '#ffcf33'; actx.lineWidth = 3;
  actx.beginPath(); actx.moveTo(W / 2 - 26, H / 2); actx.lineTo(W / 2 - 8, H / 2); actx.lineTo(W / 2, H / 2 + 6); actx.lineTo(W / 2 + 8, H / 2); actx.lineTo(W / 2 + 26, H / 2); actx.stroke();
  actx.strokeStyle = 'rgba(255,255,255,.6)'; actx.lineWidth = 2; actx.beginPath(); actx.arc(W / 2, H / 2, r, 0, Math.PI * 2); actx.stroke();
}

// ---------- duman (kaza) ----------
const puffs = [];
function puff(p) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ color: 0x333333, transparent: true, opacity: 0.7, depthWrite: false }));
  m.position.copy(p); scene.add(m); puffs.push({ m, t: 0 });
}

// ---------- döngü ----------
let last = performance.now();
let fpsT = 0, fpsN = 0, fps = 60;
const tailV = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  fpsT += dt; fpsN++; if (fpsT > 1) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (window.__ucak) window.__ucak.fps = fps; }
  if (!loaded) { renderer.render(scene, camera); return; }
  if (running && ac) {
    input.update(dt); input.touchFrame();
    for (const ev of input.take()) handle(ev);
    if (!paused && !ac.crashed) {
      const P = ac.P;
      ac.ctl.pitch = input.pitch; ac.ctl.roll = input.roll;
      let yaw = input.yaw;
      ac.ctl.autoSteer = 0;
      if (settings.autoRudder || isTouch) {
        if (!ac.onGround) { if (!P.fbw) yaw = clamp(yaw + clamp(5 * ac.out.beta, -0.7, 0.7), -1, 1); }
        else ac.ctl.autoSteer = input.roll * 0.8;
      }
      // kanat dengeleyici: levye ortadayken uçak yatışını sıfırlar (dik uçuşta ve çok yatıkken karışmaz: akrobasi serbest)
      if (settings.level && !ac.onGround && Math.abs(input.roll) < 0.08 && !(ac.out.alpha > 0.22)) {
        const eu = quatToEuler(ac.q);
        if (Math.abs(eu.phi) < 1.2 && Math.abs(eu.theta) < 1.0) ac.ctl.roll = clamp(-3 * eu.phi - 0.4 * ac.w[0], -0.5, 0.5);
      }
      ac.ctl.yaw = yaw;
      ac.ctl.throttle = input.throttle;
      ac.ctl.brake = input.brake;
      ac.ctl.flaps = P.flapDetents[flapIdx] / P.flapDetents[P.flapDetents.length - 1];
      world.acAlt = ac.alt;
      updateWind(simTime, ac.out.agl || 100);
      advance(ac, env, dt, fixed);
      simTime += dt;
      if (!ac.crashed) {
        const m = ac.m, pts = ac.P.hard.map((b) => b.p).concat([[0, 0, 0]]);
        const W = pts.map((bp) => {
          const r = [m[0] * bp[0] + m[1] * bp[1] + m[2] * bp[2], m[3] * bp[0] + m[4] * bp[1] + m[5] * bp[2], m[6] * bp[0] + m[7] * bp[1] + m[8] * bp[2]];
          return { x: ac.pos[1] + r[1], y: ac.pos[0] + r[0], h: -(ac.pos[2] + r[2]) };
        });
        const hit = world.collide(W);
        if (hit) ac.crash(hit);
      }
      if (ac.crashed && !crashT) {
        crashT = 1; sound.crash();
        $('#crashWhy').textContent = ac.crashed; $('#crash').classList.add('show');
        const { p } = planeThree(); for (let i = 0; i < 8; i++) puff(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 3, (Math.random() - 0.5) * 6)));
      }
    }
    updateModel(paused || ac.crashed ? 0 : dt);
    updateCamera(dt);
    rebase();
    // duman: kuyruktan (lülenin arkası)
    if (smoke.on && !paused && !ac.crashed && !ac.onGround) {
      const tz = ac.P.id === 'f16' ? 7.4 : ac.P.id === 'jet' ? 6.3 : 5.8;
      tailV.set(0, 0, tz).applyQuaternion(model.root.quaternion).add(model.root.position);
      smoke.emit(tailV, dt);
    }
    const warn = drawHUD(dt);
    sound.update(ac, warn, paused);
  }
  smoke.tick(paused ? 0 : dt);
  for (let i = puffs.length - 1; i >= 0; i--) {
    const s = puffs[i]; s.t += dt; s.m.position.y += dt * 3; s.m.scale.setScalar(2 + s.t * 4); s.m.material.opacity = Math.max(0, 0.7 - s.t * 0.12);
    if (s.t > 6) { scene.remove(s.m); puffs.splice(i, 1); }
  }
  world.waterNormal.offset.x += 0; // dalgalar world.update içinde
  if (world.balloons) for (const b of world.balloons) { b.g.position.y = b.h + Math.sin(now / 1000 * 0.2 + b.ph) * 15; }
  world.update(camera.position, ac ? { x: ac.pos[1], y: ac.pos[0] } : null);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

function handle(ev) {
  const P = ac.P;
  if (ev === 'pause') { if (running) setPause(!paused); return; }
  if (ev === 'reset') { resetFlight(); return; }
  if (ev === 'help') { $('#help').classList.toggle('show'); return; }
  if (ev === 'mute') { sound.muted = !sound.muted; return; }
  if (ev === 'map') { toggleMap(); return; }
  if (ev === 'smoke') { smoke.on = !smoke.on; settings.smoke = smoke.on; saveSettings(); $('#bSmoke').classList.toggle('on', smoke.on); return; }
  if (ev === 'camera') { camMode = (camMode + 1) % 3; camState.fly = null; $('#camName').textContent = ['Takip', 'Kokpit', 'Geçiş'][camMode]; updateCamera(0.016, true); return; }
  if (ac.crashed) return;
  if (ev === 'flapDown') flapIdx = Math.min(P.flapDetents.length - 1, flapIdx + 1);
  if (ev === 'flapUp') flapIdx = Math.max(0, flapIdx - 1);
  if (ev === 'gear' && P.retract) { if (ac.onGround && ac.ctl.gearDown) return; ac.ctl.gearDown = !ac.ctl.gearDown; }
  if (ev === 'trimUp') ac.ctl.trim = clamp(ac.ctl.trim + 0.004, -1, 1);
  if (ev === 'trimDown') ac.ctl.trim = clamp(ac.ctl.trim - 0.004, -1, 1);
  if (ev === 'autotrim') ac.ctl.trim = clamp(ac.ctl.trim + input.pitch, -1, 1);
  if (ev === 'engine') ac.engineOn = !ac.engineOn;
}

input.bindTouch($('#touch'));
$('#bSmoke').classList.toggle('on', smoke.on);
function orient() { document.body.classList.toggle('portrait', isTouch && innerHeight > innerWidth); }
addEventListener('resize', orient); orient();

// test kancası
window.__ucak = {
  ac: null, world, input, settings, start: startFlight, reset: resetFlight, camera, scene, renderer, ready: false, fps: 0, THREE, startTrimmed, trimLevel, geo, ungeo, KT, STARTS,
  setCam: (m) => { camMode = m; camState.fly = null; $('#camName').textContent = ['Takip', 'Kokpit', 'Geçiş'][m]; },
  setFlap: (i) => (flapIdx = i),
  orbit: (y, p, d = 1) => { camState.yaw = y; camState.pitch = p; camState.dist = d; camState.lastDrag = performance.now() + 1e7; },
  // enlem, boylam, irtifa (m), gerçek baş (°), hız (kt)
  place: (lat, lon, alt, hdg, kt, gearUp = true) => { const p = geo(lat, lon); startTrimmed(ac, { n: p.y, e: p.x, alt, heading: hdg * D2R + convergence(p.x, p.y), speed: kt * KT, gearUp: gearUp && ac.P.retract }); input.throttle = ac.ctl.throttle; flapIdx = 0; crashT = 0; smoke.clear(); ac.out.V = kt * KT; ac.out.agl = alt - world.terrainH(p.x, p.y); $('#crash').classList.remove('show'); world.setOrigin(p.x, p.y); camState.qs.copy(planeThree().q); updateCamera(0.016, true); },
  prepare: (lat, lon) => { const p = geo(lat, lon); return world.prepare(p.x, p.y); },
  smoke: (v) => { smoke.on = v; },
  freeze: (v) => { paused = v; },
  event: (e) => handle(e),
  map: (v) => toggleMap(v),
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, terrainNodes: world.terrain.drawn, bNodes: world.buildings.stats.nodes, bTris: world.buildings.stats.tris, pending: world.pendingNear() + (world.buildings.pending || 0), fps }),
  get camMode() { return camMode; },
};
