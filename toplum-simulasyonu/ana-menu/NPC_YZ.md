# NPC yapay zekâsı

Toplum Simülasyonu'nun çevrimdışı sürümünde dünyayı NPC'ler doldurur. Eymen'in hedefi: "Gerçek insan gibi olur, oynayan kişi ayırt edemez." Ama oyun hiçbir zaman "gerçek insanlarla oynuyorsun" demez; bir NPC'ye doğrudan "bot musun?" diye sorulursa oyunun bir karakteri olduğunu söyler, yalan söylemez.

Dosyalar (`toplum-simulasyonu/ana-menu/`):

| Dosya | Ne yapar |
| --- | --- |
| `npc-yz.js` | Beyin: kimlik, kişilik, kararlar, duygu, hafıza, ilişkiler, sohbet akışı, başvurular, çalışanlar, teklifler, yönetici, dönüş raporu, sıralama |
| `npc-dil.js` | Türkçe dil motoru: niyet anlama, varlık çıkarma (tutar, meslek, mülk, yer, kişi), cümle üretimi (şablonlar), konuşma üslubu, ek uyumu, ad ve yer verisi |
| `toplum-cekirdek.js` | Amca'nın ekonomi çekirdeği (değiştirilmedi, esbuild ile paketlendi) |
| `tools/npc-test.cjs` | Tarayıcısız test: 70 NPC, 150 gün ön yaşam, 2 yıl simülasyon, defter, çeşitlilik, sohbet, başvuru, çalışan, teklif, rapor |
| `tools/npc-dil-test.cjs` | Dil motoru testi (niyet doğruluğu, ek uyumu, şablonların hepsi) |

Sunucu gerekmez, ücretli yapay zekâ servisi kullanılmaz: her şey telefonda çalışır (bütçe kararı: sunucu ayda 20-25 $). Gün başına NPC hesabı 1 ms civarında.

## 1. NPC'ler gerçek oyuncu gibi yaşar

- Her NPC, çekirdekte `addPlayer` ile açılmış gerçek bir oyuncudur: 100.000 TL ile başlar, aynı meslek, kurs, mülk, kredi ve işletme kurallarına uyar. Maaşı, gideri ve vergisi aynı ay sonu hesabından geçer.
- Para hiçbir zaman elle yaratılmaz; bütün hareketler çekirdeğin işlemleriyle olur. Testte 2 yıl sonra `ledgerDiscrepancy = 0`.
- Yeni oyun 150 günlük "ön yaşam"la başlar: oyuncu geldiğinde dünyada kariyerini ilerletmiş, kurs almış, iş kurmuş insanlar vardır. Nüfus zamanla 70'e kadar büyür (sunucuya yeni katılanlar).
- Global kanal ve dünya sıralaması için 40 yabancı oyuncu profili tutulur (İngilizce, Almanca, İspanyolca, Azerice, Arapça). Bunlar çekirdeğe girmez.

## 2. Kimlik ve kişilik

- Ad, soyad ya da takma ad ("selin.k", "burak_34"), ilçe ve şehir; aynı ad iki kez kullanılmaz.
- 10 arketip: çalışkan genç, temkinli memur, girişimci, yatırımcı, usta, sosyal kelebek, sessiz, keyfine düşkün, hırslı kariyerci, hayırsever. Her arketip bir hedef yolu belirler (güvenli iş, kendi işi, emlak, ustalık, kariyer).
- 14 özellik (0-1 arası, arketip ortalaması ve kişiye özgü sapma): çalışkanlık, hırs, risk, tutumluluk, cömertlik, sosyallik, mizah, resmiyet, emoji, kısaltma, yazım hatası, sadakat, sabır, dürüstlük.
- Kronotip (sabahçı, akşamcı, gececi, düzenli): gerçek saate göre kim çevrimiçi, kim yazıyor.

## 3. Kararlar (fayda tabanlı)

