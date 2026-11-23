// Ankara Esenboğa Havalimanı (LTAC, ESB): terminal (OSM tabanı, 4 kat, ışıklıklı çatı), modern kule (~77 m), hangarlar, uçaklar.
import { standard, towerModern, towerPos } from './ortak.js';

export function build(ctx) {
  standard(ctx, { occ: 0.62, terminal: (b, area) => (area > 30000 ? { h: 22, roof: 'isiklik', overhang: 6 } : { h: 12 }) });
  const t = towerPos(ctx.d, null);
  if (t) towerModern(ctx, t.x, t.y, Math.max(60, t.h), 0.2);
}
