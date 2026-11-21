// Burger Ustası: tezgâhtaki nesneler (kesme tahtası, servis tepsisi, patates kutusu, çiğ köfte) — resmin biçeminde SVG.
// uret.mjs bunları da 3× webp'ye döker. Birim = sahne birimi.
const f1 = n => +n.toFixed(2);
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const KONTUR = '#4a1d06';
function doku(id, { leke = 0.1, gren = 0.04, sik = 0.06, tohum = 3 } = {}) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="${sik}" numOctaves="2" seed="${tohum}" result="n1"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="${tohum + 7}" result="n2"/>
    <feColorMatrix in="n1" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${leke * 3} 0 0 0 ${-leke * 1.5}" result="a1"/>
    <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${gren * 3} 0 0 0 ${-gren * 1.5}" result="a2"/>
    <feFlood flood-color="#fff6d8"/><feComposite in2="a1" operator="in" result="l1"/>
    <feFlood flood-color="#3a1400"/><feComposite in2="a2" operator="in" result="l2"/>
    <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="l1"/><feMergeNode in="l2"/></feMerge>
    <feComposite in="m" in2="SourceAlpha" operator="in"/></filter>
  <filter id="${id}b1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
  <filter id="${id}b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>`;
}
const svg = (w, h, defs, g) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${g}</svg>`;

/* ---------- kesme tahtası (hazırlık yeri): ahşap, kalın kenar, solda tutamak ---------- */
// 260×100; burgerin oturduğu yer üst yüzün ortası (130, 50)
export function tahta() {
  const r = rnd(4), W = 260, H = 100;
  // üst yüz: yuvarlak köşeli, perspektifte (arka kenar biraz dar)
  const ust = 'M44,26 Q46,18 58,18 L214,18 Q228,18 232,28 L246,62 Q250,74 236,74 L36,74 Q22,74 24,62 Z';
  const yan = 'M24,62 Q22,74 36,74 L236,74 Q250,74 246,62 L248,70 Q250,86 234,86 L36,86 Q20,86 22,70 Z';
  const tut = 'M26,38 Q6,36 5,50 Q5,64 25,64 Z';
  let damar = '';
  for (let i = 0; i < 9; i++) { const y = 23 + i * 5.6 + (r() - .5) * 2, x0 = 40 + r() * 30, x1 = 200 + r() * 40;
    damar += `<path d="M${f1(x0)},${f1(y)} C${f1(x0 + 30)},${f1(y - 4 + r() * 8)} ${f1(x0 + 70)},${f1(y - 4 + r() * 8)} ${f1((x0 + x1) / 2)},${f1(y + (r() - .5) * 4)} S${f1(x1 - 20)},${f1(y - 3 + r() * 6)} ${f1(x1)},${f1(y + (r() - .5) * 3)}" stroke="#a8692e" stroke-width="${f1(0.8 + r() * 1.2)}" fill="none" opacity="${f1(.35 + r() * .3)}" stroke-linecap="round"/>`; }
  const defs = doku('tdk', { leke: 0.12, gren: 0.06, sik: 0.05, tohum: 8 }) + `
    <linearGradient id="tdU" x1="0" y1="18" x2="0" y2="74" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e9b472"/><stop offset="1" stop-color="#d4954f"/></linearGradient>
    <linearGradient id="tdY" x1="0" y1="62" x2="0" y2="86" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a8622a"/><stop offset="1" stop-color="#7a4018"/></linearGradient>
    <clipPath id="tdC"><path d="${ust}"/></clipPath>`;
  const g = `<ellipse cx="136" cy="84" rx="124" ry="14" fill="#5a2a14" opacity=".3" filter="url(#tdkb3)"/>
  <g filter="url(#tdk)">
    <path d="${tut}" fill="#b8763a"/><ellipse cx="14" cy="52" rx="5" ry="4" fill="#5a2a10"/>
    <path d="${yan}" fill="url(#tdY)"/><path d="${ust}" fill="url(#tdU)"/>
    <g clip-path="url(#tdC)">${damar}
      <ellipse cx="196" cy="40" rx="8" ry="3.2" fill="#c07a3a" stroke="#8a4c1e" stroke-width="1.4" opacity=".6"/><ellipse cx="196" cy="40" rx="13" ry="5.5" fill="none" stroke="#a8692e" stroke-width="1" opacity=".45"/><ellipse cx="70" cy="60" rx="5" ry="2" fill="#b8723a" opacity=".5"/>
      <path d="M50,24 Q130,19 220,22" stroke="#fff0cc" stroke-width="3" fill="none" opacity=".55" filter="url(#tdkb1)"/>
      <path d="M40,72 L238,72" stroke="#8a4c1e" stroke-width="4" opacity=".35" filter="url(#tdkb1)"/>
    </g>
  </g>
  <path d="${tut}" fill="none" stroke="${KONTUR}" stroke-width="3" stroke-linejoin="round"/>
  <path d="${yan}" fill="none" stroke="${KONTUR}" stroke-width="3" stroke-linejoin="round"/>
  <path d="${ust}" fill="none" stroke="${KONTUR}" stroke-width="3" stroke-linejoin="round"/>`;
  return { ad: 'tahta', svg: svg(W, H, defs, g) };
}

/* ---------- servis tepsisi: koyu vişne çürüğü kalıp plastik, parlak kenar, kâğıt örtü ---------- */
// 280×116 (oyundaki 270×112 kutuya göre biraz taşar; kutu içinde ortalanır)
export function tepsi() {
  const W = 280, H = 116;
  const dis = 'M30,20 Q32,10 46,10 L234,10 Q248,10 250,20 L266,84 Q270,100 252,100 L28,100 Q10,100 14,84 Z';
  const kalin = 'M14,84 Q10,100 28,100 L252,100 Q270,100 266,84 L268,92 Q270,108 252,108 L28,108 Q10,108 12,92 Z';
  const ic = 'M44,22 L236,22 Q242,22 243,28 L254,80 Q255,88 247,88 L33,88 Q25,88 26,80 L37,28 Q38,22 44,22 Z';
  // kâğıt örtü: biraz döndürülmüş, kenarları dalgalı, damalı şerit
  const kagit = 'M56,26 L222,24 Q227,24 228,29 L238,78 Q239,84 233,84 L48,86 Q42,86 43,80 L51,31 Q52,26 56,26 Z';
  const sert = `<path d="M58,30.5 L222,28.5 Q225,28.5 226,31.5 L235,77 Q236,81 232,81 L50,83 Q46,83 47,79 L54,34 Q55,30.5 58,30.5Z" fill="none" stroke="#e0502a" stroke-width="2.2" opacity=".8"/>
    <path d="M61,34 L220,32.2 L229,77.5 L52,79.4Z" fill="none" stroke="#f0a050" stroke-width="1" opacity=".7" stroke-dasharray="4 3"/>`;
  const defs = doku('tpk', { leke: 0.1, gren: 0.04, sik: 0.04, tohum: 2 }) + `
    <linearGradient id="tpD" x1="0" y1="10" x2="0" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b8402a"/><stop offset=".5" stop-color="#9a2c1c"/><stop offset="1" stop-color="#7a1f14"/></linearGradient>
    <linearGradient id="tpI" x1="0" y1="22" x2="0" y2="88" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6a1a10"/><stop offset=".25" stop-color="#8a2618"/><stop offset="1" stop-color="#a0301e"/></linearGradient>
    <linearGradient id="tpK" x1="0" y1="24" x2="0" y2="86" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff3dc"/><stop offset="1" stop-color="#f4dcb8"/></linearGradient>
    <clipPath id="tpKC"><path d="${kagit}"/></clipPath>`;
  const g = `<path d="M18,96 Q16,112 40,112 L250,112 Q272,112 270,96 Z" fill="#4a1e10" opacity=".35" filter="url(#tpkb3)"/>
  <g filter="url(#tpk)">
    <path d="${kalin}" fill="#5e170e"/>
    <path d="${dis}" fill="url(#tpD)"/>
    <path d="${ic}" fill="url(#tpI)"/>
    <path d="${kagit}" fill="url(#tpK)"/>
    <g clip-path="url(#tpKC)">${sert}
      <path d="M90,40 Q140,36 200,44 M70,62 Q130,58 210,66" stroke="#e8c9a0" stroke-width="1.4" fill="none" opacity=".7"/>
      <path d="M52,32 L48,84" stroke="#c89c70" stroke-width="5" opacity=".35" filter="url(#tpkb1)"/>
    </g>
    <path d="${kagit}" fill="none" stroke="#b88a5c" stroke-width="1.4"/>
    <path d="M44,13.5 L236,13.5" stroke="#f08a6a" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    <path d="M30,24 L16,84" stroke="#e46a4a" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
    <path d="M252,26 L262,70" stroke="#4a0e06" stroke-width="3" stroke-linecap="round" opacity=".35"/>
  </g>
  <path d="${ic}" fill="none" stroke="#4a0f08" stroke-width="2"/>
  <path d="${kalin}" fill="none" stroke="${KONTUR}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="${dis}" fill="none" stroke="${KONTUR}" stroke-width="3.5" stroke-linejoin="round"/>`;
  return { ad: 'tepsi', svg: svg(W, H, defs, g) };
}

