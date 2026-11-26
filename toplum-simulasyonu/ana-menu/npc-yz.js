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

  /** Arkadaşlık: aynı ilçeden olanlar ve birkaç rastgele tanıdık (iki yönlü). */
  function arkadasBagla(meta, id, rng) {
    meta.dost = meta.dost || {};
    const kim = meta.npc[id], digerleri = Object.keys(meta.npc).filter(x => x !== id);
    const ayniYer = digerleri.filter(x => meta.npc[x].yer && kim.yer && meta.npc[x].yer.ilce === kim.yer.ilce);
    const hedef = 2 + Math.floor(kim.k.sosyal * 4);
    const sec = ayniYer.slice(0, 3).concat(digerleri.filter(() => rng.chance(.04))).slice(0, hedef);
    meta.dost[id] = [...new Set((meta.dost[id] || []).concat(sec))].slice(0, 8);
    sec.forEach(x => { meta.dost[x] = [...new Set((meta.dost[x] || []).concat([id]))].slice(0, 8); });
  }
  NPCYZ.dostlar = (meta, id) => (meta.dost && meta.dost[id]) || [];
  /** Oyuncuyla aynı ilk adı taşıyan NPC'lere başka ad verir ("Eymen Kuru: slm Eymen" karışıklığı olmasın). */
  function adCakismasi(world, meta, oyuncu) {
    if (!oyuncu || !oyuncu.name || meta.adKontrol === oyuncu.name) return;
    meta.adKontrol = oyuncu.name;
    const ilk = oyuncu.name.split(/\s+/)[0].toLocaleLowerCase('tr'), v = dil().veri, adlar = new Set(Object.values(world.players).map(p => p.name));
    const rng = rngYap(hash(oyuncu.name));
    for (const kim of Object.values(meta.npc).concat(meta.figuran || [])) {
      if (kim.ad.toLocaleLowerCase('tr') !== ilk) continue;
      const liste = (kim.kadin ? v.kadinAdlari : v.erkekAdlari).filter(a => a.toLocaleLowerCase('tr') !== ilk);
      for (let i = 0; i < 20; i++) {
        const yeni = rng.pick(liste), kucuk = yeni.toLocaleLowerCase('tr');
        const asc = x => x.replace(/[çğıöşü]/g, h => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[h]);
        const g = kim.gorunen.replace(new RegExp(kim.ad, 'g'), yeni).replace(new RegExp(kim.ad.toLocaleLowerCase('tr'), 'g'), kucuk).replace(new RegExp(asc(kim.ad.toLocaleLowerCase('tr')), 'gi'), m => /^[A-Z]/.test(m) ? asc(yeni) : asc(kucuk));
        if (g === kim.gorunen || adlar.has(g)) continue;
        adlar.add(g); kim.ad = yeni; kim.gorunen = g; if (world.players[kim.id] && meta.npc[kim.id]) world.players[kim.id].name = g; break;
      }
    }
  }
  NPCYZ.adCakismasi = adCakismasi;
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
    arkadasBagla(meta, p.id, rng);
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
    if (!meta.dost) Object.keys(meta.npc).forEach(id => arkadasBagla(meta, id, rng));
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
    if (meta.olayKuyrugu.filter(o => o.tur === tur).length >= 3) return; // aynı türden en çok 3 paylaşım beklesin
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
      if (rngYap(hash(id + world.day)).chance(.1)) olay(meta, id, iyi ? 'ay_sonu_iyi' : 'ay_sonu_kotu', { tutar: p.lastMonthIncome });
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
    // 2b) Dostça özel mesaj
    dostMesaji(world, meta, oyuncu, rng, cikti);
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
  /** Dostça özel mesaj: iyi anlaştığı biri ara sıra yazar (gerçek duruma dayalı). */
  function dostMesaji(world, meta, oyuncu, rng, cikti) {
    if (meta.sonDostDm != null && world.day - meta.sonDostDm < 6) return;
    const yakin = Object.keys(meta.iliski).filter(id => meta.npc[id] && world.players[id] && meta.iliski[id].sevgi > .15 && meta.iliski[id].tanir);
    if (!yakin.length || !rng.chance(.12)) return;
    const id = yakin[Math.floor(rng.next() * yakin.length)], kim = meta.npc[id], p = world.players[id], oAd = oyuncu.name.split(' ')[0];
    const secenek = [];
    if (oyuncu.profession) secenek.push(`selam ${oAd}, ${meslekAdi(oyuncu.profession)} işi nasıl gidiyor?`);
    if (!oyuncu.profession || oyuncu.mustWork) { const f = isFirsatlari(world, meta, oyuncu)[0]; if (f) secenek.push(`${oAd} hâlâ iş arıyorsan ${meta.npc[f.npcId] ? meta.npc[f.npcId].ad : 'bir tanıdık'} ${meslekAdi(f.meslek)} arıyor, ${paraYaz(f.maas)} veriyormuş`); }
    if (p.cash > T.propertyMarketPrice(world, 'daire') * .25 && !evdeMi(world, p)) secenek.push(`${oAd} ev almayı düşünüyorum, krediyle mi alsam peşin mi biriktirsem? sen ne dersin`);
    if (p.courseInProgress) secenek.push(`${kursSoz(p.courseInProgress.course)} kursuna başladım, ${Math.max(1, p.courseInProgress.finishesOnDay - world.day)} gün kaldı. sen kurs aldın mı hiç?`);
    if (p.businessIds.length) secenek.push(`${oAd} bizim ${isletmeAdi(world.businesses[p.businessIds[0]] && world.businesses[p.businessIds[0]].type)} bu ay fena değil, bir gün uğra`);
    secenek.push(`naber ${oAd}, uzun zamandır yazmıyorsun`, `${oAd} kanalda görmedim seni bugün, her şey yolunda mı?`);
    let m = rng.pick(secenek); try { m = (dil().stillendir)(m, stilOf(kim), rng); } catch (e) { }
    m = yuvarla(m, rng);
    dmEkle(meta, id, { kimden: 'npc', metin: m, gun: world.day });
    meta.sonDostDm = world.day;
    cikti.push({ tur: 'dm', npcId: id, baslik: kim.gorunen + ' yazdı', metin: m });
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
    return { resmi: k.resmi ?? .5, emoji: 0, kisaltma: k.kisaltma ?? .2, hata: (k.hata ?? .2) * .6, nese: kim.ruh ?? 0, uzunluk: k.sosyal ?? .5, ascii: !!kim.ascii, buyukHarf: (k.resmi ?? .5) > .45 };
  }
  NPCYZ.stil = stilOf;
  // ---- İnsanlaştırıcı ----
  /** Tam olmayan rakamları konuşma diline çevirir: 1.786.837 ₺ → 1,8 milyon civarı; 54.346 ₺ → 54 bin falan. Yuvarlak rakamlar (teklifler) kalır. */
  function yuvarla(metin, rng) {
    return metin.replace(/(\d{1,3}(?:\.\d{3})+) ₺( civarı)?('(?:ye|ya|e|a|den|dan|ten|tan|de|da|te|ta))?/g, (tam, sayi, civ, hal) => {
      const n = +sayi.replace(/\./g, '');
      if (n >= 1e6 ? n % 10000 === 0 : n % 500 === 0) return tam;
      // Ek varsa: "846 bine", "1,8 milyona" (yaklaşık ifade eki yutar)
      if (hal) { const h = hal.slice(1); const tip = /^(ye|e|ya|a)$/.test(h) ? 'yon' : /^(den|dan|ten|tan)$/.test(h) ? 'den' : 'de';
        if (n >= 1e6) return (Math.round(n / 1e5) / 10).toLocaleString('tr-TR') + ' milyon' + { yon: 'a', den: 'dan', de: 'da' }[tip];
        if (n >= 10000) return Math.round(n / 1000) + ' bin' + { yon: 'e', den: 'den', de: 'de' }[tip]; }
      const ek = civ || (rng && rng.chance(.5) ? ' civarı' : ' falan');
      if (n >= 1e6) return (Math.round(n / 1e5) / 10).toLocaleString('tr-TR') + ' milyon' + ek;
      if (n >= 10000) return Math.round(n / 1000) + ' bin' + ek;
      return (Math.round(n / 100) * 100).toLocaleString('tr-TR') + ' ₺';
    }).replace(/(civarı|falan) (civarı|civari|falan|kadar|gibi)(?=[\s.,!?]|$)/g, '$1');
  }
  NPCYZ.yuvarla = yuvarla;
  /** Yüzdeye iyelik eki: %0,6'sı, %50'si, %3'ü, %40'ı (okunuşun son sözcüğüne göre). */
  function yuzdeSi(n) {
    const yaz = String(n).replace('.', ',');
    const son = yaz.replace(/^.*[,]/, x => x).split(',').pop().replace(/^0+(?=\d)/, '');
    const k = +son, oku = k === 0 ? 'sıfır' : k % 10 ? ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'][k % 10] : k % 100 ? ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'][(k % 100) / 10] : k % 1000 ? 'yüz' : 'bin';
    const unlu = (oku.match(/[aıoueiöü](?=[^aıoueiöü]*$)/) || ['a'])[0], ek = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[unlu];
    return '%' + yaz + "'" + (/[aıoueiöü]$/.test(oku) ? 's' : '') + ek;
  }
  NPCYZ.yuzdeSi = yuzdeSi;
  const normSoz = m => String(m).toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü]/g, '').slice(0, 40);
  /** Bu NPC bunu yakın zamanda söyledi mi ya da kanalda biri aynısını mı dedi? */
  function tekrarMi(meta, kim, metin) {
    const n = normSoz(metin), k30 = n.slice(0, 22);
    return (kim.sonSozler || []).some(x => x === n || x.slice(0, 22) === k30) || (meta.sonKaliplar || []).includes(k30);
  }
  function soyledi(meta, kim, metin) {
    const n = normSoz(metin); kim.sonSozler = (kim.sonSozler || []).concat([n]).slice(-6);
    meta.sonKaliplar = (meta.sonKaliplar || []).concat([n.slice(0, 22)]).slice(-40);
    const b = basKelimeler(metin); if (b) meta.sonBaslar = (meta.sonBaslar || []).concat([b]).slice(-30);
  }
  // Kalıp açılışı (ilk üç kelime): farklı kişiler aynı cümleyle başlamasın ("Kusura bakma geç gördüm...")
  function basKelimeler(metin) { const w = String(metin).toLocaleLowerCase('tr').replace(/@\S+/g, '').replace(/[^0-9a-zçğıöşü ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 3).join(' '); return w.length >= 12 ? w : null; }
  function basTekrar(meta, metin) { const b = basKelimeler(metin); return !!b && (meta.sonBaslar || []).includes(b); }
  // Sohbette insanlar resmî adları değil gündelik adları kullanır.
  const MESLEK_SOZ = { garson: 'garson', insaat_iscisi: 'inşaat işçisi', kurye: 'kurye', market_calisani: 'kasiyer', memur: 'memur', emlak_danismani: 'emlak danışmanı', muhasebeci: 'muhasebeci', usta: 'usta', kafe_sahibi: 'kafe sahibi', dukkan_sahibi: 'dükkan sahibi', tasaron: 'taşeron', nakliyeci: 'nakliyeci', emlak_ofisi_sahibi: 'emlakçı', doviz_burosu_sahibi: 'dövizci', ithalat_ihracat: 'ithalatçı', muteahhit: 'müteahhit', fabrikator: 'fabrikatör' };
  const ISLETME_SOZ = { dukkan: 'dükkan', kafe: 'kafe', tasaron: 'taşeron firması', emlak_ofisi: 'emlak ofisi', doviz_burosu: 'döviz bürosu', ithalat_ihracat: 'dış ticaret firması', muteahhit: 'inşaat firması', fabrika: 'fabrika' };
  const meslekAdi = id => (id ? MESLEK_SOZ[id] || (T.t ? T.t('meslek.' + id) : id).toLocaleLowerCase('tr') : '');
  const isletmeAdi = id => (id ? ISLETME_SOZ[id] || (T.t ? T.t('isletme.' + id) : id).toLocaleLowerCase('tr') : '');
  const mulkAdi = id => (id ? (T.t ? T.t('mulk_turu.' + id) : id).toLocaleLowerCase('tr') : '');
  const KURS_SOZ = { kamu_sinavi: 'KPSS kursu', muhasebe: 'muhasebe kursu', emlak_belgesi: 'emlak kursu', ustalik: 'ustalık kursu', muteahhitlik: 'müteahhitlik belgesi', doviz_lisansi: 'döviz lisansı', dis_ticaret: 'dış ticaret kursu' };
  const kursSoz = id => (id ? KURS_SOZ[id] || (T.t ? T.t('kurs.' + id) : id).toLocaleLowerCase('tr') : '');
  const kursAdi = id => kursSoz(id);
  const yerAdi = kim => (kim.yer ? (kim.yer.ilce || kim.yer.sehir) : '');

  function konus(world, meta, kim, anahtar, slot, rng) {
    const p = world.players[kim.id];
    const s = Object.assign({ ad: kim.ad, meslek: p && p.profession ? meslekAdi(p.profession) : 'işsiz', yer: yerAdi(kim) }, slot);
    for (const k in s) if (s[k] == null || s[k] === '') delete s[k];
    let m = '';
    // Bayram kutlaması bayram olmayan bir günde (Yılbaşı, 23 Nisan...): o güne uygun kısa kutlama
    if (anahtar === 'cevap.bayram') { const o = ozelGun(world.day); if (o && !o.bayram && !/(bayram|mubarek|kandil|bayraminiz|bayramin)/.test(meta._gelen || '')) { m = rng.pick(o.ad === 'Yılbaşı' ? ['Mutlu yıllar! 🎉', 'Sana da mutlu yıllar', 'Nice yıllara', 'İyi seneler, bol kazançlı bir yıl olsun'] : [`Sana da, ${o.ad} kutlu olsun`, 'Kutlu olsun 🇹🇷', 'Nice nicelerine']); try { m = (dil().stillendir)(m, stilOf(kim), rng); } catch (e) { } soyledi(meta, kim, m); return m; } }
    try { for (let i = 0; i < 6; i++) { m = (dil().uret)(anahtar, s, stilOf(kim), rng); if (!tekrarMi(meta, kim, m) && (i > 3 || !basTekrar(meta, m))) break; } } catch (e) { m = YEDEK_DIL.uret('cevap.genel', {}); }
    m = yuvarla(m, rng);
    soyledi(meta, kim, m);
    return m;
  }
  function dmEkle(meta, npcId, m) { if (m && m.kimden === 'npc' && m.metin) m.metin = emojisiz(m.metin); const l = meta.dm[npcId] || (meta.dm[npcId] = []); m.okundu = m.kimden !== 'npc'; m.zaman = Date.now(); l.push(m); if (l.length > 60) l.splice(0, l.length - 60); }
  NPCYZ.dmListesi = meta => Object.keys(meta.dm).map(id => ({ npcId: id, son: meta.dm[id][meta.dm[id].length - 1], okunmamis: meta.dm[id].filter(m => !m.okundu).length })).filter(x => x.son).sort((a, b) => b.son.zaman - a.son.zaman);

  // Özel günler (oyun takvimi: gün 0 = 1 Ocak 2027). Bayram tarihleri yaklaşık.
  const OZEL = [[0, 1, 'Yılbaşı'], [3, 23, '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı'], [4, 19, '19 Mayıs Gençlik ve Spor Bayramı'], [7, 30, '30 Ağustos Zafer Bayramı'], [9, 29, 'Cumhuriyet Bayramı'], [2, 10, 'Ramazan Bayramı', 1], [4, 17, 'Kurban Bayramı', 1]];
  function ozelGun(gun) { const ay = gunAy(gun) % 12, g = gun % 30 + 1; const o = OZEL.find(x => x[0] === ay && (x[3] ? g >= x[1] && g <= x[1] + 2 : g === x[1])); return o ? { ad: o[2], bayram: !!o[3] } : null; }
  NPCYZ.ozelGun = ozelGun;

  /** Gerçek saate göre çevrimiçi sayısı (kanal başına). */
  NPCYZ.cevrimici = function (meta, kanal, saat) {
    const npcler = Object.values(meta.npc);
    const toplamAktif = npcler.reduce((t, k) => t + DUZEN[k.kronotip][saat] * (.3 + k.k.sosyal * .7), 0);
    if (kanal === 'global') return Math.round(toplamAktif * 30 + 2400);
    if (kanal === 'ulke') return Math.max(40, Math.round(toplamAktif * 16 + 380));
    return null;
  };

  /**
   * Kanal akışı: son bakıştan bu yana gelen NPC mesajlarını üretir (gerçek zamana göre).
   * @param simdiMs Date.now(); @param saat gerçek saat (0-23)
   * @returns yeni mesajlar [{id, kanal, npcId, ad, metin, zaman, oyunDk}]
   */

  // ------------------------------------------------------------------
  // KALABALIK VE SOHBET İPLİKLERİ: kanal dakikada 25 (Türkiye) / 40 (global) mesaj akar.
  // Mesajların çoğu "iplik"tir: 2-4 kişinin birbirine cevap verdiği kısa konuşma (npc-iplik.js).
  // Konuşanlar gerçek NPC'ler ve yalnız sohbette görünen hafif kimlikler (figüran).
  // ------------------------------------------------------------------
  const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
  const emojisiz = m => String(m || '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  NPCYZ.emojisiz = emojisiz;
  const IPLIK = () => (typeof NPCIplik !== 'undefined' ? NPCIplik : (typeof globalThis !== 'undefined' && globalThis.NPCIplik) || null);
  const FIG_MESLEK = [['kurye', 5], ['garson', 4], ['market_calisani', 4], ['insaat_iscisi', 3], ['memur', 2.2], ['muhasebeci', 1.4], ['usta', 1.5], ['emlak_danismani', 1], ['nakliyeci', .5], ['kafe_sahibi', .6], ['dukkan_sahibi', .7], [null, 2.2]];
  function figuranlar(meta) {
    if (meta.figuran && meta.figuran.length) return meta.figuran;
    const rng = rngYap(hash('figuran:' + Object.keys(meta.npc).slice(0, 3).join(',')));
    const adlar = new Set(Object.values(meta.npc).map(k => k.gorunen));
    meta.figuran = [];
    for (let i = 0; i < 220; i++) {
      const yasak = (meta.adKontrol || '').split(/\s+/)[0].toLocaleLowerCase('tr');
      let k = kimlikUret(rng); for (let j = 0; j < 12 && (adlar.has(k.gorunen) || (yasak && k.ad.toLocaleLowerCase('tr') === yasak)); j++) k = kimlikUret(rng); adlar.add(k.gorunen);
      const mk = FIG_MESLEK[agirlikliSec(rng, FIG_MESLEK.map((x, ii) => ii), ii => FIG_MESLEK[ii][1])][0];
      meta.figuran.push({ id: 'f' + i, ad: k.ad, gorunen: k.gorunen, kadin: k.kadin, yer: k.yer, kronotip: k.kronotip, k: k.k, ascii: k.ascii, meslek: mk, ev: rng.chance(.22), borc: rng.chance(.3), gun: Math.floor(rng.between(1, 420)), zengin: mk && /sahibi/.test(mk) ? rng.chance(.5) : rng.chance(.04), kurs: rng.chance(.07) });
    }
    return meta.figuran;
  }
  function yabanciKalabalik(meta) {
    if (meta.yabanciK && meta.yabanciK.length) return meta.yabanciK;
    const rng = rngYap(hash('yabanciK:' + (meta.yabanci[0] || {}).gorunen));
    meta.yabanciK = [];
    for (let i = 0; i < 260; i++) { const y = yabanciUret(rng, i + 1000); y.id = 'g' + i; delete y.servetUsd; meta.yabanciK.push(y); }
    return meta.yabanciK;
  }
  NPCYZ.figuranBul = (meta, id) => (meta.figuran || []).find(x => x.id === id) || (meta.yabanciK || []).find(x => x.id === id) || null;
  /** Sohbette konuşan herkes için ortak görünüm: gerçek NPC (oyun verisinden) ya da figüran. */
  function kisiBak(world, meta, id) {
    const n = meta.npc[id];
    if (n) { const p = world.players[id]; if (!p) return null; const pr = p.profession && T.getProfession(p.profession);
      return { id, ad: n.ad, gorunen: n.gorunen, yer: n.yer ? yerAdi(n) : '', sehir: n.yer ? n.yer.sehir : '', meslek: p.profession, kim: n, kronotip: n.kronotip,
        issiz: !p.profession || p.mustWork, patron: p.businessIds.length > 0, sartsiz: !!pr && pr.tier === 1, ev: evdeMi(world, p), borc: p.loans.length > 0, gun: world.day - (n.katildi || 0), zengin: p.cash > 1e6, kurs: !!p.courseInProgress }; }
    const f = NPCYZ.figuranBul(meta, id); if (!f) return null;
    return { id, ad: f.ad || f.gorunen.split(/[ _]/)[0], gorunen: f.gorunen, yer: f.yer && f.yer.ilce || f.sehir || '', sehir: f.yer && f.yer.sehir || f.sehir || '', meslek: f.meslek, kim: f, kronotip: f.kronotip, figuran: true,
      issiz: !f.meslek, patron: !!f.meslek && /sahibi/.test(f.meslek), sartsiz: ['kurye', 'garson', 'market_calisani', 'insaat_iscisi'].includes(f.meslek), ev: !!f.ev, borc: !!f.borc, gun: f.gun || 100, zengin: !!f.zengin, kurs: !!f.kurs };
  }
  function kosulUyar(kb, k) {
    switch (k) {
      case 'issiz': return kb.issiz; case 'calisan': return !kb.issiz; case 'patron': return kb.patron; case 'sartsiz': return kb.sartsiz;
      case 'kurye': case 'garson': case 'memur': case 'usta': return kb.meslek === k;
      case 'evsahibi': return kb.ev; case 'kiraci': return !kb.ev; case 'yeni': return kb.gun < 30; case 'eski': return kb.gun > 200;
      case 'zengin': return kb.zengin; case 'borclu': return kb.borc; case 'kursta': return kb.kurs; case 'istanbul': return kb.sehir === 'İstanbul';
      default: return true;
    }
  }
  const sade = n => n >= 1e6 ? (Math.round(n / 1e5) / 10).toLocaleString('tr-TR') + ' milyon' : n >= 10000 ? Math.round(n / 1000) + ' bin' : n >= 1000 ? (Math.round(n / 100) * 100).toLocaleString('tr-TR') + ' TL' : Math.round(n / 10) * 10 + ' TL';
  let _veri = null;
  function iplikVeri(world, meta) {
    if (_veri && _veri.gun === world.day && _veri.w === world) return _veri.v;
    const fD = T.propertyMarketPrice(world, 'daire'), g = m => sade(beklenenGelir(world, { k: { caliskan: .75 } }, m)), kc = id => T.getCourse(id), bd = id => T.getBusinessDef(id);
    let bg = 1; while (bg < 400 && !((ozelGun(world.day + bg) || {}).bayram)) bg++;
    const v = { daire: sade(fD), arsa: sade(T.propertyMarketPrice(world, 'arsa')), dukkan: sade(T.propertyMarketPrice(world, 'dukkan')),
      'daire.kira': sade(fD * ((C().PROPERTY_TYPES.find(x => x.kind === 'daire') || {}).monthlyRentRate || .005)), pesinat: sade(fD * (1 - C().MORTGAGE_MAX_LTV)),
      'maas.kurye': g('kurye'), 'maas.garson': g('garson'), 'maas.kasiyer': g('market_calisani'), 'maas.insaat': g('insaat_iscisi'), 'maas.memur': g('memur'), 'maas.muhasebeci': g('muhasebeci'), 'maas.usta': g('usta'), 'maas.emlak': g('emlak_danismani'), 'maas.nakliyeci': g('nakliyeci'),
      'gorev.kurye': sade(T.indexed(world, T.getProfession('kurye').payPerTask)), asgari: sade(T.indexed(world, C().MIN_WAGE)), yasam: sade(T.indexed(world, C().BASE_LIVING_COST)), evkira: sade(T.indexed(world, C().BASE_ROOM_RENT)),
      'kurs.kpss': sade(T.indexed(world, kc('kamu_sinavi').cost)), 'kurs.kpss.gun': String(kc('kamu_sinavi').durationDays), 'kurs.muhasebe': sade(T.indexed(world, kc('muhasebe').cost)), 'kurs.muhasebe.gun': String(kc('muhasebe').durationDays),
      'kurs.ustalik': sade(T.indexed(world, kc('ustalik').cost)), 'kurs.ustalik.gun': String(kc('ustalik').durationDays), 'kurs.emlak': sade(T.indexed(world, kc('emlak_belgesi').cost)), 'kurs.emlak.gun': String(kc('emlak_belgesi').durationDays),
      'kafe.kurulus': sade(T.indexed(world, bd('kafe').setupCost)), 'kafe.gider': sade(T.indexed(world, bd('kafe').monthlyFixedCost)), 'dukkan.kurulus': sade(T.indexed(world, bd('dukkan').setupCost)), 'dukkan.gider': sade(T.indexed(world, bd('dukkan').monthlyFixedCost)),
      enflasyon: yuzde(enflasyonYillik(world, meta)), faiz: yuzde(world.policy.loanMonthlyRate * 100), bayram: (ozelGun(world.day + bg) || {}).ad || 'bayram', 'bayram.gun': String(bg) };
    _veri = { gun: world.day, w: world, v }; return v;
  }
  NPCYZ.iplikVeri = iplikVeri;
  function iplikMetni(sablon, roller, kisiler, veri, rng) {
    let m = sablon.replace(/\[([^\]]*)\]/g, (a, b) => rng.pick(b.split('|')));
    m = m.replace(/\{([ABCD])(?:\.(\w+))?\}/g, (a, r0, alan) => { const kb = kisiler[r0]; if (!kb) return ''; if (!alan) return kb.ad; if (alan === 'meslek') return kb.meslek ? meslekAdi(kb.meslek).toLocaleLowerCase('tr') : 'işsiz'; if (alan === 'yer') return kb.yer || kb.sehir; if (alan === 'sehir') return kb.sehir; return ''; });
    m = m.replace(/\{([\w.]+)\}/g, (a, k) => veri[k] != null ? veri[k] : '');
    return m.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  }
  const dilimOf = saat => saat < 6 || saat >= 23 ? 'gece' : saat < 11 ? 'sabah' : saat < 17 ? 'ogle' : 'aksam';
  /** Yeni iplik başlatır: uygun şablon + rollere uygun, şu an çevrimiçi kişiler. */
  function iplikBaslat(world, meta, kanal, rng, saat, t, mesgul, aktifIdler) {
    const I = IPLIK(); if (!I) return null;
    let havuz, dilSec = null;
    if (kanal === 'global') { const D = Object.keys(I.global || {}).filter(d => (I.global[d] || []).length); if (!D.length) return null; dilSec = agirlikliSec(rng, D, d => ({ en: 4, de: 1.5, es: 1.5, az: 1.3, ar: 1.3 })[d] || 1); havuz = I.global[dilSec]; }
    else havuz = I.tr || [];
    if (!havuz.length) return null;
    meta.iplSon = meta.iplSon || {};
    const dlm = dilimOf(saat);
    const aktif = aktifIdler || new Set();
    const aday = havuz.filter(x => !aktif.has(x.id) && (!x.saat || x.saat === dlm) && !(meta.iplSon[x.id] && t - meta.iplSon[x.id] < 8 * 3600e3));
    const liste = aday.length ? aday : havuz.filter(x => !aktif.has(x.id)).sort((a, b) => (meta.iplSon[a.id] || 0) - (meta.iplSon[b.id] || 0)).slice(0, 20);
    const kisiHavuz = kanal === 'global' ? yabanciKalabalik(meta).filter(y => y.dil === dilSec).map(y => y.id).concat(meta.yabanci.filter(y => y.dil === dilSec).map(y => y.id)) : Object.keys(meta.npc).concat(figuranlar(meta).map(f => f.id));
    if (!liste.length) return null;
    for (let deneme = 0; deneme < 6; deneme++) {
      const sb = rng.pick(liste), roller = {}, kisiler = {}, kul = new Set(), adlar = new Set();
      const ilkAd = id => { const n = meta.npc[id] || NPCYZ.figuranBul(meta, id) || meta.yabanci.find(x => x.id === id); return n ? String(n.ad || n.gorunen || '').split(/[ _.]/)[0].toLocaleLowerCase('tr').replace(/\d+/g, '') : ''; };
      const rolList = [...new Set(sb.turlar.map(x => x[0]))];
      let ok = true;
      for (const r0 of rolList) {
        const kos = (sb.kosul || []).filter(k => k[0] === r0).map(k => k.slice(2));
        const uygun = kisiHavuz.filter(id => !kul.has(id) && !mesgul.has(id) && !adlar.has(ilkAd(id)));
        const sec = agirlikliSec(rng, uygun, id => {
          const kb = kanal === 'global' ? null : kisiBak(world, meta, id);
          if (kanal !== 'global' && (!kb || !kos.every(k => kosulUyar(kb, k)))) return 0;
          const n = meta.npc[id] || NPCYZ.figuranBul(meta, id); if (n && n.vedaZaman && t - n.vedaZaman < 4 * 3600e3 && t >= n.vedaZaman) return 0;
          const kr = (n && DUZEN[n.kronotip]) ? DUZEN[n.kronotip][saat] : .5;
          return .08 + kr;
        });
        if (!sec) { ok = false; break; }
        kul.add(sec); adlar.add(ilkAd(sec)); roller[r0] = sec;
        if (kanal === 'global') { const y = NPCYZ.figuranBul(meta, sec) || meta.yabanci.find(x => x.id === sec); kisiler[r0] = { ad: (y.gorunen || '').split(/[ _]/)[0], sehir: y.sehir, yer: y.sehir }; }
        else kisiler[r0] = kisiBak(world, meta, sec);
      }
      if (!ok) continue;
      meta.iplSon[sb.id] = t;
      return { id: sb.id, dil: dilSec, roller, i: 0, t };
    }
    return null;
  }
  /** İpliğin sıradaki turu: mesaj nesnesi (zamanı t). */
  function iplikTuru(world, meta, kanal, ip, rng) {
    const I = IPLIK(); const havuz = kanal === 'global' ? (I.global || {})[ip.dil] || [] : I.tr || [];
    const sb = havuz.find(x => x.id === ip.id); if (!sb || ip.i >= sb.turlar.length) return null;
    const [r0, sab] = sb.turlar[ip.i]; const id = ip.roller[r0];
    const kisiler = {}; for (const [rr, kid] of Object.entries(ip.roller)) { if (kanal === 'global') { const y = NPCYZ.figuranBul(meta, kid) || meta.yabanci.find(x => x.id === kid); kisiler[rr] = y ? { ad: (y.gorunen || '').split(/[ _]/)[0], sehir: y.sehir, yer: y.sehir } : null; } else kisiler[rr] = kisiBak(world, meta, kid); }
    const ks = kisiler[r0]; if (!ks) return null;
    let metin = '';
    for (let d = 0; d < 4; d++) { metin = iplikMetni(sab, ip.roller, kisiler, kanal === 'global' ? {} : iplikVeri(world, meta), rng); if (!(meta.kanalSon || []).includes(normSoz(metin))) break; }
    const kim = meta.npc[id] || NPCYZ.figuranBul(meta, id) || meta.yabanci.find(x => x.id === id);
    if (kanal !== 'global') { try { metin = (dil().stillendir)(metin, stilOf(kim), rng); } catch (e) { } }
    metin = emojisiz(metin);
    if (!metin) return null;
    const ad = kanal === 'global' ? (kim.gorunen) : ks.gorunen;
    return { npcId: id, ad, metin, iplik: ip.id, yabanci: kanal === 'global' || undefined, dil: ip.dil || undefined, figuran: (!meta.npc[id]) || undefined };
  }
  /** Figüranın oyuncuya cevabı: kendi sabit bilgisinden (meslek, yer) ya da benzer bir NPC'nin bildiğinden. */
  function figuranCevap(world, meta, f, kanal, katli, ny, oyuncu, rng) {
    let m = null;
    if (kanal === 'global') { try { m = (dil().uret)('global.' + (f.dil || 'en') + '.cevap', { ad: f.gorunen.split(/[ _]/)[0] }, stilOf({ k: f.k, ruh: .2 }), rng); } catch (e) { m = 'Hi!'; } }
    else {
      if (/(ne is|meslegin|ne yapiyorsun|nerelisin|nerdesin|neredesin)/.test(katli)) m = /(nereli|nerde|nerede)/.test(katli) ? `${f.yer && f.yer.ilce || ''}${f.yer && f.yer.sehir && f.yer.sehir !== (f.yer && f.yer.ilce) ? ', ' + f.yer.sehir : ''}`.replace(/^, /, '') : f.meslek ? `${yim(meslekAdi(f.meslek).toLocaleLowerCase('tr'))}, ${f.gun > 60 ? Math.round(f.gun / 30) + ' aydır' : 'yeni sayılırım'}` : 'Şu an boştayım, iş bakıyorum';
      if (!m && ny.soru) { const benzer = Object.keys(meta.npc).find(id => world.players[id] && world.players[id].profession === f.meslek) || Object.keys(meta.npc)[0]; const b = benzer && bilgi(world, meta, meta.npc[benzer], ny.niyet, ny.varlik || {}, oyuncu, katli, null); if (b && !b.satis && !b.kisisel) m = b.metin; }
      if (!m) { try { m = (dil().uret)(['selam', 'tesekkur', 'veda', 'tebrik', 'saka', 'dert', 'iltifat'].includes(ny.niyet) ? 'cevap.' + ny.niyet : ny.soru ? 'cevap.genel_soru' : 'cevap.katilim', { oyuncuAd: oyuncu.name.split(' ')[0], kisi: oyuncu.name.split(' ')[0] }, stilOf(f), rng); } catch (e) { m = 'Aynen'; } }
      try { m = (dil().stillendir)(m, stilOf(f), rng); } catch (e) { }
    }
    return { npcId: f.id, ad: f.gorunen, metin: emojisiz(m), gecikmeMs: 3000 + rng.next() * 4000 };
  }
  /** Kanalın saatlik hızı (dakikada mesaj): Türkiye 25, global 40; gece biraz düşer. */
  function kanalHizi(kanal, saat) { if (kanal === 'global') return 80; const f = saat < 2 ? .8 : saat < 7 ? .55 : saat < 9 ? .8 : 1; return 50 * f; }
  NPCYZ.kanalHizi = kanalHizi;
  /** Şu an yazmakta olanlar: birkaç saniye içinde iplikte sırası gelecek kişiler (arayüzdeki "yazıyor…"). */
  NPCYZ.yazanlar = function (meta, kanal, simdi) {
    const I = IPLIK(); if (!I || !meta.ipl || !meta.ipl[kanal]) return [];
    return meta.ipl[kanal].filter(ip => ip.t > simdi && ip.t - simdi < 5000).map(ip => { const havuz = kanal === 'global' ? (I.global || {})[ip.dil] || [] : I.tr || []; const sb = havuz.find(x => x.id === ip.id); if (!sb || !sb.turlar[ip.i]) return null; const id = ip.roller[sb.turlar[ip.i][0]]; const n = meta.npc[id] || NPCYZ.figuranBul(meta, id) || (meta.yabanci || []).find(x => x.id === id); return n ? n.gorunen : null; }).filter(Boolean).slice(0, 3);
  };

  NPCYZ.kanalAkisi = function (world, meta, kanal, simdiMs, saat, oyuncu, sirketNpcIdleri) {
    adCakismasi(world, meta, oyuncu);
    if (!meta.kanal[kanal]) meta.kanal[kanal] = [];
    const ilkAcilis = !meta.kanalZaman[kanal];
    const son = meta.kanalZaman[kanal] || (simdiMs - (kanal === 'sirket' ? 6 : 40) * 60e3);
    let gecen = Math.min(simdiMs - son, 3 * 3600e3);
    meta.kanalZaman[kanal] = simdiMs;
    if (gecen < 4000 && (kanal === 'sirket' || !IPLIK())) { const d0 = kanal === 'ulke' && oyuncu ? donusMesaji(world, meta, oyuncu, simdiMs, rngYap(hash('d' + simdiMs))) : null; if (d0) { d0.zaman = simdiMs; d0.kanal = kanal; d0.id = 'k' + (++meta.sayac); meta.kanal[kanal].push(d0); return [d0]; } return []; }
    // Dakikada ortalama mesaj: Türkiye 25, global 40 (iplikler); tek mesajlar (olaylar, sorular) bunun küçük bir payı
    const ipliVar = kanal !== 'sirket' && !!IPLIK();
    const R = kanal === 'sirket' ? .25 : kanalHizi(kanal, saat);
    const dakikada = kanal === 'sirket' ? .25 : ipliVar ? R * (kanal === 'global' ? .08 : .14) : R * .3;
    // Uzun aradan sonra yalnız son birkaç dakikanın akışı üretilir (geri kalanı "kaçırılmış" sayılır)
    const pencere = kanal === 'sirket' ? gecen : Math.min(gecen, (ilkAcilis ? 4 : 3) * 60e3);
    let n = Math.round(pencere / 60e3 * dakikada);
    n = Math.min(n, kanal === 'sirket' ? 4 : 30);
    if (n <= 0 && rngYap(hash(kanal + simdiMs)).chance(gecen / 60e3 * dakikada)) n = 1;
    if (ilkAcilis && kanal !== 'sirket') n = Math.max(n, 6); // ilk girişte kanal boş görünmesin
    const rng = rngYap(hash(kanal + ':' + simdiMs + ':' + world.day));
    const yeni = [];
    // Önce: oyuncuya dönüşler (ihtiyacını hatırlayan biri sorar ya da tebrik eder)
    const donus = kanal === 'ulke' && oyuncu ? donusMesaji(world, meta, oyuncu, simdiMs, rng) : null;
    if (donus) { donus.zaman = simdiMs - 1000; donus.kanal = kanal; donus.id = 'k' + (++meta.sayac); donus.oyunGun = world.day; }
    const bas = simdiMs - pencere;
    for (let i = 0; i < n; i++) {
      const zaman = bas + Math.round((i + 1) * pencere / (n + 1));
      const m = kanal === 'global' ? globalMesaj(world, meta, rng, saat) : kanal === 'sirket' ? sirketMesaj(world, meta, rng, sirketNpcIdleri || [], oyuncu) : ulkeMesaj(world, meta, rng, saat, meta.kanal[kanal].slice(-40).concat(yeni).filter(m => !m.iplik).slice(-8));
      if (!m) continue;
      // Aynı cümle kanalda yakın zamanda geçtiyse yazılmaz; vedalaşan kişi saatlerce yazmaz
      { const nm = normSoz(m.metin); if ((meta.kanalSon || []).includes(nm)) continue; meta.kanalSon = (meta.kanalSon || []).concat([nm]).slice(-150); }
      if (m.npcId && meta.npc[m.npcId]) { const kv = meta.npc[m.npcId]; if (kv.vedaZaman && zaman - kv.vedaZaman < 4 * 3600e3) continue; try { if ((dil().niyetBul)(m.metin, { adlar: [] }).niyet === 'veda' && !m.cevap) kv.vedaZaman = zaman; } catch (e) { } }
      m.zaman = zaman; m.kanal = kanal; m.id = 'k' + (++meta.sayac); m.oyunGun = world.day;
      yeni.push(m);
    }
    // İplikler: aynı anda birkaç konuşma, her biri kendi hızında ilerler
    if (ipliVar) {
      meta.ipl = meta.ipl || {}; let akt = (meta.ipl[kanal] || []).filter(ip => ip.t >= bas - 90e3);
      const K = kanal === 'global' ? 24 : 16, ort = K / (R * (1 - (kanal === 'global' ? .08 : .14))) * 60e3;
      const mesgul = () => new Set([].concat(...akt.map(ip => Object.values(ip.roller))));
      while (akt.length < K) { const ip = iplikBaslat(world, meta, kanal, rng, saat, bas + rng.next() * ort, mesgul(), new Set(akt.map(x => x.id))); if (!ip) break; akt.push(ip); }
      for (let guv = 0; guv < 400; guv++) {
        let en = null; for (const ip of akt) if (!en || ip.t < en.t) en = ip;
        if (!en || en.t > simdiMs) break;
        const m = iplikTuru(world, meta, kanal, en, rng);
        en.i++;
        if (m) { const nm = normSoz(m.metin); if (!(meta.kanalSon || []).includes(nm)) { meta.kanalSon = (meta.kanalSon || []).concat([nm]).slice(-300); if (en.sonId) { m.cevap = en.sonId; if (rng.chance(.35)) m.alinti = true; } m.zaman = Math.round(en.t); m.kanal = kanal; m.id = 'k' + (++meta.sayac); m.oyunGun = world.day; en.sonId = m.id; yeni.push(m); } }
        const I = IPLIK(), sb = (kanal === 'global' ? (I.global || {})[en.dil] || [] : I.tr || []).find(x => x.id === en.id);
        if (!sb || en.i >= sb.turlar.length) { akt = akt.filter(x => x !== en); const ip = iplikBaslat(world, meta, kanal, rng, saat, en.t + rng.next() * ort * .6, mesgul(), new Set(akt.map(x => x.id))); if (ip) akt.push(ip); }
        else en.t += ort * (.35 + rng.next() * 1.3) + (m ? m.metin.length * 60 : 0);
      }
      meta.ipl[kanal] = akt;
    }
    if (donus) yeni.push(donus);
    yeni.forEach(m => { m.metin = emojisiz(m.metin); });
    yeni.sort((a, b) => a.zaman - b.zaman);
    meta.kanal[kanal] = meta.kanal[kanal].concat(yeni).slice(-200);
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
    const simdi0 = Date.now();
    return agirlikliSec(rng, Object.keys(meta.npc).filter(id => world.players[id] && (!filtre || filtre(id)) && !(meta.npc[id].vedaZaman && simdi0 - meta.npc[id].vedaZaman < 4 * 3600e3 && simdi0 >= meta.npc[id].vedaZaman)), id => { const k = meta.npc[id]; return DUZEN[k.kronotip][saat] * (.15 + k.k.sosyal) * (1 + Math.max(0, k.ruh) * .3) * (yakin.has(id) ? .15 : 1); });
  }

  // Başkasının iyi haberine tepki (cevap.tebrik "tebrik edilene teşekkür" kalıbıdır, bu değil)
  const TEBRIK_ET = {
    isletme_acti: ['@{k} hayırlı olsun, bol kazançlı olsun', 'Hayırlı uğurlu olsun {k}', '{k} helal olsun, yolun açık olsun', '@{k} hayırlı olsun, bir gün uğrarım'],
    mulk_aldi: ['Güle güle oturun {k}', '@{k} hayırlı olsun', '{k} helal, ev sahibi olmak güzel', '@{k} hayırlı olsun, kiradan kurtuldun'],
    kurs_bitti: ['@{k} tebrikler, kolay gelsin', '{k} helal olsun, emeğine sağlık', '@{k} tebrik ederim, şimdi sıra yeni işte'],
    ay_sonu_iyi: ['Helal {k}', '@{k} bereketli olsun', '{k} maşallah, devamı gelsin', '@{k} süpersin, bu ay benim için de iyi geçti'],
    is_degisti: ['@{k} yeni işin hayırlı olsun', 'Hayırlı olsun {k}', '{k} kolay gelsin yeni işinde'],
    bagis: ['{k} eline sağlık, güzel bir iş', '@{k} çok güzel, emeğine sağlık', '{k} böyle insanlar az, eline sağlık'],
  };
  // Konu dışı gündelik paylaşımlar (saate göre) ve kısa tepkiler
  const GUNLUK = {
    sabah: ['metrobüs yine tıklım tıklım', 'kahvaltı yapmadan çıktım, açım', 'günaydın, kahve olmadan açılmıyor gözler', 'sabah sabah yağmur başladı', 'trafik berbat bugün', 'erken kalkmak zor be'],
    ogle: ['öğle arası, biraz soluklanayım', 'yemek ne yesem bilemedim', 'bugün iş çok yoğun', 'kimse yok mu kanalda', 'çay molası ☕'],
    aksam: ['akşam maç var, izleyen?', 'akşam yemeği ne yapsam', 'bugün de bitti şükür', 'eve geldim, biraz oyun', 'yarın hafta sonu galiba', 'trafikte 1 saat kaldım'],
    gece: ['uykum gelmedi hiç', 'yarın erken kalkacağım ama hâlâ buradayım', 'gece kuşları burada mı', 'iyi geceler herkese, yarın görüşürüz', 'kim ayakta'],
  };
  const OLAY_KISA = ['ooo', 'hayırlısı', '👏', 'helal', 'süper', 'vay be', 'bravo', 'oo güzel'];
  const KISA_TEPKI = ['aynen', '+1', '😂', 'hayırlısı', 'bende de aynı', 'ooo', 'kesinlikle', 'haha', 'doğru valla', 'hmm'];
  const TAKILMA = { ay_sonu_iyi: ['{k} abartma 😂', 'herkes kâr ediyor ben niye zarar ediyorum', '{k} bize de bir kahve ısmarlarsın artık 😄'], isletme_acti: ['{k} indirim var mı bize 😄', '{k} açılışa çağırmadın ama'], mulk_aldi: ['{k} ev sahibi oldun, kira yok artık, kıskandım', 'ev partisi ne zaman {k}'] };
  function ulkeMesaj(world, meta, rng, saat, sonMesajlar) {
    // %28: bir önceki mesaja başka bir NPC cevap verir (sohbet zinciri)
    const onceki = sonMesajlar[sonMesajlar.length - 1];
    // Cevaplar asıl mesaja gelir (cevaba cevap zinciri yok); bir mesaja en çok 2 cevap
    const kok = onceki && onceki.cevap ? sonMesajlar.find(m => m.id === onceki.cevap) : onceki;
    const cevapSayisi = kok ? sonMesajlar.filter(m => m.cevap === kok.id).length : 0;
    if (kok && kok.npcId && meta.npc[kok.npcId] && cevapSayisi < 2 && rng.chance(cevapSayisi ? .15 : .3)) {
      const TEPKI = { isletme_acti: 'cevap.tebrik', mulk_aldi: 'cevap.tebrik', kurs_bitti: 'cevap.tebrik', ay_sonu_iyi: 'cevap.tebrik', is_degisti: 'cevap.tebrik', bagis: 'cevap.tebrik', ay_sonu_kotu: 'cevap.dert', mulk_satti: 'cevap.dert', isletme_kapandi: 'cevap.dert' };
      const dk = NPCYZ.dostlar(meta, kok.npcId).filter(id => id !== kok.npcId && world.players[id] && !sonMesajlar.some(m => m.cevap === kok.id && m.npcId === id));
      const cevapci0 = dk.length && rng.chance(.6) ? agirlikliSec(rng, dk, id => DUZEN[meta.npc[id].kronotip][saat] + .1) : konusanSec(world, meta, rng, saat, id => id !== kok.npcId && !sonMesajlar.some(m => m.cevap === kok.id && m.npcId === id));
      if (cevapci0 && kok.olay && TEPKI[kok.olay]) { const k0 = meta.npc[cevapci0], kisi = meta.npc[kok.npcId].ad; let metin;
        const dostMu = NPCYZ.dostlar(meta, kok.npcId).includes(cevapci0);
        if (TAKILMA[kok.olay] && (k0.k.mizah > .55 || dostMu) && rng.chance(dostMu ? .45 : .25)) { metin = rng.pick(TAKILMA[kok.olay]).replace('{k}', kisi); }
        else if (rng.chance(.25)) metin = rng.pick(OLAY_KISA);
        else if (TEBRIK_ET[kok.olay]) { metin = rng.pick(TEBRIK_ET[kok.olay]).replace('{k}', kisi); try { metin = (dil().stillendir)(metin, stilOf(k0), rng); } catch (e) { } }
        else metin = konus(world, meta, k0, TEPKI[kok.olay], { oyuncuAd: kisi }, rng);
        return { npcId: cevapci0, ad: k0.gorunen, metin, cevap: kok.id }; }
    }
    if (kok && kok.npcId && meta.npc[kok.npcId] && !kok.olay && cevapSayisi < 2 && rng.chance(/\?\s*\S*$/.test(kok.metin) ? (cevapSayisi ? .35 : .7) : (cevapSayisi ? .1 : .22))) {
      const onceki = kok;
      const cevapci = konusanSec(world, meta, rng, saat, id => id !== onceki.npcId && !sonMesajlar.some(m => m.cevap === onceki.id && m.npcId === id));
      if (cevapci) {
        const kim = meta.npc[cevapci], ny = (dil().niyetBul)(onceki.metin, { adlar: [] }); meta._gelen = (dil().normal)(onceki.metin).katli;
        // Soruya gerçek bilgiyle cevap (soran NPC'nin kendi durumuna göre)
        const soran = meta.npc[onceki.npcId] && world.players[onceki.npcId];
        if (soran && ny.soru) { const b = bilgi(world, meta, kim, ny.niyet, ny.varlik || {}, soran, (dil().normal)(onceki.metin).katli, null); if (b && !b.satis && !tekrarMi(meta, kim, b.metin)) { const c = bilgiPaketi(world, meta, cevapci, { metin: (rng.chance(.5) ? '@' + meta.npc[onceki.npcId].ad + ' ' : '') + b.metin }, rng, 0); return { npcId: cevapci, ad: kim.gorunen, metin: c.metin, cevap: onceki.id }; } }
        if (ny.soru && !['selam', 'eleman_ariyorum', 'is_ariyorum', 'mulk_satiyorum', 'bayram'].includes(ny.niyet)) return null; // cevabını bilmediği soruya kimse "hangi konuda" diye yazmaz // cevabını bilmediği soruya çoğu kişi hiç yazmaz
        if (ny.niyet === 'veda') return { npcId: cevapci, ad: kim.gorunen, metin: konus(world, meta, kim, 'cevap.veda', { kisi: meta.npc[onceki.npcId] ? meta.npc[onceki.npcId].ad : '' }, rng), cevap: onceki.id };
        const katliO = (dil().normal)(onceki.metin).katli;
        // Gündelik, görüş bildirmeyen cümle ("akşam yemeği ne yapsam", "trafikte kaldım"): çoğu zaman kimse cevap vermez
        if (ny.niyet === 'genel' && !ny.soru && !/(bence|herkes|kimse|cok|hep|yine|zam|pahali|zor|guzel|kotu|of\b|valla)/.test(katliO) && rng.chance(.7)) return null;
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
      if (anahtar === 'paylasim.is_ariyor') { const mk = v.meslek || (p && p.profession); const pr = mk && C().PROFESSIONS.find(x => x.id === mk); if (pr && pr.business) return null; } // işletme sahibi "iş arıyorum" demez
      meta.anahtarZaman = meta.anahtarZaman || {};
      if (meta.anahtarZaman[anahtar] && Date.now() - meta.anahtarZaman[anahtar] < 20 * 60e3) { meta.olayKuyrugu.push(o); return null; }
      meta.anahtarZaman[anahtar] = Date.now();
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
    if ((p.mustWork || !p.profession) && !(p.profession && (C().PROFESSIONS.find(x => x.id === p.profession) || {}).business)) secenek.push(['paylasim.is_ariyor', 3]);
    const satilik = p.propertyIds.map(x => world.properties[x]).find(m => m && !m.ownerLivesIn);
    if (satilik && kim.k.risk > .4) secenek.push(['paylasim.satilik', 1, { mulk: mulkAdi(satilik.kind), tutar: paraYaz(Math.round(T.propertyMarketPrice(world, satilik.kind) * rng.between(.98, 1.08) / 1000) * 1000) }]);
    if (p.tasksToday >= ((p.profession && T.getProfession(p.profession).maxTasksPerDay) || 99)) secenek.push(['paylasim.gorev_bitti', 2]);
    if (world.priceIndex > 1.03) secenek.push(['paylasim.ekonomi_zam', 1]);
    const dilim = saat < 6 ? 'gece' : saat < 11 ? 'sabah' : saat < 17 ? 'ogle' : saat < 22 ? 'aksam' : 'gece';
    secenek.push(['gundelik', 3.2, { dilim }]);
    secenek.push(['paylasim.ekonomi_genel', .8], ['paylasim.soru', 1.6], ['paylasim.motivasyon', kim.ruh > 0 ? 1 : .3], ['paylasim.yorgun', kim.ruh < 0 ? 1.2 : .3]);
    if (T.netWorth(world, p) > 5e6) secenek.push(['paylasim.zengin_oldu', .3]);
    const anahtarSure = meta.anahtarZaman || (meta.anahtarZaman = {});
    const secilebilir = secenek.filter(x => !(anahtarSure[x[0]] && Date.now() - anahtarSure[x[0]] < 12 * 60e3));
    const s = agirlikliSec(rng, secilebilir.length ? secilebilir : secenek, x => x[1]);
    anahtarSure[s[0]] = Date.now();
    if (s[0] === 'gundelik') { const gunH = new Date(Date.now() + 3 * 3600e3).getUTCDay(), uygun = x => !/hafta sonu/.test(x) || gunH === 5; const liste = GUNLUK[s[2].dilim].filter(uygun); let m = rng.pick(liste); for (let i = 0; i < 4 && tekrarMi(meta, kim, m); i++) m = rng.pick(liste); if (tekrarMi(meta, kim, m)) return null; try { m = (dil().stillendir)(m, stilOf(kim), rng); } catch (e) { } soyledi(meta, kim, m); return { npcId: id, ad: kim.gorunen, metin: m }; }
    return { npcId: id, ad: kim.gorunen, metin: konus(world, meta, kim, s[0], s[2] || {}, rng) };
  }

  function globalMesaj(world, meta, rng, saat) {
    // Yabancılar kendi dillerinde; Türk NPC'ler de ara sıra global'e yazar.
    if (rng.chance(.25)) return ulkeMesaj(world, meta, rng, saat, []);
    const simdi = Date.now();
    const y = agirlikliSec(rng, meta.yabanci.filter(x => !x.sonYazma || simdi - x.sonYazma > 25 * 60e3), x => .2 + x.k.sosyal); if (!y) return null;
    const anahtar = 'global.' + y.dil + '.' + (rng.chance(.25) ? 'selam' : 'paylasim');
    // Bir kerelik olaylar (ilk ev, kafe açtı, yeni geldim) aynı kişide bir kez; kurs ayda bir
    const tur = m => /apartment|Wohnung|piso|mənzil|shaqqa/i.test(m) ? 'ev' : /caf[eé]|maqhaya|kafemi/i.test(m) ? 'kafe' : /new here|neu hier|nuevo por|yeniyəm/i.test(m) ? 'yeni' : /course|Kurs geschafft|curso|Kursu bitirdim|الدورة/i.test(m) ? 'kurs' : null;
    y.yapti = y.yapti || {};
    let metin = '';
    for (let i = 0; i < 6; i++) { try { metin = (dil().uret)(anahtar, { ad: y.gorunen.split(/[ _]/)[0], yer: y.sehir, tutar: Math.round(rng.between(200, 900)) + ({ en: ' bucks', az: ' manat', ar: ' dirham' }[y.dil] || ' €') }, stilOf({ k: y.k, ruh: 0 }), rng); } catch (e) { metin = 'Hello everyone!'; }
      if (/good morning|guten morgen|buenos d[ií]as|sabahınız|sabah el kheir|صباح/i.test(metin) && (saat < 5 || saat >= 12)) { metin = ''; continue; }
      if (/evening|guten abend|buenas tardes|axşamınız|masa el kheir/i.test(metin) && saat < 16) { metin = ''; continue; }
      const t0 = tur(metin); if (!t0) break; const once = y.yapti[t0]; if (t0 === 'yeni' ? (y.mesaj || 0) > 2 || once : t0 === 'kurs' ? once && world.day - once < 30 : once) { metin = ''; continue; } y.yapti[t0] = world.day; break; }
    if (!metin) return null;
    if (y.dil !== 'tr' && y.dil !== 'az') metin = metin.replace(/ı/g, 'i').replace(/İ/g, 'I');
    y.mesaj = (y.mesaj || 0) + 1; y.sonYazma = simdi;
    return { npcId: y.id, ad: y.gorunen, metin, yabanci: true, dil: y.dil };
  }

  function sirketMesaj(world, meta, rng, idler, oyuncu) {
    const id = agirlikliSec(rng, idler.filter(x => meta.npc[x]), x => .2 + meta.npc[x].k.sosyal); if (!id) return null;
    const kim = meta.npc[id], b = oyuncu && oyuncu.businessIds.length ? world.businesses[oyuncu.businessIds[oyuncu.businessIds.length - 1]] : null;
    const p = world.players[id], mudur = b && meta.mudur && meta.mudur[b.id] === id, ayGunu = world.day % C().DAYS_PER_MONTH;
    // Çalışan gibi konuşur, gerçek veriyle: kendi görevleri, ciro, maaş günü. Yönetici cümleleri ("vardiyayı güncelledim") yalnız müdürde.
    const sec = [];
    if (p && p.tasksToday) sec.push(rng.pick([`Bugün ${p.tasksToday} görev bitirdim, devam`, `${p.tasksToday} görev tamam, biraz mola`]));
    if (b && b.monthRevenue > 0) sec.push(rng.pick([`Bu ay ciro ${paraYaz(b.monthRevenue)} oldu, fena değil`, `Ciro ${paraYaz(b.monthRevenue)}, ay sonuna kadar artar`]));
    if (ayGunu <= 1) sec.push(rng.pick(['Maaş yattı, sağ ol patron', 'Maaşlar tam yatmış, teşekkürler']));
    sec.push(rng.pick(['Geldim, başlıyorum', 'Çay molası, 5 dakikaya dönüyorum ☕', `${b ? isletmeAdi(b.type) : 'Dükkan'} hazır, müşteri bekliyoruz`, 'Bugün sakin gibi', 'Bugün yoğun olacak gibi']));
    let m = rng.pick(sec);
    if (mudur && rng.chance(.4)) { let t = konus(world, meta, kim, 'paylasim.sirket_ici', { isletme: b ? isletmeAdi(b.type) : '' }, rng); if (!/maaşlar yattı/i.test(t) || ayGunu <= 1) m = t; }
    if (tekrarMi(meta, kim, m)) return null;
    try { m = (dil().stillendir)(m, stilOf(kim), rng); } catch (e) { } soyledi(meta, kim, m);
    return { npcId: id, ad: kim.gorunen, metin: m };
  }
  /** Şirket kanalında oyuncuya (patrona) çalışanın cevabı; null: bu mesaja özel cevap yok. */
  function sirketCevap(world, meta, oyuncu, katli, ny, idler, rng, saat) {
    const b = oyuncu.businessIds.length ? world.businesses[oyuncu.businessIds[oyuncu.businessIds.length - 1]] : null; if (!b || !idler.length) return null;
    const id = agirlikliSec(rng, idler.filter(x => meta.npc[x] && world.players[x]), x => .3 + meta.npc[x].k.sosyal + (meta.npc[x].calisan ? meta.npc[x].calisan.moral * .3 : 0)); if (!id) return null;
    const p = world.players[id], maas = b.employees[id], kalan = C().DAYS_PER_MONTH - (world.day % C().DAYS_PER_MONTH);
    let m = null;
    if (ny.niyet === 'selam' || /^(gunaydin|selam|merhaba|iyi aksamlar|hayirli sabahlar)/.test(katli)) m = saat < 12 ? rng.pick(['Günaydın patron', 'Günaydın, buradayız', 'Günaydın şef, başladık bile']) : rng.pick(['Selam patron', 'Selam şef, buradayız', 'Merhaba, her şey yolunda']);
    else if (/(maas|maaslar)\w* (yatti|yatar|ne zaman|yatacak)|maas gunu/.test(katli)) m = (world.day % C().DAYS_PER_MONTH) <= 1 ? 'Yattı, sağ ol patron' : `Ay sonunda yatıyor, ${kalan} gün kaldı${maas ? '. ' + paraYaz(maas) + ' anlaşmıştık' : ''}`;
    else if (/(musteri|ciro|satis|nasil gidiyor|isler nasil|durum ne)/.test(katli) || ny.niyet === 'hal_hatir') m = b.monthRevenue > 0 ? `Bu ay ciro ${paraYaz(b.monthRevenue)} oldu, ${b.tasksToday > 2 ? 'bugün de yoğun' : 'bugün biraz sakin'}` : rng.pick(['Daha yeni açıldık, müşteri yavaş yavaş geliyor', 'Bugün sakin, ama ilk günler hep böyle']);
    else if (/(kac gorev|gorev yaptin|calistin mi|ne yaptin)/.test(katli)) m = p.tasksToday ? `Bugün ${p.tasksToday} görev yaptım, bu ay ${p.tasksThisMonth}` : `Bugün daha başlamadım, birazdan başlıyorum. Bu ay ${p.tasksThisMonth} görev oldu`;
    else if (ny.niyet === 'tesekkur' || ny.niyet === 'veda' || /(iyi calismalar|kolay gelsin|eline saglik|emegine saglik|tebrikler ekip|super ekip)/.test(katli)) m = rng.pick(['Sağ ol patron, sana da', 'Eyvallah şef 💪', 'Sağ ol, sana da kolay gelsin', 'Teşekkürler, devam ediyoruz']);
    if (!m) return null;
    try { m = (dil().stillendir)(m, stilOf(meta.npc[id]), rng); } catch (e) { } soyledi(meta, meta.npc[id], m);
    return { npcId: id, ad: meta.npc[id].gorunen, metin: m, gecikmeMs: 2500 + rng.next() * 4000 };
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
  /** 348 gün → 'bir yıla yakın'; 40 → '1-2 aydır' */
  const sureYaz = g => g < 7 ? 'birkaç gündür' : g < 25 ? `${Math.round(g / 7)} haftadır` : g < 300 ? `${Math.max(1, Math.round(g / 30))}-${Math.round(g / 30) + 1} aydır` : g < 400 ? 'bir yıla yakın' : `${Math.round(g / 365)} yıldır`;
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
    [/kum saat\w*\b.*\b(kurs\w*|kullan\w*|ise yarar|insaat|basvuru)\b.*\b(mi|mu|mı|nasil|nerede|nerde)\b/, () => 'Evet, kursta kullanılıyor: her Kum Saati bir günlük beklemeyi siliyor. Başvuru ve inşaat beklemesinde de işe yarıyor, maaşa servete etkisi yok'],
    [/(mulk|ev|daire|arsa|dukkan)\w* (nasil|nerden|nereden) (al|bul)|nasil (ev|daire|mulk) al/, (w) => `Mülklerim ekranından alıyorsun. Daire ${paraYaz(T.propertyMarketPrice(w, 'daire'))}, krediyle alırsan peşinat ${paraYaz(T.propertyMarketPrice(w, 'daire') * (1 - C().MORTGAGE_MAX_LTV))}`],
    [/(isletme|dukkan|kafe|sirket)\w* (nasil|nerden) ac|nasil (isletme|dukkan|kafe|sirket) ac/, (w) => `Kariyer ekranında 3. kademeden açılıyor. Dükkan ${paraYaz(T.indexed(w, T.getBusinessDef('dukkan').setupCost))}, kafe ${paraYaz(T.indexed(w, T.getBusinessDef('kafe').setupCost))}, bir de 60 gün iş deneyimi istiyor`],
    [/(calisan|eleman|isci)\w* (nasil|nerden) al|nasil (calisan|eleman) al/, () => 'Şirketim ekranında Çalışanlar kısmından + ile ilan veriyorsun, başvuranlardan seçiyorsun. İyi maaş verirsen çok başvuru gelir'],
    [/kredi\w* (nasil|nerden) (cek|al)|nasil kredi/, (w, m, o) => { const l = Math.round(o.lastMonthIncome * o.creditScore / 100); return `Banka ekranından. Limit geçen ayki gelirine ve kredi notuna göre, sende şu an ${paraYaz(l)}${l ? '' : ' çünkü daha ay sonu maaşın yatmadı'}. Aylık faiz ${yuzde(w.policy.loanMonthlyRate * 100)}`; }],
    [/(kredi )?not\w* (nasil )?(yuksel|artir|duzel)|kredi not\w*\b.*\b(yuksel|artir|duzel)\w*/, () => 'Taksitleri zamanında ödersen ve bağış yapıp itibar kazanırsan kredi notu yükseliyor. Taksit kaçırırsan düşüyor'],
    [/(isci|eleman|calisan|personel)\w* (nerden|nereden|nasil) bul/, () => 'İlan veriyorsun, Şirketim → Çalışanlar → + ile. Maaşı iyi verirsen çok başvuru geliyor, kanala yazarsan da iş arayanlar dönüyor'],
    [/kum saat\w* (almadan|olmadan|nerden|nereden|nasil)|bedava kum/, () => 'Kum Saati satın da alınıyor ama günlük 3 görevi yapınca her gün 1 tane bedava geliyor. Kursları kısaltıyor'],
    [/itibar\w* (nasil|ne)/, () => 'İtibarı bağış ve maaşları zamanında ödemek artırıyor. Bayramda bağış iki kat itibar veriyor'],
    [/gorev\w* (nasil|ne)|nasil gorev/, () => 'Ana ekranda İşim kartındaki Görev yap düğmesi. Günde sınırlı, para ay sonunda yatıyor'],
    [/kum saat/, () => 'Kum Saati kurs süresini kısaltıyor, biri bir gün. Günde 3 görev yapınca bir tane geliyor'],
  ];

  /**
   * Konuya göre gerçek bilgi cümlesi. null: bu konuda söylenecek gerçek bir bilgi yok.
   * @returns {metin, slot, npcFiltre?}
   */
  const rng0 = k => rngYap(hash(k + Math.floor(Date.now() / 60000)));
  /** NPC'ye kendisi hakkında sorulan sorular: kendi gerçek verisinden cevap. */
  function kendisi(world, meta, kim, katli) {
    const p = world.players[kim.id];
    const pr0 = m => { const q = T.getProfession(m); return q.earning === 'task' ? 'görev yaptıkça artıyor' : q.earning === 'salary' ? 'sabit maaş' : q.earning === 'business' ? 'işletmenin kârı' : 'maaş artı prim'; };
    if (/\b(adin|ismin|isim)\b/.test(katli)) return `Ben ${kim.ad}${kim.gorunen !== kim.ad && !kim.gorunen.startsWith(kim.ad + ' ') ? ', burada ' + kim.gorunen + ' yazıyor' : ''}`;
    if (/(kaca|kac paraya|ne kadara) (al|aldin|aldiniz|aldin mi)/.test(katli)) { const m = p.propertyIds.map(x => world.properties[x]).filter(Boolean).pop(); return m ? `${paraYaz(m.boughtFor)}'ye aldım, şimdi ${paraYaz(T.propertyMarketPrice(world, m.kind))} ediyor` : 'Mülküm yok daha, biriktiriyorum'; }
    if (/(ne kadar|kac|ayda ne) (kazaniyorsun|kazaniyon|kaziyorsun|aliyorsun|aliyon)|maasin (ne kadar|kac)|kazancin (nasil|ne kadar)/.test(katli)) { const g = suAnkiGelir(world, kim, p); return p.profession ? (g ? `Ayda ${paraYaz(g)} civarı, ${pr0(p.profession)}` : 'Bu ay pek kazanamadım açıkçası') : 'Şu an işsizim, kazanç yok'; }
    if (/kredi (mi )?(cektin|aldin|var mi)|borcun var/.test(katli)) { const l = p.loans; return l.length ? `Evet, ${l.length} kredim var, aylık ${paraYaz(l.reduce((t, x) => t + x.monthlyPayment, 0))} taksit ödüyorum` : (p.propertyIds.length || p.businessIds.length ? 'Yok, kredi çekmedim, peşin aldım' : 'Yok, hiç kredi çekmedim'); }
    if (/ne zaman(dir|dan beri) (oynu|buradas|burda|calis)|kac gundur/.test(katli)) return `${sureYaz(world.day - (kim.katildi || 0))} buradayım`;
    if (/ne (is|iş) yapiyorsun|ne yapiyorsun orda|orda ne is|mesleg/.test(katli)) return p.profession ? rng0(kim.id).pick([`${yim(meslekAdi(p.profession))}, ${sureYaz(world.day - p.professionSince)}`, `${meslekAdi(p.profession)} olarak çalışıyorum, ${sureYaz(world.day - p.professionSince)}`, `${sureYaz(world.day - p.professionSince)} ${meslekAdi(p.profession)}ım`]).replace(/ımım/, 'ım') : 'Şu an boştayım';
    if (/nerelisin|nerdesin|neredesin|nerden yaziyor/.test(katli)) return `${yerAdi(kim)}${kim.yer && kim.yer.sehir !== yerAdi(kim) ? ', ' + kim.yer.sehir : ''}`;
    return null;
  }
  // Mesaj son konuşana mı dönük? ("sen", "-dın", "-sın" ...)
  const IKINCI_TEKIL = /\b(sen|senin|sana|seni|sende)\b|\w(iyorsun|uyorsun|ıyorsun|üyorsun|yorsun|dın|din|dun|dün|tın|tin|tun|tün|sın|sin|sun|sün)( mi| mı| mu| mü)?\b/;
  const MESLEK_ANAHTAR = [['emlakci|emlak danisman', 'emlak_danismani'], ['muhasebeci|muhasebe', 'muhasebeci'], ['memur', 'memur'], ['kurye', 'kurye'], ['garson', 'garson'], ['kasiyer', 'market_calisani'], ['usta|elektrikci|tesisatci', 'usta'], ['insaat iscisi|insaatta', 'insaat_iscisi'], ['taksici|taksi|nakliyeci|sofor', 'nakliyeci']];
  function bilgi(world, meta, kim, konu, varlik, oyuncu, katli, takip) {
    const p = world.players[kim.id];
    const mulk = (varlik && varlik.mulk) || (/arsa/.test(katli) ? 'arsa' : /dukkan/.test(katli) ? 'dukkan' : /(daire|ev\b|konut|1\+1|2\+1|3\+1|kira)/.test(katli) ? 'daire' : null);
    if (mulk && /(kredisiz|krediye girmeden|pesin|nakit)/.test(katli) && /(al|alabilir|alinir|olur)/.test(katli)) { const f = T.propertyMarketPrice(world, mulk); return { metin: oyuncu.cash >= f ? `Alırsın, ${mulkAdi(mulk).toLocaleLowerCase('tr')} ${paraYaz(f)}, paran da yetiyor` : `Alınır ama peşin ${paraYaz(f)} lazım, senin nakdin ${paraYaz(oyuncu.cash)}. Krediyle peşinat ${paraYaz(f * (1 - C().MORTGAGE_MAX_LTV))}` }; }
    if (mulk && (takip === 'yer' || (varlik && varlik.yer && takip)) && ['mulk_ariyorum', 'fiyat_sorusu', 'mulk_satiyorum'].includes(konu)) { const f = T.propertyMarketPrice(world, mulk); const ev = p.propertyIds.map(x => world.properties[x]).find(Boolean); return { metin: `Fiyat semte göre değişmiyor şu an, her yerde ${mulkAdi(mulk).toLocaleLowerCase('tr')} ${paraYaz(f)} civarı. ${varlik && varlik.yer ? 'Hangisi işine yakınsa onu al bence' : ev ? `Benimki ${yerAdi(kim)} tarafında, memnunum` : 'İşine yakın bir yere bak bence'}` }; }
    if (mulk && /(kira\w* (kac|ne kadar|ne durumda|nasil|ne alemde|yuksek mi|pahali mi)|kac kira|kira getir|kira gelir)/.test(katli)) { const f = T.propertyMarketPrice(world, mulk), oran = (C().PROPERTY_TYPES.find(x => x.kind === mulk) || {}).monthlyRentRate || 0; return { metin: oran ? `${mulkAdi(mulk)} ayda ${paraYaz(f * oran)} civarı kira getiriyor, değerinin yaklaşık ${yuzdeSi((oran * 100).toLocaleString('tr-TR'))}` : `${mulkAdi(mulk)} kira getirmiyor, ama değeri artıyor` }; }
    if (/\b(yemek|yemegi|aksam yeme|kahvalti|film|dizi|mac|tatil|hava|uyku|cay|kahve|muzik|sarki)\b/.test(katli) && !/(kurs|maas|kredi|mulk|is\b|isletme|kafe)/.test(katli)) return null;
    if (/\b(altin|dolar|euro|doviz|borsa|bitcoin|kripto|hisse)\w*/.test(katli) && !/(doviz burosu|doviz lisans)/.test(katli)) return { metin: `Altın, döviz, borsa daha yok oyunda, sonraki güncellemede gelecekmiş. Şimdilik en sağlamı mülk: daire ${paraYaz(T.propertyMarketPrice(world, 'daire'))}, kirası ayda ${paraYaz(T.propertyMarketPrice(world, 'daire') * ((C().PROPERTY_TYPES.find(x => x.kind === 'daire') || {}).monthlyRentRate || .005))} civarı` };
    for (const [re, f] of NASIL) if (re.test(katli)) return { metin: f(world, meta, oyuncu) };
    if (/\b(cami|okul|cesme|hastane|vakif|hayir eser\w*|bagis\w*)\b/.test(katli) && /\b(mi|mu|ne|nasil|kac|hangisi|olur|oluyor|yarar|kazandir\w*|degisir)\b/.test(katli)) { const o = ozelGun(world.day); return { metin: `Şu an hangisini yaptırdığın fark etmiyor, her 10 bin bağışa 1 itibar geliyor${o && o.bayram ? ', bugün bayram olduğu için 2' : ', bayramda 2 katı'}. İtibar da kredi notuna ve iş başvurularına yarıyor` }; }
    if (/taksi/.test(katli) && /(ucuz|pahali|fark|ayni|daha mi|mi daha|yoksa)/.test(katli)) return { metin: 'Taksicilik de nakliyecilikle aynı meslek sayılıyor, şartları da kazancı da aynı' };
    if (/\b(arac|kamyon|kamyonet|taksi|tir)\w*/.test(katli) && (/nakliye|taksi|kamyon/.test(katli) || (varlik && varlik.meslek === 'nakliyeci') || /(lazim|gerek|almak|alsam|kac para|ne kadar)/.test(katli))) { const pr = C().PROFESSIONS.find(x => x.id === 'nakliyeci'), rq = pr.requirements; if (/kazan/.test(katli)) return { metin: `Nakliyeci ayda ${paraYaz(beklenenGelir(world, { k: { caliskan: .75 } }, 'nakliyeci'))} civarı kazanıyor. Ama önce ${paraYaz(T.indexed(world, rq.capital))} sermaye lazım, aracın parası o`, odak: { meslek: 'nakliyeci' } }; return { metin: `Nakliyeci olmak için ${paraYaz(T.indexed(world, rq.capital))} sermaye lazım, aracın parası o. Bir de ${rq.anyExperienceDays} gün iş deneyimi. Araç bakımı her ay ${paraYaz(T.indexed(world, C().VEHICLE_MONTHLY_UPKEEP))} kesiliyor`, odak: { meslek: 'nakliyeci' } }; }
    if (/kademe/.test(katli) && /(atla|gec|lazim|gerek|nasil|ne kadar|kac)/.test(katli)) { const P = C().PROFESSIONS, mn = t => { const l = P.filter(x => x.tier === t); return l; }; const k2 = mn(2), k3 = mn(3), k4 = mn(4); const g2 = Math.min(...k2.map(x => x.requirements.anyExperienceDays || (x.requirements.professionExperience || {}).days || 0)), g3 = Math.min(...k3.map(x => x.requirements.anyExperienceDays || 60)), s3 = Math.min(...k3.map(x => x.requirements.capital || 0)), g4 = Math.min(...k4.map(x => x.requirements.anyExperienceDays || 60)), s4 = Math.min(...k4.map(x => x.requirements.capital || 0));
      return { metin: `İkinci kademe için kurs ve en az ${g2} gün deneyim, üçüncü kademe için ${g3} gün deneyim ve en az ${paraYaz(T.indexed(world, s3))} sermaye lazım. Dördüncü kademe ${paraYaz(T.indexed(world, s4))} sermaye ve ${g4} gün deneyimle başlıyor` }; }
    if (/(mevduat|faize koy|faize yatir|bankada tut|bankaya koy|vadeli)/.test(katli)) return { metin: `Mevduat faizi yok oyunda, bankaya koyunca hiçbir şey getirmiyor. Fiyatlar yılda ${yuzde(enflasyonYillik(world, meta))} artıyor, nakit durdukça eriyor. Mülk alırsan hem kira getiriyor hem değerleniyor` };
    if (/\bimar\w*/.test(katli)) return { metin: 'İmar diye bir şey yok oyunda, arsa arsa işte. İnşaat güncellemesi gelince işe yarayacakmış' };
    if (/(kiralasam|kiralayabilir|kiralik)/.test(katli) && ((varlik && (varlik.mulk === 'dukkan' || varlik.isletme)) || /dukkan|isyeri|kafe/.test(katli))) { const d = T.getBusinessDef('dukkan'); return { metin: `İşyeri kiralamak yok oyunda. Dükkan işletmesi açarsan kuruluşu ${paraYaz(T.indexed(world, d.setupCost))}, sonra ayda ${paraYaz(T.indexed(world, d.monthlyFixedCost))} sabit gideri var` }; }
    if (/(kiralasam|kirada otur|kirada kal|kiraya mi cik|kira mi odesem|ev tutsam|kiralik ev)/.test(katli)) { const kira = T.indexed(world, C().BASE_ROOM_RENT); return { metin: `Ev sahibi değilsen her ay ${paraYaz(kira)} civarı kira gidiyor zaten. Daire alırsan kira ödemezsin, ama peşinat için ${paraYaz(T.propertyMarketPrice(world, 'daire') * (1 - C().MORTGAGE_MAX_LTV))} lazım` }; }
    if (/asgari/.test(katli)) return { metin: `Asgari ücret ${paraYaz(T.indexed(world, C().MIN_WAGE))}, işletmeler bunun altında maaş veremiyor` };
    if (konu === 'yetki_istegi') return { metin: rng0(katli).pick(['Ben admin değilim ki 😄 Herkes gibi oyuncuyum', 'Para gönderme diye bir şey yok oyunda, herkes kendi kazanıyor', 'Hile falan yok valla, çalışıp biriktireceksin', 'Yetki işleri bizde değil, oyunun kuralları belli']) };
    // İki seçeneği karşılaştırma: "ustalık mı muhasebe mi", "kurye mi garson mu"
    const kurslar2 = KURS_ANAHTAR.filter(([re]) => new RegExp('\\b(' + re + ')').test(katli)).map(x => x[1]);
    const meslek2 = [['kurye', 'kurye'], ['garson', 'garson'], ['kasiyer|market', 'market_calisani'], ['memur', 'memur'], ['muhasebe', 'muhasebeci'], ['emlak', 'emlak_danismani'], ['usta', 'usta'], ['insaat', 'insaat_iscisi'], ['taksi|nakliye', 'nakliyeci']].filter(([re]) => new RegExp('\\b(' + re + ')').test(katli)).map(x => x[1]);
    if (/\b(mi|mu|mı|mü|yoksa|hangisi|veya|ya da)\b/.test(katli) && (new Set(kurslar2).size >= 2 || new Set(meslek2).size >= 2)) {
      const ml = [...new Set(meslek2.length >= 2 ? meslek2 : kurslar2.map(k => (C().PROFESSIONS.find(m => m.requirements.course === k) || {}).id).filter(Boolean))].slice(0, 2);
      if (ml.length === 2) { const g = ml.map(m => beklenenGelir(world, { k: { caliskan: .75 } }, m)); const iyi = g[0] >= g[1] ? 0 : 1; const sart = m => { const r0 = T.getProfession(m).requirements; return r0.course ? `${kursSoz(r0.course)} gerekiyor` : 'şartsız başlanıyor'; };
        return { odak: { secim: ml[iyi], secimDiger: ml[1 - iyi] }, metin: `${meslekAdi(ml[0])} ayda ${paraYaz(g[0])}, ${meslekAdi(ml[1])} ${paraYaz(g[1])} civarı. Para olarak ${meslekAdi(ml[iyi])} önde ama ${meslekAdi(ml[0])} için ${sart(ml[0])}, ${meslekAdi(ml[1])} için ${sart(ml[1])}` }; }
    }
    // Yatırım sorusu: NPC kendi gerçek portföyünden konuşur
    if (/(yatirim|degerlendir|nereye yatir|ne onerir|parayi nere|paranizi nere|birikimi nere|nakitte mi)/.test(katli)) {
      const ms = p.propertyIds.map(x => world.properties[x]).filter(Boolean), d = T.propertyMarketPrice(world, 'daire');
      if (ms.length) { const kira = ms.filter(m => !m.ownerLivesIn).reduce((t, m) => t + T.propertyMarketPrice(world, m.kind) * ((C().PROPERTY_TYPES.find(x => x.kind === m.kind) || {}).monthlyRentRate || 0), 0); return { metin: `Ben paramı mülke yatırdım, ${ms.length} mülküm var${kira ? `, ayda ${paraYaz(kira)} kira geliyor` : ''}. Daire şu an ${paraYaz(d)}, her ay değerleniyor` }; }
      if (p.businessIds.length) { const b0 = world.businesses[p.businessIds[0]]; return { metin: `Ben her şeyi ${isletmeAdi(b0 && b0.type)} işine yatırdım, iyi ayda ${paraYaz(Math.max(0, T.estimateBusinessMonthlyProfit(world, b0.type, 2)))} kâr bırakıyor` }; }
      return { metin: `Ben ev almak için biriktiriyorum, ${paraYaz(p.cash)} oldu. Daire ${paraYaz(d)}, krediyle peşinat ${paraYaz(d * (1 - C().MORTGAGE_MAX_LTV))}. Nakitte tutunca enflasyon eritiyor` };
    }
    const kurs = bul(katli, KURS_ANAHTAR), isletme = bul(katli, ISLETME_ANAHTAR);
    // Açıkça sorulan şeyler önce (konu ne olursa olsun)
    if (isletme && /\b(ac|acmak|acsam|acarim|acilir|kur|kurmak|kursam|maliyet\w*|sermaye\w*|kac|kaca|ne kadar|patlar|tutar|gerek\w*|lazim)\b/.test(katli) && !/(calis|eleman|garson ari|lisans|belge|kursu)/.test(katli)) {
      const d = T.getBusinessDef(isletme), sahip = C().PROFESSIONS.find(m => m.business === isletme), rq = sahip ? sahip.requirements : {};
      const sart = [rq.course ? kursSoz(rq.course) : null, rq.anyExperienceDays ? `${rq.anyExperienceDays} gün iş deneyimi` : null, rq.professionExperience ? `${rq.professionExperience.days} gün ${meslekAdi(rq.professionExperience.profession)} deneyimi` : null].filter(Boolean);
      return { metin: `${isletmeAdi(isletme).charAt(0).toLocaleUpperCase('tr') + isletmeAdi(isletme).slice(1)} açmak ${paraYaz(T.indexed(world, d.setupCost))}, aylık sabit gideri ${paraYaz(T.indexed(world, d.monthlyFixedCost))}, ${d.staffNeeded} çalışan istiyor.${sart.length ? ' Şart: ' + sart.join(', ') + '.' : ''} İyi giderse ayda ${paraYaz(Math.max(0, T.estimateBusinessMonthlyProfit(world, isletme, 2)))} kâr bırakıyor`, odak: { isletme, kurs: rq.course || null } };
    }
    if (isletme && /(kazan|kar\b|kâr|gelir|nasil para|nerden para|kur farki)/.test(katli)) { const d = T.getBusinessDef(isletme); return { metin: `${isletmeAdi(isletme)} iyi giderse ayda ${paraYaz(Math.max(0, T.estimateBusinessMonthlyProfit(world, isletme, 2)))} kâr bırakıyor. Cironun ${yuzdeSi(Math.round((1 - d.costOfGoodsRate) * 100))} sana kalıyor, gerisi mal maliyeti. Bir de ${paraYaz(T.indexed(world, d.monthlyFixedCost))} sabit gider var`, odak: { isletme } }; }
    const sorulanMeslek = (varlik && varlik.meslek) || bul(katli, MESLEK_ANAHTAR);
    if (sorulanMeslek && !(kurs && /(kurs|belge|lisans|sinav|sure|kac gun)/.test(katli)) && /(kazan|maas|ne kadar|kac (para|alir|veriyor)|getiri|aliyor)/.test(katli)) {
      const pr = T.getProfession(sorulanMeslek); const ne = pr.earning === 'task' ? `, görev başına ${paraYaz(T.indexed(world, pr.payPerTask))} alıyor` : pr.earning === 'salary' ? ', sabit maaş' : '';
      const sart = pr.requirements.course ? ` Ama önce ${kursSoz(pr.requirements.course)} lazım` : '';
      return { metin: `${meslekAdi(sorulanMeslek)} ayda ${paraYaz(beklenenGelir(world, { k: { caliskan: .75 } }, sorulanMeslek))} civarı kazanıyor${ne}.${sart}`, odak: { meslek: sorulanMeslek, kurs: pr.requirements.course || null } };
    }
    if ((konu === 'kurs_sorusu' || /kurs|belge|sinav|lisans/.test(katli)) && kurs) {
      const c = T.getCourse(kurs), acar = C().PROFESSIONS.find(m => m.requirements.course === kurs);
      const ek = acar && acar.requirements.anyExperienceDays ? `, bir de ${acar.requirements.anyExperienceDays} gün iş deneyimi lazım` : '';
      const nasil = /(nasil|nerden|nereden)/.test(katli) ? ' Kariyer\'deki Kurslar sekmesinden başlıyorsun.' : '';
      return { metin: `${kursSoz(kurs)} ${paraYaz(T.indexed(world, c.cost))}, ${c.durationDays} gün sürüyor. Bitince ${meslekAdi(acar ? acar.id : '')} olabiliyorsun${ek}.${nasil}`, odak: { kurs, meslek: acar && acar.id } };
    }
    if ((konu === 'fiyat_sorusu' || konu === 'eleman_ariyorum' || konu === 'yardim' || /maliyet|kac para|ne kadar|sermaye/.test(katli)) && isletme && (/(ac|kur|maliyet|sermaye|kac|ne kadar)/.test(katli) || (takip === 'detay' && katli.split(' ').length <= 3))) {
      const d = T.getBusinessDef(isletme);
      return { metin: `${isletmeAdi(isletme)} açmak ${paraYaz(T.indexed(world, d.setupCost))}, aylık sabit gideri ${paraYaz(T.indexed(world, d.monthlyFixedCost))}. ${d.staffNeeded} çalışan istiyor` };
    }
    if (konu === 'kredi_sorusu' || (takip && /kredi|taksit|faiz|odeyemez|not\b/.test(katli))) {
      if (/(redd?\w*|cikmadi|vermedi|vermiyor|onaylanmadi|alamadim)/.test(katli)) { const l = Math.round(oyuncu.lastMonthIncome * oyuncu.creditScore / 100); return { metin: `Limit geçen ayki gelirine göre çıkıyor: gelir çarpı kredi notu bölü 100. Senin şu an ${paraYaz(l)}, notun ${oyuncu.creditScore}. ${l ? 'Bu limitin altında iste, çıkar' : 'Geçen ay gelirin olmadığı için sıfır, ilk maaştan sonra açılır'}` }; }
      if (/\bnot\w*\b/.test(katli) && /(dusuk|dustu|dusuyor|kotu|yuksel|artir|duzel|kac)/.test(katli)) return { metin: `Kredi notun şu an ${oyuncu.creditScore}. Taksitleri zamanında ödersen ve bağış yapıp itibar kazanırsan yükseliyor, kaçırırsan düşüyor. Not düşükse limit de düşük çıkıyor` };
      if (/(istemem|cekmem|almam|cekmeyecegim|bulasmam|yuksek|cok faiz|pahali)/.test(katli)) return { metin: rng0(katli).pick([`Haklısın, aylık ${yuzde(world.policy.loanMonthlyRate * 100)} yıllıkta ${yuzde(((1 + world.policy.loanMonthlyRate) ** 12 - 1) * 100)} ediyor. Maaşla biriktirmek daha sağlam`, `Ben de çekmiyorum, yıllığı ${yuzde(((1 + world.policy.loanMonthlyRate) ** 12 - 1) * 100)} ediyor. Biriktir, peşin al`]) };
      if (/(baska yol|para bul|nasil para|nerden para)/.test(katli)) { const t = tavsiye(world, oyuncu); return { metin: `Kredisiz tek yol çalışıp biriktirmek. ${t.meslek ? `${t.meslek} olursan ayda ${t.tutar} civarı gelir, görev yaptıkça artar` : 'Görev yaptıkça kazanıyorsun'}` }; }
      if (/odeyemez|odeyemiyor|kacirir|batar/.test(katli)) return { metin: `${C().MISSED_PAYMENTS_FOR_FORECLOSURE} taksit üst üste kaçırırsan icraya düşüyorsun, kredi notun da düşer. Bence taksiti gelirinin yarısını geçmesin` };
      const limit = Math.round(oyuncu.lastMonthIncome * oyuncu.creditScore / 100);
      if (varlik && varlik.tutar && varlik.tutar > 1000) { const gerekGelir = Math.round(varlik.tutar / (oyuncu.creditScore / 100)); return { metin: varlik.tutar <= limit ? `${paraYaz(varlik.tutar)} çıkar, limitin ${paraYaz(limit)}` : `${paraYaz(varlik.tutar)} için aylık gelirin ${paraYaz(gerekGelir)} civarı olmalı, senin limitin şu an ${paraYaz(limit)}` }; }
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
      const m = (varlik && varlik.meslek) || bul(katli, MESLEK_ANAHTAR) || (IKINCI_TEKIL.test(katli) ? p.profession : null);
      if (m) { const pr = T.getProfession(m); const ne = pr.earning === 'task' ? `, görev başına ${paraYaz(T.indexed(world, pr.payPerTask))}` : pr.earning === 'salary' ? ', sabit maaş' : ''; return { metin: `${meslekAdi(m)} ayda ${paraYaz(beklenenGelir(world, { k: { caliskan: .75 } }, m))} civarı kazanıyor${ne}` }; }
    }
    if (konu === 'bayram' && /bayram/.test(katli) && !/(kutlu|mubarek|hayirli|iyi bayram)/.test(katli)) { const o = ozelGun(world.day); if (!(o && o.bayram)) { let g = 1; while (g < 400 && !((ozelGun(world.day + g) || {}).bayram)) g++; const s2 = ozelGun(world.day + g); if (s2) return { metin: `Sıradaki bayram ${s2.ad}, ${g} gün sonra. Bayramlarda bağış iki kat itibar veriyor, kanal da çok hareketli oluyor` }; } }
    if (konu === 'bayram') { const o = ozelGun(world.day); if (/etkinlik|ne var|ne olacak|bagis|ne oluyor|ne olur/.test(katli)) return { metin: `${o ? o.ad + ' boyunca' : 'Bayramlarda'} bağış iki kat itibar veriyor, herkes bağış yapıyor. Kanal da hareketli oluyor` }; }
    if (konu === 'dert') {
      if (/kredi\w* (red|onay|cikma|vermedi|vermiyor|alamadim)|kredim (red|cikmadi)/.test(katli)) { const l = Math.round(oyuncu.lastMonthIncome * oyuncu.creditScore / 100); return { metin: `Kredi limiti geçen ayki gelirine göre çıkıyor, senin şu an ${paraYaz(l)}, kredi notun ${oyuncu.creditScore}. ${l ? 'Bu limitin altında iste' : 'Ay sonu maaşın yatınca açılır'}` }; }
      if (/(eleman|calisan|isci)\w* (kacti|ayrildi|istifa|gitti)/.test(katli)) { const mk = 'market_calisani'; return { metin: `Maaş piyasanın altındaysa gidiyorlar. Kasiyer başka yerde ${paraYaz(beklenenGelir(world, { k: { caliskan: .7 } }, mk))} civarı kazanıyor, ona yakın verirsen kalırlar` }; }
      const isl = oyuncu.businessIds.length && world.businesses[oyuncu.businessIds[oyuncu.businessIds.length - 1]];
      if (isl && /(zarar|batiyor|batti|musteri yok|ciro|kazanmiyor|kar etmiyor)/.test(katli)) {
        const d = T.getBusinessDef(isl.type), ayni = Object.values(world.businesses).filter(b => b.type === isl.type).length, eksik = d.staffNeeded - Object.keys(isl.employees).length;
        const sebep = [ayni > 2 ? `bu arada ${ayni} tane ${isletmeAdi(isl.type)} var, müşteri bölünüyor` : null, eksik > 0 ? `${eksik} kişilik eksiği geçici personel kapatıyor, onlar hem pahalı hem verimsiz` : null, 'her gün yönet de, her biri o günün cirosuna %3 ekliyor'].filter(Boolean);
        return { metin: sebep.slice(0, 2).join('; ').replace(/^\p{Ll}/u, c => c.toLocaleUpperCase('tr')) };
      }
      if (oyuncu.mustWork || oyuncu.cash < aylikIhtiyac(world) || /(param bitti|iflas|sifirlan|eksiye|bes parasiz|meteliksiz)/.test(katli)) { const t = tavsiye(world, oyuncu); return { metin: `Önce bir işe gir, borç kapanana kadar yatırım yapamıyorsun. ${t.meslek ? `${t.meslek} olursan ayda ${t.tutar} civarı gelir` : ''}`.trim() }; }
      if (/(ne yap|napca|ne yapcam|ne yapmali|is versen|is lazim|is verin|kim alir)/.test(katli)) { const f = isFirsatlari(world, meta, oyuncu)[0]; if (f) return { metin: `${meta.npc[f.npcId] ? meta.npc[f.npcId].ad : 'Bir tanıdık'} ${meslekAdi(f.meslek)} arıyor, ${paraYaz(f.maas)} veriyor. Ona yaz bence` }; const t = tavsiye(world, oyuncu); if (t.meslek) return { metin: `Bence önce ${t.meslek} ol, ayda ${t.tutar} civarı gelir, sonra toparlarsın` }; }
      return null; // genel moral derdi: kalıp cevaplar (empati) yeter, meslek tavsiyesi yok
    }
    if (konu === 'yardim' && /ne yap|napca|ne yapacag/.test(katli)) {
      const t = tavsiye(world, oyuncu);
      if (oyuncu.mustWork || oyuncu.cash < aylikIhtiyac(world)) return { metin: `Önce bir işe gir, borç kapanana kadar yatırım yapamıyorsun. ${t.meslek ? `${t.meslek} olursan ayda ${t.tutar} civarı kazanırsın` : ''}` };
      if (t.meslek) return { metin: `Moralini bozma. ${t.kurs ? `${t.kurs} alırsan ${t.meslek} olabilirsin, ayda ${t.tutar} kazandırıyor` : `${t.meslek} olursan ayda ${t.tutar} civarı kazanırsın`}` };
    }
    if (konu === 'teklif' && /ortak|beraber|birlikte|yari yariya|takas/.test(katli)) return { metin: 'Ortaklık sistemi oyunda daha yok, gelecek güncellemede gelecekmiş. Şimdilik herkes kendi işini kuruyor' };
    if (konu === 'meslek_tavsiyesi' || (konu === 'yardim' && /(ne yap|ne onerir|nasil para|para nasil|ilk ne|baslangic)/.test(katli))) {
      const sahte = { k: { caliskan: .75 } }, ml = MESLEK_ANAHTAR.filter(([re]) => new RegExp('\\b(' + re + ')').test(katli)).map(x => x[1]);
      // Belirli bir meslek anıldıysa onun hakkında konuş
      if (ml.length === 1) { const m = ml[0], pr = T.getProfession(m), g = beklenenGelir(world, sahte, m), eksik = T.missingRequirements(world, oyuncu.id, m).length; return { metin: `${meslekAdi(m)} ayda ${paraYaz(g)} civarı getiriyor. ${eksik ? `Önce ${pr.requirements.course ? kursSoz(pr.requirements.course) : 'biraz deneyim'} lazım` : 'Hemen başlayabilirsin'}${pr.earning === 'task' ? ', çalıştıkça kazanıyorsun' : pr.earning === 'salary' ? ', maaş sabit' : ''}`, odak: { meslek: m, kurs: pr.requirements.course || null } }; }
      // Oyuncunun durumuna göre: işsiz → iki seçenek + uzun vade; işi varsa → bir üst basamak
      const sartsiz = C().PROFESSIONS.filter(m => m.tier === 1 && m.earning !== 'business').map(m => ({ m: m.id, g: beklenenGelir(world, sahte, m.id) })).sort((a, b) => b.g - a.g);
      const kurslu = C().PROFESSIONS.filter(m => m.requirements.course && m.earning !== 'business' && !oyuncu.completedCourses.includes(m.requirements.course)).map(m => ({ m: m.id, g: beklenenGelir(world, sahte, m.id), k: m.requirements.course })).sort((a, b) => b.g - a.g);
      const r2 = rng0(katli + kim.id);
      if (!oyuncu.profession) { const a = sartsiz[0], b = sartsiz[1 + Math.floor(r2.next() * 2)], u = kurslu[Math.floor(r2.next() * Math.min(3, kurslu.length))]; return { metin: `Şartsız işlerde en çok ${meslekAdi(a.m)} kazandırıyor, ${paraYaz(a.g)} civarı. ${meslekAdi(b.m)} ${deDa(meslekAdi(b.m))} olur ama daha az. Uzun vadede ${u ? kursSoz(u.k) + ' alıp ' + meslekAdi(u.m) + ' ol' : 'kendi işini kur'}, ${u ? paraYaz(u.g) : ''} civarı`.replace(/, civarı$/, ''), odak: { meslek: a.m } }; }
      const simdi = beklenenGelir(world, sahte, oyuncu.profession), ust = kurslu.find(x => x.g > simdi * 1.1);
      if (ust) return { metin: `Şu an ${meslekAdi(oyuncu.profession)} ${paraYaz(simdi)} civarı getiriyor. Bir üst basamak için ${kursSoz(ust.k)} al, ${meslekAdi(ust.m)} ${paraYaz(ust.g)} civarı kazanıyor`, odak: { meslek: ust.m, kurs: ust.k } };
      const isl = C().PROFESSIONS.find(m => m.earning === 'business' && m.tier === 3);
      return { metin: `Bence sıradaki adım kendi işin. ${isletmeAdi(isl.business)} açmak ${paraYaz(T.indexed(world, T.getBusinessDef(isl.business).setupCost))}, birikimin yeterse düşün`, odak: { isletme: isl.business } };
    }
    if (konu === 'kisisel_yer') return { metin: `${yerAdi(kim)}${kim.yer && kim.yer.sehir && kim.yer.sehir !== yerAdi(kim) ? ', ' + kim.yer.sehir : ''}. Sen nerdesin?` };
    if (konu === 'kisisel_meslek') return { metin: p.profession ? `${meslekAdi(p.profession)} olarak çalışıyorum, ${sureYaz(world.day - p.professionSince)}` : 'Şu an boştayım, iş bakıyorum', kisisel: true };
    return null;
  }
  NPCYZ.bilgi = (world, meta, id, konu, varlik, oyuncu, metin) => bilgi(world, meta, meta.npc[id], konu, varlik, oyuncu, (dil().normal)(metin).katli, null);

  /** Bilgi cümlesini NPC'nin üslubuyla söyler (bazen kısa bir girişle). */
  function bilgiPaketi(world, meta, id, b, rng, gecikme) {
    const kim = meta.npc[id];
    let giris = !b.kisisel && rng.chance(.18) ? rng.pick(kim.k.resmi > .55 ? ['Bildiğim kadarıyla', 'Benim bildiğim'] : ['valla', 'bak']) + ' ' : '';
    // En çok iki bilgi: cümleleri ve virgüllü parçaları kırp (soru çok parçalıysa üç)
    { const cumleler = b.metin.split(/(?<=[.!?])\s+/); let kisa = cumleler.slice(0, 2).join(' '); const parca = kisa.split(', '); if (parca.length > 3) kisa = parca.slice(0, 3).join(', '); b = Object.assign({}, b, { metin: kisa }); }
    let govde = b.metin;
    // Takip sorusu: bilginin yalnız sorulan parçasını söyle (daha önce söylenmemişse)
    if (tekrarMi(meta, kim, govde) && b.soru) {
      const parcalar = govde.split(/(?<=[.!?])\s+|,\s+/).map(x => x.trim()).filter(Boolean);
      const k = b.soru, ISTEK = [[/(kac gun|ne kadar surer|sure|surer|kac ay)/, /gün|ay vade|süre/], [/(kac para|ne kadar|kaca|fiyat|ucret|maliyet|kac|tutar)/, /₺|bin|milyon/], [/(kira|getiri)/, /kira|getiri/], [/(faiz)/, /faiz/], [/(limit)/, /limit/], [/(peşinat|pesinat)/, /peşinat/], [/(sart|ne lazim|gerek|deneyim)/, /şart|lazım|deneyim|gerek/], [/(kazan|kar|gelir|getir)/, /kazan|kâr|getir/], [/(nerede|nerden|nereden|nasil)/, /ekran|sekme|Kariyer|Banka|Mülklerim|Şirketim/], [/(olur mu|oluyo|olabil|olunur|olur muyuz|olacak mi)/, /olabiliyorsun|olursun|olunuyor|olabilirsin/]];
      let ist = ISTEK.filter(([q]) => q.test(k)); if (ist.length > 1 && ist[0] === ISTEK[0]) ist = [ist[0]]; // "ne kadar sürer": süre, para değil
      const hedef = ist.map(x => x[1]);
      const sec = parcalar.find(x => hedef.some(h => h.test(x)) && !tekrarMi(meta, kim, x)) || parcalar.find(x => hedef.some(h => h.test(x)));
      if (sec) { const evetHayir = /\b(mi|mı|mu|mü|miyim|muyuz|miyiz)\b/.test(k) && !/(kac|ne kadar|nerede|nasil|hangi)/.test(k); govde = evetHayir ? 'Evet, ' + sec.charAt(0).toLocaleLowerCase('tr') + sec.slice(1) : sec.charAt(0).toLocaleUpperCase('tr') + sec.slice(1); b = Object.assign({}, b, { metin: govde, tekrarOk: true }); }
    }
    if (!b.tekrarOk && tekrarMi(meta, kim, govde)) {
      // Aynı bilgiyi yeniden yapıştırma: kısa, dürüst bir cevap
      kim.yazdimSayisi = (kim.yazdimSayisi || 0) + 1;
      const ilkParca = govde.split(/(?<=[.!?])\s+|,\s+/)[0].replace(/[.!]+$/, '');
      const ayniSoru = b.soru && kim.sonSoru && b.soru === kim.sonSoru;
      govde = ayniSoru || !b.soru ? rng.pick(['Az önce yazmıştım, ', 'Yazdım ya, ', 'Dediğim gibi ']) + ilkParca.charAt(0).toLocaleLowerCase('tr') + ilkParca.slice(1) : rng.pick(['Onu tam bilmiyorum açıkçası', 'Ondan pek anlamam, başkası bilir', 'Bilmiyorum valla, hiç denemedim', 'Emin değilim, bilen biri yazar belki']);
    }
    if (giris && (/^(onu|bilmiyor|emin|ke[sş]ke|evet|hay[ıi]r|yok|dedi[gğ]im|az [oö]nce|ben\b|bence|valla|bak\b|[şs]u an bo[sş]ta)/i.test(govde) || govde.split(' ').length < 4 || (/^Bildi|^Benim/.test(giris) && /^\p{Lu}\p{Ll}+(,| )/u.test(govde) && govde.split(' ').length < 6))) giris = '';
    // Giriş kelimesinden sonra cümle küçük harfle devam eder (özel ad değilse)
    const ikinciBuyuk = /^\S+ \p{Lu}/u.test(govde);
    let metin = giris ? giris + (ikinciBuyuk ? govde : govde.charAt(0).toLocaleLowerCase('tr') + govde.slice(1)) : govde;
    metin = yuvarla(metin, rng);
    try { metin = (dil().stillendir)(metin, stilOf(kim), rng); } catch (e) { }
    if (b.soru) kim.sonSoru = b.soru;
    b.metin.split(/(?<=[.!?])\s+|,\s+/).forEach(x => soyledi(meta, kim, x));
    soyledi(meta, kim, b.metin);
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
  // Son cevap verene dönük doğrulama soruları
  const TEYIT = /\b(hala (gecerli|lazim|duruyor|var mi|ariyor)\w*|gecerli mi\w*|sizden mi|senden mi|sende mi|ciddi misin|gercek mi|emin misin|lazim mi hala|kesin mi)\b/;
  // Aynı konu ailesindeki sorular bağlamı bozmaz (kredi↔faiz, mülk↔fiyat↔teklif, eleman↔maaş, kurs↔meslek)
  const AILE = { kredi_sorusu: ['ekonomi', 'fiyat_sorusu', 'teklif', 'dert', 'yardim'], ekonomi: ['kredi_sorusu', 'fiyat_sorusu'], mulk_ariyorum: ['fiyat_sorusu', 'teklif', 'mulk_satiyorum', 'kredi_sorusu'], mulk_satiyorum: ['fiyat_sorusu', 'teklif', 'mulk_ariyorum'], is_ariyorum: ['maas_sorusu', 'teklif', 'kisisel_yer', 'fiyat_sorusu'], eleman_ariyorum: ['maas_sorusu', 'teklif', 'is_ariyorum', 'kurs_sorusu', 'fiyat_sorusu'], kurs_sorusu: ['meslek_tavsiyesi', 'maas_sorusu', 'fiyat_sorusu', 'yardim'], meslek_tavsiyesi: ['kurs_sorusu', 'maas_sorusu'], dert: ['yardim', 'meslek_tavsiyesi', 'kredi_sorusu', 'is_ariyorum'] };
  const KONU_SURE = 5 * 60e3; // 5 dakika içinde gelen kısa mesaj aynı konuşmanın devamıdır

  /** Bağlaç "de/da": son ünlüye göre (kasiyer de, kurye de, garson da). */
  /** Birinci tekil ek: kuryeyim, garsonum, memurum, kasiyerim. */
  function yim(soz) { const t = String(soz), u = (t.match(/[aıoueiöü](?=[^aıoueiöü]*$)/i) || ['e'])[0].toLocaleLowerCase('tr'), e = { a: 'ım', ı: 'ım', o: 'um', u: 'um', e: 'im', i: 'im', ö: 'üm', ü: 'üm' }[u]; return t + (/[aıoueiöü]$/i.test(t) ? 'y' : '') + e; }
  function deDa(soz) { const u = (String(soz).toLocaleLowerCase('tr').match(/[aıoueiöü](?=[^aıoueiöü]*$)/) || ['a'])[0]; return /[eiöü]/.test(u) ? 'de' : 'da'; }
  function takipTuru(katli, ny, st) {
    for (const [tur, re] of TAKIP_DESEN) if (re.test(katli)) return tur;
    const kelime = katli.split(/\s+/).filter(Boolean).length;
    if (st && ny.varlik && ny.varlik.meslek && /\b(ben|bende|ben de)\b/.test(katli)) return 'ben_de';
    if (st && ny.varlik && ny.varlik.yer && kelime <= 3) return 'detay';
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

  NPCYZ.oyuncuMesaji = function (world, meta, kanal, metin, oyuncu, saat, sirketNpcIdleri, yanit) {
    const rng = rngYap(hash(metin + ':' + Date.now()));
    const npcIdler = kanal === 'sirket' ? (sirketNpcIdleri || []).filter(id => meta.npc[id]) : Object.keys(meta.npc);
    adCakismasi(world, meta, oyuncu);
    meta._gelen = (dil().normal)(metin).katli;
    if (kanal === 'sirket') { const ny0 = (dil().niyetBul)(metin, { adlar: [] }); const c0 = sirketCevap(world, meta, oyuncu, meta._gelen, ny0, npcIdler, rng, saat); if (c0) return { cevaplar: [c0], niyet: ny0 }; }
    const adlar = npcIdler.map(id => meta.npc[id].gorunen).concat(npcIdler.map(id => meta.npc[id].ad));
    const ny = (dil().niyetBul)(metin, { adlar, oyuncuAd: oyuncu.name });
    const dilTr = (dil().dilBul)(metin);
    const katli = (dil().normal)(metin).katli;
    const cevaplar = [];
    const simdi = Date.now();
    meta.diyalog = meta.diyalog || {};
    let st = meta.diyalog[kanal];
    if (st && simdi - st.zaman > KONU_SURE) st = null;
    // Bir mesaja yanıt: o mesajın konusu bağlam olur, cevabı o kişi verir
    if (yanit && yanit.metin && yanit.npcId && (!st || st.sonNpc !== yanit.npcId)) { const yn = (dil().niyetBul)(yanit.metin, { adlar: [] }); const yk = (dil().normal)(yanit.metin).katli; st = { konu: yn.niyet === 'genel' ? 'genel' : yn.niyet, varlik: Object.fromEntries(Object.entries(yn.varlik || {}).filter(([, v]) => v != null)), cevaplayan: [yanit.npcId], firsat: null, zaman: simdi, ilk: yk, simdiki: yk, sonNpc: yanit.npcId }; meta.diyalog[kanal] = st; }
    const sonKonusan = st && st.sonNpc;
    const hitapAd = (metin.match(/@([\p{L}._0-9]+)/u) || [])[1];
    const sade = x => String(x || '').toLocaleLowerCase('tr').replace(/[çğıöşü]/g, h => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[h]);
    const sonKonusanlar = new Set((meta.kanal[kanal] || []).slice(-15).map(m => m.npcId));
    const hitapBul = h => { const hs = sade(h); const ad = npcIdler.filter(id => sade(meta.npc[id].ad) === hs || sade(meta.npc[id].gorunen) === hs || sade(meta.npc[id].gorunen).startsWith(hs + ' ') || sade(meta.npc[id].gorunen).startsWith(hs + '_') || sade(meta.npc[id].gorunen).startsWith(hs + '.')); return ad.find(id => sonKonusanlar.has(id) || (st && st.cevaplayan && st.cevaplayan.includes(id))) || ad[0] || null; };
    const hedefKisi = ny.varlik && ny.varlik.kisi ? npcIdler.find(id => meta.npc[id].gorunen === ny.varlik.kisi || meta.npc[id].ad === ny.varlik.kisi || meta.npc[id].gorunen.startsWith(ny.varlik.kisi)) : (hitapAd ? hitapBul(hitapAd) : null);
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
      if (y.length) { const s = rng.pick(y), oA = oyuncu.name.split(' ')[0], k0 = katli;
        const NERE = { en: `From ${s.sehir}, you?`, de: `Aus ${s.sehir}, und du?`, es: `De ${s.sehir}, ¿y tú?`, az: `${s.sehir}dan, bəs sən?`, ar: `Ana min ${s.sehir}, w enta?` };
        const VEDA = { en: ['Bye, take care!', 'See you!'], de: ['Tschüss!', 'Bis dann!'], es: ['¡Adiós!', '¡Hasta luego!'], az: ['Sağ ol, görüşərik!'], ar: ['Ma3 el salama!'] };
        const TESEK = { en: ['You\'re welcome!', 'No problem!'], de: ['Gern geschehen!', 'Kein Problem!'], es: ['¡De nada!'], az: ['Dəyməz!'], ar: ['3afwan!'] };
        const soruMu = /\?\s*$|\b(what|how|why|which|wie|was|warum|qué|cómo|por qué|nə|niyə|necə|shu|kif|leh)\b/i.test(metin);
        let m;
        if (/(where.*from|woher|de d[oó]nde|haradan|min wein|where do you live)/i.test(metin)) m = NERE[s.dil] || NERE.en;
        else if (/\b(bye|see you|good ?night|tsch[uü]ss|adi[oó]s|hasta luego|sağ ol|ma3 el salama|gute nacht)\b/i.test(metin)) m = rng.pick(VEDA[s.dil] || VEDA.en);
        else if (/\b(thanks?|thank you|danke|gracias|shukran|təşəkkür)\b/i.test(metin)) m = rng.pick(TESEK[s.dil] || TESEK.en);
        else { const an = /^\W*(hi|hello|hey|hola|hallo|moin|salam|marhaba|ahlan|good (morning|evening))\b/i.test(metin) ? 'selam' : 'cevap';
          for (let i = 0; i < 5; i++) { try { m = (dil().uret)('global.' + s.dil + '.' + an, { ad: s.gorunen.split(/[ _]/)[0], oyuncuAd: oA, yer: s.sehir }, stilOf({ k: s.k, ruh: .2 }), rng); } catch (e) { m = 'Hi!'; }
            if (an === 'selam' ? !/new here|neu hier|nuevo|yeniyəm|anyone online/i.test(m) : !/(take care|mach's gut|cuídate|özünə yaxşı bax|ma3 el salama)/i.test(m) && (soruMu || !/no idea|keine ahnung|ni idea|bilmirəm|ma ba3rif/i.test(m)) && !(soruMu && /^(hello|hallo|hola|salam|marhaba)\b/i.test(m))) break; } }
        if (s.dil !== 'tr' && s.dil !== 'az') m = m.replace(/ı/g, 'i').replace(/İ/g, 'I');
        cevaplar.push({ npcId: s.id, ad: s.gorunen, metin: m, gecikmeMs: 3000 + rng.next() * 5000 }); }
      return { cevaplar, niyet: ny };
    }

    // ---- Bağlam: bu mesaj önceki konunun devamı mı? ----
    // Para konuşulurken "bin"siz sayı: "32 veririm" = 32 bin, "1,5 olur" = 1,5 milyon (mülkte)
    if (st && ny.varlik && !ny.varlik.tutar && ['is_ariyorum', 'eleman_ariyorum', 'mulk_ariyorum', 'mulk_satiyorum', 'fiyat_sorusu', 'maas_sorusu', 'teklif', 'zam_istegi'].includes(st.konu)) {
      const sayilar = (katli.replace(/\d+\s*\+\s*\d+/g, ' ').replace(/\d+(?:[.,]\d+)?\s*(gun|ay|yil|kisi|metre|m2|kat|oda|saat|dakika|tane|adet|yas|numara|%)\w*/g, ' ').match(/\b\d+(?:[.,]\d+)?\b/g) || []).map(x => +x.replace(',', '.')).filter(x => x > 0 && x < 1000);
      if (sayilar.length) { const n = sayilar[sayilar.length - 1], mulkte = /mulk/.test(st.konu) || (st.varlik && st.varlik.mulk); ny.varlik = Object.assign({}, ny.varlik, { tutar: Math.round(mulkte && n < 50 ? n * 1e6 : n * 1000) }); if (ny.niyet === 'genel') ny.niyet = 'teklif'; }
    }
    let takip = st ? takipTuru(katli, ny, st) : null;
    const gucluYeniKonu = ny.guven >= .6 && !['evet', 'hayir', 'genel', 'teklif', 'maas_sorusu', 'fiyat_sorusu', 'kisisel_yer', 'tesekkur'].includes(ny.niyet) && (!st || ny.niyet !== st.konu);
    if (gucluYeniKonu && takip !== 'miktar' && takip !== 'yer') takip = null;
    // Kum Saati konuşulurken kısa soru ("kursta kullanılır mı"): konu sürer
    if (st && st.ilk && /kum saat/.test(st.ilk) && !/kum saat/.test(katli) && katli.split(' ').length <= 5 && ny.soru) takip = 'detay';
    if (st && ny.niyet === st.konu && !takip) takip = 'tekrar';
    // Yalın varlık ("peki garson", "market", "ya kafe"): önceki soru bu yeni şey için soruluyor
    { const v = ny.varlik || {}, kel = katli.split(/\s+/).filter(Boolean).length;
      if (st && (!takip || takip === 'tekrar') && kel <= 3 && (v.meslek || v.isletme || v.mulk) && !/(ariyor|lazim|istiyor|satiyor|satilik|aliyor|alirim|var mi|bakiyor|ariyom|isterim|olur mu|aciyorum)/.test(katli) && ['maas_sorusu', 'fiyat_sorusu', 'meslek_tavsiyesi', 'kurs_sorusu', 'mulk_ariyorum', 'yardim', 'kredi_sorusu', 'is_ariyorum'].includes(st.konu)) takip = 'detay'; }
    if (st && TEYIT.test(katli)) takip = 'teyit';
    // Rol: "sen alır mısın" satış konuşmasında son konuşana alım sorusu
    if (st && st.konu === 'mulk_satiyorum' && /\b(sen|siz)\b.*\b(al|alir|alsana|alsaniza|almak|alirsin|alir misin|alir misiniz|alsan)\w*/.test(katli)) takip = 'teklif';
    if (st && st.konu === 'eleman_ariyorum' && ny.niyet === 'is_ariyorum' && /(issiz|eleman|calisacak|isci|personel|olan yok|kimse yok)/.test(katli)) takip = 'tekrar';
    // Aynı aileden soru: konu sürer, sorunun kendisi (faiz, fiyat, teklif) cevabı belirler
    if (st && !takip && AILE[st.konu] && AILE[st.konu].includes(ny.niyet)) takip = ny.niyet === 'teklif' || (ny.varlik && ny.varlik.tutar && ['maas_sorusu', 'fiyat_sorusu'].includes(ny.niyet)) ? 'teklif' : 'detay';
    if (st && ny.niyet === 'teklif' && ny.varlik && ny.varlik.tutar) takip = 'teklif';
    if (st && /^(biraz )?(in|insen|indir|kir|dusur|son fiyat|son rakam|yukari cik|biraz artir|artir)\b/.test(katli)) takip = 'teklif';
    const konu = takip ? st.konu : ny.niyet;
    const temiz = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null && v !== ''));
    const varlik = Object.assign({}, takip && st ? st.varlik : {}, temiz(ny.varlik));
    const oncekiSt = st;
    if (!st || !takip) st = { konu, varlik, cevaplayan: [], firsat: null, zaman: simdi, ilk: katli };
    st.konu = konu; st.varlik = varlik; st.zaman = simdi; st.takip = takip; st.onceki = st.simdiki || null; st.simdiki = katli;
    meta.diyalog[kanal] = st;
    const sonuc = { cevaplar, niyet: Object.assign({}, ny, { etkin: konu, takip }) };
    // Oyuncunun dile getirdiği ihtiyaç: sonradan biri dönüp sorar ("iş buldun mu?")
    const IHTIYAC = { is_ariyorum: 'is', mulk_ariyorum: 'mulk', dert: 'dert', eleman_ariyorum: 'eleman' };
    if (IHTIYAC[konu] && !takip && kanal === 'ulke') {
      meta.ihtiyac = (meta.ihtiyac || []).filter(x => x.tur !== IHTIYAC[konu]).concat([{ tur: IHTIYAC[konu], zaman: simdi, gun: world.day, npcler: [], once: { meslek: oyuncu.profession, isveren: oyuncu.employerBusinessId, mulk: oyuncu.propertyIds.length, nakit: oyuncu.cash, calisan: oyuncu.businessIds.length ? Object.keys((world.businesses[oyuncu.businessIds[0]] || { employees: {} }).employees).length : 0 }, soruldu: false }]).slice(-4);
    }

    // Son konuşana dönük ikinci tekil soru: o kişi kendi gerçek verisinden cevap verir
    const sk = st.sonNpc || sonKonusan;
    if (!hedefKisi && sk && meta.npc[sk] && world.players[sk] && (IKINCI_TEKIL.test(katli) || /^(sen|ya sen|peki sen)\b/.test(katli))) {
      const kc = kendisi(world, meta, meta.npc[sk], katli);
      if (kc) { cevaplar.push(bilgiPaketi(world, meta, sk, { metin: kc }, rng, 1500)); st.sonNpc = sk; return sonuc; }
    }
    // Fıkra / espri isteği: biri kısa bir tane anlatır
    if (/\b(fikra|espri|saka yap|bi saka|bir saka|guldur|komik bi|komik bir)\w*/.test(katli) && /(anlat|yap|var mi|bilen|atsana|patlat|guldur)/.test(katli)) {
      const id = konusanSec(world, meta, rng, saat, x => npcIdler.includes(x) && meta.npc[x].k.mizah > .45) || konusanSec(world, meta, rng, saat, x => npcIdler.includes(x));
      if (id) { const F = ['Kurye arkadaş müşteriye sormuş: adresiniz neresi? Müşteri: kapının önü. Kurye: hangi kapı abi, şehirde bir milyon kapı var 😄', 'Memur arkadaşa sordum maaş ne zaman yatıyor diye, "ayın sonunda, her ay sürpriz oluyor" dedi 😂', 'Enflasyon o kadar arttı ki simitçi simidi taksitle satmaya başlamış', 'Muhasebeci arkadaş evlenmiş, nikahta "evet" demeden önce gelir gider tablosu istemiş 😄', 'Kum Saati alıp kursu bir günde bitirdim, şimdi de sabrı kısaltacak bir şey arıyorum', 'Usta arkadaş "beş dakikada hallederim" dedi, üç gündür bekliyoruz 😂'];
        const pick = F.filter(x => !tekrarMi(meta, meta.npc[id], x)); const f = rng.pick(pick.length ? pick : F); soyledi(meta, meta.npc[id], f);
        cevaplar.push({ npcId: id, ad: meta.npc[id].gorunen, metin: f, gecikmeMs: 4000 + rng.next() * 4000 }); st.sonNpc = id; return sonuc; }
    }
    // Oyuncu kendi yerini söyledi ("ben de İzmirliyim", "ben de oralıyım"): soran kişi buna tepki verir, yeniden sormaz
    if (oncekiSt && oncekiSt.sonNpc && meta.npc[oncekiSt.sonNpc] && oncekiSt.konu === 'kisisel_yer' && /\b(ben|bende|ben de)\b/.test(katli) && /(l[iıuü]y[iıuü]m|deyim|dayim|teyim|tayim|oturuyorum|yasiyorum|oraliyim|buraliyim|hemseri)/.test(katli)) {
      st.sonNpc = oncekiSt.sonNpc; const k = meta.npc[st.sonNpc], yer = (ny.varlik && ny.varlik.yer) || null, ayni = /oraliyim|hemseri/.test(katli) || (yer && k.yer && (k.yer.sehir === yer || yerAdi(k) === yer));
      const mt = ayni ? rng.pick([`Aa hemşehriyiz o zaman 😄 Hangi taraf?`, `Ooo hemşehrim! Ne güzel`, `Vay, komşuyuz desene`]) : yer ? rng.pick([`${yer} güzel ya, bir ara gitmek istiyorum`, `Aa ${yer}, oraları severim`, `${yer} mi, iyiymiş. Orada iş nasıl?`]) : rng.pick(['Güzel, hoş geldin o zaman', 'Ooo iyiymiş']);
      cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: mt, kisisel: true }, rng, 1800)); st.konu = 'kisisel_yer'; sonuc.niyet.etkin = 'kisisel_yer'; return sonuc;
    }
    if (['kisisel_ad', 'kisisel_meslek', 'kisisel_yer'].includes(konu) && !hedefKisi) {
      const id = konusanSec(world, meta, rng, saat, x => npcIdler.includes(x)); const kc = id && kendisi(world, meta, meta.npc[id], katli);
      if (kc) { cevaplar.push(bilgiPaketi(world, meta, id, { metin: kc }, rng, 2000)); st.sonNpc = id; return sonuc; }
    }
    // Hitap edilen kişi: her zaman o cevaplar (konusu ne olursa olsun)
    const ekle = (id, anahtar, slot, gec) => { const c = cevapPaketi(world, meta, id, anahtar, slot, rng, gec); cevaplar.push(c); (meta.ihtiyac || []).forEach(x => { if (x.zaman === simdi && !x.npcler.includes(id)) x.npcler.push(id); }); if (!st.cevaplayan.includes(id)) st.cevaplayan.push(id); st.sonNpc = id; iliski(meta, id).mesaj++; iliski(meta, id).tanir = true; return c; };
    const oAd = oyuncu.name.split(' ')[0];
    // Yalnız sohbette görünen kişiye (figüran) hitap ya da yanıt: o kişi cevap verir
    if (hitapAd && !hedefKisi && kanal !== 'sirket') {
      const hs = sade(hitapAd), fl = kanal === 'global' ? (meta.yabanciK || []) : (meta.figuran || []);
      const sonlar = new Set((meta.kanal[kanal] || []).slice(-40).map(m => m.npcId));
      const f = fl.find(x => sonlar.has(x.id) && (sade(x.ad || '') === hs || sade(x.gorunen).startsWith(hs)));
      if (f) { const c = figuranCevap(world, meta, f, kanal, katli, ny, oyuncu, rng); if (c) { cevaplar.push(c); return sonuc; } }
    }
    // Kanalda olmayan birine hitap: o yok; konuşmadaki kişi kendisi devam eder ya da biri "bugün girmedi galiba" der
    if (hitapAd && !hedefKisi) {
      const h = hitapAd.charAt(0).toLocaleUpperCase('tr') + hitapAd.slice(1);
      const fl = st && st.konu === 'is_ariyorum' ? isFirsatlari(world, meta, oyuncu) : [], f0 = fl.find(x => x.npcId === st.sonNpc) || fl.find(x => (st.cevaplayan || []).includes(x.npcId)) || null;
      if (f0) { cevaplar.push(bilgiPaketi(world, meta, f0.npcId, { metin: rng.pick([`${h} yok galiba, ama bizde de ${meslekAdi(f0.meslek).toLocaleLowerCase('tr')} lazım, ${paraYaz(f0.maas)}`, `${h} burada değil sanırım. Benim teklif duruyor: ${paraYaz(f0.maas)}`]), kisisel: true }, rng, 2500)); return sonuc; }
      const id = konusanSec(world, meta, rng, saat, x => npcIdler.includes(x)); if (id && rng.chance(ny.soru ? .5 : .6)) cevaplar.push(bilgiPaketi(world, meta, id, { metin: rng.pick([`${h} bugün girmedi galiba`, `${h} şu an yok sanırım`, `${h} az önce çıktı`]), kisisel: true }, rng, 3000)); if (!ny.soru) return sonuc;
    }

    // ================= KAPANIŞ: teşekkür, tamam sağ ol → kısa karşılık (bilgi dökümü yok) =================
    if (st.sonNpc && meta.npc[st.sonNpc] && (ny.niyet === 'tesekkur' || ny.niyet === 'veda' || /^(tamam|tmm|ok|peki)\w* (sag ?ol|tesekkur|eyv|bakarim|anladim)/.test(katli))) {
      if (rng.chance(.75)) { let m = rng.pick(['rica ederim', 'ne demek, kolay gelsin', 'bir şey değil', 'kolay gelsin', 'eyvallah', 'rica ederim, bol şans']); try { m = (dil().stillendir)(m, stilOf(meta.npc[st.sonNpc]), rng); } catch (e) { } cevaplar.push({ npcId: st.sonNpc, ad: meta.npc[st.sonNpc].gorunen, metin: m, gecikmeMs: 2000 + rng.next() * 2000 }); }
      return sonuc;
    }
    // ================= AÇIK BİLGİ SORUSU (konu ne olursa olsun önce) =================
    if (!takip && /(kac para|maliyet|ne kadar tutar|kaca patlar|nasil alinir|nerden alinir|nereden alinir|kac gun surer|kac isci|kac calisan)/.test(katli) && (bul(katli, ISLETME_ANAHTAR) || bul(katli, KURS_ANAHTAR))) {
      const id = konusanSec(world, meta, rng, saat, x => npcIdler.includes(x)); const b = id && bilgi(world, meta, meta.npc[id], konu, varlik, oyuncu, katli, takip);
      if (b && !b.satis) { if (b.odak) st.odak = b.odak; cevaplar.push(bilgiPaketi(world, meta, id, b, rng, 2000)); st.sonNpc = id; st.cevaplayan.push(id); return sonuc; }
    }
    // ================= İŞ ARAYAN OYUNCU =================
    if (konu === 'is_ariyorum' && kanal !== 'sirket') {
      if (takip === 'ben_de' && varlik.meslek) st.istenenMeslek = varlik.meslek;
      // İşverensiz meslekler (kurye, memur): iş aramaya gerek yok, Kariyer'den doğrudan girilir
      if (takip && st.istenenMeslek && st.sonNpc && meta.npc[st.sonNpc] && !Object.values(C().BUSINESS_STAFF_PROFESSIONS).some(l => l.includes(st.istenenMeslek)) && !(varlik.meslek && varlik.meslek !== st.istenenMeslek)) {
        const im = st.istenenMeslek, pr = T.getProfession(im), ay = paraYaz(beklenenGelir(world, { k: { caliskan: .75 } }, im));
        const mt = takip === 'yer' ? 'Yeri yok, görevler telefona geliyor, nereden istersen yaparsın' : takip === 'miktar' || takip === 'teklif' ? (pr.earning === 'task' ? `Görev başına ${paraYaz(T.indexed(world, pr.payPerTask))}, günde ${pr.maxTasksPerDay || 'birkaç'} görev. Ayda ${ay} civarı ediyor` : `Sabit maaş, ayda ${ay} civarı`) : /\b(motor|arac|araba|ekipman)\w*/.test(katli) ? 'Gerekmiyor, görevi yapman yeterli' : takip === 'onay' ? 'Kariyer ekranına gir, oradan başla. Kolay gelsin' : null;
        if (mt) { cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: mt, kisisel: true }, rng, 1800)); return sonuc; }
      }
      { const im = (!takip || takip === 'ben_de' || takip === 'detay') && varlik.meslek; const kadrolu = im && Object.values(C().BUSINESS_STAFF_PROFESSIONS).some(l => l.includes(im));
        if (im && !kadrolu && T.getProfession(im) && !T.getProfession(im).business) { const pr = T.getProfession(im), id = konusanSec(world, meta, rng, saat, x => npcIdler.includes(x) && world.players[x].profession === im) || konusanSec(world, meta, rng, saat, x => npcIdler.includes(x));
          if (id) { const ne = pr.earning === 'task' ? `görev başına ${paraYaz(T.indexed(world, pr.payPerTask))}` : `sabit maaş, ayda ${paraYaz(beklenenGelir(world, { k: { caliskan: .75 } }, im))} civarı`; const sart = pr.requirements.course ? `Önce ${kursSoz(pr.requirements.course)} ve ${pr.requirements.anyExperienceDays || 0} gün deneyim lazım. ` : '';
            const ben = world.players[id].profession === im ? `Ben de ${yim(meslekAdi(im).toLocaleLowerCase('tr'))}, ` : '';
            const g0 = sart ? `${ben}${ben ? 'işveren' : meslekAdi(im) + ' için işveren'} gerekmiyor. ${sart.replace(/\. $/, '')}, sonra Kariyer'den başlıyorsun, ${ne}` : `${ben}${ben ? 'işveren' : meslekAdi(im) + ' için işveren'} aramana gerek yok. Kariyer'den doğrudan başlıyorsun, ${ne}`;
            cevaplar.push(bilgiPaketi(world, meta, id, { metin: g0.charAt(0).toLocaleUpperCase('tr') + g0.slice(1), kisisel: !!ben, odak: { meslek: im } }, rng, 2200)); st.sonNpc = id; st.odak = { meslek: im }; st.istenenMeslek = im; return sonuc; } } }
      let firsatlar = isFirsatlari(world, meta, oyuncu, st.istenenMeslek || varlik.meslek);
      if (varlik.yer) { const yerde = firsatlar.filter(x => x.yer === varlik.yer || (meta.npc[x.npcId].yer && meta.npc[x.npcId].yer.sehir === varlik.yer)); if (yerde.length) firsatlar = yerde.concat(firsatlar.filter(x => !yerde.includes(x))); else st.yerUyumsuz = varlik.yer; }
      const f = st.firsat && firsatlar.find(x => x.isletmeId === st.firsat.isletmeId) || null;
      const IYELIK = { dukkan: 'dükkanı', kafe: 'kafesi', fabrika: 'fabrikası' };
      const patronSlot = x => ({ isletme: isletmeAdi(x.isletme), isletmesi: IYELIK[x.isletme] || isletmeAdi(x.isletme), meslek: meslekAdi(x.meslek), tutar: paraYaz(x.maas), yer: x.yer, oyuncuAd: oAd });
      if (f && (takip === 'ne_zaman' || /(aksam|sabah|hafta sonu|vardiya|saat|part ?time|yari zaman|mesai)/.test(katli))) { cevaplar.push(bilgiPaketi(world, meta, f.npcId, { metin: /(ne zaman|hemen|bugun|yarin|baslar)/.test(katli) ? 'Başvurunu onaylayınca hemen başlıyorsun, ertesi gün ilk görevler gelir' : rng.pick([`Saat derdi yok, ayda ${C().EMPLOYEE_FULL_PAY_TASKS} görevi ne zaman yaparsan yap maaşın tam yatar`, `Akşam da olur sabah da, önemli olan ayda ${C().EMPLOYEE_FULL_PAY_TASKS} görev. Eksik kalırsa maaş da eksik yatar`]), kisisel: true }, rng, 1500)); st.sonNpc = f.npcId; return sonuc; }
      if (f && /\b(motor|arac|araba|kamyon|ekipman|kiyafet|yemek)\w*/.test(katli)) { cevaplar.push(bilgiPaketi(world, meta, f.npcId, { metin: rng.pick(['Ona gerek yok, görevler oyundan geliyor, sen sadece yaparsın', 'Yok öyle bir masraf, sadece görevleri yapman yeterli']), kisisel: true }, rng, 1500)); st.sonNpc = f.npcId; return sonuc; }
      if (takip === 'teyit' && f && varlik.tutar && Math.abs(varlik.tutar - f.maas) > 999) { cevaplar.push(bilgiPaketi(world, meta, f.npcId, { metin: `${paraYaz(varlik.tutar)} değil, ${paraYaz(f.maas)}. ${varlik.tutar < f.maas ? 'Daha iyi yani 🙂' : 'O kadar veremem açıkçası'}`, kisisel: true }, rng, 1200)); st.sonNpc = f.npcId; return sonuc; }
      if ((takip === 'teyit' || takip === 'teklif') && f) { if (takip === 'teklif' && varlik.tutar) { const ust = Math.round(f.maas * lerp(1.03, 1.1, meta.npc[f.npcId].k.comert) / 500) * 500; if (varlik.tutar <= ust) { f.maas = Math.max(f.maas, varlik.tutar); st.firsat = f; cevaplar.push(bilgiPaketi(world, meta, f.npcId, { metin: `${paraYaz(f.maas)} olur, anlaştık. Tamam dersen teklifi özelden atarım` }, rng, 1500)); } else cevaplar.push(bilgiPaketi(world, meta, f.npcId, { metin: `${paraYaz(varlik.tutar)} fazla, en fazla ${paraYaz(ust)} verebilirim` }, rng, 1500)); return sonuc; } cevaplar.push(bilgiPaketi(world, meta, f.npcId, { metin: `Evet hâlâ geçerli, ${meslekAdi(f.meslek)} için ${paraYaz(f.maas)}. İstersen özelden teklif atayım` }, rng, 1200)); return sonuc; }
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
        if (st.yerUyumsuz && !takip) { cevaplar.push(bilgiPaketi(world, meta, ilk.npcId, { metin: `${st.yerUyumsuz} tarafında bilmiyorum ama ${ilk.yer} tarafında benim ${isletmeAdi(ilk.isletme)} için ${meslekAdi(ilk.meslek)} arıyorum, ${paraYaz(ilk.maas)}` }, rng, 2500)); st.cevaplayan.push(ilk.npcId); st.sonNpc = ilk.npcId; st.yerUyumsuz = null; }
        else ekle(ilk.npcId, takip === 'tekrar' ? 'cevap.takip_tekrar' : 'cevap.is_teklif_ediyorum', patronSlot(ilk), takip === 'tekrar' ? 1500 : 2500);
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
      const adayId = (st.adaylar || []).includes(st.sonNpc) ? st.sonNpc : (st.adaylar || []).slice(-1)[0];
      if (!adayId && takip && takip !== 'tekrar' && takip !== 'ret' && st.sonNpc && meta.npc[st.sonNpc] && world.players[st.sonNpc]) {
        const mk = meslek || 'garson', piy = Math.round(beklenenGelir(world, { k: { caliskan: .7 } }, mk) / 500) * 500, p0 = world.players[st.sonNpc];
        const mt = takip === 'miktar' || takip === 'teklif' ? (varlik.tutar ? `${paraYaz(varlik.tutar)} ${varlik.tutar < piy * .95 ? 'az kalır, ' + meslekAdi(mk).toLocaleLowerCase('tr') + ' piyasası ' + paraYaz(piy) + ' civarı' : 'iyi, o paraya gelen olur'}` : `Ben ${p0.profession ? meslekAdi(p0.profession).toLocaleLowerCase('tr') + ' olarak çalışıyorum' : 'iş aramıyorum'} ama ${meslekAdi(mk).toLocaleLowerCase('tr')} için ${paraYaz(piy)} civarı ver derim`) : takip === 'onay' ? 'Tamam, duyarsam yönlendiririm' : `İlanı açınca kanala bir de sen yaz, iş arayanlar görür`;
        cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: mt }, rng, 2200)); return sonuc;
      }
      if ((takip === 'miktar' || takip === 'detay' || takip === 'yer' || takip === 'ne_zaman' || takip === 'teklif' || takip === 'teyit') && adayId && meta.npc[adayId] && world.players[adayId]) {
        st.sonNpc = adayId; const p = world.players[st.sonNpc], beklenti = Math.round(Math.max(suAnkiGelir(world, meta.npc[st.sonNpc], p) * 1.05, T.indexed(world, C().MIN_WAGE)) / 500) * 500;
        const anahtar = takip === 'miktar' || takip === 'teklif' ? 'cevap.teklif' : 'cevap.aday_benim';
        ekle(st.sonNpc, anahtar, { meslek: meslekAdi(meslek || p.profession), tutar: paraYaz(varlik.tutar && takip === 'miktar' ? Math.max(varlik.tutar, beklenti) : beklenti), sayi: String(p.experience[meslek || p.profession] || p.totalExperienceDays) }, 1500); return sonuc; }
      if ((takip === 'onay' || takip === 'ret') && adayId && meta.npc[adayId] && world.players[adayId]) { st.sonNpc = adayId; if (takip === 'onay') { cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: rng.pick(['Tamamdır, ilanına başvurdum, onaylarsan başlarım', 'Süper, başvurumu yaptım. Yarın oradayım', 'Anlaştık, başvurdum, Başvurular kısmında görürsün']) }, rng, 1500)); sonuc.adaylar = [{ npcId: st.sonNpc, meslek }]; } else ekle(st.sonNpc, 'cevap.takip_ret', {}, 1500); return sonuc; }
      const adaylar = isArayanlar(world, meta, oyuncu, meslek, varlik.tutar).filter(id => !st.cevaplayan.includes(id));
      const sec = adaylar.sort((a, b) => meta.npc[b].k.sosyal - meta.npc[a].k.sosyal).slice(0, rng.chance(.5) ? 2 : 1);
      st.adaylar = (st.adaylar || []).concat(sec);
      sec.forEach((id, i) => { const p = world.players[id]; ekle(id, 'cevap.aday_benim', { meslek: meslekAdi(meslek || p.profession), sayi: String(p.experience[meslek || p.profession] || p.totalExperienceDays) }, 2500 + i * 3000); });
      sonuc.adaylar = sec.map(id => ({ npcId: id, meslek }));
      if (!sec.length) { const id = konusanSec(world, meta, rng, saat); if (id) { const mk = meslek || 'garson', piy = Math.round(beklenenGelir(world, { k: { caliskan: .7 } }, mk) / 500) * 500; if (rng.chance(.7)) cevaplar.push(bilgiPaketi(world, meta, id, { metin: rng.pick([`Şu an boşta ${meslekAdi(mk).toLocaleLowerCase('tr')} göremedim. İlan aç, ${paraYaz(piy)} civarı verirsen başvuru gelir`, `${meslekAdi(mk)} için piyasa ${paraYaz(piy)} civarı, bunun altında verirsen kimse gelmez. İlanı aç, bekle`, `Herkes çalışıyor gibi şu an. ${paraYaz(piy)} civarı maaşla ilan açarsan işinden ayrılıp gelen olur`]) }, rng, 2500)); else ekle(id, 'cevap.eleman_ariyorum', {}, 2500); st.sonNpc = id; } }
      return sonuc;
    }

    // ================= MÜLK =================
    if ((konu === 'mulk_ariyorum' || konu === 'mulk_satiyorum') && kanal !== 'sirket') {
      if (konu === 'mulk_ariyorum') meta.mulkArayan = { mulk: varlik.mulk, bitis: world.day + 4 };
      if ((takip === 'teklif' || takip === 'teyit' || takip === 'miktar') && st.satis && meta.npc[st.satis.npcId]) {
        const sa = st.satis, ks = meta.npc[sa.npcId]; sa.ilk = sa.ilk || sa.fiyat; sa.tur = (sa.tur || 0) + (takip === 'teklif' ? 1 : 0);
        const alt = Math.round(sa.ilk * (1 - lerp(.02, .08, ks.k.sabir) - sansGucu(world, meta) * .03) / 1000) * 1000;
        let m;
        if (/kira/.test(katli)) m = `Kiraya vermiyorum, satıyorum. ${paraYaz(sa.fiyat)} son fiyat`;
        else if (takip === 'teyit') m = `Evet hâlâ satılık, ${paraYaz(sa.fiyat)}`;
        else if (takip === 'miktar' || !varlik.tutar && takip !== 'teklif') m = `Son fiyat ${paraYaz(sa.fiyat)}, biraz pazarlık payı var`;
        else if (sa.tur > 3) m = `Daha fazla inemem, ${paraYaz(sa.fiyat)} son sözüm`;
        else if (varlik.tutar && varlik.tutar >= alt) { sa.fiyat = Math.max(alt, Math.round(varlik.tutar / 1000) * 1000); m = `Tamam ${paraYaz(sa.fiyat)} olur, anlaştık. Tamam dersen özelden teklifi atarım`; }
        else { const yeni = Math.round(lerp(sa.fiyat, alt, .5) / 1000) * 1000; m = varlik.tutar ? `${paraYaz(varlik.tutar)} olmaz, ${paraYaz(yeni)} yapayım` : `${paraYaz(yeni)} yapayım, daha aşağısı zor`; sa.fiyat = yeni; }
        cevaplar.push(bilgiPaketi(world, meta, sa.npcId, { metin: m }, rng, 1500)); st.sonNpc = sa.npcId; return sonuc;
      }
      if (konu === 'mulk_ariyorum' && !st.satis && (takip === 'teklif' || takip === 'teyit' || takip === 'miktar' || takip === 'tekrar') && st.sonNpc && meta.npc[st.sonNpc]) {
        const mk = varlik.mulk || 'daire', f = T.propertyMarketPrice(world, mk);
        const m = takip === 'teklif' ? `Piyasa fiyatı sabit, ${mulkAdi(mk)} ${paraYaz(f)}. Pazarlık ancak satan bir oyuncuyla oluyor, kanala satılık ilanı düşerse ona yaz` : `Satan oyuncu göremedim ama Mülklerim'den piyasadan direkt alabilirsin: ${mulkAdi(mk)} ${paraYaz(f)}, krediyle peşinat ${paraYaz(f * (1 - C().MORTGAGE_MAX_LTV))}`;
        cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: m }, rng, 1500)); return sonuc;
      }
      if (takip === 'onay' && !st.satis && st.sonNpc && meta.npc[st.sonNpc]) { cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: 'Tamam, elimde yok ama satan biri çıkarsa sana yazarım. Kanalda da sık satılık ilan oluyor' }, rng, 1500)); meta.mulkArayan = { mulk: varlik.mulk, bitis: world.day + 4 }; return sonuc; }
      if (takip === 'onay' && st.satis && meta.npc[st.satis.npcId]) {
        const cikti = []; teklifYap(world, meta, cikti, { tur: 'mulk_sat', npcId: st.satis.npcId, mulkId: st.satis.mulkId, mulk: st.satis.mulk, fiyat: st.satis.fiyat, sure: 5 });
        ekle(st.satis.npcId, 'cevap.takip_onay', {}, 1500); sonuc.dm = cikti; return sonuc;
      }
      // Oyuncu satıyor: parası yeten bir NPC alıcı çıkar, pazarlık eder; "tamam" → gerçek alım teklifi (özelden)
      if (konu === 'mulk_satiyorum') {
        const benim = oyuncu.propertyIds.map(x => world.properties[x]).filter(m => m && !m.ownerLivesIn && (!varlik.mulk || m.kind === varlik.mulk));
        if (!benim.length && !takip) { const id = konusanSec(world, meta, rng, saat); if (id) { const mk = varlik.mulk || 'daire'; cevaplar.push(bilgiPaketi(world, meta, id, { metin: `${mulkAdi(mk)} piyasada ${paraYaz(T.propertyMarketPrice(world, mk))} civarı. İlan verince alıcı çıkar, acelen varsa piyasaya da satabilirsin` }, rng, 2000)); st.sonNpc = id; st.cevaplayan.push(id); } return sonuc; }
        if (/kira\w* (ver|veri|vere|vermek)|kiraya/.test(katli) && st.sonNpc && meta.npc[st.sonNpc]) {
          const mk = varlik.mulk || (oyuncu.propertyIds.map(x => world.properties[x]).filter(Boolean)[0] || {}).kind || 'daire', f = T.propertyMarketPrice(world, mk), oran = (C().PROPERTY_TYPES.find(x => x.kind === mk) || {}).monthlyRentRate || 0;
          cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: oran ? `Kiraya verirsen ${mulkAdi(mk).toLocaleLowerCase('tr')} ayda ${paraYaz(f * oran)} civarı getiriyor. Satmaktan iyi bence, değeri de artıyor` : `${mulkAdi(mk)} kiraya verilmiyor, ama değeri artıyor` }, rng, 2200)); return sonuc;
        }
        if (!benim.length && takip && st.sonNpc && meta.npc[st.sonNpc] && (varlik.tutar || /\b(sen|siz)\b/.test(katli))) {
          const mk = varlik.mulk || 'daire', piyasa = T.propertyMarketPrice(world, mk), p2 = world.players[st.sonNpc];
          const mt = varlik.tutar ? `${paraYaz(varlik.tutar)} ${varlik.tutar > piyasa * 1.05 ? 'piyasanın epey üstü, ' + paraYaz(piyasa) + ' civarı dönüyor' : 'makul'}. Ama Mülklerim'de satılık ${mulkAdi(mk).toLocaleLowerCase('tr')} görünmüyor, önce ilana koy` : p2 && p2.cash >= piyasa ? `Param var aslında, ilana koyarsan bakarım. Ama ${paraYaz(piyasa)} civarını geçmem` : `Keşke, o kadar nakdim yok. ${paraYaz(piyasa)} kolay para değil`;
          cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: mt }, rng, 2200)); return sonuc;
        }
        if (!benim.length && takip && st.sonNpc && meta.npc[st.sonNpc] && (takip === 'detay' || takip === 'yer')) { const mk = varlik.mulk || 'daire', f = T.propertyMarketPrice(world, mk); cevaplar.push(bilgiPaketi(world, meta, st.sonNpc, { metin: varlik.yer ? `${varlik.yer} iyi yer, çabuk gider. Mülklerim'den ilana koy, ${paraYaz(f)} civarının altına verme` : `Mülklerim'den ilana koy, ${paraYaz(f)} civarının altına verme` }, rng, 2200)); return sonuc; }
        if (benim.length) {
          const m = benim[0], piyasa = T.propertyMarketPrice(world, m.kind);
          if (!st.alim || !meta.npc[st.alim.npcId]) { const al = agirlikliSec(rng, Object.keys(meta.npc).filter(id => world.players[id] && world.players[id].cash >= piyasa * .98 && !world.players[id].mustWork), id => .2 + meta.npc[id].k.risk); if (al) st.alim = { npcId: al, mulkId: m.id, mulk: m.kind, fiyat: Math.round(piyasa * lerp(.95, 1.01, meta.npc[al].k.risk) / 1000) * 1000, ust: Math.round(piyasa * (1.03 + sansGucu(world, meta) * .05) / 1000) * 1000, tur: 0 }; }
          const a = st.alim;
          if (!a) { const id = (takip && st.sonNpc) || konusanSec(world, meta, rng, saat); if (id && (!takip || takip === 'teklif' || takip === 'tekrar' || takip === 'onay')) cevaplar.push(bilgiPaketi(world, meta, id, { metin: takip ? `Kimsede o kadar nakit yok şu an. Beklersen biri çıkar, acelen varsa piyasaya ${paraYaz(piyasa * (1 - C().NPC_SELL_SPREAD))}'ye satarsın` : `Şu an o kadar nakdi olan yok gibi. Piyasaya satarsan ${paraYaz(piyasa * (1 - C().NPC_SELL_SPREAD))} alırsın hemen` }, rng, 2500)); if (id) st.sonNpc = id; return sonuc; }
          if (takip === 'onay') { const cikti = []; teklifYap(world, meta, cikti, { tur: 'mulk_al', npcId: a.npcId, mulkId: a.mulkId, mulk: a.mulk, fiyat: a.fiyat, sure: 4 }); cevaplar.push(bilgiPaketi(world, meta, a.npcId, { metin: `Tamam, ${paraYaz(a.fiyat)}'ye alıyorum. Özelden teklifi attım, kabul et yeter` }, rng, 1500)); sonuc.dm = cikti; return sonuc; }
          let mt;
          if (varlik.tutar && (takip === 'teklif' || takip === 'detay' || ny.niyet === 'teklif' || ny.niyet === 'fiyat_sorusu')) { a.tur++; if (varlik.tutar <= a.ust) { a.fiyat = Math.round(varlik.tutar / 1000) * 1000; mt = `${paraYaz(a.fiyat)} olur, anlaştık. Tamam dersen özelden teklif atarım`; } else if (a.tur > 3) mt = `Benim son sözüm ${paraYaz(a.fiyat)}, daha fazla veremem`; else { a.fiyat = Math.round(lerp(a.fiyat, a.ust, .5) / 1000) * 1000; mt = `${paraYaz(varlik.tutar)} çok, ${paraYaz(a.fiyat)} verebilirim`; } }
          else mt = `Ben alırım, ${mulkAdi(a.mulk)} için ${paraYaz(a.fiyat)} veririm. Ne dersin?`;
          cevaplar.push(bilgiPaketi(world, meta, a.npcId, { metin: mt }, rng, 2000)); st.sonNpc = a.npcId; if (!st.cevaplayan.includes(a.npcId)) st.cevaplayan.push(a.npcId); return sonuc;
        }
      }
      // Satan bir NPC var mı? (elinde kiradaki ya da boş mülkü olan, riskçi olan satar)
      if (konu === 'mulk_ariyorum' && (!takip || takip === 'tekrar' || takip === 'detay')) {
        const mulk = varlik.mulk || 'daire';
        const satici = Object.keys(meta.npc).filter(id => !st.cevaplayan.includes(id) && world.players[id] && world.players[id].propertyIds.some(x => world.properties[x] && world.properties[x].kind === mulk && !world.properties[x].ownerLivesIn) && (meta.npc[id].k.risk > .25 || meta.npc[id].hedef === 'yatirimci'));
        const sid = satici.length ? satici[Math.floor(rng.next() * satici.length)] : null;
        if (sid) { const b = bilgi(world, meta, meta.npc[sid], 'mulk_ariyorum', Object.assign({}, varlik, { mulk }), oyuncu, katli, takip); if (b && b.satis) { st.satis = Object.assign({ npcId: sid, ilk: b.satis.fiyat }, b.satis); cevaplar.push(bilgiPaketi(world, meta, sid, b, rng, 2500)); st.cevaplayan.push(sid); st.sonNpc = sid; } }
      }
    }
    // ================= BİLGİ: gerçek veriye dayalı cevap =================
    if (!hedefKisi || true) {
      const kimId = (takip && st.sonNpc && meta.npc[st.sonNpc]) ? st.sonNpc : (hedefKisi || null);
      // Zamir ('onun', 'o', 'orası') ya da varlıksız takip: en son konuşulan kurs/meslek/işletme sorunun içine katılır
      let katli2 = katli;
      if (st.odak && (takip || /\b(o|onun|ona|orasi|orda|bunun|o is|bu is)\b/.test(katli) || /(kur farki|lisans|belge)/.test(katli))) { if (st.odak.kurs && /(kurs|kac para|ne kadar|sure|kac gun|gun surer|lisans|belge|nerden|nereden|nasil)/.test(katli)) katli2 = katli + ' ' + ({ kamu_sinavi: 'kamu sinavi kursu', muhasebe: 'muhasebe kursu', emlak_belgesi: 'emlak belgesi', ustalik: 'ustalik kursu', muteahhitlik: 'muteahhitlik kursu', doviz_lisansi: 'doviz lisansi kursu', dis_ticaret: 'dis ticaret kursu' }[st.odak.kurs] || ''); else if (st.odak.isletme && /(kazan|kar\b|gelir|para|kur farki)/.test(katli)) katli2 = katli + ' ' + ({ dukkan: 'dukkan', kafe: 'kafe', tasaron: 'taseron', emlak_ofisi: 'emlak ofis', doviz_burosu: 'doviz burosu', ithalat_ihracat: 'ithalat', muteahhit: 'muteahhit', fabrika: 'fabrika' }[st.odak.isletme] || ''); else if (st.odak.meslek && /(kurs|belge|ne lazim|sart)/.test(katli)) { const pr = T.getProfession(st.odak.meslek); if (pr.requirements.course) katli2 = katli + ' kurs ' + ({ kamu_sinavi: 'kamu sinavi', muhasebe: 'muhasebe', emlak_belgesi: 'emlak', ustalik: 'ustalik', muteahhitlik: 'muteahhit', doviz_lisansi: 'doviz', dis_ticaret: 'dis ticaret' }[pr.requirements.course] || ''); } }
      const onceMetin = st.onceki || st.ilk;
      if (takip && onceMetin && onceMetin !== katli && katli2 === katli && katli.split(' ').length <= 4 && (konu === 'dert' ? /(neden|niye|nasil|ne yap|napca|ne yapcam|cozum|ne olacak)/ : /\b(nasil|neden|niye|nerden|nereden|kullanil\w*|yukselt\w*|duzelt\w*|artir\w*|getirir\w*|kazandirir\w*)\b/).test(katli)) katli2 = onceMetin + ' ' + katli2;
      if (st.odak && st.odak.secim && kimId && /\b(hangisi\w*|sen olsan|sence hangi|hangisine|hangisini)\b/.test(katli)) { const a1 = st.odak.secim, rq = T.getProfession(a1).requirements; cevaplar.push(bilgiPaketi(world, meta, kimId, { metin: `Ben olsam ${meslekAdi(a1).toLocaleLowerCase('tr')} derim, para daha iyi. ${rq.course ? kursSoz(rq.course) + ' alman lazım' : ''}${rq.professionExperience ? `, bir de ${rq.professionExperience.days} gün ${meslekAdi(rq.professionExperience.profession).toLocaleLowerCase('tr')} deneyimi` : ''}`.replace(/\. $/, ''), kisisel: true }, rng, 1800)); return sonuc; }
      const dene = id => bilgi(world, meta, meta.npc[id], konu, varlik, oyuncu, katli2, takip);
      let id = kimId, b = id ? dene(id) : null;
      if (!b && !kimId) { const aday = agirlikliSec(rng, npcIdler.filter(x => world.players[x] && !st.cevaplayan.includes(x)), x => niyetUygunluk(world, meta, x, Object.assign({}, ny, { niyet: konu }), oyuncu) * (DUZEN[meta.npc[x].kronotip][saat] + .15)); if (aday) { const b2 = dene(aday); if (b2) { id = aday; b = b2; } } }
      if (b && !b.satis) {
        b.soru = katli;
        if (b.odak) st.odak = b.odak;
        cevaplar.push(bilgiPaketi(world, meta, id, b, rng, 2000)); if (!st.cevaplayan.includes(id)) st.cevaplayan.push(id); st.sonNpc = id; iliski(meta, id).mesaj++; iliski(meta, id).tanir = true;
        // Konuşkan biri bazen kendi deneyimini ekler (kalıp değil: konuya göre)
        if (!takip && rng.chance(.35) && ['ekonomi', 'mulk_ariyorum', 'kredi_sorusu', 'dert', 'kurs_sorusu', 'meslek_tavsiyesi'].includes(konu)) { const id2 = agirlikliSec(rng, npcIdler.filter(x => x !== id && world.players[x]), x => meta.npc[x].k.sosyal * (DUZEN[meta.npc[x].kronotip][saat] + .1)); if (id2) { const k2 = meta.npc[id2], p2 = world.players[id2]; const tepki = konu === 'kredi_sorusu' || konu === 'ekonomi' ? (p2.loans.length ? ['aynen, ben de geçen ay çektim, taksit can yakıyor', 'bence yüksek, ben pişman oldum biraz'] : ['ben hiç çekmedim, peşin almayı seviyorum', 'faiz bana yüksek geliyor açıkçası']) : konu === 'mulk_ariyorum' ? (p2.propertyIds.length ? ['ben de geçen yıl aldım, iyi ki almışım', 'kira getirisi az ama değer kazanıyor'] : ['bu fiyatlarla bize ev zor', 'ben de bakıyorum, çok pahalı']) : konu === 'kurs_sorusu' ? ['ben aldım, değdi bence', 'ben de düşünüyorum onu'] : konu === 'meslek_tavsiyesi' ? (p2.profession ? [`ben ${meslekAdi(p2.profession).toLocaleLowerCase('tr')} olarak başladım, fena değil`, `ben ${meslekAdi(p2.profession).toLocaleLowerCase('tr')} oldum, ilk ay zor geçti ama alışıyorsun`] : ['ben de yeni sayılırım, kuryeyle başlamayı düşünüyorum', 'deneyim gün gün birikiyor, sabır lazım']) : ['ben de geçen ay öyleydim, geçiyor', 'herkesin başına geliyor, takma', 'ben de aynısını yaşadım, sonra toparladım']; let m2 = rng.pick(tepki); try { m2 = (dil().stillendir)(m2, stilOf(k2), rng); } catch (e) { } if (!tekrarMi(meta, k2, m2)) { soyledi(meta, k2, m2); cevaplar.push({ npcId: id2, ad: k2.gorunen, metin: m2, gecikmeMs: 6000 + rng.next() * 3000 }); } } }
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
    // Gündelik konular: hava, maç, yemek, trafik, uyku, okul, şaka istekleri
    const GUNDELIK = [
      [/\b(hava|yagmur|kar yag|sicak|soguk|gunes)/, ['valla güzel, işe gitmek istemiyor insan', 'burası yağmurlu', 'sıcaktan bunaldık', 'hava güzelse dışarı çık bence', 'bizde kapalı hava']],
      [/\b(mac|gol|futbol|derbi|takim)/, ['hangi maç?', 'ben izlemiyorum, iş var', 'dün akşam izledim, berbattı', 'skor kaç oldu?', 'maç saatinde kanal boşalıyor zaten']],
      [/\b(yemek|acik(tim|mis)|kahvalti|cay|kahve|pizza|doner|aksam yemegi)/, ['ben de acıktım şimdi', 'çay demledim tam', 'kahvaltıyı kaçırdım yine', 'afiyet olsun']],
      [/\b(trafik|metro|metrobus|otobus|minibus|yol)/, ['metrobüs yine dolu', 'trafik berbat bugün', 'ben motorla gidiyorum, rahat']],
      [/\b(uykum|yorgun|uyu|uyuyamadim|yattim)/, ['ben de çok yorgunum', 'erken yat bence', 'bugün hiç uyuyamadım']],
      [/\b(okul|sinav|ders|odev)/, ['kolay gelsin, sınav ne zaman?', 'okul bitince oyuna gömülüyoruz', 'ders çalış önce ama 😄']],
      [/\b(harclik|bedava|para ver|bana para|zengin et|borc ver)/, ['bana da lazım 😂', 'çalış kardeşim çalış', 'herkes kendi kazanıyor burada', 'ben de bekliyorum 😄']],
    ];
    const gun = GUNDELIK.find(([re]) => re.test(katli));
    if (gun && !hedefKisi && (konu === 'genel' || ny.guven < .5)) {
      const id = konusanSec(world, meta, rng, saat, x => npcIdler.includes(x)); if (id && rng.chance(.8)) { cevaplar.push(bilgiPaketi(world, meta, id, { metin: rng.pick(gun[1]) }, rng, 2500)); st.sonNpc = id; }
      return sonuc;
    }
    // Kanalda olmayan birine hitap: biri "bugün girmedi galiba" der
    const hitap = (metin.match(/@([\p{L}]+)/u) || [])[1];
    if (hitap && !hedefKisi) { const id = konusanSec(world, meta, rng, saat, x => npcIdler.includes(x)); if (id && rng.chance(.6)) cevaplar.push(bilgiPaketi(world, meta, id, { metin: rng.pick([`${hitap} bugün girmedi galiba`, `${hitap} şu an yok sanırım`, `${hitap} az önce çıktı`]) }, rng, 3000)); return sonuc; }
    // Anlaşılamayan mesaj: içi boş onay yok. Soruysa biri merakla sorar ya da susulur.
    const belirsiz = konu === 'genel' || ny.guven < .35;
    const cevapSayisi = hedefKisi ? 0 : belirsiz ? (ny.soru ? (rng.chance(.7) ? 1 : 0) : (rng.chance(.3) ? 1 : 0)) : ({ selam: 2, hal_hatir: 1, mulk_satiyorum: 1, mulk_ariyorum: 2, meslek_tavsiyesi: 2, kurs_sorusu: 1, yardim: 2, ekonomi: 2, bayram: 2, dert: 2, tebrik: 1, saka: 1, bot_musun: 1, kredi_sorusu: 1, fiyat_sorusu: 1, maas_sorusu: 1, tesekkur: 1, veda: 1, kisisel_yer: 2, kisisel_meslek: 2, yetki_istegi: 1 }[konu] ?? (ny.soru ? 1 : rng.chance(.45) ? 1 : 0));
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
      case 'bayram': { const k0 = (dil().normal)(metin).katli; const o = ozelGun(world.day); s.konu = /ramazan|seker/.test(k0) ? 'Ramazan Bayramı' : /kurban/.test(k0) ? 'Kurban Bayramı' : /yilbasi|yeni yil/.test(k0) ? 'yeni yıl' : /cumhuriyet/.test(k0) ? 'Cumhuriyet Bayramı' : /bayram/.test(k0) ? (o && o.bayram ? o.ad : 'bayram') : o ? o.ad : 'bayram'; break; }
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
    // Kapanış: teşekkür / veda / "tamam sağol" -> kısa kapanış, bilgi yinelenmez
    if (['tesekkur', 'veda'].includes(ny.niyet) || /^(tamam|tmm|ok|peki)\W*\s*(sag ?ol|sagol|tesekkur|tsk|eyv)/.test(katli)) { const c = cevapPaketi(world, meta, npcId, ny.niyet === 'veda' ? 'cevap.veda' : 'cevap.tesekkur', { oyuncuAd: oyuncu.name.split(' ')[0] }, rng); meta.diyalog['dm:' + npcId] = null; return { metin: c.metin, gecikmeMs: c.gecikmeMs }; }
    const p0 = world.players[npcId];
    if (ny.varlik && ny.varlik.meslek && /(dusunuyorum|olmak istiyorum|olcam|olacagim|olayim mi|olsam mi|olmayi)/.test(katli)) {
      const m = ny.varlik.meslek, g = paraYaz(beklenenGelir(world, { k: { caliskan: .75 } }, m)), rq = T.getProfession(m).requirements;
      const mt = p0 && p0.profession === m ? rng.pick([`İyi karar bence, ben memnunum. Ayda ${g} civarı oluyor, alışınca artıyor`, `Yap bence, ben de öyle başladım. Ayda ${g} gibi, ama boş durmayacaksın`]) : `${meslekAdi(m)} ayda ${g} civarı kazandırıyor.${rq.course ? ' Önce ' + kursSoz(rq.course) + ' lazım.' : ' Şart yok, hemen başlarsın.'} Bence mantıklı`;
      meta.diyalog['dm:' + npcId] = { konu: 'meslek_tavsiyesi', varlik: { meslek: m }, zaman: simdi, cevaplayan: [npcId], sonNpc: npcId, odak: { meslek: m } };
      return { metin: bilgiPaketi(world, meta, npcId, { metin: mt, kisisel: true }, rng, 1500).metin, gecikmeMs: 3000 };
    }
    if (st && st.konu === 'kisisel_yer' && /\b(ben|bende|ben de)\b/.test(katli) && /(l[iıuü]y[iıuü]m|deyim|dayim|oturuyorum|oraliyim|hemseri)/.test(katli)) {
      const yer = ny.varlik && ny.varlik.yer, ayni = /oraliyim|hemseri/.test(katli) || (yer && kim.yer && (kim.yer.sehir === yer || yerAdi(kim) === yer));
      const mt = ayni ? rng.pick(['Aa hemşehriyiz o zaman 😄', 'Ooo hemşehrim! Ne güzel']) : yer ? rng.pick([`${yer} güzel ya, bir ara gitmek istiyorum`, `Aa ${yer}, oraları severim. Orada iş nasıl?`]) : 'Güzel, hoş geldin';
      meta.diyalog[dk] = { konu: 'genel', varlik: {}, zaman: simdi, cevaplayan: [npcId], sonNpc: npcId };
      return { metin: bilgiPaketi(world, meta, npcId, { metin: mt, kisisel: true }, rng, 1500).metin, gecikmeMs: 2500 };
    }
    const takip = st ? takipTuru(katli, ny, st) : null;
    const gucluYeni = ny.guven >= .6 && !['evet', 'hayir', 'genel', 'teklif', 'maas_sorusu', 'fiyat_sorusu', 'kisisel_yer', 'tesekkur'].includes(ny.niyet) && (!st || ny.niyet !== st.konu);
    let konu = takip && !gucluYeni ? st.konu : ny.niyet;
    // "dairen satılık mı": oyuncu ALICI (NPC'nin mülkü soruluyor)
    if (/\b(dairen|evin|arsan|dukkanin|mulkun|daireni|evini|arsani)\b/.test(katli) && /(satilik|satar misin|satiyor musun|verir misin|kaca)/.test(katli)) { konu = 'mulk_ariyorum'; ny.varlik = Object.assign({}, ny.varlik, { mulk: /arsa/.test(katli) ? 'arsa' : /dukkan/.test(katli) ? 'dukkan' : 'daire' }); }
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
    if (st && st.konu === 'mulk_yok' && (takip || (ny.varlik && ny.varlik.tutar) || /(kac|son fiyat|olur mu|verir)/.test(katli))) { meta.diyalog[dk] = st; return { metin: bilgiPaketi(world, meta, npcId, { metin: rng.pick(['Satacak mülküm yok ki 😄 Kanalda satılık ilanı çıkarsa ona yaz', 'Dedim ya, bende mülk yok. Mülklerim ekranından piyasadan alabilirsin']), kisisel: true }, rng, 1500).metin, gecikmeMs: 2500 }; }
    // Kendisine soru ("ne kadar kazanıyorsun", "kredi çektin mi"): kendi gerçek verisinden
    if (IKINCI_TEKIL.test(katli) || /^(sen|peki sen|ya sen)\b/.test(katli)) { const kc = kendisi(world, meta, kim, katli); if (kc) { const c0 = bilgiPaketi(world, meta, npcId, { metin: kc, kisisel: true }, rng, 1500); return { metin: c0.metin, gecikmeMs: c0.gecikmeMs }; } }
    // NPC'nin kendi mülkü soruluyor
    if (konu === 'mulk_ariyorum' && /\b(dairen|evin|arsan|dukkanin|mulkun|daireni|evini|arsani)\b/.test(katli) && p) {
      const ms = p.propertyIds.map(x => world.properties[x]).filter(Boolean), satilik = ms.filter(m => !m.ownerLivesIn && (!varlik.mulk || m.kind === varlik.mulk));
      if (!satilik.length) { meta.diyalog[dk] = { konu: 'mulk_yok', varlik: {}, zaman: simdi, cevaplayan: [npcId], sonNpc: npcId }; const mt = ms.some(m => m.ownerLivesIn) ? rng.pick(['Oturduğum ev o, satmayı düşünmüyorum', 'Yok, kendim oturuyorum, satılık değil']) : rng.pick(['Benim mülküm yok ki, kiradayım ben de 😄', 'Yok bende mülk, biriktiriyorum daha']); return { metin: bilgiPaketi(world, meta, npcId, { metin: mt, kisisel: true }, rng, 1500).metin, gecikmeMs: 2500 }; }
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
  // Emoji yok: NPC'lerin bütün çıktıları temizlenir
  { const om = NPCYZ.oyuncuMesaji; NPCYZ.oyuncuMesaji = function () { const r = om.apply(this, arguments); if (r && r.cevaplar) r.cevaplar.forEach(c => { c.metin = emojisiz(c.metin); }); return r; };
    const dg = NPCYZ.dmGonder; NPCYZ.dmGonder = function () { const r = dg.apply(this, arguments); if (r && r.metin) r.metin = emojisiz(r.metin); return r; }; }

  G.NPCYZ = NPCYZ;
  if (typeof module !== 'undefined' && module.exports) module.exports = NPCYZ;
})();
