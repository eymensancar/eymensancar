# Burger Ustası (çalışma adı)

Dikey oynanan, hafif yukarıdan bakılan sipariş oyunu: müşteriler tezgâha gelir, baloncuktaki burgeri aynı sırayla hazırlarsın (ekmek → ızgarada köfte → malzemeler → ekmek). Saf HTML/CSS/JS, tek dosya: `www/index.html`, görseller `www/g/`. Şimdilik claude.ai artifact'inde geliştiriliyor.

- **Oynanış:** gün gün ilerler; her gün daha çok ve daha sabırsız müşteri, belirli günlerde yeni malzeme (2 marul, 3 domates, 5 soğan, 7 pastırma, 9 yumurta, 11 turşu). 3 müşteri kaçarsa gün başarısız. Altınla 4 geliştirme (hızlı ızgara, sabır, bahşiş, 3. ızgara gözü).
- **Kayıt:** `localStorage` anahtarı `burgerustasi.v1`. Diller: Türkçe ve İngilizce (`T` sözlüğü).
- **Test kancası:** `index.html?debug` → `window.__bu`.

## Görseller (itch.io)
- Yiyecekler, tente, yıldız: **Food Icon Pack, Bluc** (https://bluc.itch.io/food-icon-pack). Ticari kullanım serbest, **atıf zorunlu** ("Icons by Bluc"; oyunda ana ekranın altında yazıyor, mağaza açıklamasına da eklenecek). Paketi olduğu gibi yeniden dağıtmak yasak: depoda yalnız oyunun kullandığı küçültülmüş görseller var.
- Müşteriler: **Refined Free Cute Characters V1 ve V2, BITTI Studio** (https://bitti-studio.itch.io/). Ücretsiz paket; **lisans koşulları itch.io sayfasında açık yazmıyor** (bittistudio.com/guide'a yönlendiriyor) ve görseller yapay zekâ destekli üretilmiş. Mağazaya çıkmadan önce koşullar doğrulanmalı ya da karakterler kendi çizimlerimizle değiştirilmeli.
- Tabaktaki burger katmanları (yandan görünüş) kodla çizildi (`SV` içindeki SVG'ler); itch.io'da uygun, ücretsiz, yandan görünen parça parça çizgi film burger seti bulunamadı.
- Siparişler baloncukta malzeme simgeleri olarak görünür (ekmek ve köfte dahil); sıra önemli değil, malzemeler tutmalı.
