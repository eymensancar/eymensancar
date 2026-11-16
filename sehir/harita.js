/* Harita: küçük harita (sağ üstte yuvarlak düğme) ve tam harita (düğmeye dokununca açılır), keşif sisiyle.
   SO.harita = { init(), update(dt), ac(), kapat(), durum(), kodla(), coz(s), ciz() }. Three.js sahnesine dokunmaz: düz 2B tuval + DOM.

   Keşif: dünya H = 16 m'lik hücrelere bölünür (32 km / 16 m = 2000 × 2000 hücre). Açık/kapalı bilgisi hücre başına 1 bit
   (bit dizisi 500 KB). 16 m: 100 m'lik daire ≈ 123 hücre (yuvarlak görünür), bir koşu adımında (8 m) açılan yeni hücre
   ≈ 13 (renk çağrısı az), kayıt küçük. 10 m hücre 2,5 kat renk çağrısı ve 2,5 kat doku isterdi; 20 m'de daire köşeli kalıyor.
   Oyuncu her ADIM (8 m) yer değiştirdikçe çevresindeki R = 100 m içindeki hücreler açılır; açılan hücre bir daha kapanmaz.

   Renk: SO.world.renk pahalıdır (gürültü). Yalnız yeni açılan hücreler için, hücre başına bir kez çağrılır ve sıraya konur;
   kare başına en çok BUTCE hücre ya da MS milisaniye işlenir. Kayıttan gelen hücreler önce kâğıt rengiyle görünür,
   renkleri oyuncuya yakın olandan başlayarak arkadan hesaplanır (yeni açılanlar hep önce).

   Doku: 125 × 125 hücrelik (2 km) karolar, yalnız açık hücresi olan karo için ayrılır (ImageData, karo başına 62 KB;
   en çok 16 × 16 karo). Çizimde pencereye düşen karolar hücre başına 1 piksel olarak bir ara tuvale kopyalanır, ara tuval
   yumuşatmayla büyütülür: sis kenarı kare kare değil, yumuşak geçişli çıkar. "Tüm dünya" görünümü için 500 × 500'lük
   özet doku (piksel = 4 × 4 hücre = 64 m; içinde açık hücre varsa boyalı) harita ilk açıldığında kurulur.

   Kayıt: localStorage 'acik-dunya-harita-v1' = {"v":1,"h":16,"n":2000,"d":"<base64>"}; d = bit dizisinin satır satır
   uzunluk kodlaması (sırayla kapalı/açık koşu uzunlukları, değişken boylu tam sayı). Yalnız açık/kapalı saklanır, renk saklanmaz
   (dünya üretimi değişse de kayıt geçerli kalır). 10 sn'de bir (değiştiyse) ve sayfa gizlenirken yazılır. ?test kipinde yok. */
