/* Arayüz: ekran düzeni (can/açlık, seviye, el yuvaları, çanta/çekiç/tablet panelleri, vurma düğmesi, yerleştirme kipi, bildirimler).
   Sözleşme: docs/OYUN_API.md · düzen: docs/YOL_HARITASI.md · öğeler ve stil: index.html.
   SO.arayuz = { init(), update(dt), bildir(metin, vurgu), ac('canta' | 'cekic' | 'tablet'), kapat(), acik (o an açık panel ya da ''), yenile() }.

   Yalnız OKUR ve sözleşmedeki işlevleri çağırır; oyun durumunu tutmaz. Sözleşmedeki nesnelerin hiçbiri zorunlu değildir
   (SO.oyuncu, SO.eller, SO.esya, SO.tarifler, SO.teknoloji, SO.yapilar, SO.yapi, SO.oyun.* yoksa ilgili yer boş/varsayılan görünür).

   Güncelleme: her bölümün küçük bir "imza"sı (gösterdiği değerlerin metni) tutulur; DOM yalnız imza değişince yazılır.
   İmzalar 5 Hz'de yoklanır; SO.oyun.dinle / SO.envanter.dinle / SO.yapi.dinle varsa abone olunur ve değişiklik bir sonraki karede işlenir.
   Yerleştirme kipi (SO.yapi.kip) her karede okunur (iki alan karşılaştırması; DOM'a yalnız değişince yazılır).

   Paneller: tek bir #panel kabı, içeriği türe göre doldurulur; aynı anda biri açık. Dışına (düğme olmayan yere) dokununca kapanır ve
   o dokunuş çubuğa/kameraya gider (oyun sürer). Harita açılınca panel kapanır, panel açılınca harita kapanır.
   Kaydırma: gövde (#pGovde) parmakla sürüklenerek kayar; sahne 90° dönükken tarayıcının doğal kaydırması yön değiştirdiği
   (ve sayfada touch-action: none olduğu) için sürükleme elle yazıldı: parmağın SAHNEYE göre dikey hareketi alınır.

   Klavye: F vur (basılıyken) · 1/2/3 el yuvası · I ya da Tab çanta · B çekiç · T tablet · Esc kapat;
   yerleştirme kipinde Enter yerleştir, R döndür, Esc iptal. */
