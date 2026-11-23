// Türkiye simge yapıları (İstanbul dışı): gerçek ölçülerde, hacimli 3B, uzaklığa göre iki ayrıntı düzeyi.
// Ankara (Anıtkabir, Atakule, Kocatepe Camii, Ankara Kalesi), İzmir (Saat Kulesi, Konak Camii, Kadifekale), Bursa Ulu Cami,
// Konya Mevlana Türbesi, Kapadokya Devrent peri bacaları, Efes (Celsus Kütüphanesi, Büyük Tiyatro), Pamukkale travertenleri,
// Nemrut Dağı, Sümela Manastırı, Antalya (Yivli Minare, Kaleiçi surları, Hadrian Kapısı, Hıdırlık Kulesi, Saat Kulesi),
// 1915 Çanakkale Köprüsü ve Osmangazi Köprüsü.
// Konum ve taban ölçüleri OpenStreetMap'ten, yükseklikler Vikipedi'den. Her yapı bir THREE.LOD: yakında ayrıntılı (köşe renkli
// birleşik örgü, 1-2 çizim çağrısı), uzakta sade siluet, daha uzakta hiç. Yapılar kamera yaklaşınca ve arazi verisi gelince kurulur.
// Bağlantı: world.js kurucusunda tek satır (kur(this)). Eski basit Ankara/İzmir yapılarının yerini alır.
import * as THREE from '../vendor/three.module.min.js';
import { geo, convergence } from './geo.js';
import { merge } from './buildings.js';

const D2R = Math.PI / 180;
const _c = new THREE.Color();
const rgb = (hex) => { _c.setHex(hex); return [_c.r, _c.g, _c.b]; };
const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
// yumuşak değer gürültüsü (konuma bağlı, kararlı)
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const h = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
}
// renk + konuma bağlı ton oynaması (taş, kaya)
const tone = (hex, amp = 0.08, f = 0.3) => { const c = rgb(hex); return (x, y, z) => { const k = 1 + amp * (vnoise(x * f, y * f, z * f) * 2 - 1); return [c[0] * k, c[1] * k, c[2] * k]; }; };

// ---------- geometri takımı: köşe renkli parçaları toplar, sonunda tek örgüde birleştirir ----------
class Kit {
  constructor(parts, T) { this.parts = parts || []; this.T = T || new THREE.Matrix4(); }
  at(x = 0, y = 0, z = 0, ry = 0, s = 1) {
    const m = new THREE.Matrix4().makeRotationY(ry); if (s !== 1) m.scale(new THREE.Vector3(s, s, s)); m.setPosition(x, y, z);
    return new Kit(this.parts, this.T.clone().multiply(m));
  }
  add(g, col) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, n = P.count, a = new Float32Array(n * 3);
    if (typeof col === 'function') for (let i = 0; i < n; i++) { const c = col(P.getX(i), P.getY(i), P.getZ(i), i, g); a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
    else { const c = Array.isArray(col) ? col : rgb(col); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.applyMatrix4(this.T); this.parts.push(g); return g;
  }
  box(w, h, d, x, y, z, col, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); if (ry) g.rotateY(ry); g.translate(x, y, z); return this.add(g, col); }
  cyl(r0, r1, h, x, y, z, col, seg = 12, ry = 0) { const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, false); g.translate(0, h / 2, 0); if (ry) g.rotateY(ry); g.translate(x, y, z); return this.add(g, col); }
  cone(r, h, x, y, z, col, seg = 12, ry = 0) { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); if (ry) g.rotateY(ry); g.translate(x, y, z); return this.add(g, col); }
  dome(r, x, y, z, col, sy = 1, seg = 16) { const g = new THREE.SphereGeometry(r, seg, Math.max(3, seg >> 2), 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, sy, 1); g.translate(x, y, z); return this.add(g, col); }
  half(r, x, y, z, rot, col, seg = 12) { const g = new THREE.SphereGeometry(r, seg, Math.max(3, seg >> 2), 0, Math.PI, 0, Math.PI / 2); g.rotateY(rot); g.translate(x, y, z); return this.add(g, col); }
  lathe(pts, seg, x, y, z, col) { const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg); g.translate(x, y, z); return this.add(g, col); }
  // duvar parçası (x0,z0)-(x1,z1), kalınlık t, yükseklik h, taban y
  wall(x0, z0, x1, z1, t, h, y, col) { const L = Math.hypot(x1 - x0, z1 - z0); return this.box(L + t * 0.5, h, t, (x0 + x1) / 2, y, (z0 + z1) / 2, col, Math.atan2(-(z1 - z0), x1 - x0)); }
  // çokgen tabanı yukarı doğru uzat: pts [[x,z]]
  prism(pts, y, h, col) {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return this.add(g, col);
  }
  tube(pts, r, col, rseg = 5) { const c = new THREE.CatmullRomCurve3(pts); const g = new THREE.TubeGeometry(c, Math.max(8, pts.length * 2), r, rseg, false); return this.add(g, col); }
  mesh(mat) { if (!this.parts.length) return null; const m = new THREE.Mesh(merge(this.parts), mat); this.parts.length = 0; return m; }
}

// ---------- ortak parçalar ----------
// Osmanlı minaresi: kaide, 12 köşeli gövde, şerefeler, kurşun külah, alem
function minaret(k, x, z, H, r, col, lead, nS = 1, base = 0, seg = 12) {
  k.box(r * 2.7, H * 0.07, r * 2.7, x, base, z, col);
  k.cyl(r * 1.25, r, H * 0.05, x, base + H * 0.07, z, col, seg);
  const sy = nS === 1 ? [0.7] : nS === 2 ? [0.58, 0.72] : [0.47, 0.6, 0.73];
  let y = base + H * 0.12, rr = r;
  for (const f of sy) {
    const ys = base + H * f;
    k.cyl(rr, rr * 0.96, ys - y, x, y, z, col, seg); rr *= 0.96;
    k.cyl(rr, rr * 1.5, 1.4, x, ys, z, col, seg);           // mukarnas çıkması
    k.cyl(rr * 1.55, rr * 1.55, 1.2, x, ys + 1.4, z, col, seg); // korkuluk
    y = ys + 1.4;
  }
  const yt = base + H * 0.8;
  k.cyl(rr * 0.9, rr * 0.85, yt - y, x, y, z, col, seg);
  k.cone(rr * 1.05, H * 0.17, x, yt, z, lead, seg);
  k.cyl(0.12, 0.08, H * 0.03, x, yt + H * 0.17, z, 0xc8a24a, 4);
}
// pencere sırası (koyu girintiler): x boyunca n pencere, bir yüzün önünde
function windows(k, n, w, h, span, x, y, z, ry, col = 0x2c3238, d = 0.25) {
  const kk = k.at(x, y, z, ry);
  for (let i = 0; i < n; i++) kk.box(w, h, d, -span / 2 + (i + 0.5) * span / n, 0, 0, col);
}
// dört yüze pencere: kutu (W x D) çevresi, yükseklik y
function windowsAround(k, W, D, y, h, step, x = 0, z = 0, col = 0x2c3238) {
  const nW = Math.max(1, Math.floor(W / step)), nD = Math.max(1, Math.floor(D / step)), w = step * 0.42;
  windows(k, nW, w, h, W - step * 0.4, x, y, z + D / 2, 0, col); windows(k, nW, w, h, W - step * 0.4, x, y, z - D / 2, 0, col);
  windows(k, nD, w, h, D - step * 0.4, x + W / 2, y, z, Math.PI / 2, col); windows(k, nD, w, h, D - step * 0.4, x - W / 2, y, z, Math.PI / 2, col);
}
// kaya kütlesi: segmentli kutu, konuma bağlı gürültüyle bozulmuş, eğime göre renk (üstte bitki)
function rock(k, w, h, d, x, y, z, amp, top = 0x4a5e34, side = 0x7a7368, seed = 0, f = 0.05, sz = 12) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(2, Math.round(w / sz)), Math.max(2, Math.round(h / sz)), Math.max(2, Math.round(d / sz)));
  g.translate(x, y + h / 2, z);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const px = P.getX(i), py = P.getY(i), pz = P.getZ(i);
    const n1 = vnoise(px * f + seed, py * f, pz * f) - 0.5, n2 = vnoise(px * f * 3, py * f * 3 + seed, pz * f * 3) - 0.5, n3 = vnoise(px * f + 7, py * f + seed, pz * f + 3) - 0.5;
    P.setXYZ(i, px + (n1 + n2 * 0.35) * amp, py + (n3 + n2 * 0.3) * amp * 0.6, pz + (n3 + n2 * 0.35) * amp);
  }
  g.computeVertexNormals();
  const ct = rgb(top), cs = rgb(side);
  return k.add(g, (px, py, pz, i, gg) => {
    const ny = gg.attributes.normal.getY(i), t = Math.max(0, Math.min(1, (ny - 0.45) * 3)), v = 0.85 + 0.3 * vnoise(px * 0.2, py * 0.2, pz * 0.2);
    return [(cs[0] + (ct[0] - cs[0]) * t) * v, (cs[1] + (ct[1] - cs[1]) * t) * v, (cs[2] + (ct[2] - cs[2]) * t) * v];
  });
}
// düzensiz döner kaya (peri bacası gövdesi): profil [[r,y]], yarıçap gürültüsü
function rockLathe(k, prof, seg, amp, seed, x, y, z, colFn) {
  const g = new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), seg);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const px = P.getX(i), py = P.getY(i), pz = P.getZ(i), r = Math.hypot(px, pz);
    if (r < 0.05) continue;
    const a = Math.atan2(pz, px), m = 1 + amp * (vnoise(Math.cos(a) * 1.7 + seed, py * 0.15, Math.sin(a) * 1.7) - 0.5) * 2;
    P.setXYZ(i, px * m, py, pz * m);
  }
  g.computeVertexNormals(); g.translate(x, y, z);
  return k.add(g, colFn);
}

