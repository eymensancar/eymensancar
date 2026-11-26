// SSS bankasını tek dosyada birleştirir: node tools/sss/derle.cjs -> npc-sss.js
'use strict';
const fs = require('fs'), path = require('path');
const l = [];
for (const f of fs.readdirSync(__dirname).filter(f => /^sss-.*\.json$/.test(f)).sort()) l.push(...JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')));
const js = '// Üretilir: node tools/sss/derle.cjs (kaynak tools/sss/sss-*.json). Elle değiştirme.\n(function (g) { g.NPCSSS = ' + JSON.stringify(l.map(x => ({ id: x.id, konu: x.konu, sorular: x.sorular, cevap: x.cevap }))) + '; })(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'npc-sss.js'), js);
console.log(`npc-sss.js: ${l.length} kayıt, ${l.reduce((t, x) => t + x.sorular.length, 0)} soru, ${(js.length / 1024).toFixed(0)} KB`);
