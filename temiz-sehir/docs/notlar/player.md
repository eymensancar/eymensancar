# player.js: notes

Owner: player. File: `www/js/player.js`. Contract: MIMARI.md §4.4, §6, §7. Tests: `test/player/` (README in this file, "Tests").

## What it does

- **Input.** Pointer events on the canvas only. A touch that starts on a UI element never reaches the canvas, so it is ignored by construction. Each pointer gets a role when it lands:
  - `stick`: touch or pen in the left half;
  - `look`: right half, or a mouse anywhere;
  - `none`: a second finger on a half that is already busy, or a third finger.
  Roles keep their pointer until up or cancel, wherever the finger goes. Moves are read on `window` with pointer capture, so a finger sliding over the HUD keeps working.
  - Six pointer slots, fixed. No allocation in the handlers.
  - Release paths: `pointercancel`, `lostpointercapture`, window `blur`, `visibilitychange` hidden, `app:pause`, `ui:panel {open:true}`, an orientation flip (`resize` with `portrait` changed) and the start of the finale lift.
  - The canvas also prevents `touchstart`, `contextmenu` and iOS `gesturestart`.
- **Floating stick.** The base appears where the thumb lands. It is clamped 44 px from the edges and the safe area. Radius 56 px, dead zone 12 %, full deflection from 92 %. The base follows a thumb that goes past the rim. `input().stick` = `{active, cx, cy, x, y}` in CSS px, for ui to draw.
- **Look.** Raw pixel deltas are applied in the same frame (no smoothing, no added latency).
  - Touch: `CONFIG.player.lookSensitivityTouchDegPerPx` (0.25). Mouse: `lookSensitivityMouseDegPerPx` (0.15).
  - Both are multiplied by `state.settings.sens`. `settings.invertY` is respected.
  - Pitch is clamped by `pitchLimitDeg`. Drag right turns right, drag up looks up.
- **Tap.** A tap on the right half (< 220 ms and < 12 px), or a short mouse click anywhere, emits `input:tap {x, y}` (reused payload).
- **Action.** `input:button {id:'action', down}` drives `input().action`. A press that starts and ends between two frames is latched, so it is visible for exactly one frame (a quick tap on the button still picks). E and Space are handled here only when ui.js is a stub; otherwise ui owns them.
- **Keyboard.** WASD and the arrows move; the stick and the keys are merged (the larger one wins). Keys in inputs and textareas are ignored.
- **Walking.**
  - The velocity approaches its target linearly: full speed in `accelS` = 0.18 s (measured 0.183 s), standstill in `decelS` = 0.12 s.
  - Analog speed follows the stick deflection.
  - `setSpeedCap(m)` caps the speed (the broom sets it).
  - Collision is `world.collide(x, z, CONFIG.player.radiusM, out)` every frame. After a hit the velocity is reset to the real displacement, so the player slides along walls without building up speed into them.
  - `player:step {speed}` is emitted every 0.8 m.
- **Eye.** `eyeHeightM` plus 0.5 × `trash.surfaceAt` under the feet, low-passed (τ 0.15 s).
  - Head bob is off. It exists only as `headBobM`, hard-capped at 1 cm, and needs `settings.headBob`.
  - Roll is always 0. Player never writes the FOV.
- **Vehicles.** `mount(desc)` and `dismount()` emit `player:mount` and `player:dismount {vehicle: id}`.
  - While mounted, `update` calls `desc.drive(dt, input, pose)` and derives `vx`, `vz` and `speed` from the displacement.
  - The camera blends to the new spot over 0.4 s (smootherstep) on mount and on dismount.
  - Camera modes come from `desc.view`:
    - `'first'`: seat 0.25 m behind the centre at `desc.eyeHeight`;
    - `'chase'`: 3.6 m behind the vehicle along the view direction, 0.75 m above the eye height, 13° extra look-down. It slides in, down to 1.2 m, when `world.segmentClear` says a wall is in the way: fast in, slow out.
  - Dismount looks for a free spot (`world.isBlocked`) to the left of the seat, then right, behind, in front, then further out.
  - A bump (the return value of `drive`) gives a vertical-only jolt of 3 cm that lasts `CONFIG.feedback.cartShakeOnBump` (0.15 s).
- **Finale lift.** On `district:cleaned` the camera lifts away from the player while the game keeps running. The movement is: rise first (vertical over 55 % of 4 s), then travel over the rooftops, ending 70 m up, 22 m from the district centre, pitch about −72°.
  - Movement and look input are ignored during the lift.
  - It ends on `ui:panel {id:'complete', open:false}` (immediately), or on any canvas touch or key after 2 s of hold. The camera then eases back to the player's eye in 1.6 s.
- **Save.** `{v:1, x, z, yaw, pitch, mounted}`. `load` ignores bad, missing or NaN fields and refuses a blocked spot. `mounted` is informative only (see contract issue 4).

## Contract issues (Sözleşme sorunları)

1. **Controller numbers are missing from config.js.** There are no fields for acceleration time, stick radius or dead zone, tap thresholds, eye smoothing, mount blend, chase camera or lift.
   - They live in `CTRL` at the top of player.js.
   - Any key of the same name in `CONFIG.player` overrides them (for example `CONFIG.player.accelS = 0.2`).
   - Proposal: design adds a `player.controller` block, or these keys straight into `CONFIG.player`.
