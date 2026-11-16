/* Ses (Web Audio). Bütün sesler gerçek kayıttır (ses/*.mp3, kaynak ve lisanslar ses/LISANS.md); sentez ses ve hava/süpürme sesi yoktur.
   Oyun olayları SO.ses.olay(ad, bilgi) ile gelir:
   'adim'  { zemin: 'asfalt' | 'kaldirim' | 'cim' | 'su', hiz (m/sn), ayak: 'l' | 'r' }   ('cim' çölde kum, karlı dağda kar takımına döner: SO.world.biyom)
   'zipla' { }      'in' { hiz (yere değiş hızı m/sn), zemin }
   'su_gir' { hiz } (yüzmeye başlama)   'su_cik' { }   'kulac' { hiz } (yüzerken her kulaç)
   'tutun' { } (tırmanırken el kayaya basar)   'tirman' { yukseklik (m) } (kendini yukarı çekip üste çıkma)
   init() ilk dokunuşta çağrılır (tarayıcı sesi ancak kullanıcı dokununca açar; her dokunuşta yeniden çağrılabilir), update(dt) her karede.
   durum() deneme içindir: yüklenen dosya sayısı, hatalar, bağlam durumu, çalınan ses sayıları.

   Zincir:  adımlar ─ dolgunluk (alt raf) ─┐
            zıplama / iniş / su / tırmanma ┼─ ana düzey ─ sınırlayıcı ─ telafi ─ çıkış
            ortam (şehir + kuş + su döngüsü)┘
   Su ortamı: oyuncunun çevresinde su var mı diye SO.world.suDerinlik birkaç noktada örneklenir (0,4 sn'de bir); yakınlığa göre su döngüsü açılır.
   Tırmanmanın kendi kaydı yok: taş basamak vuruşu (tutun_*) + betondan kalkış eforu (zipla_sert*) + üste basan adım (kaldirim_yuru*) birleşimidir.
   Ortam döngüsü: MP3 başına/sonuna sessizlik eklediği için dosya doğrudan döndürülmez. Çözülen tamponun iki ucundan 0,1 sn atılır,
   son 2,5 sn eşit güçlü çapraz geçişle başın üstüne bindirilir ve bu yeni tampon loop=true ile çalınır: dikiş yeri duyulmaz.
   Tek seslerde de aynı boşluk sorunu var: her tamponda sesin gerçekten başladığı yer bulunur (bas) ve çalma oradan başlar,
   yani vuruş tarayıcıdan bağımsız olarak hemen duyulur. */
