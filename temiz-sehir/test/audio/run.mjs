// Audio test: renders scripted sequences of the real www/js/audio.js through OfflineAudioContext (test/audio/harness.html)
// and checks levels (no clipping), band balance for phone speakers, pickup pitch ladder, the city bed getting calmer
// with district %, stereo placement, sound-off silence and per-frame CPU. Writes test/audio/out/sequence.wav and
// test/audio/out/report.json. Nobody listened to the output: the checks are numeric.
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const server = http.createServer((q, s) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(p).pipe(s); }).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/test/audio/harness.html`);
await page.waitForFunction(() => window.__ready);
const gen = await page.evaluate(() => window.genTimes());
const r = await page.evaluate(() => window.runAll());
r.genMs = gen;
const wav = await page.evaluate(() => window.__wav);
await browser.close(); server.close();
// checks
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
ok(r.A.whole.clipped === 0 && r.A.whole.peakDb < -0.3, 'sequence A clips/peaks: ' + JSON.stringify(r.A.whole));
ok(r.B.whole.clipped === 0 && r.B.whole.peakDb < -0.3, 'worst case B clips: ' + JSON.stringify(r.B.whole));
ok(r.A.pickups30ps.lt120 < 0.05, 'pickups have energy below 120 Hz');
ok(r.A.bed100.rmsDb < r.A.bed0.rmsDb - 2.5, 'city bed not calmer at 100 %: ' + r.A.bed0.rmsDb + ' -> ' + r.A.bed100.rmsDb);
const lad = r.A.ladderHz; let rising = 0; for (let i = 1; i < lad.length; i++) if (lad[i] > lad[i - 1]) rising++;
ok(rising >= lad.length - 2 && lad[lad.length - 1] / lad[0] > 1.5, 'pickup ladder not rising: ' + lad);
ok(r.C.eastRminusL_db > 3 && r.C.westLminusR_db > 3, 'positional pan wrong: ' + JSON.stringify(r.C));
ok(r.C.afterDisable.peakDb < -60, 'sound off not silent: ' + JSON.stringify(r.C.afterDisable));
{ const g = Object.assign({}, gen); delete g.initMs; ok(Math.max(...Object.values(g)) < 8, 'unlock or a first play() costs >= 8 ms: ' + JSON.stringify(gen)); }
ok(errs.length === 0, 'page errors: ' + errs.join(' | '));
// WAV (16-bit stereo)
const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true });
const n = wav.l.length, b = Buffer.alloc(44 + n * 4);
b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
b.writeUInt32LE(wav.sr, 24); b.writeUInt32LE(wav.sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) { b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(wav.l[i] * 32767))), 44 + i * 4); b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(wav.r[i] * 32767))), 46 + i * 4); }
fs.writeFileSync(path.join(out, 'sequence.wav'), b);
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ result: r, fail }, null, 2));
console.log(JSON.stringify(r, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.join('\n') : 'PASS');
process.exit(fail.length ? 1 : 0);
