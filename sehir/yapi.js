/* İnşa: çekiç menüsünden seçilen yapı parçalarını dünyaya yerleştirme. Sözleşme: docs/OYUN_API.md ("yapi.js sağlar").

   IZGARA: dünya eksenlerine hizalı 2 m'lik ızgara (hücre (a, b) = x ∈ [2a, 2a+2], z ∈ [2b, 2b+2]). Dönüş hep 90°'lik (çarpışma kutuları eksenlere hizalı).
   Parça = { tur, a, b, r, y } (+ türetilen: x, z, kutular, sinir). `yer` türüne göre a, b, r anlamı:
     'zemin'    : hücre (a, b); r = kalas yönü (0/1); y = zemin üstü. İlk zemin araziye oturur (hücre içindeki en yüksek nokta + 0,10 m; yatay kalır,
                  altı taş temelle kapanır; hücre içi yükseklik farkı > 1 m ise "uygun değil"); komşusu olan zemin komşunun yüksekliğini alır (altı en çok 2 m boş).
     'kenar'    : hücre kenarı: r = 0 → z = 2b çizgisinde x ∈ [2a, 2a+2]; r = 1 → x = 2a çizgisinde z ∈ [2b, 2b+2]. Duvar/kapı/pencere bir zeminin kenarına
                  oturur (y = o zeminin üstü); çit zemin istemez, araziyi izler (iki ucu ayrı yükseklikte olabilir), uç uca kendiliğinden birleşir.
     'cati'     : hücre (a, b); y = duvar üstü (duvar y + 2,4). Hücrenin bir kenarında duvar ya da aynı yükseklikte komşu çatı ister. r = eğik çatıda yükselme yönü.
     'merdiven' : (a, b) = basamakların durduğu (zeminsiz) hücre; r = çıkış yönü (YON[r] yönündeki komşu zemine çıkar); y = o zeminin üstü.
     'esya'     : serbest: a = x·4, b = z·4 (0,25 m adım); r = 0..3; y = durduğu yer (zemin üstü ya da arazi).
   Yön: YON[r] = r·90° dönmüş yerel +z = [(0,1), (1,0), (0,-1), (-1,0)].

   ÇİZİM: ağ (geometri) başına tek InstancedMesh; parça → bir ya da birkaç ağ örneği (zemin = kalaslar + taş temel; çit = raylar + direkler; eğik çatı =
   saz + gerekiyorsa alınlık üçgenleri...). Bütün matrisler yalnız bir parça eklenince/sökülünce ya da oyuncu 60 m yer değiştirince yeniden yazılır;
   `tune.gizle` (420 m) ötesindeki parçalar yazılmaz. Mürekkep dış çizgi: bütün parçalar için tek ağ (ters yüzlü kutular). Doku: açılışta tuvale
   çizilen 2×2 karo (tahta, saz, taş, kumaş). Oyuncu ile kamera arasında kalan yapı yüzeyleri noktalı olarak açılır (evin içinde karakter görünsün).

   ÇARPIŞMA: oyuncunun `tune.kutuUzak` (90 m) çevresindeki parçaların kutuları SO.world.ekKutular'a yazılır (+ kutuYenile). Zemin ve basamaklar `duz: true`
   (üstünde durulur), duvar/çit/eşya geçilmez; kapılı duvarda 1 m'lik aralık açık. Çatının kutusu yok (kutuların altı olmadığı için altından geçilemezdi).

   KAYIT: localStorage `acik-dunya-yapi-v1` = { v: 1, p: "zemin:a,b,r,y;a,b,r,y|duvar:..." } (tür başına öbek; a, b, y bir önceki parçaya göre fark,
   36 tabanında; y santimetre). ?test kipinde okunmaz/yazılmaz. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp;
  const G = 2, DUVAR_H = 2.4, KAYIT = 'acik-dunya-yapi-v1', INK = 0x15120d, YON = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const tn = SO.tune.yapi = {
    uzak: 2.8, esyaUzak: 2.2,   // önizlemenin oyuncuya uzaklığı (m); kamera aşağı bakınca yaklaşır
    yon: 'kamera',              // önizleme yönü: 'kamera' (bakış yönü) | 'karakter' (karakterin yüzü)
    zeminUst: .10,              // ilk zemin araziden bu kadar yukarıda (yürüyerek çıkılabilsin: < 0,28)
    egim: 1.0, kazik: 2.0,      // ilk zeminde hücre içi en çok yükseklik farkı; eklenen zeminin altında en çok boşluk
    yukselt: .6,                // eklenen zeminin arazisi yüksekse bütün düzlük en çok bu kadar yükseltilir
    esyaEgim: .35, citEgim: 1.2,
    gizle: 420, cizgiUzak: 170, kutuUzak: 90,
    kes: 1.0,                   // oyuncu-kamera arasındaki yapıların açıldığı yarıçap (m); 0 = kapalı
    sokUzak: 1.1, vurgu: true,  // sökme hedefi: oyuncunun bu kadar önündeki nokta; hedefin çerçevesi çizilsin mi
    xTusu: true                 // klavyede X = sök (arayüz kendi düğmesini/tuşunu bağlarsa false yapar; Enter/R/Esc arayüzde)
  };
  const yuv = v => Math.round(v * 100) / 100, hyp = Math.hypot;

  /* ---------- doku: 2×2 karo (256 px; kenarda 8 px pay) ---------- */
  const KARO = { tahta: [0, 0], saz: [1, 0], tas: [0, 1], kumas: [1, 1] };
  function atlasCiz() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), r = SO.rnd(99);
    const karo = (i, j, zemin, ciz) => { x.save(); x.beginPath(); x.rect(i * 256, j * 256, 256, 256); x.clip(); x.translate(i * 256, j * 256); x.fillStyle = zemin; x.fillRect(0, 0, 256, 256); ciz(); x.restore(); };
    const cizgi = (n, uz0, uz1, kal0, kal1, renkler) => { for (let q = 0; q < n; q++) { const y = r() * 256, x0 = r() * 300 - 40, L = uz0 + r() * (uz1 - uz0); x.strokeStyle = renkler[(r() * renkler.length) | 0].replace('A', (.08 + r() * .2).toFixed(2)); x.lineWidth = kal0 + r() * (kal1 - kal0); x.beginPath(); x.moveTo(x0, y); x.bezierCurveTo(x0 + L * .3, y + (r() - .5) * 3, x0 + L * .7, y + (r() - .5) * 3, x0 + L, y + (r() - .5) * 2); x.stroke(); } };
    karo(0, 0, '#ebe4d8', () => { cizgi(190, 50, 260, .6, 1.8, ['rgba(70,44,18,A)', 'rgba(90,60,30,A)', 'rgba(255,248,230,A)']);
      for (let q = 0; q < 7; q++) { const cx = r() * 256, cy = r() * 256; x.strokeStyle = 'rgba(60,36,14,.28)'; x.lineWidth = 1.2; for (let k = 1; k < 4; k++) { x.beginPath(); x.ellipse(cx, cy, k * 3.2, k * 1.5, 0, 0, 7); x.stroke(); } } });
    karo(1, 0, '#e8dfc4', () => cizgi(520, 24, 130, 1, 2.6, ['rgba(84,62,12,A)', 'rgba(120,96,30,A)', 'rgba(255,250,214,A)', 'rgba(255,244,190,A)']));
    karo(0, 1, '#dedbd5', () => { for (let q = 0; q < 320; q++) { x.fillStyle = r() < .6 ? 'rgba(40,40,46,' + (.03 + r() * .06).toFixed(3) + ')' : 'rgba(255,255,255,' + (.05 + r() * .1).toFixed(3) + ')'; x.beginPath(); x.ellipse(r() * 256, r() * 256, 2 + r() * 16, 2 + r() * 11, r() * 3, 0, 7); x.fill(); }
      for (let q = 0; q < 16; q++) { let px = r() * 256, py = r() * 256; x.strokeStyle = 'rgba(30,28,30,' + (.16 + r() * .2).toFixed(2) + ')'; x.lineWidth = .8 + r(); x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - .5) * 46; py += (r() - .5) * 46; x.lineTo(px, py); } x.stroke(); } });
    karo(1, 1, '#eeeae0', () => { x.strokeStyle = 'rgba(60,50,40,.07)'; x.lineWidth = 1; for (let q = 0; q < 256; q += 4) { x.beginPath(); x.moveTo(q, 0); x.lineTo(q, 256); x.moveTo(0, q + 2); x.lineTo(256, q + 2); x.stroke(); }
      for (let q = 0; q < 60; q++) { x.fillStyle = 'rgba(60,50,40,.05)'; x.beginPath(); x.ellipse(r() * 256, r() * 256, 6 + r() * 20, 4 + r() * 10, r() * 3, 0, 7); x.fill(); } });
    const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.ClampToEdgeWrapping; t.anisotropy = 4; return t;
  }

  /* ---------- geometri kurucu: parçalar (kutu, kütük) → köşe başına iki renk (aydınlık, gölge) + karo UV'si ----------
     UV: üçgenin baktığı eksene dik düzleme izdüşüm; `lif` ekseni (verilmezse parçanın en uzun ekseni) karonun u yönüne gelir (tahta damarı boyuna akar).
     Parça karoya sığıyorsa rastgele bir yerinden kesit alır (her kalasın damarı başka), sığmıyorsa karoya yayılır. */
  const rs = SO.rnd(4711);
  function Kurucu() {
    const pos = [], nor = [], col = [], col2 = [], uv = [], cl = new T3.Color(), cd = new T3.Color(), va = new T3.Vector3(), vb = new T3.Vector3(), vc = new T3.Vector3(), n = new T3.Vector3();
    const M = new T3.Matrix4(), Q = new T3.Quaternion(), E = new T3.Euler(), BIR = new T3.Vector3(1, 1, 1), Yuk = new T3.Vector3(0, 1, 0);
    function ekle(geo, m, o) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (m) g.applyMatrix4(m); g.computeBoundingBox();
      const A = g.attributes.position.array, N = g.attributes.normal.array, bb = g.boundingBox, mn = [bb.min.x, bb.min.y, bb.min.z], ex = [bb.max.x - mn[0], bb.max.y - mn[1], bb.max.z - mn[2]];
      const S = o.olcek || 2.4, lif = o.lif != null ? o.lif : ex[0] >= ex[1] && ex[0] >= ex[2] ? 0 : ex[1] >= ex[2] ? 1 : 2, sc = [], of = [];
      for (let q = 0; q < 3; q++) { sc[q] = Math.min(1, S / Math.max(ex[q], 1e-4)) / S; of[q] = rs() * (1 - Math.min(1, ex[q] / S)); }
      const kr = KARO[o.karo || 'tahta'], ton = 1 + (o.ton || 0); cl.set(o.lt).multiplyScalar(ton); cd.set(o.dk).multiplyScalar(ton);
      for (let i = 0; i < A.length; i += 9) {
        va.set(A[i], A[i + 1], A[i + 2]); vb.set(A[i + 3], A[i + 4], A[i + 5]); vc.set(A[i + 6], A[i + 7], A[i + 8]); n.copy(vb).sub(va).cross(vc.sub(va)).normalize();
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z), d = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2, p = (d + 1) % 3, q2 = (d + 2) % 3, U = q2 === lif ? q2 : p, V = q2 === lif ? p : q2;
        for (let k = 0; k < 3; k++) { const q = i + k * 3; pos.push(A[q], A[q + 1], A[q + 2]); if (o.yumusak) nor.push(N[q], N[q + 1], N[q + 2]); else nor.push(n.x, n.y, n.z);
          col.push(cl.r, cl.g, cl.b); col2.push(cd.r, cd.g, cd.b);
          const u = of[U] + (A[q + U] - mn[U]) * sc[U], v = of[V] + (A[q + V] - mn[V]) * sc[V]; uv.push((kr[0] * 256 + 8 + u * 240) / 512, 1 - (kr[1] * 256 + 8 + v * 240) / 512); } }
      g.dispose();
    }
    // kutu: iki köşe; o.rot = [rx, ry, rz] (merkez çevresinde)
    function kutu(x0, y0, z0, x1, y1, z1, o) { const r = o.rot; if (r) Q.setFromEuler(E.set(r[0], r[1], r[2])); else Q.set(0, 0, 0, 1);
      ekle(new T3.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), M.compose(va.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), Q, BIR), o); }
    // kütük: iki uç nokta arasında silindir (r0 dipte, r1 uçta)
    function kutuk(p0, p1, r0, r1, o) { vb.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); const L = vb.length(); Q.setFromUnitVectors(Yuk, vb.normalize());
      ekle(new T3.CylinderGeometry(r1, r0, L, o.seg || 6, 1), M.compose(va.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), Q, BIR), Object.assign({ yumusak: true }, o)); }
    function bitir() { const g = new T3.BufferGeometry(), F = (a, k) => new T3.Float32BufferAttribute(a, k);
      g.setAttribute('position', F(pos, 3)); g.setAttribute('normal', F(nor, 3)); g.setAttribute('color', F(col, 3)); g.setAttribute('color2', F(col2, 3)); g.setAttribute('uv', F(uv, 2)); return g; }
    return { ekle, kutu, kutuk, bitir };
  }

  /* ---------- renkler ---------- */
  const TAHTA = { karo: 'tahta', lt: '#c9a06a', dk: '#8a6238' }, TAHTA2 = { karo: 'tahta', lt: '#d6b07a', dk: '#946c40' }, KIRIS = { karo: 'tahta', lt: '#97703f', dk: '#5c3f24' },
    KOYU = { karo: 'tahta', lt: '#6e4f2e', dk: '#3f2c19' }, TAS = { karo: 'tas', lt: '#b9b4aa', dk: '#77736c', olcek: 1.6 }, TAS2 = { karo: 'tas', lt: '#a9a39a', dk: '#696660', olcek: 1.6 },
    SAZ = { karo: 'saz', lt: '#dcc270', dk: '#9c813c', olcek: 1.8 }, SAZ2 = { karo: 'saz', lt: '#cdb05c', dk: '#8b7032', olcek: 1.8 },
    KUMAS = { karo: 'kumas', lt: '#ece3cb', dk: '#b5aa8e' }, ORTU = { karo: 'kumas', lt: '#b9573d', dk: '#7c3624' }, YASTIK = { karo: 'kumas', lt: '#f6f1e4', dk: '#c2bba8' },
    KOMUR = { karo: 'tas', lt: '#3b342d', dk: '#1f1a16' }, DEMIR = { karo: 'tas', lt: '#8d9095', dk: '#4f5257' };
  const o_ = (taban, ek) => Object.assign({}, taban, ek);

  /* ---------- ağlar (geometriler). Her biri { geo, cizgi: [[x0,y0,z0,x1,y1,z1,rotX?]...] } döndürür; yerel eksen: bkz. dosya başı ---------- */
  const EGIM_A = Math.atan(.5); // eğik çatı: 2 m'de 1 m yükselir
  const AG = {
    // zemin: beş kalas (yerel x boyunca), üstü y = 0
    zemin() { const k = Kurucu(); for (let i = 0; i < 5; i++) { const z = -1 + i * .4; k.kutu(-1, -.06 - (i % 2) * .006, z + .006, 1, -(i % 2) * .006, z + .394, o_(i % 2 ? TAHTA2 : TAHTA, { lif: 0, ton: (rs() - .5) * .1 })); }
      return { geo: k.bitir(), cizgi: [[-1, -.07, -1, 1, 0, 1]] }; },
    // taş temel: y ∈ [-1, 0] (örnekte derinlikle ölçeklenir); köşelerde çıkıntılı taşlar
    temel() { const k = Kurucu(); k.kutu(-.96, -1, -.96, .96, 0, .96, TAS); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.kutu(sx * .7, -1, sz * .7, sx * 1, -.02, sz * 1, o_(TAS2, { ton: (rs() - .5) * .12 }));
      return { geo: k.bitir(), cizgi: [[-1, -1, -1, 1, 0, 1]] }; },
    duvar() { const k = Kurucu(); duvarIskelet(k, true);
      for (let i = 0; i < 8; i++) { const x = -.88 + i * .22, d = (i % 2) * .012; k.kutu(x + .004, .12, -.05 - d, x + .216, 2.28, .05 + d, o_(i % 2 ? TAHTA2 : TAHTA, { lif: 1, ton: (rs() - .5) * .12 })); }
      k.kutu(-.88, 1.14, -.075, .88, 1.25, .075, o_(KIRIS, { lif: 0 }));
      return { geo: k.bitir(), cizgi: [[-1, 0, -.09, 1, 2.4, .09]] }; },
    // kapılı duvar: ortada 1,0 × 2,0 m aralık
    kapi() { const k = Kurucu(); duvarIskelet(k, false);
      for (const s of [-1, 1]) { k.kutu(s * .5, 0, -.085, s * .88, .12, .085, o_(KIRIS, { lif: 0 })); for (let i = 0; i < 2; i++) { const x = s * (.59 + i * .145); k.kutu(x - .07, .12, -.05 - i * .012, x + .07, 2.28, .05 + i * .012, o_(i ? TAHTA2 : TAHTA, { lif: 1, ton: (rs() - .5) * .12 })); }
        k.kutu(s * .5, 0, -.1, s * .58, 2.08, .1, o_(KOYU, { lif: 1 })); }
      k.kutu(-.58, 2.0, -.1, .58, 2.09, .1, o_(KOYU, { lif: 0 })); k.kutu(-.52, 2.09, -.05, .52, 2.185, .05, o_(TAHTA, { lif: 0 })); k.kutu(-.52, 2.185, -.06, .52, 2.28, .06, o_(TAHTA2, { lif: 0 }));
      k.kutu(-.5, 0, -.08, .5, .03, .08, o_(KOYU, { lif: 0 }));
      return { geo: k.bitir(), cizgi: [[-1, 0, -.09, -.5, 2.4, .09], [.5, 0, -.09, 1, 2.4, .09], [-.5, 2.0, -.09, .5, 2.4, .09]] }; },
    // pencereli duvar: 0,88 × 0,8 m açıklık, çerçeve ve haç çıta
    pencere() { const k = Kurucu(); duvarIskelet(k, true);
      for (let i = 0; i < 8; i++) { const x = -.88 + i * .22, d = (i % 2) * .012, o = o_(i % 2 ? TAHTA2 : TAHTA, { lif: 1, ton: (rs() - .5) * .12 });
        if (i < 2 || i > 5) k.kutu(x + .004, .12, -.05 - d, x + .216, 2.28, .05 + d, o); else { k.kutu(x + .004, .12, -.05 - d, x + .216, .95, .05 + d, o); k.kutu(x + .004, 1.75, -.05 - d, x + .216, 2.28, .05 + d, o); } }
      k.kutu(-.52, .88, -.11, .52, .96, .11, o_(KOYU, { lif: 0 })); k.kutu(-.5, 1.74, -.095, .5, 1.81, .095, o_(KOYU, { lif: 0 }));
      for (const s of [-1, 1]) k.kutu(s * .44, .96, -.095, s * .5, 1.74, .095, o_(KOYU, { lif: 1 }));
      k.kutu(-.02, .96, -.02, .02, 1.74, .02, o_(KOYU, { lif: 1 })); k.kutu(-.44, 1.33, -.02, .44, 1.37, .02, o_(KOYU, { lif: 0 }));
      return { geo: k.bitir(), cizgi: [[-1, 0, -.09, -.44, 2.4, .09], [.44, 0, -.09, 1, 2.4, .09], [-.44, 0, -.09, .44, .95, .09], [-.44, 1.75, -.09, .44, 2.4, .09]] }; },
    // düz çatı: üç kiriş + yan yana saz demetleri (yerel z boyunca)
    cati() { const k = Kurucu(), m = new T3.Matrix4(); for (const z of [-.8, 0, .8]) k.kutu(-1, 0, z - .05, 1, .1, z + .05, o_(KIRIS, { lif: 0 }));
      for (let i = 0; i < 5; i++) { const x = -.8 + i * .4, g = new T3.CylinderGeometry(.215, .215, 2, 6, 1); g.rotateX(Math.PI / 2); m.makeScale(1, .5 + (i % 2) * .08, 1).setPosition(x, .16, 0); k.ekle(g, m, o_(i % 2 ? SAZ2 : SAZ, { lif: 2, yumusak: true, ton: (rs() - .5) * .1 })); }
      return { geo: k.bitir(), cizgi: [[-1, 0, -1, 1, .26, 1]] }; },
    // düz çatının açık kenarına saçak kütüğü (yerel +z kenarı)
    sacak() { const k = Kurucu(); k.kutuk([-1.12, .09, 1.06], [1.12, .09, 1.06], .075, .07, o_(KIRIS, { lif: 0 })); return { geo: k.bitir(), cizgi: [] }; },
    // eğik çatı: alçak kenar yerel z = -1 (y = 0), yüksek kenar z = +1 (y = 1); dört sıra bindirmeli saz, altında iki mertek
    cati_egik() { const k = Kurucu(), c = Math.cos(EGIM_A), s = Math.sin(EGIM_A);
      const nokta = (u, h) => [-1 + u * c - h * s, u * s + h * c]; // eğim boyunca u, yüzeyden dışarı h → [z, y]
      for (let i = 0; i < 4; i++) { const u0 = -.3 + i * .635, u1 = u0 + .78, [z, y] = nokta((u0 + u1) / 2, .1 + (3 - i) * .004); const L = (u1 - u0) / 2;
        k.kutu(-1, y - .05, z - L, 1, y + .05, z + L, o_(i % 2 ? SAZ2 : SAZ, { rot: [-EGIM_A + .05, 0, 0], lif: 2, ton: (rs() - .5) * .08 })); }
      for (const x of [-.62, .62]) { const [z, y] = nokta(1.0, -.02); k.kutu(x - .045, y - .05, z - 1.2, x + .045, y + .05, z + 1.2, o_(KIRIS, { rot: [-EGIM_A, 0, 0], lif: 2 })); }
      const [zm, ym] = nokta(.97, .09); return { geo: k.bitir(), cizgi: [[-1, ym - .09, zm - 1.28, 1, ym + .09, zm + 1.28, -EGIM_A]] }; },
    // alınlık üçgeni + rüzgâr tahtası (eğik çatının açık yanına; yerel x = 0 düzleminde, ±1 kaydırılarak konur)
    ucgen() { const k = Kurucu(), sh = new T3.Shape(); sh.moveTo(-1, 0); sh.lineTo(1, 0); sh.lineTo(1, 1); sh.lineTo(-1, 0);
      const g = new T3.ExtrudeGeometry(sh, { depth: .1, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(.05, 0, 0); // şekil (z, y) düzlemine: x' = -z_s → kalınlık; z' = x_s
      k.ekle(g, null, o_(TAHTA, { lif: 2 })); const c = Math.cos(EGIM_A), s = Math.sin(EGIM_A), u = .97, z = -1 + u * c - .1 * s, y = u * s + .1 * c;
      k.kutu(-.1, y - .09, z - 1.3, .1, y + .09, z + 1.3, o_(KIRIS, { rot: [-EGIM_A, 0, 0], lif: 2 }));
      return { geo: k.bitir(), cizgi: [] }; },
    // eğik çatının yüksek kenarı açıksa arka pano (yerel z = +1)
    arka() { const k = Kurucu(); for (let i = 0; i < 4; i++) k.kutu(-1, i * .25, .93, 1, i * .25 + .246, 1.03 + (i % 2) * .012, o_(i % 2 ? TAHTA2 : TAHTA, { lif: 0, ton: (rs() - .5) * .1 })); k.kutu(-1, 1.0, .9, 1, 1.09, 1.06, o_(KIRIS, { lif: 0 }));
      return { geo: k.bitir(), cizgi: [[-1, 0, .93, 1, 1.09, 1.05]] }; },
    cit_direk() { const k = Kurucu(); k.kutuk([0, -.3, 0], [0, 1.02, 0], .07, .058, o_(KIRIS, { lif: 1, seg: 7 })); k.kutuk([0, 1.02, 0], [0, 1.1, 0], .058, .02, o_(KOYU, { lif: 1, seg: 7 }));
      return { geo: k.bitir(), cizgi: [[-.06, -.1, -.06, .06, 1.06, .06]] }; },
    // çit rayı: yerel x boyunca iki kütük + üç ince kazık (eğimde yerel z çevresinde döner)
    cit_ray() { const k = Kurucu(); k.kutuk([-1, .82, .01], [1, .86, -.01], .042, .036, o_(TAHTA, { lif: 0 })); k.kutuk([1, .44, .01], [-1, .47, -.01], .045, .038, o_(TAHTA2, { lif: 0 }));
      for (const [x, e] of [[-.5, .05], [0, -.04], [.5, .03]]) k.kutuk([x - e, .04, .05], [x + e, .98, .05], .03, .022, o_(KIRIS, { lif: 1, seg: 5 }));
      return { geo: k.bitir(), cizgi: [[-1, .4, -.04, 1, .5, .04], [-1, .8, -.04, 1, .9, .04]] }; },
    // merdiven: beş basamak; birim yükseklik (y = 0 zemin üstü, y = -1 dip; örnekte yükseklikle ölçeklenir); yerel +z zemine bakar
    merdiven() { const k = Kurucu(); for (let i = 0; i < 5; i++) { const z1 = 1 - i * .4, z0 = z1 - .4, ust = -(i + 1) / 6; k.kutu(-.56, -1.2, z0 + .01, .56, ust - .05, z1, o_(i % 2 ? TAS2 : TAS, { ton: (rs() - .5) * .1 })); k.kutu(-.6, ust - .05, z0 - .02, .6, ust, z1, o_(i % 2 ? TAHTA2 : TAHTA, { lif: 0 })); }
      return { geo: k.bitir(), cizgi: [[-.6, -1.2, -1, .6, -1 / 6, 1]] }; },
    // yatak: 1 × 2 m; baş ucu yerel +z
    yatak() { const k = Kurucu(); for (const [x, z] of [[-.45, -.94], [.45, -.94], [-.45, .94], [.45, .94]]) k.kutuk([x, 0, z], [x, z > 0 ? .98 : .56, z], .055, .05, o_(KIRIS, { lif: 1 }));
      for (const s of [-1, 1]) k.kutu(s * .5, .16, -.94, s * .42, .3, .94, o_(KIRIS, { lif: 2 }));
      for (let i = 0; i < 3; i++) k.kutu(-.42 + i * .28, .34, .9, -.14 + i * .28 - .006, .92, .97, o_(i % 2 ? TAHTA2 : TAHTA, { lif: 1 }));
      k.kutu(-.42, .22, -.97, .42, .5, -.91, o_(TAHTA, { lif: 0 }));
      k.kutu(-.43, .2, -.9, .43, .4, .9, KUMAS); k.kutu(-.46, .33, -.9, .46, .445, .3, ORTU); k.kutu(-.47, .385, .22, .47, .46, .36, o_(KUMAS, { ton: .04 })); k.kutu(-.3, .4, .5, .3, .52, .84, YASTIK);
      return { geo: k.bitir(), cizgi: [[-.5, 0, -.97, .5, .45, .97], [-.46, .3, .9, .46, .95, .98]] }; },
    masa() { const k = Kurucu(); for (let i = 0; i < 3; i++) k.kutu(-.62, .72 - (i % 2) * .005, -.4 + i * .268, .62, .78 - (i % 2) * .005, -.4 + i * .268 + .262, o_(i % 2 ? TAHTA2 : TAHTA, { lif: 0, ton: (rs() - .5) * .1 }));
      for (const [x, z] of [[-.52, -.31], [.52, -.31], [-.52, .31], [.52, .31]]) k.kutu(x - .04, 0, z - .04, x + .04, .72, z + .04, o_(KIRIS, { lif: 1 }));
      for (const s of [-1, 1]) k.kutu(s * .52 - .025, .26, -.31, s * .52 + .025, .33, .31, o_(KIRIS, { lif: 2 })); k.kutu(-.52, .27, -.025, .52, .32, .025, o_(KIRIS, { lif: 0 }));
      return { geo: k.bitir(), cizgi: [[-.62, .7, -.4, .62, .78, .4]] }; },
    // üretim masası: kalın tezgâh, alt raf, arka pano (yerel +z), panoda çekiç ve testere, üstte taş örs ve kütük
    uretim_masasi() { const k = Kurucu(); k.kutu(-.82, .8, -.42, .82, .9, .42, o_(TAHTA, { lif: 0 })); k.kutu(-.82, .78, -.44, .82, .86, -.42, o_(KIRIS, { lif: 0 }));
      for (const [x, z] of [[-.72, -.33], [.72, -.33], [-.72, .33], [.72, .33]]) k.kutu(x - .055, 0, z - .055, x + .055, z > 0 ? 1.52 : .8, z + .055, o_(KIRIS, { lif: 1 }));
      k.kutu(-.72, .2, -.33, .72, .25, .33, o_(TAHTA2, { lif: 0 }));
      for (let i = 0; i < 2; i++) k.kutu(-.68, .98 + i * .26, .31, .68, 1.23 + i * .26, .36, o_(i ? TAHTA2 : TAHTA, { lif: 0 }));
      k.kutu(-.4, 1.06, .25, -.36, 1.4, .3, o_(KOYU, { lif: 1 })); k.kutu(-.47, 1.36, .23, -.29, 1.45, .31, DEMIR);                 // çekiç
      k.kutu(.1, 1.12, .27, .5, 1.24, .3, DEMIR); k.kutu(.48, 1.1, .25, .6, 1.27, .31, o_(KOYU, { lif: 1 }));                          // testere
      k.kutu(-.62, .9, -.2, -.3, 1.02, .1, TAS2); k.kutu(-.56, 1.02, -.16, -.36, 1.07, .06, DEMIR);                                    // örs
      k.kutuk([.42, .9, -.08], [.42, 1.08, -.08], .13, .125, o_(KIRIS, { lif: 1, seg: 8 })); k.kutu(.02, .9, -.3, .22, .94, .12, o_(TAHTA2, { lif: 2, rot: [0, .3, 0] })); // kütük, tahta
      k.kutu(-.3, .25, -.2, .1, .5, .2, o_(KOYU, { lif: 0 })); k.kutuk([.3, .25, -.1], [.62, .25, -.1], .07, .07, o_(TAHTA, { lif: 0 })); k.kutuk([.3, .25, .08], [.62, .25, .08], .07, .07, o_(TAHTA2, { lif: 0 })); // rafta kasa ve odunlar
      return { geo: k.bitir(), cizgi: [[-.82, .78, -.44, .82, .9, .42], [-.72, .9, .28, .72, 1.52, .38]] }; },
    kamp_atesi() { const k = Kurucu(), m = new T3.Matrix4(), q = new T3.Quaternion(), e = new T3.Euler(), v = new T3.Vector3(), sv = new T3.Vector3();
      for (let i = 0; i < 8; i++) { const a = i / 8 * SO.TAU + rs() * .2, rr = .11 + rs() * .05; q.setFromEuler(e.set(rs() * 3, rs() * 3, rs() * 3)); m.compose(v.set(Math.cos(a) * .43, rr * .45, Math.sin(a) * .43), q, sv.set(rr, rr * .72, rr * 1.15)); k.ekle(new T3.IcosahedronGeometry(1, 0), m, o_(i % 2 ? TAS2 : TAS, { ton: (rs() - .5) * .2 })); }
      k.ekle(new T3.CylinderGeometry(.36, .38, .04, 9), m.makeTranslation(0, .02, 0), KOMUR);
      for (let i = 0; i < 5; i++) { const a = i / 5 * SO.TAU + .3; k.kutuk([Math.cos(a) * .33, .04, Math.sin(a) * .33], [-Math.cos(a) * .07, .5, -Math.sin(a) * .07], .055, .045, o_(i % 2 ? KOYU : KIRIS, {})); }
      return { geo: k.bitir(), cizgi: [] }; },
    // taş fırın: kaide, gövde, kubbe, ağız (yerel -z), baca
    firin() { const k = Kurucu(), m = new T3.Matrix4(); k.kutu(-.62, 0, -.62, .62, .32, .62, TAS2); k.kutu(-.56, .32, -.56, .56, .98, .56, TAS);
      m.makeScale(.57, .5, .57).setPosition(0, .98, 0); k.ekle(new T3.SphereGeometry(1, 8, 3, 0, SO.TAU, 0, Math.PI / 2), m, o_(TAS, { yumusak: true }));
      k.kutu(-.24, .4, -.6, .24, .8, -.5, KOMUR); for (const s of [-1, 1]) k.kutu(s * .24, .34, -.63, s * .34, .84, -.54, o_(TAS2, { ton: .08 })); k.kutu(-.36, .8, -.64, .36, .92, -.54, o_(TAS2, { ton: .1 }));
      k.kutu(-.3, .32, -.78, .3, .36, -.6, o_(TAS2, { ton: -.06 }));
      k.kutu(.14, .98, .14, .48, 1.86, .48, TAS2); k.kutu(.1, 1.86, .1, .52, 1.95, .52, o_(TAS, { ton: -.08 }));
      return { geo: k.bitir(), cizgi: [[-.62, 0, -.62, .62, .98, .62], [.12, .98, .12, .5, 1.95, .5]] }; },
    sandik() { const k = Kurucu(); for (let i = 0; i < 3; i++) k.kutu(-.5, .03 + i * .13, -.3, .5, .03 + i * .13 + .126, .3, o_(i % 2 ? TAHTA2 : TAHTA, { lif: 0, ton: (rs() - .5) * .1 }));
      k.kutu(-.52, .42, -.32, .52, .52, .32, o_(TAHTA, { lif: 0 })); k.kutu(-.46, .52, -.24, .46, .58, .24, o_(TAHTA2, { lif: 0 }));
      for (const x of [-.34, .34]) k.kutu(x - .04, 0, -.31, x + .04, .535, .31, DEMIR); for (const [x, z] of [[-.47, -.27], [.47, -.27], [-.47, .27], [.47, .27]]) k.kutu(x - .04, 0, z - .04, x + .04, .06, z + .04, KOYU);
      k.kutu(-.05, .34, -.335, .05, .46, -.3, DEMIR);
      return { geo: k.bitir(), cizgi: [[-.52, 0, -.32, .52, .56, .32]] }; }
  };
  // duvarların ortak iskeleti: iki uç dikme (komşu duvarın dikmesiyle yan yana gelir), üst kiriş, isteğe bağlı taban kirişi
  function duvarIskelet(k, taban) { for (const s of [-1, 1]) k.kutu(s * .88, 0, -.09, s * 1, 2.4, .09, o_(KIRIS, { lif: 1 })); k.kutu(-.88, 2.28, -.085, .88, 2.4, .085, o_(KIRIS, { lif: 0 })); if (taban) k.kutu(-.88, 0, -.085, .88, .12, .085, o_(KIRIS, { lif: 0 })); }

  /* ---------- tür tablosu (SO.yapilar) ---------- */
  const S_ = d => '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  const TURLER = [
    { id: 'zemin', ad: 'Zemin', sinif: 'yapi', yer: 'zemin', girdi: { odun: 4 }, teknoloji: 'ahsap_yapi', simge: S_('M3 13l9-4 9 4-9 4zM3 13v3l9 4 9-4v-3M12 17v3') },
    { id: 'duvar', ad: 'Duvar', sinif: 'yapi', yer: 'kenar', duvar: true, girdi: { odun: 4 }, teknoloji: 'ahsap_yapi', simge: S_('M4 4h16v16H4zM9.3 4v16M14.7 4v16') },
    { id: 'kapi', ad: 'Kapılı duvar', sinif: 'yapi', yer: 'kenar', duvar: true, girdi: { odun: 4 }, teknoloji: 'ahsap_yapi', simge: S_('M4 4h16v16H4zM9 20V9h6v11M12.8 14.5h.01') },
    { id: 'pencere', ad: 'Pencereli duvar', sinif: 'yapi', yer: 'kenar', duvar: true, girdi: { odun: 4 }, teknoloji: 'ahsap_yapi', simge: S_('M4 4h16v16H4zM8 8h8v7H8zM12 8v7M8 11.5h8') },
    { id: 'cati', ad: 'Düz çatı', sinif: 'yapi', yer: 'cati', girdi: { odun: 2, lif: 4 }, teknoloji: 'ahsap_yapi', simge: S_('M2 8h20v4H2zM6 12v8M18 12v8') },
    { id: 'cati_egik', ad: 'Eğik çatı', sinif: 'yapi', yer: 'cati', egik: true, girdi: { odun: 2, lif: 6 }, teknoloji: 'ahsap_yapi', simge: S_('M2 12l10-8 10 8M6 9.5V20h12V9.5') },
    { id: 'merdiven', ad: 'Merdiven', sinif: 'yapi', yer: 'merdiven', girdi: { odun: 3, tas: 3 }, teknoloji: 'ahsap_yapi', simge: S_('M3 20h5v-4h4v-4h4V8h5') },
    { id: 'cit', ad: 'Çit', sinif: 'yapi', yer: 'kenar', girdi: { dal: 4 }, teknoloji: 'cit', simge: S_('M6 4v16M18 4v16M3 9h18M3 15h18') },
    { id: 'kamp_atesi', ad: 'Kamp ateşi', sinif: 'esya', yer: 'esya', en: .95, boy: .95, yuk: .5, girdi: { dal: 5, tas: 5 }, teknoloji: 'kamp_atesi', simge: S_('M12 3c1 3 4 4.6 4 8a4 4 0 0 1-8 0c0-1.5.7-2.6 1.5-3.5.3 1.2 1 1.8 1.5 2 0-2.5.2-4.5 1-6.5zM4 21l16-4M20 21L4 17') },
    { id: 'uretim_masasi', ad: 'Üretim masası', sinif: 'esya', yer: 'esya', en: 1.64, boy: .86, yuk: 1.5, girdi: { odun: 8, tas: 4 }, teknoloji: 'uretim_masasi', simge: S_('M3 12h18M5 12v8M19 12v8M5 16.5h14M8 12V8h6M11 8V4.5M9 4.5h4') },
    { id: 'yatak', ad: 'Yatak', sinif: 'esya', yer: 'esya', en: 1.0, boy: 1.96, yuk: .95, girdi: { odun: 6, lif: 8 }, teknoloji: 'yatak', simge: S_('M3 19V6M3 14h18v5M21 15v-2a3 3 0 0 0-3-3h-7v4M7 9.2a1.6 1.6 0 1 0 .01 0') },
    { id: 'masa', ad: 'Masa', sinif: 'esya', yer: 'esya', en: 1.24, boy: .8, yuk: .78, girdi: { odun: 5 }, teknoloji: 'yatak', simge: S_('M3 8h18M5 8v12M19 8v12M5 13h14') },
    { id: 'firin', ad: 'Fırın', sinif: 'esya', yer: 'esya', en: 1.24, boy: 1.24, yuk: 1.95, girdi: { tas: 14, odun: 2 }, teknoloji: 'firin', simge: S_('M5 20v-9a7 7 0 0 1 14 0v9M3 20h18M9 20v-5a3 3 0 0 1 6 0v5') },
    { id: 'sandik', ad: 'Sandık', sinif: 'esya', yer: 'esya', en: 1.04, boy: .64, yuk: .58, girdi: { odun: 8 }, teknoloji: 'sandik', simge: S_('M4 10h16v9H4zM4 10V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2M12 10v3') }
  ];
  const TUR = {}; TURLER.forEach((t, i) => { TUR[t.id] = t; t.sira = i; });
  SO.yapilar = TURLER;

  /* ---------- durum ---------- */
  const parcalar = [], zeminler = new Map(), kenarlar = new Map(), catilar = new Map(), merdivenler = new Map(), kova = new Map(), turListe = {}, dinleyen = [];
  const KOVA = 4, anh = (a, b) => a + ',' + b, kovaAnh = (x, z) => Math.floor(x / KOVA) + ',' + Math.floor(z / KOVA);
  let kurulu = false, kip = null, kipTur = null, aday = null, sonAnahtar = '', donus = 0, donusHucre = '', denetKirli = true, cizKirli = true, kutuKirli = true, hedef = null, hedefBilgi = null, sokSure = 0, kayitT = 0;
  const cizM = { x: 1e9, z: 1e9 }, kutuM = { x: 1e9, z: 1e9 };
  const bildir = ne => { for (const f of dinleyen) { try { f(ne); } catch (e) { } } };
  const zeminAl = (a, b) => zeminler.get(anh(a, b)), kenarAl = (a, b, r) => kenarlar.get(a + ',' + b + ',' + r), catiAl = (a, b) => catilar.get(anh(a, b));
  const gY = (x, z) => SO.world.groundY(x, z), SU = () => SO.world.SU || 0;
  // yerel dikdörtgen (x0..x1, z0..z1) → r·90° döndürülüp (cx, cz)'ye taşınmış dünya dikdörtgeni
  function dik(cx, cz, x0, x1, z0, z1, r) { let a, b, c, d; if (r === 0) { a = x0; b = x1; c = z0; d = z1; } else if (r === 1) { a = z0; b = z1; c = -x1; d = -x0; } else if (r === 2) { a = -x1; b = -x0; c = -z1; d = -z0; } else { a = -z1; b = -z0; c = x0; d = x1; } return { x0: cx + a, x1: cx + b, z0: cz + c, z1: cz + d }; }
  const kenarOrta = (a, b, r) => r ? [a * G, b * G + 1] : [a * G + 1, b * G];
  const kenarHucre = (a, b, r) => r ? [[a - 1, b], [a, b]] : [[a, b - 1], [a, b]]; // kenarın iki yanındaki hücreler
  const hucreKenar = (a, b) => [[a, b, 0], [a, b + 1, 0], [a, b, 1], [a + 1, b, 1]];
  // hücre içindeki arazi: 3×3 örnek → [en alçak, en yüksek]
  function araziAralik(x0, z0, x1, z1) { let mn = 1e9, mx = -1e9; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const h = gY(x0 + (x1 - x0) * i / 2, z0 + (z1 - z0) * j / 2); if (h < mn) mn = h; if (h > mx) mx = h; } return [mn, mx]; }
  function kenarZeminY(a, b, r) { let y = null; for (const [ca, cb] of kenarHucre(a, b, r)) { const z = zeminAl(ca, cb); if (z && (y == null || z.y > y)) y = z.y; } return y; }

  /* ---------- parça: türetilen alanlar (konum, kutular, sınır kutusu) ---------- */
  function hazirla(P) {
    const t = P.tur, K = P.kutular = [], kt = (d, top, duz) => { d.top = top; d.duz = !!duz; d.yapi = true; K.push(d); };
    if (t.yer === 'zemin') { P.x = P.a * G + 1; P.z = P.b * G + 1; const [mn] = araziAralik(P.a * G, P.b * G, P.a * G + G, P.b * G + G); P.d = Math.max(.2, P.y - .06 - mn + .25);
      kt({ x0: P.a * G - .01, x1: P.a * G + G + .01, z0: P.b * G - .01, z1: P.b * G + G + .01 }, P.y, true); P.sinir = [P.x - 1, P.y - .1, P.z - 1, P.x + 1, P.y + .02, P.z + 1]; }
    else if (t.yer === 'kenar') { const [x, z] = kenarOrta(P.a, P.b, P.r); P.x = x; P.z = z;
      if (t.duvar) { if (t.id === 'kapi') { kt(dik(x, z, -1, -.5, -.1, .1, P.r), P.y + DUVAR_H); kt(dik(x, z, .5, 1, -.1, .1, P.r), P.y + DUVAR_H); } else kt(dik(x, z, -1, 1, -.1, .1, P.r), P.y + DUVAR_H);
        const s = dik(x, z, -1, 1, -.1, .1, P.r); P.sinir = [s.x0, P.y, s.z0, s.x1, P.y + DUVAR_H, s.z1]; }
      else { // çit: uçların yüksekliği (yerel -x ucu = u0, +x ucu = u1)
        const u0 = P.r ? [x, z + 1] : [x - 1, z], u1 = P.r ? [x, z - 1] : [x + 1, z], zy = kenarZeminY(P.a, P.b, P.r);
        P.u0 = u0; P.u1 = u1; P.y0 = zy != null ? zy : gY(u0[0], u0[1]); P.y1 = zy != null ? zy : gY(u1[0], u1[1]); P.y = yuv((P.y0 + P.y1) / 2);
        kt(dik(x, z, -1, 1, -.07, .07, P.r), Math.max(P.y0, P.y1) + 1.05); const s = dik(x, z, -1, 1, -.08, .08, P.r); P.sinir = [s.x0, Math.min(P.y0, P.y1), s.z0, s.x1, Math.max(P.y0, P.y1) + 1.05, s.z1]; } }
    else if (t.yer === 'cati') { P.x = P.a * G + 1; P.z = P.b * G + 1; P.sinir = [P.x - 1, P.y, P.z - 1, P.x + 1, P.y + (t.egik ? 1.15 : .28), P.z + 1]; }
    else if (t.yer === 'merdiven') { P.x = P.a * G + 1; P.z = P.b * G + 1; const d = YON[P.r]; P.h = clamp(P.y - gY(P.x - d[0], P.z - d[1]), .2, 1.6);
      for (let i = 0; i < 5; i++) kt(dik(P.x, P.z, -.6, .6, 1 - (i + 1) * .4, 1 - i * .4 + .01, P.r), P.y - (i + 1) * P.h / 6, true);
      const s = dik(P.x, P.z, -.6, .6, -1, 1, P.r); P.sinir = [s.x0, P.y - P.h, s.z0, s.x1, P.y, s.z1]; }
    else { P.x = P.a / 4; P.z = P.b / 4; const s = dik(P.x, P.z, -t.en / 2, t.en / 2, -t.boy / 2, t.boy / 2, P.r); kt(Object.assign({}, s), P.y + t.yuk); P.sinir = [s.x0, P.y, s.z0, s.x1, P.y + t.yuk, s.z1]; }
    for (const k of K) k.p = P;
    return P;
  }
  const parcaYap = (tur, a, b, r, y) => hazirla({ tur, a, b, r, y: yuv(y) });
  function harita(P) { const y = P.tur.yer; return y === 'zemin' ? [zeminler, anh(P.a, P.b)] : y === 'kenar' ? [kenarlar, P.a + ',' + P.b + ',' + P.r] : y === 'cati' ? [catilar, anh(P.a, P.b)] : y === 'merdiven' ? [merdivenler, anh(P.a, P.b)] : null; }
  function ekle(P) { parcalar.push(P); const h = harita(P); if (h) h[0].set(h[1], P); P.kv = kovaAnh(P.x, P.z); let s = kova.get(P.kv); if (!s) kova.set(P.kv, s = new Set()); s.add(P); (turListe[P.tur.id] || (turListe[P.tur.id] = new Set())).add(P); }
  function cikar(P) { const i = parcalar.indexOf(P); if (i >= 0) parcalar.splice(i, 1); const h = harita(P); if (h && h[0].get(h[1]) === P) h[0].delete(h[1]); const s = kova.get(P.kv); if (s) { s.delete(P); if (!s.size) kova.delete(P.kv); } if (turListe[P.tur.id]) turListe[P.tur.id].delete(P); }
  function yakinlar(x, z, rad, fn) { const i0 = Math.floor((x - rad) / KOVA), i1 = Math.floor((x + rad) / KOVA), j0 = Math.floor((z - rad) / KOVA), j1 = Math.floor((z + rad) / KOVA);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const s = kova.get(i + ',' + j); if (s) for (const P of s) if (fn(P) === true) return true; } return false; }
  // bir parça değişince: komşu çitlerin yüksekliği (zemine göre) yeniden hesaplanır, çizim/kutular/kayıt işaretlenir
  function degisti(P) { if (P.tur.yer === 'zemin') for (const [a, b, r] of hucreKenar(P.a, P.b)) { const k = kenarAl(a, b, r); if (k && !k.tur.duvar) hazirla(k); }
    cizKirli = kutuKirli = denetKirli = true; kutuYaz(); kayitZamanla(); }

  // düzlük: z0 ile aynı yükseklikte bitişik zeminler. Yükseltme: zeminler, kenarlarındaki duvarlar, üstlerindeki çatı öbekleri, eşyalar, merdivenler
  function duzlukKaldir(z0, yYeni) { const eski = z0.y, dy = yYeni - eski, gor = new Set([z0]), sira = [z0], es = (v, w) => Math.abs(v - w) < .005, deg = new Set();
    while (sira.length) { const Z = sira.pop(); for (const d of YON) { const k = zeminAl(Z.a + d[0], Z.b + d[1]); if (k && !gor.has(k) && es(k.y, eski)) { gor.add(k); sira.push(k); } } }
    const catiS = [];
    for (const Z of gor) { for (const [a, b, r] of hucreKenar(Z.a, Z.b)) { const w = kenarAl(a, b, r); if (w && w.tur.duvar && !deg.has(w) && es(w.y, eski)) { deg.add(w); for (const [ca, cb] of kenarHucre(a, b, r)) { const c = catiAl(ca, cb); if (c && !deg.has(c) && es(c.y, eski + DUVAR_H)) { deg.add(c); catiS.push(c); } } } }
      for (let r = 0; r < 4; r++) { const m = merdivenler.get(anh(Z.a - YON[r][0], Z.b - YON[r][1])); if (m && m.r === r) deg.add(m); }
      yakinlar(Z.x, Z.z, 2.5, Q => { if (Q.tur.yer === 'esya' && es(Q.y, eski) && Math.floor(Q.x / G) === Z.a && Math.floor(Q.z / G) === Z.b) deg.add(Q); }); }
    while (catiS.length) { const C = catiS.pop(); for (const d of YON) { const k = catiAl(C.a + d[0], C.b + d[1]); if (k && !deg.has(k) && es(k.y, eski + DUVAR_H)) { deg.add(k); catiS.push(k); } } }
    for (const Z of gor) deg.add(Z); for (const P of deg) { P.y = yuv(P.y + dy); hazirla(P); }
    const ps = SO.ps, altta = zeminAl(Math.floor(ps.x / G), Math.floor(ps.z / G)); if (altta && gor.has(altta) && Math.abs(ps.y - eski) < .3) ps.y += dy; }

  /* ---------- yerleştirme denetimleri ---------- */
  const kesisir = (k, s, pay) => s.x0 < k.x1 - pay && s.x1 > k.x0 + pay && s.z0 < k.z1 - pay && s.z1 > k.z0 + pay;
  function dunyaCakisir(k) { for (const s of SO.world.solids) if (!s.yapi && kesisir(k, s, .04)) return true; return false; }
  // k dikdörtgeni, `yerler` içindeki türlerden bir parçanın kutusuyla çakışıyor mu (kenar parçalarına `kenarPay` kadar girilebilir)
  function parcaCakisir(k, yerler, kenarPay) { return yakinlar((k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2, 3.5, Q => { if (yerler.indexOf(Q.tur.yer) < 0) return; const pay = Q.tur.yer === 'kenar' ? kenarPay : .02; for (const s of Q.kutular) if (kesisir(k, s, pay)) return true; }); }
  const catiDuvari = (a, b, Y, haric) => { for (const [ka, kb, kr] of hucreKenar(a, b)) { const w = kenarAl(ka, kb, kr); if (w && w.tur.duvar && w !== haric && Math.abs(w.y + DUVAR_H - Y) < .005) return w; } return null; };
  // çatı öbeği (aynı yükseklikte bitişik çatılar) en az bir duvara dayanıyor mu
  function catiDestekli(bas, haricCati, haricDuvar) { const gor = new Set([bas]), sira = [bas]; let n = 0;
    while (sira.length && n++ < 4000) { const C = sira.pop(); if (catiDuvari(C.a, C.b, C.y, haricDuvar)) return true; for (const d of YON) { const Q = catiAl(C.a + d[0], C.b + d[1]); if (Q && Q !== haricCati && !gor.has(Q) && Math.abs(Q.y - C.y) < .005) { gor.add(Q); sira.push(Q); } } } return false; }

  /* aday: önizleme noktasına (px, pz) göre parçanın oturacağı yer. Önce ucuz `anahtar` çıkarılır; ağır denetimler yalnız anahtar değişince yapılır.
     Döner: { a, b, r, y, neden } (neden: '' uygun | 'dolu' | 'destek' | 'egim' | 'su') */
  function anahtarBul(t, px, pz) {
    const ca = Math.floor(px / G), cb = Math.floor(pz / G), hk = ca + ',' + cb;
    if (t.yer === 'esya') return 'e' + Math.round(px * 4) + ',' + Math.round(pz * 4);
    if (hk !== donusHucre) { donusHucre = hk; if (t.yer === 'kenar' || t.yer === 'merdiven') donus = 0; }
    if (t.yer === 'kenar') { const fx = px / G - ca, fz = pz / G - cb; return hk + (fx > fz ? 'a' : 'b') + (fx + fz > 1 ? 'c' : 'd') + (Math.abs(fx - .5) > Math.abs(fz - .5) ? 'e' : 'f') + (fx > .5 ? 'g' : 'h') + (fz > .5 ? 'i' : 'j'); }
    if (t.yer === 'merdiven') { const y = yonAci(); return hk + 'm' + Math.round(y / (Math.PI / 4)); }
    return hk;
  }
  function adayBul(t, px, pz) {
    const ca = Math.floor(px / G), cb = Math.floor(pz / G), x0 = ca * G, z0 = cb * G, hucreK = { x0, x1: x0 + G, z0, z1: z0 + G };
    if (t.yer === 'zemin') { const [mn, mx] = araziAralik(x0, z0, x0 + G, z0 + G); let y = null, komsu = null;
      for (const d of YON) { const k = zeminAl(ca + d[0], cb + d[1]); if (k && (y == null || Math.abs(k.y - mx - tn.zeminUst) < Math.abs(y - mx - tn.zeminUst))) { y = k.y; komsu = k; } }
      if (!komsu) y = yuv(mx + tn.zeminUst); const A = { a: ca, b: cb, r: donus % 2, y, neden: '' }; let cok = false;
      // arazi komşu zeminden yüksekse bütün düzlük (bitişik zeminler ve üstündekiler) yeni hücreye yetecek kadar yükseltilir (en çok `yukselt`)
      if (komsu && mx > y - .02) { const yeni = yuv(mx + tn.zeminUst); if (yeni - y > tn.yukselt) cok = true; else { A.y = yeni; A.kaldir = komsu; } }
      if (zeminAl(ca, cb) || merdivenler.get(anh(ca, cb))) A.neden = 'dolu'; else if (mn < SU() + .05) A.neden = 'su';
      else if (cok || (komsu ? A.y - mn > tn.kazik : mx - mn > tn.egim)) A.neden = 'egim';
      else if (dunyaCakisir(hucreK) || parcaCakisir(hucreK, ['esya'], 0)) A.neden = 'dolu';
      return A; }
    if (t.yer === 'kenar') { const sirali = hucreKenar(ca, cb).map(k => { const [mx, mz] = kenarOrta(k[0], k[1], k[2]); return { k, u: hyp(mx - px, mz - pz) }; }).sort((p, q) => p.u - q.u).map(s => s.k);
      const denet = k => { const [a, b, r] = k, [mx, mz] = kenarOrta(a, b, r), A = { a, b, r, y: 0, neden: '' }, zy = kenarZeminY(a, b, r), kt = dik(mx, mz, -1, 1, -.1, .1, r);
        if (t.duvar) { A.y = zy != null ? zy : yuv(Math.max(gY(mx, mz), SU())); if (kenarAl(a, b, r)) A.neden = 'dolu'; else if (zy == null) A.neden = 'destek'; else if (dunyaCakisir(kt) || parcaCakisir(kt, ['esya'], .02)) A.neden = 'dolu'; }
        else { const u0 = r ? [mx, mz + 1] : [mx - 1, mz], u1 = r ? [mx, mz - 1] : [mx + 1, mz], y0 = zy != null ? zy : gY(u0[0], u0[1]), y1 = zy != null ? zy : gY(u1[0], u1[1]); A.y = (y0 + y1) / 2;
          if (kenarAl(a, b, r)) A.neden = 'dolu'; else if (Math.min(y0, y1) < SU() + .02) A.neden = 'su'; else if (Math.abs(y0 - y1) > tn.citEgim) A.neden = 'egim'; else if (dunyaCakisir(kt) || parcaCakisir(kt, ['esya', 'merdiven'], .02)) A.neden = 'dolu'; }
        return A; };
      const hepsi = sirali.map(denet); let ilk = hepsi.findIndex(A => !A.neden); if (ilk < 0) ilk = 0; return hepsi[(ilk + donus) % 4]; }
    if (t.yer === 'cati') { let y = null; for (const [ka, kb, kr] of hucreKenar(ca, cb)) { const k = kenarAl(ka, kb, kr); if (k && k.tur.duvar && (y == null || k.y + DUVAR_H > y)) y = yuv(k.y + DUVAR_H); }
      if (y == null) for (const d of YON) { const k = catiAl(ca + d[0], cb + d[1]); if (k && (y == null || k.y > y)) y = k.y; }
      const A = { a: ca, b: cb, r: donus % 4, y: y != null ? y : yuv(Math.max(gY(x0 + 1, z0 + 1), SU()) + DUVAR_H), neden: '' };
      if (catiAl(ca, cb)) A.neden = 'dolu'; else if (y == null) A.neden = 'destek'; else if (dunyaCakisir(hucreK)) A.neden = 'dolu';
      return A; }
    if (t.yer === 'merdiven') { const [fx, fz] = yonV(), sec = [0, 1, 2, 3].filter(r => zeminAl(ca + YON[r][0], cb + YON[r][1])).sort((p, q) => (YON[q][0] * fx + YON[q][1] * fz) - (YON[p][0] * fx + YON[p][1] * fz));
      const A = { a: ca, b: cb, r: 0, y: yuv(gY(x0 + 1, z0 + 1) + .6), neden: '', h: .6 };
      if (zeminAl(ca, cb) || merdivenler.get(anh(ca, cb))) { A.neden = 'dolu'; return A; } if (!sec.length) { A.neden = 'destek'; A.r = (Math.round(yonAci() / (Math.PI / 2)) % 4 + 4) % 4; return A; }
      A.r = sec[donus % sec.length]; A.y = zeminAl(ca + YON[A.r][0], cb + YON[A.r][1]).y; const d = YON[A.r], h = A.y - gY(x0 + 1 - d[0], z0 + 1 - d[1]), kt = dik(x0 + 1, z0 + 1, -.6, .6, -1, 1, A.r);
      if (gY(x0 + 1 - d[0], z0 + 1 - d[1]) < SU() - .3) A.neden = 'su'; else if (h < .22 || h > 1.5) A.neden = 'egim'; else if (dunyaCakisir(kt) || parcaCakisir(kt, ['esya'], 0)) A.neden = 'dolu';
      return A; }
    // eşya: 0,25 m adım; ya bütünüyle aynı yükseklikteki zeminlerin üstünde ya da bütünüyle arazide
    const a = Math.round(px * 4), b = Math.round(pz * 4), x = a / 4, z = b / 4, r = donus % 4, kt = dik(x, z, -t.en / 2, t.en / 2, -t.boy / 2, t.boy / 2, r), A = { a, b, r, y: 0, neden: '' };
    const nk = [[kt.x0, kt.z0], [kt.x1, kt.z0], [kt.x0, kt.z1], [kt.x1, kt.z1], [x, z]]; let zs = 0, zy = null, ayni = true, mn = 1e9, mx = -1e9;
    for (const [qx, qz] of nk) { const f = zeminAl(Math.floor(qx / G), Math.floor(qz / G)), h = gY(qx, qz); if (h < mn) mn = h; if (h > mx) mx = h; if (f) { zs++; if (zy == null) zy = f.y; else if (Math.abs(zy - f.y) > .005) ayni = false; } }
    if (zs === nk.length && ayni) A.y = zy; else { A.y = yuv((mn + mx) / 2); if (zs) A.neden = 'egim'; else if (mn < SU() + .03) A.neden = 'su'; else if (mx - mn > tn.esyaEgim) A.neden = 'egim'; }
    if (!A.neden && (dunyaCakisir(kt) || parcaCakisir(kt, ['esya', 'kenar', 'merdiven'], .11))) A.neden = 'dolu';
    return A;
  }

  /* ---------- çizim: örnek matrisleri ---------- */
  const m4 = () => new T3.Matrix4(), QY = [0, 1, 2, 3].map(r => new T3.Quaternion().setFromAxisAngle(new T3.Vector3(0, 1, 0), r * Math.PI / 2)), V1 = new T3.Vector3(), V2 = new T3.Vector3(), MZ = m4(), MS = m4();
  const mat = (x, y, z, r, sx, sy, sz) => m4().compose(V1.set(x, y, z), QY[r || 0], V2.set(sx || 1, sy || 1, sz || 1));
  // parçanın ağ örnekleri: yaz(ağ adı, matris). Önizleme de bunu kullanır.
  function parcaCiz(P, yaz, direkler) {
    const t = P.tur, id = t.id;
    if (t.yer === 'zemin') { yaz('zemin', mat(P.x, P.y, P.z, P.r)); yaz('temel', mat(P.x, P.y - .06, P.z, 0, 1, P.d, 1)); }
    else if (t.duvar) yaz(id, mat(P.x, P.y, P.z, P.r, 1, P.r ? .998 : 1, 1));
    else if (id === 'cit') { for (const [u, y] of [[P.u0, P.y0], [P.u1, P.y1]]) { const k = u[0] + ',' + u[1] + ',' + Math.round(y * 20); if (direkler) { if (direkler.has(k)) continue; direkler.add(k); } yaz('cit_direk', mat(u[0], y, u[1], (u[0] / 2 + u[1]) & 3)); }
      const be = Math.atan2(P.y1 - P.y0, G); yaz('cit_ray', mat(P.x, (P.y0 + P.y1) / 2, P.z, P.r).multiply(MZ.makeRotationZ(be)).multiply(MS.makeScale(1 / Math.cos(be), 1, 1))); }
    else if (id === 'cati') { yaz('cati', mat(P.x, P.y, P.z, P.r)); for (let d = 0; d < 4; d++) { const k = catiAl(P.a + YON[d][0], P.b + YON[d][1]); if (!(k && k !== P && !k.tur.egik && Math.abs(k.y - P.y) < .005)) yaz('sacak', mat(P.x, P.y, P.z, d)); } }
    else if (id === 'cati_egik') { yaz('cati_egik', mat(P.x, P.y, P.z, P.r)); const yan = YON[(P.r + 1) % 4], es = (k, r) => k && k !== P && k.tur.egik && k.r === r && Math.abs(k.y - P.y) < .005;
      for (const s of [-1, 1]) if (!es(catiAl(P.a + s * yan[0], P.b + s * yan[1]), P.r)) yaz('ucgen', mat(P.x + s * yan[0], P.y, P.z + s * yan[1], P.r));
      if (!es(catiAl(P.a + YON[P.r][0], P.b + YON[P.r][1]), (P.r + 2) % 4)) yaz('arka', mat(P.x, P.y, P.z, P.r)); }
    else if (id === 'merdiven') yaz('merdiven', mat(P.x, P.y, P.z, P.r, 1, P.h, 1));
    else { yaz(id, mat(P.x, P.y, P.z, P.r)); if (id === 'kamp_atesi') yaz('alev', mat(P.x, P.y, P.z, P.r)); }
  }
  const aglar = {}, uOy = { value: new T3.Vector3() }, uKes = { value: 1 }, uZaman = { value: 0 };
  let anaMat, cizgiMat, alevMat, onizMat, cizgiAg;
  // oyuncu ile kamera arasında kalan yüzeyleri noktalı açan gölgelendirici eki (ev içinde karakter görünsün)
  function kesEkle(s) {
    s.uniforms.uOy = uOy; s.uniforms.uKes = uKes;
    s.vertexShader = 'varying vec3 vDunya;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vec4 wpY = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wpY = instanceMatrix * wpY;\n#endif\n vDunya = (modelMatrix * wpY).xyz;');
    s.fragmentShader = 'uniform vec3 uOy; uniform float uKes; varying vec3 vDunya;\n' + s.fragmentShader.replace('void main() {', `void main() {
  if (uKes > 0.0) { vec3 ckY = uOy - cameraPosition; float LY = length(ckY); vec3 dY = ckY / max(LY, 1e-3); vec3 wY = vDunya - cameraPosition; float tY = dot(wY, dY);
    if (tY < LY - 0.3) { float rY = length(wY - dY * tY); float eY = smoothstep(uKes * 0.55, uKes, rY); if (eY <= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard; } }`);
  }
  function malzemeKur() {
    const GUN = (SO.gorunum && SO.gorunum.GUN) || new T3.Vector3(-.5, .8, .35).normalize(), atlas = atlasCiz();
    anaMat = new T3.MeshBasicMaterial({ vertexColors: true, map: atlas });
    anaMat.onBeforeCompile = s => { s.uniforms.uGun = { value: GUN };
      s.vertexShader = 'uniform vec3 uGun; attribute vec3 color2;\n' + s.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING
  mat4 mIY = modelMatrix * instanceMatrix;
#else
  mat4 mIY = modelMatrix;
#endif
  vec3 ipY = mIY[3].xyz; vec3 nY = normalize(mat3(mIY) * normal);
  float gKY = smoothstep(-.25, .6, dot(nY, uGun)) * .85 + .15 * max(nY.y, 0.0);
  float hY = fract(sin(dot(fract(ipY.xz * vec2(.1731, .2137)) + ipY.y * .37, vec2(12.9898, 78.233))) * 43758.5453);
  vColor.xyz = mix(color2, color, gKY) * (.93 + .12 * hY);`);
      kesEkle(s); };
    cizgiMat = new T3.MeshBasicMaterial({ color: INK, side: T3.BackSide }); cizgiMat.onBeforeCompile = kesEkle;
    alevMat = new T3.MeshBasicMaterial({ vertexColors: true }); alevMat.onBeforeCompile = s => { s.uniforms.uZaman = uZaman;
      s.vertexShader = 'uniform float uZaman;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float fzY = uZaman * 7.0 + instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
#else
  float fzY = uZaman * 7.0;
#endif
  float kY = clamp((position.y - .08) / .5, 0.0, 1.0);
  transformed.x += sin(fzY + position.y * 9.0) * .05 * kY; transformed.z += cos(fzY * 1.31 + position.y * 7.0) * .05 * kY; transformed.y *= 1.0 + .13 * sin(fzY * 1.7) * kY;`); };
    onizMat = new T3.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .62, depthWrite: false });
  }
  function alevGeo() { const P = [], C = [], kat = (r, h, y, c) => { const g = new T3.ConeGeometry(r, h, 6).toNonIndexed(); g.translate(0, y + h / 2, 0); const A = g.attributes.position.array; for (let i = 0; i < A.length; i += 3) { P.push(A[i], A[i + 1], A[i + 2]); const k = clamp((A[i + 1] - y) / h, 0, 1); C.push(c[0] + k * .0, c[1] - k * .25, c[2]); } };
    kat(.2, .62, .1, [1, .62, .12]); kat(.11, .4, .12, [1, .9, .35]); const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(C, 3)); return g; }
  function agKur() {
    for (const ad in AG) { const t = AG[ad](); aglar[ad] = { ad, geo: t.geo, mat: anaMat, kap: 0, n: 0, mesh: null,
      cizgi: t.cizgi.map(c => { const e = .022, m = m4(), q = new T3.Quaternion(); if (c[6]) q.setFromAxisAngle(new T3.Vector3(1, 0, 0), c[6]); return m.compose(new T3.Vector3((c[0] + c[3]) / 2, (c[1] + c[4]) / 2, (c[2] + c[5]) / 2), q, new T3.Vector3(c[3] - c[0] + 2 * e, c[4] - c[1] + 2 * e, c[5] - c[2] + 2 * e)); }) }; }
    aglar.alev = { ad: 'alev', geo: alevGeo(), mat: alevMat, kap: 0, n: 0, mesh: null, cizgi: [] };
    cizgiAg = { ad: 'cizgi', geo: new T3.BoxGeometry(1, 1, 1), mat: cizgiMat, kap: 0, n: 0, mesh: null, cizgi: [] };
  }
  function agYaz(a, M) { if (a.n >= a.kap) { const kap = Math.max(32, a.kap * 2), m = new T3.InstancedMesh(a.geo, a.mat, kap); m.frustumCulled = false; m.matrixAutoUpdate = false;
      if (a.mesh) { m.instanceMatrix.array.set(a.mesh.instanceMatrix.array); SO.scene.remove(a.mesh); a.mesh.dispose(); } SO.scene.add(m); a.mesh = m; a.kap = kap; }
    a.mesh.setMatrixAt(a.n++, M); }
  const MC = m4();
  function cizYaz() {
    cizKirli = false; const ps = SO.ps; cizM.x = ps.x; cizM.z = ps.z; for (const ad in aglar) aglar[ad].n = 0; cizgiAg.n = 0; const direkler = new Set(); let cizgili = false;
    const yaz = (ad, M) => { const a = aglar[ad]; agYaz(a, M); if (cizgili) for (const c of a.cizgi) agYaz(cizgiAg, MC.multiplyMatrices(M, c)); };
    for (const P of parcalar) { const u = hyp(P.x - ps.x, P.z - ps.z); if (u > tn.gizle) continue; cizgili = u < tn.cizgiUzak; parcaCiz(P, yaz, direkler); }
    for (const a of Object.values(aglar).concat(cizgiAg)) if (a.mesh) { a.mesh.count = a.n; a.mesh.visible = a.n > 0; a.mesh.instanceMatrix.needsUpdate = true; }
  }
  function kutuYaz() { kutuKirli = false; const ps = SO.ps, E = SO.world.ekKutular; kutuM.x = ps.x; kutuM.z = ps.z; E.length = 0;
    for (const P of parcalar) if (P.kutular.length && hyp(P.x - ps.x, P.z - ps.z) < tn.kutuUzak) for (const k of P.kutular) E.push(k);
    SO.world.kutuYenile(); }

  /* ---------- önizleme ---------- */
  const onizHavuz = {}, onizAcik = [], UYGUN = new T3.Color(.62, 1.25, .62), DEGIL = new T3.Color(1.35, .5, .42);
  function onizGizle() { for (const m of onizAcik) m.visible = false; onizAcik.length = 0; }
  function onizCiz(P) { onizGizle(); const say = {};
    parcaCiz(P, (ad, M) => { if (ad === 'alev') return; const h = onizHavuz[ad] || (onizHavuz[ad] = []), i = say[ad] = (say[ad] || 0) + 1; let m = h[i - 1];
      if (!m) { m = new T3.Mesh(aglar[ad].geo, onizMat); m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 5; SO.scene.add(m); h.push(m); }
      m.matrix.copy(M); m.matrixWorldNeedsUpdate = true; m.visible = true; onizAcik.push(m); }, null); }
  const yonAci = () => tn.yon === 'karakter' ? SO.ps.yaw : SO.cam.yaw, yonV = () => { const a = yonAci(); return [Math.sin(a), Math.cos(a)]; };
  function onizGuncelle(zorla) {
    const ps = SO.ps, t = kipTur, [fx, fz] = yonV(), egil = tn.yon === 'karakter' ? 0 : clamp((SO.cam.pitch - .16) * 1.4, -.3, 1.2), u = Math.max(1.3, (t.yer === 'esya' ? tn.esyaUzak : tn.uzak) - egil);
    const px = ps.x + fx * u, pz = ps.z + fz * u, an = t.id + '|' + anahtarBul(t, px, pz) + '|' + donus;
    if (an === sonAnahtar && !denetKirli && !zorla) return; sonAnahtar = an; denetKirli = false;
    const A = adayBul(t, px, pz), yb = yapabilir(t.id); if (!A.neden && !yb.ok) A.neden = yb.kilitli ? 'kilitli' : 'malzeme'; aday = A;
    const P = hazirla({ tur: t, a: A.a, b: A.b, r: A.r, y: A.y }); if (t.yer === 'merdiven' && A.neden) P.h = clamp(P.h, .3, 1.2); onizCiz(P); onizMat.color.copy(A.neden ? DEGIL : UYGUN);
    const uygun = !A.neden; if (kip.uygun !== uygun || kip.neden !== A.neden) { kip.uygun = uygun; kip.neden = A.neden; bildir('kip'); }
  }

  /* ---------- kip ---------- */
  function teknolojiAcik(id) { if (id == null) return true; const o = SO.oyun; if (o && typeof o.teknolojiAcik === 'function') return !!o.teknolojiAcik(id); const T = SO.teknoloji; if (Array.isArray(T)) { const k = T.find(q => q.id === id); return !k || !!k.acik; } return true; }
  function yapabilir(id) { const t = TUR[id], eksik = {}; if (!t) return { ok: false, eksik, kilitli: false }; const env = SO.envanter; let tam = true;
    for (const k in t.girdi) { const var_ = env ? env.adet(k) : 0; if (var_ < t.girdi[k]) { eksik[k] = t.girdi[k] - var_; tam = false; } }
    const kilitli = !teknolojiAcik(t.teknoloji); return { ok: tam && !kilitli, eksik, kilitli }; }
  function basla(id) { const t = TUR[id]; if (!kurulu || !t || !yapabilir(id).ok) return false; if (kip) iptal(); hedefYaz(null);
    kipTur = t; kip = { id, uygun: false, neden: '' }; donus = 0; donusHucre = ''; sonAnahtar = ''; denetKirli = true; onizGuncelle(true); bildir('kip'); return true; }
  function iptal() { if (!kip) return false; kip = null; kipTur = null; aday = null; onizGizle(); bildir('kip'); return true; }
  function dondur() { if (!kip) return false; donus++; denetKirli = true; onizGuncelle(true); return true; }
  function onayla() {
    if (!kip) return false; onizGuncelle(true); if (!kip || !kip.uygun || !aday) return false; const t = kipTur, env = SO.envanter;
    for (const k in t.girdi) if (env.adet(k) < t.girdi[k]) return false; for (const k in t.girdi) env.harca(k, t.girdi[k]);
    if (aday.kaldir) duzlukKaldir(aday.kaldir, aday.y);
    const P = parcaYap(t, aday.a, aday.b, aday.r, aday.y); ekle(P); degisti(P); try { SO.ses.olay('kur', { tur: t.id }); } catch (e) { }
    bildir('kur'); if (!yapabilir(t.id).ok) iptal(); else if (kip) onizGuncelle(true);
    return true;
  }

  /* ---------- sökme ---------- */
  const ONCELIK = { esya: 0, kenar: 1, merdiven: 1, cati: 2, zemin: 3 };
  function engelBul(P) { const t = P.tur;
    if (t.yer === 'zemin') {
      for (const [a, b, r] of hucreKenar(P.a, P.b)) { const w = kenarAl(a, b, r); if (w && w.tur.duvar && !kenarHucre(a, b, r).some(([ca, cb]) => { const z = zeminAl(ca, cb); return z && z !== P; })) return 'Önce duvarı sök'; }
      for (let r = 0; r < 4; r++) { const m = merdivenler.get(anh(P.a - YON[r][0], P.b - YON[r][1])); if (m && m.r === r) return 'Önce merdiveni sök'; }
      if (yakinlar(P.x, P.z, 2.5, Q => Q.tur.yer === 'esya' && Math.abs(Q.y - P.y) < .005 && Q.sinir[0] < P.x + 1 && Q.sinir[3] > P.x - 1 && Q.sinir[2] < P.z + 1 && Q.sinir[5] > P.z - 1)) return 'Önce üstündeki eşyayı sök'; }
    else if (t.duvar) { for (const [ca, cb] of kenarHucre(P.a, P.b, P.r)) { const c = catiAl(ca, cb); if (c && Math.abs(c.y - P.y - DUVAR_H) < .005 && !catiDestekli(c, null, P)) return 'Önce çatıyı sök'; } }
    else if (t.yer === 'cati') { for (const d of YON) { const c = catiAl(P.a + d[0], P.b + d[1]); if (c && Math.abs(c.y - P.y) < .005 && !catiDestekli(c, P, null)) return 'Önce komşu çatıyı sök'; } }
    return null; }
  let vurguAg = null;
  function hedefYaz(P) { if (P === hedef) return; hedef = P; hedefBilgi = null;
    if (P) { const iade = {}; for (const k in P.tur.girdi) { const n = Math.floor(P.tur.girdi[k] / 2); if (n > 0) iade[k] = n; } hedefBilgi = { id: P.tur.id, ad: P.tur.ad, x: P.x, y: P.y, z: P.z, iade, engel: engelBul(P) }; }
    if (vurguAg) { vurguAg.visible = !!P && tn.vurgu; if (P) { const s = P.sinir, e = .04; vurguAg.position.set((s[0] + s[3]) / 2, (s[1] + s[4]) / 2, (s[2] + s[5]) / 2); vurguAg.scale.set(s[3] - s[0] + e, s[4] - s[1] + e, s[5] - s[2] + e); vurguAg.updateMatrix(); } }
    bildir('hedef'); }
  function hedefGuncelle() { const ps = SO.ps; if (!ps.grounded || ps.yuzme || ps.kilit || !parcalar.length) return hedefYaz(null);
    const [fx, fz] = yonV(), tx = ps.x + fx * tn.sokUzak, tz = ps.z + fz * tn.sokUzak; let en = null, enP = 9, enU = 9;
    yakinlar(tx, tz, 2.2, P => { const s = P.sinir, dx = Math.max(s[0] - tx, 0, tx - s[3]), dz = Math.max(s[2] - tz, 0, tz - s[5]), u = hyp(dx, dz); if (u > .45) return; const o = ONCELIK[P.tur.yer]; if (o < enP || (o === enP && u < enU)) { en = P; enP = o; enU = u; } });
    hedefYaz(en); }
  function sok() { if (kip || !hedef) return false; const P = hedef, b = hedefBilgi; b.engel = engelBul(P); if (b.engel) return false;
    cikar(P); for (const k in b.iade) SO.envanter.ekle(k, b.iade[k]); hedef = null; hedefBilgi = null; if (vurguAg) vurguAg.visible = false; degisti(P); try { SO.ses.olay('sok', { tur: P.tur.id }); } catch (e) { }
    bildir('sok'); sokSure = 0; return true; }

  /* ---------- sorgular ---------- */
  function yakin(id, r) { const s = turListe[id]; if (!s || !s.size) return null; const ps = SO.ps, R = r == null ? 3 : r; let en = null, enU = R;
    for (const P of s) { const u = hyp(P.x - ps.x, P.z - ps.z); if (u <= enU && Math.abs(P.y - ps.y) < 3) { en = P; enU = u; } } return en ? { id, x: en.x, y: en.y, z: en.z, uzak: enU } : null; }

  /* ---------- kayıt ---------- */
  const s36 = n => Math.round(n).toString(36);
  function kodla() { const obek = []; for (const t of TURLER) { const L = parcalar.filter(P => P.tur === t).sort((p, q) => p.a - q.a || p.b - q.b); if (!L.length) continue; let a = 0, b = 0, y = 0; const s = [];
      for (const P of L) { const yc = Math.round(P.y * 100); s.push(s36(P.a - a) + ',' + s36(P.b - b) + ',' + P.r + ',' + s36(yc - y)); a = P.a; b = P.b; y = yc; } obek.push(t.id + ':' + s.join(';')); }
    return JSON.stringify({ v: 1, p: obek.join('|') }); }
  function coz(metin) { const o = typeof metin === 'string' ? JSON.parse(metin) : metin; if (!o || o.v !== 1 || typeof o.p !== 'string') return false; temizle(true);
    for (const ob of o.p.split('|')) { const i = ob.indexOf(':'), t = TUR[ob.slice(0, i)]; if (i < 0 || !t) continue; let a = 0, b = 0, y = 0;
      for (const s of ob.slice(i + 1).split(';')) { const q = s.split(','); if (q.length !== 4) continue; a += parseInt(q[0], 36); b += parseInt(q[1], 36); y += parseInt(q[3], 36); const r = +q[2] & 3; if (!isFinite(a + b + y)) break; const h = harita({ tur: t, a, b, r }); if (h && h[0].has(h[1])) continue; ekle(parcaYap(t, a, b, r, y / 100)); } }
    for (const P of parcalar) if (P.tur.id === 'cit') hazirla(P); // çit yüksekliği zeminlere bağlı: hepsi yüklendikten sonra
    cizKirli = kutuKirli = denetKirli = true; if (kurulu) kutuYaz(); return true; }
  function temizle(sessiz) { parcalar.length = 0; zeminler.clear(); kenarlar.clear(); catilar.clear(); merdivenler.clear(); kova.clear(); for (const k in turListe) delete turListe[k]; hedefYaz(null); cizKirli = kutuKirli = denetKirli = true; if (!sessiz && kurulu) { kutuYaz(); kayitZamanla(); } }
  function kayitYaz() { clearTimeout(kayitT); kayitT = 0; if (SO.test) return; try { localStorage.setItem(KAYIT, kodla()); } catch (e) { } }
  function kayitZamanla() { if (SO.test || kayitT) return; kayitT = setTimeout(kayitYaz, 800); }
  function kayitOku() { if (SO.test) return; try { const m = localStorage.getItem(KAYIT); if (m) coz(m); } catch (e) { } }

  /* ---------- deneme/araç: denetimsiz doğrudan yerleştirme (malzeme düşmez) ---------- */
  function yerlestir(id, a, b, r, y) { const t = TUR[id]; if (!t) return null; const h = harita({ tur: t, a, b, r: r || 0 }); if (h && h[0].has(h[1])) return null; const P = parcaYap(t, a, b, r || 0, y == null ? gY(a * G + 1, b * G + 1) + tn.zeminUst : y); ekle(P); degisti(P); return P; }

  function init() {
    malzemeKur(); agKur();
    vurguAg = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(1, 1, 1)), new T3.LineBasicMaterial({ color: 0xffc14a, transparent: true, opacity: .9, depthTest: false })); vurguAg.matrixAutoUpdate = false; vurguAg.visible = false; vurguAg.renderOrder = 6; vurguAg.frustumCulled = false; SO.scene.add(vurguAg);
    kurulu = true; kayitOku(); kutuYaz(); cizYaz();
    if (SO.envanter && SO.envanter.dinle) SO.envanter.dinle(() => { denetKirli = true; });
    if (SO.oyun && SO.oyun.dinle) SO.oyun.dinle(ne => { if (ne === 'teknoloji') denetKirli = true; });
    addEventListener('keydown', e => { if (!tn.xTusu || e.repeat || e.ctrlKey || e.metaKey || e.altKey || kip || (e.key !== 'x' && e.key !== 'X')) return; const h = e.target && e.target.tagName; if (h === 'INPUT' || h === 'TEXTAREA') return; sok(); });
    addEventListener('visibilitychange', () => { if (document.hidden && kayitT) kayitYaz(); }); addEventListener('pagehide', () => { if (kayitT) kayitYaz(); });
  }
  function update(dt) {
    if (!kurulu) return; const ps = SO.ps; uOy.value.set(ps.x, ps.y + 1.05, ps.z); uKes.value = tn.kes; uZaman.value = SO.time;
    if (hyp(ps.x - kutuM.x, ps.z - kutuM.z) > 25) kutuKirli = true; if (hyp(ps.x - cizM.x, ps.z - cizM.z) > 60) cizKirli = true;
    if (kutuKirli) kutuYaz(); if (cizKirli) cizYaz();
    if (kip) onizGuncelle(false); else { sokSure -= dt; if (sokSure <= 0) { sokSure = .12; hedefGuncelle(); } }
  }

  SO.yapi = { init, update, basla, onayla, iptal, dondur, yapabilir, yakin, sok, dinle: fn => { if (typeof fn === 'function') dinleyen.push(fn); },
    get kip() { return kip; }, get sokulebilir() { return kip ? null : hedefBilgi; }, get aday() { return aday; },
    parcalar, TUR, yerlestir, temizle: () => temizle(false), kodla, coz: m => { const ok = coz(m); if (ok) kayitZamanla(); return ok; },
    durum: () => { const say = {}; for (const P of parcalar) say[P.tur.id] = (say[P.tur.id] || 0) + 1; let cizilen = 0; for (const ad in aglar) cizilen += aglar[ad].n; return { parca: parcalar.length, say, kutu: SO.world.ekKutular.length, cizilen, cizgi: cizgiAg ? cizgiAg.n : 0, ag: Object.keys(aglar).filter(k => aglar[k].mesh).length }; } };
})();
