// Bilgi bankasının (npc-sss.js) her soruluşunun anlam vektörünü önceden hesaplar -> npc-sss-gomme.js
// node tools/anlam/gomme-derle.cjs   (model: ANLAM_MODEL, sözlük: tools/anlam/sozluk.json, onnxruntime-node: ANLAM_MODUL)
// Soruluş başına iki vektör: Türkçe harfli (normal().kucuk) ve harfsiz (normal().katli) yazılış; oyuncu ikisinden biriyle yazar.
// Vektörler int8 (vektör başına ölçek), sıra npc-sss.js'deki kayıt ve soruluş sırası.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const kok = path.join(__dirname, '..', '..');
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'npc-dil.js'), 'utf8'), ctx); vm.runInContext(fs.readFileSync(path.join(kok, 'npc-sss.js'), 'utf8'), ctx);
const D = ctx.NPCDil, L = ctx.NPCSSS;
const gomme = require('./anlam-node.cjs')({ model: process.env.ANLAM_MODEL || path.join(__dirname, 'model', 'model.onnx'), sozluk: path.join(__dirname, 'sozluk.json'), modulKoku: process.env.ANLAM_MODUL, onEk: 'query: ' });
const metinler = [], katlilar = []; L.forEach(e => e.sorular.forEach(q => { const n = D.normal(q); metinler.push(n.kucuk, n.katli); katlilar.push(n.katli); }));
const BOY = 384, n = metinler.length, veri = new Int8Array(n * BOY), olcek = [];
const t0 = Date.now();
metinler.forEach((m, i) => { const v = gomme(m); let mx = 0; for (const x of v) mx = Math.max(mx, Math.abs(x)); const s = mx / 127 || 1; olcek.push(+s.toPrecision(5)); for (let k = 0; k < BOY; k++) veri[i * BOY + k] = Math.round(v[k] / olcek[i]); });
// Bankanın imzası: soruluşlar değişince vektörler eskir, oyun o zaman anlam modelini kullanmaz
let h = 2166136261; for (const c of katlilar.join('\n')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
const js = '// Üretilir: node tools/anlam/gomme-derle.cjs (npc-sss.js değişince yeniden). Elle değiştirme.\n(function (g) { g.NPCSSSGOMME = ' + JSON.stringify({ boy: BOY, n, imza: h, olcek, veri: Buffer.from(veri.buffer).toString('base64') }) + '; })(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(path.join(kok, 'npc-sss-gomme.js'), js);
console.log(`npc-sss-gomme.js: ${n / 2} soruluş × 2 yazılış, ${(js.length / 1048576).toFixed(2)} MB, ${((Date.now() - t0) / n).toFixed(1)} ms/soruluş`);
gomme.kapat();
