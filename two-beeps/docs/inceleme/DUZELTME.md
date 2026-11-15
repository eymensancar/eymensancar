# Part 1 · düzeltme turu (yönetmenin kararı; üç inceleme raporundan)

Kaynak raporlar: `docs/inceleme/QA.md`, `PSIKOLOJI.md`, `PAZARLAMA-INCELEME.md` (kanıt kareleri `out/inceleme-*/`). Aşağıdaki liste bağlayıcıdır; raporlardaki öbür öneriler isteğe bağlı.

## Değişen ortak şeyler (yönetmen yaptı)
- Zaman çizelgesi yeniden üretildi: bitiş uzadı. `cues.endBeep` = voiceEnd + 0,95; `cues.endCard` = voiceEnd + 1,6; toplam süre ≈ 58,0 sn (bitiş kartı ≈ 2,7 sn). `tl.parts` = 10 eklendi. Sabit sayı kullanan yoksa kendiliğinden kayar.
- `TB.zone(ctx, cx, cy, w, h, a)` (motor.js): planlanan devrilme alanı (kazıklar, sarı-siyah şerit, tebeşir X). A ve B aynı fonksiyonu çağırır.
- **Sahne geometrisi (A ve B için ortak):** baca ortada; Daisy bacanın SAĞINDA, gülle kancada asılı; **planlanan devrilme alanı (TB.zone) bacanın SAĞ-ÖN tarafında, yerde** (Daisy'nin önünde, kameraya yakın); baca ise SOLA, boş arsaya devrilir. Seyirci şunu okumalı: "şuraya düşecekti, öbür yana düştü". Kimseye, hiçbir şeye zarar yok.
- Ses kuralı: gürültü süpürmesi (whoosh) yok (URETIM.md).

## Animatör A (`src/shots/a-sahneler.js`)
1. **Açılış (kritik):** 0. karede hareket ve merak olsun: Kaan elinde katlı listeyi tutuyor (mavi karalamanın kenarı belli belirsiz), kamera 0'dan itibaren yavaşça yaklaşıyor; ilk 0,4 sn ölü durmasın. Paket 1. cümleyi 0. kareden itibaren büyük yazıyla y≈690–910 bandında gösterir: Kaan'ın başı ve saç tutamı bu bandın ALTINDA kalsın (baş üstü y ≥ 960).
2. **16,5–22,8 sn canlılık (önemli):** Daisy tanıtımı ve "JOB 1" planı durgun. "JOB 1" geniş planını ortak geometriye göre kur: baca, sağda Daisy (gülle kancada, hafif salınıyor), sağ-önde `TB.zone`, küçük Kaan alanı işaret ediyor ya da şeridi geriyor; plan içinde en az iki belirgin hareket (gülle salınımı, şerit dalgalanması, Kaan'ın jesti). B'nin 29,0'daki geniş planıyla aynı yerleşim olsun (B'nin kodundaki konumlara bak ve eşle), böylece gülle 29,0'da "birden belirmez".
3. Liste kadraja girerken boş kâğıt görünmesin (yazılar baştan olsun). Kaan'ın ceket cebi planlar arasında tutarlı olsun (cizim.js ne çiziyorsa o).
4. `TB.cuesA`'yı güncel tut.

## Animatör B (`src/shots/b-sahneler.js`)
1. **"Yanlış yön" okunurluğu (kritik):** 29,0 geniş planında ve darbeden önce `TB.zone` sağ-önde açıkça görünsün (yerde bacadan alana giden tebeşir ok da olabilir; ekrana yazı/işaret bindirme yok). Baca sola devrildikten sonra en az 0,6 sn, BOŞ kalan alan ile öbür yanda yatan baca aynı kadrajda görünsün. 35,4–36,2 Kaan planının arka planında gülle görünsün (süreklilik).
2. **Telefon sahnesi (kritik, pazarlama):** telefon ekranı PARLAK (karartma/koyu örtü yok), kadrajda daha büyük (ekran yüksekliği kadrajın ≥ %55'i), oyun görüntüsü net. "forty towers" boyunca tam çöküş ve "DEMOLISHED!" (kare 1–55) görünsün; "you just try again"de TIME'S UP → "Try again" (kare 116–150); başparmak dokunuşu düğmenin üstüne ve dokunma karesine denk gelsin (`assets/img/oyun/meta.json`). Oyun karelerini sahne süresine sığdırmak için aradaki kareleri (56–115) kısaltabilir/atlayabilirsin.
3. **İki bip:** bip penceresinde (cues.beep−0,3 … son ton+10 kare) uyarı ışığından başka HİÇBİR ŞEY değişmesin; farlar o sırada açılmasın (önce ya da sonra).
4. **H K damgası (önemli):** el daha erken çekilsin; damga en az 2 sn temiz ve okunaklı görünsün (üst üçte bir). Moloz planı sadeleşsin: daha az tuğla, taş ilk bakışta seçilsin; kol düz şerit gibi durmasın (dirsek/bilek), yerdeki toz pamuk gibi değil ince ve dağınık olsun.
5. **"Real chimneys don't." (29–31,6):** sessiz izleyen için ölü an olmasın: rüzgârda otlar, şerit dalgası, bulut kayması, güllenin hafif salınımı, çok yavaş itme. Yine de sakin.
6. Omuz silkme okunur olsun (omuzlar + eller + baş eğimi, ~10 kare tutma). Kol planında elin kadraja girişi ani olmasın.
7. **Bitiş:** uyarı ışığı kadrajın ÜST üçte birinde dursun (bitiş kartı y≈700–1400 bandına gelir ve ışığı kapatmamalı); yeni `endBeep`/`endCard` zamanlarına uy.
8. `TB.cuesB`'yi güncel tut.

## Paketleme (`src/paket.js`, `docs/PAZARLAMA.md`)
1. **Açılış:** 1. cümle 0. KAREDE tam görünür (kelime vurgusu yine sesle yürür); "TWO BEEPS" daha büyük ve 2,5 sn; köşe simgesi sağ güvenli alanın içinde (x ≤ 890).
2. **Bitiş kartı (kritik):** `cues.endCard`'dan sona (≈2,7 sn) tam okunur; uyarı ışığını (üst üçte bir) kapatmaz. Metinler: `PART 2 · THE ANT →`; `Follow · Part 2 is next`; oyun satırı: simge + `Search "Demolition Master: Tower Blast"` + küçük `iPhone · free`. Kart girişi 6 kareden uzun sürmesin.
3. `docs/PAZARLAMA.md`: sabit yorum sorusu iki seçenekli olsun ("Luck or warning? 👀" gibi); açıklamada ve yorumda arama ifadesi tam mağaza adıyla; "by Sancar Games" ile arama önerme.
4. `kaydet.cjs` süreyi timeline'dan okuyor olmalı (kontrol et).
