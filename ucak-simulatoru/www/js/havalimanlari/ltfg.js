// Gazipaşa-Alanya Havalimanı (LTFG, GZP): küçük tek terminal (OSM tabanı; beyaz, hafif kemerli çatı, apron tarafında
// geniş saçak), kule (OSM konumu), yolcu köprüsü yok: uçaklara merdiven araçlarıyla binilir, apron otobüsleri.
import { towerClassic, towerPos } from './ortak.js';
import { kabuk, kurulum, ccw, karaKenarlari } from './ltbs.js';

export function build(ctx) {
  const { d } = ctx;
  kurulum(ctx, { occ: 0.6, kopru: false, projektor: { H: 20, aral: 90 } }, (S) => {
    const terms = [];
    for (const b of d.bina) {
      if (b.t !== 'terminal') continue;
      const P = ccw(b.p);
      // apron tarafı kenarları: kara tarafının tersi
      const kara = karaKenarlari(P, S, 30);
      kabuk(ctx, 'terminal', b.n || 'Yolcu Terminali', P, { h: 11, T: 1.0, ov: 5, fl: 5, kolon: 12, kemer: 3.5, fin: 6, sacak: { kenarlar: kara, h: 6.5, D: 10 } });
      terms.push(P);
    }
    return terms;
  });
  const t = towerPos(d, { x: 245, y: -66, h: 30 });
  towerClassic(ctx, t.x, t.y, 32);
}
