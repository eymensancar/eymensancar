// İstanbul Uçuşu - uçuş dinamiği modeli (6 serbestlik dereceli katı cisim).
// DOM ya da three.js kullanmaz: tarayıcıda ve Node'da (testler) aynı dosya çalışır.
//
// Eksenler (havacılıkta alışılmış):
//   Dünya: NED (x kuzey, y doğu, z aşağı), metre. Yükseklik = -z.
//   Gövde: x ileri, y sağ kanat, z aşağı. Ağırlık merkezi başlangıçta.
//   Yönelim: birim kuaterniyon q = [w,x,y,z], gövdeden dünyaya döndürür.
//   Açısal hız: gövde ekseninde [p, q, r] (yuvarlanma, yunuslama, sapma).
//
// Kuvvetler: kararlılık türevleriyle aerodinamik (CL(α) ve gerçekçi tutunma kaybı,
// indüklenmiş sürükleme, yan kuvvet, yer etkisi), pervane ya da jet itkisi,
// ISA atmosferi, yay-sönümleyici iniş takımı (sürtünme, fren, burun tekeri),
// yerçekimi. Sabit adımlı yarı örtük Euler, 240 Hz.

export const G0 = 9.80665;
export const KT = 0.514444;     // 1 knot = m/s
export const FT = 0.3048;
const D2R = Math.PI / 180;

// ---------- ISA atmosferi ----------
export function isa(h) {
  const hh = Math.max(-500, Math.min(h, 11000));
  const T = 288.15 - 0.0065 * hh;
  const p = 101325 * Math.pow(T / 288.15, 5.25588);
  const rho = p / (287.053 * T);
  return { T, p, rho, a: Math.sqrt(1.4 * 287.053 * T), sigma: rho / 1.225 };
}

// ---------- küçük vektör ve kuaterniyon yardımcıları ----------
export function qmul(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}
export function qnorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l; return q;
}
// gövde -> dünya döndürme matrisi (satır sıralı 9 eleman)
export function qmat(q, m) {
  const [w, x, y, z] = q;
  m[0] = 1 - 2 * (y * y + z * z); m[1] = 2 * (x * y - w * z); m[2] = 2 * (x * z + w * y);
  m[3] = 2 * (x * y + w * z); m[4] = 1 - 2 * (x * x + z * z); m[5] = 2 * (y * z - w * x);
  m[6] = 2 * (x * z - w * y); m[7] = 2 * (y * z + w * x); m[8] = 1 - 2 * (x * x + y * y);
  return m;
}
const mulM = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mulMT = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Euler açılarından (yuvarlanma φ, yunuslama θ, baş ψ) kuaterniyon, 3-2-1 sırası
export function eulerToQuat(phi, theta, psi) {
  const cr = Math.cos(phi / 2), sr = Math.sin(phi / 2), cp = Math.cos(theta / 2), sp = Math.sin(theta / 2), cy = Math.cos(psi / 2), sy = Math.sin(psi / 2);
  return [cr * cp * cy + sr * sp * sy, sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy];
}
export function quatToEuler(q) {
  const [w, x, y, z] = q;
  const phi = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const theta = Math.asin(clamp(2 * (w * y - z * x), -1, 1));
  const psi = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  return { phi, theta, psi };
}

