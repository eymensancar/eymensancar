// Bilgi bankasının (npc-sss.js) her soruluşunun anlam vektörünü önceden hesaplar -> npc-sss-gomme.bin
// node tools/anlam/gomme-derle.cjs [--iki]   (model: ANLAM_MODEL, sözlük: anlam/sozluk.json, onnxruntime-node: ANLAM_MODUL)
// Varsayılan soruluş başına bir vektör (harfsiz yazılış, normal().katli); --iki: Türkçe harfli (kucuk) + harfsiz.
// Biçim: 'SSG1', boy, n, imza, soruluş başına vektör (uint32 LE); ölçekler float32[n]; vektörler int8[n × boy].
// Sıra npc-sss.js'deki kayıt ve soruluş sırası. **npc-sss.js değişince yeniden çalıştırılır** (imza tutmazsa oyun modeli kullanmaz).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const kok = path.join(__dirname, '..', '..');
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'npc-dil.js'), 'utf8'), ctx); vm.runInContext(fs.readFileSync(path.join(kok, 'npc-sss.js'), 'utf8'), ctx);
const D = ctx.NPCDil, L = ctx.NPCSSS, IKI = process.argv.includes('--iki');
const gomme = require('./anlam-node.cjs')({ model: process.env.ANLAM_MODEL || path.join(__dirname, 'model', 'model.onnx'), sozluk: path.join(kok, 'anlam', 'sozluk.json'), modulKoku: process.env.ANLAM_MODUL, onEk: 'query: ' });
const metinler = [], katlilar = []; L.forEach(e => e.sorular.forEach(q => { const n = D.normal(q); if (IKI) metinler.push(n.kucuk); metinler.push(n.katli); katlilar.push(n.katli); }));
const BOY = 384, n = metinler.length, her = IKI ? 2 : 1;
const ab = new ArrayBuffer(20 + 4 * n + n * BOY), u = new Uint32Array(ab, 0, 5), olcek = new Float32Array(ab, 20, n), veri = new Int8Array(ab, 20 + 4 * n, n * BOY);
const t0 = Date.now();
metinler.forEach((m, i) => { const v = gomme(m); let mx = 0; for (const x of v) mx = Math.max(mx, Math.abs(x)); olcek[i] = mx / 127 || 1; for (let k = 0; k < BOY; k++) veri[i * BOY + k] = Math.round(v[k] / olcek[i]); });
// Bankanın imzası: soruluşlar değişince vektörler eskir
let h = 2166136261; for (const c of katlilar.join('\n')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
u.set([0x31475353, BOY, n, h, her]);
const cikti = process.env.ANLAM_CIKTI || path.join(kok, 'npc-sss-gomme.bin');
fs.writeFileSync(cikti, Buffer.from(ab));
console.log(`${path.basename(cikti)}: ${katlilar.length} soruluş × ${her} vektör, ${(ab.byteLength / 1048576).toFixed(2)} MB, ${((Date.now() - t0) / n).toFixed(1)} ms/vektör`);
gomme.kapat();
