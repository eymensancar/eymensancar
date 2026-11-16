/* Yürüme ("oynama") aracı: oyuncuyu komut listesiyle gerçek fizik/hareketle yürütür; belirli aralıkla oyun kamerasından kare alıp numaralı
   kontak tabakasına dizer ve ayrıntılı JSON günlük yazar. Gerçek zamandan hızlı çalışır (yalnız kare anlarında çizer).
   Kullanım:  node test/yuru.cjs <senaryo.json | '{...}'> [çıktı.png] [--ciz]
   Senaryo:
     { "tasarim": "deneme",            // isteğe bağlı: bölge verisi (?tasarim=...)
       "basla": "dogus" | [x, z] | "<nokta id/adı>",  "bak": 90,      // başlangıç yeri ve pusula yönü (0 kuzey, 90 doğu)
       "kare": 3,                      // kaç saniyede bir kare (oyun süresi); 0 = yalnız komut sonlarında
       "gunluk": 0.5,                  // günlük aralığı (sn)
       "boyut": [480, 270], "sutun": 4, "enCok": 900,    // kare boyutu, tabaka sütunu, en çok oyun süresi (sn)
       "komutlar": [
         { "git": [x, z] | "<nokta>", "hiz": "yuru" | "kos" | "depar", "yakin": 1.5, "sure": 120 },   // hedefe yürü (varsayılan hız: kos = hafif koşu 3,6 m/sn)
         { "bak": 180 },               // kamerayı ve karakteri pusula yönüne çevir
         { "bekle": 2 },               // saniye
         { "kos": true },              // bundan sonraki git komutlarının varsayılan hızı: true = depar (KOŞ düğmesi), false = hafif koşu
         { "zipla": true },
         { "topla": 3, "uzak": 25 }    // yakındaki (en çok `uzak` m) dal/taşa gidip alır; sayı = kaç tane
       ] }
   git: yön = hedefe; kamera arkadan izler. İlerleme durursa sırayla zıplama (kayaya tırmanma) ve yandan dolanma dener; yine olmazsa "takildi" olayı yazıp komutu bırakır.
   Çıktılar: <çıktı>.png (kontak tabakası), <çıktı>.json = { ozet, komutlar, olaylar, gunluk }.
     gunluk satırı: t, x, z, y, hiz, egim, biyom, su (derinlik), yuzme, komut, onde { agac, kaya } (öndeki 60° koni, 100 m), yakin { agac, kaya, su, dal, tas } (m), noktalar [{ ad, tur, uzak }]
     olaylar: vardi, takildi, kacinma, zipladi, tirmandi, yuzuyor, sudan_cikti, topladi, dik_yamac (45°'den dik yerde yürüdü: fizik engellemiyor ama tasarımda geçilmez sayılır), zaman_asimi
   --ciz: her adımı çizer (yavaş); çizimsiz hızlandırmanın fizik sonucunu değiştirmediğini doğrulamak için. */
const { ac, arglar, diz, gecici } = require('./ortak.cjs'); const fs = require('fs'), path = require('path');
(async () => {
  const a = arglar(process.argv), arg = a._[0]; if (!arg) { console.error('Kullanım: node test/yuru.cjs <senaryo.json | \'{...}\'> [çıktı.png] [--ciz]'); process.exit(1); }
  const sen = JSON.parse(arg.trim().startsWith('{') ? arg : fs.readFileSync(arg, 'utf8')), cikti = a._[1] || 'yuru.png', [W, H] = sen.boyut || [480, 270], t0 = Date.now();
  const o = await ac({ boyut: [W, H], tasarim: sen.tasarim || a.tasarim }), tmp = gecici('yuru'), kareler = [];
  try {
    await o.pg.evaluate(kur, { sen, ciz: !!a.ciz });
    for (;;) { const r = await o.pg.evaluate(() => window.YR.ilerle());
      if (r.kare) { const f = path.join(tmp, `k${String(kareler.length).padStart(3, '0')}.png`); await o.pg.screenshot({ path: f, timeout: 120000 }); kareler.push({ dosya: f, yazi: `${kareler.length + 1} · ${r.t.toFixed(0)} sn · (${Math.round(r.x)}, ${Math.round(r.z)}) · ${r.durum}` }); }
      if (r.bitti) break; }
    const son = await o.pg.evaluate(() => window.YR.sonuc()); son.ozet.gercek_sure_sn = +((Date.now() - t0) / 1000).toFixed(1); son.ozet.kare = kareler.length;
    if (kareler.length) diz(kareler, cikti, sen.sutun || 4);
    const jf = cikti.replace(/\.png$/, '') + '.json'; fs.writeFileSync(jf, JSON.stringify(son));
    console.log(JSON.stringify({ cikti, gunluk: jf, ozet: son.ozet, komutlar: son.komutlar, olaylar: son.olaylar.slice(0, 40), hata: o.hatalar.slice(0, 5) }, null, 1));
  } finally { await o.kapat(); }
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });

