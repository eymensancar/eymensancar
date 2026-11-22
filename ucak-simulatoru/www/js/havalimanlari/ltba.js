// İstanbul Atatürk Havalimanı (LTBA, ISL): uluslararası ve iç hatlar terminalleri (OSM tabanları), klasik kule, hangarlar.
// 2019'dan beri yolcu uçuşu yok; apronda birkaç uçak (kargo, genel havacılık) durur.
import { standard, towerClassic, towerPos } from './ortak.js';

export function build(ctx) {
  standard(ctx, { occ: 0.35, terminal: (b, area) => (area > 60000 ? { h: 22, roof: 'kemer', rise: 9, overhang: 6 } : { h: 16, roof: 'isiklik' }) });
  const t = towerPos(ctx.d, null);
  towerClassic(ctx, t && t.h > 20 ? t.x : 250, t && t.h > 20 ? t.y : 250, 55);
}
