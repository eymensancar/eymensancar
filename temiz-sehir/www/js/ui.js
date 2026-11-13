// ui.js — HUD, context button, tool buttons, shop panel, toasts, hints, milestone/complete cards, compass,
// sell-point indicator, settings, mock ad, "while you were away" card, haptics, debug overlay.
// Owner: ui. Contract: docs/MIMARI.md §4.7, §4.9, §6, §7. Notes: docs/notlar/ui.md.
//
// DOM only (no THREE meshes). Reads other modules through ctx.mods getters, writes the DOM only when a shown
// value changes, animates with transform/opacity only. Layout is read (getBoundingClientRect) on resize only.
// Player-facing text only through ctx.t() (STR in config.js).

// ------------------------------------------------------------------------------------------ tunables
// Every number is CONFIG.ui (plus CONFIG.robot.colors/names, CONFIG.offline, CONFIG.feedback); every text is STR.

// ------------------------------------------------------------------------------------------ icons
// One consistent set: 24 × 24, chunky filled shapes, currentColor (coin is the only multi-colour icon).
const ICON = {
  coin: '<circle cx="12" cy="12" r="10.2" fill="#f7a81b"/><circle cx="12" cy="12" r="10.2" fill="none" stroke="#b86a00" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="#ffd451" stroke="#e5920a" stroke-width="1.5"/><path d="M12 8.6v6.8M9.8 10.2h4.4" stroke="#d9860a" stroke-width="1.8" stroke-linecap="round"/><path d="M5.6 9.2a7 7 0 0 1 4-4" stroke="#fff3b8" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  bag: '<path d="M8.2 3.5h7.6l-1.5 3.3c3.5 1.5 5.7 5 5.7 8.5 0 3.4-2.9 5.2-8 5.2s-8-1.8-8-5.2c0-3.5 2.2-7 5.7-8.5z" fill="currentColor"/><path d="M8.8 7.4h6.4" stroke="rgba(0,0,0,.35)" stroke-width="1.7" stroke-linecap="round"/>',
  hand: '<path d="M7.2 11.6V6.4a1.6 1.6 0 0 1 3.2 0v4.4V4.2a1.6 1.6 0 0 1 3.2 0v6.6V5.3a1.6 1.6 0 0 1 3.2 0v6.5V8.3a1.6 1.6 0 0 1 3.2 0v6.9c0 3.9-3.1 6.9-7 6.9-2.6 0-4.5-1.1-5.9-3.2l-3.3-5a1.7 1.7 0 0 1 2.7-2z" fill="currentColor"/>',
  broom: '<path d="M18.1 2.4l1.9 1.9-6.3 6.3-1.9-1.9z" fill="currentColor"/><path d="M10.6 8.5l4.9 4.9-1.2 1.2c-.9 3-3.4 5.8-7.7 6.9l-3.8.7.7-3.8c1.1-4.3 3.9-6.8 6.9-7.7z" fill="currentColor"/><path d="M6.1 18.1l3-3M8.8 19.3l2.4-2.4M4.8 15.4l2.4-2.4" stroke="rgba(0,0,0,.3)" stroke-width="1.4" stroke-linecap="round"/>',
  robot: '<circle cx="12" cy="12.5" r="9.6" fill="currentColor"/><path d="M4.6 10a8 8 0 0 1 14.8 0" fill="none" stroke="rgba(0,0,0,.32)" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="14" r="3.4" fill="rgba(255,255,255,.88)"/><circle cx="12" cy="6.4" r="1.4" fill="#8dffbf"/>',
  cart: '<path d="M2.6 15.6V10.4a2 2 0 0 1 2-2h5.2l2.6-3.6h4.4a1.6 1.6 0 0 1 1.6 1.6v3.9h1.6a1.6 1.6 0 0 1 1.6 1.6v3.7z" fill="currentColor"/><circle cx="7" cy="17.2" r="3" fill="#24344a" stroke="currentColor" stroke-width="1.6"/><circle cx="17.4" cy="17.2" r="3" fill="#24344a" stroke="currentColor" stroke-width="1.6"/>',
  container: '<path d="M3 9.2h18l-1.6 10.1a1.6 1.6 0 0 1-1.6 1.4H6.2a1.6 1.6 0 0 1-1.6-1.4z" fill="currentColor"/><path d="M2.2 6.8l9.3-2.3 10.3 2.3v2.4H2.2z" fill="currentColor" opacity=".7"/><path d="M8 12.2v5.6M12 12.2v5.6M16 12.2v5.6" stroke="rgba(0,0,0,.3)" stroke-width="1.7" stroke-linecap="round"/>',
  store: '<path d="M3 9.6l1.7-5.2h14.6L21 9.6z" fill="currentColor"/><path d="M4.2 11.2h15.6v9.4H4.2z" fill="currentColor" opacity=".78"/><path d="M9.6 20.6v-5.4h4.8v5.4" fill="rgba(0,0,0,.32)"/><path d="M3 9.6a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0h-2 2a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 3 2.4" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.3"/>',
  pause: '<rect x="6" y="4.5" width="4.4" height="15" rx="1.7" fill="currentColor"/><rect x="13.6" y="4.5" width="4.4" height="15" rx="1.7" fill="currentColor"/>',
  close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>',
  check: '<path d="M4.6 12.6l4.9 4.9L19.4 7.4" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.4" width="14" height="10.2" rx="2.6" fill="currentColor"/><path d="M8 10.4V8a4 4 0 0 1 8 0v2.4" fill="none" stroke="currentColor" stroke-width="2.6"/>',
  bolt: '<path d="M13.6 1.8L4.4 13.6h6.2l-1.6 8.6 9.6-12.2h-6.3z" fill="currentColor"/>',
  star: '<path d="M12 2.4l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/>',
  tv: '<rect x="2.4" y="4.4" width="19.2" height="13.2" rx="3.2" fill="currentColor"/><path d="M10 8.1v5.8l5-2.9z" fill="#fff"/><path d="M8 21h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  sound: '<path d="M3.8 9h3.6L12 5v14l-4.6-4H3.8z" fill="currentColor"/><path d="M15.4 8.6a4.8 4.8 0 0 1 0 6.8M18 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>',
  leaf: '<path d="M12 21.4v-6.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 2.6c4.2 2.6 6.3 5.7 6.3 8.9a6.3 6.3 0 0 1-12.6 0c0-3.2 2.1-6.3 6.3-8.9z" fill="currentColor"/>',
  vibrate: '<rect x="8" y="3.4" width="8" height="17.2" rx="2.3" fill="currentColor"/><path d="M4.5 8v8M2 10.2v3.6M19.5 8v8M22 10.2v3.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  eye: '<path d="M1.8 12s3.7-6.6 10.2-6.6S22.2 12 22.2 12s-3.7 6.6-10.2 6.6S1.8 12 1.8 12z" fill="currentColor"/><circle cx="12" cy="12" r="3.6" fill="#fff"/><circle cx="12" cy="12" r="1.7" fill="#22344a"/>',
  wheel: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 14.5v6M9.7 11.2L4 9.6M14.3 11.2L20 9.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  sparkle: '<path d="M11 2.2l2.2 6.2 6.3 2-6.3 2.1L11 18.8l-2.2-6.3-6.3-2.1 6.3-2z" fill="currentColor"/><path d="M19 14.8l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="currentColor"/>',
  globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.3"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="2"/>',
  reset: '<path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/><path d="M3.6 3.4v5.2h5.2" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>',
  arrow: '<path d="M12 2.2l9 10.4h-5.6v9.2H8.6v-9.2H3z" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 7v5.4l3.6 2.1" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  trophy: '<path d="M7 3.4h10v5.2a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4v1.4a3.6 3.6 0 0 0 3.6 3.6M17 5h3v1.4a3.6 3.6 0 0 1-3.6 3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.4 13.4h3.2v3.8h-3.2zM7.4 17.4h9.2v3.2H7.4z" fill="currentColor"/>',
  width: '<path d="M2.6 12h18.8M6.6 7.8L2.4 12l4.2 4.2M17.4 7.8l4.2 4.2-4.2 4.2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  speed: '<path d="M3.4 17.2a8.6 8.6 0 1 1 17.2 0" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/><path d="M12 17.2l4.6-6.2" stroke="currentColor" stroke-width="2.9" stroke-linecap="round"/><circle cx="12" cy="17.2" r="2.1" fill="currentColor"/>',
  plus: '<path d="M12 4.6v14.8M4.6 12h14.8" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>',
  nozzleDown: '<path d="M12 2.8v10.4M7.4 8.8l4.6 4.6 4.6-4.6" fill="none" stroke="currentColor" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/><rect x="3.6" y="16.4" width="16.8" height="4.4" rx="2.2" fill="currentColor"/>',
  nozzleUp: '<path d="M12 13.6V3.2M7.4 7.6L12 3l4.6 4.6" fill="none" stroke="currentColor" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/><rect x="3.6" y="16.4" width="16.8" height="4.4" rx="2.2" fill="currentColor"/>',
  exit: '<path d="M10 3.8H6.2a2.2 2.2 0 0 0-2.2 2.2v12a2.2 2.2 0 0 0 2.2 2.2H10" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/><path d="M9.8 12h10.4M16 7.8l4.2 4.2-4.2 4.2" fill="none" stroke="currentColor" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="M8.5 4.5L16 12l-7.5 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  // v2: hand brush (start tool) and shoes
  brush: '<path d="M14.6 2.6l2.2 2.2-4.9 4.9-2.2-2.2z" fill="currentColor"/><path d="M3.4 12.6l5.8-5.8 6.2 6.2-5.8 5.8z" fill="currentColor"/><path d="M4.4 15.2l-1.6 3.4M6.6 17.4l-1.2 3.6M8.8 19.6L8 21.8M3.3 13.4l-1.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  shoe: '<path d="M2.6 15.4c0-2.7.6-6.6 1.6-8.6h4.2c.4 1.8 1.6 3 3.6 3.4l5.6 1.2c2.6.6 4 2.2 4 4.4v1.4H2.6z" fill="currentColor"/><path d="M2.6 18.6h18.8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M8.6 10.6l1.4-1.4M10.6 12l1.4-1.4" stroke="rgba(0,0,0,.35)" stroke-width="1.4" stroke-linecap="round"/>',
  check: '<path d="M4.6 12.6l4.6 4.6L19.6 6.8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
function svg(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || '') + '</svg>'; }

// shop item → visual category, main icon, corner badge
function itemVis(id) {
  if (id.indexOf('bag') === 0) return { cat: 'bag', ic: 'bag', badge: 'plus' };
  if (id === 'broom') return { cat: 'broom', ic: 'broom', badge: null };
  if (id.indexOf('broom_w') === 0) return { cat: 'broom', ic: 'broom', badge: 'width' };
  if (id.indexOf('broom_s') === 0) return { cat: 'broom', ic: 'broom', badge: 'speed' };
  if (id.indexOf('brush') === 0) return { cat: 'broom', ic: 'brush', badge: 'width' };
  if (id.indexOf('shoes') === 0) return { cat: 'drop', ic: 'shoe', badge: id === 'shoes_1' ? null : 'speed' };
  if (id.indexOf('cart_suction') === 0) return { cat: 'cart', ic: 'cart', badge: 'speed' };
  if (id === 'dropoff') return { cat: 'drop', ic: 'container', badge: null };
  if (/^robot_\d$/.test(id)) return { cat: 'robot', ic: 'robot', badge: id === 'robot_1' ? null : 'plus' };
  if (id.indexOf('robot_speed') === 0) return { cat: 'robot', ic: 'robot', badge: 'bolt' };
  if (id.indexOf('robot_cap') === 0) return { cat: 'robot', ic: 'robot', badge: 'bag' };
  if (id === 'cart') return { cat: 'cart', ic: 'cart', badge: null };
  if (id.indexOf('cart_tank') === 0) return { cat: 'cart', ic: 'cart', badge: 'bag' };
  if (id.indexOf('cart_width') === 0) return { cat: 'cart', ic: 'cart', badge: 'width' };
  return { cat: 'bag', ic: 'star', badge: null };
}
function tile(id, big) {
  const v = itemVis(id);
  return '<div class="tile cat-' + v.cat + (big ? ' big' : '') + '">' + svg(v.ic) + (v.badge ? '<span class="badge">' + svg(v.badge) + '</span>' : '') + '</div>';
}

// ------------------------------------------------------------------------------------------ module state
let C = null;          // ctx
let U = null;          // CONFIG.ui + robot colours/names + offline wording
let E = null;          // element refs
let S = null;          // runtime state
let nf = null, nf1 = null;
let tmpV = null;       // reused THREE.Vector3
const OFFER_ICON = { brush: 'brush', sweep: 'broom', enter: 'cart', exit: 'exit', nozzle: 'nozzleDown', shop: 'store' };
const PANEL_PAUSES = { pause: true, settings: true, ad: true };
const STATE_KEY = { idle: 'robot_idle', clean: 'robot_clean', travel: 'robot_travel', unload: 'robot_unload' };

function tx(key, vars) { return C.t(key, vars); }
function fmt(n) { return nf.format(Math.round(n)); }
function fmt1(n) { return nf1.format(n); }
function setText(el, s) { if (el.__t !== s) { el.__t = s; el.textContent = s; } }
function setTf(el, s) { if (el.__tf !== s) { el.__tf = s; el.style.transform = s; } }
function setCls(el, cls, on) { on = !!on; if (!el.__c) el.__c = {}; if (el.__c[cls] !== on) { el.__c[cls] = on; el.classList.toggle(cls, on); } }
function tfXY(el, x, y) { x = Math.round(x); y = Math.round(y); if (el.__x === x && el.__y === y) return; el.__x = x; el.__y = y; el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }
// layout rect in GAME coordinates: when main rotates the stage (forced landscape), getBoundingClientRect is in screen
// space; map the centre through ctx.view.toView and swap the sides
const LRP = { x: 0, y: 0 };
function lrect(el) {
  const r = el.getBoundingClientRect(), tv = C.view.toView;
  if (!tv) return r;
  const c = tv(r.left + r.width / 2, r.top + r.height / 2, LRP), w = r.height, h = r.width;
  return { left: c.x - w / 2, top: c.y - h / 2, width: w, height: h, right: c.x + w / 2, bottom: c.y + h / 2 };
}
function setHidden(el, h) { h = !!h; if (el.__h !== h) { el.__h = h; el.hidden = h; } }
function mod(name) { return C.mods[name]; }
function call(name, fn, a, b) {
  const m = C.mods[name];
  if (!m || typeof m[fn] !== 'function') { warnOnce(name + '.' + fn, '[ui] ' + name + '.' + fn + '() missing (contract MIMARI §4)'); return undefined; }
  return m[fn](a, b);
}
const warned = {};
function warnOnce(k, msg) { if (!warned[k]) { warned[k] = 1; console.warn(msg); } }
function cfg(path, dflt) { let o = C.CONFIG; for (const p of path.split('.')) { if (o == null) return dflt; o = o[p]; } return o == null ? dflt : o; }

