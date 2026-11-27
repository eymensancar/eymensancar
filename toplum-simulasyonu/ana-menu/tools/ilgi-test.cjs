// Oyuncu ilgisi (oyuncu-ilgi.js) ve ilgiye göre sohbet: Playwright testi.
// Sunucu: ana-menu klasöründe `python3 -m http.server 8850`, sonra `PORT=8850 node tools/ilgi-test.cjs`
// Dener: iş ilanlarına bakan oyuncu kanala girince son mesajlarda iş konusu; DM'i açmamış yeni oyuncuya DM tiyosu,
// DM açınca bir daha gelmemesi; ayar değişiminin kaydı; kayıt boyutunun sınırı; ilgi alanı olmayan eski kaydın açılması.
const pw = require('playwright');
const URL = 'http://localhost:' + (process.env.PORT || 8850) + '/index.html?anlamyok&nosplash';
let hata = 0; const ok = (ad, v, ek) => { console.log((v ? 'GEÇTİ ' : 'KALDI ') + ad + (ek ? '  (' + ek + ')' : '')); if (!v) hata++; };

async function sayfa(b) {
  const c = await b.newContext({ viewport: { width: 852, height: 393 }, hasTouch: true }); const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // Sunucu karakter kümesi göndermiyor: Türkçe harfler bozulmasın
  await p.route('**/index.html*', async r => { const res = await r.fetch(); r.fulfill({ body: '<meta charset="utf-8">' + (await res.body()).toString('utf8'), headers: { 'content-type': 'text/html; charset=utf-8' } }); });
  await p.goto(URL); await p.waitForTimeout(700);
  return { c, p, errs };
}
async function oyuncu(p, ad) { await p.fill('#kAd', ad); await p.click('#kBasla'); await p.waitForTimeout(1200); await p.evaluate(() => { SOH().onay = { s: ONAY_SURUM, t: Date.now(), yz: false }; bKapa(); }); }
/** Kanala "uzun aradan sonra" girer: son bakış 5 dk önce, öne çıkan iplik bekleme süresi sıfır. Dönen: kanalın son mesajları. */
const gir = (p, kanal, sifirla) => p.evaluate(([kanal, sifirla]) => {
  if ($('sohbet').classList.contains('acik')) sohbetKapat();
  K.npc.kanalZaman[kanal] = Date.now() - 5 * 60e3; K.ilgi.k.son = 0; if (sifirla) { K.ilgi.k.konu = {}; K.ilgi.t = {}; }
  const n0 = K.npc.kanal[kanal].length; sohbetAc(kanal); const l = K.npc.kanal[kanal];
  return { yeni: l.slice(Math.max(0, n0 - 0)).filter(m => !m.oyuncu).map(m => ({ ilgi: m.ilgi || null, iplik: m.iplik || null, ad: m.ad, npcId: m.npcId, metin: m.metin, zaman: m.zaman })), simdi: Date.now() };
}, [kanal, !!sifirla]);

