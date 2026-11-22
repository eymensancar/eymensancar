// Uçak modelleri (düşük poligon, three.js temel şekillerinden).
// Model ekseni: +X sağ kanat, +Y yukarı, -Z burun. Orijin ağırlık merkezi (FDM ile aynı).
import * as THREE from '../vendor/three.module.min.js';
import { vaporSheet } from './effects.js';

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
  addMesh(root, fus, m.body); parts.hide = [];
  // kanopi
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), m.glass); can.scale.set(0.55, 0.65, 2.3); can.position.set(0, 0.62, -2.4); root.add(can); parts.hide.push(can);
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

// kokpit kamerasında dış modelin gözün çevresindeki parçaları (gövde içi, kanopi, pilot) gizlenir; iç mekânı cockpit.js çizer
export function setCockpit(p, on) {
  if (p.inCockpit === on) return;
  for (const o of p.hide) o.visible = !on;
  if (p.cowl) p.cowl.visible = false;
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

// ======================================================================
// F-16 sınıfı savaş uçağı: ayrıntılı model, PBR malzemeler (MeshStandardMaterial + ortam haritası).
// Kendi nötr boyamız: açık ve orta gri, koyu radom, siyah parlama önleyici, kuyrukta turkuaz şerit ve "İU 01".
// Hareketli yüzeyler: stabilatörler (yunuslama + farklı yatış), flaperonlar, hücum kenarı flapları, dümen, hava freni yok.
// İniş takımı içeri katlanır; ard yakıcı alevi ve parıltısı, seyrüsefer ve çakar lambalar.
// ======================================================================

// Kesit listesinden gövde: her kesit {z, w, h, y, top, bot} (top/bot: üst ve alt yarının basıklığı, 2 = elips)
function loftF(sections, seg = 28) {
  const pos = [], idx = [], uv = [];
  sections.forEach((s, si) => {
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const e = sn >= 0 ? (s.top || 2) : (s.bot || 2);
      const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * s.w / 2;
      const py = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e) * (sn >= 0 ? (s.hu ?? s.h / 2) : (s.hd ?? s.h / 2)) + (s.y || 0);
      pos.push(px, py, s.z); uv.push(k / seg, si / (sections.length - 1));
    }
  });
  const R = seg + 1;
  for (let i = 0; i < sections.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * R + k, b = a + 1, c = a + R, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Düz plan biçimli yüzey (kanat, kuyruk): kenarları yuvarlatılmış ince levha. pts: [[açıklık, veter], ...] (veter + arkaya)
function plate(pts, thick, opt = {}) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]);
  s.closePath();
  const bev = Math.min(thick * 0.45, opt.bevel ?? 0.05);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.005, thick - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(thick - 2 * bev) / 2);
  // şekil düzlemi XY (x açıklık, y = -veter); kalınlık Z. Döndür: kalınlık Y'ye, veter +Z'ye
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
let glowTex = null;
function getGlowTex() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  glowTex.colorSpace = THREE.NoColorSpace;
  return glowTex;
}
function glowSprite(color, size) {
  const m = new THREE.SpriteMaterial({ map: getGlowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}

export function buildF16(envMap = null) {
  const root = new THREE.Group();
  const parts = { root, hide: [] };
  // boya: yerel koordinata bağlı panel çizgileri ve hafif lekeler (doku gerektirmez)
  const panel = (m, sp = 1.15, dark = 0.22) => {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vLp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLp = position;');
      sh.fragmentShader = 'varying vec3 vLp;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 q = vLp / ${sp.toFixed(3)};
          vec3 f = abs(fract(q + 0.5) - 0.5); vec3 w = fwidth(q) * 1.2 + 0.004;
          float ln = 1.0 - min(min(smoothstep(0.0, w.x, f.x), smoothstep(0.0, w.z, f.z)), 1.0);
          float n = fract(sin(dot(floor(vLp * 2.3), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          diffuseColor.rgb *= (1.0 - ${dark.toFixed(2)} * ln) * (0.965 + 0.05 * n); }`);
    };
    m.customProgramCacheKey = () => 'panel' + sp + dark;
    return m;
  };
  const std = (o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ envMap, envMapIntensity: 0.9 }, o)); return m; };
  const M = {
    light: std({ color: 0xa9b1b8, metalness: 0.28, roughness: 0.52 }),
    mid: std({ color: 0x7c868f, metalness: 0.28, roughness: 0.55 }),
    dark: std({ color: 0x4d545b, metalness: 0.3, roughness: 0.5 }),
    black: std({ color: 0x18191b, metalness: 0.2, roughness: 0.6 }),
    teal: std({ color: 0x1aa6b2, metalness: 0.3, roughness: 0.45 }),
    metal: std({ color: 0x77736d, metalness: 0.95, roughness: 0.38 }),
    hot: std({ color: 0x4a3e36, metalness: 0.9, roughness: 0.45 }),
    gear: std({ color: 0xe2e4e6, metalness: 0.4, roughness: 0.45 }),
    tire: std({ color: 0x151515, metalness: 0, roughness: 0.9 }),
    inside: new THREE.MeshBasicMaterial({ color: 0x0b0c0d }),
    glass: std({ color: 0x5e4f2a, metalness: 0.85, roughness: 0.06, transparent: true, opacity: 0.42, envMapIntensity: 1.6, depthWrite: false }),
    seat: std({ color: 0x2b2f33, metalness: 0.1, roughness: 0.8 }),
    helmet: std({ color: 0xd8d6cf, metalness: 0.1, roughness: 0.35 }),
    visor: std({ color: 0x1a1408, metalness: 0.9, roughness: 0.1 }),
  };
  panel(M.light, 1.15, 0.14); panel(M.mid, 1.15, 0.14); panel(M.dark, 1.0, 0.12);
  parts.mats = M;
  const add = (par, geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); par.add(o); return o; };

  // --- gövde: kesitler (z arkaya artar). Üst yarı sırt, alt yarı daha basık ---
  const fusS = [
    { z: -8.05, w: 0.04, h: 0.04, y: -0.05 },
    { z: -7.7, w: 0.34, h: 0.34, y: -0.04 },
    { z: -7.1, w: 0.62, h: 0.62, y: -0.02 },
    { z: -6.3, w: 0.88, h: 0.86, y: 0.0 },
    { z: -5.5, w: 1.04, hu: 0.5, hd: 0.5, y: 0.04, bot: 2.4 },
    { z: -4.6, w: 1.12, hu: 0.52, hd: 0.55, y: 0.08, bot: 2.8 },
    { z: -3.6, w: 1.22, hu: 0.56, hd: 0.6, y: 0.12, bot: 3.2 },
    { z: -2.4, w: 1.34, hu: 0.66, hd: 0.62, y: 0.14, bot: 3.4, top: 2.3 },
    { z: -1.0, w: 1.42, hu: 0.72, hd: 0.64, y: 0.12, bot: 3.6, top: 2.4 },
    { z: 0.6, w: 1.46, hu: 0.74, hd: 0.66, y: 0.1, bot: 3.6, top: 2.6 },
    { z: 2.2, w: 1.44, hu: 0.7, hd: 0.66, y: 0.08, bot: 3.4, top: 2.6 },
    { z: 3.8, w: 1.36, hu: 0.64, hd: 0.62, y: 0.06, bot: 3.0, top: 2.5 },
    { z: 5.2, w: 1.2, hu: 0.56, hd: 0.56, y: 0.04, bot: 2.6, top: 2.3 },
    { z: 6.1, w: 1.06, hu: 0.52, hd: 0.52, y: 0.03 },
    { z: 6.45, w: 1.0, hu: 0.5, hd: 0.5, y: 0.03 },
  ];
  const fus = add(root, loftF(fusS, 32), M.light);
  // radom (koyu) ayrı: burnun ilk 1.6 m'si
  const rad = add(root, loftF(fusS.slice(0, 4).map((s) => ({ ...s, w: s.w * 1.012, h: s.h * 1.012 })), 32), M.dark);
  // pitot
  add(root, new THREE.CylinderGeometry(0.012, 0.02, 0.7, 6).rotateX(Math.PI / 2), M.metal, 0, -0.05, -8.35);
  // sırt (omurga): kanopiden kuyruğa
  const spine = loftF([
    { z: -3.2, w: 0.2, hu: 0.02, hd: 0.02, y: 0.62 }, { z: -2.4, w: 0.66, hu: 0.2, hd: 0.06, y: 0.72 },
    { z: -1.0, w: 0.86, hu: 0.26, hd: 0.08, y: 0.78 }, { z: 1.5, w: 0.9, hu: 0.24, hd: 0.08, y: 0.78 },
    { z: 3.6, w: 0.8, hu: 0.2, hd: 0.08, y: 0.68 }, { z: 5.4, w: 0.6, hu: 0.12, hd: 0.06, y: 0.56 }, { z: 6.2, w: 0.3, hu: 0.02, hd: 0.02, y: 0.5 },
  ], 20);
  add(root, spine, M.mid);
  // parlama önleyici siyah panel (kanopinin önü)
  const ag = loftF([{ z: -6.3, w: 0.2, hu: 0.03, hd: 0.01, y: 0.42 }, { z: -5.8, w: 0.62, hu: 0.06, hd: 0.01, y: 0.5 }, { z: -5.35, w: 0.8, hu: 0.08, hd: 0.01, y: 0.55 }], 16);
  add(root, ag, M.black);
  // gövde-kanat birleşimi (LEX ve kanat kökü): yassı, geniş
  const blend = loftF([
    { z: -5.4, w: 1.1, hu: 0.05, hd: 0.05, y: -0.12 }, { z: -4.0, w: 1.9, hu: 0.1, hd: 0.08, y: -0.12, top: 1.5, bot: 1.5 },
    { z: -2.6, w: 2.5, hu: 0.16, hd: 0.12, y: -0.12, top: 1.4, bot: 1.4 }, { z: -1.2, w: 2.9, hu: 0.22, hd: 0.15, y: -0.12, top: 1.4, bot: 1.4 },
    { z: 1.0, w: 3.0, hu: 0.24, hd: 0.17, y: -0.12, top: 1.4, bot: 1.4 }, { z: 3.0, w: 2.8, hu: 0.2, hd: 0.15, y: -0.12, top: 1.5, bot: 1.5 },
    { z: 4.6, w: 2.3, hu: 0.13, hd: 0.1, y: -0.1, top: 1.6, bot: 1.6 }, { z: 5.8, w: 1.7, hu: 0.06, hd: 0.06, y: -0.06 },
  ], 32);
  add(root, blend, M.light);
  // hava alığı (çene altı): ağız z=-3.6, gövdeye karışarak arkaya
  const intakeS = [
    { z: -3.75, w: 0.98, hu: 0.38, hd: 0.42, y: -0.86, bot: 2.6, top: 2.2 },
    { z: -3.3, w: 1.04, hu: 0.42, hd: 0.44, y: -0.84, bot: 2.8, top: 2.2 },
    { z: -1.8, w: 1.08, hu: 0.44, hd: 0.44, y: -0.8, bot: 3.0, top: 2.2 },
    { z: 0.2, w: 1.02, hu: 0.4, hd: 0.4, y: -0.72, bot: 3.0, top: 2.2 },
    { z: 2.2, w: 0.86, hu: 0.32, hd: 0.3, y: -0.6, bot: 2.8 }, { z: 3.6, w: 0.6, hu: 0.2, hd: 0.14, y: -0.48 },
  ];
  add(root, loftF(intakeS, 28), M.light);
  // ağız içi (karanlık) ve dudak
  { const g = new THREE.CircleGeometry(1, 24); g.scale(0.44, 0.36, 1); const o = add(root, g, M.inside, 0, -0.86, -3.62); o.rotation.y = Math.PI;
    const lip = new THREE.TorusGeometry(1, 0.06, 6, 28); lip.scale(0.47, 0.39, 0.5); add(root, lip, M.mid, 0, -0.86, -3.74); }
  // karın yüzgeçleri
  for (const s of [-1, 1]) { const v = add(root, plate([[0, 0], [0.6, 0.6], [0.6, 1.5], [0, 1.6]], 0.05), M.mid, s * 0.55, -0.62, 3.9); v.rotation.z = s * (Math.PI / 2 + 0.25); }

  // --- kanopi ve kokpit ---
  { const g = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    // kabarcık kanopi: merkez (0, 0.5, -4.0), yarıçaplar (0.47, 0.72, 2.0); kokpit içi (cockpit.js) aynı elipsoidi kullanır
    const can = add(root, g, M.glass, 0, 0.5, -4.0); can.scale.set(0.47, 0.72, 2.0); parts.hide.push(can); can.renderOrder = 2;
    const fr = new THREE.TorusGeometry(1, 0.035, 6, 24, Math.PI); const f = add(root, fr, M.dark, 0, 0.5, -3.12); f.scale.set(0.42, 0.646, 1); parts.hide.push(f);
    add(root, new THREE.BoxGeometry(0.62, 0.14, 1.2), M.seat, 0, 0.4, -3.9); // kokpit tabanı
    const seat = add(root, new THREE.BoxGeometry(0.46, 0.85, 0.22), M.seat, 0, 0.7, -3.22); seat.rotation.x = 0.5; parts.hide.push(seat);
    const hel = add(root, new THREE.SphereGeometry(0.15, 14, 10), M.helmet, 0, 1.03, -3.5); parts.hide.push(hel);
    const vis = add(root, new THREE.SphereGeometry(0.152, 14, 8, -0.9, 1.8, 1.0, 0.9), M.visor, 0, 1.03, -3.5); vis.rotation.y = Math.PI; parts.hide.push(vis);
    const body = add(root, new THREE.CylinderGeometry(0.18, 0.22, 0.5, 10), M.seat, 0, 0.72, -3.42); body.rotation.x = 0.45; parts.hide.push(body);
    // gösterge paneli ve HUD (dışarıdan görünür; kokpit kamerasında iç mekân çizilir)
    parts.hide.push(add(root, new THREE.BoxGeometry(0.62, 0.28, 0.16), M.black, 0, 0.69, -4.5));
    const hud = add(root, new THREE.PlaneGeometry(0.16, 0.14), new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }), 0, 1.0, -4.27); hud.rotation.x = -0.35; parts.hide.push(hud);
  }
  parts.cowl = add(root, new THREE.BoxGeometry(0.6, 0.06, 1.8), M.mid, 0, 0.55, -5.9); parts.cowl.visible = false;

  // --- kanatlar: hücum kenarı oku 40°, uç rayları ---
  parts.ail = []; parts.flap = []; parts.lef = [];
  for (const s of [-1, 1]) {
    const half = new THREE.Group(); half.position.set(0, -0.16, 0); root.add(half);
    if (s < 0) half.scale.x = -1;
    // plan: kök hücum kenarı z=-2.2 (x=1.0), uç z=+0.95 (x=4.72); uç veteri 1.0, kök firar kenarı z=+2.55
    const wpts = [[0.9, -2.3], [4.72, 0.82], [4.72, 1.86], [3.25, 2.12], [3.25, 1.72], [1.15, 2.0], [1.15, 2.55], [0.9, 2.55]];
    // flaperonun yeri kanatta oyuk: flaperon ayrı parça (x 1.15..3.25, z 2.0..2.55)
    add(half, plate([[0.9, -2.3], [4.72, 0.82], [4.72, 1.86], [3.25, 2.08], [1.15, 2.05], [0.9, 2.05]], 0.17, { bevel: 0.06 }), M.light);
    // üst yüzeyde orta gri desen (kendi boyamız)
    const pat = add(half, plate([[1.3, -1.2], [3.6, 0.6], [3.9, 1.4], [2.2, 1.3]], 0.02, { bevel: 0.005 }), M.mid, 0, 0.085, 0);
    // flaperon (menteşe z=2.05)
    const fp = pivot(half, 0, 0, 2.05);
    add(fp, plate([[1.18, 0.0], [3.22, 0.0], [3.22, 0.5], [1.18, 0.52]], 0.08, { bevel: 0.02 }), M.light, 0, 0, 0);
    parts.flap.push({ p: fp, s });
    // hücum kenarı flapı: menteşe hattı kökten uca (oklu); pivot hattı boyunca döner
    const hx0 = 1.1, hz0 = -2.05, hx1 = 4.6, hz1 = 0.88;
    const lp = new THREE.Group(); lp.position.set(hx0, 0, hz0); lp.rotation.y = -Math.atan2(hz1 - hz0, hx1 - hx0); half.add(lp);
    const L = Math.hypot(hx1 - hx0, hz1 - hz0);
    add(lp, plate([[0, 0], [L, 0], [L, -0.32], [0, -0.42]], 0.11, { bevel: 0.04 }), M.light, 0, 0, 0);
    parts.lef.push({ p: lp, s });
    // uç rayı
    add(half, new THREE.BoxGeometry(0.1, 0.12, 2.9), M.mid, 4.78, 0, 0.6);
    const tipLight = add(half, new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff2a2a : 0x2aff4a }), 4.8, 0.02, 0.1);
    const gl = glowSprite(s < 0 ? 0xff3030 : 0x30ff50, 0.9); gl.position.copy(tipLight.position); half.add(gl);
    if (s < 0) parts.navL = gl; else parts.navR = gl;
  }
  // --- stabilatörler (tamamı döner), 10° aşağı açılı ---
  parts.stab = [];
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(s * 1.05, -0.05, 5.55); pv.rotation.z = s * -10 * D2R; root.add(pv);
    const g = new THREE.Group(); pv.add(g); if (s < 0) g.scale.x = -1;
    add(g, plate([[0, -1.05], [2.15, 0.65], [2.15, 1.4], [0, 1.4]], 0.11, { bevel: 0.04 }), M.light, 0, 0, 0);
    add(g, plate([[0.3, -0.5], [1.7, 0.55], [1.6, 1.1], [0.3, 1.0]], 0.02, { bevel: 0.005 }), M.mid, 0, 0.055, 0);
    parts.stab.push({ p: pv, s });
  }
  // --- dikey kuyruk ve dümen ---
  { const fin = new THREE.Group(); fin.position.set(0, 0.68, 0); root.add(fin);
    // yan görünüş noktaları (z, y): plate() x=yükseklik, veter=z; sonra Z ekseni etrafında 90° döndürülür
    const fg = plate([[0, 2.55], [3.35, 5.0], [3.35, 6.15], [2.95, 6.16], [2.95, 5.6], [0.35, 5.6], [0.35, 6.23], [0, 6.25]], 0.16, { bevel: 0.06 });
    const finM = add(fin, fg, M.mid); finM.rotation.z = Math.PI / 2;
    // kuyruk ucu şeridi ve yazı
    const tip = add(fin, plate([[3.0, 4.72], [3.35, 5.0], [3.35, 6.15], [3.0, 6.12]], 0.18, { bevel: 0.05 }), M.teal); tip.rotation.z = Math.PI / 2;
    const tex = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#e9eef2'; g.font = 'bold 74px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('İU 01', w / 2, h / 2 + 4); });
    for (const sd of [-1, 1]) { const d = add(fin, new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.2, roughness: 0.5, depthWrite: false, side: THREE.DoubleSide, envMap }), sd * 0.095, 1.6, 5.15); d.rotation.y = sd * Math.PI / 2; d.renderOrder = 1; }
    // dümen: menteşe z=5.65, y 0.35..2.9
    parts.rud = pivot(fin, 0, 0, 5.62);
    const rg = plate([[0.35, 0], [2.95, 0], [2.95, 0.55], [0.35, 0.62]], 0.1, { bevel: 0.03 }); const r = add(parts.rud, rg, M.mid); r.rotation.z = Math.PI / 2;
    // kuyruk lambası ve çakar
    const wl = add(fin, new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 3.3, 6.2);
    parts.navT = glowSprite(0xffffff, 0.6); parts.navT.position.copy(wl.position); fin.add(parts.navT);
    parts.strobe = glowSprite(0xffffff, 1.1); parts.strobe.position.set(0, 3.42, 5.3); fin.add(parts.strobe);
    // fren paraşütü yuvası
    add(root, new THREE.CylinderGeometry(0.22, 0.26, 1.0, 12).rotateX(Math.PI / 2), M.mid, 0, 0.62, 6.25);
  }
  // --- lüle (egzoz): yaprakları olan koni ---
  { const prof = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.5 - 0.1 * t * t, t * 1.25)); }
    const ng = new THREE.LatheGeometry(prof, 32); ng.rotateX(Math.PI / 2);
    add(root, ng, M.hot, 0, 0.03, 6.35);
    const inner = new THREE.CylinderGeometry(0.39, 0.42, 1.2, 24, 1, true); inner.rotateX(Math.PI / 2);
    add(root, inner, new THREE.MeshStandardMaterial({ color: 0x2a2522, metalness: 0.8, roughness: 0.6, side: THREE.BackSide, envMap }), 0, 0.03, 6.95);
    // türbin ağzı parıltısı (devirle ısınır)
    const disc = add(root, new THREE.CircleGeometry(0.39, 24), new THREE.MeshBasicMaterial({ color: 0x331a0a }), 0, 0.03, 6.7);
    parts.nozGlow = disc.material;
    // yaprak çizgileri
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const b = add(root, new THREE.BoxGeometry(0.02, 0.03, 1.2), M.metal, Math.cos(a) * 0.46, 0.03 + Math.sin(a) * 0.46, 6.95); b.rotation.z = a; }
  }
  // --- ard yakıcı alevi ---
  { const fl = new THREE.Group(); fl.position.set(0, 0.03, 7.55); root.add(fl);
    const mk = (r, len, col, op) => {
      const g = new THREE.ConeGeometry(r, len, 20, 6, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, len / 2);
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { col: { value: new THREE.Color(col) }, op: { value: op }, t: { value: 0 }, k: { value: 1 } },
        vertexShader: 'varying float vz; varying vec3 vn; varying vec3 vv; void main(){ vz = position.z; vec4 mv = modelViewMatrix * vec4(position,1.0); vn = normalize(normalMatrix*normal); vv = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: `uniform vec3 col; uniform float op, t, k; varying float vz; varying vec3 vn; varying vec3 vv;
          void main(){ float L = ${len.toFixed(2)}; float u = clamp(vz / L, 0.0, 1.0);
            float edge = pow(abs(dot(vn, vv)), 1.5);
            float dia = 0.75 + 0.25 * sin(u * 34.0 - t * 30.0);
            float a = op * k * (1.0 - u) * (1.0 - u) * edge * dia;
            gl_FragColor = vec4(col * (1.2 - 0.5 * u), a); }` });
      const o = new THREE.Mesh(g, m); fl.add(o); return o;
    };
    parts.flames = [mk(0.42, 5.0, 0xff7a2a, 1.6), mk(0.32, 3.6, 0xffb070, 1.6), mk(0.2, 2.2, 0x9fc4ff, 1.8)];
    const glow = glowSprite(0xffa060, 5); glow.position.set(0, 0, 0.3); fl.add(glow); parts.abGlow = glow;
    parts.flame = fl; fl.visible = false;
  }
  // --- iniş takımı: burun (z=-3.9), ana (z=+0.45, x=±1.18); yer y=-1.78 ---
  parts.wheels = []; parts.gearLegs = [];
  { // burun: menteşe hava alığı altında, geriye katlanır
    const nh = pivot(root, 0, -1.02, -3.35);
    const strut = add(nh, new THREE.CylinderGeometry(0.06, 0.07, 0.62, 10), M.gear, 0, -0.2, -0.32); strut.rotation.x = -0.85;
    const w = wheelStd(0.28, 0.16, M); w.position.set(0, -0.48, -0.55); nh.add(w); parts.wheels.push(w);
    const fork = add(nh, new THREE.BoxGeometry(0.05, 0.34, 0.12), M.gear, 0.11, -0.36, -0.55); const fork2 = fork.clone(); fork2.position.x = -0.11; nh.add(fork2);
    nh.userData.ax = 'x'; nh.userData.up = -2.4; parts.gearLegs.push(nh);
    add(nh, new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffee }), 0, -0.1, -0.5);
  }
  for (const s of [-1, 1]) { // ana: menteşe gövde yanında, öne ve içe katlanır
    const mh = pivot(root, s * 0.72, -0.62, 0.45);
    const strut = add(mh, new THREE.CylinderGeometry(0.07, 0.08, 0.92, 10), M.gear, s * 0.23, -0.39, 0); strut.rotation.z = s * 0.53;
    const w = wheelStd(0.38, 0.22, M); w.position.set(s * 0.46, -0.78, 0); mh.add(w); parts.wheels.push(w);
    // kapak
    add(mh, new THREE.BoxGeometry(0.03, 0.7, 0.9), M.light, s * 0.08, -0.32, 0);
    mh.userData.ax = 'z'; mh.userData.up = s * 2.6; parts.gearLegs.push(mh);
  }
  // yüksek hücum açısında LEX ve kanat kökü üstünde buhar
  parts.vapor = [];
  for (const s of [-1, 1]) { const v = vaporSheet(); v.position.set(s * 1.55, 0.2, -1.2); v.scale.set(2.1, 1, 3.6); v.rotation.y = s * 0.28; root.add(v); parts.vapor.push(v); }
  parts.update = (ac, dt) => animateF16(parts, ac, dt);
  parts.t = 0;
  // gölgede kalan iç yüzler için hepsi çift yüzlü değil; levhalar kapalı katı
  return parts;
}
function wheelStd(r, w, M) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, r * 0.24, 10, 20), M.tire); t.rotation.y = Math.PI / 2; g.add(t);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 0.8, 16), M.gear); hub.rotation.z = Math.PI / 2; g.add(hub);
  return g;
}

function animateF16(p, ac, dt) {
  const s = ac.surf, D = D2R;
  p.t += dt;
  // stabilatörler: yunuslama + yatışta farklı hareket (sol/sağ)
  for (const st of p.stab) st.p.rotation.x = s.de - st.s * s.da * 0.35;
  // flaperonlar: flap + kanatçık
  const fl = s.flap * 20 * D;
  for (const f of p.flap) f.p.rotation.x = fl - f.s * s.da * 0.9;
  // hücum kenarı flapları: hücum açısıyla otomatik
  const lef = THREE.MathUtils.clamp((ac.out.alpha || 0) * 1.0, 0, 25 * D) + (ac.gearPos > 0.5 && !ac.onGround ? 15 * D : 0);
  for (const l of p.lef) l.p.children[0].rotation.x = -Math.min(lef, 25 * D); // menteşe hattı boyunca aşağı
  p.rud.rotation.y = -s.dr;
  // iniş takımı
  const g = ac.gearPos;
  for (const leg of p.gearLegs) {
    const a = (1 - g) * leg.userData.up;
    if (leg.userData.ax === 'x') leg.rotation.x = a; else leg.rotation.z = a;
    leg.visible = g > 0.02;
  }
  for (let i = 0; i < p.wheels.length; i++) {
    const w = p.wheels[i]; if (w.userData.y0 == null) w.userData.y0 = w.position.y;
    w.position.y = w.userData.y0 + (ac.wheel[i] ? Math.min(0.25, ac.wheel[i].comp) : 0);
    if (ac.wheel[i] && ac.wheel[i].contact) w.rotation.x -= Math.hypot(ac.vel[0], ac.vel[1]) * dt / 0.33;
  }
  // motor parıltısı ve ard yakıcı
  const n = ac.spool || 0, ab = ac.ab || 0;
  p.nozGlow.color.setRGB(0.2 + 0.8 * n * n, 0.1 + 0.35 * n * n + 0.4 * ab, 0.05 + 0.2 * ab);
  p.flame.visible = ab > 0.03;
  if (p.flame.visible) {
    const fk = 0.85 + 0.15 * Math.sin(p.t * 47) * Math.sin(p.t * 23 + 1);
    p.flames.forEach((f, i) => { f.material.uniforms.t.value = p.t; f.material.uniforms.k.value = ab * fk; });
    p.flame.scale.set(1, 1, 0.7 + 0.3 * ab + 0.08 * Math.sin(p.t * 31));
    p.abGlow.material.opacity = ab * (0.45 + 0.15 * fk); p.abGlow.scale.setScalar(2.2 + 1.2 * ab);
  }
  // kanat üstü buhar: hücum açısı 12°'yi geçince, dinamik basınçla
  const kv = THREE.MathUtils.clamp(((ac.out.alpha || 0) - 0.2) / 0.22, 0, 1) * THREE.MathUtils.clamp(((ac.out.qbar || 0) - 6000) / 12000, 0, 1) * (ac.onGround ? 0 : 1);
  for (const v of p.vapor) { v.visible = kv > 0.01; v.material.uniforms.t.value = p.t; v.material.uniforms.k.value = kv; }
  // seyrüsefer lambaları ve çakar (saniyede bir)
  const st = (p.t % 1.4) < 0.06;
  p.strobe.visible = st;
  const inCock = p.inCockpit;
  p.navL.visible = p.navR.visible = p.navT.visible = !inCock;
}
