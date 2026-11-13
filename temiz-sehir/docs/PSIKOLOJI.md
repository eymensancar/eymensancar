# Temiz Şehir: psychology brief

For designer, programmers, UI, audio. Targets drawn from research (SDT, goal gradient, endowed progress, closure); unverified on this game until playtest.

## 1. Why the fantasy works

**Order from chaos** (closure; mess is an open task, Zeigarnik), **tiny to powerful** (competence, core SDT need), **manual to automated** (past effort now done by something you own). Three feelings:

- **"I made that."** Observable: player turns around and sees a long clean stripe cutting through the trash, still clean.
- **"That was slow; this is fast."** Observable: first broom stroke clears in 1 s what hand-picking took 15 s to do.
- **"It works without me."** Observable: player is busy elsewhere, glances over, robot has cleaned a patch they did not touch.

## 2. Emotional arc (target times, tolerance in brackets)

- **0:00–0:20 Overwhelm.** Trash to the horizon. Good: it sets the scale to conquer. Not confusion: one obvious first action (prompt on nearest item).
- **0:20–1:30 Hand-picking.** Bag fills in a few items; first sale within 45 s [max 60 s]. Broom affordable by **~90 s [max 120 s]**. Beyond that, contrast turns into grind.
- **~1:30 First relief.** Broom. The strip clears; a small fanfare. This is the template for every tier.
- **2–6 min Broom and bag.** One or two bag upgrades. Boredom risk starts ~3 min after the last novelty: **no tier gap longer than 3 min [hard max 4]** through the slice.
- **~6–8 min "Impossible becomes inevitable."** First robot. Place it where the player stands, it starts cleaning instantly, and the district % ticks without input. The % moves while you walk to the shop.
- **8–14 min Cart.** Speed and width jump; a minute's work now takes seconds. Second robot fine.
- **14–18 min Closure.** From ~85% remaining trash is patchy; highlight leftovers on the map (goal gradient: players speed up near the end, support it). At 100%: the **district cleaned** moment (section 3).
- Cart after 12 min = too slow.

## 3. Moment-to-moment rules

**Immediate (≤100 ms) from input:** item disappears or flies to bag, pick sound, haptic tick, counter change. Stick and look response ≤1 frame of added latency. Purchase confirm: tool in hand within 200 ms.

**Accumulate:** the coin total (counts up over 300–600 ms with ticking pitch rising), district %, the visible clean area.

**Pairing:** every cleaning event = visual (trash reacts: lifts, spins, shrinks into the tool) + sound (short, pitch varied ±10%; broom is a continuous texture rising with amount) + haptic (light tick, rate-limited to max ~15/s; heavier on sale and purchase). Bigger tier = deeper, fuller sound.

**Clean stays clean.** No respawn. Revealed ground contrasts strongly (lighter, slight wet sheen), readable from afar and on the map. The trail is the main pride object.

**Counting up vs. bars.** Bars for bounded things (bag fullness, district %). Count-up numbers for money. Bag "full" gets a clear sound.

**Round numbers.** Prices 10, 50, 250, 1000; district milestones 25/50/75/100% each get a small stinger.

**Near-goal tension.** Show the next purchase's price and a progress ring toward it on the HUD at all times. Highlight at ≥80%. Endowed progress: the first goal starts a third filled.

**The walk to the shop:** ≤10–15 s from anywhere in the slice area (shop in the centre, or a sell-point that moves with the player later). A victory lap: back along your trail, robots in view, coins rising on sale. A long walk turns the loop into chores.

**Robots are yours:** distinct colour, a Turkish name tag (e.g. "Robot 1: Pırıl"), sound and light when collecting, start in view, feed the same trail and %.

## 4. Pitfalls

- **Grind without novelty:** every tier must change *how* cleaning looks or feels (width, motion, sound), not just a number.
- **Inflation without felt power:** never upgrade only a multiplier. If a number goes up, the screen must show more trash vanishing per second.
- **Automation removes the job:** after robots, keep the player's role: directing robots to zones, bigger targets (piles, cars of trash) only the player's tool can do, driving the cart. The player must always be the fastest cleaner on screen.
- **Motion sickness (FPS on phone):** no head bob (or off by default, max 1 cm amplitude if added); no camera roll; horizontal FOV ~75–90° in landscape (vertical ~55–65°), never change FOV with speed by more than 5°; walking acceleration reaches top speed in ~0.15–0.25 s, no long ease; look sensitivity adjustable; cart turns damped, no sudden yaw snaps; steady 30+ fps matters more than peak 60 (dropped frames cause nausea). Keep a visible stable horizon.
- **Thumb fatigue:** auto-collect while moving (no tapping per item); action button only for discrete actions (sell, buy, place robot). Floating stick where the thumb lands. Standing still is fine: robots work.

## 5. Ethics (broad audience, including children)

- Rewarded "2x for 2 min" is opt-in, only via a clearly labelled button; never a popup after failure, never "you will lose X". Pacing must work without it.
- No fake timers, no countdown pressure on offers, no "limited" stock.
- Studio promos clearly labelled ("Bizim diğer oyunumuz"), only on natural pauses (shop screen, after district cleaned), always dismissible in one tap, never mid-motion or covering controls.
- No streak penalties, no guilt notifications, no return-reward that shrinks if you wait.
- Ad buttons never look like gameplay buttons.

## 6. Idle / return

Recommendation: **robots keep working while away, capped at 2 hours of robot output** and at 50% of the remaining trash, so the district is never finished while absent. Never require return at set times. On return: one honest screen, "Sen yokken robotların 1.240 parça topladı (2 saatlik sınır)" with the coins already added, then show the cleaned patches in the world. No "watch ad to double" here in the slice; if ever added, base amount first, doubling optional.

## 7. Acceptance checklist (yes/no)

1. First pick-up within 10 s with no instruction other than one prompt?
2. Broom affordable by 120 s?
3. No gap over 4 min between new tools/upgrades?
4. Every pick/sweep gives visual + sound + haptic within 100 ms?
5. Clean ground stays clean and the trail is visible from 30+ m?
6. Next purchase price and progress toward it always visible?
7. Shop reachable in ≤15 s from anywhere in the slice?
8. First robot visibly cleans within 3 s of placement, in view?
9. Player remains the fastest cleaner after robots?
10. "District cleaned" moment present, with a distinct celebration and the % at 100?
11. No head bob/roll by default, FOV stable, no motion complaints in playtest?
12. Rewarded boost opt-in only, no loss framing, no fake timers, promos labelled and non-interrupting?

**Measure in playtest:** (1) time to each tier (broom, robot, cart, 100%); (2) quit or "what now?" moments with timestamps; (3) number of times the player turns to look at their trail or robots unprompted; (4) motion discomfort self-report (0–4) after 10 min; (5) "would you play another district?" (yes/no + why) and the one moment they remember.
