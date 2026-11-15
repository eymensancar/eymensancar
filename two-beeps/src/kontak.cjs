#!/usr/bin/env node
/* Two Beeps — kontak sayfası (ekip incelemesi).
   node src/kontak.cjs [--from 0 --to 57.2] [--step 1] [--cols 6] [--width 270] [--out out/kontak.png] [--bg]
   Ayrıca tek kareler: --at 2.0,12.5,55.9 [--out out/kare.png] → her t için ayrı tam boy PNG (out adına -t eklenir). */
'use strict';
const fs = require('fs'), path = require('path');
const { openPage, args, ROOT } = require('./kaydet.cjs');

(async () => {
  const o = args(process.argv.slice(2));
  const { browser, page, srv, tl, errors } = await openPage(o);
  if (o.at) { // tam boy tek kareler
    const base = path.resolve(o.out || path.join(ROOT, 'out', 'kare.png'));
    for (const t of String(o.at).split(',').map(Number)) {
      const u = await page.evaluate(t => { renderAt(t); return document.getElementById('c').toDataURL('image/png'); }, t);
      const f = base.replace(/\.png$/, '') + '-' + t.toFixed(2).replace('.', '_') + '.png';
      fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); console.log(f);
    }
  } else {
    const from = +(o.from || 0), to = Math.min(+(o.to || tl.duration), tl.duration - 1e-3), step = +(o.step || 1), cols = +(o.cols || 6), tw = +(o.width || 270);
    const ts = []; for (let t = from; t <= to + 1e-6; t = +(t + step).toFixed(4)) ts.push(t);
    const u = await page.evaluate(([ts, cols, tw]) => {
      const src = document.getElementById('c'), th = Math.round(tw * src.height / src.width), pad = 10, lab = 34;
      const rows = Math.ceil(ts.length / cols), K = document.createElement('canvas');
      K.width = cols * (tw + pad) + pad; K.height = rows * (th + lab + pad) + pad;
      const g = K.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, K.width, K.height);
      ts.forEach((t, i) => {
        renderAt(t); const x = pad + (i % cols) * (tw + pad), y = pad + Math.floor(i / cols) * (th + lab + pad);
        g.imageSmoothingQuality = 'high'; g.drawImage(src, x, y + lab, tw, th);
        g.fillStyle = '#f1e8d4'; g.font = '700 24px Rubik'; g.fillText(t.toFixed(2) + ' sn', x + 4, y + 26);
      });
      return K.toDataURL('image/png');
    }, [ts, cols, tw]);
    const out = path.resolve(o.out || path.join(ROOT, 'out', 'kontak.png'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(u.split(',')[1], 'base64'));
    console.log(`${out}: ${ts.length} kare`);
  }
  if (errors.length) console.log('sayfa hataları:\n  ' + [...new Set(errors)].slice(0, 5).join('\n  '));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