// ---------- yapılar ----------
// her yapı: kimlik, ad, konum, açı (doğudan saat yönünün tersine, gerçek; yerel +x bu yöne bakar), ayrıntı uzaklıkları, kurucu
// kurucu ctx: hi/lo (taş örgü), hiG/loG (cam ve su örgüsü), hl(lx,lz) yerel arazi yüksekliği, coll(lx,lz,r,üst), loc(enlem,boylam)
const TRAV = 0xdccdab, TRAVD = 0xb9a682, LEAD = 0x7b8794, MARB = 0xece6d8, ANDE = 0x8d857a;

function anitkabir(c) {
  const { hi, lo } = c;
  const trav = tone(TRAV, 0.05), travD = tone(TRAVD, 0.06);
  const f = Math.min(-4, c.minH(160) - 3); // temel: arazinin en altına kadar
  // tören meydanı (129 x 84 m), çevresinde revaklar; halı desenli taş döşeme
  for (const K of [hi, lo]) { K.box(160, -f + 0.4, 120, 30, f, -2, travD); }
  const pav = [0xc9b48e, 0x9b6f5a, 0xd8c9a6, 0x7d5f50, 0xb79d78];
  for (let i = 0; i < 16; i++) for (let j = 0; j < 10; j++) hi.box(129 / 16 - 0.25, 0.12, 84 / 10 - 0.25, 30 - 64.5 + (i + 0.5) * 129 / 16, 0.4, -2 - 42 + (j + 0.5) * 8.4, pav[(i * 3 + j * 7 + ((i ^ j) & 3)) % pav.length]);
  // revaklar: meydanın üç yanı (kuzeydoğu uzun kenar ve iki kısa kenar), dikdörtgen ayaklı sundurma
  const portico = (K, x0, z0, x1, z1, det) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0), kk = K.at((x0 + x1) / 2, 0.4, (z0 + z1) / 2, ry);
    kk.box(L, 1, 9, 0, 0, 0, travD); kk.box(L, 1.6, 9.6, 0, 7.4, 0, trav); kk.box(L, 7.4, 1.2, 0, 0, -4, trav);
    if (det) for (let x = -L / 2 + 2; x <= L / 2 - 2; x += 4.2) kk.box(1.2, 6.4, 1.2, x, 1, 3.6, trav);
    else kk.box(L, 6.4, 1, 0, 1, 3.6, trav);
  };
  for (const [K, det] of [[hi, true], [lo, false]]) {
    portico(K, -34, -48, 94, -48, det); portico(K, -40, -40, -40, 38, det); portico(K, 100, -40, 100, 38, det);
  }
  // köşe kuleleri (İstiklal, Hürriyet, Mehmetçik, Zafer, Barış, 23 Nisan, Misak-ı Millî, İnkılâp, Cumhuriyet, Müdafaa-i Hukuk)
  const tower = (K, x, z, det) => {
    const y = x > -45 ? 0.4 : c.hl(x, z) + 0.4, yb = Math.min(y, c.hl(x, z) - 2);
    K.box(12, 13 + y - yb, 12, x, yb, z, trav); K.box(13, 1.4, 13, x, y + 13, z, travD);
    K.cone(9.2, 4.2, x, y + 14.4, z, travD, 4, Math.PI / 4);
    if (det) for (const s of [-1, 1]) { windows(K, 3, 1.2, 4.5, 8, x, y + 5, z + s * 6, 0, 0x3b3530); windows(K, 3, 1.2, 4.5, 8, x + s * 6, y + 5, z, Math.PI / 2, 0x3b3530); }
  };
  for (const [K, det] of [[hi, true], [lo, false]]) for (const [x, z] of [[-40, -48], [100, -48], [-40, 40], [100, 40], [-310, -14], [-310, 14], [-150, -14], [-150, 14], [-30, 74], [90, 74]]) tower(K, x, z, det);
  // Aslanlı Yol: 262 m, iki yanda 12'şer yatan aslan; arazinin üstünde parça parça
  for (let x = -310; x < -40; x += 18) { const y = c.hl(x + 9, 0); for (const K of [hi, lo]) K.box(18.4, 2.4, 20, x + 9, y - 2, 0, travD); }
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) {
    const x = -290 + i * 21, y = c.hl(x, 0) + 0.4;
    hi.box(2.2, 1.0, 1.2, x, y, s * 8.5, travD); hi.box(2.0, 1.1, 1.0, x, y + 1, s * 8.5, trav); hi.box(0.8, 0.9, 0.9, x + 0.9, y + 1.9, s * 8.5, trav);
  }
  // Şeref Holü (anıt mezar): 72 x 52 m kaide üstünde, 14.4 m'lik dikdörtgen ayaklar (uzun kenarda 14, kısada 8)
  const M = hi.at(30, 0.4, 72), Ml = lo.at(30, 0.4, 72);
  for (const K of [M, Ml]) {
    K.box(88, -f, 64, 0, f - 0.4, 2, travD);
    K.box(86, 7, 62, 0, 0, 2, trav);
    for (let s = 0; s < 14; s++) K.box(44, 0.5, 1.1, 0, s * 0.5, -29.5 - 14 * 1.1 + s * 1.1, travD); // 42 basamaklı merdiven
    K.box(52, 15, 30, 0, 7, 2, trav);                      // iç hol
    K.box(74, 3.6, 54, 0, 21.4, 2, travD);                 // saçak
    K.box(56, 5, 34, 0, 25, 2, trav);                      // yükseltilmiş çatı katı
    K.box(57, 0.9, 35, 0, 30, 2, travD);
  }
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) M.box(1.7, 14.4, 1.7, -35 + i * (70 / 13), 7, 2 + s * 25, trav);
  for (let i = 1; i < 7; i++) for (const s of [-1, 1]) M.box(1.7, 14.4, 1.7, s * 35, 7, 2 - 25 + i * (50 / 7), trav);
  M.box(8, 9, 0.4, 0, 7, -13.1, 0x3a3128); // kapı
  c.coll(30, 72, 42, 31.5); c.coll(30, -2, 70, 15);
}

function atakule(c) {
  const { hi, lo, hiG, loG } = c;
  const conc = tone(0xe3e2dc, 0.03), glass = 0x5d7f99;
  // alışveriş merkezi (2021 yenilemesi): kademeli taş ve cam kütle
  for (const [K, G] of [[hi, hiG], [lo, loG]]) {
    K.box(120, 6, 90, 0, Math.min(-3, c.minH(70) - 2), 0, conc); K.box(118, 14, 88, 0, 3, 0, conc); G.box(100, 6, 70, 0, 17, 0, glass);
    K.box(102, 1, 72, 0, 23, 0, conc);
    // kule: beton gövde ve üç cam asansör kolonu
    K.cyl(5.2, 4.6, 92, 0, 3, 0, conc, 16);
    for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3; G.cyl(2.2, 2.2, 86, Math.cos(a) * 5.4, 6, Math.sin(a) * 5.4, glass, 8); }
    // baş: genişleyen boyun, iki katlı cam lokanta, kubbe, anten (toplam 125 m)
    K.cyl(4.8, 13, 8, 0, 89, 0, conc, 24);
    G.cyl(13.4, 13.4, 6, 0, 97, 0, glass, 32);
    K.cyl(13.8, 13.8, 1.4, 0, 103, 0, conc, 32);
    G.cyl(12.6, 12, 5, 0, 104.4, 0, glass, 32);
    K.dome(12, 0, 109.4, 0, conc, 0.42, 32);
    K.cyl(1.0, 0.25, 11, 0, 114, 0, conc, 8);
  }
  c.coll(0, 0, 14, 125); c.coll(0, 0, 60, 24);
}

function kocatepe(c) {
  const { hi, lo, hiG } = c;
  const st = tone(0xeee9df, 0.03), lead = tone(LEAD, 0.04), dark = 0x2f3640;
  const f = Math.min(-4, c.minH(60) - 3);
  for (const K of [hi, lo]) {
    K.box(66, -f + 0.5, 100, 0, f, 0, tone(0xcfcac0, 0.03));           // kaide (altında çarşı ve otopark)
    K.box(50, 21, 50, 0, 0.5, 20, st);                                  // harim
    K.cyl(13.6, 13.6, 6, 0, 29, 20, st, 24); K.dome(13.2, 0, 35, 20, lead, 1.03, 28); // ana kubbe 25.5 m, tepe 48.5 m
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) K.half(12.6, Math.sin(r) * 12.6, 27, 20 + Math.cos(r) * 12.6, r, lead, 16);
    for (const [x, z] of [[-17, 3], [17, 3], [-17, 37], [17, 37]]) { K.cyl(5.5, 5.5, 4, x, 21.5, z, st, 12); K.dome(5.5, x, 25.5, z, lead, 0.85, 12); }
    K.box(50, 9, 10, 0, 0.5, -10, st); // son cemaat yeri
    for (const [x, z] of [[-25.5, -5], [25.5, -5], [-25.5, 45], [25.5, 45]]) minaret(K, x, z, 88, 2.6, st, lead, 3, 0.5, 14);
  }
  // ayrıntı: ağırlık kuleleri, kubbe kasnağı pencereleri, revaklı avlu ve kubbecikleri, şadırvan
  for (const [x, z] of [[-13.5, 6.5], [13.5, 6.5], [-13.5, 33.5], [13.5, 33.5]]) { hi.cyl(2.2, 2.2, 6, x, 25, z, st, 8); hi.cone(2.4, 3.5, x, 31, z, lead, 8); }
  for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; hi.box(1.6, 3.4, 0.4, Math.sin(a) * 13.7, 30.2, 20 + Math.cos(a) * 13.7, dark, a); }
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) if (Math.abs(((a - r + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > Math.PI / 2 + 0.2) hi.box(1.2, 1.8, 0.3, Math.sin(r) * 12.6 + Math.sin(a) * 12.4, 27.3, 20 + Math.cos(r) * 12.6 + Math.cos(a) * 12.4, dark, a); }
  for (const y of [4, 13]) windowsAround(hi, 50, 50, y.valueOf() + 0.5, 5, 6.2, 0, 20, dark);
  const arc = (x0, z0, x1, z1, n) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; hi.box(5.4, 6.5, 6, x, 0.5, z, st); hi.dome(2.6, x, 7, z, lead, 0.8, 10); } };
  arc(-24, -48, 24, -48, 9); arc(-27, -45, -27, -16, 5); arc(27, -45, 27, -16, 5);
  hi.cyl(4, 4, 1.5, 0, 0.5, -31, st, 8); hiG.cyl(3.4, 3.4, 0.1, 0, 2.0, -31, 0x4f86a0, 8); hi.cyl(0.4, 0.4, 4, 0, 2, -31, st, 6); hi.dome(3.2, 0, 6, -31, lead, 0.6, 8);
  c.coll(0, 20, 30, 48.5); for (const [x, z] of [[-25.5, -5], [25.5, -5], [-25.5, 45], [25.5, 45]]) c.coll(x, z, 4, 88.5);
}

