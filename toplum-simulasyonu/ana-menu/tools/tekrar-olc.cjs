// Tekrar ölçümü: kanalı N saat aralıksız izlemiş gibi akıtır; birebir aynı cümle oranını verir.
// node tools/tekrar-olc.cjs [saat=24] [kanal=ulke|global]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const kok = path.join(__dirname, '..');
const ctx = { console, Date, Math, JSON }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['toplum-cekirdek.js', 'npc-dil.js', 'npc-yz.js', 'npc-iplik.js']) vm.runInContext(fs.readFileSync(path.join(kok, f), 'utf8') + (f.startsWith('toplum') ? ';globalThis.Toplum=Toplum;' : ''), ctx);
const T = ctx.Toplum, N = ctx.NPCYZ;
const SAAT = +(process.argv[2] || 24), KANAL = process.argv[3] || 'ulke';
const w = T.createWorld(8181); const meta = N.kur(w, { sayi: 70, onYasamGun: 120, yabanciSayi: 40, tohum: 81 }); const o = T.addPlayer(w, 'Eymen Sancar');
let t = Date.parse('2026-11-26T15:00:00Z'); Date.now = () => t; N.kanalAkisi(w, meta, KANAL, t, 18, o, []);
const norm = m => m.toLocaleLowerCase('tr').replace(/^@?\S+\s+/, '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const gor = new Map(); let n = 0, uzun = 0, tekrarUzun = 0, tekrarHepsi = 0; const kisiler = new Set(); const ornek = [];
for (let s = 0; s < SAAT * 60 * 24; s++) {
  t += 2500; Date.now = () => t;
  for (const m of N.kanalAkisi(w, meta, KANAL, t, 18, o, [])) {
    n++; kisiler.add(m.ad); const c = norm(m.metin);
    if (gor.has(c)) { tekrarHepsi++; if (c.length >= 20) { tekrarUzun++; if (ornek.length < 12) ornek.push(c); } }
    if (c.length >= 20) uzun++;
    gor.set(c, 1);
  }
  if (s % (60 * 24 * 6) === 0 && s) process.stderr.write(`${(s / 1440).toFixed(0)} saat… `);
}
console.log(`\n${KANAL}: ${SAAT} saat izleme, ${n} mesaj (${(n / SAAT / 60).toFixed(1)}/dk), ${kisiler.size} farklı kişi`);
console.log(`Birebir aynı cümle (20+ harf): ${tekrarUzun}/${uzun} = %${(tekrarUzun / uzun * 100).toFixed(2)};  tüm mesajlar (kısa tepkiler dahil): %${(tekrarHepsi / n * 100).toFixed(2)}`);
console.log('Örnek tekrarlar:', ornek.slice(0, 8).join(' | '));
console.log('kayıt KB', (JSON.stringify(meta).length / 1024).toFixed(0), 'defter', T.ledgerDiscrepancy(w));
