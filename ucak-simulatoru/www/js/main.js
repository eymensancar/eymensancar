// İstanbul Uçuşu - ana döngü, kamera, gösterge (HUD), menü.
import * as THREE from '../vendor/three.module.min.js';
import { PLANES, Aircraft, advance, startTrimmed, quatToEuler, liftCurve, isa, KT, FT, trimLevel } from './fdm.js';
import { World, geo } from './world.js';
import { buildC172, buildJet, setCockpit } from './models.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const $ = (s) => document.querySelector(s);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const params = new URLSearchParams(location.search);

// ---------- ayarlar ----------
const SKEY = 'istanbul-ucusu-v1';
const settings = Object.assign({ plane: 'c172', start: 'pist', wind: 'yok', quality: isTouch ? 'orta' : 'yuksek', autoRudder: true, tilt: false, invert: false }, (() => { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } })());
const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { /* özel pencere */ } };
const Q = { yuksek: { pr: 2, dist: 9000, lowTex: false }, orta: { pr: 1.5, dist: 6500, lowTex: false }, dusuk: { pr: 1, dist: 4000, lowTex: true } };

// ---------- three.js ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q[settings.quality].pr));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 1, 60000);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const world = new World(renderer, scene, { buildDist: Q[settings.quality].dist, lowTex: Q[settings.quality].lowTex });
const input = new Input();
const sound = new Sound();
input.invert = settings.invert;
if (isTouch) document.body.classList.add('touch');

let ac = null, model = null, running = false, paused = false, loaded = false;
let flapIdx = 0, camMode = 0, crashT = 0;
const camState = { fs: new THREE.Vector3(0, 0, -1), yaw: 0, pitch: 0, dist: 1, lastDrag: -1e9, fly: null };
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
  ['plane', 'start', 'wind', 'quality', 'autoRudder', 'tilt', 'invert'].forEach(sel);
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
}
bindMenu();

function startFlight() {
  if (!loaded) return;
  if (!params.has('auto')) sound.start(settings.plane);
  input.invert = settings.invert;
  input.setTilt(settings.tilt && isTouch);
  if (model) scene.remove(model.root);
  ac = new Aircraft(PLANES[settings.plane]);
  model = settings.plane === 'jet' ? buildJet() : buildC172();
  scene.add(model.root);
  $('#gearRow').style.display = $('#vGear').style.display = ac.P.retract ? '' : 'none';
  $('#bGear').style.display = ac.P.retract ? '' : 'none';
  resetFlight();
  $('#menu').classList.add('hide'); $('#hud').classList.remove('hide');
  running = true;
  if (isTouch && document.documentElement.requestFullscreen && !params.has('auto')) document.documentElement.requestFullscreen().catch(() => {});
}

function resetFlight() {
  const P = ac.P, rw = world.rw;
  ac.reset(); fixed.t = 0; crashT = 0; simTime = 0;
  $('#crash').classList.remove('show');
  const hdg = rw.heading;
  if (settings.start === 'pist') {
    const along = 70;
    const x = rw.ax + rw.ux * along, y = rw.ay + rw.uy * along;
    const h = rw.elev + 0.12 + P.gear[1].p[2] - 0.06;
    ac.place({ n: y, e: x, alt: h, heading: hdg, pitch: 0 });
    ac.ctl.throttle = 0; input.throttle = 0; flapIdx = 0;
    if (P.kind === 'prop') ac.rpm = 700; else ac.spool = P.idleN;
  } else if (settings.start === 'hava') {
    const p = geo(41.0005, 28.9935);
    const spd = (P.kind === 'jet' ? 250 : 100) * KT;
    const t = startTrimmed(ac, { n: p.y, e: p.x, alt: 450, heading: 22 * D2R, speed: spd, gearUp: P.retract });
    input.throttle = ac.ctl.throttle; flapIdx = 0;
  } else {
    const d = P.kind === 'jet' ? 7000 : 5000;
    const x = rw.ax - rw.ux * d, y = rw.ay - rw.uy * d;
    const alt = rw.elev + d * Math.tan(3 * D2R) + 15;
    flapIdx = P.kind === 'jet' ? 1 : 2;
    const fl = P.flapDetents[flapIdx] / P.flapDetents[P.flapDetents.length - 1];
    const spd = (P.kind === 'jet' ? 135 : 70) * KT;
    startTrimmed(ac, { n: y, e: x, alt, heading: hdg, speed: spd, flaps: fl });
    // yaklaşma: -3° süzülüş için gazı biraz azalt
    ac.ctl.throttle = Math.max(0, ac.ctl.throttle - (P.kind === 'jet' ? 0.08 : 0.15)); input.throttle = ac.ctl.throttle;
    const g = 3 * D2R; ac.vel = [spd * Math.cos(g) * Math.cos(hdg), spd * Math.cos(g) * Math.sin(hdg), spd * Math.sin(g)];
  }
  ac.ctl.flaps = P.flapDetents[flapIdx] / P.flapDetents[P.flapDetents.length - 1]; ac.surf.flap = ac.ctl.flaps;
  camState.fs.set(Math.sin(hdg), 0, -Math.cos(hdg)); camState.yaw = 0; camState.pitch = 0; camState.fly = null;
  if (window.__ucak) window.__ucak.ac = ac;
  updateModel(0);
  updateCamera(0.016, true);
}

