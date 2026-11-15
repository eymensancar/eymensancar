# Two Beeps: miks

## Çalıştırma
`python3 src/miks.py` → `out/part1-miks.wav` (48 kHz, stereo, 24 bit), ölçüm raporu, `out/miks-dalga.png`, `out/miks-spektrum.png`, `out/miks-seviye.png`.
`--mux`: `out/part1-video.mp4` ile `out/part1.mp4` (görüntü kopya, AAC 192 kb/s, süre = `timeline.duration`). `--bolum N` başka bölüm; `--cues`, `--anim` başka dosya; `--olcme` raporsuz.

## Cue dosyası (`src/partN.cues.json`)
- `satirlar`: `{t, dosya, kat, db, ss, sure|son, fadein, fadeout, pan, dongu, lp, yanki, not}`; `kat`: muzik, ortam, efekt, darbe, bip.
- Zaman: sayı ya da ifade (`s16.t1-0.39`, `beep`, `dur-1`, `B.topDarbe`); liste verilirse ilk çözülen.
- `A.*`/`B.*`: animatörlerin `TB.cuesA`/`TB.cuesB`; betik `src/shots/*.js`'ten node ile okur. Görüntü değişince yeniden çalıştırmak yeter.
- `kisma`: pencereler (bip, sessizlikler). `konusma_kisma`: cümle zamanlarından kısma. `koruma`: cümle içinde arka planı anlatıcının 15 dB altına çeker.

**Kalıcı kural:** whoosh/swoosh türü gürültü süpürmesi yok. Çıkarılanlar: baca düşüş süpürmesi ve toz hışırtısı, oyun "boom" süpürmesi, damga fırçası, halat (gürültü katmanı).

## Ölçüm (son tur)
- −14,1 LUFS, gerçek tepe −1,2 dBTP; mp4 57,2 sn, 1080×1920, 30 fps.
- Cümle içinde anlatıcı arka planın en az 16,9 dB üstünde; sesli 100 ms pencerelerin %96'sı ≥ 12 dB (en kötü 9,2 dB).
- İki bip: geri kalan −115 dBFS. Tek bip: −∞. 15'ten sonra −50,9 dBFS; bitişte bipten önce ve sonra −∞.
- Ses-görüntü: bip tonları (kare 1016, 1026), top darbesi (1109), yere çarpma (1161), tek bip (1658) ışık/cue ile aynı karede (±2 ms).
- Darbe tepeleri −6,5 / −6,6 dBFS.

## Kulakla kontrol
1. **28,0–31,9 sn**: müzik 28'de çekilir, oyun sesi 28,99'da sert kesilir, sessizlik.
2. **33,8–35,3 sn**: iki bip tek başına; "Twice." üstüne binmez.
3. **51,4–57,2 sn**: hatıra bipi (kısık, boğuk, yankılı), sonra tam sessizlik, tek bip, kartta hafif rüzgâr.
