// Dalaman Havalimanı (LTBS, DLM). OSM tabanları üzerine:
// - Dış Hatlar Terminali (2018): üç ayrı cam kütle, aralarında "vadiler", hepsinin üstünde kolonlarla taşınan tek bir
//   gölgelik çatı; çatıda güneş panelleri (dünyanın tümüyle çatı güneşiyle çalışan ilk terminali).
// - İç Hatlar Terminali (2006): cam kutu, üstünde havada duruyormuş gibi ince, geniş saçaklı çatı.
// - Terminal 1 (İç Hatlar): eski bina, kat bantları belirgin, çatı ışıklıkları ve güneş panelleri.
// Kule (OSM konumu), yolcu köprüleri (OSM), park etmiş uçaklar, uzak park yerlerinde merdiven araçları, apron araçları.
// Her terminal ayrı parça: ctx.parts.get('terminal:<kimlik>'); iç mekân bu gruba çocuk olarak eklenebilir.
// Bu dosyadaki yardımcılar (kabuk, kurulum, bosYer) ltfe.js ve ltfg.js tarafından da kullanılır.
import * as THREE from '../../vendor/three.module.min.js';
import { GB, centroid, inflate, obbOf, barrel, stands, standsAndAircraft } from '../havalimani.js';
import { towerModern, towerPos, jetBridges, vehicles, pip, nearestEdge } from './ortak.js';

const area = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
export const ccw = (P) => (area(P) < 0 ? P.slice().reverse() : P.slice());
const hsh = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

// yarım düzlemle kırp: n·p <= c kalan taraf
export function clipHalf(P, nx, ny, c) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const da = a[0] * nx + a[1] * ny - c, db = b[0] * nx + b[1] * ny - c;
    if (da <= 0) out.push(a);
    if ((da < 0) !== (db < 0) && da !== db) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
// tabanı uzun ekseni boyunca parçala (oranlar toplamı 1), parçalar arası boşluk gap
export function parcala(P, oran, gap) {
  const o = obbOf(P), ux = o.c, uy = o.s;
  const out = []; let a = o.a0;
  for (const r of oran) {
    const a1 = a + (o.a1 - o.a0) * r;
    let Q = clipHalf(P, -ux, -uy, -(a + (a > o.a0 ? gap / 2 : 0)));
    Q = clipHalf(Q, ux, uy, a1 - (a1 < o.a1 - 0.01 ? gap / 2 : 0));
    if (Q.length >= 3) out.push(Q);
    a = a1;
  }
  return out;
}
// eksene paralel şeritler: çokgenin içinde (kenardan en az pay kadar) kalan parçalar için cb(ortaX, ortaY, boy)
export function seritler(P, ang, step, pay, cb, minL = 6) {
  const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
  const [cx, cy] = centroid(P);
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [x, y] of P) { const a = (x - cx) * ux + (y - cy) * uy, b = (x - cx) * vx + (y - cy) * vy; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const ds = 3;
  for (let b = b0 + pay + step / 2; b < b1 - pay; b += step) {
    let run = null;
    for (let a = a0; a <= a1 + ds; a += ds) {
      const x = cx + ux * a + vx * b, y = cy + uy * a + vy * b;
      const ins = a <= a1 && pip(P, x, y) && nearestEdge(P, x, y).d > pay;
      if (ins && run === null) run = a;
      if (!ins && run !== null) {
        const L = a - ds - run;
        if (L >= minL) cb(cx + ux * (run + L / 2) + vx * b, cy + uy * (run + L / 2) + vy * b, L);
        run = null;
      }
    }
  }
}

let SOLAR = null;
function solarMat(M) {
  if (!SOLAR) SOLAR = new THREE.MeshStandardMaterial({ color: 0x1c2a44, metalness: 0.5, roughness: 0.22, envMap: M.glass.envMap, envMapIntensity: 1.0 });
  return SOLAR;
}

