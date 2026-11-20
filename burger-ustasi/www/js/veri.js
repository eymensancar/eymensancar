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
 *   en pahalısı trüf (premium) 9. Liste MALZEME'de.
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
 * Zorluk güne göre artar, ZOR_TAVAN gününde durur (300. gün de 40. gün kadar zor).
 * Denge değerleri AYAR içinde; botu (scripts/denge.mjs) çalıştırıp ayarlandı,
 *   sonuçlar docs/DENGE.md.
 */
(function (root) {
  'use strict';
  var BU = root.BU = root.BU || {};

  // k: anahtar, maliyet: porsiyon maliyeti, satis: menü fiyatına katkısı,
  // fiyatAc: dükkânda satın alma fiyatı (0 = başta açık),
  // gun: ESKİ (1. tur) açılış günü; yalnız acik(sayı) ve eski kayıt dönüşümü için
  //   (2. turda gelen malzemelerde 99 = eski düzende hiç yoktu).
  var MALZEME = [
    { k: 'bun',       maliyet: 2, satis: 5,  fiyatAc: 0,      gun: 1 },
    { k: 'patty',     maliyet: 6, satis: 14, fiyatAc: 0,      gun: 1 },
    { k: 'cheese',    maliyet: 3, satis: 6,  fiyatAc: 30,     gun: 1 },
    { k: 'lettuce',   maliyet: 1, satis: 6,  fiyatAc: 80,     gun: 2 },
    { k: 'tomato',    maliyet: 2, satis: 6,  fiyatAc: 160,    gun: 3 },
    { k: 'onion',     maliyet: 1, satis: 7,  fiyatAc: 500,    gun: 5 },
    { k: 'pickle',    maliyet: 1, satis: 7,  fiyatAc: 1200,   gun: 11 },
    { k: 'bacon',     maliyet: 4, satis: 9,  fiyatAc: 2500,   gun: 7 },
    { k: 'egg',       maliyet: 2, satis: 9,  fiyatAc: 5000,   gun: 9 },
    { k: 'sauce',     maliyet: 2, satis: 10, fiyatAc: 10000,  gun: 99 },
    { k: 'mushroom',  maliyet: 3, satis: 12, fiyatAc: 20000,  gun: 99 },
    { k: 'jalapeno',  maliyet: 3, satis: 13, fiyatAc: 40000,  gun: 99 },
    { k: 'onionring', maliyet: 4, satis: 15, fiyatAc: 80000,  gun: 99 },
    { k: 'avocado',   maliyet: 5, satis: 18, fiyatAc: 160000, gun: 99 },
    { k: 'truffle',   maliyet: 9, satis: 30, fiyatAc: 400000, gun: 99 }
  ];
  var MAL = {};
  MALZEME.forEach(function (m) { MAL[m.k] = m; });
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
    sabir0: 15.5, sabirAdim: 0.35, sabirMin: 10,            // siparişten bağımsız taban sabır (sn)
    sabirKatman: 3.5,                                     // ekmek dışındaki her katman için ek sabır (sn)
    sabirUp: 0.10,                                        // "Sabırlı müşteri" her düzeyde +%10
    pisme0: 4.0, pismeUp: 0.5,                            // köfte pişme süresi (sn)
    ciftKofte: 6, ciftKofteOlas: 0.25,                    // bu günden sonra çift köfte olasılığı
    tekrarGun: 10, tekrarOlas: 0.2,                       // bu günden sonra başka bir malzeme de iki kez
    zorTavan: 40,                                         // bu günden sonra zorluk artmaz
    kira0: 10, kiraKat: 10                                // kira = kira0 + kiraKat × ⌊√(gün − 1)⌋, 5'e yuvarlı
  };

  var STOK_MAX = 6;
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
    slot: { max: 1, cost: basamak([1000]) }                    // 3. ızgara gözü
  };

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

  // gün sonu kirası: 10, 20 (2. gün), 30 (5.), 40 (10.), 50 (17.) … 200 (362.) …
  function kira(gun) {
    gun = Math.max(1, gun | 0);
    var k = AYAR.kira0 + AYAR.kiraKat * Math.floor(Math.sqrt(gun - 1));
    return (Math.round(k / 5) * 5) | 0;
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
  function maliyet(katmanlar) {
    var t = 0;
    (katmanlar || []).forEach(function (k) { t += katmanMaliyet(k); });
    return t | 0;
  }
  function katmanSatis(k) {
    if (k === 'bunTop') return 0;
    var m = MAL[anahtar(k)];
    return m ? m.satis : 0;
  }

  function fiyat(siparis, up) {
    var t = 0;
    (siparis || []).forEach(function (k) { t += katmanSatis(k); });
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
    if (!siparis || !katmanlar || katmanlar.length < 2) return false;
    if (katmanlar[0] !== 'bunBot' || katmanlar[katmanlar.length - 1] !== 'bunTop') return false;
    var a = sayac(siparis.slice(1, -1)), b = sayac(katmanlar.slice(1, -1));
    if (b.bunBot || b.bunTop) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return a[k] === b[k]; });
  }

  function odeme(siparis, katmanlar, f, up, seri) {
    var d = dogruMu(siparis, katmanlar), r = ruh(f);
    var o = { dogru: d, ruh: r, ucret: 0, bahsis: 0, kayip: 0, can: 0 };
    if (!d) { o.kayip = maliyet(katmanlar); o.can = 1; return o; }
    if (r === 'kizgin') { o.kayip = maliyet(katmanlar); return o; }
    o.ucret = fiyat(siparis, up);
    if (r === 'mutlu') o.bahsis = bahsis(siparis, f, up, seri);
    return o;
  }

  function sabirSiparis(siparis, d, up) {
    up = U(up);
    d = zg(d);
    var taban = Math.max(AYAR.sabirMin, AYAR.sabir0 - AYAR.sabirAdim * (d - 1));
    var ek = Math.max(0, (siparis ? siparis.length : 4) - 2) * AYAR.sabirKatman;
    return tam((taban + ek) * (1 + AYAR.sabirUp * up.pat));
  }

  // gün başına ekstra malzeme sayısı [en az, en çok] (köfte dışında)
  function ekstraAralik(d) {
    d = zg(d);
    return d < 2 ? [0, 1] : d < 5 ? [1, 2] : d < 8 ? [1, 3] : d < 11 ? [2, 3] : d < 17 ? [2, 4] : d < 30 ? [3, 4] : [3, 5];
  }
  // havuz: siparişe girebilecek malzemeler (ekmek, köfte hariç)
  function havuz(g, sahip) {
    var a = sahip === undefined ? acik(g) : acik(sahip);
    return a.filter(function (k) { return k !== 'bun' && k !== 'patty'; });
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
    var orta = Math.max(AYAR.aralikMin, AYAR.aralikTaban + AYAR.aralikKatman * beklenenKatman(d, sahip) - AYAR.aralikAdim * (z - 1));
    var taban = Math.max(AYAR.sabirMin, AYAR.sabir0 - AYAR.sabirAdim * (z - 1));
    return {
      musteri: Math.min(AYAR.musteriMax, AYAR.musteri0 + d),
      aralik: [Math.round(orta * 0.75 * 10) / 10, Math.round(orta * 1.25 * 10) / 10],
      sira: d < 3 ? 2 : 3,
      sabir: tam(taban * (1 + AYAR.sabirUp * up.pat)),
      sabirSiparis: function (siparis) { return sabirSiparis(siparis, d, up); },
      ekstra: ekstra,
      kira: kira(d)
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
    var secilen = [];
    for (var i = 0; i < n; i++) secilen.push(h.splice(Math.floor(R() * h.length), 1)[0]);
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

  BU.VERI = {
    MALZEME: MALZEME, SATIN_SIRA: SATIN_SIRA, STOK_MAX: STOK_MAX, KAT_MAX: KAT_MAX, GELISTIR: GELISTIR, AYAR: AYAR,
    BASLANGIC: BASLANGIC, KAPANIS_GUN: KAPANIS_GUN, SIFIRLA: SIFIRLA,
    acik: acik, eskiSahip: eskiSahip, siradaki: siradaki, fiyatAc: fiyatAc, alabilir: alabilir,
    kira: kira, gunSonu: gunSonu,
    maliyet: maliyet, katmanMaliyet: katmanMaliyet, katmanSatis: katmanSatis, fiyat: fiyat, bahsis: bahsis,
    ruh: ruh, yuz: yuz, dogruMu: dogruMu, odeme: odeme, gun: gun, sabirSiparis: sabirSiparis,
    siparis: siparis, pisme: pisme
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BU.VERI;
})(typeof window !== 'undefined' ? window : globalThis);
