# Two Beeps: miks

## Çalıştırma
`python3 src/miks.py` → `out/part1-miks.wav` (48 kHz, stereo, 24 bit), ölçüm raporu, `out/miks-dalga.png`, `out/miks-spektrum.png`, `out/miks-seviye.png`.
`--mux`: `out/part1-video.mp4` ile `out/part1.mp4` (görüntü kopya, AAC 192 kb/s, süre = `timeline.duration`). `--muzik-db -29`: müzik kanalının sabit seviyesi (LUFS). `--ducking`: eski cümle kısması (varsayılan kapalı). `--bolum N`, `--cues`, `--anim`, `--olcme`.

## Cue dosyası (`src/partN.cues.json`)
- `satirlar`: `{t, dosya, kat, db, ss, sure|son, fadein, fadeout, pan, dongu, lp, yanki, not}`; `kat`: muzik, ortam, efekt, darbe, bip.
- Zaman: sayı ya da ifade (`s16.t1-0.39`, `beep`, `B.topDarbe`); liste verilirse ilk çözülen.
- `A.*`/`B.*`: `TB.cuesA`/`TB.cuesB`, betik `src/shots/*.js`'ten node ile okur.
- `kisma`: yalnız sahne sessizlikleri (kesme → cümle 15 sonu, iki bip, bitiş), 0,4 sn solma. `koruma`: yalnız tek seferlik efektler. `olcum_sessizlik`: ölçülecek pencereler.

**Kalıcı kurallar:** müzik konuşmaya göre kısılmaz, bölüm boyunca sabittir; ortam ve motor da sabit ve kısıktır. Whoosh/swoosh türü gürültü süpürmesi yoktur.

## Ölçüm (son tur)
- 58,1 sn, 1080×1920, 30 fps; toplam −14,0 LUFS, gerçek tepe −1,1 dBTP. Müzik kanalı −28,9 LUFS.
- Müziğe uygulanan kazanç konuşma içinde ve cümle arasında aynı (fark 0,00 dB). Müziğin kendi RMS'i konuşma içinde 1,1 dB yüksek; bu tema dinamiğinden geliyor, kısmadan değil.
- Anlatıcı müziğin cümle içinde en az 11,4 dB, ortanca 15,7 dB üstünde. Bütün arka planın en az 11,4 dB üstünde (cümle 5).
- Sessizlik: kesmeden cümle 15 sonuna kadar müzik −213 dBFS, arka plan −53. Bitişte bipten önce ve sonra −∞.
- Kare hizası: iki bip 1016/1026, top darbesi 1109, yere çarpma 1161, tek bip 1641 (±2 ms).

## Kulakla kontrol
1. **8–10 ve 16–18 sn**: anlatıcı–müzik farkının en dar olduğu yerler.
2. **28,5–31,5 sn**: müzik solar, oyun sesi 28,99'da kesilir, gerilim 30,74'te yumuşak girer.
3. **51,4–58,1 sn**: hatıra bipi, sessizlik, tek bip, kart.