function kur(A) {
  const SO = window.SO, W = SO.world, TA = window.TA, ps = SO.ps, sen = A.sen, DT = 1 / 60, wrapA = SO.wrapA;
  const b = TA.nokta(sen.basla || 'dogus'); TA.git(b.x, b.z, sen.bak == null ? 0 : sen.bak); SO.cam.mode = 'takip'; SO.cam.pitch = .16;
  const gercekCiz = SO.renderer.render, bos = () => { }; if (!A.ciz) SO.renderer.render = bos;
  const kareAra = sen.kare == null ? 3 : sen.kare, gunAra = sen.gunluk || .5, enCok = sen.enCok || 900;
  const komutlar = (sen.komutlar || []).map(k => Object.assign({}, k)), gunluk = [], olaylar = [], sonuclar = [];
  let t = 0, ki = -1, K = null, sonKare = -1e9, sonGun = -1e9, yol = 0, depar = false, adim = 0, kareIste = false, bitti = false;
  let yuzuyordu = false, tirmaniyordu = false, dikAt = -9, havadaydi = false;
  const olay = (tur, ek) => olaylar.push(Object.assign({ t: +t.toFixed(2), tur, x: +ps.x.toFixed(1), z: +ps.z.toFixed(1), komut: ki }, ek || {}));
  const yerde = () => { const T = SO.toplama; const L = []; if (T && T.hucreler) T.hucreler.forEach(H => { for (const q of H.ogeler) L.push(q); }); return L; };
  const envSay = () => { let n = 0; const s = (SO.envanter && SO.envanter.say) || {}; for (const k in s) n += s[k]; return n; };
  function sonraki() {
    if (K) { K.son.bitis = +t.toFixed(2); K.son.sure = +(t - K.t0).toFixed(2); K.son.yol = +(yol - K.yol0).toFixed(1); K.son.x = +ps.x.toFixed(1); K.son.z = +ps.z.toFixed(1); sonuclar.push(K.son); if (!kareAra) kareIste = true; }
    ki++; SO.joy.x = SO.joy.y = 0; SO.input.run = false; if (ki >= komutlar.length) { K = null; bitti = true; return; }
    const k = komutlar[ki]; K = { k, t0: t, yol0: yol, son: { no: ki, komut: k, sonuc: 'tamam' }, faz: 0, tz: t };
    if (k.git != null) { const h = TA.nokta(k.git); K.hx = h.x; K.hz = h.z; K.d0 = Math.hypot(h.x - ps.x, h.z - ps.z); K.yakin = k.yakin || 1.5; K.hiz = k.hiz || (depar ? 'depar' : 'kos'); const v = K.hiz === 'yuru' ? 1.4 : K.hiz === 'depar' ? 6 : 3.4; K.sure = k.sure || K.d0 / v * 2.5 + 40; gitSifirla(); K.son.uzaklik = +K.d0.toFixed(1); }
    else if (k.bak != null) { ps.yaw = SO.cam.yaw = TA.yaw(k.bak); K.sure = .4; }
    else if (k.bekle != null) K.sure = +k.bekle;
    else if (k.kos != null) { depar = !!k.kos; K.sure = 0; }
    else if (k.zipla) { SO.input.jump = true; olay('zipladi'); K.sure = .9; }
    else if (k.topla) { K.kalan = k.topla === true ? 1 : +k.topla; K.alinan = 0; K.sure = 40 * K.kalan; K.env = envSay(); K.hedef = null; }
    else throw new Error('bilinmeyen komut: ' + JSON.stringify(k));
  }
  function gitSifirla() { K.kx = ps.x; K.kz = ps.z; K.kt = t; K.deneme = 0; K.sap = 0; K.sapBit = 0; K.enYakin = 1e9; K.enYakinT = t; }
  // hedefe doğru sür: kamera yönü hedefe yumuşakça döner, çubuk hedefe (± kaçınma sapması) itilir. true = vardı
  function sur(hx, hz, yakin, hiz) {
    const dx = hx - ps.x, dz = hz - ps.z, d = Math.hypot(dx, dz); if (d < yakin) { SO.joy.x = SO.joy.y = 0; SO.input.run = false; return true; }
    const hd = Math.atan2(dx, dz) + (t < K.sapBit ? K.sap : 0); SO.cam.yaw = wrapA(SO.cam.yaw + wrapA(Math.atan2(dx, dz) - SO.cam.yaw) * (1 - Math.exp(-3.5 * DT)));
    const cy = SO.cam.yaw, hxn = Math.sin(hd), hzn = Math.cos(hd), m = hiz === 'yuru' ? .5 : 1; SO.joy.y = (hxn * Math.sin(cy) + hzn * Math.cos(cy)) * m; SO.joy.x = (-hxn * Math.cos(cy) + hzn * Math.sin(cy)) * m; SO.input.run = hiz === 'depar';
    if (d < K.enYakin - .5) { K.enYakin = d; K.enYakinT = t; }
    // takılma: 1,5 sn'de 0,6 m'den az yer değiştirdiyse sırayla zıpla / yandan dolan
    if (t - K.kt >= 1.5) { const yer = Math.hypot(ps.x - K.kx, ps.z - K.kz); K.kx = ps.x; K.kz = ps.z; K.kt = t;
      if (yer < .6 && !ps.kilit && !(ps.toplaBlend > .1)) { K.deneme++; const D = [['zipla'], ['sap', 1.05, 1.6], ['zipla'], ['sap', -1.05, 2.2], ['sap', 1.75, 2.8], ['sap', -1.75, 2.8], ['zipla']][K.deneme - 1];
        if (!D) { olay('takildi', { hedefe: +d.toFixed(1), egim: +TA.egim(ps.x, ps.z).toFixed(2), su: +(ps.suDerin || 0).toFixed(2) }); K.son.sonuc = 'takildi'; K.son.kalan = +d.toFixed(1); return 'birak'; }
        if (D[0] === 'zipla') { SO.input.jump = true; olay('kacinma', { ne: 'zipla' }); } else { K.sap = D[1]; K.sapBit = t + D[2]; olay('kacinma', { ne: 'dolan', aci: Math.round(D[1] * 57.3) }); } }
      else if (yer > 2.5) K.deneme = Math.max(0, K.deneme - 1); }
    if (t - K.enYakinT > 25) { olay('takildi', { hedefe: +d.toFixed(1), neden: 'yaklasamiyor' }); K.son.sonuc = 'takildi'; K.son.kalan = +d.toFixed(1); return 'birak'; }
    return false;
  }
  function komutAdim() {
    const k = K.k;
    if (k.git != null) { const r = sur(K.hx, K.hz, K.yakin, K.hiz); if (r === true) { olay('vardi'); sonraki(); } else if (r === 'birak') sonraki(); else if (t - K.t0 > K.sure) { olay('zaman_asimi', { hedefe: +Math.hypot(K.hx - ps.x, K.hz - ps.z).toFixed(1) }); K.son.sonuc = 'zaman_asimi'; sonraki(); } return; }
    if (k.topla) { const n = envSay(); if (n > K.env) { K.alinan += n - K.env; K.env = n; K.kalan--; K.hedef = null; olay('topladi', { toplam: n }); if (K.kalan <= 0) { K.son.alinan = K.alinan; sonraki(); return; } }
      if (t - K.t0 > K.sure) { K.son.sonuc = K.alinan ? 'eksik' : 'bulunamadi'; K.son.alinan = K.alinan; sonraki(); return; }
      if (SO.toplama && SO.toplama.yakin && !(ps.toplaBlend > .05)) { SO.joy.x = SO.joy.y = 0; if (t - K.tz > .5) { SO.input.act = true; K.tz = t; } return; }
      if (ps.toplaBlend > .05) { SO.joy.x = SO.joy.y = 0; return; }
      if (!K.hedef) { let en = null, ed = k.uzak || 25; for (const q of yerde()) { const d = Math.hypot(q.x - ps.x, q.z - ps.z); if (d < ed && W.groundY(q.x, q.z) > -.2) { ed = d; en = q; } } if (!en) { K.son.sonuc = K.alinan ? 'eksik' : 'bulunamadi'; K.son.alinan = K.alinan; sonraki(); return; } K.hedef = { x: en.x, z: en.z, tur: en.tur }; gitSifirla(); }
      const r = sur(K.hedef.x, K.hedef.z, .75, 'yuru'); if (r === 'birak') { K.son.sonuc = 'takildi'; sonraki(); } return; }
    if (t - K.t0 >= K.sure) sonraki();
  }
  function satir() {
    const N = TA.nesneler(), fx = Math.sin(ps.yaw), fz = Math.cos(ps.yaw), on = { agac: 0, kaya: 0 }, yk = { agac: null, kaya: null, su: null, dal: null, tas: null }, c30 = Math.cos(Math.PI / 6);
    for (const n of N) { if (n.sinif !== 'agac' && n.sinif !== 'kaya') continue; const dx = n.x - ps.x, dz = n.z - ps.z, d = Math.hypot(dx, dz); if (yk[n.sinif] == null || d < yk[n.sinif]) yk[n.sinif] = d; if (d < 100 && d > .01 && (dx * fx + dz * fz) / d > c30) on[n.sinif]++; }
    for (const q of yerde()) { const d = Math.hypot(q.x - ps.x, q.z - ps.z); if (q.tur in yk && (yk[q.tur] == null || d < yk[q.tur])) yk[q.tur] = d; }
    yk.su = TA.suUzak(ps.x, ps.z, 300); for (const k in yk) if (yk[k] != null) yk[k] = +yk[k].toFixed(1);
    const nk = TA.noktalar().map(n => ({ ad: n.ad || n.id, tur: n.tur, uzak: +Math.hypot(n.x - ps.x, n.z - ps.z).toFixed(0) })).sort((p, q) => p.uzak - q.uzak).slice(0, 4);
    return { t: +t.toFixed(2), x: +ps.x.toFixed(2), z: +ps.z.toFixed(2), y: +ps.y.toFixed(2), hiz: +ps.speed.toFixed(2), egim: +TA.egim(ps.x, ps.z).toFixed(3), biyom: W.biyom(ps.x, ps.z), su: +(ps.suDerin || 0).toFixed(2), yuzme: !!ps.yuzme, komut: ki, onde: on, yakin: yk, noktalar: nk };
  }
  const durumYazi = () => { if (!K) return 'bitti'; const k = K.k; return k.git != null ? 'git → ' + (typeof k.git === 'string' ? k.git : Math.round(K.hx) + ',' + Math.round(K.hz)) + ' (' + Math.round(Math.hypot(K.hx - ps.x, K.hz - ps.z)) + ' m)' : Object.keys(k)[0]; };
  sonraki();
  window.YR = {
    // bir sonraki kare anına (ya da sona) kadar adımlar
    ilerle() {
      const basT = performance.now();
      while (!bitti && t < enCok) {
        const kareAni = kareIste || (kareAra > 0 && t - sonKare >= kareAra - 1e-6), px = ps.x, pz = ps.z;
        if (K) komutAdim(); if (bitti) break;
        if (kareAni && !A.ciz) SO.renderer.render = gercekCiz;
        SO.step(DT); t += DT; adim++; if (kareAni && !A.ciz) SO.renderer.render = bos; if (A.ciz) SO.renderer.getContext().finish();
        if (W.durum().kuyruk > 0) TA.yukle(); // çevre hep tam yüklü: sonuç çizim hızından bağımsız
        yol += Math.hypot(ps.x - px, ps.z - pz);
        if (!!ps.yuzme !== yuzuyordu) { yuzuyordu = !!ps.yuzme; olay(yuzuyordu ? 'yuzuyor' : 'sudan_cikti'); }
        if (!!ps.tirman !== tirmaniyordu) { tirmaniyordu = !!ps.tirman; if (tirmaniyordu) olay('tirmandi', { tur: ps.tirman }); }
        if (!ps.grounded && !havadaydi && ps.vy > 3 && !ps.kilit) olay('zipladi'); havadaydi = !ps.grounded;
        if (ps.speed > .5 && ps.grounded && !ps.yuzme && t - dikAt > 3 && TA.egim(ps.x, ps.z) > 1) { dikAt = t; olay('dik_yamac', { egim: +TA.egim(ps.x, ps.z).toFixed(2) }); }
        if (t - sonGun >= gunAra - 1e-6) { sonGun = t; gunluk.push(satir()); }
        if (kareAni) { sonKare = t; kareIste = false; return { kare: true, bitti: false, t, x: ps.x, z: ps.z, durum: durumYazi() }; }
        if (performance.now() - basT > (A.ciz ? 1500 : 20000)) return { kare: false, bitti: false, t };
      }
      if (t >= enCok && !bitti) { olay('zaman_asimi', { neden: 'enCok' }); bitti = true; }
      SO.renderer.render = gercekCiz; SO.joy.x = SO.joy.y = 0; SO.step(DT); t += DT; gunluk.push(satir());
      return { kare: true, bitti: true, t, x: ps.x, z: ps.z, durum: 'son' };
    },
    sonuc() {
      const ilk = (f) => { const r = gunluk.find(f); return r ? r.t : null; }, say = tur => olaylar.filter(o => o.tur === tur).length;
      let bosEn = 0, bosBas = null; for (const r of gunluk) { const dolu = (r.yakin.agac != null && r.yakin.agac < 40) || (r.yakin.kaya != null && r.yakin.kaya < 40) || (r.yakin.su != null && r.yakin.su < 40) || (r.noktalar[0] && r.noktalar[0].uzak < 60); if (dolu) bosBas = null; else { if (bosBas == null) bosBas = r.t; bosEn = Math.max(bosEn, r.t - bosBas); } }
      return { ozet: { sure_sn: +t.toFixed(1), yol_m: +yol.toFixed(1), ortalama_hiz: +(yol / Math.max(t, .01)).toFixed(2), adim, son: [+ps.x.toFixed(2), +ps.z.toFixed(2), +ps.y.toFixed(2)], envanter: Object.assign({}, (SO.envanter && SO.envanter.say) || {}),
          takildi: say('takildi'), kacinma: say('kacinma'), yuzme: say('yuzuyor'), tirmanma: say('tirmandi'), dik_yamac: say('dik_yamac'),
          ilk_agac_5m_sn: ilk(r => r.yakin.agac != null && r.yakin.agac < 5), ilk_kaya_5m_sn: ilk(r => r.yakin.kaya != null && r.yakin.kaya < 5), ilk_su_5m_sn: ilk(r => r.yakin.su != null && r.yakin.su < 5),
          en_uzun_bos_sn: +bosEn.toFixed(1) /* 40 m içinde ağaç/kaya/su ve 60 m içinde ilgi noktası olmadan geçen en uzun süre */ },
        komutlar: sonuclar, olaylar, gunluk };
    }
  };
}
