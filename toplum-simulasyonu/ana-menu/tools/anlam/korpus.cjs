// Budama için oyunun Türkçe metinlerini toplar (saklı setler hariç) -> korpus.txt (satır başına bir cümle)
// node tools/anlam/korpus.cjs [çıktı]
const fs = require('fs'), path = require('path');
const K = path.join(__dirname, '..', '..') + '/';
const dosyalar = ['tools/korpus3/egitim.json', 'tools/korpus4/egitim.json', 'tools/korpus/diyalog-gelistirme.json', 'tools/korpus/tekil-gelistirme.json', 'tools/korpus5/diyalog-gelistirme.json', 'tools/korpus6/diyalog-gelistirme.json', 'tools/korpus7/diyalog-gelistirme.json']
  .concat(fs.readdirSync(K + 'tools/sss').filter(f => /\.json$/.test(f)).map(f => 'tools/sss/' + f))
  .concat(fs.readdirSync(K + 'tools/iplik').filter(f => /\.json$/.test(f)).map(f => 'tools/iplik/' + f));
const out = new Set();
const gez = x => { if (typeof x === 'string') { if (x.length > 1) out.add(x); } else if (Array.isArray(x)) x.forEach(gez); else if (x && typeof x === 'object') Object.values(x).forEach(gez); };
for (const f of dosyalar) { if (/sakli|korpus2|\/tekil\.json|\/diyalog\.json/.test(f)) throw f; gez(JSON.parse(fs.readFileSync(K + f, 'utf8'))); }
// JS dosyalarındaki metin sabitleri (npc-dil.js sözlükleri, npc-yz.js cevapları, npc-iplik.js, npc-sss.js)
for (const f of ['npc-dil.js', 'npc-yz.js', 'npc-iplik.js', 'npc-sss.js', 'tools/sohbet-sinav.cjs']) { const s = fs.readFileSync(K + f, 'utf8'); for (const m of s.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) { const t = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, ' '); if (/[a-zçğıöşü]{2}/i.test(t)) out.add(t); } }
const satir = new Set(); for (const x of out) for (const p of x.split(/(?<=[.!?\n])\s+/)) { const t = p.replace(/\s+/g, ' ').trim(); if (t.length > 1 && t.length <= 300 && /[a-zçğıöşü]{2}/i.test(t)) satir.add(t); }
fs.writeFileSync(process.argv[2] || path.join(__dirname, 'korpus.txt'), [...satir].join('\n'));
console.log(out.size, 'metin');
