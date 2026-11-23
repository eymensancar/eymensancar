// Haritalar: sağ üstteki küçük harita (kuzey yukarıda) ve büyük Türkiye haritası (N / HARİTA).
//
// Küçük harita
// - Yakınlaştırma kesintisiz: görünen genişlik yerden yüksekliğe ve yer hızına göre 4 km ile 160 km arasında
//   yumuşakça değişir (logaritmik). İstanbul'a özel ayrı bir harita kipi yok; aynı harita her ölçekte çizilir.
// - Zemin: Türkiye kabartma haritası (data/tr/harita.webp, 1 km/piksel). İstanbul'da bunun üstüne aynı renklerde,
//   kıyıları İstanbul kara/su maskesinden (14 m/piksel) alınmış ayrıntılı bir katman biner; kenarları 1.5 km boyunca
//   saydamlaşır, geçiş görünmez.
// - Yollar: bina paketlerindeki yol bölümü (otoyol ... üçüncül, bağlantı). Paketler zaten bina işçisine gönderilirken
//   yol kısmının kopyası burada (ana iş parçacığında, parça parça) çözülür. Ölçek büyüdükçe yalnız büyük yollar.
// - Havalimanları: bütün pistler (hava.json), yakındakilerin taksi yolları ve apronları (hava/h_*.json gelince).
// - Çizim: zemin, yollar ve havalimanları ekrandan büyük bir ara tuvale çizilir; her karede yalnız o tuval kaydırılıp
//   ölçeklenerek kopyalanır. Uçak kenara yaklaşınca ya da ölçek %13'ten çok değişince ara tuval yeniden çizilir.
//   Kaynak dikdörtgeni hiçbir zaman resmin dışına taşmaz (Safari taşan drawImage'ı hiç çizmiyordu: "harita boş").
// - Tuval boyu CSS boyu × cihaz piksel oranı (en çok 3): telefonda da net.
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const SPAN_MIN = 4000, SPAN_MAX = 160000;
const ROAD_W = [0, 1.7, 1.45, 1.15, 0.85, 0.7, 0.7];                       // CSS px
const ROAD_C = ['', '#f08a3c', '#f6b24a', '#fde08c', 'rgba(252,248,236,.8)', 'rgba(248,244,232,.6)', 'rgba(246,194,122,.8)'];

// İstenen dünya dikdörtgenini (x0,y0,x1,y1; y kuzey) bir resimden, kaynağı resmin içinde kalacak biçimde çizer.
// img dünyada [ix0, iy0, ix1, iy1] alanını kaplar. map: dünya -> tuval (u = ox + x*k, v = oy - y*k).
function drawClipped(g, img, ix0, iy0, ix1, iy1, vx0, vy0, vx1, vy1, ox, oy, k) {
  const x0 = Math.max(ix0, vx0), x1 = Math.min(ix1, vx1), y0 = Math.max(iy0, vy0), y1 = Math.min(iy1, vy1);
  if (x1 <= x0 || y1 <= y0) return;
  const W = img.width, H = img.height, sx = W / (ix1 - ix0), sy = H / (iy1 - iy0);
  let s0 = (x0 - ix0) * sx, s1 = (x1 - ix0) * sx, t0 = (iy1 - y1) * sy, t1 = (iy1 - y0) * sy;
  s0 = clamp(s0, 0, W); s1 = clamp(s1, 0, W); t0 = clamp(t0, 0, H); t1 = clamp(t1, 0, H);
  if (s1 - s0 < 0.01 || t1 - t0 < 0.01) return;
  // hedef, kırpılmış kaynağın dünyadaki karşılığından
  const wx0 = ix0 + s0 / sx, wx1 = ix0 + s1 / sx, wy1 = iy1 - t0 / sy, wy0 = iy1 - t1 / sy;
  g.drawImage(img, s0, t0, s1 - s0, t1 - t0, ox + wx0 * k, oy - wy1 * k, (wx1 - wx0) * k, (wy1 - wy0) * k);
}

