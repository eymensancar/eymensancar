/* Hareket katmanı (taban): dur / yürü / hafif koşu / depar arasında hıza göre geçiş. İSKELET SÜRÜM: yalnız en basit karışım. */
(function () {
  'use strict';
  const SO = window.SO; let A, lastHalf = 0;
  SO.anim.register({ name: 'hareket', order: 10,
    init(ctx) { A = { idle: ctx.action('Idle_Loop'), walk: ctx.action('Walk_Loop'), jog: ctx.action('Jog_Fwd_Loop'), sprint: ctx.action('Sprint_Loop') }; },
    update(ctx, dt) {
      const ps = ctx.ps, tn = ctx.tune, v = ps.speed, base = 1 - ps.airBlend;
      const pts = [0, tn.walk, tn.jog, tn.sprint], w = [0, 0, 0, 0]; let i = 0; while (i < 2 && v > pts[i + 1]) i++; const t = SO.clamp((v - pts[i]) / (pts[i + 1] - pts[i]), 0, 1); w[i] = 1 - t; w[i + 1] = t; ps.gait = i + t;
      [A.idle, A.walk, A.jog, A.sprint].forEach((a, k) => a.setEffectiveWeight(w[k] * base));
      const cyc = A.jog.getClip().duration; ps.phase = (A.jog.time / cyc) % 1; const half = Math.floor(ps.phase * 2);
      if (half !== lastHalf && ps.grounded && v > .5) { lastHalf = half; SO.ses.olay('adim', { zemin: ctx.world.zemin(ps.x, ps.z), hiz: v, ayak: half ? 'r' : 'l' }); }
    } });
})();
