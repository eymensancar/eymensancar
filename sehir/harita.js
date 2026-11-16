/* Harita: küçük harita (sağ üstte yuvarlak düğme) ve tam harita (düğmeye dokununca açılır), keşif sisiyle.
   SO.harita = { init(), update(dt), ac(), kapat(), ortala(), gorunum(g), isaret, isaretKoy(x, z), isaretSil(), simgeEkle(s), simgeSil(id),
                 durum(), acikMi(x, z), kodla(), coz(s), ciz() }. Three.js sahnesine dokunmaz: düz 2B tuval + DOM.

   Tam harita: tek parmakla (ya da fareyle) sürükleme kaydırır, iki parmakla kıstırma / fare tekerleği / + − yakınlaştırır
   (en uzak: bütün dünya 32 km; en yakın: 360 m). Açılışta oyuncu ortada, 3 km. Kısa dokunuş işaret koyar (işarete dokunuş kaldırır);
   oyuncudan işarete noktalı çizgi iki haritada da çizilir. Başka kod simgeEkle ile haritaya adlı nokta koyabilir.

   Keşif: dünya H = 16 m'lik hücrelere bölünür (32 km / 16 m = 2000 × 2000 hücre). Açık/kapalı bilgisi hücre başına 1 bit
   (bit dizisi 500 KB). 16 m: 100 m'lik daire ≈ 123 hücre (yuvarlak görünür), bir koşu adımında (8 m) açılan yeni hücre
   ≈ 13 (renk çağrısı az), kayıt küçük. 10 m hücre 2,5 kat renk çağrısı ve 2,5 kat doku isterdi; 20 m'de daire köşeli kalıyor.
   Oyuncu her ADIM (8 m) yer değiştirdikçe çevresindeki R = 100 m içindeki hücreler açılır; açılan hücre bir daha kapanmaz.

   Renk: SO.world.renk pahalıdır (gürültü). Yalnız yeni açılan hücreler için, hücre başına bir kez çağrılır ve sıraya konur;
   kare başına en çok BUTCE hücre ya da MS milisaniye işlenir. Kayıttan gelen hücreler önce kâğıt rengiyle görünür,
   renkleri oyuncuya yakın olandan başlayarak arkadan hesaplanır (yeni açılanlar hep önce).

   Doku: 125 × 125 hücrelik (2 km) karolar, yalnız açık hücresi olan karo için ayrılır (ImageData, karo başına 62 KB;
   en çok 16 × 16 karo). Çizimde pencereye düşen karolar hücre başına 1 piksel olarak bir ara tuvale kopyalanır, ara tuval
   bulanıklaştırılıp büyütülür: sis kenarı kare kare değil, yumuşak geçişli çıkar (yakından bakınca hücreler keskin, kenar yine yumuşak).
   16 km'den geniş görünüm için 500 × 500'lük özet doku (piksel = 4 × 4 hücre = 64 m; içinde açık hücre varsa boyalı) ilk gerektiğinde kurulur.

   Kayıt: localStorage 'acik-dunya-harita-v1' = {"v":1,"h":16,"n":2000,"d":"<base64>","i":[x,z]} (i: işaret, yoksa alan yok); d = bit dizisinin satır satır
   uzunluk kodlaması (sırayla kapalı/açık koşu uzunlukları, değişken boylu tam sayı). Yalnız açık/kapalı saklanır, renk saklanmaz
   (dünya üretimi değişse de kayıt geçerli kalır). 10 sn'de bir (değiştiyse) ve sayfa gizlenirken yazılır. ?test kipinde yok. */
