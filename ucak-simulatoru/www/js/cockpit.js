// Kokpit içi (birinci kişi kamera): F-16 sınıfı, Cessna 172 sınıfı ve L-39 sınıfı için ayrıntılı iç mekân.
// Model ekseninde kurulur (+X sağ, +Y yukarı, -Z burun; orijin ağırlık merkezi), main.js ayrı bir sahnede ve ayrı
// bir yakın düzlemle (0.01 m) çizer: dünya ve uçağın dışı önce çizilir, derinlik silinir, kokpit en son çizilir.
// Göstergeler canlıdır: F-16'da yeşil HUD (hız ve irtifa şeritleri, eğim merdiveni, uçuş yolu işareti, baş şeridi),
// iki çok işlevli ekran (hareketli harita, ufuk ve motor), Cessna'da altılı analog göstergeler, L-39'da analog pano.
// Levye, gaz kolu ve dümen kolu girdiyle oynar. Dışarıdan hiçbir dosya yüklenmez: dokular kanvasta çizilir.
import * as THREE from '../vendor/three.module.min.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const KT = 0.514444, FT = 0.3048;

// ---------- yardımcılar ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; return t; }
function mesh(par, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; par.add(o); return o;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// kenarları yuvarlatılmış kutu (pano, konsol)
function rbox(w, h, d, r = 0.01) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const bv = Math.min(r, d / 3);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * bv) / 2); g.computeVertexNormals(); return g;
}
// iki nokta arası boru (çerçeve, kol)
function tubeBetween(par, a, b, r, mat, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg); const o = new THREE.Mesh(g, mat);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  o.castShadow = o.receiveShadow = true; par.add(o); return o;
}
function tubeCurve(par, pts, r, mat, seg = 40) {
  const c = new THREE.CatmullRomCurve3(pts); const o = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 8, false), mat);
  o.castShadow = o.receiveShadow = true; par.add(o); return o;
}
function capsule(par, a, b, r, mat) {
  tubeBetween(par, a, b, r, mat, 12);
  for (const p of [a, b]) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat); s.position.copy(p); s.castShadow = s.receiveShadow = true; par.add(s); }
}
// dörtgen düzlem (dört köşe) - cam, ekran
function quad(par, mat, c0, c1, c2, c3) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...c0, ...c1, ...c2, ...c3], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  const o = new THREE.Mesh(g, mat); par.add(o); return o;
}
// eğik bir düzlemde ekran: merkez, genişlik, yükseklik, x ekseni etrafında geriye yatma
function screen(par, mat, cx, cy, cz, w, h, tilt = 0, ry = 0) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); o.position.set(cx, cy, cz); o.rotation.set(-tilt, ry, 0, 'YXZ'); par.add(o); return o;
}
// elipsoidin (kanopi) üst yarısı üzerinde, verilen z kesitinde yay noktaları
function ellArc(c, R, z, n = 16, from = 0, to = Math.PI) {
  const k = 1 - ((z - c.z) / R.z) ** 2; if (k <= 0) return [];
  const s = Math.sqrt(k), pts = [];
  for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; pts.push(new THREE.Vector3(Math.cos(a) * R.x * s, c.y + Math.sin(a) * R.y * s, z)); }
  return pts;
}

