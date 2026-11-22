// Uçak modelleri (düşük poligon, three.js temel şekillerinden).
// Model ekseni: +X sağ kanat, +Y yukarı, -Z burun. Orijin ağırlık merkezi (FDM ile aynı).
import * as THREE from '../vendor/three.module.min.js';

const D2R = Math.PI / 180;

// Kesitlerden gövde: sections = [{z, w, h, y}] (z arkaya doğru artar)
function loft(sections, seg = 10) {
  const pos = [], idx = [];
  for (const s of sections) {
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      // yuvarlatılmış dikdörtgen kesit (süperelips)
      const c = Math.cos(a), sn = Math.sin(a);
      const ex = 0.6;
      const x = Math.sign(c) * Math.pow(Math.abs(c), ex) * s.w / 2;
      const y = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * s.h / 2 + (s.y || 0);
      pos.push(x, y, s.z);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * seg + k, b = i * seg + (k + 1) % seg, c = a + seg, d = b + seg;
    idx.push(a, c, b, b, c, d);
  }
  // uç kapakları
  const capF = pos.length / 3; const f = sections[0]; pos.push(0, f.y || 0, f.z);
  for (let k = 0; k < seg; k++) idx.push(capF, k, (k + 1) % seg);
  const capB = pos.length / 3; const l = sections[sections.length - 1]; pos.push(0, l.y || 0, l.z);
  const o = (sections.length - 1) * seg;
  for (let k = 0; k < seg; k++) idx.push(capB, o + (k + 1) % seg, o + k);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// kanat yüzeyi: kök ve uç veter, açıklık, ok açısı, kalınlık
function wingGeom(span, rootC, tipC, sweep, thick, dihedral = 0) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(span, -sweep); s.lineTo(span, -sweep - tipC); s.lineTo(0, -rootC); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  // şekil XY düzleminde: x = açıklık, y = veter yönü (-y arkaya). Döndür: y -> z
  g.rotateX(-Math.PI / 2); // (x, y, z) -> (x, z, -y): veter arkaya (+z), kalınlık yukarı
  g.translate(0, -thick / 2, 0);
  if (dihedral) g.rotateZ(dihedral);
  return g;
}

