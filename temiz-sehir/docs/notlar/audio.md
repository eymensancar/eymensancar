# audio.js — notes (owner: audio)

File: `www/js/audio.js`. Contract: MIMARI §4.8, §6. Test: `node test/audio/run.mjs` (harness `test/audio/harness.html`, output `test/audio/out/report.json` + `sequence.wav`).

**Nobody has listened to any of this.** Every check below is numeric (levels, spectra, pitch). The 30 s WAV of the main sequence is in `test/audio/out/sequence.wav` for a human to judge.

## What is implemented
- Exports: `init, update, play(name, opts), setEnabled(sound, music), unlocked, save (null), load`.
- **Unlock:** the `AudioContext` is created and resumed on the first `pointerdown/touchend/keydown/mousedown` (capture listeners on window; a 1-sample buffer is played inside the gesture for iOS). Suspends on `app:pause`, resumes on `app:resume` (only after a gesture). With sound and city sound both off the context is suspended (zero audio-thread cost).
- **Graph:** one-shots/loops → sfx bus; city bed → amb bus; both → master → high-pass 110 Hz (phone speakers cannot play below; saves headroom) → compressor (−14 dB, 5:1, 3 ms) → out.
- **Synthesis:** all one-shots are generated as Float32Arrays in `init()` (behind the boot curtain) at 24 kHz with band-limited wavetables, SVF-filtered seeded noise and bells; at unlock they are only wrapped in AudioBuffers (3.8 ms). Playing = BufferSource + Gain (+ StereoPanner when positional). Pitch = playbackRate.
- **Voice limiting:** per sound max voices (oldest stolen with a 10 ms fade), min gap, global cap 28.
- **Sounds and triggers:** pickup pop with a rising ladder (+`feedback.pickupPitchStepSemis` per pickup inside `pickupChainWindowS`, capped at `pickupPitchMaxSemis`, ±0.35 semitone jitter) on `tool:collect` (hands, broom softer); valuable chime; broom swish on `tool:swing` (volume by speed) plus a continuous broom texture whose level follows speed and amount swept; cart vacuum loop (motor saw + band-passed noise) whose pitch follows speed and brightness follows nozzle down + recent intake; engine rev on `player:mount`; nozzle down/up; robot hums (up to 4, triangle + saw, distance² falloff to `feedback.robotHumMaxDistM`, pan from the listener yaw, pitch up while travelling); coin cascade on player sale (3–16 coins rising over the counter-roll time, "ka-ching" for ≥ 40 coins or a valuable); single positional coin for robot sales; full-bag thud; purchase cash register + arpeggio; three different milestone stingers (25/50/75); fanfare on `district:cleaned`; wind gust on the final sweep; boost sparkle; equip whoosh; panel open/close bloops; UI click (`play('click')` from ui); footstep crunch (≤ 4/s) on `player:step`.
- **City bed** (amb bus, the "music" setting): brown-noise traffic rumble, a fly buzz and occasional distant horns at 0 %; as `trash.cleanFraction()` rises (smoothed, τ ≈ 2 s) the rumble drops and darkens, flies fade out by 60 %, horns stop by 55 %, a soft breeze opens and bird chirps become frequent (0.04 → 0.9 per s).

## Verified (OfflineAudioContext renders in headless Chromium, `test/audio/run.mjs`, all PASS)
- No clipping anywhere: 30 s sequence peak −3.2 dBFS; **worst case** (30 broom pickups/s + swishes + broom loop + cart vacuum + 4 robot hums + 2 400-coin cascade + purchase + stinger + 8 robot sales at once) peak −2.5 dBFS, 0 clipped samples.
- 30 pickups/s: RMS −16.8 dBFS, 85 % of the energy in 500 Hz–2 kHz, 0.6 % below 120 Hz (phone-speaker friendly).
- Pickup ladder (10 pickups 0.15 s apart), measured fundamental: 587, 627, 708, 842, 703, 752, 824, 868, 978, 1231 Hz (rises ~ a semitone per pickup; one dip from the jitter/measurement).
- City bed 0 % vs 100 %: RMS −34.0 → −38.9 dBFS, centroid 300 Hz → 2.8 kHz (rumble replaced by air and birds).
- Positional: a coin 10 m east while facing north is +4.3 dB in the right channel; west +3.8 dB left.
- `setEnabled(false, false)`: −89 dBFS peak 0.4 s later.
- CPU: `audio.update` mean 0.009–0.026 ms, max 0.3 ms per frame (20 Hz internal rate); in the UI page 0.004–0.006 ms/frame; first `play()` of any sound ≤ 0.3 ms; unlock 3.8 ms. Synthesis in `init()`: ~210 ms on this desktop (cold JIT), so on an iPhone expect a few hundred ms added to the boot curtain.

## Assumed / not verified
- How it sounds, and the mix on real phone speakers (levels were set by numbers, not ears).
- iOS unlock inside the claude.ai iframe and WKWebView; behaviour after phone calls/interruptions (resume is attempted on the next gesture).
- Real-time CPU on WebKit's audio thread (node count stays small: ~25 persistent nodes + ≤ 28 voices).

## Contract issues (Sözleşme sorunları)
- §4.8 lists `setEnabled(sound, music)`; there is no music in the slice, so `music` drives the city ambience bed (ui labels it "Şehir sesi"). 
- `play(name, opts)` names are this module's (`pop, chime, coin, kaching, swish, thud, click, purchase, ms1..3, fanfare, boost, open, close, equip, nozzleDown, nozzleUp, robot, crunch, rev, gust, horn, chirp`); other modules normally do not need them because everything is driven by §6 events. Extra opts used: `delay`, `maxDist`.

## Tunables
`A` (bus levels, compressor, hum/vacuum/broom levels, bed curves 0 → 100 %, bird rate, horn interval) and `SND` (per sound volume, max voices, gap, pitch jitter) at the top of audio.js.

## Known weak points
- Init synthesis time (boot) instead of zero; could move to a Worker if boot time matters.
- Coin cascade voices are scheduled ahead; a new cascade within 0.8 s steals the oldest coins (max 18).
- Robot hum is per robot index, not per robot id (fine for ≤ 4 robots that are never removed).
