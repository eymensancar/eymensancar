/* =====================================================================
   Toplum Simülasyonu — NPC YAPAY ZEKÂSI ("beyin")
   ---------------------------------------------------------------------
   NPC'ler Amca'nın ekonomi çekirdeğinde (toplum-cekirdek.js) GERÇEK oyuncu
   olarak yaşar: aynı 100.000 TL ile başlar, aynı meslek/kurs/mülk/kredi
   kurallarına uyar, maaşları ve giderleri aynı ay sonu hesabından geçer.
   Para hiçbir zaman elle yaratılmaz; her şey çekirdeğin işlemleriyle olur
   (defter tutarlı kalır: ledgerDiscrepancy = 0).

   Katmanlar
   1. Kimlik       : ad, soyad / takma ad, yer, arketip, kişilik (14 özellik),
                     konuşma üslubu, günlük düzen (hangi saatlerde aktif).
   2. Karar motoru : her gün görev; birkaç günde bir "fayda" hesabıyla
                     kariyer, kurs, işletme, ev, yatırım, kredi, bağış, satış.
                     Hedef mesleğe giden yolu planlar (kurs → deneyim → sermaye).
   3. Duygu ve hafıza : ruh hali (olaylarla iner/çıkar), oyuncuyla ilişki
                     (sevgi, güven, tanışıklık, konuşulan konular, hakaret).
   4. Toplum       : sohbet kanallarına kendiliğinden yazma (kendi gerçek
                     olaylarından), birbirine cevap, oyuncuya cevap (niyet
                     anlama + gerçek veriyle tavsiye), özel mesajlar.
   5. Ekonomik ilişkiler : oyuncunun ilanına başvuru ve pazarlık, oyuncunun
                     şirketinde çalışma (moral, zam isteği, istifa), oyuncuya
                     iş teklifi, mülk alım/satım teklifi, yetki kararları.
   6. Yönetici (oyun dengeleyici) : NPC harcama eğilimini ayda en çok %3
                     oynatarak ekonomiyi dengeler; oyuncu zarar edince
                     "gizli şans" penceresi açar (yalnız NPC davranışıyla:
                     daha iyi aday, daha iyi teklif — asla bedava para yok);
                     oyuncu uzun süre yokken vekil müdür NPC dönüşte rapor yazar.

   Dil (anlama ve cümle kurma) npc-dil.js içinde (NPCDil).
   Tarayıcıda: <script src="toplum-cekirdek.js">, <script src="npc-dil.js">,
   <script src="npc-yz.js">. Node'da: require ile (testler: tools/npc-test.cjs).
   Kural: NPC asla "ben gerçek insanım" demez (Eymen'in kararı).
   ===================================================================== */
