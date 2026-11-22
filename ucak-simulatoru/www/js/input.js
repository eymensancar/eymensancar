// Kumandalar: klavye, dokunmatik (sanal levye, gaz kolu, düğmeler), oyun kumandası, eğme (isteğe bağlı).
// Çıktı: pitch (+ burun yukarı), roll (+ sağa), yaw (+ sağ pedal) -1..1; throttle 0..1; olaylar.
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export class Input {
  constructor() {
    this.keys = new Set();
    this.pitch = 0; this.roll = 0; this.yaw = 0; this.throttle = 0; this.brake = 0;
    this.events = [];
    this.stick = null;        // dokunmatik levye {x,y}
    this.touchRud = 0;
    this.touchBrake = false;
    this.tilt = { on: false, b0: null, g0: null, x: 0, y: 0 };
    this.invert = false;      // true: yukarı tuşu burnu kaldırır
    this.lastGamepad = {};
    this._kb();
  }
  emit(e) { this.events.push(e); }
  take() { const e = this.events; this.events = []; return e; }

  _kb() {
    const map = { KeyF: 'flapDown', KeyV: 'flapUp', KeyC: 'camera', KeyR: 'reset', KeyP: 'pause', Escape: 'pause', KeyT: 'autotrim', KeyG: 'gear', KeyM: 'mute', KeyH: 'help', KeyL: 'engine', KeyK: 'smoke', KeyN: 'map' };
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown'].includes(k) || (e.ctrlKey && /^Key[WASDQEFBRVCZXTGP]$/.test(k))) e.preventDefault();
      if (!e.repeat && map[k]) this.emit(map[k]);
      const dg = /^(Digit|Numpad)(\d)$/.exec(k);
      if (dg) { const i = +dg[2]; this.throttle = i === 0 ? 1 : (i - 1) / 9; }
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  setTilt(on) {
    this.tilt.on = on; this.tilt.b0 = null;
    if (on && !this._tiltBound) {
      this._tiltBound = true;
      addEventListener('deviceorientation', (e) => {
        if (!this.tilt.on || e.beta == null) return;
        // yatay ekranda: beta ileri-geri, gamma yana (yön ekran açısına göre)
        const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        let pitchA, rollA;
        if (ang === 90) { pitchA = -e.gamma; rollA = e.beta; } else if (ang === -90 || ang === 270) { pitchA = e.gamma; rollA = -e.beta; } else { pitchA = e.beta; rollA = e.gamma; }
        if (this.tilt.b0 == null) { this.tilt.b0 = pitchA; }
        this.tilt.y = clamp((pitchA - this.tilt.b0) / 25, -1, 1);
        this.tilt.x = clamp(rollA / 30, -1, 1);
      });
    }
  }

  update(dt) {
    const K = this.keys;
    const has = (...c) => c.some((x) => K.has(x));
    // klavye: rampalı girdi
    let up = has('KeyW', 'ArrowUp'), dn = has('KeyS', 'ArrowDown');
    if (this.invert) [up, dn] = [dn, up];
    const kp = (dn ? 1 : 0) - (up ? 1 : 0); // S/aşağı ok = levye geri = burun yukarı
    const kr = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
    const ky = (has('KeyE') ? 1 : 0) - (has('KeyQ') ? 1 : 0);
    const ramp = (cur, tgt, up, down) => { const r = (tgt === 0 || Math.sign(tgt) !== Math.sign(cur) ? down : up) * dt; return cur + clamp(tgt - cur, -r, r); };
    this.kbP = ramp(this.kbP || 0, kp, 1.4, 3.5);
    this.kbR = ramp(this.kbR || 0, kr, 2.2, 4);
    this.kbY = ramp(this.kbY || 0, ky, 2.5, 4);
    if (has('ShiftLeft', 'ShiftRight', 'Equal', 'NumpadAdd', 'PageUp')) this.throttle += dt * 0.5;
    if (has('ControlLeft', 'ControlRight', 'Minus', 'NumpadSubtract', 'PageDown')) this.throttle -= dt * 0.5;
    if (has('KeyZ')) this.emit('trimDown');
    if (has('KeyX')) this.emit('trimUp');
    let p = this.kbP, r = this.kbR, y = this.kbY;
    // dokunmatik levye
    if (this.stick) { p += -this.stick.y; r += this.stick.x; }
    y += this.touchRud;
    if (this.tilt.on) { p += this.tilt.y; r += this.tilt.x; }
    // oyun kumandası
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.08 ? 0 : v);
      r += dz(gp.axes[0] || 0); p += dz(gp.axes[1] || 0) * (this.invert ? -1 : 1);
      y += dz(gp.axes[2] || 0);
      const b = (i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
      const bv = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
      this.throttle += (bv(7) - bv(6)) * dt * 0.6;
      const edge = (i, ev) => { const s = b(i); if (s && !this.lastGamepad[i]) this.emit(ev); this.lastGamepad[i] = s; };
      edge(0, 'flapDown'); edge(2, 'flapUp'); edge(3, 'camera'); edge(9, 'pause'); edge(8, 'reset'); edge(5, 'gear'); edge(12, 'smoke');
      if (b(1)) this._padBrake = true; else this._padBrake = false;
      if (b(4)) this.emit('autotrim');
    }
    this.throttle = clamp(this.throttle, 0, 1);
    this.pitch = clamp(p, -1, 1); this.roll = clamp(r, -1, 1); this.yaw = clamp(y, -1, 1);
    this.brake = (has('KeyB', 'Space') || this.touchBrake || this._padBrake) ? 1 : 0;
  }

  // ---------- dokunmatik ----------
  bindTouch(el) {
    const stickEl = el.querySelector('#stick'), knob = el.querySelector('#knob');
    // yön tuşları: 4 ayrı tuş (yukarı = burun yukarı, sağ = sağa yatış). Her parmak ayrı izlenir: istediğin kadar tuşa
    // aynı anda basılır (yukarı + sağ birlikte; yukarı + aşağı birbirini götürür). Parmak kaydırılınca komşu tuşa geçer,
    // iki tuşun arasına basınca ikisi birden basılır. Basılı tuttukça her eksenin komutu %35'ten %100'e çıkar (1,2 sn).
    const pad = el.querySelector('#dpad');
    if (pad) {
      const keys = [...pad.querySelectorAll('[data-dir]')]; // sırası: yukarı, sağ, aşağı, sol
      const ptr = new Map(); // parmak -> basılı tuşlar (bit)
      const hit = (e) => {
        const r = pad.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        const d = Math.hypot(x, y); if (d < r.width * 0.11 || d > r.width * 0.85) return 0;
        const a = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360; // 0 yukarı, 90 sağ
        let m = 1 << (Math.round(a / 90) % 4);
        const off = a % 90; if (off > 30 && off < 60) m = (1 << (Math.floor(a / 90) % 4)) | (1 << ((Math.floor(a / 90) + 1) % 4)); // köşegen: iki tuş
        return m;
      };
      const t0 = { p: 0, r: 0 }, last = { p: 0, r: 0 };
      const mask = () => { let m = 0; for (const v of ptr.values()) m |= v; return m; };
      const refresh = () => { const m = mask(); keys.forEach((k, i) => k.classList.toggle('on', !!(m & (1 << i)))); };
      pad.addEventListener('pointerdown', (e) => { try { pad.setPointerCapture(e.pointerId); } catch (_) { /* yapay olay */ } ptr.set(e.pointerId, hit(e)); refresh(); e.preventDefault(); });
      pad.addEventListener('pointermove', (e) => { if (!ptr.has(e.pointerId)) return; const m = hit(e); if (m !== ptr.get(e.pointerId)) { ptr.set(e.pointerId, m); refresh(); } });
      const end = (e) => { if (!ptr.delete(e.pointerId)) return; refresh(); if (!ptr.size) this.stick = null; };
      pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
      this._padFrame = () => {
        const m = mask(), now = performance.now();
        const py = ((m & 1) ? 1 : 0) - ((m & 4) ? 1 : 0), rx = ((m & 2) ? 1 : 0) - ((m & 8) ? 1 : 0);
        if (py !== last.p) { t0.p = now; last.p = py; } if (rx !== last.r) { t0.r = now; last.r = rx; }
        const ramp = (t) => 0.35 + 0.65 * Math.min(1, (now - t) / 1200);
        if (!py && !rx) { if (this._padActive) this.stick = null; this._padActive = false; return; }
        this._padActive = true;
        this.stick = { x: rx * ramp(t0.r), y: -py * ramp(t0.p) };
      };
      this.padMask = mask;
    }
    const thrEl = el.querySelector('#thr'), thrFill = el.querySelector('#thrFill'), thrKnob = el.querySelector('#thrKnob');
    let stickId = null, thrId = null;
    const R = () => stickEl.getBoundingClientRect();
    const setStick = (t) => {
      const r = R(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
      let x = (t.clientX - cx) / rad, y = (t.clientY - cy) / rad;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      // doğrusal: ne kadar itilirse o kadar (ortada küçük ölü bölge)
      const dz = (v) => Math.sign(v) * Math.max(0, Math.abs(v) - 0.05) / 0.95;
      this.stick = { x: dz(x), y: dz(y) };
      knob.style.transform = `translate(${x * rad * 0.62}px, ${y * rad * 0.62}px)`;
    };
    stickEl.addEventListener('pointerdown', (e) => { stickId = e.pointerId; try { stickEl.setPointerCapture(e.pointerId); } catch (_) { /* yapay olay */ } setStick(e); e.preventDefault(); });
    stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) setStick(e); });
    const endS = (e) => { if (e.pointerId !== stickId) return; stickId = null; this.stick = null; knob.style.transform = ''; };
    stickEl.addEventListener('pointerup', endS); stickEl.addEventListener('pointercancel', endS);
    const setThr = (e) => { const r = thrEl.getBoundingClientRect(); this.throttle = clamp(1 - (e.clientY - r.top - 14) / (r.height - 28), 0, 1); };
    thrEl.addEventListener('pointerdown', (e) => { thrId = e.pointerId; try { thrEl.setPointerCapture(e.pointerId); } catch (_) { /* yapay olay */ } setThr(e); e.preventDefault(); });
    thrEl.addEventListener('pointermove', (e) => { if (e.pointerId === thrId) setThr(e); });
    thrEl.addEventListener('pointerup', (e) => { if (e.pointerId === thrId) thrId = null; });
    this._thrUI = () => { const h = this.throttle * 100; thrFill.style.height = h + '%'; thrKnob.style.bottom = `calc(${h}% - ${h / 100 * 28}px)`; };
    const hold = (id, on, off) => {
      const b = el.querySelector(id); if (!b) return;
      b.addEventListener('pointerdown', (e) => { try { b.setPointerCapture(e.pointerId); } catch (_) { /* yapay olay */ } b.classList.add('on'); on(); e.preventDefault(); });
      const up = () => { b.classList.remove('on'); off(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    };
    hold('#bRudL', () => (this.touchRud = -1), () => (this.touchRud = 0));
    hold('#bRudR', () => (this.touchRud = 1), () => (this.touchRud = 0));
    hold('#bBrake', () => (this.touchBrake = true), () => (this.touchBrake = false));
    hold('#bTrimU', () => (this._trimHold = 'trimUp'), () => (this._trimHold = null));
    hold('#bTrimD', () => (this._trimHold = 'trimDown'), () => (this._trimHold = null));
    const tap = (id, ev) => { const b = el.querySelector(id); if (b) b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.emit(ev); }); };
    tap('#bFlapD', 'flapDown'); tap('#bFlapU', 'flapUp'); tap('#bCam', 'camera'); tap('#bPause', 'pause'); tap('#bGear', 'gear'); tap('#bReset', 'reset'); tap('#bSmoke', 'smoke'); tap('#bMap', 'map');
  }
  touchFrame() { if (this._padFrame) this._padFrame(); if (this._thrUI) this._thrUI(); if (this._trimHold) this.emit(this._trimHold); }
}
