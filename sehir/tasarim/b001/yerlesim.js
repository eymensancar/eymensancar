/* b001 — katman 'yerlesim' (sıra 30). Yerleşim ve kaynak uzmanı. Plan: tasarim/b001/TASARIM.md § 5, § 8, § 10-C · Kılavuz: tasarim/KILAVUZ.md
   Bu dosyada: altı yerleşim düzlüğü (Y1) + üç küçük seki (Y2), taşlıklar (Y3), yerde dal/taş kümeleri (Y4), yasak alanları (Y5), kaynak noktaları.
   Yerleşim noktaları (y1…y6) bolge.js'tedir; burada yeniden YAZILMAZ.

   DÜZLÜK YAPIMI. `duzluk` ilkelinin kenar pürüzü yok: çokgen neyse o. Bu yüzden her düzlük `damla()` ile, on iki pusula yönüne elle verilmiş
   yarıçaplardan üretilir (36 köşe, aralar yumuşak, %7 tohumlu oynama): daire değil; böbrek, damla, yay. Yarıçaplar araziye göre seçildi: düzlük doğal
   sekiyi izler, yamaca doğru dar, açık yana doğru geniş. İçeride mikro engebe %25–35 kalır ve her düzlüğe 2–3 çok alçak kabartı (± 0,25–0,4 m,
   r 20–30 m) eklenir: göz düz görür, ayak hafif dalgayı hisseder; eğim %6'nın altında kalır (inşa sınırı: 2 m'lik hücrede 1 m = %50; çok uzağındayız).
   Her düzlüğün AYRI bir bedeli vardır (§ 5 tablosu): hiçbirine her kaynak konmadı. */
