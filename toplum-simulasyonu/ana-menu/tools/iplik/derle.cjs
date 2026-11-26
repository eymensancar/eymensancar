// İplikleri tek dosyada birleştirir: node tools/iplik/derle.cjs  ->  npc-iplik.js
'use strict';
const fs = require('fs'), path = require('path');
const kok = __dirname, cikti = path.join(__dirname, '..', '..', 'npc-iplik.js');
const veri = { tr: [], global: {} };
for (const f of fs.readdirSync(kok).filter(f => f.endsWith('.json')).sort()) {
  const l = JSON.parse(fs.readFileSync(path.join(kok, f), 'utf8'));
  const m = /^global-([a-z]+)(?:-\d+)?\.json$/.exec(f);
  if (m) (veri.global[m[1]] = veri.global[m[1]] || []).push(...l); else if (/^tr-/.test(f)) veri.tr.push(...l);
}
const temiz = l => l.map(x => ({ id: x.id, kosul: x.kosul && x.kosul.length ? x.kosul : undefined, saat: x.saat || undefined, turlar: x.turlar }));
const son = { tr: temiz(veri.tr), global: Object.fromEntries(Object.entries(veri.global).map(([k, v]) => [k, temiz(v)])) };
const js = '// Üretilir: node tools/iplik/derle.cjs (kaynak tools/iplik/*.json). Elle değiştirme.\n(function (g) { g.NPCIplik = ' + JSON.stringify(son) + '; })(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(cikti, js);
console.log(`npc-iplik.js: tr ${son.tr.length} iplik, global ${Object.entries(son.global).map(([k, v]) => k + ' ' + v.length).join(', ')}; ${(js.length / 1024).toFixed(0)} KB`);