// ---------- yollar: bina paketlerinin yol bölümü ----------
class Roads {
  constructor(world) {
    this.world = world; this.packs = new Map(); this.ver = 0; this.queue = [];
    const B = world.buildings;
    if (!B || !B.worker) return;
    this.meta = new Map((B.packs || []).map((p) => [p.id, p]));
    // paket işçiye aktarılmadan önce yol kısmının kopyasını al (buildings.js'e dokunmadan)
    const w = B.worker, pm = w.postMessage.bind(w);
    w.postMessage = (m, tr) => {
      if (m && m.type === 'pack' && m.buf) { try { this._take(m.id, m.buf); } catch (e) { console.warn('Harita yolları', e); } }
      return tr ? pm(m, tr) : pm(m);
    };
  }
  _take(id, buf) {
    const dv = new DataView(buf);
    if (dv.getUint8(3) !== 52) return;                 // 'YKB4' değilse yol yok
    const x0 = dv.getFloat64(8, true), y0 = dv.getFloat64(16, true);
    const ncx = dv.getUint16(24, true), ncy = dv.getUint16(26, true), CH = dv.getFloat32(28, true);
    const rtbl = dv.getUint32(32, true);
    if (!rtbl || rtbl >= buf.byteLength) return;
    const P = { id, x0, y0, ncx, ncy, CH, dv: new DataView(buf.slice(rtbl)), chunks: new Array(ncx * ncy), next: 0, done: false };
    P.x1 = x0 + ncx * CH; P.y1 = y0 + ncy * CH;
    this.packs.set(id, P);
    this.queue.push(P);
    this._evict();
    if (!this._busy) { this._busy = true; setTimeout(() => this._work(), 0); }
  }
  _evict() {
    if (this.packs.size <= 14) return;
    const c = this.at || { x: 0, y: 0 };
    let far = null, fd = -1;
    for (const P of this.packs.values()) { const d = Math.hypot((P.x0 + P.x1) / 2 - c.x, (P.y0 + P.y1) / 2 - c.y); if (d > fd) { fd = d; far = P; } }
    if (far) { this.packs.delete(far.id); this.queue = this.queue.filter((q) => q !== far); this.ver++; }
  }
  // parça parça çöz: her adımda en çok ~5 ms
  _work() {
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < 5) {
      const P = this.queue[0];
      for (let n = 0; n < 64 && P.next < P.chunks.length; n++) P.chunks[P.next] = this._chunk(P, P.next++);
      if (P.next >= P.chunks.length) { P.done = true; P.dv = null; this.queue.shift(); this.ver++; }
    }
    if (this.queue.length) setTimeout(() => this._work(), 16); else this._busy = false;
  }
  _chunk(P, k) {
    const dv = P.dv, ci = k % P.ncx, cj = (k / P.ncx) | 0;
    let p = P.ncx * P.ncy * 6 + dv.getUint32(k * 6, true);
    const cnt = dv.getUint16(k * 6 + 4, true);
    if (!cnt) return null;
    const ox = P.x0 + ci * P.CH, oy = P.y0 + cj * P.CH, out = [];
    for (let r = 0; r < cnt; r++) {
      const t = dv.getUint8(p), n = dv.getUint8(p + 1);
      let x = dv.getInt16(p + 2, true), y = dv.getInt16(p + 4, true); p += 6;
      const pts = new Float32Array(n * 2); pts[0] = ox + x / 2; pts[1] = oy + y / 2;
      for (let i = 1; i < n; i++) {
        let dx = dv.getInt8(p), dy;
        if (dx === -128) { dx = dv.getInt16(p + 1, true); dy = dv.getInt16(p + 3, true); p += 5; } else { dy = dv.getInt8(p + 1); p += 2; }
        x += dx; y += dy; pts[i * 2] = ox + x / 2; pts[i * 2 + 1] = oy + y / 2;
      }
      const cls = t & 15;
      if (cls >= 1 && cls <= 6) out.push({ cls, pts });
    }
    return out.length ? out : null;
  }
  // görünen dikdörtgendeki yollar, sınıf sınıf çizilir (küçükten büyüğe)
  draw(g, vx0, vy0, vx1, vy1, ox, oy, k, maxCls, d, wm = 1) {
    if (!maxCls) return;
    const vis = [];
    for (const P of this.packs.values()) {
      if (P.x1 < vx0 || P.x0 > vx1 || P.y1 < vy0 || P.y0 > vy1) continue;
      const i0 = clamp(Math.floor((vx0 - P.x0) / P.CH) - 1, 0, P.ncx - 1), i1 = clamp(Math.floor((vx1 - P.x0) / P.CH) + 1, 0, P.ncx - 1);
      const j0 = clamp(Math.floor((vy0 - P.y0) / P.CH) - 1, 0, P.ncy - 1), j1 = clamp(Math.floor((vy1 - P.y0) / P.CH) + 1, 0, P.ncy - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = P.chunks[j * P.ncx + i]; if (c) vis.push(c); }
    }
    if (!vis.length) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const order = [6, 5, 4, 3, 2, 1].filter((c) => c <= maxCls);
    // önce koyu kenar (büyük yollar), sonra dolgu
    for (const pass of [0, 1]) {
      for (const cls of order) {
        if (pass === 0 && cls > 2) continue;
        g.beginPath();
        let any = false;
        for (const c of vis) for (const r of c) {
          if (r.cls !== cls) continue;
          const q = r.pts; g.moveTo(ox + q[0] * k, oy - q[1] * k);
          for (let i = 2; i < q.length; i += 2) g.lineTo(ox + q[i] * k, oy - q[i + 1] * k);
          any = true;
        }
        if (!any) continue;
        const w = ROAD_W[cls] * d * wm;
        if (pass === 0) { g.strokeStyle = 'rgba(70,45,20,.55)'; g.lineWidth = w + 0.9 * d; } else { g.strokeStyle = ROAD_C[cls]; g.lineWidth = w; }
        g.stroke();
      }
    }
  }
}

