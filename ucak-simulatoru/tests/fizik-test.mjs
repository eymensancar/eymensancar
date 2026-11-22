// Fizik denetimi: node tests/fizik-test.mjs
// Uçuş modelini oyundan bağımsız çalıştırır, gerçek uçak değerleriyle karşılaştırır.
// Her sınama bir aralık bekler; dışında kalan varsa çıkış kodu 1 olur.
import { PLANES, Aircraft, easyPlane, advance, trimLevel, startTrimmed, liftCurve, quatToEuler, isa, KT, FT, DT } from '../www/js/fdm.js';

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

// ---------- F-16 sınıfı: fly-by-wire akrobasi sınamaları ----------
function testF16() {
  const key = 'f16', P = PLANES.f16;
  const fwdAng = (ac) => { const q = ac.q; const m = [1 - 2 * (q[2] * q[2] + q[3] * q[3]), 2 * (q[1] * q[2] + q[0] * q[3]), 2 * (q[1] * q[3] - q[0] * q[2])]; return Math.atan2(-m[2], m[0]); };
  const mk = (kt, alt) => { const a = new Aircraft(P); startTrimmed(a, { n: 0, e: 0, alt, heading: 0, speed: kt * KT, gearUp: true }); return a; };
  const watch = (a) => ({ amax: 0, smax: 0, bmax: 0, nmax: -9, nmin: 9, tick() { this.amax = Math.max(this.amax, a.out.alpha); this.smax = Math.max(this.smax, a.stallS); this.bmax = Math.max(this.bmax, Math.abs(a.out.beta)); this.nmax = Math.max(this.nmax, a.nz); this.nmin = Math.min(this.nmin, a.nz); } });
  // 1. eller serbest denge
  { const a = mk(350, 3000); run(a, AIR, 60); report(key, '350 kt dengede 60 sn eller serbest: irtifa farkı', a.alt - 3000, 'm', -60, 60); report(key, '350 kt dengede 60 sn: hız farkı', (a.out.V - 350 * KT) / KT, 'kt', -10, 10); }
  // 2. yuvarlanma hızı
  { const a = mk(350, 3000); let pm = 0; a.ctl.roll = 1; run(a, AIR, 3, () => { pm = Math.max(pm, a.w[0]); }); report(key, 'Tam levyeyle yuvarlanma hızı (350 kt)', pm * R2D, '°/sn', 220, 280, 'F-16: ~240-300°/sn'); if (a.crashed) report(key, 'Yuvarlanmada kaza', 1, '', 0, 0); }
  // 3. takla (loop): 420 kt, ard yakıcı, levye %80 geri; tam tur, ufka dönüş
  { const a = mk(420, 2000); a.ctl.throttle = 1; a.ctl.pitch = 0.8; const w = watch(a); let acc = 0, prev = fwdAng(a), done = null;
    run(a, AIR, 40, (tt) => { w.tick(); const g = fwdAng(a); let d = g - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; acc += d; prev = g; if (!done && acc >= 2 * Math.PI) { done = tt; a.ctl.pitch = 0; } });
    report(key, 'Takla: tam tur süresi', done || 99, 'sn', 8, 30);
    report(key, 'Takla: en büyük hücum açısı', w.amax * R2D, '°', 10, 28);
    report(key, 'Takla: tutunma kaybı (0 = yok)', w.smax, '', 0, 0.02);
    report(key, 'Takla: en büyük yük faktörü', w.nmax, 'g', 5, 9.8);
    if (a.crashed) report(key, 'Taklada kaza: ' + a.crashed, 1, '', 0, 0); }
  // 4. düşük hızda levye tam geri: hücum açısı sınırı, tutunma kaybı ve vril yok; bırakınca toparlanır
  for (const kt of [160, 220]) { const a = mk(kt, 5000); a.ctl.throttle = 0.4; a.ctl.pitch = 1; const w = watch(a);
    run(a, AIR, 25, () => w.tick());
    report(key, `${kt} kt levye tam geri 25 sn: en büyük hücum açısı`, w.amax * R2D, '°', 15, 29, 'sınır 25°');
    report(key, `${kt} kt levye tam geri: tutunma kaybı (0 = yok)`, w.smax, '', 0, 0.02);
    report(key, `${kt} kt levye tam geri: en büyük yan kayma`, w.bmax * R2D, '°', 0, 5);
    a.ctl.pitch = 0; a.ctl.throttle = 1; run(a, AIR, 20);
    report(key, `${kt} kt: bıraktıktan 20 sn sonra hız`, eas(a), 'kt', 200, 700); if (a.crashed) report(key, 'Düşük hız denemesinde kaza: ' + a.crashed, 1, '', 0, 0); }
  // 5. çekerken tam yatış (dönerek tırmanma): bağlaşım ve yan kayma sınırlı
  { const a = mk(300, 4000); a.ctl.throttle = 1; a.ctl.pitch = 1; a.ctl.roll = 1; const w = watch(a); run(a, AIR, 15, () => w.tick());
    report(key, 'Çekerek yatış 15 sn: en büyük hücum açısı', w.amax * R2D, '°', 10, 30); report(key, 'Çekerek yatış: en büyük yan kayma', w.bmax * R2D, '°', 0, 12);
    report(key, 'Çekerek yatış: tutunma kaybı (0 = yok)', w.smax, '', 0, 0.05); if (a.crashed) report(key, 'Çekerek yatışta kaza: ' + a.crashed, 1, '', 0, 0); }
  // 6. ters uçuş: yarım tur yatış, levye ortada 20 sn
  { const a = mk(350, 3000); a.ctl.roll = 1; run(a, AIR, 0.75); a.ctl.roll = 0; run(a, AIR, 2); const h0 = a.alt; run(a, AIR, 20); const e = quatToEuler(a.q);
    report(key, 'Ters uçuş 20 sn levye ortada: irtifa farkı', a.alt - h0, 'm', -150, 150); report(key, 'Ters uçuş: yatış açısı (mutlak)', Math.abs(e.phi) * R2D, '°', 150, 180); }
  // 7. 9 g sınırı: 520 kt tam geri. (23 Kasım: yeni yunuslama yasası hücum açısını aşmadan sürer; 450 kt / 3000 m'de 25°'de
  //    erişilebilen yük ~8.1 g, eski yasa 9.7 g'ye aşarak çıkıyordu. Sınırın kendisi 520 kt'ta sınanır.)
  { const a = mk(520, 3000); a.ctl.throttle = 1; a.ctl.pitch = 1; const w = watch(a); run(a, AIR, 6, () => w.tick());
    report(key, '520 kt levye tam geri: en büyük yük faktörü', w.nmax, 'g', 8.3, 9.9, 'sınır 9 g'); if (a.crashed) report(key, '9 g denemesinde kaza: ' + a.crashed, 1, '', 0, 0); }
  // 8. ters takla (split-S): ters dön, çek; baş 180° değişir
  { const a = mk(300, 3000); a.ctl.throttle = 0.3; a.ctl.roll = 1; run(a, AIR, 0.75); a.ctl.roll = 0; run(a, AIR, 1); a.ctl.pitch = 0.9; let done = false; const h0 = a.alt;
    run(a, AIR, 25, () => { const e = quatToEuler(a.q); if (!done && Math.abs(e.phi) < 0.5 && Math.abs(e.theta) < 0.1 && a.time > 3) { done = true; a.ctl.pitch = 0; } });
    const e = quatToEuler(a.q);
    report(key, 'Ters takla (split-S): yeni baş (180 beklenir)', ((e.psi * R2D) + 360) % 360, '°', 160, 200); report(key, 'Ters takla: irtifa kaybı', h0 - a.alt, 'm', 200, 2500); if (a.crashed) report(key, 'Ters taklada kaza: ' + a.crashed, 1, '', 0, 0); }
  // 9. kalkış: ard yakıcı, 150 kt'da döndürme
  { const a = new Aircraft(P); const h0 = P.gear[1].p[2] - 0.05; a.place({ alt: h0, heading: 0 }); a.ctl.brake = 1; run(a, RUNWAY, 3); a.ctl.brake = 0; a.ctl.throttle = 1;
    const x0 = a.pos[0]; let lift = null;
    run(a, RUNWAY, 40, () => { const e = quatToEuler(a.q); if (eas(a) > 150) a.ctl.pitch = clamp((10 / R2D - e.theta) * 3 - 0.5 * a.w[1], -1, 1); a.ctl.yaw = clamp(-3 * e.psi - a.w[2], -1, 1);
      if (!lift && !a.wheel.some((w) => w.contact) && a.alt > h0 + 0.5) lift = a.pos[0] - x0; });
    report(key, 'Kalkış koşusu (ard yakıcı, teker kesme)', lift || 0, 'm', 350, 1000, 'F-16: ~450-600 m'); if (a.crashed) report(key, 'Kalkışta kaza: ' + a.crashed, 1, '', 0, 0); }
  // 10. azami hız
  { let vmax = 0; for (let v = 300; v < 1100; v += 5) { const tr = trimLevel(P, v * KT, 0, 0, { gearUp: true }); if (tr.ok) vmax = v; }
    report(key, 'Azami düz uçuş hızı deniz seviyesi (ard yakıcı)', vmax, 'kt', 700, 860, 'F-16: ~M1.2 (~790 kt)'); }
  // 11. yaklaşma: takım ve flap açık, 150 kt dengede
  { const a = new Aircraft(P); startTrimmed(a, { n: 0, e: 0, alt: 500, heading: 0, speed: 150 * KT, flaps: 1 }); run(a, AIR, 30);
    report(key, '150 kt yaklaşma (takım, flap) 30 sn: irtifa farkı', a.alt - 500, 'm', -40, 40); report(key, '150 kt yaklaşma: hücum açısı', a.out.alpha * R2D, '°', 6, 15, 'F-16: 11-13°'); }
  for (const [vz, should] of [[2, false], [5, true]]) {
    const a = new Aircraft(P); a.place({ alt: P.gear[1].p[2] + 0.3, heading: 0, pitch: 8 / R2D }); a.vel = [75, 0, vz]; run(a, RUNWAY, 3);
    report(key, `${vz} m/s dikey hızla dokunma ${should ? 'kaza' : 'kaza değil'}`, (!!a.crashed === should) ? 1 : 0, '', 1, 1);
  }
}
testF16();