// ------------------------------------------------------------------------------------------ CSS
const CSS = `
.u{position:absolute;inset:0;pointer-events:none;font-family:ui-rounded,"SF Pro Rounded","Hiragino Maru Gothic ProN","Arial Rounded MT Bold","Nunito","Varela Round",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  color:#fff;font-weight:800;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;letter-spacing:.1px;
  --ink:#1f2d40;--gold:#ffc531;--mint:#3de3a8;--teal:#14b3a3;--red:#ff4d5e;--amber:#ffad33;--purple:#7a5cff;--cream:#fffaf1;
  --sl:calc(var(--sal) + 12px);--sr:calc(var(--sar) + 12px);--st:calc(var(--sat) + 10px);--sb:calc(var(--sab) + 14px)}
.u *{box-sizing:border-box}
.u .ic{width:24px;height:24px;display:block;flex:none}
:where(.u) button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
:where(.u) button:focus{outline:none}
:where(.u) button:focus-visible{outline:3px solid #fff;outline-offset:2px}
/* chips */
.u .chip{position:relative;display:flex;align-items:center;gap:8px;height:44px;padding:0 14px 0 7px;border-radius:22px;
  background:linear-gradient(180deg,rgba(40,59,86,.9),rgba(22,34,52,.9));box-shadow:0 3px 0 rgba(0,0,0,.3),inset 0 1.5px 0 rgba(255,255,255,.16);
  text-shadow:0 2px 0 rgba(0,0,0,.3);white-space:nowrap}
.g{position:absolute;display:flex;flex-direction:column;gap:8px}
.g-tl{left:var(--sl);top:var(--st);align-items:flex-start}
.g-tr{right:var(--sr);top:var(--st);align-items:flex-end}
.g-tc{left:50%;top:var(--st);transform:translateX(-50%);align-items:center}
/* money */
.money{font-size:22px;padding-right:16px;min-width:112px}
.money .ic{width:32px;height:32px}
.money .num{min-width:2ch}
.money.bump{animation:ubump .28s ease-out}
@keyframes ubump{0%{transform:scale(1)}40%{transform:scale(1.12)}100%{transform:scale(1)}}
/* next goal */
.goal{height:auto;padding:7px 12px 8px 7px;border-radius:18px;align-items:center;gap:9px;min-width:200px;max-width:244px}
.goal .tile{width:38px;height:38px;border-radius:12px}
.goal .tile .ic{width:26px;height:26px}
.goal .gt{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}
.goal .gl{font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:#a9c2dd;font-weight:800}
.goal .gr{display:flex;align-items:center;gap:6px;font-size:15px}
.goal .gn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.goal .gp{display:flex;align-items:center;gap:3px;color:#ffe08a}
.goal .gp .ic{width:16px;height:16px}
.bar{position:relative;height:9px;border-radius:5px;background:rgba(0,0,0,.38);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.4)}
.bar>i{position:absolute;inset:0;border-radius:5px;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(180deg,#ffe27a,#ffb21f);transition:transform .25s ease-out}
.goal.near{box-shadow:0 3px 0 rgba(0,0,0,.3),0 0 0 2.5px #ffd451,0 0 18px rgba(255,212,81,.55)}
.goal.ready{background:linear-gradient(180deg,#2fc77a,#17955a);box-shadow:0 3px 0 #0d6a3e,0 0 18px rgba(61,227,168,.6);animation:upulse 1.1s ease-in-out infinite}
.goal.ready .gl{color:#d8ffe9}
.goal.ready .bar>i{background:linear-gradient(180deg,#fff,#d9ffe9)}
.goal.done .bar{display:none}
@keyframes upulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
/* boost timer chip */
.boost{height:36px;font-size:15px;padding:0 12px 0 6px;background:linear-gradient(180deg,#8e72ff,#5b3ee0);box-shadow:0 3px 0 #3b25a3}
.boost .ic{width:22px;height:22px;color:#ffe066}
/* bag meter */
.bagm{height:44px;gap:9px;padding:0 13px 0 9px;min-width:212px}
.bagm>.ic{width:28px;height:28px;color:#f2d9a8}
.bagm .bar{flex:1;height:14px;border-radius:7px;min-width:96px}
.bagm .bar>i{border-radius:7px;background:linear-gradient(180deg,#7ff0c2,#22c487)}
.bagm .bar.mid>i{background:linear-gradient(180deg,#ffe27a,#ffb21f)}
.bagm .cnt{font-size:16px;min-width:56px;text-align:right}
.bagm .fl{display:none;font-size:15px}
.bagm.full{background:linear-gradient(180deg,#ff6b78,#e0303f);box-shadow:0 3px 0 #9b1724;animation:ufull .9s ease-in-out infinite}
.bagm.full .bar,.bagm.full .cnt{display:none}
.bagm.full .fl{display:flex;align-items:center;gap:6px}
.bagm.full .fl .ic{width:22px;height:22px}
.bagm.full>.ic{color:#fff}
.bagm.tick>.ic{animation:utick .16s ease-out}
@keyframes ufull{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes utick{0%{transform:scale(1)}50%{transform:scale(1.22) rotate(-6deg)}100%{transform:scale(1)}}
/* compass */
.cmp{position:relative;width:250px;height:30px;border-radius:15px;overflow:hidden;background:linear-gradient(180deg,rgba(40,59,86,.72),rgba(22,34,52,.72));box-shadow:0 2px 0 rgba(0,0,0,.25)}
.cmp .tk{position:absolute;top:0;bottom:0;left:0;will-change:transform;
  background:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 2px,transparent 2px var(--tk)) 0 9px/100% 12px no-repeat}
.cmp .ctr{position:absolute;left:50%;top:0;width:3px;height:8px;margin-left:-1.5px;border-radius:2px;background:#fff}
.cmp .mk{position:absolute;left:0;top:3px;width:24px;height:24px;margin-left:-12px;border-radius:12px;display:flex;align-items:center;justify-content:center;will-change:transform}
.cmp .mk .ic{width:16px;height:16px}
.cmp .mk.shop{background:#ffc531;color:#5a3a00}
.cmp .mk.drop{background:#3de3a8;color:#0a4a33}
.cmp .mk.rb{width:14px;height:14px;margin-left:-7px;top:8px;border:2px solid #fff}
.cmp .mk.dirt{width:12px;height:12px;margin-left:-6px;top:9px;background:#ff4d5e;border:2px solid #fff;animation:upulse .9s ease-in-out infinite}
.cmp .mk.edge{opacity:.55}
/* district ring */
.ringw{display:flex;align-items:flex-start;gap:8px;position:relative}
/* v2: "Kaydedildi" tick under the pause button (each save, <= 1 s) and the honest storage notice */
.svd{position:absolute;right:0;top:52px;display:flex;align-items:center;gap:3px;padding:2px 7px 2px 4px;border-radius:10px;background:rgba(18,30,48,.62);font-size:11px;color:#bff5d9;opacity:0;pointer-events:none;white-space:nowrap}
.svd .ic{width:13px;height:13px;color:#5df0a8}
.svd.on{animation:usvd .95s ease-out both}
@keyframes usvd{0%{opacity:0;transform:translateY(-3px)}15%,70%{opacity:1;transform:none}100%{opacity:0}}
.snote{position:absolute;left:50%;bottom:calc(var(--sab) + 10px);transform:translateX(-50%);max-width:min(460px,calc(var(--vw,100vw) - 40px));padding:6px 12px;border-radius:12px;background:rgba(120,40,30,.82);color:#fff;font-size:13px;line-height:1.25;text-align:center;pointer-events:none;transition:opacity .6s}
.snote.fade{opacity:0}
.pn-pause .snote2{font-size:13px;color:#b0433a;font-weight:800;padding:2px 4px 6px}
/* v2: settings slider (FOV) — custom, so it maps touches correctly when the stage is rotated */
.sld{display:flex;align-items:center;gap:10px;flex:1;min-width:180px;max-width:300px;margin-left:auto;touch-action:none}
.sld .trk{position:relative;flex:1;height:44px}
.sld .trk::before{content:"";position:absolute;left:0;right:0;top:19px;height:6px;border-radius:3px;background:#dfe6ee}
.sld .trk>i{position:absolute;left:0;top:19px;height:6px;border-radius:3px;background:linear-gradient(90deg,#45d98f,#1fae64)}
.sld .trk>b{position:absolute;top:8px;width:28px;height:28px;margin-left:-14px;border-radius:14px;background:#fff;box-shadow:0 2px 0 rgba(0,0,0,.25),0 0 0 2px #1fae64}
.sld .sv{min-width:44px;text-align:right;color:#1f2d40;font-size:16px}
html.rot .u .pn-bd{touch-action:none}
.ring{position:relative;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,rgba(30,46,68,.92) 58%,rgba(22,34,52,.0) 59%);filter:drop-shadow(0 3px 0 rgba(0,0,0,.3))}
.ring svg{position:absolute;inset:0;width:64px;height:64px;transform:rotate(-90deg)}
.ring .trk{fill:none;stroke:rgba(10,18,30,.75);stroke-width:8}
.ring .fil{fill:none;stroke:url(#uRingG);stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset .4s ease-out}
.ring .msd{fill:#4d6582;stroke:#16243a;stroke-width:1}
.ring .msd.on{fill:#ffd451}
.ring .rt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.ring .rv{font-size:16px}
.ring .rv.w{font-size:13px}
.ring .rl{font-size:9.5px;color:#a9c2dd;margin-top:2px;letter-spacing:.4px;text-transform:uppercase}
.ring.ms{animation:uring .9s ease-out}
@keyframes uring{0%{transform:scale(1)}30%{transform:scale(1.25)}100%{transform:scale(1)}}
.btn-r{width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(40,59,86,.9),rgba(22,34,52,.9));box-shadow:0 3px 0 rgba(0,0,0,.3),inset 0 1.5px 0 rgba(255,255,255,.16)}
.btn-r:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.3)}
.rbs{display:flex;gap:5px}
.rbs .rb{position:relative;width:24px;height:24px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.rbs .rb .ic{width:20px;height:20px;color:inherit}
.rbs .rb i{position:absolute;right:-2px;top:-2px;width:9px;height:9px;border-radius:5px;background:#8dffbf;border:2px solid #16243a}
.rbs .rb.full i{background:#ffad33}
.rbs .rb.blink i{animation:ublink .5s steps(2) infinite}
@keyframes ublink{50%{opacity:.25}}
/* action button + tools */
.act{position:absolute;right:calc(var(--sar) + 22px);bottom:calc(var(--sab) + 18px);width:104px;height:104px;border-radius:52px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#4a2a00;
  background:radial-gradient(circle at 50% 30%,#ffe991,#ffc21a 55%,#f5a20b);box-shadow:0 6px 0 #b8620a,0 10px 20px rgba(0,0,0,.28),inset 0 3px 0 rgba(255,255,255,.55);
  transition:transform .06s,box-shadow .06s;text-shadow:0 1px 0 rgba(255,255,255,.4)}
.act .ic{width:42px;height:42px}
.act .lb{font-size:15px;font-weight:900;max-width:96px;line-height:1.05;text-align:center}
.act.dn{transform:translateY(5px);box-shadow:0 1px 0 #b8620a,0 4px 10px rgba(0,0,0,.25),inset 0 3px 0 rgba(255,255,255,.4)}
.act.idle{filter:saturate(.25) brightness(.92);opacity:.78}
.act.shop{background:radial-gradient(circle at 50% 30%,#8ff5cf,#2fd391 55%,#17a96f);box-shadow:0 6px 0 #0c7a4b,0 10px 20px rgba(0,0,0,.28),inset 0 3px 0 rgba(255,255,255,.55);color:#053a24}
.act.car{background:radial-gradient(circle at 50% 30%,#ffc2e2,#ff6fb5 55%,#e84497);box-shadow:0 6px 0 #a11f62,0 10px 20px rgba(0,0,0,.28),inset 0 3px 0 rgba(255,255,255,.5);color:#4a0730}
.act.apop{animation:uapop .3s ease-out}
@keyframes uapop{0%{transform:scale(.86)}60%{transform:scale(1.07)}100%{transform:scale(1)}}
.act2{position:absolute;right:calc(var(--sar) + 140px);bottom:calc(var(--sab) + 22px);width:76px;height:76px;border-radius:38px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  color:#fff;background:radial-gradient(circle at 50% 30%,#7fdcff,#2a9fe0 60%,#1b7fc0);box-shadow:0 5px 0 #0f5f91,0 8px 16px rgba(0,0,0,.25),inset 0 2px 0 rgba(255,255,255,.45);text-shadow:0 1px 0 rgba(0,0,0,.25)}
.act2 .ic{width:30px;height:30px}
.act2 .lb{font-size:12px;font-weight:900;max-width:70px;line-height:1.05;text-align:center}
.act2:active{transform:translateY(4px);box-shadow:0 1px 0 #0f5f91}
.act2.apop{animation:uapop .3s ease-out}
.u.port .act2{right:calc(var(--sar) + 36px);bottom:calc(var(--sab) + 146px)}
.tools{position:absolute;display:flex;gap:12px;right:calc(var(--sar) + 142px);bottom:calc(var(--sab) + 26px)}
.tb{width:60px;height:60px;border-radius:30px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(40,59,86,.92),rgba(22,34,52,.92));box-shadow:0 4px 0 rgba(0,0,0,.32),inset 0 1.5px 0 rgba(255,255,255,.16);color:#cfe0f2}
.tb .ic{width:32px;height:32px}
.tb.on{background:linear-gradient(180deg,#5ad1ff,#1f93d6);color:#fff;box-shadow:0 4px 0 #0f5f91,0 0 0 3px #fff}
.tb:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.32)}
/* stick */
.stk{position:absolute;left:0;top:0;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:64px;border:3px solid rgba(255,255,255,.55);background:radial-gradient(circle,rgba(20,32,50,.18),rgba(20,32,50,.32));will-change:transform}
.stk.ghost{opacity:.42}
.knob{position:absolute;left:0;top:0;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:29px;background:radial-gradient(circle at 50% 35%,#ffffff,#d9e6f2);box-shadow:0 4px 0 rgba(0,0,0,.25);will-change:transform}
/* edge / world indicator */
.ind{position:absolute;left:0;top:0;width:0;height:0;will-change:transform}
.ind .pin{position:absolute;left:-25px;top:-25px;width:50px;height:50px;border-radius:25px;display:flex;align-items:center;justify-content:center;background:#ffc531;color:#5a3a00;box-shadow:0 4px 0 #b8620a,0 0 0 3px #fff}
.ind .pin .ic{width:30px;height:30px}
.ind .arw{position:absolute;left:-14px;top:-14px;width:28px;height:28px;color:#fff;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
.ind .arw .ic{width:28px;height:28px}
.ind .lab{position:absolute;left:0;top:30px;transform:translateX(-50%);padding:4px 11px;border-radius:12px;font-size:14px;white-space:nowrap;background:rgba(22,34,52,.9);box-shadow:0 2px 0 rgba(0,0,0,.3)}
.ind.sell .pin{background:#ff5f6d;color:#fff;box-shadow:0 4px 0 #9b1724,0 0 0 3px #fff;animation:upulse .9s ease-in-out infinite}
.ind.on .lab{top:auto;bottom:34px}
.ind.edge .arw{width:36px;height:36px;left:-18px;top:-18px;animation:unudge .8s ease-in-out infinite}
.ind.edge .arw .ic{width:36px;height:36px}
.ind.edge .lab{top:34px}
.ind.back .pin{opacity:.8}
.ind.back .pin::after{content:"";position:absolute;inset:-7px;border-radius:50%;border:3px dashed #fff}
@keyframes unudge{0%,100%{margin-left:0}50%{margin-left:var(--nx,0px)}}
.ind.drop .pin{background:#3de3a8;color:#0a4a33;box-shadow:0 4px 0 #0c7a4b,0 0 0 3px #fff}
.ind.cartp .pin{background:#ff6fb5;color:#4a0730;box-shadow:0 4px 0 #a11f62,0 0 0 3px #fff}
/* hints */
.hint{position:absolute;left:0;top:0;will-change:transform}
.u .off{visibility:hidden}
.hint .bub{position:absolute;left:0;bottom:12px;transform:translateX(-50%);padding:9px 16px;border-radius:16px;font-size:18px;white-space:nowrap;color:#1f2d40;background:#fff;box-shadow:0 4px 0 rgba(0,0,0,.25);animation:ubob 1.2s ease-in-out infinite}
.hint .bub:after{content:"";position:absolute;left:50%;bottom:-8px;margin-left:-9px;border:9px solid transparent;border-bottom:0;border-top-color:#fff}
.hint.dn .bub{bottom:auto;top:12px}
.hint.dn .bub:after{bottom:auto;top:-8px;border:9px solid transparent;border-top:0;border-bottom-color:#fff}
@keyframes ubob{0%,100%{translate:0 0}50%{translate:0 -5px}}
.taph{position:absolute;right:calc(var(--sar) + 96px);bottom:calc(var(--sab) + 70px);width:56px;height:56px;color:#fff;filter:drop-shadow(0 3px 2px rgba(0,0,0,.45));animation:utap 1.1s ease-in-out infinite}
.taph .ic{width:56px;height:56px}
@keyframes utap{0%,100%{transform:translate(-16px,-16px) rotate(-20deg) scale(1)}45%{transform:translate(6px,6px) rotate(-20deg) scale(.86)}}
.ghostt{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:22px;background:rgba(255,255,255,.85);box-shadow:0 3px 0 rgba(0,0,0,.25);animation:ughost 1.6s ease-in-out infinite}
@keyframes ughost{0%,15%{transform:translate(0,0)}50%,65%{transform:translate(0,-38px)}100%{transform:translate(0,0)}}
/* toasts */
.toasts{position:absolute;left:50%;top:calc(var(--sat) + 104px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.toast{padding:9px 18px;border-radius:18px;font-size:18px;white-space:nowrap;background:linear-gradient(180deg,#ffffff,#eef4f8);color:#1f2d40;box-shadow:0 4px 0 rgba(0,0,0,.25);animation:utin .25s ease-out both}
.toast.big{font-size:22px;padding:10px 22px;background:linear-gradient(180deg,#ffe991,#ffc21a);color:#4a2a00;box-shadow:0 4px 0 #b8620a}
.toast.out{animation:utout .3s ease-in both}
@keyframes utin{from{opacity:0;transform:translateY(-10px) scale(.9)}to{opacity:1;transform:none}}
@keyframes utout{to{opacity:0;transform:translateY(-8px) scale(.95)}}
/* popups, flying coins, confetti */
.pop{position:absolute;left:0;top:0;font-size:20px;white-space:nowrap;color:#ffe066;text-shadow:0 2px 0 rgba(0,0,0,.55),0 0 6px rgba(0,0,0,.35);opacity:0;will-change:transform,opacity}
.pop.big{font-size:28px}
.pop.gold{color:#fff3a0;font-size:26px}
.pop.small{font-size:16px;color:#fff}
.coinf{position:absolute;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;opacity:0;will-change:transform,opacity}
.coinf .ic{width:30px;height:30px}
.cf{position:absolute;left:0;top:0;width:10px;height:14px;border-radius:2px;opacity:0;will-change:transform,opacity}
/* milestone banner */
.msb{position:absolute;left:50%;top:calc(var(--sat) + 8px);display:flex;align-items:center;gap:12px;padding:10px 20px 10px 12px;border-radius:24px;transform:translate(-50%,-140%);opacity:0;
  background:linear-gradient(180deg,#ffe991,#ffc21a);color:#4a2a00;box-shadow:0 5px 0 #b8620a,0 12px 26px rgba(0,0,0,.3);transition:transform .45s cubic-bezier(.2,1.5,.4,1),opacity .3s;text-shadow:none;pointer-events:none;max-width:min(660px,calc(var(--vw,100vw) - 32px))}
.msb.on{transform:translate(-50%,0);opacity:1;pointer-events:auto}
.msb .ms-st{width:56px;height:56px;border-radius:28px;background:#fff;display:flex;align-items:center;justify-content:center;color:#ffb21f;box-shadow:inset 0 -3px 0 rgba(0,0,0,.08);flex:none}
.msb .ms-st .ic{width:40px;height:40px}
.msb .ms-tx{display:flex;flex-direction:column;gap:3px;min-width:150px;flex:1}
.msb .ms-t{font-size:21px;line-height:1.1}
.msb .ms-b{font-size:15px;display:flex;align-items:center;gap:5px;color:#7a4500;white-space:nowrap}
.msb .ms-b .ic{width:18px;height:18px}
.msb .ms-ad{display:flex;gap:6px;margin-left:4px;align-items:center;flex:none}
.msb .ms-ad .ad{width:230px}
.msb .ms-ad .bt.ghost{padding:0 10px;font-size:15px;color:#7a4500}
.msb .ms-ad:empty{display:none}
.msb.has-ad{flex-wrap:wrap;justify-content:center;max-width:min(470px,calc(var(--vw,100vw) - 32px));row-gap:8px}
.msb.has-ad .ms-ad{width:100%;justify-content:center;margin:0}
/* buttons (panels) */
.bt{min-height:48px;padding:0 20px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:18px;font-weight:900;color:#fff;
  background:linear-gradient(180deg,#45d98f,#1fae64);box-shadow:0 4px 0 #117543,inset 0 2px 0 rgba(255,255,255,.35);text-shadow:0 1px 0 rgba(0,0,0,.25);white-space:nowrap}
.bt:active{transform:translateY(3px);box-shadow:0 1px 0 #117543}
.bt .ic{width:22px;height:22px}
.bt.grey{background:linear-gradient(180deg,#d7e0ea,#b9c6d4);color:#53657a;box-shadow:0 4px 0 #8c9cad;text-shadow:none}
.bt.blue{background:linear-gradient(180deg,#5ad1ff,#1f93d6);box-shadow:0 4px 0 #0f5f91}
.bt.red{background:linear-gradient(180deg,#ff7a85,#e0303f);box-shadow:0 4px 0 #9b1724}
.bt.ghost{background:transparent;box-shadow:none;color:#5d7088;text-shadow:none;font-size:16px}
.bt[disabled]{pointer-events:none}
.ad{position:relative;min-height:48px;padding:0 14px 0 10px;border-radius:14px;display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:800;color:#fff;
  background:linear-gradient(180deg,#8e72ff,#5b3ee0);box-shadow:0 4px 0 #3b25a3;text-align:left;line-height:1.15}
.ad:active{transform:translateY(3px);box-shadow:0 1px 0 #3b25a3}
.ad .ic{width:24px;height:24px;color:#ffe066}
.ad .tag{position:absolute;top:-8px;left:10px;padding:1px 7px;border-radius:7px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;background:#fff;color:#5b3ee0;box-shadow:0 1px 0 rgba(0,0,0,.2)}
/* modal panels */
.mw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:calc(var(--sat) + 8px) calc(var(--sar) + 10px) calc(var(--sab) + 8px) calc(var(--sal) + 10px)}
.mw .bd{position:absolute;inset:0;background:rgba(10,20,34,.55);animation:ufade .2s ease-out both}
@keyframes ufade{from{opacity:0}}
.pn{position:relative;display:flex;flex-direction:column;max-height:100%;width:min(820px,100%);border-radius:26px;background:var(--cream);color:var(--ink);
  box-shadow:0 8px 0 rgba(0,0,0,.25),0 18px 40px rgba(0,0,0,.35);overflow:hidden;animation:upin .28s cubic-bezier(.2,1.4,.4,1) both;text-shadow:none}
@keyframes upin{from{opacity:0;transform:translateY(24px) scale(.94)}}
.pn-hd{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 16px;min-height:60px;background:linear-gradient(180deg,#1fc6b4,#109f91);color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.2);flex:none}
.pn-ti{display:flex;align-items:center;gap:9px;font-size:24px;flex:1;min-width:0}
.pn-ti .ic{width:30px;height:30px}
.pn-co{display:flex;align-items:center;gap:6px;height:40px;padding:0 14px 0 6px;border-radius:20px;background:rgba(0,0,0,.22);font-size:20px}
.pn-co .ic{width:28px;height:28px}
.xb{width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);color:#fff}
.xb:active{transform:translateY(2px)}
.pn-bd{display:flex;gap:12px;padding:12px;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;flex:1;min-height:0;touch-action:pan-y}
/* shop */
.sh-c{flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(178px,1fr));min-width:0;gap:10px;align-content:start;min-width:0}
.sh-s{width:236px;flex:none;display:flex;flex-direction:column;gap:10px}
.card{min-width:0;position:relative;display:flex;flex-direction:column;gap:7px;padding:12px 12px 12px;border-radius:18px;background:#fff;box-shadow:0 3px 0 #dfe6ee,0 0 0 1.5px #e7edf3}
.card.next{box-shadow:0 3px 0 #e8b400,0 0 0 3px #ffc531}
.card.afford.next{box-shadow:0 3px 0 #0f8f55,0 0 0 3px #2fd391}
.card .rib{position:absolute;top:-1px;right:12px;padding:3px 9px 4px;border-radius:0 0 10px 10px;font-size:11px;letter-spacing:.7px;text-transform:uppercase;background:#ffc531;color:#5a3a00}
.card.afford .rib{background:#2fd391;color:#053a24}
.card .top{display:flex;gap:10px;align-items:center}
.tile{position:relative;width:52px;height:52px;border-radius:15px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff;box-shadow:inset 0 -3px 0 rgba(0,0,0,.14)}
.tile .ic{width:34px;height:34px}
.tile.big{width:64px;height:64px;border-radius:18px}
.tile.big .ic{width:42px;height:42px}
.tile .badge{position:absolute;right:-5px;bottom:-5px;width:22px;height:22px;border-radius:11px;background:#fff;color:#1f2d40;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 0 rgba(0,0,0,.25)}
.tile .badge .ic{width:15px;height:15px}
.cat-bag{background:linear-gradient(180deg,#ffbf5a,#f2932b)}
.cat-broom{background:linear-gradient(180deg,#5fd0ff,#1f9be0)}
.cat-robot{background:linear-gradient(180deg,#b394ff,#7b57f0)}
.cat-cart{background:linear-gradient(180deg,#ff8cc6,#e5509b)}
.cat-drop{background:linear-gradient(180deg,#56e6b0,#18b47c)}
.card .nm{font-size:18px;line-height:1.1}
.card .fx{display:flex;align-items:center;gap:5px;font-size:16px;margin-top:3px;color:#1f2d40}
.card .fx .a{color:#8698ad;font-weight:700}
.card .fx .ar{color:#2fb26f;width:16px;height:16px}
.card .fx b{color:#14995b}
.card .ds{font-size:13px;font-weight:700;color:#6b7d92;line-height:1.25;min-height:2.5em}
.card .buy{width:100%;font-size:19px}
.card .buy .ic{width:24px;height:24px}
.card .need{display:flex;flex-direction:column;gap:5px}
.card .need .bar{height:8px;background:#e3e9f0;box-shadow:none}
.card .need .nt{font-size:12.5px;color:#7b8ca0;font-weight:800;text-align:center}
.card.got{animation:ugot .5s ease-out}
@keyframes ugot{0%{transform:scale(1)}40%{transform:scale(1.05)}100%{transform:scale(1)}}
.owned{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 2px 2px;font-size:13px;color:#7b8ca0;text-transform:uppercase;letter-spacing:.6px}
.owned .tile{width:36px;height:36px;border-radius:11px}
.owned .tile .ic{width:24px;height:24px}
.owned .tile .badge{width:17px;height:17px;right:-4px;bottom:-4px}
.owned .tile .badge .ic{width:11px;height:11px}
.sbx{border-radius:18px;background:#fff;padding:11px;box-shadow:0 3px 0 #dfe6ee,0 0 0 1.5px #e7edf3;display:flex;flex-direction:column;gap:8px}
.sbx-t{font-size:13px;letter-spacing:.7px;text-transform:uppercase;color:#7b8ca0}
.rrow{display:flex;align-items:center;gap:9px}
.rrow .rdot{width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 2px 0 rgba(0,0,0,.18)}
.rrow .rdot .ic{width:28px;height:28px}
.rrow .rtx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.rrow .rn{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rrow .rs{font-size:12px;color:#7b8ca0;font-weight:700}
.rrow .bar{height:6px;background:#e3e9f0;box-shadow:none}
.rrow .bar>i{background:linear-gradient(180deg,#b394ff,#7b57f0)}
.rrow.full .bar>i{background:linear-gradient(180deg,#ffc76a,#ff9d1c)}
.rnone{font-size:14px;color:#9aa9ba;font-weight:700}
.boostbx .ad{width:100%}
.boostbx .nad{width:100%;margin-top:8px;min-height:48px;font-size:15px}
.u.fin .goal,.u.fin .g-tc{visibility:hidden}
.fade{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .35s}
.fade.on{opacity:1}
.boostbx .on{display:flex;align-items:center;gap:8px;font-size:16px;color:#5b3ee0}
.boostbx .on .ic{color:#7a5cff;width:26px;height:26px}
.boostbx .cd{font-size:14px;color:#8a99ab;display:flex;align-items:center;gap:6px}
.boostbx .cd .ic{width:18px;height:18px}
.promo{border:2px dashed #c7d3df;background:#f7fafc;box-shadow:none}
.promo .sbx-t{display:flex;align-items:center;gap:6px}
.pc{display:flex;gap:8px}
.pcard{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;align-items:stretch;text-align:left;min-height:44px}
.pcard .art{height:62px;border-radius:12px;position:relative;overflow:hidden}
.pcard .art svg{position:absolute;inset:0;width:100%;height:100%}
.pcard .pn2{font-size:13px;color:#1f2d40;line-height:1.15}
.pcard .soon{font-size:11px;color:#8a99ab;font-weight:700}
/* pause / settings */
.pn-pause{width:min(700px,100%)}
.set{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;flex:1;align-content:start}
.srow{display:flex;align-items:center;gap:10px;min-height:52px;padding:3px 4px 3px 10px;border-radius:16px;background:#fff;box-shadow:0 2px 0 #dfe6ee,0 0 0 1.5px #e7edf3}
.srow>.ic{color:#14b3a3;width:26px;height:26px}
.srow .sl{flex:1;font-size:16px;min-width:0}
.srow.wide{grid-column:1/-1}
.tg{position:relative;width:64px;height:44px;flex:none}
.tg:before{content:"";position:absolute;left:4px;top:8px;width:56px;height:28px;border-radius:14px;background:#cfd9e4;transition:background .15s}
.tg:after{content:"";position:absolute;left:8px;top:12px;width:20px;height:20px;border-radius:10px;background:#fff;box-shadow:0 2px 0 rgba(0,0,0,.2);transition:transform .15s}
.tg.on:before{background:#2fd391}
.tg.on:after{transform:translateX(28px)}
.seg{display:flex;padding:3px;border-radius:14px;background:#e6edf3;gap:2px;flex:none}
.seg button{min-width:44px;height:44px;padding:0 10px;border-radius:11px;font-size:14px;color:#5d7088}
.seg button.on{background:#fff;color:#109f91;box-shadow:0 2px 0 rgba(0,0,0,.12)}
.cfm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:15px;color:#c0283a}
.pfoot{display:flex;justify-content:center;padding:4px 12px 14px;flex:none}
/* complete + away + ad */
.pn-done{width:min(640px,100%)}
/* finale: a side panel (landscape) / bottom sheet (portrait) over a light scrim, so the aerial view of the clean
   district stays visible next to the card */
.mw.done{justify-content:flex-end}
.mw.done .bd{background:linear-gradient(90deg,rgba(10,20,34,0) 0%,rgba(10,20,34,0) 35%,rgba(10,20,34,.5) 100%)}
.mw.done .pn-done{width:min(390px,100%)}
.mw.done .done-top{gap:8px}
.mw.done .bigring,.mw.done .bigring svg{width:64px;height:64px}
.mw.done .bigring .t{font-size:17px}
.mw.done .stats{gap:6px}
.mw.done .stat{min-width:0;flex:1;padding:6px 6px}
.mw.done .pcard .art{height:38px}          /* QA #6: the promo captions fit above the footer in short landscape */
.mw.done .done-bd{gap:8px}
.mw.done .nextd{font-size:14px}
.u.port .mw.done{justify-content:center;align-items:flex-end}
.u.port .mw.done .bd{background:linear-gradient(180deg,rgba(10,20,34,0) 0%,rgba(10,20,34,0) 40%,rgba(10,20,34,.5) 100%)}
.u.port .mw.done .pn-done{width:100%;max-height:60%}
/* robot name tags in the world */
.rtag.big{font-size:17px;padding:6px 14px 6px 8px;border-radius:16px;box-shadow:0 0 0 3px var(--rc,#fff),0 0 18px var(--rc,#fff);animation:utagglow .8s ease-in-out infinite}
@keyframes utagglow{0%,100%{box-shadow:0 0 0 3px var(--rc,#fff),0 0 10px var(--rc,#fff)}50%{box-shadow:0 0 0 4px var(--rc,#fff),0 0 26px var(--rc,#fff)}}
.rtag{position:absolute;left:0;top:0;display:flex;align-items:center;gap:5px;padding:3px 9px 3px 5px;border-radius:12px;background:rgba(18,30,48,.78);color:#fff;font-size:12px;font-weight:800;white-space:nowrap;will-change:transform;box-shadow:0 2px 0 rgba(0,0,0,.25)}
.u.fin .act,.u.fin .act2,.u.fin .tools,.u.fin .stk,.u.fin .taph,.u.fin .hint,.u.fin .ind,.u.fin .pops{visibility:hidden}
.rtag i{width:12px;height:12px;border-radius:6px;border:2px solid rgba(255,255,255,.85);flex:none}
.pn-done .pn-hd{background:linear-gradient(180deg,#ffd451,#ffad1f);color:#4a2a00;text-shadow:0 1px 0 rgba(255,255,255,.4)}
.done-bd{flex-direction:column;align-items:center;gap:12px}
.done-top{display:flex;align-items:center;gap:16px}
.bigring{position:relative;width:96px;height:96px;flex:none}
.bigring svg{width:96px;height:96px;transform:rotate(-90deg)}
.bigring .t{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;color:#14995b}
.stats{display:flex;gap:10px}
.stat{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:92px;padding:8px 10px;border-radius:14px;background:#fff;box-shadow:0 2px 0 #dfe6ee,0 0 0 1.5px #e7edf3}
.stat .ic{width:22px;height:22px;color:#14b3a3}
.stat .sv{font-size:20px}
.stat .sk{font-size:12px;color:#7b8ca0;font-weight:700}
.nextd{font-size:15px;color:#7b8ca0;font-weight:700}
.done-promo{width:100%}
.pn-away{width:min(460px,100%)}
.away-bd{flex-direction:column;align-items:center;text-align:center;gap:10px;padding:16px}
.away-bd .big{font-size:20px;line-height:1.25}
.away-bd .cn{display:flex;align-items:center;gap:6px;font-size:22px;color:#14995b}
.away-bd .cn .ic{width:28px;height:28px}
.away-bd .cap{font-size:13px;color:#8a99ab;font-weight:700}
.adv{position:absolute;inset:0;pointer-events:auto;background:#0d0a26;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;animation:ufade .2s both}
.adv .tag{padding:4px 12px;border-radius:10px;background:#fff;color:#5b3ee0;font-size:14px;letter-spacing:.8px;text-transform:uppercase}
.adv .ic{width:72px;height:72px;color:#8e72ff}
.adv .pb{width:min(360px,calc(var(--vw,100vw) * .7));height:12px;border-radius:6px;background:rgba(255,255,255,.15);overflow:hidden}
.adv .pb>i{display:block;height:100%;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,#8e72ff,#ffe066)}
/* debug */
.dbg{position:absolute;left:50%;bottom:calc(var(--sab) + 4px);transform:translateX(-50%);padding:4px 8px;border-radius:8px;background:rgba(0,0,0,.6);font:600 11px/1.35 ui-monospace,Menlo,Consolas,monospace;white-space:pre;color:#bff;text-shadow:none}
/* ---------- portrait reflow */
.u.port .g-tl{gap:8px}
.u.port .g-tc{top:calc(var(--sat) + 200px)}
.u.port .goal{min-width:0;max-width:222px}
.u.port .cmp{width:min(320px,calc(var(--vw,100vw) - 40px))}
.u.port .toasts{top:calc(var(--sat) + 300px)}
.u.port .tools{flex-direction:column;right:calc(var(--sar) + 44px);bottom:calc(var(--sab) + 140px)}
.u.port .act{bottom:calc(var(--sab) + 26px)}
.u.port .taph{bottom:calc(var(--sab) + 78px)}
.u.port .pn-bd{flex-direction:column}
.u.port .sh-s{width:auto}
.u.port .sh-c{grid-template-columns:minmax(0,1fr)}
.u.port .card .ds{min-height:0}
.u.port .set{grid-template-columns:1fr}
.u.port .msb{top:calc(var(--sat) + 76px)}
.u.port .msb .ms-t{white-space:normal}
.u.port .stats{flex-wrap:wrap;justify-content:center}
.u.port .done-top{flex-direction:column;gap:8px}
/* short landscape: tighten */
@media (max-height:400px){
  .pn-hd{min-height:54px;padding:5px 6px 5px 14px}
  .pn-ti{font-size:21px}
  .card .ds{min-height:0}
}
@media (prefers-reduced-motion:reduce){.u *{animation-duration:.01s!important;animation-iteration-count:1!important}}
`;

