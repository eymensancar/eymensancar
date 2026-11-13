// One command for every test that still makes sense after integration.
//   node test/run-all.mjs            module tests + balance limits + build + e2e smoke (both orientations, tek.html
//                                    wrapped and in iframes) + performance/robustness checks
//   node test/run-all.mjs --full     also the full touch play-through in landscape and portrait (test/e2e/play.mjs)
//   node test/run-all.mjs --quick    unit + balance + build + e2e smoke on index.html only
// three.js: set THREE_LOCAL=/path/three.min.js (r128) to run offline; otherwise the cdnjs URL is fetched.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FULL = process.argv.includes('--full'), QUICK = process.argv.includes('--quick');
const three = [process.env.THREE_LOCAL, path.join(ROOT, 'test/.cache/three.min.js'), '/tmp/claude-0/-home-user/8066dee7-8627-553b-a97c-0e1bfc2ce9b4/scratchpad/lib/three.min.js'].find((p) => p && fs.existsSync(p));
const env = Object.assign({}, process.env, three ? { THREE_LOCAL: three } : {});
const threeArg = three ? ['--three', three] : [];
const results = [];

function run(name, cmd, args, { optional = false } = {}) {
  const t0 = Date.now();
  process.stdout.write(name.padEnd(46) + ' ');
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60 * 1000 });
  const ok = r.status === 0;
  const s = ((Date.now() - t0) / 1000).toFixed(0) + ' s';
  console.log((ok ? 'PASS' : optional ? 'warn' : 'FAIL') + '  ' + s);
  if (!ok) { const out = (r.stdout || '') + (r.stderr || ''); console.log(out.split('\n').filter((l) => /FAIL|Error|error|ABORT/.test(l)).slice(0, 12).map((l) => '    ' + l.slice(0, 220)).join('\n')); }
  results.push({ name, ok: ok || optional, s });
  return r;
}

// ---- pure Node
run('economy unit tests', 'node', ['test/economy/unit.mjs']);
{ // balance: the psychology brief's limits with the current prices (bot = real economy + robots, modelled player)
  const out = path.join(os.tmpdir(), 'ts-bot-' + process.pid + '.json');
  const r = run('balance bot (slow / average / fast)', 'node', ['test/economy/bot.mjs', '--json', out]);
  if (r.status === 0) {
    const d = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
    const at = (p, id) => (d[p].at[id] ? d[p].at[id].t : Infinity);
    const gap = (p) => { const t = [0, ...d[p].purchases.map((x) => x.t), d[p].complete].sort((a, b) => a - b); let g = 0; for (let i = 1; i < t.length; i++) g = Math.max(g, t[i] - t[i - 1]); return g; };
    const lim = [
      ['average: broom ≤ 2:00', at('average', 'broom') <= 2],
      ['slow: broom ≤ 2:00', at('slow', 'broom') <= 2],
      ['average: first robot 6–8 min', at('average', 'robot_1') >= 6 && at('average', 'robot_1') <= 8],
      ['average: cart ≤ 12 min', at('average', 'cart') <= 12],
      ['all: no gap > 4 min without something new', ['slow', 'average', 'fast'].every((p) => gap(p) <= 4)],
      ['average: 100 % in 14–20 min', d.average.complete >= 14 && d.average.complete <= 20],
    ];
    for (const [n, ok] of lim) { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n); results.push({ name: 'balance: ' + n, ok }); }
  }
}
run('single-file build (tools/build.py)', 'python3', ['tools/build.py']);
run('e2e smoke: index.html landscape', 'node', ['test/e2e/smoke.mjs', '--target', 'index', '--orient', 'land']);
if (!QUICK) {
  run('e2e smoke: index.html portrait', 'node', ['test/e2e/smoke.mjs', '--target', 'index', '--orient', 'port']);
  run('e2e smoke: tek.html wrapped like the host', 'node', ['test/e2e/smoke.mjs', '--target', 'tek']);
  run('e2e smoke: tek.html inside an iframe', 'node', ['test/e2e/smoke.mjs', '--target', 'iframe']);
  run('e2e smoke: tek.html, sandboxed iframe', 'node', ['test/e2e/smoke.mjs', '--target', 'sandbox']);
  run('e2e performance + robustness', 'node', ['test/e2e/perf.mjs']);
  // module suites (fakes around one real module, written by each programmer; updated at integration)
  run('world module (api)', 'node', ['test/world/run.mjs', ...threeArg, '--only', 'api']);
  run('trash module', 'node', ['test/trash/run.mjs', ...threeArg, '--no-shots']);
  run('audio module (offline render)', 'node', ['test/audio/run.mjs']);
  run('player module (CDP touch)', 'node', ['test/player/run.cjs']);
  run('tools module (CDP touch)', 'node', ['test/tools/run.cjs']);
  run('ui module, landscape', 'node', ['test/ui/run.mjs', ...threeArg, '--vp', 'land']);
  run('ui module, portrait', 'node', ['test/ui/run.mjs', ...threeArg, '--vp', 'port']);
  run('economy in the browser', 'node', ['test/economy/browser.mjs', ...threeArg]);
}
if (FULL) {
  run('e2e full touch play-through, landscape', 'node', ['test/e2e/play.mjs', '--orient', 'land']);
  run('e2e full touch play-through, portrait', 'node', ['test/e2e/play.mjs', '--orient', 'port']);
}
const bad = results.filter((r) => !r.ok);
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' passed' + (bad.length ? ' — failed: ' + bad.map((r) => r.name).join('; ') : ''));
process.exit(bad.length ? 1 : 0);
