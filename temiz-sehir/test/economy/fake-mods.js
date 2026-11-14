// Browser fakes of world.js and trash.js for the economy tests (test code only, never in www/js).
// fakeTrash wraps the measured reference core (test/spike/trash-core.js) so robots clean the real-looking grid;
// fakeWorld draws plain boxes for buildings, lights and fog, and answers the §4.2 queries the economy uses.
import { createTrashCore } from '../spike/trash-core.js';
import { makeCity, makeFakeWorld } from './fake-city.mjs';

let city = null, W = null;
export const fakeWorld = {
  init(ctx) {
    const THREE = ctx.THREE, C = ctx.CONFIG;
    city = makeCity(C); W = makeFakeWorld(C, city);
    const fog = new THREE.Color('#cdd7dc');
    ctx.scene.background = fog; ctx.scene.fog = new THREE.Fog(fog, 30, 230);
    const hemi = new THREE.HemisphereLight(0xbfd2e6, 0x6e6152, 0.62); ctx.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.62); sun.position.set(0.45, 0.8, 0.35); ctx.scene.add(sun);
    this._light = { sunDir: sun.position.clone().normalize(), sunColor: sun.color.clone().multiplyScalar(sun.intensity), skyColor: hemi.color.clone().multiplyScalar(hemi.intensity), groundColor: hemi.groundColor.clone().multiplyScalar(hemi.intensity), fogColor: fog };
    // buildings + kiosk: one merged box mesh
    const P = [], Cc = [], I = [];
    const tints = ['#f1e6d2', '#e8c9a0', '#d9d9d6', '#e3b39a', '#f4f1ea', '#c9d1c8'].map((c) => new THREE.Color(c));
    const box = (x0, z0, x1, z1, h, col) => {
      const o = P.length / 3;
      for (const [x, y, z] of [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]]) { P.push(x, y, z); Cc.push(col.r, col.g, col.b); }
      I.push(o, o + 4, o + 5, o, o + 5, o + 1, o + 1, o + 5, o + 6, o + 1, o + 6, o + 2, o + 2, o + 6, o + 7, o + 2, o + 7, o + 3, o + 3, o + 7, o + 4, o + 3, o + 4, o, o + 4, o + 7, o + 6, o + 4, o + 6, o + 5);
    };
    for (const b of city.buildings) box(b.x0, b.z0, b.x1, b.z1, b.h, tints[b.tint]);
    const k = C.district.shopKiosk.rect; box(k[0], k[1], k[2], k[3], C.district.shopKiosk.heightM, new THREE.Color('#2f7d5b'));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setIndex(I);
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    ctx.scene.add(new THREE.Mesh(ng, new THREE.MeshLambertMaterial({ vertexColors: true })));
    // ground plan
    const PX = 8, S = city.SIZE * PX, cv = document.createElement('canvas'); cv.width = cv.height = S; const g2 = cv.getContext('2d');
    for (let j = 0; j < city.N; j++) for (let i = 0; i < city.N; i++) { const kk = city.kind[j * city.N + i]; g2.fillStyle = kk === 0 ? '#2a2a2a' : kk === 2 ? '#a39684' : '#3a3c3f'; g2.fillRect(i * 4, j * 4, 4.5, 4.5); }
    this._ground = new THREE.CanvasTexture(cv); this._ground.flipY = false;
  },
  update() {},
  layout: () => W.layout(), groundTexture() { return this._ground; }, lighting() { return this._light; },
  points: () => W.points(), point: (id) => W.point(id), kindAt: (x, z) => W.kindAt(x, z), outsideUnits: (i, j) => W.outsideUnits(i, j),
  isBlocked: (x, z, r) => W.isBlocked(x, z, r), collide: (x, z, r, o) => W.collide(x, z, r, o), segmentClear: () => true,
};

let core = null, tctx = null, ms = -1;
const chEv = { units: 0, cells: 0, cleaned: 0, by: {}, fraction: 0 };
export const fakeTrash = {
  init(ctx) {
    tctx = ctx; const C = ctx.CONFIG;
    const L = ctx.mods.world.lighting();
    core = createTrashCore({ N: city.N, cell: city.CELL, K: C.trashGen.depthMax, renderer: ctx.renderer, seed: 3, types: C.trashTypes.map((t) => t.id),
      zones: city.zones, mixes: city.mixes, initial: city.initial, outside: city.outsideUnits, outsideZone: 1, outUnitsShader: 2,
      groundMap: ctx.mods.world.groundTexture(), fadeS: 0, light: L });
    ctx.scene.add(core.group); core.warmup();
    this.core = core;
  },
  update(dt) {
    const cam = tctx.camera.position; core.update(cam.x, cam.z, dt || 0);
    const f = core.cleanFraction(), M = tctx.CONFIG.milestones;
    while (ms + 1 < M.length && f >= M[ms + 1].at - 1e-9) { ms++; tctx.bus.emit('trash:milestone', { index: ms, at: M[ms].at, fraction: f }); }
  },
  save: () => null, load() {},
  info: () => ({ N: core.N, cell: core.CELL, K: core.K, size: core.SIZE, types: core.TYPES, shapes: core.SHAPES, blocks: core.blocks, blockSize: core.blockSize }),
  amountAt: (x, z) => core.amountAt(x, z), surfaceAt: (x, z) => core.surfaceAt(x, z), cellAt: (x, z) => core.cellAt(x, z), cellCenter: (i, o) => core.cellCenter(i, o),
  removeInCircle: (x, z, r, m) => core.removeInCircle(x, z, r, m), removeAlongSegment: (a, b, c, d, hw, m) => core.removeAlongSegment(a, b, c, d, hw, m),
  pick: (x, z, r) => core.pick(x, z, r), nearestDirty: (x, z, r) => core.nearestDirty(x, z, r), consume: (x, z, m, r) => core.consume(x, z, m, r),
  clearAll: () => core.consume(27, 27, 1e9),
  cleanFraction: () => core.cleanFraction(), unitFraction: () => core.unitFraction(), totalUnits: () => core.totalUnits(), initialUnits: () => core.initialUnits(),
  trashCells: () => core.trashCells(), cleanCells: () => core.cleanCells(), blockSums: () => core.blockSums,
  itemGeometry: () => null, itemMaterial: () => core.itemMaterial,
};
