/* b001 — katman 'bitki' (sıra 40): korular, açıklıklar, çalılıklar, zemin dokusu, bilinçli tek ağaçlar. Kılavuz: tasarim/KILAVUZ.md · Plan: TASARIM.md § 8 ve § 10-D
   Sahibi: bitki ve işaret uzmanı. Bölgede `varsayilan: 0` olduğundan bölgenin BÜTÜN bitki örtüsü bu dosyadadır.

   Kompozisyon ilkeleri (neden orada?):
   · Ağaç yalnız bir nedenle durur: ırmak/dere/göl kıyısı (K11), yamaç eteği ve yamaç (K3, K6, K7, K10), kuzey dili ormanı (K1), tepecik (K2), uçurum ardı (K5).
   · Orman kenarı üç kademelidir: önde çalı + genç ağaç kuşağı (`kusak`), sonra `kenar` ile seyrelen dış halka, içeride tam yoğunluk. Kuşak yalnız oyuncunun
     gördüğü, patikaya/çayıra bakan kenarlara konur.
   · Dört çayır (Boğaz, Doğu, göl güneyi, Batı terası ortası) bilerek ağaçsızdır; kenarlarını koru ve kıyı şeritleri çizer.
   · Doğuşun ilk karesi (0–30°, 120 m) ve doğuş → İğne / Ulu Çınar / Yar dişi görüş çizgileri ağaçsızdır.
   · Her korunun kimliği var: tür karışımı, boy, kümelenme farklıdır (aşağıda koru koru yazıldı).
   Sıra notu: üst üste binen serpme alanlarının yoğunlukları toplanır; `aciklik` her zaman kazanır (ağaç + çalıyı keser). */