// ---------- terminal kabuğu ----------
// P: OSM tabanı (yerel m). opt:
//  h: çatının alt yüzü (cam üstü), fl: kat yüksekliği, ov: çatı saçağı, T: çatı kalınlığı,
//  kutle: [{P, h}] çatı altındaki cam kütleler (yoksa tek kütle P, h), bant: kat bandı kalınlığı (beton görünümü için büyük),
//  kolon: saçak kolonu aralığı (0 yok), fin: dikey cephe kanatları aralığı (0 yok), gunes: çatıda güneş panelleri,
//  isiklik: { step, w } çatı ışıklıkları, kemer: çatı üstünde beşik tonoz yüksekliği, eksen: panel/ışıklık yönü (radyan),
//  sacak: { kenarlar: [i], h, D } kara tarafı giriş saçağı (kenar i = P[i] -> P[i+1]), yol: kara tarafı yol şeridi
export function kabuk(ctx, id, ad, P0, opt = {}) {
  const { M, gh } = ctx;
  const P = ccw(P0);
  const h = opt.h || 16, fl = opt.fl || 4.5, ov = opt.ov != null ? opt.ov : 4, T = opt.T || 1.4;
  const base = Math.min(0, ...P.map(([x, y]) => gh(x, y))) - 0.6;
  const grp = new THREE.Group();
  const glass = new GB(); glass.uv = []; glass._per = 0;
  const conc = new GB(), white = new GB(), top = new GB(), solar = new GB(), hvac = new GB(), sky = new GB();
  const kutle = opt.kutle || [{ P, h }];
  const bant = opt.bant || 0.5;
  for (const k of kutle) {
    const Q = ccw(k.P), hk = k.h;
    glass._per = 0; glass.prism(Q, base, hk, false);
    // kat bantları (döşeme alınları) cepheden biraz dışarıda: gerçek hacim
    const R = inflate(Q, 0.35);
    for (let z = fl; z < hk - 1.5; z += fl) conc.prism(R, z - bant, z, false, true);
    conc.prism(inflate(Q, 0.2), base, 0.5, false);   // zemin şeridi
    if (k.cati) { white.prism(inflate(Q, 0.4), hk, hk + 1.0, true); }
    // dikey kanatlar
    if (opt.fin) for (let i = 0; i < Q.length; i++) {
      const [ax, ay] = Q[i], [bx, by] = Q[(i + 1) % Q.length];
      const L = Math.hypot(bx - ax, by - ay); if (L < opt.fin * 1.5) continue;
      const ang = Math.atan2(by - ay, bx - ax), nx = (by - ay) / L, ny = -(bx - ax) / L;
      const n = Math.floor(L / opt.fin);
      for (let j = 1; j < n; j++) { const t = j / n; white.box(ax + (bx - ax) * t + nx * 0.55, ay + (by - ay) * t + ny * 0.55, base, 0.3, 1.0, hk - base, ang); }
    }
  }
  for (let k = 0; k < glass.uv.length; k += 2) { glass.uv[k] /= 3.0; glass.uv[k + 1] = (glass.uv[k + 1] - base) / fl; }
  // çatı: alt ve alın beyaz, üst yüzey gri
  const R = opt.roofP ? ccw(opt.roofP) : (ov > 0 ? inflate(P, ov) : P);
  white.prism(R, h, h + T, false, true);
  top.poly([R], h + T);
  // parapet (çatı kenarında alçak duvar)
  const Rin = inflate(R, -0.4);
  if (opt.parapet !== false) for (let i = 0; i < R.length; i++) {
    const [ax, ay] = R[i], [bx, by] = R[(i + 1) % R.length], [cx, cy] = Rin[(i + 1) % R.length], [dx, dy] = Rin[i];
    white.prism([[ax, ay], [bx, by], [cx, cy], [dx, dy]], h + T, h + T + 0.9, true);
  }
  // saçak kolonları
  if (opt.kolon && ov > 2) {
    const C = inflate(P, ov - 1.5);
    for (let i = 0; i < C.length; i++) {
      const [ax, ay] = C[i], [bx, by] = C[(i + 1) % C.length];
      const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / opt.kolon));
      for (let j = 0; j < n; j++) { const t = j / n; const x = ax + (bx - ax) * t, y = ay + (by - ay) * t; white.lathe(x, y, [[0.45, 0], [0.45, h - gh(x, y) + 0.7]], 8, gh(x, y) - 0.3); }
    }
  }
  const o = obbOf(P);
  const ax = opt.eksen != null ? opt.eksen : o.ang;
  const roofTop = h + T;
  // çatı ışıklıkları (cam sırtlar)
  if (opt.isiklik) seritler(R, ax, opt.isiklik.step || 30, 8, (x, y, L) => {
    sky.box(x, y, roofTop, L, opt.isiklik.w || 4, 1.2, ax);
    white.box(x, y, roofTop, L + 0.8, (opt.isiklik.w || 4) + 0.8, 0.4, ax);
  }, 15);
  // beşik tonoz
  if (opt.kemer) barrel(top, { ...o, L: o.L * 0.9, Wd: o.Wd * 0.86 }, roofTop, roofTop + opt.kemer, 12);
  // güneş panelleri: sıralar (2.2 m) ve aralarında bakım yolu
  if (opt.gunes) {
    const Rg = inflate(R, -2.5);
    seritler(Rg, ax, opt.gunes.step || 4.2, 1.0, (x, y, L) => {
      // 60 m'lik parçalar (gölge ve kırpma için)
      const n = Math.ceil(L / 60), ux = Math.cos(ax), uy = Math.sin(ax);
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n - 0.5, l = L / n - 1.2;
        solar.box(x + ux * L * t, y + uy * L * t, roofTop + 0.35, l, 2.3, 0.18, ax);
        conc.box(x + ux * L * t, y + uy * L * t, roofTop, l, 0.25, 0.35, ax);
      }
    }, 8);
  }
  // çatı cihazları (iklimlendirme kutuları)
  const nh = opt.cihaz != null ? opt.cihaz : Math.min(10, Math.round(Math.abs(area(P)) / 4000));
  for (let k = 0, tries = 0; k < nh && tries < 200; tries++) {
    const x = o.cx + (hsh(tries, k + 1) - 0.5) * o.L * 0.8 * o.c - (hsh(k + 3, tries) - 0.5) * o.Wd * 0.7 * o.s;
    const y = o.cy + (hsh(tries, k + 1) - 0.5) * o.L * 0.8 * o.s + (hsh(k + 3, tries) - 0.5) * o.Wd * 0.7 * o.c;
    if (!pip(R, x, y) || nearestEdge(R, x, y).d < 8) continue;
    hvac.box(x, y, roofTop, 6 + 6 * hsh(x, y), 4, 2.2, ax); k++;
  }
  // kara tarafı giriş saçağı (ince ama hacimli levha, kolonlu) ve yol
  const road = new GB([['tw', 2]]);
  if (opt.sacak) {
    const s = opt.sacak, hs = s.h || 7.5, D = s.D || 12;
    for (const i of s.kenarlar) {
      const [ax0, ay0] = P[i % P.length], [bx0, by0] = P[(i + 1) % P.length];
      const L = Math.hypot(bx0 - ax0, by0 - ay0); if (L < 10) continue;
      const ux = (bx0 - ax0) / L, uy = (by0 - ay0) / L, nx = uy, ny = -ux;
      const ang = Math.atan2(uy, ux), mx = (ax0 + bx0) / 2, my = (ay0 + by0) / 2;
      const off = Math.max(0, ov - 0.5);
      white.box(mx + nx * (off + D / 2), my + ny * (off + D / 2), hs, L * 0.92, D, 0.8, ang);
      const n = Math.max(2, Math.round(L * 0.92 / 16));
      for (let j = 0; j <= n; j++) { const t = (j / n - 0.5) * L * 0.9; const x = mx + ux * t + nx * (off + D - 1.2), y = my + uy * t + ny * (off + D - 1.2); white.lathe(x, y, [[0.3, 0], [0.3, hs - gh(x, y) + 0.4]], 8, gh(x, y) - 0.3); }
      if (s.yol !== false) {
        const r0 = off + D + 1, r1 = r0 + 14, ext = 40;
        const hr = Math.max(0, gh(mx + nx * r0, my + ny * r0), gh(mx + nx * r1, my + ny * r1)) + 0.1;
        const A = [mx - ux * (L / 2 + ext) + nx * (r0 + r1) / 2, my - uy * (L / 2 + ext) + ny * (r0 + r1) / 2], B = [mx + ux * (L / 2 + ext) + nx * (r0 + r1) / 2, my + uy * (L / 2 + ext) + ny * (r0 + r1) / 2];
        road.ribbon([A, B], r1 - r0, hr, () => ({ tw: [9, 4] }));
        // kaldırım (yükseltilmiş beton)
        conc.box(mx + nx * (off + D / 2), my + ny * (off + D / 2), gh(mx, my) - 0.2, L + 10, D + 2, 0.4, ang);
      }
    }
  }
  const mk = (gb, mat, name) => { if (!gb.count) return null; const m = new THREE.Mesh(gb.geometry(), mat); m.name = name; m.matrixAutoUpdate = false; grp.add(m); return m; };
  mk(glass, M.glass, 'cephe'); mk(conc, M.conc, 'kat'); mk(white, M.white, 'cati'); mk(top, M.roof, 'cati-ust');
  mk(solar, solarMat(M), 'ayrinti-gunes'); mk(hvac, M.metal, 'ayrinti-cihaz'); mk(sky, M.glass, 'ayrinti-isiklik');
  if (road.count) { const m = new THREE.Mesh(road.geometry(), M.taxi); m.name = 'yol'; m.renderOrder = 1; m.matrixAutoUpdate = false; ctx.grp.add(m); }
  grp.userData = { id, ad, taban: P, yukseklik: h + T, katYuksekligi: fl, kotu: base };
  grp.matrixAutoUpdate = false;
  return ctx.part('terminal:' + id, grp);
}

