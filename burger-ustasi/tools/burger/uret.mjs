// Burger Ustası: katman.mjs ve nesne.mjs'deki SVG çizimlerini 3× webp'ye döker (www/g/v3/), ölçüleri katman.json'a yazar.
//
//   node tools/burger/uret.mjs            (Playwright gerekir; /opt/node-tools/node_modules/playwright da olur)
//
// Her görsel: genişlik w, yükseklik h sahne birimi; dosya 3w×3h piksel (iPad ve büyük ekranlarda da keskin).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
import * as K from './katman.mjs';
import * as N from './nesne.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const BURADA = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(BURADA, '..', '..', 'www', 'g', 'v3');
const OLCEK = 3;

const isler = [K.altEkmek(), K.kofte(), K.peynir(), K.tursu(), K.ustEkmek(), ...N.hepsi()];
const br = await pw.chromium.launch();
const p = await br.newPage({ deviceScaleFactor: OLCEK, viewport: { width: 800, height: 600 } });
const man = {};
for (const is of isler) {
  const m = is.svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const [w, h] = [m[2], m[3]];
  await p.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${is.svg.replace('<svg ', '<svg id="s" style="display:block" ')}</body></html>`);
  await p.setViewportSize({ width: Math.ceil(w) + 2, height: Math.ceil(h) + 2 });
  const png = await p.locator('#s').screenshot({ omitBackground: true });
  // PNG → webp (tarayıcının kendi kodlayıcısıyla, saydamlık korunur)
  const webp = await p.evaluate(async ([b64, q]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0);
    return c.toDataURL('image/webp', q).split(',')[1];
  }, [png.toString('base64'), is.q || 0.9]);
  fs.writeFileSync(path.join(OUT, is.ad + '.webp'), Buffer.from(webp, 'base64'));
  if (process.env.SVG_KAYIT) fs.writeFileSync(path.join(process.env.SVG_KAYIT, is.ad + '.svg'), is.svg);
  const o = { w: +w.toFixed(2), h: +h.toFixed(2) };
  for (const k of ['alt', 'ust', 'k', 'rx']) if (is[k] !== undefined) o[k] = +(+is[k]).toFixed(2);
  man[is.ad] = o;
  console.log(is.ad.padEnd(16), JSON.stringify(o), (Buffer.from(webp, 'base64').length / 1024).toFixed(1) + ' KB');
}
await br.close();
fs.writeFileSync(path.join(BURADA, 'katman.json'), JSON.stringify(man, null, 1));
// oyun.js'deki KAT satırını ölçülerle güncelle (/*KAT>*/ … /*<KAT*/)
const OYUN = path.join(BURADA, '..', '..', 'www', 'js', 'oyun.js');
const kat = { bunBot: 'b-alt', patty: 'b-kofte', cheese: 'b-peynir', pickle: 'b-tursu', bunTop: 'b-ust' };
const satir = 'const KAT={' + Object.entries(kat).map(([k, s]) => `${k}:{s:'${s}',h:${man[s].h},a:${man[s].alt},k:${man[s].k}}`).join(',') + '};';
const js = fs.readFileSync(OYUN, 'utf8'), yeni = js.replace(/\/\*KAT>\*\/.*?\/\*<KAT\*\//s, '/*KAT>*/' + satir + '/*<KAT*/');
if (yeni !== js) { fs.writeFileSync(OYUN, yeni); console.log('oyun.js KAT güncellendi'); }