/* ---------- patates kutusu (porsiyon): kırmızı karton, içinden taşan kızarmış patatesler ---------- */
// 120×130 (eski porsiyon.webp ile aynı oran)
export function porsiyon() {
  const r = rnd(17), W = 120, H = 130;
  const cubuk = (x, y, aci, uz, gen, ton) => {
    const ca = Math.cos(aci), sa = Math.sin(aci), x2 = x + sa * uz, y2 = y - ca * uz;
    const renk = ton > .66 ? ['#ffe07a', '#f7b232'] : ton > .33 ? ['#ffd45e', '#eea024'] : ['#ffcc4a', '#e08f18'];
    const id = 'cg' + Math.round(ton * 1e4) + Math.round(x * 10);
    return { d: `<linearGradient id="${id}" x1="${f1(x - ca * gen)}" y1="${f1(y - sa * gen)}" x2="${f1(x + ca * gen)}" y2="${f1(y + sa * gen)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${renk[0]}"/><stop offset="1" stop-color="${renk[1]}"/></linearGradient>`,
      g: `<path d="M${f1(x)},${f1(y)} L${f1(x2)},${f1(y2)}" stroke="#7a3a06" stroke-width="${f1(gen + 2.6)}" stroke-linecap="round"/>
        <path d="M${f1(x)},${f1(y)} L${f1(x2)},${f1(y2)}" stroke="url(#${id})" stroke-width="${f1(gen)}" stroke-linecap="round"/>
        <path d="M${f1(x - ca * gen * .22 + sa * 3)},${f1(y - sa * gen * .22 - ca * 3)} L${f1(x2 - ca * gen * .22 - sa * 2)},${f1(y2 - sa * gen * .22 + ca * 2)}" stroke="#fff4c0" stroke-width="${f1(gen * .25)}" stroke-linecap="round" opacity=".75"/>
        <path d="M${f1(x2 - sa * 2.5)},${f1(y2 + ca * 2.5)} L${f1(x2)},${f1(y2)}" stroke="#c46a10" stroke-width="${f1(gen * .8)}" stroke-linecap="round" opacity=".55"/>` };
  };
  // arka sıra, orta sıra, ön sıra (kutunun ağzı y≈52)
  const sira = [];
  for (let i = 0; i < 9; i++) sira.push(cubuk(26 + i * 8.5 + (r() - .5) * 3, 64, (i - 4) * 0.07 + (r() - .5) * 0.12, 36 + r() * 12, 7, r()));
  for (let i = 0; i < 8; i++) sira.push(cubuk(30 + i * 8.5 + (r() - .5) * 3, 70, (i - 3.5) * 0.09 + (r() - .5) * 0.14, 28 + r() * 10, 7.5, r()));
  const on = [];
  for (let i = 0; i < 6; i++) on.push(cubuk(34 + i * 10.5 + (r() - .5) * 3, 76, (i - 2.5) * 0.12 + (r() - .5) * 0.1, 19 + r() * 7, 8, r()));
  // kutu: ön yüz (aşağı daralan), ağız kenarı ortada çukur, iki yanda kulak
  const on_yuz = 'M14,48 Q34,42 60,58 Q86,42 106,48 L96,122 Q95,126 90,126 L30,126 Q25,126 24,122 Z';
  const arka = 'M16,50 Q22,38 60,40 Q98,38 104,50 L100,60 L20,60 Z';
  const defs = doku('pk', { leke: 0.1, gren: 0.05, sik: 0.06, tohum: 5 }) + sira.map(s => s.d).join('') + on.map(s => s.d).join('') + `
    <linearGradient id="pkR" x1="14" y1="0" x2="106" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f0402c"/><stop offset=".35" stop-color="#da2a1c"/><stop offset=".8" stop-color="#b41c12"/><stop offset="1" stop-color="#8e140c"/></linearGradient>
    <linearGradient id="pkV" x1="0" y1="48" x2="0" y2="126" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#3a0400" stop-opacity="0"/><stop offset="1" stop-color="#3a0400" stop-opacity=".35"/></linearGradient>
    <clipPath id="pkC"><path d="${on_yuz}"/></clipPath>`;
  const g = `<ellipse cx="60" cy="125" rx="40" ry="5" fill="#4a1a08" opacity=".35" filter="url(#pkb1)"/>
  <path d="${arka}" fill="#7a120a" stroke="${KONTUR}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M22,56 Q60,46 98,56 L96,62 L24,62Z" fill="#3a0804" opacity=".7"/>
  <g filter="url(#pk)">${sira.map(s => s.g).join('')}</g>
  <g filter="url(#pk)">${on.map(s => s.g).join('')}</g>
  <g filter="url(#pk)">
    <path d="${on_yuz}" fill="url(#pkR)"/>
    <g clip-path="url(#pkC)">
      <path d="${on_yuz}" fill="url(#pkV)"/>
      <path d="M18,92 Q40,84 60,92 Q80,100 104,90 L104,104 Q80,112 60,104 Q40,96 18,104 Z" fill="#ffc21a"/>
      <path d="M18,92 Q40,84 60,92 Q80,100 104,90" stroke="#a85a00" stroke-width="1.4" fill="none" opacity=".6"/>
      <path d="M20,52 Q34,48 58,62" stroke="#ff9a7a" stroke-width="2.6" fill="none" opacity=".75" stroke-linecap="round"/>
      <path d="M24,58 L30,120" stroke="#ff8a6a" stroke-width="5" opacity=".35" filter="url(#pkb1)"/>
      <ellipse cx="60" cy="74" rx="11" ry="9" fill="#fff4dc" stroke="#7a2a06" stroke-width="1.6"/>
      <path d="M53,75 Q60,64 67,75 Z M52,76 L68,76 M53,78 Q60,82 67,78" stroke="#c45a10" stroke-width="1.6" fill="#f6a030" stroke-linejoin="round"/>
    </g>
  </g>
  <path d="${on_yuz}" fill="none" stroke="${KONTUR}" stroke-width="3" stroke-linejoin="round"/>`;
  return { ad: 'porsiyon', svg: svg(W, H, defs, g) };
}

