/* Canlılık katmanı (order 30): karakterin klip oynatan bir kukla gibi değil, yaşayan biri gibi durması için küçük ek hareketler.
   Hepsi `post` içinde, mixer kemikleri yazdıktan SONRA, klibin üstüne EK dönüş olarak verilir; hiçbir klip ağırlığına dokunulmaz.
     1. Bakış   : baş + boyun (+ omurganın küçük payı) kameranın baktığı yöne ve gidiş yönüne döner (yay-sönüm).
     2. Nefes   : göğüs, omuz; ps.yorgunluk ile derinleşir ve hızlanır.
     3. Duruş   : ağırlık aktarma, etrafa bakınma, omuz gevşetme, boyun esnetme, iç çekme (tohumlu rastgele zamanlama).
     4. Atalet  : hızlanma/yavaşlama ve dönüşte gövde, baş, kollarda gecikme ve küçük taşma.
     5. İniş    : yere değince baş ve omuzlarda sönümlü sarsıntı.
   Eksenler "karakter uzayı"ndadır (kök düğüme göre): +Y yukarı, +Z ileri, +X karakterin solu.
     egim (x) + = öne eğilme/aşağı bakma · yon (y) + = sola dönme · yat (z) + = sağa yatma (sol omuz yukarı).
   Kemiklerin kendi eksenleri varsayılmaz: her ek dönüş, ebeveyn zincirinin karakter uzayındaki dönüşüyle kemiğin yerel uzayına çevrilir.
   Bacak kemiklerine (thigh/calf/foot) dokunulmaz; pelvise yalnız çok küçük dönüş verilir, konumu değişmez.
   Yazdığı ps alanları: yorgunluk (0..1), nefes (-1..1; + = nefes alıyor), bakisYaw, bakisPitch (rad, gövdeye göre),
     agirlik (-1..1; + = ağırlık sol bacakta), durusOlay ('' | 'bakin' | 'omuz' | 'boyun' | 'ic'). */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, D = Math.PI / 180, clamp = SO.clamp, lerp = SO.lerp, wrapA = SO.wrapA;
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* Ayarlar. Açılar derece. `siddet` hepsini tek çarpanla kısar (0 = katman kapalı); bölüm çarpanları ayrı ayrı kısar. */
  const TN = SO.tune.canlilik = Object.assign({
    siddet: 1, bakis: 1, nefes: 1, durus: 1, atalet: 1, inis: 1,
    tohum: 7,                 // dururken yapılan küçük hareketlerin rastgele sırası (aynı tohum + aynı girdi = aynı hareket)
    // bakış
    bakisMaksDur: 75, bakisMaksYuru: 42, bakisMaksDepar: 20, // toplam bakış açısı sınırı (omurga + boyun + baş)
    bakisKamDur: .8, bakisKamYuru: .5, bakisKamDepar: .25,    // kamera yönüne ilgi (açının ne kadarına döner)
    bakisArkaBas: 105, bakisArkaSon: 145,                     // kamera yönü bu açıdan sonra bırakılır (arkaya bakmaya çalışmaz)
    ilgiTabanDur: .8, ilgiTabanYuru: .35, ilgiSonme: .6,       // kamera sabitken kamera yönüne ilginin indiği oran ve sönme hızı (1/sn)
    bakisOnde: .5, bakisOndeMaks: 32,                         // gidiş yönüne öncü bakış (istenen yön - gövde yönü)
    payOmurga: .2, payBoyun: .32, payBas: .48,                // toplam açının paylaşımı (omurga payı 3 kemiğe bölünür)
    basMaks: 60,                                              // baş + boyun toplam yön sınırı (klip ve donus katmanının verdiği dahil)
    bakisYay: 9, bakisSonum: .72,
    // nefes
    nefesHz: .24, nefesHzYorgun: .82, nefesGenlik: 1, nefesGenlikYorgun: 3.4,
    yorulma: 1 / 6, dinlenme: 1 / 14,                         // deparda saniyede artış, dururken saniyede azalış
    // duruş
    agirlikAci: 2, olayAra: [4, 9], agirlikAra: [4, 9],
    // atalet
    govdeAtalet: .5, kolAtalet: .4, donusGecikme: .03,
    // iniş
    inisBas: 6.5, inisOmuz: 5, inisGovde: 3.5
  }, SO.tune.canlilik || {});

  /* ---------- yay-sönüm ---------- */
  const yayYap = () => ({ x: 0, v: 0 });
  function yay(s, hedef, w, z, dt, itki) { // itki: ivme cinsinden dış sürücü (isteğe bağlı)
    const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
    for (let i = 0; i < n; i++) { s.v += ((hedef - s.x) * w * w - 2 * z * w * s.v + (itki || 0)) * h; s.x += s.v * h; }
    return s.x;
  }

  /* ---------- kemiklere karakter uzayında ek dönüş ---------- */
  const AD = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r'];
  // kendi katkımızın kemik başına üst sınırı (derece): [egim, yon, yat]
  const SINIR = { pelvis: [2, 2, 2.5], spine_01: [5, 6, 4], spine_02: [6, 8, 4], spine_03: [6, 9, 4], neck_01: [12, 25, 8], Head: [16, 38, 13], clavicle_l: [5, 5, 8], clavicle_r: [5, 5, 8], upperarm_l: [11, 5, 6], upperarm_r: [11, 5, 6] };
  const ek = {}; AD.forEach(a => ek[a] = { x: 0, y: 0, z: 0 });
  const qP = new T3.Quaternion(), qD = new T3.Quaternion(), qI = new T3.Quaternion(), eu = new T3.Euler(0, 0, 0, 'YXZ'), v3 = new T3.Vector3();
  let kok = null, B = null;
  function ebeveynQ(bone, out) { // kemiğin ebeveyn zincirinin karakter uzayındaki dönüşü (kök düğüm hariç)
    out.set(0, 0, 0, 1); for (let p = bone.parent; p && p !== kok; p = p.parent) out.premultiply(p.quaternion); return out;
  }
  function uygula(ad, k) {
    const b = B[ad], e = ek[ad], L = SINIR[ad]; if (!b) return;
    const x = clamp(e.x * k, -L[0], L[0]) * D, y = clamp(e.y * k, -L[1], L[1]) * D, z = clamp(e.z * k, -L[2], L[2]) * D;
    if (Math.abs(x) + Math.abs(y) + Math.abs(z) < 1e-6) return;
    qD.setFromEuler(eu.set(x, y, z, 'YXZ')); ebeveynQ(b, qP); qI.copy(qP).invert();
    b.quaternion.premultiply(qP).premultiply(qD).premultiply(qI); // yerel' = P⁻¹ · ek · P · yerel
  }

  /* ---------- durum ---------- */
  let rnd, basOn = null, sonT = -1;
  const S = {
    yorgunluk: 0, nefesFaz: 0, nefes: 0, icCek: 0,
    by: yayYap(), bp: yayYap(),                   // bakış: yön, eğim (derece)
    pkam: null, ilgi: 1, pvx: 0, pvz: 0, af: 0, al: 0, pyaw: null, yawHiz: 0, ilk: true,
    gP: yayYap(), bP: yayYap(), kP: yayYap(), gR: yayYap(), gT: yayYap(), kT: yayYap(), // atalet yayları (derece)
    iB: yayYap(), iO: yayYap(), sonInis: -9,      // iniş: baş, omuz
    durT: 0, durW: 0, ag: yayYap(), agHedef: 0, agSonra: 0, agYon: 1,
    olay: null, olaySonra: 0, sonTur: '', bakinYaw: 0, bakinPitch: 0, salT: 0
  };
  const ara = a => a[0] + (a[1] - a[0]) * rnd();

  function olaySec() {
    const turler = ['bakin', 'bakin', 'omuz', 'boyun', 'ic'].filter(t => t !== S.sonTur); const tur = turler[Math.floor(rnd() * turler.length)]; S.sonTur = tur;
    const o = { tur, t: 0, yon: rnd() < .5 ? -1 : 1 };
    if (tur === 'bakin') { // bir yana bak, bazen öbür yana da bak, sonra öne dön
      o.adim = [{ sure: .9 + rnd() * 1.4, yaw: o.yon * (24 + rnd() * 30), pitch: -4 + rnd() * 10 }];
      if (rnd() < .45) o.adim.push({ sure: .8 + rnd() * 1.2, yaw: -o.yon * (18 + rnd() * 28), pitch: -3 + rnd() * 8 });
      o.sure = o.adim.reduce((a, s) => a + s.sure, 0);
    } else if (tur === 'omuz') { o.sure = 1.7 + rnd() * .6; o.fark = .7 + rnd() * .6; }
    else if (tur === 'boyun') { o.sure = 2.4 + rnd() * .8; o.iki = rnd() < .5; if (o.iki) o.sure *= 1.5; o.aci = 8 + rnd() * 5; }
    else { o.sure = 3.2 + rnd() * .8; }
    return o;
  }

  function post(ctx, dt) {
    const ps = ctx.ps, cam = SO.cam || { yaw: ps.yaw, pitch: .16 }, K = TN.siddet;
    if (!(dt > 0) || K <= 0) { if (K > 0 && sonT >= 0) yenidenUygula(K); return; }
    AD.forEach(a => { const e = ek[a]; e.x = e.y = e.z = 0; });
    const hiz = ps.speed, yerde = ps.grounded, hareket = ss(.25, 1.3, hiz), depar = ss(tnv('jog') + .4, tnv('sprint') - .4, hiz);

    /* ---- ölçümler: karakter uzayında ivme, dönüş hızı ---- */
    if (S.ilk) { S.pvx = ps.vx; S.pvz = ps.vz; S.pyaw = ps.yaw; S.ilk = false; }
    const ax = clamp((ps.vx - S.pvx) / dt, -30, 30), az = clamp((ps.vz - S.pvz) / dt, -30, 30), sy = Math.sin(ps.yaw), cy = Math.cos(ps.yaw);
    S.pvx = ps.vx; S.pvz = ps.vz;
    S.af = SO.damp(S.af, clamp(ax * sy + az * cy, -22, 22), 28, dt); S.al = SO.damp(S.al, clamp(ax * cy - az * sy, -15, 15), 28, dt);
    S.yawHiz = SO.damp(S.yawHiz, clamp(wrapA(ps.yaw - S.pyaw) / dt, -12, 12), 30, dt); S.pyaw = ps.yaw;

    /* ---- yorgunluk ve nefes ---- */
    const kosu = ss(SO.tune.walk + .5, SO.tune.jog - .3, hiz);
    if (depar > .02) S.yorgunluk += TN.yorulma * dt * depar;
    else if (kosu > .5) S.yorgunluk += (S.yorgunluk < .3 ? .02 : -.012) * dt;       // hafif koşu: hafif bir soluk soluğalıkta dengelenir
    else S.yorgunluk -= TN.dinlenme * dt * lerp(1, .55, hareket) * lerp(.6, 1.2, S.yorgunluk); // yürürken daha yavaş dinlenir; son kısmı uzun sürer
    S.yorgunluk = clamp(S.yorgunluk, 0, 1); const yo = S.yorgunluk, yoE = Math.pow(yo, .8);
    S.icCek = Math.max(0, S.icCek);
    const hz = lerp(TN.nefesHz, TN.nefesHzYorgun, yoE) * (1 - .35 * S.icCek);
    S.nefesFaz = (S.nefesFaz + SO.TAU * hz * dt) % SO.TAU;
    S.nefes = Math.sin(S.nefesFaz + .45 * Math.sin(S.nefesFaz)); // nefes alma verişten biraz daha kısa
    const nA = TN.nefes * (lerp(TN.nefesGenlik, TN.nefesGenlikYorgun, yoE) + 1.9 * S.icCek) * lerp(1, .55, hareket), nf = S.nefes * nA, nfP = (S.nefes * .5 + .5) * nA;
    ek.spine_02.x -= .45 * nf; ek.spine_03.x -= .7 * nf;                              // göğüs açılır
    ek.neck_01.x += .5 * nf * (1 - .5 * yo); ek.Head.x += .55 * nf * (1 - .6 * yo);   // baş yerinde kalır; yorgunken nefesle birlikte oynar
    ek.clavicle_l.z += .95 * nfP; ek.clavicle_r.z -= .95 * nfP;                       // omuzlar kalkar
    ek.upperarm_l.z -= .6 * nfP; ek.upperarm_r.z += .6 * nfP;                         // kollar sarkık kalır
    // yorgun duruş: gövde biraz öne kamburlaşır, baş kalkık kalır (yalnız yavaşken)
    const yd = yo * yo * (1 - hareket) * TN.nefes; ek.spine_01.x += 1.8 * yd; ek.spine_02.x += 2 * yd; ek.neck_01.x -= 1.2 * yd; ek.Head.x -= 1.6 * yd;

    /* ---- dururken: ağırlık aktarma ve seyrek küçük hareketler ---- */
    const duruyor = yerde && hiz < .12 && ps.wantMag < .08 && (ps.airBlend || 0) < .05;
    if (duruyor) S.durT += dt; else { S.durT = 0; S.olay = null; S.agHedef = 0; }
    S.durW = SO.damp(S.durW, duruyor && S.durT > .35 ? 1 : 0, duruyor ? 2.5 : 9, dt);
    if (duruyor) {
      if (S.durT - dt <= 0) { S.agSonra = 1.2 + rnd() * 1.6; S.olaySonra = 2.4 + rnd() * 2.2; }
      if (S.durT > S.agSonra) { // ağırlığı öbür bacağa ver (bazen ortada kal)
        if (rnd() < .82) { S.agYon = -S.agYon; S.agHedef = S.agYon * (.65 + .35 * rnd()); } else S.agHedef = S.agYon * .15;
        S.agSonra = S.durT + ara(TN.agirlikAra);
      }
      if (!S.olay && S.durT > S.olaySonra) S.olay = olaySec();
    }
    yay(S.ag, S.agHedef, duruyor ? 2.3 : 6, 1, dt);
    S.salT += dt; const dW = S.durW * TN.durus, a = S.ag.x * TN.agirlikAci * TN.durus;
    // kalça ağırlık bacağına doğru hafifçe kalkar, omuzlar karşı yönde dengeler, baş düz kalır
    ek.pelvis.z -= a; ek.pelvis.y += .5 * a; ek.spine_01.z += 1.0 * a; ek.spine_02.z += .8 * a; ek.spine_03.z += .5 * a; ek.spine_02.y -= .5 * a;
    ek.neck_01.z -= .6 * a; ek.Head.z -= .6 * a; ek.upperarm_l.z -= 1.0 * a; ek.upperarm_r.z -= 1.0 * a;
    // çok yavaş salınım (denge): Idle döngüsüyle çakışmayan iki periyot
    const s1 = Math.sin(S.salT * .53 + 1.3), s2 = Math.sin(S.salT * .31 + .4), s3 = Math.sin(S.salT * .83);
    ek.spine_01.z += .35 * s1 * dW; ek.spine_02.x += .3 * s2 * dW; ek.spine_03.y += .5 * s3 * dW; ek.Head.z -= .3 * s1 * dW; ek.Head.y += .8 * s2 * dW; ek.Head.x -= .3 * s2 * dW;
    S.bakinYaw = 0; S.bakinPitch = 0; let icHedef = 0;
    if (S.olay) {
      const o = S.olay; o.t += dt; const u = clamp(o.t / o.sure, 0, 1), zarf = Math.sin(Math.PI * u) ** 2 * TN.durus;
      if (o.tur === 'bakin') { let t = o.t; for (const s of o.adim) { if (t < s.sure) { S.bakinYaw = s.yaw * TN.durus; S.bakinPitch = s.pitch * TN.durus; break; } t -= s.sure; } }
      else if (o.tur === 'omuz') { // omuzları kaldırıp bırakma, hafif geriye açma
        ek.clavicle_l.z += 5.5 * zarf * o.fark; ek.clavicle_r.z -= 5.5 * zarf * (2 - o.fark); ek.upperarm_l.z -= 3.5 * zarf * o.fark; ek.upperarm_r.z += 3.5 * zarf * (2 - o.fark);
        ek.spine_03.x -= 1.6 * zarf; ek.Head.x -= 2.2 * zarf; ek.Head.z += 1.5 * zarf * (o.fark - 1) * 3;
      } else if (o.tur === 'boyun') { // başı omza doğru yatırıp boynu esnetme (bazen iki yana)
        const e = (o.iki ? Math.sin(SO.TAU * u) * Math.sin(Math.PI * u) * 1.25 : Math.sin(Math.PI * u) ** 2) * TN.durus; ek.Head.z += o.yon * o.aci * .65 * e; ek.neck_01.z += o.yon * o.aci * .35 * e; ek.Head.x += 2 * Math.abs(e);
      } else icHedef = Math.sin(Math.PI * u); // iç çekme: bir iki derin nefes
      if (o.t >= o.sure) { S.olay = null; S.olaySonra = S.durT + ara(TN.olayAra); }
    }
    S.icCek = SO.damp(S.icCek, icHedef * TN.durus, 4, dt);

    /* ---- atalet: hızlanma/yavaşlama ve dönüşte gecikme, taşma ---- */
    const A = TN.atalet, afS = S.af * (S.af > 0 ? .5 : 1) / D; // hızlanırken yarı etkili (öne yatma donus katmanında)
    yay(S.gP, 0, 11, .5, dt, -TN.govdeAtalet * afS * yerdeK(ps));   // ani duruşta gövde öne gidip geri gelir
    yay(S.bP, 0, 8, .45, dt, -.3 * afS);                             // baş gövdeden biraz sonra
    yay(S.kP, 0, 7, .4, dt, TN.kolAtalet * afS);                     // kollar en son (duruşta öne savrulur)
    yay(S.gR, 0, 10, .5, dt, .2 * S.al / D);                         // yana ivmede gövde karşı yana kalır
    yay(S.gT, clamp(-TN.donusGecikme * S.yawHiz / D, -9, 9), 12, .55, dt); // dönüşte omuzlar geriden gelir
    yay(S.kT, clamp(.045 * S.yawHiz / D, -10, 10), 8, .45, dt);     // kollar daha da geriden
    const gP = clamp(S.gP.x, -7, 7) * A, bP = clamp(S.bP.x, -6, 6) * A, kP = clamp(S.kP.x, -9, 9) * A, gR = clamp(S.gR.x, -2.5, 2.5) * A, gT = S.gT.x * A, kT = S.kT.x * A;
    ek.spine_01.x += .3 * gP; ek.spine_02.x += .35 * gP; ek.spine_03.x += .35 * gP; ek.Head.x += bP - .5 * gP;
    ek.spine_01.z += .4 * gR; ek.spine_03.z += .6 * gR; ek.Head.z -= .6 * gR;
    ek.spine_02.y += .4 * gT; ek.spine_03.y += .6 * gT; ek.neck_01.y -= .5 * gT; ek.Head.y -= .5 * gT;
    ek.upperarm_l.x += kP - kT; ek.upperarm_r.x += kP + kT;

    /* ---- yere iniş: baş ve omuzlarda sönümlü sarsıntı ---- */
    if (ps.landedAt !== S.sonInis) {
      if (S.sonInis > -9 || ps.landedAt > 0) { const k = clamp((ps.fallSpeed - 1.5) / 7, 0, 1.25) * TN.inis; S.iB.v += 13 * TN.inisBas / .63 * k; S.iO.v += 11 * TN.inisOmuz / .6 * k; S.gP.v += 11 * TN.inisGovde / .55 * k; S.kP.v -= 30 * k; } // ilk hız = istenen tepe açı × yay sıklığı / sönüm payı
      S.sonInis = ps.landedAt;
    }
    yay(S.iB, 0, 13, .36, dt); yay(S.iO, 0, 11, .4, dt);
    const iB = clamp(S.iB.x, -9, 9), iO = clamp(S.iO.x, -7, 7);
    ek.neck_01.x += .4 * iB; ek.Head.x += .6 * iB; ek.clavicle_l.z -= iO; ek.clavicle_r.z += iO; ek.upperarm_l.z += .5 * iO; ek.upperarm_r.z -= .5 * iO;

    /* ---- bakış ---- */
    const maks = lerp(lerp(TN.bakisMaksDur, TN.bakisMaksYuru, hareket), TN.bakisMaksDepar, depar);
    const kamK = lerp(lerp(TN.bakisKamDur, TN.bakisKamYuru, hareket), TN.bakisKamDepar, depar);
    const kr = wrapA(cam.yaw - ps.yaw) / D, kra = Math.abs(kr);
    // kamera arkadan öne geçtikçe (karakter kameraya doğru yürürken) kamera yönü bırakılır: ne arkaya bakmaya çalışır ne kameraya dik dik bakar
    const kamW = 1 - ss(lerp(TN.bakisArkaBas, TN.bakisArkaBas - 12, hareket), lerp(TN.bakisArkaSon, TN.bakisArkaSon - 12, hareket), kra);
    // ilgi: oyuncu kamerayı çevirirken tam ilgi; kamera sabit kalınca (ör. ekrana göre yana koşarken) bakış yavaşça öne döner
    const kamHiz = S.pkam == null ? 0 : Math.abs(wrapA(cam.yaw - S.pkam)) / dt; S.pkam = cam.yaw;
    const taban = lerp(TN.ilgiTabanDur, TN.ilgiTabanYuru, hareket), ilgiH = kamHiz > .12 ? 1 : taban; S.ilgi = SO.damp(S.ilgi, ilgiH, ilgiH > S.ilgi ? 7 : TN.ilgiSonme, dt);
    let hy = clamp(kr * kamK, -maks, maks) * kamW * S.ilgi, hp = clamp(((cam.pitch == null ? .16 : cam.pitch) - .16) / D * .3, -6, 13) * kamW * (1 - .5 * depar);
    if (ps.wantMag > .08) hy += clamp(wrapA(Math.atan2(ps.wantX, ps.wantZ) - ps.yaw) / D * TN.bakisOnde, -TN.bakisOndeMaks, TN.bakisOndeMaks); // baş dönüşe önce girer
    hy += clamp(S.yawHiz * .07 / D, -10, 10) * hareket;
    hy += S.bakinYaw * S.durW; hp += S.bakinPitch * S.durW;
    hy = clamp(hy, -maks, maks) * TN.bakis; hp *= TN.bakis;
    const w = lerp(S.olay && S.olay.tur === 'bakin' ? 6 : 7.5, TN.bakisYay + 1, hareket);
    yay(S.by, hy, w, TN.bakisSonum, dt); yay(S.bp, hp, w, TN.bakisSonum + .1, dt);
    let by = clamp(S.by.x, -maks - 6, maks + 6); const bpv = clamp(S.bp.x, -12, 16);
    // toplam sınır: klibin ve donus katmanının başa verdiği yön + bizimki boyun sınırını aşmasın
    const onYaw = basYonu(), bn = (TN.payBoyun + TN.payBas) * K;
    if (bn > 1e-4) { const digerleri = ek.neck_01.y + ek.Head.y; by = clamp(by, (-TN.basMaks - onYaw - digerleri * K) / bn, (TN.basMaks - onYaw - digerleri * K) / bn); if (Math.abs(onYaw) > TN.basMaks) by = Math.abs(by) < 1 ? by : 0; }
    const po = TN.payOmurga * lerp(1, .6, depar);
    ek.spine_01.y += by * po * .2; ek.spine_02.y += by * po * .35; ek.spine_03.y += by * po * .45;
    ek.neck_01.y += by * TN.payBoyun; ek.Head.y += by * TN.payBas;
    ek.neck_01.x += bpv * .4; ek.Head.x += bpv * .6; ek.Head.z -= by * .05; // yana bakarken çok hafif baş yatması

    for (let i = 0; i < AD.length; i++) uygula(AD[i], K);
    sonT = ctx.time;
    ps.yorgunluk = S.yorgunluk; ps.nefes = S.nefes; ps.bakisYaw = by * K * D; ps.bakisPitch = bpv * K * D; ps.agirlik = -S.ag.x; ps.durusOlay = S.olay ? S.olay.tur : '';
  }
  const tnv = k => SO.tune[k];
  const yerdeK = ps => ps.grounded ? 1 : .4;
  function yenidenUygula(K) { for (let i = 0; i < AD.length; i++) uygula(AD[i], K); } // dt = 0 karesi: durum ilerlemez, son ek dönüşler yeniden verilir
  function basYonu() { // başın şu anki (klip + önceki katmanlar) yönü, karakter uzayında, derece (+ = sola)
    if (!basOn || !B.Head) return 0; ebeveynQ(B.Head, qP).multiply(B.Head.quaternion); v3.copy(basOn).applyQuaternion(qP);
    return Math.atan2(v3.x, v3.z) / D;
  }

  SO.anim.register({
    name: 'canlilik', order: 30,
    init(ctx) {
      kok = ctx.char.root; B = ctx.bones; rnd = SO.rnd(TN.tohum);
      // başın "ileri" ekseni: dinlenme duruşunda karakterin +Z'sine bakan yerel eksen (kemik eksenleri varsayılmaz)
      if (B.Head) { ebeveynQ(B.Head, qP).multiply(B.Head.quaternion); basOn = new T3.Vector3(0, 0, 1).applyQuaternion(qP.invert()); }
      S.agYon = rnd() < .5 ? -1 : 1;
    },
    post
  });
  SO.canlilik = { durum: S, ek }; // inceleme için
})();
