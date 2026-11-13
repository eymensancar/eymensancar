# Temiz Şehir: architecture and module contracts

Owner of this file: architecture (graphics/engine). It is the contract between modules. If code and this file disagree, raise it; do not silently diverge. Numbers in the game come from `www/js/config.js` (design owns it); this file only names the fields the engine reads.

Status legend: **[verified]** = run and measured here (headless Chromium + SwiftShader, see §11); **[assumed]** = reasoning, not yet run on an iPhone.

---

## 1. The hard problem and the chosen approach

The whole ground of a 54 × 54 m district is covered in trash, with buried neighbour districts out to the fog. The player and robots clean it cell by cell, and the cleaned ground must stay visibly clean from far away. Target: iPhone 12, WKWebView, 60 fps.

**One grid is the single source of truth.** `grid[j*N+i]` = trash units in cell (i, j), 0..4, with 1 unit = 1 visible item = 1 bag slot (CONFIG: 108 × 108 cells of 0.5 m, mean depth 1.74, 13 446 units in 7 728 trash cells **[verified]** with the reference generator). Everything visible is derived from it, so the far layer, the near items, the removal results and the save can never disagree.

**Far layer: one draw call.** A camera-centred grid mesh (97 × 97 vertices, 18 432 triangles; 0.5 m spacing for the inner 16 m, then rings that grow geometrically to 300 m) is drawn with one `ShaderMaterial`:
- vertex shader: displaces y by the trash units sampled from a 108 × 108 `LuminanceFormat` `DataTexture` (bilinear, vertex texture fetch); outside the district a constant depth;
- fragment shader: picks per pixel between two decorrelated samples of a 512² canvas-painted, tileable "pile of trash" texture (RGB albedo with baked shadows, A = height) by height, so the tiling reads as overlapping objects; coverage = height threshold against the local depth (≥ 1 unit covers fully; between 0 and 1 only the tallest objects remain, so cleaned edges break up into single items); a grimy rim on the ground next to trash (4 extra depth taps, which also give the slope normal of the trench walls); derivative bump lighting; macro tint from a noise texture; hemisphere + sun lighting that matches three's Lambert; three's linear fog. Ground (asphalt, pavement, plaza, markings) comes from world's ground texture.
- changed cells are uploaded as dirty rows with `texSubImage2D` (≤ 108 rows × 108 B per frame); no full re-upload, no allocation.

**Near items: instanced, deterministic, windowed.** In a 36 × 36-cell window (18 m) around the camera, item k of cell c exists iff `k < grid[c]`. Its type (zone mix from CONFIG), shape, pose, scale and colour come from `hash(cell, k)`. Seven `InstancedMesh`es, one per shape (bag 36 tris, bottle 40, can 28, box 12, paper ball 20, sheet 12, gem 8), share one `MeshLambertMaterial` (vertex colours × instance colours). Removing a unit removes the top item and reports exactly its type. Dense per-shape lists with swap-remove make add/remove O(1); moving one cell re-owns only the 36 entering cells (toroidal window). Items shrink into the layer between 6.2 and 8.5 m (vertex shader), so the window edge never pops and the near/far handover is a soft band.

**Why not the alternatives.** One mesh per item (≈13 000 items) is far over a 60-draw-call budget. Instancing every item in the district (13 446 + neighbours) costs ~400 k triangles and a full rebuild per change. A pure texture with no 3D items looks like a printed carpet up close. Per-cell decals would need sorting and blending. The hybrid keeps the far field at one draw call and spends triangles only where the eye can resolve them.

Screenshots of the spike (look at them before changing the approach): `test/spike/shots/` — `01-start-plaza`, `02-street-north` (down a buried street to the horizon), `03-feet`, `05-cleaned-trail` (broom strip + robot patch), `06-cleaned-feet` (trench walls), `07-cart-swath` (a 1.8 m swath down the west street, buried neighbour district behind the barrier), `08-aerial`, `09-portrait`.

---

## 2. Coordinates, units, conventions

- Units: metres, seconds, radians in code (CONFIG uses degrees: convert with `deg * Math.PI / 180` once at init).
- Axes: **x east, z south, y up. Origin = the district's NW corner at ground level.** The district is `[0, 54] × [0, 54]`.
- Cells: `i = floor(x / 0.5)`, `j = floor(z / 0.5)`, `idx = j * N + i`, N = 108. Cell centre = `((i + 0.5) * 0.5, (j + 0.5) * 0.5)`. Cells outside `[0, N)` are neighbour districts (visual only).
- Textures of the district (ground map, depth): `u = x / 54`, `v = z / 54`, `flipY = false` (canvas row 0 = z 0).
- **Yaw is a compass heading:** 0 = facing −z (north), +π/2 = facing +x (east), π = facing +z (south; CONFIG `startYawDeg: 180`). Forward vector = `(sin yaw, −cos yaw)`. `camera.rotation.set(pitch, −yaw, 0, 'YXZ')`. Pitch: positive = looking up.
- Ground is flat at y = 0 everywhere (no curbs in geometry). The visible trash surface is `trash.surfaceAt(x, z)` (0 to 0.30 m). Eye height = `CONFIG.player.eyeHeightM` above y = 0 (the player may add a fraction of the surface height).
- Colours: three r128 defaults (`outputEncoding = LinearEncoding`, no colour management). Write sRGB hex values and treat them as final colours. Every lit material is `MeshLambertMaterial` or `MeshBasicMaterial`; the trash ground shader reproduces Lambert with world's light values, so they must come from `world.lighting()`.
- Layout (from CONFIG.district): streets 6 m wide at x/z = 0, 24, 48 (so streets also run along the district edges); blocks `nw` [6,6,24,24], `ne` plaza [30,6,48,24], `sw` [6,30,24,48], `se` [30,30,48,48]; shop kiosk [37,8,41,11] (solid, no trash); player start (39, 17), facing south. Neighbour districts repeat the same layout with period 54 m (their plaza block is built up) for `surroundings.neighbourRingDistricts` = 2 rings.