// ------------------------------------------------------------------------------------------ init
export function init(ctx) {
  C = ctx;
  const CF = ctx.CONFIG;
  U = Object.assign({}, CF.ui, {
    robotColors: CF.robot.colors, robotNames: CF.robot.names,
    awayMinS: (CF.offline && CF.offline.announceMinS) || 60, offlineCapS: (CF.offline && CF.offline.capS) || 600,
  });
  const st = ctx.state.settings;
  if (st.haptics == null) st.haptics = true;
  if (st.steer == null) st.steer = cfg('cart.controlMode', 'camera');
  if (st.quality == null) st.quality = 'auto';
  if (st.sens == null) st.sens = 1;
  makeFormatters();
  tmpV = new ctx.THREE.Vector3();

  S = {
    shown: 0, target: 0, rollFrom: 0, rollT: 1, rollDur: 0.6, rollDelay: 0,
    slowAcc: 1, dbgAcc: 0, indD: -1, gameS0: 0,
    offerId: null, offerLabel: null, held: false, keyHeld: false, actOffer: null,
    panel: null, panelPrev: null, adT: 0,
    toasts: [], hints: { done: {}, active: null, queue: [], t: 0, shownBeforeBroom: 0 },
    notMovedS: 0, movedEver: false,
    bagFrac: -1, bagUnits: -1, bagCap: -1, bagFull: null, container: 'bag',
    pctShown: -1, ringOff: -1, msOn: [false, false, false],
    goalSig: '', goalFrac: -1, purchases: 0,
    robotsSig: '', toolsSig: '',
    boostLeft: -1, boostOn: false, boostMsOffered: false, completeShown: false,
    indOn: false, indKind: '', indX: -1, indY: -1,
    stickOn: null,
    pendingValue: 0, popAcc: 0, collectTickT: 0,
    msT: 0, completeT: -1,
    hapticT: 0, hapticN: 0,
    snapCoins: 0, snapUnits: 0, offlineSeen: false,
    dbgCells: 0, sellPts: [], shopPt: null, cartPt: null, nearSell: null,
    straggle: new Float32Array(6), straggleN: 0,
    rbX: new Float32Array(8), rbZ: new Float32Array(8), rbN: 0,
    catalog: [], shopSig: '', resetAsk: false,
    portrait: false, mx: 60, my: 30, bagX: 0, bagY: 0,
  };
  buildDom();
  bindInput();
  bindBus();
  applyOrientation();
  measure();
}

