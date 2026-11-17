/* b001 — katman 'arazi' (sıra 10). Arazi yontucusu. Plan: tasarim/b001/TASARIM.md § 10-A (A1…A13) · Kılavuz: tasarim/KILAVUZ.md
   Bu dosyada: orta ve küçük ölçekli arazi karakteri. Büyük formlar bolge.js'tedir; burada onlara yar, kayalık, geçit, oluk ve tümsek eklenir.

   KURALLAR (bu dosyanın kendi kuralları; değiştirirken koruyun):
   · Her yar bir yamacın üstünde ya da su kıyısındadır; iki ucu `uc` ile söner ve uçlardan dolaşılır. Hiçbir yar bir ilgi noktasını kapatmaz.
   · Yar iki biçimde kurulur: 'kes' (dibi oyar: dipte seki kalır, tepe çizgisi değişmez) ve 'yukselt' (kenarı kaldırır: üstte düz omuz olur).
     Kenarın arkasında yerleşim/manzara varsa ağırlık 'kes'tedir (arkadaki görüşü kapatan dudak oluşmasın).
   · Patika çizgilerinin (su.js) 8 m yanına dik yüz ve kaya çıkıntısı konmaz: yarlar patikanın geçtiği yerde KESİKTİR (Yar: P7 ve P6 uçları; Kartal: P12 gediği).
   · Kapalı alanlar: doğuşun 40 m çevresi, yerleşim daireleri + 25 m, göl çokgeni + 30 m, ırmak yatakları, sınırdan içeri 150 m.
   · Tümsekler bağımsız koni değildir: yayvan (yarıçap ≥ 8 × yükseklik), uzun eksenli ve bir yamaca / kıyıya / sırta yaslanır; hepsi farklı boydadır.
   · `vadi` + `kot` kullanılan yerde (Bel) bütün noktalarda AYNI kot vardır (değişken kot köşede basamak bırakır). Rampalar göreli derinlikli `oluk`tur. */
