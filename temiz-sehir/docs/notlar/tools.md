# tools.js: notes

Owner: tools. File: `www/js/tools.js`. Contract: MIMARI.md §4.5, §4.9, §6, §9. Tests: `test/tools/run.cjs` (shares the harness and fakes in `test/player/`).

## What it does

- **API.**
  - `current()` returns `'hands' | 'broom' | 'cart'`.
  - `available()` lists hands, plus broom and cart when economy owns them.
  - `equip(id)`:
    - `'cart'` tries to get in (only within reach of the cart);
    - hands and broom are refused while you are in the cart;
    - `ui:tool {id}` calls it too.
- **Hands.** `input().action` held: one grab immediately on the press frame, then one every `CONFIG.hands.holdIntervalS`. A grab tries:
  1. the item under the crosshair (`player.aimPoint`) if it is within `stat('handsReach')`;
  2. otherwise the nearest dirty spot in the `coneDeg` cone, in 0.25 m and 10° steps, nearest first.

  It removes the item with `trash.pick(x, z, r, 'hands')`. `input:tap` casts a ray through the tap point (camera unproject, march on `trash.surfaceAt`). Reach is the hold reach plus 0.3 m; `tapCooldownS` applies.
- **Broom.**
  - While the player moves at ≥ `minMoveSpeedToSweep`, it calls `removeAlongSegment(last, current strip centre)`. The strip centre is `reachAheadM` ahead and the width is `stat('broomWidth')`. The removal is capped by `economy.bagSpace()`.
  - `player.setSpeedCap(stat('broomSweepSpeed'))` while the broom is equipped.
  - One stroke per `feedback.dustPuffEveryS` (0.3 s) gives one `tool:swing {tool, speed}` and one dust puff.
  - Holding the button while standing does short in-place strokes, one every 0.55 s across the strip ahead. This is slower than walking, on purpose.
- **Bag rule.** Before any removal: if there is no space, nothing is removed and the player gets feedback, at most once every 2 s:
  - `tool:full {tool, container}`;
  - `ui:toast {key:'bag_full' | 'tank_full'}`;
  - a haptic double buzz.

  The context button's label becomes "Çanta dolu" while full. Pointing at the sell point is world's guide arrow (`bagSpace() === 0`).
- **Cart.**
  - Spawns on `economy:purchased {id:'cart'}`, or on `game:ready` if it is already owned, at `world.point('cartPark')` or `CONFIG.cart.parkPos` / `parkYawDeg`.
  - Two meshes: a body with a merged contact-shadow skirt, and a nozzle scaled to `stat('cartNozzleWidth')`.
  - Offers:
    - `enter` (70) within `enterRadiusM` of the cart's long axis;
    - `nozzle` (80) while mounted;
    - `exit` (90) only while |speed| < 0.4 m/s (contract issue 1).
  - Getting in calls `player.mount({id:'cart', eyeHeight: CONFIG.cart.eyeHeightM, drive, object3D, view, exitSideM, teleport})`.
  - `drive()` handling: `accel`, `brake`, `turnRateDeg`, `cleanSpeedMax` (nozzle down), `topSpeed` (nozzle up), `bumpSlowdown`.
    - Yaw rate is low-passed (τ 0.12 s): no yaw snaps.
    - Collision is two circles (radius half the width) along the body, via `world.collide`.
  - Steering modes (`CONFIG.cart.controlMode`, overridable by `state.settings.cartControl`):
    - `'camera'`: the stick direction relative to the camera. The cart turns towards it, slows in sharp turns, and reverses when the target is more than 130° behind. View: chase.
    - `'tank'`: stick y is throttle and stick x is turn. The view turns with the cart, and free look springs back after 1 s. View: first-person seat.
  - The nozzle cleans while it is down (`removeAlongSegment`, width `stat('cartNozzleWidth')`) into `addToBag(…, 'tank')`. A full tank stops cleaning with feedback, and the cart still drives.
