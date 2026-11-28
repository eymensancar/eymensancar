# Soru-cevap bankası (SSS): yazım kılavuzu

NPC'ler oyuncunun sorularına cevap verirken bu bankada arama yapar. Oyuncunun mesajı, kayıtlardaki örnek soruluşlarla kelime benzerliğine göre eşleştirilir; en yakın kaydın cevabı oyunun gerçek verisiyle doldurulup söylenir. Bu yüzden **örnek soruluşların çeşitliliği her şeydir**.

## Biçim (JSON dizisi)

```json
[
  {
    "id": "kredi-faiz",
    "konu": "kredi_sorusu",
    "sorular": [
      "kredi faizi kaç",
      "faiz oranı ne kadar",
      "bankanın faizi yüksek mi",
      "kredi çeksem ne kadar faiz öderim",
      "aylık faiz yüzde kaç",
      "faizler ne alemde",
      "kredinin faizi nekadar",
      "kredi faizi neden bu kadar yüksek"
    ],
    "cevap": [
      "Aylık faiz {faiz}, ihtiyaç kredisi 24 ay vadeli",
      "{faiz} aylık, yıllığa vurunca epey ediyor",
      "Bankada aylık {faiz} faiz var, 24 ay vade"
    ]
  }
]
```

- `id`: benzersiz, küçük harf, rakam, tire.
- `konu`: niyet etiketi (`node -e "const D=require('./npc-dil.js');console.log(D.NIYETLER.join(' '))"` listesinden).
- `sorular`: 12-25 farklı soruluş. Gerçek oyuncu dili:
  - Kısa ve uzun, kibar ve argo, Türkçe karaktersiz, kısaltmalı ("nekadar", "varmı", "bi", "knk"), yazım hatalı.
  - Eksik cümle ("faiz?"), iki kelimelik soru, dolaylı soru ("faizi merak ediyorum").
  - Aynı bilginin farklı açılardan sorulması.
  - Başka kayıtla karışmayacak kadar o konuya özgü kelimeler içersin. "kaç" tek başına yetmez; "faiz kaç" olur.
- `cevap`: 2-4 farklı cevap. Kısa, gündelik, bir oyuncunun yazacağı gibi. En çok 2 cümle. Emoji yok.

## Cevaplarda kullanılabilecek yer tutucular (oyun doldurur)

- **Fiyatlar:** `{daire}` `{arsa}` `{dukkan}` `{daire.kira}` `{dukkan.kira}` `{pesinat}`
- **Maaşlar (aylık):** `{maas.kurye}` `{maas.garson}` `{maas.kasiyer}` `{maas.insaat}` `{maas.memur}` `{maas.muhasebeci}` `{maas.usta}` `{maas.emlak}` `{maas.nakliyeci}`
- **Diğer ücretler:** `{gorev.kurye}` `{asgari}` `{yasam}` (aylık geçim) `{evkira}` (ev sahibi olmayanın aylık kirası)
- **Kurslar:** `{kurs.kpss}` `{kurs.kpss.gun}` `{kurs.muhasebe}` `{kurs.muhasebe.gun}` `{kurs.ustalik}` `{kurs.ustalik.gun}` `{kurs.emlak}` `{kurs.emlak.gun}` `{kurs.doviz}` `{kurs.doviz.gun}` `{kurs.dis}` `{kurs.dis.gun}` `{kurs.muteahhit}` `{kurs.muteahhit.gun}`
- **İşletmeler:** `{kafe.kurulus}` `{kafe.gider}` `{dukkan.kurulus}` `{dukkan.gider}` `{nakliyeci.sermaye}` `{kafe.sermaye}` `{dukkan.sermaye}`
- **Görev başı:** `{gorev.garson}` `{gorev.insaat}` `{gorev.kasiyer}` `{gorev.usta}` `{gorev.nakliyeci}` (kurye `{gorev.kurye}`)
- **Zam ve prim:** `{memur.baslangic}` `{memur.zam}` `{memur.zamgun}` `{memur.tavan}` (aynısı `muhasebeci.`) `{emlak.maas}` `{emlak.prim}` `{gecici.maas}` (geçici NPC personelin aylık maliyeti)
- **Mülk gideri:** `{mulk.daire.gider}` `{mulk.dukkan.gider}` `{mulk.arsa.gider}` (aylık bakım + emlak vergisi) `{mulk.daire.net}` `{mulk.dukkan.net}` (kira eksi bu gider)
- **Taksitler:** `{konut.taksit}` (daire için konut kredisi aylık taksiti) `{kredi.taksit}` (100 bin TL ihtiyaç kredisinin aylık taksiti)
- **Bütün işletmeler:** `{isl.ID.kurulus}` `{isl.ID.gider}` `{isl.ID.kadro}` `{isl.ID.kredi}` (en çok işletme kredisi) `{isl.ID.pesin}` (krediyle açarken cepten) `{isl.ID.taksit}` `{isl.ID.kar}` (kadro geçici personelle, günde 3 yönetimle aylık vergi sonrası kâr tahmini; gerçek çalışanla biraz daha fazla; zarar tahmininde boş kalır, o cevap atlanır). ID: `dukkan kafe tasaron emlak_ofisi doviz_burosu ithalat_ihracat muteahhit fabrika`
- **Ekonomi:** `{enflasyon}` (yıllık) `{faiz}` (aylık kredi faizi) `{faiz.yillik}`
- **Bayram:** `{bayram}` `{bayram.gun}`
- **Oyuncunun kendisi** (soran kişinin gerçek durumu): `{o.limit}` (kredi limiti) `{o.not}` (kredi notu) `{o.nakit}` `{o.deneyim}` (toplam deneyim günü) `{o.meslek}` `{o.itibar}` `{o.kumsaati}`

