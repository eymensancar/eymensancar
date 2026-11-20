# Mutfak turu: bağlama notları (oyun.js'i bağlayacak ajan için)

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
