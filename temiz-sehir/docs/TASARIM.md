# Temiz Şehir: design of the vertical slice

Owner of this file: game/systems design. Every number below is also in `www/js/config.js` (`CONFIG`, `STR`). If the two ever disagree, config.js wins and this doc gets fixed.

Status: **numbers come from a coarse economy simulation, not from playtests.** The simulation models an average player as 70 % efficient (turns, overlap, looking around). It also models trips to the nearest sell point, how far away the dirty edge is (it gets further as the cleared area grows), and robots with their own trips. No real-device or real-player data exists yet.

## 1. Core loop and tool tiers

**v2 (after the owner played v1 on his iPhone 14 Pro):** the slice is now **35–40 minutes** on a **90 × 90 m** district (was 17 min on 54 m), the player starts with a **small hand brush and dustpan** (hand-picking was removed: "the hand turned out silly"), walks at **7.5 m/s** (was 5.0) and sees the world through a **104° horizontal FOV** (was 85°). The reasons and the before/after are in `docs/BIRLESTIRME.md` § v2.

Loop: **sweep → bag fills → go to a sell point (auto-dump, coins fly) → buy the next upgrade → sweep faster.** The district percentage climbs throughout and is always on screen. Ground you clean stays clean.

One input scheme for all tiers: the **left stick moves**, a **right-half drag looks**, **one context button** (bottom right). Desktop: WASD, mouse drag, E / Space. Each cell holds 1–4 units ("depth"), and every unit is one visible item.

**Walking vs sweeping.** Walking is brisk (7.5 m/s, shoes 8.5 / 9.5). A sweeping tool slows you to its sweep speed **only while it is actually sweeping**: trash on the strip ahead *and* room in the bag. Walking over your clean trail, or to the shop with a full bag, is at full walking speed (v1 capped walking at the broom speed even with a full bag: trips became 12–20 s chores, psychology review A).

| Tier | Input | Sweep speed cap | Width | Rough cells/s (avg player) | Carry |
|---|---|---|---|---|---|
| **Hand brush + dustpan** (start) | Walk: a narrow strip in front is swept automatically. Standing: hold the button for quick short flicks (one per 0.22 s) across the strip, reaching the nearest dirty cell within 1.3 m when the strip is clean (a held button never does nothing). | 1.8 → 2.2 m/s (Geniş fırça) | 0.55 → 0.7 m | 2.4 → 3.7 | 20 (Poşet) |
| **Broom** | Walk to sweep a wide strip, long strokes; hold standing for in-place strokes. | 2.7 → 3.2 → 3.7 m/s | 1.0 → 1.3 → 1.6 m | 6.5 → 8.4 → … | bags 45 / 90 / 150 / 220 |
| **Shoes** | Passive | walking 7.5 → 8.5 → 9.5 m/s | – | – | – |
| **Robot vacuum** (×1–4) | Bought at the shop, it appears **3.5 m in front of the player** with a large name tag for 4 s and starts cleaning there (psychology review B). Lawnmower rows, sells by itself. | clean 1.3 → 1.6 → 1.9 m/s, travel 3.6 → 4.6 → 5.6 m/s | 0.5 m | 2.6 each (≈1.6 with trips) | 60 / 100 / 150 |
| **Ride-on vacuum cart** | "Bin", stick = drive (camera-relative), button = nozzle up/down. | nozzle down 5.5 → 6.5 m/s (Güçlü emme), up **12 m/s** (the fastest thing) | 1.8 → 2.2 → 2.6 m | 22–37 | tank 500 / 800 / 1200 |

The player stays the fastest cleaner: robots clean 0.65 m²/s each while the broom does 2.7–5.9 m²/s and the cart 10–17 m²/s. Over the robot-to-cart stretch the bot measures robots at 39 % of the units per minute (worst minute 47 %); v1 was 34–52 %.

## 2. Trash model