(function () {
  'use strict';
  const SO = window.SO;
  const H = 16, R = 100, ADIM = 8, T = 125, OV = 4;          // hücre (m), açma yarıçapı (m), açma aralığı (m), karo (hücre), özet (hücre/piksel)
  const BUTCE = 48, MS = 1.5;                               // kare başına en çok renk hesabı / süre (ms)
  const MINI_M = 360, YAKIN_M = 3200;                       // küçük harita ve "Yakın" görünümün gösterdiği genişlik (m)
  const ANAHTAR = 'acik-dunya-harita-v1', KAYIT_SN = 10, KAYIT_EN_COK = 600000; // kayıt en çok bu kadar karakter
  let HALF = 16000, N = 2000, TN = 16, bits = null, acik = 0;
  const karolar = new Map();                                // karo no → ImageData (T × T)
  let yeni = [], yeniBas = 0, eski = [];                    // renk bekleyen hücreler: yeni açılanlar (önce), kayıttan gelenler (sondan alınır)
  let ov = null, ovC = null, ovX = null, ovKirli = null;    // "Tüm dünya" özeti
  let sonX = 1e9, sonZ = 1e9, kirli = false, kayitT = 0, kayitBoy = 0;
  let surum = 0;                                            // doku her değiştiğinde artar (yeniden çizim gerekir mi)
  let el = null, gorunum = 'dunya', acikMi = false, kenar = 300;
  const cizim = { mini: { t: 9, x: 1e9, z: 1e9, yaw: 9, s: -1 }, tam: { t: 9, x: 1e9, z: 1e9, yaw: 9, s: -1 } };
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
    return JSON.stringify({ v: 1, h: H, n: N, d: btoa(s) });
  }
  // kayıt metnini bit dizisine çözer; geçersizse null
  function coz(metin) {
    const o = JSON.parse(metin); if (!o || o.v !== 1 || o.h !== H || o.n !== N || typeof o.d !== 'string') return null;
    const s = atob(o.d), b = new Uint8Array(Math.ceil(N * N / 8)), toplam = N * N; let p = 0, deger = 0, i = 0, say = 0;
    while (i < s.length) { let v = 0, carp = 1, c; do { c = s.charCodeAt(i++); v += (c & 127) * carp; carp *= 128; } while (c > 127 && i < s.length);
      if (p + v > toplam) return null;
      if (deger) { let q = p; const son = p + v; say += v; while (q < son) { if ((q & 7) === 0 && q + 8 <= son) { b[q >> 3] = 255; q += 8; } else { b[q >> 3] |= 1 << (q & 7); q++; } } }
      p += v; deger ^= 1; }
    return { bits: b, acik: say };
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
    liste.sort((a, b) => uz(b) - uz(a)); eski = liste; surum++;
  }

  /* ---------- çizim ---------- */
  function renkOku() {
    const cs = getComputedStyle(document.documentElement), al = (ad, yedek) => (cs.getPropertyValue(ad) || '').trim() || yedek;
    renkler = { murekkep: al('--ink', '#15120d'), kagitS: al('--paper', '#f1e8d4'), sis: al('--sis', '#a9b1b3'), sisAcik: al('--sis-acik', '#c3c9c9'), dis: al('--harita-dis', '#2b2721'), ok: al('--harita-ok', '#e5482d'), kagit: [241, 232, 212] };
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
  /* Haritanın bir penceresini çizer: sol üst köşe (sol, ust) dünya koordinatı, genişlik `m` metre, tuvalde S (CSS pikseli) kare. */
  function pencere(x, S, sol, ust, m, ad) {
    const k = S / m, w0 = Math.max(0, (-HALF - sol) * k), h0 = Math.max(0, (-HALF - ust) * k), w1 = Math.min(S, (HALF - sol) * k), h1 = Math.min(S, (HALF - ust) * k);
    x.fillStyle = renkler.dis; x.fillRect(0, 0, S, S); if (w1 <= w0 || h1 <= h0) return k;
    // sis: desen dünyaya sabit (oyuncu yürürken harita ile birlikte kayar)
    x.save(); x.beginPath(); x.rect(w0, h0, w1 - w0, h1 - h0); x.clip(); const P = sisDesen.width, kx = -(((sol * k) % P) + P) % P, ky = -(((ust * k) % P) + P) % P;
    x.translate(kx, ky); x.fillStyle = x.createPattern(sisDesen, 'repeat'); x.fillRect(-kx, -ky, S, S); x.restore();
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    if (ad === 'dunya') {
      if (!ov) ovKur(); const q = ovKirli;
      if (q[2] >= q[0]) { ovX.putImageData(ov, 0, 0, q[0], q[1], q[2] - q[0] + 1, q[3] - q[1] + 1); q[0] = q[1] = ov.width; q[2] = q[3] = -1; }
      x.drawImage(ovC, (-HALF - sol) * k, (-HALF - ust) * k, ov.width * OV * H * k, ov.height * OV * H * k); return k;
    }
    // ara tuval: pencereyi (bir hücre payıyla) hücre başına 1 piksel olarak karolardan topla
    const i0 = hucre(sol) - 1, j0 = hucre(ust) - 1, n = Math.ceil(m / H) + 3; let a = ara[ad];
    if (!a || a.n !== n) { const c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = c.height = b.width = b.height = n; a = ara[ad] = { c, x: c.getContext('2d', YAZILIM), b, bx: b.getContext('2d', YAZILIM), n }; }
    a.x.clearRect(0, 0, n, n);
    for (let tj = Math.max(0, Math.floor(j0 / T)); tj <= Math.min(TN - 1, Math.floor((j0 + n - 1) / T)); tj++) for (let ti = Math.max(0, Math.floor(i0 / T)); ti <= Math.min(TN - 1, Math.floor((i0 + n - 1) / T)); ti++) {
      const im = karolar.get(tj * TN + ti); if (!im) continue; const dx = ti * T - i0, dy = tj * T - j0, sx = Math.max(0, -dx), sy = Math.max(0, -dy), sw = Math.min(T, n - dx) - sx, sh = Math.min(T, n - dy) - sy;
      if (sw > 0 && sh > 0) a.x.putImageData(im, dx, dy, sx, sy, sw, sh); }
    // sis kenarını yumuşat: yarım piksel kaydırılmış dört kopyanın ortalaması (≈ 3 × 3 hücrelik bulanıklık), sonra yumuşatmalı büyütme
    a.bx.clearRect(0, 0, n, n); for (let q = 0; q < 4; q++) { a.bx.globalAlpha = 1 / (q + 1); a.bx.drawImage(a.c, q & 1 ? .5 : -.5, q & 2 ? .5 : -.5); } a.bx.globalAlpha = 1;
    x.drawImage(a.b, (i0 * H - HALF - sol) * k, (j0 * H - HALF - ust) * k, n * H * k, n * H * k); return k;
  }
  // oyuncu oku: (x, y) noktasında, baktığı yöne dönük (kuzey yukarı; ileri = (sin yaw, cos yaw), +z güney = aşağı)
  function ok(x, px, py, yaw, s) {
    x.save(); x.translate(px, py); x.rotate(Math.PI - yaw); x.beginPath(); x.moveTo(0, -s); x.lineTo(s * .74, s * .78); x.lineTo(0, s * .36); x.lineTo(-s * .74, s * .78); x.closePath();
    x.lineJoin = 'round'; x.lineWidth = Math.max(3, s * .5); x.strokeStyle = renkler.kagitS; x.stroke(); x.lineWidth = Math.max(1.4, s * .2); x.strokeStyle = renkler.murekkep; x.stroke(); x.fillStyle = renkler.ok; x.fill(); x.restore();
  }
  function miniCiz() {
    const cv = el.miniC, S = 66, x = cv.getContext('2d'), ps = SO.ps, dpr = tuvalBoy(cv, S); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    pencere(x, S, ps.x - MINI_M / 2, ps.z - MINI_M / 2, MINI_M, 'mini'); ok(x, S / 2, S / 2, ps.yaw, 6.5);
  }
  function etiket(x, metin, px, py, hiza) {
    x.font = "700 11px system-ui,-apple-system,'Segoe UI',sans-serif"; x.textAlign = hiza; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 3; x.strokeStyle = renkler.kagitS; x.strokeText(metin, px, py); x.fillStyle = renkler.murekkep; x.fillText(metin, px, py);
  }
  function tamCiz() {
    const cv = el.tamC, S = kenar, x = cv.getContext('2d'), ps = SO.ps, dpr = tuvalBoy(cv, S), dunya = gorunum === 'dunya'; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = dunya ? HALF * 2 : YAKIN_M, sol = dunya ? -HALF : ps.x - m / 2, ust = dunya ? -HALF : ps.z - m / 2, k = pencere(x, S, sol, ust, m, dunya ? 'dunya' : 'yakin');
    // kılavuz çizgileri: tüm dünyada 4 km'de bir, yakında 500 m'de bir (çok soluk)
    const ar = dunya ? 4000 : 500; x.save(); x.globalAlpha = .13; x.strokeStyle = renkler.murekkep; x.lineWidth = 1; x.beginPath();
    for (let g = Math.ceil(sol / ar) * ar; g < sol + m; g += ar) { if (Math.abs(g) >= HALF) continue; const p = Math.round((g - sol) * k) + .5; x.moveTo(p, Math.max(0, (-HALF - ust) * k)); x.lineTo(p, Math.min(S, (HALF - ust) * k)); }
    for (let g = Math.ceil(ust / ar) * ar; g < ust + m; g += ar) { if (Math.abs(g) >= HALF) continue; const p = Math.round((g - ust) * k) + .5; x.moveTo(Math.max(0, (-HALF - sol) * k), p); x.lineTo(Math.min(S, (HALF - sol) * k), p); }
    x.stroke(); x.restore();
    const px = (ps.x - sol) * k, py = (ps.z - ust) * k;
    if (dunya) { // "Yakın" görünümün kapsadığı kare ve oyuncunun yerini uzaktan belli eden halka
      const y = YAKIN_M * k; x.lineWidth = 3; x.strokeStyle = renkler.kagitS; x.strokeRect(px - y / 2, py - y / 2, y, y); x.lineWidth = 1.5; x.strokeStyle = renkler.murekkep; x.strokeRect(px - y / 2, py - y / 2, y, y);
    } else { // dünyanın sınırı (yakın görünümde kenara gelince)
      x.lineWidth = 2; x.strokeStyle = renkler.murekkep; x.strokeRect((-HALF - sol) * k, (-HALF - ust) * k, HALF * 2 * k, HALF * 2 * k);
      x.save(); x.globalAlpha = .5; x.setLineDash([4, 4]); x.lineWidth = 1.5; x.strokeStyle = renkler.murekkep; x.beginPath(); x.arc(px, py, R * k, 0, 7); x.stroke(); x.restore(); // 100 m'lik görüş halkası
    }
    ok(x, px, py, ps.yaw, dunya ? 8 : 9);
    // ölçek çizgisi (sol alt) ve kuzey işareti (sol üst)
    const km = dunya ? 5 : 1, u = km * 1000 * k, bx = 12, by = S - 14; x.lineCap = 'round';
    for (const [w, c] of [[5, renkler.kagitS], [2, renkler.murekkep]]) { x.lineWidth = w; x.strokeStyle = c; x.beginPath(); x.moveTo(bx, by - 5); x.lineTo(bx, by); x.lineTo(bx + u, by); x.lineTo(bx + u, by - 5); x.stroke(); }
    etiket(x, km + ' km', bx + u / 2, by - 10, 'center');
    const nx = 20, ny = 30; for (const [w, c] of [[5, renkler.kagitS], [2, renkler.murekkep]]) { x.lineWidth = w; x.strokeStyle = c; x.beginPath(); x.moveTo(nx, ny + 12); x.lineTo(nx, ny - 6); x.moveTo(nx - 5, ny); x.lineTo(nx, ny - 7); x.lineTo(nx + 5, ny); x.stroke(); }
    etiket(x, 'K', nx, ny - 16, 'center');
    etiket(x, dunya ? 'Tüm dünya · 32 km' : 'Yakın · ' + (YAKIN_M / 1000).toLocaleString('tr-TR') + ' km', S - 10, 14, 'right');
  }
  // çizim seyrek: en çok `hz` kez/sn ve yalnız bir şey değiştiyse (oyuncu yer/yön değiştirdi ya da doku değişti)
  function gerekirse(c, aralik, yer, fn) {
    if (sure - c.t < aralik) return; const ps = SO.ps;
    if (c.s === surum && Math.abs(ps.x - c.x) < yer && Math.abs(ps.z - c.z) < yer && Math.abs(SO.wrapA(ps.yaw - c.yaw)) < .05) return;
    c.t = sure; c.x = ps.x; c.z = ps.z; c.yaw = ps.yaw; c.s = surum; fn();
  }

  /* ---------- tam harita: aç/kapat, görünüm, boyut ---------- */
  function boyut() {
    const st = el.stage, w = st.clientWidth || 800, h = st.clientHeight || 400; kenar = Math.round(Math.max(140, Math.min(560, h - 48, w - 380)));
    el.tamC.style.width = el.tamC.style.height = kenar + 'px'; cizim.tam.s = -1;
  }
  function gorunumYaz(g) {
    gorunum = g; const d = g === 'dunya'; el.gor.textContent = d ? 'YAKIN' : 'DÜNYA'; el.gor.setAttribute('aria-label', d ? 'Yakın görünüme geç' : 'Tüm dünya görünümüne geç');
    el.tamC.setAttribute('aria-label', d ? 'Tüm dünya haritası; gidilmeyen yerler sisli. Dokununca yakın görünüme geçer.' : 'Yakın çevre haritası; gidilmeyen yerler sisli. Dokununca tüm dünyaya geçer.'); cizim.tam.s = -1;
  }
  function ac() { if (acikMi) return; acikMi = true; el.tam.hidden = false; el.mini.setAttribute('aria-expanded', 'true'); el.mini.setAttribute('aria-label', 'Haritayı kapat'); el.mini.classList.add('on'); boyut(); cizim.tam.t = -9; if (SO.ready) { cizim.tam.s = surum; tamCiz(); } }
  function kapat() { if (!acikMi) return; acikMi = false; el.tam.hidden = true; el.mini.setAttribute('aria-expanded', 'false'); el.mini.setAttribute('aria-label', 'Haritayı aç'); el.mini.classList.remove('on'); }

  function init() {
    const W = SO.world; HALF = W.HALF; N = Math.ceil(HALF * 2 / H); TN = Math.ceil(N / T); bits = new Uint8Array(Math.ceil(N * N / 8)); acik = 0;
    renkOku(); sisKur();
    el = { stage: document.getElementById('stage'), mini: document.getElementById('hMini'), miniC: document.getElementById('hMiniC'), tam: document.getElementById('hTam'), pano: document.getElementById('hPano'), tamC: document.getElementById('hTamC'), kapat: document.getElementById('hKapat'), gor: document.getElementById('hGorunum') };
    if (!el.mini || !el.tam) { el = null; return; }
    yukle(); sonX = SO.ps.x; sonZ = SO.ps.z; acDaire(sonX, sonZ);
    // ilk daire açılışta (yükleme ekranı arkasında) hemen boyanır; sonrası kare başına bütçeyle
    const W2 = SO.world; while (yeniBas < yeni.length) { const idx = yeni[yeniBas++], i = idx % N, j = (idx - i) / N, c = W2.renk((i + .5) * H - HALF, (j + .5) * H - HALF); boya(idx, c[0], c[1], c[2]); } yeni.length = 0; yeniBas = 0;
    // düğmeler .btn sınıfında: ana.js bunlara dokunuşu çubuk/kamera saymaz. Panonun kalanı için dokunuşu burada kes.
    el.pano.addEventListener('pointerdown', e => e.stopPropagation());
    el.mini.addEventListener('click', () => (acikMi ? kapat() : ac()));
    el.kapat.addEventListener('click', kapat);
    const degis = () => gorunumYaz(gorunum === 'dunya' ? 'yakin' : 'dunya');
    el.gor.addEventListener('click', degis); el.tamC.addEventListener('click', degis);
    addEventListener('keydown', e => { if (e.key === 'Escape' && acikMi) kapat(); else if ((e.key === 'm' || e.key === 'M') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) (acikMi ? kapat() : ac()); });
    if (window.ResizeObserver) new ResizeObserver(() => { if (acikMi) boyut(); }).observe(el.stage); else addEventListener('resize', () => { if (acikMi) boyut(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') kaydet(); }); addEventListener('pagehide', kaydet);
    gorunumYaz('dunya'); miniCiz();
  }
  function update(dt) {
    if (!el) return; const ps = SO.ps, dx = ps.x - sonX, dz = ps.z - sonZ; sure += dt;
    if (dx * dx + dz * dz >= ADIM * ADIM) { sonX = ps.x; sonZ = ps.z; acDaire(sonX, sonZ); }
    islet();
    gerekirse(cizim.mini, .12, 1.5, miniCiz);
    if (acikMi) gerekirse(cizim.tam, .16, gorunum === 'dunya' ? 16 : 4, tamCiz);
    kayitT += dt; if (kayitT >= KAYIT_SN) { kayitT = 0; kaydet(); }
  }
  SO.harita = { init, update, ac, kapat, kodla, coz, kur,
    gorunum: g => (g ? gorunumYaz(g) : gorunum),
    ciz() { miniCiz(); if (acikMi) tamCiz(); },
    acikMi: (x, z) => { const i = hucre(x), j = hucre(z); if (i < 0 || j < 0 || i >= N || j >= N) return false; const idx = j * N + i; return !!(bits[idx >> 3] & (1 << (idx & 7))); },
    durum: () => ({ hucre: H, kenar: N, acik, alan: acik * H * H, bekleyen: yeni.length - yeniBas + eski.length, karo: karolar.size, bellek: bits.length + karolar.size * T * T * 4 + (ov ? ov.data.length * 2 : 0), kayit: kayitBoy, acikMi, gorunum }) };
})();