(function () {
  'use strict';
  const SO = window.SO, clamp = SO.clamp, lerp = SO.lerp;
  const YOL = 'ses/', UZANTI = '.mp3';
  // Adım takımları: zemin × (yürüme, koşu). Sayı = dosya adedi (asfalt_yuru1.mp3 …).
  const TAKIM = { asfalt_yuru: 6, asfalt_kos: 5, kaldirim_yuru: 6, kaldirim_kos: 5, cim_yuru: 5, cim_kos: 6, zipla_sert: 2, zipla_cim: 2, in_sert: 2, in_cim: 2,
    su_adim: 6, kulac: 5, su_gir: 2, su_cik: 1, tutun: 3, kar: 6, kum: 6 };   // su_adim, kar, kum: yürüme ve koşu için tek takım
  const ORTAM = ['ortam_sehir', 'ortam_park', 'ortam_su'];
  const AYAR = SO.tune.ses = {
    ana: .9,            // genel düzey
    adim: 1.3,          // adım düzeyi (depar); yürüyüşte yuruOran ile çarpılır
    yuruOran: .5,       // yürüyüş adımı deparın yarı düzeyinde (yaklaşık -6 dB)
    cimOran: .8,        // çim adımları sert zemine göre biraz geride
    kosEsik: 2.6,       // m/sn: üstünde koşu kayıtları kullanılır
    dolgun: 4,          // dB: deparda adımların alt bölgesine eklenen dolgunluk (200 Hz alt raf)
    zipla: 1, inis: .6,
    ortam: .9,          // şehir uğultusu düzeyi
    kus: .8,            // parktaki kuş katmanı düzeyi
    parkSehir: .6,      // parktayken şehir uğultusu bu orana iner
    kirSehir: .4, kirKus: .3,   // şehir dışındaki çimde
    gecis: 1.6,         // sn: ortam katmanları arası geçişin zaman sabiti
    kumOran: .8, karOran: .9,   // kum (çöl) ve kar adımları sert zemine göre
    suAdim: 1,          // sığ suda adım düzeyi (bel derinliğinde); bilek derinliğinde suSig ile çarpılır
    suSig: .45,
    suGir: .8, suCik: .7,   // yüzmeye başlama şapı, sudan çıkışta süzülme
    kulac: .55,         // kulaç (sakin; hızlı yüzmede biraz artar)
    tutun: .55, tirman: .7,   // tırmanma: elin kayaya basışı, kendini yukarı çekme
    su: .8,             // su ortamı düzeyi (suyun içinde/kıyısında); uzaklaştıkça azalır
    suYuzme: 1.3,       // yüzerken su ortamı bu kadar öne gelir
    suUzak: 30,         // m: su ortamının duyulmaya başladığı uzaklık (örnekleme halkaları: 4, 10 ve bu)
    suOrnek: .4,        // sn: yakınlık ölçümünün aralığı
    suGecis: .9         // sn: su ortamı düzey geçişinin zaman sabiti
  };
  let ctx = null, anaG, adimG, adimRaf, tekG, ortamG, sehirG, kusG, suG, yuklemeBasladi = false, gorunur = true;
  const tampon = {}, son = {}, hatalar = [], sayac = { adim: 0, zipla: 0, in: 0, su_gir: 0, su_cik: 0, kulac: 0, tutun: 0, tirman: 0, atlanan: 0 };
  let yuklenen = 0, toplam = 0, ortamCalan = 0, sonAdimT = -9, hedefSehir = -1, hedefKus = -1, yer = 'sehir', hedefSu = -1, suYakin = 0, suSayac = 9, sonKulacT = -9, sonTutunT = -9, elSira = 0;
  const rnd = () => Math.random();

  /* ---------- kurulum ---------- */
  function kur() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { hatalar.push('AudioContext yok'); return false; }
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { hatalar.push('AudioContext açılamadı: ' + e2.message); ctx = null; return false; } }
    const cikis = ctx.createGain(), sinir = ctx.createDynamicsCompressor();
    // Hafif sınırlayıcı: yalnız sert iniş gibi tepeleri tutar. Tarayıcının kendiliğinden eklediği telafi kazancı (yaklaşık +3,6 dB) cikis ile geri alınır.
    sinir.threshold.value = -8; sinir.knee.value = 6; sinir.ratio.value = 4; sinir.attack.value = .003; sinir.release.value = .16; cikis.gain.value = .66;
    anaG = ctx.createGain(); anaG.gain.value = AYAR.ana; anaG.connect(sinir); sinir.connect(cikis); cikis.connect(ctx.destination);
    adimRaf = ctx.createBiquadFilter(); adimRaf.type = 'lowshelf'; adimRaf.frequency.value = 200; adimRaf.gain.value = 0;
    adimG = ctx.createGain(); adimG.gain.value = 1; adimG.connect(adimRaf); adimRaf.connect(anaG);
    tekG = ctx.createGain(); tekG.gain.value = 1; tekG.connect(anaG);
    ortamG = ctx.createGain(); ortamG.gain.value = 0; ortamG.connect(anaG);
    sehirG = ctx.createGain(); sehirG.gain.value = 0; sehirG.connect(ortamG);
    kusG = ctx.createGain(); kusG.gain.value = 0; kusG.connect(ortamG);
    suG = ctx.createGain(); suG.gain.value = 0; suG.connect(ortamG);
    return true;
  }
  const coz = ab => new Promise((ok, hata) => { let p; try { p = ctx.decodeAudioData(ab, ok, hata); } catch (e) { hata(e); return; } if (p && p.then) p.then(ok, hata); });
  async function getir(ad) {
    try {
      const r = await fetch(YOL + ad + UZANTI); if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = await coz(await r.arrayBuffer()); if (!buf || !buf.length) throw new Error('boş');
      yuklenen++; return buf;
    } catch (e) { hatalar.push(ad + ': ' + (e && e.message || e)); return null; }
  }
  // Sesin gerçekten başladığı an (sn): MP3 çözücüsünün başa eklediği sessizliği atlamak için.
  function basBul(buf) {
    const d = buf.getChannelData(0), n = d.length; let tepe = 0; for (let i = 0; i < n; i += 4) { const a = Math.abs(d[i]); if (a > tepe) tepe = a; }
    const esik = Math.max(.0015, tepe * .02); let i = 0; while (i < n && Math.abs(d[i]) < esik) i++;
    return Math.max(0, i / buf.sampleRate - .003);
  }
  // Dikişsiz döngü tamponu: uçları at, sonu başa eşit güçle bindir.
  function donguYap(buf) {
    const sr = buf.sampleRate, at = Math.round(.1 * sr), N = buf.length - 2 * at, X = Math.min(Math.round(2.5 * sr), N >> 2), M = N - X;
    if (M < sr) return buf; const out = ctx.createBuffer(buf.numberOfChannels, M, sr);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const s = buf.getChannelData(c), o = out.getChannelData(c); o.set(s.subarray(at, at + M));
      for (let i = 0; i < X; i++) { const t = (i + .5) / X * Math.PI / 2; o[i] = s[at + i] * Math.sin(t) + s[at + M + i] * Math.cos(t); }
    }
    return out;
  }
  function ortamBaslat(ad, buf) {
    const src = ctx.createBufferSource(); src.buffer = donguYap(buf); src.loop = true; src.connect(ad === 'ortam_sehir' ? sehirG : ad === 'ortam_su' ? suG : kusG);
    src.start(0, rnd() * Math.max(0, src.buffer.duration - 1)); ortamCalan++;   // her açılışta başka bir yerinden
    if (ortamCalan === 1) ortamAc();
  }
  function ortamAc() { if (!ctx) return; const t = ctx.currentTime; ortamG.gain.cancelScheduledValues(t); ortamG.gain.setTargetAtTime(gorunur ? 1 : 0, t, gorunur ? .7 : .08); }
  function yukle() {
    if (yuklemeBasladi) return; yuklemeBasladi = true;
    const adlar = []; for (const k in TAKIM) { tampon[k] = []; for (let i = 1; i <= TAKIM[k]; i++) adlar.push([k, k + i]); }
    toplam = adlar.length + ORTAM.length;
    adlar.forEach(([k, ad]) => getir(ad).then(b => { if (b) tampon[k].push({ buf: b, bas: basBul(b), ad }); }));
    ORTAM.forEach(ad => getir(ad).then(b => { if (b) try { ortamBaslat(ad, b); } catch (e) { hatalar.push(ad + ' döngü: ' + e.message); } }));
  }
  function init() {
    if (!ctx && !kur()) return;
    if (ctx.state !== 'running' && gorunur) { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
    yukle();
  }

  /* ---------- tek ses çalma ---------- */
  // Takımdan rastgele biri; son çalınan (takım yeterince büyükse son iki) yinelenmez.
  function sec(k) {
    const t = tampon[k]; if (!t || !t.length) return null; if (t.length === 1) return t[0];
    const s = son[k] || (son[k] = []); let i, dene = 0;
    do { i = Math.floor(rnd() * t.length); dene++; } while (dene < 12 && (s.indexOf(t[i].ad) >= 0));
    s.push(t[i].ad); while (s.length > (t.length >= 5 ? 2 : 1)) s.shift(); return t[i];
  }
  function cal(k, o) {
    if (!ctx || ctx.state !== 'running') { sayac.atlanan++; return false; }
    const v = sec(k); if (!v) { sayac.atlanan++; return false; }
    const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime + (o.gecik || 0); src.buffer = v.buf; src.playbackRate.value = o.hiz || 1; g.gain.value = o.duzey == null ? 1 : o.duzey;
    let uc = g;
    if (o.kes) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.kes; f.Q.value = .5; g.connect(f); uc = f; }
    if (o.yan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.yan; uc.connect(p); uc = p; }
    src.connect(g); uc.connect(o.yol || tekG); src.start(t, v.bas); return true;
  }
  const oyna = (r, a) => 1 + (rnd() * 2 - 1) * a;   // 1 ± a
  // Bilinen zeminler olduğu gibi geçer; 'cim' çölde kum, karlı dağda kar takımına döner; bilinmeyen zemin yumuşak zemin (çim) sayılır.
  const ZEMIN = { asfalt: 1, kaldirim: 1, cim: 1, su: 1, kum: 1, kar: 1 };
  function zeminAdi(z) {
    if (!ZEMIN[z]) z = 'cim';
    if (z === 'cim') { try { const b = SO.world.biyom(SO.ps.x, SO.ps.z); if (b === 'col') z = 'kum'; else if (b === 'kar') z = 'kar'; } catch (e) { } }
    return z;
  }
  const TEK = { kum: 1, kar: 1 };                                    // yürüme/koşu ayrımı olmayan takımlar
  const adimTakim = (z, kos) => TEK[z] ? z : z + (kos ? '_kos' : '_yuru');
  const zeminOran = z => z === 'cim' ? AYAR.cimOran : z === 'kum' ? AYAR.kumOran : z === 'kar' ? AYAR.karOran : 1;
  const yumusak = z => z === 'cim' || z === 'kum' || z === 'kar';
  const suAnZemin = () => { try { return SO.world.zemin(SO.ps.x, SO.ps.z); } catch (e) { return 'cim'; } };
  const suDerin = () => { const d = +SO.ps.suDerin; return d > 0 ? d : 0; };

  // Sığ suda adım: bilekte hafif, tiz şıpırtı; bele doğru aynı kayıt daha pes ve gür, üstüne kısık bir su çalkantısı (kulaç kaydı) biner.
  function suAdim(b, duzeyCarp) {
    const v = +b.hiz || 0, d = clamp((suDerin() - .08) / 1.0, 0, 1), k = clamp(v / 2.2, 0, 1), sol = b.ayak === 'l';
    const duzey = AYAR.suAdim * lerp(AYAR.suSig, 1, Math.pow(d, .7)) * lerp(.7, 1, k) * oyna(0, .12) * (duzeyCarp || 1);
    const ok = cal('su_adim', { duzey, hiz: lerp(1.12, .86, d) * oyna(0, .05), yan: sol ? -.1 : .1 });
    if (d > .3) cal('kulac', { duzey: duzey * .5 * d, hiz: 1.12 * oyna(0, .06), yan: sol ? -.1 : .1, gecik: .03 });
    return ok;
  }
  function adim(b) {
    if (!ctx) return; const t = ctx.currentTime; if (t - sonAdimT < .09) return; sonAdimT = t;
    const z = zeminAdi(b.zemin), v = +b.hiz || 0, kos = v > AYAR.kosEsik, T = SO.tune;
    if (z === 'su') { if (suAdim(b)) sayac.adim++; return; }
    const k = clamp((v - T.walk * .8) / (T.sprint - T.walk * .8), 0, 1);          // 0 yavaş yürüyüş … 1 depar
    const duzey = AYAR.adim * lerp(AYAR.yuruOran, 1, Math.pow(k, .8)) * zeminOran(z) * oyna(0, .12);
    // perde: aynı takımın içinde hız arttıkça çok az yükselir; her adımda ±%5 oynar; sol/sağ ayak arasında küçük fark
    const kk = kos ? clamp((v - AYAR.kosEsik) / (T.sprint - AYAR.kosEsik), 0, 1) : clamp((v - .5) / (AYAR.kosEsik - .5), 0, 1);
    const hiz = (TEK[z] ? lerp(.95, 1.07, k) : lerp(.97, 1.03, kk)) * oyna(0, .05) * (b.ayak === 'l' ? .992 : 1.008);   // tek takımda koşu daha kısa ve tiz
    adimRaf.gain.setTargetAtTime(AYAR.dolgun * k, t, .05);                           // koşuda daha dolgun
    if (cal(adimTakim(z, kos), { duzey, hiz, yan: b.ayak === 'l' ? -.07 : .07, yol: adimG })) sayac.adim++;
  }
  function zipla() {
    const z = zeminAdi(suAnZemin());
    if (z === 'su') { suAdim({ hiz: 2.2, ayak: 'l' }, 1.1); suAdim({ hiz: 2.2, ayak: 'r' }, 1); sayac.zipla++; return; }   // sığ sudan sıçrama: iki ayağın sudan çıkışı
    const s = yumusak(z) ? 'cim' : 'sert';
    // kalkış: kaydın kendi kalkış anı (ayakkabının itişi + giysi) ve üstüne o zeminden bir itiş adımı
    const a = cal('zipla_' + s, { duzey: AYAR.zipla * oyna(0, .1), hiz: oyna(0, .04) });
    cal(adimTakim(z, true), { duzey: AYAR.adim * .6 * zeminOran(z), hiz: .92 * oyna(0, .04), yol: adimG });
    if (a) sayac.zipla++;
  }
  function inis(b) {
    const z = zeminAdi(b.zemin), s = yumusak(z) ? 'cim' : 'sert', v = +b.hiz || 0, k = clamp((v - 2) / 4, 0, 1);   // 2 m/sn hafif … 6 m/sn sert
    if (z === 'su') {   // sığ suya iniş: iki ayağın şapırtısı, sert inişte üstüne kısık bir şap
      const a = suAdim({ hiz: 2.2, ayak: 'l' }, lerp(1, 1.5, k)); suAdim({ hiz: 2.2, ayak: 'r' }, lerp(.9, 1.3, k));
      if (k > .25) cal('su_gir', { duzey: AYAR.suGir * .55 * k, hiz: 1.18 * oyna(0, .04) });
      if (a) sayac.in++; if (ctx) sonAdimT = ctx.currentTime; return;
    }
    // sert iniş: iki ayakla yere vuruş kaydı tam düzeyde ve açık; hafif iniş: aynı kayıt kısık ve tizleri alınmış
    const a = cal('in_' + s, { duzey: AYAR.inis * lerp(.28, 1, k) * oyna(0, .08), hiz: lerp(1.05, .97, k) * oyna(0, .03), kes: lerp(1600, 16000, k * k) });
    // hafif inişte iki ayağın ardışık değişi: o zeminden iki adım, 35 ms arayla
    if (k < .5) { const d = AYAR.adim * .55 * (1 - k) * zeminOran(z), tk = adimTakim(z, true); cal(tk, { duzey: d, hiz: .96, yan: -.07, yol: adimG }); cal(tk, { duzey: d * .9, hiz: 1.02, yan: .07, gecik: .035, yol: adimG }); }
    if (a) sayac.in++; if (ctx) sonAdimT = ctx.currentTime;   // inişle aynı ana düşen adım sesi çalmasın
  }

  /* ---------- su ve tırmanma ---------- */
  function suGir(b) {   // gövdenin suya girip yüzmeye başlaması: orta boy şap; hızlı girişte daha gür ve biraz daha pes
    const k = clamp((+b.hiz || 0) / 3.5, 0, 1);
    if (cal('su_gir', { duzey: AYAR.suGir * lerp(.6, 1, k) * oyna(0, .08), hiz: lerp(1.08, .96, k) * oyna(0, .04) })) sayac.su_gir++;
    if (ctx) { sonAdimT = ctx.currentTime + .15; sonKulacT = ctx.currentTime + .1; }   // şapın hemen ardından adım/kulaç sesi binmesin
  }
  function suCik() {    // sudan çıkış: giysiden suyun süzülmesi, birkaç damla
    if (cal('su_cik', { duzey: AYAR.suCik * oyna(0, .1), hiz: oyna(0, .06) })) sayac.su_cik++;
  }
  function kulac(b) {   // her kulaç: elin suya girişi ve çekiş; eller sırayla hafifçe sola/sağa
    if (!ctx) return; const t = ctx.currentTime; if (t - sonKulacT < .28) return; sonKulacT = t;
    const k = clamp(((+b.hiz || 0) - 1) / 1.5, 0, 1); elSira ^= 1;
    if (cal('kulac', { duzey: AYAR.kulac * lerp(.8, 1.15, k) * oyna(0, .12), hiz: lerp(.94, 1.06, k) * oyna(0, .05), yan: elSira ? -.14 : .14 })) sayac.kulac++;
  }
  function tutun() {    // elin kayaya basması: taşa kısa, kuru, tok vuruş (tizleri alınmış)
    if (!ctx) return; const t = ctx.currentTime; if (t - sonTutunT < .07) return; sonTutunT = t; elSira ^= 1;
    if (cal('tutun', { duzey: AYAR.tutun * oyna(0, .15), hiz: .9 * oyna(0, .08), kes: 3800, yan: elSira ? -.12 : .12 })) sayac.tutun++;
  }
  function tirman(b) {  // kendini yukarı çekip üste çıkma: itiş eforu (ayakkabı + giysi) → ayakların sırayla taşın üstüne basışı. Süpürme sesi yok.
    const h = clamp(+b.yukseklik || 1, .3, 2), g = lerp(.2, .5, clamp((h - .5) / 1.3, 0, 1)), d = AYAR.tirman;
    const a = cal('zipla_sert', { duzey: d * lerp(.7, 1, (h - .3) / 1.7) * oyna(0, .1), hiz: .9 * oyna(0, .05) });
    cal('tutun', { duzey: d * .5, hiz: .8 * oyna(0, .06), kes: 3000 });
    cal('kaldirim_yuru', { duzey: d * AYAR.adim * .42, hiz: .94 * oyna(0, .04), yan: -.08, gecik: g, yol: adimG });
    cal('kaldirim_yuru', { duzey: d * AYAR.adim * .36, hiz: 1.02 * oyna(0, .04), yan: .08, gecik: g + .17 + .05 * h, yol: adimG });
    if (a) sayac.tirman++; if (ctx) sonAdimT = ctx.currentTime + g + .2;
  }
  const OLAY = { adim, zipla, in: inis, su_gir: suGir, su_cik: suCik, kulac, tutun, tirman };
  function olay(ad, bilgi) {
    try { const f = OLAY[ad]; if (f) f(bilgi || {}); }
    catch (e) { if (hatalar.length < 20) hatalar.push('olay ' + ad + ': ' + e.message); }
  }

  // Suya yakınlık (0..1): oyuncunun bulunduğu yer ve çevresinde 8 yönde 4, 10 ve suUzak m'de su var mı. Suyun içinde 1, kıyıda ~0,8, 10 m'de ~0,5, 30 m'de ~0,15.
  function suYakinlik() {
    const w = SO.world, ps = SO.ps; if (!w || !w.suDerinlik) return 0;
    if (suDerin() > .05 || w.suDerinlik(ps.x, ps.z) > .05) return 1;
    const R = [4, 10, AYAR.suUzak], say = [0, 0, 0];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, sx = Math.sin(a), cz = Math.cos(a); for (let r = 0; r < 3; r++) if (w.suDerinlik(ps.x + sx * R[r], ps.z + cz * R[r]) > .05) say[r]++; }
    const pay = (n, a, b) => n ? a + (b - a) * Math.min(1, (n - 1) / 3) : 0;       // o halkada su gören yön sayısı arttıkça (koy, nehir kıvrımı) biraz daha gür
    return Math.max(pay(say[0], .7, .9), pay(say[1], .4, .6), pay(say[2], .12, .28));
  }

  /* ---------- ortam ---------- */
  function update(dt) {
    if (!ctx || !ortamCalan) return;
    let y = 'sehir';
    try { const w = SO.world, ps = SO.ps; if (w.zemin(ps.x, ps.z) === 'cim') y = (Math.abs(ps.x) <= w.HALF && Math.abs(ps.z) <= w.HALF) ? 'park' : 'kir'; } catch (e) { }
    yer = y;
    let hs = AYAR.ortam * (y === 'park' ? AYAR.parkSehir : y === 'kir' ? AYAR.kirSehir : 1), hk = AYAR.kus * (y === 'park' ? 1 : y === 'kir' ? AYAR.kirKus : 0);
    try { if (SO.world.ortam) { const o = SO.world.ortam(SO.ps.x, SO.ps.z); hs = AYAR.ortam * o.sehir; hk = AYAR.kus * o.kus; yer = 'arazi'; } } catch (e) { } // açık dünya: düzeyleri dünya söyler (şehir uğultusu yok, kuşlar çayır ve ormanda)
    if (hs !== hedefSehir || hk !== hedefKus) {     // yalnız hedef değişince zamanla: her karede yazmak cızırtı yapar
      const t = ctx.currentTime; hedefSehir = hs; hedefKus = hk;
      sehirG.gain.cancelScheduledValues(t); sehirG.gain.setTargetAtTime(hs, t, AYAR.gecis);
      kusG.gain.cancelScheduledValues(t); kusG.gain.setTargetAtTime(hk, t, hk > 0 ? AYAR.gecis : AYAR.gecis * .7);
    }
    suSayac += dt;
    if (suSayac >= AYAR.suOrnek) {                  // su ortamı: yakınlık seyrek ölçülür, düzey yumuşak geçer
      suSayac = 0; try { suYakin = suYakinlik(); } catch (e) { suYakin = 0; }
      const h = Math.round(AYAR.su * suYakin * (SO.ps.yuzme ? AYAR.suYuzme : 1) * 50) / 50;
      if (h !== hedefSu) { const t = ctx.currentTime; hedefSu = h; suG.gain.cancelScheduledValues(t); suG.gain.setTargetAtTime(h, t, AYAR.suGecis); }
    }
    if (anaG.gain.value !== AYAR.ana) anaG.gain.value = AYAR.ana;
  }
  // Sayfa görünmez olunca (başka sekme, ekran kilidi, uygulamadan çıkış) ortam susar ve ses bağlamı durur; dönünce sürer.
  document.addEventListener('visibilitychange', () => {
    gorunur = document.visibilityState !== 'hidden'; if (!ctx) return;
    try {
      if (!gorunur) { ortamG.gain.cancelScheduledValues(ctx.currentTime); ortamG.gain.value = 0; const p = ctx.suspend(); if (p && p.catch) p.catch(() => { }); }
      else { const p = ctx.resume(); if (p && p.catch) p.catch(() => { }); if (ortamCalan) ortamAc(); }
    } catch (e) { }
  });

  function durum() {
    const takim = {}; for (const k in tampon) takim[k] = tampon[k].length;
    return { baglam: ctx ? ctx.state : 'yok', ornekHizi: ctx ? ctx.sampleRate : 0, yuklenen, toplam, hazir: toplam > 0 && yuklenen === toplam, hatalar: hatalar.slice(), takim, ortamCalan, yer, gorunur, suYakin: +suYakin.toFixed(2),
      duzey: ctx ? { ortam: +ortamG.gain.value.toFixed(3), sehir: +sehirG.gain.value.toFixed(3), kus: +kusG.gain.value.toFixed(3), su: +suG.gain.value.toFixed(3) } : null, sayac: Object.assign({}, sayac) };
  }
  SO.ses = { init, update, olay, durum, ayar: AYAR };
})();