(async () => {
  const b = await pw.chromium.launch();

  // ---------- 1) Ayar, ilgi, iş konusu ----------
  { const { c, p, errs } = await sayfa(b);
    await oyuncu(p, 'Deneme Oyuncu');
    const r0 = await p.evaluate(() => K.ilgi && { v: K.ilgi.v, n: K.ilgi.o.n, seri: K.ilgi.g.seri });
    ok('yeni oyuncuda ilgi kaydı başladı', r0 && r0.v === 1 && r0.n === 1 && r0.seri === 1, JSON.stringify(r0));
    // Ayarlar: tema değiştir
    await p.click('#ayarlar'); await p.waitForTimeout(200); await p.click('[data-tema="dark"]'); await p.waitForTimeout(100); await p.click('[data-tema="light"]'); await p.click('#mKapat');
    const a = await p.evaluate(() => K.ilgi.a.tema);
    ok('ayar değişimi kaydedildi', a && a[0] === 2 && a[1] === 'light', JSON.stringify(a));
    ok('ayarlar tıklaması sayıldı', await p.evaluate(() => (K.ilgi.b.ayarlar || 0) >= 1));
    // İş ilanlarına birkaç kez bak (İlanlara bak + Kariyer sekmeleri), ekranda biraz kal
    for (let i = 0; i < 3; i++) {
      await p.click('#isimAlan [data-i="0"]'); await p.waitForTimeout(700);
      await p.click('#pSekmeler [data-sk="2"]'); await p.waitForTimeout(500);
      await p.click('#pSekmeler [data-sk="1"]'); await p.waitForTimeout(500);
      await p.click('#pGeri'); await p.waitForTimeout(250);
    }
    await p.click('[data-menu="kariyer"]'); await p.waitForTimeout(300); await p.click('#pGovde [data-meslek="kurye"]'); await p.waitForTimeout(200); await p.click('#vazgec'); await p.click('#pGeri'); await p.waitForTimeout(200);
    const pr = await p.evaluate(() => { const pr = OyuncuIlgi.profil(K.ilgi, Date.now()); return { pr, e: K.ilgi.e['p:kariyer:1'], b: K.ilgi.b['meslek:kurye'] }; });
    ok('kariyer ekranı sayısı ve süresi', pr.e && pr.e[0] >= 4 && pr.e[1] > 1500, JSON.stringify(pr.e));
    ok('bakılan meslek sayıldı', pr.b === 1);
    ok('ilgi profilinde en üstte iş', pr.pr.konular[0] && pr.pr.konular[0][0] === 'is' && pr.pr.konular[0][1] >= 2, JSON.stringify(pr.pr.konular));
    // Kanala gir: son mesajlarda iş konusu (öne çıkan iplik ya da iş konulu iplikler)
    const IS = await p.evaluate(() => [...NPCYZ.ILGI_KONU.tr.is]);
    const konuOf = await p.evaluate(() => { const o = {}; NPCIplik.tr.forEach(x => o[x.id] = x.konu); (NPCIplik.ilgi.tr || []).forEach(x => o[x.id] = x.konu); return o; });
    let bulundu = null, pay = [];
    for (let d = 0; d < 6 && !bulundu; d++) {
      const g = await gir(p, 'ulke', true);
      const son = g.yeni.filter(m => g.simdi - m.zaman <= 3.5 * 60e3);
      const ilgili = son.filter(m => m.ilgi === 'is' || (m.iplik && IS.includes(konuOf[m.iplik])));
      pay.push(Math.round(ilgili.length / Math.max(1, son.filter(m => m.iplik).length) * 100));
      const one = son.filter(m => m.ilgi === 'is');
      if (one.length >= 2) bulundu = { one: one.map(m => m.ad + ': ' + m.metin).slice(0, 4), npc: one.every(m => m.ad && m.npcId), yayilma: Math.round((Math.max(...one.map(m => m.zaman)) - Math.min(...one.map(m => m.zaman))) / 1000) };
      await p.evaluate(() => sohbetKapat());
    }
    ok('iş ilanlarına bakan oyuncu kanala girince son mesajlarda iş konusu', !!bulundu, bulundu ? bulundu.one.join(' | ') : 'yok');
    if (bulundu) { ok('ilgi ipliğini farklı NPC\'ler yazdı, son dakikalara yayıldı', bulundu.npc && bulundu.yayilma >= 20, bulundu.yayilma + ' sn'); }
    console.log('  kanalda ilgiyle ilgili iplik mesajı payı (%):', pay.join(', '));
    // Öne çıkan iplik her girişte değil: bekleme süresi dolmadan yeniden girince gelmez
    const t1 = await p.evaluate(() => { K.npc.kanalZaman.ulke = Date.now() - 5 * 60e3; K.ilgi.k.son = Date.now(); const n0 = K.npc.kanal.ulke.length; sohbetAc('ulke'); const y = K.npc.kanal.ulke.slice(n0).filter(m => m.ilgi); sohbetKapat(); return y.length; });
    ok('bekleme süresi dolmadan öne çıkan ilgi ipliği gelmez', t1 === 0, t1 + ' mesaj');
    // Şirket kanalında ilgi yok; global kanalda İngilizce ilgi iplikleri
    let gl = null; for (let d = 0; d < 6 && !gl; d++) { const g = await gir(p, 'global', true); const x = g.yeni.filter(m => m.ilgi); if (x.length) gl = x; await p.evaluate(() => sohbetKapat()); }
    ok('global kanalda da ilgi ipliği (İngilizce)', gl && gl.every(m => !/[çğışöüÇĞİŞÖÜ]/.test(m.metin)), gl ? gl.slice(0, 2).map(m => m.metin).join(' | ') : 'yok');
    // "Biri DM'den eleman arar": iş arayan oyuncuya işletme sahibi özelden gerçek teklif yazar
    const tk = await p.evaluate(() => { const c = NPCYZ.ilgiIsTeklifi(K.world, K.npc, G().p); const t = c && NPCYZ.bekleyenTeklifler(K.world, K.npc).find(x => x.id === (c.teklif || {}).id); return c ? { baslik: c.baslik, metin: c.metin, teklif: !!t, ikinci: !!NPCYZ.ilgiIsTeklifi(K.world, K.npc, G().p) } : null; });
    ok('iş arayana özelden gerçek iş teklifi (aynı anda ikincisi yok)', tk && tk.teklif && !tk.ikinci, tk ? tk.baslik + ': ' + tk.metin : 'yok');
    ok('kayıt K.ilgi cihazda, gönderim kuyruğunda yok', await p.evaluate(() => !JSON.stringify(SOH().yzKuyruk || []).includes('kariyer')));
    ok('sayfa hatası yok (1)', !errs.length, errs.join(' | '));
    await c.close(); }

  // ---------- 2) DM tiyosu ----------
  { const { c, p, errs } = await sayfa(b);
    await oyuncu(p, 'Yeni Oyuncu');
    // Kurye ol, 3 görev yap: kariyer, görev ve günlük tiyoları kendiliğinden düşer; sıradaki DM tiyosu
    await p.evaluate(() => { eylem({ tur: 'meslek_sec', meslek: 'kurye' }, 1); for (let i = 0; i < 3; i++) eylem({ tur: 'gorev_yap' }, 1); K.ilgi.ilk = Date.now() - 10 * 60e3; });
    const bek = await p.evaluate(() => OyuncuIlgi.profil(K.ilgi, Date.now()).bekleyenTiyo);
    ok('yapılanlar tiyo listesinden düştü (kariyer, görev, günlük)', !bek.includes('tiyo-kariyer') && !bek.includes('tiyo-gorev') && !bek.includes('tiyo-gunluk') && bek[0] === 'tiyo-dm', bek.join(','));
    let dm = null;
    for (let d = 0; d < 8 && !dm; d++) { const g = await gir(p, 'ulke', true); const x = g.yeni.filter(m => m.ilgi === 'tiyo-dm'); if (x.length >= 2) dm = x; await p.evaluate(() => sohbetKapat()); }
    ok('DM açmamış yeni oyuncuya DM/telefon tiyosu geldi', !!dm, dm ? dm.map(m => m.ad + ': ' + m.metin).join(' | ') : 'yok');
    ok('tiyo gerçek arayüzü söylüyor (ada dokun / sağ alttaki telefon / Mesajlar)', dm && dm.some(m => /dokun|bas/i.test(m.metin)) && dm.some(m => /sağ alt|mesajlar|özel mesaj gönder/i.test(m.metin)));
    // DM aç: artık DM tiyosu gelmez (bekleme sayaçları sıfırlansa da)
    await p.evaluate(() => { const id = Object.keys(K.npc.npc).find(i => K.world.players[i]); sohbetAc({ dm: id }); sohbetKapat(); });
    ok('DM açılınca yapıldı sayıldı', await p.evaluate(() => !!K.ilgi.y.dm));
    let tekrar = 0, baska = 0;
    for (let d = 0; d < 8; d++) { const g = await gir(p, 'ulke', true); tekrar += g.yeni.filter(m => m.ilgi === 'tiyo-dm').length; baska += g.yeni.filter(m => m.ilgi && m.ilgi.startsWith('tiyo-') && m.ilgi !== 'tiyo-dm').length; await p.evaluate(() => sohbetKapat()); }
    ok('DM açtıktan sonra DM tiyosu gelmez', tekrar === 0, tekrar + ' mesaj; başka tiyo mesajı ' + baska);
    // İki haftadan sonra tiyolar seyrekleşir: yeniden gösterim bekleme süresi uzar
    const sey = await p.evaluate(() => { K.ilgi.ilk = Date.now() - 20 * 864e5; let n = 0; const d = { patron: false, issiz: false, gorevli: true, kursta: false, kum: 1 };
      for (let i = 0; i < 400; i++) { K.ilgi.k.son = 0; const y = OyuncuIlgi.karar(K.ilgi, Date.now(), 'ulke', true, d, null, Math.random); if (y && y.one && y.one.startsWith('tiyo-')) n++; }
      K.ilgi.ilk = Date.now() - 10 * 60e3; let m = 0; for (let i = 0; i < 400; i++) { K.ilgi.k.son = 0; K.ilgi.t = {}; const y = OyuncuIlgi.karar(K.ilgi, Date.now(), 'ulke', true, d, null, Math.random); if (y && y.one && y.one.startsWith('tiyo-')) m++; } return [m, n]; });
    ok('iki haftadan sonra tiyolar seyrek', sey[1] < sey[0] * .5, 'ilk iki hafta ' + sey[0] + '/400, sonra ' + sey[1] + '/400');
    ok('sayfa hatası yok (2)', !errs.length, errs.join(' | '));
    // ---------- 3) Kayıt boyutu ----------
    const boy = await p.evaluate(() => { const r = K.ilgi, IL = OyuncuIlgi; let t = Date.now();
      const yerler = ['e:ana', 'e:sirket', 'p:kariyer:1', 'p:kariyer:2', 'p:kariyer:kurs', 'p:banka', 'p:mulk', 'u:ana', 'u:Mesajlar', 'u:Bankam', 's:ulke', 's:global', 's:dm'];
      for (let i = 0; i < 5000; i++) { t += 1500; if (i % 3) IL.yer(r, t, yerler[i % yerler.length]); else IL.bak(r, t, 'deneme:' + (i % 300), ['is', 'kredi', 'mulk', null][i % 4]); if (i % 97 === 0) IL.ayar(r, t, 'ses' + (i % 5), i); if (i % 500 === 0) { IL.oturumBitir(r, t); t += 6 * 60e3; IL.oturumBasla(r, t); } }
      kaydet(); return { boyut: IL.boyut(r), halka: r.s.length, anahtar: Object.keys(r.b).length, yer: Object.keys(r.e).length, depo: localStorage.getItem(ANAHTAR).length }; });
    ok('kayıt boyutu sınırlı (5000 olaydan sonra)', boy.boyut < 6000 && boy.halka <= 40 && boy.anahtar <= 64, JSON.stringify(boy));
    // ---------- 4) Eski kayıt ----------
    await p.evaluate(() => { delete K.ilgi; kaydet(); });
    await p.reload(); await p.waitForTimeout(1200);
    const es = await p.evaluate(() => ({ var: !!K.ilgi, v: K.ilgi && K.ilgi.v, y: K.ilgi && Object.keys(K.ilgi.y), n: K.ilgi && K.ilgi.o.n }));
    ok('ilgi alanı olmayan eski kayıt hatasız açıldı, yapılanlar durumdan çıkarıldı', es.var && es.v === 1 && es.y.includes('kariyer') && es.y.includes('gorev') && es.y.includes('gunluk') && es.n === 1, JSON.stringify(es));
    await p.evaluate(() => { K.ilgi = { v: 1, o: { n: 'x' }, s: 5 }; kaydet(); });
    await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(() => { sohbetAc('ulke'); sohbetKapat(); panelAc('banka'); panelKapat(); });
    ok('bozuk ilgi alanıyla da açılıyor', await p.evaluate(() => Array.isArray(K.ilgi.s) && typeof K.ilgi.e === 'object'));
    ok('sayfa hatası yok (3)', !errs.length, errs.join(' | '));
    await c.close(); }

  await b.close(); console.log(hata ? `\n${hata} KALDI` : '\nHepsi GEÇTİ'); process.exit(hata ? 1 : 0);
})();
