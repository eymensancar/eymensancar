/* b001 — Doğuş bölgesi "İki Irmak Arası". BÖLGE TANIMI + ANA İSKELET (baş tasarımcı). Plan: tasarim/b001/TASARIM.md · Kılavuz: tasarim/KILAVUZ.md
   Bu dosyada: sınır, geçiş bandı, taban, doğuş, BÜYÜK FORMLAR (≥ 150 m ölçekli sırt/tepe/geçit) ve ilgi noktalarının ANA LİSTESİ.
   Orta/küçük arazi ayrıntısı arazi.js'te, su su.js'te, düzlük/patika yerlesim.js'te, bitki/taş bitki.js'te, tek nesneler isaret.js'te (iş bölümü: TASARIM.md § 9).

   Taban kararı: prosedürel arazi AYNEN korunur (carpan 1). Gerekçe: (1) iki ırmak (Batı Irmağı, Nal Irmağı) algoritmadan geliyor; sınırda kopmadan
   sürmeleri ancak böyle kesin; (2) sınırda yükseklik farkı sıfır olduğundan geçiş bandında yapay şev oluşmaz; (3) makro kompozisyon (iki ırmak arasında
   yarımada-ova, kuzeydoğuda nal biçimli ırmak kıvrımının sardığı tepe, güneyde 130 m'lik sırt) zaten iyi; eksik olan orta ölçekli bölünme ve karakter.
   `engebe` bilerek YOK: bölgenin her yerine (ırmak yataklarına da) eklenir, yatakta kuru eşik/adacık çıkarır.
   varsayilan: 0 → bölgede yalnız tasarlanan nesneler var ("düzlük ortasında durup dururken kaya/ağaç olmaz"); bitki.js dolana kadar bölge çıplak görünür. */
