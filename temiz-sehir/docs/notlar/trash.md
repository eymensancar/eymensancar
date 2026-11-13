# trash.js: notes (owner: trash)

File: `www/js/trash.js` (≈1 440 lines, no imports, exports only `export function`). Tests: `test/trash/` (`node test/trash/run.mjs [--three /path/three.min.js] [--no-shots]`). Results: `test/trash/results.json`. Screenshots: `test/trash/shots/`.

## What is implemented

- **The architect's core, adopted and productionised** (`createCore`, copied from `test/spike/trash-core.js`). The mechanics are unchanged: one grid (the source of truth), one far-layer ground mesh, a toroidal 36 × 36 near window, 7 instanced shapes, dirty-row `texSubImage2D`, swap-remove dense lists, hash(cell, k) determinism, RLE+base64 save (`g1.<N>.<K>.<layoutHash>.<b64>`). Changes:
  - The depth texture is now **LuminanceAlpha**. L = units, A = a "cleaned" flag (255 where a cell that started dirty is now 0), and A fades in with the cell. The ground shader uses A for the **washed look**: the ground is lighter (`base·1.5 + 0.045`), and a **wet sheen** reflects the sky at grazing angles (fresnel⁴ × sky × 0.55). The sheen is what makes the trail read from 30 m and more (shot 07). The grime rim has two parts: a narrow band at the trash edge, taken from the bilinear depth, and a faint wide halo (0.4). Before this change the rim covered the whole 1 m broom strip and the trail read as dark dirty asphalt (compare spike shot 05 with shot 03 here).
  - **Juice** is driven by hooks in `takeFromCell`, so it shows exactly the items removed:
    - Removed items that were visible (in the window and closer than 8.5 m) fly in the **same instanced meshes**. They are written after the static items of their shape each frame, so they cost 0 extra draw calls. Pool: 160 items, at most 40 spawned per frame, 12 ms stagger.
    - Each flying item starts from its exact resting pose. It pops up (hop), then accelerates into the collector over `CONFIG.feedback.pickupArcS` (±15 %), spinning and shrinking to 0.
    - Collectors: hands go to a camera-local hand point. The broom goes to the bag at the hip and follows the player (yaw frame; TASARIM: "flies into the bag"). The cart goes to the intake (the stroke end), spiralling. A robot goes to the circle centre or segment end. `final` makes a gust that lifts the items and blows them away. `debug` and `consume` have no juice.
    - **Dust puff**: one `Points` cloud with a procedural soft disc (no texture). Pool of 96, at most 8 per frame. It rises from each cell that becomes clean within 16 m, and is drawn only while puffs are alive.
  - Candidate buffers cover the whole grid. The spike's 4 096 cap dropped cells silently when the radius was large. Small sets use an insertion sort and large ones a packed-key typed sort. The order is deterministic (distance or stroke t, then cell index).
  - Instance upload ranges are merged until a render consumes them. Before, a second `update()` before the next render overwrote the pending range.
  - `deserialize` refuses truncated data and does not half-apply it. Load never adds trash: it uses `min(saved, initial)`.
  - Shapes with 0 instances are set `visible = false`, so they cost no empty draw calls.
- **Generator** (`genDistrict`, from the spike reference, driven by `CONFIG.trashGen` and `world.layout().kind`): **7 728 trash cells, 13 446 units, mean 1.7399, 14 piles** [verified]. Zones: street, plaza, and pile (pile wins inside a pile radius). The type mix comes from `CONFIG.zoneMix`. A valuable **replaces** the rolled type with probability `valuableChance[zone]` (exact; the spike renormalised instead).
- **API**: everything in MIMARI §4.3, mapped onto the core, with `by` bookkeeping and the values of `CONFIG.trashTypes`.
- **Events**:
  - `trash:changed` is sent at most once per frame, only when units changed: `{units, cells, cleaned, by: {hands, broom, cart, robot, final, debug}, fraction}`. It is a reused payload.
  - `trash:milestone {index, at, fraction}` fires once per `CONFIG.milestones` entry, in order, followed by `game:saveNow`.
  - `district:cleaned {playS}` fires with the 1.00 milestone. `playS` comes from `economy.stats().playS` if economy is real, otherwise from `ctx.time.game`.
  - `trash:loaded {exact}` fires after every `load()`.
- **Final-sweep rule** (design: 98.5 % → clear the stragglers → 100 %). Economy owns the sweep and the payout (MIMARI §4.6). Trash adds a **safety net**: if nobody has emptied the district `finalSweepS + 3` s of game time after `cleanFraction ≥ finalSweepAt`, trash calls `clearAll('final')` itself. That sweep is unpaid, and trash warns once if economy is a real module. Measured: 7.0 s after the threshold with the stub economy.
- **Save**: `{ g, ms }`. `ms` is the highest milestone index reached (−1 = none). On load, milestones that were already passed are not celebrated again. A save without `ms` counts the milestones its grid shows. A corrupt save gives a fresh district with a warning. A save from another layout or K is applied best-effort with `exact: false`.
- **Guards**: every API accepts any input without throwing:
  - Non-finite coordinates or radii return an empty result, `-1` or `null`.
  - `maxUnits`: `undefined`, `null`, `Infinity` or ≥ 1e9 mean unlimited. `NaN`, ≤ 0 or a non-number mean nothing. Fractions are floored.
  - Radii and half-widths are clamped to 120 m, and very long strokes are clamped.
  - An out-of-range index gives −1 or an empty result.
  - An unknown `by` is counted as `debug` (warned once).
  - Calls made before `init` return the empty or stub value.

