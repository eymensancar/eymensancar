# Two Beeps: miks

## Çalıştırma
`python3 src/miks.py` → `out/part1-miks.wav` (48 kHz, stereo, 24 bit), ölçüm raporu, `out/miks-dalga.png`, `out/miks-spektrum.png`, `out/miks-seviye.png` (katman katman seviye + cümleler).
`--mux`: `out/part1-video.mp4` varsa `out/part1.mp4` (görüntü kopya, AAC 192 kb/s, süre = `timeline.duration`). `--bolum N` başka bölüm; `--cues`, `--anim` başka dosya; `--olcme` raporsuz.

## Cue dosyası (`src/partN.cues.json`)
- `satirlar`: `{t, dosya, kat, db, ss, sure|son, fadein, fadeout, pan, dongu, not}`. `kat`: muzik, ortam, efekt, darbe, bip.
- Zaman: sayı ya da ifade: `s16.t1-0.39`, `beep`, `dur-1`, `A.inkGlint`. Liste verilirse ilk çözülen kullanılır: `["B.darbe", "s19.t1+0.06"]`.
- `A.*`/`B.*`: animatörlerin `TB.cuesA`/`TB.cuesB` anları; betik `src/shots/*.js` dosyalarından node ile kendisi okur. A bağlandı. B gelince satırlardaki `B.` adları B'nin adlarıyla değiştirilir.
- `kisma`: pencereler (bip, sessizlikler). `konusma_kisma`: cümle zamanlarından kısma (müzik −8, ortam −4, efekt −3 dB). `koruma`: anlatıcı konuşurken arka planı en çok 15 dB daha kısar (darbe hariç).

## Ölçüm (son tur)
- −14,1 LUFS, gerçek tepe −1,4 dBTP, LRA 4,1.
- Cümle içinde anlatıcı ile arka plan arasındaki fark en az 14,7 dB (cümle 21). Sesli 100 ms pencerelerin %96'sı 12 dB üstünde, en kötüsü 9,2 dB (15,1 sn, tink).
- İki bip (33,84): bip RMS −17,6 dBFS, geri kalan −116. Tek bip (55,23): geri kalan −∞.
- Sessizlik: 15'ten sonra −49,8 dBFS (rüzgâr nefesi), bitişte bipten önce ve sonra −∞. Bitiş kartı −41,8 dBFS.
- Darbe tepesi −6,1, baca −5,6 dBFS. 120 Hz üstündeki enerji %41 ve %60.

## Kulakla kontrol
1. **28,0–31,9 sn**: müzik 28'de çekilir, oyun sesi 29,36'da sert kesilir, "Real chimneys don't." sessizliği gelir.
2. **33,5–35,3 sn**: iki bip tek başına, "Twice." üstüne binmemeli.
3. **53,7–57,2 sn**: tam sessizlik, tek bip, kartta hafif rüzgâr ve kısık vurgu (La La atlanır, ikinci bip duyulmasın).
