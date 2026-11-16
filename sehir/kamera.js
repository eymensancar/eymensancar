/* Kamera: oyuncunun arkasında döner; araya bina girerse yaklaşır. SO.cam: yaw (bakış yönü), pitch, dist.
   Test için SO.cam.mode: 'takip' (oyun), 'yan' | 'on' | 'arka' | 'capraz' (karaktere sabit açıdan bakar; hareket incelemesi). */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, V = new T3.Vector3();
  const st = SO.cam = { yaw: Math.PI, pitch: .16, dist: 5.4, cur: null, mode: 'takip', fov: 55, height: 1.45 };
  function update(cam, dt) {
    const ps = SO.ps;
    if (st.mode !== 'takip') { const d = st.dist, a = ps.yaw + ({ yan: Math.PI / 2, on: 0, arka: Math.PI, capraz: Math.PI * .22 })[st.mode]; cam.position.set(ps.x + Math.sin(a) * d, ps.groundY + 1.25, ps.z + Math.cos(a) * d); cam.lookAt(V.set(ps.x, ps.groundY + 1.0, ps.z)); return; }
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch), tx = ps.x, ty = ps.y + st.height, tz = ps.z; let d = st.dist;
    for (let k = 1; k <= 12; k++) { const dk = st.dist * k / 12; if (SO.world.inside(tx - fx * cp * dk, tz - fz * cp * dk)) { d = Math.max(1.2, st.dist * (k - 1) / 12 - .3); break; } }
    st.cur = st.cur == null ? d : st.cur + (d - st.cur) * Math.min(1, dt * (d < st.cur ? 18 : 4));
    cam.position.set(tx - fx * cp * st.cur, Math.max(.5, ty + sp * st.cur), tz - fz * cp * st.cur); cam.lookAt(V.set(tx, ty + .35, tz));
  }
  SO.kamera = { update };
})();
