/* Zıplama katmanı: zıplama isteği, kalkış hazırlığı, havada duruş, yere iniş.
   Evreler (ps.jumpPhase): '' → 'start' (yerde kısa çömelme/itiş) → 'air' → 'land' (diz kırma + toparlanma) → ''.
   Kliplerin ölçülen kareleri (30 kare/sn, yerinde):
     Jump_Start  0,00 derin çömelme (kalça 0,52 m) · 0,067 bacaklar tam açık, ayak yerde (itiş sonu) · 0,10–0,20 ayaklar yerden kesilir (önce sol)
                 0,27–0,40 dizler karna çekili (en toplu poz) · 0,5 → 1,33 bacaklar yavaşça sarkar (Jump_Loop pozuna varır)
     Jump_Loop   neredeyse sabit "süzülme" pozu: bacaklar hafif kırık sarkık, kollar yana açık (küçük salınım)
     Jump_Land   0,00 yere değiş (bacak gergin, parmak ucu yerde, kalça 0,93) · 0,10 yarım çömelme · 0,20 en derin (kalça 0,43)
                 0,33 → 0,80 doğrulma · 0,80 → 1,27 kollar yerine oturur
   Kullanım: hazırlıkta Jump_Start 0 → 0,067; havada yükselirken Jump_Start 0,07 → 0,40, tepe/düşüşte Jump_Loop, yere ~0,2 sn kala
   Jump_Land'in 0. karesi (bacaklar yere uzanır); inişte Jump_Land 0'dan ileri oynar, şiddete göre ne kadar derine indiği ve
   ne kadar çabuk taban harekete (dur/koşu) bırakıldığı değişir. Üç klibin toplam ağırlığı = ps.airBlend.
   Yazdığı alanlar: ps.jumpNow, ps.airBlend, ps.jumpPhase, ps.speedScale, ps.landK (iniş şiddeti 0..1; iniş bitince 0). */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // Zıplama eğrisi: tepe = jumpSpeed² / (2·gravity) ≈ 0,98 m, havada kalma = 2·jumpSpeed / gravity ≈ 0,56 sn (düz zeminde)
  SO.tune.gravity = 25; SO.tune.jumpSpeed = 7.0;
  const Z = SO.tune.ziplama = {
    arabellek: .12,        // sn: yere değmeden bu kadar önce basılan tuş inişte zıplatır
    kenar: .10,            // sn: yerden (zıplamadan) ayrıldıktan sonra bu süre içinde hâlâ zıplanabilir
    hazirlikDur: .11,      // sn: dururken çömelme + itiş
    hazirlikKos: .05,      // sn: koşarken (yalnız itiş)
    cokme: .62,            // dururken hazırlıkta çömelme pozunun en çok ağırlığı (0..1)
    dusmeSure: .14,        // sn: zıplamadan düşerken bu süreden önce hava pozuna girme
    dusmeYuk: .5,          // m: ya da zeminden bu kadar yüksekteyse hemen gir
    toplanma: .85,          // yükselirken diz çekme pozunun payı (0..1)
    uzanma: .2,            // sn: yere bu kadar kala bacaklar inişe uzanır
    sertAlt: 4.5, sertUst: 11, // m/sn: iniş şiddeti 0..1 bu düşüş hızları arasında (1 m'lik zıplama ≈ 7 → 0,38)
    inisSesAlt: 2.5,       // m/sn: zıplamadan düşüşte iniş sesi için en az hız
    inisTut: .22,          // sn × sertlik: çömelmede bekleme (1 m'lik zıplamada beklemez)
    inisDur: .30, inisKos: .15, inisSert: .50, // sn: toparlanma (dururken hafif, koşarken hafif, en sert)
    inisFren: .8,          // en sert inişte hız hedefi bu kadar kısılır (speedScale = 1 - inisFren)
    inisKilit: .7,         // şiddet bunun üstündeyse çömelme bitene kadar yeniden zıplanamaz
    egimIleri: .28, egimGeri: .1, // rad: koşarak zıplamada gövdenin havada öne/arkaya yatması (kalçadan)
    makasOn: .3, makasArka: .6 // rad: koşarak zıplamada öndeki diz öne, itiş bacağı arkaya (bacak makası)
  };
  let aS, aL, aD;                       // Jump_Start, Jump_Loop, Jump_Land oynatıcıları
  let phase = '', buf = 0, coyote = 0, prevG = true, jumped = false, pending = false;
  let prepT = 0, prepDur = .1, runM = 0, tS = 0, landT = 0, landC = 0, hard = 0, hard2 = 0, landH = 0, landD = .3, landR = 1, A0 = 1, prepA = 0;
  const sh = [0, 0, 0];                 // klip payları (start, loop, land), toplamı 1
  let pitch = 0, split = 0, onSol = true; const qP = new T3.Quaternion(), qX = new T3.Quaternion(), qI = new T3.Quaternion(), X = new T3.Vector3(1, 0, 0);

  function startPrep(ps) { runM = clamp(ps.speed / SO.tune.jog, 0, 1); prepDur = lerp(Z.hazirlikDur, Z.hazirlikKos, runM); prepT = 0; prepA = ps.airBlend; phase = 'start'; buf = 0; ps.landK = 0; }
  function takeoff(ps, havada) {
    // havada: kenar toleransı. Fizik jumpNow'u yalnız yerdeyken uygular; yerden yeni ayrılmışken kalkış hızını burada veririz.
    if (havada) { ps.vy = SO.tune.jumpSpeed; ps.jumpedAt = SO.time; ps.airTime = 0; pending = false; runM = clamp(ps.speed / SO.tune.jog, 0, 1); tS = lerp(.067, .1, runM); }
    else { ps.jumpNow = true; pending = true; }
    const c = SO.anim.ctx, fl = c.bones.foot_l.matrixWorld.elements, fr = c.bones.foot_r.matrixWorld.elements, sx = Math.sin(ps.yaw), cz = Math.cos(ps.yaw);
    onSol = (fl[12] - fr[12]) * sx + (fl[14] - fr[14]) * cz > 0; // öndeki ayak öne sürülür, arkadaki iter
    phase = 'air'; jumped = true; buf = 0; coyote = 0; SO.ses.olay('zipla', {});
  }
  function land(ctx, ps) {
    const v = ps.fallSpeed, m = clamp(ps.speed / SO.tune.jog, 0, 1.4);
    if (jumped || v > Z.inisSesAlt) SO.ses.olay('in', { hiz: v, zemin: ctx.world.zemin(ps.x, ps.z) });
    hard = clamp((v - Z.sertAlt) / (Z.sertUst - Z.sertAlt), 0, 1); hard2 = clamp((hard - .25) / .75, 0, 1);
    landH = Z.inisTut * hard2; landD = lerp(lerp(Z.inisDur, Z.inisKos, m), Z.inisSert, hard); landR = lerp(lerp(.55, .45, m), 1, hard2);
    landT = 0; landC = 0; A0 = ps.airBlend; phase = 'land'; jumped = false; ps.landK = hard;
  }

  SO.anim.register({ name: 'ziplama', order: 20,
    init(ctx) {
      aS = ctx.action('Jump_Start'); aL = ctx.action('Jump_Loop'); aD = ctx.action('Jump_Land');
      aS.timeScale = 0; aD.timeScale = 0; // bu iki klibin zamanını katman elle yürütür
      ctx.ps.landK = 0;
    },
    update(ctx, dt) {
      const ps = ctx.ps, inp = ctx.input, tn = ctx.tune;
      if (inp.jump) { inp.jump = false; buf = Z.arabellek; } else buf -= dt;
      if (!ps.grounded && prevG && !jumped && !pending) coyote = Z.kenar; else if (!ps.grounded) coyote -= dt;
      const h = ps.y - ps.groundY;

      if (phase === 'air') {
        if (pending) { pending = false; if (ps.grounded) { phase = ''; jumped = false; } else tS = lerp(.067, .1, runM); } // fizik zıplamayı bu adımda uyguladı
        else if (ps.grounded) land(ctx, ps);
      } else if (phase === 'start') {
        prepT += dt;
        if (!ps.grounded) takeoff(ps, true); else if (prepT >= prepDur - 1e-6) takeoff(ps, false);
      } else {
        if (!ps.grounded) { if (buf > 0 && coyote > 0) takeoff(ps, true); else if (ps.airTime > Z.dusmeSure || h > Z.dusmeYuk) { phase = 'air'; jumped = false; } }
        else if (!prevG && !phase && ps.fallSpeed > Z.inisSesAlt) land(ctx, ps); // hava pozuna girmeden biten kısa ama hızlı düşüş
      }
      if (phase === 'land') {
        landT += dt; landC += dt * (landC < .2 ? landR : 1.3);
        if (!ps.grounded) { phase = ''; ps.landK = 0; }
        else if (landT >= landH + landD) { phase = ''; ps.landK = 0; }
      }
      if (buf > 0 && ps.grounded && (phase === '' || (phase === 'land' && (hard < Z.inisKilit || landT >= landH)))) startPrep(ps);
      prevG = ps.grounded;

      // ---- ağırlıklar ve klip zamanları ----
      let A = 0, s0 = 0, s1 = 0, s2 = 0, k = 20, scale = 1;
      if (phase === 'start') {
        const u = clamp(prepT / prepDur, 0, 1), dur = u < .5 ? Z.cokme * sstep(0, 1, u * 2) : lerp(Z.cokme, 1, (u - .5) * 2);
        A = Math.max(lerp(dur, .55 * u, runM), prepA * (1 - u)); tS = lerp(u < .5 ? 0 : .067 * (u - .5) * 2, .1, runM); s0 = 1; k = 60;
        ps.airBlend = A;
      } else if (phase === 'air') {
        if (pending) { A = Math.max(ps.airBlend, lerp(1, .55, runM)); ps.airBlend = A; s0 = 1; }
        else {
          ps.airBlend = A = SO.damp(ps.airBlend, 1, jumped ? 22 : 11, dt);
          tS = Math.min(.4, tS + dt * (tS < .2 ? 1.3 : 1));
          const g = tn.gravity, tImp = (ps.vy + Math.sqrt(ps.vy * ps.vy + 2 * g * Math.max(0, h))) / g;
          s2 = ps.vy < 0 ? (1 - sstep(Z.uzanma * .25, Z.uzanma, tImp)) * (1 - .4 * clamp(ps.speed / tn.jog, 0, 1)) : 0;
          s0 = jumped ? Z.toplanma * sstep(-.5, .3, ps.vy / tn.jumpSpeed) * (1 - s2) : 0;
          s1 = 1 - s0 - s2;
        }
      } else if (phase === 'land') {
        ps.airBlend = A = A0 * (1 - sstep(landH, landH + landD, landT)); s2 = 1; k = 40;
        scale = lerp(1 - Z.inisFren * hard2, 1, sstep(landH * .5, landH + landD, landT));
      } else { ps.airBlend = A = SO.damp(ps.airBlend, 0, 18, dt); if (A < .002) ps.airBlend = A = 0; s0 = sh[0]; s1 = sh[1]; s2 = sh[2]; }
      if (s0 + s1 + s2 < 1e-4) s1 = 1;
      if (sh[0] + sh[1] + sh[2] < 1e-4 || A === 0) { sh[0] = s0; sh[1] = s1; sh[2] = s2; }
      else { const f = 1 - Math.exp(-k * dt); sh[0] += (s0 - sh[0]) * f; sh[1] += (s1 - sh[1]) * f; sh[2] += (s2 - sh[2]) * f; }
      const top = sh[0] + sh[1] + sh[2] || 1;
      aS.time = tS; aD.time = phase === 'land' ? Math.min(landC, 1.2) : 0;
      aS.setEffectiveWeight(A * sh[0] / top); aL.setEffectiveWeight(A * sh[1] / top); aD.setEffectiveWeight(A * sh[2] / top);
      ps.jumpPhase = phase; ps.speedScale = scale;

      // gövdenin havada öne/arkaya yatması (post'ta kalçaya uygulanır): koşarak kalkışta öne atılım, düşerken ayaklar öne
      let hedef = 0; if (phase === 'air' && !pending) { const m = clamp(ps.speed / tn.jog, 0, 1.4), s = ps.vy / tn.jumpSpeed; hedef = m * (s > 0 ? Z.egimIleri * Math.min(1, s * 1.6) : -Z.egimGeri * Math.min(1, -s * 1.6)); }
      pitch = SO.damp(pitch, hedef, phase === 'air' ? 9 : 16, dt);
      // koşarak zıplamada bacak makası: itiş bacağı arkada kalır, öbür diz öne sürülür; yere yaklaşınca kapanır
      let mk = 0; if (phase === 'air' && !pending && jumped) mk = runM * (ps.vy > 0 ? 1 : 1 - .75 * sh[2] / top) * (1 - .5 * sstep(0, -1, ps.vy / tn.jumpSpeed));
      split = SO.damp(split, mk, mk > split ? 16 : 10, dt);
    },
    post(ctx) {
      // kemiği karakterin sağ ekseni çevresinde döndür (kök uzayında): q' = P⁻¹ · Rx · P · q   (+ açı: üst taraf öne, yani bacak arkaya)
      const kok = ctx.char.root, don = (b, aci) => { qP.set(0, 0, 0, 1); for (let o = b.parent; o && o !== kok; o = o.parent) qP.premultiply(o.quaternion);
        qX.setFromAxisAngle(X, aci); qI.copy(qP).invert(); b.quaternion.premultiply(qP).premultiply(qX).premultiply(qI); };
      if (Math.abs(pitch) > 1e-3) don(ctx.bones.pelvis, pitch);
      if (split > 1e-3) { const on = onSol ? ctx.bones.thigh_l : ctx.bones.thigh_r, arka = onSol ? ctx.bones.thigh_r : ctx.bones.thigh_l; don(on, -Z.makasOn * split); don(arka, Z.makasArka * split); }
    } });
})();
