// Sohbet sınavı: çok turlu oyuncu konuşmalarını gerçek bir NPC dünyasında oynatır ve puanlar.
// node tools/sohbet-sinav.cjs [--yaz] [--korpus]   (--yaz: bütün dökümü yazdırır)
// Diyaloglar: aşağıdaki el yazımı set + tools/korpus/diyalog.json (kör set, varsa).
const fs = require('fs'), path = require('path'), vm = require('vm');
const kok = path.join(__dirname, '..');
const ctx = { console, Date, Math, JSON }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'toplum-cekirdek.js'), 'utf8') + ';globalThis.Toplum=Toplum;', ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'npc-dil.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'npc-yz.js'), 'utf8'), ctx);
if (fs.existsSync(path.join(kok, 'npc-sss.js')) && !process.argv.includes('--sssyok')) vm.runInContext(fs.readFileSync(path.join(kok, 'npc-sss.js'), 'utf8'), ctx);
const T = ctx.Toplum, N = ctx.NPCYZ, D = ctx.NPCDil;
if (process.env.SSS && N.sssAyar) { const [g, e] = process.env.SSS.split(',').map(Number); N.sssAyar(g, e); }
const YAZ = process.argv.includes('--yaz'), KORPUS = !process.argv.includes('--elle');
const SET = process.argv.includes('--sakli') ? 'sakli' : process.argv.includes('--hepsi') ? null : 'gelistirme';
const K2 = process.argv.includes('--korpus2'), K5 = (process.argv.find(x => /^--korpus[5-9]$/.test(x)) || '').slice(2) || null;
const dosya = ad => K5 ? path.join(__dirname, K5, process.argv.includes('--sakli') ? `${ad}-sakli.json` : `${ad}-gelistirme.json`) : K2 ? path.join(__dirname, 'korpus2', SET && process.argv.includes('--sakli') ? `${ad}-sakli.json` : SET && process.argv.includes('--gelistirme2') ? `${ad}-gelistirme.json` : `${ad}.json`) : path.join(__dirname, 'korpus', SET ? `${ad}-${SET}.json` : `${ad}.json`);
console.log('Kör set:', SET || 'hepsi');

// Dünya: 150 gün ön yaşam, oyuncu işsiz yeni gelmiş biri (en zor durum)
function dunyaKur(tohum, durum) {
  const w = T.createWorld(tohum);
  const meta = N.kur(w, { sayi: 70, onYasamGun: 360, yabanciSayi: 30, tohum: tohum ^ 99 });
  const o = T.addPlayer(w, 'Eymen Sancar');
  if (durum === 'kurye') T.takeProfession(w, o.id, 'kurye');
  if (durum === 'patron') { o.totalExperienceDays = 60; T.credit(w, o, 700000, 'test'); T.takeProfession(w, o.id, 'dukkan_sahibi'); }
  if (durum === 'evsahibi') { T.credit(w, o, 2500000, 'test'); T.buyProperty(w, o.id, 'daire', { liveIn: false }); }
  if (durum === 'zengin') T.credit(w, o, 3000000, 'test');
  return { w, meta, o };
}

const ELLE = [
  { ad: 'Ekrandaki örnek: iş arıyorum → işveren var mı → yok mu', turlar: [
    { m: 'İs ariyorum da varmi', konu: 'is_ariyorum', beklenen: ['cevap_var', 'somut', 'anlamsiz_onay_yok'] },
    { m: 'İşveren varmı hiç', konu: 'is_ariyorum', beklenen: ['cevap_var', 'somut', 'anlamsiz_onay_yok'] },
    { m: 'Yok mu', konu: 'is_ariyorum', beklenen: ['cevap_var', 'baglam', 'anlamsiz_onay_yok'] }] },
  { ad: 'Teklif → maaş → yer → tamam', turlar: [
    { m: 'iş arıyorum', konu: 'is_ariyorum', beklenen: ['cevap_var', 'somut'] },
    { m: 'ne kadar veriyorsun', konu: 'is_ariyorum', beklenen: ['cevap_var', 'ayni_kisi', 'somut'] },
    { m: 'nerede', konu: 'is_ariyorum', beklenen: ['cevap_var', 'ayni_kisi', 'somut'] },
    { m: 'tamam olur', konu: 'is_ariyorum', beklenen: ['cevap_var', 'ayni_kisi', 'dm_teklif'] }] },
  { ad: 'Konu değiştirme', turlar: [
    { m: 'iş var mı', konu: 'is_ariyorum', beklenen: ['cevap_var'] },
    { m: 'bu arada dolar ne olur sizce', konu: 'ekonomi', beklenen: ['cevap_var', 'anlamsiz_onay_yok'] }] },
  { ad: 'Patron eleman arıyor', durum: 'patron', turlar: [
    { m: 'kasiyer arıyorum dükkanıma', konu: 'eleman_ariyorum', beklenen: ['cevap_var'] },
    { m: 'maaş ne kadar istersin', konu: 'eleman_ariyorum', beklenen: ['cevap_var', 'ayni_kisi', 'somut'] }] },
  { ad: 'Anlamsız cümle: içi boş onay yok', turlar: [
    { m: 'bugün hava çok güzel ya', konu: 'genel', beklenen: ['cevap_yok_olabilir', 'anlamsiz_onay_yok'] },
    { m: 'maç izleyen var mı', konu: 'genel', beklenen: ['cevap_yok_olabilir', 'anlamsiz_onay_yok'] }] },
];

