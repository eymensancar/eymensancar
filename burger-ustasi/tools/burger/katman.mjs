// Burger Ustası: hamburger katmanlarının ve tezgâh nesnelerinin SVG çizimleri (yandan, ~17° üstten bakış).
// Biçem Eymen'in resmi (docs/referans/mutfak-v3-eymen.png): kalın koyu kahve kontur, sıcak vurgular, yumuşak gölge,
// boyalı doku. Birim = sahne birimi (resmin pikseli). Her katmanın "oturma noktası" (seat) y=0: alttaki katmanın üst
// yüzünün merkezi. Katmanın üst yüzü y=-k'de; bir üstteki katman oraya oturur.
// Bu dosya yalnız SVG metni üretir; uret.mjs Playwright ile 3× webp'ye döker.

export const E = 0.3;          // eğim: elips ry/rx (≈17° üstten)
export const R = 57.5;         // ortak oturma yarıçapı (alt ekmek, köfte; peynir ve turşu bu kenardan sarkar)
export const CX = 70, BW = 140; // katman kutusu: 140 birim genişlik, merkez x=70
const KONTUR = '#4a1d06', KW = 3;

// sabit tohumlu rastgele (her üretimde aynı çizim)
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const f1 = n => +n.toFixed(2);
const yol = (pts, kapali = true) => 'M' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join('L') + (kapali ? 'Z' : '');
// pürüzsüz kapalı yol (Catmull-Rom → Bezier)
function puruz(pts, kapali = true) {
  const n = pts.length, P = i => pts[kapali ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f1(P(0)[0])},${f1(P(0)[1])}`;
  const son = kapali ? n : n - 1;
  for (let i = 0; i < son; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d + (kapali ? 'Z' : '');
}

// ortak süzgeçler: boyalı doku = iri, yumuşak lekeler (fırça izi gibi ışık farkı) + çok hafif ince gren; renk doygunluğu korunur
function ortakDefs(id, { leke = 0.1, gren = 0.05, sik = 0.07, tohum = 3 } = {}) {
  return `<filter id="${id}doku" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="${sik}" numOctaves="2" seed="${tohum}" result="n1"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="${tohum + 7}" result="n2"/>
    <feColorMatrix in="n1" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${leke * 3} 0 0 0 ${-leke * 1.5}" result="a1"/>
    <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${gren * 3} 0 0 0 ${-gren * 1.5}" result="a2"/>
    <feFlood flood-color="#fff6d8" result="ak"/><feComposite in="ak" in2="a1" operator="in" result="l1"/>
    <feFlood flood-color="#4a1800" result="ko"/><feComposite in="ko" in2="a2" operator="in" result="l2"/>
    <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="l1"/><feMergeNode in="l2"/></feMerge>
    <feComposite in="m" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="${id}bl1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1"/></filter>
  <filter id="${id}bl2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="${id}bl4" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>`;
}
function svg(vb, defs, govde) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}"><defs>${defs}</defs>${govde}</svg>`;
}
// elips noktaları (θ: 0 sağ, π/2 ön)
function elips(cx, cy, rx, ry, a0, a1, n = 48, rf = null) {
  const a = [];
  for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n, k = rf ? rf(t) : 1; a.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); }
  return a;
}