// ---------- uçaklar ----------
// Cessna 172 sınıfı: Roskam / JSBSim c172 verilerine yakın değerler, 1000 kg.
export const PLANES = {
  c172: {
    id: 'c172', name: 'Cessna 172 sınıfı', kind: 'prop',
    mass: 1000, S: 16.2, b: 11.0, c: 1.49,
    I: [1285, 1825, 2667], // kg m²  (Ixx, Iyy, Izz)
    // kaldırma
    CL0: 0.30, CLa: 5.14, CLq: 3.9, CLadot: 1.7, CLde: 0.43,
    aStall: 16 * D2R, aStallNeg: -13 * D2R, round: 0.07, stallDrop: 0.45,
    // flaplar: 0..1 (0°, 10°, 20°, 30°)
    flapDetents: [0, 10, 20, 30], flapCL: 0.75, flapCD: 0.045, flapCm: -0.05, flapStall: -2 * D2R, flapRate: 0.25,
    // sürükleme
    CD0: 0.032, e: 0.72, CLminD: 0.10, CDbeta: 0.3,
    // yan kuvvet
    CYb: -0.39, CYdr: 0.187, CYp: -0.04, CYr: 0.21,
    // yunuslama
    Cm0: 0.04, Cma: -0.89, Cmq: -12.4, Cmadot: -5.2, Cmde: -1.28, CmStall: -0.12,
    // yuvarlanma
    Clb: -0.089, Clp: -0.47, Clda: 0.178, Cldr: 0.0147,
    // sapma
    Cnb: 0.065, Cnr: -0.099, Cnda: -0.020, Cndr: -0.0657,
    // kumanda sınırları (rad): elevatör yukarı(-)/aşağı(+), kanatçık, dümen
    deUp: -25 * D2R, deDown: 20 * D2R, daMax: 20 * D2R, drMax: 16 * D2R, surfRate: 70 * D2R,
    // motor ve pervane (sabit hatveli, 160 hp)
    Pmax: 119000, rpmRated: 2700, rpmMax: 2850, propD: 1.905, propI: 2.6,
    CT0: 0.0887, CTk: 0.0963, CP0: 0.0563, CPk: 0.0307, idle: 0.07, Pfric: 6000,
    // pervane torku ve iz akımı kapalı: gerçekte uçak her gaz değişiminde sağa/sola çeker; oyuncu bunu istemedi (Eymen, 22.11)
    torqueRoll: 0, slipYaw: 0, torqueRig: 0, thrustRig: 0,
    Vne: 163 * KT, nMax: 3.8, nMin: -1.52,
    // iniş takımı: gövde koordinatı (x ileri, y sağ, z aşağı), yay, sönüm
    gear: [
      { name: 'burun', p: [1.2, 0, 1.25], k: 27000, c: 2900, steer: true, brake: false },
      { name: 'sol', p: [-0.35, -1.25, 1.25], k: 48000, c: 5200, steer: false, brake: true },
      { name: 'sağ', p: [-0.35, 1.25, 1.25], k: 48000, c: 5200, steer: false, brake: true },
    ],
    steerMax: 10 * D2R, retract: false,
    // tekerlek dışı temas noktaları (değerse hasar/kaza)
    hard: [
      { name: 'kuyruk', p: [-4.6, 0, 0.35] },
      { name: 'pervane', p: [1.85, 0, 0.95], prop: true },
      { name: 'sol kanat ucu', p: [-0.2, -5.5, -0.95] },
      { name: 'sağ kanat ucu', p: [-0.2, 5.5, -0.95] },
      { name: 'gövde', p: [0.2, 0, 0.75] },
    ],
    eye: [0.35, -0.3, -0.55], // kokpit kamerası
    camDist: 14, camUp: 3.2,
  },
  // Jet eğitim uçağı (L-39 sınıfı): 4400 kg, 16.9 kN itki, katlanır iniş takımı.
  jet: {
    id: 'jet', name: 'Jet eğitim uçağı (L-39 sınıfı)', kind: 'jet',
    mass: 4400, S: 18.8, b: 9.46, c: 2.15,
    I: [14200, 29700, 39600],
    CL0: 0.12, CLa: 4.6, CLq: 5.0, CLadot: 1.5, CLde: 0.40,
    aStall: 15 * D2R, aStallNeg: -12 * D2R, round: 0.07, stallDrop: 0.35,
    flapDetents: [0, 25, 44], flapCL: 0.70, flapCD: 0.06, flapCm: -0.04, flapStall: -2 * D2R, flapRate: 0.2,
    CD0: 0.030, e: 0.80, CLminD: 0.05, CDbeta: 0.4, gearCD: 0.02,
    CYb: -0.6, CYdr: 0.15, CYp: -0.03, CYr: 0.3,
    Cm0: 0.02, Cma: -0.6, Cmq: -15, Cmadot: -6, Cmde: -1.1, CmStall: -0.1,
    Clb: -0.08, Clp: -0.40, Clda: 0.12, Cldr: 0.012,
    Cnb: 0.11, Cnr: -0.18, Cnda: -0.01, Cndr: -0.07,
    deUp: -25 * D2R, deDown: 15 * D2R, daMax: 18 * D2R, drMax: 20 * D2R, surfRate: 90 * D2R,
    Tmax: 16900, spoolUp: 0.28, spoolDown: 0.45, idleN: 0.06,
    Vne: 490 * KT, nMax: 8, nMin: -4,
    gear: [
      { name: 'burun', p: [2.4, 0, 1.45], k: 140000, c: 14000, steer: true, brake: false },
      { name: 'sol', p: [-0.3, -1.22, 1.45], k: 190000, c: 22000, steer: false, brake: true },
      { name: 'sağ', p: [-0.3, 1.22, 1.45], k: 190000, c: 22000, steer: false, brake: true },
    ],
    steerMax: 12 * D2R, retract: true,
    hard: [
      { name: 'kuyruk', p: [-5.6, 0, 0.55] },
      { name: 'burun', p: [5.6, 0, 0.6] },
      { name: 'sol kanat ucu', p: [-0.9, -4.73, 0.75] },
      { name: 'sağ kanat ucu', p: [-0.9, 4.73, 0.75] },
      { name: 'gövde', p: [0, 0, 0.85] },
    ],
    eye: [2.6, 0, -0.75],
    camDist: 19, camUp: 4,
  },
  // F-16 sınıfı tek motorlu savaş uçağı: 11.5 t, 76 kN (ard yakıcıyla 125 kN, itki/ağırlık ~1.1).
  // Uçuş kumandası "fly-by-wire": levye yük faktörü (g) ve yuvarlanma hızı ister, bilgisayar yüzeyleri oynatır;
  // hücum açısı 25° ve 9 g ile sınırlıdır, tutunma kaybına girmez (oyun için gerçeğinden bağışlayıcı).
  f16: {
    id: 'f16', name: 'F-16 sınıfı savaş uçağı', kind: 'jet',
    mass: 11500, S: 27.87, b: 9.96, c: 3.45,
    I: [13000, 80000, 92000],
    CL0: 0.05, CLa: 3.6, CLq: 3.0, CLadot: 0.8, CLde: 0.45,
    aStall: 32 * D2R, aStallNeg: -18 * D2R, round: 0.12, stallDrop: 0.25,
    flapDetents: [0, 20], flapCL: 0.35, flapCD: 0.035, flapCm: -0.02, flapStall: 0, flapRate: 0.5,
    CD0: 0.0205, e: 0.78, CLminD: 0.08, CDbeta: 0.5, gearCD: 0.025, Mcrit: 0.88, waveCD: 0.028,
    CYb: -0.9, CYdr: 0.18, CYp: 0, CYr: 0.4,
    Cm0: 0.0, Cma: -0.25, Cmq: -5.0, Cmadot: -2.0, Cmde: -0.62, CmStall: -0.08,
    Clb: -0.05, Clp: -0.30, Clda: 0.13, Cldr: 0.01,
    Cnb: 0.12, Cnr: -0.30, Cnda: -0.002, Cndr: -0.075,
    deUp: -25 * D2R, deDown: 25 * D2R, daMax: 21.5 * D2R, drMax: 30 * D2R, surfRate: 60 * D2R * 1.0, surfRateA: 240 * D2R,
    Tmax: 76000, Tab: 125000, spoolUp: 0.55, spoolDown: 0.8, idleN: 0.07, gearTime: 3,
    Vne: 850 * KT, nMax: 9, nMin: -3,
    // fly-by-wire sınırları
    fbw: { nMax: 9, nMin: -3, nMaxGear: 4, aMax: 25 * D2R, aMaxGear: 15 * D2R, aMin: -10 * D2R, pMax: 240 * D2R, betaMax: 12 * D2R, yawAug: 0.25, couple: 0.4, turnComp: true },
    gear: [
      { name: 'burun', p: [3.9, 0, 1.78], k: 120000, c: 14000, steer: true, brake: false },
      { name: 'sol', p: [-0.45, -1.18, 1.78], k: 300000, c: 32000, steer: false, brake: true },
      { name: 'sağ', p: [-0.45, 1.18, 1.78], k: 300000, c: 32000, steer: false, brake: true },
    ],
    steerMax: 14 * D2R, retract: true,
    hard: [
      { name: 'kuyruk', p: [-6.9, 0, 0.55] },
      { name: 'burun', p: [7.8, 0, 0.5] },
      { name: 'sol kanat ucu', p: [-1.6, -4.98, 0.45] },
      { name: 'sağ kanat ucu', p: [-1.6, 4.98, 0.45] },
      { name: 'gövde', p: [0, 0, 1.05] },
    ],
    eye: [3.55, 0, -1.05],
    camDist: 21, camUp: 4.2,
  },
};

