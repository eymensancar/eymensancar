/* Kamera: oyuncunun arkasında döner. SO.cam: yaw (bakış yönü; oyuncunun parmağı yazar, hareket yönü buna göre hesaplanır), pitch, dist,
   fov (temel görüş açısı), height. Test için SO.cam.mode: 'takip' (oyun), 'yan' | 'on' | 'arka' | 'capraz' (karaktere sabit açıdan bakar).

   'takip' kipinde:
   1. Yumuşak takip: bakış noktası karakteri yay-sönümle izler (yatayda çabuk, dikeyde ağır: zıplama kamerayı sarsmaz) ve gidiş
      yönünde biraz öne kayar (ileriye bakma).
   2. Otomatik arkaya dönme: oyuncu kamerayı bir süredir elle çevirmediyse ve karakter yürüyorsa SO.cam.yaw yavaşça gidiş yönüne döner.
      Karakter kameraya doğru geliyorsa dönmez. Elle çevirme, SO.cam.yaw/pitch'in bu dosyanın son yazdığı değerden farklı olmasından anlaşılır.
   3. Depar: hızla birlikte görüş açısı genişler, kamera biraz geri çekilir.
   4. İniş: yere değiş hızına göre küçük, sönümlü bir çökme. Sürekli sallanma yok.
   5. Çarpışma: bakış noktasından kameraya ışın, binaların kenar payı kadar büyütülmüş kutularına göre kesin hesaplanır (kamera duvarın
      içine girmez, duvara yapışmaz). Yaklaşma hızlı, uzaklaşma gecikmeli ve yavaş (dar aralıkta titremez). Yan ışınlar köşe gelmeden
      kamerayı yaklaştırmaya başlar. Kamera karaktere çok yaklaşınca yukarı çıkıp omuz üstünden bakar (karakterin içinden bakmaz).
   Ayarlar: SO.tune.kamera. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, V = new T3.Vector3(), clamp = SO.clamp, damp = SO.damp, wrapA = SO.wrapA;
  const st = SO.cam = { yaw: Math.PI, pitch: .16, dist: 5.4, cur: null, mode: 'takip', fov: 55, height: 1.45,
    manualAt: -9, px: 0, py: 0, pz: 0, kick: 0, dip: 0 }; // manualAt: son elle çevirme anı; px/py/pz: yumuşatılmış bakış noktası; kick: depar payı 0..1; dip: iniş çökmesi (m)
  const tn = SO.tune.kamera = {
    followT: .12,       // yatay takip yumuşatma süresi (sn)
    followTY: .16,      // dikey takip (yerdeyken: kaldırım basamağı)
    followTYAir: .42,   // dikey takip (havadayken: zıplama kamerayı sarsmasın)
    lead: .2, leadMax: 1.2, leadT: .55, // ileriye bakma: hız × lead sn, en çok leadMax m, yumuşatma süresi
    autoDelay: 1.2,     // elle çevirmeden sonra otomatik dönmenin başlaması (sn)
    autoRamp: .9,       // başladıktan sonra tam güce ulaşma (sn)
    autoK: [.55, 1.5],  // dönme hızı katsayısı (1/sn): yürürken … deparda
    autoMax: 1.5,       // en çok açısal hız (rad/sn)
    autoBack: [1.75, 2.2], // gidiş yönü ile kamera arasındaki açı bu aralıkta sönerek kapanır (kameraya doğru yürürken dönmez)
    pitchRest: .16, pitchK: .45, // otomatik dönerken dikey açı da yavaşça buna döner
    fovAdd: 7, distAdd: .7, kickK: 2.6, // depar: görüş açısı + kamera uzaklığı
    dipGain: .25, dipMax: 2.6, dipW: 13, dipZ: .75, // iniş çökmesi: ilk hız = fallSpeed × dipGain (en çok dipMax m/sn), yay frekansı, sönüm oranı
    margin: .3,         // kameranın duvara en çok yaklaşması (m)
    thin: 1.0,          // bundan ince engeller (ağaç gövdesi, lamba direği) kamerayı yaklaştırmaz
    inK: 14, outK: 3.2, outHold: .3, // yaklaşma / uzaklaşma hızı, engel kalktıktan sonra bekleme (sn)
    whisk: [.22, .45],  // yan ışın açıları (rad)
    minD: 1.2, closeUp: .8, closeLook: .4, // minD'den yakında kamera yukarı çıkar, bakış noktası göğse iner
    floor: .3           // kamera zeminin en az bu kadar üstünde
  };
  let lastYaw = null, lastPitch = null, has = false, lastLanded = -9, holdT = 0, fovNow = 0, big = null, bigN = -1;
  const P = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }, Ld = { x: 0, z: 0, vx: 0, vz: 0 }, dip = { x: 0, v: 0 };
  // kritik sönümlü yay (hedefe taşmadan yaklaşır); o[k] konum, o[vk] hız
  function yay(o, k, vk, hedef, sure, dt) { const w = 2 / Math.max(1e-4, sure), x = w * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x), d = o[k] - hedef, t = (o[vk] + w * d) * dt; o[vk] = (o[vk] - w * t) * e; o[k] = hedef + (d + t) * e; }
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function solids() { const s = SO.world.solids; if (s.length !== bigN) { bigN = s.length; big = s.filter(q => Math.min(q.x1 - q.x0, q.z1 - q.z0) >= tn.thin); } return big; }
  // bakış noktasını büyütülmüş kutuların dışına it (takip gecikmesi/ileriye bakma yüzünden duvara girmesin)
  function disari(o, m) { for (const s of solids()) { const x0 = s.x0 - m, x1 = s.x1 + m, z0 = s.z0 - m, z1 = s.z1 + m; if (o.x > x0 && o.x < x1 && o.z > z0 && o.z < z1) { const l = o.x - x0, r = x1 - o.x, t = o.z - z0, b = z1 - o.z, k = Math.min(l, r, t, b); if (k === l) o.x = x0; else if (k === r) o.x = x1; else if (k === t) o.z = z0; else o.z = z1; } } }
  // (ox,oz)'den (dx,dz) birim yönünde en çok D kadar giden ışının büyütülmüş kutulara ilk değdiği yatay uzaklık
  function isin(ox, oz, dx, dz, D, m) {
    let best = D;
    for (const s of solids()) {
      const x0 = s.x0 - m, x1 = s.x1 + m, z0 = s.z0 - m, z1 = s.z1 + m; let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-9) { if (ox <= x0 || ox >= x1) continue; } else { let a = (x0 - ox) / dx, b = (x1 - ox) / dx; if (a > b) { const c = a; a = b; b = c; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 >= t1) continue; }
      if (Math.abs(dz) < 1e-9) { if (oz <= z0 || oz >= z1) continue; } else { let a = (z0 - oz) / dz, b = (z1 - oz) / dz; if (a > b) { const c = a; a = b; b = c; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 >= t1) continue; }
      if (t0 < best) best = t0;
    }
    return best;
  }
  function fovYaz(cam, f) { if (Math.abs(cam.fov - f) > .005) { cam.fov = f; cam.updateProjectionMatrix(); } }

  function update(cam, dt) {
    const ps = SO.ps;
    if (st.mode !== 'takip') { fovYaz(cam, st.fov); has = false; lastYaw = null;
      const d = st.dist, a = ps.yaw + ({ yan: Math.PI / 2, on: 0, arka: Math.PI, capraz: Math.PI * .22 })[st.mode]; cam.position.set(ps.x + Math.sin(a) * d, ps.groundY + 1.25, ps.z + Math.cos(a) * d); cam.lookAt(V.set(ps.x, ps.groundY + 1.0, ps.z)); return; }
    const tx = ps.x, ty = ps.y + st.height, tz = ps.z, spd = ps.speed || 0;
    if (!has || Math.hypot(P.x - tx, P.z - tz) > 8) { has = true; P.x = tx; P.y = ty; P.z = tz; P.vx = P.vy = P.vz = 0; Ld.x = Ld.z = Ld.vx = Ld.vz = 0; st.cur = null; dip.x = dip.v = 0; lastLanded = ps.landedAt; st.kick = 0; holdT = 0; }

    // 2. elle çevirme algısı + otomatik arkaya dönme
    if (lastYaw === null) { lastYaw = st.yaw; lastPitch = st.pitch; }
    if (st.yaw !== lastYaw || st.pitch !== lastPitch) st.manualAt = SO.time;
    const bos = SO.time - st.manualAt - tn.autoDelay;
    if (bos > 0 && dt > 0 && spd > .5 && ps.wantMag > .08 && ps.grounded) {
      const fark = wrapA(Math.atan2(ps.vx, ps.vz) - st.yaw), af = Math.abs(fark);
      const guc = clamp(bos / tn.autoRamp, 0, 1) * (1 - smooth(tn.autoBack[0], tn.autoBack[1], af));
      if (guc > 0 && af > .002) {
        const hf = clamp((spd - .5) / (SO.tune.sprint - .5), 0, 1), k = SO.lerp(tn.autoK[0], tn.autoK[1], hf) * guc;
        const adim = clamp(fark * (1 - Math.exp(-k * dt)), -tn.autoMax * dt, tn.autoMax * dt);
        st.yaw = wrapA(st.yaw + adim); st.pitch = damp(st.pitch, tn.pitchRest, tn.pitchK * guc, dt);
      }
    }
    lastYaw = st.yaw; lastPitch = st.pitch;

    // 1. yumuşak takip + ileriye bakma
    const lm = Math.min(tn.leadMax, spd * tn.lead), lx = spd > .05 ? ps.vx / spd * lm : 0, lz = spd > .05 ? ps.vz / spd * lm : 0;
    yay(Ld, 'x', 'vx', lx, tn.leadT, dt); yay(Ld, 'z', 'vz', lz, tn.leadT, dt);
    yay(P, 'x', 'vx', tx + Ld.x, tn.followT, dt); yay(P, 'z', 'vz', tz + Ld.z, tn.followT, dt); yay(P, 'y', 'vy', ty, ps.grounded ? tn.followTY : tn.followTYAir, dt);
    disari(P, tn.margin + .02);
    st.px = P.x; st.py = P.y; st.pz = P.z;

    // 3. depar: görüş açısı + uzaklık
    const kT = smooth(SO.tune.jog * .9, SO.tune.sprint, spd) * .85 + smooth(SO.tune.walk, SO.tune.jog, spd) * .15; st.kick = damp(st.kick, kT, tn.kickK, dt);
    fovNow = st.fov + tn.fovAdd * st.kick; fovYaz(cam, fovNow);

    // 4. iniş çökmesi (tek sefer, sönümlü yay)
    if (ps.landedAt !== lastLanded) { lastLanded = ps.landedAt; if (ps.grounded && ps.fallSpeed > 2) dip.v -= Math.min(tn.dipMax, ps.fallSpeed * tn.dipGain); }
    { let kalan = Math.min(dt, .1); while (kalan > 1e-6) { const h = Math.min(kalan, 1 / 120); dip.v += (-tn.dipW * tn.dipW * dip.x - 2 * tn.dipZ * tn.dipW * dip.v) * h; dip.x += dip.v * h; kalan -= h; } }
    if (Math.abs(dip.x) < 1e-5 && Math.abs(dip.v) < 1e-4) dip.x = dip.v = 0; st.dip = dip.x;

    // 5. çarpışma
    const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch), D = st.dist + tn.distAdd * st.kick, Dh = Math.max(.01, D * cp), bx = -Math.sin(st.yaw), bz = -Math.cos(st.yaw);
    const kesin = isin(P.x, P.z, bx, bz, Dh, tn.margin) / Dh * D; let hedef = kesin;
    for (const a of tn.whisk) for (const sg of [-1, 1]) { const ang = st.yaw + sg * a, dw = isin(P.x, P.z, -Math.sin(ang), -Math.cos(ang), Dh, tn.margin) / Dh * D; if (dw < D) { const pay = a / (tn.whisk[tn.whisk.length - 1] * 1.6); hedef = Math.min(hedef, dw + (D - dw) * pay); } }
    if (st.cur == null) st.cur = hedef;
    else if (hedef < st.cur) { st.cur = damp(st.cur, hedef, tn.inK, dt); holdT = tn.outHold; }
    else { holdT -= dt; if (holdT <= 0) st.cur = damp(st.cur, hedef, tn.outK, dt); }
    if (st.cur > kesin) { st.cur = kesin; holdT = tn.outHold; } // kamera hiçbir karede duvarın içine giremez
    const d = Math.max(.05, st.cur), yakin = smooth(0, 1, 1 - d / tn.minD);
    const cx = P.x + bx * cp * d, cz = P.z + bz * cp * d;
    let cy = P.y + sp * d + yakin * tn.closeUp + dip.x; cy = Math.max(SO.world.groundY(cx, cz) + tn.floor, cy);
    cam.position.set(cx, cy, cz); cam.lookAt(V.set(P.x, P.y + .35 - yakin * tn.closeLook + dip.x * .6, P.z));
  }
  SO.kamera = { update };
})();