// kara tarafı kenarları: apron (park yerleri) tarafına bakmayan, en az minL uzunluğundaki kenarlar
export function karaKenarlari(P0, S, minL = 40) {
  const P = ccw(P0);
  let sx = 0, sy = 0; for (const s of S) { sx += s.x; sy += s.y; } sx /= S.length || 1; sy /= S.length || 1;
  const [cx, cy] = centroid(P);
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
    const L = Math.hypot(bx - ax, by - ay); if (L < minL) continue;
    const nx = (by - ay) / L, ny = -(bx - ax) / L;
    if (nx * (sx - cx) + ny * (sy - cy) < 0) out.push(i);
  }
  return out;
}

// apron, taksi yolu, pist ve binalardan uzak boş yer (kule vb. için): (x, y) çevresinde sarmal arama
export function bosYer(d, x, y, pay = 25) {
  const ok = (px, py) => {
    for (const pl of d.apron) if (pip(pl[0], px, py) || nearestEdge(pl[0], px, py).d < pay) return false;
    for (const t of d.twy) for (let k = 0; k < t.p.length - 1; k++) {
      const [ax, ay] = t.p[k], [bx, by] = t.p[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
      if (Math.hypot(ax + dx * u - px, ay + dy * u - py) < t.w / 2 + pay) return false;
    }
    for (const r of d.rws) {
      const dx = r.b[0] - r.a[0], dy = r.b[1] - r.a[1], L2 = dx * dx + dy * dy;
      const u = Math.max(0, Math.min(1, ((px - r.a[0]) * dx + (py - r.a[1]) * dy) / L2));
      if (Math.hypot(r.a[0] + dx * u - px, r.a[1] + dy * u - py) < r.w / 2 + 120) return false;
    }
    for (const b of d.bina) if (pip(b.p, px, py) || nearestEdge(b.p, px, py).d < 15) return false;
    return true;
  };
  for (let r = 0; r < 400; r += 10) for (let k = 0; k < Math.max(1, r / 5); k++) {
    const a = k / Math.max(1, r / 5) * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (ok(px, py)) return { x: px, y: py };
  }
  return { x, y };
}

// ---------- merdiven araçları, bagaj arabaları, yer güç üniteleri (tek örgü, köşe renkli) ----------
export function yerAraclari(ctx, S, opt = {}) {
  const { d } = ctx;
  const gb = new GB([['color', 3]]);
  const col = (s, c) => { const v = gb.a.color.v; for (let k = s; k < gb.count; k++) { v[k * 3] = c[0]; v[k * 3 + 1] = c[1]; v[k * 3 + 2] = c[2]; } };
  const box = (x, y, h0, w, dd, hh, ang, c) => { const s = gb.count; gb.box(x, y, h0, w, dd, hh, ang); col(s, c); };
  const ends = d.kopru.map((k) => k[k.length - 1]);
  const WHITE = [0.9, 0.9, 0.88], YEL = [0.92, 0.72, 0.1], GREY = [0.45, 0.47, 0.5], DARK = [0.16, 0.17, 0.19], BLUE = [0.2, 0.32, 0.55];
  // merdiven: kamyonet + basamaklı rampa (kapıdan aşağı)
  const stair = (x, y, out, ang, topH) => {
    const ox = Math.cos(out), oy = Math.sin(out);
    // basamaklar: kapı eşiğinden dışarı doğru 6 adım
    const n = 6, run = 6.5;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, z = topH * (1 - (k + 1) / n) + 0.9 * ((k + 1) / n);
      box(x + ox * (0.8 + run * t), y + oy * (0.8 + run * t), z, run / n + 0.05, 1.6, 0.35, out, WHITE);
    }
    box(x + ox * 0.6, y + oy * 0.6, topH - 0.1, 1.4, 1.8, 0.2, out, WHITE);                      // sahanlık
    box(x + ox * 4.8, y + oy * 4.8, 0.35, 7.5, 2.3, 0.9, out, GREY);                                // şasi
    box(x + ox * 7.6, y + oy * 7.6, 0.35, 2.2, 2.3, 2.2, out, opt.renk || YEL);                      // kabin
    box(x + ox * 7.9, y + oy * 7.9, 1.6, 0.4, 2.0, 0.8, out, DARK);                                 // ön cam
  };
  let n = 0;
  for (const s of S) {
    if (!s.ac) continue;
    const a = s.ac, sc = a.sc, hx = a.hx, hy = a.hy, lx = -hy, ly = hx;
    const nose = [a.x + hx * a.L / 2, a.y + hy * a.L / 2];
    const door = [nose[0] - hx * 6 * sc + lx * 2.0 * sc, nose[1] - hy * 6 * sc + ly * 2.0 * sc];
    let bridged = !!s.kopru;
    if (opt.kopru === true) for (const e of ends) if (Math.hypot(e[0] - door[0], e[1] - door[1]) < 16 * sc) bridged = true;
    const r = hsh(s.x * 0.37, s.y * 0.71);
    const outL = Math.atan2(ly, lx);
    if (!bridged) {
      stair(door[0], door[1], outL, 3.4 * sc, 0);
      if (r > 0.35) { const rd = [a.x - hx * (a.L / 2 - 5 * sc) + lx * 2.0 * sc, a.y - hy * (a.L / 2 - 5 * sc) + ly * 2.0 * sc]; stair(rd[0], rd[1], outL, 3.5 * sc, 0); }
    }
    // sağ tarafta bagaj treni (çekici + 3 araba) ya da bant yükleyici
    const rx = -lx, ry = -ly;
    if (r < 0.6) {
      const bx = a.x + hx * 4 * sc + rx * 9, by = a.y + hy * 4 * sc + ry * 9, ang = Math.atan2(hy, hx);
      box(bx, by, 0.3, 3, 1.7, 1.4, ang, DARK);
      for (let k = 1; k <= 3; k++) box(bx - hx * k * 3.6, by - hy * k * 3.6, 0.45, 3, 1.6, 1.3, ang, k === 2 ? BLUE : GREY);
      n++;
    }
    if (r > 0.25) {   // bant yükleyici: ön kargo kapısına eğik bant
      const cx = a.x + hx * 7 * sc + rx * 3.5 * sc, cy = a.y + hy * 7 * sc + ry * 3.5 * sc, ang = Math.atan2(ry, rx);
      box(cx + rx * 3, cy + ry * 3, 0.3, 6, 1.6, 0.9, ang, GREY);
      for (let k = 0; k < 4; k++) box(cx + rx * (0.8 + k * 1.5), cy + ry * (0.8 + k * 1.5), 2.4 - k * 0.45, 1.6, 1.0, 0.25, ang, DARK);
    }
    // yer güç ünitesi (burnun önünde değil, sağ önünde)
    if (r > 0.5) box(nose[0] - hx * 3 + rx * 6, nose[1] - hy * 3 + ry * 6, 0.25, 2.6, 1.6, 1.5, Math.atan2(hy, hx), WHITE);
    if (++n > 400) break;
  }
  if (!gb.count) return;
  const m = new THREE.Mesh(gb.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.name = 'apron-araclari'; m.matrixAutoUpdate = false; ctx.grp.add(m);
}

// ---------- yolcu köprüleri: OSM çizgisini izler ----------
// Çok parçalı çizgide son parça hareketli (teleskop) köprü, öncekiler kolonlu sabit cam koridor, aradaki köşede döner
// gövde (rotunda). Tek parçalıda rotunda terminal tarafında. Köprü ucu yakındaki park etmiş uçağın ön kapısına oturtulur.
export function kopruler(ctx, S) {
  const { d, M, gh } = ctx;
  const tube = new GB(), glass = new GB(), white = new GB(), dark = new GB();
  glass.uv = []; glass._per = 0;
  const doors = [];
  for (const s of S) if (s.ac) {
    const a = s.ac, sc = a.sc, lx = -a.hy, ly = a.hx;
    const nx = a.x + a.hx * a.L / 2, ny = a.y + a.hy * a.L / 2;
    doors.push({ s, x: nx - a.hx * 6 * sc + lx * 2.0 * sc, y: ny - a.hy * 6 * sc + ly * 2.0 * sc, lx, ly, sc, used: false });
  }
  const H0 = 4.6;     // sabit koridor ve rotunda döşemesi
  for (const line of d.kopru) {
    let pts = line.slice();
    // çok kısa parçaları birleştir
    pts = pts.filter((p, i) => i === 0 || i === pts.length - 1 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 6);
    if (pts.length < 2) continue;
    let end = pts[pts.length - 1], sill = 2.6;
    // ucu en yakın boş kapıya oturt
    let best = null, bd = 22;
    for (const dr of doors) { if (dr.used) continue; const q = Math.hypot(dr.x - end[0], dr.y - end[1]); if (q < bd) { bd = q; best = dr; } }
    if (best) { best.used = true; best.s.kopru = true; end = [best.x + best.lx * 1.6 * best.sc, best.y + best.ly * 1.6 * best.sc]; sill = 2.35 * best.sc; }
    let rot;   // rotunda noktası
    if (pts.length > 2) {
      rot = pts[pts.length - 2];
      // sabit koridor (cam yanlar, beyaz döşeme ve çatı)
      for (let k = 0; k < pts.length - 2; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        glass.box(mx, my, H0, L, 2.9, 2.8, ang);
        white.box(mx, my, H0 - 0.5, L + 0.4, 3.3, 0.5, ang);
        white.box(mx, my, H0 + 2.8, L + 0.4, 3.4, 0.45, ang);
        const n = Math.max(1, Math.round(L / 16));
        for (let j = 0; j <= n; j++) { const t = j / n; if (k === 0 && j === 0) continue; const x = ax + (bx - ax) * t, y = ay + (by - ay) * t; for (const sd of [-1, 1]) { const ox = -Math.sin(ang) * 1.3 * sd, oy = Math.cos(ang) * 1.3 * sd; white.lathe(x + ox, y + oy, [[0.22, 0], [0.22, H0 - 0.5 - gh(x, y) + 0.3]], 6, gh(x, y) - 0.3); } }
      }
    } else {
      // tek parça: rotunda terminal cephesinden 3 m açıkta
      const [ax, ay] = pts[0], [bx, by] = pts[1], L = Math.hypot(bx - ax, by - ay) || 1;
      rot = [ax + (bx - ax) / L * 3, ay + (by - ay) / L * 3];
      glass.box((ax + rot[0]) / 2, (ay + rot[1]) / 2, H0, 3.2, 2.9, 2.8, Math.atan2(by - ay, bx - ax));
    }
    // rotunda: kolon üstünde silindir
    const g0 = gh(rot[0], rot[1]);
    white.lathe(rot[0], rot[1], [[0.7, 0], [0.7, H0 - g0]], 10, g0 - 0.3);
    tube.lathe(rot[0], rot[1], [[2.5, 0], [2.5, 3.1]], 14, H0 - 0.2);
    white.lathe(rot[0], rot[1], [[2.7, 0], [2.7, 0.4], [0.05, 0.6]], 14, H0 + 2.9);
    // teleskop: üç iç içe kutu, döşeme rotundadan kapı eşiğine iner
    const L = Math.hypot(end[0] - rot[0], end[1] - rot[1]); if (L < 5) continue;
    const ux = (end[0] - rot[0]) / L, uy = (end[1] - rot[1]) / L, ang = Math.atan2(uy, ux);
    const s0 = 2.2, s1 = L - 3.2;   // tünel rotunda kenarından kabin arkasına
    const seg = [[0, 0.40, 3.5, 3.0], [0.33, 0.70, 3.3, 2.85], [0.64, 1.0, 3.1, 2.7]];
    for (const [t0, t1, w, hh] of seg) {
      const a = s0 + (s1 - s0) * t0, b = s0 + (s1 - s0) * t1, run = b - a;
      const za = H0 + (sill - H0) * t0, zb = H0 + (sill - H0) * t1;
      slopedBox(tube, rot[0] + ux * (a + b) / 2, rot[1] + uy * (a + b) / 2, za, zb, run, w, hh, ang);
    }
    // kabin ve körük
    const cx = rot[0] + ux * (L - 1.6), cy = rot[1] + uy * (L - 1.6);
    tube.box(cx, cy, sill - 0.1, 3.0, 3.9, 3.1, ang);
    dark.box(rot[0] + ux * (L - 0.15), rot[1] + uy * (L - 0.15), sill, 0.5, 3.4, 2.7, ang);
    // sürüş ayağı ve tekerlek
    const fx = rot[0] + ux * (s0 + (s1 - s0) * 0.72), fy = rot[1] + uy * (s0 + (s1 - s0) * 0.72);
    const zf = H0 + (sill - H0) * 0.72, gf = gh(fx, fy);
    for (const sd of [-1, 1]) dark.box(fx - uy * 1.1 * sd, fy + ux * 1.1 * sd, gf, 0.35, 0.35, zf - gf, ang);
    dark.box(fx, fy, gf, 1.5, 3.2, 0.9, ang);
    dark.box(fx, fy, zf - 0.6, 0.8, 3.0, 0.6, ang);
  }
  for (let k = 0; k < glass.uv.length; k += 2) { glass.uv[k] /= 1.6; glass.uv[k + 1] = 0.3; }
  const grp = new THREE.Group(); grp.name = 'yolcu-kopruleri'; grp.matrixAutoUpdate = false;
  for (const [gb, mat] of [[tube, M.metal], [glass, M.glass], [white, M.white], [dark, M.dark]]) if (gb.count) { const m = new THREE.Mesh(gb.geometry(), mat); m.matrixAutoUpdate = false; grp.add(m); }
  ctx.grp.add(grp);
}
// eğimli kutu: merkez (x, y), boy run (ang yönünde), arka taban za, ön taban zb
function slopedBox(gb, x, y, za, zb, run, w, hh, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = [[-run / 2, -w / 2], [run / 2, -w / 2], [run / 2, w / 2], [-run / 2, w / 2]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
  const zb0 = [za, zb, zb, za];
  const v = (i, top) => [P[i][0], zb0[i] + (top ? hh : 0), P[i][1]];
  const face = (a, b, cc, dd, nx, ny, nz) => { const k = gb.count; for (const q of [a, b, cc, dd]) gb.vert(q[0], q[1], q[2], nx, ny, nz); gb.quad(k, k + 1, k + 2, k + 3); };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, ex = P[j][0] - P[i][0], ey = P[j][1] - P[i][1], L = Math.hypot(ex, ey) || 1;
    face(v(i, 0), v(j, 0), v(j, 1), v(i, 1), ey / L, 0, -ex / L);
  }
  face(v(0, 1), v(1, 1), v(2, 1), v(3, 1), 0, 1, 0);
  face(v(3, 0), v(2, 0), v(1, 0), v(0, 0), 0, -1, 0);
}

// apron projektör direkleri (park yerlerinin arkasında, apron kenarı boyunca)
export function projektorler(ctx, S, opt = {}) {
  const gb = new GB(), lamp = new GB();
  const H = opt.H || 25, aral = opt.aral || 110;
  const done = [];
  for (const s of S) {
    if (!s.ac || s.pt) continue;
    // park yerinin önü (terminal tarafı) değil, kuyruk tarafında, iki park yerinin arasında
    const lx = -s.ac.hy, ly = s.ac.hx;
    const x = s.x + lx * (s.ac.sc * 20), y = s.y + ly * (s.ac.sc * 20);
    if (done.some(([px, py]) => Math.hypot(px - x, py - y) < aral)) continue;
    const g = ctx.gh(x, y);
    done.push([x, y]);
    gb.lathe(x, y, [[0.45, 0], [0.25, H]], 6, g - 0.3);
    lamp.box(x, y, g + H, 3.2, 1.0, 1.4, Math.atan2(s.ac.hy, s.ac.hx));
  }
  const grp = new THREE.Group(); grp.name = 'donanim-projektor'; grp.matrixAutoUpdate = false;
  for (const [b, mat] of [[gb, ctx.M.metal], [lamp, ctx.M.dark]]) if (b.count) { const m = new THREE.Mesh(b.geometry(), mat); m.matrixAutoUpdate = false; grp.add(m); }
  ctx.grp.add(grp);
}

// uzakta terminal ayrıntılarını (güneş paneli, cihazlar, ışıklıklar) gizle
export function ayrintiLOD(ctx, R = 6000) {
  const prev = ctx.tick;
  let f = 0;
  ctx.tick = (cam) => {
    if (prev) prev(cam);
    if (f++ % 20) return;
    const dd = Math.hypot(ctx.d.x - cam.x, ctx.d.y - cam.y, Math.max(0, cam.h - ctx.d.elev) * 0.7);
    for (const [id, g] of ctx.parts) if (id.startsWith('terminal:')) for (const c of g.children) if (c.name.startsWith('ayrinti')) c.visible = dd < R;
  };
}

// standart sıra: park yerleri ve uçaklar, terminaller (cb), köprüler, araçlar
// opt.kopru: 'osm' (kopruler), false (köprü yok), başka (ortak.js jetBridges)
export function kurulum(ctx, opt, terminaller) {
  const { d } = ctx;
  const S = stands(d);
  ctx.stands = S;
  const terms = terminaller(S) || [];
  standsAndAircraft(ctx, { occ: opt.occ != null ? opt.occ : 0.6 });
  if (opt.kopru === 'osm') kopruler(ctx, S); else if (opt.kopru !== false) jetBridges(ctx, terms, S);
  vehicles(ctx, S);
  yerAraclari(ctx, S, opt);
  if (opt.projektor !== false) projektorler(ctx, S, opt.projektor || {});
  ayrintiLOD(ctx);
  return S;
}

// OSM terminal tabanını adına göre bul
export function osmTerminal(d, re) {
  for (const b of d.bina) if (b.t === 'terminal' && re.test(b.n || '')) return b;
  return null;
}

export function build(ctx) {
  const { d } = ctx;
  kurulum(ctx, { occ: 0.6, kopru: 'osm' }, (S) => {
    const terms = [];
    const t2 = osmTerminal(d, /Dış Hatlar/), ic = osmTerminal(d, /^Dalaman İç Hatlar/), t1 = osmTerminal(d, /Terminal 1/);
    if (t2) {
      // üç kütle ve aralarında 9 m'lik vadiler; tek gölgelik çatı 23 m'de
      const P = ccw(t2.p);
      const parts = parcala(P, [0.36, 0.30, 0.34], 9);
      const hs = [15, 19, 13.5];
      kabuk(ctx, 'dis-hatlar', 'Dış Hatlar Terminali', P, {
        h: 23, T: 1.8, ov: 9, fl: 5, kolon: 18, kutle: parts.map((Q, i) => ({ P: Q, h: hs[i], cati: true })),
        gunes: { step: 4.2 }, cihaz: 0, sacak: { kenarlar: karaKenarlari(P, S, 100), h: 8, D: 10 },
      });
      terms.push(P);
    }
    if (ic) {
      const P = ccw(ic.p);
      kabuk(ctx, 'ic-hatlar', 'İç Hatlar Terminali', P, { h: 13, T: 1.0, ov: 7, fl: 4.5, kolon: 15, gunes: { step: 4.2 }, sacak: { kenarlar: karaKenarlari(P, S, 40), h: 6.5, D: 8, yol: false } });
      terms.push(P);
    }
    if (t1) {
      const P = ccw(t1.p);
      kabuk(ctx, 'terminal-1', 'Terminal 1 (İç Hatlar)', P, { h: 14, T: 1.4, ov: 3, fl: 4.6, bant: 1.6, isiklik: { step: 34, w: 5 }, gunes: { step: 4.2 }, sacak: { kenarlar: karaKenarlari(P, S, 60), h: 7, D: 11 } });
      terms.push(P);
    }
    return terms;
  });
  // kule: OSM'deki tek kule (40 m) iki terminal arasında
  const t = towerPos(d, { x: -52, y: 853, h: 40 });
  towerModern(ctx, t.x, t.y, Math.max(42, t.h || 0), 0.28);
}