// ---------- kaldırma eğrisi ----------
// Doğrusal bölge, tepeye doğru yumuşak yuvarlanma, sonra kopma ve düz levha davranışı.
// Döndürür: {CL, s} s = 0..1 ayrılma (tutunma kaybı) miktarı.
export function liftCurve(P, a, flap) {
  const dCL = P.flapCL * flap;
  const as = P.aStall + P.flapStall * flap;
  const an = P.aStallNeg;
  const lin = (x) => P.CL0 + dCL + P.CLa * x;
  const R = P.round;
  let CL, s = 0;
  if (a >= as - R) {
    const a1 = as - R;
    const peak = lin(a1) + P.CLa * R / 2;
    if (a <= as) { const x = a - a1; CL = lin(a1) + P.CLa * x - P.CLa / (2 * R) * x * x; }
    else {
      s = smooth(as, as + 0.09, a);
      const drop = peak - P.stallDrop * smooth(as, as + 0.07, a);
      const fp = 1.15 * Math.sin(2 * a); // düz levha
      CL = drop + (fp - drop) * smooth(as + 0.07, as + 0.35, a);
    }
  } else if (a <= an + R) {
    const a1 = an + R;
    const peak = lin(a1) - P.CLa * R / 2;
    if (a >= an) { const x = a1 - a; CL = lin(a1) - P.CLa * x + P.CLa / (2 * R) * x * x; }
    else {
      s = smooth(-an, -an + 0.09, -a);
      const drop = peak + P.stallDrop * smooth(-an, -an + 0.07, -a);
      const fp = 1.15 * Math.sin(2 * a);
      CL = drop + (fp - drop) * smooth(-an + 0.07, -an + 0.35, -a);
    }
  } else CL = lin(a);
  return { CL, s, as };
}

// ---------- uçak durumu ----------
export class Aircraft {
  constructor(P) {
    this.P = P;
    this.m = new Float64Array(9);
    this.reset();
  }
  reset() {
    const P = this.P;
    this.pos = [0, 0, 0];           // NED
    this.vel = [0, 0, 0];           // NED, m/s
    this.q = [1, 0, 0, 0];
    this.w = [0, 0, 0];             // gövde açısal hız
    this.ctl = { pitch: 0, roll: 0, yaw: 0, throttle: 0, flaps: 0, brake: 0, trim: 0, gearDown: true };
    this.surf = { de: 0, da: 0, dr: 0, flap: 0 };
    this.gearPos = 1;               // 1 açık, 0 kapalı
    this.rpm = P.kind === 'prop' ? 0 : 0;
    this.spool = P.kind === 'jet' ? P.idleN : 0;
    this.ab = 0; this.fbwS = null; this.fbwOut = null;
    this.engineOn = true;
    this.alpha = 0; this.beta = 0; this.alphaPrev = 0; this.alphaDot = 0;
    this.out = { V: 0, alpha: 0, beta: 0, qbar: 0, CL: 0, CD: 0, M: 0, rho: 1.225, L: 0, D: 0, T: 0, agl: 0, ground: { h: 0, kind: 'land' } };
    this.wheel = P.gear.map(() => ({ comp: 0, load: 0, contact: false }));
    this.onGround = false;
    this.crashed = null;            // kaza nedeni (metin) ya da null
    this.time = 0;
    this.nz = 1;
    this.stallS = 0;
    this.thrust = 0;
    qmat(this.q, this.m);
  }
  get alt() { return -this.pos[2]; }

  // kumanda yüzeylerini sınırlı hızla komuta doğru götür
  _surfaces(dt) {
    const P = this.P, c = this.ctl, s = this.surf;
    let deCmd, daCmd, drCmd;
    if (P.fbw) ({ deCmd, daCmd, drCmd } = this._fbw(dt));
    else {
      const pitch = clamp(c.pitch + c.trim, -1, 1);
      // pitch +1 = levye geri (burun yukarı) -> elevatör yukarı (negatif)
      deCmd = pitch >= 0 ? pitch * P.deUp : -pitch * P.deDown;
      daCmd = clamp(c.roll, -1, 1) * P.daMax;
      drCmd = -clamp(c.yaw, -1, 1) * P.drMax; // sağ pedal -> burun sağa
    }
    const r = P.surfRate * dt, ra = (P.surfRateA || P.surfRate) * dt;
    s.de += clamp(deCmd - s.de, -r, r);
    s.da += clamp(daCmd - s.da, -ra, ra);
    s.dr += clamp(drCmd - s.dr, -ra, ra);
    const fr = P.flapRate * dt;
    s.flap += clamp(c.flaps - s.flap, -fr, fr);
    if (P.retract) { const g = c.gearDown ? 1 : 0, gt = P.gearTime || 6; this.gearPos += clamp(g - this.gearPos, -dt / gt, dt / gt); }
  }

