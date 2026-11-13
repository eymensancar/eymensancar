# Temiz Şehir: design of the vertical slice

Owner of this file: game/systems design. Every number below is also in `www/js/config.js` (`CONFIG`, `STR`). If the two ever disagree, config.js wins and this doc gets fixed.

Status: **numbers come from a coarse economy simulation, not from playtests.** The simulation models an average player as 70 % efficient (turns, overlap, looking around). It also models trips to the nearest sell point, how far away the dirty edge is (it gets further as the cleared area grows), and robots with their own trips. No real-device or real-player data exists yet.

## 1. Core loop and tool tiers

Loop: **collect → bag fills → go to a sell point (auto-dump, coins fly) → buy the next upgrade → collect faster.** The district percentage climbs throughout and is always on screen. Ground you clean stays clean (cells keep depth 0 for ever), so you can see your trail from far away.

One input scheme for all tiers: the **left stick moves**, a **right-half drag looks**, and **one context button** (bottom right) does the tool's action. Desktop: WASD, mouse drag, E / Space. Tools work on cells in front of you. Each cell holds 1–4 units ("depth"), and every unit is one visible item.

| Tier | Input | Active cleaning rate | Carry | Why it beats the last one | The "wow" |
|---|---|---|---|---|---|
| **Hands** | Hold the button: grab 1 unit every 0.4 s from the nearest dirty cell in a 70° cone, reach 2.2 m. Or tap an item directly (cooldown 0.12 s, so fast tappers get about 6/s). | ~1.5 cells/s, 2.6 u/s | Plastic bag, 15 | — | Each item jumps into your hand with a pop and the pitch rises. First coin shower at the shop. |
| **Broom + dustpan** | Equip it, then just walk. A 1.0 m strip in front is swept and the trash flies into the bag. Move speed is capped at the sweep speed (2.0 m/s). | 4.8 cells/s, 8.4 u/s (×3.2) | Bag levels 40 / 90 / 180 | You stop stopping: movement *is* cleaning. A clean stripe is drawn behind you. | First stroke wipes out ten cells at once and leaves a clean line on the asphalt. |
| **Bigger bags** | Passive | — | 15 → 40 → 90 → 180 | Trips go from every ~6 s of sweeping to every ~25 s. Walking stops dominating. | The bag model on the HUD grows; you sweep a whole street front in one go. |
| **Robot vacuum** (×1–4) | Bought and deployed automatically from the dock by the shop. It cleans the nearest dirty cell in a lawnmower pattern. When full, it drives home and sells on its own. | 3.0 cells/s, ~5.2 u/s each (≈2.4 u/s with its trips) | 60 / 100 | Income while you do something else. Coins arrive with no trip from you. | You come back from a sale and find a clean patch you didn't make. Its "+coins" pops from across the street. |
| **Ride-on vacuum cart** | Walk up to it and press **Bin** (get in). Stick = drive, camera-relative: the cart turns towards the stick direction at 140°/s. The button lowers or raises the nozzle. Nozzle down: max 5 m/s and it cleans a 1.8 m swath. Nozzle up: 8 m/s, for selling trips. | 19.8 cells/s, 34.5 u/s (×2.6 over the best broom) | Tank 600 / 1000 | A whole street in one pass. The trip home takes seconds. | First pass down the main street: a 2 m clean carpet unrolls, the trash spirals into the intake, and the % ticks up visibly. |

## 2. Trash model

**Grid.** The district is 54 × 54 m with 0.5 m cells (108 × 108). Three 6 m streets run each way, at x/z = 0, 24 and 48 m. There are four 18 m blocks: three are buildings and the NE block is the **plaza** with the shop. That makes 7,776 trash cells (streets plus plaza minus the shop kiosk; the generator reports the exact number). Depth is an integer from 1 to 4, and the mean is normalised to **1.74**, giving **≈13,500 units** in total. Depth = zone base (street 1.6, plaza 1.8) + value noise (±0.7, 5 m scale) + 14 "piles" (+1.5, radius 1.5–3 m, at building corners). The result is rounded and clamped. Every cell starts at 1 or more, so there are **no gaps**. Neighbouring districts and rooftops are visual only: trash out to the horizon, behind barriers labelled "Yakında" (Coming soon).

