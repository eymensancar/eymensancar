// Pure model of trash.js (MIMARI §4.3 API subset) for Node tests and the balance bot: the same grid semantics as
// test/spike/trash-core.js (cells, units, nearest-first, blocks of 12 cells, clean fraction = clean cells / initial
// trash cells) without any rendering. Types are rolled deterministically per (cell, k) from the zone mix.
function h32(a) { a |= 0; a = Math.imul(a ^ (a >>> 16), 0x85ebca6b); a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35); return (a ^ (a >>> 16)) >>> 0; }

export function makeModelTrash(CONFIG, city, bus) {
  const { N, CELL, zones, initial, mixes } = city;
  const TYPES = CONFIG.trashTypes.map((t) => t.id), NT = TYPES.length;
  const grid = new Uint8Array(N * N), init = new Uint8Array(N * N);
  const BS = 12, B = Math.ceil(N / BS), blockSum = new Int32Array(B * B);
  let total = 0, initialTotal = 0, cells0 = 0, clean = 0;
  const cum = mixes.map((m) => { if (!m) return null; const c = new Float64Array(NT); let s = 0; for (let t = 0; t < NT; t++) { s += m[TYPES[t]] || 0; c[t] = s; } for (let t = 0; t < NT; t++) c[t] /= s; return c; });
  const typeOf = (idx, k) => { const c = cum[zones[idx]] || cum[1], r = h32(idx * 0x9E3779B1 ^ (k * 0x85EBCA77) ^ 0x1234567) / 4294967296; for (let t = 0; t < NT - 1; t++) if (r < c[t]) return t; return NT - 1; };
  for (let i = 0; i < N * N; i++) { grid[i] = init[i] = zones[i] ? initial[i] : 0; total += grid[i]; if (grid[i]) cells0++; const ii = i % N, jj = (i / N) | 0; blockSum[((jj / BS) | 0) * B + ((ii / BS) | 0)] += grid[i]; }
  initialTotal = total;
  const res = { units: 0, cells: 0, cleaned: 0, byType: new Int32Array(NT), n: 0, sx: new Float32Array(48), sy: new Float32Array(48), sz: new Float32Array(48), st: new Uint8Array(48), ss: new Uint8Array(48), sc: new Uint32Array(48) };
  const byAgg = { hands: 0, broom: 0, cart: 0, robot: 0, final: 0, debug: 0 };
  let changed = 0;
  function clearRes() { res.units = 0; res.cells = 0; res.cleaned = 0; res.byType.fill(0); res.n = 0; return res; }
  function take(idx, max, by) {
    const u = grid[idx]; if (!u || max <= 0) return 0;
    const n = Math.min(u, max);
    for (let k = u - 1; k >= u - n; k--) { const t = typeOf(idx, k); res.byType[t]++; if (res.n < 48) { res.sx[res.n] = (idx % N + 0.5) * CELL; res.sz[res.n] = (((idx / N) | 0) + 0.5) * CELL; res.st[res.n] = t; res.n++; } }
    grid[idx] = u - n; total -= n; const i = idx % N, j = (idx / N) | 0; blockSum[((j / BS) | 0) * B + ((i / BS) | 0)] -= n;
    if (u - n === 0 && init[idx] > 0) { clean++; res.cleaned++; }
    res.units += n; res.cells++; byAgg[by] = (byAgg[by] || 0) + n; changed += n;
    return n;
  }
  const cand = new Int32Array(8192), candD = new Float32Array(8192);
  function sortN(n) { for (let a = 1; a < n; a++) { const ki = cand[a], kd = candD[a]; let b = a - 1; while (b >= 0 && candD[b] > kd) { cand[b + 1] = cand[b]; candD[b + 1] = candD[b]; b--; } cand[b + 1] = ki; candD[b + 1] = kd; } }
  function removeInCircle(x, z, r, maxUnits = 1e9, by = 'debug') {
    clearRes(); let n = 0;
    const i0 = Math.max(0, Math.floor((x - r) / CELL)), i1 = Math.min(N - 1, Math.floor((x + r) / CELL)), j0 = Math.max(0, Math.floor((z - r) / CELL)), j1 = Math.min(N - 1, Math.floor((z + r) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const idx = j * N + i; if (!grid[idx]) continue; const dx = (i + 0.5) * CELL - x, dz = (j + 0.5) * CELL - z, d2 = dx * dx + dz * dz; if (d2 > r * r || n >= 8192) continue; cand[n] = idx; candD[n] = d2; n++; }
    sortN(n); let left = maxUnits; for (let c = 0; c < n && left > 0; c++) left -= take(cand[c], left, by);
    return res;
  }
  function removeAlongSegment(x0, z0, x1, z1, hw, maxUnits = 1e9, by = 'debug') {
    clearRes(); let n = 0;
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - hw) / CELL)), i1 = Math.min(N - 1, Math.floor((Math.max(x0, x1) + hw) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(z0, z1) - hw) / CELL)), j1 = Math.min(N - 1, Math.floor((Math.max(z0, z1) + hw) / CELL));
    const ex = x1 - x0, ez = z1 - z0, el = ex * ex + ez * ez;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const idx = j * N + i; if (!grid[idx]) continue;
      const px = (i + 0.5) * CELL - x0, pz = (j + 0.5) * CELL - z0; let t = el > 0 ? (px * ex + pz * ez) / el : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - ex * t, dz = pz - ez * t; if (dx * dx + dz * dz > hw * hw || n >= 8192) continue; cand[n] = idx; candD[n] = t; n++;
    }
    sortN(n); let left = maxUnits; for (let c = 0; c < n && left > 0; c++) left -= take(cand[c], left, by);
    return res;
  }
  function nearestDirty(x, z, maxR = 1e9) {
    const ci = x / CELL, cj = z / CELL; let best = -1, bd = (maxR / CELL) ** 2;
    const b0i = Math.max(0, Math.min(B - 1, (ci / BS) | 0)), b0j = Math.max(0, Math.min(B - 1, (cj / BS) | 0));
    for (let ring = 0; ring < B; ring++) {
      const rmin = Math.max(0, ring - 1) * BS; if (rmin * rmin > bd) break;
      for (let bj = b0j - ring; bj <= b0j + ring; bj++) for (let bi = b0i - ring; bi <= b0i + ring; bi++) {
        if (bi < 0 || bj < 0 || bi >= B || bj >= B || Math.max(Math.abs(bi - b0i), Math.abs(bj - b0j)) !== ring || !blockSum[bj * B + bi]) continue;
        for (let j = bj * BS; j < Math.min(N, bj * BS + BS); j++) for (let i = bi * BS; i < Math.min(N, bi * BS + BS); i++) {
          if (!grid[j * N + i]) continue; const dx = i + 0.5 - ci, dz = j + 0.5 - cj, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = j * N + i; }
        }
      }
    }
    return best;
  }
  function consume(x, z, maxUnits, maxR = 1e9, by = 'debug') {
    clearRes(); let left = maxUnits, guard = 0;
    while (left > 0 && guard++ < 65536) { const idx = nearestDirty(x, z, maxR); if (idx < 0) break; left -= take(idx, left, by); }
    return res;
  }
  // milestone bookkeeping like trash.js (persisted index is the test's business)
  let ms = -1;
  const msEv = { index: 0, at: 0, fraction: 0 }, chEv = { units: 0, cells: 0, cleaned: 0, by: byAgg, fraction: 0 };
  return {
    grid, init,
    info: () => ({ N, cell: CELL, K: 4, size: N * CELL, types: TYPES, shapes: [], blocks: B, blockSize: BS }),
    amountAt: (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); return (i < 0 || j < 0 || i >= N || j >= N) ? 0 : grid[j * N + i]; },
    surfaceAt: (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); return (i < 0 || j < 0 || i >= N || j >= N) ? 0.15 : grid[j * N + i] * 0.075; },
    cellAt: (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); return (i < 0 || j < 0 || i >= N || j >= N) ? -1 : j * N + i; },
    cellCenter: (idx, out) => { out.x = (idx % N + 0.5) * CELL; out.z = (((idx / N) | 0) + 0.5) * CELL; return out; },
    removeInCircle, removeAlongSegment, nearestDirty, consume,
    takeCell: (idx, max, by) => { clearRes(); take(idx, max, by); return res; },
    pick(x, z, r, by = 'hands') { const idx = nearestDirty(x, z, r); if (idx < 0) return null; clearRes(); take(idx, 1, by); return { type: res.st[0] }; },
    clearAll(by = 'final') { clearRes(); for (let i = 0; i < N * N; i++) if (grid[i]) take(i, 99, by); return res; },
    cleanFraction: () => (cells0 ? clean / cells0 : 1), unitFraction: () => 1 - total / initialTotal,
    totalUnits: () => total, initialUnits: () => initialTotal, trashCells: () => cells0, cleanCells: () => clean,
    blockSums: () => blockSum,
    update() {
      if (!bus) return;
      const f = cells0 ? clean / cells0 : 1;
      if (changed) { chEv.units = total; chEv.fraction = f; bus.emit('trash:changed', chEv); changed = 0; for (const k in byAgg) byAgg[k] = 0; }
      const M = CONFIG.milestones;
      while (ms + 1 < M.length && f >= M[ms + 1].at - 1e-9) { ms++; msEv.index = ms; msEv.at = M[ms].at; msEv.fraction = f; bus.emit('trash:milestone', msEv); if (M[ms].at >= 1) bus.emit('district:cleaned', { playS: 0 }); }
    },
    milestoneIndex: () => ms,
  };
}

export function makeBus() {
  const m = new Map(); let trace = null;
  return {
    on(n, f) { (m.get(n) || m.set(n, []).get(n)).push(f); return () => { const a = m.get(n); a.splice(a.indexOf(f), 1); }; },
    off(n, f) { const a = m.get(n); if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
    once(n, f) { const u = this.on(n, (p) => { u(); f(p); }); return u; },
    emit(n, p) { if (trace) trace(n, p); const a = m.get(n); if (!a) return 0; for (const f of a.slice()) f(p); return a.length; },
    setTrace(f) { trace = f; },
  };
}