/* ---------- çiğ köfte (ızgaraya düşen): resimdeki pişmiş köfteyle (kofte.webp, 102×58) aynı biçim, ızgara izi yok ---------- */
export function kofteCig() {
  const r = rnd(31), W = 102, H = 58, cx = 51, cy = 25, rx = 47, ry = 22.5, K = 8.5;
  const rf = t => 1 + 0.02 * Math.sin(5 * t + 1) + 0.012 * Math.sin(11 * t + 2);
  const P = (y0, a0, a1) => { const a = []; for (let i = 0; i <= 50; i++) { const t = a0 + (a1 - a0) * i / 50; a.push([cx + Math.cos(t) * rx * rf(t), y0 + Math.sin(t) * ry * rf(t)]); } return a; };
  const yolP = pts => 'M' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join('L') + 'Z';
  const sil = yolP([...P(cy, Math.PI, 2 * Math.PI), ...P(cy + K, 0, Math.PI)]);
  const ust = yolP(P(cy, 0, 2 * Math.PI));
  let lek = '';
  for (let i = 0; i < 60; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.9, x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    lek += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(0.8 + r() * 2.2)}" ry="${f1(0.5 + r() * 1.2)}" fill="${r() < .55 ? '#f6b4b4' : '#8a1a24'}" opacity="${f1(.35 + r() * .4)}"/>`; }
  const defs = doku('kck', { leke: 0.16, gren: 0.14, sik: 0.18, tohum: 21 }) + `
    <radialGradient id="kcU" cx="${cx - 12}" cy="${cy - 6}" r="56" gradientTransform="translate(0 ${(cy - 6) * 0.53}) scale(1 .47)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ec7a7e"/><stop offset=".55" stop-color="#d4505a"/><stop offset="1" stop-color="#a8323e"/></radialGradient>
    <clipPath id="kcC"><path d="${ust}"/></clipPath>`;
  const g = `<g filter="url(#kck)"><path d="${sil}" fill="#8e2430"/>
    <path d="${ust}" fill="url(#kcU)"/>
    <g clip-path="url(#kcC)">${lek}
      <ellipse cx="${cx - 14}" cy="${cy - 8}" rx="16" ry="5" fill="#ffe4e0" opacity=".45" filter="url(#kckb1)"/>
      <path d="${ust}" fill="none" stroke="#6a1420" stroke-width="5" opacity=".35" filter="url(#kckb3)"/></g>
    <path d="${yolP(P(cy, 0.05, Math.PI - 0.05)).slice(0, -1)}" fill="none" stroke="#5a1018" stroke-width="1.3" opacity=".7"/></g>
  <path d="${sil}" fill="none" stroke="#3e0a0e" stroke-width="2.6" stroke-linejoin="round"/>`;
  return { ad: 'kofte-cig', svg: svg(W, H, defs, g) };
}

export function hepsi() { return [tahta(), tepsi(), porsiyon(), kofteCig()]; }