(function () {
  const T = SO.tasarim;

  T.bolge({
    id: 'b001', ad: 'İki Irmak Arası (doğuş bölgesi)',
    // ≈ 4,3 km². Batı ve kuzey kenarı Batı Irmağı'nın karşı kıyısında, doğu kenarı Nal Tepe'nin ve Doğu Tepe'nin sırtında, güney kenarı Güney Sırtı'nın yamacında.
    sinir: [[840, -600], [1450, -720], [1860, -610], [2040, -340], [2180, 80], [2320, 380], [2320, 1250], [2200, 1860], [1300, 1900], [620, 1860], [260, 1560], [140, 1150], [330, 690], [720, 380], [790, -200]],
    gecis: 150,
    taban: { kip: 'prosedurel' },
    mikro: { genlik: .45, olcek: 24 },
    varsayilan: 0,
    dogus: { x: 1420, z: 1190, yon: 8 },   // Doğuş sekisi: güney yamacının dibi; kuzeye (hafif doğuya) bakar: solda göl, önde dere ve ırmak dirseği, sağ önde Nal Tepe
    sekiller: [
      { tip: 'tepe', ad: 'Nal Tepe gövdesi', merkez: [1805, 565], yaricap: [330, 250], aci: -42, yukseklik: 22, profil: 'yuvarlak', puruz: .3 },
      /* 1 · NAL TEPE DORUĞU: bölgenin ufuk hedefi. Yumuşak kubbeyi (≈ 105 m) sivri, kayalık bir doruğa (≈ 140 m) çevirir; sırt KD–GB uzanır, dik yüzü doğuşa bakar. */
      { tip: 'sirt', ad: 'Nal Tepe doruğu', profil: 'sivri', puruz: .45, kivrim: 18,
        cizgi: [[1640, 715, 6, 75], [1735, 635, 30, 95], [1835, 545, 56, 110], [1920, 440, 30, 100], [2000, 330, 5, 70]],
        kollar: [[[1835, 545, 40, 80], [1795, 445, 14, 80], [1770, 360, 2, 60]]] },

      /* 2 · ORTA SIRT: doğuş çanağını batı terasından ayıran ormanlık sırt (≈ 60 m). Gölün arkasında fon; batıyı ve Batı Irmağı'nı doğuştan gizler. */
      { tip: 'sirt', ad: 'Orta Sırt', profil: 'yuvarlak', puruz: .4, kivrim: 30,
        cizgi: [[850, 1410, 6, 90], [818, 1280, 18, 110], [800, 1150, 36, 130], [790, 1020, 40, 125], [772, 895, 22, 100], [748, 800, 3, 70]] },

      /* 3 · ÇANAK KOLU: güney yamacından kuzeye uzanıp doğuya kıvrılan hilal biçimli kol; arkasındaki Saklı Çanak'ı doğuş çanağından gizler. Ağzı kuzeydoğuda, ırmağa açılır. */
      { tip: 'sirt', ad: 'Çanak kolu', profil: 'yuvarlak', puruz: .4, kivrim: 14,
        cizgi: [[1655, 1380, 5, 70], [1632, 1265, 22, 90], [1640, 1150, 32, 95], [1688, 1052, 30, 90], [1762, 988, 18, 75], [1812, 958, 3, 50]] },
      { tip: 'tepe', ad: 'Saklı Çanak (taban)', merkez: [1778, 1150], yaricap: [115, 135], aci: 15, yukseklik: -7, profil: 'yuvarlak', puruz: .2 },

      /* 4 · YAR BURNU: güney yamacından çanağa doğru çıkan seki (üstü ≈ 45 m; kuzey yüzünü arazi.js uçuruma çevirir). Doğuşun arkasında, gölün tam güneyinde. */
      { tip: 'tepe', ad: 'Yar burnu', merkez: [1210, 1410], yaricap: [180, 95], aci: -4, yukseklik: 20, profil: 'plato', duz: .55, puruz: .25 },

      { tip: 'sirt', ad: 'Kartal Kayası', profil: 'sivri', puruz: .45, kivrim: 16,
        cizgi: [[900, 1640, 10, 90], [1010, 1650, 34, 110], [1110, 1625, 46, 125], [1200, 1640, 25, 100], [1290, 1662, 6, 80]] },
      /* 5 · GÜNEY BOĞAZI: güney sırtını aşan geçit (eşik ≈ 50 m); doğuş çanağını güneydoğudaki ırmak vadisine bağlar. Ana güney çıkışı. */
      // Not: kot bütün noktalarda AYNI olmalı (noktadan noktaya değişen kot, köşelerde yay biçimli basamak bırakıyor); iki ucun inişi doğal yamaçtan gelir.
      { tip: 'vadi', ad: 'Güney Boğazı', kot: 48, taban: .12, puruz: .35, kivrim: 16,
        cizgi: [[1520, 1462, 48, 55], [1590, 1518, 48, 68], [1675, 1562, 48, 75], [1815, 1622, 48, 75], [1900, 1665, 48, 60]] },

      /* 6 · KORU TEPESİ: kuzey dilinin ormanlık tepesi (≈ 56 m). Boğaz'ın ardında kuzey ufkunu kapatır; arkasındaki Kuzey Boynu'nu gizler. */
      { tip: 'tepe', ad: 'Koru Tepesi', merkez: [1195, -285], yaricap: [235, 190], aci: 20, yukseklik: 17, profil: 'yuvarlak', puruz: .4 },

      /* 7 · BOĞAZ TÜMSEĞİ: iki ırmağın 300 m'ye yaklaştığı boyunda, yolu ikiye ayıran kayalık tümsek (≈ 20 m). */
      { tip: 'tepe', ad: 'Boğaz tümseği', merkez: [1150, 425], yaricap: [85, 65], aci: 70, yukseklik: 12, profil: 'sivri', puruz: .4 },

      /* 7b · GÖL TEPECİĞİ: gölün kuzeyinde alçak, ormanlık tepe (≈ 25 m). Çanağın düzlüğünü böler; Boğaz'ı ve kuzey dilini doğuştan yarı gizler. */
      { tip: 'tepe', ad: 'Göl Tepeciği', merkez: [1175, 895], yaricap: [150, 105], aci: 25, yukseklik: 15, profil: 'yuvarlak', puruz: .4 },

      /* 8 · GÖL ÇANAĞI: çanağın en alçak yerini su düzeyine yaklaştırır (≈ +1 m); su.js buraya Ayna Göl'ü koyar. */
      { tip: 'vadi', ad: 'Göl çanağı', kot: 1, genislik: 95, taban: .5, puruz: .2, kivrim: 10, cizgi: [[1165, 1085], [1240, 1062], [1310, 1050]] },

      /* 9 · DOĞUŞ SEKİSİ: yamaç dibinde, çanağa bakan alçak seki (≈ +4 m). */
      { tip: 'tepe', ad: 'Doğuş sekisi', merkez: [1428, 1205], yaricap: [70, 50], aci: 10, yukseklik: 4, profil: 'plato', duz: .5, puruz: .15 }
    ],

    /* İLGİ NOKTALARININ ANA LİSTESİ. Buradaki koordinatlar hedeftir: uzmanlar düzlüğü, geçidi, işareti BU noktaya (± 20 m) kurar ve aynı noktayı kendi
       dosyalarında yeniden YAZMAZ (çift sayılır). Kendi dosyalarına yalnız burada olmayan noktaları eklerler (kaynak kümeleri, küçük işaretler, ek düğümler). */
    noktalar: [
      // yerleşim alanları (6): düzlüğü yerlesim.js kurar
      { id: 'y1', tur: 'yerlesim', ad: 'Dere Ağzı', x: 1345, z: 905, yaricap: 40 },        // ırmak dirseği + dere ağzı düzlüğü (y ≈ 5,5)
      { id: 'y2', tur: 'yerlesim', ad: 'Göl Başı', x: 1368, z: 1122, yaricap: 38 },        // göl kıyısı; doğuşa en yakın (y ≈ 5)
      { id: 'y3', tur: 'yerlesim', ad: 'Yar Sekisi', x: 1195, z: 1425, yaricap: 45 },      // uçurum üstü plato (y ≈ 62)
      { id: 'y4', tur: 'yerlesim', ad: 'Saklı Çanak', x: 1775, z: 1150, yaricap: 42 },     // korunaklı çanak vadi (y ≈ 23)
      { id: 'y5', tur: 'yerlesim', ad: 'Koru Açıklığı', x: 1150, z: -30, yaricap: 40 },    // orman açıklığı (y ≈ 28)
      { id: 'y6', tur: 'yerlesim', ad: 'Sığlık Başı', x: 560, z: 945, yaricap: 38 },       // batı geçidinin yanı, ırmak üstü teras (y ≈ 13)
      // arazi işaretleri (uzaktan görülen hedefler; nesne DEĞİL arazi biçimi: nesneler 440 m'den öte çizilmez)
      { id: 'i_nal', tur: 'isaret', ad: 'Nal Tepe doruğu', x: 1805, z: 553, yukseklik: 3 },
      { id: 'i_kartal', tur: 'isaret', ad: 'Kartal Kayası', x: 1110, z: 1627, yukseklik: 3 },
      { id: 'i_koru', tur: 'isaret', ad: 'Koru Tepesi', x: 1197, z: -288, yukseklik: 8 },
      { id: 'i_yar', tur: 'isaret', ad: 'Yar (uçurum yüzü)', x: 1190, z: 1372, yukseklik: 2 },
      { id: 'i_orta', tur: 'isaret', ad: 'Orta Sırt', x: 797, z: 1095, yukseklik: 6 },
      { id: 'i_bogaz', tur: 'isaret', ad: 'Boğaz tümseği', x: 1150, z: 425, yukseklik: 5 },
      // manzara noktaları
      { id: 'm_nal', tur: 'manzara', ad: 'Nal doruğu seyri', x: 1800, z: 560 },
      { id: 'm_yar', tur: 'manzara', ad: 'Yar kenarı', x: 1190, z: 1388 },
      { id: 'm_orta', tur: 'manzara', ad: 'Orta Sırt seyri', x: 797, z: 1085 },
      { id: 'm_koru', tur: 'manzara', ad: 'Koru Tepesi seyri', x: 1200, z: -300 },
      // geçitler ve çıkışlar (sığ geçitleri su.js kurar)
      { id: 'g_guney', tur: 'gecit', ad: 'Güney Boğazı', x: 1680, z: 1562, yaricap: 50 },
      { id: 'g_kuzey', tur: 'gecit', ad: 'Kuzey Boynu', x: 1545, z: -400, yaricap: 60 },
      { id: 'g_kistak', tur: 'gecit', ad: 'Kıstak', x: 2000, z: 852, yaricap: 35 },
      { id: 'g_bati', tur: 'gecit', ad: 'Batı Sığlığı', x: 590, z: 790, yaricap: 25 },
      { id: 'g_dirsek', tur: 'gecit', ad: 'Dirsek Sığlığı', x: 1560, z: 895, yaricap: 25 },
      { id: 'g_nal', tur: 'gecit', ad: 'Nal Sığlığı', x: 1305, z: 479, yaricap: 25 },
      { id: 'g_dere', tur: 'gecit', ad: 'Dere geçidi', x: 1405, z: 958, yaricap: 15 },
      { id: 'g_bogaz', tur: 'gecit', ad: 'Boğaz', x: 1210, z: 400, yaricap: 60 },
      { id: 'g_canak', tur: 'gecit', ad: 'Çanak ağzı', x: 1825, z: 1005, yaricap: 30 },
      // patika ağının ana düğümleri (patikaları su.js çizer; uçlar bu noktalarda buluşur)
      { id: 'd_seki', tur: 'dugum', ad: 'Seki altı', x: 1415, z: 1150 },
      { id: 'd_dirsek', tur: 'dugum', ad: 'Dirsek çatalı', x: 1440, z: 940 },
      { id: 'd_gol', tur: 'dugum', ad: 'Göl kuzeyi', x: 1215, z: 985 },
      { id: 'd_burun', tur: 'dugum', ad: 'Sırt burnu', x: 770, z: 770 },
      { id: 'd_bogaz', tur: 'dugum', ad: 'Boğaz çatalı', x: 1185, z: 560 },
      { id: 'd_yar', tur: 'dugum', ad: 'Yar rampası başı', x: 1395, z: 1335 }
    ]
  });

  /* Doğuş düzlüğü: bütün katmanlardan sonra (sira 36) uygulanır; hangi uzman ne yaparsa yapsın doğuş noktası düz kalır. Doğuşun 40 m çevresi baş tasarımcınındır. */
  T.bolge({ id: 'b001', katman: 'bolge', sira: 36, sekiller: [
    { tip: 'duzluk', ad: 'Doğuş', alan: { daire: [1420, 1190, 9] }, kenar: 16, mikro: .3 }
  ] });
})();
