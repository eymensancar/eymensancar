/* Oyun çekirdeği: oyuncu değerleri (can, açlık, seviye, teknoloji puanı), eşyalar, tarifler (üretim), teknoloji ağacı, el yuvaları
   (elde görünen alet), vurma (ağaç kesme, taş kazma, çalı), kayıt. Sözleşme: docs/OYUN_API.md. Hareket: anim/vurus.js (SO.vurAnim).

   DEĞERLER
     can 100 (+5 / seviye). Açlık 100: dururken 0,05/sn, yürürken/hafif koşuda 0,08/sn, deparda 0,16/sn, yüzerken 0,12/sn azalır; her vuruş 0,15 alır
       (ayakta 33 dk, koşarak 21 dk, deparla 10 dk). Açlık 0 iken can 0,5/sn azalır; açlık 60'ın üstündeyken can 0,4/sn dolar.
     Can 0: doğuş noktasında yeniden doğuş (can/açlık dolu, eşyalar kalır), 'olum' olayı ve bildirim.
     Seviye: xpGerek(s) = 5 × yuvarla(8 × s^1,6) → 40, 120, 230, 370, 525, 705, 900, 1115, 1345, 1590 … (seviye s'den s+1'e).
       Seviye atlayınca: can dolar, teknoloji puanı +2 (5. seviyeye kadar), sonra +1. Asıl puan kaynağı ileride boss'lar: SO.oyun.puanVer(20).
     XP: yerden alma 2 · hasar veren vuruş 1 · ağaç devirme 8 · kaya kırma 10 · çalı/kaktüs 3 · üretim tarifin `xp` alanı (6–20) ·
       keşif: ilk kez girilen 128 m'lik kare 3 · teknoloji açma 5 × puan maliyeti.

   VURMA: SO.input.vur (ya da F tuşu) basılıyken elindeki eşyaya göre vuruş (tablo: ESYA[..].vurus / hasar). Değme anında (SO.vurAnim.durum.deger)
     öndeki nesne (kenarına 1,25 m; ağaç, kaya, çalı, kaktüs) hasar alır. Nesne canı ölçekten (canMax); kalan can kaydedilmez (yalnız bu oturum).
     Nesne bitince SO.world.nesneKaldir(id); kaldırılanlar kayda girer (en çok 4000; dolunca en eskiler geri gelir).
     His: değme anında yonga/taş kırığı/yaprak parçacıkları ve kamerada 1–2 cm'lik kısa sarsıntı.
   EL YUVALARI: SO.eller.yuva[3] eşya kimliği tutar (sayı çantada kalır; sayı 0'a inerse yuva boşalır). Seçili alet sağ ele (hand_r) bağlı küçük
     bir 3B ağ olarak görünür (düz renk + üç basamaklı gölge + mürekkep dış çizgi). Sap elin +Z ekseninde (başparmak tarafı), parmaklara doğru yatık.
     Mızrak yürürken yatay taşınır, saplarken parmak ekseni boyunca ileri döner. Yiyecek seçiliyken vur = ye (Consume klibi, sol el).
   KAYIT: localStorage `acik-dunya-oyun-v1` = { v: 1, o: { can, aclik, seviye, xp, puan }, el: { yuva, secili }, tek: [açık teknoloji id'leri],
     kal: [kaldırılan nesne id'leri], kesif: "kare;kare;…" (36 tabanı) }. Değişiklikten 3 sn sonra, 20 sn'de bir ve sayfa gizlenirken yazılır;
     `?test` kipinde okunmaz/yazılmaz. Eşya sayıları toplama.js'in kaydında (`acik-dunya-envanter-v1`, `say`).
   Deneme: SO.oyun.durum(), SO.oyun.hedefBul(), SO.oyun.nesneCan(n), SO.oyun.kodla()/coz(metin), SO.oyun.sifirla(), SO.oyun.bildirimler. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE, clamp = SO.clamp, lerp = SO.lerp;
  const KAYIT = 'acik-dunya-oyun-v1', KAL_EN_COK = 4000, KESIF_HUCRE = 128, KESIF_EN_COK = 2500;

  /* ---------- eşyalar ----------
     simge: 24×24 viewBox'ın iç içeriği (currentColor). alet/silah: vurus (anim/vurus.js türü), hasar (nesne sınıfı → vuruş başına hasar).
     yiyecek: besin (açlık), sifa (can). el: elde görünen ağın adı. */
  const cz = ic => '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ic + '</g>';
  const ESYA = SO.esya = {
    dal: { ad: 'Dal', sinif: 'malzeme', simge: cz('<path d="M4 20l7-7 4-2 5-7M11 13 9.5 6.5M15 11l5 .8"/>') },
    tas: { ad: 'Taş', sinif: 'malzeme', simge: cz('<path d="M3.5 16l3-7.5 6-3.5L19 7.5l2 8-4 4.5H7z"/><path d="M6.5 8.5 12 12l7-4.5M12 12l-1 8" stroke-width="1.5"/>') },
    odun: { ad: 'Odun', sinif: 'malzeme', simge: cz('<ellipse cx="6.5" cy="12" rx="3" ry="5"/><path d="M6.5 7h11a3 5 0 0 1 0 10h-11"/><path d="M11.5 10.5h5M13 13.5h3.5" stroke-width="1.5"/>') },
    lif: { ad: 'Lif', sinif: 'malzeme', simge: cz('<path d="M6 4c3 5 3 11 0 16M12 4c2 5 2 11 0 16M18 4c-3 5-3 11 0 16"/><path d="M6.5 12h11" stroke-width="3"/>') },
    cakmaktasi: { ad: 'Çakmaktaşı', sinif: 'malzeme', simge: cz('<path d="M5 18 9 5l8 2 3 8-7 5z"/><path d="M9 5l4 15M17 7l-4 13" stroke-width="1.5"/>') },
    ip: { ad: 'İp', sinif: 'malzeme', simge: cz('<circle cx="11" cy="11" r="7"/><circle cx="11" cy="11" r="3"/><path d="M16 16l5 4.5"/>') },
    tahta: { ad: 'Tahta', sinif: 'malzeme', simge: cz('<rect x="3" y="5.5" width="18" height="5.5" rx="1"/><rect x="3" y="13" width="18" height="5.5" rx="1"/><path d="M7 8.2h4M13 15.8h4" stroke-width="1.5"/>') },
    tas_balta: { ad: 'Taş balta', sinif: 'alet', vurus: 'balta', el: 'balta', hasar: { agac: 10, kaya: 0, cali: 9, kaktus: 8 },
      simge: cz('<path d="M6 21 15.5 7" stroke-width="2.6"/><path d="M11.5 4.5l6.5 1 2.5 6.5-5.5-1.5-4-2.5z" fill="currentColor"/>') },
    tas_kazma: { ad: 'Taş kazma', sinif: 'alet', vurus: 'kazma', el: 'kazma', hasar: { agac: 3, kaya: 10, cali: 5, kaktus: 5 },
      simge: cz('<path d="M6 21 14.5 7" stroke-width="2.6"/><path d="M4.5 9.5C9 3.5 16.5 3.5 21 9" stroke-width="3.2"/>') },
    mizrak: { ad: 'Mızrak', sinif: 'silah', vurus: 'mizrak', el: 'mizrak', hasar: { agac: 2, kaya: 0, cali: 6, kaktus: 6 },
      simge: cz('<path d="M4 20 15.5 8.5" stroke-width="2.4"/><path d="M14 10l2-6.5L20.5 8z" fill="currentColor"/>') },
    bogurtlen: { ad: 'Böğürtlen', sinif: 'yiyecek', besin: 12, sifa: 2, el: 'yemis',
      simge: cz('<circle cx="8.5" cy="14.5" r="3.4"/><circle cx="15" cy="15.5" r="3.4"/><circle cx="12.5" cy="9.5" r="3.2"/><path d="M12.5 6c0-2 1.5-3 3.5-3"/>') }
  };
  const EL = { vurus: 'yumruk', hasar: { agac: 1, kaya: 0, cali: 5, kaktus: 3 } }; // eli boşken

  /* ---------- tarifler ---------- (xp: üretince kazanılan) */
  const TARIF = SO.tarifler = [
    { id: 'tas_balta', ad: 'Taş balta', sinif: 'el', girdi: { dal: 2, tas: 2, lif: 1 }, cikti: { tas_balta: 1 }, teknoloji: 'tas_alet', xp: 15 },
    { id: 'tas_kazma', ad: 'Taş kazma', sinif: 'el', girdi: { dal: 2, tas: 3, lif: 1 }, cikti: { tas_kazma: 1 }, teknoloji: 'tas_alet', xp: 15 },
    { id: 'mizrak', ad: 'Mızrak', sinif: 'el', girdi: { dal: 3, tas: 1, lif: 2 }, cikti: { mizrak: 1 }, teknoloji: 'tas_alet', xp: 15 },
    { id: 'ip', ad: 'İp', sinif: 'masa', girdi: { lif: 3 }, cikti: { ip: 1 }, teknoloji: 'uretim_masasi', xp: 6 },
    { id: 'tahta', ad: 'Tahta', sinif: 'masa', girdi: { odun: 2 }, cikti: { tahta: 3 }, teknoloji: 'uretim_masasi', xp: 6 }
  ];

  /* ---------- teknoloji ---------- (seviye: açılabildiği en düşük oyuncu seviyesi; puan: maliyet) */
  const TEK = SO.teknoloji = [
    { id: 'tas_alet', ad: 'Taş aletler', seviye: 1, puan: 0, acik: true },
    { id: 'kamp_atesi', ad: 'Kamp ateşi', seviye: 2, puan: 1 }, { id: 'uretim_masasi', ad: 'Üretim masası', seviye: 2, puan: 1 },
    { id: 'ahsap_yapi', ad: 'Ahşap yapı', seviye: 3, puan: 2 }, { id: 'cit', ad: 'Çit', seviye: 3, puan: 1 },
    { id: 'firin', ad: 'Fırın', seviye: 4, puan: 2 }, { id: 'yatak', ad: 'Yatak', seviye: 4, puan: 2 },
    { id: 'sandik', ad: 'Sandık', seviye: 5, puan: 2 }, { id: 'tas_yapi', ad: 'Taş yapı', seviye: 5, puan: 3 }, { id: 'yay', ad: 'Yay ve ok', seviye: 5, puan: 3 },
    { id: 'demir_alet', ad: 'Demir aletler', seviye: 6, puan: 4 }, { id: 'tarla', ad: 'Tarla', seviye: 6, puan: 3 },
    { id: 'zirh', ad: 'Zırh', seviye: 7, puan: 4 }, { id: 'kuyu', ad: 'Su kuyusu', seviye: 7, puan: 3 },
    { id: 'degirmen', ad: 'Değirmen ve çark', seviye: 8, puan: 5 }, { id: 'barut', ad: 'Barut', seviye: 8, puan: 5 },
    { id: 'celik', ad: 'Çelik', seviye: 9, puan: 6 }, { id: 'elektrik', ad: 'Elektrik', seviye: 9, puan: 8 },
    { id: 'atesli_silah', ad: 'Ateşli silah', seviye: 10, puan: 10 }
  ];
  TEK.forEach(t => { t.acik = !!t.acik; });
  const tekBul = id => TEK.find(t => t.id === id);
  const teknolojiAcik = id => { if (id == null) return true; const t = tekBul(id); return !t || t.acik; };

  /* ---------- oyuncu ---------- */
  const AYAR = SO.tune.oyun = Object.assign({
    aclik: { dur: .05, yuru: .08, depar: .16, yuz: .12, vurus: .15 },   // açlık azalması (1/sn; vurus: vuruş başına)
    acCan: .5, tokCan: .4, tokEsik: 60,                                 // açlık 0'da can kaybı (1/sn); tokken can dolması (1/sn), eşiği
    xp: { al: 2, vurus: 1, agac: 8, kaya: 10, cali: 3, kesif: 3, teknoloji: 5 },
    menzil: 1.25,                                                        // vuruşun yetiştiği uzaklık: oyuncunun merkezinden nesnenin kenarına (m)
    sarsinti: .016                                                       // değme anında kamera sarsıntısı (m)
  }, SO.tune.oyun || {});
  const xpIcin = s => 5 * Math.round(8 * Math.pow(s, 1.6));
  const canIcin = s => 100 + 5 * (s - 1);
  const O = SO.oyuncu = { can: 100, canMax: 100, aclik: 100, aclikMax: 100, seviye: 1, xp: 0, xpGerek: xpIcin(1), puan: 0 };
  const eller = SO.eller = { yuva: [null, null, null], secili: -1 };

  const dinleyen = [], bildirimler = [];
  const duyur = ne => { kirli(); for (const f of dinleyen) { try { f(ne); } catch (e) { } } };
  const ses = (ad, bilgi) => { try { SO.ses.olay(ad, bilgi || {}); } catch (e) { } };
  function bildir(metin) { bildirimler.push(metin); if (bildirimler.length > 40) bildirimler.shift(); try { if (SO.arayuz && SO.arayuz.bildir) SO.arayuz.bildir(metin); } catch (e) { } }
  // kazanımlar: aynı türden art arda gelenler tek bildirimde toplanır ("+3 Odun")
  const kazanc = new Map(); let kazancZ = 0, kazancIlk = 0;
  function kazan(tur, n) { if (!n) return; SO.envanter.ekle(tur, n); if (!kazanc.size) kazancIlk = 0; kazanc.set(tur, (kazanc.get(tur) || 0) + n); kazancZ = .3; }
  function kazancBildir() { if (!kazanc.size) return; const p = []; kazanc.forEach((n, tur) => p.push('+' + n + ' ' + (ESYA[tur] ? ESYA[tur].ad : tur))); kazanc.clear(); bildir(p.join(', ')); }

  function xpVer(n) {
    n = +n || 0; if (n <= 0) return; O.xp += n; let atladi = false;
    while (O.xp >= O.xpGerek) { O.xp -= O.xpGerek; O.seviye++; O.xpGerek = xpIcin(O.seviye); O.canMax = canIcin(O.seviye); O.can = O.canMax; const p = O.seviye <= 5 ? 2 : 1; O.puan += p; atladi = true;
      ses('seviye', { seviye: O.seviye }); bildir('Seviye ' + O.seviye + '! +' + p + ' teknoloji puanı'); }
    duyur('xp'); if (atladi) { duyur('seviye'); duyur('puan'); duyur('can'); }
  }
  function puanVer(n) { n = Math.round(+n || 0); if (!n) return; O.puan = Math.max(0, O.puan + n); if (n > 0) bildir('+' + n + ' teknoloji puanı'); duyur('puan'); }
  let olu = false;
  function hasar(n, neden) { n = +n || 0; if (n <= 0 || olu) return; O.can = Math.max(0, O.can - n); ses('hasar', { miktar: n, neden: neden || '' }); duyur('can'); if (O.can <= 0) olu = true; }
  function yenidenDog() {
    const ps = SO.ps, w = SO.world; olu = false; O.can = O.canMax; O.aclik = O.aclikMax;
    ps.x = w.start.x; ps.z = w.start.z; ps.y = ps.groundY = w.groundY(ps.x, ps.z); ps.vx = ps.vy = ps.vz = 0; ps.grounded = true;
    ses('olum', {}); bildir('Bayıldın. Doğuş noktasında uyandın.'); duyur('olum'); duyur('can'); duyur('aclik');
  }
  function ye(id) {
    const e = ESYA[id]; if (!e || e.sinif !== 'yiyecek' || !SO.envanter.harca(id, 1)) return false;
    O.aclik = Math.min(O.aclikMax, O.aclik + (e.besin || 0)); O.can = Math.min(O.canMax, O.can + (e.sifa || 0)); ses('ye', { tur: id }); duyur('aclik'); duyur('can'); return true;
  }

  /* ---------- eller ---------- */
  function elSec(i) { i = i | 0; if (i < 0 || i > 2) i = -1; eller.secili = eller.secili === i ? -1 : i; elGuncelle(); duyur('el'); }
  function kusan(id, i) {
    const e = ESYA[id]; if (!e || e.sinif === 'malzeme' || SO.envanter.adet(id) < 1) return false;
    if (i == null || i < 0 || i > 2) { i = eller.yuva.indexOf(id); if (i < 0) i = eller.yuva.indexOf(null); if (i < 0) i = eller.secili >= 0 ? eller.secili : 0; }
    const eski = eller.yuva.indexOf(id); if (eski >= 0 && eski !== i) eller.yuva[eski] = eller.yuva[i]; // aynı eşya iki yuvada durmaz: yer değiştirir
    eller.yuva[i] = id; elGuncelle(); duyur('el'); return true;
  }
  function cikar(i) { if (!(i >= 0 && i <= 2) || !eller.yuva[i]) return false; eller.yuva[i] = null; elGuncelle(); duyur('el'); return true; }
  const eldeki = () => (eller.secili >= 0 && eller.yuva[eller.secili]) || null;

  /* ---------- üretim ---------- */
  const tarifBul = id => TARIF.find(t => t.id === id);
  function uretebilir(id) {
    const t = tarifBul(id), out = { ok: false, eksik: {}, kilitli: false, masaGerek: false }; if (!t) return out;
    out.kilitli = !teknolojiAcik(t.teknoloji);
    for (const tur in t.girdi) { const e = t.girdi[tur] - SO.envanter.adet(tur); if (e > 0) out.eksik[tur] = e; }
    if (t.sinif === 'masa') { let yakin = null; try { yakin = SO.yapi && SO.yapi.yakin ? SO.yapi.yakin('uretim_masasi', 3.5) : null; } catch (e) { } out.masaGerek = !yakin; }
    out.ok = !out.kilitli && !out.masaGerek && !Object.keys(out.eksik).length; return out;
  }
  function uret(id) {
    const t = tarifBul(id); if (!t || !uretebilir(id).ok) return false;
    for (const tur in t.girdi) SO.envanter.harca(tur, t.girdi[tur]);
    const p = []; for (const tur in t.cikti) { SO.envanter.ekle(tur, t.cikti[tur]); p.push((t.cikti[tur] > 1 ? t.cikti[tur] + ' ' : '') + (ESYA[tur] ? ESYA[tur].ad : tur));
      const e = ESYA[tur]; if (e && e.sinif !== 'malzeme' && e.sinif !== 'yiyecek' && !eller.yuva.includes(tur)) { const bos = eller.yuva.indexOf(null); if (bos >= 0) { kusan(tur, bos); if (eller.secili < 0) elSec(bos); } } } // yeni alet boş yuvaya, el boşsa ele
    ses('uret', { tarif: id }); bildir('Yapıldı: ' + p.join(', ')); xpVer(t.xp || 8); return true;
  }
  function teknolojiAc(id) {
    const t = tekBul(id); if (!t) return { ok: false, neden: 'yok' }; if (t.acik) return { ok: false, neden: 'acik' };
    if (O.seviye < t.seviye) return { ok: false, neden: 'seviye' }; if (O.puan < t.puan) return { ok: false, neden: 'puan' };
    O.puan -= t.puan; t.acik = true; ses('teknoloji', { id }); bildir('Açıldı: ' + t.ad); duyur('puan'); duyur('teknoloji'); xpVer(AYAR.xp.teknoloji * t.puan); return { ok: true, neden: '' };
  }

  /* ---------- nesneler: can, hasar, düşüşler ---------- */
  const DUZ = { duzAlcak: 70, duzOrta: 110, duzYuksek: 170 };
  const SINIF_AD = { agac: 'Ağaç', kaya: 'Kaya', cali: 'Çalı', kaktus: 'Kaktüs' };
  const GEREK = { agac: 'balta', kaya: 'kazma' };
  function canMax(n) { const s = n.s || 1;
    if (n.sinif === 'agac') return Math.round(25 + 22 * s * s);
    if (n.sinif === 'kaya') return Math.round(DUZ[n.tur] ? DUZ[n.tur] * s : 20 + 35 * s * s);
    if (n.sinif === 'cali') return Math.round(10 + 6 * s);
    if (n.sinif === 'kaktus') return 20; return 0; }
  const yaricap = n => n.kutu ? (n.kutu.x1 - n.kutu.x0) / 2 : .4 * (n.s || 1);
  const karma = (id, k) => { let h = 2166136261 ^ (k * 977); const m = String(id); for (let i = 0; i < m.length; i++) { h ^= m.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }; // nesneye bağlı sabit rastgele
  // nesne bitince düşenler
  function dusus(n) { const s = n.s || 1, r = k => karma(n.id, k);
    if (n.sinif === 'agac') return { odun: Math.round(2 + 3 * s * s), dal: 1 + (r(1) < .5 ? 1 : 0) };
    if (n.sinif === 'kaya') return { tas: Math.min(20, Math.round((DUZ[n.tur] ? 5 : 2) + 3 * s * s)), cakmaktasi: (r(1) < .4 ? 1 : 0) + (s > 1.5 ? 1 : 0) };
    if (n.sinif === 'cali') return { lif: 2 + (r(1) < .5 ? 1 : 0), bogurtlen: 1 + (r(2) < .6 ? 1 : 0), dal: r(3) < .5 ? 1 : 0 };
    if (n.sinif === 'kaktus') return { lif: 2 + (r(1) < .5 ? 1 : 0) }; return {}; }
  const kalanCan = new Map(); // id → kalan can (yalnız bu oturum)
  const nesneCan = n => kalanCan.has(n.id) ? kalanCan.get(n.id) : canMax(n);

  // vurulabilecek nesne: kenarı menzilde ve önde olan (nesnenin dibindeyken yan durmak da sayılır)
  function hedefBul(pay) {
    const ps = SO.ps, w = SO.world; if (!w.yakinNesne) return null; const fx = Math.sin(ps.yaw), fz = Math.cos(ps.yaw), M = AYAR.menzil + (pay || 0);
    return w.yakinNesne(ps.x + fx * .5, ps.z + fz * .5, 5.5, n => { if (!canMax(n)) return false; const dx = n.x - ps.x, dz = n.z - ps.z, d = Math.hypot(dx, dz), kenar = d - yaricap(n);
      if (kenar > M || Math.abs(n.h - ps.y) > 2.6) return false; return (d > .05 ? (dx * fx + dz * fz) / d : 1) > (kenar < .5 ? .1 : .45); });
  }
  let uyariZ = 0;
  function vurusDegdi(tur) {
    const id = eldeki(), e = id && ESYA[id], alet = e && e.hasar ? e : EL, ps = SO.ps;
    O.aclik = Math.max(0, O.aclik - AYAR.aclik.vurus);
    const n = hedefBul(.15);
    if (!n) { ses('vur', { hedef: 'bos', alet: id || 'el' }); return; }
    const guc = alet.hasar[n.sinif] || 0, dx = n.x - ps.x, dz = n.z - ps.z, d = Math.hypot(dx, dz) || 1, r = Math.min(yaricap(n), d - .25);
    const ust = n.kutu ? n.kutu.top - ps.y : 1, py = ps.y + (n.sinif === 'agac' ? 1.05 : n.sinif === 'kaya' ? clamp(ust * .8, .3, 1.0) : .55);
    const px = n.x - dx / d * r, pz = n.z - dz / d * r;
    ses('vur', { hedef: n.sinif, alet: id || 'el', etkisiz: !guc });
    sacil(px, py, pz, -dx / d, -dz / d, n.sinif, guc ? 7 : 3); sars = guc ? 1 : .5;
    if (!id && n.sinif === 'kaktus') hasar(2, 'kaktus');
    if (!guc) { if (uyariZ <= 0) { uyariZ = 3; bildir(SINIF_AD[n.sinif] + ' için ' + (GEREK[n.sinif] || 'başka alet') + ' gerek'); } return; }
    const kalan = nesneCan(n) - guc; xpVer(AYAR.xp.vurus);
    // her vuruşta küçük ödül: baltayla yonga (odun), kazmayla kırık (taş)
    if (n.sinif === 'agac' && guc >= 8) kazan('odun', 1); else if (n.sinif === 'kaya' && guc >= 8) kazan('tas', 1); else if (n.sinif === 'agac' && karma(n.id, Math.round(kalan)) < .12) kazan('dal', 1);
    if (kalan > 0) { kalanCan.set(n.id, kalan); return; }
    kalanCan.delete(n.id); const D = dusus(n); for (const t in D) kazan(t, D[t]);
    sacil(px, py + .2, pz, -dx / d, -dz / d, n.sinif, 12); sars = 1.6;
    ses('kir', { hedef: n.sinif, tur: n.tur, olcek: n.s }); SO.world.nesneKaldir(n.id); kalYaz(n.id);
    xpVer(AYAR.xp[n.sinif] || AYAR.xp.cali);
  }

  /* ---------- parçacıklar (yonga, taş kırığı, yaprak) ve kamera sarsıntısı ---------- */
  const parca = [], P_RENK = { agac: [0xc9a36b, 0x8a5f34], kaya: [0xa9a498, 0x77726a], cali: [0x6f8f3a, 0x4d6a2a], kaktus: [0x7fa25a, 0x4f7a3c] }, pMat = {};
  let pGeo = null, pSira = 0, sars = 0, tohum = 7;
  const rs = () => { tohum = (Math.imul(tohum, 1664525) + 1013904223) | 0; return (tohum >>> 0) / 4294967296; };
  function parcaKur() { pGeo = new T3.TetrahedronGeometry(.045, 0); for (const k in P_RENK) pMat[k] = P_RENK[k].map(c => new T3.MeshBasicMaterial({ color: c }));
    for (let i = 0; i < 28; i++) { const m = new T3.Mesh(pGeo, pMat.agac[0]); m.visible = false; m.frustumCulled = false; SO.scene.add(m); parca.push({ m, t: 0, om: 0, vx: 0, vy: 0, vz: 0, dx: 0, dz: 0, s: 1 }); } }
  function sacil(x, y, z, nx, nz, sinif, adet) { if (!pGeo) return; const M = pMat[sinif] || pMat.kaya;
    for (let i = 0; i < adet; i++) { const p = parca[pSira++ % parca.length], a = (rs() - .5) * 2.2, c = Math.cos(a), s = Math.sin(a), hz = 1.1 + rs() * 2.1;
      p.m.material = M[rs() < .5 ? 0 : 1]; p.m.position.set(x + (rs() - .5) * .12, y + (rs() - .5) * .2, z + (rs() - .5) * .12); p.vx = (nx * c - nz * s) * hz; p.vz = (nx * s + nz * c) * hz; p.vy = 1.2 + rs() * 2.4;
      p.om = .38 + rs() * .3; p.t = p.om; p.s = (sinif === 'kaya' ? .75 : 1) * (.6 + rs() * .9); p.dx = rs() * 14 - 7; p.dz = rs() * 14 - 7; p.m.rotation.set(rs() * 6, rs() * 6, rs() * 6); p.m.visible = true; } }
  function parcaGuncelle(dt) { for (const p of parca) { if (p.t <= 0) continue; p.t -= dt; if (p.t <= 0) { p.m.visible = false; continue; } p.vy -= 9.5 * dt; const m = p.m; m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt; m.rotation.x += p.dx * dt; m.rotation.z += p.dz * dt;
      const k = p.s * Math.min(1, p.t / p.om * 2.2); m.scale.set(k * 1.5, k * .5, k); } }

  /* ---------- eldeki alet (hand_r kemiğine bağlı ağ) ---------- */
  const INK = 0x15120d, aletAg = {}; let tutac = null, tutacSol = null, elOlcek = 1, gorunen = null;
  function aletKur() {
    const B = SO.char && SO.char.bones; if (!B || !B.hand_r) return;
    const grad = (() => { const d = new Uint8Array([120, 120, 120, 255, 196, 196, 196, 255, 255, 255, 255, 255]); const t = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); t.minFilter = t.magFilter = T3.NearestFilter; t.needsUpdate = true; return t; })();
    const hull = new T3.MeshBasicMaterial({ color: INK, side: T3.BackSide }); hull.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normalize(normal) * 0.007;'); };
    const mat = {}, M = c => mat[c] || (mat[c] = new T3.MeshToonMaterial({ color: c, gradientMap: grad }));
    const AHSAP = 0x9a6a3a, TAS = 0xa9a498, SARGI = 0xd8c690, YEMIS = 0x5b2a6e, YAPRAK = 0x6f8f3a;
    // parça: geometri + renk + konum [x, y, z] + dönüş [x, y, z]; aletin +Y'si sap boyunca yukarı (baş tarafı), +Z'si vuran yüzün baktığı yön, kavrama yeri orijin
    const ag = parcalar => { const g = new T3.Group(); parcalar.forEach(([geo, renk, p, r]) => { const m = new T3.Mesh(geo, M(renk)); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); m.frustumCulled = false; const h = new T3.Mesh(geo, hull); h.frustumCulled = false; m.add(h); g.add(m); }); g.visible = false; return g; };
    const tasBas = (en, boy, kal) => { const g = new T3.CylinderGeometry(.5, .5, 1, 5, 1); g.rotateZ(Math.PI / 2); g.scale(kal, boy, en); return g; }; // yassı beşgen taş
    aletAg.balta = ag([
      [new T3.CylinderGeometry(.016, .02, .56, 6), AHSAP, [0, .16, 0]],
      [tasBas(.17, .11, .034), TAS, [0, .385, .05], [.25, 0, 0]],
      [new T3.CylinderGeometry(.027, .027, .05, 6), SARGI, [0, .385, 0]]]);
    aletAg.kazma = ag([
      [new T3.CylinderGeometry(.016, .021, .64, 6), AHSAP, [0, .2, 0]],
      [new T3.ConeGeometry(.034, .21, 5), TAS, [0, .49, .115], [Math.PI / 2 - .25, 0, 0]],
      [new T3.ConeGeometry(.034, .17, 5), TAS, [0, .49, -.095], [-Math.PI / 2 + .25, 0, 0]],
      [new T3.CylinderGeometry(.03, .03, .055, 6), SARGI, [0, .49, 0]]]);
    aletAg.mizrak = ag([
      [new T3.CylinderGeometry(.013, .016, 1.6, 6), AHSAP, [0, .15, 0]],
      [new T3.ConeGeometry(.032, .2, 4), TAS, [0, 1.05, 0]],
      [new T3.CylinderGeometry(.021, .021, .05, 6), SARGI, [0, .94, 0]]]);
    aletAg.yemis = ag([
      [new T3.IcosahedronGeometry(.024, 0), YEMIS, [0, .012, .0]], [new T3.IcosahedronGeometry(.022, 0), YEMIS, [.03, .0, .012]], [new T3.IcosahedronGeometry(.021, 0), YEMIS, [.012, .03, .022]],
      [new T3.ConeGeometry(.012, .04, 4), YAPRAK, [.012, .055, .01]]]);
    const kur = kemik => { const g = new T3.Group(); kemik.add(g); kemik.updateWorldMatrix(true, false); const sc = new T3.Vector3().setFromMatrixScale(kemik.matrixWorld); elOlcek = 1 / (sc.x || 1); g.scale.setScalar(elOlcek); return g; };
    tutac = kur(B.hand_r); tutacSol = B.hand_l ? kur(B.hand_l) : null;
    for (const k in aletAg) tutac.add(aletAg[k]);
    elGuncelle();
  }
  /* bağlama: sap elin +Z ekseninden parmaklara (+Y) doğru `aci` kadar yatık; vuran yüz parmak tarafına bakar. ofs: avuç ortası (el ekseninde, m).
     mızrak: taşırken hafif yatık (yatay), saplarken parmak ekseni boyunca (aci2) */
  const BAG = { balta: { aci: 50, ofs: [-.028, .085, .012] }, kazma: { aci: 42, ofs: [-.028, .085, .012] }, mizrak: { aci: 12, aci2: 88, ofs: [-.03, .08, .01] }, yemis: { aci: 0, ofs: [-.045, .09, .02] } };
  const bX = new T3.Vector3(), bY = new T3.Vector3(), bZ = new T3.Vector3(), bM = new T3.Matrix4();
  function baglaYaz(g, ad, k) { const b = BAG[ad], a = lerp(b.aci, b.aci2 == null ? b.aci : b.aci2, k) * Math.PI / 180, o = b.ofs;
    bY.set(0, Math.sin(a), Math.cos(a)); bZ.set(0, Math.cos(a), -Math.sin(a)); bX.crossVectors(bY, bZ); bM.makeBasis(bX, bY, bZ); g.quaternion.setFromRotationMatrix(bM); g.position.set(o[0], o[1], o[2]); }
  function elGuncelle() { // yuvalar: çantada kalmayan eşya yuvadan düşer; seçili aletin ağı görünür
    for (let i = 0; i < 3; i++) if (eller.yuva[i] && SO.envanter.adet(eller.yuva[i]) < 1) eller.yuva[i] = null;
    const id = eldeki(), ad = id && ESYA[id] ? ESYA[id].el : null; gorunen = ad && aletAg[ad] ? ad : null;
    for (const k in aletAg) aletAg[k].visible = k === gorunen;
  }
  function aletGuncelle() {
    if (!tutac || !gorunen) return; const g = aletAg[gorunen], S = SO.vurAnim && SO.vurAnim.durum, ps = SO.ps;
    const sapla = gorunen === 'mizrak' && S && S.tur === 'mizrak' ? clamp(S.uyg * 1.6, 0, 1) : 0;
    if (gorunen === 'yemis' && tutacSol) { const sol = !!S && S.tur === 'ye' && S.uyg > .3; if ((g.parent === tutacSol) !== sol) (sol ? tutacSol : tutac).add(g); } // yerken sol elde (Consume klibi sol elle)
    baglaYaz(g, gorunen, sapla); if (g.parent === tutacSol) g.position.x = -g.position.x;
    g.visible = !(ps.yuzmeBlend > .5) && !(ps.tirmanBlend > .3); // yüzerken ve tırmanırken alet görünmez (eller meşgul)
  }

  /* ---------- keşif ---------- */
  const kesif = new Set(); let kesifSon = '';
  function kesifBak() { const ps = SO.ps, k = Math.floor(ps.x / KESIF_HUCRE).toString(36) + ',' + Math.floor(ps.z / KESIF_HUCRE).toString(36); if (k === kesifSon) return; kesifSon = k;
    if (kesif.has(k)) return; kesif.add(k); if (kesif.size > KESIF_EN_COK) kesif.delete(kesif.values().next().value); if (kesif.size > 1) xpVer(AYAR.xp.kesif); else kirli(); }

  /* ---------- kayıt ---------- */
  let kayitZ = 0, kayitDonem = 20; const kalDizi = [];
  const kirli = () => { if (!kayitZ) kayitZ = 3; };
  function kalYaz(id) { kalDizi.push(id); if (kalDizi.length > KAL_EN_COK) kalDizi.splice(0, kalDizi.length - KAL_EN_COK); kirli(); }
  function kodla() { return JSON.stringify({ v: 1, o: { can: +O.can.toFixed(1), aclik: +O.aclik.toFixed(1), seviye: O.seviye, xp: O.xp, puan: O.puan }, el: { yuva: eller.yuva.slice(), secili: eller.secili },
    tek: TEK.filter(t => t.acik).map(t => t.id), kal: kalDizi, kesif: Array.from(kesif).join(';') }); }
  function coz(metin) {
    const d = JSON.parse(metin); if (!d || d.v !== 1) return false; const o = d.o || {};
    O.seviye = Math.max(1, o.seviye | 0 || 1); O.xpGerek = xpIcin(O.seviye); O.canMax = canIcin(O.seviye); O.xp = clamp(+o.xp || 0, 0, O.xpGerek - 1); O.puan = Math.max(0, o.puan | 0);
    O.can = clamp(o.can == null ? O.canMax : +o.can, 1, O.canMax); O.aclik = clamp(o.aclik == null ? O.aclikMax : +o.aclik, 0, O.aclikMax); olu = false;
    const el = d.el || {}; for (let i = 0; i < 3; i++) { const id = el.yuva && el.yuva[i]; eller.yuva[i] = id && ESYA[id] ? id : null; } eller.secili = el.secili >= 0 && el.secili <= 2 ? el.secili | 0 : -1;
    TEK.forEach(t => { t.acik = t.puan === 0 && t.seviye === 1; }); (d.tek || []).forEach(id => { const t = tekBul(id); if (t) t.acik = true; });
    kalDizi.length = 0; (d.kal || []).slice(-KAL_EN_COK).forEach(id => kalDizi.push(String(id)));
    kesif.clear(); String(d.kesif || '').split(';').forEach(k => { if (k) kesif.add(k); }); kesifSon = '';
    return true;
  }
  function kaydet() { kayitZ = 0; if (SO.test) return; try { localStorage.setItem(KAYIT, kodla()); } catch (e) { } }
  function yukle() { if (SO.test) return; try { const m = localStorage.getItem(KAYIT); if (m) coz(m); } catch (e) { } }
  // kaldırılan nesneleri dünyaya bildir: sonradan üretilecek hücreler için liste, şimdiden yüklü hücreler için tek tek kaldırma
  function kalUygula() { const w = SO.world; if (!kalDizi.length || !w.kaldirilanYukle) return; w.kaldirilanYukle(kalDizi); for (const id of kalDizi) w.nesneKaldir(id); }

  /* ---------- kurulum ve döngü ---------- */
  let hazir = false, tamSon = [-1, -1], hedefZ = 0;
  function init() {
    yukle(); kalUygula(); parcaKur(); aletKur();
    SO.envanter.dinle(() => { elGuncelle(); });
    if (!('vur' in SO.input)) SO.input.vur = false;
    addEventListener('keydown', e => { if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; const k = e.key; if (k === 'f' || k === 'F') SO.input.vur = true; else if (!e.repeat && (k === '1' || k === '2' || k === '3')) elSec(+k - 1); });
    addEventListener('keyup', e => { if (e.key === 'f' || e.key === 'F') SO.input.vur = false; });
    addEventListener('blur', () => { SO.input.vur = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) kaydet(); }); addEventListener('pagehide', kaydet);
    tamSon = [Math.ceil(O.can), Math.ceil(O.aclik)]; hazir = true; kesifBak(); elGuncelle();
  }
  function update(dt) {
    if (!hazir) return; const ps = SO.ps, A = SO.vurAnim, S = A && A.durum, inp = SO.input;
    if (dt > 0) {
      // açlık ve can
      const a = AYAR.aclik, hiz = ps.yuzme ? a.yuz : ps.speed > 5 ? a.depar : ps.speed > .4 ? a.yuru : a.dur;
      O.aclik = Math.max(0, O.aclik - hiz * dt);
      if (!olu) { if (O.aclik <= 0) { O.can = Math.max(0, O.can - AYAR.acCan * dt); if (O.can <= 0) { olu = true; ses('hasar', { miktar: 0, neden: 'aclik' }); } } else if (O.aclik > AYAR.tokEsik && O.can < O.canMax) O.can = Math.min(O.canMax, O.can + AYAR.tokCan * dt); }
      if (olu && !ps.kilit) yenidenDog();
      const tc = Math.ceil(O.can), ta = Math.ceil(O.aclik); if (tc !== tamSon[0]) { tamSon[0] = tc; duyur('can'); } if (ta !== tamSon[1]) { tamSon[1] = ta; duyur('aclik'); }
      kesifBak();
      // vurma
      if (S && S.deger) { if (S.tur === 'ye') { const id = eldeki(); if (id) ye(id); } else vurusDegdi(S.tur); }
      const yerlestirme = !!(SO.yapi && SO.yapi.kip);
      if (inp.vur && A && !yerlestirme) { const id = eldeki(), e = id && ESYA[id], tur = e && e.sinif === 'yiyecek' ? (O.aclik < O.aclikMax - 1 || O.can < O.canMax ? 'ye' : null) : (e && e.vurus) || EL.vurus;
        if (tur && A.hazir(tur)) { const n = tur === 'ye' ? null : hedefBul(.15); A.basla(tur, n ? n.x : null, n ? n.z : null); } }
      if (uyariZ > 0) uyariZ -= dt;
      if (kazancZ > 0) { kazancZ -= dt; kazancIlk += dt; if (kazancZ <= 0 || kazancIlk > .9) { kazancZ = 0; kazancBildir(); } }
      hedefZ -= dt; if (hedefZ <= 0) { hedefZ = .12; const n = hedefBul(.15); G.hedef = n ? { id: n.id, sinif: n.sinif, tur: n.tur, can: nesneCan(n), canMax: canMax(n), x: n.x, z: n.z } : null; }
      if (kayitZ > 0) { kayitZ -= dt; if (kayitZ <= 0) kaydet(); } kayitDonem -= dt; if (kayitDonem <= 0) { kayitDonem = 20; kaydet(); }
    }
    parcaGuncelle(dt); aletGuncelle();
    if (sars > .01) { const c = SO.camera, k = sars * AYAR.sarsinti; c.position.y -= k * .8; c.position.x += (rs() - .5) * k; c.position.z += (rs() - .5) * k; sars = dt > 0 ? sars * Math.exp(-22 * dt) : sars; } else sars = 0;
  }
  // yerden alma: toplama.js sayacı artırdığı karede (el değdi) xp ve bildirim
  SO.envanter.dinle((tur, adet) => { if (!hazir) return; const S = SO.toplaAnim && SO.toplaAnim.durum; if (S && S.deger && SO.toplama && SO.toplama.TUR[tur]) { xpVer(AYAR.xp.al); if (!kazanc.size) kazancIlk = 0; kazanc.set(tur, (kazanc.get(tur) || 0) + 1); kazancZ = .3; } });

  function sifirla() { Object.assign(O, { can: 100, canMax: 100, aclik: 100, seviye: 1, xp: 0, xpGerek: xpIcin(1), puan: 0 }); eller.yuva = [null, null, null]; eller.secili = -1; TEK.forEach(t => { t.acik = t.puan === 0 && t.seviye === 1; }); kalanCan.clear(); kesif.clear(); kesifSon = ''; olu = false; elGuncelle(); ['can', 'aclik', 'xp', 'seviye', 'puan', 'el', 'teknoloji'].forEach(duyur); }
  const G = SO.oyun = { init, update, dinle: fn => { dinleyen.push(fn); }, xpVer, puanVer, hasar, ye, elSec, kusan, cikar, uretebilir, uret, teknolojiAc, teknolojiAcik,
    hedef: null, hedefBul, nesneCan, canMax, dusus, xpIcin, eldeki, bildirimler, kodla, coz, kaydet, sifirla,
    durum: () => ({ oyuncu: Object.assign({}, O), eller: { yuva: eller.yuva.slice(), secili: eller.secili }, acik: TEK.filter(t => t.acik).map(t => t.id), kaldirilan: kalDizi.length, kesif: kesif.size, hasarli: kalanCan.size, kayit: kodla().length }) };
})();
