// TEST FAKE of www/js/economy.js: bag/tank, coins, ownedSet items, auto-sell at the shop. Not the real module.
let ctx, C, coinsN = 0, bagLevel = 0;
const ownedSet = new Set();
const cont = { bag: { units: 0, byType: null }, tank: { units: 0, byType: null } };
const bagEv = { container: 'bag', units: 0, cap: 0 }, fullEv = { container: 'bag' };
export const log = { added: 0, sold: 0, full: 0 };
export function init(c) {
  ctx = c; C = c.CONFIG; const nt = C.trashTypes.length;
  cont.bag.byType = new Int32Array(nt); cont.tank.byType = new Int32Array(nt);
  window.__fakeEco = { give(n) { coinsN += n; }, own(id) { ownedSet.add(id); if (id.startsWith('bag_')) bagLevel = Math.max(bagLevel, +id.slice(4)); ctx.bus.emit('economy:purchased', { id, price: 0 }); }, empty(k = 'bag') { cont[k].units = 0; }, fill(k = 'bag') { cont[k].units = bagCapacity(k); }, log, state: () => ({ coins: coinsN, bag: cont.bag.units, tank: cont.tank.units, ownedSet: [...ownedSet] }) };
}
export function update() {
  const ps = ctx.mods.player.pose(), sp = C.sellPoints[0], r = ps.mounted ? sp.cartRadiusM : sp.radiusM;
  if (Math.hypot(ps.x - sp.pos[0], ps.z - sp.pos[1]) < r) for (const k of ['bag', 'tank']) {
    const c = cont[k]; if (!c.units) continue;
    const v = c.units * 2; coinsN += v; log.sold += c.units;
    ctx.bus.emit('economy:sold', { pointId: 'shop', units: c.units, coins: v, byType: c.byType, valuable: false, x: sp.pos[0], z: sp.pos[1], by: 'player' });
    c.units = 0; c.byType.fill(0); emitBag(k);
  }
}
function emitBag(k) { bagEv.container = k; bagEv.units = cont[k].units; bagEv.cap = bagCapacity(k); ctx.bus.emit('economy:bag', bagEv); }
export function coins() { return coinsN; }
export function earn(n) { coinsN += n; }
export function bagUnits(k = 'bag') { return cont[k].units; }
export function bagCapacity(k = 'bag') { return k === 'tank' ? C.cart.tank[0] : C.bag.capacity[bagLevel]; }
export function bagSpace(k = 'bag') { return Math.max(0, bagCapacity(k) - cont[k].units); }
export function addToBag(units, byType, k = 'bag') {
  const take = Math.min(units, bagSpace(k)); if (take <= 0) return 0;
  cont[k].units += take; for (let i = 0; i < byType.length; i++) cont[k].byType[i] += byType[i]; log.added += take;
  emitBag(k);
  if (bagSpace(k) === 0) { fullEv.container = k; log.full++; ctx.bus.emit('economy:bagFull', fullEv); }
  return take;
}
export function stat(name) {
  switch (name) {
    case 'bagCapacity': return bagCapacity('bag');
    case 'broomWidth': return C.broom.widthM[ownedSet.has('broom_w1') ? 1 : 0];
    case 'broomSweepSpeed': return C.broom.sweepSpeed[ownedSet.has('broom_s1') ? 1 : 0];
    case 'brushWidth': return C.brush.widthM[ownedSet.has('brush_w1') ? 1 : 0];
    case 'brushSweepSpeed': return C.brush.sweepSpeed[ownedSet.has('brush_w1') ? 1 : 0];
    case 'walkSpeed': return C.player.walkSpeed[ownedSet.has('shoes_1') ? 1 : 0];
    case 'cartCleanSpeed': return C.cart.cleanSpeedMax[0];
    case 'cartNozzleWidth': return C.cart.nozzleWidthM[ownedSet.has('cart_width_1') ? 1 : 0];
    case 'cartTank': return C.cart.tank[0];
    default: return 0;
  }
}
export function owned(id) { return ownedSet.has(id); }
export function sellPoints() { return C.sellPoints.map((s) => ({ id: s.id, x: s.pos[0], z: s.pos[1], r: s.radiusM, cartR: s.cartRadiusM, active: true })); }