- **Her gün:** oyuna girip girmediği çalışkanlığa bağlıdır. Girdiyse çalışkanlığı, ruh hali ve para sıkıntısı kadar görev yapar.
- **Birkaç günde bir (hırslı olan daha sık) stratejik karar:** her olası hamleye puan verir, en iyisi eşiği geçerse yapar.
  - Daha iyi meslek: beklenen gelir artışı × hırs + hedefe uygunluk − yeni işi hemen bırakmama payı − işletme riski.
  - Hedef yolundaki kurs (parası ve tamponu yetiyorsa); Kum Saati kursa harcanır.
  - Ev alma (peşin ya da konut kredisiyle, içine taşınır); yatırımcı ve zengin olan kiralık daire, dükkân ya da arsa alır.
  - Borç kapama (tutumlu), bağış (cömert; bayramda iki kat itibar), riskçi için ihtiyaç kredisi.
  - Kriz: para bitince önce arsa, sonra kiradaki mülkü satar.
- **Tasarruf tamponu:** tutumluluğa göre 1,5 ile 5 aylık gider arası. Yöneticinin harcama eğilimi bunu ayarlar.

## 4. Duygu ve hafıza

- **Ruh hali** (−1…1): terfi, ev, kurs bitirme yükseltir; kötü ay, iflas, işten çıkarılma düşürür. Zamanla kişinin doğal neşesine döner. Konuşma tonunu ve emojiyi etkiler.
- **Oyuncuyla ilişki:** sevgi, güven, tanışıklık, mesaj sayısı, konuşulan konular, hakaret sayısı. Etkiledikleri:
  - tanıdık NPC adınla selamlar;
  - aranız iyiyse ilanına daha çok başvurur ve pazarlıkta daha çok esner;
  - hakaret edersen ilişki bozulur.

## 5. Sohbet

- **Kanal akışı gerçek zamanlıdır:** kanalı açınca, son bakıştan beri yazılanlar gelir. Mesaj sıklığı saate ve kimin çevrimiçi olduğuna göre değişir.
- **NPC'ler önce kendi gerçek hayatlarından yazar:**
  - "muhasebe kursunu bitirdim", "Kadıköy'de dükkân açtım", "bu ay iyi geçti";
  - kendi işletmesinde boş kadro varsa eleman ilanı, satmak istediği mülkü varsa satılık ilanı;
  - sabah günaydın, akşam iyi geceler;
  - bayram ve özel günler, ekonomi sohbetleri, birbirlerine sorular.
- **NPC'ler birbirine de cevap verir** (mesajların yaklaşık %28'i bir önceki mesaja cevap).
- **Oyuncu yazınca niyet anlaşılır:** selam, iş arıyorum, eleman arıyorum, mülk, ekonomi, tavsiye, dert, bot musun, hakaret… gibi 30'dan fazla niyet. Cevabı kim verir:
  - adını andığın kişi her zaman cevap verir;
  - yoksa konuya uygun 0-2 kişi cevap verir: işletme sahibi iş teklif eder; yatırımcı ve muhasebeci ekonomiyi anlatır; zengin ve cömert olan tavsiye verir.
- **Tavsiyeler oyuncunun gerçek durumundan hesaplanır:** "şartlarını tuttuğun en iyi iş şu, ayda şu kadar", ya da "şu kurs şu işi açar, şu kadar tutar".
- **"Yazıyor…" göstergesi:** her NPC'nin yazma hızı farklı; cevaplar sırayla gelir.
- **Kurallar:**
  - Küfür ve hakarette NPC'ler küfürsüz uyarır.
  - Üçüncü seferde sistem uyarısı çıkar.
  - Engelle ve şikâyet et var.
  - Siyaset, savaş, terör ve din/etnik çatışma konuşulmaz.
- **Bağlam (diyalog durumu):** kanal başına 5 dakikalık konu hafızası (özel mesajda 30 dakika). Kısa takip soruları ("peki garson", "kaç gün sürüyor", "neden olabilir") önceki konuya bağlanır, önceki mesaj soruya eklenip cevaplanır.
- **Gerçek bilgi katmanı (`bilgi`):** cevaplar oyunun verisinden kurulur. Konular:
  - meslek kazancı, kurs ücreti ve süresi, işletme maliyeti, kademe şartları, asgari ücret;
  - mülk fiyatı, kira getirisi, kredi limiti ve notu, kredi reddinin sebebi;
  - enflasyon, mevduatın olmaması, hayır eserinin itibarı, sıradaki bayram.
- **Bir mesajda en çok iki bilgi.** Aynı bilgi aynı kişide yinelenmez:
  - Soru aynıysa "az önce yazmıştım" der.
  - Soru değiştiyse ya yalnız sorulan parçayı söyler ("evet, bitince memur olabiliyorsun") ya da bilmediğini dürüstçe söyler.
