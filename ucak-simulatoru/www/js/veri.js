// Veri dosyaları: ikili veriler PNG içinde taşınır (artifact sunucusu .bin sunmuyor; PNG base64'ten küçük ve tarayıcı kendisi açar).
// Biçim: baytlar sırayla RGB piksellere yazılı (alfa 255), ilk 4 bayt uzunluk (küçük endian).
export async function pngBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const blob = await r.blob();
  let src;
  if (typeof createImageBitmap === 'function') {
    try { src = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); } catch (e) { src = null; }
    if (!src) { try { src = await createImageBitmap(blob); } catch (e) { src = null; } }
  }
  if (!src) src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(url)); i.src = URL.createObjectURL(blob); });
  const w = src.width, h = src.height;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  if (src.close) src.close();
  const len = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3 + 1] << 24);
  const out = new Uint8Array(len);
  // bayt k (uzunluk başlığından sonra): toplam sıra 4 + k -> piksel (4+k)/3, kanal (4+k)%3
  for (let k = 0; k < len; k++) { const q = 4 + k; out[k] = d[((q / 3) | 0) * 4 + (q % 3)]; }
  return out.buffer;
}
// Yükseklik ızgarası: 'YKH2', nx, ny (int32), x0, y0 (f64), s (f32), satır satır int16 farkları (0.5 m).
// Çoklu ızgara ('YKHM', sayı, sonra her biri için (konum, uzunluk) uint32): k'inci ızgara.
export function decodeGrid(buf, k) {
  if (k != null) {
    const m = new DataView(buf);
    if (m.getUint8(0) === 89 && m.getUint8(3) === 77) { const o = m.getUint32(8 + k * 8, true), n = m.getUint32(12 + k * 8, true); buf = buf.slice(o, o + n); }
  }
  const dv = new DataView(buf);
  const nx = dv.getInt32(4, true), ny = dv.getInt32(8, true);
  const x0 = dv.getFloat64(12, true), y0 = dv.getFloat64(20, true), s = dv.getFloat32(28, true);
  const raw = new Int16Array(buf.slice(32, 32 + nx * ny * 2));
  const H = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) { let v = 0; const o = j * nx; for (let i = 0; i < nx; i++) { v += raw[o + i]; H[o + i] = v * 0.5; } }
  return new Grid(nx, ny, x0, y0, s, H);
}
export class Grid {
  constructor(nx, ny, x0, y0, s, H) { Object.assign(this, { nx, ny, x0, y0, s, H }); this.x1 = x0 + (nx - 1) * s; this.y1 = y0 + (ny - 1) * s; }
  inside(x, y) { return x >= this.x0 && x <= this.x1 && y >= this.y0 && y <= this.y1; }
  // dörtlü ağaç örgüsündeki üçgenlerle aynı bölme: (i,j)-(i+1,j)-(i,j+1) ve (i+1,j+1)-(i,j+1)-(i+1,j)
  h(x, y) {
    const nx = this.nx;
    let fi = (x - this.x0) / this.s, fj = (y - this.y0) / this.s;
    fi = fi < 0 ? 0 : fi > nx - 1.0001 ? nx - 1.0001 : fi; fj = fj < 0 ? 0 : fj > this.ny - 1.0001 ? this.ny - 1.0001 : fj;
    const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, H = this.H, k = j * nx + i;
    const a = H[k], b = H[k + 1], c = H[k + nx], d = H[k + nx + 1];
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
}
