// Runs the spike headless: screenshots + measurements. Usage: node test/spike/run.mjs [--three /path/three.min.js]
// Serves the repo root on a local port; the three.js CDN URL is fulfilled from a local copy when --three is given
// (or from the network otherwise). SwiftShader = software GL: numbers are for draw calls/triangles/JS cost, NOT fps.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const ai = process.argv.indexOf('--three');
const threeLocal = ai > 0 ? process.argv[ai + 1] : null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((q, s) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  if (threeLocal) await page.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: threeLocal, contentType: 'text/javascript' }));
  await page.goto(`http://127.0.0.1:${port}/test/spike/index.html?shots`);
  await page.waitForFunction(() => window.__spikeReady === true, null, { timeout: 60000 });
  return page;
}
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });
const out = {};
const page = await open(1280, 590); // ~iPhone 12 landscape logical aspect (844x390 ≈ 2.16)
const shot = async (name, v) => { const st = await page.evaluate((v) => { const s = window.__spike.setView(Object.assign({ y: 1.65 }, v)); window.__spike.frame(); return { ...window.__spike.info(), instances: s.instances }; }, v); await page.screenshot({ path: path.join(shots, name + '.png') }); out['view_' + name] = st; };

await shot('01-start-plaza', {});                                           // CONFIG.player start: plaza, facing south
await shot('02-street-north', { x: 27, z: 52, yaw: 0, pitch: -0.05 });     // down the middle street to the horizon
await shot('03-feet', { x: 27, z: 50, yaw: 0.3, pitch: -0.8 });
await shot('04-west-street', { x: 3, z: 52, yaw: 0, pitch: -0.06 });
out.carve = await page.evaluate(() => window.__spike.carve());
await shot('05-cleaned-trail', { x: 27, z: 53, yaw: 0, pitch: -0.12 });
await shot('06-cleaned-feet', { x: 27.5, z: 47, yaw: 0.15, pitch: -0.75 });
await shot('07-cart-swath', { x: 3, z: 53, yaw: 0, pitch: -0.1 });
await shot('08-aerial', { x: 27, y: 45, z: 75, yaw: 0, pitch: -0.7 });
out.gen = await page.evaluate(() => window.__spike.gen);
out.uploadPaths = await page.evaluate(() => ({ partial: window.__spike.core.stats.partialUploads, full: window.__spike.core.stats.fullUploads }));
out.benchConsume = await page.evaluate(() => { const c = window.__spike.core; const t0 = performance.now(); const r = c.consume(3, 3, 2000, 60); return { units: r.units, cells: r.cells, ms: +(performance.now() - t0).toFixed(1) }; });
out.textureBytes = await page.evaluate(() => window.__spike.textureBytes());
out.coreInfo = await page.evaluate(() => ({ groundTris: window.__spike.core.groundTris, window: window.__spike.core.W, maxPerCell: window.__spike.core.K }));
await page.evaluate(() => window.__spike.setView({ x: 27, y: 1.65, z: 52, yaw: 0, pitch: -0.06 }));
out.benchSweep_broom_3robots = await page.evaluate(() => { window.__spike.core.reset(); return window.__spike.benchSweep(300, 3, 0.65, 0.04); });
out.benchSweep_cart_8robots = await page.evaluate(() => { window.__spike.core.reset(); return window.__spike.benchSweep(300, 8, 1.1, 0.083); });
out.benchStress_50cells = await page.evaluate(() => { window.__spike.core.reset(); return window.__spike.benchStress(200, 50); });
out.benchStress_400cells = await page.evaluate(() => { window.__spike.core.reset(); return window.__spike.benchStress(60, 400); });
out.benchWalk = await page.evaluate(() => window.__spike.benchWalk(600, 0.08));
out.benchTeleport = await page.evaluate(() => window.__spike.benchTeleport(20));
out.benchSave = await page.evaluate(() => window.__spike.benchSave());
out.benchNearest = await page.evaluate(() => window.__spike.benchNearest(200));
out.benchRender = await page.evaluate(() => { window.__spike.reset && 0; window.__spike.setView({ x: 27, z: 52, yaw: 0, pitch: -0.06 }); return window.__spike.benchRender(20); });
out.gl = await page.evaluate(() => { const gl = window.__spike.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return { webgl2: window.__spike.renderer.capabilities.isWebGL2, renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?', maxVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) }; });
await page.close();
// portrait
const pp = await open(390, 844);
await pp.evaluate(() => window.__spike.setView({ x: 27, z: 52, yaw: 0, pitch: -0.1 }));
await pp.screenshot({ path: path.join(shots, '09-portrait.png') });
out.view_portrait = await pp.evaluate(() => window.__spike.info());
await pp.close();
fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