// ---------- kolay kumanda (oyundaki varsayılan): akrobasi, dalıştan çıkış, salınım, iniş ----------
// Oyundaki kare döngüsü taklit edilir (main.js): 60 kare/sn, kanat dengeleyici, hıza göre flap. Yön tuşu rampası: %35'ten %100'e 1,2 sn.
function testEasy() {
  const key = 'easy', D2R = Math.PI / 180;
  const REF = { c172: 55, jet: 110, f16: 140 };
  const ramp = (t) => Math.min(1, 0.35 + 0.65 * t / 1.2);
  const fwdAng = (ac) => { const q = ac.q; const m = [1 - 2 * (q[2] * q[2] + q[3] * q[3]), 2 * (q[1] * q[2] + q[0] * q[3]), 2 * (q[1] * q[3] - q[0] * q[2])]; return Math.atan2(-m[2], m[0]); };
  function game(ac, env, secs, pitchFn, cb, thr = 1) {
    const fixed = { t: 0 }; let t = 0;
    while (t < secs && !ac.crashed) {
      ac.ctl.pitch = pitchFn(t); ac.ctl.roll = 0;
      if (!ac.onGround && !(ac.out.alpha > 0.22)) { const e = quatToEuler(ac.q); if (Math.abs(e.phi) < 1.2 && Math.abs(e.theta) < 1.0) ac.ctl.roll = clamp(-3 * e.phi - 0.4 * ac.w[0], -0.5, 0.5); }
      const P = ac.P, n = P.flapDetents.length - 1, v = ac.out.V / KT / REF[P.id];
      ac.ctl.flaps = P.flapDetents[ac.onGround ? Math.min(1, n) : v < 1.2 ? n : v < 1.45 ? Math.max(1, n - 1) : v < 1.75 ? Math.min(1, n) : 0] / P.flapDetents[n];
      ac.ctl.throttle = thr; ac.ctl.trim = 0;
      advance(ac, env, 1 / 60, fixed); t += 1 / 60; if (cb) cb(t);
    }
  }
  const mk = (id, kt, alt, att = {}, gearUp = true) => { const a = new Aircraft(easyPlane(PLANES[id])); startTrimmed(a, { n: 0, e: 0, alt, heading: 0, speed: kt * KT, gearUp });
    if (att.pitch != null || att.roll != null) { a.place({ n: 0, e: 0, alt, heading: 0, pitch: att.pitch || 0, roll: att.roll || 0, speed: kt * KT }); a.spool = 0.9; } return a; };
  // 1. takla: yön tuşu rampasıyla (ve sabit %35 ile), tam tur
  for (const [kt, inp, lab] of [[300, ramp, 'yön tuşu'], [380, ramp, 'yön tuşu'], [450, ramp, 'yön tuşu'], [300, () => 0.35, 'sabit %35']]) {
    const a = mk('f16', kt, 3000); let acc = 0, prev = fwdAng(a), done = null, amax = 0, smax = 0, hmax = a.alt, h0 = a.alt;
    game(a, AIR, 40, (t) => (done ? 0 : inp(t)), (t) => { const g = fwdAng(a); let d = g - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; acc += d; prev = g;
      if (!done && acc >= 2 * Math.PI) done = t; if (!done) { amax = Math.max(amax, a.out.alpha); smax = Math.max(smax, a.stallS); hmax = Math.max(hmax, a.alt); } });
    report(key, `F-16 takla ${kt} kt (${lab}): tam tur süresi`, done || 99, 'sn', 8, lab === 'sabit %35' ? 26 : 22);
    report(key, `F-16 takla ${kt} kt (${lab}): tırmanılan yükseklik`, hmax - h0, 'm', 300, 1100);
    report(key, `F-16 takla ${kt} kt (${lab}): en büyük hücum açısı / tutunma kaybı`, amax * R2D + smax * 100, '°', 15, 30);
    if (a.crashed) report(key, 'Taklada kaza: ' + a.crashed, 1, '', 0, 0);
  }
  // 2. dik dalıştan çıkış: burun tam aşağı, tam yukarı tuşu; uçuş yolu yataya gelince irtifa kaybı
  for (const [kt, thr] of [[250, 1], [300, 1], [300, 0.3], [400, 1]]) {
    const a = mk('f16', kt, 5000, { pitch: -89.5 * D2R }); const h0 = a.alt; let rec = null, smax = 0;
    game(a, AIR, 30, (t) => (rec ? 0 : ramp(t)), (t) => { smax = Math.max(smax, a.stallS); const g = Math.asin(-a.vel[2] / Math.hypot(...a.vel)); if (!rec && g >= 0) rec = { t, loss: h0 - a.alt }; }, thr);
    report(key, `F-16 dik dalıştan çıkış ${kt} kt, gaz %${thr * 100}: irtifa kaybı`, rec ? rec.loss : 9999, 'm', 300, kt <= 300 ? 900 : 1000);
    report(key, `F-16 dik dalıştan çıkış ${kt} kt: süre / tutunma kaybı`, (rec ? rec.t : 99) + smax * 100, 'sn', 2, 10);
    if (a.crashed) report(key, 'Dalışta kaza: ' + a.crashed, 1, '', 0, 0);
  }
  // 3. her duruşta çekiş: ters, 90° yatık, dik tırmanış (yavaş), dik dalış yatık
  for (const [lab, att, kt] of [['ters', { roll: Math.PI }, 300], ['90° yatık', { roll: Math.PI / 2 }, 300], ['dik tırmanışta 150 kt', { pitch: 89 * D2R }, 150], ['yatık dik dalış', { roll: Math.PI / 2, pitch: -80 * D2R }, 300]]) {
    const a = mk('f16', kt, 5000, att); let turned = 0, rev = 0, ls = 0, smax = 0;
    game(a, AIR, 6, () => 1, (t) => { turned += a.w[1] / 60; smax = Math.max(smax, a.stallS); if (t > 1) { const s = Math.sign(a.w[1]); if (ls && s !== ls) rev++; ls = s; } });
    report(key, `F-16 ${lab} çekiş 6 sn: burun dönüşü`, turned * R2D, '°', 90, 400);
    report(key, `F-16 ${lab} çekiş: salınım (yön değişimi) + tutunma kaybı`, rev + smax * 10, '', 0, 0.2);
  }
  // 4. bırakınca salınım yok: 1 sn tam çek/it, bırak; uçuş yolu açısı en çok bir kez yön değiştirir
  for (const [id, kt] of [['f16', 200], ['f16', 350], ['f16', 500], ['jet', 250], ['c172', 100]]) for (const u of [1, -1]) {
    const a = mk(id, kt, 3000, {}, PLANES[id].retract); run(a, AIR, 1, () => { a.ctl.pitch = u; }); a.ctl.pitch = 0;
    const gs = []; run(a, AIR, 6, (t) => { if (Math.round(t * 240) % 24 === 0) gs.push(Math.asin(-a.vel[2] / Math.hypot(...a.vel)) * R2D); });
    let rev = 0, ls = 0; for (let i = 6; i < gs.length; i++) { const d = gs[i] - gs[i - 1]; if (Math.abs(d) > 0.15) { const s = Math.sign(d); if (ls && s !== ls) rev++; ls = s; } }
    report(key, `${PLANES[id].name.split(' ')[0]} ${kt} kt levye ${u > 0 ? 'çek' : 'it'}-bırak: uçuş yolu salınımı`, rev, 'kez', 0, 1);
  }
  // 5. takım açık unutulmuş: akrobasi kısıtlanmaz, salınıp parçalanmaz (eski: 400 kt dalışta -4.5 g'ye salınım)
  for (const kt of [300, 400]) {
    const a = mk('f16', kt, 5000, { pitch: -89.5 * D2R }); a.gearPos = 1; a.ctl.gearDown = true; const h0 = a.alt; let rec = null, nmin = 9;
    game(a, AIR, 20, (t) => (rec ? 0 : 1), (t) => { nmin = Math.min(nmin, t > 0.5 ? a.nz : 9); const g = Math.asin(-a.vel[2] / Math.hypot(...a.vel)); if (!rec && g >= 0) rec = h0 - a.alt; });
    report(key, `F-16 takım açık, dik dalıştan çıkış ${kt} kt: irtifa kaybı`, rec ?? 9999, 'm', 300, 1000);
    report(key, `F-16 takım açık ${kt} kt: en küçük g (salınım yok)`, nmin, 'g', -0.5, 9);
    if (a.crashed) report(key, 'Takım açık dalışta kaza: ' + a.crashed, 1, '', 0, 0);
  }
  // 6. aşırı g kolay kumandada kaza değil (520 kt tam çek)
  { const a = mk('f16', 520, 3000); game(a, AIR, 5, () => 1); report(key, 'F-16 520 kt tam çek: kaza yok (0 = yok)', a.crashed ? 1 : 0, '', 0, 0); }
  // 7. eller serbest iniş: 3° süzülüş, takım açık, levye ortada; iniş yardımı yere değmeden burnu kaldırır
  for (const [id, kt] of [['f16', 155], ['f16', 200], ['f16', 250], ['jet', 140], ['jet', 180], ['c172', 65], ['c172', 90]]) {
    const a = new Aircraft(easyPlane(PLANES[id])); startTrimmed(a, { n: 0, e: 0, alt: 60, heading: 0, speed: kt * KT });
    const g = 3 * D2R; a.vel = [kt * KT * Math.cos(g), 0, kt * KT * Math.sin(g)]; const thr = Math.max(0, a.ctl.throttle - 0.1);
    let td = null; run(a, RUNWAY, 60, (t) => { a.ctl.pitch = 0; a.ctl.throttle = td ? 0 : thr; if (!td && a.onGround) td = t; if (td && t > td + 4) a.ctl.brake = 1; });
    report(key, `${PLANES[id].name.split(' ')[0]} ${kt} kt eller serbest iniş: kaza yok (0 = yok)`, a.crashed ? 1 : 0, '', 0, 0);
  }
}
testEasy();

const pad = (s, n) => String(s).padEnd(n);
let cur = '';
for (const r of results) {
  if (r.plane !== cur) { cur = r.plane; console.log('\n== ' + (PLANES[cur] ? PLANES[cur].name : 'Kolay kumanda (oyundaki varsayılan)')); }
  const v = typeof r.value === 'number' ? (Math.abs(r.value) >= 100 ? r.value.toFixed(0) : r.value.toFixed(2)) : r.value;
  console.log(`${r.ok ? 'GEÇTİ ' : 'KALDI '} ${pad(r.name, 58)} ${pad(v + ' ' + r.unit, 14)} [${r.lo}..${r.hi}]${r.real ? '  ' + r.real : ''}`);
}
console.log(fail ? `\n${fail} sınama kaldı` : '\nBütün sınamalar geçti');
process.exit(fail ? 1 : 0);