/* ---------------- alt ekmek ---------------- */
// alt yüzü tahtaya oturur (y=0), kesik yüzü y=-K'de, hafif kızarmış
export function altEkmek() {
  const id = 'ae', K = 21, rT = 57, rB = 53.5;
  const ust = elips(CX, -K, rT, rT * E, Math.PI, 2 * Math.PI, 40);
  // yan: sağ üstten aşağı, alt elipsin önünden, sol üste
  const sag = [[CX + rT, -K], [CX + rT + 0.4, -K + 7], [CX + rT - 1.2, -K + 14], [CX + rB + 0.6, -3]];
  const alt = elips(CX, -1, rB, rB * E, 0.12, Math.PI - 0.12, 40);
  const sol = [[CX - rB - 0.6, -3], [CX - rT + 1.2, -K + 14], [CX - rT - 0.4, -K + 7]];
  const sil = puruz([...ust, ...sag.slice(1), ...alt, ...sol]);
  const yuz = elips(CX, -K, rT - 2.2, (rT - 2.2) * E, 0, 2 * Math.PI, 64);
  const yuzOn = elips(CX, -K, rT - 2.2, (rT - 2.2) * E, 0.05, Math.PI - 0.05, 40);
  const r = rnd(11);
  // kırıntı gözenekleri (kesik yüz)
  let gz = '';
  for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 48, x = CX + Math.cos(a) * d, y = -K + Math.sin(a) * d * E; gz += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(0.7 + r() * 1.3)}" ry="${f1(0.35 + r() * 0.5)}" fill="#c98a3c" opacity="${f1(0.18 + r() * 0.25)}"/>`; }
  const defs = ortakDefs(id, { leke: 0.12, gren: 0.04, sik: 0.09, tohum: 2 }) + `
    <clipPath id="aeS"><path d="${sil}"/></clipPath>
    <linearGradient id="aeY" x1="0" y1="${-K}" x2="0" y2="${rB * E}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fbb23c"/><stop offset=".3" stop-color="#f6921f"/><stop offset=".7" stop-color="#e27416"/><stop offset="1" stop-color="#a84c0c"/></linearGradient>
    <linearGradient id="aeX" x1="${CX - rT}" y1="0" x2="${CX + rT}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff2c0" stop-opacity=".32"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#5a1e00" stop-opacity="0"/><stop offset="1" stop-color="#5a1e00" stop-opacity=".28"/></linearGradient>
    <radialGradient id="aeF" cx="${CX - 8}" cy="${-K - 3}" r="60" gradientTransform="translate(0 ${-K * (1 - E)}) scale(1 ${E})" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffeab4"/><stop offset=".55" stop-color="#fdd88e"/><stop offset=".85" stop-color="#f8bd5c"/><stop offset="1" stop-color="#f09a34"/></radialGradient>`;
  const g = `<g filter="url(#aedoku)">
    <path d="${sil}" fill="url(#aeY)"/>
    <path d="${sil}" fill="url(#aeX)"/>
    <g clip-path="url(#aeS)">
      <path d="${yol(elips(CX, -1, rB + 4, rB * E + 3, 0, Math.PI, 30))}" fill="none" stroke="#7a3008" stroke-width="5" opacity=".35" filter="url(#aebl2)"/>
      <path d="M${CX - rT + 4},${-K + 5} Q${CX - rT + 2},${-K + 13} ${CX - rB + 6},-4" stroke="#fff4cc" stroke-width="3.5" fill="none" opacity=".55" filter="url(#aebl1)" stroke-linecap="round"/>
    </g>
    <path d="${yol(yuz)}" fill="url(#aeF)"/>
    ${gz}
    <path d="${yol(yuzOn, false)}" fill="none" stroke="#c66d1c" stroke-width="1.6" opacity=".8"/>
    <path d="${yol(elips(CX, -K, rT - 5, (rT - 5) * E, 0.2, Math.PI - 0.2, 30), false)}" fill="none" stroke="#fff6d8" stroke-width="1.6" opacity=".6" filter="url(#aebl1)"/>
  </g>
  <path d="${sil}" fill="none" stroke="${KONTUR}" stroke-width="${KW}" stroke-linejoin="round"/>`;
  const top = -K - rT * E - 3, bot = rB * E + 3;
  return { ad: 'b-alt', svg: svg([0, top, BW, bot - top], defs, g), alt: bot, ust: -top, k: K, rx: rT };
}