const BOS_ONAY = /^(dogru diyorsun\w*|hakli\w*|aynen\w*|anladim|eyw\w*,? anladim|olabilir\w*( tabii)?|ben de ayni seyi dusunuyordum|evet ya.*)\W*$/;
const YERLER = new Set([].concat(...D.veri.yerler.map(y => [y.ad].concat(y.ilceler || []))).map(x => D.normal(x).katli));
const somutMu = m => D.normal(m).katli.split(/[^a-z0-9]+/).some(w => YERLER.has(w)) || /₺|\d/.test(m) || /(dükkan|kafe|market|ofis|firma|büro|fabrika|kurye|garson|kasiyer|memur|muhasebe|usta|emlak|inşaat|nakliye|taşeron|daire|arsa)/i.test(m) || /'(de|da|te|ta)\b/.test(m);

let cevapIyi = 0, toplamTur = 0, gecenTur = 0, toplamKontrol = 0, gecenKontrol = 0, konuDogru = 0, konuToplam = 0;
const hatalar = [];
const GERCEK_NOW = Date.now, GERCEK_RANDOM = Math.random;
function oyna(diyalog, tohum) {
  const kanal0 = diyalog.kanal === 'dm' ? null : 'ulke';
  // Her çalıştırmada aynı sonuç: saat ve rastgelelik konuşmanın tohumuna bağlı
  let zaman0 = Date.parse('2026-11-26T09:00:00Z') + tohum * 1000; Date.now = () => zaman0;
  let rs = (tohum * 2654435761) >>> 0; Math.random = () => { rs = (rs + 0x6D2B79F5) >>> 0; let x = rs; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const { w, meta, o } = dunyaKur(tohum, diyalog.durum || (/patron|eleman/.test(diyalog.ad) ? 'patron' : 'issiz'));
  let son = null, oncekiKonu = null;
  const dokum = [];
  let zaman = zaman0;
  const gercekNow = () => zaman;
  for (const tur of diyalog.turlar) {
    zaman += 40e3; Date.now = () => zaman; // her mesaj arasında 40 sn
    let r;
    if (diyalog.kanal === 'dm') {
      // Özel mesaj: konuşulan NPC (dmKim: patron = işletmesi olan, ev = mülkü olan, yoksa herhangi biri)
      if (!diyalog._npc) { const ids = Object.keys(meta.npc).filter(id => w.players[id]); diyalog._npc = diyalog.dmKim === 'patron' ? (ids.find(id => w.players[id].businessIds.length) || ids[0]) : diyalog.dmKim === 'ev' ? (ids.find(id => w.players[id].propertyIds.length) || ids[0]) : ids[(tohum >> 3) % ids.length]; }
      const d = N.dmGonder(w, meta, diyalog._npc, tur.m, o);
      r = { cevaplar: d && (d.metin || d.hata) ? [{ npcId: diyalog._npc, ad: meta.npc[diyalog._npc].gorunen, metin: d.metin || d.hata }] : [], niyet: Object.assign({ etkin: tur.konu }, D.niyetBul(tur.m, { adlar: [] })), dm: d && d.teklif ? [1] : null };
      if (d && d.metin) N.dmCevapEkle(w, meta, diyalog._npc, d.metin);
    } else r = N.oyuncuMesaji(w, meta, 'ulke', tur.m, o, 20, []);
    Date.now = gercekNow;
    dokum.push(`  Sen: ${tur.m}   [${r.niyet.niyet}→${r.niyet.etkin}${r.niyet.takip ? ', takip:' + r.niyet.takip : ''}]`);
    r.cevaplar.forEach(c => dokum.push(`     ${c.ad}: ${c.metin}`));
    const kontrol = [];
    const altSoru = { maas_sorusu: 'miktar', fiyat_sorusu: 'miktar', kisisel_yer: 'yer', evet: 'onay', hayir: 'ret' };
    if (tur.konu) { konuToplam++; if (r.niyet.etkin === tur.konu || r.niyet.niyet === tur.konu || (altSoru[tur.konu] && r.niyet.takip === altSoru[tur.konu])) konuDogru++; else kontrol.push(['konu ' + tur.konu, false]); }
    for (const b of tur.beklenen || []) {
      if (b === 'cevap_var') kontrol.push([b, r.cevaplar.length > 0]);
      if (b === 'somut') kontrol.push([b, r.cevaplar.some(c => somutMu(c.metin))]);
      if (b === 'anlamsiz_onay_yok') kontrol.push([b, r.cevaplar.every(c => !BOS_ONAY.test(D.normal(c.metin).katli))]);
      if (b === 'ayni_kisi') kontrol.push([b, !son || !son.length || r.cevaplar.some(c => son.some(x => x.npcId === c.npcId))]);
      if (b === 'baglam') kontrol.push([b, r.niyet.etkin === (tur.konu || oncekiKonu) || r.niyet.etkin === oncekiKonu || (altSoru[tur.konu] && r.niyet.takip === altSoru[tur.konu])]);
      if (b === 'dm_teklif') kontrol.push([b, !!(r.dm && r.dm.length)]);
    }
    // icermeli: cevaplardan en az biri bu kalıplardan birini içermeli (büyük/küçük harf ve Türkçe harf farkı gözetilmez)
    if (tur.icermeli && tur.icermeli.length) { const ns = x => D.normal(x).katli; const esle = (k, m) => { const katla = x => String(x).toLocaleLowerCase('tr').replace(/[çğıöşü]/g, h => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[h]); try { if (new RegExp(katla(k), 'i').test(katla(m))) return true; } catch (e) { } return ns(m).includes(ns(k)); }; const ok = r.cevaplar.some(c => tur.icermeli.some(k => esle(k, c.metin))); kontrol.push(['icermeli:' + tur.icermeli[0], ok]); }
    if (tur.icermemeli && tur.icermemeli.length) { const ns = x => D.normal(x).katli; const ok = !r.cevaplar.some(c => tur.icermemeli.some(k => ns(c.metin).includes(ns(k)))); kontrol.push(['icermemeli:' + tur.icermemeli[0], ok]); }
    {
    }
    toplamTur++; toplamKontrol += kontrol.length;
    const iyi = kontrol.filter(k => k[1]).length; gecenKontrol += iyi;
    if (kontrol.every(k => k[1] || /^konu /.test(k[0]))) cevapIyi++;
    if (iyi === kontrol.length) gecenTur++; else { dokum.push('     ✗ ' + kontrol.filter(k => !k[1]).map(k => k[0]).join(', ')); hatalar.push({ diyalog: diyalog.ad, m: tur.m, eksik: kontrol.filter(k => !k[1]).map(k => k[0]) }); }
    if (r.cevaplar.length) son = r.cevaplar;
    oncekiKonu = tur.konu || oncekiKonu;
  }
  return dokum;
}

let diyaloglar = ELLE.slice();
const korpusDosya = dosya('diyalog');
if (KORPUS && fs.existsSync(korpusDosya)) diyaloglar = diyaloglar.concat(JSON.parse(fs.readFileSync(korpusDosya, 'utf8')));
// --tohum N: her konuşma N farklı tohumla oynanır (karşılaştırmada şans payını azaltır); sayılar toplamdır
const TOHUM = +((process.argv.find(x => /^--tohum=\d+$/.test(x)) || '--tohum=1').split('=')[1]);
for (let k = 0; k < TOHUM; k++) diyaloglar.forEach((d, i) => { delete d._npc; const dokum = oyna(d, 1000 + i * 17 + k * 7919); if (k === 0 && (YAZ || i < ELLE.length)) { console.log('\n# ' + d.ad); console.log(dokum.join('\n')); } });

// Tekil mesajlar (kör set): niyet doğruluğu
const tekilDosya = dosya('tekil');
if (KORPUS && fs.existsSync(tekilDosya)) {
  const tek = JSON.parse(fs.readFileSync(tekilDosya, 'utf8')); let dogru = 0; const yanlis = {};
  tek.forEach(x => { const n = D.niyetBul(x.m, { adlar: [] }).niyet; if (n === x.niyet) dogru++; else { const k = x.niyet + ' → ' + n; (yanlis[k] = yanlis[k] || []).push(x.m); } });
  console.log(`\nKör tekil set: ${dogru}/${tek.length} doğru (%${(dogru / tek.length * 100).toFixed(1)})`);
  Object.entries(yanlis).sort((a, b) => b[1].length - a[1].length).slice(0, 25).forEach(([k, l]) => console.log(`  ${k} (${l.length}): ${l.slice(0, 4).map(x => JSON.stringify(x)).join(', ')}`));
}
console.log(`\nDiyalog: ${diyaloglar.length} konuşma, ${toplamTur} tur. Tamamen doğru tur: ${gecenTur}/${toplamTur} (%${(gecenTur / toplamTur * 100).toFixed(1)}). Cevabı doğru tur (konu etiketi hariç): ${cevapIyi}/${toplamTur} (%${(cevapIyi / toplamTur * 100).toFixed(1)}). Kontrol: ${gecenKontrol}/${toplamKontrol}. Konu doğruluğu: ${konuDogru}/${konuToplam} (%${(konuDogru / konuToplam * 100).toFixed(1)})`);
const ozet = {}; hatalar.forEach(h => h.eksik.forEach(e => (ozet[e] = (ozet[e] || 0) + 1)));
console.log('Eksik türleri:', JSON.stringify(ozet));