(function () {
  const T = SO.tasarim;

  /* merkez + pusula yönlerine (0 = kuzey, saat yönünde, eşit aralıklı) yarıçaplar → doğal kenarlı kapalı çokgen */
  function damla(cx, cz, r, tohum, n) {
    const R = T.rnd(tohum), m = r.length, N = n || 36, P = [];
    for (let i = 0; i < N; i++) {
      const u = i / N * m, k = Math.floor(u), t = u - k, p0 = r[(k - 1 + m) % m], p1 = r[k % m], p2 = r[(k + 1) % m], p3 = r[(k + 2) % m];
      const rr = .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t) * (1 + (R() - .5) * .07);
      const a = i / N * Math.PI * 2; P.push([Math.round(cx + Math.sin(a) * rr), Math.round(cz - Math.cos(a) * rr)]);
    }
    return P;
  }
  /* çizgi + yarı genişlik → şerit çokgeni (kıyı, yamaç dibi, uçurum kenarı taşlıkları için) */
  function serit(c, yari) {
    const sol = [], sag = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L, w = c[i][2] || yari;
      sol.push([Math.round(c[i][0] + nx * w), Math.round(c[i][1] + nz * w)]); sag.unshift([Math.round(c[i][0] - nx * w), Math.round(c[i][1] - nz * w)]);
    }
    return sol.concat(sag);
  }
  const daire = (x, z, r) => ({ daire: [x, z, r] });
  const KUCUK = { kenar: 2, kume: 0 };   // küçük kümeler: varsayılan kenar seyrelmesi (8 m) içlerini boşaltır
  const tas = (ad, alan, yogunluk, ek) => Object.assign({ tip: 'taslik', ad, alan, yogunluk }, ek);
  /* düzlük içi hafif dalga: çok alçak, geniş kabartı / çöküntü */
  const dalga = (x, z, r, h, aci) => ({ tip: 'tepe', merkez: [x, z], yaricap: r, aci: aci || 0, yukseklik: h, profil: 'yuvarlak', puruz: .15 });

  T.bolge({
    id: 'b001', katman: 'yerlesim',
    sekiller: [
      /* ---------- Y1 · ALTI YERLEŞİM DÜZLÜĞÜ ---------- */

      /* y1 · DERE AĞZI (1345,905) y 5,5. Irmak dirseğinin iç sekisi: zaten düze yakın doğal çayır; düzlük onu toparlar. Uzun ekseni ırmağa koşut (KKB–GGD).
         Doğu–güneydoğu yanı dar: Göl Ayağı deresine 35 m'den fazla yaklaşmaz (kenar şevi dereyi doldurmasın). Batıda Göl Tepeciği eteğine yaslanır. */
      { tip: 'duzluk', ad: 'Dere Ağzı', y: 5.5, kenar: 30, mikro: .3,
        alan: damla(1345, 905, [58, 50, 44, 45, 41, 44, 56, 54, 44, 41, 44, 55], 101) },
      dalga(1332, 880, [30, 22], .35, 30), dalga(1362, 925, [24, 30], -.3, -20), dalga(1322, 928, 20, .25),

      /* y2 · GÖL BAŞI (1368,1122) y 4,5. Göl kıyısı düzlüğü; kuzeye (göl ayağına) doğru uzayan damla. Güneydoğu yanı (doğuş sekisi) ve batı yanı
         (kuru dere, göl) dar tutuldu. */
      { tip: 'duzluk', ad: 'Göl Başı', y: 4.5, kenar: 26, mikro: .3,
        alan: damla(1368, 1122, [56, 48, 42, 39, 39, 39, 43, 44, 40, 38, 37, 48], 102) },
      dalga(1372, 1100, [26, 20], .3, 15), dalga(1356, 1140, 22, -.28),

      /* y3 · YAR SEKİSİ (1195,1425) y 60. Uçurum üstü plato; uzun ekseni uçuruma koşut (doğu–batı). */
      { tip: 'plato', ad: 'Yar Sekisi', y: 60, kenar: 30, mikro: .35,
        alan: damla(1195, 1425, [45, 46, 52, 58, 50, 45, 44, 45, 50, 54, 48, 45], 103) },
      // Seyir burnu: platonun uçuruma uzanan dili (kenar şevi dar: uçurumun yüzünü bozmaz). İnşa edilebilir; "uçurumun ucunda ev" yeri.
      { tip: 'plato', ad: 'Yar seyir burnu', y: 60, kenar: 9, mikro: .35,
        alan: [[1166, 1386], [1169, 1374], [1177, 1366], [1189, 1362], [1202, 1361], [1214, 1364], [1221, 1372], [1225, 1386]] },
      dalga(1175, 1432, [30, 22], .4, 10), dalga(1222, 1418, [24, 28], -.3, 0), dalga(1200, 1452, 20, .3),

      /* y4 · SAKLI ÇANAK (1775,1150) y 23,5. Çanağın dibi; vadinin eksenine (kuzey–güney) uzanan oval. */
      { tip: 'duzluk', ad: 'Saklı Çanak', y: 23.5, kenar: 26, mikro: .3,
        alan: damla(1775, 1150, [54, 46, 43, 44, 45, 50, 54, 48, 43, 42, 40, 45], 104) },
      dalga(1768, 1128, [22, 30], .35, 10), dalga(1782, 1172, [26, 22], -.3, 0),

      /* y5 · KORU AÇIKLIĞI (1150,−30) y 27. Doğuya alçalan yamaçta bir balkon: batısı yamaca oyulur, doğusu dolgu (ormanın içinde seki). */
      { tip: 'duzluk', ad: 'Koru Açıklığı', y: 27, kenar: 35, mikro: .35,
        alan: damla(1150, -30, [50, 44, 41, 41, 42, 46, 52, 50, 46, 44, 48, 52], 105) },
      dalga(1140, -48, [24, 30], .4, 0), dalga(1162, -8, [26, 20], -.3, 30),

      /* y6 · SIĞLIK BAŞI (560,945) y 12. Irmak terası; uzun ekseni eş yükselti eğrisine koşut (K30°D). */
      { tip: 'duzluk', ad: 'Sığlık Başı', y: 12, kenar: 30, mikro: .3,
        alan: damla(560, 945, [48, 55, 46, 41, 39, 42, 47, 52, 45, 40, 39, 42], 106) },
      dalga(572, 925, [22, 30], .35, 30), dalga(548, 968, 22, -.3),

      /* ---------- Y2 · ÜÇ KÜÇÜK SEKİ (nokta YOK: haritada yerleşim sayılmaz; bulan oyuncunun "ikinci üs" cebi, ≈ 1200–1500 m²) ----------
         y verilmedi: her biri bulunduğu yamacın o andaki ortalama yüksekliğine oturur (az toprak oynar, yamaçta doğal bir omuz gibi durur). */
      { tip: 'duzluk', ad: 'Boğaz çayırı sekisi', kenar: 14, mikro: .45, alan: damla(1140, 640, [24, 20, 18, 22, 26, 20, 17, 21], 111, 20) },   // iki ırmak arası, yol üstü
      { tip: 'duzluk', ad: 'Nal batı omzu', kenar: 14, mikro: .45, alan: damla(1560, 560, [18, 22, 24, 19, 17, 20, 23, 19], 112, 20) },          // ırmak dirseğine bakan balkon
      { tip: 'duzluk', ad: 'Kartal altı sekisi', kenar: 12, mikro: .45, alan: damla(1010, 1560, [17, 21, 20, 16, 18, 22, 19, 16], 113, 20) }     // Kartal yarının dibinde, çam içinde
    ],
    alanlar: [
      /* ---------- Y3 · TAŞLIKLAR: yalnız kıyı, yamaç dibi, uçurum kenarı, kuru dere. Düzlük ortasında yok. ----------
         Yoğunluk kademesi bilinçli: ırmak kıyıları ve Nal eteği ZENGİN (.18–.22), yamaç dipleri ORTA (.12–.16), kuru dere ve Yar dibi SEYREK (.06–.08).
         Göl Başı ve Koru Açıklığı çevresi bilerek fakir: taş için yürünür. */

      // T1 · Irmak dirseği kıyısı (Dere Ağzı'nın taş ocağı): iç dirseğin dar kıyı bandı, dere ağzının iki yanı
      tas('T1 Dirsek kıyısı', serit([[1374, 806], [1388, 829], [1401, 849], [1415, 865], [1431, 880]], 10), .45, { kume: .6, kenar: 5 }),
      tas('T1 Dere ağzı doğusu', serit([[1472, 911], [1500, 918], [1527, 928]], 8), .35, { kenar: 4 }),
      // T2 · Seki ardı: doğuş sekisinin arkasındaki oyukta, yamaç dibinde (doğuşa en yakın taş ocağı; ucu 38 m)
      tas('T2 Seki ardı', damla(1456, 1241, [20, 22, 28, 30, 22, 16, 14, 16, 24, 28, 24, 20], 201, 24), .4, { kume: .45, kenar: 6 }),
      // T3 · Yar dibi: uçurumun kendi döküntüsünün (arazi.js `kayalar`) önünde seyrek etek taşları
      tas('T3 Yar dibi', serit([[1085, 1338], [1145, 1326], [1210, 1320], [1278, 1327], [1338, 1346]], 12), .1, { kume: .7 }),
      // Yar'ın üst kenarı: seyir burnunun iki yanında kenar kayaları (plato ile uçurum arası)
      tas('Yar kenarı batı', serit([[1082, 1374], [1128, 1364]], 8), .35, { kenar: 4 }),
      tas('Yar kenarı doğu', serit([[1264, 1364], [1322, 1376]], 8), .35, { kenar: 4 }),
      // T4 · Göl batı kıyısı: sazlığın karaya dayandığı alçak sırtçık
      tas('T4 Göl batısı', damla(1094, 1096, [26, 18, 14, 14, 16, 22, 26, 18, 14, 13, 14, 18], 204, 24), .5, { kume: .3, kenar: 4, turler: { kaya: 2, duzAlcak: 1.2, duzOrta: 1, duzYuksek: .4 } }),
      // T5 · Dirsek Sığlığı'nın iki ucu: geçidin yanlarında (geçidin kendisi yasak alanla açık kalır)
      tas('T5 Dirsek güney-batı', daire(1527, 934, 11), 1, KUCUK), tas('T5 Dirsek güney-doğu', daire(1591, 939, 10), 1, KUCUK),
      tas('T5 Dirsek kuzey-batı', daire(1542, 842, 10), 1, KUCUK), tas('T5 Dirsek kuzey-doğu', daire(1587, 861, 10), 1, KUCUK),
      // T6 · Batı Sığlığı'nın iki ucu + Sığlık Başı'nın altındaki ırmak kıyısı + Batı terasının yar kenarı
      tas('T6 Batı Sığlığı doğu-kuzey', daire(637, 798, 11), 1, KUCUK), tas('T6 Batı Sığlığı doğu-güney', daire(586, 829, 10), 1, KUCUK),
      tas('T6 Batı Sığlığı batı-kuzey', daire(598, 752, 9), 1, KUCUK), tas('T6 Batı Sığlığı batı-güney', daire(546, 793, 9), 1, KUCUK),
      tas('T6 Teras altı kıyısı', serit([[548, 857], [528, 877], [508, 898], [488, 918], [469, 937]], 11), .45, { kume: .5, kenar: 4, turler: { kaya: 2, duzAlcak: 1.2, duzOrta: 1, duzYuksek: .5 } }),
      tas('T6 Batı yarı kenarı', serit([[459, 1048], [437, 1108], [429, 1170], [423, 1270]], 16), .14, { kume: .7 }),
      // T7 · Çanak kolunun iç eteği: Saklı Çanak'ın batı kenarında, dik yamacın dibi
      tas('T7 Çanak iç eteği', serit([[1746, 1088], [1735, 1117], [1726, 1150], [1717, 1179], [1720, 1206]], 9), .38, { kume: .5, kenar: 4 }),
      tas('T7 Çanak başı', damla(1758, 1220, [14, 18, 22, 18, 14, 16, 20, 16], 207, 16), .4, { kume: .4, kenar: 4 }),
      // T8 · Kıstak: yolun yamaç yanı (ırmak yanı açık)
      tas('T8 Kıstak yamaç dibi', serit([[1960, 914], [2010, 864], [2046, 814]], 9), .25, { kume: .6 }),
      // T9 · Boğaz tümseğinin eteği: kayalık tümsek (dorukta arazi.js'in kaya başlığı)
      tas('T9 Boğaz tümseği', damla(1150, 425, [52, 44, 40, 46, 54, 46, 40, 44], 209, 24), .1, { kume: .75, kenar: 14 }),
      // T10 · Koru Tepesi'nin batı yarı (Koru Açıklığı'nın tek taş kaynağı: 135–150 m)
      tas('T10 Koru batı yarı', serit([[1024, -250], [1015, -180], [1016, -110], [1018, -40], [1021, 12]], 15), .14, { kume: .6 }),
      // T11 · Güney Boğazı'nın iki yanı (yan yamaçların dibi; taban açık)
      tas('T11 Güney Boğazı kuzey', serit([[1608, 1486], [1692, 1527], [1790, 1571]], 10), .13, { kume: .7 }),
      tas('T11 Güney Boğazı güney', serit([[1576, 1549], [1657, 1597], [1780, 1649]], 10), .22, { kume: .7 }),
      // T12 · Nal eteği (İğne kayalığı çevresi, ırmağın kuzey kıyısı) + doruk çevresi + Kovuk (bölgenin en zengin taşı; yalnız doruğa çıkan bulur)
      tas('T12 İğne kayalığı', damla(1590, 814, [30, 26, 34, 38, 28, 22, 20, 22, 26, 24, 22, 26], 212, 24), .35, { kume: .5 }),
      tas('T12 Nal güney eteği', serit([[1628, 842], [1690, 866], [1760, 878], [1830, 866]], 9), .3, { kume: .7 }),
      tas('T12 Nal doruğu', damla(1805, 553, [40, 46, 52, 44, 38, 44, 50, 42], 213, 24), .12, { kume: .6, kenar: 12 }),
      tas('T12 Kovuk', damla(1880, 380, [36, 40, 34, 30, 34, 40, 36, 30], 214, 24), .35, { kume: .4 }),
      // T13 · Kuru dere yatağı boyunca seyrek (Göl Başı'nın yakın ama kıt taşı)
      tas('T13 Kuru dere', serit([[1534, 1450], [1502, 1416], [1464, 1372], [1436, 1338], [1412, 1300], [1375, 1250], [1354, 1214], [1346, 1186]], 10), .09, { kume: .8, kenar: 5 }),
      // Nal Sığlığı'nın doğu ucu: geçidi uzaktan belli eden küçük küme
      tas('Nal Sığlığı doğu', daire(1352, 463, 9), 1, KUCUK),

      /* ---------- Y4 · YERDE DAL / TAŞ ----------
         Taban olasılık zaten ağaç dibine dal, kaya dibine ve kıyıya taş koyar; buradakiler belirgin kümelerdir (aday 3 m'de bir: Ek .03 ≈ 100 m²'de 0,35 nesne). */
      // doğuş: ilk balta (2 dal + 2 taş) 30 m içinde, ağaç/kaya aramadan
      { tip: 'kaynak', ad: 'Doğuş çevresi', alan: daire(1420, 1190, 32), dalEk: .012, tasEk: .012, kenar: 8 },
      { tip: 'kaynak', ad: 'Seki korusu dalları', alan: damla(1474, 1206, [34, 30, 28, 34, 40, 34, 28, 30], 301, 16), dalEk: .035 },
      { tip: 'kaynak', ad: 'Seki ardı taşları', alan: daire(1456, 1241, 30), tasEk: .04 },
      // Göl Başı: dal var (Ulu Çınar'ın dibi, kıyıya vurmuş dallar), taş KIT (kumluk kıyı: kıyı taşı %35'e iner)
      { tip: 'kaynak', ad: 'Ulu Çınar dalları', alan: daire(1350, 1074, 20), dalEk: .05 },
      { tip: 'kaynak', ad: 'Göl Başı kumluğu', alan: [[1300, 1040], [1352, 1040], [1352, 1100], [1335, 1150], [1290, 1162], [1270, 1140], [1318, 1100]], tas: .35, kenar: 10 },
      // Dere Ağzı: taş bol (ırmak kıyısı)
      { tip: 'kaynak', ad: 'Dirsek kıyısı taşları', alan: serit([[1372, 802], [1388, 829], [1401, 849], [1415, 865], [1434, 882]], 13), tasEk: .06 },
      // adacık: dal bolluğu (noktası su.js'te: k_ada)
      { tip: 'kaynak', ad: 'Adacık dalları', alan: daire(1215, 1078, 12), dalEk: .09, kenar: 3 },
      // Saklı Çanak: orman kenarında dal, kol eteğinde taş
      { tip: 'kaynak', ad: 'Çanak dalları', alan: damla(1806, 1190, [26, 30, 26, 22, 26, 32, 28, 22], 302, 16), dalEk: .04 },
      { tip: 'kaynak', ad: 'Çanak eteği taşları', alan: serit([[1746, 1088], [1735, 1117], [1726, 1150], [1717, 1179], [1720, 1206]], 12), tasEk: .04 },
      // Koru Açıklığı: açıklığın zemini ve çevresi dal dolu; taş yok
      { tip: 'kaynak', ad: 'Koru Açıklığı dalları', alan: daire(1150, -30, 68), dalEk: .03, tas: .5, kenar: 14 },
      // Sığlık Başı: kıyı taşı
      { tip: 'kaynak', ad: 'Teras altı kıyı taşları', alan: serit([[548, 855], [526, 876], [506, 897], [486, 917], [466, 937]], 13), tasEk: .05 },
      // Yar: dipte ve kenarda taş
      { tip: 'kaynak', ad: 'Yar dibi taşları', alan: serit([[1085, 1338], [1145, 1326], [1210, 1320], [1278, 1327], [1338, 1346]], 14), tasEk: .035 },
      { tip: 'kaynak', ad: 'Yar kenarı taşları', alan: serit([[1082, 1374], [1128, 1364], [1195, 1362], [1264, 1364], [1322, 1376]], 9), tasEk: .03 },
      // kuru dere, sığlık uçları, Boğaz tümseği, Nal eteği, Kovuk
      { tip: 'kaynak', ad: 'Kuru dere taşları', alan: serit([[1534, 1450], [1502, 1416], [1464, 1372], [1436, 1338], [1412, 1300], [1375, 1250], [1354, 1214], [1346, 1186]], 9), tasEk: .025 },
      { tip: 'kaynak', ad: 'Dirsek Sığlığı taşları', alan: [[1518, 922], [1602, 928], [1600, 950], [1516, 944]], tasEk: .04 },
      { tip: 'kaynak', ad: 'Batı Sığlığı taşları', alan: daire(618, 818, 24), tasEk: .04 },
      { tip: 'kaynak', ad: 'Boğaz tümseği taşları', alan: daire(1150, 425, 48), tasEk: .025, kenar: 12 },
      { tip: 'kaynak', ad: 'İğne eteği taşları', alan: daire(1592, 816, 34), tasEk: .05 },
      { tip: 'kaynak', ad: 'Kovuk taşları', alan: daire(1880, 380, 34), tasEk: .07 },

      /* ---------- Y5 · YASAK ALANLARI (hiçbir nesne çıkmaz). Düzlüklerin içi ve patika üstü kendiliğinden boştur. ---------- */
      // ilk kare koridoru: doğuştan kuzeye (−5°…33°, 120 m): ortadaki patika, dere geçidi ve ırmak dirseği ağaçla kapanmasın
      { tip: 'yasak', ad: 'İlk kare koridoru', alan: [[1417, 1181], [1409, 1070], [1432, 1066], [1460, 1072], [1486, 1089], [1425, 1181]] },
      // doğuş → Göl Başı / Ulu Çınar bakışı (328°): ilk üs yeri doğuştan görünür kalsın
      { tip: 'yasak', ad: 'Göl Başı bakışı', alan: [[1412, 1183], [1392, 1164], [1404, 1154], [1418, 1180]] },
      // sığ geçitlerin iki ucu
      { tip: 'yasak', alan: daire(618, 818, 13) }, { tip: 'yasak', alan: daire(563, 761, 13) },
      { tip: 'yasak', alan: daire(1560, 934, 14) }, { tip: 'yasak', alan: daire(1560, 855, 14) },
      { tip: 'yasak', alan: daire(1257, 479, 13) }, { tip: 'yasak', alan: daire(1340, 479, 12) },
      // Çanak ağzı açıklığı, Yar rampasının üst ucu, Seki altı çatalı
      { tip: 'yasak', ad: 'Çanak ağzı', alan: daire(1829, 1000, 16) },
      { tip: 'yasak', ad: 'Yar rampası üst ucu', alan: daire(1268, 1428, 14) },
      { tip: 'yasak', ad: 'Seki altı çatalı', alan: daire(1415, 1150, 9) },
      // manzara noktaları (r 8)
      { tip: 'yasak', alan: daire(1800, 560, 8) }, { tip: 'yasak', alan: daire(1190, 1388, 8) }, { tip: 'yasak', alan: daire(797, 1085, 8) },
      { tip: 'yasak', alan: daire(1200, -300, 8) }, { tip: 'yasak', alan: daire(1680, 1562, 8) }, { tip: 'yasak', alan: daire(1960, 905, 8) }, { tip: 'yasak', alan: daire(1220, 1160, 8) }
    ],
    nesneler: [
      /* Doğuşun sağ önü (46–55°, 36–46 m): seki şevinin dibinde üç taş; sol önde (309°, 28 m) şev kenarında bir çalı (sağ öndeki çalılar ve ilk ağaçlar bitki.js'te).
         İlk karede sağda taş, iki yanda çalı (lif) görünür; koridorun (−5°…33°) dışındadır. Kimlikler `y_` önekli (öteki dosyalarla çakışmasın). */
      { id: 'y_seki_k1', tur: 'kaya', x: 1447, z: 1165, s: 1.5, ry: .6 },
      { id: 'y_seki_k2', tur: 'kaya', x: 1453, z: 1169, s: .95, ry: 2.1 },
      { id: 'y_seki_k3', tur: 'duzAlcak', x: 1458, z: 1163, s: 1.2, ry: 1.2 },
      { id: 'y_seki_c', tur: 'cali', x: 1398, z: 1173, s: 1.0, ry: 2.6 },

      /* OYUN ALANI 1 · Dirsek basamakları (Dere Ağzı'nın kıyısı): kıyıdan suya inen ve geri çıkan düz tepeli kaya dizisi; son ikisi suyun içinde. */
      { id: 'y_bas1_a', tur: 'duzAlcak', x: 1392, z: 838, s: 1.4, ry: .3 },
      { id: 'y_bas1_b', tur: 'duzOrta', x: 1396, z: 842, s: 1.35, ry: 1.1 },
      { id: 'y_bas1_c', tur: 'duzYuksek', x: 1400, z: 847, s: 1.25, ry: 2.2 },
      { id: 'y_bas1_d', tur: 'duzOrta', x: 1405, z: 851, s: 1.4, ry: .8 },
      { id: 'y_bas1_e', tur: 'duzAlcak', x: 1410, z: 855, s: 1.5, ry: 1.9 },
      { id: 'y_bas1_f', tur: 'duzOrta', x: 1414, z: 850, s: 1.5, ry: 2.8 },
      { id: 'y_bas1_g', tur: 'duzYuksek', x: 1419, z: 846, s: 1.45, ry: .5 },
      { id: 'y_bas1_h', tur: 'kaya', x: 1398, z: 853, s: 1.7, ry: 1.4 },

      /* OYUN ALANI 2 · Sazlık taşları (gölün batı kıyısı): kıyı sırtçığından sazlık sahanlığının içine yürüyen basamak taşları. */
      { id: 'y_bas2_a', tur: 'duzYuksek', x: 1095, z: 1095, s: 1.2, ry: 1.0 },
      { id: 'y_bas2_b', tur: 'duzOrta', x: 1100, z: 1091, s: 1.35, ry: 2.4 },
      { id: 'y_bas2_c', tur: 'duzAlcak', x: 1105, z: 1088, s: 1.45, ry: .2 },
      { id: 'y_bas2_d', tur: 'duzAlcak', x: 1111, z: 1086, s: 1.6, ry: 1.7 },
      { id: 'y_bas2_e', tur: 'duzOrta', x: 1117, z: 1083, s: 1.4, ry: 2.9 },
      { id: 'y_bas2_f', tur: 'duzAlcak', x: 1123, z: 1081, s: 1.5, ry: .9 }
    ],
    noktalar: [
      // kaynak kümeleri (adacık su.js'te: k_ada)
      { id: 'k_seki', tur: 'kaynak', ad: 'Seki korusu (dal)', x: 1474, z: 1206, yaricap: 30 },
      { id: 'k_sekitas', tur: 'kaynak', ad: 'Seki ardı taşlığı', x: 1456, z: 1241, yaricap: 26 },
      { id: 'k_cinar', tur: 'kaynak', ad: 'Ulu Çınar dibi (dal)', x: 1350, z: 1074, yaricap: 20 },
      { id: 'k_dirsek', tur: 'kaynak', ad: 'Dirsek kıyısı taşlığı', x: 1401, z: 849, yaricap: 40 },
      { id: 'k_kurudere', tur: 'kaynak', ad: 'Kuru dere taşları', x: 1375, z: 1250, yaricap: 30 },
      { id: 'k_yardibi', tur: 'kaynak', ad: 'Yar dibi taşlığı', x: 1210, z: 1320, yaricap: 60 },
      { id: 'k_sazlik', tur: 'kaynak', ad: 'Sazlık taşları', x: 1096, z: 1096, yaricap: 22 },
      { id: 'k_canak', tur: 'kaynak', ad: 'Çanak eteği (dal + taş)', x: 1726, z: 1150, yaricap: 35 },
      { id: 'k_igne', tur: 'kaynak', ad: 'İğne eteği taşlığı', x: 1592, z: 816, yaricap: 34 },
      { id: 'k_kovuk', tur: 'kaynak', ad: 'Kovuk taşlığı', x: 1880, z: 380, yaricap: 34 },
      { id: 'k_bogaz', tur: 'kaynak', ad: 'Boğaz tümseği taşları', x: 1150, z: 425, yaricap: 48 },
      { id: 'k_korudal', tur: 'kaynak', ad: 'Koru Açıklığı dalları', x: 1150, z: -30, yaricap: 60 },
      { id: 'k_koruyar', tur: 'kaynak', ad: 'Koru batı yarı taşlığı', x: 1017, z: -110, yaricap: 40 },
      { id: 'k_terasalti', tur: 'kaynak', ad: 'Teras altı kıyı taşlığı', x: 508, z: 898, yaricap: 40 },
      { id: 'k_batiyar', tur: 'kaynak', ad: 'Batı yarı taşlığı', x: 432, z: 1150, yaricap: 50 },
      { id: 'k_kistak', tur: 'kaynak', ad: 'Kıstak taşlığı', x: 2010, z: 864, yaricap: 40 },
      { id: 'k_guney', tur: 'kaynak', ad: 'Güney Boğazı taşları', x: 1675, z: 1562, yaricap: 60 }
    ]
  });
})();
