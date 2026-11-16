/* Elle tasarım katmanı (SO.tasarim): prosedürel dünyanın üstüne, veriyle tanımlanan bölgeler.
   Kılavuz (veri biçimi, bütün ilkeller, araçlar): tasarim/KILAVUZ.md. Bu dosya gorunum.js ve arazi.js'ten ÖNCE yüklenir.

   arazi.js'in okuduğu kancalar (en az bir bölgenin `sinir`ı varsa tanımlanır; hiç etkin bölge yoksa tanımsızdır ve dünya yalnız algoritmadan gelir):
     yukseklik(x, z, h)        prosedürel yüksekliği alır, tasarlanmış yüksekliği döndürür (bölge dışında h aynen döner)
     yerlesim(px, pz, D)       aday nesne noktası için D = { b, biyom, h, egim, koru, tas, yasak, tur, olcek }'i değiştirir
     ekNesneler(ci, cj, HUCRE) 256 m'lik hücreye tek tek konan nesneler [{ tur, x, z, s, ry, id }]
     dogus                     { x, z, yon } ya da null
   Öbür dosyaların kancaları: zemin(x, z) → { toprak, cakil, kum } | null (gorunum.js: köşe dokusu, çim tutamı), toplama(x, z) → { dal, tas, dalEk, tasEk } | null (toplama.js).
   Araçlar ve ileride harita için: noktalar (ilgi noktaları), patikalar, bolgeler (derlenmiş bölgeler), agirlik(x, z), turler (yeni nesne türleri: arazi.js bağlayacak).

   Veri: SO.tasarim.bolge({ id, ad, sinir, gecis, taban, engebe, mikro, varsayilan, dogus, katman, sekiller, alanlar, nesneler, noktalar }).
   Aynı id ile yapılan her çağrı o bölgeye katman ekler (dosyalar çakışmadan bölünür). Uygulama sırası: katman sırası (KATMAN tablosu), sonra dizi sırası.

   Yükseklik hattı (bölge içinde, nokta başına): taban (prosedürel | düz | ızgara | noktalar) + engebe → şekiller sırayla → mikro engebe → bölge kenarında
   prosedürel yükseklikle karışım (ağırlık: sınırdan içeri `gecis` metrede 0 → 1). Şekiller 64 m'lik ızgaraya dizinlenir: nokta yalnız kendi hücresine
   değen şekilleri (ve o şekillerin yalnız yakın doğru parçalarını) dolaşır. */