(function () {
  const T = SO.tasarim;

  /* ---------- yardımcılar ---------- */
  // çizgiyi şeride çevirir: yürüyüş yönünün soluna `sol`, sağına `sag` metre açılan çokgen (kıyı şeritleri ve orman kenarı kuşakları için)
  function serit(c, sol, sag) {
    const n = c.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], u = Math.hypot(dx, dz) || 1;
      const nx = dz / u, nz = -dx / u;   // sol normal
      L.push([Math.round(c[i][0] + nx * sol), Math.round(c[i][1] + nz * sol)]); R.push([Math.round(c[i][0] - nx * sag), Math.round(c[i][1] - nz * sag)]);
    }
    return L.concat(R.reverse());
  }
  const dilim = (c, x0, z0, x1, z1) => c.filter(p => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1);

  /* ---------- kıyı çizgileri (araziden ölçüldü: y = 0,7 eğrisi, 40 m'de bir) ---------- */
  // Batı Irmağı'nın doğu (bizim) kıyısı, kuzeyden güneye. İç = sol.
  const BATI = [[1013, -384], [1001, -343], [993, -301], [989, -263], [985, -226], [981, -188], [977, -150], [974, -113], [972, -75], [971, -37], [970, 1], [971, 44], [973, 86], [977, 129], [981, 172], [985, 214], [991, 259], [995, 301], [1001, 342], [1004, 384], [1001, 424], [976, 499], [954, 533], [929, 565], [902, 596], [877, 628], [834, 669], [805, 692], [773, 712], [740, 731], [703, 750], [670, 769], [635, 786], [605, 805], [572, 827], [541, 851], [513, 878], [485, 904], [456, 936], [429, 969], [404, 1002], [380, 1038], [359, 1077], [345, 1119], [342, 1163], [346, 1208], [353, 1245], [361, 1283], [371, 1320], [385, 1356]];
  // Nal Irmağı'nın batı/güney (bizim) kıyısı, kuzeyden akış yönünde. İç = sağ.
  const NALB = [[1531, -95], [1520, -55], [1515, -12], [1510, 32], [1494, 68], [1473, 101], [1448, 132], [1420, 163], [1397, 192], [1373, 221], [1351, 251], [1329, 281], [1306, 317], [1286, 350], [1271, 385], [1262, 422], [1257, 484], [1266, 523], [1284, 562], [1305, 602], [1320, 635], [1331, 669], [1343, 704], [1357, 745], [1373, 784], [1391, 822], [1427, 869], [1463, 896], [1503, 914], [1559, 927], [1594, 935], [1628, 940], [1663, 947], [1707, 951], [1744, 943], [1782, 942], [1820, 943], [1875, 927], [1911, 903], [1944, 875], [1974, 842], [2003, 801]];
  // Nal Irmağı'nın doğu/kuzey (Nal Tepe) kıyısı. İç = sol.
  const NALD = [[1343, 416], [1335, 454], [1334, 477], [1336, 517], [1347, 557], [1357, 581], [1372, 614], [1386, 647], [1396, 670], [1414, 709], [1434, 745], [1458, 779], [1465, 786], [1498, 819], [1535, 843], [1561, 857], [1596, 870], [1631, 882], [1665, 891], [1700, 898], [1739, 905], [1777, 905], [1814, 897], [1852, 884], [1888, 862], [1922, 835], [1953, 802]];

  // Batı Irmağı'nın batı (karşı) kıyısı, kuzeyden güneye. İç = sağ. (Geçiş bandında; bölge dışı prosedürel ormana dikiş)
  const BATIK = [[956, -268], [944, -193], [936, -118], [931, -42], [931, 39], [931, 123], [930, 208], [928, 291], [917, 371], [893, 446], [853, 516], [809, 584], [762, 644], [705, 693], [643, 735], [579, 779], [548, 803], [518, 828], [461, 885], [405, 949], [348, 1025], [308, 1113], [304, 1157], [306, 1202], [311, 1254]];
  // Nal Irmağı'nın doğu kıyısının kuzey parçası (Nal'ın kuzeybatı eteği). İç = sol.
  const NALDK = [[1605, 0], [1597, 41], [1578, 76], [1554, 107], [1528, 137], [1502, 167], [1476, 195], [1452, 223], [1429, 252], [1406, 282], [1386, 312], [1369, 344], [1354, 379]];

  const A = [], N = [];   // alanlar, nesneler
  const koru = (ad, alan, yogunluk, turler, ek) => A.push(Object.assign({ tip: 'koru', ad, alan, yogunluk, turler }, ek || {}));
  const serpme = (ad, alan, yogunluk, turler, ek) => A.push(Object.assign({ tip: 'serpme', ad, alan, yogunluk, turler }, ek || {}));
  const cali = (ad, alan, yogunluk, ek) => A.push(Object.assign({ tip: 'cali_alani', ad, alan, yogunluk }, ek || {}));
  const acik = (ad, alan, kenar) => A.push({ tip: 'aciklik', ad, alan, kenar: kenar == null ? 10 : kenar });
  const zemin = (ad, alan, v, kenar) => A.push(Object.assign({ tip: 'zemin', ad, alan, kenar: kenar == null ? 8 : kenar }, v));
  // orman kenarı kuşağı: önde çalı, arada genç (kısa) ağaç. Çizgi orman sınırının üstünden geçer; `dis` çayıra, `ic` ormana doğru genişlik.
  const KUSAK = { cali: 3, yaprakli2: 1 };
  const kusak = (ad, cizgi, dis, ic, yog, turler) => A.push({ tip: 'serpme', ad: ad || '', alan: serit(cizgi, dis, ic), yogunluk: (yog || .16) * 1.9, turler: turler || KUSAK, boy: [.55, .95], kenar: 5, kume: .55, puruz: 5 });

  /* =====================================================================================================
     K1 · ULU KORU (kuzey dili). Kimlik: yaşlı, koyu yapraklı orman; çekirdekte iri gövdeler; Koru Tepesi'nde çam karışır.
     Güney kenarı Boğaz'da P1'e doğru HUNİ yapar: iki kanat kıyılardan patikanın ormana girdiği noktaya (1210, 212) doğru geri çekilir.
     ===================================================================================================== */
  const ULU = [[1002, 300], [1062, 282], [1120, 252], [1172, 226], [1203, 208], [1222, 208], [1256, 232], [1300, 262], [1338, 266],
    [1375, 212], [1412, 166], [1440, 132], [1466, 98], [1488, 60], [1498, 20], [1500, -30], [1492, -90], [1470, -160], [1452, -230], [1440, -300], [1420, -380], [1380, -440], [1300, -468], [1180, -470], [1080, -455], [1030, -400],
    [1010, -340], [1000, -263], [992, -150], [985, -40], [986, 86], [996, 214]];
  const ULUC = [[1050, -190], [1120, -215], [1230, -200], [1330, -170], [1400, -110], [1420, -30], [1395, 50], [1330, 120], [1262, 190], [1215, 204], [1180, 190], [1150, 150], [1060, 80], [1030, -20], [1030, -120]];
  koru('Ulu Koru', ULU, .12, { yaprakli1: 3, yaprakli2: 1.2 }, { kenar: 20, kume: .7, puruz: 10, boy: [.95, 1.5] });
  // çekirdek: açıklığın ve tepenin güney/doğu yamacının çevresi: bölgenin en sık yeri (toplam ≈ .42)
  koru('Ulu Koru çekirdeği', ULUC, .3, { yaprakli1: 4, yaprakli2: 1 }, { kenar: 30, kume: .15, puruz: 10, boy: [1.15, 1.75] });
  // Koru Tepesi: yukarı çıktıkça çam (tepede ≈ %35)
  koru('Koru Tepesi çamları', { daire: [1195, -290, 135] }, .09, { cam1: 1 }, { kenar: 60, kume: .5, puruz: 12, boy: [1.0, 1.5] });
  // açıklıklar: Koru Açıklığı (düzlükten geniş; kuzey ucu Ata ağacına uzanır), P1 boyunca iki ışık havuzu, tepe seyri
  acik('Koru Açıklığı', [[1083, -42], [1098, -84], [1136, -100], [1166, -114], [1196, -128], [1216, -108], [1213, -62], [1224, -12], [1206, 32], [1160, 46], [1110, 34], [1086, 2]], 14);
  acik('Güney ışık havuzu (P1)', { daire: [1222, 112, 13] }, 10);
  acik('Kuzey ışık havuzu (P1)', [[1300, -150], [1330, -165], [1352, -150], [1345, -122], [1315, -112], [1296, -128]], 12);
  acik('Koru Tepesi seyri', { daire: [1198, -290, 17] }, 10);
  // huni kuşakları (Boğaz'dan gelen oyuncunun gördüğü güney kenar) ve açıklık kenarı böğürtlenleri
  kusak('Ulu Koru güney kenarı (batı kanat)', [[1000, 310], [1062, 290], [1120, 260], [1172, 233], [1200, 214]], 14, 12, .2);
  kusak('Ulu Koru güney kenarı (doğu kanat)', [[1226, 214], [1256, 238], [1300, 268], [1340, 274]], 12, 14, .2);
  kusak('Açıklık kenarı (batı–güney)', [[1080, -50], [1082, 4], [1108, 40], [1160, 52], [1208, 38]], 4, 14, .22, { cali: 1 });
  kusak('Açıklık kenarı (doğu)', [[1228, -10], [1218, -62], [1222, -108]], 12, 4, .2, { cali: 1 });
  // Kuzey Boynu'na çıkış: orman doğu kenarından sonra seyrek öbekler (P1'in iki yanı), boyun açık kalır
  koru('Kuzey Boynu öbekleri', [[1452, -250], [1500, -200], [1560, -150], [1620, -130], [1670, -170], [1700, -230], [1690, -330], [1650, -420], [1590, -480], [1500, -490], [1440, -440], [1436, -340]], .1, { yaprakli1: 1, cam1: 1, cali: .5 }, { kenar: 22, kume: .9, puruz: 12 });
  acik('Kuzey Boynu eşiği (yol ağzı açık)', { daire: [1545, -400, 26] }, 14);

  /* =====================================================================================================
     K2 · GÖL TEPECİĞİ KORUSU. Kimlik: açık renk, ferah yapraklı koru (yaprakli2 ağırlıklı), bol çalı; gölü Boğaz'dan ve Dere Ağzı'ndan perdeler.
     Güney eteği P4'ün ötesinde göl kıyısına iner (kuzeybatı koyu).
     ===================================================================================================== */
  const GOLT = [[1072, 884], [1098, 838], [1158, 816], [1232, 828], [1278, 866], [1276, 912], [1244, 948], [1182, 960], [1112, 946], [1080, 918]];
  koru('Göl Tepeciği korusu', GOLT, .3, { yaprakli2: 3, yaprakli1: 1, cali: .8 }, { kenar: 20, kume: .45, puruz: 8 });
  kusak('Göl Tepeciği doğu kenarı (Dere Ağzı yüzü)', [[1236, 824], [1284, 864], [1282, 916], [1248, 954]], 12, 8, .2);
  kusak('Göl Tepeciği güney kenarı (P4 yüzü)', [[1244, 956], [1182, 968], [1110, 952]], 6, 10, .16);
  serpme('Tepecik eteği: göle inen dil', [[1118, 990], [1150, 984], [1186, 992], [1190, 1014], [1150, 1024], [1118, 1040], [1100, 1066], [1088, 1050], [1096, 1012]], .26, { yaprakli2: 2, cali: 2, yaprakli1: 1 }, { kenar: 8, kume: .4 });

  /* =====================================================================================================
     K3 · ORTA KORU (Orta Sırt'ın iki yamacı). Kimlik: yamaç ormanı; etekte yapraklı, sırt çizgisinde çam; doğu eteği göle doğru öbek öbek seyrelir.
     Kuzey ucu P4'e (göl–batı yolu) açılır: sırtın burnu çıplak kalır, yol ormanın ağzından geçer.
     ===================================================================================================== */
  const ORTA = [[728, 872], [762, 846], [806, 852], [846, 880], [878, 916], [908, 968], [926, 1040], [936, 1120], [930, 1200], [916, 1290], [904, 1366], [878, 1420], [838, 1440], [790, 1422],
    [748, 1378], [722, 1320], [706, 1250], [692, 1150], [686, 1050], [694, 950], [708, 898]];
  koru('Orta Koru', ORTA, .33, { yaprakli1: 2, yaprakli2: 1.5 }, { kenar: 24, kume: .4, puruz: 10 });
  koru('Orta Sırt çamları', serit([[768, 880], [786, 1000], [798, 1100], [806, 1200], [816, 1290], [836, 1390]], 38, 38), .13, { cam1: 1 }, { kenar: 22, kume: .5, boy: [.95, 1.45] });
  acik('Orta Sırt seyri', { daire: [797, 1086, 17] }, 9);
  koru('Orta Koru doğu eteği (göle doğru seyrelme)', [[930, 1010], [990, 990], [1050, 1010], [1082, 1060], [1078, 1120], [1040, 1160], [980, 1175], [930, 1150]], .11, { yaprakli1: 1, yaprakli2: 2 }, { kenar: 30, kume: .85, puruz: 10 });
  kusak('Orta Koru doğu kenarı', [[850, 876], [884, 916], [914, 968], [932, 1040], [942, 1120], [936, 1200], [922, 1290]], 14, 10, .15);
  kusak('Orta Koru kuzey ağzı (P4)', [[712, 890], [730, 866], [762, 840], [808, 846], [850, 876]], 12, 8, .2);
  kusak('Orta Koru batı kenarı (teras yüzü)', [[700, 1250], [686, 1150], [680, 1050], [688, 950]], 8, 12, .14);

  /* =====================================================================================================
     K4 · SEKİ KORUSU (doğuşun doğu–güneydoğusu, yamaç dibi). Kimlik: küçük, aydınlık ilk koru: oyuncunun ilk odunu. En yakın ağaç doğuşa ≈ 20 m.
     Öndeki üç ağaç elle kondu (ilk karenin sağ çerçevesi); gerisi serpme. Doğuşun 9 m çevresi ve 0–30° koridoru boş.
     ===================================================================================================== */
  koru('Seki korusu', [[1446, 1150], [1472, 1146], [1502, 1172], [1522, 1214], [1528, 1262], [1502, 1280], [1478, 1258], [1462, 1226], [1450, 1196], [1443, 1170]], .42, { yaprakli1: 1.2, yaprakli2: 1 }, { kenar: 6, kume: .1, puruz: 4 });
  N.push({ id: 'seki1', tur: 'yaprakli2', x: 1436, z: 1175, s: 1.25, ry: 1.1 },    // doğuştan 22 m, 47°: ilk karenin sağ kenarı
    { id: 'seki2', tur: 'yaprakli1', x: 1442, z: 1189, s: 1.05, ry: 2.6 },          // 22 m, doğu
    { id: 'seki3', tur: 'yaprakli1', x: 1439, z: 1206, s: 1.35, ry: .4 },           // 25 m, güneydoğu
    { id: 'seki_c1', tur: 'cali', x: 1431, z: 1171, s: 1.0 }, { id: 'seki_c2', tur: 'cali', x: 1434, z: 1199, s: .9 }, { id: 'seki_c3', tur: 'cali', x: 1445, z: 1163, s: 1.1 });
  // doğuşun güneybatısında lif/böğürtlen: ilk çalılık (koridorun dışında, 25–40 m)
  cali('Doğuş çalılığı', [[1380, 1206], [1398, 1200], [1404, 1218], [1396, 1238], [1376, 1236], [1370, 1220]], .5, { kenar: 4, kume: .2 });

  /* =====================================================================================================
     K5 · YAR ARDI ÇAMLIĞI. Kimlik: koyu, düzenli çam (Yar Sekisi'nin arka duvarı, Kartal izinin girişi). Sekinin kuzey kenarı (manzara) açık.
     ===================================================================================================== */
  koru('Yar ardı çamlığı', [[1086, 1474], [1128, 1464], [1180, 1478], [1240, 1474], [1298, 1458], [1340, 1472], [1336, 1530], [1292, 1566], [1220, 1582], [1150, 1578], [1096, 1548]], .3, { cam1: 4, yaprakli1: .7 }, { kenar: 16, kume: .3, boy: [1.0, 1.55] });
  kusak('Çamlık kuzey kenarı (seki yüzü)', [[1090, 1468], [1130, 1458], [1180, 1472], [1240, 1468], [1300, 1452]], 6, 8, .14, { cali: 3, cam1: 1 });

  /* =====================================================================================================
     K6 · ÇANAK ORMANI (Çanak kolunun sırtı + Saklı Çanak'ın iç yamaçları; taban açık). Kimlik: karışık, sık, "duvar" gibi: çanağı saklayan perde.
     Hilal biçimli; ağız (KD) kapı kayalarıyla açık, ama iki yanındaki çalılar patikanın ayrılışını örter.
     ===================================================================================================== */
  const CANAK = [[1604, 1334], [1592, 1250], [1596, 1160], [1614, 1086], [1652, 1026], [1702, 986], [1746, 964], [1776, 962],
    [1772, 1002], [1738, 1040], [1714, 1090], [1706, 1150], [1712, 1210], [1736, 1256], [1772, 1282], [1822, 1292], [1852, 1322], [1800, 1352], [1720, 1362], [1660, 1376], [1622, 1366]];
  koru('Çanak ormanı', CANAK, .36, { yaprakli1: 1.2, yaprakli2: 1, cam1: .9 }, { kenar: 20, kume: .35, puruz: 8 });
  acik('Saklı Çanak tabanı', [[1740, 1090], [1772, 1070], [1808, 1078], [1832, 1110], [1836, 1160], [1820, 1204], [1784, 1226], [1746, 1214], [1724, 1176], [1722, 1128]], 14);
  kusak('Çanak kolu batı kenarı (Doğu çayırı yüzü)', [[1600, 1300], [1588, 1250], [1592, 1160], [1610, 1086], [1648, 1024], [1698, 982]], 14, 10, .15);
  kusak('Çanak içi kenar (böğürtlen)', [[1728, 1098], [1716, 1150], [1722, 1200], [1746, 1236], [1786, 1244]], 4, 12, .2, { cali: 1 });
  cali('Çanak ağzı batı çalılığı', [[1778, 962], [1806, 958], [1812, 986], [1800, 1008], [1780, 1000]], .4, { kenar: 5 });
  cali('Çanak ağzı doğu çalılığı', [[1848, 984], [1874, 990], [1880, 1022], [1856, 1034], [1842, 1016]], .4, { kenar: 5 });

  /* =====================================================================================================
     K7 · GÜNEY YAMAÇ KORULARI. Kimlik: öbek öbek karışık yamaç koruluğu (kume yüksek), aralarında otlu boşluklar; yukarı doğru çam artar.
     ===================================================================================================== */
  koru('Güney yamaç korusu (doğu: rampa–boğaz arası)', [[1404, 1298], [1470, 1288], [1560, 1300], [1628, 1332], [1642, 1400], [1602, 1442], [1530, 1432], [1470, 1402], [1422, 1360]], .25, { yaprakli1: 1, yaprakli2: 1, cam1: 1 }, { kenar: 18, kume: .7, puruz: 9 });
  koru('Güney yamaç korusu (batı: Kartal altı)', [[858, 1402], [930, 1386], [1000, 1396], [1050, 1432], [1046, 1500], [1010, 1556], [940, 1566], [880, 1532], [854, 1462]], .25, { yaprakli1: 1, cam1: 1.6 }, { kenar: 18, kume: .7, puruz: 9 });
  // güney sırtının üst yamacı: bölge dışındaki prosedürel ormana geçiş (seyrek, öbekli çam). Geçiş bandında kendiliğinden silikleşir.
  koru('Güney sırtı çamları (batı)', [[640, 1600], [760, 1560], [900, 1580], [1000, 1680], [1120, 1700], [1280, 1720], [1420, 1640], [1490, 1570], [1560, 1610], [1640, 1650], [1760, 1700], [1860, 1740], [1800, 1820], [1560, 1840], [1300, 1860], [900, 1840], [640, 1780]], .08, { cam1: 3, yaprakli1: 1 }, { kenar: 30, kume: .85, puruz: 12 });
  koru('Güney sırtı çamları (doğu: boğazın kuzey omzu)', [[1720, 1500], [1800, 1444], [1900, 1446], [2000, 1474], [2120, 1474], [2180, 1560], [2150, 1680], [2040, 1690], [1960, 1640], [1860, 1590], [1780, 1548]], .1, { cam1: 3, yaprakli1: 1 }, { kenar: 26, kume: .85, puruz: 12 });

  /* =====================================================================================================
     K8 · NAL TEPE. Kimlik: çıplak kayalık doruk; batı ve kuzey yamaçta rüzgâr yemiş seyrek çam öbekleri; güney yüz ve doruk AĞAÇSIZ; etekte söğütlük (K11).
     ===================================================================================================== */
  koru('Nal batı yamacı çamları', [[1404, 500], [1480, 478], [1580, 498], [1660, 556], [1688, 636], [1640, 700], [1560, 740], [1484, 720], [1424, 640]], .09, { cam1: 5, yaprakli1: 1 }, { kenar: 24, kume: .85, puruz: 10 });
  koru('Nal kuzey yamacı çamları', [[1440, 330], [1520, 262], [1640, 216], [1780, 214], [1850, 258], [1832, 318], [1760, 400], [1680, 440], [1560, 440], [1470, 410]], .1, { cam1: 5, yaprakli1: 1 }, { kenar: 26, kume: .85, puruz: 10 });
  acik('Nal doruğu ve güney yüzü', [[1700, 600], [1760, 530], [1830, 500], [1890, 520], [1930, 600], [1920, 700], [1860, 770], [1740, 780], [1680, 730], [1670, 660]], 20);
  // Kovuk (gizli çanak): kuzey–doğu kenarında koyu çam yayı + çalı; doruktan bakınca "ağaçla çevrili çukur" olarak okunur
  koru('Kovuk çam yayı', [[1846, 344], [1880, 330], [1918, 344], [1930, 380], [1916, 410], [1900, 396], [1904, 368], [1880, 354], [1856, 364]], .4, { cam1: 3, cali: 1 }, { kenar: 5, kume: .1, boy: [.9, 1.3] });

  /* =====================================================================================================
     K9 · BATI TERASI ÖBEKLERİ. Kimlik: her biri ayrı karakterde dört–beş küçük öbek; aralarında açık çayır teras (sakin bölge).
     ===================================================================================================== */
  koru('Teras öbeği: tümsek yanı', { daire: [628, 1062, 30] }, .34, { yaprakli2: 2, yaprakli1: 1, cali: 1 }, { kenar: 10, kume: .2 });
  koru('Teras öbeği: yar çamları', [[452, 1052], [476, 1046], [480, 1100], [468, 1150], [446, 1160], [440, 1100]], .34, { cam1: 3, cali: 1 }, { kenar: 7, kume: .2, boy: [.9, 1.5] });
  koru('Teras öbeği: güney tümsek', { daire: [548, 1250, 32] }, .32, { yaprakli1: 1, yaprakli2: 1, cam1: .6 }, { kenar: 10, kume: .2 });
  koru('Teras öbeği: sırt dibi', { daire: [660, 1336, 30] }, .32, { yaprakli1: 2, cali: 1 }, { kenar: 10, kume: .2 });
  koru('Sığlık Başı korusu (sırt eteği)', [[628, 880], [676, 874], [700, 920], [692, 978], [650, 994], [622, 950]], .42, { yaprakli1: 1, yaprakli2: 1.4 }, { kenar: 9, kume: .25 });
  cali('Sığlık Başı çalılığı', [[590, 1000], [626, 992], [640, 1016], [616, 1034], [588, 1024]], .4, { kenar: 5 });

  /* =====================================================================================================
     K10 · DOĞU YAMACI ORMANI. Kimlik: bölgenin "büyük, karanlık" yamaç ormanı; karışık, yukarıda çam ağır basar; doğuda bölge dışı ormana bağlanır.
     ===================================================================================================== */
  const DOGU = [[1884, 1034], [1932, 992], [2000, 962], [2080, 976], [2150, 1020], [2172, 1150], [2166, 1300], [2140, 1420], [2060, 1452], [1960, 1442], [1884, 1402], [1856, 1330], [1862, 1250], [1856, 1150], [1864, 1082]];
  koru('Doğu yamacı ormanı', DOGU, .25, { yaprakli1: 1.2, yaprakli2: 1, cam1: 1 }, { kenar: 24, kume: .4, puruz: 10 });
  koru('Doğu yamacı üst çamları', [[2010, 1000], [2100, 1010], [2160, 1100], [2160, 1300], [2110, 1400], [2040, 1380], [2030, 1200], [2000, 1080]], .06, { cam1: 1 }, { kenar: 30, kume: .5 });
  kusak('Doğu yamacı kuzey kenarı (ırmak yolu yüzü)', [[1880, 1040], [1930, 996], [2000, 966], [2080, 980]], 12, 10, .16);

  /* =====================================================================================================
     K11 · KIYI ŞERİTLERİ. Kimlik: su boyu söğütlük: yaprakli2 + çalı, kesik kesik (kume yüksek). Sığlıklarda, Dere Ağzı ve Sığlık Başı önünde AÇIK.
     ===================================================================================================== */
  const SOGUT = { yaprakli2: 2.2, cali: 2, yaprakli1: .6 };
  const kiyi = (ad, c, ic, yon, yog) => A.push({ tip: 'serpme', ad, alan: yon === 'sol' ? serit(c, ic, 3) : serit(c, 3, ic), yogunluk: yog || .5, turler: SOGUT, kenar: 3, kume: .7, puruz: 4 });
  // Batı Irmağı (bizim kıyı)
  kiyi('Kıyı: Boğaz batısı (kuzey)', dilim(BATI, 0, 300, 9999, 430), 22, 'sol');
  kiyi('Kıyı: Boğaz batısı (güney)', dilim(BATI, 0, 495, 9999, 640), 26, 'sol');
  kiyi('Kıyı: Sırt burnu kuzeyi', dilim(BATI, 730, 660, 9999, 740), 20, 'sol');
  kiyi('Kıyı: Batı terası yar altı', dilim(BATI, 0, 1030, 420, 1300), 24, 'sol');
  serpme('Kıyı: Boğaz çayırının batı burnu (söğüt koyağı)', [[862, 652], [906, 638], [948, 676], [962, 728], [928, 762], [882, 738], [846, 700]], .3, SOGUT, { kenar: 10, kume: .5, puruz: 8 });
  // Nal Irmağı (bizim kıyı)
  kiyi('Kıyı: Boğaz doğusu', dilim(NALB, 1255, 290, 1340, 430), 22, 'sag');
  kiyi('Kıyı: Boğaz çayırı doğusu', dilim(NALB, 1260, 555, 1340, 680), 22, 'sag');
  kiyi('Kıyı: Dere Ağzı kuzeyi', dilim(NALB, 1340, 735, 1395, 830), 20, 'sag');
  kiyi('Kıyı: Kıstak öncesi', dilim(NALB, 1860, 870, 1950, 930), 16, 'sag');
  serpme('Irmak yolu çiti (Çanak burnu eteği)', [[1612, 958], [1680, 962], [1730, 960], [1736, 976], [1690, 992], [1640, 990], [1610, 976]], .22, SOGUT, { kenar: 5, kume: .5 });
  // Nal Irmağı (Nal Tepe kıyısı): etek söğütlüğü. İğne'nin ve Dirsek Sığlığı'nın önü (x 1500–1625) AÇIK
  kiyi('Söğütlük: Nal Sığlığı kuzeyi', dilim(NALD, 1330, 400, 1350, 460), 20, 'sol');
  kiyi('Söğütlük: Nal batı eteği', dilim(NALD, 1340, 550, 1470, 790), 22, 'sol');
  kiyi('Söğütlük: Nal güney eteği', dilim(NALD, 1625, 870, 1860, 910), 22, 'sol');
  // Göl Ayağı deresi: batı kıyıda çalı + iki küçük ağaç öbeği (vadi tabanında: doğuştan bakışı kesmez)
  serpme('Dere boyu (batı kıyı)', serit([[1350, 1014], [1378, 978], [1398, 950], [1428, 908]], 18, -3), .5, { cali: 2.5, yaprakli2: 1 }, { kenar: 3, kume: .6 });
  serpme('Dere boyu (doğu kıyı, geçidin kuzeyi)', serit([[1420, 946], [1446, 914], [1470, 896]], -4, 16), .45, { cali: 1 }, { kenar: 3, kume: .5 });

  /* =====================================================================================================
     KENAR VE GEÇİŞ KORULUKLARI (ölçümün "olaysız yürüyüş" boşluklarını kapatır; hepsi yamaç ya da kıyıdadır, seyrek ve öbeklidir)
     ===================================================================================================== */
  // Batı Irmağı'nın karşı kıyısı (geçiş bandı): bölge dışındaki prosedürel ormana dikiş. Batı Sığlığı'nın karşı ucu (x 500–600) açık.
  A.push({ tip: 'koru', ad: 'Karşı kıyı (kuzeybatı)', alan: serit(dilim(BATIK, 600, -280, 9999, 760), 2, 90), yogunluk: .13, turler: { yaprakli1: 1, yaprakli2: 1, cam1: .5, cali: .5 }, kenar: 12, kume: .7, puruz: 10 });
  A.push({ tip: 'koru', ad: 'Karşı kıyı (batı)', alan: serit(dilim(BATIK, 0, 870, 480, 1300), 2, 80), yogunluk: .13, turler: { yaprakli1: 1, yaprakli2: 1, cam1: .5, cali: .5 }, kenar: 12, kume: .7, puruz: 10 });
  // güneybatı yamacı (Orta Sırt'ın güneyi – ırmak dirseği arası)
  koru('Güneybatı yamaç öbekleri', [[430, 1400], [520, 1380], [620, 1400], [700, 1440], [730, 1520], [640, 1580], [540, 1590], [450, 1540], [400, 1470]], .14, { yaprakli1: 1, yaprakli2: 1, cam1: 1 }, { kenar: 20, kume: .85, puruz: 10 });
  // Yar rampasının üstü, Güney Boğazı'nın batı omzu
  koru('Rampa üstü korusu', [[1360, 1470], [1420, 1450], [1480, 1480], [1500, 1540], [1470, 1600], [1400, 1610], [1350, 1560]], .2, { cam1: 2, yaprakli1: 1 }, { kenar: 16, kume: .6 });
  // Nal'ın kuzeybatı eteği (ırmak boyu) ve kuzeydoğu–doğu etekleri
  kiyi('Söğütlük: Nal kuzeybatı eteği', NALDK, 24, 'sol', .4);
  koru('Nal kuzeydoğu etekleri', [[1640, -90], [1720, -150], [1840, -140], [1960, -40], [2060, 90], [2120, 240], [2120, 400], [2040, 470], [1970, 400], [1960, 300], [1900, 200], [1780, 150], [1680, 120], [1630, 40]], .07, { cam1: 2, yaprakli1: 1, cali: .6 }, { kenar: 24, kume: .85, puruz: 12 });
  // (Nal'ın doğu yüzü %70 eğimli çıplak kaya yamaçtır: ağaç tutmaz, bilerek boş)
  // Kıstak'ın ötesi: Doğu Tepe'nin ırmağa inen eteği (bölge dışına geçiş)
  koru('Kıstak ötesi yamacı', [[2050, 880], [2090, 800], [2140, 720], [2200, 690], [2250, 760], [2230, 900], [2170, 1000], [2100, 960]], .2, { yaprakli1: 1, yaprakli2: 1, cam1: 1 }, { kenar: 16, kume: .6, puruz: 10 });
  // Boğaz çayırı (sakin bölge): çayırın ortasındaki tümseğin kuzey yamacında tek öbek: yolcunun gölgeliği, çayırı ikiye böler
  N.push({ id: 'cayir1', tur: 'yaprakli1', x: 1118, z: 676, s: 1.5, ry: .5 }, { id: 'cayir2', tur: 'yaprakli2', x: 1128, z: 670, s: 1.15, ry: 1.9 }, { id: 'cayir3', tur: 'yaprakli1', x: 1110, z: 668, s: 1.0, ry: 2.7 },
    { id: 'cayir_c1', tur: 'cali', x: 1122, z: 664, s: 1.1 }, { id: 'cayir_c2', tur: 'cali', x: 1104, z: 674, s: .9 });

  /* =====================================================================================================
     ÇALILIKLAR (lif ve böğürtlen): yerleşimlere ve doğuşa yakın kümeler + kuru dere, yar dibi, göl kıyısı
     ===================================================================================================== */
  cali('Kuru dere çalıları', serit([[1496, 1436], [1440, 1345], [1376, 1250]], 13, 13), .2, { kenar: 6, kume: .6 });
  serpme('Kuru dere ağzı söğütleri (Göl Başı güneyi)', [[1318, 1158], [1346, 1164], [1362, 1190], [1352, 1222], [1326, 1214], [1310, 1182]], .34, { yaprakli2: 2, yaprakli1: 1 }, { kenar: 5, kume: .2 });
  cali('Kuru dere ağzı çalılığı (Göl Başı güneyi)', [[1322, 1150], [1350, 1160], [1362, 1190], [1348, 1218], [1322, 1200], [1312, 1170]], .36, { kenar: 6, kume: .3 });
  cali('Yar dibi çalıları', serit([[1090, 1348], [1140, 1326], [1210, 1318], [1290, 1326], [1340, 1348]], 12, 6), .2, { kenar: 5, kume: .6 });
  cali('Göl batı kıyısı çalıları', [[1086, 1078], [1104, 1070], [1112, 1108], [1126, 1136], [1150, 1150], [1140, 1166], [1108, 1150], [1090, 1116]], .3, { kenar: 5, kume: .5 });
  cali('Göl güney kıyısı çalıları', serit([[1160, 1158], [1200, 1162], [1250, 1154], [1290, 1140]], -2, 12), .2, { kenar: 4, kume: .7 });
  cali('Göl Başı çalılığı (kuzey kenar)', [[1376, 1064], [1400, 1060], [1412, 1082], [1400, 1094], [1380, 1086]], .4, { kenar: 5 });
  cali('Dere Ağzı çalılığı (tepecik eteği)', [[1290, 930], [1306, 944], [1300, 968], [1278, 972], [1272, 950]], .4, { kenar: 5 });
  cali('Yar Sekisi çalılığı (doğu uç)', [[1262, 1392], [1296, 1396], [1306, 1420], [1280, 1436], [1258, 1420]], .34, { kenar: 5 });
  cali('Boğaz tümseği çalıları', [[1100, 440], [1120, 400], [1150, 380], [1180, 392], [1196, 430], [1180, 470], [1140, 478], [1110, 466]], .12, { kenar: 8, kume: .7 });

  /* =====================================================================================================
     BİLİNÇLİ TEK AĞAÇLAR (her biri bir yol çatalını ya da bir kenarı işaretler)
     ===================================================================================================== */
  N.push({ id: 'ada_agac', tur: 'yaprakli2', x: 1215, z: 1078, s: 1.5, ry: .7 }, { id: 'ada_cali1', tur: 'cali', x: 1209, z: 1082, s: 1.0 }, { id: 'ada_cali2', tur: 'cali', x: 1221, z: 1073, s: .8 },   // B6: göl adacığı
    { id: 'catal_bogaz', tur: 'yaprakli1', x: 1176, z: 568, s: 1.7, ry: 2.1 },      // Boğaz çatalının ağacı (üç yolun buluştuğu yerde gölge)
    { id: 'catal_dirsek', tur: 'yaprakli2', x: 1452, z: 930, s: 1.6, ry: .3 },      // Dirsek çatalı: kuzey / doğu / karşıya
    { id: 'burun_cam', tur: 'cam1', x: 764, z: 786, s: 1.7, ry: 1.3 },              // Sırt burnu çatalı
    { id: 'seyir_cam', tur: 'cam1', x: 806, z: 1068, s: 1.5, ry: 2.2 },             // Orta Sırt seyrinin yalnız çamı
    { id: 'yar_cam', tur: 'cam1', x: 1332, z: 1390, s: 1.6, ry: .9 });              // Yar'ın doğu ucunda, rampanın bittiği yerde: uçurum çizgisinde siluet

  /* =====================================================================================================
     İŞARETLERİN ÇEVRESİ: dev ağaçlar ve dikili taşlar serbest dursun (çevrelerinde küçük açıklık)
     ===================================================================================================== */
  acik('Ulu Çınar çevresi', { daire: [1345, 1068, 15] }, 6);
  acik('Ata ağacı çevresi', { daire: [1188, -108, 17] }, 7);
  acik('İğne ve Dirsek Sığlığı kuzey ucu', [[1520, 800], [1590, 780], [1632, 810], [1628, 876], [1560, 884], [1524, 850]], 8);
  acik('Dirsek Sığlığı güney ucu ve doğuş → İğne görüş çizgisi', [[1500, 905], [1600, 925], [1596, 965], [1540, 975], [1492, 945]], 6);
  acik('Çanak dikili taşı çevresi', { daire: [1836, 990, 9] }, 4);
  acik('Sığlık dikili taşı ve Batı Sığlığı doğu ucu', { daire: [618, 812, 30] }, 8);
  acik('Güney Boğazı dikili taşı çevresi', { daire: [1592, 1508, 14] }, 6);
  acik('Taş kapı çevresi', { daire: [1998, 856, 16] }, 6);
  // doğuşun ilk karesi: 0–30° arasında 120 m (yerlesim.js `yasak` da yazıyor; burada ağaç/çalı için güvence)
  acik('İlk kare koridoru', [[1416, 1182], [1410, 1066], [1450, 1066], [1484, 1082], [1428, 1184]], 3);
  // yerleşim çevreleri (düzlükler kendiliğinden boş; kenar payı)
  acik('Göl Başı çevresi ve göl doğu kıyısı', [[1318, 1060], [1352, 1084], [1408, 1094], [1416, 1140], [1384, 1166], [1334, 1156], [1318, 1120]], 6);
  acik('Dere Ağzı çevresi', [[1296, 880], [1330, 856], [1398, 862], [1420, 900], [1392, 946], [1330, 952], [1300, 930]], 6);
  acik('Yar Sekisi ve kuzey kenarı', [[1120, 1378], [1180, 1362], [1260, 1366], [1290, 1392], [1268, 1450], [1200, 1466], [1140, 1456], [1118, 1420]], 6);
  acik('Sığlık Başı çevresi', { daire: [560, 945, 62] }, 8);

  /* =====================================================================================================
     ZEMİN DOKUSU
     ===================================================================================================== */
  zemin('Ulu Koru orman tabanı', ULUC, { toprak: .4 }, 30);
  zemin('Çatal: Koru Açıklığı girişi', { daire: [1195, -20, 12] }, { toprak: .7 }, 8);
  zemin('Çatal: Boğaz çatalı', { daire: [1185, 560, 11] }, { toprak: .7 }, 8);
  zemin('Çatal: Seki altı', { daire: [1415, 1150, 9] }, { toprak: .6 }, 7);
  zemin('Çatal: Dirsek çatalı', { daire: [1440, 940, 11] }, { toprak: .7 }, 8);
  zemin('Çatal: Sırt burnu', { daire: [770, 770, 10] }, { toprak: .7 }, 8);
  zemin('Ulu Çınar dibi', { daire: [1345, 1068, 9] }, { toprak: .6 }, 7);
  zemin('Ata ağacı dibi', { daire: [1188, -108, 11] }, { toprak: .6 }, 8);
  zemin('Seki korusu tabanı', [[1446, 1150], [1472, 1146], [1502, 1172], [1522, 1214], [1528, 1262], [1502, 1280], [1478, 1258], [1462, 1226], [1450, 1196], [1443, 1170]], { toprak: .3 }, 10);
  zemin('Göl kumu: doğu kıyı (Göl Başı önü)', serit([[1300, 1128], [1330, 1104], [1340, 1076], [1334, 1052]], -2, 12), { kum: .8 }, 6);
  zemin('Göl kumu: kuzey kıyı', serit([[1296, 1018], [1250, 1008], [1210, 1008], [1170, 1016]], 9, 1), { kum: .7 }, 6);
  zemin('Çakıl: kuru dere yatağı', serit([[1500, 1440], [1440, 1345], [1375, 1250], [1340, 1170], [1322, 1110]], 5, 5), { cakil: .75 }, 5);
  zemin('Çakıl: Dirsek iç kıyısı', serit(dilim(NALB, 1385, 815, 1600, 940), 2, 10), { cakil: .7 }, 6);
  zemin('Çakıl: Dirsek Sığlığı kuzey ucu', { daire: [1560, 858, 14] }, { cakil: .8 }, 8);
  zemin('Çakıl: Nal Sığlığı batı ucu', { daire: [1258, 479, 14] }, { cakil: .8 }, 8);
  zemin('Çakıl: Nal Sığlığı doğu ucu', { daire: [1340, 479, 13] }, { cakil: .8 }, 8);
  zemin('Çakıl: Batı Sığlığı doğu ucu', { daire: [634, 818, 15] }, { cakil: .8 }, 8);
  zemin('Çakıl: Batı Sığlığı batı ucu', { daire: [548, 756, 13] }, { cakil: .8 }, 8);
  zemin('Çakıl: Boğaz batı iç dirseği', serit(dilim(BATI, 0, 420, 9999, 600), 9, 2), { cakil: .6 }, 6);
  zemin('Çakıl: Dere ağzı', { daire: [1466, 892, 12] }, { cakil: .7 }, 8);

  T.bolge({ id: 'b001', katman: 'bitki', sekiller: [], alanlar: A, nesneler: N, noktalar: [] });
})();
