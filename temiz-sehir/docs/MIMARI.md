# Temiz Şehir: architecture and module contracts

Owner of this file: architecture (graphics/engine). It is the contract between modules. If code and this file disagree, raise it; do not silently diverge. Numbers in the game come from `www/js/config.js` (design owns it); this file only names the fields the engine reads.

Status legend: **[verified]** = run and measured here (headless Chromium + SwiftShader, see §11); **[assumed]** = reasoning, not yet run on an iPhone.

**v2 (owner's first playtest on an iPhone 14 Pro; details and reasons in `docs/BIRLESTIRME.md` § v2).** Contract changes, all reflected in the sections below: the district is **90 × 90 m, 180 × 180 cells** (16,864 trash cells, 31,198 units); the start tool is the **hand brush** (`tools.current()` = `'brush' | 'broom' | 'cart'`, remover id `by = 'brush'`, offer `brush`; hand-picking, `input:tap` picking and the glove view model are gone); walking speed comes from `economy.stat('walkSpeed')` (shoes), and the tools cap it only while sweeping; **FOV** default 104° horizontal with a settings slider (`settings.fov`); **forced landscape** in a portrait viewport (`ctx.view.rot`, `ctx.view.toView`, §4.1); **storage wrapper** with fallbacks and honest status (`ctx.save.status`, events `game:saved`, §8); save format **v2**; new events `game:saved`, `ui:fade`; robots carry `introT` (new robot shown in front of the player); away caps (§4.6); `?perf` overlay and `settings.perfHud`; shader programs precompiled at boot; new adaptive-DPR controller (§9).

**Integration (phase 3).** All eight modules now run together; this file was updated to match the code. Every decision on a contract issue raised in `docs/notlar/*.md` is listed with its reason in `docs/BIRLESTIRME.md` (§ "Kararlar"); the sections below state the result. Tests: `node test/run-all.mjs` (§12).

---

## 1. The hard problem and the chosen approach

The whole ground of a 90 × 90 m district (v2; v1: 54 × 54 m) is covered in trash, with buried neighbour districts out to the fog. The player and robots clean it cell by cell, and the cleaned ground must stay visibly clean from far away. Target: iPhone 12, WKWebView, 60 fps.

**One grid is the single source of truth.** `grid[j*N+i]` = trash units in cell (i, j), 0..4, with 1 unit = 1 visible item = 1 bag slot (CONFIG v2: 180 × 180 cells of 0.5 m, mean depth 1.85, 31 198 units in 16 864 trash cells **[verified]**; v1: 108 × 108, 13 446 units in 7 728 cells). Everything visible is derived from it, so the far layer, the near items, the removal results and the save can never disagree.

**Far layer: one draw call.** A camera-centred grid mesh (97 × 97 vertices, 18 432 triangles; 0.5 m spacing for the inner 16 m, then rings that grow geometrically to 300 m) is drawn with one `ShaderMaterial`:
- vertex shader: displaces y by the trash units sampled from an N × N (v2: 180 × 180) `DataTexture` (bilinear, vertex texture fetch); outside the district a constant depth;
- fragment shader: picks per pixel between two decorrelated samples of a 512² canvas-painted, tileable "pile of trash" texture (RGB albedo with baked shadows, A = height) by height, so the tiling reads as overlapping objects; coverage = height threshold against the local depth (≥ 1 unit covers fully; between 0 and 1 only the tallest objects remain, so cleaned edges break up into single items); a grimy rim on the ground next to trash (4 extra depth taps, which also give the slope normal of the trench walls); derivative bump lighting; macro tint from a noise texture; hemisphere + sun lighting that matches three's Lambert; three's linear fog. Ground (asphalt, pavement, plaza, markings) comes from world's ground texture.
- changed cells are uploaded as dirty rows with `texSubImage2D` (≤ N rows × N texels per frame); no full re-upload, no allocation.

**Near items: instanced, deterministic, windowed.** In a 36 × 36-cell window (18 m) around the camera, item k of cell c exists iff `k < grid[c]`. Its type (zone mix from CONFIG), shape, pose, scale and colour come from `hash(cell, k)`. Seven `InstancedMesh`es, one per shape (bag 36 tris, bottle 40, can 28, box 12, paper ball 20, sheet 12, gem 8), share one `MeshLambertMaterial` (vertex colours × instance colours). Removing a unit removes the top item and reports exactly its type. Dense per-shape lists with swap-remove make add/remove O(1); moving one cell re-owns only the 36 entering cells (toroidal window). Items shrink into the layer between 6.2 and 8.5 m (vertex shader), so the window edge never pops and the near/far handover is a soft band.

**Why not the alternatives.** One mesh per item (≈13 000 items) is far over a 60-draw-call budget. Instancing every item in the district (13 446 + neighbours) costs ~400 k triangles and a full rebuild per change. A pure texture with no 3D items looks like a printed carpet up close. Per-cell decals would need sorting and blending. The hybrid keeps the far field at one draw call and spends triangles only where the eye can resolve them.

Screenshots of the spike (look at them before changing the approach): `test/spike/shots/` — `02-street-north` (down a buried street to the horizon), `05-cleaned-trail` (broom strip + robot patch), `07-cart-swath` (a 1.8 m swath down the west street, buried neighbour district behind the barrier), `08-aerial` (the other spike shots were pruned at integration; `node test/spike/run.mjs` regenerates them).

---

## 2. Coordinates, units, conventions

- Units: metres, seconds, radians in code (CONFIG uses degrees: convert with `deg * Math.PI / 180` once at init).
- Axes: **x east, z south, y up. Origin = the district's NW corner at ground level.** The district is `[0, 90] × [0, 90]` (v2).
- Cells: `i = floor(x / 0.5)`, `j = floor(z / 0.5)`, `idx = j * N + i`, N = 180 (v2). Cell centre = `((i + 0.5) * 0.5, (j + 0.5) * 0.5)`. Cells outside `[0, N)` are neighbour districts (visual only).
- Textures of the district (ground map, depth): `u = x / size`, `v = z / size` (size 90), `flipY = false` (canvas row 0 = z 0).
- **Yaw is a compass heading:** 0 = facing −z (north), +π/2 = facing +x (east), π = facing +z (south; CONFIG `startYawDeg: 180`). Forward vector = `(sin yaw, −cos yaw)`. `camera.rotation.set(pitch, −yaw, 0, 'YXZ')`. Pitch: positive = looking up.
- Ground is flat at y = 0 everywhere (no curbs in geometry). The visible trash surface is `trash.surfaceAt(x, z)` (0 to 0.30 m). Eye height = `CONFIG.player.eyeHeightM` above y = 0 (the player may add a fraction of the surface height).
- Colours: three r128 defaults (`outputEncoding = LinearEncoding`, no colour management). Write sRGB hex values and treat them as final colours. Every lit material is `MeshLambertMaterial` or `MeshBasicMaterial`; the trash ground shader reproduces Lambert with world's light values, so they must come from `world.lighting()`.
- Layout (v2, from CONFIG.district): streets 6 m wide at x/z = 0, 28, 56, 84 (streets also run along the district edges); 3 × 3 blocks of 22 m, the centre block `c` [34,34,56,56] is the plaza; shop kiosk [43,49,47,52] on its south edge (solid, no trash); shop sell point (45, 54); player start (42, 58.5) facing east down the street; promo billboard on block `e`. Neighbour districts repeat the same layout with period 90 m (their plaza block is built up) for `surroundings.neighbourRingDistricts` = 2 rings.

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
| `www/js/tools.js` | tools | hand brush (v2), broom, cart (mesh + driving + nozzle), turning input into removal + bag, view-model animation, broom stroke puffs + valuable sparkle (removal juice is trash's, §4.3) |
| `www/js/economy.js` | economy | bag/tank, coins, selling, shop/upgrades, boost, robots (simulation **and** their meshes), final sweep, offline catch-up |
| `www/js/ui.js` | ui | HUD, context button, tool buttons, shop panel, toasts, hints, milestone/complete cards, compass, settings, mock ad, debug overlay (fps, calls) |
| `www/js/audio.js` | audio | procedural Web Audio, unlocked on first touch |
| `www/js/debug.js` | debug/test | `window.__ts` test hook (§12) |
| `tools/build.py` | build (any) | makes `www/tek.html` (§10) |
| `test/run-all.mjs`, `test/e2e/*` | integration | one test command; e2e smoke, full touch play-through, performance/robustness (§12) |
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
  offers, offer(id, labelKey, priority = 0, owner = '', data = null), // context-button offers, §4.9 (label = STR key)
  setPaused(reason, on),                       // pause reasons: 'hidden', 'gl', 'panel', 'ad', 'cinematic'…
  save: { now(), clear(), reset(), key },      // reset(): delete the save, block every later write, reload
  haptic(kind),                                // 'light' | 'medium' | 'heavy' | 'full': reads settings.haptics, rate-limits light
                                               // ticks (CONFIG.haptics); Capacitor Haptics if present, else navigator.vibrate
  step(frames, dt = 1/60),                     // run updates + render synchronously (tests; use with ctx.manual = true)
  manual,                                      // true → the rAF loop does not tick (tests)
  perf: { frameMs, jsMs, renderMs, fps, mods: {name: ms} },          // EMA, written by main
  debug, isTouch, isNative, params, errors,
}
```

Config fields main.js reads (config.js is the single source; `MAIN_DEFAULTS` keeps only `loop.maxDt` and `save.{intervalS 5, soonS 1, cloudMinGapS 15, cloudWaitS 3}`): `version` (2), `saveKey`; `player.fovHorizontalDegLandscape` (104), `player.fovRangeDeg` ([85, 115]), `player.fovVerticalClampDeg` ([46, 80]), `player.fovVerticalDegPortrait` (82); `render { maxDpr, minDpr, startDpr, lowDpr, antialias, near, far, adaptive, downMs, upMs, upAfterS, step, freezeS, nearFade, nearFadeLow, depthFormat, glLostReloadS }`; `haptics`. All player-facing text, including main's own (`boot_error`, `no_webgl`, `gl_lost`), is in `STR` (`{ tr, en }`). URL flags read by main: `?debug`, `?perf` (overlay only: no `preserveDrawingBuffer`, no event trace, no `__ts`), `?nosave`, `?reset`, `?manual`, `?dpr=<n>`, `?aa0` (MSAA off), `?dikey=1` (upright portrait, no forced landscape), `?nostorage` / `?nocloud` (tests), `?lang=en`; trash reads `?depth=rgba|la`.

**FOV (v2).** Landscape: vertical FOV = the one that gives `settings.fov` (default `fovHorizontalDegLandscape` 104°, slider 85–115°; the owner overrode PSIKOLOJI's 75–90°, see its addendum) at the current aspect, clamped to `fovVerticalClampDeg` → 61° vertical on 844 × 390 (19.5:9). Real portrait ("Dikey oyna"): 82° vertical. Computed in one place (`fovFor` in main.js) on every resize; nothing else writes the FOV. The view model was tuned for 60° vertical, so tools stretches its depth by tan 30° / tan(fov/2) (same screen size and place); trash uses the same factor for the hand-pick target.

**Settings (`ctx.state.settings`, written by ui, persisted in ui's save):** `lang`, `sound`, `music` (city bed), `haptics` (ctx.haptic; the row is hidden where nothing can vibrate), `sens` (look multiplier, player), `invertY` (player), `steer` (`'camera' | 'tank'`, tools' cart), `quality` (`'auto' | 'high' | 'low'`, main), v2: `fov` (horizontal degrees, main), `portrait` ("Dikey oyna", main), `flip` ("Ekranı çevir", main), `perfHud` (performance overlay, ui).

**Forced landscape (v2, main).** A web page cannot rotate the phone, so when the viewport is portrait (and neither `settings.portrait` nor `?dikey=1`) main renders the game rotated: `#game` and `#ui` get the same CSS transform (`translate(innerWidth px, 0) rotate(90deg)`, sized to the swapped dimensions; `flip` → `rotate(-90deg)`), the renderer and camera use the landscape size, and `ctx.view` describes the GAME space: `w, h` landscape, `portrait: false`, `rot: 90 | -90 | 0`, `safe` mapped to the rotated edges (rot 90: left = device top, i.e. the notch / Dynamic Island; right = device bottom, the home indicator), and `toView(clientX, clientY, out)` maps a screen point to game coordinates (null when not rotated). The browser hit-tests the rotated DOM itself (buttons, panels); player maps its canvas pointers through `toView`; ui maps its layout reads (`lrect`) and its custom slider and panel-scroll drags through it, and gets `--sat/--sar/--sab/--sal` and `--vw/--vh` in game space on `#ui`. rot 90 = the phone turned counter-clockwise (home indicator on the right) shows the picture upright. A landscape viewport is never rotated; resizes switch modes live (pointers are released). **The native iPhone app locks the orientation to landscape itself** (Capacitor/Xcode setting), so this mode only matters in browsers and the claude.ai artifact. ui emits `ui:settings` (payload = the settings object) on every change; main re-applies quality on it (auto = adaptive DPR between min and max; high = max DPR fixed; low = `render.lowDpr` fixed and `trash.setQuality('low')`, which pulls the 3D item band in to `render.nearFadeLow`).

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
segmentClear(x0, z0, x1, z1, radius, ignoreSmall?) → boolean   // no solid along the swept circle; ignoreSmall skips poles/trunks (chase camera)
```
Solids (decided at integration): building blocks, kiosk, the drop-off container while owned, and **small circles**: lamp posts inside the district (r 0.16 m) and the 4 plaza tree trunks (r 0.2 m). Benches and bins stay walk-through. The drop-off container stands just outside the west barrier at the SW crossing (x −2.6…−0.6), so it never covers a trash cell; its sell zone (3, 51, r 2.5) is inside the district: the player, the cart and the robots reach it (verified: player sale there by touch, robots unload at the nearer point).
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
itemGeometry(shapeIndex) → BufferGeometry;  itemMaterial() → Material
removeCell(idx, maxUnits, by) → TrashResult                 // added at integration (per-cell cleaners)
setQuality(mode)                                            // 'low' → render.nearFadeLow band, else render.nearFade (main calls it)
debugInfo()                                                 // tests only
```
`info().blockSize` is in **cells** (12 = 6 m); `info().blockSizeM` (6) is in metres; `info().depthFormat` is `'rgba'` or `'la'`. `TrashResult` also carries `value` (coins at base price). Default `by` when omitted: `pick` → brush, `remove*` → debug, `consume`/`removeCell` → robot, `clearAll` → final; callers always pass it.

**Removal juice belongs to trash (decided at integration).** Removed items that were visible fly to their collector inside the existing 7 instanced meshes (0 extra draw calls) and a dust puff rises from each cell that becomes clean (1 `Points`, only while puffs live). Collectors: brush (v2) → the dustpan in the left glove (`CONFIG.tools.brushTarget`, camera space); broom → the bag at the hip; cart → the intake; robot → the robot; final → a gust. tools.js draws no flying copies and no removal dust (its earlier duplicate was removed); it keeps only the broom stroke puff (rhythm, `feedback.dustPuffEveryS`) and the gold sparkle of a valuable.

**Depth texture (decided at integration).** UNSIGNED_BYTE with LINEAR filtering, sampled in the vertex shader: no float or half-float extension is used anywhere. Default format RGBA8 (R = G = B = units, A = cleaned), mirrored from the LA working buffer for the uploaded rows only; `?depth=la` (or `render.depthFormat: 'la'`) uploads LUMINANCE_ALPHA directly. Both render the same picture (verified by screenshot). If a GPU reports 0 vertex texture units trash warns (the layer would be flat); all iOS GPUs report 16.
`by` ∈ `'brush' | 'broom' | 'cart' | 'robot' | 'final' | 'debug'`; trash aggregates units per `by` for `trash:changed`.

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
setSpeedCap(mps | null)                             // brush/broom cap walking speed at the sweep speed WHILE SWEEPING (v2)
viewModel() → THREE.Group                           // child of the camera; tools add their hand/tool meshes here
look(yawRad, pitchRad)                              // added at integration (tests, __ts.look)
setStick(x, y)                                      // added: a virtual stick merged like the keyboard (tests, __ts.stick)
liftState() → 0 off | 1 rising | 2 holding | 3 returning;  endLift()   // finale lift (ui/tools read it)
```
Tunables: `CONFIG.player.controller` (acceleration, stick, tap thresholds, eye smoothing, mount blend, chase camera, finale lift incl. `liftYawOffsetDeg`). Vehicle descriptor extras (all optional, set by tools): `view: 'first' | 'chase'`, `exitSideM`, `teleport(x, z, yaw)`, `drive()` may return a bump strength 0..1. After a reload tools re-mounts the cart on `game:ready` (tools saves `cart.mounted`; player's own `mounted` field is informative). The finale lift ends when the completion card closes (`ui:panel {id:'complete', open:false}`) or on input after 2 s.
v2: walking speed = `economy.stat('walkSpeed')` (CONFIG.player.walkSpeed per shoes level: 7.5 / 8.5 / 9.5 m/s); collision runs in sub-steps of at most `player.maxStepM` (0.12 m) so thin solids are never tunnelled at speed and sliding along walls stays smooth; pointer coordinates go through `ctx.view.toView` (forced landscape); the finale lift rises slowly backwards from the view (≤ ~11 m/s, yaw turn ≤ `liftMaxYawDeg` 30°) and returns with `ui:fade` + a cut (no dive); a mounted player is set down on foot when the district is cleaned.
Input: left half of the screen = floating stick, right half = look drag; a short tap on the right half (< 220 ms, < 12 px) emits `input:tap`. Keyboard: WASD/arrows move, mouse drag looks. The primary action button lives in ui.js; player merges `input:button` events into `input().action`. Collision: `world.collide(x, z, CONFIG.player.radiusM, out)` every frame. While mounted, player keeps reading input and the camera but calls `vehicle.drive(dt, input, pose)` instead of walking; the vehicle (tools.js) moves `pose.x/z/yaw` and does its own collision. Vehicle descriptor: `{ id: 'cart', eyeHeight, drive(dt, input, pose), object3D }`. On `district:cleaned` player runs the camera lift (`ctx.setPaused('cinematic', …)` is not used; the lift runs while the game keeps updating).

Writes: `ctx.camera.position/rotation` (only player writes the camera pose).

### 4.5 tools.js

```js
current() → 'brush' | 'broom' | 'cart'      // v2: 'brush' (hand brush + dustpan) replaced 'hands'
available() → ids the player owns
equip(id) → boolean
```
Hand brush (v2): while moving ≥ `brush.minMoveSpeedToSweep` it sweeps `removeAlongSegment` along a narrow strip (`brush.reachAheadM` ahead, width `economy.stat('brushWidth')`); standing with the action held it flicks one short strip every `brush.flickS`, reaching the nearest dirty cell within `brush.reachM` when the strip is clean (a held button never does nothing); `by = 'brush'`, items fly into the dustpan (`tools.brushTarget`). Brush and broom set `player.setSpeedCap(sweep speed)` only while trash lies on the strip ahead (`tools.sweepAheadProbeM`) and the bag has room; otherwise `null` (full walking speed). Broom: sweeps `removeAlongSegment` from last to current strip centre (`reachAheadM` ahead, width `economy.stat('broomWidth')`) while moving ≥ `minMoveSpeedToSweep`; sets `player.setSpeedCap`. Cart: owns the cart mesh (parked at `world.point('cartPark')` after purchase; v2: nozzle-down speed `economy.stat('cartCleanSpeed')`, movement in sub-steps, robots are soft obstacles that push the cart back and slow it), offers `enter`/`nozzle`/`exit` (§4.9), implements `drive()` (CONFIG.cart handling, `world.collide`; steering from `settings.steer`), cleans with the nozzle down into the tank (`economy.addToBag(…, 'tank')`). Juice: removal juice is trash's (§4.3); tools draws the broom stroke puff and the valuable sparkle (1 `Points`). Haptics through `ctx.haptic` (picks/collect light, cart bump and getting in medium, nozzle light, full bag 'full'). Tunables: `CONFIG.tools`. Emits `tool:collect`, `tool:changed`, `tool:nozzle`, `tool:swing`, `tool:full`, `ui:toast {key:'bag_full'|'tank_full'}`. Extra test helpers: `perfSample()`, `cartState()`.

### 4.6 economy.js

```js
coins() → number;  earn(amount, reason)                   // the only writer of coins
bagUnits(container = 'bag'), bagCapacity(container = 'bag'), bagSpace(container = 'bag')   // container: 'bag' | 'tank'
addToBag(units, byType, container = 'bag') → accepted units
stat(name) → number      // effective values after upgrades: 'bagCapacity', 'brushWidth', 'brushSweepSpeed', 'walkSpeed', 'cartCleanSpeed' (v2), 'broomWidth', 'broomSweepSpeed',
                         // 'cartNozzleWidth', 'cartTank', 'robotCount', 'robotCleanSpeed', 'robotMoveSpeed', 'robotCapacity', 'boostMultiplier'
owned(id) → boolean      // shop item ids, plus 'broom', 'cart', 'dropoff'
catalog() → [{ id, price, state: 'owned' | 'available' | 'locked', next: boolean, affordable: boolean, strName, strDesc }]
buy(id) → boolean
boostActive(), boostLeft(), boostCooldownLeft(), canOfferBoost() → boolean;  startBoost()   // after the mock ad
robots() → [{ id, x, z, yaw, state: 'idle' | 'clean' | 'travel' | 'unload', load, cap }]  // live, read-only
sellPoints() → [{ id, x, z, r, cartR, active }]
stats() → { items, coins, playS }
```
Extensions (integration): `grant(id)` (debug: own an item and its prerequisites), `debugState()`, `simulateAway(s)`, `canOfferBoost(where = 'shop' | 'milestone')`. `robots()` entries also carry `name` (short name from STR `robot_n1..4` via `CONFIG.robot.names`; ui shows the tag `robot_name` "Robot 1: Pırıl"), `color` (`CONFIG.robot.colors`, the one palette for mesh, compass, chips, tags), `hum`, `led`, `far`, `index`, `units`. Every tunable is in config.js (`robot.*` incl. AI, `offline`, `selling.resellDelayS`, `income`). Sale timing: `economy:sold` at dump start, coins credited after `selling.dumpAnimS` (player) or `robot.unloadS` (robot), `bagUnits()` drains meanwhile; a save folds in-flight coins in.

Sells automatically when the player (or the cart) is inside a sell point radius. Simulates robots: on screen they clean with `trash.removeInCircle`/`removeAlongSegment` along their path; when far from the camera (> 30 m) or away/offline they may use `trash.consume` per second of simulated time. Draws robots (≤ 3 draw calls, LED blink, blob shadow). Runs the final sweep at `CONFIG.completion.finalSweepAt` (`trash.clearAll('final')`, pays the value). Offline catch-up on `game:ready` / `app:resume` using `awayS`, v2-capped at the smallest of `offline.capS` (10 min) of robot output, `maxFractionOfRemaining` (15 %) of what is left, `maxFractionOfDistrict` (10 %) of the district and (in coins at the average unit value) the price of the next item; the payload carries `limitBy` (`'time' | 'remaining' | 'district' | 'nextItem'`); the boost and its cooldown run out by `awayS`; it emits **`economy:away`** (no toast: ui shows one card). Emits `economy:*`, `robot:*`.

### 4.7 ui.js

```js
toast(key, vars)            // also via bus 'ui:toast' { key, vars } or { text }
openPanel(id), closePanel() // 'shop' | 'settings' | 'pause' | 'ad' | 'complete'
```
DOM only (no THREE meshes). Reads state through other modules' getters each frame and writes the DOM **only when a shown value changes**. Owns: the primary context button (shows the top offer, §4.9; press → `input:button {id:'action', down:true}` + `ui:offer {id}`; release → `input:button {id:'action', down:false}`; keyboard E/Space do the same), tool buttons (`ui:tool`), shop panel (`economy.catalog()`, `ui:buy`), boost offer and the mock ad overlay (`ui:adWatched` after `CONFIG.boost.mockAdS`), hints (`CONFIG.hints`), toasts, coin fly-to-counter, "+N" popups projected from world positions with `ctx.camera`, milestone and completion cards, compass (straggler clusters from `trash.blockSums()`), settings (writes `ctx.state.settings`, persists them in its save), stick visuals (from `player.input().stick`), the debug overlay (`?debug`: `ctx.perf`, `renderer.info.render.calls/triangles`). Portrait/landscape reflow in CSS using `ctx.view` and the `--sat/--sar/--sab/--sal` variables. All touch targets ≥ 44 × 44 pt. Text only through `ctx.t()` (every key is in STR; ui's fallback table was removed). Tunables: `CONFIG.ui`.

Integration additions: the **secondary context button** (second offer with priority ≥ `ui.secondaryMinPriority`, e.g. "İn" in the cart, "Dükkan" next to "Bin"); **robot name tags** in the world (≤ `ui.robotTagMaxM`, kept out of the HUD bands); the "welcome back" card from `economy:away` (one card, honest numbers, "(2 saatlik sınır)"); the **finale** (`completeDelayS` 4.6 s after the camera lift starts; the card is a side panel in landscape and a bottom sheet in portrait over a light scrim, the camera turns `liftYawOffsetDeg` so the district sits beside it; context buttons, stick, hints and robot pops hide during the lift); the context buttons cancel the browser's synthesized click after a tap (it closed the shop it had just opened, in portrait) and panels ignore clicks for 350 ms after opening; a sale drops a stale "Çanta dolu" toast; reset save goes through `ctx.save.reset()`; haptics through `ctx.haptic`.

### 4.8 audio.js

```js
play(name, opts)            // opts { vol, pitchSemis, x, z } — positional when x/z given
setEnabled(sound, music)
unlocked() → boolean
```
Creates the `AudioContext` lazily and resumes it on the first `pointerdown`/`touchend`/`keydown` (WKWebView needs a user gesture). Listens to events (§6, plus `tool:full` → the dull thump) and reads `economy.robots()` for the positional hum. Suspends on `app:pause`. `setEnabled(sound, music)`: "music" is the city ambience bed (there is no music in the slice).

### 4.9 Context offers (the one action button)

Every frame main clears `ctx.offers`; during `update` modules call `ctx.offer(id, labelKey, priority, owner)` for what is possible right now (the label is an **STR key**; ui translates, so a language change applies at once); ui (updated after all gameplay modules) shows the highest-priority offer on the big button and the second one, if its priority is ≥ `CONFIG.ui.secondaryMinPriority` (50), on a smaller secondary button. When pressed, ui emits `ui:offer {id, owner}` and the owner acts.

Decided at integration: in the cart **both** `nozzle` (90, big button) and `exit` (80, secondary button) are always offered (before, `exit` 90 hid the nozzle behind the one button).

| id | owner | label key | priority |
|---|---|---|---|
| `nozzle` | tools | `act_nozzle_down` / `act_nozzle_up` | 90 |
| `exit` | tools | `act_exit` | 80 |
| `enter` | tools | `act_enter` | 70 |
| `shop` | economy (within `shop.openRadiusM`; ui opens the panel) | `act_shop` | 60 |
| `brush` | tools (hand brush; hold standing = flicks, walking sweeps by itself) | `act_brush` (`bag_full` when full) | 10 |
| `sweep` | tools (broom equipped; informative, walking sweeps) | `act_sweep` (`bag_full` when full) | 5 |

### 4.10 debug.js

Installs `window.__ts` only with `?debug` (§12). Reads `window.__tsCtx` (main sets it with `?debug`). No gameplay effect without calls. Note: with `?debug` the event trace copies every payload (≈ 50 B/frame of garbage); measurements of allocation exclude it.

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
| `view:quality` | `{ dpr, mode? }` | main (adaptive DPR, quality setting) | debug overlay |
| `input:button` | `{ id: 'action', down }` | ui | player |
| `input:tap` | `{ x, y }` (CSS px) | player | tools (tap-to-pick) |
| `ui:offer` | `{ id, owner }` | ui | owner of the offer (tools, economy) |
| `ui:tool` | `{ id }` | ui | tools |
| `ui:buy` | `{ id }` | ui | economy |
| `ui:adWatched` | `{ kind: 'boost' }` | ui (after the mock ad) | economy |
| `ui:panel` | `{ id, open }` | ui | player (ignore look input while a panel is open; `complete` closed ends the finale lift), audio |
| `ui:settings` | `ctx.state.settings` | ui (on every settings change) | main (quality) |
| `ui:toast` | `{ key, vars }` or `{ text }` | anyone | ui |
| `trash:changed` | `{ units, cells, cleaned, by: { brush, broom, cart, robot, final, debug }, fraction }` (once per frame) | trash | ui (%), audio, economy |
| `trash:milestone` | `{ index, at, fraction }` (each `CONFIG.milestones` entry once; persisted) | trash | economy (bonus), ui (card), world (city event), audio |
| `district:cleaned` | `{ playS }` | trash (when the 1.00 milestone fires) | player (camera lift), ui (complete card), world (finale), audio |
| `trash:loaded` | `{ exact }` | trash (after load) | debug |
| `tool:changed` | `{ id }` | tools | ui, audio, player |
| `tool:collect` | `{ tool, units, byType, x, y, z, valuable }` (aggregated per frame per tool) | tools | ui (bag tick, hints), audio (pop pitch chain) |
| `tool:nozzle` | `{ down }` | tools | ui, audio |
| `tool:full` | `{ tool, container }` (tried to collect with a full bag/tank; ≤ 1 per `tools.fullFeedbackS`) | tools | audio (thump) |
| `tool:swing` | `{ tool: 'brush' \| 'broom', speed }` (broom stroke ≤ 1 per 0.3 s; brush flick every `brush.flickS`) | tools | audio (brush: a short bright "flick"; broom: swish) |
| `game:saved` | `{ kind, persistent, bytes, reason }` (v2: after every successful save) | main | ui (the "Kaydedildi" tick, persistent stores only) |
| `ui:fade` | `{ on, s }` (v2: white fade for the finale's return) | player | ui |
| `player:mount` / `player:dismount` | `{ vehicle }` | player | ui, audio, tools |
| `player:step` | `{ speed }` | player | audio |
| `economy:coins` | `{ coins, delta, reason }` | economy | ui |
| `economy:bag` | `{ container, units, cap }` (on change) | economy | ui |
| `economy:bagFull` | `{ container }` | economy | ui, audio, world (guide arrow) |
| `economy:sold` | `{ pointId, units, coins, byType, valuable, x, z, by: 'player' \| 'robot', container, robotId, dumpS }` (at dump start) | economy | ui (coin fly, hints), audio |
| `economy:purchased` | `{ id, price }` | economy | tools (equip), world (drop-off), ui (toast), audio, main via `game:saveNow` |
| `economy:boost` | `{ active, left }` | economy | ui, audio |
| `economy:finalSweep` | `{ units, coins, durationS }` | economy | ui, audio, world |
| `economy:away` | `{ awayS, simS, capped, limitedByRemaining, units, coins, robots, rateUps, capS }` (after an away catch-up; coins already added) | economy | ui ("welcome back" card) |
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

One key, `CONFIG.saveKey` = `temizsehir.v1` (the key name stays; the format inside is versioned by `v`):

```js
{ v: 2, savedAt: <epoch ms>, playS: <game seconds>,
  mods: { trash: { g: 'g1.180.4.<hash>.<base64>', ms: 2 },
          economy: { v: 1, coins, bag: {units, byType}, tank: {...}, owned: [...], levels: {...}, boost: {...}, robots: [...], stats: {...} },
          tools: { v: 1, current, cart: { x, z, yaw, nozzle, mounted } },
          player: { v: 1, x, z, yaw, pitch, mounted },
          ui: { v: 1, settings: {...}, hintsDone: [...], hb, msBoost, complete },
          world: { v: 1, ev },
          audio: null } }
```
- **Storage (v2).** `makeStore` in main (one small wrapper, built before `init`): a real write + read-back probe picks **localStorage → sessionStorage → IndexedDB → memory**; `ctx.save.status = { kind: 'local' | 'session' | 'idb' | 'memory' | 'cloud', persistent, cloud }`. If the claude.ai artifact host offers `window.claude.use('db')` and `use('user')` (publish the artifact with `capabilities: { db: {}, user: {} }`), the save is also written to the per-person document `data/users/<id>/temizsehir_v1` (`{ s: <json>, at }`, at most every `save.cloudMinGapS` = 15 s, one write in flight) and read at boot (waits at most `save.cloudWaitS` = 3 s); the newer of the local and the cloud save wins. ui shows the "Kaydedildi" tick on `game:saved` (persistent stores only) and the "cannot save here" notice when `persistent` is false.
- **When.** main collects `save()` from each real module (stubs are skipped, and the previous data of a module that is missing in this build is kept) every `save.intervalS` (5 s) while playing, `save.soonS` (1 s, coalesced) after `game:saveNow` (economy emits it on purchases, milestones, the final sweep, away catch-up; ui on settings), after every player sale, and at once on `visibilitychange` → hidden, `pagehide`, `blur`, `beforeunload` and `freeze`. Nothing is written before `game:ready` (a half-booted game never overwrites a save).
- **Versions.** `CONFIG.version` = 2 (90 m district, brush ladder). A v1 save cannot be continued (other grid, other tools): main keeps only its `ui.settings` and starts fresh.
- At boot main calls `load(data | null)` on every real module after all `init`s. `null` = fresh game. Each module must tolerate missing or extra fields; never rename a field; if the shape changes, add `v` handling that reads the old one.
- Measured (v2, 180² grid): trash grid ≤ 3.3 KB after carving 10–90 % with 200 scattered holes, serialise ≤ 2.7 ms **[verified, desktop]** (v1: 10.7 KB after a heavy carve).
- URL flags: `?nosave` (no read/write), `?reset` (delete the save, then start). `ctx.save.reset()` (settings → reset save) deletes the save and blocks every later write (pagehide, visibilitychange) before it reloads.
- Without lasting storage (sandboxed iframe, private mode) the game runs on, says so once (`console.info`) and shows the notice. `?nostorage` / `?nocloud` simulate it in tests. `test/e2e/save.mjs` covers all of this, including a throwing localStorage.
- **[verified at integration]** reload after a full play-through restores coins, owned items, clean %, robots, position and tool exactly (`test/e2e/play.mjs`, `smoke.mjs`); coins of a sale still in flight are folded into the save on purpose.

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

**v2, 90 m district [verified, same setup]:** busiest moment 19 draw calls, 83.9 k triangles, JS 0.42 ms/frame, GPU uploads 39.9 KB/frame mean and 158 KB peak (v1 52.5 / 154: trash.js now uploads only dirty rectangles of the depth texture), texture memory ≈ 12.2 MB estimated from image sizes, 13 shader programs all compiled at boot (`renderer.compile`) and none during 40 game minutes of autoplay (robots, cart, milestones), JS heap ≈ 30 MB after 20 game minutes. Start view: 14 calls, 77 k triangles. Adaptive DPR (v2, perf review F3): two-step probe before calling a refresh cap (freeze 60 s, doubling), the too-slow DPR becomes a ceiling retried after 30 s doubling to 240 s, frames > 250 ms are ignored as stalls. Details and the v1 comparison: `docs/BIRLESTIRME.md` § v2.

**Integrated game [verified at integration, headless Chromium + SwiftShader, desktop CPU; `node test/e2e/perf.mjs`]**, busiest moment (cart sweeping with the nozzle down, 4 robots cleaning, 25 % milestone confetti/birds/banner), DPR 2, 844 × 390:
- **19 draw calls** (max over 90 frames), **76 k triangles**, 1.7 k near instances, 6 textures.
- **JS 0.40 ms/frame** total (player 0.02, tools 0.13, economy 0.05, trash 0.04, world 0.08, audio 0.00, ui 0.05).
- Allocation (V8 sampling heap profiler, 1 200 gameplay frames): ≈ 45 B/frame from the game modules (boxed doubles returned by `trash.surfaceAt`, a few robot/sale payload strings); the rest of the ≈ 96 B/frame sampled is debug.js's event trace (`?debug` only). No per-frame `new THREE.*`, arrays or closures.
- Hidden tab → paused (game time frozen), visible → resumes, one `app:resume`. Adaptive DPR steps 2 → 1.7 within 9 s when frames are slow; quality high pins DPR 2, low pins DPR 1 and the shorter item band.
- WebGL context loss: paused + saved; restore → running, picture correct; no restore within `render.glLostReloadS` (4 s) → saved and reloaded, state kept.
- Frame-rate independence: walking 1.5 s and hand-picking 4 s give identical results at 60 Hz and 30 Hz (`dt` integration everywhere; `dt` clamped at 50 ms, so below 20 fps the game slows rather than jumps).

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

**[implemented at integration]** `python3 tools/build.py` also drops indentation, blank lines and full-line `//` comments (`--no-min` keeps them): **437 KB** at integration, **469 KB** in v2 (503 KB unsqueezed at integration). `test/e2e/smoke.mjs --target tek | iframe | sandbox` plays the whole loop on `tek.html` wrapped the way the host does (doctype, charset, viewport-fit=cover meta, fragment in body), inside a plain `<iframe>`, and inside `<iframe sandbox="allow-scripts">` (opaque origin: no localStorage, the game runs without saving): all pass with no errors. The only external request is the three.js r128 script.

---

## 11. How the spike was measured

`node test/spike/run.mjs --three /path/to/three.min.js` serves the repo, routes the CDN URL to a local copy (or the network without `--three`), opens `test/spike/index.html?shots` at 1280 × 590 (iPhone landscape aspect) and 390 × 844, takes the screenshots in `test/spike/shots/`, runs the benches (`window.__spike.bench*`), and writes `test/spike/results.json`. Chromium flags: `--use-angle=swiftshader --enable-unsafe-swiftshader`. WebGL2 was used. `performance.now()` is coarsened to 0.1 ms there, so benches report totals divided by frames. `test/spike/index.html` without `?shots` is interactive (drag to look, WASD, Space sweeps) for a quick look on a phone.

---

## 12. Test recipe (`window.__ts`, Playwright)

**One command:** `node test/run-all.mjs` (economy unit tests, balance bot with the v2 timeline limits asserted, build, e2e smoke ×5, saving (`save.mjs`), forced landscape with real touch (`rot.mjs`), performance/robustness incl. no mid-game shader compiles, every module suite; the player/tools module tests run the upright portrait with `?dikey=1`); `--full` adds the touch play-through in both orientations (portrait = forced landscape) (`test/e2e/play.mjs --shots DIR` also writes screenshots); `--quick` is the short loop. `THREE_LOCAL=/path/three.min.js` runs offline. Headless rendering takes ~0.1 s per frame, so the e2e tests keep the loop manual and advance game time with `__ts.fast` between REAL touch events (CDP multi-touch); a rAF loop would clamp `dt` and stretch taps past the 220 ms tap threshold.

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
  fast(seconds, dt = 1/30, render = true) /* gameplay + ui updates without rendering each frame */,
  econ(), away(seconds), overlay(on), overlayData(),
};
// look() and stick() use player.look() / player.setStick() (added at integration)
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

