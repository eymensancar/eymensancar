/* b001 — katman 'isaret' (sıra 50): 13 işaret nesnesi, sığlık uçlarının büyük kayaları, gizli yerlerin atmosfer nesneleri, ek ilgi noktaları.
   Kılavuz: tasarim/KILAVUZ.md · Plan: TASARIM.md § 7 ve § 10-D (İ1–İ3). Sahibi: bitki ve işaret uzmanı.

   Kural: nesneler ≈ 440 m'den öte çizilmez; her işaret, görülmesi gereken noktaya ≤ 400 m'dir ve bir görüş çizgisinin ucunda, bir yol çatalında ya da
   bir gizli yerin girişinde durur. Uzak hedefler (Nal doruğu, Kartal Kayası, Koru Tepesi) arazi biçimidir ve bolge.js'te tanımlıdır.
   Görsel dil: DEV AĞAÇ = "burada su/üs yeri var" · SİVRİ TAŞ = "buraya tırmanılır / buradan geçilir" (uzaktan) · DİKİLİ TAŞ = "yol burada ayrılıyor / geçit burada" (yakından)
   · TAŞ KAPI = bölge çıkışı · YIKIK DUVAR = gizli yerin ödülü · İKİ BÜYÜK KAYA = sığ geçidin iki ucu.
   Not: bogazdikit, naldikit ve gaga için ayrı `isaret` noktası YAZILMADI: aynı koordinatta bolge.js'in arazi işaretleri (i_bogaz, i_nal, i_kartal) var (çift sayılmasın). */