function makeFormatters() {
  const loc = C.state.settings.lang === 'en' ? 'en-US' : 'tr-TR';
  nf = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  nf1 = new Intl.NumberFormat(loc, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

function buildDom() {
  const root = C.uiRoot;
  root.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);
  const u = document.createElement('div');
  u.className = 'u';
  u.lang = C.state.settings.lang;
  const ringC = 2 * Math.PI * 27;
  u.innerHTML =
    '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="uRingG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8dffcf"/><stop offset="1" stop-color="#1fcf8a"/></linearGradient></defs></svg>' +
    '<div class="stk ghost" hidden><div class="knob"></div></div>' +
    '<div class="g g-tl">' +
      '<div class="chip money">' + svg('coin') + '<span class="num">0</span></div>' +
      '<div class="chip goal"><div class="gtile"></div><div class="gt"><div class="gl"></div><div class="gr"><span class="gn"></span><span class="gp">' + svg('coin') + '<span class="gpv"></span></span></div><div class="bar"><i></i></div></div></div>' +
      '<div class="chip boost" hidden>' + svg('bolt') + '<span class="bt-t"></span></div>' +
    '</div>' +
    '<div class="g g-tc">' +
      '<div class="cmp"><div class="tk"></div><div class="mks"></div><div class="ctr"></div></div>' +
      '<div class="chip bagm">' + svg('bag') + '<div class="bar"><i></i></div><span class="cnt"></span><span class="fl"><span class="flt"></span>' + svg('store') + '</span></div>' +
    '</div>' +
    '<div class="g g-tr">' +
      '<div class="ringw"><div class="ring"><svg viewBox="0 0 64 64"><circle class="trk" cx="32" cy="32" r="27"/><circle class="fil" cx="32" cy="32" r="27" stroke-dasharray="' + ringC.toFixed(2) + '" stroke-dashoffset="' + ringC.toFixed(2) + '"/>' + msDots() + '</svg><div class="rt"><span class="rv"></span><span class="rl"></span></div></div>' +
      '<button class="btn-r pause" data-hit aria-label="pause">' + svg('pause') + '</button><div class="svd">' + svg('check') + '<span></span></div></div>' +
      '<div class="rbs"></div>' +
    '</div>' +
    '<div class="tools" hidden></div>' +
    '<button class="act idle" data-hit>' + svg('brush') + '<span class="lb"></span></button>' +
    '<button class="act2" data-hit hidden>' + svg('exit') + '<span class="lb"></span></button>' +
    '<div class="taph" hidden>' + svg('hand') + '</div>' +
    '<div class="snote" hidden></div>' +
    '<div class="ind" hidden><div class="arw">' + svg('arrow') + '</div><div class="pin">' + svg('store') + '</div><div class="lab"></div></div>' +
    '<div class="hint" hidden><div class="bub"></div></div>' +
    '<div class="ghostw" hidden style="position:absolute;left:0;top:0"><div class="ghostt"></div></div>' +
    '<div class="rtags"></div>' +
    '<div class="toasts"></div>' +
    '<div class="pops"></div><div class="coins"></div>' +
    '<div class="msb"><div class="ms-st">' + svg('star') + '</div><div class="ms-tx"><div class="ms-t"></div><div class="ms-b"></div></div><div class="ms-ad"></div></div>' +
    '<div class="mwrap"></div><div class="cfs"></div><div class="fade"></div>' +
    '<div class="dbg"' + (C.debug || C.perfHud || C.state.settings.perfHud ? '' : ' hidden') + '></div>';
  root.appendChild(u);
  const q = (s) => u.querySelector(s);
  E = {
    u, stk: q('.stk'), knob: q('.knob'),
    money: q('.money'), moneyNum: q('.money .num'), moneyIc: q('.money .ic'),
    goal: q('.goal'), goalTile: q('.gtile'), goalLbl: q('.gl'), goalName: q('.gn'), goalPrice: q('.gpv'), goalBar: q('.goal .bar>i'), goalP: q('.gp'),
    boost: q('.boost'), boostT: q('.bt-t'),
    cmp: q('.cmp'), cmpTk: q('.cmp .tk'), cmpMks: q('.cmp .mks'),
    bag: q('.bagm'), bagIc: q('.bagm>.ic'), bagBar: q('.bagm .bar'), bagFill: q('.bagm .bar>i'), bagCnt: q('.bagm .cnt'), bagFl: q('.bagm .flt'),
    ring: q('.ring'), ringFil: q('.ring .fil'), ringV: q('.ring .rv'), ringL: q('.ring .rl'), ringDots: u.querySelectorAll('.ring .msd'), ringC,
    pause: q('.pause'), rbs: q('.rbs'), svd: q('.svd'), svdLb: q('.svd span'), snote: q('.snote'),
    tools: q('.tools'), act: q('.act'), actLb: q('.act .lb'), taph: q('.taph'), act2: q('.act2'), act2Lb: q('.act2 .lb'),
    ind: q('.ind'), indArw: q('.ind .arw'), indPin: q('.ind .pin'), indLab: q('.ind .lab'),
    hint: q('.hint'), hintBub: q('.hint .bub'), ghost: q('.ghostw'),
    toasts: q('.toasts'), pops: q('.pops'), coins: q('.coins'), cfs: q('.cfs'),
    msb: q('.msb'), msT: q('.ms-t'), msB: q('.ms-b'), msAd: q('.ms-ad'),
    mwrap: q('.mwrap'), dbg: q('.dbg'), rtags: q('.rtags'),
  };
  // robot name tags (pool of 4, PSIKOLOJI §3 "Robot 1: Pırıl")
  E.tag = []; for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'rtag'; d.hidden = true; d.innerHTML = '<i></i><span></span>'; E.rtags.appendChild(d); E.tag.push({ el: d, dot: d.firstChild, tx: d.lastChild, name: '', x: -1, y: -1, on: false, col: '' }); }
  // pools (created once)
  E.popPool = []; for (let i = 0; i < 14; i++) { const d = document.createElement('div'); d.className = 'pop'; E.pops.appendChild(d); E.popPool.push(d); }
  E.popI = 0;
  E.coinPool = []; for (let i = 0; i < U.coinFlyMax; i++) { const d = document.createElement('div'); d.className = 'coinf'; d.innerHTML = svg('coin'); E.coins.appendChild(d); E.coinPool.push(d); }
  E.cfPool = []; for (let i = 0; i < U.confettiBig; i++) { const d = document.createElement('div'); d.className = 'cf'; E.cfs.appendChild(d); E.cfPool.push(d); }
  // compass markers: shop, dropoff, 4 robots, 6 stragglers
  E.mk = { shop: mkMarker('shop', svg('store')), drop: mkMarker('drop', svg('container')), rb: [], dirt: [] };
  for (let i = 0; i < 4; i++) { const m = mkMarker('rb', ''); m.style.background = U.robotColors[i % U.robotColors.length]; E.mk.rb.push(m); }
  for (let i = 0; i < 6; i++) E.mk.dirt.push(mkMarker('dirt', ''));
  relabel();
}
function msDots() {
  let s = '';
  for (const f of [0.25, 0.5, 0.75]) { const a = f * Math.PI * 2; s += '<circle class="msd" cx="' + (32 + 27 * Math.cos(a)).toFixed(2) + '" cy="' + (32 + 27 * Math.sin(a)).toFixed(2) + '" r="3.2"/>'; }
  return s;
}
function mkMarker(cls, inner) { const d = document.createElement('div'); d.className = 'mk ' + cls; d.innerHTML = inner; d.hidden = true; E.cmpMks.appendChild(d); return d; }

// static texts (re-run on language change)
function relabel() {
  E.u.lang = C.state.settings.lang;
  setText(E.ringL, tx('district_clean'));
  E.pause.setAttribute('aria-label', tx('paused'));
  setText(E.bagFl, tx(S.container === 'tank' ? 'tank_full' : 'bag_full'));
  S.offerId = null; S.goalSig = ''; S.pctShown = -1; S.boostLeft = -1; S.toolsSig = null; S.robotsSig = ''; S.bagUnits = -1; S.shownInt = null; S.indKind = ''; S.indD = -1;
  E.moneyNum.__t = null;
}

// ------------------------------------------------------------------------------------------ input
function bindInput() {
  const act = E.act;
  const stop = (e) => e.stopPropagation();
  E.u.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-hit],button,.mw,.adv')) stop(e); });
  E.u.addEventListener('touchstart', (e) => { if (e.target.closest('[data-hit],button,.mw,.adv')) stop(e); }, { passive: true });
  act.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { act.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    press();
  });
  const up = () => release();
  act.addEventListener('pointerup', up); act.addEventListener('pointercancel', up); act.addEventListener('lostpointercapture', up);
  act.addEventListener('contextmenu', (e) => e.preventDefault());
  // the context buttons act on pointerdown; cancel the click the browser synthesizes after the tap, or it lands on
  // whatever the press just opened (the shop backdrop in portrait closed the shop at once: integration defect)
  const noGhost = (e) => { if (e.cancelable) e.preventDefault(); };
  act.addEventListener('touchend', noGhost, { passive: false });
  E.act2.addEventListener('touchend', noGhost, { passive: false });
  E.pause.addEventListener('click', () => { click(); openPanel('pause'); });
  // secondary context button: second offer with priority >= U.secondaryMinPriority (e.g. nozzle while 'exit' is on top)
  E.act2.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const o = S.act2Offer; if (!o) return;
    click();
    P_OFFER.id = o.id; P_OFFER.owner = o.owner; C.bus.emit('ui:offer', P_OFFER);
    if (o.id === 'shop') openPanel('shop');
  });
  E.tools.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    click(); C.bus.emit('ui:tool', { id: b.getAttribute('data-tool') });
  });
  E.msAd.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.getAttribute('data-act');
    click(); hideMs();
    if (a === 'ad') openPanel('ad');
  });
  E.mwrap.addEventListener('click', onPanelClick);
  bindSliders(); bindRotScroll();
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (S.panel === 'ad') return;
      if (S.panel) closePanel(); else openPanel('pause');
      e.preventDefault(); return;
    }
    if (S.panel) return;
    if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat && !S.keyHeld) { S.keyHeld = true; press(); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => {
    if ((e.code === 'KeyE' || e.code === 'Space') && S.keyHeld) { S.keyHeld = false; release(); e.preventDefault(); }
  });
  addEventListener('blur', () => { if (S.held) release(); S.keyHeld = false; });
}
// payloads reused (bus rule: listeners copy what they keep)
const P_BTN = { id: 'action', down: false };
const P_OFFER = { id: '', owner: '' };
function press() {
  if (S.held) return;
  S.held = true;
  setCls(E.act, 'dn', true);
  const o = S.actOffer;
  // QA #4: pressing "Dükkan" (or Bin/İn/nozzle) also swept/picked: only the tool's own offer is a held action
  const toolAct = !o || o.id === 'brush' || o.id === 'sweep';
  S.heldTool = toolAct;
  if (toolAct) { P_BTN.down = true; C.bus.emit('input:button', P_BTN); }
  haptic('light');
  if (o) {
    P_OFFER.id = o.id; P_OFFER.owner = o.owner; C.bus.emit('ui:offer', P_OFFER);
    if (o.id === 'shop') { release(); openPanel('shop'); }
  }
}
function release() {
  if (!S.held) return;
  S.held = false;
  setCls(E.act, 'dn', false);
  if (S.heldTool !== false) { P_BTN.down = false; C.bus.emit('input:button', P_BTN); }
  S.heldTool = true;
}
function click() { const a = mod('audio'); if (a && a.play) a.play('click'); haptic('light'); }

// ------------------------------------------------------------------------------------------ bus
function bindBus() {
  const b = C.bus;
  b.on('ui:toast', (p) => { if (!p) return; if (p.text) toastText(p.text, p.big); else if (p.key) { if ((p.key === 'bag_full' || p.key === 'tank_full') && S.bagFull) return; toast(p.key, p.vars); } });   // QA #10: the bag meter already says it
  b.on('view:resize', () => { applyOrientation(); measure(); });
  b.on('game:ready', onReady);
  b.on('game:saved', onSaved);
  b.on('ui:fade', (p) => { const f = E.u.querySelector('.fade'); if (f) f.classList.toggle('on', !!(p && p.on)); });
  b.on('app:pause', snapshot);
  b.on('app:resume', (p) => onAway(p ? p.awayS : 0));
  // economy:away is emitted by economy's own game:ready / app:resume handler (it subscribed first), so it arrives
  // before onReady/onAway below; those then skip their coin/unit diff
  b.on('economy:away', (p) => { if (p) { S.offlineSeen = true; if ((p.awayS || 0) >= U.awayMinS) showAway(p.units || 0, p.coins || 0, p.awayS || 0, p.capped, p.limitBy); } });
  b.on('tool:collect', onCollect);
  b.on('economy:sold', onSold);
  b.on('economy:bagFull', () => { haptic('medium'); hintTrigger('bagFull'); });
  b.on('economy:purchased', onPurchased);
  b.on('economy:coins', (p) => { if (p && p.reason === 'milestone') S.rollDelay = 0.5; });
  b.on('economy:boost', (p) => { if (p && p.active && !S.boostOn) toastText(tx('boost_on'), true); });
  b.on('economy:finalSweep', (p) => { toast('final_sweep'); if (p && p.coins) popAtScreen(C.view.w / 2, C.view.h * 0.45, '+' + fmt(p.coins), 'big'); });
  b.on('robot:added', () => { /* toast comes from economy:purchased */ });
  b.on('trash:changed', (p) => { if (p && p.cells > S.dbgCells) S.dbgCells = p.cells; });
  b.on('trash:milestone', onMilestone);
  b.on('district:cleaned', () => { S.completeT = U.completeDelayS; });
  b.on('player:mount', () => { hintDone('enterCart'); hintTrigger('enterCart'); S.toolsSig = null; });
  b.on('player:dismount', () => { S.toolsSig = null; hintSuspend('nozzle'); hintSuspend('cart'); });
  b.on('tool:changed', () => { S.toolsSig = null; S.offerId = null; });
  b.on('tool:nozzle', () => hintDone('nozzleToggle'));
  b.on('gl:lost', () => { if (S.held) release(); });
}

// ------------------------------------------------------------------------------------------ public API
export function toast(key, vars) { toastText(tx(key, vars), false); }
function toastText(text, big) {
  for (const t of S.toasts) if (t.text === text && !t.out) { t.left = U.toastS; return; }
  while (S.toasts.length >= 3) dropToast(S.toasts[0], true);
  const el = document.createElement('div');
  el.className = 'toast' + (big ? ' big' : '');
  el.textContent = text;
  E.toasts.appendChild(el);
  S.toasts.push({ el, text, left: U.toastS, out: false, outT: 0 });
}
function dropToast(t, now) {
  if (now) { t.el.remove(); S.toasts.splice(S.toasts.indexOf(t), 1); return; }
  t.out = true; t.outT = 0.3; t.el.classList.add('out');
}

export function openPanel(id) {
  if (S.panel === id) return;
  if (S.panel) closePanel(true);
  if (S.held) release();
  S.panel = id; S.resetAsk = false; S.panelAt = performance.now();
  if (id === 'shop') S.adNo = false;
  if (PANEL_PAUSES[id]) C.setPaused('panel', true);
  if (id === 'ad') { S.adT = 0; }
  renderPanel();
  C.bus.emit('ui:panel', { id, open: true });
  if (id === 'shop') { hintDone('shopOpen'); }
}
export function closePanel(silentSwap) {
  const id = S.panel; if (!id) return;
  S.panel = null;
  C.setPaused('panel', false);
  E.mwrap.innerHTML = '';
  E.panelRefs = null;
  C.bus.emit('ui:panel', { id, open: false });
  if (id === 'away' && S.msLater != null) { const k = S.msLater; S.msLater = null; S.awayMs = 0; onMilestone({ index: k, at: 0, quiet: true }); }
  if (!silentSwap && id === 'ad' && S.panelPrev) { const p = S.panelPrev; S.panelPrev = null; openPanel(p); }
}

// ------------------------------------------------------------------------------------------ save / load / resize
export function save() {
  const h = S.hints;
  return { v: 1, settings: Object.assign({}, C.state.settings), hintsDone: Object.keys(h.done), hb: h.shownBeforeBroom, msBoost: S.boostMsOffered, complete: S.completeShown };
}
export function load(d) {
  const st = C.state.settings;
  if (d && d.settings && typeof d.settings === 'object') {
    const keepLang = C.params && C.params.has && C.params.has('lang');
    for (const k of Object.keys(d.settings)) if (!(keepLang && k === 'lang')) st[k] = d.settings[k];
  }
  if (d && Array.isArray(d.hintsDone)) for (const k of d.hintsDone) S.hints.done[k] = true;
  if (d && d.hb) S.hints.shownBeforeBroom = d.hb | 0;
  if (d && d.msBoost) S.boostMsOffered = true;
  if (d && d.complete) S.completeShown = true;
  makeFormatters(); relabel();
  applyAudio();
  // snapshot for the "while you were away" card (economy may run its catch-up on game:ready, before ui's handler)
  snapshot();
  S.shown = S.target = num(call('economy', 'coins'));
}
export function resize() { applyOrientation(); measure(); }

