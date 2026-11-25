// Sohbet sınavı: çok turlu oyuncu konuşmalarını gerçek bir NPC dünyasında oynatır ve puanlar.
// node tools/sohbet-sinav.cjs [--yaz] [--korpus]   (--yaz: bütün dökümü yazdırır)
// Diyaloglar: aşağıdaki el yazımı set + tools/korpus/diyalog.json (kör set, varsa).
const fs = require('fs'), path = require('path'), vm = require('vm');
const kok = path.join(__dirname, '..');
const ctx = { console, Date, Math, JSON }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'toplum-cekirdek.js'), 'utf8') + ';globalThis.Toplum=Toplum;', ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'npc-dil.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'npc-yz.js'), 'utf8'), ctx);
const T = ctx.Toplum, N = ctx.NPCYZ, D = ctx.NPCDil;
const YAZ = process.argv.includes('--yaz'), KORPUS = !process.argv.includes('--elle');
const SET = process.argv.includes('--sakli') ? 'sakli' : process.argv.includes('--hepsi') ? null : 'gelistirme';
const K2 = process.argv.includes('--korpus2');
const dosya = ad => K2 ? path.join(__dirname, 'korpus2', SET && process.argv.includes('--sakli') ? `${ad}-sakli.json` : SET && process.argv.includes('--gelistirme2') ? `${ad}-gelistirme.json` : `${ad}.json`) : path.join(__dirname, 'korpus', SET ? `${ad}-${SET}.json` : `${ad}.json`);
console.log('Kör set:', SET || 'hepsi');

// Dünya: 150 gün ön yaşam, oyuncu işsiz yeni gelmiş biri (en zor durum)
function dunyaKur(tohum, durum) {
  const w = T.createWorld(tohum);
  const meta = N.kur(w, { sayi: 70, onYasamGun: 360, yabanciSayi: 30, tohum: tohum ^ 99 });
  const o = T.addPlayer(w, 'Eymen Sancar');
  if (durum === 'kurye') T.takeProfession(w, o.id, 'kurye');
  if (durum === 'patron') { o.totalExperienceDays = 60; T.credit(w, o, 700000, 'test'); T.takeProfession(w, o.id, 'dukkan_sahibi'); }
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
const somutMu = m => /₺|\d/.test(m) || /(dükkan|kafe|market|ofis|firma|büro|fabrika|kurye|garson|kasiyer|memur|muhasebe|usta|emlak|inşaat|nakliye|taşeron|daire|arsa)/i.test(m) || /'(de|da|te|ta)\b/.test(m);

let toplamTur = 0, gecenTur = 0, toplamKontrol = 0, gecenKontrol = 0, konuDogru = 0, konuToplam = 0;
const hatalar = [];
function oyna(diyalog, tohum) {
  const { w, meta, o } = dunyaKur(tohum, diyalog.durum || (/patron|eleman/.test(diyalog.ad) ? 'patron' : 'issiz'));
  let son = null, oncekiKonu = null;
  const dokum = [];
  let zaman = Date.now();
  const gercekNow = Date.now;
  for (const tur of diyalog.turlar) {
    zaman += 40e3; Date.now = () => zaman; // her mesaj arasında 40 sn
    const r = N.oyuncuMesaji(w, meta, 'ulke', tur.m, o, 20, []);
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
    toplamTur++; toplamKontrol += kontrol.length;
    const iyi = kontrol.filter(k => k[1]).length; gecenKontrol += iyi;
    if (iyi === kontrol.length) gecenTur++; else { dokum.push('     ✗ ' + kontrol.filter(k => !k[1]).map(k => k[0]).join(', ')); hatalar.push({ diyalog: diyalog.ad, m: tur.m, eksik: kontrol.filter(k => !k[1]).map(k => k[0]) }); }
    if (r.cevaplar.length) son = r.cevaplar;
    oncekiKonu = tur.konu || oncekiKonu;
  }
  return dokum;
}

let diyaloglar = ELLE.slice();
const korpusDosya = dosya('diyalog');
if (KORPUS && fs.existsSync(korpusDosya)) diyaloglar = diyaloglar.concat(JSON.parse(fs.readFileSync(korpusDosya, 'utf8')));
diyaloglar.forEach((d, i) => { const dokum = oyna(d, 1000 + i * 17); if (YAZ || i < ELLE.length) { console.log('\n# ' + d.ad); console.log(dokum.join('\n')); } });

// Tekil mesajlar (kör set): niyet doğruluğu
const tekilDosya = dosya('tekil');
if (KORPUS && fs.existsSync(tekilDosya)) {
  const tek = JSON.parse(fs.readFileSync(tekilDosya, 'utf8')); let dogru = 0; const yanlis = {};
  tek.forEach(x => { const n = D.niyetBul(x.m, { adlar: [] }).niyet; if (n === x.niyet) dogru++; else { const k = x.niyet + ' → ' + n; (yanlis[k] = yanlis[k] || []).push(x.m); } });
  console.log(`\nKör tekil set: ${dogru}/${tek.length} doğru (%${(dogru / tek.length * 100).toFixed(1)})`);
  Object.entries(yanlis).sort((a, b) => b[1].length - a[1].length).slice(0, 25).forEach(([k, l]) => console.log(`  ${k} (${l.length}): ${l.slice(0, 4).map(x => JSON.stringify(x)).join(', ')}`));
}
console.log(`\nDiyalog: ${diyaloglar.length} konuşma, ${toplamTur} tur. Tamamen doğru tur: ${gecenTur}/${toplamTur} (%${(gecenTur / toplamTur * 100).toFixed(1)}). Kontrol: ${gecenKontrol}/${toplamKontrol}. Konu doğruluğu: ${konuDogru}/${konuToplam} (%${(konuDogru / konuToplam * 100).toFixed(1)})`);
const ozet = {}; hatalar.forEach(h => h.eksik.forEach(e => (ozet[e] = (ozet[e] || 0) + 1)));
console.log('Eksik türleri:', JSON.stringify(ozet));