function ankaraKalesi(c) {
  const { hi, lo } = c;
  const st = tone(ANDE, 0.12, 0.15), stL = tone(0xa79c8e, 0.1);
  // iç kale: tepeyi saran ~ 340 x 160 m'lik sur, beşgen burçlar; dış kale: güneyde daha alçak ikinci sur
  const ring = (n, ax, bz, rot, wob) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, w = 1 + wob * (vnoise(i * 0.7, 3, 1) - 0.5); const x = Math.cos(a) * ax * w, z = Math.sin(a) * bz * w; pts.push([x * Math.cos(rot) - z * Math.sin(rot), x * Math.sin(rot) + z * Math.cos(rot)]); } return pts; };
  const walls = (pts, H, T, tw, oz, det) => {
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
      const xm = (x0 + x1) / 2 + oz[0], zm = (z0 + z1) / 2 + oz[1], b = Math.min(c.hl(x0 + oz[0], z0 + oz[1]), c.hl(x1 + oz[0], z1 + oz[1]), c.hl(xm, zm)) - 4;
      const h = H * (0.75 + 0.5 * vnoise(i * 0.9, 5, 2));
      const top = Math.max(c.hl(xm, zm), b + 4) + h;
      (det ? hi : lo).wall(x0 + oz[0], z0 + oz[1], x1 + oz[0], z1 + oz[1], T, top - b, b, i % 3 ? st : stL);
      if (det && i % 1 === 0) { // burç
        const tb = c.hl(x0 + oz[0], z0 + oz[1]) - 4, tt = tb + 4 + h + 4;
        hi.cyl(tw, tw, tt - tb, x0 + oz[0], tb, z0 + oz[1], st, 5, i);
        for (let m = 0; m < 5; m++) { const a = m / 5 * Math.PI * 2 + i; hi.box(1.4, 1.2, 1.4, x0 + oz[0] + Math.cos(a) * tw * 0.8, tt, z0 + oz[1] + Math.sin(a) * tw * 0.8, st); }
      } else if (!det && i % 2 === 0) { const tb = c.hl(x0 + oz[0], z0 + oz[1]) - 4; lo.cyl(tw, tw, 8 + h, x0 + oz[0], tb, z0 + oz[1], st, 5); }
    }
  };
  const inner = ring(26, 175, 80, 62 * D2R, 0.25), outer = ring(30, 320, 190, 62 * D2R, 0.2);
  walls(inner, 13, 3.2, 5.5, [0, 0], true); walls(inner, 13, 3.2, 5.5, [0, 0], false);
  walls(outer, 9, 2.6, 4.5, [-40, 60], true); walls(outer, 9, 2.6, 4.5, [-40, 60], false);
  // Akkale: kuzey ucundaki beyaz kare burç
  const p = inner[6], b = c.hl(p[0], p[1]) - 3; for (const K of [hi, lo]) { K.box(15, 22, 15, p[0] * 1.08, b, p[1] * 1.08, tone(0xd6cfc2, 0.05)); }
  c.coll(0, 0, 170, c.hl(0, 0) + 16);
}

function izmirSaat(c) {
  const { hi, lo, hiG } = c;
  const m = tone(0xece4d2, 0.04), mD = tone(0xc9bea8, 0.04), dark = 0x30302e, lead = tone(LEAD, 0.03);
  // Saat Kulesi (1901): 25 m, sekizgen, dört katlı; tabanda dört çeşme
  for (const K of [hi, lo]) {
    K.cyl(10, 10, 0.4, 0, 0, 0, mD, 8, Math.PI / 8); K.cyl(9, 9, 0.4, 0, 0.4, 0, m, 8, Math.PI / 8);
    K.cyl(4.6, 4.6, 7.2, 0, 0.8, 0, m, 8, Math.PI / 8); K.cyl(5.1, 5.1, 0.8, 0, 8, 0, mD, 8, Math.PI / 8);
    K.cyl(3.9, 3.9, 6, 0, 8.8, 0, m, 8, Math.PI / 8); K.cyl(4.3, 4.3, 0.7, 0, 14.8, 0, mD, 8, Math.PI / 8);
    K.cyl(3.2, 3.2, 4.6, 0, 15.5, 0, m, 8, Math.PI / 8); K.cyl(3.6, 3.6, 0.6, 0, 20.1, 0, mD, 8, Math.PI / 8);
    K.cyl(2.4, 2.2, 2.2, 0, 20.7, 0, m, 8, Math.PI / 8); K.dome(2.3, 0, 22.9, 0, lead, 0.9, 12); K.cyl(0.16, 0.05, 2.1, 0, 24.9, 0, 0xc8a24a, 5);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    for (const [r, y0, h, rr] of [[4.6, 0.8, 7.2, 4.6], [3.9, 8.8, 6, 3.9], [3.2, 15.5, 4.6, 3.2]]) {
      const ca = Math.cos(a + Math.PI / 8), sa = Math.sin(a + Math.PI / 8);
      hi.cyl(0.3, 0.3, h, ca * rr * 0.98, y0, sa * rr * 0.98, mD, 6); // köşe sütunçeleri
    }
    if (i % 2 === 0) { // kemerli açıklıklar ve saat kadranları
      hi.box(1.6, 3.6, 0.3, Math.sin(a) * 4.0, 10.2, Math.cos(a) * 4.0, dark, a);
    } else hi.box(1.3, 3, 0.3, Math.sin(a) * 4.0, 10.4, Math.cos(a) * 4.0, dark, a);
  }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const g = new THREE.CylinderGeometry(1.25, 1.25, 0.3, 16); g.rotateX(Math.PI / 2); g.rotateY(a); g.translate(Math.sin(a) * 3.3, 17.8, Math.cos(a) * 3.3); hi.add(g, 0xfaf8f0); }
  for (let i = 0; i < 4; i++) { // çeşmeler
    const a = i * Math.PI / 2 + Math.PI / 4, x = Math.sin(a) * 6.8, z = Math.cos(a) * 6.8;
    hi.box(2.6, 3.2, 1.4, x, 0.8, z, m, a); hi.box(1.4, 2, 0.3, x - Math.sin(a) * 0.62, 1.2, z - Math.cos(a) * 0.62, dark, a); hiG.box(2.4, 0.1, 1.4, x + Math.sin(a) * 1.1, 1.0, z + Math.cos(a) * 1.1, 0x5b8fa8, a);
  }
  c.coll(0, 0, 6, 26);
}

function konakCamii(c) {
  const { hi, lo } = c;
  const st = tone(0xe9e3d6, 0.03), tile = (x, y, z) => (Math.floor(y * 1.2) % 2 ? rgb(0x2f7fa6) : rgb(0x3d9fb8)), lead = tone(LEAD, 0.03);
  // Konak (Yalı) Camii, 1755: sekizgen, dış yüzü çinili, tek minare
  for (const K of [hi, lo]) {
    K.cyl(5.8, 5.8, 1, 0, 0, 0, st, 8, Math.PI / 8); K.cyl(5.4, 5.4, 6, 0, 1, 0, tile, 8, Math.PI / 8);
    K.cyl(5.6, 5.6, 0.6, 0, 7, 0, st, 8, Math.PI / 8); K.cyl(4.3, 4.3, 1.4, 0, 7.6, 0, st, 16); K.dome(4.4, 0, 9, 0, lead, 0.95, 16);
    minaret(K, 6.6, -2.5, 25, 1.0, st, lead, 1, 0, 10);
  }
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; hi.box(1.2, 2.2, 0.3, Math.sin(a) * 5.05, 3.4, Math.cos(a) * 5.05, 0x2a2e30, a); }
  c.coll(6.6, -2.5, 2, 25);
}

function kadifekale(c) {
  const { hi, lo } = c;
  const st = tone(0x9a8a76, 0.12, 0.12);
  const pts = []; const n = 22;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, w = 1 + 0.3 * (vnoise(i * 0.6, 1, 4) - 0.5); pts.push([Math.cos(a) * 190 * w, Math.sin(a) * 120 * w]); }
  const rot = (p) => { const r = 35 * D2R; return [p[0] * Math.cos(r) - p[1] * Math.sin(r), p[0] * Math.sin(r) + p[1] * Math.cos(r)]; };
  for (let i = 0; i < n; i++) {
    if (i === 15 || i === 16) continue; // yıkık kesim
    const [x0, z0] = rot(pts[i]), [x1, z1] = rot(pts[(i + 1) % n]);
    const b = Math.min(c.hl(x0, z0), c.hl(x1, z1)) - 4, h = 6 + 6 * vnoise(i * 1.3, 2, 2), top = Math.max(c.hl((x0 + x1) / 2, (z0 + z1) / 2), b + 4) + h;
    hi.wall(x0, z0, x1, z1, 3, top - b, b, st); lo.wall(x0, z0, x1, z1, 3, top - b, b, st);
    const tb = c.hl(x0, z0) - 4, th = top - b + 3;
    hi.box(8, th, 8, x0, tb, z0, st, Math.atan2(-(z1 - z0), x1 - x0));
    for (let k = 0; k < 4; k++) hi.box(1.5, 1.2, 1.5, x0 + (k % 2 ? 3 : -3), tb + th, z0 + (k < 2 ? 3 : -3), st);
    if (i % 2 === 0) lo.box(8, th, 8, x0, tb, z0, st);
  }
  c.coll(0, 0, 200, c.hl(0, 0) + 14);
}

