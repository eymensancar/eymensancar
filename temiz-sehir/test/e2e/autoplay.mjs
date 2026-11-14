// In-page autoplayer used to fast-forward long stretches of play (installed as window.__auto by install()).
// It plays like a simple player through the game's own APIs: walk the hand brush or the broom
// (virtual stick) through the nearest dirt, drive the cart with the nozzle down, sell when full (teleporting to the
// sell point stands in for the walk), buy whatever the shop flags as next. Time runs through __ts.fast (no render).
export const AUTOPLAY_SRC = String(function installAuto() {
  window.__auto = function (seconds, opt) {
    const T = window.__ts, M = T.ctx.mods, E = M.economy, TR = M.trash, P = M.player, TL = M.tools;
    const o = Object.assign({ buy: true, until: null, stopClean: 2, chunk: 0.5, dt: 1 / 30 }, opt || {});
    const cc = { x: 0, z: 0 };
    let t = 0, bought = [];
    const yawTo = (dx, dz) => Math.atan2(dx, -dz);
    while (t < seconds) {
      if (o.buy) for (let k = 0; k < 3; k++) { const n = E.catalog().find((c) => c.next); if (n && n.affordable && E.buy(n.id)) bought.push(n.id); else break; }
      if (o.until && E.owned(o.until)) break;
      if (TR.cleanFraction() >= o.stopClean) break;
      const ps = P.pose(), mounted = !!P.mounted(), cont = mounted ? 'tank' : 'bag';
      // get into the cart once it exists
      if (!mounted && E.owned('cart') && TL.cartState) {
        const c = TL.cartState(); P.teleport(c.x + 1.2, c.z, -Math.PI / 2); TL.equip('cart');
      }
      if (o.untilFull && E.bagCapacity(cont) > 0 && E.bagSpace(cont) <= 0) break;
      if (E.bagCapacity(cont) > 0 && E.bagSpace(cont) <= 0) { // sell at the nearest active point
        T.hold(false); P.setStick(0, 0);
        let best = null, bd = 1e9; for (const sp of E.sellPoints()) if (sp.active) { const d = Math.hypot(sp.x - ps.x, sp.z - ps.z); if (d < bd) { bd = d; best = sp; } }
        P.teleport(best.x, best.z); T.fast(1.0, o.dt, false); t += 1.0 + bd / 7.5; // the walk is not simulated: count its time
        continue;
      }
      const idx = TR.nearestDirty(ps.x, ps.z, 120);
      if (idx < 0) { T.fast(o.chunk, o.dt, false); t += o.chunk; continue; }
      TR.cellCenter(idx, cc);
      const dx = cc.x - ps.x, dz = cc.z - ps.z, d = Math.hypot(dx, dz), yaw = yawTo(dx, dz);
      const tool = TL.current();
      if (mounted) {
        T.look(yaw * 180 / Math.PI, -10); P.setStick(0, 1);
      } else {
        // v2: brush (start tool) and broom both sweep while walking
        if (E.owned('broom') && tool !== 'broom') TL.equip('broom');
        T.hold(false);
        if (d > 4) { P.teleport(cc.x - Math.sin(yaw) * 1.2, cc.z + Math.cos(yaw) * 1.2, yaw); t += d / 7.5; }
        else T.look(yaw * 180 / Math.PI, -20);
        P.setStick(0, 1);
      }
      T.fast(o.chunk, o.dt, false); t += o.chunk;
    }
    T.hold(false); P.setStick(0, 0);
    T.fast(0.1, o.dt, false);
    return { t, bought, state: T.state() };
  };
});
export async function install(page) { await page.evaluate(`(${AUTOPLAY_SRC})()`); }
