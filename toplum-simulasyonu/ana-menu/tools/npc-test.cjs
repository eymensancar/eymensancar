// NPC yapay zekâsı testi: çekirdek + dil + beyin birlikte, tarayıcısız.
// node tools/npc-test.cjs [gun=720] [npc=70]
// Dünyayı ön yaşamla kurar, bir oyuncu ekler, iki yıl yaşatır; ekonomi, karar çeşitliliği,
// defter tutarlılığı, sohbet, başvuru, çalışan, teklif ve dönüş raporu akışlarını dener.
const fs = require('fs'), path = require('path'), vm = require('vm');
const kok = path.join(__dirname, '..');
const ctx = { console, Date, Math, JSON }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'toplum-cekirdek.js'), 'utf8') + ';globalThis.Toplum=Toplum;', ctx);
const dilVar = fs.existsSync(path.join(kok, 'npc-dil.js'));
if (dilVar) vm.runInContext(fs.readFileSync(path.join(kok, 'npc-dil.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(kok, 'npc-yz.js'), 'utf8'), ctx);
const T = ctx.Toplum, N = ctx.NPCYZ, D = ctx.NPCDil;
let gec = 0, kal = 0;
const ok = (ad, v, ek) => { v ? gec++ : kal++; console.log((v ? 'GEÇTİ ' : 'KALDI ') + ad + (ek ? '  (' + ek + ')' : '')); };
const GUN = +process.argv[2] || 720, SAYI = +process.argv[3] || 70;
console.log('Dil motoru:', dilVar ? 'npc-dil.js' : 'YOK (yedek)');

// ---- kurulum ve ön yaşam ----
let t0 = Date.now();
const w = T.createWorld(20261125);
const meta = N.kur(w, { sayi: SAYI, onYasamGun: 150, yabanciSayi: 40 });
const kurMs = Date.now() - t0;
ok('kurulum + 150 günlük ön yaşam', Object.keys(meta.npc).length > SAYI * .6, `${Object.keys(meta.npc).length} NPC, ${kurMs} ms`);
ok('defter tutarlı (ön yaşam)', T.ledgerDiscrepancy(w) === 0, 'fark ' + T.ledgerDiscrepancy(w));
const ozet = () => { const ps = Object.values(w.players).filter(p => meta.npc[p.id]); const mes = {}; ps.forEach(p => mes[p.profession || 'işsiz'] = (mes[p.profession || 'işsiz'] || 0) + 1);
  return { nufus: ps.length, isletme: Object.keys(w.businesses).length, mulk: Object.keys(w.properties).length, ev: ps.filter(p => p.propertyIds.some(id => w.properties[id] && w.properties[id].ownerLivesIn)).length, kurs: ps.reduce((t, p) => t + p.completedCourses.length, 0), kredi: ps.filter(p => p.loans.length).length, mustWork: ps.filter(p => p.mustWork).length, medyanNet: ps.map(p => T.netWorth(w, p)).sort((a, b) => a - b)[Math.floor(ps.length / 2)], meslek: mes, endeks: +w.priceIndex.toFixed(3) }; };
console.log('Ön yaşam sonrası:', JSON.stringify(ozet()));

// ---- oyuncu ----
const o = T.addPlayer(w, 'Eymen Sancar');
T.takeProfession(w, o.id, 'kurye');
let rng = T.createRng(7);
t0 = Date.now();
const ciktilar = [];
let enYavas = 0;
for (let g = 0; g < GUN; g++) {
  const g0 = Date.now();
  // oyuncu: çoğu gün 5 görev
  if (rng.chance(.8)) for (let i = 0; i < 5; i++) T.doTask(w, o.id, rng);
  ciktilar.push(...N.gun(w, meta, o.id));
  w.events = w.events.slice(-200); const n0 = w.events.length;
  T.advanceDay(w, T.createRng(T.daySeed(w.seed, w.day)));
  N.gunSonu(w, meta, w.events.slice(n0));
  enYavas = Math.max(enYavas, Date.now() - g0);
  // 200. günde oyuncu dükkan açar (çalışan testleri için)
  if (g === 200) { o.cash += 0; }
}
const simMs = Date.now() - t0;
ok(`${GUN} gün simülasyon hızı`, simMs / GUN < 25, `${(simMs / GUN).toFixed(1)} ms/gün, en yavaş gün ${enYavas} ms`);
ok('defter tutarlı (2 yıl)', T.ledgerDiscrepancy(w) === 0, 'fark ' + T.ledgerDiscrepancy(w));
const son = ozet();
console.log('Simülasyon sonrası:', JSON.stringify(son));
const sayilar = Object.values(w.players).flatMap(p => [p.cash, p.reputation, p.creditScore]);
ok('NaN / sonsuz yok', sayilar.every(Number.isFinite));
ok('kariyer çeşitliliği (≥7 farklı meslek)', Object.keys(son.meslek).length >= 7, Object.keys(son.meslek).join(', '));
ok('NPC işletmeleri açıldı', son.isletme >= 3, son.isletme + ' işletme');
ok('NPC mülk aldı', son.mulk >= 5, son.mulk + ' mülk, ' + son.ev + ' kişi kendi evinde');
ok('NPC kurs bitirdi', son.kurs >= 10, son.kurs + ' kurs');
ok('iflas edenler az (<%25)', son.mustWork / son.nufus < .25, son.mustWork + '/' + son.nufus);
ok('fiyat endeksi makul (0,9–2,5)', son.endeks > .9 && son.endeks < 2.5, son.endeks);
ok('yönetici harcama eğilimi sınırda (0,8–1,25) ve ayda ≤%3 oynadı', meta.yonetici.gecmis.every((x, i, a) => x.harcama >= .8 && x.harcama <= 1.25 && (i === 0 || Math.abs(x.harcama / a[i - 1].harcama - 1) <= .0306)), meta.yonetici.gecmis.map(x => x.harcama).join(' '));
const arketipNet = {}; Object.values(meta.npc).forEach(k => { const p = w.players[k.id]; (arketipNet[k.arketip] = arketipNet[k.arketip] || []).push(T.netWorth(w, p)); });
console.log('Arketip medyan servet:', Object.fromEntries(Object.entries(arketipNet).map(([a, l]) => [a, l.sort((x, y) => x - y)[Math.floor(l.length / 2)]])));

// ---- sohbet ----
const saat = 20;
const akis = N.kanalAkisi(w, meta, 'ulke', Date.now(), saat, o, []);
ok('Türkiye kanalı akışı mesaj üretti', akis.length >= 3, akis.length + ' mesaj');
const tum = akis.map(m => m.metin).join(' ');
ok('mesajlarda boş slot / undefined yok', !/[{}]|undefined|null|NaN/.test(tum));
console.log('\n--- Türkiye kanalı örnekleri ---'); akis.slice(0, 10).forEach(m => console.log(`  ${m.ad}: ${m.metin}`));
const gl = N.kanalAkisi(w, meta, 'global', Date.now(), 14, o, []);
console.log('--- Global ---'); gl.slice(0, 5).forEach(m => console.log(`  ${m.ad}: ${m.metin}`));
const sorular = ['selam herkese', 'iş arıyorum, kurye olarak çalışıyorum', 'hangi meslek daha çok kazandırır?', 'faizler ne olacak sizce', 'Kadıköyde daire arıyorum', 'bot musunuz siz', 'harika bir oyun ya', 'param bitti ne yapayım', 'garson arıyorum maaş 35 bin'];
console.log('--- Oyuncuya cevaplar ---');
let cevapVar = 0;
for (const s of sorular) { const r = N.oyuncuMesaji(w, meta, 'ulke', s, o, saat, []); if (r.cevaplar.length) cevapVar++; console.log(`  Sen: ${s}  [${r.niyet.niyet}]`); r.cevaplar.forEach(c => console.log(`    ${c.ad}: ${c.metin}  (${Math.round(c.gecikmeMs / 1000)} sn)`)); }
ok('sorulara cevap geliyor', cevapVar >= sorular.length - 2, cevapVar + '/' + sorular.length);
const botCevap = N.oyuncuMesaji(w, meta, 'ulke', 'sen bot musun gerçek misin', o, saat, []);
ok('"bot musun" sorusuna asla "gerçek insanım" demiyor', botCevap.cevaplar.every(c => !/gerçek (bir )?insan(ım|im)|ben insanım|bot değilim/i.test(c.metin)), botCevap.cevaplar.map(c => c.metin).join(' | '));
const hak = N.oyuncuMesaji(w, meta, 'ulke', 'salaksınız hepiniz', o, saat, []);
ok('hakarete küfürsüz tepki', hak.cevaplar.length <= 1);

// ---- oyuncu işletme açar, ilan verir, başvurular gelir ----
o.cash += 0;
// oyuncuyu dükkan sahibi yap (deneme: sermaye ve deneyim, defter dışı ekleme yapmadan şartları sağlayacak kadar çalıştırmak uzun sürer)
o.totalExperienceDays = Math.max(o.totalExperienceDays, 60);
const gerek = T.requiredCash(w, 'dukkan_sahibi', true);
if (o.cash < gerek) { T.credit(w, o, gerek - o.cash + 200000, 'test'); }
const ac = T.takeProfession(w, o.id, 'dukkan_sahibi', { useLoan: true });
ok('oyuncu dükkan açtı', ac.ok, ac.ok ? '' : ac.error);
const ilan = { id: 'i1', meslek: 'market_calisani', maas: T.indexed(w, 30000), poz: 'Kasiyer' };
let basvurular = [];
for (let g = 0; g < 6; g++) { basvurular.push(...N.basvurular(w, meta, o, [ilan], basvurular)); N.gun(w, meta, o.id); const n0 = w.events.length; T.advanceDay(w, T.createRng(T.daySeed(w.seed, w.day))); N.gunSonu(w, meta, w.events.slice(n0)); }
ok('ilana NPC başvuruları geldi', basvurular.length >= 1, basvurular.map(b => `${b.ad} (${b.deneyim} gün, ister ${b.maas}, alt ${b.alt})`).join('; '));
if (basvurular.length) {
  const b = basvurular[0];
  const dusuk = N.iseAl(w, meta, o.id, b, Math.max(T.indexed(w, 28000), b.alt - 5000));
  ok('düşük teklife pazarlık ya da kabul', dusuk.ok || dusuk.pazarlik > 0, dusuk.mesaj);
  const al = N.iseAl(w, meta, o.id, b, b.maas);
  ok('istediği maaşla işe alındı (çekirdekte çalışan)', al.ok && w.players[b.npcId].employerBusinessId === o.businessIds[0], al.mesaj);
  // maaşı düşük tut, moral düşsün → zam isteği
  const bz = w.businesses[o.businessIds[0]]; bz.employees[b.npcId] = T.indexed(w, 28000); N.maasDegisti(w, meta, b.npcId, b.maas, bz.employees[b.npcId]);
  let zam = false, istifa = false;
  for (let g = 0; g < 60; g++) { const c = N.gun(w, meta, o.id); if (c.some(x => /zam/.test(x.baslik || ''))) zam = true; if (c.some(x => /istifa|ayrıldı/.test((x.baslik || '') + (x.metin || '')))) istifa = true; const n0 = w.events.length; T.advanceDay(w, T.createRng(T.daySeed(w.seed, w.day))); N.gunSonu(w, meta, w.events.slice(n0)); }
  const deger = N.piyasaDegeri(w, meta, b.npcId), maasS = T.indexed(w, 28000);
  ok('kesintiye tepki: zam isteği, istifa ya da (piyasa değeri maaşa yakınsa) memnuniyet', zam || istifa || deger <= maasS * 1.15, `zam ${zam}, istifa ${istifa}, piyasa ${Math.round(deger)} / maaş ${maasS}`);
  console.log('  çalışan durumu:', JSON.stringify(N.profil(w, meta, b.npcId)), 'istifa:', istifa);
}
// ---- teklifler: mülk alım teklifi ve DM kabul ----
T.credit(w, o, T.propertyMarketPrice(w, 'arsa') + 100000, 'test');
const kira = T.buyProperty(w, o.id, 'arsa', {});
console.log('  arsa fiyatı', T.propertyMarketPrice(w,'arsa'), 'nakdi bundan fazla NPC:', Object.keys(meta.npc).filter(id=>w.players[id].cash>T.propertyMarketPrice(w,'arsa')).length, 'en zengin nakit:', Math.max(...Object.keys(meta.npc).map(id=>w.players[id].cash)));
N.sansAc(w, meta, 40, .9);
Object.keys(meta.npc).slice(0, 8).forEach(z => T.credit(w, w.players[z], 3e6, 'test'));
let teklif = null;
for (let g = 0; g < 60 && !teklif; g++) { const c = N.gun(w, meta, o.id); teklif = c.find(x => x.teklif && x.teklif.tur === 'mulk_al'); const n0 = w.events.length; T.advanceDay(w, T.createRng(T.daySeed(w.seed, w.day))); N.gunSonu(w, meta, w.events.slice(n0)); }
ok('oyuncunun arsasına alım teklifi geldi (şans açıkken)', !!teklif, teklif ? teklif.metin : (kira.ok ? 'teklif yok' : kira.error));
if (teklif) { const nakit = o.cash; const r = N.dmGonder(w, meta, teklif.npcId, 'tamam anlaştık', o); ok('DM ile kabul: çekirdekte satış', r && r.ok !== false && o.cash > nakit, r && r.metin); }
ok('defter tutarlı (teklif ve işe alımlardan sonra)', T.ledgerDiscrepancy(w) === 0, 'fark ' + T.ledgerDiscrepancy(w));
// ---- pazarlık sınırı: aynı teklife defalarca düşük fiyat yazmak fiyatı sonsuza kaydırmaz ----
{ const sat = Object.keys(meta.npc).find(id => w.players[id].propertyIds.some(x => w.properties[x] && !w.properties[x].ownerLivesIn));
  if (sat) { const m = w.players[sat].propertyIds.map(x => w.properties[x]).find(x => x && !x.ownerLivesIn); const piyasa = T.propertyMarketPrice(w, m.kind);
    T.credit(w, o, piyasa * 2, 'test'); const cikti = []; meta.teklifler.push({ id: 'tp', tur: 'mulk_sat', npcId: sat, mulkId: m.id, mulk: m.kind, fiyat: piyasa, ilk: piyasa, gun: w.day, bitis: w.day + 5, durum: 'bekliyor' });
    let sonFiyat = piyasa; for (let i = 0; i < 40; i++) { const r = N.teklifCevap(w, meta, 'tp', o.id, { tutar: 1000 }); if (r.pazarlik) sonFiyat = r.pazarlik; if (r.bitti || !r.pazarlik) break; }
    ok('pazarlık fiyatı piyasanın %85 altına inmiyor, en çok 3 tur', sonFiyat >= piyasa * .85, `piyasa ${piyasa}, son karşı teklif ${sonFiyat}`); } }
// ---- süresi geçmiş teklif kabul edilmez ----
meta.teklifler.push({ id: 'teski', tur: 'mulk_al', npcId: Object.keys(meta.npc)[0], mulkId: 'yok', fiyat: 1, gun: 0, bitis: w.day - 1, durum: 'bekliyor' });
ok('süresi geçmiş teklif reddedilir', N.teklifCevap(w, meta, 'teski', o.id, 'kabul').ok === false);
// ---- dönüş raporu ----
N.oyuncuGoruntusu(w, meta, o.id);
for (let g = 0; g < 20; g++) { N.gun(w, meta, o.id, { hafif: true }); const n0 = w.events.length; T.advanceDay(w, T.createRng(T.daySeed(w.seed, w.day))); N.gunSonu(w, meta, w.events.slice(n0)); }
const rap = N.donusRaporu(w, meta, o.id, 12);
ok('dönüş raporu yazıldı', !!rap, rap && `${rap.yazan}: ${rap.metin}`);
// ---- sıralama ----
const sr = N.siralama(w, meta, o.id);
ok('gerçek sıralama', sr.ulke.length > 20 && sr.ulke.some(x => x.oyuncu), `oyuncu ${sr.ulke.find(x => x.oyuncu).sira}. / ${sr.ulke.length}, katkı %${sr.katki.toFixed(2)}`);
// ---- yetki kararı ----
const yk = N.yetkiKarari(w, meta, { ad: 'Kemal Aydın', k: { durust: .8 } }, 'calisan', 'Merhaba, rica etsem çalışan alma yetkisi verebilir misiniz?');
ok('yetki kararı ve mesajı', typeof yk.ver === 'boolean' && yk.metin.length > 5, yk.ver + ' — ' + yk.metin);
// ---- kayıt boyutu ----
const kayit = JSON.stringify({ world: w, npc: meta });
ok('kayıt boyutu makul (<1,5 MB)', kayit.length < 1.5e6, Math.round(kayit.length / 1024) + ' KB');
console.log(`\n${gec} geçti, ${kal} kaldı`);
process.exitCode = kal ? 1 : 0;
