/* Ayak ve zemin katmanı (order 40): ayakların zemine oturması (yol 0 m / kaldırım 0,18 m), kalça yüksekliği, dururken ayak kilidi.
   Hepsi post() içinde, mixer ve öteki katmanlar kemikleri yazdıktan sonra; yalnız thigh/calf/foot kemiklerine ve ps.rootDy'ye dokunur.

   Nasıl çalışır:
   - Kökün dünya matrisi ana.js'te bu katmandan SONRA yazıldığı için, post başında kök (ps.x, ps.y, ps.z) + (leanFwd, yaw, lean)
     ile (rootDy'siz) yerine konur ve matrisler güncellenir. Bütün hesap bu "rootDy = 0" uzayında yapılır; rootDy yalnız dikey
     bir kayma olduğu için hedefler rootDy kadar ters kaydırılır.
   - Her ayak için: ayağın (bilek + parmak kökü, ve gidiş yönünde biraz ilerisi) altındaki zemin yüksekliği → yumuşatılmış "ayak zemini".
     Hedef bilek yüksekliği = klipteki bilek yüksekliği + (ayak zemini − ps.y). Yani salınımdaki ayak yere çekilmez, yalnız zemin farkı
     kadar kaydırılır; fizik ps.y'yi basamakta süzdürürken ayaklar gerçek zemine göre durur (gömülme/havada kalma olmaz).
   - Kalça: yere basan ayaklardan alçaktakinin zeminine iner (ps.rootDy). Salınımdaki ayak kalçayı aşağı çekmez.
   - İki kemikli ters kinematik (kosinüs teoremi), dünya uzayında: diz bükülme düzlemi klipten alınır (diz öne bakmaya devam eder),
     ayak bileğinin dünya dönüşü klipteki gibi bırakılır (taban düz kalır).
   - Dururken (hız ≈ 0) yere basan ayağın dünya XZ konumu kilitlenir; klip konumu kilitten çok uzaklaşırsa (lockBreak) ayak küçük bir
     adımla yeni yerine geçer.
   - Havada (ps.grounded değil / ps.airBlend yüksek) ağırlık 0'a iner: katman tamamen kapanır.
   Ayarlar: SO.tune.ayak. Dışarıya bilgi: SO.ayak (w, base, legs: ölçüm/deneme için). */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, damp = SO.damp;
  const tn = SO.tune.ayak = {
    on: true,
    restAnkle: .103,   // düz zeminde yere basan ayağın bilek yüksekliği (m)
    minBall: .012,     // parmak kökü zeminin en az bu kadar üstünde kalır (klip karışımında hafif gömülmeyi alır)
    swing0: .03, swing1: .14, // bilek, restAnkle'ın bu kadar üstündeyse "basıyor" (0) … "salınımda" (1)
    upK: 30, downK: 16, // ayak zemini yumuşatması: yükselirken hızlı (kaldırıma takılmasın), inerken daha sakin
    toe: .6,           // zemin, bilekten parmak köküne giden yolun bu oranındaki noktada da ölçülür (parmak ucu kaldırım kenarına değince ayak havaya kalkmasın)
    ahead: .10,        // ayağın gidiş yönünde kaç saniye ilerisindeki zemine bakılır (basamağa varmadan kalkmaya başlar)
    hipK: 10,          // kalça yüksekliği yumuşatması
    maxOff: .32,       // bir ayağın ps.y'ye göre en çok kayması (m)
    reach: .995,       // bacak en çok boyunun bu oranına kadar uzar (diz kilitlenip sıçramasın)
    onK: 10, offK: 18, // katman ağırlığı: yere inince açılma / havalanınca kapanma hızı
    lock: true, lockSpeed: .12, lockBreak: .2, lockIn: 10, lockOut: 8, lockOutMove: 14, stepLift: .03
  };
  const V3 = T3.Vector3, Q = T3.Quaternion;
  const A = new V3(), K = new V3(), F = new V3(), Bp = new V3(), T = new V3(), ab = new V3(), cb = new V3(), ac = new V3(), at = new V3(), ax0 = new V3(), ax1 = new V3(), tmp = new V3(), sc = new V3();
  const qT = new Q(), qC = new Q(), qF = new Q(), qP = new Q(), r0 = new Q(), r1 = new Q(), r2 = new Q(), nT = new Q(), nC = new Q();
  const st = SO.ayak = { w: 0, base: 0, legs: null, lx: 0, lz: 0, has: false };
  const acos = v => Math.acos(clamp(v, -1, 1)), smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wq = (o, q) => o.matrixWorld.decompose(tmp, q, sc);

  // İki kemikli çözüm: kalça A, diz K, bilek F (dünya) → bilek T'ye gider. Diz, klipteki bükülme düzleminde kalır.
  function ik(L, yaw) {
    A.setFromMatrixPosition(L.thigh.matrixWorld); K.setFromMatrixPosition(L.calf.matrixWorld);
    wq(L.thigh, qT); wq(L.calf, qC); wq(L.foot, qF); wq(L.thigh.parent, qP);
    ab.subVectors(K, A); cb.subVectors(F, K); ac.subVectors(F, A); at.subVectors(T, A);
    const lab = ab.length(), lcb = cb.length(), lac = ac.length(), lat0 = at.length(); if (lab < 1e-5 || lcb < 1e-5 || lac < 1e-5 || lat0 < 1e-5) return;
    const lat = clamp(lat0, Math.abs(lab - lcb) + .02, (lab + lcb) * tn.reach);
    const a0 = acos(ac.dot(ab) / (lac * lab)), b0 = acos(-ab.dot(cb) / (lab * lcb)), t0 = acos(ac.dot(at) / (lac * lat0));
    const a1 = acos((lab * lab + lat * lat - lcb * lcb) / (2 * lab * lat)), b1 = acos((lab * lab + lcb * lcb - lat * lat) / (2 * lab * lcb));
    ax0.crossVectors(ac, ab); if (ax0.lengthSq() < 1e-8 * lac * lac * lab * lab) { tmp.set(Math.sin(yaw), 0, Math.cos(yaw)); ax0.crossVectors(ac, tmp); } ax0.normalize();
    ax1.crossVectors(ac, at); if (ax1.lengthSq() < 1e-12) r2.set(0, 0, 0, 1); else r2.setFromAxisAngle(ax1.normalize(), t0);
    r0.setFromAxisAngle(ax0, a1 - a0); r1.setFromAxisAngle(ax0, b1 - b0);
    r2.multiply(r0); nT.copy(r2).multiply(qT); nC.copy(r2).multiply(r1).multiply(qC);
    L.thigh.quaternion.copy(qP).invert().multiply(nT);
    L.calf.quaternion.copy(nT).invert().multiply(nC);
    L.foot.quaternion.copy(nC).invert().multiply(qF); // bilek: klipteki dünya dönüşü (taban düz)
  }

  SO.anim.register({ name: 'ayak', order: 40,
    init(ctx) {
      const b = ctx.bones, leg = s => (b['thigh_' + s] && b['calf_' + s] && b['foot_' + s]) ? { s, thigh: b['thigh_' + s], calf: b['calf_' + s], foot: b['foot_' + s], ball: b['ball_' + s] || b['foot_' + s], g: 0, off: 0, p: 1, px: 0, pz: 0, lockOn: false, lockW: 0, lx: 0, lz: 0, rel: false, err: 0 } : null;
      const l = leg('l'), r = leg('r'); st.legs = l && r ? [l, r] : null;
    },
    post(ctx, dt) {
      const ps = ctx.ps, legs = st.legs, world = ctx.world;
      if (!tn.on || !legs) { ps.rootDy = 0; st.w = 0; st.has = false; return; }
      const root = ctx.char.root, yaw = ps.yaw;
      // kök: ana.js'in birazdan yazacağı değerler (rootDy'siz); kemiklerin dünya konumu bu kareye ait olsun
      root.position.set(ps.x, ps.y, ps.z); root.rotation.order = 'YXZ'; root.rotation.set(ps.leanFwd || 0, yaw, ps.lean || 0); root.updateMatrixWorld(true);
      const isin = !st.has || Math.hypot(ps.x - st.lx, ps.z - st.lz) > 1.5; // ilk kare ya da ışınlanma: yumuşatmaları sıfırla
      st.lx = ps.x; st.lz = ps.z; st.has = true;
      const wT = ps.grounded ? clamp(1 - (ps.airBlend || 0) * 1.5, 0, 1) : 0; st.w = isin ? wT : damp(st.w, wT, wT < st.w ? tn.offK : tn.onK, dt); const w = st.w;
      const standing = tn.lock && ps.grounded && ps.speed < tn.lockSpeed && ps.wantMag < .08 && (ps.airBlend || 0) < .05 && Math.abs(ps.yawRate || 0) < .3;
      const idt = dt > 1e-5 ? 1 / dt : 0;
      for (const L of legs) {
        F.setFromMatrixPosition(L.foot.matrixWorld); Bp.setFromMatrixPosition(L.ball.matrixWorld);
        L.fx = F.x; L.fy = F.y; L.fz = F.z; L.by = Bp.y;
        let vx = isin ? 0 : (F.x - L.px) * idt, vz = isin ? 0 : (F.z - L.pz) * idt; const vm = Math.hypot(vx, vz); if (vm > 9) { vx *= 9 / vm; vz *= 9 / vm; } L.px = F.x; L.pz = F.z;
        L.p = 1 - smooth(tn.swing0, tn.swing1, F.y - ps.y - tn.restAnkle);
        // dururken kilit
        if (isin) { L.lockOn = false; L.lockW = 0; }
        if (L.lockOn) { if (!standing) { L.lockOn = false; L.rel = false; } else if (Math.hypot(F.x - L.lx, F.z - L.lz) > tn.lockBreak) { L.lockOn = false; L.rel = true; } }
        else if (standing && L.lockW < .02 && L.p > .7) { L.lockOn = true; L.rel = false; L.lx = F.x; L.lz = F.z; }
        L.lockW = damp(L.lockW, L.lockOn ? 1 : 0, L.lockOn ? tn.lockIn : standing ? tn.lockOut : tn.lockOutMove, dt); if (L.lockW < .001 && !L.lockOn) L.lockW = 0;
        const lw = L.lockW * L.lockW * (3 - 2 * L.lockW) * w, dx = (L.lx - F.x) * lw, dz = (L.lz - F.z) * lw; L.tx = F.x + dx; L.tz = F.z + dz;
        // ayağın altındaki zemin: bilek + ayak ortası + gidiş yönünde biraz ilerisi; en yükseği
        const ax = vx * tn.ahead, az = vz * tn.ahead, bx = L.tx + (Bp.x - F.x) * tn.toe, bz = L.tz + (Bp.z - F.z) * tn.toe;
        let g = Math.max(world.groundY(L.tx, L.tz), world.groundY(bx, bz));
        if (vm > .2) g = Math.max(g, world.groundY(L.tx + ax, L.tz + az), world.groundY(bx + ax, bz + az), world.groundY(L.tx + ax * .5, L.tz + az * .5));
        L.g = isin ? g : damp(L.g, g, g > L.g ? tn.upK : tn.downK, dt);
        L.off = clamp(L.g - ps.y, -tn.maxOff, tn.maxOff);
      }
      // kalça: yere basan ayaklardan alçaktakinin zemini (salınımdaki ayak, ötekinin değerine yaklaşır: kalçayı çekmez)
      const l = legs[0], r = legs[1], hi = Math.max(l.off, r.off), lo = Math.min(l.off + (hi - l.off) * (1 - l.p), r.off + (hi - r.off) * (1 - r.p));
      st.base = (isin || w < .01) ? ps.y + lo * (w < .01 ? 0 : 1) : damp(st.base, ps.y + lo, tn.hipK, dt);
      st.base = clamp(st.base, ps.y - tn.maxOff, ps.y + tn.maxOff);
      const rootDy = ps.rootDy = (st.base - ps.y) * w;
      for (const L of legs) {
        const lift = Math.max(0, tn.minBall - (L.by - ps.y)) * w, step = L.rel ? tn.stepLift * Math.sin(Math.PI * L.lockW) * w : 0;
        const dy = w * L.off - rootDy + lift + step; L.err = dy;
        if (Math.abs(dy) < 4e-4 && L.lockW === 0) continue;
        F.set(L.fx, L.fy, L.fz); T.set(L.tx, L.fy + dy, L.tz); ik(L, yaw);
      }
    } });
})();
