/* Burger Ustası: ekonomi ve denge (BU.VERI)
 *
 * DOM yok; tarayıcıda window.BU.VERI, Node'da module.exports.
 * Bütün paralar TAM SAYI.
 *
 * 2. tur (20 Kasım): malzemeler güne göre değil PARAYLA açılır.
 *   - Başta yalnız ekmek ve köfte. Diğerleri dükkânda SATIN_SIRA sırasıyla
 *     birer kez alınır (fiyatAc). Sahip olunanlar "sahip" (anahtar dizisi ya da
 *     {anahtar:true} nesnesi) olarak fonksiyonlara verilir.
 *   - Yeni oyuncu BASLANGIC (50) parayla başlar. Her gün sonunda kira(gun) düşer.
 *     Kasa eksiye düşebilir; eksi kasayla satın alma yok; KAPANIS_GUN (3) gün art
 *     arda eksi kalırsa dükkân kapanır, kasa SIFIRLA (50) olur (alınanlar kalır).
 *     Bunun hepsi gunSonu() içinde.
 *
 * Maliyet (malzeme tabağa konunca, köfte ızgaraya konunca kasadan düşer):
 *   köfte 6, peynir 3, ekmek 2 (alt ekmekte bir kez; üst ekmek bedava) …
 *   en pahalısı Altın Wagyu (premium) 10. Liste MALZEME'de.
 * Menü fiyatı: alt ekmek + ortadaki her katmanın "satis" değeri toplanır, en
 *   yakın 5'e yuvarlanır (en az 15). satis SATIN_SIRA boyunca hiç azalmaz:
 *   sonradan alınan malzeme ortalama siparişi pahalılaştırır (yatırım hissi).
 *   Örnek: ekmek+köfte → 20, +peynir → 25.
 * Bahşiş (yalnız doğru + mutlu teslimde): fiyatın %8'i (sabır 2/3'teyken) ile
 *   %30'u (sabır tam doluyken) arası, "Cömert bahşiş" her düzeyde +%25,
 *   art arda 3. mutlu teslimden sonra seri payı (+1 … +5). En az 1.
 * Ruh hâli (f = kalan sabır oranı, 0…1):
 *   f > 2/3 mutlu ('happy'), 2/3 ≥ f > 1/3 somurtkan ('wait', f ≤ 0,5'te 'imp'),
 *   f ≤ 1/3 kızgın ('angry'), f = 0 kaçar (oyun tarafı; bir can).
 * Zorluk güne göre artar, AYAR.zorTavan (18.) gününde durur (300. gün de 18. gün kadar zor).
 * Denge değerleri AYAR içinde; botu (scripts/denge.mjs) çalıştırıp ayarlandı,
 *   sonuçlar docs/DENGE.md.
 *
 * 5. tur (mutfak, 21 Kasım):
 *   - MALZEME'de tur: 'katman' (burgerin içine girer) ya da 'yan' (yan ürün:
 *     fries, onionring; fritözde pişer, burgerin İÇİNE KONMAZ). siparis() hiçbir
 *     zaman yan ürün döndürmez.
 *   - sauce = ketçap; yeni mayo (mayonez) katmanı. Dükkân sırası MALZEME sırası.
 *   - Izgara 6 göz: başta 2, slot geliştirmesi 4 düzey (izgaraGoz(up)).
 *   - Müşteri burgerin yanında en çok bir yan ürün ister (siparisTam). Ödeme
 *     sipariş TAMAMLANINCA (burger + istenen yan ürün): teslimParca() parça parça,
 *     odemeTam() hepsi birden. İlk doğru parça verilince sabır %15 dolar
 *     (AYAR.parcaYenile; tek sefer, oyun tarafı c.p += sabirEk × c.max).
 *     Yanlış parça (yanlış burger, yanlış yan ürün, yan ürün istemeyene yan ürün,
 *     aynı parçayı ikinci kez) = yanlış: ödemez, o müşteriye verilen her şeyin
 *     maliyeti kayıp, bir can.
 */