function bursaUlu(c) {
  const { hi, lo, hiG } = c;
  // 1399: 71 x 61 m, 5 x 4 = 20 kubbe, kuzey köşelerde iki minare; ortadaki şadırvan kubbesi aydınlık fenerli
  const st = tone(0xd9cdb4, 0.05), lead = tone(LEAD, 0.04), dark = 0x2c2a28;
  const W = 71, D = 61, bx = W / 5, bz = D / 4;
  const f = Math.min(-3, c.minH(45) - 2);
  for (const K of [hi, lo]) {
    K.box(W + 2, -f, D + 2, 0, f, 0, st); K.box(W, 14, D, 0, 0, 0, st);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      const x = -W / 2 + (i + 0.5) * bx, z = -D / 2 + (j + 0.5) * bz, mid = i === 2, dh = mid ? 3 : 1.2;
      K.cyl(6.3, 6.3, dh, x, 14, z, st, 8, Math.PI / 8);
      if (mid && j === 1) K.dome(5.9, x, 14 + dh, z, lead, 0.7, 14);
      else K.dome(6.1, x, 14 + dh, z, lead, mid ? 0.95 : 0.85, 14);
    }
    minaret(K, -W / 2 - 2.5, -D / 2 - 2.5, 46, 2.2, st, lead, 1, 0, 12);
    minaret(K, W / 2 + 2.5, -D / 2 - 2.5, 43, 2.2, st, lead, 1, 0, 12);
  }
  hiG.cyl(2.2, 2.2, 2.4, 0, 14 + 3 + 4.0, -D / 2 + 1.5 * bz, 0x9fb6c4, 10); // aydınlık feneri
  windowsAround(hi, W, D, 3, 4.2, bx / 2, 0, 0, dark); windowsAround(hi, W, D, 9, 2.6, bx / 2, 0, 0, dark);
  hi.box(5, 7, 0.6, 0, 0, -D / 2 - 0.2, 0x5a4a3a);
  c.coll(0, 0, 45, 23); c.coll(-W / 2 - 2.5, -D / 2 - 2.5, 3, 46); c.coll(W / 2 + 2.5, -D / 2 - 2.5, 3, 43);
}

function mevlana(c) {
  const { hi, lo } = c;
  const st = tone(0xe2d8c4, 0.04), lead = tone(LEAD, 0.04), green = (x, y, z) => { const a = Math.atan2(z - 2, x - 9), k = 0.86 + 0.14 * Math.abs(Math.cos(a * 8)); const g = rgb(0x1f9c86); return [g[0] * k, g[1] * k, g[2] * k]; };
  const f = Math.min(-2, c.minH(60) - 2);
  const flute = (R, n = 16, d = 0.1) => (a) => R * (1 + d * Math.abs(Math.cos(a * n / 2)));
  const fluted = (K, y0, y1, r0, r1, x, z, segH = 4) => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 48, segH, false); g.translate(0, 0.5, 0);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i), pz = P.getZ(i), a = Math.atan2(pz, px), R = (r0 + (r1 - r0) * py) * (1 + 0.09 * Math.abs(Math.cos(a * 8))), rr = Math.hypot(px, pz) > 0.01 ? R : 0; P.setXYZ(i, Math.cos(a) * rr + x, y0 + py * (y1 - y0), Math.sin(a) * rr + z); }
    g.computeVertexNormals(); return K.add(g, green);
  };
  for (const [K, det] of [[hi, true], [lo, false]]) {
    K.box(150, -f, 120, -20, f, 10, tone(0xcdbfa6, 0.04));
    K.box(44, 10, 26, 0, 0, 0, st);                      // türbe ve semahane
    K.box(22, 8, 18, -30, 0, 2, st);                     // mescit
    for (const [x, z, r] of [[-12, 0, 7], [-30, 2, 6.5], [-2, -6, 4], [-2, 6, 4], [16, -7, 3.5]]) { K.cyl(r + 0.3, r + 0.3, 1.5, x, 10, z, st, 12); K.dome(r, x, 11.5, z, lead, 0.85, 14); }
    // Kubbe-i Hadra: kare kaide, 16 dilimli yeşil gövde ve külah (25 m)
    K.box(11, 13, 11, 9, 0, 2, st);
    if (det) { fluted(K, 13, 19, 4.6, 4.6, 9, 2); fluted(K, 19, 25, 4.8, 0.35, 9, 2, 6); }
    else { K.cyl(4.6, 4.6, 6, 9, 13, 2, rgb(0x1f9c86), 16); K.cone(4.8, 6, 9, 19, 2, rgb(0x1f9c86), 16); }
    K.cyl(0.14, 0.1, 2.4, 9, 25, 2, 0xc8a24a, 5);
    // derviş hücreleri: avlunun kuzey ve batı yanında kubbeli odalar
    for (let i = 0; i < 17; i++) { const x = -60 + i * 5.2; K.box(5, 4.5, 6, x, 0, -30, st); if (det) K.dome(2.2, x, 4.5, -30, lead, 0.8, 8); }
    for (let i = 0; i < 6; i++) { const z = -24 + i * 6; K.box(6, 4.5, 5.6, -62, 0, z, st); if (det) K.dome(2.2, -62, 4.5, z, lead, 0.8, 8); }
  }
  hi.cyl(3, 3, 1.2, -25, 0, -14, st, 8); hi.cyl(0.3, 0.3, 3, -25, 1.2, -14, st, 6); hi.cone(3.4, 2, -25, 4.2, -14, lead, 8); // şadırvan
  windowsAround(hi, 44, 26, 3, 3, 5, 0, 0, 0x2c2a28);
  c.coll(9, 2, 7, 27); c.coll(0, 0, 26, 18);
}

function devrent(c) {
  const { hi, lo } = c;
  // peri bacaları kümesi: tüf gövde (açık bej, yatay katmanlar), bazalt şapka
  const tuff = (x, y, z) => { const b = 0.9 + 0.1 * Math.sin(y * 1.3 + vnoise(x * 0.05, y * 0.2, z * 0.05) * 3) + 0.08 * (vnoise(x * 0.3, y * 0.6, z * 0.3) - 0.5); const t = rgb(y > 14 ? 0xdcc4a2 : 0xe0cdb0); return [t[0] * b, t[1] * b * 0.98, t[2] * b * 0.95]; };
  const cap = tone(0x6a5a4c, 0.15, 0.4);
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const N = 46;
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = 25 + Math.sqrt(rnd()) * 260, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.7;
    const H = 10 + rnd() * 26, R = 2.5 + rnd() * 3.5, y = c.hl(x, z) - 2;
    const heads = rnd() < 0.25 ? 3 : rnd() < 0.3 ? 2 : 1;
    // geniş etek (tüf yamacı)
    rockLathe(hi, [[R * 3.4, 0], [R * 2.4, H * 0.15], [R * 1.5, H * 0.35], [R * 1.1, H * 0.5], [0.05, H * 0.52]], 14, 0.25, i, x, y, z, tuff);
    lo.cone(R * 3, H * 0.5, x, y, z, rgb(0xdcc6a6), 6);
    for (let h = 0; h < heads; h++) {
      const hx = x + (heads > 1 ? Math.cos(h * 2.1 + a) * R * 1.0 : 0), hz = z + (heads > 1 ? Math.sin(h * 2.1 + a) * R * 1.0 : 0), HH = H * (h ? 0.75 + rnd() * 0.2 : 1), rr = R * (h ? 0.7 : 1);
      const capped = rnd() < 0.7;
      rockLathe(hi, [[rr * 1.3, H * 0.3], [rr * 1.05, HH * 0.55], [rr * 0.8, HH * 0.78], [rr * 0.55, HH * 0.9], [rr * 0.45, HH * 0.96], [0.05, HH]], 12, 0.18, i * 3 + h, hx, y, hz, tuff);
      lo.cone(rr * 1.1, HH, hx, y + H * 0.3, hz, rgb(0xdcc6a6), 6);
      if (capped) {
        rockLathe(hi, [[rr * 0.5, 0], [rr * 1.25, rr * 0.25], [rr * 1.3, rr * 0.55], [rr * 0.9, rr * 0.95], [0.05, rr * 1.15]], 10, 0.3, i * 5 + h, hx, y + HH * 0.93, hz, cap);
        lo.cone(rr * 1.25, rr * 1.1, hx, y + HH * 0.93, hz, rgb(0x6a5a4c), 6);
      }
      if (i % 3 === 0) c.coll(x, z, R * 1.5, y + HH + rr);
    }
  }
}

