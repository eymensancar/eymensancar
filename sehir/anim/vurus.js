/* Vuruş katmanı (order 28): kesme, kazma, yumruk, mızrak saplama, yeme. Neye vurulacağına ve hasara `oyun.js` karar verir ve
   SO.vurAnim.basla(tur, hx, hz) çağırır; bu katman yalnız hareketi oynatır ve değme anını bildirir (S.deger bir kare true).

   KLİP ÖLÇÜMLERİ (kök sabit, sağ bilek konumu kök uzayında [sağ(−)/sol(+), yükseklik, ileri] m; 30 kare/sn):
   TreeChopping_Loop (0,967 sn; tam döngü; tek el, omuz üstünden öne inen kesme)
     0,00 bilek omuz arkasında yukarıda (−0,33, 1,66, −0,45) · 0,07–0,13 iniş (17 m/sn'ye kadar) · 0,167 DEĞME: bilek (−0,02, 1,07, 0,54), durur
     0,17–0,33 alet hedefte bekler · 0,37–0,70 geri çekiş (bilek yeniden omuz üstüne) · 0,70–0,967 yukarıda toplanma (sonraki vuruşun gerilmesi)
   Sword_Attack (1,533 sn; başı ve sonu aynı duruş; baş üstünden çapraz inen ağır vuruş)
     0,00–0,33 gerilme (bilek 0,90 → 1,59, başın arkasına) · 0,37–0,40 iniş (31 m/sn) · 0,433 DEĞME: bilek (−0,01, 0,88, 0,77), alet ileri bakar
     0,47–0,73 bilek solda aşağıda (0,5, 0,55, 0,33) bekler · 0,80–1,27 toparlanma · 1,27–1,53 duruş
   Punch_Cross (1,0 sn; başı ve sonu aynı gard duruşu; sağ düz yumruk)
     0,00–0,17 gard (bilek −0,23, 1,32, 0,10) · 0,20 yumruk çıkar · 0,25 DEĞME: bilek (−0,15, 1,36, 0,66), kol düz, parmak kemiği tam ileri
     0,27–0,50 kol uzanmış bekler · 0,53–1,00 gard'a dönüş
   Consume (1,333 sn; SOL el ağza): 0,13–0,40 el kalkar · 0,47 EL AĞIZDA (0,28, 1,49, 0,53) · 0,47–0,93 bekler · 1,00–1,27 iner
   Sağ el kemiği (hand_r) eksenleri: +Y parmak yönü, −X avuç içi, +Z başparmak tarafı (sap bu eksende durur; oyun.js aleti buna göre bağlar).
   Melee_Hook ölçüldü, kullanılmadı: dönerek atılan alçak bir kroşe (bilek 0,69 m'de, gövde 1,4 m öne atılıyor); yerinde vuruş için uygun değil.

   ZAMAN ÇİZELGESİ (düğmeye basıştan; duran karakter; 60 kare/sn'de ölçüldü; hız çarpanları T.tur içinde):
     tür      klip                ilk değme   art arda vuruş aralığı   bırakınca çıkış
     balta    TreeChopping_Loop   0,50 sn     0,88 sn                  değmeden 0,18 sn sonra karışarak çıkar
     kazma    Sword_Attack        0,35 sn     0,90 sn                  değmeden 0,15 sn sonra
     yumruk   Punch_Cross         0,15 sn     0,63 sn                  değmeden 0,17 sn sonra
     mizrak   Punch_Cross         0,15 sn     0,73 sn                  değmeden 0,20 sn sonra
     ye       Consume             0,35 sn     1,00 sn                  ağza değdikten 0,35 sn sonra
   Vuruş: `ilk` anından başlar, `deg` anında S.deger; `cik` anına gelince düğme hâlâ basılıysa (basla yeniden çağrılmışsa) klip sonuna
   kadar oynar ve başa sarar (döngü klibinde 0'a, ötekilerde `ilk`e: iki uçtaki duruş aynı), basılı değilse taban harekete karışarak çıkar.

   Yazdığı alanlar: ps.vur (vuruş sürüyor mu), ps.vurTur ('' | 'balta' | 'kazma' | 'yumruk' | 'mizrak' | 'ye'), ps.vurBlend (0..1; tam beden
   klibinin payı), ps.vurYavas (hız çarpanı 0..1; 1 = kısma yok. FİZİK OKUMALI: hedef hız bununla çarpılır, `ps.toplaYavas` gibi).
   Her kare ps.airBlend = max(ps.airBlend, ps.vurBlend): taban hareket (hareket.js) böyle bastırılır (tırmanma/toplamadaki yol). ps.ikKapat'a
   dokunmaz (ayak yerleştirme açık). Çubuk itilmiyorken ps.yaw'ı hedefe çevirir. Yerden kesilince, yüzünce, ps.kilit gelince, yerden alma
   başlayınca iptal olur (S.iptal bir kare true). Kemiklere elle dokunmaz; ama payı varken karıştırıcıyı her kemiği her kare yeniden yazmaya zorlar (update içindeki not). Ayarlar SO.tune.vurus, ölçüm SO.vurAnim.durum. */
