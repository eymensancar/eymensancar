// TEST FAKE of www/js/ui.js: stick visuals from player.input().stick, the context button (top offer),
// tool buttons, bag counter, toasts, and a test panel. Just enough to drive and look at player/tools.
let ctx, el = {}, top = null, lastLabel = '', toastT = 0;
export const log = { toasts: [], offers: [] };
const btnEv = { id: 'action', down: false }, offEv = { id: '', owner: '' };
export function init(c) {
  ctx = c; const r = c.uiRoot;
  const css = document.createElement('style');
  css.textContent = `#ui .f{position:absolute;font:600 14px system-ui;color:#fff;text-shadow:0 1px 2px #0008}
  #ui .sb{position:absolute;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;border:2px solid #fff8;background:#0002}
  #ui .sk{position:absolute;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:#fffb}
  #ui .act{position:absolute;right:calc(18px + var(--sar));bottom:calc(18px + var(--sab));width:96px;height:96px;border-radius:50%;border:0;background:#f2c230;font:700 15px system-ui;color:#2b2b2b;pointer-events:auto;touch-action:none}
  #ui .tb{position:absolute;right:calc(12px + var(--sar));top:calc(10px + var(--sat));display:flex;gap:8px}
  #ui .tb button{min-width:64px;height:44px;border-radius:10px;border:0;background:#fffd;font:600 13px system-ui;pointer-events:auto}
  #ui .pnl{position:absolute;inset:0;background:#000a;pointer-events:auto;display:flex;align-items:center;justify-content:center}
  #ui .x{position:absolute;left:calc(12px + var(--sal));top:calc(10px + var(--sat))}
  #ui .cross{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#fff;box-shadow:0 0 2px #000}
  #ui .toast{position:absolute;left:50%;top:22%;transform:translateX(-50%);background:#000a;padding:6px 12px;border-radius:8px}`;
  document.head.appendChild(css);
  r.innerHTML = `<div class="f x" id="fBag"></div><div class="cross"></div><div class="sb" id="fSb" hidden></div><div class="sk" id="fSk" hidden></div>
    <button class="act" id="fAct"></button><div class="tb"><button id="fH">Eller</button><button id="fB">Süpürge</button><button id="fP">Panel</button></div>
    <div class="f toast" id="fToast" hidden></div><div class="pnl" id="fPnl" hidden><button id="fClose" style="width:120px;height:60px">Kapat</button></div>`;
  for (const id of ['fBag', 'fSb', 'fSk', 'fAct', 'fH', 'fB', 'fP', 'fToast', 'fPnl', 'fClose']) el[id] = document.getElementById(id);
  const down = (e) => { e.preventDefault(); btnEv.down = true; ctx.bus.emit('input:button', btnEv); if (top) { offEv.id = top.id; offEv.owner = top.owner; log.offers.push(top.id); ctx.bus.emit('ui:offer', offEv); } };
  const up = () => { btnEv.down = false; ctx.bus.emit('input:button', btnEv); };
  el.fAct.addEventListener('pointerdown', down); el.fAct.addEventListener('pointerup', up); el.fAct.addEventListener('pointercancel', up);
  el.fH.addEventListener('click', () => ctx.bus.emit('ui:tool', { id: 'hands' }));
  el.fB.addEventListener('click', () => ctx.bus.emit('ui:tool', { id: 'broom' }));
  el.fP.addEventListener('click', () => { el.fPnl.hidden = false; ctx.bus.emit('ui:panel', { id: 'shop', open: true }); });
  el.fClose.addEventListener('click', () => { el.fPnl.hidden = true; ctx.bus.emit('ui:panel', { id: 'shop', open: false }); });
  addEventListener('keydown', (e) => { if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) down(e); });
  addEventListener('keyup', (e) => { if (e.code === 'KeyE' || e.code === 'Space') up(); });
  ctx.bus.on('ui:toast', (e) => { const s = e.text || ctx.t(e.key, e.vars); log.toasts.push(s); el.fToast.textContent = s; el.fToast.hidden = false; toastT = 1.5; });
  window.__fakeUi = { log, el };
}
export function update() {
  const o = ctx.offers; top = null;
  for (let i = 0; i < o.count; i++) if (!top || o.list[i].priority > top.priority) top = o.list[i];
  const lbl = top ? top.label : '';
  if (lbl !== lastLabel) { el.fAct.textContent = lbl; el.fAct.hidden = !top; lastLabel = lbl; }
  if (top) top = { id: top.id, owner: top.owner, priority: top.priority }; // copy: the pool is reused next frame
  const st = ctx.mods.player.input().stick;
  el.fSb.hidden = el.fSk.hidden = !st.active;
  if (st.active) { el.fSb.style.left = st.cx + 'px'; el.fSb.style.top = st.cy + 'px'; el.fSk.style.left = Math.max(st.cx - 56, Math.min(st.cx + 56, st.x)) + 'px'; el.fSk.style.top = Math.max(st.cy - 56, Math.min(st.cy + 56, st.y)) + 'px'; }
  const E = ctx.mods.economy, T = ctx.mods.tools;
  el.fBag.textContent = `${T.current()}  çanta ${E.bagUnits('bag')}/${E.bagCapacity('bag')}  depo ${E.bagUnits('tank')}/${E.bagCapacity('tank')}  altın ${E.coins()}`;
  if (toastT > 0 && (toastT -= ctx.time.dt) <= 0) el.fToast.hidden = true;
}
export function toast(key, vars) { ctx.bus.emit('ui:toast', { key, vars }); }
export function openPanel() {}
export function closePanel() {}
