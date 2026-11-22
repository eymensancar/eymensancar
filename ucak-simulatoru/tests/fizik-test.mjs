// Fizik denetimi: node tests/fizik-test.mjs
// Uçuş modelini oyundan bağımsız çalıştırır, gerçek uçak değerleriyle karşılaştırır.
// Her sınama bir aralık bekler; dışında kalan varsa çıkış kodu 1 olur.
import { PLANES, Aircraft, trimLevel, startTrimmed, liftCurve, quatToEuler, isa, KT, FT, DT } from '../www/js/fdm.js';

const R2D = 180 / Math.PI;
const AIR = { ground: () => ({ h: -1e5, kind: 'land' }), wind: [0, 0, 0] };
const RUNWAY = { ground: () => ({ h: 0, kind: 'runway' }), wind: [0, 0, 0] };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const eas = (ac) => ac.out.V * Math.sqrt(isa(ac.alt).sigma) / KT; // gösterge hızı yaklaşığı (kt)

const results = [];
let fail = 0;
function report(plane, name, value, unit, lo, hi, real) {
  const ok = value >= lo && value <= hi;
  if (!ok) fail++;
  results.push({ plane, name, value, unit, lo, hi, real, ok });
}

// Basit otopilot: irtifa/dikey hız tutma (elevatör), yatış tutma (kanatçık), yan kayma sıfırlama (dümen)
function autopilot(ac, st, tgt, dt) {
  const e = quatToEuler(ac.q);
  const vs = -ac.vel[2];
  if (tgt.speed != null) {
    // hızı burun açısıyla tut: dış döngü hız hatasından hedef yunuslama açısı, iç döngü açıdan elevatör
    const err = tgt.speed - ac.out.V;
    st.th = clamp((st.th ?? e.theta) - err * dt * 0.004, -0.3, 0.4);
    const thCmd = st.th - 0.01 * err;
    const pe = thCmd - e.theta;
    st.ip = clamp((st.ip ?? 0) + pe * dt * 1.0, -1, 1);
    ac.ctl.pitch = clamp(2.5 * pe + st.ip - 0.6 * ac.w[1], -1, 1);
  } else if (tgt.vs != null) {
    const vsCmd = tgt.alt != null ? clamp((tgt.alt - ac.alt) * 0.2, -5, 5) + tgt.vs : tgt.vs;
    const err = vsCmd - vs;
    st.i = clamp((st.i || 0) + err * dt * 0.03, -1, 1);
    ac.ctl.pitch = clamp(0.05 * err + st.i - 0.4 * ac.w[1], -1, 1);
  }
  if (tgt.bank != null) {
    const err = tgt.bank - e.phi;
    ac.ctl.roll = clamp(2.0 * err - 0.6 * ac.w[0], -1, 1);
  }
  if (tgt.coord) ac.ctl.yaw = clamp(6 * ac.out.beta - 0.5 * ac.w[2] * 0 , -1, 1);
  if (tgt.spd != null) {
    const err = tgt.spd - ac.out.V;
    st.ti = clamp((st.ti || 0) + err * dt * 0.02, 0, 1);
    ac.ctl.throttle = clamp(st.ti + 0.08 * err, 0, 1);
  }
}

function run(ac, env, secs, fn) { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { if (fn) fn(i * DT); ac.step(DT, env); if (ac.crashed) break; } }

