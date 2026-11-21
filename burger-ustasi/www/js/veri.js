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
 *   f ≤ 1/3 kızgın ('angry'), f = 0 kaçar (oyun tarafı).
 * 9. tur (Eymen, 21 Kasım): CAN YOK. Kaçan müşteri yalnız kendi parasını ve seriyi götürür; yanlış teslimde
 *   ödeme yok, seri sıfırlanır. Fonksiyonlar 'can' alanını eskisi gibi döndürür ama oyun ve denge botu kullanmaz.
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
 *
 * 10. tur (Eymen, 21 Kasım; docs/SHAWARMA_INCELEME.md):
 *   - Y1: geç teslimde (sabır ≤ 1/3) yalnız bahşiş gider, burgerin parası ödenir.
 *   - Y2: zorluk 10. günden sonra yarı hızda artar (zg).
 *   - S5: malzemeler BEDAVA (AYAR.bedava): maliyet hep 0; para yalnız kira ve dükkâna gider.
 *     Yanlış teslimde ödeme yok, seri sıfırlanır (kayıp 0).
 *   - P1–P3: gün SAATLE biter (gunSure: 1. gün 90 sn → 10. gün 150 sn, sonra yavaş artış, en çok 240);
 *     tezgâhta hep 3 müşteri, boşalan yere 3–5 sn'de yenisi, günün ilk üçü 0., 2., 5. saniyede; sabır ~50 sn.
 *   - P8: hazır tepsi müşteri gelir gelmez verilirse +1 bahşiş ("Hazırdı!").
 *   - P9: yıldız = mutlu teslim oranı (yildiz()).
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
  // 10. tur: maliyet artık kullanılmıyor (AYAR.bedava); satis değerleri (menü fiyatı) SATIS10 ile yeniden verilir
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
    kira0: 20, kiraKat: 20, kiraMax: 240,                 // kira = kira0 + kiraKat × ⌊√(gün − 1)⌋, 5'e yuvarlı, en çok kiraMax (10. tur: ×2, malzeme bedava)
    // yan ürün (5. tur)
    yan0: 0.25, yanGun: 0.01, yanMax: 0.35, yanIki: 0.10, // yan ürün isteme olasılığı: min(yanMax, yan0 + yanGun × (zg − 1)) (+ yanIki ikisi de varsa)
    sabirYan: 5,                                          // yan ürün isteyen müşteriye ek sabır (sn)
    aralikYan: 2.0,                                       // gelme aralığına yan ürün payı (sn × olasılık)
    parcaYenile: 0.15,                                    // ilk doğru parça verilince sabır bu oranda dolar (bir kez)
    yanPisme: { fries: 5, onionring: 6 }, yanPismeMin: 2.5, // fritöz süresi (sn), "Hızlı ızgara" her düzeyde −pismeUp
    // 6. tur (resimdeki mutfak; gun6): gelme aralığının ortası = aralik6 − aralikAdim × (zg − 1) (en az aralikMin),
    // sabır = (sabır tabanı + sabir6) × (1 + %10 × pat). Bot ile ayarlandı (docs/DENGE.md).
    aralik6: 15, sabir6: 12,
    // 10. tur (Eymen, 21 Kasım): bedava malzeme, saatli gün, tezgâhta hep 3 müşteri, uzun sabır
    bedava: true,                                         // malzemeler bedava (S5)
    zgYavas: 10,                                          // Y2: bu günden sonra zorluk yarı hızda artar
    sure0: 90, sure10: 150, sureAdim: 2.5, sureMax: 240,  // günün süresi (sn): 1. gün 90, 10. gün 150, sonra günde +2,5 (5'e yuvarlı), en çok 240
    sira10: 3, aralik10: [3, 5], ilkGelis: [0, 2, 5],     // aynı anda müşteri; boş yere gelme aralığı (sn); günün ilk üçünün gelişi (sn)
    sabir10: 55, sabir10Adim: 0.6, sabir10Min: 45,        // sabır (sn) = max(min, sabir10 − adım × (zg − 1)) × (1 + %10 × pat): 2. gün 54, 18. günden sonra 45
    fiyatKat: 0.65,                                       // S5: malzeme bedava olunca menü fiyatı düşer (satis toplamı × 0,65; 47 → 30)
    ilkGunSabir: 1.6,                                     // P11: 1. gün herkes daha sabırlı (×)
    hazirBahsis: 1,                                       // P8: hazır tepsi gelir gelmez verilirse +1 bahşiş
    hizli: 0.75                                           // P5: teslimde kalan sabır bu orandan çoksa "Çok hızlı!"
  };

  var STOK_MAX = 6;
  var YAN_STOK_MAX = 3;  // her yan ürünün hazır kutusunda en çok
  var IZGARA_MAX = 4;    // 6. tur: resimdeki ızgara sayısı (başta 2 açık, 2 kilitli; slot ile +1'er)
  var KAT_MAX = 10;   // bir tabakta en çok katman
  var BASLANGIC = 50; // yeni oyuncunun parası
  var KAPANIS_GUN = 3; // art arda bu kadar gün eksi kasa → dükkân kapanır
  var SIFIRLA = 50;   // kapanınca kasa buna döner

  // geliştirme fiyatları düzey düzey (l = şu anki düzey, 0'dan başlar)
  function basamak(a) { return function (l) { l = l | 0; return a[Math.min(l, a.length - 1)]; }; }
  var GELISTIR = {
    cook: { max: 4, cost: basamak([300, 600, 1200, 2400]) },   // ESKİ "Hızlı ızgara": 9. turdan beri satılmaz, etkisi yok (SATILIK'ta değil)
    // 10. tur (malzeme bedava, saatli gün): üst düzeyler pahalandı (docs/DENGE.md "10. tur")
    pat:  { max: 4, cost: basamak([350, 750, 1600, 3400]) },   // müşteri sabrı +%10
    tip:  { max: 4, cost: basamak([400, 900, 1900, 4000]) },   // bahşiş +%25
    slot: { max: 2, cost: basamak([250, 1800]) }               // 6. tur: resimdeki 2 kilitli ızgara (3. ve 4.)
  };
  // dükkânda satılanlar (9. tur: cook çıktı)
  var SATILIK = ['slot', 'pat', 'tip'];
  // eski kayıtta alınmış "Hızlı ızgara" düzeylerinin toplam fiyatı (iade)
  function cookIade(l) { var t = 0; for (var i = 0; i < Math.min(l | 0, GELISTIR.cook.max); i++) t += GELISTIR.cook.cost(i); return t; }
  // açık ızgara: 2 + slot düzeyi (resimde 4 ızgara; en çok 4). Eski kayıtta slot 1 → 3 ızgara; 3–4 → 4.
  function izgaraGoz(up) { return Math.min(IZGARA_MAX, 2 + U(up).slot); }

  function U(up) {
    up = up || {};
    return { cook: up.cook | 0, pat: up.pat | 0, tip: up.tip | 0, slot: up.slot | 0 };
  }
  function tam(x) { return Math.round(x); }
  // katman adı → malzeme anahtarı
  function anahtar(k) { return k === 'bunBot' || k === 'bunTop' ? 'bun' : k; }
  // zorluk günü: tavanda durur
  // 10. tur (Y2): 10. günden sonra yarım adım (11. gün = 10,5 … 26. gün = 18)
  function zg(d) {
    d = Math.max(1, d | 0);
    var z = d <= AYAR.zgYavas ? d : AYAR.zgYavas + (d - AYAR.zgYavas) / 2;
    return Math.min(z, AYAR.zorTavan);
  }

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

  // gün sonu kirası (10. tur): 20, 40 (2. gün), 60 (5.), 80 (10.), 100 (17.), 120 (26.) … 240 (122. günden sonra hep)
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
    if (k === 'bunTop' || AYAR.bedava) return 0;
    var m = MAL[anahtar(k)];
    return m ? m.maliyet : 0;
  }
  // sipariş biçimleri: dizi (katmanlar) ya da {katmanlar, yan}
  function kats(s) { return Array.isArray(s) ? s : s && Array.isArray(s.katmanlar) ? s.katmanlar : []; }
  function yanOf(s) { return s && !Array.isArray(s) && typeof s === 'object' && yanMi(s.yan) ? s.yan : null; }
  // maliyet(katmanlar[, yan]): yan ürün verilirse onun da porsiyon maliyeti. {katmanlar, yan} de olur.
  function maliyet(katmanlar, yan) {
    var t = 0;
    if (AYAR.bedava) return 0;
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
    if (AYAR.fiyatKat) t *= AYAR.fiyatKat;
    var p = Math.round(t / AYAR.fiyatYuv) * AYAR.fiyatYuv;
    return Math.max(AYAR.fiyatMin, p) | 0;
  }

  // hazir (10. tur, P8): hazır tepsi müşteri gelir gelmez verildi → +AYAR.hazirBahsis
  function bahsis(siparis, f, up, seri, hazir) {
    up = U(up);
    f = Math.max(2 / 3, Math.min(1, +f || 0));
    var g = (f - 2 / 3) * 3;                         // 0 … 1
    var oran = AYAR.bahsisMin + (AYAR.bahsisMax - AYAR.bahsisMin) * g;
    var b = fiyat(siparis, up) * oran * (1 + AYAR.bahsisUp * up.tip);
    seri = seri | 0;
    if (seri >= 3) b += Math.min(AYAR.seriMax, seri - 2);
    return (Math.max(1, tam(b)) + (hazir ? AYAR.hazirBahsis : 0)) | 0;
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
    o.ucret = fiyat(siparis, up);   // 10. tur (Y1): kızgın da öder, yalnız bahşiş yok
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
  // ek (10. tur): {hazir: true} → hazır tepsi müşteri gelir gelmez verildi (mutluysa +1 bahşiş)
  function teslimParca(durum, parca, f, up, seri, ek) {
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
      yeni.maliyet += MAL[p.yan] && !AYAR.bedava ? MAL[p.yan].maliyet : 0;
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
    // 10. tur (Y1): sabır ≤ 1/3 (kızgın) da burgerin parasını öder; yalnız bahşiş yok
    o.ucret = fiyat(sip, up);
    if (r === 'mutlu') { o.hazir = !!(ek && ek.hazir); o.bahsis = bahsis(sip, f, up, seri, o.hazir); }
    o.hizli = r === 'mutlu' && f >= AYAR.hizli;
    return o;
  }
  // hepsi birden: verilen = {katmanlar, yanVerilen} (yanVerilen null/yok: yan ürün verilmedi).
  // Sonuç teslimParca ile aynı; yan ürün isteyen müşteriye yalnız burger verilirse sonuc 'parca' (ödeme yok).
  function odemeTam(siparis, verilen, f, up, seri, ek) {
    verilen = verilen || {};
    var ks = Array.isArray(verilen) ? verilen : verilen.katmanlar;
    var yv = Array.isArray(verilen) ? null : (verilen.yanVerilen !== undefined ? verilen.yanVerilen : verilen.yan) || null;
    return teslimParca(yeniDurum(siparis), { katmanlar: ks || null, yan: yv }, f, up, seri, ek);
  }

  // ---------- 6. tur: Eymen'in resmi (mutfak-v3, 21 Kasım) ----------
  // Mutfak resimdeki gibi: ekmek dolabı, 2×2 ızgara (2 kilitli), köfte/peynir/turşu/patates haznesi, fritöz, çiğ patates.
  // Başta açık: ekmek, köfte, peynir, turşu, patates kızartması. Herkes aynı siparişi verir: turşulu peynirli burger + patates.
  // Öbür malzemelerin mutfakta yeri yok: siparişe girmez, dükkânda satılmaz (eski kayıtta alınmışsa kayıtta durur).
  var MUTFAK = {
    izgaraPisme: 8,     // köfte ızgarada (sn); 9. turdan beri hiçbir şey kısaltmaz
    fritozPisme: 15,    // patates fritözde (sn)
    hazneKofte: 6,      // pişmiş köfte haznesi
    haznePatates: 4,    // patates haznesi (porsiyon); bir fritöz dolusu 4 porsiyon
    dograma: 10,        // çiğ patatese dokunuş: 10'da doğranır
    tepsi: 2,           // tezgâhtaki tepsi
    hazir: { patty: 6, fries: 4 }   // gün başında hazneler dolu (resimdeki gibi; dünden kalan, para düşmez)
  };
  // ÖNERİ (satılmıyor): sonraki adımlarda mutfağa yer açılınca sırayla satılacak malzemeler ve fiyatları.
  // Denge botu (node scripts/denge.mjs plan) bunlarla "24 saatte son ürüne ulaşılamaz" kuralını ölçer.
  var GELECEK = [
    { k: 'lettuce', ad: 'Marul', fiyat: 2000 }, { k: 'tomato', ad: 'Domates', fiyat: 4000 },
    { k: 'onion', ad: 'Soğan', fiyat: 7000 }, { k: 'bacon', ad: 'Pastırma', fiyat: 12000 },
    { k: 'egg', ad: 'Yumurta', fiyat: 20000 }, { k: 'sauce', ad: 'Ketçap', fiyat: 32000 },
    { k: 'mayo', ad: 'Mayonez', fiyat: 50000 }, { k: 'mushroom', ad: 'Mantar', fiyat: 80000 },
    { k: 'jalapeno', ad: 'Jalapeño', fiyat: 130000 }, { k: 'avocado', ad: 'Avokado', fiyat: 220000 },
    { k: 'premium', ad: 'Altın Wagyu', fiyat: 400000 }
  ];
  var MUTFAKTA = ['bun', 'patty', 'cheese', 'pickle', 'fries'];   // mutfakta yeri olanlar (hepsi başta açık)
  var SIPARIS0 = { katmanlar: ['bunBot', 'patty', 'cheese', 'pickle', 'bunTop'], yan: 'fries' };
  function mutfaktaMi(k) { return MUTFAKTA.indexOf(anahtar(k)) >= 0; }
  // izgara ve fritöz süresi (sn)
  // 9. tur (Eymen, 21 Kasım): işi kısaltan yükseltme yok. "Hızlı ızgara" (cook) dükkândan kalktı, etkisi sıfır:
  // süreler hep 8 sn ve 15 sn. Eski kayıtta alınmışsa parası iade edilir (oyun.js, cookIade). up.cook yok sayılır.
  function izgaraPisme(up) { return MUTFAK.izgaraPisme; }
  function fritozPisme(up) { return MUTFAK.fritozPisme; }
  // sipariş (6. tur): herkes aynı; sonradan mutfağa yer açılan malzemeler (gelecek) eklenirse siparisTam eski
  // kurala döner. ek: {katmanlar, yan} yeni nesne.
  function siparis6() { return { katmanlar: SIPARIS0.katmanlar.slice(), yan: SIPARIS0.yan }; }
  // burgere bu malzeme konabilir mi: alt ekmek ilk, üst ekmek son; ortadakiler siparişin izin verdiği kadar
  //   katmanlar: tezgâhtaki yarım burger; k: 'bun' | 'patty' | 'cheese' | 'pickle'; en: o malzemeden en çok kaç tane
  //   → 'alt' (alt ekmek konur) | 'ust' (üst ekmek, burger biter) | 'orta' | red nedeni: 'ekmekYok' | 'bitti' | 'fazla' | 'eksik'
  function koyKarar(katmanlar, k, en) {
    katmanlar = katmanlar || [];
    var n = katmanlar.length, son = katmanlar[n - 1];
    if (son === 'bunTop') return 'bitti';
    if (k === 'bun') {
      if (!n) return 'alt';
      if (n < 2) return 'eksik';   // alt ekmeğin üstüne hemen üst ekmek yok
      return 'ust';
    }
    if (!n) return 'ekmekYok';
    var say = 0;
    for (var i = 0; i < n; i++) if (katmanlar[i] === k) say++;
    if (en != null && say >= en) return 'fazla';
    if (n >= KAT_MAX - 1) return 'fazla';
    return 'orta';
  }
  // 10. tur: günün süresi (sn). 1. gün 90, 10. gün 150 (her gün +6,7), sonra günde +2,5; 5'e yuvarlı, en çok sureMax
  function gunSure(d) {
    d = Math.max(1, d | 0);
    var s = d <= 10 ? AYAR.sure0 + (AYAR.sure10 - AYAR.sure0) * (d - 1) / 9 : AYAR.sure10 + AYAR.sureAdim * (d - 10);
    return Math.min(AYAR.sureMax, Math.round(s / 5) * 5) | 0;
  }
  // 10. tur (P9): yıldız = mutlu teslim oranı (gelen her müşteri sayılır: kaçan ve yanlış da). ≥ %80 → 3, ≥ %50 → 2, yoksa 1
  function yildiz(mutlu, toplam) {
    toplam = toplam | 0; if (!toplam) return 1;
    var o = (mutlu | 0) / toplam;
    return o >= 0.8 ? 3 : o >= 0.5 ? 2 : 1;
  }
  // gün ayarı (6. tur → 10. tur): sipariş hep SIPARIS0. Gün saatle biter (sure), tezgâhta hep sira (3) müşteri;
  // boşalan yere aralik (3–5 sn) sonra yenisi, günün ilk üçü ilkGelis saniyelerinde. musteri: o süreye sığan
  // yaklaşık müşteri (yalnız gösterim/eski kod için; gün müşteri sayısıyla bitmez).
  function gun6(d, up) {
    var g = gun(d, up, []);
    up = U(up);
    var z = zg(d);
    g.sure = gunSure(d);
    g.sira = AYAR.sira10;
    g.aralik = AYAR.aralik10.slice();
    g.ilk = AYAR.ilkGelis.slice();
    g.yanOlas = 1;
    g.izgara = izgaraGoz(up);
    var taban = Math.max(AYAR.sabir10Min, AYAR.sabir10 - AYAR.sabir10Adim * (z - 1));
    var ilkGun = (d | 0) <= 1 ? AYAR.ilkGunSabir : 1;
    // sonradan açılan malzeme (öneri) siparişe girerse katman başına sabirKatman eklenir
    g.sabirSiparis = function (s) {
      var ek = Math.max(0, kats(s || SIPARIS0).length - SIPARIS0.katmanlar.length) * AYAR.sabirKatman;
      return tam((taban + ek) * ilkGun * (1 + AYAR.sabirUp * up.pat));
    };
    g.siparisSabir = g.sabirSiparis(SIPARIS0);
    g.sabir = g.siparisSabir;
    g.musteri = Math.round(g.sure / 9);
    return g;
  }

  BU.VERI = {
    MALZEME: MALZEME, SATIN_SIRA: SATIN_SIRA, STOK_MAX: STOK_MAX, KAT_MAX: KAT_MAX, GELISTIR: GELISTIR, AYAR: AYAR,
    BASLANGIC: BASLANGIC, KAPANIS_GUN: KAPANIS_GUN, SIFIRLA: SIFIRLA,
    acik: acik, eskiSahip: eskiSahip, siradaki: siradaki, fiyatAc: fiyatAc, alabilir: alabilir,
    kira: kira, gunSonu: gunSonu, SATILIK: SATILIK, cookIade: cookIade,
    maliyet: maliyet, katmanMaliyet: katmanMaliyet, katmanSatis: katmanSatis, fiyat: fiyat, bahsis: bahsis,
    ruh: ruh, yuz: yuz, dogruMu: dogruMu, odeme: odeme, gun: gun, sabirSiparis: sabirSiparis,
    siparis: siparis, pisme: pisme,
    // 5. tur
    YAN: YAN, YAN_STOK_MAX: YAN_STOK_MAX, IZGARA_MAX: IZGARA_MAX,
    yanMi: yanMi, acikKatman: acikKatman, acikYan: acikYan, yanOlas: yanOlas, izgaraGoz: izgaraGoz,
    siparisTam: siparisTam, yanPisme: yanPisme, yeniDurum: yeniDurum, eksikParca: eksikParca,
    teslimParca: teslimParca, odemeTam: odemeTam,
    // 6. tur
    MUTFAK: MUTFAK, MUTFAKTA: MUTFAKTA, GELECEK: GELECEK, SIPARIS0: SIPARIS0, mutfaktaMi: mutfaktaMi, izgaraPisme: izgaraPisme,
    fritozPisme: fritozPisme, siparis6: siparis6, koyKarar: koyKarar, gun6: gun6,
    // 10. tur
    zg: zg, gunSure: gunSure, yildiz: yildiz
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BU.VERI;
})(typeof window !== 'undefined' ? window : globalThis);