function celsus(c) {
  const { hi, lo } = c;
  // Celsus Kütüphanesi: 21 m genişlik, 16.7 m yükseklik, iki katlı cephe, doğuya bakar (yerel +z)
  const m = tone(0xe4ddcc, 0.06, 0.5), mD = tone(0xcfc5b0, 0.07, 0.5), dark = 0x4a443c;
  const f = Math.min(-2, c.minH(40) - 2);
  for (const K of [hi, lo]) {
    K.box(23, -f, 18, 0, f, -6, mD);
    for (let s = 0; s < 9; s++) K.box(21 - s * 0.1, 0.24, 1.8 - s * 0.2, 0, s * 0.24, 2.8 - s * 0.05 + 0.3, m); // 9 basamak
    K.box(21, 16.5, 1.6, 0, 2.2, 0, m);                                    // cephe duvarı
    for (const [x, h] of [[-10.8, 9], [10.8, 9]]) K.box(1.4, h, 14, x, 0, -7, mD); // yan duvar kalıntıları
    K.box(20, 4, 1.4, 0, 0, -13, mD);
  }
  // alt kat: 4 çift sütun çıkıntılı kaidelerde, 3 kapı
  const xs = [-8.1, -2.7, 2.7, 8.1];
  for (const x of xs) for (const d of [-0.8, 0.8]) { hi.box(1.0, 1.3, 1.6, x + d, 2.2, 1.9, mD); hi.cyl(0.42, 0.36, 5.6, x + d, 3.5, 2.1, m, 10); hi.box(0.95, 0.6, 0.95, x + d, 9.1, 2.1, mD); }
  for (const x of xs) hi.box(2.6, 1.2, 2.2, x, 9.7, 1.6, m);                      // çıkıntılı saçaklar
  for (const [x, w] of [[-5.4, 2.0], [0, 2.4], [5.4, 2.0]]) { hi.box(w, 5.2, 0.4, x, 2.2, 0.82, dark); hi.box(w + 0.8, 0.5, 0.6, x, 7.4, 0.9, mD); }
  for (const x of [-10.2, 10.2]) hi.box(1.2, 3, 0.3, x * 0.93, 3.5, 0.82, 0x6b6052); // heykel nişleri
  // üst kat: 3 aedicula (alttakilerin arasında), alınlıklar
  const ux = [-5.4, 0, 5.4];
  for (const x of ux) for (const d of [-1.1, 1.1]) { hi.box(0.9, 0.8, 1.3, x + d, 10.9, 1.8, mD); hi.cyl(0.34, 0.3, 4.4, x + d, 11.7, 2.0, m, 10); }
  for (const x of ux) { hi.box(3.4, 0.8, 2.0, x, 16.1, 1.6, m); }
  { const g = new THREE.CylinderGeometry(2.1, 2.1, 1.9, 3, 1); g.rotateX(-Math.PI / 2); g.scale(1, 0.38, 1); hi.at(0, 17.3, 1.6).add(g, m); } // üçgen alınlık (ortada)
  for (const x of [-5.4, 5.4]) { const g = new THREE.CylinderGeometry(1.7, 1.7, 1.9, 10, 1, false, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2); g.scale(1, 0.4, 1); hi.at(x, 16.9, 1.6).add(g, m); } // yay alınlıklar
  for (const x of [-5.4, 0, 5.4]) hi.box(1.4, 2.6, 0.3, x, 12.5, 0.82, dark);
  c.coll(0, 0, 12, 19);
}

function efesTiyatro(c) {
  const { hi, lo } = c;
  // Büyük Tiyatro: oturma yeri 154 m çap, ~ 30 m yükseklik, Panayır Dağı yamacına oyulmuş; batıya (yerel +z) bakar
  const st = tone(0xcfc3ad, 0.08, 0.2), stD = tone(0xa99d86, 0.1, 0.2);
  const th0 = -Math.PI * 0.08, thL = Math.PI * 1.16, rows = 22, r0 = 13, r1 = 77;
  const sector = (ra, rb, n) => { const pts = []; for (let k = 0; k <= n; k++) { const t = th0 + thL * k / n - thL / 2 - th0; pts.push([rb * Math.sin(t), -rb * Math.cos(t)]); } for (let k = n; k >= 0; k--) { const t = th0 + thL * k / n - thL / 2 - th0; pts.push([ra * Math.sin(t), -ra * Math.cos(t)]); } return pts; };
  for (let i = 0; i < rows; i++) {
    const ra = r0 + (r1 - r0) * i / rows, rb = r0 + (r1 - r0) * (i + 1) / rows, top = 1 + i * 1.35;
    const bot = Math.min(c.hl(0, -ra) - 6, -6);
    hi.prism(sector(ra, rb, 30), bot, top - bot, i % 7 === 6 ? stD : st);
    if (i % 3 === 0) { const rb3 = r0 + (r1 - r0) * Math.min(rows, i + 3) / rows; lo.prism(sector(ra, rb3, 10), bot, 1 + Math.min(rows - 1, i + 2) * 1.35 - bot, st); }
  }
  // sahne binası (skene) kalıntısı ve orkestra
  for (const K of [hi, lo]) { K.cyl(r0, r0, 0.5, 0, 0.3, 0, stD, 24); K.box(42, 9, 7, 0, -1, r0 + 6, st); }
  for (let i = 0; i < 9; i++) hi.box(1, 6, 1, -16 + i * 4, 8, r0 + 3, st);
  c.coll(0, -40, 75, 31);
}

// Pamukkale: OSM travertenler alanı (yerel metre, kuzey = -z), arazi eğimine göre basamaklanmış beyaz teraslar, havuzlarda su
const PAMUK = [[-431, -84], [-264, -230], [-129, -206], [-123, -229], [-132, -252], [-167, -298], [-184, -362], [-86, -330], [-1, -313], [48, -298], [113, -348], [136, -445], [183, -502], [229, -538], [412, -603], [478, -599], [503, -527], [391, -314], [320, -275], [257, -163], [283, -143], [256, -91], [170, 13], [136, -1], [108, 36], [33, -7], [7, -22], [-55, -10], [-84, -11], [-132, 6], [-136, 22], [-118, 55], [-74, 74], [-56, 95], [-34, 96], [-7, 86], [109, 135], [116, 263], [95, 337], [51, 327], [35, 355], [12, 370], [35, 495], [-2, 603], [-95, 642], [-125, 629], [-104, 568], [-97, 492], [-137, 466], [-166, 415], [-336, 323], [-388, 147], [-354, 76]];
function inPoly(P, x, y) { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
function pamukkale(c) {
  const poly = PAMUK.map(([x, y]) => [x, -y]); // yerel x, z
  const build = (cell, stone, water, det) => {
    const x0 = -520, z0 = -660, nx = Math.ceil(1060 / cell), nz = Math.ceil(1340 / cell);
    const H = new Float32Array(nx * nz).fill(NaN), T = new Float32Array(nx * nz);
    const q = 2.4;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
      if (!inPoly(poly, x, z)) continue;
      const t = c.hl(x, z); T[j * nx + i] = t;
      const n = (vnoise(x * 0.035, z * 0.035, 1) - 0.5) * 3.2 + (vnoise(x * 0.12, z * 0.12, 4) - 0.5) * 1.2;
      H[j * nx + i] = Math.ceil((t + 0.6 + n) / q) * q - n * 0.15;
    }
    const pos = [], col = [], wpos = [], wcol = [];
    const cW = rgb(0xf4f2ec), cR = rgb(0xfdfcf8), cS = rgb(0xe2dac9), cP = rgb(0x6cc9d2), cP2 = rgb(0x93dbd9), cD = rgb(0xe9e3d4);
    const quad = (A, C, a, b, cc, d) => { A.push(...a, ...b, ...cc, ...a, ...cc, ...d); for (let k = 0; k < 6; k++) C.push(...col0); };
    let col0 = cW;
    const hAt = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz) ? NaN : H[j * nx + i];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const h = hAt(i, j); if (Number.isNaN(h)) continue;
      const xa = x0 + i * cell, xb = xa + cell, za = z0 + j * cell, zb = za + cell;
      let rim = false;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const hn = hAt(i + di, j + dj); if (!Number.isNaN(hn) && hn < h - 0.1) rim = true; }
      const pool = !rim && vnoise(xa * 0.02, za * 0.02, 9) > 0.42;
      const jit = (vnoise(xa * 0.3, za * 0.3, 2) - 0.5) * 0.15;
      if (pool && det) {
        col0 = cD; quad(pos, col, [xa, h - 0.35, za], [xa, h - 0.35, zb], [xb, h - 0.35, zb], [xb, h - 0.35, za]);
        col0 = vnoise(xa * 0.05, za * 0.05, 3) > 0.5 ? cP : cP2; quad(wpos, wcol, [xa, h - 0.08, za], [xa, h - 0.08, zb], [xb, h - 0.08, zb], [xb, h - 0.08, za]);
      } else { col0 = rim ? cR : pool ? cP2 : cW; col0 = col0.map((v) => v * (1 + jit)); quad(pos, col, [xa, h, za], [xa, h, zb], [xb, h, zb], [xb, h, za]); }
      // yan yüzler: komşu daha alçaksa ya da alan dışıysa aşağı doğru beyaz kireç perdesi
      const side = (hn, a, b) => {
        const lowv = Number.isNaN(hn) ? Math.min(T[j * nx + i], h) - 2 : hn; if (lowv >= h - 0.05) return;
        col0 = cS; quad(pos, col, [a[0], h, a[1]], [a[0], lowv, a[1]], [b[0], lowv, b[1]], [b[0], h, b[1]]);
      };
      side(hAt(i + 1, j), [xb, zb], [xb, za]); side(hAt(i - 1, j), [xa, za], [xa, zb]);
      side(hAt(i, j + 1), [xa, zb], [xb, zb]); side(hAt(i, j - 1), [xb, za], [xa, za]);
    }
    const mk = (P, C) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); return g; };
    if (pos.length) stone.parts.push(mk(pos, col)); if (wpos.length) water.parts.push(mk(wpos, wcol));
  };
  build(7, c.hi, c.hiG, true); build(21, c.lo, c.loG, false);
}