/* ---------------- köfte ---------------- */
export function kofte() {
  const id = 'kf', K = 15, r = rnd(7);
  // düzensiz kenar: birkaç sinüs + küçük gürültü
  const fz = [r() * 6, r() * 6, r() * 6];
  const rf = t => 1 + 0.018 * Math.sin(5 * t + fz[0]) + 0.012 * Math.sin(9 * t + fz[1]) + 0.008 * Math.sin(15 * t + fz[2]);
  const rx = 59.5;
  const ust = elips(CX, -K, rx, rx * E, Math.PI, 2 * Math.PI, 60, rf);
  const sag = [[CX + rx * rf(0) + 1.2, -K / 2]];
  const alt = elips(CX, 0, rx - 0.5, (rx - 0.5) * E, 0, Math.PI, 60, rf);
  const sol = [[CX - rx * rf(Math.PI) - 1.2, -K / 2]];
  const sil = puruz([...ust, ...sag, ...alt, ...sol]);
  const yuzP = elips(CX, -K, rx - 1, (rx - 1) * E, 0, 2 * Math.PI, 90, rf);
  const yuz = puruz(yuzP.slice(0, -1));
  // ızgara izi: üstten bakışta çapraz çizgiler, eğimle basık
  let iz = '';
  const cizgi = (aci, ofs) => { const ca = Math.cos(aci), sa = Math.sin(aci), pts = [];
    for (let s = -70; s <= 70; s += 4) { const x = ofs * -sa + s * ca, y = ofs * ca + s * sa; pts.push([CX + x, -K + y * E]); } return pts; };
  for (const [aci, ofsler] of [[0.55, [-34, -17, 0, 17, 34]], [-0.95, [-30, -10, 10, 30]]])
    for (const o of ofsler) { const p = cizgi(aci, o); iz += `<path d="${yol(p, false)}" stroke="#3a1002" stroke-width="5.2" fill="none" stroke-linecap="round" opacity=".82"/><path d="${yol(p.map(q => [q[0], q[1] + 1.7]), false)}" stroke="#c76a36" stroke-width="1.2" fill="none" opacity=".45"/>`; }
  // yanda kömürleşmiş dikey izler ve kabuk
  let yan = '';
  for (let i = 0; i < 16; i++) { const t = 0.15 + (Math.PI - 0.3) * i / 15 + (r() - .5) * 0.12, x = CX + Math.cos(t) * rx * rf(t), yb = Math.sin(t) * rx * E;
    yan += `<path d="M${f1(x)},${f1(-K + yb + 2 + r() * 2)}l${f1((r() - .5) * 1.5)},${f1(8 + r() * 4)}" stroke="${r() < .5 ? '#2a0a00' : '#b0562a'}" stroke-width="${f1(1.2 + r() * 2)}" opacity="${f1(.25 + r() * .3)}" stroke-linecap="round"/>`;
    const bx = CX + Math.cos(t + .1) * rx * .97, by = -K / 2 + Math.sin(t + .1) * rx * E; yan += `<ellipse cx="${f1(bx)}" cy="${f1(by + (r() - .5) * 6)}" rx="${f1(2 + r() * 3)}" ry="${f1(1.2 + r() * 1.5)}" fill="#c46634" opacity="${f1(.25 + r() * .25)}"/>`; }
  let parlak = '';
  for (let i = 0; i < 9; i++) { const a = Math.PI + 0.3 + r() * 1.6, d = 18 + r() * 30, x = CX + Math.cos(a) * d - 6, y = -K + Math.sin(a) * d * E + 2;
    parlak += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(2 + r() * 4)}" ry="${f1(0.6 + r() * 0.8)}" fill="#ffe2c0" opacity="${f1(.35 + r() * .35)}" transform="rotate(${f1(-8 + r() * 16)} ${f1(x)} ${f1(y)})"/>`; }
  const defs = ortakDefs(id, { leke: 0.1, gren: 0.1, sik: 0.12, tohum: 9 }) + `
    <clipPath id="kfS"><path d="${sil}"/></clipPath><clipPath id="kfU"><path d="${yuz}"/></clipPath>
    <linearGradient id="kfY" x1="0" y1="${-K}" x2="0" y2="${rx * E}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#a8461a"/><stop offset=".45" stop-color="#84320e"/><stop offset="1" stop-color="#521a04"/></linearGradient>
    <radialGradient id="kfF" cx="${CX - 12}" cy="${-K - 4}" r="66" gradientTransform="translate(0 ${(-K - 4) * (1 - E)}) scale(1 ${E})" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#cc6a34"/><stop offset=".5" stop-color="#ac4a1e"/><stop offset="1" stop-color="#7e300e"/></radialGradient>`;
  const g = `<g filter="url(#kfdoku)">
    <path d="${sil}" fill="url(#kfY)"/>
    <g clip-path="url(#kfS)">${yan}
      <path d="${yol(elips(CX, -K + 3, rx, rx * E, 0.1, Math.PI - 0.1, 30), false)}" stroke="#c06a3a" stroke-width="2.2" fill="none" opacity=".5" filter="url(#kfbl1)"/>
    </g>
    <path d="${yuz}" fill="url(#kfF)"/>
    <g clip-path="url(#kfU)">${iz}${parlak}
      <path d="${yol(elips(CX, -K, rx - 1, (rx - 1) * E, 0, 2 * Math.PI, 60, rf))}" fill="none" stroke="#3a1002" stroke-width="5" opacity=".35" filter="url(#kfbl2)"/>
    </g>
    <path d="${yol(elips(CX, -K, rx - 1, (rx - 1) * E, 0.05, Math.PI - 0.05, 60, rf), false)}" stroke="#2a0a00" stroke-width="1.5" fill="none" opacity=".75"/>
  </g>
  <path d="${sil}" fill="none" stroke="#2a0c02" stroke-width="${KW}" stroke-linejoin="round"/>`;
  const top = -K - rx * E - 4, bot = rx * E + 4;
  return { ad: 'b-kofte', svg: svg([0, top, BW, bot - top], defs, g), alt: bot, ust: -top, k: K, rx };
}

