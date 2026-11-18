/* DENEME BÖLGESİ: tasarım katmanının bütün ilkellerini gösteren sınama verisi. Oyuna dahil DEĞİL (index.html'de satırı yok).
   Yükleme: adres sonuna ?tasarim=deneme, araçlarda --tasarim deneme. Kılavuz: tasarim/KILAVUZ.md
   Bölge kendi tabanını kurar (prosedürel araziyi yok sayar), bu yüzden dünyanın neresine konsa aynı görünür; kenarlarında prosedürel araziyle kaynaşır.
   Koordinatlar okunaklı olsun diye bölge merkezine göre yazılıp P() ile dünyaya taşınıyor (gerçek bölgelerde doğrudan dünya koordinatı yazılır). */
(function () {
  const OX = 1400, OZ = 900;                                   // bölge merkezi (dünya)
  const P = (x, z, ...ek) => [OX + x, OZ + z, ...ek];          // yerel → dünya
  const C = L => L.map(q => P(...q));                          // nokta listesi
  const T = SO.tasarim;

  /* ---- bölge: sınır, taban, doğuş ---- */
  T.bolge({
    id: 'deneme', ad: 'Deneme bölgesi',
    sinir: { kutu: [OX - 1000, OZ - 1000, OX + 1000, OZ + 1000] }, gecis: 160,
    // taban: denetim noktalarından yumuşak yüzey [x, z, y]. Kuzey yüksek, güneye doğru alçalır; ortada geniş alçak havza
    taban: { kip: 'noktalar', noktalar: C([[-1000, -1000, 55], [0, -1000, 60], [1000, -1000, 50], [-1000, 0, 26], [-300, 0, 9], [300, 50, 11], [1000, 0, 30], [-1000, 1000, 14], [0, 1000, 8], [1000, 1000, 16], [0, -450, 30], [-500, 500, 7], [550, 550, 12]]) },
    engebe: { genlik: 4, olcek: 170 },                         // orta ölçekli dalga (± 4 m)
    mikro: { genlik: .4, olcek: 24 },                          // yarım metrelik tümsekler
    varsayilan: 0,                                             // prosedürel ağaç/kaya kapalı: yalnız aşağıda tasarlananlar
    dogus: { x: OX - 110, z: OZ + 90, yon: 20 }
  });

  /* ---- katman: arazi ---- */
  T.bolge({ id: 'deneme', katman: 'arazi', sekiller: [
    // dağ sırtı: nokta [x, z, yükseklik, yarı genişlik]; uçlar alçak. kollar: güneye inen iki yan sırt
    { tip: 'sirt', ad: 'Kuzey sırtı', profil: 'sivri', puruz: .4, cizgi: C([[-820, -640, 20, 150], [-520, -700, 95, 230], [-180, -760, 140, 260], [140, -700, 70, 200], [330, -640, 30, 150]]),
      kollar: [C([[-180, -760, 120, 150], [-200, -520, 60, 130], [-140, -330, 12, 90]]), C([[-520, -700, 80, 120], [-600, -480, 30, 100]])] },
    { tip: 'sirt', ad: 'Doğu sırtı', profil: 'yuvarlak', cizgi: C([[520, -660, 30, 140], [700, -560, 90, 200], [860, -380, 60, 170], [900, -200, 15, 120]]) },
    // iki sırt arasındaki geçit: kot verilen vadi (tabanı 34 m'ye iner)
    { tip: 'vadi', ad: 'Geçit', kot: 34, genislik: 110, taban: .35, cizgi: C([[420, -420], [430, -640], [470, -860]]) },
    { tip: 'tepe', ad: 'Yuvarlak tepe', merkez: P(480, 60), yaricap: [190, 140], aci: 25, yukseklik: 42, profil: 'yuvarlak' },
    { tip: 'tepe', ad: 'Sivri tepe', merkez: P(-620, 230), yaricap: 150, yukseklik: 70, profil: 'sivri', puruz: .5 },
    { tip: 'tepe', ad: 'Plato tepe', merkez: P(560, 560), yaricap: 170, yukseklik: 26, profil: 'plato', duz: .5 },
    // uçurum: çizginin solu yüksek kalır (çizgi batıdan doğuya çizildiği için sol = kuzey); dibine kaya serpilir
    { tip: 'ucurum', ad: 'Sarp yar', yan: 'sol', yukseklik: 16, genislik: 7, etki: 110, kayalar: 26, cizgi: C([[-460, -170], [-330, -130], [-200, -160], [-70, -120], [40, -150]]) },
    { tip: 'teras', ad: 'Teraslar', alan: { daire: [OX + 760, OZ - 60, 150] }, basamak: 5, dik: .3 },
    { tip: 'cukur', ad: 'Çanak', alan: { daire: [OX + 120, OZ - 330, 55] }, derinlik: 7, kenar: 35 },
    { tip: 'kaya_cikinti', ad: 'Kayalık', merkez: P(-250, -430), yaricap: 26, yukseklik: 12 },
    { tip: 'kaya_cikinti', ad: 'Göl kayalığı', merkez: P(-330, 250), yaricap: 14, yukseklik: 6 }
  ] });

  /* ---- katman: su (su yüzeyi her yerde y = 0) ---- */
  T.bolge({ id: 'deneme', katman: 'su', sekiller: [
    { tip: 'gol', ad: 'Ayna göl', derinlik: 5, sahanlik: 9, alan: C([[-330, 300], [-220, 240], [-90, 260], [-30, 330], [-80, 420], [-200, 450], [-310, 400]]) },
    // nehir: gölden çıkar, güneydoğudaki küçük göle dökülür. Ortasında yürünerek geçilen sığ geçit
    { tip: 'nehir', ad: 'Dere', genislik: 13, derinlik: 2.2, cizgi: C([[-60, 350], [60, 370], [160, 440], [200, 560], [300, 660, 18], [330, 740, 22]]), sig: [{ nokta: P(120, 410), uzunluk: 16, ad: 'Dere geçidi' }] },
    { tip: 'gol', ad: 'Küçük göl', derinlik: 3, alan: { daire: [OX + 330, OZ + 790, 70] } },
    // kıyı: güneybatıda büyük su; çizginin sağı su
    { tip: 'kiyi', ad: 'Koy', su: 'sag', derinlik: 6, suGenislik: 320, sahil: 16, cizgi: C([[-860, 520], [-700, 560], [-600, 660], [-470, 700], [-400, 820]]) }
  ] });

  /* ---- katman: yerleşim (düzlükler, patikalar) ---- */
  T.bolge({ id: 'deneme', katman: 'yerlesim', sekiller: [
    { tip: 'duzluk', ad: 'Göl başı', alan: C([[-190, 110], [-90, 100], [-60, 170], [-120, 215], [-200, 190]]), y: 4.5, kenar: 35 },
    { tip: 'plato', ad: 'Yar üstü', alan: C([[-380, -260], [-250, -250], [-230, -190], [-360, -200]]), kenar: 30 },   // y verilmedi: o yerin ortalama yüksekliği
    { tip: 'duzluk', ad: 'Dere kıyısı', alan: { daire: [OX + 250, OZ + 470, 38] }, y: 3.5, zemin: 'toprak' },
    { tip: 'patika', ad: 'Göl yolu', genislik: 3, cizgi: C([[-110, 90], [-130, 150], [-60, 230], [20, 320], [100, 395], [140, 425], [215, 465], [330, 400], [430, 250], [480, 70]]) },
    { tip: 'patika', ad: 'Yar rampası', genislik: 3.5, rampa: true, cizgi: C([[-150, 100], [-170, 0], [-140, -90], [-150, -140], [-200, -200], [-250, -225]]) }
  ], noktalar: [
    { tur: 'yerlesim', ad: 'Göl başı', x: OX - 135, z: OZ + 155, yaricap: 45 },
    { tur: 'yerlesim', ad: 'Yar üstü', x: OX - 305, z: OZ - 225, yaricap: 40 },
    { tur: 'yerlesim', ad: 'Dere kıyısı', x: OX + 250, z: OZ + 470, yaricap: 38 }
  ] });

  /* ---- katman: bitki (alanlar) ---- */
  T.bolge({ id: 'deneme', katman: 'bitki', alanlar: [
    { tip: 'koru', ad: 'Karışık koru', alan: C([[-80, -80], [120, -60], [220, 60], [180, 200], [20, 180], [-40, 60]]), yogunluk: .34, turler: { yaprakli1: 2, yaprakli2: 2, cam1: 1, cali: 1 } },
    { tip: 'aciklik', ad: 'Koru açıklığı', alan: { daire: [OX + 90, OZ + 60, 38] } },
    { tip: 'koru', ad: 'Çam yamacı', alan: C([[-700, -560], [-300, -620], [-80, -560], [-120, -360], [-420, -380], [-680, -420]]), yogunluk: .28, turler: { cam1: 4, yaprakli2: 1 }, boy: [.9, 1.5], kume: .6 },
    { tip: 'taslik', ad: 'Göl taşlığı', alan: { daire: [OX - 340, OZ + 290, 34] }, yogunluk: .16 },
    { tip: 'taslik', ad: 'Geçit taşlığı', alan: { daire: [OX + 130, OZ + 395, 22] }, yogunluk: .12, turler: { kaya: 2, duzAlcak: 1 }, boy: [.5, 1.3] },
    { tip: 'cali_alani', ad: 'Çalılık', alan: C([[250, 250], [400, 230], [420, 340], [280, 360]]), yogunluk: .2 },
    { tip: 'yasak', alan: { daire: [OX - 110, OZ + 90, 22] } },                                   // doğuş çevresi boş
    { tip: 'zemin', ad: 'Çakıllık', alan: { daire: [OX + 120, OZ + 410, 20] }, cakil: .9 },
    { tip: 'kaynak', ad: 'Dal-taş kümesi', alan: { daire: [OX - 60, OZ + 70, 30] }, dalEk: .05, tasEk: .04 }
  ] });

  /* ---- katman: işaret (tek tek nesneler, ilgi noktaları) ---- */
  T.bolge({ id: 'deneme', katman: 'isaret', nesneler: [
    { id: 'ulu', tur: 'devAgac', x: OX + 90, z: OZ + 60 },                                        // açıklığın ortasında dev ağaç (tür bağlanana kadar büyütülmüş yapraklı)
    { id: 'igne', tur: 'sivriTas', x: OX + 560, z: OZ + 560, ry: 1 },
    { id: 'dikit1', tur: 'anitTas', x: OX - 300, z: OZ - 230 }, { id: 'kapi', tur: 'tasKapi', x: OX + 430, z: OZ - 520, ry: 0 },
    { id: 'duvar', tur: 'yikikDuvar', x: OX + 265, z: OZ + 455, ry: .6 },
    { id: 'buyukkaya', tur: 'kaya', x: OX - 40, z: OZ + 245, s: 3.2, ry: 2 }
  ], noktalar: [
    { tur: 'isaret', ad: 'Ulu ağaç', x: OX + 90, z: OZ + 60, yukseklik: 20 },
    { tur: 'isaret', ad: 'İğne kaya', x: OX + 560, z: OZ + 560, yukseklik: 10 },
    { tur: 'isaret', ad: 'Kuzey zirvesi', x: OX - 180, z: OZ - 760, yukseklik: 2 },
    { tur: 'manzara', ad: 'Sivri tepe', x: OX - 620, z: OZ + 230 },
    { tur: 'kaynak', ad: 'Göl taşlığı', x: OX - 340, z: OZ + 290, yaricap: 34 },
    { tur: 'gecit', ad: 'Dağ geçidi', x: OX + 430, z: OZ - 560, yaricap: 40 }
  ] });
})();