function nemrut(c) {
  const { hi, lo } = c;
  // Antiochos I tümülüsü: 50 m yükseklik, 150 m çap, kırma taş; doğu ve batı teraslarında oturan heykeller ve düşmüş başlar
  const grav = (x, y, z) => { const v = 0.82 + 0.3 * hash(Math.round(x * 0.7), Math.round(y * 0.7), Math.round(z * 0.7)); const g = rgb(0xb8ab92); return [g[0] * v, g[1] * v, g[2] * v]; };
  const base = Math.min(-8, c.minH(80) - 4);
  for (const [K, seg] of [[hi, 40], [lo, 16]]) K.lathe([[82, base], [78, 0], [64, 12], [44, 30], [20, 45], [6, 49.4], [0.1, 50]], seg, 0, 0, 0, grav);
  const lime = tone(0xcdbb9c, 0.08, 0.4), limeD = tone(0xa8977a, 0.1, 0.4);
  const terrace = (sx) => {
    const tx = sx * 92, ty = Math.max(c.hl(tx, 0), 0) + 0.3, ty0 = c.minH(30, tx, 0) - 2;
    for (const K of [hi, lo]) K.box(26, ty - ty0 + 1, 64, tx, ty0, 0, limeD);
    const top = ty + 1;
    for (let i = 0; i < 5; i++) {
      const z = -20 + i * 10, x = tx - sx * 4;
      for (const K of [hi, lo]) { K.box(5, 2.2, 5, x, top, z, limeD); K.box(4, 3.5, 4.2, x, top + 2.2, z, lime); }
      hi.box(3.2, 3.2, 3.6, x + sx * 0.3, top + 5.7, z, lime); hi.box(1.6, 3.6, 3.2, x + sx * 2.5, top + 2.2, z, lime);
      if (sx < 0) { hi.box(2.2, 2.8, 3.4, x, top + 8.9, z, lime); hi.cone(1.6, 2.4, x, top + 11.7, z, lime, 8); } // batıda başlar yerinde (bazıları)
      // düşmüş başlar: önde yerde, tiara başlıklı
      const hx = tx + sx * 9, hz = z + (i % 2 ? 2 : -1), hy = c.hl(hx, hz);
      hi.dome(1.3, hx, hy + 0.2, hz, lime, 1.2, 10); hi.cyl(1.3, 1.3, 0.4, hx, hy - 0.2, hz, lime, 10); hi.cone(1.2, 2.2, hx + 0.2, hy + 1.6, hz, limeD, 8);
    }
    for (const z of [-28, 28]) { hi.box(3, 4.5, 2, tx - sx * 4, top, z, lime); hi.box(2, 1.4, 2.4, tx - sx * 4, top + 4.5, z, limeD); } // kartal ve aslan
  };
  terrace(1); terrace(-1);
  c.coll(0, 0, 70, 50);
}

function sumela(c) {
  const { hi, lo } = c;
  // Sümela: Karadağ'ın sarp yamacında, ~1200 m'de, 300 m'lik uçurumda bir çıkıntı üstünde. Yapılar yerel x boyunca, yüz +z (vadi).
  const bot = Math.min(-60, c.minH(140, 0, 40) - 30);
  for (const [K, det] of [[hi, 1], [lo, 0]]) {
    rock(K, 360, 170 - bot, 150, 0, bot, -85, det ? 34 : 22, 0x3d5530, 0x77716a, 1, 0.05, det ? 12 : 30);           // ana kaya duvarı
    rock(K, 140, -bot, 34, -5, bot, 4, det ? 8 : 5, 0x4a5e34, 0x80786c, 2, 0.05, det ? 12 : 30);               // çıkıntı
    rock(K, 110, 34, 26, -8, 34, -6, det ? 10 : 6, 0x4a5e34, 0x6f695f, 3, 0.05, det ? 12 : 30);                      // saçak kayası
  }
  const wall = tone(0xe6dbc2, 0.05), roof = tone(0x8a4a36, 0.06), dark = 0x2b2b2d;
  for (const K of [hi, lo]) {
    K.box(62, 22, 12, -6, 0, 6, wall);                                          // ana bina (konuk evi, 5 kat)
    K.box(63, 1, 13, -6, 22, 6, roof);
    const g = new THREE.CylinderGeometry(0.01, 7.2, 4, 4, 1); g.rotateY(Math.PI / 4); g.scale(4.6, 1, 0.92); g.translate(-6, 25, 6); K.add(g, roof);
    K.box(14, 12, 10, 34, 0, 2, wall); K.box(10, 8, 8, -44, 0, 4, wall);       // yan yapılar
  }
  for (let f = 0; f < 5; f++) windows(hi, 14, 1.4, 2.0, 58, -6, 1.6 + f * 4.2, 12.1, 0, dark);
  for (let i = 0; i < 5; i++) { hi.box(1.6, 14, 2, -70 + i * 6, -14 + i * 0.6, 8, tone(0xd8ccb4, 0.04)); } // su kemeri ayakları
  hi.box(26, 1.6, 2.4, -58, 0, 8, tone(0xd8ccb4, 0.04));
  hi.box(10, 7, 0.4, 34, 3, 7.1, 0x7a5a48); // kaya kilisesi fresk duvarı
  c.coll(0, -60, 180, 170); c.coll(-6, 6, 32, 27);
}

function yivliMinare(c) {
  const { hi, lo } = c;
  // Yivli Minare (13. yy): 38 m, kesme taş kaide, 8 yivli tuğla gövde, firuze çini kuşaklar; yanında altı kubbeli cami
  const brick = (x, y, z) => { const b = rgb(Math.floor(y / 4) % 3 === 2 && y > 12 && y < 30 ? 0x2d8a9a : 0x9a4e37); const k = 0.9 + 0.15 * hash(Math.round(x * 2), Math.round(y * 3), Math.round(z * 2)); return [b[0] * k, b[1] * k, b[2] * k]; };
  const st = tone(0xcbbda4, 0.05), lead = tone(LEAD, 0.04);
  const fl = (K, y0, y1, R, seg) => {
    const g = new THREE.CylinderGeometry(1, 1, 1, seg, 6, false); g.translate(0, 0.5, 0); const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i), pz = P.getZ(i), a = Math.atan2(pz, px), on = Math.hypot(px, pz) > 0.01, r = on ? R * (1 - 0.03 * py) * (0.86 + 0.14 * Math.abs(Math.cos(a * 4))) : 0; P.setXYZ(i, Math.cos(a) * r, y0 + py * (y1 - y0), Math.sin(a) * r); }
    g.computeVertexNormals(); return K.add(g, brick);
  };
  for (const [K, seg] of [[hi, 48], [lo, 16]]) {
    K.box(7.2, 6.5, 7.2, 0, -1, 0, st); K.cyl(3.6, 3.3, 1.5, 0, 5.5, 0, st, 8, Math.PI / 8);
    fl(K, 7, 31, 3.1, seg);
    K.cyl(3.0, 3.9, 1.3, 0, 31, 0, brick, 16); K.cyl(3.9, 3.9, 1.1, 0, 32.3, 0, st, 16);
    K.cyl(2.2, 2.0, 2.6, 0, 33.4, 0, brick, 12); K.cone(2.3, 2.4, 0, 36, 0, lead, 12);
    K.box(26, 9, 18, -17, -1, 4, st);                                           // Yivli Minare Camii
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) K.dome(3.6, -26 + i * 9, 8, -1 + j * 9.5, lead, 0.8, 12);
  }
  c.coll(0, 0, 4.5, 38.5);
}

