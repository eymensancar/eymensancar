/* Toplama: yerde duran toplanabilir küçük nesneler (dal, taş), AL düğmesi, sayaç (envanter), kayıt.
   Hareketin kendisi anim/toplama.js katmanındadır (SO.toplaAnim); bu dosya neyin nerede durduğuna, neyin alınacağına ve sayaca bakar.

   YERLEŞİM: dünya 48 m'lik hücrelere bölünür; oyuncunun çevresindeki 5×5 hücre (her yöne en az 96 m) üretilir, 3 hücreden uzaklaşan atılır.
   Her hücrede 16×16 aday nokta vardır (3 m aralıklı, tohumlu rastgele kaydırılmış ızgara; tohum hücre koordinatından). Aday, türlerin
   `olasilik(c)` işlevlerine göre bir nesne olur ya da boş kalır. Nesnenin kimliği = hücre + aday sırası: aynı yerde hep aynı nesne çıkar.
   Bağlam `c`: x, z, h (zemin yüksekliği), egim, biyom, kiyi (0..1: su kıyısındaki alçak şerit), yamac (0..1: yakında dik yamaç),
   agac (en yakın ağaç gövdesine uzaklık, m), kaya (en yakın kayanın kenarına uzaklık, m). Ağaç ve kayalar SO.world.solids kutularından okunur
   (tepesi yerden ≥ 2,5 m ve dar olan kutu vadi/orman/kar biyomunda ağaçtır; alçak olanlar kayadır). Suyun içinde (h < 0,12), kutuların içinde
   ve çok dik yerde (eğim > 0,75) nesne olmaz. Kurallar tür tablosunda (TUR); yeni tür eklemek için SO.toplama.turEkle (init'ten önce).
   Dünya kutuları henüz yüklenmemişse (SO.world.durum().kuyruk > 0) hücre bekler; 4 sn'den uzun sürerse eldekiyle üretilir ve kuyruk
   boşalınca bir kez yeniden üretilir (kimlikler aday sırasından geldiği için değişmez).

   ÇİZİM: tür × biçim başına tek InstancedMesh (bütün hücreler için ortak; 6 çizim çağrısı). Matrisler yalnız hücre eklenince/atılınca ya da
   nesne alınınca yazılır. Ağaç/kaya ile aynı görünüm (SO.gorunum.nesneGeo + nesneMat: kabuk/kaya dokusu, iki ton; gorunum.js yoksa düz renk),
   dış çizgi yok, biyoma göre örnek tonu. 68 m'den sonra küçülür, 92 m'de kaybolur.

   ALMA: oyuncuya 1,3 m'den yakın nesnelerden en uygunu (uzaklık − 0,45 × öne bakış payı en küçük olan) SO.toplama.yakin olur ve AL düğmesi
   görünür. AL (ya da E tuşu, ya da SO.input.act) → SO.toplaAnim.basla; el değdiği karede nesne kaybolur, sayaç artar,
   SO.ses.olay('al', { tur }) gider. Düğme basılı tutulursa menzile giren her nesne sırayla alınır. Yüzerken, tırmanırken, havadayken alınmaz.
   El nesneye tam yetişemiyorsa (uzakta/arkada) nesne son 0,06 sn'de ele doğru çekilir.

   ARAYÜZ: SO.envanter = { dal, tas (salt okunur sayılar), say, adet(tur), ekle(tur, adet), harca(tur, adet), dinle(fn) }.
   Envanter yalnız yerden toplananları değil bütün eşyaları tutar: `ekle` tür tablosundaki (TUR) ve oyun.js'in eşya tablosundaki (SO.esya) türleri
   kabul eder; hepsi aynı kayıtta (`say`) saklanır. Üstteki sayaç yalnız TUR'dakileri (dal, taş) gösterir.
   SO.toplama = { init, update, yakin, al(), TUR, turEkle, say(x, z, yaricap), durum(), kodla(), coz(metin) }.

   KAYIT: localStorage `acik-dunya-envanter-v1` = { v: 1, say: { dal, tas }, alinan: "hücre:ssss;hücre:ss..." } (hücre = 36 tabanında hücre anahtarı,
   ardından alınan her aday için 2 onaltılık hane). En çok 6000 kimlik tutulur; dolunca en eski hücreler unutulur (oradaki nesneler yeniden
   belirir). ≈ 2,1 bayt/nesne + 6 bayt/hücre: en çok ≈ 20 KB. Alıştan 2 sn sonra ve sayfa gizlenirken yazılır; `?test` kipinde okunmaz/yazılmaz. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp, TAU = Math.PI * 2;
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const HUCRE = 48, ADAY = 16, ARALIK = HUCRE / ADAY, YARI = 2, AT = 3, UZAK = 92, MENZIL = 1.3, ONE = .45, KAYIT = 'acik-dunya-envanter-v1', KAYIT_EN_COK = 6000;
  const SUN = new T3.Vector3(-.5, .8, .35).normalize();

  /* ---------- biçimler ----------
     Biçim = parça listesi [{ geo, lt, dk, tall }]. Görünüm (gorunum.js) varsa ağaç/kaya ile aynı yoldan geçer: SO.gorunum.nesneGeo (atlas dokusu:
     kabuk / kaya; örneğin dönüşüne göre ışık) + SO.gorunum.nesneMat. Yoksa düz renk + iki ton (yüz güneşe dönükse açık, değilse koyu). */
  const BIR = new T3.Matrix4();
  function duzGeo(parcalar) {
    const pos = [], col = [], a = new T3.Vector3(), b = new T3.Vector3(), c = new T3.Vector3(), n = new T3.Vector3(), cl = new T3.Color(), cd = new T3.Color();
    parcalar.forEach(p => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo, P = g.attributes.position.array; cl.set(p.lt); cd.set(p.dk);
      for (let i = 0; i < P.length; i += 9) { a.set(P[i], P[i + 1], P[i + 2]); b.set(P[i + 3], P[i + 4], P[i + 5]); c.set(P[i + 6], P[i + 7], P[i + 8]); n.copy(b).sub(a).cross(c.sub(a)).normalize(); const r = n.dot(SUN) > .12 ? cl : cd; for (let k = 0; k < 9; k++) pos.push(P[i + k]); for (let k = 0; k < 3; k++) col.push(r.r, r.g, r.b); }
      if (g !== p.geo) g.dispose(); });
    const out = new T3.BufferGeometry(); out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); out.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); return out;
  }
  // görünüm yolu: her parça ayrı çağrılır (nesneGeo ilk parçayı gövde sayar: 'yaprakli' adıyla kabuk, 'kaya' adıyla kaya karosu), sonuçlar birleştirilir
  function dokuluGeo(GR, parcalar, doku) {
    const top = {}, ad = doku === 'kaya' ? 'kaya' : 'yaprakli1';
    parcalar.forEach(p => { p.geo.computeBoundingBox(); const bb = p.geo.boundingBox, cen = bb.getCenter(new T3.Vector3()), g = GR.nesneGeo([{ geo: p.geo, m: BIR, lt: p.lt, dk: p.dk, center: cen, r: bb.getSize(new T3.Vector3()).length() / 2, tall: !!p.tall }], ad);
      for (const k in g.attributes) (top[k] = top[k] || { n: g.attributes[k].itemSize, v: [] }).v.push(g.attributes[k].array); g.dispose(); });
    const out = new T3.BufferGeometry(); for (const k in top) { const boy = top[k].v.reduce((q, d) => q + d.length, 0), d = new Float32Array(boy); let o = 0; top[k].v.forEach(v => { d.set(v, o); o += v.length; }); out.setAttribute(k, new T3.BufferAttribute(d, top[k].n)); } return out;
  }
  // dal: yerde yatan ince, hafif eğri çubuk. nokta: [x, z, yarıçap, (y)] (m; boy x ekseninde ≈ 0,75 m); çatal: yan dallar
  function dalParca(govde, catallar) {
    const P = [], Y = new T3.Vector3(0, 1, 0), d = new T3.Vector3(), q = new T3.Quaternion(), M = new T3.Matrix4(), bir = new T3.Vector3(1, 1, 1);
    const cubuk = pts => { for (let i = 0; i < pts.length - 1; i++) { const [x0, z0, r0, y0] = pts[i], [x1, z1, r1, y1] = pts[i + 1]; d.set(x1 - x0, (y1 || r1) - (y0 || r0), z1 - z0); const L = d.length(); q.setFromUnitVectors(Y, d.normalize());
      const g = new T3.CylinderGeometry(r1, r0, L + r0 * .5, 6, 1, false); g.applyMatrix4(M.compose(new T3.Vector3((x0 + x1) / 2, ((y0 || r0) + (y1 || r1)) / 2, (z0 + z1) / 2), q, bir)); P.push({ geo: g, lt: '#b08455', dk: '#62401f', tall: true }); } };
    cubuk(govde); (catallar || []).forEach(cubuk); return P;
  }
  // taş: yumruk büyüklüğünde, köşeli; taban biraz yere gömülü (yarıçap ≈ 0,095 m)
  function tasParca(sd, det, sq, en) {
    const r = .095, g = new T3.IcosahedronGeometry(r, det), A = g.attributes.position.array;
    for (let k = 0; k < A.length; k += 3) { const h = Math.sin(A[k] * 91.7 + A[k + 1] * 47.3 + A[k + 2] * 13.1 + sd) * 43758.5453, j = 1 + ((h - Math.floor(h)) - .5) * .42; A[k] *= j * en; A[k + 1] = A[k + 1] * j * sq + r * sq * .62; A[k + 2] *= j; }
    g.computeVertexNormals(); return [{ geo: g, lt: '#bdb8aa', dk: '#77726a' }];
  }

  /* ---------- tür tablosu ----------
     ad: sayaçtaki ad · simge: SVG (20×20) · doku: 'kabuk' | 'kaya' (görünüm atlası) · sekiller(): biçimler (parça listeleri) · boy: [en az, en çok] ölçek · tut: tutma noktasının yerden yüksekliği (ölçek 1'de, m)
     olasilik(c): aday noktanın bu türden nesne olma olasılığı · ton(c, r): örnek rengi çarpanı [r, g, b] (r: 0..1 rastgele) */
  const TUR = {
    dal: { ad: 'Dal', doku: 'kabuk', boy: [.7, 1.2], tut: .035,
      simge: '<svg viewBox="0 0 20 20" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16.5 9 11l3.5-2L17 3.5M9 11 7.5 5.5M12.5 9l4.5.5" stroke="#15120d" stroke-width="5"/><path d="M3 16.5 9 11l3.5-2L17 3.5M9 11 7.5 5.5M12.5 9l4.5.5" stroke="#9a6a3a" stroke-width="2.4"/></g></svg>',
      sekiller: () => [
        dalParca([[-.38, .02, .036], [-.12, -.035, .033], [.14, .0, .028], [.38, .06, .021]]),
        dalParca([[-.36, -.03, .037], [-.08, .025, .033], [.16, .0, .027], [.36, -.07, .02]], [[[-.08, .025, .025], [.09, .17, .015, .035]]]),
        dalParca([[-.3, .045, .034], [-.1, -.04, .031], [.1, .035, .026], [.3, -.02, .02]], [[[.1, .035, .021], [.21, .15, .014, .03]], [[-.1, -.04, .021], [-.01, -.16, .014, .025]]])
      ],
      olasilik(c) {
        if (c.biyom === 'col') return .0012; if (c.biyom === 'kizil') return .001;
        const yakin = c.agac < .55 ? 0 : 1 - sm(2.2, 6.5, c.agac), kar = c.biyom === 'kar';
        return (kar ? .001 : .0065) + yakin * (kar ? .16 : .27);
      },
      ton(c, r) { const k = .86 + r * .24; return c.biyom === 'kar' ? [k * .92, k * .94, k] : [k, k, k]; } },
    tas: { ad: 'Taş', doku: 'kaya', boy: [.7, 1.15], tut: .1,
      simge: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 13.5 5.5 7.5l5-3 5.5 2L17.5 13 14 16.5H6z" fill="#b4b0a6" stroke="#15120d" stroke-width="2" stroke-linejoin="round"/><path d="M5.5 7.5 10 10l6-3.5M10 10l-1 6" fill="none" stroke="#7b776e" stroke-width="1.3" stroke-linejoin="round"/></svg>',
      sekiller: () => [tasParca(3, 0, .7, 1.15), tasParca(11, 1, .62, 1.3), tasParca(27, 0, .82, .95)],
      olasilik(c) {
        const taban = c.biyom === 'col' ? .02 : c.biyom === 'kar' ? .013 : c.biyom === 'kizil' ? .017 : c.biyom === 'orman' ? .005 : .007;
        const kaya = c.kaya < .08 ? 0 : 1 - sm(.4, 2.8, c.kaya);
        return taban + c.kiyi * .1 + c.yamac * .07 + kaya * .24;
      },
      ton(c, r) { const k = .9 + r * .2; return c.biyom === 'col' ? [k * 1.06, k * .95, k * .78] : c.biyom === 'kizil' ? [k * .74, k * .5, k * .5] : c.biyom === 'kar' ? [k * 1.02, k * 1.05, k * 1.1] : [k, k, k]; } }
  };
  let turAd = Object.keys(TUR);

  /* ---------- envanter ---------- */
  const say = {}, dinleyen = [];
  const envanter = SO.envanter = {
    say,
    adet: tur => say[tur] || 0,
    ekle(tur, adet) { adet = adet == null ? 1 : adet | 0; if ((!TUR[tur] && !(SO.esya && SO.esya[tur])) || !adet) return say[tur] || 0; say[tur] = Math.max(0, (say[tur] || 0) + adet); degisti(tur); return say[tur]; },
    harca(tur, adet) { adet = adet == null ? 1 : adet | 0; if ((say[tur] || 0) < adet) return false; say[tur] -= adet; degisti(tur); return true; },
    dinle(fn) { dinleyen.push(fn); }
  };
  function degisti(tur) { ciz(tur); kaydetSonra(); dinleyen.forEach(f => { try { f(tur, say[tur] || 0); } catch (e) { } }); }

  /* ---------- kayıt ---------- */
  const alinan = new Map(); let alinanSay = 0, kayitZ = 0, kayitBoy = 0; // hücre anahtarı → [aday sırası...]; Map ekleme sırası = eskiden yeniye
  const anahtar = (ci, cj) => (ci + 512) * 1024 + (cj + 512);
  function alindiYaz(k, id) { let a = alinan.get(k); if (a) alinan.delete(k); else a = []; if (!a.includes(id)) { a.push(id); alinanSay++; } alinan.set(k, a);
    while (alinanSay > KAYIT_EN_COK) { const ilk = alinan.keys().next().value; if (ilk === k) break; alinanSay -= alinan.get(ilk).length; alinan.delete(ilk); } }
  function kodla() { const p = []; alinan.forEach((a, k) => p.push(k.toString(36) + ':' + a.map(i => (i < 16 ? '0' : '') + i.toString(16)).join(''))); const s = {}; for (const t in say) if (say[t] > 0) s[t] = say[t]; return JSON.stringify({ v: 1, say: s, alinan: p.join(';') }); }
  function coz(metin) {
    const o = JSON.parse(metin); if (!o || o.v !== 1) return false;
    alinan.clear(); alinanSay = 0; for (const t in say) delete say[t];
    for (const t in (o.say || {})) { const n = o.say[t] | 0; if (n > 0) say[t] = n; } // tabloda olmayan türlerin sayısı da saklanır (ileride gelen sürüm yazmış olabilir)
    String(o.alinan || '').split(';').forEach(b => { const i = b.indexOf(':'); if (i < 1) return; const k = parseInt(b.slice(0, i), 36), h = b.slice(i + 1), a = []; if (!(k >= 0)) return;
      for (let q = 0; q + 1 < h.length; q += 2) { const id = parseInt(h.substr(q, 2), 16); if (id >= 0 && id < ADAY * ADAY && !a.includes(id)) a.push(id); } if (a.length) { alinan.set(k, a); alinanSay += a.length; } });
    return true;
  }
  function kaydet() { kayitZ = 0; if (SO.test) return; try { const m = kodla(); kayitBoy = m.length; localStorage.setItem(KAYIT, m); } catch (e) { } }
  function kaydetSonra() { if (!kayitZ) kayitZ = 2; }
  function yukle() { if (SO.test) return; try { const m = localStorage.getItem(KAYIT); if (m) { kayitBoy = m.length; coz(m); } } catch (e) { } }

  /* ---------- hücre üretimi (saf: sahneye dokunmaz) ---------- */
  const tohum = (ci, cj) => ((Math.imul(ci, 73856093) ^ Math.imul(cj, 19349663) ^ 20261116) >>> 0) % 4294967291 + 1;
  const UP = new T3.Vector3(0, 1, 0), nV = new T3.Vector3(), qE = new T3.Quaternion(), qY = new T3.Quaternion();
  function hucreUret(ci, cj) {
    const w = SO.world, gy = w.groundY, x0 = ci * HUCRE, z0 = cj * HUCRE, R = SO.rnd(tohum(ci, cj)), k = anahtar(ci, cj), al = alinan.get(k), ogeler = [];
    // çevredeki kutular: ağaç gövdeleri, kayalar, öbür engeller
    const agac = [], kaya = [], engel = [], P = 7;
    for (const s of w.solids) { if (s.x1 < x0 - P || s.x0 > x0 + HUCRE + P || s.z1 < z0 - P || s.z0 > z0 + HUCRE + P) continue; engel.push(s);
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2; if (s.top - gy(cx, cz) >= 2.5) { if (s.x1 - s.x0 <= 1.3) { const b = w.biyom(cx, cz); if (b === 'vadi' || b === 'orman' || b === 'kar') agac.push(cx, cz); } } else kaya.push(s); }
    const egimF = (x, z) => Math.hypot(gy(x + 1, z) - gy(x - 1, z), gy(x, z + 1) - gy(x, z - 1)) / 2;
    const c = { x: 0, z: 0, h: 0, egim: 0, biyom: 'vadi', kiyi: 0, yamac: 0, agac: 99, kaya: 99 };
    for (let j = 0; j < ADAY; j++) for (let i = 0; i < ADAY; i++) {
      const id = j * ADAY + i, rx = R(), rz = R(), u = R(), r1 = R(), r2 = R(), r3 = R(); if (al && al.includes(id)) continue;
      const x = x0 + (i + .5 + (rx - .5) * .86) * ARALIK, z = z0 + (j + .5 + (rz - .5) * .86) * ARALIK, h = gy(x, z); if (h < .12) continue;
      let ic = false, dk = 99; for (const s of engel) if (x > s.x0 - .06 && x < s.x1 + .06 && z > s.z0 - .06 && z < s.z1 + .06) { ic = true; break; } if (ic) continue;
      for (const s of kaya) { const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1), d = Math.hypot(dx, dz); if (d < dk) dk = d; }
      let da = 99; for (let q = 0; q < agac.length; q += 2) { const d = Math.hypot(agac[q] - x, agac[q + 1] - z); if (d < da) da = d; }
      const e = .5, ex = (gy(x + e, z) - gy(x - e, z)) / (2 * e), ez = (gy(x, z + e) - gy(x, z - e)) / (2 * e), eg = Math.hypot(ex, ez); if (eg > .75) continue;
      c.x = x; c.z = z; c.h = h; c.egim = eg; c.biyom = w.biyom(x, z); c.agac = da; c.kaya = dk;
      c.kiyi = 1 - sm(.7, 3.2, h); c.yamac = sm(.24, .5, Math.max(eg, egimF(x + 6, z + 3), egimF(x - 4, z + 5), egimF(x + 2, z - 6)));
      const tk = SO.tasarim && SO.tasarim.toplama ? SO.tasarim.toplama(x, z) : null; // elle tasarım katmanı (tasarim.js, `kaynak` alanı): { dal, tas } çarpan, { dalEk, tasEk } ek olasılık
      let tur = null, top = 0; for (const ad of turAd) { top += tk ? TUR[ad].olasilik(c) * (tk[ad] == null ? 1 : tk[ad]) + (tk[ad + 'Ek'] || 0) : TUR[ad].olasilik(c); if (u < top) { tur = ad; break; } } if (!tur) continue;
      const Tr = TUR[tur], s = lerp(Tr.boy[0], Tr.boy[1], r3), sek = Math.min(Tr.n - 1, Math.floor(r1 * Tr.n));
      nV.set(-ex, 1, -ez).normalize(); qE.setFromUnitVectors(UP, nV); qY.setFromAxisAngle(UP, r2 * TAU);
      ogeler.push({ id, k, tur, sek, x, y: h, z, s, q: qE.clone().multiply(qY), ton: Tr.ton ? Tr.ton(c, (r3 * 7.31) % 1) : null, tut: Tr.tut * s, ag: null, yuva: -1 });
    }
    return { ci, cj, k, ogeler, eksik: false };
  }

  /* ---------- çizim: tür × biçim başına ortak örneklenmiş ağ ---------- */
  const hucreler = new Map(), aglar = [], uCam = { value: new T3.Vector3() }, uFar = { value: UZAK };
  let mat = null, kirli = false;
  const M4 = new T3.Matrix4(), pV = new T3.Vector3(), sV = new T3.Vector3(), renk = new T3.Color(), SIFIR = new T3.Matrix4().makeScale(0, 0, 0);
  function agKur(g, kap) { const m = new T3.InstancedMesh(g.geo, mat, kap); m.frustumCulled = false; m.matrixAutoUpdate = false; m.setColorAt(0, renk.setRGB(1, 1, 1)); m.count = 0; /* renk dizisi sığa kadar ayrılsın diye sayı sonra sıfırlanır */ SO.scene.add(m); return m; }
  function matrisYaz(o) { M4.compose(pV.set(o.x, o.y, o.z), o.q, sV.set(o.s, o.s, o.s)); o.ag.mesh.setMatrixAt(o.yuva, M4); }
  function yenile() { // bütün örnek matrisleri yeniden yazılır (yalnız hücre kümesi değişince)
    kirli = false; vurgu = null; for (const g of aglar) g.n = 0;
    hucreler.forEach(H => { for (const o of H.ogeler) aglar[TUR[o.tur].ag0 + o.sek].n++; });
    for (const g of aglar) { if (g.n > g.kap) { SO.scene.remove(g.mesh); g.mesh.dispose(); g.kap = Math.ceil(g.n * 1.5 / 64) * 64; g.mesh = agKur(g, g.kap); } g.i = 0; }
    hucreler.forEach(H => { for (const o of H.ogeler) { const g = aglar[TUR[o.tur].ag0 + o.sek]; o.ag = g; o.yuva = g.i++; matrisYaz(o); const t = o.ton; g.mesh.setColorAt(o.yuva, t ? renk.setRGB(t[0], t[1], t[2]) : renk.setRGB(1, 1, 1)); } });
    for (const g of aglar) { g.mesh.count = g.n; g.mesh.instanceMatrix.needsUpdate = true; if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true; }
  }
  // alınabilecek nesne biraz parlar (örnek rengi × VURGU): hangi nesnenin alınacağı görünsün
  let vurgu = null; const VURGU = 1.5;
  function tonYaz(o, k) { if (!o.ag || o.yuva < 0) return; const t = o.ton; o.ag.mesh.setColorAt(o.yuva, t ? renk.setRGB(t[0] * k, t[1] * k, t[2] * k) : renk.setRGB(k, k, k)); o.ag.mesh.instanceColor.needsUpdate = true; }
  function vurgula(o) { if (o === vurgu) return; if (vurgu) tonYaz(vurgu, 1); vurgu = o; if (o) tonYaz(o, VURGU); }
  function ogeKaldir(H, o) { const i = H.ogeler.indexOf(o); if (i < 0) return; if (o.ag && o.yuva >= 0) { o.ag.mesh.setMatrixAt(o.yuva, SIFIR); o.ag.mesh.instanceMatrix.needsUpdate = true; } H.ogeler.splice(i, 1); if (vurgu === o) vurgu = null; } // yuva boş kalır; sonraki yenilemede kapanır

  /* ---------- akış ---------- */
  let sonCi = null, sonCj = null, eksikVar = false, bekle = 0, tamam = false;
  const kuyrukBos = () => { const d = SO.world.durum ? SO.world.durum() : null; return !d || !d.kuyruk; };
  function akis(ci, cj, dt, hepsi) {
    if (ci !== sonCi || cj !== sonCj) { sonCi = ci; sonCj = cj; tamam = false; hucreler.forEach((H, k) => { if (Math.abs(H.ci - ci) > AT || Math.abs(H.cj - cj) > AT) { hucreler.delete(k); kirli = true; } }); }
    if (tamam && !eksikVar) return;
    const bos = hepsi || kuyrukBos(); bekle = bos ? 0 : bekle + dt;
    if (!tamam) { const liste = [];
      for (let b = -YARI; b <= YARI; b++) for (let a = -YARI; a <= YARI; a++) if (!hucreler.has(anahtar(ci + a, cj + b))) liste.push([a * a + b * b, ci + a, cj + b]);
      if (!liste.length) tamam = true;
      else if (bos || bekle > 4) { liste.sort((p, q) => p[0] - q[0]); const n = hepsi ? liste.length : 1; // kare başına bir hücre (en yakından başlayarak)
        for (let q = 0; q < n; q++) { const H = hucreUret(liste[q][1], liste[q][2]); H.eksik = !bos; if (!bos) eksikVar = true; hucreler.set(H.k, H); } kirli = true; if (n === liste.length) tamam = true; }
    } else if (eksikVar && bos) { let kalan = 0, ilk = null; // eksik kutularla üretilmiş hücreler kuyruk boşalınca yeniden üretilir (kare başına bir tane)
      for (const H of hucreler.values()) if (H.eksik) { kalan++; if (!ilk) ilk = H; }
      if (ilk) { hucreler.set(ilk.k, hucreUret(ilk.ci, ilk.cj)); kirli = true; kalan--; } eksikVar = kalan > 0; }
  }

  /* ---------- yakındaki nesne ---------- */
  function ara(ps, haric) {
    const fx = Math.sin(ps.yaw), fz = Math.cos(ps.yaw), i0 = Math.floor((ps.x - MENZIL) / HUCRE), i1 = Math.floor((ps.x + MENZIL) / HUCRE), j0 = Math.floor((ps.z - MENZIL) / HUCRE), j1 = Math.floor((ps.z + MENZIL) / HUCRE);
    let en = null, enP = 1e9;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const H = hucreler.get(anahtar(i, j)); if (!H) continue;
      for (const o of H.ogeler) { const dx = o.x - ps.x, dz = o.z - ps.z; if (dx > MENZIL || dx < -MENZIL || dz > MENZIL || dz < -MENZIL || o === haric) continue; const d = Math.hypot(dx, dz); if (d > MENZIL || Math.abs(o.y - ps.y) > .8) continue;
        const p = d - ONE * (d > .05 ? (dx * fx + dz * fz) / d : 1); if (p < enP) { enP = p; en = o; } } }
    return en;
  }

  /* ---------- arayüz ---------- */
  let bAl = null, kutu = null, dugmeBasili = false, tusBasili = false, istek = 0, alGorunur = false; const rozet = {};
  function stil() { const s = document.createElement('style'); s.textContent =
    '#envanter .env{display:flex;align-items:center;gap:4px;padding:3px 10px 3px 6px;border:2px solid var(--ink);border-radius:999px;background:rgba(241,232,212,.86);box-shadow:0 2px 0 var(--shade);font-variant-numeric:tabular-nums;min-width:26px}' +
    '#envanter .env svg{width:20px;height:20px;display:block;flex:none}' +
    '#envanter .env.art{animation:envArt .22s ease-out}@keyframes envArt{0%{transform:scale(1)}40%{transform:scale(1.18);background:var(--accent)}100%{transform:scale(1)}}' +
    '@media (prefers-reduced-motion:reduce){#envanter .env.art{animation:none}}'; document.head.appendChild(s); }
  function ciz(tur) {
    if (!kutu) return; let var_ = false;
    for (const ad of turAd) { const n = say[ad] || 0; let r = rozet[ad]; if (n > 0) var_ = true;
      if (!r) { if (!n) continue; const el = document.createElement('span'); el.className = 'env'; el.innerHTML = TUR[ad].simge + '<b></b>'; r = rozet[ad] = { el, b: el.lastChild, n: -1 }; kutu.appendChild(el); }
      if (r.n !== n) { r.n = n; r.b.textContent = n; r.el.hidden = !n; r.el.setAttribute('aria-label', TUR[ad].ad + ': ' + n); if (ad === tur) { r.el.classList.remove('art'); void r.el.offsetWidth; r.el.classList.add('art'); } } }
    kutu.hidden = !var_;
  }
  function girdiKur() {
    const ses = () => { try { SO.ses.init(); } catch (e) { } };
    const bas = e => { e.preventDefault(); e.stopPropagation(); ses(); dugmeBasili = true; istek = .35; bAl.classList.add('on'); try { bAl.setPointerCapture(e.pointerId); } catch (x) { } };
    const birak = () => { dugmeBasili = false; bAl.classList.remove('on'); };
    bAl.addEventListener('pointerdown', bas); bAl.addEventListener('pointerup', birak); bAl.addEventListener('pointercancel', birak); bAl.addEventListener('lostpointercapture', birak);
    bAl.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', e => { if (e.key === 'e' || e.key === 'E') { if (!e.repeat) { istek = .35; ses(); } tusBasili = true; } });
    addEventListener('keyup', e => { if (e.key === 'e' || e.key === 'E') tusBasili = false; });
    addEventListener('blur', () => { tusBasili = false; dugmeBasili = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && kayitZ) kaydet(); }); addEventListener('pagehide', () => { if (kayitZ) kaydet(); });
  }

  /* ---------- alma ---------- */
  let hedef = null; // sürmekte olan alışın nesnesi { k, id, tur, x, y, z }
  const ogeBul = h => { const H = hucreler.get(h.k); if (!H) return null; for (const o of H.ogeler) if (o.id === h.id) return [H, o]; return null; };
  function basla(o) { const A = SO.toplaAnim; if (!A || !o || !A.basla(o.x, o.y + o.tut, o.z)) return false; hedef = { k: o.k, id: o.id, tur: o.tur, x: o.x, y: o.y, z: o.z }; istek = 0; return true; }
  function alindi() { const h = hedef; hedef = null; if (!h) return; const b = ogeBul(h); if (b) ogeKaldir(b[0], b[1]); alindiYaz(h.k, h.id); envanter.ekle(h.tur, 1); try { SO.ses.olay('al', { tur: h.tur }); } catch (e) { } }
  function birak() { const h = hedef; hedef = null; if (!h) return; const b = ogeBul(h); if (b && b[1].ag) { matrisYaz(b[1]); b[1].ag.mesh.instanceMatrix.needsUpdate = true; } } // alış yarıda kesildi: nesne yerinde kalır

  function init() {
    turAd = Object.keys(TUR); stil(); yukle();
    const GR = SO.gorunum && SO.gorunum.nesneGeo && SO.gorunum.nesneMat ? SO.gorunum : null;
    const kucul = '#ifdef USE_INSTANCING\n vec3 ipT = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; transformed *= 1.0 - smoothstep(uFar - 24.0, uFar, distance(ipT, uCam));\n#endif';
    if (GR) { // ağaç/kaya malzemesi; onun uzakta küçülmesi (son 90 m) yerine kendi kısa aralığımız (son 24 m) ve örnek rengi (biyom tonu) eklenir
      const uSonsuz = { value: 1e7 }; mat = GR.nesneMat(uSonsuz, uCam); const once = mat.onBeforeCompile;
      mat.onBeforeCompile = (s, r) => { once(s, r); s.uniforms.uFarT = uFar; s.vertexShader = 'uniform float uFarT;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + kucul.replace(/uFar/g, 'uFarT') + '\n#ifdef USE_INSTANCING_COLOR\n vColor.xyz *= instanceColor.xyz;\n#endif'); };
    } else { mat = new T3.MeshBasicMaterial({ vertexColors: true }); mat.onBeforeCompile = s => { s.uniforms.uFar = uFar; s.uniforms.uCam = uCam; s.vertexShader = 'uniform float uFar; uniform vec3 uCam;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + kucul); }; }
    turAd.forEach(ad => { const Tr = TUR[ad], gs = Tr.sekiller(); Tr.ag0 = aglar.length; Tr.n = gs.length;
      gs.forEach(parcalar => { const geo = GR ? dokuluGeo(GR, parcalar, Tr.doku) : duzGeo(parcalar); parcalar.forEach(p => p.geo.dispose()); const g = { geo, kap: 256, n: 0, i: 0, mesh: null }; g.mesh = agKur(g, g.kap); aglar.push(g); });
      if (!(ad in envanter)) Object.defineProperty(envanter, ad, { get: () => say[ad] || 0, enumerable: true }); });
    bAl = document.getElementById('bAl'); kutu = document.getElementById('envanter');
    if (kutu) { kutu.setAttribute('role', 'status'); kutu.setAttribute('aria-label', 'Toplananlar'); } if (bAl) girdiKur(); ciz();
    const ps = SO.ps; akis(Math.floor(ps.x / HUCRE), Math.floor(ps.z / HUCRE), 0, true); yenile();
  }

  function update(dt) {
    if (!mat) return; const ps = SO.ps, A = SO.toplaAnim, S = A && A.durum;
    akis(Math.floor(ps.x / HUCRE), Math.floor(ps.z / HUCRE), dt, false); if (kirli) yenile();
    uCam.value.copy(SO.camera.position);
    // süren alış: el değdi mi, kesildi mi; son anda nesne ele çekilir
    if (hedef && S) {
      if (S.deger) alindi();
      else if (S.iptal || !S.on || S.faz !== 'in') birak();
      else if (S.u > .8 && S.elVar) { const b = ogeBul(hedef); if (b) { const o = b[1], kk = sm(.8, 1, S.u), k2 = kk * kk; M4.compose(pV.set(lerp(o.x, S.el.x, k2), lerp(o.y, S.el.y - o.tut * .5, k2), lerp(o.z, S.el.z, k2)), o.q, sV.setScalar(o.s * (1 - .35 * k2))); o.ag.mesh.setMatrixAt(o.yuva, M4); o.ag.mesh.instanceMatrix.needsUpdate = true; } }
    }
    // şu an alınabilecek nesne
    const uygun = !!A && A.uygun() && !(ps.suDerin > .7);
    let hOge = null; if (hedef) { const b = ogeBul(hedef); hOge = b && b[1]; }
    const yakin = uygun ? ara(ps, hOge) : null; T.yakin = yakin; vurgula(yakin);
    // istek: düğme/tuş (basılı tutulursa sıradaki de alınır), SO.input.act (tek seferlik)
    if (SO.input.act) { SO.input.act = false; istek = .35; }
    if (istek > 0) istek -= dt;
    if ((istek > 0 || dugmeBasili || tusBasili) && yakin && !hedef && A.hazir()) basla(yakin);
    const gor = !!yakin || !!hedef || dugmeBasili || (!!S && S.on && S.faz !== 'kalk');
    if (bAl && gor !== alGorunur) { alGorunur = gor; bAl.hidden = !gor; }
    if (kayitZ > 0) { kayitZ -= dt; if (kayitZ <= 0) kaydet(); }
  }

  // (x, z) çevresinde yarıçap içindeki nesne sayıları (yüklü olmayan hücreler geçici üretilir; deneme ve denge için)
  function sayim(x, z, yar) { const out = { toplam: 0 }, i0 = Math.floor((x - yar) / HUCRE), i1 = Math.floor((x + yar) / HUCRE), j0 = Math.floor((z - yar) / HUCRE), j1 = Math.floor((z + yar) / HUCRE);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const H = hucreler.get(anahtar(i, j)) || hucreUret(i, j); for (const o of H.ogeler) if (Math.hypot(o.x - x, o.z - z) <= yar) { out[o.tur] = (out[o.tur] || 0) + 1; out.toplam++; } } return out; }
  function turEkle(ad, tanim) { if (mat) throw new Error('turEkle init\'ten önce çağrılmalı'); TUR[ad] = tanim; turAd = Object.keys(TUR); }
  const T = SO.toplama = { init, update, yakin: null, al: () => basla(T.yakin), TUR, turEkle, say: sayim, hucreler, kodla, coz, kaydet,
    durum: () => { let n = 0; hucreler.forEach(H => { n += H.ogeler.length; }); return { hucre: hucreler.size, nesne: n, ag: aglar.map(g => g.n + '/' + g.kap), alinan: alinanSay, kayit: kayitBoy || kodla().length, hedef: hedef && hedef.tur, eksik: eksikVar }; } };
})();
