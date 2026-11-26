# Sohbet iplikleri: yazım kılavuzu

Kanalda NPC'ler (oyunun karakterleri) birbiriyle konuşur. Bir **iplik**, 2-4 kişinin arka arkaya yazdığı kısa bir konuşmadır. Oyun aynı anda 6-10 ipliği karışık akıtır: Türkiye kanalında dakikada 25, global kanalda dakikada 40 mesaj. Mesaj çok olduğu için çeşitlilik her şeydir.

## Dosya biçimi (JSON dizisi)

```json
[
  {
    "id": "is-kurye-sorusu-1",
    "konu": "is",
    "kosul": ["A.issiz"],
    "saat": null,
    "turlar": [
      ["A", "[slm|selam] millet, kurye olmak mantıklı mı sizce"],
      ["B", "{A} ben {B.meslek} olarak çalışıyorum ama kuryeler fena kazanmıyor, ayda {maas.kurye} falan"],
      ["A", "şart var mı peki"],
      ["C", "yok şartsız, kariyerden direkt başlıyorsun"],
      ["A", "tamam bakarım, sağ olun"]
    ]
  }
]
```

- `id`: benzersiz, kısa, Türkçe karaktersiz.
- `konu`: serbest etiket (is, maas, kurs, mulk, kredi, isletme, ekonomi, gundelik, spor, yemek, hava, saka, selam, veda, bayram, oyun...).
- `kosul`: rol koşulları (aşağıdaki listeden), boş dizi olabilir.
- `saat`: `"sabah"` (6-11), `"ogle"` (11-17), `"aksam"` (17-23), `"gece"` (23-6) ya da `null` (her saat).
- `turlar`: 3-9 tur. Her tur `[rol, metin]`. Roller `A`, `B`, `C`, `D`. A ipliği başlatır.

## Metin

- **Alternatif:** `[a|b|c]` biçiminde, iç içe değil. Bir turda 1-3 alternatif grubu olsun. Aynı iplik her seferinde biraz farklı çıksın.
- **Boş alternatif serbest:** `[ abi|]` ("abi" ya da hiçbir şey).
- **Uzunluk:** tur başına en çok 120 karakter. Çoğu kısa olsun (3-12 kelime), gerçek sohbet gibi.
- **Emoji YOK.** Hiç. ":)" ve "xd" de çok seyrek kullanılsın, 20 iplikte bir. "haha", "ahah", "sdfsdf" serbest.
- **Doğal yazım:** Herkes düzgün yazmaz. Kimi küçük harfle yazar, kimi noktasız. "napıyon", "bi", "yok ya", "valla", "abi", "kanka", "hocam" doğal yerde kullanılır. Ama abartmayın, her cümle argo olmasın. Yazım tarzını oyun ayrıca kişiye göre bozar, siz düzgün ama gündelik yazın.
- **Tutarlılık:** Konuşanın rolü değişmez. A soruyorsa B cevaplar. B kendi mesleğinden konuşuyorsa `{B.meslek}` kullanın, kafadan meslek uydurmayın.
- **Hitap:** Kişiler birbirine adıyla seslenir: `{A}`, `{B}`, `@{A}`. Ama her mesajda değil.
- **Bitiş:** İplikler bazen soruyla, bazen "neyse ben kaçtım", bazen havada biter. Hepsi "sağ ol" ile bitmesin.
- **Yasak konular:** Siyaset, din tartışması, savaş, terör, etnik konu, küfür, cinsellik. Gerçek kişi ya da marka adı yok (genel "maç", "dizi" olur, takım adı vermeyin).
- **Bot itirafı yok.** Kimse "ben yapay zekayım" demez, bot konusunu açmaz.

## Yer tutucular (oyun bunları gerçek değerle doldurur)

- **Kişiler:**
  - `{A}` `{B}` `{C}` `{D}`: kişinin ilk adı.
  - `{A.meslek}`: mesleği, küçük harf ("kurye", "garson", "kasiyer", "memur", "muhasebeci", "usta", "inşaat işçisi", "emlak danışmanı", "kafe sahibi", "dükkan sahibi", "nakliyeci"...).
  - `{A.yer}`: ilçesi ("Kadıköy"). `{A.sehir}`: şehri ("İstanbul").
  - Aynı alanlar B, C, D için de var.
