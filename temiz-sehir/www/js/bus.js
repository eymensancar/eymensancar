// bus.js — tiny synchronous event bus. Owner: architecture (MIMARI.md §6).
// emit() calls handlers in subscription order, synchronously, inside the emitter's call stack.
// A throwing handler is logged and skipped; it never breaks the emitter or other handlers.
// No allocation per emit (payload objects are the emitter's business; see MIMARI.md §6 for the
// "reused payload" rule).

export function createBus() {
  const map = new Map(); // name -> array of handlers (null = removed slot, compacted lazily)
  let depth = 0;
  const dirty = new Set();
  const errors = { count: 0, last: null };
  let trace = null; // optional (name, payload) => void for debug.js

  function on(name, fn) {
    let a = map.get(name);
    if (!a) { a = []; map.set(name, a); }
    a.push(fn);
    return () => off(name, fn);
  }
  function off(name, fn) {
    const a = map.get(name); if (!a) return;
    const i = a.indexOf(fn); if (i < 0) return;
    if (depth > 0) { a[i] = null; dirty.add(name); } else a.splice(i, 1);
  }
  function once(name, fn) {
    const un = on(name, (p) => { un(); fn(p); });
    return un;
  }
  function emit(name, payload) {
    if (trace) trace(name, payload);
    const a = map.get(name); if (!a || a.length === 0) return 0;
    depth++;
    const n = a.length; // handlers added during emit run next time
    let called = 0;
    for (let i = 0; i < n; i++) {
      const fn = a[i]; if (!fn) continue;
      try { fn(payload); called++; } catch (e) { errors.count++; errors.last = name; console.error('[bus] handler for "' + name + '" threw', e); }
    }
    depth--;
    if (depth === 0 && dirty.size) {
      for (const k of dirty) { const b = map.get(k); if (b) map.set(k, b.filter(Boolean)); }
      dirty.clear();
    }
    return called;
  }
  function count(name) { const a = map.get(name); return a ? a.filter(Boolean).length : 0; }
  function setTrace(fn) { trace = fn || null; }
  return { on, off, once, emit, count, setTrace, errors };
}
