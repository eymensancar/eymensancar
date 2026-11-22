// Sabiha Gökçen Havalimanı (LTFJ, SAW): dış hatlar terminali (OSM tabanı, ışıklıklı çatı), modern kule, hangarlar, uçaklar.
import { standard, towerModern, towerPos } from './ortak.js';

export function build(ctx) {
  standard(ctx, { occ: 0.7, terminal: (b, area) => (area > 30000 ? { h: 24, roof: 'isiklik', overhang: 8, skyStep: 28 } : { h: 14 }) });
  const t = towerPos(ctx.d, null);
  if (t) towerModern(ctx, t.x, t.y, Math.max(60, t.h), 0.5);
}