(function () {
  'use strict';
  const SO = window.SO;
  const YOKLA = .2, NOT_SN = 2400, NOT_EN_COK = 4, SURUK_ESIK = 7;
  const al = id => document.getElementById(id);
  const svg = (ic, vb) => '<svg viewBox="0 0 ' + (vb || 24) + ' ' + (vb || 24) + '" aria-hidden="true">' + ic + '</svg>';
  const K = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  /* Simgeler: 24×24, satır içi SVG. */
  const IK = {
    yumruk: '<path d="M6.5 11a2 2 0 0 1 2-2h7a3 3 0 0 1 3 3v2.5a5.5 5.5 0 0 1-5.5 5.5H12a5.5 5.5 0 0 1-5.5-5.5z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M10 9V6.2M13.2 9V5.6M16.3 9.4V6.6M6.5 14h5.7a1.7 1.7 0 0 1 0 3.4H10" ' + K + ' stroke-width="2.2"/>',
    balta: '<path d="M5 20 15.2 7.6" ' + K + ' stroke-width="2.8"/><path d="M12.6 6.6 16 3.3c2.7.2 4.7 1.7 5.3 4.7-.2 2.4-1.4 4-3.6 4.9L14.4 10.2z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    kazma: '<path d="M5.5 20 14.4 8" ' + K + ' stroke-width="2.8"/><path d="M6.5 5.6c5-1.8 10.6.4 13.6 6.6" ' + K + ' stroke-width="3.4"/>',
    mizrak: '<path d="M4.5 19.5 15 9" ' + K + ' stroke-width="2.6"/><path d="M13 7.4 20.6 3.4l-4 7.6z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    canta: '<path d="M6 10a6 6 0 0 1 12 0v8.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.5 5.2v-.7a2.5 2.5 0 0 1 5 0v.7M9 13.5h6V17H9z" ' + K + ' stroke-width="2.2"/>',
    tablet: '<path d="M3.5 6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M8.5 12 15 8.8M8.5 12l6.5 3.2" ' + K + ' stroke-width="1.8"/><circle cx="8.3" cy="12" r="1.9" fill="currentColor"/><circle cx="15.4" cy="8.6" r="1.9" fill="currentColor"/><circle cx="15.4" cy="15.4" r="1.9" fill="currentColor"/>',
    cekic: '<path d="M5.5 20 14 10" ' + K + ' stroke-width="2.8"/><rect x="10" y="4.6" width="11" height="5.8" rx="1.3" transform="rotate(45 15.5 7.5)" fill="currentColor" stroke="currentColor" stroke-width="1.2"/>',
    kilit: '<rect x="6" y="11" width="12" height="9" rx="2" fill="currentColor"/><path d="M8.6 11V8.2a3.4 3.4 0 0 1 6.8 0V11" ' + K + ' stroke-width="2.4"/>',
    tik: '<path d="M5 12.8 9.6 17.4 19 7.4" ' + K + ' stroke-width="3.2"/>',
    carpi: '<path d="M6 6l12 12M18 6 6 18" ' + K + ' stroke-width="3.2"/>',
    dondur: '<path d="M19.2 12a7.2 7.2 0 1 1-2.4-5.4" ' + K + ' stroke-width="2.8"/><path d="M17.6 2.8v4.4h-4.4" ' + K + ' stroke-width="2.8"/>',
    kutu: '<path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 8l8 4.5L20 8M12 12.5v8" ' + K + ' stroke-width="2"/>',
    ok: '<path d="M9 5.5 15.5 12 9 18.5" ' + K + ' stroke-width="3"/>'
  };
  const el = {};
  let acik = '', sekme = 'yapi', secEsya = null, kirli = true, sure = 0, kurulu = false, odakDon = null;
  const imza = { durum: '', eller: '', vur: '', panel: '', kip: '' };
  const abone = { oyun: false, env: false, yapi: false };
  const onceki = {}; let oncekiHazir = false, sonSeviye = null;
  const notlar = [];

  /* ---------- korumalı okuma ---------- */
  const guvenli = (f, yoksa) => { try { const v = f(); return v === undefined ? yoksa : v; } catch (e) { return yoksa; } };
  const liste = x => Array.isArray(x) ? x : x && typeof x === 'object' ? Object.keys(x).map(k => Object.assign({ id: k }, x[k])) : [];
  const sayi = (v, y) => (typeof v === 'number' && isFinite(v) ? v : y);
  const adet = t => guvenli(() => SO.envanter.adet(t) | 0, 0);
  const esya = id => (SO.esya && SO.esya[id]) || null;
  function ad(id) { const e = esya(id); if (e && e.ad) return e.ad; const t = SO.toplama && SO.toplama.TUR && SO.toplama.TUR[id]; return (t && t.ad) || String(id).replace(/_/g, ' '); }
  function sarmala(s) { return typeof s === 'string' && s ? (s.trim().slice(0, 4) === '<svg' ? s : svg(s)) : ''; }
  function simge(id) { const e = esya(id), t = SO.toplama && SO.toplama.TUR && SO.toplama.TUR[id]; return sarmala(e && e.simge) || sarmala(t && t.simge) || svg(IK.kutu); }
  function eller() { const e = SO.eller, y = e && Array.isArray(e.yuva) ? e.yuva : []; return { yuva: [y[0] || null, y[1] || null, y[2] || null], secili: e && typeof e.secili === 'number' ? e.secili : -1 }; }
  function teknoloji(id) { return liste(SO.teknoloji).find(t => t.id === id) || null; }
  // { ok, kilitli, eksik }: modülün kendi denetimi varsa o, yoksa girdi/envanter ve teknoloji tablosundan
  function denetle(sor, girdi, tek) {
    const eksik = {}; let tam = true; for (const k in (girdi || {})) { const v = adet(k); if (v < girdi[k]) { eksik[k] = girdi[k] - v; tam = false; } }
    const t = tek ? teknoloji(tek) : null, kilit = !!(tek && t && !t.acik), r = guvenli(sor, null);
    if (r && typeof r === 'object') return { ok: !!r.ok, kilitli: r.kilitli != null ? !!r.kilitli : kilit, eksik: r.eksik || eksik };
    return { ok: tam && !kilit, kilitli: kilit, eksik };
  }

  /* ---------- bildirimler ---------- */
  const duz = m => String(m).toLowerCase().replace(/[\s!.:·]/g, '');
  function notYaz(n, metin) { n.metin = metin; n.duz = duz(metin); n.el.textContent = metin; }
  function notSure(n) { clearTimeout(n.z); n.z = setTimeout(() => { n.el.classList.add('cik'); const i = notlar.indexOf(n); if (i >= 0) notlar.splice(i, 1); setTimeout(() => n.el.remove(), 260); }, NOT_SN); }
  // tur verilirse (envanter artışı) aynı türün görünen satırı büyütülür: "+1 dal" → "+2 dal"
  function bildir(metin, vurgu, tur, n) {
    if (!el.bildirim || metin == null || metin === '') return; const simdi = performance.now(), d = duz(metin);
    if (tur) { const v = notlar.find(x => x.tur === tur); if (v) { v.n += n; notYaz(v, '+' + v.n + ' ' + ad(tur).toLocaleLowerCase('tr')); v.t = simdi; v.el.classList.remove('art'); void v.el.offsetWidth; v.el.classList.add('art'); notSure(v); return; } }
    if (notlar.some(x => x.duz === d && simdi - x.t < 400)) return;       // aynı metin art arda iki kaynaktan gelirse (ör. oyun.js + envanter farkı) bir kez
    while (notlar.length >= NOT_EN_COK) { const e = notlar.shift(); clearTimeout(e.z); e.el.remove(); }
    const s = document.createElement('div'); s.className = 'not' + (vurgu ? ' vurgu' : ''); const kayit = { el: s, t: simdi, tur: tur || null, n: n || 0, z: 0 }; notYaz(kayit, String(metin));
    el.bildirim.appendChild(s); notlar.push(kayit); notSure(kayit);
  }
  function envFark(tur) {
    const say = guvenli(() => SO.envanter.say, null); if (!say) return;
    const bak = t => { const v = say[t] | 0, o = onceki[t] | 0; if (oncekiHazir && v > o) bildir('+' + (v - o) + ' ' + ad(t).toLocaleLowerCase('tr'), false, t, v - o); onceki[t] = v; };
    if (tur) bak(tur); else { for (const t in say) bak(t); for (const t in onceki) if (!(t in say)) onceki[t] = 0; }
    oncekiHazir = true;
  }

  /* ---------- üst çubuklar ---------- */
  function durumCiz() {
    const o = SO.oyuncu || {}, oran = (v, m) => { v = sayi(v, 1); m = sayi(m, 1); return m > 0 ? Math.max(0, Math.min(1, v / m)) : 0; };
    const c = Math.round(oran(o.can, o.canMax) * 200) / 200, a = Math.round(oran(o.aclik, o.aclikMax) * 200) / 200, sv = sayi(o.seviye, 1), x = Math.round(oran(sayi(o.xp, 0), o.xpGerek) * 200) / 200;
    const im = c + '|' + a + '|' + sv + '|' + x + '|' + Math.round(sayi(o.can, 0)) + '|' + Math.round(sayi(o.aclik, 0)); if (im === imza.durum) return; imza.durum = im;
    const yaz = (kap, dolgu, oranV, deger, enCok, etiket) => { dolgu.style.transform = 'scaleX(' + oranV + ')'; kap.classList.toggle('az', oranV <= .25); kap.setAttribute('aria-valuenow', Math.round(oranV * 100)); kap.setAttribute('aria-valuetext', etiket + ': ' + (deger != null ? Math.round(deger) + ' / ' + Math.round(enCok) : '%' + Math.round(oranV * 100))); };
    yaz(el.can, el.canD, c, o.can, o.canMax, 'Can'); yaz(el.aclik, el.aclikD, a, o.aclik, o.aclikMax, 'Açlık');
    el.sevNo.textContent = sv; el.xpD.style.transform = 'scaleX(' + x + ')'; el.seviye.setAttribute('aria-valuenow', Math.round(x * 100));
    el.seviye.setAttribute('aria-valuetext', 'Seviye ' + sv + (o.xpGerek ? ', deneyim ' + Math.round(sayi(o.xp, 0)) + ' / ' + Math.round(o.xpGerek) : ''));
    if (sonSeviye != null && sv > sonSeviye) bildir('Seviye ' + sv + '!', true); sonSeviye = sv;
  }

  /* ---------- el yuvaları ve vurma düğmesi ---------- */
  function vurSimge(id) { if (!id) return [svg(IK.yumruk), 'Vur']; const s = String(id);
    if (s.indexOf('balta') >= 0) return [svg(IK.balta), 'Kes']; if (s.indexOf('kazma') >= 0) return [svg(IK.kazma), 'Kaz']; if (s.indexOf('mizrak') >= 0) return [svg(IK.mizrak), 'Sapla'];
    const e = esya(id); return [e && e.simge ? sarmala(e.simge) : svg(IK.yumruk), 'Vur']; }
  function ellerCiz() {
    const e = eller(), im = e.yuva.join(',') + '|' + e.secili + '|' + (SO.esya ? 1 : 0); if (im === imza.eller) return; imza.eller = im;
    for (let i = 0; i < 3; i++) { const b = el.yuva[i], id = e.yuva[i], sec = e.secili === i;
      b.lastElementChild.innerHTML = id ? simge(id) : ''; b.classList.toggle('sec', sec); b.classList.toggle('bos', !id); b.setAttribute('aria-pressed', sec ? 'true' : 'false');
      b.setAttribute('aria-label', 'El yuvası ' + (i + 1) + ': ' + (id ? ad(id) : 'boş') + (sec ? ' (elde)' : '')); }
    const v = vurSimge(e.secili >= 0 ? e.yuva[e.secili] : null), vi = v[0] + '|' + v[1];
    if (vi !== imza.vur) { imza.vur = vi; el.vur.innerHTML = v[0]; el.vur.setAttribute('aria-label', v[1] + (e.secili >= 0 && e.yuva[e.secili] ? ' (' + ad(e.yuva[e.secili]) + ')' : '')); }
  }

  /* ---------- yerleştirme kipi ---------- */
  function kipCiz() {
    const k = guvenli(() => SO.yapi.kip, null) || null, im = k ? k.id + '|' + (k.uygun === false ? 0 : 1) : ''; if (im === imza.kip) return; const onceydi = !!imza.kip; imza.kip = im;
    const var_ = !!k; el.padR.classList.toggle('kip', var_); el.yerlestir.hidden = el.dondur.hidden = el.iptal.hidden = !var_; el.vur.hidden = el.zipla.hidden = var_;
    if (var_) { const uy = k.uygun !== false; el.yerlestir.classList.toggle('soluk', !uy); el.yerlestir.setAttribute('aria-disabled', uy ? 'false' : 'true'); if (!onceydi) { SO.input.vur = false; el.vur.classList.remove('on'); if (acik) kapat(); } }
  }

  /* ---------- paneller ---------- */
  const BASLIK = { canta: 'Çanta', cekic: 'Çekiç', tablet: 'Tablet' };
  function ac(tur) {
    if (!kurulu || !BASLIK[tur]) return; if (acik === tur) { kapat(); return; }
    guvenli(() => SO.harita.kapat()); if (!acik) odakDon = document.activeElement;
    acik = tur; el.panel.hidden = false; el.panel.setAttribute('aria-label', BASLIK[tur]); el.pBaslik.textContent = BASLIK[tur]; el.pSekme.hidden = tur !== 'cekic'; el.pPuan.hidden = tur !== 'tablet'; el.pAlt.hidden = tur !== 'canta';
    dugmeDurum(); imza.panel = ''; el.govde.scrollTop = 0; panelCiz(); try { el.panel.focus({ preventScroll: true }); } catch (e) { }
  }
  function kapat() {
    if (!acik) return; const odak = el.panel.contains(document.activeElement); acik = ''; el.panel.hidden = true; suruk = null; dugmeDurum();
    if (odak && odakDon && odakDon.focus) try { odakDon.focus({ preventScroll: true }); } catch (e) { } odakDon = null;
  }
  function dugmeDurum() { [['canta', el.bCanta], ['cekic', el.bCekic], ['tablet', el.bTablet]].forEach(p => { const a = acik === p[0]; p[1].classList.toggle('on', a); p[1].setAttribute('aria-expanded', a ? 'true' : 'false'); }); }
  function malzeme(girdi) { let h = ''; for (const k in (girdi || {})) { const v = adet(k), g = girdi[k]; h += '<span class="mlz' + (v < g ? ' eksik' : '') + '" title="' + kacis(ad(k)) + '">' + simge(k) + '<b>' + v + '/' + g + '</b><span class="gizli"> ' + kacis(ad(k)) + (v < g ? ' (eksik)' : '') + '</span></span>'; } return h; }
  const kacis = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function kilitNot(tek) { const t = teknoloji(tek); return t && t.seviye != null ? 'Seviye ' + t.seviye + '\'de tablette açılır' : 'Tablette açılır'; }

  // Panelin gösterdiği her şeyin modeli; imzası değişmedikçe DOM'a dokunulmaz.
  function model() {
    if (acik === 'canta') {
      const say = guvenli(() => SO.envanter.say, {}) || {}, e = eller(), es = [];
      for (const t in say) if ((say[t] | 0) > 0) es.push([t, say[t] | 0]);
      if (secEsya && !es.some(x => x[0] === secEsya)) secEsya = null;
      return { es, yuva: e.yuva, secili: e.secili, sec: secEsya, sinif: secEsya && esya(secEsya) ? esya(secEsya).sinif : '', tablo: SO.esya ? 1 : 0 };
    }
    if (acik === 'cekic') {
      const yapi = sekme === 'yapi', kaynak = liste(yapi ? SO.yapilar : SO.tarifler), masaYakin = guvenli(() => !!SO.yapi.yakin('uretim_masasi'), null);
      return { sekme, sat: kaynak.map(s => { const d = yapi ? denetle(() => SO.yapi.yapabilir(s.id), s.girdi, s.teknoloji) : denetle(() => SO.oyun.uretebilir(s.id), s.girdi, s.teknoloji);
        const cik = !yapi && s.cikti ? Object.keys(s.cikti)[0] : null, girdi = {}; for (const k in (s.girdi || {})) girdi[k] = [adet(k), s.girdi[k]];
        let neden = ''; if (d.kilitli) neden = kilitNot(s.teknoloji); else if (!d.ok) { if (Object.keys(d.eksik || {}).length) neden = ''; else if (s.sinif === 'masa' && masaYakin !== true) neden = 'Üretim masasının yanında yapılır'; }
        return { id: s.id, ad: s.ad || (cik ? ad(cik) : s.id), ok: d.ok, kilitli: d.kilitli, girdi, neden, masa: s.sinif === 'masa', cik, n: cik ? s.cikti[cik] : 0, var_: yapi ? !!(SO.yapi && SO.yapi.basla) : !!(SO.oyun && SO.oyun.uret) }; }) };
    }
    if (acik === 'tablet') {
      const o = SO.oyuncu || {}, sv = sayi(o.seviye, 1), puan = sayi(o.puan, 0);
      const tek = liste(SO.teknoloji).map((t, i) => ({ id: t.id, ad: t.ad || t.id, seviye: sayi(t.seviye, 1), puan: sayi(t.puan, 0), acik: !!t.acik, i })).sort((a, b) => a.seviye - b.seviye || a.i - b.i);
      tek.forEach(t => { t.durum = t.acik ? 'acik' : (sv >= t.seviye && puan >= t.puan ? 'hazir' : 'kilit'); t.neden = t.durum !== 'kilit' ? '' : sv < t.seviye ? 'Seviye ' + t.seviye + ' gerekir' : t.puan + ' puan gerekir (' + (t.puan - puan) + ' eksik)'; });
      return { puan, sv, tek };
    }
    return null;
  }
  function panelCiz() {
    if (!acik) return; const m = model(), im = acik + JSON.stringify(m); if (im === imza.panel) return; imza.panel = im; const g = el.govde, kay = g.scrollTop; let h = '';
    if (acik === 'canta') {
      if (!m.es.length) h = '<p class="bosluk">Çanta boş. Yerdeki dal ve taşları toplayarak başla.</p>';
      else { h = '<div class="izg" role="list">'; m.es.forEach(x => { h += '<button type="button" class="es' + (x[0] === m.sec ? ' sec' : '') + '" role="listitem" data-esya="' + kacis(x[0]) + '" aria-pressed="' + (x[0] === m.sec) + '" aria-label="' + kacis(ad(x[0])) + ', ' + x[1] + ' adet">' + simge(x[0]) + '<b>' + x[1] + '</b></button>'; }); h += '</div>'; }
      for (let i = 0; i < 3; i++) { const b = el.pYuva[i], id = m.yuva[i]; b.lastElementChild.innerHTML = id ? simge(id) : ''; b.classList.toggle('sec', m.secili === i); b.classList.toggle('bos', !id); b.setAttribute('aria-label', 'El yuvası ' + (i + 1) + ': ' + (id ? ad(id) + '. Çantaya geri koy' : 'boş')); }
      const s = m.sec; el.pAd.textContent = s ? ad(s) : 'Bir eşyaya dokun'; el.pAd.classList.toggle('soluk', !s);
      const SINIF = { malzeme: 'Malzeme', alet: 'Alet', silah: 'Silah', yiyecek: 'Yiyecek' }; el.pSinif.textContent = s ? (SINIF[m.sinif] || '') + (s ? ' · ' + adet(s) + ' adet' : '') : 'Yuvaya dokununca eşya çantaya döner'; if (s && !SINIF[m.sinif]) el.pSinif.textContent = adet(s) + ' adet';
      const kus = s && (m.sinif === 'alet' || m.sinif === 'silah'), ye = s && m.sinif === 'yiyecek'; el.pEylem.hidden = !(kus || ye); el.pEylem.textContent = kus ? 'Ele al' : 'Ye'; el.pEylem.dataset.is = kus ? 'kusan' : 'ye';
    } else if (acik === 'cekic') {
      el.sekYapi.setAttribute('aria-selected', m.sekme === 'yapi'); el.sekEl.setAttribute('aria-selected', m.sekme === 'el');
      if (!m.sat.length) h = '<p class="bosluk">' + (m.sekme === 'yapi' ? 'Henüz yapılacak bir şey yok.' : 'Henüz tarif yok.') + '</p>';
      m.sat.forEach(s => { let mz = ''; for (const k in s.girdi) { const v = s.girdi[k]; mz += '<span class="mlz' + (v[0] < v[1] ? ' eksik' : '') + '">' + simge(k) + '<b>' + v[0] + '/' + v[1] + '</b><span class="gizli"> ' + kacis(ad(k)) + (v[0] < v[1] ? ' (eksik)' : '') + '</span></span>'; }
        const sim = m.sekme === 'yapi' ? (sarmala((liste(SO.yapilar).find(y => y.id === s.id) || {}).simge) || svg(IK.kutu)) : (s.cik ? simge(s.cik) : svg(IK.kutu));
        const yap = s.ok && s.var_, sag = s.kilitli ? '<span class="sag kilit">' + svg(IK.kilit) + '</span>' : yap ? '<span class="sag yap">' + (m.sekme === 'yapi' ? 'Yerleştir' : 'Yap') + '</span>' : '';
        h += '<button type="button" class="sat' + (yap ? ' olur' : '') + (s.kilitli ? ' kilitli' : '') + '" data-sat="' + kacis(s.id) + '" aria-disabled="' + !yap + '"><span class="sim">' + sim + '</span><span class="orta"><span class="adi">' + kacis(s.ad) + (s.n > 1 ? ' ×' + s.n : '') + (s.masa ? ' <i class="etk">masa</i>' : '') + '</span>' +
          (s.kilitli ? '<span class="neden">' + kacis(s.neden) + '</span>' : '<span class="mlzler">' + mz + '</span>' + (s.neden ? '<span class="neden">' + kacis(s.neden) + '</span>' : '')) + '</span>' + sag + '</button>'; });
    } else if (acik === 'tablet') {
      el.pPuan.innerHTML = '<b>' + m.puan + '</b> puan'; el.pPuan.setAttribute('aria-label', 'Teknoloji puanı: ' + m.puan);
      if (!m.tek.length) h = '<p class="bosluk">Henüz teknoloji yok.</p>'; let sv = null;
      m.tek.forEach(t => { if (t.seviye !== sv) { sv = t.seviye; h += '<h3 class="grup' + (m.sv < sv ? ' ileri' : '') + '">Seviye ' + sv + (m.sv < sv ? ' ' + svg(IK.kilit) : '') + '</h3>'; }
        const sag = t.durum === 'acik' ? '<span class="sag tamam">' + svg(IK.tik) + 'Açık</span>' : t.durum === 'hazir' ? '<span class="sag yap">Aç · ' + t.puan + ' puan</span>' : '<span class="sag kilit">' + svg(IK.kilit) + '</span>';
        h += '<button type="button" class="sat tek ' + t.durum + (t.durum === 'hazir' ? ' olur' : '') + '" data-tek="' + kacis(t.id) + '" aria-disabled="' + (t.durum !== 'hazir') + '"><span class="orta"><span class="adi">' + kacis(t.ad) + '</span>' + (t.neden ? '<span class="neden">' + kacis(t.neden) + '</span>' : '') + '</span>' + sag + '</button>'; });
    }
    g.innerHTML = h; g.scrollTop = kay; kaydirGoster();
  }

  /* ---------- panel içi dokunuşlar ---------- */
  function govdeTik(e) {
    const b = e.target.closest('button'); if (!b || !el.govde.contains(b)) return; const d = b.dataset;
    if (d.esya) { secEsya = secEsya === d.esya ? null : d.esya; }
    else if (d.sat) {
      const yapi = sekme === 'yapi', s = liste(yapi ? SO.yapilar : SO.tarifler).find(x => x.id === d.sat); if (!s) return;
      if (b.getAttribute('aria-disabled') === 'true') { const dn = yapi ? denetle(() => SO.yapi.yapabilir(s.id), s.girdi, s.teknoloji) : denetle(() => SO.oyun.uretebilir(s.id), s.girdi, s.teknoloji);
        bildir(dn.kilitli ? kilitNot(s.teknoloji) : Object.keys(dn.eksik || {}).length ? 'Malzeme eksik' : s.sinif === 'masa' ? 'Üretim masasının yanında yapılır' : 'Şimdi yapılamıyor'); salla(b); return; }
      if (yapi) { kapat(); guvenli(() => SO.yapi.basla(s.id)); } else if (guvenli(() => SO.oyun.uret(s.id), false) === false) { bildir('Yapılamadı'); salla(b); }
    } else if (d.tek) {
      if (b.classList.contains('acik')) return;
      const t = teknoloji(d.tek), r = b.getAttribute('aria-disabled') === 'true' ? null : guvenli(() => SO.oyun.teknolojiAc(d.tek), null);
      if (r && r.ok) bildir((t && t.ad ? t.ad : 'Teknoloji') + ' açıldı', true); else { const n = b.querySelector('.neden'); bildir((r && r.neden) || (n && n.textContent) || 'Açılamadı'); salla(b); }
    }
    kirli = true; panelCiz();
  }
  function salla(b) { b.classList.remove('salla'); void b.offsetWidth; b.classList.add('salla'); }
  function altTik(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.yuva != null) { const i = +b.dataset.yuva, e2 = eller();
      if (e2.yuva[i]) guvenli(() => SO.oyun.cikar(i)); else if (secEsya && esya(secEsya) && (esya(secEsya).sinif === 'alet' || esya(secEsya).sinif === 'silah')) guvenli(() => SO.oyun.kusan(secEsya, i)); }
    else if (b === el.pEylem && secEsya) {
      if (b.dataset.is === 'ye') guvenli(() => SO.oyun.ye(secEsya));
      else { const e2 = eller(); let i = e2.yuva.indexOf(null); if (i < 0) i = e2.secili >= 0 ? e2.secili : 0; guvenli(() => SO.oyun.kusan(secEsya, i)); }
    }
    kirli = true; ellerCiz(); panelCiz();
  }

  /* ---------- sürükleyerek kaydırma (sahne dönükken de parmağı izler) ---------- */
  let suruk = null, yutTik = false, akis = 0;
  const donuk = () => { const r = el.wrap.getBoundingClientRect(); return r.height > r.width; };
  const sahneY = (e, d) => (d ? -e.clientX : e.clientY);
  function kaydirGoster() { const g = el.govde, t = el.kaydir, fazla = g.scrollHeight - g.clientHeight; if (fazla <= 1) { t.hidden = true; return; } t.hidden = false; const boy = Math.max(24, g.clientHeight * g.clientHeight / g.scrollHeight); t.style.height = boy + 'px'; t.style.transform = 'translateY(' + (g.scrollTop / fazla) * (g.clientHeight - boy) + 'px)'; }
  function surukKur() {
    const g = el.govde;
    g.addEventListener('pointerdown', e => { if (e.button > 0) return; cancelAnimationFrame(akis); const d = donuk(); suruk = { id: e.pointerId, d, y0: sahneY(e, d), s0: g.scrollTop, git: false, y: sahneY(e, d), t: performance.now(), v: 0 }; });
    g.addEventListener('pointermove', e => { const s = suruk; if (!s || e.pointerId !== s.id) return; const y = sahneY(e, s.d), dy = y - s.y0;
      if (!s.git) { if (Math.abs(dy) < SURUK_ESIK || g.scrollHeight <= g.clientHeight) return; s.git = true; s.y0 = y; s.s0 = g.scrollTop; try { g.setPointerCapture(e.pointerId); } catch (x) { } }
      const simdi = performance.now(), dt = simdi - s.t; if (dt > 0) s.v = s.v * .6 + ((s.y - y) / dt) * .4; s.y = y; s.t = simdi; g.scrollTop = s.s0 - (y - s.y0); });
    const bitir = e => { const s = suruk; if (!s || e.pointerId !== s.id) return; suruk = null; if (!s.git) return; yutTik = true; setTimeout(() => { yutTik = false; }, 60);
      let v = performance.now() - s.t < 80 ? s.v : 0, son = performance.now(); if (Math.abs(v) < .15) return;                                   // bırakınca kısa bir süre kendi hızıyla kayar
      const adim = t => { const dt = Math.min(40, t - son); son = t; g.scrollTop += v * dt; v *= Math.exp(-dt / 280); if (Math.abs(v) > .03 && acik) akis = requestAnimationFrame(adim); }; akis = requestAnimationFrame(adim); };
    g.addEventListener('pointerup', bitir); g.addEventListener('pointercancel', bitir);
    g.addEventListener('click', e => { if (yutTik) { e.stopPropagation(); e.preventDefault(); yutTik = false; } }, true);
    g.addEventListener('scroll', kaydirGoster, { passive: true });
  }

  /* ---------- kurulum ---------- */
  function aboneOl() {
    if (!abone.oyun && SO.oyun && typeof SO.oyun.dinle === 'function') { abone.oyun = true; guvenli(() => SO.oyun.dinle(() => { kirli = true; })); }
    if (!abone.env && SO.envanter && typeof SO.envanter.dinle === 'function') { abone.env = true; guvenli(() => SO.envanter.dinle(tur => { envFark(typeof tur === 'string' ? tur : null); kirli = true; })); }
    if (!abone.yapi && SO.yapi && typeof SO.yapi.dinle === 'function') { abone.yapi = true; guvenli(() => SO.yapi.dinle(() => { kirli = true; })); }
  }
  function tut(b, bas, birak) {
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); guvenli(() => SO.ses.init()); bas(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) { } });
    const up = () => { birak(); b.classList.remove('on'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); b.addEventListener('contextmenu', e => e.preventDefault());
  }
  function init() {
    if (kurulu) return;
    ['wrap', 'stage', 'panel', 'bildirim', 'padR'].forEach(k => { el[k] = al(k); });
    Object.assign(el, { can: al('dCan'), aclik: al('dAclik'), seviye: al('seviye'), sevNo: al('sevNo'), xpD: al('xpD'), vur: al('bVur'), zipla: al('bJump'), yerlestir: al('bYerlestir'), dondur: al('bDondur'), iptal: al('bIptal'),
      bCanta: al('bCanta'), bCekic: al('bCekic'), bTablet: al('bTablet'), govde: al('pGovde'), kaydir: al('pKaydir'), pBaslik: al('pBaslik'), pSekme: al('pSekme'), sekYapi: al('sekYapi'), sekEl: al('sekEl'), pPuan: al('pPuan'), pAlt: al('pAlt'), pAd: al('pAd'), pSinif: al('pSinif'), pEylem: al('pEylem'), pKapat: al('pKapat') });
    if (!el.panel || !el.can || !el.vur || !el.govde) return;                                           // index.html'de arayüz öğeleri yoksa sessizce çık
    el.canD = el.can.querySelector('b'); el.aclikD = el.aclik.querySelector('b'); el.yuva = [0, 1, 2].map(i => al('bYuva' + i)); el.pYuva = [0, 1, 2].map(i => al('pYuva' + i));
    el.bCanta.innerHTML = svg(IK.canta); el.bCekic.innerHTML = svg(IK.cekic); el.bTablet.innerHTML = svg(IK.tablet); el.pKapat.innerHTML = svg(IK.carpi);
    el.yerlestir.innerHTML = svg(IK.tik) + '<span>Yerleştir</span>'; el.dondur.innerHTML = svg(IK.dondur) + '<span>Döndür</span>'; el.iptal.innerHTML = svg(IK.carpi) + '<span>İptal</span>';
    kurulu = true;

    el.yuva.forEach((b, i) => b.addEventListener('click', () => { guvenli(() => SO.oyun.elSec(i)); kirli = true; ellerCiz(); }));
    el.bCanta.addEventListener('click', () => ac('canta')); el.bCekic.addEventListener('click', () => ac('cekic')); el.bTablet.addEventListener('click', () => ac('tablet'));
    tut(el.vur, () => { SO.input.vur = true; }, () => { SO.input.vur = false; });
    el.yerlestir.addEventListener('click', () => { const k = guvenli(() => SO.yapi.kip, null); if (k && k.uygun === false) { bildir('Buraya yerleşmez'); salla(el.yerlestir); return; } guvenli(() => SO.yapi.onayla()); kipCiz(); });
    el.dondur.addEventListener('click', () => { guvenli(() => SO.yapi.dondur()); }); el.iptal.addEventListener('click', () => { guvenli(() => SO.yapi.iptal()); kipCiz(); });

    // panel: dokunuş sahneye (çubuk/kamera) gitmez; dışına dokunuş kapatır (ve sahneye gider: oyun sürer)
    ['pointerdown', 'wheel'].forEach(t => el.panel.addEventListener(t, e => e.stopPropagation())); el.panel.addEventListener('contextmenu', e => e.preventDefault());
    el.stage.addEventListener('pointerdown', e => { if (acik && !el.panel.contains(e.target) && !e.target.closest('.btn')) kapat(); }, true);
    el.pKapat.addEventListener('click', kapat); el.govde.addEventListener('click', govdeTik); el.pAlt.addEventListener('click', altTik);
    const sekSec = s => { if (sekme === s) return; sekme = s; el.govde.scrollTop = 0; panelCiz(); }; el.sekYapi.addEventListener('click', () => sekSec('yapi')); el.sekEl.addEventListener('click', () => sekSec('el'));
    surukKur();
    const tam = al('hTam'); if (tam && window.MutationObserver) new MutationObserver(() => { if (!tam.hidden && acik) kapat(); }).observe(tam, { attributes: true, attributeFilter: ['hidden'] });
    if (window.ResizeObserver) new ResizeObserver(kaydirGoster).observe(el.govde);

    addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, kip = guvenli(() => SO.yapi.kip, null);
      if (k === 'f') { if (!e.repeat && !kip) { SO.input.vur = true; el.vur.classList.add('on'); } }
      else if (k === '1' || k === '2' || k === '3') { if (!e.repeat) { guvenli(() => SO.oyun.elSec(+k - 1)); kirli = true; } }
      else if (k === 'i' || k === 'Tab') { e.preventDefault(); if (!e.repeat) ac('canta'); }
      else if (k === 'b') { if (!e.repeat) ac('cekic'); }
      else if (k === 't') { if (!e.repeat) ac('tablet'); }
      else if (k === 'Escape') { if (acik) kapat(); else if (kip) { guvenli(() => SO.yapi.iptal()); } }
      else if (kip && k === 'r') { if (!e.repeat) guvenli(() => SO.yapi.dondur()); }
      else if (kip && k === 'Enter' && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) { if (!e.repeat) el.yerlestir.click(); }
    });
    addEventListener('keyup', e => { if (e.key === 'f' || e.key === 'F') { SO.input.vur = false; el.vur.classList.remove('on'); } });
    addEventListener('blur', () => { SO.input.vur = false; el.vur.classList.remove('on'); });
    if (SO.input.vur === undefined) SO.input.vur = false;
    aboneOl(); envFark(); yenile();
  }
  function yenile() { if (!kurulu) return; kirli = false; durumCiz(); ellerCiz(); kipCiz(); if (acik) panelCiz(); }
  function update(dt) {
    if (!kurulu) return; kipCiz(); sure += dt;
    if (!kirli && sure < YOKLA) return;
    if (sure >= YOKLA) { sure = 0; if (!abone.oyun || !abone.env || !abone.yapi) aboneOl(); if (!abone.env) envFark(); }
    yenile();
  }
  SO.arayuz = { init, update, bildir: (metin, vurgu) => bildir(metin, vurgu), ac, kapat, yenile, get acik() { return acik; } };
})();
