/* Burger Ustası: sesler ve müzik (BU.SES). 9. tur (21 Kasım): gerçek kayıtlar + hazır müzik, Web Audio ile.
   Dosyalar www/ses/*.mp3 (tools/ses/hazirla.py üretir; kaynak ve lisanslar www/ses/LISANS.md, hepsi CC0).
   Kurallar: whoosh/swoosh yok; her çalışta perde ±%5 ve ses ±1,5 dB oynar, varsa 2–3 kayıttan biri rastgele (üst üste aynısı değil).
   Dosya yüklenemezse o ses sessiz kalır, hata vermez. Döngüler (cızırtı, fritöz, müzik) AudioBufferSourceNode.loop ile
   loopStart/loopEnd arasında döner: dosyanın başında ve sonunda 0,5 sn sarma payı olduğu için MP3'ün baş gecikmesi döngüyü bozmaz.

   Arayüz:
     BU.SES.ac()                    ilk dokunuşta (iOS kilidi); bağlamı kurar, dosyaları bir kez yükler
     BU.SES.cal(ad, {perde, ses})   'bicak', 'para', 'kasa' …; perde yarım ton (kombo, doğrama gamı); bilinmeyen ad sessiz
     BU.SES.dongu(ad, seviye)       'cizirti' | 'fritoz': 0 susar, 0…1 ses düzeyi (yumuşak geçiş)
     BU.SES.muzikMod(mod)           'menu' | 'oyun' (yumuşak geçiş)
     BU.SES.yogun(var)              oyunda: 2'den fazla müşteri beklerken vurmalı katman 1 sn'de girer, azalınca çıkar
     BU.SES.muzik(acik)             müzik isteği (ayarda müzik açıksa çalar)
     BU.SES.ayar({efekt, muzik}), BU.SES.durdur(), BU.SES.durum()
   Test: BU.SES.durum() → yüklenen/hata sayısı, yükleme süresi, çalan döngüler; BU.SES._son (son çalınan 40 ses). */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : globalThis;
  var BU = W.BU = W.BU || {};
  var AC = W.AudioContext || W.webkitAudioContext;
  var KOK = W.BU_SES_KOK || 'ses/';   // deneme sayfası (tools/ses.html) '../www/ses/' verir

  /*LISTE>*/var LISTE={"sesler":{"cizirti":{"dongu":true,"pay":0.5,"uzunluk":4.69},"fritoz":{"dongu":true,"pay":0.5,"uzunluk":5.59},"fritoz_dal":{"dosya":["fritoz_dal"]},"fritoz_al":{"dosya":["fritoz_al"]},"hazir":{"dosya":["hazir"]},"bicak":{"dosya":["bicak1","bicak2","bicak3"]},"kon_ekmek":{"dosya":["kon_ekmek1","kon_ekmek2","kon_ekmek3"]},"kon_kofte":{"dosya":["kon_kofte1","kon_kofte2"]},"kon_peynir":{"dosya":["kon_peynir1","kon_peynir2","kon_peynir3"]},"kon_tursu":{"dosya":["kon_tursu1","kon_tursu2"]},"tepsi":{"dosya":["tepsi1","tepsi2","tepsi3"]},"servis":{"dosya":["servis1","servis2"]},"para":{"dosya":["para1","para2","para3"]},"kasa":{"dosya":["kasa"]},"dokun":{"dosya":["dokun"]},"tik":{"dosya":["tik"]},"uyari":{"dosya":["uyari"]},"tamam":{"dosya":["tamam"]},"gun_basla":{"dosya":["gun_basla"]},"gun_sonu":{"dosya":["gun_sonu"]},"satin":{"dosya":["satin"]}},"muzik":{"muzik_oyun_a":{"pay":0.5,"uzunluk":17.43063},"muzik_oyun_b":{"pay":0.5,"uzunluk":17.43063},"muzik_menu":{"pay":0.5,"uzunluk":83.46825}}};/*<LISTE*/

  // ses düzeyleri (efektler müziğin belirgin üstünde)
  var SEV = { ana: 0.9, efekt: 0.9, muzik: 0.3 };
  var KAZ = { cizirti: 0.55, fritoz: 0.42, dokun: 0.5, tik: 0.55, uyari: 0.45, para: 0.55, kasa: 0.6, bicak: 0.75, hazir: 0.5,
    kon_ekmek: 0.7, kon_kofte: 0.8, kon_peynir: 0.55, kon_tursu: 0.5, tepsi: 0.7, servis: 0.55, fritoz_dal: 0.7, fritoz_al: 0.6,
    tamam: 0.55, gun_basla: 0.6, gun_sonu: 0.7, satin: 0.65 };
  var JINGLE = { gun_basla: 1, gun_sonu: 1, satin: 1 };

  var ctx = null, Z = null, buf = {}, yukDurum = { toplam: 0, yuklenen: 0, hata: 0, t0: 0, sure: 0 }, yukBasladi = false;
  var ayarlar = { efekt: true, muzik: true }, muzikIstek = false, mod = 'menu', yogunVar = false;
  var donguler = {};     // ad → {istek, src, g}
  var mz = { mod: null, kaynak: [], g: null, gB: null };
  var sonVaryant = {}, sonCalis = {}, son = [];
  var simdi = function () { return (W.performance && performance.now) ? performance.now() : Date.now(); };

  function dosyalar() {
    var a = [];
    Object.keys(LISTE.sesler).forEach(function (k) { var s = LISTE.sesler[k]; if (s.dongu) a.push(k); else s.dosya.forEach(function (f) { a.push(f); }); });
    Object.keys(LISTE.muzik).forEach(function (k) { a.push(k); });
    return a;
  }
  function coz(ab) {
    return new Promise(function (res, rej) {
      try { var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
    });
  }
  function yukle() {
    if (yukBasladi || !ctx || !W.fetch) return;
    yukBasladi = true;
    var a = dosyalar(); yukDurum.toplam = a.length; yukDurum.t0 = simdi();
    // önce kısa efektler, sonra müzik (büyük dosyalar)
    a.forEach(function (f) {
      fetch(KOK + f + '.mp3').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(coz).then(function (b) { buf[f] = b; yukDurum.yuklenen++; bitti(); hazirOldu(f); })
        .catch(function () { yukDurum.hata++; bitti(); });
    });
  }
  function bitti() { if (yukDurum.yuklenen + yukDurum.hata >= yukDurum.toplam) yukDurum.sure = Math.round(simdi() - yukDurum.t0); }
  function hazirOldu(f) {
    if (LISTE.sesler[f] && LISTE.sesler[f].dongu) donguUygula(f);
    if (LISTE.muzik[f]) guncelleMuzik();
  }

  function kur() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    var ana = ctx.createGain(); ana.gain.value = SEV.ana;
    var efx = ctx.createGain(); efx.gain.value = ayarlar.efekt ? SEV.efekt : 0;
    var muz = ctx.createGain(); muz.gain.value = 0;
    var duk = ctx.createGain(); duk.gain.value = 1;     // jingle çalarken müzik kısılır
    efx.connect(ana); muz.connect(duk); duk.connect(ana);
    var comp = ctx.createDynamicsCompressor();
    try { comp.threshold.value = -6; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15; } catch (e) {}
    ana.connect(comp); comp.connect(ctx.destination);
    Z = { ana: ana, efx: efx, muz: muz, duk: duk };
    return true;
  }
  function ac() {
    if (!kur()) return;
    if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} }
    // iOS: ilk dokunuşta sessiz bir tampon çal (kilidi açar)
    try { var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
    yukle();
    guncelleMuzik();
  }
  function hazir() { return !!ctx && ctx.state === 'running'; }

  // ---------- efektler ----------
  function cal(ad, o) {
    o = o || {};
    if (!ayarlar.efekt || !ctx) return;
    var tanim = LISTE.sesler[ad];
    if (!tanim || tanim.dongu) return;
    var tn = simdi();
    if (!o.ust && sonCalis[ad] != null && tn - sonCalis[ad] < 25) return;
    var d = tanim.dosya, i = 0;
    if (d.length > 1) { do { i = Math.floor(Math.random() * d.length); } while (i === sonVaryant[ad] && d.length > 1); }
    sonVaryant[ad] = i;
    var b = buf[d[i]];
    son.push({ ad: ad, perde: o.perde || 0, t: Math.round(tn), var: !!b }); if (son.length > 40) son.shift();
    if (!b || !hazir()) return;
    sonCalis[ad] = tn;
    try {
      var s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = b;
      var oyna = o.sabit ? 0 : (Math.random() * 2 - 1) * 0.05;
      s.playbackRate.value = Math.pow(2, (o.perde || 0) / 12) * (1 + oyna);
      var db = o.sabit ? 0 : (Math.random() * 2 - 1) * 1.5;
      g.gain.value = (KAZ[ad] || 0.6) * (o.ses == null ? 1 : o.ses) * Math.pow(10, db / 20);
      s.connect(g); g.connect(Z.efx);
      s.start(ctx.currentTime + (o.gec || 0));
      s.onended = function () { try { g.disconnect(); } catch (e) {} };
      if (JINGLE[ad]) duk(b.duration);
    } catch (e) {}
  }
  function duk(sn) {
    if (!Z) return;
    var g = Z.duk.gain, t = ctx.currentTime;
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.35, t + 0.08); g.setValueAtTime(0.35, t + sn); g.linearRampToValueAtTime(1, t + sn + 0.6); } catch (e) {}
  }

  // ---------- döngüler: cızırtı, fritöz ----------
  function dongu(ad, seviye) {
    if (!LISTE.sesler[ad] || !LISTE.sesler[ad].dongu) return;
    var d = donguler[ad] || (donguler[ad] = { istek: 0, src: null, g: null });
    d.istek = Math.max(0, Math.min(1, +seviye || 0));
    donguUygula(ad);
  }
  function donguUygula(ad) {
    var d = donguler[ad]; if (!d || !ctx) return;
    var b = buf[ad], t = ctx.currentTime, hedef = d.istek * (KAZ[ad] || 0.5);
    if (hedef > 0 && !d.src && b) {
      var tn = LISTE.sesler[ad];
      try {
        var s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = b; s.loop = true; s.loopStart = tn.pay; s.loopEnd = tn.pay + tn.uzunluk;
        g.gain.value = 0; s.connect(g); g.connect(Z.efx);
        s.start(t, tn.pay + Math.random() * tn.uzunluk * 0.9);
        d.src = s; d.g = g;
      } catch (e) { return; }
    }
    if (!d.g) return;
    try { d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(hedef, t + (hedef > 0 ? 0.15 : 0.25)); } catch (e) {}
    if (hedef === 0) {
      var s0 = d.src, g0 = d.g; d.src = null; d.g = null;
      try { s0.stop(t + 0.3); } catch (e) {}
      setTimeout(function () { try { g0.disconnect(); } catch (e) {} }, 400);
    }
  }
  function donguleriSustur() { Object.keys(donguler).forEach(function (k) { donguler[k].istek = 0; donguUygula(k); }); }

  // ---------- müzik ----------
  function caliyorMu() { return ayarlar.muzik && muzikIstek; }
  function mzKaynak(ad, t0, g) {
    var b = buf[ad], tn = LISTE.muzik[ad];
    var s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.loopStart = tn.pay; s.loopEnd = tn.pay + tn.uzunluk;
    s.connect(g); s.start(t0, tn.pay); return s;
  }
  function mzDur(sure) {
    if (!mz.mod) return;
    var t = ctx.currentTime, g = mz.g, ks = mz.kaynak;
    try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + sure); } catch (e) {}
    ks.forEach(function (s) { try { s.stop(t + sure + 0.05); } catch (e) {} });
    setTimeout(function () { try { g.disconnect(); } catch (e) {} }, (sure + 0.2) * 1000);
    mz = { mod: null, kaynak: [], g: null, gB: null };
  }
  function mzBasla() {
    var gerek = mod === 'oyun' ? ['muzik_oyun_a', 'muzik_oyun_b'] : ['muzik_menu'];
    if (!gerek.every(function (f) { return buf[f]; })) return;   // yüklenince guncelleMuzik yeniden çağrılır
    var t = ctx.currentTime + 0.05, g = ctx.createGain(); g.gain.value = 0; g.connect(Z.muz);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 1.2);
    var ks = [mzKaynak(gerek[0], t, g)], gB = null;
    if (mod === 'oyun') {
      gB = ctx.createGain(); gB.gain.value = yogunVar ? 1 : 0.18; gB.connect(g);
      ks.push(mzKaynak(gerek[1], t, gB));   // aynı anda başlar, aynı uzunluk: katmanlar hep eş
    }
    mz = { mod: mod, kaynak: ks, g: g, gB: gB };
  }
  function guncelleMuzik() {
    if (!ctx || !Z) return;
    var t = ctx.currentTime, hedef = caliyorMu() ? SEV.muzik : 0;
    try { Z.muz.gain.cancelScheduledValues(t); Z.muz.gain.setValueAtTime(Z.muz.gain.value, t); Z.muz.gain.linearRampToValueAtTime(hedef, t + 0.4); } catch (e) {}
    if (!caliyorMu()) { if (mz.mod) setTimeout(function () { if (!caliyorMu()) mzDur(0.1); }, 450); return; }
    if (mz.mod && mz.mod !== mod) mzDur(0.6);
    if (!mz.mod) mzBasla();
  }
  function muzik(acik) { muzikIstek = !!acik; guncelleMuzik(); }
  function muzikMod(m) { m = m === 'oyun' ? 'oyun' : 'menu'; if (m === mod) return; mod = m; if (m !== 'oyun') yogunVar = false; guncelleMuzik(); }
  function yogun(v) {
    v = !!v; if (v === yogunVar) return; yogunVar = v;
    if (mz.gB) { var t = ctx.currentTime, g = mz.gB.gain; try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v ? 1 : 0.18, t + (v ? 1 : 1.6)); } catch (e) {} }
  }

  function ayar(o) {
    o = o || {};
    if ('efekt' in o) {
      ayarlar.efekt = !!o.efekt;
      if (ctx) { var g = Z.efx.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(ayarlar.efekt ? SEV.efekt : 0, t + 0.05); }
      if (!ayarlar.efekt) donguleriSustur();
    }
    if ('muzik' in o) { ayarlar.muzik = !!o.muzik; guncelleMuzik(); }
  }
  function durdur() { muzikIstek = false; if (!ctx) return; donguleriSustur(); mzDur(0.15); }
  function durum() {
    var d = {}; Object.keys(donguler).forEach(function (k) { d[k] = { istek: donguler[k].istek, caliyor: !!donguler[k].src }; });
    return { bagli: !!ctx, durum: ctx ? ctx.state : 'yok', efekt: ayarlar.efekt, muzik: ayarlar.muzik, muzikIstek: muzikIstek,
      mod: mod, muzikCaliyor: mz.mod, yogun: yogunVar, katmanB: mz.gB ? +mz.gB.gain.value.toFixed(2) : null,
      toplam: yukDurum.toplam, yuklenen: yukDurum.yuklenen, hata: yukDurum.hata, yukSure: yukDurum.sure, donguler: d };
  }

  // Görünmez olunca bağlamı uyut, dönünce sürdür
  var gizliDur = false;
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) { if (ctx.state === 'running') { gizliDur = true; try { ctx.suspend(); } catch (e) {} } }
      else if (gizliDur || ctx.state !== 'running') { gizliDur = false; try { ctx.resume(); } catch (e) {} }
    });
  }

  var ADLAR = Object.keys(LISTE.sesler);
  BU.SES = { ac: ac, cal: cal, dongu: dongu, muzik: muzik, muzikMod: muzikMod, yogun: yogun, ayar: ayar, durdur: durdur, durum: durum,
    ADLAR: ADLAR, LISTE: LISTE, _son: son, _buf: buf };
})();