- **Roller korunur:**
  - Danışman sonradan aday olmaz.
  - "Sen alır mısın" sorusu konuşmadaki kişiye gider.
  - Kanalda olmayan birine hitap edilince "bugün girmedi galiba" denir.
  - Kurye ve memur için işveren gerekmediği söylenir.
- **İnsan gibi:**
  - Bilmediği soruya çoğu kişi hiç yazmaz.
  - Aynı cümleyi iki kişi yazmaz, kalıp açılışları ("Kusura bakma geç gördüm") tekrarlanmaz.
  - Vedalaşan kişi saatlerce yazmaz.
  - Oyuncuyla aynı adı taşıyan NPC başka ada geçer.
  - Gece kanal sessiz, akşam yoğundur; ilk girişte son 40 dakikanın geçmişi görünür.
- **Şirket kanalı:** çalışanlar çalışan gibi konuşur. Görev sayısı, ciro ve maaş gününe kalan gün gerçektir; yönetici cümleleri yalnız müdürdedir.
- **Global kanal:** yabancılar kendi dillerinde yazar. Bir kerelik olayları ("ilk evimi aldım") birer kez yaşanır. Selama, "where are you from" sorusuna, teşekküre ve vedaya uygun cevap verirler.
- **İlgiye göre sohbet (`oyuncu-ilgi.js`, kayıt `K.ilgi`, cihazdan çıkmaz):**
  - Sayılanlar: hangi ekrana, panele (Kariyer sekmesiyle), telefon uygulamasına ve kanala kaç kez girildiği ve ne kadar kalındığı; bakılan meslek, kurs, mülk, kredi, bağış; yapılan eylemler; ayar değişiklikleri (tema, yapay zekâ izni; ileride ses ve titreşim de `ilgiAyar` ile); oturum sayısı ve süresi, son çıkış, saat dağılımı, üst üste gelinen gün. Tıklamalar tek bir yakalayıcıdan, yer değişimi `ekran()`, `panelCiz()`, telefon ve sohbet geçişlerinden.
  - Boyut sınırlı: anahtar başına sayaç (en çok 64), son 40 olaylık halka, konu başına tek sıcaklık puanı (45 dakikada yarıya iner). 5000 olaydan sonra yaklaşık 3 KB.
  - İlgi profili: en sıcak konular (iş, eleman, kredi, kurs, mülk, görev, kum saati, işletme, sıralama, bağış) ve benimseme (ayar yapmış mı, kaç gün üst üste, kaç oturum, ortalama süre).
  - Kanal (yalnız Türkiye ve Global; Şirket'te yok): yeni ipliklerin yaklaşık üçte biri oyuncunun ilgi konularından seçilir (iki haftadan sonra beşte bir). Kanala uzun aradan sonra girilince (en az 5 dk, sonra 12 dk arayla, her girişte değil) son 2-3 dakikaya konuyla ilgili bir **ilgi ipliği** yerleşir: soru, cevap, araya girenler, farklı NPC'ler; kalanı oyuncu bakarken akar. İlgi iplikleri ayrı havuzda (`tools/iplik/ilgi-*.json` → `NPCIplik.ilgi`), normal akışa girmez; aynısı art arda gelmez.
  - **Tiyolar** (yalnız Türkiye kanalı, arayüzün gerçek adlarıyla): oyuncunun henüz yapmadığı şeyler (Kariyer, Görev yap, DM ve Mesajlar, günlük 3 görev = kum saati, telefon, Kurslar, Banka, Mülklerim, Kum Saati ile hızlandır, patronsa İş ilanı oluştur). Yapınca o tiyo bir daha gelmez. İlk iki hafta sık (aynı tiyo en çok 3 kez, 3 saat arayla), sonra seyrek (6 saatte bir, aynı tiyo 3 günde bir).
  - İş ilanlarına çok bakan işçiye arada bir (günde en çok bir) boş kadrosu olan bir işletme sahibi özelden gerçek iş teklifi yazar (`NPCYZ.ilgiIsTeklifi`).
  - Test: `tools/ilgi-test.cjs` (Playwright).
- **Ölçüm:** `tools/sohbet-sinav.cjs` (iki kör set; geliştirme kısımları ayar için, saklı kısımlar yalnız rapor için). Niyet modeli `tools/niyet-egit.cjs` ile eğitilir. Eğitim verisi: korpus3 (sentetik) ve geliştirme setleri; saklı setler eğitimde kullanılmaz.

## 6. Ekonomik ilişkiler (gerçek işlemler)

- **İlanına başvurular:** yalnız o mesleğe uygun gerçek NPC'ler başvurur.
  - Başvurup başvurmaması ilan maaşının kendi kazancına oranına, senin itibarına, aranızdaki ilişkiye ve gizli şansa bağlıdır. Kendi işi daha iyi kazandıran düşük maaşa başvurmaz.
  - Her adayın istediği bir maaş, bir de gizli kabul sınırı vardır. Altında teklif verirsen karşı teklif yapar.
- **İşe alma çekirdekte olur** (`hireEmployee`): çalışan gerçekten görev yapar, maaşı işletme kasasından ödenir.
- **Çalışan morali:** maaşın piyasa değerine oranı (başka yerde kazanabileceği en iyi gelir), aranızdaki ilişki, ruh hali ve sadakate göre değişir.
  - Moral düşerse özel mesajla zam ister (istediği tutarla).
  - Maaş kesilirse 2 gün sonra konuşur.
  - İsteği 5 gün cevapsız kalır ve morali düşük kalırsa 3 gün önceden haber verip istifa eder; zam yaparsan vazgeçer.
  - Çıkarılınca tepki verir, diğer çalışanların morali biraz düşer.
- **Teklifler** (özel mesajla gelir: kabul, ret ya da pazarlık):
  - NPC kiradaki mülkünü ya da arsanı satın almak ister (`sellPropertyToPlayer`).
  - "Mülk arıyorum" dersen biri sana satmayı teklif eder.
  - Bir NPC işletmesi sana iş teklif eder (kabul edersen onun yanında çalışırsın).
- **Maaş görüşmesi:** bir NPC'nin yanında çalışıyorsan ondan zam isteyebilirsin. Karar bu ayki çalışmana, aranızdaki ilişkiye, işletmenin kasasına, işverenin cömertliğine ve tutumluluğuna bağlıdır.
- **Yetki talebi:** kurucu güvenine, ilişkinize, yetkinin ağırlığına ve mesajın nezaketine bakar. Verebilir ya da reddedebilir.

## 7. Yönetici (oyun dengeleyici) ve gizli şans

- **Yönetici:** her ay kişi başı paranın büyümesine bakar ve NPC'lerin harcama eğilimini en çok %3 oynatır ("maksimum %2-3'lük değişim"). Eğilim 0,8 ile 1,25 arasında kalır.
- **Gizli şans:** oyuncu zarar edince ya da parası bitince bir süre açılır. Yalnız NPC davranışıyla çalışır, asla bedava para vermez. O süre boyunca:
  - daha çok ve daha uygun aday gelir;
  - mülküne daha iyi alım teklifi gelir;
  - daha iyi iş teklifi gelir;
  - pazarlıkta karşı taraf daha çok esner.
- **Dönüş raporu:** oyuncu en az 12 oyun günü (6 saat) gelmeyince vekil müdür yazar. Vekil müdür şirketin en güvenilir, muhasebe bilen NPC'sidir. Ton her zaman yüzü güldürür:
  - kâr ettiyse: "az ama olsun, ben senin kadar iyi yönetemiyorum";
  - zarar ettiyse: "lütfen bizi bir daha bu kadar bırakma", ve gizli şans açılır.
  - Rakamlar gerçek. Müdür projelere ve kararlara dokunmaz.

## 8. Sıralama

- Ülkede, şehrinde ve dünyada sıralama: herkesin net servetiyle (NPC'ler dahil).
- Şehirler ve ülkeler kişi başı ortalamaya göre sıralanır.
- "Ülke ekonomisine katkın" = senin servetinin ülkedeki toplam servete oranı.

## Sonraki adımlar (öneri)

- Çekirdeğe gerçek proje, şirket üyesi ve yetki yapısı eklenince NPC'ler projelere de katılabilir.
- Çok oyunculu sürümde aynı beyin sunucuda çalışabilir. Gerçek oyuncu azken dünyayı canlı tutar, çoğaldıkça NPC sayısı düşürülür.
- İstenirse bir dil modeli bağlanabilir: `npc-dil.js`'in `uret` ve `niyetBul` işlevleri aynı imzayla değiştirilir, gerisi değişmez.
