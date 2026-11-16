/* Toplama katmanı (order 26; gövde düzeltmesi 36, kol çözümü 46): yerden bir şey alma (eğil, uzan, kavra, doğrul).
   Neyin alınacağına `toplama.js` karar verir ve SO.toplaAnim.basla(x, y, z) çağırır; bu katman yalnız hareketi oynatır.

   KLİP: `Farm_Harvest` (2,5 sn; sağ elle yerden bir şey koparma). Ölçüm (kök sabit, sağ bilek / omuz / kalça yüksekliği, m):
     0,00 dik duruş (bilek 0,92) · 0,31 bilek 0,74 · 0,50 bilek 0,48, omuz 1,01 · 0,69 bilek 0,31, omuz 0,85, el AÇIK (ilk alçak nokta)
     0,69–1,00 el havada bekler · 1,12–1,19 bilek 0,26, omuz 0,80, kalça 0,71, el KAPALI (kavrama; en alçak nokta) · 1,31–1,60 el 0,55'e kalkar
     1,60–2,25 doğrulma · 2,25–2,50 dik duruş.   Kol: üst 0,274 + ön 0,273 m; bilek → parmak ucu ≈ 0,20 m. Ayaklar klip boyunca yerinden oynamaz.
   Klip olduğu gibi çok uzun (iniş 0,69 + bekleme 0,45 + kalkış 1,1 sn) ve el yere değmiyor (parmak ucu 0,15 m'de kalıyor). Bu yüzden:
     - zaman sıkıştırılır: iniş klibin 0,10–0,66 arası (T.inSure), sonunda 1,15'teki kavrama pozuna geçilir (aynı klibin dondurulmuş kopyası; aradaki
       bekleme atlanır), kalkış 1,15–2,25 arası (T.kalkSure);
     - derinlik: bileğin hedefe inebilmesi için omuz, hedefin en çok T.omuzPay kadar üstünde olmalı; eksik kalan kadar kalça indirilir (dizler bükülür,
       bilekler iki kemikli çözümle yerinde tutulur) ve bel biraz daha eğilir;
     - sağ kol iki kemikli ters kinematikle nesneye uzanır (dünya uzayında; bilek nesnenin T.bilekYuk kadar üstüne gelir, parmaklar nesnede).

   ZAMAN ÇİZELGESİ (düğmeye basıştan; duran karakter):
     0,00–0,30 iniş (0,12 sn'de taban hareketin yerini alır; kol çözümü 0,10'dan sonra açılır)
     0,30      EL DEĞDİ: S.deger bir kare boyunca true (toplama.js nesneyi kaldırır, sayacı artırır, sesi gönderir)
     0,30–0,36 kavrama
     0,36–0,78 doğrulma (0,60'tan sonra taban harekete geri karışır; hız kısması 0,53'te gevşemeye başlar, 0,72'de biter)
   Art arda alma: doğrulmanın ilk bölümünde (S.v < T.zincirV) yeniden `basla` çağrılırsa karakter doğrulmadan bulunduğu pozdan yeniden iner
   (T.zincirSure); böylece ikinci ve sonraki nesneler ≈ 0,35–0,45 sn arayla alınır.

   Yazdığı alanlar: ps.topla (alış sürüyor mu), ps.toplaFaz ('' | 'in' | 'tut' | 'kalk'), ps.toplaBlend (0..1; tam beden klibinin payı),
   ps.toplaYavas (hız çarpanı 0..1; 1 = kısma yok. FİZİK OKUMALI: hedef hız bununla çarpılır; bu katman ps.speedScale'e dokunmaz).
   Her kare ps.airBlend = max(ps.airBlend, ps.toplaBlend): taban hareket (hareket.js) böyle bastırılır (tırmanmadaki yol). ps.ikKapat'a dokunmaz:
   ayak yerleştirme açık kalır (eğimde ayaklar yere basar). Çubuk itilmiyorken ps.yaw'ı nesneye doğru çevirir (donus.js çubuk boşken yönü tutar).
   Yerden kesilince, yüzmeye/tırmanmaya geçince alış iptal olur (S.iptal bir kare true; el değmediyse nesne alınmaz).
   Duruş: durus.js bu katmanın payını 'hava' sayıp göğsü/başı kaldırır; gövde `post`unda (order 36) o düzeltme geri alınıp yerine dik duruştan
   eğik duruşa giden kendi düzeltmesi konur (T.duzelt). Dokunduğu kemikler: pelvis (konum), spine_01, spine_03, neck_01, Head, thigh/calf/foot_l/r (36);
   upperarm_r, lowerarm_r (46). Ayarlar SO.tune.toplama, ölçüm SO.toplaAnim.durum.
   Deneme: node test/cek.cjs ile `SO.input.act = true` (toplama.js bunu "AL'a basıldı" sayar). */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp, wrapA = SO.wrapA, DER = Math.PI / 180;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const T = SO.tune.toplama = Object.assign({
    on: true,
    inSure: .30, zincirSure: .24, tutSure: .06, kalkSure: .42,   // sn: iniş, zincirleme iniş, kavrama, doğrulma
    klipIn: [.10, .66], klipAlt: 1.15, klipKalk: [1.15, 2.25],   // Farm_Harvest zamanları (sn)
    gir: .12, cik: .2, cikBas: .58,       // taban hareketin yerini alma / geri bırakma süresi (sn); doğrulmanın şu kesrinden sonra bırakılır
    zincirV: .5,                          // doğrulmanın bu kesrine kadar yeniden inilebilir
    yavas: .1, yavasCik: [.4, .85],       // alış sırasında hız çarpanı; doğrulmanın bu kesirleri arasında 1'e döner
    donHiz: 9, donK: 14,                  // nesneye dönme: en çok rad/sn, yaklaşma hızı (1/sn)
    elYan: .14,                           // sağ el gövde ekseninin bu kadar sağında çalışır (dönüş nesneyi oraya getirir)
    bilekYuk: .085,                       // bilek, nesnenin tutma noktasının bu kadar üstünde durur (parmaklar nesnede)
    omuz: .80, omuzPay: .5,               // kavrama pozunda omuz yüksekliği (ölçüm); omuz hedef bileğin en çok bu kadar üstünde olmalı
    cokPay: .7, cokEnCok: .16, belEnCok: 15, // eksik derinliğin kalçaya düşen payı, kalçanın en çok inişi (m), belin en çok ek eğilmesi (derece)
    kutu: [-.55, .2, .04, .78],           // elin uzanabildiği bölge, karaktere göre [x en az, x en çok, z en az, z en çok] (x: + = sol, z: ileri)
    duzelt: { dik: { spine_03: -22, neck_01: 3, Head: -10 }, egik: { spine_03: -8, neck_01: 0, Head: -2 } } // duruş düzeltmesi (derece; durus.js'teki gibi)
  }, SO.tune.toplama || {});

  let aA, aB, kok, B;
  // durum: u iniş 0..1, v doğrulma 0..1, w taban hareketin yerini alma 0..1, uyg bu karede kliplere uygulanan pay, ik kol/derinlik payı
  const S = { on: false, faz: '', u: 0, v: 0, t: 0, w: 0, uyg: 0, ik: 0, wB: 0, wB0: 0, tA: 0, zincir: false, sonraki: 0, ik0: 0, deger: false, iptal: false, hedef: new T3.Vector3(), el: new T3.Vector3(), elVar: false, bosluk: 0 };

  function uygun(ps) { return T.on && ps.grounded && !ps.yuzme && !ps.kilit && !(ps.tirmanBlend > .01) && !ps.jumpPhase; }
  // alışı başlat: (x, y, z) nesnenin tutma noktası (dünya). true dönerse hareket başladı; el değince S.deger bir kare true olur
  function basla(x, y, z) {
    const ps = SO.ps; if (!uygun(ps)) return false;
    if (S.on && !(S.faz === 'kalk' && S.v < T.zincirV)) return false;
    S.zincir = S.on; S.wB0 = S.zincir ? S.wB : 0; S.on = true; S.faz = 'in'; S.u = 0; S.t = 0; S.deger = false; S.hedef.set(x, y, z); return true;
  }
  const hazir = () => uygun(SO.ps) && (!S.on || (S.faz === 'kalk' && S.v < T.zincirV));

  function update(ctx, dt) {
    const ps = ctx.ps; S.deger = false; S.iptal = false; S.uyg = S.sonraki; // geçen karede duyurulan pay bu karede kliplere uygulanır
    if (S.on) {
      if (!ps.grounded || ps.yuzme || ps.kilit) { S.on = false; S.faz = ''; S.iptal = true; }
      else if (S.faz === 'in') { S.u = Math.min(1, S.u + dt / (S.zincir ? T.zincirSure : T.inSure)); if (S.u >= 1) { S.faz = 'tut'; S.t = 0; S.deger = true; } }
      else if (S.faz === 'tut') { S.t += dt; if (S.t >= T.tutSure) { S.faz = 'kalk'; S.v = 0; S.zincir = false; } }
      else if (S.faz === 'kalk') { S.v = Math.min(1, S.v + dt / T.kalkSure); if (S.v >= 1) { S.on = false; S.faz = ''; } }
    }
    // klip zamanı ve kavrama pozunun payı
    let ik = 0, yavas = 1;
    if (S.faz === 'in') {
      if (S.zincir) S.wB = lerp(S.wB0, 1, ss(0, 1, S.u)); else { S.tA = lerp(T.klipIn[0], T.klipIn[1], ss(0, 1, S.u)); S.wB = ss(.5, 1, S.u); }
      ik = S.zincir ? lerp(S.ik0 || 0, 1, ss(0, 1, S.u)) : ss(.3, 1, S.u); yavas = T.yavas;
    } else if (S.faz === 'tut') { S.wB = 1; S.tA = T.klipAlt; ik = 1; yavas = T.yavas; }
    else if (S.faz === 'kalk') { const e = 1 - (1 - S.v) * (1 - S.v); S.tA = lerp(T.klipKalk[0], T.klipKalk[1], e); S.wB = 1 - ss(0, .2, S.v); ik = 1 - ss(0, .32, S.v); S.ik0 = ik; yavas = lerp(T.yavas, 1, ss(T.yavasCik[0], T.yavasCik[1], S.v)); }
    S.ik = ik;
    const hedefW = S.on && !(S.faz === 'kalk' && S.v > T.cikBas) ? 1 : 0;
    S.w = clamp(S.w + (hedefW ? dt / T.gir : -dt / T.cik), 0, 1);
    const tb = S.w * S.w * (3 - 2 * S.w);
    // taban hareket bu kareye geçen karede duyurulan payla girdi (hareket.js order 10): klipler de o payla oynar, toplam hep 1 kalır
    aA.time = S.tA; aA.setEffectiveWeight(S.uyg * (1 - S.wB)); aB.setEffectiveWeight(S.uyg * S.wB);
    ps.toplaBlend = tb; ps.topla = S.on; ps.toplaFaz = S.faz; ps.toplaYavas = S.on ? yavas : 1;
    if (S.uyg > 0 || tb > 0) ps.airBlend = Math.max(ps.airBlend || 0, tb);
    S.sonraki = tb;
    // çubuk boşken nesneye dön: nesne sağ elin önüne gelsin
    if (S.on && S.faz !== 'kalk' && ps.wantMag < .08 && dt > 0) {
      const dx = S.hedef.x - ps.x, dz = S.hedef.z - ps.z, d = Math.hypot(dx, dz);
      if (d > .22) { const ist = Math.atan2(dx, dz) + Math.atan2(T.elYan, d), e = wrapA(ist - ps.yaw), adim = clamp(e * (1 - Math.exp(-T.donK * dt)), -T.donHiz * dt, T.donHiz * dt); ps.yaw = wrapA(ps.yaw + adim); }
    }
  }

  /* ---------- kemik yardımcıları ---------- */
  const X = new T3.Vector3(1, 0, 0), qP = new T3.Quaternion(), qR = new T3.Quaternion(), qI = new T3.Quaternion(), qW = new T3.Quaternion();
  const A = new T3.Vector3(), Bv = new T3.Vector3(), C = new T3.Vector3(), Hd = new T3.Vector3(), Dir = new T3.Vector3(), Yon = new T3.Vector3(), Kut = new T3.Vector3(), E2 = new T3.Vector3(), P1 = new T3.Vector3(), P2 = new T3.Vector3(), tmp = new T3.Vector3(), sc = new T3.Vector3();
  // kemiği karakter uzayında (kök düğüme göre) bir eksen çevresinde döndür (X: + = öne eğilme)
  function don(b, eksen, aci) { if (!b || Math.abs(aci) < 1e-5) return; qP.set(0, 0, 0, 1); for (let p = b.parent; p && p !== kok; p = p.parent) qP.premultiply(p.quaternion); qR.setFromAxisAngle(eksen, aci); qI.copy(qP).invert(); b.quaternion.premultiply(qP).premultiply(qR).premultiply(qI); }
  function dunyaDon(kemik, q) { kemik.parent.getWorldQuaternion(qW); qI.copy(qW).invert(); kemik.quaternion.premultiply(qW).premultiply(q).premultiply(qI); kemik.updateMatrixWorld(true); }
  // iki kemikli çözüm, dünya uzayında: uç (el/bilek) hedefe gider; kutup verilirse dirsek/diz o yöne, verilmezse şimdiki bükülme düzleminde kalır
  function ikiKemik(ust, alt, uc, hedef, kutup, w) {
    ust.getWorldPosition(A); alt.getWorldPosition(Bv); uc.getWorldPosition(C);
    const l1 = A.distanceTo(Bv), l2 = Bv.distanceTo(C); Hd.copy(C).lerp(hedef, w);
    Dir.subVectors(Hd, A); const d = clamp(Dir.length(), Math.abs(l1 - l2) + .01, (l1 + l2) * .995); Dir.normalize();
    const ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
    Yon.subVectors(Bv, A); Yon.addScaledVector(Dir, -Yon.dot(Dir));
    if (kutup) { Kut.copy(kutup).addScaledVector(Dir, -kutup.dot(Dir)); if (Kut.lengthSq() < 1e-6) Kut.copy(Yon); Kut.normalize(); if (Yon.lengthSq() > 1e-6) { Yon.normalize(); Kut.multiplyScalar(w).addScaledVector(Yon, 1 - w); } }
    else Kut.copy(Yon);
    if (Kut.lengthSq() < 1e-8) return; Kut.normalize();
    E2.copy(A).addScaledVector(Dir, l1 * ca).addScaledVector(Kut, l1 * sa);
    P1.subVectors(Bv, A).normalize(); P2.subVectors(E2, A).normalize(); qR.setFromUnitVectors(P1, P2); dunyaDon(ust, qR);
    alt.getWorldPosition(Bv); uc.getWorldPosition(C); Hd.copy(A).addScaledVector(Dir, d);
    P1.subVectors(C, Bv).normalize(); P2.subVectors(Hd, Bv).normalize(); qR.setFromUnitVectors(P1, P2); dunyaDon(alt, qR);
  }

  /* ---------- gövde (order 36: durus'tan sonra, ayak'tan önce): duruş düzeltmesi + derinlik ---------- */
  const ZINCIR = ['spine_03', 'neck_01', 'Head'], F0 = [new T3.Vector3(), new T3.Vector3()], Q0 = [new T3.Quaternion(), new T3.Quaternion()], pv = new T3.Vector3();
  function govdePost(ctx) {
    const k = S.uyg; if (k < .002) return;
    const ps = ctx.ps, acik = 1 - clamp(ps.ikKapat || 0, 0, 1), g = S.ik;
    kok.position.set(ps.x, ps.y, ps.z); kok.rotation.order = 'YXZ'; kok.rotation.set(ps.leanFwd || 0, ps.yaw, ps.lean || 0); kok.updateMatrixWorld(true);
    // durus.js'in 'hava' düzeltmesi geri alınır, yerine dik → eğik düzeltme konur (zincir: her kemik, üstündekinin payı düşülerek döner)
    const dz = SO.tune.durus, hava = dz && dz.on !== false && dz.duzelt && dz.duzelt.hava ? dz.duzelt.hava : null; let once = 0;
    for (const ad of ZINCIR) { const a = (lerp(T.duzelt.dik[ad], T.duzelt.egik[ad], g) - (hava ? (hava[ad] || 0) * acik : 0)) * DER * k; don(B[ad], X, a - once); once = a; }
    // derinlik: omuz hedef bileğin omuzPay kadar üstüne insin
    const bilek = S.hedef.y + T.bilekYuk - ps.y, eksik = clamp(T.omuz - (bilek + T.omuzPay), 0, T.cokEnCok + .5 * Math.sin(T.belEnCok * DER));
    const cok = Math.min(T.cokEnCok, eksik * T.cokPay) * g * k, bel = clamp((eksik - Math.min(T.cokEnCok, eksik * T.cokPay)) / .5, 0, Math.sin(T.belEnCok * DER)) * g * k;
    S.bosluk = eksik;
    if (cok < 1e-4 && bel < 1e-4) return;
    const bacak = [[B.thigh_l, B.calf_l, B.foot_l], [B.thigh_r, B.calf_r, B.foot_r]];
    bacak.forEach((L, i) => { L[2].getWorldPosition(F0[i]); L[2].getWorldQuaternion(Q0[i]); });
    B.pelvis.getWorldPosition(pv); pv.y -= cok; B.pelvis.parent.worldToLocal(pv); B.pelvis.position.copy(pv);
    don(B.spine_01, X, Math.asin(bel)); B.pelvis.updateMatrixWorld(true);
    bacak.forEach((L, i) => { ikiKemik(L[0], L[1], L[2], F0[i], null, 1); L[2].parent.getWorldQuaternion(qW); L[2].quaternion.copy(qW.invert()).multiply(Q0[i]); L[2].updateMatrixWorld(true); });
  }

  /* ---------- kol (order 46: ayak'tan sonra, omuz son yerindeyken) ---------- */
  const Hw = new T3.Vector3(), Kw = new T3.Vector3();
  function kolPost(ctx) {
    S.elVar = false; if (S.uyg < .002 && !S.on) return;
    const ps = ctx.ps, w = S.uyg * S.ik;
    kok.position.set(ps.x, ps.y + (ps.rootDy || 0), ps.z); kok.rotation.order = 'YXZ'; kok.rotation.set(ps.leanFwd || 0, ps.yaw, ps.lean || 0); kok.updateMatrixWorld(true);
    if (w > .002) {
      // hedef: nesnenin üstü; karaktere göre uzanılabilir bölgeye sıkıştırılır (arkadaki/uzaktaki nesneye kol ters dönmesin)
      Hw.copy(S.hedef); Hw.y += T.bilekYuk; kok.worldToLocal(Hw); Hw.x = clamp(Hw.x, T.kutu[0], T.kutu[1]); Hw.z = clamp(Hw.z, T.kutu[2], T.kutu[3]); Hw.y = Math.max(Hw.y, .04); kok.localToWorld(Hw);
      Kw.set(-.75, .3, -.6).transformDirection(kok.matrixWorld); // dirsek: dışa (sağa) ve geriye
      ikiKemik(B.upperarm_r, B.lowerarm_r, B.hand_r, Hw, Kw, w);
    }
    // elin yeri (avuç ortası): toplama.js nesneyi son anda buraya çeker
    B.hand_r.getWorldPosition(S.el); const orta = B.middle_01_r; if (orta) { orta.getWorldPosition(tmp); S.el.lerp(tmp, .8); } S.elVar = true;
  }

  SO.toplaAnim = { basla, hazir, uygun: () => uygun(SO.ps), durum: S };
  SO.anim.register({ name: 'toplama', order: 26,
    init(ctx) { const ps = ctx.ps, m = ctx.mixer; kok = ctx.char.root; B = ctx.bones;
      aA = ctx.action('Farm_Harvest'); aA.timeScale = 0;
      const c = ctx.clips.Farm_Harvest.clone(); c.name = 'Topla_Kavra'; aB = m.clipAction(c); aB.enabled = true; aB.setEffectiveWeight(0); aB.play(); aB.timeScale = 0; aB.time = T.klipAlt;
      ps.topla = false; ps.toplaFaz = ''; ps.toplaBlend = 0; ps.toplaYavas = 1; },
    update(ctx, dt) { update(ctx, dt); aB.time = T.klipAlt; } });
  SO.anim.register({ name: 'toplamaGovde', order: 36, post: govdePost });
  SO.anim.register({ name: 'toplamaKol', order: 46, post: kolPost });
})();