---

## 3. Files, owners, module rules

| File | Owner | What |
|---|---|---|
| `www/index.html` | architecture | shell: full-screen canvas `#game`, DOM overlay `#ui`, boot curtain `#boot`, safe-area CSS vars, loads three r128 then `js/main.js` |
| `www/js/main.js` | architecture | boot, renderer, camera projection, adaptive DPR, loop, stubs, save orchestration, lifecycle |
| `www/js/bus.js` | architecture | event bus |
| `www/js/config.js` | design | `CONFIG`, `STR` (data only) |
| `www/js/world.js` | world | layout, buildings, kiosk, props, sky, fog, lights, ground texture, collision, sell-point/guide markers, city events, promo billboard |
| `www/js/trash.js` | trash | grid, far layer, near items, removal API, milestones, save of the grid |
| `www/js/player.js` | player | input (touch + keyboard/mouse), first-person controller, camera pose, vehicle mounting, view-model root, final camera lift |
| `www/js/tools.js` | tools | hands, broom, cart (mesh + driving + nozzle), turning input into removal + bag, view-model animation, pickup/dust particles |
| `www/js/economy.js` | economy | bag/tank, coins, selling, shop/upgrades, boost, robots (simulation **and** their meshes), final sweep, offline catch-up |
| `www/js/ui.js` | ui | HUD, context button, tool buttons, shop panel, toasts, hints, milestone/complete cards, compass, settings, mock ad, debug overlay (fps, calls) |
| `www/js/audio.js` | audio | procedural Web Audio, unlocked on first touch |
| `www/js/debug.js` | debug/test | `window.__ts` test hook (§12) |
| `tools/build.py` | build (any) | makes `www/tek.html` (§10) |
| `test/spike/*` | architecture | throwaway spike, `trash-core.js` reference, `run.mjs` measurements |

**Module rules (the single-file build depends on them):**
1. A module is a plain ES module with **no `import` statements and no `import.meta`.** It gets everything through `ctx` (passed to `init`). `config.js` and `bus.js` are read by `main.js` only.
2. Exports only as `export function name(` / `export async function name(` / `export const name =` / `export let name =` / `export class Name`. No `export default`, no `export { a, b }`, no re-exports.
3. Top-level code only defines things. Create THREE objects, DOM and listeners in `init(ctx)`, not at module load.
4. The public API is **functions** (plus constant objects that never get reassigned). main copies the export object once at boot, so a value computed in `init` must be exposed through a getter function (`layout()`, `info()`), never `export let` reassigned later. Do not use `this` in exported functions.
5. Talk to another module only through `ctx.mods.<name>.<fn>()` and `ctx.bus`. Never reach into another module's objects (scene children, DOM, private arrays).
6. Every exported function listed in §4 must exist with that signature. main fills missing ones from a stub (`makeStubs` in main.js), so a partial module still runs. When your module is not written yet, the stub stands in. Keep the stub and your module in sync if you need to extend the API: add the function to this file first.
7. Hot paths do not allocate. Reuse vectors, result objects and arrays. No `new THREE.*`, no array or object literals and no closures in `update()` or in functions called every frame.
8. Each module may add at most the draw calls listed in §9. Use `MeshLambertMaterial` or `MeshBasicMaterial`. `frustumCulled = false` only where needed (InstancedMesh spread around the camera). No shadow maps (`renderer.shadowMap.enabled` stays false); use blob shadows (a dark transparent quad).

---

## 4. Module contracts

Every module exports `init(ctx)` (may return a Promise) and `update(dt)`. Optional: `resize(w, h)`, `save() → JSON-able | null`, `load(data | null)`. `dt` is in seconds, clamped to ≤ 0.05, and **0 while paused** (`ctx.state.paused`). Use `ctx.time.dt` for UI animations that must run while paused.

### 4.1 `ctx` (built by main.js, passed to every `init`)

```js
ctx = {
  THREE, canvas, renderer, scene, camera,      // camera: main owns projection (fov/aspect), player owns pose
  uiRoot,                                      // <div id="ui">: ui.js's DOM root (pointer-events: none; children opt in with .hit / data-hit / <button>)
  bus,                                         // §6
  CONFIG, STR, t(key, vars),                   // t('district_percent', {n: 42}) → 'Temiz: %42' (state.settings.lang, falls back to tr, then key)
  state,                                       // §5
  mods: { world, trash, player, tools, economy, audio, ui, debug },   // APIs below; each has __stub: true|false
  time: { game, frame, dt, real },             // game = simulated seconds (persisted), frame counter, last dt, real seconds since boot
  view: { w, h, dpr, portrait, safe: {top, right, bottom, left} },   // CSS px; updated before resize()
  offers, offer(id, label, priority = 0, owner = '', data = null),    // context-button offers, §4.9
  setPaused(reason, on),                       // pause reasons: 'hidden', 'gl', 'panel', 'ad', 'cinematic'…
  save: { now(), clear(), key },
  step(frames, dt = 1/60),                     // run updates + render synchronously (tests; use with ctx.manual = true)
  manual,                                      // true → the rAF loop does not tick (tests)
  perf: { frameMs, jsMs, renderMs, fps, mods: {name: ms} },          // EMA, written by main
  debug, isTouch, isNative, params, errors,
}
```