function testPlane(key, exp) {
  const P = PLANES[key];
  const ac = new Aircraft(P);

  // 1. Düz uçuş dengesi, sonra 60 sn eller serbest
  const Vt = exp.cruise * KT;
  const t = startTrimmed(ac, { n: 0, e: 0, alt: 600, heading: 0, speed: Vt, gearUp: P.retract });
  run(ac, AIR, 60);
  report(key, `${exp.cruise} kt dengede: 60 sn sonra irtifa farkı`, ac.alt - 600, 'm', -25, 25);
  report(key, `${exp.cruise} kt dengede: 60 sn sonra hız farkı`, (ac.out.V - Vt) / KT, 'kt', -4, 4);
  report(key, `${exp.cruise} kt dengede: hücum açısı`, t.alpha * R2D, '°', -2, 6);
  report(key, `${exp.cruise} kt dengede: gaz`, t.throttle * 100, '%', 30, 95);
  if (P.kind === 'prop') report(key, `${exp.cruise} kt dengede: devir`, t.rpm, 'rpm', 2100, 2500, '~2300');

  // 2. Durum hızı (statik): kaldırma = ağırlık, elevatör dengesiyle, en düşük hız
  for (const [flap, lab, lo, hi, real] of exp.stall) {
    let vmin = null;
    for (let v = 30; v < 160; v += 0.25) {
      const tr = trimLevel(P, v * KT, 100, flap, { noThrust: true });
      const lc = liftCurve(P, tr.alpha, flap);
      if (tr.ok && tr.alpha < lc.as && Math.abs(tr.trim) < 1) { vmin = v; break; }
    }
    report(key, `Durum hızı ${lab} (1g, statik)`, vmin, 'kt', lo, hi, real);
    // dinamik: gaz rölantide, irtifa tutarak yavaşla (~1 kt/sn), tutunma kaybını bekle
    const a2 = new Aircraft(P);
    startTrimmed(a2, { n: 0, e: 0, alt: 1500, heading: 0, speed: (vmin + 25) * KT, flaps: flap });
    a2.ctl.throttle = 0;
    let stallV = null; const st = {};
    run(a2, AIR, 120, () => {
      if (stallV) return;
      // her saniye 1 kt yavaşlayacak şekilde burun yukarı
      const e = quatToEuler(a2.q);
      const vs = -a2.vel[2];
      st.i = clamp((st.i || 0) + (0 - vs) * DT * 0.02 + 0.0004 * DT * 60, -1, 1);
      a2.ctl.pitch = clamp(st.i + 0.04 * (0 - vs) - 0.4 * a2.w[1], -1, 1);
      a2.ctl.roll = clamp(-2 * e.phi - 0.5 * a2.w[0], -1, 1);
      if (a2.stallS > 0.05) stallV = eas(a2);
    });
    report(key, `Durum hızı ${lab} (yavaşlayarak, uyarı anı)`, stallV || 0, 'kt', lo - 3, hi + 3, real);
  }

  // 3. Kalkış koşusu: pist, tam gaz, rotasyon hızında levyeyi çek
  {
    const a = new Aircraft(P);
    const h0 = P.gear[1].p[2] - 0.05;
    a.place({ alt: h0, heading: 0, pitch: Math.atan2(P.gear[0].p[2] - P.gear[1].p[2], P.gear[0].p[0] - P.gear[1].p[0]) * 0 });
    a.ctl.flaps = exp.toFlap; a.surf.flap = exp.toFlap; a.ctl.brake = 1;
    if (P.kind === 'prop') a.rpm = 700;
    run(a, RUNWAY, 4);
    a.ctl.brake = 0; a.ctl.throttle = 1;
    const x0 = a.pos[0];
    let lift = null, d50 = null, tLift = null; let t0 = a.time; const st = {};
    run(a, RUNWAY, 60, () => {
      const kias = eas(a);
      const e = quatToEuler(a.q);
      if (kias > exp.vr) { a.ctl.pitch = clamp((exp.toPitch * Math.PI / 180 - e.theta) * 3 - 0.5 * a.w[1], -1, 1); }
      a.ctl.roll = clamp(-2 * e.phi - 0.5 * a.w[0], -1, 1);
      a.ctl.yaw = clamp(-3 * e.psi - 1 * a.w[2] + 4 * a.out.beta * (a.onGround ? 0 : 1), -1, 1);
      if (!lift && !a.wheel.some((w) => w.contact) && a.alt > h0 + 0.5) { lift = a.pos[0] - x0; tLift = a.time - t0; }
      if (!d50 && a.alt > 15.24) d50 = a.pos[0] - x0;
    });
    report(key, 'Kalkış koşusu (teker kesme)', lift || 0, 'm', exp.roll[0], exp.roll[1], exp.roll[2]);
    report(key, 'Kalkış: 50 ft engel aşma mesafesi', d50 || 0, 'm', exp.roll50[0], exp.roll50[1], exp.roll50[2]);
    report(key, 'Kalkış koşusu süresi', tLift || 0, 'sn', 5, 40);
    if (a.crashed) report(key, 'Kalkışta kaza: ' + a.crashed, 1, '', 0, 0);
  }

  // 4. Koordineli dönüş: 30° yatış, irtifa ve hız tutarak 90 sn
  {
    const a = new Aircraft(P);
    startTrimmed(a, { n: 0, e: 0, alt: 800, heading: 0, speed: Vt });
    const st = {}; let maxBeta = 0; let psiPrev = 0, turned = 0;
    run(a, AIR, 90, (tt) => {
      autopilot(a, st, { vs: 0, alt: 800, bank: 30 / R2D, coord: true, spd: Vt }, DT);
      const e = quatToEuler(a.q);
      let d = e.psi - psiPrev; if (d < -Math.PI) d += 2 * Math.PI; if (d > Math.PI) d -= 2 * Math.PI;
      if (tt > 20) { turned += d; maxBeta = Math.max(maxBeta, Math.abs(a.out.beta)); }
      psiPrev = e.psi;
    });
    const rate = turned / 70 * R2D;
    const ideal = 9.80665 * Math.tan(30 / R2D) / Vt * R2D;
    report(key, `30° yatışlı dönüş: dönüş hızı (ideal ${ideal.toFixed(2)}°/sn)`, rate, '°/sn', ideal * 0.9, ideal * 1.1);
    report(key, '30° yatışlı dönüş: yük faktörü', a.nz, 'g', 1.1, 1.2, '1.155');
    report(key, '30° yatışlı dönüş: en büyük yan kayma', maxBeta * R2D, '°', 0, 2);
    report(key, '30° yatışlı dönüş: irtifa farkı', a.alt - 800, 'm', -15, 15);
  }

  // 5. Azami düz uçuş hızı (deniz seviyesi ve 2500 m), tam gaz
  for (const alt of exp.vmaxAlts) {
    let vmax = 0;
    for (let v = 60; v < 600; v += 1) { const tr = trimLevel(P, v * KT, alt, 0, { gearUp: P.retract }); if (tr.ok) vmax = v; else if (vmax) break; }
    const e = exp.vmax[alt];
    report(key, `Azami düz uçuş hızı ${alt} m (gerçek hız)`, vmax, 'kt', e[0], e[1], e[2]);
  }

  // 6. Tırmanma: tam gaz, Vy
  {
    const a = new Aircraft(P);
    startTrimmed(a, { n: 0, e: 0, alt: 200, heading: 0, speed: exp.vy * KT, gearUp: P.retract });
    a.ctl.throttle = 1; const st = {};
    let h0 = 0;
    run(a, AIR, 60, (tt) => {
      autopilot(a, st, { speed: exp.vy * KT, bank: 0 }, DT);
      if (Math.abs(tt - 20) < DT / 2) h0 = a.alt;
    });
    const roc = (a.alt - h0) / 40 / FT * 60;
    report(key, `Tırmanma oranı (tam gaz, ${exp.vy} kt, ~300 m)`, roc, 'ft/dk', exp.roc[0], exp.roc[1], exp.roc[2]);
  }

  // 7. Süzülme: gaz rölanti, en iyi süzülme hızı
  if (exp.glide) {
    // gaz rölantide (pervane yel değirmeni gibi sürükleme yapar), hız elevatörle tutulur
    const a = new Aircraft(P);
    startTrimmed(a, { n: 0, e: 0, alt: 1500, heading: 0, speed: exp.glide[0] * KT });
    a.ctl.throttle = 0; const st = {}; let h0 = 0, x0 = 0;
    run(a, AIR, 80, (tt) => {
      autopilot(a, st, { speed: exp.glide[0] * KT, bank: 0 }, DT);
      if (Math.abs(tt - 30) < DT / 2) { h0 = a.alt; x0 = a.pos[0]; }
    });
    const ratio = (a.pos[0] - x0) / (h0 - a.alt);
    report(key, `Süzülme oranı (${exp.glide[0]} kt, gaz rölanti)`, ratio, ':1', exp.glide[1], exp.glide[2], exp.glide[3]);
  }

  // 8. Yuvarlanma hızı: tam kanatçık
  {
    const a = new Aircraft(P);
    startTrimmed(a, { n: 0, e: 0, alt: 1000, heading: 0, speed: Vt });
    a.ctl.roll = 1; let pmax = 0;
    run(a, AIR, 2, () => { pmax = Math.max(pmax, a.w[0]); });
    report(key, `Tam kanatçıkla yuvarlanma hızı (${exp.cruise} kt)`, pmax * R2D, '°/sn', exp.rollRate[0], exp.rollRate[1]);
  }

  // 9. Kısa periyot ve fugoid: elevatör darbesi, sonra serbest
  {
    const a = new Aircraft(P);
    startTrimmed(a, { n: 0, e: 0, alt: 1500, heading: 0, speed: Vt });
    a.ctl.pitch = 0.15;
    run(a, AIR, 1);
    a.ctl.pitch = 0;
    const mx = [0, 0], mn = [1e9, 1e9];
    run(a, AIR, 160, (tt) => { const k = tt < 80 ? 0 : 1; mx[k] = Math.max(mx[k], a.alt); mn[k] = Math.min(mn[k], a.alt); });
    report(key, 'Elevatör darbesi: ilk 80 sn irtifa salınımı (yarı genlik)', (mx[0] - mn[0]) / 2, 'm', 0, 300);
    report(key, 'Fugoid sönümü: sonraki 80 sn genlik / ilk 80 sn genlik', (mx[1] - mn[1]) / (mx[0] - mn[0]), '', 0, 0.9);
    if (a.crashed) report(key, 'Fugoid testinde kaza', 1, '', 0, 0);
  }

  // 10. İniş darbesi: 2 m/s ile dokunma kaza saymaz, 5 m/s sayar
  for (const [vz, should] of [[2, false], [5, true]]) {
    const a = new Aircraft(P);
    a.place({ alt: P.gear[1].p[2] + 0.3, heading: 0, pitch: 4 / R2D });
    a.vel = [30, 0, vz];
    run(a, RUNWAY, 3);
    report(key, `${vz} m/s dikey hızla dokunma ${should ? 'kaza' : 'kaza değil'}`, (!!a.crashed === should) ? 1 : 0, '', 1, 1);
  }
}

