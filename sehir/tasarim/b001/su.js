/* b001 — katman 'su' (sıra 20) + patika ağı (ayrı çağrı, sıra 32). Su ve patika uzmanı. Plan: tasarim/b001/TASARIM.md § 4, § 6, § 10-B · Kılavuz: tasarim/KILAVUZ.md
   Su yüzeyi her yerde y = 0'dır: yatak 0'ın altına iner. İki ırmak (Batı Irmağı, Nal Irmağı) prosedüreldir; bu dosya onlara yalnız üç sığlıkta dokunur.

   ÇAĞRI 1 (sıra 20): Ayna Göl + adacık + sazlık sahanlığı + kuzey burnu, Göl Ayağı deresi + iki atlama eşiği, üç sığ geçit (çakıl eşiği).
   ÇAĞRI 2 (sıra 32): 12 patika (yerleşim düzlüklerinden SONRA uygulanır; düzlüklerin kenarına oturur). */
(function () {
  const T = SO.tasarim;

  /* Sığ geçit eşiği: ırmağın ortasındaki (cx, cz) noktasında, akış yönü `akis` (pusula, derece) olan yatakta çakıl eşiği.
     kose: [[enine, boyuna], ...] metre (enine: akışa dik, bir kıyıdan ötekine; boyuna: akış yönünde). Çokgen yalnız su içinde kalır: kıyıyı oymaz. */
  function esik(ad, cx, cz, akis, kose) {
    const a = akis * Math.PI / 180, ux = Math.sin(a), uz = -Math.cos(a), vx = -uz, vz = ux;   // u: akış yönü, v: enine
    return { tip: 'duzluk', ad, y: -.25, kenar: 14, zemin: 'cakil', mikro: .25, alan: kose.map(q => [Math.round(cx + vx * q[0] + ux * q[1]), Math.round(cz + vz * q[0] + uz * q[1])]) };
  }

  /* ================================================= ÇAĞRI 1 · SU ================================================= */
  T.bolge({
    id: 'b001', katman: 'su',
    sekiller: [
      /* S1 · AYNA GÖL. Plandaki dokuz köşe korunur; aralarına kıyıyı doğallaştıran köşeler eklendi:
         kuzey kıyıda adacığa doğru uzanan alçak BURUN (1240,1045), doğu ucunda derenin çıktığı huni biçimli AYAK KOYU (1338,1048), güneyde iki sığ girinti.
         yamac .12 / etki 80: Göl Başı (y 4,5) ve doğuş sekisi alçalmaz. Doğu kıyı Ulu Çınar'ın (1345,1068) 12 m batısında kalır. */
      { tip: 'gol', ad: 'Ayna Göl', derinlik: 3.5, sahanlik: 8, inis: 14, etki: 80, yamac: .12, puruz: 3.5,
        alan: [[1105, 1075], [1120, 1050], [1140, 1030], [1176, 1017], [1208, 1012],
          [1224, 1014], [1233, 1046], [1247, 1047], [1256, 1018],                 // kuzey burnu (göl içine 30 m)
          [1290, 1020], [1318, 1031], [1339, 1047], [1331, 1064], [1318, 1080],   // ayak koyu (dere buradan çıkar)
          [1325, 1105], [1300, 1126], [1270, 1140], [1238, 1145], [1205, 1152], [1168, 1146], [1125, 1125], [1108, 1100]] },
      /* S2 · ADACIK: düz tepeli alçak ada (üstü ≈ +1,5 m; kıyısı ≈ 10 m yarıçap). Burnun ucundan ≈ 20 m, öteki kıyılardan 45–55 m yüzülerek çıkılır. */
      { tip: 'tepe', ad: 'Adacık', merkez: [1215, 1078], yaricap: [17, 14], aci: 20, yukseklik: 5, profil: 'plato', duz: .42, puruz: .25 },
      /* Kuzey burnu sırtı: gölün alçalttığı dili sudan 1 m kadar çıkarır (yerden bakınca "ada"ya uzanan parmak gibi okunur). */
      { tip: 'tepe', ad: 'Kuzey burnu', merkez: [1240, 1027], yaricap: [15, 24], aci: -6, yukseklik: 1.3, profil: 'yuvarlak', puruz: .2 },
      /* Sazlık sahanlığı: gölün batı ucu bel hizasının altında sığ (≈ 0,45 m): içinden yürünür, batı kıyısından kestirme. bos: false → bitki.js çalı/saz koyabilir. */
      { tip: 'duzluk', ad: 'Sazlık sahanlığı', y: -.45, kenar: 12, mikro: .5, bos: false,
        alan: [[1120, 1078], [1136, 1050], [1156, 1046], [1160, 1068], [1150, 1094], [1140, 1114], [1128, 1112]] },

      /* S3 · GÖL AYAĞI DERESİ: gölden ırmağa. 0,55 m derin: her yerinden yürünür (yavaşlatır). `sig` bilerek yok ("Dere geçidi" noktası bolge.js'te). */
      { tip: 'nehir', ad: 'Göl Ayağı', derinlik: .55, kiyi: 6, kiyiY: .6, etki: 45, yamac: .2, puruz: 2,
        cizgi: [[1330, 1050, 12], [1349, 1031, 9], [1368, 1010, 8], [1384, 984, 8], [1402, 962, 9], [1421, 941, 8], [1436, 918, 9], [1455, 900, 10], [1474, 884, 13]] },

      /* S4 · ÜÇ SIĞ GEÇİT. Prosedürel ırmak yatağı (≈ 2,7 m derin) çakıl eşiğiyle su yüzeyinin hemen altına (≈ −0,25 m) kaldırılır: ayak bileği derinliğinde,
         yürüyerek geçilir. Eşikler cetvel gibi değil: akışa hafif verev, ortada genişleyen düzensiz çokgen + su üstüne çıkan 2–3 çakıl adacığı (+0,2 m). */
      esik('Batı Sığlığı eşiği', 591, 791, 228, [[-15, -11], [-7, -15], [2, -11], [9, -14], [15, -12], [15, 10], [8, 15], [0, 11], [-7, 14], [-15, 12]]),
      { tip: 'tepe', merkez: [584, 783], yaricap: [8, 6], aci: 40, yukseklik: .75, puruz: .2 },
      { tip: 'tepe', merkez: [598, 800], yaricap: [6, 8], aci: 30, yukseklik: .7, puruz: .2 },

      esik('Dirsek Sığlığı eşiği', 1560, 894, 97, [[-30, -12], [-20, -16], [-8, -11], [6, -15], [19, -12], [30, -14], [30, 11], [20, 16], [9, 12], [-6, 17], [-19, 12], [-30, 13]]),
      { tip: 'tepe', merkez: [1565, 877], yaricap: [7, 10], aci: 10, yukseklik: .75, puruz: .2 },
      { tip: 'tepe', merkez: [1556, 911], yaricap: [6, 9], aci: -15, yukseklik: .7, puruz: .2 },

      esik('Nal Sığlığı eşiği', 1297, 479, 172, [[-32, -11], [-22, -15], [-10, -12], [4, -16], [17, -11], [32, -13], [32, 12], [22, 16], [10, 11], [-4, 15], [-17, 12], [-32, 14]]),
      { tip: 'tepe', merkez: [1280, 476], yaricap: [10, 7], aci: 5, yukseklik: .75, puruz: .2 },
      { tip: 'tepe', merkez: [1316, 483], yaricap: [9, 6], aci: -10, yukseklik: .7, puruz: .2 },

      /* Dere atlama eşikleri: patikanın dereyi geçtiği iki yerde çakıl eşiği (su ≈ 0,15 m: yavaşlatmaz). Patika derenin iki yakasında biter; eşik "buradan geçilir" der. */
      { tip: 'duzluk', ad: 'Dere geçidi eşiği', y: -.15, kenar: 5, zemin: 'cakil', mikro: .3, bos: false, alan: [[1398, 956], [1404, 950], [1413, 959], [1407, 966]] },
      { tip: 'duzluk', ad: 'Göl ayağı eşiği', y: -.15, kenar: 5, zemin: 'cakil', mikro: .3, bos: false, alan: [[1331, 1038], [1337, 1032], [1346, 1042], [1340, 1048]] }
    ],
    noktalar: [
      { id: 'k_ada', tur: 'kaynak', ad: 'Göl adacığı', x: 1215, z: 1078, yaricap: 10 }
    ]
  });

  /* ================================================= ÇAĞRI 2 · PATİKA AĞI (sıra 32) =================================================
     Ana yol 4,5 m, yan patika 3,6 m, ince iz 3 m (arazi ağı 4 m: daha darı görünmez). Her parça iki düğüm arasındadır; uçlar bolge.js düğüm/geçit
     koordinatlarında birebir buluşur. Irmak ve dere yatağına patika çizilmez: patika iki yakada biter, arada çakıl eşiği vardır. */
  const ANA = { genislik: 4.5, kenar: 4, toprak: .95, yumusat: 18 }, YAN = { genislik: 3.6, kenar: 3.5, toprak: .85, yumusat: 16 }, IZ = { genislik: 3, kenar: 3, toprak: .45, yumusat: 12 };
  const yol = (ad, tur, cizgi, ek) => Object.assign({ tip: 'patika', ad, cizgi }, tur, ek || {});

  T.bolge({
    id: 'b001', katman: 'su', sira: 32,
    sekiller: [
      /* P1 · ANA YOL (kuzey–güney omurga), kuzeyden güneye altı parça */
      yol('P1 Ana yol · Kuzey Boynu–Koru Açıklığı', ANA, [[1545, -400], [1472, -318], [1400, -230], [1328, -140], [1256, -68], [1195, -20]]),
      yol('P1 Ana yol · Koru Açıklığı–Boğaz çatalı', ANA, [[1195, -20], [1211, 60], [1219, 130], [1215, 200], [1206, 300], [1210, 400], [1200, 482], [1185, 560]]),
      yol('P1 Ana yol · Boğaz çatalı–Dere geçidi', ANA, [[1185, 560], [1220, 642], [1265, 730], [1322, 815], [1380, 905], [1393, 933], [1400, 952]]),
      yol('P1 Ana yol · Dere geçidi–Dirsek çatalı', ANA, [[1410, 963], [1426, 953], [1440, 940]]),
      yol('P1 Ana yol · Dirsek çatalı–Doğuş', ANA, [[1440, 940], [1442, 995], [1435, 1050], [1425, 1102], [1415, 1150], [1420, 1190]]),
      yol('P1 Ana yol · Doğuş–Yar rampası başı', ANA, [[1420, 1190], [1419, 1238], [1409, 1287], [1395, 1335]]),
      yol('P1 Ana yol · Yar rampası başı–Güney Boğazı', ANA, [[1395, 1335], [1452, 1402], [1520, 1462], [1592, 1516], [1680, 1562]]),
      yol('P1 Ana yol · Güney Boğazı–güneydoğu', ANA, [[1680, 1562], [1748, 1590], [1815, 1622], [1900, 1665], [1972, 1688], [2040, 1700]]),

      /* P2 · IRMAK YOLU (doğu): Dirsek çatalı → Dirsek Sığlığı başı → Çanak kavşağı → Kıstak → doğu */
      yol('P2 Irmak yolu · Dirsek çatalı–Çanak kavşağı', ANA, [[1440, 940], [1500, 949], [1560, 939], [1602, 947], [1680, 953], [1750, 952], [1832, 965]]),
      yol('P2 Irmak yolu · Çanak kavşağı–Kıstak–doğu', ANA, [[1832, 965], [1884, 951], [1930, 925], [1968, 890], [2000, 852], [2030, 812], [2060, 770], [2102, 706], [2140, 640]]),

      /* P3 · ÇANAK PATİKASI (gizli): ilk 40 m neredeyse görünmez */
      yol('P3 Çanak patikası · kavşak–ağız (silik)', IZ, [[1832, 965], [1830, 985], [1825, 1005]], { toprak: .25 }),
      yol('P3 Çanak patikası · ağız–Saklı Çanak', YAN, [[1825, 1005], [1813, 1040], [1800, 1080], [1789, 1108], [1782, 1124]], { toprak: .7 }),

      /* P4 · GÖL–BATI YOLU: Seki altı → Göl Başı kenarı → Ulu Çınar → göl ayağı | Göl kuzeyi → Sırt burnu → Sığlık Başı */
      yol('P4 Göl yolu · Seki altı–göl ayağı', YAN, [[1415, 1150], [1393, 1129], [1375, 1101], [1362, 1079], [1352, 1058], [1344, 1046]]),
      yol('P4 Göl yolu · göl ayağı–Göl kuzeyi', YAN, [[1332, 1034], [1290, 1008], [1215, 985]]),
      yol('P4 Göl yolu · Göl kuzeyi–Sırt burnu', YAN, [[1215, 985], [1130, 971], [1050, 965], [975, 916], [900, 865], [835, 812], [770, 770]]),
      yol('P4 Göl yolu · Sırt burnu–Sığlık Başı', YAN, [[770, 770], [724, 806], [680, 850], [622, 898], [586, 924]]),

      /* P5 · SIĞLIK KOLU (batı çıkışı) */
      yol('P5 Sığlık kolu · Sırt burnu–Batı Sığlığı', YAN, [[770, 770], [715, 777], [660, 790], [630, 800], [609, 808]]),
      yol('P5 Sığlık kolu · karşı kıyı', YAN, [[575, 775], [556, 756], [535, 735], [482, 712], [430, 700]]),

      /* P6 · YAR RAMPASI: sabit eğimli rampa; Yar'a yürünen tek rahat yol */
      yol('P6 Yar rampası', YAN, [[1395, 1335], [1352, 1395], [1290, 1428], [1245, 1426]], { rampa: true }),

      /* P7 · YAR KEÇİ YOLU (riskli kestirme) */
      yol('P7 Yar keçi yolu', IZ, [[1190, 1165], [1150, 1260], [1085, 1345], [1110, 1405], [1150, 1425]]),

      /* P13 · GÜNEY KIYI İZİ (plana ek): Göl Başı'ndan gölün güney kıyısı boyunca keçi yolunun başına; P7 ağa bağlansın diye. Sakin bölgede silik bir iz. */
      yol('P13 Güney kıyı izi', IZ, [[1338, 1150], [1300, 1156], [1262, 1164], [1224, 1169], [1190, 1165]], { toprak: .35 }),

      /* P8 · NAL PATİKASI (batı sırtından doruğa) */
      yol('P8 Nal patikası', YAN, [[1560, 856], [1561, 828], [1568, 801], [1590, 784], [1612, 776], [1642, 757], [1638, 734], [1647, 706], [1670, 707], [1667, 690], [1704, 676], [1699, 658], [1711, 650], [1745, 629], [1779, 608], [1800, 572], [1803, 556]]),

      /* P9 · NAL KUZEY KOLU: Boğaz çatalı → Nal Sığlığı | karşı kıyı → kuzey yamaç → doruk (P8 ile halka) */
      yol('P9 Nal kuzey kolu · Boğaz çatalı–Nal Sığlığı', YAN, [[1185, 560], [1222, 518], [1255, 481]]),
      yol('P9 Nal kuzey kolu · karşı kıyı–doruk', YAN, [[1338, 478], [1400, 468], [1470, 455], [1535, 432], [1590, 440], [1640, 462], [1700, 470], [1760, 470], [1796, 454], [1820, 491], [1812, 520], [1803, 556]]),

      /* P10 · BOĞAZ BATI KOLU: tümseğin batısından, Batı Irmağı kıyısından Koru Açıklığı'na */
      yol('P10 Boğaz batı kolu', YAN, [[1185, 560], [1126, 494], [1075, 420], [1051, 310], [1040, 200], [1042, 110], [1050, 20], [1092, -14], [1116, -28]]),

      /* P11 · SIRT PATİKASI: Orta Sırt'ın doruk çizgisi → Bel → Batı terası → Sığlık Başı (halka) */
      yol('P11 Sırt patikası · Sırt burnu–Bel', YAN, [[770, 770], [773, 832], [772, 895], [784, 990], [797, 1085], [806, 1176], [812, 1265]]),
      yol('P11 Sırt patikası · Bel–Sığlık Başı', YAN, [[812, 1265], [758, 1290], [700, 1300], [626, 1246], [560, 1180], [551, 1060], [558, 984]]),

      /* P12 · KARTAL İZİ (silik) */
      yol('P12 Kartal izi', IZ, [[1195, 1456], [1215, 1490], [1234, 1525], [1248, 1590], [1236, 1636], [1200, 1640], [1152, 1630], [1112, 1624]], { toprak: .4 })
    ],
    noktalar: [
      { id: 'd_canak', tur: 'dugum', ad: 'Çanak kavşağı', x: 1832, z: 965 },
      { id: 'd_ayak', tur: 'dugum', ad: 'Göl ayağı', x: 1338, z: 1040 },
      { id: 'd_bel', tur: 'dugum', ad: 'Bel', x: 812, z: 1265 }
    ]
  });
})();
