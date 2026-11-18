# Part 1 · QA: animasyon süpervizörü incelemesi

Kaynak: `out/part1.mp4` (57,2 sn). Kanıt kareleri `out/inceleme-qa/` içinde (her 0,25 sn: `f/`, kontak sayfaları: `kontak-01..04.jpg`, 15'er sn).

## Bulgular (önem sırasıyla)

1. **36,5–38,6 · Baca "yanlış yöne" düşmüş gibi okunmuyor. Önem: kritik.** Top bacaya sağdan vuruyor, baca sola, yani vurulduğu yönün doğal tarafına devriliyor. Planlanan yön hiçbir planda gösterilmiyor: şeritli halka yalnız tabanı çeviriyor, P tabelası kadraj dışında kalıyor. Sessiz izleyen "doğru düştü" sanır. Dosya: `b-sahneler.js` (`drawLot`, `drawRing`, `b20-*`). Öneri: 29,0 geniş planda ve 36,5'te bacanın sağ arkasına uzanan belirgin bir "devrilme koridoru" çiz (yerde sarı boyalı şerit ve iki sıra şeritli direk). Baca bunun tersine, otoparka düşsün; P tabelasını kadraja al (x≈150). Kanıt: `devrilme-yonu.jpg`, `sarsinti-37_0.jpg`.

2. **45,5–48,4 · H K damgası yalnız yaklaşık 0,9 sn temiz görünüyor. Önem: önemli.** "Two letters" boyunca el damgayı tamamen örtüyor. "H, and K" (46,6) denirken K hâlâ tozun altında. Temiz damga 47,5'te çıkıyor, 48,38'de plan kesiliyor; DIKKAT.md 2 sn istiyor. Dosya: `b-sahneler.js` (23–25). Öneri: silme 46,0'da bitsin, harfler "H" sözcüğünden önce açık olsun. Gerekirse el, damganın altından geçen kısa bir üfleme hareketine dönsün. Kanıt: `hk-damga.jpg`.

3. **0,0–2,6 · Altyazı Kaan'ın saç tutamının ve alnının üstünde (y≈700–860). Önem: önemli.** Diğer bütün planlarda altyazı y≈1180–1300 arasında. Burada karakterin imzası olan tutamı örtüyor, STIL kuralını da bozuyor. Dosya: `paket.js` ya da `a-sahneler.js` açılış planı. Öneri: altyazıyı standart bölgeye indir ya da Kaan'ı yaklaşık 250 px aşağı al (kamerayı biraz geri çek). Kanıt: `acilis-altyazi-liste.jpg`.

4. **Topun sürekliliği. Önem: önemli.** 16,5–20,5'teki Daisy tanıtımında kanca boş; top ilk kez 29,0'da birden beliriyor. 35,4–36,2 Kaan planının arka planında yine yok (`bg-kaan-pre` için `noBall: true`, satır ≈546), 40,75'ten sonra arka planda var. Öneri: `noBall` kaldırılsın; A tanıtım ya da JOB 1 planında top takılı görünsün. Kanıt: `bip-kaan-top.jpg`, `genis-profesor-moloz.jpg`.

5. **55,8–57,2 · Bitiş kartı Daisy'nin uyarı ışığının alt yarısını örtüyor. Önem: önemli.** Karartma da ışığı söndürüyor; son karede dizinin imzası görünmüyor. Dosya: `paket.js` (bitiş kartı). Öneri: kartı y≈1000–1300 arasına indir, ışık kartın üstünde açıkta kalsın. Kanıt: `bitis-karti.jpg`.

6. **35,4–36,2 · "I ignored her" omuz silkmesi okunmuyor. Önem: küçük.** Bütün gövde yaklaşık 20 px yukarı kayıyor, omuz ve baş açısı değişmiyor. Ceket cebi 35,95 karesinde kayboluyor; 40,75 profesör planında da cep yok, açılışta var. Dosya: `b-sahneler.js` (`drawKaan` çağrısı); cep `cizim.js`'ten geliyorsa yönetmene. Öneri: omuzlar kalksın ve baş eğilsin (18 karelik tepki pozu); cep her planda olsun. Kanıt: `omuz-35_4-36_2.jpg`.

7. **36,24–36,49 · 0,25 sn'lik (8 kare) kol eklemesi flaş gibi kalıyor. Önem: küçük.** "En az 12 kare" kuralının altında. Öneri: eklemeyi 12 kareye uzat (Kaan planından al) ya da kaldır.

8. **27,0–28,2 · "Retry" dokunuşu "Try again" düğmesine denk gelmiyor. Önem: küçük.** Parmak 28,0'da yeni bölümün araç çubuğuna dokunuyor. Dosya: `b-sahneler.js` (`k.tap`). Öneri: dokunuş 27,3'te düğmeye hizalansın. Kanıt: `oyun-26_5-27_65.jpg`.

9. **4,75–5,1 · Liste yazısız boş bir kâğıt olarak giriyor. Önem: küçük.** "And a list" denirken kâğıt boş, yazılar 5,25'te beliriyor. Dosya: `a-sahneler.js`. Öneri: yazılar kâğıtla birlikte gelsin. Kanıt: `acilis-altyazi-liste.jpg`.

10. **Köşe simgesi sağ güvenli alana taşıyor. Önem: küçük.** Simge x≈950–1015, y≈225–300 arasında; STIL'in sağ 140 px sınırının içinde. Öneri: yaklaşık 60 px sola kaydır. Alt 480 px'e önemli bir şey düşmüyor (yalnız bacak ve teker).

## Kontrol edilip sorunsuz bulunanlar
- İki bip ışığı ölçüldü: 6 kare yanık, 4 kare sönük, 6 kare yanık; sesle aynı karede (33,88). Bip sırasında yalnız ışık ve farlar değişiyor (`bip/b*.png`).
- Bitişteki tek bip 55,30'da, 6 kare. Sarsıntı 6 kare. 1,5 sn'den uzun durağan plan yok.
- Kaan'ın saç tutamı ve yeşil ceketi, Daisy'nin biçimi bütün planlarda tutarlı. Altyazı kontrastı her zeminde yeterli.

## Olduğu gibi kalsın
1. **15,25–16,3:** mavi karalamada tek parıltı ve ardından mavi parmak ucu. "Taze" sessizken de anlaşılıyor (`mavi-murekkep.jpg`).
2. **33,9–34,4:** iki bip. Her şey donuyor, ışık, kavisler ve farlar birlikte açılıyor.
3. **50,7–53,5:** gri geri dönüşte bipin tekrarı, ardından "Like she knew" ile farların açılması.

## Yönetmene soru
Ceket cebinin kimi planlarda görünmemesi `cizim.js`'teki bir pozdan mı geliyor? O dosyaya yalnız sen dokunabilirsin.