Config fields main.js reads (all optional; defaults in `MAIN_DEFAULTS` in main.js): `saveKey`; `player.fovVerticalDegLandscape`, `player.fovVerticalDegPortrait`; `render { maxDpr: 2, minDpr: 1, startDpr: 2, antialias: true, near: 0.1, far: 480, adaptive: true, downMs: 19.5, upMs: 17.4, upAfterS: 4, step: 0.85, freezeS: 20 }`; `loop { maxDt: 0.05 }`; `save { intervalS: 10 }`. `STR` entries are `{ tr, en }` objects; main adds three fallbacks of its own (`boot_error`, `no_webgl`, `gl_lost`) that `STR` may override. URL flags read by main: `?debug`, `?nosave`, `?reset`, `?manual`, `?dpr=<n>`, `?lang=en`.

### 4.2 world.js

```js
layout() → { size: 54, cell: 0.5, N: 108, bounds: {x0, z0, x1, z1},   // walkable district rectangle
             kind: Uint8Array(N*N),        // per cell: 0 solid (building/kiosk/container), 1 street, 2 plaza
             buildings: [{x0, z0, x1, z1, h, blockId}] }               // district + neighbours (AABBs)
groundTexture() → THREE.Texture            // district ground plan (asphalt, pavement, plaza tiles, markings); u = x/54, v = z/54, flipY = false, mipmapped
lighting() → { sunDir: Vector3 (towards the sun, normalised), sunColor, skyColor, groundColor: Color (already × intensity), fogColor: Color }
points() → [{ id, x, z, r, yaw }]          // ids: 'spawn', 'shop', 'dropoff', 'dock', 'cartPark', 'billboard'
point(id) → that entry | null
kindAt(x, z) → 0 | 1 | 2                   // also outside the district (periodic neighbour layout, plaza counts as 0 there)
outsideUnits(i, j) → 0..4                  // visual trash units of a neighbour cell (0 under buildings); deterministic
isBlocked(x, z, radius = 0) → boolean      // inside a building/kiosk/container or outside bounds (barriers)
collide(x, z, radius, out) → out           // pushes the circle out of solids and bounds: out.x, out.z, out.hit (boolean); out is caller-owned
segmentClear(x0, z0, x1, z1, radius) → boolean   // no solid along the swept circle (robot line of sight)
```
World draws: buildings (1 merged mesh, canvas facade atlas, vertex tints), props (lamps, barriers with "Yakında" signs, kiosk, drop-off container when bought: 1 merged mesh), sky (vertex-coloured sphere that follows the camera, `fog: false`, `depthWrite: false`), lights (1 `HemisphereLight` + 1 `DirectionalLight`, no shadows), `scene.fog = new THREE.Fog(fogColor, 30, 230)`, `scene.background = fogColor`, sell-point rings and the ground guide arrow (shown while `economy.bagSpace() === 0`, pointing at the nearest active sell point), promo billboard, milestone city events (`CONFIG.milestones[].cityEvent`: birds, streetlights, pedestrians, finale) and the plaza confetti. **World does not draw the ground inside or around the district:** trash.js's ground mesh draws ground and trash together (one draw call). The reference code for layout, ground map, buildings, props and sky is in `test/spike/spike.js`.

### 4.3 trash.js

Adopts `test/spike/trash-core.js` (§5). API:

```js
info() → { N, cell, K, size, types: ['paper','plastic','can','glass','bag','valuable'], shapes: [...], blocks, blockSize }
amountAt(x, z) → units in that cell (outside: world.outsideUnits)
surfaceAt(x, z) → y of the trash surface (bilinear, like the GPU)
cellAt(x, z) → idx | -1;   cellCenter(idx, out) → out {x, z}
removeInCircle(x, z, r, maxUnits, by) → TrashResult        // cells with centre within r, nearest first
removeAlongSegment(x0, z0, x1, z1, halfWidth, maxUnits, by) → TrashResult   // brooms, cart nozzle (stroke order)
pick(x, z, r, by) → Picked | null                           // removes the single top item nearest (x, z)
nearestDirty(x, z, maxR) → idx | -1                         // robots; skips clean 6 m blocks
consume(x, z, maxUnits, maxR, by) → TrashResult             // numeric cleaning nearest-first (robots off-screen, offline, final sweep)
clearAll(by) → TrashResult                                  // final sweep: empties every cell
cleanFraction() → clean cells / initial trash cells         // CONFIG definition of district %
unitFraction(), totalUnits(), initialUnits(), trashCells(), cleanCells()
blockSums() → Int32Array(blocks²)                           // live units per 6 m block (compass, minimap, straggler clusters)
itemGeometry(shapeIndex) → BufferGeometry;  itemMaterial() → Material   // tools/economy draw flying copies of picked items
```
`by` ∈ `'hands' | 'broom' | 'cart' | 'robot' | 'final' | 'debug'`; trash aggregates units per `by` for `trash:changed`.

`TrashResult` is **one reused object** (valid until the next trash call): `{ units, cells, cleaned, byType: Int32Array(types), n, sx, sy, sz: Float32Array(48), st: Uint8Array(48) (type), ss: Uint8Array(48) (shape), sc: Uint32Array(48) (0xRRGGBB) }`. The first `n` (≤ 48) removed items are sampled with position, type, shape and colour for juice. `Picked` is reused too: `{ type, shape, color, x, y, z, yaw, scale }`.

