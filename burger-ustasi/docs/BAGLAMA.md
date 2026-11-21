> **Eskidi (7. tur, 21 Kasım):** `mutfak.js` ve `burger.js` silindi; mutfak artık Eymen'in resmi (`docs/TASARIM.md` → "7. tur"). Bu notlar tarih için duruyor.

# Mutfak turu: bağlama notları (oyun.js'i bağlayacak ajan için)

**Müşteriler tezgâhın arkasında (6. tur):** sol sütun kalktı; `ciz({katman:'on'})`, `YER.musteri/musteri4/yuz/balon/servis`, `SERVIS_Y` eklendi. Ayrıntı `TASARIM.md` → 6. bölüm. Aşağıdaki "müşteri sütunu" notları eskidi.

**Bağlandı (21 Kasım):** üç modül oyuna bağlandı; ne nasıl kullanıldı `TASARIM.md` → "Bağlandı (mutfak turu)". Bağlarken eklenenler: `MUTFAK.ciz({vb})` (görünür alan sahnenin dışına uzar: duvar, tezgâh, lamba kabloları, baca), `BURGER.siparis(...,{sutun, enAzSutun})` (dar baloncukta sütun sayısı).

## veri.js (ekonomi ajanının raporu, 21 Kasım)
Değişmeyenler: acik, eskiSahip, siradaki, fiyatAc, alabilir, kira, gunSonu, katmanMaliyet, katmanSatis, bahsis, ruh, yuz, pisme, siparis(gun,R,sahip) (yalnız katman dizisi döner).
Genişleyenler (eski çağrılar aynı): maliyet(katmanlar, yan?) ({katmanlar,yan} de kabul); fiyat(siparis, up, yan?); dogruMu (nesne biçimi; içinde yan ürün olan burger hep yanlış); odeme (dizi → eski; nesne → odemeTam); sabirSiparis (yan ürünlü sipariş +5 sn); gun() yeni alanlar: yanOlas, izgara (göz sayısı).
Yeniler:
- YAN=['fries','onionring'], YAN_STOK_MAX=3, IZGARA_MAX=6; MALZEME[i].tur='katman'|'yan'.
- yanMi(k), acikKatman(sahip), acikYan(sahip), yanOlas(gun,sahip).
- izgaraGoz(up)=2+slot (en çok 6); GELISTIR.slot.max=4 (fiyatlar 800, 2500, 7000, 18000).
- yanPisme(up,k='fries') sn (fries 5, onionring 6; hızlı ızgara düzeyi başına −0,5; en az 2,5).
- siparisTam(gun,R,sahip) → {katmanlar, yan:null|'fries'|'onionring'}.
- yeniDurum(siparis) → {siparis, burger, yan, maliyet, bitti} (müşteri başına bir tane).
- eksikParca(durum) → ör. ['burger','fries'].
- teslimParca(durum, parca, f, up, seri) → {sonuc:'parca'|'tamam'|'yanlis', durum, dogru, ruh, ucret, bahsis, kayip, can, sabirEk, eksik}. parca: katman dizisi (burger) | yan anahtarı | {katmanlar,yan}. Dönen durum yeni nesne: müşteride sakla. 'parca' → c.p=min(c.max, c.p+sabirEk*c.max) (ilk doğru parça sabrı %15 yeniler, müşteri başına bir kez). 'tamam'/'yanlis' → müşteri gider.
- odemeTam(siparis,{katmanlar,yanVerilen},f,up,seri).
Kurallar: fritöz dokunuşu bir porsiyon pişirir, maliyet konunca düşer; hazır kutusu 3; doluysa sepette bekler. Müşteri en çok bir yan ürün ister; ödeme burger + yan ürün tamamlanınca; yanlış parça = ödeme yok, can gider, kayıp = o müşteriye verilen her şeyin maliyeti. Kızgın tamamlamada ödeme yok, can gitmez.
Dikkat: tepsi/küvetler yalnız katmanlardan kurulmalı (yanMi/acikKatman ile süz); buildGrill → VERI.izgaraGoz(SAVE.up); "3. ızgara gözü" metni güncellenmeli; eski kayıtta slot:1 = 3 göz; eski kayıtta onionring sahipse yalnız yan ürün olarak görünür.

## mutfak.js (sahne ajanının raporu)
BU.MUTFAK = {ciz({aksam,ek}), YER, IC, kilit, izgaraGoz(durum: bos|cig|pisiyor|hazir|kilitli), duman, neon, kuvetKapak, cam, kasik, CSS, KUV_UST, KUV_ALT, GOZ_DURUM}. Sahne viewBox 1600×900. İçerik YER dikdörtgeninin IC kenar payı kadar içine oturur (küvet 10, sos 12, yanHazir 14, fritöz 10, ızgara gözü 8, hazır tepsisi 10). cam() ekmeklerin üstüne (YER.ekmek). 852×393'te sahne %75 genişlikteyken (639 px) küvet 77×45, ızgara gözü 62×45, sos 69×44, tahta yeri 119×44 px: sahne bundan daralırsa 44 pt altına düşer; müşteri sütununu buna göre boyutlandır (gerekirse dokunma alanlarını görünmez büyüt).

## burger.js (çizim ajanının raporu)
- KATMAN.mayo eklendi; onionring KATMAN'dan çıktı (yigin onu sessizce atlar). oyun.js'te tek katmanlı çizimler ve malzeme listeleri onu hâlâ burger malzemesi sayıyorsa düzelt.
- src()/simge(): mayo → g/s-mayo.svg, fries → g/s-fries.svg; onionring simgesi duruyor.
- Hepsi tam <svg> metni döndürür, son parametre o isteğe bağlı ({x,y,w,h} verilirse dış SVG'ye gömülür; {sinif}):
  - kuvetIci(k,o) viewBox 0 0 200 120 (11 malzeme: lettuce,tomato,pickle,onion,cheese,bacon,mushroom,jalapeno,egg,avocado,premium). Küvet iç alanı 174×92: tam doldurmak için preserveAspectRatio="none" denenebilir (denetlenmedi).
  - ekmekDolabi(o) 0 0 200 140 (o.arka:false arka planı kaldırır); cam mutfak.js'te.
  - sosKase(k,o) 0 0 200 120 ('sauce'|'mayo'); dolgu opak, kaşık deliği yok: mutfak.js'in kaşık sapı kâse dolgusunun ÜSTÜNE çizilmeli (ya da sosKasik(k,o) 0 0 200 200 kullan).
  - yan(k,durum,o): 'cig'|'pisiyor'|'hazir' fritöz sepeti içi, üstten, 0 0 140 200 (dikey); {yandan:true} yandan sepet 0 0 200 160; 'kutu' hazır tepsisi şeridi 0 0 200 88 (o.adet 1–3); {tek:true} tek servis kutusu 0 0 200 160 (elde/uçarken).
  - Listeler: KUVETLER, YANLAR, YAN_DURUM.
- siparis(katmanlar,{gen,yan:['fries'],alindi}) yan ürünü ince ayraçla sağda gösterir; alindi yan ürünü de soldurur ({fries:1}).
- CSS BU.BURGER.CSS içinde (yeni sınıflar bu-yanli, bu-ayrac, bu-yan-*, bu-kuvet-ici, bu-dolap, bu-sos…; animasyonlar bu-kab, bu-buhar, bu-par).