  // Fly-by-wire: levye yunuslamada yük faktörü (g), yatışta yuvarlanma hızı ister.
  // Levye ortadayken uçuş yolu korunur (ters uçuşta da), hücum açısı ve g sınırlanır, dümen yan kaymayı siler.
  _fbw(dt) {
    const P = this.P, F = P.fbw, c = this.ctl, o = this.out, m = this.m;
    const st = this.fbwS || (this.fbwS = { ia: 0 });
    const V = Math.max(o.V, 25), qbar = Math.max(o.qbar, 300);
    const [p, q, r] = this.w;
    const alpha = o.alpha || 0, beta = o.beta || 0;
    const gearDn = this.gearPos > 0.5;
    const aMax = gearDn ? F.aMaxGear : F.aMax;
    // yerde (tekerlek yükü varken) doğrudan kumanda: kalkışta burun yumuşak kalkar
    if (this.onGround) {
      st.ia = 0; st.u = null;
      const pitch = clamp(c.pitch + c.trim, -1, 1);
      return { deCmd: pitch >= 0 ? pitch * P.deUp * 0.8 : -pitch * P.deDown * 0.5, daCmd: clamp(c.roll, -1, 1) * P.daMax * 0.5, drCmd: -clamp(c.yaw, -1, 1) * P.drMax * 0.5 };
    }
    // yerçekimi telafisi: dünya aşağı yönünün gövde z bileşeni (= cosθ cosφ)
    let n0 = clamp(m[8], -1, 1);
    // dönüş telafisi: levye ortadayken yatışta da irtifa korunur (n = cosθ/cosφ); 60°'den sonra ters uçuşa doğru yumuşakça eski davranışa döner
    if (F.turnComp) {
      const cth = Math.sqrt(Math.max(0, 1 - m[6] * m[6])), cph = cth > 0.05 ? m[8] / cth : 1;
      if (cph > 0.5) n0 = clamp(cth / cph, -1, 2);
      else if (cph > 0) n0 = clamp(cth / 0.5, 0, 2) * (cph / 0.5) + m[8] * (1 - cph / 0.5);
    }
    // levye komutu yumuşatılır: bırakınca ya da ani çekişte uçak sıçramaz, yukarı-aşağı sallanmaz
    const uRaw = clamp(c.pitch + c.trim, -1, 1);
    st.u = st.u == null ? uRaw : st.u + (uRaw - st.u) * Math.min(1, dt / 0.3);
    const u = st.u;
    const nHi = gearDn ? F.nMaxGear : F.nMax;
    const nCmd = u >= 0 ? n0 + u * (nHi - n0) : n0 + u * (n0 - F.nMin);
    // istenen g için gereken hücum açısı (kaldırma eğrisinin tersi) + tümlev düzeltmesi
    const CLreq = nCmd * P.mass * G0 / (qbar * P.S);
    const dCLf = P.flapCL * this.surf.flap;
    let aCmd = (CLreq - P.CL0 - dCLf) / P.CLa + st.ia;
    // g sınırlayıcı: gerçek yük sınıra yaklaşınca açı isteği geri çekilir
    if (this.nz > nHi - 0.6) aCmd -= 0.05 * (this.nz - (nHi - 0.6));
    if (this.nz < F.nMin + 0.4) aCmd += 0.05 * ((F.nMin + 0.4) - this.nz);
    const lim = aCmd > aMax || aCmd < F.aMin;
    aCmd = clamp(aCmd, F.aMin, aMax);
    if (!lim) st.ia = clamp(st.ia + (nCmd - this.nz) * 0.06 * dt, -0.1, 0.1);
    // dengedeki yunuslama hızı ve elevatör (ileri besleme) + hücum açısı ve yunuslama hızı geri beslemesi
    const nAt = (P.CL0 + dCLf + P.CLa * aCmd) * qbar * P.S / (P.mass * G0); // bu açıda erişilebilen g
    const nEff = nCmd >= n0 ? Math.min(nCmd, Math.max(nAt, n0)) : Math.max(nCmd, Math.min(nAt, n0));
    const qSS = G0 * (nEff - n0) / V;
    const qh = qSS * P.c / (2 * V);
    const deFF = -(P.Cm0 + P.Cma * aCmd + P.Cmq * qh + P.flapCm * this.surf.flap + P.CLde * 0) / P.Cmde;
    const kS = clamp(30000 / qbar, 0.25, 2.5); // dinamik basınca göre kazanç
    let deCmd = deFF + kS * (1.4 * (alpha - aCmd) + 0.3 * this.alphaDot + 0.55 * (q - qSS) * P.c / (2 * V) * 40);
    deCmd = clamp(deCmd, P.deUp, P.deDown);
    // yuvarlanma: istenen hız, yüksek hücum açısında azalır
    const pCmd = clamp(c.roll, -1, 1) * F.pMax * clamp(1 - (Math.abs(alpha) - 10 * D2R) / (22 * D2R), 0.3, 1);
    const daFF = pCmd * (P.b / (2 * V)) * (-P.Clp) / P.Clda;
    const daCmd = clamp(daFF + 0.25 * kS * (pCmd - p) * P.b / (2 * V) * 8, -P.daMax, P.daMax);
    // dümen: yan kaymayı sil, dönüşü hız eksenine koordine et; pilot pedalı yan kayma ister
    const bCmd = -clamp(c.yaw, -1, 1) * F.betaMax;
    const rCmd = p * Math.tan(clamp(alpha, -0.5, 0.6)) + G0 * (m[7]) / V; // m[7]: yatışta dönüş
    const drCmd = clamp(-1.6 * kS * (beta - bCmd) + 0.9 * kS * (r - rCmd) * P.b / (2 * V) * 6, -P.drMax, P.drMax);
    this.fbwOut = { nCmd, aCmd, pCmd, bCmd };
    return { deCmd, daCmd, drCmd };
  }