function kaleici(c) {
  const { hi, lo } = c;
  // Kaleiçi surları (eski kentin çevresi), Hadrian Kapısı (MS 130, üç kemerli), Hıdırlık Kulesi, Saat Kulesi
  const st = tone(0xb7a58a, 0.1, 0.15), stL = tone(0xd2c6b2, 0.06, 0.3), marb = tone(0xe8e1d0, 0.05);
  const ring = [[36.88770, 30.70445], [36.88700, 30.70660], [36.88600, 30.70820], [36.88527, 30.70853], [36.88400, 30.70840], [36.88260, 30.70750], [36.88180, 30.70580], [36.88125, 30.70363], [36.88220, 30.70270], [36.88330, 30.70235], [36.88480, 30.70205], [36.88620, 30.70265], [36.88730, 30.70350]];
  const P = ring.map(([la, lo2]) => c.loc(la, lo2));
  for (let i = 0; i < P.length; i++) {
    if (i === 2 || i === 3) continue; // Hadrian Kapısı arası kapı olarak
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % P.length], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 40));
    for (let k = 0; k < n; k++) {
      const xa = x0 + (x1 - x0) * k / n, za = z0 + (z1 - z0) * k / n, xb = x0 + (x1 - x0) * (k + 1) / n, zb = z0 + (z1 - z0) * (k + 1) / n;
      const b = Math.min(c.hl(xa, za), c.hl(xb, zb)) - 3, top = Math.max(c.hl((xa + xb) / 2, (za + zb) / 2), b + 3) + 9;
      hi.wall(xa, za, xb, zb, 3, top - b, b, st); lo.wall(xa, za, xb, zb, 3, top - b, b, st);
      for (let m = 0; m < Math.floor(L / n / 3); m++) { const t = (m + 0.5) / Math.floor(L / n / 3); hi.box(1.4, 1.1, 3, xa + (xb - xa) * t, top, za + (zb - za) * t, st, Math.atan2(-(zb - za), xb - xa)); } // mazgallar
      const tb = c.hl(xa, za) - 3; hi.box(8, 15, 8, xa, tb, za, st, Math.atan2(-(zb - za), xb - xa)); if (k % 2 === 0) lo.box(8, 15, 8, xa, tb, za, st);
    }
  }
  // Hadrian Kapısı: üç kemer, dört cepheli sütun, iki yanda kuleler
  { const [gx, gz] = P[3], ry = (132 - 90) * D2R, g = hi.at(gx, c.hl(gx, gz) - 0.5, gz, ry), gl = lo.at(gx, c.hl(gx, gz) - 0.5, gz, ry);
    for (const K of [g, gl]) { K.box(19, 8.2, 3, 0, 0, 0, marb); K.box(19.4, 1.4, 3.6, 0, 8.2, 0, marb); K.box(17, 1.6, 2.6, 0, 9.6, 0, marb); }
    for (const x of [-6, 0, 6]) g.box(3.6, 5.6, 3.2, x, 0, 0, 0x3a3530);
    for (const x of [-8.6, -3.2, 3.2, 8.6]) for (const s of [-1, 1]) g.cyl(0.4, 0.36, 7.4, x, 0.4, s * 2.0, marb, 10);
    for (const s of [-1, 1]) { g.box(8, 16, 8, s * 14, 0, 0, st); gl.box(8, 16, 8, s * 14, 0, 0, st); } }
  // Hıdırlık Kulesi: kare kaide üstünde yuvarlak kule (~ 14 m)
  { const [x, z] = c.loc(36.881251, 30.703625), y = c.hl(x, z) - 2; for (const K of [hi, lo]) { K.box(17, 7, 17, x, y, z, st); K.cyl(7.5, 7.2, 9, x, y + 7, z, st, 24); } hi.box(3, 1.8, 0.4, x, y + 11, z + 7.3, 0x3a3530); }
  // Kalekapısı Saat Kulesi: beşgen taş kule, üstte saat odası (~ 14 m)
  { const [x, z] = c.loc(36.88745, 30.70515), y = c.hl(x, z) - 1; for (const K of [hi, lo]) { K.cyl(3.6, 3.4, 11, x, y, z, st, 5); K.box(5, 3, 5, x, y + 11, z, stL); K.cone(3.6, 2.2, x, y + 14, z, tone(0x8a4a36, 0.04), 4, Math.PI / 4); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, g = new THREE.CylinderGeometry(0.9, 0.9, 0.2, 14); g.rotateX(Math.PI / 2); g.rotateY(a); g.translate(x + Math.sin(a) * 2.55, y + 12.5, z + Math.cos(a) * 2.55); hi.add(g, 0xf8f6ee); } }
  // Kesik Minare (Korkut Camii): yıkık minare gövdesi
  { const [x, z] = c.loc(36.882711, 30.705727), y = c.hl(x, z); for (const K of [hi, lo]) K.cyl(1.9, 1.7, 14, x, y - 1, z, tone(0x9a4e37, 0.06), 12); }
  for (const [la, lo2, r, h] of [[36.88527, 30.70853, 16, 16], [36.881251, 30.703625, 10, 16], [36.88745, 30.70515, 5, 15]]) { const [x, z] = c.loc(la, lo2); c.coll(x, z, r, c.hl(x, z) + h); }
}

// ---------- asma köprüler ----------
// a, b: tabliye uçları (enlem, boylam), kuleler: a'dan uzaklık (m), kule boyu, tabliye eni, kuledeki ve ortadaki tabliye yüksekliği
const BRIDGES = [
  { id: 'k1915', name: '1915 Çanakkale Köprüsü', a: [40.3503897, 26.6155507], b: [40.327589, 26.6608357], towers: [1149, 3168], H: 318, W: 45, dT: 70, dM: 75, tower: 0xc0281f, top: 0xf2f2ee, deck: 0xd9dbdc },
  { id: 'osmangazi', name: 'Osmangazi Köprüsü', a: [40.7418472, 29.5137023], b: [40.7701487, 29.5183121], towers: [668, 2210], H: 252, W: 36, dT: 64, dM: 68, tower: 0xd5d8da, top: 0xd5d8da, deck: 0xcfd2d4 },
];
function bridge(c, B, W) {
  const { hi, lo } = c;
  const L = B.len, [t0, t1] = B.towers;
  const ea = Math.max(W.isLand(B.ax, B.ay) ? W.terrainH(B.ax, B.ay) : 0, 0) + 2, eb = Math.max(W.isLand(B.bx, B.by) ? W.terrainH(B.bx, B.by) : 0, 0) + 2;
  const deckAt = (al) => {
    if (al <= t0) { const t = Math.max(0, al) / t0; return ea + (B.dT - ea) * Math.sin(t * Math.PI / 2); }
    if (al >= t1) { const t = Math.max(0, L - al) / (L - t1); return eb + (B.dT - eb) * Math.sin(t * Math.PI / 2); }
    const t = (al - t0) / (t1 - t0); return B.dT + (B.dM - B.dT) * Math.sin(t * Math.PI);
  };
  B.deckAt = deckAt;
  const dk = tone(B.deck, 0.02), dkD = tone(0x8f9396, 0.03), tw = tone(B.tower, 0.03), asph = 0x3c3e40;
  // tabliye: aerodinamik kutu kiriş (yamuk kesit), korkuluklar, asfalt
  const seg = (K, n, det) => {
    for (let k = 0; k < n; k++) {
      const a0 = L * k / n, a1 = L * (k + 1) / n, h0 = deckAt(a0), h1 = deckAt(a1), l = a1 - a0, am = (a0 + a1) / 2, hm = (h0 + h1) / 2, pitch = Math.atan2(h1 - h0, l);
      const kk = K.at(am, 0, 0); const rot = new THREE.Matrix4().makeRotationZ(pitch); rot.setPosition(0, hm, 0); const k2 = new Kit(K.parts, kk.T.clone().multiply(rot));
      k2.box(l + 0.2, 0.3, B.W, 0, 0, 0, asph);
      k2.box(l + 0.2, 3.2, B.W * 0.72, 0, -3.6, 0, dk);
      for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(l + 0.2, 3.3, B.W * 0.16); g.translate(0, -1.75, s * B.W * 0.4); const P = g.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) < -2) P.setZ(i, s * B.W * 0.36); g.computeVertexNormals(); k2.add(g, dk); }
      if (det) for (const s of [-1, 1]) k2.box(l + 0.2, 1.2, 0.5, 0, 0.3, s * (B.W / 2 - 0.3), dkD);
    }
  };
  seg(hi, Math.round(L / 30), true); seg(lo, Math.round(L / 120), false);
  // kuleler: iki ayak, kirişler, deniz içinde kesonlar
  for (const al of [t0, t1]) {
    const x = B.ax + B.ux * al, y = B.ay + B.uy * al, gh = W.isLand(x, y) ? W.terrainH(x, y) : -2, wet = !W.isLand(x, y);
    for (const [K, det] of [[hi, true], [lo, false]]) {
      const k = K.at(al, 0, 0);
      if (wet) { k.cyl(16, 16, 14, 0, -10, -B.W * 0.45, dkD, 20); k.cyl(16, 16, 14, 0, -10, B.W * 0.45, dkD, 20); }
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(1, 1, 1, 1, det ? 4 : 1, 1); g.translate(0, 0.5, 0); const P = g.attributes.position;
        for (let i = 0; i < P.count; i++) { const py = P.getY(i), w = 9 - 3.5 * py, d = 11 - 4 * py; P.setXYZ(i, P.getX(i) * w, gh + py * (B.H - gh), s * (B.W / 2 + 2.5 - py * 1.2) + P.getZ(i) * d); }
        g.computeVertexNormals(); k.add(g, (px, py) => (py > B.H - 30 ? rgb(B.top) : tw(px, py, s)));
      }
      for (const hh of det ? [B.dT - 6, (B.dT + B.H) * 0.52, B.H - 12, B.H - 2] : [B.dT - 6, B.H - 8]) k.box(7, 8, B.W + 3, 0, hh - 4, 0, (hh > B.H - 30) ? B.top : B.tower);
    }
    c.coll0(x, y, B.W / 2 + 8, B.H);
  }
  // ana kablolar (borular) ve askılar (çizgi)
  const cables = (K, steps, r) => {
    for (const s of [-1, 1]) {
      const z = s * (B.W / 2 + 1.2), pts = [];
      const sideA = (al) => { const t = al / t0; return ea + 6 + (B.H - 2 - ea - 6) * t * t * 0.4 + (B.H - 2 - ea - 6) * t * 0.6; };
      const sideB = (al) => { const t = (L - al) / (L - t1); return eb + 6 + (B.H - 2 - eb - 6) * t * t * 0.4 + (B.H - 2 - eb - 6) * t * 0.6; };
      const main = (al) => { const t = (al - t0) / (t1 - t0); return (B.H - 2) - 4 * t * (1 - t) * (B.H - 2 - deckAt(al) - 3); };
      for (let i = 0; i <= 6; i++) { const al = t0 * i / 6; pts.push(new THREE.Vector3(al, sideA(al), z)); }
      for (let i = 1; i < steps; i++) { const al = t0 + (t1 - t0) * i / steps; pts.push(new THREE.Vector3(al, main(al), z)); }
      for (let i = 0; i <= 6; i++) { const al = t1 + (L - t1) * i / 6; pts.push(new THREE.Vector3(al, sideB(al), z)); }
      K.tube(pts, r, 0x9a9fa4, 5);
      if (K === hi) { for (let al = t0 + 24; al < t1 - 12; al += 24) c.lines.push(al, main(al), z, al, deckAt(al) + 0.5, z); for (let al = 36; al < t0 - 12; al += 24) c.lines.push(al, sideA(al), z, al, deckAt(al) + 0.5, z); for (let al = t1 + 24; al < L - 36; al += 24) c.lines.push(al, sideB(al), z, al, deckAt(al) + 0.5, z); }
    }
  };
  cables(hi, 60, 1.1); cables(lo, 24, 1.6);
  // ankrajlar
  for (const [al, e] of [[0, ea], [L, eb]]) for (const K of [hi, lo]) K.box(40, 18, B.W + 14, al, e - 14, 0, dkD);
}

