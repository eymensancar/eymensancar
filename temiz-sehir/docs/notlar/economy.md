# economy.js + debug.js: notes

Owner: economy programmer. Files: `www/js/economy.js` (MIMARI §4.6), `www/js/debug.js` (§4.10, §12). Tests: `test/economy/`.

## What is implemented

**Structure.** `createEconomyCore(o)` holds every rule and the robot simulation in pure JS (no THREE, no DOM, no ctx). The module (`init/update/save/load` + the §4.6 API) wires the core to ctx and draws the robots. The Node balance bot and the unit tests drive exactly the same core with a model trash grid (`test/economy/model-trash.mjs`) built from config.js with the spike's layout and trashGen (`test/economy/fake-city.mjs`).

- **Coins:** `coins()`, `earn()`. Spending goes through `buy()`. Every change emits `economy:coins {coins, delta, reason}`, with reason `sale | robot | buy | milestone | finalSweep | away | debug`.
- **Bag and tank:** `bagUnits/bagCapacity/bagSpace/addToBag(units, byType, container)`. Units are tracked per trash type, so a sale's value is exact.
  - The tank has capacity only once the cart is owned.
  - `economy:bag` is emitted on change (once per frame). `economy:bagFull` is emitted once per transition to full.
  - If `addToBag` is given more than `bagSpace()`, it keeps the most valuable units and warns once (the caller should cap removal at `bagSpace()`).
- **Selling:** automatic inside a sell point radius (`radiusM` on foot, `cartRadiusM` when `pose.mounted`, which sells the tank and the bag).
  - Re-entering the zone sells at once. Standing inside sells new items at most every `resellDelayS` (1 s).
  - Feel (TASARIM §2/§4, PSIKOLOJI "count up"): `economy:sold` fires when the dump starts, with the full payload (`units, coins, byType, valuable, pointId, x, z, by, container, dumpS`), so ui and audio can arc the items and fly the coins.
  - During the dump the bag drains visibly over `selling.dumpAnimS` (0.6 s; `bagUnits()` counts down). The coins are credited with one `economy:coins` when the dump ends, so ui's counter rolls up as the coins "land".
  - Robots work the same way: `economy:sold {by: 'robot', robotId}` when they arrive, and coins after `robot.unloadS`.
- **Shop:**
  - `catalog()` returns all items sorted by price, with state `owned / available / locked`. `next` is the cheapest available item (CONFIG comment rule). `affordable` is set too. The array is reused.
  - `buy(id)` checks prerequisites, ownership and coins, applies `effect {set, value}` generically, then emits `economy:purchased` and `game:saveNow`, and `robot:added` for robots. `ui:buy` calls `buy()`.
  - `stat(name)` gives every stat in §4.6 from the per-level arrays.
  - The shop offer (`act_shop`, priority 60) shows within `shop.openRadiusM` of the shop sell point.
- **Boost (mock rewarded ad):** `startBoost()` (also on `ui:adWatched {kind: 'boost'}`) gives 2x on every sale (player, robots, final sweep) for 120 s, then a 300 s cooldown counted from the end.
  - The boost runs on game time.
  - Away income is never boosted.
  - `economy:boost` fires on start, once per second while active, and at the end.
  - `canOfferBoost()` (shop panel) is true only with ≥ 3 purchases, no active boost or cooldown, and the next item ≥ 60 s of income away. Income is an EMA of sale coins per second (10 s windows, 60 s time constant).
  - `canOfferBoost('milestone')` checks only active/cooldown; ui shows that offer once.
  - It never starts on its own.
- **Robots:** real simulated agents (details below), drawn in 3 draw calls.
- **Milestones and final sweep:**
  - `trash:milestone` pays `CONFIG.milestones[i].bonus` once. Paid indexes are persisted, so repeated or replayed events never pay twice.
  - At `cleanFraction() ≥ completion.finalSweepAt`, `trash.clearAll('final')` runs once. It pays the value of what it removed (× priceMultiplier × boost) and emits `economy:finalSweep {units, coins, durationS}`. Robots then sell what they carry and park at the dock.
