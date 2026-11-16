/* Fizik: istenen yöne hızlanma/yavaşlama, yerçekimi, zıplama anı, çarpışma, su (sığda yavaşlama, derinde yüzme).
   Zıplamayı anim/ziplama.js başlatır: ps.jumpNow = true yazar, fizik bir sonraki adımda uygular.
   ps.kilit = true iken fizik konuma dokunmaz: o sırada konumu bir hareket katmanı (ör. tırmanma) sürer.
   Su: ps.suDerin (ayak altındaki su derinliği, m), ps.yuzme (derinlik göğsü geçince true; karakter su yüzeyinde tutulur, zıplama yok). */
(function () {
  'use strict';
  const SO = window.SO;
  Object.assign(SO.tune, { yuz: 1.45, yuzHizli: 2.3, yuzGir: 1.3, yuzCik: 1.1, yuzBatik: 1.38, suIvme: 5 });
  function update(dt) {
    const ps = SO.ps, tn = SO.tune, w = SO.world;
    const derin = w.suDerinlik ? w.suDerinlik(ps.x, ps.z) : 0; ps.suDerin = derin;
    if (ps.kilit) { ps.speed = Math.hypot(ps.vx, ps.vz); return; }
    const yuzuyordu = !!ps.yuzme; ps.yuzme = derin > (yuzuyordu ? tn.yuzCik : tn.yuzGir) && (yuzuyordu || ps.y < w.SU + .4);
    if (ps.yuzme !== yuzuyordu) ps.yuzmeAt = SO.time;
    let hedef = 0;
    const belUstu = derin > .75; // bel üstü derinlikte koşulmaz: hedef yürüme hızına iner
    if (ps.wantMag > .08) hedef = ps.yuzme ? (ps.wantRun ? tn.yuzHizli : tn.yuz) : belUstu ? tn.walk * 1.25 : ps.wantRun ? tn.sprint : ps.wantMag > .55 ? tn.jog : tn.walk * Math.max(.55, ps.wantMag / .55);
    if (!ps.yuzme) { hedef *= ps.speedScale == null ? 1 : ps.speedScale; // katmanlar geçici olarak kısabilir (ör. yere inişte)
      hedef *= ps.turnSlow == null ? 1 : ps.turnSlow;                      // dönüş katmanı sert/yerinde dönüşte kısar
      hedef *= ps.toplaYavas == null ? 1 : ps.toplaYavas;                // yerden alma sırasında yavaşlama (anim/toplama.js)
      hedef *= ps.vurYavas == null ? 1 : ps.vurYavas;                    // vuruş (kesme, kazma) sırasında yavaşlama (anim/vurus.js)
      if (derin > .25 && ps.grounded) hedef *= 1 - (belUstu ? .3 : .55) * SO.clamp((derin - .25) / .95, 0, 1); } // sığ suda yürümek yavaşlatır
    const tx = ps.wantX * hedef, tz = ps.wantZ * hedef, dvx = tx - ps.vx, dvz = tz - ps.vz, dv = Math.hypot(dvx, dvz);
    if (dv > 1e-5) { const hizlaniyor = hedef > ps.speed - .01, a = ps.yuzme ? tn.suIvme : (hizlaniyor ? tn.accel : tn.decel) * (ps.grounded ? 1 : tn.airControl), k = Math.min(1, a * dt / dv); ps.vx += dvx * k; ps.vz += dvz * k; }
    const [nx, nz] = w.collide(ps.x + ps.vx * dt, ps.z + ps.vz * dt, tn.radius, ps.y);
    if (dt > 0) { ps.vx = (nx - ps.x) / dt; ps.vz = (nz - ps.z) / dt; } ps.x = nx; ps.z = nz; ps.speed = Math.hypot(ps.vx, ps.vz);
    const gy = w.destekY ? w.destekY(ps.x, ps.z, ps.y) : w.groundY(ps.x, ps.z);
    if (ps.yuzme) { ps.jumpNow = false; ps.vy = 0; ps.y = SO.damp(ps.y, w.SU - tn.yuzBatik, 6, dt); ps.grounded = true; ps.groundY = ps.y; ps.airTime = 0; return; }
    ps.groundY = gy;
    if (ps.jumpNow) { ps.jumpNow = false; if (ps.grounded) { ps.vy = tn.jumpSpeed; ps.grounded = false; ps.jumpedAt = SO.time; ps.airTime = 0; } }
    if (!ps.grounded) { ps.vy -= tn.gravity * dt; ps.y += ps.vy * dt; ps.airTime += dt; if (ps.y <= gy && ps.vy <= 0) { ps.fallSpeed = -ps.vy; ps.y = gy; ps.vy = 0; ps.grounded = true; ps.landedAt = SO.time; } }
    else { if (ps.y > gy + .3) { ps.grounded = false; ps.airTime = 0; } else ps.y = SO.damp(ps.y, gy, 16, dt); }
  }
  SO.fizik = { update };
})();