(function () {
  'use strict';
  const SO = window.SO, clamp = SO.clamp, lerp = SO.lerp, TAU = Math.PI * 2;
  const sm = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };
  function hash(ix, iz, s) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz), a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
  const fbm2 = (x, z, s) => vnoise(x, z, s) * .667 + vnoise(x * 2.13, z * 2.13, s + 17) * .333;
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
  const HC = 64, BUYUK = 1e9;
  const KATMAN = { bolge: 0, arazi: 10, su: 20, yerlesim: 30, bitki: 40, isaret: 50 }; // katman adı → uygulama sırası (küçük olan önce)
  const hata = m => { throw new Error('tasarim: ' + m); };

  /* ---------- adres: ?tasarim=yok (katman kapalı) | ?tasarim=deneme[,b002] (yalnız bu bölgeler; index.html'de olmayanlar tasarim/<ad>/bolge.js'ten yüklenir) ---------- */
  const secim = (() => { const m = /[?&]tasarim=([^&]*)/.exec(location.search); return m ? decodeURIComponent(m[1]).split(',').filter(Boolean) : null; })();
  const kapali = !!secim && secim.includes('yok');

  /* ---------- geometri kaynakları: doğru parçası yığını (çizgi / çokgen) ve daire ---------- */
  // çizgi(ler): noktalar [x, z, ek1, ek2]; ek1/ek2 parça boyunca doğrusal aradeğerlenir (ör. yükseklik, genişlik). Çok çizgili olabilir (sırt + kollar).
  function yiginKur(cizgiler, kapaliMi, v1, v2) {
    let n = 0; for (const c of cizgiler) n += c.length - (kapaliMi ? 0 : 1);
    const S = { tip: kapaliMi ? 'c' : 'l', n, ax: new Float64Array(n), az: new Float64Array(n), dx: new Float64Array(n), dz: new Float64Array(n), il: new Float64Array(n), s0: new Float64Array(n), len: new Float64Array(n),
      va: new Float64Array(n), vb: new Float64Array(n), wa: new Float64Array(n), wb: new Float64Array(n), x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9, L: 0 };
    let k = 0;
    for (const c of cizgiler) { if (!Array.isArray(c) || c.length < (kapaliMi ? 3 : 2)) hata('çizgi en az 2, çokgen en az 3 nokta ister'); let s = 0; const m = c.length - (kapaliMi ? 0 : 1);
      for (let i = 0; i < m; i++) { const a = c[i], b = c[(i + 1) % c.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-6;
        if (!isFinite(a[0] + a[1] + b[0] + b[1])) hata('nokta sayı değil: ' + JSON.stringify(a));
        S.ax[k] = a[0]; S.az[k] = a[1]; S.dx[k] = dx; S.dz[k] = dz; S.il[k] = 1 / (L * L); S.s0[k] = s; S.len[k] = L; s += L;
        S.va[k] = a[2] == null ? v1 : a[2]; S.vb[k] = b[2] == null ? v1 : b[2]; S.wa[k] = a[3] == null ? v2 : a[3]; S.wb[k] = b[3] == null ? v2 : b[3]; k++;
        S.x0 = Math.min(S.x0, a[0], b[0]); S.x1 = Math.max(S.x1, a[0], b[0]); S.z0 = Math.min(S.z0, a[1], b[1]); S.z1 = Math.max(S.z1, a[1], b[1]); }
      if (s > S.L) S.L = s; }
    return S;
  }
  // alan: [[x, z], ...] çokgen | { daire: [x, z, r] } | { kutu: [x0, z0, x1, z1] }
  function alanKur(a) {
    if (Array.isArray(a)) return yiginKur([a], true, 0, 0);
    if (a && a.kutu) { const [x0, z0, x1, z1] = a.kutu; return yiginKur([[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]], true, 0, 0); }
    if (a && a.daire) { const [x, z, r] = a.daire; if (!(r > 0)) hata('daire yarıçapı'); return { tip: 'd', cx: x, cz: z, r, x0: x - r, x1: x + r, z0: z - r, z1: z + r }; }
    hata('alan: çokgen [[x,z],...], { daire: [x,z,r] } ya da { kutu: [x0,z0,x1,z1] } olmalı');
  }
  // en yakın parça: U.d (uzaklık), U.i, U.t (parça içi 0..1), U.s (çizgi boyunca yol, m), U.yan (+1: çizginin sağı, −1: solu; harita kuzey yukarıyken gidiş yönüne göre)
  const U = { d: 0, i: 0, t: 0, s: 0, yan: 1 };
  function yakin(S, segs, x, z) {
    let en = 1e30, ei = -1, et = 0; const n = segs ? segs.length : S.n;
    for (let q = 0; q < n; q++) { const i = segs ? segs[q] : q, px = x - S.ax[i], pz = z - S.az[i]; let t = (px * S.dx[i] + pz * S.dz[i]) * S.il[i]; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = px - S.dx[i] * t, ez = pz - S.dz[i] * t, d = ex * ex + ez * ez; if (d < en) { en = d; ei = i; et = t; } }
    if (ei < 0) { U.d = BUYUK; return BUYUK; }
    U.d = Math.sqrt(en); U.i = ei; U.t = et; U.s = S.s0[ei] + et * S.len[ei]; U.yan = S.dx[ei] * (z - S.az[ei]) - S.dz[ei] * (x - S.ax[ei]) >= 0 ? 1 : -1; return U.d;
  }
  function icinde(S, x, z) { let ic = false; for (let i = 0; i < S.n; i++) { const az = S.az[i], bz = az + S.dz[i]; if ((az > z) !== (bz > z) && x < S.ax[i] + S.dx[i] * (z - az) / S.dz[i]) ic = !ic; } return ic; }
  // işaretli uzaklık: + içeride, − dışarıda. e: dizin girdisi ({ segs, ic }) ya da null (bütün kenarlar)
  function isaretli(S, e, x, z) {
    if (S.tip === 'd') return S.r - Math.hypot(x - S.cx, z - S.cz);
    if (e && e.ic) return BUYUK;
    const d = yakin(S, e ? e.segs : null, x, z); return icinde(S, x, z) ? d : -d;
  }

  /* ---------- nokta başına ortak gürültü (tembel: yalnız isteyen şekil hesaplatır) ---------- */
  let gx = 0, gz = 0, gt = 0, g1v = 0, g1ok = false, g2v = 0, g2ok = false, g3v = 0, g3ok = false, mik = 1;
  const G1 = () => { if (!g1ok) { g1ok = true; g1v = fbm2(gx / 31, gz / 31, gt + 1) - .5; } return g1v; };  // ince (≈ 30 m), −.5 … .5
  const G3 = () => { if (!g3ok) { g3ok = true; g3v = fbm2(gx / 83, gz / 83, gt + 3) - .5; } return g3v; };  // geniş, G2'den bağımsız (kıvrım için ikinci eksen)
  const G2 = () => { if (!g2ok) { g2ok = true; g2v = fbm2(gx / 97, gz / 97, gt + 2) - .5; } return g2v; };  // geniş (≈ 100 m)

  /* ---------- şekil ilkelleri ----------
     kur(p, B): parametreleri doğrular, p.K = [{ S (kaynak), R (dışa etki, m), Ri (içe etki, m) }] dizinlenecek kaynakları verir.
     f(p, e, x, z, y) → yeni y. e: dizin girdisi { p, S, segs, ic }. */
  const say = (v, vars) => v == null ? vars : +v, PROF = { yuvarlak: 0, sivri: 1, plato: 2 };
  const tekCizgi = (p, v1, v2) => { if (!p.cizgi) hata(p.tip + ': cizgi yok'); return yiginKur([p.cizgi], false, v1, v2); };
  const ucSon = (p, S) => p.uc > 0 ? sm(0, p.uc, U.s) * sm(0, p.uc, S.L - U.s) : 1;
  const SEKIL = {
    // tepe: tek yükselti. profil: yuvarlak (kubbe) | sivri (zirve) | plato (düz tepe). yukseklik eksi olabilir (çanak)
    tepe: { kur(p) { const r = p.yaricap; p.rx = Array.isArray(r) ? r[0] : r; p.rz = Array.isArray(r) ? r[1] : r; if (!(p.rx > 0 && p.rz > 0) || !p.merkez) hata('tepe: merkez ve yaricap gerekli'); p.H = say(p.yukseklik, 20); p.pf = PROF[p.profil || 'yuvarlak']; if (p.pf == null) hata('tepe profil: yuvarlak | sivri | plato');
        p.pr = say(p.puruz, .35); p.dz = say(p.duz, .45); const a = (p.aci || 0) * Math.PI / 180; p.ca = Math.cos(a); p.sa = Math.sin(a); p.cx = p.merkez[0]; p.cz = p.merkez[1];
        p.K = [{ S: alanKur({ daire: [p.cx, p.cz, Math.max(p.rx, p.rz) * 1.3] }), R: 0, Ri: 0 }]; },
      f(p, e, x, z, y) { const dx = x - p.cx, dz = z - p.cz, u = (dx * p.ca + dz * p.sa) / p.rx, v = (dz * p.ca - dx * p.sa) / p.rz; let t = Math.sqrt(u * u + v * v); if (t >= 1.3) return y;
        if (p.pr) t += G2() * p.pr * .9 * t; if (t >= 1) return y; let k; if (p.pf === 0) { k = 1 - t * t; k *= k; } else if (p.pf === 1) { k = 1 - t; k *= k; } else k = 1 - sm(p.dz, 1, t);
        return y + p.H * k * (1 + (p.pr ? G1() * p.pr * .7 : 0)); } },
    // sırt: çizgi(ler) boyunca dağ sırtı; nokta [x, z, yükseklik, yarı genişlik]. kollar: yan sırt çizgileri. Parçaların en büyüğü alınır (birleşim)
    sirt: { kur(p) { p.H = say(p.yukseklik, 40); p.W = say(p.genislik, 120); p.pf = PROF[p.profil || 'yuvarlak']; p.pr = say(p.puruz, .35); if (!p.cizgi) hata('sirt: cizgi yok'); p.kv = say(p.kivrim, p.W * .35);
        const S = yiginKur([p.cizgi].concat(p.kollar || []), false, p.H, p.W); let w = 0; for (let i = 0; i < S.n; i++) w = Math.max(w, S.wa[i], S.wb[i]); p.wm = w; p.K = [{ S, R: w * 1.25 + p.kv, Ri: 0 }]; },
      f(p, e, x, z, y) { const S = e.S, segs = e.segs, wob = p.pr ? G2() * p.pr * .8 : 0; let en = 0; if (p.kv) { x += G2() * 2 * p.kv; z += G3() * 2 * p.kv; }
        for (let q = 0; q < segs.length; q++) { const i = segs[q], px = x - S.ax[i], pz = z - S.az[i]; let t = (px * S.dx[i] + pz * S.dz[i]) * S.il[i]; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = px - S.dx[i] * t, ez = pz - S.dz[i] * t;
          let tt = Math.sqrt(ex * ex + ez * ez) / (S.wa[i] + (S.wb[i] - S.wa[i]) * t); tt += wob * tt; if (tt >= 1) continue; let k = 1 - tt; if (p.pf === 1) k = k * Math.sqrt(k); else { k = 1 - tt * tt; k *= k; } const c = (S.va[i] + (S.vb[i] - S.va[i]) * t) * k; if (c > en) en = c; }
        return en > 0 ? y + en * (1 + (p.pr ? G1() * p.pr * .6 : 0)) : y; } },
    // vadi / oluk: çizgi boyunca alçaltma; nokta [x, z, derinlik (ya da kot), yarı genişlik]. kot verilirse taban o mutlak yüksekliğe iner (yalnız alçaltır)
    vadi: { kur(p) { p.kotlu = p.kot != null; p.D = p.kotlu ? +p.kot : say(p.derinlik, 10); p.W = say(p.genislik, 60); p.to = say(p.taban, p.profil === 'v' ? 0 : .3); p.pr = say(p.puruz, .25); p.kv = say(p.kivrim, p.W * .25);
        const S = tekCizgi(p, p.D, p.W); let w = 0; for (let i = 0; i < S.n; i++) w = Math.max(w, S.wa[i], S.wb[i]); p.K = [{ S, R: w * 1.2 + p.kv, Ri: 0 }]; },
      f(p, e, x, z, y) { const S = e.S, segs = e.segs, wob = p.pr ? G2() * p.pr * .7 : 0; let en = 0, ev = 0; if (p.kv) { x += G3() * 2 * p.kv; z += G2() * 2 * p.kv; }
        for (let q = 0; q < segs.length; q++) { const i = segs[q], px = x - S.ax[i], pz = z - S.az[i]; let t = (px * S.dx[i] + pz * S.dz[i]) * S.il[i]; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = px - S.dx[i] * t, ez = pz - S.dz[i] * t;
          let tt = Math.sqrt(ex * ex + ez * ez) / (S.wa[i] + (S.wb[i] - S.wa[i]) * t); tt += wob * tt; if (tt >= 1) continue; const k = 1 - sm(p.to, 1, tt), v = S.va[i] + (S.vb[i] - S.va[i]) * t;
          if (p.kotlu) { if (k > en) { en = k; ev = v; } } else if (v * k > en) en = v * k; }
        if (en <= 0) return y; return p.kotlu ? (y > ev ? y + (ev - y) * en : y) : y - en; } },
    // düzlük / plato: alanın içini tek yüksekliğe getirir (içeride eğim ≈ 0; mikro engebe kısılır), dışarıda `kenar` metrede araziye kavuşur
    duzluk: { kur(p) { p.kn = say(p.kenar, 40); p.mk = say(p.mikro, .2); p.Y = p.y == null ? null : +p.y; if (!p.alan) hata('duzluk: alan yok'); p.K = [{ S: alanKur(p.alan), R: p.kn, Ri: 0 }]; p.bos = p.bos !== false; },
      tembel(p, B, once) { if (p.Y != null) return; const S = p.K[0].S, pts = []; if (S.tip === 'd') { pts.push([S.cx, S.cz]); for (let k = 0; k < 8; k++) pts.push([S.cx + Math.cos(k * .785) * S.r * .7, S.cz + Math.sin(k * .785) * S.r * .7]); } else { let mx = 0, mz = 0; for (let i = 0; i < S.n; i++) { mx += S.ax[i]; mz += S.az[i]; } mx /= S.n; mz /= S.n; pts.push([mx, mz]); for (let i = 0; i < S.n; i++) pts.push([(S.ax[i] + mx) / 2, (S.az[i] + mz) / 2]); }
        let t = 0; for (const q of pts) t += once(q[0], q[1]); p.Y = t / pts.length; },
      f(p, e, x, z, y) { if (p.Y == null) return y; const s = isaretli(e.S, e, x, z), w = sm(-p.kn, 0, s); if (w <= 0) return y; mik *= 1 - w * (1 - p.mk); return y + (p.Y - y) * w; } },
    // uçurum: çizgi boyunca basamak. yan: yüksek kalan taraf ('sol' | 'sag'; çizginin gidiş yönüne göre). kip 'yukselt': yüksek yan kalkar ve `etki` metrede geri iner; 'kes': alçak yan oyulur
    ucurum: { kur(p) { p.H = say(p.yukseklik, 12); p.g = say(p.genislik, 8); p.et = say(p.etki, 90); p.uc = say(p.uc, 40); p.pr = say(p.puruz, 5); p.yon = p.yan === 'sol' ? -1 : p.yan === 'sag' ? 1 : hata('ucurum: yan "sol" ya da "sag" olmalı'); p.kes = p.kip === 'kes';
        p.K = [{ S: tekCizgi(p, 0, 0), R: p.et + p.pr + p.g, Ri: 0 }]; },
      f(p, e, x, z, y) { if (yakin(e.S, e.segs, x, z) > p.et + p.pr + p.g) return y; const uc = ucSon(p, e.S); if (uc <= 0) return y; const sd = U.d * U.yan * p.yon + (p.pr ? G1() * p.pr * 2 : 0), yuz = sm(-p.g / 2, p.g / 2, sd);
        return p.kes ? y - p.H * (1 - yuz) * (1 - sm(p.et * .4, p.et, -sd)) * uc : y + p.H * yuz * (1 - sm(p.et * .4, p.et, sd)) * uc; } },
    // teras: alan içindeki yamacı basamaklara böler (basamak yüksekliği m; dik: basamağın ne kadarı şev, 0..1)
    teras: { kur(p) { p.b = say(p.basamak, 4); p.dk = clamp(say(p.dik, .3), .05, 1); p.kn = say(p.kenar, 30); p.t0 = say(p.kot, 0); if (!p.alan) hata('teras: alan yok'); p.K = [{ S: alanKur(p.alan), R: p.kn, Ri: 0 }]; },
      f(p, e, x, z, y) { const w = sm(-p.kn, 0, isaretli(e.S, e, x, z)); if (w <= 0) return y; const q = (y - p.t0) / p.b, fl = Math.floor(q); return y + ((fl + sm(1 - p.dk, 1, q - fl)) * p.b + p.t0 - y) * w; } },
    // çukur: kuru çanak (göreli alçaltma)
    cukur: { kur(p) { p.D = say(p.derinlik, 5); p.kn = say(p.kenar, 30); p.pr = say(p.puruz, 4); if (!p.alan) hata('cukur: alan yok'); p.K = [{ S: alanKur(p.alan), R: p.kn + p.pr, Ri: 0 }]; },
      f(p, e, x, z, y) { const w = sm(-p.kn, 0, isaretli(e.S, e, x, z) + (p.pr ? G2() * p.pr * 2 : 0)); return w > 0 ? y - p.D * w : y; } },
    // göl: su altına inen havza (su yüzeyi y = 0). İçeride sahanlık (sığ kıyı şeridi) + derine iniş; dışarıda arazi kıyıya doğru alçalır
    gol: { kur(p) { p.D = say(p.derinlik, 4); p.sh = say(p.sahanlik, 8); p.in = say(p.inis, 14); p.ym = say(p.yamac, .2); p.et = say(p.etki, 120); p.pr = say(p.puruz, 5); p.ky = say(p.kiyiY, .3); if (!p.alan) hata('gol: alan yok');
        p.K = [{ S: alanKur(p.alan), R: p.et + p.pr, Ri: p.sh + p.in + p.pr }]; },
      f(p, e, x, z, y) { const s = isaretli(e.S, e, x, z) + (p.pr ? G2() * p.pr * 2 : 0); if (s <= -p.et) return y;
        if (s >= 0) { const hd = p.ky - (p.ky + .55) * sm(0, p.sh, s) - (p.D - .55) * sm(p.sh, p.sh + p.in, s); return y < hd ? y : hd; }
        const yy = smin(y, p.ky - s * p.ym, 2); return y + (yy - y) * (1 - sm(p.et * .7, p.et, -s)); } },
    // nehir: çizgi boyunca yatak (su yüzeyi y = 0: yatak 0'ın altına iner, çevre arazi nehre doğru alçalır). nokta [x, z, genişlik]. sig: [{ nokta: [x, z], uzunluk }] yürünerek geçilen sığ geçitler
    nehir: { kur(p) { p.W = say(p.genislik, 14); p.D = say(p.derinlik, 2.2); p.sd = say(p.sigDerinlik, .32); p.ky = say(p.kiyi, 10); p.kY = say(p.kiyiY, .7); p.ym = say(p.yamac, .3); p.et = say(p.etki, 140); p.pr = say(p.puruz, 3);
        const S = yiginKur([p.cizgi.map(q => [q[0], q[1], q[2]])], false, p.W, 0); let w = 0; for (let i = 0; i < S.n; i++) w = Math.max(w, S.va[i], S.vb[i]); p.K = [{ S, R: w / 2 + p.et + p.pr, Ri: 0 }];
        p.sg = (p.sig || []).map(g => { yakin(S, null, g.nokta[0], g.nokta[1]); const i = U.i, t = U.t; return { s: U.s, u: say(g.uzunluk, 14) / 2, x: S.ax[i] + S.dx[i] * t, z: S.az[i] + S.dz[i] * t, ad: g.ad }; }); },
      f(p, e, x, z, y) { const S = e.S; if (yakin(S, e.segs, x, z) >= BUYUK) return y; const yari = (S.va[U.i] + (S.vb[U.i] - S.va[U.i]) * U.t) / 2, d = U.d + (p.pr ? G1() * p.pr * 2 : 0), o = d - yari; if (o >= p.et) return y;
        let hd; if (o < 0) { let D = p.D; for (let k = 0; k < p.sg.length; k++) { const g = p.sg[k], a = 1 - sm(g.u, g.u + 7, Math.abs(U.s - g.s)); if (a > 0) D = D + (p.sd - D) * a; } const q = d > 0 ? d / yari : 0; hd = -D * (1 - q * q); }
        else hd = p.kY * sm(0, p.ky, o) + (o > p.ky * .6 ? (o - p.ky * .6) * p.ym : 0);
        const yy = smin(y, hd, 1.5); return y + (yy - y) * (1 - sm(p.et * .7, p.et, o)); } },
    // patika: çizgi boyunca enine düzleştirme (patika, kendi orta çizgisinin yüksekliğine çekilir) + çıplak toprak + üstünde nesne yok. rampa: uçlar arası doğrusal eğim (geçit/rampa)
    patika: { kur(p) { p.g = say(p.genislik, 3); p.kn = say(p.kenar, 3); p.gc = clamp(say(p.guc, 1), 0, 1); p.yu = say(p.yumusat, 14); p.tp = say(p.toprak, .9); p.K = [{ S: tekCizgi(p, 0, 0), R: p.g / 2 + Math.max(p.kn, 4), Ri: 0 }]; },
      tembel(p, B, once) { const S = p.K[0].S, n = Math.max(2, Math.ceil(S.L / 3) + 1), ad = S.L / (n - 1), H = new Float32Array(n); let i = 0, s = 0;
        for (let k = 0; k < n; k++) { const hs = Math.min(S.L - 1e-6, k * ad); while (i < S.n - 1 && hs > s + S.len[i]) { s += S.len[i]; i++; } const t = (hs - s) / S.len[i]; H[k] = once(S.ax[i] + S.dx[i] * t, S.az[i] + S.dz[i] * t); }
        if (p.rampa) { const a = H[0], b = H[n - 1]; for (let k = 0; k < n; k++) H[k] = a + (b - a) * k / (n - 1); }
        else { const w = Math.round(p.yu / ad / 2); if (w > 0) for (let tur = 0; tur < 2; tur++) { const C = H.slice(); for (let k = 1; k < n - 1; k++) { let t = 0, c = 0; for (let j = Math.max(0, k - w); j <= Math.min(n - 1, k + w); j++) { t += C[j]; c++; } H[k] = t / c; } } }
        p.Hp = H; p.adm = ad; },
      f(p, e, x, z, y) { if (!p.Hp || yakin(e.S, e.segs, x, z) >= p.g / 2 + p.kn) return y; const w = (1 - sm(p.g / 2, p.g / 2 + p.kn, U.d)) * p.gc; if (w <= 0) return y;
        const q = U.s / p.adm, k = Math.min(p.Hp.length - 2, Math.floor(q)), yc = p.Hp[k] + (p.Hp[k + 1] - p.Hp[k]) * (q - k); mik *= 1 - w * .6; return y + (yc - y) * w; } },
    // kıyı: çizgi kıyı çizgisidir. su: suyun kaldığı taraf ('sol' | 'sag'). Su yanı 0'ın altına iner, kara yanı sahilden başlayıp yükselir (kıyıyı iki yönden de zorlar)
    kiyi: { kur(p) { p.yon = p.su === 'sol' ? -1 : p.su === 'sag' ? 1 : hata('kiyi: su "sol" ya da "sag" olmalı'); p.D = say(p.derinlik, 5); p.ac = say(p.acik, 40); p.sg = say(p.suGenislik, 250); p.sh = say(p.sahil, 14); p.sY = say(p.sahilY, 1.2); p.ym = say(p.yamac, .25); p.et = say(p.etki, 120); p.pr = say(p.puruz, 6); p.uc = say(p.uc, 60);
        p.K = [{ S: tekCizgi(p, 0, 0), R: Math.max(p.sg, p.et) + p.pr, Ri: 0 }]; },
      f(p, e, x, z, y) { if (yakin(e.S, e.segs, x, z) >= BUYUK) return y; const uc = ucSon(p, e.S); if (uc <= 0) return y; const sd = U.d * U.yan * p.yon + (p.pr ? G2() * p.pr * 2 : 0);
        if (sd >= 0) { if (sd >= p.sg) return y; const hd = -.08 - p.D * sm(0, p.ac, sd); return y + (Math.min(y, hd) - y) * (1 - sm(p.sg * .7, p.sg, sd)) * uc; }
        const o = -sd; if (o >= p.et) return y; const alt = p.sY * sm(0, p.sh, o), ust = alt + (o > p.sh ? (o - p.sh) * p.ym : 0); return y + (Math.max(alt, smin(y, ust, 2)) - y) * (1 - sm(p.et * .7, p.et, o)) * uc; } },
    // kaya çıkıntısı: yamaçta dik yüzlü, basamaklı tepeli kayalık (arazi gölgelendiricisi dik yüzü kaya dokusuyla boyar); çevresine kaya nesneleri serper
    kaya_cikinti: { kur(p, B) { p.r = say(p.yaricap, 16); p.H = say(p.yukseklik, 8); p.pr = say(p.puruz, .3); if (!p.merkez) hata('kaya_cikinti: merkez yok'); p.cx = p.merkez[0]; p.cz = p.merkez[1]; p.K = [{ S: alanKur({ daire: [p.cx, p.cz, p.r * 1.3] }), R: 0, Ri: 0 }];
        const n = p.kayalar == null ? Math.round(4 + p.r / 4) : p.kayalar, R = SO.rnd(Math.round(p.cx * 13 + p.cz * 7) + 5); for (let k = 0; k < n; k++) { const a = R() * TAU, d = p.r * (.8 + R() * .5), s = 1.2 + R() * R() * 2.6; B.nesneler.push({ tur: 'kaya', x: p.cx + Math.cos(a) * d, z: p.cz + Math.sin(a) * d, s, ry: R() * TAU, oto: true }); } },
      f(p, e, x, z, y) { let t = Math.hypot(x - p.cx, z - p.cz) / p.r; if (t >= 1.3) return y; t += G1() * p.pr * 1.4; if (t >= 1) return y; const b = vnoise(x / 7, z / 7, 733), bl = Math.floor(b * 4) / 4 + sm(.8, 1, b * 4 % 1) * .25; return y + p.H * (.6 + .4 * bl) * (1 - sm(.55, 1, t)); } }
  };
  SEKIL.plato = SEKIL.duzluk; SEKIL.oluk = SEKIL.vadi;

  /* ---------- alan ilkelleri (nesne yerleşimi, zemin dokusu, toplanabilir yoğunluğu) ---------- */
  const AGACMI = t => t.startsWith('yaprakli') || t.startsWith('cam') || t === 'cali' || t === 'devAgac';
  const SERPME = { koru: { turler: { yaprakli1: 1, yaprakli2: 1 }, yogunluk: .3, kenar: 18, kume: .4 }, taslik: { turler: { kaya: 3, duzAlcak: 1, duzOrta: .7, duzYuksek: .4 }, yogunluk: .12, kenar: 8, kume: .5, boy: [.5, 2.2] }, cali_alani: { turler: { cali: 1 }, yogunluk: .15, kenar: 10, kume: .3 }, serpme: { turler: null, yogunluk: .1, kenar: 8, kume: 0 } };
  function alanHazirla(a, B) {
    const S = alanKur(a.alan || hata(a.tip + ': alan yok')); a.S = S; a.pr = say(a.puruz, 6);
    if (SERPME[a.tip]) { const V = SERPME[a.tip], tl = a.turler || V.turler || hata('serpme: turler gerekli'); a.yg = clamp(say(a.yogunluk, V.yogunluk), 0, 1); a.kn = say(a.kenar, V.kenar); a.km = clamp(say(a.kume, V.kume), 0, 1); a.vr = clamp(say(a.varsayilan, 0), 0, 1); a.boy = a.boy || V.boy || null;
      let top = 0; for (const k in tl) top += tl[k]; a.tl = Object.keys(tl).map(k => [k, tl[k] / top, AGACMI(k)]); a.sinif = 's'; }
    else if (a.tip === 'aciklik') { a.kn = say(a.kenar, 10); a.sinif = 'a'; }
    else if (a.tip === 'yasak') { a.kn = say(a.kenar, 0); a.pr = say(a.puruz, 0); a.sinif = 'y'; }
    else if (a.tip === 'zemin') { a.kn = say(a.kenar, 6); a.sinif = 'z'; a.tp = clamp(say(a.toprak, 0), 0, 1); a.ck = clamp(say(a.cakil, 0), 0, 1); a.km2 = clamp(say(a.kum, 0), 0, 1); }
    else if (a.tip === 'kaynak') { a.kn = say(a.kenar, 6); a.sinif = 'k'; a.dal = say(a.dal, 1); a.tas = say(a.tas, 1); a.dalEk = say(a.dalEk, 0); a.tasEk = say(a.tasEk, 0); }
    else hata('bilinmeyen alan tipi: ' + a.tip);
  }
  const alanAgirlik = (a, e, x, z) => { const s = isaretli(a.S, e, x, z); if (s >= BUYUK) return 1; const v = s + (a.pr ? G1() * a.pr * 2 : 0); return a.kn > 0 ? sm(0, a.kn, v) : v >= 0 ? 1 : 0; };

  /* ---------- 64 m dizin ---------- */
  function dizinKur(B) { B.gi = Math.floor(B.x0 / HC); B.gj = Math.floor(B.z0 / HC); B.gn = Math.floor(B.x1 / HC) - B.gi + 1; B.gm = Math.floor(B.z1 / HC) - B.gj + 1; const n = B.gn * B.gm; B.gy = new Array(n).fill(null); B.ga = new Array(n).fill(null); B.gzm = new Array(n).fill(null); }
  function dizinEkle(B, G, p, S, R, Ri) {
    const i0 = Math.max(0, Math.floor((S.x0 - R) / HC) - B.gi), i1 = Math.min(B.gn - 1, Math.floor((S.x1 + R) / HC) - B.gi), j0 = Math.max(0, Math.floor((S.z0 - R) / HC) - B.gj), j1 = Math.min(B.gm - 1, Math.floor((S.z1 + R) / HC) - B.gj), yc = HC * .7072, Rm = Math.max(R, Ri) + yc;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx = (B.gi + i + .5) * HC, cz = (B.gj + j + .5) * HC; let e = null;
      if (S.tip === 'd') { if (Math.hypot(cx - S.cx, cz - S.cz) - S.r > R + yc) continue; e = { p, S, segs: null, ic: false }; }
      else { const L = []; for (let k = 0; k < S.n; k++) { const px = cx - S.ax[k], pz = cz - S.az[k]; let t = (px * S.dx[k] + pz * S.dz[k]) * S.il[k]; t = t < 0 ? 0 : t > 1 ? 1 : t; let lim = Rm; if (S.tip === 'l' && p.sirtGibi) lim = Math.max(S.wa[k], S.wb[k]) * 1.25 + (p.kv || 0) + yc; if (Math.hypot(px - S.dx[k] * t, pz - S.dz[k] * t) <= lim) L.push(k); }
        if (L.length) e = { p, S, segs: Int32Array.from(L), ic: false }; else if (S.tip === 'c' && icinde(S, cx, cz)) e = { p, S, segs: null, ic: true }; else continue; }
      const q = j * B.gn + i; (G[q] = G[q] || []).push(e); }
  }

  /* ---------- taban ---------- */
  // ince levha eğrisi (thin-plate spline): denetim noktalarından geçen yumuşak yüzey; sonuç kaba ızgaraya pişirilir
  function tps(P) {
    const n = P.length, m = n + 3, A = [], fi = r2 => r2 < 1e-9 ? 0 : r2 * Math.log(r2) * .5;
    for (let i = 0; i < m; i++) { const r = new Float64Array(m + 1); if (i < n) { for (let j = 0; j < n; j++) r[j] = fi((P[i][0] - P[j][0]) ** 2 + (P[i][1] - P[j][1]) ** 2); r[n] = 1; r[n + 1] = P[i][0]; r[n + 2] = P[i][1]; r[m] = P[i][2]; } else for (let j = 0; j < n; j++) r[j] = i === n ? 1 : P[j][i - n - 1]; A.push(r); }
    for (let c = 0; c < m; c++) { let pv = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r; if (Math.abs(A[pv][c]) < 1e-12) hata('taban noktaları çözülemedi (aynı yerde iki nokta ya da hepsi tek doğru üstünde?)'); const t = A[c]; A[c] = A[pv]; A[pv] = t;
      for (let r = 0; r < m; r++) if (r !== c) { const k = A[r][c] / A[c][c]; if (k) for (let q = c; q <= m; q++) A[r][q] -= k * A[c][q]; } }
    const w = A.map((r, i) => r[m] / r[i]); return (x, z) => { let v = w[n] + w[n + 1] * x + w[n + 2] * z; for (let j = 0; j < n; j++) v += w[j] * fi((x - P[j][0]) ** 2 + (z - P[j][1]) ** 2); return v; };
  }
  function tabanKur(B) {
    const t = B.taban || { kip: 'prosedurel' }, T = B.T = { kip: t.kip || 'prosedurel', carpan: say(t.carpan, 1), orta: say(t.orta, 0), ek: say(t.ek, 0), y: +t.y || 0 };
    if (T.kip === 'izgara') { T.x0 = t.x0; T.z0 = t.z0; T.ad = t.adim; T.nx = t.nx; T.nz = Math.round(t.y.length / t.nx); T.Y = Float32Array.from(t.y); if (!(T.ad > 0) || T.Y.length !== T.nx * T.nz || T.nx < 2 || T.nz < 2) hata('taban izgara: x0, z0, adim, nx ve nx × nz uzunlukta y gerekli'); }
    else if (T.kip === 'noktalar') { if (!t.noktalar || t.noktalar.length < 3) hata('taban noktalar: en az 3 nokta [x, z, y]'); const f = tps(t.noktalar); T.ad = say(t.adim, 32); T.x0 = B.x0 - T.ad; T.z0 = B.z0 - T.ad; T.nx = Math.ceil((B.x1 - B.x0) / T.ad) + 3; T.nz = Math.ceil((B.z1 - B.z0) / T.ad) + 3; T.Y = new Float32Array(T.nx * T.nz);
      for (let j = 0; j < T.nz; j++) for (let i = 0; i < T.nx; i++) T.Y[j * T.nx + i] = f(T.x0 + i * T.ad, T.z0 + j * T.ad); T.kip = 'izgara'; }
    else if (T.kip !== 'prosedurel' && T.kip !== 'duz') hata('taban kip: prosedurel | duz | izgara | noktalar');
    const e = B.engebe; B.eg = e ? { g: say(e.genlik, 6), o: say(e.olcek, 160) } : null;
    const m = B.mikro === false ? { genlik: 0 } : B.mikro || {}; B.mg = say(m.genlik, .4); B.mo = say(m.olcek, 24);
  }
  const cr = (a, b, c, d, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a))); // Catmull-Rom
  const crR = [0, 0, 0, 0];
  function izgaraY(T, x, z) { const u = clamp((x - T.x0) / T.ad, 0, T.nx - 1.0001), v = clamp((z - T.z0) / T.ad, 0, T.nz - 1.0001), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, Y = T.Y, nx = T.nx, r = crR;
    for (let q = 0; q < 4; q++) { const o = clamp(j + q - 1, 0, T.nz - 1) * nx, i0 = i > 0 ? i - 1 : 0, i2 = i + 1, i3 = i + 2 < nx ? i + 2 : nx - 1; r[q] = cr(Y[o + i0], Y[o + i], Y[o + i2], Y[o + i3], fu); } return cr(r[0], r[1], r[2], r[3], fv); }

  /* ---------- bölgeler ---------- */
  const ham = new Map(), aktif = []; let derli = false, tembelTamam = false, yakala = false, dogusT = null, noktalarT = [], patikalarT = [];
  function bolge(v) {
    if (!v || !v.id) hata('bolge: id gerekli'); if (kapali || (secim && !secim.includes(v.id))) return TS;
    let B = ham.get(v.id); if (!B) { B = { id: v.id, ad: v.id, katmanlar: [] }; ham.set(v.id, B); }
    for (const k of ['ad', 'sinir', 'gecis', 'taban', 'engebe', 'mikro', 'varsayilan', 'dogus', 'tohum']) if (v[k] !== undefined) B[k] = v[k];
    B.katmanlar.push({ ad: v.katman || 'bolge', sira: v.sira != null ? v.sira : KATMAN[v.katman || 'bolge'] != null ? KATMAN[v.katman || 'bolge'] : 60, no: B.katmanlar.length, sekiller: v.sekiller || [], alanlar: v.alanlar || [], nesneler: v.nesneler || [], noktalar: v.noktalar || [] });
    derli = false; tembelTamam = false; kancaYaz(); return TS;
  }
  const etkinVar = () => { for (const B of ham.values()) if (B.sinir) return true; return false; };
  function kancaYaz() { const v = etkinVar(); TS.yukseklik = v ? yukseklik : undefined; TS.yerlesim = v ? yerlesim : undefined; TS.ekNesneler = v ? ekNesneler : undefined; TS.zemin = v ? zemin : undefined; TS.toplama = v ? toplama : undefined; }
  function derle() {
    derli = true; aktif.length = 0; dogusT = null; noktalarT = []; patikalarT = []; hucreNesne = null;
    for (const H of ham.values()) { if (!H.sinir) continue;
      const B = { id: H.id, ad: H.ad, sinir: H.sinir, taban: H.taban, engebe: H.engebe, mikro: H.mikro, S: [], A: [], nesneler: [], noktalar: [], tohum: H.tohum == null ? 100 + aktif.length * 31 : H.tohum, vr: clamp(say(H.varsayilan, 1), 0, 1), gc: Math.max(1, say(H.gecis, 150)) };
      const K = B.K = alanKur(H.sinir); B.x0 = K.x0; B.x1 = K.x1; B.z0 = K.z0; B.z1 = K.z1; dizinKur(B); tabanKur(B);
      // kenar ağırlığı: sınırdan içeri `gecis` metrede 0 → 1 (16 m'lik ızgarada saklanır, çift doğrusal okunur)
      B.wn = Math.ceil((B.x1 - B.x0) / 16) + 1; B.wm = Math.ceil((B.z1 - B.z0) / 16) + 1; B.w = new Float32Array(B.wn * B.wm);
      for (let j = 0; j < B.wm; j++) for (let i = 0; i < B.wn; i++) B.w[j * B.wn + i] = sm(0, B.gc, Math.max(0, isaretli(K, null, B.x0 + i * 16, B.z0 + j * 16)));
      const kat = H.katmanlar.slice().sort((a, b) => a.sira - b.sira || a.no - b.no);
      for (const k of kat) for (const n of k.nesneler) B.nesneler.push(Object.assign({ katman: k.ad }, n));
      for (const k of kat) k.sekiller.forEach((v, i) => { const D = SEKIL[v.tip] || hata('bilinmeyen şekil tipi: ' + v.tip + ' (' + B.id + '/' + k.ad + ' #' + i + ')'), p = Object.assign({}, v, { def: D, katman: k.ad, no: i, sira: B.S.length, sirtGibi: v.tip === 'sirt' || v.tip === 'vadi' || v.tip === 'oluk' });
        try { D.kur(p, B); } catch (e) { hata(B.id + '/' + k.ad + ' sekiller[' + i + '] (' + v.tip + '): ' + e.message.replace('tasarim: ', '')); }
        B.S.push(p); for (const q of p.K) dizinEkle(B, B.gy, p, q.S, q.R, q.Ri);
        const S0 = p.K[0].S;
        if (v.tip === 'patika') { dizinEkle(B, B.ga, { sinif: 'yp', p }, S0, p.g / 2 + 3, 0); dizinEkle(B, B.gzm, { sinif: 'zp', p }, S0, p.g / 2 + 5, 0); patikalarT.push({ bolge: B.id, id: v.id || (k.ad + '#' + i), ad: v.ad || '', cizgi: v.cizgi.map(q => [q[0], q[1]]), genislik: p.g }); }
        if ((v.tip === 'duzluk' || v.tip === 'plato') && p.bos) dizinEkle(B, B.ga, { sinif: 'y', S: S0, kn: 0, pr: 0 }, S0, 0, 0);
        if ((v.tip === 'duzluk' || v.tip === 'plato') && v.zemin) dizinEkle(B, B.gzm, { sinif: 'z', S: S0, kn: 8, pr: 4, tp: v.zemin === 'toprak' ? .8 : 0, ck: v.zemin === 'cakil' ? .8 : 0, km2: v.zemin === 'kum' ? .8 : 0 }, S0, 8, 8);
        if (v.tip === 'kiyi' && v.kum !== false) dizinEkle(B, B.gzm, { sinif: 'zk', p }, S0, p.sh + p.pr + 4, 0);
        if (v.tip === 'nehir') for (const g of p.sg) B.noktalar.push({ tur: 'gecit', ad: g.ad || 'Sığ geçit', x: g.x, z: g.z, yaricap: g.u, oto: true });
        if (v.tip === 'ucurum' && v.kayalar) { const S = S0, R = SO.rnd(Math.round(S.ax[0] * 3 + S.az[0]) + 17); for (let q = 0; q < v.kayalar; q++) { const s = R() * S.L; let a = 0; while (a < S.n - 1 && s > S.s0[a] + S.len[a]) a++; const t = (s - S.s0[a]) / S.len[a], nx = -S.dz[a] / S.len[a] * p.yon, nz = S.dx[a] / S.len[a] * p.yon, d = -(p.g / 2 + 3 + R() * 9);
          B.nesneler.push({ tur: R() < .75 ? 'kaya' : 'duzOrta', x: S.ax[a] + S.dx[a] * t + nx * d, z: S.az[a] + S.dz[a] * t + nz * d, s: .9 + R() * R() * 2.4, ry: R() * TAU, oto: true }); } } });
      for (const k of kat) k.alanlar.forEach((v, i) => { const a = Object.assign({}, v, { katman: k.ad, no: i }); try { alanHazirla(a, B); } catch (e) { hata(B.id + '/' + k.ad + ' alanlar[' + i + '] (' + v.tip + '): ' + e.message.replace('tasarim: ', '')); }
        B.A.push(a); dizinEkle(B, a.sinif === 'z' ? B.gzm : B.ga, a, a.S, a.pr + 1, a.kn + a.pr + 1); });
      B.nesneler.forEach((n, i) => { if (!n.tur || !isFinite(n.x + n.z)) hata(B.id + ' nesne #' + i + ': tur, x, z gerekli'); n.kimlik = 't:' + B.id + ':' + (n.id || i); });
      if (H.dogus) { B.dogus = { x: H.dogus.x, z: H.dogus.z, yon: H.dogus.yon || 0 }; if (!dogusT) dogusT = B.dogus; B.noktalar.push({ id: 'dogus', tur: 'dogus', ad: 'Doğuş', x: B.dogus.x, z: B.dogus.z, yaricap: 12, oto: true }); dizinEkle(B, B.ga, { sinif: 'y', S: alanKur({ daire: [B.dogus.x, B.dogus.z, 9] }), kn: 0, pr: 0 }, alanKur({ daire: [B.dogus.x, B.dogus.z, 9] }), 0, 0); }
      for (const k of kat) for (const n of k.noktalar) { if (!isFinite(n.x + n.z)) hata(B.id + ' nokta: x, z gerekli (' + JSON.stringify(n) + ')'); B.noktalar.push(Object.assign({ katman: k.ad }, n)); }
      B.noktalar.forEach((n, i) => { n.bolge = B.id; if (!n.id) n.id = (n.tur || 'nokta') + i; if (!n.tur) n.tur = 'isaret'; noktalarT.push(n); });
      aktif.push(B);
    }
  }
  // şekillerin dünyaya bağlı ön hesapları (patika boy kesiti, düzlüğün kendiliğinden yüksekliği): arazi.js yüklendikten sonra, ilk yükseklik çağrısında bir kez
  function prosH(x, z) { yakala = true; try { return SO.world.yukseklikF(x, z); } finally { yakala = false; } }
  function tembelYap() { if (!SO.world || !SO.world.yukseklikF) return; tembelTamam = true; for (const B of aktif) for (const p of B.S) if (p.def.tembel) p.def.tembel(p, B, (x, z) => hesap(B, x, z, prosH(x, z), p.sira)); }

  /* ---------- kanca: yükseklik ---------- */
  function wAl(B, x, z) { const u = (x - B.x0) / 16, v = (z - B.z0) / 16, i = Math.floor(u), j = Math.floor(v); if (i < 0 || j < 0 || i >= B.wn - 1 || j >= B.wm - 1) return 0; const o = j * B.wn + i, W = B.w, a = W[o], b = W[o + 1], c = W[o + B.wn], d = W[o + B.wn + 1]; if (a + b + c + d === 0) return 0; const fu = u - i, fv = v - j; return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv; }
  // bölgenin tasarlanmış yüksekliği (kenar karışımı ve mikro engebe hariç); son: bu sıradan önceki şekiller uygulanır
  function hesap(B, x, z, h, son) {
    gx = x; gz = z; gt = B.tohum; g1ok = g2ok = g3ok = false; mik = 1;
    const T = B.T; let y = T.kip === 'prosedurel' ? (T.carpan === 1 ? h + T.ek : T.orta + (h - T.orta) * T.carpan + T.ek) : T.kip === 'duz' ? T.y : izgaraY(T, x, z);
    if (B.eg) y += (fbm2(x / B.eg.o, z / B.eg.o, gt + 5) - .5) * 2 * B.eg.g;
    const c = B.gy[(Math.floor(z / HC) - B.gj) * B.gn + Math.floor(x / HC) - B.gi];
    if (c) for (let k = 0; k < c.length; k++) { const e = c[k], p = e.p; if (p.sira >= son) break; y = p.def.f(p, e, x, z, y); }
    return y;
  }
  function yukseklik(x, z, h) {
    if (yakala) return h;
    if (!derli) derle(); if (!tembelTamam) tembelYap();
    if (!dogusT) { const st = SO.world && SO.world.start; if (st && st.h !== undefined) { const ds = Math.hypot(x - st.x, z - st.z); if (ds < 60) h = lerp(h, st.h, 1 - sm(22, 60, ds)); } } // tasarlanmış doğuş yoksa arazi.js'in başlangıç düzlüğü (o dal bu kanca varken çalışmıyor)
    for (let q = 0; q < aktif.length; q++) { const B = aktif[q]; if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) continue; const w = wAl(B, x, z); if (w <= 0) continue;
      let y = hesap(B, x, z, h, 1e9); if (B.mg) y += ((fbm2(x / B.mo, z / B.mo, B.tohum + 7) - .5) * 1.5 + (vnoise(x / 5.3, z / 5.3, B.tohum + 8) - .5) * .3) * B.mg * mik;
      h = w >= 1 ? y : h + (y - h) * w; }
    return h;
  }

  /* ---------- kanca: nesne yerleşimi ---------- */
  const adT = [], adP = [], adA = [];
  function yerlesim(px, pz, D) {
    if (!derli) derle();
    for (let q = 0; q < aktif.length; q++) { const B = aktif[q]; if (px < B.x0 || px > B.x1 || pz < B.z0 || pz > B.z1) continue; const w = wAl(B, px, pz); if (w <= 0) continue;
      gx = px; gz = pz; gt = B.tohum; g1ok = g2ok = g3ok = false;
      let m = lerp(1, B.vr, w), kesA = 0, kesH = 0, n = 0;
      const c = B.ga[(Math.floor(pz / HC) - B.gj) * B.gn + Math.floor(px / HC) - B.gi];
      if (c) for (let k = 0; k < c.length; k++) { const e = c[k], a = e.p, sf = a.sinif;
        if (sf === 'yp') { if (yakin(e.S, e.segs, px, pz) < a.p.g / 2 + 1.2) kesH = 1; continue; } if (sf === 'k') continue;
        const k1 = alanAgirlik(a, e, px, pz); if (k1 <= 0) continue;
        if (sf === 'y') kesH = Math.max(kesH, k1); else if (sf === 'a') kesA = Math.max(kesA, k1);
        else if (sf === 's') { const kume = a.km ? lerp(1, sm(.3, .62, vnoise(px / 23, pz / 23, gt + 40 + a.no)) * 1.7, a.km) : 1; adA[n] = a; adP[n] = a.yg * k1 * kume; n++; m *= 1 - k1 * (1 - a.vr); } }
      if (kesH >= 1) { D.yasak = true; return; }
      const ix = Math.floor(px * 16), iz = Math.floor(pz * 16), u = hash(ix, iz, gt + 50); let t = 0;
      for (let k = 0; k < n; k++) { const a = adA[k], tl = a.tl, taban = adP[k] * w * (1 - kesH);
        for (let j = 0; j < tl.length; j++) { t += taban * tl[j][1] * (tl[j][2] ? 1 - kesA : 1); if (u < t) { D.tur = tl[j][0]; if (a.boy) { const r = hash(ix, iz, gt + 51); D.olcek = a.boy[0] + (a.boy[1] - a.boy[0]) * r * r; } return; } } }
      m *= (1 - kesH) * (1 - kesA); if (m < 1 && hash(ix, iz, gt + 52) >= m) { D.yasak = true; return; }
    }
  }

  /* ---------- kanca: tek tek nesneler ---------- */
  // Yeni türler arazi.js'e bağlanana kadar yerlerine mevcut türlerden bir yedek konur: [yedek tür, ölçek çarpanı]. Bağlanınca arazi.js `SO.tasarim.turBagli = true` yazar.
  const YEDEK = { devAgac: ['yaprakli1', 3.4], sivriTas: ['kaya', 3.2], anitTas: ['duzYuksek', 1.25], tasKapi: ['duzYuksek', 1.6], yikikDuvar: ['duzOrta', 1.5] };
  let hucreNesne = null, hucreBoy = 0;
  function ekNesneler(ci, cj, HUCRE) {
    if (!derli) derle();
    if (!hucreNesne || hucreBoy !== HUCRE) { hucreNesne = new Map(); hucreBoy = HUCRE; for (const B of aktif) for (const n of B.nesneler) { let tur = n.tur, s = n.s || 1; if (YEDEK[tur] && !TS.turBagli) { s *= YEDEK[tur][1]; tur = YEDEK[tur][0]; }
      const k = Math.floor(n.x / HUCRE) + ',' + Math.floor(n.z / HUCRE); let L = hucreNesne.get(k); if (!L) hucreNesne.set(k, L = []); L.push({ tur, x: n.x, z: n.z, s, ry: n.ry || 0, id: n.kimlik }); } }
    return hucreNesne.get(ci + ',' + cj) || null;
  }

  /* ---------- kanca: zemin dokusu (gorunum.js) ve toplanabilir yoğunluğu (toplama.js) ---------- */
  const Z = { toprak: 0, cakil: 0, kum: 0 }, TP = { dal: 1, tas: 1, dalEk: 0, tasEk: 0 };
  function zemin(x, z) {
    if (!derli) derle(); let var_ = false;
    for (let q = 0; q < aktif.length; q++) { const B = aktif[q]; if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) continue; const c = B.gzm[(Math.floor(z / HC) - B.gj) * B.gn + Math.floor(x / HC) - B.gi]; if (!c) continue; const w = wAl(B, x, z); if (w <= 0) continue;
      if (!var_) { var_ = true; Z.toprak = Z.cakil = Z.kum = 0; } gx = x; gz = z; gt = B.tohum; g1ok = g2ok = g3ok = false;
      for (let k = 0; k < c.length; k++) { const e = c[k], a = e.p;
        if (a.sinif === 'zp') { const p = a.p; if (yakin(e.S, e.segs, x, z) < p.g / 2 + 4) { const v = (1 - sm(p.g / 2 + .4, p.g / 2 + 3.2, U.d)) * p.tp * w; if (v > Z.toprak) Z.toprak = v; } }
        else if (a.sinif === 'zk') { const p = a.p; if (yakin(e.S, e.segs, x, z) < BUYUK) { const sd = U.d * U.yan * p.yon + G2() * p.pr * 2, v = sm(-p.sh - 3, -p.sh * .6, sd) * (1 - sm(1, 5, sd)) * ucSon(p, e.S) * w; if (v > Z.kum) Z.kum = v; } }
        else { const v = alanAgirlik(a, e, x, z) * w; if (v > 0) { if (a.tp * v > Z.toprak) Z.toprak = a.tp * v; if (a.ck * v > Z.cakil) Z.cakil = a.ck * v; if (a.km2 * v > Z.kum) Z.kum = a.km2 * v; } } } }
    return var_ && Z.toprak + Z.cakil + Z.kum > 0 ? Z : null;
  }
  function toplama(x, z) {
    if (!derli) derle(); let var_ = false;
    for (let q = 0; q < aktif.length; q++) { const B = aktif[q]; if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) continue; const c = B.ga[(Math.floor(z / HC) - B.gj) * B.gn + Math.floor(x / HC) - B.gi]; if (!c) continue;
      for (let k = 0; k < c.length; k++) { const e = c[k], a = e.p; if (a.sinif !== 'k') continue; gx = x; gz = z; gt = B.tohum; g1ok = g2ok = g3ok = false; const v = alanAgirlik(a, e, x, z) * wAl(B, x, z); if (v <= 0) continue;
        if (!var_) { var_ = true; TP.dal = TP.tas = 1; TP.dalEk = TP.tasEk = 0; } TP.dal *= lerp(1, a.dal, v); TP.tas *= lerp(1, a.tas, v); TP.dalEk += a.dalEk * v; TP.tasEk += a.tasEk * v; } }
    return var_ ? TP : null;
  }

  /* ---------- yeni nesne türleri (arazi.js'in TUR tablosuna bağlanmak üzere) ----------
     Biçim arazi.js ile aynı: ad: [parça üretici, dış çizgi kalınlığı, çarpışma yarıçapı, üstüne çıkılabilir tepe yüksekliği (0 = çıkılmaz)];
     parça = { geo, m, lt, dk, center, r, tall } (arazi.js'teki part()). Bağlama: Object.assign(TUR, SO.tasarim.turler) + SO.tasarim.turBagli = true. */
  function turlerKur() {
    const T3 = window.THREE, UP = new T3.Vector3(0, 1, 0), rnd = SO.rnd;
    const mat4 = (x, y, z, ry, s, sy) => new T3.Matrix4().compose(new T3.Vector3(x, y, z), new T3.Quaternion().setFromAxisAngle(UP, ry || 0), new T3.Vector3(s || 1, (sy || s || 1), s || 1));
    const mrot = (x, y, z, rx, ry, rz) => new T3.Matrix4().compose(new T3.Vector3(x, y, z), new T3.Quaternion().setFromEuler(new T3.Euler(rx || 0, ry || 0, rz || 0)), new T3.Vector3(1, 1, 1));
    const part = (geo, m, lt, dk, cx, cy, cz, r, tall) => ({ geo, m, lt, dk, center: new T3.Vector3(cx, cy, cz), r, tall });
    const oyna = (g, sd, k, sq) => { const A = g.attributes.position.array; for (let i = 0; i < A.length; i += 3) { const h = Math.sin(A[i] * 12.9898 + A[i + 1] * 78.233 + A[i + 2] * 37.719 + sd) * 43758.5453, j = 1 + ((h - Math.floor(h)) - .5) * k; A[i] *= j; A[i + 1] *= j * (sq || 1); A[i + 2] *= j; } return g; };
    const blob = (rad, sd, sq, det) => oyna(new T3.IcosahedronGeometry(rad, det == null ? 1 : det), sd, .24, sq || .86);
    const KL = '#a89f8c', KD = '#756c5b';
    return {
      // dev işaret ağacı: ≈ 24 m; uzaktan seçilen geniş taç, kalın gövde, kök payandaları
      devAgac: [() => { const r = rnd(811), P = [part(new T3.CylinderGeometry(.95, 1.55, 11, 9), mat4(0, 5.5, 0), '#7a4e27', '#55351a', 0, 5.5, 0, 1.3, true)];
        for (let k = 0; k < 5; k++) { const a = k * 1.2566 + .3; P.push(part(new T3.ConeGeometry(.75, 3.4, 5), mrot(Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5, Math.sin(a) * .5, 0, -Math.cos(a) * .5), '#7a4e27', '#55351a', Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5, .7)); }
        [[0, 15.5, 0, 6.2], [-4.6, 12.6, 1.2, 4.3], [4.4, 13.0, -1.4, 4.5], [.6, 19.6, .4, 4.2], [.2, 12.8, 4.4, 3.9], [-.8, 13.2, -4.6, 4.0], [-3.2, 17.4, -2.2, 3.3], [3.4, 17.0, 2.6, 3.4]].forEach(([x, y, z, rad], i) => P.push(part(blob(rad, 811 + i, .82, 1), mat4(x, y, z, r() * TAU), i % 2 ? '#7d8a4a' : '#6f8046', i % 2 ? '#4f5f31' : '#46562b', x, y, z, rad)));
        [[-2.6, 9.2, .6, .5, 1.0], [2.4, 9.6, -.8, -.5, -1.0]].forEach(([x, y, z, rz]) => P.push(part(new T3.CylinderGeometry(.3, .5, 5, 6), mrot(x, y, z, 0, 0, rz * 1.9), '#7a4e27', '#55351a', x, y, z, .5, true))); return P; }, .07, 1.5, 0],
      // sivri kaya: ≈ 11 m iğne kaya + iki küçük diş
      sivriTas: [() => [[0, 0, 0, 2.3, 11, 0, 0, 901], [2.1, 0, .8, 1.3, 5.2, -.16, .1, 902], [-1.5, 0, -1.3, 1.1, 3.6, .2, -.12, 903]].map(([x, y, z, rad, hh, rz, rx, sd]) => part(oyna(new T3.ConeGeometry(rad, hh, 6, 3), sd, .3), mrot(x, hh / 2 - .4, z, rx, sd, rz), KL, KD, x, hh / 2, z, rad * .8)), .06, 1.9, 0],
      // dikili taş (anıt): 4,6 m yontulmamış dikit + dibinde iki taş
      anitTas: [() => [part(oyna(new T3.CylinderGeometry(.5, .85, 4.6, 6, 3), 921, .22), mrot(0, 2.2, 0, .04, .5, -.05), '#b3aa96', '#7d7462', 0, 2.3, 0, .8, true), part(oyna(new T3.IcosahedronGeometry(.7, 0), 922, .4, .7), mat4(1.2, .3, .4), KL, KD, 1.2, .3, .4, .7), part(oyna(new T3.IcosahedronGeometry(.5, 0), 923, .4, .7), mat4(-.9, .2, -.8), KL, KD, -.9, .2, -.8, .5)], .05, .8, 0],
      // taş kapı: iki ayak + üst taş; aradan yürünür (çarpışma kutusu tek kare olduğundan yarıçap 0: engellemez)
      tasKapi: [() => [part(oyna(new T3.CylinderGeometry(.9, 1.2, 5.2, 6, 2), 931, .2), mat4(-2.6, 2.5, 0), KL, KD, -2.6, 2.6, 0, 1.1, true), part(oyna(new T3.CylinderGeometry(.85, 1.25, 5.0, 6, 2), 932, .2), mat4(2.6, 2.4, 0), KL, KD, 2.6, 2.5, 0, 1.1, true), part(oyna(new T3.BoxGeometry(8.2, 1.3, 2.0, 3, 1, 1), 933, .12), mrot(0, 5.6, 0, 0, 0, .04), '#b3aa96', '#7d7462', 0, 5.6, 0, 2.2)], .06, 0, 0],
      // yıkık duvar: 7 m, basamak basamak alçalan taş duvar kalıntısı
      yikikDuvar: [() => [[-2.6, 2.4, 1.8], [-.8, 1.9, 1.8], [1.0, 1.2, 1.8], [2.7, .6, 1.6]].map(([x, hh, w], i) => part(oyna(new T3.BoxGeometry(w, hh, .9, 2, 2, 1), 941 + i, .1), mat4(x, hh / 2 - .1, 0), i % 2 ? '#a89f8c' : '#b3aa96', '#756c5b', x, hh / 2, 0, 1)).concat([part(oyna(new T3.IcosahedronGeometry(.45, 0), 946, .4, .7), mat4(3.2, .15, .9), KL, KD, 3.2, .15, .9, .45), part(oyna(new T3.IcosahedronGeometry(.38, 0), 947, .4, .7), mat4(.6, .12, -1.0), KL, KD, .6, .12, -1.0, .38)]), .05, 0, 0]
    };
  }

  /* ---------- dışa açılan ---------- */
  let turlerT = null;
  const TS = SO.tasarim = {
    bolge, KATMAN, SEKILLER: Object.keys(SEKIL), ALANLAR: Object.keys(SERPME).concat(['aciklik', 'yasak', 'zemin', 'kaynak']), YEDEK, turBagli: false, kapali, secim,
    yukseklik: undefined, yerlesim: undefined, ekNesneler: undefined, zemin: undefined, toplama: undefined,
    get dogus() { if (!derli) derle(); return dogusT; },
    get noktalar() { if (!derli) derle(); return noktalarT; },
    get patikalar() { if (!derli) derle(); return patikalarT; },
    get bolgeler() { if (!derli) derle(); return aktif; },
    get turler() { return turlerT || (turlerT = turlerKur()); },
    // (x, z)'deki tasarım ağırlığı: 0 = prosedürel, 1 = tümüyle tasarlanmış
    agirlik(x, z) { if (!derli) derle(); let w = 0; for (const B of aktif) if (x >= B.x0 && x <= B.x1 && z >= B.z0 && z <= B.z1) w = Math.max(w, wAl(B, x, z)); return w; },
    // prosedürel (tasarımsız) yükseklik: araçlar "önce/sonra" karşılaştırması için
    prosedurel(x, z) { return prosH(x, z); },
    rnd: SO.rnd
  };
  // ?tasarim=ad: index.html'de betik satırı olmayan bölge dosyası (tasarim/<ad>/bolge.js) şimdi, arazi.js'ten önce yüklenir
  const SAYFADA = ['b001']; // index.html'de betik satırı olan bölgeler (yeni bölge eklenince buraya da yazılır)
  if (secim && !kapali) for (const ad of secim) if (/^[\w-]+$/.test(ad) && !SAYFADA.includes(ad)) document.write('<script src="tasarim/' + ad + '/bolge.js"><\/script>');
})();
