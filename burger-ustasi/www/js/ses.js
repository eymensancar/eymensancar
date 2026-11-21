/* Burger Ustası: sesler ve müzik (BU.SES).
   Hepsi Web Audio ile sentezlenir; ses dosyası yok.
   Kural: whoosh/swoosh, hava, süpürme gibi filtreli gürültü süpürmesi yok. Gürültü yalnız
   sabit filtreli kısa vuruşlarda (tık, cızırtı, zil, davul) kullanılır; filtre frekansı hiç kaymaz.

   Arayüz:
     BU.SES.ac()            ilk dokunuşta çağrılır (iOS kilidi; askıdaki bağlamı sürdürür)
     BU.SES.cal(ad)         'sec', 'birak:patty' ... bilinmeyen ad sessizce yok sayılır
     BU.SES.muzik(acik)     müzik isteği; ayarda müzik açıksa çalar, yumuşak açılır/kapanır
     BU.SES.ayar({efekt, muzik})
     BU.SES.durdur()        her şeyi susturur (müzik isteği de kalkar)
   Ek: BU.SES.ADLAR, BU.SES.seviye() (anlık tepe/rms), BU.SES.durum(),
       BU.SES._olc(ad, ham), BU.SES._olcMuzik(bas, adim, ham) (OfflineAudioContext ile ölçüm). */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : globalThis;
  var BU = W.BU = W.BU || {};
  var AC = W.AudioContext || W.webkitAudioContext;

  // Ana seviyeler. Efekt kanalı müziğin belirgin üstünde.
  var SEV = { ana: 0.9, efekt: 0.85, muzik: 0.26 };

  var ctx = null, Z = null;
  var ayarlar = { efekt: true, muzik: true };
  var muzikIstek = false;
  var sonCalis = {};          // ad -> performance.now() (üst üste binme önlemi)
  var sesler = new Set();     // çalan efekt sesleri (her biri bir kazanç düğümü)
  var resumeIst = 0, gizliDur = false;
  var simdi = function () { return (W.performance && performance.now) ? performance.now() : Date.now(); };

  // ---------- zincir: efekt + müzik -> ana -> sınırlayıcı -> çıkış ----------
  function zincir(c, ham, analiz) {
    var ana = c.createGain(); ana.gain.value = SEV.ana;
    var efx = c.createGain(); efx.gain.value = SEV.efekt;
    var muz = c.createGain(); muz.gain.value = 0;
    efx.connect(ana); muz.connect(ana);
    var son = ana, comp = null, an = null;
    if (!ham) {
      // Yalnız güvenlik: 0,8'e kadar dokunmayan yumuşak kırpıcı (sıkıştırıcı dengeyi bozuyordu).
      comp = c.createWaveShaper(); comp.curve = egri(); comp.oversample = '2x';
      ana.connect(comp); son = comp;
    }
    if (analiz) { an = c.createAnalyser(); an.fftSize = 1024; son.connect(an); an.connect(c.destination); }
    else son.connect(c.destination);
    return { ana: ana, efx: efx, muz: muz, kirp: comp, an: an };
  }

  var _egri = null;
  function egri() {
    if (_egri) return _egri;
    var n = 2049, e = new Float32Array(n), E = 0.8;
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1, a = Math.abs(x);
      var y = a <= E ? a : E + (1 - E) * Math.tanh((a - E) / (1 - E));
      e[i] = (x < 0 ? -y : y) * 0.999;
    }
    return (_egri = e);
  }

  // ---------- yardımcılar ----------
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function R(x) { return 1 + (Math.random() * 2 - 1) * x; }   // küçük rastgele sapma

  var GBUF = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function gbuf(c) {
    var b = GBUF && GBUF.get(c);
    if (!b) {
      var n = Math.floor(c.sampleRate);
      b = c.createBuffer(1, n, c.sampleRate);
      var a = b.getChannelData(0);
      for (var i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
      if (GBUF) GBUF.set(c, b);
    }
    return b;
  }

  function zarf(g, t, a, v, tut, d) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (tut) g.gain.setValueAtTime(v, t + a + tut);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + tut + d);
    return t + a + tut + d;
  }

  // Ton: {f, f2 (perde kayması), gl, tip, a, tut, dur, v, lp, q, vib:{f,d,at}}
  function ton(c, out, t, o) {
    var os = c.createOscillator(), g = c.createGain();
    os.type = o.tip || 'sine';
    os.frequency.setValueAtTime(o.f, t);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + (o.gl || o.dur));
    var a = o.a == null ? 0.004 : o.a;
    var son = zarf(g, t, a, o.v, o.tut || 0, o.dur);
    var n = os;
    if (o.lp) {
      var f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.value = o.lp; f.Q.value = o.q || 0.7;
      n.connect(f); n = f;
    }
    n.connect(g); g.connect(out);
    if (o.vib) {
      var l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vib.f;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(o.vib.d, t + (o.vib.at || 0.1));
      l.connect(lg); lg.connect(os.frequency);
      l.start(t); l.stop(son + 0.02);
    }
    os.start(t); os.stop(son + 0.02);
    return son;
  }

  // Kısa, SABİT filtreli gürültü vuruşu: {tip, f, q, a, tut, dur, v}
  function gur(c, out, t, o) {
    var s = c.createBufferSource(); s.buffer = gbuf(c);
    var f = c.createBiquadFilter(); f.type = o.tip || 'bandpass';
    f.frequency.value = o.f || 2000; f.Q.value = o.q || 1;
    var g = c.createGain();
    var son = zarf(g, t, o.a || 0.001, o.v, o.tut || 0, o.dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(son + 0.02);
    return son;
  }

  // Çan/zil: uyumsuz kısmi sesler toplamı. {f, v, dur, oran[], gen[], k (yukarı kısmilerin kısalığı)}
  function zil(c, out, t, o) {
    var r = o.oran || [1, 2.76, 5.4, 8.93], gn = o.gen || [1, 0.5, 0.25, 0.12];
    var k = o.k == null ? 0.7 : o.k, son = t;
    for (var i = 0; i < r.length; i++) {
      var fr = o.f * r[i];
      if (fr > 15000) continue;
      son = Math.max(son, ton(c, out, t, { f: fr, v: o.v * gn[i], a: o.a || 0.001, dur: o.dur / (1 + i * k) }));
    }
    return son;
  }

  // Tok düşüş: perdesi hızla inen gövde + üst ton + çok kısa tık.
  function tok(c, out, t, o) {
    var f0 = o.f0, d = o.dur || 0.16;
    ton(c, out, t, { f: f0 * 2.4, f2: f0, gl: 0.045, dur: d, v: o.v, a: 0.002 });
    ton(c, out, t, { f: f0 * 4, f2: f0 * 2, gl: 0.03, tip: 'triangle', dur: 0.05, v: o.v * 0.22, a: 0.001 });
    gur(c, out, t, { f: o.kf || 1400, q: 0.8, dur: 0.018, v: o.v * (o.kv == null ? 0.25 : o.kv) });
  }

  // Çıtırtı: birkaç çok kısa sabit gürültü tanesi (marul, soğan, pastırma)
  function citir(n, f, v) {
    return function (c, out, t) {
      for (var i = 0; i < n; i++) gur(c, out, t + 0.006 + i * 0.014 + Math.random() * 0.006,
        { tip: 'highpass', f: f * R(0.15), q: 0.9, dur: 0.008 + Math.random() * 0.006, v: v * R(0.3) });
    };
  }

  // Yazar kasa mekanizması ("ka"), zil ("ching"), sikkeler
  function ka(c, o, t, v) {
    gur(c, o, t, { f: 2600, q: 2, dur: 0.018, v: 0.26 * v });
    ton(c, o, t, { f: 170, f2: 80, gl: 0.05, dur: 0.08, v: 0.34 * v, a: 0.001 });
    gur(c, o, t + 0.045, { f: 1700, q: 2.5, dur: 0.014, v: 0.2 * v });
    ton(c, o, t + 0.045, { f: 240, f2: 120, gl: 0.03, dur: 0.05, v: 0.14 * v, a: 0.001 });
  }
  function ching(c, o, t, v, d) {
    zil(c, o, t, { f: 2150, v: 0.16 * v, dur: d, oran: [1, 1.47, 2.33, 3.11, 4.2], gen: [1, 0.55, 0.45, 0.22, 0.12], k: 0.9 });
    zil(c, o, t + 0.003, { f: 2163, v: 0.08 * v, dur: d * 0.8, oran: [1, 2.33], gen: [1, 0.4] });
  }
  function sikke(c, o, t, n, v) {
    for (var i = 0; i < n; i++) {
      var tt = t + i * 0.045 + Math.random() * 0.02, f = 3000 + Math.random() * 1300;
      ton(c, o, tt, { f: f, dur: 0.07, v: 0.05 * v, a: 0.001 });
      ton(c, o, tt, { f: f * 1.52, dur: 0.045, v: 0.025 * v, a: 0.001 });
    }
  }
  function arpej(c, o, t, notalar, ara, v, d) {
    notalar.forEach(function (m, i) {
      var f = hz(m), tt = t + i * ara;
      ton(c, o, tt, { f: f, tip: 'triangle', dur: d, v: v, a: 0.002 });
      ton(c, o, tt, { f: f * 2, dur: d * 0.6, v: v * 0.18, a: 0.002 });
    });
  }

  // Homurtu: burundan, alçak, titrek (testere dişi + alçak geçiren + genlik titreşimi)
  function homur(c, out, t, f1, f2, d, v) {
    var os = c.createOscillator(); os.type = 'sawtooth';
    os.frequency.setValueAtTime(f1, t);
    os.frequency.linearRampToValueAtTime(f2, t + d);
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 2.2;
    var pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 280; pk.Q.value = 1.4; pk.gain.value = 6;
    var am = c.createGain(); am.gain.value = 0.72;
    var l = c.createOscillator(); l.frequency.value = 23;
    var lg = c.createGain(); lg.gain.value = 0.28;
    l.connect(lg); lg.connect(am.gain);
    var g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.03);
    g.gain.setValueAtTime(v, t + d * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    os.connect(lp); lp.connect(pk); pk.connect(am); am.connect(g); g.connect(out);
    os.start(t); os.stop(t + d + 0.02); l.start(t); l.stop(t + d + 0.02);
  }

  // ---------- tabağa düşüş: malzemeye göre ----------
  var BIRAK = {
    _: { f0: 140, v: 0.46, kf: 1200 },
    bun: { f0: 118, v: 0.48, kf: 900, kv: 0.3, ek: function (c, o, t) { ton(c, o, t + 0.05, { f: 250, f2: 170, gl: 0.04, dur: 0.06, v: 0.07 }); } },
    patty: { f0: 88, v: 0.6, kf: 700, kv: 0.32, ek: function (c, o, t) {
      gur(c, o, t, { f: 600, q: 1.4, dur: 0.04, v: 0.11 });
      gur(c, o, t + 0.02, { tip: 'highpass', f: 4500, q: 0.7, dur: 0.1, v: 0.02 });
    } },
    cheese: { f0: 165, v: 0.42, kf: 2200, kv: 0.32 },
    lettuce: { f0: 185, v: 0.3, kf: 3000, kv: 0.14, ek: citir(4, 3800, 0.085) },
    tomato: { f0: 140, v: 0.42, kf: 800, kv: 0.2, ek: function (c, o, t) { ton(c, o, t + 0.01, { f: 420, f2: 210, gl: 0.05, dur: 0.08, v: 0.11 }); } },
    onion: { f0: 200, v: 0.34, kf: 2500, kv: 0.15, ek: citir(2, 2800, 0.08) },
    bacon: { f0: 150, v: 0.4, kf: 1800, kv: 0.2, ek: citir(3, 5000, 0.06) },
    egg: { f0: 130, v: 0.4, kf: 700, kv: 0.2, ek: function (c, o, t) {
      ton(c, o, t + 0.015, { f: 300, f2: 190, gl: 0.05, dur: 0.07, v: 0.09 });
      ton(c, o, t + 0.07, { f: 240, f2: 160, gl: 0.04, dur: 0.06, v: 0.055 });
    } },
    pickle: { f0: 215, v: 0.32, kf: 2000, kv: 0.15, ek: function (c, o, t) { ton(c, o, t + 0.01, { f: 950, f2: 620, gl: 0.03, dur: 0.05, v: 0.07, tip: 'triangle' }); } }
  };
  BIRAK.bunBot = BIRAK.bunTop = BIRAK.bun;
  BIRAK.raw = BIRAK.patty;
  // 2. turun malzemeleri (dükkânda alınanlar)
  BIRAK.sauce = { f0: 120, v: 0.36, kf: 700, kv: 0.18, ek: function (c, o, t) { ton(c, o, t + 0.01, { f: 380, f2: 180, gl: 0.06, dur: 0.09, v: 0.1 }); } };
  BIRAK.mushroom = { f0: 150, v: 0.4, kf: 1400, kv: 0.2 };
  BIRAK.jalapeno = { f0: 205, v: 0.32, kf: 2100, kv: 0.15, ek: function (c, o, t) { ton(c, o, t + 0.01, { f: 1050, f2: 700, gl: 0.03, dur: 0.05, v: 0.07, tip: 'triangle' }); } };
  BIRAK.onionring = { f0: 175, v: 0.36, kf: 2600, kv: 0.16, ek: citir(3, 3400, 0.07) };
  BIRAK.avocado = { f0: 125, v: 0.42, kf: 900, kv: 0.22 };
  BIRAK.premium = { f0: 92, v: 0.56, kf: 760, kv: 0.3, ek: function (c, o, t) { zil(c, o, t + 0.03, { f: 2093, v: 0.05, dur: 0.5, oran: [1, 2.41], gen: [1, 0.3] }); } };

  // ---------- efektler ----------
  var SES = {
    // Malzemeyi avuçla: yukarı kalkan yumuşak "pop"
    sec: function (c, o, t) {
      var r = R(0.05);
      ton(c, o, t, { f: 280 * r, f2: 820 * r, gl: 0.03, dur: 0.07, v: 0.3, a: 0.002 });
      ton(c, o, t + 0.005, { f: 560 * r, f2: 1300 * r, gl: 0.03, tip: 'triangle', dur: 0.05, v: 0.07, a: 0.002 });
      gur(c, o, t, { f: 3000, q: 1.2, dur: 0.007, v: 0.04 });
    },
    // Tabağa tok düşüş
    birak: function (c, o, t, alt) {
      var p = (alt && Object.prototype.hasOwnProperty.call(BIRAK, alt)) ? BIRAK[alt] : BIRAK._, r = R(0.04);
      tok(c, o, t, { f0: p.f0 * r, v: p.v, kf: p.kf, kv: p.kv });
      if (p.ek) p.ek(c, o, t);
    },
    // Çiğ köfte ızgaraya: tok + kısa sabit cızırtı + çıtırtılar
    izgara: function (c, o, t) {
      tok(c, o, t, { f0: 95, v: 0.42, kf: 900 });
      gur(c, o, t + 0.005, { tip: 'highpass', f: 3200, q: 0.6, a: 0.01, tut: 0.12, dur: 0.4, v: 0.1 });
      gur(c, o, t + 0.005, { tip: 'bandpass', f: 6500, q: 1.5, a: 0.01, tut: 0.1, dur: 0.32, v: 0.05 });
      for (var i = 0; i < 16; i++) {
        var dt = 0.02 + Math.random() * 0.5;
        gur(c, o, t + dt, { f: 2500 + Math.random() * 4000, q: 3, dur: 0.004 + Math.random() * 0.004, v: (0.07 + Math.random() * 0.09) * (1 - dt / 0.65) });
      }
    },
    // Bıçakla doğrama (6. tur): tahtaya tok vuruş + kısa çıtırtı (sabit, süpürmesiz)
    dogra: function (c, o, t) {
      var r = R(0.06);
      tok(c, o, t, { f0: 150 * r, v: 0.34, kf: 1400 });
      gur(c, o, t, { tip: 'bandpass', f: 2400 * r, q: 2.2, dur: 0.035, v: 0.12 });
      gur(c, o, t + 0.012, { tip: 'highpass', f: 5200, q: 0.8, dur: 0.02, v: 0.05 });
    },
    // Patates fritöze (6. tur): tok düşüş + kısa sabit kızartma cızırtısı ve çıtırtılar
    fritoz: function (c, o, t) {
      tok(c, o, t, { f0: 120, v: 0.3, kf: 700 });
      gur(c, o, t + 0.01, { tip: 'highpass', f: 2600, q: 0.6, a: 0.02, tut: 0.25, dur: 0.5, v: 0.08 });
      for (var i = 0; i < 22; i++) {
        var dt = 0.03 + Math.random() * 0.7;
        gur(c, o, t + dt, { f: 2000 + Math.random() * 5000, q: 3, dur: 0.004 + Math.random() * 0.005, v: (0.06 + Math.random() * 0.08) * (1 - dt / 0.8) });
      }
    },
    // Köfte pişti: mutfak zili
    pisti: function (c, o, t) {
      zil(c, o, t, { f: 1320, v: 0.15, dur: 1.0, oran: [1, 2.41, 3.87, 5.37], gen: [1, 0.4, 0.25, 0.12] });
      ton(c, o, t, { f: 1322.5, v: 0.06, dur: 0.9, a: 0.001 });
      ton(c, o, t, { f: 660, tip: 'triangle', v: 0.05, dur: 0.12, a: 0.001 });
    },
    // Yığını parmağa al: kısa yükselen "bwip"
    al: function (c, o, t) {
      var r = R(0.03);
      ton(c, o, t, { f: 330 * r, f2: 640 * r, gl: 0.07, dur: 0.11, v: 0.24, a: 0.004 });
      ton(c, o, t, { f: 660 * r, f2: 1280 * r, gl: 0.07, tip: 'triangle', dur: 0.07, v: 0.05, a: 0.004 });
    },
    // Yığın tabağa geri: inen "bwoop" + küçük tok
    geri: function (c, o, t) {
      ton(c, o, t, { f: 620, f2: 300, gl: 0.09, dur: 0.11, v: 0.2, a: 0.004 });
      tok(c, o, t + 0.1, { f0: 140, v: 0.3, kf: 1000, kv: 0.2 });
    },
    // Doğru + mutlu: ka-ching + sikkeler + parlak zil arpeji
    teslim_mutlu: function (c, o, t) {
      ka(c, o, t, 1);
      ching(c, o, t + 0.06, 1, 0.9);
      sikke(c, o, t + 0.09, 5, 1);
      arpej(c, o, t + 0.24, [84, 88, 91, 96], 0.06, 0.08, 0.32);
    },
    // Doğru + somurtkan: sade kasa
    teslim_normal: function (c, o, t) {
      ka(c, o, t, 0.8);
      ching(c, o, t + 0.06, 0.6, 0.5);
      sikke(c, o, t + 0.09, 2, 0.7);
    },
    // Doğru + kızgın: "hımf" homurtusu
    teslim_kizgin: function (c, o, t) {
      homur(c, o, t, 135, 118, 0.14, 0.25);
      homur(c, o, t + 0.19, 128, 82, 0.3, 0.28);
    },
    // Yanlış burger: "ı-ıh" iki inen nota (yumuşatılmış kare)
    yanlis: function (c, o, t) {
      [[392, 0, 0.14], [311, 0.17, 0.24]].forEach(function (n, i) {
        ton(c, o, t + n[1], { f: n[0], f2: i ? n[0] * 0.94 : 0, gl: 0.22, tip: 'square', lp: 1300, a: 0.006, tut: 0.04, dur: n[2], v: 0.1 });
        ton(c, o, t + n[1], { f: n[0] / 2, tip: 'triangle', a: 0.006, tut: 0.04, dur: n[2], v: 0.12 });
      });
    },
    // Müşteri kaçtı: kısa homurtu + inen ton
    kacti: function (c, o, t) {
      homur(c, o, t, 122, 92, 0.24, 0.26);
      ton(c, o, t + 0.24, { f: 440, f2: 220, gl: 0.4, tip: 'triangle', lp: 1500, a: 0.01, tut: 0.1, dur: 0.3, v: 0.11 });
    },
    // Çöp: kutuya tok düşüş + metal kapak tıngırtısı
    cop: function (c, o, t) {
      tok(c, o, t, { f0: 85, v: 0.52, kf: 600, kv: 0.3 });
      zil(c, o, t + 0.01, { f: 540, v: 0.1, dur: 0.28, oran: [1, 2.76, 5.4, 8.93], gen: [1, 0.6, 0.4, 0.2], k: 1.2 });
      tok(c, o, t + 0.09, { f0: 115, v: 0.18, kf: 1500, kv: 0.3 });
      for (var i = 0; i < 3; i++) gur(c, o, t + 0.04 + i * 0.03 + Math.random() * 0.01, { f: 1500, q: 2, dur: 0.01, v: 0.06 });
    },
    // Uyarı: "tık-tık" tahta blok
    uyari: function (c, o, t) {
      [0, 0.1].forEach(function (d) {
        ton(c, o, t + d, { f: 1650, f2: 1450, gl: 0.02, dur: 0.035, v: 0.18, a: 0.001 });
        ton(c, o, t + d, { f: 825, tip: 'triangle', dur: 0.03, v: 0.09, a: 0.001 });
      });
    },
    // Gün başladı: dükkân kapısı çıngırağı + sıcak akor
    gun_basla: function (c, o, t) {
      [1319, 1568, 2093].forEach(function (f, i) {
        zil(c, o, t + i * 0.13, { f: f, v: 0.11, dur: 0.8, oran: [1, 2.41, 3.87], gen: [1, 0.3, 0.12] });
      });
      [72, 76, 79].forEach(function (m) { ton(c, o, t + 0.26, { f: hz(m), tip: 'triangle', lp: 2000, a: 0.03, tut: 0.1, dur: 0.6, v: 0.045 }); });
    },
    // Gün bitti (kazanç): kısa zafer fanfarı
    gun_bitti: function (c, o, t) {
      [[67, 0, 0.1], [72, 0.1, 0.1], [76, 0.2, 0.1], [79, 0.3, 0.14], [76, 0.46, 0.08], [79, 0.56, 0.5]].forEach(function (n) {
        var f = hz(n[0]);
        ton(c, o, t + n[1], { f: f, tip: 'square', lp: 2600, a: 0.006, tut: n[2] * 0.6, dur: n[2] * 0.6 + 0.08, v: 0.055 });
        ton(c, o, t + n[1], { f: f, tip: 'triangle', a: 0.006, tut: n[2] * 0.6, dur: n[2] * 0.6 + 0.1, v: 0.1 });
      });
      [60, 64, 67, 72].forEach(function (m) { ton(c, o, t + 0.56, { f: hz(m), tip: 'triangle', lp: 2200, a: 0.02, tut: 0.25, dur: 0.6, v: 0.045 }); });
      zil(c, o, t + 0.58, { f: 2093, v: 0.07, dur: 0.8, oran: [1, 2.41, 3.87], gen: [1, 0.3, 0.12] });
      sikke(c, o, t + 0.62, 3, 0.6);
    },
    // Gün kaybedildi: "vah vah vah vaaah"
    gun_kayip: function (c, o, t) {
      [[392, 0, 0.22], [370, 0.3, 0.22], [349, 0.6, 0.22], [330, 0.9, 0.7]].forEach(function (n, i) {
        var vib = i === 3 ? { f: 6, d: 7, at: 0.25 } : null;
        ton(c, o, t + n[1], { f: n[0], f2: n[0] * 0.97, gl: n[2] + 0.05, tip: 'sawtooth', lp: 900, q: 1.2, a: 0.02, tut: n[2] * 0.6, dur: n[2] * 0.5, v: 0.08, vib: vib });
        ton(c, o, t + n[1], { f: n[0], tip: 'triangle', a: 0.02, tut: n[2] * 0.6, dur: n[2] * 0.5, v: 0.08, vib: vib });
      });
    },
    // Düğme
    tik: function (c, o, t) {
      var f = 1150 * R(0.03);
      ton(c, o, t, { f: f, dur: 0.03, v: 0.13, a: 0.001 });
      ton(c, o, t, { f: f / 2, tip: 'triangle', dur: 0.025, v: 0.07, a: 0.001 });
    },
    // Geliştirme satın alındı: kasa + yükselen ışıltı
    satin: function (c, o, t) {
      ka(c, o, t, 0.6);
      ching(c, o, t + 0.04, 0.55, 0.6);
      arpej(c, o, t + 0.08, [72, 76, 79, 84, 88], 0.05, 0.075, 0.25);
      zil(c, o, t + 0.36, { f: 2637, v: 0.055, dur: 0.7, oran: [1, 2.41], gen: [1, 0.25] });
    },
    // Gün sonu yıldızı: parlak "ding", her yıldızda perde yükselir (yildiz:1, :2, :3)
    yildiz: function (c, o, t, alt) {
      var n = Math.max(1, Math.min(3, parseInt(alt, 10) || 1)), f = [1568, 1976, 2349][n - 1];
      zil(c, o, t, { f: f, v: 0.13 + 0.02 * n, dur: 0.8 + 0.25 * n, oran: [1, 2.41, 3.87], gen: [1, 0.35, 0.15] });
      ton(c, o, t, { f: f / 2, tip: 'triangle', v: 0.06, dur: 0.18, a: 0.002 });
      ton(c, o, t + 0.003, { f: f * 1.003, v: 0.05, dur: 0.6, a: 0.001 });
      if (n === 3) arpej(c, o, t + 0.12, [84, 88, 91, 96], 0.05, 0.05, 0.25);
    },
    // Can gitti: "bonk" + inen ikinci ton
    can_gitti: function (c, o, t) {
      tok(c, o, t, { f0: 110, v: 0.42, kf: 1000, kv: 0.2 });
      ton(c, o, t, { f: 587, f2: 560, gl: 0.1, tip: 'square', lp: 1400, dur: 0.1, v: 0.08, a: 0.003 });
      ton(c, o, t + 0.12, { f: 415, f2: 330, gl: 0.3, tip: 'square', lp: 1100, a: 0.005, tut: 0.05, dur: 0.28, v: 0.09 });
      ton(c, o, t + 0.12, { f: 207, f2: 165, gl: 0.3, tip: 'triangle', a: 0.005, tut: 0.05, dur: 0.28, v: 0.1 });
    }
  };

  var ADLAR = ['sec', 'birak', 'birak:bun', 'birak:bunBot', 'birak:bunTop', 'birak:patty', 'birak:cheese', 'birak:lettuce',
    'birak:tomato', 'birak:onion', 'birak:bacon', 'birak:egg', 'birak:pickle', 'izgara', 'pisti', 'al', 'geri',
    'teslim_mutlu', 'teslim_normal', 'teslim_kizgin', 'yanlis', 'kacti', 'cop', 'uyari', 'gun_basla', 'gun_bitti',
    'gun_kayip', 'tik', 'satin', 'can_gitti', 'yildiz:1', 'yildiz:2', 'yildiz:3',
    'birak:sauce', 'birak:mushroom', 'birak:jalapeno', 'birak:onionring', 'birak:avocado', 'birak:premium',
    'dogra', 'fritoz'];

  // ---------- müzik ----------
  // 112 BPM, hafif shuffle, Do majör. 16 ölçü (A 8 + B 8), 4 geçişte bir tam tekrar (64 ölçü ≈ 2 dk 17 sn).
  var BPM = 112, ADIM = 60 / BPM / 4, SWING = 0.3;
  var AKOR = { C: [60, 64, 67], Am: [57, 60, 64], F: [57, 60, 65], G: [55, 59, 62], Dm: [57, 62, 65], Em: [55, 59, 64], G7: [55, 59, 65] };
  var KOK = { C: 36, Am: 45, F: 41, G: 43, Dm: 38, Em: 40, G7: 43 };
  var UC = { C: 4, Am: 3, F: 4, G: 4, Dm: 3, Em: 3, G7: 4 };
  var DIZI = [['C'], ['Am'], ['F'], ['G'], ['C'], ['Am'], ['Dm', 'G'], ['C'],
    ['F'], ['G'], ['Em'], ['Am'], ['Dm'], ['G'], ['C'], ['G7']];
  var MEL = [
    'E5 . G5 . A5 G5 E5 .', 'C5 . E5 - D5 C5 A4 .', 'F5 . A5 . G5 F5 E5 .', 'D5 - - . G4 A4 B4 D5',
    'E5 . G5 . C6 - A5 G5', 'E5 . C5 . D5 E5 C5 .', 'D5 F5 A5 F5 G5 - B4 D5', 'C5 - - - . . . .',
    'A5 - A5 G5 F5 - C5 .', 'B4 - D5 . G5 - F5 .', 'E5 - G5 . B5 - G5 .', 'A5 - G5 E5 C5 - . .',
    'F5 - F5 E5 D5 - A4 .', 'B4 - D5 . F5 E5 D5 .', 'E5 G5 C6 . G5 E5 C5 .', 'D5 - . . B4 . G4 .'
  ];
  var MEL8B = 'C5 - E5 G5 C6 - . .';
  var NOTA = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(s) {
    var m = /^([A-G])([#b]?)(\d)$/.exec(s); if (!m) return null;
    return 12 * (+m[3] + 1) + NOTA[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function coz(sat) {
    var tk = sat.split(/\s+/), r = [];
    for (var i = 0; i < 8; i++) {
      var m = midi(tk[i]); if (m == null) { r.push(null); continue; }
      var u = 1; while (i + u < 8 && tk[i + u] === '-') u++;
      r.push([m, u]);
    }
    return r;
  }
  var MELC = MEL.map(coz), MEL8BC = coz(MEL8B);
  var GAM = [0, 2, 4, 5, 7, 9, 11];
  function ucluAlt(m) {   // gamda iki derece aşağı (alt üçlü)
    var pc = m % 12, i = GAM.indexOf(pc); if (i < 0) return m - 3;
    var j = i - 2, ok = Math.floor(m / 12);
    if (j < 0) { j += 7; ok--; }
    return ok * 12 + GAM[j];
  }

  // çalgılar
  function mLead(c, o, t, m, d, v) {
    var f = hz(m), tut = Math.max(0, d - 0.08);
    ton(c, o, t, { f: f, tip: 'square', lp: 2200, q: 0.5, a: 0.01, tut: tut, dur: 0.12, v: v * 0.45, vib: { f: 5.5, d: f * 0.004, at: 0.25 } });
    ton(c, o, t, { f: f, tip: 'triangle', a: 0.008, tut: tut, dur: 0.14, v: v });
  }
  function mMarimba(c, o, t, m, v) {
    var f = hz(m);
    ton(c, o, t, { f: f, dur: 0.35, v: v, a: 0.002 });
    ton(c, o, t, { f: f * 4, dur: 0.05, v: v * 0.2, a: 0.001 });
  }
  function mGlock(c, o, t, m, v) { zil(c, o, t, { f: hz(m), v: v, dur: 0.6, oran: [1, 2.76], gen: [1, 0.25] }); }
  function mAkor(c, o, t, ad, v) {
    AKOR[ad].forEach(function (m) {
      var f = hz(m) * R(0.0015);
      ton(c, o, t, { f: f, tip: 'triangle', lp: 1800, dur: 0.12, v: v, a: 0.004 });
      ton(c, o, t, { f: f, tip: 'square', lp: 1100, dur: 0.08, v: v * 0.22, a: 0.004 });
    });
  }
  function mBas(c, o, t, m, d, v) {
    var f = hz(m);
    ton(c, o, t, { f: f, tip: 'sawtooth', lp: 430, q: 3.5, a: 0.005, tut: d * 0.4, dur: d * 0.6, v: v * 0.55 });
    ton(c, o, t, { f: f, a: 0.005, tut: d * 0.4, dur: d * 0.6, v: v });
  }
  function mKick(c, o, t, v) {
    ton(c, o, t, { f: 140, f2: 48, gl: 0.07, dur: 0.17, v: v, a: 0.001 });
    gur(c, o, t, { f: 3000, q: 1, dur: 0.004, v: v * 0.1 });
  }
  function mSnare(c, o, t, v) {
    gur(c, o, t, { f: 1900, q: 0.8, dur: 0.08, v: v });
    ton(c, o, t, { f: 200, f2: 170, gl: 0.05, tip: 'triangle', dur: 0.06, v: v * 0.6, a: 0.001 });
  }
  function mHat(c, o, t, v, d) { gur(c, o, t, { tip: 'highpass', f: 8000, q: 0.7, dur: d || 0.025, v: v }); }

  // Tek 16'lık adım: n küresel adım sayısı
  function muzikAdim(c, o, n, t) {
    var s = n % 16, bar = Math.floor(n / 16) % 16, pas = Math.floor(n / 256) % 4;
    var ch = DIZI[bar], akor = ch.length > 1 && s >= 8 ? ch[1] : ch[0];
    var tt = t + (s % 4 === 2 ? ADIM * SWING : 0);
    var B = bar >= 8, hafif = pas === 2 && (bar === 8 || bar === 9);   // kısa ara: davul hafifler

    // davul
    var kick = s === 0 || s === 8 || (s === 14 && bar % 4 === 3) || (s === 10 && pas % 2 === 1 && bar % 2 === 1);
    if (kick && !(hafif && s !== 0)) mKick(c, o, tt, hafif ? 0.22 : 0.34);
    if (s === 4 || s === 12) mSnare(c, o, tt, hafif ? 0.06 : 0.12);
    if (pas === 3 && bar === 15 && s >= 12 && s !== 12) mSnare(c, o, tt, 0.05 + (s - 12) * 0.02);
    if (s % 2 === 0) mHat(c, o, tt, s % 4 === 2 ? 0.045 : 0.028, s === 14 && bar % 2 === 1 ? 0.07 : 0.025);
    if (pas % 2 === 1 && s % 2 === 1) mHat(c, o, tt, 0.012);

    // akor vuruşu (ara 8'likler)
    if (s % 4 === 2) mAkor(c, o, tt, akor, hafif ? 0.05 : 0.04);

    if (s % 2) return;
    var sl = s / 2, D8 = ADIM * 2;

    // bas
    var yuru = pas % 2 === 1 && ch.length === 1, R0 = KOK[akor], bn = null;
    if (yuru) bn = [R0, null, R0 + UC[akor], null, R0 + 7, null, R0 + 9, (KOK[DIZI[(bar + 1) % 16][0]]) - 1][sl];
    else bn = [R0, null, R0 + 7, null, R0 + 12, null, R0 + 7, null][sl];
    if (bn != null) mBas(c, o, tt, bn, sl === 7 ? D8 * 0.8 : D8 * 1.4, 0.2);

    // melodi
    var sat = (bar === 7 && pas === 2) ? MEL8BC : MELC[bar], nt = sat[sl];
    if (nt) {
      var m = nt[0], d = nt[1] * D8 * 0.92;
      if (!B && pas === 1) mMarimba(c, o, tt, m, 0.16);
      else if (B && pas === 2) mGlock(c, o, tt, m, 0.1);
      else {
        mLead(c, o, tt, m, d, 0.12);
        if (B && pas === 3) ton(c, o, tt, { f: hz(ucluAlt(m)), tip: 'triangle', a: 0.01, tut: Math.max(0, d - 0.08), dur: 0.12, v: 0.055 });
      }
    }
    // karşı ezgi (2. geçişin A bölümünde)
    if (!B && pas === 1 && (sl === 0 || sl === 5)) mGlock(c, o, tt, AKOR[akor][sl ? 1 : 2] + 12, 0.045);
  }

  var mz = { on: false, timer: null, n: 0, next: 0, durT: null };
  function planla() {
    if (!ctx) return;
    var now = ctx.currentTime;
    if (ctx.state !== 'running') { mz.next = Math.max(mz.next, now + 0.05); return; }
    if (mz.next < now - 0.1) mz.next = now + 0.05;      // sekme uyuduysa birikeni çalma
    while (mz.next < now + 0.3) { muzikAdim(ctx, Z.muz, mz.n, mz.next); mz.n++; mz.next += ADIM; }
  }
  function mzBasla() {
    if (!ctx || mz.on) return;
    mz.on = true;
    clearTimeout(mz.durT); mz.durT = null;
    var g = Z.muz.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(SEV.muzik, now + 1.5);
    if (!mz.timer) { mz.n = 0; mz.next = now + 0.08; mz.timer = setInterval(planla, 40); planla(); }
  }
  function mzDur(sure) {
    if (!ctx) return;
    mz.on = false;
    var g = Z.muz.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + sure);
    clearTimeout(mz.durT);
    mz.durT = setTimeout(function () { if (!mz.on && mz.timer) { clearInterval(mz.timer); mz.timer = null; } }, sure * 1000 + 150);
  }
  function guncelleMuzik() {
    if (!ctx) return;
    if (muzikIstek && ayarlar.muzik) mzBasla(); else if (mz.on || mz.timer) mzDur(0.9);
  }

  // ---------- genel arayüz ----------
  function ac() {
    if (!AC) return;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
      Z = zincir(ctx, false, true);
      Z.efx.gain.value = ayarlar.efekt ? SEV.efekt : 0;
      // Sessiz düğmesine uy, başka uygulamanın sesini kesme
      try { if (W.navigator && navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}
    }
    if (ctx.state !== 'running') {
      resumeIst = simdi();
      try { var p = ctx.resume(); if (p && p.then) p.then(guncelleMuzik, function () {}); } catch (e) {}
      try {   // iOS kilidi: sessiz tampon
        var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
      } catch (e) {}
    }
    guncelleMuzik();
  }
  function hazir() {
    // kullanıcı henüz hiç dokunmadıysa ses bağlamı kurulmaz (tarayıcı izin vermez, uyarı basar); ilk dokunuşta ac() kurar
    if (!ctx && W.navigator && navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    if (!ctx) ac();
    if (!ctx) return false;
    if (ctx.state === 'running') return true;
    try { ctx.resume(); } catch (e) {}
    return simdi() - resumeIst < 600;   // ac() az önce sürdürmeyi istediyse sırada bekleyebilir
  }
  function cal(ad) {
    if (!ayarlar.efekt || typeof ad !== 'string') return;
    var p = ad.split(':'), f = SES[p[0]];
    if (!f || !Object.prototype.hasOwnProperty.call(SES, p[0])) return;
    var tn = simdi();
    if (sonCalis[ad] != null && tn - sonCalis[ad] < 30) return;
    if (!hazir()) return;
    if (sesler.size > 24) return;
    sonCalis[ad] = tn;
    var vg = ctx.createGain(); vg.connect(Z.efx); sesler.add(vg);
    try { f(ctx, vg, ctx.currentTime + 0.005, p[1]); } catch (e) {}
    setTimeout(function () { try { vg.disconnect(); } catch (e) {} sesler.delete(vg); }, 2600);
  }
  function muzik(acik) { muzikIstek = !!acik; guncelleMuzik(); }
  function ayar(o) {
    o = o || {};
    if ('efekt' in o) {
      ayarlar.efekt = !!o.efekt;
      if (ctx) {
        var g = Z.efx.gain, now = ctx.currentTime;
        g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(ayarlar.efekt ? SEV.efekt : 0, now + 0.05);
      }
    }
    if ('muzik' in o) { ayarlar.muzik = !!o.muzik; guncelleMuzik(); }
  }
  function durdur() {
    muzikIstek = false;
    if (!ctx) return;
    mzDur(0.15);
    var now = ctx.currentTime;
    sesler.forEach(function (vg) {
      try { vg.gain.cancelScheduledValues(now); vg.gain.setValueAtTime(vg.gain.value, now); vg.gain.linearRampToValueAtTime(0, now + 0.04); } catch (e) {}
    });
  }
  var _tb = null;
  function seviye() {
    if (!Z || !Z.an) return { tepe: 0, rms: 0 };
    if (!_tb) _tb = new Float32Array(Z.an.fftSize);
    Z.an.getFloatTimeDomainData(_tb);
    var p = 0, s = 0;
    for (var i = 0; i < _tb.length; i++) { var x = _tb[i]; if (x < 0) x = -x; if (x > p) p = x; s += x * x; }
    return { tepe: p, rms: Math.sqrt(s / _tb.length) };
  }
  function durum() {
    return { bagli: !!ctx, durum: ctx ? ctx.state : 'yok', efekt: ayarlar.efekt, muzik: ayarlar.muzik, muzikIstek: muzikIstek, muzikCaliyor: mz.on, sesler: sesler.size };
  }

  // Görünmez olunca bağlamı uyut, dönünce sürdür
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) { if (ctx.state === 'running') { gizliDur = true; try { ctx.suspend(); } catch (e) {} } }
      else if (gizliDur || ctx.state !== 'running') { gizliDur = false; try { ctx.resume(); } catch (e) {} }
    });
  }

  // ---------- ölçüm (OfflineAudioContext) ----------
  function islem(c) {
    return c.startRendering().then(function (b) {
      var a = b.getChannelData(0), p = 0, s = 0, kirp = 0;
      for (var i = 0; i < a.length; i++) { var x = Math.abs(a[i]); if (x > p) p = x; if (x >= 1) kirp++; s += a[i] * a[i]; }
      return { tepe: p, rms: Math.sqrt(s / a.length), kirpan: kirp, sure: a.length / b.sampleRate };
    });
  }
  function OAC(sn) {
    var K = W.OfflineAudioContext || W.webkitOfflineAudioContext;
    return new K(1, Math.ceil(44100 * sn), 44100);
  }
  function _olc(ad, ham) {
    var p = String(ad).split(':'), f = SES[p[0]];
    if (!f) return Promise.resolve(null);
    var c = OAC(2.5), z = zincir(c, !!ham, false);
    f(c, z.efx, 0.01, p[1]);
    return islem(c);
  }
  function _olcMuzik(bas, adim, ham) {
    var c = OAC(adim * ADIM + 1), z = zincir(c, !!ham, false);
    z.muz.gain.value = SEV.muzik;
    for (var i = 0; i < adim; i++) muzikAdim(c, z.muz, bas + i, 0.05 + i * ADIM);
    return islem(c);
  }

  BU.SES = { ac: ac, cal: cal, muzik: muzik, ayar: ayar, durdur: durdur, ADLAR: ADLAR, seviye: seviye, durum: durum,
    _olc: _olc, _olcMuzik: _olcMuzik, _bpm: BPM };
})();