- **Juice.**
  - Flying item copies: one `InstancedMesh` for all 7 shapes. The geometry is all `trash.itemGeometry(i)` merged; a per-instance `iShape` attribute keeps one shape and collapses the rest. Colours come from the `Picked` / `TrashResult` samples.
    - Each copy flies `feedback.pickupArcS` (0.25 s): arcs into the bag (hands), into the broom head, or spirals into the nozzle intake (cart). It scales to 0 at the end.
    - Pool 40; at most 4 new copies per frame (all units are still counted).
  - Dust and gold valuable sparkle: one `Points` (pool 64) with per-particle alpha and size.
  - View model (camera child via `player.viewModel()`), procedural, vertex-coloured Lambert:
    - Hands: a reaching orange work glove with a sleeve and reflective band, and a left glove holding a bag. The bag grows with fill, squashes on pick, and is tinted per bag level.
    - Broom: the handle rises from below into a wooden head; the bristles lean against the stroke; the head sweeps an arc in rhythm with walking.
    - Equip bounce (0.22 s back-out), slight look sway.
    - In portrait the model is pulled to the centre and pushed back, because of the narrow horizontal FOV.
    - Hidden in the cart and during the finale lift.
- **Haptics.** Capacitor `Plugins.Haptics.impact` if present, else `navigator.vibrate`, else nothing. At most 15 per second. The kinds:
  - light tick: pick or collect;
  - medium: player sale (`economy:sold`), cart bump, getting in;
  - heavy: purchase;
  - pattern: full.

  `state.settings.haptics === false` turns them off.
- **Events emitted.**
  - `tool:collect {tool, units, byType, x, y, z, valuable}`: one per tool per frame, reused payload.
  - `tool:swing`, `tool:changed`, `tool:nozzle`, `tool:full` (new, see issue 2), `ui:toast`.
  - No direct `audio.play` calls (see issue 3).
- **Save.** `{v:1, current, cart:{x, z, yaw, nozzle, mounted}}`. Restored on `game:ready`, because economy loads after tools.

## Contract issues (Sözleşme sorunları)

1. **exit (90) always beats nozzle (80)**, so with one button the nozzle could never be toggled while seated. Closest reading: `exit` is offered only when the cart is (nearly) stopped. Then:
   - while driving, the button is the nozzle;
   - when stopped, the button is "İn";
   - to toggle the nozzle while stopped, roll a little.

   Better fix: ui shows a second offer with priority ≥ 50 as a small secondary button. I saw ui.js going that way; then the speed condition can stay (it is harmless).
2. **No event for "tried to collect but the bag is full".** `economy:bagFull` fires only on the transition. tools emits a new `tool:full {tool, container}`, rate-limited to one per 2 s, plus `ui:toast {key:'bag_full'}`. Proposal: add it to §6 so audio plays the dull thump on it.
3. **audio.play names are not in the contract.** tools never calls `audio.play`. Audio should drive pops, swish, nozzle and thump from `tool:*` events.
4. **Tunables missing from config.js** (they live in `TL` at the top of tools.js; `CONFIG.tools.<key>` overrides):
   - pick radii, tap reach slack, cone steps;
   - pool sizes;
   - animation times, swing-in-place timing;
   - full-feedback interval, haptic gap;
   - cart: exit speed, reverse angle and speed, steer gain, turn damping, recentre, nozzle move time, cart view.
5. **Broom speed cap when the bag is full.** TASARIM caps walking at the sweep speed whenever the broom is equipped, so the trip to the shop is also at 2 m/s (switching to hands walks at 5 m/s). Kept as written; design should decide whether to lift the cap while full.
6. **Extensions.** These go beyond the contract:
   - holding the button with the broom sweeps in place;
   - `equip('cart')` mounts;
   - `state.settings.cartControl` overrides `controlMode`;
   - the enter distance is measured to the cart's long axis, not its centre (so "Bin" works at the front and back);
   - test helpers `perfSample()` and `cartState()` are exported.