## Sözleşme sorunları (for the integrator)

1. **Who draws the removal juice.** MIMARI §4.5 gives "flying copies of picked items, dust puffs" to tools. My brief gives "items pop/fly toward the collector, a brief dust puff" to trash. I implemented it in trash because it is cheaper there: the items fly inside the existing 7 instanced meshes (0 extra calls), and they are exactly the items removed. **tools.js should therefore not also spawn flying copies or cell dust for removals made through trash, or they will show twice.** Tools keeps the broom stroke dust (`dustPuffEveryS`), the view model and the sale arc into the bin; `itemGeometry`/`itemMaterial` stay exported for those. Robot collectors are inferred from the call: the circle centre or the segment end. Suggestion: write this split into §4.3/§4.5.
2. **Draw calls.** Trash is 8 at rest, as budgeted. While dust puffs are alive (≈0.5 s after a cell is cleaned near the camera) it is **9**, one over the §9 share. Tools' share for dust could shrink by one to compensate.
3. **Extra exports**, not in §4.3 or in the stub:
   - `removeCell(idx, maxUnits, by)` empties one cell. It suits robots that work per cell: `nearestDirty` gives the cell, `removeCell` takes it. Proposal: add it to §4.3 and `makeStubs`. Until then, economy must check that it exists. The alternative is `removeInCircle(cellCenter, r ≥ 0.36)`: with `r < 0.25` an off-centre robot takes nothing, because the rule is "cell centre within r".
   - `debugInfo()` is read-only and for tests and debug only.
4. **TrashResult has one more field, `value`**: coins at base price, Σ byType × `trashTypes[].value`. It is a convenience; economy may ignore it and keep its own pricing (boost, multipliers).
5. **Default `by` when omitted** (not specified):
   - `removeInCircle` / `removeAlongSegment`: `debug`
   - `pick`: `hands`
   - `consume` / `removeCell`: `robot`
   - `clearAll`: `final`

   Callers should always pass `by`.
6. **`pick` removes the top item of the nearest cell**, judged by that top item's position, as in the spike. A tap on a lower item of a 4-deep cell takes that cell's top item instead. The flying item starts from the top item's real pose, so what is seen and what is reported agree. Precision is at cell level (0.5 m).
7. The depth texture is LuminanceAlpha now, so §13 risk 2 (vertex texture fetch with LINEAR on an unsized luminance format on Safari) applies to LA as well. The fallback is the same: RGBA8, or NEAREST plus manual bilinear.
8. The §8 claim that a fresh save is "a few bytes" does not hold: it is 157 B (runs are capped at 255 cells). A carved district is about 1.2 KB. The format is the contracted `g1` and was not changed.
9. Init order: `trash.init` runs before `player.init`, so the camera is still at the origin then. The near window is rebuilt in `load()`, after the player has placed the camera. Nothing to change; noted because `load()` must keep running after all inits (it does in main.js).

## Tunables (`LOOK` in trash.js; engine look, not design data)

- `cleanGain 1.5`, `cleanLift 0.045`, `cleanSheen 0.55`: the washed and wet look of cleaned ground.
- `rimHalo 0.4`: the wide grime halo.
- `cleanFadeMul 1.6`: the clean flag fades over 1.6 × `cellCleanFadeS`.
- Flying items:
  - `flyMax 160`, `flySpawnPerFrame 40`, `flyStagger 0.012`
  - `flyHop` and `flySwirl` per remover
  - `flyDurRobot 0.34`
  - `handOffset`, `bagOffset`, `collectY`
  - `gustDur`, `gustDist`, `gustRise`
- Dust: `dustMax 96`, `dustPerFrame 8`, `dustLife 0.55`, `dustRange 16`, `dustColor`, `dustAlpha 0.38`.
- From the core: `nearHalf 18`, `fadeStart 6.2`, `fadeEnd 8.5`, `layerHeight 0.30`, `tileMeters`, `bump`, the mesh rings.
- Design data read from CONFIG: `trashGen`, `trashTypes`, `zoneMix`, `valuableChance`, `feedback.cellCleanFadeS`, `feedback.pickupArcS`, `milestones`, `completion.finalSweepAt`, `completion.finalSweepS`, `district`.

## Verified (headless Chromium + SwiftShader, desktop CPU; `test/trash/run.mjs`, all 56 checks pass)