// ---------- küçük harita ----------
export class MiniMap {
  constructor(world, canvas) {
    this.world = world; this.cv = canvas; this.g = canvas.getContext('2d');
    this.span = 0; this.tSpan = 12000; this.fixed = 0; this.last = null; this.t = 0;
    this.cache = document.createElement('canvas'); this.cg = this.cache.getContext('2d');
    this.cs = null;           // ara tuvalin durumu {cx, cy, k, S, ver}
    this.roads = new Roads(world);
    const hm = world.idx.harita;
    this.tr = { img: world.trmap, x0: hm.x0, y0: hm.y0, x1: hm.x0 + hm.w, y1: hm.y0 + hm.h };
    this.sea = this._sample(world.trmap);
    this.ist = null;
    setTimeout(() => { try { this.ist = this._istanbul(); } catch (e) { console.warn('İstanbul haritası', e); } }, 0);
  }
  // kabartma haritasından deniz ve kara rengi
  _sample(img) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 64, 32);
    const d = g.getImageData(0, 0, 64, 32).data;
    const px = (u, v) => { const i = (v * 64 + u) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const s = px(20, 3);                              // Karadeniz
    this.seaRGB = s;
    return `rgb(${s[0]},${s[1]},${s[2]})`;
  }
  // İstanbul ayrıntı katmanı: kabartmanın renkleri + maskeden keskin kıyılar, kenarlar saydamlaşır
  _istanbul() {
    const w = this.world; if (!w.M || !w.MW) return null;
    const N = 1024, MW = w.MW, f = MW / N;
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const t = this.tr, k = N / (w.X1 - w.X0);
    drawClipped(g, t.img, t.x0, t.y0, t.x1, t.y1, w.X0, w.Y0, w.X1, w.Y1, -w.X0 * k, w.Y1 * k, k);
    const im = g.getImageData(0, 0, N, N), d = im.data, M = w.M;
    const [sr, sg, sb] = this.seaRGB, LAND = [118, 138, 84], feather = 56;
    // komşu kara pikselinden renk taşı (kabartmada su sayılan kıyı pikselleri için)
    let lr = LAND[0], lg = LAND[1], lb = LAND[2];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const o = (j * N + i) * 4;
        // maske: 2×2 ortalaması (yumuşak kıyı)
        const mi = (j * f | 0) * MW + (i * f | 0);
        const land = (M[mi] + M[mi + 1] + M[mi + MW] + M[mi + MW + 1]) / 4;
        const r = d[o], gg = d[o + 1], b = d[o + 2];
        const wet = b > r + 25 && b > gg + 5;             // kabartmada su rengi
        if (!wet) { lr = lr * 0.9 + r * 0.1; lg = lg * 0.9 + gg * 0.1; lb = lb * 0.9 + b * 0.1; }
        const cr = wet ? lr : r, cg = wet ? lg : gg, cb = wet ? lb : b;
        d[o] = cr * land + sr * (1 - land); d[o + 1] = cg * land + sg * (1 - land); d[o + 2] = cb * land + sb * (1 - land);
        const e = Math.min(i, j, N - 1 - i, N - 1 - j);
        d[o + 3] = 255 * clamp(e / feather, 0, 1);
      }
    }
    g.putImageData(im, 0, 0);
    if (this.cs) this.cs.ver = -1;
    return { img: c, x0: w.X0, y0: w.Y0, x1: w.X1, y1: w.Y1 };
  }
  // görünen genişlik (m): yerden yükseklik ve yer hızıyla
  _target(ac) {
    if (this.fixed) return this.fixed;
    const agl = ac.out && ac.out.agl ? Math.max(0, ac.out.agl) : Math.max(0, ac.alt - this.world.terrainH(ac.pos[1], ac.pos[0]));
    const gs = Math.hypot(ac.vel[0], ac.vel[1]);
    return clamp(SPAN_MIN + agl * 8 + gs * 55, SPAN_MIN, SPAN_MAX);
  }
  // test ve ayar: sabit ölçek (m), 0 = otomatik
  fix(span) { this.fixed = span || 0; this.span = 0; }
  _render(cx, cy, k, S, d) {
    const g = this.cg;
    if (this.cache.width !== S) { this.cache.width = S; this.cache.height = S; }
    const half = S / 2 / k, vx0 = cx - half, vx1 = cx + half, vy0 = cy - half, vy1 = cy + half;
    const ox = S / 2 - cx * k, oy = S / 2 + cy * k;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = this.sea; g.fillRect(0, 0, S, S);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const t = this.tr;
    drawClipped(g, t.img, t.x0, t.y0, t.x1, t.y1, vx0, vy0, vx1, vy1, ox, oy, k);
    const I = this.ist;
    if (I) drawClipped(g, I.img, I.x0, I.y0, I.x1, I.y1, vx0, vy0, vx1, vy1, ox, oy, k);
    // yollar: ölçeğe göre
    const span = S / k;
    const maxCls = span < 9000 ? 6 : span < 20000 ? 4 : span < 45000 ? 3 : span < 110000 ? 2 : span < 260000 ? 1 : 0;
    this.roads.at = { x: cx, y: cy };
    this.roads.draw(g, vx0, vy0, vx1, vy1, ox, oy, k, maxCls, d, span < 9000 ? 1.25 : span < 45000 ? 1 : 0.85);
    this._airports(g, vx0, vy0, vx1, vy1, ox, oy, k, d);
  }
  _airports(g, vx0, vy0, vx1, vy1, ox, oy, k, d) {
    const H = this.world.hava;
    if (!H || !H.list) return;
    const P = (x, y) => [ox + x * k, oy - y * k];
    g.lineCap = 'butt'; g.lineJoin = 'round';
    for (const a of H.list) {
      const m = 4000;
      if (a.x + m < vx0 || a.x - m > vx1 || a.y + m < vy0 || a.y - m > vy1) continue;
      const det = H.det.get(a.id);
      const big = a.rw.reduce((s, r) => Math.max(s, r.len), 0) * k;
      if (big < 5 * d) {
        // uzakta: küçük işaret
        if (a.kucuk && big < 2 * d) continue;
        const [u, v] = P(a.x, a.y);
        g.fillStyle = '#fff'; g.strokeStyle = '#2b2b2b'; g.lineWidth = 1.2 * d;
        g.beginPath(); g.arc(u, v, 2.6 * d, 0, Math.PI * 2); g.fill(); g.stroke();
        continue;
      }
      if (det && big > 40 * d) {
        const ax = det.x, ay = det.y;
        const poly = (rings) => { for (const ring of rings) { ring.forEach(([x, y], i) => { const [u, v] = P(ax + x, ay + y); i ? g.lineTo(u, v) : g.moveTo(u, v); }); g.closePath(); } };
        g.fillStyle = '#a3a39c';
        g.beginPath(); for (const pl of det.apron) poly(pl); g.fill('evenodd');
        g.beginPath(); for (const pl of det.twa || []) poly(pl); g.fill('evenodd');
        g.strokeStyle = '#8b8b84';
        const tw = new Map();
        for (const t of det.twy) { const lw = Math.max(1 * d, t.w * k); const key = lw.toFixed(1); (tw.get(key) || tw.set(key, []).get(key)).push(t); }
        for (const [lw, arr] of tw) {
          g.lineWidth = +lw; g.lineCap = 'round'; g.beginPath();
          for (const t of arr) t.p.forEach(([x, y], i) => { const [u, v] = P(ax + x, ay + y); i ? g.lineTo(u, v) : g.moveTo(u, v); });
          g.stroke();
        }
        g.lineCap = 'butt';
      }
      for (const r of a.rw) {
        const [u1, v1] = P(r.ax, r.ay), [u2, v2] = P(r.ax + r.ux * r.len, r.ay + r.uy * r.len);
        const lw = Math.max((r.paved ? 2.6 : 1.8) * d, r.w * k);
        g.strokeStyle = r.paved ? '#2c2c2e' : '#7c6a4c'; g.lineWidth = lw;
        g.beginPath(); g.moveTo(u1, v1); g.lineTo(u2, v2); g.stroke();
        if (r.paved && lw > 4.5 * d) {
          g.strokeStyle = '#f2f2ee'; g.lineWidth = Math.max(0.8 * d, lw * 0.08);
          g.setLineDash([lw * 0.9, lw * 0.7]);
          g.beginPath(); g.moveTo(u1, v1); g.lineTo(u2, v2); g.stroke();
          g.setLineDash([]);
        }
      }
    }
  }
  draw(ac, psi) {
    const cv = this.cv, cw = cv.clientWidth;
    if (!cw || !ac) return;
    const d = Math.min(3, window.devicePixelRatio || 1), W = Math.round(cw * d), Hh = Math.round((cv.clientHeight || cw) * d);
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    const x = ac.pos[1], y = ac.pos[0];
    const now = performance.now(), dt = this.t ? Math.min(1, (now - this.t) / 1000) : 1; this.t = now;
    // ölçek: logaritmik yumuşak geçiş; ışınlanma ya da yeni uçuşta hemen
    const tgt = this._target(ac);
    const jump = !this.last || Math.hypot(x - this.last.x, y - this.last.y) > 3000 + 600 * dt;
    if (!this.span || jump) this.span = tgt;
    else this.span = Math.exp(Math.log(this.span) + (Math.log(tgt) - Math.log(this.span)) * (1 - Math.exp(-dt / 1.4)));
    this.last = { x, y };
    const k = Math.max(W, Hh) / this.span;    // piksel / m
    // ara tuval: ekranın 1.6 katı, uçuş yönünde biraz önde
    const S = Math.ceil(Math.max(W, Hh) * 1.6);
    const ver = this.roads.ver * 1000 + (this.world.hava ? this.world.hava.det.size : 0) + (this.ist ? 1e7 : 0);
    let c = this.cs;
    const fits = (c) => {
      if (!c || c.S !== S || c.ver !== ver) return false;
      const r = k / c.k; if (r < 0.87 || r > 1.15) return false;
      const u0 = W / 2 + (c.cx - x) * k - S / 2 * r, v0 = Hh / 2 - (c.cy - y) * k - S / 2 * r;
      return u0 <= 0 && v0 <= 0 && u0 + S * r >= W && v0 + S * r >= Hh;
    };
    if (!fits(c)) {
      const gs = Math.hypot(ac.vel[0], ac.vel[1]), lead = gs > 3 ? 0.18 * this.span / gs : 0;
      c = this.cs = { cx: x + ac.vel[1] * lead, cy: y + ac.vel[0] * lead, k, S, ver };
      this._render(c.cx, c.cy, k, S, d);
    }
    const g = this.g, r = k / c.k;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = this.sea; g.fillRect(0, 0, W, Hh);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'medium';
    g.drawImage(this.cache, W / 2 + (c.cx - x) * k - S / 2 * r, Hh / 2 - (c.cy - y) * k - S / 2 * r, S * r, S * r);
    this._overlay(g, ac, psi, x, y, k, W, Hh, d);
  }
  _overlay(g, ac, psi, x, y, k, W, H, d) {
    const w = this.world, span = this.span;
    const tp = (px, py) => [W / 2 + (px - x) * k, H / 2 - (py - y) * k];
    const inV = (u, v, m = 0) => u > m && v > m && u < W - m && v < H - m;
    const label = (s, u, v, size, bold) => {
      g.font = `${bold ? '700' : '600'} ${Math.round(size * d)}px system-ui,-apple-system,sans-serif`;
      const tw = g.measureText(s).width, pad = 4 * d;
      let lx = u + pad; if (lx + tw > W - 3 * d) lx = u - pad - tw;         // kenarda kesilmesin: öbür yana
      const ly = clamp(v + size * 0.35 * d, size * d + 2 * d, H - 3 * d);
      g.lineWidth = 2.5 * d; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(s, lx, ly);
      g.fillStyle = '#fff'; g.fillText(s, lx, ly);
    };
    // simge yapılar (yakında)
    if (span < 30000) {
      g.fillStyle = '#c62a33'; g.strokeStyle = '#fff'; g.lineWidth = 1 * d;
      for (const l of w.landmarkPos) { const [u, v] = tp(l.x, l.y); if (inV(u, v, 2 * d)) { g.beginPath(); g.arc(u, v, 2.4 * d, 0, Math.PI * 2); g.fill(); g.stroke(); } }
    }
    // dağlar
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1 * d;
    for (const p of w.peaks) { if (/Göl/.test(p.name)) continue; const [u, v] = tp(p.x, p.y); if (inV(u, v, 4 * d)) { g.beginPath(); g.moveTo(u, v - 4 * d); g.lineTo(u + 3.5 * d, v + 2.5 * d); g.lineTo(u - 3.5 * d, v + 2.5 * d); g.closePath(); g.fill(); g.stroke(); } }
    // şehirler: ölçek büyüdükçe yalnız büyükler; küçük ölçekte merkezin dibindeki şehir adı yazılmaz (uçağın altında kalır)
    const minPop = span < 20000 ? 0 : span < 60000 ? 60000 : 250000;
    let n = 0;
    for (const c of w.cities) {
      if (c.nufus < minPop) continue;
      const [u, v] = tp(c.x, c.y);
      if (!inV(u, v, 2 * d)) continue;
      if (Math.hypot(u - W / 2, v - H / 2) < 14 * d) continue;
      g.fillStyle = '#fff'; g.fillRect(u - 2 * d, v - 2 * d, 4 * d, 4 * d);
      label(c.ad, u, v, 9, true);
      if (++n >= 8) break;
    }
    // havalimanı kodları
    if (w.hava && span <= 45000) {
      for (const a of w.hava.list) {
        if (a.kucuk || a.mil) continue;
        const [u, v] = tp(a.x, a.y);
        if (!inV(u, v, 4 * d) || Math.hypot(u - W / 2, v - H / 2) < 16 * d) continue;
        label(a.iata || a.id, u + 2 * d, v - 6 * d, 8, false);
      }
    }
    // yer izi: 60 sn sonra nerede
    const gs = Math.hypot(ac.vel[0], ac.vel[1]);
    if (gs > 8) {
      const L = Math.min(gs * 60 * k, W * 0.45);
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5 * d; g.setLineDash([4 * d, 3 * d]);
      g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(W / 2 + ac.vel[1] / gs * L, H / 2 - ac.vel[0] / gs * L); g.stroke();
      g.setLineDash([]);
    }
    // uçak (üstten görünüş), burnu ızgara başına
    g.save(); g.translate(W / 2, H / 2); g.rotate(psi); g.scale(d, d);
    g.beginPath();
    g.moveTo(0, -9); g.lineTo(1.4, -6.5); g.lineTo(1.4, -2); g.lineTo(9, 2.2); g.lineTo(9, 3.8); g.lineTo(1.4, 2.4);
    g.lineTo(1.1, 6); g.lineTo(3.8, 8); g.lineTo(3.8, 9.2); g.lineTo(0, 8.4); g.lineTo(-3.8, 9.2); g.lineTo(-3.8, 8);
    g.lineTo(-1.1, 6); g.lineTo(-1.4, 2.4); g.lineTo(-9, 3.8); g.lineTo(-9, 2.2); g.lineTo(-1.4, -2); g.lineTo(-1.4, -6.5); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 2.4; g.strokeStyle = 'rgba(0,0,0,.8)'; g.stroke();
    g.fillStyle = '#ffd23f'; g.fill();
    g.restore();
    // kuzey işareti
    g.font = `700 ${Math.round(11 * d)}px system-ui,-apple-system,sans-serif`; g.textAlign = 'center';
    g.lineWidth = 3 * d; g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeText('K', W / 2, 13 * d);
    g.fillStyle = 'rgba(255,255,255,.95)'; g.fillText('K', W / 2, 13 * d);
    g.beginPath(); g.moveTo(W / 2, 1.5 * d); g.lineTo(W / 2 + 3 * d, 4.5 * d); g.lineTo(W / 2 - 3 * d, 4.5 * d); g.closePath(); g.fill();
    g.textAlign = 'start';
    // ölçek çubuğu
    const want = span * 0.28, steps = [0.5, 1, 2, 5, 10, 20, 50], km = steps.find((s) => s * 1000 >= want * 0.6) || 50;
    const bl = km * 1000 * k, bx = 7 * d, by = H - 7 * d;
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4 * d; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bl, by); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 2 * d; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bl, by); g.stroke();
    g.font = `700 ${Math.round(9 * d)}px system-ui,-apple-system,sans-serif`;
    g.lineWidth = 3 * d; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(km + ' km', bx, by - 4 * d); g.fillStyle = '#fff'; g.fillText(km + ' km', bx, by - 4 * d);
  }
}