// ---------- yapı listesi ----------
const SITES = [
  { id: 'anitkabir', name: 'Anıtkabir', lat: 39.925011, lon: 32.836902, ang: -52.3, far: 30000, b: anitkabir },
  { id: 'atakule', name: 'Atakule', lat: 39.886135, lon: 32.856132, ang: 17, far: 35000, b: atakule },
  { id: 'kocatepe', name: 'Kocatepe Camii', lat: 39.916676, lon: 32.860632, ang: 20, far: 30000, b: kocatepe },
  { id: 'ankarakalesi', name: 'Ankara Kalesi', lat: 39.94149, lon: 32.86543, ang: 0, far: 25000, b: ankaraKalesi, near: 3000 },
  { id: 'saatkulesi', name: 'İzmir Saat Kulesi', lat: 38.418862, lon: 27.128696, ang: 0, far: 12000, near: 1500, b: izmirSaat, hMin: 0.5 },
  { id: 'konakcamii', name: 'Konak Camii', lat: 38.419068, lon: 27.129313, ang: 0, far: 12000, near: 1500, b: konakCamii, hMin: 0.5 },
  { id: 'kadifekale', name: 'Kadifekale', lat: 38.41378, lon: 27.14496, ang: 0, far: 22000, near: 3000, b: kadifekale },
  { id: 'bursaulu', name: 'Bursa Ulu Cami', lat: 40.183929, lon: 29.061759, ang: 6, far: 25000, b: bursaUlu },
  { id: 'mevlana', name: 'Mevlana Türbesi', lat: 37.870681, lon: 32.504969, ang: 0, far: 20000, b: mevlana },
  { id: 'devrent', name: 'Devrent peri bacaları', lat: 38.6726, lon: 34.8855, ang: 20, far: 18000, near: 2200, b: devrent },
  { id: 'celsus', name: 'Celsus Kütüphanesi', lat: 37.939187, lon: 27.340804, ang: 76, far: 12000, near: 1500, b: celsus },
  { id: 'efestiyatro', name: 'Efes Büyük Tiyatrosu', lat: 37.94130, lon: 27.34230, ang: -90, far: 20000, b: efesTiyatro },
  { id: 'pamukkale', name: 'Pamukkale travertenleri', lat: 37.924324, lon: 29.121955, ang: 0, far: 45000, near: 3500, b: pamukkale, flat: true },
  { id: 'nemrut', name: 'Nemrut Dağı', lat: 37.98063, lon: 38.740693, ang: 0, far: 40000, near: 3500, b: nemrut, flat: true },
  { id: 'sumela', name: 'Sümela Manastırı', lat: 40.690, lon: 39.658342, ang: 76, far: 30000, near: 3500, b: sumela, sumela: true },
  { id: 'yivliminare', name: 'Yivli Minare', lat: 36.886503, lon: 30.704671, ang: 0, far: 15000, near: 1800, b: yivliMinare },
  { id: 'kaleici', name: 'Kaleiçi', lat: 36.88440, lon: 30.70520, ang: 0, far: 20000, near: 2500, b: kaleici, flat: true },
];

// ---------- kurulum ----------
export function kur(W) {
  // eski basit yapıların yerini alır (İstanbul ve Kapadokya olduğu gibi kalır)
  W._landmarksAnkara = () => {}; W._landmarksIzmir = () => {};
  const st = { sites: SITES.map((s) => ({ ...s, done: false })), bridges: BRIDGES.map((b) => ({ ...b, done: false })), named: false, t: 0 };
  const mats = () => st.M || (st.M = {
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMap: W.envMap(), envMapIntensity: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.35, envMap: W.envMap(), envMapIntensity: 1.1 }),
    line: new THREE.LineBasicMaterial({ color: 0x80868c }),
  });
  for (const b of st.bridges) {
    const A = geo(b.a[0], b.a[1]), Bp = geo(b.b[0], b.b[1]);
    b.ax = A.x; b.ay = A.y; b.bx = Bp.x; b.by = Bp.y; b.len = Math.hypot(Bp.x - A.x, Bp.y - A.y); b.ux = (Bp.x - A.x) / b.len; b.uy = (Bp.y - A.y) / b.len;
    b.x = (A.x + Bp.x) / 2; b.y = (A.y + Bp.y) / 2;
  }
  for (const s of st.sites) { const p = geo(s.lat, s.lon); s.x = p.x; s.y = p.y; }
  const ready = (x, y) => W.heights && W.heights.patchReady(x, y) && W.heights.tiles.size > 0;
  const finish = (lod, ctx, near, far, shadows) => {
    const M = mats();
    const grp = (k, g, ln) => { const o = new THREE.Group(); const a = k.mesh(M.stone), b = g.mesh(M.glass); for (const m of [a, b]) if (m) { m.matrixAutoUpdate = false; if (shadows) { m.castShadow = true; m.receiveShadow = true; } o.add(m); } if (ln && ln.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(ln, 3)); o.add(new THREE.LineSegments(lg, M.line)); } return o; };
    lod.addLevel(grp(ctx.hi, ctx.hiG, ctx.lines), 0); lod.addLevel(grp(ctx.lo, ctx.loG), near); lod.addLevel(new THREE.Object3D(), far);
    W.root.add(lod);
  };
  const ctxFor = (ox, oy, h0, a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    const toW = (lx, lz) => [ox + lx * ca + lz * sa, oy + lx * sa - lz * ca];
    const hl = (lx, lz) => { const [x, y] = toW(lx, lz); return W.terrainH(x, y) - h0; };
    return {
      hi: new Kit(), lo: new Kit(), hiG: new Kit(), loG: new Kit(), lines: [], h0, toW, hl,
      minH: (r, cx = 0, cz = 0) => { let m = 1e9; for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) m = Math.min(m, hl(cx - r + i * r / 4, cz - r + j * r / 4)); return m; },
      coll: (lx, lz, r, top) => { const [x, y] = toW(lx, lz); W.lmCol.push({ x, y, r, top: h0 + top }); },
      coll0: (x, y, r, top) => W.colliders.push({ type: 'tower', x, y, r, top, name: '' }),
      loc: (lat, lon) => { const p = geo(lat, lon), dx = p.x - ox, dy = p.y - oy; return [dx * ca + dy * sa, dx * sa - dy * ca]; },
    };
  };
  const buildSite = (s) => {
    const conv = convergence(s.x, s.y); // gerçek kuzeyin ızgaradaki sapması
    let a = (s.ang || 0) * D2R - conv;
    let h0 = W.terrainH(s.x, s.y);
    if (!s.flat) { // tabanın en yüksek noktasına otur (yokuşta gömülmesin), temel aşağıya iner
      const r = 18; for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) h0 = Math.max(h0, W.terrainH(s.x + dx, s.y + dy));
    }
    if (s.hMin != null) h0 = Math.max(h0, s.hMin);
    if (s.sumela) {
      // uçurum yüzü vadiye (eğim aşağı) bakar; gerçek yükseklik ~1200 m
      const e = 300, gx = W.terrainH(s.x + e, s.y) - W.terrainH(s.x - e, s.y), gy = W.terrainH(s.x, s.y + e) - W.terrainH(s.x, s.y - e);
      const za = a - Math.PI / 2; // yerel +z yönü (açı, doğudan)
      if (Math.cos(za) * -gx + Math.sin(za) * -gy < 0) a += Math.PI;
      h0 = Math.max(h0 + 40, 1200);
    }
    const ctx = ctxFor(s.x, s.y, h0, a); s.a = a; s.h0 = h0;
    s.b(ctx);
    const lod = new THREE.LOD(); lod.position.set(s.x, h0, -s.y); lod.rotation.y = a; lod.updateMatrix();
    finish(lod, ctx, s.near || 2500, s.far || 25000, W.shadows);
  };
  const buildBridge = (B) => {
    const a = Math.atan2(B.uy, B.ux);
    const ctx = ctxFor(B.ax, B.ay, 0, a);
    bridge(ctx, B, W);
    const lod = new THREE.LOD(); lod.position.set(B.ax, 0, -B.ay); lod.rotation.y = a; lod.updateMatrix();
    finish(lod, ctx, 7000, 90000, W.shadows);
    W.decks.push({ ax: B.ax, ay: B.ay, ux: B.ux, uy: B.uy, len: B.len, w: B.W + 2, h0: B.dT, h1: B.dT, deckAt: B.deckAt, name: B.name });
    for (const c of W.colliders) if (c.name === '') c.name = B.name;
  };
  const tick = (cx, cy, all) => {
    if (!st.named && W.landmarkPos) {
      st.named = true;
      const have = new Set(W.landmarkPos.map((l) => l.id));
      for (const s of st.sites) if (!have.has(s.id)) W.landmarkPos.push({ x: s.x, y: s.y, name: s.name, id: s.id });
      for (const b of st.bridges) W.landmarkPos.push({ x: b.x, y: b.y, name: b.name, id: b.id });
    }
    for (const s of st.sites) {
      if (s.done || Math.hypot(s.x - cx, s.y - cy) > s.far + 8000 || !ready(s.x, s.y)) continue;
      s.done = true; try { buildSite(s); } catch (e) { console.warn('simge', s.id, e); }
      if (!all) return;
    }
    for (const b of st.bridges) {
      if (b.done || Math.hypot(b.x - cx, b.y - cy) > 90000 || !ready(b.ax, b.ay) || !ready(b.bx, b.by)) continue;
      b.done = true; try { buildBridge(b); } catch (e) { console.warn('köprü', b.id, e); }
      if (!all) return;
    }
  };
  const up = W.update.bind(W), prep = W.prepare.bind(W);
  W.update = (camLocal, ac) => { up(camLocal, ac); if ((st.t = (st.t + 1) % 10) === 0) tick(camLocal.x + W.O.x, -camLocal.z + W.O.y, false); };
  W.prepare = async (x, y, progress) => { const r = await prep(x, y, progress); tick(x, y, true); return r; };
  W.simgelerTR = st;
}
