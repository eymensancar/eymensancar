// Quick look (development aid): boot, optional setup snippet, screenshot. Not part of run-all.
//   node test/e2e/look.mjs --out shot.png [--orient land|port] [--js "__ts.teleport(45,47,180)"] [--q "&dikey=1"] [--www DIR]
import path from 'node:path';
import { ROOT, serve, launch, openPage } from './lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('--out', 'look.png'), js = arg('--js', ''), q = arg('--q', ''), www = arg('--www', path.join(ROOT, 'www'));
const server = await serve(path.resolve(www));
const browser = await launch();
const { page, errors } = await openPage(browser, { orient: arg('--orient', 'land'), dpr: +arg('--dpr', 2) });
try {
  await page.goto(`http://127.0.0.1:${server.port}/index.html?debug&nosave${q}`);
  await page.waitForFunction(() => window.__ts && window.__ts.ready, null, { timeout: 90000 });
  await page.addStyleTag({ content: '[hidden]{display:none!important}' });
  const r = await page.evaluate(async (code) => { __ts.ctx.manual = true; const v = await (0, eval)('(async () => {' + code + '})()'); __ts.step(2); return v; }, js);
  await page.screenshot({ path: out, timeout: 120000 });
  console.log(JSON.stringify({ r, state: await page.evaluate(() => __ts.state()), counters: await page.evaluate(() => __ts.counters()) }));
} finally { console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no errors'); await browser.close(); server.close(); }
