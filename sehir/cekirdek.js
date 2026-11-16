/* Çekirdek: ortak ad alanı (SO), yardımcılar, oyuncu durumu, girdi ve hareket katmanlarının kayıt yeri.
   Her dosya yalnız SO üstünden konuşur. Hareket katmanları (anim/*.js) SO.anim.register({...}) ile eklenir. */
(function (G) {
  'use strict';
  const TAU = Math.PI * 2;
  const SO = G.SO = {
    T3: THREE, TAU,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    wrapA: a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; },
    // kare hızından bağımsız yumuşatma: her saniye farkın e^-k kadarı kalır
    damp: (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt)),
    dampA: (a, b, k, dt) => a + SO.wrapA(b - a) * (1 - Math.exp(-k * dt)),
    rnd: s => { let a = (s * 2654435761) >>> 0 || 9; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
    test: /[?&]test\b/.test(location.search),
    time: 0,
    // Girdi (ana.js doldurur): jx,jy sanal çubuk (-1..1, jy ileri +), run koşu düğmesi basılı mı, jump/act tek seferlik istek
    input: { jx: 0, jy: 0, run: false, jump: false, act: false },
    /* Oyuncu durumu. Kim yazar:
       fizik.js   : x,y,z, vx,vy,vz, speed (yatay hız m/sn), grounded, groundY, fallSpeed (yere değdiği andaki düşüş hızı), airTime, landedAt, jumpedAt
       ana.js     : wantX, wantZ (kameraya göre istenen yön, birim vektör), wantMag (0..1), wantRun
       anim/donus : yaw (karakterin baktığı yön, radyan; ileri = (sin yaw, cos yaw)), yawRate (rad/sn), lean (yana yatma, rad; + = sola),
                    leanFwd (öne/arkaya yatma, rad; + = öne). ana.js bunları kök düğüme uygular (ayak tabanından döner).
       anim/ayak  : rootDy (kökün dikey kayması, m; kalçayı indirmek için)
       anim/ziplama: airBlend (0..1; havadayken taban hareketlerin ağırlığı 1-airBlend ile çarpılır), jumpPhase ('' | 'start' | 'air' | 'land')
       anim/hareket: gait (0 dur, 1 yürü, 2 hafif koşu, 3 depar; kesirli), phase (adım döngüsü 0..1), stride (m) */
    ps: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, grounded: true, groundY: 0, fallSpeed: 0, airTime: 0, landedAt: -9, jumpedAt: -9,
      wantX: 0, wantZ: 0, wantMag: 0, wantRun: false, yaw: Math.PI, yawRate: 0, lean: 0, leanFwd: 0, rootDy: 0, speedScale: 1, jumpNow: false, airBlend: 0, jumpPhase: '', gait: 0, phase: 0, stride: 0 },
    // Ayarlar: katmanlar kendi bölümünü okur/yazar. Hız hedefleri m/sn.
    tune: { walk: 1.55, jog: 3.6, sprint: 6.4, accel: 14, decel: 18, airControl: .35, gravity: 22, jumpSpeed: 6.6, radius: .34 },
    anim: {
      mods: [],
      register(m) { this.mods.push(m); this.mods.sort((a, b) => (a.order || 0) - (b.order || 0)); },
      init(ctx) { this.ctx = ctx; this.mods.forEach(m => m.init && m.init(ctx)); },
      // sıra: update (ağırlık/zaman ayarı) → mixer.update → post (kemiklere elle dokunuş: yatma, bakış, ayak yerleştirme)
      update(dt) { const c = this.ctx; this.mods.forEach(m => m.update && m.update(c, dt)); c.mixer.update(dt); this.mods.forEach(m => m.post && m.post(c, dt)); }
    }
  };
})(window);