The real main.js, config.js, bus.js and trash.js run with a fake world (`test/trash/fake-world.js`, the spike's reference layout). Every other module is main's stub.

- **Generator**: 7 728 cells, 13 446 units, mean 1.7399. **Determinism**: a second page load gives the same grid hash and the same type of every item (`b48ebe05` / `25d2dc78`).
- **Every removal API** was checked, with these removers:
  - `removeInCircle`, unlimited and capped at 5
  - `removeAlongSegment` as broom and as cart
  - `removeCell`, `pick`, `consume`

  For each one these values agree with an independent recount of the raw grid:
  - units removed;
  - Σ byType = units, and value = Σ byType × type value;
  - clean cells and clean fraction.

  **Visible = reported**: the drop in instance count per shape equals the shape histogram of the reported items, for every call whose cells are in the window.
- **Events**:
  - `trash:changed` is sent once per frame, and its `by` aggregates match the removals.
  - Milestones 25/50/75 fire once each, in order.
  - The safety net clears the district 7.0 s after 98.5 %; `by.final` equals the units left.
  - The 100 % milestone and `district:cleaned` fire exactly once.
- **Save → load round trip** restores the grid hash, totals, clean fraction, clean cells and block sums.
  - Save 0.1 ms, load 2.4 ms; carved save 1 201 B, fresh 157 B.
  - Load celebrates nothing.
  - A corrupt save gives a fresh district; a foreign layout loads with `exact: false`.
- **Guards**: NaN, ±Infinity, −1, strings, objects, null and huge values on every argument. Nothing throws, and nothing is removed except where the value is legal (−1 m is a legal coordinate; Infinity units = unlimited).
- **Per-frame JS cost** (removal calls + `trash.update`, mean of 300 frames; half the cells inside the item window, half anywhere):

  | changed cells / frame | ms / frame | of which update | rows uploaded | flying items |
  |---|---|---|---|---|
  | 0 | 0.002 | 0.002 | 0 | 0 |
  | 20 | 0.029 | 0.018 | 106 | ≤ 80 |
  | 100 (97 effective) | 0.097 | 0.044 | 108 | 160 (pool full) |
  | 100, no juice | 0.073 | 0.039 | 108 | 0 |
  | broom walking | 0.021 | | | |
  | cart driving | 0.024 | | | |

  - Teleport (full window rebuild): 0.9 ms once.
  - `nearestDirty`: 0.001 ms.
  - `consume` of 2 000 units: 1.1 ms.
  - `clearAll`: 0.8 ms.
  - Budget §9 for trash: 0.3 ms on device. These are 3–10× under it here; WebKit is assumed to be ≤ 2× slower.
- **Render**: start view (plaza) 85.8 k triangles, 2 341 near instances. Trash makes 8 draw calls at rest and 9 while dust lives; the fake world adds 2.
- **Screenshots, inspected**:
  - `01`/`02`: before, eye height and aerial.
  - `03`/`04`: after a broom trail, a wavy stroke, a robot lawnmower patch and a cart swath, eye height and aerial.
  - `05`: the robot patch at eye height, clean with its dirty edge.
  - `06`: trench walls at the feet.
  - `07`: the trail reads to about 45 m from the street end.
  - `08`, `08b`/`08c`: items popping up toward the bag, and dust.
  - `08d`: hand picks.
  - `09`: portrait.
- No page errors. The only console warnings are the ones the guard tests provoke on purpose.

## Assumed / not verified

- Real fps and JS cost on an iPhone (WebKit JIT, Metal ANGLE): none of the numbers above come from a device.
- LuminanceAlpha vertex texture fetch with LINEAR filtering on Safari (risk §13.2).
- Point-sprite size limits on iOS: dust sprites are at most about 0.9 m and should be far below the limit.
- That the juice feels right in motion. Only still frames were looked at. Hand-pick flights end below the frame at pitch −30°, where the hand point sits, so tools' view model must sit near `LOOK.handOffset` or the offset should be tuned.
- Interaction with the real world.js. It was tested against the spike's reference layout copied into the fake. If world's `kind` differs, the generator warns (cell count ≠ 7 728).

## Known weak points

- With a sweep of more than about 40 items in one frame (cart on 4-deep piles, `clearAll`), the extra items vanish without flying. With 100 changed cells per frame the 160-item pool is full; the oldest are replaced.
- For 0.2 s after a cell is cleaned, the far layer's painted tile is still visible where the 3D items were. This is the designed `cellCleanFadeS` fade, but if the fade is lengthened it reads as "items turned into a picture".
- The gust for the final sweep only animates items within 8.5 m of the camera; the rest of the district fades in 0.2 s. World's finale and economy's sweep effect have to carry that moment.
- At aerial distance the 1 m broom trail is about 3 px wide and reads as a dark line, not a light one. The sheen only helps at grazing angles (eye height). The cart swath and robot patches read clearly.

## Integration (phase 3)

Every contract issue above was decided at integration; the decisions and the defects found in the real game are in `docs/BIRLESTIRME.md`, and `docs/MIMARI.md` now matches the code. Tunables listed above now live in `www/js/config.js`.
