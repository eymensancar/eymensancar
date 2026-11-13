// FAKE economy.js: coins, bag/tank, catalog from CONFIG.shop, boost, robots, sell points. Driven by window.__fk.econ.
let C = null, F = null;
export function init(ctx) {
  C = ctx;
  window.__fk = window.__fk || {};
  F = window.__fk.econ = { coins: 0, bag: 0, tank: 0, owned: {}, robots: [], boostLeft: 0, cdLeft: 0, canOffer: false, items: 0, earned: 0, playS: 0 };
  window.__fk.emit = (n, p) => ctx.bus.emit(n, p);
  window.__fk.ctx = ctx;
  ctx.bus.on('ui:buy', (p) => buy(p.id));
  ctx.bus.on('ui:adWatched', () => startBoost());
  // offline catch-up like the real economy would do on game:ready (runs before ui's handler: subscribed earlier)
  ctx.bus.on('game:ready', (p) => { const a = window.__FK_AWAY; if (a && p.awayS > 60) { F.coins += a.coins; window.__fk.trash.units -= a.units; } });
}
const lvl = (pref, max) => { let n = 0; for (let i = 1; i <= max; i++) if (F.owned[pref + i]) n = i; return n; };
export function update(dt) {
  if (F.boostLeft > 0) { F.boostLeft = Math.max(0, F.boostLeft - dt); if (F.boostLeft === 0) { F.cdLeft = 300; C.bus.emit('economy:boost', { active: false, left: 0 }); } }
  else if (F.cdLeft > 0) F.cdLeft = Math.max(0, F.cdLeft - dt);
  const p = C.mods.player.pose();
  if (Math.hypot(p.x - 39, p.z - 13) < 3) C.offer('shop', 'act_shop', 60, 'economy');
}
export function coins() { return F.coins; }
export function earn(n, reason) { F.coins += n; C.bus.emit('economy:coins', { coins: F.coins, delta: n, reason }); }
export function bagUnits(c = 'bag') { return c === 'tank' ? F.tank : F.bag; }
export function bagCapacity(c = 'bag') { return c === 'tank' ? C.CONFIG.cart.tank[lvl('cart_tank_', 1)] : C.CONFIG.bag.capacity[lvl('bag_', 3)]; }
export function bagSpace(c = 'bag') { return bagCapacity(c) - bagUnits(c); }
export function addToBag(u) { const a = Math.min(u, bagSpace()); F.bag += a; return a; }
export function stat(n) { if (n === 'broomWidth') return C.CONFIG.broom.widthM[F.owned.broom_w1 ? 1 : 0]; return 0; }
export function owned(id) { return !!F.owned[id]; }
export function catalog() {
  const items = C.CONFIG.shop.items;
  const out = items.map((it) => ({ id: it.id, price: it.price, state: F.owned[it.id] ? 'owned' : it.requires.every((r) => F.owned[r]) ? 'available' : 'locked', next: false, affordable: F.coins >= it.price, strName: it.strName, strDesc: it.strDesc }));
  let best = null; for (const o of out) if (o.state === 'available' && (!best || o.price < best.price)) best = o;
  if (best) best.next = true;
  return out;
}
export function buy(id) {
  const it = C.CONFIG.shop.items.find((x) => x.id === id);
  if (!it || F.owned[id] || F.coins < it.price) return false;
  F.coins -= it.price; F.owned[id] = true;
  C.bus.emit('economy:coins', { coins: F.coins, delta: -it.price, reason: 'buy' });
  C.bus.emit('economy:purchased', { id, price: it.price });
  if (/^robot_\d$/.test(id)) { F.robots.push({ id: 'r' + F.robots.length, x: 35, z: 13, yaw: 0, state: 'clean', load: 0, cap: 60 }); C.bus.emit('robot:added', { id }); }
  if (id === 'broom') { window.__fk.tools.available = ['hands', 'broom']; window.__fk.tools.current = 'broom'; C.bus.emit('tool:changed', { id: 'broom' }); }
  return true;
}
export function boostActive() { return F.boostLeft > 0; }
export function boostLeft() { return F.boostLeft; }
export function boostCooldownLeft() { return F.cdLeft; }
export function canOfferBoost() { return F.canOffer && F.boostLeft <= 0 && F.cdLeft <= 0; }
export function startBoost() { F.boostLeft = 120; C.bus.emit('economy:boost', { active: true, left: 120 }); }
export function robots() { return F.robots; }
export function sellPoints() { return [{ id: 'shop', x: 39, z: 13, r: 2.5, cartR: 3.5, active: true }, { id: 'dropoff', x: 3, z: 51, r: 2.5, cartR: 3.5, active: !!F.owned.dropoff }]; }
export function stats() { return { items: F.items, coins: F.earned, playS: F.playS }; }
export function save() { return null; }
export function load() {}
