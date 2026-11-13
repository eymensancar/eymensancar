// FAKE trash.js: district % and block sums driven by window.__fk.trash.
let C = null;
const blocks = 9;
export function init(ctx) {
  C = ctx;
  window.__fk = window.__fk || {};
  window.__fk.trash = { clean: 0, units: 13446, sums: new Int32Array(blocks * blocks).fill(20) };
}
export function update() {}
export function info() { return { N: 108, cell: 0.5, K: 4, size: 54, types: ['paper', 'plastic', 'can', 'glass', 'bag', 'valuable'], shapes: [], blocks, blockSize: 12 }; }
export function cleanFraction() { return window.__fk.trash.clean; }
export function unitFraction() { return window.__fk.trash.clean; }
export function totalUnits() { return window.__fk.trash.units; }
export function initialUnits() { return 13446; }
export function trashCells() { return 7728; }
export function cleanCells() { return Math.round(7728 * window.__fk.trash.clean); }
export function blockSums() { return window.__fk.trash.sums; }
export function amountAt() { return 1; }
export function surfaceAt() { return 0.1; }
export function cellAt() { return -1; }
export function save() { return null; }
export function load() {}
