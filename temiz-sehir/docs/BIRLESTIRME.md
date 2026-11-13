# Temiz Şehir: integration log (birleştirme)

Owner: integrator (phase 3). Five programmers built the modules in parallel against `docs/MIMARI.md` without ever running them together. This file records every decision on the contract issues they raised (`docs/notlar/*.md`, "Sözleşme sorunları"), every defect found while playing the real game end to end, and what was done. `docs/MIMARI.md` was updated to match.

Everything here was verified in **headless Chromium with SwiftShader** (software WebGL) on a desktop CPU, with real CDP multi-touch input. Real-iPhone fps, Safari/WKWebView behaviour, sound and haptics are **not verified** (see "Not verified" at the end).

## 1. First boot

The real modules booted together on the first try: no load error, no missing export, no init-order failure, every module real (no stub), zero console errors. The integration work was therefore about contracts that each side had read differently, duplicated work, missing data in config.js, and defects that only show in real play.

## 2. Decisions on the contract issues (one each, applied everywhere)

| # | Issue (raised by) | Decision |
|---|---|---|
| 1 | Removal juice drawn twice: trash.js (flying items inside its instanced meshes + cell dust) and tools.js (own flying-copy InstancedMesh + dust) (trash, tools) | **trash.js owns it** (0 extra draw calls, exactly the removed items). tools.js lost its flying-item system (`buildFly/spawnFly/updateFly`, one draw call) and its pick/cart dust; it keeps the broom stroke puff (rhythm) and the valuable sparkle. Hand picks fly to the bag in the left glove: `CONFIG.tools.handTarget`, shared by tools and trash. |
| 2 | Robot names and colours invented twice, different (economy: Pırıl/Fıstık/Bulut/Şimşek, coral/teal/yellow/violet; ui: Pırıl/Fırfır/Şimşek/Pamuk, other colours) (economy, ui) | `CONFIG.robot.names` = STR keys `robot_n1..4` (Pırıl, Fıstık, Bulut, Şimşek; EN Sparkle, Peanut, Cloud, Flash), `CONFIG.robot.colors` = economy's palette (it is on the meshes). `robots()[i].name` is the short name; ui formats the tag with STR `robot_name` ("Robot 1: Pırıl"). Fixed a double prefix ("Robot 1: Robot 1: Pırıl") in the shop's robot list. |
| 3 | Away cap 2 h / 50 % living in economy.js defaults (economy) | `CONFIG.offline { capS: 7200, maxFractionOfRemaining: 0.5, minSimS: 2, announceMinS: 60 }`. |
| 4 | ~45 ui strings + 7 economy strings missing from STR, local fallback tables (ui, economy) | All moved into `STR` (tr + en); ui's `FB_STR`, economy's `FALLBACK_STR` and main's `MAIN_STR` deleted. |
| 5 | Tunables at the top of player.js (`CTRL`), tools.js (`TL`), economy.js (`ECONOMY_DEFAULTS`), ui.js (`UI_DEFAULTS`) (player, tools, economy, ui) | Moved to `CONFIG.player.controller`, `CONFIG.tools`, `CONFIG.robot` (AI fields) / `CONFIG.offline` / `CONFIG.selling.resellDelayS` / `CONFIG.income`, `CONFIG.ui`, `CONFIG.haptics`, `CONFIG.render`. The local tables are gone; config.js is the single source. (trash's `LOOK` and world's `VIS` stay: engine look, not design data, as their notes say.) |
| 6 | Cart: `exit` (90) always beat `nozzle` (80) on the one button (ui, tools) | ui's **secondary button** shows the second offer if its priority ≥ `ui.secondaryMinPriority` (50). In the cart tools offers **both, always**: `nozzle` 90 on the big button, `exit` 80 on the secondary. tools' "exit only when stopped" rule removed. |
| 7 | Offer labels: §4.9 says "label key", tools/economy passed translated text, ui guessed (icon for "nozzle up" never showed) (found at integration) | Labels are **STR keys**; ui translates (language switch applies at once). |
| 8 | FOV: 60° vertical = 102° horizontal on 844 × 390, above PSIKOLOJI's 75–90° (player) | main derives the vertical FOV from **85° horizontal** in landscape, clamped to [44°, 65°] vertical (46° on 19.5:9, 54° on 16:9); portrait 75° vertical. One function (`fovFor`). The view model (tuned for 60°) is depth-stretched by tan 30°/tan(fov/2) so it keeps its screen size; the chase camera was moved back (4.6 m, +1.1 m) for the narrower view. |
| 9 | `economy:away` (economy) vs `economy:offline` (ui) (economy, ui) | **`economy:away`** (economy emits it, payload as economy wrote it). ui listens to it and shows the one "welcome back" card; economy no longer adds a toast (it showed twice). ui's coin/unit diff stays only as a fallback. |
| 10 | `tool:full` not in §6 (tools) | Added to §6. audio plays the dull thump on it. |
| 11 | `removeCell` not in §4.3 (trash) | Added to §4.3 (economy does not need it: it cleans along segments). |
| 12 | `blockSize` units ambiguous (economy) | `info().blockSize` is in cells (12), new `info().blockSizeM` (6) in metres. |
| 13 | `ui:settings` and the settings other modules must read (ui) | Settings documented in MIMARI §4.1. player reads `sens`, `invertY`; tools reads **`steer`** (was `cartControl` in tools, `steer` in ui: unified on ui's name); main reads **`quality`** on `ui:settings` (auto / high / low, below); `haptics` is read by `ctx.haptic`; audio `sound`/`music`. |
| 14 | Reset save undone by main's pagehide save; ui worked round it via `ctx.params` (ui) | `ctx.save.reset()` in main: clear, block every later write, reload. ui calls it. |
| 15 | Haptics had no owner: ui and tools both vibrated, doubling purchase/sale/collect (ui, tools) | `ctx.haptic(kind)` in main: one rate limiter (light ≤ 15/s), reads `settings.haptics`, Capacitor Haptics plugin or `navigator.vibrate`. ui triggers buttons, sale, full bag, purchase, milestones; tools triggers picks/collect, cart bump, getting in, nozzle, full feedback. |
| 16 | `__ts.look` / `__ts.stick` had no player API (economy/debug) | `player.look(yaw, pitch)` and `player.setStick(x, y)` (virtual stick merged like the keyboard). |
| 17 | Drop-off container outside the district bounds (world) | Kept outside (it never covers trash cells), sell zone inside at (3, 51). Verified: the player sells there by touch, robots unload at the nearer point, the cart reaches it. |
| 18 | Small props not solid (world) | Lamp posts inside the district (r 0.16 m) and the 4 plaza tree trunks (r 0.2 m) are solid circles in `collide/isBlocked/segmentClear`; benches and bins stay walk-through. The chase camera ignores them (`segmentClear(..., ignoreSmall)`), otherwise it jumped in behind every pole. |
| 19 | Guide arrow while mounted reads the tank (world) | Accepted as implemented. |
| 20 | Extensions (economy `grant/debugState/simulateAway/canOfferBoost(where)`, player `liftState/endLift`, vehicle descriptor extras, tools `perfSample/cartState`, trash `debugInfo`, `TrashResult.value`) | All accepted and written into §4. |
| 21 | Finale lift had no defined end (player) | Ends when the completion card closes or on input after 2 s (as implemented); ui emits the close. |
| 22 | Depth texture risk (trash §7, MIMARI §13): needs a float extension? | No: UNSIGNED_BYTE + LINEAR, vertex-sampled. Added an **RGBA8** path (now the default, mirrors only the uploaded rows) besides LuminanceAlpha (`?depth=la`); same picture (verified). |
| 23 | Balance (economy bot: cart at 14:19, 100 % at 18:24) | Applied the bot's recommendation, then moved robot #1 into PSIKOLOJI's 6–8 min window without losing the cart ≤ 12 min: final prices dropoff 750, robot_1 1400, broom_s1 1450, robot_2 1500, cart 2300, robot_speed_1 2900, robot_cap_1 3200, robot_speed_2 4500. Timeline in TASARIM §3a, asserted by `test/run-all.mjs`. |
| 24 | Broom caps walking speed even when full (tools) | Kept as designed (TASARIM). Noted as a playtest question. |

## 3. Defects found by playing the real game (and what was done)

| # | Where | Defect | Fix |
|---|---|---|---|
| D1 | tools | Holding the button with hands could pick **nothing** forever: an item's top sits up to 0.46 m from its cell centre and the cone samples used a 0.3 m pick radius (the autoplayer stood at the kiosk holding, 0 items) | cone pick radius 0.5 m (`tools.conePickRadiusM`) and a last fallback to the nearest dirty cell within reach |
| D2 | ui | **Ghost click (touch):** the context button opens the shop on pointerdown; the click the browser synthesizes after the tap landed on the shop's backdrop (portrait layout) and closed it at once. On a phone the shop could not be opened from the button in portrait | `touchend` preventDefault on the context buttons + panels ignore clicks for 350 ms after opening |
| D3 | ui/finale | The completion card covered the whole screen at 3.2 s, before the 4 s camera lift ended: the clean district was never seen | card at 4.6 s; landscape: a side panel over a light scrim, camera turned 20° so the district sits in the left half; portrait: a bottom sheet |
| D4 | ui/finale | Context buttons, stick and robot "+coins" pops stayed on screen during the lift (pops at the top edge read "+294198") | `.fin` state hides controls, hints, indicator and pops while the lift runs or the card is open |
| D5 | ui | No robot name in the world (PSIKOLOJI §3 "Robot 1: Pırıl") | name tags projected above robots within 26 m, outside the HUD bands, DOM writes only on change |
| D6 | ui | Stale "Çanta dolu" toast overlapped the "+36 altın" of the sale that emptied the bag | a sale drops pending bag/tank-full toasts |
| D7 | ui | English "Stiff bristles" clipped in the goal chip (portrait) | EN "Fast broom" |
| D8 | trash | Cleaned asphalt looked like snow at eye level (washed gain 1.5 + strong grazing sheen) | gain 1.35, lift 0.035, sheen 0.32: still clearly lighter, reads from the street end (shot 08) |
| D9 | tools/FOV | With the narrower FOV the gloves filled a third of the screen | depth stretch of the view model (decision 8) |
| D10 | player | Chase camera too close for the new FOV, and pulled in by the new solid poles | 4.6 m / +1.1 m; poles ignored for the camera |
| D11 | main | Sandboxed iframe (opaque origin): every save attempt threw and warned every 10 s | storage probed once; without it the game plays on and says so once (`console.info`) |
| D12 | main | WebGL context loss only paused and showed a toast forever if the browser did not restore | save at loss; restore → resume; no restore in 4 s → save and reload |
| D13 | main | No way to choose quality; ui wrote `settings.quality` that nobody read | `applyQuality()` (auto/high/low) on boot and `ui:settings` |
| D14 | economy/ui | Away summary shown twice (economy toast + ui card) | economy emits only `economy:away` (decision 9) |
| D15 | tests | Module tests encoded old contracts (flying copies in tools, exit 90, `cartControl`, 60° FOV tap position, toast on away, completion at 3.5 s) | updated to the decisions above; `test/ui/run.mjs` now exits non-zero on defects; audio's "calmer city" margin 4 → 2.5 dB (random horns made it flaky) |

Looked at and accepted (not changed): the 25/50 % milestone banner covers the top HUD for up to 9 s when it carries the boost offer (one tap dismisses it); after a long away return the 25 % and 50 % banners fire behind the welcome card; the view-model gloves are simple box art; the cart rides half-buried in deep trash at the cleaning front; robots look half-buried at their cleaning front.

## 4. How it was played (test/e2e/play.mjs)

Landscape 844 × 390 and portrait 390 × 844, real CDP touch, both pass all 43 checks: first launch → hold-to-pick (button) and tap-to-pick (on an item) → look drag to turn round + look up → stick walk into the shop zone → first sale → tap "Dükkan" → buy the sack by touch, close with X, reopen, buy the broom (shop closes itself) → sweep with the stick → (autoplay) drop-off → walk into the drop-off zone with a full bag → (autoplay) robot #1, name tag visible → away return (save aged 2.5 h, reload) → one honest card with the 2 h cap → (autoplay) cart → "Bin" by touch → drive with the stick, tank fills → nozzle up/down by touch → "İn" on the secondary button → (autoplay) 50 % → trail from the street end → (autoplay) 100 %: final sweep, camera lift, card → reload restores coins, items, %, robots, position and tool exactly. Long stretches use the in-page autoplayer (`test/e2e/autoplay.mjs`), which plays through the same APIs (button hold, virtual stick, cart driving, selling, "next" purchases).

## 5. Not verified (be honest)

- Real-device frame rate, thermal behaviour, Metal-backed ANGLE (vertex texture fetch with LINEAR filtering, texSubImage2D row uploads), Low Power Mode 30 Hz in practice (gameplay is dt-integrated and was checked at 30 vs 60 Hz updates).
- iOS Safari / WKWebView touch (pointer capture, the ghost-click fix, gesture prevention), the claude.ai iframe's real sandbox attributes, audio unlock on the first touch, every sound (nobody has listened), haptics (no device; iOS Safari has no `navigator.vibrate`, so only the Capacitor app can vibrate).
- Feel: walking speed, look sensitivity, cart steering, the narrower 85° FOV, motion comfort, and the balance with real people (the bot has no hesitation or exploration).
