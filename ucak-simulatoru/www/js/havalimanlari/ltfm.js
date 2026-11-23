// İstanbul Havalimanı (LTFM, IST): ana terminal (OSM tabanı; dalgalı çatı ışıklıkları), lale biçimli kule (~90 m),
// hangarlar, park etmiş uçaklar, yolcu köprüleri, apron araçları. Terminal: ctx.parts.get('terminal:<OSM kimliği>').
import { standard, towerTulip, towerModern, towerPos } from './ortak.js';

export function build(ctx) {
  standard(ctx, {
    occ: 0.7,
    terminal: (b, area) => (area > 100000 ? { h: 26, roof: 'dalga', overhang: 7, skyStep: 30 } : { h: 14, roof: 'duz' }),
  });
  // ana kule (OSM: "Hava trafik kontrol kulesi", 90 m) ve apron kulesi
  const t = towerPos(ctx.d, { x: -1422, y: 1324, h: 90 });
  towerTulip(ctx, t.x, t.y, 90);
  for (const b of ctx.d.bina) if (b.t === 'tower' && b.h < 80) { const x = b.p.reduce((s, p) => s + p[0], 0) / b.p.length, y = b.p.reduce((s, p) => s + p[1], 0) / b.p.length; towerModern(ctx, x, y, 42, 0.3, 'kule:apron'); break; }
}