Resolved at integration: the depth texture needs no float/half-float extension and defaults to RGBA8 (risk 2 below, format part); context loss is handled (restore or save + reload); the game runs in an iframe and in a sandboxed iframe.

Biggest technical risks on a real iPhone **[assumed, unverified]**:
1. **Sustained fill rate and heat.** The ground shader covers half the screen at DPR 2 with MSAA. A14 should hold 60 fps, but after 10–20 minutes thermal throttling can halve GPU clocks. Mitigation: adaptive DPR (floor 1.0). If that is not enough, drop the second trash-tile sample and the 4-tap rim beyond 25 m, and turn MSAA off below DPR 1.3.
2. **WebKit/WKWebView behaviour.** rAF runs at 30 Hz in Low Power Mode and in throttled iframes (the claude.ai artifact is an iframe). Memory pressure can kill or lose the WebGL context on backgrounding. Vertex texture fetch with LINEAR filtering on a LUMINANCE texture and `texSubImage2D` with `srcOffset` are in the WebGL2 spec and work in Chromium, but are untested on Safari's Metal-backed ANGLE. Fallback if needed: an RGBA8 depth texture, or NEAREST filtering plus manual bilinear in the shader.
3. **Per-frame buffer uploads.** Every frame with changes does one `texSubImage2D` plus up to 14 `bufferSubData` ranges (7 shapes × matrix/colour). On Metal-backed WebGL, writing a buffer the GPU is still reading can stall the pipeline. Ranges are small (cart: < 10 KB per frame), but if profiling shows stalls, double-buffer the instance attributes or upload every other frame.

Others: the near/far handover band (6.2–8.5 m) is visible as a softening of detail in screenshots, which is acceptable (widening it costs triangles). The aerial view shows neighbour districts at the same density as the district, so the finale camera lift should frame the clean district against them. Touch and audio inside the artifact iframe (gesture unlock, no pointer lock) are unverified. Open: whether economy simulates off-screen robots exactly or with `consume` (both supported by the API).