- **Away / offline (PSIKOLOJI §6):** on `game:ready {awayS}` and `app:resume {awayS}`, the robots' work is credited.
  - Simulated time is `min(awayS, 2 h)` × measured units per robot-second. The rate is an EMA of real robot output with trips included; before 3 samples a prior of 2.4 u/s × speed level is used.
  - The units are also capped at 50 % of the remaining trash, so the district is never finished while the player is away.
  - The units are removed with `trash.consume()` around each robot (cleaned patches appear in the world). Their value is paid without boost, and whatever the robots carried or were unloading is sold.
  - One honest summary is emitted: the event `economy:away {awayS, simS, capped, limitedByRemaining, units, coins, robots, rateUps, capS}`, plus `ui:toast {text}` for absences ≥ 60 s. Example: "Sen yokken robotların 5.355 parça topladı: +11.305 altın (2 saatlik sınır)".
  - No "watch an ad to double" offer, nothing that shrinks with waiting, absences shorter than 2 s are ignored.
- **Save (`mods.economy`, v1):** `{v, coins, bag:{units, byType:{type: n}}, tank, owned[], levels{}, boost:{left, cd}, robots:[{x, z, yaw, load, byType, ax, az, units}], stats, purchases, swept, msPaid[], rate, income}`.
  - In-flight dumps and unloads are folded into `coins`, so a save never loses or doubles coins.
  - `load()` is tolerant:
    - unknown item ids are dropped;
    - missing prerequisites are filled in;
    - levels are recomputed from the owned items (the saved `levels` is informational);
    - bag counts are clamped to capacity;
    - bad robot positions fall back to the dock;
    - numbers are validated;
    - a newer `v` is read best-effort with a warning;
    - no `robot:added` events fire on load.
  - Autosave follows the contract: main saves every 10 s and on hide. Economy emits `game:saveNow` after a purchase, a milestone, the final sweep and an away catch-up.

### Robots (behaviour)
- **Deploy:** robots start at the dock (`world.point('dock')`, else `robot.dockPos`), side by side. Their anchor is the dock (`ax, az`; zone assignment could later just move the anchor).
- **Choosing work:**
  - Over the 6 m blocks of `trash.blockSums()`, each candidate block is scored: distance to the robot, plus 0.5 × distance to the anchor, plus a claim penalty (10 m) for blocks other robots are working in (3 m for neighbouring blocks). Banned blocks are skipped.
  - The robot then takes the nearest free dirty cell in the chosen block. Free means walkable, dirty, not at the player's feet, and not next to another robot or its target.
  - In effect a robot works outward from its anchor and spreads away from the others. From `robot.priorityStragglersAt` (90 %) the anchor term is dropped, so robots chase the remaining clusters anywhere.
- **Cleaning pattern:** back-and-forth rows one cell wide (`robot.swathM`), along the longer dirty run, stepping to the dirtier side. At a row end it searches a short 5 × 5 neighbourhood before jumping to a new block.
- **Speed and cleaning:**
  - The robot moves at `cleanSpeed` while there is trash ahead and at `moveSpeed` over clean ground.
  - It cleans with `trash.removeAlongSegment(..., swath/2, cap − load, 'robot')` along every step while it has room.
  - When full, it drives to the active sell point with the shortest path, unloads (`unloadS`), and returns to where it stopped.
- **Navigation:** a walk grid from `world.layout().kind` and `world.isBlocked` (rebuilt after the drop-off is bought). BFS distance fields are precomputed for each sell point and the dock; other targets get one BFS on demand, and only when the straight line is blocked. Paths are string-pulled with a grid line-of-sight check, so robots drive straight lines around buildings.
- **No jitter, never stuck:**
  - Turning is rate-limited (300°/s); the robot slows while misaligned and turns in place.
  - Time left after reaching a waypoint carries over to the next one.
  - A robot waits if the player (`robot.avoidPlayerM`) or a lower-numbered robot is in its direction of travel. After 2 s it picks other work; if still blocked, it passes by. Lower index has right of way, so there is no deadlock.
  - A watchdog re-plans after 4 s without progress and bans the block for 20 s.