  // motor: pervaneli ise devir dinamiği, jet ise türbin devri gecikmesi. Döndürür itki (N)
  _engine(dt, V, atm) {
    const P = this.P, thr = clamp(this.ctl.throttle, 0, 1);
    if (P.kind === 'prop') {
      const n = Math.max(this.rpm / 60, 0.5);
      const nR = P.rpmRated / 60;
      const J = V / (n * P.propD);
      const CT = P.CT0 - P.CTk * J * J;
      const CP = Math.max(0.004, P.CP0 - P.CPk * J * J);
      const sig = atm.sigma;
      const pf = Math.max(0, sig - (1 - sig) / 7.55); // Gagg-Ferrar
      const Peng = this.engineOn ? P.Pmax * (n / nR) * (P.idle + (1 - P.idle) * thr) * pf : 0;
      const Pfr = P.Pfric * (n / nR) * (n / nR) + 150;
      const Pprop = CP * atm.rho * n * n * n * Math.pow(P.propD, 5);
      const om = 2 * Math.PI * n;
      const dOm = (Peng - Pfr - Pprop) / (om * P.propI);
      let rpm = this.rpm + dOm * dt * 60 / (2 * Math.PI);
      if (!this.engineOn && V < 5) rpm *= 1 - dt; // durunca pervane durur
      this.rpm = clamp(rpm, 0, P.rpmMax + 300);
      this.propTorque = Pprop / om;
      this.power = Peng;
      const T = CT * atm.rho * n * n * Math.pow(P.propD, 4);
      return T;
    } else {
      // ard yakıcı (varsa): gaz %90'ın üstünde ek itki, kısa bir gecikmeyle yanar
      const mil = P.Tab ? Math.min(1, thr / 0.9) : thr;
      const target = this.engineOn ? P.idleN + (1 - P.idleN) * mil : 0;
      const k = target > this.spool ? P.spoolUp * (0.35 + this.spool) : P.spoolDown;
      this.spool += (target - this.spool) * Math.min(1, k * dt);
      this.rpm = this.spool * 100; // % N
      const abT = P.Tab && this.engineOn && this.spool > 0.9 ? clamp((thr - 0.9) / 0.1, 0, 1) : 0;
      this.ab = (this.ab || 0) + (abT - (this.ab || 0)) * Math.min(1, dt * 4);
      const M = V / atm.a;
      const ram = P.Tab ? (1 + 0.08 * M + 0.2 * M * M) : (1 - 0.45 * M + 0.3 * M * M);
      const T = (P.Tmax * this.spool * this.spool + (P.Tab ? (P.Tab - P.Tmax) * this.ab : 0)) * Math.pow(atm.sigma, 0.8) * ram;
      this.propTorque = 0; this.power = T * V;
      return T;
    }
  }

  // Bütün kuvvet ve momentler. env: {ground(n,e)->{h, kind}, wind:[n,e,d]}
  // Döndürür: dünya eksenli kuvvet ve gövde eksenli moment.
  forces(dt, env) {
    const P = this.P, m = qmat(this.q, this.m), s = this.surf;
    const wind = env.wind || [0, 0, 0];
    const vAirW = [this.vel[0] - wind[0], this.vel[1] - wind[1], this.vel[2] - wind[2]];
    const vb = mulMT(m, vAirW);
    const V = Math.hypot(vb[0], vb[1], vb[2]);
    const atm = isa(this.alt);
    const qbar = 0.5 * atm.rho * V * V;
    const Vs = Math.max(V, 1);
    const alpha = Math.atan2(vb[2], vb[0]);
    const beta = Math.asin(clamp(vb[1] / Vs, -1, 1));
    const [p, q, r] = this.w;
    // α̇ süzgeçli
    const ad = (alpha - this.alphaPrev) / dt;
    this.alphaDot += (clamp(ad, -3, 3) - this.alphaDot) * Math.min(1, dt * 20);
    this.alphaPrev = alpha;
    const ph = p * P.b / (2 * Vs), qh = q * P.c / (2 * Vs), rh = r * P.b / (2 * Vs), adh = this.alphaDot * P.c / (2 * Vs);
    // yer etkisi (kanadın yerden yüksekliği)
    const g = env.ground(this.pos[0], this.pos[1]);
    const hWing = Math.max(0.3, this.alt - g.h);
    const k16 = 16 * hWing / P.b, phiGE = (k16 * k16) / (1 + k16 * k16);
    const lc = liftCurve(P, alpha, s.flap);
    const sep = lc.s;
    this.stallS = sep;
    let CL = lc.CL * (1 + 0.05 * (1 - phiGE)) + P.CLq * qh + P.CLadot * adh + P.CLde * s.de;
    const AR = P.b * P.b / P.S;
    const K = 1 / (Math.PI * P.e * AR);
    const dCLi = lc.CL - P.CLminD;
    let CD = P.CD0 + P.flapCD * s.flap + K * dCLi * dCLi * phiGE + P.CDbeta * beta * beta
      + 1.25 * Math.sin(alpha) ** 2 * smooth(lc.as - 0.03, lc.as + 0.2, Math.abs(alpha))
      + (P.gearCD || 0) * this.gearPos;
    // sıkıştırılabilirlik (jet için)
    const M = V / atm.a;
    if (P.Mcrit) { if (M > P.Mcrit) CD += P.waveCD * smooth(P.Mcrit, 1.05, M) + 0.06 * Math.max(0, M - 1.1); }
    else if (M > 0.72) CD += 0.6 * (M - 0.72) ** 2 * 10;
    const CY = P.CYb * beta + P.CYdr * s.dr + P.CYp * ph + P.CYr * rh;
    // momentler
    const CLw = lc.CL;
    const Clp = P.Clp * (1 - 1.4 * sep); // tutunma kaybında yuvarlanma sönümü kaybolur
    const Cl = P.Clb * beta + Clp * ph + (CLw / 4) * rh + P.Clda * s.da + P.Cldr * s.dr
      + 0.025 * sep * Math.sign(beta + 0.3 * rh || 1); // kanat düşmesi
    const Cm = P.Cm0 + P.Cma * alpha + P.Cmq * qh + P.Cmadot * adh + P.Cmde * s.de + P.flapCm * s.flap + P.CmStall * sep;
    let Cn = P.Cnb * beta + (-CLw / 8) * ph + P.Cnr * rh + P.Cnda * s.da + P.Cndr * s.dr;
    // fly-by-wire kanatçık-dümen bağlantısı: yatış hız ekseni etrafında olur (yüksek hücum açısında yan kayma birikmez)
    if (P.fbw) {
      Cn += P.Clda * s.da * 0.5 * Math.tan(clamp(alpha, -0.6, 0.6)) * (P.I[2] / P.I[0]);
      // bütün yüzeylerle yön kararlılığı artırımı (oyun için: yan kayma hızla sönümlenir)
      Cn += P.fbw.yawAug * (beta - (this.fbwOut ? this.fbwOut.bCmd : 0));
    }
    // rüzgar ekseninden gövdeye: sürükleme -v yönünde, kaldırma v'ye dik (x-z düzleminde)
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const L = qbar * P.S * CL, D = qbar * P.S * CD, Y = qbar * P.S * CY;
    const vh = V > 0.01 ? [vb[0] / V, vb[1] / V, vb[2] / V] : [1, 0, 0];
    const Fb = [
      -D * vh[0] + L * sa,
      -D * vh[1] + Y,
      -D * vh[2] - L * ca,
    ];
    const Mb = [qbar * P.S * P.b * Cl, qbar * P.S * P.c * Cm, qbar * P.S * P.b * Cn];
    // itki
    const T = this._engine(dt, Math.max(0, vb[0]), atm);
    this.thrust = T;
    Fb[0] += T;
    if (P.kind === 'prop') {
      // pervane torku ve iz akımı; seyirde ayar tırnaklarıyla dengelenir (aerodinamik, hızla orantılı)
      const rig = Math.min(1.3, qbar / 1530);
      Mb[0] -= P.torqueRoll * this.propTorque - P.torqueRig * rig;
      Mb[2] -= P.slipYaw * Math.max(0, T) - P.slipYaw * P.thrustRig * rig;
    }
    // dünya eksenine
    const Fw = mulM(m, Fb);
    Fw[2] += P.mass * G0;
    // iniş takımı ve temaslar
    this._ground(env, m, Fw, Mb, g);
    // çıktılar
    const o = this.out;
    o.V = V; o.alpha = alpha; o.beta = beta; o.qbar = qbar; o.CL = CL; o.CD = CD; o.M = M; o.rho = atm.rho;
    o.L = L; o.D = D; o.T = T; o.ground = g; o.agl = this.alt - g.h;
    this.alpha = alpha; this.beta = beta;
    return { Fw, Mb };
  }