// ---------- kanvas göstergeleri ----------
function dial(g, cx, cy, r, face = '#141516') {
  g.save();
  const rg = g.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r * 1.1);
  rg.addColorStop(0, '#5a5f66'); rg.addColorStop(1, '#16181b');
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r * 1.08, 0, Math.PI * 2); g.fill();
  g.fillStyle = face; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.restore();
}
function ticks(g, cx, cy, r, a0, a1, n, len, w, col = '#eee', every = 0, lenMaj = 0) {
  g.strokeStyle = col; g.lineCap = 'butt';
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, maj = every && i % every === 0, L = maj ? lenMaj || len * 1.8 : len;
    g.lineWidth = maj ? w * 1.6 : w;
    g.beginPath(); g.moveTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r); g.lineTo(cx + Math.sin(a) * (r - L), cy - Math.cos(a) * (r - L)); g.stroke();
  }
}
function needle(g, cx, cy, r, a, w = 0.07, col = '#f4f4f4', tail = 0.18) {
  g.save(); g.translate(cx, cy); g.rotate(a);
  g.fillStyle = col; g.beginPath(); g.moveTo(-r * w * 0.5, r * tail); g.lineTo(-r * w * 0.35, -r * 0.8); g.lineTo(0, -r * 0.95); g.lineTo(r * w * 0.35, -r * 0.8); g.lineTo(r * w * 0.5, r * tail); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#222'; g.beginPath(); g.arc(cx, cy, r * 0.08, 0, Math.PI * 2); g.fill();
}
function label(g, s, x, y, px, col = '#eee', font = 'bold', align = 'center') { g.fillStyle = col; g.font = `${font} ${px}px system-ui, Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); }
function glass(g, cx, cy, r) {
  const lg = g.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.2);
  lg.addColorStop(0, 'rgba(255,255,255,0.16)'); lg.addColorStop(0.45, 'rgba(255,255,255,0.03)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
}
// hız göstergesi
function gASI(g, cx, cy, r, kt, max, arcs) {
  dial(g, cx, cy, r);
  const A = (v) => (-150 + 300 * clamp(v, 0, max) / max) * D2R;
  for (const [a, b, c] of arcs) { g.strokeStyle = c; g.lineWidth = r * 0.07; g.beginPath(); g.arc(cx, cy, r * 0.9, A(a) - Math.PI / 2, A(b) - Math.PI / 2); g.stroke(); }
  ticks(g, cx, cy, r * 0.97, A(0), A(max), max / 10, r * 0.08, r * 0.02, '#eee', 2, r * 0.15);
  g.font = `bold ${r * 0.17}px system-ui`; const step = max > 300 ? 100 : max > 200 ? 40 : 20;
  for (let v = step; v <= max; v += step) { const a = A(v); label(g, String(v), cx + Math.sin(a) * r * 0.68, cy - Math.cos(a) * r * 0.68, r * 0.16); }
  label(g, 'KNOTS', cx, cy + r * 0.38, r * 0.11, '#bbb', '600');
  needle(g, cx, cy, r, A(kt)); glass(g, cx, cy, r);
}
// yapay ufuk
function gAI(g, cx, cy, r, pitch, roll) {
  dial(g, cx, cy, r, '#111');
  g.save(); g.beginPath(); g.arc(cx, cy, r * 0.94, 0, Math.PI * 2); g.clip();
  g.translate(cx, cy); g.rotate(-roll);
  const k = r / 30 * R2D, off = pitch * k;
  g.fillStyle = '#3b7ec9'; g.fillRect(-r * 2, -r * 4 + off, r * 4, r * 4);
  g.fillStyle = '#7a4f2c'; g.fillRect(-r * 2, off, r * 4, r * 4);
  g.strokeStyle = '#fff'; g.lineWidth = r * 0.025; g.beginPath(); g.moveTo(-r * 2, off); g.lineTo(r * 2, off); g.stroke();
  g.lineWidth = r * 0.02;
  for (const d of [-20, -10, -5, 5, 10, 20]) { const y = off - d * r / 30, w = Math.abs(d) % 10 ? r * 0.12 : r * 0.24; g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke(); }
  g.restore();
  // yatış ölçeği
  g.save(); g.translate(cx, cy);
  g.strokeStyle = '#fff'; for (const d of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) { const a = d * D2R; g.lineWidth = Math.abs(d) % 30 ? r * 0.02 : r * 0.035; g.beginPath(); g.moveTo(Math.sin(a) * r * 0.92, -Math.cos(a) * r * 0.92); g.lineTo(Math.sin(a) * r * (Math.abs(d) % 30 ? 0.82 : 0.76), -Math.cos(a) * r * (Math.abs(d) % 30 ? 0.82 : 0.76)); g.stroke(); }
  g.rotate(-roll); g.fillStyle = '#ffcf33'; g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(-r * 0.06, -r * 0.68); g.lineTo(r * 0.06, -r * 0.68); g.fill();
  g.restore();
  g.strokeStyle = '#ffcf33'; g.lineWidth = r * 0.055; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - r * 0.5, cy); g.lineTo(cx - r * 0.18, cy); g.lineTo(cx - r * 0.08, cy + r * 0.08); g.stroke();
  g.beginPath(); g.moveTo(cx + r * 0.5, cy); g.lineTo(cx + r * 0.18, cy); g.lineTo(cx + r * 0.08, cy + r * 0.08); g.stroke();
  g.fillStyle = '#ffcf33'; g.beginPath(); g.arc(cx, cy, r * 0.035, 0, Math.PI * 2); g.fill();
  glass(g, cx, cy, r);
}
// altimetre (ft): üç ibre yerine iki ibre + sayaç
function gALT(g, cx, cy, r, ft) {
  dial(g, cx, cy, r);
  ticks(g, cx, cy, r * 0.97, 0, Math.PI * 2 * 49 / 50, 49, r * 0.08, r * 0.02, '#eee', 5, r * 0.15);
  for (let i = 0; i < 10; i++) { const a = i * 36 * D2R; label(g, String(i), cx + Math.sin(a) * r * 0.7, cy - Math.cos(a) * r * 0.7, r * 0.2); }
  g.fillStyle = '#000'; g.fillRect(cx - r * 0.32, cy + r * 0.2, r * 0.64, r * 0.22);
  label(g, String(Math.max(0, Math.round(ft / 10) * 10)).padStart(5, '0'), cx, cy + r * 0.31, r * 0.17, '#fff', '700');
  label(g, 'ALT', cx, cy - r * 0.32, r * 0.11, '#bbb', '600');
  needle(g, cx, cy, r * 0.62, (ft / 10000) * Math.PI * 2, 0.16);
  needle(g, cx, cy, r, ((ft % 1000) / 1000) * Math.PI * 2, 0.06);
  glass(g, cx, cy, r);
}
// dikey hız (ft/dk)
function gVSI(g, cx, cy, r, fpm) {
  dial(g, cx, cy, r);
  const A = (v) => (-90 + clamp(v, -2000, 2000) / 2000 * 170) * D2R;
  ticks(g, cx, cy, r * 0.97, A(-2000), A(2000), 40, r * 0.07, r * 0.02, '#eee', 5, r * 0.15);
  for (const v of [0, 5, 10, 15, 20]) for (const s of v ? [-1, 1] : [1]) { const a = A(s * v * 100); label(g, String(v), cx + Math.sin(a) * r * 0.68, cy - Math.cos(a) * r * 0.68, r * 0.17); }
  label(g, 'UP', cx + r * 0.35, cy - r * 0.35, r * 0.11, '#bbb', '600'); label(g, 'DN', cx + r * 0.35, cy + r * 0.35, r * 0.11, '#bbb', '600');
  label(g, 'VERT SPEED', cx - r * 0.05, cy, r * 0.09, '#999', '600', 'left');
  needle(g, cx, cy, r, A(fpm));
  glass(g, cx, cy, r);
}
// baş göstergesi (dönen kart)
function gHI(g, cx, cy, r, hdg) {
  dial(g, cx, cy, r);
  g.save(); g.translate(cx, cy); g.rotate(-hdg);
  g.strokeStyle = '#eee';
  for (let i = 0; i < 72; i++) { const a = i * 5 * D2R, L = i % 2 ? r * 0.07 : r * 0.13; g.lineWidth = i % 2 ? r * 0.015 : r * 0.025; g.beginPath(); g.moveTo(Math.sin(a) * r * 0.95, -Math.cos(a) * r * 0.95); g.lineTo(Math.sin(a) * (r * 0.95 - L), -Math.cos(a) * (r * 0.95 - L)); g.stroke(); }
  const N = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
  for (let i = 0; i < 12; i++) { const a = i * 30 * D2R; g.save(); g.rotate(a); label(g, N[i], 0, -r * 0.68, r * (N[i].length > 1 ? 0.15 : 0.2), i % 3 ? '#eee' : '#ffcf33'); g.restore(); }
  g.restore();
  // uçak simgesi
  g.fillStyle = '#ffcf33'; g.beginPath(); g.moveTo(cx, cy - r * 0.42); g.lineTo(cx + r * 0.05, cy - r * 0.1); g.lineTo(cx + r * 0.3, cy + r * 0.02); g.lineTo(cx + r * 0.3, cy + r * 0.08); g.lineTo(cx + r * 0.05, cy + r * 0.04); g.lineTo(cx + r * 0.04, cy + r * 0.28); g.lineTo(cx + r * 0.12, cy + r * 0.35);
  g.lineTo(cx - r * 0.12, cy + r * 0.35); g.lineTo(cx - r * 0.04, cy + r * 0.28); g.lineTo(cx - r * 0.05, cy + r * 0.04); g.lineTo(cx - r * 0.3, cy + r * 0.08); g.lineTo(cx - r * 0.3, cy + r * 0.02); g.lineTo(cx - r * 0.05, cy - r * 0.1); g.closePath(); g.fill();
  g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(cx, cy - r * 0.95); g.lineTo(cx - r * 0.06, cy - r * 1.05); g.lineTo(cx + r * 0.06, cy - r * 1.05); g.fill();
  glass(g, cx, cy, r);
}
// dönüş koordinatörü
function gTC(g, cx, cy, r, turn, slip) {
  dial(g, cx, cy, r);
  label(g, 'L', cx - r * 0.62, cy + r * 0.32, r * 0.15); label(g, 'R', cx + r * 0.62, cy + r * 0.32, r * 0.15);
  label(g, '2 MIN', cx, cy + r * 0.62, r * 0.11, '#bbb', '600');
  g.strokeStyle = '#eee'; g.lineWidth = r * 0.045;
  for (const a of [0, 15, 180, 165]) { const t = a * D2R, c = Math.cos(t), sn = Math.sin(t); g.beginPath(); g.moveTo(cx + c * r * 0.95, cy + sn * r * 0.95); g.lineTo(cx + c * r * 0.78, cy + sn * r * 0.78); g.stroke(); }
  // eğim borusu ve top
  g.fillStyle = '#0c0c0c'; g.strokeStyle = '#888'; g.lineWidth = r * 0.02;
  g.beginPath(); g.ellipse(cx, cy + r * 0.38, r * 0.45, r * 0.11, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#111'; g.beginPath(); g.arc(cx + clamp(slip, -1, 1) * r * 0.36, cy + r * 0.38, r * 0.085, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ddd'; g.beginPath(); g.arc(cx + clamp(slip, -1, 1) * r * 0.36, cy + r * 0.38, r * 0.075, 0, Math.PI * 2); g.fill();
  // uçak (dönüşle yatar: 3°/sn = 15°)
  g.save(); g.translate(cx, cy); g.rotate(clamp(turn / 3 * 15, -30, 30) * D2R);
  g.fillStyle = '#f2f2f2'; g.fillRect(-r * 0.62, -r * 0.03, r * 1.24, r * 0.06); g.beginPath(); g.arc(0, 0, r * 0.1, 0, Math.PI * 2); g.fill(); g.fillRect(-r * 0.015, -r * 0.22, r * 0.03, r * 0.15);
  g.restore(); glass(g, cx, cy, r);
}
function gRPM(g, cx, cy, r, rpm, max = 3500, lab = 'RPM', red = 2700, unit = 100, div = 100) {
  dial(g, cx, cy, r);
  const A = (v) => (-135 + 270 * clamp(v, 0, max) / max) * D2R;
  g.strokeStyle = '#3c3'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(cx, cy, r * 0.9, A(red * 0.78) - Math.PI / 2, A(red) - Math.PI / 2); g.stroke();
  g.strokeStyle = '#e33'; g.beginPath(); g.arc(cx, cy, r * 0.9, A(red) - Math.PI / 2, A(red * 1.015) - Math.PI / 2); g.stroke();
  ticks(g, cx, cy, r * 0.97, A(0), A(max), max / unit, r * 0.07, r * 0.02, '#eee', 5, r * 0.14);
  for (let v = 0; v <= max; v += unit * 5) { const a = A(v); label(g, String(Math.round(v / div)), cx + Math.sin(a) * r * 0.66, cy - Math.cos(a) * r * 0.66, r * 0.16); }
  label(g, lab, cx, cy + r * 0.42, r * 0.12, '#bbb', '600');
  needle(g, cx, cy, r, A(rpm)); glass(g, cx, cy, r);
}
function gG(g, cx, cy, r, n, nmax) {
  dial(g, cx, cy, r);
  const A = (v) => (-150 + 300 * (clamp(v, -4, 10) + 4) / 14) * D2R;
  ticks(g, cx, cy, r * 0.97, A(-4), A(10), 14, r * 0.12, r * 0.025, '#eee', 2, r * 0.18);
  for (let v = -4; v <= 10; v += 2) { const a = A(v); label(g, String(v), cx + Math.sin(a) * r * 0.66, cy - Math.cos(a) * r * 0.66, r * 0.17); }
  label(g, 'G', cx, cy + r * 0.4, r * 0.16, '#bbb');
  needle(g, cx, cy, r * 0.9, A(nmax), 0.05, '#e33'); needle(g, cx, cy, r, A(n)); glass(g, cx, cy, r);
}
// konsol ve pano için duran ayrıntı dokusu: anahtarlar, düğmeler, yazılar (kendi çizimimiz)
function detailTex(w, h, seed, base = '#1d2023') {
  const c = canvas(w, h), g = c.getContext('2d');
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const cols = Math.round(w / 128), rows = Math.round(h / 96);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * w / cols, y = j * h / rows, pw = w / cols, ph = h / rows;
    g.fillStyle = '#16181a'; g.fillRect(x + 3, y + 3, pw - 6, ph - 6);
    g.strokeStyle = '#3a3e42'; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, pw - 6, ph - 6);
    for (const [sx, sy] of [[x + 8, y + 8], [x + pw - 8, y + 8], [x + 8, y + ph - 8], [x + pw - 8, y + ph - 8]]) { g.fillStyle = '#55595e'; g.beginPath(); g.arc(sx, sy, 2.2, 0, 7); g.fill(); }
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const kx = x + pw * (k + 0.5) / n, ky = y + ph * (0.35 + rnd() * 0.25), t = rnd();
      if (t < 0.45) { // geçiş anahtarı
        g.fillStyle = '#0c0d0e'; g.beginPath(); g.arc(kx, ky, 7, 0, 7); g.fill(); g.fillStyle = '#c9cdd1'; g.fillRect(kx - 2, ky - 12, 4, 12);
      } else if (t < 0.8) { // döner düğme
        g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(kx, ky, 10, 0, 7); g.fill(); g.fillStyle = '#ddd'; g.fillRect(kx - 1.5, ky - 10, 3, 7);
      } else { g.fillStyle = rnd() < 0.5 ? '#8a6a12' : '#2a5f2a'; g.fillRect(kx - 9, ky - 6, 18, 12); }
      g.fillStyle = '#d8dcdf'; g.fillRect(kx - 12, ky + 14, 24, 2.4); if (rnd() < 0.6) g.fillRect(kx - 7, ky + 19, 14, 2);
    }
    g.fillStyle = '#e6e9eb'; g.fillRect(x + pw * 0.2, y + ph - 16, pw * 0.6, 3);
  }
  return tex(c);
}

// ---------- ortak malzemeler ----------
function materials(envMap, kind) {
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMap, envMapIntensity: 0.35, roughness: 0.75, metalness: 0.05 }, o));
  const M = {
    grey: std({ color: kind === 'c172' ? 0x8f8b84 : 0x4a5055, roughness: 0.85 }),
    dark: std({ color: 0x24272a, roughness: 0.8 }),
    black: std({ color: 0x0f1011, roughness: 0.7 }),
    matte: std({ color: 0x111213, roughness: 0.95 }),
    metal: std({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85, envMapIntensity: 0.8 }),
    frame: std({ color: 0x3b4045, roughness: 0.55, metalness: 0.4 }),
    seat: std({ color: kind === 'c172' ? 0x6d655a : 0x3d4a3e, roughness: 0.95 }),
    cushion: std({ color: kind === 'c172' ? 0x4e4a46 : 0x29302a, roughness: 1 }),
    suit: std({ color: 0x4d5442, roughness: 0.95 }),
    boot: std({ color: 0x1a1816, roughness: 0.7 }),
    yellow: std({ color: 0xe2b512, roughness: 0.6 }),
    red: std({ color: 0xb3261e, roughness: 0.6 }),
    white: std({ color: 0xf1f1ef, roughness: 0.5, envMapIntensity: 0.6 }),
    glare: std({ color: 0x2b2d30, roughness: 0.95, envMapIntensity: 0.15 }),
    // kanopi camı içten: hafif renkli, gökyüzünü belli belirsiz yansıtır
    canopy: new THREE.MeshStandardMaterial({ color: kind === 'f16' ? 0xc9a85a : 0xa8b8c4, metalness: 1, roughness: 0.06, envMap, envMapIntensity: 1.0, transparent: true, opacity: kind === 'f16' ? 0.13 : 0.09, depthWrite: false, side: THREE.DoubleSide }),
  };
  return M;
}
function dynScreen(w, h) { const c = canvas(w, h); const t = tex(c); const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); return { c, g: c.getContext('2d'), t, m }; }

// ======================================================================
export function buildCockpit(id, opt = {}) {
  const root = new THREE.Group(); root.name = 'kokpit';
  const M = materials(opt.envMap || null, id);
  const ctx = { root, M, opt, anim: [], screens: [], t: 1, tSlow: 1, tMid: 1 }; // ilk karede bütün ekranlar çizilir
  let eye;
  if (id === 'f16') eye = buildF16(ctx);
  else if (id === 'jet') eye = buildL39(ctx);
  else eye = buildC172(ctx);
  root.traverse((o) => { if (o.isMesh && o.material && o.material.transparent) { o.castShadow = false; } });
  return {
    root, eye, look: ctx.look || 0,
    update(ac, input, dt) {
      ctx.t += dt; ctx.tSlow += dt; ctx.tMid += dt;
      for (const f of ctx.anim) f(ac, input, dt);
      const fast = ctx.t > 1 / 30, mid = ctx.tMid > 1 / 15, slow = ctx.tSlow > 1 / 7;
      for (const s of ctx.screens) {
        if ((s.rate === 'fast' && fast) || (s.rate === 'mid' && mid) || (s.rate === 'slow' && slow)) { s.draw(ac, input); s.tex.needsUpdate = true; }
      }
      if (fast) ctx.t = 0; if (mid) ctx.tMid = 0; if (slow) ctx.tSlow = 0;
    },
  };
}

// ---------- uçuş verisi (göstergeler için) ----------
function fd(ac) {
  const q = ac.q, [w, x, y, z] = q;
  const phi = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const theta = Math.asin(clamp(2 * (w * y - z * x), -1, 1));
  const psi = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  const sig = ac.out.rho / 1.225;
  return { phi, theta, psi, ias: ac.out.V * Math.sqrt(sig) / KT, alt: ac.alt, vs: -ac.vel[2], alpha: ac.out.alpha || 0, beta: ac.out.beta || 0, M: ac.out.M || 0, nz: ac.nz, agl: ac.out.agl || 0 };
}

// ======================================================================
// F-16 sınıfı: tek kişilik, kabarcık kanopi, HUD, iki MFD, yan levye, sol konsolda gaz kolu, ACES II benzeri koltuk.
// Göz (0, 1.0, -3.55). Kanopi elipsoidi merkez (0, 0.5, -4.0), yarıçaplar (0.47, 0.72, 2.0) (dış modelle aynı).
// ======================================================================
function buildF16(C) {
  const { root, M } = C;
  const E = new THREE.Vector3(0, 1.0, -3.55);
  const CC = new THREE.Vector3(0, 0.5, -4.0), CR = new THREE.Vector3(0.47, 0.72, 2.0);
  // --- tekne (kokpit duvarları ve tabanı) ---
  const wallTex = detailTex(512, 256, 7, '#2b2f33');
  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85, envMap: C.opt.envMap, envMapIntensity: 0.25 });
  for (const s of [-1, 1]) {
    mesh(root, box(0.03, 0.62, 1.6), M.grey, s * 0.37, 0.36, -3.85);            // yan duvar
    mesh(root, box(0.07, 0.05, 1.9), M.frame, s * 0.39, 0.68, -3.85);           // kanopi rayı (sill)
    mesh(root, rbox(0.16, 0.11, 1.05, 0.012), M.dark, s * 0.285, 0.505, -3.72); // konsol gövdesi
    const top = mesh(root, new THREE.PlaneGeometry(0.15, 1.0), wall, s * 0.285, 0.562, -3.72, -Math.PI / 2, 0, 0); top.castShadow = false;
  }
  mesh(root, box(0.74, 0.02, 1.6), M.dark, 0, 0.05, -3.85); // taban
  mesh(root, box(0.74, 0.5, 0.03), M.dark, 0, 0.3, -4.62);   // ön perde (ayak boşluğu)
  // --- pano: hafif geriye yatık ana yüzey ---
  const pTilt = 12 * D2R;
  const panelTex = (() => {
    const c = canvas(1024, 512), g = c.getContext('2d');
    g.fillStyle = '#2e3236'; g.fillRect(0, 0, 1024, 512);
    // MFD çerçeveleri (düğmeli)
    for (const cx of [262, 762]) {
      g.fillStyle = '#16181a'; g.fillRect(cx - 150, 96, 300, 300);
      g.fillStyle = '#0a0b0c'; g.fillRect(cx - 112, 134, 224, 224);
      for (let i = 0; i < 5; i++) { const o = -88 + i * 44; for (const [x, y] of [[cx + o, 113], [cx + o, 379], [cx - 131, 246 + o], [cx + 131, 246 + o]]) { g.fillStyle = '#3c4044'; g.fillRect(x - 13, y - 10, 26, 20); g.fillStyle = '#9ca2a8'; g.fillRect(x - 9, y - 6, 18, 12); } }
      g.fillStyle = '#cfd3d6'; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.fillText('BRT  CON', cx - 100, 88); g.fillText('SYM', cx + 110, 88);
    }
    // orta: yedek göstergelerin çerçeveleri ve anahtarlar
    g.fillStyle = '#1a1c1e'; g.fillRect(452, 300, 120, 170);
    for (const [x, y] of [[470, 40], [512, 40], [554, 40], [470, 470], [554, 470]]) { g.fillStyle = '#0c0d0e'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.fillStyle = '#c8ccd0'; g.fillRect(x - 3, y - 16, 6, 16); }
    g.fillStyle = '#ffcf33'; g.fillRect(40, 440, 60, 34); g.fillStyle = '#111'; g.font = 'bold 15px system-ui'; g.fillText('MASTER', 70, 458); g.fillText('CAUTION', 70, 471);
    g.fillStyle = '#b3261e'; g.fillRect(924, 440, 60, 34); g.fillStyle = '#fff'; g.fillText('FIRE', 954, 462);
    g.strokeStyle = '#4a4f54'; g.lineWidth = 3; g.strokeRect(6, 6, 1012, 500);
    return tex(c);
  })();
  const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.8, envMap: C.opt.envMap, envMapIntensity: 0.2 });
  const PW = 0.62, PH = 0.31, PZ = -4.42, PY = 0.69;
  const panel = mesh(root, new THREE.PlaneGeometry(PW, PH), panelMat, 0, PY, PZ, -pTilt, 0, 0);
  mesh(root, box(PW + 0.02, PH, 0.04), M.dark, 0, PY, PZ - 0.025, -pTilt, 0, 0);
  // panodaki bir noktanın (u,v: -0.5..0.5) model koordinatı
  const pp = (u, v, off = 0.003) => new THREE.Vector3(u * PW, PY + v * PH * Math.cos(pTilt), PZ - v * PH * Math.sin(pTilt) + off * Math.cos(pTilt));
  // --- MFD'ler: sol hareketli harita, sağ ufuk + motor ---
  const mfdL = dynScreen(256, 256), mfdR = dynScreen(256, 256);
  for (const [scr, u] of [[mfdL, (262 - 512) / 1024], [mfdR, (762 - 512) / 1024]]) {
    const p = pp(u, (256 - 246) / 512, 0.004); const w = 224 / 1024 * PW;
    screen(root, scr.m, p.x, p.y, p.z, w, w, pTilt);
  }
  C.screens.push({ rate: 'slow', tex: mfdL.t, draw: (ac) => drawMFDmap(mfdL.g, 256, ac, C.opt.drawMap) });
  C.screens.push({ rate: 'mid', tex: mfdR.t, draw: (ac) => drawMFDadi(mfdR.g, 256, ac) });
  // yedek ufuk (küçük, analog)
  const sb = dynScreen(128, 128); { const p = pp(0, (256 - 385) / 512, 0.004); screen(root, sb.m, p.x, p.y, p.z, 0.075, 0.075, pTilt); }
  C.screens.push({ rate: 'mid', tex: sb.t, draw: (ac) => { const f = fd(ac); sb.g.fillStyle = '#1a1c1e'; sb.g.fillRect(0, 0, 128, 128); gAI(sb.g, 64, 64, 56, f.theta, f.phi); } });
  // --- parlama önleyici (glare shield) ve HUD gövdesi ---
  mesh(root, rbox(0.66, 0.4, 0.03, 0.012), M.glare, 0, 0.835, -4.62, -Math.PI / 2 + 0.1, 0, 0);
  mesh(root, rbox(0.64, 0.035, 0.03, 0.01), M.glare, 0, 0.835, -4.425);
  mesh(root, rbox(0.2, 0.06, 0.2, 0.012), M.black, 0, 0.862, -4.37);   // HUD gövdesi
  mesh(root, box(0.17, 0.004, 0.09), M.dark, 0, 0.893, -4.33);
  // ICP (ön kumanda paneli) tuş takımı + DED (yeşil yazılı ekran)
  const icpTex = (() => { const c = canvas(256, 128), g = c.getContext('2d'); g.fillStyle = '#141617'; g.fillRect(0, 0, 256, 128);
    const K = ['1', '2', '3', 'COM', '4', '5', '6', 'IFF', '7', '8', '9', 'LIST', 'RCL', '0', 'ENTR', 'A-A'];
    K.forEach((k, i) => { const x = 12 + (i % 4) * 60, y = 50 + Math.floor(i / 4) * 19; g.fillStyle = '#3a3f44'; g.fillRect(x, y, 50, 16); g.fillStyle = '#e8eaec'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, x + 25, y + 8); });
    return tex(c); })();
  mesh(root, new THREE.PlaneGeometry(0.18, 0.09), new THREE.MeshStandardMaterial({ map: icpTex, roughness: 0.7 }), 0, 0.8, -4.385, -0.35, 0, 0);
  const ded = dynScreen(256, 64); screen(root, ded.m, 0, 0.822, -4.392, 0.12, 0.03, 0.35);
  C.screens.push({ rate: 'slow', tex: ded.t, draw: (ac) => { const f = fd(ac), g = ded.g; g.fillStyle = '#020a03'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#7dff8a'; g.font = 'bold 17px ui-monospace, Menlo, monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(`UHF 242.0  STPT  1`, 8, 6); g.fillText(`${String(Math.round(f.ias)).padStart(3)}KT  ${String(Math.round(f.alt / FT)).padStart(6)}FT`, 8, 26); g.fillText(`M${f.M.toFixed(2)}  ${(f.nz).toFixed(1)}G  ${Math.round(ac.spool * 100)}%`, 8, 45); } });
  // --- HUD camı (combiner) ve sembolojisi ---
  const d = 0.65, azM = 10 * D2R, elT = 8.5 * D2R, elB = -7.3 * D2R;
  const hw = d * Math.tan(azM), yT = E.y + d * Math.tan(elT), yB = E.y + d * Math.tan(elB), zH = E.z - d;
  // combiner camı gözden bakınca HUD alanını tam kaplar (az ±10°, el -8°..+8.5°)
  const gB = [0.73 * Math.tan(azM), E.y + 0.73 * Math.tan(-8 * D2R), E.z - 0.73], gT = [0.70 * Math.tan(azM), E.y + 0.70 * Math.tan(elT), E.z - 0.70];
  for (const s of [-1, 1]) tubeBetween(root, new THREE.Vector3(s * (gB[0] + 0.006), gB[1] - 0.004, gB[2]), new THREE.Vector3(s * (gT[0] + 0.006), gT[1], gT[2]), 0.0045, M.frame);
  tubeBetween(root, new THREE.Vector3(-gT[0] - 0.006, gT[1], gT[2]), new THREE.Vector3(gT[0] + 0.006, gT[1], gT[2]), 0.0035, M.frame);
  const comb = new THREE.MeshStandardMaterial({ color: 0x5fae7c, metalness: 0.9, roughness: 0.05, envMap: C.opt.envMap, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  quad(root, comb, [-gB[0], gB[1], gB[2]], [gB[0], gB[1], gB[2]], [gT[0], gT[1], gT[2]], [-gT[0], gT[1], gT[2]]).renderOrder = 3;
  const HW = 512, HH = Math.round(512 * (Math.tan(elT) - Math.tan(elB)) / (2 * Math.tan(azM)));
  const hud = dynScreen(HW, HH);
  hud.m = new THREE.MeshBasicMaterial({ map: hud.t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const hudMesh = quad(root, hud.m, [-hw, yB, zH], [hw, yB, zH], [hw, yT, zH], [-hw, yT, zH]); hudMesh.renderOrder = 4;
  const hudProj = { tx: Math.tan(azM), tT: Math.tan(elT), tB: Math.tan(elB), W: HW, H: HH };
  C.screens.push({ rate: 'fast', tex: hud.t, draw: (ac) => drawHUD(hud.g, hudProj, ac) });
  // --- kanopi: cam, arka kemer, raylar, aynalar ---
  const cg = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const can = new THREE.Mesh(cg, M.canopy); can.scale.copy(CR); can.position.copy(CC); can.renderOrder = 2; root.add(can);
  const bowZ = -3.12;
  tubeCurve(root, ellArc(CC, new THREE.Vector3(CR.x - 0.012, CR.y - 0.012, CR.z), bowZ, 20), 0.022, M.frame);
  tubeCurve(root, ellArc(CC, new THREE.Vector3(CR.x - 0.02, CR.y - 0.02, CR.z), bowZ + 0.05, 20), 0.012, M.frame);
  for (const s of [-1, 1]) { // aynalar kemerin önünde
    const a = s > 0 ? 0.55 : Math.PI - 0.55; const k = Math.sqrt(1 - ((bowZ - 0.04 - CC.z) / CR.z) ** 2);
    const p = new THREE.Vector3(Math.cos(a) * CR.x * k * 0.93, CC.y + Math.sin(a) * CR.y * k * 0.93, bowZ - 0.04);
    const mr = mesh(root, box(0.11, 0.045, 0.012), M.black, p.x, p.y, p.z, 0.25, 0, -s * 0.5);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.037), new THREE.MeshStandardMaterial({ color: 0xaab4bd, metalness: 1, roughness: 0.02, envMap: C.opt.envMap, envMapIntensity: 1.4 })); gl.position.z = -0.007; gl.rotation.y = Math.PI; mr.add(gl);
  }
  { const top = ellArc(CC, CR, bowZ, 20)[10]; mesh(root, box(0.13, 0.045, 0.012), M.black, 0, top.y - 0.035, bowZ - 0.04, 0.35, 0, 0); }
  // kanopi iç kenar şeritleri (kenar contası) iki yanda
  for (const s of [-1, 1]) tubeCurve(root, [-4.7, -4.3, -3.9, -3.5, -3.1].map((z) => new THREE.Vector3(s * CR.x * Math.sqrt(Math.max(0, 1 - ((z - CC.z) / CR.z) ** 2)) * 0.985, CC.y + 0.035, z)), 0.012, M.black);
  // --- koltuk (ACES II benzeri) ---
  const seat = new THREE.Group(); seat.position.set(0, 0, 0); root.add(seat);
  mesh(seat, rbox(0.44, 0.1, 0.46, 0.03), M.seat, 0, 0.27, -3.55);                   // oturak
  const back = mesh(seat, rbox(0.44, 0.78, 0.12, 0.03), M.seat, 0, 0.66, -3.25, 0.5, 0, 0); // sırt (30° geriye)
  mesh(seat, rbox(0.38, 0.62, 0.05, 0.02), M.cushion, 0, 0.66, -3.31, 0.5, 0, 0);
  mesh(seat, rbox(0.3, 0.26, 0.15, 0.03), M.seat, 0, 1.13, -3.08, 0.35, 0, 0);       // baş yastığı (paraşüt kabı)
  mesh(seat, rbox(0.24, 0.14, 0.02, 0.01), M.cushion, 0, 1.1, -3.16, 0.35, 0, 0);
  for (const s of [-1, 1]) { mesh(seat, box(0.035, 0.95, 0.06), M.frame, s * 0.24, 0.72, -3.15, 0.45, 0, 0); mesh(seat, box(0.03, 0.12, 0.3), M.dark, s * 0.24, 0.34, -3.55); }
  // ejeksiyon kolu: sarı-siyah çizgili halka, dizlerin arasında
  const stripe = (() => { const c = canvas(64, 8), g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#e8b90f'; g.fillRect(i * 8, 0, 8, 8); } const t = tex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })();
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.6 }));
  handle.position.set(0, 0.33, -3.8); handle.rotation.set(-0.3, 0, 0); root.add(handle);
  // --- pilotun bacakları ---
  for (const s of [-1, 1]) {
    const hip = new THREE.Vector3(s * 0.11, 0.36, -3.42), knee = new THREE.Vector3(s * 0.13, 0.56, -3.98), ank = new THREE.Vector3(s * 0.15, 0.17, -4.32);
    capsule(root, hip, knee, 0.075, M.suit); capsule(root, knee, ank, 0.058, M.suit);
    mesh(root, rbox(0.1, 0.1, 0.24, 0.03), M.boot, s * 0.15, 0.12, -4.4);
    mesh(root, box(0.1, 0.16, 0.03), M.metal, s * 0.15, 0.18, -4.55, -0.4, 0, 0); // dümen pedalı
  }
  // --- yan levye (sağ konsol) ---
  const stickP = new THREE.Group(); stickP.position.set(0.27, 0.565, -3.88); root.add(stickP);
  mesh(root, rbox(0.11, 0.06, 0.16, 0.012), M.black, 0.27, 0.575, -3.85);
  mesh(stickP, new THREE.CylinderGeometry(0.019, 0.022, 0.09, 12), M.black, 0, 0.045, 0, -0.25, 0, 0);
  const grip = mesh(stickP, rbox(0.045, 0.1, 0.05, 0.018), M.dark, 0, 0.12, -0.02, -0.3, 0, 0);
  mesh(stickP, new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), M.black, 0, 0.175, -0.02); // tepe düğmesi
  mesh(stickP, box(0.012, 0.022, 0.012), M.red, 0.012, 0.165, -0.045); // tetik / düğme
  C.anim.push((ac, inp) => { const tp = clamp(ac.ctl.pitch, -1, 1), tr = clamp(ac.ctl.roll, -1, 1); stickP.rotation.x += ((tp * 9 * D2R) - stickP.rotation.x) * 0.4; stickP.rotation.z += ((-tr * 8 * D2R) - stickP.rotation.z) * 0.4; });
  // --- gaz kolu (sol konsol): ileri = daha çok gaz ---
  mesh(root, box(0.03, 0.01, 0.3), M.black, -0.26, 0.568, -3.78);
  const thrP = new THREE.Group(); thrP.position.set(-0.26, 0.52, -3.78); root.add(thrP);
  mesh(thrP, box(0.02, 0.09, 0.02), M.metal, 0, 0.075, 0);
  const tg = mesh(thrP, rbox(0.06, 0.07, 0.09, 0.02), M.dark, -0.012, 0.135, -0.005, 0, 0, 0.15);
  mesh(thrP, box(0.014, 0.014, 0.014), M.red, 0.018, 0.155, -0.03);
  C.anim.push((ac) => { const a = 0.4 - clamp(ac.ctl.throttle, 0, 1) * 0.8; thrP.rotation.x += (a - thrP.rotation.x) * 0.3; });
  // --- motor ve diğer küçük ayrıntılar: oksijen hortumu ---
  tubeCurve(root, [new THREE.Vector3(-0.22, 0.4, -3.4), new THREE.Vector3(-0.16, 0.55, -3.6), new THREE.Vector3(-0.08, 0.75, -3.75), new THREE.Vector3(-0.04, 0.88, -3.72)], 0.014, M.matte);
  return E;
}

// HUD çizimi: kanvas, gözden 0.65 m'deki düzlemdir; bir yönün kanvas noktası, gövde eksenindeki yönün tanjantlarıyla bulunur
function drawHUD(g, P, ac) {
  const { W, H, tx, tT, tB } = P, f = fd(ac);
  const q = ac.q, [qw, qx, qy, qz] = q;
  // gövde -> dünya matrisi (satır sıralı); dünya -> gövde = devrik
  const m = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qw * qz), 2 * (qx * qz + qw * qy), 2 * (qx * qy + qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qw * qx), 2 * (qx * qz - qw * qy), 2 * (qy * qz + qw * qx), 1 - 2 * (qx * qx + qy * qy)];
  const toPx = (bx, by, bz) => (bx <= 0.05 ? null : [(by / bx / tx * 0.5 + 0.5) * W, (tT - (-bz / bx)) / (tT - tB) * H]);
  const dirPx = (n, e, d) => toPx(m[0] * n + m[3] * e + m[6] * d, m[1] * n + m[4] * e + m[7] * d, m[2] * n + m[5] * e + m[8] * d);
  g.clearRect(0, 0, W, H);
  const C = '#5dff7a'; g.strokeStyle = C; g.fillStyle = C; g.lineWidth = 2.2; g.lineCap = 'round';
  g.shadowColor = 'rgba(80,255,120,0.9)'; g.shadowBlur = 4;
  g.font = 'bold 15px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle';
  const bore = toPx(1, 0, 0);
  // eğim merdiveni (dünyaya bağlı): her 5°
  const psi = f.psi;
  for (let p = -85; p <= 85; p += 5) {
    if (Math.abs(p * D2R - f.theta) > 25 * D2R) continue;
    const pr = p * D2R, seg = [];
    for (const da of [-7, -2.5, 2.5, 7]) { const h = psi + da * D2R / Math.max(0.2, Math.cos(pr)); seg.push(dirPx(Math.cos(pr) * Math.cos(h), Math.cos(pr) * Math.sin(h), -Math.sin(pr))); }
    if (seg.some((s) => !s)) continue;
    g.setLineDash(p < 0 ? [7, 5] : []);
    const big = p === 0;
    if (big) { const L = dirPx(Math.cos(psi - 0.35), Math.sin(psi - 0.35), 0), R = dirPx(Math.cos(psi + 0.35), Math.sin(psi + 0.35), 0); if (L && R) { g.beginPath(); g.moveTo(...L); g.lineTo(...seg[1]); g.moveTo(...seg[2]); g.lineTo(...R); g.stroke(); } }
    else {
      g.beginPath(); g.moveTo(...seg[0]); g.lineTo(...seg[1]); g.moveTo(...seg[2]); g.lineTo(...seg[3]); g.stroke();
      // uç tırnakları (ufka doğru)
      const tick = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * (p > 0 ? 1 : -1) * 8, ny = dx / l * (p > 0 ? 1 : -1) * 8; g.beginPath(); g.moveTo(...a); g.lineTo(a[0] + nx, a[1] + ny); g.stroke(); };
      tick(seg[0], seg[1]); tick(seg[3], seg[2]);
      g.setLineDash([]); g.font = 'bold 13px ui-monospace, Menlo, monospace';
      g.textAlign = 'right'; g.fillText(String(Math.abs(p)), seg[0][0] - 4, seg[0][1]); g.textAlign = 'left'; g.fillText(String(Math.abs(p)), seg[3][0] + 4, seg[3][1]);
    }
  }
  g.setLineDash([]);
  // gövde ekseni işareti (W)
  if (bore) { const [x, y] = bore; g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 11, y); g.lineTo(x - 5.5, y + 8); g.lineTo(x, y); g.lineTo(x + 5.5, y + 8); g.lineTo(x + 11, y); g.lineTo(x + 22, y); g.stroke(); }
  // uçuş yolu işareti (hız vektörü)
  const v = ac.vel, V = Math.hypot(v[0], v[1], v[2]);
  if (V > 20) {
    let fp = dirPx(v[0] / V, v[1] / V, v[2] / V), ghost = false;
    if (!fp || fp[0] < 20 || fp[0] > W - 20 || fp[1] < 20 || fp[1] > H - 20) { if (fp) { fp = [clamp(fp[0], 20, W - 20), clamp(fp[1], 20, H - 20)]; ghost = true; } }
    if (fp) { const [x, y] = fp; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.moveTo(x - 7, y); g.lineTo(x - 19, y); g.moveTo(x + 7, y); g.lineTo(x + 19, y); g.moveTo(x, y - 7); g.lineTo(x, y - 15); g.stroke();
      if (ghost) { g.beginPath(); g.moveTo(x - 8, y - 8); g.lineTo(x + 8, y + 8); g.moveTo(x + 8, y - 8); g.lineTo(x - 8, y + 8); g.stroke(); } }
  }
  // hız (sol) ve irtifa (sağ) şeritleri
  const tape = (x, val, step, lab, left) => {
    const top = H * 0.2, bot = H * 0.78, mid = (top + bot) / 2, ppu = (bot - top) / (step * 6);
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
    g.font = 'bold 12px ui-monospace, Menlo, monospace'; g.textAlign = left ? 'right' : 'left';
    const v0 = Math.floor((val - step * 3) / (step / 2)) * (step / 2);
    for (let t = v0; t <= val + step * 3; t += step / 2) { const y = mid - (t - val) * ppu; if (y < top || y > bot) continue; const maj = Math.round(t / step) * step === t; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (left ? -1 : 1) * (maj ? 9 : 5), y); g.stroke(); if (maj && Math.abs(y - mid) > 12) g.fillText(lab(t), x + (left ? -12 : 12), y); }
    g.font = 'bold 16px ui-monospace, Menlo, monospace';
    const s = lab(val, true), bw = 58, bx = left ? x - 12 - bw : x + 12;
    g.clearRect(bx, mid - 11, bw, 22); g.strokeRect(bx, mid - 11, bw, 22); g.fillText(s, left ? bx + bw - 4 : bx + 4, mid + 1);
  };
  tape(W * 0.24, f.ias, 50, (t, b) => String(Math.round(Math.max(0, t))), true);
  tape(W * 0.76, f.alt / FT, 500, (t, b) => (b ? String(Math.round(t / 10) * 10) : (t / 1000).toFixed(1).replace('.0', '')), false);
  // baş şeridi (üst)
  { const top = H * 0.05, cx = W / 2, ppd = W * 0.42 / 30; let hd = ((f.psi * R2D) % 360 + 360) % 360;
    g.font = 'bold 12px ui-monospace, Menlo, monospace'; g.textAlign = 'center';
    for (let a = Math.ceil((hd - 15) / 5) * 5; a <= hd + 15; a += 5) { const x = cx + (a - hd) * ppd; g.beginPath(); g.moveTo(x, top + 16); g.lineTo(x, top + (a % 10 ? 21 : 25)); g.stroke(); if (a % 10 === 0) g.fillText(String(((a % 360) + 360) % 360 / 10).padStart(2, '0'), x, top + 6); }
    g.beginPath(); g.moveTo(cx, top + 27); g.lineTo(cx - 5, top + 34); g.lineTo(cx + 5, top + 34); g.closePath(); g.stroke(); }
  // sayısal değerler: g, Mach, hücum açısı, en çok g
  ac._gmax = Math.max(ac._gmax || 1, f.nz);
  g.font = 'bold 14px ui-monospace, Menlo, monospace'; g.textAlign = 'left';
  g.fillText(`${f.nz.toFixed(1)}`, W * 0.05, H * 0.1); g.fillText(`M ${f.M.toFixed(2)}`, W * 0.05, H * 0.84); g.fillText(`${ac._gmax.toFixed(1)}`, W * 0.05, H * 0.9);
  g.fillText(`α ${(f.alpha * R2D).toFixed(0)}`, W * 0.05, H * 0.16);
  g.textAlign = 'right'; g.fillText(`${Math.round(f.vs / FT * 60 / 10) * 10}`, W * 0.95, H * 0.1);
  if (f.agl < 1500 / FT * FT) g.fillText(`R ${Math.max(0, Math.round(f.agl / FT))}`, W * 0.95, H * 0.84);
  if (ac.gearPos > 0.5) { g.textAlign = 'center'; g.fillText('GEAR', W / 2, H * 0.9); }
  if (ac.ab > 0.1) { g.textAlign = 'right'; g.fillText('AB', W * 0.95, H * 0.9); }
  g.shadowBlur = 0;
}

// MFD: hareketli harita (main.js'in küçük harita çizimi) + üst ve alt yazılar
function drawMFDmap(g, S, ac, drawMap) {
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  if (drawMap) { g.save(); drawMap(g, S, S); g.restore(); g.fillStyle = 'rgba(0,10,0,0.25)'; g.fillRect(0, 0, S, S); }
  g.fillStyle = '#7dff8a'; g.font = 'bold 14px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
  g.fillText('HSD', S * 0.18, 4); g.fillText('DCPL', S * 0.5, 4); g.fillText('20', S * 0.82, 4);
  g.textBaseline = 'bottom'; g.fillText('SWAP', S * 0.18, S - 3); g.fillText('FCR', S * 0.5, S - 3); g.fillText('SMS', S * 0.82, S - 3);
  g.strokeStyle = 'rgba(125,255,138,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2); g.stroke();
}
// MFD: ufuk, hız, irtifa ve motor (ard yakıcı, devir, g)
function drawMFDadi(g, S, ac) {
  const f = fd(ac);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  gAI(g, S * 0.5, S * 0.42, S * 0.3, f.theta, f.phi);
  g.fillStyle = '#7dff8a'; g.font = 'bold 15px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle';
  g.textAlign = 'left'; g.fillText(`${Math.round(f.ias)} KT`, 6, S * 0.82); g.fillText(`RPM ${Math.round(ac.spool * 100)}%`, 6, S * 0.92);
  g.textAlign = 'right'; g.fillText(`${Math.round(f.alt / FT)} FT`, S - 6, S * 0.82); g.fillText(ac.ab > 0.1 ? 'AB ON' : `THR ${Math.round(ac.ctl.throttle * 100)}`, S - 6, S * 0.92);
  g.textAlign = 'center'; g.textBaseline = 'top'; g.font = 'bold 13px ui-monospace, Menlo, monospace'; g.fillText('ADI', S * 0.5, 4); g.fillText(`G ${f.nz.toFixed(1)}`, S * 0.82, 4); g.fillText(ac.gearPos > 0.98 ? 'GEAR DN' : ac.gearPos < 0.02 ? 'GEAR UP' : 'GEAR ...', S * 0.2, 4);
}

// ======================================================================
// Cessna 172 sınıfı: göz sol koltukta (-0.3, 0.55, -0.35). Pano z≈-0.95; ön cam, kapı pencereleri, dikmeler,
// tavan (kanat), iki dümen simidi, gaz düğmesi, altılı analog göstergeler, devir göstergesi, pusula.
// Dış gövde kokpitte gizlenir; motor kaputunun üstü burada ayrıca kurulur (ön camdan görünür).
// ======================================================================
function buildC172(C) {
  const { root, M } = C;
  const E = new THREE.Vector3(-0.3, 0.65, -0.35); C.look = -9 * D2R; // pilot panoya biraz aşağı bakar
  const body = new THREE.MeshStandardMaterial({ color: 0xf3f3f1, roughness: 0.45, envMap: C.opt.envMap, envMapIntensity: 0.6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xb7afa3, roughness: 0.95, envMap: C.opt.envMap, envMapIntensity: 0.15 });
  const head = new THREE.MeshStandardMaterial({ color: 0xd6d0c4, roughness: 1, envMap: C.opt.envMap, envMapIntensity: 0.15, side: THREE.DoubleSide });
  // --- motor kaputu (ön camdan görünen üst yüzey) ---
  { const g = new THREE.CylinderGeometry(0.5, 0.42, 1.25, 20, 1, false, -Math.PI / 2 * 0.95, Math.PI * 0.95); g.rotateX(-Math.PI / 2); g.scale(1, 0.5, 1);
    mesh(root, g, body, 0, 0.36, -1.72); mesh(root, box(0.05, 0.04, 0.5), M.black, 0.2, 0.58, -1.5); }
  // --- tavan (kanat altı) ve iç döşeme ---
  mesh(root, box(1.16, 0.03, 1.4), head, 0, 0.9, -0.05);
  mesh(root, box(1.16, 0.02, 1.4), trim, 0, -0.12, -0.05);       // taban
  // --- kapılar ve pencereler: alt döşeme, pencere çerçevesi, dikmeler ---
  for (const s of [-1, 1]) {
    mesh(root, box(0.03, 0.42, 1.25), trim, s * 0.585, 0.1, -0.15);       // kapı alt döşemesi
    mesh(root, box(0.06, 0.05, 1.2), trim, s * 0.57, 0.33, -0.15);         // pencere eşiği / kol dayama
    tubeBetween(root, new THREE.Vector3(s * 0.56, 0.56, -1.02), new THREE.Vector3(s * 0.57, 0.9, -0.62), 0.028, trim); // A dikmesi
    mesh(root, box(0.04, 0.6, 0.06), trim, s * 0.575, 0.6, 0.48);          // B dikmesi
    mesh(root, box(0.04, 0.05, 1.15), trim, s * 0.575, 0.88, -0.1);       // üst çerçeve
    tubeBetween(root, new THREE.Vector3(s * 0.57, 0.3, -0.75), new THREE.Vector3(s * 0.56, 0.56, -1.02), 0.03, trim);
    // kapı kolu ve cep
    mesh(root, box(0.02, 0.025, 0.12), M.metal, s * 0.56, 0.22, -0.3);
    // yan cam (hafif)
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.55), M.canopy); sg.position.set(s * 0.585, 0.6, -0.15); sg.rotation.y = Math.PI / 2; sg.renderOrder = 2; root.add(sg);
  }
  // ön cam: panodan tavana eğik, ortada ince dikme
  quad(root, M.canopy, [-0.56, 0.56, -1.02], [0.56, 0.56, -1.02], [0.57, 0.9, -0.62], [-0.57, 0.9, -0.62]).renderOrder = 2;
  tubeBetween(root, new THREE.Vector3(0, 0.56, -1.02), new THREE.Vector3(0, 0.9, -0.62), 0.01, trim);
  // pusula (ön camın ortasında, üstte)
  mesh(root, rbox(0.06, 0.05, 0.05, 0.01), M.black, 0, 0.84, -0.69);
  const comp = dynScreen(64, 32); screen(root, comp.m, 0, 0.84, -0.716, 0.045, 0.022, 0, Math.PI * 0);
  C.screens.push({ rate: 'mid', tex: comp.t, draw: (ac) => { const f = fd(ac), g = comp.g; g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, 64, 32); const h = ((f.psi * R2D) % 360 + 360) % 360; g.fillStyle = '#111'; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let a = Math.floor((h - 30) / 10) * 10; a <= h + 30; a += 10) { const x = 32 + (a - h) * 0.9; g.fillRect(x - 0.5, 0, 1, a % 30 ? 5 : 8); if (a % 30 === 0) { const n = ((a % 360) + 360) % 360; g.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n] || String(n / 10), x, 20); } }
    g.fillStyle = '#c22'; g.fillRect(31, 0, 2, 32); } });
  // --- parlama önleyici ve pano ---
  mesh(root, rbox(1.1, 0.16, 0.04, 0.02), M.glare, 0, 0.545, -0.99, -Math.PI / 2 + 0.2, 0, 0);
  const pTilt = 8 * D2R, PW = 1.06, PH = 0.4, PY = 0.33, PZ = -0.93;
  const panelTex = (() => { const c = canvas(1024, 406), g = c.getContext('2d');
    g.fillStyle = '#25272a'; g.fillRect(0, 0, 1024, 406);
    // radyo yığını (sağ)
    for (let i = 0; i < 4; i++) { const y = 40 + i * 72; g.fillStyle = '#0d0e0f'; g.fillRect(560, y, 230, 60); g.fillStyle = '#ff9a3a'; g.font = 'bold 22px ui-monospace, monospace'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(['121.90  118.10', '124.35  119.70', 'NAV 110.30', 'XPDR 7000'][i], 572, y + 30); for (let k = 0; k < 2; k++) { g.fillStyle = '#3a3d40'; g.beginPath(); g.arc(800 + k * 0 - 6, y + 30, 0, 0, 7); g.fill(); } }
    // anahtarlar (alt sol), sigortalar (alt sağ)
    for (let i = 0; i < 8; i++) { const x = 40 + i * 48; g.fillStyle = '#111'; g.fillRect(x, 352, 30, 40); g.fillStyle = i < 2 ? '#b3261e' : '#ddd'; g.fillRect(x + 6, 356, 18, 16); }
    for (let i = 0; i < 10; i++) { g.fillStyle = '#0c0c0c'; g.beginPath(); g.arc(600 + i * 38, 370, 11, 0, 7); g.fill(); g.fillStyle = '#777'; g.beginPath(); g.arc(600 + i * 38, 370, 5, 0, 7); g.fill(); }
    g.fillStyle = '#e6e6e6'; g.font = 'bold 14px system-ui'; g.textAlign = 'left'; g.fillText('MASTER  BCN  LAND  TAXI  NAV  STROBE  PITOT', 40, 340);
    g.fillStyle = '#c8c2b5'; g.fillRect(0, 0, 1024, 10);
    return tex(c); })();
  const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.75, envMap: C.opt.envMap, envMapIntensity: 0.2 });
  mesh(root, new THREE.PlaneGeometry(PW, PH), panelMat, 0, PY, PZ, -pTilt, 0, 0);
  mesh(root, box(PW + 0.04, PH + 0.02, 0.06), M.dark, 0, PY, PZ - 0.035, -pTilt, 0, 0);
  const pp = (u, v, off = 0.004) => new THREE.Vector3(u * PW, PY + v * PH * Math.cos(pTilt), PZ - v * PH * Math.sin(pTilt) + off * Math.cos(pTilt));
  // altılı göstergeler: sol yarı, pilotun önünde (merkez x = -0.3)
  const SW = 768, SH = 512, six = dynScreen(SW, SH); const gw = 0.40, gh = gw * SH / SW;
  { const p = pp(-0.3 / PW, 0.05, 0.004); screen(root, six.m, p.x, p.y, p.z, gw, gh, pTilt); }
  C.screens.push({ rate: 'mid', tex: six.t, draw: (ac) => { const f = fd(ac), g = six.g, r = 112; g.fillStyle = '#25272a'; g.fillRect(0, 0, SW, SH);
    const turn = ac.w ? (ac.w[2] * Math.cos(f.phi) + ac.w[1] * Math.sin(f.phi)) * R2D : 0;
    gASI(g, 128, 128, r, f.ias, 200, [[33, 85, '#e8e8e8'], [40, 129, '#3c3'], [129, 163, '#ffcf33']]);
    gAI(g, 384, 128, r, f.theta, f.phi);
    gALT(g, 640, 128, r, f.alt / FT);
    gTC(g, 128, 384, r, turn, -(ac.ny || 0) * 3);
    gHI(g, 384, 384, r, f.psi);
    gVSI(g, 640, 384, r, f.vs / FT * 60); } });
  // devir ve motor göstergeleri: altılının sağında
  const eng = dynScreen(256, 384); { const p = pp(0.05 / PW, 0.08, 0.004); screen(root, eng.m, p.x, p.y, p.z, 0.12, 0.18, pTilt); }
  C.screens.push({ rate: 'mid', tex: eng.t, draw: (ac) => { const g = eng.g; g.fillStyle = '#25272a'; g.fillRect(0, 0, 256, 384); gRPM(g, 128, 120, 104, ac.rpm || 0, 3500, 'RPM x100', 2700, 100);
    // yakıt ve yağ: küçük çubuklar
    g.fillStyle = '#111'; g.fillRect(28, 262, 200, 96); g.fillStyle = '#ddd'; g.font = 'bold 18px system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('FUEL', 38, 282); g.fillText('OIL', 38, 330);
    g.fillStyle = '#3c3'; g.fillRect(100, 274, 110, 16); g.fillRect(100, 322, 80, 16); } });
  // --- dümen simitleri (iki) ve kolonları ---
  const yokes = [];
  for (const x of [-0.3, 0.3]) {
    const col = new THREE.Group(); col.position.set(x, 0.3, -0.9); root.add(col);
    mesh(col, new THREE.CylinderGeometry(0.018, 0.018, 0.34, 10), M.metal, 0, 0, 0.12, Math.PI / 2, 0, 0);
    const yk = new THREE.Group(); yk.position.set(0, 0, 0.27); col.add(yk);
    mesh(yk, rbox(0.07, 0.08, 0.04, 0.015), M.black, 0, 0, 0);
    for (const s of [-1, 1]) { const h = mesh(yk, rbox(0.04, 0.13, 0.035, 0.016), M.black, s * 0.13, 0.03, 0, 0, 0, s * 0.2); tubeBetween(yk, new THREE.Vector3(s * 0.03, 0, 0), new THREE.Vector3(s * 0.12, -0.02, 0), 0.016, M.black); }
    mesh(yk, box(0.03, 0.012, 0.004), M.white, 0, 0.01, -0.022); // amblem
    yokes.push({ col, yk });
  }
  C.anim.push((ac) => { const tp = clamp(ac.ctl.pitch, -1, 1), tr = clamp(ac.ctl.roll, -1, 1); for (const y of yokes) { y.col.position.z += ((-0.9 + tp * 0.075) - y.col.position.z) * 0.35; y.yk.rotation.z += (-tr * 50 * D2R - y.yk.rotation.z) * 0.35; } });
  // gaz düğmesi (siyah, it-çek) ve karışım (kırmızı)
  const thr = new THREE.Group(); root.add(thr);
  mesh(thr, new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), M.metal, 0, 0, 0.06, Math.PI / 2, 0, 0); mesh(thr, new THREE.CylinderGeometry(0.02, 0.02, 0.025, 14), M.black, 0, 0, 0.12, Math.PI / 2, 0, 0);
  const mix = new THREE.Group(); mix.position.set(0.08, 0.17, -0.9); root.add(mix);
  mesh(mix, new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), M.metal, 0, 0, 0.025, Math.PI / 2, 0, 0); mesh(mix, new THREE.CylinderGeometry(0.017, 0.017, 0.02, 14), M.red, 0, 0, 0.05, Math.PI / 2, 0, 0);
  C.anim.push((ac) => { thr.position.set(0, 0.17, -0.92 + (1 - clamp(ac.ctl.throttle, 0, 1)) * 0.07); });
  // koltuklar ve pedallar
  for (const x of [-0.3, 0.3]) {
    mesh(root, rbox(0.44, 0.1, 0.46, 0.04), M.seat, x, 0.06, -0.15);
    mesh(root, rbox(0.44, 0.62, 0.1, 0.04), M.seat, x, 0.42, 0.14, 0.18, 0, 0);
    for (const s of [-1, 1]) mesh(root, box(0.07, 0.1, 0.02), M.metal, x + s * 0.1, -0.05, -0.85, -0.5, 0, 0);
  }
  mesh(root, rbox(1.06, 0.5, 0.12, 0.04), M.seat, 0, 0.32, 0.75, 0.15, 0, 0); // arka koltuk
  // pilotun bacakları (sol koltuk)
  for (const s of [-1, 1]) { const hip = new THREE.Vector3(-0.3 + s * 0.1, 0.18, -0.1), knee = new THREE.Vector3(-0.3 + s * 0.11, 0.3, -0.55), ank = new THREE.Vector3(-0.3 + s * 0.1, -0.02, -0.8);
    capsule(root, hip, knee, 0.07, new THREE.MeshStandardMaterial({ color: 0x34465e, roughness: 1 })); capsule(root, knee, ank, 0.055, new THREE.MeshStandardMaterial({ color: 0x34465e, roughness: 1 })); }
  return E;
}

// ======================================================================
// L-39 sınıfı: ön kokpit, göz (0, 0.98, -3.0). Analog pano, ön cam çerçevesi, kanopi kemeri, ortada levye, solda gaz.
// Arkada eğitmen kokpitinin koltuğu ve pano sırtı görünür.
// ======================================================================
function buildL39(C) {
  const { root, M } = C;
  const E = new THREE.Vector3(0, 0.98, -3.0); C.look = -6 * D2R;
  const CC = new THREE.Vector3(0, 0.62, -2.4), CR = new THREE.Vector3(0.55, 0.65, 2.3);
  for (const s of [-1, 1]) {
    mesh(root, box(0.03, 0.62, 1.5), M.grey, s * 0.42, 0.42, -3.0);
    mesh(root, box(0.08, 0.05, 2.6), M.frame, s * 0.45, 0.74, -2.5);
    mesh(root, rbox(0.12, 0.1, 0.8, 0.012), M.dark, s * 0.34, 0.6, -2.95);
  }
  const wallTex = detailTex(512, 256, 11, '#2c3236');
  for (const s of [-1, 1]) mesh(root, new THREE.PlaneGeometry(0.11, 0.78), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }), s * 0.34, 0.656, -2.95, -Math.PI / 2, 0, 0).castShadow = false;
  mesh(root, box(0.84, 0.02, 1.5), M.dark, 0, 0.12, -3.0);
  // pano
  const pTilt = 10 * D2R, PW = 0.72, PH = 0.34, PY = 0.68, PZ = -3.62;
  const pnl = dynScreen(1024, 484);
  mesh(root, new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: pnl.t, roughness: 0.75, emissive: 0xffffff, emissiveMap: pnl.t, emissiveIntensity: 0.12 }), 0, PY, PZ, -pTilt, 0, 0);
  mesh(root, box(PW + 0.03, PH + 0.02, 0.05), M.dark, 0, PY, PZ - 0.03, -pTilt, 0, 0);
  C.screens.push({ rate: 'mid', tex: pnl.t, draw: (ac) => { const f = fd(ac), g = pnl.g, r = 92; g.fillStyle = '#2f3a3a'; g.fillRect(0, 0, 1024, 484);
    gASI(g, 150, 140, r, f.ias, 500, [[100, 250, '#3c3'], [250, 490, '#ffcf33']]);
    gAI(g, 512, 150, r * 1.25, f.theta, f.phi);
    gALT(g, 874, 140, r, f.alt / FT);
    gVSI(g, 150, 360, r * 0.9, f.vs / FT * 60);
    gHI(g, 512, 372, r * 0.95, f.psi);
    gRPM(g, 760, 360, r * 0.8, (ac.spool || 0) * 100, 110, 'RPM %', 101, 2, 1);
    gG(g, 940, 360, r * 0.62, f.nz, ac._gmaxL = Math.max(ac._gmaxL || 1, f.nz));
    g.fillStyle = ac.gearPos > 0.98 ? '#3c3' : ac.gearPos < 0.02 ? '#333' : '#e33'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(330 + i * 26 - (i === 1 ? 0 : 0), i === 1 ? 300 : 320, 9, 0, 7); g.fill(); }
    g.fillStyle = '#ddd'; g.font = 'bold 15px system-ui'; g.textAlign = 'center'; g.fillText('GEAR', 356, 345); } });
  mesh(root, rbox(0.78, 0.34, 0.05, 0.03), M.glare, 0, 0.865, -3.78, -Math.PI / 2 + 0.12, 0, 0);
  // nişangâh (cam üstünde)
  mesh(root, rbox(0.1, 0.07, 0.12, 0.01), M.black, 0, 0.9, -3.72);
  quad(root, new THREE.MeshStandardMaterial({ color: 0x8fb0a0, transparent: true, opacity: 0.12, metalness: 0.8, roughness: 0.05, envMap: C.opt.envMap, depthWrite: false, side: THREE.DoubleSide }), [-0.05, 0.935, -3.7], [0.05, 0.935, -3.7], [0.05, 1.02, -3.66], [-0.05, 1.02, -3.66]).renderOrder = 3;
  // ön cam çerçevesi (iki yan dikme ve üst kemer) + kanopi camı + kemer (iki kokpit arası)
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.canopy); can.scale.copy(CR); can.position.copy(CC); can.renderOrder = 2; root.add(can);
  for (const z of [-3.85, -2.3, -0.8]) tubeCurve(root, ellArc(CC, new THREE.Vector3(CR.x - 0.012, CR.y - 0.012, CR.z), z, 20), z === -3.85 ? 0.02 : 0.018, M.frame);
  for (const s of [-1, 1]) tubeBetween(root, new THREE.Vector3(s * 0.33, 0.76, -4.3), new THREE.Vector3(s * 0.24, 1.08, -3.87), 0.016, M.frame);
  tubeBetween(root, new THREE.Vector3(-0.33, 0.76, -4.3), new THREE.Vector3(0.33, 0.76, -4.3), 0.016, M.frame);
  // arka (eğitmen) kokpiti: koltuk sırtı, baş yastığı ve pano sırtı
  mesh(root, rbox(0.66, 0.42, 0.3, 0.04), M.dark, 0, 0.92, -2.05);
  mesh(root, rbox(0.42, 0.7, 0.12, 0.03), M.seat, 0, 0.7, -2.55, 0.32, 0, 0);
  mesh(root, rbox(0.28, 0.2, 0.12, 0.03), M.seat, 0, 1.12, -2.45, 0.25, 0, 0);
  mesh(root, rbox(0.44, 0.1, 0.44, 0.03), M.seat, 0, 0.35, -2.85);
  for (const s of [-1, 1]) {
    const hip = new THREE.Vector3(s * 0.11, 0.43, -2.8), knee = new THREE.Vector3(s * 0.13, 0.6, -3.3), ank = new THREE.Vector3(s * 0.15, 0.22, -3.62);
    capsule(root, hip, knee, 0.075, M.suit); capsule(root, knee, ank, 0.058, M.suit); mesh(root, rbox(0.1, 0.1, 0.24, 0.03), M.boot, s * 0.15, 0.17, -3.7);
  }
  // orta levye
  const stk = new THREE.Group(); stk.position.set(0, 0.14, -3.25); root.add(stk);
  mesh(stk, new THREE.CylinderGeometry(0.014, 0.018, 0.48, 10), M.black, 0, 0.24, 0);
  mesh(stk, rbox(0.045, 0.11, 0.05, 0.018), M.dark, 0, 0.52, -0.01, -0.15, 0, 0);
  mesh(stk, box(0.012, 0.02, 0.012), M.red, 0, 0.56, -0.04);
  C.anim.push((ac) => { const tp = clamp(ac.ctl.pitch, -1, 1), tr = clamp(ac.ctl.roll, -1, 1); stk.rotation.x += (tp * 14 * D2R - stk.rotation.x) * 0.35; stk.rotation.z += (-tr * 12 * D2R - stk.rotation.z) * 0.35; });
  // gaz kolu (sol)
  const thrP = new THREE.Group(); thrP.position.set(-0.33, 0.6, -2.95); root.add(thrP);
  mesh(thrP, box(0.02, 0.12, 0.02), M.metal, 0, 0.06, 0); mesh(thrP, rbox(0.05, 0.06, 0.08, 0.02), M.black, 0, 0.13, 0);
  C.anim.push((ac) => { const a = 0.45 - clamp(ac.ctl.throttle, 0, 1) * 0.9; thrP.rotation.x += (a - thrP.rotation.x) * 0.3; });
  return E;
}
