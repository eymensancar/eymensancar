/* Manzara: verilen nokta(lar)dan oyun görüntüsü. Göz hizası (1,7 m) panoraması ya da yüksekten eğik bakış. Çevrenin üretilmesini bekler, sonra kare alır.
   Kullanım:
     node test/manzara.cjs [--nokta "dogus; 1200,800; <nokta id/adı>"] [--pano 4|8 | --yon 0,90,225] [--kus 90] [--goz 1.7] [--egik -2]
                           [--boyut 800x450] [--fov 60] [--tasarim deneme|yok] [--sutun 4] [--cikti manzara.png]
   --nokta  : noktalar `;` ile ayrılır: `dogus` (varsayılan), `x,z`, ya da tasarım ilgi noktasının id'si/adı
   --pano   : 4 (K, D, G, B) ya da 8 yöne bakış (varsayılan 4)      --yon : pusula açıları (0 kuzey, 90 doğu, 180 güney, 270 batı)
   --goz    : göz yüksekliği (m, zeminden; suyun içindeyse su yüzeyinden)      --egik : dikey bakış açısı (derece; eksi = aşağı)
   --kus    : verilirse yüksekten eğik bakış: kamera noktanın `kus` m üstünde ve 1,5 × kus m gerisinde durur, noktaya bakar (karakter ölçek için görünür).
              Yön, kameranın BAKTIĞI yöndür (ör. --yon 0: güneyden kuzeye doğru bakış)
   Çıktı: numaralı kontak tabakası (her karenin üstünde nokta ve yön). Başsız ortamda ekran kartı yok: kare başına birkaç saniye sürer. */
const { ac, arglar, sayilar, diz, gecici } = require('./ortak.cjs'); const path = require('path');
const YON = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
(async () => {
  const a = arglar(process.argv), [W, H] = a.boyut ? sayilar(a.boyut, 2) : [800, 450], cikti = a.cikti || 'manzara.png', t0 = Date.now();
  const yonler = a.yon != null ? sayilar(a.yon) : Array.from({ length: +(a.pano || 4) }, (_, i) => i * 360 / +(a.pano || 4));
  const noktalar = String(a.nokta || 'dogus').split(';').map(s => s.trim()).filter(Boolean);
  const o = await ac({ boyut: [W, H], tasarim: a.tasarim }), tmp = gecici('manzara'), kareler = [], bilgi = [];
  try {
    for (const nk of noktalar) for (const yon of yonler) {
      const r = await o.pg.evaluate(cek, { nk, yon, kus: a.kus ? +a.kus : 0, goz: +(a.goz || 1.7), egik: a.egik != null ? +a.egik : -2, fov: +(a.fov || 60) });
      const f = path.join(tmp, `k${String(kareler.length).padStart(3, '0')}.png`); await o.pg.screenshot({ path: f });
      kareler.push({ dosya: f, yazi: `${kareler.length + 1}. ${r.ad} (${Math.round(r.x)}, ${Math.round(r.z)}) y=${r.y.toFixed(1)} → ${Math.round(yon)}° ${YON[Math.round(yon / 45) % 8]}${a.kus ? ' · ' + a.kus + ' m yukarıdan' : ''}` }); bilgi.push(r);
    }
    diz(kareler, cikti, +(a.sutun || Math.min(4, yonler.length)));
    console.log(JSON.stringify({ kare: kareler.length, cikti, sure_sn: +((Date.now() - t0) / 1000).toFixed(1), noktalar: bilgi.filter((_, i) => i % yonler.length === 0).map(r => ({ ad: r.ad, x: r.x, z: r.z, y: +r.y.toFixed(2), biyom: r.biyom })), hata: o.hatalar.slice(0, 5) }));
  } finally { await o.kapat(); }
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });

function cek(A) {
  const SO = window.SO, W = SO.world, TA = window.TA, cam = SO.camera, p = TA.nokta(A.nk), ps = SO.ps;
  if (TA._son !== A.nk) { TA._son = A.nk; TA.git(p.x, p.z, A.yon); SO.cam.mode = 'takip'; SO.step(0); }
  const gy = W.groundY(p.x, p.z), taban = Math.max(gy, W.SU), f = TA.ileri(A.yon), T3 = window.THREE;
  ps.yaw = TA.yaw(A.yon); SO.char.root.rotation.y = ps.yaw; SO.char.root.visible = !!A.kus;
  if (A.kus) { const d = A.kus * 1.5; let cy = taban + A.kus; for (let k = 0; k <= 10; k++) cy = Math.max(cy, W.groundY(p.x - f[0] * d * k / 10, p.z - f[1] * d * k / 10) + 6); cam.position.set(p.x - f[0] * d, cy, p.z - f[1] * d); cam.lookAt(new T3.Vector3(p.x, taban + 1, p.z)); }
  else { const e = A.egik * Math.PI / 180; cam.position.set(p.x, taban + A.goz, p.z); cam.lookAt(new T3.Vector3(p.x + f[0] * Math.cos(e) * 10, taban + A.goz + Math.sin(e) * 10, p.z + f[1] * Math.cos(e) * 10)); }
  cam.fov = A.fov; cam.updateProjectionMatrix();
  for (let k = 0; k < 26; k++) { cam.updateMatrixWorld(); W.update(cam); } // gizleme sınamaları (tepenin arkası) birkaç karede oturur
  if (SO.toplama) SO.toplama.update(0);
  SO.renderer.render(SO.scene, cam);
  return { ad: p.ad || (A.nk === 'dogus' ? 'Doğuş' : 'Nokta'), x: p.x, z: p.z, y: gy, biyom: W.biyom(p.x, p.z) };
}
