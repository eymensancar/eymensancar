// Diyarbakır Havalimanı (LTCC, DIY; sivil-askerî ortak): yeni terminal (2016; OSM tabanı: kara tarafında salon, apron
// boyunca iskele, 6 sabit köprü kolu + hareketli köprü), On Gözlü Köprü'nün kemerlerini anımsatan art arda tonozlu çatı,
// cephede Diyarbakır bazaltı renginde koyu taş payeler, ikinci küçük terminal (her biri ayrı parça), bazalt kaplı kule
// (~40 m), askerî kesimde sertleştirilmiş uçak sığınakları (beton tonoz, kalın kapılar) ve önlerinde gri savaş uçakları,
// iki bakım hangarı, park etmiş yolcu uçakları, apron araçları ve projektör direkleri.
import * as THREE from '../../vendor/three.module.min.js';
import { stands, standsAndAircraft, centroid } from '../havalimani.js';
import { terminal as glassBox, vehicles } from './ortak.js';
import { Kit, addKit, ccw, area, hall, roofUnits, finishTerminal, pushSolid, bridges, floodMasts, edgeMasts, frameFrom, obbFrame, hideGenericHangars, hangarsFromData, nearestPave, towerStone, strut, vcMat } from './ltdb.js';

const BAZALT = 0x45443f, BAZALT2 = 0x5b5953;

export function build(ctx) {
  const { d } = ctx;
  hideGenericHangars(ctx);
  const S = stands(d);
  ctx.stands = S;
  standsAndAircraft(ctx, { occ: 0.6 });
  // --- ana terminal: salon (4 köşe) + iskele (apron yüzü)
  const T = d.bina.find((b) => b.t === 'terminal' && /Terminal/.test(b.n || ''));
  let fr = null;
  if (T) {
    // iskelenin apron yüzü: tabanın en uzun kenarı
    let bi = 0, bl = 0;
    for (let i = 0; i < T.p.length; i++) { const q = T.p[(i + 1) % T.p.length], L = Math.hypot(q[0] - T.p[i][0], q[1] - T.p[i][1]); if (L > bl) { bl = L; bi = i; } }
    const D = T.p[bi], E = T.p[(bi + 1) % T.p.length];
    fr = frameFrom(D, E);
    const L = T.p.map(([x, y]) => fr.to(x, y));
    // apron yüzünün hangi yanı bina? (köşelerin çoğu o yanda)
    const sg = L.reduce((s, p) => s + p[1], 0) > 0 ? 1 : -1;
    const deep = L.map((p) => [Math.abs(p[1])]);
    // iskele eni: yüze en yakın iç köşelerin uzaklığı (12-40 m)
    const inner = deep.filter(([c]) => c > 12 && c < 40).map(([c]) => c);
    const pw = inner.length ? Math.max(...inner) : 26;
    // salon: derindeki köşeler + onların a aralığındaki iskele tarafı köşeleri (iskele uçları dışarıda kalır)
    const dA = L.filter((p) => Math.abs(p[1]) > pw + 1).map((p) => p[0]);
    const lo = Math.min(...dA) - 3, hi = Math.max(...dA) + 3;
    const mp = T.p.filter((p, i) => Math.abs(L[i][1]) > 12 && L[i][0] > lo && L[i][0] < hi);
    const [mx, my] = centroid(mp);
    const main = ccw(mp.sort((p, q) => Math.atan2(p[1] - my, p[0] - mx) - Math.atan2(q[1] - my, q[0] - mx)));
    const aMin = Math.min(...L.map((p) => p[0])), aMax = Math.max(...L.map((p) => p[0]));
    const pier = ccw([fr.from(aMin, 0), fr.from(aMax, 0), fr.from(aMax, sg * pw), fr.from(aMin, sg * pw)]);
    const k = new Kit();
    const N = 7;                                                        // tonoz sayısı (uzun eksen boyunca)
    hall(k, main, {
      h: 16, fl: 5.0, ov: 4, ovLand: 16, land: fr.dir(0, sg), t: 1.1,
      shape: (ta) => { const f = (ta * N) % 1; return 1.0 + 4.2 * Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2)); },
      roofTop: 0xd9dadb, soffit: 0xe9e4da, fascia: BAZALT2, fin: BAZALT, band: BAZALT2,
      columns: 'duz', colCol: BAZALT, nA: N * 8, nB: 8,
    });
    hall(k, pier, { h: 11.5, fl: 4.6, ov: 3, t: 0.9, shape: (ta, tb) => 1.3 * (1 - (2 * tb - 1) ** 2), roofTop: 0xdcdddd, soffit: 0xe9e4da, fascia: BAZALT2, fin: 0xd6d6d2, band: BAZALT2, nA: 28, nB: 4 });
    roofUnits(k, pier, 12.4, 6);
    finishTerminal(ctx, k, 'diy-ana', T.n, main, 16 + 6, 5.0);
    pushSolid(ctx, pier, 12.4, T.n + ' iskelesi');
  }
  for (const b of d.bina) if (b.t === 'terminal' && b !== T) glassBox(ctx, 'diy-t2', b.n || 'Terminal 2', ccw(b.p), { h: 8, overhang: 2.5, roof: 'duz' });
  // --- köprüler ve projektörler
  const bk = new Kit();
  bridges(ctx, bk, S, { z: 4.6 });
  if (fr && T) {
    const L = T.p.map(([x, y]) => fr.to(x, y)), sg = L.reduce((s, p) => s + p[1], 0) > 0 ? 1 : -1;
    floodMasts(bk, edgeMasts(d, fr, -sg, 110, 8, centroid(T.p)), 25);
  }
  addKit(ctx.grp, bk, ctx.M, 'kopruler');
  // --- kule: bazalt kaplı (OSM, 40 m)
  const tw = d.bina.find((b) => b.t === 'tower');
  if (tw) { const [x, y] = centroid(tw.p); towerStone(ctx, x, y, Math.max(40, tw.h || 40), { rot: 0.45, stone: BAZALT2, trim: 0x8a877e, baseCol: 0xd9d4c8, dark: 0x3d3f42 }); }
  // --- askerî kesim: sığınaklar (250-900 m²) ve hangarlar; sığınakların bir kısmının önünde savaş uçağı
  const hk = new Kit();
  const isHAS = (b, ar) => ar > 250 && ar < 900;
  hangarsFromData(ctx, hk, { shelter: isHAS, h: (ar) => Math.max(11, Math.min(18, Math.sqrt(ar) * 0.3)) });
  addKit(ctx.grp, hk, ctx.M, 'hangarlar');
  fighters(ctx, isHAS);
  vehicles(ctx, S);
}