(function () {
  const T = SO.tasarim;
  // yar: batıdan doğuya / kuzeyden güneye çizilen çizgi için yüksek yan `yan` ile verilir
  const yar = (ad, cizgi, yan, H, ek) => Object.assign({ tip: 'ucurum', ad, cizgi, yan, yukseklik: H, genislik: 8, puruz: 5 }, ek || {});
  const kaya = (ad, x, z, r, h, ek) => Object.assign({ tip: 'kaya_cikinti', ad, merkez: [x, z], yaricap: r, yukseklik: h }, ek || {});
  const tumsek = (ad, x, z, r, h, aci, ek) => Object.assign({ tip: 'tepe', ad, merkez: [x, z], yaricap: r, aci: aci || 0, yukseklik: h, profil: 'yuvarlak', puruz: .3 }, ek || {});

  T.bolge({
    id: 'b001', katman: 'arazi',
    sekiller: [
      /* ============ A1 · YAR UÇURUMU ============
         Yar burnunun kuzey kenarı. Aynı çizgide iki ilkel: 'kes' dibi 9 m oyar (dipte 20–25 m'lik döküntü sekisi), 'yukselt' kenarı 8 m kaldırır
         (üst kenar ≈ 56 m: yerlesim.js'in 60 m'lik platosuna yumuşak bağlanır). Toplam yüz 22–26 m. Batı ucu x 1104'te başlar (P7 keçi yolu x ≈ 1095'te
         kenarı aşar), doğu ucu x 1338'de biter (P6 rampası). Uçlar 36 m'de söner. */
      yar('Yar (dip)', [[1104, 1362], [1135, 1353], [1175, 1348], [1215, 1345], [1255, 1347], [1292, 1353], [1338, 1372]], 'sag', 7, { kip: 'kes', etki: 24, uc: 36, kayalar: 24 }),
      yar('Yar (kenar)', [[1104, 1362], [1135, 1353], [1175, 1348], [1215, 1345], [1255, 1347], [1292, 1353], [1338, 1372]], 'sag', 9, { etki: 40, uc: 36 }),
      kaya('Yar payandası', 1242, 1336, 12, 6),   // dipte, yüzden kopmuş kaya kulesi
      kaya('Yar batı payandası', 1160, 1342, 10, 5),
      { tip: 'oluk', ad: 'Yar çatlağı', profil: 'v', puruz: .3, kivrim: 2, cizgi: [[1272, 1372, .5, 8], [1275, 1356, 5, 10], [1278, 1340, 3, 10], [1281, 1326, .3, 8]] },   // yüzü bölen dik oluk (yol değil; çizgiyi kırar)

      /* ============ A8 · KURU DERE ============
         Güney Boğazı ağzından Göl Başı'nın güneyine inen kuru yatak (su yok). Başı plandaki (1500,1440)'tan 20 m kuzeydoğuya alındı: orası P1'in tam
         üstüydü. P1'i (1405,1298) dolayında bir kez keser. Göl Başı dairesine (r 63) ve göle girmeden (1346,1186)'da söner; kıyıya inişi gölün kendi
         etki alanı yapar. */
      { tip: 'oluk', ad: 'Kuru dere', profil: 'v', puruz: .3, kivrim: 5,
        cizgi: [[1534, 1450, .8, 9], [1502, 1416, 2, 10], [1464, 1372, 2.4, 11], [1436, 1338, 2.5, 11], [1412, 1300, 2.4, 11], [1375, 1250, 2.2, 12], [1354, 1214, 1.6, 11], [1346, 1186, .3, 9]] },

      /* ============ A2 · NAL TEPE ============ */
      // Doruk: bıçak sırtının üstünde 12 m çaplı durulur yer (anıt taş ve seyir noktası burada). 28 m doğusundaki boynuz (1830,540) 4–5 m daha yüksek kalır.
      { tip: 'duzluk', ad: 'Nal doruğu sahanlığı', alan: { daire: [1803, 556, 6] }, y: 176.5, kenar: 9, mikro: .5, bos: false },
      kaya('Nal boynuzu', 1838, 533, 11, 6),            // gerçek doruğun kaya tacı (uzaktan sivri siluet)
      kaya('Nal güney kayası', 1821, 586, 12, 6),       // doruğun altında, güney yüzünde
      kaya('Nal kuzey kayası', 1790, 521, 11, 5),       // kuzey omzunda (P9'a 25 m)
      // Güney yüzünde üç kesik kaya kuşağı (çanaktan ve ırmak yolundan "kayalık doruk" okunur). P8 batı sırtından çıkar: kuşaklar ona ≥ 30 m uzak.
      yar('Nal üst kuşak', [[1745, 708], [1790, 703], [1832, 706], [1872, 690], [1906, 662]], 'sol', 12, { etki: 40, uc: 34, kayalar: 10 }),
      yar('Nal alt kuşak', [[1672, 771], [1722, 769], [1772, 776], [1814, 772]], 'sol', 9, { etki: 34, uc: 30, kayalar: 8 }),
      yar('Nal doğu kuşağı', [[1842, 800], [1876, 776], [1903, 750], [1924, 722]], 'sol', 10, { etki: 34, uc: 28, kayalar: 6 }),
      // İğne kayalığı: sivriTas (1588,812) bunun üstünde durur. P8 kayalığın 14–19 m batısından dolanır.
      kaya('İğne kayalığı', 1591, 815, 12, 7),

      /* ============ A3 · KOVUK (gizli) ============
         Doruğun kuzeydoğu ardında, kuzey kolu ile ana sırt arasındaki sirkin dibi. Taban düzlenir (y 110); güneydoğusu yamaca oyulduğundan kayalık bir
         arka duvar oluşur, kuzeyi alçak bir kaya dudağıyla kapanır. Giriş: doruk sırtından inen oluk (≈ %38). */
      { tip: 'oluk', ad: 'Kovuk oluğu', profil: 'v', puruz: .3, kivrim: 4, cizgi: [[1828, 512, .3, 10], [1840, 480, 3, 13], [1853, 445, 3.5, 14], [1864, 415, 3, 13], [1871, 397, 1, 10]] },
      { tip: 'duzluk', ad: 'Kovuk tabanı', alan: { daire: [1876, 376, 17] }, y: 110, kenar: 22, mikro: .6, bos: false },
      { tip: 'sirt', ad: 'Kovuk dudağı', profil: 'yuvarlak', puruz: .4, kivrim: 3, cizgi: [[1850, 374, 1.5, 12], [1861, 355, 5, 14], [1880, 347, 6, 14], [1899, 354, 4, 13], [1908, 366, 1, 11]] },
      kaya('Kovuk doğu duvarı', 1903, 392, 11, 5),

      /* ============ A4 · KARTAL KAYASI ============
         Kuzey yüzü iki parça yar ('kes': doruk çizgisi sivri kalır, dipte seki oluşur). Aradaki 40 m'lik gedikten P12 (x ≈ 1120) doruğa çıkar. */
      yar('Kartal yüzü batı', [[1008, 1608], [1034, 1602], [1066, 1598], [1100, 1594]], 'sag', 9, { kip: 'kes', etki: 22, uc: 24, kayalar: 8 }),
      yar('Kartal yüzü doğu', [[1142, 1600], [1176, 1605], [1206, 1614]], 'sag', 8, { kip: 'kes', etki: 22, uc: 22, kayalar: 6 }),
      kaya('Kartal tacı', 1094, 1634, 11, 6),

      /* ============ A5 · ORTA SIRT ============ */
      kaya('Orta Sırt başlığı', 780, 1130, 12, 5),      // doruk çizgisinde, seyir noktasının 45 m güneyi (P11'e 20 m)
      yar('Orta Sırt doğu yarı 1', [[838, 985], [833, 1008], [832, 1030], [840, 1068]], 'sag', 9, { etki: 28, uc: 26, kayalar: 6 }),
      yar('Orta Sırt doğu yarı 2', [[884, 1135], [891, 1158], [892, 1180], [885, 1207]], 'sag', 8, { etki: 24, uc: 24, kayalar: 5 }),
      // Bel: sırtı doğu–batı aşan geniş semer (eşik 44 m). Kot her noktada aynı. P11 doruk çizgisinden buraya iner ve batıya döner.
      { tip: 'vadi', ad: 'Bel', kot: 44, taban: .2, puruz: .3, kivrim: 8,
        cizgi: [[874, 1250, 44, 34], [846, 1257, 44, 50], [812, 1265, 44, 68], [782, 1279, 44, 54], [752, 1292, 44, 36]] },

      /* ============ A6 · ÇANAK AĞZI ============ */
      kaya('Çanak kapı kayası batı', 1792, 984, 17, 8),
      kaya('Çanak kapı kayası doğu', 1866, 1012, 16, 7),
      yar('Çanak kolu batı yarı', [[1612, 1082], [1605, 1105], [1604, 1128], [1608, 1160], [1602, 1192]], 'sol', 8, { etki: 26, uc: 28, kayalar: 7 }),

      /* ============ A7 · GÜNEY BOĞAZI ============ */
      // taban: iki alçak eşik ve bir çöküntü (P1 bunların üstünden hafifçe inip çıkar); yanlarda yamaç dibi kayalıkları
      tumsek('Boğaz eşiği 1', 1626, 1530, [36, 22], 2.2, 32),
      tumsek('Boğaz çöküntüsü', 1722, 1578, [28, 20], -1.8, 25),
      tumsek('Boğaz eşiği 2', 1756, 1598, [24, 30], 2, 20),
      kaya('Boğaz kuzey kayası', 1700, 1535, 13, 6),
      kaya('Boğaz güney kayası', 1690, 1598, 13, 6),
      // doğu inişi: eşiğin dudağını yarıp inişi 145 m'ye yayar (48 → 29 m, ≈ %13). Göreli derinlik: kot basamağı olmaz.
      { tip: 'oluk', ad: 'Boğaz doğu rampası', taban: .2, puruz: .25, kivrim: 5,
        cizgi: [[1770, 1604, 0, 28], [1792, 1613, 3, 34], [1815, 1622, 6.4, 38], [1838, 1634, 9.5, 40], [1858, 1644, 10.8, 40], [1870, 1650, 7.3, 38], [1881, 1656, 4.5, 34], [1900, 1665, 0, 28]] },

      /* ============ A9 · ÇANAK TÜMSEKLERİ ============ */
      tumsek('Eşik sırtı', 1278, 952, [34, 18], 3, 10),             // göl ile Dere Ağzı arasındaki alçak eşik (y1'den gölü gizler)
      tumsek('Doğu çayırı tümseği', 1540, 1040, [34, 24], 3, -30),
      tumsek('Kol dibi omzu', 1552, 1162, [30, 38], 4.5, 10),       // Çanak kolunun eteğinde
      tumsek('Göl güneyi tümseği', 1255, 1240, [38, 26], 3.5, 15),
      tumsek('Göl batısı tümseği', 1045, 1215, [42, 28], 4, -35),
      tumsek('Göl kuzeybatı tümseği', 1010, 1010, [30, 38], 4.5, 20),
      tumsek('Boğaz çayırı sırtı', 1120, 690, [30, 55], 4, 20),
      tumsek('Irmak kenarı tümseği', 1268, 650, [24, 40], 3, -25),
      tumsek('Boğaz batı tümseği', 1080, 548, [36, 26], 3.5, 40),
      tumsek('Kuzey dili tümseği', 1266, 296, [26, 32], 4, 0),
      { tip: 'cukur', ad: 'Doğu çayırı çukuru', alan: { daire: [1508, 1128, 14] }, derinlik: 1.4, kenar: 20, puruz: 3 },

      /* ============ A10 · KUZEY DİLİ ============ */
      kaya('Koru Tepesi başlığı', 1178, -272, 13, 5),
      yar('Koru yarı', [[1014, -262], [1009, -190], [1004, -120], [1007, -50], [1006, 0]], 'sol', 9, { etki: 70, uc: 40, kayalar: 14 }),
      kaya('Boğaz tümseği kayası', 1150, 425, 14, 5),

      /* ============ A11 · BATI TERASI ============ */
      // ırmağa bakan yar: 'kes' (teras kenarı yükselmez: terastan karşı yar manzarası açık kalır; dipte ırmak boyu alçak seki oluşur)
      yar('Teras yarı', [[455, 1040], [441, 1100], [431, 1160], [424, 1225], [420, 1290]], 'sol', 7, { kip: 'kes', etki: 72, uc: 40, kayalar: 12 }),
      tumsek('Teras tümseği 1', 610, 1080, [26, 38], 3, -10),
      tumsek('Teras tümseği 2', 540, 1232, [34, 24], 2.5, 30),
      tumsek('Teras tümseği 3', 650, 1322, [30, 40], 4, 35),

      /* ============ A12 · KISTAK ============ */
      yar('Kıstak yarı', [[2012, 892], [2026, 862], [2052, 822], [2078, 792]], 'sag', 8, { etki: 40, uc: 28, kayalar: 8 }),
      kaya('Kıstak payandası', 2036, 844, 13, 7),

      /* ============ A13 · YAMAÇ OMUZLARI ============ (yamaçtan inen kısa sırtçıklar; uçları sıfıra iner) */
      { tip: 'sirt', ad: 'Doğu yamacı omzu 1', profil: 'yuvarlak', puruz: .35, kivrim: 8, cizgi: [[2046, 1132, 3, 36], [2000, 1146, 7, 44], [1962, 1156, 6, 42], [1930, 1164, 1.5, 32]] },
      { tip: 'sirt', ad: 'Doğu yamacı omzu 2', profil: 'yuvarlak', puruz: .35, kivrim: 8, cizgi: [[2112, 1248, 3, 38], [2072, 1276, 7, 46], [2040, 1302, 5, 40], [2014, 1328, 1, 30]] },
      tumsek('Güney yamaç omzu', 1565, 1355, [46, 30], 5, 40),
      { tip: 'sirt', ad: 'Batı yamaç sırtçığı', profil: 'yuvarlak', puruz: .35, kivrim: 6, cizgi: [[956, 1502, 2, 32], [942, 1456, 6, 40], [927, 1408, 5, 36], [916, 1372, 1, 28]] },
      { tip: 'sirt', ad: 'Yar ardı sırtçığı', profil: 'yuvarlak', puruz: .35, kivrim: 6, cizgi: [[1386, 1560, 2, 34], [1380, 1520, 6, 38], [1373, 1482, 4, 34], [1368, 1452, .5, 26]] }
    ],
    alanlar: [],
    nesneler: [],
    noktalar: []
  });
})();
