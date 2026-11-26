// İplik dosyası denetimi: node tools/iplik/denetle.cjs tools/iplik/DOSYA.json [--global]
'use strict';
const fs = require('fs');
const dosya = process.argv[2];
if (!dosya) { console.error('Kullanım: node tools/iplik/denetle.cjs DOSYA.json'); process.exit(2); }
let veri;
try { veri = JSON.parse(fs.readFileSync(dosya, 'utf8')); } catch (e) { console.error('JSON bozuk:', e.message); process.exit(1); }
const GLOBAL = process.argv.includes('--global') || /global/.test(dosya);
const ROL = ['A', 'B', 'C', 'D'];
const KISI_ALAN = ['', '.meslek', '.yer', '.sehir'];
const VERI = ['daire', 'arsa', 'dukkan', 'daire.kira', 'pesinat', 'maas.kurye', 'maas.garson', 'maas.kasiyer', 'maas.insaat', 'maas.memur', 'maas.muhasebeci', 'maas.usta', 'maas.emlak', 'maas.nakliyeci', 'gorev.kurye', 'asgari', 'yasam', 'evkira', 'kurs.kpss', 'kurs.kpss.gun', 'kurs.muhasebe', 'kurs.muhasebe.gun', 'kurs.ustalik', 'kurs.ustalik.gun', 'kurs.emlak', 'kurs.emlak.gun', 'kafe.kurulus', 'kafe.gider', 'dukkan.kurulus', 'dukkan.gider', 'enflasyon', 'faiz', 'bayram', 'bayram.gun'];
const izinli = new Set([].concat(...ROL.map(r => KISI_ALAN.map(a => r + a))).concat(GLOBAL ? [] : VERI));
const KOSUL = ['issiz', 'calisan', 'patron', 'kurye', 'garson', 'memur', 'usta', 'sartsiz', 'evsahibi', 'kiraci', 'yeni', 'eski', 'zengin', 'borclu', 'kursta', 'istanbul'];
const SAAT = [null, 'sabah', 'ogle', 'aksam', 'gece'];
const hatalar = [], uyarilar = [], idler = new Set(), acilis = {};
const EMOJI = /\p{Extended_Pictographic}/u;
const norm = s => s.toLocaleLowerCase('tr').replace(/\[[^\]]*\]/g, '').replace(/\{[^}]*\}/g, '').replace(/[^a-zçğıöşü ]/g, '').trim().split(/\s+/).slice(0, 4).join(' ');
if (!Array.isArray(veri)) { console.error('Kök bir dizi olmalı'); process.exit(1); }
veri.forEach((t, i) => {
  const yer = `#${i} ${t && t.id}`;
  if (!t || typeof t !== 'object') return hatalar.push(yer + ': nesne değil');
  if (!t.id || !/^[a-z0-9-]+$/.test(t.id)) hatalar.push(yer + ': id küçük harf/rakam/tire olmalı');
  if (idler.has(t.id)) hatalar.push(yer + ': id tekrar'); idler.add(t.id);
  if (!t.konu) hatalar.push(yer + ': konu yok');
  if (!Array.isArray(t.kosul)) hatalar.push(yer + ': kosul dizi olmalı');
  else t.kosul.forEach(k => { const m = /^([ABCD])\.(\w+)$/.exec(k); if (!m || !KOSUL.includes(m[2])) hatalar.push(yer + ': bilinmeyen koşul ' + k); });
  if (!SAAT.includes(t.saat === undefined ? null : t.saat)) hatalar.push(yer + ': saat ' + t.saat);
  if (!Array.isArray(t.turlar) || t.turlar.length < 3 || t.turlar.length > 9) hatalar.push(yer + ': 3-9 tur olmalı');
  const roller = new Set();
  (t.turlar || []).forEach((tr, j) => {
    if (!Array.isArray(tr) || tr.length !== 2 || !ROL.includes(tr[0]) || typeof tr[1] !== 'string') return hatalar.push(`${yer} tur ${j}: [rol, metin] olmalı`);
    roller.add(tr[0]); const m = tr[1];
    if (j === 0 && tr[0] !== 'A') hatalar.push(`${yer}: ilk tur A olmalı`);
    if (EMOJI.test(m)) hatalar.push(`${yer} tur ${j}: emoji var`);
    for (const x of m.matchAll(/\{([^}]*)\}/g)) if (!izinli.has(x[1])) hatalar.push(`${yer} tur ${j}: bilinmeyen yer tutucu {${x[1]}}`);
    for (const x of m.matchAll(/\{[^}]*\}'/g)) hatalar.push(`${yer} tur ${j}: yer tutucuya ek yapışmış: ${x[0]}`);
    if (/\[[^\]]*\[/.test(m) || (m.match(/\[/g) || []).length !== (m.match(/\]/g) || []).length) hatalar.push(`${yer} tur ${j}: köşeli parantez bozuk/iç içe`);
    const enUzun = m.replace(/\[([^\]]*)\]/g, (a, b) => b.split('|').sort((p, q) => q.length - p.length)[0]).replace(/\{[^}]*\}/g, 'XXXXXXXXXX');
    if (enUzun.length > 130) hatalar.push(`${yer} tur ${j}: çok uzun (${enUzun.length})`);
    for (const x of m.matchAll(/\{([BCD])[.}]/g)) if (!t.turlar.some(q => q[0] === x[1])) uyarilar.push(`${yer}: {${x[1]}} geçiyor ama ${x[1]} hiç konuşmuyor`);
  });
  if (roller.size < 2) hatalar.push(yer + ': en az iki kişi konuşmalı');
  const a0 = t.turlar && t.turlar[0] && norm(t.turlar[0][1]); if (a0) (acilis[a0] = acilis[a0] || []).push(t.id);
});
Object.entries(acilis).forEach(([a, l]) => { if (l.length > 2) uyarilar.push(`aynı açılış "${a}" ${l.length} iplikte: ${l.join(', ')}`); });
const turSay = veri.reduce((s, t) => s + ((t && t.turlar) || []).length, 0);
console.log(`${veri.length} iplik, ${turSay} tur. Hata: ${hatalar.length}, uyarı: ${uyarilar.length}`);
hatalar.slice(0, 60).forEach(h => console.log('HATA  ' + h));
uyarilar.slice(0, 30).forEach(h => console.log('UYARI ' + h));
process.exit(hatalar.length ? 1 : 0);