function setPause(v) { paused = v; $('#pause').classList.toggle('show', v); }

// ---------- rüzgar ----------
function updateWind(t, agl) {
  const W = { yok: 0, hafif: 8, kuvvetli: 18 }[settings.wind] * KT;
  if (!W) { wind = [0, 0, 0]; return; }
  const from = 40 * D2R; // poyraz (kuzeydoğu)
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
canvas.addEventListener('wheel', (e) => { camState.dist = clamp(camState.dist * (1 + Math.sign(e.deltaY) * 0.1), 0.5, 4); e.preventDefault(); }, { passive: false });

const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
function planeThree() {
  // NED -> three: X = doğu, Y = yukarı, Z = -kuzey
  const p = new THREE.Vector3(ac.pos[1], -ac.pos[2], -ac.pos[0]);
  const q = new THREE.Quaternion(ac.q[2], -ac.q[3], -ac.q[1], ac.q[0]);
  return { p, q };
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
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    // hareket yönüyle karıştır (yan kayma ve tutunma kaybında daha doğal)
    const v = new THREE.Vector3(ac.vel[1], -ac.vel[2], -ac.vel[0]);
    if (v.length() > 15) f.lerp(v.normalize(), 0.3).normalize();
    const k = snap ? 1 : 1 - Math.exp(-dt * 3.5);
    camState.fs.lerp(f, k).normalize();
    const dist = ac.P.camDist * camState.dist;
    const back = camState.fs.clone().negate();
    back.applyAxisAngle(up, camState.yaw);
    const side = new THREE.Vector3().crossVectors(back, up).normalize();
    if (side.lengthSq() > 0.1) back.applyAxisAngle(side, -camState.pitch);
    const pos = p.clone().addScaledVector(back, dist).addScaledVector(up, ac.P.camUp * camState.dist);
    const gh = world.ground(pos.x, -pos.z).h;
    if (pos.y < gh + 1.5) pos.y = gh + 1.5;
    camera.position.copy(pos);
    const pu = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    camera.up.copy(up).multiplyScalar(0.75).addScaledVector(pu, 0.25).normalize();
    camera.lookAt(tmpV.copy(p).addScaledVector(up, 1.2));
    camera.near = 1; camera.fov = 60;
  } else {
    // geçiş kamerası: uçağın önüne yerleşir, geçip uzaklaşınca yeniden
    const v = new THREE.Vector3(ac.vel[1], -ac.vel[2], -ac.vel[0]);
    if (!camState.fly || camState.fly.distanceTo(p) > 900 || snap) {
      const dir = v.length() > 5 ? v.clone().normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      const side = new THREE.Vector3().crossVectors(dir, up).normalize();
      camState.fly = p.clone().addScaledVector(dir, Math.max(60, v.length() * 9)).addScaledVector(side, 30 + Math.random() * 30).addScaledVector(up, 6);
      const gh = world.ground(camState.fly.x, -camState.fly.z).h; camState.fly.y = Math.max(camState.fly.y, gh + 3);
    }
    camera.position.copy(camState.fly); camera.up.copy(up); camera.lookAt(p);
    camera.near = 1; camera.fov = clamp(40 * 200 / Math.max(50, camera.position.distanceTo(p)), 8, 60);
  }
  camera.updateProjectionMatrix();
  world.sky.position.copy(camera.position);
}

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
  const as = liftCurve(P, 0, ac.surf.flap).as;
  const airborne = !ac.onGround;
  const warn = airborne && !ac.crashed && (o.alpha > as - 2.5 * D2R || ac.stallS > 0.02) && o.V > 5;
  hudT += dt;
  if (hudT > 0.06) {
    hudT = 0;
    setT(hud.spd, Math.round(ias).toString());
    setT(hud.gs, 'YH ' + Math.round(gs) + ' kt');
    setT(hud.alt, Math.round(ac.alt).toString());
    setT(hud.altft, Math.round(ac.alt / FT) + ' ft');
    setT(hud.agl, 'Yerden ' + Math.max(0, Math.round(o.agl - (P.gear[1].p[2]))) + ' m');
    setT(hud.vs, (vs >= 0 ? '+' : '') + Math.round(vs / FT * 60) + ' ft/dk');
    let h = Math.round(((e.psi * R2D) % 360 + 360) % 360); if (h === 0) h = 360;
    setT(hud.hdg, String(h).padStart(3, '0') + '°');
    setT(hud.thr, Math.round(ac.ctl.throttle * 100) + '%');
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
    if (isTouch) setT(hud.ti, 'GAZ ' + Math.round(ac.ctl.throttle * 100) + '%  ' + (P.kind === 'prop' ? Math.round(ac.rpm / 10) * 10 + ' rpm' : 'N1 ' + Math.round(ac.spool * 100) + '%') + '\nFLAP ' + P.flapDetents[flapIdx] + '°  TRİM ' + Math.round(ac.ctl.trim * 100) + (P.retract ? '  TAKIM ' + (ac.gearPos > 0.98 ? 'AÇIK' : ac.gearPos < 0.02 ? 'KAPALI' : '...') : '') + (ac.ctl.brake ? '  FREN' : ''));
    const nl = world.nearestLandmark(ac.pos[1], ac.pos[0]);
    setT(hud.near, nl && nl.dist < 2500 ? nl.name + ' · ' + (nl.dist < 1000 ? Math.round(nl.dist) + ' m' : (nl.dist / 1000).toFixed(1) + ' km') : '');
    let m = '';
    if (o.V > P.Vne * 0.95 && airborne) m = 'AZAMİ HIZ';
    else if (ac.nz > P.nMax) m = 'YÜK SINIRI AŞILDI';
    else if (settings.start === 'pist' && ac.onGround && ac.ctl.throttle < 0.05 && simTime < 8) m = 'Gazı açın (Shift / +), 55 kt civarında levyeyi çekin';
    setT(hud.msg, m);
    drawMini(e.psi);
  }
  hud.stall.classList.toggle('show', warn);
  drawAtt(e);
  return warn;
}
function drawMini(psi) {
  const W = mini.width, H = mini.height, img = world.minimap;
  mctx.fillStyle = '#2f6a8e'; mctx.fillRect(0, 0, W, H);
  const span = 12000; // görünen alan (m)
  const x = ac.pos[1], y = ac.pos[0];
  const sx = img.width / (world.X1 - world.X0), sy = img.height / (world.Y1 - world.Y0);
  const cx = (x - world.X0) * sx, cy = (world.Y1 - y) * sy, half = span / 2 * sx;
  mctx.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, W, H);
  // pist
  const k = W / span;
  const tp = (px, py) => [W / 2 + (px - x) * k, H / 2 - (py - y) * k];
  const rw = world.rw;
  const a = tp(rw.ax, rw.ay), b = tp(rw.ax + rw.ux * rw.len, rw.ay + rw.uy * rw.len);
  mctx.strokeStyle = '#222'; mctx.lineWidth = 3; mctx.beginPath(); mctx.moveTo(...a); mctx.lineTo(...b); mctx.stroke();
  mctx.fillStyle = '#b3262e';
  for (const l of world.landmarkPos) { const [u, v] = tp(l.x, l.y); if (u > 0 && v > 0 && u < W && v < H) { mctx.fillRect(u - 1.5, v - 1.5, 3, 3); } }
  // uçak
  mctx.save(); mctx.translate(W / 2, H / 2); mctx.rotate(psi);
  mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.lineWidth = 1;
  mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(5, 6); mctx.lineTo(0, 3); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
  mctx.fillStyle = 'rgba(255,255,255,.85)'; mctx.font = 'bold 11px system-ui,sans-serif'; mctx.fillText('K', W / 2 - 3, 12);
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
  actx.lineWidth = 1; actx.font = '9px system-ui,sans-serif'; actx.fillStyle = '#fff';
  for (const d of [-20, -10, 10, 20]) { const y = off - d * (r / 30); actx.beginPath(); actx.moveTo(-12, y); actx.lineTo(12, y); actx.stroke(); }
  actx.restore();
  actx.strokeStyle = '#ffcf33'; actx.lineWidth = 3;
  actx.beginPath(); actx.moveTo(W / 2 - 26, H / 2); actx.lineTo(W / 2 - 8, H / 2); actx.lineTo(W / 2, H / 2 + 6); actx.lineTo(W / 2 + 8, H / 2); actx.lineTo(W / 2 + 26, H / 2); actx.stroke();
  actx.strokeStyle = 'rgba(255,255,255,.6)'; actx.lineWidth = 2; actx.beginPath(); actx.arc(W / 2, H / 2, r, 0, Math.PI * 2); actx.stroke();
}