7. **`by` on `trash.pick`.** §4.3 gives `pick(x, z, r, by)`; tools passes `'hands'`.

## Verified (`node test/tools/run.cjs`: 43/43 PASS, headless Chromium + SwiftShader, real CDP touch, fakes)

- **Hands.**
  - Press: the item is collected on the frame right after the press (≤ 17 ms ≪ 100 ms), with bag +1, haptic, flying copy and dust in the same frame.
  - 2.05 s of hold gives 6 items.
  - Tap within reach picks; a second tap within 17 ms is ignored (cooldown) and accepted after it; a tap beyond reach does nothing.
- **Full bag.** Nothing is removed. One `tool:full`, the toast "Çanta dolu" and a haptic. The button reads "Çanta dolu"; after a sale it works again.
- **Broom.**
  - Buying it equips it. Speed is capped at 2 m/s.
  - The strip behind is clean, and bag growth equals the units removed.
  - `tool:swing` every 18 frames (0.3 s); `tool:collect` at most once per frame.
  - Sweeping in place is slower than walking. Switching to hands lifts the cap.
- **Cart.**
  - Parks at `parkPos` facing south. "Bin" near it, not away from it.
  - Mount gives `player:mount`; stopped shows "İn"; moving shows "Emiciyi kaldır".
  - Drives where the camera looks; the nozzle swath (18/18 cells) is clean and the tank fills.
  - Camera mode turning is ≤ 140°/s with no yaw-rate jump over 25°/s per frame.
  - Nozzle up: 8 m/s and nothing collected.
  - Wall bump: stops with the front at the wall, speed 6.0 → 3.15.
  - Tank mode: stick x turns and the view turns with the cart.
  - Tank full: "Depo dolu", and it keeps driving.
  - Exit puts you on foot beside the cart with the broom back. Save content checked.
- **Budget.** Tools add **6 draw calls and 1.5 k triangles** with everything visible at once (broom view model 2, cart 2, flying items 1, dust 1).
- **Portrait 390×844.** Picking, sweeping and driving all work.
- **Frame sequences, looked at** (`test/tools/shots/`, folders + contact sheets): `pick-landscape`, `sweep-landscape`, `drive-landscape`, `drive-chase`, `pick-portrait`, `sweep-portrait`, `drive-portrait`, `drawcalls-view.png`.

**Per-frame cost** (`perfSample`, desktop headless): `tools.update` takes 0.023–0.05 ms while picking, 0.023 ms while sweeping and 0.009 ms while driving. Budget 0.4 ms. No allocations in `update` and its callees. Event payloads, pools and scratch vectors are created in `init`. Purchase-time recolour and mesh build only happen on rare events.

## Assumed / not verified

- Real modules: tested only against fakes (trash = the spike core; economy and ui are minimal). In particular, the real economy must honour `bagSpace` / `addToBag(…, 'tank')` and `stat()` names as in §4.6.
- Haptics: no device was tested. iOS Safari has no `navigator.vibrate`, so in the browser this is a no-op. In the Capacitor app it needs `@capacitor/haptics` installed (it is used only if present).
- Real-device look of the view model and cart, real fps, and the feel of the cart steering (the A/B between camera and tank control is a playtest question).

## Known weak points

- The view model is simple box/cylinder art; it reads as gloves, a bag and a broom, but it is not polished. The bag squash is a whole-mesh scale (the left glove scales slightly with it).
- In the hands view the flying items fly to the bag anchor computed in camera space. In portrait the anchors follow the shifted view model.
- Hold-pick in the cone uses `amountAt` probes (35 at most per grab, 2.5 grabs/s): cheap, but it picks the nearest dirty cell, not the most visible item.
- Cart collision is two circles, so corners of the 1.6 × 2.4 body can overlap walls slightly when turning against them.
- The chase camera starts 1.2 m behind when the cart is parked against the district edge (the camera slides in).
