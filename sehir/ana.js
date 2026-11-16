/* Ana: sahne, ışık, girdi (sanal çubuk + düğmeler + klavye), hep yatay ekran, döngü.
   Kare sırası: girdi → istenen yön → fizik → hareket katmanları (update → mixer → post) → kök konumu → kamera → ses → çizim.
   Test: adres sonuna ?test eklenirse döngü kendiliğinden dönmez; SO.step(dt) ile elle ilerletilir (test/cek.cjs). */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, wrapA = SO.wrapA;
  const stage = document.getElementById('stage'), cv = document.getElementById('c');
  const renderer = new T3.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  const scene = new T3.Scene(), cam = new T3.PerspectiveCamera(55, 2, .2, 900);
  scene.fog = new T3.Fog(0xdde6e0, 150, 560);
  scene.add(new T3.HemisphereLight(0xffffff, 0xb9a98c, .62)); const sun = new T3.DirectionalLight(0xffffff, .62); sun.position.set(-5, 8, 3.5); scene.add(sun);
  SO.scene = scene; SO.camera = cam; SO.renderer = renderer;
  const golge = new T3.Mesh(new T3.CircleGeometry(.36, 20), new T3.MeshBasicMaterial({ color: 0x15120d, transparent: true, opacity: .26, depthWrite: false })); golge.rotation.x = -Math.PI / 2; golge.renderOrder = 1; scene.add(golge);

  const kb = { x: 0, y: 0 }, joyV = { x: 0, y: 0 };
  function girdi() {
    const inp = SO.input, ps = SO.ps, c = SO.cam; inp.jx = clamp(joyV.x + kb.x, -1, 1); inp.jy = clamp(joyV.y + kb.y, -1, 1);
    const mag = Math.min(1, Math.hypot(inp.jx, inp.jy)), fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx;
    if (mag > .12) { ps.wantX = (fx * inp.jy + rx * inp.jx) / mag; ps.wantZ = (fz * inp.jy + rz * inp.jx) / mag; ps.wantMag = mag; } else ps.wantMag = 0;
    ps.wantRun = !!inp.run && mag > .12;
  }
  function step(dt) {
    SO.time += dt; girdi(); SO.fizik.update(dt); SO.anim.update(dt);
    const ps = SO.ps, ch = SO.char; ch.root.position.set(ps.x, ps.y + (ps.rootDy || 0), ps.z); ch.root.rotation.order = 'YXZ'; ch.root.rotation.set(ps.leanFwd || 0, ps.yaw, ps.lean || 0); // yatma: ayak tabanından döner
    golge.position.set(ps.x, ps.groundY + .03, ps.z); const hs = 1 - Math.min(.5, (ps.y - ps.groundY) / 3); golge.scale.set(hs, hs, 1);
    SO.kamera.update(cam, dt); SO.ses.update(dt); renderer.render(scene, cam);
  }
  SO.step = step;
  let last = 0, fpsN = 0, fpsT = 0; const fpsEl = document.getElementById('fps');
  function frame(t) { requestAnimationFrame(frame); if (!SO.ready || SO.test) return; const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; step(dt); fpsN++; if (t - fpsT > 500) { fpsEl.textContent = Math.round(fpsN * 1000 / (t - fpsT)) + ' kare/sn'; fpsN = 0; fpsT = t; } }

  /* ---------- hep yatay sahne: ekran dikeyse sahne 90° döner (telefonun dönme kilidinden bağımsız) ---------- */
  let rot = false, SWd = 800, SHt = 400;
  function layout() {
    const wr = document.getElementById('wrap').getBoundingClientRect(), W = wr.width, H = wr.height; rot = H > W;
    SWd = rot ? H : W; SHt = rot ? W : H; stage.style.width = SWd + 'px'; stage.style.height = SHt + 'px'; stage.style.transform = rot ? `translate(${W}px,0) rotate(90deg)` : 'none';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(SWd, SHt, false); cam.aspect = SWd / SHt; cam.fov = SO.cam.fov; cam.updateProjectionMatrix();
  }
  const toStage = e => { const wr = document.getElementById('wrap').getBoundingClientRect(), x = e.clientX - wr.left, y = e.clientY - wr.top; return rot ? [y, wr.width - x] : [x, y]; };
  const joy = document.getElementById('joy'), knob = document.getElementById('knob'); let joyId = null, joyC = [0, 0], camId = null, camL = [0, 0];
  const dokun = () => { try { SO.ses.init(); } catch (e) { } };
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.btn')) return; e.preventDefault(); dokun(); const [x, y] = toStage(e);
    if (joyId === null && x < SWd * .42) { joyId = e.pointerId; joyC = [clamp(x, 80, SWd * .42), clamp(y, 80, SHt - 80)]; joy.style.left = (joyC[0] - 66) + 'px'; joy.style.bottom = 'auto'; joy.style.top = (joyC[1] - 66) + 'px'; }
    else if (camId === null) { camId = e.pointerId; camL = [x, y]; }
    try { stage.setPointerCapture(e.pointerId); } catch (x2) { }
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerId === joyId) { const [x, y] = toStage(e); let dx = x - joyC[0], dy = y - joyC[1]; const m = Math.hypot(dx, dy), R = 52; if (m > R) { dx *= R / m; dy *= R / m; } joyV.x = dx / R; joyV.y = -dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === camId) { const [x, y] = toStage(e), c = SO.cam; c.yaw = wrapA(c.yaw - (x - camL[0]) * .0075); c.pitch = clamp(c.pitch + (y - camL[1]) * .005, -.12, 1.1); camL = [x, y]; }
  });
  const endP = e => { if (e.pointerId === joyId) { joyId = null; joyV.x = joyV.y = 0; knob.style.transform = 'none'; } if (e.pointerId === camId) camId = null; };
  stage.addEventListener('pointerup', endP); stage.addEventListener('pointercancel', endP); stage.addEventListener('contextmenu', e => e.preventDefault());
  const hold = (id, k, tap) => { const el = document.getElementById(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dokun(); SO.input[k] = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (x) { } });
    const up = () => { if (!tap) SO.input[k] = false; el.classList.remove('on'); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up); };
  hold('bRun', 'run'); hold('bJump', 'jump', true);
  const KD = {}; const keySync = () => { kb.x = (KD.d || KD.ArrowRight ? 1 : 0) - (KD.a || KD.ArrowLeft ? 1 : 0); kb.y = (KD.w || KD.ArrowUp ? 1 : 0) - (KD.s || KD.ArrowDown ? 1 : 0); };
  addEventListener('keydown', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(k)) e.preventDefault(); dokun(); KD[k] = 1; keySync(); if (k === 'Shift') SO.input.run = true; if (k === ' ' && !e.repeat) SO.input.jump = true; });
  addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; KD[k] = 0; keySync(); if (k === 'Shift') SO.input.run = false; });
  addEventListener('blur', () => { for (const k in KD) KD[k] = 0; keySync(); SO.input.run = false; });
  addEventListener('resize', layout); if (window.ResizeObserver) new ResizeObserver(layout).observe(document.getElementById('wrap'));
  SO.joy = joyV; // test: SO.joy.x / SO.joy.y yazılarak çubuk taklit edilir

  (async () => {
    const yuk = document.getElementById('load');
    try {
      if (document.fonts && document.fonts.load) await document.fonts.load("30px 'Lilita One'").catch(() => { });
      layout(); SO.world.build(scene, renderer); const ch = await SO.karakter.build(scene);
      const ps = SO.ps; ps.x = SO.world.start.x; ps.z = SO.world.start.z; ps.y = ps.groundY = SO.world.groundY(ps.x, ps.z); ps.yaw = Math.PI; SO.cam.yaw = Math.PI;
      SO.anim.init({ char: ch, mixer: ch.mixer, action: ch.action, bones: ch.bones, clips: ch.clips, ps, input: SO.input, tune: SO.tune, world: SO.world, get time() { return SO.time; } });
      step(0); yuk.hidden = true; SO.ready = true;
    } catch (e) { yuk.textContent = 'Açılamadı: ' + e.message; console.error(e); }
  })();
  requestAnimationFrame(frame);
})();
