// Konya Havalimanı (LTAN, KYA): askeri-sivil ortak meydan (3. Ana Jet Üssü). Doğuda sivil taraf: yolcu terminali ve eski
// terminal (OSM tabanları), kanopi, otopark, sivil park yerlerinde yolcu uçakları. Batıda ve güneyde askeri taraf:
// betonarme uçak sığınakları (OSM'deki ~580 m²'lik tabanlar; bazılarının kapısı açık, içinden savaş uçağı burnu görünür),
// bakım hangarları, erken uyarı uçağı apronu (737 gövdesi + sırt radarı), savaş uçağı hatları, askeri kule.
// Ortak askeri parçalar ltau.js'te.
import { centroid } from '../havalimani.js';
import { towerClassic } from './ortak.js';
import { alan, uniq, dropGeneric, civil, landside, hangars, shelters, militaryAircraft, flightLine, floodMasts, twyDist } from './ltau.js';

export function build(ctx) {
  const { d } = ctx;
  dropGeneric(ctx);
  const B = uniq(d.bina);
  const T = B.filter((b) => b.t === 'terminal');
  const civArea = (x, y) => x > 900;
  const yeni = T.find((b) => /Terminali$/.test(b.n || '') && !/Eski/.test(b.n)) || T[0];
  const eski = T.find((b) => /Eski/.test(b.n || ''));
  const terms = [{ id: (yeni.id || 'T1').toString(), ad: 'Konya Havalimanı Dış ve İç Hatlar Terminali', P: yeni.p, h: 15, roof: 'isiklik', overhang: 7, skyStep: 24 }];
  if (eski) terms.push({ id: (eski.id || 'T2').toString(), ad: 'Konya Havalimanı Eski Terminal', P: eski.p, h: 9, roof: 'duz', overhang: 3 });
  const groups = civil(ctx, { terminals: terms, civilArea: civArea, occ: 0.5, bridges: false });
  const civApr = d.apron.filter((pl) => civArea(...centroid(pl[0])));
  const apC = centroid(civApr.flatMap((pl) => pl[0]));
  landside(ctx, groups[0], yeni.p, apC, { canopyH: 7.5, canopyDepth: 12, parkLen: 180, parkDepth: 62 });
  if (groups[1]) landside(ctx, groups[1], groups[1].userData.taban, apC, { canopyH: 5, canopyDepth: 7, park: false });
  // askeri kule (OSM konumu)
  const tw = B.find((b) => b.t === 'tower');
  const [tx, ty] = tw ? centroid(tw.p) : [-444, -86];
  towerClassic(ctx, tx, ty, 36);
  // hangarlar ve uçak sığınakları
  const H = B.filter((b) => b.t === 'hangar');
  const isHAS = (b) => { const a = alan(b.p); return a > 450 && a < 800 && b.p.length === 4; };
  hangars(ctx, H.filter((b) => !isHAS(b)).map((b) => ({ P: b.p, ad: 'Hangar' })));
  const jets = shelters(ctx, H.filter(isHAS).map((b) => ({ P: b.p })), { open: 0.42, fighter: 0.85 });
  // apronlar: erken uyarı uçakları (park noktaları 1-6), savaş uçağı hatları
  const rc = d.rws.reduce((s, r) => [s[0] + (r.a[0] + r.b[0]) / 4, s[1] + (r.a[1] + r.b[1]) / 4], [0, 0]);
  const aewPts = d.ppt.filter((p) => /^[1-6]$/.test(p.r || '') && !civArea(p.p[0], p.p[1]));
  if (aewPts.length) {
    const [mx, my] = centroid(aewPts.map((p) => p.p));
    for (const p of aewPts) {
      if (p.r === '4') continue;   // biri görevde
      const [x, y] = p.p; let hx = 0, hy = y > my ? 1 : -1;
      // sıra doğrultusuna dik
      const row = aewPts.filter((q) => (q.p[1] > my) === (y > my));
      if (row.length > 1) { const a = row[0].p, b = row[row.length - 1].p, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; hx = -(b[1] - a[1]) / L; hy = (b[0] - a[0]) / L; if ((hx * (x - mx) + hy * (y - my)) < 0) { hx = -hx; hy = -hy; } }
      jets.push({ tip: 'aew', x: x - hx * 20, y: y - hy * 20, hx, hy });
    }
  }
  const ORP = d.ppt.filter((p) => !p.r && !civArea(p.p[0], p.p[1]));
  if (ORP.length > 2) {
    const a = ORP[0].p, b = ORP[ORP.length - 2].p, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let hx = -(b[1] - a[1]) / L, hy = (b[0] - a[0]) / L;
    const [mx, my] = centroid(ORP.map((p) => p.p)); if (hx * (rc[0] - mx) + hy * (rc[1] - my) < 0) { hx = -hx; hy = -hy; }
    ORP.forEach((p, i) => { if (i % 3 !== 2) jets.push({ tip: 'savas', x: p.p[0] - hx * 7, y: p.p[1] - hy * 7, hx, hy }); });
  }
  for (const pl of d.apron) {
    const P = pl[0], [cx, cy] = centroid(P), A = alan(P);
    if (civArea(cx, cy)) continue;
    if (aewPts.some((p) => Math.hypot(p.p[0] - cx, p.p[1] - cy) < 160)) continue;
    if (ORP.some((p) => Math.hypot(p.p[0] - cx, p.p[1] - cy) < 140)) continue;
    if (A < 9000) continue;
    const row = flightLine(P, { tip: 'savas', gap: 24, inset: 'auto', toward: rc, n: A > 40000 ? 14 : 4, len: 15, avoid: (x, y) => twyDist(d, x, y) < 12 });
    for (const p of row) if (((p.x * 0.37 + p.y * 0.61) % 1 + 1) % 1 < 0.8) jets.push(p);
  }
  militaryAircraft(ctx, jets);
  floodMasts(ctx, d.apron.map((pl) => pl[0]).filter((P) => alan(P) > 12000), 150);
}
