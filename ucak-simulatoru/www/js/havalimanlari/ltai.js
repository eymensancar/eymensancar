// Antalya Havalimanı (LTAI, AYT): dış hatlar 1 ve 2, iç hatlar terminalleri (OSM tabanları), yeni kule (~77 m), hangarlar, uçaklar.
import { standard, towerModern, towerPos } from './ortak.js';

export function build(ctx) {
  standard(ctx, { occ: 0.68, terminal: (b, area) => (area > 30000 ? { h: 22, roof: 'isiklik', overhang: 7 } : area > 8000 ? { h: 16, roof: 'isiklik' } : { h: 10 }) });
  const t = towerPos(ctx.d, null);
  if (t) towerModern(ctx, t.x, t.y, Math.max(60, t.h), 1.1);
}
