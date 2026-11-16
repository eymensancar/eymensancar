/* Tasarım/deneme araçlarının ortak kodu: yerel sunucu, başsız tarayıcı, sayfa içi yardımcılar (window.TA), kare dizme.
   Kullananlar: kusbakisi.cjs, manzara.cjs, yuru.cjs, olcum.cjs. Kılavuz: tasarim/KILAVUZ.md */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const TYPES = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

// --ad deger  |  --ad (true)  |  konumsal değerler `_` dizisinde
function arglar(argv) { const o = { _: [] }; for (let i = 2; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2), v = argv[i + 1]; if (v === undefined || (v.startsWith('--') && isNaN(+v))) o[k] = true; else { o[k] = v; i++; } } else o._.push(a); } return o; }
const sayilar = (s, n) => { const v = String(s).split(/[,x ]+/).filter(Boolean).map(Number); if (v.some(isNaN) || (n && v.length !== n)) throw new Error('sayı listesi bekleniyordu' + (n ? ' (' + n + ' sayı)' : '') + ': ' + s); return v; };

/* Oyunu ?test ile açar (döngü kendiliğinden dönmez). secenek: { boyut: [W, H], tasarim: 'deneme' | 'yok' | null, gizle: true (düğme/çubuk/harita gizlenir) }
   Döner: { pg, hatalar, kapat() }. Sayfada window.TA yardımcıları hazırdır. */
async function ac(secenek) {
  const s = secenek || {}, [W, H] = s.boyut || [960, 540];
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); }); });
  await new Promise(ok => srv.listen(0, ok)); const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); const hatalar = [];
  pg.on('pageerror', e => hatalar.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  const kapat = async () => { await b.close(); srv.close(); };
  await pg.goto(`http://localhost:${port}/?test${s.tasarim ? '&tasarim=' + encodeURIComponent(s.tasarim) : ''}`);
  try { await pg.waitForFunction(() => window.SO && window.SO.ready, null, { timeout: 180000 }); }
  catch (e) { const yazi = await pg.evaluate(() => (document.getElementById('load') || {}).textContent).catch(() => ''); await kapat(); throw new Error('Oyun açılmadı: ' + yazi + '\n' + hatalar.join('\n')); }
  if (s.gizle !== false) await pg.addStyleTag({ content: '#joy,.pad,#fps,#hMini,#envanter,#hTam,#arayuz,.arayuz,[id^="ui"],[id^="ar"]{display:none!important}' });
  await pg.evaluate(SAYFA);
  if (s.tasarim && s.tasarim !== 'yok') { const var_ = await pg.evaluate(() => window.SO.tasarim.bolgeler.map(B => B.id)); if (!var_.length) { await kapat(); throw new Error('Tasarım bölgesi yüklenmedi: ' + s.tasarim + ' (tasarim/' + s.tasarim + '/bolge.js var mı, `sinir` tanımlı mı?)\n' + hatalar.join('\n')); } }
  return { pg, hatalar, kapat };
}

/* Sayfa içi yardımcılar: window.TA
   Yön: araçlar PUSULA açısı kullanır (derece; 0 = kuzey = −z, 90 = doğu = +x, 180 = güney = +z, 270 = batı). Oyunun yaw'ı: ileri = (sin yaw, cos yaw) → yaw = π − pusula. */