- **Far robots:** beyond 30 m from the camera (4 m hysteresis), robots run the same logic in coarse ticks of 0.25 s, sub-stepped to ≤ 0.2 m and staggered across robots. Totals are the same (test below); the shown pose is smoothed, so the hand-over is seamless.
- **Presentation:**
  - Each robot has its own colour (coral, teal, yellow, violet) and a name ("Robot 1: Pırıl", Fıstık, Bulut, Şimşek).
  - The body is procedural: bumper, shell, lid, lidar turret and a front sensor bar.
  - The LED blinks green while cleaning, shows amber when full or unloading, and dim blue when idle.
  - A blob shadow and a dust-puff trail appear while removing trash, plus a slight wobble.
  - Draw calls: bodies (InstancedMesh, Lambert, vertex × instance colour), LEDs (InstancedMesh, Basic), and ground decals (one InstancedMesh for shadows and puffs). About 510 triangles per robot.
  - `robots()` entries also carry `name, color, hum (0..1), led (0 off, 1 green, 2 amber, 3 blue), far, index, units` for ui (name tag) and audio (hum).
  - `robot:collect {id, units, x, z}` is aggregated to ≤ 4 per second per robot.

### debug.js (`window.__ts`, only with `?debug`)
- **Everything in §12:** `ready, ctx, state(), teleport, look, give, own, setTool, hold, stick, tap, step, resume, clean, setClean, counters(), events(name), clearEvents, save, reload`.
  - `events()` records copies of payloads through `bus.setTrace`, keeping the last 5000.
  - `counters().instances` counts visible InstancedMesh instances.
- **Extras:**
  - `fast(seconds, dt = 1/30, render = true)` runs the gameplay updates without rendering each frame (SwiftShader renders at 0.3–1 s per frame), then renders once.
  - `econ()` returns the economy's internal state; `away(s)` runs the away catch-up.
  - `overlay(on)` / `overlayData()` sample fps, ms, calls, coins and robot states every 30 frames and emit `debug:overlay {on}` for ui.

## Contract issues (Sözleşme sorunları)
1. **Missing config fields.** The offline cap (2 h, 50 % of the remaining trash; PSIKOLOJI §6), robot names and colours, and the robot AI tunables are not in config.js. They live in `ECONOMY_DEFAULTS` at the top of economy.js. `CONFIG.robot.*`, `CONFIG.offline.*`, `CONFIG.selling.resellDelayS` and `CONFIG.income.*` override them field by field. Recommend the designer adds `offline: { capS: 7200, maxFractionOfRemaining: 0.5, announceMinS: 60 }`, `robot.names`, `robot.colors`.
2. **Missing STR keys:** `robot_name` ("Robot {n}: {name}"), `robot_n1..n4`, `away_summary` ("Sen yokken robotların {n} parça topladı: +{m} altın"), `away_capped` ("({h} saatlik sınır)"). Economy uses `ctx.t()` when STR has the key and the `FALLBACK_STR` table (tr/en) otherwise. Please add them to STR.
3. **New event `economy:away`** (payload above) is not in §6, and the summary goes to ui as `ui:toast {text}`. Extra payload fields:
   - `economy:sold`: `container`, `robotId`, `dumpS`;
   - `economy:finalSweep`: `durationS`.
4. **API extensions:**
   - `grant(id)` (debug `own`: owns the item and its prerequisites without paying), `debugState()` and `simulateAway(s)`.
   - `canOfferBoost(where = 'shop' | 'milestone')`.
   - Extra fields in `robots()`.
   - main's stub does not have the new functions. They are optional; debug.js falls back.