function mats(base, stripe) {
  return {
    body: new THREE.MeshLambertMaterial({ color: base, side: THREE.DoubleSide }),
    stripe: new THREE.MeshLambertMaterial({ color: stripe, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhongMaterial({ color: 0x24313d, specular: 0x99aabb, shininess: 80, transparent: true, opacity: 0.8 }),
    dark: new THREE.MeshLambertMaterial({ color: 0x2a2a2c }),
    metal: new THREE.MeshLambertMaterial({ color: 0x9a9ea4 }),
    tire: new THREE.MeshLambertMaterial({ color: 0x1b1b1b }),
    panel: new THREE.MeshLambertMaterial({ color: 0x1e2226 }),
  };
}

function wheel(m, r, w) { const g = new THREE.CylinderGeometry(r, r, w, 14); g.rotateZ(Math.PI / 2); return new THREE.Mesh(g, m.tire); }
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
function addMesh(parent, geom, mat, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geom, mat); o.position.set(x, y, z); parent.add(o); return o; }

export function buildC172() {
  const root = new THREE.Group();
  const m = mats(0xf4f4f2, 0xb3262e);
  const parts = { root };
  // gövde
  const fus = loft([
    { z: -2.35, w: 0.5, h: 0.55, y: 0.05 }, { z: -2.15, w: 0.95, h: 0.9, y: 0.05 }, { z: -1.6, w: 1.08, h: 1.05, y: 0.1 },
    { z: -1.2, w: 1.15, h: 1.35, y: 0.22 }, { z: 0.2, w: 1.15, h: 1.45, y: 0.2 }, { z: 1.3, w: 1.0, h: 1.2, y: 0.25 },
    { z: 3.0, w: 0.55, h: 0.75, y: 0.4 }, { z: 4.6, w: 0.3, h: 0.45, y: 0.52 }, { z: 5.7, w: 0.14, h: 0.3, y: 0.58 },
  ], 12);
  parts.hide = [addMesh(root, fus, m.body)];
  // şerit
  for (const s of [-1, 1]) { const st = addMesh(root, new THREE.BoxGeometry(0.02, 0.12, 6.0), m.stripe, s * 0.565, -0.05, 1.0); st.rotation.x = -0.05; parts.hide.push(st); }
  // camlar
  const ws = addMesh(root, new THREE.BoxGeometry(1.0, 0.55, 0.9), m.glass, 0, 0.6, -0.95); ws.rotation.x = -0.75; parts.hide.push(ws);
  for (const s of [-1, 1]) parts.hide.push(addMesh(root, new THREE.BoxGeometry(0.02, 0.5, 1.5), m.glass, s * 0.58, 0.55, -0.1));
  const rw = addMesh(root, new THREE.BoxGeometry(0.9, 0.42, 0.8), m.glass, 0, 0.62, 1.15); rw.rotation.x = 0.6; parts.hide.push(rw);
  // kokpitten görünen motor kaputu
  parts.cowl = addMesh(root, new THREE.BoxGeometry(0.9, 0.12, 1.1), m.body, 0, 0.42, -1.75); parts.cowl.visible = false;
  // gösterge paneli (kokpitten görünür)
  addMesh(root, new THREE.BoxGeometry(1.05, 0.32, 0.12), m.panel, 0, 0.32, -0.85);
  // kanat (yüksek kanat, 1.7° dihedral)
  const wingY = 0.92;
  parts.ail = []; parts.flap = [];
  for (const s of [-1, 1]) {
    const half = new THREE.Group(); half.position.set(0, wingY, 0); half.rotation.z = s * 1.7 * D2R; root.add(half);
    const wg = wingGeom(5.45, 1.25, 0.95, 0.0, 0.16);
    const w = addMesh(half, wg, m.body, 0, 0, -0.55); if (s < 0) { w.scale.x = -1; }
    // flap ve kanatçık (arka kenar)
    const fp = pivot(half, s * 1.95, 0, 0.7);
    addMesh(fp, new THREE.BoxGeometry(2.7, 0.06, 0.32), m.body, 0, -0.02, 0.16);
    parts.flap.push(fp);
    const ap = pivot(half, s * 4.3, 0, 0.62);
    addMesh(ap, new THREE.BoxGeometry(1.9, 0.05, 0.3), m.body, 0, -0.02, 0.15);
    parts.ail.push(ap);
    // kanat ucu kırmızı / yeşil seyrüsefer lambası
    addMesh(half, new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff2020 : 0x20ff40 }), s * 5.45, 0, -0.1);
    // dikme
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), m.body);
    strut.position.set(s * 1.57, 0.25, 0.05); strut.rotation.z = -s * Math.atan2(2.05, 1.2); root.add(strut);
  }
  // yatay stabilize ve elevatör
  const hs = new THREE.Group(); hs.position.set(0, 0.55, 4.85); root.add(hs);
  for (const s of [-1, 1]) { const w = addMesh(hs, wingGeom(1.7, 0.8, 0.55, 0.2, 0.08), m.body, 0, 0, -0.1); if (s < 0) w.scale.x = -1; }
  parts.elev = pivot(hs, 0, 0, 0.72);
  addMesh(parts.elev, new THREE.BoxGeometry(3.2, 0.05, 0.42), m.body, 0, 0, 0.2);
  // dikey kuyruk ve dümen
  const vs = new THREE.Shape(); vs.moveTo(0, 0); vs.lineTo(-1.45, 0); vs.lineTo(-0.55, 1.5); vs.lineTo(0, 1.5); vs.closePath();
  const vg = new THREE.ExtrudeGeometry(vs, { depth: 0.07, bevelEnabled: false }); vg.rotateY(-Math.PI / 2); vg.translate(0.035, 0, 0);
  // şekil x: -1.45..0 (öne doğru eksi), rotateY(-90): x -> z
  addMesh(root, vg, m.body, 0, 0.7, 5.35);
  parts.rud = pivot(root, 0, 0.7, 5.38);
  addMesh(parts.rud, new THREE.BoxGeometry(0.06, 1.45, 0.4), m.stripe, 0, 0.75, 0.2);
  // pervane
  parts.prop = pivot(root, 0, 0.05, -2.42);
  addMesh(parts.prop, new THREE.ConeGeometry(0.17, 0.35, 10).rotateX(-Math.PI / 2), m.metal);
  const blades = new THREE.Group(); parts.prop.add(blades);
  for (const s of [-1, 1]) { const b = addMesh(blades, new THREE.BoxGeometry(0.11, 0.9, 0.03), m.dark, 0, s * 0.48, 0.02); b.rotation.y = s * 0.25; }
  parts.blades = blades;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  parts.prop.add(disc); parts.disc = disc;
  // iniş takımı (FDM noktaları: burun (1.2, 0, 1.25), ana (-0.35, ±1.25, 1.25))
  parts.wheels = [];
  const nw = wheel(m, 0.19, 0.12); nw.position.set(0, -1.25 + 0.19, -1.2); root.add(nw); parts.wheels.push(nw);
  addMesh(root, new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), m.metal, 0, -0.8, -1.25);
  addMesh(root, new THREE.BoxGeometry(0.22, 0.2, 0.5), m.body, 0, -1.08 + 0.19, -1.2);
  for (const s of [-1, 1]) {
    const w = wheel(m, 0.21, 0.14); w.position.set(s * 1.25, -1.25 + 0.21, 0.35); root.add(w); parts.wheels.push(w);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.12), m.metal); leg.position.set(s * 0.9, -0.75, 0.35); leg.rotation.z = s * 0.75; root.add(leg);
    addMesh(root, new THREE.BoxGeometry(0.2, 0.22, 0.6), m.body, s * 1.25, -1.25 + 0.3, 0.35);
  }
  parts.update = (ac, dt) => animate(parts, ac, dt, 'prop');
  return parts;
}

