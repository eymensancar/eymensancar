# Kural ve hata incelemesi (20 Kasım)
Senaryolar: /tmp/claude-0/-home-user/8066dee7-8627-553b-a97c-0e1bfc2ce9b4/scratchpad/inc-kural/ (t1–t13.cjs, h.cjs). Satır numaraları o anki www/js/oyun.js'e göre. 1–15. günler kusursuz botla kazanılıyor, sayaçlar tam sayı ve tutarlı; sorunlar yarış durumlarında.

## Kritik
1. **Teslimden sonraki 200 ms'de aynı müşteriye ikinci burger verilebiliyor, iki kez ödüyor.** teslim() müşteriyi S.cust'tan hemen çıkarmıyor (ayril 200 ms sonra). Üret: iki tabağı art arda aynı müşteriye sürükle → gelir 2 kat, mutlu=2. Yer: oyun.js:223-239, 262, 211. Düzelt: `c.verildi` bayrağı (teslim, hedefBul, custAdim atlasın) ya da müşteriyi hemen S.cust'tan çıkar, yalnız çıkış animasyonu gecikmeli.
2. **Teslimden sonra sabır sıfırlanırsa müşteri kaçmış da sayılıyor, fazladan can gidiyor.** custAdim teslim edilen müşterinin sabrını azaltmaya devam ediyor. Düzelt: aynı `verildi` bayrağı.
3. **Gün kazanılınca 900 ms içinde Duraklat → Ana menü yapılırsa kazanılan gün yok sayılıyor**; ayrıca gün 900 ms içinde yeniden başlatılırsa eski zamanlayıcı yeni günü müşterisiz "kazanılmış" bitiriyor. Yer: 325, 338, 343, 311. Düzelt: zamanlayıcı kimliğini sakla, startDay/openHome'da clearTimeout; S.bitis iken duraklatmayı kapat ya da kazancı hemen kaydet, yalnız kartı geciktir.

## Önemli
4. **Köfte stoğu 6'yı aşabiliyor**: uçan köftenin .then'i yeni günde çalışıyor (ucan=-1, stok=1). Yer: 194-197, 312. Düzelt: S.gunNo sayacı, .then'de eşleşmezse çık; stok Math.min, ucan ≥0.
5. **Sürüklerken hedef müşteri gidip yerine yenisi gelirse burger yeni müşteriye teslim ediliyor** (d.hedef yer numarası). Yer: 259, 265-267. Düzelt: hedef olarak müşteri nesnesini sakla ve S.cust[c.i]===c doğrula ya da bırakırken hedefBul ile yeniden hesapla.
6. **Can eksiye iniyor (-2); 3. can gittikten sonra teslim kabul ediliyor.** Yer: 219, 238, 310, 324. Düzelt: S.can=Math.max(0,…), aktif() içine S.can>0, can 0 olunca kontrol() hemen.
7. **Bahşiş serisi botla uyumsuz**: oyun odeme'ye S.seri+1, denge.mjs seri geçiyor. Sözleşme "3. mutlu teslimden sonra": oyun S.seri geçsin (ya da ikisi aynı kurala).

## Küçük
8. Boş tabakta 8 px'ten uzun kaydırma malzeme koyuyor (pointerup'ta mesafe >8 px ise koy çağırma). Yer: 247-250.
9. Bir parmak tabağa basılıyken öbür tabağa dokunuş yutuluyor (pointerdown S.surukle varken çıkıyor). Sürükleme başlamamış ikinci parmak için dokunuş (koy) kaydı tut. Yer: 244.
10. Oyun etkin değilken çöpe bırakma sessizce başarısız (hayalet çöpe uçuyor, burger tabakta yeniden beliriyor). aktif() değilse geriDon. Yer: 266.
11. **Gün ortasında Ana menüye dönmek o günün harcamasını geri veriyor** (kötü günü bırakmak kaybetmekten kârlı). KARAR (Claude 2): gün ortasında çıkılırsa o güne kadar harcanan para düşer (SAVE.coins = max(0, kasa)), kazanç sayılmaz; gün tekrar oynanır.
12. Gün sonu kartında "Gelir" bahşişi içeriyor, "Bahşiş" ayrıca gösteriliyor (iki kez sayılmış sanılıyor). KARAR: "Gelir" yalnız menü fiyatları, "Bahşiş" ayrı, "Net" = gelir + bahşiş − gider (− kira).
13. Kayıt doğrulaması up değerlerini sınırlamıyor (up.cook=9 → pisme negatif). up[k]'yi 0…GELISTIR[k].max'a sıkıştır; geçersiz dilde cihaz dili.
14. Somurtkan teslimde kasa çipi "pop" yapıyor; sözleşme "hiç efekt yok". hud({sessiz:true}) ile atla.
