// Harita izdüşümü: küresel Lambert konik konform (tools/lcc.py ile aynı). x doğu, y kuzey (m); İstanbul (41.085 K, 28.97 D) = (0, 0).
// Türkiye genelinde ölçek hatası binde 3'ün altında; açılar korunur. Izgara kuzeyi ile gerçek kuzey arasındaki fark (yakınsama)
// İstanbul'da 0, doğuda artar (Van'da ~9°); pusula gerçek kuzeyi gösterir.
const R = 6371008.8, LAT0 = 41.085, LON0 = 28.97, D = Math.PI / 180;
const P1 = 37 * D, P2 = 41 * D;
const t = (p) => Math.tan(Math.PI / 4 + p / 2);
export const N = Math.log(Math.cos(P1) / Math.cos(P2)) / Math.log(t(P2) / t(P1));
const F = Math.cos(P1) * Math.pow(t(P1), N) / N;
const RHO0 = R * F / Math.pow(t(LAT0 * D), N);
export function geo(lat, lon) {
  const rho = R * F / Math.pow(t(lat * D), N), th = N * (lon - LON0) * D;
  return { x: rho * Math.sin(th), y: RHO0 - rho * Math.cos(th) };
}
export function ungeo(x, y) {
  const dy = RHO0 - y, rho = Math.hypot(x, dy), th = Math.atan2(x, dy);
  return { lat: (2 * Math.atan(Math.pow(R * F / rho, 1 / N)) - Math.PI / 2) / D, lon: LON0 + th / N / D };
}
// gerçek kuzeyin ızgaradaki yönü (radyan, saat yönü +): gerçek baş = ızgara başı - yakınsama
export function convergence(x, y) { return -Math.atan2(x, RHO0 - y); }
export { LAT0, LON0 };
