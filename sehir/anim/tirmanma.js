/* Tırmanma katmanı (order 24; kol çözümü order 45): düz tepeli kayalara çıkma. Tek düğme (zıplama) ile, yüksekliğe göre üç davranış.

   KARAR (zıplama tuşu; anim/ziplama.js yerdeyken basışta SO.tirman.dene() çağırır). Yön: çubuk itiliyorsa o yön, değilse bakılan yön.
   Menzil (karakterin merkezinden kayanın görünen kenarına): 1,0 m + 0,14 sn × hız (koşarken ≈ 1,5 m, deparda ≈ 1,9 m).
   y = kayanın tepesi − ayak hizası:
     y < 0,65 m  (diz)  : normal zıplama. Çubuk bırakılmışsa ya da kayaya doğruysa, havadayken kayaya doğru hız tamamlanır (üstüne konar).
     0,65–1,35 m (bel)  : elle destek alarak aşma ('bel'): hizalan → sıçra, sol el kenara basar → dizler karna → üstte koşu adımıyla çık.
     1,35–2,10 m (boy)  : 'boy': hizalan + çömel → sıçra, önce sağ sonra sol el kenarı tutar → asıl (ağırlık oturur) → kendini çek → üste aş.
     > 2,10 m           : tırmanma yok, normal zıplama.
   Havada tutunma: karakter havadayken (zıplama ya da düşüş) önünde 0,7 m içinde, tepesi ayağından 0,25–1,75 m yukarıda düz kaya varsa ve
   oyuncu çubuğu kayaya doğru itiyorsa ya da son 0,35 sn içinde zıplamaya basmışsa (havada ikinci basış) kenarı yakalar: tepe 1,2 m'den
   yüksekteyse asılıp çekilir, alçaktaysa doğrudan üste aşar. (Koşarak uzaktan zıplayıp kayaya yetişen oyuncu kendiliğinden tutunur.)

   KLİP ÖLÇÜMÜ: ClimbUp_1m (0,667 sn, 30 kare/sn, kök yerinde; baştaki ve sondaki poz aynı koşu adımı; değerler kök uzayında, m):
     0,00–0,07  sol ayak yerde (parmak 0,03–0,07), itiş; sağ diz öne gelir
     0,10–0,17  ayak yerden kesilir; sağ ayak 0,64 → 0,84 yukarı (öne 0,2); sağ el 1,27'ye kalkar
     0,20–0,37  SOL EL DESTEKTE: bilek 0,77 → 0,67 (yana 0,32); gövdeye göre 0,35 m geriye kayar (gövde elin üstünden öne geçer);
                dizler karında (ayak parmakları 0,53–0,62), baş 1,13'e iner, sol omuz 1,06; sağ kol arkada yukarıda (1,47)
     0,40–0,50  el bırakır (0,74 → 0,95), bacaklar açılır: sol ayak öne, sağ ayak arkaya
     0,53–0,667 sol ayak yere iner (parmak 0,38 → 0,03), koşu adımı pozu
   Kullanım: kök eğrisi klip zamanına bağlıdır: yükseklik payı Y = yumuşak(0,07 → 0,47), ileri payı S = yumuşak(0,10 → 0,62);
   ayaklar tepeye yetişmeden kök kenarı geçmez. Klibin eli tepeye tam oturmadığından sol bilek iki kemikli çözümle kenara konur.
   Boy hizası için hazır klip yok: çömelme = Jump_Start'ın 0. karesi, asılma/çekilme gövdesi = Jump_Loop (bu katmanın kendi kopyaları;
   zıplama katmanının oynatıcılarına dokunulmaz), kollar tümüyle iki kemikli çözümle kenarda; çekiliş sonunda ClimbUp_1m'in 0,13. karesine
   geçilir ve aşma oradan oynar. Ölçü: omuz 1,41 m, kol (omuz → bilek) 0,53 m; yani ayakta uzanınca bilek 1,94 m'ye yetişir.

   KAYANIN GERÇEK KENARI: çarpışma kutusu kare, görünen kaya yedigen ve yanları eğik (taban tepeden geniş). Başlarken görünen ağa ışın
   atılır: tepe kenarı (iki el için ayrı ayrı), tepe yüksekliği ve yüzün eğimi ölçülür; eller ve gövde bunlara göre yerleşir.

   Yazdığı alanlar: ps.tirmanBlend (0..1; tırmanış kliplerinin toplam ağırlığı), ps.tirman ('' | 'bel' | 'boy'),
     ps.tirmanFaz ('' | 'hiza' | 'sicra' | 'asil' | 'cek' | 'as' | 'cik'), ps.kilit (tırmanış boyunca true).
   Kilit altında bu katman yazar: ps.x/y/z, ps.yaw, ps.yawRate (0), ps.lean (0), ps.leanFwd (eğik yüzde gövdeyi yüze yatırır), ps.vx/vz (kökün
     gerçek hızı), ps.vy (0), ps.grounded (false: ayak katmanı kapalı kalsın), bitişte ps.grounded = true, ps.y = ps.groundY = tepe.
   Ayrıca her kare: ps.airBlend = max(ps.airBlend, ps.tirmanBlend) (taban hareket bastırılır), ps.ikKapat = max(ps.ikKapat, ps.tirmanBlend).
   Ses olayları: 'tutun' {} (her el kenara değdiğinde), 'tirman' { yukseklik } (çekiliş / üste aşma başlarken).
   Ayarlar: SO.tune.tirmanma. Ölçüm: SO.tirman.durum. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp, wrapA = SO.wrapA;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const K = SO.tune.tirmanma = Object.assign({
    on: true,
    diz: .65, bel: 1.35, boy: 2.1,   // m: yükseklik eşikleri (altı normal zıplama | elle destek | tutun-çek | üstü yok)
    menzil: 1.0, menzilHiz: .14,      // m, sn: karar menzili = menzil + menzilHiz × hız
    aci: .45,                         // kayanın yüzüne en az bu kadar dönük olmalı (yön · yüz normali)
    hizaSure: .13, hizaBoy: .15,     // sn: yaklaşma hizası (bel / boy)
    hizaHiz: 3.2,                     // m/sn: hizalanırken kökün en çok hızı (uzaksa hizalama uzar)
    durus: .42,                       // m: aşmadan önce kökün kenara uzaklığı
    bitis: .42,                       // m: bitişte kökün kenardan içeride durduğu yer
    asSure: .5, asSureY: .3,         // sn: aşma süresi = asSure + asSureY × yükseklik (1 m → 0,8 sn)
    sicraSure: .26, asilSure: .26, cekSure: .46, // sn: boy hizasında sıçrama, asılma, çekiliş
    asili: 1.62,                      // m: kenarı yakaladığı anda kök tepeden bu kadar aşağıda (kollar kırık)
    cokme: .16,                       // m: asılınca ağırlığın oturması (kollar gerilir: kök tepeden 1,78 m aşağıda)
    ustSure: .5,                      // sn: çekilişten sonra üste aşma (destekten ayağa)
    govde: .25,                        // m: asılıyken kökün kaya yüzüne uzaklığı
    elYan: .26, elIleri: .1, elYuk: .055, // m: bileğin kenara göre yeri (yana, içeri, tepenin üstünde)
    cikis: .22,                       // sn: bitişte taban harekete dönüş
    havaAlt: .25, havaUst: 1.75, havaAsili: 1.2, havaUzak: .7, havaBasis: .35, // havada tutunma sınırları
    dizHiz: 2.6                       // m/sn: diz boyu kayaya zıplarken verilen en çok ileri hız
  }, SO.tune.tirmanma || {});

  let aTr, aCr, aAs;                 // ClimbUp_1m, çömelme (Jump_Start kopyası), asılma gövdesi (Jump_Loop kopyası)
  const T = { on: false, tur: '', faz: '', t: 0, sure: 0, tb: 0, tau: 0, wCr: 0, wAs: 0, wTr: 1, ikL: 0, ikR: 0, sesL: false, sesR: false, sesT: false };
  const D = SO.tirman = { durum: T, dene: null };
  let yardim = null;                 // diz boyu kayaya zıplama yardımı
  const ray = new T3.Raycaster(), V0 = new T3.Vector3(), V1 = new T3.Vector3(), ASAGI = new T3.Vector3(0, -1, 0); let aglar = [];

  /* ---------- kayanın görünen ağına ışın ---------- */
  function vur(ox, oy, oz, dx, dy, dz, uzak) { ray.set(V0.set(ox, oy, oz), V1.set(dx, dy, dz)); ray.near = 0; ray.far = uzak; let en = null;
    for (const m of aglar) { const h = []; m.raycast(ray, h); for (const q of h) if (!en || q.distance < en.distance) en = q; } return en; }
  // tepe kenarı: (px,pz) noktasından f yönünde içeri doğru taranır; tepe yüzeyinin başladığı uzaklık (yoksa null)
  function kenarBul(px, pz, fx, fz, top) { let once = -.36;
    for (let e = -.36; e <= .7; e += .04) { const h = vur(px + fx * e, top + .35, pz + fz * e, 0, -1, 0, .5); if (h && h.point.y > top - .1) { // ikiye bölerek incelt
        let a = once, b = e, y = h.point.y; for (let i = 0; i < 4; i++) { const m = (a + b) / 2, q = vur(px + fx * m, top + .35, pz + fz * m, 0, -1, 0, .5); if (q && q.point.y > top - .1) { b = m; y = q.point.y; } else a = m; }
        return { e: b, y }; } once = e; }
    return null; }

  /* ---------- hedef: o yönde çıkılabilir kaya, yüzü, gerçek kenarı ---------- */
  function hedefBul(ctx, dx, dz, uzak) {
    const ps = ctx.ps, w = ctx.world, b = w.basamak(ps.x, ps.z, dx, dz, uzak, ps.y); if (!b) return null;
    let kutu = null; for (const s of w.solids) if (s.duz && s.top === b.top && b.x > s.x0 - .01 && b.x < s.x1 + .01 && b.z > s.z0 - .01 && b.z < s.z1 + .01) { kutu = s; break; } if (!kutu) return null;
    const a = [Math.abs(b.x - kutu.x0), Math.abs(b.x - kutu.x1), Math.abs(b.z - kutu.z0), Math.abs(b.z - kutu.z1)], i = a.indexOf(Math.min(a[0], a[1], a[2], a[3]));
    if (a[i] > .02) return null;                                    // kutunun içinden bakıyor (olmamalı)
    const fx = i === 0 ? 1 : i === 1 ? -1 : 0, fz = i === 2 ? 1 : i === 3 ? -1 : 0; // yüzün içeri bakan normali = tırmanış yönü
    if (dx * fx + dz * fz < K.aci) return null;
    const cx = (kutu.x0 + kutu.x1) / 2, cz = (kutu.z0 + kutu.z1) / 2, yar = (kutu.x1 - kutu.x0) / 2, pay = Math.max(.1, yar * .5);
    // kenar noktası: oyuncunun yüz üstündeki izdüşümü; köşelere yaklaşmaz (kutunun köşesi görünen kayanın dışında kalır)
    let ex = fx ? (fx > 0 ? kutu.x0 : kutu.x1) : clamp(ps.x, cx - pay, cx + pay), ez = fz ? (fz > 0 ? kutu.z0 : kutu.z1) : clamp(ps.z, cz - pay, cz + pay);
    return { kutu, fx, fz, ex, ez, top: b.top, yuk: b.top - ps.y, uzak: -((ps.x - ex) * fx + (ps.z - ez) * fz) };
  }
  // görünen ağa göre incelt: kenar (iki el için), tepe, yüz eğimi
  function incelt(h) {
    aglar = SO.scene.children.filter(o => o.isInstancedMesh && o.visible !== false && !(o.material && o.material.side === T3.BackSide));
    const lx = h.fz, lz = -h.fx; let kL = kenarBul(h.ex + lx * K.elYan, h.ez + lz * K.elYan, h.fx, h.fz, h.top), kR = kenarBul(h.ex - lx * K.elYan, h.ez - lz * K.elYan, h.fx, h.fz, h.top);
    if (!kL && !kR) kL = kR = { e: 0, y: h.top }; else if (!kL) kL = kR; else if (!kR) kR = kL;
    const e = Math.min(kL.e, kR.e); h.ex += h.fx * e; h.ez += h.fz * e; h.eL = kL.e - e; h.eR = kR.e - e; h.yL = kL.y; h.yR = kR.y; h.uzak += e;
    // yüz eğimi: kenarın altında iki yükseklikte yatay ışın (kenardan dışarı kaç m taşıyor)
    const olc = y => { const q = vur(h.ex - h.fx * 1.2, y, h.ez - h.fz * 1.2, h.fx, 0, h.fz, 1.5); return q ? Math.max(0, 1.2 - q.distance) : 0; };
    const d1 = olc(h.top - .2), alt = Math.max(.5, Math.min(1.5, h.yuk - .15)), d2 = olc(h.top - alt);
    h.egim = clamp((d2 - d1) / (alt - .2), 0, .35); h.tasma = Math.max(0, d1 - h.egim * .2); aglar = [];
    // bitiş noktası kutunun içinde kalmalı (fizik orada destek arar)
    const k = h.kutu, bx = h.ex + h.fx * K.bitis, bz = h.ez + h.fz * K.bitis; h.bx = clamp(bx, k.x0 + .12, k.x1 - .12); h.bz = clamp(bz, k.z0 + .12, k.z1 - .12);
    h.sB = (h.bx - h.ex) * h.fx + (h.bz - h.ez) * h.fz; return h;
  }
  const yuz = (h, y) => -(h.tasma + h.egim * Math.max(0, h.top - y)); // kaya yüzünün o yükseklikteki yeri (kenara göre, eksi = dışarı)

  /* ---------- başlat ---------- */
  function basla(ctx, h, havada) {
    const ps = ctx.ps; incelt(h);
    Object.assign(T, { on: true, h, t: 0, havada, tur: h.yuk >= (havada ? K.havaAsili : K.bel) ? 'boy' : 'bel', sesL: false, sesR: false, sesT: false, ikL: 0, ikR: 0, leanF: 0,
      x0: ps.x, z0: ps.z, y0: ps.y, yaw0: ps.yaw, yawT: Math.atan2(h.fx, h.fz), lean0: ps.leanFwd || 0, v0: Math.max(0, ps.vx * h.fx + ps.vz * h.fz), yuk: h.yuk });
    T.s0 = (ps.x - h.ex) * h.fx + (ps.z - h.ez) * h.fz; T.l0 = (ps.x - h.ex) * h.fz - (ps.z - h.ez) * h.fx; T.s = T.s0; T.y = ps.y; T.lean = T.lean0;
    T.yA = Math.max(T.y0 + (havada ? -.05 : .1), h.top - K.asili);   // asılma yüksekliği
    if (T.tur === 'boy') fazaGir(havada ? 'sicra' : 'hiza'); else fazaGir(!havada ? 'hiza' : h.yuk < .5 ? 'as' : 'cek');
    ps.kilit = true; ps.grounded = false; ps.vy = 0; ps.jumpNow = false; ps.tirman = T.tur; yardim = null;
    return true;
  }
  function fazaGir(f) {
    const h = T.h; T.faz = f; T.t = 0; T.sF = T.s; T.yF = T.y;
    if (f === 'hiza') { T.sure = T.tur === 'boy' ? K.hizaBoy : K.hizaSure;
      // aşmadan önce durulacak yer: koşarken hızı keserek değil taşıyarak; dururken en çok bir adımlık kayma
      T.sH = T.tur === 'boy' ? yuz(h, T.y0 + .3) - K.govde : Math.min(-K.durus, Math.max(T.s0 + T.v0 * T.sure * .8, -.55 - .12 * T.v0));
      T.sure = Math.max(T.sure, Math.abs(T.sH - T.s0) / Math.max(K.hizaHiz, T.v0)); } // uzaktaysa kayarak değil, bir adım süresinde gelir
    else if (f === 'sicra') T.sure = T.havada ? .14 : K.sicraSure;
    else if (f === 'asil') T.sure = K.asilSure;
    else if (f === 'cek') { T.yC = h.top - DESTEK - .02; T.sure = K.cekSure * Math.sqrt(clamp((T.yC - T.y) / .55, .2, 1.7)); if (T.yC < T.y + .03) { T.yC = T.y; T.sure = .14; } }
    else if (f === 'as') { const tam = T.tur === 'bel' && !T.havada, r0 = h.top - T.y, adim = !tam && r0 < .5; T.tau0 = tam ? .05 : adim ? .42 : .27; T.r0 = r0; T.adim = adim;
      // adim: havadan, tepe diz hizasında → el desteği yok, klibin son yarısı (bacaklar açılır, öndeki ayak tepeye basar, üstüne yükselir)
      // ileri: destek elinin (kenarın elIleri kadar içinde) klipteki yerine göre kök; tam aşmada el 0,20'de basar, gövde üstünden öne geçer
      T.sK = tam ? [[.07, T.sF], [.2, Math.max(T.sF, -.18)], [.267, -.01], [.333, .15], [.4, .2], [TAUSON, h.sB]] : adim ? [[.42, T.sF], [.5, Math.max(T.sF, -.2)], [TAUSON, h.sB]] : [[.27, T.sF], [.43, Math.max(T.sF, .16)], [TAUSON, h.sB]];
      T.sure = adim ? .34 : tam ? (K.asSure + K.asSureY * clamp(r0, .5, 1.4)) * (1 - .24 * clamp(T.v0 / SO.tune.jog, 0, 1)) : K.ustSure; }
    else if (f === 'cik') T.sure = K.cikis;
  }
  // anahtarlardan geçen yumuşak eğri (Catmull-Rom, eşit aralıklı olmayan anahtarlar; uçlarda sabit)
  function egri(k, t) { const n = k.length; if (t <= k[0][0]) return k[0][1]; if (t >= k[n - 1][0]) return k[n - 1][1]; let i = 0; while (t > k[i + 1][0]) i++;
    const a = k[i], b = k[i + 1], h = b[0] - a[0], u = (t - a[0]) / h, m = j => j <= 0 || j >= n - 1 ? 0 : (k[j + 1][1] - k[j - 1][1]) / (k[j + 1][0] - k[j - 1][0]);
    const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * a[1] + (u3 - 2 * u2 + u) * h * m(i) + (-2 * u3 + 3 * u2) * b[1] + (u3 - u2) * h * m(i + 1); }
  /* Aşma (ClimbUp_1m) için kökün tepeye göre yeri, klip zamanına bağlı. R: kök tepeden kaç m aşağıda. 0,27–0,37 arası destek: sol bilek (kök
     uzayında 0,67–0,72) ve karna çekili ayaklar (0,53–0,62) tepe hizasında → 0,54. Sonra öne atılan sol ayak (parmak 0,44 → 0,03) tepeye basar
     ve bacak açılırken kök onun üstünde yükselir (ayak tepede sabit kalır): R = parmağın kök uzayındaki yüksekliği. */
  const RK = [[.27, .54], [.37, .54], [.47, .42], [.5, .39], [.533, .35], [.567, .28], [.6, .16], [.633, .05], [.667, 0]], DESTEK = .54, TAUSON = .664;

  D.dene = function (ctx) { // zıplama katmanı çağırır (yerdeyken zıplama isteği): true = tırmanış başladı, zıplama yapılmaz
    const ps = ctx.ps; if (!K.on || T.on || ps.yuzme || ps.kilit || !ps.grounded) return false;
    const it = ps.wantMag > .2, dx = it ? ps.wantX : Math.sin(ps.yaw), dz = it ? ps.wantZ : Math.cos(ps.yaw);
    const h = hedefBul(ctx, dx, dz, K.menzil + K.menzilHiz * ps.speed + .3); if (!h || h.yuk > K.boy) return false;
    if (h.yuk < K.diz) { if (h.uzak < 1.6) yardim = { h, t: 0, havada: false }; return false; }
    if (h.uzak > K.menzil + K.menzilHiz * ps.speed) return false;
    return basla(ctx, h, false);
  };

  function bitir(ps) { // kilidi bırak: üstte, yerde
    const h = T.h, it = ps.wantMag > .2 && ps.wantX * h.fx + ps.wantZ * h.fz > 0, v = it ? Math.min(2.2, 1.2 + T.v0 * .3) : 0;
    ps.kilit = false; ps.x = h.bx; ps.z = h.bz; ps.y = ps.groundY = h.top; ps.vy = 0; ps.vx = h.fx * v; ps.vz = h.fz * v; ps.speed = v; ps.grounded = true; ps.airTime = 0; ps.fallSpeed = 0;
    ps.leanFwd = 0; ps.lean = 0; ps.yawRate = 0;
  }

  function update(ctx, dt) {
    const ps = ctx.ps;
    /* --- diz boyu: zıplayınca kayanın üstüne konması için ileri hız --- */
    if (yardim) { const y = yardim, h = y.h; y.t += dt; if (!ps.grounded) y.havada = true;
      if (y.t > 1.2 || (y.havada && ps.grounded) || ps.kilit || ps.yuzme) yardim = null;
      else if (y.havada && ps.y < h.top + .6) { const vf = ps.vx * h.fx + ps.vz * h.fz, iste = ps.wantMag < .15 || ps.wantX * h.fx + ps.wantZ * h.fz > .3;
        const s = (ps.x - h.ex) * h.fx + (ps.z - h.ez) * h.fz; // kutu yüzüne göre (eksi = önünde)
        if (iste && s < .5) { const gerek = clamp((.75 - s) / .34, 1.6, K.dizHiz); if (vf < gerek) { ps.vx += h.fx * (gerek - vf); ps.vz += h.fz * (gerek - vf); } } } }
    /* --- havada tutunma --- */
    if (!T.on && K.on && !ps.grounded && !ps.kilit && !ps.yuzme && dt > 0) {
      const bas = SO.time - (ps.jumpBasAt == null ? -9 : ps.jumpBasAt) < K.havaBasis && ps.airTime > .08, it = ps.wantMag > .2;
      if (it || bas) { const dx = it ? ps.wantX : Math.sin(ps.yaw), dz = it ? ps.wantZ : Math.cos(ps.yaw), h = hedefBul(ctx, dx, dz, K.havaUzak);
        if (h && h.yuk >= K.havaAlt && h.yuk <= K.havaUst && h.uzak <= K.havaUzak && (bas || ps.vx * h.fx + ps.vz * h.fz > -.5)) basla(ctx, h, true); } }

    if (T.on) {
      const h = T.h; T.t += dt; let u = clamp(T.t / T.sure, 0, 1); const px = ps.x, pz = ps.z;
      let hedefTb = 1, lat = 0, yaw = T.yawT, lean = 0;
      if (T.faz === 'hiza') { const e = ss(0, 1, u); T.s = lerp(T.s0, T.sH, e); lat = 1 - e; yaw = T.yaw0 + wrapA(T.yawT - T.yaw0) * e; T.y = T.y0;
        if (T.tur === 'boy') { T.wCr = 1; T.wAs = 0; T.wTr = 0; } else { T.wCr = 0; T.wAs = 0; T.wTr = 1; T.tau = .05 * u; }
        if (u >= 1) fazaGir(T.tur === 'boy' ? 'sicra' : 'as');
      } else if (T.faz === 'sicra') { // yerden: itiş (hızlı kalkış, tepeye doğru yavaşlar); havadan: asılma hizasına yumuşak geçiş
        const e = T.havada ? ss(0, 1, u) : 1 - (1 - u) * (1 - u); T.y = lerp(T.yF, T.yA, e);
        if (T.havada) { const sT = yuz(h, T.yA + .3) - K.govde; T.s = lerp(T.sF, sT, e); lat = 1 - e; yaw = T.yaw0 + wrapA(T.yawT - T.yaw0) * e; T.wCr = 0; T.wAs = 1; }
        else { T.s = yuz(h, T.y + .3) - K.govde; T.wAs = ss(0, .45, u); T.wCr = 1 - T.wAs; }
        T.wTr = 0; T.ikR = ss(.15, .78, u); T.ikL = ss(.38, 1, u);
        if (u >= 1) fazaGir('asil');
      } else if (T.faz === 'asil') { // ağırlık kollara oturur: küçük çökme, sonra kısa bekleme
        T.y = T.yF - K.cokme * (1 - Math.exp(-u * 5)) / (1 - Math.exp(-5)); T.s = yuz(h, T.y + .3) - K.govde; T.wAs = 1; T.wCr = T.wTr = 0; T.ikL = T.ikR = 1;
        if (u >= 1) fazaGir('cek');
      } else if (T.faz === 'cek') { // çekiliş: ağır başlar, hızlanır, göğüs kenara gelince yavaşlar
        const e = u * u * u * (u * (u * 6 - 15) + 10); T.y = lerp(T.yF, T.yC, e); const sT = yuz(h, T.y + .3) - K.govde;
        if (T.tur === 'bel') { const g = ss(0, .4, u); T.s = lerp(T.sF, sT, g); lat = 1 - g; yaw = T.yaw0 + wrapA(T.yawT - T.yaw0) * g; T.ikL = T.ikR = ss(.1, .55, u); } // havadan, alçak kenar
        else { T.s = sT; T.ikL = T.ikR = 1; }
        T.wTr = ss(.3, .9, u); T.wAs = 1 - T.wTr; T.wCr = 0; T.tau = .27; // dizler karna: destek pozuna
        if (u >= 1) fazaGir('as');
      } else if (T.faz === 'as') { // üste aşma: ClimbUp_1m; kök önce yukarı, ayaklar tepeyi geçince öne
        const tau = lerp(T.tau0, TAUSON, u), tam = T.tau0 < .1; T.tau = tau; T.wTr = 1; T.wAs = T.wCr = 0;
        const yuksel = T.r0 > DESTEK ? T.r0 - (T.r0 - DESTEK) * ss(.07, .27, tau) : T.r0; // itişle destek hizasına
        T.y = h.top - (tau < .27 ? yuksel : Math.min(yuksel, egri(RK, tau))); T.s = egri(T.sK, tau);
        if (tam) { T.ikL = ss(.12, .2, tau) * (1 - ss(.37, .46, tau)); T.ikR = 0; }
        else if (T.adim) { T.ikL = T.ikR = 0; if (T.havada && T.tur === 'bel') { const g = ss(0, .5, u); lat = 1 - g; yaw = T.yaw0 + wrapA(T.yawT - T.yaw0) * g; } }
        else { T.ikL = 1 - ss(.4, .5, tau); T.ikR = 1 - ss(.3, .4, tau); }
        if (u >= 1) { bitir(ps); fazaGir('cik'); }
      } else if (T.faz === 'cik') { hedefTb = 0; T.tau = TAUSON; T.ikL = T.ikR = 0;
        if (u >= 1 || !ps.grounded) { T.on = false; T.faz = ''; T.tur = ''; } }

      if (ps.kilit && T.faz !== 'cik') {
        // eğik yüzde gövde yüze yatar (kök ayak tabanından döner): omuzlar kenarın dibinde kalsın
        if (T.faz === 'sicra' || T.faz === 'asil' || T.faz === 'cek') lean = clamp(Math.atan2(-K.govde - T.s, 1.41), 0, .3) * (T.faz === 'sicra' ? u : 1);
        else if (T.faz === 'as') lean = T.leanF * (1 - ss(0, .35, u));
        if (T.faz === 'cek' && T.tur === 'bel') lean *= ss(0, .4, u);
        if (T.faz !== 'as') T.leanF = lean; T.lean = lean;
        const l = T.l0 * lat; ps.x = h.ex + h.fx * T.s + h.fz * l; ps.z = h.ez + h.fz * T.s - h.fx * l; ps.y = T.y; ps.yaw = wrapA(yaw); ps.yawRate = 0; ps.lean = 0;
        ps.leanFwd = T.faz === 'hiza' ? lerp(T.lean0, 0, u) : lean;
        if (dt > 0) { ps.vx = (ps.x - px) / dt; ps.vz = (ps.z - pz) / dt; } ps.vy = 0; ps.grounded = false;
        // sesler
        if (!T.sesR && T.ikR > .97) { T.sesR = true; SO.ses.olay('tutun', {}); }
        if (!T.sesL && T.ikL > .97) { T.sesL = true; SO.ses.olay('tutun', {}); }
        if (!T.sesT && (T.faz === 'cek' || (T.faz === 'as' && T.tau > .22 && !T.adim))) { T.sesT = true; SO.ses.olay('tirman', { yukseklik: T.yuk }); }
      }
      T.tb = hedefTb ? Math.min(1, T.tb + dt / .11) : Math.max(0, T.tb - dt / K.cikis);
    } else if (T.tb > 0) T.tb = Math.max(0, T.tb - dt / K.cikis);

    const top = (T.wCr + T.wAs + T.wTr) || 1, tb = T.tb * T.tb * (3 - 2 * T.tb);
    aTr.time = T.tau; aTr.setEffectiveWeight(tb * T.wTr / top); aCr.setEffectiveWeight(tb * T.wCr / top); aAs.setEffectiveWeight(tb * T.wAs / top);
    ps.tirmanBlend = tb; ps.tirmanFaz = T.on ? T.faz : ''; if (!T.on) ps.tirman = '';
    if (tb > 0) { ps.airBlend = Math.max(ps.airBlend || 0, tb); ps.ikKapat = Math.max(ps.ikKapat || 0, tb); }
  }

  /* ---------- kollar: iki kemikli ters kinematik, dünya uzayında (kemik eksenleri varsayılmaz) ---------- */
  const A = new T3.Vector3(), B = new T3.Vector3(), C = new T3.Vector3(), Hd = new T3.Vector3(), Yon = new T3.Vector3(), Kut = new T3.Vector3(), Dir = new T3.Vector3(), E2 = new T3.Vector3(), P1 = new T3.Vector3(), P2 = new T3.Vector3();
  const qW = new T3.Quaternion(), qR = new T3.Quaternion(), qI = new T3.Quaternion(), qK = new T3.Quaternion(), M1 = new T3.Matrix4(), M2 = new T3.Matrix4(), f1 = new T3.Vector3(), s1 = new T3.Vector3(), n1 = new T3.Vector3();
  function dunyaDon(kemik, q) { kemik.parent.getWorldQuaternion(qW); qI.copy(qW).invert(); kemik.quaternion.premultiply(qW).premultiply(q).premultiply(qI); kemik.updateMatrixWorld(true); }
  function taban(M, f, s) { f1.copy(f).normalize(); n1.crossVectors(f1, s).normalize(); s1.crossVectors(n1, f1); M.makeBasis(f1, s1, n1); }
  function kol(b, yan, hedef, kutup, parmak, basYon, w) { // yan: 'l' | 'r'; hedef: bileğin dünya konumu; parmak: parmakların yönü; basYon: işaret parmağı tarafı
    const ust = b['upperarm_' + yan], alt = b['lowerarm_' + yan], el = b['hand_' + yan]; if (!ust || !alt || !el || w < .002) return;
    ust.getWorldPosition(A); alt.getWorldPosition(B); el.getWorldPosition(C);
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C); Hd.copy(C).lerp(hedef, w); Hd.y += .16 * Math.sin(Math.PI * w); // el kenara yukarıdan iner, bırakırken kalkar (kayanın içinden süzülmez)
    Dir.subVectors(Hd, A); const d = clamp(Dir.length(), Math.abs(l1 - l2) + .01, (l1 + l2) * .995); Dir.normalize();
    const ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
    // dirsek: hedef yönüne dik düzlemde kutup yönü ile şimdiki dirsek yönünün karışımı
    Yon.subVectors(B, A); Yon.addScaledVector(Dir, -Yon.dot(Dir)); Kut.copy(kutup).addScaledVector(Dir, -kutup.dot(Dir));
    if (Kut.lengthSq() < 1e-6) Kut.copy(Yon); Kut.normalize(); if (Yon.lengthSq() > 1e-6) { Yon.normalize(); Kut.multiplyScalar(w).addScaledVector(Yon, 1 - w); } Kut.normalize();
    E2.copy(A).addScaledVector(Dir, l1 * ca).addScaledVector(Kut, l1 * sa);
    P1.subVectors(B, A).normalize(); P2.subVectors(E2, A).normalize(); qR.setFromUnitVectors(P1, P2); dunyaDon(ust, qR);
    alt.getWorldPosition(B); el.getWorldPosition(C); Hd.copy(A).addScaledVector(Dir, d);
    P1.subVectors(C, B).normalize(); P2.subVectors(Hd, B).normalize(); qR.setFromUnitVectors(P1, P2); dunyaDon(alt, qR);
    // el: avuç aşağı, parmaklar içeri
    const orta = b['middle_01_' + yan], isaret = b['index_01_' + yan], serce = b['pinky_01_' + yan]; if (!orta || !isaret || !serce) return;
    el.getWorldPosition(C); orta.getWorldPosition(P1).sub(C); isaret.getWorldPosition(P2); serce.getWorldPosition(E2); P2.sub(E2);
    taban(M1, P1, P2); taban(M2, parmak, basYon); M2.multiply(M1.transpose()); qR.setFromRotationMatrix(M2); qK.set(0, 0, 0, 1).slerp(qR, w); dunyaDon(el, qK);
  }
  const hL = new T3.Vector3(), hR = new T3.Vector3(), kL = new T3.Vector3(), kR = new T3.Vector3(), pr = new T3.Vector3(), yL = new T3.Vector3(), yR = new T3.Vector3();
  function kolPost(ctx) {
    if (!T.on || (T.ikL < .002 && T.ikR < .002)) return;
    const ps = ctx.ps, h = T.h, kok = ctx.char.root, b = ctx.bones, lx = h.fz, lz = -h.fx;
    kok.position.set(ps.x, ps.y + (ps.rootDy || 0), ps.z); kok.rotation.order = 'YXZ'; kok.rotation.set(ps.leanFwd || 0, ps.yaw, ps.lean || 0); kok.updateMatrixWorld(true);
    // asılıyken parmaklar kenara takılır (bilek kenarın hemen içinde); destekte avuç kenarın elIleri kadar içine basar
    const ustte = ss(h.top - 1.25, h.top - .9, ps.y), il = lerp(.035, K.elIleri, ustte);
    hL.set(h.ex + h.fx * (h.eL + il) + lx * K.elYan, h.yL + K.elYuk, h.ez + h.fz * (h.eL + il) + lz * K.elYan);
    hR.set(h.ex + h.fx * (h.eR + il) - lx * K.elYan, h.yR + K.elYuk, h.ez + h.fz * (h.eR + il) - lz * K.elYan);
    // dirsek kutbu: asılıyken dışa ve hafif aşağı; destekte (omuz elin üstünde) dışa ve geriye
    const dis = lerp(.9, .55, ustte), geri = lerp(.15, .85, ustte), asagi = lerp(.45, 0, ustte);
    kL.set(lx * dis - h.fx * geri, -asagi, lz * dis - h.fz * geri); kR.set(-lx * dis - h.fx * geri, -asagi, -lz * dis - h.fz * geri);
    pr.set(h.fx, -.08, h.fz); yL.set(-lx, 0, -lz); yR.set(lx, 0, lz);
    kol(b, 'l', hL, kL, pr, yL, T.ikL); kol(b, 'r', hR, kR, pr, yR, T.ikR);
  }

  SO.anim.register({ name: 'tirmanma', order: 24,
    init(ctx) { const ps = ctx.ps, m = ctx.mixer, kopya = (ad, t) => { const c = ctx.clips[ad].clone(); c.name = 'Tirman_' + ad; const a = m.clipAction(c); a.enabled = true; a.setEffectiveWeight(0); a.play(); if (t != null) { a.timeScale = 0; a.time = t; } return a; };
      aTr = ctx.action('ClimbUp_1m'); aTr.timeScale = 0; aCr = kopya('Jump_Start', 0); aAs = kopya('Jump_Loop');
      ps.tirmanBlend = 0; ps.tirman = ''; ps.tirmanFaz = ''; if (ps.kilit == null) ps.kilit = false; },
    update });
  SO.anim.register({ name: 'tirmanmaKol', order: 45, post: kolPost }); // ayak katmanından (40) sonra: omuzlar son yerindeyken eller kenara oturur
})();