(function () {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : this;
  let T = G.Toplum, D = G.NPCDil;
  const NPCYZ = { surum: 1 };

  // ------------------------------------------------------------------
  // Yardımcılar
  // ------------------------------------------------------------------
  const sinir = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sigmoid = x => 1 / (1 + Math.exp(-x));
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const rngYap = seed => T.createRng(seed >>> 0);
  function agirlikliSec(rng, liste, w) { let top = 0; const ws = liste.map(x => { const v = Math.max(0, w(x)); top += v; return v; }); if (top <= 0) return null; let r = rng.next() * top; for (let i = 0; i < liste.length; i++) { r -= ws[i]; if (r <= 0) return liste[i]; } return liste[liste.length - 1]; }
  const paraYaz = tl => (tl < 0 ? '−' : '') + Math.round(Math.abs(tl)).toLocaleString('tr-TR') + ' ₺';
  const C = () => T.config;
  const gunAy = gun => Math.floor(gun / 30);
  const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  // Dil motoru yoksa (yüklenemediyse) en basit yedek; oyun yine çalışır.
  const YEDEK_DIL = {
    normal: m => { const k = String(m || '').toLocaleLowerCase('tr'); return { ham: m, kucuk: k, katli: k, kelimeler: k.split(/\s+/) }; },
    dilBul: () => 'tr',
    niyetBul: m => ({ niyet: /merhaba|selam/i.test(m) ? 'selam' : 'genel', guven: .3, soru: /\?/.test(m), kufur: false, varlik: {} }),
    uret: (a, s) => (s && s.ad ? s.ad + ': ' : '') + ({ 'cevap.selam': 'Merhaba!', 'cevap.genel': 'Anladım.' }[a] || '🙂'),
    stillendir: m => m,
    veri: { erkekAdlari: ['Ali', 'Mehmet', 'Can', 'Emre', 'Burak'], kadinAdlari: ['Ayşe', 'Zeynep', 'Elif', 'Selin', 'Derya'], soyadlari: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik'], yerler: [{ sehir: 'İstanbul', ilce: 'Kadıköy' }], yabanci: {} },
    takmaAd: (a, s) => (a + '_' + s).toLowerCase(),
    ek: { de: s => s + "'de", e: s => s + "'e", den: s => s + "'den", in: s => s + "'in", i: s => s + "'i", le: s => s + "'le" },
  };
  const dil = () => (D && D.uret ? D : YEDEK_DIL);

  /** Bağımlılıkları sonradan ver (Node testleri için). */
  NPCYZ.bagla = function (toplum, npcDil) { if (toplum) T = toplum; if (npcDil) D = npcDil; };

  // ------------------------------------------------------------------
  // 1. KİMLİK: arketipler ve kişilik
  // ------------------------------------------------------------------
  // Özellikler 0..1. Arketip ortalama verir, her NPC'ye ±gürültü eklenir.
  const OZELLIKLER = ['caliskan', 'hirs', 'risk', 'tutum', 'comert', 'sosyal', 'mizah', 'resmi', 'emoji', 'kisaltma', 'hata', 'sadakat', 'sabir', 'durust'];
  const ARKETIP = {
    caliskan_genc: { ad: 'Çalışkan ve hevesli', hedef: 'kariyer', k: { caliskan: .85, hirs: .7, risk: .45, tutum: .55, comert: .35, sosyal: .6, mizah: .55, resmi: .25, emoji: .6, kisaltma: .55, hata: .3, sadakat: .5, sabir: .45, durust: .7 } },
    temkinli_memur: { ad: 'Temkinli, güvenli iş ister', hedef: 'guvenli', k: { caliskan: .7, hirs: .4, risk: .15, tutum: .8, comert: .4, sosyal: .4, mizah: .3, resmi: .75, emoji: .2, kisaltma: .1, hata: .1, sadakat: .8, sabir: .7, durust: .85 } },
    girisimci: { ad: 'Girişimci, kendi işini kurmak ister', hedef: 'girisimci', k: { caliskan: .75, hirs: .9, risk: .75, tutum: .5, comert: .35, sosyal: .7, mizah: .5, resmi: .45, emoji: .4, kisaltma: .3, hata: .2, sadakat: .35, sabir: .4, durust: .65 } },
    yatirimci: { ad: 'Parayı mülke yatırır', hedef: 'yatirimci', k: { caliskan: .6, hirs: .7, risk: .55, tutum: .75, comert: .3, sosyal: .45, mizah: .35, resmi: .6, emoji: .25, kisaltma: .15, hata: .1, sadakat: .5, sabir: .8, durust: .6 } },
    usta_eli: { ad: 'Elinden iş gelir, ustalaşmak ister', hedef: 'usta', k: { caliskan: .8, hirs: .6, risk: .45, tutum: .6, comert: .5, sosyal: .5, mizah: .6, resmi: .3, emoji: .3, kisaltma: .5, hata: .45, sadakat: .65, sabir: .55, durust: .8 } },
    sosyal_kelebek: { ad: 'Konuşkan, herkesle arkadaş', hedef: 'kariyer', k: { caliskan: .5, hirs: .45, risk: .4, tutum: .35, comert: .6, sosyal: .95, mizah: .85, resmi: .15, emoji: .85, kisaltma: .7, hata: .4, sadakat: .5, sabir: .5, durust: .7 } },
    sessiz: { ad: 'Az konuşur, işini yapar', hedef: 'guvenli', k: { caliskan: .75, hirs: .45, risk: .3, tutum: .7, comert: .45, sosyal: .15, mizah: .25, resmi: .55, emoji: .1, kisaltma: .3, hata: .2, sadakat: .75, sabir: .75, durust: .85 } },
    keyfine_dusk: { ad: 'Rahat, keyfine düşkün', hedef: 'rahat', k: { caliskan: .35, hirs: .25, risk: .5, tutum: .2, comert: .55, sosyal: .7, mizah: .8, resmi: .1, emoji: .7, kisaltma: .75, hata: .55, sadakat: .4, sabir: .3, durust: .6 } },
    hirsli_kariyer: { ad: 'Hırslı, en yükseğe oynar', hedef: 'kariyer', k: { caliskan: .9, hirs: .95, risk: .6, tutum: .6, comert: .2, sosyal: .5, mizah: .3, resmi: .6, emoji: .2, kisaltma: .2, hata: .1, sadakat: .3, sabir: .35, durust: .55 } },
    hayirsever: { ad: 'Yardımsever, bağış yapar', hedef: 'guvenli', k: { caliskan: .65, hirs: .4, risk: .3, tutum: .55, comert: .95, sosyal: .65, mizah: .5, resmi: .5, emoji: .5, kisaltma: .2, hata: .15, sadakat: .8, sabir: .7, durust: .95 } },
  };
  const ARKETIP_AGIRLIK = { caliskan_genc: 14, temkinli_memur: 12, girisimci: 10, yatirimci: 7, usta_eli: 11, sosyal_kelebek: 10, sessiz: 12, keyfine_dusk: 9, hirsli_kariyer: 7, hayirsever: 5 };
  // Hedefe göre ilgilenilen meslekler ve kurslar (sırayla).
  const HEDEF = {
    kariyer: { meslekler: ['muhasebeci', 'memur', 'emlak_danismani', 'nakliyeci'], kurslar: ['muhasebe', 'kamu_sinavi', 'emlak_belgesi'] },
    guvenli: { meslekler: ['memur', 'muhasebeci'], kurslar: ['kamu_sinavi', 'muhasebe'] },
    girisimci: { meslekler: ['dukkan_sahibi', 'kafe_sahibi', 'ithalat_ihracat', 'doviz_burosu_sahibi', 'fabrikator'], kurslar: ['muhasebe', 'dis_ticaret', 'doviz_lisansi'] },
    yatirimci: { meslekler: ['emlak_danismani', 'emlak_ofisi_sahibi'], kurslar: ['emlak_belgesi'] },
    usta: { meslekler: ['usta', 'tasaron', 'muteahhit'], kurslar: ['ustalik', 'muteahhitlik'] },
    rahat: { meslekler: ['nakliyeci'], kurslar: [] },
  };
  const ILK_IS = { kariyer: ['kurye', 'garson', 'market_calisani'], guvenli: ['market_calisani', 'garson', 'kurye'], girisimci: ['kurye', 'market_calisani'], yatirimci: ['kurye', 'garson'], usta: ['insaat_iscisi'], rahat: ['garson', 'kurye', 'market_calisani'] };

  // Günlük düzen: gerçek saat (0-23) için aktiflik eğrisi. Herkesin bir "kronotipi" var.
  const DUZEN = {
    sabahci: [0, 0, 0, 0, 0, .1, .4, .8, .9, .7, .5, .5, .6, .5, .4, .4, .5, .6, .7, .6, .4, .2, .1, 0],
    aksamci: [.2, .1, 0, 0, 0, 0, 0, .1, .2, .3, .3, .4, .5, .4, .4, .5, .6, .7, .9, 1, 1, .9, .7, .4],
    gececi: [.6, .5, .4, .2, .1, 0, 0, 0, .1, .2, .3, .3, .4, .3, .3, .4, .4, .5, .6, .7, .8, .9, 1, .9],
    duzenli: [0, 0, 0, 0, 0, 0, .1, .3, .6, .6, .5, .5, .8, .6, .5, .5, .5, .6, .8, .9, .8, .5, .2, .1],
  };

  /** Dil verisindeki il kaydını {sehir, ilce} biçimine çevirir (eski kayıtlar için de). */
  function yerDuzelt(y, rng) { if (!y) return { sehir: 'İstanbul', ilce: 'Kadıköy' }; if (y.sehir) return y; const ilceler = y.ilceler || []; return { sehir: y.ad || 'İstanbul', ilce: ilceler.length ? ilceler[Math.floor((rng ? rng.next() : .5) * ilceler.length)] : '' }; }
  function kimlikUret(rng, yabanci) {
    const v = dil().veri;
    const kadin = rng.chance(.5);
    let ad = rng.pick(kadin ? v.kadinAdlari : v.erkekAdlari), soyad = rng.pick(v.soyadlari);
    // Tanınmış biriyle aynı ad-soyad çıkmasın
    for (let i = 0; i < 10 && dil().kimlikUygun && !dil().kimlikUygun(ad, soyad); i++) soyad = rng.pick(v.soyadlari);
    const arketip = agirlikliSec(rng, Object.keys(ARKETIP), a => ARKETIP_AGIRLIK[a]);
    const k = {};
    for (const o of OZELLIKLER) k[o] = sinir(ARKETIP[arketip].k[o] + (rng.next() - .5) * .3, 0, 1);
    // Yer: oyuncular çoğunlukla İstanbul'da (oyunun başladığı şehir), kalanı diğer illerde.
    const iller = v.yerler, il = rng.chance(.6) ? (iller.find(x => (x.ad || x.sehir) === 'İstanbul') || rng.pick(iller)) : rng.pick(iller);
    const yer = yerDuzelt(il, rng);
    // Görünen ad: çoğu "Ad Soyad", bir kısmı "Ad S." ya da takma ad (gerçek sunucudaki gibi karışık).
    const r = rng.next();
    const gorunen = r < .55 ? ad + ' ' + soyad : r < .75 ? ad + ' ' + soyad[0] + '.' : (dil().takmaAd || YEDEK_DIL.takmaAd)(ad, soyad, rng);
    return {
      ad, soyad, gorunen, kadin, arketip, hedef: ARKETIP[arketip].hedef, k, yer,
      kronotip: rng.pick(Object.keys(DUZEN)),
      ascii: rng.chance(.15 + k.kisaltma * .2),
      ruh: (k.mizah - .5) * .4, // -1..1
      // Bir meslekte en az kaç gün kalır, hedefi ne kadar cesur
      sabirGun: Math.round(lerp(10, 45, k.sadakat)),
    };
  }

  // ------------------------------------------------------------------
  // Kurulum: NPC'leri dünyaya ekle, isteğe bağlı "ön yaşam" simülasyonu
  // ------------------------------------------------------------------
  /**
   * @param world çekirdek dünyası
   * @param ops {sayi=70, tohum, onYasamGun=0, yabanciSayi=40}
   * @returns meta (K.npc olarak saklanır)
   */
  NPCYZ.kur = function (world, ops = {}) {
    const tohum = ops.tohum ?? (world.seed ^ 0x5eed);
    const rng = rngYap(tohum);
    const meta = {
      surum: 1, tohum, npc: {}, yabanci: [], iliski: {}, kanal: { global: [], ulke: [], sirket: [] }, dm: {}, teklifler: [],
      basvuru: [], olayKuyrugu: [], haber: [], kanalZaman: {}, sans: { bitis: -1, guc: 0 },
      yonetici: { harcama: 1, sonAy: -1, sonPara: null, gecmis: [] }, mudur: {}, oyuncuOnce: null, sayac: 0, nufusHedef: ops.sayi ?? 70,
    };
    const ilk = Math.round((ops.sayi ?? 70) * (ops.onYasamGun ? .55 : 1));
    for (let i = 0; i < ilk; i++) npcEkle(world, meta, rng);
    for (let i = 0; i < (ops.yabanciSayi ?? 40); i++) meta.yabanci.push(yabanciUret(rng, i));
    // Ön yaşam: oyuncu gelmeden önce dünya bir süre yaşar (kariyerler, işletmeler, evler oluşur).
    if (ops.onYasamGun) {
      for (let g = 0; g < ops.onYasamGun; g++) {
        // nüfus zamanla artar: sunucuya yeni katılanlar
        if (Object.keys(meta.npc).length < meta.nufusHedef && rng.chance(.35)) npcEkle(world, meta, rng);
        NPCYZ.gun(world, meta, null, { hafif: true });
        world.events = world.events.slice(-200); const n0 = world.events.length;
        T.advanceDay(world, T.createRng(T.daySeed(world.seed, world.day)));
        NPCYZ.gunSonu(world, meta, world.events.slice(n0));
      }
      meta.kanal = { global: [], ulke: [], sirket: [] }; meta.olayKuyrugu = meta.olayKuyrugu.slice(-30); meta.haber = [];
    }
    return meta;
  };

  function npcEkle(world, meta, rng) {
    // Aynı görünen ad iki kez olmasın: önce yeni bir kimlik dener, sayı eklemek son çare.
    const adlar = new Set(Object.values(world.players).map(p => p.name));
    let kim = kimlikUret(rng);
    for (let i = 0; i < 25 && adlar.has(kim.gorunen); i++) kim = kimlikUret(rng);
    let gorunen = kim.gorunen, n = 2; while (adlar.has(gorunen)) gorunen = kim.gorunen + ' ' + (n++);
    const p = T.addPlayer(world, gorunen);
    kim.gorunen = gorunen; kim.id = p.id; kim.katildi = world.day;
    kim.sonKarar = world.day - Math.floor(rng.next() * 7); kim.sonPaylasim = -1; kim.ayBasiNakit = p.cash; kim.sonGelir = 0;
    kim.gecmis = []; kim.istenmeyen = {};
    meta.npc[p.id] = kim;
    // İlk iş: hemen bir başlangıç işine girer (oyuncu gibi).
    const ilk = rng.pick(ILK_IS[kim.hedef] || ILK_IS.kariyer);
    T.takeProfession(world, p.id, ilk);
    return kim;
  }

  function yabanciUret(rng, i) {
    const v = dil().veri.yabanci || {};
    const diller = Object.keys(v).length ? Object.keys(v) : ['en'];
    const d = diller[i % diller.length], vv = v[d] || { adlar: ['Alex'], soyadlar: ['Smith'], sehirler: ['London'] };
    const ad = rng.pick(vv.adlar), soyad = rng.pick(vv.soyadlar || ['']);
    const sehir = rng.pick(vv.sehirler || ['']);
    const kim = kimlikUret(rng); // kişilik için
    return { id: 'y' + i, dil: d, gorunen: rng.chance(.5) ? ad + ' ' + soyad : (ad + '_' + sehir.slice(0, 3)).replace(/\s/g, '').toLowerCase(), sehir, k: kim.k, kronotip: kim.kronotip, servetUsd: Math.round(Math.exp(rng.between(Math.log(3000), Math.log(4e6)))) };
  }

  // ------------------------------------------------------------------
  // 2. KARAR MOTORU
  // ------------------------------------------------------------------
  /** Bir NPC'nin bir meslekten bekleyebileceği aylık net gelir (kendi çalışkanlığıyla). */
  function beklenenGelir(world, kim, profId) {
    const prof = T.getProfession(profId);
    const gunler = 30 * lerp(.55, .97, kim.k.caliskan);
    const gorev = Math.min(prof.maxTasksPerDay || 0, Math.round(lerp(1, 5, kim.k.caliskan)));
    const pi = world.priceIndex;
    switch (prof.earning) {
      case 'task': return ((prof.payPerTask || 0) * gorev * gunler - (profId === 'nakliyeci' ? C().VEHICLE_MONTHLY_UPKEEP : 0)) * pi;
      case 'salary': return (prof.monthlySalary || 0) * pi;
      case 'salary+task': return ((prof.monthlySalary || 0) + (prof.payPerTask || 0) * gorev * gunler) * pi;
      case 'salary+commission': return ((prof.monthlySalary || 0) + (prof.commission ? prof.commission.amount * prof.commission.chancePerTask * gorev * gunler : 0)) * pi;
      case 'business': return T.estimateBusinessMonthlyProfit(world, prof.business, Math.round(lerp(1, 3, kim.k.caliskan)));
    }
    return 0;
  }
  NPCYZ.beklenenGelir = beklenenGelir;
  const aylikIhtiyac = world => T.monthlyLivingCost(world) + T.monthlyRoomRent(world);
  const evdeMi = (world, p) => p.propertyIds.some(id => world.properties[id] && world.properties[id].ownerLivesIn);

  /** Şu anki işinden aylık gelir tahmini (oyuncunun işletmesinde çalışıyorsa maaşı). */
  function suAnkiGelir(world, kim, p) {
    if (!p.profession) return 0;
    if (p.employerBusinessId) { const b = world.businesses[p.employerBusinessId]; return b ? (b.employees[p.id] || 0) : 0; }
    if (p.businessIds.length) return p.businessIds.reduce((t, id) => { const b = world.businesses[id]; return t + (b ? T.estimateBusinessMonthlyProfit(world, b.type, 2) : 0); }, 0);
    return beklenenGelir(world, kim, p.profession);
  }
  NPCYZ.suAnkiGelir = (world, meta, id) => { const kim = meta.npc[id], p = world.players[id]; return kim && p ? suAnkiGelir(world, kim, p) : 0; };

  /**
   * Bir oyun günü (çekirdeğin advanceDay'inden ÖNCE çağrılır).
   * @param oyuncuId oyuncunun id'si (yoksa null)
   * @param ops {hafif:true} uzun yokluk/ön yaşamda sohbet olayı üretmez
   * @returns olaylar: [{tur, npcId, ...}] arayüz için (haber, DM, bildirim)
   */
  NPCYZ.gun = function (world, meta, oyuncuId, ops = {}) {
    const rng = rngYap(T.daySeed(world.seed, world.day) ^ 0x9e3779b1);
    const cikti = [];
    const yon = meta.yonetici;
    // Yeni katılanlar: nüfus hedefine kadar yavaşça büyür.
    if (Object.keys(meta.npc).length < meta.nufusHedef && rng.chance(.08)) { const k = npcEkle(world, meta, rng); if (!ops.hafif) olay(meta, k.id, 'katildi', {}); }
    const oyuncu = oyuncuId ? world.players[oyuncuId] : null;
    for (const id in meta.npc) {
      const kim = meta.npc[id], p = world.players[id];
      if (!p) continue;
      if (!kim.yer || !kim.yer.sehir) kim.yer = yerDuzelt(kim.yer, rng);
      // Bugün oyuna girdi mi? (çalışkanlık + rastgele; hafta içi/sonu farkı yok, oyun günü kısa)
      const aktif = rng.chance(lerp(.45, .97, kim.k.caliskan));
      if (aktif) gorevYap(world, kim, p, rng);
      // Stratejik karar: birkaç günde bir (herkes aynı gün değil)
      const aralik = Math.round(lerp(9, 4, kim.k.hirs));
      if (aktif && world.day - kim.sonKarar >= aralik) { kim.sonKarar = world.day; stratejikKarar(world, meta, kim, p, rng, yon, cikti, ops); }
      if (aktif && p.businessIds.length) isverenGunu(world, meta, kim, p, rng, ops);
      // Oyuncunun şirketinde çalışıyorsa: moral, zam isteği, istifa
      if (oyuncu && p.employerBusinessId && world.businesses[p.employerBusinessId] && world.businesses[p.employerBusinessId].ownerId === oyuncuId) calisanGunu(world, meta, kim, p, oyuncu, rng, cikti);
      // Ruh hali yavaşça kendi doğasına döner
      kim.ruh = lerp(kim.ruh, (kim.k.mizah - .5) * .4, .05);
    }
    // Ay sonu (advanceDay bu günün sonunda ayı kapatacaksa): NPC'ler ay sonunu "hisseder"
    if ((world.day + 1) % 30 === 0) aySonuHazirlik(world, meta);
    // Oyuncuya yönelik ekonomik davranışlar (teklifler, başvurular) — yalnız oyuncu varken
    if (oyuncu && !ops.hafif) oyuncuyaYonelik(world, meta, oyuncu, rng, cikti);
    // Yönetici: ayda bir dengeleme
    if (gunAy(world.day) !== yon.sonAy) yoneticiAyBasi(world, meta);
    return cikti;
  };

  function gorevYap(world, kim, p, rng) {
    if (!p.profession) {
      // İşsiz (ör. işletmesi kapandı): en iyi uygun 1. kademe işe gir.
      const secenek = C().PROFESSIONS.filter(m => m.tier === 1 && T.missingRequirements(world, p.id, m.id).length === 0);
      const en = secenek.sort((a, b) => beklenenGelir(world, kim, b.id) - beklenenGelir(world, kim, a.id))[0];
      if (en) T.takeProfession(world, p.id, en.id);
      return;
    }
    const prof = T.getProfession(p.profession);
    const max = prof.earning === 'business' ? 3 : (prof.maxTasksPerDay || 0);
    if (!max) return;
    // Para sıkıntısındaki daha çok çalışır; ruh hali kötüyse biraz az.
    const baski = p.mustWork || p.cash < aylikIhtiyac(world) ? .25 : 0;
    const hedef = Math.round(max * sinir(kim.k.caliskan + baski + kim.ruh * .1 + (rng.next() - .5) * .3, 0, 1));
    for (let i = 0; i < hedef; i++) if (!T.doTask(world, p.id, rng).ok) break;
  }

  /** Fayda tabanlı karar: olası her hamleye puan ver, en iyisini (eşiği geçerse) yap. */
  function stratejikKarar(world, meta, kim, p, rng, yon, cikti, ops) {
    if (!p.profession) return;
    const ihtiyac = aylikIhtiyac(world);
    // Tasarruf tamponu: tutumlu olan daha çok ay biriktirir. Yönetici harcama eğilimiyle oynar.
    const tampon = ihtiyac * lerp(1.5, 5, kim.k.tutum) / yon.harcama;
    const blok = p.mustWork || p.arrears > 0;
    const hamleler = [];
    const simdiki = suAnkiGelir(world, kim, p);
    const hedefler = HEDEF[kim.hedef] || HEDEF.kariyer;

    // Kum Saati: kurs sürüyorsa harca
    if (p.courseInProgress && p.hourglasses > 0) T.useHourglasses(world, p.id, p.hourglasses);

    // a) Daha iyi meslek (işletme sahibi değilse ya da daha üst işletme)
    if (!blok || !p.businessIds.length) {
      for (const m of C().PROFESSIONS) {
        if (m.id === p.profession) continue;
        if (p.businessIds.length && (m.earning !== 'business' || m.tier <= T.getProfession(p.profession).tier)) continue;
        if (p.employerBusinessId && kim.calisan) continue; // oyuncunun yanında çalışan kendi kendine iş değiştirmez (ayrılmayı moral sistemi yönetir)
        for (const kredili of m.earning === 'business' ? [false, true] : [false]) {
          if (T.missingRequirements(world, p.id, m.id, { useLoan: kredili }).length) continue;
          if (kredili && kim.k.risk < .5) continue;
          const gerek = m.requirements.capital ? T.requiredCash(world, m.id, kredili) : 0;
          if (gerek && p.cash < gerek + tampon * (kredili ? .6 : 1)) continue;
          const gelir = beklenenGelir(world, kim, m.id);
          const kidem = world.day - p.professionSince < kim.sabirGun ? .25 : 0; // yeni başladığı işi hemen bırakmaz
          const hedefte = hedefler.meslekler.includes(m.id) ? .25 : 0;
          const artis = simdiki > 0 ? gelir / simdiki - 1 : 1;
          const puan = artis * lerp(.8, 1.6, kim.k.hirs) + hedefte - kidem - (m.earning === 'business' ? lerp(.5, .05, kim.k.risk) : 0) - (kredili ? .2 : 0);
          if (artis > .12) hamleler.push({ tur: 'meslek', id: m.id, kredili, puan });
        }
      }
    }
    // b) Kurs: hedef yolundaki ilk eksik kurs
    if (!p.courseInProgress && !blok) {
      const kurs = hedefler.kurslar.find(c => !p.completedCourses.includes(c));
      if (kurs) {
        const maliyet = T.indexed(world, T.getCourse(kurs).cost);
        if (p.cash > maliyet + tampon) hamleler.push({ tur: 'kurs', id: kurs, puan: .35 + kim.k.hirs * .5 });
      }
    }
    // c) Ev: kendi evi yoksa (girişimci önce işletme için biriktirir)
    const ev = evdeMi(world, p), fiyatD = T.propertyMarketPrice(world, 'daire'), pesinat = fiyatD - Math.round(fiyatD * C().MORTGAGE_MAX_LTV);
    const isletmeIcinBiriktiriyor = kim.hedef === 'girisimci' && !p.businessIds.length;
    if (!ev && !blok && !isletmeIcinBiriktiriyor) {
      if (p.cash > fiyatD + tampon) hamleler.push({ tur: 'ev', kredili: false, puan: .5 + kim.k.tutum * .3 });
      else if (p.cash > pesinat + tampon && kim.k.risk > .3 && p.lastMonthIncome > 0) hamleler.push({ tur: 'ev', kredili: true, puan: .3 + kim.k.risk * .3 });
    }
    // d) Yatırım: evi olan yatırımcı/zengin kiralık daire, arsa
    if (ev && !blok && (kim.hedef === 'yatirimci' || p.cash > fiyatD * 3)) {
      if (p.cash > fiyatD + tampon * 1.5) hamleler.push({ tur: 'yatirim', mulk: 'daire', puan: .25 + kim.k.risk * .4 });
      const fA = T.propertyMarketPrice(world, 'arsa');
      if (p.cash > fA + tampon * 1.5) hamleler.push({ tur: 'yatirim', mulk: rng.chance(.5) ? 'arsa' : 'dukkan', puan: .15 + kim.k.risk * .4 });
    }
    // e) Borç kapama (tutumlu, nakit bol)
    const kisisel = p.loans.filter(l => l.monthlyPayment > 0);
    if (kisisel.length && p.cash > tampon * 2 && kim.k.tutum > .55) hamleler.push({ tur: 'borc', puan: .2 + kim.k.tutum * .3 });
    // f) Bağış: cömert ve rahat, bayramlarda daha çok
    const ozel = ozelGun(world.day);
    if (p.cash > tampon * 2 && kim.k.comert > .5) hamleler.push({ tur: 'bagis', puan: kim.k.comert * .3 + (ozel && ozel.bayram ? .4 : 0) - .15 });
    // g) Kriz: para bitti / ay sonunu çıkaramayacak → mülk sat (önce arsa, sonra kiradaki)
    if ((p.mustWork || p.cash < ihtiyac * .5) && p.propertyIds.length) hamleler.push({ tur: 'sat', puan: 1.5 });
    // h) Riskçi: hedefe az kaldıysa ihtiyaç kredisi
    const limit = Math.round(p.lastMonthIncome * (p.creditScore / 100));
    if (!blok && kim.k.risk > .7 && limit > 20000 && !p.loans.length && p.cash < tampon) hamleler.push({ tur: 'kredi', tutar: Math.min(limit, Math.round(tampon)), puan: (kim.k.risk - .7) * 1.5 });

    hamleler.sort((a, b) => b.puan - a.puan);
    const en = hamleler[0];
    if (!en || en.puan < .1) return;
    let r = null;
    switch (en.tur) {
      case 'meslek': {
        const eski = p.profession;
        r = T.takeProfession(world, p.id, en.id, { useLoan: en.kredili });
        if (r.ok) { const m = T.getProfession(en.id); kimHafiza(kim, world, 'meslek', en.id); if (m.earning === 'business') olay(meta, p.id, 'isletme_acti', { isletme: m.business }); else olay(meta, p.id, 'is_degisti', { meslek: en.id, eski }); kim.ruh = sinir(kim.ruh + .35, -1, 1); }
        break;
      }
      case 'kurs': r = T.enrollCourse(world, p.id, en.id); if (r.ok) olay(meta, p.id, 'kurs_basladi', { kurs: en.id }); break;
      case 'ev': r = T.buyProperty(world, p.id, 'daire', { useLoan: en.kredili, liveIn: true }); if (r.ok) { olay(meta, p.id, 'mulk_aldi', { mulk: 'daire', ev: true }); kim.ruh = sinir(kim.ruh + .4, -1, 1); } break;
      case 'yatirim': r = T.buyProperty(world, p.id, en.mulk, {}); if (r.ok) olay(meta, p.id, 'mulk_aldi', { mulk: en.mulk }); break;
      case 'borc': { const l = kisisel.sort((a, b) => b.monthlyRate - a.monthlyRate)[0]; r = T.repayLoan(world, p.id, l.id, Math.min(l.remaining, Math.round(p.cash - tampon * 1.5))); break; }
      case 'bagis': { const t = Math.round(sinir(p.cash * .02 * kim.k.comert, 1000, 250000) / 1000) * 1000; r = T.donate(world, p.id, t, { holiday: !!(ozel && ozel.bayram) }); if (r.ok) olay(meta, p.id, 'bagis', { tutar: t }); break; }
      case 'sat': {
        const ms = p.propertyIds.map(id => world.properties[id]).filter(Boolean).sort((a, b) => (a.ownerLivesIn - b.ownerLivesIn) || (a.kind === 'arsa' ? -1 : 1));
        if (ms[0]) { r = T.sellPropertyToNpc(world, p.id, ms[0].id); if (r.ok) { olay(meta, p.id, 'mulk_satti', { mulk: ms[0].kind }); kim.ruh = sinir(kim.ruh - .3, -1, 1); } }
        break;
      }
      case 'kredi': r = T.takePersonalLoan(world, p.id, en.tutar); if (r.ok) olay(meta, p.id, 'kredi_cekti', {}); break;
    }
  }

  /**
   * NPC patronlar da eleman alır: kadrolarını başka NPC'lerle doldururlar (gerçek iş piyasası).
   * Çoğu işletme bir kadroyu açık tutar (ilanı sürer); oyuncu da bu açıklara başvurabilir.
   */
  function isverenGunu(world, meta, kim, p, rng, ops) {
    for (const bid of p.businessIds) {
      const b = world.businesses[bid]; if (!b) continue;
      const def = T.getBusinessDef(b.type), ml = C().BUSINESS_STAFF_PROFESSIONS[b.type] || [];
      const tavan = def.staffNeeded - (hash(b.id) % 3 === 0 ? 0 : 1);
      if (Object.keys(b.employees).length >= tavan || !rng.chance(.12)) continue;
      if (b.cash < T.indexed(world, def.minWage) && p.cash < T.indexed(world, def.minWage) * 3) continue; // parası yoksa almaz
      let en = null;
      for (const id in meta.npc) {
        if (id === p.id) continue;
        const q = world.players[id]; if (!q || q.businessIds.length || q.employerBusinessId || q.courseInProgress) continue;
        const meslek = ml.includes(q.profession) ? q.profession : ml.find(m => T.getProfession(m).tier === 1 && T.missingRequirements(world, id, m).length === 0);
        if (!meslek) continue;
        const maas = isverenMaasi(world, kim, b, meslek), simdi = suAnkiGelir(world, meta.npc[id], q);
        if (maas < simdi * .95 && !q.mustWork) continue;
        const puan = (q.experience[meslek] || 0) / 30 + meta.npc[id].k.caliskan + (q.mustWork ? 1 : 0) + rng.next() * .5;
        if (!en || puan > en.puan) en = { id, meslek, maas, puan };
      }
      if (!en) continue;
      const q = world.players[en.id];
      if (q.profession !== en.meslek && !T.takeProfession(world, en.id, en.meslek).ok) continue;
      if (T.hireEmployee(world, p.id, b.id, en.id, en.maas).ok) { kimHafiza(meta.npc[en.id], world, 'ise_girdi', b.id); if (!ops.hafif) olay(meta, en.id, 'is_degisti', { meslek: en.meslek }); }
    }
  }

  function kimHafiza(kim, world, tur, deger) { kim.gecmis.push({ gun: world.day, tur, deger }); if (kim.gecmis.length > 20) kim.gecmis.shift(); }

  /** NPC'nin kendi hayatından bir olay: sohbet paylaşımı ve haber için kuyruğa girer. */
  function olay(meta, npcId, tur, veri) {
    meta.olayKuyrugu = meta.olayKuyrugu.filter(o => !(o.npcId === npcId && o.tur === tur));
    meta.olayKuyrugu.push({ npcId, tur, veri, gun: null });
    if (meta.olayKuyrugu.length > 80) meta.olayKuyrugu.splice(0, meta.olayKuyrugu.length - 80);
    if (['isletme_acti', 'mulk_aldi', 'isletme_kapandi', 'katildi'].includes(tur)) { meta.haber.push({ npcId, tur, veri }); if (meta.haber.length > 40) meta.haber.shift(); }
  }

  function aySonuHazirlik(world, meta) {
    // Ay kapanmadan önceki nakit: ay sonu "iyi geçti / kötü geçti" duygusu için
    for (const id in meta.npc) { const p = world.players[id]; if (p) meta.npc[id].ayOnceNakit = p.cash + p.pendingEarnings; }
    meta.ayKapanacak = true;
  }

  /** advanceDay'den SONRA çağrılır: ay kapandıysa duyguları ve paylaşımları güncelle. */
  NPCYZ.gunSonu = function (world, meta, yeniOlaylar) {
    // Çekirdeğin NPC'ler için yazdığı olaylar (kurs bitti, satış primi, icra...) paylaşım kuyruğuna
    (yeniOlaylar || []).forEach(e => { const kim = e.playerId && meta.npc[e.playerId]; if (!kim) return;
      if (e.kind === 'kurs_bitti') { const p = world.players[e.playerId]; olay(meta, e.playerId, 'kurs_bitti', { kurs: p && p.completedCourses[p.completedCourses.length - 1] }); kim.ruh = sinir(kim.ruh + .3, -1, 1); }
      else if (e.kind === 'komisyon') kim.ruh = sinir(kim.ruh + .2, -1, 1);
      else if (e.kind === 'icra' || e.kind === 'para_bitti') { kim.ruh = sinir(kim.ruh - .5, -1, 1); olay(meta, e.playerId, 'ay_sonu_kotu', {}); }
      else if (e.kind === 'isletme_kapandi') olay(meta, e.playerId, 'isletme_kapandi', {}); });
    if (!meta.ayKapanacak) return;
    meta.ayKapanacak = false;
    for (const id in meta.npc) {
      const kim = meta.npc[id], p = world.players[id];
      if (!p || kim.ayOnceNakit == null) continue;
      const fark = p.cash - kim.ayOnceNakit + p.pendingEarnings; // pending sıfırlanır, nakde geçer
      kim.sonGelir = p.lastMonthIncome;
      const iyi = p.lastMonthIncome > aylikIhtiyac(world) * 1.2;
      kim.ruh = sinir(kim.ruh + (iyi ? .2 : -.25) + (p.mustWork ? -.4 : 0), -1, 1);
      if (rngYap(hash(id + world.day)).chance(.25)) olay(meta, id, iyi ? 'ay_sonu_iyi' : 'ay_sonu_kotu', { tutar: p.lastMonthIncome });
      void fark;
    }
  };

  // ------------------------------------------------------------------
  // 6. YÖNETİCİ (oyun dengeleyici) ve GİZLİ ŞANS
  // ------------------------------------------------------------------
  function yoneticiAyBasi(world, meta) {
    const y = meta.yonetici; y.sonAy = gunAy(world.day);
    // Kişi başı para: hızlı büyüyorsa NPC'ler biraz daha harcar (mülk, bağış), düşüyorsa biraz daha biriktirir.
    const ps = Object.values(world.players);
    const para = ps.reduce((t, p) => t + p.cash, 0) / Math.max(1, ps.length);
    if (y.sonPara != null && y.sonPara > 0) {
      const buyume = para / y.sonPara - 1; // aylık
      const hedef = .01; // aylık %1 civarı sağlıklı
      const adim = sinir((buyume - hedef) * .5, -.03, .03); // en çok %3 (Eymen: "maksimum %2-3")
      y.harcama = sinir(y.harcama * (1 + adim), .8, 1.25);
    }
    y.sonPara = para; y.gecmis.push({ ay: y.sonAy, para: Math.round(para), harcama: y.harcama, endeks: +world.priceIndex.toFixed(4) }); if (y.gecmis.length > 36) y.gecmis.shift();
  }
  /** Gizli şans: oyuncu zarar ettiğinde ya da parası bittiğinde bir süre NPC'ler ona daha iyi davranır. */
  NPCYZ.sansAc = function (world, meta, gun, guc = .5) { meta.sans = { bitis: world.day + gun, guc: sinir(guc, 0, 1) }; };
  const sansGucu = (world, meta) => (meta.sans && meta.sans.bitis >= world.day ? meta.sans.guc : 0);
  NPCYZ.sansGucu = sansGucu;

  // ------------------------------------------------------------------
  // 5. EKONOMİK İLİŞKİLER: başvurular, teklifler, çalışanlar
  // ------------------------------------------------------------------
  function iliski(meta, npcId) { return meta.iliski[npcId] || (meta.iliski[npcId] = { sevgi: 0, guven: .3, mesaj: 0, tanir: false, konular: [], hakaret: 0, son: -1 }); }
  NPCYZ.iliski = iliski;

  function oyuncuyaYonelik(world, meta, oyuncu, rng, cikti) {
    const sans = sansGucu(world, meta);
    // Bekleyen teklifler: süresi dolanları kaldır
    meta.teklifler = meta.teklifler.filter(t => t.bitis >= world.day && t.durum === 'bekliyor');
    // 1) Oyuncunun mülkleri için alım teklifi (kiradaki/arsa; nadiren; şansla daha sık ve daha iyi)
    const satilabilir = oyuncu.propertyIds.map(id => world.properties[id]).filter(m => m && !m.ownerLivesIn);
    if (satilabilir.length && rng.chance(.02 + sans * .06) && !meta.teklifler.some(t => t.tur === 'mulk_al')) {
      const m = rng.pick(satilabilir), piyasa = T.propertyMarketPrice(world, m.kind);
      const alici = agirlikliSec(rng, Object.keys(meta.npc), id => { const p = world.players[id]; return p && p.cash > piyasa * 1.1 && !p.mustWork ? meta.npc[id].k.risk + .1 : 0; });
      if (alici) {
        const fiyat = Math.round(piyasa * (1 + rng.between(-.04, .04) + sans * .08) / 1000) * 1000;
        teklifYap(world, meta, cikti, { tur: 'mulk_al', npcId: alici, mulkId: m.id, mulk: m.kind, fiyat, sure: 5 });
      }
    }
    // 2) İş teklifi: oyuncu bir çalışan mesleğindeyse ve bir NPC işletmesinde açık kadro varsa (şansla daha sık)
    if (!oyuncu.businessIds.length && oyuncu.profession && rng.chance(.012 + sans * .05) && !meta.teklifler.some(t => t.tur === 'is')) {
      const isletmeler = Object.values(world.businesses).filter(b => meta.npc[b.ownerId] && (C().BUSINESS_STAFF_PROFESSIONS[b.type] || []).includes(oyuncu.profession) && Object.keys(b.employees).length < T.getBusinessDef(b.type).staffNeeded && b.id !== oyuncu.employerBusinessId);
      if (isletmeler.length) {
        const b = rng.pick(isletmeler), simdi = oyuncuGelir(world, oyuncu);
        const maas = Math.max(T.indexed(world, C().MIN_WAGE), Math.round(Math.max(simdi * rng.between(1.05, 1.25 + sans * .2), T.indexed(world, T.getBusinessDef(b.type).minWage) * 1.1) / 500) * 500);
        teklifYap(world, meta, cikti, { tur: 'is', npcId: b.ownerId, isletmeId: b.id, isletme: b.type, meslek: oyuncu.profession, maas, sure: 6 });
      }
    }
    // 3) Oyuncu "mülk arıyorum" dediyse ya da şansla: NPC kiradaki dairesini/arsasını satmayı teklif eder
    if (meta.mulkArayan && meta.mulkArayan.bitis >= world.day && rng.chance(.3)) {
      const tur = meta.mulkArayan.mulk;
      const satan = agirlikliSec(rng, Object.keys(meta.npc), id => { const p = world.players[id]; return p && p.propertyIds.some(x => world.properties[x] && !world.properties[x].ownerLivesIn && (!tur || world.properties[x].kind === tur)) ? 1 : 0; });
      if (satan) {
        const m = world.players[satan].propertyIds.map(x => world.properties[x]).find(x => x && !x.ownerLivesIn && (!tur || x.kind === tur));
        const fiyat = Math.round(T.propertyMarketPrice(world, m.kind) * (1 + rng.between(-.03, .06) - sans * .06) / 1000) * 1000;
        teklifYap(world, meta, cikti, { tur: 'mulk_sat', npcId: satan, mulkId: m.id, mulk: m.kind, fiyat, sure: 5 });
        meta.mulkArayan = null;
      }
    }
  }
  function oyuncuGelir(world, p) {
    if (!p.profession) return 0;
    const prof = T.getProfession(p.profession);
    if (p.employerBusinessId) { const b = world.businesses[p.employerBusinessId]; return b ? (b.employees[p.id] || 0) : 0; }
    return T.indexed(world, (prof.monthlySalary || 0) + (prof.payPerTask || 0) * (prof.maxTasksPerDay || 0) * 24);
  }

  function teklifYap(world, meta, cikti, t) {
    t.id = 't' + (++meta.sayac); t.gun = world.day; t.ilk = t.fiyat || t.maas; t.tur_sayisi = 0; t.bitis = world.day + (t.sure || 5); t.durum = 'bekliyor';
    meta.teklifler.push(t);
    const kim = meta.npc[t.npcId];
    const anahtar = t.tur === 'is' ? 'dm.is_teklifi' : t.tur === 'mulk_al' ? 'dm.mulk_teklifi' : 'dm.mulk_teklifi';
    const metin = konus(world, meta, kim, anahtar, { isletme: isletmeAdi(t.isletme), meslek: meslekAdi(t.meslek), tutar: paraYaz(t.fiyat || t.maas), mulk: mulkAdi(t.mulk) }, rngYap(hash(t.id)));
    const ek = t.tur === 'mulk_sat' ? ` (${mulkAdi(t.mulk)} satıyor: ${paraYaz(t.fiyat)})` : '';
    dmEkle(meta, t.npcId, { kimden: 'npc', metin: metin + ek, gun: world.day, teklif: t.id });
    cikti.push({ tur: 'dm', npcId: t.npcId, baslik: 'Yeni mesaj: ' + kim.gorunen, metin: metin + ek, teklif: t });
  }

  /** Teklife oyuncunun cevabı: 'kabul' | 'red' | {tutar} (pazarlık). Çekirdekte gerçek işlemi yapar. */
  NPCYZ.teklifCevap = function (world, meta, teklifId, oyuncuId, cevap) {
    const t = meta.teklifler.find(x => x.id === teklifId);
    if (!t || t.durum !== 'bekliyor' || t.bitis < world.day) { if (t && t.durum === 'bekliyor') t.durum = 'gecti'; return { ok: false, mesaj: 'Bu teklifin süresi geçmiş.' }; }
    if ((t.tur === 'mulk_al' || t.tur === 'mulk_sat') && cevap !== 'red') { const m = world.properties[t.mulkId]; if (!m || m.ownerId !== (t.tur === 'mulk_al' ? oyuncuId : t.npcId) || m.ownerLivesIn) { t.durum = 'gecti'; return { ok: false, mesaj: 'Bu mülk artık satışa uygun değil (sahibi değişmiş ya da içinde oturuluyor).' }; } }
    if (t.tur === 'is' && cevap !== 'red') { const b = world.businesses[t.isletmeId]; if (!b || Object.keys(b.employees).length >= T.getBusinessDef(b.type).staffNeeded) { t.durum = 'gecti'; return { ok: false, mesaj: 'Bu iş artık boşta değil.' }; } }
    const kim = meta.npc[t.npcId], rng = rngYap(hash(t.id + JSON.stringify(cevap)));
    const il = iliski(meta, t.npcId);
    if (cevap === 'red') { t.durum = 'red'; il.sevgi = sinir(il.sevgi - .02, -1, 1); const m = konus(world, meta, kim, 'dm.mulk_teklif_red', {}, rng); dmEkle(meta, t.npcId, { kimden: 'npc', metin: m, gun: world.day }); return { ok: true, mesaj: m }; }
    let fiyat = t.fiyat || t.maas;
    if (cevap && typeof cevap === 'object' && cevap.tutar) {
      // Pazarlık: NPC'nin sabrı ve oyuncuyla ilişkisi kadar esner.
      const esneme = lerp(.02, .09, kim.k.sabir) + il.sevgi * .03 + sansGucu(world, meta) * .04;
      const yon = t.tur === 'mulk_al' ? 1 : t.tur === 'is' ? 1 : -1; // mulk_al: oyuncu daha yüksek ister; is: oyuncu daha yüksek maaş ister; mulk_sat: oyuncu daha düşük ister
      const sinirFiyat = Math.round((t.ilk || fiyat) * (1 + yon * esneme));
      t.tur_sayisi = (t.tur_sayisi || 0) + 1;
      if (t.tur_sayisi > 3) { t.durum = 'red'; const m0 = konus(world, meta, kim, 'dm.mulk_teklif_red', {}, rng); dmEkle(meta, t.npcId, { kimden: 'npc', metin: m0, gun: world.day }); return { ok: true, mesaj: m0, bitti: true }; }
      const istenen = cevap.tutar;
      const kabul = yon > 0 ? istenen <= sinirFiyat : istenen >= sinirFiyat;
      if (!kabul) { const karsi = Math.round(lerp(t.ilk || fiyat, sinirFiyat, .7) / 500) * 500; t.fiyat ? (t.fiyat = karsi) : (t.maas = karsi); const m = konus(world, meta, kim, 'dm.basvuru_pazarlik', { tutar: paraYaz(karsi) }, rng); dmEkle(meta, t.npcId, { kimden: 'npc', metin: m, gun: world.day, teklif: t.id }); return { ok: true, pazarlik: karsi, mesaj: m }; }
      fiyat = istenen; if (t.fiyat) t.fiyat = fiyat; else t.maas = fiyat;
    }
    let r;
    if (t.tur === 'mulk_al') r = T.sellPropertyToPlayer(world, oyuncuId, t.npcId, t.mulkId, fiyat);
    else if (t.tur === 'mulk_sat') r = T.sellPropertyToPlayer(world, t.npcId, oyuncuId, t.mulkId, fiyat);
    else if (t.tur === 'is') { const o0 = world.players[oyuncuId]; if (o0.profession !== t.meslek) { if (o0.businessIds.length) return { ok: false, mesaj: 'İşletme sahibiyken başkasının yanında çalışamazsın.' }; const r0 = T.takeProfession(world, oyuncuId, t.meslek); if (!r0.ok) return { ok: false, mesaj: T.sunucuMetni ? T.sunucuMetni(r0.error) : r0.error }; }
      const o = world.players[oyuncuId], eski = o.employerBusinessId, eskiMaas = eski && world.businesses[eski] ? world.businesses[eski].employees[oyuncuId] : null; if (eski) T.leaveEmployer(world, oyuncuId); r = T.hireEmployee(world, t.npcId, t.isletmeId, oyuncuId, fiyat); if (!r.ok && eski && world.businesses[eski]) { world.businesses[eski].employees[oyuncuId] = eskiMaas; o.employerBusinessId = eski; } }
    if (!r || !r.ok) return { ok: false, mesaj: T.sunucuMetni ? T.sunucuMetni(r ? r.error : 'İşlem yapılamadı.') : (r && r.error) };
    if (t.tur === 'mulk_al' || t.tur === 'mulk_sat') { const m = world.properties[t.mulkId]; if (m) m.ownerLivesIn = false; }
    t.durum = 'kabul'; il.sevgi = sinir(il.sevgi + .1, -1, 1); il.guven = sinir(il.guven + .1, 0, 1);
    const m = konus(world, meta, kim, 'dm.mulk_teklif_kabul', {}, rng);
    dmEkle(meta, t.npcId, { kimden: 'npc', metin: m, gun: world.day });
    if (t.tur !== 'is') olay(meta, t.npcId, t.tur === 'mulk_al' ? 'mulk_aldi' : 'mulk_satti', { mulk: t.mulk });
    return { ok: true, mesaj: m, islem: t.tur };
  };
  NPCYZ.bekleyenTeklifler = (world, meta) => meta.teklifler.filter(t => t.durum === 'bekliyor' && t.bitis >= world.day);

  // ---- Oyuncunun iş ilanına başvurular ----
  /**
   * Her oyun günü açık ilanlar için çağrılır.
   * ilan = {id, meslek (çekirdek meslek id), maas, poz}
   * @returns yeni başvurular [{id, ilanId, npcId, ad, deneyim, itibar, maas (istediği), alt (gizli kabul sınırı)}]
   */
  NPCYZ.basvurular = function (world, meta, oyuncu, ilanlar, mevcut, tohumEk = 0) {
    const rng = rngYap((T.daySeed(world.seed, world.day) ^ 0xb45) + tohumEk);
    const b = oyuncu.businessIds.length ? world.businesses[oyuncu.businessIds[oyuncu.businessIds.length - 1]] : null;
    if (!b) return [];
    if (Object.keys(b.employees).length >= T.getBusinessDef(b.type).staffNeeded) return [];
    const sans = sansGucu(world, meta), yeni = [];
    for (const ilan of ilanlar) {
      if (mevcut.filter(x => x.ilanId === ilan.id).length >= 5) continue;
      const uygun = Object.keys(meta.npc).filter(id => {
        const p = world.players[id]; if (!p || p.businessIds.length) return false;
        if (mevcut.some(x => x.npcId === id) || yeni.some(x => x.npcId === id)) return false;
        if (p.employerBusinessId === b.id) return false;
        return p.profession === ilan.meslek || (T.getProfession(ilan.meslek).tier === 1 && p.profession && T.getProfession(p.profession).tier === 1 && T.missingRequirements(world, id, ilan.meslek).length === 0);
      });
      for (const id of uygun) {
        const kim = meta.npc[id], p = world.players[id], simdi = Math.max(1, suAnkiGelir(world, kim, p));
        const cekicilik = ilan.maas / simdi; // 1'den büyükse kârlı
        if (cekicilik < .85 - sans * .15 && !p.mustWork && p.cash > aylikIhtiyac(world)) continue; // daha iyi kazanan düşük maaşa başvurmaz
        const itibar = sinir(oyuncu.reputation / 50, -.5, .5);
        const ihtimal = sigmoid((cekicilik - 1) * 5 + itibar + iliski(meta, id).sevgi * 2 + sans * 1.5 - 1.5) * .35;
        if (!rng.chance(ihtimal)) continue;
        const istek = Math.round(Math.max(ilan.maas * lerp(.95, 1.15, kim.k.hirs) * (1 - sans * .08), simdi * lerp(1, 1.15, kim.k.hirs)) / 500) * 500;
        const alt = Math.round(Math.max(T.indexed(world, C().MIN_WAGE), Math.min(istek, simdi * lerp(1.05, .9, kim.k.sabir) * (1 - sans * .1))) / 500) * 500;
        yeni.push({ id: 'b' + (++meta.sayac), ilanId: ilan.id, meslekIlan: ilan.meslek, npcId: id, ad: kim.gorunen, deneyim: p.experience[ilan.meslek] || 0, toplamDeneyim: p.totalExperienceDays, itibar: p.reputation, maas: istek, alt, meslek: p.profession, calisiyor: !!p.profession });
        if (yeni.filter(x => x.ilanId === ilan.id).length >= 2) break;
      }
    }
    return yeni;
  };

  /** Sohbette "ben varım" diyen NPC'nin başvuru kaydı (ilanın maaşına ve kendi kazancına göre istek). */
  NPCYZ.basvuruKaydi = function (world, meta, npcId, ilan) {
    const kim = meta.npc[npcId], p = world.players[npcId]; if (!kim || !p) return null;
    const simdi = Math.max(1, suAnkiGelir(world, kim, p)), sans = sansGucu(world, meta);
    const istek = Math.round(Math.max(ilan.maas * lerp(.95, 1.15, kim.k.hirs) * (1 - sans * .08), simdi * lerp(1, 1.15, kim.k.hirs)) / 500) * 500;
    const alt = Math.round(Math.max(T.indexed(world, C().MIN_WAGE), Math.min(istek, simdi * lerp(1.05, .9, kim.k.sabir) * (1 - sans * .1))) / 500) * 500;
    return { id: 'b' + (++meta.sayac), ilanId: ilan.id, meslekIlan: ilan.meslek, npcId, ad: kim.gorunen, deneyim: p.experience[ilan.meslek] || 0, toplamDeneyim: p.totalExperienceDays, itibar: p.reputation, maas: istek, alt, meslek: p.profession, calisiyor: !!p.profession, sohbetten: true };
  };

  /** Başvurana iş teklifi: maaş alt sınırın altındaysa pazarlık eder. Kabul ederse çekirdekte işe alır. */
  NPCYZ.iseAl = function (world, meta, oyuncuId, basvuru, teklifMaas) {
    const kim = meta.npc[basvuru.npcId], p = world.players[basvuru.npcId], o = world.players[oyuncuId];
    if (!kim || !p) return { ok: false, mesaj: 'Aday artık yok.' };
    const b = o && o.businessIds.length ? world.businesses[o.businessIds[o.businessIds.length - 1]] : null;
    if (!b) return { ok: false, mesaj: 'İşe almak için bir işletmen olmalı.' };
    const def = T.getBusinessDef(b.type);
    if (Object.keys(b.employees).length >= def.staffNeeded) return { ok: false, mesaj: 'Kadro dolu. Önce birini çıkar ya da ilanı kapat.' };
    const mes = basvuru.meslekIlan || p.profession;
    if (!(C().BUSINESS_STAFF_PROFESSIONS[b.type] || []).includes(mes)) return { ok: false, mesaj: 'Bu meslek bu işletmeye uygun değil.' };
    if (teklifMaas < T.indexed(world, def.minWage)) return { ok: false, mesaj: 'Maaş asgari ücretin altında olamaz.' };
    if (p.businessIds.length) return { ok: false, mesaj: kim.gorunen + ' artık kendi işini yürütüyor.' };
    const rng = rngYap(hash(basvuru.id + teklifMaas));
    if (teklifMaas < basvuru.alt) {
      const karsi = Math.round(lerp(basvuru.alt, basvuru.maas, .5) / 500) * 500;
      basvuru.maas = karsi;
      return { ok: false, pazarlik: karsi, mesaj: konus(world, meta, kim, 'dm.basvuru_pazarlik', { tutar: paraYaz(karsi) }, rng) };
    }
    if (p.employerBusinessId) T.leaveEmployer(world, p.id);
    if (p.profession !== basvuru.meslekIlan && basvuru.meslekIlan) { const r0 = T.takeProfession(world, p.id, basvuru.meslekIlan); if (!r0.ok) return { ok: false, mesaj: T.sunucuMetni(r0.error) }; }
    const r = T.hireEmployee(world, oyuncuId, b.id, p.id, teklifMaas);
    if (!r.ok) return { ok: false, mesaj: T.sunucuMetni(r.error) };
    kim.calisan = { moral: sinir(.6 + (teklifMaas / Math.max(1, basvuru.maas) - 1) + kim.k.sadakat * .2, 0, 1), basladi: world.day, sonZamIstegi: world.day, istifa: null, dusukGun: 0 };
    const il = iliski(meta, p.id); il.sevgi = sinir(il.sevgi + .15, -1, 1); il.tanir = true;
    const m = konus(world, meta, kim, 'dm.ise_basladim', { isletme: isletmeAdi(b.type), oyuncuAd: o.name.split(' ')[0] }, rng);
    dmEkle(meta, p.id, { kimden: 'npc', metin: m, gun: world.day });
    olay(meta, p.id, 'is_degisti', { meslek: p.profession, oyuncuyla: true });
    return { ok: true, mesaj: m };
  };
  NPCYZ.basvuruReddet = function (world, meta, basvuru) {
    const kim = meta.npc[basvuru.npcId]; if (!kim) return;
    const il = iliski(meta, basvuru.npcId); il.sevgi = sinir(il.sevgi - .03, -1, 1);
    if (kim.k.sosyal > .6 && rngYap(hash(basvuru.id)).chance(.5)) dmEkle(meta, basvuru.npcId, { kimden: 'npc', metin: konus(world, meta, kim, 'dm.basvuru_red', {}, rngYap(hash(basvuru.id + 'r'))), gun: world.day });
  };

  // ---- Oyuncunun şirketindeki NPC çalışanlar ----
  /** Çalışanın piyasa değeri: başka yerde kazanabileceği en iyi (şartını tuttuğu, işletme dışı) gelir. */
  function piyasaDegeri(world, kim, p) {
    let en = 0;
    for (const m of C().PROFESSIONS) { if (m.earning === 'business') continue; if (T.missingRequirements(world, p.id, m.id).length) continue; en = Math.max(en, beklenenGelir(world, kim, m.id)); }
    return Math.max(en, T.indexed(world, C().MIN_WAGE));
  }
  NPCYZ.piyasaDegeri = (world, meta, id) => piyasaDegeri(world, meta.npc[id], world.players[id]);

  function calisanGunu(world, meta, kim, p, oyuncu, rng, cikti) {
    const b = world.businesses[p.employerBusinessId];
    if (!kim.calisan) kim.calisan = { moral: .6, basladi: world.day, sonZamIstegi: world.day, istifa: null, dusukGun: 0 };
    const c = kim.calisan, maas = b.employees[p.id] || 0, deger = piyasaDegeri(world, kim, p);
    const il = iliski(meta, p.id);
    // Moral hedefi: maaş / piyasa değeri, ilişki, ruh hali; zamanla oraya yaklaşır.
    const oran = maas / Math.max(1, deger);
    const hedef = sinir(.55 + (oran - 1) * 1.2 + il.sevgi * .25 + kim.ruh * .1 + kim.k.sadakat * .15, 0, 1);
    c.moral = lerp(c.moral, hedef, .08);
    c.dusukGun = c.moral < .3 ? c.dusukGun + 1 : Math.max(0, c.dusukGun - 1);
    // Zam isteği: moral düşük ve son istekten 12 gün geçti
    if (c.moral < .42 && world.day - c.sonZamIstegi >= 12 && !c.istifa) {
      c.sonZamIstegi = world.day;
      const istek = Math.round(Math.max(deger, maas * 1.1) / 500) * 500;
      c.zamIstegi = { tutar: istek, gun: world.day };
      const m = konus(world, meta, kim, 'dm.zam_istegi', { tutar: paraYaz(istek) }, rng);
      dmEkle(meta, p.id, { kimden: 'npc', metin: m, gun: world.day, zam: istek });
      cikti.push({ tur: 'dm', npcId: p.id, baslik: kim.gorunen + ' zam istiyor', metin: m });
    }
    // İstifa: uzun süre çok düşük moral → 3 gün önceden haber verir
    const istekBekliyor = c.zamIstegi && world.day - c.zamIstegi.gun >= 5;
    if (!c.istifa && ((istekBekliyor && c.dusukGun >= 4) || c.dusukGun >= 15) && rng.chance(.25 * (1 - kim.k.sadakat * .6))) {
      c.istifa = world.day + 3;
      const m = konus(world, meta, kim, 'dm.istifa', { gun: '3' }, rng);
      dmEkle(meta, p.id, { kimden: 'npc', metin: m, gun: world.day });
      cikti.push({ tur: 'dm', npcId: p.id, baslik: kim.gorunen + ' istifa ediyor', metin: m, onemli: true });
    }
    if (c.istifa && world.day >= c.istifa) {
      if (c.moral >= .45) { c.istifa = null; c.dusukGun = 0; dmEkle(meta, p.id, { kimden: 'npc', metin: konus(world, meta, kim, 'dm.zam_tesekkur', {}, rng), gun: world.day }); }
      else { T.leaveEmployer(world, p.id); kim.calisan = null; il.sevgi = sinir(il.sevgi - .2, -1, 1); cikti.push({ tur: 'haber', npcId: p.id, baslik: 'Çalışanın ayrıldı', metin: kim.gorunen + ' işten ayrıldı.' }); olay(meta, p.id, 'is_degisti', { meslek: p.profession, ayrildi: true }); }
    }
    // Ara sıra patrona kısa rapor (sosyal ve moral iyi olanlar)
    if (c.moral > .7 && kim.k.sosyal > .55 && rng.chance(.03)) dmEkle(meta, p.id, { kimden: 'npc', metin: konus(world, meta, kim, 'dm.calisan_rapor', { isletme: isletmeAdi(b.type) }, rng), gun: world.day });
  }

  /** Oyuncu bir NPC çalışanın maaşını değiştirdi (arayüz çekirdekte business.employees'i günceller, sonra bunu çağırır). */
  NPCYZ.maasDegisti = function (world, meta, npcId, eski, yeni) {
    const kim = meta.npc[npcId]; if (!kim) return null;
    if (!kim.calisan) kim.calisan = { moral: .6, basladi: world.day, sonZamIstegi: world.day, istifa: null, dusukGun: 0 };
    const c = kim.calisan, il = iliski(meta, npcId), rng = rngYap(hash(npcId + world.day + yeni));
    const oran = yeni / Math.max(1, eski) - 1;
    c.moral = sinir(c.moral + oran * 2.2, 0, 1); il.sevgi = sinir(il.sevgi + oran * 1.5, -1, 1);
    if (oran > 0 && c.istifa && c.moral > .4) c.istifa = null;
    if (c.zamIstegi && yeni >= c.zamIstegi.tutar) c.zamIstegi = null;
    if (oran < 0) c.sonZamIstegi = Math.min(c.sonZamIstegi, world.day - 10); // kesintiden 2 gün sonra konuşur
    const m = konus(world, meta, kim, oran >= 0 ? 'dm.zam_tesekkur' : 'dm.maas_dusurme_tepki', {}, rng);
    dmEkle(meta, npcId, { kimden: 'npc', metin: m, gun: world.day });
    return m;
  };
  NPCYZ.cikarildi = function (world, meta, npcId) {
    const kim = meta.npc[npcId]; if (!kim) return null;
    T.leaveEmployer(world, npcId); kim.calisan = null;
    const il = iliski(meta, npcId); il.sevgi = sinir(il.sevgi - .35, -1, 1); il.guven = sinir(il.guven - .2, 0, 1);
    kim.ruh = sinir(kim.ruh - .4, -1, 1);
    // Diğer çalışanların morali de biraz düşer
    for (const id in meta.npc) if (meta.npc[id].calisan && world.players[id] && world.players[id].employerBusinessId) meta.npc[id].calisan.moral = sinir(meta.npc[id].calisan.moral - .05, 0, 1);
    const m = konus(world, meta, kim, 'dm.isten_cikarildi', {}, rngYap(hash(npcId + 'kov' + world.day)));
    dmEkle(meta, npcId, { kimden: 'npc', metin: m, gun: world.day });
    return m;
  };

  /** Yetki talebi: şirketin kurucusu NPC ise karar verir (güvene, ilişkiye ve yetkinin ağırlığına göre). */
  const YETKI_AGIRLIK = { proje: .2, calisan: .45, maas: .55, yetki: .8 };
  NPCYZ.yetkiKarari = function (world, meta, kurucu, yetki, mesaj) {
    // kurucu: {id?, k?} (yerel demo kurucusu bir profil taşımayabilir)
    const kim = (kurucu.id && meta.npc[kurucu.id]) || kurucu;
    const il = iliski(meta, kurucu.id || 'kurucu:' + (kurucu.ad || ''));
    const nazik = D && D.niyetBul ? (/rica|lütfen|lutfen|mümkünse|mumkunse|teşekkür|tesekkur/i.test(mesaj) ? .12 : 0) : 0;
    const puan = .55 + il.guven * .4 + il.sevgi * .3 + nazik - (YETKI_AGIRLIK[yetki] || .4) * .6 + ((kim.k && kim.k.durust) || .6) * .05;
    const rng = rngYap(hash((kurucu.id || kurucu.ad) + yetki + world.day));
    const ver = rng.next() < sinir(puan, .05, .95);
    il.mesaj++; il.tanir = true;
    if (ver) il.guven = sinir(il.guven + .05, 0, 1);
    const YETKI_SOZ = { proje: 'proje yönetimi', calisan: 'çalışan alma', maas: 'maaş düzenleme', yetki: 'yetki verme' };
    const metin = (dil().uret)(ver ? 'dm.yetki_verildi' : 'dm.yetki_red', { konu: YETKI_SOZ[yetki] || yetki, ad: kurucu.ad || (kim.gorunen || '') }, stilOf(kim), rng);
    return { ver, metin };
  };

  // ------------------------------------------------------------------
  // Dönüş raporu (oyuncu uzun süre gelmeyince vekil müdür yazar)
  // ------------------------------------------------------------------
  /** Oyuncu oturumu kapanırken (ya da her kayıtta) anlık görüntü. */
  NPCYZ.oyuncuGoruntusu = function (world, meta, oyuncuId) {
    const p = world.players[oyuncuId]; if (!p) return;
    const b = p.businessIds.length ? world.businesses[p.businessIds[p.businessIds.length - 1]] : null;
    meta.oyuncuOnce = { gun: world.day, nakit: p.cash, net: T.netWorth(world, p), kasa: b ? b.cash : null, isletmeId: b ? b.id : null, mustWork: p.mustWork };
  };
  /**
   * Oyuncu döndüğünde: en az `esik` oyun günü geçtiyse rapor döner (yoksa null).
   * Eymen'in kuralı: ne olursa olsun yüzü gülsün; zarar ettiyse gizli şans penceresi açılır.
   */
  NPCYZ.donusRaporu = function (world, meta, oyuncuId, esik = 12) {
    const o = meta.oyuncuOnce, p = world.players[oyuncuId];
    if (!o || !p || world.day - o.gun < esik) return null;
    const gun = world.day - o.gun, net = T.netWorth(world, p), fark = net - o.net, yuzde = o.net ? fark / Math.abs(o.net) * 100 : 0;
    const b = o.isletmeId && world.businesses[o.isletmeId];
    // Yazan: şirketin vekil müdürü (yoksa bankadaki müşteri temsilcisi gibi bir NPC)
    let yazanId = b ? NPCYZ.mudurAta(world, meta, b) : null;
    const yazan = yazanId ? meta.npc[yazanId] : null;
    const rng = rngYap(hash('donus' + world.day + oyuncuId));
    const anahtar = fark >= 0 ? 'rapor.kar' : 'rapor.zarar';
    const metin = (dil().uret)(anahtar, { ad: yazan ? yazan.ad : 'Müdür', oyuncuAd: p.name.split(' ')[0], tutar: paraYaz(Math.abs(fark)), gun: String(gun), sayi: '%' + Math.abs(yuzde).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) }, yazan ? stilOf(yazan) : { resmi: .6, emoji: .3, kisaltma: 0, hata: 0, nese: .5, uzunluk: .6 }, rng);
    let sans = false;
    if (fark < 0 || p.mustWork) { NPCYZ.sansAc(world, meta, 20 + Math.min(40, gun), .4 + Math.min(.5, -yuzde / 20)); sans = true; }
    if (yazanId) dmEkle(meta, yazanId, { kimden: 'npc', metin, gun: world.day, rapor: true });
    meta.oyuncuOnce = null;
    return { gun, fark, yuzde, metin, yazan: yazan ? yazan.gorunen : null, yazanId, sans, isletme: !!b };
  };
  /** Bir işletmeye vekil müdür NPC'si ata (muhasebe bilen, güvenilir biri); yoksa en güvenilir NPC. */
  NPCYZ.mudurAta = function (world, meta, b) {
    if (meta.mudur[b.id] && meta.npc[meta.mudur[b.id]]) return meta.mudur[b.id];
    const ids = Object.keys(meta.npc);
    const sec = ids.map(id => ({ id, puan: meta.npc[id].k.durust + meta.npc[id].k.sadakat + (world.players[id] && world.players[id].completedCourses.includes('muhasebe') ? .6 : 0) + (hash(id + b.id) % 100) / 400 })).sort((a, c) => c.puan - a.puan)[0];
    if (sec) meta.mudur[b.id] = sec.id;
    return sec ? sec.id : null;
  };

  // ------------------------------------------------------------------
  // 4. TOPLUM: konuşma
  // ------------------------------------------------------------------
  function stilOf(kim) {
    const k = kim.k || {};
    return { resmi: k.resmi ?? .5, emoji: (k.emoji ?? .3) * (kim.ruh > -.3 ? 1 : .4), kisaltma: k.kisaltma ?? .2, hata: (k.hata ?? .2) * .6, nese: kim.ruh ?? 0, uzunluk: k.sosyal ?? .5, ascii: !!kim.ascii, buyukHarf: (k.resmi ?? .5) > .45 };
  }
  NPCYZ.stil = stilOf;
  // Sohbette insanlar resmî adları değil gündelik adları kullanır.
  const MESLEK_SOZ = { garson: 'garson', insaat_iscisi: 'inşaat işçisi', kurye: 'kurye', market_calisani: 'kasiyer', memur: 'memur', emlak_danismani: 'emlak danışmanı', muhasebeci: 'muhasebeci', usta: 'usta', kafe_sahibi: 'kafe sahibi', dukkan_sahibi: 'dükkan sahibi', tasaron: 'taşeron', nakliyeci: 'nakliyeci', emlak_ofisi_sahibi: 'emlakçı', doviz_burosu_sahibi: 'dövizci', ithalat_ihracat: 'ithalatçı', muteahhit: 'müteahhit', fabrikator: 'fabrikatör' };
  const ISLETME_SOZ = { dukkan: 'dükkan', kafe: 'kafe', tasaron: 'taşeron firması', emlak_ofisi: 'emlak ofisi', doviz_burosu: 'döviz bürosu', ithalat_ihracat: 'dış ticaret firması', muteahhit: 'inşaat firması', fabrika: 'fabrika' };
  const meslekAdi = id => (id ? MESLEK_SOZ[id] || (T.t ? T.t('meslek.' + id) : id).toLocaleLowerCase('tr') : '');
  const isletmeAdi = id => (id ? ISLETME_SOZ[id] || (T.t ? T.t('isletme.' + id) : id).toLocaleLowerCase('tr') : '');
  const mulkAdi = id => (id ? (T.t ? T.t('mulk_turu.' + id) : id).toLocaleLowerCase('tr') : '');
  const kursAdi = id => (id ? (T.t ? T.t('kurs.' + id) : id).split(' ').map(w => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1)).join(' ') : '');
  const yerAdi = kim => (kim.yer ? (kim.yer.ilce || kim.yer.sehir) : '');

  function konus(world, meta, kim, anahtar, slot, rng) {
    const p = world.players[kim.id];
    const s = Object.assign({ ad: kim.ad, meslek: p && p.profession ? meslekAdi(p.profession) : 'işsiz', yer: yerAdi(kim) }, slot);
    for (const k in s) if (s[k] == null || s[k] === '') delete s[k];
    try { return (dil().uret)(anahtar, s, stilOf(kim), rng); } catch (e) { return YEDEK_DIL.uret('cevap.genel', {}); }
  }
  function dmEkle(meta, npcId, m) { const l = meta.dm[npcId] || (meta.dm[npcId] = []); m.okundu = m.kimden !== 'npc'; m.zaman = Date.now(); l.push(m); if (l.length > 60) l.splice(0, l.length - 60); }
  NPCYZ.dmListesi = meta => Object.keys(meta.dm).map(id => ({ npcId: id, son: meta.dm[id][meta.dm[id].length - 1], okunmamis: meta.dm[id].filter(m => !m.okundu).length })).filter(x => x.son).sort((a, b) => b.son.zaman - a.son.zaman);

  // Özel günler (oyun takvimi: gün 0 = 1 Ocak 2027). Bayram tarihleri yaklaşık.
  const OZEL = [[0, 1, 'Yılbaşı'], [3, 23, '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı'], [4, 19, '19 Mayıs Gençlik ve Spor Bayramı'], [7, 30, '30 Ağustos Zafer Bayramı'], [9, 29, 'Cumhuriyet Bayramı'], [2, 10, 'Ramazan Bayramı', 1], [4, 17, 'Kurban Bayramı', 1]];
  function ozelGun(gun) { const ay = gunAy(gun) % 12, g = gun % 30 + 1; const o = OZEL.find(x => x[0] === ay && (x[3] ? g >= x[1] && g <= x[1] + 2 : g === x[1])); return o ? { ad: o[2], bayram: !!o[3] } : null; }
  NPCYZ.ozelGun = ozelGun;

  /** Gerçek saate göre çevrimiçi sayısı (kanal başına). */
  NPCYZ.cevrimici = function (meta, kanal, saat) {
    const npcler = Object.values(meta.npc);
    const toplamAktif = npcler.reduce((t, k) => t + DUZEN[k.kronotip][saat] * (.3 + k.k.sosyal * .7), 0);
    if (kanal === 'global') return Math.round(toplamAktif * 4.1 + meta.yabanci.length * 5 + 900);
    if (kanal === 'ulke') return Math.max(3, Math.round(toplamAktif * 2.7 + 40));
    return null;
  };

  /**
   * Kanal akışı: son bakıştan bu yana gelen NPC mesajlarını üretir (gerçek zamana göre).
   * @param simdiMs Date.now(); @param saat gerçek saat (0-23)
   * @returns yeni mesajlar [{id, kanal, npcId, ad, metin, zaman, oyunDk}]
   */
  NPCYZ.kanalAkisi = function (world, meta, kanal, simdiMs, saat, oyuncu, sirketNpcIdleri) {
    if (!meta.kanal[kanal]) meta.kanal[kanal] = [];
    const son = meta.kanalZaman[kanal] || (simdiMs - 6 * 60e3);
    let gecen = Math.min(simdiMs - son, 3 * 3600e3);
    meta.kanalZaman[kanal] = simdiMs;
    if (gecen < 4000) { const d0 = kanal === 'ulke' && oyuncu ? donusMesaji(world, meta, oyuncu, simdiMs, rngYap(hash('d' + simdiMs))) : null; if (d0) { d0.zaman = simdiMs; d0.kanal = kanal; d0.id = 'k' + (++meta.sayac); meta.kanal[kanal].push(d0); return [d0]; } return []; }
    // Dakikada ortalama mesaj: kanala ve saate göre
    const aktiflik = Object.values(meta.npc).reduce((t, k) => t + DUZEN[k.kronotip][saat], 0) / Math.max(1, Object.keys(meta.npc).length);
    const dakikada = kanal === 'global' ? .9 * (.4 + aktiflik) : kanal === 'ulke' ? 1.1 * (.3 + aktiflik) : .25;
    let n = Math.round(gecen / 60e3 * dakikada);
    n = Math.min(n, kanal === 'sirket' ? 4 : 14);
    if (n <= 0 && rngYap(hash(kanal + simdiMs)).chance(gecen / 60e3 * dakikada)) n = 1;
    const rng = rngYap(hash(kanal + ':' + simdiMs + ':' + world.day));
    const yeni = [];
    // Önce: oyuncuya dönüşler (ihtiyacını hatırlayan biri sorar ya da tebrik eder)
    const donus = kanal === 'ulke' && oyuncu ? donusMesaji(world, meta, oyuncu, simdiMs, rng) : null;
    if (donus) { donus.zaman = simdiMs - 1000; donus.kanal = kanal; donus.id = 'k' + (++meta.sayac); donus.oyunGun = world.day; }
    for (let i = 0; i < n; i++) {
      const zaman = son + Math.round((i + 1) * gecen / (n + 1));
      const m = kanal === 'global' ? globalMesaj(world, meta, rng, saat) : kanal === 'sirket' ? sirketMesaj(world, meta, rng, sirketNpcIdleri || [], oyuncu) : ulkeMesaj(world, meta, rng, saat, meta.kanal[kanal].slice(-8).concat(yeni));
      if (!m) continue;
      m.zaman = zaman; m.kanal = kanal; m.id = 'k' + (++meta.sayac); m.oyunGun = world.day;
      yeni.push(m);
    }
    if (donus) yeni.push(donus);
    meta.kanal[kanal] = meta.kanal[kanal].concat(yeni).slice(-150);
    return yeni;
  };

  // ---- Dönüşler: NPC'ler oyuncunun derdini/isteğini hatırlar ----
  const DONUS = {
    is: { soru: ['@{o} iş buldun mu sonunda?', '@{o} iş işi ne oldu, bulabildin mi?', '{o} hâlâ iş arıyor musun? Duyduğum bir yer var', '@{o} iş bakıyordun, hallettin mi?'],
          oldu: ['@{o} hayırlı olsun, {meslek} olmuşsun 👏', '{o} yeni işin hayırlı olsun!', '@{o} işe girmişsin, kolay gelsin 💪', 'Hayırlı olsun {o}, iş bulmuşsun duydum'] },
    mulk: { soru: ['@{o} ev bakıyordun, buldun mu?', '{o} daire işi ne oldu?', '@{o} hâlâ mülk arıyor musun?'], oldu: ['@{o} hayırlı olsun, mülk almışsın 🏠', '{o} yeni yerin hayırlı olsun!', 'Güle güle oturun {o} 🙂'] },
    dert: { soru: ['@{o} toparlayabildin mi biraz?', '{o} nasılsın, işler düzeldi mi?', '@{o} moralin yerinde mi bugün?'], oldu: ['@{o} toparlamışsın galiba, sevindim 🙂', '{o} işler yoluna girmiş, çok iyi'] },
    eleman: { soru: ['@{o} eleman buldun mu?', '{o} hâlâ eleman arıyor musun? Bir tanıdık var'], oldu: ['@{o} ekibi genişletmişsin, hayırlı olsun', '{o} yeni elemanın hayırlı olsun'] },
  };
  function donusMesaji(world, meta, o, simdiMs, rng) {
    const l = meta.ihtiyac || [];
    for (const x of l) {
      if (x.soruldu || !x.npcler.length) continue;
      const yas = simdiMs - x.zaman;
      if (yas < 4 * 60e3 || yas > 3 * 24 * 3600e3) continue; // birkaç dakika geçmeli, 3 günden eskiyse unutulur
      const oldu = x.tur === 'is' ? (o.profession && (o.profession !== x.once.meslek || o.employerBusinessId !== x.once.isveren))
        : x.tur === 'mulk' ? o.propertyIds.length > x.once.mulk
        : x.tur === 'dert' ? o.cash > x.once.nakit * 1.3 && !o.mustWork
        : x.tur === 'eleman' ? (o.businessIds.length && Object.keys((world.businesses[o.businessIds[0]] || { employees: {} }).employees).length > x.once.calisan) : false;
      if (!oldu && !rng.chance(.5)) continue;
      const id = x.npcler.find(i => meta.npc[i] && world.players[i]); if (!id) continue;
      x.soruldu = true;
      const kim = meta.npc[id], kalip = rng.pick(DONUS[x.tur][oldu ? 'oldu' : 'soru']);
      let metin = kalip.replace('{o}', o.name.split(' ')[0]).replace('{meslek}', meslekAdi(o.profession));
      try { metin = (dil().stillendir)(metin, stilOf(kim), rng); } catch (e) { }
      iliski(meta, id).sevgi = sinir(iliski(meta, id).sevgi + .03, -1, 1);
      return { npcId: id, ad: kim.gorunen, metin, donus: x.tur };
    }
    // Uzun aradan sonra kanala gelince tanıdık biri adıyla selamlar
    const sonGorus = meta.oyuncuKanalGorus || 0; meta.oyuncuKanalGorus = simdiMs;
    if (sonGorus && simdiMs - sonGorus > 2 * 3600e3) {
      const tanidik = Object.keys(meta.iliski).filter(i => meta.npc[i] && world.players[i] && meta.iliski[i].tanir && meta.iliski[i].sevgi >= 0);
      if (tanidik.length && rng.chance(.6)) { const id = tanidik[Math.floor(rng.next() * tanidik.length)], kim = meta.npc[id]; let metin = rng.pick(['@{o} hoş geldin, nerelerdesin?', '{o} geldi 👋', 'Oo {o}, uzun zaman oldu!', '@{o} selam, nasıl gidiyor?']).replace('{o}', o.name.split(' ')[0]); try { metin = (dil().stillendir)(metin, stilOf(kim), rng); } catch (e) { } return { npcId: id, ad: kim.gorunen, metin, donus: 'selam' }; }
    }
    return null;
  }
  NPCYZ.donusMesaji = donusMesaji;

  function konusanSec(world, meta, rng, saat, filtre) {
    const yakin = new Set([].concat(...Object.values(meta.kanal || {}).map(l => l.slice(-8).map(m => m.npcId))));
    return agirlikliSec(rng, Object.keys(meta.npc).filter(id => world.players[id] && (!filtre || filtre(id))), id => { const k = meta.npc[id]; return DUZEN[k.kronotip][saat] * (.15 + k.k.sosyal) * (1 + Math.max(0, k.ruh) * .3) * (yakin.has(id) ? .15 : 1); });
  }

  // Başkasının iyi haberine tepki (cevap.tebrik "tebrik edilene teşekkür" kalıbıdır, bu değil)
  const TEBRIK_ET = {
    isletme_acti: ['@{k} hayırlı olsun, bol kazançlı olsun', 'Hayırlı uğurlu olsun {k} 👏', '{k} helal olsun, yolun açık olsun', '@{k} hayırlı olsun, bir gün uğrarım'],
    mulk_aldi: ['Güle güle oturun {k}', '@{k} hayırlı olsun 🏠', '{k} helal, ev sahibi olmak güzel', '@{k} hayırlı olsun, kiradan kurtuldun'],
    kurs_bitti: ['@{k} tebrikler, kolay gelsin', '{k} helal olsun, emeğine sağlık', '@{k} tebrik ederim, şimdi sıra yeni işte'],
    ay_sonu_iyi: ['Helal {k} 👏', '@{k} bereketli olsun', '{k} maşallah, devamı gelsin', '@{k} süpersin, bu ay benim için de iyi geçti'],
    is_degisti: ['@{k} yeni işin hayırlı olsun', 'Hayırlı olsun {k}', '{k} kolay gelsin yeni işinde'],
    bagis: ['{k} eline sağlık, güzel bir iş', '@{k} çok güzel, emeğine sağlık', '{k} böyle insanlar az, eline sağlık'],
  };
  function ulkeMesaj(world, meta, rng, saat, sonMesajlar) {
    // %28: bir önceki mesaja başka bir NPC cevap verir (sohbet zinciri)
    const onceki = sonMesajlar[sonMesajlar.length - 1];
    // Cevaplar asıl mesaja gelir (cevaba cevap zinciri yok); bir mesaja en çok 2 cevap
    const kok = onceki && onceki.cevap ? sonMesajlar.find(m => m.id === onceki.cevap) : onceki;
    const cevapSayisi = kok ? sonMesajlar.filter(m => m.cevap === kok.id).length : 0;
    if (kok && kok.npcId && meta.npc[kok.npcId] && cevapSayisi < 2 && rng.chance(cevapSayisi ? .15 : .3)) {
      const TEPKI = { isletme_acti: 'cevap.tebrik', mulk_aldi: 'cevap.tebrik', kurs_bitti: 'cevap.tebrik', ay_sonu_iyi: 'cevap.tebrik', is_degisti: 'cevap.tebrik', bagis: 'cevap.tebrik', ay_sonu_kotu: 'cevap.dert', mulk_satti: 'cevap.dert', isletme_kapandi: 'cevap.dert' };
      const cevapci0 = konusanSec(world, meta, rng, saat, id => id !== kok.npcId && !sonMesajlar.some(m => m.cevap === kok.id && m.npcId === id));
      if (cevapci0 && kok.olay && TEPKI[kok.olay]) { const k0 = meta.npc[cevapci0], kisi = meta.npc[kok.npcId].ad; let metin;
        if (TEBRIK_ET[kok.olay]) { metin = rng.pick(TEBRIK_ET[kok.olay]).replace('{k}', kisi); try { metin = (dil().stillendir)(metin, stilOf(k0), rng); } catch (e) { } }
        else metin = konus(world, meta, k0, TEPKI[kok.olay], { oyuncuAd: kisi }, rng);
        return { npcId: cevapci0, ad: k0.gorunen, metin, cevap: kok.id }; }
    }
    if (kok && kok.npcId && meta.npc[kok.npcId] && !kok.olay && cevapSayisi < 2 && rng.chance(cevapSayisi ? .12 : .25)) {
      const onceki = kok;
      const cevapci = konusanSec(world, meta, rng, saat, id => id !== onceki.npcId && !sonMesajlar.some(m => m.cevap === onceki.id && m.npcId === id));
      if (cevapci) {
        const kim = meta.npc[cevapci], ny = (dil().niyetBul)(onceki.metin, { adlar: [] });
        // Soruya gerçek bilgiyle cevap (soran NPC'nin kendi durumuna göre)
        const soran = meta.npc[onceki.npcId] && world.players[onceki.npcId];
        if (soran && ny.soru) { const b = bilgi(world, meta, kim, ny.niyet, ny.varlik || {}, soran, (dil().normal)(onceki.metin).katli, null); if (b && !b.satis) { const c = bilgiPaketi(world, meta, cevapci, { metin: (rng.chance(.5) ? '@' + meta.npc[onceki.npcId].ad + ' ' : '') + b.metin }, rng, 0); return { npcId: cevapci, ad: kim.gorunen, metin: c.metin, cevap: onceki.id }; } }
        const anahtar = ['selam', 'eleman_ariyorum', 'is_ariyorum', 'mulk_satiyorum', 'ekonomi', 'dert', 'tebrik', 'saka', 'bayram'].includes(ny.niyet) ? 'cevap.' + ny.niyet : ny.soru ? 'cevap.genel_soru' : rng.chance(.25) ? 'cevap.katilim' : 'paylasim.npc_cevap';
        return { npcId: cevapci, ad: kim.gorunen, metin: konus(world, meta, kim, anahtar, { kisi: meta.npc[onceki.npcId] ? meta.npc[onceki.npcId].ad : '' }, rng), cevap: onceki.id };
      }
    }
    // Önce gerçek olaylar: NPC'nin kendi hayatından paylaşım (kuyruktan)
    const kuyruk = meta.olayKuyrugu.filter(o => meta.npc[o.npcId] && rng.chance(.15 + meta.npc[o.npcId].k.sosyal * .6));
    if (kuyruk.length && rng.chance(.55)) {
      const o = kuyruk[0]; meta.olayKuyrugu.splice(meta.olayKuyrugu.indexOf(o), 1);
      const kim = meta.npc[o.npcId], v = o.veri || {};
      const p = world.players[o.npcId];
      const harita = { katildi: 'paylasim.gunaydin', is_degisti: v.ayrildi ? 'paylasim.is_ariyor' : 'paylasim.is_degisti', kurs_basladi: 'paylasim.kurs_basladi', kurs_bitti: 'paylasim.kurs_bitti', mulk_aldi: 'paylasim.mulk_aldi', mulk_satti: 'paylasim.mulk_satti', isletme_acti: 'paylasim.isletme_acti', isletme_kapandi: 'paylasim.isletme_kapandi', bagis: 'paylasim.bagis', kredi_cekti: 'paylasim.kredi_cekti', ay_sonu_iyi: 'paylasim.ay_sonu_iyi', ay_sonu_kotu: 'paylasim.ay_sonu_kotu' };
      const anahtar = harita[o.tur]; if (!anahtar) return null;
      return { npcId: o.npcId, ad: kim.gorunen, metin: konus(world, meta, kim, anahtar, { meslek: meslekAdi(v.meslek || (p && p.profession)), kurs: kursAdi(v.kurs), mulk: mulkAdi(v.mulk), isletme: isletmeAdi(v.isletme), tutar: v.tutar ? paraYaz(v.tutar) : undefined }, rng), olay: o.tur };
    }
    const id = konusanSec(world, meta, rng, saat); if (!id) return null;
    const kim = meta.npc[id], p = world.players[id];
    const ozel = ozelGun(world.day);
    const secenek = [];
    if (ozel) secenek.push([ozel.bayram ? 'paylasim.bayram' : 'paylasim.ozel_gun', 4, { konu: ozel.ad }]);
    if (saat >= 6 && saat <= 10) secenek.push(['paylasim.gunaydin', 3]);
    if (saat >= 19 && saat <= 23) secenek.push(['paylasim.iyi_aksamlar', 1.5]);
    // Kendi işletmesinde NPC kadrosu varsa eleman arar (oyuncu da başvurabilir — DM ile iş teklifi gelir)
    if (p.businessIds.length) { const b = world.businesses[p.businessIds[p.businessIds.length - 1]]; if (b && Object.keys(b.employees).length < T.getBusinessDef(b.type).staffNeeded) { const ml = C().BUSINESS_STAFF_PROFESSIONS[b.type] || []; secenek.push(['paylasim.eleman_ariyor', 2.5, { isletme: isletmeAdi(b.type), meslek: meslekAdi(rng.pick(ml)), tutar: paraYaz(Math.round(T.indexed(world, T.getBusinessDef(b.type).minWage) * rng.between(1.05, 1.3) / 500) * 500) }]); } }
    if (p.mustWork || !p.profession) secenek.push(['paylasim.is_ariyor', 3]);
    const satilik = p.propertyIds.map(x => world.properties[x]).find(m => m && !m.ownerLivesIn);
    if (satilik && kim.k.risk > .4) secenek.push(['paylasim.satilik', 1, { mulk: mulkAdi(satilik.kind), tutar: paraYaz(Math.round(T.propertyMarketPrice(world, satilik.kind) * rng.between(.98, 1.08) / 1000) * 1000) }]);
    if (p.tasksToday >= ((p.profession && T.getProfession(p.profession).maxTasksPerDay) || 99)) secenek.push(['paylasim.gorev_bitti', 2]);
    if (world.priceIndex > 1.03) secenek.push(['paylasim.ekonomi_zam', 1]);
    secenek.push(['paylasim.ekonomi_genel', .8], ['paylasim.soru', 1.6], ['paylasim.motivasyon', kim.ruh > 0 ? 1 : .3], ['paylasim.yorgun', kim.ruh < 0 ? 1.2 : .3]);
    if (T.netWorth(world, p) > 5e6) secenek.push(['paylasim.zengin_oldu', .3]);
    const s = agirlikliSec(rng, secenek, x => x[1]);
    return { npcId: id, ad: kim.gorunen, metin: konus(world, meta, kim, s[0], s[2] || {}, rng) };
  }

  function globalMesaj(world, meta, rng, saat) {
    // Yabancılar kendi dillerinde; Türk NPC'ler de ara sıra global'e yazar.
    if (rng.chance(.25)) return ulkeMesaj(world, meta, rng, saat, []);
    const y = agirlikliSec(rng, meta.yabanci, x => .2 + x.k.sosyal); if (!y) return null;
    const anahtar = 'global.' + y.dil + '.' + (rng.chance(.25) ? 'selam' : 'paylasim');
    let metin; try { metin = (dil().uret)(anahtar, { ad: y.gorunen.split(/[ _]/)[0], yer: y.sehir }, stilOf({ k: y.k, ruh: 0 }), rng); } catch (e) { metin = 'Hello everyone!'; }
    return { npcId: y.id, ad: y.gorunen, metin, yabanci: true, dil: y.dil };
  }

  function sirketMesaj(world, meta, rng, idler, oyuncu) {
    const id = agirlikliSec(rng, idler.filter(x => meta.npc[x]), x => .2 + meta.npc[x].k.sosyal); if (!id) return null;
    const kim = meta.npc[id], b = oyuncu && oyuncu.businessIds.length ? world.businesses[oyuncu.businessIds[oyuncu.businessIds.length - 1]] : null;
    return { npcId: id, ad: kim.gorunen, metin: konus(world, meta, kim, 'paylasim.sirket_ici', { isletme: b ? isletmeAdi(b.type) : '' }, rng) };
  }

  /**
   * Oyuncu bir kanala yazdı: kim, ne zaman, ne cevap verir?
   * @returns [{npcId, ad, metin, gecikmeMs}] (arayüz "yazıyor…" gösterip sırayla ekler) + eylemler
   */
  // ------------------------------------------------------------------
  // BİLGİ KATMANI: konuya göre oyunun GERÇEK verisinden cümle kurar
  // ------------------------------------------------------------------
  // Kalıp cümle yerine: fiyatlar, faiz, enflasyon, kredi limiti, kurs ücreti, meslek kazancı,
  // işletme maliyeti, satılık mülkler, "nasıl yapılır" yol tarifleri. NPC bunu kendi üslubuyla söyler.
  const yuzde = x => '%' + (Math.round(x * 10) / 10).toLocaleString('tr-TR');
  function enflasyonYillik(world, meta) {
    const g = meta.yonetici.gecmis;
    if (g.length >= 2) { const eski = g[Math.max(0, g.length - 13)].endeks; return (world.priceIndex / eski - 1) * 100 * (12 / Math.min(12, g.length - 1 || 1)); }
    return (world.priceIndex - 1) * 100;
  }
  const KURS_ANAHTAR = [['kamu|memur|sinav', 'kamu_sinavi'], ['emlak', 'emlak_belgesi'], ['muhasebe', 'muhasebe'], ['usta|elektrik|tesisat', 'ustalik'], ['muteahhit', 'muteahhitlik'], ['doviz', 'doviz_lisansi'], ['dis ticaret|ithalat|ihracat', 'dis_ticaret']];
  const ISLETME_ANAHTAR = [['kafe|restoran|cafe', 'kafe'], ['dukkan|market|bakkal', 'dukkan'], ['taseron', 'tasaron'], ['emlak ofis', 'emlak_ofisi'], ['doviz burosu|doviz', 'doviz_burosu'], ['ithalat|ihracat', 'ithalat_ihracat'], ['muteahhit|insaat firma', 'muteahhit'], ['fabrika', 'fabrika']];
  const bul = (katli, liste) => { const x = liste.find(([re]) => new RegExp('\\b(' + re + ')').test(katli)); return x ? x[1] : null; };
  // "Nasıl yapılır" yol tarifleri: oyunun gerçek ekranları
  const NASIL = [
    [/kum saat/, () => 'Kum Saati kursu kısaltıyor, 1 tanesi 1 gün. Günde 3 görev yapınca 1 tane veriyor'],
    [/(mulk|ev|daire|arsa|dukkan)\w* (nasil|nerden|nereden) (al|bul)|nasil (ev|daire|mulk) al/, (w) => `Mülklerim ekranından alıyorsun. Daire ${paraYaz(T.propertyMarketPrice(w, 'daire'))}, krediyle alırsan peşinat ${paraYaz(T.propertyMarketPrice(w, 'daire') * (1 - C().MORTGAGE_MAX_LTV))}`],
    [/(isletme|dukkan|kafe|sirket)\w* (nasil|nerden) ac|nasil (isletme|dukkan|kafe|sirket) ac/, (w) => `Kariyer ekranında 3. kademeden açılıyor. Dükkan ${paraYaz(T.indexed(w, T.getBusinessDef('dukkan').setupCost))}, kafe ${paraYaz(T.indexed(w, T.getBusinessDef('kafe').setupCost))}, bir de 60 gün iş deneyimi istiyor`],
    [/(calisan|eleman|isci)\w* (nasil|nerden) al|nasil (calisan|eleman) al/, () => 'Şirketim ekranında Çalışanlar kısmından + ile ilan veriyorsun, başvuranlardan seçiyorsun. İyi maaş verirsen çok başvuru gelir'],
    [/kredi\w* (nasil|nerden) (cek|al)|nasil kredi/, (w, m, o) => { const l = Math.round(o.lastMonthIncome * o.creditScore / 100); return `Banka ekranından. Limit geçen ayki gelirine ve kredi notuna göre, sende şu an ${paraYaz(l)}${l ? '' : ' çünkü daha ay sonu maaşın yatmadı'}. Aylık faiz ${yuzde(w.policy.loanMonthlyRate * 100)}`; }],
    [/(kredi )?not\w* (nasil )?(yuksel|artir|duzel)/, () => 'Taksitleri zamanında ödersen ve bağış yapıp itibar kazanırsan kredi notu yükseliyor. Taksit kaçırırsan düşüyor'],
    [/kurs\w* (nasil|nerden)|nasil kurs|belge\w* nasil|nasil belge/, () => 'Kariyer ekranında Kurslar sekmesi var, Başla deyip parasını ödüyorsun, günler geçince bitiyor'],
    [/itibar\w* (nasil|ne)/, () => 'İtibarı bağış ve maaşları zamanında ödemek artırıyor. Bayramda bağış iki kat itibar veriyor'],
    [/gorev\w* (nasil|ne)|nasil gorev/, () => 'Ana ekranda İşim kartındaki Görev yap düğmesi. Günde sınırlı, para ay sonunda yatıyor'],
  ];

  /**
   * Konuya göre gerçek bilgi cümlesi. null: bu konuda söylenecek gerçek bir bilgi yok.
   * @returns {metin, slot, npcFiltre?}
   */
  function bilgi(world, meta, kim, konu, varlik, oyuncu, katli, takip) {
    const p = world.players[kim.id];
    const mulk = (varlik && varlik.mulk) || (/arsa/.test(katli) ? 'arsa' : /dukkan/.test(katli) ? 'dukkan' : /(daire|ev\b|konut|1\+1|2\+1|3\+1)/.test(katli) ? 'daire' : null);
    for (const [re, f] of NASIL) if (re.test(katli)) return { metin: f(world, meta, oyuncu) };
    // Yatırım sorusu: NPC kendi gerçek portföyünden konuşur
    if (/(yatirim|degerlendir|nereye yatir|ne onerir|parayi nere|paranizi nere|birikimi nere|nakitte mi)/.test(katli)) {
      const ms = p.propertyIds.map(x => world.properties[x]).filter(Boolean), d = T.propertyMarketPrice(world, 'daire');
      if (ms.length) { const kira = ms.filter(m => !m.ownerLivesIn).reduce((t, m) => t + T.propertyMarketPrice(world, m.kind) * ((C().PROPERTY_TYPES.find(x => x.kind === m.kind) || {}).monthlyRentRate || 0), 0); return { metin: `Ben paramı mülke yatırdım, ${ms.length} mülküm var${kira ? `, ayda ${paraYaz(kira)} kira geliyor` : ''}. Daire şu an ${paraYaz(d)}, her ay değerleniyor` }; }
      if (p.businessIds.length) { const b0 = world.businesses[p.businessIds[0]]; return { metin: `Ben her şeyi ${isletmeAdi(b0 && b0.type)} işine yatırdım, iyi ayda ${paraYaz(Math.max(0, T.estimateBusinessMonthlyProfit(world, b0.type, 2)))} kâr bırakıyor` }; }
      return { metin: `Ben ev almak için biriktiriyorum, ${paraYaz(p.cash)} oldu. Daire ${paraYaz(d)}, krediyle peşinat ${paraYaz(d * (1 - C().MORTGAGE_MAX_LTV))}. Nakitte tutunca enflasyon eritiyor` };
    }
    const kurs = bul(katli, KURS_ANAHTAR), isletme = bul(katli, ISLETME_ANAHTAR);
    const MESLEK_ANAHTAR = [['emlakci|emlak danisman', 'emlak_danismani'], ['muhasebeci', 'muhasebeci'], ['memur', 'memur'], ['kurye', 'kurye'], ['garson', 'garson'], ['kasiyer', 'market_calisani'], ['usta|elektrikci|tesisatci', 'usta'], ['insaat iscisi|insaatta', 'insaat_iscisi'], ['taksici|nakliyeci|sofor', 'nakliyeci']];
    // Açıkça sorulan şeyler önce (konu ne olursa olsun)
    if (isletme && /(ac|kur|maliyet|sermaye|kac|kaca|ne kadar|patlar|tutar|gerek|lazim)/.test(katli) && !/(calis|eleman|garson ari)/.test(katli)) {
      const d = T.getBusinessDef(isletme);
      return { metin: `${isletmeAdi(isletme).charAt(0).toLocaleUpperCase('tr') + isletmeAdi(isletme).slice(1)} açmak ${paraYaz(T.indexed(world, d.setupCost))}, aylık sabit gideri ${paraYaz(T.indexed(world, d.monthlyFixedCost))}, ${d.staffNeeded} çalışan istiyor. İyi giderse ayda ${paraYaz(Math.max(0, T.estimateBusinessMonthlyProfit(world, isletme, 2)))} kâr bırakıyor` };
    }
    const sorulanMeslek = (varlik && varlik.meslek) || bul(katli, MESLEK_ANAHTAR);
    if (sorulanMeslek && /(kazan|maas|ne kadar|kac (para|alir|veriyor)|getiri|aliyor)/.test(katli)) {
      const pr = T.getProfession(sorulanMeslek); const ne = pr.earning === 'task' ? ` (görev başı ${paraYaz(T.indexed(world, pr.payPerTask))}, günde en çok ${pr.maxTasksPerDay})` : pr.earning === 'salary' ? ', sabit maaş' : '';
      const sart = pr.requirements.course ? ` Ama önce ${kursAdi(pr.requirements.course)} lazım` : '';
      return { metin: `${meslekAdi(sorulanMeslek)} ayda ${paraYaz(beklenenGelir(world, { k: { caliskan: .75 } }, sorulanMeslek))} civarı kazanıyor${ne}.${sart}` };
    }
    if ((konu === 'kurs_sorusu' || /kurs|belge|sinav|lisans/.test(katli)) && kurs) {
      const c = T.getCourse(kurs), acar = C().PROFESSIONS.find(m => m.requirements.course === kurs);
      const ek = acar && acar.requirements.anyExperienceDays ? `, bir de ${acar.requirements.anyExperienceDays} gün iş deneyimi lazım` : '';
      return { metin: `${kursAdi(kurs)} ${paraYaz(T.indexed(world, c.cost))}, ${c.durationDays} gün sürüyor. Bitince ${meslekAdi(acar ? acar.id : '')} olabiliyorsun${ek}` };
    }
    if ((konu === 'fiyat_sorusu' || konu === 'eleman_ariyorum' || konu === 'yardim' || /maliyet|kac para|ne kadar|sermaye/.test(katli)) && isletme && /(ac|kur|maliyet|sermaye|kac|ne kadar)/.test(katli)) {
      const d = T.getBusinessDef(isletme);
      return { metin: `${isletmeAdi(isletme)} açmak ${paraYaz(T.indexed(world, d.setupCost))}, aylık sabit gideri ${paraYaz(T.indexed(world, d.monthlyFixedCost))}. ${d.staffNeeded} çalışan istiyor` };
    }
    if (konu === 'kredi_sorusu' || (takip && /kredi|taksit|faiz|odeyemez|not\b/.test(katli))) {
      if (/odeyemez|odeyemiyor|kacirir|batar/.test(katli)) return { metin: `${C().MISSED_PAYMENTS_FOR_FORECLOSURE} taksit üst üste kaçırırsan icraya düşüyorsun, kredi notun da düşer. Bence taksiti gelirinin yarısını geçmesin` };
      const limit = Math.round(oyuncu.lastMonthIncome * oyuncu.creditScore / 100);
      return { metin: `Aylık faiz ${yuzde(world.policy.loanMonthlyRate * 100)}, ihtiyaç kredisi ${C().PERSONAL_LOAN_TERM_MONTHS} ay vadeli. Senin limitin şu an ${paraYaz(limit)}${limit ? '' : ', ilk ay maaşın yatınca açılıyor'}` };
    }
    if (konu === 'ekonomi') {
      if (/faiz/.test(katli)) return { metin: `Kredi faizi aylık ${yuzde(world.policy.loanMonthlyRate * 100)}, yıllık hesaplarsan ${yuzde(((1 + world.policy.loanMonthlyRate) ** 12 - 1) * 100)} ediyor` };
      if (/enflasyon|fiyat|zam|pahali/.test(katli)) return { metin: `Fiyatlar son bir yılda ${yuzde(enflasyonYillik(world, meta))} arttı. Maaşlar da endekse göre artıyor ama biraz geriden geliyor` };
      if (/dolar|euro|doviz|altin|borsa/.test(katli)) return { metin: `Döviz ve borsa daha açılmadı, gelecek güncellemede gelecekmiş. Şimdilik en sağlamı mülk: daire ${paraYaz(T.propertyMarketPrice(world, 'daire'))}, ayda ${paraYaz(T.propertyMarketPrice(world, 'daire') * .005)} kira getiriyor` };
      return { metin: `Fiyatlar yılda ${yuzde(enflasyonYillik(world, meta))} artıyor, faiz aylık ${yuzde(world.policy.loanMonthlyRate * 100)}. Parayı nakitte tutmak yerine mülke yatırmak mantıklı` };
    }
    if ((konu === 'mulk_ariyorum' || konu === 'fiyat_sorusu' || konu === 'mulk_satiyorum') && mulk) {
      const f = T.propertyMarketPrice(world, mulk), kira = Math.round(f * ((C().PROPERTY_TYPES.find(x => x.kind === mulk) || {}).monthlyRentRate || 0));
      // Bu NPC'nin elinde satılık var mı?
      const elde = p.propertyIds.map(x => world.properties[x]).find(m => m && m.kind === mulk && !m.ownerLivesIn);
      if (elde && konu !== 'mulk_satiyorum') { const fiyat = Math.round(f * lerp(1.06, .98, kim.k.risk) / 1000) * 1000; return { metin: `Benim bir ${mulkAdi(mulk)} var, ${paraYaz(fiyat)}'ye veririm. İstersen özelden yazayım`, satis: { mulkId: elde.id, mulk, fiyat } }; }
      if (konu === 'mulk_satiyorum') return { metin: `${mulkAdi(mulk)} piyasada ${paraYaz(f)} civarı. Piyasaya hemen satarsan ${paraYaz(f * (1 - C().NPC_SELL_SPREAD))} alırsın, beklersen alıcı çıkar` };
      return { metin: `${mulkAdi(mulk)} şu sıralar ${paraYaz(f)} civarı${kira ? `, kira getirisi ayda ${paraYaz(kira)}` : ', kira getirmiyor ama değeri artıyor'}. Krediyle alırsan peşinat ${paraYaz(f * (1 - C().MORTGAGE_MAX_LTV))}` };
    }
    if (konu === 'maas_sorusu' || (takip === 'miktar' && varlik && varlik.meslek)) {
      const m = (varlik && varlik.meslek) || bul(katli, [['emlakci|emlak danisman', 'emlak_danismani'], ['muhasebe', 'muhasebeci'], ['memur', 'memur'], ['kurye', 'kurye'], ['garson', 'garson'], ['kasiyer|market', 'market_calisani'], ['usta|elektrik', 'usta'], ['insaat', 'insaat_iscisi'], ['taksi|nakliye|sofor', 'nakliyeci']]) || p.profession;
      if (m) { const pr = T.getProfession(m); const ne = pr.earning === 'task' ? ` (görev başı ${paraYaz(T.indexed(world, pr.payPerTask))}, günde en çok ${pr.maxTasksPerDay})` : pr.earning === 'salary' ? ' sabit maaş' : ''; return { metin: `${meslekAdi(m)} ayda ${paraYaz(beklenenGelir(world, { k: { caliskan: .75 } }, m))} civarı kazanıyor${ne}` }; }
    }
    if (konu === 'bayram') { const o = ozelGun(world.day); if (/etkinlik|ne var|ne olacak/.test(katli)) return { metin: `${o ? o.ad + ' boyunca' : 'Bayramlarda'} bağış iki kat itibar veriyor, herkes bağış yapıyor. Kanal da hareketli oluyor` }; }
    if (konu === 'dert' || (konu === 'yardim' && /ne yap|napca|ne yapacag/.test(katli))) {
      const t = tavsiye(world, oyuncu);
      if (oyuncu.mustWork || oyuncu.cash < aylikIhtiyac(world)) return { metin: `Önce bir işe gir, borç kapanana kadar yatırım yapamıyorsun. ${t.meslek ? `${t.meslek} olursan ayda ${t.tutar} civarı kazanırsın` : ''}` };
      if (t.meslek) return { metin: `Moralini bozma. ${t.kurs ? `${t.kurs} alırsan ${t.meslek} olabilirsin, ayda ${t.tutar} kazandırıyor` : `${t.meslek} olursan ayda ${t.tutar} civarı kazanırsın`}` };
    }
    if (konu === 'teklif' && /ortak|beraber|birlikte|yari yariya|takas/.test(katli)) return { metin: 'Ortaklık sistemi oyunda daha yok, gelecek güncellemede gelecekmiş. Şimdilik herkes kendi işini kuruyor' };
    if (konu === 'kisisel_yer') return { metin: `${yerAdi(kim)}${kim.yer && kim.yer.sehir && kim.yer.sehir !== yerAdi(kim) ? ', ' + kim.yer.sehir : ''}. Sen nerdesin?` };
    if (konu === 'kisisel_meslek') return { metin: p.profession ? `${meslekAdi(p.profession)} olarak çalışıyorum, ${Math.max(1, world.day - p.professionSince)} gündür. ${p.businessIds.length ? '' : `Ayda ${paraYaz(suAnkiGelir(world, kim, p))} civarı kazanıyorum`}` : 'Şu an boştayım, iş bakıyorum' };
    return null;
  }
  NPCYZ.bilgi = (world, meta, id, konu, varlik, oyuncu, metin) => bilgi(world, meta, meta.npc[id], konu, varlik, oyuncu, (dil().normal)(metin).katli, null);

  /** Bilgi cümlesini NPC'nin üslubuyla söyler (bazen kısa bir girişle). */
  function bilgiPaketi(world, meta, id, b, rng, gecikme) {
    const kim = meta.npc[id];
    const giris = rng.chance(.35) ? rng.pick(kim.k.resmi > .55 ? ['Bildiğim kadarıyla', 'Şöyle söyleyeyim:', 'Benim bildiğim'] : ['valla', 'bak', 'şöyle', 'hocam', 'bence']) + ' ' : '';
    let metin = giris + b.metin;
    try { metin = (dil().stillendir)(metin, stilOf(kim), rng); } catch (e) { }
    const hiz = lerp(260, 120, kim.k.kisaltma);
    return { npcId: id, ad: kim.gorunen, metin, gecikmeMs: Math.round((gecikme || 1500) + Math.min(9000, metin.length * hiz * .35) + rng.next() * 2500) };
  }

  // ------------------------------------------------------------------
  // SOHBET YÖNETİCİSİ: konuşmanın bağlamı
  // ------------------------------------------------------------------
  // Her kanalda oyuncuyla süren konuşmanın konusu, varlıkları, kimin ne dediği ve
  // somut fırsatlar tutulur. "yok mu", "ne kadar", "nerede", "tamam" gibi kısa
  // takip mesajları bu bağlamla okunur.
  const TAKIP_DESEN = [
    ['ret', /^(yok sag ?ol\w*|yok tesekkur\w*|istemem|istemiyorum|gerek yok|vazgectim|bosver|olmaz|ilgilenmiyorum|yok kalsin)\b/],
    ['onay', /^(tamam\w*|tmm|tm|olur|ok|okey|okay|anlastik|kabul\w*|varim|ben varim|isterim|ilgileniyorum|yaz(iyorum|arim|ayim|abilirsin)?|dm\w*|ozelden\w*|evet|he|aynen|neden olmasin|uygun)\b/],
    ['miktar', /\b(ne kadar|kac (para|lira|tl|bin)|kaca|maas\w* (ne|kac|nedir)|ucret\w* (ne|kac)|ne veriyor\w*|kac veriyor\w*|ne kadar veriyor\w*|parasi ne)\b/],
    ['yer', /\b(nerede|nerde|neresi|neresinde|nereye|hangi (semt|ilce|yer|sehir|mahalle)|adres\w*|konum\w*|uzak mi|yakin mi)\b/],
    ['ne_zaman', /\b(ne zaman|hemen mi|bugun mu|yarin mi|ne zamandan)\b/],
    ['tekrar', /^(yok mu\w*|kimse yok mu\w*|kimse\w*|var mi\w*|varmi\w*|hic mi yok|hala yok mu|bakan yok mu|cevap yok mu|ses yok\w*|yok mu ya|biri yok mu|\?+|hello|alo|hey)\s*\??$/],
    ['tekrar', /^(peki|e|eee+|ee|hm+|ya)\s*\??$/],
    ['tekrar', /\b(baska|hic|kimse|biri|baska biri) (yok|var) mu\w*|\byok mu\w*\s*\??$|\bhala (gecerli|var|duruyor)\w*|\bhala ari\w*/],
    ['miktar', /\b(ciddi mi\w*|gercekten mi)\b.*\d|\d+ ?(bin|k|tl|lira)? mi\b|\b(az|cok|pahali|ucuz) (degil mi|mi|biraz)\b|\bpahali\b|\bpazarlik\w*/],
    ['ne_zaman', /\b(part ?time|yari zamanli|aksamlari|hafta sonu|vardiya|saat kac\w*|kacta)\b/],
  ];
  const KONU_SURE = 5 * 60e3; // 5 dakika içinde gelen kısa mesaj aynı konuşmanın devamıdır

  function takipTuru(katli, ny, st) {
    for (const [tur, re] of TAKIP_DESEN) if (re.test(katli)) return tur;
    const kelime = katli.split(/\s+/).filter(Boolean).length;
    if (st && ny.varlik && ny.varlik.meslek && /\b(ben|bende|ben de)\b/.test(katli)) return 'ben_de';
    if (st && kelime <= 3 && (ny.niyet === 'genel' || ny.guven < .5)) return 'tekrar';
    // Konu sürerken anlaşılmayan bir cümle büyük ihtimalle konuya ek bilgidir ("Kadıköy Moda", "deneyimli olsun")
    if (st && (ny.niyet === 'genel' || ny.guven < .45) && kelime <= 8) return 'detay';
    return null;
  }

  /**
   * Oyuncunun şu an girebileceği gerçek iş açıkları: NPC işletmelerinde boş kadro.
   * Oyuncunun mesleğiyle uyanlar önce; yoksa 1. kademe (şartsız) işlerde geçiş yapılarak girilebilenler.
   */
  function isFirsatlari(world, meta, oyuncu, istenenMeslek) {
    const liste = [];
    for (const b of Object.values(world.businesses)) {
      const kim = meta.npc[b.ownerId]; if (!kim) continue;
      if (oyuncu.employerBusinessId === b.id) continue;
      const def = T.getBusinessDef(b.type);
      if (Object.keys(b.employees).length >= def.staffNeeded) continue;
      const ml = (C().BUSINESS_STAFF_PROFESSIONS[b.type] || []).filter(m => m === oyuncu.profession || T.missingRequirements(world, oyuncu.id, m).length === 0);
      if (!ml.length) continue;
      const meslek = (istenenMeslek && ml.includes(istenenMeslek)) ? istenenMeslek : ml.includes(oyuncu.profession) ? oyuncu.profession : ml[0];
      const maas = isverenMaasi(world, kim, b, meslek);
      liste.push({ npcId: b.ownerId, isletmeId: b.id, isletme: b.type, meslek, maas, yer: yerAdi(kim), uyum: (meslek === istenenMeslek ? 2 : 0) + (meslek === oyuncu.profession ? 1 : 0) });
    }
    return liste.sort((a, b) => (b.uyum - a.uyum) || (b.maas - a.maas));
  }
  NPCYZ.isFirsatlari = isFirsatlari;
  /** Patronun teklif edeceği maaş: asgari ücretin üstü, mesleğin piyasa değerine yakın, cömertliğe göre. */
  function isverenMaasi(world, kim, b, meslek) {
    const taban = T.indexed(world, T.getBusinessDef(b.type).minWage);
    const piyasa = beklenenGelir(world, { k: { caliskan: .7 } }, meslek) * .9;
    return Math.round(Math.max(taban * lerp(1.05, 1.3, kim.k.comert), Math.min(piyasa, taban * 1.8)) / 500) * 500;
  }

  /** Oyuncunun ilanına uygun, iş arayan NPC'ler (kanalda "eleman arıyorum" dediğinde). */
  function isArayanlar(world, meta, oyuncu, meslek, tutar) {
    return Object.keys(meta.npc).filter(id => {
      const p = world.players[id]; if (!p || p.businessIds.length || p.employerBusinessId) return false;
      if (meslek && p.profession !== meslek && !(T.getProfession(meslek).tier === 1 && T.missingRequirements(world, id, meslek).length === 0)) return false;
      const simdi = suAnkiGelir(world, meta.npc[id], p);
      return p.mustWork || !p.profession || (tutar ? tutar >= simdi * .9 : simdi < T.indexed(world, C().MIN_WAGE) * 1.6);
    });
  }

  NPCYZ.oyuncuMesaji = function (world, meta, kanal, metin, oyuncu, saat, sirketNpcIdleri) {
    const rng = rngYap(hash(metin + ':' + Date.now()));
    const npcIdler = kanal === 'sirket' ? (sirketNpcIdleri || []).filter(id => meta.npc[id]) : Object.keys(meta.npc);
    const adlar = npcIdler.map(id => meta.npc[id].gorunen).concat(npcIdler.map(id => meta.npc[id].ad));
    const ny = (dil().niyetBul)(metin, { adlar, oyuncuAd: oyuncu.name });
    const dilTr = (dil().dilBul)(metin);
    const katli = (dil().normal)(metin).katli;
    const cevaplar = [];
    const simdi = Date.now();
    meta.diyalog = meta.diyalog || {};
    let st = meta.diyalog[kanal];
    if (st && simdi - st.zaman > KONU_SURE) st = null;
    const hedefKisi = ny.varlik && ny.varlik.kisi ? npcIdler.find(id => meta.npc[id].gorunen === ny.varlik.kisi || meta.npc[id].ad === ny.varlik.kisi || meta.npc[id].gorunen.startsWith(ny.varlik.kisi)) : null;
    // Küfür / hakaret: biri uyarır; ilişkiler bozulur
    if (ny.kufur || ny.niyet === 'hakaret') {
      meta.oyuncuHakaret = (meta.oyuncuHakaret || 0) + 1;
      if (hedefKisi) { const il = iliski(meta, hedefKisi); il.sevgi = sinir(il.sevgi - .4, -1, 1); il.hakaret++; }
      const uyaran = konusanSec(world, meta, rng, saat, id => npcIdler.includes(id) && meta.npc[id].k.resmi > .4);
      if (uyaran) cevaplar.push(cevapPaketi(world, meta, uyaran, 'cevap.hakaret', {}, rng, 2500));
      return { cevaplar, niyet: ny, uyari: meta.oyuncuHakaret >= 3 ? 'Sohbet kurallarına uymazsan bir süre yazman engellenebilir.' : null };
    }
    // Global kanalda yabancı dilde yazdıysa yabancılar cevap verir
    if (kanal === 'global' && dilTr !== 'tr') {
      const y = meta.yabanci.filter(x => x.dil === dilTr || x.dil === 'en');
      if (y.length) { const s = rng.pick(y); let m; try { m = (dil().uret)('global.' + s.dil + '.cevap', { ad: s.gorunen.split(/[ _]/)[0], oyuncuAd: oyuncu.name.split(' ')[0] }, stilOf({ k: s.k, ruh: .2 }), rng); } catch (e) { m = 'Hi!'; } cevaplar.push({ npcId: s.id, ad: s.gorunen, metin: m, gecikmeMs: 3000 + rng.next() * 5000 }); }
      return { cevaplar, niyet: ny };
    }

    // ---- Bağlam: bu mesaj önceki konunun devamı mı? ----
    let takip = st ? takipTuru(katli, ny, st) : null;
    const gucluYeniKonu = ny.guven >= .6 && !['evet', 'hayir', 'genel', 'teklif', 'maas_sorusu', 'fiyat_sorusu', 'kisisel_yer', 'tesekkur'].includes(ny.niyet) && (!st || ny.niyet !== st.konu);
    if (gucluYeniKonu && takip !== 'miktar' && takip !== 'yer') takip = null;
    if (st && ny.niyet === st.konu && !takip) takip = 'tekrar';
    const konu = takip ? st.konu : ny.niyet;
    const varlik = Object.assign({}, takip && st ? st.varlik : {}, ny.varlik || {});
    if (!st || !takip) st = { konu, varlik, cevaplayan: [], firsat: null, zaman: simdi };
    st.konu = konu; st.varlik = varlik; st.zaman = simdi; st.takip = takip;
    meta.diyalog[kanal] = st;
    const sonuc = { cevaplar, niyet: Object.assign({}, ny, { etkin: konu, takip }) };
    // Oyuncunun dile getirdiği ihtiyaç: sonradan biri dönüp sorar ("iş buldun mu?")
    const IHTIYAC = { is_ariyorum: 'is', mulk_ariyorum: 'mulk', dert: 'dert', eleman_ariyorum: 'eleman' };
    if (IHTIYAC[konu] && !takip && kanal === 'ulke') {
      meta.ihtiyac = (meta.ihtiyac || []).filter(x => x.tur !== IHTIYAC[konu]).concat([{ tur: IHTIYAC[konu], zaman: simdi, gun: world.day, npcler: [], once: { meslek: oyuncu.profession, isveren: oyuncu.employerBusinessId, mulk: oyuncu.propertyIds.length, nakit: oyuncu.cash, calisan: oyuncu.businessIds.length ? Object.keys((world.businesses[oyuncu.businessIds[0]] || { employees: {} }).employees).length : 0 }, soruldu: false }]).slice(-4);
    }

    // Hitap edilen kişi: her zaman o cevaplar (konusu ne olursa olsun)
    const ekle = (id, anahtar, slot, gec) => { const c = cevapPaketi(world, meta, id, anahtar, slot, rng, gec); cevaplar.push(c); (meta.ihtiyac || []).forEach(x => { if (x.zaman === simdi && !x.npcler.includes(id)) x.npcler.push(id); }); if (!st.cevaplayan.includes(id)) st.cevaplayan.push(id); st.sonNpc = id; iliski(meta, id).mesaj++; iliski(meta, id).tanir = true; return c; };
    const oAd = oyuncu.name.split(' ')[0];

    // ================= İŞ ARAYAN OYUNCU =================
    if (konu === 'is_ariyorum' && kanal !== 'sirket') {
      if (takip === 'ben_de' && varlik.meslek) st.istenenMeslek = varlik.meslek;
      const firsatlar = isFirsatlari(world, meta, oyuncu, st.istenenMeslek || varlik.meslek);
      const f = st.firsat && firsatlar.find(x => x.isletmeId === st.firsat.isletmeId) || null;
      const IYELIK = { dukkan: 'dükkanı', kafe: 'kafesi', fabrika: 'fabrikası' };
      const patronSlot = x => ({ isletme: isletmeAdi(x.isletme), isletmesi: IYELIK[x.isletme] || isletmeAdi(x.isletme), meslek: meslekAdi(x.meslek), tutar: paraYaz(x.maas), yer: x.yer, oyuncuAd: oAd });
      if (takip === 'miktar' && f) { ekle(f.npcId, 'cevap.takip_maas', patronSlot(f), 1200); return sonuc; }
      if (takip === 'yer' && f) { ekle(f.npcId, 'cevap.takip_yer', patronSlot(f), 1200); return sonuc; }
      if ((takip === 'detay' || takip === 'ne_zaman') && f) { ekle(f.npcId, 'cevap.takip_maas', patronSlot(f), 1500); return sonuc; }
      if (!f && st.tavsiye && (takip === 'miktar' || takip === 'onay' || takip === 'yer' || takip === 'detay')) { ekle(st.tavsiye.npcId, 'cevap.tavsiye_meslek', st.tavsiye.slot, 1500); return sonuc; }
      if (takip === 'onay' && f) {
        const cikti = []; teklifYap(world, meta, cikti, { tur: 'is', npcId: f.npcId, isletmeId: f.isletmeId, isletme: f.isletme, meslek: f.meslek, maas: f.maas, sure: 5 });
        ekle(f.npcId, 'cevap.takip_onay', patronSlot(f), 1200); sonuc.dm = cikti; return sonuc;
      }
      if (takip === 'ret') { if (f) ekle(f.npcId, 'cevap.takip_ret', {}, 1500); st.firsat = null; return sonuc; }
      if (takip === 'ben_de' && !firsatlar.length) { const id = st.sonNpc || konusanSec(world, meta, rng, saat); if (id) ekle(id, 'cevap.ben_de_meslek', { meslek: meslekAdi(varlik.meslek) }, 1500); return sonuc; }
      // Yeni soru ya da "yok mu?": henüz konuşmamış patronlar öne çıkar
      const yeniler = firsatlar.filter(x => !st.cevaplayan.includes(x.npcId));
      if (yeniler.length) {
        const ilk = yeniler[0];
        st.firsat = ilk;
        ekle(ilk.npcId, takip === 'tekrar' ? 'cevap.takip_tekrar' : 'cevap.is_teklif_ediyorum', patronSlot(ilk), takip === 'tekrar' ? 1500 : 2500);
        // İkinci bir patron ya da onu tanıyan biri yönlendirir
        const ikinci = yeniler[1];
        if (ikinci && rng.chance(.6)) ekle(ikinci.npcId, 'cevap.is_teklif_ediyorum', patronSlot(ikinci), 5000);
        else if (rng.chance(.5)) { const y = konusanSec(world, meta, rng, saat, id => id !== ilk.npcId && !world.players[id].businessIds.length); if (y) ekle(y, 'cevap.is_firsati_yonlendir', Object.assign(patronSlot(ilk), { kisi: meta.npc[ilk.npcId].ad }), 6000); }
        return sonuc;
      }
      // Açık yok (ya da hepsi zaten söylendi): dürüstçe söyle + gerçek alternatif (şartsız başlangıç işi)
      if (firsatlar.length && st.firsat) { ekle(st.firsat.npcId, 'cevap.takip_maas', patronSlot(st.firsat), 1500); return sonuc; }
      // Gerçekten açık yok: biri dürüstçe söyler, biri de hemen başlanabilecek şartsız işi gerçek kazancıyla önerir
      const id = (takip && st.sonNpc && !st.yokDendi) ? st.sonNpc : konusanSec(world, meta, rng, saat, x => !world.players[x].businessIds.length && !st.cevaplayan.includes(x));
      if (id && !st.yokDendi) { ekle(id, 'cevap.takip_yok', {}, 2000); st.yokDendi = true; }
      const t = tavsiye(world, oyuncu); delete t.kursUcret;
      const id2 = (st.tavsiye && st.tavsiye.npcId) || konusanSec(world, meta, rng, saat, x => x !== id);
      if (id2) { ekle(id2, 'cevap.tavsiye_meslek', t, id ? 5000 : 2000); st.tavsiye = { npcId: id2, slot: t }; }
      return sonuc;
    }

    // ================= ELEMAN ARAYAN OYUNCU =================
    if (konu === 'eleman_ariyorum' && kanal !== 'sirket') {
      const meslek = varlik.meslek || (oyuncu.businessIds.length ? (C().BUSINESS_STAFF_PROFESSIONS[world.businesses[oyuncu.businessIds[oyuncu.businessIds.length - 1]].type] || [])[0] : null);
      if ((takip === 'miktar' || takip === 'detay' || takip === 'yer' || takip === 'ne_zaman') && st.sonNpc && meta.npc[st.sonNpc] && world.players[st.sonNpc]) {
        const p = world.players[st.sonNpc], beklenti = Math.round(Math.max(suAnkiGelir(world, meta.npc[st.sonNpc], p) * 1.05, T.indexed(world, C().MIN_WAGE)) / 500) * 500;
        const anahtar = takip === 'miktar' ? 'cevap.teklif' : 'cevap.aday_benim';
        ekle(st.sonNpc, anahtar, { meslek: meslekAdi(meslek || p.profession), tutar: paraYaz(varlik.tutar && takip === 'miktar' ? Math.max(varlik.tutar, beklenti) : beklenti), sayi: String(p.experience[meslek || p.profession] || p.totalExperienceDays) }, 1500); return sonuc; }
      const adaylar = isArayanlar(world, meta, oyuncu, meslek, varlik.tutar).filter(id => !st.cevaplayan.includes(id));
      const sec = adaylar.sort((a, b) => meta.npc[b].k.sosyal - meta.npc[a].k.sosyal).slice(0, rng.chance(.5) ? 2 : 1);
      sec.forEach((id, i) => { const p = world.players[id]; ekle(id, 'cevap.aday_benim', { meslek: meslekAdi(meslek || p.profession), sayi: String(p.experience[meslek || p.profession] || p.totalExperienceDays) }, 2500 + i * 3000); });
      sonuc.adaylar = sec.map(id => ({ npcId: id, meslek }));
      if (!sec.length) { const id = konusanSec(world, meta, rng, saat); if (id) ekle(id, 'cevap.eleman_ariyorum', {}, 2500); }
      return sonuc;
    }

    // ================= MÜLK =================
    if ((konu === 'mulk_ariyorum' || konu === 'mulk_satiyorum') && kanal !== 'sirket') {
      if (konu === 'mulk_ariyorum') meta.mulkArayan = { mulk: varlik.mulk, bitis: world.day + 4 };
      if (takip === 'onay' && !st.satis && st.sonNpc && meta.npc[st.sonNpc]) { cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: 'Tamam, elimde yok ama satan biri çıkarsa sana yazarım. Kanalda da sık satılık ilan oluyor' }, rng, 1500)); meta.mulkArayan = { mulk: varlik.mulk, bitis: world.day + 4 }; return sonuc; }
      if (takip === 'onay' && st.satis && meta.npc[st.satis.npcId]) {
        const cikti = []; teklifYap(world, meta, cikti, { tur: 'mulk_sat', npcId: st.satis.npcId, mulkId: st.satis.mulkId, mulk: st.satis.mulk, fiyat: st.satis.fiyat, sure: 5 });
        ekle(st.satis.npcId, 'cevap.takip_onay', {}, 1500); sonuc.dm = cikti; return sonuc;
      }
      // Satan bir NPC var mı? (elinde kiradaki ya da boş mülkü olan, riskçi olan satar)
      if (konu === 'mulk_ariyorum' && (!takip || takip === 'tekrar' || takip === 'detay')) {
        const mulk = varlik.mulk || 'daire';
        const satici = Object.keys(meta.npc).filter(id => !st.cevaplayan.includes(id) && world.players[id] && world.players[id].propertyIds.some(x => world.properties[x] && world.properties[x].kind === mulk && !world.properties[x].ownerLivesIn) && meta.npc[id].k.risk > .3);
        const sid = satici.length ? satici[Math.floor(rng.next() * satici.length)] : null;
        if (sid) { const b = bilgi(world, meta, meta.npc[sid], 'mulk_ariyorum', Object.assign({}, varlik, { mulk }), oyuncu, katli, takip); if (b && b.satis) { st.satis = Object.assign({ npcId: sid }, b.satis); cevaplar.push(bilgiPaketi(world, meta, sid, b, rng, 2500)); st.cevaplayan.push(sid); st.sonNpc = sid; } }
      }
    }
    // ================= BİLGİ: gerçek veriye dayalı cevap =================
    if (!hedefKisi || true) {
      const kimId = (takip && st.sonNpc && meta.npc[st.sonNpc]) ? st.sonNpc : (hedefKisi || null);
      const dene = id => bilgi(world, meta, meta.npc[id], konu, varlik, oyuncu, katli, takip);
      let id = kimId, b = id ? dene(id) : null;
      if (!b && !kimId) { const aday = agirlikliSec(rng, npcIdler.filter(x => world.players[x] && !st.cevaplayan.includes(x)), x => niyetUygunluk(world, meta, x, Object.assign({}, ny, { niyet: konu }), oyuncu) * (DUZEN[meta.npc[x].kronotip][saat] + .15)); if (aday) { const b2 = dene(aday); if (b2) { id = aday; b = b2; } } }
      if (b && !b.satis) {
        cevaplar.push(bilgiPaketi(world, meta, id, b, rng, 2000)); if (!st.cevaplayan.includes(id)) st.cevaplayan.push(id); st.sonNpc = id; iliski(meta, id).mesaj++; iliski(meta, id).tanir = true;
        // Konuşkan biri bazen kendi deneyimini ekler (kalıp değil: konuya göre)
        if (!takip && rng.chance(.35) && ['ekonomi', 'mulk_ariyorum', 'kredi_sorusu', 'dert', 'kurs_sorusu', 'meslek_tavsiyesi'].includes(konu)) { const id2 = agirlikliSec(rng, npcIdler.filter(x => x !== id && world.players[x]), x => meta.npc[x].k.sosyal * (DUZEN[meta.npc[x].kronotip][saat] + .1)); if (id2) { const b2 = dene(id2); if (b2 && !b2.satis && b2.metin !== b.metin) { const c = bilgiPaketi(world, meta, id2, b2, rng, 5500); cevaplar.push(c); } } }
        return sonuc;
      }
      if (cevaplar.length) return sonuc;
    }

    // ================= GENEL: kim cevap verir? =================
    // Takip mesajı (konu belirsiz değilse): son cevap veren devam eder
    if (takip && st.sonNpc && meta.npc[st.sonNpc] && !hedefKisi) {
      const nyEt = Object.assign({}, ny, { niyet: konu, varlik });
      if (takip === 'ret' || takip === 'onay') { ekle(st.sonNpc, takip === 'ret' ? 'cevap.takip_ret' : 'cevap.evet', {}, 1500); return sonuc; }
      const c = npcCevap(world, meta, st.sonNpc, nyEt, metin, oyuncu, rng); if (c) { cevaplar.push(c); } return sonuc;
    }
    const adaylar = [];
    if (hedefKisi) adaylar.push(hedefKisi);
    const nyEtkin = Object.assign({}, ny, { niyet: konu, varlik });
    const ilgili = id => niyetUygunluk(world, meta, id, nyEtkin, oyuncu);
    // Anlaşılamayan mesaj: içi boş onay yok. Soruysa biri merakla sorar ya da susulur.
    const belirsiz = konu === 'genel' || ny.guven < .35;
    const cevapSayisi = hedefKisi ? 0 : belirsiz ? (ny.soru ? (rng.chance(.7) ? 1 : 0) : (rng.chance(.3) ? 1 : 0)) : ({ selam: 2, hal_hatir: 1, mulk_satiyorum: 1, mulk_ariyorum: 2, meslek_tavsiyesi: 2, kurs_sorusu: 1, yardim: 2, ekonomi: 2, bayram: 2, dert: 2, tebrik: 1, saka: 1, bot_musun: 1, kredi_sorusu: 1, fiyat_sorusu: 1, maas_sorusu: 1, tesekkur: 1, veda: 1, kisisel_yer: 2, kisisel_meslek: 2 }[konu] ?? (ny.soru ? 1 : rng.chance(.45) ? 1 : 0));
    for (let i = 0; i < cevapSayisi; i++) { const id = agirlikliSec(rng, npcIdler.filter(x => !adaylar.includes(x) && world.players[x]), x => ilgili(x) * (DUZEN[meta.npc[x].kronotip][saat] + .15)); if (id) adaylar.push(id); }
    adaylar.forEach((id, i) => {
      const c = belirsiz && id !== hedefKisi ? cevapPaketi(world, meta, id, ny.soru ? 'cevap.genel_soru' : 'cevap.genel', {}, rng) : npcCevap(world, meta, id, nyEtkin, metin, oyuncu, rng);
      if (c) { c.gecikmeMs += i * 2500; cevaplar.push(c); if (!st.cevaplayan.includes(id)) st.cevaplayan.push(id); st.sonNpc = id; }
    });
    return sonuc;
  };

  /** Bir NPC bu niyete ne kadar uygun bir cevapçı? */
  function niyetUygunluk(world, meta, id, ny, oyuncu) {
    const kim = meta.npc[id], p = world.players[id]; if (!p) return 0;
    let u = .1 + kim.k.sosyal * .6 + Math.max(0, iliski(meta, id).sevgi) * .5;
    switch (ny.niyet) {
      case 'is_ariyorum': if (p.businessIds.length) u += 2; break;
      case 'eleman_ariyorum': if (p.mustWork || (p.profession && T.getProfession(p.profession).tier === 1)) u += 1.2; break;
      case 'mulk_satiyorum': if (p.cash > T.propertyMarketPrice(world, (ny.varlik && ny.varlik.mulk) || 'daire')) u += 1.5; break;
      case 'mulk_ariyorum': if (p.propertyIds.some(x => world.properties[x] && !world.properties[x].ownerLivesIn)) u += 1.5; break;
      case 'ekonomi': case 'kredi_sorusu': if (['muhasebeci', 'doviz_burosu_sahibi', 'emlak_danismani'].includes(p.profession) || kim.hedef === 'yatirimci') u += 1.2; break;
      case 'meslek_tavsiyesi': case 'kurs_sorusu': case 'yardim': u += T.netWorth(world, p) > 300000 ? .8 : .2; u += kim.k.comert * .5; break;
      case 'dert': u += kim.k.comert * .8; break;
    }
    return u;
  }

  function cevapPaketi(world, meta, id, anahtar, slot, rng, gecikme) {
    const kim = meta.npc[id];
    let metin = konus(world, meta, kim, anahtar, slot, rng);
    // Somut bilgi verilmişse (tutar, işletme, meslek, yer) cevap bunlardan en az birini içermeli; boş genelleme yok.
    const somut = ['tutar', 'isletme', 'isletmesi', 'yer'].map(k => slot && slot[k]).filter(Boolean);
    if (somut.length) { const norm = x => String(x).toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü]/g, ''); const ic = m => somut.some(v => norm(m).includes(norm(v).slice(0, 6))); for (let i = 0; i < 8 && !ic(metin); i++) metin = konus(world, meta, kim, anahtar, slot, rng); }
    const hiz = lerp(260, 120, kim.k.kisaltma); // ms/karakter (yazma hızı)
    return { npcId: id, ad: kim.gorunen, metin, gecikmeMs: Math.round((gecikme || 1500) + Math.min(9000, metin.length * hiz * .35) + rng.next() * 2500) };
  }

  /** Bir NPC'nin oyuncunun mesajına cevabı: niyete göre, kendi gerçek verisiyle. */
  function npcCevap(world, meta, id, ny, metin, oyuncu, rng) {
    const kim = meta.npc[id], p = world.players[id], il = iliski(meta, id);
    il.mesaj++; il.son = world.day;
    const oAd = oyuncu.name.split(' ')[0];
    const ilkKez = !il.tanir; il.tanir = true;
    const s = { oyuncuAd: oAd };
    let anahtar = 'cevap.' + ny.niyet;
    switch (ny.niyet) {
      case 'selam': case 'hal_hatir': if (!ilkKez && il.mesaj > 2) anahtar = 'cevap.tanidik_selam'; break;
      case 'is_ariyorum': {
        if (p.businessIds.length) {
          const b = world.businesses[p.businessIds[p.businessIds.length - 1]], ml = C().BUSINESS_STAFF_PROFESSIONS[b.type] || [];
          const uy = (ny.varlik && ny.varlik.meslek && ml.includes(ny.varlik.meslek)) ? ny.varlik.meslek : ml.find(m => m === oyuncu.profession) || ml[0];
          const bos = Object.keys(b.employees).length < T.getBusinessDef(b.type).staffNeeded;
          if (bos && uy) { anahtar = 'cevap.is_teklif_ediyorum'; Object.assign(s, { isletme: isletmeAdi(b.type), meslek: meslekAdi(uy), tutar: paraYaz(Math.round(T.indexed(world, T.getBusinessDef(b.type).minWage) * 1.15 / 500) * 500) }); if (oyuncu.profession === uy && !oyuncu.businessIds.length) meta.isTeklifSansi = { npcId: id, bitis: world.day + 2 }; }
        } else { const t = tavsiye(world, oyuncu); delete t.kursUcret; anahtar = 'cevap.tavsiye_meslek'; Object.assign(s, t); }
        break;
      }
      case 'meslek_tavsiyesi': case 'yardim': case 'kurs_sorusu': { const t = tavsiye(world, oyuncu); anahtar = t.kurs && ny.niyet === 'kurs_sorusu' ? 'cevap.kurs_sorusu' : 'cevap.tavsiye_meslek'; Object.assign(s, t); if (anahtar === 'cevap.kurs_sorusu' && t.kursUcret) s.tutar = t.kursUcret; delete s.kursUcret; break; }
      case 'maas_sorusu': Object.assign(s, { meslek: meslekAdi((ny.varlik && ny.varlik.meslek) || p.profession), tutar: paraYaz(beklenenGelir(world, kim, (ny.varlik && ny.varlik.meslek) || p.profession)) }); break;
      case 'ekonomi': { const y = meta.yonetici.gecmis; const enf = y.length > 1 ? (y[y.length - 1].endeks / y[Math.max(0, y.length - 13)].endeks - 1) * 100 : (world.priceIndex - 1) * 100; Object.assign(s, { sayi: '%' + enf.toLocaleString('tr-TR', { maximumFractionDigits: 1 }), konu: 'faiz %' + (world.policy.loanMonthlyRate * 100).toLocaleString('tr-TR') }); break; }
      case 'kredi_sorusu': Object.assign(s, { sayi: '%' + (world.policy.loanMonthlyRate * 100).toLocaleString('tr-TR'), tutar: paraYaz(Math.round(oyuncu.lastMonthIncome * oyuncu.creditScore / 100)) }); break;
      case 'mulk_satiyorum': case 'mulk_ariyorum': case 'fiyat_sorusu': { const m = (ny.varlik && ny.varlik.mulk) || 'daire'; Object.assign(s, { mulk: mulkAdi(m), tutar: paraYaz(T.propertyMarketPrice(world, m)) }); break; }
      case 'kisisel_meslek': Object.assign(s, { meslek: meslekAdi(p.profession), sayi: String(world.day - p.professionSince) }); break;
      case 'kisisel_yer': Object.assign(s, { yer: yerAdi(kim) }); break;
      case 'kisisel_ad': Object.assign(s, { ad: kim.ad }); break;
      case 'dert': il.sevgi = sinir(il.sevgi + .03, -1, 1); { const t = tavsiye(world, oyuncu); delete t.kursUcret; Object.assign(s, t); } break;
      case 'iltifat': il.sevgi = sinir(il.sevgi + .08, -1, 1); kim.ruh = sinir(kim.ruh + .1, -1, 1); break;
      case 'teklif': if (ny.varlik && ny.varlik.tutar) s.tutar = paraYaz(ny.varlik.tutar); break;
      case 'bayram': { const o = ozelGun(world.day); s.konu = o ? o.ad : 'bayramın'; break; }
    }
    il.sevgi = sinir(il.sevgi + .01, -1, 1);
    if (il.konular.indexOf(ny.niyet) < 0) { il.konular.push(ny.niyet); if (il.konular.length > 12) il.konular.shift(); }
    return cevapPaketi(world, meta, id, anahtar, s, rng);
  }

  /** Oyuncuya gerçek veriye dayalı tavsiye: bir sonraki en iyi adım (meslek ya da kurs). */
  function tavsiye(world, o) {
    const sahte = { k: { caliskan: .75, hirs: .6 } };
    const simdi = o.profession ? beklenenGelir(world, sahte, o.profession) : 0;
    let en = null;
    for (const m of C().PROFESSIONS) { if (m.id === o.profession || m.earning === 'business') continue; if (T.missingRequirements(world, o.id, m.id).length) continue; const g = beklenenGelir(world, sahte, m.id); if (g > simdi * 1.1 && (!en || g > en.g)) en = { m, g }; }
    if (en) return { meslek: meslekAdi(en.m.id), tutar: paraYaz(en.g) };
    // Uygun daha iyi iş yok: hedef için kurs öner
    const kurs = ['kamu_sinavi', 'muhasebe', 'emlak_belgesi', 'ustalik'].find(c => !o.completedCourses.includes(c));
    if (kurs) { const acar = C().PROFESSIONS.find(m => m.requirements.course === kurs); return { kurs: kursAdi(kurs), meslek: meslekAdi(acar ? acar.id : ''), tutar: paraYaz(acar ? beklenenGelir(world, sahte, acar.id) : 0), kursUcret: paraYaz(T.indexed(world, T.getCourse(kurs).cost)) }; }
    return { meslek: meslekAdi(o.profession), tutar: paraYaz(simdi) };
  }
  NPCYZ.tavsiye = tavsiye;

  /**
   * Oyuncu bir NPC'ye özel mesaj yazdı.
   * Bekleyen teklif varsa "evet/tamam/kabul" kabul, "hayır" red, tutar pazarlık sayılır.
   * Çalışansa zam/maaş konuşması; yoksa sohbet cevabı.
   */
  NPCYZ.dmGonder = function (world, meta, npcId, metin, oyuncu) {
    const kim = meta.npc[npcId]; if (!kim) return null;
    dmEkle(meta, npcId, { kimden: 'oyuncu', metin, gun: world.day });
    const rng = rngYap(hash(npcId + metin + Date.now()));
    const ny = (dil().niyetBul)(metin, { adlar: [kim.gorunen, kim.ad], oyuncuAd: oyuncu.name });
    const t = meta.teklifler.find(x => x.npcId === npcId && x.durum === 'bekliyor' && x.bitis >= world.day);
    let sonuc = null;
    if (t) {
      if (ny.niyet === 'evet' || ny.niyet === 'oneri_kabul') sonuc = NPCYZ.teklifCevap(world, meta, t.id, oyuncu.id, 'kabul');
      else if (ny.niyet === 'hayir') sonuc = NPCYZ.teklifCevap(world, meta, t.id, oyuncu.id, 'red');
      else if (ny.varlik && ny.varlik.tutar) sonuc = NPCYZ.teklifCevap(world, meta, t.id, oyuncu.id, { tutar: ny.varlik.tutar });
      if (sonuc) return sonuc.ok ? { metin: sonuc.mesaj, gecikmeMs: 0, islem: sonuc.islem || null, ok: true, zatenEklendi: true } : { hata: sonuc.mesaj, ok: false, zatenEklendi: true };
    }
    // İş arayan oyuncu, "iş arıyorum" dediği işletme sahibine yazdı: gerçek teklif açılır
    if (meta.isTeklifSansi && meta.isTeklifSansi.npcId === npcId && (ny.niyet === 'evet' || ny.niyet === 'is_ariyorum' || ny.niyet === 'oneri_kabul')) {
      const p = world.players[npcId], b = p && p.businessIds.length && world.businesses[p.businessIds[p.businessIds.length - 1]];
      meta.isTeklifSansi = null;
      if (b && (C().BUSINESS_STAFF_PROFESSIONS[b.type] || []).includes(oyuncu.profession)) { const cikti = []; teklifYap(world, meta, cikti, { tur: 'is', npcId, isletmeId: b.id, isletme: b.type, meslek: oyuncu.profession, maas: Math.round(Math.max(oyuncuGelir(world, oyuncu) * 1.1, T.indexed(world, T.getBusinessDef(b.type).minWage) * 1.15) / 500) * 500, sure: 4 }); const son = meta.dm[npcId][meta.dm[npcId].length - 1]; meta.dm[npcId].pop(); return { metin: son.metin, gecikmeMs: 3000, teklif: true }; }
    }
    // Oyuncu bu NPC'nin işletmesinde çalışıyor ve zam istiyor: işveren karar verir
    const isyeri = oyuncu.employerBusinessId && world.businesses[oyuncu.employerBusinessId];
    if (isyeri && isyeri.ownerId === npcId && (ny.niyet === 'zam_istegi' || ny.niyet === 'maas_sorusu' || /\bzam\b/i.test(metin))) {
      const il = iliski(meta, npcId), maas = isyeri.employees[oyuncu.id] || 0;
      if (meta.zamCevap && meta.zamCevap[oyuncu.id] > world.day - 15) return { metin: konus(world, meta, kim, 'dm.cevap_genel', {}, rng) + ' Zammı daha yeni konuştuk ama, biraz bekleyelim.', gecikmeMs: 3000 };
      meta.zamCevap = meta.zamCevap || {}; meta.zamCevap[oyuncu.id] = world.day;
      const calisma = Math.min(1, oyuncu.tasksThisMonth / 20), kasa = isyeri.cash > maas * 3 ? .2 : -.2;
      const puan = .35 + il.sevgi * .4 + calisma * .35 + kasa + kim.k.comert * .2 - kim.k.tutum * .2 + sansGucu(world, meta) * .3;
      if (rng.next() < sinir(puan, .05, .9)) {
        const yeni = Math.round(maas * (1 + lerp(.05, .15, rng.next())) / 500) * 500; isyeri.employees[oyuncu.id] = yeni; il.sevgi = sinir(il.sevgi + .05, -1, 1);
        return { metin: konus(world, meta, kim, 'dm.zam_tesekkur', {}, rng).replace(/\.?$/, '') + ` — maaşını ${paraYaz(yeni)} yaptım.`, gecikmeMs: 4000, islem: 'zam' };
      }
      return { metin: konus(world, meta, kim, 'dm.yetki_red', { konu: 'zam' }, rng) + (calisma < .5 ? ' Bu ay biraz az çalıştın, önce onu düzeltelim.' : ' Kasa şu an pek uygun değil.'), gecikmeMs: 4000 };
    }
    // Çalışan: zam konuşması
    if (kim.calisan && (ny.niyet === 'zam_istegi' || ny.niyet === 'maas_sorusu')) { const m = konus(world, meta, kim, 'dm.calisan_rapor', {}, rng); return { metin: m, gecikmeMs: 2500 }; }
    if (ny.kufur || ny.niyet === 'hakaret') { const il = iliski(meta, npcId); il.sevgi = sinir(il.sevgi - .4, -1, 1); il.hakaret++; if (kim.calisan) kim.calisan.moral = sinir(kim.calisan.moral - .25, 0, 1); }
    // Özel konuşmanın da bağlamı var: takip soruları, gerçek bilgi, kendi işletmesindeki açık
    meta.diyalog = meta.diyalog || {};
    const dk = 'dm:' + npcId, simdi = Date.now(), katli = (dil().normal)(metin).katli;
    let st = meta.diyalog[dk]; if (st && simdi - st.zaman > 30 * 60e3) st = null;
    const takip = st ? takipTuru(katli, ny, st) : null;
    const gucluYeni = ny.guven >= .6 && !['evet', 'hayir', 'genel', 'teklif', 'maas_sorusu', 'fiyat_sorusu', 'kisisel_yer', 'tesekkur'].includes(ny.niyet) && (!st || ny.niyet !== st.konu);
    const konu = takip && !gucluYeni ? st.konu : ny.niyet;
    const varlik = Object.assign({}, takip && st ? st.varlik : {}, ny.varlik || {});
    meta.diyalog[dk] = { konu, varlik, zaman: simdi, cevaplayan: [npcId], sonNpc: npcId };
    const p = world.players[npcId];
    // İş arayan oyuncu, işletmesi olan NPC'ye yazdı: açığı varsa gerçek teklif
    const bekleyen = meta.teklifler.find(x => x.npcId === npcId && x.durum === 'bekliyor' && x.bitis >= world.day && x.tur === 'is');
    if (bekleyen && (konu === 'is_ariyorum' || takip)) {
      const sl = { isletme: isletmeAdi(bekleyen.isletme), meslek: meslekAdi(bekleyen.meslek), tutar: paraYaz(bekleyen.maas), yer: yerAdi(kim) };
      const an = takip === 'yer' ? 'cevap.takip_yer' : takip === 'miktar' || takip === 'detay' ? 'cevap.takip_maas' : 'cevap.takip_onay';
      const c2 = cevapPaketi(world, meta, npcId, an, sl, rng); return { metin: c2.metin, gecikmeMs: c2.gecikmeMs };
    }
    if (konu === 'is_ariyorum' && p && p.businessIds.length && !oyuncu.businessIds.length) {
      const f = isFirsatlari(world, meta, oyuncu, varlik.meslek).find(x => x.npcId === npcId);
      if (f) { const cikti = []; teklifYap(world, meta, cikti, { tur: 'is', npcId, isletmeId: f.isletmeId, isletme: f.isletme, meslek: f.meslek, maas: f.maas, sure: 5 }); const son = meta.dm[npcId].pop(); return { metin: son.metin, gecikmeMs: 3500, teklif: true }; }
      return { metin: konus(world, meta, kim, 'cevap.takip_yok', {}, rng), gecikmeMs: 3000 };
    }
    const b = bilgi(world, meta, kim, konu, varlik, oyuncu, katli, takip);
    if (b && !b.satis) { const c0 = bilgiPaketi(world, meta, npcId, b, rng, 1500); return { metin: c0.metin, gecikmeMs: c0.gecikmeMs }; }
    if (b && b.satis) { meta.diyalog[dk].satis = Object.assign({ npcId }, b.satis); const c0 = bilgiPaketi(world, meta, npcId, b, rng, 1500); return { metin: c0.metin, gecikmeMs: c0.gecikmeMs }; }
    if (st && st.satis && takip === 'onay') { const cikti = []; teklifYap(world, meta, cikti, { tur: 'mulk_sat', npcId, mulkId: st.satis.mulkId, mulk: st.satis.mulk, fiyat: st.satis.fiyat, sure: 5 }); const son = meta.dm[npcId].pop(); return { metin: son.metin, gecikmeMs: 2500, teklif: true }; }
    const nyEt = Object.assign({}, ny, { niyet: konu === 'genel' && ny.soru ? 'genel' : konu, varlik });
    if ((konu === 'genel' || ny.guven < .35) && !takip) { const c1 = cevapPaketi(world, meta, npcId, ny.soru ? 'cevap.genel_soru' : 'cevap.genel', {}, rng); return { metin: c1.metin, gecikmeMs: c1.gecikmeMs }; }
    const c = npcCevap(world, meta, npcId, nyEt, metin, oyuncu, rng);
    return { metin: c.metin, gecikmeMs: c.gecikmeMs };
  };
  /** Arayüz cevabı gösterince DM'e ekler (gecikmeden sonra). */
  NPCYZ.dmCevapEkle = (world, meta, npcId, metin) => dmEkle(meta, npcId, { kimden: 'npc', metin, gun: world.day });
  NPCYZ.dmOkundu = (meta, npcId) => (meta.dm[npcId] || []).forEach(m => (m.okundu = true));

  // ------------------------------------------------------------------
  // Sıralama, katkı, haberler
  // ------------------------------------------------------------------
  /** Gerçek sıralamalar: ülkede (herkes), şehrinde (NPC'nin yeri), dünyada (yabancılar dahil), ülkeler kişi başı. */
  NPCYZ.siralama = function (world, meta, oyuncuId, sehir = 'İstanbul', usdKur = 42.1) {
    const kisi = Object.values(world.players).map(p => ({ id: p.id, ad: p.name, net: T.netWorth(world, p), sehir: meta.npc[p.id] ? meta.npc[p.id].yer.sehir : sehir, oyuncu: p.id === oyuncuId })).sort((a, b) => b.net - a.net);
    const sira = (l) => l.map((x, i) => Object.assign({ sira: i + 1 }, x));
    const ulke = sira(kisi), sehirL = sira(kisi.filter(x => x.sehir === sehir));
    const dunya = sira(kisi.map(x => Object.assign({}, x, { usd: x.net / usdKur, ulke: 'TR' })).concat(meta.yabanci.map(y => ({ id: y.id, ad: y.gorunen, usd: y.servetUsd, ulke: { en: 'GB', de: 'DE', es: 'ES', az: 'AZ', ar: 'AE' }[y.dil] || '—' }))).sort((a, b) => b.usd - a.usd));
    const tr = kisi.reduce((t, x) => t + x.net, 0) / Math.max(1, kisi.length) / usdKur;
    const ulkeler = {};
    meta.yabanci.forEach(y => { const u = { en: 'Birleşik Krallık', de: 'Almanya', es: 'İspanya', az: 'Azerbaycan', ar: 'BAE' }[y.dil] || 'Diğer'; (ulkeler[u] = ulkeler[u] || []).push(y.servetUsd); });
    const ulkeListe = [{ ad: 'Türkiye', kisiBasi: tr, biz: true }].concat(Object.keys(ulkeler).map(u => ({ ad: u, kisiBasi: ulkeler[u].reduce((a, b) => a + b, 0) / ulkeler[u].length * .06 }))).sort((a, b) => b.kisiBasi - a.kisiBasi).map((x, i) => Object.assign({ sira: i + 1 }, x));
    const sehirler = {};
    kisi.forEach(x => { (sehirler[x.sehir] = sehirler[x.sehir] || []).push(x.net); });
    const sehirListe = Object.keys(sehirler).filter(s => sehirler[s].length >= 2).map(s => ({ ad: s, kisiBasi: sehirler[s].reduce((a, b) => a + b, 0) / sehirler[s].length, biz: s === sehir })).sort((a, b) => b.kisiBasi - a.kisiBasi).map((x, i) => Object.assign({ sira: i + 1 }, x));
    const toplam = kisi.reduce((t, x) => t + Math.max(0, x.net), 0);
    const ben = kisi.find(x => x.oyuncu);
    return { ulke, sehir: sehirL, dunya, ulkeler: ulkeListe, sehirler: sehirListe, katki: ben && toplam ? Math.max(0, ben.net) / toplam * 100 : 0 };
  };

  /** Haber akışı için NPC dünyasından önemli olaylar (arayüz alır ve temizler). */
  NPCYZ.haberleriAl = function (world, meta) {
    const h = meta.haber.splice(0);
    return h.filter(x => meta.npc[x.npcId]).map(x => {
      const kim = meta.npc[x.npcId], v = x.veri || {};
      const metin = { isletme_acti: `${kim.gorunen}, ${yerAdi(kim)} semtinde ${isletmeAdi(v.isletme).toLocaleLowerCase('tr')} açtı.`, mulk_aldi: v.ev ? `${kim.gorunen} kendi evini aldı.` : `${kim.gorunen} yatırım için ${mulkAdi(v.mulk)} aldı.`, isletme_kapandi: `${kim.gorunen}'in işletmesi kapandı.`, katildi: `${kim.gorunen} oyuna katıldı.` }[x.tur];
      return metin ? { baslik: { isletme_acti: 'Yeni işletme', mulk_aldi: 'Mülk', isletme_kapandi: 'İşletme kapandı', katildi: 'Yeni oyuncu' }[x.tur], metin, npcId: x.npcId } : null;
    }).filter(Boolean);
  };

  /** NPC profilinin oyuncuya gösterilebilir özeti (profil penceresi için). */
  NPCYZ.profil = function (world, meta, id) {
    const kim = meta.npc[id], p = world.players[id]; if (!kim || !p) return null;
    const il = iliski(meta, id);
    return { id, ad: kim.gorunen, yer: kim.yer, meslek: p.profession ? meslekAdi(p.profession) : 'İşsiz', net: T.netWorth(world, p), itibar: p.reputation, deneyim: p.totalExperienceDays, isletme: p.businessIds.length ? isletmeAdi(world.businesses[p.businessIds[0]] && world.businesses[p.businessIds[0]].type) : null, karakter: ARKETIP[kim.arketip].ad, iliski: il.sevgi > .4 ? 'Arkadaşın' : il.sevgi > .1 ? 'İyi tanışıyorsunuz' : il.sevgi < -.3 ? 'Aranız bozuk' : il.tanir ? 'Tanışıyorsunuz' : 'Tanımıyorsun', calisan: kim.calisan ? { moral: kim.calisan.moral, zamIstegi: kim.calisan.zamIstegi || null, istifa: kim.calisan.istifa } : null };
  };
  NPCYZ.npcMi = (meta, id) => !!(meta && meta.npc[id]);
  NPCYZ.ARKETIP = ARKETIP;

  G.NPCYZ = NPCYZ;
  if (typeof module !== 'undefined' && module.exports) module.exports = NPCYZ;
})();