**Types.** Each unit's type is rolled when it is collected: deterministic from the cell, using the zone mix below.

| Type | Value | Street | Plaza (market) | Pile |
|---|---|---|---|---|
| Paper (kâğıt) | 1 | 50 % | 30 % | 20 % |
| Plastic bottle | 2 | 28 % | 30 % | 25 % |
| Can | 3 | 14 % | 15 % | 20 % |
| Glass bottle | 4 | 5 % | 12 % | 10 % |
| Trash bag | 5 | 3 % | 13 % | 25 % |
| Valuable (wallet, watch, old coin) | 50 | 0.1 % | 0.2 % | 0.6 % |

Average ≈ **2.08 coins/unit**, so the district is worth **≈28,000 coins**. Valuables replace the rolled type, get their own sparkle and sound, and send a "+50" popup.

**Selling.** Walk into a sell zone (2.5 m radius; 3.5 m in the cart). No button. The bag empties in a 0.6 s arc of items into the bin, then the coins count up. There are two sell points:
- the **shop** on the plaza;
- the **drop-off container** (750 coins, at the SW crossroads, the far corner). It halves the average trip once the cleared area has moved away from the shop. Robots also unload at whichever point is nearer.

When the bag is full, a bag icon pulses and a ground arrow points to the nearest sell point.

**Clean.** A cell is clean at depth 0. **District % = clean cells / initial trash cells.** At 90 % the compass shows the remaining dirty clusters and robots go for them first. At **98.5 %** a "final sweep" (a gust of wind plus city crew vans) clears and pays out the stragglers, so nobody hunts the last cell. The display then reads 100 %.

## 3. Economy

**Prices** (start coins 0):

| Item | Effect | Price | Requires |
|---|---|---|---|
| Bag L1 (sack) | capacity 15→40 | 40 | – |
| Broom | unlocks broom, width 1.0 m, sweep 2.0 m/s | 300 | – |
| Bag L2 (big sack) | 40→90 | 400 | Bag L1 |
| Broom width L1 | 1.0→1.3 m | 450 | Broom |
| Bag L3 (backpack) | 90→180 | 700 | Bag L2 |
| Drop-off container | 2nd sell point | 750 | Broom |
| Robot #1 | 60 cap, clean 1.5 / move 2.5 m/s | 1,400 | Broom |
| Broom speed L1 | sweep 2.0→2.4 m/s | 1,450 | Broom width L1 |
| Robot #2 | | 1,500 | Robot #1 |
| Cart | 1.8 m nozzle, tank 600 | 2,300 | Robot #1 |
| Robot speed L1 | clean 1.8 / move 3.2 | 2,900 | Robot #1 |
| Robot #3 | | 3,000 | Robot #2 |
| Cart tank L1 | 600→1000 | 2,500 | Cart |
| Cart width L1 | 1.8→2.2 m | 3,000 | Cart |
| Robot capacity L1 | 60→100 | 3,200 | Robot #1 |
| Robot #4 | | 4,000 | Robot #3 |
| Robot speed L2 | clean 2.1 / move 4.0 (end sink) | 4,500 | Robot speed L1 |

The shop lists every unlocked item, sorted by price, with the cheapest one marked "Sıradaki" (Next). Total spend is 32,390. Prices changed at integration (dropoff 600→750, broom_s1 900→1450, robot_1 1200→1400, robot_2 1600→1500, cart 2800→2300, robot_speed_1 1400→2900, robot_cap_1 2500→3200, robot_speed_2 3500→4500) so that "cheapest first" gives the design order and the PSIKOLOJI limits hold (§3a). An average player buys everything up to Robot capacity L1 before 100 % and carries ~4,000 coins into the "next district" teaser; Robot #4 and Robot speed L2 are the end sink.

### 3a. Final timeline (integration, `node test/economy/bot.mjs`)

The balance bot runs the REAL economy rules and robot agents (`createEconomyCore` from economy.js) on a model of the trash grid, with a modelled player (efficiency 0.5 / 0.7 / 0.9). Real-time minutes; the bot has no first-time hesitation, so real first sessions will be somewhat slower early on. `node test/run-all.mjs` asserts the PSIKOLOJI limits on these numbers.

