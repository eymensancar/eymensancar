/* Zıplama katmanı: zıplama isteği, havada duruş, yere iniş. İSKELET SÜRÜM: tuşa basınca hemen zıplar, havada tek klip. */
(function () {
  'use strict';
  const SO = window.SO; let air;
  SO.anim.register({ name: 'ziplama', order: 20,
    init(ctx) { air = ctx.action('Jump_Loop'); },
    update(ctx, dt) {
      const ps = ctx.ps, inp = ctx.input;
      if (inp.jump) { inp.jump = false; if (ps.grounded) { ps.jumpNow = true; SO.ses.olay('zipla', {}); } }
      if (ps.grounded && ctx.time - ps.landedAt < dt * 1.5 && ps.fallSpeed > 1) SO.ses.olay('in', { hiz: ps.fallSpeed, zemin: ctx.world.zemin(ps.x, ps.z) });
      ps.airBlend = SO.damp(ps.airBlend, ps.grounded ? 0 : 1, ps.grounded ? 12 : 16, dt); ps.jumpPhase = ps.grounded ? '' : 'air'; air.setEffectiveWeight(ps.airBlend);
    } });
})();