5. **Sale timing semantics** are not specified in §4.6. Chosen: `economy:sold` fires at dump start; coins are credited after `dumpAnimS` (player) or `unloadS` (robot); `bagUnits()` drains during the dump.
6. **Boost cooldown.** `boostCooldownLeft()` while active = `left + cooldownS` (cooldown counted from the end). The boost runs on game time and is not consumed while away.
7. **Final sweep payout** is "pays the value" in the contract. Implemented as value × priceMultiplier × boost.
8. **Far robots:** they use coarse ticks of the same simulation, not `trash.consume` (§13 open question). The cleaned trail stays exactly where the robot went, which consume (a growing disc) would not do. `consume` is used only for the away catch-up.
9. **`trash.info().blockSize` units** are ambiguous (trash-core returns cells, i.e. 12; the §4.3 comment says 6 m blocks). Economy derives the block size from `blocks` (count) and ignores `blockSize`.
10. **Robot deploy point:** TASARIM says the dock and PSIKOLOJI says "where the player stands". Implemented the dock, which is next to the shop where the player buys. Measured first clean 0.1–2.2 s after purchase (PSIKOLOJI checklist 8: ≤ 3 s, in view).
11. **Robot zones:** the design puts zones in the full game (hour 5), not in the slice, so there is no player assignment. The anchor per robot is the hook for it.
12. **debug ↔ player gaps:** player has no `look(yaw, pitch)` or stick API in §4.4.
    - `__ts.look` sets the yaw via `teleport` and warns that pitch is ignored.
    - `__ts.stick` synthesises WASD keydown/keyup on `window`.
    - Suggest player exports `look(yawRad, pitchRad)` and `setStick(x, y)`; debug.js already uses them if present.
13. **Audio hum (observation, not mine):** audio gives idle robots 0.6 of the hum volume. `robots()[i].hum` (0 when idle or parked) is available for a quieter dock.

## Tunables (ECONOMY_DEFAULTS, overridable from CONFIG)
- **robot:** `turnRateDeg 300`, `farM 30` / `farHysteresisM 4` / `farTickS 0.25` / `maxSubstepM 0.2`, `anchorWeight 0.5`, `claimPenaltyM 10`, `localSearchCells 2`, `waitMaxS 2`, `stuckS 4`, `banS 20`, `collectEventS 0.25`, puffs (`0.12 s`, `0.7 s`, `6`), `rateWindowS 10` / `rateTauS 120` / `ratePriorUps 2.4`, `colors`, `names`, `bodyRadiusM 0.33`, `bodyHeightM 0.2`.
- **offline:** `capS 7200`, `maxFractionOfRemaining 0.5`, `minSimS 2`, `announceMinS 60`.
- **selling:** `resellDelayS 1`.
- **income:** `windowS 10`, `tauS 60`.

## Verified (how) vs assumed
**Verified, `node test/economy/unit.mjs` (15/15, about 1.5 s):**
- Shop states, prerequisites, prices, total 28 890, all stats, robot spawning.
- Bag capacity, `byType`, `bagFull` once, tank only with the cart.
- Selling: radius, coins after the dump, exact value, drop-off locked until bought, cart radius and tank.
- Shop offer radius.
- Boost: 2x for 120 s, 300 s cooldown from the end, offer rules, `ui:adWatched`, about 1 event per second.
- Away: capped at 2 h and 50 %, coins equal to the summary, no boost, Turkish toast, never finishes the district, nothing for < 2 s, `game:ready` / `app:resume`.
- Save → JSON → load round trip, including an in-flight sale, junk saves and v2.
- Milestone bonus once; final sweep once with the rest paid.
- Robots, 4 robots × 10 min:
  - 2.48 units per robot-second with trips (design ≈ 2.4);
  - longest stall 2.1 s, about 1–3 reversals per minute (row ends), never inside a building;
  - mean distance to the nearest other working robot 14.6 m;
  - first clean 0.0–0.6 s after deploy.
- Far versus per-frame totals over 15 min: far 4910 against per-frame runs 4381–5040 (mean 4820, +1.9 %). The sim is chaotic, so single runs differ by up to 7 % either way.
- Wait behind a player who keeps stepping in front: at most 4.4 s.
- Unload at the nearer point; coins after `unloadS`; `robot:collect` ≤ 4/s.