export function buildJet() {
  const root = new THREE.Group();
  const m = mats(0xe9eaec, 0xe05a1c);
  const parts = { root };
  const fus = loft([
    { z: -6.0, w: 0.15, h: 0.15, y: -0.1 }, { z: -5.4, w: 0.65, h: 0.7, y: -0.05 }, { z: -4.0, w: 1.05, h: 1.15, y: 0.0 },
    { z: -2.0, w: 1.3, h: 1.45, y: 0.05 }, { z: 0.5, w: 1.5, h: 1.45, y: 0.05 }, { z: 3.0, w: 1.15, h: 1.15, y: 0.05 },
    { z: 5.2, w: 0.75, h: 0.8, y: 0.05 }, { z: 6.0, w: 0.6, h: 0.65, y: 0.05 },
  ], 14);
  parts.hide = [addMesh(root, fus, m.body)];
  // kanopi
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), m.glass); can.scale.set(0.55, 0.55, 2.3); can.position.set(0, 0.62, -2.4); root.add(can); parts.hide.push(can);
  parts.cowl = addMesh(root, new THREE.BoxGeometry(0.7, 0.1, 2.0), m.body, 0, 0.3, -4.6); parts.cowl.visible = false;
  // hava alığı
  for (const s of [-1, 1]) addMesh(root, new THREE.CylinderGeometry(0.38, 0.42, 1.6, 10).rotateX(Math.PI / 2), m.dark, s * 0.85, 0.25, -0.6);
  // egzoz
  addMesh(root, new THREE.CylinderGeometry(0.33, 0.33, 0.3, 12).rotateX(Math.PI / 2), m.dark, 0, 0.05, 6.05);
  // kanat (alçak kanat, 2.5° dihedral) ve uç tankları
  parts.ail = []; parts.flap = [];
  for (const s of [-1, 1]) {
    const half = new THREE.Group(); half.position.set(0, -0.45, 0); half.rotation.z = s * 2.5 * D2R; root.add(half);
    const w = addMesh(half, wingGeom(4.73, 2.8, 1.4, 0.6, 0.2), m.body, 0, 0, -1.2); if (s < 0) w.scale.x = -1;
    const tank = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), m.stripe); tank.scale.set(0.3, 0.3, 1.7); tank.position.set(s * 4.75, 0, -0.95); half.add(tank);
    const fp = pivot(half, s * 1.6, 0, 1.45); addMesh(fp, new THREE.BoxGeometry(2.0, 0.07, 0.45), m.body, 0, 0, 0.22); parts.flap.push(fp);
    const ap = pivot(half, s * 3.6, 0, 0.98); addMesh(ap, new THREE.BoxGeometry(1.6, 0.06, 0.38), m.body, 0, 0, 0.19); parts.ail.push(ap);
  }
  const hs = new THREE.Group(); hs.position.set(0, 0.45, 4.9); root.add(hs);
  for (const s of [-1, 1]) { const w = addMesh(hs, wingGeom(2.25, 1.3, 0.7, 0.5, 0.1), m.body, 0, 0, -0.3); if (s < 0) w.scale.x = -1; }
  parts.elev = pivot(hs, 0, 0, 0.98); addMesh(parts.elev, new THREE.BoxGeometry(4.0, 0.06, 0.4), m.stripe, 0, 0, 0.2);
  const vsS = new THREE.Shape(); vsS.moveTo(0, 0); vsS.lineTo(-2.3, 0); vsS.lineTo(-0.7, 2.2); vsS.lineTo(0, 2.2); vsS.closePath();
  const vg = new THREE.ExtrudeGeometry(vsS, { depth: 0.1, bevelEnabled: false }); vg.rotateY(-Math.PI / 2); vg.translate(0.05, 0, 0);
  addMesh(root, vg, m.body, 0, 0.55, 5.6);
  parts.rud = pivot(root, 0, 0.55, 5.62); addMesh(parts.rud, new THREE.BoxGeometry(0.08, 2.0, 0.5), m.stripe, 0, 1.05, 0.25);
  // gösterge paneli
  addMesh(root, new THREE.BoxGeometry(0.8, 0.3, 0.2), m.panel, 0, 0.5, -3.3);
  // iniş takımı: burun (2.4, 0, 1.45), ana (-0.3, ±1.22, 1.45)
  parts.wheels = []; parts.gear = new THREE.Group(); root.add(parts.gear);
  const nw = wheel(m, 0.24, 0.16); nw.position.set(0, -1.45 + 0.24, -2.4); parts.gear.add(nw); parts.wheels.push(nw);
  addMesh(parts.gear, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), m.metal, 0, -0.85, -2.4);
  for (const s of [-1, 1]) {
    const w = wheel(m, 0.3, 0.2); w.position.set(s * 1.22, -1.45 + 0.3, 0.3); parts.gear.add(w); parts.wheels.push(w);
    addMesh(parts.gear, new THREE.CylinderGeometry(0.06, 0.06, 0.95, 6), m.metal, s * 1.22, -0.75, 0.3);
  }
  parts.update = (ac, dt) => animate(parts, ac, dt, 'jet');
  return parts;
}