function applyOrientation() {
  S.portrait = !!C.view.portrait;
  setCls(E.u, 'port', S.portrait);
}
function measure() {
  // layout reads: resize only
  const r = lrect(E.moneyIc);
  S.mx = r.left + r.width / 2; S.my = r.top + r.height / 2;
  const b = lrect(E.bagIc);
  S.bagX = b.left + b.width / 2; S.bagY = b.bottom;
  const a = lrect(E.act);
  S.actX = a.left + a.width / 2; S.actY = a.top;
  const W = lrect(E.cmp).width || 250;
  S.cmpW = W; S.ppd = W / U.compassSpanDeg;
  const step = 15 * S.ppd;
  E.cmpTk.style.width = (W + step * 2) + 'px';
  E.cmpTk.style.left = (-step) + 'px';
  E.cmpTk.style.setProperty('--tk', step.toFixed(2) + 'px');
  S.cmpStep = step;
  S.stkRestX = (C.view.safe.left || 0) + (S.portrait ? 96 : 110);
  S.stkRestY = C.view.h - (C.view.safe.bottom || 0) - (S.portrait ? 150 : 104);
  S.indX = -1;
}
function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

// ------------------------------------------------------------------------------------------ update
export function update(dt) {
  const rdt = C.time.dt || 0; // real seconds; UI animates while paused
  const econ = mod('economy'), player = mod('player');
  // finale (camera lift + completion card): the controls step aside so the clean district is the picture
  S.fin = !!(player && player.liftState && player.liftState() !== 0) || S.panel === 'complete';
  setCls(E.u, 'fin', S.fin);
  updateOffers();
  updateStick(player);
  updateMoney(econ, rdt);
  updatePose(player, rdt);
  updateIndicator();
  updateRobotTags(econ);
  updateHintPos();
  updateTimers(rdt);
  S.slowAcc += rdt;
  if (S.slowAcc >= 1 / U.slowHz || S.slowAcc < 0) { slowUpdate(S.slowAcc); S.slowAcc = 0; }
  if (E.dbg && (C.debug || C.perfHud || C.state.settings.perfHud)) { S.dbgAcc += rdt; if (S.dbgAcc >= 1 / U.debugHz) { S.dbgAcc = 0; updateDebug(); } }
  if (S.panel === 'ad') updateAd(rdt);
}

function updateOffers() {
  const o = C.offers; let top = null, sec = null;
  if (o && o.list) for (let i = 0; i < o.count; i++) {
    const e = o.list[i];
    if (!top || e.priority > top.priority) { sec = top; top = e; }
    else if ((!sec || e.priority > sec.priority) && e.id !== top.id) sec = e;
  }
  if (sec && sec.priority < U.secondaryMinPriority) sec = null;
  updateSecondary(sec);
  const id = top ? top.id : '', label = top ? top.label : '';
  if (top) { if (!S.actOfferObj) S.actOfferObj = { id: '', owner: '', label: '' }; S.actOfferObj.id = top.id; S.actOfferObj.owner = top.owner; S.actOfferObj.label = top.label; S.actOffer = S.actOfferObj; }
  else S.actOffer = null;
  if (id === S.offerId && label === S.offerLabel) return;
  const first = S.offerId == null;
  S.offerId = id; S.offerLabel = label;
  let icon, text;
  if (top) {
    icon = offerIcon(id, label);
    text = offerText(id, label);
  } else {
    const tool = call('tools', 'current') || 'brush';
    icon = tool === 'broom' ? 'broom' : tool === 'cart' ? 'cart' : 'brush';
    text = tx(tool === 'broom' ? 'act_tool_broom' : 'act_tool_brush');
    if (tool === 'cart') text = '';
  }
  E.act.firstElementChild.innerHTML = ICON[icon];
  setText(E.actLb, text);
  setCls(E.act, 'idle', !top);
  setCls(E.act, 'shop', id === 'shop');
  setCls(E.act, 'car', id === 'enter' || id === 'exit' || id === 'nozzle');
  if (!first) { E.act.classList.remove('apop'); void E.act.offsetWidth; E.act.classList.add('apop'); }
  if (id === 'shop') hintDone('nearShop');
}

function offerText(id, label) { return tx(label || ('act_' + id)); } // labels are STR keys (MIMARI §4.9)
function offerIcon(id, label) { return id === 'nozzle' && label === 'act_nozzle_up' ? 'nozzleUp' : (OFFER_ICON[id] || 'brush'); }
function updateSecondary(sec) {
  const id = sec ? sec.id : '', label = sec ? sec.label : '';
  if (sec) { if (!S.act2Obj) S.act2Obj = { id: '', owner: '' }; S.act2Obj.id = sec.id; S.act2Obj.owner = sec.owner; S.act2Offer = S.act2Obj; } else S.act2Offer = null;
  if (id === S.off2Id && label === S.off2Label) return;
  S.off2Id = id; S.off2Label = label;
  setHidden(E.act2, !sec);
  if (!sec) return;
  E.act2.firstElementChild.innerHTML = ICON[offerIcon(id, label)];
  setText(E.act2Lb, offerText(id, label));
  E.act2.classList.remove('apop'); void E.act2.offsetWidth; E.act2.classList.add('apop');
  const r = lrect(E.act2); S.act2X = r.left + r.width / 2; S.act2Y = r.top;   // discrete: on change only
}

function updateStick(player) {
  const inp = player && player.input ? player.input() : null;
  const s = inp && inp.stick;
  const active = !!(s && s.active);
  if (active) {
    if (S.stickOn !== true) { S.stickOn = true; setHidden(E.stk, false); setCls(E.stk, 'ghost', false); }
    tfXY(E.stk, s.cx, s.cy);
    tfXY(E.knob, s.x - s.cx + 64, s.y - s.cy + 64);
  } else if (S.stickOn !== false) {
    S.stickOn = false;
    const ghost = C.isTouch && !S.panel;
    setHidden(E.stk, !ghost); setCls(E.stk, 'ghost', true);
    tfXY(E.stk, S.stkRestX, S.stkRestY);
    tfXY(E.knob, 64, 64);
  }
}

function updateMoney(econ, rdt) {
  const c = num(econ && econ.coins ? econ.coins() : 0);
  if (c !== S.target) {
    const up = c > S.target;
    S.rollFrom = S.shown; S.target = c; S.rollT = 0;
    S.rollDur = up ? cfg('feedback.coinCounterRollS', 0.8) : 0.35;
    if (!up) S.rollDelay = 0;
  }
  if (S.rollDelay > 0) { S.rollDelay -= rdt; return; }
  if (S.rollT < 1) {
    S.rollT = Math.min(1, S.rollT + rdt / S.rollDur);
    const k = 1 - Math.pow(1 - S.rollT, 3);
    S.shown = S.rollFrom + (S.target - S.rollFrom) * k;
    if (S.rollT >= 1) { S.shown = S.target; if (S.target > S.rollFrom) bump(E.money); }
  } else S.shown = S.target;
  const v = Math.round(S.shown);
  if (v !== S.shownInt) { S.shownInt = v; setText(E.moneyNum, fmt(v)); }
}
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

function updatePose(player, rdt) {
  const p = player && player.pose ? player.pose() : null;
  if (!p) return;
  if (p.speed > 0.5 || Math.abs(p.speed) > 0.5) { S.notMovedS = 0; if (!S.movedEver) S.movedEver = true; hintDone('move'); }
  else S.notMovedS += rdt;
  // compass ticks + markers (transform writes only when changed)
  const yawDeg = p.yaw * 180 / Math.PI;
  const off = -(((yawDeg % 15) + 15) % 15) * S.ppd;
  tfXY(E.cmpTk, off, 0);
  const W = S.cmpW, half = W / 2;
  placeMk(E.mk.shop, S.shopPt, p, half);
  placeMk(E.mk.drop, S.dropPt, p, half);
  for (let i = 0; i < 4; i++) {
    if (i < S.rbN) placeMkXZ(E.mk.rb[i], S.rbX[i], S.rbZ[i], p, half); else setHidden(E.mk.rb[i], true);
  }
  for (let i = 0; i < 6; i++) {
    if (i < S.straggleN) placeMkXZ(E.mk.dirt[i], S.straggle[i * 2] || 0, S.straggle[i * 2 + 1] || 0, p, half); else setHidden(E.mk.dirt[i], true);
  }
}
function placeMk(el, pt, p, half) { if (!pt) { setHidden(el, true); return; } placeMkXZ(el, pt.x, pt.z, p, half); }
function placeMkXZ(el, x, z, p, half) {
  const brg = Math.atan2(x - p.x, -(z - p.z));
  let rel = (brg - p.yaw) * 180 / Math.PI;
  rel = ((rel + 540) % 360) - 180;
  const edge = Math.abs(rel) > U.compassSpanDeg / 2 - 6;
  let px = half + rel * S.ppd;
  if (px < 12) px = 12; if (px > half * 2 - 12) px = half * 2 - 12;
  setHidden(el, false);
  setCls(el, 'edge', edge);
  tfXY(el, px, 0);
}

// world point → screen; returns false when behind. Writes S.sx/S.sy, S.behind.
function project(x, y, z) {
  const cam = C.camera;
  cam.updateMatrixWorld();
  tmpV.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
  S.behind = tmpV.z > -0.05;
  tmpV.applyMatrix4(cam.projectionMatrix);
  let nx = tmpV.x, ny = tmpV.y;
  if (S.behind) { nx = -nx; ny = -ny; }
  S.sx = (nx * 0.5 + 0.5) * C.view.w; S.sy = (-ny * 0.5 + 0.5) * C.view.h;
  return !S.behind;
}

function wrapA(a) { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; }
function updateIndicator() {
  // what to point at: full bag → nearest sell point; hints → shop / cart
  const player = mod('player');
  const p = player && player.pose ? player.pose() : null;
  let kind = '', tgt = null, label = '';
  const h = S.hints.active;
  if (S.bagFull && S.nearSell) { tgt = S.nearSell; kind = tgt.id === 'dropoff' ? 'drop' : 'sell'; label = tx('sell_here'); }
  else if (h === 'sell' && S.nearSell) { tgt = S.nearSell; kind = 'sell'; label = tx('sell_here'); }
  else if (h === 'shop' && S.shopPt && S.offerId !== 'shop') { tgt = S.shopPt; kind = 'shopk'; label = tx('act_shop'); }
  else if (h === 'cart' && S.cartPt && S.offerId !== 'enter') { tgt = S.cartPt; kind = 'cartp'; label = tx('shop_cart'); }
  let dist = 0;
  if (tgt && p) {
    dist = Math.round(Math.hypot(tgt.x - p.x, tgt.z - p.z));
    if (dist < (tgt.r || 2.5) * 0.9) tgt = null;
  }
  if (!tgt || S.panel) { if (S.indOn) { S.indOn = false; setHidden(E.ind, true); } return; }
  if (!S.indOn) { S.indOn = true; setHidden(E.ind, false); }
  if (kind !== S.indKind) {
    S.indKind = kind;
    E.ind.className = 'ind ' + (kind === 'shopk' ? '' : kind); E.ind.__c = {};   // setCls caches classes: start clean
    E.indPin.innerHTML = svg(kind === 'drop' ? 'container' : kind === 'cartp' ? 'cart' : 'store');
  }
  if (dist !== S.indD || label !== S.indLabel) { S.indD = dist; S.indLabel = label; setText(E.indLab, label + '  ' + tx('dist_m', { n: fmt(dist) })); }
  const onScr = project(tgt.x, 1.3, tgt.z);
  const w = C.view.w, hh = C.view.h, sf = C.view.safe;
  const x0 = (sf.left || 0) + 40, x1 = w - (sf.right || 0) - 40, y0 = (sf.top || 0) + 112, y1 = hh - (sf.bottom || 0) - 150; // stays above the thumb controls
  let x = S.sx, y = S.sy, ang;
  // v2 (QA #1: a target behind looked exactly like one in front, and following it walked the wrong way): the pin with
  // its arrow down is used ONLY when the target is on screen; otherwise the pin sits on the left or right edge by the
  // target's bearing relative to the view, its arrow points that way, and a target behind gets the "turn round" look
  const rel = wrapA(Math.atan2(tgt.x - p.x, -(tgt.z - p.z)) - p.yaw);
  const inside = onScr && x >= x0 && x <= x1 && y >= y0 && y <= y1 && Math.abs(rel) < Math.PI / 2;
  const back = !inside && Math.abs(rel) > Math.PI * 0.6;
  if (inside) { ang = Math.PI; }
  else {
    const right = rel > 0;
    x = right ? x1 : x0;
    y = onScr && Math.abs(rel) < Math.PI / 2 ? Math.max(y0, Math.min(y1, y)) : (y0 + y1) / 2;
    ang = right ? Math.PI / 2 : -Math.PI / 2;
    if (S.indSide !== right) { S.indSide = right; E.ind.style.setProperty('--nx', right ? '7px' : '-7px'); }
  }
  setCls(E.ind, 'edge', !inside); setCls(E.ind, 'back', back);
  setCls(E.ind, 'on', inside);   // arrow points down → label goes above the pin
  const xi = Math.round(x), yi = Math.round(y);
  S.indX = xi; S.indY = yi; tfXY(E.ind, xi, yi);
  const deg = Math.round(ang * 180 / Math.PI);
  if (deg !== E.indArw.__deg) { E.indArw.__deg = deg; const ax = Math.round(Math.sin(ang) * 38), ay = Math.round(-Math.cos(ang) * 38); E.indArw.style.transform = 'translate3d(' + ax + 'px,' + ay + 'px,0) rotate(' + deg + 'deg)'; }
}

// name tags above robots within CONFIG.ui.robotTagMaxM that are on screen (DOM writes only on change)
function updateRobotTags(econ) {
  const rs = econ && econ.robots ? econ.robots() : null, n = rs ? Math.min(rs.length, E.tag.length) : 0;
  const cam = C.camera.position, max = U.robotTagMaxM || 26, hidden = !!S.panel || (C.mods.player && C.mods.player.liftState && C.mods.player.liftState() !== 0);
  for (let i = 0; i < E.tag.length; i++) {
    const g = E.tag[i];
    let show = false;
    if (i < n && !hidden) {
      const r = rs[i], dx = r.x - cam.x, dz = r.z - cam.z, d2 = dx * dx + dz * dz;
      // on screen and clear of the top HUD band and the thumb zone
      if (d2 < max * max && project(r.x, 0.62, r.z) && S.sx > 40 && S.sx < C.view.w - 40 && S.sy > (C.view.safe.top || 0) + 96 && S.sy < C.view.h - (C.view.safe.bottom || 0) - 110) {
        show = true;
        const name = robotTag(r, i);
        if (name !== g.name) { g.name = name; g.tx.textContent = name; }
        const col = robotColor(r, i); if (col !== g.col) { g.col = col; g.dot.style.background = col; g.el.style.setProperty('--rc', col); }
        const big = r.introT > 0;   // v2: a new robot's name tag is large for its first seconds (robot.introS)
        if (big !== g.big) { g.big = big; g.el.classList.toggle('big', big); }
        const x = Math.round(S.sx), y = Math.round(S.sy);
        if (x !== g.x || y !== g.y) { g.x = x; g.y = y; g.el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-100%)'; }
      }
    }
    if (show !== g.on) { g.on = show; g.el.hidden = !show; }
  }
}

function updateTimers(rdt) {
  // toasts
  for (let i = S.toasts.length - 1; i >= 0; i--) {
    const t = S.toasts[i];
    if (t.out) { t.outT -= rdt; if (t.outT <= 0) { t.el.remove(); S.toasts.splice(i, 1); } }
    else { t.left -= rdt; if (t.left <= 0) dropToast(t, false); }
  }
  // milestone banner
  if (S.msT > 0) { S.msT -= rdt; if (S.msT <= 0) hideMs(); }
  // completion card after the camera lift
  if (S.completeT >= 0) { S.completeT -= rdt; if (S.completeT < 0) showComplete(); }
  // batched "+N" coins-to-be near the bag
  if (S.pendingValue > 0) {
    S.popAcc += rdt;
    if (S.popAcc >= cfg('feedback.coinPopupBatchS', 0.25)) {
      S.popAcc = 0;
      popAtScreen(S.bagX + 30, S.bagY + 4, '+' + fmt(S.pendingValue), 'small', 0.7, -26);
      S.pendingValue = 0;
    }
  }
  if (S.collectTickT > 0) S.collectTickT -= rdt;
  // hints with a duration
  const h = S.hints;
  if (h.active) { h.t += rdt; const d = hintDef(h.active); if (d && d.durationS && h.t >= d.durationS) hintFinish(h.active); }
}

