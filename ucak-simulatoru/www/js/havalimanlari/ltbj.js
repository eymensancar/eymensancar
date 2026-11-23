// İzmir Adnan Menderes Havalimanı (LTBJ, ADB): iç ve dış hatlar terminalleri (OSM tabanları), kule, hangarlar, uçaklar.
import { standard, towerClassic, towerPos } from './ortak.js';

export function build(ctx) {
  standard(ctx, { occ: 0.62, terminal: (b, area) => (area > 30000 ? { h: 22, roof: 'dalga', overhang: 6, skyStep: 32 } : { h: 14 }) });
  const t = towerPos(ctx.d, null);
  if (t) towerClassic(ctx, t.x, t.y, Math.max(40, t.h));
}