(function () {
  'use strict';
  const SO = window.SO, clamp = SO.clamp, wrapA = SO.wrapA;
  const T = SO.tune.vurus = Object.assign({
    on: true, gir: .1, cik: .22,          // taban hareketin yerini alma / geri bırakma süresi (sn)
    donHiz: 9, donK: 14,                  // hedefe dönme: en çok rad/sn, yaklaşma hızı (1/sn)
    /* klip: ad · ilk: ilk vuruşun başladığı klip anı · deg: değme anı · cik: basılı değilse çıkışın başladığı an · son: klip sonu
       dongu: klip kendi üstüne kapanıyor mu (sarınca 0'dan sürer) · hizOn / hizSon: değmeden önce / sonra oynatma hızı · yavas: yürüme hızı çarpanı */
    tur: {
      balta:  { klip: 'TreeChopping_Loop', ilk: .62, deg: .167, cik: .36, son: .967, dongu: true, hizOn: 1.1, hizSon: 1.1, yavas: .12 },
      kazma:  { klip: 'Sword_Attack', ilk: .05, deg: .433, cik: .72, son: 1.533, hizOn: 1.15, hizSon: 1.95, yavas: .12 },
      yumruk: { klip: 'Punch_Cross', ilk: .12, deg: .25, cik: .5, son: 1.0, hizOn: 1, hizSon: 1.5, yavas: .2 },
      mizrak: { klip: 'Punch_Cross', ilk: .12, deg: .25, cik: .5, son: 1.0, hizOn: 1, hizSon: 1.27, yavas: .15 },
      ye:     { klip: 'Consume', ilk: .05, deg: .47, cik: .93, son: 1.333, hizOn: 1.3, hizSon: 1.3, yavas: .5 }
    }
  }, SO.tune.vurus || {});

  const akt = {}; // klip adı → oynatıcı
  // faz: 'on' (değmeden önce) | 'sonra' (değdi; çıkış anına kadar) | 'don' (sıradaki vuruşa sarıyor) | 'cik' (taban harekete karışıyor)
  const S = { on: false, tur: '', faz: '', t: 0, kalan: 0, w: 0, uyg: 0, sonraki: 0, devam: false, deger: false, iptal: false, hx: 0, hz: 0, hedefVar: false, sayi: 0 };

  function uygun(ps) { return T.on && ps.grounded && !ps.yuzme && !ps.kilit && !(ps.tirmanBlend > .01) && !ps.jumpPhase && !ps.topla && !(ps.suDerin > .9); }
  const hedefYaz = (hx, hz) => { S.hedefVar = hx != null && hz != null; if (S.hedefVar) { S.hx = hx; S.hz = hz; } };
  /* vuruşu başlat ya da (aynı türde, değdikten sonra) sıradaki vuruşu iste. (hx, hz): dönülecek hedef (dünya; yoksa null).
     true dönerse yeni bir vuruş başladı ya da sıraya girdi; her vuruşun değme karesinde S.deger true olur. */
  function basla(tur, hx, hz) {
    const ps = SO.ps, D = T.tur[tur]; if (!D || !uygun(ps)) return false;
    if (S.on) {
      if (tur !== S.tur) return false;
      if (S.faz === 'sonra') { if (S.devam) return false; S.devam = true; hedefYaz(hx, hz); return true; }
      if (S.faz === 'cik' && S.w > .35) { S.faz = 'don'; hedefYaz(hx, hz); return true; }
      if (S.faz !== 'cik') return false;
    }
    S.on = true; S.tur = tur; S.faz = 'on'; S.t = D.ilk; S.kalan = D.deg - D.ilk + (D.ilk > D.deg ? D.son : 0); S.devam = false; S.deger = false; hedefYaz(hx, hz);
    return true;
  }
  const hazir = tur => uygun(SO.ps) && (!S.on || (tur === S.tur && ((S.faz === 'sonra' && !S.devam) || S.faz === 'cik')));

  function update(ctx, dt) {
    const ps = ctx.ps; S.deger = false; S.iptal = false; S.uyg = S.sonraki;
    const D = T.tur[S.tur];
    if (S.on && D) {
      if (!ps.grounded || ps.yuzme || ps.kilit || ps.topla) { S.faz = 'cik'; S.iptal = true; S.devam = false; }
      const ilerle = dt * (S.faz === 'on' ? D.hizOn : D.hizSon);
      if (S.faz === 'on') { S.kalan -= ilerle; S.t += ilerle; if (S.t >= D.son) S.t -= D.son; if (S.kalan <= 0) { S.faz = 'sonra'; S.deger = true; S.sayi++; } }
      else if (S.faz === 'sonra') { S.t += ilerle; if (S.t >= D.cik) { if (S.devam) { S.devam = false; S.faz = 'don'; } else S.faz = 'cik'; } }
      else if (S.faz === 'don') { S.t += ilerle; if (S.t >= D.son) { const bas = D.dongu ? S.t - D.son : D.ilk; S.t = bas; S.faz = 'on'; S.kalan = D.deg - bas; } }
      else { S.t = Math.min(D.son - .001, S.t + ilerle); } // 'cik': klip akmayı sürdürür, payı söner
    }
    const hedefW = S.on && S.faz !== 'cik' ? 1 : 0;
    S.w = clamp(S.w + (hedefW ? dt / T.gir : -dt / T.cik), 0, 1);
    if (S.on && S.faz === 'cik' && S.w <= 0) { S.on = false; S.faz = ''; }
    const tb = S.w * S.w * (3 - 2 * S.w);
    // taban hareket bu kareye geçen karede duyurulan payla girdi (hareket.js order 10): klip de o payla oynar, toplam hep 1 kalır
    /* three.js karıştırıcısı, bir kemiğin karışmış değeri önceki kareyle bit bit aynıysa kemiğe YAZMAZ. Klip bir duruşta beklerken (Consume'da el
       ağızdayken, kesmede alet hedefteyken) sonraki katmanların `post`ta eklediği dönüşler (durus.js) silinmez, kare kare birikir (gövde katlanır).
       Bu katmanın payı varken karıştırıcının "önceki değer" belleği bozulur: her kemik her kare yeniden yazılır. */
    if ((S.uyg > 0 || S.w > 0) && ctx.mixer._bindings) for (const b of ctx.mixer._bindings) { const n = b.valueSize, buf = b.buffer; if (buf && n && buf.length >= 3 * n) for (let i = n; i < 3 * n; i++) buf[i] = NaN; }
    for (const ad in akt) { const a = akt[ad], benim = D && D.klip === ad; a.setEffectiveWeight(benim ? S.uyg : 0); if (benim) a.time = clamp(S.t, 0, D.son - .001); }
    ps.vur = S.on && S.faz !== 'cik'; ps.vurTur = S.on ? S.tur : ''; ps.vurBlend = tb; ps.vurYavas = ps.vur && D ? D.yavas : 1;
    if (S.uyg > 0 || tb > 0) ps.airBlend = Math.max(ps.airBlend || 0, tb);
    S.sonraki = tb;
    // çubuk boşken hedefe dön
    if (S.on && S.hedefVar && (S.faz === 'on' || S.faz === 'don') && ps.wantMag < .08 && dt > 0) {
      const dx = S.hx - ps.x, dz = S.hz - ps.z, d = Math.hypot(dx, dz);
      if (d > .2) { const e = wrapA(Math.atan2(dx, dz) - ps.yaw), adim = clamp(e * (1 - Math.exp(-T.donK * dt)), -T.donHiz * dt, T.donHiz * dt); ps.yaw = wrapA(ps.yaw + adim); }
    }
  }

  SO.vurAnim = { basla, hazir, uygun: () => uygun(SO.ps), durum: S, TUR: T.tur };
  SO.anim.register({ name: 'vurus', order: 28,
    init(ctx) { const ps = ctx.ps; for (const k in T.tur) { const ad = T.tur[k].klip; if (!akt[ad] && ctx.clips[ad]) { const a = akt[ad] = ctx.action(ad); a.timeScale = 0; } }
      ps.vur = false; ps.vurTur = ''; ps.vurBlend = 0; ps.vurYavas = 1; },
    update, post() { } });
})();