// ------------------------------------------------------------------------------------------ slow (10 Hz)
function slowUpdate() {
  const econ = mod('economy'), trash = mod('trash'), player = mod('player'), tools = mod('tools');
  if (!econ) return;
  const mounted = player && player.mounted ? player.mounted() : null;
  const tool = tools && tools.current ? tools.current() : 'brush';
  // container
  const cont = (mounted || tool === 'cart') ? 'tank' : 'bag';
  if (cont !== S.container) { S.container = cont; S.bagUnits = -1; setText(E.bagFl, tx(cont === 'tank' ? 'tank_full' : 'bag_full')); E.bagIc.innerHTML = ICON[cont === 'tank' ? 'cart' : 'bag']; }
  const units = num(econ.bagUnits(cont)), cap = num(econ.bagCapacity(cont));
  if (units !== S.bagUnits || cap !== S.bagCap) {
    S.bagUnits = units; S.bagCap = cap;
    const f = cap > 0 ? Math.min(1, units / cap) : 0;
    setTf(E.bagFill, 'scaleX(' + f.toFixed(3) + ')');
    setCls(E.bagBar, 'mid', f >= 0.7);
    setText(E.bagCnt, tx('bag_count', { n: fmt(units), m: fmt(cap) }));
  }
  const full = cap > 0 && units >= cap;
  if (full !== S.bagFull) { S.bagFull = full; setCls(E.bag, 'full', full); }
  // sell points + nearest active (for the indicator), shop point, cart park point
  const sp = econ.sellPoints ? econ.sellPoints() : null;
  const p = player && player.pose ? player.pose() : null;
  S.nearSell = null; S.dropPt = null; S.shopPt = null;
  if (sp && sp.length) {
    let best = 1e9;
    for (const s of sp) {
      if (s.id === 'shop') S.shopPt = s;
      if (s.id === 'dropoff' && s.active) S.dropPt = s;
      if (!s.active || !p) continue;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < best) { best = d; S.nearSell = s; }
    }
  }
  if (!S.shopPt) { const w = mod('world'); S.shopPt = w && w.point ? w.point('shop') : null; }
  if (!S.cartPt) { const w = mod('world'); S.cartPt = w && w.point ? w.point('cartPark') : null; }
  // district %
  if (trash && trash.cleanFraction) {
    let f = num(trash.cleanFraction());
    if (S.completeShown || S.completeT >= 0) f = 1;
    updateRing(f);
  }
  updateGoal(econ);
  updateBoost(econ);
  updateRobots(econ);
  updateTools(tools, mounted);
  updateStragglers(trash, p);
  hintCheck(econ);
  if (S.panel === 'shop') patchShop();
}

function updateRing(f) {
  const off = E.ringC * (1 - Math.max(0, Math.min(1, f)));
  if (Math.abs(off - S.ringOff) > 0.15) { S.ringOff = off; E.ringFil.setAttribute('stroke-dashoffset', off.toFixed(2)); }
  // 1 decimal below 10 % (early progress must be visible), whole numbers above
  const pct = f * 100;
  const shown = f >= 1 ? 100 : pct < 10 ? Math.floor(pct * 10) / 10 : Math.floor(pct);
  if (shown !== S.pctShown) { S.pctShown = shown; const s = tx('pct', { n: shown < 10 ? fmt1(shown) : fmt(shown) }); setText(E.ringV, s); setCls(E.ringV, 'w', s.length >= 4); }
  for (let i = 0; i < 3; i++) { const on = f >= (i + 1) * 0.25; if (on !== S.msOn[i]) { S.msOn[i] = on; E.ringDots[i].classList.toggle('on', on); } }
}

function updateGoal(econ) {
  const cat = econ.catalog ? econ.catalog() : null;
  if (!cat) return;
  S.catalog = cat;
  let next = null, cheapest = null, owned = 0;
  for (const it of cat) {
    if (it.state === 'owned') { owned++; continue; }
    if (it.state !== 'available') continue;
    if (it.next) next = it;
    if (!cheapest || it.price < cheapest.price) cheapest = it;
  }
  S.purchases = owned;
  next = next || cheapest;
  const coins = S.target;
  const sig = next ? next.id + '|' + C.state.settings.lang : 'none';
  if (sig !== S.goalSig) {
    S.goalSig = sig; S.goalFrac = -1;
    if (next) {
      E.goalTile.innerHTML = tile(next.id);
      setText(E.goalLbl, tx('shop_next'));
      setText(E.goalName, tx(next.strName));
      setText(E.goalPrice, fmt(next.price));
      setHidden(E.goalP, false);
    } else {
      E.goalTile.innerHTML = '<div class="tile cat-drop">' + svg('check') + '</div>';
      setText(E.goalLbl, tx('shop_title'));
      setText(E.goalName, tx('all_bought'));
      setHidden(E.goalP, true);
    }
    setCls(E.goal, 'done', !next);
  }
  if (!next) { setCls(E.goal, 'near', false); setCls(E.goal, 'ready', false); return; }
  let f = Math.min(1, coins / Math.max(1, next.price));
  if (owned === 0) f = U.endowedFirstGoal + (1 - U.endowedFirstGoal) * f; // endowed progress on the very first goal
  if (Math.abs(f - S.goalFrac) > 0.004) { S.goalFrac = f; setTf(E.goalBar, 'scaleX(' + f.toFixed(3) + ')'); }
  const ready = coins >= next.price;
  setCls(E.goal, 'ready', ready);
  setCls(E.goal, 'near', !ready && coins / next.price >= U.nearGoalAt);
  setText(E.goalLbl, tx(ready ? 'goal_ready' : 'shop_next'));
}

function updateBoost(econ) {
  const on = !!(econ.boostActive && econ.boostActive());
  if (on !== S.boostOn) { S.boostOn = on; setHidden(E.boost, !on); }
  if (on) {
    const left = Math.ceil(num(econ.boostLeft()));
    if (left !== S.boostLeft) { S.boostLeft = left; setText(E.boostT, tx('boost_active', { n: fmt(left) })); }
  }
}

function robotColor(r, i) {
  if (r && r.color != null) return typeof r.color === 'number' ? '#' + r.color.toString(16).padStart(6, '0') : r.color;
  return U.robotColors[i % U.robotColors.length];
}
function robotName(r, i) { return r && r.name ? r.name : tx(U.robotNames[i % U.robotNames.length]); }
function robotTag(r, i) { return tx('robot_name', { n: i + 1, name: robotName(r, i) }); }
function updateRobots(econ) {
  const rs = econ.robots ? econ.robots() : null;
  const n = rs ? Math.min(rs.length, 8) : 0;
  S.rbN = n;
  let sig = '' + n;
  for (let i = 0; i < n; i++) {
    const r = rs[i]; S.rbX[i] = r.x; S.rbZ[i] = r.z;
    sig += r.state === 'travel' || r.state === 'unload' || (r.cap && r.load >= r.cap) ? 'f' : 'c';
  }
  if (sig === S.robotsSig) return;
  S.robotsSig = sig;
  let h = '';
  for (let i = 0; i < Math.min(n, 4); i++) {
    const r = rs[i], full = sig[i + 1] === 'f';
    h += '<div class="rb' + (full ? ' full' : '') + (r.state === 'unload' ? ' blink' : '') + '" style="background:' + robotColor(r, i) + ';color:rgba(255,255,255,.95)">' + svg('robot') + '<i></i></div>';
  }
  E.rbs.innerHTML = h;
}

function updateTools(tools, mounted) {
  const av = tools && tools.available ? tools.available() : null;
  const cur = tools && tools.current ? tools.current() : 'brush';
  const list = [];
  if (av && !mounted) { if (av.indexOf('brush') >= 0) list.push('brush'); if (av.indexOf('broom') >= 0) list.push('broom'); }
  const sig = list.length > 1 ? list.join(',') + '|' + cur : '';
  if (sig === S.toolsSig) return;
  S.toolsSig = sig;
  setHidden(E.tools, !sig);
  if (!sig) return;
  let h = '';
  for (const id of list) h += '<button class="tb' + (id === cur ? ' on' : '') + '" data-tool="' + id + '" aria-label="' + tx(id === 'broom' ? 'act_tool_broom' : 'act_tool_brush') + '">' + svg(id === 'broom' ? 'broom' : 'brush') + '</button>';
  E.tools.innerHTML = h;
}

function updateStragglers(trash, p) {
  S.straggleN = 0;
  if (!trash || !trash.blockSums || !p) return;
  const f = trash.cleanFraction ? trash.cleanFraction() : 0;
  if (f < cfg('completion.stragglerHintAt', 0.9) || f >= 1) return;
  if (!S.strAcc) S.strAcc = 0;
  if ((S.strAcc = (S.strAcc + 1) % 5) !== 1 && S.straggleN0 != null) { S.straggleN = S.straggleN0; return; } // 2 Hz
  const info = trash.info ? trash.info() : null;
  const sums = trash.blockSums();
  if (!info || !sums) return;
  const nb = info.blocks || Math.round(Math.sqrt(sums.length));
  const bm = (info.size || 54) / nb;
  // up to 3 nearest dirty blocks
  let n = 0;
  const bx = S.straggle;
  for (let k = 0; k < 3; k++) {
    let best = 1e9, bi = -1;
    for (let i = 0; i < sums.length; i++) {
      if (sums[i] <= 0) continue;
      const x = ((i % nb) + 0.5) * bm, z = (Math.floor(i / nb) + 0.5) * bm;
      let skip = false; for (let j = 0; j < n; j++) if (Math.abs(bx[j * 2] - x) < 0.01 && Math.abs(bx[j * 2 + 1] - z) < 0.01) skip = true;
      if (skip) continue;
      const d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
      if (d < best) { best = d; bi = i; }
    }
    if (bi < 0) break;
    bx[n * 2] = ((bi % nb) + 0.5) * bm; bx[n * 2 + 1] = (Math.floor(bi / nb) + 0.5) * bm; n++;
  }
  S.straggleN = S.straggleN0 = n;
  if (n && !S.strToasted) { S.strToasted = true; toast('stragglers'); }
}

// ------------------------------------------------------------------------------------------ events → juice
function valueOf(byType) {
  if (!byType) return 0;
  const types = cfg('trashTypes', []);
  let v = 0;
  for (let i = 0; i < types.length && i < byType.length; i++) v += byType[i] * (types[i].value || 0);
  return v;
}
function onCollect(p) {
  if (!p) return;
  if (p.tool === 'brush') hintDone('pickup');
  if (p.tool === 'broom') hintDone('sweep');
  S.pendingValue += valueOf(p.byType);
  if (S.collectTickT <= 0) { S.collectTickT = 0.1; E.bag.classList.remove('tick'); void E.bag.offsetWidth; E.bag.classList.add('tick'); }
  if (p.valuable) {
    const vv = (cfg('trashTypes', []).find((t) => t.id === 'valuable') || { value: 50 }).value;
    if (p.x != null && project(p.x, (p.y || 0) + 0.4, p.z)) popAtScreen(S.sx, S.sy, '+' + fmt(vv), 'gold');
    else popAtScreen(C.view.w / 2, C.view.h * 0.42, '+' + fmt(vv), 'gold');
    toast('valuable_found');
  }
}
function onSold(p) {
  if (!p) return;
  const coins = num(p.coins);
  if (p.by === 'robot') {
    if (!S.fin && p.x != null && project(p.x, 0.9, p.z)) popAtScreen(S.sx, S.sy, '+' + fmt(coins), '');
    return;
  }
  hintDone('sale');
  haptic('medium');
  // the bag is emptying: a pending "bag full" toast is stale now
  for (let i = S.toasts.length - 1; i >= 0; i--) { const t = S.toasts[i]; if (!t.out && (t.text === tx('bag_full') || t.text === tx('tank_full'))) dropToast(t, true); }
  // coin shower from the sell point (or screen centre) to the counter; the counter rolls as they land
  let sx = C.view.w / 2, sy = C.view.h * 0.55;
  if (p.x != null && project(p.x, 1.4, p.z) && S.sx > 0 && S.sx < C.view.w && S.sy > 0 && S.sy < C.view.h) { sx = S.sx; sy = S.sy; }
  popAtScreen(sx, sy - 30, tx('sold', { n: fmt(coins) }) + (S.boostOn ? '  x2' : ''), 'big');
  coinShower(sx, sy, coins);
  S.rollDelay = cfg('feedback.coinFlyS', 0.7) * 0.75;
  if (p.valuable) toast('valuable_found');
}
function coinShower(sx, sy, coins) {
  const n = Math.max(3, Math.min(U.coinFlyMax, Math.round(3 + Math.log2(1 + coins) * 1.4)));
  const dur = cfg('feedback.coinFlyS', 0.7) * 1000;
  for (let i = 0; i < n; i++) {
    const el = E.coinPool[i];
    const ox = sx + (Math.random() - 0.5) * 70, oy = sy + (Math.random() - 0.5) * 40;
    const mx = (ox + S.mx) / 2 + (Math.random() - 0.5) * 120, my = Math.min(oy, S.my) - 40 - Math.random() * 60;
    el.animate([
      { transform: 'translate3d(' + ox + 'px,' + oy + 'px,0) scale(.4)', opacity: 0 },
      { transform: 'translate3d(' + ox + 'px,' + (oy - 20) + 'px,0) scale(1.1)', opacity: 1, offset: 0.15 },
      { transform: 'translate3d(' + mx + 'px,' + my + 'px,0) scale(1)', opacity: 1, offset: 0.55 },
      { transform: 'translate3d(' + S.mx + 'px,' + S.my + 'px,0) scale(.7)', opacity: 0.9 },
    ], { duration: dur, delay: i * 35, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'backwards' });
  }
}
function popAtScreen(x, y, text, cls, durS, rise) {
  const el = E.popPool[E.popI = (E.popI + 1) % E.popPool.length];
  el.className = 'pop' + (cls ? ' ' + cls : '');
  el.textContent = text;
  const d = (durS || 1.1) * 1000, r = rise || -60;
  el.animate([
    { transform: 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) scale(.6)', opacity: 0 },
    { transform: 'translate3d(' + x + 'px,' + (y - 10) + 'px,0) translate(-50%,-50%) scale(1.1)', opacity: 1, offset: 0.15 },
    { transform: 'translate3d(' + x + 'px,' + (y + r) + 'px,0) translate(-50%,-50%) scale(1)', opacity: 0 },
  ], { duration: d, easing: 'ease-out' });
}
function confetti(n, x, y, spread) {
  const cols = ['#ff4d5e', '#ffc531', '#3de3a8', '#33b5ff', '#a66bff', '#ff8a3d', '#ffffff'];
  const dur = cfg('feedback.milestoneConfettiS', 2.5) * 1000;
  n = Math.min(n, E.cfPool.length);
  for (let i = 0; i < n; i++) {
    const el = E.cfPool[i];
    el.style.background = cols[i % cols.length];
    const w = 7 + Math.random() * 7; el.style.width = w + 'px'; el.style.height = (w * (0.6 + Math.random())) + 'px';
    const a = -Math.PI / 2 + (Math.random() - 0.5) * spread, v = 160 + Math.random() * 260;
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v;
    const x1 = x + vx * 0.45, y1 = y + vy * 0.45;
    const x2 = x + vx * 0.9 + (Math.random() - 0.5) * 60, y2 = y + vy * 0.5 + 260 + Math.random() * 200;
    const r0 = Math.random() * 360, r1 = r0 + (Math.random() - 0.5) * 900;
    el.animate([
      { transform: 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + r0 + 'deg)', opacity: 1 },
      { transform: 'translate3d(' + x1 + 'px,' + y1 + 'px,0) rotate(' + (r0 + r1) / 2 + 'deg)', opacity: 1, offset: 0.35 },
      { transform: 'translate3d(' + x2 + 'px,' + y2 + 'px,0) rotate(' + r1 + 'deg)', opacity: 0 },
    ], { duration: dur * (0.75 + Math.random() * 0.5), delay: Math.random() * 120, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'backwards' });
  }
}

const PURCHASE_TOAST = { broom: 'got_broom', cart: 'got_cart', dropoff: 'got_dropoff' };
const CLOSE_ON_BUY = { broom: true, cart: true, robot_1: true, robot_2: true, robot_3: true, robot_4: true, dropoff: true };
function onPurchased(p) {
  if (!p) return;
  const id = p.id;
  haptic('heavy');
  hintDone('purchase');
  hintTrigger('buy:' + id);
  const key = PURCHASE_TOAST[id] || (/^robot_\d$/.test(id) ? 'got_robot' : 'got_upgrade');
  toastText(tx(key), true);
  S.goalSig = ''; S.shopSig = '';
  if (S.panel === 'shop') {
    patchShop(true);
    const c = E.mwrap.querySelector('.card[data-id="' + id + '"]');
    if (c) c.classList.add('got');
    if (CLOSE_ON_BUY[id]) { S.closeShopT = setTimeout(() => { if (S.panel === 'shop') closePanel(); }, 450); }
  }
}

function onMilestone(p) {
  if (!p) return;
  const ms = cfg('milestones', []);
  const m = ms[p.index] || { at: p.at, bonus: 0 };
  if ((m.at || p.at) >= 1) return; // 100 %: district:cleaned shows the complete card
  // v2 (psychology review): milestones crossed while away never fire hidden behind the welcome card: the card names
  // them; after it closes only the latest one shows, quietly (no confetti)
  if (S.panel === 'away') { S.msLater = p.index; S.awayMs = Math.max(S.awayMs || 0, m.at || p.at || 0); renderPanel(); return; }
  const quiet = !!p.quiet;
  if (!quiet) haptic('heavy');
  E.ring.classList.remove('ms'); void E.ring.offsetWidth; E.ring.classList.add('ms');
  setText(E.msT, tx(m.strId || 'ms_25'));
  E.msB.innerHTML = m.bonus ? svg('coin') + '<span>' + esc(tx('ms_bonus', { n: fmt(m.bonus) })) + '</span>' : '';
  let ad = false;
  const econ = mod('economy');
  const om = C.CONFIG.boost ? C.CONFIG.boost.offerOnMilestone : null;   // v2: null = no ad on milestone banners
  if (om != null && Math.abs((m.at || 0) - om) < 1e-6 && !S.boostMsOffered && econ && !(econ.boostActive && econ.boostActive()) && !(econ.boostCooldownLeft && econ.boostCooldownLeft() > 0)) {
    S.boostMsOffered = true; ad = true;
    E.msAd.innerHTML = adButton() + '<button class="bt ghost" data-act="no">' + esc(tx('no_thanks')) + '</button>';
  } else E.msAd.innerHTML = '';
  setCls(E.msb, 'has-ad', ad);
  E.msb.classList.add('on');
  S.msT = ad ? U.msBoostCardS : U.msCardS;
  if (!quiet) confetti(U.confetti, C.view.w / 2, (C.view.safe.top || 0) + 60, Math.PI * 1.1);
  C.bus.emit('game:saveNow', null);
}
function hideMs() { S.msT = 0; E.msb.classList.remove('on'); }
function adButton() { return '<button class="ad" data-act="ad"><span class="tag">' + esc(tx('ad_tag')) + '</span>' + svg('tv') + '<span>' + esc(tx('boost_offer')) + '</span></button>'; }

