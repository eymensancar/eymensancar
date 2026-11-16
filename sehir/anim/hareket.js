/* Hareket katmanı (taban, order 10): dur / yürü / hafif koşu / depar. Ayak kaymasız, evre eşlemeli karışım.

   EVRE (ps.phase, 0..1): bir tam adım döngüsü (iki adım). 0 = SOL ayak yere değer, 0.5 = SAĞ ayak yere değer.
   Bütün klipler bu ortak evreden okunur (klip .time'ı evreden hesaplanır, timeScale = 0), yani karışımda ayaklar hep aynı anda basar.
   Dururken evre T.durEvre'de (0.08) bekler: sol ayak önde/yerde, sağ ayak arkada kalkmak üzere (Idle_Loop duruşuna en yakın an).

   KLİP ÖLÇÜMLERİ (kök sabit, klip 240 örnekle oynatılıp ayak ucu (ball) ve bilek (foot) kemiklerinin konumundan; klip süresinin kesri olarak):
     klip          süre    sol temas  sağ temas  basış (ayak başına)  döngü uzunluğu (yerdeki ayağın geriye hızı, m/döngü)
     Walk_Loop     1.333   0.000      0.500      0.56 döngü           1.305  (klibin kendi hızı 0.98 m/sn)
     Jog_Fwd_Loop  0.933   0.035      0.535      0.14 döngü           5.50   (klibin kendi hızı 5.9 m/sn: çok uzun, sıçramalı adım)
     Sprint_Loop   0.667   0.045      0.595      0.15 döngü           5.95   (klibin kendi hızı 8.9 m/sn; sol→sağ 0.55, sağ→sol 0.45: bakışımsız)
   Depar klibinin bakışımsızlığı parçalı doğrusal zaman eşlemesiyle düzeltilir (yarı döngü başına ayrı eğim; eğim adım uzunluğuna da girer).

   KAYMASIZLIK: evre hızı (döngü/sn) = zemin hızı / döngü uzunluğu. Döngü uzunluğu = adimOlcek × Σ ağırlık × klip uzunluğu × eşleme eğimi.
   Kliplerin adımı oyundaki hızlara göre çok uzun (hafif koşu 3,6 m/sn'de klip 0,65 döngü/sn ile, ağır çekim gibi oynardı). Bu yüzden
   ADIM ÖLÇEKLEME var: istenen kadans hıza göre seçilir (T.kadans), bacakların ileri-geri açıklığı `post` içinde iki kemikli çözümle
   adimOlcek (s) kadar ölçeklenir (ayak ucunun kalçaya göre ileri uzaklığı × s; ayağın yüksekliği ve yönü aynı kalır). Böylece
   yerdeki ayağın geriye hızı tam olarak s × klip hızı olur ve zemin hızına eşitlenir. T.olcekle = false ise ölçekleme kapanır
   (kadans = hız / klip uzunluğu; kayma yine yok ama koşu ağır çekim görünür).

   Yazdığı ps alanları: gait, phase, stride (tam döngü, m; tek adım = stride / 2), cadence (döngü/sn), strideScale (s), plantL, plantR (0..1: ayak yerde mi; kliplerden).
   Deneme: node test/cek.cjs '{"kamera":"yan","adimlar":[{"sure":0.5},{"sure":3,"jy":1}],"kareler":[1,1.1,1.2,1.3,1.4,1.5]}' /tmp/hareket/x.png --olc */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp;
  const T = SO.tune.hareket = Object.assign({
    // ölçülen döngü uzunlukları (m) ve temas evreleri (klip kesri: [sol temas, sağ temas])
    yuruBoy: 1.305, kosBoy: 5.50, deparBoy: 5.95,
    yuruTemas: [0, .5], kosTemas: [.035, .535], deparTemas: [.045, .595],
    yuruBasis: .56, kosBasis: .14, deparBasis: .15,   // ayağın yerde kaldığı evre aralığı (temastan sonra)
    // istenen kadans (döngü/sn = dakikadaki adım / 120): dururken, yavaş yürüyüş (0.55 × yürüme), yürüme, hafif koşu, depar hızlarında
    kadans: [.62, .80, .98, 1.26, 1.52],
    olcekle: true, olcekMin: .45, olcekMax: 1.22,     // adım ölçekleme sınırları
    durEvre: .08,                                     // dururken beklenen evre
    kalkis: 13, durus: 8.5,                           // dur ↔ hareket ağırlık geçiş hızları (1/sn)
    karisim: 22                                       // klip ağırlıklarının hıza uyma hızı (1/sn; duvara sürtünme gibi hız titremelerini süzer)
  }, SO.tune.hareket || {});

  let A, K, loco = 0, g = 1, s = 1, acc = T.durEvre, fired = 0, warpAmt = 0;
  const w = [1, 0, 0];

  const frac = x => x - Math.floor(x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // evre → klip kesri (parçalı doğrusal: 0 → sol temas, 0.5 → sağ temas) ve o yarıdaki eğim
  function esle(k, ph) { const c0 = k.temas[0], c1 = k.temas[1]; return ph < .5 ? c0 + (c1 - c0) * 2 * ph : c1 + (1 + c0 - c1) * 2 * (ph - .5); }
  const egim = (k, ph) => ph < .5 ? 2 * (k.temas[1] - k.temas[0]) : 2 * (1 + k.temas[0] - k.temas[1]);
  function kadans(v, tn) { const xs = [0, tn.walk * .55, tn.walk, tn.jog, tn.sprint], ys = T.kadans; let i = 0; while (i < 3 && v > xs[i + 1]) i++; return lerp(ys[i], ys[i + 1], clamp((v - xs[i]) / (xs[i + 1] - xs[i]), 0, 1)); }

  SO.anim.register({ name: 'hareket', order: 10,
    init(ctx) {
      A = { idle: ctx.action('Idle_Loop') };
      K = [{ a: ctx.action('Walk_Loop'), boy: 'yuruBoy', t: 'yuruTemas', b: 'yuruBasis' }, { a: ctx.action('Jog_Fwd_Loop'), boy: 'kosBoy', t: 'kosTemas', b: 'kosBasis' }, { a: ctx.action('Sprint_Loop'), boy: 'deparBoy', t: 'deparTemas', b: 'deparBasis' }];
      K.forEach(k => { k.a.timeScale = 0; k.D = k.a.getClip().duration; });
      const ps = ctx.ps; ps.phase = T.durEvre; ps.cadence = 0; ps.strideScale = 1; ps.plantL = ps.plantR = 1;
    },

    update(ctx, dt) {
      const ps = ctx.ps, tn = ctx.tune, v = ps.speed, base = 1 - ps.airBlend;
      K.forEach(k => { k.temas = T[k.t]; k.L = T[k.boy]; k.basis = T[k.b]; });

      // 1) klip karışımı hıza göre: yürü (≤ walk) → hafif koşu (jog) → depar (sprint). Hız fizikte ivmeyle değiştiği için geçiş kendiliğinden ~0,15-0,2 sn sürer.
      const gh = v <= tn.walk ? 1 : v <= tn.jog ? 1 + smooth(tn.walk, tn.jog, v) : 2 + smooth(tn.jog, tn.sprint, v);
      g = loco < .02 ? gh : SO.damp(g, gh, T.karisim, dt);
      w[0] = clamp(2 - g, 0, 1); w[2] = clamp(g - 2, 0, 1); w[1] = 1 - w[0] - w[2];

      // 2) dur ↔ hareket: hızdan hedef, zamanda yumuşatılmış (yürümede hız 0,1 sn'de değişir; poz o kadar çabuk değişirse sıçrar)
      const hedef = smooth(.05, .55, v);
      loco = SO.damp(loco, hedef, hedef > loco ? T.kalkis : T.durus, dt); if (loco < .002 && hedef === 0) loco = 0; if (loco > .998) loco = 1;

      // 3) adım uzunluğu ve evre hızı. Karışımın döngü uzunluğu = Σ ağırlık × klip uzunluğu × eşleme eğimi (o andaki yarı döngüde).
      let ph = frac(acc), Lm = 0, Lort = 0; for (let i = 0; i < 3; i++) { Lm += w[i] * K[i].L * egim(K[i], ph); Lort += w[i] * K[i].L; }
      const C = kadans(v, tn), sH = T.olcekle ? clamp(v / (C * Lort), T.olcekMin, T.olcekMax) : 1;
      s = loco < .02 ? sH : SO.damp(s, sH, 14, dt);
      let hiz = v / (s * Lm); // döngü/sn: yerdeki ayağın geriye hızı (s × Lm × hiz) = zemin hızı

      const durEvre = frac(T.durEvre);
      if (loco === 0) { acc = durEvre; fired = 0; hiz = 0; }
      else if (ps.wantMag < .08 && v < .9 && ps.grounded) {
        // duruş: yarım adımda donmasın. Evre en yakın yoldan duruş evresine götürülür (ayak az kalkmışsa geri konur, yoksa adım tamamlanır).
        let ileri = frac(durEvre - ph); const d = ileri > .74 ? ileri - 1 : ileri;
        let adim = d * (1 - Math.exp(-10 * dt)); const enaz = Math.min(Math.abs(d), .9 * dt), ust = 2.6 * dt;
        adim = Math.sign(d) * clamp(Math.abs(adim), enaz, ust); if (d > 0) adim = Math.max(adim, Math.min(d, hiz * dt));
        acc += adim; hiz = dt > 0 ? adim / dt : 0;
      } else acc += hiz * dt;
      ph = frac(acc);

      // 4) klipleri evreye oturt, ağırlıkları yaz (havada taban ağırlıkları 1 - airBlend ile kısılır)
      A.idle.setEffectiveWeight((1 - loco) * base);
      let pl = 0, pr = 0;
      for (let i = 0; i < 3; i++) { const k = K[i]; k.a.time = frac(esle(k, ph)) * k.D; k.a.setEffectiveWeight(w[i] * loco * base); if (ph < k.basis) pl += w[i]; if (frac(ph + .5) < k.basis) pr += w[i]; }

      // 5) adım olayı: evre 0'ı (sol) ya da 0.5'i (sağ) ileri yönde her geçişte tam bir kez; havadayken ve dururken yok
      const idx = Math.floor(acc * 2 + 1e-9);
      if (idx > fired) { fired = idx; if (ps.grounded && ps.airBlend < .5 && loco > .3 && dt > 0) SO.ses.olay('adim', { zemin: ctx.world.zemin(ps.x, ps.z), hiz: v, ayak: idx % 2 ? 'r' : 'l' }); }
      if (acc > 64) { acc -= 64; fired -= 128; }

      // 6) duyurular
      ps.gait = loco * g; ps.phase = ph; ps.stride = s * Lort; ps.cadence = hiz; ps.strideScale = s;
      ps.plantL = lerp(1, clamp(pl, 0, 1), loco); ps.plantR = lerp(1, clamp(pr, 0, 1), loco);
      warpAmt = (s - 1) * loco * base;
    },

    // adım ölçekleme: her bacakta ayak ucunun kalçaya göre ileri uzaklığı s ile çarpılır; bilek o kadar kaydırılır, uyluk/baldır iki kemikli çözümle döner, ayağın dünya yönü korunur
    post(ctx) {
      if (!T.olcekle || Math.abs(warpAmt) < .004) return;
      const ch = ctx.char, B = ctx.bones; ch.root.updateMatrixWorld(true);
      const e = ch.root.matrixWorld.elements; fwd.set(e[8], e[9], e[10]).normalize();
      bacak(B.pelvis, B.thigh_l, B.calf_l, B.foot_l, B.ball_l); bacak(B.pelvis, B.thigh_r, B.calf_r, B.foot_r, B.ball_r);
    } });

  const fwd = new T3.Vector3(), a = new T3.Vector3(), b = new T3.Vector3(), c = new T3.Vector3(), tt = new T3.Vector3(), toe = new T3.Vector3(), v1 = new T3.Vector3(), v2 = new T3.Vector3(), v3 = new T3.Vector3(), ax0 = new T3.Vector3(), ax1 = new T3.Vector3(), sc = new T3.Vector3(), pp = new T3.Vector3();
  const qp = new T3.Quaternion(), qa = new T3.Quaternion(), qb = new T3.Quaternion(), qc = new T3.Quaternion(), r0 = new T3.Quaternion(), r1 = new T3.Quaternion(), r2 = new T3.Quaternion(), R = new T3.Quaternion(), qn = new T3.Quaternion();
  const acos = x => Math.acos(clamp(x, -1, 1));
  function bacak(ust, uyluk, baldir, ayak, uc) {
    ust.matrixWorld.decompose(pp, qp, sc); uyluk.matrixWorld.decompose(a, qa, sc); baldir.matrixWorld.decompose(b, qb, sc); ayak.matrixWorld.decompose(c, qc, sc); toe.setFromMatrixPosition(uc.matrixWorld);
    const kay = warpAmt * v1.subVectors(toe, a).dot(fwd); tt.copy(c).addScaledVector(fwd, kay);
    const lab = v1.subVectors(b, a).length(), lcb = v2.subVectors(c, b).length(), lat = clamp(v3.subVectors(tt, a).length(), .05, (lab + lcb) * .998);
    const ac = v3.subVectors(c, a), lac = ac.length(); if (lac < 1e-4) return;
    const ab = v1, bc = v2; // ab = b - a, bc = c - b
    const ac_ab_0 = acos(ac.dot(ab) / (lac * lab)), ba_bc_0 = acos(-ab.dot(bc) / (lab * lcb));
    const ac_ab_1 = acos((lab * lab + lat * lat - lcb * lcb) / (2 * lab * lat)), ba_bc_1 = acos((lab * lab + lcb * lcb - lat * lat) / (2 * lab * lcb));
    ax0.crossVectors(ac, ab); if (ax0.lengthSq() < 1e-8) ax0.crossVectors(ac, fwd); ax0.normalize();
    const at = tt.sub(a); ax1.crossVectors(ac, at); const sinl = ax1.length(), ac_at_0 = Math.atan2(sinl, ac.dot(at)); if (sinl > 1e-7) ax1.multiplyScalar(1 / sinl); else ax1.copy(ax0);
    r0.setFromAxisAngle(ax0, ac_ab_1 - ac_ab_0); r1.setFromAxisAngle(ax0, ba_bc_1 - ba_bc_0); r2.setFromAxisAngle(ax1, ac_at_0);
    R.multiplyQuaternions(r2, r0);                       // uyluğun dünya dönüşü: önce iç açı, sonra hedefe çevirme
    qa.premultiply(R);                                   // yeni uyluk (dünya)
    qb.premultiply(r1).premultiply(R);                   // yeni baldır (dünya)
    uyluk.quaternion.copy(qn.copy(qp).invert()).multiply(qa);
    baldir.quaternion.copy(qn.copy(qa).invert()).multiply(qb);
    ayak.quaternion.copy(qn.copy(qb).invert()).multiply(qc); // ayağın dünya yönü aynı kalır
  }
})();
