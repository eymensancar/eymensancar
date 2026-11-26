// Budama 1. adım: tutulacak sözlük parçalarını seçer.
// node budama-sec.cjs <tokenizer.json> <korpus.txt> <hedef sayı> <çıktı sozluk.json>
// Tutulanlar: özel parçalar; oyunun bütün Türkçe metinlerinde (dört biçimde: ham, küçük, Türkçe harfli, harfsiz) geçen parçalar;
// rakamlar, Latin ve Türkçe harfler, noktalama tek tek; kalan yer Latin/Türkçe harfli en olası (en sık) parçalarla dolar.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const [tjYol, korpusYol, hedefS, cikti] = process.argv.slice(2), HEDEF = +hedefS || 40000;
const tj = JSON.parse(fs.readFileSync(tjYol, 'utf8')), V = tj.model.vocab;
const parcala = require(path.join(__dirname, 'anlam-sozcuk.js')).kur({ parcalar: V.map(x => x[0]), skor: V.map(x => x[1]), unk: 3 });
const kok = process.env.KOK || path.join(__dirname, '..', '..');
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(kok, 'npc-dil.js'), 'utf8'), ctx); const D = ctx.NPCDil;
const tut = new Set([0, 1, 2, 3]); let korpusParca = 0;
for (const l of fs.readFileSync(korpusYol, 'utf8').split('\n')) {
  let bic = [l, l.toLocaleLowerCase('tr')]; try { const q = D.normal(l); bic.push(q.kucuk, q.katli); } catch (e) { }
  for (const x of bic) for (const id of parcala(x)) tut.add(id);
}
korpusParca = tut.size;
const HARF = /^[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛ0-9]$/, NOKTA = /^[.,;:!?'"()\[\]{}\-+*/=%&@#$₺€<>_^~|\\…“”‘’«»]$/u;
V.forEach(([p], id) => { const c = p.replace(/^▁/, ''); if (c.length === 1 && (HARF.test(c) || NOKTA.test(c)) || p === '▁') tut.add(id); });
const TRLAT = /^▁?[a-zçğıöşüâîû0-9]+$/;
const aday = V.map((x, id) => [id, x[1], x[0]]).filter(x => !tut.has(x[0]) && TRLAT.test(x[2])).sort((a, b) => b[1] - a[1]);
for (const [id] of aday) { if (tut.size >= HEDEF) break; tut.add(id); }
const ids = [...tut].sort((a, b) => a - b);
fs.writeFileSync(cikti, JSON.stringify({ eski: ids, parcalar: ids.map(i => V[i][0]), skor: ids.map(i => +V[i][1].toFixed(5)), unk: 3 }));
console.log(`korpustan ${korpusParca}, toplam ${ids.length} parça -> ${cikti}`);