**Verified, `node test/economy/browser.mjs` (all pass; real main.js + economy + debug, fake world, trash = the spike's trash-core, other modules stubbed; screenshots in `test/economy/shots/`, looked at):**
- `a0`–`a4`: two robots fan out from the dock in long rows (8 s), then cleaned patches grow on the plaza and the street (90 s, 180 s).
- `a5`: close-up of the coral robot with turret, LED and front bar in its trench.
- `a6`: eye level along a cleaned strip.
- `a7`: after a 10 h absence, the plaza around the robots is cleared.
- `c-portrait`: the portrait view.
- 2 robots add 3 draw calls and 1 020 triangles (measured in the same frame with the robot meshes hidden vs shown).
- Boost and away through the hook.
- Save → reload under `temizsehir.v1` (498 bytes for economy).
- The real `www/index.html` boots with economy and `__ts` working.
- No page or console errors.

**Informational, `node test/economy/integration.mjs`:** all 10 modules now exist. The robots run in the real game (`shots/e1-game-eye.png`: the robot is visible in the trash next to the shop, with the real HUD). Economy cost there is 0.03 ms per frame (perf EMA).

**Assumed / not verified:**
- Real-device fps and JS time.
- How robots read from the player's distance on a phone screen. At ~20 m they are small; the name tag is ui's job.
- Audio and haptics pairing.
- The touch flow of the boost and the shop.

## Per-frame cost (measured)
- **Node, model trash, 4 robots, one near the camera:** `economy.update` averages 0.006–0.010 ms; p99 0.03 ms.
- **Headless Chromium + SwiftShader (desktop CPU, `performance.now()` coarsened to 0.1 ms), real trash-core:** average 0.03–0.04 ms per frame with 4 robots near the camera, 0.02–0.03 ms far. Budget §9: 0.5 ms.
- **Rare spikes:** p99.9 ~0.4–1.8 ms in Node. None coincide with a BFS or re-plan. The container's own noise floor shows the same spikes (a pure arithmetic loop: max 15 ms).
- **Allocations:**
  - Explicit: none on the per-frame path (no `new`, literals or closures; reused event payloads and typed arrays).
  - V8 still boxes double arguments on calls into the trash API (`amountAt`, `removeAlongSegment`): about 1 KB per frame with 4 robots, a minor GC every ~20 s.
  - JavaScriptCore (iPhone WKWebView) NaN-boxes doubles, so this should not happen on the target. **[assumed]**

## Balance bot (`node test/economy/bot.mjs`, <1 s; `--log`, `--json f`, `--price id=v,...`)
**What it is.** The real economy core and robots on a model of the trash grid, with a modelled player.
- The player's efficiency is 0.5 / 0.7 / 0.9 (slow / average / fast). At 0.7 its rates match the TASARIM table: hands 2.6 u/s, broom width × speed × 2.4 cells/s, cart nozzle × 5 × 2.2 cells/s.
- It cleans nearest-first from where it works and walks the BFS path to the nearest active sell point at walkSpeed × 0.8 / 0.9 / 1.0, plus 4 / 2.5 / 1 s per trip.
- Shopping takes 8 / 5 / 3 s with the game paused.
- It buys what the shop flags as "Sıradaki" (the cheapest available item), or the TASARIM table order in profile `average-designorder`.

**Results with the current config.js** (times m:ss, real time):

| | target | slow | average | fast | avg, design order | avg + boost |
|---|---|---|---|---|---|---|
| first sale | 0:09 | 0:13 | 0:09 | 0:06 | 0:09 | 0:09 |
| broom | 1:54 | 1:48 | 1:16 | 0:57 | 1:16 | 1:16 |
| bag_3 | 5:00 | 5:52 | 4:16 | 3:10 | 3:37 | 4:16 |
| dropoff | 5:54 | 4:35 | 3:18 | 2:40 | 4:05 | 3:18 |
| robot_1 | 7:30 | 9:09 | 6:47 | 5:34 | 5:35 | 6:47 |
| robot_2 | 9:48 | 13:38 | 10:17 | 8:25 | 8:43 | 10:17 |
| cart | 11:48 | 17:50 | **14:19** | 11:34 | 10:43 | 12:23 |
| 50 % | 13:30 | 18:32 | 14:40 | 11:53 | 12:48 | 13:56 |
| 100 % | 17:06 (slow 21:12, fast 14:42) | 23:50 | 18:24 | 14:57 | 16:22 | 17:13 |

Other measures for the average player:
- Longest gap between purchases: 2.4 min (PSIKOLOJI: ≤ 3).
- Walking full after bag_2: 28 % (TASARIM target < 45 %).
- 90 % → 98.5 %: 35 s (target < 90 s).
- Robots clean ~30 % of all units.

**Differences found:**
1. **The shop's "next = cheapest" rule does not produce the TASARIM purchase order.** The design table buys bag_3 before dropoff, robot_1 before broom_s1, robot_2 → cart → robot_speed_1, and robot_4 as the last robot, with robot_speed_2 as the end sink. With the current prices the cheapest-first order is:
   - dropoff (600) before bag_3 (700): the second sell point comes too early, while the cleared area is still around the shop;
   - broom_s1 (900) before robot_1 (1200);
   - robot_speed_1 (1400) before robot_2 (1600);
   - robot_cap_1 (2500) before the cart (2800);
   - robot_speed_2 (3500) before robot_4 (4000), so robot_4 is never bought before 100 %.

   As a result the average cart lands at 14:19. PSIKOLOJI calls a cart after 12 min "too slow", and 100 % comes at 18:24. Players who follow the design order get the cart at 10:43 and 100 % at 16:22.
2. **The broom comes earlier than `targets.broom` (1:54):** 1:16 average. That is inside PSIKOLOJI's ~1:30 (max 2:00). The bot has no first-time hesitation, so real players will be somewhat slower; this is not a problem.
3. **Boost effect:** at the current prices the boost brings the cart 1:56 earlier and 100 % 1:11 earlier (TASARIM said 1.9 and 1.5 min).

**Recommended number changes for the designer** (shop prices only; tested with `--price robot_speed_1=2900,robot_cap_1=3200,robot_speed_2=4500,dropoff=750,broom_s1=1300`):
- `robot_speed_1` 1400 → 2900 (after the cart)
- `robot_cap_1` 2500 → 3200 (after the cart)
- `robot_speed_2` 3500 → 4500 (stays the end sink, after robot_4)
- `dropoff` 600 → 750 (after bag_3)
- `broom_s1` 900 → 1300 (after robot_1)

Result with these prices (cheapest-first order now equals the design order):

| | slow | average | fast |
|---|---|---|---|
| cart | 14:13 | **11:12** (target 11:48) | 9:04 |
| 100 % | 21:41 (target 21:12) | **16:51** (target 17:06) | 13:46 (target 14:42) |

Average robot_1 lands at 5:35, longest gap 2.1 min. With the boost the cart comes 22 s earlier and 100 % 15 s earlier: the boost becomes a small bonus, and pacing works without it, as PSIKOLOJI §5 requires. `shop.totalPrice` would become 31 290. The alternative that keeps the prices is to flag "next" by a designed order instead of by price.

## Known weak points
- Small islands of trash remain inside robot patches when a row is interrupted (by another robot or the player). They are picked up later by the block search, not immediately. The look is "busy patch", not a perfect lawn.
- All robots unload at the same sell point; they queue by index (a short wait), and the sell point end positions are offset per robot.
- Robots may clip a building corner by ~0.1 m (navigation uses 0.5 m cells, robot radius 0.33 m).
- Robots ride at 55 % of the trash surface height, so in deep trash they look half-buried at the cleaning front (`a5`, `e1`). That reads as "digging in" but is less visible from far away.
- The away rate uses the measured EMA; right after an upgrade it lags the new speed until new samples arrive.
- The bot's player is a model: no exploration, perfect routing. Trust it for relative comparisons (orders, prices, boost), less for absolute early-game seconds.

## Integration (phase 3)

Every contract issue above was decided at integration; the decisions and the defects found in the real game are in `docs/BIRLESTIRME.md`, and `docs/MIMARI.md` now matches the code. Tunables listed above now live in `www/js/config.js`.