testPlane('c172', {
  cruise: 100, toFlap: 1 / 3, vr: 51, toPitch: 8, vy: 74,
  stall: [[0, 'flapsız', 44, 52, 'POH: 48 KIAS (1043 kg)'], [1, 'tam flap', 36, 44, 'POH: 40 KIAS']],
  roll: [220, 380, 'POH: ~293 m (960 ft, 1043 kg)'], roll50: [420, 650, 'POH: ~512 m (1685 ft)'],
  vmaxAlts: [0, 2500], vmax: { 0: [114, 128, 'POH: ~123 kt'], 2500: [112, 130, 'POH: ~124 kt (8000 ft)'] },
  roc: [650, 900, 'POH: 730 ft/dk (SL, 1043 kg)'], glide: [68, 8, 11, 'POH: ~9:1'], rollRate: [40, 100],
});
testPlane('jet', {
  cruise: 300, toFlap: 0.57, vr: 105, toPitch: 9, vy: 220,
  stall: [[0, 'flapsız', 95, 115, 'L-39: ~100 kt'], [1, 'tam flap', 80, 98, 'L-39: ~90 kt']],
  roll: [450, 900, 'L-39: ~530 m'], roll50: [700, 1500, ''],
  vmaxAlts: [0], vmax: { 0: [370, 420, 'L-39: ~380-405 kt'] },
  roc: [3000, 5500, 'L-39: ~4130 ft/dk'], rollRate: [80, 250],
});

const pad = (s, n) => String(s).padEnd(n);
let cur = '';
for (const r of results) {
  if (r.plane !== cur) { cur = r.plane; console.log('\n== ' + PLANES[cur].name); }
  const v = typeof r.value === 'number' ? (Math.abs(r.value) >= 100 ? r.value.toFixed(0) : r.value.toFixed(2)) : r.value;
  console.log(`${r.ok ? 'GEÇTİ ' : 'KALDI '} ${pad(r.name, 58)} ${pad(v + ' ' + r.unit, 14)} [${r.lo}..${r.hi}]${r.real ? '  ' + r.real : ''}`);
}
console.log(fail ? `\n${fail} sınama kaldı` : '\nBütün sınamalar geçti');
process.exit(fail ? 1 : 0);