  _ground(env, m, Fw, Mb, gc) {
    const P = this.P;
    this.onGround = false;
    const wb = this.w;
    const contact = (pb, wheelIdx) => {
      // dünya konumu
      const rw = mulM(m, pb);
      const pw = [this.pos[0] + rw[0], this.pos[1] + rw[1], this.pos[2] + rw[2]];
      const g = (Math.abs(rw[0]) + Math.abs(rw[1]) < 3) ? gc : env.ground(pw[0], pw[1]);
      const depth = pw[2] + g.h; // + ise yere girmiş (z aşağı)
      if (depth <= 0) return null;
      // temas noktasının hızı (dünya)
      const vbp = cross(wb, pb);
      const vwp = mulM(m, vbp);
      const vp = [this.vel[0] + vwp[0], this.vel[1] + vwp[1], this.vel[2] + vwp[2]];
      return { rw, pw, g, depth, vp };
    };
    const applyW = (F, c) => {
      Fw[0] += F[0]; Fw[1] += F[1]; Fw[2] += F[2];
      const Fb = mulMT(m, F);
      const rb = mulMT(m, c.rw);
      const Mm = cross(rb, Fb);
      Mb[0] += Mm[0]; Mb[1] += Mm[1]; Mb[2] += Mm[2];
    };
    const gearOk = this.gearPos > 0.98;
    // tekerlekler
    for (let i = 0; i < P.gear.length; i++) {
      const gr = P.gear[i], wst = this.wheel[i];
      wst.contact = false; wst.load = 0;
      if (!gearOk) continue;
      const c = contact(gr.p, i);
      if (!c) { wst.comp = 0; continue; }
      if (c.g.kind === 'water') { this.crash('Suya indiniz'); return; }
      if (c.g.kind === 'building') { this.crash('Binaya çarptınız'); return; }
      const d = Math.min(c.depth, 0.6);
      const vz = c.vp[2]; // + aşağı
      if (vz > 3.6 && !wst.contactPrev) { this.crash('Çok sert iniş (' + Math.round(vz * 196.85) + ' ft/dk)'); return; }
      let Fn = gr.k * d + gr.c * vz;
      if (d > 0.3) Fn += gr.k * 8 * (d - 0.3);
      Fn = Math.max(0, Fn);
      // teker yönü: gövde x ekseni (burun tekerinde direksiyon açısıyla)
      let st = 0;
      if (gr.steer) {
        const V = Math.hypot(this.vel[0], this.vel[1]);
        const lim = P.steerMax * clamp(5 / Math.max(V, 0.1), 0.15, 1); // hızlanınca yumuşar (oynanabilirlik)
        st = clamp(this.ctl.yaw + (this.ctl.autoSteer || 0), -1, 1) * lim;
      }
      const fb = [Math.cos(st), Math.sin(st), 0];
      const fw = mulM(m, fb);
      // yer düzlemine izdüşüm
      fw[2] = 0; const fl = Math.hypot(fw[0], fw[1]) || 1; fw[0] /= fl; fw[1] /= fl;
      const lw = [-fw[1], fw[0], 0];
      const vf = c.vp[0] * fw[0] + c.vp[1] * fw[1];
      const vl = c.vp[0] * lw[0] + c.vp[1] * lw[1];
      const grass = c.g.kind !== 'runway';
      const muR = grass ? 0.06 : 0.02;
      const muB = gr.brake ? (grass ? 0.35 : 0.65) * clamp(this.ctl.brake, 0, 1) : 0;
      const muL = grass ? 0.55 : 0.8;
      const Fl = -muL * Fn * clamp(vl / 0.4, -1, 1);
      const Ff = -(muR + muB) * Fn * clamp(vf / 0.25, -1, 1);
      applyW([fw[0] * Ff + lw[0] * Fl, fw[1] * Ff + lw[1] * Fl, -Fn], c);
      wst.contact = true; wst.load = Fn; wst.comp = d; wst.vz = vz;
      this.onGround = true;
    }
    for (let i = 0; i < this.wheel.length; i++) this.wheel[i].contactPrev = this.wheel[i].contact;
    // gövde temas noktaları
    const hard = gearOk ? P.hard : P.hard.concat(P.gear.map((g) => ({ name: 'gövde (takım kapalı)', p: [g.p[0], g.p[1], g.p[2] * 0.55] })));
    for (const h of hard) {
      const c = contact(h.p);
      if (!c) continue;
      const vn = c.vp[2];
      const vh = Math.hypot(c.vp[0], c.vp[1]);
      if (c.g.kind === 'water' && (vn > 1 || vh > 3)) { this.crash('Denize düştünüz'); return; }
      if (c.g.kind === 'building') { this.crash('Binaya çarptınız'); return; }
      if (h.prop && this.rpm > 300) { this.crash('Pervane yere vurdu'); return; }
      if (vn > (/kuyruk/.test(h.name) ? 7 : 2.5) || (vh > 12 && !/kuyruk/.test(h.name))) { this.crash((h.name === 'gövde' ? 'Gövde' : h.name[0].toUpperCase() + h.name.slice(1)) + ' yere çarptı'); return; }
      const Fn = Math.max(0, 60000 * Math.min(c.depth, 0.5) + 8000 * vn);
      const Fh = 0.5 * Fn;
      const hx = vh > 0.05 ? -c.vp[0] / vh : 0, hy = vh > 0.05 ? -c.vp[1] / vh : 0;
      applyW([hx * Fh * Math.min(1, vh / 0.3), hy * Fh * Math.min(1, vh / 0.3), -Fn], c);
      this.onGround = true;
      this.scrape = (this.scrape || 0) + 1;
    }
  }

