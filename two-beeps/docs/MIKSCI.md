# Miksçi kılavuzu (bölüm başına)

Oku: `URETIM.md` (ses ve müzik kuralları, "Bölüm üretim adımları"), `docs/MIKS.md` (miks.py kullanımı, cue dosyası biçimi, pilotun ölçümleri), `docs/SES.md` (efekt kitaplığı ve cue eşlemesi), `docs/MUZIK.md`, `docs/dikkat/PART-N.md` (bölümün sessizlik ve vurgu kararları), `src/partN.timeline.json`, sahne dosyalarının sonundaki `TB.cuesA`/`TB.cuesB` (miks.py bunları node ile okur), örnek olarak `src/part1.cues.json`.

Görev: `src/partN.cues.json` yaz → `node src/kaydet.cjs --part N` → `python3 src/miks.py --part N --mux` → `out/partN.mp4` → telefon kopyası `out/two-beeps-partN.mp4` (`ffmpeg -i out/partN.mp4 -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart …`; 30 MB'ın altında) → `node src/kontak.cjs --part N --step 1 --cols 10 --out out/partN-kontak.png`.

Kurallar (Eymen'in kalıcı kararları):
- **Gürültü süpürmesi yok:** whoosh/swoosh, hava, hışırtı, fırça/silme sürtünmesi, üfleme gibi filtreli gürültü hiçbir yerde kullanılmaz. Geçişler sessizdir. `kalem-satir.wav` ve kâğıt sesleri gerçek nesne sesidir: yalnız gerektiği yerde, kısa ve kısık.
- **Müzik sabit seviyede:** konuşmaya göre kısma yok (`--ducking` kapalı). Müzik ≈ −29 LUFS sabit (pilot değeri); yalnız sahne düzeyindeki bilinçli sessizliklerde 0,4 sn solmayla çıkar/girer: iki bip penceresi, bölümün plan belgesinde "sessizlik" denen an(lar), bitiş (voiceEnd sonrası). Pilottaki müzik yapısını bölümün duygu eğrisine uyarla (tema-ana, gerilim, vurgu-son; MUZIK.md'deki 4 sn'lik kesme noktaları); her bölümde aynı tema tanınmalı.
- **İki bip:** `daisy-beep.wav` dosyasının başı `cues.beep` (ya da animatörün `bip` anı) ile aynı karede; o pencerede başka her şey susar. Hatıra karelerinde `daisy-beep-hatira.wav` (−12 dB). Bölüm sonu: `cues.endBeep` anında `daisy-beep-tek.wav`, önü ve arkası tam sessiz; soru kartı boyunca müzik yok, yalnız çok kısık ortam; son 1 sn'de `vurgu-son.wav` 0,8. saniyesinden (−24 dB) çalabilir (pilottaki gibi).
- Anlatıcı her zaman önde: cümle içinde anlatıcı–arka plan farkı ≥ 11 dB; toplam ≈ −14 LUFS, gerçek tepe ≤ −1 dBTP. Karakter konuşmaları da aynı anlatıcı sesidir (ayrı ses yok).
- Oyun sahnelerinde oyun sesleri (`oyun-*.wav`, süpürmesiz kısımları) yalnız telefon ekranı kadrajdayken; kesmede sert biter.
- Efektleri animatörlerin `TB.cues*` anlarına bağla (ad üzerinden; sabit saniye yazma). Kitaplıkta karşılığı olmayan an için uydurma gürültü üretme; sessiz bırak ve raporda yaz.

Doğrulama (kulakla dinleyemezsin; ölçerek): süre = timeline `duration`; LUFS/tepe; müziğe uygulanan kazancın konuşma içi/arası farkı 0 dB; iki bip ve tek bip kare hizası; bilinçli sessizlikler < −45 dBFS; anlatıcı–arka plan farkı tablosu. Kontak sayfasına bak: açılış (PREVIOUSLY bandı, etiket, kanca), altyazılar, bitiş kartı doğru mu; görüntüde bariz bir hata görürsen (boş kare, kırık çizim, kartın altında kalan önemli öğe) raporda zamanıyla yaz ama sahne dosyalarına dokunma.

Yalnız `src/partN.cues.json`, `out/partN*`, `out/two-beeps-partN.mp4`, `out/miks-partN-*.png` dosyalarına yaz (miks.py'de gerçek bir hata bulursan en küçük düzeltmeyi yap ve raporda belirt; başka bir miksçi aynı anda başka bölümü miksliyor: ortak dosyayı bozma). Commit atma. Rapor: ölçümler, sessiz bırakılan anlar, kulakla kontrol edilecek 3 yer (saniyeleriyle), görüntüde fark ettiğin hatalar.