/* ---------------- sarkma (peynir, turşu): üstten bakıştaki nokta → ekrana; kenarı aşan kısım öne/yana sarkar ---------------- */
function sarkit(p, cy, { ac = 0.16, sark = 1.25 } = {}) {
  const [x, y] = p, rr = Math.hypot(x, y);
  if (rr <= R) return [CX + x, cy + y * E];
  const ux = x / rr, uy = y / rr, d = rr - R;
  const on = Math.max(0, Math.min(1, (uy + 0.3) / 0.75));      // 0 arka, 1 ön
  const yat = R + d * (ac + 0.1 * (1 - on));
  return [CX + ux * yat, cy + uy * yat * E + d * sark * on * (0.55 + 0.45 * on)];
}

/* ---------------- peynir: kare dilim, köşeleri kenardan erir/sarkar ---------------- */
export function peynir() {
  const id = 'py', K = 3, A = 49, kr = 10, aci = 0.24, r = rnd(5);
  // yuvarlak köşeli kare (üstten bakış), ince adımlarla
  const ham = [];
  const kose = [[A - kr, A - kr, 0], [-(A - kr), A - kr, Math.PI / 2], [-(A - kr), -(A - kr), Math.PI], [A - kr, -(A - kr), 1.5 * Math.PI]];
  for (let k = 0; k < 4; k++) {
    const [cx, cy, a0] = kose[k], [nx, ny] = kose[(k + 1) % 4];
    for (let i = 0; i <= 8; i++) { const t = a0 + (Math.PI / 2) * i / 8; ham.push([cx + Math.cos(t) * kr, cy + Math.sin(t) * kr]); }
    const ex = cx + Math.cos(a0 + Math.PI / 2) * kr, ey = cy + Math.sin(a0 + Math.PI / 2) * kr, fx = nx + Math.cos(a0 + Math.PI / 2) * kr, fy = ny + Math.sin(a0 + Math.PI / 2) * kr;
    for (let i = 1; i < 16; i++) ham.push([ex + (fx - ex) * i / 16, ey + (fy - ey) * i / 16]);
  }
  const ca = Math.cos(aci), sa = Math.sin(aci);
  const don = ham.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca + 3]);
  // erime: kenar dalgalı (biraz)
  const er = don.map(([x, y], i) => { const w = 1 + 0.012 * Math.sin(i * 0.7 + 1.3); return [x * w, y * w]; });
  // erimiş sarkma: kenarı aşan kısım öne/yana sarkar; köşeler dil gibi uzar, aradaki kenar hafif dalgalı sarkar
  const sk = er.map(([x, y], i) => { const rr = Math.hypot(x, y); if (rr <= R) return [CX + x, -K + y * E];
    const ux = x / rr, uy = y / rr, d = rr - R, on = Math.max(0, Math.min(1, (uy + 0.3) / 0.75));
    const yat = R + d * (0.08 + 0.12 * (1 - on)), dal = 0.85 + 0.15 * Math.sin(i * 0.9);
    return [CX + ux * yat, -K + uy * yat * E + Math.min(13, Math.pow(d, 1.22) * 1.25 * on * (0.5 + 0.5 * on)) * dal]; });
  // damlalar: sarkan dillerin ucunda (en alçak iki öndeki nokta)
  let damla = '';
  const uc = [];
  sk.forEach((p, i) => { const q = sk[(i - 1 + sk.length) % sk.length], n = sk[(i + 1) % sk.length]; if (p[1] > q[1] && p[1] >= n[1] && p[1] > -K + R * E + 3) uc.push(p); });
  uc.sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([px, py], j) => {
    const h = j ? 4.5 : 6.5, w = j ? 2.6 : 3.2;
    damla += `<path d="M${f1(px - w - 1.5)},${f1(py - 3)} C${f1(px - w)},${f1(py + h * .4)} ${f1(px - w)},${f1(py + h)} ${f1(px)},${f1(py + h)} C${f1(px + w)},${f1(py + h)} ${f1(px + w)},${f1(py + h * .4)} ${f1(px + w + 1.5)},${f1(py - 3)}Z" fill="#f0900e" stroke="#6e2c02" stroke-width="1.8"/>
      <ellipse cx="${f1(px - w * .35)}" cy="${f1(py + h * .45)}" rx="${f1(w * .28)}" ry="${f1(h * .2)}" fill="#ffe08a" opacity=".85"/>`; });
  const ana = puruz(sk), kalin = puruz(sk.map(([x, y]) => [x, y + 2.2]));
  const defs = ortakDefs(id, { leke: 0.12, gren: 0.0, sik: 0.06, tohum: 4 }) + `
    <clipPath id="pyD"><ellipse cx="${CX}" cy="${-K}" rx="${R - 0.5}" ry="${(R - 0.5) * E}"/></clipPath>
    <clipPath id="pyA"><path d="${ana}"/></clipPath>
    <linearGradient id="pyG" x1="0" y1="${-K - R * E}" x2="0" y2="${-K + R * E + 18}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffcb38"/><stop offset=".5" stop-color="#fdb215"/><stop offset="1" stop-color="#f08c0a"/></linearGradient>`;
  const g = `<g filter="url(#pydoku)">
    <path d="${kalin}" fill="#d9700a"/>
    ${damla}
    <path d="${ana}" fill="url(#pyG)"/>
    <g clip-path="url(#pyA)">
      <path d="${ana}" fill="#e07a08" opacity=".55"/>
      <g clip-path="url(#pyD)"><path d="${ana}" fill="url(#pyG)"/>
        <ellipse cx="${CX - 14}" cy="${-K - 5}" rx="26" ry="5" fill="#fff0a8" opacity=".55" filter="url(#pybl2)"/>
        <path d="M${CX - 34},${-K - 2} q16,-6 30,-4" stroke="#fff8d0" stroke-width="1.8" fill="none" opacity=".8" stroke-linecap="round"/>
        <path d="M${CX + 10},${-K + 8} q14,-2 24,-7" stroke="#fff8d0" stroke-width="1.4" fill="none" opacity=".55" stroke-linecap="round"/>
      </g>
      <ellipse cx="${CX}" cy="${-K}" rx="${R - 0.5}" ry="${(R - 0.5) * E}" fill="none" stroke="#c45a04" stroke-width="2.4" opacity=".55" filter="url(#pybl1)"/>
    </g>
  </g>
  <path d="${ana}" fill="none" stroke="#6e2c02" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="${kalin}" fill="none" stroke="#6e2c02" stroke-width="1.8" stroke-linejoin="round" clip-path="url(#pyK)"/>`;
  // kalınlık kenarının konturu yalnız ana yolun dışında kalan yerde görünür: maske ile
  const g2 = g.replace('clip-path="url(#pyK)"', 'mask="url(#pyM)"');
  const defs2 = defs + `<mask id="pyM" maskUnits="userSpaceOnUse" x="0" y="-60" width="${BW}" height="140"><rect x="0" y="-60" width="${BW}" height="140" fill="#fff"/><path d="${ana}" fill="#000"/></mask>`;
  let ys = Infinity, yb = -Infinity; sk.forEach(p => { ys = Math.min(ys, p[1]); yb = Math.max(yb, p[1]); });
  const top = Math.floor(ys - 4), bot = Math.ceil(Math.max(yb + 5, 22));
  return { ad: 'b-peynir', svg: svg([0, top, BW, bot - top], defs2, g2), alt: bot, ust: -top, k: K };
}