Ek yapıştırmayın ("{daire}'ye" olmaz); cümleyi eksiz kurun.

## Oyunun gerçek kuralları

`tools/iplik/YAZIM.md` içindeki "Oyunun gerçek kuralları" bölümünü okuyun. Yanlış bilgi yazmayın; emin olmadığınız şeye cevap kaydı açmayın ya da "tam bilmiyorum" deyin.

Kesin bilgiler:
- **Meslekler ve şartlar:** kurye, garson, kasiyer ve inşaat işçisi şartsız. Memur için kamu sınavı kursu ve 30 gün deneyim gerekir. Muhasebeci ve emlak danışmanı için ilgili kurs ve 30 gün deneyim gerekir.
  - Usta için ustalık belgesi ve 20 gün inşaat işçiliği gerekir.
  - Kafe ve dükkan sahibi için sermaye ve 60 gün deneyim gerekir.
  - Nakliyeci için araçla birlikte 800 bin sermaye ve 60 gün deneyim gerekir. Taşeron için sermaye ve 20 gün ustalık gerekir.
  - Dördüncü kademe milyonlar, kurs ve 120-180 gün deneyim ister.
- **Para ve maaş:**
  - Kurye ile memurun işvereni yoktur.
  - Çalışan ayda 20 görevi yaparsa maaşı tam yatar.
  - Kasiyer maaş ve görevle kazanır.
  - Emlak danışmanı maaş ve prim alır.
  - Görevle kazananlar: kurye, garson, inşaat işçisi, usta.
- **Banka ve kredi:**
  - İhtiyaç kredisi 24 ay vadelidir.
  - Kredi limiti, geçen ayki gelir çarpı kredi notu bölü 100'dür. Kredi notu 620'den başlar.
  - 3 taksit kaçarsa icra olur.
  - Konut kredisinde peşinat yaklaşık %20'dir.
  - Mevduat faizi yoktur.
- **Mülk:**
  - Daire ve dükkan kira getirir, arsa getirmez ama değerlenir.
  - Fiyat semte göre değişmez.
  - Ev sahibi kira ödemez.
- **Kum Saati:**
  - 1 tane 1 günlük bekleme kısaltır (kurs, başvuru).
  - Günlük 3 görevle 1 bedava gelir, gerçek parayla da alınır.
  - Kimseye gönderilemez.
  - Deneyimi, maaşı ve serveti etkilemez.
- **Bağış:** 10 bine 1 itibar, bayramda 2 katı. İtibar kredi notuna ve iş başvurularına yarar.
- **Henüz olmayanlar:** borsa, döviz, altın, ortaklık, ihale, inşaat, galeri, dernek, başka ülkeler ve zekat (ileride isteğe bağlı).
- **Para biterse:** işe girmek zorunludur; borç kapanana kadar yatırım yapılamaz.

## Denetim

`node tools/sss/denetle.cjs tools/sss/DOSYA.json`: biçimi, bilinmeyen yer tutucuyu, emojiyi ve kayıtlar arası çakışan soruluşları kontrol eder.
