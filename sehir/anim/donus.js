/* Dönüş katmanı (order 5): karakterin baktığı yön, dönüş hızı, viraja ve ivmeye yatma, sert (≈180°) dönüş, üst gövdenin dönüşü önceden haber vermesi.

   Yazdığı alanlar (SO.ps):
     yaw, yawRate   : bakış yönü (rad) ve dönüş hızı (rad/sn; + = sola, yani yaw artar)
     lean           : yana yatma (rad). ana.js bunu kök düğümün Z dönüşüne yazar: + değer karakteri KENDİ SAĞINA yatırır (three.js'te +Z dönüşü).
                      Sola dönerken (yawRate > 0) lean negatif olur. (cekirdek.js'teki "+ = sola" notu ekrandaki sonuçla uyuşmuyor; işaret burada ekrana göre.)
     leanFwd        : öne (+) / arkaya (-) yatma (rad)
     turnSlow       : hız ÇARPANI, 0..1 (1 = kısma yok; speedScale gibi). Sert dönüşün fren evresinde 0'a, yerinde dönüşte ~0,15'e iner.
                      Fizik şu an okumuyor; önerilen tek satır (fizik.js, hedef hesabından sonra):  hedef *= ps.turnSlow == null ? 1 : ps.turnSlow;
     pivot          : 0 = yok, 1 = sert dönüşün fren evresi, 2 = dönme evresi (başka katmanlar bakabilir: klip, kamera, ses)
     turnTwist      : bu katmanın üst gövde + başa verdiği toplam ön dönüş (rad; + = sola). canlilik.js kendi bakışını bununla toplayabilir.

   Nasıl çalışır:
   - Hedef yön: dururken çubuğun yönü; hızlandıkça gerçek gidiş yönü (hız vektörü) + istenen yöne doğru bir "önden gitme" payı. Böylece gövde ayakların
     gittiği yöne bakar (yan yan kayma olmaz), ama dönüşe hızın kendisinden önce girer. Hedefe kritik sönümlü yay ile gidilir (aşma/titreme yok).
   - Yana yatma: yanal ivme (fizikten) ve hız × dönüş hızı karışımı; hızla ölçeklenir (yürürken çok az). Omurga, boyun ve baş yatmanın bir kısmını geri alır.
   - Öne/arkaya yatma: gövde yönündeki ivme; kalkışta öne, frende arkaya. Deparda küçük sabit öne eğim.
   - Sert dönüş: koşarken ters yöne basılınca önce fren (gövde az döner, baş omuz üstünden geriye bakar, arkaya yatar), hız düşünce tek yöne kilitli hızlı dönüş.
   - Ön dönüş: kalan açı kadar (sınırlı) omurga→boyun→baş istenen yöne önden döner; yerinde dönüşte gövde önce, kalça (kök) ardından gelir.

   Deneme:
     node test/cek.cjs '{"kamera":"arka","adimlar":[{"sure":1.2,"jy":1,"run":true},{"sure":1.2,"jy":-1,"run":true}],"kareler":[1.1,1.3,1.45,1.6,1.75,2.2]}' /tmp/donus-180.png --olc */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp, wrapA = SO.wrapA, PI = Math.PI;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  const T = SO.tune.donus = Object.assign({
    // yön yayı (kritik sönümlü): açısal frekans (1/sn) ve en yüksek dönüş hızı (rad/sn), hıza göre
    omegaDur: 15, omegaYuru: 13, omegaKos: 12, omegaDepar: 11,
    hizDur: 13, hizYuru: 12, hizKos: 9, hizDepar: 6.5,
    onPay: .6,             // deparda hedef = gidiş yönü + bu oran × (istenen − gidiş). Dururken 1 (doğrudan istenen yön)
    onPayHiz: [.8, 5.5],   // önden gitme payının 1'den onPay'e indiği hız aralığı (m/sn)
    // yana yatma
    yat: .019,             // rad / (m/sn²) yanal ivme başına
    yatEnCok: .25,         // ≈14°
    yatHiz: [.5, 5],       // yatmanın 0'dan tam değere çıktığı hız aralığı
    yatOmega: 10,          // yatma yayı (giriş-çıkış yumuşaklığı)
    yatKarisim: .55,       // yanal ivme payı; kalanı hız × dönüş hızı
    // öne / arkaya yatma
    one: .0115,            // rad / (m/sn²)
    oneEnCok: .17, arkaEnCok: .13,
    deparEgim: .045,       // deparda sabit ek öne eğim
    oneOmega: 8,
    // sert dönüş (pivot)
    pivHiz: 2.6,           // bu hızın üstünde ve ters yöne basılınca başlar
    pivAci: 2.36,          // ≈135°: istenen yön ile bakış arasındaki en az açı
    pivFrenOmega: 4, pivFrenHiz: 1.6,   // fren evresinde gövde yavaş döner
    pivBirak: .45,         // ilk hızın bu oranına inince dönmeye geçer
    pivFrenSure: .45,      // fren evresi en çok bu kadar sürer (sn)
    pivArka: .07,          // fren evresinde ek arkaya yatma (rad)
    pivOmega: 10.5, pivDonHiz: 14,
    pivYavas: .2,          // dönme evresinde turnSlow tabanı
    // yerinde dönüş
    yerYavas: .15, yerAci: [.6, 1.9],   // dururken açı büyükse turnSlow bu değere kadar iner
    // ön dönüş (üst gövde + baş)
    bak: .55, bakEnCok: .5, bakPivot: .8, bakGir: 11, bakCik: 7,
    bakPay: { spine_01: .08, spine_02: .1, spine_03: .12, neck_01: .25, Head: .45 },
    // yatmayı dengeleme (kökün yatmasının geri alınan oranı)
    dengeYan: { spine_01: .08, spine_02: .1, spine_03: .1, neck_01: .17, Head: .3 },
    dengeOn: { neck_01: .2, Head: .3 },
    // hava
    havaOmega: 3, havaHiz: 2.2
  }, SO.tune.donus || {});

  // kritik sönümlü yayın kesin çözümü (kare hızından bağımsız, büyük dt'de de kararlı). s = { x, v }
  function yay(s, hedef, w, dt) { const d = s.x - hedef, tmp = (s.v + w * d) * dt, e = Math.exp(-w * dt); s.v = (s.v - w * tmp) * e; s.x = hedef + (d + tmp) * e; }

  const yawS = { x: 0, v: 0 }, leanS = { x: 0, v: 0 }, fwdS = { x: 0, v: 0 };
  let pvx = 0, pvz = 0, ilk = true, kilit = 0, bak = 0, yavas = 1;
  const piv = { faz: 0, t: 0, v0: 0, fx: 0, fz: 0 };

  function update(ctx, dt) {
    const ps = ctx.ps, tn = ctx.tune;
    if (!(dt > 0)) { ps.turnSlow = yavas; ps.pivot = piv.faz; ps.turnTwist = bak; return; }
    const v = ps.speed, yer = ps.grounded, basili = ps.wantMag > .08;
    // ivme (fiziğin bu karede yaptığı hız değişimi)
    let ax = 0, az = 0; if (!ilk) { ax = (ps.vx - pvx) / dt; az = (ps.vz - pvz) / dt; const am = Math.hypot(ax, az); if (am > 20) { ax *= 20 / am; az *= 20 / am; } } ilk = false; pvx = ps.vx; pvz = ps.vz;

    /* ---------- hedef yön ---------- */
    const istenen = basili ? Math.atan2(ps.wantX, ps.wantZ) : ps.yaw, eIst = wrapA(istenen - ps.yaw);
    let hedef = istenen;
    if (basili && v > .3) {
      const gidis = Math.atan2(ps.vx, ps.vz), fark = wrapA(istenen - gidis);
      // ters yöne yakınsa gidiş yönünün anlamı kalmaz (hız sıfırdan geçip işaret değiştirir): doğrudan istenen yöne
      const pay = Math.max(lerp(1, T.onPay, ss(T.onPayHiz[0], T.onPayHiz[1], v)), ss(1.75, 2.6, Math.abs(fark)));
      hedef = gidis + fark * pay;
    }
    let e = wrapA(hedef - ps.yaw);

    /* ---------- sert dönüş: başlat ---------- */
    if (!piv.faz && yer && basili && v > T.pivHiz && Math.abs(eIst) > T.pivAci && (ps.wantX * ps.vx + ps.wantZ * ps.vz) < -.7 * v) {
      piv.faz = 1; piv.t = 0; piv.v0 = v; piv.fx = ps.vx / v; piv.fz = ps.vz / v;
      // yön: açı belirginse kısa taraf; tam terse yakınsa süren dönüşün yönü, o da yoksa adım evresine göre (basan ayağın üstünden)
      kilit = Math.abs(eIst) < 2.97 ? Math.sign(eIst) : Math.abs(ps.yawRate) > .5 ? Math.sign(ps.yawRate) : ((ps.phase || 0) % 1 < .5 ? 1 : -1);
    }
    // dönüş yönü kilidi: 180°'ye yakın hedefte kısa taraf kare kare değişip titremesin
    if (!kilit && basili && Math.abs(e) > 2.62) kilit = Math.sign(e) || 1;
    if (kilit) { if (!basili || Math.abs(e) < 1.05) kilit = 0; else if (e * kilit < 0) { if (Math.abs(e) > 2.1) e += kilit * SO.TAU; else kilit = 0; } }

    /* ---------- yay ayarı ---------- */
    const k1 = ss(0, tn.walk, v), k2 = ss(tn.walk, tn.jog, v), k3 = ss(tn.jog, tn.sprint, v);
    let w = lerp(lerp(lerp(T.omegaDur, T.omegaYuru, k1), T.omegaKos, k2), T.omegaDepar, k3);
    let hizSinir = lerp(lerp(lerp(T.hizDur, T.hizYuru, k1), T.hizKos, k2), T.hizDepar, k3);
    let yavasHedef = 1;
    if (piv.faz) {
      piv.t += dt; const boyuna = ps.vx * piv.fx + ps.vz * piv.fz;
      if (!yer || !basili || piv.t > 1.4 || (piv.faz === 1 && Math.abs(eIst) < 1.57 && !kilit)) piv.faz = 0;
      else if (piv.faz === 1) { w = T.pivFrenOmega; hizSinir = T.pivFrenHiz; yavasHedef = 0; if (boyuna < piv.v0 * T.pivBirak || piv.t > T.pivFrenSure) piv.faz = 2; }
      if (piv.faz === 2) { w = T.pivOmega; hizSinir = T.pivDonHiz; yavasHedef = lerp(T.pivYavas, 1, 1 - ss(.45, 2.2, Math.abs(e))); if (Math.abs(e) < .3) piv.faz = 0; }
    } else if (yer && basili && v < tn.walk * 1.3) yavasHedef = lerp(1, T.yerYavas, ss(T.yerAci[0], T.yerAci[1], Math.abs(e))); // yerinde dönüş: önce dön, sonra yürü
    if (!yer) { w = T.havaOmega; hizSinir = T.havaHiz; }
    yavas = yavasHedef < yavas ? yavasHedef : SO.damp(yavas, yavasHedef, 14, dt); ps.turnSlow = yavas; ps.pivot = piv.faz;

    /* ---------- yön yayı ---------- */
    yawS.x = 0; yawS.v = ps.yawRate || 0; yay(yawS, e, w, dt);
    if (Math.abs(yawS.v) > hizSinir) { yawS.v = clamp(yawS.v, -hizSinir, hizSinir); yawS.x = yawS.v * dt; }
    ps.yaw = wrapA(ps.yaw + yawS.x); ps.yawRate = yawS.v;

    /* ---------- yatmalar ---------- */
    const sy = Math.sin(ps.yaw), cy = Math.cos(ps.yaw);
    const aOn = ax * sy + az * cy, aSol = ax * cy - az * sy; // gövdeye göre ivme: ileri ve sola
    let yanH = 0, onH = 0;
    if (yer) {
      const yanal = clamp(T.yatKarisim * aSol + (1 - T.yatKarisim) * v * ps.yawRate, -16, 16);
      yanH = clamp(-T.yat * yanal * ss(T.yatHiz[0], T.yatHiz[1], v), -T.yatEnCok, T.yatEnCok); // kök Z dönüşünde + = sağa; sola dönerken sola yat
      onH = clamp(T.one * aOn, -T.arkaEnCok, T.oneEnCok) + T.deparEgim * ss(tn.jog, tn.sprint, v) - (piv.faz === 1 ? T.pivArka : 0);
    }
    leanS.x = ps.lean || 0; yay(leanS, yanH, yer ? T.yatOmega : 5, dt); ps.lean = leanS.x;
    fwdS.x = ps.leanFwd || 0; yay(fwdS, onH, yer ? T.oneOmega : 5, dt); ps.leanFwd = fwdS.x;

    /* ---------- ön dönüş (üst gövde + baş): kalan açıya göre ---------- */
    let bakH = 0;
    if (basili) { let eb = eIst; if (kilit && eb * kilit < 0 && Math.abs(eb) > 2.1) eb += kilit * SO.TAU; const enCok = piv.faz ? T.bakPivot : T.bakEnCok; bakH = clamp(eb * T.bak, -enCok, enCok) * (yer ? 1 : .4); }
    bak = SO.damp(bak, bakH, Math.abs(bakH) > Math.abs(bak) ? T.bakGir : T.bakCik, dt); ps.turnTwist = bak;
  }

  /* ---------- kemikler: karakter uzayında (kök düğüme göre) eksenlerle ek dönüş ---------- */
  const qP = new T3.Quaternion(), qR = new T3.Quaternion(), qT = new T3.Quaternion(), eu = new T3.Euler(0, 0, 0, 'YXZ');
  function ekDon(kok, kemik, rx, ry, rz) {
    if (!kemik || (Math.abs(rx) + Math.abs(ry) + Math.abs(rz) < 1e-5)) return;
    qP.set(0, 0, 0, 1); for (let p = kemik.parent; p && p !== kok; p = p.parent) qP.premultiply(p.quaternion); // ebeveynin karakter uzayındaki yönü
    qR.setFromEuler(eu.set(rx, ry, rz)); qT.copy(qP).invert().multiply(qR).multiply(qP); kemik.quaternion.premultiply(qT);
  }
  const SIRA = ['spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head'];
  function post(ctx, dt) {
    const ps = ctx.ps, b = ctx.bones, kok = ctx.char.root, yan = ps.lean || 0, on = ps.leanFwd || 0;
    for (const ad of SIRA) ekDon(kok, b[ad], -on * (T.dengeOn[ad] || 0), bak * (T.bakPay[ad] || 0), -yan * (T.dengeYan[ad] || 0));
  }

  SO.anim.register({ name: 'donus', order: 5, init(ctx) { const ps = ctx.ps; ps.turnSlow = 1; ps.pivot = 0; ps.turnTwist = 0; }, update, post });
})();
