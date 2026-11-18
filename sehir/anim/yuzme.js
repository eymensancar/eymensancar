/* Yüzme katmanı (order 22): sığ suda yürüme (ağır adım, diz kaldırma, kollar dengede) ve derinde yüzme (kurbağalama + su üstünde durma).

   KLİP ÖLÇÜMLERİ (kök sabit, klip tek başına; konumlar köke göre, m). İki klipte de KÖK = SU YÜZEYİ:
     Swim_Idle_Loop (3,333 sn) : dikey su üstünde durma. Baş eklemi +0,22…+0,32, boyun +0,14…+0,24, kalça −0,33…−0,43, ayaklar −1,04…−1,19
                                 (yani 1,1 m'den sığ suda ayak dibe girer: fiziğin çıkış derinliği (yuzCik 1,1) buna uyuyor). Eller yüzeyde kürek çeker.
     Swim_Fwd_Loop (1,333 sn)  : kurbağalama, döngü başına TEK kulaç, iki kol bakışımlı. Gövde yatay: baş eklemi 0…+0,06, kalça −0,07, ayaklar −0,12…−0,20.
        evre 0,06–0,42 kollar öne uzanır (süzülme)   · 0,45–0,75 kollar yana açılıp geriye çeker (kulaç)
        evre 0,62–0,90 bacaklar toplanır             · 0,92–0,12 bacaklar geriye teper (kurbağa tekmesi)
   Fizik yüzerken kökü ps.y ≈ −yuzBatik (−1,38) derinliğinde tutuyor (çıkışta ayak dibe yakın olsun diye); klipler ise kökü su yüzeyinde bekliyor.
   Aradaki fark bu katmanda KALÇA KEMİĞİ kaldırılarak kapatılır (ps.rootDy'ye ve kök düğüme dokunulmaz; ana.js'te değişiklik gerekmez):
     kalça kaldırma = ps.yuzmeDy = yuzmeBlend × (su yüzeyi + batıklık − ps.y) + dalma yayı.
   Geçişte baş yüksekliği kendiliğinden sürekli kalır: 1,3 m suda ayakta baş eklemi +0,23, su üstünde dururken +0,15…+0,25.

   NE YAPAR
   update: ps.yuzme değişimini izler → yuzmeBlend (giriş 0,60 sn, çıkış 0,45 sn, yumuşak basamak), su_gir / su_cik olayı; hıza göre
           Swim_Idle ↔ Swim_Fwd payı; kulaç evresi GERÇEK hızdan (evre hızı = kadans(hız); 1,45 m/sn → 0,75 kulaç/sn, 2,3 m/sn → 1,05 kulaç/sn;
           hız 0 ise kulaç da durur, başlamış kulaç en az 0,45/sn ile bitirilir); kulaç başına bir `kulac` olayı (kolların çekişe başladığı an, evre 0,47);
           sığ suda adım ağırlaştırma çarpanı (ps.adimAgir → hareket.js kadansı bununla çarpar).
   post  : sığ suda: salınımdaki bacağın dizi kalkar (sığda suyun üstüne çıkacak kadar, derinde az), gövde hafif öne, kollar yana açık.
           yüzerken: kalçayı su yüzeyine kaldırır, gövde yönünü suda
           gecikmeli döndürür (ps.yaw'a dokunmadan: kalçaya ek dönüş), dönüşe doğru gövdeyi yuvarlar, ileri yüzerken başı kaldırıp bacakları
           batırır, kulaç ritminde ileri-geri süzülme ekler.

   YAZDIĞI ps ALANLARI
     yuzmeBlend (0..1) : yüzme kliplerinin payı. Taban hareket (hareket.js) ağırlıklarını 1 − yuzmeBlend ile çarpar.
     ikKapat (0..1)    : ayak yerleştirme (ayak.js) ve duruş düzeltmesi (durus.js) bu kadar kapanır. KURAL: bu katman her karede `update` başında
                         alanı kendi payına EŞİTLER (= ile; karenin sıfırlaması budur). Sonra çalışan katmanlar (tırmanma, order 24) yalnız
                         `ps.ikKapat = Math.max(ps.ikKapat, pay)` ile yükseltir. Okuyanlar (order 35, 40) `post` içinde okur.
     yuzmeDy (m)       : kalçaya verilen dikey kaldırma (bilgi için; kimse uygulamak zorunda değil, bu katman kendi uygular).
     yuzmeEvre (0..1)  : kulaç evresi (0,47 = çekiş başı), yuzmeIleri (0..1): ileri yüzme klibinin payı.
     adimAgir (0..1]   : sığ suda adım kadansı çarpanı (1 = karada). hareket.js okur.
   Zıplama: derin suda fizik zıplamayı yok sayar; input.jump'a dokunulmaz. ziplama.js yine de kısa bir çömelme pozu karıştırdığı için bu katman
   Jump_Start/Loop/Land ağırlıklarını (yalnız ağırlık) 1 − yuzmeBlend ile çarpar.
   Tırmanma: ps.tirmanBlend varsa yüzme payı ve kalça kaldırma 1 − tirmanBlend ile çarpılır.
   Ayarlar: SO.tune.yuzme. Deneme: node test/cek.cjs '{"kamera":"yan","uzaklik":5,"konum":{"x":1442.4,"z":868.9,"yaw":2.488},"adimlar":[{"sure":6,"jy":1,"camYaw":2.488}]}' /tmp/yuzme.png --olc */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp, damp = SO.damp, wrapA = SO.wrapA, D = Math.PI / 180;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = x => x - Math.floor(x);

  SO.tune.suIvme = 3.2; // suda hızlanma/yavaşlama (m/sn²): fizikteki 5 yerine; kulaç bırakılınca ~0,45 sn süzülür, dönüş geniş yay çizer

  const T = SO.tune.yuzme = Object.assign({
    girSure: .6, cikSure: .45,          // yüzmeye geçiş / çıkış süresi (sn)
    ileriHiz: [.15, .9],                // Swim_Idle → Swim_Fwd payının 0'dan 1'e çıktığı hız aralığı (m/sn)
    ileriGir: 5, ileriCik: 3.2,         // o payın değişme hızı (1/sn)
    kadans: [.6, .75, 1.05],            // kulaç/sn: dururken (kalkışta), tune.yuz hızında, tune.yuzHizli hızında
    kadansEnAz: .45,                    // başlamış kulaç en az bu hızla sürer (hız düşse de kol havada donmaz)
    kulacEvre: .47, basEvre: .36,       // kulaç olayının evresi; dururken beklenen evre (ilk hareket kol çekişi olsun)
    batikDur: -.10, batikIleri: -.03, batikHizli: -.03, // kökün su yüzeyine göre yüksekliği (m): su üstünde dururken / ileri / hızlı
    egimIleri: 10, egimHizli: 6,         // ileri yüzerken gövdenin baş yukarı eğimi (derece): baş suyun üstünde, bacaklar batık
    basKaldir: 0,                       // ileri yüzerken başa ek kaldırma (derece)
    suzulme: .07, suzulmeHizli: .1,     // kulaç ritminde ileri-geri süzülme (m, tepe-tepe)
    donOmega: 4.2, donHiz: 2.6,         // suda gövde yönünün ps.yaw'ı izleme yayı (1/sn) ve en yüksek dönüş hızı (rad/sn)
    donEnCok: 1.5,                      // gövde yönü ps.yaw'dan en çok bu kadar geride kalır (rad)
    yat: .085, yatEnCok: .24, yatHiz: 4, // dönüşte yuvarlanma: rad / (rad/sn), sınır (rad), yumuşatma (1/sn)
    dalmaYay: 5.5, dalmaSonum: .5, dalma: [.25, .42, 3.2], // suya girişte dalıp çıkma: yay; ilk hız = dalma[0] + dalma[1] × düşüş hızı, en çok dalma[2]
    // sığ su
    sigAlt: .15, sigUst: .95,           // adım ağırlaşmasının başladığı ve tam olduğu derinlik (m)
    agir: .72,                          // tam derinlikte kadans çarpanı
    diz: 24, baldir: 34,                // salınımdaki bacağa en çok ek: uyluk öne, diz bükme (derece)
    dizSig: [.1, .32], dizDerin: [.4, .8], dizDerinPay: .25, // diz kaldırma derinliğe göre: sığda tam (ayak sudan çıkar), derinde bu paya iner
    govde: 7,                           // tam derinlikte yürürken gövdenin ek öne eğimi (derece)
    kol: 16, kolDerin: 30, dirsek: 28   // kolların yana açılması (derece): bel derinliğinde / göğüs derinliğinde; göğüs derinliğinde dirsek bükme
  }, SO.tune.yuzme || {});

  let aI, aF, aJ = [], kok, B;
  let on = false, u = 0, yb = 0, fw = 0, acc = T.basEvre, fired = 0, ilk = true, pvy = 0;
  let vyaw = 0, vrate = 0, roll = 0, hizli = 0, sig = 0, diz = 0, kolW = 0, loco = 0, lift = 0;
  const bob = { x: 0, v: 0 }, SUZ = new Float32Array(33);

  // kurbağalamada gövde hızının kulaç içindeki oynaması (ortalaması 0): tekmeden sonra en hızlı, bacak toplarken en yavaş, kol çekişinde küçük ikinci tepe.
  // SUZ = bunun integrali (konum kayması), ortalaması 0 ve tepe-tepe 1 olacak biçimde.
  (function () {
    const hz = [.8, 1, .4, 0, -.1, .3, -.9, -1.5], N = 32, o = new Float32Array(N + 1); let s = 0, mn = 1e9, mx = -1e9, ort = 0;
    for (let i = 0; i <= N; i++) { o[i] = s; const p = (i + .5) / N * 8, k = Math.floor(p) % 8, f = p - Math.floor(p), c = (1 - Math.cos(Math.PI * f)) / 2; s += lerp(hz[k], hz[(k + 1) % 8], c) / N; }
    for (let i = 0; i < N; i++) ort += o[i] / N; for (let i = 0; i <= N; i++) { o[i] -= ort + (o[N] - o[0]) * (i / N - .5); mn = Math.min(mn, o[i]); mx = Math.max(mx, o[i]); }
    for (let i = 0; i <= N; i++) SUZ[i] = o[i] / (mx - mn);
  })();
  const suz = ph => { const p = frac(ph) * 32, i = Math.floor(p); return lerp(SUZ[i], SUZ[i + 1], p - i); };

  function yay(s, hedef, w, z, dt, enCok) { const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n; for (let i = 0; i < n; i++) { s.v += ((hedef - s.x) * w * w - 2 * z * w * s.v) * h; if (enCok) s.v = clamp(s.v, -enCok, enCok); s.x += s.v * h; } return s.x; }

  // kemiği karakter uzayında (kök düğüme göre) bir eksen çevresinde döndür (durus.js'teki ile aynı): X + = üst taraf öne, Y + = sola, Z + = sağa yatma
  const V3 = T3.Vector3, Q = T3.Quaternion, X = new V3(1, 0, 0), Y = new V3(0, 1, 0), Z = new V3(0, 0, 1), qP = new Q(), qR = new Q(), qI = new Q(), pw = new V3();
  function don(b, eksen, aci) {
    if (!b || Math.abs(aci) < 1e-5) return;
    qP.set(0, 0, 0, 1); for (let p = b.parent; p && p !== kok; p = p.parent) qP.premultiply(p.quaternion);
    qR.setFromAxisAngle(eksen, aci); qI.copy(qP).invert(); b.quaternion.premultiply(qP).premultiply(qR).premultiply(qI);
  }

  SO.anim.register({ name: 'yuzme', order: 22,
    init(ctx) {
      kok = ctx.char.root; B = ctx.bones;
      aI = ctx.action('Swim_Idle_Loop'); aF = ctx.action('Swim_Fwd_Loop'); aF.timeScale = 0;
      aJ = ['Jump_Start', 'Jump_Loop', 'Jump_Land'].map(a => ctx.action(a));
      const ps = ctx.ps; ps.yuzmeBlend = 0; ps.ikKapat = 0; ps.yuzmeDy = 0; ps.yuzmeEvre = T.basEvre; ps.yuzmeIleri = 0; ps.adimAgir = 1;
    },

    update(ctx, dt) {
      const ps = ctx.ps, tn = ctx.tune, v = ps.speed, yuz = !!ps.yuzme, d = ps.suDerin || 0;
      if (ilk) { ilk = false; on = yuz; u = yuz ? 1 : 0; vyaw = ps.yaw; pvy = ps.vy; }

      // 1) giriş / çıkış
      if (yuz !== on) {
        on = yuz;
        if (yuz) { const dus = Math.max(0, -pvy); SO.ses.olay('su_gir', { hiz: Math.max(v, dus) }); bob.v -= clamp(T.dalma[0] + T.dalma[1] * dus, 0, T.dalma[2]); if (yb < .05) { vyaw = ps.yaw; vrate = 0; } }
        else SO.ses.olay('su_cik', {});
      }
      pvy = ps.vy;
      u = clamp(u + dt / (yuz ? T.girSure : -T.cikSure), 0, 1); yb = u * u * (3 - 2 * u);
      const tir = 1 - clamp(ps.tirmanBlend || 0, 0, 1), pay = yb * tir;
      ps.yuzmeBlend = pay;
      ps.ikKapat = yuz ? smooth(0, .5, u) * tir : pay; // her karenin sıfırlaması: EŞİTLE. Sonraki katmanlar Math.max ile yükseltir.

      // 2) ileri payı ve kulaç evresi
      const ih = smooth(T.ileriHiz[0], T.ileriHiz[1], v); fw = damp(fw, ih, ih > fw ? T.ileriGir : T.ileriCik, dt); if (fw < .003 && ih === 0) fw = 0;
      hizli = damp(hizli, smooth(tn.yuz + .1, tn.yuzHizli - .1, v), 4, dt);
      if (yb === 0 || fw === 0) { acc = T.basEvre; fired = Math.floor(acc - T.kulacEvre) + 1; }
      else {
        const C = v <= tn.yuz ? lerp(T.kadans[0], T.kadans[1], clamp(v / tn.yuz, 0, 1)) : lerp(T.kadans[1], T.kadans[2], clamp((v - tn.yuz) / (tn.yuzHizli - tn.yuz), 0, 1.3));
        acc += Math.max(C * smooth(0, .5, v), T.kadansEnAz) * dt;
        const idx = Math.floor(acc - T.kulacEvre) + 1;
        if (idx > fired) { fired = idx; if (yuz && fw > .12 && pay > .5 && dt > 0) SO.ses.olay('kulac', { hiz: v }); }
        if (acc > 64) { acc -= 64; fired -= 64; }
      }
      aF.time = frac(acc) * aF.getClip().duration;
      aI.setEffectiveWeight(pay * (1 - fw)); aF.setEffectiveWeight(pay * fw);
      if (yb > 0) for (const a of aJ) a.setEffectiveWeight(a.getEffectiveWeight() * (1 - yb)); // suda zıplama pozu yok (ziplama.js her kare yeniden yazar)
      ps.yuzmeEvre = frac(acc); ps.yuzmeIleri = fw;

      // 3) dalma yayı, kalça kaldırma
      yay(bob, 0, T.dalmaYay, T.dalmaSonum, dt); if (yb === 0 && Math.abs(bob.x) < 1e-3 && Math.abs(bob.v) < 1e-2) bob.x = bob.v = 0;
      const batik = lerp(T.batikDur, lerp(T.batikIleri, T.batikHizli, hizli), fw);
      lift = pay * (ctx.world.SU + batik - ps.y) + bob.x * pay; ps.yuzmeDy = lift;

      // 4) suda gövde yönü: ps.yaw'ı gecikmeyle izler (sınırlı hız); dönüş hızından yuvarlanma
      if (yb === 0) { vyaw = ps.yaw; vrate = 0; roll = 0; }
      else if (dt > 0) {
        const w = T.donOmega, e = wrapA(ps.yaw - vyaw); vrate += (e * w * w - 2 * w * vrate) * dt; vrate = clamp(vrate, -T.donHiz, T.donHiz); vyaw = wrapA(vyaw + vrate * dt);
        const e2 = wrapA(vyaw - ps.yaw); if (Math.abs(e2) > T.donEnCok) vyaw = wrapA(ps.yaw + Math.sign(e2) * T.donEnCok);
        roll = damp(roll, clamp(-T.yat * vrate * lerp(.5, 1, smooth(.2, 1.4, v)), -T.yatEnCok, T.yatEnCok), T.yatHiz, dt);
      }

      // 5) sığ su: adım ağırlığı ve post için paylar
      const yerde = ps.grounded && !yuz ? 1 : 0, kara = (1 - yb) * (1 - clamp(ps.airBlend || 0, 0, 1));
      sig = damp(sig, smooth(T.sigAlt, T.sigUst, d) * yerde, 6, dt);
      ps.adimAgir = lerp(1, T.agir, sig);
      loco = clamp(ps.gait || 0, 0, 1);
      diz = damp(diz, smooth(T.dizSig[0], T.dizSig[1], d) * lerp(1, T.dizDerinPay, smooth(T.dizDerin[0], T.dizDerin[1], d)) * yerde, 8, dt) * 1;
      kolW = kara;
    },

    post(ctx, dt) {
      const ps = ctx.ps;
      /* ---- sığ suda yürüme ---- */
      const k = kolW;
      if (k > .01 && (sig > .01 || diz > .01)) {
        const ph = ps.phase || 0, kosu = clamp((ps.gait || 0) - 1, 0, 1), dz = diz * loco * k * lerp(1, .55, kosu);
        if (dz > .01) { // sol bacak evre 0.5–1'de, sağ bacak 0–0.5'te salınır; tepe salınımın ilk yarısında (diz önce kalkar, ayak sonra öne uzanır)
          const sal = x => { const t = clamp(x * 2, 0, 1), e = Math.sin(Math.PI * Math.pow(t, .8)); return e * e; };
          const sl = sal(ph - .5) * dz, sr = sal(ph < .5 ? ph : -1) * dz;
          if (sl > .005) { don(B.thigh_l, X, -T.diz * D * sl); don(B.calf_l, X, T.baldir * D * sl); }
          if (sr > .005) { don(B.thigh_r, X, -T.diz * D * sr); don(B.calf_r, X, T.baldir * D * sr); }
        }
        const g = T.govde * D * sig * loco * k; don(B.spine_01, X, g * .3); don(B.spine_02, X, g * .35); don(B.spine_03, X, g * .35); don(B.neck_01, X, -g * .5);
        const derin = smooth(.85, 1.25, ps.suDerin || 0), ac = lerp(T.kol * sig * lerp(.45, 1, loco), T.kolDerin, derin * sig) * D * k, dr = T.dirsek * D * derin * sig * k;
        don(B.upperarm_l, Z, ac); don(B.upperarm_r, Z, -ac);
        if (dr > .005) { don(B.lowerarm_l, Z, dr); don(B.lowerarm_r, Z, -dr); }
      }

      /* ---- yüzme ---- */
      const pay = ps.yuzmeBlend || 0;
      if (pay < .001 && Math.abs(lift) < 1e-4) return;
      kok.position.set(ps.x, ps.y, ps.z); kok.rotation.order = 'YXZ'; kok.rotation.set(ps.leanFwd || 0, ps.yaw, ps.lean || 0); kok.updateMatrixWorld(true);
      const dy = wrapA(vyaw - ps.yaw) * pay, eg = lerp(T.egimIleri, T.egimHizli, hizli) * D * fw * pay;
      // kalça: yön gecikmesi (Y), yuvarlanma (Z), baş yukarı eğim (X; − = baş yukarı)
      don(B.pelvis, X, -eg); don(B.pelvis, Z, roll * pay); don(B.pelvis, Y, dy);
      if (T.basKaldir) { don(B.neck_01, X, -T.basKaldir * D * .4 * fw * pay); don(B.Head, X, -T.basKaldir * D * .6 * fw * pay); }
      // kalça konumu (dünya): kaldırma, yön gecikmesi kök ekseni çevresinde, süzülme
      pw.setFromMatrixPosition(B.pelvis.matrixWorld);
      pw.y += lift; // klipte gövde kökün çevresinde durduğundan kökün yatması (ps.lean/leanFwd) gövdeyi kendi hizasında döndürür; yalnız kaldırmak yeter
      const rx = pw.x - ps.x, rz = pw.z - ps.z, c = Math.cos(dy), s = Math.sin(dy), sz = suz(acc) * lerp(T.suzulme, T.suzulmeHizli, hizli) * fw * pay, yw = ps.yaw + dy;
      pw.x = ps.x + rx * c + rz * s + Math.sin(yw) * sz; pw.z = ps.z - rx * s + rz * c + Math.cos(yw) * sz;
      B.pelvis.parent.worldToLocal(pw); B.pelvis.position.copy(pw);
    } });
  SO.yuzme = { durum: () => ({ u, yb, fw, acc, lift, vyaw, roll, sig, diz, bob: bob.x }) };
})();