const SAYFA = () => {
  const SO = window.SO, W = SO.world, TS = SO.tasarim, RAD = Math.PI / 180;
  const TA = window.TA = {
    yaw: p => Math.PI - p * RAD, pusula: yaw => ((180 - yaw / RAD) % 360 + 360) % 360,
    ileri: p => [Math.sin(p * RAD), -Math.cos(p * RAD)],
    // oyuncuyu (x, z)'ye koyar; çevrenin (arazi parçaları, nesne hücreleri) üretilmesini bekler
    git(x, z, pusula) { const ps = SO.ps; ps.x = x; ps.z = z; ps.vx = ps.vy = ps.vz = 0; ps.speed = 0; ps.grounded = true; ps.kilit = false; ps.yuzme = false; ps.y = ps.groundY = W.groundY(x, z); if (pusula != null) { ps.yaw = TA.yaw(pusula); SO.cam.yaw = ps.yaw; } TA.yukle(); ps.y = ps.groundY = W.groundY(x, z); },
    yukle() { const cam = SO.camera; let n = 0; do { cam.updateMatrixWorld(); W.update(cam); n++; } while (W.durum().kuyruk > 0 && n < 5000); return n; },
    // yüklü hücrelerdeki bütün nesneler
    nesneler() { const L = []; W.yakinNesne(SO.ps.x, SO.ps.z, 1e5, n => { L.push(n); return false; }); return L; },
    // dikdörtgendeki bütün nesneler (oyuncuyu gezdirerek hücreleri ürettirir; sonunda oyuncuyu eski yerine koymaz)
    tara(x0, z0, x1, z1) { const M = new Map(), ad = 640, nx = Math.max(1, Math.ceil((x1 - x0) / ad)), nz = Math.max(1, Math.ceil((z1 - z0) / ad));
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { TA.git(x0 + (i + .5) * (x1 - x0) / nx, z0 + (j + .5) * (z1 - z0) / nz); for (const n of TA.nesneler()) if (n.x >= x0 && n.x <= x1 && n.z >= z0 && n.z <= z1) M.set(n.id, { tur: n.tur, sinif: n.sinif, x: n.x, z: n.z, s: n.s }); }
      return Array.from(M.values()); },
    // yüklü toplanabilirler (dal/taş): oyuncunun çevresindeki 5 × 5 hücre (≈ 240 m kare)
    yerdekiler() { const T = SO.toplama; if (!T || !T.hucreler) return []; for (let k = 0; k < 40; k++) T.update(0); const L = []; T.hucreler.forEach(H => { for (const o of H.ogeler) L.push({ tur: o.tur, x: o.x, z: o.z }); }); return L; },
    egim(x, z) { const e = 2; return Math.hypot(W.groundY(x + e, z) - W.groundY(x - e, z), W.groundY(x, z + e) - W.groundY(x, z - e)) / (2 * e); },
    // en yakın su (y < 0) uzaklığı: 16 yönde 3 m adımla, en çok `enCok` m
    suUzak(x, z, enCok) { if (W.groundY(x, z) < 0) return 0; let en = enCok || 300; for (let a = 0; a < 16; a++) { const dx = Math.cos(a * .3927), dz = Math.sin(a * .3927); for (let d = 3; d < en; d += 3) if (W.groundY(x + dx * d, z + dz * d) < -.05) { en = d; break; } } return en >= (enCok || 300) ? null : en; },
    dogus() { return { x: W.start.x, z: W.start.z }; },
    // nokta çözümü: 'dogus' | 'x,z' | [x, z] | tasarım noktası id'si/adı
    nokta(v) { if (Array.isArray(v)) return { x: +v[0], z: +v[1] }; if (v == null || v === 'dogus') return TA.dogus(); const m = /^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/.exec(v); if (m) return { x: +m[1], z: +m[2] };
      const n = TS && TS.noktalar.find(q => q.id === v || q.ad === v); if (!n) throw new Error('nokta bulunamadı: ' + v + ' (x,z | dogus | tasarım noktası id/ad)'); return { x: n.x, z: n.z, ad: n.ad || n.id }; },
    bolge(id) { const B = TS && TS.bolgeler.find(q => q.id === id); if (!B) throw new Error('bölge yok: ' + id + ' (etkin: ' + (TS ? TS.bolgeler.map(q => q.id).join(', ') : '') + ')'); return { id: B.id, ad: B.ad, x0: B.x0, z0: B.z0, x1: B.x1, z1: B.z1 }; },
    noktalar() { return TS ? TS.noktalar.map(n => ({ id: n.id, tur: n.tur, ad: n.ad || '', x: n.x, z: n.z, yaricap: n.yaricap || 0, yukseklik: n.yukseklik || 0, bolge: n.bolge })) : []; }
  };
};

/* Kareleri numaralı kontak tabakasına dizer. kareler: [{ dosya, yazi }]; sutun: sütun sayısı */
function diz(kareler, cikti, sutun) {
  const liste = path.join(os.tmpdir(), 'diz-' + process.pid + '-' + Date.now() + '.json'); fs.writeFileSync(liste, JSON.stringify({ kareler, cikti, sutun: Math.max(1, Math.min(kareler.length, sutun || 4)) }));
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1], encoding='utf8')); ks = d['kareler']; cols = d['sutun']
ims = [Image.open(k['dosya']).convert('RGB') for k in ks]; w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols; B = 22
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
except Exception: f = ImageFont.load_default()
o = Image.new('RGB', (cols * w, rows * (h + B)), (21, 18, 13)); dr = ImageDraw.Draw(o)
for i, im in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * (h + B); o.paste(im, (x, y + B)); dr.text((x + 6, y + 3), ks[i].get('yazi', ''), fill=(241, 232, 212), font=f)
o.save(d['cikti'])`, liste]); fs.unlinkSync(liste);
}
const gecici = on => fs.mkdtempSync(path.join(os.tmpdir(), (on || 'arac') + '-'));
module.exports = { ac, arglar, sayilar, diz, gecici, root };
