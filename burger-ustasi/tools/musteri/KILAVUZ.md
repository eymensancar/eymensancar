# Müşteri ince ayar kılavuzu (ajanlar için)

Amaç: Burger Ustası için **200 elle ayarlanmış, düzgün görünen karikatür müşteri**. Otomatik üretici (`musteri.js`) parçaları birleştiriyor ama saç, sakal, bıyık ve şapka çoğu zaman kafaya tam oturmuyor. Her karakter tek tek açılıp **tam oturana kadar** düzeltilecek. Eymen 200'ünü tek tek kontrol edecek; özensiz bir tane bile geri döner.

## Araçlar
- `musteri.js`: üretici. **Bu dosyayı değiştirme** (on iki ajan aynı anda çalışıyor). Genel bir hata bulursan son raporunda yaz.
- `node ciz.cjs karakterler/NNN.json`: karakteri çizer → `karakterler/NNN.png`. Üstte 6 duygu (happy, wait, imp, angry, love, sad), altta "wait" ve "happy" 3 kat büyük, ızgaralı (bir kare = 10 birim). PNG'yi **Read ile aç ve gözünle bak**. Her değişiklikten sonra yeniden çiz ve bak.
- `node ciz.cjs --tohum 1234 cikti.png`: rastgele temel karakter (JSON'unu da yazar).

## Karakter dosyası: `karakterler/NNN.json` (NNN: 001–200, üç haneli)
```json
{"no": 17, "ad": "Emekli öğretmen Nermin", "m": {
  "cinsiyet": 0, "yuz": 0, "ten": 1, "sac": 2, "sacRenk": 7, "kas": 0, "goz": 2, "burun": 0,
  "biyik": 0, "sakal": 0, "gozluk": 1, "sapka": 0, "kiyafet": 2, "kRenk": 4, "ek": 4,
  "ayar": {"sacOn": {"y": 2, "sx": 1.04}, "gozluk": {"y": -1}},
  "ozel": {"sacOn": "<path d='…' fill='#9aa0a6'/>"},
  "renk": {"sac": "#a9a9a9"}
}, "not": "Saç ön katmanı 2 birim aşağı, alnı tam sarıyor; gözlük göze indirildi."}
```
Parça numaraları `musteri.js` → `P` listelerinin sırasıdır (0'dan başlar). `cinsiyet`: 0 kadın, 1 erkek. Kadınlara izin verilen parçalar `ALLOW` içinde (kadında bıyık ve sakal yok).

## Elle ayar
- `ayar[katman] = {x, y, s, sx, sy, r}`: katmanı çapa noktasına göre kaydırır (x, y birim), büyütür (s ya da sx/sy), döndürür (r derece).
- `ozel[katman] = "<svg parçaları>"`: o katmanın çizimi yerine senin çizimin (ayar yine uygulanır). Saç ya da sakal kafaya hiç oturmuyorsa **kendi yolunu çiz**: kafa şekli `musteri.js` → `FACES` (yT tepe, yM yanak, yB çene, wT/wM/wB yarı genişlikler; merkez x=60) ve `headPath()`'teki eğri. Saç rengini `renk.sac` ya da `HAIRC[sacRenk]` ile aynı tut.
- `ozel.alt` başın arkasına, `ozel.ust` en üste ek çizim (ör. saç tutamı, şapkanın altından çıkan saç, kulak arkası).
- `renk = {sac, ten, kiyafet}`: doğrudan renk.
- Katmanlar (çizim sırası): `sacArka, kiyafet, kulak, bas, ek, sakal, agiz, biyik, burun, goz, kas, gozluk, sacOn, sapka`. Çapalar: saç ve şapka kafa tepesi (60, yT); sakal çene (60, yB); ağız (60, yM+20); bıyık (60, yM+14); burun (60, yM+6); göz ve gözlük (60, yM−5); kaş (60, yM−15).
- Çizim alanı: x 0–120, y 0–140 (görünen alan viewBox "-4 -14 128 154").

## "Tam oturdu" ölçütleri (altı duygunun hepsinde)
1. **Saç kafaya oturur:** saçla kafa arasında boşluk ya da tuhaf ten şeridi yok; saç çizgisi alnı doğal izler; yanlar şakakları kulağa kadar örter; arka saç kafanın arkasında doğru yerde; saç havada durmaz, kafanın içine gömülmez; kaşları tamamen kapatmaz (kâkül hariç).
2. **Sakal çene hattını izler:** yanaktan çeneye düzgün iner, tam sakal favorilerle ve saçla birleşir; ağzı hiçbir duyguda kapatmaz (happy ve angry açık ağızlarına bak).
3. **Bıyık** burunla ağız arasında; burnun üstüne binmez, ağzı örtmez, ortalıdır.
4. **Şapka** kafaya oturur: alında durur, havada değil, gözlerin üstüne inmez; altından saç doğal çıkar (gerekirse `ozel.ust` ile tutam ekle); saç şapkanın üstünden fırlamaz.
5. **Gözlük** gözlerin üstünde, sapları kulağa gider; kaşlarla çakışmaz.
6. **Kaşlar** gözlerin üstünde, saçın altında kalmaz, iki kaş simetrik.
7. **Bütün:** sevimli, inandırıcı bir karikatür; kadın/erkek tutarlı; parçalar birbirine yakışır (ör. topuz + bere olmaz). Kafa, kulaklar, boyun ve kıyafet arasında kopukluk yok.

## Çeşitlilik (her ajan kendi aralığında)
- Yaklaşık yarısı kadın, yarısı erkek. Birkaç yaşlı (kır/beyaz saç, kırışık, gözlük), birkaç genç.
- 8 ten renginin hepsinden kullan. Saç biçimleri, yüz şekilleri, burunlar karışık; aynı karakter iki kez olmasın.
- Her karaktere bir **kimlik** ver ve parçaları ona göre seç (ör. "İnşaat ustası Rıza" → baret, bıyık; "Üniversiteli Ece" → at kuyruğu, kapüşonlu; "Aşçı Hasan" → aşçı şapkası). `ad` alanına yaz. Bıyık, sakal, gözlük, şapka kimliğe uyuyorsa koy, uymuyorsa koyma; hepsine aksesuar yığma.
- Rastgele tohumla başlayabilir ya da parçaları doğrudan seçebilirsin.

## İş düzeni
Her karakter için: başla → `ciz.cjs` → PNG'ye bak → sorunları yaz → ayarla → yeniden çiz → bak … tam oturana kadar (genelde 3–6 tur). Bitince JSON'daki `not` alanına ne yaptığını yaz. PNG'ler kalabilir (sonra silinir).