**Grid (v2).** The district is **90 × 90 m** with 0.5 m cells (**180 × 180**). Four 6 m streets run each way, at x/z = 0, 28, 56 and 84 m, around **3 × 3 blocks of 22 m**: eight are buildings, the **centre block is the plaza** with the shop kiosk on its south edge (counter facing the street). That makes **16,864 trash cells** (14,976 street + 1,936 plaza − 48 kiosk). Depth is an integer from 1 to 4 with the mean normalised to **1.85** (v1 1.74), giving **31,198 units** (v1 13,446: ×2.3). Depth = zone base (street 1.6, plaza 1.8) + value noise (±0.7, 5 m scale) + 30 piles (+1.5, radius 1.5–3 m, at building corners). Every cell starts at 1 or more: no gaps. Neighbouring districts (2 rings, period 90 m) and rooftops are visual only.

**Start view.** The player starts on the street just south of the plaza, **looking east down the street to the horizon** (trash all the way, buried neighbour districts behind the barrier), the kiosk 4.5 m away on the left. v1 started facing a wall and the promo billboard (psychology review); the billboard now hangs on the east block, facing the north street.

**Types.** Unchanged (paper 1, plastic 2, can 3, glass 4, bag 5, valuable 50 with its sparkle; zone mixes as before). Average ≈ 2.08 coins/unit, the district is worth ≈ 65,000 coins. Rare valuables are swept up by every tool and keep their gold sparkle and chime.

**Selling.** Walk into a sell zone (2.5 m; 3.5 m in the cart). Two sell points: the **shop** (centre plaza, so it is ≤ ~11 s away from anywhere at walking speed) and the **drop-off container** at the SW crossroads (3, 87). The bot measures a one-way sell trip on foot of **7.0 s mean, 9.4 s p90** for the average player (target ≤ ~8 s typical; slow 9.1 s, fast 5.2 s).