Bag capacity is enforced by the caller: `const room = economy.bagSpace(); const r = trash.removeAlongSegment(..., room, 'broom'); economy.addToBag(r.units, r.byType);`.

Emits `trash:changed`, `trash:milestone`, `trash:loaded` (§6). Saves `{ g: 'g1.<N>.<K>.<layoutHash>.<base64 RLE>', ms: highest milestone index reached }`.

### 4.4 player.js

```js
pose() → live read-only object { x, y, z, yaw, pitch, speed, vx, vz, mounted: vehicleId | null }
input() → live read-only object { moveX, moveY (stick −1..1, +y = forward), lookDX, lookDY (px this frame),
                                  action (primary button held), stick: { active, cx, cy, x, y } (CSS px, for ui to draw) }
forward(out) → out {x, z} (unit vector of yaw)
aimPoint(maxDist, out) → out { x, y, z, hit }      // crosshair ray hit on the trash surface / ground within maxDist
teleport(x, z, yaw?)
mount(vehicle) → boolean;  dismount();  mounted() → vehicle | null
setSpeedCap(mps | null)                             // broom caps walking speed at its sweep speed
viewModel() → THREE.Group                           // child of the camera; tools add their hand/tool meshes here
```
Input: left half of the screen = floating stick, right half = look drag; a short tap on the right half (< 220 ms, < 12 px) emits `input:tap`. Keyboard: WASD/arrows move, mouse drag looks. The primary action button lives in ui.js; player merges `input:button` events into `input().action`. Collision: `world.collide(x, z, CONFIG.player.radiusM, out)` every frame. While mounted, player keeps reading input and the camera but calls `vehicle.drive(dt, input, pose)` instead of walking; the vehicle (tools.js) moves `pose.x/z/yaw` and does its own collision. Vehicle descriptor: `{ id: 'cart', eyeHeight, drive(dt, input, pose), object3D }`. On `district:cleaned` player runs the camera lift (`ctx.setPaused('cinematic', …)` is not used; the lift runs while the game keeps updating).

Writes: `ctx.camera.position/rotation` (only player writes the camera pose).

### 4.5 tools.js

```js
current() → 'hands' | 'broom' | 'cart'
available() → ids the player owns
equip(id) → boolean
```
Hands: while `input().action` is held, grab 1 unit every `CONFIG.hands.holdIntervalS` from the nearest dirty cell in the cone (`trash.pick`); `input:tap` picks the item under the tap (ray → `trash.pick`). Broom: sweeps `removeAlongSegment` from last to current strip centre (`reachAheadM` ahead, width `economy.stat('broomWidth')`) while moving ≥ `minMoveSpeedToSweep`; sets `player.setSpeedCap`. Cart: owns the cart mesh (parked at `world.point('cartPark')` after purchase), offers `enter`/`exit`/`nozzle`, implements `drive()` (CONFIG.cart handling, `world.collide`), cleans with the nozzle down into the tank (`economy.addToBag(…, 'tank')`). Juice: flying copies of picked items (one `InstancedMesh` per shape on demand, or a pool), dust puffs (1 `Points` or instanced quads). Emits `tool:collect`, `tool:changed`, `tool:nozzle`.

### 4.6 economy.js

```js
coins() → number;  earn(amount, reason)                   // the only writer of coins
bagUnits(container = 'bag'), bagCapacity(container = 'bag'), bagSpace(container = 'bag')   // container: 'bag' | 'tank'
addToBag(units, byType, container = 'bag') → accepted units
stat(name) → number      // effective values after upgrades: 'bagCapacity', 'broomWidth', 'broomSweepSpeed', 'handsReach',
                         // 'cartNozzleWidth', 'cartTank', 'robotCount', 'robotCleanSpeed', 'robotMoveSpeed', 'robotCapacity', 'boostMultiplier'
owned(id) → boolean      // shop item ids, plus 'broom', 'cart', 'dropoff'
catalog() → [{ id, price, state: 'owned' | 'available' | 'locked', next: boolean, affordable: boolean, strName, strDesc }]
buy(id) → boolean
boostActive(), boostLeft(), boostCooldownLeft(), canOfferBoost() → boolean;  startBoost()   // after the mock ad
robots() → [{ id, x, z, yaw, state: 'idle' | 'clean' | 'travel' | 'unload', load, cap }]  // live, read-only
sellPoints() → [{ id, x, z, r, cartR, active }]
stats() → { items, coins, playS }
```
Sells automatically when the player (or the cart) is inside a sell point radius. Simulates robots: on screen they clean with `trash.removeInCircle`/`removeAlongSegment` along their path; when far from the camera (> 30 m) or away/offline they may use `trash.consume` per second of simulated time. Draws robots (≤ 3 draw calls, LED blink, blob shadow). Runs the final sweep at `CONFIG.completion.finalSweepAt` (`trash.clearAll('final')`, pays the value). Offline catch-up on `game:ready` / `app:resume` using `awayS` (cap it; design decides). Emits `economy:*`, `robot:*`.

### 4.7 ui.js