export function setCockpit(p, on) {
  for (const o of p.hide) o.visible = !on;
  if (p.cowl) p.cowl.visible = on;
  p.inCockpit = on;
}

function animate(p, ac, dt, kind) {
  const s = ac.surf;
  // elevatör: negatif de = arka kenar yukarı
  p.elev.rotation.x = s.de;
  p.rud.rotation.y = -s.dr;
  p.ail[0].rotation.x = s.da; p.ail[1].rotation.x = -s.da;
  const fl = s.flap * (ac.P.flapDetents[ac.P.flapDetents.length - 1]) * D2R;
  p.flap[0].rotation.x = fl; p.flap[1].rotation.x = fl;
  if (kind === 'prop') {
    const w = ac.rpm / 60 * Math.PI * 2;
    p.prop.rotation.z += w * dt * 0.999;
    const fast = ac.rpm > 900;
    p.blades.visible = !fast || (Math.random() < 0.15);
    p.disc.material.opacity = Math.min(0.28, ac.rpm / 9000) * (p.inCockpit ? 0.25 : 1);
    p.disc.visible = ac.rpm > 300;
  } else {
    const g = ac.gearPos;
    p.gear.visible = g > 0.05;
    p.gear.scale.y = 0.3 + 0.7 * g;
    p.gear.position.y = (1 - g) * 0.6;
  }
  // tekerlek yay sıkışması
  for (let i = 0; i < p.wheels.length; i++) {
    const w = p.wheels[i]; if (w.userData.y0 == null) w.userData.y0 = w.position.y;
    w.position.y = w.userData.y0 + (ac.wheel[i] ? Math.min(0.3, ac.wheel[i].comp) : 0);
    const v = Math.hypot(ac.vel[0], ac.vel[1]);
    if (ac.wheel[i] && ac.wheel[i].contact) w.rotation.x -= v * dt / 0.22;
  }
}