When the bag is full a bag icon pulses and a marker points to the nearest sell point: an **in-view pin** when it is on screen, otherwise an **edge arrow** on the left or right edge (dashed "turn round" ring when it is behind you). v1 showed the same pin in front and behind (QA #1); following the v2 marker always reaches the shop (`test/e2e/play.mjs`).

**Clean.** A cell is clean at depth 0. District % = clean cells / initial trash cells. Stragglers on the compass from 90 %, final sweep at 98.5 % (unchanged).

## 3. Economy

**The v2 ladder** (prices in coins; "requires" in brackets; the shop flags the cheapest unlocked item "Sıradaki"). Bought in this order by every bot profile:

| # | Item | Effect | Price |
|---|---|---|---|
| 1 | Çuval (bag_1) | bag 20 → 45 | 600 |
| 2 | Geniş fırça (brush_w1) | brush 0.55 → 0.7 m, 1.8 → 2.2 m/s | 750 |
| 3 | Süpürge (broom) | the broom: 1.0 m strip, 2.7 m/s | 850 |
| 4 | Büyük çuval (bag_2) [bag_1] | bag 90 | 900 |
| 5 | Geniş süpürge (broom_w1) [broom] | 1.3 m | 1,000 |
| 6 | Robot süpürge (robot_1) [broom] | first robot, in view | 1,100 |
| 7 | Spor ayakkabı (shoes_1) | walking 8.5 m/s | 1,800 |
| 8 | Sırt çantası (bag_3) [bag_2] | bag 150 | 2,000 |
| 9 | Yakın konteyner (dropoff) [broom] | 2nd sell point | 2,200 |
| 10 | 2. robot (robot_2) [robot_1] | | 2,400 |
| 11 | Sert kıl (broom_s1) [broom_w1] | sweep 3.2 m/s | 2,700 |
| 12 | Süpürge arabası (cart) [robot_1] | the cart | 3,000 |
| 13 | Büyük depo (cart_tank_1) [cart] | tank 800 | 3,300 |
| 14 | Hızlı robotlar (robot_speed_1) | clean 1.6 / travel 4.6 m/s | 6,750 |
| 15 | Geniş emici (cart_width_1) | nozzle 2.2 m | 8,000 |
| 16 | 3. robot (robot_3) | | 8,750 |
| 17 | Büyük hazne (robot_cap_1) | robots carry 100 | 9,500 |
| 18 | Güçlü emme (cart_suction_1) | nozzle-down speed 6.5 m/s | 10,500 |
| sink | Dev çuval 11,500 · Dev süpürge 12,000 · 4. robot 13,000 · Koşu ayakkabısı 14,000 · Dev depo 15,000 · Turbo robotlar 16,000 · Dev emici 17,000 · Dev hazne 18,000 · Çelik kıl 19,000 | after 100 % or for fast players | |

Prices were fitted with the balance bot item by item (each price set so the average player buys it at its target minute, prices never decreasing along the order), then rounded. The early prices rise slowly on purpose: in the brush and broom era income is limited by the sell trips, so each upgrade raises income only 20–50 %; after the cart income jumps ×3 and so do the prices.

### 3a. Final timeline (v2, `node test/economy/bot.mjs`)

The balance bot runs the REAL economy rules and robot agents (`createEconomyCore`) on a model of the trash grid, with a modelled player (efficiency 0.5 / 0.7 / 0.9; walk factor 0.8 / 0.9 / 1.0; trip overhead 4 / 2.5 / 1 s). v2 bot: sell trips and repositioning run at the **walking speed** (shoes level), sweeping at the tool's width × cap; the bot has no first-time hesitation, so real first sessions will be somewhat slower early on. `node test/run-all.mjs` asserts the limits below. Real minutes.

| | slow | **average** | fast | owner's target |
|---|---|---|---|---|
| first sale | 0:06 | **0:04** | 0:03 | |
| first upgrade (Çuval) | 2:31 | **1:48** | 1:19 | ~1:30–2:00 |
| Geniş fırça | 5:15 | **3:46** | 2:47 | |
| broom | 8:58 | **6:34** | 4:56 | |
| Büyük çuval | 12:20 | **9:13** | 7:02 | |
| Geniş süpürge | 15:29 | **11:41** | 9:00 | |
| robot #1 | 17:50 | **13:32** | 10:29 | 12–15 min |
| shoes | 20:08 | **15:42** | 12:14 | |
| bag L3 | 23:01 | **18:03** | 14:27 | |
| drop-off | 26:04 | **20:24** | 16:23 | |
| robot #2 | 28:54 | **22:30** | 18:26 | |
| Sert kıl | 31:09 | **24:17** | 20:17 | |
| **cart** | 34:27 | **26:54** | 22:20 | 24–28 min |
| 50 % | 39:05 | **30:30** | 25:04 | |
| 75 % | 44:09 | **34:38** | 28:10 | |
| **100 %** | **49:04** | **38:14** | **31:23** | 35–40 (slow ≤ 50, fast ≥ 27) |
| longest gap without a purchase | 3.7 min | **2.8 min** | 2.2 min | 2–4, never > ~5 |
| sell trip on foot, one way (mean / p90) | 9.1 / 12.0 s | **7.0 / 9.4 s** | 5.2 / 7.4 s | ≤ ~8 s typical |
| robots' share of units, robot #1 → cart | 42 % | **39 %** | 34 % | player stays ahead |

After the cart the average player also buys Büyük depo 28:10, Hızlı robotlar 29:50, Geniş emici 31:58, 3. robot 33:57 and Büyük hazne 36:14, so something new still arrives every ~2 minutes while the district melts (60 % clean at 32 min, 86 % at 36). Rhythm: one novelty every 1.6–2.8 min for the average player; the tiers last brush 6.5 min, broom 20 min (with five upgrades inside it), cart 11 min. With the mock boost (offered in the shop from 8 min) the cart comes 84 s earlier and 100 % 50 s earlier: a bonus, not a requirement. The district takes 79 s from 90 % to 98.5 % (target < 90 s).

**Away / offline (v2, decided).** Robots keep working while the player is away, but a return never skips more than a small part of the slice: the credit is the robot output of **min(away time, 10 minutes)**, capped at **15 % of what is left**, **10 % of the district** and, in coins, **the price of the next item** — you come back to "you can buy the next thing", a pull, not a skip. The welcome card names the limit that applied ("sınır: sıradaki alımın" / "küçük bir parça" / "10 dakikalık sınır"). Milestones crossed while away are named on the card, then only the latest one shows, quietly (no confetti). The boost and its cooldown run out in real time while away. `CONFIG.offline { capS: 600, maxFractionOfRemaining: 0.15, maxFractionOfDistrict: 0.10, maxNextItemPrice: true }`. (v1: 2 h / 50 %, which handed back the middle of the slice.)

**Milestone bonuses:** 25 % → +100, 50 % → +250, 75 % → +500 coins. The banners are pure celebration now: 3 s, no ad (psychology review D).

**Mock rewarded ad (boost).** Doubles every sale for 120 s, 300 s cooldown, never pops up. **Only in the shop panel**, with an equally large "Hayır, teşekkürler" next to it; while it runs the box says "Şu an aktif" (no seconds countdown in the shop: it read as urgency). The HUD chip still shows the real remaining time of an active boost.

## 4. Feedback and juice (must-haves)

- **Every pickup:** the item hops along a curve into the dustpan, the bag at the hip or the intake in 0.25 s and scales to 0. A short synth "pop" whose pitch rises a semitone for each pickup within 0.6 s (capped at +12), so chains sing. The bag fill bar ticks. "+N" coins-to-be are batched every 0.25 s. The cell's ground texture lightens as depth drops and turns bright clean at 0.
- **Every sweep stroke:** hand brush: a quick short flick (fast down-forward, slower lift; the dustpan tips to meet it) with a light, bright bristle "flick" sound and lighter pickup ticks; broom: long strokes, the bristles lean in the movement direction, a dust puff each 0.3 s, a soft swish loop whose volume follows speed, and nearby items wobble before they are taken.
- **Bag full:** a dull thump, the bag icon pulses red, the arrow to the nearest sell point appears, and the tool stops (it never silently wastes effort).
- **Every sale:** the items arc into the bin, the coins fly to the HUD counter, which rolls up with a ticking sound. Bigger loads get a bigger shower. A valuable gets a gold flash.
- **Every purchase:** a cash-register chord, the new tool appears in your hands with a little bounce, a one-word toast ("Süpürge!"), and the shop highlights the next item.
- **Robot working:** a quiet hum (positional), a blinking LED, small items sucked in, a "+coins" from where it unloads, and a robot icon on the compass. A full robot shows an amber LED on its way home.
- **Milestones 25 / 50 / 75 %:** a confetti burst at the plaza, a fanfare stinger, the % ring fills, and the city reacts: birds return at 25 %, streetlights come on at 50 %, pedestrians appear at 75 %.
- **100 %:** the final-sweep gust, a camera lift to a bird's-eye view of the spotless district against the buried neighbouring districts, the "Mahalle tertemiz!" (District spotless!) card with stats (time, items, coins), the promo cards, and "Sıradaki mahalle: yakında" (Next district: coming soon).

## 5. First 60 seconds (no text walls)

- **0:00.** Eye height on the street south of the plaza, looking east down the street: trash to the horizon. The kiosk is just to the left. Hand brush and dustpan at the bottom of the view.
- One hint, over the stick with the ghost thumb: **"Basılı tut ve yürü"** (Hold and walk). Walking sweeps by itself; holding the button standing still flicks. There is no "tap to pick" pointer any more.
- **~0:05.** The bag (20) is full. Thump, the sell marker points to the shop (edge arrow if it is behind you), "Dükkana götür". Walk in, items arc into the bin, coins fly. Hint: "Dükkan".
- **~1:48.** The first upgrade (Çuval, 600) glows: buy it. The goal chip shows the next price with its bar all the time.
- At most 4 hints before the broom; each appears once and goes away on the action it asks for.

## 6. Full-game outline (8–12 h main path)

**Districts (8 + finale)**, each 2–4× the area of the last, each with a twist:
1. Mahalle (slice, ~38 min in v2; 17 min in v1).
2. Pazar yeri (market): trash respawns at stalls each in-game morning, which teaches automation upkeep.
3. Sahil (beach): sand hides items, so sweep and then sift. Wind blows paper back.
4. Sanayi (industrial): heavy scrap that only vehicles lift, oil slicks that need washing.
5. Park & göl (park and lake): floating trash that needs a boat and drones.
6. Çarşı (old town): narrow alleys and stairs where carts don't fit, so robots and drones matter.
7. Liman (port): containers, cranes and conveyor lines.
8. Merkez (downtown): towers, roofs and multi-level streets.
9. Finale: the whole city skyline turns clean.

**Tool ladder.** Hand brush → broom → bags → robot vacuums → cart → **street sweeper truck** (4 m) → **robot fleet with zones** (paint areas on the map) → **drones** (pick from roofs and water) → **conveyor lines** to a **recycling plant** (no more trips; sorting multiplies value) → **sweeper convoy autopilot** → **city-scale automation** (districts clean themselves; you spend on expanding the plant).

**Economy across districts.** Each district has its own trash value tier (×3 to ×5), and old districts keep producing a trickle of income from respawning trash. That gives an idle return without timers. **No prestige** on the main path: clean stays clean, which is the fantasy. An optional post-game "Yeni şehir+" (New city+) with modifiers is the only reset.

**Pacing curve.** The slice is 0.3 h, then roughly 0.5, 0.7, 0.9, 1.0, 1.2, 1.3, 1.5 and 1.6 h per district. That is about 9 h main path; idle return on old districts can add 1–3 h. Every district repeats the shape "dent it → automate → melt", with a new tool arriving at about 40 % of each district.

**Hour 1 vs hour 5.** In hour 1 you are the machine: you steer, sweep and run trips. By hour 5 you are a **planner**. You draw robot zones, route conveyors, choose which district to upgrade, and drive the truck only for the satisfying big passes. The look changes too: in hour 1 you see a street at eye level. In hour 5 you see a skyline where half the city is clean and visible from the drone camera.

## 7. Risks and what the prototype must measure

| Risk / assumption | Measure in the slice |
|---|---|
| **The hand brush must feel like a tool, not a chore** (v2: hand-picking removed after the owner's playtest). If the first upgrade comes later than ~2 min or the brush era (~6.5 min) drags, early churn rises. | Time to the first upgrade and to the broom; quit or idle events before the broom; walk vs. hold usage. |
| **Walking trips feel like a chore** before the drop-off and bigger bags. | Share of time spent walking full vs. cleaning (target under 45 % after bag L2); time to first drop-off. |
| **Cart control on touch.** Camera-relative steering may fight the look drag. | Wall bumps per minute, nozzle toggles, A/B against "tank" control (`cart.controlMode`). |
| **Robots feel weak** (each ~2.4 u/s effective, about 25 % of late income). | Do players look at or follow robots? Do they buy robot #2 before the cart? |
| **Rendering 13.5k items plus horizon trash at 60 fps** on an iPhone 12. | Draw calls and triangles in headless runs. Real fps unverified until tested on a device. |
| **The final 10 % drags.** | Time from 90 % to 98.5 % (target under 90 s). |
| **The economy depends on the 70 % efficiency assumption.** | Real timestamps of each purchase vs. the stage table; tune `CONFIG.shop` prices only. |

Timeline targets for automated checks are in `CONFIG.targets`.