- **Fiyatlar** (yuvarlanmış: "1,8 milyon civarı", "54 bin falan"):
  - Mülk: `{daire}` `{arsa}` `{dukkan}`, `{daire.kira}` (aylık kira getirisi), `{pesinat}` (dairenin kredili peşinatı).
  - Maaşlar (aylık ortalama kazanç): `{maas.kurye}` `{maas.garson}` `{maas.kasiyer}` `{maas.insaat}` `{maas.memur}` `{maas.muhasebeci}` `{maas.usta}` `{maas.emlak}` `{maas.nakliyeci}`.
  - Diğer: `{gorev.kurye}` (kuryenin görev başı ücreti), `{asgari}` (asgari ücret), `{yasam}` (aylık geçim gideri), `{evkira}` (ev sahibi olmayanın ödediği aylık kira).
  - Kurslar: `{kurs.kpss}` `{kurs.kpss.gun}` (kamu sınavı kursu, memurluk için), `{kurs.muhasebe}` `{kurs.muhasebe.gun}`, `{kurs.ustalik}` `{kurs.ustalik.gun}`, `{kurs.emlak}` `{kurs.emlak.gun}`.
  - İşletmeler: `{kafe.kurulus}` `{kafe.gider}` (aylık sabit gider), `{dukkan.kurulus}` `{dukkan.gider}`.
  - Ekonomi: `{enflasyon}` (yıllık, "%11,6"), `{faiz}` (aylık kredi faizi, "%1,5").
  - Bayram: `{bayram}` (sıradaki bayramın adı), `{bayram.gun}` (kaç gün kaldı, sayı).
- **Global kanal:** fiyat yer tutucuları kullanılmaz; yalnız `{A}`…`{D}`, `{A.sehir}`.

Para cümlesi yazarken eki yer tutucuya yapıştırmayın ("{daire}'ye" olmaz). Cümleyi eksiz kurun: "daire {daire}, bence pahalı".

## Rol koşulları (`kosul`)

Her rol için şunlar kullanılabilir (A yerine B/C/D de olur):

- **Çalışma durumu:**
  - `A.issiz`: işi yok.
  - `A.calisan`: bir işletmede ya da kendi mesleğinde çalışıyor.
  - `A.patron`: işletme sahibi.
  - `A.kurye`, `A.garson`, `A.memur`, `A.usta`: bu meslekte.
  - `A.sartsiz`: 1. kademe meslekte (kurye, garson, kasiyer, inşaat işçisi).
- **Ev:**
  - `A.evsahibi`: kendi evinde oturuyor.
  - `A.kiraci`: ev sahibi değil, kirada.
- **Durum:**
  - `A.yeni`: oyuna son 30 günde katıldı.
  - `A.eski`: 200 günden fazladır oyunda.
  - `A.zengin`: nakdi 1 milyondan fazla.
  - `A.borclu`: kredisi var.
  - `A.kursta`: şu an kursa devam ediyor.
- **İstanbul:** `A.istanbul`, `B.istanbul`.

Koşul yoksa herkes o rolü alabilir. Koşulu az kullanın, yalnız metin gerçekten gerektiriyorsa (ör. "kredimi ödüyorum" diyen rol `borclu` olmalı).

## Oyunun gerçek kuralları

Yanlış bilgi yazmayın; emin değilseniz kişi "bilmiyorum, bakmak lazım" desin.

