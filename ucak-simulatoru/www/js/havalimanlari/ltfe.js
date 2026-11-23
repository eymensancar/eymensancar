// Milas-Bodrum Havalimanı (LTFE, BJV). OSM tabanları üzerine:
// - Dış Hatlar Terminali (2012): uzun, alçak, beyaz düz çatılı bina; hava tarafında testere dişi gibi kapı çıkıntıları
//   (OSM tabanı), cam cephede sık beyaz dikey kanatlar, çatıda ışık kuyuları, kara tarafında boydan boya giriş saçağı.
// - İç Hatlar Terminali: daha eski, kat bantları belirgin, sade.
// Kule (OSM'de yok: terminallerin kara tarafında boş bir yere), yolcu köprüleri (OSM), park etmiş uçaklar, araçlar.
import { towerModern } from './ortak.js';
import { kabuk, kurulum, osmTerminal, ccw, karaKenarlari, bosYer } from './ltbs.js';

export function build(ctx) {
  const { d } = ctx;
  kurulum(ctx, { occ: 0.62, kopru: 'osm' }, (S) => {
    const terms = [];
    const dis = osmTerminal(d, /^Dış Hatlar/), ic = osmTerminal(d, /^İç Hatlar/);
    if (dis) {
      const P = ccw(dis.p);
      kabuk(ctx, 'dis-hatlar', 'Dış Hatlar Terminali', P, {
        h: 17, T: 1.6, ov: 1.2, fl: 5.5, fin: 3.6, isiklik: { step: 26, w: 7 },
        sacak: { kenarlar: karaKenarlari(P, S, 90), h: 9, D: 14 },
      });
      terms.push(P);
    }
    if (ic) {
      const P = ccw(ic.p);
      kabuk(ctx, 'ic-hatlar', 'İç Hatlar Terminali', P, { h: 12, T: 1.2, ov: 2.5, fl: 4.5, bant: 1.4, sacak: { kenarlar: karaKenarlari(P, S, 60), h: 6.5, D: 10 } });
      terms.push(P);
    }
    return terms;
  });
  const t = bosYer(d, 380, -660, 20);
  towerModern(ctx, t.x, t.y, 45, 0.35);
}