  crash(reason) { if (!this.crashed) { this.crashed = reason; } }

  // Bir sabit adım
  step(dt, env) {
    if (this.crashed) return;
    this._surfaces(dt);
    const { Fw, Mb } = this.forces(dt, env);
    if (this.crashed) return;
    const P = this.P;
    const im = 1 / P.mass;
    const acc = [Fw[0] * im, Fw[1] * im, Fw[2] * im];
    this.vel[0] += acc[0] * dt; this.vel[1] += acc[1] * dt; this.vel[2] += acc[2] * dt;
    this.pos[0] += this.vel[0] * dt; this.pos[1] += this.vel[1] * dt; this.pos[2] += this.vel[2] * dt;
    // yük faktörü (gövde -z yönündeki özgül kuvvet / g)
    const ab = mulMT(this.m, [acc[0], acc[1], acc[2] - G0]);
    this.nz = -ab[2] / G0; this.ny = ab[1] / G0;
    // Euler denklemleri
    const I = P.I, w = this.w;
    const Iw = [I[0] * w[0], I[1] * w[1], I[2] * w[2]];
    const wxIw = cross(w, Iw);
    // fly-by-wire: eylemsizlik bağlaşımının (hızlı yatışta burnun kendiliğinden kalkması) çoğu bilgisayarca karşılanır
    if (P.fbw) { const k = P.fbw.couple; wxIw[0] *= k; wxIw[1] *= k; wxIw[2] *= k; }
    w[0] += (Mb[0] - wxIw[0]) / I[0] * dt;
    w[1] += (Mb[1] - wxIw[1]) / I[1] * dt;
    w[2] += (Mb[2] - wxIw[2]) / I[2] * dt;
    for (let i = 0; i < 3; i++) w[i] = clamp(w[i], -8, 8);
    const dq = qmul(this.q, [0, w[0], w[1], w[2]]);
    this.q[0] += 0.5 * dq[0] * dt; this.q[1] += 0.5 * dq[1] * dt; this.q[2] += 0.5 * dq[2] * dt; this.q[3] += 0.5 * dq[3] * dt;
    qnorm(this.q);
    this.time += dt;
    // yapısal sınırlar
    if (!this.onGround) {
      const nl = this.nz;
      if (nl > P.nMax * 1.5 || nl < P.nMin * 1.5) this.crash('Yapısal hasar (' + nl.toFixed(1) + ' g)');
      if (this.out.V > P.Vne * 1.2) this.crash('Azami hız aşıldı, yapı dağıldı');
    }
  }

  // Durumu bir başlangıç koşuluna getir
  place({ n = 0, e = 0, alt = 0, heading = 0, pitch = 0, roll = 0, speed = 0 }) {
    this.pos = [n, e, -alt];
    this.q = eulerToQuat(roll, pitch, heading);
    qmat(this.q, this.m);
    const vb = [speed, 0, 0];
    this.vel = mulM(this.m, vb);
    this.w = [0, 0, 0];
    this.crashed = null;
  }
}

// Sabit adımlı entegratör: değişken kare süresini 240 Hz adımlara böler.
export const DT = 1 / 240;
export function advance(ac, env, frameDt, acc = { t: 0 }) {
  acc.t += Math.min(frameDt, 0.1);
  let n = 0;
  while (acc.t >= DT && n < 48) { ac.step(DT, env); acc.t -= DT; n++; }
  return n;
}

// Kolay kumanda: fly-by-wire'ı olmayan uçaklara da oyun için uçuş bilgisayarı takılır.
// Levye ortadayken uçuş yolu korunur (trim gerekmez), levye ne kadar çekilirse o kadar g / yuvarlanma hızı;
// hücum açısı tutunma kaybının altında tutulur.
export const EASY_FBW = {
  c172: { nMax: 3.5, nMin: -1.5, nMaxGear: 3.5, aMax: 12 * D2R, aMaxGear: 12 * D2R, aMin: -8 * D2R, pMax: 70 * D2R, betaMax: 6 * D2R, yawAug: 0.15, couple: 1, turnComp: true },
  jet: { nMax: 5, nMin: -2.5, nMaxGear: 3, aMax: 12 * D2R, aMaxGear: 11 * D2R, aMin: -8 * D2R, pMax: 160 * D2R, betaMax: 8 * D2R, yawAug: 0.2, couple: 0.6, turnComp: true },
};
export function easyPlane(P) { return P.fbw || !EASY_FBW[P.id] ? P : Object.assign({}, P, { fbw: EASY_FBW[P.id], easy: true }); }

