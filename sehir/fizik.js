/* Fizik: istenen yöne hızlanma/yavaşlama, yerçekimi, zıplama anı, çarpışma. Animasyon katmanları ps'i okur.
   Zıplamayı anim/ziplama.js başlatır: ps.jumpNow = true yazar, fizik bir sonraki adımda uygular. */
(function () {
  'use strict';
  const SO = window.SO;
  function update(dt) {
    const ps = SO.ps, tn = SO.tune, w = SO.world;
    let hedef = 0; if (ps.wantMag > .08) hedef = ps.wantRun ? tn.sprint : ps.wantMag > .55 ? tn.jog : tn.walk * Math.max(.55, ps.wantMag / .55);
    hedef *= ps.speedScale == null ? 1 : ps.speedScale;
    hedef *= ps.turnSlow == null ? 1 : ps.turnSlow; // dönüş katmanı sert/yerinde dönüşte kısar // katmanlar geçici olarak kısabilir (ör. yere inişte)
    const tx = ps.wantX * hedef, tz = ps.wantZ * hedef, dvx = tx - ps.vx, dvz = tz - ps.vz, dv = Math.hypot(dvx, dvz);
    if (dv > 1e-5) { const hizlaniyor = hedef > ps.speed - .01, a = (hizlaniyor ? tn.accel : tn.decel) * (ps.grounded ? 1 : tn.airControl), k = Math.min(1, a * dt / dv); ps.vx += dvx * k; ps.vz += dvz * k; }
    const [nx, nz] = w.collide(ps.x + ps.vx * dt, ps.z + ps.vz * dt, tn.radius);
    if (dt > 0) { ps.vx = (nx - ps.x) / dt; ps.vz = (nz - ps.z) / dt; } ps.x = nx; ps.z = nz; ps.speed = Math.hypot(ps.vx, ps.vz);
    const gy = w.groundY(ps.x, ps.z); ps.groundY = gy;
    if (ps.jumpNow) { ps.jumpNow = false; if (ps.grounded) { ps.vy = tn.jumpSpeed; ps.grounded = false; ps.jumpedAt = SO.time; ps.airTime = 0; } }
    if (!ps.grounded) { ps.vy -= tn.gravity * dt; ps.y += ps.vy * dt; ps.airTime += dt; if (ps.y <= gy && ps.vy <= 0) { ps.fallSpeed = -ps.vy; ps.y = gy; ps.vy = 0; ps.grounded = true; ps.landedAt = SO.time; } }
    else { if (ps.y > gy + .3) { ps.grounded = false; ps.airTime = 0; } else ps.y = SO.damp(ps.y, gy, 16, dt); }
  }
  SO.fizik = { update };
})();