2. **The FOV rule conflicts with PSIKOLOJI §4.** Main sets vertical 60° in landscape. On 844×390 that is **102° horizontal**, above the 75–90° the brief asks for.
   - To respect ≤ 90° horizontal at 2.16:1, the vertical FOV would have to be ≤ 49.7°, below the brief's 55–65°. Both cannot hold at iPhone aspect ratios.
   - Portrait (vertical 75°) gives 39° horizontal.
   - Main owns `camera.fov`, so player does not touch it. Proposal for main/design: a horizontal target clamped by a vertical range, e.g. `vFov = clamp(vFromH(90°), 55°, 65°)`. That gives vertical 55° and horizontal 97° on iPhone landscape.
3. **The vehicle descriptor is extended** with optional fields, all set by tools.js and backwards compatible:
   - `view: 'first' | 'chase'`;
   - `exitSideM`;
   - `teleport(x, z, yaw)`, so a teleport while mounted moves the vehicle;
   - `drive()` may return a bump strength 0..1 for the camera jolt.
4. **Restoring "mounted" after a reload.** Player cannot re-mount by itself because tools owns the descriptor. Tools saves `cart.mounted` (an extra field) and calls `player.mount()` on `game:ready`. Player's own `mounted` field is written but only informative.
5. **The finale lift has no defined end in the contract.** Implemented as: the complete card closes (`ui:panel {id:'complete', open:false}`), or any input after a 2 s hold. ui should emit that `ui:panel` close.
6. **Extra exports** (test and debug helpers, not in §4.4): `liftState()` returns 0 off, 1 rising, 2 holding, 3 returning; `endLift()`. tools.js reads `liftState()` defensively to hide the view model during the lift.

## Verified (headless Chromium + SwiftShader, `node test/player/run.cjs`: 53/53 PASS)

- Run: `THREE_LOCAL=/path/three.min.js node test/player/run.cjs`.
- Real touch input is sent through CDP `Input.dispatchTouchEvent`, two or three fingers at once, in landscape 844×390 and portrait 390×844. Fakes of world, trash (the spike's trash core), economy, ui and audio are in `test/player/fakes/`.

Covered:
- spawn pose;
- the stick appears where the thumb lands, `moveY` is 1 on the next frame and the player is already moving;
- top speed in 0.183 s;
- stick and look at the same time: 100 px gives exactly +25° yaw while walking at 5 m/s;
- lifting the look finger keeps the stick;
- a second finger on the stick half is ignored;
- the stick base follows the thumb;
- stopping takes ≤ 0.15 s;
- tap rules: short tap yes; a 20 px drag, a 300 ms hold or a tap on the left half no;
- a touch starting on the action button never looks or moves;
- a quick button press is latched for exactly one frame;
- touchcancel, blur, panel open and an orientation flip each release input;
- W/D and a mouse drag (0.15°/px);
- kiosk and district-edge collision, and sliding along a wall;
- speed cap 2 m/s;
- no roll and a constant FOV over 120 walking frames;
- eye height range 3 cm, curvature < 0.7 mm/frame²;
- pitch clamps at +60° and −70°;
- `aimPoint` hit and no-hit;
- mount: the vehicle drives the pose, the camera blends with no step over 6 cm per frame, dismount puts the player beside the vehicle;
- save/load round trip and bad data;
- the lift reaches 46+ m with no roll, ignores input, and returns to the eye when the card closes.

**Frame sequences, looked at.** `test/player/shots/`: `walk-landscape`, `look-landscape`, `walk-portrait`, `look-portrait`, `lift`, `lift-back`. Each sequence is a folder plus a contact sheet `.png`.

**Per-frame cost.** `player.update` alone with the stick held is **0.003–0.007 ms/frame** (3000 calls, desktop CPU, headless). Budget 0.2 ms. It allocates nothing per frame.

## Assumed / not verified

- iOS Safari / WKWebView pointer-event behaviour: implicit capture, `touch-action:none`, `gesturestart`. Inside the claude.ai artifact iframe there is no pointer lock and none is used.
- Real-device feel and comfort: acceleration, sensitivity, the chase camera distance, the lift framing against the real world.js buildings (tested only against the fake world, which reuses the spike layout).
- Real fps.

## Known weak points

- Wall clipping: the view model can poke into a wall when the player stands flush against it. The near plane is 0.1 m; the hands sit 0.4–0.5 m out.
- The chase camera only checks the horizontal segment from vehicle to camera. It can still go through overhangs (there are none in this layout).
- The lift path is a straight horizontal blend after the rise. With very tall neighbouring towers (> 46 m) it would need a higher rise.

## Tests: how to run

- `THREE_LOCAL=<three r128> node test/player/run.cjs`. Without `THREE_LOCAL` the CDN is used.
- `REAL=1` uses the real modules in `www/js` instead of the fakes.
- `harness.cjs` notes:
  - `step()` does not render: SwiftShader takes 0.2–0.5 s per frame, and queued frames back up the GPU process until screenshots time out. Call `render()` before any screenshot.
  - CDP touchEnd ends exactly the listed points.
  - Never move a touch outside the viewport.