// ---------- duman (kaza) ----------
const smoke = [];
function puff(p) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ color: 0x333333, transparent: true, opacity: 0.7, depthWrite: false }));
  m.position.copy(p); scene.add(m); smoke.push({ m, t: 0 });
}

// ---------- döngü ----------
let last = performance.now();
let fpsT = 0, fpsN = 0, fps = 60;
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
      if (settings.autoRudder) {
        if (!ac.onGround) yaw = clamp(yaw + clamp(5 * ac.out.beta, -0.7, 0.7), -1, 1);
        else ac.ctl.autoSteer = input.roll * 0.8;
      }
      ac.ctl.yaw = yaw;
      ac.ctl.throttle = input.throttle;
      ac.ctl.brake = input.brake;
      ac.ctl.flaps = P.flapDetents[flapIdx] / P.flapDetents[P.flapDetents.length - 1];
      world.acAlt = ac.alt;
      updateWind(simTime, ac.out.agl || 100);
      advance(ac, env, dt, fixed);
      simTime += dt;
      // binalar, köprüler, kuleler
      if (!ac.crashed) {
        const pts = [[0, 0, 0], [ac.P.b * 0.45, 0, 0], [-ac.P.b * 0.45, 0, 0], [0, 0, -ac.P.eye[0] - 1.5]];
        const m = ac.m, world3 = [];
        for (const b of ac.P.hard) world3.push(b.p);
        world3.push([0, 0, 0]);
        const W = world3.map((bp) => {
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
    const warn = drawHUD(dt);
    sound.update(ac, warn, paused);
  }
  for (let i = smoke.length - 1; i >= 0; i--) {
    const s = smoke[i]; s.t += dt; s.m.position.y += dt * 3; s.m.scale.setScalar(2 + s.t * 4); s.m.material.opacity = Math.max(0, 0.7 - s.t * 0.12);
    if (s.t > 6) { scene.remove(s.m); smoke.splice(i, 1); }
  }
  world.waterNormal.offset.x = (now / 1000) * 0.01; world.waterNormal.offset.y = (now / 1000) * 0.006;
  world.update(camera.position);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

function handle(ev) {
  const P = ac.P;
  if (ev === 'pause') { if (running) setPause(!paused); return; }
  if (ev === 'reset') { resetFlight(); return; }
  if (ev === 'help') { $('#help').classList.toggle('show'); return; }
  if (ev === 'mute') { sound.muted = !sound.muted; return; }
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
// dikey ekran uyarısı
function orient() { document.body.classList.toggle('portrait', isTouch && innerHeight > innerWidth); }
addEventListener('resize', orient); orient();

// test kancası
window.__ucak = { ac: null, world, input, settings, start: startFlight, reset: resetFlight, camera, scene, renderer, setCam: (m) => { camMode = m; camState.fly = null; $('#camName').textContent = ['Takip', 'Kokpit', 'Geçiş'][m]; }, ready: false, fps: 0, THREE, startTrimmed, trimLevel, geo, KT, setFlap: (i) => (flapIdx = i), orbit: (y, p, d = 1) => { camState.yaw = y; camState.pitch = p; camState.dist = d; camState.lastDrag = performance.now() + 1e7; },
  place: (lat, lon, alt, hdg, kt, gearUp = true) => { const p = geo(lat, lon); startTrimmed(ac, { n: p.y, e: p.x, alt, heading: hdg * D2R, speed: kt * KT, gearUp: gearUp && ac.P.retract }); input.throttle = ac.ctl.throttle; flapIdx = 0; crashT = 0; $('#crash').classList.remove('show'); updateCamera(0.016, true); }, get camMode() { return camMode; } };
