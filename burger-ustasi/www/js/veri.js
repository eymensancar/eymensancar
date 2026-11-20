/* Burger Ustası: ekonomi ve denge (BU.VERI)
 *
 * DOM yok; tarayıcıda window.BU.VERI, Node'da module.exports.
 * Bütün paralar TAM SAYI.
 *
 * Maliyet (malzeme tabağa konunca, köfte ızgaraya konunca kasadan düşer):
 *   köfte 6, pastırma 4, peynir 3, ekmek 2 (alt ekmekte bir kez; üst ekmek bedava),
 *   domates 2, yumurta 2, marul 1, soğan 1, turşu 1.
 * Menü fiyatı: maliyet × 2,25, en yakın 5'e yuvarlanır (en az 15).
 *   Örnek: ekmek+köfte (8) → 20, ekmek+köfte+peynir (11) → 25.
 *   Fiyat oyunun her yerinde aynı: geliştirmeler fiyatı değil bahşişi artırır.
 * Bahşiş (yalnız doğru + mutlu teslimde): fiyatın %8'i (sabır 2/3'teyken) ile
 *   %30'u (sabır tam doluyken) arası, "Cömert bahşiş" her düzeyde +%25,
 *   art arda 3. mutlu teslimden sonra seri payı (+1 … +5). En az 1.
 * Ruh hâli (f = kalan sabır oranı, 0…1):
 *   f > 2/3 mutlu ('happy'), 2/3 ≥ f > 1/3 somurtkan ('wait', f ≤ 0,5'te 'imp'),
 *   f ≤ 1/3 kızgın ('angry'), f = 0 kaçar (oyun tarafı; bir can).
 * Ödeme: doğru+mutlu → fiyat+bahşiş; doğru+somurtkan → fiyat; doğru+kızgın → 0
 *   (malzeme parası boşa gitti = zarar); yanlış → 0 ve bir can.
 * Denge değerleri AYAR içinde; botu (scripts/denge.mjs) çalıştırıp ayarlandı,
 *   sonuçlar docs/DENGE.md.
 */