// Düz uçuş dengesi (trim): verilen hız, irtifa ve flapta yatay uçuş için α, elevatör trimi ve gaz.
// opts.noThrust: gaz yerine uçuş yolu açısını çözer (gücü kapalı süzülme). Döndürür {alpha, trim, throttle, gamma, ok}
export function trimLevel(P, V, alt, flaps = 0, opts = {}) {
  const ac = new Aircraft(P);
  const env = { ground: () => ({ h: -1e5, kind: 'land' }), wind: [0, 0, 0] };
  ac.surf.flap = flaps; ac.ctl.flaps = flaps;
  if (opts.gearUp) { ac.gearPos = 0; ac.ctl.gearDown = false; }
  const gamma0 = opts.gamma || 0;
  const evalR = (x) => {
    const [a, tr, third] = x;
    const gam = opts.noThrust ? third : gamma0;
    const th = opts.noThrust ? 0 : third;
    ac.place({ alt, pitch: a + gam, speed: 0 });
    ac.vel = [V * Math.cos(gam), 0, -V * Math.sin(gam)];
    ac.ctl.trim = tr; ac.ctl.pitch = 0; ac.ctl.throttle = th;
    const pitchCmd = clamp(tr, -1, 1);
    ac.surf.de = pitchCmd >= 0 ? pitchCmd * P.deUp : -pitchCmd * P.deDown;
    ac.alphaPrev = a; ac.alphaDot = 0;
    // motoru dengeye getir
    if (P.kind === 'prop') {
      ac.rpm = 2000;
      for (let i = 0; i < 4000; i++) { ac._engine(0.01, V * Math.cos(a), isa(alt)); }
    } else { const tc = clamp(th, 0, 1); ac.spool = P.idleN + (1 - P.idleN) * (P.Tab ? Math.min(1, tc / 0.9) : tc); ac.ab = P.Tab ? clamp((tc - 0.9) / 0.1, 0, 1) : 0; }
    const { Fw, Mb } = ac.forces(1e-3, env);
    ac.alphaDot = 0;
    const Fb = mulMT(ac.m, Fw);
    return [Fb[0] / (P.mass * G0), Fb[2] / (P.mass * G0), Mb[1] / (0.5 * 1.225 * V * V * P.S * P.c)];
  };
  let x = [0.05, 0.1, opts.noThrust ? -0.05 : 0.5];
  let ok = false;
  for (let it = 0; it < 60; it++) {
    const f0 = evalR(x);
    const err = Math.abs(f0[0]) + Math.abs(f0[1]) + Math.abs(f0[2]);
    if (err < 1e-6) { ok = true; break; }
    const J = [];
    for (let j = 0; j < 3; j++) {
      const xh = x.slice(); const h = 1e-4; xh[j] += h;
      const f1 = evalR(xh);
      J.push([(f1[0] - f0[0]) / h, (f1[1] - f0[1]) / h, (f1[2] - f0[2]) / h]);
    }
    // J sütunları: J[j][i] = dfi/dxj  -> çöz A dx = -f
    const A = [[J[0][0], J[1][0], J[2][0]], [J[0][1], J[1][1], J[2][1]], [J[0][2], J[1][2], J[2][2]]];
    const dx = solve3(A, [-f0[0], -f0[1], -f0[2]]);
    if (!dx) break;
    const lim = 0.2;
    for (let j = 0; j < 3; j++) x[j] += clamp(dx[j], -lim, lim);
  }
  const r = { alpha: x[0], trim: x[1], ok };
  if (opts.noThrust) { r.gamma = x[2]; r.throttle = 0; } else { r.throttle = x[2]; r.gamma = gamma0; }
  r.ok = r.ok && (opts.noThrust || (r.throttle >= -0.001 && r.throttle <= 1.001)) && Math.abs(r.trim) <= 1;
  r.rpm = ac.rpm;
  return r;
}
function solve3(A, b) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A); if (Math.abs(d) < 1e-12) return null;
  const r = [];
  for (let j = 0; j < 3; j++) { const M = A.map((row, i) => row.map((v, k) => (k === j ? b[i] : v))); r.push(det(M) / d); }
  return r;
}

// Uçuşu dengeli bir durumda başlat (havada başlama için)
export function startTrimmed(ac, { n, e, alt, heading, speed, flaps = 0, gearUp = false }) {
  const t = trimLevel(ac.P, speed, alt, flaps, { gearUp });
  ac.reset();
  ac.place({ n, e, alt, heading, pitch: t.alpha, speed: 0 });
  const ch = Math.cos(heading), sh = Math.sin(heading);
  ac.vel = [speed * ch, speed * sh, 0];
  ac.ctl.trim = t.trim; ac.ctl.throttle = clamp(t.throttle, 0, 1); ac.ctl.flaps = flaps; ac.surf.flap = flaps;
  const pc = clamp(t.trim, -1, 1); ac.surf.de = pc >= 0 ? pc * ac.P.deUp : -pc * ac.P.deDown;
  ac.alphaPrev = t.alpha;
  if (ac.P.kind === 'prop') ac.rpm = t.rpm; else { const tc = ac.ctl.throttle; ac.spool = ac.P.idleN + (1 - ac.P.idleN) * (ac.P.Tab ? Math.min(1, tc / 0.9) : tc); ac.ab = ac.P.Tab ? clamp((tc - 0.9) / 0.1, 0, 1) : 0; }
  if (ac.P.fbw) ac.ctl.trim = 0; // fly-by-wire uçuş yolunu kendisi tutar
  ac.gearPos = gearUp ? 0 : 1; ac.ctl.gearDown = !gearUp;
  return t;
}
