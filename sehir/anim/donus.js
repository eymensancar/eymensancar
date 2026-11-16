/* Dönüş katmanı: karakterin baktığı yön (ps.yaw), dönüş hızı ve yana yatma. İSKELET SÜRÜM: gidiş yönüne yumuşak dönüş. */
(function () {
  'use strict';
  const SO = window.SO;
  SO.anim.register({ name: 'donus', order: 5,
    update(ctx, dt) { const ps = ctx.ps; if (ps.wantMag > .08) { const hedef = Math.atan2(ps.wantX, ps.wantZ), once = ps.yaw; ps.yaw = SO.wrapA(SO.dampA(ps.yaw, hedef, 10, dt)); ps.yawRate = dt > 0 ? SO.wrapA(ps.yaw - once) / dt : 0; } else ps.yawRate = 0; } });
})();