```js
toast(key, vars)            // also via bus 'ui:toast' { key, vars } or { text }
openPanel(id), closePanel() // 'shop' | 'settings' | 'pause' | 'ad' | 'complete'
```
DOM only (no THREE meshes). Reads state through other modules' getters each frame and writes the DOM **only when a shown value changes**. Owns: the primary context button (shows the top offer, §4.9; press → `input:button {id:'action', down:true}` + `ui:offer {id}`; release → `input:button {id:'action', down:false}`; keyboard E/Space do the same), tool buttons (`ui:tool`), shop panel (`economy.catalog()`, `ui:buy`), boost offer and the mock ad overlay (`ui:adWatched` after `CONFIG.boost.mockAdS`), hints (`CONFIG.hints`), toasts, coin fly-to-counter, "+N" popups projected from world positions with `ctx.camera`, milestone and completion cards, compass (straggler clusters from `trash.blockSums()`), settings (writes `ctx.state.settings`, persists them in its save), stick visuals (from `player.input().stick`), the debug overlay (`?debug`: `ctx.perf`, `renderer.info.render.calls/triangles`). Portrait/landscape reflow in CSS using `ctx.view` and the `--sat/--sar/--sab/--sal` variables. All touch targets ≥ 44 × 44 pt. Text only through `ctx.t()`.

### 4.8 audio.js

```js
play(name, opts)            // opts { vol, pitchSemis, x, z } — positional when x/z given
setEnabled(sound, music)
unlocked() → boolean
```
Creates the `AudioContext` lazily and resumes it on the first `pointerdown`/`touchend`/`keydown` (WKWebView needs a user gesture). Listens to events (§6) and reads `economy.robots()` for the positional hum. Suspends on `app:pause`.

### 4.9 Context offers (the one action button)

Every frame main clears `ctx.offers`; during `update` modules call `ctx.offer(id, label, priority, owner)` for what is possible right now; ui (updated after all gameplay modules) shows the highest-priority offer on the button. When pressed, ui emits `ui:offer {id, owner}` and the owner acts.

| id | owner | label key | priority |
|---|---|---|---|
| `exit` | tools | `act_exit` | 90 |
| `nozzle` | tools | `act_nozzle_down` / `act_nozzle_up` | 80 |
| `enter` | tools | `act_enter` | 70 |
| `shop` | economy (within `shop.openRadiusM`; ui opens the panel) | `act_shop` | 60 |
| `pick` | tools (hands equipped; hold = auto-grab) | `act_pick` | 10 |
| `sweep` | tools (broom equipped; informative, walking sweeps) | `act_sweep` | 5 |

### 4.10 debug.js

Installs `window.__ts` only with `?debug` (§12). Reads `window.__tsCtx` (main sets it with `?debug`). No gameplay effect without calls.

---

## 5. Trash rendering core (`test/spike/trash-core.js`)

A working, measured, framework-free reference (≈950 lines). `trash.js` copies it in (it cannot import it) and wraps it. What trash.js must do around it:

1. Build `zones` (Uint8Array N², 0 = no trash, 1 street, 2 plaza, 3 pile), `initial` (units per cell) and `mixes` from `CONFIG.trashGen`, `CONFIG.zoneMix`, `CONFIG.valuableChance` and `world.layout().kind`. A reference `trashGen` (value noise, piles at building corners, mean normalised to 1.74 by bisection) is in `test/spike/spike.js`; it yields 7 728 cells, mean 1.7399, 13 446 units **[verified]**.
2. `createTrashCore({ N, cell, K: CONFIG.trashGen.depthMax, types: CONFIG.trashTypes.map(t => t.id), zones, mixes, initial, outside: world.outsideUnits, outsideZone: 1, outUnitsShader: 2, groundMap: world.groundTexture(), light: world.lighting(), renderer: ctx.renderer, fadeS: CONFIG.feedback.cellCleanFadeS, seed: CONFIG.trashGen.seed })`, then `ctx.scene.add(core.group)` and `core.warmup()`.
3. In `update(dt)`: `core.update(camera.position.x, camera.position.z, dt)` once, after all gameplay modules removed trash this frame (frame order, §7). Then emit `trash:changed` (if units changed) and milestones.
4. Map the API in §4.3 onto the core (`pick`, `remove*`, `consume`, …; add `by` bookkeeping and `clearAll`).
5. On `gl:restored`: nothing (the core falls back to a full upload when three lost the texture).

