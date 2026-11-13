# world.js: notes (owner: world)

Contract: `docs/MIMARI.md` §4.2. Test: `node test/world/run.mjs --three <three.min.js r128>` (python http.server on port 8741, fakes for trash/player/economy, 404 → stubs for tools/ui/audio/debug). Results: `test/world/results.json`, screenshots: `test/world/shots/`.

## What is implemented

All §4.2 exports, with the exact signatures: `init, update, save, load, layout, groundTexture, lighting, points, point, kindAt, outsideUnits, isBlocked, collide, segmentClear`. No other exports.

**Layout.** `kind` is built from `CONFIG.district` (blocks, kiosk) with the spike's rule. It holds 7 728 trash cells (6 480 street + 1 248 plaza; the kiosk takes 48) **[verified]**. `kindAt` is periodic outside the district, and the neighbour plaza counts as 0 there. `buildings` holds 410 AABBs `{x0,z0,x1,z1,h,blockId}`:
- 24 home lots, `blockId` = `nw` / `sw` / `se`;
- neighbour lots, `blockId` = `nw@-1,0` and so on;
- 34 skyline towers, `blockId` = `skyline`.

The kiosk is not in `buildings`; it is solid through `kind` and collision. Every home lot footprint is `kind 0`, and no neighbour lot overlaps the district **[verified]**.

**Collision.** Solids are the 3 home building blocks and the kiosk, plus the drop-off container while it is owned. Bounds are [0, 54]².
- `collide` pushes a circle out of AABBs (3 iterations) and clamps it to the bounds.
- `isBlocked` tests the circle against the AABBs and the bounds.
- `segmentClear` is an exact swept-circle test: Liang–Barsky against each box, plus the distances between the corners and the segment and between the endpoints and the box.
- None of them allocates. Cost: `collide` 0.11 µs, `segmentClear` 0.47 µs, `outsideUnits` 0.11 µs **[verified, desktop Chromium]**.

