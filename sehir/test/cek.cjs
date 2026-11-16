/* Hareket inceleme aracı: oyunu başsız tarayıcıda sabit adımla (1/60 sn) yürütür, istenen anlarda kare alır, yan yana dizer.
   Kullanım:  node test/cek.cjs <senaryo.json | '{"...": ...}'> <çıktı.png> [--olc]
   Senaryo: { "kamera": "yan" | "on" | "arka" | "capraz" | "takip", "uzaklik": 4.2, "boyut": [480, 360],
              "adimlar": [ { "sure": 1.0, "jx": 0, "jy": 1, "run": false, "jump": false, "camYaw": 3.14 }, ... ],
              "kareler": [0.1, 0.2, ...]   // saniye cinsinden kare alınacak anlar (boşsa: toplam süreye yayılmış 12 kare)
              "konum": { "x": .., "z": .., "yaw": .. } }   // isteğe bağlı başlangıç
   --olc: her adımda oyuncu durumu ve ayak kemiklerinin dünya konumunu JSON olarak yazar (<çıktı>.json): ayak kayması ölçümü için.
   jump: adımın ilk karesinde bir kez basılır. jx/jy sanal çubuk (jy ileri +; yön kameraya göredir, kamera 'takip' değilse camYaw=π varsayılır). */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'); const TYPES = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
(async () => {
  const arg = process.argv[2], out = process.argv[3] || 'cek.png', olc = process.argv.includes('--olc');
  const sen = JSON.parse(arg.trim().startsWith('{') ? arg : fs.readFileSync(arg, 'utf8')); const [W, H] = sen.boyut || [480, 360];
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise(ok => srv.listen(0, ok)); const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto(`http://localhost:${port}/?test`);
  try { await pg.waitForFunction(() => window.SO && window.SO.ready, null, { timeout: 120000 }); } catch (e) { console.error('AÇILMADI', errs.join('\n')); await b.close(); srv.close(); process.exit(1); }
  await pg.addStyleTag({ content: '#joy,.pad,#fps{display:none!important}' });
  await pg.evaluate(s => { const SO = window.SO; SO.cam.mode = s.kamera || 'yan'; if (s.uzaklik) SO.cam.dist = s.uzaklik; else if (SO.cam.mode !== 'takip') SO.cam.dist = 4.2; if (s.konum) { Object.assign(SO.ps, s.konum); SO.ps.y = SO.ps.groundY = SO.world.groundY(SO.ps.x, SO.ps.z); } SO.cam.yaw = Math.PI; }, sen);
  const DT = 1 / 60, total = sen.adimlar.reduce((a, s) => a + s.sure, 0); let times = sen.kareler && sen.kareler.length ? sen.kareler.slice() : Array.from({ length: 12 }, (_, i) => total * (i + 1) / 12);
  times = times.map(t => Math.round(t / DT)); const shots = [], log = []; let n = 0, tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cek-'));
  for (const st of sen.adimlar) { const N = Math.round(st.sure / DT);
    for (let i = 0; i < N; i++) { n++;
      const row = await pg.evaluate(([st, first, dt, olc]) => { const SO = window.SO; SO.joy.x = st.jx || 0; SO.joy.y = st.jy || 0; SO.input.run = !!st.run; if (first && st.jump) SO.input.jump = true; if (st.camYaw != null) SO.cam.yaw = st.camYaw; SO.step(dt);
        if (!olc) return null; const V = new THREE.Vector3(), p = n => { const b = SO.char.bones[n]; b.getWorldPosition(V); return [+V.x.toFixed(4), +V.y.toFixed(4), +V.z.toFixed(4)]; }, ps = SO.ps;
        return { t: +SO.time.toFixed(4), x: +ps.x.toFixed(4), y: +ps.y.toFixed(4), z: +ps.z.toFixed(4), speed: +ps.speed.toFixed(3), yaw: +ps.yaw.toFixed(4), grounded: ps.grounded, gait: +(+ps.gait).toFixed(3), phase: +(+ps.phase).toFixed(3), airBlend: +(+ps.airBlend).toFixed(3), footL: p('foot_l'), footR: p('foot_r'), ballL: p('ball_l'), ballR: p('ball_r'), pelvis: p('pelvis'), head: p('Head') }; }, [st, i === 0, DT, olc]);
      if (row) log.push(row);
      while (times.length && times[0] <= n) { times.shift(); const f = path.join(tmp, `k${String(shots.length).padStart(3, '0')}.png`); await pg.screenshot({ path: f }); shots.push(f); } } }
  await b.close(); srv.close();
  if (olc) fs.writeFileSync(out.replace(/\.png$/, '') + '.json', JSON.stringify(log));
  const cols = Math.min(shots.length, sen.sutun || 6);
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; cols=int(sys.argv[1]); ims=[Image.open(f).convert('RGB') for f in fs]; w,h=ims[0].size; rows=(len(ims)+cols-1)//cols
o=Image.new('RGB',(cols*w,rows*h),'white')
for i,im in enumerate(ims): o.paste(im,((i%cols)*w,(i//cols)*h))
o.save('${out}')`, String(cols), ...shots]);
  console.log(JSON.stringify({ kare: shots.length, cikti: out, hata: errs.slice(0, 5) }));
})();