| | slow | **average** | fast | PSIKOLOJI limit |
|---|---|---|---|---|
| first sale | 0:13 | **0:09** | 0:06 | ≤ 0:45 (max 1:00) |
| broom | 1:48 | **1:16** | 0:57 | ~1:30, max 2:00 |
| bag L3 | 4:59 | **3:37** | 2:40 | |
| drop-off | 6:12 | **4:31** | 3:21 | |
| robot #1 | 8:18 | **6:06** | 4:37 | 6–8 min |
| robot #2 | 12:27 | **9:37** | 7:28 | |
| cart | 14:18 | **11:28** | 8:58 | ≤ 12 min |
| 50 % | 16:50 | **13:10** | 10:28 | |
| 75 % | 19:43 | **15:16** | 12:10 | |
| 100 % | 21:56 | **16:55** | 13:37 | 14–18 min |
| longest gap without a purchase | 2.6 min | **2.0 min** | 1.7 min | ≤ 3 (hard 4) |

Average purchase order (= the shop's "next"): bag_1 0:20 → broom 1:16 → bag_2 1:58 → broom_w1 2:37 → bag_3 3:37 → dropoff 4:31 → robot_1 6:06 → broom_s1 8:09 → robot_2 9:37 → cart 11:28 → cart_tank_1 12:36 → robot_speed_1 13:34 → robot_3 14:16 → cart_width_1 15:07 → robot_cap_1 15:42 → 100 % 16:55. Other measures (average): walking full after bag L2 27 % of the time (target < 45 %), 90 % → 98.5 % in 35 s (target < 90 s), robots clean ~24 % of all units. With the mock boost (watched at 9:45) the cart comes 21 s earlier and 100 % 7 s earlier: the boost is a small bonus and the pacing works without it (PSIKOLOJI §5). The slow player's cart (14:18) is past 12 min; that is the one limit only the average player meets.

**Away (PSIKOLOJI §6) — open design question.** With the brief's cap (2 h of robot output, at most 50 % of what is left) one robot alone collects ~5,800 units (+12,000 coins) in a 2.5 h absence: a player who comes back after lunch skips from robot #1 to "cart affordable, district half clean". It is honest and capped as specified, but in a 17-minute slice it removes most of the middle. Options for design: cap by robot count × a shorter time (e.g. 20 min), or by a fraction of the slice's income curve. Not changed at integration.

The stage table below is the original pre-integration simulation (old prices), kept for the design rationale.

**Stage table (average player, simulated).** "Rate" is the player's active cleaning rate. Income includes trips and robots.

| From min | State after purchase | Cells/s (player) | u/s raw | Income c/min | Next buy (price) | Time to it |
|---|---|---|---|---|---|---|
| 0:00 | Hands, bag 15 | 1.5 | 2.6 | 140 | Bag L1 (40) | 0.3 min |
| 0:17 | Hands, bag 40 | 1.5 | 2.6 | 180 | Broom (300) | 1.7 |
| 1:56 | Broom, bag 40 | 4.8 | 8.4 | 380 | Bag L2 (400) | 1.0 |
| 2:59 | Broom, bag 90 | 4.8 | 8.4 | 500 | Broom width (450) | 0.9 |
| 3:52 | Broom 1.3 m | 6.2 | 10.9 | 580 | Bag L3 (700) | 1.2 |
| 5:03 | Bag 180 | 6.2 | 10.9 | 710 | Drop-off (600) | 0.8 |
| 5:53 | 2nd sell point | 6.2 | 10.9 | 740 | Robot #1 (1200) | 1.6 |
| 7:30 | 1 robot | 6.2 | 10.9 | 1,030 | Broom speed (900) | 0.9 |
| 8:22 | Broom 2.4 m/s | 7.5 | 13.0 | 1,120 | Robot #2 (1600) | 1.4 |
| 9:47 | 2 robots | 7.5 | 13.0 | 1,370 | Cart (2800) | 2.0 |
| 11:49 | Cart | 19.8 | 34.5 | 3,000 | Robot speed (1400) | 0.5 |
| 12:17 | Robots faster | 19.8 | 34.5 | 3,070 | Robot #3 (3000) | 1.0 |
| 13:15 | 3 robots | 19.8 | 34.5 | 3,350 | Tank L1 (2500) | 0.7 |
| 13:59 | Tank 1000 | 19.8 | 34.5 | 3,530 | Cart width (3000) | 0.9 |
| 14:50 | Nozzle 2.2 m | 24.2 | 42.1 | 3,990 | Robot cap (2500) | 0.6 |
| 15:28 | Robot cap 100 | 24.2 | 42.1 | 4,230 | Robot #4 (4000) | 0.9 |
| 16:25 | 4 robots | 24.2 | 42.1 | 4,590 | (Robot speed L2) | — |
| ~17:05 | 98.5 % → final sweep → **100 %** | | | | | |

District % at key moments: 1 % at the broom, 7 % at bag L3, 13 % at the first robot, 32 % at the cart, then 50 % at about 13:30 and 75 % at about 15:30. The first 12 minutes "barely dent" the district, and then it melts. That is the intended feeling.

Sensitivity: a 50 %-efficient player gets the broom at 2:32, robot #1 at 9:37, the cart at 14:43 and 100 % at 21:12. A 90 %-efficient player gets the broom at 1:36, robot #1 at 6:19, the cart at 10:08 and 100 % at 14:44. The slowest stretch is 9:47–11:49, saving up for the cart. It is acceptable because the robots are visibly working, and it is the natural place for the boost.

**Tuning rule.** Each purchase should land when the current tool's trip-to-cleaning ratio passes about 50 %, which is where "this feels slow" begins. Bags fix trips, tools fix rate, robots add parallel income, and the cart fixes both.

**Milestone bonuses:** 25 % → +100, 50 % → +250, 75 % → +500 coins. They are small (about 3 % of total) and move the finish ~10 s earlier.

**Mock rewarded ad (boost).** It doubles every sale, robots included, for 120 s, with a 300 s cooldown. It never pops up on its own. It is offered in only two places:
1. a small button in the shop panel, shown once the player has 3 or more purchases *and* the next item is 60 s or more away;
2. once, on the 50 % milestone card.

Used at 8–10 min, it brings the cart forward 1.9 min and the finish 1.5 min.

**Promo slot (later).** A billboard on the SE building facing the plaza (Yıkım Ustası and Sayı Yolu art, tap to see more), plus two cards on the "District cleaned" screen. The slice ships both slots with placeholder art and no links.

## 4. Feedback and juice (must-haves)

- **Every pickup:** the item hops along a curve into the hand or intake in 0.25 s and scales to 0. A short synth "pop" whose pitch rises a semitone for each pickup within 0.6 s (capped at +12), so chains sing. The bag fill bar ticks. "+N" coins-to-be are batched every 0.25 s. The cell's ground texture lightens as depth drops and turns bright clean at 0.
- **Every sweep stroke:** the bristles lean in the movement direction, a dust puff each 0.3 s, a soft swish loop whose volume follows speed, and nearby items wobble before they are taken.
- **Bag full:** a dull thump, the bag icon pulses red, the arrow to the nearest sell point appears, and the tool stops (it never silently wastes effort).
- **Every sale:** the items arc into the bin, the coins fly to the HUD counter, which rolls up with a ticking sound. Bigger loads get a bigger shower. A valuable gets a gold flash.
- **Every purchase:** a cash-register chord, the new tool appears in your hands with a little bounce, a one-word toast ("Süpürge!"), and the shop highlights the next item.
- **Robot working:** a quiet hum (positional), a blinking LED, small items sucked in, a "+coins" from where it unloads, and a robot icon on the compass. A full robot shows an amber LED on its way home.
- **Milestones 25 / 50 / 75 %:** a confetti burst at the plaza, a fanfare stinger, the % ring fills, and the city reacts: birds return at 25 %, streetlights come on at 50 %, pedestrians appear at 75 %.
- **100 %:** the final-sweep gust, a camera lift to a bird's-eye view of the spotless district against the buried neighbouring districts, the "Mahalle tertemiz!" (District spotless!) card with stats (time, items, coins), the promo cards, and "Sıradaki mahalle: yakında" (Next district: coming soon).

## 5. First 60 seconds (no text walls)

- **0:00.** Camera at eye height in the plaza, trash to the horizon. The shop kiosk is 4 m behind you, its sign glowing.
- A large pulsing hand icon sits on the action button, with the one-word hint "Topla" (Pick up). Holding it makes items pop into your hand. Tapping an item also works.
- **0:06.** The bag is full. It thumps, and a ground arrow plus a "Sat" (Sell) bubble over the shop appear. You walk in, the items arc into the bin, and the coins fly. Hint: "Dükkan" (Shop) with a coin icon.
- **0:15.** Second fill. The shop now shows the bag upgrade (40) glowing because you can afford it. Buy it.
- **0:30–0:60.** Free picking. The broom is visible in the shop with a progress ring (coins/300) on the HUD, so the goal is obvious. A 1-line toast at 0:45 if the player has not moved: "Yürü ve topla" (Walk and pick up).
- At most 4 hints are shown before the broom. Each one appears once and goes away on the action it asks for.

## 6. Full-game outline (8–12 h main path)

**Districts (8 + finale)**, each 2–4× the area of the last, each with a twist:
1. Mahalle (slice, ~17 min).
2. Pazar yeri (market): trash respawns at stalls each in-game morning, which teaches automation upkeep.
3. Sahil (beach): sand hides items, so sweep and then sift. Wind blows paper back.
4. Sanayi (industrial): heavy scrap that only vehicles lift, oil slicks that need washing.
5. Park & göl (park and lake): floating trash that needs a boat and drones.
6. Çarşı (old town): narrow alleys and stairs where carts don't fit, so robots and drones matter.
7. Liman (port): containers, cranes and conveyor lines.
8. Merkez (downtown): towers, roofs and multi-level streets.
9. Finale: the whole city skyline turns clean.

**Tool ladder.** Hands → broom → bags → robot vacuums → cart → **street sweeper truck** (4 m) → **robot fleet with zones** (paint areas on the map) → **drones** (pick from roofs and water) → **conveyor lines** to a **recycling plant** (no more trips; sorting multiplies value) → **sweeper convoy autopilot** → **city-scale automation** (districts clean themselves; you spend on expanding the plant).

**Economy across districts.** Each district has its own trash value tier (×3 to ×5), and old districts keep producing a trickle of income from respawning trash. That gives an idle return without timers. **No prestige** on the main path: clean stays clean, which is the fantasy. An optional post-game "Yeni şehir+" (New city+) with modifiers is the only reset.

**Pacing curve.** The slice is 0.3 h, then roughly 0.5, 0.7, 0.9, 1.0, 1.2, 1.3, 1.5 and 1.6 h per district. That is about 9 h main path; idle return on old districts can add 1–3 h. Every district repeats the shape "dent it → automate → melt", with a new tool arriving at about 40 % of each district.

**Hour 1 vs hour 5.** In hour 1 you are the machine: you steer, sweep and run trips. By hour 5 you are a **planner**. You draw robot zones, route conveyors, choose which district to upgrade, and drive the truck only for the satisfying big passes. The look changes too: in hour 1 you see a street at eye level. In hour 5 you see a skyline where half the city is clean and visible from the drone camera.

## 7. Risks and what the prototype must measure

| Risk / assumption | Measure in the slice |
|---|---|
| **Hand-picking is fun for about 60 s but no longer.** If the broom comes later than 2–2.5 min for most players, early churn rises. | Time to broom; quit or idle events before the broom; taps vs. hold usage. |
| **Walking trips feel like a chore** before the drop-off and bigger bags. | Share of time spent walking full vs. cleaning (target under 45 % after bag L2); time to first drop-off. |
| **Cart control on touch.** Camera-relative steering may fight the look drag. | Wall bumps per minute, nozzle toggles, A/B against "tank" control (`cart.controlMode`). |
| **Robots feel weak** (each ~2.4 u/s effective, about 25 % of late income). | Do players look at or follow robots? Do they buy robot #2 before the cart? |
| **Rendering 13.5k items plus horizon trash at 60 fps** on an iPhone 12. | Draw calls and triangles in headless runs. Real fps unverified until tested on a device. |
| **The final 10 % drags.** | Time from 90 % to 98.5 % (target under 90 s). |
| **The economy depends on the 70 % efficiency assumption.** | Real timestamps of each purchase vs. the stage table; tune `CONFIG.shop` prices only. |

Timeline targets for automated checks are in `CONFIG.targets`.
