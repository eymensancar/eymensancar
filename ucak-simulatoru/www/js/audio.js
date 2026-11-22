// Web Audio ile sentezlenen sesler: motor (devre bağlı), rüzgar, teker, tutunma kaybı uyarısı.
// Kokpitte motor kabin süzgecinden geçer (boğuk), rüzgar hışırtısı ve kanopi uğultusu artar; dışarıdaki kameralarda
// uzaklıkla ses azalır ve uçak yaklaşırken / uzaklaşırken perde değişir (Doppler). Geçişler yumuşaktır.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.inside = false; }
  setInside(v) { this.inside = !!v; }
  start(kind) {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.kind = kind;
  }
  _noise() {
    const c = this.ctx, len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = 0.97 * last + 0.03 * w; d[i] = w * 0.5 + last * 3; }
    const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s;
  }
  _build() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
    // motor sesleri bu yoldan geçer: kabin süzgeci (kokpitte alçak geçiren) + kazanç
    this.cab = c.createBiquadFilter(); this.cab.type = 'lowpass'; this.cab.frequency.value = 18000; this.cab.Q.value = 0.5;
    this.engBus = c.createGain(); this.engBus.gain.value = 1; this.engBus.connect(this.cab).connect(this.master);
    // kanopi uğultusu (yalnız kokpitte): çok alçak gürültü
    this.cn = this._noise(); this.cf = c.createBiquadFilter(); this.cf.type = 'lowpass'; this.cf.frequency.value = 75; this.cf.Q.value = 1.2;
    this.cg = c.createGain(); this.cg.gain.value = 0; this.cn.connect(this.cf).connect(this.cg).connect(this.master);
    // motor: iki testere dişi + kare, alçak geçiren süzgeç
    this.eg = c.createGain(); this.eg.gain.value = 0;
    this.ef = c.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.frequency.value = 400; this.ef.Q.value = 2;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = c.createOscillator(); this.o2.type = 'square';
    this.o3 = c.createOscillator(); this.o3.type = 'sawtooth';
    const g2 = c.createGain(); g2.gain.value = 0.35; const g3 = c.createGain(); g3.gain.value = 0.5;
    this.o1.connect(this.ef); this.o2.connect(g2).connect(this.ef); this.o3.connect(g3).connect(this.ef);
    // vuruntu: genlik modülasyonu
    this.am = c.createGain(); this.am.gain.value = 0.75;
    this.lfo = c.createOscillator(); this.lfo.type = 'sine'; const lg = c.createGain(); lg.gain.value = 0.25; this.lfo.connect(lg).connect(this.am.gain);
    this.ef.connect(this.am).connect(this.eg).connect(this.engBus);
    [this.o1, this.o2, this.o3, this.lfo].forEach((o) => o.start());
    // jet: gürültü + ıslık
    this.jn = this._noise(); this.jf = c.createBiquadFilter(); this.jf.type = 'bandpass'; this.jf.frequency.value = 800; this.jf.Q.value = 0.7;
    this.jg = c.createGain(); this.jg.gain.value = 0; this.jn.connect(this.jf).connect(this.jg).connect(this.engBus);
    this.jw = c.createOscillator(); this.jw.type = 'sine'; this.jwg = c.createGain(); this.jwg.gain.value = 0; this.jw.connect(this.jwg).connect(this.engBus); this.jw.start();
    // ard yakıcı gürlemesi
    this.an = this._noise(); this.af = c.createBiquadFilter(); this.af.type = 'lowpass'; this.af.frequency.value = 220; this.af.Q.value = 0.8;
    this.ag = c.createGain(); this.ag.gain.value = 0; this.an.connect(this.af).connect(this.ag).connect(this.engBus);
    // rüzgar
    this.wn = this._noise(); this.wf = c.createBiquadFilter(); this.wf.type = 'lowpass'; this.wf.frequency.value = 500;
    this.wg = c.createGain(); this.wg.gain.value = 0; this.wn.connect(this.wf).connect(this.wg).connect(this.master);
    // teker gürültüsü
    this.rn = this._noise(); this.rf = c.createBiquadFilter(); this.rf.type = 'lowpass'; this.rf.frequency.value = 140;
    this.rg = c.createGain(); this.rg.gain.value = 0; this.rn.connect(this.rf).connect(this.rg).connect(this.master);
    // tutunma kaybı uyarısı (kamış korna ~ 1.6 kHz)
    this.so = c.createOscillator(); this.so.type = 'square'; this.so.frequency.value = 1600;
    this.sf = c.createBiquadFilter(); this.sf.type = 'bandpass'; this.sf.frequency.value = 1600; this.sf.Q.value = 3;
    this.sg = c.createGain(); this.sg.gain.value = 0; this.so.connect(this.sf).connect(this.sg).connect(this.master); this.so.start();
  }
  // lis: { dist: dinleyiciye uzaklık (m), vr: yaklaşma hızı (m/sn, + yaklaşıyor) }
  update(ac, warn, paused, lis = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = 0.08, jet = ac.P.kind !== 'prop', ins = this.inside;
    const on = !paused && !this.muted && !ac.crashed;
    const att = ins ? 1 : Math.max(0.06, 1 / (1 + Math.max(0, (lis.dist || 0) - 40) / 220));
    const dop = ins ? 1 : Math.min(1.6, Math.max(0.62, 340 / (340 - Math.max(-200, Math.min(200, lis.vr || 0)))));
    this.master.gain.setTargetAtTime(on ? 0.7 * att : 0, t, 0.08);
    // kabin: jette motor boğuk ve kısık, pervanelide gürültülü ama tizi kesik
    this.cab.frequency.setTargetAtTime(ins ? (jet ? 900 : 1800) : 18000, t, 0.25);
    this.engBus.gain.setTargetAtTime(ins ? (jet ? 0.6 : 0.95) : 1, t, 0.25);
    const qb = ac.out.qbar || 0, buffet = Math.max(0, (ac.out.alpha || 0) - 0.3) * 2;
    this.cg.gain.setTargetAtTime(ins && !ac.onGround ? Math.min(0.5, qb / 45000 * 0.35 + buffet * Math.min(1, qb / 8000) * 0.4) : 0, t, 0.2);
    if (ac.P.kind === 'prop') {
      const f = Math.max(5, ac.rpm / 60 * 2) * dop; // 4 silindir, devirde 2 ateşleme
      this.o1.frequency.setTargetAtTime(f, t, k); this.o2.frequency.setTargetAtTime(f * 0.5, t, k); this.o3.frequency.setTargetAtTime(f * 2.01, t, k);
      this.lfo.frequency.setTargetAtTime(f * 0.25, t, k);
      this.ef.frequency.setTargetAtTime(180 + ac.rpm * 0.35 + ac.ctl.throttle * 500, t, k);
      this.eg.gain.setTargetAtTime(ac.rpm > 50 ? 0.12 + 0.22 * ac.ctl.throttle + ac.rpm / 2700 * 0.1 : 0, t, k);
      this.jg.gain.setTargetAtTime(0, t, k); this.jwg.gain.setTargetAtTime(0, t, k); this.ag.gain.setTargetAtTime(0, t, k);
    } else {
      const n = ac.spool;
      this.eg.gain.setTargetAtTime(0, t, k);
      this.jf.frequency.setTargetAtTime((300 + n * 1800) * dop, t, k);
      this.jg.gain.setTargetAtTime(0.08 + n * n * 0.4, t, k);
      this.jw.frequency.setTargetAtTime((1800 + n * 2600) * dop, t, k);
      this.jwg.gain.setTargetAtTime(0.012 + n * 0.02, t, k);
      this.ag.gain.setTargetAtTime((ac.ab || 0) * 0.55, t, 0.15);
    }
    const V = ac.out.V || 0;
    // rüzgar: kokpitte kanopi hışırtısı daha belirgin ve tiz
    this.wf.frequency.setTargetAtTime(ins ? 600 + V * 14 : 300 + V * 12, t, k);
    this.wg.gain.setTargetAtTime(Math.min(ins ? 0.34 : 0.25, (V / 90) ** 2 * (ins ? (jet ? 0.16 : 0.1) : 0.12)), t, k);
    const rolling = ac.wheel.some((w) => w.contact);
    const gs = Math.hypot(ac.vel[0], ac.vel[1]);
    this.rg.gain.setTargetAtTime(rolling ? Math.min(0.35, gs / 40 * 0.3) : 0, t, 0.05);
    this.sg.gain.setTargetAtTime(warn ? 0.07 : 0, t, 0.03);
  }
  crash() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, s = this._noise(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0.9;
    s.connect(f).connect(g).connect(c.destination);
    g.gain.setTargetAtTime(0, c.currentTime + 0.2, 0.5);
    setTimeout(() => s.stop(), 3000);
  }
}
