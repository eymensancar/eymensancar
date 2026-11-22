// Gaziantep Oğuzeli Havalimanı (LTAJ, GZT): yeni dış/iç hatlar terminali (Terminal-1, 2021; OSM tabanı: kara tarafında
// salon, apron boyunca iskele, 6 sabit köprü kolu + hareketli köprü), üç dalgalı beyaz çatı ve bakır tonlu alın/çatı altı
// (Gaziantep bakırcılığına gönderme), kalkış viyadüğü ve kanopi; eski terminal (Terminal-2: havara taşı rengi duvarlar,
// bant pencereler, düz çatı), VIP ve kargo terminalleri (her biri ayrı parça), taş kaplı kule (~40 m), bakım hangarları,
// park etmiş uçaklar (köprülü 101-106 dahil), apron araçları ve projektör direkleri.
import { stands, standsAndAircraft, centroid, inflate } from '../havalimani.js';
import { terminal as glassBox, vehicles } from './ortak.js';
import { Kit, addKit, ccw, hall, roofUnits, finishTerminal, pushSolid, cargo, bridges, floodMasts, edgeMasts, frameFrom, hideGenericHangars, hangarsFromData, towerStone } from './ltdb.js';

export function build(ctx) {
  const { d } = ctx;
  hideGenericHangars(ctx);
  // --- park yerleri: köprülü 101-106 OSM'de yalnız durma noktası; burun terminale (güneye) dönük tam park yerine çevrilir
  const T1 = d.bina.find((b) => b.t === 'terminal' && /Terminal\s*-\s*1/.test(b.n || ''));
  const S = stands(d);
  let face = null;
  if (T1) {
    // kuzey yüzü (apron tarafı) = tabanın en uzun kenarı
    let bi = 0, bl = 0;
    for (let i = 0; i < T1.p.length; i++) { const q = T1.p[(i + 1) % T1.p.length], L = Math.hypot(q[0] - T1.p[i][0], q[1] - T1.p[i][1]); if (L > bl) { bl = L; bi = i; } }
    const D = T1.p[bi], E = T1.p[(bi + 1) % T1.p.length];
    face = D[0] < E[0] ? [D, E] : [E, D];                              // batıdan doğuya
  }
  if (face) {
    const fr = frameFrom(face[0], face[1]);                            // c > 0: kuzey (apron)
    for (const s of S) if (s.pt && /^10[1-6]$/.test(s.ref || '')) { s.pt = false; s.ux = -fr.vx; s.uy = -fr.vy; s.gate = true; }
  }
  ctx.stands = S;
  standsAndAircraft(ctx, { occ: 0.55 });
  // --- Terminal-1: salon + iskele
  if (T1 && face) {
    const fr = frameFrom(face[0], face[1]);
    const L = T1.p.map(([x, y]) => fr.to(x, y));
    // iskele: yüz çizgisinden en uzak (en güney) olmayan, doğuda kalan dar şerit; salon: batıdaki geniş blok
    // salonun doğu kenarı: iskelenin güney yüzüne değen köşe (yüzden 15-40 m içerde, en batıdaki)
    const inner = L.map((p, i) => [p, i]).filter(([p]) => p[1] < -12 && p[1] > -45).sort((a, b) => a[0][0] - b[0][0]);
    const split = inner.length ? inner[0][0][0] : null;
    if (split !== null) {
      const cMin = Math.min(...L.map((p) => p[1]));
      const aMin = Math.min(...L.map((p) => p[0])), aMax = Math.max(...L.map((p) => p[0]));
      const pw = -inner[0][0][1];
      // salon: yüzün batı ucundan split'e, tabanın güney köşelerine kadar (OSM köşeleri)
      const mp = T1.p.filter((p, i) => L[i][0] <= split + 0.5).concat([fr.from(split, 0)]);
      const [mx, my] = centroid(mp);
      const main = ccw(mp.sort((p, q) => Math.atan2(p[1] - my, p[0] - mx) - Math.atan2(q[1] - my, q[0] - mx)));
      const pier = ccw([fr.from(split, -pw), fr.from(aMax - 0.5, -pw), fr.from(aMax, 0), fr.from(split, 0)]);
      void cMin; void aMin;
      const k = new Kit();
      hall(k, main, {
        h: 17, fl: 5.0, ov: 5, ovLand: 20, land: [-fr.vx, -fr.vy], t: 1.3,
        shape: (ta, tb, tl) => 2.2 + 1.1 * Math.sin(ta * Math.PI * 2 * 1.5 - Math.PI / 2) + 3.0 * tl,
        roofTop: 0xeeeeea, soffit: 0xb5794d, fascia: 0xa8673c, fin: 0xd9d4c8, band: 0xcfc8b8,
        columns: 'v', colCol: 0xe9e6de, viaduct: { z: 6.4, w: 14, ramp: 70 }, nA: 30, nB: 10,
      });
      hall(k, pier, { h: 11, fl: 4.6, ov: 3, t: 0.9, shape: (ta, tb) => 1.2 * (1 - (2 * tb - 1) ** 2), roofTop: 0xebebe7, soffit: 0xb5794d, fascia: 0xa8673c, fin: 0xd9d4c8, band: 0xcfc8b8, nA: 20, nB: 4 });
      roofUnits(k, pier, 12, 5);
      finishTerminal(ctx, k, 'gzt-t1', T1.n || 'Terminal-1', main, 17 + 6, 5.0);
      pushSolid(ctx, pier, 12.2, (T1.n || 'Terminal-1') + ' iskelesi');
    } else glassBox(ctx, 'gzt-t1', T1.n, ccw(T1.p), { h: 18, overhang: 6, roof: 'dalga' });
  }
  // --- eski terminal (Terminal-2), VIP, kargo
  for (const b of d.bina) {
    if (b.t !== 'terminal' || b === T1) continue;
    if (/Kargo/i.test(b.n || '')) cargo(ctx, 'gzt-kargo', b.n, b.p, { h: 10 });
    else if (/VIP/.test(b.n || '')) glassBox(ctx, 'gzt-vip', b.n, ccw(b.p), { h: 8, overhang: 2.5, roof: 'duz' });
    else oldTerminal(ctx, 'gzt-t2', b.n || 'Terminal-2', ccw(b.p));
  }
  // --- köprüler, projektörler
  const bk = new Kit();
  bridges(ctx, bk, S, { z: 4.8 });
  if (face) floodMasts(bk, edgeMasts(d, frameFrom(face[0], face[1]), 1, 115, 8, [0, -250]), 25);
  addKit(ctx.grp, bk, ctx.M, 'kopruler');
  // --- kule: taş kaplı (OSM, 40 m)
  const tw = d.bina.find((b) => b.t === 'tower');
  if (tw) { const [x, y] = centroid(tw.p); towerStone(ctx, x, y, Math.max(40, tw.h || 40), { rot: -0.17 + Math.PI / 2, stone: 0xdccaa0, trim: 0xc2ad80, baseCol: 0xe3d6b8 }); }
  // --- hangarlar
  const hk = new Kit();
  hangarsFromData(ctx, hk);
  addKit(ctx.grp, hk, ctx.M, 'hangarlar');
  vehicles(ctx, S);
}