SO.tasarim.bolge({
  id: 'b001', katman: 'isaret',
  sekiller: [],
  alanlar: [],
  nesneler: [
    /* ---- İ1 · 13 işaret nesnesi (koordinatlar plandaki gibi) ---- */
    { id: 'ulu', tur: 'devAgac', x: 1345, z: 1068, ry: .6 },                 // Ulu Çınar: göl ayağının doğu kıyısı. Doğuştan 145 m, 328°: ilk karenin sol yarısı
    { id: 'igne', tur: 'sivriTas', x: 1582, z: 848, s: 1.3, ry: 1.9 },        // İğne: Dirsek Sığlığı'nın karşı ucu, Nal patikasının başı. PLANDAN SAPMA (plan: 1588,812): nesneler 350 m'den sonra küçülüyor (440'ta sıfır); 415 m'de İğne görünmüyordu → doğuşa 377 m'ye çekildi ve 1,3 kat büyütüldü
    { id: 'yardisi', tur: 'sivriTas', x: 1118, z: 1368, s: .9, ry: .4 },      // Yar dişi: uçurumun batı ucu. Doğuştan 350 m (arkada, 239°); göl kıyısından ufuk çizgisinde
    { id: 'kapi', tur: 'tasKapi', x: 1998, z: 856, s: 1.3, ry: 2.44 },        // Kıstak kapısı: yola dik (yol 140° yönünde geçer); s 1,3 → açıklık ≈ 4 m (yol 3,5 m)
    { id: 'canakdikit', tur: 'anitTas', x: 1836, z: 990, ry: 1.2 },           // Çanak ağzının doğu yanı: gizli patikanın tek ipucu (ırmak yolundan 30 m)
    { id: 'canakduvar', tur: 'yikikDuvar', x: 1802, z: 1118, s: 1.25, ry: .25 },   // Saklı Çanak'ta düzlüğün kenarı: ağızdan girene yüzünü döner
    { id: 'bogazdikit', tur: 'anitTas', x: 1150, z: 425, s: 1.2, ry: 2.8 },   // Boğaz tümseğinin tepesi: boynun işareti, iki yolu ayırır
    { id: 'ata', tur: 'devAgac', x: 1188, z: -108, s: 1.1, ry: 2.3 },         // Ata ağacı: Koru Açıklığı'nın kuzey ucu; ormanın üstünden taşar
    { id: 'naldikit', tur: 'anitTas', x: 1806, z: 556, s: 1.15, ry: .9 },     // Nal doruğu: zirve ödülü
    { id: 'kovukduvar', tur: 'yikikDuvar', x: 1880, z: 380, s: 1.2, ry: -.4 },    // Kovuk: doruktan bakana yüzünü döner
    { id: 'gaga', tur: 'sivriTas', x: 1112, z: 1622, s: .8, ry: 3.0 },        // Kartal Kayası doruğu: Yar Sekisi'nden 200 m; "bir sonraki hedef"
    { id: 'siglikdikit', tur: 'anitTas', x: 612, z: 812, s: 1.2, ry: 1.7 },   // Batı Sığlığı'nın doğu ucu: Sırt burnundan 160 m
    { id: 'guneydikit', tur: 'anitTas', x: 1592, z: 1508, s: 1.2, ry: .2 },   // Güney Boğazı'nın kuzey ağzı: Yar rampası başından 260 m

    /* ---- İ2 · büyük tek kayalar: her sığ geçidin iki ucunda birer iri kaya ("iki büyük kaya = geçit"); göl ayağında bir tane ---- */
    { id: 'k_bati_d', tur: 'kaya', x: 628, z: 822, s: 3.1, ry: .8 }, { id: 'k_bati_b', tur: 'kaya', x: 548, z: 758, s: 2.7, ry: 2.2 },
    { id: 'k_dirsek_g', tur: 'kaya', x: 1572, z: 937, s: 3.0, ry: 1.4 }, { id: 'k_dirsek_k', tur: 'kaya', x: 1546, z: 857, s: 2.6, ry: .3 },
    { id: 'k_nal_b', tur: 'kaya', x: 1254, z: 466, s: 2.8, ry: 2.9 }, { id: 'k_nal_d', tur: 'kaya', x: 1346, z: 490, s: 2.6, ry: 1.0 },
    { id: 'k_golayagi', tur: 'kaya', x: 1329, z: 1035, s: 2.6, ry: 1.8 },

    /* ---- gizli yerlerin atmosferi ---- */
    { id: 'canak_yasli', tur: 'yaprakli1', x: 1811, z: 1127, s: 1.9, ry: 1.1 },     // Saklı Çanak: duvarın dibinde yaşlı ağaç ("burada biri yaşamış")
    { id: 'canak_c1', tur: 'cali', x: 1797, z: 1114, s: 1.1 }, { id: 'canak_c2', tur: 'cali', x: 1806, z: 1112, s: .8 },
    { id: 'kovuk_k1', tur: 'kaya', x: 1870, z: 372, s: 1.6, ry: .5 }, { id: 'kovuk_k2', tur: 'duzOrta', x: 1888, z: 388, s: 1.2, ry: 2.0 }, { id: 'kovuk_c1', tur: 'cali', x: 1876, z: 386, s: 1.0 }
  ],
  noktalar: [
    { id: 'i_ulu', tur: 'isaret', ad: 'Ulu Çınar', x: 1345, z: 1068, yukseklik: 20 },
    { id: 'i_igne', tur: 'isaret', ad: 'İğne', x: 1582, z: 848, yukseklik: 12 },
    { id: 'i_yardisi', tur: 'isaret', ad: 'Yar dişi', x: 1118, z: 1368, yukseklik: 9 },
    { id: 'i_kapi', tur: 'isaret', ad: 'Kıstak kapısı', x: 1998, z: 856, yukseklik: 6 },
    { id: 'i_canakdikit', tur: 'isaret', ad: 'Çanak dikili taşı', x: 1836, z: 990, yukseklik: 4 },
    { id: 'i_canakduvar', tur: 'isaret', ad: 'Çanak yıkık duvarı', x: 1802, z: 1118, yukseklik: 3 },
    { id: 'i_ata', tur: 'isaret', ad: 'Ata ağacı', x: 1188, z: -108, yukseklik: 22 },
    { id: 'i_kovuk', tur: 'isaret', ad: 'Kovuk (yıkık duvar)', x: 1880, z: 380, yukseklik: 3 },
    { id: 'i_siglikdikit', tur: 'isaret', ad: 'Sığlık dikili taşı', x: 612, z: 812, yukseklik: 4 },
    { id: 'i_guneydikit', tur: 'isaret', ad: 'Güney Boğazı dikili taşı', x: 1592, z: 1508, yukseklik: 4 },
    /* İ3 · ek manzara noktaları */
    { id: 'm_kistak', tur: 'manzara', ad: 'Kıstak burnu', x: 1960, z: 905 },
    { id: 'm_golguney', tur: 'manzara', ad: 'Göl güney kıyısı', x: 1220, z: 1160 }
  ]
});
