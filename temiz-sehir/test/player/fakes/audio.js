// TEST FAKE of www/js/audio.js: counts the events player/tools emit (with frame and time) for latency checks.
export const log = {};
export function init(ctx) {
  for (const n of ['tool:collect', 'tool:swing', 'tool:changed', 'tool:nozzle', 'tool:full', 'player:step', 'player:mount', 'player:dismount', 'input:tap', 'economy:bagFull', 'economy:sold']) {
    log[n] = [];
    ctx.bus.on(n, (p) => { log[n].push({ f: ctx.time.frame, t: performance.now(), units: p && p.units, tool: p && p.tool, valuable: p && p.valuable, x: p && p.x, y: p && p.y }); });
  }
  window.__fakeAudio = { log, clear() { for (const k in log) log[k].length = 0; } };
}
export function update() {}
export function play() {}
export function setEnabled() {}
export function unlocked() { return true; }
