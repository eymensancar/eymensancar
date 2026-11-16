/* Duruş katmanı (order 35: canlilik'ten sonra, ayak'tan önce): yandan bakınca "beli ağrıyor da kıvrılmış" görünen duruşu düzeltir.

   KAYNAK (ölçüm, deri bağlama duruşuna göre öne eğim, derece; klip tek başına, öteki katmanlar kapalı, sabit hızda döngü ortalaması):
     klip          pelvis  spine_01  spine_02  spine_03  neck_01  Head    gövde (pelvis→boyun doğrusu)   kalça yüksekliği (m)
     A_TPose        -1.9     1.2      -3.1      11.1     -6.0      0.2      —                            0.949 (bağlama duruşu)
     Idle_Loop      -6.4    -3.4       2.7      27.0      0.0     12.8      7.6                          0.873 (diz 156°)
     Walk_Loop      -2.0     1.2       6.0      29.2      3.1     15.0     11.5                          0.865–0.918
     Jog_Fwd_Loop    3.8     6.9      21.7      52.6     19.1     20.9     25.3                          0.701–0.946
     Sprint_Loop    20.8    23.9      34.3      62.0     31.6     22.8     39.0                          0.796–0.935
     Jump_Loop     -16.2   -13.1       3.5      39.1     14.1     37.2
   Yani kambur kliplerin kendisinde: her klipte göğüs (spine_03) bir alttaki omurdan 25–30° öne kırık (hareket kütüphanesinin iskeleti bu modelle birebir
   aynı değil: A_TPose klibi bile göğsü 11° öne büküyor), koşu kliplerinde üstüne gerçek bir öne eğilme var, baş da 13–23° öne düşük.
   Öteki katmanların sabit hızdaki payı: donus yalnız deparda +2,6° (deparEgim), canlilik ≈ 0°, ayak 0°. Adım ölçekleme (hareket.js) gövdeye dokunmuyor
   ama ayağı kalçaya yaklaştırırken kalçayı kaldırmadığı için dizleri büküyor (hafif koşu basışında diz 144° → 117°).

   NE YAPAR (hepsi post içinde; klip ağırlığına dokunmaz):
   1. Eğim düzeltmesi: o an oynayan taban kliplerin ağırlığıyla (dur/yürü/hafif koşu/depar; kalan pay = hava klipleri) T.duzelt tablosundaki açılar karışır,
      pelvis → spine_01..03 → neck_01 → Head zincirine karakterin sağ-sol ekseni çevresinde ek dönüş olarak verilir. Tablodaki değer o kemiğin DÜNYA eğimine
      eklenecek açıdır (kümülatif); kemiğe ebeveyniyle farkı kadar dönüş verilir. Düzeltme sabit bir açı olduğundan klibin kendi salınımı ve öteki katmanların
      (canlilik: nefes, bakış, iniş sarsıntısı; donus: ivme eğimi) ekledikleri aynen kalır. Pelvis dönünce uyluklar ters yönde döndürülür (bacaklar yerinde kalır).
   2. Üst sınır: bütün katmanlardan sonra pelvis → boyun doğrusunun dikeyle açısı (ps.leanFwd dahil) ölçülür; T.egimYumusak'tan sonrası yumuşakça bastırılır,
      toplam T.egimEnCok'u geçmez (fazlası pelvisten geri alınır). Havadayken (ps.airBlend) sınır gevşer: zıplama ve iniş çömelmesi serbest.
   3. Kalça yüksekliği: klibin dikey zıplaması oyundaki adıma göre çok büyük (hafif koşu klibi 5,5 m'lik sıçramalı adım; kalça 24 cm inip çıkıyor). Adım
      kısalınca aynı çöküş "çömelerek koşma" görünür. Kalça yüksekliği y' = hedefUst − (klipUst − y) × sik ile sıkıştırılıp kaldırılır (T.kalca); bacak
      yetişmiyorsa (yere basan ayak) kaldırma o kadar kısılır; uçuş evresinde alçaktaki ayağın yerden boşluğu da aynı oranda kısılır (yoksa karakter her adımda
      engel atlar gibi havada kalır). Dururken kalça bacağın izin verdiği kadar (≈ 1 cm) kalkar: dizler 156° → 161°, arkadaki bacak düzleşir.
   4. Bilekler 1–3'ten ÖNCEKİ dünya konumuna iki kemikli çözümle geri konur (ayağın dünya yönü de aynı kalır): ayak kayması değişmez, ayak.js bacakları
      bu hâliyle görür.
   Dokunduğu kemikler: pelvis (dönüş + konum), spine_01–03, neck_01, Head, upperarm_l/r, thigh/calf/foot_l/r. ps'e yazmaz. Kapatmak: SO.tune.durus.on = false.
   Ölçüm için SO.durus = { egim (son toplam gövde eğimi, derece), kaldir (kalça, m), indir (uçuşta ayaklar, m), kisit (üst sınırın geri aldığı derece) }.

   SONUÇ (sabit hız, bütün katmanlar açık; önce → sonra): gövde eğimi dur 7,4° → 0,6° · yürü 11,3° → 3,9° · hafif koşu 25,0° → 7,6° · depar 41,4° → 15,5°;
   baş eğimi 12,5/15/21/24° → 2,5/3/4/6°; hafif koşuda kalça 0,70–0,95 m → 0,88–0,95 m. Kalkış, duruş ve sert dönüşte en yüksek toplam eğim 21°. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, D = Math.PI / 180;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ZINCIR = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head'];
  const T = SO.tune.durus = Object.assign({
    on: true,
    /* dünya eğimine eklenecek açı (derece; + = öne). kol: üst kolun göğse göre ek açısı (+ = dirsek geriye), kolAc: kolun gövdeden yana açılması.
       Ölçülen sonuç (pelvis → boyun doğrusu): dur ≈ 1°, yürü ≈ 4°, hafif koşu ≈ 8°, depar ≈ 13° (+ donus'un 2,6°'si). */
    duzelt: {
      dur:   { pelvis: 0, spine_01: 0, spine_02: -1, spine_03: -22, neck_01: 3, Head: -10, kol: 0, kolAc: 0 },
      yuru:  { pelvis: 1.5, spine_01: 0, spine_02: -3.5, spine_03: -23, neck_01: 1, Head: -12, kol: 4, kolAc: 0 },
      kos:   { pelvis: -1, spine_01: -2.5, spine_02: -15.5, spine_03: -43, neck_01: -13, Head: -17, kol: 18, kolAc: 3 },
      depar: { pelvis: -13, spine_01: -14.5, spine_02: -23, spine_03: -47, neck_01: -21, Head: -18, kol: 16, kolAc: 3 },
      hava:  { pelvis: 0, spine_01: 0, spine_02: 0, spine_03: -15, neck_01: -6, Head: -15, kol: 0, kolAc: 0 }
    },
    egimYumusak: 18, egimEnCok: 25,     // toplam gövde eğimi (derece): bundan sonrası bastırılır / asla geçilmez
    /* kalça yüksekliği: y' = hedefUst − (klipUst − y) × sik  (y: pelvisin ps.y'den yüksekliği, m). sik = 1 ve hedefUst = klipUst: dokunma */
    kalca: {
      dur:   { klipUst: .873, hedefUst: .898, sik: 1 },
      yuru:  { klipUst: .918, hedefUst: .918, sik: 1 },
      kos:   { klipUst: .946, hedefUst: .950, sik: .3 },
      depar: { klipUst: .935, hedefUst: .950, sik: .45 }
    },
    kalcaYay: 30,                       // bacak kısıtının yumuşatması (1/sn)
    ucBos: .03,                         // ayak ucunun düz zeminde yere basarkenki yüksekliği (m): uçuş boşluğu ölçülürken
    uzanma: .995                        // kalça kaldırılırken yere basan bacak en çok boyunun bu oranına kadar uzar
  }, SO.tune.durus || {});

  const V3 = T3.Vector3, Q = T3.Quaternion, X = new V3(1, 0, 0), Z = new V3(0, 0, 1);
  const qP = new Q(), qR = new Q(), qI = new Q(), pv = new V3(), nv = new V3(), tmp = new V3(), sc = new V3();
  const A = new V3(), K = new V3(), F = new V3(), ab = new V3(), cb = new V3(), ac = new V3(), at = new V3(), ax0 = new V3(), ax1 = new V3();
  const qT = new Q(), qC = new Q(), qF = new Q(), qPar = new Q(), r0 = new Q(), r1 = new Q(), r2 = new Q(), nT = new Q(), nC = new Q();
  const acos = v => Math.acos(clamp(v, -1, 1)), wq = (o, q) => o.matrixWorld.decompose(tmp, q, sc);
  let kok = null, B = null, act = null, legs = null, kS = 0, has = false, lx = 0, lz = 0;
  const st = SO.durus = { egim: 0, kaldir: 0, kisit: 0, indir: 0 }, mix = {}, AD = ['dur', 'yuru', 'kos', 'depar', 'hava'], wgt = [0, 0, 0, 0, 0];

  // kemiği karakter uzayında (kök düğüme göre) bir eksen çevresinde döndür: yerel' = P⁻¹ · R · P · yerel   (X: + = öne eğilme)
  function don(b, eksen, aci) {
    if (!b || Math.abs(aci) < 1e-5) return;
    qP.set(0, 0, 0, 1); for (let p = b.parent; p && p !== kok; p = p.parent) qP.premultiply(p.quaternion);
    qR.setFromAxisAngle(eksen, aci); qI.copy(qP).invert(); b.quaternion.premultiply(qP).premultiply(qR).premultiply(qI);
  }
  // iki kemikli çözüm (ayak.js'teki ile aynı yöntem): bilek F'den Tg'ye gider, diz klipteki bükülme düzleminde kalır, ayağın dünya yönü korunur
  function ik(L, Tg, yaw) {
    A.setFromMatrixPosition(L.thigh.matrixWorld); K.setFromMatrixPosition(L.calf.matrixWorld); F.setFromMatrixPosition(L.foot.matrixWorld);
    if (F.distanceToSquared(Tg) < 1e-9) return;
    wq(L.thigh, qT); wq(L.calf, qC); wq(L.foot, qF); wq(L.thigh.parent, qPar);
    ab.subVectors(K, A); cb.subVectors(F, K); ac.subVectors(F, A); at.subVectors(Tg, A);
    const lab = ab.length(), lcb = cb.length(), lac = ac.length(), lat0 = at.length(); if (lab < 1e-5 || lcb < 1e-5 || lac < 1e-5 || lat0 < 1e-5) return;
    const lat = clamp(lat0, Math.abs(lab - lcb) + .02, (lab + lcb) * .998);
    const a0 = acos(ac.dot(ab) / (lac * lab)), b0 = acos(-ab.dot(cb) / (lab * lcb)), t0 = acos(ac.dot(at) / (lac * lat0));
    const a1 = acos((lab * lab + lat * lat - lcb * lcb) / (2 * lab * lat)), b1 = acos((lab * lab + lcb * lcb - lat * lat) / (2 * lab * lcb));
    ax0.crossVectors(ac, ab); if (ax0.lengthSq() < 1e-8 * lac * lac * lab * lab) { tmp.set(Math.sin(yaw), 0, Math.cos(yaw)); ax0.crossVectors(ac, tmp); } ax0.normalize();
    ax1.crossVectors(ac, at); if (ax1.lengthSq() < 1e-12) r2.set(0, 0, 0, 1); else r2.setFromAxisAngle(ax1.normalize(), t0);
    r0.setFromAxisAngle(ax0, a1 - a0); r1.setFromAxisAngle(ax0, b1 - b0);
    r2.multiply(r0); nT.copy(r2).multiply(qT); nC.copy(r2).multiply(r1).multiply(qC);
    L.thigh.quaternion.copy(qPar).invert().multiply(nT);
    L.calf.quaternion.copy(nT).invert().multiply(nC);
    L.foot.quaternion.copy(nC).invert().multiply(qF);
  }
  // pelvis → boyun doğrusunun dikeyle açısı (rad; + = öne), dünya uzayında, gidiş yönü düzleminde
  function govdeEgimi(sy, cy) { pv.setFromMatrixPosition(B.pelvis.matrixWorld); nv.setFromMatrixPosition(B.neck_01.matrixWorld).sub(pv); return Math.atan2(nv.x * sy + nv.z * cy, nv.y); }

  SO.anim.register({ name: 'durus', order: 35,
    init(ctx) {
      kok = ctx.char.root; B = ctx.bones;
      act = [ctx.action('Idle_Loop'), ctx.action('Walk_Loop'), ctx.action('Jog_Fwd_Loop'), ctx.action('Sprint_Loop')];
      const leg = s => ({ thigh: B['thigh_' + s], calf: B['calf_' + s], foot: B['foot_' + s], ball: B['ball_' + s], f: new V3(), p: 1 }); legs = [leg('l'), leg('r')];
    },
    post(ctx, dt) {
      if (!T.on || !B.pelvis || !B.neck_01) { st.egim = st.kaldir = st.kisit = 0; return; }
      const ps = ctx.ps, yaw = ps.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw), hava = clamp(ps.airBlend || 0, 0, 1);
      // kök: ana.js'in bu kare yazacağı yer ve yatma (ayak.js de aynısını yapar); kemiklerin dünya konumu bu kareye ait olsun
      kok.position.set(ps.x, ps.y, ps.z); kok.rotation.order = 'YXZ'; kok.rotation.set(ps.leanFwd || 0, yaw, ps.lean || 0); kok.updateMatrixWorld(true);
      const isin = !has || Math.hypot(ps.x - lx, ps.z - lz) > 1.5; has = true; lx = ps.x; lz = ps.z;
      const restA = (SO.tune.ayak && SO.tune.ayak.restAnkle) || .103;
      const y0 = pv.setFromMatrixPosition(B.pelvis.matrixWorld).y - ps.y;

      // 1) ağırlıklar ve karışmış düzeltme
      let top = 0; for (let i = 0; i < 4; i++) { wgt[i] = Math.max(0, act[i].getEffectiveWeight()); top += wgt[i]; }
      if (top > 1) { for (let i = 0; i < 4; i++) wgt[i] /= top; top = 1; } wgt[4] = 1 - top;
      for (const k in T.duzelt.dur) { let s = 0; for (let i = 0; i < 5; i++) s += wgt[i] * ((T.duzelt[AD[i]] || {})[k] || 0); mix[k] = s * D; }
      // uçuş evresi: kalçanın zıplaması sıkıştırıldığı oranda ayakların yerden kesilmesi de sıkıştırılır (alçaktaki ayağın boşluğu kadar ikisi birden iner)
      let bos = 1e9, oran = 0; for (let i = 0; i < 4; i++) { const k = T.kalca[AD[i]]; if (k) oran += wgt[i] * (1 - k.sik); }
      for (const L of legs) { L.f.setFromMatrixPosition(L.foot.matrixWorld); bos = Math.min(bos, L.f.y - ps.y - restA, L.ball ? tmp.setFromMatrixPosition(L.ball.matrixWorld).y - ps.y - T.ucBos : 1e9); }
      const in_ = Math.max(0, bos) * clamp(oran, 0, 1); st.indir = in_;
      for (const L of legs) { L.f.y -= in_; L.p = 1 - smooth(.03, .14, L.f.y - ps.y - restA); }
      let once = 0; for (const ad of ZINCIR) { const a = mix[ad] || 0; don(B[ad], X, a - once); once = a; }
      don(B.thigh_l, X, -mix.pelvis); don(B.thigh_r, X, -mix.pelvis);
      don(B.upperarm_l, X, mix.kol); don(B.upperarm_r, X, mix.kol); don(B.upperarm_l, Z, mix.kolAc); don(B.upperarm_r, Z, -mix.kolAc);
      B.pelvis.updateWorldMatrix(false, true);

      // 2) toplam gövde eğimi sınırı (yerdeyken): yumuşak diz, asla egimEnCok'u geçmez
      let egim = govdeEgimi(sy, cy); st.kisit = 0;
      const e0 = T.egimYumusak * D, e1 = T.egimEnCok * D;
      if (egim > e0 && e1 > e0) {
        const hedef = e0 + (e1 - e0) * (1 - Math.exp(-(egim - e0) / (e1 - e0))), geri = (egim - hedef) * (1 - hava);
        if (geri > 1e-4) { don(B.pelvis, X, -geri); don(B.thigh_l, X, geri); don(B.thigh_r, X, geri); B.pelvis.updateWorldMatrix(false, true); egim -= geri; st.kisit = geri / D; }
      }
      st.egim = egim / D;

      // 3) kalça yüksekliği
      let hd = 0; const kl = T.kalca; for (let i = 0; i < 4; i++) { const k = kl[AD[i]]; if (k) hd += wgt[i] * (k.hedefUst - (k.klipUst - y0) * k.sik - y0); }
      let h = hd;
      if (hd > 0) for (const L of legs) {
        A.setFromMatrixPosition(L.thigh.matrixWorld); K.setFromMatrixPosition(L.calf.matrixWorld); F.setFromMatrixPosition(L.foot.matrixWorld);
        const R = (A.distanceTo(K) + K.distanceTo(F)) * T.uzanma, yat2 = (L.f.x - A.x) ** 2 + (L.f.z - A.z) ** 2;
        const hmax = Math.max(0, L.f.y - A.y + Math.sqrt(Math.max(0, R * R - yat2)));
        h = Math.min(h, hd + (Math.min(hd, hmax) - hd) * L.p * (1 - hava)); // havadaki/salınımdaki ayak kalçayı tutmaz
      }
      // yalnız bacak kısıtının payı yumuşatılır (köşesi yuvarlansın); doğrusal sıkıştırma gecikmesiz uygulanır
      const ks = hd - h; kS = isin ? ks : dt > 0 ? SO.damp(kS, ks, T.kalcaYay, dt) : kS; h = hd - kS; st.kaldir = h;
      if (Math.abs(h) > 1e-5) { const par = B.pelvis.parent; pv.setFromMatrixPosition(B.pelvis.matrixWorld); pv.y += h; par.worldToLocal(pv); B.pelvis.position.copy(pv); B.pelvis.updateWorldMatrix(false, true); }

      // 4) bilekler eski yerine
      for (const L of legs) ik(L, L.f, yaw);
    } });
})();