// eski terminal: havara taşı renginde duvarlar, iki bant pencere, düz çatı ve korkuluk, kara tarafında giriş saçağı
function oldTerminal(ctx, id, ad, P) {
  const k = new Kit(), h = 11;
  k.c(0xe3d5b5, (g) => g.prism(P, -0.6, h, false));
  for (const [z0, z1] of [[1.0, 3.8], [5.6, 8.6]]) k.g.prism(inflate(P, 0.06), z0, z1, false);
  k.c(0xcdbb93, (g) => g.prism(inflate(P, 0.25), -0.6, 0.6, false));
  k.c(0xf0ebe0, (g) => { g.prism(inflate(P, 0.35), h - 0.2, h + 1.2, true); });
  k.c(0xd4c39d, (g) => g.prism(inflate(P, 0.4), 4.4, 5.0, false));
  roofUnits(k, P, h + 1.2, 6);
  // giriş saçağı: güney (kara) yüzünde
  const [cx, cy] = centroid(P);
  let ymin = 1e9; for (const [, y] of P) ymin = Math.min(ymin, y);
  k.c(0xf4f2ec, (g) => g.box(cx, ymin - 6, 5.2, 60, 12, 0.9, -0.17));
  k.c(0xb9bcc0, (g) => { for (let s = -27; s <= 27; s += 13.5) g.box(cx + Math.cos(-0.17) * s, ymin - 10 + Math.sin(-0.17) * s, -0.5, 0.6, 0.6, 5.8, 0); });
  return finishTerminal(ctx, k, id, ad, P, h + 1.2, 4.6);
}
