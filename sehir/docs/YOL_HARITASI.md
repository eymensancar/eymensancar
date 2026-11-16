# Yol haritası ve durum

Uzun soluklu iş. Her oturum önce bu dosyayı okur, sonunda "Durum"u günceller.

## Mekanikler (Eymen, 16 Kasım 2026)
Ekran düzeni (telefon, yatay; az düğme):
- **Sol üst:** can ve açlık (ileride başkaları).
- **Üst orta:** seviye çubuğu. Seviye atlamak gitgide zorlaşır.
- **Sağ üst:** küçük harita. **Altında dikey çubuk, 4 bölme:** 3 **el yuvası** (çanta değil: yanımızda taşıdığımız eşyalar; balta, mızrak, silah...) + 1 **çanta** düğmesi (envanteri açar; ileride gelişir).
- **Altta, çubuk ile KOŞ/zıpla arasında iki küçük düğme:** **tablet** ve **çekiç**.
  - **Çekiç = inşa/üretim menüsü:** temel ve az sayıda şey, hemen bulunur: duvar, zemin, çatı, çit, yatak, masa, **tek bir genel üretim masası**, fırın gibi şeyler. Yeterli malzeme varsa inşa edilir.
  - **Tablet = teknoloji açma.** Burada yalnız kilit açılır: yeterli seviyeye gelince, kazanılan **teknoloji puanıyla** teknoloji açılır; sonra çekiçten (ya da üretim masasından) malzemeyle yapılır. Oyunun başından beri kullanılır.
- **Vurma/kesme/kazma düğmesi:** sabit.
- **Teknoloji puanı:** çoğunlukla boss'lardan (ör. boss başına 20 puan). Seviye, boss zorluğu ve teknoloji maliyetleri birbirine ayarlı: boss'u yenebilecek seviyeye gelen oyuncu, o seviyenin teknolojilerini onun puanıyla açar; açacak şey kalmayınca sıradaki boss yenilebilir olur. Kademe kademe yükselme.
- İlk mekanikler: yerden toplama (var), ağaç kesme, taş kazma, üretim (el aletleri), el yuvaları, çanta.

## Harita
İlkeler `docs/HARITA_TASARIM.md`. Yöntem: makro algoritma + oynanan yerler elle tasarım, 4 km²'lik parçalarla; her parça için 5 tasarımcı + 5 psikolog-testçi döngüsü.

## Durum (16 Kasım 2026, 17:35 TSİ)
- Yayındaki sürüm: gerçek dokular, yüzme, tırmanma, harita (kıstırma, işaret), yerden dal/taş toplama; 32 km akışlı arazi.
- Başlanan işler (bu oturum): (a) arayüz iskeleti ve temel mekanikler, (b) makro arazi üretiminin ilkelere göre yenilenmesi, (c) elle tasarım katmanı ve araçları, (d) ilk 4 km² (doğuş bölgesi) tasarım-deneme döngüsü.
- Makro arazi (arazi.js) yenilendi: ana kara + yarımadalar, koylar, kıyıya yakın adalar ve açıkta adalar (dünyanın ~%65'i okyanus), bölgesel dağ sıraları (1000 m'ye varan zirveler), kıyıya doğru alçalan ovalar. Biyom yerleşimi hâlâ dört yöne göre (ileride iklim alanlarına çevrilecek).
- arazi.js'te nesne kimliği/kaldırma arayüzü (`yakinNesne`, `nesneKaldir`) ve elle tasarım kancaları (`SO.tasarim`) hazır.
- Çalışan ekip (bitenler buraya işlenecek): arayüz (`arayuz.js`, index.html), oyun çekirdeği (`oyun.js`, `anim/vurus.js`), inşa (`yapi.js`), elle tasarım katmanı ve araçları (`tasarim.js`, `tasarim/`, `test/kusbakisi.cjs`, `test/manzara.cjs`, `test/yuru.cjs`, `test/olcum.cjs`).
- Sıradaki: araçlar bitince b001 (doğuş bölgesi, ~4 km²) için 5 tasarımcı + 5 psikolog-testçi döngüsü; sonra birleşik deneme ve yayın.

### Durum güncellemesi (16 Kasım 2026, 22:30 TSİ)
- Bitti ve yayında (Sürüm 6): arayüz (`arayuz.js`), oyun çekirdeği (`oyun.js`, `anim/vurus.js`), inşa (`yapi.js`), elle tasarım katmanı ve araçları (`tasarim.js`, `tasarim/KILAVUZ.md`, `test/kusbakisi|manzara|yuru|olcum.cjs`). Sözleşme: `docs/OYUN_API.md`.
- b001 (doğuş bölgesi, ≈ 4,3 km², "İki Irmak Arası"): baş tasarımcının planı `tasarim/b001/TASARIM.md` ve iskeleti `tasarim/b001/bolge.js` bitti. Dört uzman çalışıyor: `arazi.js` (arazi yontucusu), `su.js` (su ve patika), `yerlesim.js` (yerleşim ve kaynak), `bitki.js` + `isaret.js` (bitki ve işaretler).
- Sıradaki: uzmanlar bitince birleşik bakış → 5 psikolog-testçi turu (her biri farklı oyuncu tipi; `test/yuru.cjs`, `manzara`, `olcum` ile; ne hissetti, ne yaptı, nerede boşluk/sıkılma var) → baş tasarımcı ve uzmanlarla düzeltme turu → birleşik deneme → yayın.
- Bekleyen küçük işler: yeni ses olayları için kayıtlar (vur, kir, uret, seviye, ye, kur, sok, al), ağaç devrilme hareketi, nesne sarsılması, çarpışma kutularına alt sınır (ikinci kat), harita renklerinin yeni dokulara uyması.
