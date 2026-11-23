// Samsun Çarşamba Havalimanı (LTFH, SZF): Yeşilırmak deltasında, kıyıya yakın düz ovada 13/31 pisti (3000 x 45 m).
// Tek iç-dış hatlar terminali (OSM tabanı, ayrı parça; ışıklıklı çatı, kara tarafında saçak), klasik kule (~30 m),
// bakım hangarı (OSM), itfaiye, otopark, park etmiş uçaklar.
import { standard, towerClassic, towerPos } from './ortak.js';
import { ccwTerminals, termExtras, VC, hangar, fireStation, carPark, rectP, dropGenericHangars, radar } from './ltcg.js';

export function build(ctx) {
  const { d } = ctx;
  ccwTerminals(d);
  const R = standard(ctx, { occ: 0.6, terminal: (b, area) => (area > 5000 ? { h: 16, roof: 'isiklik', overhang: 6, skyStep: 20 } : { h: 11 }) });
  // kara tarafı güneybatıda (apron ve pist kuzeydoğuda)
  for (const [id, g] of ctx.parts) if (id.startsWith('terminal:')) termExtras(ctx, g, { land: [-0.63, -0.77], canopy: 14 });
  const t = towerPos(d, { x: -623, y: 79, h: 30 });
  towerClassic(ctx, t.x, t.y, Math.max(32, t.h || 0));
  // OSM hangarı (apronun batısı): ayrıntılı, kapısı doğuya (aprona)
  dropGenericHangars(ctx);
  const vc = new VC();
  const seen = new Set();
  for (const b of d.bina) {
    if (b.t !== 'hangar') continue;
    const k = Math.round(b.p[0][0]) + ':' + Math.round(b.p[0][1]); if (seen.has(k)) continue; seen.add(k);
    hangar(ctx, vc, b.p, { H: 16, door: [0.95, 0.3], ad: 'Hangar', roof: 'kemer' });
  }
  // itfaiye: kulenin güneyinde, kapıları pistin yönünde (kuzeydoğu)
  fireStation(ctx, vc, -520, -20, -0.68);
  // terminal önü otopark (kara tarafı)
  carPark(ctx, vc, rectP(-842, 70, 130, 40, -0.68), -0.68, 21);
  vc.mesh(ctx, 'hangar-kuzey');
  radar(ctx, -420, -120, 20);
  return R;
}