// ---------- gri savaş uçakları (örneklenmiş; markasız): sığınak ağzının önündeki platformda, burun dışarı ----------
let FGEO = null;
function fighterGeom() {
  if (FGEO) return FGEO;
  const k = new Kit();
  // yerel: burun +x, 1 birim = 1 m; boy ~15 m, açıklık ~10 m
  k.c(0x8e959c, (g) => {
    strut(g, [-7.2, 0, 2.0], [3.6, 0, 2.0], 0.78, 8, 0.82);           // gövde
    strut(g, [3.6, 0, 2.0], [7.6, 0, 1.95], 0.82, 8, 0.06);           // burun
    strut(g, [-7.6, 0, 2.0], [-7.2, 0, 2.0], 0.55, 8, 0.78);          // lüle
    g.prism([[1.6, 0.6], [-5.2, 5.0], [-6.4, 5.0], [-6.4, -5.0], [-5.2, -5.0], [1.6, -0.6]], 1.75, 1.95);   // kanat
    g.prism([[-5.0, 0.5], [-7.6, 2.8], [-8.2, 2.8], [-8.2, -2.8], [-7.6, -2.8], [-5.0, -0.5]], 1.95, 2.05);  // yatay kuyruk
    g.box(-6.4, 0, 2.6, 3.4, 0.16, 3.0, 0);                           // dikey kuyruk
    g.box(1.0, 0, 1.1, 2.6, 1.4, 0.8, 0);                              // hava alığı
  });
  k.c(0x2e3338, (g) => { strut(g, [3.4, 0, 2.55], [5.4, 0, 2.35], 0.42, 8, 0.2); });            // kanopi
  k.c(0x3a3d40, (g) => { for (const [x, y] of [[4.8, 0], [-1.2, 1.2], [-1.2, -1.2]]) g.box(x, y, 0, 0.3, 0.3, 1.4, 0); });
  // GB.vert yerel y'yi -z'ye çevirir; örnek dönüşümü (Y ekseni etrafında) ile uyumlu
  FGEO = k.s.geometry();
  return FGEO;
}
function fighters(ctx, isHAS) {
  const pts = [], seen = new Set();
  for (const b of ctx.d.bina) {
    if (b.t !== 'hangar' || b.p.length < 3) continue;
    const key = Math.round(b.p[0][0]) + ':' + Math.round(b.p[0][1]); if (seen.has(key)) continue; seen.add(key);
    const P = ccw(b.p), ar = area(P); if (!isHAS(b, ar) || ar < 450) continue;
    const h = Math.abs(Math.sin(b.p[0][0] * 12.9898 + b.p[0][1] * 78.233) * 43758.5453) % 1; if (h > 0.45) continue;
    const F = obbFrame(P), [cx, cy] = centroid(P), np = nearestPave(ctx.d, cx, cy);
    let ux = F.ux, uy = F.uy; if (np && ux * (np[0] - cx) + uy * (np[1] - cy) < 0) { ux = -ux; uy = -uy; }
    pts.push([F.o.cx + ux * (F.A + 9), F.o.cy + uy * (F.A + 9), Math.atan2(uy, ux)]);
  }
  if (!pts.length) return;
  const im = new THREE.InstancedMesh(fighterGeom(), vcMat(), pts.length);
  const o = new THREE.Object3D();
  pts.forEach(([x, y, a], i) => { o.position.set(x, 0.12, -y); o.rotation.set(0, a, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.name = 'savas-ucaklari';
  ctx.grp.add(im);
}