function showComplete() {
  S.completeT = -1;
  if (S.completeShown) return;
  S.completeShown = true;
  updateRing(1);
  openPanel('complete');
  confetti(U.confettiBig, C.view.w / 2, C.view.h * 0.35, Math.PI * 1.6);
  C.bus.emit('game:saveNow', null);
}

// ------------------------------------------------------------------------------------------ away card
function snapshot() {
  const e = mod('economy'), t = mod('trash');
  S.snapCoins = num(e && e.coins ? e.coins() : 0);
  S.snapUnits = num(t && t.totalUnits ? t.totalUnits() : 0);
}
function onSaved(p) {
  if (!p || !p.persistent || S.panel === 'complete') return;
  const now = performance.now(); if (now - (S.svdAt || 0) < 900) return; S.svdAt = now;
  const el = E.svd; setText(E.svdLb, tx('saved'));
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
function showStorageNote(st) {
  if (!st || st.persistent || C.params.has('nosave')) return;
  E.snote.textContent = tx(st.kind === 'session' ? 'save_session' : 'save_none');
  setHidden(E.snote, false); E.snote.classList.remove('fade');
  clearTimeout(S.snoteT); S.snoteT = setTimeout(() => E.snote.classList.add('fade'), 9000);
}
function onReady(p) {
  showStorageNote(p && p.storage);
  S.gameS0 = C.time.game;
  if (p && !p.fresh) onAway(p.awayS || 0);
  else snapshot();
  applyAudio();
}
function onAway(awayS) {
  if (S.offlineSeen) { S.offlineSeen = false; snapshot(); return; } // economy:offline already showed the exact numbers
  const e = mod('economy'), t = mod('trash');
  const coins = num(e && e.coins ? e.coins() : 0) - S.snapCoins;
  const units = S.snapUnits - num(t && t.totalUnits ? t.totalUnits() : 0);
  snapshot();
  if (awayS >= U.awayMinS && (units > 0 || coins > 0)) showAway(Math.max(0, units), Math.max(0, coins), awayS);
}
function showAway(units, coins, awayS, capped, limitBy) {
  if (!(units > 0 || coins > 0)) return;
  S.away = { units, coins, capped: capped != null ? !!capped : awayS > U.offlineCapS, limitBy: limitBy || '' };
  if (S.panel && S.panel !== 'away') return;
  openPanel('away');
}

// ------------------------------------------------------------------------------------------ hints
function hintDef(id) { const hs = cfg('hints', []); for (const h of hs) if (h.id === id) return h; return null; }
// show-triggers that are events (bagFull, buy:<id>, enterCart)
function hintTrigger(ev) {
  for (const h of cfg('hints', [])) if (h.showOn === ev) hintQueue(h.id);
}
function hintQueue(id) {
  const H = S.hints;
  if (H.done[id] || H.active === id || H.queue.indexOf(id) >= 0) return;
  const econ = mod('economy');
  const broom = econ && econ.owned && econ.owned('broom');
  if (!broom && H.shownBeforeBroom >= 4) return;  // TASARIM §5: at most 4 hints before the broom
  if (!H.active) hintShow(id); else H.queue.push(id);
}
function hintShow(id) {
  const H = S.hints, econ = mod('economy');
  H.active = id; H.t = 0;
  if (!(econ && econ.owned && econ.owned('broom'))) H.shownBeforeBroom++;
  const d = hintDef(id);
  setText(E.hintBub, tx(d ? d.strId : 'hint_' + id));
  S.hintHalfW = 0;
  S.hintPos = null;
  setHidden(E.hint, false);
  setHidden(E.taph, true);   // v2: no "tap to pick" pointer any more
  setHidden(E.ghost, !(id === 'walk' || id === 'broom' || id === 'brush'));
}
function hintFinish(id) {
  const H = S.hints;
  H.done[id] = true;
  const qi = H.queue.indexOf(id); if (qi >= 0) H.queue.splice(qi, 1);
  if (H.active !== id) return;
  H.active = null;
  setHidden(E.hint, true); setHidden(E.taph, true); setHidden(E.ghost, true);
  while (H.queue.length) { const n = H.queue.shift(); if (!H.done[n]) { hintShow(n); break; } }
}
// hint no longer applicable right now (e.g. nozzle after getting out): hide without marking it done
function hintSuspend(id) {
  const H = S.hints;
  const qi = H.queue.indexOf(id); if (qi >= 0) H.queue.splice(qi, 1);
  if (H.active !== id) return;
  H.active = null;
  setHidden(E.hint, true); setHidden(E.taph, true); setHidden(E.ghost, true);
  while (H.queue.length) { const n = H.queue.shift(); if (!H.done[n]) { hintShow(n); break; } }
}
// doneOn events: pickup, sale, purchase, move, sweep, enterCart, nozzleToggle (+ ui-internal nearShop/shopOpen)
function hintDone(ev) {
  const H = S.hints;
  for (const h of cfg('hints', [])) {
    if (h.doneOn === ev && !H.done[h.id]) {
      // only hints that were shown or are queued are finished by their action; 'pick' is also finished by picking
      if (H.active === h.id || H.queue.indexOf(h.id) >= 0 || h.showAtS === 0 || ev === 'move') hintFinish(h.id);
    }
  }
}
function hintCheck(econ) {
  const H = S.hints, g = C.time.game;
  for (const h of cfg('hints', [])) {
    if (H.done[h.id] || H.active === h.id) continue;
    if (h.showAtS != null && g >= h.showAtS) {
      if (h.onlyIfNotMovedS != null) { if (S.notMovedS < h.onlyIfNotMovedS) continue; }
      hintQueue(h.id);
    }
    if (h.showOn === 'canAffordFirst' && S.purchases === 0 && S.catalog.length) {
      let cheapest = 1e12; for (const it of S.catalog) if (it.state === 'available' && it.price < cheapest) cheapest = it.price;
      if (S.target >= cheapest) hintQueue(h.id);
    }
  }
}
// hint bubble anchor (per frame, transform only)
function updateHintPos() {
  const id = S.hints.active; if (!id) return;
  const off = !!S.panel;
  if (off !== S.hintOff) { S.hintOff = off; setCls(E.hint, 'off', off); setCls(E.taph, 'off', off); setCls(E.ghost, 'off', off); }
  if (off) return;
  let x, y, below = false;
  if (id === 'nozzle' && S.off2Id === 'nozzle') { x = S.act2X; y = S.act2Y - 8; }
  else if (id === 'nozzle' || (id === 'shop' && S.offerId === 'shop') || (id === 'cart' && S.offerId === 'enter')) {
    x = S.actX; y = S.actY - 8;
  } else if (id === 'walk' || id === 'broom' || id === 'brush') {
    x = S.stkRestX; y = S.stkRestY - 80;
    tfXY(E.ghost, S.stkRestX, S.stkRestY);
  } else if ((id === 'sell' || id === 'shop' || id === 'cart') && S.indOn) {
    const labUp = E.ind.classList.contains('on');
    x = S.indX; y = S.indY - (labUp ? 66 : 34); if (y < 150) { y = S.indY + (labUp ? 40 : 70); below = true; }
  } else { x = C.view.w / 2; y = (C.view.safe.top || 0) + (S.portrait ? 360 : 150); }
  // keep the bubble on screen
  if (!S.hintHalfW) S.hintHalfW = E.hintBub.offsetWidth / 2 || 90;   // measured once per shown hint
  const m = S.hintHalfW + 8; if (x < m) x = m; if (x > C.view.w - m) x = C.view.w - m;
  setCls(E.hint, 'dn', below);
  tfXY(E.hint, x, y);
}

// ------------------------------------------------------------------------------------------ panels
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function renderPanel() {
  const id = S.panel;
  let h = '';
  if (id === 'shop') h = shopHtml();
  else if (id === 'pause' || id === 'settings') h = pauseHtml();
  else if (id === 'complete') h = completeHtml();
  else if (id === 'away') h = awayHtml();
  else if (id === 'ad') h = adHtml();
  else h = '';
  E.mwrap.innerHTML = h;
  E.panelRefs = null;
  if (id === 'shop') { S.shopSig = ''; patchShop(true); }
  setHidden(E.stk, true); S.stickOn = null;
}
function hdr(icon, title, extra) {
  return '<div class="pn-hd"><div class="pn-ti">' + svg(icon) + '<span>' + esc(title) + '</span></div>' + (extra || '') + '<button class="xb" data-act="close" aria-label="' + esc(tx('shop_close')) + '">' + svg('close') + '</button></div>';
}

// ---- shop
function shopHtml() {
  return '<div class="mw"><div class="bd" data-act="close"></div><div class="pn pn-shop">' +
    hdr('store', tx('shop_title'), '<div class="pn-co">' + svg('coin') + '<span class="pcv"></span></div>') +
    '<div class="pn-bd"><div class="sh-c"></div><div class="sh-s">' +
      '<div class="sbx boostbx" hidden></div>' +
      '<div class="sbx rbx"><div class="sbx-t">' + esc(tx('robots_title')) + '</div><div class="rlist"></div></div>' +
      promoHtml() +
    '</div></div></div></div>';
}
function promoHtml() {
  const games = cfg('promo.games', []);
  let cards = '';
  for (const g of games) cards += '<button class="pcard" data-act="promo" data-id="' + esc(g.id) + '"><div class="art">' + promoArt(g.id) + '</div><span class="pn2">' + esc(tx(g.strName)) + '</span><span class="soon">' + esc(tx('barrier_soon')) + '</span></button>';
  return '<div class="sbx promo"><div class="sbx-t">' + svg('star') + esc(tx('promo_label')) + '</div><div class="pc">' + cards + '</div></div>';
}
// placeholder art for the studio's games (no external assets)
function promoArt(id) {
  if (id === 'yikim-ustasi') return '<svg viewBox="0 0 120 62" preserveAspectRatio="xMidYMid slice"><rect width="120" height="62" fill="#ff9b3d"/><rect y="44" width="120" height="18" fill="#c4612a"/><rect x="62" y="14" width="22" height="30" fill="#ffe0b8"/><rect x="66" y="18" width="5" height="5" fill="#c4612a"/><rect x="75" y="18" width="5" height="5" fill="#c4612a"/><rect x="66" y="28" width="5" height="5" fill="#c4612a"/><rect x="88" y="26" width="16" height="18" fill="#ffe0b8"/><path d="M20 4L44 4L44 8L24 8L24 44L18 44L18 4Z" fill="#3a2a1e"/><path d="M40 8L40 26" stroke="#3a2a1e" stroke-width="1.5"/><circle cx="40" cy="31" r="6" fill="#3a2a1e"/><circle cx="55" cy="18" r="2" fill="#fff"/><circle cx="58" cy="24" r="1.4" fill="#fff"/></svg>';
  return '<svg viewBox="0 0 120 62" preserveAspectRatio="xMidYMid slice"><rect width="120" height="62" fill="#3d8bff"/><g fill="#fff" opacity=".9">' +
    [0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5].map((c) => '<rect x="' + (14 + c * 16) + '" y="' + (4 + r * 14) + '" width="13" height="11" rx="3"/>').join('')).join('') +
    '</g><path d="M20 9H68V23H52V37H84V51" fill="none" stroke="#ff5f6d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><text x="36" y="13" font-size="8" font-weight="900" fill="#ff5f6d" font-family="sans-serif">3</text></svg>';
}
function effectHtml(it) {
  const def = (cfg('shop.items', []).find((x) => x.id === it.id) || {}).effect;
  if (!def) return '';
  const v = def.value, eco = mod('economy');
  let a = null, b = null, unit = 'u_items';
  const arr = (p) => cfg(p, []);
  switch (def.set) {
    case 'bag.level': a = arr('bag.capacity')[v - 1]; b = arr('bag.capacity')[v]; break;
    case 'broom.owned': return '<div class="fx"><span class="a">' + esc(tx('act_tool_brush')) + '</span>' + svg('chevron', 'ar') + '<b>' + esc(tx('act_tool_broom')) + '</b></div>';
    case 'brush.level': a = arr('brush.widthM')[v - 1]; b = arr('brush.widthM')[v]; unit = 'u_m'; break;
    case 'player.speedLevel': a = arr('player.walkSpeed')[v - 1]; b = arr('player.walkSpeed')[v]; unit = 'u_mps'; break;
    case 'cart.suctionLevel': a = arr('cart.cleanSpeedMax')[v - 1]; b = arr('cart.cleanSpeedMax')[v]; unit = 'u_mps'; break;
    case 'broom.widthLevel': a = arr('broom.widthM')[v - 1]; b = arr('broom.widthM')[v]; unit = 'u_m'; break;
    case 'broom.speedLevel': a = arr('broom.sweepSpeed')[v - 1]; b = arr('broom.sweepSpeed')[v]; unit = 'u_mps'; break;
    case 'sell.dropoff': a = 1; b = 2; unit = 'u_points'; break;
    case 'robot.count': a = v - 1; b = v; unit = 'u_robots'; break;
    case 'robot.speedLevel': a = arr('robot.cleanSpeed')[v - 1]; b = arr('robot.cleanSpeed')[v]; unit = 'u_mps'; break;
    case 'robot.capLevel': a = arr('robot.capacity')[v - 1]; b = arr('robot.capacity')[v]; break;
    case 'cart.owned': a = num(eco && eco.stat ? eco.stat('broomWidth') : 0) || arr('broom.widthM')[0]; b = arr('cart.nozzleWidthM')[0]; unit = 'u_m'; break;
    case 'cart.tankLevel': a = arr('cart.tank')[v - 1]; b = arr('cart.tank')[v]; break;
    case 'cart.widthLevel': a = arr('cart.nozzleWidthM')[v - 1]; b = arr('cart.nozzleWidthM')[v]; unit = 'u_m'; break;
    default: return '';
  }
  if (a == null || b == null) return '';
  const f = (x) => (Math.round(x) === x ? fmt(x) : fmt1(x));
  return '<div class="fx"><span class="a">' + esc(f(a)) + '</span>' + svg('chevron', 'ar') + '<b>' + esc(tx(unit, { n: f(b) })) + '</b></div>';
}
function cardHtml(it) {
  const aff = S.target >= it.price;
  return '<div class="card' + (it.next ? ' next' : '') + (aff ? ' afford' : '') + '" data-id="' + esc(it.id) + '">' +
    (it.next ? '<span class="rib">' + esc(tx('shop_next')) + '</span>' : '') +
    '<div class="top">' + tile(it.id) + '<div><div class="nm">' + esc(tx(it.strName)) + '</div>' + effectHtml(it) + '</div></div>' +
    '<div class="ds">' + esc(tx(it.strDesc)) + '</div>' +
    (aff
      ? '<button class="bt buy" data-act="buy" data-id="' + esc(it.id) + '">' + svg('coin') + '<span>' + fmt(it.price) + '</span></button>'
      : '<div class="need"><button class="bt grey buy" disabled>' + svg('coin') + '<span>' + fmt(it.price) + '</span></button><div class="bar"><i></i></div><div class="nt"></div></div>') +
    '</div>';
}
function patchShop(force) {
  const root = E.mwrap; if (!root || S.panel !== 'shop') return;
  const econ = mod('economy'); if (!econ) return;
  const cat = (econ.catalog && econ.catalog()) || [];
  S.catalog = cat;
  // structure signature: ids, states, next, affordability
  let sig = C.state.settings.lang;
  const avail = [], owned = [];
  for (const it of cat) {
    if (it.state === 'available') avail.push(it); else if (it.state === 'owned') owned.push(it);
    sig += '|' + it.id + it.state[0] + (it.next ? 'n' : '') + (S.target >= it.price ? 'a' : '');
  }
  avail.sort((a, b) => a.price - b.price);
  const cards = root.querySelector('.sh-c');
  if (force || sig !== S.shopSig) {
    S.shopSig = sig;
    let h = '';
    for (const it of avail) h += cardHtml(it);
    if (owned.length) { h += '<div class="owned"><span>' + esc(tx('owned_title')) + '</span>'; for (const it of owned) h += '<span title="' + esc(tx(it.strName)) + '">' + tile(it.id) + '</span>'; h += '</div>'; }
    if (cards) cards.innerHTML = h;
    S.shopNeed = [];
    for (const it of avail) if (S.target < it.price) {
      const c = root.querySelector('.card[data-id="' + it.id + '"]');
      if (c) S.shopNeed.push({ price: it.price, bar: c.querySelector('.need .bar>i'), nt: c.querySelector('.need .nt'), f: -1, n: -1 });
    }
    S.shopCo = root.querySelector('.pcv');
  }
  const coins = S.target;
  if (S.shopCo) setText(S.shopCo, fmt(Math.round(S.shown)));
  for (const n of S.shopNeed || []) {
    const f = Math.min(1, coins / n.price);
    if (Math.abs(f - n.f) > 0.003) { n.f = f; setTf(n.bar, 'scaleX(' + f.toFixed(3) + ')'); }
    const left = Math.max(0, n.price - Math.floor(coins));
    if (left !== n.n) { n.n = left; setText(n.nt, tx('shop_no_money', { n: fmt(left) })); }
  }
  patchBoostBox(root, econ);
  patchRobotList(root, econ);
}
function patchBoostBox(root, econ) {
  const box = root.querySelector('.boostbx'); if (!box) return;
  const active = !!(econ.boostActive && econ.boostActive());
  const can = !!(econ.canOfferBoost && econ.canOfferBoost());
  // v2 (psychology review): no countdown text here (it read as urgency). Active: "Şu an aktif". Cooling down: nothing.
  // The offer carries an equally visible "Hayır, teşekkürler" that hides it for this visit of the shop.
  const mode = active ? 'on' : can && !S.adNo ? 'offer' : '';
  const sig = mode + C.state.settings.lang;
  if (sig === box.__sig) return;
  box.__sig = sig;
  setHidden(box, !mode);
  if (mode === 'on') box.innerHTML = '<div class="on">' + svg('bolt') + '<span>' + esc(tx('boost_now')) + '</span></div>';
  else if (mode === 'offer') box.innerHTML = adButton() + '<button class="bt grey nad" data-act="noad">' + esc(tx('no_thanks')) + '</button>';
}
function patchRobotList(root, econ) {
  const list = root.querySelector('.rlist'); if (!list) return;
  const rs = (econ.robots && econ.robots()) || [];
  let sig = C.state.settings.lang + rs.length;
  for (const r of rs) sig += r.state + Math.round(10 * (r.cap ? r.load / r.cap : 0));
  if (sig === list.__sig) return;
  list.__sig = sig;
  if (!rs.length) { list.innerHTML = '<div class="rnone">' + esc(tx('robots_none')) + '</div>'; return; }
  let h = '';
  rs.forEach((r, i) => {
    const f = r.cap ? Math.min(1, r.load / r.cap) : 0;
    h += '<div class="rrow' + (f >= 1 ? ' full' : '') + '"><div class="rdot" style="background:' + robotColor(r, i) + ';color:#fff">' + svg('robot') + '</div><div class="rtx"><span class="rn">' +
      esc(robotTag(r, i)) + '</span><span class="rs">' + esc(tx(STATE_KEY[r.state] || 'robot_clean')) + '</span><div class="bar"><i style="transform:scaleX(' + f.toFixed(2) + ')"></i></div></div></div>';
  });
  list.innerHTML = h;
}

