# Sancar Games marka notları

## Karar (9 Kasım 2026)
**Logo: oyun kolu** (üstte SANCAR, altta GAMES; G ve S kolun tutamaçları), koyu zemin, sarı tutamaçlar. Muhammed Sancar onayladı.
- Dosyalar: `marka/` (koyu, renkli, siyah, beyaz SVG). Sitede `assets/img/logo.svg` (açık zemin), `logo-w.svg` (koyu zemin, alt bilgi).
- **Ayrı simge yok** (Eymen): küçük yerlerde de aynı logo küçültülerek kullanılır. Sekme simgesi ve apple-touch-icon: koyu yuvarlak kare içinde logo (`favicon.svg/.png`, `apple-touch-icon.png`).
- Eski sarı kare + S simgesi (sahibinden.com'a benziyordu) kaldırıldı.

## Logo (Kasım 2026, sürüyor)
- Eski site simgesi (sarı kare içinde siyah S) sahibinden.com'a benzediği için değişecek.
- Eymen'in istediği tarz: FedEx (E ile x arasındaki ok), Carrefour (gizli C), Toblerone (gizli ayı), Formula 1 (gizli 1) gibi **sade, tek bir gizli negatif alan sürprizi**. Abartılı olmayacak.
- Denenip beğenilmeyenler:
  1. GAMES harflerini SANCAR'ın 5 boşluğuna koymak: "SGAAMNMCEASR" gibi okunuyor.
  2. SANCAR'ı yatay yarıkla kesip GAMES'i yarığa koymak: abartılı.
  3. İkinci A'nın iç boşluğu oynat (▶) işareti: "yamuk durdu", logo olarak beğenilmedi.

## Toplantı için finalistler (her tarzdan en iyisi)
Süreç (Eymen'in önerisi): her tarzdan bir finalist çıkar, sonunda Amca ile marka kimliği toplantısında seçilir.
1. **Eğlenceli / oyun kolu:** üstte SANCAR, altta GAMES; G ve S kolun tutamaçları (ChatGPT görseli, potrace ile SVG'ye çevrildi; 4 sürüm: koyu, renkli, siyah, beyaz). Seçilirse harfler elle temizlenmeli (telif/tescil için de).
2. **Minimalist:** Archivo; tek sarı detay. Eymen'in favorileri:
   - **2a:** küçük harf "sancar games" + sonda sarı imleç (animasyonda yanıp söner). Simge: "s|".
   - **5:** büyük harf SANCAR + altında %70 dolu sarı yükleme/can çubuğu + aralıklı GAMES (animasyonda çubuk dolar).
3. **Amblem (yazısız):** tek kalın çizgiden S + ucunda sarı düğme (top). ChatGPT görseli, potrace ile SVG'ye çevrildi; sürümler: koyu, açık, koyu+sarı S, çerçevesiz koyu/beyaz. Sarı zemin + koyu S kullanılmayacak (sahibinden'e benzer).
Dosyalar Eymen'de (zip).

## Açılış/kapanış animasyonu fikri (Eymen, saklanacak)
Logo olarak değil, **oyun açılışları ve video giriş/kapanışları** için:
SANCAR GAMES logosu görünür → kamera bir A'ya yakınlaşır → A'nın içindeki üçgen boşluk yana dönüp **oynat (▶) tuşuna** dönüşür → bir parmak/tıklama animasyonu tuşa basar → oyun (ya da video) başlar.

## Oyun açılışı (12 Kasım 2026, Eymen)

Bütün oyunların girişi aynı: **beyaz zemin, tamamı siyah logo** (sarı tutamaçlar da siyah). Hazır dosya `marka/giris/sancar-intro.js` (kendi içinde, başka dosya istemez); ön izleme `marka/giris/index.html`.
- Kullanım: `<script src="sancar-intro.js"></script>` sonra `SancarIntro.play().then(oyunuBaslat)`.
- Sakin (Eymen, 12.11): harfler sırayla yumuşakça belirir (SANCAR, sonra GAMES), zıplama yok; kısa bekleyiş, sonra beyaz perde yavaşça açılır. Logo %30 büyük başlar (ekrandan taşabilir) ve yavaşça asıl boyuna iner. ~3,3 sn, dokununca geçilir. Ses: `sancar-intro.m4a` (özgün; Eymen'in beğendiği bir açılış sesinin havası örnek alındı ama notalar, ton ve kurgu farklı: derin vuruş + ısınarak açılan Re majör akor + parıltı; `ses-uret.py` üretir). `SancarIntro.play({audio:'sancar-intro.m4a'})`; Eymen onaylayana kadar deneme.
- Yukarıdaki "A → oynat tuşu" fikri ayrı duruyor; istenirse bu açılışın sonuna eklenir.