Key mechanics (all in the core):
- **Depth texture** holds `vis = units × 63`, faded towards the target over `fadeS` (the "cell turns clean" animation from `CONFIG.feedback.cellCleanFadeS`). Dirty rows of `vis` go up with `texSubImage2D` through `renderer.state.bindTexture` (keeps three's texture-binding cache correct); WebGL2 uses the `srcOffset` overload (no allocation), WebGL1 a `subarray` view.
- **Near window**: toroidal 36 × 36 slots × 4 items; `slotOwner`/`slotShown` per slot; recentring re-owns only entering rows/columns (45 cells per recentre on average, walking) **[verified]**.
- **Item height** follows the logical surface (bilinear like the GPU); when a cell changes, items of its 3 × 3 neighbourhood are re-seated.
- **Instance uploads**: per shape only the touched dense range (`updateRange`) goes up.
- **Determinism**: `hash(cellKey, k, channel)` with the trash seed; `pick`/`remove*` report the same type/shape/colour the player saw.
- **Save**: RLE over per-cell codes (255 = unchanged since the initial fill), base64; a layout hash detects layout changes (then applied best-effort, `exact: false`).
- Tunables: `nearHalf` (window), `fadeStart/fadeEnd` (handover band), `layerHeight` (0.30 m at 4 units), `tileMeters`, `bump`, mesh rings.

---

## 6. Events

`bus.on(name, fn) → unsubscribe`, `bus.off`, `bus.once`, `bus.emit(name, payload)`. Synchronous, in subscription order, exceptions isolated and logged. **Payloads may be reused objects: copy what you keep.** Emit gameplay events at most once per frame per kind (aggregate), except discrete actions (purchase, sale, milestone).

| Event | Payload | Emitter | Typical listeners |
|---|---|---|---|
| `game:ready` | `{ fresh, awayS }` | main (after init + load, first frame) | economy (offline robots), ui (hints), audio |
| `game:willSave` | `null` | main (before collecting saves) | anyone with pending state |
| `game:saveNow` | `null` | anyone (after purchase, milestone) | main |
| `app:pause` / `app:resume` | `null` / `{ awayS }` | main (visibilitychange) | audio, economy (catch-up) |
| `gl:lost` / `gl:restored` | `null` | main | ui (message), anyone with custom GL state |
| `view:resize` | `ctx.view` | main | ui |
| `view:quality` | `{ dpr }` | main (adaptive DPR) | debug overlay |
| `input:button` | `{ id: 'action', down }` | ui | player |
| `input:tap` | `{ x, y }` (CSS px) | player | tools (tap-to-pick) |
| `ui:offer` | `{ id, owner }` | ui | owner of the offer (tools, economy) |
| `ui:tool` | `{ id }` | ui | tools |
| `ui:buy` | `{ id }` | ui | economy |
| `ui:adWatched` | `{ kind: 'boost' }` | ui (after the mock ad) | economy |
| `ui:panel` | `{ id, open }` | ui | player (ignore look input while a panel is open), audio |
| `ui:toast` | `{ key, vars }` or `{ text }` | anyone | ui |
| `trash:changed` | `{ units, cells, cleaned, by: { hands, broom, cart, robot, final, debug }, fraction }` (once per frame) | trash | ui (%), audio, economy |
| `trash:milestone` | `{ index, at, fraction }` (each `CONFIG.milestones` entry once; persisted) | trash | economy (bonus), ui (card), world (city event), audio |
| `district:cleaned` | `{ playS }` | trash (when the 1.00 milestone fires) | player (camera lift), ui (complete card), world (finale), audio |
| `trash:loaded` | `{ exact }` | trash (after load) | debug |
| `tool:changed` | `{ id }` | tools | ui, audio, player |
| `tool:collect` | `{ tool, units, byType, x, y, z, valuable }` (aggregated per frame per tool) | tools | ui (bag tick, hints), audio (pop pitch chain) |
| `tool:nozzle` | `{ down }` | tools | ui, audio |
| `tool:swing` | `{ tool, speed }` (broom stroke, ≤ 1 per 0.3 s) | tools | audio |
| `player:mount` / `player:dismount` | `{ vehicle }` | player | ui, audio, tools |
| `player:step` | `{ speed }` | player | audio |
| `economy:coins` | `{ coins, delta, reason }` | economy | ui |
| `economy:bag` | `{ container, units, cap }` (on change) | economy | ui |
| `economy:bagFull` | `{ container }` | economy | ui, audio, world (guide arrow) |
| `economy:sold` | `{ pointId, units, coins, byType, valuable, x, z, by: 'player' \| 'robot' }` | economy | ui (coin fly, hints), audio |
| `economy:purchased` | `{ id, price }` | economy | tools (equip), world (drop-off), ui (toast), audio, main via `game:saveNow` |
| `economy:boost` | `{ active, left }` | economy | ui, audio |
| `economy:finalSweep` | `{ units, coins }` | economy | ui, audio, world |
| `robot:added` | `{ id }` | economy | ui, audio |
| `robot:collect` | `{ id, units, x, z }` (aggregated, ≤ 4/s per robot) | economy | audio, ui |

---

## 7. Frame order

```
requestAnimationFrame
  dt = clamp(real delta, 0, 0.05); dt = 0 while paused
  ctx.offers cleared
  player.update   input → pose → camera (collision via world)
  tools.update    turns input into trash removal + bag; vehicle driving runs inside player.update via vehicle.drive
  economy.update  selling, robots (remove trash), boost, final sweep
  trash.update    ONE core.update(): fade, dirty rows → texSubImage2D, near window, instance ranges; emits trash:changed / milestones
  world.update    sky follows camera, markers, city events
  audio.update    positional robot hum, listener pose
  ui.update       reads everything, writes changed DOM, shows top offer
  debug.update
  renderer.render(scene, camera)
  adaptive DPR every 1 s; autosave every CONFIG.save.intervalS (10 s) while not paused
```
Who may write what:

| State | Writer | Readers |
|---|---|---|
| `camera.position/rotation` | player | everyone |
| `camera.fov/aspect`, renderer size, DPR | main | everyone |
| trash grid | trash (via its API, called by tools, economy, debug) | everyone through trash getters |
| coins, bag, tank, upgrades, boost, robots | economy | everyone through economy getters |
| current tool, cart entity | tools | through tools getters |
| `ctx.state.settings` | ui | everyone |
| `ctx.state.paused` | main (`ctx.setPaused` may be called by ui for panels/ad) | everyone |
| scene graph | each module adds/removes only its own objects | — |

---

## 8. Save format

One localStorage key, `CONFIG.saveKey` = `temizsehir.v1`:

```js
{ v: 1, savedAt: <epoch ms>, playS: <game seconds>,
  mods: { trash: { g: 'g1.108.4.<hash>.<base64>', ms: 2 },
          economy: { v: 1, coins, bag: {units, byType}, tank: {...}, owned: [...], levels: {...}, boost: {...}, robots: [...], stats: {...} },
          tools: { v: 1, current, cart: { x, z, yaw, nozzle } },
          player: { v: 1, x, z, yaw, pitch, mounted },
          ui: { v: 1, settings: {...}, hintsDone: [...] },
          audio: null } }
```
- main collects `save()` from each real module (stubs are skipped, and the previous data of a module that is missing in this build is kept) every 10 s, on `visibilitychange` → hidden, on `pagehide` and on `game:saveNow`.
- At boot main calls `load(data | null)` on every real module after all `init`s. `null` = fresh game. Each module must tolerate missing or extra fields; never rename a field; if the shape changes, add `v` handling that reads the old one.
- Measured: trash grid after a heavy carve = 10.7 KB, fresh = a few bytes; save ≈ 2 ms, load 2–5 ms **[verified, desktop]**.
- URL flags: `?nosave` (no read/write), `?reset` (delete the save, then start).

---

## 9. Performance budget

Target device iPhone 12 (A14), landscape 844 × 390 CSS px, DPR adaptive 1.0–2.0 (start 2.0), MSAA on.

| Item | Budget | Measured in the spike [verified, SwiftShader] |
|---|---|---|
| Draw calls, whole frame | ≤ 40 (hard cap 60) | 11 (trash 8, buildings 1, props 1, sky 1) |
| Triangles, whole frame | ≤ 150 k | 53–87 k (trash ground 18.4 k + items 30–65 k + buildings/props ~5 k) |
| Near-item instances | ≤ 6 k | 1.2–2.3 k in normal views (window max 5 184 slots × 4) |
| Texture memory | ≤ 24 MB | ≈ 5.8 MB (ground map 1024² 4.0 MB, trash tile 1.4 MB, facade 0.35 MB, noise 0.09 MB, depth 12 KB) + instance buffers 2.8 MB |
| JS per frame, all modules + three render submit | ≤ 4 ms on device | three render submit 0.3–0.6 ms; trash update 0.02–0.03 ms typical, 0.1 ms at ~100 changed cells/frame |

Per module (JS ms per frame on device, draw calls added):

| Module | JS ms | Draw calls | Triangles |
|---|---|---|---|
| main (+ three render submission) | 1.0 | 0 | 0 |
| world | 0.2 | ≤ 6 (buildings, props, sky, markers, billboard, city events) | ≤ 15 k |
| trash | 0.3 (spike: 0.03) | 8 (ground + 7 shapes) | ≤ 100 k |
| player | 0.2 | 0 | 0 |
| tools | 0.4 | ≤ 6 (view model, cart, flying items, dust) | ≤ 10 k |
| economy | 0.5 (robots) | ≤ 3 (robots, LEDs, shadows) | ≤ 5 k |
| ui | 0.6 (DOM writes only on change) | 0 | 0 |
| audio | 0.2 | 0 | 0 |
| debug | 0 unless `?debug` | 0 | 0 |
| **Total** | **≤ 3.4** | **≤ 23** | **≤ 130 k** |

Spike measurements **[verified, headless Chromium, SwiftShader, desktop CPU; `test/spike/results.json`]**:
- Broom walking (0.04 m/frame, 1.3 m strip) + 3 robots: 0.01–0.024 ms/frame for removal + update; cart (2.2 m, 5 m/s) + 8 robots: 0.02–0.033 ms/frame (ranges = several runs).
- Stress: ~96 random cells changed per frame across the district: 0.10 ms/frame (107 dirty rows uploaded per frame).
- Walking: 0.007 ms/frame on average; 45 cells re-owned per recentre. Teleport (full window rebuild, 1 296 cells, ~1 800 items): 0.9–1.5 ms once.
- `nearestDirty`: 0.0015 ms; `consume` of 2 000 units (1 223 cells): 9–17 ms (offline catch-up only; spread it over frames if it runs during play).
- `renderer.info`: 11 calls, 53–87 k triangles in all eight test views, 69 k in portrait.

Estimate for iPhone 12 **[assumed]**: vertex load ≈ 100 k triangles is far under A14 capacity. The fragment cost is the ground shader (≈ 13 texture taps, derivatives) over ~50 % of 1.3 Mpx at DPR 2, ≈ 9 M taps per frame, well within the GPU's texture rate. JS in WebKit's JIT is estimated at ≤ 2× this container's figures. Expected 60 fps at DPR 2 with headroom. The adaptive DPR falls to 1.0 if the GPU-bound frame time exceeds 19.5 ms. Real fps is **not** measured: SwiftShader is a CPU rasteriser (≈ 0.5–1 s per frame here).

Adaptive DPR (main.js): every 1 s, average real frame time; above 19.5 ms → DPR × 0.85 (floor 1.0); below 17.4 ms for 4 s → DPR ÷ 0.85 (cap min(2, devicePixelRatio)). If a step down did not improve the average by 7 %, the cap is vsync or Low Power Mode (30 Hz), not fill rate: the step is undone and adaptation pauses for 20 s. `?dpr=1.5` forces a value.

---

## 10. Single-file build (`tools/build.py` → `www/tek.html`)

The artifact host wraps a body fragment, so `tek.html` must **start with `<title>`** and contain no `<!doctype>`, `<html>`, `<head>` or `<body>` tags. Steps:

1. Output `<title>Temiz Şehir</title>`, the `<meta name="viewport" …>` line from `index.html`, the `<style>` block between the `BUILD:STYLE-START/END` markers, the body elements (`<canvas id="game">`, `<div id="ui">`, `<div id="boot">…</div>`), and the three.js CDN `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>` tag unchanged.
2. Then one `<script type="module">` containing, in this order: `window.__TS_MODS = {};`, each of `config, bus, world, trash, player, tools, economy, audio, ui, debug` that exists, wrapped as
   ```js
   window.__TS_MODS.world = (function () {
     /* world.js with every leading `export ` removed */
     return { init, update, layout, groundTexture, /* …every exported name… */ };
   })();
   ```
   and finally `main.js` verbatim (its `loadModule` reads `window.__TS_MODS` and never reaches the dynamic `import()`).
3. Transform rules: a line matching `^export (async )?function (\w+)` or `^export (const|let|class) (\w+)` loses `export ` and its name joins the return list. Any other line matching `^\s*(import|export)\b`, or any `import.meta` outside main.js, is a build error (rule §3.1/§3.2).
4. Escape `</script` inside the bundle as `<\/script`. Fail if the output exceeds 2 MB (the budget is ~400 KB).
5. Smoke test after building: open `tek.html?debug&nosave` wrapped in a minimal `<!doctype html><html><body>…` in Playwright and assert `window.__ts.ready` (§12).

---

## 11. How the spike was measured

`node test/spike/run.mjs --three /path/to/three.min.js` serves the repo, routes the CDN URL to a local copy (or the network without `--three`), opens `test/spike/index.html?shots` at 1280 × 590 (iPhone landscape aspect) and 390 × 844, takes the screenshots in `test/spike/shots/`, runs the benches (`window.__spike.bench*`), and writes `test/spike/results.json`. Chromium flags: `--use-angle=swiftshader --enable-unsafe-swiftshader`. WebGL2 was used. `performance.now()` is coarsened to 0.1 ms there, so benches report totals divided by frames. `test/spike/index.html` without `?shots` is interactive (drag to look, WASD, Space sweeps) for a quick look on a phone.

---

## 12. Test recipe (`window.__ts`, Playwright)

`debug.js` provides, with `?debug` only:

```js
window.__ts = {
  ready: true, ctx,                                   // ctx is the full context (debug only)
  state() → { coins, bag: {units, cap}, tank: {units, cap}, tool, clean, unitsLeft, pose: {x, z, yawDeg}, owned: [...], robots: n, paused, frame, gameS },
  teleport(x, z, yawDeg?), look(yawDeg, pitchDeg),
  give(coins), own(id) /* grant a shop item without paying */, setTool(id),
  hold(down) /* primary button */, stick(x, y) /* virtual stick until reset with stick(0,0) */, tap(px, py),
  step(seconds, dt = 1/60) /* sets ctx.manual = true and runs ctx.step */, resume() /* back to rAF */,
  clean(x, z, r) → units, setClean(fraction) /* consume from the district centre until cleanFraction ≥ fraction */,
  counters() → { fps, frameMs, jsMs, renderMs, mods, calls, triangles, textures, geometries, instances, dpr },
  events(name?) → recorded [{ t, name, payload copy }] (via bus.setTrace), clearEvents(),
  save(), reload() /* location.reload keeping the save */,
};
```

Recipe (Node, Playwright pre-installed; ESM needs `createRequire`):

```js
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ path: THREE_LOCAL, contentType: 'text/javascript' })); // offline runs
await page.goto(`http://127.0.0.1:${port}/index.html?debug&nosave`);
await page.waitForFunction(() => window.__ts && window.__ts.ready);
await page.evaluate(() => { __ts.teleport(27, 40, 0); __ts.hold(true); __ts.step(3); __ts.hold(false); });
const s = await page.evaluate(() => __ts.state());
assert(s.bag.units > 0 && s.bag.units <= s.bag.cap);
await page.evaluate(() => { __ts.teleport(39, 13); __ts.step(1); });   // walk into the shop sell zone
assert((await page.evaluate(() => __ts.state())).coins > 0);
const c = await page.evaluate(() => __ts.counters());
assert(c.calls <= 40 && c.triangles <= 150000);
```
Always `step()` (manual frames) in assertions; rAF timing in headless is not reliable. Use `?nosave` so tests do not leak into each other. Headless numbers are for correctness, draw calls, triangles and JS cost, never fps.

---

## 13. Risks and open questions

Biggest technical risks on a real iPhone **[assumed, unverified]**:
1. **Sustained fill rate and heat.** The ground shader covers half the screen at DPR 2 with MSAA. A14 should hold 60 fps, but after 10–20 minutes thermal throttling can halve GPU clocks. Mitigation: adaptive DPR (floor 1.0). If that is not enough, drop the second trash-tile sample and the 4-tap rim beyond 25 m, and turn MSAA off below DPR 1.3.
2. **WebKit/WKWebView behaviour.** rAF runs at 30 Hz in Low Power Mode and in throttled iframes (the claude.ai artifact is an iframe). Memory pressure can kill or lose the WebGL context on backgrounding. Vertex texture fetch with LINEAR filtering on a LUMINANCE texture and `texSubImage2D` with `srcOffset` are in the WebGL2 spec and work in Chromium, but are untested on Safari's Metal-backed ANGLE. Fallback if needed: an RGBA8 depth texture, or NEAREST filtering plus manual bilinear in the shader.
3. **Per-frame buffer uploads.** Every frame with changes does one `texSubImage2D` plus up to 14 `bufferSubData` ranges (7 shapes × matrix/colour). On Metal-backed WebGL, writing a buffer the GPU is still reading can stall the pipeline. Ranges are small (cart: < 10 KB per frame), but if profiling shows stalls, double-buffer the instance attributes or upload every other frame.

Others: the near/far handover band (6.2–8.5 m) is visible as a softening of detail in screenshots, which is acceptable (widening it costs triangles). The aerial view shows neighbour districts at the same density as the district, so the finale camera lift should frame the clean district against them. Touch and audio inside the artifact iframe (gesture unlock, no pointer lock) are unverified. Open: whether economy simulates off-screen robots exactly or with `consume` (both supported by the API).