(function (root) {
  'use strict';
  var BU = root.BU = root.BU || {};

  // k: anahtar, tur: 'katman' (burgerin içine) | 'yan' (yan ürün, fritözde),
  // maliyet: porsiyon maliyeti, satis: menü fiyatına katkısı,
  // fiyatAc: dükkânda satın alma fiyatı (0 = başta açık),
  // gun: ESKİ (1. tur) açılış günü; yalnız acik(sayı) ve eski kayıt dönüşümü için
  //   (2. turda gelen malzemelerde 99 = eski düzende hiç yoktu).
  // Dizinin sırası dükkân sırasıdır (SATIN_SIRA).
  var MALZEME = [
    { k: 'bun',       tur: 'katman', maliyet: 2,  satis: 5,  fiyatAc: 0,      gun: 1 },
    { k: 'patty',     tur: 'katman', maliyet: 6,  satis: 14, fiyatAc: 0,      gun: 1 },
    { k: 'cheese',    tur: 'katman', maliyet: 3,  satis: 6,  fiyatAc: 30,     gun: 1 },
    { k: 'lettuce',   tur: 'katman', maliyet: 1,  satis: 6,  fiyatAc: 80,     gun: 2 },
    { k: 'tomato',    tur: 'katman', maliyet: 2,  satis: 6,  fiyatAc: 160,    gun: 3 },
    { k: 'onion',     tur: 'katman', maliyet: 1,  satis: 7,  fiyatAc: 500,    gun: 5 },
    { k: 'pickle',    tur: 'katman', maliyet: 1,  satis: 7,  fiyatAc: 1200,   gun: 11 },
    { k: 'bacon',     tur: 'katman', maliyet: 4,  satis: 9,  fiyatAc: 2500,   gun: 7 },
    { k: 'egg',       tur: 'katman', maliyet: 2,  satis: 10, fiyatAc: 5000,   gun: 9 },
    { k: 'sauce',     tur: 'katman', maliyet: 1,  satis: 10, fiyatAc: 9000,   gun: 99 },   // ketçap
    { k: 'mayo',      tur: 'katman', maliyet: 1,  satis: 11, fiyatAc: 15000,  gun: 99 },   // mayonez
    { k: 'mushroom',  tur: 'katman', maliyet: 3,  satis: 13, fiyatAc: 25000,  gun: 99 },
    { k: 'jalapeno',  tur: 'katman', maliyet: 3,  satis: 15, fiyatAc: 45000,  gun: 99 },
    { k: 'fries',     tur: 'yan',    maliyet: 2,  satis: 15, fiyatAc: 80000,  gun: 99 },   // patates kızartması
    { k: 'avocado',   tur: 'katman', maliyet: 6,  satis: 22, fiyatAc: 150000, gun: 99 },
    { k: 'onionring', tur: 'yan',    maliyet: 3,  satis: 24, fiyatAc: 250000, gun: 99 },   // soğan halkası (yalnız yan ürün)
    { k: 'premium',   tur: 'katman', maliyet: 10, satis: 32, fiyatAc: 550000, gun: 99 }    // Altın Wagyu
  ];
  var MAL = {};
  MALZEME.forEach(function (m) { MAL[m.k] = m; });
  // yan ürünler (fritöz): burgerin içine girmez
  var YAN = MALZEME.filter(function (m) { return m.tur === 'yan'; }).map(function (m) { return m.k; });
  function yanMi(k) { var m = MAL[k]; return !!m && m.tur === 'yan'; }
  // dükkânda gösterim ve satın alma sırası (ekmek, köfte başta açık)
  var SATIN_SIRA = MALZEME.filter(function (m) { return m.fiyatAc > 0; }).map(function (m) { return m.k; });
  var TEMEL = ['bun', 'patty'];
  var YENI_GUN = 99;

  // denge ayarları (bot ile ayarlandı)
  var AYAR = {
    fiyatYuv: 5, fiyatMin: 15,
    bahsisMin: 0.08, bahsisMax: 0.30, bahsisUp: 0.25, seriMax: 5,
    musteri0: 5, musteriMax: 20,
    aralikTaban: 10.5, aralikKatman: 1.6, aralikAdim: 0.38, // gelme aralığının ortası (sn) = taban + katman × beklenen ortadaki katman − adım × (gün − 1)
    aralikMin: 6,                                         // gelme aralığının ortası en az (sn)
    sabir0: 16, sabirAdim: 0.35, sabirMin: 10,            // siparişten bağımsız taban sabır (sn)
    sabirKatman: 3.7,                                     // ekmek dışındaki her katman için ek sabır (sn)
    sabirUp: 0.10,                                        // "Sabırlı müşteri" her düzeyde +%10
    pisme0: 4.0, pismeUp: 0.5,                            // köfte pişme süresi (sn)
    ciftKofte: 6, ciftKofteOlas: 0.25,                    // bu günden sonra çift köfte olasılığı
    tekrarGun: 10, tekrarOlas: 0.2,                       // bu günden sonra başka bir malzeme de iki kez
    zorTavan: 18,                                         // bu günden sonra zorluk artmaz
    kira0: 10, kiraKat: 10, kiraMax: 120,                 // kira = kira0 + kiraKat × ⌊√(gün − 1)⌋, 5'e yuvarlı, en çok kiraMax
    // yan ürün (5. tur)
    yan0: 0.25, yanGun: 0.01, yanMax: 0.35, yanIki: 0.10, // yan ürün isteme olasılığı: min(yanMax, yan0 + yanGun × (zg − 1)) (+ yanIki ikisi de varsa)
    sabirYan: 5,                                          // yan ürün isteyen müşteriye ek sabır (sn)
    aralikYan: 2.0,                                       // gelme aralığına yan ürün payı (sn × olasılık)
    parcaYenile: 0.15,                                    // ilk doğru parça verilince sabır bu oranda dolar (bir kez)
    yanPisme: { fries: 5, onionring: 6 }, yanPismeMin: 2.5 // fritöz süresi (sn), "Hızlı ızgara" her düzeyde −pismeUp
  };

  var STOK_MAX = 6;
  var YAN_STOK_MAX = 3;  // her yan ürünün hazır kutusunda en çok
  var IZGARA_MAX = 6;    // ızgara gözü sayısı (başta 2, slot ile +1'er)
  var KAT_MAX = 10;   // bir tabakta en çok katman
  var BASLANGIC = 50; // yeni oyuncunun parası
  var KAPANIS_GUN = 3; // art arda bu kadar gün eksi kasa → dükkân kapanır
  var SIFIRLA = 50;   // kapanınca kasa buna döner

  // geliştirme fiyatları düzey düzey (l = şu anki düzey, 0'dan başlar)
  function basamak(a) { return function (l) { l = l | 0; return a[Math.min(l, a.length - 1)]; }; }
  var GELISTIR = {
    cook: { max: 4, cost: basamak([300, 600, 1200, 2400]) },   // köfte 0,5 sn daha çabuk pişer
    pat:  { max: 4, cost: basamak([350, 700, 1400, 2800]) },   // müşteri sabrı +%10
    tip:  { max: 4, cost: basamak([400, 800, 1600, 3200]) },   // bahşiş +%25
    slot: { max: 4, cost: basamak([800, 2500, 7000, 18000]) }  // 3., 4., 5., 6. ızgara gözü
  };
  // açık ızgara gözü: 2 + slot düzeyi (en çok 6). Eski kayıtta slot 0/1 → 2/3 göz (aynı).
  function izgaraGoz(up) { return Math.min(IZGARA_MAX, 2 + U(up).slot); }

  function U(up) {
    up = up || {};
    return { cook: up.cook | 0, pat: up.pat | 0, tip: up.tip | 0, slot: up.slot | 0 };
  }
  function tam(x) { return Math.round(x); }
  // katman adı → malzeme anahtarı
  function anahtar(k) { return k === 'bunBot' || k === 'bunTop' ? 'bun' : k; }
  // zorluk günü: tavanda durur
  function zg(d) { return Math.min(Math.max(1, d | 0), AYAR.zorTavan); }

  // sahip: sayı (ESKİ: o güne kadar açılanlar), anahtar dizisi ya da {anahtar:true/sayı} nesnesi.
  // Dönen dizi MALZEME sırasında; ekmek ve köfte her zaman var.
  function acik(sahip) {
    if (typeof sahip === 'number' || typeof sahip === 'string' && sahip !== '' && !isNaN(+sahip)) {
      var g = +sahip | 0;   // ESKİ davranış: 1. turun günleri
      return MALZEME.filter(function (m) { return m.fiyatAc === 0 || m.gun <= g && m.gun < YENI_GUN; })
        .map(function (m) { return m.k; });
    }
    var var_ = {};
    if (Array.isArray(sahip)) sahip.forEach(function (k) { var_[k] = 1; });
    else if (sahip && typeof sahip === 'object') Object.keys(sahip).forEach(function (k) { if (sahip[k]) var_[k] = 1; });
    return MALZEME.filter(function (m) { return m.fiyatAc === 0 || var_[m.k]; }).map(function (m) { return m.k; });
  }

  // eski kayıt dönüşümü: 1. turda o güne kadar açılmış malzemeler (satın alınmış sayılır)
  function eskiSahip(gun) {
    return acik(Math.max(1, gun | 0)).filter(function (k) { return TEMEL.indexOf(k) < 0; });
  }
  // dükkânda sıradaki alınabilir malzeme (yoksa null)
  function siradaki(sahip) {
    var a = acik(sahip);
    for (var i = 0; i < SATIN_SIRA.length; i++) if (a.indexOf(SATIN_SIRA[i]) < 0) return SATIN_SIRA[i];
    return null;
  }
  function fiyatAc(k) { var m = MAL[k]; return m ? m.fiyatAc : 0; }
  // satın alınabilir mi: eksi kasayla hiçbir şey alınamaz
  function alabilir(kasa, fiyat) { kasa = kasa | 0; return kasa >= 0 && kasa >= (fiyat | 0); }

  // gün sonu kirası: 10, 20 (2. gün), 30 (5.), 40 (10.), 50 (17.), 60 (26.) … 120 (122. günden sonra hep)
  function kira(gun) {
    gun = Math.max(1, gun | 0);
    var k = AYAR.kira0 + AYAR.kiraKat * Math.floor(Math.sqrt(gun - 1));
    return Math.min(AYAR.kiraMax, Math.round(k / 5) * 5) | 0;
  }
  // gün sonu: kira düşer, eksi kasa sayılır. eksiGun: bugüne kadar art arda eksi kalınan gün.
  // → {kasa, kira, eksiGun, kapandi}. kapandi true ise kasa SIFIRLA'ya döndü.
  function gunSonu(kasa, gun, eksiGun) {
    var kr = kira(gun);
    var k = (kasa | 0) - kr, e = eksiGun | 0, kap = false;
    if (k < 0) {
      e++;
      if (e >= KAPANIS_GUN) { k = SIFIRLA; e = 0; kap = true; }
    } else e = 0;
    return { kasa: k | 0, kira: kr, eksiGun: e, kapandi: kap };
  }

  // katman maliyeti: alt ekmek ekmek fiyatı, üst ekmek bedava
  function katmanMaliyet(k) {
    if (k === 'bunTop') return 0;
    var m = MAL[anahtar(k)];
    return m ? m.maliyet : 0;
  }
  // sipariş biçimleri: dizi (katmanlar) ya da {katmanlar, yan}
  function kats(s) { return Array.isArray(s) ? s : s && Array.isArray(s.katmanlar) ? s.katmanlar : []; }
  function yanOf(s) { return s && !Array.isArray(s) && typeof s === 'object' && yanMi(s.yan) ? s.yan : null; }
  // maliyet(katmanlar[, yan]): yan ürün verilirse onun da porsiyon maliyeti. {katmanlar, yan} de olur.
  function maliyet(katmanlar, yan) {
    var t = 0;
    kats(katmanlar).forEach(function (k) { t += katmanMaliyet(k); });
    if (yan === undefined) yan = yanOf(katmanlar);
    if (yan && MAL[yan]) t += MAL[yan].maliyet;
    return t | 0;
  }
  function katmanSatis(k) {
    if (k === 'bunTop') return 0;
    var m = MAL[anahtar(k)];
    return m ? m.satis : 0;
  }

  // fiyat(siparis, up[, yan]): siparis dizi ya da {katmanlar, yan}; yan ürünün satis'i eklenir,
  // toplam bir kez 5'e yuvarlanır.
  function fiyat(siparis, up, yan) {
    var t = 0;
    kats(siparis).forEach(function (k) { t += katmanSatis(k); });
    if (yan === undefined) yan = yanOf(siparis);
    if (yan && MAL[yan]) t += MAL[yan].satis;
    var p = Math.round(t / AYAR.fiyatYuv) * AYAR.fiyatYuv;
    return Math.max(AYAR.fiyatMin, p) | 0;
  }

  function bahsis(siparis, f, up, seri) {
    up = U(up);
    f = Math.max(2 / 3, Math.min(1, +f || 0));
    var g = (f - 2 / 3) * 3;                         // 0 … 1
    var oran = AYAR.bahsisMin + (AYAR.bahsisMax - AYAR.bahsisMin) * g;
    var b = fiyat(siparis, up) * oran * (1 + AYAR.bahsisUp * up.tip);
    seri = seri | 0;
    if (seri >= 3) b += Math.min(AYAR.seriMax, seri - 2);
    return Math.max(1, tam(b)) | 0;
  }

  function ruh(f) {
    if (f > 2 / 3) return 'mutlu';
    if (f > 1 / 3) return 'somurtkan';
    return 'kizgin';
  }
  function yuz(f) {
    if (f > 2 / 3) return 'happy';
    if (f > 0.5) return 'wait';
    if (f > 1 / 3) return 'imp';
    return 'angry';
  }

  // sıra bağımsız, sayı duyarlı: alt ekmek + aynı ortadakiler (adetleriyle) + üst ekmek
  function sayac(a) {
    var s = {};
    a.forEach(function (k) { s[k] = (s[k] || 0) + 1; });
    return s;
  }
  function dogruMu(siparis, katmanlar) {
    siparis = siparis && !Array.isArray(siparis) ? siparis.katmanlar : siparis;
    katmanlar = katmanlar && !Array.isArray(katmanlar) ? katmanlar.katmanlar : katmanlar;
    if (!siparis || !katmanlar || katmanlar.length < 2) return false;
    if (katmanlar[0] !== 'bunBot' || katmanlar[katmanlar.length - 1] !== 'bunTop') return false;
    var a = sayac(siparis.slice(1, -1)), b = sayac(katmanlar.slice(1, -1));
    if (b.bunBot || b.bunTop) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return a[k] === b[k]; });
  }

  // ESKİ: yalnız burger. siparis {katmanlar, yan} ise odemeTam'a gider (yan ürün verilmemiş sayılır).
  function odeme(siparis, katmanlar, f, up, seri) {
    if (siparis && !Array.isArray(siparis)) return odemeTam(siparis, { katmanlar: katmanlar }, f, up, seri);
    var d = dogruMu(siparis, katmanlar), r = ruh(f);
    var o = { dogru: d, ruh: r, ucret: 0, bahsis: 0, kayip: 0, can: 0 };
    if (!d) { o.kayip = maliyet(katmanlar); o.can = 1; return o; }
    if (r === 'kizgin') { o.kayip = maliyet(katmanlar); return o; }
    o.ucret = fiyat(siparis, up);
    if (r === 'mutlu') o.bahsis = bahsis(siparis, f, up, seri);
    return o;
  }

  // siparis dizi ya da {katmanlar, yan}; yan ürün isteyene +sabirYan sn
  function sabirSiparis(siparis, d, up) {
    up = U(up);
    d = zg(d);
    var taban = Math.max(AYAR.sabirMin, AYAR.sabir0 - AYAR.sabirAdim * (d - 1));
    var ks = siparis ? kats(siparis) : null;
    var ek = Math.max(0, (ks ? ks.length : 4) - 2) * AYAR.sabirKatman + (yanOf(siparis) ? AYAR.sabirYan : 0);
    return tam((taban + ek) * (1 + AYAR.sabirUp * up.pat));
  }

  // gün başına ekstra malzeme sayısı [en az, en çok] (köfte dışında)
  function ekstraAralik(d) {
    d = zg(d);
    return d < 2 ? [0, 1] : d < 5 ? [1, 2] : d < 8 ? [1, 3] : d < 11 ? [2, 3] : d < 17 ? [2, 4] : [3, 4];
  }
  // havuz: siparişe girebilecek malzemeler (ekmek, köfte hariç)
  function havuz(g, sahip) {
    var a = sahip === undefined ? acik(g) : acik(sahip);
    return a.filter(function (k) { return k !== 'bun' && k !== 'patty' && !yanMi(k); });
  }
  // sahip olunan katmanlar / yan ürünler
  function acikKatman(sahip) { return acik(sahip).filter(function (k) { return !yanMi(k); }); }
  function acikYan(sahip) { return sahip === undefined ? [] : acik(sahip).filter(yanMi); }
  // müşterinin yan ürün isteme olasılığı (yan ürün yoksa 0)
  function yanOlas(g, sahip) {
    var n = acikYan(sahip).length;
    if (!n) return 0;
    var p = Math.min(AYAR.yanMax, AYAR.yan0 + AYAR.yanGun * (zg(g) - 1));
    return Math.round((p + (n > 1 ? AYAR.yanIki : 0)) * 100) / 100;
  }
  // bir siparişte ortalama kaç ortadaki katman (köfte + ekstralar + tekrarlar) var
  function beklenenKatman(d, sahip) {
    var e = ekstraAralik(d), n = Math.min(havuz(d, sahip).length, (e[0] + e[1]) / 2);
    d = zg(d);
    return 1 + n + (d >= AYAR.ciftKofte ? AYAR.ciftKofteOlas : 0) + (d >= AYAR.tekrarGun && n > 0 ? AYAR.tekrarOlas : 0);
  }

  // gün ayarı. sahip verilmezse eski davranış (o güne kadar açılanlar).
  function gun(d, up, sahip) {
    up = U(up);
    d = Math.max(1, d | 0);
    var z = zg(d);
    var ekstra = ekstraAralik(d);
    var yo = yanOlas(d, sahip);
    var orta = Math.max(AYAR.aralikMin, AYAR.aralikTaban + AYAR.aralikKatman * beklenenKatman(d, sahip) - AYAR.aralikAdim * (z - 1)) + AYAR.aralikYan * yo;
    var taban = Math.max(AYAR.sabirMin, AYAR.sabir0 - AYAR.sabirAdim * (z - 1));
    return {
      musteri: Math.min(AYAR.musteriMax, AYAR.musteri0 + d),
      aralik: [Math.round(orta * 0.75 * 10) / 10, Math.round(orta * 1.25 * 10) / 10],
      sira: d < 3 ? 2 : 3,
      sabir: tam(taban * (1 + AYAR.sabirUp * up.pat)),
      sabirSiparis: function (siparis) { return sabirSiparis(siparis, d, up); },
      ekstra: ekstra,
      kira: kira(d),
      yanOlas: yo,
      izgara: izgaraGoz(up)
    };
  }

  // sipariş: yalnız sahip olunan malzemelerden (sahip verilmezse eski: o güne kadar açılanlar)
  function siparis(g, rastgele, sahip) {
    var R = typeof rastgele === 'function' ? rastgele : Math.random;
    g = Math.max(1, g | 0);
    var z = zg(g);
    var ek = ekstraAralik(g);
    var h = havuz(g, sahip);
    var n = Math.min(h.length, ek[0] + Math.floor(R() * (ek[1] - ek[0] + 1)));
    // ağırlıklı seçim (yerine koymadan): pahalı malzeme (satis büyük) daha sık istenir,
    // böylece her yeni malzeme ortalama siparişi pahalılaştırır
    var secilen = [];
    for (var i = 0; i < n; i++) {
      var top = 0, j0;
      for (j0 = 0; j0 < h.length; j0++) top += MAL[h[j0]].satis;
      var x = R() * top;
      for (j0 = 0; j0 < h.length - 1; j0++) { x -= MAL[h[j0]].satis; if (x < 0) break; }
      secilen.push(h.splice(j0, 1)[0]);
    }
    var orta = ['patty'];
    if (z >= AYAR.ciftKofte && R() < AYAR.ciftKofteOlas) orta.push('patty');
    if (z >= AYAR.tekrarGun && secilen.length && R() < AYAR.tekrarOlas)
      secilen.push(secilen[Math.floor(R() * secilen.length)]);
    orta = orta.concat(secilen).slice(0, KAT_MAX - 2);
    if (g > 3) {   // ilk günlerde köfte hep altta; sonra karışık (sıra önemsiz)
      for (var j = orta.length - 1; j > 0; j--) {
        var r = Math.floor(R() * (j + 1)), t = orta[j]; orta[j] = orta[r]; orta[r] = t;
      }
    }
    return ['bunBot'].concat(orta, ['bunTop']);
  }

  function pisme(up) {
    up = U(up);
    return Math.round((AYAR.pisme0 - AYAR.pismeUp * up.cook) * 10) / 10;
  }

  // ---------- 5. tur: yan ürün, tam sipariş, parça parça teslim ----------

  // tam sipariş: {katmanlar, yan}. katmanlar = siparis(g, R, sahip) ile aynı (aynı R dizisiyle aynı burger);
  // sonra bir R çekilişiyle yan ürün (yanOlas), ikisi de varsa satis ağırlıklı seçilir.
  function siparisTam(g, rastgele, sahip) {
    var R = typeof rastgele === 'function' ? rastgele : Math.random;
    var ks = siparis(g, R, sahip), yan = null;
    var ys = acikYan(sahip);
    if (ys.length && R() < yanOlas(g, sahip)) {
      var top = 0, i;
      for (i = 0; i < ys.length; i++) top += MAL[ys[i]].satis;
      var x = R() * top;
      for (i = 0; i < ys.length - 1; i++) { x -= MAL[ys[i]].satis; if (x < 0) break; }
      yan = ys[i];
    }
    return { katmanlar: ks, yan: yan };
  }

  // fritöz süresi (sn): k = 'fries' | 'onionring' (verilmezse fries); "Hızlı ızgara" fritözü de hızlandırır
  function yanPisme(up, k) {
    up = U(up);
    var t0 = AYAR.yanPisme[k] || AYAR.yanPisme.fries;
    return Math.max(AYAR.yanPismeMin, Math.round((t0 - AYAR.pismeUp * up.cook) * 10) / 10);
  }

  function siparisNesne(s) {
    if (Array.isArray(s)) return { katmanlar: s, yan: null };
    return { katmanlar: kats(s), yan: yanOf(s) };
  }
  // müşteri teslim durumu (müşteri gelince bir kez): burger/yan = o parça verildi mi;
  // maliyet = bu müşteriye verilenlerin maliyeti (yanlışta kayıp olarak gösterilir).
  function yeniDurum(siparis) {
    return { siparis: siparisNesne(siparis), burger: false, yan: false, maliyet: 0, bitti: false };
  }
  // daha verilmesi gerekenler: [] tamam; 'burger' ve/veya yan ürün anahtarı
  function eksikParca(durum) {
    var e = [];
    if (!durum || !durum.siparis) return e;
    if (!durum.burger) e.push('burger');
    if (durum.siparis.yan && !durum.yan) e.push(durum.siparis.yan);
    return e;
  }
  // parca: katman dizisi (burger), yan ürün anahtarı ('fries'), ya da {katmanlar?, yan?} (ikisi birden).
  // f: TESLİM ANINDAKİ kalan sabır oranı. seri: bu teslimden önceki art arda mutlu sayısı.
  // → {sonuc:'parca'|'tamam'|'yanlis', durum (yeni nesne; eskisi değişmez), dogru, ruh,
  //    ucret, bahsis, kayip, can, sabirEk, eksik}
  //   'parca': doğru parça, sipariş daha bitmedi; ödeme yok. sabirEk > 0 ise (yalnız ilk parçada)
  //            oyun c.p = min(c.max, c.p + sabirEk × c.max) yapar.
  //   'tamam': sipariş bitti; ödeme odeme() kurallarıyla (mutlu: fiyat + bahşiş, somurtkan: fiyat,
  //            kızgın: ödemez, kayip = verilen her şeyin maliyeti, can gitmez). Fiyat tam siparişin fiyatı.
  //   'yanlis': ödemez, kayip = verilen her şeyin maliyeti (bu parça dahil), can 1; müşteri gider.
  function teslimParca(durum, parca, f, up, seri) {
    durum = durum && durum.siparis ? durum : yeniDurum(durum);
    var sip = durum.siparis;
    var p = Array.isArray(parca) ? { katmanlar: parca, yan: null }
      : typeof parca === 'string' ? { katmanlar: null, yan: parca }
      : { katmanlar: parca && Array.isArray(parca.katmanlar) ? parca.katmanlar : null,
          yan: parca && (parca.yan || parca.yanVerilen) || null };
    var yeni = { siparis: sip, burger: durum.burger, yan: durum.yan, maliyet: durum.maliyet | 0, bitti: durum.bitti };
    var r = ruh(f);
    var o = { sonuc: 'parca', durum: yeni, dogru: true, ruh: r, ucret: 0, bahsis: 0, kayip: 0, can: 0, sabirEk: 0, eksik: [] };
    if (!p.katmanlar && !p.yan) { o.durum = durum; o.eksik = eksikParca(durum); return o; }   // boş parça: hiçbir şey olmaz
    var dogru = !durum.bitti;
    if (p.katmanlar) {
      yeni.maliyet += maliyet(p.katmanlar, null);
      if (durum.burger || !dogruMu(sip.katmanlar, p.katmanlar)) dogru = false;
      yeni.burger = true;
    }
    if (p.yan) {
      yeni.maliyet += MAL[p.yan] ? MAL[p.yan].maliyet : 0;
      if (!sip.yan || durum.yan || p.yan !== sip.yan) dogru = false;
      yeni.yan = true;
    }
    yeni.maliyet |= 0;
    if (!dogru) {
      yeni.bitti = true;
      o.sonuc = 'yanlis'; o.dogru = false; o.kayip = yeni.maliyet; o.can = 1;
      return o;
    }
    o.eksik = eksikParca(yeni);
    if (o.eksik.length) {
      // ilk doğru parça: sabır biraz dolar (bir kez)
      if (!durum.burger && !durum.yan) o.sabirEk = AYAR.parcaYenile;
      return o;
    }
    yeni.bitti = true;
    o.sonuc = 'tamam';
    if (r === 'kizgin') { o.kayip = yeni.maliyet; return o; }
    o.ucret = fiyat(sip, up);
    if (r === 'mutlu') o.bahsis = bahsis(sip, f, up, seri);
    return o;
  }
  // hepsi birden: verilen = {katmanlar, yanVerilen} (yanVerilen null/yok: yan ürün verilmedi).
  // Sonuç teslimParca ile aynı; yan ürün isteyen müşteriye yalnız burger verilirse sonuc 'parca' (ödeme yok).
  function odemeTam(siparis, verilen, f, up, seri) {
    verilen = verilen || {};
    var ks = Array.isArray(verilen) ? verilen : verilen.katmanlar;
    var yv = Array.isArray(verilen) ? null : (verilen.yanVerilen !== undefined ? verilen.yanVerilen : verilen.yan) || null;
    return teslimParca(yeniDurum(siparis), { katmanlar: ks || null, yan: yv }, f, up, seri);
  }

  BU.VERI = {
    MALZEME: MALZEME, SATIN_SIRA: SATIN_SIRA, STOK_MAX: STOK_MAX, KAT_MAX: KAT_MAX, GELISTIR: GELISTIR, AYAR: AYAR,
    BASLANGIC: BASLANGIC, KAPANIS_GUN: KAPANIS_GUN, SIFIRLA: SIFIRLA,
    acik: acik, eskiSahip: eskiSahip, siradaki: siradaki, fiyatAc: fiyatAc, alabilir: alabilir,
    kira: kira, gunSonu: gunSonu,
    maliyet: maliyet, katmanMaliyet: katmanMaliyet, katmanSatis: katmanSatis, fiyat: fiyat, bahsis: bahsis,
    ruh: ruh, yuz: yuz, dogruMu: dogruMu, odeme: odeme, gun: gun, sabirSiparis: sabirSiparis,
    siparis: siparis, pisme: pisme,
    // 5. tur
    YAN: YAN, YAN_STOK_MAX: YAN_STOK_MAX, IZGARA_MAX: IZGARA_MAX,
    yanMi: yanMi, acikKatman: acikKatman, acikYan: acikYan, yanOlas: yanOlas, izgaraGoz: izgaraGoz,
    siparisTam: siparisTam, yanPisme: yanPisme, yeniDurum: yeniDurum, eksikParca: eksikParca,
    teslimParca: teslimParca, odemeTam: odemeTam
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BU.VERI;
})(typeof window !== 'undefined' ? window : globalThis);