/* ---------------- turşu: yuvarlak dilimler, kenardan yeşil uçları sarkar ---------------- */
export function tursu() {
  const id = 'tr', K = 3.5, r = rnd(21);
  // üstten bakışta dilimler (x, y, yarıçap, dönüş); arkadan öne çizilir
  const dil = [[-6, -26, 17.5], [26, -10, 17], [-50, 4, 17.5], [50, 14, 17], [-16, 22, 17.5], [18, 38, 16.5]]
    .sort((a, b) => a[1] - b[1]);
  let g = '';
  dil.forEach(([x, y, rr], i) => {
    const n = 40, cizP = (rad, dy = 0) => Array.from({ length: n }, (_, j) => { const t = j / n * Math.PI * 2, w = 1 + 0.03 * Math.sin(j * 1.7 + i); return sarkit([x + Math.cos(t) * rad * w, y + Math.sin(t) * rad * w], -K + dy, { ac: 0.3, sark: 0.9 }); });
    const dis = cizP(rr), kal = cizP(rr, 2.2), ic = cizP(rr - 3.2), tohum = cizP(rr * 0.52);
    const [mx, my] = sarkit([x, y], -K, { ac: 0.3, sark: 0.9 });
    let ck = '';
    for (let j = 0; j < 7; j++) { const t = j / 7 * Math.PI * 2 + i, p = sarkit([x + Math.cos(t) * rr * 0.5, y + Math.sin(t) * rr * 0.5], -K, { ac: 0.3, sark: 0.9 });
      ck += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="1.6" ry="${f1(1.6 * E + .5)}" fill="#f0e48a" opacity=".7"/>`;
      const q = sarkit([x + Math.cos(t) * rr * 0.85, y + Math.sin(t) * rr * 0.85], -K, { ac: 0.3, sark: 0.9 });
      ck += `<path d="M${f1(mx)},${f1(my)}L${f1(q[0])},${f1(q[1])}" stroke="#8aa020" stroke-width=".9" opacity=".55"/>`; }
    g += `<g>
      <path d="${puruz(kal)}" fill="#46560a" stroke="#263006" stroke-width="1.8"/>
      <path d="${puruz(dis)}" fill="#6e8a12"/>
      <path d="${puruz(ic)}" fill="url(#trF)"/>
      <path d="${puruz(tohum)}" fill="none" stroke="#c8d460" stroke-width="1.2" opacity=".55"/>
      ${ck}
      <ellipse cx="${f1(mx - rr * .3)}" cy="${f1(my - rr * E * .4)}" rx="${f1(rr * .35)}" ry="${f1(rr * E * .25)}" fill="#fbffd8" opacity=".55" filter="url(#trbl1)"/>
      <path d="${puruz(dis)}" fill="none" stroke="#22300a" stroke-width="1.8" stroke-linejoin="round"/>
    </g>`;
  });
  const defs = ortakDefs(id, { leke: 0.08, gren: 0.03, sik: 0.15, tohum: 6 }) + `
    <radialGradient id="trF" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#e6e070"/><stop offset=".55" stop-color="#c8c22a"/><stop offset="1" stop-color="#9a9c14"/></radialGradient>`;
  const top = -K - R * E - 4, bot = 26;
  return { ad: 'b-tursu', svg: svg([0, top, BW, bot - top], defs, `<g filter="url(#trdoku)">${g}</g>`), alt: bot, ust: -top, k: K };
}

/* ---------------- üst ekmek: susamlı kubbe ---------------- */
export function ustEkmek() {
  const id = 'ue', H = 47, rB = 57.5, rW = 60.5, r = rnd(3);
  const sil = `M${CX - rB},0 C${CX - rW},-4 ${CX - rW - 0.5},-9 ${CX - rW + 0.5},-14 C${CX - rW + 4},-36 ${CX - 34},${-H} ${CX},${-H} C${CX + 34},${-H} ${CX + rW - 4},-36 ${CX + rW - 0.5},-14 C${CX + rW + 0.5},-9 ${CX + rW},-4 ${CX + rB},0 A${rB} ${f1(rB * E)} 0 0 1 ${CX - rB},0Z`;
  // susamlar: yarım küre üstünde, görünür yüzde
  let sus = '';
  const nokta = [];
  for (let tries = 0; nokta.length < 34 && tries < 4000; tries++) {
    const u = r() * 2 - 1, v = r() * 2 - 1, w = 1 - u * u - v * v; if (w < 0.05) continue;
    const c = Math.sqrt(w); // yukarı
    // görünürlük: bakış (0, cos, sin) → v öne
    const gor = 0.95 * v + 0.3 * c; if (gor < 0.12) continue;
    const x = CX + u * (rW - 4), y = -10 - c * (H - 12) + v * 14;
    if (nokta.some(p => Math.hypot(p[0] - x, (p[1] - y) * 1.4) < 8.5)) continue;
    nokta.push([x, y, gor, Math.atan2(v, u)]);
  }
  nokta.forEach(([x, y, gor, a]) => {
    const s = 0.75 + gor * 0.4, rot = f1((r() - .5) * 120);
    sus += `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(${f1(s)} ${f1(s * (0.65 + 0.35 * gor))})"><ellipse rx="2.9" ry="1.55" fill="#a85414" opacity=".55" transform="translate(.5 .8)"/><ellipse rx="2.7" ry="1.45" fill="#fff4d2"/><ellipse rx="1.3" ry=".55" cx="-.5" cy="-.45" fill="#fff" opacity=".85"/></g>`;
  });
  const defs = ortakDefs(id, { leke: 0.13, gren: 0.03, sik: 0.06, tohum: 12 }) + `
    <clipPath id="ueS"><path d="${sil}"/></clipPath>
    <radialGradient id="ueG" cx="${CX - 14}" cy="${-H + 12}" r="78" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffab3a"/><stop offset=".42" stop-color="#f7861a"/><stop offset=".8" stop-color="#e86e14"/><stop offset="1" stop-color="#c85a12"/></radialGradient>
    <linearGradient id="ueB" x1="0" y1="-22" x2="0" y2="${rB * E}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffc24a" stop-opacity="0"/><stop offset=".45" stop-color="#ffc04a" stop-opacity=".9"/><stop offset=".8" stop-color="#fbb03c" stop-opacity="1"/><stop offset="1" stop-color="#e0801e" stop-opacity="1"/></linearGradient>`;
  const g = `<g filter="url(#uedoku)">
    <path d="${sil}" fill="url(#ueG)"/>
    <g clip-path="url(#ueS)">
      <path d="M${CX - rW - 4},-16 Q${CX},${-16 + 26} ${CX + rW + 4},-16 L${CX + rW + 4},30 L${CX - rW - 4},30Z" fill="url(#ueB)" filter="url(#uebl2)"/>
      <path d="${yol(elips(CX, 0, rB + 1, rB * E + 1, 0, Math.PI, 30), false)}" stroke="#8a3a0a" stroke-width="3.5" fill="none" opacity=".45" filter="url(#uebl1)"/>
      <path d="M${CX + 20},${-H + 6} Q${CX + rW},${-38} ${CX + rW - 2},-14" stroke="#9a3c08" stroke-width="9" fill="none" opacity=".28" filter="url(#uebl4)"/>
      <ellipse cx="${CX - 18}" cy="${-H + 13}" rx="24" ry="9" fill="#fff3c8" opacity=".5" filter="url(#uebl4)" transform="rotate(-14 ${CX - 18} ${-H + 13})"/>
      <path d="M${CX - 40},${-28} Q${CX - 34},${-H + 6} ${CX - 12},${-H + 3}" stroke="#fffbe6" stroke-width="2.6" fill="none" opacity=".7" stroke-linecap="round" filter="url(#uebl1)"/>
    </g>
    ${sus}
  </g>
  <path d="${sil}" fill="none" stroke="${KONTUR}" stroke-width="${KW}" stroke-linejoin="round"/>`;
  const top = -H - 4, bot = rB * E + 4;
  return { ad: 'b-ust', svg: svg([0, top, BW, bot - top], defs, g), alt: bot, ust: -top, k: H };
}