**outsideUnits(i, j).** A deterministic hash giving 1, 2, 2 or 3 (mean 2.005, which matches the far layer's constant `outUnitsShader: 2`), and 0 under neighbour buildings.

**Ground texture.** A 1024² canvas, `flipY = false`, mipmapped, anisotropy ≤ 8. It holds:
- asphalt with grain, patches, cracks and oil stains;
- 1.5 m pavements around every block with slab joints and rounded corners;
- a painted kerb stone and gutter line (kerbs are paint only: §2 says the ground is flat), and drains;
- dashed centre lines;
- zebra crossings and stop lines on every arm of every crossing;
- the plaza in warm stone tiles with a terracotta border and a star mosaic;
- painted dashed circles at both sell zones (the drop-off one hatched).

**City mesh (1 draw call, `MeshLambertMaterial`).** It holds the buildings, props, kiosk, barriers, billboard frame and (in the drawRange tail) the drop-off container. It uses the 1024² canvas atlas with an `onBeforeCompile` patch: `uv` is in tile units, a per-vertex `atlas` attribute gives the region, and `fract()` tiles inside it. Gradients for `textureGrad`/`texture2DGradEXT` come from the unwrapped uv, so tile seams do not drop to the lowest mip.

The atlas has:
- 6 upper-floor styles: shutters with flower boxes, balconies, brick, office ribbon windows, classic arched, modern with colour panels;
- 4 ground-floor styles: shopfronts with pictogram signs (no text), cafe/florist, residential doors, brick with a roller shutter;
- roofs (clean at home, trash-covered for neighbours: the "roofTrash" idea), striped awnings, the barrier pattern, the kiosk front, signs, the billboard art, clouds and icons.

Buildings and details:
- Facades are 2–3 quads per face: storefront (3.6 m), upper floors (3 m each) and a cornice. They get vertex tints from 9 pastels and a darker band at the base as cheap ambient occlusion.
- Interior faces between lots are emitted only above the lower neighbour.
- The second neighbour ring and the skyline use one quad per face.
- Home lots have rooftop AC units, stair huts and water tanks, and striped awnings over the shopfronts (aligned with the painted windows).

Props:
- 56 lamp posts, on the home pavements and the near side of the neighbour boulevards beyond the barrier;
- bins at block corners;
- 4 benches and 4 low-poly trees on the plaza;
- the robot dock post with a robot badge;
- the kiosk: front texture, roof slab, awning, "DÜKKAN" sign board on both sides;
- a 17 m pylon with a gold coin disc (4 crossed fans), the shop's landmark seen over the rooftops;
- red and white water barriers all round the district, and "YAKINDA" boards at every street end except the one where the container stands;
- the promo billboard, 6 × 3 m on the SE block, facing the plaza.

**Glow mesh (1 call, `MeshBasicMaterial`, unlit).** Sign faces, lamp bulbs (off colour, then warm on the "streetlights" event), the coin and drop-off discs, and the robot badge. The container's sign and its 8.5 m beacon with an orange round drop-off sign sit in the drawRange tail.

**Sky (1 call).** A vertex-coloured dome (radius 440, below the far plane of 480) with:
- horizon = fog colour `#cdd7dc`, rising to `#8dbbe7` and then to a `#4d8ddb` zenith;
- 14 soft cloud sprites;
- a sun glow at `sunDir`.

It is transparent, `fog: false`, `depthWrite: false`, `renderOrder -10`, so it is drawn first in the transparent pass and only where nothing opaque was drawn. It follows the camera in `update`.

**Lights.** `HemisphereLight(#c4daf0, #a8987f, 0.62)` + `DirectionalLight(#fff1d8, 0.74)` from `sunDir = (-0.42, 0.78, -0.46)`. The sun is in the north-west, behind the player at the start, so the facades seen at the start are sunlit. `scene.fog = Fog(#cdd7dc, 30, 230)`, `scene.background = fogColor`. `lighting()` returns the same object every call, with the colours already multiplied by intensity.

**Markers (1 call, transparent `MeshBasicMaterial`, DoubleSide, polygonOffset).**
- Sell-point rings (radius `r`, or `cartR` when the player is mounted) are re-seated on `trash.surfaceAt` at 4 Hz, so they never float over cleaned ground. Their opacity pulses gently, and strongly while the bag is full.
- The guide arrow is 3 sliding chevrons 0.22 m above the trash surface in front of the player, pointing at the first waypoint of a route to the nearest active sell point. Routing tries straight, then via one or two waypoints (the 9 crossing centres + 4 kiosk corners; their pairwise clearance is precomputed).
- Lamp halos are drawn only once the streetlights event has fired (drawRange start).

**Life (1 InstancedMesh of a unit box, only visible while something is active).**
- 14 birds circling over the plaza, with flapping wings (from the 25 % milestone).
- 12 pedestrians walking loops on the pavements around the blocks, standing on `trash.surfaceAt` (from 75 %).
- A pool of 140 confetti pieces. Each milestone gives a plaza burst plus a smaller burst in front of the camera. The finale (`district:cleaned` or the 100 % milestone) turns on every event and fires 4 more plaza bursts. `economy:finalSweep` blows a gust of leaves past the camera.

**Save.** `{ v: 1, ev: bits }` (birds 1, streetlights 2, pedestrians 4, finale 8). `load` restores the events silently. On `game:ready` the events are also synced from `trash.cleanFraction()` against `CONFIG.milestones`, in case the world save is missing.

**Language.** Sign texts come from `ctx.t()`: `sell_shop`, `sell_dropoff`, `barrier_soon`, `promo_title`, `promo_yikim`, `promo_sayiyolu`. They are upper-cased with the Turkish locale. When `state.settings.lang` changes (checked at 1 Hz on real time, so it also works while paused), the sign regions are repainted and the atlas is re-uploaded once.

**Points.**

| id | x, z | r | yaw | notes |
|---|---|---|---|---|
| `spawn` | 39, 17 | 0.35 | π | |
| `shop` | 39, 13 | 2.5 | π (kiosk faces south) | |
| `dropoff` | 3, 51 | 2.5 | π/2 (container faces east) | |
| `dock` | 35, 13 | 0.7 | | |
| `cartPark` | 39, 20 | 2.0 | π | |
| `billboard` | 39, 29.7 | 3 | 0 (faces north) | extra field `y: 6.1` |

## Sözleşme sorunları (for the integrator)

1. **Drop-off container vs `kind`.** §4.2 says that `kind` 0 includes the "container". CONFIG's `trashCellsExpected: 7728` counts the cells at the drop-off as trash, and `kind` is fixed at init (trash builds its zones from it), while the container only appears on purchase. Closest reading: the container stands **just outside the walkable bounds** (x ∈ [-2.6, -0.6], behind the west barrier at the SW crossing). It never covers a trash cell; its sign faces the district and is raised above the barrier. It is in the collision list while owned, but that list is moot outside the bounds. The sell zone (3, 51, r 2.5) is reachable from inside.
2. **Small props are not solid.** Lamp posts, trees, bins and benches are not solid, because §4.2 lists only buildings, kiosk and container. The player and cart pass through poles and trunks. If that reads badly, add thin AABBs, but they would also block robots and the cart swath. This is a design decision.
3. **The guide arrow when mounted.** The contract says "shown while `economy.bagSpace() === 0`". When `player.mounted()` is truthy, world checks `bagSpace('tank')` instead (otherwise the arrow could never appear in the cart). It also requires `bagCapacity(container) > 0`, so an economy stub (capacity 0) shows nothing.
4. **Lighting is static.** The trash core copies `lighting()` once at creation, so world never changes the lights at runtime. The "streetlights" event only lights bulbs and halos; there is no time of day.
5. **Partial-build fallback.** When `trash` is a stub (only then), world adds a flat ground plane with `groundTexture()` (+2 draw calls) and warns once, so a build without trash.js still has a ground. With the real trash module this never happens.
6. **`points()` and `buildings` extras.** The `billboard` point has an extra `y` (the board centre height) for ui's tap/projection. `buildings` includes the far skyline towers (`blockId 'skyline'`); filter them if you only want the neighbour districts.

## Tunables

`VIS` at the top of `world.js` holds visual numbers only (not balance, so they are not in config.js):
- texture sizes;
- pavement and kerb widths;
- floor heights and tile size;
- neighbour heights;
- skyline count, radius and heights;
- lamp, pylon and beacon sizes;
- fog 30/230 (from §4.2);
- light colours, intensities and direction; sky colours;
- ring width, colours and alpha;
- arrow size, lift and speed;
- birds, pedestrians and confetti counts.

The milestone confetti life is `CONFIG.feedback.milestoneConfettiS`.

## Verified vs assumed

Verified (headless Chromium + SwiftShader; `test/world/run.mjs` passes every check, `results.json`):

**API.**
- 7 728 trash cells and 1 248 plaza cells.
- `kindAt` inside and periodic outside.
- `isBlocked`, `collide` (including corners, bounds and centre-inside push-out), `segmentClear` (including radius clearance).
- `outsideUnits` is deterministic, has mean 2.0 and is 0 under buildings.
- All 6 points, `point('nope') === null`.
- `lighting()` field types; ground texture `flipY false` and mipmapped; fog 30–230.
- No console errors or page errors.

**Budget.** World draws **5 calls** and **12 456 triangles**, with life fully active (218 instances). Per mesh:

| Mesh | Triangles |
|---|---|
| city | 8 230 |
| glow | 564 |
| markers | 374 |
| sky | 672 |
| life | 12 × instances |

- Whole frame with the spike trash: 12–13 calls and 48–90 k triangles in all 19 test views (budget 40 / 150 k).
- Textures: atlas 1024² + ground 1024² ≈ 11.2 MB with mips. Together with trash (≈ 1.5 MB + 2.8 MB instance buffers), about 15.5 MB of the 24 MB budget.

**Per-frame JS of `world.update`.**
- 0.03–0.055 ms (two runs) with every system active: rings re-seated at 4 Hz, arrow every frame, birds, pedestrians, 140 confetti.
- 0.014 ms with events on and no confetti.
- No allocations in `update` and in the collision functions: typed arrays and scratch objects only. By reading the code, not by profiling.

**Init.** 174–472 ms across test runs (painting two 1024² canvases + building the geometry), once at boot.

**Screenshots looked at** (`test/world/shots/`):
- eye height: 01 start, 02 kiosk, 03 street, 04 west edge, 05 crossing, 06 skyline, 18 and 19 sightlines;
- cleaned ground: 07, 08, 09;
- guide arrow 10, drop-off 11, city events 12, billboard 15, English signs 20;
- aerial 13, finale high 14;
- portrait 16, 17.

Assumed / not verified:
- Real-device fps and GPU cost. SwiftShader is not representative. The atlas patch adds one `textureGrad` per fragment on facades, and the city is drawn after the opaque trash ground (three sorts opaques front-to-back per object, the ground is one object). Overdraw from buildings over the ground is expected to be low.
- `textureGrad` on Safari/WebKit WebGL2 is assumed. On WebGL1 without `EXT_shader_texture_lod` the shader falls back to `texture2D`: seams may show a 1-pixel line at tile edges.
- Canvas text uses system fonts ("Arial Black", falling back to Arial and sans-serif). On iOS the look is assumed to be similar to the headless Linux fonts.

## Known weak points

- The shop landmark (the gold coin at 17 m) is visible down the streets that open onto the plaza (shot 18) but not from inside every street canyon (shot 19). Buildings are 12–24 m tall per CONFIG. The guide arrow and ui's compass cover the rest.
- Clouds and halos have slightly dark fringes at low mip levels. The canvas is not premultiplied, so transparent texels are black. This is barely visible.
- Ground texture density is about 19 px/m: cleaned asphalt is soft at the feet (shots 07, 10). It is fine at eye height.
- Pedestrians walk through lamp posts and bins, and birds circle only over the plaza.
- The neighbour districts reuse the same facade styles: the aerial view looks repetitive at the second ring (heavily fogged).
- Confetti and leaves use `Math.random`, so they are not deterministic (visual only).
