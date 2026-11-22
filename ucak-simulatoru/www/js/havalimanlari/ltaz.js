// Nevşehir Kapadokya Havalimanı (LTAZ, NAV): yalnız sivil. Gelen ve giden yolcu terminalleri ayrı binalar (OSM
// tabanları; Kapadokya tüf taşı rengi kolonlar ve parapet), kara tarafında kanopi ve otopark, klasik kule (OSM konumu),
// apron tarafına bakan kırmızı kapılı itfaiye binası, park yerlerinde yolcu uçakları ve apron araçları, ışık direkleri.
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate } from '../havalimani.js';
import { towerClassic } from './ortak.js';
import { uniq, dropGeneric, civil, landside, smallBuildings, floodMasts } from './ltau.js';

let STONE = null;
// tüf taşı kolonlar (çevre boyunca 5 m arayla) ve üst parapet bandı; terminal grubuna 'tas' çocuğu
function tuffFacade(ctx, g) {
  const { taban: P, yukseklik: h, kotu: base } = g.userData;
  STONE = STONE || new THREE.MeshLambertMaterial({ color: 0xd9c39d });
  const gb = new GB();
  for (let k = 0; k < P.length; k++) {
    const [ax, ay] = P[k], [bx, by] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, by - ay); if (L < 3) continue;
    const ang = Math.atan2(by - ay, bx - ax), nx = (by - ay) / L, ny = -(bx - ax) / L;
    const n = Math.max(1, Math.round(L / 5));
    for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t + nx * 0.35, y = ay + (by - ay) * t + ny * 0.35; gb.box(x, y, base, 1.1, 0.8, h - base, ang); }
  }
  gb.prism(inflate(P, 0.6), h - 2.4, h, false);
  const m = new THREE.Mesh(gb.geometry(), STONE); m.name = 'tas'; m.matrixAutoUpdate = false; g.add(m);
}

export function build(ctx) {
  const { d } = ctx;
  dropGeneric(ctx);
  const B = uniq(d.bina);
  const T = B.filter((b) => b.t === 'terminal').sort((a, b) => /Giden/.test(b.n || '') - /Giden/.test(a.n || ''));
  const terms = T.map((b, i) => ({ id: (b.id || 'T' + (i + 1)).toString(), ad: b.n || 'Terminal', P: b.p, h: 11, roof: 'duz', overhang: 4 }));
  const groups = civil(ctx, { terminals: terms, civilArea: () => true, occ: 0.45, bridges: false });
  const apC = centroid(d.apron.flatMap((pl) => pl[0]));
  groups.forEach((g, i) => { tuffFacade(ctx, g); landside(ctx, g, g.userData.taban, apC, { canopyH: 5.5, canopyDepth: 9, park: i === 0, parkLen: 150, parkDepth: 56, parkShift: -40, fill: 0.5 }); });
  const tw = B.find((b) => b.t === 'tower');
  const [tx, ty] = tw ? centroid(tw.p) : [-866, 16];
  towerClassic(ctx, tx, ty, 28);
  smallBuildings(ctx, B.filter((b) => b.t === 'hangar').map((b) => ({ P: b.p, h: 8, ad: 'İtfaiye binası', itfaiye: true })));
  floodMasts(ctx, d.apron.map((pl) => pl[0]), 120);
}