// ---------- büyük Türkiye haritası ----------
export class BigMap {
  constructor(world, canvas) { this.world = world; this.cv = canvas; this.g = canvas.getContext('2d'); }
  draw(ac, psi) {
    const w = this.world, hm = w.idx.harita, img = w.trmap, big = this.cv, g = this.g;
    const r = big.getBoundingClientRect(), d = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.round(r.width * d), H = Math.round(r.height * d);
    if (!W || !H) return;
    if (big.width !== W || big.height !== H) { big.width = W; big.height = H; }
    // Türkiye'yi sığdır: x -330..1330 km, y -600..+190 km
    const X0 = -330000, X1 = 1330000, Y0 = -600000, Y1 = 190000;
    const s = Math.min(W / (X1 - X0), H / (Y1 - Y0));
    const ox = (W - (X1 - X0) * s) / 2 - X0 * s, oy = (H - (Y1 - Y0) * s) / 2 + Y1 * s;
    const tp = (x, y) => [ox + x * s, oy - y * s];
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#2f5f80'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    drawClipped(g, img, hm.x0, hm.y0, hm.x0 + hm.w, hm.y0 + hm.h, (0 - ox) / s, (oy - H) / s, (W - ox) / s, oy / s, ox, oy, s);
    // havalimanları
    g.fillStyle = '#ffcf33'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1 * d;
    for (const a of (w.hava && w.hava.list) || []) {
      if (a.kucuk) continue;
      const [u, v] = tp(a.x, a.y); g.beginPath(); g.arc(u, v, 2.6 * d, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.font = `600 ${Math.round(11 * d)}px system-ui,-apple-system,sans-serif`; g.lineWidth = 3 * d; g.strokeStyle = 'rgba(0,0,0,.55)';
    for (const c of w.cities.slice(0, 40)) { const [u, v] = tp(c.x, c.y); g.fillStyle = '#fff'; g.fillRect(u - 2 * d, v - 2 * d, 4 * d, 4 * d); if (c.nufus > 250000) { g.strokeText(c.ad, u + 5 * d, v + 4 * d); g.fillText(c.ad, u + 5 * d, v + 4 * d); } }
    for (const p of w.peaks.slice(0, 10)) { const [u, v] = tp(p.x, p.y); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(u, v - 5 * d); g.lineTo(u + 4 * d, v + 3 * d); g.lineTo(u - 4 * d, v + 3 * d); g.fill(); }
    if (ac) {
      const [u, v] = tp(ac.pos[1], ac.pos[0]);
      g.save(); g.translate(u, v); g.rotate(psi); g.scale(d * 1.6, d * 1.6);
      g.fillStyle = '#ff4d4d'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `bold ${Math.round(13 * d)}px system-ui,-apple-system,sans-serif`;
    g.fillText('Türkiye · kapatmak için N ya da dokunun', 12 * d, 20 * d);
  }
}