(function () {
  'use strict';
  const SO = window.SO;
  const H = 16, R = 100, ADIM = 8, T = 125, OV = 4;          // hücre (m), açma yarıçapı (m), açma aralığı (m), karo (hücre), özet (hücre/piksel)
  const BUTCE = 48, MS = 1.5;                               // kare başına en çok renk hesabı / süre (ms)
  const MINI_M = 360, EN_YAKIN = 360, ACILIS_M = 3000;       // küçük haritanın genişliği, tam haritada en yakın ve açılış genişliği (m)
  const OZET_M = 16000, KESKIN_PX = 8;                      // bundan geniş görünüm özet dokudan çizilir; hücre bu kadar aygıt pikselinden büyükse keskin çizilir
  const ANAHTAR = 'acik-dunya-harita-v1', KAYIT_SN = 10, KAYIT_EN_COK = 600000; // kayıt en çok bu kadar karakter
  let HALF = 16000, N = 2000, TN = 16, bits = null, acik = 0;
  const karolar = new Map();                                // karo no → ImageData (T × T)
  let yeni = [], yeniBas = 0, eski = [];                    // renk bekleyen hücreler: yeni açılanlar (önce), kayıttan gelenler (sondan alınır)
  let ov = null, ovC = null, ovX = null, ovKirli = null;    // "Tüm dünya" özeti
  let sonX = 1e9, sonZ = 1e9, kirli = false, kayitT = 0, kayitBoy = 0;
  let surum = 0;                                            // doku her değiştiğinde artar (yeniden çizim gerekir mi)
  let el = null, acikMi = false, kenar = 300;
  let gx = 0, gz = 0, gm = 3000, takip = true;              // tam harita görünümü: merkez (dünya), genişlik (m), oyuncuyu izliyor mu
  let isaret = null; const simgeler = new Map(), parm = new Map(); let dok = null; // işaret {x,z}; simgeler; haritadaki parmaklar; kısa dokunuş adayı
  const cizim = { mini: { t: 9, x: 1e9, z: 1e9, yaw: 9, cyaw: 9, s: -1 }, tam: { t: 9, x: 1e9, z: 1e9, yaw: 9, cyaw: 9, s: -1 } };
  let sure = 0, renkler = null, sisDesen = null;
  const YAZILIM = { willReadFrequently: true };             // putImageData ile beslenen tuvaller baştan bellekte dursun (sonradan ekran kartından geri alınması takılma yapıyor)
  const ara = {};                                           // ara tuvaller (hücre başına 1 piksel)

  /* ---------- keşif ızgarası ---------- */
  const hucre = v => Math.floor((v + HALF) / H);
  function karo(k) { let im = karolar.get(k); if (!im) { im = new ImageData(T, T); karolar.set(k, im); } return im; }
  function boya(idx, r, g, b) {
    const i = idx % N, j = (idx - i) / N, ti = (i / T) | 0, tj = (j / T) | 0, d = karo(tj * TN + ti).data, o = ((j - tj * T) * T + (i - ti * T)) * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; surum++;
    if (ov) ovYaz(i, j, r, g, b);
  }
  function ovYaz(i, j, r, g, b) {
    const x = (i / OV) | 0, y = (j / OV) | 0, d = ov.data, o = (y * ov.width + x) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    const k = ovKirli; if (x < k[0]) k[0] = x; if (y < k[1]) k[1] = y; if (x > k[2]) k[2] = x; if (y > k[3]) k[3] = y;
  }
  // (px, pz) çevresinde R metre içindeki hücreleri açar (merkezi dairenin içinde olanlar)
  function acDaire(px, pz) {
    const i0 = Math.max(0, hucre(px - R)), i1 = Math.min(N - 1, hucre(px + R)), j0 = Math.max(0, hucre(pz - R)), j1 = Math.min(N - 1, hucre(pz + R));
    for (let j = j0; j <= j1; j++) { const dz = (j + .5) * H - HALF - pz;
      for (let i = i0; i <= i1; i++) { const dx = (i + .5) * H - HALF - px; if (dx * dx + dz * dz > R * R) continue;
        const idx = j * N + i, m = 1 << (idx & 7); if (bits[idx >> 3] & m) continue; bits[idx >> 3] |= m; acik++; yeni.push(idx); kirli = true; } }
  }
  function islet() {
    if (yeniBas >= yeni.length && !eski.length) return; const t0 = performance.now(), W = SO.world; let n = 0;
    while (n < BUTCE) { let idx; if (yeniBas < yeni.length) idx = yeni[yeniBas++]; else if (eski.length) idx = eski.pop(); else break;
      const i = idx % N, j = (idx - i) / N, c = W.renk((i + .5) * H - HALF, (j + .5) * H - HALF); boya(idx, c[0], c[1], c[2]);
      if ((++n & 7) === 0 && performance.now() - t0 > MS) break; }
    if (yeniBas >= yeni.length) { yeni.length = 0; yeniBas = 0; }
  }

  /* ---------- kayıt: satır-uzunluk kodlaması + base64 ---------- */
  function kodla() {
    const out = [], toplam = N * N; let deger = 0, kosu = 0, p = 0;
    const yaz = v => { while (v > 127) { out.push((v & 127) | 128); v = Math.floor(v / 128); } out.push(v); };
    while (p < toplam) {
      if ((p & 7) === 0 && p + 8 <= toplam) { const by = bits[p >> 3]; if (by === (deger ? 255 : 0)) { kosu += 8; p += 8; continue; } }
      const b = (bits[p >> 3] >> (p & 7)) & 1; if (b === deger) kosu++; else { yaz(kosu); deger = b; kosu = 1; } p++;
    }
    yaz(kosu); let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.slice(i, i + 8192));
    const o = { v: 1, h: H, n: N, d: btoa(s) }; if (isaret) o.i = [Math.round(isaret.x), Math.round(isaret.z)]; return JSON.stringify(o);
  }
  // kayıt metnini bit dizisine çözer; geçersizse null
  function coz(metin) {
    const o = JSON.parse(metin); if (!o || o.v !== 1 || o.h !== H || o.n !== N || typeof o.d !== 'string') return null;
    const s = atob(o.d), b = new Uint8Array(Math.ceil(N * N / 8)), toplam = N * N; let p = 0, deger = 0, i = 0, say = 0;
    while (i < s.length) { let v = 0, carp = 1, c; do { c = s.charCodeAt(i++); v += (c & 127) * carp; carp *= 128; } while (c > 127 && i < s.length);
      if (p + v > toplam) return null;
      if (deger) { let q = p; const son = p + v; say += v; while (q < son) { if ((q & 7) === 0 && q + 8 <= son) { b[q >> 3] = 255; q += 8; } else { b[q >> 3] |= 1 << (q & 7); q++; } } }
      p += v; deger ^= 1; }
    return { bits: b, acik: say, isaret: Array.isArray(o.i) && isFinite(o.i[0]) && isFinite(o.i[1]) ? { x: +o.i[0], z: +o.i[1] } : null };
  }
  function kaydet() {
    if (SO.test || !kirli || !bits) return; let s; try { s = kodla(); } catch (e) { return; }
    if (s.length > KAYIT_EN_COK) return;                    // sınırı aşan kayıt yazılmaz (eski kayıt durur)
    try { localStorage.setItem(ANAHTAR, s); kirli = false; kayitBoy = s.length; } catch (e) { }
  }
  function yukle() {
    if (SO.test) return; let s = null; try { s = localStorage.getItem(ANAHTAR); } catch (e) { return; } if (!s) return;
    let c = null; try { c = coz(s); } catch (e) { c = null; } if (!c) return; kur(c); kayitBoy = s.length;
  }
  // çözülmüş kaydı yerleştirir: hücreler hemen kâğıt rengiyle açılır, gerçek renkleri oyuncuya yakından uzağa sırayla hesaplanır
  function kur(c) {
    bits = c.bits; acik = c.acik; karolar.clear(); yeni = []; yeniBas = 0; ov = null; const liste = [], p = renkler.kagit;
    for (let by = 0; by < bits.length; by++) { const v = bits[by]; if (!v) continue; for (let q = 0; q < 8; q++) if (v & (1 << q)) { const idx = by * 8 + q; liste.push(idx); boya(idx, p[0], p[1], p[2]); } }
    const pi = hucre(SO.ps.x), pj = hucre(SO.ps.z), uz = idx => { const i = idx % N, j = (idx - i) / N; return (i - pi) * (i - pi) + (j - pj) * (j - pj); };
    liste.sort((a, b) => uz(b) - uz(a)); eski = liste; surum++; isaretYaz(c.isaret || null, true);
  }

  /* ---------- çizim ---------- */
  function renkOku() {
    const cs = getComputedStyle(document.documentElement), al = (ad, yedek) => (cs.getPropertyValue(ad) || '').trim() || yedek;
    renkler = { murekkep: al('--ink', '#15120d'), kagitS: al('--paper', '#f1e8d4'), sis: al('--sis', '#a9b1b3'), sisAcik: al('--sis-acik', '#c3c9c9'), dis: al('--harita-dis', '#2b2721'), ok: al('--harita-ok', '#e5482d'), isaret: al('--harita-isaret', al('--accent', '#f5b21c')), kagit: [241, 232, 212] };
    const m = /^#([0-9a-f]{6})$/i.exec(renkler.kagitS); if (m) { const v = parseInt(m[1], 16); renkler.kagit = [v >> 16, (v >> 8) & 255, v & 255]; }
  }
  // sis deseni: düz sis rengi üstünde açık/koyu yumuşak lekeler (kenarlardan sarılır, döşenebilir)
  function sisKur() {
    const S = 96, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), rnd = SO.rnd(7);
    x.fillStyle = renkler.sis; x.fillRect(0, 0, S, S);
    for (let k = 0; k < 9; k++) { const bx = rnd() * S, by = rnd() * S, br = 26 + rnd() * 22; x.globalAlpha = k % 3 ? .3 : .06;
      for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) { const g = x.createRadialGradient(bx + ox, by + oy, 0, bx + ox, by + oy, br);
        g.addColorStop(0, k % 3 ? renkler.sisAcik : renkler.dis); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(bx + ox - br, by + oy - br, br * 2, br * 2); } }
    sisDesen = c;
  }
  function ovKur() {
    const B = Math.ceil(N / OV); ov = new ImageData(B, B); ovC = document.createElement('canvas'); ovC.width = ovC.height = B; ovX = ovC.getContext('2d', YAZILIM); ovKirli = [B, B, -1, -1];
    karolar.forEach((im, k) => { const ti = k % TN, tj = (k - ti) / TN, d = im.data; for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const o = (y * T + x) * 4; if (d[o + 3]) ovYaz(ti * T + x, tj * T + y, d[o], d[o + 1], d[o + 2]); } });
  }
  function tuvalBoy(cv, css) { const dpr = Math.min(window.devicePixelRatio || 1, 2), px = Math.round(css * dpr); if (cv.width !== px || cv.height !== px) { cv.width = cv.height = px; } return px / css; }
  /* Haritanın bir penceresini çizer: sol üst köşe (sol, ust) dünya koordinatı, genişlik `m` metre, tuvalde S (CSS pikseli) kare.
     m > OZET_M ise özet dokudan; değilse karolardan toplanan ara tuvalden. Hücre ekranda yeterince büyükse (keskin) hücreler
     yumuşatmasız (keskin) çizilir, sis kenarı yine yumuşak kalır. */
  function pencere(x, S, sol, ust, m, ad, dpr) {
    const k = S / m, w0 = Math.max(0, (-HALF - sol) * k), h0 = Math.max(0, (-HALF - ust) * k), w1 = Math.min(S, (HALF - sol) * k), h1 = Math.min(S, (HALF - ust) * k);
    x.fillStyle = renkler.dis; x.fillRect(0, 0, S, S); if (w1 <= w0 || h1 <= h0) return k;
    // sis: desen dünyaya sabit (harita kayarken birlikte kayar); çok uzaktan bakınca desen küçülmesin diye ölçek sabit
    x.save(); x.beginPath(); x.rect(w0, h0, w1 - w0, h1 - h0); x.clip(); const P = sisDesen.width, kx = -(((sol * k) % P) + P) % P, ky = -(((ust * k) % P) + P) % P;
    x.translate(kx, ky); x.fillStyle = x.createPattern(sisDesen, 'repeat'); x.fillRect(-kx, -ky, S, S); x.restore();
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    if (m > OZET_M) {
      if (!ov) ovKur(); const q = ovKirli;
      if (q[2] >= q[0]) { ovX.putImageData(ov, 0, 0, q[0], q[1], q[2] - q[0] + 1, q[3] - q[1] + 1); q[0] = q[1] = ov.width; q[2] = q[3] = -1; }
      x.drawImage(ovC, (-HALF - sol) * k, (-HALF - ust) * k, ov.width * OV * H * k, ov.height * OV * H * k); return k;
    }
    // ara tuval: pencereyi (bir hücre payıyla) hücre başına 1 piksel olarak karolardan topla (tuval yalnız büyür)
    const i0 = hucre(sol) - 1, j0 = hucre(ust) - 1, n = Math.ceil(m / H) + 3; let a = ara[ad];
    if (!a || a.boy < n) { const boy = Math.ceil(n / 64) * 64, c = document.createElement('canvas'), b = document.createElement('canvas'), kat = (a && a.kat) || document.createElement('canvas'); c.width = c.height = b.width = b.height = boy; a = ara[ad] = { c, x: c.getContext('2d', YAZILIM), b, bx: b.getContext('2d', YAZILIM), kat, boy }; }
    a.x.clearRect(0, 0, a.boy, a.boy);
    for (let tj = Math.max(0, Math.floor(j0 / T)); tj <= Math.min(TN - 1, Math.floor((j0 + n - 1) / T)); tj++) for (let ti = Math.max(0, Math.floor(i0 / T)); ti <= Math.min(TN - 1, Math.floor((i0 + n - 1) / T)); ti++) {
      const im = karolar.get(tj * TN + ti); if (!im) continue; const dx = ti * T - i0, dy = tj * T - j0, sx = Math.max(0, -dx), sy = Math.max(0, -dy), sw = Math.min(T, n - dx) - sx, sh = Math.min(T, n - dy) - sy;
      if (sw > 0 && sh > 0) a.x.putImageData(im, dx, dy, sx, sy, sw, sh); }
    // sis kenarını yumuşat: yarım piksel kaydırılmış dört kopyanın ortalaması (≈ 3 × 3 hücrelik bulanıklık)
    a.bx.clearRect(0, 0, a.boy, a.boy); for (let q = 0; q < 4; q++) { a.bx.globalAlpha = 1 / (q + 1); a.bx.drawImage(a.c, 0, 0, n, n, q & 1 ? .5 : -.5, q & 2 ? .5 : -.5, n, n); } a.bx.globalAlpha = 1;
    const dx = (i0 * H - HALF - sol) * k, dy = (j0 * H - HALF - ust) * k, dw = n * H * k;
    if (H * k * dpr < KESKIN_PX) { x.drawImage(a.b, 0, 0, n, n, dx, dy, dw, dw); return k; }
    // keskin: önce bulanık kopya (yumuşak sis kenarı, saydamlık), üstüne aynı saydamlıkla yumuşatmasız hücreler
    const kt = a.kat, px = Math.round(S * dpr); if (kt.width !== px || kt.height !== px) kt.width = kt.height = px; const y = kt.getContext('2d');
    y.setTransform(dpr, 0, 0, dpr, 0, 0); y.globalCompositeOperation = 'source-over'; y.clearRect(0, 0, S, S); y.imageSmoothingEnabled = true; y.drawImage(a.b, 0, 0, n, n, dx, dy, dw, dw);
    y.globalCompositeOperation = 'source-atop'; y.imageSmoothingEnabled = false; y.drawImage(a.c, 0, 0, n, n, dx, dy, dw, dw);
    x.drawImage(kt, 0, 0, S, S); return k;
  }
  // çift çizgili yol: önce kâğıt (kalın), sonra renk; her zeminde okunur
  function ciftCiz(x, yol, renk, w) { x.lineJoin = 'round'; x.lineCap = 'round'; x.lineWidth = w + 2.6; x.strokeStyle = renkler.kagitS; yol(); x.stroke(); x.lineWidth = w; x.strokeStyle = renk; yol(); x.stroke(); }
  // oyuncu simgesi: sivri uçlu yön oku, baktığı yöne dönük (kuzey yukarı; ileri = (sin yaw, cos yaw), +z güney = aşağı)
  function oyuncu(x, px, py, yaw, r) {
    x.save(); x.translate(px, py); x.rotate(Math.PI - yaw); const yol = () => { x.beginPath(); x.moveTo(0, -r * 2.1); x.lineTo(r * 1.45, r * 1.5); x.lineTo(0, r * .62); x.lineTo(-r * 1.45, r * 1.5); x.closePath(); };
    x.lineJoin = 'round'; yol(); x.lineWidth = Math.max(3.4, r * .9); x.strokeStyle = renkler.kagitS; x.stroke(); x.lineWidth = Math.max(1.5, r * .4); x.strokeStyle = renkler.murekkep; x.stroke(); x.fillStyle = renkler.ok; x.fill();
    x.restore();
  }
  // kameranın baktığı yönü gösteren soluk görüş konisi
  function koni(x, px, py, yaw, boy) {
    const a = Math.atan2(Math.cos(yaw), Math.sin(yaw)), g = x.createRadialGradient(px, py, 0, px, py, boy); g.addColorStop(0, 'rgba(255,255,255,.62)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.beginPath(); x.moveTo(px, py); x.arc(px, py, boy, a - .55, a + .55); x.closePath(); x.fillStyle = g; x.fill();
  }
  // pencerenin dışındaki bir şeyi gösteren kenar oku: (px, py) noktasında, `a` açısına (tuval açısı) bakar
  function kenarOk(x, px, py, a, s, renk) {
    x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.moveTo(s, 0); x.lineTo(-s * .7, s * .8); x.lineTo(-s * .7, -s * .8); x.closePath(); x.lineJoin = 'round';
    x.lineWidth = 3.4; x.strokeStyle = renkler.kagitS; x.stroke(); x.lineWidth = 1.5; x.strokeStyle = renkler.murekkep; x.stroke(); x.fillStyle = renk; x.fill(); x.restore();
  }
  // işaret iğnesi: ucu (px, py) noktasında
  function igne(x, px, py, s) {
    x.save(); x.translate(px, py); x.beginPath(); x.arc(0, -s * 1.55, s * .82, Math.PI * 5 / 6, Math.PI * 13 / 6); x.lineTo(0, 0); x.closePath(); x.lineJoin = 'round';
    x.lineWidth = 4.2; x.strokeStyle = renkler.kagitS; x.stroke(); x.lineWidth = 1.8; x.strokeStyle = renkler.murekkep; x.stroke(); x.fillStyle = renkler.isaret; x.fill();
    x.beginPath(); x.arc(0, -s * 1.55, s * .3, 0, 7); x.fillStyle = renkler.murekkep; x.fill(); x.restore();
  }
  /* Oyuncudan işarete noktalı çizgi. Noktalar dünya uzayında, işaretten başlayarak sabit aralıklı (25 m × 2^n; ekranda en az
     `enAzPx` aralık kalacak en küçük n): oyuncu yürürken yerlerinde durur, yaklaştıkça tek tek tükenir. `daire` > 0 ise yalnız
     tuval merkezinden o kadar piksel içindeki noktalar çizilir (küçük harita). */
  function noktaliCizgi(x, S, sol, ust, k, enAzPx, r, daire) {
    if (!isaret) return; const ps = SO.ps, dx = ps.x - isaret.x, dz = ps.z - isaret.z, d = Math.hypot(dx, dz); if (d < 2) return;
    let s = 25; while (s * k < enAzPx) s *= 2; const ux = dx / d, uz = dz / d, bas = Math.max(8, 9 / k), yol = [];
    // görünen parçaya kırp (pencereyi saran daireyle): uzak işarette binlerce nokta dolaşılmasın
    const mx = sol + S / k / 2, mz = ust + S / k / 2, tm = (mx - isaret.x) * ux + (mz - isaret.z) * uz, yar = S / k * .75 + s;
    for (let i = Math.max(1, Math.ceil((tm - yar) / s)), son = Math.min((d - bas) / s, (tm + yar) / s); i <= son; i++) {
      const px = (isaret.x + ux * i * s - sol) * k, py = (isaret.z + uz * i * s - ust) * k; if (px < -4 || py < -4 || px > S + 4 || py > S + 4) continue;
      if (daire && Math.hypot(px - S / 2, py - S / 2) > daire) continue; yol.push(px, py); }
    for (const [rr, c] of [[r + 1.3, renkler.murekkep], [r, renkler.isaret]]) { x.beginPath(); for (let i = 0; i < yol.length; i += 2) { x.moveTo(yol[i] + rr, yol[i + 1]); x.arc(yol[i], yol[i + 1], rr, 0, 7); } x.fillStyle = c; x.fill(); }
  }
  function simgeCiz(x, S, sol, ust, k, adli) {
    simgeler.forEach(sm => { const px = (sm.x - sol) * k, py = (sm.z - ust) * k; if (px < -8 || py < -8 || px > S + 8 || py > S + 8) return; const r = adli ? 4.2 : 2.6;
      x.beginPath(); x.arc(px, py, r + 1.6, 0, 7); x.fillStyle = renkler.kagitS; x.fill(); x.beginPath(); x.arc(px, py, r, 0, 7); x.fillStyle = sm.renk || renkler.murekkep; x.fill();
      if (adli && sm.ad) etiket(x, sm.ad, px, py - r - 9, 'center'); });
  }
  function miniCiz() {
    const cv = el.miniC, S = 66, x = cv.getContext('2d'), ps = SO.ps, dpr = tuvalBoy(cv, S), sol = ps.x - MINI_M / 2, ust = ps.z - MINI_M / 2, m = S / 2; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = pencere(x, S, sol, ust, MINI_M, 'mini', 0); // küçük harita hep yumuşak çizilir
    koni(x, m, m, SO.cam.yaw, 27); simgeCiz(x, S, sol, ust, k, false);
    if (isaret) { noktaliCizgi(x, S, sol, ust, k, 4.5, 1.5, 21); const ix = (isaret.x - sol) * k - m, iy = (isaret.z - ust) * k - m, id = Math.hypot(ix, iy);
      if (id > 23) kenarOk(x, m + ix / id * 25.5, m + iy / id * 25.5, Math.atan2(iy, ix), 4.6, renkler.isaret); else igne(x, m + ix, m + iy, 4.2); }
    oyuncu(x, m, m, ps.yaw, 3.7);
  }
  function etiket(x, metin, px, py, hiza) {
    x.font = "700 11px system-ui,-apple-system,'Segoe UI',sans-serif"; x.textAlign = hiza; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 3; x.strokeStyle = renkler.kagitS; x.strokeText(metin, px, py); x.fillStyle = renkler.murekkep; x.fillText(metin, px, py);
  }
  // görünüm: merkez (gx, gz), genişlik gm metre; `takip` açıkken merkez oyuncudur. Merkez, pencere dünyadan taşmayacak şekilde sınırlanır.
  function gorus() {
    gm = Math.max(EN_YAKIN, Math.min(HALF * 2, gm)); if (takip) { gx = SO.ps.x; gz = SO.ps.z; } const pay = Math.max(0, HALF - gm / 2);
    gx = Math.max(-pay, Math.min(pay, gx)); gz = Math.max(-pay, Math.min(pay, gz)); return { sol: gx - gm / 2, ust: gz - gm / 2, m: gm, k: kenar / gm };
  }
  function tamCiz() {
    const cv = el.tamC, S = kenar, x = cv.getContext('2d'), ps = SO.ps, dpr = tuvalBoy(cv, S), g = gorus(), sol = g.sol, ust = g.ust, m = g.m; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = pencere(x, S, sol, ust, m, 'tam', dpr);
    // kılavuz çizgileri: ekranda en az ~45 px aralık bırakan en küçük adım (çok soluk)
    let ar = 100; for (const a of [100, 500, 1000, 4000, 8000]) { ar = a; if (a * k >= 45) break; } x.save(); x.globalAlpha = .13; x.strokeStyle = renkler.murekkep; x.lineWidth = 1; x.beginPath();
    for (let q = Math.ceil(sol / ar) * ar; q < sol + m; q += ar) { if (Math.abs(q) >= HALF) continue; const p = Math.round((q - sol) * k) + .5; x.moveTo(p, Math.max(0, (-HALF - ust) * k)); x.lineTo(p, Math.min(S, (HALF - ust) * k)); }
    for (let q = Math.ceil(ust / ar) * ar; q < ust + m; q += ar) { if (Math.abs(q) >= HALF) continue; const p = Math.round((q - ust) * k) + .5; x.moveTo(Math.max(0, (-HALF - sol) * k), p); x.lineTo(Math.min(S, (HALF - sol) * k), p); }
    x.stroke(); x.restore();
    x.lineWidth = 2; x.strokeStyle = renkler.murekkep; x.strokeRect((-HALF - sol) * k, (-HALF - ust) * k, HALF * 2 * k, HALF * 2 * k); // dünyanın sınırı
    const px = (ps.x - sol) * k, py = (ps.z - ust) * k, icte = px > -10 && py > -10 && px < S + 10 && py < S + 10;
    if (icte && R * k >= 12) { x.save(); x.globalAlpha = .5; x.setLineDash([4, 4]); x.lineWidth = 1.5; x.strokeStyle = renkler.murekkep; x.beginPath(); x.arc(px, py, R * k, 0, 7); x.stroke(); x.restore(); } // 100 m'lik görüş halkası
    simgeCiz(x, S, sol, ust, k, true);
    if (isaret) { noktaliCizgi(x, S, sol, ust, k, 11, 2.3, 0); const ix = (isaret.x - sol) * k, iy = (isaret.z - ust) * k;
      if (ix > -12 && iy > -4 && ix < S + 12 && iy < S + 30) igne(x, ix, iy, 8.5); else { const cx = Math.max(13, Math.min(S - 13, ix)), cy = Math.max(13, Math.min(S - 13, iy)); kenarOk(x, cx, cy, Math.atan2(iy - cy, ix - cx), 6.5, renkler.isaret); } }
    if (icte) { if (m <= 6000) koni(x, px, py, SO.cam.yaw, 34); oyuncu(x, px, py, ps.yaw, 5.2); }
    else { const cx = Math.max(13, Math.min(S - 13, px)), cy = Math.max(13, Math.min(S - 13, py)); kenarOk(x, cx, cy, Math.atan2(py - cy, px - cx), 7, renkler.ok); } // oyuncu pencerenin dışında: kenarda ok
    // ölçek çizgisi (sol alt): pencerenin en çok ~%30'u kadar yuvarlak bir uzunluk; kuzey işareti (sol üst)
    let ol = 50; for (const a of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) if (a * k <= S * .3) ol = a; const u = ol * k, bx = 12, by = S - 14;
    ciftCiz(x, () => { x.beginPath(); x.moveTo(bx, by - 5); x.lineTo(bx, by); x.lineTo(bx + u, by); x.lineTo(bx + u, by - 5); }, renkler.murekkep, 2);
    etiket(x, ol >= 1000 ? ol / 1000 + ' km' : ol + ' m', bx + u / 2, by - 10, 'center');
    const nx = 20, ny = 30; ciftCiz(x, () => { x.beginPath(); x.moveTo(nx, ny + 12); x.lineTo(nx, ny - 6); x.moveTo(nx - 5, ny); x.lineTo(nx, ny - 7); x.lineTo(nx + 5, ny); }, renkler.murekkep, 2);
    etiket(x, 'K', nx, ny - 16, 'center');
  }
  // çizim seyrek: en çok belli sıklıkta ve yalnız bir şey değiştiyse (oyuncu yer/yön değiştirdi, kamera döndü ya da doku/işaret değişti)
  function gerekirse(c, aralik, yer, fn) {
    if (sure - c.t < aralik) return; const ps = SO.ps;
    if (c.s === surum && Math.abs(ps.x - c.x) < yer && Math.abs(ps.z - c.z) < yer && Math.abs(SO.wrapA(ps.yaw - c.yaw)) < .05 && Math.abs(SO.wrapA(SO.cam.yaw - c.cyaw)) < .06) return;
    c.t = sure; c.x = ps.x; c.z = ps.z; c.yaw = ps.yaw; c.cyaw = SO.cam.yaw; c.s = surum; fn();
  }
  // dokunuşla kaydırma/yakınlaştırma sırasında hemen (ekran karesinde bir kez) çiz: oyun döngüsünün seyrek çizimini bekleme
  let istendi = false;
  function iste() { cizim.tam.s = -1; if (istendi) return; istendi = true; requestAnimationFrame(() => { istendi = false; if (acikMi && SO.ready) { cizim.tam.s = surum; tamCiz(); } }); }

  /* ---------- işaret ve simgeler ---------- */
  function isaretYaz(v, kayitsiz) {
    isaret = v ? { x: Math.max(-HALF, Math.min(HALF, +v.x)), z: Math.max(-HALF, Math.min(HALF, +v.z)) } : null; if (isaret && !(isFinite(isaret.x) && isFinite(isaret.z))) isaret = null;
    surum++; if (!kayitsiz) kirli = true; if (el) { el.sil.hidden = !isaret; if (acikMi) iste(); }
  }
  function simgeEkle(s) { if (!s || s.id == null || !isFinite(s.x) || !isFinite(s.z)) return false; simgeler.set(s.id, { id: s.id, x: +s.x, z: +s.z, tur: s.tur || 'nokta', ad: s.ad || '', renk: s.renk || '' }); surum++; if (acikMi) iste(); return true; }
  function simgeSil(id) { const v = simgeler.delete(id); if (v) { surum++; if (acikMi) iste(); } return v; }

  /* ---------- tam harita: aç/kapat, boyut, kaydırma, kıstırma, işaret ---------- */
  function boyut() {
    const st = el.stage, w = st.clientWidth || 800, h = st.clientHeight || 400; kenar = Math.round(Math.max(140, Math.min(560, h - 48, w - 380)));
    el.tamC.style.width = el.tamC.style.height = kenar + 'px'; cizim.tam.s = -1;
  }
  function ortala() { takip = true; if (gm > 6000) gm = ACILIS_M; el.ortala.classList.add('on'); el.ortala.setAttribute('aria-pressed', 'true'); iste(); }
  function birak() { if (!takip) return; gorus(); takip = false; el.ortala.classList.remove('on'); el.ortala.setAttribute('aria-pressed', 'false'); }
  function ac() { if (acikMi) return; acikMi = true; el.tam.hidden = false; el.mini.setAttribute('aria-expanded', 'true'); el.mini.setAttribute('aria-label', 'Haritayı kapat'); el.mini.classList.add('on'); boyut(); gm = ACILIS_M; parm.clear(); dok = null; ortala(); cizim.tam.t = -9; if (SO.ready) { cizim.tam.s = surum; tamCiz(); } }
  function kapat() { if (!acikMi) return; acikMi = false; el.tam.hidden = true; el.mini.setAttribute('aria-expanded', 'false'); el.mini.setAttribute('aria-label', 'Haritayı aç'); el.mini.classList.remove('on'); parm.clear(); dok = null; }
  /* Dokunuşun tuval içindeki yeri (CSS pikseli, sahne uzayında). Sahne dikey ekranda 90° dönük (ana.js: translate(W,0) rotate(90deg)):
     sahnenin x ekseni ekranda aşağı, y ekseni ekranda sola bakar; ana.js'teki toStage ile aynı çevrim, tuvalin kutusuna göre. */
  function yerel(e) {
    const r = el.tamC.getBoundingClientRect(), wr = el.wrap.getBoundingClientRect(), b = el.tamC.clientLeft || 0;
    return wr.height > wr.width ? [e.clientY - r.top - b, r.right - e.clientX - b] : [e.clientX - r.left - b, e.clientY - r.top - b];
  }
  // (lx, ly) tuval noktasının altındaki dünya noktası sabit kalacak şekilde genişliği `yeni` metre yap
  function yakinlas(yeni, lx, ly) { birak(); const g = gorus(), wx = g.sol + lx / g.k, wz = g.ust + ly / g.k; gm = Math.max(EN_YAKIN, Math.min(HALF * 2, yeni)); gx = wx - (lx / kenar - .5) * gm; gz = wz - (ly / kenar - .5) * gm; iste(); }
  function dokunus(lx, ly) { // kısa dokunuş: işaretin üstündeyse kaldır, değilse oraya koy (sisli yere de konur)
    const g = gorus(); if (isaret) { const ix = (isaret.x - g.sol) * g.k, iy = (isaret.z - g.ust) * g.k; if (Math.hypot(lx - ix, ly - (iy - 10)) < 20) { isaretYaz(null); return; } }
    const wx = g.sol + lx / g.k, wz = g.ust + ly / g.k; if (Math.abs(wx) > HALF || Math.abs(wz) > HALF) return; isaretYaz({ x: wx, z: wz });
  }
  function dokunusKur() {
    const cv = el.tamC;
    cv.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); const p = yerel(e); parm.set(e.pointerId, p); dok = parm.size === 1 ? { id: e.pointerId, x: p[0], y: p[1], t: performance.now() } : null; try { cv.setPointerCapture(e.pointerId); } catch (x) { } });
    cv.addEventListener('pointermove', e => { const o = parm.get(e.pointerId); if (!o) return; const p = yerel(e);
      if (parm.size === 1) { if (dok && Math.hypot(p[0] - dok.x, p[1] - dok.y) > 8) dok = null; if (dok) return; // eşik aşılmadan kaydırma başlamaz (dokunuş titremesi işaret koymayı bozmasın)
        birak(); const g = gorus(); gx -= (p[0] - o[0]) / g.k; gz -= (p[1] - o[1]) / g.k; parm.set(e.pointerId, p); iste(); return; }
      let d = null; parm.forEach((v, id) => { if (id !== e.pointerId && !d) d = v; }); if (!d) { parm.set(e.pointerId, p); return; }
      // iki parmak: eski orta noktanın altındaki dünya noktası yeni orta noktanın altına gelir; genişlik parmak aralığıyla ters orantılı
      birak(); const g = gorus(), m0x = (o[0] + d[0]) / 2, m0y = (o[1] + d[1]) / 2, m1x = (p[0] + d[0]) / 2, m1y = (p[1] + d[1]) / 2, a0 = Math.max(12, Math.hypot(o[0] - d[0], o[1] - d[1])), a1 = Math.max(12, Math.hypot(p[0] - d[0], p[1] - d[1]));
      const wx = g.sol + m0x / g.k, wz = g.ust + m0y / g.k; gm = Math.max(EN_YAKIN, Math.min(HALF * 2, gm * a0 / a1)); gx = wx - (m1x / kenar - .5) * gm; gz = wz - (m1y / kenar - .5) * gm; parm.set(e.pointerId, p); iste(); });
    const bitir = e => { const o = parm.get(e.pointerId); if (!o) return; parm.delete(e.pointerId); if (e.type === 'pointerup' && dok && dok.id === e.pointerId && performance.now() - dok.t < 600) dokunus(dok.x, dok.y); dok = null; };
    cv.addEventListener('pointerup', bitir); cv.addEventListener('pointercancel', bitir);
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = yerel(e); yakinlas(gm * Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * .0022), p[0], p[1]); }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  function init() {
    const W = SO.world; HALF = W.HALF; N = Math.ceil(HALF * 2 / H); TN = Math.ceil(N / T); bits = new Uint8Array(Math.ceil(N * N / 8)); acik = 0;
    renkOku(); sisKur();
    const al = id => document.getElementById(id);
    el = { stage: al('stage'), wrap: al('wrap'), mini: al('hMini'), miniC: al('hMiniC'), tam: al('hTam'), pano: al('hPano'), tamC: al('hTamC'), kapat: al('hKapat'), ortala: al('hOrtala'), sil: al('hIsaretSil') };
    for (const k in el) if (!el[k]) { el = null; return; }
    yukle(); sonX = SO.ps.x; sonZ = SO.ps.z; acDaire(sonX, sonZ);
    // ilk daire açılışta (yükleme ekranı arkasında) hemen boyanır; sonrası kare başına bütçeyle
    while (yeniBas < yeni.length) { const idx = yeni[yeniBas++], i = idx % N, j = (idx - i) / N, c = W.renk((i + .5) * H - HALF, (j + .5) * H - HALF); boya(idx, c[0], c[1], c[2]); } yeni.length = 0; yeniBas = 0;
    // düğmeler .btn sınıfında: ana.js bunlara dokunuşu çubuk/kamera saymaz. Panonun kalanı (harita tuvali) için dokunuşu burada kes.
    el.pano.addEventListener('pointerdown', e => e.stopPropagation());
    el.mini.addEventListener('click', () => (acikMi ? kapat() : ac()));
    el.kapat.addEventListener('click', kapat); el.ortala.addEventListener('click', ortala); el.sil.addEventListener('click', () => isaretYaz(null)); el.sil.hidden = !isaret;
    dokunusKur();
    addEventListener('keydown', e => { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.key === 'Escape' && acikMi) kapat(); else if ((e.key === 'm' || e.key === 'M') && !e.repeat) (acikMi ? kapat() : ac());
      else if (acikMi && (e.key === '+' || e.key === '=')) yakinlas(gm / 1.4, kenar / 2, kenar / 2); else if (acikMi && (e.key === '-' || e.key === '_')) yakinlas(gm * 1.4, kenar / 2, kenar / 2); });
    if (window.ResizeObserver) new ResizeObserver(() => { if (acikMi) boyut(); }).observe(el.stage); else addEventListener('resize', () => { if (acikMi) boyut(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') kaydet(); }); addEventListener('pagehide', kaydet);
    miniCiz();
  }
  function update(dt) {
    if (!el) return; const ps = SO.ps, dx = ps.x - sonX, dz = ps.z - sonZ; sure += dt;
    if (dx * dx + dz * dz >= ADIM * ADIM) { sonX = ps.x; sonZ = ps.z; acDaire(sonX, sonZ); }
    islet();
    gerekirse(cizim.mini, .12, 1.5, miniCiz);
    if (acikMi) gerekirse(cizim.tam, .16, Math.max(1.5, gm / kenar), tamCiz);
    kayitT += dt; if (kayitT >= KAYIT_SN) { kayitT = 0; kaydet(); }
  }
  SO.harita = { init, update, ac, kapat, kodla, coz, kur, ortala, simgeEkle, simgeSil,
    isaretKoy: (x, z) => isaretYaz({ x, z }), isaretSil: () => isaretYaz(null),
    // görünüm: g verilirse { x, z, m } (merkez ve genişlik, m) uygulanır; hep o anki görünümü döndürür
    gorunum: g => { if (g) { birak(); if (isFinite(g.m)) gm = g.m; if (isFinite(g.x)) gx = g.x; if (isFinite(g.z)) gz = g.z; iste(); } const v = gorus(); return { x: gx, z: gz, m: v.m, takip }; },
    ciz() { miniCiz(); if (acikMi) tamCiz(); },
    acikMi: (x, z) => { const i = hucre(x), j = hucre(z); if (i < 0 || j < 0 || i >= N || j >= N) return false; const idx = j * N + i; return !!(bits[idx >> 3] & (1 << (idx & 7))); },
    durum: () => ({ hucre: H, kenar: N, acik, alan: acik * H * H, bekleyen: yeni.length - yeniBas + eski.length, karo: karolar.size, bellek: bits.length + karolar.size * T * T * 4 + (ov ? ov.data.length * 2 : 0), kayit: kayitBoy, acikMi, simge: simgeler.size }) };
  // işaretin dünya konumu: { x, z } ya da null (salt okunur; değiştirmek için isaretKoy / isaretSil)
  Object.defineProperty(SO.harita, 'isaret', { enumerable: true, get: () => (isaret ? { x: isaret.x, z: isaret.z } : null) });
})();