(function (root) {
  'use strict';
  var BU = root.BU = root.BU || {};

  var MALZEME = [
    { k: 'bun',     gun: 1,  maliyet: 2 },
    { k: 'patty',   gun: 1,  maliyet: 6 },
    { k: 'cheese',  gun: 1,  maliyet: 3 },
    { k: 'lettuce', gun: 2,  maliyet: 1 },
    { k: 'tomato',  gun: 3,  maliyet: 2 },
    { k: 'onion',   gun: 5,  maliyet: 1 },
    { k: 'bacon',   gun: 7,  maliyet: 4 },
    { k: 'egg',     gun: 9,  maliyet: 2 },
    { k: 'pickle',  gun: 11, maliyet: 1 }
  ];
  var MAL = {};
  MALZEME.forEach(function (m) { MAL[m.k] = m; });

  // denge ayarları (bot ile ayarlandı)
  var AYAR = {
    fiyatKat: 2.25, fiyatYuv: 5, fiyatMin: 15,
    bahsisMin: 0.08, bahsisMax: 0.30, bahsisUp: 0.25, seriMax: 5,
    musteri0: 5, musteriMax: 18,
    aralikTaban: 5.0, aralikKatman: 1.6, aralikAdim: 0.15, // gelme aralığının ortası (sn) = taban + katman × beklenen ortadaki katman − adım × (gün − 1)
    sabir0: 30, sabirAdim: 0.9, sabirMin: 19,             // siparişten bağımsız taban sabır (sn)
    sabirKatman: 4.0,                                     // ekmek dışındaki her katman için ek sabır (sn)
    sabirUp: 0.12,                                        // "Sabırlı müşteri" her düzeyde +%12
    pisme0: 4.0, pismeUp: 0.5,                            // köfte pişme süresi (sn)
    ciftKofte: 6, ciftKofteOlas: 0.25,                    // bu günden sonra çift köfte olasılığı
    tekrarGun: 10, tekrarOlas: 0.2                        // bu günden sonra başka bir malzeme de iki kez
  };

  var STOK_MAX = 6;
  var KAT_MAX = 10;   // bir tabakta en çok katman

  var GELISTIR = {
    cook: { max: 4, cost: function (l) { return 150 + l * 90; } },   // 150 240 330 420
    pat:  { max: 4, cost: function (l) { return 180 + l * 100; } },  // 180 280 380 480
    tip:  { max: 4, cost: function (l) { return 200 + l * 110; } },  // 200 310 420 530
    slot: { max: 1, cost: function () { return 450; } }
  };

  function U(up) {
    up = up || {};
    return { cook: up.cook | 0, pat: up.pat | 0, tip: up.tip | 0, slot: up.slot | 0 };
  }
  function tam(x) { return Math.round(x); }
  // katman adı → malzeme anahtarı
  function anahtar(k) { return k === 'bunBot' || k === 'bunTop' ? 'bun' : k; }

  function acik(gun) {
    gun = gun | 0;
    return MALZEME.filter(function (m) { return m.gun <= gun || m.k === 'bun' || m.k === 'patty'; })
      .map(function (m) { return m.k; });
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

  function fiyat(siparis, up) {
    var c = maliyet(siparis);
    var p = Math.round(c * AYAR.fiyatKat / AYAR.fiyatYuv) * AYAR.fiyatYuv;
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
    return Math.max(1, tam(b));
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
    d = Math.max(1, d | 0);
    var taban = Math.max(AYAR.sabirMin, AYAR.sabir0 - AYAR.sabirAdim * (d - 1));
    var ek = Math.max(0, (siparis ? siparis.length : 4) - 2) * AYAR.sabirKatman;
    return tam((taban + ek) * (1 + AYAR.sabirUp * up.pat));
  }

  // gün başına ekstra malzeme sayısı [en az, en çok] (köfte dışında)
  function ekstraAralik(d) {
    return d < 2 ? [0, 1] : d < 4 ? [1, 2] : d < 7 ? [1, 3] : d < 10 ? [2, 3] : d < 13 ? [2, 4] : [3, 4];
  }
  // bir siparişte ortalama kaç ortadaki katman (köfte + ekstralar + tekrarlar) var
  function beklenenKatman(d) {
    var e = ekstraAralik(d), n = Math.min(acik(d).length - 2, (e[0] + e[1]) / 2);
    return 1 + n + (d >= AYAR.ciftKofte ? AYAR.ciftKofteOlas : 0) + (d >= AYAR.tekrarGun ? AYAR.tekrarOlas : 0);
  }

  function gun(d, up) {
    up = U(up);
    d = Math.max(1, d | 0);
    var ekstra = ekstraAralik(d);
    var orta = AYAR.aralikTaban + AYAR.aralikKatman * beklenenKatman(d) - AYAR.aralikAdim * (d - 1);
    var taban = Math.max(AYAR.sabirMin, AYAR.sabir0 - AYAR.sabirAdim * (d - 1));
    return {
      musteri: Math.min(AYAR.musteriMax, AYAR.musteri0 + d),
      aralik: [Math.round(orta * 0.75 * 10) / 10, Math.round(orta * 1.25 * 10) / 10],
      sira: d < 2 ? 2 : 3,
      sabir: tam(taban * (1 + AYAR.sabirUp * up.pat)),
      sabirSiparis: function (siparis) { return sabirSiparis(siparis, d, up); },
      ekstra: ekstra
    };
  }

  function siparis(g, rastgele) {
    var R = typeof rastgele === 'function' ? rastgele : Math.random;
    g = Math.max(1, g | 0);
    var ek = ekstraAralik(g);
    var havuz = acik(g).filter(function (k) { return k !== 'bun' && k !== 'patty'; });
    var n = Math.min(havuz.length, ek[0] + Math.floor(R() * (ek[1] - ek[0] + 1)));
    var secilen = [];
    for (var i = 0; i < n; i++) secilen.push(havuz.splice(Math.floor(R() * havuz.length), 1)[0]);
    var orta = ['patty'];
    if (g >= AYAR.ciftKofte && R() < AYAR.ciftKofteOlas) orta.push('patty');
    if (g >= AYAR.tekrarGun && secilen.length && R() < AYAR.tekrarOlas)
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
    MALZEME: MALZEME, STOK_MAX: STOK_MAX, KAT_MAX: KAT_MAX, GELISTIR: GELISTIR, AYAR: AYAR,
    acik: acik, maliyet: maliyet, katmanMaliyet: katmanMaliyet, fiyat: fiyat, bahsis: bahsis,
    ruh: ruh, yuz: yuz, dogruMu: dogruMu, odeme: odeme, gun: gun, sabirSiparis: sabirSiparis,
    siparis: siparis, pisme: pisme
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BU.VERI;
})(typeof window !== 'undefined' ? window : globalThis);