// ---- pause / settings
function pauseHtml() {
  const s = C.state.settings;
  const tg = (k, on) => '<button class="tg' + (on ? ' on' : '') + '" data-act="tg" data-k="' + k + '" role="switch" aria-checked="' + !!on + '" aria-label="' + esc(tx(on ? 'on' : 'off')) + '"></button>';
  const seg = (k, opts) => '<div class="seg">' + opts.map((o) => '<button data-act="set" data-k="' + k + '" data-v="' + o[0] + '"' + (String(s[k]) === String(o[0]) ? ' class="on"' : '') + '>' + esc(o[1]) + '</button>').join('') + '</div>';
  const sensOpts = U.sensSteps.map((v, i) => [v, String(i + 1)]);
  const nearest = U.sensSteps.reduce((b, v) => (Math.abs(v - s.sens) < Math.abs(b - s.sens) ? v : b), U.sensSteps[0]);
  const sensSeg = '<div class="seg">' + sensOpts.map((o) => '<button data-act="set" data-k="sens" data-v="' + o[0] + '"' + (o[0] === nearest ? ' class="on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  return '<div class="mw"><div class="bd"></div><div class="pn pn-pause">' +
    hdr('pause', tx('paused')) +
    '<div class="pn-bd"><div class="set">' +
      '<div class="srow">' + svg('sound') + '<span class="sl">' + esc(tx('sound')) + '</span>' + tg('sound', s.sound) + '</div>' +
      '<div class="srow">' + svg('leaf') + '<span class="sl">' + esc(tx('ambient')) + '</span>' + tg('music', s.music) + '</div>' +
      // haptics: only where something can vibrate (iOS Safari and the artifact have no navigator.vibrate; the app has Capacitor)
      (canVibrate() ? '<div class="srow">' + svg('vibrate') + '<span class="sl">' + esc(tx('haptics')) + '</span>' + tg('haptics', s.haptics) + '</div>' : '') +
      '<div class="srow">' + svg('globe') + '<span class="sl">' + esc(tx('language')) + '</span>' + seg('lang', [['tr', 'TR'], ['en', 'EN']]) + '</div>' +
      '<div class="srow">' + svg('eye') + '<span class="sl">' + esc(tx('sensitivity')) + '</span>' + sensSeg + '</div>' +
      '<div class="srow wide">' + svg('wheel') + '<span class="sl">' + esc(tx('steer_mode')) + '</span>' + seg('steer', [['camera', tx('steer_camera')], ['tank', tx('steer_tank')]]) + '</div>' +
      '<div class="srow wide">' + svg('sparkle') + '<span class="sl">' + esc(tx('quality')) + '</span>' + seg('quality', [['auto', tx('q_auto')], ['high', tx('q_high')], ['low', tx('q_low')]]) + '</div>' +
      '<div class="srow wide">' + svg('eye') + '<span class="sl">' + esc(tx('fov')) + '</span>' + fovSlider() + '</div>' +
      (C.isTouch || C.view.rot || C.view.portrait || s.portrait ? '<div class="srow">' + svg('reset') + '<span class="sl">' + esc(tx('portrait_play')) + '</span>' + tg('portrait', s.portrait) + '</div>' +
        '<div class="srow">' + svg('reset') + '<span class="sl">' + esc(tx('flip_screen')) + '</span>' + tg('flip', s.flip) + '</div>' : '') +
      '<div class="srow">' + svg('sparkle') + '<span class="sl">' + esc(tx('perf_hud')) + '</span>' + tg('perfHud', s.perfHud) + '</div>' +
      '<div class="srow wide rst">' + svg('reset') + (S.resetAsk
        ? '<div class="cfm"><span>' + esc(tx('reset_confirm')) + '</span><button class="bt grey" data-act="rno">' + esc(tx('cancel')) + '</button><button class="bt red" data-act="ryes">' + esc(tx('reset_yes')) + '</button></div>'
        : '<span class="sl">' + esc(tx('reset_save')) + '</span><button class="bt grey" data-act="rask">' + esc(tx('reset_save')) + '</button>') + '</div>' +
    '</div></div>' +
    (C.save && C.save.status && !C.save.status.persistent && !C.params.has('nosave') ? '<div class="snote2">' + esc(tx(C.save.status.kind === 'session' ? 'save_session' : 'save_none')) + '</div>' : '') +
    '<div class="pfoot"><button class="bt blue" data-act="close">' + svg('chevron') + esc(tx('resume')) + '</button></div>' +
    '</div></div>';
}

// FOV slider (settings.fov, horizontal degrees in landscape; main applies it on ui:settings)
function canVibrate() { return !!((window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) || navigator.vibrate); }
function fovRange() { return cfg('player.fovRangeDeg', [85, 115]); }
function fovSlider() {
  const [a, b] = fovRange(), v = Math.max(a, Math.min(b, num(+C.state.settings.fov) || cfg('player.fovHorizontalDegLandscape', 104))), f = (v - a) / (b - a);
  return '<div class="sld" data-sld="fov" role="slider" aria-valuemin="' + a + '" aria-valuemax="' + b + '" aria-valuenow="' + v + '" aria-label="' + esc(tx('fov')) + '"><div class="trk"><i style="width:' + (f * 100).toFixed(1) + '%"></i><b style="left:' + (f * 100).toFixed(1) + '%"></b></div><span class="sv">' + esc(tx('fov_val', { n: Math.round(v) })) + '</span></div>';
}
const SLP = { x: 0, y: 0 };
function sliderAt(el, e) {
  const trk = el.querySelector('.trk'), r = lrect(trk), tv = C.view.toView, p = tv ? tv(e.clientX, e.clientY, SLP) : (SLP.x = e.clientX, SLP.y = e.clientY, SLP);
  const [a, b] = fovRange(), step = cfg('player.fovStepDeg', 1);
  const f = Math.max(0, Math.min(1, (p.x - r.left) / Math.max(1, r.width)));
  const v = Math.round((a + f * (b - a)) / step) * step;
  if (v !== C.state.settings.fov) {
    C.state.settings.fov = v;
    const ff = (v - a) / (b - a);
    trk.firstElementChild.style.width = (ff * 100).toFixed(1) + '%'; trk.lastElementChild.style.left = (ff * 100).toFixed(1) + '%';
    el.querySelector('.sv').textContent = tx('fov_val', { n: v }); el.setAttribute('aria-valuenow', String(v));
    C.bus.emit('ui:settings', C.state.settings);
  }
}
function bindSliders() {
  E.mwrap.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-sld]'); if (!el) return;
    e.preventDefault(); S.sld = { el, id: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    sliderAt(el, e);
  });
  E.mwrap.addEventListener('pointermove', (e) => { if (S.sld && S.sld.id === e.pointerId) { e.preventDefault(); sliderAt(S.sld.el, e); } });
  const end = (e) => { if (S.sld && S.sld.id === e.pointerId) { S.sld = null; S.dragAt = performance.now(); settingsChanged(); } };
  E.mwrap.addEventListener('pointerup', end); E.mwrap.addEventListener('pointercancel', end);
}
// rotated stage: scroll panel lists with our own drag (the browser's native touch scrolling works in screen axes)
function bindRotScroll() {
  let sc = null, lx = 0, ly = 0, moved = 0, id = -1;
  const pt = { x: 0, y: 0 };
  E.mwrap.addEventListener('touchstart', (e) => {
    if (!C.view.rot || S.sld) { sc = null; return; }
    const t = e.changedTouches[0]; sc = e.target.closest('.pn-bd'); if (!sc) return;
    id = t.identifier; C.view.toView(t.clientX, t.clientY, pt); lx = pt.x; ly = pt.y; moved = 0;
  }, { passive: true });
  E.mwrap.addEventListener('touchmove', (e) => {
    if (!sc || !C.view.rot) return;
    let t = null; for (const x of e.changedTouches) if (x.identifier === id) t = x; if (!t) return;
    C.view.toView(t.clientX, t.clientY, pt);
    const dx = pt.x - lx, dy = pt.y - ly; lx = pt.x; ly = pt.y; moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 6) { sc.scrollLeft -= dx; sc.scrollTop -= dy; S.dragAt = performance.now(); }
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  E.mwrap.addEventListener('touchend', () => { sc = null; }, { passive: true });
}

// ---- complete
function completeHtml() {
  const econ = mod('economy');
  const st = (econ && econ.stats && econ.stats()) || { items: 0, coins: 0, playS: C.time.game };
  const s = Math.round(num(st.playS) || C.time.game), mm = Math.floor(s / 60), ss = s % 60;
  const time = mm + ':' + (ss < 10 ? '0' : '') + ss;
  const C2 = 2 * Math.PI * 40;
  return '<div class="mw done"><div class="bd"></div><div class="pn pn-done">' +
    hdr('trophy', tx('ms_100')) +
    '<div class="pn-bd done-bd">' +
      '<div class="done-top"><div class="bigring"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="40" fill="#e9f8f1" stroke="#d4eee2" stroke-width="10"/><circle cx="48" cy="48" r="40" fill="none" stroke="url(#uRingG)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C2.toFixed(1) + '" stroke-dashoffset="0"/></svg><div class="t">' + esc(tx('pct', { n: 100 })) + '</div></div>' +
      '<div class="stats">' +
        '<div class="stat">' + svg('clock') + '<span class="sv">' + time + '</span><span class="sk">' + esc(tx('stat_time')) + '</span></div>' +
        '<div class="stat">' + svg('bag') + '<span class="sv">' + fmt(num(st.items)) + '</span><span class="sk">' + esc(tx('stat_items')) + '</span></div>' +
        '<div class="stat">' + svg('coin') + '<span class="sv">' + fmt(num(st.coins)) + '</span><span class="sk">' + esc(tx('stat_coins')) + '</span></div>' +
      '</div></div>' +
      '<div class="nextd">' + esc(tx('next_district')) + '</div>' +
      (cfg('promo.onCompleteCards', true) ? '<div class="done-promo">' + promoHtml() + '</div>' : '') +
    '</div>' +
    '<div class="pfoot"><button class="bt" data-act="close">' + esc(tx('continue')) + '</button></div>' +
    '</div></div>';
}

// ---- away
function awayHtml() {
  const a = S.away || { units: 0, coins: 0, capped: false };
  return '<div class="mw"><div class="bd" data-act="close"></div><div class="pn pn-away">' +
    hdr('robot', tx('away_title')) +
    '<div class="pn-bd away-bd">' +
      '<div class="big">' + esc(tx('away_body', { n: fmt(a.units) })) + '</div>' +
      (a.coins > 0 ? '<div class="cn">' + svg('coin') + '<span>' + esc(tx('away_coins', { n: fmt(a.coins) })) + '</span></div>' : '') +
      (S.awayMs ? '<div class="cn">' + svg('star') + '<span>' + esc(tx('away_ms', { n: Math.round(S.awayMs * 100) })) + '</span></div>' : '') +
      (a.limitBy === 'nextItem' ? '<div class="cap">' + esc(tx('away_cap_next')) + '</div>'
        : a.limitBy === 'district' || a.limitBy === 'remaining' ? '<div class="cap">' + esc(tx('away_cap_part')) + '</div>'
        : a.capped ? '<div class="cap">' + esc(tx('away_cap', { n: fmt(Math.round(U.offlineCapS / 60)) })) + '</div>' : '') +
    '</div>' +
    '<div class="pfoot"><button class="bt" data-act="close">' + esc(tx('continue')) + '</button></div>' +
    '</div></div>';
}

// ---- mock ad
function adHtml() {
  return '<div class="adv"><span class="tag">' + esc(tx('boost_mock_ad')) + '</span>' + svg('tv') + '<div class="pb"><i></i></div></div>';
}
function updateAd(rdt) {
  const dur = cfg('boost.mockAdS', 3);
  S.adT += rdt;
  const bar = E.mwrap.querySelector('.pb>i');
  if (bar) setTf(bar, 'scaleX(' + Math.min(1, S.adT / dur).toFixed(3) + ')');
  if (S.adT >= dur) {
    closePanel(true);
    C.bus.emit('ui:adWatched', { kind: 'boost' });
    if (S.panelPrev) { const p = S.panelPrev; S.panelPrev = null; openPanel(p); }
  }
}

function onPanelClick(e) {
  if (performance.now() - (S.panelAt || 0) < 350) return; // a click from the tap that opened the panel
  if (performance.now() - (S.dragAt || 0) < 250) return;  // the end of a slider drag / rotated scroll
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.getAttribute('data-act');
  if (a === 'close') { click(); if (S.panel === 'ad') return; closePanel(); return; }
  if (a === 'buy') {
    // QA #3: a quick double tap bought the item that slid into the bought one's place. Ignore buy taps for a moment
    // after any purchase (and until the list has been laid out again); the tap buys the id it was pressed on.
    if (performance.now() < (S.buyLockUntil || 0)) return;
    S.buyLockUntil = performance.now() + 500;
    const id = b.getAttribute('data-id');
    click();
    C.bus.emit('ui:buy', { id });
    return;
  }
  if (a === 'ad') { click(); S.panelPrev = S.panel; openPanel('ad'); return; }
  if (a === 'noad') { click(); S.adNo = true; return; }
  if (a === 'promo') { const c = b; c.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(0)' }], { duration: 260 }); return; }
  const st = C.state.settings;
  if (a === 'tg') {
    const k = b.getAttribute('data-k'); st[k] = !st[k];
    click(); settingsChanged(); b.classList.toggle('on', !!st[k]); b.setAttribute('aria-checked', String(!!st[k]));
    if (k === 'portrait' || k === 'flip') renderPanel();   // the stage may have rotated: lay the panel out again
    if (k === 'perfHud') setHidden(E.dbg, !(C.debug || C.perfHud || st.perfHud));
    return;
  }
  if (a === 'set') {
    const k = b.getAttribute('data-k'); let v = b.getAttribute('data-v');
    if (k === 'sens') v = parseFloat(v);
    st[k] = v; click();
    if (k === 'lang') { makeFormatters(); relabel(); }
    settingsChanged(); renderPanel(); return;
  }
  if (a === 'rask') { click(); S.resetAsk = true; renderPanel(); return; }
  if (a === 'rno') { click(); S.resetAsk = false; renderPanel(); return; }
  if (a === 'ryes') { resetSave(); }
}
function settingsChanged() {
  applyAudio();
  C.bus.emit('ui:settings', C.state.settings);   // extra event (docs/notlar/ui.md): player/main may read sens/steer/quality
  C.bus.emit('game:saveNow', null);
}
function applyAudio() {
  const s = C.state.settings, a = mod('audio');
  if (a && a.setEnabled) a.setEnabled(s.sound !== false, s.music !== false);
}
function resetSave() { if (C.save && C.save.reset) C.save.reset(); } // main: clear, block later saves, reload

// ------------------------------------------------------------------------------------------ haptics
// main owns the implementation and the rate limit (ctx.haptic); ui triggers buttons, sale, full bag, purchase and
// milestones, tools triggers picks, bumps and the nozzle.
function haptic(kind) { if (C.haptic) C.haptic(kind); }

// ------------------------------------------------------------------------------------------ debug overlay
function updateDebug() {
  const p = C.perf || {}, info = C.renderer && C.renderer.info ? C.renderer.info.render : { calls: 0, triangles: 0 };
  const ms = (v) => (v || 0).toFixed(2);
  const m = p.mods || {};
  let mods = '';
  for (const k of Object.keys(m)) if (m[k] > 0.05) mods += k + ' ' + m[k].toFixed(2) + '  ';
  if (C.perfStats) C.perfStats();
  const s = 'fps ' + (p.fps || 0).toFixed(0) + '  frame ' + ms(p.frameMs) + ' (p50 ' + ms(p.p50) + ' p95 ' + ms(p.p95) + ')  js ' + ms(p.jsMs) + '  render ' + ms(p.renderMs) + '  dpr ' + (C.view.dpr || 1).toFixed(2) +
    '\ncalls ' + info.calls + '  tris ' + (info.triangles / 1000).toFixed(1) + 'k  cells ' + S.dbgCells + (mods ? '\n' + mods : '');
  S.dbgCells = 0;
  setText(E.dbg, s);
}
