// TEST FAKE of economy.js for world tests: bag state and ownership driven by window.__fakeEco.
let C = null;
const S = { space: 10, cap: 15, owned: {} };
export function init(ctx) { C = ctx; window.__fakeEco = S; }
export function update() {}
export function bagSpace() { return S.space; }
export function bagCapacity() { return S.cap; }
export function owned(id) { return !!S.owned[id]; }
export function sellPoints() {
  return C.CONFIG.sellPoints.map((p) => ({ id: p.id, x: p.pos[0], z: p.pos[1], r: p.radiusM, cartR: p.cartRadiusM, active: !p.unlockId || !!S.owned[p.unlockId] }));
}