- Herkes 100.000 TL ile başlar. Yaş, okul yok. 1 oyun günü = 1 gerçek saat, 1 ay = 30 oyun günü.
- **Meslekler:**
  - 1. kademe, şartsız: garson, inşaat işçisi, kurye, market çalışanı (kasiyer).
  - 2. kademe, kurs + 30 gün deneyim: memur (kamu sınavı kursu), emlak danışmanı (emlak belgesi), muhasebeci (muhasebe kursu). Usta için ustalık belgesi + 20 gün inşaat işçiliği gerekir.
  - 3. kademe, sermaye + 60 gün deneyim: kafe sahibi, dükkan sahibi, nakliyeci (araç parası dahil 800 bin sermaye). Taşeronluk 20 gün ustalık ister.
  - 4. kademe, milyonlar + kurs + uzun deneyim: emlak ofisi, döviz bürosu, ithalat-ihracat, müteahhit, fabrikatör.
- **Kazanç biçimi:**
  - Görev yaptıkça kazananlar: kurye, garson, inşaat işçisi, usta.
  - Sabit maaşlılar: memur, muhasebeci.
  - Maaş + görev: kasiyer.
  - Maaş + prim: emlak danışmanı.
  - İşletme sahipleri kâr eder.
  - Kurye ve memurun işvereni yoktur, Kariyer ekranından doğrudan başlanır.
  - İşletmede çalışan, ayda 20 görevi tamamlarsa maaşı tam yatar.
- **İşletme:** kurulur, NPC müşteriler gelir. Ciro konuma, çalışana ve kaliteye bağlıdır. Aynı türden çok işletme olunca müşteri bölünür. Eksik çalışanın yerine geçici personel çalışır, pahalı ve verimsizdir. İlan açılır, başvuranlar gelir, işe alınır.
- **Mülk:** daire, dükkan, arsa. Daire ve dükkan kira getirir, arsa getirmez ama değerlenir. Fiyat şu an semte göre değişmez. Ev sahibi kira ödemez; ev sahibi olmayan her ay kira öder. Konut kredisiyle peşinat yaklaşık %20.
- **Banka ve kredi:**
  - İhtiyaç kredisi 24 ay vadelidir.
  - Kredi limiti = geçen ayki gelir × kredi notu / 100. Kredi notu 620'den başlar, taksit ödedikçe ve itibarla yükselir.
  - 3 taksit kaçırılırsa icra olur.
  - Mevduat faizi yok.
  - Döviz, altın, borsa henüz yok, "sonraki güncellemede gelecekmiş".
- **Para biterse:** işe girmek zorunlu, borç kapanana kadar yatırım yok.
- **Kum Saati:** 1 tanesi 1 günlük beklemeyi kısaltır (kurs, başvuru). Günlük 3 görev yapınca 1 tane bedava gelir, satın da alınır. Maaşı ya da serveti etkilemez.
- **Bağış:** her 10 bin TL'ye 1 itibar, bayramda 2 katı. Cami, okul, çeşme gibi eserler ileride gelecek.
- **Fiyatlar her ay biraz artar (enflasyon).** Maaşlar endekse göre artar ama geriden gelir.
- **Henüz olmayanlar (sorulursa "daha yok, gelecekmiş"):** ortaklık, ihale, inşaat, borsa, döviz, araba galerisi, lonca/dernek.

## Kalite ölçütü

- **Konuşma gibi akmalı:** soru-cevap, itiraz, şaka, konu sapması, birinin araya girmesi. "Kalıp cümle sırası" gibi değil.
- **Kişilik farkı:** biri çok bilmiş, biri yeni ve saf, biri şakacı, biri resmî, biri şikâyetçi, biri yardımsever.
- **İçerik oyunun dünyasıyla bağlı olmalı:** iş, para, kira, kurs, dükkan. Ama yarısı gündelik hayat (yemek, trafik, maç, hava, uyku, iş yorgunluğu, tatil, aile, çay). Bunlar oyunun içindeki hayat gibi anlatılır.
- **Aynı açılış iki iplikte olmasın.** Aynı kelime kalıbı ("arkadaşlar bir sorum var") en çok 3 iplikte geçsin.

## Denetim

Her dosyayı yazdıktan sonra çalıştırın:

```
node tools/iplik/denetle.cjs tools/iplik/DOSYA.json
```

Bilinmeyen yer tutucu, koşul, emoji, uzunluk, tekrar eden açılış ve bozuk JSON varsa hata verir. Hata kalmayana kadar düzeltin.
