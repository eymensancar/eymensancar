// Oyuncu ilgisi: oyuncunun oyunda nereye baktığını cihazda sayar, bundan "şu an neyle ilgileniyor" çıkarır ve
// sohbet kanalına ne kadar, hangi konuda yön verileceğine karar verir (npc-yz.js → kanalAkisi'nin `ilgi` girdisi).
// Kayıt K.ilgi'de durur, hiçbir yere gönderilmez (YZ_VERI_URL kuyruğuna da girmez). Boyutu sınırlıdır: sayaçlar,
// son 40 olaylık halka, konu başına tek bir "sıcaklık" puanı. Olay başına iş: bir sayaç artışı ve bir çarpma.
(function (g) {
  const IL = {};
  const DK = 60e3, SA = 3600e3, GUN = 864e5;
  const YARI_OMUR = 45 * DK;          // ilgi puanı 45 dakikada yarıya iner ("şu an" ilgisi)
  const HALKA = 40, EN_COK_ANAHTAR = 64;
  const ERKEN = 14 * GUN;             // ilk iki hafta: tiyolar sık, sonra seyrek
  const OTURUM_ARA = 5 * DK;          // bu kadar aradan sonra yeni oturum sayılır
  const ISINMA = 2 * DK;              // oyuncu oluşturulduktan sonra ilk tiyo için bekleme (ilk karşılama bitsin)

  // Bakılan yer -> ilgi konusu. Yer anahtarları: e:ekran, p:panel[:sekme], u:telefon uygulaması, s:sohbet kanalı
  function yerKonu(a) {
    if (a === 'p:kariyer:1' || a === 'p:kariyer:2') return 'is';
    if (a === 'p:kariyer:3' || a === 'p:kariyer:4' || a === 'p:projeler' || a === 'p:gecmis') return 'isletme';
    if (a === 'p:kariyer:kurs') return 'kurs';
    if (a === 'p:banka' || a === 'u:Bankam') return 'kredi';
    if (a === 'p:mulk') return 'mulk';
    if (a === 'p:ilan' || a === 'p:basvurular' || a === 'p:calisanlar') return 'eleman';
    return null;
  }
  // İlk girişte "yapıldı" sayılan şeyler (tiyolar bunlara göre kesilir)
  function yerYapti(a) {
    if (a.startsWith('p:kariyer')) return a === 'p:kariyer:kurs' ? ['kariyer', 'kurs'] : ['kariyer'];
    if (a === 'p:banka') return ['banka'];
    if (a === 'p:mulk') return ['mulk'];
    if (a === 'p:ilan') return ['ilan'];
    if (a === 's:dm') return ['dm'];
    if (a.startsWith('u:')) return ['telefon'];
    return null;
  }

  // Tiyolar: henüz yapılmamış şeyler, öncelik sırasıyla. uygun(d): oyuncunun durumu (patron, issiz, gorevli, kursta, kum)
  const TIYO = [
    ['tiyo-kariyer', 'kariyer', d => !d.patron],
    ['tiyo-gorev', 'gorev', d => d.gorevli],
    ['tiyo-dm', 'dm', () => true],
    ['tiyo-gunluk', 'gunluk', d => d.gorevli],
    ['tiyo-telefon', 'telefon', () => true],
    ['tiyo-kurs', 'kurs', d => !d.patron],
    ['tiyo-banka', 'banka', () => true],
    ['tiyo-mulk', 'mulk', () => true],
    ['tiyo-kumsaati', 'kumsaati', d => d.kum > 0 || d.kursta],
    ['tiyo-ilan', 'ilan', d => d.patron],
  ];
  IL.TIYO = TIYO.map(x => x[0]);

  const gunNo = t => { const d = new Date(t); return Math.floor((t - d.getTimezoneOffset() * DK) / GUN); };

  IL.yeni = function (simdi, cikar) {
    const r = { v: 1, ilk: simdi, o: { n: 0, top: 0, bas: 0, akt: 0, cik: 0, enUzun: 0, sa: new Array(24).fill(0) },
      g: { son: 0, seri: 0, enSeri: 0, top: 0 }, e: {}, b: {}, a: {}, y: {}, p: {}, s: [], t: {}, k: { son: 0, konu: {}, dm: 0 }, yer: null };
    if (cikar) { if (cikar.ilk && cikar.ilk < simdi) r.ilk = cikar.ilk; for (const k of cikar.yapti || []) r.y[k] = r.ilk; }
    return r;
  };
  /** Eski kayıtta alan yoksa ya da eksikse tamamlar (eski kayıtlar bozulmaz). */
  IL.hazirla = function (r, simdi, cikar) {
    if (!r || typeof r !== 'object' || r.v !== 1) return IL.yeni(simdi, cikar);
    const b = IL.yeni(r.ilk || simdi);
    for (const k of Object.keys(b)) if (r[k] == null || typeof r[k] !== typeof b[k]) r[k] = b[k];
    for (const alan of ['o', 'g', 'k']) for (const k of Object.keys(b[alan])) if (typeof r[alan][k] !== typeof b[alan][k]) r[alan][k] = b[alan][k];
    if (!Array.isArray(r.o.sa) || r.o.sa.length !== 24) r.o.sa = b.o.sa;
    if (!Array.isArray(r.s)) r.s = [];
    if (r.yer && !Array.isArray(r.yer)) r.yer = null;
    return r;
  };

  function sinirla(o) { const ks = Object.keys(o); if (ks.length <= EN_COK_ANAHTAR) return; ks.sort((a, b) => (+o[a][0] || +o[a] || 0) - (+o[b][0] || +o[b] || 0)).slice(0, ks.length - EN_COK_ANAHTAR).forEach(k => delete o[k]); }
  function halka(r, simdi, kod) { r.s.push([Math.round((simdi - r.ilk) / 1000), kod]); if (r.s.length > HALKA) r.s.splice(0, r.s.length - HALKA); }
  /** Konu puanı: üstel sönümlü tek sayı ([puan, zaman]). */
  function puanEkle(r, simdi, konu, w) { if (!konu || !w) return; const x = r.p[konu] || [0, simdi]; x[0] = Math.round((x[0] * Math.pow(.5, (simdi - x[1]) / YARI_OMUR) + w) * 100) / 100; x[1] = simdi; r.p[konu] = x; }
  const puanSimdi = (x, simdi) => x ? x[0] * Math.pow(.5, (simdi - x[1]) / YARI_OMUR) : 0;

  IL.yapti = function (r, ad, simdi) { if (ad && !r.y[ad]) r.y[ad] = simdi; };
  IL.aktif = function (r, simdi) { r.o.akt = simdi; };

  /** Oyuncu bir yere girdi (ekran, panel, uygulama, kanal). Önceki yerin süresi ve sayısı kapanırken yazılır. */
  IL.yer = function (r, simdi, a) {
    const y = r.yer;
    if (y && y[0] === a) return;
    if (y) yerKapat(r, simdi);
    if (!a) { r.yer = null; return; }
    r.yer = [a, simdi];
    const yp = yerYapti(a); if (yp) yp.forEach(k => IL.yapti(r, k, simdi));
    r.o.akt = simdi;
  };
  function yerKapat(r, simdi) {
    const [a, t0] = r.yer; r.yer = null;
    const sure = Math.min(simdi - t0, 15 * DK); // uzun boşta kalma tek seferde 15 dakikadan fazla sayılmaz
    if (!(sure >= 300)) return;                  // geçişte bir anlık uğranan yer sayılmaz
    const x = r.e[a] || (r.e[a] = [0, 0]); x[0]++; x[1] += Math.round(sure); sinirla(r.e);
    halka(r, simdi, a);
    const k = yerKonu(a); if (k) puanEkle(r, simdi, k, 1 + Math.min(2, sure / DK * .5));
  }
  /** Bir şeye bakıldı ya da basıldı (meslek kartı, kurs, mülk, kredi...). */
  IL.bak = function (r, simdi, anahtar, konu, w) {
    r.b[anahtar] = (r.b[anahtar] || 0) + 1; sinirla(r.b);
    halka(r, simdi, 'b:' + anahtar); puanEkle(r, simdi, konu, w == null ? 1.2 : w); r.o.akt = simdi;
  };
  /** Ayar değişti (tema, yapay zekâ izni; ileride ses seviyesi, titreşim...). Ayar yapan oyuncu oyunu benimsemiştir. */
  IL.ayar = function (r, simdi, ad, deger) {
    const x = r.a[ad] || (r.a[ad] = [0, null]); x[0]++; x[1] = deger; halka(r, simdi, 'a:' + ad); r.o.akt = simdi;
  };

  IL.oturumBasla = function (r, simdi) {
    const o = r.o;
    if (o.bas && simdi - (o.akt || o.bas) < OTURUM_ARA) { o.akt = simdi; return false; }
    if (o.bas) IL.oturumBitir(r, o.akt || o.bas);
    o.n++; o.bas = simdi; o.akt = simdi; o.sa[new Date(simdi).getHours()]++;
    const bugun = gunNo(simdi), gg = r.g;
    if (gg.son !== bugun) { gg.seri = gg.son === bugun - 1 ? gg.seri + 1 : 1; gg.son = bugun; gg.top++; if (gg.seri > gg.enSeri) gg.enSeri = gg.seri; }
    halka(r, simdi, 'oturum');
    return true;
  };
  IL.oturumBitir = function (r, simdi) {
    const o = r.o; if (r.yer) yerKapat(r, simdi);
    if (!o.bas) return;
    const sure = Math.max(0, Math.min(simdi, Math.max(o.akt, o.bas) + OTURUM_ARA) - o.bas);
    o.top += sure; if (sure > o.enUzun) o.enUzun = sure; o.cik = simdi; o.bas = 0;
  };

  /** İlgi profili: konular (sıcaklığa göre, en çok 4), benimseme (0-1), ilk iki hafta mı. */
  IL.profil = function (r, simdi) {
    const konular = Object.entries(r.p).map(([k, x]) => [k, Math.round(puanSimdi(x, simdi) * 100) / 100]).filter(x => x[1] >= .8).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const ayarSay = Object.values(r.a).reduce((t, x) => t + x[0], 0), o = r.o;
    const ort = o.n ? (o.top + (o.bas ? simdi - o.bas : 0)) / o.n : 0;
    const benimseme = Math.round(Math.min(1, (ayarSay ? .35 : 0) + .25 * Math.min(1, r.g.seri / 5) + .2 * Math.min(1, o.n / 10) + .2 * Math.min(1, ort / (10 * DK))) * 100) / 100;
    const yas = simdi - r.ilk;
    return { konular, benimseme, yas, erken: yas < ERKEN, seri: r.g.seri, oturum: o.n, bekleyenTiyo: TIYO.filter(([, y]) => !r.y[y]).map(x => x[0]) };
  };

  /**
   * Sohbet kanalına girişte (ya da kanal açıkken) kanalAkisi'ne verilecek yön.
   * giris: kanala yeni girildi (öne çıkan iplik ancak o zaman). d: {patron, issiz, gorevli, kursta, kum}.
   * mevcut: bu kanalda ilgi ipliği olan konular (Set). rnd: 0-1 rastgele sayı üreten işlev.
   */
  IL.karar = function (r, simdi, kanal, giris, d, mevcut, rnd) {
    if (kanal !== 'ulke' && kanal !== 'global') return null;
    const pr = IL.profil(r, simdi), erken = pr.erken, tepe = pr.konular.length ? pr.konular[0][1] : 0;
    const sonuc = { konular: pr.konular.slice(0, 3), pay: Math.round((erken ? .28 : .18) * Math.min(1, tepe / 3) * 100) / 100, one: null, dmIs: false };
    if (!sonuc.konular.length) sonuc.pay = 0;
    if (!giris) return sonuc;
    const k = r.k, has = x => !mevcut || mevcut.has(x);
    // Her girişte değil: son öne çıkan iplikten beri yeterli süre geçmeli
    if (simdi - k.son < (erken ? 5 : 12) * DK) return sonuc;
    if (rnd() > (erken ? .75 : .4)) return sonuc;
    // Tiyo: yalnız Türkiye kanalında (arayüzün adlarıyla konuşur), oyuncu oluşturulduktan biraz sonra, yapılmamış ve sırası gelmiş olan
    let tiyo = null;
    if (kanal === 'ulke' && pr.yas >= ISINMA) {
      const sonT = Math.max(0, ...Object.values(r.t).map(x => x[1]));
      const araT = erken ? 15 * DK : 6 * SA, tekrarT = erken ? 3 * SA : 3 * GUN, enCok = erken ? 3 : 4;
      if (simdi - sonT >= araT) for (const [ad, y, uygun] of TIYO) { if (r.y[y] || !uygun(d) || !has(ad)) continue; const x = r.t[ad]; if (x && (x[0] >= enCok || simdi - x[1] < tekrarT)) continue; tiyo = ad; break; }
    }
    // İlgi konusu: en sıcak iki konudan, aynı konu kısa sürede yinelenmez
    const adaylar = pr.konular.filter(([kk, v]) => v >= 2 && has(kk) && simdi - (k.konu[kk] || 0) >= 15 * DK);
    let konu = null;
    if (adaylar.length) { const iki = adaylar.slice(0, 2), top = iki.reduce((t, x) => t + x[1], 0); let z = rnd() * top; for (const [kk, v] of iki) { z -= v; if (z <= 0) { konu = kk; break; } } konu = konu || iki[0][0]; }
    // İlk iki hafta: ilgi konusu yoksa tiyo, varsa yarı yarıya (oyunu benimseyen daha az tiyo görür). Sonra: dörtte bir, uzun aralarla.
    const tiyoVar = tiyo && (erken ? !konu || rnd() < .55 * (1 - .4 * pr.benimseme) : rnd() < .25);
    if (tiyoVar) sonuc.one = tiyo; else if (konu) sonuc.one = konu;
    // İş ilanlarına çok bakan işçiye arada bir işletme sahibi özelden gerçek teklif yazar ("biri DM'den eleman arar")
    if (konu === 'is' && !d.patron && tepe >= 3 && simdi - (k.dm || 0) >= (erken ? 20 * SA : 3 * GUN) && rnd() < .5) sonuc.dmIs = true;
    return sonuc;
  };
  /** kanalAkisi'nden sonra: öne çıkan iplik gerçekten yerleştiyse sayaçlar yazılır. */
  IL.sonuc = function (r, simdi, yon) {
    if (!yon || !yon.sonuc) return;
    const ad = yon.sonuc.konu; r.k.son = simdi;
    if (ad.startsWith('tiyo-')) { const x = r.t[ad] || (r.t[ad] = [0, 0]); x[0]++; x[1] = simdi; } else r.k.konu[ad] = simdi;
    halka(r, simdi, 'i:' + ad);
  };
  IL.dmYazildi = function (r, simdi) { r.k.dm = simdi; halka(r, simdi, 'i:dm-is'); };
  IL.boyut = r => JSON.stringify(r).length;

  g.OyuncuIlgi = IL;
})(typeof window !== 'undefined' ? window : globalThis);
