// FAKE tools.js: current tool + offers (pick/sweep/enter/exit/nozzle) from window.__fk.tools.
let C = null, F = null;
export function init(ctx) {
  C = ctx;
  window.__fk = window.__fk || {};
  F = window.__fk.tools = { current: 'brush', available: ['brush'], nozzle: true, nearCart: false };
  ctx.bus.on('ui:tool', (p) => { if (F.available.includes(p.id)) { F.current = p.id; ctx.bus.emit('tool:changed', { id: p.id }); } });
  ctx.bus.on('ui:offer', (p) => {
    if (p.owner !== 'tools') return;
    const pl = ctx.mods.player;
    if (p.id === 'nozzle') { F.nozzle = !F.nozzle; ctx.bus.emit('tool:nozzle', { down: F.nozzle }); }
    if (p.id === 'enter') { pl.mount({ id: 'cart' }); F.current = 'cart'; }
    if (p.id === 'exit') { pl.dismount(); F.current = 'brush'; }
  });
}
export function update() {
  const m = C.mods.player.mounted();
  if (m) { C.offer('nozzle', F.nozzle ? 'act_nozzle_up' : 'act_nozzle_down', 90, 'tools'); C.offer('exit', 'act_exit', 80, 'tools'); return; } // integration: nozzle on the big button
  if (F.nearCart) C.offer('enter', 'act_enter', 70, 'tools');
  if (F.current === 'brush') C.offer('brush', 'act_brush', 10, 'tools');
  if (F.current === 'broom') C.offer('sweep', 'act_sweep', 5, 'tools');
}
export function current() { return F.current; }
export function available() { return F.available; }
export function equip(id) { F.current = id; return true; }
export function save() { return null; }
export function load() {}
