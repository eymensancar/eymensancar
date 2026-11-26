/*
 * npc-dil.js - Toplum Simulasyonu NPC Turkce dil motoru
 *
 * Tarayicida <script> ile, Node'da require ile calisir. Bagimlilik yok, DOM yok.
 * Rastgelelik YALNIZ disaridan gelen rng ile: rng.next() -> [0,1).
 *
 * Bolumler:
 *   1. Temel metin yardimcilari (kucultme, katlama, rng)
 *   2. normal()         - kucultme, temizleme, sohbet kisaltmalarini acma
 *   3. dilBul()         - kaba dil tahmini
 *   4. Varliklar        - tutar, meslek, mulk, yer, kisi, kanal, kufur
 *   5. niyetBul()       - agirlikli kural puanlama
 *   6. ek               - Turkce ek uyumu (de, e, den, in, i, le, li)
 *   7. veri             - adlar, soyadlar, yerler, yabanci veri, takmaAd()
 *   8. SABLON           - cevap / paylasim / dm / rapor / global kaliplari
 *   9. uret(), stillendir()
 */
(function () {
  'use strict';

  // =====================================================================
  // 1. TEMEL METIN YARDIMCILARI
  // =====================================================================
  var KATLA_HARITA = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u',
    'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U', 'Â': 'A', 'Î': 'I', 'Û': 'U'
  };
  function katla(s) {
    return String(s == null ? '' : s).replace(/[çğıöşüâîûÇĞİÖŞÜÂÎÛ]/g, function (c) { return KATLA_HARITA[c]; });
  }
  function kucult(s) {
    return String(s == null ? '' : s)
      .replace(/İ/g, 'i').replace(/I/g, 'ı')
      .toLowerCase().replace(/̇/g, '');
  }
  function buyut(s) {
    return String(s == null ? '' : s).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
  }
  // Yalniz metin bir harfle basliyorsa (onunde tirnak, ¡, ¿ olabilir) ilk harfe dokunur; "1.500.000 ₺ mı?" bozulmaz.
  function ilkHarfYeri(s) {
    var m = /^[\s"“'¡¿(]*(?=\p{L})/u.exec(s);
    return m ? m[0].length : -1;
  }
  function ilkBuyuk(s) {
    s = String(s || '');
    var i = ilkHarfYeri(s);
    if (i < 0) return s;
    return s.slice(0, i) + buyut(s.charAt(i)) + s.slice(i + 1);
  }
  function ilkKucuk(s) {
    s = String(s || '');
    var i = ilkHarfYeri(s);
    if (i < 0) return s;
    return s.slice(0, i) + kucult(s.charAt(i)) + s.slice(i + 1);
  }
  function kacis(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Tohumlu basit rng (yalniz rng verilmezse ve testler icin). Math.random kullanilmaz.
  function rngOlustur(tohum) {
    var a = (Number(tohum) >>> 0) || 0x9e3779b9;
    return {
      next: function () {
        a = (a + 0x6D2B79F5) >>> 0;
        var t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }
    };
  }
  function rs(rng) { var x = rng.next(); return x >= 1 ? 0.999999 : (x < 0 ? 0 : x); }
  function sec(rng, dizi) { return dizi[Math.floor(rs(rng) * dizi.length)]; }
  function sans(rng, p) { return rs(rng) < p; }
  function sinirla(x, a, b, v) { x = Number(x); if (!isFinite(x)) x = v; return x < a ? a : (x > b ? b : x); }

  // =====================================================================
  // 2. NORMAL: kucultme, temizleme, kisaltmalari acma
  // =====================================================================
  // anahtar: katli (Turkce harfsiz) yazim -> acilmis Turkce
  var KISALTMA = {
    slm: 'selam', slmm: 'selam', selm: 'selam', slmlar: 'selamlar', sa: 'selamün aleyküm', sea: 'selamün aleyküm',
    as: 'aleyküm selam', aleykumselam: 'aleyküm selam', selamunaleykum: 'selamün aleyküm',
    mrb: 'merhaba', mrhb: 'merhaba', mrba: 'merhaba', meraba: 'merhaba', merhba: 'merhaba', mrbler: 'merhabalar',
    nbr: 'ne haber', nbr2: 'ne haber', naber: 'ne haber', nabr: 'ne haber', napan: 'ne haber',
    nslsn: 'nasılsın', nasilsn: 'nasılsın', naslsn: 'nasılsın', nslsin: 'nasılsın', nasisin: 'nasılsın',
    nasi: 'nasıl', nasl: 'nasıl', nsl: 'nasıl',
    tsk: 'teşekkürler', tskler: 'teşekkürler', tsklr: 'teşekkürler', tesekkurler: 'teşekkürler', tesekkur: 'teşekkür',
    tsekkurler: 'teşekkürler', tesekurler: 'teşekkürler', tskr: 'teşekkürler',
    sgol: 'sağ ol', sagol: 'sağ ol', saol: 'sağ ol', sagolun: 'sağ olun', saolun: 'sağ olun', sagolasin: 'sağ olasın',
    eyw: 'eyvallah', eyv: 'eyvallah', eywallah: 'eyvallah', eyvalla: 'eyvallah',
    knk: 'kanka', kanki: 'kanka', kank: 'kanka',
    aby: 'abi', abicim: 'abi', abla: 'abla', ablacim: 'abla',
    hcm: 'hocam', hocm: 'hocam',
    kib: 'kendine iyi bak', kendineiyibak: 'kendine iyi bak',
    bb: 'bay bay', bbye: 'bay bay', bye: 'bay bay', baybay: 'bay bay',
    tmm: 'tamam', tm: 'tamam', tamm: 'tamam', tmam: 'tamam', tmmdir: 'tamamdır', tmmdr: 'tamamdır', ok: 'tamam', okey: 'tamam', oki: 'tamam',
    yoa: 'yok ya', yoo: 'yok', yk: 'yok', vr: 'var',
    bi: 'bir', bisey: 'bir şey', bisi: 'bir şey', biseyler: 'bir şeyler',
    nap: 'ne yapıyorsun', napiyon: 'ne yapıyorsun', napiyosun: 'ne yapıyorsun', napiyorsun: 'ne yapıyorsun', napion: 'ne yapıyorsun',
    napiyonuz: 'ne yapıyorsunuz', napiyosunuz: 'ne yapıyorsunuz', naptin: 'ne yaptın', naptn: 'ne yaptın',
    napcaz: 'ne yapacağız', napicaz: 'ne yapacağız', napcam: 'ne yapacağım', napicam: 'ne yapacağım', napim: 'ne yapayım', napiyim: 'ne yapayım',
    noldu: 'ne oldu', nolur: 'ne olur', nolcak: 'ne olacak',
    ii: 'iyi', iyimisin: 'iyi misin',
    grs: 'görüşürüz', grsz: 'görüşürüz', grsrz: 'görüşürüz', gorusuruz: 'görüşürüz',
    hg: 'hoş geldin', hosgeldin: 'hoş geldin', hosgeldiniz: 'hoş geldiniz', hb: 'hoş bulduk', hosbulduk: 'hoş bulduk',
    gnydn: 'günaydın', gunaydin: 'günaydın', gunaydn: 'günaydın',
    ins: 'inşallah', insallah: 'inşallah', insalah: 'inşallah',
    msl: 'mesela', tbr: 'tebrikler', tbrk: 'tebrikler', tbrkler: 'tebrikler',
    cnm: 'canım', pls: 'lütfen', plz: 'lütfen', ltf: 'lütfen', lutfen: 'lütfen',
    dgl: 'değil', degl: 'değil', dimi: 'değil mi', dmi: 'değil mi',
    nrde: 'nerede', nerde: 'nerede', nrden: 'nereden', nerden: 'nereden', nerdesin: 'neredesin', nerdensin: 'neredensin',
    mrsi: 'mersi', mersi: 'mersi', slmlr: 'selamlar', iyiaksamlar: 'iyi akşamlar', iyigeceler: 'iyi geceler',
    yaa: 'ya', yaw: 'ya', ya: 'ya', abe: 'abi', moruk: 'moruk',
    oyle: 'öyle', ole: 'öyle', boyle: 'böyle', bole: 'böyle', simdi: 'şimdi', sindi: 'şimdi',
    olurmu: 'olur mu', varmi: 'var mı', yokmu: 'yok mu', degilmi: 'değil mi', iyimi: 'iyi mi',
    aliyom: 'alıyorum', ariyom: 'arıyorum', ariyoz: 'arıyoruz', bakiyom: 'bakıyorum', istiyom: 'istiyorum', calisiyom: 'çalışıyorum',
    biliyon: 'biliyorsun', bilmiyom: 'bilmiyorum', satiyom: 'satıyorum', yapiyom: 'yapıyorum',
    evt: 'evet', evet: 'evet', evettt: 'evet', yes: 'evet', yep: 'evet', yeah: 'evet',
    nope: 'hayır', nop: 'hayır', yook: 'yok', yokk: 'yok', hyr: 'hayır', hayir: 'hayır', no: 'hayır',
    sry: 'kusura bakma', sorry: 'kusura bakma', kb: 'kusura bakma', kusra: 'kusura', pardn: 'pardon',
    help: 'yardım', yardm: 'yardım', yrdm: 'yardım',
    arkdslr: 'arkadaşlar', arkadaslr: 'arkadaşlar', arkdaslar: 'arkadaşlar', arkdas: 'arkadaş', ahaliye: 'ahaliye',
    hoscakal: 'hoşça kal', hoscakalin: 'hoşça kalın', hosckal: 'hoşça kal', gorusmek: 'görüşmek',
    gidiyim: 'gideyim', kaciyim: 'kaçayım', cikiyim: 'çıkayım', yatiyim: 'yatayım',
    burda: 'burada', orda: 'orada', surda: 'şurada', nerdeyse: 'neredeyse', nerden: 'nereden', nerelerdesin: 'nerelerdesin',
    tamamdr: 'tamamdır', bisi: 'bir şey', bisiy: 'bir şey', napiyonuz: 'ne yapıyorsunuz',
    mashallah: 'maşallah', masallah: 'maşallah', maasallah: 'maşallah', mşallah: 'maşallah',
    chatbot: 'chat bot', npcmi: 'npc mi', botmu: 'bot mu', botmusun: 'bot musun',
    partime: 'part time', parttime: 'part time', isim: 'isim'
  };

  function temizle(k) {
    var t = k.replace(/[’‘'`´]/g, '');
    t = t.replace(/(\d)\.(?=\d)/g, '$1\u0001').replace(/(\d),(?=\d)/g, '$1\u0002').replace(/(\d)\+(?=\d)/g, '$1\u0003');
    t = t.replace(/[^\p{L}\p{N}\s\u0001\u0002\u0003%₺]/gu, ' ');
    t = t.replace(/\u0001/g, '.').replace(/\u0002/g, ',').replace(/\u0003/g, '+');
    t = t.replace(/(\p{L})\1{2,}/gu, '$1');
    t = t.replace(/(\p{L}{2,}?)(\p{L})\2(?=\s|$)/gu, function (x, g, h) { return /[aeıioöuü]/.test(g) ? g + h : x; });
    return t.replace(/\s+/g, ' ').trim();
  }

  // ---- Agiz ve bitisik yazim duzeltmeleri (genel kurallar) ----
  // bitisik soru eki yalniz su govdelerde tek basina ayrilir: varmi, olurmu, iyimi ...
  var SORU_GOVDE = /^(var|yok|olur|olmaz|iyi|dogru|tamam|mumkun|uygun|lazim|gercek|kabul|guzel|pahali|ucuz|bot|insan|yeni|burda|burada|orda|orada|kolay|zor|deger|karli|ciddi|emin|musait)$/;
  var GELECEK_ISTISNA = { amcam: 1, hocam: 1, bacam: 1, yengecem: 1 };
  var UNLU_RE = /[aeıioöuü]/;
  function kalinMi(govde) {
    var u = (govde.match(/[aeıioöuü]/g) || []);
    return 'aıou'.indexOf(u[u.length - 1] || 'e') >= 0;
  }
  function agizDuzelt(tok) {
    var parca = [tok];
    // 1) bitisik soru eki + kisi eki: kuryemisin, aliyomusunuz, patronmusun -> "kurye misin"
    var m = /^(\p{L}{2,}?)(m[ıiuü](?:s[ıiuü]n(?:[ıiuü]z)?|y[ıiuü][mz]|d[ıiuü]r))$/u.exec(tok);
    if (m && !/^(kimi|ismi|resmi)/.test(tok)) parca = [m[1], m[2]];
    else {
      m = /^(\p{L}{2,})(m[ıiuü])$/u.exec(tok);
      if (m && SORU_GOVDE.test(katla(m[1]))) parca = [m[1], m[2]];
      // "aliyomu" / "veriyonmu"
      else if ((m = /^(\p{L}{2,}[ıiuü]yo[nmz]?)(m[ıiuü])$/u.exec(tok))) parca = [m[1], m[2]];
    }
    // 2) -yo/-yon/-yom/-yoz/-yosun agzi: yetmiyo, veriyon, aliyom, yaziyosun
    var g = parca[0];
    var r = /^(\p{L}{2,}[ıiuü])yo(n|sun|m|z|nuz|sunuz|lar|du|muş|muşsun|muşsunuz|mişsin|dun)?$/u.exec(g);
    if (r) {
      var son = { '': 'yor', n: 'yorsun', sun: 'yorsun', m: 'yorum', z: 'yoruz', nuz: 'yorsunuz', sunuz: 'yorsunuz', lar: 'yorlar', du: 'yordu',
        dun: 'yordun', 'muş': 'yormuş', 'muşsun': 'yormuşsun', 'muşsunuz': 'yormuşsunuz', 'mişsin': 'yormuşsun' };
      parca[0] = r[1] + son[r[2] || ''];
    }
    // 3) gelecek zaman agzi: alıcam, açcam, gelicem, yapıcaz -> alacağım, açacağım, geleceğim, yapacağız
    if (!GELECEK_ISTISNA[katla(parca[0])]) {
      var gz = /^(\p{L}{2,}?)([ıiuü])?(cam|cem|caz|cez)$/u.exec(parca[0]);
      if (gz && (gz[2] || !UNLU_RE.test(gz[1].slice(-1)))) {
        var kalin = kalinMi(gz[1]);
        parca[0] = gz[1] + (kalin ? 'acağ' : 'eceğ') + (/z$/.test(gz[3]) ? (kalin ? 'ız' : 'iz') : (kalin ? 'ım' : 'im'));
      }
    }
    return parca;
  }

  // ---- Ingilizce karisik sohbet (sozluk; tek kelimeler KISALTMA'da) ----
  var ING_IFADE = [
    [/\bhow (r|are) (u|you|ya)\b/g, 'nasılsın'], [/\bhow is it going\b|\bhows it going\b/g, 'nasıl gidiyor'],
    [/\bwhat'?s up\b|\bwhats up\b|\bwassup\b|\bwazzup\b/g, 'ne haber'], [/\bthank (you|u)\b/g, 'teşekkürler'],
    [/\bgood morning\b/g, 'günaydın'], [/\bgood night\b/g, 'iyi geceler'], [/\bsee (you|u|ya)\b/g, 'görüşürüz'],
    [/\bi need (a )?job\b/g, 'iş lazım'], [/\bno problem\b/g, 'önemli değil'], [/\bfor real\b/g, 'gerçekten'],
    [/\bare (you|u) (a )?bot\b/g, 'bot musun'], [/\bhow much\b/g, 'ne kadar'], [/\bwell done\b|\bgood job\b/g, 'helal olsun'],
    [/\bhow (do|can|to) (u|you|i|we)?\s*/g, 'nasıl '], [/\bmake money\b|\bearn money\b/g, 'para kazanmak'],
    [/\bwhich (job|work)\b/g, 'hangi iş'], [/\b(is )?the best\b/g, 'en iyi'], [/\bsee ya\b|\bcya\b|\bcu\b/g, 'görüşürüz'],
    [/\bi'?m (looking for|searching) (a )?(job|work)\b/g, 'iş arıyorum'], [/\bfor sale\b/g, 'satılık'], [/\bfor rent\b/g, 'kiralık'],
    [/\bwhere (are|r) (you|u) from\b/g, 'nerelisin'], [/\bwhat'?s your name\b/g, 'adın ne'], [/\bgood luck\b/g, 'bol şans']
  ];
  var ING_KELIME = {
    bro: 'kanka', brom: 'kanka', bruh: 'kanka', dude: 'kanka', fr: 'gerçekten', frfr: 'gerçekten', nice: 'güzel', cool: 'güzel',
    thx: 'teşekkürler', ty: 'teşekkürler', tysm: 'çok teşekkürler', thanks: 'teşekkürler', tnx: 'teşekkürler',
    job: 'iş', jobs: 'iş', work: 'iş', money: 'para', cash: 'para', salary: 'maaş', price: 'fiyat', rent: 'kira', loan: 'kredi',
    boss: 'patron', house: 'ev', flat: 'daire', apartment: 'daire', shop: 'dükkan', store: 'dükkan', hello: 'merhaba',
    gg: 'tebrikler', gj: 'helal', congrats: 'tebrikler', np: 'önemli değil', same: 'aynen', deal: 'anlaştık', sad: 'üzgünüm',
    hiring: 'eleman arıyorum', op: 'yetki', admin: 'admin', which: 'hangi', best: 'en iyi', lol: 'lol', lmao: 'lol',
    sus: 'sus', where: 'nerede', why: 'neden', what: 'ne', buy: 'almak', sell: 'satmak', want: 'istiyorum', need: 'lazım', bye: 'bay bay', byee: 'bay bay', idk: 'bilmiyorum', btw: 'bu arada', omg: 'vay', pls: 'lütfen'
  };
  // Ana dili Turkce olmayanlarda sik: kisi eki dusmesi ("ben is ariyor", "sen bilir mi").
  // Yalniz ozne zamiri acikca yazilmissa ve fiil ekli degilse tamamlanir.
  function ikinciDilDuzelt(t) {
    var kz = t.map(katla);
    var ben = kz.indexOf('ben') >= 0, sen = kz.indexOf('sen') >= 0, biz = kz.indexOf('biz') >= 0;
    if (!ben && !sen && !biz) return t;
    for (var i = 0; i < t.length; i++) {
      var w = t[i];
      if (/[ıiuü]yor$/.test(w) && w.length >= 5) t[i] = w + (sen ? 'sun' : (biz ? 'uz' : 'um'));
      else if (sen && /(ir|ır|ur|ür|er|ar)$/.test(w) && w.length >= 4 && (t[i + 1] && /^m[ıiuü]$/.test(t[i + 1]))) {
        t[i + 1] = t[i + 1] + 's' + t[i + 1].slice(1) + 'n';
      }
    }
    return t;
  }

  function normal(metin) {
    var ham = String(metin == null ? '' : metin);
    var k0 = kucult(ham);
    ING_IFADE.forEach(function (r) { k0 = k0.replace(r[0], r[1]); });
    var k = temizle(k0);
    var toks = k ? k.split(' ') : [];
    toks = toks.map(function (w) { return Object.prototype.hasOwnProperty.call(ING_KELIME, w) ? ING_KELIME[w] : w; }).join(' ').split(' ');
    var out = [];
    for (var i = 0; i < toks.length; i++) {
      var f = katla(toks[i]);
      if (Object.prototype.hasOwnProperty.call(KISALTMA, f)) {
        var ac = KISALTMA[f].split(' ');
        for (var j = 0; j < ac.length; j++) out.push(ac[j]);
      } else if (/\d/.test(toks[i])) out.push(toks[i]);
      else {
        var ap = agizDuzelt(toks[i]);
        for (var a = 0; a < ap.length; a++) {
          var fa = katla(ap[a]);
          if (Object.prototype.hasOwnProperty.call(KISALTMA, fa)) out.push.apply(out, KISALTMA[fa].split(' '));
          else out.push(ap[a]);
        }
      }
    }
    out = ikinciDilDuzelt(out);
    // Bitişik yazım: "varmı" -> "var mı", "nekadar" -> "ne kadar", "işvarmı" -> "iş var mı"
    var BITIS = { nekadar: 'ne kadar', nezaman: 'ne zaman', nekadarlik: 'ne kadarlik', hersey: 'her sey', bisey: 'bir sey', birsey: 'bir sey', hicbirsey: 'hic bir sey', napcam: 'ne yapacagim', napcaz: 'ne yapacagiz' };
    var ayr = [];
    out.forEach(function (w) {
      var f = katla(w);
      if (BITIS[f]) { ayr.push.apply(ayr, BITIS[f].split(' ')); return; }
      var m = /^(is|ev|daire|kurs|kredi|eleman)?(var|yok|olur|olmaz|lazim|gerek|iyi|dogru|tamam|guzel|kolay|zor|mumkun|gecerli|bos|dolu|acik|pahali|ucuz)(mi|mu|mı|mü|mu)$/.exec(f);
      if (m) { if (m[1]) ayr.push(m[1]); ayr.push(m[2]); ayr.push(m[3]); return; }
      ayr.push(w);
    });
    out = ayr;
    var kucuk = out.join(' ');
    return { ham: ham, kucuk: kucuk, katli: katla(kucuk), kelimeler: out };
  }

  // =====================================================================
  // 3. DIL TAHMINI
  // =====================================================================
  var DIL_KELIME = {
    tr: ['selam', 'merhaba', 'nasilsin', 'ne', 'var', 'yok', 'ben', 'sen', 'bir', 'is', 've', 'icin', 'cok', 'abi', 'kanka', 'tamam', 'evet', 'hayir', 'mi', 'mu', 'bu', 'da', 'de', 'ama', 'gibi', 'olur', 'haber', 'iyi', 'gunaydin', 'tesekkur', 'tesekkurler', 'arkadaslar', 'herkese', 'valla', 'para', 'maas', 'daire', 'kira', 'oldu', 'degil', 'misin', 'musun', 'bugun', 'hocam', 'nasil'],
    en: ['the', 'and', 'is', 'you', 'hello', 'hi', 'how', 'are', 'what', 'my', 'good', 'thanks', 'thank', 'morning', 'everyone', 'anyone', 'here', 'new', 'this', 'that', 'with', 'for', 'have', 'just', 'it', 'im', 'i', 'to', 'of', 'nice', 'guys', 'hey', 'yes', 'no', 'please', 'work', 'job', 'buy', 'house', 'great', 'cool', 'lol', 'whats', 'up', 'from'],
    de: ['ich', 'und', 'ist', 'du', 'hallo', 'wie', 'geht', 'danke', 'nicht', 'das', 'guten', 'morgen', 'tag', 'abend', 'ja', 'nein', 'bitte', 'mit', 'ein', 'eine', 'der', 'die', 'es', 'euch', 'zusammen', 'leute', 'auch', 'sehr', 'gut', 'wohnung', 'arbeit', 'moin', 'servus', 'tschuss', 'bin', 'neu', 'hier'],
    es: ['hola', 'que', 'como', 'estas', 'gracias', 'el', 'la', 'es', 'y', 'buenos', 'dias', 'buenas', 'tardes', 'noches', 'amigos', 'todos', 'por', 'para', 'bien', 'muy', 'si', 'pero', 'mi', 'soy', 'nuevo', 'aqui', 'trabajo', 'casa', 'piso', 'jaja', 'tal', 'gente', 'saludos', 'desde'],
    az: ['salam', 'necesen', 'necesiz', 'ne', 'men', 'sen', 'var', 'yaxsi', 'cox', 'sag', 'qardas', 'hamiya', 'xeyir', 'sabahiniz', 'axsaminiz', 'bu', 'gun', 'menim', 'yeniyem', 'burada', 'deyil', 'bilmirem', 'edirem', 'olsun', 'dostlar', 'heyat', 'pul', 'is', 'ucun', 'nece']
  };
  var DIL_SET = {};
  Object.keys(DIL_KELIME).forEach(function (d) {
    DIL_SET[d] = {};
    DIL_KELIME[d].forEach(function (w) { DIL_SET[d][w] = 1; });
  });

  function dilBul(metin) {
    var s = String(metin == null ? '' : metin);
    if (/[؀-ۿ]/.test(s)) return 'ar';
    if (/[əƏ]/.test(s)) return 'az';
    var puan = { tr: 0, en: 0, de: 0, es: 0, az: 0 };
    if (/[ğışİĞŞ]/.test(s)) puan.tr += 3;
    if (/[äßÄ]/.test(s)) puan.de += 3;
    if (/[ñ¿¡áéíóú]/.test(s)) puan.es += 3;
    if (/[xq]/i.test(s)) puan.az += 0.5;
    var k = katla(kucult(s)).replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    k.forEach(function (w) {
      Object.keys(DIL_SET).forEach(function (d) { if (DIL_SET[d][w]) puan[d] += 1; });
    });
    // Arapcanin Latin harfle yazimi
    var arLatin = /\b(marhaba|shukran|habibi|yalla|inshallah|kayfak|kayfik|ahlan|sabah el kheir|masa el kheir|shabab|mabrook|wallah|ana|kaman|helw|asif)\b/i;
    if (arLatin.test(katla(s))) puan.ar = 2 + (k.length > 2 ? 1 : 0);
    if (/\b(salam)\b/i.test(s) && /\b(necə|nece|necesen|hamıya|hamiya|xeyir|qardaş|qardas)\b/i.test(s)) puan.az += 2;
    var en = 'tr', enP = 0;
    Object.keys(puan).forEach(function (d) { if (puan[d] > enP) { enP = puan[d]; en = d; } });
    return enP === 0 ? 'tr' : en;
  }

  // =====================================================================
  // 4. VARLIKLAR: tutar, meslek, mulk, yer, kisi, kanal, kufur
  // =====================================================================

  // ---- 4a. Tutar ----
  var BIRLER = { bir: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7, sekiz: 8, dokuz: 9 };
  var ONLAR_S = { on: 10, yirmi: 20, otuz: 30, kirk: 40, elli: 50, altmis: 60, yetmis: 70, seksen: 80, doksan: 90 };
  var BUYUK_S = { bin: 1e3, milyon: 1e6, milyar: 1e9 };
  var TUTAR_DISI = /^(m2|metrekare\w*|gun\w*|ay|aylik|aydir|ayda|yil\w*|sene\w*|yas\w*|kat\w*|oda\w*|saat\w*|dakika\w*|dk|sn|kisi\w*|tane\w*|adet\w*|ocak|subat|mart|nisan\w*|mayis\w*|haziran\w*|temmuz\w*|agustos\w*|eylul\w*|ekim\w*|kasim\w*|aralik\w*|numara\w*|no|bolum\w*|seviye\w*|kademe\w*|yildiz\w*|puan\w*|hafta\w*|taksit\w*|kez|defa|kere|sira\w*|inci|nci|uncu|ncu)$/;

  function bilinenSayiKelimesi(w) { return !!(BIRLER[w] || ONLAR_S[w] || BUYUK_S[w] || w === 'yuz' || w === 'bucuk'); }
  // "bine", "milyona", "yuzden" -> kok
  function yaziKok(w) {
    if (bilinenSayiKelimesi(w)) return w;
    var ekler = ['lik', 'luk', 'den', 'dan', 'ten', 'tan', 'ye', 'ya', 'de', 'da', 'te', 'ta', 'e', 'a'];
    for (var i = 0; i < ekler.length; i++) {
      var e = ekler[i];
      if (w.length > e.length && w.slice(-e.length) === e && bilinenSayiKelimesi(w.slice(0, -e.length))) return w.slice(0, -e.length);
    }
    return w;
  }

  function sayiCoz(s, carpanli) {
    var nok = s.indexOf('.') >= 0, vir = s.indexOf(',') >= 0;
    if (nok && vir) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (nok) {
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ''));
      return parseFloat(s);
    }
    if (vir) {
      if (!carpanli && /^\d{1,3}(,\d{3})+$/.test(s)) return parseFloat(s.replace(/,/g, ''));
      return parseFloat(s.replace(',', '.'));
    }
    return parseFloat(s);
  }

  function tutarBul(kucukMetin) {
    var k = katla(String(kucukMetin || '')).replace(/₺/g, ' tl ');
    var adaylar = [];
    var re = /(%\s*)?(\d+(?:[.,]\d+)*)(\+\d+)?\s*(milyar\w*|milyon\w*|mn\b|bin(?!a)\w*|k\b|m\b)?\s*(tl\w*|lira\w*|try\b)?/g;
    var m;
    while ((m = re.exec(k))) {
      if (!m[2]) { re.lastIndex++; continue; }
      if (m[1] || m[3]) continue;
      var carpanY = m[4] || '', birimY = m[5] || '';
      var carpan = 1;
      if (/^milyar/.test(carpanY)) carpan = 1e9;
      else if (/^(milyon|mn$|m$)/.test(carpanY)) carpan = 1e6;
      else if (/^(bin|k$)/.test(carpanY)) carpan = 1e3;
      var deger = sayiCoz(m[2], carpan > 1) * carpan;
      if (!isFinite(deger)) continue;
      var sonra = k.slice(m.index + m[0].length).trim().split(/\s+/)[0] || '';
      var puan = 0;
      if (birimY) puan += 3;
      if (carpan > 1) puan += 2;
      if (!birimY && carpan === 1) {
        if (TUTAR_DISI.test(sonra) || /^(%)/.test(sonra)) continue;
        if (deger >= 1900 && deger <= 2100 && !/[.,]/.test(m[2])) continue;
        if (deger < 100) continue;
        if (deger >= 1000) puan += 1;
      }
      // "1,5 milyon" hem rakam hem yaziyla "1 milyon 500 bin"
      adaylar.push({ deger: deger, puan: puan, yer: m.index });
    }
    // yaziyla sayilar: "yuz bin", "iki milyon", "bir bucuk milyon", "otuz bin lira"
    var toks = k.split(/\s+/);
    var i = 0;
    while (i < toks.length) {
      var toplam = 0, simdiki = 0, var_ = false, buyukVar = false, j = i;
      while (j < toks.length) {
        var w = yaziKok(toks[j]);
        if (BIRLER[w]) { simdiki += BIRLER[w]; var_ = true; }
        else if (ONLAR_S[w]) { simdiki += ONLAR_S[w]; var_ = true; }
        else if (w === 'yuz') { simdiki = (simdiki || 1) * 100; var_ = true; }
        else if (w === 'bucuk') { simdiki += 0.5; var_ = true; }
        else if (BUYUK_S[w]) { toplam += (simdiki || 1) * BUYUK_S[w]; simdiki = 0; var_ = true; buyukVar = true; }
        else break;
        j++;
      }
      if (var_) {
        var deger2 = toplam + simdiki;
        var birim2 = /^(tl|lira)/.test(toks[j] || '');
        if ((buyukVar || birim2) && deger2 >= 100) adaylar.push({ deger: deger2, puan: (birim2 ? 3 : 0) + (buyukVar ? 2 : 0), yer: k.indexOf(toks[i]) });
        i = j;
      } else i++;
    }
    if (!adaylar.length) return null;
    adaylar.sort(function (a, b) { return b.puan - a.puan || a.yer - b.yer; });
    return Math.round(adaylar[0].deger);
  }

  // Turkce para bicimi: 1500000 -> "1.500.000 ₺"
  function paraYaz(n, birim) {
    var s = String(Math.round(Number(n) || 0));
    var neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + s + ' ' + (birim || '₺');
  }

  // ---- 4b. Meslek ----
  var MESLEK_ADLARI = {
    kurye: 'kurye', garson: 'garson', insaat_iscisi: 'inşaat işçisi', market_calisani: 'market çalışanı',
    memur: 'memur', emlak_danismani: 'emlak danışmanı', muhasebeci: 'muhasebeci', usta: 'usta',
    kafe_sahibi: 'kafe sahibi', dukkan_sahibi: 'dükkan sahibi', tasaron: 'taşeron', nakliyeci: 'nakliyeci',
    emlak_ofisi_sahibi: 'emlak ofisi sahibi', doviz_burosu_sahibi: 'döviz bürosu sahibi',
    ithalat_ihracat: 'ithalat-ihracatçı', muteahhit: 'müteahhit', fabrikator: 'fabrikatör'
  };
  var MESLEK_KURAL = [
    ['emlak_ofisi_sahibi', 4, '\\bemlak (ofis|buro)\\w*'],
    ['doviz_burosu_sahibi', 4, '\\b(doviz (buro|ofis)\\w*|sarraf\\w*|exchange)'],
    ['ithalat_ihracat', 4, '\\b(ithalat\\w*|ihracat\\w*|ithalatci\\w*|ihracatci\\w*|dis ticaret\\w*)'],
    ['muteahhit', 4, '\\b(muteahhit\\w*|muteahit\\w*|yapi sirket\\w*|insaat (sirket|firma)\\w*|bina yapiyor\\w*)'],
    ['fabrikator', 3.5, '\\b(fabrikator\\w*|fabrika (sahib|kur|ac)\\w*|sanayici\\w*|uretim tesis\\w*|fabrikam\\w*)'],
    ['fabrikator', 1.5, '\\bfabrika\\w*'],
    ['tasaron', 4, '\\btaseron\\w*'],
    ['emlak_danismani', 3.5, '\\b(emlak danisman\\w*|gayrimenkul danisman\\w*|emlakci\\w*|emlakta calis\\w*|emlak isi\\w*|emlak sektor\\w*)'],
    ['emlak_danismani', 1.5, '\\bemlak\\b'],
    ['emlak_danismani', 3, '\\bdanisman\\w*'],
    ['muhasebeci', 3.5, '\\b(muhasebe\\w*|mali musavir\\w*|smmm)'],
    ['market_calisani', 3.5, '\\b(kasiyer\\w*|reyon\\w*|market (calis|eleman|gorevli|isci)\\w*|markette (calis|kasiyer)\\w*)'],
    ['market_calisani', 1.2, '\\bmarket\\w*'],
    ['insaat_iscisi', 3.5, '\\b(insaat isci\\w*|insaatta (calis|isci)\\w*|insaat (isi|iscisi)|amele\\w*|santiye\\w*|insaatlarda)'],
    ['insaat_iscisi', 1.2, '\\binsaat\\w*'],
    ['kurye', 3.5, '\\b(kurye\\w*|moto ?kurye\\w*|kargocu\\w*|paketci\\w*|teslimat (yap|isi)\\w*|dagitimci\\w*|siparis tasi\\w*)'],
    ['garson', 3.5, '\\b(garson\\w*|servis eleman\\w*|komi\\b)'],
    ['memur', 3.5, '\\b(memur\\w*|devlet memur\\w*|kamuda calis\\w*|devlette calis\\w*|belediyede calis\\w*|kamu personel\\w*)'],
    ['usta', 3, '\\b(usta\\b|ustalar\\w*|ustalik\\w*|ustayim|ustasi|elektrikci\\w*|tesisatci\\w*|boyaci\\w*|tamirci\\w*|marangoz\\w*|kaynakci\\w*|fayansci\\w*|cilingir\\w*|sihhi tesisat\\w*|mobilyaci\\w*)'],
    ['nakliyeci', 3.5, '\\b(nakliye\\w*|nakliyat\\w*|kamyon\\w*|tir sofor\\w*|sofor\\w*|taksici\\w*|taksi\\b|tasimacilik\\w*|evden eve|lojistik\\w*|tasima isi\\w*)'],
    ['kafe_sahibi', 3.5, '\\b(kafe (sahib|isletiy|ac|isletme)\\w*|kafem\\b|kafemi\\w*|kafemiz\\w*|kahveci\\w*|kahvehane\\w*)'],
    ['kafe_sahibi', 1.2, '\\b(kafe|cafe)\\w*'],
    ['dukkan_sahibi', 3.5, '\\b(dukkan (sahib|isletiy)\\w*|esnaf\\w*|bakkal\\w*|manav\\w*|butik\\w*|dukkanci\\w*|dukkan isletiyorum)']
  ];
  var MESLEK_RE = MESLEK_KURAL.map(function (r) { return { id: r[0], p: r[1], re: new RegExp(r[2], 'g') }; });

  function meslekBul(katli, baglam) {
    var bulunan = {};
    function ekle(id, p, yer) {
      if (!bulunan[id] || bulunan[id].p < p) bulunan[id] = { id: id, p: p, yer: yer };
    }
    MESLEK_RE.forEach(function (r) {
      r.re.lastIndex = 0;
      var m = r.re.exec(katli);
      if (!m) return;
      // ardindan alim/arama fiili gelen meslek, cumlenin konusu olan roldur ("emlak ofisime danisman aliyorum")
      var sonra = katli.slice(m.index + m[0].length);
      var bonus = /^\w* (al[iaı]\w*|ar[ai][yn]\w*|aram\w*|lazim|aran\w*)/.test(sonra) ? 1.5 : 0;
      ekle(r.id, r.p + bonus, m.index);
    });
    var ml = baglam && baglam.meslekler;
    if (ml) Object.keys(ml).forEach(function (id) {
      var ad = katla(kucult(ml[id] || ''));
      if (ad.length < 3) return;
      var re = new RegExp('\\b' + kacis(ad) + '\\w*');
      var m = re.exec(katli);
      if (m) ekle(id, 3.6, m.index);
    });
    var liste = Object.keys(bulunan).map(function (k) { return bulunan[k]; });
    liste.sort(function (a, b) { return b.p - a.p || a.yer - b.yer; });
    return liste;
  }

  // ---- 4c. Mulk ----
  var MULK_KURAL = [
    ['arsa', /\b(arsa\w*|tarla\w*|arazi\w*|imarli\w*)/],
    ['dukkan', /\b(dukkan\w*|isyeri\w*|is yeri\w*|magaza\w*|ticari (alan|mulk)\w*)/],
    ['daire', /\b(daire\w*|ev|evi|evim\w*|eve|evde|evden|evler\w*|evin|evimi|konut\w*|\d\+\d|rezidans\w*|villa\w*|apartman\w*|studyo\w*|mesken\w*)\b/]
  ];
  function mulkBul(katli) {
    var en = null, enYer = 1e9;
    MULK_KURAL.forEach(function (r) {
      var m = r[1].exec(katli);
      if (m && m.index < enYer) { en = r[0]; enYer = m.index; }
    });
    return en;
  }

  // ---- 4d. Yer ----
  var YER_EK = /^(y?[ae]|n?[iu]n|y?[iu]|[dt][ae]n|[dt][ae](y[iu][mz]|[iu][mz]|ki|yken|n)?|l[iu](y[iu][mz]|[iu][mz]|lar|ler|y[iu]z)?|ya|ye)?$/;
  var _yerIndeks = null;
  function yerIndeks() {
    if (_yerIndeks) return _yerIndeks;
    var liste = [];
    var gor = {};
    VERI.yerler.forEach(function (y) {
      [y.ad].concat(y.ilceler || []).forEach(function (ad) {
        var f = katla(kucult(ad)).replace(/[^a-z ]/g, '');
        if (!f || gor[f]) return;
        gor[f] = 1;
        liste.push({ ad: ad, f: f, sinirli: VERI.yerAramaDisi.indexOf(ad) >= 0 });
      });
    });
    liste.sort(function (a, b) { return b.f.length - a.f.length; });
    _yerIndeks = liste;
    return liste;
  }
  function yerBul(katli) {
    var toks = katli.split(' ');
    var liste = yerIndeks();
    for (var i = 0; i < toks.length; i++) {
      for (var j = 0; j < liste.length; j++) {
        var y = liste[j];
        var parca = y.f.indexOf(' ') >= 0 ? toks.slice(i, i + y.f.split(' ').length).join(' ') : toks[i];
        if (parca.indexOf(y.f) !== 0) continue;
        var kalan = parca.slice(y.f.length);
        // "Fatih", "Of" gibi kelimeyle karisanlar yalniz bulunma/ayrilma ekiyle ya da -li ile sayilir
        if (y.sinirli ? /^([dt][ae]n?|[dt][ae]y[iu][mz]|l[iu]\w{0,4})$/.test(kalan) : YER_EK.test(kalan)) return y.ad;
      }
    }
    return null;
  }

  // ---- 4e. Kisi ----
  var KISI_EK = /^(in|nin|un|nun|ya|ye|a|e|da|de|ta|te|dan|den|tan|ten|la|le|yla|yle|cim|cigim|i|yi|u|yu|abi|abla|hoca|hocam)$/;
  function kisiBul(ham, baglam) {
    var adlar = (baglam && baglam.adlar) || [];
    if (!adlar.length) return null;
    var oyuncu = baglam && baglam.oyuncuAd ? katla(kucult(baglam.oyuncuAd)) : null;
    var toks = katla(kucult(ham)).split(/[\s'’,.!?;:()"]+/).filter(Boolean);
    var bahsi = katla(kucult(ham)).match(/@([\p{L}\p{N}_.]+)/gu) || [];
    var enIyi = null, enP = 0;
    adlar.forEach(function (tam) {
      var f = katla(kucult(tam)).trim();
      if (!f || f === oyuncu) return;
      var ilk = f.split(/\s+/)[0];
      var p = 0;
      bahsi.forEach(function (b) {
        var b2 = b.slice(1).replace(/[._]/g, '');
        if (b2 === f.replace(/\s+/g, '') || b2 === ilk || b.slice(1) === f) p = Math.max(p, 5);
      });
      if (!p && f.indexOf(' ') > 0 && (' ' + toks.join(' ') + ' ').indexOf(' ' + f + ' ') >= 0) p = 4;
      if (!p) {
        for (var i = 0; i < toks.length; i++) {
          var t = toks[i].replace(/^@/, '');
          if (t === ilk) { p = 3; break; }
          if (ilk.length >= 4 && t.indexOf(ilk) === 0 && KISI_EK.test(t.slice(ilk.length))) { p = 2; break; }
        }
      }
      if (p > enP) { enP = p; enIyi = tam; }
    });
    return enIyi;
  }

  // ---- 4f. Kanal ----
  function kanalBul(katli) {
    if (/\b(global|genel kanal\w*|dunya kanal\w*)\b/.test(katli)) return 'global';
    if (/\bturkiye (kanal\w*|sohbet\w*)/.test(katli)) return 'turkiye';
    if (/\bsirket (kanal\w*|grub\w*|sohbet\w*|ici)/.test(katli)) return 'sirket';
    if (/\b(dm|ozel mesaj\w*|ozelden|ozelde)\b/.test(katli)) return 'dm';
    return null;
  }

  // ---- 4g. Kufur (YALNIZ tespit; uretimde asla kullanilmaz) ----
  var KUFUR_TAM = {};
  ['amk', 'amq', 'aq', 'amina', 'aminakoyim', 'aminakoyayim', 'amcik', 'mk', 'mq', 'sg', 'sktr', 'sktir', 'skm', 'skrm',
    'sik', 'siktir', 'sikerim', 'sikeyim', 'sikik', 'sikim', 'sikem', 'oc', 'oç', 'pic', 'piç', 'got', 'göt', 'gotveren', 'bok',
    'boktan', 'ibne', 'yarrak', 'yarak', 'yarram', 'pust', 'puşt', 'orospu', 'orospucocugu', 'orosbu', 'kahpe', 'pezevenk',
    'gavat', 'serefsiz', 'yavsak', 'kaltak', 'surtuk', 'dalyarak', 'hassiktir', 'hasiktir', 'amına', 'piçlik', 'gerizekalı'
  ].forEach(function (w) { KUFUR_TAM[katla(w)] = 1; });
  var KUFUR_KOK = ['siktir', 'sikerim', 'sikeyim', 'sikiyim', 'sikik', 'siktig', 'orospu', 'orosbu', 'yarrak', 'amina', 'amcik',
    'pezevenk', 'serefsiz', 'yavsak', 'kahpe', 'ibne', 'gavat', 'kaltak', 'surtuk', 'dalyarak', 'gotveren', 'gotlek', 'hassiktir',
    'pust', 'anani', 'avradini', 'bacini'];
  var KUFUR_ANANI = /\b(anan\w*|bacin\w*|avrad\w*)\b.*\b(sik|sok|koy|siktig)\w*/;

  function kufurVar(metin) {
    var ham = kucult(String(metin == null ? '' : metin));
    var parcalar = ham.split(/\s+/).filter(Boolean);
    for (var i = 0; i < parcalar.length; i++) {
      var p = parcalar[i];
      var tr = p.replace(/[^\p{L}*]/gu, '');           // Turkce harfli
      var f = katla(p).replace(/[^a-z0-9*]/g, '');      // katli, nokta vb. silinmis (a.q -> aq)
      if (!f) continue;
      if (f.indexOf('*') >= 0) {
        var re = new RegExp('^' + f.replace(/\*+/g, '[a-z]{1,3}') + '$');
        var hepsi = Object.keys(KUFUR_TAM).concat(KUFUR_KOK);
        for (var j = 0; j < hepsi.length; j++) if (hepsi[j].length >= 3 && re.test(hepsi[j])) return true;
        continue;
      }
      var sikMasum = /^sık/.test(tr) || /^sıc/.test(tr);
      if (KUFUR_TAM[f] && !(sikMasum && /^sik/.test(f))) {
        if (f === 'got' && !/göt/.test(tr) && dilBul(metin) === 'en') continue;
        return true;
      }
      for (var k = 0; k < KUFUR_KOK.length; k++) {
        if (f.indexOf(KUFUR_KOK[k]) === 0) {
          if (/^sik/.test(KUFUR_KOK[k]) && sikMasum) continue;
          if (KUFUR_KOK[k] === 'anani' || KUFUR_KOK[k] === 'bacini' || KUFUR_KOK[k] === 'avradini') {
            if (KUFUR_ANANI.test(katla(ham))) return true;
            continue;
          }
          return true;
        }
      }
    }
    return false;
  }

  // =====================================================================
  // 5. NIYET
  // =====================================================================
  var NIYETLER = ['selam', 'hal_hatir', 'tesekkur', 'veda', 'tebrik', 'ozur', 'evet', 'hayir', 'is_ariyorum', 'eleman_ariyorum',
    'maas_sorusu', 'meslek_tavsiyesi', 'kurs_sorusu', 'mulk_satiyorum', 'mulk_ariyorum', 'fiyat_sorusu', 'ekonomi', 'kredi_sorusu',
    'bayram', 'dert', 'kisisel_meslek', 'kisisel_yer', 'kisisel_ad', 'bot_musun', 'iltifat', 'hakaret', 'saka', 'yardim',
    'zam_istegi', 'yetki_istegi', 'teklif', 'oneri_kabul', 'genel'];

  var AR = '(?:ar[ai][yn]\\w*|aram[ai]\\w*)';
  var KURAL = [
    ['selam', 1.3, '\\b(selam\\w*|merhaba\\w*|selamun aleykum|aleykum selam|hey|heyo|gunaydin\\w*|hayirli sabahlar|iyi aksamlar|iyi gunler|hos geldin\\w*|hos bulduk|alo|hello|hi)\\b'],
    ['hal_hatir', 2.4, '\\b(nasilsin\\w*|nasilsiniz|nasil gidiyor|ne haber|ne var ne yok|iyi misin\\w*|keyifler nasil|keyfin nasil|ne yapiyorsun\\w*|ne yaptin|nasil gecti\\w*|halin nasil|hallerin nasil|ne alemde\\w*|nasil keyifler|neler yapiyorsun|ne var ne yok|nasil gidiyo|naber\\w*)\\b'],
    ['hal_hatir', 1.4, '\\b(isler nasil|gunun nasil|nasil gecti gunun)\\b'],
    ['tesekkur', 2.4, '\\b(tesekkur\\w*|sag ol\\w*|sagol\\w*|eyvallah|mersi|minnettar\\w*|allah razi olsun|cok makbule gecti)\\b'],
    ['veda', 2.4, '\\b(gorusuruz\\w*|gorusmek uzere|bay bay|hosca kal\\w*|kendine iyi bak|kendinize iyi bakin|iyi geceler|iyi uykular|ben kacar\\w*|kactim|ben ciktim|cikiyorum ben|ben cikiyorum|allaha emanet|sonra yazarim|sonra konusuruz|kacmam lazim|gitmem lazim|yatiyorum ben|ben yatiyorum)\\b'],
    ['veda', 1.5, '\\bbana eyvallah\\b'],
    ['tebrik', 3.2, '\\b(tebrik\\w*|kutlar(im|iz)\\b|kutluyorum|hayirli olsun|hayirli ugurlu olsun|helal olsun|bravo|aferin\\w*|basardin|gozun aydin|bol kazanclar|hayirli isler|maasallah|harika haber|super haber|cok sevindim)\\b'],
    ['ozur', 2.8, '\\b(ozur\\w*|kusura bakma\\w*|pardon|affedersin\\w*|affet\\w*|yanlislikla|benim hatam|hata bende|kusura)\\b'],
    ['evet', 1.6, '^\\s*(evet|he|hee|aynen\\w*|tabi|tabii|tabiki|olur|tamam\\w*|kesinlikle|elbette|dogru|uygun|iyi olur|yes)(\\s|$)'],
    ['hayir', 1.8, '^\\s*(hayir|yok|yo|istemiyorum|olmaz|gerek yok|sart degil|maalesef|pas|kalsin|hic sanmam|no)(\\s|$)'],
    ['hayir', 1.2, '\\b(istemiyorum|olmaz oyle|kabul etmiyorum|ilgilenmiyorum|dusunmuyorum|gerek yok)\\b'],
    ['is_ariyorum', 3, '\\bis(e|i|im)? ?(' + AR + '|bak[ai]\\w*|lazim|bul\\w*|var mi|yok mu|girmek\\w*|basvur\\w*|verir misin\\w*|verecek|ver\\b|verin\\b|verebilir\\w*)'],
    ['is_ariyorum', 3, '\\b(issiz\\w*|calisacak (bir )?(yer|is)|calismak istiyorum|beni (de )?ise al\\w*|ise alir mi\\w*|ise alin\\w*|is veren var mi|cv\\w*|ozgecmis\\w*|basvuru yap\\w*|basvurmak|basvurdum|is bakiyorum)'],
    ['is_ariyorum', 4, '\\b(eleman|isci|garson|kurye|personel|calisan|usta|sofor|kasiyer|muhasebeci|memur|emlakci) (arayan|alan|lazim olan) (var mi|varmi|kimse|biri|yer)'],
    ['is_ariyorum', 2, '\\bolarak (is|calis\\w*|basla\\w*)'],
    ['is_ariyorum', 4, '\\b(isveren|is veren|patron|isyeri|is yeri|ise alan|eleman alan|isci alan|calistiran|calistiracak)\\w* ?(var|ari|lazim|bul|yok|kimse|olan)'],
    ['is_ariyorum', 2.5, '\\b(isveren|is veren|patron)\\w*\\b'],
    ['is_ariyorum', 3, '\\b(beni|bizi) (kim|kimse|biri) (alir|ise alir|calistirir)'],
    ['is_ariyorum', 2, '\\b(yaninda|sende|sizde|yaninizda) (calis\\w*|is var\\w*)'],
    ['eleman_ariyorum', 3, '\\b(eleman|personel|calisan|isci|kadro\\w*|ekip arkadasi)\\w* (' + AR + '|lazim|alinacak|alacag\\w*|alimi|ihtiyac\\w*|almak|aliyor\\w*|bakiyor\\w*)'],
    ['eleman_ariyorum', 2.5, '\\b(ise alim|alim yapiyor\\w*|eleman alinacak|eleman alimi|ekibimize|kadromuza|isletmeme|dukkanima eleman|bana calisacak|benim icin calis\\w*|yanimda calis\\w*|kim calismak ister|calismak isteyen)'],
    ['eleman_ariyorum', 1.2, '\\b(eleman|personel)\\w*'],
    ['maas_sorusu', 2.5, '\\b(maas\\w*|ucret\\w*|kazanc\\w*|gelir(im|in|i)? (ne|kac|nasil)|ayda ne kadar|aylik ne kadar|haftalik ne kadar|ne kadar veriyor\\w*)'],
    ['maas_sorusu', 3, '\\b(kac para (veriyor|aliyor|kazan)\\w*|ne kadar kazan\\w*|kac (bin|para) aliyor\\w*|ne kadar maas|maaslar ne)'],
    ['meslek_tavsiyesi', 3, '\\b(hangi (mesle[kg]|is)\\w*|ne is yapay\\w*|ne is yapsam|ne yapsam|mesle[kg] (oner|tavsiye)\\w*|hangisi (daha )?(cok )?(iyi|mantikli|kazandir\\w*|karli)|mesle[kg] sec\\w*|mesle[kg] degis\\w*|is degistir\\w*|olsam mi|olayim mi|gecsem mi|gecmeli miyim|secsem mi)'],
    ['kurs_sorusu', 3, '\\b(kurs\\w*|sertifika\\w*|egitim\\w*|kademe\\w*|ders (al|ver)\\w*|diploma\\w*)'],
    ['mulk_satiyorum', 3, '\\b(satilik|satiyorum|satiyoruz|satacag\\w*|satmak (ist\\w*|lazim)|satmayi dusun\\w*|elden cikar\\w*|devren|satisa (koy|cikar)\\w*|satista|kiraya ver\\w*|kiralik (dairem|evim|dukkanim|arsam)|kiraci (ar|bul)\\w*|alici (ar|bul|var)\\w*|alan var mi|almak isteyen|ilgilenen var mi)'],
    ['mulk_ariyorum', 3, '\\b(daire|ev|evi|konut|dukkan|arsa|arazi|tarla|isyeri|magaza|villa|rezidans|\\d\\+\\d)\\w{0,4} (' + AR + '|bak[ai]\\w*|lazim|almak\\w*|alacag\\w*|alicam|alcam|alayim|alsam\\w*|almayi)'],
    ['mulk_ariyorum', 2.5, '\\b(kiralik|satilik) \\w+( \\w+)? (' + AR + '|lazim|var mi|bil\\w*|bakiyorum|nerede|nerde)'],
    ['mulk_ariyorum', 2, '\\b(ev|daire|dukkan|arsa) sahibi olmak|\\b(kiralayacak|kiralamak|ev tutmak|ev tuta\\w*|ev bakiyor\\w*|mulk almak|mulk alacag\\w*)'],
    ['fiyat_sorusu', 2.5, '\\b(fiyat\\w*|kac para|kaca|kac lira|kac tl|ne kadar|degeri ne|degeri kac|pahali mi|ucuz mu|ne istiyor\\w*|metrekare\\w*|m2|kac bin|ne kadara)\\b'],
    ['ekonomi', 3, '\\b(faiz\\w*|enflasyon\\w*|dolar\\w*|doviz\\w*|euro\\w*|avro\\w*|sterlin\\w*|altin(\\b|lar\\w*| ?fiyat\\w*|a yatir\\w*)|borsa\\w*|hisse\\w*|ekonomi\\w*|piyasa\\w*|kurlar\\w*|kuru (ne|kac|artt|dust|yuksel)\\w*|merkez bankasi|resesyon|kriz\\w*|devalue\\w*|parite\\w*|gram altin|ceyrek altin|yatirim\\w*|fon(lar\\w*|u|a)?\\b|kripto\\w*|bitcoin)'],
    ['ekonomi', 2.5, '\\b(zam (gel|yag|gelmis|gelecek)\\w*|her seye zam|zamlar\\w*|fiyatlar\\w* (cok |yine |epey |gene )?(art|yuksel|ucu|tavan|cildir|uctu)\\w*|pahalilik|hayat pahali\\w*|her sey pahali\\w*|alim gucu)'],
    ['kredi_sorusu', 3.5, '\\b(kredi\\w*|borc\\w*|taksit\\w*|banka\\w*|icra\\w*|vade\\w*|odeme plani)'],
    ['bayram', 3, '\\b(bayram\\w*|yilbasi\\w*|yeni yil\\w*|mutlu yillar|kandil\\w*|23 nisan|29 ekim|19 mayis|30 agustos|anneler gunu\\w*|babalar gunu\\w*|ogretmenler gunu\\w*)'],
    ['bayram', 1, '\\b(ramazan|kurban|arife\\w*|iftar\\w*|sahur)\\b'],
    ['dert', 3, '\\b(moral\\w* (cok |biraz |cok cok )?(bozuk|sifir|dibe|bozdu)|canim (sikkin|sikiliyor)|cok sikildim|sikildim|sikiliyorum|zarar(?!i yok)\\w*|param (bitti|kalmadi|yok|yetmiyor)|batt(im|ik)|batiyorum|iflas\\w*|kotu gidiyor|kotu (bir )?gun|uzgun\\w*|uzuldum|berbat\\w*|dert\\w*|sikinti\\w*|bunal\\w*|maasim yatmadi|kovuldum|isten cikar(ildim|ttilar|dilar)|beceremiyorum|bezdim|zor durum\\w*|gecinemiyor\\w*|gecinmek zor|yetmiyor|yorgunluk\\w*|bittim|tukendim|hicbir sey yolunda|yikildim|mahvoldum|cok yoruldum|yorgunum|yoruldum|keske|pisman\\w*|kaybettim|kaybettik|eksiye dus\\w*|eksideyim|kredi notum dustu|icraya|hic para yok|cok kotu)'],
    ['dert', 1.5, '^\\s*(of|off|ah|uf|uff|hay aksi|ah be|of ya)\\b'],
    ['kisisel_meslek', 3.6, '\\b(ne is yap(iyorsun|iyosun|ion|arsin|iyorsunuz|arsiniz|iyon)\\w*|meslegin ne|mesleginiz ne|isin ne|ne isle mesgul\\w*|nerede calisiyorsun\\w*|hangi iste calis\\w*|ne calisiyorsun|sen ne yaparsin|neyle ugras\\w*|ne is yapiyor\\w*|meslegin)'],
    ['kisisel_yer', 3.6, '\\b(nerelisin\\w*|nerelisiniz|neredensin|nereden yaziyorsun\\w*|neredesin\\w*|nerede (oturuyorsun|yasiyorsun|kaliyorsun)\\w*|memleket\\w*|hangi sehir\\w*|hangi ilce\\w*|aslen|nereli\\w*|hangi semt\\w*)'],
    ['kisisel_ad', 3.6, '\\b(adin ne\\w*|ismin ne\\w*|adiniz ne|isminiz ne|sen kimsin|kimsin|kimsiniz|tanisalim|tanisabilir miyiz|adini (soyle|ogren)\\w*|sana ne diyelim|ne diye hitap|adin neydi|ismin neydi|adin)\\b'],
    ['bot_musun', 4, '\\b(bot\\w*|robot\\w*|yapay zeka\\w*|gercek (misin|misiniz|insan|kisi|biri|mi)\\w*|insan misin\\w*|insan mi\\w*|npc\\w*|ai misin|program misin|otomatik mi\\w*|chatgpt|yapay mi\\w*|makine misin|gercekten insan)'],
    ['iltifat', 2.8, '\\b(cok iyisin\\w*|harikasin\\w*|tatlisin\\w*|supersin\\w*|efsanesin\\w*|en iyisisin|cok yardimcisin|cok bilgilisin|kralsin|kralicesin|adamsin|seni sevdim|bayildim|cok akillisin|cok tatli\\w*|cok iyi birisin|iyi ki varsin|cok naziksin|harika birisin|cok sempatik\\w*|cok komiksin|dahisin|helal sana|cok iyi insansin|bir tanesin|cok guzel yaziyorsun)'],
    ['hakaret', 3, '\\b(salak\\w*|aptal\\w*|gerizekali\\w*|geri zekali\\w*|mal misin|malsin|ezik\\w*|beyinsiz\\w*|kes sesini|defol\\w*|cahil\\w*|embesil\\w*|dangalak\\w*|hiyar\\w*|okuz\\w*|angut\\w*|ahmak\\w*|sersem\\w*|terbiyesiz\\w*|kafasiz\\w*|zavalli\\w*|beceriksiz\\w*|yalanci\\w*|dolandirici\\w*|igrenc\\w*|rezil\\w*|sacmalama\\w*|sinir bozucu\\w*|hadi ordan|hadi oradan|nefret ediyorum|belani)'],
    ['hakaret', 1.5, '\\b(lan|ulan|sus|cok sacma|sacma sapan)\\b'],
    ['saka', 3, '\\b(ha(ha)+h?|ah(ah)+a?|aha(ha)+|he(he)+|hi(hi)+|lol|lmao|xd+|komik\\w*|espri\\w*|saka\\w*|gulmekten|gul(dum|dun|uyorum)|kahkaha\\w*|koptum|olurum gulmekten|gulme krizi)\\b'],
    ['yardim', 3, '\\b(nasil oynan\\w*|oyun nasil|oyunu nasil|ne yapmaliyim|ne yapmam (lazim|gerek)\\w*|ne yapmaliyiz|nasil para kazan\\w*|para nasil kazan\\w*|nasil zengin ol\\w*|yardim (et\\b|etsene|eder\\w*|edin\\w*|edebilir\\w*|lazim|istiyorum|ister\\w*)|yardima ihtiyac\\w*|yeniyim|yeni basladim|yeni geldim|acemi\\w*|nereden basla\\w*|nasil basla\\w*|ipucu\\w*|taktik\\w*|akil ver\\w*|nasil yapilir|nasil yapiliyor|ilk ne yap\\w*|rehber\\w*|ne yapacagim|ne yapacagiz|kafam karisti|anlamadim oyun\\w*)'],
    ['yardim', 1.5, '\\b(tavsiye\\w*|oneri\\w*|anlamadim|bilmiyorum ne|yardim)\\b'],
    ['zam_istegi', 4, '\\b(zam (istiyorum|isterim|istiyoruz|istesem|yapar mi\\w*|yapsan\\w*|yapabilir mi\\w*|yap\\b|lazim|hak\\w*|bekliyorum|alabilir mi\\w*|olur mu|verir mi\\w*|ver\\b|dusunur mu\\w*|rica\\w*|mumkun mu)|maas(imi|imiz|i)? (artir\\w*|arttir\\w*|yukselt\\w*)|maasim (az|dusuk|yetmiyor|cok az)|daha fazla maas|maas\\w* (biraz )?zam|zam olsa\\w*|zam yapsan\\w*|zam(mi|mim)? (ne zaman|var mi|gelecek mi))'],
    ['yetki_istegi', 4, '\\b(yetki\\w*|sorumluluk (ver|al|ist)\\w*|beni (mudur|yonetici|sef|sorumlu)\\w*|mudur (olmak|yap)\\w*|yonetici (olmak|yap)\\w*|terfi\\w*|kasaya (ben )?bak\\w*|karar ver(mek|eyim|ebilir)\\w*|daha fazla sorumluluk|bana guven\\w* (biraz|artik)|isleri ben yoneteyim|ben yoneteyim)'],
    ['teklif', 2, '\\b(teklif\\w*|olur mu|son fiyat\\w*|pazarlik\\w*|iner misin\\w*|indirim\\w*|duser misin\\w*|anlasalim|anlasabilir\\w*|kabul eder misin\\w*|vereyim|alirim|aliriz|alayim|veririm|veririz|satarim|satar misin|verir misin|teklifim)'],
    ['oneri_kabul', 3.2, '\\b(kabul (ediyorum|ettim|ederim|ediyoruz)|teklifini? kabul|anlastik|razi(yim|yiz)|ben varim|tamam anlastik|hadi yapalim|tamamdir yapalim|tamam olur|olur tamam|teklifin uygun|uygundur|kabul\\b|el sikisalim|olur yapalim|tamam o zaman)'],
    ['oneri_kabul', 1.5, '^\\s*varim\\b'],
    // ---- genel kaliplar (kor set gelistirmesi) ----
    ['selam', 1.3, '\\bhayirli (sabah|aksam|gun)\\w*'],
    ['selam', 2.5, '\\b(yeni (girdim|katildim)|(oyuna|kanala|aramiza) (girdim|katildim|yeni geldim))'],
    ['hal_hatir', 2.4, '\\bkeyf\\w* (yerinde|nasil)\\w*'],
    ['hal_hatir', 3.2, '\\b(ben de|bende|ben|ben de cok) (iyiyim|iyi|idare ediyor|fena degil|iyi sayilir)\\b|^(iyiyim|iyidir|idare|eh iste|fena degil)\\b'],
    ['iltifat', 3.2, '\\b(guzel|hos|cok guzel|ne guzel) (isim|ad|adin|ismin)\\b|\\b(ismin|adin) (cok )?(guzel|hos)\\w*'],
    ['dert', 3.4, '\\b(ayaklarim koptu|belim koptu|yoruldum|yorgunum|cok yorucu|yorucu ya|bitik|helak oldum|anam agladi|canim cikti)\\b'],
    ['saka', 4.5, '\\bharclik\\w*|\\b(beni|bana) (evlat edin|sponsor ol)\\w*'],
    ['tebrik', 3.2, '\\b(helal\\w*|masallah|eline saglik|ellerine saglik|super olmus|guzel olmus|cok yakisti)\\b'],
    ['veda', 2.4, '\\b(hosca kal\\w*|ben (gideyim|kacayim|cikayim|yatayim|kaciyorum|gidiyorum)|(gideyim|kacayim|cikayim|yatayim) (ben|artik|hadi)|hadi (bana )?(eyvallah|gorusuruz|kactim)|gitmem (lazim|gerek)|ise gec kal\\w*)'],
    ['bayram', 3, '\\b(hayirli cumalar|cumaniz (mubarek|hayirli)\\w*|kandiliniz\\w*)'],
    ['is_ariyorum', 3.5, '\\b(?!kiralik|satilik|yatirimlik|aylik|gunluk|haftalik|yillik|ogrencilik)\\w+l[iu](k|g[iu]) (' + AR + '|bak[ai]\\w*|lazim|yapmak ist\\w*|yapabilirim)'],
    ['is_ariyorum', 4, '\\b((eleman|isci|personel|calisan|garson|kurye|usta|sofor|kasiyer|danisman|biri|kimse|adam)\\w{0,3} ali(yor|r) (mu|mi|musunuz|misiniz|musun|misin)\\b|kim (\\w+ )?(eleman|isci|personel|calisan|garson|kurye|\\w+ci) ali(yor|r)\\b|ise alim var mi)'],
    ['is_ariyorum', 3, '\\bis (ayarla\\w*|bul(un|sana|ur)\\w*|olan (var|kim)\\w*|varsa|olursa|olan)\\b'],
    ['is_ariyorum', 3, '\\b(calisirim|calisabilirim|calismaya hazirim|her ise hazirim|is olsa yaparim)\\b'],
    ['eleman_ariyorum', 3.5, '\\b(eleman|isci|personel|calisan|danisman|garson|kurye|usta|sofor|kasiyer|muhasebeci|asci|komi|stajyer|biri|birini|kisi)\\w{0,3} (ali(yorum|yoruz|nir|nacak|riz|rim)\\b|alacag\\w*|lazim\\b|arayisi\\w*)'],
    ['maas_sorusu', 3.5, '\\b(kac|ne kadar)( para| bin| lira| tl)? (veri|od[eu]|ali(yor|r)|kazan|calis)\\w*|\\bkaca calis\\w*'],
    ['maas_sorusu', 3, '\\b(prim (var|veriliyor|ne kadar)\\w*|brut|net maas\\w*|net mi|sigorta\\w* (var|yapiliyor)\\w*|gunluk (kac|ne kadar)|haftalik (kac|ne kadar)|yevmiye\\w*|bahsis\\w*)'],
    ['meslek_tavsiyesi', 3.2, '\\b(en (karli|iyi|mantikli|kazancli|garanti) (is|mesle[kg])\\w*|(is|mesle[kg])\\w* hangisi|\\w+ olmaya deger\\w*|\\w+(dan|den|tan|ten) sonra ne (yap|ol)\\w*|baslangic icin (ne|hangi)\\w*|neye gecsem|ne olsam)'],
    ['kurs_sorusu', 3.8, '\\b(sinav\\w*|kpss|ales|belge\\w*|ehliyet\\w*|lisans\\w* (al|nasil)\\w*)'],
    ['yardim', 3.5, '\\bnasil (\\w+ )?\\w{2,}(ilir|ulur|inir|unur|nir|nur|lir|lur|irim|urum|arim|erim|iriz|uruz|ariz|eriz|abilirim|ebilirim)\\b'],
    ['yardim', 3.5, '\\b(ne ise yar\\w*|nereden (alinir|acilir|bakilir|yapilir)|nerede(n)? (bulurum|bulunur)|(menu|ayar|buton|sekme|ekran|profil|envanter|harita|magaza)\\w* (nerede|yok|acilmiyor|nasil)|nerede (menu|ayar|buton|sekme)\\w*)'],
    ['zam_istegi', 4, '\\b(zam (yok|gelmezse|gelmedi|almadim|alamadim|yapmadin\\w*|yapilmadi|gormedim)|(biraz |daha )+(fazla )?vers(en|eniz|ene)\\b|maas\\w* (\\S+ ){0,2}(cikar|artir|arttir|yukselt)\\w*)'],
    ['yetki_istegi', 4, '\\b(admin\\w*|moderator\\w*|mod (yap|ol)\\w*|mod\\b|yonetici (yap|ol)\\w*|hile\\w*|bedava\\w*|para (gonder|yolla|at)\\w*|bana \\S+( \\S+)? (gonder|yolla)\\w*|para verir mi\\w*)'],
    ['teklif', 3.6, '\\b(ortak\\w*|beraber (\\w+ ){0,2}(ac|al|kur|yap|isle)\\w*|birlikte (\\w+ ){0,2}(ac|al|kur|yap)\\w*|\\w+ (acalim|alalim|kuralim|yapalim)( mi)? (beraber|birlikte)|yari yariya|seninle (\\w+ )?(is|ortak)\\w* (yap|kur)\\w*|is birligi\\w*|isbirligi\\w*|is yapalim)'],
    ['dert', 3.6, '\\b(bat(ti|tim|tik|tilar|iyorum|acagim)\\b|dolandiril\\w*|odeyemiyor\\w*|odeyemedim|odeyemeyecegim|alamadim|alamiyorum|maas\\w* (yatmadi|odenmedi|gecikti)|atilacag\\w*|kovul\\w*|(elemanlar|calisanlar|isciler)\\w* (kacti|gitti|birakti|istifa)\\w*|beni (oldur|bitir|mahved)\\w*|borcum (cok|var|bitmiyor|buyuk)|borca (battim|girdim)|icraya (dus|gitt|verdi)\\w*|yardim etmiyor\\w*|kimse (yardim|umursa|bakm)\\w*|parasiz kaldim|meteliksiz\\w*)'],
    ['dert', 3.6, '\\b(redded\\w*|reddetti\\w*|onaylanmadi|kabul edilmedi|kredi\\w* (cikmadi|verilmedi))'],
    ['kurs_sorusu', 4, '\\b\\w+ (olmak|olabilmek|gecmek) icin (ne|neler|hangi \\w+) (lazim|gerek|yapmali\\w*|almali\\w*)\\w*'],
    ['kisisel_meslek', 3.6, '\\bhangi mesle[kg]\\w*(sin|siniz|sun)\\b|\\bhangi (iste|sektorde)\\w*'],
    ['kisisel_ad', 3.6, '\\b(isim\\w* (ne|neydi|ney|nedir)\\b|ismini\\w*|nick\\w*|kullanici adi\\w*|adini (bilmiyorum|bilmem|ogrenebilir)\\w*)'],
    ['bot_musun', 4, '\\b(bot (mu|mi|musun|misin|musunuz)\\b|gercek (oyuncu|kisi|insan)\\w* (var|mi|mu)\\w*|bunlar (bot|gercek|npc)\\w*|hepsi (bot|npc)\\w*)'],
    ['iltifat', 3, '\\b(mantikli|yardimsever|akilli|bilgili|tatli|sempatik|kibar|nazik|zeki|harika|super|efsane|sevimli|eglenceli)\\w*(sin|sun|siniz|sunuz)\\b|\\b(mantikli|guzel|akillica|tatli) (konusuyorsun|yaziyorsun|anlatiyorsun|dusunuyorsun)'],
    ['saka', 3, '\\b(guldur\\w*|gulmek\\w*|\\w+ (olsam|olunca|olursam) (herkese|hepinize|hepimize))'],
    ['fiyat_sorusu', 3, '\\b(iner mi|inmez mi|duser mi|kac olur|en son kac|son kac|kac milyon|ucuzla\\w*|pahalan\\w* mi|pazarlik (olur|var|payi)\\w*|fiyat\\w* (ne|kac|nedir))'],
    ['ekonomi', 3.6, '\\b((fiyat|kira|piyasa|dolar|emlak|altin)\\w* (\\w+ )?(dus|art|yuksel|ucu|uctu|inecek|cikacak|neden)\\w*|neden (art|pahalan|yuksel)\\w*|zamla\\w*|zam (geldi|gelmis|yagmuru))'],
    ['mulk_ariyorum', 3, '\\b(daire|ev|evi|konut|dukkan|arsa|arazi|tarla|isyeri|magaza|villa|rezidans|mulk|\\d\\+\\d)\\w{0,4}( \\w+)? (var mi|bulunur mu|olan var mi)'],
    ['mulk_ariyorum', 2.8, '\\b(kiralik|yatirimlik|ucuz|uygun) (\\w+ )?(daire|ev|dukkan|arsa|mulk|konut|isyeri|\\d\\+\\d)\\w*'],
    ['mulk_ariyorum', 3, '\\b(mulk|yatirimlik)\\w* (' + AR + '|bak[ai]\\w*|lazim|almak\\w*|alacag\\w*)'],
    ['mulk_satiyorum', 3.2, '\\b(devred\\w*|devrediyor\\w*|devir\\w*|sat(ip|arak) \\w+|alan olur\\w*|alacak (var|olan)\\w*)']
  ];
  var KURAL_RE = KURAL.map(function (r) { return { n: r[0], p: r[1], re: new RegExp(r[2]) }; });

  function soruMu(n) {
    if (n.ham.indexOf('?') >= 0 || n.ham.indexOf('؟') >= 0) return true;
    var k = ' ' + n.katli + ' ';
    if (/\s(mi|mu|misin|musun|miyim|miyiz|misiniz|musunuz|midir|mudur|miydi|muydu|miyiz|misin)\s/.test(k)) return true;
    if (/\s(neden|niye|nasil|kac|kaca|hangi|hangisi|nerede|nereye|nereden|neredesin|kim|kime|kimin|kimsin|nicin|ne zaman|ne kadar|nerelisin|naber)\s/.test(k)) return true;
    if (/\s(ne) (haber|var|yapiyorsun|is|oldu|dersin|diyorsun|yapayim|yapsam|kadar|zaman)/.test(k)) return true;
    if (/(var|yok|olur|iyi|dogru|uygun|tamam|mumkun|kabul)m[iu]\s/.test(k)) return true;
    return false;
  }

  function sakaMi(n) {
    if (/:d\b|xd\b|😂|🤣|😆|😹|:'\)/i.test(n.ham)) return 3;
    var p = 0;
    n.kelimeler.forEach(function (w) {
      var f = katla(w);
      if (f.length < 4 || /\d/.test(f) || KUFUR_TAM[f]) return;
      var unlu = (f.match(/[aeiou]/g) || []).length;
      // kahkaha: yalniz h ve a/e/i harfleri (haha, hahahahha, ahahah, hehe, hihi)
      if (/^(?=[aehi]*h)(?=[aehi]*[aei])[aeh]{4,}$|^(hi){2,}h?$/.test(f) && (f.match(/h/g) || []).length >= 2) { p = Math.max(p, 3.2); return; }
      // klavye karmasasi: unlusuz ve (uzun ya da tekrarli): sjsj, ksksk, skdjfk; "kpss", "smmm" gibi kisaltmalar degil
      if (unlu === 0 && /^[a-z]+$/.test(f) && (f.length >= 5 || /(..)\1/.test(f))) p = 3;
      else if (f.length >= 6 && unlu / f.length < 0.2 && /(..)\1/.test(f)) p = Math.max(p, 2.5);
      else if (/^(asd|qwe|jsj|sjs|ksk|skd)/.test(f)) p = Math.max(p, 2.5);
      // ana sira harfleriyle dort+ unsuz yan yana: ahdkfj, asdkjh (Turkcede olmaz)
      else if (/[^aeiou]{4,}/.test(f) && (f.match(/[asdfghjkl]/g) || []).length / f.length >= 0.8) p = Math.max(p, 3);
    });
    return p;
  }

  function varlikBul(n, baglam) {
    var meslekler = meslekBul(n.katli, baglam);
    return {
      tutar: tutarBul(n.kucuk),
      meslek: meslekler.length ? meslekler[0].id : null,
      mulk: mulkBul(n.katli),
      yer: yerBul(n.katli),
      kisi: kisiBul(n.ham, baglam),
      kanal: kanalBul(n.katli),
      _meslekler: meslekler
    };
  }

  // =====================================================================
  // 5b. ISTATISTIKSEL MODEL (Naive Bayes, karma ozellikler) + KARMA BIRLESTIRME
  // =====================================================================
  // Ozellikler normal().katli uzerinden: kelime 1-2-gram, kelime koku (ilk 5 harf), kelime ici karakter 3-4-gram.
  // Her ozellik FNV-1a ile 2^bit kovaya karilir. Agirliklar tools/niyet-egit.cjs ile uretilip asagiya gomulur.
  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function ozellikler(katli, bit) {
    var maske = (1 << (bit || 15)) - 1;
    var w = String(katli || '').split(' ').filter(Boolean);
    var set = {}, liste = [];
    function ekle(s) { var h = fnv(s) & maske; if (!set[h]) { set[h] = 1; liste.push(h); } }
    if (!w.length) ekle('_bos');
    if (w.length <= 2) ekle('_kisa');
    for (var i = 0; i < w.length; i++) {
      var x = w[i];
      ekle('w' + x);
      if (x.length > 5) ekle('p' + x.slice(0, 5));
      if (i + 1 < w.length) ekle('b' + x + ' ' + w[i + 1]);
      var y = '<' + x + '>';
      for (var n = 3; n <= 4; n++) for (var j = 0; j + n <= y.length; j++) ekle('c' + y.substr(j, n));
    }
    if (w.length) ekle('s' + w[w.length - 1]);   // son kelime (soru eki, fiil)
    return liste;
  }

  // Gomulu model: tools/niyet-egit.cjs bu iki isaret arasini yeniden yazar.
  var NIYET_MODEL = /*MODEL-BASLA*/{"tur":"lr","b":15,"c":["selam","hal_hatir","tesekkur","veda","tebrik","ozur","evet","hayir","is_ariyorum","eleman_ariyorum","maas_sorusu","meslek_tavsiyesi","kurs_sorusu","mulk_satiyorum","mulk_ariyorum","fiyat_sorusu","ekonomi","kredi_sorusu","bayram","dert","kisisel_meslek","kisisel_yer","kisisel_ad","bot_musun","iltifat","hakaret","saka","yardim","zam_istegi","yetki_istegi","teklif","oneri_kabul","genel"],"q":0.0177053,"w0":[0,-8,-6,20,-11,-17,6,23,-69,-26,-26,-27,-33,-31,-33,-7,46,-28,-20,75,7,-20,-12,-26,-7,68,52,21,-39,17,10,-30,131],"k":{"lambda":0.65,"beta":0.5,"g":1,"T":null},"d":"2:8jl9h9hgpjl6;2:4iy8iu9iprh0ukmvgg;3:4lymhaogs;3:2kd6hf7ha8gx9jaag9bilcjsejdfjchk2jgskh9lh8mk5nhapgnqh0rj8sh5vhawgs;1:1iw2j05hd6hd7h78jx9heailch9ehcfh1ggfjjykj9lhenh0oj6pjlrh8sj2wgg;1:1iz3ju4hg5k76h77gp9h4ajjbhccgxghghjsijbjhekhclhfmhanhepheqm3rk4thfuhgwgx;2:niw;1:8is;2:3l05j1ehegjsoh8uhd;1:ej5tio;2:0hg7he8h4afqeh3fgfglzhn9jhflh4qp9wh2;1:2lo3jn4hf6hg8gsaksbgschggh8hhgjg5kkdmgvohcqh0rh4tmpuhgwin;1:qj1;1:sinvja;2:6jovgv;1:2j04j1dk4ehfrha;1:7gg8f5bgbchefhfhhajh6kkdrlmumcwkk;1:cgzhh8oh8pjzqjprivtjo;2:3he8h19j2ehamkutj4wgw;1:ik2rhb;2:jhfmj1qjm;2:pmvsio;2:aj4chgfix;2:khcpk8;3:2gr3h44h96hb7ha8jc9j1ajtbj3dhfeh1gh1hh7jh4kgzlh3mh9nnwojgpjnrgxuh7;2:bjtjg6kh3ropuhb;1:riu;1:ahdrjzwhb;1:ljg;1:4k85jh7h88hc9h2dilgh9hh5jn7ohaph9qm0rj4vh2wek;1:cgwjjo;9:0gx1jh9ir;2:qjc;1:phawka;2:1h73hc7heaj6bhcchefhhgjvhgrjjmqhcrjbslnuglwiy;2:wit;2:7gbgjjjk9;2:5itbh3cjtfm9givqhbuh7;1:4j2;1:uiz;3:2g73hd6oa8jp9hbaj6diwfh6gj2hlkjgwphfqhcrj6ug3vebwh5;5:0h73k24im5hc7g8agubh7ehbhhdjm1ohcpj3qiorhgvh2wkd;3:jiu;3:7ipwjg;1:9jraiwbh6cjkkk3nhgrh9;4:ejn;1:aiygkd;2:dgsekygh6rjstkswhb;4:2jx3hg4kzij1oh0;1:ciqmjs;1:uj0vjj;1:jikqj6;1:9iu;1:1iwkj3;1:dhgek0;1:1jerhbuir;4:8h09ikajoeji;4:8iv;5:rjhvh5wiz;1:hiw;1:dg9ejqfiygiwkis;1:ciz;2:njj;1:1j8rhe;4:3ilcj0fj5;1:aiwbh3mj9oheskrwh0;1:qku;2:8hhbgwcjedjbehejgalhgok1phgrokuhfwgf;2:8iulir;2:3jdhiu;1:mk2win;1:eilqip;3:liprhg;1:7kp8gz9j2agydkgegbfgrgkfiixwgx;2:gjh;1:gh7siu;1:2j5ajbbhcdj8eh7gh8njnoj2whe;1:3jg6jmqhetikwh3;1:pjf;4:dgtejb;1:0iu2gx3h54hd6hg7iw8h2ahabh4cj3djffgzghdhg9kkhnhgqh8rjgtljukgvh9wgx;1:1jr2jy4iy7h38iqah7bh9ch0dh4egwfh8gldhhgij6jgmkgoljbmhbnhephhqh8rkmsj5ujtwf9;1:0hh3gs7h3ahabgccgdeiyfgpggthgnih9jg3kkxll9njmooqpkjqfyrgttheujywet;1:aip;2:1kp2js4io7gxbgucg1dgygk7iitjfokgjlixmh7nhapherl4siutjduikwgb;1:wlc;1:6li7hejhbuhavk3whg;2:8hbaiyjiz;1:2j56jn8hg9iojimsjkwh5;1:5k38j5;1:1h48j09m1bh4ejphjwjh4lh9qhdrjgwgk;3:siq;1:1jk4kffjpkhc;1:0kq4il6gy7gz9fxak1bhhcj0dh0gkzijkjjplhbmhhogvph0rh7tjouhfwgm;3:0h93jeahfblnegyfklnggpjewh1;1:jjl;6:ch8wl6;1:jhgtja;3:wiv;1:4he9giahbbl2cgrfmigg5hj2jitkh4ogwpllqhbwgs;1:2in;1:8ivqjd;1:jka;2:8hd9h5ajlgjk;1:1j4wis;1:wik;1:8go9incit;2:8k09gm;1:9ipsj4;1:eijriq;1:oin;1:6hachhfjdhk7uirvjwwhd;1:9hgagschgejdgixhgpjgvmh8pherjmspjtjmuh7wh7;2:6iswil;1:9imbj1;1:6itrir;1:0h51h57g18habikcm5ghbhhejh5ph8qlmrfcsh7uh7wrb;1:6t28h8ahcdhaeh5fhagiyjjelgxmh5qh6rjjsgvtjcugzvitwel;1:gh2ritsisuj1;1:uja;1:0hc1g12h03h67gg8k19ivakabj8cjmehgfl9gguiiskgwlhgnhdohaqgirk0sh8tgruguwj6;3:1is;1:chdehhfkngfzjkauk7vix;3:giw;1:mj2;1:0ir1is8h49gxah2gghjj8kh6lhfniooinqjvrjfuixviu;1:8jb;2:0j78k09hhwhe;1:3jw5iq8hfahebivckadh4ehffh9jipqgzrkcth8wim;2:ihdwk8;2:fjlkk4lh1;2:kio;1:6itbj6;1:7jc;1:agvbjeejioiz;1:pj0;1:6gnuiyvjd;4:4jvqiv;1:4lh5jc8kd9frch7ehfgj6jkdsgtwgb;3:oip;3:4jk;2:kj4piswjb;1:6g6vh0wlm;1:wiy;2:aivjhasit;1:2j44j57j6bipjherhdwj2;1:9h7jjhkjv;2:sil;2:8il9hggj7;1:8il;1:1iyrhg;1:3h84ko6he8gb9hech0ej3fj7ggtih5kh8lhcohgphfqjltinulpvju;1:biu;1:1j8ahgqkd;1:fix;3:4h96km8j99hacgzeiujh1kjomj7nhdph5qh6rgl;4:2ik8iy;2:8hgbkbtio;1:8k7jhfqjp;4:4okjhcqikwhg;1:1nh2fs3gz4j0cjafisliwmk7oh4pjnqhhthcuhcwh6;4:bipgk3qk6tiowgx;1:wjg;2:8j5bh8lh3mhdokmrjrsh5tjpwgz;1:9jgaj4hioshbwj9;3:ril;2:ah1ffwgn5hjzjfurfzsjywjy;1:aivdkcjisqguvh9;2:1ix6kcqhgwh1;2:9kerh4;1:7h5bhdcjuehdfktrhcsk8thcuk7wh2;1:3jx5j07ha8k4agedh4eirfgrgj9jh5ljtnmkoivrgqthduguwfo;2:1h43gz5hf6h87hg8h79h8bgidkgejmfkrgipjk3ph3shf;1:gjh;1:8j7qhe;1:9jmahdbizehdiisjhfrjouj7wj2;2:8izdhafj5;3:0iv3h57hf9imbhecgbdjnejeggxjjhliwoixphgqheuh4wka;1:wj3;1:dhbejc;2:9nubfpcgwdhbemqfh7qhbrgzth4uhewku;1:8io;1:8jubgzjkf;1:8la9gw;1:2isdf9ele;1:ajadikogkpjqrha;1:jiynjjuhf;2:1kjbk1wh7;4:7k4tjawhd;1:hj7jh8sik;1:aj5hhgjiwkghnl8pkwqh8rj0wgd;2:9jwjh3olxph7wh7;1:jiynip;7:mh6oh6pm3whd;1:5jv8hegh4hj7ijnjgmqjtrkhthewh5;1:eiw;1:1hg4jcckfkhdwkz;1:rin;1:jh9nioohdqkrwhh;2:6hafj9hk8uirvjwwhe;1:6ko7hfjh2nhfpkfqmrwgc;1:4lt5hbahbuik;2:jj6;4:fip;3:fik;2:8hg9iwciqdj0rh9;2:jjpriqtiowgn;1:bkjdj2wha;1:0ip1h88ik9gnbiydh9ehbfj0qiqsj6whd;2:gk9jhf;1:2l3ok6whf;1:2jf;1:jgrqkvwhe;1:8ivfhgglpjhbpjcrh9uhh;1:1hh3h54jo8j49h9ah3cj6djjfimjj7ohdphgrj5slithhugewgf;1:6hg8h7hk5uk9vij;1:6k38ke9gdbjwch1;1:2h55hg8hfagmbhffg8goxhn0jh0pj0rh2uj4vjewgk;1:8hcelihh4jiswhc;1:qko;2:9iumis;1:ahbdiuhirjkjuiwwhh;3:1hd2hf3im4jc9irbh8chcfhajghkhdmiknhhol4phgrhask4thbugqwks;1:0iw8h8fh1ghcjkdkjulh5mhdojmpgvqhhwke;2:2l9;1:hiq;2:mhbwkd;1:5jpjgzwj2;1:8izqncrhauhbwgg;2:til;1:8jhdjeeh1gipjmsphawh4;1:8gx9kp;1:3hg7h98grbgvdikgivjk3ql4uh1wip;1:uj2;2:9ioajjshh;1:0hf1hh3hf6hd7ha8ha9k9ahdblecjtdklejifj5gglihhjfhkh8mhdnh8ojaph5rgssh6tl8uh9vhewgu;1:3hg8iy9jzajnbktcjsegxfggghckj7nhdpheqj9rh1;1:giq;1:8hagku;1:chbwjg;2:eiq;1:4h66hgaiqcilghdkgrogmqltrimuhdwio;2:8hajgomkdqhdrmwvhdwis;1:ain;1:ahdbkfuiv;1:8h3ala;5:wjo;1:1kz2in3h64gf6hc7hb8inbj2finggmhioij8jinmkgnh8pgoqgwrjytgrug7wh4;1:airejgqj2;2:dk1jhb;1:9h4ekkfj7whe;2:1n02ir4j1dgvgiroj2pgzqhguhdwjx;2:0gu3hb6h67j18kn9ioaj8ch5dhbemuggmjh4kjilhamjbnhaohcpivqh9tgmuhgwgp;1:bimfhghmhrh7;1:0kx1n98j3ahfbglcjvfh6gjqjh1kgimhdohdph4rgxuh8wjj;1:cjyfhb;3:6l8vft;1:6hdcjfhkbjh3rh5uj8vkewh7;1:7imqjl;1:qjv;1:8hhak2cj8hgwjlusggwhf;1:1h65ir8jg9iqeirfh7gh9jjlkgslhbohdpgwrioujevit;1:1j7wh6;1:fkwghb;3:2gh3gw4he5hf7tyah9hh2jhgvh9wgp;1:cjk;1:biljis;1:jk3;1:tj2;4:rj2;1:8j8divegy;1:cit;3:3h35jb8hbajxkhbmmvnhcphbujfvhg;2:wjv;3:cip;1:bko;1:8iu9ipjiu;1:8jf9hf;1:chgnmppgytjs;1:jj3;2:jisoizphg;2:2ik9ij;1:4is9in;2:ck3shc;1:3jtejcwgz;1:jj7oir;2:gh0jl6plawhg;2:bjf;2:dh9ejxrh8;1:gix;1:ikf;1:4ky;2:0iq2jl;2:8ji9gicm5rgb;3:hjs;1:1hf3jt8j89h9ghgjiqpjkqk8sjothdwh6;1:8goujw;1:ajr;1:hjfpintj8;1:wj7;2:ainfjm;2:ril;1:dhdeiy;1:0ha4hc7hd9h3aiobjiditeh1fj4ggzhivjhgkk2mjqph7rkwth2wgk;1:tin;3:8h79k7ahc;2:4h38io9hgajkfh5rji;1:4j4dj5;1:0ir2il;2:0h01h04j76hf7gp8h29jedjdeh3ghghk2ijnjkpkgnlh3mgwnkgoh1pgzqiprg6sj0tilvhd;4:ajfmjenim;1:0k53h98gnbh7cl2dhaeithmrjg5rfptjquhhwis;1:tkswgw;2:8gw9hbakzbhcfg5gh3hhcujgvkfwlc;1:2inhjnuj0;2:jix;1:fio;1:wj1;3:lja;2:jh7qke;1:8gv9jo;2:9ivbiwkjcnh5;2:ch0fk2wj6;3:jjnnjcwh0;1:5h6ak6fh0gh1sj9ujtwjr;1:mjarjhwhg;1:cjxrh1;1:8ioeim;1:8hbjm7oizqgnrhgwk3;1:oivuiw;2:1hc2jz3hf4lo7hb8ixbglchadheejafgqghhhh3ikrjh1lh4og8qh5ujawin;2:2iv;1:jh1mjbwjn;3:piv;3:aghfkegjvuiswhf;1:5jk6lkhhgjiswhe;5:8gy9k4jgywks;1:8imehd;1:cj3mjusimujfwh7;1:dimlh7mhbrjasgvtkbwir;2:fj7;1:8iyehegl0hh1oj1wim;1:aghfkdgjvuiswhf;2:5j2;6:wkg;1:bjstiw;1:8h6ajughghj5jgcqj5sj7wjh;6:0hf3ha5ku6im8k8agrbgcegnhgnjo2mhfnj0ohaph5uixvh5;1:qjl;3:ijk;1:8j5chcjhelhcnfdpq3rirshb;1:bjqck9;3:8j5;1:0inghhjhcmhhoiwqjltjlwk1;3:9io;3:uiwvim;1:jh3qkp;1:mh3ojc;1:vjo;1:fiw;1:0ja8gxbheckceiymh1qivrk1wh9;1:gj3;1:4hf6h78j39jfagtehghhgkj0ukuvjewhf;1:6iq9hfgjvtjc;1:3hg9lcaggbhbciyfiqghghhfjionjupj5rjnwh5;1:5jp9hhch1fl4;2:pgtwky;2:hivqj4;1:ijdpjqwhb;2:6he8h1bk0pkcqh7ullwhe;2:ahcrg0wmn;1:8irril;1:7iq;1:qkh;1:0j8jj4;2:aivuiv;2:fipnkn;1:3hh8jl9jibjddiveh2fjmgjrhhfohgphbqh4rgath5uinviwwgb;3:3hf7haakkbj1chdeh7fh5gh5hh6jh0lh0mjfohgqh8rh1slzthhuk3wjb;1:5h46h57gq9jxhgyih7jkvmgsokapkdqhgrgswg6;1:8imakgggwwj7;1:bgzkjjtikvj8;2:njcwix;1:jlk;1:0iwjhbwjy;2:6is9jdtis;1:8jykh9pk4whb;2:jim;1:ah2oko;1:8jeoh0pjmrh5;2:sio;1:miwtjk;2:7h6qh4wla;1:eil;2:pj9;3:1mu8gp9gtahcbgern8uhhwhe;2:8jg;2:din;1:4imbh4cjvjkiqhfwh1;1:0hh6k97h98h6akfcixdhffgughahh7jguph1rh7smgvm1wf2;1:tin;1:bipoimriptik;1:gjwqj0whf;1:0h01gs3gj5h56gy8ir9kmajqbh5cjdegvggbhiqihfjgnkfolhcmjuoh4pgjqlerlish7vji;2:0hg1iw3h47ha8jl9k6ajickqdgxeglggshh8kjzlk8mh5oj9pisrg0ugnvhewfz;1:uj1;1:7hfdj1on7ph5wha;1:ij6phcqmpwgp;1:il3kip;2:3knijcjhg;2:bhfwmt;2:9gcdk3elrfiurhf;1:4j0cgsdhfjjhwip;3:1gzil0;2:liw;1:2iokhfnk2;1:qj2;1:8iw;1:5h0wjs;2:jh0wjz;1:dhcej6;1:8hdbkdgio;3:8is9hc;1:ailliv;3:qjr;1:4jkwhg;2:8j1;2:8h6alvbhbehdghbslu;1:8ip9hfwir;4:0ix;1:pkywh4;1:wjf;1:1io2gt3gq4hd5ix6h37gfbj2chadiqegvggqhh0jirlgbmisnjvok2pjmqioshgtj4vgowko;3:ahbbjz;2:8hb9injivqhdrhdwk2;1:cilwkp;1:0h92k53h54g15k76kp7h48gv9hfagobguckedjmffhgljhiqjhbkgulh9nk1ohapgyqgprjdthguj7vfp;2:2ks4j65h56j48fh9fpbikegsgh9jilkivpjrqizrgfwgz;3:rjcuiv;1:bikphawl6;1:qj3wis;1:8hctk7whh;1:fja;2:aimbj3;3:wis;2:1iv5h96h88iy9j2bh8cgxdg8ejnfj4ggyhgoigqjjalhfmj5njjrissjgth2ugkvivwj8;3:0hf1n13h57jlbjpgh8hiwiinjh3rh7wh9;1:7jiajeij1rjfthd;1:tin;1:8ix;1:4kz6j67hb8j79h7ah5hh1jkholhpgoqh3sjzwgk;5:7ijbjegiywhg;1:0lf4ix9jeah4ehhfghjhfph7qhgrl4sknwgn;1:8iuhj2rhf;1:8hf9jyap4binch4dhceh0fh9gguhh0jh7kh6pipqhergsskzthgujiwgt;2:wj2;1:oin;1:3jp;1:0ha1he3h26hf7l09krah3bhccmadgzfhgggvhj4kg3mhfph2qgrrkjsh6vjawhc;1:cineh7fjh;3:pjyuiy;4:9irpjywh3;1:qkb;1:gjnuj2;2:fjwrhf;1:nix;1:6he8heegmfiygggil6jhglk6njqpioqhfrhdtkiviswg1;1:eim;2:3jtwgz;2:tio;1:1iv;1:1k9;1:pjmwis;1:bjlkgjrjt;2:direhbijbjinkhapk2qhetj7;2:0ji3j0ghcjjwok4whb;1:1jf8kr9gngheiitoir;1:aj5fhd;1:pik;1:0hf1k22iy3he4jk6hg7gq8h39jdaikdhgfgwgipijqjkjkivmgznggpgorj9th6uh7vhdwh0;1:6k6gjjjh7sjauj8vjcwgk;4:hik;1:7iqgiw;1:ciqhk6rfw;1:wiw;1:hgork3wk7;2:gkfwgm;1:1je3gs4k06hb7lv8he9hhbgucikdinelcgjthhdjj0kgpljemh4nh6oh9ph3rg2sgmuilwes;1:jhbwkg;1:wl6;1:7h7adqekrgk7jjhqhhsjq;2:9henk2rjf;1:5he6iy7jp8g99gedkaemyfhdgkvhhgjfylhcmj8qh7tj6uhfvhbwh6;1:4jp7he8gobh8ch9fh4gkfijjjilkhfonfpgsqhfrgdwjr;1:3he8hdgjohjyjgyqlxsgzujywha;1:wik;2:njkuhg;1:jimmir;2:viy;2:tis;1:rim;2:8h29habh7chgdjcehfgh5hh3jh4kgwmpanheojypkpqhhwgr;1:jjb;1:9ip;2:gj9;3:ehgjitqjtrj6wgp;2:8ilafhbfucvyfgpgfphgujitkj1lipnhdrh7sh6uiowft;1:5jz8gs9ktajrdh3egvgjbjiwqh1rj7ug7;2:1o6kfcwhb;1:4kj8gm9jcdooedofiuggxrimuhdwh1;2:8ix;2:bipuj4;2:3iohiqrhg;1:rim;1:blgch9dhaej9gheuim;1:3kw8hhhj0qip;1:8itaip;1:ag3fkjgixuiu;2:gizlik;1:3kh6hcvij;1:qimwjg;1:lherjf;1:ej8;2:jhfpknqhf;1:bim;1:gke;1:bjz;1:8hgaim;2:fij;1:8h1bh8cimdj2eh7fkuggzkkbwir;1:gj1;4:fj6jhdphgqlywgi;3:aj6;1:0iz1ph7giggvkhalj4rh6wfv;1:0lh1im2gp6h77hd9fkah7bhfdh5ehbjgbkjwlitmjqnjsok0pjxqh7sh0vimwfi;2:dhbejc;1:7iqdj6eh0;1:jndphcwgt;2:ejpfh7;1:ejkhh3;1:8kggkkliswh9;1:3kyghgkkdoikqhdwhf;5:bjf;1:2he4op8gx9jfjgeqhf;3:4ja6h99jgehcvir;1:dh1ekpuh2;1:fip;1:5j1hiqjhbrimwix;1:gj8rha;1:8hhjjd;1:6ivgiksj6wh9;1:8is;3:2h93js;1:sj6;1:hir;4:4hgiji;1:cio;1:qj1;1:jil;1:6ivcmtfhagh4hhbqjerh8wha;1:ekngh8;1:6jsthc;1:8imjggoiwqkg;1:0ka1hh2hf4ha7h18gv9ixaisbhfch5fiwgnqigvlhgnhaphgtgr;1:aj0ijfrhb;2:3ps6ivig5qhgwgz;3:1jc2h1;1:7jyiitwh8;1:ej3uhe;2:0hb2j63m64ha5jm7jgal2cj9dhceh7fhfgh6ihfjg3kh5lg0oheph2qgnrjttgjwjb;3:binpiwwj4;1:fio;1:0h41h32h94nh5gr6gk7j98kl9gjbhcciudhbeh5hgyih1jg1kgnlgnmh6nhfokcpperh8sgtth8ugbvm8wen;3:8jfdh6eipniqohd;2:0jbpixwhg;1:aip;1:3h84il6hg8hb9iwah8dkqel2fk7gh9ihgkj8mh4nhcpgvrgrshfuj1wgj;1:1gc3kk8oibjeditjhekggnioohcphguh3wgn;1:8hd9js;1:pk5;1:4il9ipuj8;1:6ivij3;4:kj5;1:gjq;2:7ikeheuiwvjh;1:aiwhjpsiqwhg;1:bhecirfkxghb;1:1he3jxdkaegsfj6lh3nkoojpph1whd;1:jitnik;1:0gx1gv2h94h96h38ku9jbah6biqdj8ehgih0jiqlh7mgtojvpilqh5riksjoth8uj4vh3;1:8ivvj1;1:4h76haaikfhfok3vlewhg;2:gjf;1:4iojhgmjbohe;1:jjj;1:8ik9ilhjvjhcrhf;1:cjz;1:gix;2:5im8kq9jlbhekhdth3ul9vh9whh;7:8h99ixoiptlj;1:miwtjh;1:bj6hjajja;1:uit;1:qim;2:dl7eg4;1:dj9hj2sj2;1:bharjp;4:bir;1:2it8jf9h8gjjhgojllshc;1:0it6ildh7ehdqiyrgvvil;1:4jg8khcheeiojh1qj9rh6;1:wiq;1:2kdcgljkh;1:1k68giahgbj2cg8fhfgj9hj3jgfkh9lhfnhcokvphcqlvrkptk3ugwvgvweq;1:qiq;1:1is;1:8k5ah7bjvohd;2:ogxpl2;2:5ji8hfbjtejqrhavix;1:cinpme;1:8nd9hgegywhc;1:wja;1:wiv;1:ril;1:3iy5kl8hf9ipjinkhfrhfwj0;2:dj1eherixtjxuhg;4:chddinehdghfmk4rk8whg;1:0j0;2:4iu;1:4nhih9phc;1:djnehh;2:jj7lharh0wkj;1:jkyniz;1:8iw;2:ah2bjg;2:bj2;3:himtir;1:2it3k38hfjflqherjcwm1;1:8j99h8ojspk2wh2;1:6it;2:phdqluwhb;1:civhhfjiooix;1:2l37he;1:0ij1h23hc6gt7jg9k9afvbiodjcgjehhejktkjbmh1njdph4rikuh6vh4wfg;1:ch6fh6gl5jlaogqpgmqiyrktwgh;1:okl;2:nij;1:hja;1:jj7;4:4j0ag4hgfrn9;3:nk5;1:tk2uh2;1:0ha1gw3j08h6aiybmrcjafhdghchh4jh1kmtlh4mh6nhcqhgwiz;1:jje;2:hh9pjqrjn;2:6iqul9vh3wkb;1:0irahfjjc;1:cjvwhe;3:bhhhjblj1;1:1in3iz4j05ci8gs9iuahabiqch2dj5eh6hgzijwjk0mjcpheqgurhfuj3vilwkf;2:bjpjkerh5;5:1gr3jt5hgah5cilfjljhdmnirg2wja;1:gintk4uhg;1:ah4ciqkjg;1:fiwkhfnjuqiq;1:9hfnjr;2:0k98ivbim;3:gj9;1:kji;2:4j4cjyfivrh7;1:4ikbj8khduj3wj1;1:iik;1:6jr8gbajhjk7oirpgyqh4uj9;2:8ittk8wh5;1:njv;2:qjd;1:7itjh9kfknlgphdtmhuitwg4;1:3iljiswh9;1:8iwwji;1:tk4;1:4ik9il;1:cjlpk3;1:hgfrjp;1:einmkcrh6;1:0gy3gv4ja6ky9hgmixqhbthcvkhwh7;1:vin;3:6n47g4bj8wgm;1:ij4lhfnkruiqwhf;1:8io;1:0jm1h8bheghehisinsjh3minwh6;1:8ir;1:4ip8hbghgiiljj6tliwh2;1:dhbuh5vkh;1:0h31h43h35h16g67kh8gvbggdgregugkplh7mh2ngwpjiqk3rhcsrotgpugpvijwgh;1:8kjehauji;2:8jirja;1:sjo;1:0h14h76j28io9h3chfghgiqljhbqhcrk1sikwgg;1:1j6qkg;1:0ixokz;3:rhfujhwjt;1:hipwj8;1:wj1;3:5it8irfjugistimwhc;2:1jn2ktrh3whf;2:9im;2:8jc9iqgj4;1:0lw6gx7gypfjqh8wmk;1:sinwim;1:8h79hdbgechaghbjh0lh8rpzwkn;1:8iz9heaitdinoj1wjb;1:bil;1:qiu;1:6hg8jo9gqbh3rjnvil;2:qj8uiz;2:kh3plywhe;1:dgtejhwki;1:hjh;2:6iuil3pj4wh3;1:fjb;1:6j6;1:8hfankbhfcgyehgjhckhfmiurhduisviwwj1;3:jiq;4:6j9jj2wha;1:8j19ikajabfqcjgehhfixjhfkk9;1:aherjs;1:aiu;3:0jt1gq2he3ji4h65jv6o3ak9bgkcj3dh5fgvgj8hgzjfzkguljamkgoh0qg3rg1tg5ug3vik;1:4jn;3:6m6ohe;2:mj2;3:5js8j79h5gitjk2wh1;1:giv;1:3im7hb8in9heak1bgbegmfkwgj0hj1jgflj1mhbojmrh7;1:tk2;1:ajf;1:9hdbjiej6ghdhh8jlxlk6qh9rh5thgujcwhf;1:imn;1:akiwio;1:0fsej2ik8khblj3mk2;1:7gwjk2;1:0gu1jo2hh3ik4hb5hg6hd8gk9hgah4bgwchedhceg5fjqggyhh8ihcjp5kjilhamh6niuoh6pkaqkvsilth3uh3vhe;2:8itejcqin;2:8gtbj4jkk;2:7he8incgqjllqjvwh2;2:0innju;2:sj4;3:8ji9inbhekj6;3:1k68isbhccjleiohgzjj6qhfrhcwji;1:hiqpj6;1:2ip5jqbinkiwngrojiphcqjbrj1wg4;1:4j0;1:7j48iojlcphgqhe;1:bio;1:0irgk0wh7;1:3hc6kt7k68h3jhcoh0qh9rh4uj3wm7;1:1hg3hb4hc6hb8im9gdbijch4fo1gghhkmjgbkh2mhfpgzqjorh0tglviuwmf;2:fhfgh5jfnlj0og1pkhtoluhcwl8;1:4iuejbohfpiywiy;3:1jufhdgj8;1:0ik1jd2jr3jr4j75h78h79hgagyeh1gh4ih4ljkmh8nhgoippinqherhbuio;1:0gp1rkahgrfkwhb;2:uin;1:lik;2:qj0ujr;1:8it;3:5jrrhc;1:rip;1:8j6eivjjfrha;1:2ld4j77j7chfqjhsgyuh0whd;1:7lqdiregwjheqji;2:cj1jh7;2:aj0ejqfhc;1:9ileikmjd;2:gil;2:3hf7mqfjerghtgvwiv;1:4jecirhknjh9rh7;5:6ja;1:gj3jhatis;1:0he1me3kv8kh9h1aktch6fg9gh2jkakgulhdnh6ogzph7qh1rgiug3wlq;1:1ixehgfjughgkhclnpohdphe;1:ohgwkm;1:1iq6kl8j9ah5cj0dfahgyjl2kjyrh5uiowgx;1:kio;2:3hc7hcagpbfpclveh2fgygipjgpkknlh7mltohdph0qgsrkhtimuhawjd;1:0im7ip8kc9ggagtdgeejxggthj5jlkphaqhfsivuhhwhc;1:1jq2iu3gy5j39h7fhcgimhg0jjzljooh7pl4qghrgashfuhfwgc;1:bk4ehc;3:ahdlikriu;1:6js;2:3gx4iu8jwdjnghcijbjhaljlpikqjargsuilwge;1:fhggk8jjzrj3whg;2:8h89h7ahdbgicgqdjjeojfiwglihh1rinugvwh4;1:6h8ahbkjqwjt;2:7mcaj4fhcghgqhgwj4;1:8jr;3:ijijjbrh3tjswh0;1:kj5;1:3h14hf5k26lv7it8fxch7dh8egrfhcijxkhbmjinhbojvpglqgjrixthgum5wh4;2:mh1nkf;2:alufhhgh7;2:2jtah7bh8jhfkjmsj2vj3;1:djv;2:8iuhiujiz;1:ej3ljvtiquj7wh6;3:aizgis;1:jij;2:ij0;1:fj2;2:bjf;2:gjijjn;1:jkpsjywh2;1:8gc9jwjgomkdqhdrmuvhdwir;2:5l5ahdbhcjjaqhesiqtjd;1:fkg;1:pgtwkz;1:pj0;1:6thdhaeh7jgpmh7rhgsh4tj8uh4vixwg7;4:ak7djveh5khf;1:jit;1:cj3;2:rin;2:ah2fgqgkp;1:8j5gk5jhbpjerhb;4:ekw;1:aikpjytj9;3:gikwk2;1:oj7;1:8j7;2:8ja;1:0ki1hf3h74m18gx9kgbiuej4fipgirjh1kh4lhgmhgph2qhfuh4wgo;1:ohfpj8;1:1k6;1:cjbggq;1:8iowk0;1:3jaagwck8jluoheqkawes;1:bhfgixrjf;1:0h88ktgjojh7;1:khgllxnhc;1:rlm;3:jiz;1:6h88hcak3dj7eh1fhemggnhcpl1uj9vkt;1:1gdbjnclsggujhdpjrrkawhg;2:0lb1g34hfnil;3:cj2niq;2:9jwcgr;1:5jg8j89hgjhdohcqhgrk3sjutj8wh8;1:9hcqjk;1:1isgjcqhh;3:9j9;2:8grjiswkk;1:bjbch2oj8;1:qj5;1:wjo;1:lik;1:6kowgy;1:kjfwj7;1:ql8whb;2:hkc;1:jhgtja;1:jiq;1:1h8bgjcl7qhfrmc;1:0jg1h0uj1;4:iil;2:uhfviy;3:ail;1:oj4;2:3isuj2;2:8h29ka;2:uja;1:jhdpl9;1:gjg;2:8gc9iwamsbh9chfdj8egpggljh3rj9sle;1:8it9hb;1:ojn;2:5j27ldpimqhfwhe;3:8gq9ipal8gh8;1:8frwku;1:wj3;1:0iz1is8haahefhbggjjhekirnj2oinqk9vivwio;1:gj3;1:bhdmje;2:birgix;1:3hf7mofjekk1mghrgitgpwiy;1:6ha7iw9jejh8phfqn6wgt;2:djgehehj8ojm;2:6jdlkyrikwh9;1:0hd1hb3h84ij5hc6ha7gv8lr9gdakybgmcgrde4ej9fitggrjfwklrlinmixokhph5qgdrj3sh6ul0vixwg1;2:ghfqim;1:jiy;3:fis;2:jj3lkjnhg;3:8iygik;1:ejx;1:ahfdj9egwjgjqjoujl;1:8h2dliejd;1:uj2;1:fj9;1:gixwir;2:1ildj2ugmvk1;1:gkb;2:0h53hh4gr8jg9l1ajcbj2cikdk1ggmhhhij0kgirjusk8tgfuh2wg3;1:1hdrkk;1:7iu;1:8gwaj3jinrh9ujj;1:3h85jhdh1ejzjg0wmf;1:mkc;2:8j4cipfiv;2:8jlwhd;3:0fb3lv4ky6g0ehggl1qh7vgvwjh;1:6h48hg9hcdiueh4pltujyvis;1:1j9;2:8j1;1:1ke8hdbhbdinjhbkirqhhrlr;4:1h33j25hb6hg7he9h7akrckpfm0jgqmh3nhfoiuuh0vhfwgu;1:7hfgk9kh4ljg;2:rim;1:gkf;1:0ip5fl6h17kbghaqlowiy;3:dji;1:cm1rhcwk4;1:1h43hc6j58m19ekcfbfhhjipkh4mn5qh9rh0thguh5wlf;2:8j6jhckh0njo;2:jis;2:jij;1:hg9rk6tin;1:khgrjp;1:3j25hf7gw8ik9laahbbgick3elaggnihgjh5mjbth1uhdvhgwgq;1:cik;3:kip;1:chcoimql6;1:4ip8gc9kiahdbhacn1fgcrinwhf;1:2j28hg9il;1:3ix;1:0it1hb3h54h55im8iuah0bhadgyfo3givhhajgnkhglhdmjenheohapfqqjurgnsivtk6;1:7n69kwcgejj3qh7rhawgg;1:4k2wh8;2:2ikhjkjgmoit;2:1n93gt4kh5hd6h47js8ip9j6ah5ihejgikg5lgsmgtojfpixqh0rg7sh8tiruhgvhc;1:3kpfjeghdjhdniutjrwgq;5:wka;2:hj9;1:7j0;1:6juaio;1:5hajhdwl5;1:egqfjf;3:0m71jb3km4h87hc8iobgighaih9jh0kgrohgqgwwms;3:8gmjhgkhfvn1wh0;1:1hg2k43gy5hf6gm7gw9h9fh9il3kh3lh7mhfniroh6pgzqh4rglsm3th9uirvpaweq;3:6l9tjv;1:jjfvit;1:cix;1:8ijaheqis;1:8lt9hdbhhrj6siyuh9;2:chfmjhrkiwhc;2:1joljwqiywhf;5:0h48ioiljsj8wg3;1:6jwphg;5:5lq8h9gkdjhfwhf;2:jkbph9;1:wim;2:6hauinvir;2:dg2elufhghkblhgrhcuk1;1:ejx;1:pm9wgg;1:5iy9hgckqdgkekjgh9jgzlh3nh3pm8qkbrhhthfwgi;3:2jp;1:jj2;3:0h53h95k07h98hb9mubgwch1dmkegwgkehjojh9khcph8qh5rggthf;1:ghfjixoimphh;1:aisbhbcim;2:0hf1gq3m64k36h89gjbk0chgdhfghchhgjg3kh1mheph4qg6rjkummwiv;3:5jbbja;2:kh3plxwhe;2:8jcbhb;2:liy;1:aj8;1:jk5ljepjz;1:4gxah7fhekhdnjxom2wjx;1:jj1qk2whe;2:2j88he9jjaivchhlilmixohfqgvrjcshgwj4;3:2jdbhggjcnj7riswh1;1:8jqajqbk7civeh4fhgkjinherguwgy;1:8j99h8bjvciygkhrhhsj4wgm;1:jhepiwqk6win;1:qiqwjd;2:aiw;4:uj3;3:3j2jheok7rjf;1:7itah5rkxsh8;1:ej6;2:7iqbhbkjqwil;1:8gd9laah9ch8fj6hkqrkougvvhg;1:mjk;1:eimjis;1:0kk1hg3h74m68h19khej5fisgiujh5kh4lhhoh5phbuh4wh1;2:6kgbkldirehdfh9wgu;2:fiv;1:8h8pj4rlbwhf;1:8heagnbgkflmghfkjslfwokbph3rlvwhe;2:4j6;2:pj5;2:6ix7h68isahgbhccgldj3efkghfjkrohhqk9rk2shftiyvhcwjh;1:wjo;2:0jb2hc3h64im5nc7h98ip9ilagibilcinehffgagkohjqjgikheniophgqgquhawfh;1:1h78jm9khahabn4ch4egzhgyjharj5wgp;1:2iksiv;2:6kiwhe;1:0gt1ko2hf3h84ik6h97hd8hd9kjahdbh9cgnghejk7klclh9mh7nheph3qh8ujvvj7wgp;1:aivcjfggrhj3;1:2md4h47h68jyaj2bgmghgjgomiuokxphbqh5rhcwgt;2:1iyrhd;1:ak9bhe;1:jj7;2:6j0oizphhvhc;1:3hc9gydkiel7fjrwgy;2:3jr7gw9gyilwjh5kkbogbpluqh8;3:0h33gu4hciqfriwsimwha;1:tkn;1:0it;1:5il8iuhh9jherj7sgpukd;1:1jo3h54h96jt7hcagobhbckvdeuflcglvhhfjjbkj5ljkmhenhfph7qgjrfjugu;1:0ji3h6ik5;1:bh2cja;1:8h89j2jgxkiuqjfuiy;4:4l16h9jgvogzph9qh2tjxuh9vjowk3;1:oix;2:chgrit;1:1gyejoikx;2:einfiz;1:ghehiy;1:fiqtis;1:tiy;1:8iv;2:0h63h74k26gq7j09h4ahbbh4chedlgem7flfggyihhjgkph9shgtgzuiq;2:djeehchioniu;1:fh5rjq;3:2gu3ik4kb5jc7jf8go9hbagick0eh7fk0gj5hgxik2jgdkh7lhcph3tivuh4;2:2isoixpjtwiy;1:vio;1:jir;1:3io;2:jjjwha;2:9ikhiwjhhnju;1:1kr;1:3jljip;1:1kg;2:0h02ha3j64hb5h66h97gw8lj9lgah6bfeck0elzggvhiojgvkh4mhdph6qizrj9thgvh7wgt;2:5od6hf7h38gp9h2bk4ch8dhdeimfj0gjijh4khgph5qj1thbuhfwgr;1:0j1djbeiwkh4lj1;2:pjb;1:5jkalkbhfch8fh9gh9jg3kh3nk5rilwjs;3:cirjjprhc;1:4haeioiivpj3;1:1g23he4hg5j86m47j5ah6ghgjgakhclj2mhfnjbph0qh9rh7thfug2vnywju;1:1h12h94ip5iw6ix7iw9ldeixfhaggbhghigxjgokhalh9mk3nh5ojkpggtkvuk1vhawg0;1:8j09hbwkf;1:rja;1:8iv9gvbj1;2:hgprk6wkq;1:qil;2:fhcgke;2:ain;3:8hg9ixeivgh8sistj7uha;2:5gj9hcagmehaggwhokjjbphcqjvuj6viowha;1:fmcphfqiy;1:8im;1:wiq;1:jj7ogzpjf;2:ahfbjilggmmwnhdphe;1:ahbfj8rhcsj1;3:ijplh8wka;1:8ja;1:bk6cgx;3:1j92k33mj4hg7jq8h09inaheehcjjlohdphcqjnrh6uhdvhewe6;1:cio;1:2ikbitej7rhb;3:1kqfis;1:1kegixjjpqh2;1:oh8qkx;1:gix;2:0j9;1:8fl9m5ah7bjcdj1;1:3jfej2rh8;1:0j31in6im8hewj1;2:ajibh4flh;1:jj8;2:ghcjje;1:1gv3h87m48l1kh4lilpiqqh3th9wil;1:8iphj5liorh9;1:3k47ge8im9iyafugkdhgnjlgniqqj5sh7uhg;1:1gvgk5kijrh8;1:3jb5iuairsj8;4:viy;1:hgorji;1:jgzql8;1:sit;1:1h9mmsrgq;1:bj9rjkvj7wh7;1:fhfuk0;2:bjeghfmmqpizrgxwgq;1:8iubktdhbfjhghgkj1nh6qj2whc;1:8jc9h4aiwdhafirphhrhgwm2;1:cgwjj7;1:siu;1:hhctj0;1:3kgaj2dj7egyikljh5qhcrhdwhe;2:ahcjjx;1:1iseipfjphkougw;2:kh9ohapky;1:0ha1j82hh4hb5iu6h5al7bfycjbdh4eiwgiwjk6lhfohdpgushauh9;1:wkb;2:riruin;1:cit;1:ah6jhbpkfsk1wgu;3:6iv8ep9m1chediqej7fhfghaljbrimtjduh6vk8wgi;1:7hfbkydj1khdmkyphgwgj;1:0hc1ge3gw4hg5hg6ha7h68iq9grakvbg7ckzdmaefxfg9gm6hjfjfllh7nhapgzrlusgmug3wk3;1:5jg9ix;3:0iz1ke3jn4hb6h7jgvlj7ohbpkoqh6vhfwj4;1:cimpjd;1:rjg;1:tinwj1;1:hjrrgb;2:ejr;1:2jy3k35hc6ip8h8agzeh9gheih5jhfmhbnh5oitpiyvimwil;1:sjo;1:0hg1h03k2aj7ggx;2:7jujhblj6oh8rh0wkn;1:gij;1:1ln7jv8hh9hfagqehffhdgjrjfpqm4rgqwix;1:4jv9isafnbjyck6;3:pipriq;1:jik;2:4oe6hagikijtjh9pgvqhauiowh1;3:fhfhk5jgxrfxthcumx;1:0hf1gi3h34iy5hd7h58il9ilaflbfyejhfh7gmahkrihflh6nhbogjpirqglrivsm0vgs;1:0gy3js8j3jj4qh5;1:0hc2kg3j66he7m48hedipjhbqhfrh7;2:7j0bhglj1;1:6itek2jgzoj9qhfuj3vh3;1:3io;1:0it4kn5ir8gybhhej9fj6ghfjlbqhargmsipthfwgw;1:8kdajxfgi;1:0lh1lk4j78j5bgxck0fh4ggqhj1jhekh5mhgohgrgzuh8wgo;1:jkusjd;2:5iwjh4qjjwj3;1:8hfrldthb;1:wjo;1:jkf;1:fk0lh9nisrk2;1:1gq4gw9jbcgjdgwek3gh2hkjij2jh8kh1ljvmhenh1oj5piyrixshetj6uiowio;1:gkhjhetj5;1:3noffpgjahj3whf;1:3ha6jq7h79haalfbh7gkphlfjfxlhbmjnoh5ph1qgwsglth7ugzvh8wlj;1:0he1gk2h53gv7iz8hc9kxbjwchhdkleipgh5ihdjiqkg3mh3nhaoh9phbrghsjjtjmuj7vgk;1:jik;1:hir;1:8fx9kv;2:jitnj2whf;1:rk0;1:8hhbji;1:mkxwhe;1:8il;3:8ix;2:gh6jkyrir;1:jim;1:0h61hc3he4h96hh7j78gq9gkbh8chadt1elkggkjhfkj2lh9mhcph6qh6th3uh5vikwg5;2:3jg8mk9g4aipbg7ciodk9ehchhcqk7rh2th7;1:8jq;1:vj2;1:0he1h92lx4hc7io9haaglbhddizehegklhfyjjinhfogvqh4rlgtj3uhdwhh;2:ehcfgsgn7hixuhd;2:dizehcgjo;1:8hd9itwj0;1:aik;1:jk6sgz;2:jk2oha;1:8j19j5dijehe;3:0im1il3is5iq9h4chgfj9ghgjhbkhduikwh6;2:siu;3:4he6hg7m8jhepguqgztjswn2;1:7jvhippjc;2:9j0wio;1:kj9wha;1:8kh9gych6;1:5it;1:fit;2:0im3iqaitfh7kjx;1:1j82ir3kh5jt6h77h88gy9gvahbbgucisdh7fjlggkhipjjrlh9mh4pggqjkuh0vhawhf;1:7jt8izdikhhewjf;1:pio;1:biy;4:1hcqkouis;1:djaghfwk9;1:9j1bj7ditegp;1:cgpjlznjpwh9;4:6ik8iobizwin;1:jivqj5;1:hh4rix;1:3jlbj6khfwh8;3:8ijejprjo;2:0it;1:6o0jh9ohcph8qhbrhdukrvklwg5;1:8j09mxbggcgpdhdfgugijhghjgokhclgxpj5qh5rp0thdujhwg8;2:8jdfin;2:4jfjj4nin;2:3he6pj8ik9fuemiqheuh0vg3wfp;3:ah4eikfh3kjgokhthhwin;3:pk2;1:aix;3:djoegmfjduk1;1:fio;1:bj6jjarhc;1:9j5;2:8iq;1:diyhiq;1:3im;2:fj8hkxugx;2:pk7;1:2im;1:5im;4:hjb;2:diyehc;1:ais;2:2j83hf;2:0ke;1:5ir8il;3:6hheizfh4gj0jj8qlgwgv;1:3ha4ha5hc6s48h3bincj0dh9eh3ghejg7khfmh6ojtqh8rh3sh3tj3uh1vitwik;7:1ixeh9fh9sjruk7vik;2:kinuja;2:gikqltwjb;1:wjq;1:0kk6hdbh5wjq;4:bkgjgsqjorh4;1:1h13imalyfh1ghahkwiivjhfqgzwgp;1:1ip2pb4gu6hf7lnajgbkmcfxggthgzihfjgwkhelhbogjpguqgbrkwwf7;2:4l25j1dilph0wha;2:aj4;2:jinkix;1:0ha1gt2hh3jl4im5hg6h98jq9mcajpbkidh2egrfh7ggrhh4ihejg8kiplhcmh8pgwrj6sh8uk3wgu;1:sjc;2:nggpjl;1:pk4qj6wh5;2:piq;1:8jtahcoj7uji;3:8hbbk9dheehgfl7ggahj9lh9ngxshetko;1:4lw8l1chbpinrhewhf;2:8io;1:0jj;1:ck1oj8wjr;1:3isolhpfpwj7;1:6hdjnrqguwhd;1:5jxpjt;2:8j39k2ak7bkmcjseh0fghghgjhfkj5nherh5wh4;4:dhffh7hjskiomhauln;2:5j78imlkn;3:gjrhh7mjosimuhcwiy;2:2lhjhb;3:gh2ilbrj1;1:tiy;2:kiz;2:wj7;1:8ixchckg4lmrrh6uilvk9wha;2:rir;2:7j1whc;1:kjdlh9nhdpk4;1:ahdrjt;1:3jd;1:ajofhajij;1:tki;1:8g59khajvbhfcjhpjnqhdsirthd;1:plpwhe;2:0md6hawh8;1:dlzegtfhfjhc;3:9jrlionjyrgc;2:bjxcj7rhh;2:3hb7is8j89fraj0bh5cgvdj9einfiygethkcjl3kh3nhgoh2pgrqm6rgpsijugs;1:niv;2:rjjwik;1:lit;1:3ik;1:7jc9ip;1:fg1hh6jl8rka;1:0j31kk9h8dinjh3wlf;1:qkrsgr;1:6iw;1:qjc;2:3iu;1:8jk9hdaheghdrioujp;1:0jjvj9;1:7je;1:ojiuiy;2:6habjhviy;1:8fwbjgcjafj6wki;1:8j1;1:qiy;1:rip;1:chefjfik8mhepisrh2tiw;1:3m4;1:8il;1:hkerhd;3:5hg6hc8hbakvbhgciqfhbjhekgfmjpphbrkwsmuuh9wga;1:ghbqj6;1:5jt8ji9hejhcohbqherk2sk1tj6wh6;1:8iu9h3ej2gis;1:1kj2jx7mydjgegthhfjhdoheqhbrhcvjiwgr;3:hiz;1:1jw2hh3h67h18ij9g8ajjbl6dgefk6gh0hgojgikktlm2mhgoimqgorhgth1uhevhcwgn;1:djnehh;4:8ha9ijagedj9fjwoirsil;2:jk7wik;1:vix;1:aikcj2;1:1je8gweikggvhgmrj0tmnuis;1:0h63hf5in9h3ag1dh3eilfjtgiojirqhftkwwli;1:1h57hcahdbl4cj3fh9gk3hiqjghkh4lh9ml1nk6piwqherh4thfuh4wgw;2:5ipeiyjhhqjm;1:8iy9h4bheeh6fhfghcihajh6mklqjfrk1sj2wj5;1:oik;2:9im;1:aj3fithilnh4pipwk3;1:bjghjxrh4th4;1:9gkajy;1:1h23gz5he9glbk5ckndh8eiwfg7hjtjivkk1miwnhfohbph3rltshduh5vhcwf4;2:2lc3h74ir5hf8h2airfhbij3jjlkionj6qhgrh8whd;1:7ipjhbqjo;1:ajgghg;1:8isplcwiy;3:0k9giqklllhfnhdohephhwhf;1:ggjhk5;1:8jmch4;1:fiwoiy;1:ahgbkvch1dhgef1fkdghfhh9ij3jh9sjawkm;1:8j09hguiyvj1;2:egqfjfsil;1:0ki9k5eh0;2:5jvhir;1:hj6jh9;1:1l8;1:0ipdik;1:djcuiwvix;1:1jo7j9ciu;1:sj4;2:ajd;1:cj5jiu;1:4ir8gzjk5rim;3:uiv;1:mjw;2:ej2;1:liu;2:eim;1:jktqhgthg;3:8iv;1:fj4;3:1h98h9ah4blgfh7gj1jh0kiqlj7qimrk9wj1;2:aiqjjowhc;1:dhceip;1:dilejajjaqh2vhc;2:0mp1jf3h14gjbhcclsdhgghdihcjfrkjblh5oheph1qh6wgx;2:jjftk2wiy;1:9jgdh5uhfvjk;1:njs;1:ciw;2:8h7jjzrhhujjwjg;1:6kn8jbah5cj2dfcfimjipkk1lhgwh8;1:1gy3ju;1:jinwjb;3:3iu;5:8io9hdjio;2:8hd9iw;3:1iw;1:3hg4h66ir7gz9gpbhbchcdfkfovgiqhhfigyjktkhfpguqjfrjmthdvkqwfv;1:0ji;1:2j93h24kiuhd;1:9ilagvbko;1:6k28hfeijviw;3:fl7jilrjlwhe;1:rir;2:8hd9ipcj2;2:1gxahbbizgikhhdrmb;1:sjh;1:cj9pix;2:jjn;1:hj6kh8njzphfrgw;2:nitqg4wlu;1:tjvwh8;3:ajfcgr;2:8ko9g6bgzch3fl4hirrhdthauh8wl1;1:cilhhg;2:2jf;1:8jc9hd;1:djnehh;5:3j47io9ixagybhaciodioegqfkbjjumh3oh1pl6qh6wgd;1:rjb;1:0h43gv4h76ha7h09hcagabilcivdmjejjfg6gfjhkkjijkgumk2ng0ogxphaqglrkjslftjdugzvgswip;1:3ijfj0;3:tjn;1:8it9hb;1:9in;1:ogrpl5;1:dhhej0;1:agzfk3rjs;1:ej3kjtlgn;1:tin;1:1ggah8birchdhkcrmgwh9;1:4la8k89gswgu;2:4iyah6rjuwh8;2:0k31gb2hg7h68dh9jwagzbl2disekpfhcgjzjh2kgrljimh8nhfoiupgwqgcrk8shatitujmviswer;2:divehcjiw;1:tjvwha;1:1j29hfahdkjnlirrgkwkh;1:ij4;2:njctim;1:jivqj5;1:4he6j87hg8h5agockaghejgvkhglhhnj6qjcrikthcuj9wjd;1:fiwij3;3:aik;1:gkfuhd;2:8jy9h6jhc;3:tj5;1:biw;1:ojzphgrjf;1:ij2;2:8jvahdujk;1:8gujl7;1:vjc;1:him;5:wiw;2:hhfrklwhe;1:2jc3h8;2:8is;2:ij1;1:8jh;1:vio;1:8hh9k4ah8;1:8irbhgchdjjfojdrjyskhwgo;2:2iz7jiajqch7jjmsh0;1:7ipjhbqjo;1:fj0jitrjw;1:lkf;2:wir;2:3h85jp6nm7jq9hfah6bimfhbjfflhenjfpgqqh5thfugkvpswfv;4:0op6gr8j4jhgqhgwh3;1:8jy9h1cha;1:giyqil;1:bjeejrjh8qhgrh9tjnwio;5:eiysip;2:ril;3:2hc4lp8h59izag6bj4fikgjfhj1jgsphgqhasj1;3:8iljgvqj8rh9wkt;1:qj6;1:wiq;1:kjgwin;1:dhfeiz;1:4jpjitojoph9;1:ohfpiz;2:1ivsik;2:1gw3gh4gb5h47gc9guaivbgodhafh7giwir3jkjlhemhfnjboh7pj5qipvhgwep;1:6n67g3wgq;3:oilwit;2:6ks9jcbhdjh9nk9ph7qh4sintju;3:iix;3:hh0rjd;1:0jj6j9dgyej4jgkphbqhgvl2wj1;1:jjbplnwh8;2:pj9;1:4ju8habjpjhgrhf;1:jhftkn;1:aj5qissh7;4:qik;1:ohcqjb;1:4in9ipfixjjr;1:8ijdguhjq;2:oiq;2:9l6dhbrhftir;2:khdnjarivwj6;1:7iqjiuwip;1:hjfjl2oh9;2:5jg;1:bh6ej3kjqriu;1:0il1ji2ip6gy7hf8h7agvbg1chcdg9eh1fj3gj1hgrkkllhbmj1okwqh2rfuth5ukpvkx;3:6k58jc9h8;2:jin;1:qj8;1:0h61il3hf4jx6h8ehcgj6jiwmhbolmphaqgzrgouhbwkn;1:8hesjw;1:1hb3ha4hc5iq6hh7iz8ip9goakzeh5fh4gh3jmfmhdnh0phaqlvrh8shbthhvha;3:fik;1:6lieh9fj5qhgshavguwjm;1:ak1;1:jh3qkp;1:8kv9gwbhachbejofhbhjikim;1:3jf9h6rir;1:7hfagvbjfphaqnvwfz;1:aiukil;4:ajcgiljh9wiu;1:8h89hbbkmej2jgiqinwkl;1:ij8;1:5j68j19gpjgfmh8nknwk4;1:tkp;1:0k0ghgjhbmhgoivphfqjdtjjwjv;1:sjr;3:2jm6j2;1:3h28j0agmbh7ck0egffh8gjchh9jkdph5shhthgugfvjdwmc;2:0ha1h96hc8ix9ixehgggkihdjizkgjlhemh7nimoilriqsj0th9ukiwiq;3:3h64hh9gtaj4bh1cj0gl9hkdij2khaoiuphhqkqrgssgnthewgt;2:rjwwh0;1:fiw;1:ljg;3:7j0ehajjpqiprhewgn;1:5iu8h7gkqhhgkhbmj7;4:ajl;1:jik;1:3hf6l07hg8k29jrajzbl9ch3dkqejjffiggijgpkh3mhfphfqh4thbvjlwfz;1:ahekjp;5:dit;1:bhegimjhfkhglinmm7phf;2:aiu;1:1lf2fojhcogxql0;3:8hgak9bhbchdfhaghgjh5riksk7tk3uhewjb;3:8h9aijkjn;1:1hd7he9h1al6ehcfh6gnzhg4igujlamhgrgvuh8wl2;3:2ivniooinwh8;1:4ivnjkoinrhb;1:8kq;1:jj2rhb;3:8jo9isbh3wjx;1:jkyqjkwh1;1:wjo;1:dk4egc;2:1gwejoikvpjkwhb;1:pjb;2:2ji7hc8h09inchdgnhwhg;1:1h92hc3in4h85jd6h78h29ggchfdgpfmugjihj7ijfjinkgblh8mh4nheoh3pgkqkfristkxvivwec;1:6iw;1:8j9gfqhke;1:uin;1:6h88h9gh9jh7kh6lkqnkcoj7qhdrj0uhgvnrwgd;2:1ixbjc;2:8gibj1fjnggsiljjkfwgz;1:1jz;1:8j6aio;1:1hh2hc6hg7h68io9jyajfcipdk1fhgjhfnhbqh1rheujrvijwgu;2:8it;1:ph9wk8;2:8hbwku;1:aimim2uhfwhd;1:1he3hb4hc7ha9gfbn2ck9egwfj0ggvhh7jgxkjmlm6ogppgzqgwrjsthauhe;1:wj3;1:8in9hg;1:6hb9hdcixehffiogk4hirjjrnhgqgzrh9sjethewjc;2:8ik;1:kka;1:8h5kj4;4:fhfgpoih6jgrrhfwh5;1:jjsqij;1:ailojl;3:ciwnkvrkowh3;2:ahcehffkh;1:3h15k06h67he8j69j5ag6bj5ch6ghbhhakhbmitnhbomkpgyrkssh6tgswin;1:4iqaj2fgzghfnhbogypq3wgz;1:niq;1:tjd;2:uj3;1:0iw1it3is8hbaiqbh3fhahlckh6lixrh3th7;1:5k4;1:2h43jl6gf7mkwgv;1:6hdjnfkiophbwgd;1:0j33hhwj0;1:wiv;2:fj1;1:rhduipwjj;1:gj3jhb;1:tl6uhc;2:ah7eijrjywhb;2:8kl9gxdj2eikhhhoh8pjbuhg;2:jilwio;2:ail;1:6hh7gs8hg9hbah5bh9gh5hjwjfmkgunufoilpmiqh6thfuh5wf5;2:9kiagzegyfh7gjxljdqjqrguuirwhd;1:8kebk6dgzggxiitthgwju;1:djwegx;1:rfkwlv;2:2iw3hb4h36h47h0dh5ejhgguhjbjgwkimlgzmksogtrjstjcwgc;1:ej9;1:8gy9j7jlmkinrirwh5;2:1hf3hd7gr8io9jxamhbjhehcfgbggvhh1jiukh1phgqiwrj4sjethbukuwg2;1:1he3hd4lw6jb7hf8hbbgxcimegrfhhglsih3jhakh9lhgmheohbphaqgprkatkjuh8vikwgf;1:0kgwhd;1:8hc9iy;1:9h6bjtggcjjfkheqjk;1:1h22j54h47j39ikajlbjgch3dirjj3kjalhfnh2oh7phaqh2rj5sh8theuh3vixwh6;1:hfzrjntjz;2:efyfk1wk0;1:cj2;2:hhbrjh;3:8h59gxbkocgxflpggmhiuqk7wgy;1:jk4uiz;2:0hf1hg3gl6hd7ha8h89h4ak4bh6cjmfgngjhhioigbjlckhglk1nh3ohdpl3qgssinujhvh2wha;6:ag0bjprkwtkzwha;1:jij;2:0iu;1:tjh;1:9k9bhgeh6jgokmrqk4whf;1:bit;1:ckhpj8rha;3:8hg9iscjlfgz;1:hiosir;1:uiswjz;1:1hg8hb9j4ch7fijghejj3rkfwhf;1:pk5;4:4k68gf9fzbhbcjadixej8fjlghbkh8ok1pgzrg6tonugxwh4;1:dil;1:9j3hip;1:9is;1:4ixwjm;1:8ilqiw;2:fhcujl;3:sjf;2:8k7hgwjhgqisril;1:7hh8h39j6gj4jhdqk4wip;1:oj4;1:0hf8iwbk9jjirgywh4;1:biq;2:wiq;2:0hg2k53h14he6hg7h98haagubiwcjedkcejcfjrhh5kgplh8og3pl4qh4rjesh9tiqvhb;1:ahcdhhfk1ggbjk9ujxvikwhf;1:3jl;1:cjq;1:4j8civehgfintjpwhg;1:gjgtir;1:5hdagoejefj1ggwhgtjheshaunnvjqwhb;1:jjupjdwh4;2:8h19hgah6bj4cq1fgzghfhgmjixrh3wjz;1:ehgfllpio;1:8ja9gsgit;1:3hdjj8vja;1:6kqph5;2:2lhjhb;1:gij;1:6h8vj0;1:4jjbhggikrjawhh;3:8h59jp;1:1gz3ha4hb6hg7he8gp9gvaj9bgvch6dmneggfgjhgjjgekiolh7nixojkpgmqj1rkvtkavhewjd;1:3k3;1:6jlnilvgm;1:glphirwhc;1:bkcciwfhajjmwhe;2:9h8bhggj8kh0nogwh3;1:2k26jrwhb;2:3jbmj2;1:4ivaji;1:8kjbgw;3:mklwhh;1:1h69kobhacgzdimfitjgzkk5mherj3tirvipwh9;2:ajycixdgxejufghgijhjgij1jh4qj8rghwhc;3:ajjvj2;1:akfkh9;2:1gyijrtlkwh5;1:bilgjohk2jimqilrguwj5;2:9iv;1:jh9sjo;1:4irciojjz;1:1ja5lhjhcrh5;2:9izwjz;1:8kb9gkair;1:4na6kjih7pgrqh4whh;2:bhhkjk;1:0hb1lb2ha3gp4gz5gy6gz7gu8gi9ffal8bkjck4dgjegtfl2hjsjgkklblh3mklngxoguqg8rkbshgtguugyvh1;1:8mx9jjbgudgxejifg7ghchjcqj7rlauh1vhgwh0;1:1iy4iq6h37h1ahgbgpdhggh7jgikl3ljymiwokzpinqgrrgduinwg6;6:1h73gx6in9ipapich4eh5fg2ggihhgjiqmh8nhbph2qh9smhtgzujevixwgc;2:0ip6jdcirlilrhevh3;1:2gu5je8d99ovahadhgsiyvkd;2:8hcbhfghhhitjiokjnmiqqiyrfrwmu;1:gggsjn;1:aj9gh2iji;1:4ir8j79j9cgqelpfhgghc;1:1j8rha;1:do2ed4;1:eiuhjw;2:ajgjip;1:limwin;1:ain;2:cf9tl2;2:5kehisjhgkjg;1:1kfphe;1:1h22hb3ja4gx6h87j38h09jyah9bizcmodhfeh8ggwhimkhcmhdph1rfktiyuhcvirwl0;4:pjy;3:vjvwik;1:2j58ha9iw;1:3o66hc9h8cikehbrgythfugavjnwlq;2:din;1:0md1ha3gr4gs8inagbbhheirfhegk3ikwjgxkhcniwpirsj4wgn;1:qit;1:jjc;1:8it9hd;1:1hb6it8gb9iqagqbh2cpdehdffnijcjj4kgonhaoheph5rlwthduhdwim;1:4il;1:2kx3h05hc6hg7hc8gzahgbh7dg6ekbfilggwhh8ijmjg8lhhmq8nfwoh1qh4rgpshatluuh6vhewin;1:bioijhpjkuj1;2:lis;1:qj0;1:0jiklolhfnhdohe;3:pjv;1:0h31h83lb4ha5hb6h57ha8fx9g0anibggcj7dg7egefr8gishkbkkylhfmhfoh2pgsqg4rgnsh7tgivh6wh8;1:0j0ajrdhdeiwfghgilmjdqjrrhawh7;1:jiu;3:8iohitjhellanhgwk5;2:6lhgiuwgh;3:3jejglwln;1:uhbvjm;5:5qhjg4qj7rhhwh0;2:dj9pj8;1:qk6;1:0k71hbhiwrhe;2:1j8gg7hhgjitkhengipk1qikrjcwk5;1:3hf4j86hh9l2aghbhbciyfiqghfhhgnjtokeph3rjowh2;1:1nq2hf3hd4hg8gi9h4ah5biscjgdgdfh8hjvkhdmjgohfqh8rmvugzvhbwhc;3:1in4il6he9hcdinkjruhgvk1whf;1:ojb;1:8hdgk7;1:0hc1jl3hg4he5h97iu8fs9gdah0bhddkbelrfh1gjwkgrllvnh3ok4pg8qh8uiwvh0wgs;1:din;2:8ilwit;2:wji;1:3jd9jaeikjn3ph7rhbwgm;1:3ha5ir6h77jz8jx9gsahgfivgikoj5ph6qguthguhfwls;1:1lf4j87he8hfbg4cksggbjjxqh6rlbwh7;2:ohepjz;1:ajr;2:qkawhe;3:4h36hc8gwdh5eh1ghehhaqhguq5vkqwhg;1:aiq;1:0k14hg8jlbhcdllegpfh5gh4jgplh5phgrj8sjouhfwkx;1:0ivkip;2:uij;2:kjx;2:ajrghf;1:oj2;1:iij;1:jizuk8vgh;1:4hd6j37jt8gl9gfahgdkgenffjxgk9jg8phcqh9vhcwhb;1:3jquh3;1:7hf8j3tkm;1:4ixjiywhg;1:7gu8hh9hbah3bktcjsegrflcjizkgzlhfmioohgqherguwjn;1:1gx2gp3gz4h48hgbk9ch3gjoikhkgflgrmhhnkjol8pj6qjktheuhcwh1;1:uiz;1:7iv9h7uk5;3:1il3he8jm9irchedineggfj3mjfwh0;2:jjg;1:bhbkhalimmltwhe;2:bjggiqkfxnk6whg;1:aj3iiyjjzrhdwhc;2:0h83ha4jm7hh9hbcj7ghhkk7niroh6phfqjfrj0thgvh2;2:rllwhh;1:2hg3jg8k29m8ah2bhdchedhcegrfhdghgjizrkftjjuh3wgk;1:3he7hd8ix9h8aj5bh3cjidivfhggjfjixqh2rg8sheuivwl7;1:3jmgj9;3:eiqpkx;1:wku;3:aiu;2:fiu;1:ak1dhgfj2mjbnimuhg;2:fje;1:7ijjio;1:1jr8kx9geak6bh8chdfgkgj6ijikganilohbpgwwlv;1:hkarhf;1:gjh;1:3h0djvegpjm1wgq;1:8h6agwehcfl9gkfwh7;1:0ipghgmhgoirqjhtk3wj4;1:hj3uhe;3:3hf7hbah8bh5dh7eh9fjxgh0jlioheqh6rh6smmulkwga;1:3q09h9cj5jh5lhgmj1rjzvhgwef;2:din;1:dim;2:2j2;2:6jc;1:3jz;4:giloil;1:1itrha;2:3h96n77hhhioiiwjhekh7nkopjwqh4rh5tg9wgp;2:tip;1:1isjgdom9qk3;1:fjo;1:dhaej1rj4;1:ehdhhgjh8kipmgsshdtpt;1:bhecjdkjgnjqwhd;1:0khwhg;3:3izcizjjr;1:pk1rimwhf;1:fiygh6ijsoil;1:dhdejffhfgjhwh9;2:2kiqmewgz;2:0hb3j94jb8gm9jyah4jgyqkprh8tj4;1:8jpkk1sit;1:0gr1k02gc3gn5hf6gm7gw9ftbgkdgrfgohh3jfwkobliymlxnm2olyplfqgereptghuinvimwfv;2:4itchgfin;1:fhgrjx;1:uit;1:1kbkgy;1:2im9ikdhgfiyggykh7mhcohgplkrhfsj0thcuh6;1:8iz9hgeiypje;1:pj6;2:pip;1:7ikehefj0jizkj6lhcqhfrhd;1:7g48iwbiqwkc;1:bk0;1:3iv;1:0gs1h03h64h86h77h19gpag6biwcmfdplefyfgogfihgsjk8kgglgsmgpngxohdpiqqgbrkoslotkkug4vip;3:dimejpghd;1:win;3:wj6;1:pix;2:4iw9j8;1:jiu;1:0j9;1:6hgaj4plrqh0rhfwh3;3:8ku9jyaggbgwdghek1flkggthh0jgvkhcpiqth6uji;1:2h53js6ge7malj5ph7wgq;1:cir;1:aipchgggqhisiixnikrg2uimviswk4;1:ch8ehaffsgl6hj2rfhskaujzwke;2:4j77hd9h4ciyegzfh3ggqhl9jgvpkaqkfrk1shatheuhe;1:ijdoguplbwh8;1:8jo9geehbfj9hj0ljorh6;1:tj2;4:dji;2:7hg8habhfcisdjcehfglhhfmjktqhcrks;1:5iz;3:0ha1gc3j54hh5h99jobh8ekwfhaghehgmkhelhemktph9riosjithfugy;2:1hf7l38iw9jyajsbkbcjeegzfgpghcjirkiumhfnhephhqhhrgxthewgs;2:8hbej9kjjuh8;3:0jd5irggurlxwgu;1:hjajiv;1:0h41h92h33il4ha7ix8in9kdagzdjnejffgoggwhhhjiokh1phbqiysim;3:8gp9inaiy;2:7gv9ikafueikfmlgl0ok3phesguuijwha;4:9ikbiw;1:gj4;2:0gn3he4h55he6lj8mt9gzajebhbcjqfh7gh5hj3im1khfoh8phbrflsghthdvh9;1:fk7;2:2iv8hbcjxjiswhd;2:9iu;1:8jjohh;2:dj1;1:dikiislkc;1:9io;1:1lych7jh8rlkwh9;2:aiu;2:wik;1:jis;3:8il;2:0iz8j4gjv;1:tmawiq;3:biwcj0rgl;1:8j09jsajrbkwcjkeh0fgrghgkj1nhfrh5wh8;1:cjl;1:8mf9h7wgt;2:8jb9h8;2:kik;1:jgtmj5wjd;3:8lv9f9fivhin;1:0ga3m46hfjk9qiqrh1wkm;1:ujbwix;2:kiv;2:5iwuin;2:qin;2:aj6;1:2in3ikdhgghejh5ninpkysj2uhbwir;1:jis;1:tiq;2:cgujkn;1:1h73hg6h67hf8j8ah7bhgdfoejzfk4hk7jgukjblk0mhdoisph4qherjpwgd;1:7jugiqjheoiywhg;1:3gt4iy6kv8h8hh5jippheqinrh7tkyvk9wfs;1:3hc6ks7k58h2fikjhcoh0qh7rh4uj2wm5;1:wjn;1:jiz;5:3hg7l0;2:8h2bj5ch9qhgtm2;1:ej3;1:8he9im;1:wiu;1:vis;1:fit;2:8lc9gzainbhdcgwej4fh3ghhhj3jhepk2ujh;1:uis;1:0kj3fi8kb9foalxbk3eh2gk6jh2qiprh6shhthhuhbwgs;2:hjj;1:2ikbkcgiyrh4;1:giktij;1:mjn;3:4ks5h9ahgjgbqkg;2:ij8;2:6ja8j4whg;1:aiktje;1:giysir;1:hja;1:1hh4he5gp6h87g49gyakvbiocj1dhgehbflegiohilih3jkdkgilhbmhbnh7ohcqitrjbtl1wey;1:2ff3jd4ik6he7m69j7ah9ihgjivuijwgm;1:jim;1:aizbkxcjxdhbeirggukj4pjdqjdrfm;1:iiv;1:8gb9jbahcbiuckjdhfej0;1:vj1;2:oh5qjc;1:1iw8jhmjfrh7wha;1:qjr;2:nim;2:3j24io5il8h7ehdjjjqjrwgt;4:kikljknjrphfrg3ujx;1:qkvwhe;1:9kp;2:cj9;2:eit;1:kecmmu;1:ejnjix;1:1jg;2:0khwhb;2:hiwpli;1:jiw;1:mjasim;1:binvj1;1:ogypjn;1:aiyfj1;1:pix;1:0hd2he4npaj0bk5cglggdhhdjh6kjzohfphgth9wh5;1:7hg8iydhdehcjl7oitqizrgbsjeuhcwiy;1:giphhgjiysj2;2:nim;2:civrheug5vk2;1:2im3hh8h19inahgbgzgghikhjkbqjrrh1sjdtixwh7;2:9izahfdhhfjvjiw;1:9j7ehctk2;1:4j2;1:7hfeijgka;5:8fe9mdagxbjbdj1;1:8gs9jc;1:6iy;1:1j38h59gjah5bgufhggjjjgjklqlh9mltph3qharjowki;1:4hg8n09nobfrek3hhbph9qjarh4tguuh8wgc;4:3it;1:sizwis;3:tip;2:6it;3:ajzfh4khf;1:pkqwhg;1:6kpliurgyvgfwhd;4:jjz;2:5ip;1:9j1;2:4j3wiw;2:8gl9hgeizwkb;2:6kc9hfchgjgskhfqhfrh7sn1wip;1:cio;1:lil;1:jjnsh3;4:5j96hdqkf;3:civ;1:8hddmgeedfjx;1:7ip;2:8k59h9;1:2jc;1:gjrhk6jitqivrh1wgy;1:bjocjm;1:bimpix;1:1ja8h59iocitfh5jhfkjbnjjrh2;1:4qh6h8oj3ph4qhguhbwh4;1:0k11gzej4ghghirkjfrhh;1:0jm;3:5iobjj;1:eimwjh;1:8j89h3fj2;1:ah7fjy;1:8il9j2ahcbh2cmueh6fhcghfqhcrjftj6whc;2:qjwrj6wh9;1:0j03h3riwwhb;2:9ij;2:ahcjh7rlo;3:0j4;1:dinuinwjf;2:9j4bjndijehewh7;1:4lm8hcgjvqhgwh1;2:kkpljb;2:3iu5im9h1bk2cgqqjarhbtjawj4;2:wje;1:9l2;1:0kx1ljkhdwgz;1:0l81h72hf3ir4gh7h69iraiwch4fj4hjbigrjjrnj2qgerjetgr;1:9ipuggvk4;3:lk5nh8;3:qit;1:vis;1:sj7;2:aj2fhdrk3;2:bjxch9khgtk0;2:ujh;1:0io4he5hdbh2chgdh6hj0ihajiqkhdnj8oj3pkdqh5rilth1vha;2:9iz;4:qj1ujm;1:8he9hfajrej8fh5hh4jjyliopisqjpsgpthc;1:7j1diwgjewhg;1:qitrisshg;1:9iwkke;2:4ikahbfhbgkolh0rkc;1:ojd;2:gj5jhb;1:1ivrjm;1:0he4jhdkhefx;2:wiq;1:8iq9hcekt;1:ciyqjrwhd;1:jjhwha;1:fio;1:1in2iw5hc6h37h28jx9hgaiqch2ehbfhdgguihgjjukjolhdnguojvpjirh9sjmwg3;2:8klailbhbfjbthd;1:pjw;1:jh8rh6wmy;1:6ha9kcah3bh5cjpfj1jjhrh5simuivviowgl;1:bjj;1:biz;2:0hg2hd3gx8p29jrbkhdgmehbfguiisjh8kl6lgkmhgnhcoh9ph5qgyrgztgjuiywgk;1:ekygh0;1:9j0;2:8gjol0pheum2;2:0hg1h57ij9k1aiqbhdcikel6fg3hgqjiolh0mh8rj3sjouh3;1:uiz;3:8ivjjh;1:vk9;2:6h37jl9heagacj6dheggwhlfqhhrfvsjtwkf;1:2h83ja5jv7jrcipdirghghhdikwjgsqijwga;1:ggzilgjj3wgy;2:eiypj7;1:gj7;1:0jl7hb8hcjgrkk0pkkqh3rhcwmt;2:dgpekq;1:2ipbh9diqiixqko;1:8ix;2:wjt;1:1jyrgb;1:fix;1:1h95j97h58h5bjach1ggkmjonmzoj1pgprhd;1:gh3rm5wh8;1:ajh;1:ojr;3:9hejimpipsj2;2:lju;1:1jysj8;1:8j2bhd;2:dj7eirgh4miuwir;1:jioojowj6;1:hj4;1:vix;1:dh2el6mjswh5;1:9ivjlirg4wir;1:0jl4io;1:3hh4ls5h78iv9hgaodbjhcgqffqjhfkh6mhfoh8phfqikrjbth2wh2;1:jipljf;1:1jf2kh3lf7jrdinjhfqgjrhcwgc;1:cimjgxoikwjl;2:wjl;1:qisuiu;1:9h9cgzghbhm7rheujo;2:1iyfiorhf;2:cis;1:0hgbjxwj9;1:4jmwhf;1:8h99jb;3:4heijfjkmlimrh8whe;1:jjqkjtshcujh;1:5fu7kc9hhak7bhfchgfjdtju;1:qj5;1:fio;1:7m2jh6mizwhf;2:8iu9h7khcold;1:4j5;1:8j6jhcqiqtiv;1:nh8wkj;4:bglcju;1:cjo;1:0kd5l66h7jhdqkwthawgi;6:3imcixdj8thcwjb;1:3he7h3jgwoh1phfqsuwgr;1:2fk3gq4h95he7wd9hdakhbgxchbdh0fhfhgnjh3rhgtjivh7wgt;3:hin;1:0it6iqbkacgw;1:9j0cherjotiu;2:egwjl5qjswij;3:8h39jo;4:0fuik9qik;3:8j2;1:tio;1:3hg4hg5jb7j08mm9gybk0cixejpfhaghahhfjgxkhgoh3ph6qgpskutijuhfwgz;1:3h64hg7h78lq9laalfbngcftdhfeg4fgyggthh7ihdjgfkkdnh6ohgphaqj0rh8tgzuhbwgm;1:3imvip;3:9gxdl9egegjlrgtwj7;2:4k35l0jg9og6qh8sl8tjyuhewj3;1:hjq;1:8gwbjwehagknthaugqwk0;1:8j0;1:cj2jikuldwhb;1:al6jivkhcpjashe;1:7gyjhbqljwjl;2:dhgejqfh6;1:khdnmd;1:5iqlkkuhd;3:8fr9lrdmfefklit;1:6fyvkl;1:hin;1:0jvrhgwhf;1:8g4ah4fhfhh9rlsumd;1:0hg8h49h8bkgfjvgh8himjjgkj1piyshbwgs;1:aivtj0;2:ej4hhcjikohbpkn;1:kij;2:8irqis;2:5kf9hejjj;1:uin;3:wiz;1:lgqmlsnhf;1:8ivajkbh7ciwdijehbjgwpj0rh9uj0wjv;2:ejruhb;2:4n5ojeuhg;2:hhbiikrjc;1:ciu;3:ghekk6llcwgy;3:aj5jik;1:1lp3hf7k38imeixjgaqkergbwgs;2:bj2;1:bgkjmvrj6whe;1:8h9chdgintjtwkr;1:5ir8iq9gubkfcg2jk6rjfwh7;2:wj6;1:cisjhgklmuin;1:8hbfndujlwh8;1:1j0bgrcjkdhaflsgnajh0qh7rh3uh8wgr;1:gk7phfqlwwgd;1:1gw2iy4j36jh7h38l2ch3dh3fgvgh6hjfjiykg3mh0nhfoghpgpqh9rjtsh5tgrum0vlnwf5;1:hj6;1:cis;2:1hbrjh;1:liz;1:4js8gl9k8aj4;1:gim;2:pj3;2:1h97hf8iyaftbhack0gixhjhjm2sgvwh7;1:7jfbjvhgpjj1rgtwhg;2:0ip6ke8hdahbbgzcnuggthhdjhdkjqlh3nhewhc;1:8l79h1ajl;2:0ip5in;1:piu;1:gjqlhfrjdwhb;1:1ix3j36jq7hedheeirhioqhbrggvkjwh1;1:rjt;3:1jk8hejmvrgmwj1;3:3lm8kwijbjheqhguhcwgu;2:4lowh3;1:hjn;2:3hf6hebhedj6egwfk8gjjjgpmjeph7qhbthfuk3virwle;1:5jr8jl9h3cinfh9ginjjkqhasjiwgz;1:wje;1:fip;2:cin;1:fgohko;3:0iq8hhghgmhgoivqjktjkwjs;2:1hb5ju8mj9h4bgsdk1eg9jh1ljlmk6qjfrgjthfwg5;1:7io8f39haek7gh5jh9rheskiukvvjuwgt;3:dj0;1:ckbhj9jhanjarh3;1:3j48hbtk4wim;3:ahcnjerjowjh;2:0ha2o17h2hh8jjbljhqgywh7;2:5iljh8wn6;1:4it5h96h37h68iyckzeh9fgygfwjkzkj9nhaph7qg9rjvsgyth4vj0wkg;3:rik;1:mjj;1:3jg;1:bhgrkr;1:1k78hefj5gheiisjh5lkuqkarg9wgv;4:wkq;1:bipek3;2:4j58jl9fyah5bjockadiweh2ih5jgpqmlrhcsj8thdwh1;2:qja;1:uim;1:civ;1:8irfgnhkojguwiv;1:tim;2:8h19j4fk3;1:6jg9guah4bhccm5fh5hh1jh7kgxnr2qh4rgjwgc;1:1jb;1:9im;1:sjr;1:1ik;1:0ir2h23h04gv6ir8hdahffioihcnheojdqituhbwj3;5:1ir9irrh6;1:0kh2hh3h24he7j68jcaj5ej8fiqhivogyripthduhdwh9;1:9klahgbguck1ekrjherilwhf;1:0h02h93ji4hc5h76h07j88kn9n3ahabfqckjemjggthikjglkh6mheoh8pgyqh5rjbuh5vh0wgm;1:tik;1:3jhwhb;2:8h3afefg9ghdjhgkhfrj8wsn;2:tirwis;1:7ip;1:dj3;1:jizoj6riosikwhc;1:mjb;1:piw;1:qitsjzthf;1:wkx;3:rj1;1:5ir8hg9gzcj7ej1ojpwil;1:8j79gwtis;3:jik;1:6iz9iowhf;1:sje;1:bjc;1:1hg7k2bhejgmpjlqjhwll;2:dil;1:biu;1:jh5rjl;1:3ir4h76h57h79h7aisbgocjbfgfgkdhjriiplgxmj2phdrhctlfugmviuwfx;2:8imbk4cgzjk2rgkwk0;1:2it;3:8isdhcej2;1:9ikajewio;1:aio;1:akg;1:eip;2:tk1;1:5is;2:7jtjklphbqhf;2:6hhvim;1:0j8gj1lldwh6;1:3hc7hf8k49j8agychaehgghbkjmljwnhdohbqhgtn3uh9wh5;2:8he9j1;1:0hb3kv5h6aiodgsfnpkh5oj6wgs;1:disehapkj;1:6jlhh6rj0;2:0jr1iy4ip8eawlh;1:5h2jjt;2:oilwje;1:akesgl;2:8hg9kidikeh7;1:kjenh5;4:8he9in;2:4j15jo7it;2:bithgyjjo;1:4ixal7bfskh8lj5oherh8siq;1:dh2ejxgivwj5;4:oljwhd;2:wiv;1:gix;1:1gu8h79hbahabivcj7eizfk8gkril5jimkjcnh8ogvqgwrf1wgz;5:8hh9j6ejkhj5;2:2h63hf4k57h79j0aipcj1dgxfiogh1jjskgwmhcnhfoj6phaqirrj8thguizwiq;1:7hh8gxairbhdfhehfzjg4rgxslets1ujcvh8wh2;1:diw;1:8h9cjejiv;1:3h88inaj9bj7chcfiwgh6hjbjhaqh6ujw;1:3h66hb8ff9efag9bh7cgwdpiepvfp8gguhgrkh2lhenhgohcph7qh3rh6th3uikvj0wgu;1:8h19jsakqfgnsji;1:8iz;1:2j14j1;1:2kr7jjbhach9gjcojerh2sgv;1:6h9fj0ghcjj9tj6ukbwgp;4:1iw;3:8hb9j1;1:1imgiw;1:giwjhhwjc;1:8h9bgrfljjhhtlmwh7;1:hitqio;1:3jaajwfgvkiwwhf;1:ehdukr;1:gj1hgsjl7;1:9izqjw;2:aglch8fjqjj9nk8qiyrjnwhh;5:0irhiz;1:4oych0kj8nhgoh7pj0sha;2:0ix4io;2:8hb9infk2;2:jiy;1:9imriowj3;3:hhftj0;1:kkm;5:filnij;1:9inalfjglshbwix;1:hgltjz;1:8g09km;1:3jc9is;1:9ipgin;3:lh0rjfvim;1:lil;2:eilglh;3:mgdtlgwhf;3:1io4j3wj5;1:cj7lj1rgy;1:1j6;2:nll;2:kjtrjj;2:egzujuvko;1:7ik;2:1gtgjpmjyrh0ujvvjfwh7;1:uja;2:ujf;1:5kq7j4jk0rhe;1:9jvcgx;2:0h31is3h84h96k37kh9gsbitchceh7fh7gk0hjzjirkgrlhemgyoh4pinqitrl9vipwej;1:8iotik;1:cgwfh3hiqkkv;1:9inwjg;1:3jv8jobggdkjehhqkhrgxthewgy;3:ag4bko;3:ciljhdwk4;3:9hbdklfh8gh0ritsk7ujw;2:bkt;3:3gqjkf;3:0tm3iy4ha7h38j49gxah6bhedhfgheij7jgjkh8lhfohgpglrijthfwgb;1:1is;3:8iwcjipip;1:0jdkiu;2:2lcbhfdioeh1jgwrkb;1:1jc2im3hc9h9aireimhhbjipkinljyogxpizqh3rgrsh1tiwwgt;1:8iv;1:2hg3hh4gl5im6gy7qc8k2agnbh4ch5eh9fh3ggkihgjfgmhbnm0okppkdqjnrg3th7ugwwfw;1:mlanhg;2:4iv;1:1kh7il8j99j0ghcjgikh1qjlrjosixwim;1:4jojh2qka;1:5jk7jjbkpjgykheljxwgv;1:ril;1:8kjthd;2:rj2;3:1irrhd;1:2gq4jj7l1tj0;1:ijswhe;2:8jo9hfjiq;3:4jkwhg;1:2is4ji9godmqef3jkjqhd;1:3ki4jw5kq7hc8hf9hfjg3ofmpjcqgxskztjuuhbwik;2:5l2;5:8ixciwfhhghghmjrgz;1:6j6dillis;1:1j0;1:1gwcj7ijt;1:aisbhagh7piowkx;1:1hb6iw8h49esbiuejafiqkiwmh9qizwiv;1:jh1qk2;4:jijsituiv;1:hhdjit;1:jkuoh4pk6qhewjv;1:ail;1:8h39jkbip;1:8it;2:8h99iojhanittkh;2:fh0gn5hhfjgflherjb;1:8j59h3bh8khbmkvoglwkf;1:8jq9gf;2:diveh5uk6;2:5jlhfzjisok0rjrwhg;1:gixjir;4:0iy8gxahgcitjjckkzmj2ripuk4wft;1:1hg2hc3gs4ks5it6ha7h08im9kpaiodixgikhh0ihhjikkj0mh0ohcpg3qh5rg3uikvivwgu;1:uj5wip;1:uja;3:8h4jjm;1:aj1gjt;4:3ge4hd5io6j77hfehdgk2iiojgskj7nhdphcqgkrizth2uh6vp2wgf;2:8h19hhcjhkheoke;2:tjg;1:8k09hf;3:jiotku;1:1kc8jkbm9ch0dgyjhcmjtuhbwgi;2:8h99ivajzdg7emlfgughakhfnh8rhgsizthaun6vgrwh9;1:ak1fgq;1:8gn9k4qil;1:6go7jy;2:8hdjgyrkzwkg;1:aiq;1:pl1;3:bhgcj5fhcgjzjhgpk0rh3wit;3:6kgbhhfisjhgqhgtnewgv;1:cjoeiofgxgh9tjf;4:aj0;1:4j9;1:4j4aiycha;1:olk;2:ej1jlywg8;1:9gxdl7egjhkqjilrh7wh7;1:liyoirrhdwir;1:9jfcgvjjlwhh;2:mim;1:sil;1:8io;2:jiynjvwh9;1:8hgmmi;5:2ioggxhkajh8tjtwhb;3:vh6wjp;2:jiu;1:ajicikfjc;1:ehbfj3;1:8iqdir;2:dhdeirkj5;1:dlzegufhe;1:0jj2l43ha4il5ki6h97giajpbh7ehhfgoggyjhcoh0ph3qiwvjowgh;2:8k1cjdikvwhb;1:wil;1:8heqjfujq;1:ah1kjbpl1whd;1:0j82j44l9aj9bh7ch9dhgejmfgsghdhhbigvjhekh0ph6qh5tinuirwkm;3:iix;3:jip;1:5jojgkrjc;1:4lj7l1ohdqgxwgp;3:ak2giwjik;2:njcuj1;1:1in8ju9lpbgpohcph8rhewj7;1:6jtth0;1:1jh4h87gxbgjcglegsfikgh8hgvihdjgfkgjljkmjgnh6ogvpjwqnkrghvj9;2:fj5;4:8fv9m0akebh5chfdp2ee8fgegivhgtjmjkh4nhgphaqgwrj0sh9tirugmvhdwhf;2:4kgshc;2:jir;1:6jo8h6eiyjojqh5wf2;5:pix;1:6jahik;2:1jkjh7qiswha;1:7jojhdkk0wha;1:9imbji;1:bgfclidgzejnfgyrjyth5;2:3jo7inglfjhavh9wgw;4:uil;1:9ikakcfh8;1:giojhaqk0;2:chgijsjhgohfpjhwkm;3:0ha1gz4ha6h98k79h7bimcjedk6ejklhbmhdpgzqgyrgntjuwg6;1:bis;1:5j38jxrjztkxugtwgr;2:2j34h5ajidiwgh9;1:bhffiljgwwk5;1:8j0fj2;2:3jb7hg8it;1:2irojh;1:kkeph9;1:cj4;1:0hc1hd3h57g28fu9lubhfch9dhgegefh9gmphgbjl4kgmlh2mhfnllpj1qg7rmzugjwiu;1:9iz;2:8h99iz;1:1iv2it3h04fy5ha6hc7gu8fsbm5cjgdgxej1fkihh8ikajfwkh0lgfmgvngfojeppqqfsrkvtgsugqvhbwff;2:8h59ivmk9uhf;1:gggjmdrgk;1:gil;1:qh9wkq;1:3k3;2:8jpoj6;1:2ml8j79h4rhgwhf;1:3grggzil4jh4mhgoinphhqjbrjttjbwjf;7:7iqwjn;1:gjwqj2;1:kk8;1:cikwim;2:bjh;1:ahfbjilggmmxnhdphe;1:qk6;3:3it8haghgjhckh7lkqnkhojerj2;1:7j2diyehcgkrjiqogopiqwg7;3:1jw;1:lionk2;2:1km;1:9k8bhdejtjheqjlwhg;3:ijrjjwrh8;1:chbdgmejnggxhjbkj0mixrhguiw;1:vke;1:0iv1l62is4ij5he6h47hg8jgbjbchcdhdfj8gilkh3lhemh7nhdpgnqgprixuj0wgj;2:4ipairqiksgwwhf;1:8h89logj5hjmih8rhawhe;1:eik;2:dil;1:1im3hg5io6inggrhgsnimoim;2:rjnuhh;1:pk4;1:8il;1:6g6vgzwme;1:0kx1gx2hb3it4iq6gz7js9jkbh4dgwfh1gl9iipkgcngyogppgfqgssgbtgxujpwj7;1:rj2;1:2j04j1cj3;1:oirqnxth8wh1;1:sis;1:5l47fshm9jf9wl7;2:riw;1:gk0whf;1:bis;2:5ph7he8gmagxcgzdinfgwhgyijajgykhemiwoh1pisqggrgvtha;1:7je;1:9ivgiz;6:pme;1:qik;4:ghepikrm1;2:9jiahcbixchfdimegvgisuiw;1:sjf;1:bjdkhcnmc;2:2mc4ks5hf8hbejkjh1qhhrhewh4;1:ahcril;1:9il;1:oiq;1:0it;1:9iw;2:wio;1:3h7khbmn5nhcphaqjl;1:gik;2:8km9gvkjg;4:8hb9kqbh8fhegjqhj9rhf;2:aiofhcpk4;3:gj4;2:3ip;1:ahaehffl8wk8;3:0h83hh4ji8gt9grah7bh9dlxem8flmgh7jh4th5uiowh1;1:5l77hg8in9gkjlrmgwnkiohcphaqgswjb;1:cjd;2:1h2rmvwhb;1:jje;1:4j28h7llg;2:din;3:0iw3hf7hg8ikdj3ej0fj2gh3kh1lklwjm;1:7j1qjxwh4;1:5l56hgah6bhajg5khgmlunj9ph7qiusjbth2uhgvjowgr;1:1ga5iv8hfbjhcleejljh8kheqhark6;1:niv;1:7ixhha;1:8heailfhaggvhn1jj1tj3wgt;1:6j9whb;5:aij;1:ijk;1:7jziitwhb;1:5ip6iojjvqipsivuggvk4wjb;1:ciw;2:gjjoivwio;2:sijtj1;2:4h5ajl;1:2ioiizjji;1:1jq;1:2hc3ln8j99gzfhcginjglljmohbqhfrh4wle;2:aiv;1:glh;1:1in2jd4ikbhffnoghcshguh2whb;2:uim;1:giw;2:8l2bgzsj4;4:0issiv;2:vj4;2:8hdbjdchesjb;1:0kr7hg8iycgiggorj7tjhwja;1:3h17hd8h8aj8fixgishhdkhfmkpqh8rjfuhewk8;2:8k5jip;2:8h09jo;1:7j2;1:jjgnilqh8;1:bj6ciohij;1:4j47j8kim;1:wjn;1:ah0hms;1:2itjj0;2:bj4;2:0iv4jj6h27lf8gd9jwafsch8dgkgjqhh1jmskj3njupgyqhdsgvvgawgs;1:8jb9ipaiujh5pmzqhesilwfx;1:gjmjikriz;1:oj6;1:8gr9kl;1:0hf1he3h44he6k27hc9klagybhcfjmgishj8khdnjioh9ph9rj1sguth1vj2;3:8iwtip;1:6hcbhefl7gh7kh1lmk;1:djh;1:eiwoh0pku;1:9iq;1:2m34gy8k09gqehffgwghghlwjioohgqh2thcwhd;1:wjf;1:1hf4hd6gn7iq8ik9jlaj1bh4civdgueh5hk4jhckj6mh9nh1pgzqj5rj3sg9thhugzvjgwjm;1:8ff9jyfjmllf;1:7h5ojr;1:ij3;2:dkoegvgj7rhfwj7;2:9il;1:8ip;2:6l9agvbjb;3:jiz;2:gj5riu;1:5hg9jjailbhbcj0egofixggvhiojizsjmuj1;3:0kk1lf3hg7j8chcgh1jjhkhamhdrguwl5;5:4he6hdlikvjlwk3;1:9k1ejdjj1qk8wh0;1:9ivjj3;1:8j4ciu;1:9jshiw;1:6mraj4khfwgu;1:0kg1j63is4gwrhhwj6;1:4hdiiwqio;1:biujjd;2:2jd5ml6feaipehdfhdjh7ohgpheqhbrhdtheukfvh6wlb;1:lir;1:2lh7imeheugsvjd;1:ejwmh4oh6pmzrhgugxwh3;1:0io2gx3io4he6ge7iv8n39kpajccj9dhfegofgogh3hgnjkkkgsmh4nh8ojfrg9tgzuhcwgw;1:9j1uhe;4:eiv;1:fim;1:7joeheikatixwhc;1:qiu;1:4j5iinkiq;1:8kt9gw;1:girjhc;2:7kd9hebkecfufhelkcogwphaqh8rlcshgtjguhcwgu;1:kjrlh9rhg;1:1itoh6wkt;4:6lk;1:8gtbj5jkg;1:jhcmh9tl5;1:ehbfko;1:khhnmg;2:3j4aithj4rit;5:2izbj0jj6qhe;2:9iu;1:bgzkl3;1:0hb4mo5hh8ilah7bjdcjpdfpekpfjkggvjgpkj8lkcmh1ogvqh4rfrwhf;2:3im;3:1ge2j03ld4jf5h46gp7fz9klaehbgfdgdfm9gk0hg2ihbjlmkgqlh5mgwnixpggqilrf1siotj0vjuwhf;1:6hevj9;1:0k91jl4gsajzfikij0jgwkh7ljynhdqgkrjgwgi;1:kij;2:0fa1h53lu8jc9h3ajnbh6cingiojjqlilqh7rgnuk1wgq;1:6hglimmjlnjzviuwh6;2:1iv;2:qir;2:diy;1:8iuaiwbh6cggejafhghiwjj6ljbqip;1:sim;1:0hg1ir2ik3hbija;3:8jqahfcjqjikuj7wh1;1:wkz;1:ijx;3:uk5;1:qjd;2:bkych8gj4khg;1:3hgrj3;5:8j59h3gj9hizqis;1:1iu2j45hd6gz7h78jm9hbaj9ehbfh2gg7jjrkj7lh9nh0oinpjksjhuhfviqwgd;1:1ir4inkj3;1:dg9ek0;1:til;2:ein;2:8hgmlgwh1;3:3kkcimfhahisjgwklhrh3wh8;1:din;1:4ij8io;1:ghchh6jmcqhawhc;3:qis;2:6j28j09h4dj7eh1fhgqiouk3vj2;1:gk1hh5sj2tiz;1:ahfdhaej5gh8jharjkslc;1:qik;3:1gt4ldajefg8ih7jghkheqj1riwuhbwkd;1:0hc1h93jr4h65hb7j18l09ggah8bo3cgzdiqeh9ffzgizhgojh8kgolhfnhdohaph5qhcriwsiruj2;1:hir;2:phdqllwh1;1:9jagj8;1:1iw;1:gkfhhcmj1simuhd;6:2fm7pspivqgrwh2;2:1ivlit;1:diw;2:1j86ir8lj9fzajybh3chdehgfgcijdjh2kg3oh5pgqqhgsjctjxwki;2:kj7;3:1im4ilagfbjsdh8ejtkitnj9rh6;1:4goip6whd;2:wiu;1:1jp2qy3gu4h67mhchadhbhhejh6ogjph9qgprh9vj5wgg;1:pik;1:1h93hg7h38n99g8ailcgtde8ejnfkmgh2hhfjg7kn0lhcmh0nhbojqpgvqgjrknsh0tilukpvgqwgf;1:0j31k28iw9h2birljmohgphbwh4;1:1j7rha;3:jj2uj1;1:wiz;1:8j0;1:8iv;1:8gqjhfkiypls;3:ajgfjcmhcsh3tjj;1:9im;1:1j6bj1fiokj1liw;5:ij4;1:ljq;2:7inwio;1:8h79iwjjjuiywj2;1:1il8j19h4;1:9gxcmcghfhh4jjlrh5shb;1:3jmwhb;1:1hg3h88iq9eyahhcghdnreelfj1ggehgkihgkhdmivnjrohcpk1qk0rl7tjruhdwj1;1:ll6ogwrlgwgx;1:hir;2:6iq8hfbhedkigj7jj1uhgwhd;3:hjrrh3;3:9iv;1:2ka4ntah3cgrghfhltjgooh3pjbqhcwgs;1:6j2uim;1:8hgmmn;2:8k09j3mjb;1:7hf8jnakudgeejufh4hitjh8qhaskeuhc;1:tj9;1:0gv1hf2kr3kb4hb6l37pa8j49epagvbgsdgyeh8fghhgnihejhakhgmh5ohbpgeqguth3ufkvmqwkg;1:aj5fhc;2:hj4rhg;1:ciruixvizwhg;1:4ipkio;2:8gb9la;2:0hb1ha3h86hb8gc9f9aghbgvcgvdnfel7fkgihgjilkh5lh5mh4nhdoh8ph4qjzrjytgxuk4vkgwfp;3:aivwji;1:3ir;1:0hb3hd4he6hc7j28hb9h8ah9bh8djffnwgk6hgzjh2nhcph9qh5rgrukevjpwgf;1:giu;1:ehasjsuk8vil;1:3ha9h7ag3dkbel1fjnsjgukuwgu;1:rfkugrvjqwlv;1:1h07jteiohiqjj0;1:4hdaj6bjufiuggfhh8kn7qimth9wh4;1:hhfrklwhd;1:8gxbodrhctiwwhb;1:8j2;1:8hg9il;1:wj9;1:6j6vhd;1:ck5rgdwld;1:gjtwj2;1:6h0vkk;1:4iyih8oij;1:eirfltrhh;2:pk1;2:2he4h05jb6hb8kc9jpaimcj3dhaegoffoggkkjmmgxnhcokpqh8uiqvhhwiz;2:fipiin;1:fil;1:0jyanbbhfck7fjjggvhgujhbkhdnhephfqhergvskeuixwgd;1:airfharitwjy;1:bikojxuhf;1:5jcej2;1:6l4agvbjawhe;1:8j49jhajzbjucgrdirekdfjkjipkinnhcqhdrghshfuh7wfq;5:sip;1:mk4;3:9iudimeheojc;1:8gu9jdpiz;1:9gtahhcj3llqmizrh0wh0;1:1ipdk4mivrhe;1:jh4oj0pnqqh1wg9;1:6h7vj4;2:8h7ahfbjuchefjqhh6kl2;2:ciwggijk2;2:wir;1:ej2jh9lipqja;2:8ilrj9;1:9ikbinriq;2:jj7;2:eissiu;2:8iv9k6ekwthb;2:ghgwk8;1:8imainbgpkj9;1:0h51fz3jc4hb6hc9j3ekvfh3ggjhh4ikrjjekgzliomkonhcohbpgxsixth7uhgvh9wj2;1:dil;3:6lz7hfoiuph4qhdrj7tjyugywgj;3:7lhchdfirggqqj4wju;1:8j59hahiq;2:jharjb;1:3hhah3ehefhdgiohijihelj1qizvimwhc;1:9imwl2;2:8habjyfklhirugv;1:0nv2ip3h84iscj1eixfj2ggnphgqhguhdwgn;1:6hcjhalj1ugxvm6;2:8h89jghhbjhbkjlrm6wh3;2:jghkiwrkzwh9;1:8nl9h5ag8bhekinohetheuj6;3:jj9;1:0gmgjerk4;1:1he4l75hf8jr9gqahhdgfejifhdgo2jglkhgph5qjhrgmwgr;1:tj6;1:bjiwim;1:pj9vjh;3:nim;1:fiy;1:air;1:sik;2:0gc8j2disejj;2:2ikahebj2uiz;2:ah6bk5;1:0ki1hf3h74m18gy9kgej4fiqgirjh1kh3lhgmhgph3qhfuh4wgs;1:2gl4ja6hfghgjgzkjmmhaohdpm3qhdujhvk1wgk;1:0hd1h04h96he7gq8ip9g7aiubj4cjndkaejsfiljhglhcmhhoirph5qggrh6tkbwh2;1:ehdhhgjjymgrshbtpuwgu;1:dheeiy;1:air;2:9jc;1:1iw;2:4hgijakiv;1:qiq;1:8ikqk4;2:5ju8j79h5;2:0jv1ni3ju5h96h37grah5bkzdg9ejvhj9jgmkgolgrngrojupg2qjhrh5ugfwfp;1:aim;1:cj2;1:8hd9io;2:5in;1:mil;1:7km8h5biwdjmeh7gj7hhcnj9rh8sir;1:vkg;1:8fi9nb;2:2he3lufgt;1:3ilbhhgjirirwjs;1:aipch0tk4;1:ciw;1:3il4hg6k17l88k7dgrfh3hhhjiskhaohfpg1rh7tl2ujfvgdwh9;2:fjl;1:8hg9iwak2ch8eiqfgughbjjdnhcriusj0um3vgtwh9;1:6is;1:3jdainwhb;2:8gq9jlhgujj2rkh;1:fhfqkt;3:almfgd;1:pjyuis;1:1gs3hd5jk6hg8jk9kbbgncj8firhgkkftlgpmh4nipogwqk4rkiuj1vilwfj;1:jivujavij;2:tin;1:0he1jh2ji3h24gv8gj9hfahcbh4cjcehbfh4ggphikihajemkgqlh5miookmqj5rlhshhtgtulevlbwg7;5:pir;2:1h43k85it6gv8iuahdch4fhggghhgijixlizmmqogipioqijsh8ufqwj6;1:3h84km6hc8gx9haah0cgmej8fkqggvih4jhbkh3lh9nheoheph8ql8tikulovjnwgm;1:8gw9jzeiu;1:3hd4h76rn7h88hebhecjtggsjgfoitpgtqkbwgd;1:8is;3:bjmeh9tjb;1:qkgwhe;1:hiyujk;2:2jb3hc4jj8jloj3;2:8hc9j1;1:jjp;1:fio;2:ah5gk4wgx;1:dimehefj9ghcvjk;2:2ji3hd5j96mt7it8hc9h2dgieh9hhemhepgvqgtufivob;1:0gk1ik3lb4hg5ha6gm7h98gt9l8cimdmdeh1fh2gemhltij3kh9mhbnhfohbpgnqjuth9uj4vgfwgt;1:4hgiji;2:1iw2ikcilfhdrhf;1:7jrphe;1:ckafh4qjxwh5;1:1iqpjorhc;2:qiu;1:5jefittk0;1:2l5riq;1:3jc4iw8k79h2ahebgvcjkdgcek2fhdgk0hjoiiyjh7mh8nj0qh5riksiqthauhbwfu;2:5iyjjbwj5;1:dj6uixvix;1:jjiogupk9qkcsilwh4;1:giu;1:gir;1:0j52gv4jb7gq8he9glbilcipdjregcgh7ijdjl8kgplhfmh5phdqirrhdsj4vhfwit;1:ejd;1:ojt;1:8hgiimoikrjqwhd;1:oin;2:wj8;1:1jqailbha;1:9jljhesis;1:uj2;1:giyrjf;1:8jc9hd;1:cke;4:qjv;1:9etdpvees;2:7j3kjasiu;1:kh4mjn;1:fiq;1:1h85jhghbhiuintjh9qhf;3:ein;1:0hh1j64he5hg6hd7ixagwchfdhaeixfh6hh5kfmlhcmh1nxkogtpj2qhbrgtth9uhbvhewff;1:wjc;1:0hf1gw2g63gy4gx5h56mb7h38l4bg2cgqdjdej1fiugjfhl2ih1jfjkgxlh7mhbnh5oh5qg6rj6th4uk9vlowgw;1:rjywhd;1:1kfajd;1:hj4;1:0hc1hc3hc6hfahgdipggihniigljjkljhphgrjrvilwh7;1:jk6pilsiqwhg;1:1jg3h84iq5ne6g57gz8l4ak1bh4eh4fh0ggijj0kg5lhgmitoh3ph5qghrg8siqtkgujyvfz;4:3hb6nq9imhgqjh6qhcrm4tgcwfy;2:wj0;3:4j3;1:pjdtin;2:wj8;1:9j8ombphbuhewh9;2:8gw9h7bphfhbgjrhhhjhekhangzokwqh2rgathfuhgwke;1:7k08hfbj3whc;2:ck7;1:0hb6g58h0aj8ch0dnkehffilhhbjjhqiovjhwj6;1:8h79h8ejw;1:1iuaj2fhcgjtrha;1:ggujki;2:0h51lo2h63h44ke5hf6h37hd8mg9h1aiucitgfaij8jjrlkfmglngpoghpgpqgdrg4shfukqviywf6;2:3hh7hdjheqk7siqtip;1:wip;1:pjl;1:9is;2:ajzehbfiwkgv;4:2gm7jfwki;1:pjh;1:8gtchgeh5fitkjxll7nj4tj2wgv;1:wjo;4:dk5ehcfjz;1:ojq;3:7jm;4:8kcaj7ghb;1:hgmjh0tm2;1:qj6;2:ahfbjk;1:5iu;2:him;1:pj2;3:iiu;1:8iknioqij;3:0he1hb2j94ha6hc7h59heblnciudhcfgngl8hfwjh2killmpnh9ogppgxqgurkxshgtgyuiuvhfwh3;1:0llgiwihfjinwh3;2:9h1riusip;1:8kx9lqbkacgzegyjh1kk4oj1phfugowgw;1:hj1jgywil;1:4hg8l89gtbk4gjkjhfqjiwgp;1:5gu8ik9hdfivgj7hirjh0mimninqk4rh0shdtgywh4;1:0jpcftfnugh0jjnkhdqheth7wip;1:pk5wha;2:1j73he4h76he8jhbiyfhbggihmfilojkdkh9nj3oh4phbrf7sgdtiuuh2wgs;1:biklimphgwkj;3:agmfka;1:3mu5hg7in8jgbkjehefhbhiqjgoqhauhbwgh;1:0ir8h8cjpjhgoki;1:fj5;2:sjh;2:ukb;1:7imjiqskywhe;1:0h81hf3h39hbah4bgwcgzeh9fgygg5hqbihejo4qj1tkduhewfh;1:bh3dj0eh7fh9jg8kh2ll4rlwwiy;2:vja;5:bj5;1:9iyoim;1:8h6cj9;1:bkrfhg;1:5jp8ipfiowhh;1:gjanit;1:tip;2:dhdej7;2:wji;2:aj0ej2jhduj5;1:1ha2k03he4lq6hd7h48imbh1chbdheeitfgqghhhh2iksjgxlhbmjrnhhog4qh3rhdujewil;2:git;1:7j6jh9;1:diweis;1:6ladj6jhdkhdnk4wgm;1:9iq;1:qkcwhe;3:jip;1:wil;1:4je8fc9ildgxwlp;1:dinwik;1:jik;1:0kg1gt2km3gr6h17gvakubmbciohgrih7jgdkm9mgzogtpgjrj0ugwvhewfk;2:5inhim;1:rit;2:9jb;1:bjoglolhbrgpsim;2:ahgbjdchcdf9ele;1:8h79jcojb;2:wju;1:qjyrhe;1:1moah5dhbjh8rl9wh6;2:bgmcj4ehhghbhj4jkcrk2whd;3:6izhjvrh2vhd;1:1h2aitcjkdjuejofh4hizrj0sjkuguwh7;1:cik;1:uiu;2:0k52j76h8dkdjh9ljyqh5rh0viswh7;1:8jkkhblkdniyuhewjn;1:kmipgt;5:0h61h22h94ha5hf6gs8j49m3airbjmdgvegkfishivlinmh3ngyojbpgjrkisguugl;1:gjy;2:oij;2:8iq;1:1he8jy9o5agrcn0egwfh9hfakgxoj9qhcthgugmviqwgy;1:8gl9jcjjokil;2:8fl9l8agkcksdhhegyffzgirhinjhckhblhdnjzqkvriztgvwji;1:wki;1:1lo8gh9gmbhdcivdhfgh8iilkhhmikphfrn3uhb;1:6jr7jc8gxbj0jh5khcqh6tlbwiw;2:oje;3:piu;3:ah6bh6fk2hioij1rjb;2:1ir;1:dix;3:8jfjj0;1:6h88inoikvkj;1:hj4;2:giz;2:wio;1:0jf1hf2hg3h45hf6hg7h59h1aj6cgjdl2gkahhfijpjjmlh3mj1ojjrdwvhcwgo;2:0hc1gf2hf4h85hd7h38jw9gsalabguck0djmfghgkghkljfzkgzlh3nh4oh7pgvqhfrlksh5thaujd;1:giq;1:0k96h6;1:qjg;1:hiljh9phaqlb;1:uirwin;1:eiy;2:1j6bj1fiokj1liw;1:6h37j6mjcoiktj5vinwh4;1:fik;3:0gv1h12fl3np4gp6gy7n98hb9hhbkcegkfgahh7im7jikkgomhdnhfogfpf1qgwrgisjdtk3;1:8hegl8hh4;1:ajsrhg;2:0je4hf8g79k7ajxklblhdmj0nh9phdwgu;3:0hc1ip2hg4hg8ip9j7aj2bh1ej7;1:lj3rh4;1:8hcbj3;3:iiy;2:7k5dhgelufg9;3:2kp3fw5j16gq7gj8jcaipbgdcgndhdggyhj5ihdjltkiwlh9mh0nh1ojxpg8qk4rl5shgtgbugqwgp;2:9gocm7fhcggrhq6khelgvriuuhewez;1:8hghjb;3:5iv;1:8ik;1:mjb;4:liq;1:bj7killjr;1:bkh;1:7j3rj3;2:gik;1:9h8bhggj8kh0nogwh3;1:0hf3he4hf8ju9kqagwbgich0dnfel3fgdgg2hisjjakgxlhbmhbph5qiltghuldwfi;3:3j3aiyjh5mjfrit;1:0lfahdhiz;1:0h53mm4hc5h66h57g18goaisbh0eghfepgn1khelhfmh3ohaqhfspluguvgz;2:8im;2:gh6hj9jgwph0qn3rh0uk2viwwh1;1:0lg1gt4ha6h09jzbhfej8fimghcqhfrhbum6wg6;2:8inbhadh5eiufgkghdkh2nkgsk4ultviwwh0;1:3hc5m57krjha;2:dk9eh6;3:ak3;1:8indh6ek6;1:akh;1:1jy5j8gj5;1:njnsj0;4:tiq;1:mj3;1:jgzwky;1:fio;1:5jj8ltdg8ej9fhfhik;2:giy;7:3nt8h39hbak8fk2jkwqhdrh0shawez;2:6lxdh9egy;1:aiwfkbgj5niorh7wh8;2:0iwbir;1:mj2ril;1:0go1hg2h63gm5ha6h37gs8xg9jpafubnsef3fh0hgzih7jgkkotlfvmgrnh7og4pgvqg5rgdsh1tg0vjb;2:9j1djdegn;1:0io8hg9gxahefhbgk9khaljrokbwhg;1:mj2;1:3jw9iuij1wh8;3:wip;2:9gkdhfell;1:9jscinfh4rj1;1:ljy;2:8k09p2bhccj6dhdee7jhgrhguilwhc;1:9imnjv;1:0km4hb;1:gj7his;1:8k99msakubizdhceglfgshhcjgkkirlh6qivthfwh7;1:4jw;1:2j2;1:0gs1g82in3gw4io6gu7f98h4afcbglcfxdk8efsffwgkhhmnih6jn5kgfmh2npbohcpldrg8sh7whf;3:alubhgegpfkvgiuuhbwhb;1:rhctl8whd;1:wl6;2:fijqj1;1:8gu9l2civdg3jhcriysikuikvj0wh2;1:bji;1:8ke9jbeh6;1:fk5;2:8j49ikah5;1:8hbbixcgijk9lhfng5pkmrjk;1:kj9;1:8iogippim;1:eiu;1:vik;1:0ka1is3ju5il6hf7h7agwgh2iixjh4kh8ljbmhgnj3rh0thfwgd;1:ggtqk2;1:fjojil;1:2jbsh2;1:8jr9irhhg;1:qjy;6:0h53h16hg7ha8o19mpafxchhenlfhgghghhgjh2phfqgxrh9sh5thhuiovipwgl;1:qil;1:8g9bkn;1:9hbdkgjliqhbwgr;1:fhagj6vil;1:wil;1:ajjfjq;1:qj5riw;1:1hf8hg9h9ahgbn8chfkjtlh9rikwir;1:rjb;2:dij;1:uj6;1:hgzjks;1:0jk1gt3gs4hc6k97l29haahbbjwdgjfhagh9jjfkgwlhdmh4pgpqkxtjqwin;1:1he3jk7h98fvae7bhccjydfkekhfjtghchg9kl9liwmhdngzok5qikrimtheulgwha;1:gir;3:kio;4:hhdjir;1:8j4khamkxoheph8;1:1kbdip;1:eiy;1:ik2uj0;1:1ip8jz;1:oh3pj3;1:2klbhbeiogj9qj5;3:4ka8fx9jgekokhbpiuqhewh4;3:tk0;1:6is;2:niqpk0;1:2go3ne6h8jgnpmeqhbuglvm4wfz;2:8kcehcrjs;1:cmirgjshc;1:8hbaglehbfjlulw;2:8h69l4ak6chgdh2fh1jhdsja;1:wiz;1:kj6lhc;2:8iqciphhf;1:2l88gs9jwah5bj2dhcjhcoheqhfrh7uji;1:wik;2:oiw;1:kj8;3:cispiv;1:2h13he5hc7ha8gv9jjah0bg9dhgeivffxgp2hmmjgkkheohepiqqh3th2uiwvl5wfm;1:uk4;1:3hh6lb7gzah0bivcl2fgzgitjgmojzqh8rhbujzwh7;1:kh2lkaqknrh0;1:4ikahf;1:0jg1h0;1:8j09hcairbhbcj8dl6gjkiikjh9rg9uhh;1:8ea9lxhgfqmk;1:5k2jiv;2:cgujhgnh7ql3rh9wlc;1:8ik;1:6kbdhgejsqivwgq;1:8h6fkbjl0pjsuh3wh3;1:4ij9heah6qj7uji;1:jkbwh9;1:8gabkeeh4hh8nl0qixtlrwh4;1:7itdncefg;1:cj7fjcgh7hj6;1:0iq5pq7h78hffjcjh4phfqh5wgo;3:cikoj9;2:3h3ajedgkehafu2jhdkg8phguhgwhf;2:0k42keah6bh9gjfkk9lh5rh5sjvwgp;1:eizqjm;1:3iwfgugkahj0;1:8hg9hbdm1ehgjh9thbuinvk0whd;1:0jwjiz;2:8iwejvjh9sizwh5;1:2ir8hc9hdbkjeingk4;2:jjh;3:liynjd;2:6heun3vgg;1:piw;1:4gy8il9jaalxbh0cj4ejofg8pj8qhcwh4;3:rj0;2:agpfjnggzpjo;1:1jo8h6gizjiu;2:piy;1:8f99lh;2:3k7eh8fhgsjquk7vik;1:ag4sjqtkcul4;1:8iuajjfjc;1:dio;1:9ip;4:ej0;1:0ix;1:ll6ogvrlcwgs;1:qklwhd;1:4ip;1:ikz;3:8h99jb;1:8ipsio;2:9ivbj6cijhjy;5:ajabiogisjh8;1:jh9ok3pje;1:ajekj9;1:8h9qkewhg;1:jheqj6wjp;3:8hg9jdkiy;2:8kb;2:9ja;1:1jq3h74le6h78j0bhdch3ggnkj4mgwniroh3pgsqg7sjathfvjpwjl;1:5j38jtrjttkxuguwgq;2:dil;1:1h43jr8h6cjxgjqlikmherewwmr;1:1jg3hf4hg6ki8h3ahhbgycizgh6hh9jj3kj5mktoj0ph8qgqrhgtijuhewgd;2:ql5whc;1:8hb9iypkj;3:8hedk5ekfgk0whe;1:cik;3:oiz;2:3jbfh7wji;1:eip;1:aj0;1:8kl9grjh2pjiqk9;1:sin;1:wix;1:1hc2h73jd7hg8jq9joaimbjach6dhdfjbgh2jkukinlhamhfnhaoh7ph8qinrgmthduiu;2:3jalj3;2:ggkhkd;1:agyhjbrin;2:ojyuhf;1:wir;1:jiy;1:jjd;1:3k6wh9;3:0jd1hd2hf3j84lb7g79h8aisbhefjsggzhjeikfjhbuh7wgy;1:3jcfh7wj3;3:7lt8ha9j1dipjheqh8wh3;1:wiq;1:1jgrhg;1:6hddjeegoggbjismhgnj5oilpkhqiyrhbsj4thguhdvjgwh5;2:oiv;1:5j57imaggfjfgjmphdqhaujr;1:eiz;2:ehcrjj;2:8hg9glbjldlleg7himrhbujj;1:0km;1:0hb2hd4ntaiubjfcglditfimgglhh9kjxph5sinth8uhewh2;1:9it;1:1gxaheehahisjhbkl0phgqhgrkiwk5;3:8h99jkoj3;4:kix;1:0h84h1ilo;2:8hgcjbpiu;2:ciq;2:8iq9hh;1:1jkajnjh4wh4;1:sil;2:8g8ek2jl9qjkwfc;2:3hgil5wh7;1:2hd7inliq;2:0g91jy2he3h54j45hf6h17ha8gr9k6ah7bgzgj5hjvihgjk9kl2lh8mh0nh9ohgpgzqguujovj4wgc;1:eikpkewim;1:iij;2:fh9hkv;3:eklpiv;1:9h2ejj;2:1ip3gz4hg5lv6m07iw9h2agzbh7fhfgh3hgqlh4mlinjcpgxqgvrgqth8ugnvmpwfp;3:jk6;1:gj9rh9;2:1iz3j56jx8ildheeisjh9qherh1vitwhb;1:1kejjuqj9whe;1:cjmfio;3:0ix1ki6ha8hejgvphfqhatjewm7;2:0hg3h68hgeiwgjehjbihgjhglhgpgyqh2rjm;7:hjh;1:sjr;1:0j0;1:0iz3h3sjj;1:ggzqjt;2:9hbemynj0phcuiwwg8;2:aip;1:mln;1:8gy9j5bipok7tio;3:8j49jsbjfcjpdiwghgjhfuhdwh5;1:7gwfjkjheok8rj5whf;2:cjm;1:6gg7lfbjdjhaniuuk7wh0;1:5kdjit;3:9kcah0;3:1kq8j3rh2;1:ajqshe;1:8iscir;5:1in3h67h78m79ljallbmdcf6eg4fgvggrhhaihdjggkl1lh3nh7phcqj5th1uhdwgu;1:8hgciutjm;4:5k38hgajech5fj6gh4hj4jgnphgqjqrjnth8wh4;1:8irdik;1:0iuqiv;1:ej6;2:0h71g72jf3gx4ix6ha7gs8gcdh7fhdgishh4jkykgflgznh5onqpj3qkhsj5ugwvhb;2:2l87iswha;1:ij2;3:0he1hg3gz7k28h8ahggk4jggkjypkiqglrh9sj6uhhwm2;1:wiu;1:1n9aimkgomhcngp;2:8iy;1:cgojjjtik;2:0jh8jn9gz;2:8hdgk7;1:liv;1:0hh1h42j63ir4hg5j17hf9grahbbhdchfeh7fgsggbhjojg9kh0ljjmiknj5okkpjoqgjthfuh8wla;1:aj0;1:tiv;1:dk0eh2njqwhh;2:djseh9;2:jhgwkc;3:8j3ahgoj2skxujrvh2;1:1im2kb8ga9jgbg0egvfjmgh9jhcohdtjgujf;2:mki;2:ljt;1:8gtbhalhbrmj;1:0j1;1:1h88hhaoxbhgck9fjeggxhgtkhbnhfrg9skpuixwgs;1:lhfnhfpk6rj1;1:kk2;1:bit;3:hiv;1:6hg8kfljqrh0;2:cj1ej2;1:0iw;1:5im8jm9itehbhjk;1:8inaip;1:jknsh1ufnvks;1:bjs;1:1g13hd5j76m07j4ah5gh9jg6khblj0mhdnj9pgxqh7rh3theufzvo5wke;1:5jv;2:iir;1:4jy7lz9ixehehikjfrwh1;1:6iv9hdtjc;2:sit;1:6j17gsphfqhbwm1;1:cin;1:1l2aharjpwg7;2:3k4rhf;1:8ix9h3bjljkdwhb;1:3hfaikdijgk7mjdrguuh9;1:3he8ll9kvbgpcj4ehffhfgh1himjhdkitrjbthgwir;2:5jn7jmjhd;1:wks;3:sis;1:6heqnlwgt;3:hhdjir;1:rmiwfp;1:bjdjguwjn;1:8iwek9fh7hil;1:aipgj4sk6;1:fiqvik;1:ahech8rmbuhcvjj;2:0gk2j23gn4od5hc6iw9hbahabjadimeh3fh6kgqohgph1rg9tk2uisvhfwji;1:4hd9ghahbbkxcgqejifmcgg4hj2jixkh4ogvplgqh7thewhg;1:ljg;1:1jq6hg7jpcgujiwwhe;1:tj2;1:jjn;1:1iskiu;1:8nfthd;1:8jq9itehbhjo;1:1h43jp4h96kl7iy8gc9h4bjfdhhgk6ijdkh0mh4ph6rh5thcuh9vgdwlv;3:bj2;1:8hfdilkj5;2:2kh4hd9hfahfbjaeir;4:2go4jjjhaujlvk7;1:3ijagxgkaqk6wh3;2:vja;1:jjh;1:7hb8heejmfhdjhakgnnk3olspjsqhcrj0vk1wgh;1:8j6dhceizrix;1:0ha3hc4hc6h97iw8ha9h8ah6bh6dj7fqegkjhgxjgykhgmhbnhaph5qh1rgnukdvjnwfv;1:9inrik;1:qjc;1:eip;1:3im;1:9jo;4:6liwhd;1:8k59gzbgvelsfgqgjbhhdjfvth9wlv;2:wjc;2:fjbhj3rj0;1:ckg;1:fj7ghghiskjhsiq;1:8h19k6nk4;1:0ik1ha2jn3gs4go6it7md9j4agmbjwcldeimgh9hhcihfjfnkgkmh2rh7shctimuivvguwf3;1:uj9;1:ej5;1:8j1;1:7j2;4:4heij4qkfrixwh3;1:rja;2:kjh;2:0ir1gs2hc4gw5hc6hc7h1eiyfh3gjhhh4iitkj3lismgvnioohfrkesh6timugyvhcwjt;1:0h51h63h94ik5hb6gm7h98h0bgidgvegngm9hiuihejf7mh4ngzpglqk0rh3stmtgrugxvir;2:gix;2:8h5bknljzrio;1:2ipbhaiiwqkp;1:1jykhaqjc;1:3kr9hd;1:nis;1:9ioagtcldjh0rjj;1:4iy;1:8kf9h4;1:ok5qhbwim;4:cilehgijkjj3rinwgv;1:3izsjk;1:ej3ikdmipnh5oh9pj4;5:af9jlzpj0skauhg;2:7hh8labhecj6egyfiqgiuhh8khdlizrhatizuhfvjvwfx;2:2fm6lbgikuhfvj3;1:8h69jc;1:0je1h13ik9ikajdwh0;1:wiv;1:lj5oh8rgywmr;1:lgkrkz;1:gj4ikq;3:dgseivmipsj5uj6;1:1ik;3:bhhhiyrjgsim;2:8he9h1ahfcgxggfjk8lh2mh6nheokvpovqinrkkuhfwgx;1:6h4diveh4tiwuk3viv;1:fh0glemk4rgxwgt;1:cijpk6;3:jjnojcqgo;3:fj4;1:8hegjnihhjjjthfwj5;3:8hdgk7;1:qkbwhd;1:0hf1hb3gx5ha6gr7gvbjicixeg7fg3hp3ihdjgukjjlhgmhcngwoh9pkpqitsgrtgwujkvj0wir;1:1hd8iobj5cit;3:diyeha;1:sio;1:3l7aivcimjkkqhath4wh7;1:hiw;3:wki;7:1ha3hg6h88ikajfbklcl7dh5eitgjkhkpihhjh2kj7lh9mh1nherg2th2wfl;1:hkwrfv;1:fit;6:0hawkd;1:lkcnh8;1:6eqvlj;1:6khwgl;2:gk5jhg;1:afzkm4;2:sin;3:tm7wg5;1:sir;1:ak9bhcmhboj9phaqhgrlxwh9;1:sis;1:0h11iu2iu3jc4gy6h68gg9h5aimbhgdheegyfkmghchgzigpjj8kiklfuml6njksjdtgpugdvkjwh9;3:ajlshd;2:9iyhikwj9;1:kja;1:0hg1gi3ha4hc6h47h28k79k2agtbggck9djhen3fiugmqhgeihejivkgumhenhdphcrgash7th4uitwg4;2:1j19imdhceh6jngqhawhf;1:lj4;1:0h02je5h46gy7gr9iqaiobjhcfzdj6efpfgqgjrhkaih9kg8lm7mjengwohfpgjqh0rjnsfftiuujh;3:rhcwkt;1:1h63h84hh7in8hd9j0ajlbisdilegzhh6jkgkhgogqpivqj8rhcvhf;1:9jhehcrjn;1:1k38il9j7ah7ejggirjlgkgsphgshduh3wha;1:1kf7heah0bgsggfhhaiivjlakh2lh2mh9nf5oh7pomrgrtgwug4vjjwln;2:3iuwjv;1:9imiiu;2:ggthknjg4qjzwl1;2:1h5ako;1:aiy;2:nggpjl;3:2hfhh9tiqujtvjb;3:8gmah9bgjdkmek9fmoggkjhdrk0wh9;1:5kvqhf;1:gim;1:6jwphg;1:3hd5ng7k28hf9hbdiyegrjftmj7nhbpimqjawgy;1:wit;1:flegj6jiwthbuh3wh4;3:fhfwj7;1:rip;1:fgnhko;1:aik;1:8ivain;1:6gu8l0jh2vlp;2:tiw;2:7gl8imgiljjc;1:ciu;1:3kg;1:8j3tko;1:8j9bkhchgfhchjqwhg;1:8in9itajkbiycj2diueh3fj0ghbhhejizkh9oj9ph3qh0rh3wjv;3:8h8skg;1:jik;2:jg6pg4qmg;2:8kc9gcmj3wja;1:mim;1:aiosimuk8;1:0iuhhejh4qlr;1:0io4j58ge9keaipeh5fh2jghrjzsk9;2:1kk2it4gv6he7h58l09gkegzfiuggihjoijijh9mklnh9ohfpgrrjptg5ugswg3;2:jiksj7;1:7je;3:8go9j3giqkkjsik;1:8k29he;2:9jvhgwjjiplmwha;1:hhctj0;1:him;1:liwrh8;1:bipdl1eh5jh9;3:8hf9k4akzwhg;2:bh5gh4hh2jm6ll3qh0wh1;3:7h48h6akvbk4cishjxjh0likmhfnjqqiorgjsk0uh2wgy;1:9h9ej3pjpwjs;1:3j28gmbhbfh0ghdjh3kgpljumsfoh5pgyqk8rh7wg7;1:3imuiq;1:6khwhc;2:jja;5:4itolsphdwha;1:0hf3gp4h95gv6hg8gq9lvagtbj4eh9fgqgkchj0ijmjirmh4ohgph2qhcrjsvgzwjv;3:6ikejm;1:2jk3he5jm6oh7g88hg9hbdglehgghehhfjgmmhfohgpjfqgxrhdshdufjvon;1:bj1cil;2:wjh;1:mkqrgowl4;1:5krbjkjhangsol1qgxriuwh5;4:bio;2:0k0aj1jhduj4wh9;2:aiodimehesim;1:bh9fjwpmyqhhwgj;2:biweiswj1;1:wj2;2:qkvwhd;1:bh8lkysip;3:ais;1:4k4jitwhg;2:ohgpjoriowir;3:0ir4iu9inahbcjhghghitkhboiqphcqhewjz;1:oiksj6wim;2:0g61gv3gv4j87gq8le9ghah9bgidh5eglfgbgixhgvik6jftlh0mgpnippguqjarlisjjtj5ugivj9wlz;1:9ivgjzjhg;1:8l19jaafwbikcjofh3jh8kgvpkyrh9sjeuhawh6;2:2j18h5jgyrkbwlx;1:liy;2:cipwjd;4:rin;3:8ip;2:6hg7hg8iscj0ek4fhcghdjjnohbphdqmcthd;3:7is9kmaimbhbgjgjh6pkgsh7uhgwg5;1:jj5;1:pj4wio;3:3leth6;1:0kp3h54gh7haajaeivfj5ghehj2ih4ril;1:2ik;1:1js2k93kp4lc7h4dhcjguliwojkph5rhdthcwgn;1:2js;2:0lm4h29itihg;1:8ivgkwjj6wgw;1:8iruj1;1:0jn7je8gzbj2dh2gh2jkjqk2rh5wfx;1:cgphivlkarkf;1:8gp9jt;2:iis;2:direh4uk3vjd;1:dikjh5wjn;1:viq;3:8lh9hbthe;4:bkxchb;2:3he5j96me7j88hc9hgah2bjjfhhghhjgekhflhbnj7ph2qherh8shgtjkug9vn5wgl;1:qjg;1:ij7uiovil;5:gjfhh1jl2qhewh7;2:8h5fgsrlduhgvj2;2:2h94j87itbiuojowha;1:uij;1:8jmqju;4:8lt9goaikbh5civ;1:8l59coelh;2:1h22lj3g84ff6jo7h28ka9gjahdehbfhdhkbindjm7mh3ogxpgareysghtj2uh1wj6;1:0jihh4rix;1:3ix;1:7iy;1:jjj;3:6ilciyhgyjiyrjgwhf;1:qiv;1:8is;2:5h9jhfwjy;1:1h46ha7kb8haaj6bhgchedmbhh0jkekk3mhgnizok2ph8rgrshath8ugqvj4weo;1:6j0;2:1iy5je6h67h09glcj2ejchjljg2khfojdphcqjiriush9theug5wiz;2:gij;1:mlcnhf;3:gl8jh1wkq;2:3kq9he;2:fjt;1:9k9;1:1he6gn7ku8imjhgrjz;1:8h3bjo;2:0gu1hd2hg3j45ip8irch9dheeitfh7hj0ikukhclh2mhbph1rj0tjhuhdwh1;3:ajsjh2okc;1:gkc;2:7gbcl0jjcoirqjfriwwh8;1:5k66gz;1:8ik;1:kj1;2:8hdaj9bj6ckn;1:jiu;1:jjo;2:8habj8;1:diw;2:uim;2:6hhpmmqhfwh3;1:dj8egnhimrh9uiwwjq;1:jj3qkkwgu;5:wjm;2:1gp3ko6hg7hf9jbahcbipcj0djdhjejfrkjhmh4phdqgyrj2tinuh2wg2;1:8jn9gfwja;2:ogfpmuwgv;1:dimuir;1:3h65kb6gs9h1aipegmflugj9ihbjjplh3mhgnh8qhftjnvilwg1;1:1jq;3:0lzwhc;1:2ivwit;1:pji;2:6hc8hgahgbhbchcdj1egvflkgj4jgpkjdphaqhfujsviqwlb;1:6l57jaah9bhcciwfmlgh4jgtmjooh9ph3qh7rkfwg6;1:0kd1kc2hd3hd4k76hf7h29haah6bgfcjfegufgygimih9jgakgumhaqh0rk3th6ukmvjdwj8;1:8j0qit;2:fiqghdvj6;1:0h11iv2iu3jc4gy6h68gh9h6bhgdheegyfkpghchgzigpjj8killfuml6njlsjetgpugcvkkwh9;1:1pl2he3hc4hf6hg7hf8g69gmah2cjddgdeh3fh9hkmihfjgskhamjkohcph9qh6rovshhthfugwvhfwh2;1:9jluhc;1:4in6j4bhhchgehhkj3pj4shc;2:2l37m9qhcrhftgrwh6;1:0j7eiovis;2:3gr5hh6ld7ik8gw9h2agabk2cksghfhjbikkjf8ph7qh1rikthgukz;1:2iyshd;1:klzwhb;1:bhcfiw;4:0hd4h15hcdj5ekjfhegiviiwkh2lgwmgznh3ogipl8qh2rjguk0vhfwg9;2:uj3;1:cl6kjx;2:wil;2:1gr3hd6h58k19j1aiobhach1phfqhfrh8ukovkgwlc;1:8jo;1:0h61h53gq4gw6h27h38j7altch5djpeh3gj8jhckg5lh8mh5ohepgysjqtknul6vimwfn;1:1h2bkmgj7hiyjgqlilrkkwgy;3:qj5vj1;1:4j8ej5;1:olmph0;1:8iqag1ghghh4qhbrioundvj2;2:gilnio;1:1im3jt8izditfhegjujh8nijpiyrgmwgz;1:8h09jogjb;1:6hbpj1vkewha;2:biowjb;2:fkmgj4whg;1:0gi3hg4is7hg8g39giah7bjnenzfm2gh8hjfjiykgvogzpheth3wh6;1:diy;1:fj6gjajgbwjh;1:bj9rhe;1:7in;1:gin;1:0nt3hg4h7ihhjh9nk2okppgpqh1;2:5lwaivcgxgh6hjljipsiowh9;1:jjnrh5;1:2gvch4hizolm;1:8jmrh5wir;3:7jy8gm9lccghwh7;1:hiqujl;1:6ta7hbdhaeh7jh8qjwuh4viywek;1:cix;3:6lfmjewg6;1:8hg9ix;1:pjq;1:3mdcisdgdel2hiyrgpuhfwgn;2:jkiphcwhe;1:8jz9jqdjmegefh6ghdjkoofupntqh4wgi;1:6hfjj0pl8wh9;1:lil;2:7jcjk5;2:1hg3gr4jo7hc8j99jqaj0cmjdh6ejahj3iiykg9mgxnhgogqph5rgduhbvh7wik;2:8hd9gwcilej4fk6gh7khfuiv;2:hjtrhg;3:wis;1:1hfdk4ejrghdognpp6qhfwgc;1:1ju3hd8jx9h7agbbilchhehdfk9ghehhhiiujh4ojarjx;3:5jy;3:ch4fkouirvjl;2:wk6;1:0ka2k57gs8h39gmjheqkvtkr;1:7in8j79h1aj9bhhch2ehejgwkjknh7qjkrk7;1:ajcbhbck8ehbggnhjijgsmj5qh0tj1uhgwkb;1:1gvgk5qimrh8;1:iiokhclkonhfphfwjj;2:2kc3lm6g1cgrfgzjh9kknqhfrhdsjvthdujc;1:uj5;1:rjfwis;1:9jmjh9ojx;4:ahfkj1;5:sj1wj7;1:2gv7jh8h29gpql7tky;1:6kjwha;1:0jxlit;2:1hh3hc4he7hb9g9bmkclqegcfj2gh6hgljgxkjllltogtph2qgyrjsthduhe;6:0iq6h77h69hggjwjhdpjtqljwgh;1:7je;1:sj9;1:wir;4:wld;2:mj0;4:eiooiv;1:8h7aiqtjq;5:8hfrluthb;2:3h48kq9kcah3bh3cfzeiwgkgjh6kk5phbqharhbshhthcuh3wkz;1:0hgchfij2nmopgytjswh5;1:hj6;1:til;1:8j1;1:pk3;4:8indixpkawhh;4:8j39habik;1:8hfbjuhh5kjhrir;1:4jo7k4;2:hiz;4:jl5;1:3lq9il;1:2hc3hb5hf6gj8gq9gzajwcgldimeglggihk7ihfkgumkenh7oh2phaqh7sk1uqbvl0wfq;2:chfjiprin;1:ahgbjiciysip;3:iiokhcllsnheph9wjd;2:1josiq;2:8irjjy;1:0j0jit;3:4irein;2:8ja9h4df6el0;4:9is;1:wjk;3:6iz;1:4hecjffh6iimlj5pjorikwh5;4:9jvcgq;1:iis;1:6k8ajmbgjwh0;7:ajofhajiuwhh;1:disjj7;1:0iqjk4lhdnjeojvph9sgx;2:ah5gk6jjlwhc;2:0h83h64h85hb6hd7h9bh7ch1dgleixgithg3ig2jgmkjjlsnmh4oh3pgwqgurp9th7uhbwgh;1:4h99kvakebjtfhcgh2hhfiiujhakhdml9okuphargstheuhdwg2;1:4iofg7jj9ujt;2:wj3;1:0ir;6:1kxkgwnjgwjk;2:1h63kf9hfajebk5ch8ehafjdggjhgtiiokkdmheohcpiuqkbrgqsh2thf;2:0nu1gv3h24in8jk9irbhgdjsfhaggxjgmmixpheqhdrh3thguhbwj2;1:9heply;2:kk7phd;1:1hb2hf3hg4hd6hc7hh9l9aitbkscggdirfjehgwihejh2kiylk5mh6nh6ohepguqgurgbvh8wk0;1:0jiklolhfnhdohe;1:rhcsjstk0;6:0h34jf;2:1h52jy3ha6ir8hbilwjhfmgcphcrgysj5tknvipwis;2:uhgvj9;1:1it;2:qj6;1:8gx9kawj3;1:mkrrgowkr;1:win;3:8im;1:dh5eka;2:3jw;1:3gv7he8jk9fnagdbjucj0dhfel9fkigh1hiwihgjfqlhbnhgoh8phbrfesjmtlvujyvh7wik;1:uiq;1:eiv;1:5iz6hf7jgwhb;1:8h0bh0gh1iipjlfnjooippheqjjrhawjh;2:1ipjirpiw;4:8jfdlsehdgh8hh6tjmugy;2:riotil;3:iip;3:dgwhjq;1:8jhcioehchh1kjl;1:wil;3:8jc;1:gio;1:ois;2:3in;1:ckp;1:2h48h99knbimeirjh9kj0ojlwhf;1:pkfwjm;2:djghiy;1:fiykh6lm9;3:8jidir;1:cio;1:qjm;1:ois;2:0gq7g88nl9ooafobgichfdh7eoqfgrijsjgtqgxrgashbwhe;2:qjs;1:9h1ch1rk9wl2;2:9iqcil;1:1ik8kq9o8ah6bh7ch6dhfehgrgzwhe;3:pipqkpwh2;2:uju;1:2l84l8ahgjh8ohfqgtwhb;1:9irriz;3:tiv;1:rjw;2:bkd;2:4iw7h3ojp;1:ajofhd;1:7jkahfliqrh1sj6;1:5j6hiq;1:8jv9g7jj7ljbrgv;3:1ktgj9khe;1:siovis;1:4isaj0;1:8hfeiu;1:qj3rio;1:8itfioijwpjsrh5whc;1:4j28h8aiubj1chehfijhakgdmsonguogmphbrjdshetkguhawgv;1:9ipqj4;1:giqhj9rgo;1:eh0qkb;1:dguejguik;2:jk4ris;4:ah0uk4;1:air;2:1j72gv9inbj1cheeiumiovjqwhc;1:8ir9hg;1:9j1;3:7jcwhe;1:8h49k3;1:qjptjlwgu;1:8h4gl6hgzkjrrhe;1:6io;3:0he4h57hc8jv9iyah5bjxchfdgwej7fgzgjbhj9ijjjgfkhgojcphcqharhathgvj4;2:8jk9hdbhffiljk7kiolikriywhb;1:9iydilwjm;2:8ioaj3wj4;1:3hgchcgivil5wh5;1:1jh8hfghcjmzlkcph2rgluhfwj8;2:8l49jobhf;4:1j0;1:biu;2:0lh1h03jf4hg6gq7gs9juagrbhfchagiqjg6kiqliqmgvnizohbqhbthdujiviswh9;1:1kp6ikahabgtgghhhbiixjljkh7mhdoh8ph4qiprgrtgyug7vjowmb;2:3h97k78gv9k7citdftejffh8ghgjkaqgorkpsjjwgl;1:ah9bj8;2:9ikjio;2:9hgaj7dn8efish4;1:8iu;2:6h0vkk;3:8ik;2:0j51h62he3j64mi7g68h2aj4bixdisehahiniknjhbkgwlkbmhdnhbohfph5uh5wfq;1:agkfgqgn4rhg;1:uis;1:gjiuj6;1:fhggl5jh2phfwl2;1:3s59h3ig3jhdqh8wj0;2:8j8ais;1:0ix6ip8gw9mjagndirefzghbjgzkh9nikqjyrh8uh7vhcwkg;1:3jw8gybh1to2;1:0j81hf3he4gwin7uh7wjh;1:1h23jz9j4aischejisqgrrjctgz;2:0mb4hgwhd;1:8iqjis;1:2iq8hc9hdbkleingk2jjhsh0whf;1:1jh8j5chceiofh2jgikinohfpizqj2th8wj6;2:9jhaiobhgcj3eh8fj7jh5wj1;3:1iv;1:bj7;2:hizjk0;1:1isjhgqhdtiswjy;1:llb;1:8jtaisbh5cjxgh9rh6uixwji;1:qj5;3:kiuoij;1:go2ih8jgx;2:ak9fgyqj6;1:ajwfgu;2:gjz;1:1hg2h94ngahcojbwh6;1:0hg2mz4h46hc7jk8j29iybgseh4fhhghhhh2nivph5ugywj3;2:0j12fd5is6h47l5kilogtphdqmjwgl;3:8izdhh;2:chhtjv;2:8jy9hebhcdjpeh9kj0mixrj4uhewhg;1:2hg3jv8h79jncjbehamj2ohfqh0wk7;1:kix;1:9ijdixehfkj1;2:hjfikpjhfrjpthb;2:8h3bh4gkalkr;1:9infh9gj4pjt;3:uis;1:7is8ip;1:qivsip;1:0hd1kn2k04j76hb8gg9h9bjacjwejchiuihgjh7kgonhgpgwqjtsgwthcuhfvh6wgj;3:2jx4j37jhhiqjgzrhcwim;1:divhitjiz;2:4hf6iw8kz9gmdgaekighehizil1qj5rgvsjgugovggwhb;4:gj8;1:7jeeipgj0hgfjh4siwuk1vh3;1:din;1:rik;1:diveh7;1:ajnfh2;1:sktwhb;1:2jy;1:vio;1:6joaiymiq;1:wil;2:3hd5m67kehh7jh4rixwhc;1:8g79krakacgodg2ekofh6girhj4rh1uk9vgz;1:ah4bgygkgkjxwha;1:diw;1:nje;3:ggojjyokmpirqh4;2:1j1;2:9jj;1:jll;1:fisuip;2:uja;1:ij1wil;1:8j6;2:fjx;1:8hcgk7ij3;1:jj7;1:wj6;3:gjo;2:kj3;1:jl1pguqjasj6;1:8k5ah1bh6ch1ej0fjfgj6kjnljpphcrj0thbuh3;1:fjc;1:qj4;2:9hfnm9;3:ajcgitjh8;3:uhevjl;2:8gxbjkkhhtk0;1:pkg;1:fj1;1:cm3wiw;1:pip;2:4jw9gwal8bklckfeg5fgvgh3hh2kl5lhgnhfqk3sh9tgxwge;2:6lk;2:9iljiokionjdphe;1:nk6;2:1ki8iv9hfaiocjlhjclhgmh5nh3ohbrluth2ugxwhd;1:ginkgzlisnimoipqiw;2:6h9vis;2:qj1;1:0jkajtfh6gip;2:bj5cjsfghgh8hmfjkrqhfriouitvhgwg2;1:ojspha;3:jim;1:bj1;3:ah6fjp;3:8ir9h0aheekx;1:8gx9h7blvehgfjfql0whe;2:gk2;1:pjr;1:4h9ok9wj0;1:0h41hg3iz4h16hg7hc8f39ipankbh4djeefsfh8ggkhl8jghkg9njloioph3rirsk8tgmujyvj2wgs;1:1g52j1gkzrhh;5:8mv9h8bh8ehhjhbqkkrj8shauh4;1:lj6rj3wha;2:fiqtjuwjl;1:6h87hahgojh0pgoqo5rk2wj7;2:8ix;1:nim;1:3lmcj9jhboj5uinwgz;1:ij4wjs;4:4ip;1:7hf9j6ghehixjjwpgiqipsiztj4wjo;2:jiw;1:8ls9fgaggeh9giyhhfjkm;3:vk9;2:bjiciu;1:8h39jobiq;1:0hc1gq3gr6h87h3ao4cgyfh5gishhgjiwkgxlhemh0ninpitqh3sl0tgyuir;1:siq;2:0irqhgrj1wlo;1:1ha4in5jdaikbgrcitekcgf7hitjgpkl9lionj4oj8phdqjcrgwshaug5vhgwgl;1:rkk;2:lhgrjc;1:jjoqgo;1:0j13he4hb5hg7gn8l99jjahebhach3eghhh3jjlkgklhfmmenilolzpgeqh0rglwjf;1:gjfjhdwj5;1:3jn;4:5h29isjjl;1:giu;1:qkawhg;1:jip;3:ghbqj6;2:piy;1:9kmbjeejhkjcwgj;1:2ik4jb5h56j88fh9fobikegrgh5jiokiwpjxqj4rgfwhc;1:ahankz;1:0khwhb;1:mhbwkb;1:cjaghfske;1:1j1;1:wir;2:3iy8hdah8bldegsfiygh6jgbqirwny;1:rin;1:1gc3hh4he7hb8l39klajacildh5eh6fgxgj6hk1jh0kirlh4mh9nhdpivqgorkxtjeuh9wfu;1:qjwwh7;1:djyjhg;1:qjx;1:7ij8iyjhfkjc;2:fis;7:2ingj3jh9;1:8fm9omaj6chadfseltfgsjgjrgzsjitimwhd;1:chajlbogrpgqqizrl2wh3;3:0h41h32mp3hb4it5hf6h27he8jn9hdbh7dg2ekvflbggohkaijjjggkgylivmhenhdohgph4qgjshetjtuhhwg1;2:gjz;2:vmi;1:ejchhe;2:0ipaiodgwekciimwje;1:gim;2:0fa3mclj0mlhrhcuiwwh0;2:dinehf;3:dhdkh9pk6ujy;1:1kfjhfkirnjeojaqhbuiowgl;4:einjiv;1:1go6gx8ll9jtehgkghul6vm3wh3;1:gip;1:2gsaj8jjzrh6sh3vkm;2:0jd1io3h94hh5hf9hgah2bh9chgfjhggxkilnh3pheqk8rhdwo9;2:jiy;1:eit;1:7jqaiufhbhl0qhftjkwgn;1:3ir8il9hfkhbmjqolaph1;1:bhbhivmjdrhgwil;1:rj5;2:bjwlhg;3:wkq;1:9ip;1:3j7aiybikdhgeivfheqhg;2:jjewhg;1:2j93h66ha7is9hebgregegjjhkhjjbkjqlirmhhnheogzph3qgmsikthbuhewix;1:rjq;1:fiohjh;1:rjs;1:9iq;2:8gw9jy;4:firsj6;2:kit;1:8kg9hfahe;1:kjcqix;1:nj9;1:wke;1:4lcaghejkfl1ugv;2:0hg1jj3gt4k65h76hd7mbahcbggelwgjzhhekgvljkmh7nh7ohaph7qiorg0shbvh6wgd;4:9heaj1rj1;1:hlirfi;1:1lqkhf;1:6irqj0;1:bhgkiomjcoikuiv;1:oil;1:5joiitrhf;2:4ixdiluik;1:8ijqiz;4:jilkiv;2:jjn;2:2mmwhg;1:0iz1jxkha;2:ak5bh9ciyfjimk1sgt;3:jiq;1:jh6qkc;1:nll;4:1he7l18ik9jtaj8blwcjeegzfgmghajiqkinmhenhaphcqhfrgvsiqthbuhhwgl;1:bgscjgqiu;1:aj0;1:jhdohfqk8;1:aiukh0oh7ply;2:3jdbinfixjgxqjkwis;3:okhphdrjd;1:9iywje;1:0nj7h9phgwgn;3:9iraip;2:bgkeh8fnygh5;1:hisrhf;1:pmj;1:bjqjh1kiyqhcwkf;1:7hc9grgipiiojkhqm2whb;2:ahfbj6fhekjiljlrh0wja;2:titwj0;2:8nz9fcah1bhd;1:tiv;1:8jf;1:8io;1:wj6;2:ak4bhcclefh7hj9jhfrh2vjf;1:cfvrkm;4:3it;1:hh9rj1;3:6n47g3wgq;2:airjiu;2:lku;1:9iq;3:gj2pkzwh4;2:ak9llmnhhwhd;1:8g99gwagpbnycggjkd;1:8in;1:8iq;1:8il;1:ajvbk6cjndhcej5finghakizpjpqhbrfiwgy;1:fk7;1:fit;1:eixjhcqjd;3:8iy9h5;1:8jkago;2:ej4;2:gixmjf;1:5j0hiqjh9pizrimwis;1:2l33hg7itqhawjn;1:agwbhfgkakkpqjxwh4;1:0kj1h74gxjjwrhgwkc;2:sil;1:1iohjfjkwrfvuj6whg;2:1ik2iv5hc6h37h28ki9hgaiuch6ehbgg5ihfjj7kk1lhbnh4ojnpjprh8sjjwg1;1:pkn;1:jjp;1:3iq8ikaj4uhc;2:3iqbh5dj6rj5wjr;1:3he7hb8geahgbj6cgxdilgiujk8khbqlctjluhcwgy;2:2fm7l8aipbjhehajiutiowh7;1:5in9iu;3:ailgk4jirlj9;1:0kb;1:8hc9h8ak6bkegktthguhd;1:1g38h89j5chggphhgpjjdlhenhgqj3rftwjc;2:4ip;1:1ik2ix3hg5hb6gk7gu8k59hcch5eh7fgzihejj1kj1lhcngzojbpiyqkjrhbsjcvj4wgh;1:ojs;1:ejp;1:6jduin;2:3inuip;1:2hd3ji6hdcirdhdeitjqgqfrwgz;1:8he9im;1:0gu1gm2h43gg4k45ha6j77ga9jrbgudjweh5ggrhh3jlpkh7lhfmhcohcpjuqkyrk0skhugavhawfi;4:jkf;1:9ik;4:3ki4ir8h99ivcisdh7ej6hivuhewgu;3:5h6wk5;1:shetj0uja;4:ch0tk4;1:hilrio;3:4hd5gt7h18g99l4airbh1cgndknehdfgtgiohhejn3kh9nitoftpmnqgmrhbthduiqvhawiv;1:2iq4k87hg8gf9gsdnkef0jloqhbuhgwh8;1:1hb2hd3gf4h95lz7j18kk9ezbgacgldgfejwfh7hh7ijhjfvkinljzmh3nilogwpg9tinuj5vh8wlr;3:jh7qke;1:8ixajdbjxhgr;1:oit;1:4lginmjixph6wh0;3:fir;1:uiy;2:8hf9lb;3:cim;1:aipjimtit;1:kkjlgzphgqkywhc;1:6h67hh8h8ehggh6jh1kh7lklnkaoj5qh7rixuhfvnnwh0;1:jit;4:8k19l8ah0bhbmipnh7;1:bjz;3:8iljhcwk0;2:1itgj1;1:7ha8j7akabg0cl2fh3hjgij7kjyph6qinrgzshbuhf;1:8kz;3:rin;3:9j3;2:tk4;1:rix;2:ehfqj6uj2vix;3:5kf9hfjixriu;1:8io9jqaircj0fh4;2:8l09h4pki;1:9iv;1:njs;3:nj5;1:9j0;3:ajz;1:1h3ahgbghclegh2hiojjhkhglkiohaphdqh0rm0wh7;3:5k7;2:wio;6:ah1fk0jjz;1:fjrgilslauh0;2:jkkqhhwgx;2:gh1iliwhd;1:8ki9j3bj9ej3ghdjivpixqhfrhdsjltgowh3;2:2ip5ik6gw7h28k69j6ak2bjccgnegzfgggfzihbjj6kjblh7ngxpiuqiurgusjdtivwfw;4:2km8j9ahg;2:9it;1:rjg;1:fis;1:fk1khb;2:0h81he3gz9gxbgdcgldhbfgsgikhppihcjngph8qivrhgtlvuhcwfp;1:nj1;1:0ge1ku3gp6h97gp8h89jfafzditefxghbhitijqjk1klklh3mhdnh9ogyph0qiork9sj2uh5wip;1:3h48jjainbj3ch6fkhgh3hj7jguqh1thgujt;1:6h6dhgojeqjtthevjh;1:8j49g5bh6clufl5jhgrg7wjn;1:ejy;3:pir;1:1isfja;1:0o76hegjhjhhwfh;4:7j5gjpjhgmivwh9;2:gio;3:1hg3hgan7bgbfh2ggdjjnkilmhesmjthduh2vhfwgz;2:qj2;1:2ml4hg8hcfhhgh9jgblizoh6phdqivrh4sh9tm9wkq;1:0gdej8ikp;3:hh9rj6;1:4j0nirtlnwh4;1:fislj8;2:al4fh9gh7sje;1:8h4bjgciqfjrgh1hjmiiowh7;1:0he1h02io3gr4go5jd7gf8kz9habhcciydgvek9hivih5jfglh7miloiopgsqjzrg9ugfwmk;1:9ipbhgcjlfj3jhgmjfrha;1:jhewjg;1:0jw1h2aikdinkiwpis;1:0gt1gu2h93gz4h26ij7gx9h9ahabg4cjveh3gflhizipmkg6ln1mhgnh1ogxqhfrlgugrvjywg9;2:kilrko;2:cik;1:8ik;2:4is;1:biu;1:6knwh9;1:djjehfok5qjnwh2;1:8h7dg2emcgja;3:3mtqh5;1:cir;1:3hh7h08ilakeeh7ggvhirjjxwj1;2:3hd4he8nt9jubgneh9fhggh5hiqjiqkhdljwnhaphfqhfrjeth6uh4vhfwio;1:4lbfj3lk0qh3rhc;1:gim;1:ch9rkawhf;1:cjylk1;1:rjwwhe;1:2irbimhmjrh7whc;2:8il9hhcjkpj7viu;1:jjn;3:6h9vis;1:ej1;1:5j4;1:aip;1:ujk;1:fij;1:0ha2iq3ha4h25hf6hd7gv8kgag2bjzck0djaekhflbgjghikjgqkgalgpmh2njhshatgvvhewgq;2:6haviy;3:njm;2:wis;2:kilvip;1:hjatil;4:1ha3hf7h98heahgbkjch9fhfgkyjj5khblhcqjorj9skgthbuhewh7;1:jg9qhdrj6wml;1:aisjiysjsugu;1:0iy7kc8fb9lydf2ephfh6hggqhdrgouil;1:5g5wlv;1:djasik;1:8hgainbhcgjljj1likrjruh8wiv;2:qj9;1:1hf7hebl2chbgk7jjakhclhcqjsriw;3:0io1h12hb3im4ln6hb7fo8ij9fxakndjzfkegghijvjgmkgkljomh8nh7pgtqhgsgvth7uk7wh9;1:8gp9k6nj2pj8thgwix;2:bim;1:1hfahdgncjhfqk2rgnwh2;1:kimmjf;1:7ip;1:gim;1:lh4rjxwhb;1:0jb1g33j26hd7hc8lyajfbkfdhbeghfjeiikjfdkhemlynhfohapgmqjwrdbsgztgvuilwj0;1:hhcjj4;2:ljt;1:bjw;1:ek4ghhujkwhc;1:eiz;2:pjr;1:7kg8h5hlsrhb;1:1h53jl4hg6hf7he8jc9mpakxdh8eg4fglgizjgikj0lj8nhfoj1ph8qjsrh5shfth1uhcwfm;3:3je7k18ijajffhewhe;1:ql2;1:bipeimkhglj7mk4ng5wj9;1:3hc4h46hc7hg8ks9m6bk3cgzdhdegqfipgglhhgjh0kkdlhenhgoitph4rhfulewgg;1:0iq1iy3iq6h67hb8l2aggbgifgnglshh4iixjkulgdoiwsg0thgugx;1:5iufhfgiykhellwnharhg;1:mjr;1:tjvwh8;2:njc;1:wjh;1:1l88gurgr;1:6lxhj0veo;1:gj8;2:skoukkvh3;2:bgnfkb;3:8hc9izdivsiq;1:5kujj5whg;1:3j28hgeiyhh4jkmqgsrh9wkv;1:1h6wk4;3:agefkyuil;3:rio;4:fhdghchkpjj2qijristj7wha;1:jj5;2:0is2ke3me4g96hcghgjjvqgutheuipviuwgw;3:vj7;2:0ik2iv3ixah3bh9diuehegg9hj1jh3kh7mkjnjyoh6shcwik;1:8jmajrbk5cj9eh2kjjnherh9wha;1:5ji7io;1:hje;1:1hb7hgahhbh7gjthnnjh8khcohaqh3rjfsjpuj1wh0;1:ciwrhg;9:0lc4gy8ji9gwajofhggirihfujvwh1;2:9ir;1:9hcek3fikjimphgwje;2:hhgij2jj6wjr;1:3hd6ll7h28h59iscivjgpojbqhdtjsuj8wha;1:9kb;2:0in1gz2j64h16ha7gw8l79laaiubizdhaegwfgkgh6hinjm2kjblhbngyogopgxqgdrh1sioth7uipwgf;1:4im;3:giu;1:8kfrj2wgy;1:qim;1:jkf;1:dhaeiu;2:7lw8l09jjbhaqhb;1:1hf2in4im8j59g7agxbgachfdiqel0fhggolhjyjjyogopjhqhdrfbsgywgn;2:sinwis;1:0hg3he7hgahfblhcjjejigkhhhfkh5nhaohfph4rhcsizth9ujfwhc;1:gilrjb;2:qj2;1:ej3ghf;3:gik;1:1hbhjbjikmkarh4;1:dgxejb;1:0hb1io2hg4hg8ir9j6aiybh3ej6;5:8gzhiujk0;1:7hgbk7cjngjrhhdjkqogvrh9thhwgi;5:ril;2:9kxaggbhccivdh4fiugh9jjpnjxrj7wh9;1:hfnrknsip;1:tk9wh9;6:8iveim;2:0h11di3iw4h75k97he8f99hfbotghfhh9jhdkt2mh8nhcohgshhtgdugkvh9;1:7hf9h9bjscjsqjvrhewiq;2:wko;1:0jm;1:qj7;1:8izdj3wjv;2:cj0dh9ejejfvwkn;2:dhafji;1:pj2;1:rjp;1:8k3;1:diyjjw;1:2iu;2:2h73jb;1:2j3ailfgygllqkkrhgsjquhcwgs;2:mkyrgp;1:7gwojmqivsks;1:8hakgpnlh;1:bhhhhblj6qit;2:2j3;1:cj9;3:chgrit;1:fjphizrgk;1:8j0;1:3j74iu8he9gkak6bkagkqjhekhbuhcwiu;2:8ilhh0jj5;1:6jl8ivahfbjtchedj8whb;1:fj6;1:9ipakebhffjowh7;1:8jd9jmrhc;1:2it3j24jk8gw9h3afxdmqefjpj9qhcrh1sivtj1uh8wjq;2:1kpajbjgbrk3wh2;1:bjdej5mj1rjdwhf;2:1ir3ha7hbcjyhhfjr3ohcpisqgdrgzuj3wh5;4:cjsghejgoqk1;4:8j59ha;2:9hgcjoriuwhd;1:1im3jnch2eilmje;1:1ilbimhj9jjcrj6wgs;1:5jhgj0hgkjkwqhe;1:vis;1:biliij;1:0ik1hb5jvbhfghdjjfmheoitqj9tjiwj5;2:2jb3h7gjdtir;1:iil;2:jl0mj1wh9;1:ciq;1:7kagk5oipuhcwh0;2:2ji4h56js8hcahcihbjhenhfpjduh9;1:fj5gis;2:jj7;2:2ij4it6gxvjj;3:rit;3:0kojhcmjtoj1qhgwhb;1:0h51fz2jy3hc5is7gu9heagabh8cg3djaeg4fgfgm6hnfihbjmlkhblh6mgvngvoglpgeqlhuitvjkwfb;1:6hc9jjagqck3fhdqjprhcuirviywg8;2:5j0fj0;4:ciyrhc;1:4jn7he8gwbh9ddwem0fh9gkeijjjilkhfonepgqqhdwgk;2:8h79h4ejyfjctj9wh9;2:niq;5:uj2;1:wis;1:8mregzjhawjy;1:dlsef4;2:8iweik;2:9h3airbkdch8ghghirkj3rhfshguk8whh;1:2k15jc7jf8iq9j5ahbbhgck6gh3jh7phbqh7rimsilwhe;1:0hg1hg8gx9hbailbn6cisfh8ggzhgvjglklmlh3mh4npwoh9pjwqh2rgpth7uh5wg5;1:gip;2:7iv;3:wit;2:9imjhh;1:djuegh;1:8k99h3;2:civgjk;2:8jqgj7kk8lh0;1:dim;1:8k2;2:pkl;1:2ijbh8cj6jitkjargv;5:an8ckgfjgggfhgwkhenhgrgwskluiywh3;1:uj2;1:hjd;4:fivlio;3:1k9;1:5ithiv;1:0kack5whc;2:3k2oix;2:2gy7k1bjiehg;1:0je1h2;3:ij8;2:8kiehbhjm;1:8iw9lmbh6cgxdipfj6jh5rhbwhd;1:ejy;1:bisdh2ej8;3:ch5jjd;2:5lg7hbqilwgz;3:ujm;1:dheeiv;2:0my1he4h67l18h59lmbh9eg5fh0jipkhdnixpggqgqrk7siyuhewgh;3:0hd1il3h24h35hb6hf7h68k49n3agdbh8cgxdixfh6gh4hh8jg0kiymjvnl8oh0qh4rhdshhtkduglvh3wjl;1:bit;1:9iyhh3ljlohariw;1:civ;3:8h8tk8;1:8iq9hdbk3fklgjjpk7rhgwgn;2:uip;1:0hf1hh6hd9ixagqckteh7hnjjj6phcqharizshgvhbwfp;4:8ju9h4;1:ajlojc;3:giv;1:ois;1:1hg3hd5lj7jn8gmcirehafh8gimjh1kh9qgurlysixuj5;2:9it;1:8j69gnaimbk5cjljjikhfojgph5qhbrh8;1:0h91h23jq4h16ha7h28kfagxbhcdklekigikhimjh9kgulg0mh2nk3olmpgdqfrrkmsh7uhdvikwfs;1:8iv;1:4jaghgjjsphh;3:3hd4je6h37hc8hb9jocj8dh2fggggphkkjimlj2nj0phdqgvrfssk2th1uk7vk7wgh;2:ahbfh4gh8hp4jhbrhdtjcwgz;2:6kbcjhjhgsj7wgp;2:mh5oh6pn0rhhwh3;1:elhghdwin;2:khfmk1;3:ohcpk2;1:qjuwh6;3:0hb1jo4h75hb6h4alkbfdcjxdh1ej8gj9jjilhepgvqhfriwshbth6uh5;1:nik;2:chgrfuwlb;2:8jinikwjo;1:3ha9h6ddxemikiwlh6mm3rhfuk2vh4;1:dh6eiu;1:2l9;1:9iwuil;1:6hcaj1bjicjfghbjgmrgvsimulcvg6wjj;1:pl7qhgtkrwh2;3:siq;1:oj6tjeuh7;2:1iv;1:8h49ixtir;3:bj5jiq;2:fj0;2:jis;1:jimviu;3:5j3riq;1:aj1cinhhckhfnknqizwh1;2:qipwij;2:2ioilcjhflk6whc;1:0h21gs3gz4kw5h66ha7h28ld9iwdj8eh2ggghhdih7jh7kl4mmbnm0og3pg6qh0rgdsh2tizughvizwf7;1:dgbejxgj9kis;1:jit;1:8iz;1:fj0;4:9iragzbkwcl5dheeikhhgrhd;1:eil;1:9it;2:njm;2:jiu;1:0is8h8gjgjkfqh1sjq;1:ajrkka;1:1jp2kc4in6hf7h78gw9hbbjmck8hj0ihekh0oh7ph7qk0sgwthevh7wh8;1:3k09hefhdgh9jgiolbuiqwkh;3:rj4;2:hgqrk8;1:7ki;1:6hhphdqlewhd;1:fhagj6vil;1:5iowjg;2:vik;1:1gm7he8gcagnbkkcjgdh7egbfl4ggohk5im2jgxkh7lguminnj7oh5ph8qh0rk3shgthbugcvj9wiv;2:ail;2:5ix8hcbkpgio;1:8isejtsiv;1:1hh9kmairdgyfh0gknjh4kh9mhfqhhwiq;2:cj1;1:8ilgj2;1:7ludisjhfqh8wh6;3:9jqihcwjn;1:jiktk6;2:8ivhiyuj2;2:0hg3h84h86hb7gk9h3ajxbgzchdfg7gh6hhakm9lkimh9nhbol3rg9thbujvwko;1:0h73ph4ik6h37h98im9iqah7bh2dj8ef0ggjjhakgmlhbmhfpgfqjssktvh3wjf;1:8jf;1:ilewh3;1:oil;1:0hg1il3js4ik5iw7h5bh1chfdh6fh8ggxjg1mh9nj8ohfqhdrk3shgtjouh5vmiwgy;1:biooj3;1:8hbeitlip;4:hiu;2:5ivpjc;2:0h04gxilsjilliyphgwji;2:cik;1:hhejh5pmcqjm;1:rj2wh8;2:bhgciphiw;1:9j4aixehfgix;2:ajdfh1glfjh0qkerh4sjrthfuhavinwh1;1:bgxrk6;2:3k08hbbikjgzrikwke;3:vj7;1:1gs2jo3ik4j05im6gy7h98gdaitbhgcitdizegvfhahghijjjlokinoitph5qgrsiptgyugxvji;1:8hegj5;2:bjh;1:hit;1:aizuk0vhg;1:dj0sj6;4:2jf;1:gj5wju;1:dh9ejejg8wkt;1:bim;1:9j7;1:7jb8izjlaoh6qh6;2:8h69jc;1:fh4hkuuhfvja;1:oiy;1:4iv;1:1j33jz6h77gw8h89hgajpbhghiuijsjhckhdlhgqmjwh2;1:sk7;1:2lhjhb;1:ojs;3:diwuiz;3:rjn;1:3ju5m76h5ahehjwjg2oj7qhfwj6;2:8gv9jh;2:bj6jizljq;2:jil;1:8j59hg;1:dis;2:tiv;2:qir;1:0hb2j74he6ju9gwaivbiudhfeh4fgpgjfhj9ih1jfukgelhbmjfojupgyqj3sj5th6uh6vgiwko;1:eio;1:8iv9h4andbijcgmsgcwio;1:1iz2io3gz4h65ha6gw7gi8km9k0djkeixffvgj1iiojhdkjypgpqhbripshctiruhcvgm;2:1irdilejajixvhc;3:0j21ji2hb3h05hc6h27h49j0bkjfhggh8hh8ihgknalh8nh2oghqgtshguivvik;1:5iraiugimjh9rh0wkx;3:3khblcfgngh8hhejhdkjethdvj2;1:jh3qjl;1:5lp7kjohbpikqh8whg;1:8he9iy;1:0jidisjiu;1:gkuwhg;1:kji;1:eix;1:7iv9h0akfdhcegpfktgh4hilqizwhc;1:8ijek8;1:ljbogrwkk;1:1gv3k57is8jeah9bgpcinfgogh7hh3ihbjikkg9lgymhaohdqj9rg3tljujg;2:djijhc;1:1gj8fv9khbh9kmtmkuoh4;1:4j48h79hgahebj4dgpfixjh2kkcokarg2sijtk2uiqwhf;1:8j5;1:fj5;4:qio;5:3j18kkbhfdhcej1hhbiiqjh9qk2;2:6j2wjh;1:2j8;1:7j3kjd;2:2ix3ip5ikdipggehj8jh7minnhcohewit;3:wik;2:akpfhc;1:0hd4iv;1:8im;1:0h32jy3il4hg6kf7kp8gl9h9ah1bh1dlvehefh7jhglixph4rgxsjgth9ugxvjbwgb;1:llmnh6;2:9jjdin;1:1irbjbkhf;2:5kv8jtrjrtlmugqwgm;2:8knbheehdgj7ik1jjekgbnl5ohgphfuh6;1:3j9bildgoeja;1:uiz;1:0it;2:cjefiorhe;1:0hh3gy8l89oabh1dhgefsghbjiorjutjbuh3wgz;1:8hdailbl5chbdhbejufh1;1:3og6j67h58hfah8bgscmohhelh3miyoizpgtqh4rijvhfwfa;2:7j0fj3jm8km2lfpphdqhawfx;2:0hc4h1ikr;3:8h4tkp;1:3injj8qh9;2:8heahgbksdh6eixfh6gjqhjnjgvojlphgqhewj9;3:6jl8gvah1bjhdirkjzqh8tipwjj;1:bhddh7em0fkxghcrh1uis;1:liz;1:1gw3hg4ha6he8gzahggethl7invsj1ulwwhb;2:8jzbhejjjmjephawh5;1:ah7dhcflc;1:2jhrio;1:0j8ch3jjk;1:ij6;1:3he8k2bheckfdipjiuqh9uggvjz;1:3jpsim;1:0o51l92hf3h84hc6hg7hg8jjah2cjwejaihcjgkkgalhcmh7oh9pgvthgugy;3:ojb;1:2hf6j8;1:9io;1:0j9;1:2j4diwghf;3:0h03hb9jedk2ejufjpmh9nhfph6qhcrgushguj6vilwh6;1:3gv5h88isagpbh9cjzehcfh6ginhh9jq4nhgph5shcthguggvj7wjn;1:oji;1:rjiwim;2:9isrg5tm4;2:dj9egwfiv;1:8fqtl4;2:flnwhe;1:1gz3jy4hh8mg9h8bikclmdhgggkjinkh5ohdpiqqgxtj6ugn;1:qjx;2:1hacjeggthkn;5:ril;1:3ij9hcohgplvwio;2:4it;5:2jf;4:6ks7he8h3jhekjlml3oj5phcqh5rhdwgo;1:jixtit;2:dj2ehhrij;5:oiv;2:8jseh5ghbhgtjjfkj9lkunjuohdph3qhgskbwgd;2:0h78ivdizegngkphgijjpqh1rk8six;2:1ixrhf;1:mip;1:1j83j04h99h7jgskixljbwgf;4:gj8;1:ajcoiv;1:4j0giz;1:5j0wik;2:lhcoj3pk7;1:ehgfj1;1:1he3hd8h3aj5bipdgxeg3fndgh8hj0jh8khhlhenhfqgwrittk8um4vhbwh2;1:aj8ghe;1:jiv;3:aglch8fjqjj9nk8qiyrjn;1:wil;1:5j98ipjhfrjisjstjdwha;2:bji;1:eix;1:siuviz;1:citdkreh2;1:4mkjhfphbukc;2:8iw;4:4ikahefhbgkplh0rkd;1:8j1;1:5l3;1:pheqjdwk9;2:pl2whf;1:ahafjp;2:8gu9kmch9rim;1:4h8ahftkmuk0vjhwgi;1:jj1;3:8hb9jgcjfkj4;4:0he2jz4lw6hdafzch7hesogwph7qjhrlusijwjd;1:hkrrh9;3:ahbfh5ggnhoxjg0qikrhewk6;2:gjm;1:gj2;2:jiw;1:3hd8k69m5akebm4dh7eg5gh7hh9jg7kj5lgsnhfqilrgsth9uhb;1:hgqjjfqjfthf;1:0iu;2:0h81h83gx4hc6hh7hg8g09geaohbgocjldgjeglfoggjkhkfjfvkl8oh8ph5qghsh6tgkugzvh9wj6;2:0hf3h84he6hc9gpag4bmuehchhgplqql7rh7sisuiowfg;1:wj2;1:cio;1:cj2mir;2:0hd4kx9gzahgdk9fjughdjizqheriyth1uj1whf;1:5jj;2:8hh9glak8bkggkuuhd;1:sio;1:jik;1:1iy6jx;1:ekpgh8;1:6gpdiqvjm;4:ciq;4:gjz;2:8k09ikaivdh4ek9jgswh8;5:0irjkc;4:8h9gkx;1:citlj8;1:0ny3hgahdjhcwh4;1:dj9egw;2:jj2wiq;1:6gqvje;1:bjjehg;1:rh5wld;2:1hc7h98kc9iobjdcjrfmkgitkinmhgnhcphbrf8wgp;1:8il;1:cit;2:8ireiphhgohgpittiu;1:mjb;2:2j44it;1:oik;1:8hf9iy;2:bjhwj0;2:jiqwjg;1:gjjih8;2:aiq;1:1jcrh5;2:8gu9jvpip;1:8is;5:0j7;1:gj3;5:oh3pj3;1:6ha7lzhipjgqvh1;1:9hbejw;1:1h92hg4jddioeh8jgjkhflgvnhgolppheqivrj6tjduh1wjy;1:fh7gjmqk8uixwh1;3:ghejiwuje;1:8io9j7dh8iirskmthb;1:qjd;2:2ju3jp4k15hb8gwagtch5gh8jgvnh4oj1pgvwk7;1:8kc;1:khfpj6;1:oin;1:8gxbo0oirrhatiuwh8;3:jiwwhc;1:gjkrim;1:0ha3hc4hc6h97iw8ha9h8ah6bh7dj6fqngkdhgxjgykhhmhbnhaph5qh2rgnukdvjnwfv;3:0iu1kmwkc;1:rizwhd;2:ahbdj2jjskjowgv;1:tj2;2:cjc;4:2imjhaomqpgluin;1:8jqahgjinpip;1:ij4jjmrh4;1:1ju5gyojmwjn;1:4ip5k77hffixghehj1jilmjfoh7pgwqgvrjp;1:ojsrjj;2:rhewjk;1:7imjhbwk5;1:6iyfj4wha;1:kgfmhfnma;1:ciqjit;1:9iwqkmwhf;1:3lc7hd9hbqjewhd;1:ciqjhg;1:rhewke;1:bgnfizhlf;7:2md7h48ipajubggfgnhkhjlbqh4rgtwhe;1:qit;4:0hb3hg8ik9haah7bisch8dhdfgtggmhpdjlbqk7rh6th7wgk;1:wjr;1:ahecilgixhjkjgwmiuwj1;3:8is9hghh7rjauiwwim;1:0ha8hdch4fjghhekhglhgpjqrj3uhcwjj;1:6kowh9;1:1h12h03j24hh5h87jpagscl4egxfjqgiohgvjjilhcmheph4qh5rkdtjpuh9;1:iiz;1:7h88haaj3bk8cithjyjh1kipliknjsqiurgksixuh2wh1;4:2j8;1:0ir1n36jrkgsmhbngpsisvgf;2:bincio;1:jh0qlj;1:1h4cjzgjshggrh4wkl;1:9imjhh;1:5jdfiskilphgqko;2:wjb;1:wjg;1:0jg1h0;1:uh0vk2;1:1keahdfj7gj0iiwkh4nj5rgo;1:7k1whe;1:8jr9kdaiwbjwfjhggzkitnhdrgqwgz;1:bk2cgvhivkj1;2:4j2;1:kj5;1:8h79isbj1dkdeftjharjn;1:8jgbjbvke;2:agtfgqgl1hncjh3pjarh6sirwgs;1:hj5;1:dj7ehcfghgl6hgjjl9rgdujrvh1wix;4:7jfjkjwg9;2:cje;3:4k7;2:ej9jh7qjx;1:7k0iiy;1:oiq;1:hharj6;1:jjdmjewhb;1:8j8sjzuhd;1:8j6ejshheriz;1:civ;2:vjx;1:jgqwlt;1:1gs3hf5iv7h28kd9g5afjbg9cj4dikek0fh2gm2hkwjinmilnleqh3rgksh2th0vhcwfy;1:pmhsitwgg;1:0ik2io3ik6gk7ldfiyghgihfjhephasj1uh8;1:0h81h53gw4h65il6gs7ikahebg4dj8egqfn2gmiigzjg0kgzlk5mhfnh9oheqgurg4shgukrvklwgs;3:1ivfjjghgwj1;1:pk0;1:7iyhjqnikuik;1:7h4ljuojq;1:qj7;1:2hf3h04jp5iw6hf7j98go9irahdckxdmgeeyggwhhfkh6mh8nheoheqgariuskougrvhcwjq;2:3kq4kkcikdgaem6fgdghejhaoj1uhhwgy;1:fjdwir;8:8h59j2dl6egq;1:pm8riwwgf;1:8j19jvajzbkvcjqegyfgfjh2kj4nhdqinrh2wgs;1:8hf9h4ahbbgncgsdjten7fj7gkuhh3risugzwha;1:9iv;2:2hc4jh;2:4iv;1:1inliz;1:2kc3h94kn8hh9k1jhfogypisrh8tiu;3:cjvhipijg;1:kj1liz;1:3hc9infjdik5jjcwg3;2:jk0;2:8k5;2:0hg2md4he7j68kk9g8agqgjghgsjj1ogwrj9wil;1:bilwjg;2:9ji;2:gh3hixjiltiz;1:6josizvhdwhh;1:0iy1kw3m54jj5h46hd7h79f3chbdlpef3giqhj3ikclhdmhbogopgwqh9rgksiqth6uguvhdwjg;2:3ik5j4tis;2:ij6;2:oiq;1:wis;1:1khnk3okhpgrqhdripwh4;1:ciz;2:dkcfhfrj0whe;1:0it2ju3k04h7dhheh9fhfgk8ij8wh5;1:8imbj5hjpojdrkqwh3;1:8jh9hbdl5egt;1:5jd;3:aj8rjl;2:til;1:0lw8h3ejvjhhvhbwh7;1:kjurhb;2:hhejj3qjd;2:diz;2:8j5;3:6opgimqh8wgq;1:2lawh4;1:ijj;1:1j5;2:hgkjjw;1:rg2wlv;1:8ip;1:jjh;2:jj1;3:3hd7j29jbcjxdjlehdghbqhfrg6tjvuj4vjfwh0;2:4h66k47hfjgzohapgnqgvrh0unxvnlwgk;1:lip;1:oj4;1:ej7;5:jkkphfwhg;4:4il7he9heaj9bhacjxdhgeh9fhhggghjdjjemj1pgpsiutipuhcwjg;1:ikf;2:mjunklwh1;3:gijnir;1:mkknkuwfj;2:kip;1:9isaj8jkvogqpgpqisrkqshdwgq;6:ug4vk2wjv;1:1h9bjqrio;1:0hc1g52h43gt5h87j58jgah7bklcivejsfj4gg8ihajgokgwogspheqgtriwsjttjr;1:sj2;1:8k1fkbjiyqgx;3:3jbqj6whc;1:5j09iucinej9ghajhfwj9;1:8ix;3:fgsglwwhd;1:wio;2:ciy;2:ggztk4;1:mjb;2:6iqhiz;2:bir;1:ejhjlhqhhwin;2:ajtghg;1:ehejh3pnpwg8;2:9ioamdfhcggdjj6wk5;2:9ghejdrju;1:aj5fjfkhctis;1:niooje;3:aiz;1:1h8ghfhiuinvrik;3:7ji;2:kjwlha;1:1h94jqoh8rk8whe;1:wjf;4:dikejjghfhilrgz;2:fiz;2:8jsah5;2:1ha8jx9eiah5ch6hhejh8kj9limmh9nodph8qh5rijtjhwiq;1:3rr8hf9gycimig0jh4qhfwk0;1:3hd7he8h99ioagkckxdhbejpfh8hgjjiukhfljzqj7riy;2:8k79ggcm2giprga;4:2im;2:1gl2h24ks6h07io8jx9jdaiobgwcj2fgqhhglh2mh6ninoj2piyth9wh5;1:0kq2jt3jtjfmqj1rh4thcwl1;1:7lv8hfbj0cixhj1jfmkhcogppjnqh4rm4wfh;1:8ir;2:gimij1jj9pj6rhf;1:bhbjiyklh;1:dilsir;1:ajwjizuhdvitwha;1:1km3im;1:ojyuhe;1:1jp;1:ohgpir;2:8iurhc;2:8is;1:5fs7kj;1:aiyegxgh5ik7rhbujrvklwgy;3:4klchdiisohewj1;1:6ju;3:vio;1:jk9oh8pjc;4:8m89m5jh9rhfwh7;3:nilwkb;2:fiptil;1:jjd;1:1hg4h26io9klagfbgrcl2filghbhhgijzjiqmimqhbth7uinvij;1:2kd6j58k19guaijvj3whb;1:uiv;4:4ijsiluj5;1:6hd8kb9gnbjzehhgguhjljgwkjzmjbphcqhctjtujlwgm;1:0ir8iohk2jh2qhd;1:1kcrg3;1:biu;1:kiv;1:jj6uiz;1:8imjgsrjpsinwjj;1:siw;1:8j1ahg;1:4ikeik;2:wk4;1:7j0;1:ak8cj5fh1rgbsjq;1:bj2;4:aiw;1:4ik;2:1iq;2:1jn8hcaivjkgripwj7;1:1h53k25hh6h68j4bjcgh7hhdjjcmkvnherg1th2wmz;1:ciw;1:8ju9h4;3:bilfilgixhiu;3:ojg;5:8imaiwfj6hj0jhfrgv;1:fgtglejhe;1:qjk;1:jh5qhgtjrwkx;1:oiy;1:8ir;1:9hbdh9eki;2:8gzbjthjnjivkhdqj2rhf;1:9gtejhhjbjhetkpwhd;2:wik;1:bjdhik;1:mje;1:dio;2:ahdggpikzkhblh7nkmplxrh2simuhgwh7;1:0kh8jcah0lk3rgjsj7wha;1:3iobjxdjfegqhixwh9;1:jhbwjn;1:5im8ir9h8jhaoiuwja;1:ciqij6;1:2h36ha7ixagmbhefg8gp2hmvjgspiwqherhguj1vj9wg2;1:3j4che;2:2in8hc9hdbkieimgjmjggohhphhqherhgwl6;1:4j6jhg;1:0j06h37lp8g29kmagjch9dgngjthhajmdnjyph9qhgshevgcwg8;1:jji;1:ajcfh4;1:9j5;2:wjc;1:8hgpjovke;1:aj1dh0elv;1:6j48j49hcbh7ehfhj1ij5lhgqk0rk8sh1th8ugovj2;1:ij8;1:8jm;6:wiv;2:8jc;1:0ny8gvbk4cjlqhdwgg;4:0is1gz2hc4gz5hc6hc7h1ehffh8gk4hh7iitkinlixmh0niqrkish7tinuh4vhewk7;1:hjajj9;1:hh6qjl;2:0ha4hd6iobj5chdej8gg0mjangnojsrgvtj5uhd;2:0h61g82jc3gu4kb6h67gq8g7cjadgyfh8giqhh3jkekgdlgzngwonkpiyqk7rhfsj3vh7;2:8jc9j0himjgc;1:8h2rjp;1:7k3mjhthd;1:bj2fjjuipvjk;4:6jl;1:oirwim;1:3h34he7he8hf9h4ajzbhgggpjlbkhglk0pkmqj1rgrvhg;4:bkjgka;4:ailfje;1:8q89euagjbizdpqef0ggchhbkharhgugmwhe;3:hivkj4;1:6juvgk;1:9in;1:3iloir;1:0h81hf3h49hbah4bgwcgzehafgygg5hqeihfjniphcqj4tkeuhewfw;1:aj5;2:0hd1fw2gz3gq6hd7gr8lt9kmalubg6cisdniek6ffygjqhinjf9kg2lgunh1oh0pgpqgxrh3tj4uj2wh8;3:aji;1:djtegqqk5whg;1:1iv;1:0jj;1:qjm;1:3hc8ghbiljitmk4okrph9rh3thdumawg8;1:0h41gx3h65hf6h68g09h7aghbh0clqgivhsjihcjkglgpmhenh7ol6pguqjhrgeuh6wfq;4:8j8;1:3h77l78lq9guaiwcl2egsjh1qgwrh9tjkwg5;1:4jb;4:3jo8heuiy;1:miw;2:3j08mq9lkajicjldh5eh6fgrgh7hgpjjckgvmhbohgph8qiprgsth8uh1wgm;1:7hb8il9hcbh5dkgekffhfggxjmbkhgqgvthgvikwgy;3:1h09kjbh9cgzdimfinjgrkjwmhcrjdukpwh9;1:0hd1he3hh4hf7ga8hg9gdbh5dk2em8flfgkxhh6jh8lhamh9nh7ogxpkoqh1rk3shewh4;2:agofgcwlo;1:nio;1:0ik3ge6kb7h39inagjbghdhbegcfizgg3jgzkivlkamh8njaoh8pgyqjirgmskhtiwugpwlp;4:3h08ld9ipdexeozfh6ggnhjvjh2rivwhd;1:pik;1:rj2;3:8jk9g4ckkeiwnjhrhbthbuhdwk1;1:ciw;3:oh3pj3;1:9iu;2:hh5rix;1:eiz;1:al8dj9egqghgjhgrjisjc;1:ejh;1:rjx;1:ghbjjf;1:mklwhh;1:9iwwkd;1:riq;1:tjm;1:0ip;1:0jd1kq2j03gz7gu9h9hh7jhdljqojspiwqgzrgisgztiwwgn;2:0kwdiyegtgh2jhbwl3;2:0j33l38hebivwh5;1:eitkh4ljdmk5uha;1:qjztijwhc;2:4j4ij0kiq;1:1jo2h74g65gu8h89jgbinfgwgmshj6jhbkgqmjinh0oh1pkfqforfhsipwiq;1:ljawhd;3:pj9;1:pk1whh;1:4kb8h1aj7ch8dgpehgjjsqh1ujiwjj;1:3jq9gvjn2wgj;1:khalmp;3:sis;2:0iq7jhah3bhbcjdfgzjhfmixnipphdqhatjuwks;4:0jg1gp3jp4h76h08hcahfbh7dj3egvfk5gj6jgmohdpjzqh9rhdujovikwkc;4:cj5rhbwjz;2:ak9bhdcin;2:dj9egmfjeuk1;3:bj8ijk;1:2j79iscjbfgkgk1phhshc;2:dil;1:gik;1:hipjio;1:0h91ik2oj3j24kl6j57h9ah8fhgjh1nhgpgmqgtrhewjv;1:4is;1:1hc3js5hg8h19gxdnheh8gjgjgprgitgxuisvjqwim;5:8gt9jcdjnegm;1:jj9;1:wio;3:jlfwhg;1:7hc8hd9k2bj5cgydinfh4hhgjkckhgnh2ohgpjeqgdrjpsgptisughvhfwl6;1:9irdj7;1:gjaqj2;1:8j8jhc;1:9iljij;1:9j0;1:rjk;1:wiv;1:1k9ah5bjfrkgwhc;1:bir;3:him;2:3k74io5he6h57kn8jq9iqaftdhcej4fh7gjrhgijkmohgph6qgesh5thfuh3vhgwjq;2:eik;3:6hfjgyogspl7qjnvl2wgv;2:sjo;1:8hf9j0rj5;1:wiv;3:4h16h2ah7dinghbogcpipqofuhc;2:jijqj5rim;1:6ljwhd;1:0ik6itfhagjgkgqln2nh8rh6vhawjx;1:0j31h93h24h88kd9h7bgwdh6eirfghgh1hhciiqjlakgilh1mhankkohapj2qh5sjeuhdvh2wm9;1:2hg4kv8gz9jjjh9;2:bimnk2;2:ail;1:0ke2jd6heviwwh8;1:qjv;3:1jk;3:9gvbjjch2ej9fkrghcjhekhdphfqiyuh3wlx;1:fjl;3:8jfuh9vji;2:8h29jzahcgjfqjsuhhwhg;1:8ik;2:9jkgj5whf;2:rj2;3:8k79l4ah4eha;1:jhgpknqhe;1:wj0;1:sis;1:jjd;1:6h8mjhrhewkf;1:3n6dijfg6hj4whg;1:8inein;1:3m79hd;1:1irbjbkhg;1:5jp;3:0h71h43gp4gv6h37h1alwbhachcdjueh1gjqiiqjgykg5lh7mh4ohdpgyrjjsjstkaultwfd;3:4hg7hc8h29jeah1bjjch9dj7ghcikcjk9phargdsjotiyuh3;1:ghgjh4qjurk8wj5;3:ciz;1:3j3uhfvjawjj;3:8klehc;3:1j1;2:tin;1:hjo;2:gh9qju;3:0iu;3:0io7h2jk4;2:0jw;2:bjtvik;2:8h8oitujn;1:3n77hgphbwgp;2:rkk;1:9jh;1:3iqfhdgjh;1:4j0;3:4khuhd;3:3ni8h6diwghejimrimvhhwiw;1:eh7um4vk1;1:ujc;3:dikehg;1:cgmrkywhb;2:3ki7h8divhj0jgvlhgoo6pgvqj5rh7wgp;1:0gt3kgjiskj6wh8;1:0iv1ke3oe4gc7iy8h59hhaj5chfehafj8gjvij6jgkkhelheqh5rf7thhwfz;1:ejhkix;1:3ik;1:6ljwhd;1:0op6gr8j3jh6qhfwh0;1:6hcoilugwvm7;1:8iu;1:lja;1:6gl8gcel9hixujxvjf;1:8j7dilfir;1:1he3hb5k17lu8g5cioeh7fh8jgkkh5mhgohfqgvrljsk5ujxwgy;1:kj3;1:5k3hhgpio;5:fkb;1:9jb;2:3j4qj7;1:jio;1:hiz;2:7iu8irghgiiujh5pjcqj6whd;1:0j48h19j9kliwgr;3:sk3;1:tim;1:8gc9jmbkcchheimgikjguqhfrkguhhwhe;1:uiq;1:8im;1:1gd3ik6iw7h79jaag1fk5givik6lhdmhaphdqh5rkfth5uhf;2:hhbqiy;2:8iufiq;3:1jo2h5ohgwky;1:divrit;1:kix;2:8j7qkquhewh9;1:0hc1kv3h87jl8iw9hdah2dineikfh0gjfjf8phdqnarfgthhwk5;2:9j3;1:fikris;1:kjk;1:9h9nnywhe;1:0jiejcfh2hgxujo;2:5jcdir;4:1hg4k2ohcwiq;1:ahfbk2;1:dh3eiwjjq;1:8im;4:5h7rkf;1:4mfaj5fglgh9ihajgzqgprjuwiu;2:1is3k2;1:8j0aikbjjdhbeiofj3kj3nh7qj3whg;1:wjd;1:lirrhe;2:wje;1:dio;1:djregphin;1:0h73ha7hd8o59nmafmbglchgdh9eo0jglqh4rhashbwh6;1:0ixhio;2:ckdegx;4:4j09h9aivbinckbehhrj3tjbuhdwh3;1:lil;1:oj5;1:alfbhegh5uirwhd;1:5iu8ir9gkjl9mh2nkgph2qhfwk5;2:ailjis;1:0ikrje;2:1hf7hebkuchafhggl1jjakhclh3qjrris;1:ejlqil;3:fipnj2;1:2im3ij4j67iofirghaihgjh7klblhgnikohgph6rhgsj0uhawhf;1:9hedn4efgfl3;1:vin;3:tik;3:3h84hg5kk6h58fg9mkaj8cgvdl9eh3fhagh5hh3jlzkgxmhfph8qjurh8th0uj7vg8wh8;1:piw;1:jip;1:3hh4j88lh9gpaiqckregwihcjheqhgriztjouhcwgv;2:bijnil;2:9iyaglbhghl0;3:vip;2:tjh;4:4kiqjbwit;1:ohfqn3whc;1:pit;1:giz;1:2fl7psjhfnhhoj2qgqwh3;4:jivsja;2:2l14gjujnvh2;1:4iz;1:1gz3jueiq;3:0hd1gt3h74gx5ip6hh7h79hbagmbh4ch8dhgehdfhagg9hg9jhfkh8lkwmk6nkgojaqgyrf7skntpjuikvh5wij;1:jke;2:jgwwkx;1:7h68mi9e5cg2dgvfgnjhdrhdsiwtoqujcwjq;1:ajdjghrkawhf;1:0il1g92he3lu4gp5h86he8j89h2aiwbjucljdjjeg9gj8hheijhjh5kgflh6mh6nh7ohbpinqgerf7sijugovhdwky;3:0h9djhegsgguileuhewjp;1:0j06h37kq8fk9kkafyciqehhgk8hhdjlqnk4ph9rghsguvgdwhb;2:6is;2:lj6;1:wje;1:8itairoiv;1:djlehfjj7;1:4l5ph1whe;1:wit;1:qkpvio;1:giq;1:3ne7ir8h3bk3hhbiimjgzqhgrixuhewgj;3:kip;1:khbljyoj1;1:5hhrjftio;3:kizuis;3:jivwk2;1:2ioggzjj1rj3sj3;1:bjdciw;1:cfunirrk5;3:ajk;3:hgorji;1:bj8chf;1:tip;1:8kz9h9gis;1:6jzdhcegzhis;1:aixgiktiz;1:jh2wjt;2:1j5;1:pk4;4:jjr;1:jgvqjfwk1;1:eitfiruij;2:3kz5jn;1:2k84gp7jr9imah7djteggfh8hhejhckhanjjokxpgyqgyrh4wkd;1:9ipgh7sis;1:ejp;1:8gv9j5kj8;1:wim;2:8jh9h4;1:hirpj9;1:8gf9gaagwbmscjqfjyjgkkgnlhfmhgohapjmrm5thduhg;1:2io;3:olmpft;2:3ij;2:1j6;1:skiwiq;2:dmcefs;1:pmkwgi;2:8iw;1:0gt3ha4im8hb9iwah9bikdkrel3fk9ghbihgkj9mh5nhdph0qh9rgrshfuj1wgw;1:9imaiqdjoegloh5rinwlj;1:6k5niqwgu;2:jkjwhg;2:ajdcjakikpiq;1:bhceikhixnir;3:2kc6k08jf9gvvj4wh5;1:8lz9fcbj4ciwgkfrh2sj3wgl;1:2iu6l0fheoj3ph6rivshawhe;1:3it;1:6ijak5fk7ghakhfmiouiowgb;2:rjp;1:8iswjl;2:8hcbkf;1:cjzfj9khbqk8;1:6hhojh;1:ajksha;2:aisiiu;1:8geajfcikoj2rinujd;2:0kq1jw2k63is4jk5jh6h8ch5dhfgj6hiojixlh8mhcog9pguqgcrh2th2ugmvhawh9;1:5jshgkrk2;2:jja;1:9in;2:hk9rh6wj7;1:wj3;1:aiwwit;1:dip;1:3jj8gxwk6;1:8iyriwtk5uhgwh8;1:jikqitsio;2:6gm7lq;1:giy;1:6g68imvgzwlk;1:1hf8jjdgwfjagj7jhhnheqjzrkduh5wgy;3:mil;1:6iqeirfls;1:8iochepknqhewhe;2:4j88j7jha;2:uj1;1:0il;2:2fm7psqgrwh4;3:eitjinlje;1:8is9hbmj1;1:jjduiy;1:ahgbh1cirfhghiwjk8pgsqjysjpwjj;2:5j0wjd;1:5kpjjq;1:1hc3h64k45j66he7jv9h7aitbhbch3dhefhggisjmfkhdmjbnhfqg2rjysgfthevhfwh2;3:0hf3hd4jm7hf8ip9hgakzbk9ck1eggfh1ggxhh0jhfkjzll4nhdph9qjptgvuh5wg3;1:8ipajacjjggesjh;2:2iq8hc9hdbkdeingkt;2:mjerhd;2:cjvfhb;1:wju;1:bio;4:8f79m6agwbixdiyjgwqhdtjdwl3;1:cjb;2:pjl;1:oio;1:8hd9isbhcchefj5jj6rjouh5wiq;4:disrj1;3:wiz;2:0j26h17la9hbbhejiykhenjuoiyph7skvvgawgl;1:sikujf;1:1kwmj8wj8;1:cji;3:6jd8iqbhbcj7;3:2ls6h97ir8iw9h4aj5cjjehgfhejgxogrqk6riktiyuhbwgd;1:uip;1:4k08j09hhblgfhbkimlhbwh2;1:4jiciw;1:1hdgkbiiorh5wke;1:fh8hjytik;1:4k6iiu;2:ljloha;2:jinokl;1:dis;2:kh0njo;1:qjd;5:8hgglgugrwjs;1:dg9elx;1:5ix;1:aislik;1:3hd8lb9ktbgqfhcgjchiqjhbqhfrjithh;2:jj2;1:3j25h99jdbh6chddj5fhagj1jkspisqgssgzuhcwjc;2:rg5tm2;5:1haiiywj0;3:9izqhhwjo;2:7is;4:dim;1:lkq;1:sj4;1:8hdgk7;2:ljt;6:kgfmp8nh5shftk8wh8;2:rj3;2:ej5fj2th8ul8vh8;1:qim;1:win;2:hjruik;2:jjpvji;1:0k96h6aiw;3:aizbin;1:aj6cin;1:ahbgh9hhhqjirjp;2:uj6;1:pk0;2:9ik;1:khcljwmj2nisohfqk4sipwgc;1:8em9lzah5bj6cgddivhjzjj4wj8;1:ajzcjvghdjgc;1:8it9hb;1:jjjojq;1:cit;1:8ha9j1;1:uil;1:0qg1ik3il4l66h97h49gtah0bhddhgfhagh8iiujg9kh0lh4mh5nhdokdthduh9wfj;3:0ko1h63ki4iy6hd7hgdjxeirggoik6jg8ph9qjdsgiwgn;1:1k9;2:6l5ajbrh9vgs;1:3ivaj0nioqixrhf;1:9in;3:pip;2:0gv1hg4h76hf7h18m49lqak6bfrch8eldfgmgh2hj1jgjkgomhdphdqhcrioth2uit;1:8hegjrhk0jh4qm3sh0;1:0jr3jb4iq8j39iuagsbhffheijrlgephaqjnrfbsgiwj7;2:hhdwjh;1:8jkehdjgvrm2wgj;2:ch5riz;2:1h23kr8kb9incjbfingh9hj0jivqgntgnugtwit;3:0gw1h52hc3j74h25ip6h08n89fkajvbjvch0dgceivhirigyjh3kg3lhfmgqnhdoispjqqgxrjltgwvh4wl4;2:mhdshftjewj5;1:iisniwphaqkw;1:bin;8:fju;1:niptij;1:1he6hh7gz8j49j4bgmdfueivfgngjvjj1mjnoh9qh0rfvsivthbukgvirwjo;1:oiq;3:1hbdj2qncwgy;1:cj9;1:4ix;1:pjhqj9wha;2:1ja7h98g7bhachceh0hhfjlwqjdrgdtosuh8;2:0imoik;1:1ioaixdiy;1:3h14jf6gl8h4jhanjrpiyqinrjesh6vmvwhb;1:4j0;3:ojxwha;1:2h67j4ajofh9;1:2gx4hh5hc8j79jgbh9eknghchgzjh8kh8lhgoh5pmbrj4tgxuikvjf;2:1h08h69k3agvcizdhgfivgimhjkkheogtpjlqhdrjptk6wh1;1:8ip;1:piuqil;1:8fx9n1airbhgch2djjelskgvlh6mjqnhcqh9rgusjewgu;1:nikoir;3:jjbwj7;1:chgrit;2:rjowhh;1:1j59jfkj3;1:1irbj9khgsir;1:wja;1:8hd9infjjgjlwha;1:oio;2:gj7jglsk4;1:6gkvjq;1:8ga9kmaj0dkvegsqiy;1:sj4;2:8jrahgujl;1:3kl7hf8n29mnah8eggfgzggqhioihajhdkghlh8mh9nh1ohepjrqgtrkhsh5vhawfz;1:2hh3gu6om9fjbhgcj0ehgjgrqh7rhdthducrvrt;1:giy;1:8hc9jabgxgimwkf;7:5h1citjjk;4:9hcdsgec4jguvje;3:9j4;5:tir;1:cj3dio;1:7il;2:litqk1;2:1j48heaikbj2egtfjthhe;2:4hgfinjhcoli;5:9j5biohijok9;3:4j1ujk;1:bim;1:2nb4he7kd8ivjharhcwh1;2:3ip;2:4oigipjhcph2qhe;1:rj8;2:jj1oj2;2:uh4vj1wip;2:4iphh8rk2;2:3jq8h99j9agcbh7chdfk5gkgjgyqh8rj1uh6vizwis;3:1hd3n66hf7h18ir9jtagsbj3cllfgzglxjhfkinlhdngqqgktglugwwfs;1:kis;2:jimohcpk0;1:cj6jhcpj4;1:ojp;1:tkm;2:6hajgzviswjp;2:2kv8ileh4fgoggzhkijk8mh4ohaph9qgstiyuimvjmwh1;1:ohbwl0;5:diujhfqjb;4:8jw9h5bk9ej1wh5;1:oilqlo;3:8gk9lpegg;2:jjaqha;1:8il9hbjjssj6;2:8hebke;1:bioqim;1:6jx8is;1:8izaiobhfciwdl6uhdwh4;2:pin;1:6h89iweikviy;1:dh9em1hhg;2:ghhjo8kjsqhdrhdwgy;2:4j4;1:7hg9k0aghbhbcizfitggtnk6oh6qnrwgn;1:qjlrjrwgc;2:cgwdj9hkc;2:kh7ok8pjh;1:3jb5j08hhdjtfhfjgxwix;1:8jr9ikkkasim;1:ejyuh0;2:8gdagvbnnqlesgq;2:1jkehbrjj;1:giy;1:9ip;1:hiq;2:0jn8izkjc;4:kis;1:cj5phewix;1:dkdefx;2:khcnlkqj2;1:bh5cj1glghkgij2khcql4rgtsgrwgz;2:9iuhio;2:rjbwj5;1:wjf;1:bk7;1:wjf;1:0ks1h14gt7itaj6bjpcjeghdkj2lh0mjgng5ogopivsh6th9ugyviuwga;1:7h78it9jibhchjejogogpqgswhg;1:hj4jheoiopjbqnwth5uhgwh0;1:wik;2:8jn9he;3:1h83hc6h97he8iyajcbkickwdh5eimgjihh4ihgjgzkillkumh0nheohfrfwth3;1:1h02ip3h74ha5j06he7gx8iu9goaiybk7ch3fh9jkqkhdmh0nh6ojgpimqj3rkutjiuhdwex;1:5ip8jxrkutjjwgr;1:5ix8hbair;2:8hdaiqjherk6thgvkrwg9;3:njfqjk;1:0h71fw3h06kj7h98fr9gqak2bn4cj0ek0fl8ghdhhdjh9kfdlh9mhhnhgopfpguqgyrfpuh7wgi;1:9j7wkv;1:ejighc;1:0l0;1:ejwhjhjj0wh8;2:7jr;2:8ix;1:aizphgqmpwgu;2:ejhtij;1:8gj9h1bhfdl5egwghbmk4qhcrh7tiyulxwj0;1:4j8ql5;1:0jb4h1;1:1j46h48hegh8lmitjovjlwh3;3:fj1;2:4iqahgbgzch1fhchhgjj9kh9rkptjnul2vh5wh9;3:rjd;1:5kpphgrk8siowh8;1:1j5;1:fgzgj4;1:1hh5l56hg7gw8kvbh9dgoej2fiwgg1jgtqnvthbuhg;1:2lpfhghh5jgspherm9theujevhb;1:8hfegejkdnikphfqjawmo;1:thculnvhb;1:dgkekukhgujb;1:ah3fjy;1:2j63m44ha5jl7jealicj8dhceh7fhfgh4ihfjg2kh5lg1oheph2qgnrjrtgjwj6;1:6gl8gjdiqekzujwvjf;1:nik;1:wip;3:0ir1g55irljsrh3wl4;1:5ly6h47g59h0ajvegvfjwjjnkgulh7oh5ph8riptk7wfb;1:2kb3hf4ko8hb9hbdljegyfheghhoh0rh9uij;1:gldjlhlhdrhdwhc;3:8ilbjuwh9;1:rik;1:8ja9h5;1:dil;2:dimhgyrjb;2:8gndhceinjiomjqphawkd;1:8juhgqlfvrm1tjbujkwh8;2:8hhjkowh6;1:ljfpj5;3:0in4hb8h6bh1cjmujgwjf;2:0ha2kv3nz8gj9hgaiychcdheehbgisjh4ph5qgvujzvir;1:ahffiu;1:4ip;1:1jf;1:9imbjsrhf;6:6ir7j48isjkcnj3qh1wh7;7:jjx;1:9h8jiqqj7wit;1:binkkurhb;1:cj7gjp;2:jjg;2:fh0kkb;1:khbpiy;1:6hdul8vg2;1:ij1;1:ajkbkreimfh0gm2jh2rhgwg9;1:3iuaiouiqvk9;3:jku;1:9hejkfwhe;1:0jq1l62ev3j24lh5gy6kk7nk8j29fxbh7ch0ehffgxiixkhdlh6mhdnh4oh6ph0rh9sh8th9ugwvgzwgw;1:1he2l33j34jsbileixjhfoherh4;1:6io;1:ljxrgx;1:oh0phcqmzwgx;1:0he1ko;1:8khjh9;1:9j1hjcjhgmhfoiyqj8rhd;3:3j4wj5;1:1he4nc8lj9kbahgcgaeh2glxhh7jk2killgwmh3ngzqh1rgosgzth5uh7wgf;1:8jkeh5qju;2:dgzejanjo;1:8ilbj4uhf;1:pir;1:4ksjh0;1:9grdhael6;3:8gu9ji;1:piy;1:pj4;2:uiu;1:5jk8j49h2bh8eh4fj0hl0qikrhethbwiy;1:piu;1:wkk;1:7iz;1:5j3;2:fhfgguhimrlh;3:gj4;1:7kmqiqwhd;1:5jvahbjh8nl8pkcqhawh6;1:jj1;2:hh6jjz;1:gj2hil;4:cj6okn;1:1hcfhegkjhj0jgqpglqharjfsjiuk0wk3;1:jij;1:8h2egxrl4;1:8hbahdfhfggfhotjk8lhgqjawgv;2:8h69jb;1:ain;3:jjh;1:6l9biqdiwfhcpherjhwhc;1:wjx;2:ajjfhf;1:ljc;3:8hfalgfh6gh7hilsje;3:7kxjhfph9vjawgv;1:9ip;1:eiz;1:8iw;1:7h88j19hgdhdehehgcjjwqj0rjzsjfuhfwio;1:2ka5jvjjwqh1thh;1:2io7j1;1:5is9izdj1;1:ej9;3:git;1:gjq;1:0il;1:2k7agysit;1:0jd7gw9l0ahbdizegwhhbjkjmgxnj4qhfrgnwkf;1:bil;1:tk4;1:0n83la4h99hgehgghcihbjh4ojgpgrqh2riu;1:8h1bkvcip;2:dlzegufhf;1:1go3h75nm6ha7h19gxbgycgadgcfj5ggqhm0jjbkh9mhanhbohaphariztgluk8viq;2:6iz8hffhegkdufyvl0wj5;1:ojyuhf;1:8iqvj1;3:gj3uhfvja;1:4ipkis;2:dhdlj3piprit;1:bjaljb;5:9ik;1:0ka1hg3hg4h99hdafjbgsem5fkdgjbhh9llengwoh7ph6qh5rhdthdugewls;1:5ix;1:1gq2h94hg6h57j68h39h7aj6bh9fh9giwjfxlh9mhfnj1okapjnqiruiuwiy;2:4hgija;1:1h68jx9irak8bjjcjfehcfgzghfjh6ojjqhbwgx;1:oiu;3:8h5ahgghcnqhojgrhesj3wfw;1:0iuqjg;2:gjq;2:7k0djowha;1:gix;1:3hc4hf9j8aghbgncl0eh7fl4gh1jgvpk7qh6rgithdulavkkwft;1:rix;3:agtbj6ghghh6jjykgxlhgplcrjash0tit;1:7jlkilrhg;1:7k5pl3qh6wgz;1:5le7hc8hdajbqhgwgx;3:0j59ikkliwgp;1:bkrohbpkc;1:0in3jy5n26he7ja8h59gechfeh9hhdmj2nhbqjuthfwgc;1:hftjlpvj7;1:9g6aikbkvfipggdhhejlvkh7mh7qhcropth1uhbwga;2:3jbaiywgz;2:4j5;4:aio;1:hik;2:9p4egxjgjkizpilqj2;2:wjw;2:oke;1:2j5;1:iizjjinix;1:wiv;2:qjl;3:1j8whc;5:qjg;4:fil;1:8is;1:0iy;1:8h69jtajlwio;1:8j59hg;1:8in9hg;2:0h51h82hf3kl4h75h26gw7l88km9gnairbkhdl1egdgg5ihfjgckgulgsmhfogsqjgrg7tgwuiuvgkwm7;1:8h9ajqdhgeh6fixhjamilrlpwha;2:0jd1k22ja3jb4il6h47h28ir9h7afebhgghchg8iiqjfykgxllcmh8nivoh0rissiutja;1:3ntfg7qhewh8;1:6jnoim;1:aimvio;1:ujc;1:bh4ciwijzqj7wh9;1:dik;1:ik7jjw;2:bjwej4rhg;1:3iu;1:eh6fhbulo;1:8hgjiw;1:0gt1h22j33jo4gn5h08gxahgbk9cjcdgxfh9gh0hh4jjakhbok8pkzrlvthauh3vh7;4:6kmcjtwh7;1:3h05h38it9jtbgzcjeehgfh2gnfik4jfwkh9mhfphfqglrjcsh4th5wk0;2:eje;2:8h19hfah6biycpzfgwgh8jh1rh3wlo;1:bjfhh3qjp;1:4jlqhe;1:2ilfh7kjenjl;5:6glckgfgmgjphjajh5ql6rhdvjgwh4;4:1it3jl;1:5jqjhe;1:8j29hg;2:8hdjjeripuirwh3;2:ois;1:cikwj4;1:0gy1gt2hc3jg4h25iu6h08nn9fjaivbj9chfdgbej4gg0hj6igxkg4lhemgroixpkqqgyrk6siktgvvgxwk3;2:0ir;1:4ji8jj9gr;2:4iy;1:rldthb;2:hk8rgj;1:ciw;5:diu;1:fhdgkf;2:ukb;6:ah2vjx;1:aj7bkdck0dhbeirggukj8mijpj3qjcrfnwhd;1:0ik1kn3gs5hg7ha8k09n6agkcg7dj2eo2fimghghgbih3jfgkgslj8mgzngxogxph9qhbrg4tgfvhcwl1;1:9hghkojflqj4ritwkg;2:8lc9fkbim;1:0hd3he8ip9inbh7dgoejfgj9hfpifvjhall7pheqh9rmzthfwiz;1:aggblpdhdejxggrhhcjgokgynhdqgmrl2tjuumhvj4wg9;1:wip;1:7h98gbah8bjpeh8hh6jgxkmflfrohgpl0ql3rhftliwgf;1:qip;2:8iupgswkq;1:0h03hb8hd9j1ahgbikdklekifjrghgihhkjbmh6nhdph2qhbrgushguj4wgz;1:ditehd;1:8h89hfah4bkdcgkfh9ghdjjykizrj2sjpujfwh4;1:0h51h43gt4gu5h66hc7h9altbilch6dj8efzfjcggihkoiitjfpkg1lgxmheph5qherlisimthculhvjkwh1;3:sio;1:lkdrio;1:bgsgko;2:8geaizbkkcip;1:bh4ckvjk2;1:1it8h8cj3ghfhipjh6tk0uipwh4;2:qj1ujm;2:6ikaj4fj8khcujb;2:0ob6hebhdcisdh9ekafh1ph4wfu;3:8hdah8bhadkoekkfmpggijhbrgjuik;1:8jtah3kkn;1:4iv9j9dh0ej5fh8ghfjinmglonxpkmqh0wgg;2:8is9exbk4cjbehefjxjgnrmpwgx;1:8hd9isggznjkwjq;1:jin;2:bjbcin;3:9hgeje;2:0it1m84j56kd7gp8jg9efbgocftditgjchgkiiujixkgxmhenh9ohfqh1rg6th7uggvjxwjs;2:1gu3gu5hg6h57iy8ki9lbak2bkwegjfjeogzphfqk8rf0tgougjvhawhf;2:4isej8finhgyqiwwis;1:chadivegafiqqhetkmukevir;1:8k69h2bjrqixwh6;2:9j9chdjgyql4;1:sk1;1:bitjj5;1:vj7;3:1h52ge8h69j0agybkrjhhokcqm7;5:ah9wkf;1:1h23gi7kj8ipal6cisehcghajgqlg8phcqgxrj8tgiwn1;1:3j7eiopjfviuwgr;2:7h98h09h4ah8bghcgmdk5enngk0hj6jiwlhbqj1rkkugmwgi;2:0j9;3:gj8;1:4n5ojeuhg;2:kh8lhhnh4pnmrjlshc;3:8h3gktwhf;1:0f93ml;1:jhgpknqhf;1:eivjhdtj9ujpvkc;1:diw;1:7g7wkg;1:8h7hh6jivuk5wj9;3:1m66h77ip8ha9iwaghbkrch7eh7fgvghahheiiljhalgumgaoimpfxqirriosjltjluj8wgs;1:uiz;2:5g5cjbrj4wld;1:2iw3in5ijahfchgdiofhfggihj6minnhcohdriushguil;1:2he3h95lf7k8aizfh2mj9nhaqizrhb;1:2kg3iz4h25jn6gybiyghcihgjh2kh2ljlnhfoh8phgqh3rguukavmkwfu;3:rln;1:3io;1:8km9gxaikbgwchedlfegzgh8hhgkkdmhcoj3phdqgkrgkshhtjzul2wgd;3:ghhhip;5:1hdcfcgpgjhbqjqrgmtkjwh0;1:jil;1:7jj8h8bgxghaiitkgzrkqto1wgq;1:6l6vgs;1:2ioolwpgv;1:pituir;1:mlcoizwhb;1:8ex9kvcjahip;1:rir;3:0nb1gt2m63h84h75he6h77hbdjxektfipgilih9jgelhdpgvqgmthduhcwex;1:jmuwg3;1:qjn;1:kjg;1:diyehb;2:cin;2:5j4;2:6heqh9wlr;1:ck1rhb;1:7im;2:0ix;1:ail;1:3j7chapip;3:uj6;2:vir;1:1hfcmbhjmrfbshb;1:5johhf;2:2hd3hd6gl8ga9h6ajacgodh7filggthknkh4mhdnhaoh2phbqh9sk6uqvvlcwfv;2:8hg9kebh2ck5ejmthguiu;1:in7whh;3:pio;1:7hfpmbqhewgs;2:2ke3k34ktjhcogyqh8rhdtixwhe;1:6h08hd9itvkj;1:sio;1:0js2j98gvbk4fhcgh0pinqkgwgb;1:gj8ih8;1:hkr;3:ois;1:8j0aimbjocijdhbeiqfinkj4nh7ohhqj3whg;3:rji;2:siv;2:ej5;3:1isrhh;3:9hgak4ej2ris;1:5j1fj5hhbrj0;1:mjdwiy;2:4kg8h9jjt;1:hjq;1:cimoiy;1:1il5izcil;1:1iq4in5jcbjakhfrhfwhg;4:8gkahgbhach0fikgo3hizjglkh7qfwuh6vlnwle;2:cj5;1:2ha4hdwkt;1:ajmfh9qj3;1:9hdel6;1:0gw3ixck3fmfqhhwh2;1:4imnjqriowgc;3:jhaqjwsje;1:9k8ah9;1:ajjejkjj8pj5wgr;1:1je5iugisphg;2:0iv8hd9isehefiu;2:cixfhevjo;1:8lk9gvgjrjhbqj1wh9;2:ajgbhhfjk;1:ahgjivlilrhgwlu;3:1j1;1:wir;3:8j9;2:8h5uj8;1:8kxcjnwhd;1:8jm;3:9hgjhfomjuhb;1:7hfphbqm7wj3;3:3isqlpwgw;2:lil;1:cixokk;1:1irkiu;1:5lv7h38kpbh9dhaeimfhgjgskhcnlzphgqh0wil;2:8fx9j6ah1black4dh1ej6qjswh4;2:0ik3fj4k36gy7gk8niahhdgeeilfhggfyhgijjlkg1lhcnizojcpjlqk0tkguh7vh2wg5;2:4jv8jl9jfahdbg9colfgdkivrgrwgv;3:alyfh8ghgjg7khemjcwk7;1:qiv;2:8ik;1:iis;1:pio;1:0iprje;2:sj1;2:dhceix;1:qio;1:9hfdglehbkkqtml;2:diweh6;1:wje;3:0hc1lw3jf4ik6h28kmch5egmih8jjikh4ljcnjdogzph4qgtrgewj9;2:uiz;1:gij;3:0lc3je4h15is6h87h78kd9isaggcj9djhefzggghmmih3kgemh7ogvqg4rhdth8uiovh6wiq;5:hkdrgdwje;1:9koakjbjxfhfgh3hhfjhdkhfmlgokrphfqh1rgythfuhfwgl;1:cm6fheiiulgtrjwwgr;2:rip;1:8ji9ghbircm0hh8rgb;1:uja;1:2j0;3:3iz6he8j79hgchdejmwix;1:qip;1:bhfeheghdiizpk0qhhrh6simujxvhdwj1;1:bj1fjiuipvjj;1:bipfhhhlz;2:1j53hb4hb5hf6h87h68ip9g2aj4bjocjidg4ej2fj0girhjqjfxkj0lj5njtoggph9qh8vh5wha;2:8jmehe;1:4jm8jgihgrj8;1:ajmgk8wil;2:6m2gizph9wgv;1:riy;1:6hepj6vj8;2:jj8uji;1:hiwjgxmiqtiq;1:wjo;1:6j9;1:8hg9ixoh6pjjwjh;2:1h33ka8n69hfbh1ckwgh7jgtkheqgttjhugp;1:6lh9h3nj3shbvgvwjn;1:ch0tk4;2:fjr;3:sj5;2:5jc6ee8h9ajhvlm;1:jjg;2:8fw9l2;1:2jr7jl;1:1jx4hf6h47he8jkagtbh0chggirjh2kjxmhfnh6oh5pjrqirrh4shctiouh5vh7wla;2:7jm8he9ktcjlghgqhcrhgsiv;3:1ke3im4gr6h77h08md9klajfdh8ggbijmjirkh2lismjkngyohbpghtgaug7wfx;1:4iq7hg8h8ah3bg1cosfftglqjj6qh4rggtjjwgq;1:pky;1:jiv;1:oit;1:ahdggwil4miwnkspjtrh1wh9;4:pj7;1:pj4;1:ckirgo;1:2j48k79iqbhech9dipwhd;1:3iqrjj;1:6hh7jqwhg;1:eioqj8;1:8h69jbahbdjiehgrjswgs;1:6hdqk7;1:wip;2:hja;1:8ioghajka;1:3j3;1:dh8ekh;1:1ksphguiz;2:5j5ggvildjjppisqhgwgy;1:0iykfenlmphg;2:jghqkj;1:wiw;1:3h7bhdwox;1:njv;2:8ilpjk;1:qir;1:cin;1:8ji9gicm4rgb;2:khblivmn4nhcph5;2:8jc9iq;1:6ir;1:1il3ir5j86iz7im8ixbivdgieiqfhaggujixlilmjlngprg8theuh6vgi;2:bmrch1lj0rgj;2:0il3in4iuchbkiwliupilrhg;1:pk1;4:fjw;1:hiwojr;2:1jl8go9khgjrjh2kh9qh6rinthgujkwjr;4:9it;4:0he1ir4jwdk8eitkiynh3;4:dkfeh7piouhg;3:ahgoiquiw;1:disehh;1:8jlpiw;3:0jn3g68jeajgehdjgxqmysgkwha;1:dgsuj9vk5;3:jh7mk4wji;7:7h1jjp;1:5kd6kg7j4eh8ghfikajh2pheqgwrjrwj4;1:8hdbgncl9fh5jirrktwhd;4:rjj;1:8klehf;1:4ikgknlh0rk8;1:4il;1:0io1ke3ly4k45m26h67h48g0agxbhecgmegvfh5hgoikgkhboghpggqgrrgkth5wjx;1:9iusix;3:uil;1:nio;1:khcnmjpixwh7;1:0jnahbfjvgh6hh7jiwwl1;2:0hf1h82g33gz4hg5hd6gn7kn8iy9jbanibj5chdekjffggfnkgsmhenhdoh5pgurjbsjbtgxulnvjgwga;5:6jl8gm9izah8cixdj4gh4jjcqjprh0sjyuh1vhbwje;3:ejl;1:1hf4hd6go7ir9jjajebh6cj4dgwhk4jfzkjdmhbnh0pgzqj6sgdthguh8vjhwjs;2:0ip1g5khdlmanherh3wkl;1:wj6;1:fio;1:8iw;1:9hgbiulh7rjbwkl;1:8ja9hfpjt;1:3jajiqwh7;4:0h71hg8lbagnbkzgjshhfjjjkhfrgrwh8;1:3l2gipohf;1:ajgrhg;1:pk1;2:gio;1:1j65l6bhdhgzjivmk4qhfrgwwhb;1:ajfnj2rgz;2:dik;1:pjr;1:8hdgl5hh3jiwsinwha;1:ej6;1:8j49ipahbegvjh9khhsjhulqvjp;2:cgqwjr;1:binhjrwhf;1:diuehb;1:jheniqojbqj9whh;1:jimojb;1:5iuaj2bjmrh1;2:8hd9gxtm9;1:1jb7hg8j99hfkj3qh5wj9;1:0ip;2:ciktijwjv;5:jiu;2:ejh;1:1js8l39gvblbch2eh6rgo;3:eh8jkx;1:8h79n2cg6uh9wk5;1:8hadirjg6kitqjnwl3;1:4il;1:8hcghdhjciimjjaoj8rjftjo;2:jinqjx;1:pimwiz;2:5ipgjipjj;1:giwrgytk2;1:7hd8ikcgqjlipjhqjtwgx;1:2kr4gwah7fhckh8njoolyuhfwja;2:8h99j3qk0rh8shfwl9;1:0h92j4ilelkuwfb;1:ein;2:bj9rjm;1:1h92ju3jp5h98h19giaikch2fhcggyhh4jnckh8oh3qhfrh3sh8ujivhgwmy;1:7j1ah9bjkfeogm0hj4qhfrgkwj9;5:3jkqiy;3:4hf8jybgzoldphg;1:ah4sk4uhf;1:0h81it2kb3h14h85iy6hd7k08gk9ivajgbgbdk5ehgggzjgkkjgngxojbpgwqiuthdujpvhewfs;1:cgrgjljjpqhh;2:sil;1:oiv;1:5k3hhf;1:6h2qlr;1:0j21im6il8hdchfjh9qj6;1:dj9eh4;1:0ha1ha2j83h77h38gfajzbnkcj6ehafgihg7jgrkq4lgfmgyniqohdph5qh1rh3sjith0ugy;1:1itcjwjisrh4ujcwkj;2:wiu;2:7m18geehfgjjjh3kk7oiuph1uhd;2:6kqaiqfilggxjgwlj9mjiril;1:1jc8h89iyoim;1:divpim;1:eiqhje;1:wio;1:8krehd;3:biuehdujx;2:2h05hf6iy7h98heagmbhefg7gpxhmyoj5phcqh2rh2uj2vjawfr;2:5ix;3:kjt;1:5iovhfwje;2:wje;2:cj3hip;1:jjj;1:8h7giwjhgrj2sjtwhc;1:4hguix;3:1iu8il;1:0hg7jr8j6aj7dhceh4fixhjejilqhhrj1theuj9wgo;2:1it4he5iz8iu9gsehfjkdkhhniqojophcqhdrfusj4tiuuixwgc;2:7jwdga;1:2m73k97h48jdaj1bh3cimdh7ej3hinjh1qhgrh2uhawgt;1:9io;4:agjrkb;1:gh8jh7ph6qkyuk7vix;1:9j4gip;3:8ivjhhpinwhe;3:jiz;1:hin;1:dimehg;1:cjh;1:biw;1:8k19ikaiwdh4ekajgswh8;3:wjy;1:8hcajweh9fj1hjirj6whe;1:3gt4hf5ha7hf8l49j1chbdiveilfgiginhj7jgskj7pgtqheug4vixwio;1:jiu;1:1j8hh6jk8;1:qkcwhe;2:min;2:rjgsin;2:aiv;6:de0emrkj2;1:oio;1:8k49jxaivbjpfjfgh0kirnhcqhgrg8thguj6vhgwgx;1:dj9egwwjg;2:qj2;1:3hf8m89k7bgrgh9hiujhdrjlwj1;1:pk8;4:bju;1:ah7ck8hkmjhcrh4;3:nlewj6;1:hio;1:8jriiyjhg;2:bjf;1:jim;2:mjt;1:bhgchdgjm;5:9hgwjv;1:jik;1:bj8ch1vkdwhg;2:9hfwki;1:4jh6ogahhdh8egxwgp;1:tl0ugu;1:rja;1:1hb8h4ah9bhgfh5gfuhs6jl3lhdphhqjpwgf;1:0gy1hg3iu4iv6mq8g89l7afrbimcimgkehhbjh0lh7ph5qjlrgttitwgi;1:0h41im3ha9h6ah7bircn4dh4hhbphbqgvrjatkkvhdwgv;1:fjiijkkh9whf;2:5jzwio;2:6j7bir;1:njr;4:0h81ge2hc3g45h96gv7jf9ivbjwdh3eh5fg5ggvhk5iiqjgglhbmgknk3oh0pj7qhhrlwsiyukywfr;2:8j69hdfjcgjjhgujjrojiphgqh2rgytim;1:bk6hh0rj8;1:8hd9ijch3rjswja;2:3j85m67hgahcfhghjvjfuqh7rhhwkq;1:gio;1:8h99gsah4cj8gh2hlijjzripwjj;2:cip;2:lkn;2:9iqkjs;2:dh7fjijh4rkcwhh;1:9j4;2:7iw;1:9imjh6qj5;1:6hefiphlhqhguiuwhd;1:hirjim;3:ehasjsuk8vil;1:fje;1:9h0ajifjqjjewha;5:ij6wjl;1:lhgpjg;2:0hd1gf3gr5kn6mi7hf9gmcixdivih1jg9lh7nh7pglqfxrk6shfthevkfwhe;1:djneh7fksggmujuvj2wh4;1:sj3wij;1:gj1;1:8n8bhadggej2ggyhh8qk3rjcwgh;2:ghbjinvjv;1:1gj3h74hb5hh6gj7fl8jv9ghajrbkpclmdhfegxfkignfhiujevkgelhfmhdnk8ogzqghrflsh3tgsuk5vgmwkm;1:aiu;1:ekqhgbrjb;1:3hg4in8go9hfbj0ciuegrjh9qjvrirtmvwgx;1:ajarj0viw;2:6gdvk4;1:jgtwjz;1:9itdivphbwk3;1:ahcrjw;1:8jv9klakhbjjcgsehegh9kilpharhatiyuiuwh4;1:0j21il6il8ha;2:bji;1:dikggyhlxjjorikwhf;1:ggfjk0qjewik;1:5io;1:5jzjhdojbuj2;4:mjs;1:5j0ejfhiq;6:rg5tm5;1:1gp2gx3h44lr6li7gnanrbiscgpehcfgygiqhirihhjj9kgulh5mhgnheoj7qh3rgrthdvhawfb;5:1h83h94hf7h98h99jjakociuegxfhegjnjfmkitmixngzoh3qjyrk3th5uhawjc;1:5iy;2:aip;2:2jraio;1:il3;1:qkg;1:afzkm4;1:2gvolm;3:dhaeixoil;1:fiu;1:0h83hg4jg7hg8gn9gobh7chgdm4emvfm2gh5jgykhephgth3wgy;1:wik;1:biuqil;1:1h68iqch4dikeheghdhgqjjrmh2qjdrgxtmg;1:4hacj4ijkkh0lkcnj3rgf;1:til;1:6ljshbvgvwjm;1:iirmh4wju;2:7gacm8jk1mixojs;1:aiy;1:wjo;1:3ik9jzagfch2ejrfjuggokkepheuikwhc;1:8kggkkliswh9;2:ajz;1:khaljnrf3wn1;1:9h1dgkelzhhcmhenjermwwgs;1:8in;2:8he9ixjgfpiyqk0tj6;1:qjw;1:fj5;3:eipfjrhkougw;2:jh5wk0;1:1im3imbil;1:1hc8gw9irbh5dhhejbgkbhiljghqh8rj6skntisujswh6;2:ehblla;3:7jjginrhf;1:4j0;2:jjh;1:9ik;1:2hg4jl5la6hg8hdagpbh3chgdh4eh8fjjggrhhgjjyohaphbqgvsm0th2ukmwfi;2:1j53gb4h95he6hg8j79jnak3bldcgzdhcegefjdggohh3ihbjlqkmwlgxmgvoh4pgaqjntgzugsvhewf7;6:rh0wjj;1:oje;1:4ivfinris;1:9hajhgtjv;2:8hg9il;1:8j19hckjtrhe;1:fiv;1:bjpcjn;1:sil;1:1iu;3:jjd;1:1h82it3hg5j67h48h8cgrggikirmjnnmyoj1pgrwhh;1:cj2;1:8gn9jdgikwin;2:7hgch8eitgni;1:rim;3:6km8hfkhhmmjqh5whb;1:aisckrfkqgh1rgyskhuj1wh8;1:liq;1:siq;1:9isdjvukkvgf;1:3hc4j85it6hf7hg8il9iragxcozdgzggxhh2ijejillh5nh8ohdph0shdvhfwge;3:5j7cimej7sipuh5;1:gjn;1:9iychggj8;1:jh3wk8;4:kikpix;3:lk7;1:bj3uin;2:ah7bizfl2jhgphbtijwiu;2:ggvhjt;2:jio;1:himmkbrgw;1:9jkeisrh6;1:6iwggrhk6jh2lj4pirtjkwgk;1:4j9;1:pj4;3:4in;3:nix;3:iiv;1:dg8fkfkjr;1:aiphj6jj8rgr;1:7ka9hccimhiplir;2:gj8;2:bjf;1:bh5gjpujk;1:5j8uiq;2:9j2oin;1:dinsj5;2:pio;1:3ja8jabh2ch1gh7jh8rjuwl4;2:wj7;1:7k0jlgrgktha;1:wio;1:3jl7kpjh7ph5vjzwgr;2:tit;1:jiqwiv;1:gje;2:3ha4k15jp6h87h78g49hfagxbgfch6gjyjivniwohcph4qjpriythgvlf;4:0j87kbahgpjlsip;2:0hg1hb2hf5hc6gv9jxajnbkxdhcgizlh7mh6nh3pgrqh0rglsh2tgwulevjiwix;1:2h34kt5h76gy7fz8h89ixafabmqeiyghghipiiwjg4kfqln2mizqgurh9uh8vhcwg4;1:6j1gjmuim;1:9j7din;1:gk8jhewio;1:9jaoiv;1:5iw9iw;3:9jacgqdjjkkqphb;1:8heahablsdh4eiwfgxgklhiroisphduh6wje;1:8he9ixpjk;1:gj4;1:9imfiqriv;1:1jo7gd8hbagzbghcjtdh4fh3hhfjn7kh9njroh8qh6rjxsiouhawj6;3:agurjg;1:0g21h02j53jz4g75gr6jm7gz9imbh0cildgpeimfgygg6hgbijqjf8kgelgkmgzniwoj4pk3qg3rq5sh2tgculxvjg;1:fiywj2;1:8is9izditegyjjv;2:pj1uil;2:0j36leqhfsj1wh9;2:6hesiqvj8wim;1:3iudgyeja;1:7j1ch6fh0gj2hhejh1mk2qhdrl0wja;1:1ip5iqgh7hgvoimqgkvio;1:ckhoh2pj1rh8;1:8hdailbjbfhhgiutixwiu;1:agwbj0ciyfikwj5;1:cj9;1:iivwhb;1:2jv9is;4:tis;1:3iq;1:9iy;1:0il3kd5h09guakjfjlgh9hhcijajjiqgtrhdwh4;1:hj9jgx;2:aituit;1:wjh;1:aj9ghghl2jhawhf;1:0f73lhcglfjjjjukh2lj0mmsnhapgrqhfrhdwj9;2:jis;2:oh3pj3;3:rj4;1:eiy;2:hjvjgutjzwip;1:ejfrgv;1:2j33h18g99kqahbhjukjirh3shawiy;1:pjq;1:gjaojmqhf;1:1j23jviipjhasil;4:3h1aijdipmjhwix;1:8lf9h1;1:wio;1:1jqfk3;1:8hadijfj5ghdvjk;2:1gz2jl3h34gm5kj7gj8k89gbahbbgydgofilgfjhhdihcjgrkhclhenj6ok5ph1ql8rj9shavhawmd;1:mjurgi;1:lir;1:2jmejdoj8ph8;2:sjl;1:4jw8jc9jjahebgfcosfgfrgswh4;3:8inah8bjhoj7phhqjj;1:uiz;1:fiz;1:0m76nk7h1hjljgupggqfpwgk;2:8j3eiokir;2:1kw6m07hd8ky9h3eipjjekhgoh9phfqgxrgvuhgwgu;1:nk6;2:8iw;3:9irbl9ck6gh9rhg;1:rio;3:8heaivjk9;1:6hejh2pheqp2wgs;1:5is8lg9g3bjcrg1sikuk0wh4;1:4ip8gh9kbbhccnxfgcrh8wiz;1:1k28jaagzchgfiyjilkjfmh0niwohbph3rgdsjfuiv;1:bin;1:0hd4iv;2:fioqjm;2:9heaivbiudjvjgynilrh3uky;3:0j9;1:5jlahfbj5cingh0jkdoh8ph8qhdwlh;1:6kf8lmagubj1cjjdfjgk8kjqqhgrgiwgm;1:8h7ailejkfha;1:rgxtke;1:jj5;1:8g69lcjguwj2;1:1hc3h54is7hg8io9gnblkcmofgdgh7hgskl3ph9qh8rjwtiswgy;2:8je9j4eh9lj6;4:cj8;4:0hg8hfdg9elgjkwkgslh4ngupmx;2:dhhej0;1:qlnwhd;1:dik;1:0j56jj8gr9gybj9dl0egpqhfrjbuinwhf;2:djyehcgjlrivwh4;3:ajwdh1ehhfju;1:wkk;1:8h69iwuhevjk;2:1hfcgwhizrk2;3:giyviu;7:8ir;6:aj8;1:jjklja;1:9hbch0dhdhp0rhcwh8;1:3j09hcah9fgtjkgsj5ukfwj2;2:ah2bjfnir;1:ajejhc;1:0iv1is2hf3jw4gj7j78k99lrbjwciodivegwfh2gilhhejhakh8lgwmh1nh6ohcpgvqg5rh1sipugmwh8;1:ak9bhe;1:5iobjqrh6;3:8go9jnhja;1:rkk;1:5il;2:9is;1:7ithikjhd;3:1hf4hf6ks7jb8le9g7ag9bkmch8djfgh5ohgph2qh4rh9uknviwwg3;2:rjquh9;2:ajvfhf;2:0kojhcmjroj1qhgwhb;1:2h03jp;1:win;1:2k48j89j6ehcgh3hh6rj0;1:7ko9iljhesirwh9;1:rin;3:8iwghcqiswjt;1:6g4bhgck4oj8vgywlc;1:4in;1:0hd1g93h17h7bhccm0dimehffh7hipjfslhcph4rnkug9wl7;2:ajrqk9thg;3:bhfgke;1:qkxwh3;1:1jz6hb7he8h29hcahfdgwfglgh5jgrkmqliomkpnjfoikth7ufvvl0wgr;2:chffj8;1:5m47h1bhgojdqhcshf;2:8im9mcagzchgdh1efsfhdgh3jnukhcrgnsjmwjg;3:tkcwgw;1:5is;3:9iv;1:0hg1h52j93h84jo6ja7mf8j39guagabjucl8dh7egcgggihejitkgjlh1mh3oj3qgzvh0wfh;2:5ivtjtwh6;3:eizqjm;1:8ja9h5;1:cisiimwm4;2:3jjbh4rftwme;1:9isamhbh7fh1rhe;1:chgfix;3:8hcahbbkejgkpixskc;1:3gx6l0qhdthevkkwhb;1:3ja;1:agvbjh;2:til;1:ggshjsiiw;1:fiw;1:1lx4l2pguwgx;1:jin;1:tisuj5;1:ril;4:7hd8iq9goajdjlgkh9mhhpjtqh7wjr;1:ahakjpsin;1:0jc;2:3jt8le9h2bh9eh4gj3hhgjhamkynh4phfrimthbvjqwg4;2:4iojh9kirsjeujb;2:ggmhjh;1:aj4gh7ql6whb;1:2kljkvwgz;2:9iq;2:0h91io2hb4h55hd6gn7gi8l59h7agfbiocjvegdfglghaihekftlgpmjingmpjeql4rh6shgtkeuk1wk3;1:dix;1:1jh4jh7jbkh4wh9;1:0im9j6cjadj5eh3fiwrh0wh8;1:1gw3ix4hg5k17iw8hf9hbaiobjrdgyfjmgj3hh9kh7lgymjcojspgcqgkrgqsl8wgi;1:ej4lhboj0pk4whd;1:cj3rgewl8;1:gjmoj8;1:tju;1:hh3jkm;1:eiu;1:jilwiu;1:klylhbnhd;2:9inejn;1:0j52j76nl7nb8ft9fxag1bgbcfvdipef3fgxgg5hgrigpjgyljbnh0ok1pmdql4re2sgntg5ugpvg3wo1;1:2lsbk0cijdileh4fh6hizjmxqhbrh2th8wfl;2:hh7rj3;1:pk1whh;1:2hb7io;1:giu;1:wiy;2:1h52h84h85h46gm7nk8gt9j1bh6dg1hk1ihajmilh7mk2oglpkdsjbughvgawfj;1:kir;1:jl1whd;1:wix;2:0hg1pg3ha4hb5he6he8g19h5agycjbdgceh2fhdhjvjgzkh5mjhph5qh2roxshguh0vhdwgo;2:hj9;1:oj1;1:8hd9j1iji;2:ciw;2:8inhixlknojtuik;1:1hb8j79mzajqbh5cjoegnfgvgh0jiwmh6pgxufovh7wkd;1:1gm2hc4gz6gu8ks9jtaimcgvdgyeftfhcggnih6jh9kkdlfwminnkcokzpjhqikrgttgtuitvhgwjm;2:bim;1:6hhafnhgcjh0lixrmisj6tl2viywgx;1:0jt1gd2ip3jv4hc5hf7h38hb9h0aknbipciydj6egwfjfhgkjgzkjklh9mixnhgoiwqj3rggshatgwuh8;1:8kl9h7;1:6jf9h3bjs;1:eh1fgsgnchixjhcqhf;1:0j03h18jpaineheqjbwhg;1:6kr7ldphdqh2whc;1:jjh;3:8iv9hfsj3;3:4ll8hebkbchgwha;1:him;4:jhgpknqhf;1:8he9iy;1:4ha6h78irlhcrjyujz;3:dj0gk3jivris;2:9ispk5wha;1:ciqhhfkhgnkqqj2wha;1:0ji5hh7l88j7bfzehggjvjhfqlfth4;3:3in;3:qiltil;1:1inah0ffqgmyhjzjftrfysjywjw;2:1jd4hbdjieh9ijepivrgpwj9;1:mkyrgp;2:wip;2:lj7;1:ciw;1:8infjn;1:8jx9jmagzbg5cilegrkl8;2:8iv;3:jjipjg;1:jjbwh9;1:mk5;1:kj9;1:gin;1:biqdhbejvpkg;1:0hg6kf7ky8f39khah1biocg0djjfgqgh8hjjjimkheohbphdqhdtjcukavhcwh8;2:aj5fjgkhc;1:kl3mhh;1:5k1jhftit;5:djlehgjijtk5wgj;1:cimgiqwio;3:pjdwhg;3:oiopiwuj7;2:aipfju;4:4j2hjajh6rjt;2:aisbiu;2:njiuhfwk5;1:8itejc;1:ag2eh8fl1gje;2:rik;2:do9egvfiogh8ol1ph9rh8uhfwhh;1:1kc;2:8ky9gk;1:4l5jhcoh1phcwlc;1:eis;1:8km9kcbiodhgojcph4rjtthfuh7wh4;1:ljl;4:hikom8ph8wh3;2:jj6;1:bh9flo;1:9ingjj;5:cfujh9kitrkftin;1:tik;3:8gx9j4bjwpk1;2:hivijd;2:dfaeolfhbuhd;2:5j2agqfjmghbhh9jjplinqjusgq;2:jja;1:1ha7hc8h5bhgchhehhfh9gnjhhbih3jgkkgilpznh2phfrgdwm0;1:1k72gn3gq4hc5he6h97h39hbbjpcj9dfxekdfilgh4hlulhcmj5ogyph6ritshhtizuglvjmwfq;1:8kk9mbah3bghdjkeiyjg4qh8rjv;1:cgqjjl;2:4h68gjampeh7fk3kggojjsj4uhb;1:fil;1:pim;1:8h7ahgbh6ckergmwnx;2:7hhqhgungwfy;1:dhduipvkb;1:8h09iyagybfycosfgjghahhgjjplhfmo0nhbohcpj1qh9rg4tjdwg0;1:0h32fx6h77kr9imah3bhcehhghfioxpj4qhariusj1wg1;2:fg5gmojh8pjgwhf;1:3h18iudk9eh4oj3tiowjc;1:0kj1h93kh4ix9k9ggqikbjglphdqjhsghwf9;1:4n47hf8ln9l0aj6bfqcgsdheggxhhgjh2ljjnhbqh1rgwsh3thauh8wil;1:2j4;1:7k0;1:tm3;1:2h26ip7ji8iuaitchbdk9eh2hh7lhcpisrfatitvh1wit;1:rgiwl9;1:1h93h76gn7h39iqaopfgjggljjdmhbnhbphaqh9sm9th6ujyvj8wgr;1:1kviiqrj0wh2;1:5j4;2:ql1whf;1:0mz1gs2lz3gp4h65hb6h47h78ix9iqbirdjtekmih6jj6lhbmhfngxohbpgwqggrgoth9uh8vhgwgt;1:6ks8gl9ixaikjhfmh3nknokhtirwfz;1:bipmj6rjhwhf;1:0he1jo3h86kl7gj8je9fzbj3ckudgifhagh9jggkhfnhhoh9pgqqg6rmmtheugrvjjwl2;1:dh3ejy;1:rjn;1:bhcfk6gim;1:6kq8japh4;1:0hd1h93hb5h76gm7h9agpcjhdjrefwhmvihgkh0lguohdpjgqgornlsh8tgoujnvj5wh1;3:hir;1:1itgjirh7;1:diujg9qjrwjl;2:8gx9jiagzbhfdiregzflrhhejiukiuljlqhcrhd;1:wiu;2:7jiah8bj1eikfh7giujftkj9ljgqirrgnwjr;1:ril;1:qis;1:3jf4p85h2hgmjhbohfpgwqimrjoujuwfz;2:1ke6ip8hecjgfhggh5hjfjgjkhfnhfol4qn5rjouh0vgxwdu;2:dherix;4:9k0kir;3:8iprj0;2:ciojjanijwip;2:0ikahffh5gk0hjbjhbkgqln1nh8rh4wju;2:dgvejetkd;1:4ji;1:dhgek2jg6wkf;1:7gj9izajkjghqjtrgvwl1;1:wir;1:jilkj9phg;1:hio;3:aiy;2:7il;1:8ji9gicm3fh5givrg0;1:0h03hg4nf6jh7j5ch5jh5phbqhcrjh;1:qj4rit;5:ciwrhg;2:8io;2:kl3mhh;3:6hhij1ujo;1:2lhjhb;1:5l27jc8gs9j5dimfgzgjdjh4qhfrh7wh7;2:9iv;3:1klpkg;1:7il;1:8jv9h5ehd;1:8gyhipjhbkjctlfwhd;1:eiv;1:1hd3hg5hg6hf7hg8ej9kmch3dg3eh8ggziiljfckjglhcmhdno4oitph2rinsmtth8ujzwfv;1:1iv9jgjh9mk6rfmwjo;4:hgjjluwhg;1:4j3sir;1:8irejpwj8;1:9im;3:lku;1:9jdaj3hinshbwj8;2:3jk7irfimkk0rh5wgy;3:6jwvgn;1:0iu4k1jl0niswh4;1:ghcjjbqk9whf;3:gij;1:0it;1:4hgoit;1:his;1:1ixbjkfhephgqk0ujfwh1;2:3mvqhbwhh;2:8hgcj5gishjgjj1ljhqhewgy;1:8gt9mfajuegphizjgbkgunixqirrjlshdwhc;4:biz;2:8iq;3:0ik7j9;1:uin;2:0ji1h43il4go5hb6hg7h2aipbh8ch9dk6eh3fh5givhfyikckioljmmhdnhaohdph1rkosgbthguh1wlo;3:9iy;1:rj9;1:9ir;2:ck3fmewh2;2:1h8fhggiwijnqiruit;1:8hfgk6tiu;2:8iu9hgqlowh1;1:ahbfkewhg;3:2injit;1:gh8kgvllfnhepitrhcwk0;3:agofgcwlo;1:8gs9isagvch9ekbgj0jhgumtwh9;5:jis;1:pje;1:3je7iv8j09hbcj2hipjh1kj5liqphcrhgwhd;2:1io4im6ipcgldineivfgshgojh4kimlhdokxtizvh4whg;1:9jkeiyrh4;1:dik;1:ah6dhdeiuujk;1:jheuj9vkb;1:ahhwll;1:cherjn;1:6jclj2whg;2:5iq8go9k5jfvqlhrip;3:2ge8j69j9alufgjkhdojcpj4rhdwh5;1:lj6tit;7:5jf;1:7im;1:gkujhcwhe;1:7j8wim;2:1m17iwjgzqitrgwwhg;1:7j58gtbh1hiplhbrlr;2:djkegejjgnixoirwj2;2:wke;2:3hfbhbiivnjfojjpkhwgi;1:1jvjh0kjynioohgpjawh9;1:ajcfh4;1:8gr9jj;1:7ludisjhfqh8wh6;2:8ghblhcitejrfh5rgx;2:uio;1:9kbchfdgtekhfh7hhgjh3ojypjnqiprhduj7whb;1:ajrch8oim;3:cjcgjahhb;6:3jrdh5eislim;1:fj1giuhijrh6skq;1:9hcakqugy;1:0j71kq3jh4js5ha6gx7hg8hcbgochadhdehgfhegikikvoglph0rgywlq;2:ciqsis;1:wiy;3:cj0;2:gikjiv;3:3hd8heehffhchgzjkukgzmhenkzphhrlrsj7uhe;1:dhdeit;1:8hcdk0ehhijfwjt;1:8iwdhg;1:1im8hc9hfahgbgnck3fplggwhhfjh4khbpiyqk2rgtwh0;1:ggnhinjhcnj0oiwpkkqjauk9whc;2:jjcqhftk0uh1;2:0h64hbilnok7;1:fh9nhcpmo;1:9ir;1:uiq;1:mim;1:8il;1:lj3;1:8he9iu;1:il3;1:8k5bhgej3;1:1ha6j98j59glbj9ch0gh0hh6jgkkiullhmh5njdogzph6qj0tizwk2;2:8hglikuj1;1:0k79j5dioihfjgtmhgrjusj0ujwvh1wgz;5:9hdditegxhh5jh8ljjrjbujrwis;1:6fhvkj;1:qjc;1:8h29jhghbmjfoiwrix;1:hh9rji;1:ril;1:4iy;1:ciy;1:4qi6h7ajaoj3ph4qhfrh8uhdwh4;2:0imjjy;4:1h54kw6j0ognuipwm1;2:8gngmqjit;2:5h76jg7hc8kf9jhagzchbdk6ggvhh5pkaqjcrgrtgrugu;1:0go3h64is5hg7h88fy9fuah7bj5diuen2fkfggohj2ij8jj1kkllgsmhgnhdph0rjntgrwgc;1:0hb1iq4k97hgcjshh2jjnphbqh7uj7wjp;1:6hfojfqj1;1:9j7gjxnilwhe;4:7g69haehegn8hj4pioqh7rlyugy;2:1k68j2jgroirrj3;1:ahbniorheukjvjzwhd;2:8ix9gzah9ckkfhhwjk;1:8iv;1:2jodin;1:givjjd;3:diwujt;1:pipwjd;2:8iudilghdujd;1:aj9pj8;2:6jo;2:4hf9ileh7nmhoj2pjmwh7;1:tisuin;1:1fz7h78h9ciweioglkiktkjylivmhfngtogmphgqjfrirthdwgz;2:bji;2:ditoin;1:4iq;1:5ix;1:biz;1:8hfdjtehagh1tljujkwhd;2:0j33h94h96hg7h69ivbixcjvdh3gh1hheihdjjwlj6ojcpgzqgwrjruhcwiz;1:2l63he4he5ja7h78gn9jhaivdj2egcgfehhbiirjkkmhcnjbphbqgxsiptgyuj2vhewgr;1:3m58ioaiqbkocgzfh2gh9hh8jj4qj0tgxwg7;3:8juahcujj;1:2j43h06h97hg8fuagzch4dh9em1fgjggwihgjgmlh2mlyohepj4rhctkkujwwfb;2:8j2fhbuiw;1:1j33iu8hbailbk6ehc;3:8nb9gjalzchadpnefjfgdghbjhgkhfrhctgyugqwgz;1:jij;2:ajkchd;1:aj3fhbwku;1:8jb9h8;2:cjojgxrkmwgw;1:sil;1:ain;2:2fm7lcjixwhh;1:bit;1:nkl;1:mjm;1:0k51h24jw8haagibjxmkdnhhwh3;1:lkf;2:lk7;3:3iq;1:vjf;1:3jbbipciujizwhe;2:fijjiwpim;1:jij;2:7jh;1:0h56hfaiybgudjaeh7fgogmvihgjl5kh3nj3oh2pkcqisrhbuh3wgo;2:1he2hf3ja7hf8je9ngah2ch8dhaegefhagh5jkkkjiphfqhcrjstjcuh0wfv;1:bikwix;1:1iv;6:jjo;1:1kukh5;1:0m42h53k7ahdbjckh2;1:0h51gx2hf4gl5h76hb8g0ahdbh8djqeimfj2gh0hhdjhgkh7lktmk6nooogiph4qh7skctjfuixvh0wfx;2:8ijuj9;2:1js5mv7he8gpah6bkpcghditeh7fh2hgzijbkgdmiqpgvrgwthbvim;1:giqoh2piuwim;1:8jabkajgipiqrjjwhf;1:9indheeix;2:2hg3jn5hc6h87h78e09lqbgiemgfj9jgjkhfohephcrkwtizwgd;2:8g19h1ahablvdipfitkivthhwkd;2:0j95ik8ir9hgbh7cjojhcqjbrj7wh4;1:0jcwil;1:din;2:0hc8hcaj9dnpfinhhcjjdqipwgy;1:8khah5;1:hhajh2lhbrlgwjk;1:aglch7fjijj6nk4qiorjetjiwhh;2:0h41il3is6h39glakybfxdisej8flkgnljj7lhemh8ngtogvphgrevsfnujjvikwg8;1:2js;3:hkm;1:gj5liywhe;1:6kcejnwgq;2:1gz3hf4hg6hb7g18g59j8aqabiqcgndgseh0filggdhgaih9jgikg8lh1mhankjoh7ph0qkergusketkauizwj7;1:aij;1:pkiwgv;3:eip;1:0j31il6im8hekheniuwip;1:2jm;1:rjpuim;1:2l09hbag4hgfrmtwh6;1:qjb;1:qj0;1:til;1:3k4cjbqhariq;3:1hf3hc8j39ivaj0bjpcirdh8fgnggghgxkh2mhgnh7ph9qkhrldshfwku;1:3h88jm9jrekniirpjesj1th3uhbwhf;1:nit;1:7itah7kh7njyphgrj4vj4wh6;2:0hd1hf3he5it8gtalbbnlehffgqgguhgyjfqkowlgrmh0nizphbqh5th8;1:gjm;2:6hf9kdgiupkarhhwhg;1:3j7;1:ujh;1:misuir;2:1hbkjamn6ol9pgxrhhthcuinwgf;1:uj2;3:lhbwk2;1:6kjajdjhawh7;1:ujz;1:hj6;3:jjkljuthf;4:akl;2:7ik;2:0gy1h52hb4h06h58km9jrahgbj1djgeh8ghfih2jhgkfzmgtojsqhcrissjzthaujavh2;1:bhgchdeirgjm;1:fhbgkyhiovil;1:1jv4h67iq9hfaiqbjgcgweh9fipgh8ij4kitngzph4qgvrkzsgythcugsvixwh3;1:8hf9jleio;1:pjgvji;1:0inbjoch0ojiqhb;2:ehekm4lgtohf;1:8h69lcah9chael8gitwha;3:bkyoix;1:5iq8h3al9gh8;2:6hgcitojh;1:dj2;1:jiy;1:aks;3:ajbhim;1:fil;1:gin;2:ljnwhg;3:fio;1:5j8ll5whf;1:jitqik;1:6jy8jg9jjagobh9ejsfh0jh6rhcwjg;1:1it;1:1j8;1:oipwit;1:eilofzpnvwhh;1:agurk6;1:qio;1:wko;1:2lf7jsjhauhbvj5whe;1:jit;1:gj8;1:8ga9kabhdcjudhfek5khfujj;4:1h2okn;1:8jf9jteknjhgkhgoh5pmirhdtgo;1:8j6chdrhduipvkf;1:0nyaj0ihgjhfqhewim;1:pk1;3:cit;1:jjo;1:bh9gislkw;1:1hg4ikaj1bh8hirjiqrj4;1:wj1;8:1hg5jg7k39imbirchbdjpegxfgiggrhimqharjwvkswgo;1:3jqdh3ej2hkeugywhd;1:sil;2:bim;1:qix;3:7gwsh9wme;1:fj6;1:ugevl1;3:lkcnh8;1:eiolj2rh0;2:dhaeju;1:0ip9ir;3:2jf;2:8he9inhk7jixrgnuiy;1:eiz;1:4jnagvbl1ciyfhbghgjjhqiktj3wgp;2:ej6khelhennophguhg;1:cik;1:1j8;1:jis;1:him;2:mjd;1:5j0;1:bikcip;2:cjagha;1:8h1bh4cnltikwis;1:9iw;2:6l6vgs;1:3je9jtcgiflcggurkeugvwio;2:8h09jqakpdirfgnsjh;1:8hbehcghdqhdtlpwjt;1:til;4:8he9llplqqhewgv;3:hfyjk9;3:pjn;1:giqwik;1:aiv;1:6go7kr;1:3iy;1:9hebj6jjjniwoh7rh8sivwjr;1:3hd4hf8lf9m0al7bjfdhffgigh1jglkjmlhfoimphcqiyrgttjeugiwfz;1:hjnrh3;1:vjf;1:8hb9j4giq;2:aj9bitgh8jhgkh5njkohfqj8sk3;1:0lo1iw4g1hiqij9jh7rhawjs;1:bhfwmt;2:rj3;1:6jg;1:8isbjkcjyeilgk5hhfrhdwh5;1:kisnj4;2:fgwgkapiyrhhwhg;1:0hd2ha4hf5hb7gs8io9gyajhbjvcj6ej3fjfgiohj6ij6jg6kiknjkohbpgjvgvwgu;1:agxsj7;3:8h69grtl6;1:4jkwhg;1:0j97gv9k5ahbbhgchfdixegvghehhcjkkkgomlcnitoguph3qhergxwke;3:eiujh7rjv;1:7g7gh9qmarh8uhbwma;4:oiy;1:uk8;1:8jrahbcjfujg;2:4kn8go9hdajmbfwchgdjrfhcghgjgjkj9nhgogsph8qharh6ukmwns;1:piusjs;2:lil;2:qinris;2:0h22ha3jl4hd5h76ha7gt8kp9n5ahabfqckkem9ggwhiljgmkh6mhfoh9ph1qhbrjcuh7vhawh4;1:liz;3:8j7ejs;1:3n57ip8hgbkuhh9iikjgxqherjauhcwgn;1:aiybh4;1:6h0vkk;1:tjjwhc;1:mjtphbqir;3:7l0phf;4:kj4;3:hikoiy;1:0kzahfujh;3:1hg7dq8lbbghchdgkmjg7njjqharn0sio;1:wll;1:bitfixhix;3:1gvgk5rh8;1:8kjeh1qir;1:vio;2:8j5cirfhfjh3klj;1:fhbujs;1:6h8vj0;1:qk6;2:9kyakobjugherh8;1:8ja9jrdixeh8fimjikqhhrhfuhgwhe;1:7jzfim;1:3j4oj3wkf;1:ck0;1:gik;1:2jc;5:bix;2:cj6whd;2:3mr5hb8j2adobgkckpeimfl6gilhiukhgrhfwh2;3:dionij;1:9hfdkigimjhaugmvjm;3:jj7uhgvj7;1:fip;1:nk1;1:5la7j2bj9phhwgk;1:diofikpit;2:0j91gy6hfmj6ql1wgz;1:ejj;1:jj2wiu;1:fgnhkiiilrh6tj5;1:jmtwg3;1:fil;2:5ijah2fhegikhiqihelj2qj3whf;3:8ir9hbkjqlh8;1:dhaeix;1:aiooin;1:jimlhcnhgpmo;1:jj7oguqj2;1:9iqdhbejc;2:gjj;1:jhfwkj;1:7k6njioha;2:nj9;1:uiwvkc;2:7hagiz;1:1jk;1:3ke7helhfpj5wjd;1:riy;1:nj9;1:ejiqil;1:0hd4iv;1:1hd8j29j5ckceingguremtlfwh3;2:aiybimkhhljz;6:aio;1:7gzgmvjg4tjd;3:8h49gidppeimrgn;3:8h39hcah6bhgchfgh3hh3jh2kgqmpinheojzpkpqhgrjiwh0;1:dj0;1:wj0;1:tin;2:8h7aikgk5;1:wil;3:ukovh8;1:1ft6ij9gpah5bh6ch5ehbfhfghghhejh3kmelkmmh9nj0oh1pglqj9tjjwlf;3:ah7fj9;2:dhgejqfh6;2:2iq6j19ipbgxgkdjh2kikmheogxpiurh3tgkuixwiu;2:jjy;2:3hd6jwil1vklwgu;1:8kc9j0ajnbjlcikff7gh1jgxkhhnhaqgsrl4thewko;1:8jk9gceh8fjogks;2:8hc9hebkwej3;1:aik;1:6jb;2:8jk9hedit;1:hgwjjspl4whg;1:jivnil;3:6h4diueh4qkduk3vit;2:0k31h3iiksjd;1:2im3hc5js8hf9inbh1ghbhh9jionh2ojaphaqiwrjjwj2;1:8hc9iqhhfnj1sh0th8uiwwkn;1:vjb;1:0h46ha8h8ah0dj1eh3gmfjjqkh0ohapkhqiprj8wfy;1:9hgahcckidgmek5ghahikifnjhakjtljeqhgrkhwj5;1:6kjwha;1:piz;1:cjqehefhbwiq;1:dio;1:9hbch1hmqrhewj7;2:8iq;1:8izfhesin;1:7ip;1:6nt7jkdh5egqijvqiywfp;2:2hd3j04hc5hh6iqch5eirggrhjmkj3livoiyqhcsiowgt;4:4lr6hgwhd;1:wio;1:cjh;1:gj2;1:9h7dplefwuhh;1:0jk3jq4io8jbah9bhdfh5ijvlgeninphaqjorfbsgmwj7;2:jjgpkj;1:jiwlip;1:0hd1hf4mq5hfahedfkek4fjcggmhhejgukk1lj4mgxnm5ogfqgwrj0thfuimwgm;2:ciwrhg;2:ggvrkjtk2wh0;2:8jhagtbhcfgxgn9jheqhb;1:4in9heciofhahitjioklg;1:wip;3:cirej1fjkkhe;1:3h95jg8h69iqpjmwji;1:uiu;2:1hd3hc8js9imagsbgscmhfgpgh8hj8khcqh8shftiuuk3vjf;3:1lb3h8ah6bgzfjchh9jmwkhblhcnheph9rgntguufgvjrwla;1:gh2rm4wh8;2:3m47h98fn9jwbgmcj6ehbfligowjgbkhdqgsugvwfu;2:2m2aiowh2;1:8j2;1:6jejjc;1:8hebjjcj0dh2ekvgiqjgtqh6rgzwjy;1:akzffmpix;2:sip;1:jiy;2:sio;1:tj5;1:cglfkwjk6wjg;1:0hd3kv5h5bhhfl6rjgwh0;1:8gy9jg;1:bjckhdmjbnjcphg;1:hhcjhbqk3;1:jil;1:birhkdrha;1:bj8tiw;1:2jk5j56o77g88h2bhdciwdgmeh9gg1jg4kheogppj6rg7sh1thcufcvp4wjv;2:rh4wk5;1:9ljreu;1:8il;1:4k3fir;1:aj2fh4;1:1hf3je6h58h7ahebh7dj4egrfjogj2hhgihhjnslhbnhgohdph1qgutheujkwjl;1:6is;1:1ju7gzfgigjnjj0qjb;2:9j3;1:0ik2j2;2:ojs;1:njw;1:4h9nh5pn7shduj7;1:8hg9h8bhbffwkh5ohbpjnqh3rqh;1:6ha8h59hebh0ciuehggjwhj2jk8kh9mkkph4qgxrh6sj8wj3;1:ql7;2:6gh8k79g3ainbjpdkieh2hhekiuljbmh5phdtk6uj4viwwg0;1:1ivwit;1:8ir;2:giq;1:afksl1tjb;2:bgxrk6;1:5iy6h59heahbdioeh2ghcjilmguql5tj4uk0vfvwjf;1:ghehhbjhckjfliwmgynitokoqhbtheuj5wh1;1:mj0wjp;1:2j94j87l5eisghbjfgqjirhcwir;1:rio;2:1jq;1:hiqjgxrlxwgw;1:5iupixwju;2:hir;2:8h99iydhgeinjjruj0;1:9ir;3:2j5;1:niurj7;2:9jd;1:8lh9gg;3:4is9hesndwh9;3:2jddjteh7mgetl6wh9;2:djneh3;1:uj1;1:wip;1:8lvghekgnmhbpkjwiz;1:hjfrgw;1:uh2vjp;1:jjj;2:8hd9izbitckvjh7kjanh3;1:dkpeghjh5pm8;2:4kjgjdkhh;2:gjzkgrljnnj3tkiwfm;1:bir;2:8h8kjapkpwij;1:9jcch5njh;1:1gsglhkh0lkdrh6;2:fk2;1:cj3;2:9hhbiwchbfkmqhgwio;1:dhaeh7fjhqkbwhe;1:aixpiy;3:pn6whb;2:sir;5:wjx;4:ejotit;1:7klej0ggzujn;1:7hd9h9djejkrmjnqh8rhdwgo;3:3h87heah9fjoghejgmqiwrhftjlwog;1:jj4lim;1:kiv;2:njdphdwjk;1:8h0ah7fjmgmjhh0qjdrhd;1:9iy;1:wl7;3:0jw;1:rkpwh2;1:gil;2:9j5fh4gjbsipuk3vh5;1:jjo;1:8kijixrh7;2:cilmjk;1:khamkfohgpha;1:4ikeh0qk8;3:4jqagwbl1ciyfhbghgtjjwhc;1:rja;1:rim;2:8ip;1:tis;2:7jysip;1:1k12ik3h69h4ejaggehirkkjljnohdpj2qh4rgpsh2tiuwgi;2:qko;1:lkmwgz;1:gh8kgwllfnhfwkk;1:nko;1:3ir;1:5j29h8bj3eiughchinjh4qkbsinuh1wh9;1:9im;2:ahhriv;1:8h49gidpaeiljhdoknrgmwhb;1:1l92fnjjpphdqhewjf;4:1h43hd7ha8j19imalbfgshh7jhclgyqhgrkdsipvikwj3;1:6hevj9;1:1il3h67h78m69lnalibmicf6dh0efyfguggqhh8ihdjgekkylh3nh7ohhphcqj3tgzuhbwhg;1:bl0;1:aguflrmjhnlrrh6sj6wgq;2:fhakjoojjrg0wla;1:ikf;4:8jjahdcgergnwmo;1:dj0;1:1hg2j2kj6;1:9il;1:aildh7eixgh5th2ukuvk2;1:giu;2:fk2;1:nlvoha;1:rjitio;1:0he1fz2gz3hc7g98jg9jsakpbh6cj4fjhhiyijjkgmmisohdqgirhbshctgyuh2vj7wky;1:gj3;3:8h39kzvh3;1:sjeuhd;1:ah0ciuuk3;6:aingim;6:qjh;1:1hg4h99hbah7bgzfmfgjjkgilh2ngvoh2preqh6uhewh6;2:6hdqkp;4:jj9;1:1j28gihnfrgzwhe;5:0j0;2:mjt;1:3jhwj2;1:1itkiplilwha;1:8itgk3jhe;1:0gp3jyaivcfvdgteinhh6ijbjgqmj9qherjhuk7vh7wkq;2:oir;1:1gb3k75hc7iz8mo9knagqch2dgzegkfhgggdih5kg9lh8mh5nh0oh5pj5qgarjxsksvh4wlg;4:3iu4j35iq;4:sj3wkc;1:ckk;1:8h7ahbkkkshfuk8;1:aim;1:8m7bhbdh8eh8fhbgjdjheriotisuje;1:5fs7kjiis;5:8il;1:2jd8iwahbfh2ggkhotjfwrhdwjs;1:lj6qj7riywhh;4:1kfaklbh6chddhbjj1kheqhgrjwuk1wgg;1:din;1:oguplk;2:1jifjsgimhh1pjawgu;1:phaqnbwgu;1:cim;3:uir;3:8ja;1:dimuis;1:8jiwil;1:4kf8jp;1:4ka8jgbjlcjjqjvrh6wh1;2:cj2hhf;2:hh9jjuqh4rl2wit;1:4lowh3;1:4gwin3whg;1:0iw;1:lkj;2:4iwcio;1:iix;1:qim;2:vik;3:9ivah5ejshgyjiqwip;2:7immix;1:9jgdixjimujxviqwhb;1:8hcukf;1:1iq6gp7irvjdwhg;1:0l4ph1;1:0iydj0jk6;1:kiv;2:ojs;1:gj3win;1:jgzwjq;3:til;2:dikoji;1:3hc9gydkiel7fjrwgy;1:6iw;2:ajobkbcjxdhaeiqggtkj8pjdqjerfn;1:2l68ghhnurhdwh6;1:ajb;1:gj6jirqhe;1:air;1:pik;1:eiy;1:1iufiu;1:1gxilv;1:8he9l6dgaem2re4wkm;1:9h1aitbm7cizgh1hh3jgvkm4lh2mjenheoglqhewjb;2:dilej9fja;2:8kh9kwdilthgwh9;1:agvdh9ek0hh4jjuqllsgp;1:dl7efhuji;2:wjf;1:kjd;2:wjo;1:cin;2:4gyillpit;1:aiwgh3hiuuikvis;2:9itsiw;1:vil;1:1le3ka4gw6h67gj9j2afibhachffh1hjjimsjlukghmh2ohdpguqgrrh5thauir;2:oj4;2:4ip;1:3ll8j49gxah2blfchcehdfiogh6hj6qgvsjathdugz;2:3hf7he9h1bhecgxeithiwiikjixmk7qk7rhbuh8wk2;1:2h73js;1:8j4;1:0jrph4;1:cj2;1:jiu;1:3n48ipffqgjhwhd;1:5gy8mjegyjghojmph8thfwm1;1:qjb;1:8fqwks;2:3io9ioij9;1:1h93h54ka5in6ha7j18hg9ggah0biwchgejafitggnhk0ih3kh2lhamgxohaph3qlwrg4uk3vjl;3:dizehchhbninrja;1:0iv;1:3ip;4:2in5izsip;2:imkjheqj9wh4;5:1ir4inahefijkj2;1:wiv;1:5it6n1ohcphcqh8rhaujbvl5;1:ghfrj4wit;2:fhggosih7jgprhfwhg;1:qk4;2:2h67j5;1:njgpj1;1:5nq6g4vg9;1:4io;2:uim;1:jhcrjr;1:jh5rjwwj2;1:fiw;1:9lhhilrhh;1:hjksjj;3:ej2sio;1:3j3jh5kipnjyohbpjuqh5wh8;1:8j8cjj;2:kilqinriw;1:giz;2:6jdgiznir;1:rj5;2:9gyajjbgzehafm5ggykklmhgriw;1:0hf4ktailqiy;3:bio;2:oikrij;1:8ju9h1eio;3:4j7viw;1:fivtjl;1:8gu9jyeitjjb;1:til;1:0k04pn5kw8j49hfehajh2oh5pghqhauhdwfy;2:3jt8j0ak7bhahhajggqiwrhhshbuhcwn9;1:wix;1:1h77hc8hgajlbmfchdjg9mm7phgqhbrjwthfwiu;2:0j01h72jd3im4h96hg7hh8ji9lqaizbjhcjadhgehgfgngh2hhejhgkjdlhbmiknh0ph5qh7rgssiqthcuixwgg;1:4is;1:8h9llh;1:9l0dgyeiqpk8rgqujb;2:3mf4hg7ij8gh9h2aivbkycjthgrjg7klfphcqk6shdthbugzwg2;1:3j44j96he7hg8j2aj0bipcj1dh6eivggxhgdjk8kiknh0rl3thcuh4wh0;1:riywhc;4:9gcdk3elrfiurhf;2:wja;2:0hg1iv3gx5hd7gr8ks9iqajybgwcisdgxfhagjphh7ik1jgvlkpmh0nixogtpgyrh4uh2;1:biueip;2:gim;2:1jo;1:pk2;1:5j38j1ghfjhboh8pheqjmrlasjstj1wgb;4:jffwl5;1:rik;1:8k79izbh8ciyeh8giy;2:gjaqik;1:phawk8;2:1he8j89ijfjigh4jgpkhbpliqgzrkfwgq;2:9iu;1:8ik;1:0hg1lf2h53gv4he6h07h58j99irah5bj8cfydk0efhfmxgjkij5jggkgolh8mh7ngtogipinshatkhvhcwgl;1:8h39izdjhehehijrhf;2:5j7eiw;1:rim;1:ggwhkf;1:cjfrhe;2:gij;1:8gv9j4oim;1:4ik;3:wk2;1:2in;2:bjg;2:dhaek2hj6jg6wke;1:jhbwk8;2:fim;1:5j8bj0jk7qhb;1:1ixjjzrh5wkf;1:gk1mjfpiowhc;1:bgxrk6;2:jhdqjd;1:1kbfgqgnpjjqqgxuhewgx;1:2h67j4dik;2:qj1;1:bhalkx;1:tis;1:8g99kwairbgywk0;1:ah5fgdglkjheqh8rhduitvhcwli;1:dilehdgjxuimvk4;3:5iloir;1:jl6;3:dir;1:0it1hg8jd9gjbm9ehcfh6rjyuiqwhd;1:kh2lkf;1:5j27irbn9cgndh1fhdjltkjpqh3rfmthdwgx;1:1gvdjhek6hj0jhgkikrj5sjmuguwh5;1:1jurio;1:0gx1gs2h33iv4h36hb7h88haaj7bk0cjodkbeg1gj1hjiiiljf9lhhmjknjwoh2pguqiyrintgduinvh5;3:cherit;2:8jp9itah8rj3;3:tjhuh8;3:3hg8kfuh1vjn;1:8ijjhasjj;1:0ha1h52h33j34hc7iz8j09k3ahbbikch8djsejgfh1ggtkh2lhfvik;1:9iohkhjh2qhe;1:8imcjawhb;1:tik;1:9h8ahcbhggj3kh0npdwh2;1:9jl;1:9j3jk5ogr;1:aj2;1:7ke8jpdisjhfqhdwhd;1:cij;1:8j39ilaipcj5ehgfj8jhe;4:8hajm3ojoqglrhewjk;1:dj4;2:miwrip;1:8jpej6rgg;1:8iwakubgrij7;1:bjk;1:8il;7:4jv7j09jndgfejbjh0rjfwha;1:6hh7heph2qntwh8;1:1hggo0jhdqjzrgnwh2;1:4j4;1:9h2aixbkdch8ghghirkj3rhfshguk6whh;1:3h45gw6ha7gz8h69h1bj4chaflbgjtiinjgmkgflhemhdnhdohcph1rj6tnq;1:3joajkdhfejnrh0whh;1:3iochejharijwm3;1:oizphh;1:hhgriw;3:ciljjwnj2ohfwj8;1:0h9ahgflewhe;2:cio;2:8jb;1:0h58gj9lzal7bgmfh7hhdjgnkgvlikmisoh0piyql5wiu;1:qj6;1:3h74ijwkj;2:oiz;2:7im8ktagibh1ch3dl6ekwfk8ggmjk9kh3qgrrj1sgvth9uhcvhgwgn;3:2kg3h47h58gm9j2ahdclwej9finjjekj9lhbmh5nhdoh6pgzqgvriyshhvhdwgl;1:jin;1:jim;3:nim;1:7ju8jttikwhe;2:0gx1gs2il3gx4h25ga6h27jt8lqaghbncchedfeejfhinkj6mh3nhdohapgprfbtk0wk7;2:jgqljjoivphhqjawjy;1:8hbgk0;1:plu;1:4jf8jh9hbah6hh3jmeoj7sgl;3:1h62hb3gd4kj5hd6h27hg8foafbbh6clndh8eh7gk9hh1jldkgolh3mhenjuoh7pgurkqtlevh8wiu;3:3k8jh4wiy;2:dhaeix;1:dgaelrfhfth2ukz;1:1ko2ff3h34h55he6gz7r88jd9itagnbgccfzdh0ehbfh2gj1hhdjklkggmh1oinpfntgtuh5vinwkf;1:oik;2:jjjwh7;2:1h56j7chggk0jiwrf0wjx;2:sk1;1:qiu;2:cj4jis;2:lhgrje;1:1j52iv4hd5ix6j87ip8ix9h7ailcheehdoioqh2thcvh1wio;5:miw;9:fmbwh5;1:dis;1:8l09jobhfpiqwhh;1:0jp1h17j28h39h0ag7bhadhcegpfj6gghjiukh9phfqjjrmgsh3tj5wl5;1:8lo9h3;1:5li8gz9j6jhgql8thbwh2;1:8is;5:4ju6gm8gv9jgahapk8vj5wh2;1:9hech2fl2uio;1:0j1;1:ajmgiz;1:oirvilwil;1:9h7alucikejvgh5hhejirrg1sm3ugzwgj;1:0hf1he3ha4hb5n26jd7kpafkch5egxfgrgglhl9ijdjh2kh0lglmh9nldogqpgtqkzugsvhcwh4;1:1k82gpjj6;2:rjlvj1whd;1:rir;1:6jd;1:tin;2:oiwsiytikwiv;1:jke;2:3kedinwh2;1:1ivahdbgmrlo;1:3m55kj6jw7io8h39ilagbclzdimfg2jikoh8pgzqgmrgmshfuixvitwg5;3:giuml0rgd;2:tk2;1:5j9;1:8h5jkqqha;1:4jrpijtirwhd;1:fjrhhcql5rjetgsuh1wik;1:3hg4gz5ip6hb8j4agebghdh8eh3fgtgg4hlxjjgnlmoimplkqjlrh6sjytgougwwf9;4:3h94hf5kf6h97hf9k9bgyehgfgigl0ihbjfzkgkmh3nivohbpk0rhesiytjtvj0wfv;1:8gv9j4;1:2kw8ja9injhcoinpheqh7rivwiu;1:jikqjxwh9;3:jlxwgz;2:djwegf;2:ajgfhfoiruin;3:8hdbkfgik;1:siv;1:2in;1:wiq;1:2io;1:ajh;1:6gkbkeuixvjbwhc;2:1ik8gfch9fikkhdpm6rilwk8;1:2iz3j68gy9k0ch8fjiwh5;2:jiynim;4:bh5ll6;3:0j7;2:bil;2:2gw3ja4k75js7k08g49hfahcck5dioehefiughfhh9jglqikuhd;1:9hdaknnja;1:ajaliw;4:2j2;2:9irejb;1:ghfjhckiloheqk6;3:nl6rj9wh4;1:5qnjgjwha;1:1j0;1:1jj8hg9iwfin;2:aj5cgmhiurkc;1:ghbqj0tim;1:fkjuh7;1:hh6jkqqhd;3:1mj3h64hc7jeblweilggjhjcij2khbqh1rgvwfx;1:2j5eimpks;1:fix;1:6gsuq5vek;1:gk4;1:0ir1h62h57iz9goaj1bhecjpdh5ejzgfzih0jh3phfqiqrgzsjatj0vjnwgx;1:diwjio;1:qjb;2:8iw;3:3hhajvdj5fgmgh6jgbkmtljmngxohdpj3rh8uik;1:4iu;3:dgzejb;1:6jsilmjheqh5wgi;2:nil;1:jkbwhb;2:rnawfz;1:fj8;1:1k5akubh2;1:rjj;1:8jc9h8gj0;1:qkg;1:1lf8g99lbkhd;2:2hg3gy4h96hd7js9izbjddh5eiqfjrgj6kiklgtnijoguphgrj1shftglug1vit;2:kj0;1:lim;3:hiq;1:jis;1:fk5ojb;1:aiu;1:joxwf5;1:fkesik;2:oiy;1:bhhdhcek0giz;2:8gq9lacgu;1:8hg9il;1:ij4;2:dip;1:6hgbjdhjzpkd;1:1io6l18gx9j4ajigh2himjgwkkgql1rgvth8wg8;1:8h8gjmtk6;1:6gtvj7;2:ofoplz;1:4jg;2:2ilggfqjl;2:4hc6szjgzph7qgewg2;1:ciu;1:rix;1:2lf3hh6h77ha9isehfmiyohdphhriowkp;1:4jm6hg7fp8gxkhfonhpk2;2:9ik;1:kiv;1:dhhejfhipuixwim;1:0hf4ksjhgsjv;1:6jh;3:vj5;1:1he8im9h1aj9bh4ckhdh1fj3hl6iiwjgrkh4mhfphfqhcsk8;1:8j2;4:0qb3fq7hc8j59gxah6dhfijfkhclhgqinrj9wgk;1:ljv;1:sj3;1:1g93gv4jc6h18h89hcahdbhagizhjmjh3lh1nl9oj9riksirth6wis;3:cgsgguhjwkklrjp;1:8j39k8ajmbl2cjueh0fgjghgjhakj6nherh0wh7;1:iilkjg;1:jiptknwgs;1:0lw1es2gw4hhfhdgjgolf;1:7ik;2:9irblcck6gh9rhg;4:4jy;1:1hg3gz4jt9h9ah2cj4dkcghghirjjdohbphdqherj2slkthgugbwg9;1:0jwah5ujn;2:8j8sis;1:piu;3:8jv9kjakhbk0cgsehefhggh9kikphbrh3tizuivwh4;1:ajq;6:uh5vk2;3:rin;1:8jk;3:7kl8h5ajabiwdjleh7fh5gj6hhanj9rh8sir;1:8j0;1:2k26jl;2:liprh7;1:iiujiq;1:oheqnhwjt;1:qip;1:hj2jiprhc;3:wj8;2:3ir8nj9gtbiwchddgheiuhh6ihcrirwj0;1:iiwjjqwh4;1:ij6qil;2:vj1;1:gjkmhgoimpj5qhbwji;1:gj7;1:ajlfhatjmwhb;1:3ji4iu9jajjawgv;1:5kbajgdgqgiovk1wh6;1:8jpbhglh0riytk0;2:hhgjjbuka;4:ah6wj3;4:jkd;1:8itah8sja;1:5iwuhcvj8;1:8ir9hb;2:uj1;1:cik;1:kiywit;2:8gs9gpbhecotefwfhdris;1:hhaqiy;4:8iuris;3:hjqjgytjz;1:0ip2h13hf4h96h97jg9h9ch2diyehbhimjijkiznheok3rjpshgvhf;1:oin;1:nil;2:jj3;1:pip;1:pji;1:0hf3jp;1:citqjo;1:bhecikpju;1:4iu8jkjip;2:3il5h48hf9jwaj1chadjaejifgzgiwhilkhgnhdqgvrgwsh9thaujqvh9wkt;1:mji;2:7miwgr;1:jis;1:jh4kilqkh;1:ain;1:gikskp;1:lim;1:gj5mjowgw;1:dheeip;5:8j3;1:1kd2hf3ha7h68im9gxakibgmdgiegnfkmghdhh5jhbkl3lkqmh2okrpkkqgxrexth3uh9vh6wgy;1:eiz;1:mjc;1:2ijjjiqjn;1:8hg9iz;5:jki;3:giq;1:hk7rhg;2:3ivdh6eiuwhg;4:liw;1:8k1;1:3iwuj5;1:hiy;2:0io1g6hj3jh8khglmbrgwwjw;1:tk3;2:1im2js3hb4lu6gh7gt9jfbguch7dgieikfgnghbhh0ikmjh9kg6lh7nh9og4qgqrhbul7vixwl3;1:jip;1:win;1:gik;1:ais;2:8h4gk5jjx;2:hjyjhg;1:0iq4la;3:0ji6lb7h8jhgqhbuh6vjzwiq;2:8h2klaojurhawh4;2:8iu9ix;1:3k2ej1jiruhb;1:9iq;8:ek9ghdqlywh2;1:phdqm2wh3;1:ois;1:hj2rha;1:9gtdhfeklvj6;1:9j0;5:8gw9jqbl4cgnejyfleggdhitwh2;4:8gdgjijgymjkoh8pgvqlawjv;1:6gv8gd9jjdheeh6jg8qiyrg4sivthcunnvlkwjh;1:8iy9h3bhecioeh6fhfghcih9jglmkjqjerknsj4wio;2:jlgmh6nktpheqhdriywgo;2:8jbwiw;1:8h0wks;1:9hfjhato9;3:mhfoj0;2:tip;1:0iq2jo8h8bhecjogg8hjs;2:8j49imchhehduj5;3:gj7;2:8hbahfbkseisfgwgjohjmjguojlphhwj3;1:2ku3gs4h15mg6h67l09h1ahdblacgvegkfjcggohhgjgfohdph7tgqvixwgh;2:hfynilrku;2:0j4;1:4kcjhgqha;3:qjy;1:mjw;1:8j2;1:2ha3jv5l28h59gjaikchffjdgh8hivjh5kh7ohbphduisvjlwk9;2:bhbqj3wms;1:bjz;1:2mc3k94he6jxdgmej0ginjhephgqhfwgu;2:0gv3gy4hbdh6ej8iptriusimwh3;2:birqj2;2:qin;1:5jd8fhahdcj5eg6hjgmilrmcshg;2:5izairpj6riq;3:bir;1:8hhbhcujl;2:8hdbh2ohgpjkrl6;2:hh1jjx;2:8joak8bk2cjidiseh2fimgh4hhbjiskh6oj6ph2qgxrgwwjm;1:8hg9imlivqilrh3;1:bj2;1:8ja9h8cgmjjl;2:jngphdwh2;1:9hbch0ghghmbjj8rhe;4:jgppoywgo;1:1j8aj8;3:6jmah0djsehdfh6jjqkk3qh6;1:hil;1:eio;1:8haahbdivehgfl1glcjipkh8nj7qhbwh5;1:jkskk1mk3rh1uh4wgn;3:8iq9imlitsj3;1:ak1;1:8he9ix;1:jjiuj0vis;2:bl6gimjhe;1:4iy7jjahbjgukksljcnkfoh7pjlqgzwg8;2:2jx4hgbjockmjh9kh4rhctj5;4:hipsj4;1:1inbh9gkf;1:8ir;2:9h3akbeh8fju;1:ej4lhbpkn;1:ljp;1:7jx;1:4l8bj9fizjhgkhgljxqh0rh9whd;1:ejlvix;1:8lnairhgm;1:egxfjy;1:6jrdiyoilvfwwir;1:3hg5iwfk9jgqkh5lh6ngzpntqjxsj1wg8;1:6kowgy;5:giopiw;1:1haqilrj4;2:1l57hc8h59h9djejo0kipoh8qgdwft;3:8ip;1:1j3lmvrgp;2:ijd;1:7jojhgphdqkk;1:8jb;2:1iy7ivbhdhhfjhdkjxmiprgsujb;2:hijjl2qgn;1:5j0;1:5ix;1:9jc;1:oiktki;2:gj6;2:wiz;1:hj8;5:8goafpjhbuoyvjo;1:jhakjerip;3:3iu;2:rgpwke;1:3j6jk9vikwgo;1:0hf3m35lp6hf7im8fa9jfaj4bhachhdh6eh3fphggskgbohbph7qh3th9uh1vhewgw;1:sit;1:9h0ckjfha;2:7jf8jefisjhhlim;2:gkjojrsh4;1:9jydgv;1:jhdwk4;1:eiz;1:3hc7h98k49imagpemcfh8gkmhixjgzkimoh3ph9qimrdvsiqtiyugdvj0wis;1:ein;1:7jw;2:dj4;1:fimgjy;2:jjt;3:bhccizhl0tiuwh7;1:0j31gu2hd3ik4hg6h37k4bizckqdhceh8fguhj6igzjkbkiqnh7ogzpgjthc;1:1iqwk5;1:gimjhekj9plmqherk4uhcwgf;1:giqhiqshd;2:9iz;1:7jp8j49kdakubjlghdhgljjpphfqh1rgyuhewh7;1:8iq9hh;1:1hgahccjldhfeipfh7giqjj3limrh2wjz;1:0kv1k02h93hc4g45h66ik7he8jnaj0bhgckddj3fg0ijzjkjkh6mh4ogtpgeqfvrgksh0tgguh2wl5;1:2kf5kqjkephhwh6;1:8kw9g2;1:ciygh6hio;1:8h2qhgtm3;3:aiy;4:8it;4:8h09fydeaeookiwpjoujmvh7;1:fj9ngbpk2;2:pkj;1:qjo;2:3kk8kubjjwg8;1:8h4jj5sj6wiy;2:3hf8jpbgzchfjgxkjoqivrgrwma;1:dkqego;1:4ju5j79kzdhhfh1giljhe;1:aiqfio;1:4kv8hdcjheiqfj7rhbwhg;1:wjh;1:uhfviz;1:ch6jjbwip;1:cjaohfpjhtij;1:dhbejo;1:0hf3gz4k95iu7gc8js9gpbhfcjbdimfhcggphgxjltnhdogypgtqkdthduh5vj0wiv;1:bjkcjkrh7tjx;1:sjf;1:kfnnlltlywhf;4:agpfkxgimjil;1:kio;2:0in6kr9imfizwge;2:bisjhftkm;1:bkwcha;1:6hb7hcohgqma;2:aio;2:8jc;1:8fd9jfaj2bkocj6fkdgh4hgyjj1kgtmhanh6oiuph3qjorkasghth7uhh;1:til;1:0l51h3;1:ainwiz;3:qjg;1:3ke8h99h7egsqj4wm3;1:0ha6h29h9ah2bh0chdeisghchgyjgvkiumqbnhfolopgtqjbrh8tiuugxvipwh6;2:wiq;1:0ja8iuagxbikuk0vhg;2:8jb9imdj5ehe;1:8gt9klgiwlirwhb;2:1iu4k6wh8;2:4hc8itaj9bjhchdfitgg7hh6jj5kmmqikrhdth7wgj;2:8kl9gtahbrjs;1:qjn;2:ahabkhuio;2:dhgejpfh4ujt;1:uip;1:jiq;1:rjewh5;2:8iu;3:oljwhd;1:hj3;1:bjtcj0ghfwjh;3:8he9ivhhboguplirjjwg6;2:0ja1kk2jy3h34hd6iz9h4bflcjfdg7ejzgguhitjg7kkmlksmgeokgqgtrf5sgwtgxvj1wh8;1:8gu9jtcjdpk0qhesiuwhe;1:qk8wh4;1:3lbfgbgisjhdoghpk6;2:mjpqkd;1:8f69l9aj1egcjh8qm4shdwip;2:1jq2ha4hdwko;1:gjc;1:qit;1:jjr;1:7js;2:0j39gzbkhdgtjj9uinvjuwgh;1:bji;3:8hccjy;2:oio;3:4l29jkghgkhc;1:4hgtjouiv;1:ok0phe;1:3jr7gy9kdehcim3jhbpha;1:8itchfoj7tjt;2:bjj;2:3io;1:aikfgigl2jhcmh9oknpjnqj6sjqthguhgwgl;5:ah6fjehippip;3:ggijk3;5:njcuiv;1:hjb;1:0ov7h3cg9ehdfirgh1phcqiw;1:7hbaizjlpkl1qhcwgu;1:gip;1:girpipqin;2:ch9vilwkg;1:djb;2:nim;1:6js8iwwj5;1:3im5hd6hg8gzch7ehghj4ikbjh4rj0tnvugavklwgi;1:cirmh9tj3;1:dijijrjjqrh7;1:dgnekofhepn1qhfwgf;2:ofrpkw;1:bis;1:0fv3he4ixghbinipjcqhcwhe;1:7lulj3phcqhbuja;1:5n46h87kc8h4bgvcipdiqegtfh2gk4hh3ij6khamioohepgwqh4rgnshatgwuij;3:3ipdik;4:ij4;2:4j1chhhlpnimrhbwh8;1:0ji1mdgizihfjjorf1;1:tiv;1:aipdjqefsfh2jgipjxrktsk8;2:0hd1k23h84gr8k1bh8ffugnvhgzihdjm1nhgojppheqgnrkash0thcuh8wg1;1:5j8cio;3:4hg6l28jeahabhedh0ejwfh5jg1kh6llppjm;2:tjf;4:jhbuinvj0;2:7hejk8;1:3jk7kojh5ph5vjywgq;1:9iyohfpj7;2:6ivjhftkm;1:diz;1:cin;1:rj3;1:iim;1:6hg8gualefhdkgwql2wh4;2:3he7hfjk4mjhpjuwhc;2:nik;2:4k86miphbwfu;1:tiz;1:0js8grgh3jj9qk1;9:8j8;1:5il;1:ris;1:0ip1h43hc4hc7hg8k99ldaggblwdiwejsfgmhgqjfvkgtlh9nj1ohgph8rjsuh7wip;1:plgwg2;2:1irwk2;1:1hg3m88g9ajzbh8kgwlj0oh7qhethgwlb;4:aiqjjowhc;1:0k01h4vjkwhd;1:1ix8iw9hdkjrll0ph7wh6;1:2hg4lc6hg7gljjfkhhojvpheqhdthgwjy;2:7jo;5:3io;1:cijwj1;1:ajofha;2:6janilpjx;1:0lg1ix3ft4kf5h77hf9l9bj8cj0eh3ggthisjfmkh3mhcoheph9qgnrkssiotgouh9;3:7j8kijuiw;2:1hf3h87k2ah0dimfh6hj3khcokwqh7rh7siywkv;1:1ks3hc7h68j29geakxbgwcgtdgiegofkhgh7hhdjglkl2ll2mh3nirokgpjgqgzrf8th5ugnvhcwhg;2:njkuhg;1:riz;2:0kk1hg3h74m68h19khej5firgiujh5kh4lhhoh5phbuh4wh1;1:tiw;1:0ha2ha3h14g15h76gw7qm9hcbh5chgehdfgogh3ilpjefkheojcplrrj1sk6uh0vhewga;1:jio;1:tit;1:3j4dikhj5rh2;1:0kk6hajjkqhdwh5;2:0h51hb3iw4hd5h36ko7f79hcagtbg1fhbhggjj4njbrj8shetgevnwwkl;2:8ivcio;3:1niahgrh0;3:hh7kh4nlcris;1:fkc;2:ekznj3;1:8sf9clan1bgsch5fh2jhdrhbwh0;1:0g62hf3j44h25is6h67h18io9joajbbpmchbeh1fg9hkfjh9kg5mgznhcoh7qk4sfyth4vh2wil;1:2jd7j9kj2whd;1:uhevjn;1:bj3chdfj1ikzjh9qipwh9;2:ghcjj3khenjhohcpjlqhfrhfwm5;1:0iy;2:8hebl1dh6eizfh9gjyhj5oiv;1:6jy;3:6jwbilfj0;1:8hdbj3hhbpjoqharmiwin;1:0j6aj4bjlcjjfh3whb;3:4iw9ilah6bg8cnxfgrjjoqhgrgwtjwwh9;1:1iswik;1:7jm;1:6h98h39joagcck5dinehfjhdpkvqhdrh6ujkvjnwgn;5:4kr6la7hc8jc9h9ah6fh7hh0jknomzpftqh7sglwgy;4:3jp;2:ahhcj7sio;1:8hh9kjbh4cj2ejprip;2:8jbkj0riowhh;4:wjc;1:5iw;3:ojwwhg;1:aipfhcnjq;1:agtcglfhbgjejj3lgprkyujwwja;1:nj2;1:3h24hg6in7gx8lf9gmajabhhcjndh7ehdgixhh7jjskj9nhgohgph5rhcth7vjl;1:8jb9h8;1:cjfrhe;1:1hg3h24jz8kw9goajubimch3dheehghhhij1kgnmh3phcqivrgxsjktjmuip;2:0j0;1:fit;2:tj5;2:pj0;1:hiz;2:qj4;1:0jr1j24gu8h5gjghh1ijojgpkjbpikql2tjouizwg4;1:bip;1:ok8;3:2ilbh6dgbejpgj0iiujhaqku;1:ojb;8:jj5;1:dip;1:1hf3hg8gn9h1aj1bh9dh4egifiugikhh8jkgqheuncvju;1:0gw1ke5jb7hesja;1:gj9;2:1k02kd3ki4li7hcdhejh3ojnph9qhbrggwh3;2:2od4h97kj8imjgcmjingjqhdrhbsgyuhgwj9;1:djjeh1;1:hikojz;2:rio;1:bip;1:9ivahf;1:0j8bim;1:iip;2:hjiwit;1:dgbek4;1:jhawk5;2:aj8fiokhf;1:8gm9jihgtjjrpj3rkf;1:3j87j3qhfsix;1:djaegouk3;1:4hg8hbaikcj5oljph9qjksikwj3;1:jil;1:jjiqhg;1:aj2nik;1:bhhhizoim;5:ej0jljwgu;3:1iy;2:hj7jhdriltjh;1:8iu;1:wio;1:1lghj5qkprh5uh8wgc;1:aj5kjc;2:8hdbhhcj7fgpglcjh8ujv;1:8ixbhbwj9;2:0h61he4ha6lu8gsaikbjadheeh2fjshj4jh0kgzllbnhfph7qhcrj1thd;2:2li3j7bipej2ohhqharh7whh;2:tjuwh9;2:9ioqik;2:8gtbj5dhdej4jkj;4:8j1bhdoljwhd;2:cjfrhe;1:fir;2:8ji9h7vit;1:gim;1:0j9;1:ej4;1:eikfh3jhekjcnjkqjuwhc;1:fhggl5jh2wl4;2:6hgpluqh1wh3;2:0hf4iu8im9heanhbjdcgtffvgheik9kh5mizoh9phdqilrk2th4wgx;1:1hb4in8k09kjak2cgxdhehgiiinjgjkgimizngxpgarhbtkdujhwh4;1:rir;1:niq;1:9it;3:0gq1jj3lf4j77hebgrhhgkgywmx;2:7jn9hdcjddipeh6hhgrm4tjiugkvip;4:2k34jd5gw6l57gx8jj9h8ahbdipehcggihh9ih1jlgkgklh3mh4ogtpguqiqrixsggufhvnewgn;2:5ivciv;1:eijjh0qhhwlj;1:dh7hl3rjkwhc;2:pje;4:pittiz;2:0iy1pf5k17ghfhgggqkh7rguwfu;2:8h09jx;4:hh7jhgqjcrjo;1:siq;1:ajokgnrjjsiy;2:cjd;2:5knfjfhipwhf;1:gipjis;1:0h11h64h55m76hc7g48ftakediregrfiygjqhkrih9jgjkgzmj4nh5pgsqikrl4sh5tgfvh8;1:jk8;1:mkyrgp;1:8isbilfja;1:sil;1:1h03h87kp8kh9g7ag0ciwdl9ee4fklhhhjiskhalhdmgunhdoirqinrkitgxugw;1:5j78j3jheohcrjzsjutjbwh9;1:0jfjhgphfqk6wj9;5:4p68gych6ejaqjpwgr;1:eiljir;1:ogspl9win;3:0jkrje;1:7irpipwhc;2:5mf7hcejiqhduh5wh9;2:3ip7go8j49h7go1jg5kjqohdwh7;1:8isfis;1:8li9gj;1:7j5ohdphdqherhgwl2;3:1jy3h64h97h68ha9iqajgdh7eh8hj8likohhrjtsixuh6;1:1il4hb5ik6hg8it9gmegnfhgjhclh7nipojgph8qmgrh0siztituj8vhhwg9;4:fkf;1:4ilujx;3:jhdqk3;2:8k09h4aezbjgchcdireh6ggsjkgpiprh2sknuh2wk3;1:1h98hecj5dhcehgfingfdhjrjhhkionhfrkougxvjuwjq;3:qj9whc;1:6hb8h99hfbhfcizfipgk5hisjjunhgqh2rh9sjfwjg;1:5iv;1:7hc8gxagpbhgcipdhfehgfjegh7hh5jj1ql5rjjshgtjdwj9;2:binmjt;1:8iq;2:1hb2ha3hg4im6hf7gv8gh9gyag4bh6cikdh3fm9ggujlbkh9oldpgnqimrh0sh9tj8uj3wkb;1:8lg9h4aiwdhbehefh8gh6jipthfuk2viw;1:bhdcirfj2kjr;4:8jm;1:4nx8hawh6;3:2it;1:6gceiyjhgqjhtivvk0whb;2:3jkrj6whf;2:mjd;3:rgrsj7tm4wil;1:ahgqk0ujswh6;1:5j9ohfpj6;2:0ipwlk;3:pik;1:8hbahfbl3dh9fh4gjihj2jhfmgoojhphcqhgshdtnjuhewgt;1:5jc6ha9hhaiokj9siruh6vjmwh9;1:cj5rit;2:plgwg1;1:fiuqj5;1:ak2pk6qhgrh9ujnwha;1:tjm;1:cio;4:9gdah0bgyfhgjhcpkqqhfsk3ulbwjk;1:9iublhghalj5oj0phf;1:3j97g3gh9qlvrh4uhawly;1:aixmmurgrwh1;1:ej2lki;4:kis;1:8h59jbbh4kjf;2:ajdvim;1:bk9;1:ik1;4:9ik;1:aiuqj1;1:civ;1:8ineinoit;1:jj1sip;3:fik;2:8h99iqbjich0sjewjh;1:eixpjd;3:pim;1:wjo;1:8jn;1:jkfwh9;1:uk0;1:5j66hgcjujgi;1:oj4;2:4ipbinoilrja;1:8ik9jmah4fhbgk1ljfrh8uit;1:pknwhg;2:9hedj4kj1;3:6hbvj9;3:8j4tk4;1:gip;1:jiwwhc;1:fhghjbokp;1:1iw5it7in8ij9h1nipoj8phergusixtituj4wgr;1:8km9grrl3tgs;1:kin;1:tim;1:ekv;1:cevflk;2:piy;2:7kmbjnch0gimjgumj5wh6;1:9izbimhjcjhbqk8;1:fjowiq;2:fiq;1:ij9;2:ciyqjvrhgwgp;3:3j27imaikegtfk3hhcjjdkillhgmgxoh1pl0thhwgf;2:3jzak0jgykhgpjjqhcrh1wl4;1:8imifaqijrl7;1:4is8gf9kjdh1ek1jh9njgojdphfrh8wgx;1:tkv;1:oh2qkd;2:fisqjr;2:liy;3:ajofhckhbqj8whc;1:bijjh3oh0pk7qjwuj2wh5;1:0hb1j03h24h25hc6h97h58j09fvak6bkyck0df8ej4fj9gjihkdjfmkilliunjrogqpgrqgzsgyvh1;3:oh9pjdsj6;2:5j99hfsiv;1:8guwks;1:9h3ajveh8fkm;1:8j0dhheik;3:6j48itdl2uh4;1:hiv;2:qji;1:8iwah6ujr;1:3ix;2:cir;1:aiowk8;1:4j6bh4gh5hh7jlzlkzqh3wh3;2:1l4;2:8iq;3:1in8ixvkdwhf;2:ej6;2:9ijliq;1:8j5gk5jhcpj4rhb;3:1ikbiukj4;1:9iw;1:1hf9krakpbj2cj1eh6ghchhhkm4lhemhhngsphcqhhrh4uhdwha;2:3heilmthguhevlxwg7;2:nk2;3:wj8;1:3h05he6jp7h29h8ajtdh9ehffk5ggzhhdjgckh4mkeol0pglrg8th1uiuwle;1:8jlgj2rgw;2:fhfgk1;3:2ineil;1:jix;1:2iuriw;2:7jxdhcekjqhe;1:7hf8heejnfhdjhbkgnnk5olvpjxrj1wh3;1:1inbh1dj5hiowle;2:8is;1:tis;4:1it3j64h45j76hd8hgbjldgshgtqk9sk7uhdwer;2:gik;1:ckp;1:ahdrjzwhb;1:8jp;3:hisqiu;2:ajm;1:ajj;1:8ivgj8;1:8iobh1ejlfh7gjbkktliyph9;1:wjm;1:bik;1:1ha7jibk5ciydhdfh7gh5ijljjnmh4pgtqlark8thgwfu;1:8is;2:0j82iq;1:3hd4jg6h57he9jhcj9fgiggqhkmjionj1qgxrfvsk3th2uk8vk8wgx;1:1h17h79jvahdbitdjjjgbkirlhcmh6njeoilphhqhbrk4sikuh7wg5;1:aj4fhbwj8;2:pjdqil;1:rit;4:div;2:2o44hb7kj8iojh3rhasgyuhg;3:ck8jhg;1:aim;1:8h2cj4sjjuj5;1:3imbjrrirwhf;2:rjg;1:2iv8j69h5;2:bjdkhf;3:5izbiohiojhariswik;3:8ioakabgkch4ejdfhfhiwjivkj4qilrh6;1:9iz;1:8lvdgyejbiimthf;1:dgxeixkjc;5:kjfoimphb;1:9hbagydj5ejefkfghgjiprhesj0wh5;2:jiwwhc;1:6j08gxahefgogqbrgxwh9;2:wju;1:4he5l76l9jh7phgwgu;1:jis;1:8jb;1:ehfpj6rir;3:8jirgo;1:cje;1:rkq;2:6kyph8qhctil;2:9forl9;1:ajeoiywiq;2:2im3gw6gu8gk9jgbh3cipehgjhhqhhthgunfvlzwgp;1:bjarhc;2:9iq;2:ggywm1;2:hij;1:9j0;2:0ln8ikahe;1:0j91kt3jk4jy5hd8gx9hebgochgdhegimhhgikyjiuogpph0rh7wjn;1:8hgmmi;2:2ip8hhchehisjl1oj0pgtrh6wj6;1:9imij6;1:8hdgk8;1:jjm;1:rjp;1:3lz9h3cj5hjsqhgrh1sgruj3;1:8he9iw;1:gj3;2:0j81gt6jm8gm9j0ah8cixdj5giojjhqjrrgksjyuh1;3:gj7;1:1gugjznjcrh3;1:3hh5iq8fl9kxagpbgcciyegufhagjhkhhnjlrh4tkduhdwls;1:pje;1:1gj3h34hb5hc6hf8j89ktahebj6cikdh7gjjifukjqljtmh9oh8ph6rl1uh2vhewgq;1:dh7eix;1:4kqbgwch8gg8hh3jg3kjrljloh9qqcwfu;3:wit;1:gjb;1:wjh;1:njc;1:gir;2:3gqjkhwhd;1:9ip;1:4goiofwhe;1:nik;1:1iz9h9jhalhbnf9pq5rirshcvim;2:3k3bj3dgpgisjj5qh9rjrwiy;1:wje;1:7nt9ikcj2ghghj9jg3liknj9piwqh8rg1wgf;2:ahcfjx;1:8jrbh1dikpk9qhfrgvwjv;1:tju;1:2iyjh7wkp;1:7h89ixbjiehejk4;1:0gz1h02hd8q19jhah6bk3ggjih9jh5kk7lhfmjjoghpgyqgrrgquhewh0;1:9ir;1:7jchirkhgllvnhbwh8;1:mji;1:3na4iu6ha8gq9grah4bhfdh1ehcfjsohgphgrg8tjrugzvjcwmi;1:0kj1im3jt5il6hf7h7agwgh2iixjh4kh8ljbmhgnj5rgzthfwgc;2:8hdcftrk4tlnuilwh5;1:ggmhjtiix;2:fir;1:oj0uiq;1:gik;1:7j4dhhjh5qjyvir;3:7iy;1:kjc;2:bim;1:6iqgj6oip;2:0jk3hf5he6hhaitfizghcpl5qhergpuje;1:vit;2:5io;1:8jh9griispio;2:2j58ikbjtdhgjjhwgv;1:8iodhheix;1:8ha9hgaktbjmfj4hgpmhfoherk2wik;1:ej9rh7wj1;1:1iv2go4hb5gt6h7ah8bjach7dhaggyhgrjlckgznhhoh9pk0rjvskxthfuhevjb;1:8hfaimjjhqj2whb;1:agrcj4ehafmfgh5jhbpj7;2:6im;1:akggh3jhamiqpjtqjsrhdsgzwgq;2:8iwuji;1:8iu;2:7nq9jbck6ghfhivjfqlijnjaqh6rgbwgd;4:cjbtiu;2:3j0;2:ah3hjd;1:wjd;1:8kx9p5akpbh8dh4eh7fgqkhcrh1wgx;1:jj7ljargu;1:3ka8hc9h9egwqj5wl8;1:4iz5he6hf7hg8iu9j4ahdbgpclvfh2gg8jlkkh8pheqgbrkhth8ug8viywka;1:2ix3iz5is9hadjlggjiixmj0nhfohgwg3;2:qjm;4:vja;1:aj0jhaqjh;2:jh0wll;1:8h49izfin;1:4ip6ldhgsrjcvgrwhe;1:ahfbjk;1:8j0ailbjndhaeipfimghgkj4nh7qjmwhd;1:1ja;1:qj1;1:5gj9hcagmgh3hnqjj3phdqjzuj6viowhf;2:8io9gzhjijioqj4;2:gk0;3:2gvolm;2:0it6il9h4dgnqiyrgwshfvin;1:qj1;2:9ilojc;2:fj0;1:5lq6je7hf8h9gjrhikjgyth5whd;2:lik;3:0ir8in;3:0hd1jx2hc3kj4h65hf7gy8jb9j8aiwbh9dh2eh6fhhgjcih3jgqkgzmhhnh9ohaplaqgpsiltj0vh3wjp;1:1jn4hg8km9gubgucjwdj3egpflfgjmjhelhephgqh3uh2wh4;1:gis;1:pim;1:9ix;1:4hdbj5cj2iivwh4;2:0j8;1:0j75ix7gtaiqjjk;1:bjdlkanh8rh9;2:8kajhg;2:2kd4ivjh9ohcrhevit;3:5jj8jq9jwahbdh1fhewj6;2:pka;1:hix;1:gj8;1:8hfbjcplm;1:0ipgj7pjkwh8;2:4hf8gw9haahfbhadlnemzfkxghcrhethgwh7;1:dikehg;1:1hg4h95h96hh8gdjh1mjsoklpkzqghwkm;2:ljl;2:3kqqhd;1:rin;2:1ggahebisgilhkfrlmwhb;5:0jq1is4ha;2:8j8;2:3h46hg8iqbiociqdhfeh7gj7hnbjh5kh5ninph5qhdslmuh9wh1;1:1jnfir;1:aio;1:dipfgrgjxhj6ogmwka;3:ojq;1:oin;2:8jxafasl2;4:qkwwhd;4:6g9ch8djzegtjh8qjcvjrwkh;1:8h2bhbfirgl5hhh;3:3h28h29jtajublgchffhcgh3hhfjgvkitnhfqikrh5uhbwlp;3:0im4he8iw9hedkg;4:0gz1iz3h98h59j1ahdbj6ch7dkgekcfjpihfkj7lhfmh5nhcph1rgeshftizuiuwgf;1:0io9jceh5;2:8il;1:firgk2qk0wgj;1:4ipajabk2ck6dhcejaggzkjapjhrfq;1:8h9dheeheflbkgwlh7nj3ritshgtku;3:6ineirginjiw;1:3j1ejqghhhilrh0;1:dj6oiz;1:9h7aiscjadh2elgfgugfyhhgjh1ohgqh0rgssh5tjruixvjywlm;1:gj2;2:4jbdgwohdpjmwiu;1:7iobip;3:qis;1:8k19jbakxbjmeh8fgjkhfnhgohhqj5rilwf9;1:0jf2hf3jj4jx6h17h38gs9heagcbikchbej8fjpggcjgrkgnmh9oh8qj6ukzvj1wg9;3:jj3;3:0le1j03ft4kc5h47he9l9ailbj7cj0eh2ggshisjgekh2mhboghpj9qglrkesimtgmuh4whh;1:kja;1:dilej5;2:0h31ir3h35jy7heghchh6jkkkl5lmcnlzog2pgcqgith2uhewh4;2:wiv;1:3iw4l45jq7gxdhfeinfhajh7mitokgqhhsgrwgx;2:0io;1:din;2:2fd7miah7uk4;1:4h9oka;1:4j8aingio;1:jirml5wh6;1:fje;1:qjh;1:8ioejb;1:aitnjmrh7whd;1:3iotiuwh7;1:jiy;4:wji;1:jhhokksj5;2:ljp;1:9j6pja;2:jit;1:miv;1:cjefiynjv;1:qm1wh2;2:7il;2:djqegsvil;1:9jociseinhhgtim;1:jjuritwj4;2:0h51kg6kyvf2;2:kiytj2;1:ail;2:hkd;3:kjguit;1:8hd9heeglgj0rmgsimuhawiu;1:aiy;1:8g89lgajodnneg7gh7jgtrgqth2vjpwh3;1:8h9llh;1:hip;1:rkfsiswh6;2:9hgeje;3:8j2;3:5j0lip;1:4j6rj9;1:dgwhjq;1:1jb;2:biwogfpmrwgu;1:4kx6hf8je9haah6hh2jldom0ph6qhbsglwh6;1:tjg;2:9jukhf;4:1hc2jy6gg8k69h2bklcgueiwgj4hgrjgrkhhmiunjdqhcvj2;1:0kpjjbwh3;1:kj7;2:gik;3:cipgk8;2:1ix3iz4ip6jv8j0dhdeinjh2qh7viqwh7;1:6hdkikugyvm8;1:4hc8h2cjkujhwjc;1:1ikkjd;1:win;1:vkd;1:agwbl8gh0lj1pherhfsjjuj8wje;1:bjdliywh8;1:jk2rj2;1:1ip3jt8iy9h5jhgnhfojlpjtrha;2:1gv6h58gy9j4cjfdjgek1fh2hh1jjlohdsk0th6vjrwgk;1:vj7;1:pimqkiwhe;1:mjl;4:wjd;2:8kt9gwhiw;1:fjppkpwh9;1:eipgjp;1:3k2jgvwj0;1:aiv;1:2kp4hf9jwagycizehgjjuohfph3qheuk9viowh5;2:9iwuir;1:0iu;1:7k7;2:mh6oh6pm3whd;1:eik;1:nin;1:ol0;2:8jneitfipwh8;2:hh4risujg;1:6hhvin;2:8h5kj4oj3;2:7j2;1:miz;2:bij;2:jjswhc;1:8kc9gm;4:8h49j4;2:9ijiju;1:3imjgowk3;4:7h48fc9h9aiobktcjyehffishjljgunjsqiorh7sisugxwix;3:1le8gh9l9khd;3:8j8;2:hikpiq;1:dip;1:3iq;3:djeqlrwhf;1:wk2;1:1jm4iljjzpjfqgzwhe;1:8j49gy;2:wik;2:fjoqj3;1:8izjhetj5;1:jhcvjj;2:wir;3:8j8kimnjg;3:1je;1:0iz1h52hb3pu4h35g76j67im8jb9gobixcgsdhaejbfgxgfhhilihgkh2ogypgrrg6sh0tk3uinvkdwgt;1:8gu9jpbir;2:3jf8gb9iqaiubhecipwju;1:oio;3:ahekjowio;2:wir;1:6hfehbfj8jh5miuqitviywj8;2:jjj;2:hgprk2;1:tiv;2:bjdhioqiv;1:9io;1:riy;1:8hdgk1;1:bjajil;1:eis;1:3hc4hc6gw7n99h5akvchbej9fh1gg6jguliooh9pgaqm6rgxsj3uj4;1:wl0;1:8il;1:1itfj1riq;1:7hd8it9gpajejlfkh9mhhpjtqh8wjr;3:wl3;1:7g6ajxuj7wk8;1:kjpliuwhd;1:wjf;1:6fh8hejisnikpiwqjvvkz;3:3h16jb7h58ks9ggcixel2fh2gj5hk0ihejg2kinlhfminoh2ph2re8siltjiuguvimwkt;1:8je9js;1:8hebjkclcfh9rhbwjv;2:hfyjk9;2:gimjippjlqha;1:7kb8jn9gycirfhajgxmh8qjtwjo;1:7k6givthf;1:0h21h52h43ix4gx6gm7he8hgah8bgrchbegfgilhluiixjkylhhmhhohaphdqj7rjish1tguuggwku;2:rj2;3:wir;1:jje;2:8kh9ipehbhjm;1:bh1ejofjaqiq;1:0j7;2:eh4ng9pllujt;3:8ik;1:8hcaipciqlipriwwhe;1:ah6fh9klywh7;1:0h82hf3jv4j86h97la9jmakibjlcjkeh6fgrggkhgzjfykjdlkkmhbnh8oh6pgnqjhtgrugjvhewf6;1:4j0;1:ljq;2:1gr3jv5hgah5fjmjhemnnrg7wjj;1:5h18miegyjgokj1thfwm5;1:8gj9jrhipjjx;1:3hd7jb8ji9kdajhblncg4eh3fkhggshhdjiklipmhdph6qh3rgotisuiovhfwff;1:3h58ku9l7ah3bhgchhdhhegvfhfjj7rkmtjnuh5wgv;2:0iy;2:jk5wlv;1:sjr;1:1kvbkhchdfh1rhgwks;2:wip;1:wio;4:5hg6m57h98kr9h3cj9eimfhcjheqknrgyuhfwh4;3:ijtwhf;2:6jueh6qjowhg;1:7jobl6rgpwhf;1:alhfh6gh7sjf;3:0hc1j02hc3h24h25hc6h97h58j09fvak6bkyck0df8ej5fj9gjihkejfmkilliunjsogppgrqgzsgzvgw;1:oij;2:dhfejnfh5iil;1:gj2jhfrjdtja;3:rji;1:8iw9ilajbbiveh6fhegkbjheqh9rgztjr;1:4h55jh8k0agtgh4hh8nn9ojcrhfuhgwh1;1:2im;1:dfzeluuk3;1:jj1kjvphcujw;1:sja;1:0iq1im8dj9l2aiotl9ujbwhg;3:5j0;1:wiw;1:8j1kip;1:3jagikskpwhg;1:qk5;1:uju;1:9iu;1:wil;1:ggthlmrhg;1:1hg3k2gjipixqjnwh9;1:8k2cheeivqjfrha;1:9iyjhfoemqmvsiq;1:8io;2:9j0;2:9iksir;1:5k8;1:tkhwgx;4:kjm;1:uip;2:2hc4jbgjyojp;3:cij;5:fhbujn;1:cj8hfyjk9rgz;1:3kg;1:jinoisqm2th8wgy;1:bipqj6;1:ahgeimfir;1:jio;1:uiy;1:cj1giytil;1:5jd;1:8h7aixdh0ekzfh0hjgjhe;4:bj7;1:0gw1hg2j63kr4hc6kn7pv9e9ah0bh0dgzehdfgegh1hgoihgjhfmh9ohdph3qgwriyth7ufuvm3wl9;2:nim;1:1hg3he6h37heajjbgbckydhgeg2fhggkfhh4jh0kh9lh8nikpguqh3rixsjhtkduimvj7;1:mh3ojc;1:ij4;1:tjg;2:8ildj6ognpjl;3:8hb9lbggojjokgwnmepheqhbrh1wj8;1:8jb;1:vj7;1:ikg;1:4in8hgcghelifishj9qj0rhdsinth5;2:dgqjkjriovk7wfu;1:0ka1it3ju5il6hf7h7agwgh4iixjh3kh8ljbmhgnj3rh0thfwgd;1:jhgpm2wgj;1:aiofhejj8;1:1hc5hf6jb9g7alnbjzcirdgvfgtgk9hj7ih2jfukgelj3mj0pgyqiptgvuglvgjwk6;1:cgurja;1:mje;3:aircjvggb;2:4j9dgaejygj4hgujk9silvjo;2:agubjgchffix;1:2ikbk6hjkqh3;1:bipnit;1:piq;2:8iq;3:0m51j93hg4h46ge7gp8kj9h1ah8ejsgh1hk9jh2khbpjjqgiwk2;1:cjf;1:5mk6gnvgi;1:0h22hb3je4hg5h86he7gz8k49mqbfxck1el8ggzhinjgpkh9mhhohcphbrjkuh8vhbwhf;1:ij8;1:6jzthe;1:3hd7kkwjk;1:3iktiz;1:hijwkb;2:mjc;1:9ioqik;1:0gq1gr4h46nm7g6ahabjleh9ggkhjcihejfqkhbmldngmojmqgdrj4sgsthbuh6vlswhc;2:2h03kk4hb6j0ah6bl0ch2dkqel8fgigj8jgzphfqharhbwg2;3:jgnsk8;4:8js9gt;1:5jz7j8civehe;4:0gz1h72h83n64ki5in6hd7h68gp9k7bgpdjqeh6kh3ofypj4qg3skztgzufrvh8wl2;3:phfqja;1:5hgcikggyjivmhhrmb;1:4k9ehefj9jgzogwpjtslgwgw;1:0j31ga2kkahgbhbdh5fhggp5jg6nhfpgiqmbrfvujnviqwfk;2:3hc4k76h97ha8g49hgagybgecgsgkjjiqnj2ohdph7ql1rgxvlqwj4;3:4ij5ixfitwin;1:hj2;1:wj3;1:hkgjfxqjiwik;1:hjx;1:vjn;2:ditgj7miprhg;1:fiqrivvik;1:eij;1:fik;1:hfxtl1uix;2:1io3gr4h25ha7gk8mc9jpchbdiweivffygj1himjghkjlpgwqh4shdufnvjh;1:gkbwh8;2:qjb;1:6k97hdah8fk3jhbphewki;1:wiv;1:bgyjksrhe;1:8lt9hechdgjqkhf;3:tip;1:hizjjiqjmrgy;5:sj6;1:qik;1:5ja7injhamh2qimwjm;2:pjzviw;1:klimhgnh4wiw;2:diteh4ojcrhhwil;1:2ko3h45kw7kv8hgbjqchaghdlikqgoth4whc;2:8ix9hchix;1:1iu;1:3jq;1:fgegla;1:0h91g23h36hf8fr9gsakhbnacj4ek1flbghfkfdlhbooupheqh7remuh9wh7;1:1gtcioggqjllkj0qjrrh7whh;1:ehbfg0gl6hj2skbujzwh9;1:8gu9koagzun9vgl;2:3jbegrfjesik;1:9haaitghghhawke;3:7j08gdajcbkdcinghgqh9wjo;2:ah3eipujx;2:0jg;1:civoj1ph4whg;1:1h86jkggwjlovgv;1:nhfpjq;2:nim;3:cgphjekh2ln6nh8;1:7lroiu;3:5h1glgjg6wky;1:4j08iz9mqahgdh8eftwhf;1:niq;2:8jr9gt;1:nixqiu;3:9hgag3dhbeizfk6giwuis;1:ggvkkkrjcwh5;1:bjejhcwkh;1:jjo;1:tiy;1:ik0;1:9iy;1:8it;2:ujg;1:3jb5jd6jrjhcmizph9qj4wh2;2:ajvggohiljhfqjvuh1wjt;1:bip;6:fjkojo;2:1jmbimhj8kh0lhgnhbpl6qituk1whc;6:8hgajzghgiinjh6kh0lkfnhdpk3uimwj2;1:0lh1h23gy4il9h1cixeiuggaikbjhakhdnknphdqh7riluhfwh2;1:0iz4ha5ik7hg8ij9h7dlkeg1fnfghdkiynhgphdqherhdthdujrwh8;1:aj8uiw;1:iikuj9;1:5lg7hdwh1;2:jk3qjfwgs;3:sjo;2:8gzchffipgjsjj7lkkrjotj3uhawgl;1:3he8jb9jsdj0fio;1:uix;1:8hdahcbjdeh9fo4ghghipjitwhd;3:1j62gt8h4bizchcgimminqjyvjqwha;1:0h6fjhrkbugs;2:jj0wh6;1:3lo9h8dj7eh6jitwgp;1:sj1;2:8lhaknbhgdkhfhhgh4hheqh8rh4tinugwwhd;1:ehbfjc;2:mje;4:piq;1:bjrcjcjj9qj5rhgwh4;2:5je8iw;1:5jz;1:nk5;1:1iv2hc4in6hb7h68g9ahcbj6ciyehbfj1jitkillh9mhgphdqjarg2wjp;3:aghglejgxsjd;1:8jdbim;1:fh0kkb;2:1ir3iwwit;1:8izajkbh6cj3jgvrh8uj0wjv;1:8klah6bgrcldnimril;1:pj7rilsk6whg;1:0k11l52g03g34hc5h46gg7n88gxbjlegsfgnggxih8jk5kiuniloiypg6qg6rjetj3ug0;2:3jt;2:8iybhccl0ehgjhaphgqiy;1:doeegxfipghcrh9uhh;2:gjnjhfsj4ujbvjg;2:tiluio;1:7hf9j0jhbqhftkewkp;1:bimch3fimjharijwm6;2:9in;1:hj5jgvpk1wim;1:ij3;1:7j6hiwrha;1:uik;2:civriy;1:qja;1:qir;1:8gwbn4cgvdhefgygjbhhajh2khdlhgqjsrhath7uhawm4;1:3jiqk3;2:hiowio;1:8jk9healifhe;1:fip;2:0kx1j53h64gg7haajfeivfj7hj5ih4jinwgf;2:agwdjbeixrhesh5wl4;3:wji;1:hhfqj2;3:tk3uh2;1:6he7gg8jt9kmagabgnch1djhemyjgjkgsmhfoh8rgtsjath7wit;1:rhewjk;1:kjgmiuvikwjb;1:1ilegejka;1:8hdbj5jkk;1:bh8rji;3:3h55jt8k69j0iksjh4rhgwhc;1:rj6wk0;1:aivwk8;2:7irail;1:1hc8ku9e3ahebiodh0fh5glpih9jh1klbliqmhdrgvtivuinwit;1:bh2cjanjl;1:wil;1:4jv;2:7je;3:2hg3gy4h96hd7js9izbjbdh4eiqfjrgj6kiklgtoguphgrj8shftglug1vit;2:9hcfiwghfply;2:kinwjh;2:1gy8jr9jdbhecgqfk8giohj9ihgrfzsistko;4:8heahfbjhcmjfh0rhbwj8;1:fj2;1:1fz3p64gwah0bhach8dizfheihbjhbokxqh7rh2sinwjw;1:9ir;1:1iz7jl8h99irajnbh6chcdjbeh4fjnjh6oggpj7rj5uik;1:8gzak5fh1rkmsk8;3:9hfwkb;1:3kf9iwsir;1:0hf3h65iy8lk9gzah6bgsgixjgekkxlftmhgqhbrkctiyujevhbwgu;1:dj5egujjaujjwhb;1:lhgrje;2:hir;3:3jl6kc8j09hcej1hiqkhdljsrhgwgz;1:8giaixdh7em1fh4ghgsjg;1:8hc9iugjejh9wjr;1:8gnbh0gk8hgsjksoixphatjhuiq;2:8j89ha;3:egfjn6;2:9jfaiw;1:8izfirjhgqix;1:0he3h36gy8hb9jjagvbgxcfsdn7eo8fn4kgolhemhenhhoh6ph7qgzrgsshgtgrujpvj0wgo;1:4ituhfviw;1:9japjf;1:0ml2h73gi4g25hc6hc7h59iuak5bgccm4fhhggqhiril9lh8mhbnh3ph0qgxsh2tgiugpvhdwmh;1:3jweio;1:fhggiquj0;1:8gp9izah6jhgsiwuk5wjf;1:8iz;1:fkiuh6;1:7hfphbqm9wj5;1:5iq;3:9j7lj4;1:biqeir;1:1gn8ge9j0bhfck8eh0fjzgilhkliitjgjlhgmhgpherkjtjfuhfwgo;2:8jy9h2;1:aiooiv;1:bkmdh7ejjfhchjiwhe;1:3ha7hbbgydhgehffhbjkamhgqh7rmksinuizwiz;1:8iv;1:0h81h83gx4hc8gi9geaombgocjkdgjeglfoggjkhkgjfzkl5oh9ph6qgjsh5tgjuguvhawj7;2:0jw6h98lg9ixagwpisuilvinwh8;1:1it9ipwjw;1:0h51h99g3bj9ckcegrfjjgk4hjujggqjswh2;1:7iq8iu9hbbiyqjlwhf;3:jhgpjr;1:njcrhfwjl;1:0ir;2:cinjilmjdrgp;1:ejcfjeok9;1:3j95ha;1:9h1rjq;2:8ns9fpcj5efyfhchl7rh3;1:finsim;1:8gjajjsikujh;1:0hf1h73he5hf7h3ah2cimehdgj8khelhbmjnnn8oiuphcrgesikthe;1:hip;2:iilpkh;1:kjc;1:9ipcikgis;1:8hgbk7ciyejggj5kh7rgu;1:tj0;1:ejd;1:cj3;2:gk3;1:kh8lmrpjcwhe;3:ojxqhd;1:fjnpiq;1:jjdmkcrh1;3:0inohbqjawhe;1:ahgsh6wky;2:bhgcjoghdkgzllsrhe;1:4kq8he9gockrdnmeffgh8jgrphgqhgrgpsj2uh6wiw;2:wiu;1:6go7kr;1:8ivhizuj2;1:cjkriv;1:cjegh3hjnjheqiqwj8;1:sj6;1:3ioekw;1:8ikdit;2:nje;1:3iy8lu9imdj5em9fh2ggohjgjgrqh6rivuhawgz;1:1hf7hebkuchafhggl1jjakhclh3qjrris;1:jk8sgz;2:1hfhir;1:2gn7k4;1:uk0;1:8h49jz;2:ok2phg;1:fjq;2:1ju2ix3kn4lg7hgdhfjhcoirphdrgswh7;1:1kmoj9phe;2:8ip9hh;1:ojb;1:8jl9hgbh8jk7rh8uk9whf;1:0he3gx5io7kd8km9mlah1bhechddheeggfhdghbjisph9qh8rjztjhuh1wgf;1:1h4ck1gjunisreywkv;1:cix;1:hji;2:6hdqlh;1:9h4ejxfj7gj4milwh7;4:8heaj3ghghjijgcqj5sjcwjh;1:jis;1:7jldivej9hhfjgqtiwvhbwjj;1:biw;1:win;1:jimwis;1:9imdj9;1:dit;1:lj3;1:ak2ciwfjbpj9sgu;3:wix;1:jirsjh;1:ij1;2:2heoip;3:7h78h0agvcitfk2ghdjjatkbwit;1:8km9hbehdfiqjit;1:nj4;2:7jh8hfah8fgbgkqhijjnioffqhgrhewj0;3:giphitriuuh9vj8;4:2kd6j2vjcwh8;1:2mjwhd;1:uj8;2:bhddh6elzfkvgh9rgyuir;2:8jr9grwil;1:giy;1:rj1;1:8jk9gofhbujr;2:8hcghehjdiinjjfrjqtjp;3:2jb;1:bip;1:8injjesji;1:gh3rm5wh8;2:wiw;2:4k5;1:3hb8gb9h8ajzcofdhbgh0hjskh4lhhphgqiyriltj5uglwil;3:eiohiv;2:8gu9jpwil;2:kik;1:jh9mgyrh8tjzwk2;2:njr;1:gis;1:hhbqiy;1:1hf7l38ix9jyajdbkncjgeh0fgmghdjiskiumhfnhephhrgxthewgs;1:8iuhip;1:fik;1:1ikvja;1:8h99jf;1:2lc6h79j2dhhjgpkhflgznmboh6pgpqjksikuh7vj3wgx;5:bmbeh3fh7;1:1iroks;1:ejchj7;3:bktcl7gh7ojkrdr;1:aj0cgpdiveh7hje;1:gij;1:2he4ha5ha6h87of8jrahfbhaghgjgkpkhqjcrhguhb;3:aj3fhbwku;1:djwegdhjluhcvit;1:0it6ik9h4dhaehfjhdlh4qixrh2shevinwjq;2:0gk1n63h26hf7h48ix9jnagtdj5egufh1gh9ij1jgmkkjlh8nh8ogzph6qk1rj7uh2;1:jixpkx;5:7g18h9ak2jj9ul6vh9wj2;2:8ilbgycjjgj5hiwijjjjdkhergr;1:0kx1gy2lb3hf4hc7jt8jqcjceiqfisgh5jgwkhgphgqh7rhgshauh9wge;1:8il;1:0jt3it8j79irajfchaehaghgjikqiswgt;5:1irfj2;1:4iz8g69l1;2:6hdgjiql6;1:0gr1ko2h03gu4kk5j36gx7gy8k39g0ahgbgbdheeiqgioih8jgrkjwlkdmirnkqoftqh5uj1vh7wgb;3:4ik8jj9h4;1:ikglin;2:0j38iw9fwajbbj0cj4gjjjhakhfmiunhfqjerjcshgth1wgo;2:bj7piwuj0;2:qiy;2:4ko8h7;2:3hf8h09gxeluhh3nhfpl5uinwhd;1:cjapkjwgs;1:8gl9kubgzdhewk4;2:8hf9kfehh;1:wiu;1:cjcrjj;1:1jk2km7k8dirqgyrh1wgy;1:4m18kr9gqdgcejujh1;2:aggblpdhdejxggrhhcjgokgynhdqgmrl2tjuumhvj4wg9;1:5jnjg3rjz;1:siw;3:ciy;1:giruik;1:8h49jz;2:1gk3it5h86he7h38mvagjbj5cjydhgeh2fgwhh0kgolh5mjwnhaoheph9tl0ugtvhawkw;1:gh2ilerhe;6:5h6eizwk0;1:1kw3hdph1rh4uhawmv;1:fio;1:7hbeioshewk6;2:ajpfh4;2:4k0;4:9hfejriiujhfqjk;1:qj7;2:oivuhbvj8;2:iiy;3:7j5cixjlsqhgwg1;2:5kbhhc;3:3lh5itfixhgqjiwpheqj1rhbthd;1:pk1whh;4:oj7;1:0h21f43ha4h55hd6hc7hd8gu9h1ah9bg8dhcekffjvgf9hheihcjg5kkjlhammfntbog7qh4rk4shbugevhbwjk;2:pjq;1:9heegsrkv;1:0jmah7fk1ggljjqwl7;2:6iz7hf8hfah1bkqch8disehefk4gljhgtkh5lhgphdqkcuhf;4:9hfsndwh6;1:4k2wh8;1:ljp;2:hipmj9oh9qivsk0whe;3:9ikbglcj6om4ph6qiwthgwj4;1:8j7hil;2:ahchinrjv;1:8hd9ingkeriowh9;2:1jn5izdg5ek9fk0jhfkhfrheujl;1:7iotij;1:5j99h5bisfk3ghe;2:3hg7jw8h9ajxbh0chadiuej5fhaik2jjmqhgrikwgu;1:fiwghcmiv;2:aivgh7hgwjkgmmcphhqkjrh3wgo;1:8gu9jc;1:eiqfhcth6uki;2:hh9rji;1:1hf2g33gt4h55kg6lu7gy8j49h2bg4ciwdjkfk1givhirih3jfskgzlhhnh8ogopj1qgbrh4th1ujhvl0win;2:0hc1h23gs5h86hg9gjblmckgdh2eirfgchk1jizkjylhemirnhdoh5ph0rkzugzvh9wgh;3:kioukb;1:2j2;1:0h21jd2nm3gt4js5gv6gj7lb8gq9h3ailbkuch2dh9ehcfhhhh4ihajfikhclhcmh9ogkpirql3rj9sh9th0uh9vixwgr;2:wj6;1:0it5gx9gvbjccioghhhioiirjirklamhdrgvuhgwjn;2:bjj;1:1hg3h76he7lo9hgah1bgicivdj0egtfj9ggzhk6jjakhfmj9nh7ohcqgzwk3;5:2j2ehegjeuipvk2;1:ahecgmrhhsh6wmo;1:lip;1:9h8ej5fjm;1:1go2jg3hg4h16hb7hg8gubh7cjefhhgeshl4infjh2okppherhbsj4ujbwgu;1:0hc3he4he6hd7j18gsahabh8ejbfnfgjohh1jh4nhcphaqh7rgsukcvjnwgh;1:jh5wjo;1:jilkjg;1:7j8;2:dik;1:divwji;1:8ja9h2biofishkajhdqhgsjetipuh0wh1;1:7jkjh9;2:1hg3hc8gtahebjjcikhj2ijhjjyniorj7tjxwh6;1:6l6agwbjajkvph9qhcwhc;1:2mrbkcch4phetj1;3:bir;1:dj6;1:6hajjful6vg2wh7;1:5iv;1:2im;1:gjyplpqhguhcwgs;1:ehfujm;1:4izojr;1:8js9hgcis;1:hin;1:ghbqkj;4:bijujo;1:1hg6hcbhfeh6fh7ghfhiljiqnjnqh5riltikukrvin;2:0itbireirhit;1:3ha7h8ij4jgomllwkq;1:6mc7iwcgtginqhduh3vjswgf;2:3hg8h29jnaglcjudilehfghgjh6pkfqjrrh5ujhvjgwfk;2:qjr;1:1h89jqfjarjlth1wjf;2:7jr;1:hgltjz;1:8kw9ivwhe;2:0hf3hf7jp8iz9hhaj3dhaeh0fitghahj7qhbrkltheuj8;2:7k3djaeh0thd;2:bijkj7;2:3hgaildiqmji;1:1gz2io3h34hb5iy6hd7gx9gobk2chaffwggxhhfihfjkfkh8mh1nh5ojepimqj9rk9tjfuhdwkt;1:hiz;1:0hg2j53h44h08g29hgajubgpch1dhceggfjeggrhklihgjiukgvmjhnh8oheph7qh4rgxsiktkhuo4vlawfa;4:8iudixejc;1:8jg9iqbinhheoispim;3:iio;1:8haalbgh9;1:jitpil;1:mirriv;1:jhdmoenhbwfu;1:hiq;1:1gj3ha6hc7kd8kl9l9al1bkjegmfgdggohh6ihgjh6kivlhcmh6nh9ohgpgwqh3rl1sisvhewg1;1:8g49gibilchgemykkp;2:eikkhdnmd;2:jj8;1:7ix9j3binjjaqiuwhd;2:ciwpjd;1:1j7lljnhfpik;1:dijlin;3:eir;1:hj6;1:aiqdhegjewjl;1:riq;1:dj6ehgjj1rjb;1:dgrhj1thbuky;2:wis;2:9h3ag7bjpch2fjpnkpqj4;1:his;1:1gd3k65hb7h88lb9lwagucgqeg5fgsgg9ih5kg8lh6mh5ngyoh8pjiqgfrjtskptiluh3viwwl0;1:8hbukf;1:aiu;2:jiw;3:lkywhb;1:jj7;1:ais;2:wk1;1:8hebhfdlyel9ghbjk8kinqh3rjrsguufdwhe;1:bij;2:dhdej7;1:2jn;1:ah8glohhbjh8qjhrhasgywjv;1:2g87kp;2:8h5oiqsipujn;2:diweh6;3:qjn;3:wkj;1:jiw;2:ditehb;1:7indh5jjcmjywj9;1:5jg;1:ij6rgwwja;3:3he4iu7l08h5ah6bhgejhfhgghbjggkknlj9mhhnjqoh5pj8rhdwg8;2:6hb8l39gbahgnjspjevk5wh7;2:tjx;1:giqhhbsj1wiz;3:gh4riusit;3:9izrh5tjc;3:ggwohcphdqkawko;1:1imhixrhb;1:2h95pg6g37jqjjdqhdvg7wgo;2:eiruj0;1:ch6fj5rjn;5:0hh1fy4k86hf7h38h9ciseinglbikqjinkjvlitmhcngrogjphaqj0ripthcwg1;2:6jc8ikajgwjc;1:0is9ip;3:7g7wkg;1:2jm5im7hd8j19gzajebgzjgokiyqixrhevj0wk5;1:qj3;1:pjm;2:dioehffjaghf;1:him;3:bjj;1:dik;1:3ol7hehjfjhaph7qhawgi;1:2iq4jc7iwdgfjipwik;2:tjf;1:4hg5hg6ju7kv9gtaguch6dg4eh5ggmhhejgpkgjoh8pgsqk9rgysgitgmuiuvp5wo8;1:piwwja;3:5ip;1:giwjivlisqgjwjy;1:eiy;1:5k3hhfsj1;1:diveh5;4:8h5bk3chcegsfmpggxjhbnheqmeshfth0ugywiw;2:5iohilnjh;1:7h7wki;1:3he4iz6j18fhbiscj4dlzelrhhboheqh8rgxugtwjq;2:aiocirkhgnkvwhd;1:bkhrh4;4:dh5ej8;3:3l18jy9hddiwehaqhfwh5;2:lir;1:1kehiyphd;2:wj2;1:ch4hjbris;1:0h41k12h93h14h55hb6h57h59ghaldbkrckhdebelkgjrhl4jf9kgvmizogtpgqqgqrfxsg9vguwl3;1:ck7oj9;1:eio;1:0j8;1:aghflc;1:aj5uhevkj;1:4ir;1:8j3kh9mksohcph0qj9wiw;2:2iyshd;1:fgpgjkwke;3:iipjizmj0;1:iio;1:1h53lx4gr5jj7je8jw9ircgjfgygfuhgwih7jj1kg8lhaogupfzqkprg3tlzuivvilwgb;1:mip;1:plhwg2;2:pj2;1:gh6jl5;1:jjftipwh9;2:bnhchcgiukh9lhbrit;1:dh4jjr;1:7hbjl0wir;4:3gw6or9fkehejh5qhctheucrvrwwgt;1:2mm7jc8j1jhcoh1whb;3:dh8ekqfh5;1:0joajafjbhivjhdrgs;1:dheejhgiu;3:8jkahe;1:3h97hf8h6cisfhagj6hhdmleqhdsh9vinwji;3:1gz3iz5k57j09h1bkedgzgj9hhekhhlh2mjiogdpheqgmrgxslmwgy;2:dheej5qjawin;2:ejyoinwjr;2:8jk9j1eh8hjcjilqjhsj1thh;2:1isciw;1:1j83kd6gx7h8ak4hisij8jglqk4rjiwfv;1:wik;1:dgmelnqirthc;1:aiveilfiq;1:0hb2h24j56he7jfaj3bjhchfeitfipggrhhdjkdkjwokzpgnrhgth2wgj;3:3hf5je6lm7gz8hh9hdpkfqhesiuth3vj7wgk;1:1g68izbjhclvejigh4jgxkheqj8rk4whc;1:dix;2:djdjgurj7wjg;1:ah3uk5vis;1:2l6;1:8ha9gbdk2elqfirrheuhcwit;2:vj1;2:1k22ix3ko4lg7hgdhfjhcoirphdrgswh7;1:ejt;2:aiu;1:1jj5jcjh8pjjqhgwgw;1:0j61hc3jl9h2ejffhfjj8ljdwip;1:9j5fhagm0wha;1:wiv;2:8py9h6bh0rh5th2uir;1:mjq;1:cislkk;2:1ik6ij8j5agygh2jh9viowhg;1:bhflki;1:hh9qkt;1:jhcrlmwh7;1:0j5;1:tkd;2:hhgjik;2:qivwjv;1:hgltjz;1:7mi8jawgp;4:qjw;1:1iq2ji3h54kl5hd6ha7gy9h1bgrcgzdg3eiyfizgglhgpiivjfkkm5lk6mhfnkmojspl2qggrg0thfuisvhawey;1:6jmagzditkk2wje;1:1hawj2;1:oj3wj4;5:1ipjj5;1:nj5;1:7j8;2:aj2pituj5;1:riz;1:8gt9j4ah2fkfplawhe;1:fk3;5:8iq;1:ajvbkvcjkdhbeimfikggtjhfkizpj5qj5rfiwh5;1:wil;1:0iw4jijk3wha;1:3j78ilajkdhfeh3fkgmhewhc;1:cilwjl;1:jiq;1:2os7gmwh3;1:ql8whb;3:jj7;1:9iuahe;2:jhgtj9;1:kil;2:4k4ehcfir;1:4ioagvbk2;1:8js9jeajhjh8mk4ohfrhgshftjcuhfwh5;4:wiz;1:fiulh7wkn;1:oik;1:kin;1:7iq9k5dh0wjh;2:gjo;4:lir;1:6jn;1:2n54im7k78ithh5jh6rh9uhgwgz;1:9jbcj7ejnphfwhc;2:0ha4hf5ipdheeiqfh9jhfrixwj2;1:hhgjlhnikqhfwil;2:3gn4iv7h69hbdgsek4gh7hh6mj2pjeqimrhgtjlwgl;1:0ms8gzdhfjheng8pl4qhewin;1:jit;1:win;2:jhgtj9;1:3hf5jo7g18j39h4fj0giqjjlpilqh3wk0;1:gjq;2:qj1tmewgy;1:qiq;1:6hb8h0ah2bh5fhbhh9iiwjhcmhfnivrisunovkx;5:3h26hb7h8aixbhedhcfgoghehjgiiwjglkhdmhenheqh1rh4tjyuqgwh4;2:his;1:8gzwkr;5:6hdqk7;1:0kemjs;2:gjirh6wkr;1:9ileiu;2:ciw;1:ailciwvik;2:3jorgzwip;1:cikeirgilhj7wh9;1:0j34ikdhbekifhaoixph7qhgrk8wg5;1:0he2gu3iv4ha5gz6h47gc8ji9hcagmbmbdgnfgkihajk0kgjlgsmjlognpgxrj5tlwuguvj3wiw;2:4j55iojhe;1:fjpjhfoj2phhwjm;1:8iu;1:dikjj5;2:0hg1hc3j44h85jc6he7hc8h4bh0cjndkdek4fhbggpjetkh7ljemiknospgrqh2rh1tgiughvh6wk5;1:8h29jabj0eiygixhj0khfqhfrikuhfvio;1:ginljynj0siqwh1;2:jh4wjg;1:hh6qjk;3:dir;1:agowk9;1:gjs;1:6ip7fpahegf6ik1jjdrkuwjm;2:tlhwh5;1:8ja;1:8k49imbinchaeh7fhbgiyhjariktl0wfj;1:8ij9ingj8;4:8ij9jrfgwwjt;1:9iyfiy;1:1jheizjhekjklikmheokopixqhdwgz;1:4jf8jf9hbah6hh2jmdoj6sgl;2:4j8;2:ahffjdlh7wkk;1:3hd6iq7jv9hgjhfmjtpiprgxtj6uhewhb;4:jiq;1:bik;1:niutit;2:glgjkzlhdrhgwhh;1:aimeis;2:hhaimnwhh;1:jh9wkp;1:3jn8h8aiuchgfgiggmhjxjggokyph7qgztiluktwj3;1:8il;1:ohfpjowjb;1:ckh;2:2h67j4oim;2:8hb9jmcipjhduldvh9;1:8ko9gfbjw;1:3it5lf8k2jhbkh6whb;2:2ge8j69j9alufgjkhdojcpj4rhdwh5;1:3he8k49mfaljbkjegrfgrgh7jgpkjuoippheqj2rgxuglwgd;1:wix;2:4kycjmgg1jg2ohfqqcwg6;2:8il;1:ahdrj2;2:8gw9kcakcbh0ciydl0egsfh4gheiikkituhf;1:cirfhe;2:fiq;1:8iskj8;1:uio;2:1j32ja5hg6he7hc8jl9ftchdfhbggljj5lhgnh2oinpjfqjasj9tj5uguwgp;1:8ivdhbejc;2:2j14he6szjgzph3qgewfw;1:4ir5lj6iyjgjmk9oheqilwhg;1:3h84jt7hf9gval2bl4ck2ehbfgzggyhgvkkzlhemijnhdql3sh7tgquh8wfz;2:4iw;1:1kq3iu;1:7jh;1:3ik8iwbhghiz;1:2h58h99kobimeisjhcojn;2:8gzgjzjlwpinqh5th4;2:7khwik;1:giswjs;1:3jx8h19j2ajigh4skgthbwhg;2:8hd9h8bilch5ej7hj4rjwvjo;3:3j98jf9hdbkscj5dkqegljijkh4qhhrfluha;1:1gx3jsaj7dhegharjb;4:vit;1:bhehka;1:jjelil;1:8hb9j1;1:7k89hhbk2dgmej1giljklqh6rhb;1:uh6vkh;1:5j4;2:ainciqkhgnkvwhd;2:piy;3:jj6;1:4iy;1:jh8rjw;2:3in;1:nikqik;1:vil;4:5lf7hdehg;1:uhfviz;3:uju;1:9iyaiybhgch7fjfrh2tiqwix;1:ciujjtnj1ohewj3;1:0ix3hg8j39hddj1eiyfj4gh1kgqlkloiq;5:7iqoj1phg;1:niquizwit;1:ajeqio;1:3im5gu7hd8ja9h4ahaciqhisjgukilnixojiph0qkorg6shdtgy;3:aim;2:jj7;1:eiz;1:2j0air;6:qjm;1:ainbk6cj7gggkhbrh3tiqwit;1:aissja;1:8ja9h8bjxcizgjzsj4wgr;4:fhfgj9;1:cj6jhe;2:hhblj9qiutjk;1:hilrip;1:wiq;2:agxgk4qk2rj3wh9;3:ogvpk0;2:cj7;1:ehgfim;1:0hf3j17kj8gv9hfahedmbegwgh5hikjjbniyph6;2:ck1khgqkb;1:ujp;1:0hg1h93hb4iz6mi7gx8iw9h7aindj4ehcggpihfjgkkiwljsmhhoh7qgvujyvhfwj5;1:0gz1jj2ha3h54g65gv6h47ha9gdagubgsdishh3jgxkk0llgmjhnmpoe3pjaqgxrg0sk1tj8uklvgrwj8;1:8h79jpjiywip;2:eivgiyjjfqhftip;3:1kc;2:2jb7jkhik;2:1il9gkbh9chagiwhirijerhgtkp;2:4ivohfsjr;1:2jc;1:9h0ajhfjqjjewh8;1:1gm4kf8h2fizjk8ogmph0qnjrhesh4wgt;1:gisniu;2:3jdeitwhd;1:nik;1:0kcchbrik;3:hh4rix;2:4iw8jzdjlfiqghdljlpikrgtuilwgu;1:8iz;2:akb;2:biocj9rhbsjowkm;1:biv;2:6jf7hedgyfjovl6wh4;2:pjpqhftiz;1:8h0kli;1:chcgisrh7sixwkz;1:8kd9dxaf6birdh4eilfhdgj9jh5kkqlisqh6rhetkfwla;1:ajagh8jhbkh3lkynjvogjplrtinuhgwh8;1:eis;2:3jddilfh7jkhwhf;2:8iu;2:giswjk;2:wjg;1:dixeha;1:3h97lzbgkjlhnhfrixwir;1:mim;2:ais;2:3n67ip8h29h6bkrdj6fhfhhaiikjgwqhcrjcwgr;3:ejhlilrj5;2:cjsrhg;2:0fpik7wim;2:7gagodjg5uh6vin;1:1jl3jzrhfwjx;1:miyrhg;4:eh6jml;1:bitfixhix;1:aj8wit;2:mj0;1:ahfbiqrje;1:rik;1:7hd9ggdjmejpghajjmqj9thgujvwhd;1:0h33iq4iy6ja7fo8ku9gibindkdejsggxhh9kgzlh9oivqikrgkth5vinwil;4:5jm;3:chfjiw;2:1ik;2:2ir3gf4gw7hb8ij9ghbgrcj4dgyekdffnggaiikkg1ninoj9ph6rjnuk6vjmwk1;1:gin;1:ghhmh6oldpk9siy;1:qkq;1:8itbksdhafiwjh8kj1nh6qjlwh4;1:0h71ls3k34hg7hh8js9haah0bhfcilehhfg8ggzhg9jiqkh4lhanh6oguph0rfusjjto1vh9wky;1:fj4uir;6:gilojr;1:6gmjldvjlwgo;1:1j7rgy;1:1k25ha6it7h88jwaggbh9cmndjpfefgipiiljiskg3mhenh0oghpgrqh5rj6shetgxuhavivwl4;2:qj5;1:jjdqhg;8:vis;1:uiv;2:8gs9h4bh3egkfhegkahhfjhfritum7vjqwjf;1:4ildhfjju;3:0kgwhb;1:2ja;1:1jv;1:5k56gk7h38k19jrbk8cfyefwfj2giohh4kirlh4nh7qh1rgysiwtj1uiqvirwgk;1:7im;4:1hbqnfwgy;1:fit;1:3ik;1:hirjkdoiyph7whc;1:0h81ge2hf3gr4gf6ga7jq8k1aisck2elqfhfgm4ih0jhcmh2oh2ph8rh5sk6tgmuj8viwwez;1:6jb;1:4keagkbj9nj0;1:bhgciorj2;1:miprhdwiv;1:ahfgiz;1:aj7fk6rgx;1:pixsir;3:jj5;1:8innjkoir;1:7ikwim;1:1gv7hb8hbbgtghgjhdklymkpollpk0wgo;1:7ililiwhf;3:8grghfkk7lleriswh1;1:git;3:1ix;1:vhcwj8;1:6jb9hfahgcj3dirgjrjguriqsj5wgm;2:firuik;2:wj3;1:fio;1:dh6eiu;1:bit;2:8h4chagl1hh8mjkqjwsiktjjuhbwh8;1:uiz;1:mj3;5:lim;1:jk6ojvph7;3:sj1;1:8jkwhd;1:jhdtiovj5;1:ojf;1:wil;1:hgwjj7;1:ikv;3:jgwwl0;2:mim;1:oj8;1:fkf;1:dgxegwfmh;2:dim;1:fmlwh4;1:8gm9j6skp;2:5k77heahhfiyghfhj2mjeoh7ph0qgurjqwio;1:wj7;1:7mibkthjhjhcphfqh3wgt;1:gjyqjvwgx;3:6mtwgx;1:0he2hf3j14gy5gt6jq7ju8ki9gfbirdgjelrffzggnhfnih3jiwkh2lhfmgznhgogkqjdriqtnhuizvh7wf8;2:1go5gx8ik9grbfkel7fitgmhhirjiwkh4nhfohbpgzqh3rkisjouhavhc;1:4j0tln;1:flnwhe;2:bka;1:8hfjksqhgthh;1:ojd;1:rj9;3:6hhvin;3:9forl9;2:pizvip;1:eik;2:0kv1ix2kh3j54h75jy6gz7f9ah8bh8eh4fgkgizihdjjpkhglh6mh3ogqpjesgytgyuj9vj3wgp;2:1hfagwckafl5ghbwha;1:4im;1:1he3hc4hd6k47gw8gq9jabgkchgdkyegkgiohhejjdkheph8qlbrkhth7ugtwgt;2:9k8ehghh9jjhqiqwhb;1:fmogds;1:qir;1:ck5hinjh0kh9njopmyshawh1;1:jiswj7;1:8j79hbbhfchdekmffzgo5rgwuh9wik;1:rjl;2:qje;3:eir;1:7ijjhhqinwj7;2:5k16jhhhfvgswjc;3:8l09gzag6cmldirfgrggghfykknlkknhfphgrhgsh5th7uj3;1:cin;2:1hf8h7gp4jheqk1rgnwh1;1:ch5riz;1:7knjgmwip;1:4lw8kv9grdgcejujh1oirphd;2:8h89iyeinpk0whe;2:2h23jf6hfghfhjiil5pllqhgth6wh5;1:1hf8ju9jqaimbjndiseh7fj7gimjhgkiqnhargcthavjdwgu;4:3hgiim;1:ukl;1:ah4fiojjkpjgsgb;1:9j5fkb;2:jheplk;1:1jkwh7;1:aipwjb;3:0hc1lx4hg7heahfbgociygh8hhcjj3kl1niwoiyqh2rgtth8uixwh0;4:hj9sjouh7;1:qin;1:kj1;1:dlxeg7;1:jjhlij;1:8hg9gnah3bj7cgneipfkthinjhbkjrmhfthduh8wmr;1:7lpdiqjhctinwgp;1:ek7hgi;2:0jz3h84hf5im7hg8k49gnbgejg2kj5ljhmj5nhfoj6pgzqgosjvtjquhdwha;1:8h09jb;1:qiyriw;1:ij5;1:6j68gwehdkm1nhd;1:0il1ir3gt4gf5hg6hb7h58gpah4bitck4ehgflsggtjhdkgglp2nfmoh5plrqg9rg6tgwuiswjg;1:8k09jqbhgchaegbhj3kk2th9wk1;1:1hdkiy;1:1hdbhcclb;1:biycgxfjm;2:gjkjhe;1:cisfj5;2:ila;1:dh2ejb;1:cjjuiy;2:6imhjf;2:9jc;1:bgpcjgdhheinfjqpmrqhgrhewgk;2:0ob1he2gt3ge5h76gl7g7ajjbh2cktehdfh2gilikbjevkjblgymhangtokhpgyqm7rgusgstgmugcvh5wjz;2:hgorji;1:4hgsiouis;3:ajeegyfkchilrjjuktwhe;1:8hdairbl8dh5eiwfh4gjohjeojo;1:sjd;1:8kv9p5akqdh4eh7fh1khcrh1wgu;4:0j01jg3h44hg7l38jb9jpbh2dgtejsfhgghahgckiklhemh8njkoh1qk8rgotgzuh2whf;1:him;1:5kajhdqk4wh6;1:2j8;1:9il;2:9irrit;2:rj2;1:gio;1:1il8jd9iwbgxdh8jgqll1tjwwhd;1:0ivgikkja;1:9lggj7ih8;1:1h92kd3jr5ka6he7j28gy9heaj2egifl4ggxhipjgtkh7lh1mh8nhbogxph2qharjssgntgyuktvh2;1:6iqajbfheoiqqix;1:1iy;5:rk2wh5;1:8itaiw;2:fipqj9;1:9hhgilhiowis;1:9iu;1:0ji9guekz;3:2h37ltwh3;3:5kvcgvghghisrju;1:5hf7h9ajfbh5eh8gkjhh6khamjnphdqjqrjzwj0;2:0h13hb4mk5j76j37ir9gybk3ch3dh4fgzgjjhiqjgqkhfoiyph1qh5rh8theuha;4:3jatij;1:1ir3je4imkj2wgu;1:qjw;1:fhbujd;2:5ix;1:oke;1:8jmeitfipwhb;3:bjdfikkh1nkf;1:bj2;1:8h6fhhghdhlyjh6khhlk2rj4;1:finghdjlkrgvwiu;1:0iw8h0bhagl8;1:9jh;3:oip;1:bj9;1:tk2uh2;2:dizehb;2:8in;1:jkhphcqhg;2:biw;3:dhaeiu;2:0jv3gk8jbajlbj1rhd;1:7jp8jechh;1:8jf9grakkkh2qjkrjc;1:3j1;2:0iuiizpjk;1:gjgjhaukc;3:oj6tiowhg;1:4ki6h47hg8ja9itaghbh8cj0ek4jhfkhcpgxqh5rj2thdwkl;4:8it9hb;1:6kz8he9iwfhfphfrjgwhf;1:liq;1:7gbjk8;2:0h11gz2ld3gr4mi5ha6gj7io8jc9kfbgzdhfeg4fhdggihgjjh5kh0mhcohaqj8rfjtinujrvj8wk6;1:cjlrhe;1:1hfah5fl6ggrjhfmjhnncrimwg5;2:8gz9gndlreg8hgzjjvkiorimvil;1:hh3qjt;1:bir;2:eja;1:lhgrjc;1:chchiokj6uizwhg;3:9isrj1;1:5kp7hc9jh;1:3jdjjh;1:8hanhctmkwhe;1:rj1;1:dj4ghcjjoqiq;1:4kg8j79hdakzbjpcineghfh8ghfjjmth7wgv;1:4iqoja;1:8it;1:bjorhg;1:ljf;2:pjs;3:9k8ah9;1:8jb9iplixwhf;2:0g11ji2hg3h94m35he7hg8kq9fxblacgedehekxfh6gh7hhgjh2kh8llqmh9nh4pgfqk7rjrtgwuj9vhewfm;1:nil;3:mkd;1:4je6hh8iz9jeahbbgacoaehefg0gh0hhfjhdlhgpjbqhdtj6;1:bir;1:hh7jiqwjx;3:nio;2:niz;1:0lv2he3imjgfwil;1:bh5wkb;3:8me9h4ah9wkb;1:1j06kfwgq;1:tkqwh6;1:ck1fhbjjerizwga;2:hjawjk;1:aggfk3gj1;1:5j4jj6;1:0ip1gwkhglmerglwjy;1:9hgrjp;1:3im8jmdjkeh5rij;1:6hd7itbiuhivph9ql2wh0;1:iizjji;1:5j58ja9gsjgjwku;1:3isjhfvji;2:0j9;2:8jg;1:pm7wgf;3:0ha3ha4h16h48j7cjtdhaeh3fgqgiphk7ij1jkblhgmhdnk0ojypjdqgprhfsheth2ugrvhgwh0;1:ggzpjp;1:qjv;1:bj3;1:siz;2:0h76ij8h9aj0ch0fiykhgpj1qgotilwj2;1:wiu;1:qj3;1:8he9im;1:siz;3:0hf4jailgwg5;2:0j11l23me4jo5h76hc7h89g7ah7chedhcegwgiwhiqikhlhcmhbogmpgtqhbrgmsitth5ugvvhhwjl;2:7k08iyciqghgijujk7ph0qj7rj0wgf;1:dlbuh9;1:0ir;1:2jb;3:7hebkuchafhfgk4jj8lh4qjqriuwhe;2:8hfuk5;1:1hg8gh9mlahdbh8kl2lgyoijrhawha;2:5j1jgwrjasj0wjk;1:3iwciuwjg;1:9iwrjzwgt;1:5ir;3:6le7hg8ju9h6bjtch0dl7ejwffkgjgkhcqh6thdvjtwfc;1:2l9sinuhcviw;1:qjp;1:hgxjj6kiuuir;1:ogtplaqirwh4;2:8jn9gvjiu;1:jjh;2:0jbahefix;2:3o48jy9jbeh8qhbtgxwh0;3:3je8ipuj8;1:8j59ha;1:lir;1:2h67j5;2:6ja;2:agiljqrka;1:rja;1:0it1im5in6ha9gxchcfhaghgjhdkhaokzph4qhbrgjsiztlzuiowfo;3:cj4jinwhd;4:3iojhcwk6;3:kiw;2:vil;2:8ix9itdhhejapkkrgbwhb;1:1mzggqjh6rh8;1:8im9goeje;1:6jm;1:8iyaiygipsjauj7;4:1jr4jk6hh8kx9geak6bh7chdfgkgj4ijijhckg9oh9pgtqhawlk;1:8ip9hc;1:2jd5illisrhgvgowjx;3:qj2;1:ah0hm5phh;2:dimpiowit;4:diufkdhj8jh9;5:8jb;1:aj3fhdqkpsgr;2:2fm7kdwj6;1:iim;1:jiztiz;1:tis;1:fh0hj2jl3klhrg0;1:2j0;1:eiu;2:eil;1:dh6eiljipujxwio;1:8h89ikjjlriowhg;1:pj6;1:5ir9iv;1:ija;1:3hb4kt6hg8gd9hdah6ch3ejofilggvih5jhelhcqjttiqulmvjywh1;1:ljpvj1;1:1it4k18gpfinkkrrgwwhf;1:jim;2:1hc3hc5j58h1akncgqfgygj0hk2jikkfplhgnjmpj0qh0rjftivwiv;1:5j5;1:sj6;1:6hfplq;5:1gz4h37h38j4aj7bh2cjbdj5ehgfghhjhihbjgqkghljvqgvrkevil;1:jiz;5:ain;1:5h0wjw;1:eiy;1:ujc;3:dilsir;2:viq;1:jhhqinrin;1:0hgaithhdjh3kh9pk5qll;2:gkujgiqhgwk2;2:8iu9jgbh4cggdhaejjfhbhiujj8lj8rhdvivwh7;3:jh6wjo;1:8hhjiylh1rjwwh8;2:jiyrjkwhg;4:3jbrl9wh3;1:2it5heck0ghgkkdmjyoj4ph1rgg;1:aj7ggy;1:wik;2:cjudkref6rhfwk4;1:0h71kd2kb4jcrglwhc;1:8hdgk4vip;1:5j46k8lkpphfqhguhcwh7;3:cjirhatka;1:dhceiqmj7rkgwgt;1:qim;1:biujjiwhg;1:hiqwip;1:gik;1:5is;2:ljn;1:8krbgtwjd;1:1iv;1:8hbditehbjkkph7qh2wkf;5:bisvis;4:0hg3hg6h67khbhfdh8fhdhhfjkekgynhaolmqjjuh4;1:ij5;2:hik;1:1j0rhg;2:tim;1:2ir8hd9hebkleingk5;2:jj1;1:sjo;2:4hf5hg6gs8g49jebhfdhaeh1gh0jg3khboh3pk2qiprfxsitthdundvlfwkv;1:1jwhinkj7;1:9iq;1:dj3wiy;1:9imhiw;1:3j3cjyrgt;1:8hg9jmaj9wjd;2:8f19lzdjrjjvwhc;1:8ijdik;1:cix;3:gh3rm4wh8;1:ejm;1:hikij2;1:8hfrk3;4:dj2;3:8in9hcqj5uix;1:9inahfbjilggmmvnhdphdqjarh6;1:1imdjp;2:6hg8hhahbbh6ck6fggghchn1jkqmiqphhqh9rjjuj5vhhwgg;3:bit;1:gj8jjeqik;1:mjv;1:dh2fk5;2:ej1;1:eim;3:8h99jw;4:1gxwmx;3:uix;2:3js8js9kcagycj7eh8jhhkhbpj2rikwh7;4:rj3;1:2fu7p6ohaph9shgtkbuivwhb;1:gjbwj6;1:bilrjf;1:lj7;1:1kdchhgh9kj8lklrgnwiw;1:fhggjcogjpjq;1:fhdhlb;1:2h1hhaujmvjwwj8;1:gj1kh8llznharjkwgn;1:7j6bh2ciy;2:3knch9qkpwh3;2:8kx9j0aggbgycm2eh5fhbghdkhfqharisshftixujavjjwgs;1:dfjekmfh7kkr;1:hirmhesh5tjs;1:riu;2:2l16hh7mv9hfqhgviuwgv;1:3hb8j19gqehhgh9khemktnhdoh8pm8wjz;1:rj1;3:8hdgirukf;1:tip;1:8hg9jbjjxwhe;1:5io6g7qjjvgzwkt;2:8js;1:gikwk5;2:1k68gz9j8cglhl9pj1wh6;1:3hf5np7k59hcdj1egrjh2piqqh7wh8;1:8ggbgvdheginjj1rj0ulkwiv;1:kk0;2:5g17ka;1:9ikpitvin;2:1jjwhf;1:0hg1hb4h86gv7lk8ix9hbbhgij6jilpikqh9tjnuj9vik;2:0h21ku2jc3gp4gy5h86iw7g78h99gvajybhgdh9ggthjbihejj6kjklh0ngyoinpiorgcsiltk6vjpwfx;2:bil;1:3hd5hg6s6dhaeh4jgdqharh8uh4vivwjx;1:jj0;2:djdehbkgwnmsqhdrh1tj0;1:rk9ujs;1:9jl;2:ij3liutip;3:4inagubkijj1sj5wip;3:aj3fhgmh9ojvplw;2:8l1vj0;3:aipjitrimsjguhg;1:jikohbpjyrj6sik;1:1ivbis;1:0h03hc9jldkgejkfj5ihhkiymhanhfph5qhdrgvshguj6vilwh4;1:6k78gz9g2ahgcjcdmseghwgl;1:1keah6rknwhg;1:wjo;3:1im4he7h98gy9hccheehcfikgjrhiwiislgyqiktjouhgwkg;1:6jf7ik8irjgyvl7wh2;1:8j3glfjh1pj0rhcwhg;1:8it9hh;1:piv;1:8j9bha;1:7j2;1:9gqbh6kh5ll4ooqph3whe;1:0gz3ha7hcahgbl8cjhejggk7hhgijykh2nh9oheph3rh4siyth6ujd;1:3gv4hf6ja7hc9irbgzghdhj2jknphhqgvrhdsk0tgouhewlj;2:7j0nl1wgy;1:ahekjo;1:0hf1gh3ku7hh9llafgbh5clxdh1eiofimgixhjmjh7khflh6mh8ph2qh0rjytj7uh3;1:0oafhfgirpgv;2:8it9is;2:rkh;1:6hf8h89geahfciveh5rjcuh1vkgwks;1:8im;1:bh7jiwrjewir;1:pmlwgi;1:1ik4h96he8ip9goch3eglfheghbhjyjh9khblhfnilojdph8qmfsixuj5vhfwg5;1:9iqaip;1:3hg4hc7h39k3ahgbjfdhafh9giyhgtjm4piwqgtrgltmswg7;1:3j77j2fh3jlikkelh0phhqhdrh1wgw;1:3hgbhghh4jl1rluwgn;1:4isuheviw;1:5lpjlzpheqhcthfwh0;3:3ha7kb8iv9giahech3egxginjnbmirohcqgjrkt;2:8itkjduiv;3:oj0qkn;1:4p3ch6jheok3wh8;2:8hccj2dhbfk7ggrqirrh3shewll;1:8iv9hg;1:eip;1:9it;1:uir;1:3he7hd8ix9h8aj5bh1cjhdivfhggjujiwqh2rg7sheuivwl5;1:aiughbhl1jitqhgtjl;1:birfil;1:tio;2:mj3;1:1gx5imilu;1:wil;1:3js7jm8gxbgzshgtnxwhc;1:rip;2:8kp9h3;2:divfk0jhhlh9rl5timwgy;1:girliq;1:1in;1:fimuje;4:8in;2:jj0pjkwh9;3:bin;3:ej4jio;4:3h14jf6gl8h4jhanjrpiyqinrjesh6vmvwhb;2:1hf3h94hc6h87h88ik9gcbmnckbegvfj1gh4hgmjgvkjjlloogqpk1qgsrjpshfthcuhdwh6;1:ahhjilkj9;1:wiu;2:6heqh9wlr;2:ol7;1:3j17jcak1bgycj2gh6hiwjh6khdqjowgy;2:8gyjjxpjb;1:6h37hf8ld9jbahgbh8dhcemigg7hipjh7mh9pkvqhergetjzuh1whf;1:1k6aivdgrej8oio;1:8jg9j1jgj;3:7mh9ijgiswgn;1:ij4;2:gjh;1:ehggjlplzuhdwhc;2:ej3rh3;1:bjlfjmrh0;1:7ildhbejtoiyphfwiu;2:dkc;2:gj9;1:6hc8iudiueh4fh8gizhh6jilpkvqh2rgqsixuk3vji;2:hgzjjq;1:ain;2:8hcah7bl4cjhsh9;1:1j27k48k89gtaimthd;2:hionjv;1:ag6bh0ejuflhgj2lh7qj2wj7;1:4in;1:qiy;1:fjh;1:hiowiq;2:djhqix;1:1j08jh9gsailbjdchfeh0fhhgjghjekhaol7qh9rj9wgi;1:jh6pj2uivwk0;1:4il;1:jit;3:0ik4h7ah8ghfogjqkgriouhdwj4;1:bj6;1:cipgij;1:4j0;1:8itahcfiojjy;1:cj3;1:jiv;1:dgpejb;1:9ip;1:0hf4gu7hebkmdhafiughchhgikzjhgkixnh5pjlqjdwgz;1:9jvajnbg9ehbfj8ghakislhcnjbuh9wjy;2:0jgjjj;1:fk2;1:vio;2:0j58gyklp;3:8h0bjwjhckhfwkn;1:0kj1im3jt6he7h7agwgh1iixjh2kh8ljbmhgnj3rgywgb;1:eip;1:fhcghdjgulj3oh9qj3rhatlmvilwlh;1:9k9bhcjhcliqqixrgz;4:dik;1:8iqsjo;2:8gq9irah5umn;4:7ja;1:5kxhggrk1;1:wjp;4:fje;1:8l79gpehdwj0;1:3hf7kzqhfwiv;3:iikpiv;1:8iqfk4gj7wh8;1:tik;3:kh2plvqirwhd;1:2hfvjg;1:ej1jniwfs;1:nimqj1;1:3js;4:hhfjj6;2:qjm;1:0j31iugiljjsrh5wiy;2:jhbohfqk6;2:cjz;2:hl4jhg;2:4hgij3kj3;1:8k9;2:rj0;1:0he4koghgwk2;2:6k77hdcguuh7vlgwhg;1:1hg8fr9j1amqbhbcguegygguhlwkjmrh3uhgwiv;1:his;2:jheqk0;1:8j8;1:9kfahbhinojjsgn;1:gnqjhf;2:1ixtiy;1:oji;5:dizeh5;2:1iu8gokkxrhc;1:9ixgggsjjtj6;1:0h92hh3hc4hd6ha7h58im9gaajjbk0cjnfikgjnhjljg7kinnjiogzpgxqgyvh1;1:0k76h38hdgk4hipwhb;1:0h21h33gz6k98gv9h8aoabg1dgnehcgj1hjvihejlbkh2lgwmh4nh0ogopgkqgsrjyskcuj6virwer;1:giv;3:ajkdkxegufgjkirphfwkj;1:sin;1:ajl;1:7ks8hgdloehffiqjgy;1:3hcdj8fiogh2kj2nipoikphcqh8uiswha;1:ejkuh6;2:0hf1h35hg6k07ll8jrbixdgzeirfh6gilhizkhalh9mimnhcph0qgn;3:wj3;1:8h9dk8ejfij0wh5;1:ik1;1:bil;3:6hfpltqh1wh3;1:5g5wlx;1:qit;3:giy;1:4j7gj9jh8qhgrk2;1:jik;1:uiu;1:0iz1p87gegfcjjokh8rh6wgh;1:uis;2:1iu8jnoim;1:cjlrhd;1:1kobhgrlp;1:sin;2:cj5;1:4kkuhd;2:3hb5gv6hc7h09hdakmbjmch3eh4fjyihejh5kglmhfnheph8qiprjvtmhujhwg9;1:2l48jkjikoirph5qhdwhe;2:8h5fhcghctp9whd;1:4imbhakjovj7;1:riz;4:8j7ghcjjy;1:niv;2:qjw;1:6ha7myfhfgg8hh4jhdqlzvhewgw;1:ej6;1:0hf3hh4iu8ik9hbao3bjscglffkghdik9kh3mizoh9phdqikrk1th3wgy;1:bk7cjadjueh7fhfggwjg8ojvqkxrgrth8wha;1:3jm5j8piuwh8;1:1ga2jb3hg8hdagxbjkfhaghbkh6mg1opqqh9wl3;2:efyfkd;2:fhfhjwrfhthbumx;1:wjo;1:1im;2:wil;2:qkn;1:1gp2gv3gj4ok5h46gc7jbajfcgddgyffkgk3hgligwjgrlh9mh3ngyojdpg8qg3rj3sjmtkrulxvitwg0;4:djb;2:ejksk1;2:2j5;1:2ky8jp9h0ehcfgvggnhltjjamhaohaphcqgurf9tjxuisvjnwh2;1:9hbdj9jip;1:6m39isahdfjqgh7hjciijjk2ogspjlqgirhasj2wet;2:8l0dhcejd;3:4iw;1:tjk;1:8h59k4jjtqjfrhd;2:aji;1:7hg8irgiwjgzoh2qriwfl;2:5md7h9aivjhepikqh4;1:0hf1h42hf4gx5hg6h77hb8lo9mjaj3bh0ckdegzfgaggfhiqmk2nj5oh2pgjrkpuffwg4;1:wiy;1:jjd;2:4iuajgbfskntmhhwh9;2:1gy8h2al9bgwch4fgfgk1il9jh0rjatkcwh0;1:eiu;1:civwiq;1:kjd;1:ujk;2:8hhbji;5:1hb2jz3h44mp6hf7h58jf9gzagzbk6cgvdhafgohgwikrjgokgnlhbnhfofupioqj1rh5ujo;1:kjc;1:uiu;2:6ksmjl;2:3jz8iujh0wke;1:cit;2:8hgbjccgthjiiikjh1rkd;2:3hgmjk;1:4il;1:sjo;1:1ik2jo3ja8is9gubgmdhggh1jilkjsliyuhawff;2:8imbl8khgrkmwhc;2:2gvoll;1:8gu9j7;1:gjn;1:9iz;1:oiw;1:6jx;1:qikrj5;2:4hd5lr9mkagcfh4hhgjgokgvmp4oh9phfsh4uh7wfe;1:9iq;1:bil;1:oir;1:jiq;1:7jkjh9;3:gistlkwhe;1:0jj;1:piv;1:3k1;1:rim;2:2gz7j3jgzwjq;1:1ip4fj6hcehefj2himjjiqhfrgwuhdwof;3:0mk6jaah7fhbgmcsilwgu;1:9h6airbhggj7kg1nodwgz;1:citwle;1:4iptil;1:jg9qjswjn;1:8jd9kmak1bh8cg1dhheghfj7hhhjgjkh8mitql1rhcthduin;1:8ip;1:wj8;2:2j13he8hbbhfcj2dgmel6fiojh5kiumm3ng3rhethb;1:jlaoh9;1:ujk;2:8muegzwiv;1:8jk9iudhaeixfghqjjrjiwhe;1:8h19jsahfdh6eitmk0tgzuk9vjzwh6;1:ck4hh2jismjjnhgrg7wkn;2:tj2whe;2:dji;1:cherit;1:binpix;2:fjnuj1;1:djhegnpk9;1:6ke8hb9hbaj3birfk1ghdhjmshcwh3;1:jiwwhc;2:ehahj1;1:kh9lm2rhewix;1:cin;4:1hh3j64il7hg8ijbj2ch4jjnkktlh4mgnnk5phcqhfrjuugw;2:9haaj0wir;2:9itmio;1:2iz;1:jjewhg;1:9iz;1:8hghkojk5qiwrf6sjkwhe;1:aj3fh0jik;2:jjq;1:0io7h2jjo;1:8h5kj4;2:3hb4iq7gr9hbbgwciyhjgjixljgnhfojtpitqh7ujiwh6;1:3h75kz6hd7hd9j3alhbgudgweilfgwggvhgzkgtmm6oh5ph1qh9rf3skuugdwk0;1:cis;1:5ik8kadh5eirrjttkyugtwgt;1:uiw;2:kh8lj6;2:8izdhh;2:aiogiojj3rj3wj0;3:wix;1:7j3hiz;1:1jo3hd7kekh4rh2wjf;2:1hf8jg9k4aiqbjech7fj4ghfjkalhenhbohbphergmujawik;1:9im;2:agxfgogn2hjxjfrrfysjxwjw;1:diu;1:5it6h69hhjipsizuk7vj7wgz;1:8j7;2:jhbwlg;1:0g31hc4mb8h99gfaj4bkdcgpdf4ejxfhdghfih0jg3oiwqkgrl2sguthgulnwgl;4:pj9;1:8itnjg;3:ahgck1fgnhlujj6rk7uhgwgx;1:3jfchgtju;1:1ku8gs9gvhikrjv;1:jhcnimqjdwhg;1:8j4;3:5iwairqk5wh8;2:0iv6iw8iseinjh9vhd;1:8k7ok7rgruimwj4;4:bj0iikohg;1:0k9;2:0k01it2nf3in4j45hd7jf9hdah5bhfchfdhfehffhbgh2hhbih3jktkhglhemh8nhcoh6pfsqlergothcuhavhbwik;1:wiq;1:wjj;2:rj7;1:8jkfjm;1:1iu;1:9ij;1:9j0;3:8io;2:jjpwh6;1:dj3eh5hij;3:fin;1:1jkghfjiu;2:wj7;1:5jwcmfjhgrgish7;2:2iu;1:9ip;1:1gq8j5bizgjykj1rh5wik;1:1h73h9ahejjakh3ml7nkhojgqh9wjy;3:hivoiq;1:5j9;1:hix;2:8jmagofjlkiymh6;1:aiy;1:ahdch9el6fjwgixwh2;1:8hbgk7;2:hit;2:3k1;3:1gt2im6h67gv9jubkmcj8egdfg4hg6jlckjwlh5nh8oijpglqinrgusj5vhcwgc;2:rio;1:8jhhgmjl0tiowir;1:1j2;6:aipmjr;1:nkl;2:0itagefk5;1:bipwjk;2:gj9;1:2jicio;2:1ga8hdaiwgpbhh9jjfqiwrgewgv;2:4h4ajjfglrkk;4:jik;1:8kh9ha;1:0ip1gu2hb3hf4gz5hc6hc7gyehdfhfgjrhh5ijkjh5kinliumgynikqjarkqsh5uh3vhdwkj;1:aj8rk9;1:9j3;1:5l87ip8g19lbbhfciudiwfheghcjh9rh3wh8;1:8hbdlg;1:0gw1l12hd3j44gk5h06kq8fu9gqchedgxegfflpgewhq8ih0jg2kj3lh0mglngnohcpldqiurhgsgttgkugpvhbwkz;1:aio;1:8h49itbjpgh9hjdjhasjhuj6whb;1:tjouh8;1:5iyagyfgtgkn;1:0is;1:2kh5jahimjgzqiv;1:ciy;1:8hc9j5;1:nezpmu;1:wjm;1:3ix;3:8jnbh9cj4hgojj0mh4oh6plvwh7;1:biz;1:4hg5gv7h28hg9ktahabh8cghdkzfgzgiohhejldkh7ljpnitofspmxqgorhcthduhcvhcwj1;1:5io8j1ahgbhcdjbrjv;2:egfjmgwjg;2:0io1h52ha3oi4h35gb6in8k79gddgzeinfgcihekgonhdogxpgqqiqrg3tjkuitvk7wg7;1:1iv8gqkktrhf;1:aiv;1:2ixiix;5:dhcek2qjr;1:jjx;1:8jb9iybgheh8giukiylijrjhwiy;2:4jyhjplikmh9ogxuik;1:0iy2h93gd5h26h77gp8ji9ixak4bhaekaffphggjk1mgzngrogrpivqh4sk0tl5ughvh8;1:jjv;1:ajqbh9fjopn0wgw;3:8heelihh3rip;1:8hc9jj;3:jilthgwl0;2:bgzkl3;3:1j9fioqiwwha;1:9ip;1:7itggtqkl;3:3hgil4wh7;1:8j3ehb;1:7k38hgjinrgywk7;1:8hebhgcl1fh3ghhhjmiiwjh9qiutmiuh8wfk;2:1hbrjg;2:7hf8ipbkbcjveikgjuhgpjh3rh4tjywgy;1:8ipngapk4;1:9ir;1:kj3;1:wj0;1:8h69k6;3:4iwahgbjkkhg;1:afychfkn7wj0;4:0h91jy3h94gy6gr7hb8gv9heakdciyfj7gh2hjljk8kjllh3mh4nh0ojdpj4qgkrgrsh6ujjvjvwes;2:uh6vkf;3:jkclj8;2:aj1;1:uhgvja;1:8kx9gsakfdgmehdfg9kk5;1:hgxjj7;1:3hc4hf8gt9kjagcbgnckdeh3ggpiiqjgtkh5lkwnh9pl9qgwrg3th6uktvmawgp;3:0hd1hc2he3hd4h85hg6hg7gz8klag5bjyck7djhek3flfgjnhimjh8kgllh5mh7nhepilqgushdtgvvhgwh9;1:0hgaipghailgwg6;1:eip;1:6j78hfohhrl3;5:gj0piu;1:ajw;1:0fv1in3g84h75it7kg9knbjccgydjwejmgfwik3jjdkgolgkmh3pgqqiprixtj7ugjwft;1:jin;1:5ip8m49gjakhbj3cl2el8gf4hiujhckhfohdqitrh7sh5thbugcwgx;1:0fe3nc4gv7ha9h0bhdehfgh0irljgnmhholsphgqh2siruh4wg2;1:wki;1:1j68ha9k2dh1fikgg3hhfkhangipjwrj8wko;5:1hg6hb7md9impl0qhawgf;1:wj4;1:giomj9rgxwkj;3:gil;1:6jg7hfvl8wh7;1:0hf1iq2hd3h74hd5jq6hf8jl9isag7bkzcggdh3eh5fgrgivjlukj9mhbnjiogmshcuh2;3:2gf3l0;2:ahafj6;1:gixij4rix;1:gjv;3:jhbwj1;1:3h5wjy;1:fk3;2:0h51h63h94ik6gm7h98gxbgjdgvegtglnhiwihejf7mh4ngzpglqjzrh6stmtgqugxvir;1:gimjke;1:8h5jj6sj7wiz;3:8hdcjr;1:0jn8izkjc;1:miz;1:biv;1:vja;1:wjo;1:niy;1:qh8wkq;1:8h79itbim;4:cik;3:hhctj0;1:jh7qke;2:djlehfjj9;1:dgsuj9vk5;1:5jtjilpjywh1;1:1k57hf8kfbhdfhfgj9jgtkggmhcnj4rjqwix;1:rj4;1:0j85ixliuqiqwhf;1:0h93inmiknipwju;4:4hdom3;2:dgrejk;1:ghewkc;1:ah3uk1;1:1jx4ir6hg8hgfhggh7hh9jgwkl3ljmmgtnisol0qgxth8uiywg4;1:jit;2:eivujj;1:bircmgrfzwgu;2:8h59hcbk8ciuejtfiovjewh4;1:gkosh5;2:sik;2:wj6;1:wj5;2:7j7wk0;1:0h51hg4jo6hc7hb8f69h0bh4chfdgufgiggzihejggkldml9nlpomepk6qgsrfetgkuj6vkdwgg;2:2fi3he6noegxfjsgiuqheuhbviwwh5;2:jhdwis;1:6iq;1:4fg8jswn5;2:4j1;1:wjh;1:0he8h7bjedgnepofiyrgvwh3;5:8il;2:8gs9jjch7emxgh5hj7qj3rhath7wgu;1:2l9rj8wgn;3:4hfhhhulk;2:aj5bhdfishiosgtuk0;1:9hgbhfjl3oh9rjkwhf;1:dke;1:aj8phaqj2wkv;1:bgwrk5;1:9jjfg8sinujq;1:pir;1:8h1ah5kmvlgp;1:wj3;2:hk8rfx;1:3jtgitiizwh7;1:qj3rk6whe;1:3k8dl5efs;1:qj4;1:hjxjk3rh4;1:3n79iqagpeh9fk1jjcqknthcuhewev;3:ek4riu;1:eiu;1:4j9gj8lgorjz;1:5ml6h6wgw;1:1ga2j83gx4ir6ha7gr8h39heajfdh7ehbfhagjbhh3ihgjkekgengvoncpiyqk2rh1sj0ugwvhc;1:0ivrixwjg;1:kjc;1:uix;1:3hhij7;5:8inbikch1ghfhhcjjokj3ojgqhgrjpskfuh5wgm;1:7kx8gh9jhbirdk1egsgj2hhbnj4rh6sinthf;4:kik;1:gh9jijrl1;1:7ijjiq;2:4jq8g49k7aj4ljewhg;1:cin;1:0io8hgbh5dixfhdgj0ihhjiwkglnmbojhqh0tjduh6wh7;1:jk8sgz;4:jitrir;3:3l55h9;1:0infizhgxjj4;2:hjj;5:4j88iyeiyuh8;1:1hf3ha4hd5hb7hb9ggbmeckcegqfizgikhgnkjkllrogsph2qgurk0thcuhdwhe;1:kkr;2:2iu8h4agbcirdgzfkxggyoherlg;1:ril;1:7kzqhg;6:mim;1:8h19jrambffyskawh6;1:kis;1:2fh3he5ja6kh8lrjfykh0nhgok2qkqrheth4vk5wh1;1:bj7ril;3:9h0ajifjqjjerhewha;1:pldrijtkf;1:0jj1h23gj4iz5l76gm8k29elbjsdgnfh8ggehgtih0jn5kh8lhdmh5nh2oj4pgcqjfrjxtgjugzvhewki;1:rj6;1:rj6;2:ghglj1;2:ghdjiskh6rkusk5wh5;1:8hccjxjitwhe;1:hip;3:fitwkh;1:9j9aikcikrhatkbwgz;1:4j3hkwrhc;1:0m01lzbgxck6fheggwkh5rh1wgw;1:4j2;2:mj5;2:8jp9gd;1:agsbj0jkxwkd;1:8hfbhfcjkjhfrkn;2:0krlkwogwrl9wgc;1:ditqiw;1:1h83h56hf9izaq0ch5eh2fg9ggojj3kh2mh6nhbph9qh7smsth7ujuwgl;3:riz;1:3io;5:6h8djikklplgwh4;1:jis;1:aj4bjmkhgrhe;1:5izrj4;4:8io;1:wiw;1:7h98k79k5ahabiweh4gh4jhbklglhfnhfpjeqhdrfhth6wlj;2:3k47ip8j09gzah5bh9eh2fjkgiyhj4jgvmhgqharkmthgvhgwjf;1:2hc4is5iq6im9koah6chefguggfhgaigajhfkgflj2mjnnhfojdpgatleuk1wfo;1:1gebjoclsggxrkb;1:oio;1:4j4;1:fk3lhamj5ohhrjruiowgz;2:1hf3jv8jc9hbjh2pjlqkasjpwhd;1:ajt;3:gjk;1:0k72hc3ge4g77gv8gyaiobj1ghehikij3jiqkgumjdojsph0qh7sjttgful2vhgwgh;1:mk5;2:qj9;1:fiy;5:8lc9hgliurh4;2:6ha9kcah3bh5cjpfj1jjhrh5simuivviowgl;2:9j3;5:cjn;2:8iufj2qkxwh9;1:ejm;3:1io9h7bhgkjqlk3oj6rgr;1:eiykj5;3:jh3wjo;2:0h23js4gr5je6h97ji9fxagpbgvch8fgjggxhj6ih8jg6kjzliumiynldqgjrjmsiztgvujkwgq;2:wim;2:9j5ahdch0jj7rjsuh9wjw;1:1gx7jzilvthc;1:3m9tiuwgd;2:8jgjh9win;1:aisehfgjz;2:0imgh4kk4lgbph7rggwn1;5:ikz;1:chafknqj4;1:fil;1:0ik;1:gj4siu;1:7f3jl1sjmuhbwkz;2:0n03gl4gthgpikwjhfqheriztk3wgw;4:uj9;1:mjk;2:1iy2in3h04h65ha6h67gi8ki9jwdjhej1ffkgjfiiojgwkjxpgpqhcriqshctiquhavh5;1:bhghjdriswix;1:9haalfcikegzfk4gh7hiljhfqj3wil;1:8iq;1:0k68ir9h9bjvjhgphgqjrwgy;3:oio;2:dim;1:7ij;1:qjh;2:6g1uktvio;3:bk2ek6hh4rgq;1:5izwl6;1:0h71g12k03he5iw6hd7gx9heagbbhacgkdjbeg4fgigmbhnpihbjmqkhalh9mgwngvogmpghqk9uiyvjmwfs;1:2ke3jb6jc8im9ivah1bh6egffjfgirhipjgxkhgmfwph1qgwrk5tk9uh9;1:pj7;4:fkdqk6wh5;2:7jiaj9divej7jgsvhbwj9;2:8h69jp;3:9iujit;1:iiq;1:6hb7hd8ikogyqmb;3:8j49h6nhgojqpk0wiq;3:wjg;1:uir;3:hhhij8riw;2:bj8;2:lim;1:oiw;1:cilgiuhkkjharh7;1:5ir;1:jjf;2:0lt1ix4g0ij7rhewjh;1:ejo;1:1iu8j69habgydj3fgqglmnj2rhbwh9;2:4j89jpagxeh6fhdgl7hhejituhewj2;7:3hb5js6l97j9fj3gk8nilqgerh7thbuhdvggwj9;1:7gbjk9;1:air;1:0kd7iq9gcahgbjadhbfgwkgylheoh9ph5qj0sl0tguugoviwwh6;2:3in;1:jj9;1:7j2hhdrinwki;1:4lc8il9gfch1ej0hj7jjxmikqh8silwgd;1:fitlivnjb;1:mipris;1:4iw;1:gj0;1:6k97lc8jq9gxah6ehgjgupheqh3rhfsk3tk9uiqvglwgs;1:dhbej6;5:0gp1iy2fm3m44gi6gj7m09h8ahdbjueghfg8hgailcjjmkgilhemgungwog8rfzsj0tjcuh6wm3;1:qkcwhe;2:5kk6iv7j39lobh7dj1eh8fh3gh5hj7jgoqhbrgpwj6;2:0l83j44il7hc8gb9h3ah7bp0djljgzkhaph4qitrgitikugywg1;4:jj5;2:iiy;3:ahagjs;1:0j5ckiujmwhe;1:3jz7hg8h2bjacixdgogiljizpivqh5rjlthgwiq;2:8ir9jybheegxfh9ghbih9jh4mkiqj9rjusj0wiq;1:8gy9jaej6;1:sjouh8;1:jkf;1:rir;1:5j88jdnizpjlqhftjmwgy;2:tks;2:8ildhafj6;2:7j4dhgiizjja;1:2ljnj9;3:aindgqejckisris;2:3k16jmcj8wgm;4:8irchfhixtir;1:bj7chf;4:9hebimeipkhaol8;3:ajqgipsiqviy;1:0hg3m67hd8j4ahddgjenlghakhcphgqh5rh8thduhc;1:4iw8ioehgghghgxjj8mh5qm8rg5tlywgb;1:8kb9gckh6njtphduj8;4:piw;1:dj1ehf;1:qj3wj8;2:3hg5j79h5akwchefh9gh4jmnog5pkxqjmrhfuh4wgh;1:cip;1:chcgisrin;1:jj4;2:rit;1:1j2;2:giw;1:3jlcjjnjkrghwhf;1:iiv;1:8jedh4ej4rij;1:dij;1:aj6dk5eh4ghbnil;1:ghcjkbkil;5:djmehgmjjrhhwhf;2:8la9gw;2:1k52j43h39h9aiqeilfhehhakilljxohepj9qh4rgrsh2tiwwgs;1:8iqdhaeikjj9pkiwgp;1:ijlsjw;2:uip;1:1iq6hgkj1vk4whg;2:nk6;3:3h17k18j3agxchhdizgk3jhakjkmimnimohfph1qhgth2wip;2:gjp;4:diqegnriy;1:2j03gn7iq8j19gzahhbhceh6fkqhizjh5qhcrkpwju;1:0h83hh4ju8gs9gqah7bh9dm9em9fllgh6jh3th5uiowh1;1:3h45m27k8ciwehgjk8qh9rhbwgg;1:ug3vkn;1:0h21im5h16ka7ga8jn9goaiobgwcjvdirfiqgizhkqjgdkgbmh2nh6ogmpgbqjdrk8shctgvuilvk9wfa;3:eil;1:0j28fq9j6cjwklgrj2wge;1:uiq;1:6hdglxphaqkf;1:hiz;1:8jm9ioahbej1uji;4:ditfij;2:1ixrhg;2:sil;3:7iydgruj8vk4;1:fh3gjt;2:bj2citjj8rhb;3:2kt;2:bk7chgfjlwhf;1:8j2;1:3ir6hbjk7phgqkkwir;1:hgejgimh6toi;4:7j7tk3;2:vj1;1:bk0dhahiljjb;4:dixehd;1:wj5;2:rio;1:ais;1:8l19jybherghtj7;1:pir;1:jiy;3:pjn;1:piu;1:mjqwh0;1:0ir1h32h83iq4l65hg6h67fd8h39h9aj8cg7eiqgh2ijpjiokgsljsmh5nhbogipg9qh2riksgsth0uiyvl2wki;6:0hb4ko6l0phdwh5;1:bipdheriw;1:wiy;3:6ki7l0bjcjh8nitohgpgsuk7wg0;3:jj4;1:ajaija;1:3k9;1:2jf;5:ajsdhdggujl9qh0rfxsocugcwiq;1:ojb;1:dk7fgxkjfoj1phethdvj7wjf;1:5ft7ki8ej9m7;2:1j33gn4hb5gx6h97hh8ir9k0ah0bhacgodgaegmgjqhgzkgflhemmboh0pgzrfsshgtjhup5vm9wfv;2:fj6;1:5ko6gjjiyqh9vljwh8;3:8iq;3:vjm;1:aglch7fjpjj9nk7qixrjn;2:3ix;1:1inah9gj1hh8jjcmiorhesjb;1:4jmoiqqhdwjc;1:iiq;1:2iw7jf9isaimcipjgjkhfnktwh4;1:ajb;1:eip;2:5k6pix;1:eiuiin;1:0hf1he3hd7gw8ioaitbjqcikeixgghhgxkh2mhfnh4phcqkprlhshfwk3;2:9hcaitcjgejbjhanh3pn5uh2;1:9jh;1:akcdgeek4hhgjjwrhh;1:7k69ivdkceghojfphaqh7uhbwjj;1:ditkj3;1:ainbhgcisjh4khenkrqitwjj;4:eik;1:8iq;1:agwbjgoiw;2:5jr6mw7gf9h4dgmjgmmjinjpph2qgorh4sheufuvo3wjn;1:ij2jjg;2:2is3jl4j0chghkurh9sh9;2:bk0chfqik;1:gkb;2:fhdgo0qk5;1:9iqsj6;2:ah1uk4;1:djtegj;2:3kl8jjahajk6nj9ohdph9sgzth6wjc;3:aiwfik;5:fik;1:siq;2:dkn;2:8gj9jzdhaej9fh5iikjhfvkb;4:8j0hio;4:gj7;1:4jx8h6khgonupgvwh9;2:sit;1:8jf9iqdh9eilfghqk3rjcwiz;1:giwnit;2:8h5jj7sj6wiy;1:8iscgpdhfeikjkspjawhd;2:1ha2h94ocahboizphgwh5;1:0h31gl2ja3gq4hb5hb6h18h59k2airbjmckudiuegmfj4hixjgmkgoliqmgxoh8qgnriwtj2ugvwks;1:dj2ehdlkfqj8;1:agqbl1ch8fh0gkilh1rk3;1:4j9aiy;2:tiv;1:8jefhcljfpjf;1:hj9jiqsjy;1:sjl;1:siu;2:wjn;1:gij;6:jiw;2:jk7pj7;1:4iz8gs9jr;2:einrje;2:0hf4h87hd9hhajbcindiyeh4ggxhiyjhgkk4mjsnhcph6qhhrkxth2;1:1gb2j33ha6j97gy8jf9h4gj5hgejgdmfxoouqkrrh7thawl1;1:fjo;1:0jn7hdah9fjsjgrpkuwlm;1:vje;3:cj1wjr;1:rjs;1:6ja;1:aj8pjz;1:4jiriluin;3:6jg7hfvl8wh7;1:ehbojyph1ql2;1:2k8;1:1h8gikil8sjh;3:8gt9jfqik;2:dk6egulj4;4:tk2wik;1:0ka;1:wji;1:wj5;2:aiz;2:rhhsn0wgx;1:vjf;4:pk6;2:tip;1:8kr9gteh1kji;1:ditplf;1:tl3;1:djq;3:8h99izjik;1:9ikbj0ril;1:ijd;1:0k19jkbhadhgeh2hk1jhgnjvpinqhc;2:ujn;1:4iz8h2jjwkjk;2:ciqdlvegtfhdjh6qliwha;3:1is7h78imgjo;2:8h3hhcmmdtjb;3:okiphewji;2:riq;2:eip;1:ujovjl;3:aixcipfhfhhfwjn;4:dip;1:0ji1h32lu3jg6h37k28il9h8agwchgej2ghchgbijljh2pgzqjlrgvsh5vhfwh3;1:hik;1:5jhahbcj5;1:rja;1:8k8agobgscjceizjjrsgx;1:hjsjh8oio;1:rit;2:pip;1:aiz;1:6ixmjqvhd;1:8izjiwwhf;2:bjd;1:0jtwhf;1:qiq;1:kim;1:0iz3ip4k15mnjgywgz;1:8ka9g7hiz;3:1ipfj9hisjgkwjl;1:1lo2h73gl4h75hc6h17ji9hedgxfhehk3jg3khelhdniooh6pimrnwshdtimugxvhfwgd;1:dffel4hfyjk9;2:qldriwwgb;2:ck0fhgrhawke;1:7hb9gpamnbjndhbekeikojexohfqiurgusl0thauf6;1:cgwij5jj2;3:kil;2:fil;1:0gh2h93g74h66h87ju8h29j4agdbk7eg7fgkghfiiujikkiylgymgkognpg4rkdskstl9uke;1:8im9jpbizckzdishgplivqixrh7sh8uhdwgo;1:jjz;1:0gw3m38ln9gtbgddk6ehaghbjh2qj8ripsgithbujwwgx;1:1hg6ha7hd8gw9itegvjgxkh8llzmnanfvphaqh9rj6viz;2:6hg7l2fhgvhgwj7;1:8le9gdcjnfhf;1:fj2jil;1:ckceh2wim;2:5it8h3dj6eh9hgvjiwrjcujo;2:giy;2:gim;5:6kl8j7agpcj1dfkfimkjzsjwwh5;1:fjljhgnjjoittjxwh1;1:liqwir;1:8iuhherl5;1:kgqmlu;1:8kt9kjbitkh3linrhg;1:kkl;1:wjv;1:0hb1h83ko8l89piah6bh8ch9fjhgg2jh0mguqh9rgwwj1;3:4iv6km8imjjpkizwgs;2:wiz;1:dh8fjiljq;1:7jmjimwh6;1:5ix7hg9iyjhfpheql7wh3;1:4kp7hf8hgdheeivjixqnpwg2;1:aiscj2fivgh0hj0jhaqirrhftjwwhh;3:3jf9jdbhdfh2gjsjfxphgqh5rgpsh3uhewmu;2:7j4bjsdhcvir;5:4j6;1:5j3;1:din;2:0jo1hg3is4gk5hc7ha9hbbh4chgfh6gjahfgikkljtojapimrjwsg2uh4wkt;1:1hb8h7hh2jhfkjvmheojepkgrivujcwhc;1:sj4;1:oik;1:8gy9j4biook7tin;1:3k89ipal7bhbghchhcwjv;2:ggyhivilgjivrhcwhb;1:bil;1:agggl6sgavkewhf;2:0h51hc3oc4jf7hd8gq9gabh5dkfehegh4kh8oh5pgyqgkrj6skuth6ugcvhhwkz;1:1hc3kw9heak0eheggtohcpixqktrhcsh7wil;1:aitqiq;5:1h45il8giajabh7ehegjrkjzrliwiw;2:5jfjgrqjnvkb;1:6k58h79hgdnmjgnohdqhcth2uisvjf;1:0hc1hd3hb7h8aheblecjiejgglshhejh6kh3nh8oheph2qjorh6siyth7ujdwh0;1:1gn8li9jagjakg3mmvnh3phduh8wha;1:jiz;1:aheeirfjrjir;2:2j98iziiyjilrh3;1:ok7;3:0nt8gv9k0ehblj4rgrwh5;2:1hdhgjjjxrivuil;1:0gb1jv2hb3h34iz5iv6h47h68gr9jxah4bgxej3gg6hjrihdjjxkkvlh6nh8pguqgtrjzshfuj9vj0wft;1:gip;2:ais;3:1hg3ha4he5gw7hb9jpagrbkzeh2fjcggkhiqikkjiukjmlgwmh8phfqhbrj9tgvugvvjz;1:ukpvh8;1:8he9jwhgkjjo;1:bk5ehe;1:gil;2:gip;1:3kk9itbh0jg4rkgwhf;3:mjnrjdwh5;1:aiwpix;1:kix;5:pj2;1:uk2vhe;1:8ikdiseha;1:3kc8j7aizbhgcfzeirfhbhimjgoljcrjwthbwim;1:2he3lvdis;2:dl7eg4;1:0iy;1:6ip8ix;1:0jp1k63gx7hgghcjimohbql7;1:3h85j6egzuk4vkgwjc;1:rj7;1:siu;1:0je1h0rjy;3:0h02he3ls4h85hd7gw8gp9iuah3bizcioegjgh4ihgjkrkhbnhhofypj1rh9tgmujsvmf;4:0gk1kn2h13gp5gv6gv7gs9g4aikcgmeh8gg1ih8jg8kl9lm1mj0njtonaqfssjbuisvgpwh1;1:vin;1:1mn2iz7gw9j0chaegrfjmgh9jhgkhclhfmhaph0qh6rhctjlugsvhdwkh;2:ghbqj6;1:hfytkz;1:qir;1:wjn;1:0itdh7hl2rjiwha;1:0kh6hbeinlimpixwha;1:win;1:3ixeh7fiu;1:gik;2:uin;1:0h13he6ip8gf9hdahabhfchednwel8fkwggsjilkixljumhcphfrgbth5vgiwg9;1:9iw;1:4j66h49kaagxbh4cjnfj0hjgjj2rgbsikuirvinwga;1:aiwfjorgp;3:dis;1:ah3ujy;2:8iy;1:2ilcjceijgio;1:vik;1:wj8;2:1j7;1:hhgjj4;2:0m66nj7h18jpjhgpggqfpwgu;1:3obajcchejhbwg5;1:1j33jlhj0jh0wgx;1:bh5wkb;1:8jsahbchcfiljjorh9vkbwh4;1:wkk;1:4iv;2:6gfahabejchhejefj8kmlvjt;2:ckbrhe;2:1jxah6lisrkj;1:wjy;1:8g19k6aisbhffh2hherl3sir;2:bis;1:4k28h99j1ojswh8;1:1np2hf3hd4hh7hh8gn9h3ah9bivcjjdgeeh6fhagimhjwjgzkhemjiohgphbqh8rn6uh1vhgwhd;3:7ikaixqjl;2:3h74hc6h87fk8kjamqbgvcgudkrektffchk7jg4kgllhcnh5olcpglrgwtgjumhvhcwgw;1:0p43j44he7ha8j69h0ah8dhgijajgukhelhgphfqijripwgh;1:5jsehduiv;2:his;2:gjkoisqhc;2:jio;2:8gzwkr;3:9jtaggfh3ghdhjsjgpmgmoo8pl2qhgrhgwgu;1:fh8ujn;1:8f69lodjpjjnqjlwhc;1:2m93ka4h46juchgjhdohhpjsqhdwgn;2:4ldphd;5:5joak2kgu;1:cikeik;2:3k0bh3;1:1lf3h74ha6h57gz9gqblbciydg9ejmgg6hjbih8jgpkg2lhbmj9ngrogzpjfqhctmgvhfwh6;1:1h44h85ha6in7ha8h19gqaiocgrdlpejhghehh7jj8kh1lnpmjgngzoj2qhfrfbth3vh8;1:1iuahfnjesimuj3;1:oj9;1:dh6eiu;3:9imahgfh8pjs;6:8isoilsixwhe;3:cgmggqjj2rkatjx;2:8hbafzfgajhhwsp;1:hir;1:6heugwvkw;2:3j0jhdqjy;1:2hfhheujivjc;2:0hc9hcahdbgwhh7jh6mpzojuqjirhgtjfuh4wgn;1:riq;1:egrgkejkawgl;1:8hctjkwj5;1:9jl;3:rjo;2:jio;2:ril;3:4jv9h1bj3fhfgizjgzkgulkcnhbpjzrhfuiowin;1:ckfwgz;1:1in8gu9jobiqrhg;1:8hcagpcjqgguhjhjg3mh2plbsm6tjhuixwgg;1:al6jk6uilwh4;1:0hf3j34hbajbbjweikfizggihhbjhgkkiqkmrhhth5wfy;2:4j1cimjh1tlowhb;3:biz;1:8is9jsajccg7ehbfivgj6hf1kh6lj2rko;1:fjgghbminpitwj0;3:3kobj1fjfjhfqhguipwh3;1:6jvniuphfwim;3:5ijkj3;1:bj0riu;2:pim;1:3hg8gl9h9afsboscileghfkrgk5lhdqlqsgqwgq;2:jhdqjd;1:bjjkhc;1:wiy;2:8h19jxdhheikhir;3:hj2rh5;3:9j1ij3;2:ainwj0;4:jj7sk5;1:8gjbgsrmi;1:pj6;2:2jm;1:piy;2:8ix9h6;4:4nb5hgphfwh7;2:0h21h62hg7gx8jt9jqagwciodjdfj2gkijgcmh5ngxoh7pjsqh7rhdsj0uiqwh7;1:8ilhil;3:2m2wh2;1:mju;2:7h8gjp;4:0hb1gi3gj4hb5h96h07k39jibkdch9dh6fgqlh4mgnnkvoh7pgdrjhtikulsviqwgy;1:gjm;2:ch1fl8;2:gguhjqok4;1:dhaeitjik;1:gjzhjorhhwh7;1:8jmgkhjhclirqirtjgwgv;2:airmjm;3:cja;3:0gj3h98hh9j3ahbbiudk1ek7fkcgh8hioihdkiolhfmh8nhepgyqh7shfuj1;1:3l2bipriu;2:mkc;1:8j7;1:8jruim;1:2kx3hc7hg8go9jpah2bisck3ejkfjtgivkgxmhdoh9ph6qh5ripshavhfwhf;1:pj9;2:1l08hc9jjdjfeh8rfqujn;1:fhegjgjiy;1:ah3jiskkb;3:1hf2l43jx4ha8h99h9egrgixijhkhflhbmhfnkbqisrguuhdwk0;5:ql8wh1;1:hkojhckikrj5wgv;2:3hb8g7bh1ckidh7ej3fh9hmwjfykjamiktkkuhevhc;1:ajffhcjilmjsphg;1:jjh;2:jkerh1;2:8hd9jhakgjinug7;3:cj9;1:4j37gg9jfehbjh0sj3wla;1:gil;1:ehemgushdtoq;2:gjhqjywhf;1:gin;6:uiw;5:mggnlbpj3;2:gj7jj4wh8;1:1j3aj3fhcgh6wjk;1:7g68jo9h4gnzjg4kjqmhgwhc;2:rhfvik;2:vis;3:5ls6hgghajjtpl5qhdwfj;1:wiv;1:0he1ik3hc7h89ilbhgeipfh8ihfjh1kj6ljmokmpj9qgkrh5uj7wge;2:2iw8jpdik;1:8gz9k6ehe;1:jkgoiluhfwha;2:0o81h03hb4h75hc7h39j0agzdj8egcfgtggthhfilnjlekhemhcnhaoflpmwqgarh5uhf;1:1kpiinwgo;1:jiy;2:njd;2:jj9oha;1:qjb;2:0g71gl3gz4k26hc7iu8iy9jrailbjgcgcdgteksfipigvjexkh1lj5mgwnhapjurn6sgzth2uisvhdwgj;1:5kp7iz8geah5ghgjjgrh9ulq;1:gjijh9wju;3:0j6lj0rhc;1:bilwis;2:anxgfojjawh8;5:0lw2ge3ji4jd6h57he8hb9hfamjbh3ch3dh9ghcjiykhalhemhgpgwsjiwgo;1:jix;1:2il4h97hf9j9akrbgycitdh1ggpqh9rjbtgruk6vjowgx;1:2j2;3:8irmijsim;4:6j7aj9;1:hegrlm;1:6j08iv9k6ekvthauhgwhb;1:ain;1:3jk;2:nk3;1:3jkriowha;1:8j9hgxjknmivwhe;1:6hfpjcqlawh9;1:tjjwhc;4:3jf8h1ogipk2wk1;1:vj1wj3;3:ggywm1;1:pj9;1:6hhphdqlewhd;1:1h48gg9j7chfdj7eg3hhdilzrh9sj6ukfwk3;1:hjzjha;1:kj5;4:1gl3hb4h76h97h78gr9kfam3dinfjahiojfzkg9mhaphgrj0titug4vhfwlc;1:9iv;1:9iq;2:1h8fhcojvpitqnawgw;1:1iq4km6haehefj2hiljj9qh9rgvuhgwkg;1:8hajji;3:1hg6k19h1ajqbizcixdhgeh5fh3gj6hjhih5jg7kgnmjnohdphaqjpriqth8uh8vgjwj1;2:5iwjh6ojywh3;3:8j2cio;1:3jreik;2:jlaoh9;1:0gz1iu2iu3jb4gx5hh6h68gh9h5bhgdhfegxfkoghbhgzigpjj6killfuml5njksjdtgpugcvkj;1:4it8h39kuah7ol7;2:2kfqiv;2:8gv9j8bhgdjjegvfh7ikcjhhnilqherjosinthf;1:rin;3:aixshd;2:0kojhcmjsoj1qhgwhb;2:aj9fimkgz;1:1ha3im6he8lk9klaiscizdh4eh3fh5ggmhg6kfxmpgoitpj0rh7th2ugwwfg;1:9hcbhfgjchh9jitrjx;1:ajb;1:2jg;1:jjr;1:nja;1:fh3uj4;2:1h53j27hc8j1agmbjtdileh8fjugmnhhakgvljamhanhcohhph3qgqrf7thbuinvhewmo;1:aiocj3gjqhik;2:nl7ph0;1:4io7hb8j6dgkeh8ghfjkdrg6sjkul8vj3wh7;1:nj2;1:8fobixckrfj6wke;1:6j6ailwh7;3:1ku7cuah7diyegjgirjoukgznhhojzpglqj0rgzvjtwhc;2:sja;1:giurjn;3:5jl8hb9j8fgy;1:dmeeeu;1:aj2hj8jjwrhc;1:cir;1:pikqhgwka;1:6mb8ipal5bhdchgeh1qhgsjduh9vh7;1:4he5so8jdeh8jg1mh9qhdtj9uh5wgk;1:mjo;3:kh2lkltjfuh9;1:ajgcikfjc;1:6he8gwajfehdgj1jhgkipnheplbqhfskjviwwh0;2:8jp9haahcdjfjlfqh8ujgwgh;3:pirqio;2:1k78o39hechfdgfej6hhawh7;2:6hg7jo8hdninrimtiv;1:jh0wjt;2:3ik;1:5ik7iwgja;1:4isvis;1:0h63gw4hbdgqej0ghfhh6ipljisrjmsizwgy;3:bk7;1:0iq1kk5j16jg7gj8jx9e8ah6bgbcfhdk3egogioijqjjcmk1nh8oharfgtgxug6vj7wk1;1:6ik;1:1is;1:sil;1:bitqkswh8;1:2iq;1:0ip;1:birhkdrha;1:qk1whe;1:bijwik;3:gjf;3:8h79gxah0bl5riw;1:gis;1:1ivrh9;1:9h2ajlfjznjyph5rkbsh1ugmwhb;1:uj2;1:2ma3ki4hd6jw8mg9eojhcphgqhfwgq;1:8gmjmcohd;1:bj6jgfwkr;1:ahhbitciljhfqko;1:cilwjt;1:1ghfhdgppjh4qherg7sk1uk3wh4;1:0h43he4he9h6agxdh4eiofk3hiljijphfqhbuj3wln;1:2he3gy5kx6ha7h49lmah7bh9cimdioegqfilgh6himjh9khbmiznhaoh2pgmqfztltuh6vhfwkt;3:mjpuix;1:8h3hhcmmftjb;1:8f79kntkq;2:ql5;1:wil;1:lm4nhc;1:8ixcin;2:pl1;1:wl0;1:bh5cinrhewkb;1:7hdphdqngwgt;1:1hd4hb5hg6hf8li9kkajzbirdhaeglfg3ggzkl1lgimh4sirthfujk;1:2jb3h76jpthc;2:cisrj7;1:qiq;1:bio;1:3hfbilmkowh0;1:8ip;3:3j85ha;1:cgpmjgriywja;2:1he3jy4he5hc8h49gtancbgkcinehcfmmhizjgykgolhgmhcojcqiwrgwuh4wgg;2:1in8jj9h1bgpjhfkjjlk1oj3rgqtix;1:ijrjjwrh8;1:aivjj8;1:kil;2:ain;1:oj9;2:khcpk7;1:gipwjw;1:3h45hg6gn7ff8jm9g6al6bl4ckffk1glhhjniixjebkgtlhbmhbnj4ogwqh8shftgpujcvgq;2:9h8bkschhejafiugj4hjgjgiqhdrjothgwgo;2:aj3;1:ail;1:kgylgtmh3npppgq;1:7iohhg;1:aiypiztipwhg;1:bjg;1:4ip;2:0hf1h22h63it4hc7ix8j39jwahbchgdjqejrfgyggtkh1lhbphgvin;3:0he2mw3it4h67joaimbgqjgukj1lggojipgyqgqrk4sgruj8wh8;1:4l4rir;1:fheggnhmfrj8whg;1:bjsdgqejj;2:0jd4hg7gx8il9k7ahcchgdizegvhhcjkhmgwnj3ojtphfqhergrwkc;1:1hdahafh3gjwjhgrjusl1uhd;1:cineizfhfugbvk8;1:aiskgvmkenhc;2:qkrwh8;2:qjlrik;1:rgiwl8;1:fiwghguh9vl7wh9;2:0j52gu3hg4hg6h17lbjj7khgnkyolbph7rgqvgawhc;1:tkw;1:6mmlhfojophg;1:1inajrbh9fjpol7ph1wh4;1:hil;2:9itein;1:fh4hkuuhfvja;1:8h3fgioiwpharlf;1:cmirgjshc;1:0ip1g5khcln0nherh3wka;4:7lfdgvejrjg8;1:hgzjj1tit;1:ciwejgjjyohfuj7;1:6hd8h69jfuixvj1whg;1:iiz;1:7lgmixph7rhgsj3whb;1:djfehcfh8ujkwis;3:wiv;1:miorjc;1:0gy2kb3h15jy6hc7gl9hdfh2hh1jlpkmnmguniqogxpgsrfptgqvhawkx;3:0iv6jovh1;1:ehfuj2vix;3:uh8vjv;1:0ivcjmfh4uj7wj3;2:8k59ipahffhbgj9hjhjh9rjswh9;1:pkg;3:8iy;1:agvbjr;1:1j49isbimrh1wj2;1:hj8rgw;1:ojlpko;1:8jvbh9;2:6h8viz;2:uij;1:1hb8lg9ntaljbiscfyegkfgvggvjh3klhlh2nh6phcqh1th5;1:oh5qjc;5:1je2gt3h74ha7hg8ja9j2ajvbj5eh4fguggzjh8kh7lhfnodojaph0qimrgwth9uh9;1:5lb8hdqhbtj5ujh;2:ahcjjx;2:wiv;2:dgqeje;1:hjt;4:8jy9h1cj2gjawh8;2:kj5ojk;4:dh4ekvrgt;1:1kg8j6;4:1h92m05hd6hh7j39h3eh4ngvphdqjmrh6tj1uivwis;2:8is9gnajhdhcegsfnpgh7hiqjj1kgxoheqjcriuuhawgi;1:8kh9gxakgcjdelsfgegg9shbuhg;1:mj1;1:1gm3h14ha6hd7gwafibgldk5elkfj1hgrihclgwmjcnizoinpgwqk4riqvijwis;3:ogtplsqhb;1:bk6cgwojj;2:iiv;2:cgxhjh;5:cjnhgh;1:dinqiv;1:qja;1:eik;1:8iybh5wka;2:cje;4:6he8jn9gqwlh;1:6hd7ithisph9ql5wh0;1:ejdgjhjh6rhfsj0uj4vjdwiu;1:th6ukbvj6;3:1ky3ha5j0ph3rhguh9wlm;2:kj3wjw;1:5iv6h07ip9isbhaehgfjighehivjgemiooh0pj4qjqsh6;3:iiy;1:bhefncuh5wh1;1:qko;1:3iphk9qjxrhcwgv;1:gikhg8jjk;1:8g99jvahfdl8eeqfhghjfjh2rizsheukcvjtwhd;2:ojc;2:3gs5hg7kk8haaiqbgtcgrdixegmffqgnthkokh9lhfmhcoj7ph8rg5sjjth5vj4;1:2lj4hh7h7hgpjk3ok6qgurhbsgsvh5wl6;2:8gw9jwahccgsjjykjnwhg;1:dgmejf;2:6hf8ggajdjh4oitpguqmcuj9wja;1:1kk3h74he5j26kg7h38h39h5dgteikfjhhhakhalkqmh1nh2oiopjaqh7rh6sj8viwwfi;1:2jp;1:gjwhh9jhaqilwk4;2:aizdhgeinfh5wm6;1:1k9ejggj1jh8kgv;1:4kiiiwljewha;4:0m44hc7hh8jq9gnbjcch6dhckgvllzph9qh8rfxwk5;1:6hd7jhch8eiwfk7ihhjiptj2;1:5hdjhfwju;1:1hg3hd4js7hg9gtal2bkhckbdh6eh4fgwggyhh0kkklhfnhdpj4qjvsh8tgwuh8;1:8jyqjjwh2;1:kjylhbwk2;1:gixhhg;2:ogzpk7;2:8jq9hg;2:8hb9hdbkzgik;3:5io6injjsqinsiuuggvk3wk8;1:0j48ez9m0agvbiycj9dizwiu;2:1iu8gnkkwrhb;1:0ha1h52jd3l24g95gx6gg8hc9iubhbcitdgqeitfh1ggrhh8jfykh2lhemh6nhaojmpj4qgprncsh4tgmuk8vkawjg;1:1im4im7j7ah2giphimjh1kjb;2:cj1pjishd;1:bj4cj3gk4sj3wgu;1:1hc4he8l39mwah1bfbcjudgpekwfgmgh3kjjohdpguqh5rjvsisth7uhfwfo;2:pir;4:firuij;2:4h86gq7h68hfagibhdcgzdfwfobjj4qk0rk6siovl2wgk;3:dinmgjokb;1:6hfal7birch0fk0gh6lisrhfvjdwh6;2:4ilrjb;1:gil;1:0is;2:0k63k74j4eivgguikgjgrqjqsgiwfe;1:2ku4gfjiz;1:7k59hacjufhb;1:8l19gsdjpejifhcjhg;1:4ip;1:oizphh;1:tk2;1:qiutji;1:8io;2:8g79jxaijbhdfgxhj1jhdpikrkxsip;2:1ir2jb3h8;1:1haajcbixfhcrlasj5wgc;2:8iv;2:2iu5hebhceh5fhggjijjjkhdpiuqh2rh7thavkewl5;1:eiv;3:jjp;3:fggwl6;1:eiohjomisvio;2:5ilbireiqwk0;3:bjf;2:8gnaiwsiptkk;2:7hcjjsqjo;1:hismjt;1:0iw3hc8hfsjv;4:3l3wh4;2:bj1kiy;1:6hh7lwphc;4:1ivehbriy;1:rjf;1:6gdainvk4;1:3k17io8it9gzah5bh9eh1fjjgiwhivjgqmhdqh9rldthevhgwja;2:0k11h2iikpj6;2:1h12jo4jo5kb6in9gsagncgndineh4fh3hjdik1jh2khelj1nheohfph7qikriotheuiqvhfwfu;1:aj1rik;2:4hgmj3okawhc;1:8k5uhe;1:ah1ujm;1:rio;2:sij;4:gimsje;1:wiz;2:jiroil;1:rjp;1:wje;2:ej3hgvjjl;4:8hc9j3;4:ah4fjmhh6jikrkywh9;2:8he9iu;3:rlath8uhf;2:8iv;2:sip;1:4ke8j29h9aklbjqcisegffh8ghdrioth8wj3;1:uir;1:1gr2ha3h44gz5hb6im8grbj5eh6fhagjphhdij8jh3ljamgqoh2rkesh2vhbwmr;3:pjywh5;9:pk4;1:fkeqj8whe;2:5ir;1:fl7gh2;1:ahcehffjkuj3;1:blpeh0fhajj3;2:nje;2:4jk8il9hccipehdggyhlgriw;2:fj5;2:ljfwil;1:1h95jb7h68hacguggdmjrnmzoj6pgsrhf;2:sipwjm;1:8gg9jt;1:0jf9imjhe;2:0gq1hf2ix3k9ah8fk7rj9;1:wj8;3:8hdbl1qjathg;1:djueh5hjujiprha;2:kimlit;1:7kxejcqhf;2:aixciq;2:mjc;2:pim;1:1jp8kb9gibmbch0eh6jhgwh2;3:0j21im8gtbiq;2:8h7dl4eg3gjt;1:bivwjo;1:qirrio;1:biqchchilijajjepkkrhfwh6;2:6jaahfbjgciwkhdwim;1:8gc9jpbkxghgrkkth9;1:qiw;1:8he9h3cghgh7hggjj0njarjgsjouk3wl6;1:8ipfjugj7rhdwin;1:1gs2jz3hd4h86kz7h78fu9h0cgpdh6eizfjniixkl6ljqmgyngwph5rgesgytjnul7vh4wfy;1:4lcjhfqgx;2:2h73jt;2:dh3ejsfinjhdqjfrjmwgf;1:1k5kj4;1:1hb3jr4he7hh8jz9jkajbcgxdf5eknfgogguhlajgglh7ogzphcth5unyvflwga;3:8jfjjimh9rfmtk9;1:fkpkhcsjq;2:8heeldhh4jjcwhb;2:qh9wkq;1:9ik;1:0hd1ip2hg3h34hb8lu9cuah5bgdcgrenzfgogjfhfwjlgkk7ljlnhgoh8phcqkbsiqtgwvhgwh4;1:2iq3io5ik9ixahfdioehefheggbhj6iimjh6kjulipoh9shhwio;1:fju;2:ujy;1:4jv8iv9hfaj5dk0fh7jk2ohcrjdugmwhc;1:8hedg2elbiip;1:2iq9hcbkjeingk3jhc;1:9k8ch9;1:hj4;1:uhhvj7;2:5jojheng5pks;2:9ioak8fggriqukb;1:8gy9k2ah9bhagkkjjsliqrixwha;1:1h57kh9h9bhgcimdhbeivghdijojlekh7mhanheogapkoqiywg6;1:1hf3h35he8h89gwan1bglcj2egifoigiwhj1jhdkgmmhfojgpitqh3uhdwgu;5:wiy;3:tj7;1:8in;1:8hfbhhgk7;1:kg5lmx;1:9iv;1:chhej1wir;1:2gx3ju;3:aj5bhdfishiosgtuk0;1:0je1h23ns4h3bhh;1:cjokioshd;1:fkluik;1:dh5eisjjg;1:diu;1:9lireu;4:3m78j0ggyhlkuikvh8wg9;2:blxfh9;2:8hf9mguex;1:mjqwh0;1:mjnrjdwh5;1:cjajin;2:9jeeh5fhdgqaih7jgtrh0whe;1:1hf7md8jngiyhh9jh0oiopj1qhathbwh5;1:dj3;1:2g53gw4h35h56mv7h38lm9gcbg0chedjneirfjbgjshjzih0jfykh1mhfnhaohapgvqg8th8ujrvm5wh6;2:8j5fjdmiuqhb;1:2kf6j6vj4whf;1:5l5ahcbhdjjaqhesirtjf;1:9jn;1:wio;1:7h98j89ikciljmzogpqh9;3:4isjiv;1:jgfkjbmjzwj4;1:6jrfiqwip;2:pix;2:dimoil;1:3msmitqh8whe;1:8im9itbkwcgbrh0;1:ej2;1:3hg6h6ij0qhevo7wji;2:9jmpiq;1:5j3aj0ej5pjwwhh;3:2jb4h55h68jl9gvbhbdhbekakfrnl2pgvqh6royuhfwh9;2:jjp;1:5ip;1:9iq;2:0j81hf3he4gsghhilyrhewk9;2:pjo;1:8j4ah6bhgchfekbfh2ginjhhkgklmynh7uhbwje;1:aj2gj1rhb;2:ej3uhe;2:bio;1:ahajjr;1:ujj;1:8ipaimkk0;2:ajhwkh;3:5iujhcrkd;4:fjetin;1:8fobipckqfj5wk8;1:jimmjs;2:eje;2:8iqbh7tkn;1:oiywiv;2:oir;2:3j35j17jfohfriruimwj5;3:1h88gyah4blechhfh2gj0jgrkiplj7oh6pjlqilrk6wiu;1:nk5;3:7hgjhhkhblokohapjyrh8;1:7h48hb9heag5bhfdh7ehefk1gh0hgyjizkhgql1rlssh5tjrwj8;3:kh9lm7rhf;2:cjkrhf;1:6jyvg2;1:2j5ciqhj4wil;1:9gnaizdjzuh5vik;1:fiqjkjpgu;4:bj8cisdj0ehetjtuhf;2:aj4bhgcioigijgysjdtmp;2:kgmmnsujbwgs;1:0ioaiq;1:wis;2:1hgrk4;3:1jo;3:gks;4:8j6dhcej0ijcljb;1:lharj2;1:qjyrhe;1:ain;1:5kfaiubhbdipej0gghjjkoivqharjcsisuhfwgz;1:bj6chfois;1:3lx7ixdh9jhgqgwvin;1:uja;2:giw;1:9ip;1:4krbhfjiqkhbmlawgs;1:8ir;1:7hh8l8fj6gkmhhcoj9ph6qh4rgrthcuhfwkj;2:5jh;2:7h6al2fgwjiz;1:0oq6gr8j4jhgqhgwh4;1:9hfdjbij8;1:4hc8h3ahbeh8fmlggchj4jh3kgwlm2ohcphfwjg;1:fj2;1:aivqivuir;1:him;1:1gw8jc9j1cgmdgsfhagkrhjvjgblhepjwrjsth9uiwwin;1:3hfiikrimwin;2:9j2gjvhhajikrhe;2:njv;1:0iwbioohepjkwir;3:0ha1in2gx3ki4m05hd6gt7gs8k49gvaf4ch0dh5ej0fhfjhakmelkymhfnl5ogupf9qiosj2tgovgtwey;1:wjj;1:1mokismh2ngiugxvkq;2:wit;1:1nk2h93h85hg6he7hd8gzahfbikcijdgpeghhjiihejgemixohdph4qh2rnvtj9uh9vhbwhc;4:1k8ois;2:cgcgiymjfriwwj2;2:de2enh;1:pk6rje;2:agkclmjgvkh0lmlritwh6;1:0jm3hh7hdah1bivfjrjgaqjkwml;1:jj6;2:0he2gn3gu4h05hc6gx7h69j4ajgdhaehffkhhgujfmkgslh0mh2nmspgprg1sgoukpvjmwn1;1:aja;1:ojspgu;1:0jg4ir8js9j1bhfch9dhcehcfj0whf;1:bj3;2:8g7el4;1:wj6;1:aipbin;1:bjijj6qh8;2:8j6;2:ej5;1:liw;1:4lncjbqhgwgy;1:5ke;1:jin;3:airchbjjh;3:citkhgnkswhe;1:7iz9hfeizniy;3:5jw;3:aj1ghgjm3khcoixqgmrhdwjz;1:1iq3jw;1:8k3rgy;3:0iq9hdej5lk9wgs;1:4j0;1:jh9phaqlb;1:8j1;1:qilrjqwhb;1:rhfwjz;1:oiuvip;4:7jujipmip;1:0ja9h5bj3cj8rjj;5:aj1;1:8fn9h1aj3bjnchdej3fl2ghgjggkjxmheoh6phcqk7rikshduh7wiw;2:2kdwhc;2:2k25iy6h38grchedhegh8hhfjipkiyoh6qh6riosj2thbuiyvlg;1:1ik;2:7ixhh8uir;2:1je;1:6j4uirwkh;2:ciudhceit;1:8jw;1:8iksjz;2:3l7ugkwhd;3:2ke6gm;1:dil;1:0jb1j92jf3gm4kb5h98kb9irahfcgydhegj4hhckkhlhfmhdoguph0qirrikshetg9ugevhf;1:qjctk3;1:2lbah1fhgrh4sk1ul8whf;2:8io;1:eip;1:0ik2gb3k95li6hdbh6chggh9jg4mluogwph3qlprivthfwg7;1:bhgmjx;2:8ij9hfbiqhj7kh5olaphbqjowh4;1:jil;2:1h83h77kxgh3jksqhewhc;1:bjhch1jh9qjo;1:qko;1:0il1hg2iw3j15ij8h0ah9dinggbhj4jh5miknk0oh8wiq;4:wil;1:hhejk4;1:5ik;5:0jh7he8h99jmbivfjkghfphhqhdwkd;2:8ji9h4egofk6rjiwh9;2:pjf;1:0je1h0;2:8j9;1:0j31kkjh6qhhvhhwlf;1:pjs;1:oiy;3:9h8kiw;5:civfja;1:fimjil;1:5iz9ix;1:git;3:ahgfix;2:miyqj4;3:bj2;1:uip;1:pim;1:jjhwha;1:wiq;1:8g59k0uj1;2:0gm1j63g38gd9lxafjcj2dgteiziinjk9mhhph3qj5rl5wip;4:1ip2iz5hd6h47h58kb9heaikch8ehcfh1gg8ihgjjrkj7lhenh0ojkpjgrhgsj6wgd;1:mju;1:mj9;5:lk4nh8;2:2jz8pf9gcaiwbimcgzfggghcjj2kiulhamhgqhcrh0sipugwvkcwft;1:dheeio;1:5j2jh4mjarkbvhgwgy;1:2iy8j29h6cipdjjeh8rh9wiv;1:fik;1:agqqkwrjytjzwha;1:gj8;1:eip;2:0hh1is3gx4je5jl7hb9h4bk7dhdfh2ghbhj9jj6lj9oh8ph3qlurf7sgvuh9wgd;1:kix;1:8hc9j7mjf;3:8ji;1:ajhgj3whb;1:hheujl;4:viz;1:1h6rkq;2:6j6whh;2:ghdhk1kh7lj3;1:9it;1:jji;1:5np6g3cjqoiwvg8wh4;2:2joaj1bjncisggvuivwhf;1:tiz;2:gj7;3:jhfrklwha;2:5j9bj0;1:3hf8jk9m9akubkwdh8eh0fgngilhhbkivlgynhdrh2th7uhawgm;2:bixchdhijkiz;3:ajhbh9sh6wkv;1:8jk9io;1:0hd1hb3hb6hg8gq9fzagkbgzcgxdlleltfl3giohh8ihgjjpkhclh6mhdohbrj0th4ukmvj6wfu;1:qjm;1:fip;2:ahefkhij3rh3;3:ogjpjr;1:biqpjx;1:3h4cjghjwjgorh8wjo;1:qk6whg;2:hl5;1:1gw6l07j4bh0cjmfhggjxhhhjkjkh7lksohdpgiqh7rfgwiu;1:8in9itajkbixcj1diueh3fj0ghahhfjizkh9oj9ph3qh0rh3wjy;1:djaegw;1:ghgijn;1:8jjfinwhd;2:sjn;2:tkqwh5;3:gk0;1:lj6oh8rh1wm7;1:0he3hb4in8gnbheciodhgehbfitginkj6lh8njcoj8pheqh1rlcuhgviuwhd;1:ah5fkljikkivrhgwiq;1:1j93ke6gy7h9ak7ij8jgmqk5rjgwfw;2:fiu;2:gj3;1:kis;3:gkr;1:9iv;1:1jd6lfjhckjjph1wgm;1:6hfvkx;1:jk4sk7;1:hik;1:tix;1:0jedhgeh5ulx;1:7jd8jm9hheisfh8gh1jhgqisrjs;3:8hdajrehcfj2hjirjfwhd;1:rjo;1:2k8ahebimcovdh9gh9hhalh3nhephauiovhfwgv;2:qjs;1:1iq2ip3ge4gj5jr7hc8hgag1bgsdh8fgcggpjj7kg4lgonjloj0ph7rjtuk4vkqwkp;1:vjn;1:4j5dh8fjeiik;2:7m4rh7wgr;2:8iq;3:jjq;2:5irfkg;4:0ja1iy3gs4gq6hh7mt9kcagpbgxdj1fg0gj6hg8jiqlhbnj6ok4qjcrgftgvugxvhfwfs;1:ahadjaehbfjhjjynjcqh7rh0skztjmuj5wen;1:bji;1:riz;2:pm0;1:0ha1hg2h23jm6hc8jnajsbgzdikhfwigijgploomh2ogvpgtqgwrlnugovhd;1:oiv;2:bitwji;1:uhgvj7wjf;2:1hgdjofh4riwsjrwhf;1:gj3;1:gizrhe;1:7jpagvsjpujj;2:dkbeixwj6;1:0ha1he3im4hc6hg7heahgbhgcj5ej3fjuigijg6kj0lkwmhfnivohdph9qh0rlftgvuj1vhe;2:8gp9js;1:jin;1:8hg9jmchdghghj6tjywhh;1:gj3;1:ij4;1:cjjqip;2:8j49hakhanlt;3:qje;2:tir;2:1gp8ge9jjah5cisdhheh1fj9gj2hk9phgrkwtk4wh7;1:aimwiy;2:4ix;1:ejafizgilnipwhg;2:uiqvis;1:ajobh8fhdgirjjg;2:kj4;1:gh4hiy;1:3hf8lf9ljbgrdhdehfgh9hitjhdrjjwj0;7:jkkphfrijwhe;1:dilehg;1:fio;2:ckhhfo;2:0ku1gh3he4ha6gj7gn8gu9giah2bh1dinfgyhiqih6jj8kewnjzohdpjzqlwsiktinujdwiy;3:jj9;3:0iu1gnbjjclyejmgh2khdrkg;1:1hdbh9fhfgjzhj0jgxrjhsjiuk0whd;1:8h8bktgk3rgzwjm;1:8lp9g6ah1niqrk2whf;1:cj8;2:0nb3lu4h9ihejh9ojipgvqh4;1:ah9bkvchadiuehffk8gmykh7qh1wh9;1:ogeplqwh4;2:7fjjhdmj6onmph7qiswk3;2:qiq;2:8kkthd;1:0mf2k43gv4lw5gy6ha8jt9g5ah2bg2ciydhaeiwggohh3ihdjfxkiulkkmkwngjog7qivrghtl2ugwvhgwea;1:8jv9ik;2:1imuis;2:pkq;2:6kvpheqhe;1:8j7diveh0;2:iixwje;1:hir;1:aj7ggy;1:ginnjc;2:9izwjj;1:aiqbjzwiv;2:2k6bimch7dh3ehhfivghghgyrkavk0;1:tim;1:elxrgr;1:8jx9ilehd;1:mjg;1:aheciqojq;1:1io2ir3go5he6j6ag8bgjclddfnejvfj5gh9jfxkjtllamgioivqg0thd;1:hjh;1:0h72l73gx4h25iu6gr7gv8iq9j1civegyggvho5ihgjjulh9mh5nhgpjkqj0rhath8vh7wg4;1:bj8cirgkahivrgsthdwh8;1:kiy;1:bj2fjjuipvjk;1:3hg4jv9hgal6bkjckcegdfh3gh1hh1kl5lhfnheqjwsh6tgxuha;1:ohepj8;1:1gq3jp5hf8h19gtdnbeh6gk2jg5qh1rgctgwuiyvjbwl8;1:rgswk2;1:bjakikmkbpizwh4;1:mjo;1:fim;1:8isbjkcjyeilgjzhhfrhdwh5;1:9it;1:aj5cijfh5gl7jknqinsjquh9wgt;2:3h27h88he9iqbgzdhgehdfheggzjlrmhdrnjsilthauiywit;1:bj0;1:0hh2h53hb4il6l97h88io9hcbkidh8fimhhdjhekisnh2okapgvwgj;1:7k2;4:0hb1h72io5jk6h28j19jrbh7dhaeheggkhiqihbkgllhbmlsnhbognpj8rh3slnth8ufuvh2wjy;2:5jm;2:0ke1j53j84gw8herhfwj0;2:jiy;4:bjm;1:1hd3kd9h3ancbfrch2ek5go0hjhjitogsqh7retsesth5vh5wfp;1:3ku7jvaj5dipjh0kiprh8whb;1:0h71he6he7hg9h9ah2bgscgzeh9fguhq8ihejn9ph9qixtk9uhcwfu;1:diygknjiqqimwhb;1:0m21ja4h28ikcj3ehgihewh9;2:hjmildthe;3:3lk4he9h5civij7jjswg5;1:5iz;2:7hggj8;3:8hfjh4qjutkzuh1;1:8h8aiz;1:0io;1:fikhinlherj4wiy;1:bgofkb;1:1hb2ha3gq4k79kuaj0bjbehafh7hiljgrlgpmh1oh7ph0qgnrkzugjvit;2:oj0;3:pj8;1:viv;1:8j7;2:3iz9iw;1:8h29k3;1:rkf;1:bituhevjk;1:2hb4iuolc;2:8jm9h2;1:wiw;2:9haej5;1:jjb;1:0h91h93h36hb8g79fbaghbh9dnlel3fklhh3ihejjhkh4lh5mh5nh9ph5qjhrjetgvukgvjrwfm;1:8j7;1:9hgbiqjirtheujr;1:5imuhbvj1;1:3j06jv;1:1iwqk4rhe;2:8im9hhfjhghbwj9;1:qj6;1:jj9;1:ch8fgygj6jhbkhgmk4qharlbuj3wgu;1:aj4cjcfh5hj1rhf;1:1hgbirdk0gh8jh5kmjnh9pharj6wgy;2:rmjuhb;2:fgwgko;2:7j9cilej4fj3rhdwhh;2:1h38go9mhdgvehgfjmhilimzjhakhfrge;1:gjg;2:9jt;2:8iu9ixej1jhbsiv;4:6j8vhh;1:fislim;1:dkeeg0pj1;4:agofkwgjghilkjbuinwhb;1:cjt;1:7h5ahbfhgghehl2qgyrjcwjq;1:oiq;1:9isuiq;1:mkowhc;1:3iu;2:bit;3:gin;2:sis;1:jhawkf;3:8j0qiq;1:oim;1:mjq;2:ajkfhd;2:2iz;1:8iy9h4bheeh6fhfghcihajh6mklqjfrk1sj2wj5;1:agvcg3jlv;1:uhavjk;3:wik;1:cgojjykl2mhg;2:0l81l33lv5hg6he7h59j1agtbk1cjkdh9fh8hhbjgmkfylgxmgtnguol3pggrh6uh0vh5wfx;2:3iswiq;2:4iu6ha8gvbgcgm4jhdkhdlkrpl5qh3wgu;2:1jdbircilek5fj2gh4rgy;1:dizgj4qikrhdtj6whb;1:1ksij4rgdwhg;1:iil;2:0iv1jf2j43ge5jp6hf7h08k59g5ajvbisch8eglfhagikhf3jkzkj5mj6ngsoj5ph2qkbre0shhth7uhfvjgwhd;1:kjvrhf;1:oiq;2:oim;3:0h63h95hf6hg8iu9jvejkfikgh2pjdqh9riwthcwgt;3:4jjjipwgs;1:qjk;2:hjzjilrhg;1:lim;1:ljp;2:3ld9h5ahfeh1ghchj8jjsqhbrjmsjfwfs;3:6hh7l4fhhvhgwhe;1:0is;1:9iyaimkhgnkq;1:wkh;2:7io8h6kipukevj9;1:djsegvghdhiw;1:lit;4:oj2qj6;3:iiukip;1:lik;1:8j1sj8;1:tj0;3:9irbhhgjuqit;2:liy;1:aj4cj2ggwohapnxwgq;2:jlwnilwgz;1:1kn6hb7jnvimwha;2:fgegl0hir;1:qit;1:hir;1:bildik;4:0ha3h14h06hg7h18ey9jjah1bgqfijgkihh3jmkkgxlhenhcogxpgdrh2shftjxuh8vkrwoo;2:pjs;1:fjhghe;1:0ip1g1jivkhclmanherh0wk8;4:kgxlkv;3:5j48j99gscimjgjljawkm;1:hj3kja;1:ahgciwdh7ekyrjiug5;1:0ka1hd3gz4m18h09kfej3fiqgipij9jh2kh2lhfmhhoh5ph9uh4wgs;2:wiv;1:liyoj8;2:2jmgjo;4:dimehf;1:agufl8hil;1:ciqjiy;3:ajerhf;1:1hb2jz3h44mn6hf7h58jd9gybk4cgvdhaffzhgvikpjggkgmlhbnhfofupinqjnrgxujn;1:8guwks;2:8j6;1:9hgeje;1:9hcah1dnqfizhhajgrkl9ugwvjjwhf;1:oiv;1:8klehf;1:6mc8jp9j2ehdoj1vdmwj6;1:0hf1gg2h83im5h16iz7h78lb9haafychddh9ek8giwhjolhamh5nhbogkpgzqgjrk0upkwfh;1:ahefk6;2:6jrpjdwgn;1:ahfcinfk5;1:dh4ejyjfywmx;1:4jf6kmjh8oj4pgtwh3;2:aikjioois;1:5jd;1:7h58iv9hbak9dhdfkgjgskh0mjjnlgogtqilsilthbwgz;1:ahfcj8dj9egefiuhkijg4mjlrh2ujg;2:0gt1jo2gf3go5hb6gk7gp8im9fxbghdgeeisfgsghbhgvjfzknnlj3mlunlrol8pkrqgdreosjntgtuitvjnwfj;1:8j0;1:3j2;1:4hhiji;2:bkrfhg;1:9jffim;1:bh4cj5hhcohbpjzwjx;1:8h59jn;1:eix;2:8hacjkjhaqjtrgqwkf;1:cikggdjjrnitoheqj9rhetk5;2:chdhhbmjnwil;4:8h29k8bhfcheeglfhfll4oiyqharle;1:aiq;1:9hebiufk4gh9jit;1:3hfmkqwgt;1:aikhjauk0vhe;1:3gx5mp7kcahabgrcoieh9fgtjjiphgqh0rgwwg6;1:6lg7hbjh7uhavk2;5:1itgj7;1:0hg1h03k0;1:hhdjismjc;1:4omchbjhewhf;1:4jfpl8wh2;3:wku;1:6h6vj3;1:5it;1:0ko4gu8iy9hfjljoimwha;1:1j03je6hbdh8ejdjhgliorh6viv;1:0hc1h24hb5j07im9jxajkbircj0dk6ek2fg2ggjhgyjjckgtlhemh1nhgph9rlisjstgyuggvhaweg;1:djcrh5sijwji;2:9iodj3;2:ah6gjpjhdwiq;1:0hc3hg5j56hd7hf8iraj4bhgdiregbgk0hjdjk5kh5lhemhhoheph4rj3sj6th3uhfwjj;1:fj5;1:miw;3:2j2;2:fiqjhckhglkdnhgqk4uix;1:8h99itejr;4:jl7rgt;2:dherix;2:3k38kh9ffdj0eiojluqhcthcwfp;1:jis;2:nik;2:fiq;1:0hg4kv;1:qkh;2:njnoiu;1:biq;1:hhgjj3;4:gj4jheqis;3:hk1jgs;1:djmgj1rj9vhg;2:airgiv;2:jizwj6;1:dik;1:ah0gm7rhhtiw;1:8ji;1:mjb;4:1hg3gt4hg5hd6jz7gz9h8ajqbhfchgdh8ehffjwggzhhcjg8kgzljgmkbokxpgiqiwrgptgzuiswky;1:lja;1:2ilgj6;1:8k59h8eg5jk6;1:klzwhb;1:3ix;1:8hg9j3;1:3hahj3kheljspkl;1:1lj9jfoh8sil;1:jiykin;2:ogvpk0;2:tk3uh2;3:jiw;1:4kc;2:akt;1:wiu;1:sjf;1:ehhfk6wj9;1:4gt8ha9k7ojt;1:9iroim;1:0ij;2:0in1in3gj4hc6hg7kb8im9j9bh9ciudgdej9gfhjhekj5lh4niuogvqjgrj2tgtug8vj3wjb;1:einlikqhftjz;1:6iuwik;6:0hh1gb3gv6he7gs8fn9g9bfkcgodltesjfl3ihekgpmh7nheph1sh8th3uhewk2;1:6itdhfejftj9;1:dhdeir;1:4iw;1:9jknjluhg;1:7kodhdfgdghfuhavlm;2:6iq;1:fis;1:ajash3;2:2k79h8ejb;1:kit;3:0j96ji8hbklcmhcnh5ojsph3wh7;1:bjp;1:5gi6in7j0dirjjkphgqk4uh0vjjwhb;1:3h67habh1dhhehfggzjkamhdrnnsinuizwiu;1:8n19gjanobhbch5ehhffogkuhhbkhcrh9wgn;1:eix;1:iiokhclkonhfphfwjj;1:8h4jj1olepfssj5wir;1:jj8lkl;2:4k2wh6;1:3j74je8ip9h3bh5dhbeipfh7gj7hivnj0rj5wgl;1:4hbaivbhacjbfixphfwkg;3:gj0;2:4my8h9ahdbj9ekhgjwhiqjhdph9qhargnth7wgs;1:dhfeiz;1:nkcpj0;1:9jwbjfkj8uh0vjcwgw;1:8jaaizfherik;1:albbhfdiwghcjh3riysk6wh4;1:ak8eiufgw;1:0hb1gu4it7hc8k49iyalsbjydgsgj0hl1ih8jilkgvmgzph4qgdsh6tgnuj2vhe;2:8he9ix;1:cjzjha;1:6hd7hgbjgdjdhh9phfqh1rj1wlc;2:ilb;2:1h63jm8ha9iqdkcehbggqjl8qjgrh2wh2;2:4iy;1:7j9dgmej4jhgkk2rh8;1:1ha2hd3gs4gj5h76hb7gx9kebiodiwhh0ih9jjymguoj6pkxviqwgn;1:fhdukm;1:cj5jha;1:0hb1je3gz4kd5gy6h27iu8j49gtagebgpch9dhaghbhgujgbkkell8mgynk1omcpj3qgetgvuj6we4;3:1j43ir8hd9h6biodh4fjpkiuliunimqharhbtjtuj4vhfwgx;1:einwj5;2:5gw7kq9h0ch1ghfjhdrlash5wjz;1:tjl;2:3gs6h37j98g89hbfhdgj4hkrjl2mhfnhfohdrkeskbuj3wfo;3:eil;1:miy;1:8gqqj7tjl;1:1ha2hf4ip5ha6h97hb8fv9jeag6bnsdhaeghhgsih8jhdkgvlhdmh2nimok8ph0qktshetlougkvhgwk0;1:1h63j55he8h2dhfehdfj7gjzhgwilwjhbqkyriqth7ugo;3:0h91gk3jn5gj9hcagmgh3hnojj2oikphaqjwuj5viowhe;1:mhgnj3;1:2j6qilujb;2:pk0;2:8h19kaghghim;2:kin;1:0hhikhqj5;1:ej8;1:giuukd;1:eiqhilmiksil;1:hgfjkvrjmwh5;1:1iy;1:1h64l09imogp;1:8h9kgpnlg;1:3h75iu6he7hg8ef9kcagjbgaclddhdegjfgdginhjdkh5lhbnjnrk6tizugqvklwk4;3:jjm;1:5j57loiirqhg;1:rik;2:0jx8h2;1:jjx;1:0io8hfah0bingizhk0ljqwh8;1:bineh4sjtvinwjg;4:1ha3hc4h45n79jhajnbfpciqeh8fk5ggxjhelh0nj0oh2ph0ugtwiv;2:0k96h6;1:8hc9ir;2:9k4anbbimeh2gh4hh9jhgkharh5ujzvikwh2;2:bis;1:aj6dhgfgwglwjheqkhsjpuhawgq;1:3j3hkijh7lim;1:7ji;1:1gy3ju;1:dhcfj9;1:8iyrim;2:uit;1:fjt;1:0iz;1:8in;2:0hf4h9aj8bjveiofivgglhhdjh8kkbqjzrhfth7;2:biy;2:ejksil;1:pin;2:7j08ikwh4;2:8is9hddj9ehbukb;2:vim;1:0gx1jb2ha3gp6gv7gn8is9iybipchbeh5ggsihbjglkkmlj0mjnniqokjrgw;1:0m41gv2hg9ktahdbitej0fj7gh7hiojhckhgqhdwgp;1:jjarhf;1:0gm1h3njqqkirjtwgw;1:4jg;2:9hgrmmuhb;2:jjg;2:8hebk2;3:3k0jh0wkg;1:4kpgj9hitwhc;2:8jewir;2:mjc;1:ujp;2:0ixcknfhf;1:jj7uhhvj7;2:ij2wk7;2:5jr;2:aim;1:wjo;1:8gz9kqul4vgl;2:qjx;1:1kcik6kh8tjc;1:ej7;2:0h71hg2jx4j75kk6h77js8ix9g3bhechdehdfixjfflikmhfojrpg3qgzujhwj3;1:4itahfok7qiluiq;1:2ik;2:ll8miknk2oh5pghwhg;2:din;1:fiwghc;2:3iz4k76hf7foaitbh8ciyehejh5oh9pkhqhasiywl6;1:nj3wji;1:wjs;3:7ivgjmjhg;1:8jq;1:4il;3:2iu3im8heagrbggcncgfvhjcrkhwhf;2:piz;1:ajcfh2lggmmznhdphb;2:aik;1:6iwjltkhamijwge;2:3k8ak1;1:8imhip;2:aiycjg;2:fin;1:9h0bgfcj8ehgfiljh5piork2thfuhavlhwit;2:8iugk3;1:bhflhfnjwwkl;2:vip;1:fhaglkwhb;1:0k7cimwhb;1:0hgajjcirdj2eh4fimhj0kk9mjuphath5wh1;3:6jf8gfdlwekwgh9rgytjtuh6;2:dj9;1:8hedk5ekfgk0whe;2:dj4;1:3hg5ja6mg7j8ah7dhgehgfh3jg9njhph4qhevn5wgo;1:7jcqjd;3:2ki5jn8kv9g3ahebgmjhfkivwhf;1:fhggotih7jgwlimrhbwhg;1:jjx;1:8jlvjdwhd;1:3l4;1:jiv;1:disehd;2:3hg8kr;2:aiygjn;4:0gp1ks2h53h04g15gu6h27h78ik9fvahabh9dilggfihejh2klnllsmiqnmhodtpiyqglrjvsjeujsvgswga;1:0hgilhwg6;1:uil;1:egjfk8;1:cjkfhf;2:hiz;1:einfiqqja;1:9gvdlkegd;2:jhcqlc;1:jix;1:2fi6noqhfuhcviwwh8;2:ej1;1:9jgehc;4:5lughbjjywhg;1:jj5qjfsj7;1:1h97hd8hb9ogahbbgrdm7jh4khdlh8qhdrj9uhawg4;1:1hd6hd8hgajdbh0ch8ehafizgh2hhejhekh4mh9ohapniqjerhdtouwfy;1:1hdrjd;1:2hf3k78h3ckighfjipqjjritwh2;1:4hf8gv9haahebh9dlken4fkxghcrhethgwha;1:4kb8h29heegtgirjh4oinpj5qhdulgvjvwil;1:1hg4m06h8aj1bhbcl5hj4jjsniwph2qh6rgjthcuhdvj6wg3;2:gio;1:3ha5lb7kqahecitdhggh5hlkjhbqh2rixsimwgr;1:wiq;3:jip;1:0f93lzaiucikgiylkfrh6silwh4;1:0kw4m55h56ks7go8k59h9ah5bftdhcfgegikhixiiyjk0mh0pgosglugxvhewf9;1:niu;1:fjbhiujglwjn;1:8l7;1:wiy;2:ujq;3:bisjiq;2:2iowj5;1:2io;2:1iqdj8;1:hjhjhh;1:jkg;3:8h5aiwkj6;1:ehgfjbhkxugx;1:2iwuiz;2:8j3;1:3k74h85in8h49h0bhcdizijhmhfnjqohcphbqituhfwkw;1:9j4;3:fhgljrqiy;2:viv;1:dhfeiz;1:qil;3:bhachcgkosiq;1:dheej8;1:ag6sjqul5;1:pir;1:0h61h73gx4hb6hf7hh8g49gaao2bgccj0dgaeghfpdgjnhkpjfzkkqoh8ph3qherhesh5th9ugtvh9wjp;1:0ji2il5hd6gx7h98my9lfahfbg5cgidfzenhffdgh1hh6ihdjfukhdmhhoj7piyqj7rj1wgs;1:kj2;1:wk0;1:qknwhe;1:0iwcjjfjzkh7phg;1:8h1ahefgogqfrh2whb;2:uj9;1:hhdjin;3:9k3ajyblwehbfhfghejhfkj4nhgrheuhewhh;1:8kiwim;1:kjb;1:8imrjd;2:4h55jj7he8k2agsgh5hh9liknmiojnrhgwh2;1:pjq;2:wjo;1:4hgija;2:8jmwip;4:mjt;1:ajkgh7skj;1:9jgehc;1:4iw;3:lhfrk6;2:0h71k13h06h87gq8k19jhaj6bhecj3dghfh7gj7ijejixkizljmmh3ogxpgpqhdrjasgruhbvh2wg7;3:aghejofl5uh0;1:1jo;3:1iraj1iik;1:7kz9gybindjgeh5gj3hhbjhckgynj4okpphfrh7siuth1;2:8f79ludjmjj4;1:8h5kj4;1:pk3wha;2:fil;2:9hhaiobj7eiqfhesiv;2:0hb1il3hg4hf6kq8j8ahabh2kghlm6ohhqhbtjxwiq;1:8j5;1:fim;1:jje;1:ciw;1:ahbbijdhceimghckh8mmkogrpggqk1wjv;1:bim;1:wio;4:0h31lv2g73gn4gs5hd6h17h58io9gebfndhdegzggphh6iipjglkovljcmlznl7ojgpj6qgurglthfvhfwfz;1:1jllheoh3piyuiu;1:hiyrj7;1:6hh7jqwhg;1:aisjiw;2:wik;3:8j6fiq;2:4kk9jhdpfed4jgnoj4pgzrhguh7;4:8godh7emb;3:cjr;2:4n68jejgikhdmh7nj0ofzqhgwja;1:3kgeilfgznio;1:8jwdhg;3:hiz;2:2j6kirmll;1:5jn;1:1iy2m98h5aitcisggqjj3njmrf6uimwhe;3:3io6jm;1:3hc6lf7hc8ju9h3ahbbk1dl8ejwffjgjhkhbrh4thdvjswf4;7:tip;1:jheoivqkouizwgw;4:3he6ha8jf9j5ajiuikvipwiw;1:8h7agsblscj9egifl6lhg;1:6gl8gjdiqekzujwvjf;1:fjvwil;2:ej9hh0qh9tku;1:gh3hixniv;1:6h0vkj;1:4je;1:ailwje;1:1h83hd6hb8jaajsbkucl4dh2eitgjmhh2ihgjglkiolh9nhfohaqkgrg4th2wge;1:5j87mf9hcaiobkghjhjgsphfqh2ripwge;1:0hc1iz2hd3l84gm5hc6gs7gt8j09h1ag7bgxch6fh6hhejitkmwllpnm4ogopfjqjitgnuiuvgtwen;1:hiq;1:7iw;4:1gw2jl4k36he7f08iq9h2ajnbguch4ejxgglij9kghljbmiknh1pgoqgarilsgmvkmwjl;1:eil;1:4j5jioliqoij;1:6kawh8;1:1le2foogxqm5;2:qjm;1:1h92jp3h74gj5h38iz9j2dh5emahgijgpokgph0qh2rqithcuh4vh4we6;3:2jhlgtrje;1:hiyjgorjtwj1;1:3gk6l78iw9jmah8bhfcj9ghchgzph8sh9ujyvk5wh7;1:8h39jj;2:2kf3gv6hf7h48ha9jdagpck8dhheimfivhldihejlokgulhemh6nhfoh4pgtsh7tiuvhbwhe;2:3hgil5pinwh6;1:gj7hj6rhc;2:1iw;1:1gw3jj4j19jvaiweh1ljioh9;1:ajqjiokgk;1:2j6;1:8hgtjw;1:hj0rj8;1:4gn6gp7ku8gb9h4akjch6dhfeiufgiglzhh3ih5jgmlhbohhph9qh0rj0sk3thbuk5vka;1:cmirg3;1:0iz4io6h97ky8jf9gvbkueh1fgphh0kgblh3mh4nh8oitqh8vjbwg7;2:5iy8jd9hfbgsch8fhbgkzjhbqhhrk4tmgugswha;1:4kvihdjhcqh7wjh;1:pis;1:pjm;3:5khwim;1:mj4pkg;1:jj2qit;1:0h61hd3he4ha6hh7j59hcch1dsqel6ggkjhekixlhbmhcnhhoheph8qh7th2uh4vijwg5;4:8ipaj5fj2;1:mix;2:fj0;2:ije;1:sil;2:0k39jqbiuch6dhceh5hjvjiuqhg;3:cizjj2;1:ahagiyjg2qjrsjfwjx;2:hj0;2:fiy;1:hiz;1:0k4dj7jhetjwuhf;1:eiu;2:wim;5:0ha1gs3il4h35ip7im8ffagobjuegzfjzgj9hgrih5jgxlh0miqnkspkfrjqsjdtgyvhdwg0;2:3h87go8gn9joah4bh3fh7hh8iirjgjmhhqkurjoulxvk3wgp;1:2hfhh9ujvvjb;1:3hf8lo9kvbgrgh9hisjhdrjpwj0;1:9jjffqgmv;1:0inbgzijhkl1whb;2:3j8mmppixqhdrhhthbwji;1:wjy;1:8l39gsjh0;2:8hgbj7egsfheglphhakhfpharkztl8uhfwh0;1:6h6uk9vkxwh5;2:1iy3jn4h66kl7j08gqbgcch2dkuekiflggfyij0jgekg9mh3njjph6qgurgfshetgbvhb;4:ojbuiowjf;3:3j8ajbcgp;1:cj4jinwhd;1:0ji;3:8j7bjarh9;1:bh4eh5gl6hikqhguj9wjl;1:0jo6mthirijwjh4pfoqjbwgi;3:0ha3h14h96h78hgagjfhbgjeihcjmekjrlftohcpliqh5rfrthfwls;3:cj0;2:mis;1:gj5hiljhf;1:ejsuh0;2:wiw;1:4j7;3:1hefimjgwmliqhgrgbwl9;1:bjrrh6;1:wjo;2:sjf;1:4isairqimsgw;3:2kg5j8jgyqitwiy;3:aj6ghe;1:8hgaisciveiyfizrha;1:1hd4he5k76k0ah6bipgjnih3jf7khcqgorj2ueyvnkwh9;1:9it;1:bjddggek6khf;1:bjnrgwsio;2:9ivchf;1:njtoj9;2:8j5jhfph1qocwgw;1:8j9airfj2;1:nj2whg;1:9imsiluk4vh4wja;1:4im9mzbhcch9eimfh3giqjh3lhaohbqhdrkxsj4uhgwgt;3:wj8;3:0irrj6;1:4it;1:0k32fn3gz6l2ajqbhadjiegjgiohj3uhaviywgv;3:4h7diweiwghhok8;1:4j7rio;3:7m1fjcjh9wij;1:dj9okpwhf;1:8io9hdwje;2:5gz8hgcjjwjl;1:8j2;1:5j48ed9m8ciywhg;1:5iz;1:0j44ghili;2:aim;1:7kkpgpuj4;1:bj9;2:0h71k93h34in6ha7gn8l59iyaimcjbdgbfgzijmkj9lj4mh3ogzpgrqhhrjzsgstgmuhevh6wgh;1:0kn4gx8iu;1:lis;2:0il2k53h94ix6fj7k18h49heahach9dh8ej1hitijvjjdmhfnk5oh8ph4qh5sjmtgzuh4vjhwf3;3:jgtohdqks;1:8kw9gdaikcixikdwhd;3:6ll7he8k49imehahixqhftgtwhb;1:3gzthfvm1;9:gixhhg;2:1hf2in7hd9ivahcbhfditehgfhdggbhj4iipjgykjolinnh0oh6ripshgwkh;1:gjgkik;1:6js;2:rj5;1:hh0rj9;1:3jgcjqejgghehiywgh;2:4j1hk5jj6rjc;1:cjurh1wj3;2:2h57j28j69jidjeegzgjphiwjirqhhrhfthguhewgy;1:qj2;4:bgzkl3;1:kim;2:0jm8iykjbriu;2:fjewhf;1:0h91h54hg5h16kl7gi8jk9h1aj4cipdiveinfiygjjhkrjemkgilh8mh4nhbogvpgmqk7rj6sheth1uiuvkkwfo;2:wj3;2:jjg;1:6lgfiqjhcsj5wh4;1:cjogjzhikqhdvin;1:wjg;1:ah4hj2ijxrix;2:wjq;1:riw;1:8isbjjcjyeilgjyrh8wh3;2:aj7hiu;1:jgnsk8;5:eim;2:0s73iq4h96hf7gv8is9gvagqchcdh7fgugixiizjg1kiylhcmhbohcpggqj6rjlsjsth7ugwwfk;2:1k9;3:4h9iivjhgmlotjdwh9;2:hirsis;1:1jt8ke9lwegzrhfwhd;3:aikbipcj6hjamhfrkothhuh5;1:5iwsij;1:4h9oka;3:mij;1:2hf4jhchgkhfmilnhgoleqj1rh0uh3wma;1:tipujb;2:ghbjjf;1:9hacj9fjd;1:7h79iobj5cq4dh7ghahhbjiwlh3nhbohgph8shhvhgwgi;1:6ls7hg8k59gsaimpgzqhdsl8wg7;2:7j4jl4lhgmhgnixol0pgwqh6;1:0hh1h59jjaj9hh9kj8mikoiwrjash8;1:ohgwkl;2:fh8hjmmh9pjarh6uhfwkx;1:3hd4hg8lh9m6an2bkaeggfgdggqjgpkjtlhgnheoilphcqivrgtugjwg4;3:dhaejrghchk6jh4rg5sirwko;3:wim;1:diw;2:0hc6hgkisll0nlmogoph3wh4;1:3j0qim;1:6n17hdjk6vdz;2:0h61ha2hd3hc4h66hd7k28ke9hcaimcioegwgiyhitihejghkhdlh7mh8nh8oilpijrkksj4uhcvh4;1:3jewhd;2:egnfjehirrhg;1:1hg4iybgwehgjhakklmh9ojdpk5tliwgm;2:hhapjmwgx;1:4jm;2:eis;1:cjxrh1;1:9n2fjaghgres;2:8kiwhb;1:8ix9k1ajpbl1cjueh1fgjghgjhgkjlnherh5wh8;4:sin;1:1h8aonbhecljfjcggdhghkhanhfrgasknuixwgt;1:0ka;1:dj5jji;1:7knpgq;1:mheshgtkk;1:ij4;2:nj7;3:ahfehcok9rjj;2:fipjjpsh4;1:ckdeh2;2:diweh5;1:5j96je8g0ahabgicilehefiwgjvijijjfkk3litngsoj9pfqtgwuhhvhcwg2;2:9im;1:hh6jiwpg5qmurh0tjkwhb;2:niqqij;3:ljhpj2whd;2:9iwggvhjvlgqrl5wj5;1:9h8ajvbhbjhawkh;1:7jw8h59jakip;1:0jm;1:5l38h0fh9gjqjj8phgqh3tn1uhf;1:ekmgh8qjktim;5:8j3cjrgj0hgujjv;1:0iz4hg5iycinjgaqhewlf;1:6j8vgy;1:2kb;1:ohapj8;1:him;4:akhgh6kk1mheoikrgs;2:8im;1:gj8;1:rin;1:8indjwfhf;1:0h61h67ha8iy9iqaggbmfehfgjzhhejkakgsqjzrg5sjpuhgwgn;2:jkuoh4pk5qhewju;1:0he1h28h49neaiybh3ch5deuemrfjbil9jgqkhbphdqhcrfvsiwthg;1:giu;1:5qnjhdwh5;1:1gq7gw8le9j8gmukh0ugz;4:6ja7jaaimbhcgilniqpkdth7wgi;1:8dt9mkghgpixtix;1:hji;1:dipuh7wki;1:6izwij;2:gjeljqnhgqjlwhg;1:1h0bhachdghahiminrjhblitmimrjtuhfwhb;1:iiq;1:8jrbgtcio;1:2jp3ivchgdjgfh9ggxhgujh9khblh1mjqnk7ojoqh6rk6;1:wj5;1:9mtfh7gjdrh0whe;3:fjsjjb;2:2jicio;2:cj2;1:0h71g82jg3gx4ix6hb7gs8gs9hedh4fhchh7jkrkgglgzngxonrpj5qkjsj5ugxvhc;1:3hf7hd9gzaj3bnscj0fhagh3hgxjh2km0lh1mjcnhcogkqgvrhgthcuhgwkp;1:3iy8kjbhedhcej1iirjh9qkguhd;1:2j83gz4kgfhgjh2qhguhawje;2:9goaimbh5cjpfhgggqjgmmg9nh7pn6qhcsleuikvk3wj7;1:0jm7hdahafjsgh2hgxjldqh9thfwlc;1:iitwjl;1:dis;1:1lw2jq4it7j6ahgbh5ch5fgzghdjh0kjjllimh9ogxph7rg6uiv;1:8hfglawhg;1:5iv8h49keejofhcggzhisjh4wjz;1:9izsis;1:8ipgkbwgn;1:6js;1:2jx4j27jgbhfjhakk4lhhohdwin;2:0h8ahcfkyjhfqjjwhc;1:6hb8h4ah5bgofhbghhhh7iiwjhcmhhnivriyunnvkxwgw;1:0hh2h53hb4il6l97h88io9hcbkidh8fimhhdjhekisnh2okapgvwgj;1:hjc;3:1gz4hg6h48h3ajabiscivfgxggphh7jkzkgxlhgmhbnhcogwpknqhark3shetitujqvkgwgh;2:0j11j78hhqjyvj2wji;2:iim;1:hix;1:0h71h52he3gf6hd7h08m09k1aglbldcfyfjdgjkih6jeykgvlhfmitnikoizpg2qkmripwgc;1:8ls9hdehc;1:qj1;1:tiw;2:jhaqkprio;3:1h43j26hg7hd8iu9hfakacjwehgfkshimjgulimnhauhcvhewh7;1:6kr7ldphdqh2whc;2:5j5ej9fjmgh4jixlkqok6wgt;1:6gyllmnhfvki;1:air;1:wk4;2:dimsis;1:8h09jyah5bh1ehcgjbhilujt;1:0j34hf6ioql2;3:5ivrjpuiowgr;2:4kw8gv9ladkaefdghfjgxriwuh7whe;4:nij;1:gjo;2:ak0hh8qiu;1:ehcfgygm4hizuhd;1:bimuir;2:8il;1:9it;2:wit;2:gj7;2:5mi7hcmh3oj9qhd;1:8im9hghj1;2:9hfcj8;2:cjfggn;3:hij;2:ah7gjlhjb;1:ghfkh7rl0;3:fk7;1:8j7giujixlhfrja;2:fhbgk8ljfqkiwh4;2:8ki;2:6j2ehefjd;2:hj9wim;1:4ip8gh9kaahfcnwfgdrh8;1:1hd7jd9h4ehcfhfghbnh1qkluj3wjn;1:8iu;1:oiw;2:8jc9msahadh5efpgh1hhdrj1uiwwj8;3:wix;1:din;1:kj3;1:qkcwhe;3:pk3;1:9gtekdjhg;1:7iywjp;1:6j7;1:rjm;2:wiw;1:3iokh2mnc;1:kkyoivuj2;1:cim;1:1is6hfdjkehgvk7;3:agsbjciju;1:einfiotikugzviw;1:kjt;2:wjh;1:eix;1:0j76iqrhcwjj;1:mghnlh;1:nix;1:gizrhe;2:8hanlbwh7;1:1k4chbrj6;1:dikehfojfphgrjy;2:8h69ipjja;5:ajj;1:chfjj3qjtriywhe;3:8hbgk6jhgugxvj8wjf;4:1he7irghhjitkiunh5qj5wkg;1:gjrhgrrjxslmuhg;2:4l3bhefitghejgqkgzljynkiphgqgswja;1:pj7;3:tiy;1:lirtiz;1:9l5aghbhccizfishhgjitnjxrjqwha;1:gj7;2:3js;2:cjnjk9;3:6hdqk7;2:bj2;1:gj3;1:kimvjn;1:pk5wha;1:3j5;1:8iqbkfdixehcfgymhgtktugnwha;2:0iu1ir8gokkrrh5wjl;1:8jh9gaahabkwcgpfmfgg5hj1jixkh0og2pmeqhathfwgu;1:1hd8hhaiubh8gk3hiyjh6qhfrk7sjtuj6whg;1:ahdbj4fhbggrjhdkjbljkqj1rgrwke;1:aj6;1:0k61kv4gzeikihgwje;1:8kt9hhhgxjk2wh7;1:0hg3h76h98j99imagqgj8ihejjmkijlg6niqpm1rf0wlo;2:lk0;1:3ha6h78iz9iudjfegfqinrh9thbvl5;2:dis;1:rjn;1:wiw;1:8g6eknmjb;3:8hfck4dixeimjgzmjmqherh8tjvwhg;1:5izjh0oh1qkjwj4;1:rj3;2:aikdin;2:4jq8incgyjjwnilwhd;1:5j2ujk;1:rjowh6;1:4jt5iv9kqdhejhhpixsj6uheviowg6;1:dhdejruh9;1:0kh6h58mf9hbjhgphgqhc;1:wjp;3:3ik7k6whf;1:ukd;1:eizwjv;1:cjj;2:8hdukf;1:6jt;1:8j5hiujhb;1:3jo4hb5h98gs9gpanfbgieiofnfhj6jgrkgilhfmh5oj4qilrgothfuh0vhgwg3;1:gkfqhgrgwwjd;1:alsegnflggipuh9wh8;3:al6fgm;1:1k97h8chejjerj7tjuwhc;4:0iq4k95lojh6;7:ain;1:rf7wlt;1:1hg3hg4h75l59jtajobg6ehbfj5gh8kiklh5nj9ohcphhuh2wjk;1:win;1:tix;1:hgyujs;3:hjfjgz;1:mj3;2:1l46ilahabgtgghhhbiixjlkkhcph5qirrgssiktgyug7vjowlx;4:rin;2:8hc9kkagz;2:8j2rio;3:9jn;1:cj3;1:7jsjgr;1:wk7;1:8gw9j6;1:0hf6hgaj9bl8cgpdhfeh8floggchjajgdkggllcnh7oh2pj1qinrg9th9ukbvgtwj4;1:jhdqjwwhg;1:bgocn5fh6rj9wg9;3:0iq8gp9ivcjg;1:8hajk4mjb;1:wj0;1:gj1;1:3iyaiybh4;1:8j5mjerhd;2:0h11hf3hf4hh6hb7hcahggh7jglkh5lk7mplnkuoj6qh8sjotheuhfwg8;3:sio;1:jgwqjq;1:8hdaj6ghghj5jgbqj6sjcwjp;1:0is;1:oj3qj4;1:iix;1:9iurjv;1:3h75mx7jzahabgtcoleilfgtghdjgtqhargyuh2wh9;4:hir;1:8h69hbbgcchajgxlh8qhdrpwwkk;1:wim;1:mkcrh6;1:9kk;1:pjf;3:oke;1:8gy9jmaiu;3:tipujj;1:1hg6h58gm9jvahfbhccmuehagh3jlokhbljjmhfnisohfqhdrg1thgvlwwfj;1:oiq;1:8gwuk7;1:bgjfj1jmirj1uj7wh4;4:8hajk5;1:0kb8gs9h0bhech0dhfjh1kjoqhdtkeulpvjuwgp;1:9kyej3qiv;1:8h9gikjh9rlawjw;2:him;1:3jz;1:tix;1:mjh;4:8gejhauitwmm;1:1hg8h59haahbbhgdjffh6gg0hq5jkdqiqvitwgf;1:4is8h19jpsin;1:cj2fh6phdqliwgz;3:gioij5wjt;1:3jhljwnh6wiw;1:5iqbh8rjh;1:hipljh;1:nij;1:qjw;2:lim;1:ejcjiwqjjwhg;1:qir;1:rjc;2:0iu8hecjvfh1kh9nitqhftk1wll;2:8gy9k5biwdh4ek1jg3wk6;1:3jvkjslgnwj0;1:qiv;1:rkc;2:vj2;3:8h6cj9;1:jhfwjr;1:7jgjhdwhb;1:8juaheujj;1:ahefhcgl2ril;6:dis;1:4l1jhaoh4phcthfwl3;2:gjbhh1;2:3h38imaimcj6fhfjh0lkwpjtrh0sjnwgc;1:8j2;2:jj1;3:1iwrhguis;4:ck4fmgwh3;1:rj7;2:8j8;2:ajgeirujt;2:wjg;1:ah3cjyfjhjh2slcuhawgs;1:aj5fjgkhc;3:bhadirkn4wfw;2:0h9kitoizwk7;1:rip;4:2k3;1:hiw;4:8in9itajkbiycj2diueh3fj0ghahh9jizkh9oj9ph3qh0rh3wjv;1:1izhfxjk7;1:dj5eh1rkqujawhg;1:dkweg9;2:oiywiu;1:0h63io8iqoil;2:gis;1:8j2fhggk7jh8kj0pj5rh7;1:3in;1:wje;1:fh3uj3;1:4jkdilgjejheqh7;1:5kq7je8j29h9aiqbl4chaegzfhbgh1ikmjh1phfqh1rimwgk;1:uinvjr;2:0hd1gj2ks3jr5jd6h08io9fmailbh8cgiefvflngg0hkhjipkgolgtmgwnh3oglpgpqg3riksh6tjwulzwk5;2:2ir5ir8ix9h5ahebh7ch1jj7kl7oj5qhgwh9;1:2kahhgjgoqjr;1:1lrkhgwhb;1:mj3;1:qjptjs;1:1hb2hh4jgchfjgxkh9mipnhhonhpheqjdrh0uhewk5;2:ajfoj9;1:3hg8j8kiknkcpha;4:jhewjb;2:0h81jj8jcah0bfvekakhgnniokfph2qgrrg3uh9;2:cip;2:1j22j24hc5iv6j67il8k09gwchddh8oimqh0th7vh2wij;1:win;1:4he5hg7g99iqgjfjl2pjnqgzthdwk5;1:3irkin;1:8m6chekhf;1:dhdejg;3:kj9wha;1:anfbhgckdfjeggehgwkhcoiwphhrgtskjuivwgy;1:wim;1:2iz3ka4iy6h67hfbijeh8gj0jl5kh9ohbpl5qgyuhdwfy;1:gkf;1:7h98jheh3gh6jiwlgtqh2rj4tl7uhewjm;1:tk3;1:5l8qlbthcwh3;1:ajrfhckhe;1:cfujh0kirpkfrkb;1:3hecjpgin;1:hk1;1:3hd7hc9gralebjrdhcekgfhaghbhimiktjewoheqj5rh6sl4thbuft;1:pj4;2:2h5oj1qjn;1:cj0hj3;8:akt;2:2imoj6;1:0h81gz2h33iv4lk5h66gu7ik8k19ivcmcdh9eh3ggoihejgmkh5mh4ohbrf9tikwkb;1:eiu;1:bj9;3:4ir6g18heck3giqoj8vgvwky;1:gh7qkvwh8;2:miqpk1;3:gin;1:3ikmis;1:jir;1:5ksrh4whe;1:eimwjt;1:anqrhguip;1:1jbwgy;1:eizqjm;1:2ix;1:8jsah5;2:9gddkneh6oiv;3:ml5;2:8irjh8qjq;1:ojq;2:hh0jjr;3:5ivdkjwhe;1:3hf4jt5io6madhfhipjhbkhfoh2ph0qh0rgxtheuk4vlmwgq;1:6iv;2:9iu;2:5is;2:8jzhgrlfvrm4tjn;1:fjjniytinwh1;3:3m4;1:kj5;1:ej7;1:aik;1:1he4kdfisghhjhdlilpjyrilwhc;3:cikdgfekgfgsgmsrhctjduhf;2:9h2ak8bh3hivjjhkipqikwh5;1:ohcpkc;1:aiknix;1:0in7k5titwhf;1:fjo;1:6ji;2:0iw1ke;2:8hdkk8;3:cjmjizoiy;3:1jk2km7k8dirqgyrh1wgy;1:direiy;1:5k3ajnshc;2:ok7;2:7ixhiq;2:0hg3hc4im7hc8ghah6cgxgj3jhckh2lhfohapgxqjgrinvl9wmn;1:vkh;1:tin;1:8itfirgj7;3:jk5pjv;1:ugvvjc;1:1j62jq3gz4lsjhfoizrhcwhc;3:2k78io9gtbizdjahh3iiujh0;1:vj2;1:8gkajhujiwkk;1:3j65iu6joahabivchdfj1ggghhgjj1kjhlhgqdtuh5wil;1:8ixwix;4:dirfitwix;1:0h91gv2he3gw4io6hd8iqbj1cksdkieimfj7ggahhgjitkjmnhdol0pgarhbskqtgtug7vhewfj;1:0hb4it7j1whf;1:wj1;1:8ik;1:vio;1:8j1bh0kk2lhg;1:2jhcio;1:6hh8kn9fnaj9bh5ciudk0fl6gg1hhfjh0qhdul8vj0wg9;1:4k07iw9iqdirjhaqhfsj0;1:2ix;3:sk0;1:qk5;2:qiy;1:wld;2:4ij8hfak8bh2tj7;1:cjylj3shc;1:bh8fjxpn0wgl;1:2j7;2:tjhuha;1:3hf8kp9lnalnbkmegtfgrgh7jgrkjfoiqphfqj4rgxshhuglwge;1:1hbdhfqheujowl2;1:9ix;1:7j1gik;3:hj9tiswh8;2:8hchjp;2:ahffiz;2:0gw3gl4h55h36nu7go8f09fzagibfwcghdnhepefm8ghfihajinmj0ngspgeqilshctgnugawg7;2:2hc4lv7he8h89iybg9ghejmuqherirwh4;1:8j0;3:1j06jubgpchfdioeh1jh6rjuvh6wj5;2:1mzfhdgh0himmiqoj6ph1wj6;4:gjs;1:8h4piluilvjl;2:ahffit;2:fj5qj8sijwhd;1:hjx;4:0k28hd9jdch2djmeh4fhcgh8hjzqirtivuhdwh0;1:0iw;1:iik;1:rnjwfb;2:pj9;2:vis;1:cgtjk8;1:jj3;4:cinffygnrjgdsj8whd;1:9in;1:9j5;1:9inkj4;1:3he4hb6hd7h58jrah3cl4dh9fjxgiqhgojlikhhmhhqgprfdtmhugk;3:bh2citjkppgtqj4sj4wjn;2:tit;1:tkqwgk;1:ej5fhggk6jil;1:jislj2ske;4:0hf1k26hc7jx9giahfbinch5dguel0fgjgmnjfckh6pgqqjcrjatiovhewhe;2:firghd;1:al5fh9gh7sjf;1:djemjg;1:8h19jfakfbj7ehgkk8nhaqj1uhc;2:9gicipdk0ehalir;1:6h9jh2plhvka;1:win;1:hjyjgxqhgtj5ujfvk7;1:1g3agudgzek4gpihgojjbqj6rg9ujiwgu;1:0j31gw2hb3h24ha5io6gw7h38ip9k1ajibjcciwegfglfihgjgilksmh4nh2ogipj9qgrsh8tikwfh;3:niv;3:fje;1:bj3;1:hjq;1:8hf9jyait;1:ghajk8qjvwhc;2:kheljvmj0niqoj1sipwgp;1:1hc3h14h47ha8j3ajdchfdk2egxfgogivhjeihdjgzkgmmilqharjfsj0thbwio;1:8j1cjbdh0ejqrhb;1:8io9ipagxdgmelwrghsj3;2:chddjbeh4jiyqhfrk2sj3wiq;3:iip;2:9jl;2:6il;1:uiv;1:1j45ijah2ehhfhegikhipihelj2qj2whf;1:2m87h48imaj6bggfghgjyhknjkvqh0uhgwfo;1:jjaqha;4:fk7oh6qkhwh5;1:5h4jhbwm9;1:8j1aj2hhesiu;1:aik;1:ej0kggnmbok0ph3;2:cio;1:ohewjr;5:mjbsim;1:1h13h26h47h38ey9g2agobfrch9dmveswfm1giujiqkgvlizmh9nhfoimph0risth8ugxvhfwf1;1:6owvf6;2:4iu8jb9k8;2:wj8;1:jkbph8;1:ak3;1:9h4aivbj1ejsrkeshcwgt;1:6jlikzpj6wh6;2:sisujfwj2;1:vjj;1:9j3;2:8jb;1:7h78ir9jhahgbhbhj7jo0ogoriqwhe;8:0lslh8whg;2:aljkgdwil;3:qiz;1:7jk8hg9jaggjhixjiuqjpthc;1:1h84j6ajcggshikrke;1:ajihgtmisqjv;1:diujg9qjrwjl;5:uiu;1:qkfwhd;2:ehbgjlrhdwk6;1:igbrkmtit;3:8grghfkkcll8riswh2;1:0jo1pu3ki5hb6h67go8gz9j7ag9bkgcgzij4jfzlgwmg4nggokdpfxqjzth4ugtvh3wg7;1:4hg7h48hf9gvah3bixch6dhfgh6hg3ijhjgdohgph8qixsldtpsuj0vh8;1:6ojvbj;2:jgswl6;1:jh9kjtlgnqkg;1:dis;1:3jc8hhaiofh6wjl;2:hj1jjy;3:1ixjilrhf;2:wis;1:bjscjdjj8rhfwhb;1:9hgjl1oh7tjswj0;3:9k8ehdjhgojdph5rj3;2:2in4hb8io9isaksbgwch4dh0ejegh0jh5qhgrjitguuk8vjqwhg;2:rjb;1:lirnj5;1:mka;2:3js;2:7gxblefisoilwhg;1:dio;1:jj7;4:njk;1:pin;1:gh1hji;1:hjx;1:1k9;1:0ha2jm3m44lf5h66gz7hf8is9gzah2bhedh8ehaggehh3jh2kk1mh9oh4pgmqgwuf8viwwnk;1:ik1;1:9irfh9hkvugz;1:0he1jc3h97gg8ha9h4agjbj6dlieg3flxgiuhhfihgkh5pheqilthfujrwgs;3:1il3o5mj6rh3wh3;1:nit;3:9jvcgooix;1:8j2;1:1hggnajhgqk1rgotj0wgq;1:3gz4hf5gy6ha7gh8jcahdek3fk4givhhdiikjiykh5lk6mgungwogxrhgtkbvhgwiv;2:egqfjhpis;2:gj0;1:8jmnjxpjrtjtwgt;1:9hfhgorlp;1:8ga9jpdiy;2:9ilehfmjgqharj8wkc;1:6l87h9bimijxjh8qheuh8vk1wgx;1:1h73gy8jf9k0akmbkxchfdgzehbhikjgfqgtrgpsh5th9ujdwir;1:rj4;1:niq;2:gil;1:9j0cg5hjjjjrrjqwhg;1:6j08h9bhbpjsrhgtinuh7wm3;1:1kl7hgjil;3:8iq9h5cjbkiw;3:0hb1h33h26he8h99h3agnbhccindknejcfl0givhgxihejlhkh4lh4mionheph1sjcuj2vipwf7;1:8im;3:4l4hitph1whc;2:ah6fjsjkbrh3tkcwh2;1:mje;1:oj2;2:agwdh5ej3fgqskeum6vj5;1:1k85hggiwjl9kgwpgiwha;1:1hf3h05jo6nh7jo8gv9heagzeh7fhbhh1jfgkh7lhcmlbnjbpgpqgztimugjvpmwfn;1:jis;2:0hb1k63h7bijchailgjivnhcpjyqhd;1:cj3;1:0h81h93k57hf9fjckcdhfegrfjkgl3hjtjggqjqrh3wgx;2:dhduiqvkc;1:ij6;2:5j3jhgoj9uj8wil;1:kippjq;4:ej1;1:al5bhfcitegoflvgipjjurgzuh9wgw;3:1ijajddisgk3jgvqj9whb;2:0j2vik;1:wjh;1:ghbqj5;1:8ge9guak1bhfdn8egufjughejgukhbphbrhcsiotgtvjh;2:fhdgj6hlcjkmkhdogppkyqgdwgp;1:7hfbimel9hh3tk8;1:dg5ekr;1:lixsis;2:rir;1:jilqip;3:8j7ojd;1:uiswiu;6:8hdgk8;1:6io;1:cgloijwkg;2:cj4;2:bj6;2:0gn1h62gm3hb6ha7h68jv9ipah1bgxdhbeitgfmikcjgokk5mh9nj0oippgqqgmrkesj0tjivilwil;1:sk1;2:5mg7h6aj1jh7qhdrj6;3:1ha2h53k34hcfhbkhelhgmogoisph9rjluh7wgn;3:8hcbk4qjr;1:uim;2:wkb;4:aimhhdjit;1:8gv9j6qj0;1:4irqjm;2:bhgrjl;1:hiw;1:ajj;1:4ks7klghcphewh4;1:4ituik;1:0is8h7bhajjmkh7mjz;1:ah3gk2jhctjguh9;1:fh7kjh;1:fis;1:3jijj6;4:9im;2:0jgklnlhdpgy;1:liq;1:0m21gv2hg8je9ikahhcjuejnfj5gh5hiojh6kheqhcuhhwgp;2:ril;1:ij8;1:9iojipnj0;2:cikhgsujqwip;1:1is4j68h0qjc;2:bhcnioqj5rlkwhd;2:liqriw;1:fk1qj6;1:fjfhiqrilsim;1:9ipbiw;3:ojj;1:ejf;1:8j8;1:0k9bjscixij4rh7wh0;1:0jf8j6;3:rilsje;2:8iw;1:4iu8hg9glak2bkcgkqohauhd;1:1h33gg4hd6h57iu8g89gtajdbgzch2dgwegsgiuhh7iirjjbkh7lk8mhbnhgohfpl7qh1rh1sj7th4ungvk8wh2;1:qit;1:finjhbnjjqja;1:ggehl1;3:iim;1:8j39jh;1:0iu3hbdjneiqfilhh8jggkgmlkinhhqh8sjdtgyukcwjg;1:4j9siy;1:fj9;3:4iubixqjv;1:1iwrhf;2:6iwvhe;1:8h8aksbh6fh0lilmlepgrwh4;1:8iq;1:jldwgr;1:3imciq;1:pilrit;1:4jaeio;1:hghjj8litrkd;1:9l6gj1jh9rh5timwj6;1:dj1fip;1:2iltiu;1:gikjjawhe;1:4k4;2:1jy;2:gj0hjf;1:2io;1:djaegouk3;4:6mdbhfjh4mj7oh6ph7qh5rh6thbuj8vpqwff;1:6fn8hgvmu;1:wiu;1:sir;1:1iwdikfhfrhfsix;3:oje;1:agylitsjtujk;1:8h7dj7eij;2:2iyshc;1:mlkvijwhh;1:0kr1kw4hd9h7ah9bgocjneh8fh3gj5jgvkgylhbmhcoh8qh9rgyukpvjlwjy;1:2ka;2:wiq;1:jk3wgw;1:cj8fj8jkerh7;3:0he1h87ir8it9j9ahgdj6ej0fhbggujirkh6oh8pgwqjb;1:bj0kiv;1:8ffeko;1:wjs;1:8ka9h4dhfehguk5viy;1:tiv;4:wix;5:ditnip;2:1hd3jxdk6egyjlzkgtmnfnh6oghpisqhdrg9wge;3:hil;1:9hfjjo;1:3h58fh9jiaiubjsch0dlzejbfk1gf7hiqkh5qj1rjisgttjduh7vhdwgs;2:3ji8izjhf;1:qio;3:1iu;3:liq;2:1iq7gyiipjk8okc;4:1h18j2bjbcj5egifl2jg4khanhcph4qjtrjwsl2tgsvhb;1:6hfgjkphcql4wh3;2:dik;1:djfeh2wir;2:8k7ahabgxcisdgyeh9jj3khbmh0qiqrkgtimvjmwh1;1:8lq9gnah9diyjk9qhcwjj;1:1jm;1:6le7ha8j9ah0clbfh2gizjgtphbrh9ujywgt;1:bjg;1:8j49hg;1:ggtjlprjd;1:6hg8in9gjbgtgiqkgwmkfohcpj6qh7rituhcwnf;1:8l09jljhgsj0;1:1k82f03iw4jo5j67ko9gtbj7dh0ehdfhdhgviizjhfljdnh1ogwpgxrh5uh5;1:jiz;1:9gvaklkh2qjqrjdwh3;1:bispk5;1:1jxuis;1:ujk;2:uirvio;3:8jw9h3;1:6jz9hanipwhc;1:ch9hf5jl2wkj;1:pjj;2:2kv3ju4io5ha7jd8j19gxbhcch9diwfh3ghghj5jglohdqherirth7ukkwge;1:7h98gx9jyah6bk2cngekjfjhjh4kh9lh2ohhqh6rgsshhtimwgk;3:0hb1iv2hd4hf8ik9j0aj5bgzej8jiqphguhf;2:2he4nf6hginjjhdph6qhhwh1;2:0j6gj9ih7nloogz;2:0io2iq8hd9hdbkkeingk4whd;1:6jdvgz;1:riz;1:7jfajj;1:kk8mjmnhe;1:wjx;1:3ha5gu6ka7gw9grbh0girjjppheqkhthhuh8wjv;1:fj1;1:4jghgxjj6;1:9iqpiy;1:7juahdjhgsjt;1:ail;2:8gr9jepj1;1:2mo3kb4he6jxjhfphgqhewgu;1:jjg;2:8k19gmgjj;3:0h61h82lg3hf4hg5j67h28h7cgqgghkilmjmnmwoiwpglthgwh6;3:8hhcilehcrjf;1:aileik;1:5ipljxwgv;1:7jbbjqhgnrgvwjh;1:qil;1:his;1:hh2kj5qjqwh9;1:qiu;1:2g76k7;3:3h38gv9emahhdmneqbflogh9jhgphgqhcrgzuhhwg9;2:tilwix;1:hil;1:jjhmjp;1:rio;1:jj5;4:6j4wj5;1:qltwhf;2:6hc7hgbirej7jn6phbqhgrhbwh8;2:1ix2ha3gv5jl6h47h48mfajhbh4ch6diueg7ffrhhbjlqkg7lh8mh4piwqgyrgosjctlhwfc;2:wiw;2:aim;2:2ivfis;2:jkhuix;1:8gy9j3aiz;1:piq;1:rjowhh;1:kit;2:jiq;1:ojauis;1:8er9lwdjbjhbwju;1:dglelpgj9;1:0ha1hf2jf3g85iw6gg7h39gxbgwcj3dhgeg9ffkgjzihgjpxmiknhfogupgpqj5rfgsjbtggvjzwkq;1:rjs;1:8haajsfjgghb;1:9imril;1:1j68im9jtahabghcm3fheghghhdkh1mioqh9riwtivwhe;1:5mg7iw8ip9ivahefhfjjgkhcnkyoh3qhfrg2uha;7:cil;4:8j9;1:bju;2:hkrljorgj;2:bhgfk1jjh;1:3jbwh8;1:0l11l78iybgwcjyfhbgiujh6kh2ohfphgrh1uh9wjr;1:8j4;1:cjb;1:8iy9ir;3:1hejk0wkk;4:9gxcj4fj1;2:hizjk0;1:5mk8h8gk9jhcwhb;2:0jrsjk;2:miq;1:ij0uja;1:2j6ul3vg2;3:kkioiw;2:gjkjhe;2:wj9;1:gkc;2:8h0tji;2:8ir;2:gj7;1:hj8;2:9h2am0cikeh2fjvgh9;2:fh3uj3;1:jje;1:0kc8jtdikghgihhjheshgthcujy;2:jk3rj2;2:uimwik;1:qim;1:aitggqhisiixnikuimvis;3:2fl3hd6ko9iqqkzwhd;1:eil;1:aiqjkt;1:kjwnha;1:min;2:0gz1gn2hb3kb5h86gg7hc8gu9ivch1eh1fgdggohf1jg5keymvang5okkpjhsgotpbwef;1:sip;1:ngaplu;1:jhfqlawhc;3:4iwriw;1:tmd;1:0h41h73l84ha5hb6h87hf8ga9g9anhbggcj4dgfegdfr0girhk9kkulhfmhfogtpguqh7rgnsh6tgiugovh6;1:8ki;2:5jz6im8k79iobhgdh1mhfogxpitqhgtgkwis;1:eimhj7tjt;2:0gk1n53h26hg7h48h89jfagudj7egufh1ghaij2jglklflhcnhgoh1phaqk1riwuhc;1:ak9bhe;1:qjb;1:jippjh;3:kh4mn3nhg;1:civqj3whh;1:ahafiy;2:7j8cjgqil;1:tiv;1:ij4;6:mjenizwhh;1:sij;2:aizhj3jkepjxrhawha;1:lil;2:bj3cjc;1:2h33gz4gx8hfahgbj6filijbnhdojcqituhewj0;2:tko;2:1h67jgbhhcimdhhghdijpjm3kh9mhbnheognpkqqj8rikwg9;2:9imagwgkfjikuj3;1:ej5;2:ciy;1:1hf5ir8gh9h4ajobh8dh4egifiuhh7jk7qhathhun8vju;1:kj2;2:8ju;2:jk0rjfwgu;2:jgyokqpjrshawip;3:1h9ijolik;2:sil;2:ak1fhekh3oja;1:fji;1:0js1gt4iu8j3ch8ej9ghbhinjhakj5ohgrh7uj6;2:8iobhfninujk;1:ak1fhfkh5;1:8guagdbheehefkbgjotleuinwgq;1:gis;1:5ms7izailghgjjprh4uhg;1:0iu3h0dgrpk5uj5vk4whd;1:3jlil2;2:fhfgjehj4jg9rkush5;1:cj1;3:kj7wkl;1:6j6uiz;1:4lmdfreh8fiy;1:9ik;3:bhddipkjb;1:0h51h83he8fs9lucj4ekugjyhj9jhblhfqirrfxsjxuh9wg7;2:1ir6hceh9fj1hiqjjfoj3qhfrgtuhfwl3;1:9l5aghbhccizfishhgjitnjxrjqwha;a:7he8gw9iyaikbh9cikehfgiojgqkhcnkoqk0wjj;2:0jmah6bje;1:dik;1:8k6ahecgnjgsljfrfxuipwm4;3:1iv9hddj9nj3oiyrhd;5:wjt;2:jiy;4:wjr;2:ejhuh7;1:ril;1:8h79k7;2:0jj8hd9hgdgxej4jhfulcvjvwhc;1:0it6il9h4dhbehgqiyrh5shfvio;1:6hgql4;4:8j1;1:ij3;1:qj5;4:ij8;3:eivhiojko;1:tiy;1:8jr;2:1gw8jhgj6rh7wk0;1:3ir9h5jjnrj6whf;3:3ip8gyaj5niutjhuhc;1:8j2eiwqjh;2:9gvakhehgkgyqj2rj3tlu;2:8iq;1:8go9j1aj2fh1rl0;2:agwfh5ihdjh3kiwlhhoj6qhcrm8tiowlf;2:1goklgmkfogj;3:gir;1:dj9egl;2:8gk9kpbhhhj1rjquhf;2:ahfhjdmjr;3:fj1wj4;1:dixqjg;1:hiq;2:8imfjp;3:wiy;2:hjerh3;2:3jm8j19h4eizggkhjuij2wh5;1:elahh3tk9;1:8j29hhailchh;3:3h84gj5it6ks7jb9joakldg2ejhgftihbjh6lhenh6ogtpm9qhcremsjctj7wgm;3:ljl;3:cip;1:cezrla;1:aiu;1:nj3;3:wkh;2:4jn;1:hhbqiy;1:gimhjmjh7riy;1:dgrek7;1:hhejisuhgvix;1:8iv;4:hgililrjj;1:8h19jramcffysjhwh8;1:0lo3k66gx7h1agwgjkiipjgykh5lj6mh9niyrfuth2uhaviw;2:cgrejifjeohdqjl;1:6j9rit;1:ciwrhg;1:bgpcjahistin;1:cji;1:2il;1:3io;1:df8elg;1:9j7fjdgh5jjcom2ph1qk4rhfwgr;1:hkaojarhe;2:4jg;1:ej4win;2:0h91h93j24hg5ha7ge8gh9hgaj3cl9egiffpgirjjpkhdmh1ohesnbtkcuhavgzwh9;2:9h7rk1;2:jjs;3:8h49iw;1:aiphj5;1:8inah1bjwlkg;1:dir;1:6k4vh0;7:hhhrju;1:mjb;3:eij;2:uj3;1:5il8jf9hbbh3cjafhbhhenjmqgvrh9ujrwjp;2:8jz9g1agtbjdfj2;1:9hcljfmj1;1:diujg9qjrwjl;1:1gy5jt6in8gw9hcaiqbj6ghchjnjjaphdqhfrjrwg9;1:jjqwj3;1:oj5;3:qju;1:8irbj0cjveikgjnhlsjhgphgrh7wfx;2:3iy;1:cjedhaeiu;3:diooim;1:7j0dhdejejim;3:9iyak3ej7fgzghdnhcsj2um6vgvwha;3:dm5efnghdhiv;1:0kr1j73fx4kn5ha9m4airehfggwhj2jfpkh3mhfphcqgprjdsistgxuhe;2:9imchffix;1:ehejiouj1;1:5h1jhaoh8pmmqh6wmc;2:4hh9h6djueh6givhjfjilqinrk7thb;1:8j59j8gh5jhhmkuwgs;1:ij9jgsqld;2:hiz;3:2gt7jk8jd9h6;2:oio;1:eiwgiwwio;1:3in6gxvk9;2:wja;6:ahhfj0jir;1:qj2rio;2:8hf9j5dinegofk3hiojgtkj6ljbrjithduikwh3;1:jj6;1:jhhrk6;1:rj6uja;3:9im;1:0jach5qitrk8wgw;3:8hg9iuvj9;3:fipkio;3:9iq;2:nk5;2:qh9wjm;1:0hf1h44hf7hg9jtaj2ch7dh6filgj2hizigkjfpkj8lkuogdpghqgvrlrsgoth9uj9vguwik;3:8im;2:8lu9irbiqchddgheivrjrsj4wh0;2:bhdfh2gikkjgrja;1:vj0;1:ein;1:9jkaipbhgcj3eh8fj8jh6wj4;2:fjd;1:rjx;1:4h6gj8ok3;4:3iz;2:8il;1:cj3;2:ckhfhbqjurhfwgh;1:1ku7hg8ga9k6djiejhgh6hhfjjekh3mhfqizthd;2:gjenj8;1:8ha9gqdluegc;2:biwdio;1:9jx;1:hhbrjb;5:1hc3k39h4piwriq;2:0hb1jm2jx3iy5kv6gr8lnbgycgzdkoek5gfihjrih3jeokhdlh4mh1nh5ogkrgosisuftvh7wix;2:ej0;1:6hf7jnahdgimnilrixsj0tit;1:hip;1:fin;1:5ir;1:3iq;5:gh6rkh;1:gjo;1:bhdgj4ijpnj6rinwha;2:bkhhgprjtsilthgwh9;1:biuniw;2:lisqjx;3:ah7gjwjhe;2:gjyjis;1:8gfkmbrhdwhb;1:jj7;1:cgyhiktk3;2:0kj6hb8hdgk5whc;1:9j3dipehc;1:8h7bgqcjjdh9flrgpcjh2qh3rgzuh8wh9;3:9gachbdj7ek3fjv;1:9ijqjm;1:1h58iqakfghfhkwrg9wj2;2:9gwdlgegdhkpjilrh7wh7;2:0gt1h72h13hb4ot5hb6gv7fpaixcikeixfikhh5kixmhdnheokfpjnqhdrhbshctgrvhc;1:6j0vhd;1:0ip4kp6ikairbh7ch3dhbeh4khbmitogxpilqj7uh1;2:4izddtelrfj2ih8;1:2is8gzjgoplhwk4;1:ajb;1:win;2:9hgairejafjogh6lksok7uh2;1:bhghgxjj5lj8tit;1:5le6hcgkkjgnkgxmmanh9qh5rhewiq;1:wix;1:iltjlcqhewgu;4:1he3k25hd8h59gwalsbgmcioflrgilhj2jgzkgomheojgpimqizuh7wgh;1:8im9itajhbiycj1diueh3fj0ghbhhdjj3kh9oj9ph3qh0rh2uhawju;1:1hf8h9bktghbqj9rk1thf;1:bj5ohcqjdwha;1:jhdohewlh;1:ej5;2:8hd9ilwis;1:9ip;1:3hh6oh7hb8h89hdbhbcirehfgjihiljj6nhcohepgxqgqsj8;1:aiybh4;1:1jyrjg;1:0j03hc4hbaj0bhedhafgvjsbqgxwgi;2:aj8ghe;3:ah2bjzgixujf;1:5j58iu;3:8hfghfhjauja;1:gkbuhd;2:3jc;1:finoin;1:0g74is6iw8k99hcam9ejcfgxghchgvijzjl1kj7lhbohfpgwqjprghthcvgswf8;2:ch5eiyjjnnjt;1:ujo;1:1hg8iychgjj8rk5wh3;1:aj8gjm;1:ghgwkb;1:7jc8hdqk6thfwhf;2:oiv;1:0jm;2:ghfqijwiv;2:0hc1gw2h93jh4jj5jw6hc7in8h99hbahebkjdgwgiphh2jgrkhclgsmj1ogqph1qmfrgwslcuhdvhdwfp;1:gir;1:1kb3gz4go6hc7h4bhcghhhg7ilgjgooheph6qh3tj4ujevhcwnx;3:jin;2:uiyvip;2:fix;3:eixghgnimuj5;3:ais;2:jjb;1:siq;1:ljn;1:fk2lh9qjyrjrsipwgm;1:4jz5ix9l7ehfwh6;1:jit;5:lil;1:8hfdjeejwhh4;1:0jk1hb3jz5ik6h17ir8h49hcbgwdhdfisniqoh6qjcshbthawin;1:1ikeiu;4:4he7hf8hg9jcdhgej8fhdjh6kgink2omspjhqherizwgx;1:0jaaipgiuwhh;1:ujd;1:qk5;2:hh5iljjiuwhf;1:8iphhdjim;1:6iwwhh;4:rio;3:pir;1:fje;1:wk1;1:gjh;1:birhirpkjwha;1:cjb;1:qjx;1:0jb1gl2jf4hf5gb6gr7j78kmageblgchddgqej7fgwgjnmgtogtrfptj9uhhwit;1:6gnbikuitvjcwjf;2:hip;1:cj9;2:6knaikjitph8wgu;2:8j9giz;3:gjo;1:oh9pje;1:1he3hd5hfcm9ginilwrgfshb;1:0h08iw9jqagldhcejwfk2jgzrhcwju;1:8gxaglbizch5djsehefk2glshgsjfqkkkoinphfqgurjcwin;1:3iz8gdbjljhbqjywj1;1:dhdej7jh7wj9;2:dh9eiw;1:tik;3:9j7agabh6eisfk1kk5;3:8ik9j9cgx;1:3krbinwhh;1:0je8hfklnlhenhc;1:0gk1kw3h47ha8h99jgagvdj7egufh2ghbhimij3jg7kljlhcoh4qk2rjmthfuhc;1:4ik;2:7iy8gqbh0chfdiseheghbhjtlh4qjlrltwgy;1:9iv;1:rin;2:rks;1:0hg1h83h94k16he7gx8ki9lzafpbfndmdefzgitih5jjkkj1lh9mh8nhgohbpgurivth2ugrvhawjt;2:wjo;1:lis;1:eh8kmw;1:sim;1:diteivjhh;1:0iskip;2:8io;1:3hhil6wh8;4:jhgpjd;1:3oaaizchdjiywg3;1:gijojd;1:nmqpgy;2:8iyjj6ohg;2:0j22iz4hd5hh7he8h89isdh5ejofiwgh6jjskl4lh5mhenh6pguqmxrgytgtuh7wg8;2:agufgqgm3hnzjh3rh6wh4;1:5j5cimeizpiosio;1:0glbj9rjiwio;1:ril;1:3hg5gq8hfbk4dglgh2hjtil4jl8pheqh4rgzth2wkn;4:3ip;1:3jobh4jgqmj9wm1;2:8gvhikjktrgqtkdugwwm3;2:8l99h9aiqehahjjjj5simwhc;4:piztmnwik;1:fjfniwwhd;1:8ft9l3cj9dm2efipk4rgzwhg;1:3jc8h7biphhbjkskhhrhgwlh;1:1he2h25im8kg9imakybjfdh8ehaggfhh1kgaljgmhfqhdrlauhevjgwfy;2:2kq4lp8gtbh8chejhckkjohcrh6thd;1:aindjxehhjgzujq;3:3h87he9gybgtck6dh2ejtgithm7jfskj7lhhmkyphcrezsiktkkugtvhc;1:pin;4:ak4jh7qkf;3:alwghfjiyojjrh3sgnwhb;2:2jpajq;3:gjmhipwh8;1:oip;1:oikuju;2:5j1hirjhdriwwin;1:cim;1:2nb4h76he7jq8jj9j3eh5hh3jhdnj0phgqiorh3ugz;1:hfxtkxuiy;2:8gt9jchiq;2:bj0;1:6hfvk1;3:hiljk5rgs;1:wim;1:0iwbhfhixuiv;1:3ik;1:4hgija;1:biz;3:0ko3kc7hgaijbhecinfkfghcjhcoirphcsguthfwgz;1:4hc8h6bh1cjnujiwjf;1:8gx9jnbip;1:kh2lkf;1:hj4kisuij;1:3hf8jv9jlehd;1:uj2;1:2ldjgyuhbvj4wiu;1:hip;1:8gyah7bincgrdh6fk5gh9hlbrivtlnuj1wg8;1:0jr1hb3jt8h9lisrh2;2:vj0;1:bio;2:4kbjiyoh5;1:hj6;1:chgtjtwik;1:0hbch7pjwtil;2:8he9ixfhagj6;1:3he4h76kajh8ohbpgwqh7rh5uo3vnrwfl;2:nk5;1:8jz9iyahbbk7chddh0ej3fh1gjehjbjgqkheokbph2qh9rhcthguh8wiq;1:ij3;1:8h5bjswhd;1:jj6ohg;2:fjdjiurhd;1:4hc6h68h79hebhecixeh9fj3gk1hirjjjnhgoippjgqgyrh5sjcwiz;1:4jx8il9jxwhf;2:biqghdhgyjj7pivqjs;1:ij2qiq;1:0it;1:3hf6gs7he8fw9jnbh8fixghchh6jfxqhfrkcsiuwpm;3:chagjnjhfsj3ujbvjg;5:6jwvgwwip;1:6he8j79gxaitch5dimfirhiojitqj2tgvuj3vj2wh3;1:0hb1h92gy3h74io5he6je7m18hg9lgblhcj1dkregpfguggrjgnkh1lgqmh2oh1rh8tgvugl;1:dikwjj;1:8h0ajpghahjgjg9qj0rhhsk8wjm;1:6km8he9iockkoikphfqilrgywgl;1:8gs9h4egkfhdgjehhdjhcqjcrivum7vjqwj0;1:cgxel6gh4hjvqj7thcwgx;3:8inej0mjgwhf;3:8jp9gnbhbehgfinuj5;1:lik;1:0j12hg3k55k79heaiybhfghgjhbkh8niuwjb;1:9jwbjeklblh6nhawha;2:fio;1:cjmegv;1:bj4;1:bhghiz;4:fo5ghfshfugywha;4:8gh9ldah6ch1ek2gilll9wgz;2:dk2gim;1:aiqgiv;1:9fzrk3;1:4kv6j88jd9h9aguhh2jl0olqpgpqhasghwh5;2:iin;2:8ji9gmcj5eil;2:8io;1:6jg;1:kk2pha;1:aj3qil;2:2isjjf;1:jl3rgswiz;1:1ms3gs4ly6h07jk8il9iwagbbirchbej7fjvihcjgbkg8lgtmguojgpj0qgsrg5sh8tj6ugrvh5wgh;1:ajcfh3gkgjk5pk5qhawgr;2:khanm7rj4tja;1:0h93h2aghch0fjngh9hhgik5jkqnk2qimrj3whf;1:aio;1:2ml7jc8j1jhcoh1whb;3:ljy;3:8ip;1:7l2diyeha;1:fim;2:8hgbionh6wm0;1:8gw9j4ehcmgvnme;2:ahcrjw;1:bj3;3:cistjpwj1;1:hj0kivrh9;5:7kqjhesiswh9;1:bj3tis;4:wkh;1:ciljjzrirshh;1:cis;1:egzmj0ujtvko;5:0ircktrgb;1:5oq7h58hgfjbjh8phfqh4ujvwh1;3:9gtbk9ch5ehdghghiqkkmrhfsh8uk2whg;2:pjdriq;1:jit;2:3hghirrhetkawju;2:0l71is3jr4gw7gn9hdainbjheh8gh0hj6ih5jg9mhenjcph7rg7sj4thfuguwkm;3:7iubk3;1:mhfoiz;4:jiotji;1:bj8cirgkahivrgsthdwh8;1:dj1fip;1:8hg9glak8bkfgktuhd;2:8gy9j4bipok7tio;2:2gt3l64hg6hbbgzfjcgfwijjjiyphfqgsrj8tkm;1:7ipahecj8dj8egzfjfhkijfnmjlqhgrgz;1:9jyginhj1jh3riztixuh5wjm;1:dh8ejxkip;4:9ioqik;2:8gc9jmagrcheflzgjwwj1;2:1jx2hg3hc4ol5rh6ha7gvaj1bh9ch6fjnggoijojgxkgslhcmh7nhbogdpg4qgmshdthbugnwfi;2:eji;2:7h78j49j1jmpognqh8vik;3:6hejmiplpqhbwgf;1:0h93l75h36j6aildgyeh8fnikh4oiwqh6rhg;1:2kz5kd7heqhfwhf;1:ciwrla;1:0gv1h32il4gm5h06iq7gn8jo9l4agrbftckndixelagiohiwjgckh1mgjnkioj9pgfqgurirth5uhdviywfi;1:ahdjjcwje;3:8hfsiktkv;2:ghhrj5;1:2jo3io9hcaj0gk6ljpphaqh3wfx;1:9h7ch1dhdhn0lio;1:aiw;2:9j4giv;1:ahbeilfjsoim;1:6mueimjh2ohdqhgrhhujivkxwgh;2:9ilahggk8jkzoh8wh3;1:0hf1it3jh4h45lb6ha8m99ipbh3cgrdj2ek5gfnhizih7jf1kh5lh5mh5nhhogxqiosixugvvh1;1:hj1jin;1:ejo;2:1lz;2:dj0;1:3l6bj2jhawgt;1:tiv;1:cip;3:9ijwjp;1:bjxcj3;3:0gv1gj2lj3h45l16gu7h48iz9gxaizcgbdhgfishh0ihfjfakimmh9nh0ok9pk0qgdrh1tk9uk1wh4;3:4il;1:3j15ko9isjixwgo;1:hhbrlewhf;1:0jm3jf4ip8jbagsbhefheijslgbphaqjjrfcsghwka;1:aiw;1:8irdilehejh8sjg;2:njo;3:ahedilehffikgj5tiu;2:giu;2:5fr7omjh5;2:rj5whc;1:1ha2hf4j97hg9jobhcejafh9jgskh7miknhgon4pgzqj0rgvuh3wji;2:0kw1gw2hb3is4io6gz7jr9jzbhbdgyehhfh2glchhaiipjhgkgblj4nguoglpgcqh9riksgbtgvujowj5;3:3l24h7hhaok5;1:ajifgxgjc;1:gj4;1:qlssgf;1:ujf;2:jh9qjl;1:kj4;4:4hcij2;2:9jh;1:8jvahdujk;1:8iyah0dhcfiljjmrirwhd;1:1j7divrh9;5:1hcojjqh9rk7;1:8ijgim;1:ejn;1:njs;2:5qlahcfk1jh6ohbrh2ugzwh6;1:hit;2:8jcejcfitgjjkkephgwgh;2:agyfgtgknhk6;1:ag8cisfgawox;4:1iv8h5kktrhf;6:9iz;1:0ji;1:ije;1:diyegpgjoujd;1:hj3;4:jir;1:0gj1q59hgahaghgmheniwohbpjtrgkwhc;1:8hb9ilcithhcilbmlrrhgshdwgf;2:ejmuis;1:wiw;1:5il;1:jhelkhqk8wim;1:8j29kpak7bkmcjregzfghghfjhckj4nherh5wh2;1:giy;1:ciudij;2:jgwpp3wgt;1:4hf8iz9hbbjuchegjnjkoof8pnhqj8rgswg4;2:nk2;1:3ik;1:hgork7;1:ghfjiz;2:fhbgl2hiq;2:eio;1:4ns8mh9kubfschbehaghfmhgnhgrh5sh5thguhcwgy;1:0gv3ke6lgwgg;3:5j66hfdj2;1:1in3ofgimmj7rh2uhhvhgwg9;1:cjdoj8;1:iiljjp;1:0km1gi2h93m04j26jr7h18fn9g3ah3bh1cireisfisgh2hjwig5kgolh3mh1nkhog3pg4qgnrjssjethgwkm;1:9iqdjc;1:1hggiqwjn;5:fipoiw;1:ahefk0hjmjgkqh8rfttjxulnvk2whc;1:6mrphdwg5;1:wip;3:vjx;1:8jdah7wis;2:djcegqrjxuhe;2:aj2wit;1:0iy3j76hfafxbh2dj6ekkfgnglchj9ij4jhblfcph1qiorgtuh3wkc;2:iik;3:bgagl6kh4llpmhgnhbqj3wha;2:8lo9hfchekgqnkq;2:qjyrhe;3:ejvfgx;1:gh6jjskhhljrohcphawmi;2:9k9;2:8il;1:aj7;1:0h64jf7he8gn9gjah6bh5chfdm1emdflzgh4jgrpheqivth2whf;2:4iliir;4:0ik1he2im3g54gg6gl7j28lgaizbh5ch0ejmgh3hgojjkkgymhdnhcokqpgprk7sh2thauh7vkwwgv;1:3j49hewju;4:akjbhfcjkehgfh4hiujh8qj9;1:8j0aikbjjdhbeipfixkj3nh7qj3whg;3:cj7;1:wjc;1:3gu6it8iw9gzgh6hjfjjaqhcsiutguwl3;1:2ha4it8hfah2kk7ol8;1:9jfdixjilujwviqwgy;2:fiq;2:eiphioqitsip;3:5jmike;2:8hcbgydgzej3kkkqj8;1:0h81h52hf3h54lz8h9ehgfheggmjklpkmqixrh5tl0wfs;1:gjzkhbpk6;1:0me2gb3k14jr6h97heahdchfgh7jjolhfpgwqimrj2sk1wgk;1:ah9fh7jh7kjdojarlatiqwjm;1:9ji;1:9in;1:iiltiv;1:qji;2:1hdbhcclb;1:1it4l18gpjhgkkqphfqhdrhd;1:7hgjl9pgtqjysjrwhg;2:8hbghahjaiimjjcrjwtjo;2:0h81hd4lr5hb8ixij1jg5khamfwnheop3qjarhctj2uhewgn;1:8iq;1:2j94ja5hh8joaizbguehcgh4jgtkhbmhgph3qlbrhftlmuh6wj9;3:einmjd;1:0k58h19k4dmceffjhcrhh;2:9j2wiy;3:dip;1:wj8;1:uir;1:0hfajtdh8eitfipghhhjgmilrjfthgwh5;1:lir;1:4ij;1:4jpuj0;3:0ioeheuj2vj7;1:ljk;1:2hd4na6hd7heghfindohfph1qh9rf7wlc;1:5j2cj2khanjqpk3rgwwhg;1:hir;5:7h4ojq;1:hin;1:qjvsh4;1:1is7hg8gj9jubhaejmfhegj0jjlkhgqj5rizthbuilwgr;1:7h5cgogixnjgohapgzqjywls;2:eji;1:bjveg3gixhiojh8wjw;1:6hdaiyvkcwhd;2:ilvjhepiywh8;1:dkiehh;1:mm9;2:0kg7injhdwhd;1:8iwqim;2:4jsbhgfhdjfxkh5lmaqizsjwwgz;1:2hc3hg4hd5hg6hg7h98iq9frajfbiqcl0diqegnfkngj0hg8jkglh2mhfnh9ogxpgtrizsh0ugswlc;1:imn;1:0hh3lx7hh8ivwji;1:8iv9h6djfeh8;1:3hg5kz6h27ha8gc9lrairbh5cgzdjhfhggh1jf4kh8phdqkfrjdsj2th5ulnvg5wgr;1:ah3fkh;2:8h2bgggmakhell7wh9;1:jguwkn;1:8m4bh9gh8jhe;1:ak2kguuis;1:qiq;2:piy;1:cjbqk8whf;1:1j5fgqglgjhe;1:oipwit;3:gggqjl;1:gio;1:fiq;3:2hc6he8h1biteisjh5lhcnherh8tjaul8vkw;1:qkfwis;4:rhewjh;2:3k08hgwjw;1:7m6wh9;2:jjankkphhwh0;1:0iz8ikdj3eizfjagh1kgqlkn;2:aim;1:lhfrk3;1:6gdvk4;1:1hg3he4hg5hf9hfaixbh9fh9hltjkkph3qjirjfth6;1:8hgbk5ciqejfgj4kh7rh6;1:6gxjmzqgtukovggwha;1:4inhk6nj4riwwhg;1:0h81hd2kc3h95jx6hf7lq8g4cioeh7fh6jfxkh4mhfohephaqgurlosjiujxwgn;2:3iqcj9;1:0j08kz9gydjweipfhggitjg9kgyliymizwhe;1:1ju2fs3gm4h55hd6h07qs8inch5dgweh3fh2ginhj0jj9kh4mh1njcpfsrh4ug3;3:bhgmmuwh6;1:9h3ah8bjicgqflfgh2hiwqivuh9wjo;1:iis;1:0j09jrdjqeiqjh4kh5lj0;2:0it;2:oj3;3:bjocktfhc;4:9ik;1:3h58k6ah6bheej7fisgjdjhckkaphdwiz;3:pis;1:8jzbh0jj0;1:4j5;2:vio;2:nja;1:mizpjg;1:8jjakcbjkcimejlgjahjijh7khdphfrgnuh0wh3;3:aipwjb;2:5ix8j2dhfej4ggwkgollbnhewjt;1:bipdggejp;2:1h77hf8gb9h3ah0bfacgidjyen1fimgnohizjj4kh5ljpqh3rkgthbugnwg5;1:1in3jh5hb8h4dipeh5jj4rldwh1;2:dirfl9ghfufu;3:4j3;1:1hc4kbbipminnh8oh5pkxrhc;2:8h29k0ehe;1:eimwjn;1:rjmwgq;1:1jq3h94hcagwbhaegxfjrikkjh1khfnlioinpk0rhfuh7wg4;1:mh4ohfqk2wjm;1:0m51il2hb3gs4h35fz6j27k28ip9grch9egzfh2gjfhjqkgrlhamgtogrrkovilwgz;1:4im;1:9hbaj0rjp;1:kip;1:2lo8l39gwqhewh7;2:3jb5jh6h27gv8ji9h2bimdh4eh5fgrhhcjn6lhbmk5nh7ph9re0sj0tghugsvh9wmy;1:tjhuha;1:ehefhetjxulf;1:8jzagwbjuehffiugh4hkojgkpodqherh3shath9;1:8hfaj4qj3;1:ahhriv;1:win;2:6jmoiqqnkth7wgf;2:hirwkz;1:8gq9isakebjlciudh6ejafgqjhbnjcok0rdnuhgwjo;1:gijlio;2:cij;1:oiy;1:0h03j44j77hdagzbgxdm0emefkqjggkhgmhgphdwgt;2:ajbjj6qgiriluj7vin;2:1jh4hh7hb8l39nobhdchgdj7fh3ghbhhejfnkfglgamnwno1oh4pg7qhbrfathewfv;3:fk3sj5;3:2jabh8rjhuhg;1:hkdwjo;1:ril;3:vj8;3:8j9hgxjk4;1:ain;3:1jvkjvohgpja;1:5l37hf8hdahbbhbghejitqk1rhesiqtj5whh;1:1jm6hd7hchjbphhqh8sivwl2;1:8h49j0;1:3k39j7ah7ghfjj2kj1uilwgs;1:2iq8j1;4:win;1:wiw;2:jjk;1:hiy;3:ejcfje;1:ija;2:aiq;1:7hd8gdaimbiljm9ril;6:5iwjim;1:4ju8je9j0giojgfoj1whc;2:qit;1:3jd;2:1hg3h26j4jj1khemlbnkkojiqh7rh1;1:8gkajgujj;3:jiqrit;1:fkluh9;1:2gg3l0pj2;1:fjepiq;1:cjgmizuit;5:ujq;1:djcqk0wh9;1:8lc9gfck3rgwuimwhc;1:4hdiiqom2;1:fir;3:wiy;1:1iujir;4:pir;1:jgysjcwio;2:fiogj7ois;3:ginhjajh5;1:0kg8k2thewha;2:3k29imrhewiu;1:1kwwh7;1:wjb;1:2in7hd8io9gtaj8bg4ejyfmagmxhjajj0kheoguqh1rf6sg4thbuipvhbwfs;1:kioqjd;2:3k2nim;1:fij;1:ohepj7wjn;2:ihaskp;1:hio;1:fiq;1:fivgim;1:1iq3jggiqjjvqhfrh7whh;2:rhewke;1:2he3ij6h57k28j39inckteh8ggwhhfihekkilgwmh7ogrphbqisrgrtgfug2vk9wim;1:tiq;2:7jybhejilwhe;2:riq;3:3it4il5n07hh8gpagwcgxdiueh3fh5hgpijdmizphaqgkthb;1:aiqjjowhc;2:4j68h99k7ehajjj;1:wjn;1:wji;2:ck1qjiwhh;2:4jajl4kjowh1;1:aiudk9eg8rj8;1:4ixjglwlh;1:8ipcjowis;1:fit;1:3ha4ha5hd6jb7hc8iy9g9aggboscjiegwfgrgj0ih1jh3kh2lhbmjsngvok9ph6silth2uh1wjp;1:rjc;4:0ku4gw;1:bkrfhg;2:jilwjp;1:wk7;1:aj5dn0efugj7hhgsh4;1:9hboj6;1:8iurhc;3:5ix;3:0gu1mr4j0bhbghajm9khephgrgvwhg;2:ujjvj6;2:jkmwge;1:ch9rkcwhf;1:ahdbkyej1hh9jh0rkg;1:5iv;1:akefgm;1:2is;2:dhaejg;1:diz;1:8ir;2:8ix;1:ujg;4:4k4kis;2:9jiahh;2:riw;2:okd;1:1h63jc6h37hc9ilajdblkcksdgxgj1hh0ihdkkrlh6mgrnh8ohdrfytgvvh7;1:kmdlfp;1:8gtbkujitogu;1:kik;3:9js;2:8im9j5bhbfhghmpokcph3qh4wgw;3:aje;1:1iu;2:bjyeio;1:2gq6kddiseh4vknwgu;1:djzegznj2rjo;3:0iu1gw3it4hf5jz6hg7ip8hf9haaiobjqdgxfjlgj0hh9kh6lgxmj9nhhojppg9qh8rgqsl8wfv;3:7ga8ip9hhgo6jg5kjuwhg;1:2h14j16ix7ix8hfbh8cgbdiniiwjgvohapjnrgytj9vh4wj6;2:jjmmjfwhh;1:1gz2h53he4il5m06h68k7airch6fixjgfkkblgtmgwngwokwqhauj4wfl;1:7gbjk9;1:kj9;1:6iwwhh;1:7hb8ew9gmakcckjehefitjgjkpolivnheoh8pikqizrhgsipugzwgt;1:0it5ij6il9h4dhbehghimqiyrgwshdvin;1:7j0fjq;1:8h4bh1cjwwje;2:jis;1:bhgcgzdilehafkkhkmugr;1:1hbej4fj4jhfqhbwlk;4:pjw;1:piu;1:aip;2:ciosjp;5:4j6agdfjkgkxsgc;1:1hc8itbkqdh8fivghghhfjh8kj0mk5nh5qjlrh6wh4;2:2in;2:hikjm0wh2;1:lkj;1:qin;1:2k6;2:4ip;1:bjxcj4;1:1is9jncirkillharhhtin;2:nip;1:6hb7hfbhepguqhfwoz;1:hjvrh3;1:5khginwh9;1:8jjbh4cinjh1kh9mnhok4pgyrhewhb;1:jj9;1:0kg6hd8j99hbtjxwhb;1:9ip;2:afubj2fmahmujimkgqrgkth0;1:hk3jgs;1:diowka;2:8jyeje;1:qja;3:oj3;1:fin;1:0h81il2mt3ni4kc6j47h8ah7fhfghcjgxnhgpglqgarhduhgvhfwjh;1:fjbrj4;1:4ji5iqohb;1:3hb8h29gqaizbhbcjgdhbeh3fgagg4hp8jjsqhbrkftj6ugb;1:nj3;2:wik;1:1h73gy4hd5j97h28j6aisbfqehagh0hh4km3lgzmh7ngqojnpgwqiztl1uh8wl1;1:piu;1:0jc1kq2iz3h07gt9h9hgyjh0ljqojspivqgzrgisgztiwwgl;4:8j7chbhimlk9nh8ujtwhg;1:qjf;2:ejijimph4qmxuh5wgq;1:1is5ir;3:bjg;1:agvcjp;3:riu;3:8j49lhakgbj9cgreh8fhghhfkijpharh7tiyuitwh1;2:7j08j2jh8;2:6hh8fkbh7dgwfh5ghfjh6kmflimmkenjerg5ujbvkwwh3;1:fip;2:2gr7l6;1:wjo;1:hhbrjf;1:ij5;1:njuwjp;4:8hcah9bhadl9ekhfmmggljh1rgqwis;2:rio;1:8imdhafji;2:2hahgxjm3;2:hgfrjp;1:bjg;1:4m28kw9gqdgcejujh3;1:ojlqh9;2:8j1qiz;1:agtcjufgsglejhd;1:1il3lw4k55gx6gv7gt8gu9gkaklehdiinkkgmhengroj1piyqhbrfesh2thevizwf6;2:djdehbggvkgwnmtqhhrh0tj0;2:uj2;1:dhaeix;2:cj4njgrhd;3:0hd6hd8giahgbhfdn9em1ghchjejilkhelhdmhenhgphcqhcthgwh9;2:njr;2:jj4;1:sjbwin;1:7h98izaizbkjchbfhhghfhj2jjxkhclhdnhcoh9pleqisrgrthduk2vh2wgl;2:7indh2filjj3phhwju;1:ejngh0hiwrgqsitwjc;1:6hf8h59jeapccirdh0egxfgoggqhgyjgykh2ph7qnkrgkskitgsuj3wfx;1:5ir8jz9hfbizcjxfj0gglhj5qj1rh5thhugrwh3;1:8h19gdbhfgkehjbjh5rkfwjg;1:9henj4rj9;1:uh5vjx;3:8jy9h6hjd;1:ril;1:8gybh1gh7sl1to5whb;2:diveipfinkj1;1:8jwbh8fio;1:ailjip;1:4imhizrh9;1:uir;4:ah0djkhmijitphgwhg;1:9k2ris;1:0lu1gs8iq9izahgbj1ejifj9gh3hiojhdkhgwgk;1:jj4rhh;3:2kyjhe;1:kj1;1:8jkohh;4:6jr;1:2km;2:0lf1io4fx6hc7j88g4aj6bhgdimehbghehhdiiwjgpqhbrgsuj6wlq;1:dio;1:pjdwhf;1:1h23h56h97h1bgwcgwdh3ehbfhbgkzjgskh5ljonh9ohepk1sl3ulrvizwgu;1:9irchgrio;1:wkb;5:8jwbh8hh7rinuis;4:0hd1hb2lb3gt4k15mr6gm8h49itaizbhdcguejafh7ggzhgxjjopg4qghrl0sh5tgjuhavh6wgp;2:8ivbiyok8;2:virwk6;1:8iysis;2:4is;3:4mpphc;1:2he3ltfgt;1:qjr;1:0hc1hd3kn4hd5h87g18ju9imagqbgsfhfhh0jljlhfmhfnhgoh8pl4qk9rgnuhavgywiw;2:pl0riqwhc;1:pjgqlnwgy;1:gkfwgn;2:4hhojkuj1;1:2kj3hg4kwoh0;2:ajgfh2;2:0jl1ja2iz3fm5jt6hf7gw8kz9guajnch9egffhbgh3hfdjlfkj8lkemh9nh1oikpguqjsre8th5uhcvj9wiy;1:liwrh7;1:bjlhiu;2:1jg2hh3gn4h45hh6gi7gi8h49jyah5chedh8fgxggvhiwjltkg8lh2mnnngmogqpkqqoqthauhdwf2;1:9jvjixuja;1:giy;1:8jpbhglh0riytk0;1:4j0;1:civ;1:1itjkmsh1;1:2im5kg6iz7isbh1gimkikogwtgo;1:cj2oin;3:uit;1:7kg8gjggfhisjixql8ritthg;1:iix;2:8hgbkjrh0;1:4k68hbfij;1:bjnrh0;3:ajpjg7wku;1:0jf2lw3go9ingj6hhaoh1qjorhhwgd;1:6j9ah1ck2eiotilvgq;1:wik;2:5kd;2:dggejq;2:dj0;1:ajzhhdrkguhewhe;4:uiz;2:tjv;1:0h81gz2hc3h44jc6h57h88gj9h6bixcj6dj8el9fljgfqihbjgikj3lgwmh2nkpoj2rhesh7ugxwjf;1:2iw8ipwhf;1:8lj9dybj4dgveilggokl7liwqhcrh7tj4uiowjf;1:wjk;1:ej3;4:6hc8j7bjccjxfiogkvhhbjh3mh9pgmqjuthbwgf;1:ahgbinhjokhdljn;1:1gxilw;1:jitoir;1:air;1:ejvojh;3:ojs;1:ijd;1:pj0;1:0j4;1:9isfk3gj4wh6;2:0p27h3phewge;1:uju;3:6il;1:7il;2:eiw;2:bhdmje;4:piy;1:4k7mhbogz;2:djveipfh8jg4sk0wk8;1:8l59gtdjsejgfhc;1:3kcaizbheekyfgwjgwkgkllnoj2phdqhguh9wh7;4:rj5sh9;3:8kcehhpin;1:eirjil;2:6kdwgv;4:8gm9k3akacgodg2ekpfh6girhj4rh0uk9vgz;2:fj5;1:alqbhewhg;1:ghajjjrl2sh3;1:1mg6hg8ldkhgplrwea;1:3j84io9ipaj9bj2kiplimphergwwgt;2:jgywjq;1:jlaoh9;1:3j7ciuhip;3:dkiegpvj1;1:blnwhg;3:ahfditeh9fivsjk;1:8h39jheiyoirqnvrhgth6uhewh0;5:wj3;1:jhftj9wik;3:6hc7hh8h09heagxbiocjzfjugh8jo3lhgohgpgwqiqsj5wg4;1:fkmgil;1:bh6cjhtjdujw;1:miv;1:dhgeh7rkluit;1:2is7kv8hbcjufm6hiljgdqhbwgd;2:sikuit;2:2jq3hg8kp9gsagpbh5ejifjuggohj8jipthhvhdwjf;1:wio;1:tit;1:qj9;1:8h8gj0jneph4qgvriwthdwh7;1:5h3jh4nixwla;1:6hg7j5uhfvljwhe;3:wit;3:1kljg9wit;1:0he3oj7hawhc;3:aikijlwim;3:8gx9jeahcfjcggmhivjg5qlsthg;1:wip;1:eit;2:wix;1:9hccm4dilehgrgc;1:civjit;1:gir;2:hio;3:1j62jq3h04lsjhfoizrhdwhf;1:tim;1:2h67j5;2:uhbvj1wir;1:djq;1:0gz1hf3h34hd7h6bk2ch6eg5hhbjjzkh7mgoohepkpqhdsj7tj8ukcvl9wge;1:pim;2:4j7pjh;1:0h91h92kf3g34jh5ha6je7h58jr9p2aggbgxdl6eejgguhgfijskh9mhfogzpguqgxrlnsh8ugwvjrwf7;2:6iv8h29h8aiwbimfjwghahjolimojpshbtj4uhfwh5;2:3j1;2:ahach8fhehj4okargzsiuwkn;1:fjygj9wha;1:0jj1h03j35hg6ko8inagfbgvfksgh5hgzijejj2lgamhgoh5pjorhasgkuh7wgp;1:8gg9k2bhgkh7mo4qikshewgl;2:bil;1:1gr3h96h49ozbh7ch6efwghfhhcpheqh9rgzth9uj7vk5wm8;1:3he4hf8ll9mdalabkddhhegdfgpgh3jgnkjwlhfnhfoimphcqizrgushgwg4;1:rin;1:5ml6h6wgw;1:jh5rjl;2:cildikuj0;1:8hc9hafjfghajgdnjgqj1rj7tjrwjt;2:4jlcjwrh0wh1;3:bk3uiw;1:0jiklolhfnhdohe;1:giu;1:1mg2hf3iz4imbh9ggzjn7khaogephaqgxrgrwjv;1:3or7hejhdph8qhdwgj;1:oio;1:0ke1h73hf4gp7h88hgbkqfhggkyihgjj3khblh2qjmripwh8;2:dkbeix;3:bijhk1;1:wiq;1:bj0;1:3gx6kwkjvqh3th9vkhwh3;1:0hb2hd3gt4h66gw7h78mfajsbjxch9dhcel2fgohftihgjj8kkjmhdnh5oh2ph0qnbrh0tgguhhvhcwfz;1:0ja6ha7lsjgcvh1;3:kjesik;1:0jpdh2ej7mim;1:0j44kfjhenjtokqpipqhawge;1:djoeharj3;1:cjf;1:bh4ghfjknmj6rkxwh5;3:jj7;2:5jc6iq;1:wim;1:0ij2in3ik7ipfizghgjhdkh8lhfmhdplnsj2theuh8;1:8ik9hgjjlwk8;2:4g5gk6wl9;1:aiydgyejwfgxgh7jgbkn3ljrngwrhauim;3:8iwbhacjo;1:8gp9jpdiy;2:wit;1:5lc8kv9fugj2wgo;1:4j4;1:0oi1go3gt4hg6hg8jebhddjqfh9ggwkhdmiunijohaph8qh5rh9thcuh7wjt;1:4je;1:wiq;1:6ilwj9;1:qip;7:4kr5h9ahheikjg7qkd;1:4hg6jv7ke9gtagwch6dg9eh7ggohhgjgtkgmohdpgwqkarh4sgjtgmuiuvpawmy;1:4iuciqfiw;1:aj9bh8ch7dhfejnfixhkljk9qj8rgkwh4;2:ainciqghahiqkhfnkvrilwha;2:2lgqhc;2:oju;2:2jy;1:jiq;2:fgsglijhe;2:fit;1:fiz;1:5iz;1:jhawkh;2:1h13ki5ik8kraincj5gh1hjjkhhtglugr;1:gkgjj5;2:tk1uhg;2:fj5hiq;2:9is;1:ojk;1:agvbissj7titvjl;1:4is8j0chdjh8wm3;1:aip;2:1iy2jj3gy4k05hc8ju9ghbgech0dgjeikgh1hguij2jfikkrljkmh9nk6ojupk4qgerglvh9wga;1:pjcuilwj8;1:8jc;1:ujh;1:jjvwhc;1:kh2lkepiu;1:2n94he7kb8iujh9rh7;2:bh9gjulhh;1:ajhfh7ljfrjnwhd;1:8lgahcbjschadgzej1fh1gjehj9jgpkh5ojdphgqhbrhdthcuiowil;1:dj0;2:9jzcj0tjkwip;1:0in1hf4k25l98h69izahaghbihgjiokipnh7qh0wk5;3:8ipdim;1:fin;2:bj8tiqwj9;1:8hdgk7jh0qjr;1:3ik7h6jgwoh2qrowgb;2:pim;2:0jy1gv;2:uh8vjv;1:egbhl3oh9qku;1:4iwqjpwh8;3:him;2:wix;1:ejpuhb;1:9hddj2;1:aj7tixuhf;1:biphjckj9rh1wj7;1:ahceinfir;1:1j62ji3h84jp5hg7gy8iobh0cipdh7eipggvhh1jgikkwlj6mh0nirpjgqgvrgithawil;1:0hb3gz4hd5ir9ggah2bh8eirgh0hmzjkbkh9mh6nh7qj6sikth3ugsvjhwja;1:2gy3hh4k65ja7jd8j99hbbhgch6jh7ogqqh7rjlsjitj2wgn;1:6iq8j39ipbj2cjrdhaeitgkohhajhbmh8nh9pkuqh1vgswgc;1:oh0pjm;2:0g81jc3h67h28kn9j1bkecgrehcfh8gh9hirikijfzkiplfxmhfnk5oh9ph9qh7riotl2uh8;1:1jafk6rh5;2:nit;1:win;1:hjwjgk;1:2jm;1:hio;1:2jg3ij4hg5iz8in9gvchbdj6ehdfh7ggwhhajgvkhamjfnjmol3pk2qgurgnuhdwje;1:eir;1:0hb2hg4gz5ha6hc7hf8kq9m5agcbh8cgxdiyfgmggxhh6jf6kj3mjvnlaoh0pikqh4tk8vh1wjn;2:dhaeiu;1:8hgjksqhgthh;1:9is;1:9hbdh8ekhfikvio;1:7io8gcgh8jh9rhdskjukwvjvwgw;1:2isahachbfhekleriqwgq;1:5jg;2:pj0;3:jin;1:fkg;1:jj9mij;2:fkx;2:jjdliq;2:6h7dj6eh0fhelk7qj6uk1vkvwgx;1:cj4fh0uk1;1:0ip;3:aiogit;1:bhawl8;2:3h6ijiwip;2:eikpknwhg;2:3khfgt;2:0j3fk8;2:ajdphfqljrguwiu;1:dis;1:8iuqk5whd;1:1hbblrjgokgtlhenmmrirtj1uh6whb;1:wj2;3:8jv9klakgbjhcgmehefhggh9phbtiyuiuwh3;1:8it9hbfh9giwhiu;1:iiuwin;1:0irbhdcjqejkfhejgyojdphdqjxuj4wh9;1:cgujkz;1:jizwha;1:5kpbhechcgjhjivqhgwis;1:qil;1:0hd8in9hgeizjiskjymhgoh6qkcwgz;1:1hd2it3iw4hf5im9gyak3clbdjahhdmionh7ohfrfzsgl;1:2io3he4ir5h96gt7gy8kg9h6aioegzgflhjkihdjj2kk0lhangqojcplssjduhgwfj;4:1h63in4l75l97h98e79jiah4dj7eh1fiogh4hguihejfxkhgmndolkph4qgqrfftgium4wfn;1:5j8cj1;1:8ja9ha;1:pimqlhwh2;2:8jc9jrcixdhfhjijhfoj6ph7wh4;1:8hh9hbahbfk6ghhjharletjf;1:0kq1jg2gc3js4kw5h56ha7o1bhacgneh7ggthhcijcjg6kgflhbmhfpguqg7rjcsh7ugxvh0wkq;2:ah9jhfoisslw;1:0gdil3;1:gj6hiy;1:pim;2:8hc9j1;1:biqhkcrh8;2:mjp;1:eiy;1:hhcrk3;1:bimik4jhfqkm;1:gjn;2:3h97j4;3:gjmwhg;1:8hbchfqk6tjvwhc;1:8lr9hcah4bhadgqejhgiqjhdqiwriswjh;2:tim;2:1jl8h9ajnfhcjnbkglrgpwio;1:8hgjgxokzpjpsh8win;1:8gkajjdj2ujgwkg;1:8kmfh2nk5okspgkqhcuj0wh6;1:9is;1:0j01hf4it6h68j59fybk1dgefheggvigyjlbmhgoixpgsqhcrkatgjuikwkk;2:3he8m09kpbgqehefhggh7hisjhbkh5lgbmlvnh5ohgqhgrjhthewiw;3:8gy9j7;2:3ha4j8ah9dh2egyfhbgj7jmgphbqgvrghtkuwkj;1:5j69hcbgechaghhrpp;1:4j8;2:4ipvje;4:3ir;1:1hdriw;1:3m07hd8imah8birdgiencgikhjdkh5lj3ohfphdqgzrh1th9uh8wha;4:dj3eh7;3:efzfkj;1:qjb;1:0j71hb2hf3j94li7ffaiubhfcgyghfhjrikcjh7riksh8uhbwji;1:biscil;2:jin;4:0kl6hewhe;2:0jl3nm4is6hg7gmeiwfiljh3phgqgethgujjwgp;1:8gv9kg;1:1ls2j14iw7ikbh5ch6fh4ggwjh8kjklljmh9ogyph7qj5rgotik;4:wj6;1:5jr8iy9hekj8thewjt;1:4ikuiz;2:clghjbjhhrhdvjg;1:rjmwgq;2:5iuhkgrh4;2:1hd2jjohf;1:4j3mix;1:2jf;2:1hb3h74hh5h56hf7hc8k69mkajpblddgvegvhhaihejh5kiwlgwmh9nhbpglrh4sgrtirujowiq;1:nin;1:9gxel2;1:8jw9h5;1:djfegy;1:rln;1:dh9ejzrha;2:5irjgdqke;1:cipdj1rh9wiw;1:kjd;1:2he4jo5hd9feagregwjilkjplinnkjojdpjzqfjsh9tjluinvgawh1;1:kkbph8wka;2:2k9afzch8ehggimhfnjhaohdrm4simwk6;1:4jy5izwjp;4:lj2;2:ain;2:rjk;2:jj7mh9nkxsj4wgw;1:9hdah9bghcipggxjh9kj5rnjujt;2:ij8;2:1iu3hf6k27h3akofgegl3hkfjgolhbmisph7qh9rivsgnthhuh3vhh;2:0hf3h75hf6gp7fg8jr9fwalebllckbehefjkgkshiviiojfakgqlhcmgznj2ogxqh2rh1uitvgqwiq;1:oim;1:4jw8j0ao0bjkcgsfftkh7mhfoh9qiqrjath4;1:0hf1ng2jo3gx4hd5hh6k47g78hg9h8ahabh1cg3dhcehgfitggyklcok6pg1qjnrg2sjitiyuh2wg9;2:qjx;2:0hf2jh3h64j85hb6j37j58ixah2bjwdh2hiqjh0khamhaohbpgvqixrh7vje;4:lj3;1:wil;1:0is8h89jrch5jjb;1:8jgah8;3:8in;6:vkb;1:cm8rg7;1:0kt3g6;7:2j1bhadj4eh4ggzhjgkhdnjgoiyqhgsjzuixwgx;1:4jjoh6;1:kkcpjy;2:4kw;1:3heilmthguhevlxwg7;1:6kz8is9hc;4:8h69kzah9;1:1ge3kq7hg8p59kaah3dh0egmggxhisihbkgilhbmhbnh4ohfpjwqgurkmsh8vhawgk;4:9h5aj6;2:anobhdhhgrhguinwik;2:9g9ajwmmlnhbwgp;1:fk7;1:cjl;1:diu;1:oip;1:1jj;1:pjishd;1:jjd;3:eil;2:8he9irjin;1:nkaokypgx;1:9kk;1:dhgkj5vji;1:ikksivwgg;2:4k5gj6hjtjgh;1:8iwajuehgfh7jiskhg;3:9iowio;1:pj9;1:6jxvhg;3:jiz;1:hh8jhgtkn;1:pizuin;1:jiukjf;1:8mi9eubh7ekdrgy;1:0hg8h8cildgaelefhdghbifgkiwliurk7wjb;4:wio;1:8ip9hfeit;2:4iyrkj;1:8h39h2blifhfgjvpjzqhfrhewjn;2:9j3;1:0jf1gzwj4;3:0o13kt8jiahbjh1qhdwge;1:8gw9jzcgwjjm;1:rjh;1:8gu9jp;1:aj0;3:biy;1:8jp9h2diqwl8;1:9izagdgkchhejk9sgx;2:0injil;1:hh1jjx;1:0jqwk7;3:aivdilej9fh9gj2vh9;2:agvbjh;1:wiy;2:ujk;2:3h58kragvbhcej6fipgjbkk7ph7wix;1:6jr;2:lj2;1:kjw;1:vik;1:1h99ipiiy;1:6ji8l59hhpiswhe;1:6gx8h89j1ehcunlvlzwgr;1:egbfjvpivtim;1:pk1;3:9j1dh4ejwjgowkc;1:sjr;1:4k5mhbogy;2:2h64ij7j59ir;2:1h13h26h37gy8ey9g1agobfpcgmdmueswfm1gizjipkgvlizmh9nhfoilpgzrj4th8ugxvhfwew;1:0ix1k02ju3iv4j18h3ikjjg2kgsohaqhfrhbsivuhbvix;2:ljp;1:oglwkt;2:ghelj9rki;2:0hb8itch5dhgpj1qgnsiquhe;1:8he9il;1:ghbqj6;1:ehbjjx;3:bhbeh5gkcqipsil;2:cip;4:4j25hg8he9h9bgmchgdhdejwgo9jiwoh2rgcuivwhf;3:1hc2in4jb7h5aiwcgudijegxfikgj1hj0iitjgukh6mh4qj4rj5th0uj6wg3;1:0ik1g62hc3lfbj4fgrgiukhblm6rh2wj8;1:7g48gxah5fjkgm9hgwkhgrhbwmp;1:oik;1:aiqfhfgjfjiqkh7njsphcwk0;2:9iu;1:liu;1:wj5;1:cg8rkk;1:0f93ml;2:6iofhekkwwh6;1:0jm3ff6mx7hg8km9efbhaegvhfbjflql6rhftjaugivk8wll;7:hiu;2:5j5;2:1jh3h94h06h67hg8it9g9ag9bhbeivfh9ggqhhaihgjgwknvll7nmdoh9pflqh4rizthgujovgw;1:eje;1:qj7;2:git;1:1ha4he6go7ix8h2akjbh9cjhdgoeh9fimgjkhk3iiljgmkgymhcohgph8qgvrjbuhcvjuwjk;2:8j7ahefhfjhgkjgljlrgowjp;1:2gvolm;1:ej3;3:qko;3:qhftjz;1:3hh7hfbjmckmkh1njgqherh6sjntjduh9wh0;3:8k39h5ahebgrdj1ehgqjxrheuk2;1:4kg8j9khanfyokipj1;1:0is8j6bh3gj4;1:8ij9hgaiqbjudh6eisghehhhkkanh6qjjwh7;1:jix;1:8h8bj5jhfqh4rjjtn3;4:1irrhc;2:th7ul3;1:0hg1gp3h46h58jx9ixbh1cgpghfhhfil7pheqgzrh6shguklvkdwkv;1:8ir9h9bligk3hglpk5rjlwgk;3:wiy;1:uit;2:4jkjheqimwhc;1:5iz8j79hdfhgggxhiwjgkkj9ljophesjitj1wgp;3:ijc;1:8hfgm5whf;1:jk5wix;1:uhhvix;3:ag4rld;1:pij;2:3jt8jmrh8wgy;2:7h2jjp;1:jk0;3:2ix3j58il9isch6fjgmgcnhgpl3uhewh0;2:1h32ha4gj5gt6ja7jf8jm9gaagjdglekfffcgjahjyij2jjhkgjlirmgvngroglpgaqjvto3vh5wg1;2:jhbqk3;2:siy;1:aimbixchd;1:gj3;1:jh5rkc;3:dhdeit;4:8j4likrh8;1:tjg;1:1hdbh7gk3hjcjgxqhdrj8sksuiswh6;1:ljl;1:ahffit;1:2ll3h84h95kb7ixbhfdisiiljhbqioth8;1:wji;1:ijj;1:diswio;1:7j3ciofhejhfujl;1:aiwsiq;3:fit;1:8hggjllh8thdul3vhf;1:4jc6j5eilfip;1:eiwginlhdrk3;1:1k82hg3h34hg5j76k87gz9gkdgoejvfj8ghahgvkhdmgvnhepjhqh1rlzvikwf1;2:8j99h7jj1siy;2:5jo8hfkin;1:djifj0gh5;1:1hc2jz3hf4lp7ha8iobgtchadhdej9fgqghghh2ikrjh1lh5nhgog7qh5rhgujbwio;1:9inmj6pj3wiy;1:hipqiz;1:0il2it3kd4m95gy6gu7h18jo9jjagebgmdjyef1fjxhh6jh2kj5mgzogjpgbrgrufswl2;1:8j4gk4jh5pj3rhb;1:1lo2jb4gr8gh9kbdh8ejsiirjh5kh2olsqjcrgvuhbwga;4:8hgakb;1:ij1;2:fhdgitukm;1:cj6njnwhf;3:5iu9izcj6ek7fhboimphdqhfwh0;1:liwok3;2:8gp9lc;2:6hdjitphaqp8wgn;2:qk4;1:wjs;1:8jq9hg;1:uj1;2:ijd;1:git;1:fjr;1:3n97io8h09hdbltiikjgvqh9risuhawgd;3:6in;1:3iy9iwujawgu;1:1h72hb3gd5h56gp7q98ha9j0agich1dg6eh4ih7jpnkgulhgmizogrpj5qgwrk8simtgmugyvggwfp;1:oiy;1:gis;4:4h78gs9h8ahfdh7ejmkntlm6ohdpghujbvh6whb;1:8iw9iz;3:5j1;1:rjj;1:piv;1:kjm;1:1l97hh8lb9dzbirdgveijgfjjjbkl0litqh5rg8tj1uinwj7;1:aiq;2:8it;1:1h74j39hhhkwqhgrhawji;1:3hd9j6bipfj1hjijheqhfwj4;4:aflsl3;1:5kvbhfhgvjklmkpqhauimwgf;1:phdqllwh1;2:qjl;1:0iz1kn3jo4he7hb8ksbgtck2dhcel1ggthiskgdmgznglogxph7qh5rhgtiougevhfwis;2:phdqm2wh3;1:gk1;1:8ixrjk;1:hju;1:bj2;2:8ko9kqbhcdgyfjkhh7jh4kgolhgripsis;1:kjylhbqje;2:fj5;1:diy;1:6iwwhg;1:9jpkjslgo;3:wk9;3:bji;2:himpiv;2:pjl;1:5jc8h99hhbjmeimgh9jgxoimqh4sjftiqwjw;1:9jj;1:gik;2:lhbrk3;2:rik;2:qj3;1:5j2jh5wjt;1:1gw3he6h68gy9j4cjfdjgekbfh2hh1jjmohesk0th6vjrwgl;1:kj2njlojgwhf;1:0j9;1:ehgjk7;2:rjp;1:ageblmcj0fk4gjijgskgsmherjftj1wgy;3:3j1;2:bkjwiy;1:8jfah8pjg;2:hij;1:8j6jgwrltsil;1:3h84jw5jn6h77h28g19heagxch3dhggjwhhgniuohaph2qk1ritthevlcwjh;1:wjl;3:ajbejchj3jh7;4:nja;3:ak3cj1eh9fgjgiphjtij3;1:eiy;1:0h41ir3ij4h26kh9h1jfykkblitnhgogzpl4qgyuhhwjl;2:iin;3:8j8ahdrik;1:pix;1:rin;1:6k57heph2qmm;6:sjz;2:7gxshdwlp;1:4jdah5giorjdujvwhf;1:3irbh6cheglahhbjkvlhdqh9rj6th4wj1;1:llb;1:8jd9j7ajsbk5cimeh9fh1qiqrhcth8wgk;2:0gv2iw3gq4hc5ir6h37gr8rl9enagobh2dh6ehcggfherjo6kh4mhcnhcoh4pgnqnargzsh4tn7uh3wh0;1:dfzekhwix;1:7itcimdjgehafh6ghgrh6ujpwj0;1:djohharja;2:0jt;1:cj2minogvpknrggwku;1:8g19h7dikejlfgthhbjhgrliumi;1:wiy;1:3hb8haaiucknghhjkaplfrhcwgs;1:ah7cjufjlij2jhhrh1;1:3iliik;3:wj9;1:9jmhkdtinwh8;1:1hc3j08kfahfcmufh8ggohgxjgykjhmhgqhgrl8uh6wgy;1:uis;2:fjm;3:gj7;1:0h81gf3h06he8fx9guaknbm4cjaejjfjegmshgzkfmlhanhgonfph7repsjgth4ugywg1;2:5j2jh9wjt;2:8ha9jgcjfkj3;2:bjr;1:9izwjq;2:0jj3hgph6qlewgm;2:ej3mjusio;3:cis;1:1ldjjyqh2;2:6h47m8lhfpjjwhf;2:9jsahefh9jgrmgmoo6pl0rhgujbvhawgu;1:6l5wfv;5:hilojkqh9;1:rj2;1:1h03hg6ha9khbh8cgzdilfimjgrkjvmharjcuk9vjiwh9;1:7ir9kgagz;2:7j9hhgrjf;2:7ikpjnugrvjz;2:0h33h94hh5k17ha9lubgxcgydmwegjgjjhjaihdkhdohbph3qgwrgishcthewjv;1:1j18ggho5rgx;2:8iv9h8aim;2:1k53hb8jgblycgzeh3jh7mjpphguhawg6;1:nk2wgv;2:cjgdipjgrmjlrkfwgo;1:pjk;1:kil;1:7j08ha9k8ehb;2:8j7;3:3jr8gq9hdajnbh8ehffgygk8jj6khgmhgrj9ugjwl2;1:3h78ju9haeknohepherk9wjf;1:0iv2iu3h34jh5j96gk7gn8fv9gxagsbgech4eh8hgwihgjmamhdnimognpgjqnqshgtgzuh8vlj;1:1iucjyjgxrhcujfwkw;3:ej5;2:ojcwhf;2:2iy3in5h66jl8fi9heaisjhglijnisohdrheshgth1wix;1:iitoipwj8;1:hfzrli;1:qis;2:qk1;1:ajifjngisjhgmikrh8;2:0h71gg2h53h44lq7gyao2ch1df6ek8flcghakgvlh6nhfpgvqh3rivtimujnwfj;1:1hf4ir9kqchafhbgkqjgnohdqkawis;1:jirrjb;1:jmiwgx;1:7jkeishgq;1:bizgixoh6;1:2iq;1:liw;3:ojo;3:fj3kiwmj4;2:9itiiuuik;1:0h91gs2j83h06gx7j2bgofhegh9hh6jh0km0mkcol2pjjqhhrhd;1:8h69isejr;1:1j12j04j0aj5rgq;1:djj;2:1hc7gbbhdcm2ggyhgajjlmm6ojyph6rjpwg0;1:2mr4hg7kn8ipjhdrhfshbwhb;2:iiljglsk3;3:pim;1:4j2;4:8j2jjjwhf;2:8j59h5bkyej1wh5;1:9jvgjyrhe;4:7ilbhgqkd;1:ois;1:jiz;1:0me1gv2hg8jeahgcjtdklfj5gh4hinjh5khdmhfqhbthhuhfwgf;1:jir;2:wkd;1:ejr;1:ajh;2:6jmdioehdphbwjp;1:ghgjj9wiv;2:dio;1:0hd4it8ilqkv;1:0gj1ix3mx5he6h37hb8fw9lbafnciueirfhbgh8hhgijajjskhhmhepguqiorkeuhd;4:9il;1:8frwku;1:0gs3kd8k0dhejj9;1:8isfik;2:9j4ehdkis;1:1ip;2:0gn1oz3h87h58goah1bhbdjhehdgimjk2nivphfqkvrgjuhewh0;1:din;1:6jwsitwgy;1:3gs5hg7kk8haaiqbgtcgrdixegmffqgnthkokh9lhfmhcoj7ph8rg5sjjth5vj4;1:gjswj2;1:6ix;1:0gz4gp6hc7h28fk9l5aizdk9egmfgzgjjherimujjjnhfoh8pgyqh8rjhthdugqvhhwl6;2:dip;2:8hc9iyhip;2:qk7;1:9js;2:8heaiqdk7egooim;2:9j0;2:4iy8kbjheljqqjgrh0uiqwgy;1:8h2ajfbhcfh3gnsjktohhphgrhdsjmthfuh7wgi;1:fjm;1:bk3whc;1:0kc;2:qil;1:jiq;2:8h89grbhfdhbektgjjjhckhcnjaukd;2:0je1h73mj4h6;3:siy;5:1he4hf5ha6hf8lc9knajxbizchddh8eg0fg4gguklelgbmh1sikthbukjwgb;2:eitfjighehiqjgbwk2;1:qil;2:4j2;1:4lb5jxagvhirjh3lj4pheqgzrj5ujnwh0;1:dijrik;1:lgqqivrk5;1:airjis;2:2ly7iyjhdtj6wgo;3:0he3oi7hawh4;2:3ni5l76ha7jlchadiwfgzghdhj7jgephhqh6rh2uitvj9wge;1:sn4vk6wgd;1:1hg4j5wiv;3:5ikwjq;1:eiz;1:8iz9ik;1:dh0fjr;1:4jn;1:1gvgj8rh7wk7;3:eim;6:0h74j25hc7gg8kk9kfah3bh6ekphh3kgrlh6mh9ph8qherivvjy;1:fit;1:ghbhlwjhcwjn;1:aip;1:8hadl3eil;1:0iypj0;2:ah5fhhglakj0lhbqhbsje;1:1h32hf3h74kr5k46he8gx9kqagsbhbch9dj2eh0ghdhgpih9jgykgtmmjnheokjqfxretshetgauliwjf;1:uiu;1:wiu;2:9iz;1:0iz8h9cj7dh0ejxrh5tj0win;1:3h45ni7jw8hdcj3ikejgzphfqh9rhfwgo;1:0k76h58in;1:dh1fivljh;6:8h3bjzgiuqiyvj4;1:4jgeheujz;1:1h27he8ip9ijaiqdh9jiymjepjrwh3;1:8hddlxek2gjzwh3;1:1gi2iq3in4it6j67h08kd9hgch0fh0hjolhgmh0nhcoghpgoqh7rjqth8ul7vl4wgg;2:5gs7h78j99gwahecjseiqgh8hikjgzmgwniqpkaqkbrghshbtinwha;1:uio;1:0jj;1:wj6;1:4j0ajw;3:5jnjh3mjcrjcuimwh2;1:3hg4kn5h18ik9hbaosbjccgofg5jjbkhfmheoh7phdrj7th2wgw;1:ein;2:ailcikggyrh8sl5ukd;1:wl6;3:9hdciojilqjftim;1:jis;1:0jg3hd6hb7l68jnagkdgxehffgugh3jgtlj7mh0oknpjkqh1rgmujowim;1:3ka;1:8k2uh7;1:mik;1:1hdkjuljjmh0ngkpk9;1:ril;1:jiz;4:0h71h12he4h05gt6j47ja8j39gpagacj2dgkek7fgrgivhlbjj0kh0lgxmgwnh2ogopgmqjptnavhcwgu;2:njd;1:lj3;2:fjt;2:0hhdjbehafkwgharik;3:giullenh5;2:tj5;1:bheojy;3:cmirg3;2:wjn;1:gkf;2:0p07h3phewgd;4:gj6;1:6hbbixfipjjjristjdukcvfwwgs;2:8ipeik;1:8hgbhdrl4;1:3jbwh9;3:ahdbhecjyfgjhp2jiuphcqherk5uhdwgk;2:ril;3:1ipaikfiqjirpix;1:fixgjz;1:ahghj8jkjrhhsgnwip;1:oiqqlvwh2;1:ajqkgzvix;2:iiq;1:litwjg;2:aiquldvh4;2:4kwoiu;3:jil;4:ciuriw;1:0gv1gy2ip3lq4ir5kc6h37iq8ioakfcj1dh2eh1fgwgglihajf9kgulfnnh7oh6pgmqfuro8sivugzwki;1:0kx1kw2ko3jw4jt5h86hb9heaitcggdh4fiqhjolhgmhgog2pgsqgkrggtgzugnvhcwg9;1:fh4hkuuhfvja;2:1js;3:8j5dhggggjkruk3;1:jjg;1:6g7aixsikwl7;1:jis;1:wja;2:ainjjmwir;2:eizqj6;1:rij;1:hj2vj0;2:4khehggj4kh7lmdwh4;1:8io;4:6h3djiegpuk1viswjl;2:6haljbpoiqgtwgc;1:8j49h3bh8khbmkvoglwkf;1:8iv;1:gjh;1:dj6ek2ugu;1:pjmwhh;3:0hh1h68h19h9an3bgwcjudjvekhflogj6hg9ihdkh8nhaph3qhfrf8sk2th8uj4wgh;1:3gy4he6jd7hg8iv9ilbg2chgjkokknmhgphgqh2rhfsiptgnwlh;2:ggztk4;2:ch1diseh1finiizniuukivktwhd;1:3h85ni7jv8hh9h5jgymj6nhcpikqh0wj3;2:8gk9ildldpjhwhe;1:iiywir;1:6jp8iq;3:uja;1:0ir;1:jj4she;3:5il8h69g1ajsbhccirdh0fhbghehj6jh7kq2lfnohgphgqj8rg7sj6;1:ghehiy;1:nj1uip;1:9iu;2:ajcgj1jhfnim;4:wis;1:njl;1:jke;1:1in7jxmjzrh2thcwhg;1:0ildimggrhjgqjlwhd;1:bikljx;1:8juajckgz;1:siw;2:oirrin;1:2iu8joghejhbrjzwil;3:1ir3jjajcfimuh5whg;1:0f93ml;2:ail;2:fkmjimrjlwhf;2:1h32g64h25h46mq8jr9ghbgfdjafjjgivih3jfskh1lhgmh6nh8oh9pgtqgerlvtisujdvm3wgu;1:6ip9iulj0;1:jj0;1:2iv4is6j77hh8gm9h7bgzdl5gh4il8lixphfqhgrk0vgpwgi;3:wiv;2:1iv5h3jh4wl8;1:fj6;1:9jubjcklblh5nh9qj8wgz;2:0hh4m58gz9hgakxfh8koilgynh7ofhph0rgauiqwhc;1:7jr;1:alubhgegpfkvgiuuhbwhb;1:hgvukg;1:niy;6:5lh6k5iiwjhfql7thbvfpwgm;6:qjg;1:0jp3it4go5hc6hh7h28ir9h8ainbh3chghfeiknjinljupherk0sgduh6wmh;7:gj9;2:jjs;3:lj6;1:3jj4he7gs8iq9h4ajtbh4dh8ehdgh6hg9jilkhdpixrj4skduh7wne;1:2ischgtju;2:6hdojgwix;1:liqvmdwhe;7:1jkchgdj1ehetjsuim;1:8ix9gqciqgj4ojfvit;1:8iwbj9ohf;1:ciw;1:jj0;1:9iq;1:ciskh7nkrtiq;1:4io;3:1it3h65jm7hb9h8dhhfhfhh5jj6ljaoh9ph4qm0rghsgvtjtuhcwgv;1:rj6;2:8gs9j5dhfej2fj1uiu;2:0ka1g52hc3h14h45h46k87hg8gxah3bjrcjpdh0ehgfgghgpij2jlmkgolglmjgnh5ofzpo0qkurfzshetm7ugzvhewcz;1:5lh7h18j79gpjmaohhqgz;2:agmcimjlbogspgqqiyrl0wh6;1:1jljit;3:9ijsjw;1:tik;1:1hfej3;2:8h8ujn;2:ah2flh;1:5js8iqbisghfjhbqh1rgxtn6uj4wh9;1:fik;3:dj2ehhrij;2:8ki9klbj5ch5ehckjethbwgt;1:qj4;1:jje;1:4ikom7ph8wh9;1:6jt8k4fjjrh4;4:3kqqhd;2:ilxwha;2:bh7ghdhhgkjlml5ojjujawh3;1:3in;2:8jdbim;1:9gabjudk2elqghdrh8wh4;1:0h61j68j89mrdj1egykivrfywhc;2:0gshiwrjo;1:7j28hcnj9tk9uhf;2:3istj3;2:4il9il;1:0iy3jj6he8iqagjbh3dj7ekpfgxhiwij9lfeph0qiwrhgsgjuh5wj6;1:9fjdniefwgikjjdqheuhawkf;1:pivwj2;1:cjawha;6:9imjhf;1:tivvit;1:0hd1hg2h33gp4h25hc6g97ra9gaajdcgyggxhimijkjg3kh5lh9mh7nh7oirpiqrf6sn0tgpuiu;1:1ko4lz6hb8hgeiqjgjkhgliymgonheofpphdqhfrh2tj4ukmvkowh0;5:fje;2:3j4;1:al6fh9gh7sjf;2:aiw;1:2iq;1:8habk1cgjejyhjz;1:jit;1:jim;1:3ha4he5hd6jl7h88jkagmbh9fisgk8hggjj4kjcoixpguqj7rgmshhtk3uh9wjl;1:8j99lyagdfh3ghcjh7kkunh3ojaqktrgesg6;1:aj4lj0;2:0ipahgfhcgkaljswhg;1:bhdeirgjr;3:jir;2:pk2;2:1it7ly8hbdldhhgjgmwhb;4:1h82ip3js8gyaglbgdcqeehggfejk8qiorjbthcwgj;2:2gs3h94ha6iz8gv9hdahgfh1hiojgplj2njookqph4rk0wjj;1:oip;1:qja;1:0h61kf3hg4io7gr8gwajfblrck2fhfgfzhhgihdjhdkhclh8mhfoheph5qglrnisheth2wkd;1:3kp6halj5ojc;1:0imajeoio;2:2iy3gg4gf7he8gv9hcag5bgodgwfghggyijdjiokgalgtojrpherjzsilukuvk0wl4;1:giphhcjin;1:3j6rjb;2:aji;3:dkcjha;2:oipwiq;2:gjs;3:1h6rkq;4:fhfuk0;1:ajifjkgiqokbph8rh7;1:kix;2:hhhrit;4:4ivgja;1:0jb8ivbiloik;1:jis;1:6jtjj5kiuwha;1:gk1hh8mjosikuhc;1:3hb8gwahdbj0ehffjjgkahjfphdqh8wki;1:6j77iwjhh;1:2il;1:giz;2:bilgkb;1:plj;3:qjd;1:ejo;3:cit;1:oj2;1:eivfkajk4ojupheqhewh4;1:2gr7mn8hcjluoh3ph8tk6uiowgp;1:4jd9h2cioehcggyhldpjqqhhriuuhgwhg;2:dj8wjm;3:2k27j4whc;1:tixwik;1:2kp3hb7hd8gd9iwah0cjwdljfjejgdkgxlhgph3qh5rj9vhcwhd;1:0l71ft3gi4gz5hh6h7aivbjsck9dhceirfhggkqhg9ijgjg6klmlhamg6ogvrh8sh7tk4vhbwfo;1:4ix;1:0hg1h72he5jq6he7h38lw9gtaghbgich9dhfehgfh3gj7khalj2mjrnhfohgph8qk0th6uk1;2:7iv9jm;1:rjswgw;1:5m0ciurgpsipwgw;1:0ja3hf;1:8jbnj2oiwwh7;1:1hg2k58itcgqgjehh0lhbmj1njloimwha;1:bivdimgjujgxwiu;3:sio;2:0h51gl2m24l06il7gv8fw9jheh8fh3hgziisjovmh6ogmpgeqfvrgpsj5ugpviwwgv;1:6iwbhglj5pitwjn;1:5hd6gv7it8lh9jiajybfgdmcektfgagj1ihgkfzlhamh5nh1ogypgirgwshbujgvivwfp;1:jgzrk1;1:6h9kiyvix;2:dil;1:0iu;1:qj6;1:iiokhclkonhfphfwjj;1:6italxfh8gh2sjcvhewhf;1:ajkfjwwha;3:4hd8gn9hhbkafhgggdjkykj9lh6njjojlph8qkbrgdwil;1:ujevk8;1:8gb9la;2:bj7chf;1:9iu;2:4gjim0;1:6gv8kyjgzvlo;1:1gp4he8h39incitdiqeh3fhekhdmivohgpjxqh8rkw;1:wj5;1:bip;3:bjscjdjjarhfwhb;1:5iqwja;1:dh2ej9mippis;1:wik;1:0k3cjwfj4ghdkh4llkmh9qjyrfkwh1;1:8is;1:hit;1:ikzrka;3:fje;1:djfejm;1:8jhgiy;1:agvblfchffgzgjbjhesjruje;1:2gb3h35hg6h78c59r2aflbkjcgkdkjef0ff8hg7jk8koilgzmhenhcph3qjwrm6tfuugqvguwj4;1:8kcgkkliswh9;2:1h83h04h85iw7hb8jc9n3ajpbjkdh6egrfgzjhekj4lhdmioph4qiorivshcugdwgz;1:8g9ek3;2:dj3jhglip;1:6n57g3wgp;2:dh6eiugit;1:0he1jp4h99jmaj3bjnchdeinfirggoijcjh9kjvph4th6wgm;1:8iowk1;2:5ilbil;1:pj2;3:7ir;1:4j17j9cimdheeix;4:sir;1:dkdrguwj6;1:8in;2:jjv;1:0iu;2:7khbj7cha;1:sil;1:8j2;2:6lc7ja8hfehhgjpnioqgythgvgjwjd;1:wip;1:0ha3j54hh5ha7gd8goaiobijegpffygj4jjtmh3ohfsnztkiuhavgz;2:8j4bhcchdgj5;1:3n28gj9irahdhhhjjllirqkgrivuhdwew;2:9ip;1:4jj;3:0k61gw3o56hg7hbfjpgh9ijejh5ph4qh8wh0;1:fisljd;1:8rd9eaegn;3:7khdil;2:3iq;1:qiprj3;2:kip;1:jghqj4sk3;1:nk2;1:1is3jjggsqjswhg;2:jkh;1:aj0fhf;1:giqjip;5:jjz;2:4isohcrjltiuwh8;2:ril;1:gin;1:piw;1:9gxdlbegj;2:ejl;1:3ki;1:9j1fgwhjz;1:4iqaikrhdsgv;1:1im4hb5im8iy9gpegqjhfkhfojjph9qmnrgtsj1tisuiuwgc;3:aikqj1;1:bhgcj0jmmkj4rhfwgx;1:jiotiuwj4;1:2iv;1:8jl9hg;2:1in8j9agtfjxggrkk0phguim;1:skp;1:djl;1:1ksgivrg7;1:8k2aj5uhe;2:oj6;2:jijwiv;1:4iq7hf8jh9hcbjhckgegyfhfrgptjiuim;1:jil;1:ghgrhgwka;3:aiq;2:2lh;1:0j94il;3:dikjjf;1:hiy;1:8il;2:2gz6lx7jijhdoh9pjdqh5wix;3:vix;3:hfyjk9;2:0g41ha3h74lj5hb7ha8h09frbkxcfpdgreoygjphheigvjfskkelh6mhenhgoj3qjbrkmsgwth0uinwf1;2:cikfj2hkojg8mjp;1:qh9wkk;1:0hc1he4jf8h0jgvkgvmj4nkuomhpkbqh0rgythhwh4;1:0hf1kf2ka3h64gg5ip6hf7gv8jxaj5biwcilegmfh8gglhk6ihfjh9kh0lhdmhgnnipgxqhcriktglugtvhfwfz;3:7kp8ju9g9clxehfqhfrg2;2:0j23k4aguhgyjgcrlvwj6;2:hik;2:6hc8h6bjech0firgkhhjfjh2qltsgzuh9vj4whe;1:vit;6:7j1whd;2:1h23gk7kl8jlal6cisghdjh3khflg7phhqgzrjatgiwli;1:ak8bhfjh5ohbqiqrhcwkc;1:2in8h1jj9tkluhc;3:ahdmkw;1:wir;1:3jtwgz;1:cip;1:oiu;1:2j7sim;1:0jo3h55iu7km8ju9hcbjlcioehegj9jh3khflhfmhgph6qgvrgxskfthauhcwj1;3:8go9joeh9fjatitviy;2:8gu9j3oilsjtwj9;2:hiu;2:hk7jfwqj1rhewll;3:5j0bh6cj7dijgjejhdojxripwh6;1:0ko1ir3fm4jy6jk7jz8gk9n4bjrchddj0eh3fgzggqhjtjf7kgslhdmh6nhdogzpgvqgdrjptglugyvhcwiq;4:7io;1:gio;1:8izbjhdhaeipfjujhfkj1nh7qj2whc;3:6kwpheqhe;1:jhfrkg;2:4io6he8h8gl4jkolh5onepgtqhhwh1;1:9jlainfhbjhapj7qjxwh2;1:6gnfgxgjkhirvjh;3:1gy2je8gh9haakpbh8ch8dh4egdgj3hhdjjyphgqh7rjjsheth5umpvjp;1:aik;3:8h9aiqbm2cjyhjpij3kjtqhhrfk;3:1jk9jfjjqqk4whf;2:jhbnjdwj3;1:sj2;1:8kz9m4ah5bhgegwjgdrkvtjsuh8wh2;2:cjd;1:chbeiugnj;1:6k08lm9h1agkdheegfmjesj5uj9wh7;2:ajcfh4;2:2iv;1:tjbwik;2:8jgjhdvkf;1:div;1:dkgefkjjt;1:six;1:jj1;2:1jt2ft3gn4h55hd6h07qp8ikch4dgweh4fh2gimhj0jilkh4mh1njcpfsrh4ug3wj9;2:1h46itcjighchjmjgskhgolgqjurkhvh7wfb;4:0jc1ik3he4h86k57h68j69k8agebhcckbdileg3fipgh9hjajgwkhblhcmhfpgzqgirgtsiwtj4uiqvgmwiw;2:dgmejf;4:uio;1:7jbjguojcphfwjc;3:uip;1:ck9flcgh8whe;1:1je3inkjhphgrizwgx;1:djjeh7fjyhhgjj1kgymkbnhc;1:gh7siu;4:0kq4gpaiklkosiquhg;2:4ix6hc7hgej3giphh0jmrkjpph7qh7wfz;2:ghfriuwk5;4:9j8aj3cjcfhagh7rg2wl8;2:4jnaimohdwis;1:5j0mjrriu;3:3hc4j16ge8hgeh5fk0jh2mkanhaqh4riqvmm;1:2il6hgolbpiwwh8;1:2ke8iv;1:8ikwkb;1:cipjhfqlawhc;3:jiq;1:7k7;3:6iyrilvhe;1:4j0wj1;2:9iq;2:3jj9hewk6;3:3jp;1:0hfiil;1:cjl;1:rj4;2:ahcrjw;1:5ix9hgrmkuh9;1:lkf;1:8hdah3fgmgo7jgtphaqlb;1:8ip;2:9ix;1:8j7fimgktjh5rio;1:0h61ha8jeagebmogithhfjkokgnrg6sk0ujkwh3;1:djqkjargfwls;1:nim;2:ikz;5:hinujv;1:2j14j1;1:2it9kpbineitjhdrgx;1:1kd2p64hf6hb7m28h89hbghfhhdjhcohcpheqh4rhavjgwg0;1:airfjwhj1jh2kiqljmmiwpherh0wk3;1:8j3tiswj8;5:agasheulu;2:cinljx;2:1irbjbkhg;2:3knainijenilwgz;1:4jwshg;1:8gn9h0bhfchgdgzeg6fhbhhcjk3risuotvk4wiy;1:ciw;2:ahckkf;1:ujh;1:0j24jq8imdg0ejzfhbgm7miwpipqj5rgpsgwuhawg1;1:1hb9iqwl2;1:ikr;1:nim;4:1gs2h93gq4k45h79ktairbj8chgegahijik0jgylgnmh1oh6pgtqgerktugpvitwjb;1:cj6jhe;1:4ke8jwchceirjgsohgpisqlarh4wgu;5:1iw;2:1hdcit;1:hgzjks;2:1kffikphg;2:1hb2im7hh9jpagjbh7ghhhjoiiljghkj3njioh3pheshath9wj2;2:bj6;1:5im;1:2jk3iz4hf5he6go7iu9h1bj5civeikhimiilkkvmgwnirphdqh1rgbthfuh9vf4wlq;1:0iy;3:4hh8fv9j9aiubjrcjifgcgh9khbnh9pq7qh4rhd;1:8gzchejjftjt;1:ahgfk2lharjswh2;2:fik;1:cmirghshc;1:9jgdjmegofh0ghejmzofupnoqh3wgi;2:8haaj6cimfh5gmnqissjtwh2;1:gj3;4:wit;1:cisgjjjhepjcrhatjnwh9;2:8iobhbfk8;1:1mp8lhbhcghajkpkh9lhenhboh5phaqh3rgpwl3;1:1ij4jv9hfakubgzchbgh5jiqkh7ohapm7qjsrgntilwh0;1:cimmj6wh9;2:6hdjipkizsiuvj7whg;2:1hc2hc3ml6gm8grbh4cj5dh6eghfh6ggvhgnihhjh8kj4lh8mh9nh4ohfph6qhdrj0shhtghuogvkywky;1:qkrsgr;1:3it9io;1:chfejyqjotj0wh1;1:4jrjjkwh0;3:snmwgu;1:aixbinmjurjewgx;1:6kgaiugh9hkzph0qhdtjk;1:5fp7jw8iocgpjlkqjtwh2;1:8ha9irijpjjoqharh7siotj4;2:ogjpjr;4:7jpjijohbpjx;2:6jbaiyvh9;3:fj4;1:rj3;1:glnjikwiw;1:4jepiw;1:kh4lklrh9;2:ej7ihejk6;1:3k0bh3;3:0ix3hg4hg8jlagwbglcjcdh8hhdjkgkglmgunk8ohcphbrk2tj7vjewgs;2:4mjcinphc;1:5hbagwfk7;2:hkerhd;1:pik;2:1il8jkjgskiklh9ok9qhfrj2whb;1:2j1sjm;1:dkueguuhavik;1:1gxilw;1:3ji4gvaiubhechegiqhfdil7jkcqisrkgsgduhc;1:1ij3kdcjmrgkth7;1:2jhnip;1:3hh5jb6mi7jajgenjkph4qheugovn8wgn;1:8j69h9bk6ciydizehbgjsrhesj3wgp;4:bhfrilwki;1:3hf4he8k0bheckhdikgjoqh8ughvjn;2:ojs;2:1ix2hd3gy4gy5gv6h17g28j69h9agxbgncgqdglegefgtgj3hgxjk5kg3lgxmlmnk7pfrqivrfvshdtgnupkvmewjy;2:0he4hf7hgajjcirdj0eh3filhizkk4mjrpjgth5wgn;1:aj5uhd;1:dit;1:biwgin;1:3im;1:bj1;1:7jf;1:fjewhf;1:1jo2h5ohgwky;3:6gk8ke9h9dipegwujzvjf;1:qj7;3:wj6;4:3inpjz;2:dfqeoohheuhg;1:pk4;1:nje;1:8hd9js;2:7jkeiofjohkmugvwh8;2:5ipjjnwh2;1:jiouik;3:hk7jiywh6;1:jh0wll;2:ckbeh2;1:4l66hhwhd;1:kjd;2:8ko9o9ah6ch5dgnrhhwhe;1:oj6whh;1:3h74hf5hg6hg7hgchffg5gnchkdiinjmonhfogmpk7rh4wfp;1:4m18kw9gqdgcejujh1ogyqiq;1:bitrkf;1:liu;2:1hf3lr8gr9j4ah9hjtjjfkjfphgqh7rgw;1:oiw;2:1kf5iwrgi;1:kitpkk;5:8izahdolmphasgt;1:ais;1:hjf;2:ajbsh4;2:2j93h14kh8iuuhd;3:8kf;1:9kacglfj7ljw;4:jhgwj5;2:7iy8gucmfegith7wj4;3:ajhfirjhbqir;1:6jlhhctiz;1:8lu9hdcikehc;3:9hcbkhej2wh8;2:4iv8h79j1eiwhjnih8uiu;1:6gk8kf9h5dipegxujzvjf;2:fip;1:0gu1h03ji4h96ha9kgaiqbjhdj6ej1fk6gjzihgjh4kgblh9nhdoh9phfqhdrhgsistgzwgh;1:0ir3it4he9hdbhadjgeitfiyggyjimkgslkhnhhoh0phhqgnrj7wiw;1:jhhokj;2:fik;1:eh6um3vk1;1:9h1kjxriy;1:nimqjj;1:nj6;1:aimfin;1:7he8izdhdehdjllqj2rgesjeuhbwiz;1:tkxugkvl2wha;1:cio;3:hil;1:0j1;2:9hcbhfgh9hhfjh1kh3nutohbpktrgpuh9wg9;1:9h3am2chfdlzegmfghwhe;1:9ikaip;1:0jm1gc2ky3h24h26h97gt8kx9jybf0cgfegdgmphinjj2kh7lgvmhbnhbohapgsqiurm4shctjduhewf9;3:6hbjhgvjz;1:6et7fdpffqqwwkf;2:2iy4izaiqdh8iivvj2;1:3hg6lh7hg8js9h8bk1dlbejyffeggtjgukhcqhethguhcvl0wg2;1:0hg1hg3gu4jp8k39juagnbgmcfrdhefkrgjmihdkj1llamhgnhfpguqh4rjysheth7ugpwiv;7:3gx6iy7h48gt9j6alcbgqfh8hgpjgckm4lgbnh8pjuqh7tkawit;2:mk3uk1whf;1:1hg8k39lualdbimdhcegifgmgh1hh8jflkjelkanhgqjvriushfthauhgwgm;1:0hd1ha3gl6h87h99jtalxbircirdhgfh1giqigejkekh2ljlmh9nh3oh9plrqgerh4uj0vh1wgl;2:2j2;2:riu;1:gj7rizslfwhh;1:6h1himpkavim;1:9l4chffiq;1:8iv;1:chffjbhk4jhaskqthcvjnwh5;1:5ik6km9h2aioghghhboj4pilqgyvgwwiv;1:4ionilwiy;1:4j35il6gu7grbiwchedh1eingijihfjjinikogyqhgrguwj6;1:aki;4:8ji9h5aiodgaelftglukpvhg;1:7j78ft9jnag7chffjthk8jjargywjl;1:gj9;1:ijh;1:gggqjl;2:0jq2ix3gu4iv5li6hh7hc9izah2diyeg7girjkfkhflhgohbph9qgvugvvhdwit;2:ggvhjt;1:8ivah9jguwjc;1:wjf;1:1l8wha;1:ljl;1:bjirhf;1:0hc7h78m19nlagdbgyenhjgvqh8rgsshbwgr;1:jhekgkllvplc;1:8h4bhdrl4;2:8is9hb;2:8js9gt;1:bjj;1:8js9gt;1:piz;1:rj7;1:dhfejtjgvrk7wh9;2:0go2hf3h04h75hc6jm7k19g9biodivegnfgwgkkjmskgrlhcmgtoh6rkeshevilwg1;2:dk2miz;2:eiw;2:4hgija;1:1gy3lfikwwh2;3:3hg5l66lzcithjyjgrpgyqgbwfb;1:ein;1:0j83j34h95hg7gr8je9jtahabhgchbdixegtghfhh9jj8lk0mgqnimojoph1qh8rgkuh7wkc;1:8hghivujrwha;1:9io;1:1eo2it3h54hg6ix7gv8j59gtbh6chedhffhehg4jj0kh0llbmfnnh9oo3phcqk7rg0tgyvh7wmp;2:rjewh5;1:8iv;2:cgpmjgriywja;2:5l16hg7nl9inhjjjg5lilphdqh6rhcwft;2:mj7wj6;3:3gm6is8is9ffagzbh0cgxfgigjyhivkjplj5mhhnjeoh0pj7tiwuh4wk9;1:wje;1:dikjip;1:8jr;1:wiz;1:lit;1:1h8ggujllqjs;1:ahgujyvhf;2:2l7jh1ohfqmsrh9uh9wgx;2:2jo8haaiqfjehiwrh9uhbwk4;1:ij2;1:iik;1:pk0;3:cj1gj3;1:lkn;3:hiuihenjxrgnsjj;2:pjg;1:ahdcjxjh8pimrhbujwwk4;1:firghd;2:8hfij6kjwlh7mjbnhcpio;2:oiy;1:7iwjjxwhe;3:aiz;1:wit;2:0hg1h63h34hb6hh7h19gebo7cjvegvfirhglkj9lljogoph0rkmth7uhbwhe;1:9j2jhboh0ql3;1:hjdwix;1:6h98it9hdviq;3:2iw3j38jjdjbeh2fingh8;1:8inoj0;1:0g21h43hf4ma9gdaj6bkccgndebek7fhfghbigyjg0oivphgqktrl2sgvthguk6wiv;1:qjh;2:jjd;1:1ku8gs9gvhikrjv;1:7jk8hc9kgah0mjgwha;2:dhfej6;1:2l63jm4j37jachcdimsgxwhe;1:his;1:aghsk5;3:8ha9ivcjehixjjgqhgwja;1:0je9hfrjl;1:ejchh0rizwhe;1:cit;1:9itsiw;3:1kq6ilahabgtgglhhbiizjlkkhdph5qirrgssiktgyug7vjowm5;1:0iq8imej4fh5hhaqhdukewiv;1:3h84hg6hd7l78jd9gmagqbl1egzfhcglfkiqphaqlirgyth9uivwg0;3:4h65ji7hd8jxahcgh3hh8iisnmhojmqhhrhfwh1;1:hgzjiw;2:bkmehe;1:1ji8gxfh3jg8kioohgpiuqj0wll;1:1gr2hh3gk4he6h38j89mkakycg5eh9fixgh9hj3ij1kkllhengeogtpg0qjtrh9tgauhcwj6;2:8j7bh0wkx;1:1hh3hg5k77jr8gqcitehcfh8gipjgikhaqh2rm3sizth6uj7;1:dh7hl5rjkwhc;2:ain;2:biupiv;2:4ip8ilqijsgw;1:ajk;3:cjheikfir;1:dg8ekb;3:jj8;1:8h2egxrl4;3:0gv4jzaitbj6ghd;4:0jc6h3eizng8pliqh9vit;1:wix;1:uip;1:1gt3hf5hd6hg8gw9hgagpch2fj6ggthj2ipwjinmh5oizph7qipriwsh0tkwwh3;1:jiu;1:cgomjgtkfwit;4:jir;1:3k16keqhgrk1wga;1:0h71hf5k36h98jzagjbkxch4gj6jkargqsjtvgwwh6;3:ah1dikehaflc;1:ajddjhegufiqkinrgt;2:3k88hfchfghgiiljgzkhalkinhbphbrhcwni;3:1hg8ix9jwaklbg3eikfh3jg9kkqnh9ph7qjysh3tjcvgy;1:8h5ciskinliu;1:0ik2h63km4gu5jb6h49hdagtbircj4dghfkdglohh5jg1kh5linmiknhfofvpgkqnerg2skmuh4vhcwf3;1:dk6egljio;2:dimolbphbwh9;2:ciqoir;1:0h58h8bjhcgenjipj8qkquhe;3:rix;1:gishim;2:2fm7ppjh6whf;1:7jlfl1ijsjhgph9qj0;1:1gz3hg5jk8kv9fhalsbjlcgxdj2egcfgkgm6hh8jgzljwmmwohgpgfqh3rg1tgsvhgwfp;2:0jd1gm3h84h66k97is8gtbjkdiyejgfhcgk2jhgkjblh5mh7pjzqgjrgjthcuhevgi;1:hjw;2:jix;1:himjg8wkr;1:pjs;1:1h97iuajsbj4eh1hh8jl1ogyph6qjjtgt;1:0h31jv2iv4g96jp7gx8fy9ggah4bhhcjfeg4fhbgfzjfakh0lmeojgrjxsh7uk5vlc;1:2jhdh4ej7hgyjjbninrhf;2:eji;4:rjjwjj;1:3jj5is7h88gw9jbahbbipck5dgbfh7ggyhiwjgykhfphbqlzrk1tgs;2:5jf8k59hejhcohaqhfrk2sk0tj4wh5;1:0h32hg3in4j15hb6ha7hd9h6anrbimcgnegvfingiyhh9ijwjgkkgwlh0mjangyogypgtrkfshftgtuj4;1:0it1ix3is6h77ha8kqaghbgifgoglqhh4iiwjktlgdoiwrg3sg0thgugzwk1;1:3hg4hg6hd8l49n5agwbfbcgodflelpfhcgg4hhdjkpkh0nheoh8pk2qiyrh4tgiuh7wl5;1:bhgdjckjj;1:hhgjj4;3:8hdgk4hiprha;1:qjl;1:1j6bj1fiokj1liw;1:gjq;1:2iu4h55ik7hf8h7ajdfgvgh5hikijojgkmjyrk9vjwwgv;1:4izbgskkf;1:bj4tix;3:hj2;2:qkxwh4;2:8he9iw;1:8jk;1:giqhjmrhatjn;2:ljy;1:5is;1:fkg;3:niv;1:dgvojcqiqvjswhf;2:0hd1gp2hg3gz5hf6gv7h38ilagzbgvcj7dl5en1fkggjvhimjhgliumh5nh3oh2pgyrfrshhuk3viuwfp;2:djaegolhcuk3;2:8kf9ktdikojethfwh2;1:aiu;1:eim;2:hhejhdqlt;3:4h68ku9ikij4ok4;2:4j1bh5okaphgrkm;1:3iy7is8jubjfcjcdkfegmhh9jixrfkuhc;1:0hc1jk2qk3mb4h26h67m08hgbhfch8dhgghfhh8jgnoggph3qfkrh4thcuj7vj0wg1;1:kix;2:qknwhe;1:4ozojbphbqhgugs;3:0in9jxaghbgzch7ejofjpjh0kkcljcohcph0qhfrijwix;1:qj7;1:gj2hh8jhgtj6;1:hiv;4:8hd9inuit;1:2j03gn7iq8j09h0ahgbhffknhj7jgvmhhqhgrkpthfuh3vhdwjw;1:8la9j9kh9lhcnnnogurgvuh6wh6;1:jit;1:1j62jr6ke7hg8g0egaghfjh9kjwljfnk0oh8pgpqgtth6;5:niq;3:0k93ll5h66he7he8h5jj4khfohgpheqkctgqwkr;3:0is;1:diwiin;1:9iz;1:bl5rimwgv;4:sj8;4:qkk;4:riq;1:cjxrh1;2:hjgjiprhfwjy;1:dg9ek0hkqrh8;1:ahebjvtizwjk;1:5jm8he9iragwbkdck2dh1eixghajjjkhglhcqh4ujswgm;2:9henj6;1:qjaug4vk2;2:8h39j7gj1qkjwhe;1:ailgkbwh7;1:8jb9jsdizfimjiuwhf;2:ojd;6:0h83hg4h97h29hdaj8diqegtfixggwkjzlhfmjnnhdohepiuqh7rkstjguhfwh8;2:6he8ixch4dhefhbgj4hh8jippkxqh2rhesiyuk5vjjwgu;1:wjc;1:2ik3hg6ja7he8je9guairjhclilrhdwjq;3:cj9;1:0nd3h54ip7he8jn9hgckbeingjtjh3kh1minnhaohhphdqhcuhcwfp;2:7j2;2:wiv;1:mgxoj2pkrwhg;1:8h3bh4gk9lkr;2:wjo;1:jhewkt;1:8heahbbl7chf;2:0kv5jq6hbdijehcwhf;2:dio;2:qio;3:3izbis;1:7j2;1:eiuniu;1:kiztji;1:3j7dkoef4gk3qk8uhc;1:jiu;2:rj6;1:3jh;6:9io;1:tiu;1:ehajjo;1:1g4fixlhgrh4wls;1:hjajhhkjr;1:0h03hb8hf9jadk9ekgfjgihhkivmhanhfph2qhbrgvshguj8wh0;3:8hd9gwcilej4fk6gh7khfuiv;1:aizfhflja;1:7j98j29jvchedjfghajh9qhgujkwgg;2:hizmjyrh6whg;1:9jvcgx;1:aiq;1:cjjghepjzwhc;1:3j4;3:0h81hf2k73he5j06he7h2agdbhecgodjhegbfgjgfwhozihejljkhfmgynhbogypgmqjoriruj6vjtwg7;2:6j0hh6jjzoh9pjsrhdukawhb;1:ij2;1:8in9h2ajmeh6fkj;2:djbehc;1:rim;2:0jr1h3;2:giw;2:0he1hb3h94k45hf6he8it9kiaftbh5cisdhcgh7hgnjlpnjlol9ph1rj7sgjtheuh9wgm;1:0hg1hg5j96hg8ji9joagnbimcjcgh3hlsjjskhfoh7pilqh8thdvhfwfi;2:ikzrk8;1:9ik;2:rj5whc;1:8ju9h4;2:aiwbgqdj4kiv;2:djregv;3:pn4whe;1:4ik;1:biplj3;1:2ju;1:3m7eiwjgzkjwph6uiswg7;1:1jd;1:7ks8jv9gobjyciqdh6fikjgakj0nh7qiq;1:bhgrj3;1:anqrhguip;1:fj0giswjm;1:0j82he5ha6h27g48j09gxbjyeghfhdhfiik0jlwkgwlj9mgwnh5pgoqjkrjxuh4vh7wjv;2:pjb;3:8h3alcgh9;2:dikhj6;1:0k48hd9iuahgrjxsiu;2:7gt8imbjgcjweikglihhdwgv;1:ckirhc;1:6ir8ik9hf;1:5jc;4:4jj7iyah4wiu;1:cjmuis;2:bk8fh0;2:gjpshd;2:ohgpkv;1:eji;1:cjarip;1:sin;2:0gm2jd3h24om7hebitch1dixehfggqhirjk4kh9ogvpiqqh8rhbwix;5:dix;2:gix;1:fit;1:1hbgpqjh1qjqrg9wgw;3:3ha8j79inagqbjdch7gjdihfjjxlg7niqrf1wmf;1:hiq;2:gk0rin;1:7iofil;8:3ku4h8nio;4:9hgcjorgotkh;1:1he2k85jfcm1jltoixphcqherg5sgruhewgg;2:ojm;1:cj8litrh6;1:3k38gkblheh1fizggxkh7qhcriytjhuh8viuwg9;1:oh5qj8;2:3kr9hcwik;1:qjk;1:5izhgkjjkljuwhc;1:dhffis;1:9ivwjf;1:girjhc;3:5k58jvrjvtkauh5wgn;2:8meegxghghintjpwgw;2:2j0uim;3:wjc;1:aks;1:1jbahbeiyfhfgjvhh9jhbqj4;1:tix;2:bimrks;1:0h72gw3h24h25h96hd7hacggffxgpxhluihejirkkonh9ohcpgsqgzsj2ujnvinwgj;3:tjg;1:kiu;1:8j4;5:bj8khe;1:cj8;2:direhfwiw;3:0kz4gi8h59hecj8dk0ek8gj7ihfjh5ljarhewgg;1:kiksj0;1:2hb4iuolc;1:3ir;1:cilvim;1:7in;1:1kk3hc4he7hdbhceijfgbgirjkskionh2qjyrhfwjd;1:qjn;1:bj9;1:rjywgz;2:3ixehefiogheujh;2:6j0;1:gheljwtj2uj7;1:7j5jh9rhf;1:7js;2:dj3egznjtwgs;1:1ixaikbj5djarga;1:kiq;1:1ha8hdainfhcjimkj4qmsrgzwjn;1:8hg9gadk0elnfjhghh;1:7kmpgq;1:6j7;1:8jn;1:jf5wlu;4:ljmojp;5:0k93hb4gb7hfbj8ghcilajg8ljkqh4wl8;1:rip;1:qjpsilwhe;1:8hd9gvjjkrk6;1:dgthkh;3:wj8;1:0jz1h3iik;2:8im;5:1j45it7im8ij9h1nipoj8phergssixtituj4wgq;2:lit;1:0gd4ixdgvejrgiuikrkiqrhcwhb;1:0in2h13gz4iw5hg8h6ah8fipihbnheoj6qjluhcwiq;1:8itbik;1:8imkjt;1:0h91ik4j17hg8iu9itbkodlpekhgh2kgylhcmhfohhph6qgorgcthewgs;4:chgritsj9;1:qj8;1:8ha9knbiycijdh1gfphldjh6kh1rhesjkthgujlwh4;1:8hbpjptj6;1:0fpik7wim;3:8ildirfj6wj9;1:0iyjizuj7;1:5lb6h57g7ak0eh6fjfjizlh6oh2pgzqilrivshdtkdujdwf4;1:imn;2:6jv8jo9g5kilpiv;1:uluvhg;2:6mqahbbj3ph8sipwg3;1:2gh3gs4gn5jk6jl7jh8l0al3bivch4dh7eh4fgjgiwhgdihbjgokh0liqmk0nhgogmpnsqgzre4uj1wf5;1:2il;1:ah5dj7fjcjiwsj4vj0whf;5:1iq;1:ij8;1:ajqshe;1:uhfviz;2:3ko8gk9jycgxhjcljiwha;2:pji;3:il5;1:1gf8h9ah6biqgikhkbjgxkhgok4pj5rldwh6;1:9iwcjq;2:jiq;1:gjh;1:dk2egxhikjh9qjd;1:0jf1hd2h63h94kz6gk7h68h1afpbgzcp0fh9gguhk0jfwkgdlghmgunnyohaplxqggrgwth9uh5;1:8jlqh8wkh;1:cj9;1:tj8;1:ffaul1;1:pja;1:0h21g84kd7gv8jk9h0aj1bh7ch3egbffcgj5igajg6liloj7qjrriusistg5uinvgzwm9;1:0kx1l04ip8ip9h7ah7bgjcjmeh5fh3ggejgpkh0ohdphfqhfrkdthdukuvjkwh8;1:1ha3hd8otah2bkbchcdgwelofhfgj6hhfjfzlj4rh2shgth8uh6wgw;1:djregk;3:0hf1it8gdahachefgxgj6hmkkjtmjgqkjrg5wh5;1:3j4;1:oivwjo;1:0h71ku2tz3ip4jq6h67l88h59hcbh8cgwdh3ehefhcggxhgrihajgpkhfmhbpglqg3th3viqwfm;2:4kx7iw9h1ciodhaeikhhgohhqgvtlauizwh9;1:wir;2:qj2;3:kk9wha;1:0gl3gw5ir8km9fpaiwbhccksfgrikxjgtkg4lhemh0niopg1qgcrlisj8tilugtwkc;2:wiq;1:8iuaimpgswkr;1:1ix6h3dh8eisfjqujbvjawh1;5:6jgqj5;1:ahdhimuju;1:kj5;3:wj6;5:4is;2:1gy3jrwk1;3:bkpqiywhf;1:8io9io;1:giqnjdojpwh6;1:jiqwio;2:ggztk4;1:4j06jkch5wgm;1:diwqj0;1:0gr1l12h43h04gd5jc6h17h48jh9fzah9bh0ghdihdjgtkjdlkimiwnlloftpivqgirjcsj8ujpvgswfw;2:fj1;1:0hg2hf3he4j56hb7h68gb9gpajqch2dfvfl2gh3ihgjgfklxlj5mjqnizoimqgqrivtk6ug5vjxwga;1:piu;1:hinijc;1:2jmsgv;1:8h19k0jkfqk8rfv;1:8hggm9hhgjhhqjjwgv;2:bjgehfrkr;1:3jm6hg7kcajjdhafh8jh4qitsglthguiovkuwhb;1:4hfbj1fj9iiuojl;1:dnheea;4:niloj8;2:riv;1:4im8hf9j9tjguh9;4:1h94h35hc8le9hgbgqgjbjh1kj4lh5mhhnguoh7potqjksgzthevgywh3;1:aiopj7ujs;2:gkp;2:0jn1hddh7gjwhh9jlgljqrfkwim;1:djbgjkjinqjxuhgwha;2:3j0cjz;1:pjfqh7whh;2:1h08iwahbdj0egofj2gkwhgljjvljbqh1rjlsixwhd;1:jioph5qmzwgq;3:wiv;1:5j3giu;7:0hf1hg3n96ha7h18ip9jaagebhacgyejqfjjgg0jmjkk8ph0qfvrgwth9ukbwgh;2:0l84hg6gf7gr8jrejrfizghbjh3khdpjqqgnwkl;1:0iz;1:vj7;1:0io3kh5h19gzakmeh1fjnghdijdqgzrhh;3:4iwdheehbggyhj7ohgpgyqmprhgujzvitwgu;2:8iw;2:sin;1:sj6;1:qinrjoshd;1:0jk8jqaj2bhbhitnjowgw;1:ej5ris;1:jiz;2:vj1;2:6iqgjnjhdsh0uiq;2:iizniw;1:1h55hh6iz7iw8gwbgzcinfimhj7jh0pitrhcvgzwj1;1:0jc1h23gj4im5km6gl8jt9fobjddgmfh8ggthfwihejmekh9lhdmh0nh0okcpgcqjhrkdth0ugsvhbwk2;1:5k4nk2qhg;3:1js2hh3jo4gb6h18gm9gvak6dggeh1fj8gkjhinil9jiykgsmhfohbpg8qgvrj5tj0vixwfx;1:1ja8g39j6ahgbixch5ejvfhfgh2klbqm3rgvth3wha;1:cjl;1:oio;4:0h61h22h53gl5h26gwafibgxcgxdh8ehgfhbghgijpjjfkh2lgynjhojtpgkqjcrn2sgkumqvjywgn;2:fitgiplh7wki;1:1ilgimpgswka;1:9ik;1:jisujb;1:8iqqiouk7;1:7hg8jgdgnejxhj2jhaoimqhasizuha;1:tip;1:0ha3gp4j96mg7hb8gm9j5bhdchddh6ghejgxnjhrj9sh2vlxwfm;1:6lhljishbvguwjk;1:6ld7lmjh3qh9thawh4;2:8gc9khpiu;2:4jcbh2gh2ij7klclipnjaojjpharg7;1:0hg3kp4gw5ik6mi7ha8gxahedj7egzghdhgyihdjl2mh4nh7ojnpglqg5rlitg0uhe;4:7h89h9bgzdkaek4fh2gjjjlfkhhmj8phgqgkrh3th9;6:aj5fhd;1:6hgpluqh1wh3;3:mizrhg;6:kip;1:ciq;1:0hg1m93jl8kiah6chaeh6fguggvjk6kh7ljinjkoh1ph5qh0rgiwjq;2:ak2bhfdh6fhhgh8hlgpkkqhhrjbwgb;1:6hdvke;1:lixniu;1:7khjgopkqwh7;1:diwjiq;1:wj4;1:1gy3hf6he8iqag8bitcn2dgyhhgijkjgxkivlkunhhqh4rimsj3tiovhfwfk;1:4pn5h8lisph2qhfwgu;1:8ja9hebinlir;1:5jl7he8gx9j0cipjh7kizngzpjtqh4wj2;1:9haej5;1:6j8jhclkvpj7;1:wm3;1:1innilok7rheujd;4:hj6kjgrh5;1:ljwrgw;1:ag8dilehegjtjh1wl6;1:1kcajophbqiprglwjh;1:4nx8h6kjcnhfwh9;2:vik;2:8hcbjnrj2;1:1iw5is7im8j19gznipoj7phergtsiwtiruj3wgo;1:8iswj4;1:gjxjkzogrpl9qgjwgv;4:jiu;1:wik;1:3jiqk3;1:aildhggh1jkmrhgshgujvwj3;1:jiw;3:8j89h2wj4;1:jjh;1:9izqjwrio;1:5jyjg6oj2qhbwkh;1:dhcejv;1:4itchgdjaehc;1:3imukb;1:wj6;3:9hejjo;1:1j26hglmrqlargowgq;2:giltjswh7;1:1h92hf3gr4jn5hg6gv7h9birchaglqih1jgtkh3lh7mhdnhboh5ph0qk8rh4sittlbukvvjewf8;2:okcqhd;2:wis;2:3h14ha5hc6gt8g89jgbjnehgfhdgjjhh0jjikgcmhbph9rgzsh5umdvkuwk8;1:8h6tjw;1:tit;1:uj6;3:1hg3hf8jv9dgajccgzehhfhfgkihhfjh6kjglismhanjvphdqh7tjiuhawk5;3:diqtj4;1:kit;1:9h8ghfjgskhelkzsj1wlf;2:1jn8ixbilrhg;1:9jj;3:jj1whb;1:kh6mh9omk;2:9hajgzqln;1:vjo;1:bj0;1:qil;4:dj9hj8mja;1:uiq;1:lj3;1:0hf2jf3io5j89gwahfch9dj6ehcfh0hgpjgdkh8lgxmjfnjhol1pk1qgurjsuhd;2:wjl;1:8jzdilehfhjpjh4siu;1:bj0rip;1:4hfghdjhcoliujg;2:bj2chchjb;2:wiv;3:bkckh8pk3whf;1:jja;1:kgylkp;2:nio;3:7h78ju9gzakcbjdch2ehfgk5hhekhargowjo;1:lk5rgi;5:eis;1:glpwj1;3:4hg7hg9gsaiubhachddpwejkfixgguhhgjh2kjtrikuh3vinwgx;1:9hfah0fglhkisk2ukuviz;1:0hh1ps3h09ikehhghgkhbohepjyrgjwhd;1:8kh9gamj5;1:9j8gil;1:0mh1gp2hf9iyah7biwdikeiqfj6ggxjhbkhdmleqhcthewgc;1:5l9hiophgrh7tio;1:hhermn;1:wio;1:7kg9ipah0ehgffwgh2riquk7vkt;1:5j4ah4fkmtjuwh6;3:jiz;1:2jb3h7;1:4im;1:pjz;3:aj7bgvwj3;1:jj3;1:qiy;2:2hc3h17kmjh5wjz;1:3ka7go8in9j3afuchbgkjhgojmanispheqh2sh9wik;3:qik;1:8h99iwggvhmajiophftjmwgp;1:qj9whc;1:rjc;1:1irnikwiq;5:9ir;1:7jyfikghfwgz;2:1hh3h3jj4khemlcnkkojjqhcrh1;2:0hb1h83he7hh8fs9mdcj3ekugkohj3jh3lhfphfqinrfpsjvuh8wg4;3:wjc;5:0jf6j17ip8gx9jh;1:9h9aj3fjhmhhrjd;1:dis;4:fix;1:jjqsirwh1;1:djjuka;1:3il4h06gx7hgagzbj0djjegvfj9gjbhh5iikjgtlh2mhbphbqj2tl8ujgvk7wfh;2:9j0;3:miq;1:bio;1:aiqfhasis;1:7hg8ikjgzpgrqrjtjkuhdwfi;2:8il;1:0kf1h03h84hg7hf8gtah7bhdgh5hhgkjyllwminnhfoh8rikthdujz;1:glqwhg;1:8j99kdbg3cizejkgiokh0lltnh7ph9thdwgy;1:8f79kv;1:5izaik;1:6iy8e89mzrjdvkiwgn;1:hj3rh7;1:fkg;2:9iq;1:1he3h64hh6h47he8kkagpbgfckndjhefrfhfjh5lhemktnhboh9pk3qgguiovj4wiy;4:bj5kimljp;2:8gg9irtlewjj;2:0j3oiusin;2:dh3ekurgt;1:8h3bjkgixjhfwio;1:5jcbjnkh9;2:djceh7jj9;4:sjf;1:kgymkdnhdpja;2:egpfjejilsil;4:djbegwfkwgglukfvj1wh1;1:8jg9g2ah1bjqdhdehefjygh8kjmlkpoiprggwhg;1:6hdajujnjqhf;1:cio;2:1olch9djeegwfj6gixjhckgylh7nh9og4rhgsixuiuvj8whg;3:tjc;1:1ij6iu8ikdhfejgtja;4:3hb8gpbh0ckddh3eitgjhhmgjfykjamjaphgrf2simtkbugyvhe;1:0j2;1:wj2;2:3l18jcaj2giqkjrnhgqhgtgqwhe;3:plqwhf;3:jk9uh1vj2;2:agvbjh;1:akubf9jjo;3:9ipgldpinrgxwg9;3:8ku9hcjhe;2:fj7wkv;6:kkwmh8njd;1:1hb7ip8h6jkppk0;1:rix;1:agmfm9pjw;1:4kr7kcoh9whf;1:2ix5heej2tivuio;2:8kf9lyegz;1:6k5qhdwjt;1:ajpwja;1:8h99iuagickzeijfh1hgjjj4khelk5riqwgv;3:0jg1h0;1:ajofgyhiqjgtqiwrj6vk7;2:9jy;1:6kqbj3dkjeg3fhgghbjhauhavjawk7;3:5jycgwghehjbjgrqjyrjv;3:oiluj3;1:ainfiu;1:6juvil;1:0h41hf3ha4h37hc8f89iqangbh6chhdj9ehafh4ggphkwjgjkginjjoipph4qitrirsk7tgnuk3vj4wh1;2:cje;1:8iptiy;2:6heun3vgg;1:aiogishipjilwha;3:3isrhcwk8;1:0im6gn9ivajzej9fghghbkhhnhesj0ulvvj3wh2;1:9irgjd;1:2ks;1:ckdfk7rh0;3:1l5uhbwk0;1:7jrphe;1:7iw;1:aj8gha;6:dhbejc;1:6he8jc9j1egvghbkj4rgjuksvktwh0;1:8j2kgzoh7plz;1:9j3jj2;1:1jn8hfjmnrgmwj3;3:3jygkrhhfvixwgv;1:dmueft;1:5jtbh8ehggl9mheqhbrkv;1:1hf3h64kk6ha7he8gk9gyah9cgweizfkkggtih3jjdkh3lh9mhfnhdoh2phdqjbriytikulivjlwh3;1:0hg3hd5l16ir8kfbgych7egkfhhgh9jmxmhenj5ohcphaqivth9ugzvh7;3:1hbdhahiorhewkv;2:4ik5pkah4ch2diteh4fh7hgzijbjgymivph7qggrgyth4;2:2is4lmfjegipwgy;4:0hf1gn2iy4hf5it6hh7hd9gsah1bh7chceh9fh0gm4hixjfykgzlj2nimok4pj4thcugzwk2;1:sis;1:3lb6hbcj2th2vj9;2:8fa9ls;1:cik;1:hikrj1sin;1:bk6dhbej3gh4pj6rgluj1;1:8m89g9aj4bh9cik;1:2jc3h8;2:rio;1:ajzcglkjd;1:hirrhfwkp;1:sjouh8;1:9ilhfxjhbtlpuiu;1:8jdriwthg;1:1hf2gq3lg4j85lu6h97ip8h0aj3bhdcjdeimfgmggaik2jj8nizpheqh2rgytgvuh4wfz;1:giyjjtrj0wgt;1:iljwhg;1:dj0;1:6j5cinuhf;1:9ij;2:8qa9b4ah2dh9enqgjwjh4kh6lk3whb;1:dohegyfh3;1:1ha3hb5l17jh8gueh8hhcjglkh5nheqgxrn7sirtjfuixwh1;1:eik;1:ejj;6:6jbchfjgxql2whf;3:0hb1it2jo3is6j48h19hebh9dgeejsfisgh7jh0kh1mitnh4ohfpipqggrjzsh7tgtumuwfq;2:rip;1:0iq;1:0km1io2gf4ll5hb6hg7n78hfbhagh9ijsjgykh7lhfohdphcqhashbthfuh9vh3wh6;3:3jt8jv9kdah3cj8eh9whd;1:9ipbhbfivghfhiujkcwh4;1:vj8;2:3hb6h47h68h79haah0bh0chcdj6efgfj4gg3hh9jkhnj6oh9ph7qgqrgssmsth6un0vkywj2;1:5iu7is9gtbjmdhaehdfjtjjpkhbrh8tjjviywh3;2:fiqsj5;1:1j33h28graiobivfgvgj1jkwlkimhbnhfohdpj9qhcrexsk0tha;3:pjr;1:ejm;3:oj7uj2;1:bjj;4:pj6;1:aiogk4;1:2iv;2:giwhjorhc;1:8gfajecirdhcej2oh7ujdwl7;2:giu;2:oj0;1:7fofiyjgiwn5;1:4im6gg8in9izohgrj1vmtwhg;2:ckn;2:1he3h86jn7h68gt9haal0eh1glxhl0jfvlh7mjgoh9pgzqhgrhdsgltksugmvh7wjm;1:6h48j2ah0bhbcgzefogmshhgkhhqgdrh8siytjxulgvj1;1:7ivwjy;1:ajokiplir;1:pj8;1:0je1gy2it6hc7h98kc9jfaj9blrcjadhaeg9fg1gj4ih6jgokjgngrpgvqgorg9sixvhhwh7;1:jj8;3:8hgjj9qj5wjm;1:1he3hf8gx9kbahefjchkerg8tjswiy;1:hix;1:ijc;1:hhbtj1;1:hhbrjd;1:pio;1:0hf4kvriywha;4:bhdfk0;1:9jddj0;1:ah2gkljhe;1:pjn;1:1je;2:jit;1:jij;1:1ql8g4bjkcklgmfhinr8rtgzwh3;1:4jdjim;1:gir;1:ahgujt;3:0jbeirkk0ph8wh2;4:7j4;2:0ix3ir4hb5ha7gx8imajxbh9fingiyhikiizjhclhfqhhrh9uhgvhf;1:3iv;3:wj6;2:gis;1:6ld8iq9hejioll6wgd;1:7jb8fx9jgakfbh8fgngj3khelhbqhgrlbsjbwgv;1:uk1;1:5h09h2hhfrom;2:siw;1:4hfah4fjngh0uov;2:7hfphaqnwwfz;2:8j0;1:riotj0uimwhb;3:8j3jhbrjg;3:0iq1gx2hb4gz5hc6hc7gyehdfhfgjehhgijmkiolivmgynilrkmsh6tikuh3vhdwkp;1:1iyik6kk2;1:6m47hgbiufjglheoh9pheuilvj5;2:4ik8hc9iraixfh5gjnlh0rkb;1:niz;1:0jl;2:9gzgijhhgjimnj0oitsj7tiu;2:cj9wjo;1:oghpjlqk3;2:iiq;1:1g5bjkclyejnkhgrkk;2:ij4;1:8js9gt;1:3jp7iv8h7cj8qhb;2:giwjhdmjj;3:fiugis;1:fil;1:7h68ir9h9bhhch6dh3egzghehodljemh6nj8oinphcrgbuh2vim;2:4ivkk0whc;1:1gw8heajmdineijhl4ijpjinrf9wgx;3:7he8ixakeeh7kgzphgqj5riwtjbwjs;1:1jw3h15jb6jv7gy8gz9gndjofiwgj2jj1khfmgynhcoimpj6qgvrg5thdugyvkfwgv;1:dj6eh8ghejj3rh3tk5uhgwkw;1:pk7;2:bikdikemdffm;1:6krph5;1:pj9;2:wiy;3:1kdgj1jjpqh2;1:gghjk2;1:pk5wha;3:3ix6jotj6vgl;2:riu;1:mir;6:2gbok0;1:dgsem1mk2qhg;1:3jw6hd7hg8hdahfbkjdgzeiufh6gk1hjfjhbojlphgqjirhfuhgwh3;1:8j1gjnlhg;3:mkmwhd;5:njw;1:8ja;1:0h61h22ip3he8km9j2antbizch5ehefgyhgxkgomhcoiqphaqh8rjuuh8;1:8hcamubhhcg6fooggxjh9khdrhcthawh6;1:0io7m9ahgbh6khfmhdqhfwlf;1:8k49izjg6;2:qk6;2:jh7kggnmaojkpirqhctilwh7;2:wiw;2:0jd1gu5hcafpbhfdgoej2fgqgglhgnjh9qh7rowshhuo7vipwh9;2:oiy;1:7h88jm9jgahfbh4dhaemigg7hipjh2mheohgphdrgxtk1uhcwlc;2:7ja8ikbikqio;3:2hg3jo4hc6h77h78l99klbgqch1dgxejdfgcggshhaihfohgpkrqk8rlcuh6vh9wgm;1:1ka9ikkgw;2:7j1bjhjhc;1:pj0;2:oikqjt;1:civ;1:hjlrgxtj3wji;2:8h9dk8ejf;1:agucgogjljj6ujxwje;1:5ks8jw9h5bjdqhewhf;1:kgymkenhd;2:jj0pijwh6;1:bjxcivnj9rh5whf;1:jj6;2:ph9wl3;1:1hg3h67h38jmajsbjwcjcditegufitgh5hhail6kh4nhhoivpjkqgirguthbuhe;1:ij8;1:hip;1:3hgpkp;2:3jfbkkcjofhdgjqjhclitphbqgvrh0thawk9;1:jk8;1:1gj2h93h34is5kq6is7j08js9efah6bg9cggggmmlmnhfqg0sj1thfwnd;2:1itwhc;1:8h2qhgtm3;1:bj3ciofiwjhboj1phcqje;1:jj2ogfplowgz;1:0jy1gi3j14gz5ji6hc7gq9j1akbcgmdiuegrgk5hgkih1jfgkiqlh5pjqqjerg8tirwgg;1:8gy9g6dm1efxfgnhkdrjwujt;2:ehgfimghfjjj;1:3j4;1:9iygjj;1:lhcoj3pk7;2:ajjfj5khc;1:3jpjgrwmd;1:gh6wkr;1:0j0dgfekp;1:5j9;2:ghfhhgwog;1:0ja3iu6h97km8ipagdbjodgweh2fh1gfnhirikljh9ljaohdph7riqth5ujg;2:aj0fhf;1:pji;1:cipll9;1:8gu9k2;1:6kc7he8hc9k7ak2bgvhhejkfkjemhfohbpgwqh5rhcth1ukywgr;2:jjpqj7wh7;1:3jkfgmhkmujvwh2;1:cj5;1:8mo9dqwiu;2:1hh8he9gwaj4bh1cjjdhfegzfjzgjqhk6jjzkgzohepkmqhethewgr;1:al9bj6cgxdhgegnfkogimjj1njsrh9uh8wgw;2:2h28jh9h9hipjkh;1:7hdmj5qjhwjg;2:rjh;4:7hgah8fjoghfjgoqiywoc;1:aj3jj8lj6ojxphfwhf;3:0hbfiy;2:2jz3gz4ge6gn7gz9haagxbgvdh4eh1fjbjkqnhboh3ph6qgnrgxsn7th7umavo9wfh;1:8j7;1:riv;1:dk1ego;1:5l18h9cj5fjehipwh5;1:jhbwjn;2:piv;2:liq;1:8g6agqel2fjawj5;1:dj9egyfj8rjntiq;2:9ij;1:uiv;4:ahfkjvrhfuiv;1:1k52j07hfcirggxhjejh9rj0;3:ciluje;3:0iwjivrk0wha;1:jj2;2:1j62io3kb5jn6h29hfahbbgocizeh1fjrgghhiqjjelh5mh2pgcqjzrhhuglvh9wgz;1:8j4chduhewke;1:kir;1:gir;1:6jn7jnwh6;1:5k6;1:1hc3he5hf7h78k6ahdehgfixggdmk8nnuohbrgt;1:jgyqixvkf;1:djuegr;1:1h73hc4he5hf7h99jhaipbj6diqfkqghchhbkghlhfmhfnj7okupj0qgjshhth9vhawjd;1:6j1kiq;1:jjb;2:0hf2it3h74jh7gk8gb9gqaf1bh6ehbglmhguigvjgukh6oh6ph2qjurguszstgtuhawfl;1:jj0;1:iiywjo;2:oitril;2:0jg1ip2h33ow5gq6gr7g98k69fxbjldgfegafhgiizjh0kgdlh1mgopnpqikrfatgouhcvh1wik;3:qkhwhf;1:4ik;1:jj4;1:8he9h4tl8uh7;2:1j22it4hc5iw6kj7il8iv9h8aikcheehdhhgqgzthbvh0wil;1:njdriy;1:1h93h36hf7h39izapzch5eh2fftggljjckh7mhbnhcqh9sm9th8ujzwgt;1:0hdfhbjh5kg6lkgmpznjgpinwgy;2:cm5jjfrh8wh0;1:iipmir;1:8hdukg;2:aj7cimfh6gksqiusjuwh4;2:8isokmphf;4:8ja;1:0h71h45k66gu7gw9gpckkdh6gg7hlrjkglizmh3oilpguqg1rktshgtj9ugfvh9;1:ukj;1:0hd1h52ip3gy4iv7ko8j1bj6cjrdgxehagixhjaih6jgxkg8lj9qglrkesgzthfvh0wgv;1:gix;1:jiq;1:bir;3:2j9bhgmkqwh7;1:4jooh6pio;1:0g01hc2hf3kf4hc6rr8jb9gwahcbjqcgmdkoejcffcggbhghih7jh9kh3mh4nheohepgrqgrrkitevugzvkgwja;3:6h7jh8sh0ukewkk;1:jjp;1:1gi3h36h87gv8it9g6akzbgucg5dg7fjkggmhniihfjl5kglmh8ohcphbqjqtgiukjvitwjf;1:qja;1:4j25jp;1:1km;1:8gqtjluhgvj7;2:gio;2:wis;4:3kmjg7wjj;1:7k0fingk4qh5rgyslbvhdwh1;3:3j79itjj3qh2wjw;3:gjs;1:4ikgfqhkf;1:0h74jt5pk8hajiuogypivqgywis;2:ck5rgnwkt;1:fimijc;1:pl6;3:4k0;1:9jk;3:8gwbhgciwgk9miwrhgthdvkawh0;1:wiu;2:hiq;2:fiskh7miwtil;1:0h91hc3h04h47gl8ju9fpaggbk2cj1elbfkfgh4hiqihhjffkgflhfnhhojoph5rfhsjptm8uk0vh6;1:8j19h6jj6uk5vh4;2:kir;1:rikwjl;1:ojbsil;1:akiqinwhb;1:ckbeh1lk5oipwhg;1:mikrio;1:bhfghbhjdiinjjfrjqtjp;1:3j6;4:8khmjqohewhd;3:bj6;1:4ip8g59fvakkbhachefkijjamgbnhgpl4;2:dj4;1:3hf8jv9jlehd;2:0ij4hh6hf7hceivgh6hh4khcoj4pggqjhwkb;1:8j39ksah5dh8fh2ggzhoyjgxuhdwgm;2:mjj;1:cixrk7;1:dj4;1:tjf;1:dj1;1:giv;3:8haajbbn0ck5hhbjh9kl2lh9rggwgp;5:5j66hedj2;1:8j99h1ajdcgdehgfikkjmnh8qjjrj0;3:4l38gb9kysik;1:jhfvj4;1:ijmqio;1:1h85ja7h68gocgrggfkimmjpnlkoj2pgrrh6tleuh9;1:7jf;2:5kh8hacgwfinglauh8;1:3l3;1:9j3dhceh7gmijha;1:kiroggpjjsj1;1:8h7dktekfrhbwhf;4:2ly4hg7km8iojh8rhe;1:dfnek0fhckks;1:0jb;2:7j2;1:gik;1:0iy;1:8jgjiw;1:6ky7jiag0cocfgrgiqhh6jfypg7qh9ritujywgl;1:qk0ujowh7;1:8ja9h8wiy;1:fio;1:iiv;1:3j1;1:jja;1:3khcjejijrgs;5:2j47jnoj6;3:bjzojr;1:2j0ghghikrio;3:cj9;1:aiq;3:8kk9h5;2:dirkiwtit;1:0h61kf3hg4in6hh7gu8gwajeblqck4gfzhhfihdjhdkhblh8mhfohdph4qgkrnfsheth2uhhwka;1:dhbelc;2:1ir;1:7jg;3:fiz;1:glpjh9wh6;2:0jw;1:6mtwgx;2:8j7;1:8iscimfh7glgwh9;1:9gvakmkh3qjsrjdwh4;1:ojq;1:3h48k59mvah3bhgchgdhgegofhfjj6rkctjluh4wgr;1:ik0;1:qjl;1:2ix7jg8gzbh0to1whd;1:9ik;5:4kk8itbgskhdrjh;1:0h71gz3gz4h85hf6hd7gm8k49h1afzbjrciodgvekzfkfggmihejg6khflh6misnhaoh3pgzqgprk1skktlluj5;1:1hh3hg6hf7h18guahgbg6cgwdikfhaggphhejgkkheljqnhdontpgqqlvronugz;2:3ilajhch8fgogj6jhgmk5qherlbwgs;3:ajdbivgh7qhgtiuulawh0;1:8giol7phdthhum0whg;1:bj0cjthh1rj8shc;1:8jpajzbjdcjcfh1;7:8gh9l8ajs;3:aizflorha;2:cjb;2:wl6;1:3kmbh0jgirki;3:8hc9hgbhacl7;2:oj5;1:4j9khanj8rituj2wiq;1:qkdwha;1:wiw;4:gilqkywh1;3:8gb9kcoiw;1:2h03kb;1:nj5;1:1hc6hd8inajkbkvcl7dguejlgjvhh5jh4kislhcmh2nhgrg6thhwgl;2:4hfija;1:2kibhgeijfhegjinimqiuwhe;2:8j0fitghfwk9;1:wix;1:7jmjgbsk4tk1;1:ugsvjr;3:2iobj9fjlrhdsik;2:diz;1:hjc;1:eiljh4nj2oiwwiz;4:8hddhfeh4un4vktwhc;2:7izgj7jhe;1:9in;1:6kk9j2ghckkiqhbsjjwhd;1:4hf8j79h7ghfij6mo4rgawgu;1:0iwwiw;3:4he8hbbjagl4jkglh9oj6pherhe;1:nil;2:wj2;1:1lc8k1ejbfhggh2kipwgr;1:9h1jjrliu;4:hjgjj5;2:0im;1:4ipbiq;1:6hgiizqilujo;1:kivmgfwm3;1:wjy;1:0ha1ge3j44hg9jsbh8ciqel9fh6ghdhgnkhelhcmksph9sjltheugx;1:riy;1:rit;1:lil;2:eip;1:0ja1h72hc3gj4h45h56ha7gf8n79lbag4bgkcgedexem0fgygghhgujgwkkclhcmpankqog5qgnrghshatjsugdvh2wjn;2:0khwhe;2:2ij5jo7hgaimbgicgvej6fh9gh7kkrnh2ok5ph9qjvrj6;5:4leaiwfhagh0ih8jgzkgpmk5nhapiyqgkrjquhfwjn;3:3jc7hajimrj6;2:8in;1:kiltit;1:0f83mebixcilrgqsirukawhd;2:0h22hb3ji4hg5ha6hf7gz8k39lxbfxck2eliggyhitjgqkhaohcphbrjpuh8vhf;1:jh4rk2thfvliwg4;2:lipuj0;1:bj8chf;1:ciyhiqjmhrimwgq;2:1h77hdbktch9fhggkzhh3jjrkhblh3qklriqwhf;1:fiujiw;1:rkr;1:1h63h67h78il9j7alfbiydgmehhggyjgukntlkrmhenh0ogzpguqjxrgwuh1wge;1:jhfvj4;1:0k14gqikvjhcpjsqj2rhfwh2;1:3hg8gn9kzahcbhdeh7fh5ghdhjyllzmhfrh2ujjwh4;1:eiz;2:5in8gn9j3bio;2:sj3;1:wim;1:8jjhgyrjisj1;1:3l18fjekklijohf;1:1hc3h54iq7hg9ggblccnadjvegufg1gh3hgskkyph7qh7rjptipuhewgt;1:1jn3hh4h86hf8h1ah8dh4ej0fhhhh8knzllfnlyogtpfoqh9rh7uk0vh2wg6;1:5ix;2:hij;1:ejnfj3hivrh5;1:jhdpk6;3:1gx7ha9gabkbcjqdh3ejsghdhhbjiokgdnjbokspjlqgxriqthdwiv;1:3jc;1:lil;1:1ktgj9khe;1:bix;1:wjg;1:0jx3hd;1:fhdginjh6ukm;1:3k8agvhh0jgerlqwjj;2:1h06hg7hhbhechdghahilinqjh8litmilph9qk1rjtthfuhewgu;2:hjaphgql3whc;1:dkgefk;2:ahachdjjutjv;1:jj3;1:5jg;1:0kw4fw6hb7h48gy9l4ahgbjtchddhfehbggmhjxiirjg8kjomj1ph0qh2rh7tj7uir;1:hhalhbrlh;1:0hf1h63hb4gw5hf6h98js9jfagwbfccj9ditel8fk6hhcihejk4kgzlhdmixnh9oheqg8rgqsiutgkul2;1:3gx6kzqhdthevl8whb;3:0m61j03kl4h87hcghahhfih9jh0kgzohgqgkrhgwmp;2:0he5hg6h87hg8ghak4bl0cjfdheeizfgwgiwjgxlhbnhaogxpkmqivrglsjjth1ujivjswfz;1:8j0ahg;2:rit;1:0hf1h52gn3j44h05ha6hf7hb8k89heah2bhhch4djnfipggnhhfik4jkakh5lh1mkink3okspgpqh5th5uh4vj2wfx;1:3hb8h8agicikdlkegxfhbil2jivokmqhasjcuhcwg1;1:oj1;1:1kbkgw;1:5it;2:iik;4:qj8;2:1il3ir5j86iz7im8ixbivdgieiqfhaggujixlilmjlngprg8theuh6vgi;5:oj7pl4;1:2jojhgwjf;6:6jl8j99fuahablscmldgqefgfj3gh7khgtj1wh9;2:wj7;1:6hd8jh9h3aitbh9dhbeh9fgpgn4qk4rhcsjowgf;1:oiqqlswhd;1:dj0ehcmgepl6;1:6h2qlr;1:8hejjvpjewio;2:oj2;2:hjjjkfrgq;1:ojj;1:hh5rix;1:rj7;3:vin;3:tiv;1:kh0njo;5:1h98heajvcjbdhdgfdhjjjhekilnhfqhfrkougxvjuwjg;1:wir;3:3ir5k86jx7jhajgbhfwgn;2:ajahj0she;1:dim;1:8kejkvrinwh1;1:fj0ojj;1:8h99ituj8vir;1:bjxcj4;1:bk5;1:5jcqjmsgjujv;3:9omagwbiych1gh5hhgjggkgvnkkogtrjxtj1uhawgl;1:0ioajneit;1:ilfwhb;1:ejiggghit;1:siz;2:0h22k03hf4gp7jj8ikafwbh9diqfhcgh1hkajgtkh2nksokxpgorh9th9wk7;3:dji;1:7hdehbjilpmsqharjcwgc;2:bixdj7gilhhfriuwiw;4:4jy8iz9hgblccilfgwlhbwhb;1:9g4bjycjfegdgkirk3;1:7m4jitwh4;1:jjc;2:1iy5ju8jp9jkaiybh8chbdh0fldjhckgtmh9uh5wh2;2:0jl3l94k17legh9jh7qgkwfl;1:sir;1:dj1;4:jiu;1:wjx;4:8iq9ingiqjk9tjw;1:0li1he2jo3ji4mg5gs7h58j39h3agubfycimdh4ggihh3ih7jfmljzmn8ngaof5rg2shetk0uh9vhbwh5;3:mjt;1:gk0pj8whb;1:8kv9ghajxcixhfojlkqhgwhe;1:1h53lq4gr5ji6k47j98ju9ircgifh5gfuhgwih7jizkg7lhaogtpfvqkkrfxtlhuiuvilwg4;1:4hf5gw6im7hd9juahbbl8ehafhgggyhiwjjdkjtlgvmhaphgqhfrkstgvugwvjmwhg;2:1izrhfwkd;1:4jb7k0aiwbh2gjmjhgwgp;1:0jgdjqeg6fjhtikwhg;1:bj3;2:8imbk4cgyhgxjk1wjy;2:cj2pjc;1:aitdjuegx;1:1h33ha7gp8gt9hgaisbmkdinehgfh9gj3hjknjfohfphgqktrhfsirth9ugmwgm;1:2je6io;1:0kkjh9mjnomcph7qh7wgi;2:7jf;1:4loej5wh3;2:6kawh8;2:eiqtkf;1:mjj;2:8gjcikulh;1:1j82ik3he4h47he8j99jpcheeh6fh0ihfjg4lk4oh8tiyuhbwky;4:0km;1:0jd;1:kio;1:jiy;1:2h37izciu;1:ljl;2:jo9qhcrhgwhf;3:kirnjq;2:8jhahebhgcjsgjijiqrgeuj1wiq;1:0h98h9bjqkhcljloj0;2:akgfgi;1:5mr7iyfhaghfjlorh9uhf;1:1iq3mh8jt9juagwjhfok2phfqh6rgzth6uhdwha;1:aj2oio;1:wk2;1:1h03kz9heajdbjcch8eh9fjbgguhgrjhakkbmhcoh0pjpqkbrh2sh2thewjj;1:8gjol0pheum2;1:4j1ahgdhhhktjj6rjc;1:9iyqjzwh6;1:9jgagwbhgeh6fh5gjekhglj8pjsqhdrh9sikuiowj7;1:9ix;2:8j3gk0hgvjiwrfuwm9;1:5j79jvbh8egnfp0gepuhawhf;1:sjn;4:wip;3:pki;1:7hg8f29o1dj3ehbjjvrgiwj6;2:1jo;3:0me3he4iwcj2dileiyfipggswhd;1:jgxkkspohwgt;5:8is9ipal3fh6rhd;1:pio;3:1jmkgl;3:3lethd;1:9iyjik;1:jkw;1:0ha3h44im5hc6k87he8haagycjwdhafhaggahnqjjkoj6piwsgwtjfuipvhcwey;1:riq;1:wip;1:9imbjrehd;1:8ix;1:8gfbnoehafkigh9rhfthc;1:ljn;1:0l0jhgpjiwh0;1:jjf;2:liqoj6;1:6ja9isagtbjbjjcwh0;1:1m46kl7ha8jn9glbhbfiqggajjhqh0rgi;1:9jcbjipj7;1:liu;3:dikwjt;1:9h4cjgpkkwgv;2:fhaglkuirwh6;1:cj7rin;1:qje;1:dk5ehfjjj;5:qiq;1:bix;1:0mb6gyajiwhg;4:8h39jekix;1:8j69lcakibjmcgsehegh9kikphbrhatiyuivwh3;1:4kdjjmoitwhf;1:9isfk2gj4jhcwiw;2:qiutiz;1:qk1whe;1:8jucjgghghiojjywgw;2:wiq;1:1k4whd;2:8ijwj5;2:8isgiy;2:4l5jhcoh1phcwld;1:hhdjir;1:wj4;2:kipoki;1:3iv7j5tkfwhf;5:3hf5hg8g49r6agwcgtdlvefzfgygkwhh8kgqnjxok0pgvqh8rk3shatg2ug0whd;2:divsik;2:uk6;1:eiw;1:8h0aizbhcdhgfhfgh2jl6kjlrfpsmzwgc;3:5iz8hdaiujhglirwk9;1:wil;1:jhgml6nhdtmjwfb;2:3kqcgwfh2kksqip;1:kjtlgnmis;2:jkn;2:8goafpjhauowvjo;1:0ks8gy9iqdimekwrhe;1:djlegr;1:1iz3knbhgkitoioqhf;1:ej7;1:0hd4l86loghdio8jhdohcpglqgswgt;1:oil;4:iiy;1:1in3h67h78m69ljalkbmdcf7eg4fgwggrhhaihdjggkl1lh3nh7phcqj4th1uhdwgu;4:bisjgaqkqrkdwh5;2:hioujm;1:fjc;1:hj0nizrip;1:ahffk6;1:4iu;2:3ik;5:gik;3:7jlbk0miqrhbwgr;1:4gnip5whc;1:cipwiy;1:hiojgnokppjrsha;1:8kl9owakibiucikdh2eh5fh4hhgkhargjthgwgn;2:jl9wgs;2:2jh3ix4he5hd6gn7iq9gsbj2ciufhfhiliikjhdkktmgunipqgtrg7uh6vf2wmw;1:pl2whf;1:8ha9j4nix;1:uiwvkc;2:jikwkc;1:3hb9hfahcbjvciygiyhhbjk0kgorg9tivujiwk7;1:jh0ql9;1:okhphe;3:8h69j5;2:hgkjjklklwhg;2:cik;2:3hh8lq9kiaj4biwch4ehcgh4jh7phbrh8tiouk4wh1;1:dinfjylharjswh4;2:ajq;2:2mb3k94hd6jtjhcph6qj7wgk;1:bil;1:oik;1:3ha9gwdkgel5fjnpivwgp;3:9gzahfch4ggfjkekh4lh3mh9nheokvpowqinrkjshhuhfwgb;2:oj4;2:1it3he4h75h56jv7fs8il9h4agpfhhgpzhg7igzjimlkzmglpizqgrrglugswgi;1:jj6ohg;1:9jaah9bh8gjbhioujx;2:aiqhgdrju;1:hjg;1:aizcikfgzglgqiusjuwh2;1:0ha4ir9guaj0bkpcixdm3ekxgh3jh9kgwlhcmhdohcph3qgjrg4thfuimwg9;3:gjk;1:8h9dk7ejeij0wh5;2:0j1ok9;2:1jo4he9j1bfscipdh4ej0fl5gmeiiujgylkapheqgurgfuh5wgu;1:0hd3h24hf7gp8k49gebkecivdgoekmfhdhimihgjg1kheohfqh3rgnsjctlcukjvhawio;1:fh6kjdoiwwip;3:0hh1hc2gs3ik4gz5gz6h88kr9h7ah0bo3dgqeirfgxhj1ihajgzkgtlgsmkcnh2ogwpgntlluh4vjp;1:1gn2jq3h24jh5h66h68gi9gsakabl6ch7ehgih0jg6kgklkmmg7ngmogbpl1qgzrjxskdtjhuh9wgj;1:8j3ak3rh0;1:4ik8il;1:5j18iz9gniixjg7mh7nkjwkx;1:0ok6gq8j0dgyekrhgyjhbpheqj7ugxwh2;3:8hbsjw;1:8j49gvcj6;2:jp2qhewgl;1:3jh9j1aiwfhh;2:dj9;1:3hg6oh7hc8h89hebhbcisehggjnhiljj5nhcohepgxqgqsj8;1:khapk3tio;1:bjsch8;5:3hc7mh8kq9gvjgn;1:9haaimbhfjk5rjz;1:wko;1:sj5;2:4in;1:3ka8jo9k7agubgeciydj1eg3fj0jh8kgqnimofvpnwqhbuhdwgr;1:riy;1:0lx7h28h6bgjjhbuinvjrwke;1:0jodh2ej7mil;2:6iy;1:fhaglowha;2:jiqpix;1:0jkgivjj6rhb;3:2mm7h58ka9hfaizbgleirhhfjh6rheuj1;4:wjx;1:gjwjkkof7pnqqjcwfk;3:8ir9l2akmbjeciwghdhhejh9mfwokgqherh7;1:8iyjiykiy;1:bh4cj7wk3;3:8h7ghbhjciinjjerjotjn;2:aiwbhdcgphimjklniywh7;1:0jw;2:pkkwgv;2:jj1;3:1lu7k7hinjfpqkmrgrwgy;1:dkfehavhb;2:0ik5kr7hh8df9kughfihcjg9nj6qilsj8tk6uirvjhwgq;2:7jnvhh;1:8grjiswkk;1:3hg8gb9f7ah1ch2dlueoifl5qherhduipwhb;1:0hcdivkj3njm;1:ciq;2:lj3rh9;1:qkbripwh1;1:0hg3j2qkg;1:diveh5kh1mgznkeoh3plqwhc;1:ij3;1:1ip3j04ha6h78irbh3fhbgk7hhfiiwjhblgyqiutlwuhdvj3wgn;1:tip;1:3hfbizwk4;1:7jf;3:8kb9g2bhegjy;1:cjaggghil;1:ag6sjqul5;1:9ikrij;1:jil;1:3iq;3:pk0wj1;1:aim;1:kjgwhc;4:7jedh8uiz;1:ckkrg8;2:1heakkgj7ij9rgp;1:fh9ulr;3:8l09gjkh5niorjrwhg;3:9jyakwbk7cgxdimhjejhdkiwphdrgmthduha;1:4ivdfqekzojc;2:uit;3:vis;2:dj5egwjgwqjn;1:8ixehgjj5uiw;1:hfgjl8;1:uj2;3:wit;1:oil;1:1j33ix4h88it9haeipjgqlj7njzohgwgb;1:0jp9hgeiy;3:dj3ehgfixgiv;1:9in;1:cim;1:8iv9ha;4:qj7;2:ljm;1:9hgrmmuhb;1:fim;2:his;2:2kchh4iimjh7;1:pknwhc;2:8j09imuiv;1:9jvaghbhcchbejrfjwggojhekkhphfqk5uikwh1;1:lix;1:qir;1:fheujm;1:biyoimrh8wjh;1:cjf;5:8k1dhejjk;1:tiuuj9;3:8jpcj9eja;1:kiw;2:0gz1ga2ha3kp4h05h16mm7fyaggbgscj0dj3eg5hghih9jf0kh6lh4mgpnixom4qkyrfqsh3tlfvjz;1:wj2;2:1iu2iv4ir6hc7ke9h4ahgcjzehcml3qiyrg0wfm;1:0hb1gx3jz4hg5he7hb8gs9gcbilcirdh2egrfilgfehnqihfjj4kjlmh7nhgoh7pizqjdrjksgytilugavhgwk0;2:bjqch1;2:cjxrh1;2:2iq8ireiogikhhfij1qh9;2:git;1:8khaisbixch9gj0jh3kh9ohepkmrf5tkxwh8;1:1jpciydiwrh0;2:pjwwhg;4:ahdrjzwhb;1:giu;1:bilgishgxpkorg1tlj;1:dirtis;1:vio;2:9ix;1:3k84l95jw8heagubgqhiqjfqlj5phfqgurk5ujiwh1;1:jjz;1:6kk;2:6jovgw;1:0ivfiqjiwoj1;2:hil;1:9isaimnj0rissj0whe;1:6gcaj5dgpffwglhhmyjgirj7sgpuguvivwjx;1:ois;1:bjifh4kiymhcnjdoisqil;2:0h71gz2gv3gv5ha6iy7kz8fg9l6bjjcimdkpeh5fgpghejitkgvlgnmgxnioogzqjzrkhtgjug8vhd;1:mjzrh7;1:fhfgk1;1:ejl;1:1jpbit;1:gh7qkswh7;2:jiquiz;2:aj5rhg;2:kip;3:4kt6lc7hc8j8ah6hh0jkpon1pfsqh7sgkwgy;1:3oj8hfagicl4djdfgpghchj4jgkqh8riswga;1:jhckiuoixpkkqh9whg;1:qim;1:6h98hbjjxnjkok1pk0qh1;2:kj3;1:8luagtgjfjjorgwwhc;2:dh5ehfrjpuju;1:bjmcjrfhf;1:nip;2:phguniwg5;1:kiz;1:6hb7ir8gfbimdn7eggghcjliohfplcqh2wgf;1:uhcwki;5:wl0;3:eiohjtrgjwjr;1:6jvmimphfrjm;5:hio;1:8ioejijh6wjv;1:5j8;1:gk1;1:6m28hdagsbj7filjh6kgzlljnhgph7qhdwil;1:1jroiu;2:piv;2:8k2dhejjm;1:agvbjh;1:jik;1:2gbok0;1:lj7;2:4is7kcwgv;5:cgqjixqiq;1:jhfvkc;1:0gr1gk2j95jt6gn7gx8g69jqbgndhdegtfiyihdjj4mh4ojqpiusjntgzuimwh6;1:7fk8j8bh5jhgmj6onmph8qiurhcwj4;1:tio;3:8jh9h7sjiuh9;1:ahguiz;2:ej4gk2uha;2:mkjnfz;2:1iw3hf4h68kn9ixajjcj6dgyej1fiqggciizjh9kjalk6nh8phaqh9rh7sgpth2vhewgs;1:ditehaninqjj;2:9k1jh4olzph7wha;3:cip;1:2ix;1:ahajh5lgynjcqjfrj8sjfthgvjs;2:5ktcgugh7hjkij8qhgrjrwhd;2:7k5jhf;1:dhcfj9;2:dhgejlkkqphbskk;1:4iv8go9k2ch9oheqk2whd;1:8hakjgphgungwg5;1:1is;1:6jx8iuhjiwh8;1:8h6cixfislh4nhbrgutk0uinwl0;2:sjo;1:gj7ignsj3uik;1:8io;1:ejk;4:8g89kwjitnj8;1:3h08la9ipdgmeorfgygglhjnjh0qhhwh8;2:fiotivuhb;1:tiu;1:ajhbh8fj4kjdlilvj6wgz;1:bhcdipghfhk1jhalivrjc;1:6h6einghbijhjiwukfvh7wiq;1:8iy9j7cgppl9qhgwh0;1:piz;1:pjh;1:7hehitjj4pm6qh9wg6;1:sim;1:6iyvhe;1:8iuwj8;2:4jqshbuiy;1:3hd4mb5h68iuainbhafg2ggfigakjemheph8qgerj8sinuimwls;1:7ishh2pj2qjc;1:8g99kh;1:qnfrhfuhbwgj;1:5j1hiqjh9rilwiv;2:djleh8;2:4ixgirrkh;1:ajigip;1:7iu8ln9gkbhhcj6dgrekkgh2qharjdtk9wgu;1:8ktah1bhfdh9eh9fhfgjirj7th6ujn;2:hjrrgu;2:9iy;2:wik;2:4incf9tl2;1:7iu;1:wlc;1:3h67jmij1jgvpj0qjxthgwhh;2:6fufjgjikvkewhb;1:3hg7hg8hgdheeh4fhejrzohbpj9qgs;1:dgbek2gjc;1:7ipeirjh9rh7uk1;1:fhdujm;2:8j49gucj5;1:3k48h3ajlbhdchbij2jh3rj4wl5;4:6hgql4wh4;4:1hfhixjkelk4nh5;1:hgpnitrk5;2:uja;1:dgrejhmiw;1:jhdqjd;1:8gh9jnhjq;2:0h61l12ui3is4l05ha6h67lg8hd9hgah5bhbch1dh4ehffhdgh8hh8ihgjgekhgmhcpgkqg6rg3thbuh8vitwfq;1:2gy7k1aj8;1:8fg9m6ak2ehcfhggjepl8rkesgxugdwh4;1:0jb8jjaf6bhedjzfgtgiyjhdkhgpj3skuwil;2:his;1:8jdjjekj5;1:7he8hfbj4githg7jl3qkgwhf;1:glslhe;1:1h23hc8gc9haah7bn6ciwehafilggxjfzkg9lhdmhdnmoph8rljtjduguvj0wgs;2:3im;2:3gt4j85iw6go7gk8jz9j4bhcdh7einfgmghbhgyjh6mixniqojbpiyqjgtinuj7wfo;1:vjd;3:pkg;1:0h63hf8h29gzcjadguehefjggljhjqjinpgrqj8rgwtheuhcwka;1:cixfhf;2:gj5mknuizwha;1:hh8jhgtkn;1:jlzwgy;1:ejk;1:8gy9j5bipok7tio;1:8jg;1:0jb1hd3iw6ha7kp8ivchhdgvehdfh9ggmhhfjgvljdohcph7qgvsiqujewkv;1:1h43h24h95hd6gu7h28m59mcak5binef8fg6ihhjfskjhlinmh8nh1pgxqk2rgrtktvjjwff;1:wiu;1:9h9aizdinejc;1:7ltdisjhfqh8wh5;2:0hc1h13it4h55iz7j38fncizehcfiogfwhh2ih7jgplhamj0nlgpl3qiwrk2th6uhgwge;1:rjmsiw;1:jj4;1:jj3qk4wh3;1:uiu;2:rjp;1:uh5vjc;1:8kyeivgjsih8jh3qhdrh7;1:ek1riy;1:mjg;3:wj8;5:5ji8hg9jyakcbkbch2fg2gg7jgoqj4sje;1:gimhirpirwhh;3:9h4dh7ejkjkn;1:oik;1:8k4bgx;1:8jb;1:4jr8j99jhahcbgccoffgaghehhgkhgliqmhdrgo;1:6iwajdhitjgz;1:dim;1:9it;1:jjl;2:8heqkfwhg;1:hgqqjorj4;1:3hd6j27hf8gvah1ciwdj7egyfhfghfhj2ihfjgzlgxoj5ph0qh2rmetlaujavhe;1:fjvhje;1:9iz;2:9im;1:jilwjv;3:vix;1:jgpohcqldwhe;1:bj8cil;1:jjk;5:wjl;2:8hf;1:fio;1:7j4;1:1h9cjehgbpjzrjo;1:bh8gkf;1:1hc8gr9k8bioghekjelherl4;1:4hf5h56j37he8hh9gzajobh7dgifjtihckjtmjqnimok5pg0qiurg2sivtg8uh9vh7wke;2:6gyqlq;1:cirfhdjhgkll;1:1hf8jm9hgajgbh9chbeh9firgijkilohfrjj;3:fkm;1:0ld1g4nil;1:8h59jmoiu;2:8hb9h0dooeg8fimhh2th4ujqvjlwha;2:3ipuir;1:jiz;4:rjqwir;2:0hghimilhwg4;2:1ge8grbj0km1rhgtj4wh7;1:4il8jq9h5afzbh9einfk5ggyjisrh9uinwkb;2:kjg;1:cjxrh1;1:8h19ikgkw;1:phdqllwh1;1:jio;1:ij2;1:5ik;3:kjc;2:wjp;1:ij3riq;2:2kl9h1ak5eh6fkc;2:gin;1:sis;3:5h07gf8gr9gmak8bhcdg2el5fj6ghbjjtkmhmh5nh5oiupiuqh1rjesgmug4wkp;2:1im3j94hg6hf8gxcjmjotoh7ph6qgdrgxuj6;1:0ja1im2hd3iq5m28hb9ilah0biwfh1hk4jffkh4lhbogypgpqjnrgotkiuh4vh6wfv;1:7jl;3:8imbjseiylinwh7;1:jiyqhatk3wh3;4:liq;1:9k1cgvmhdnjgqim;1:bir;1:aivdj8eh7jj5tiv;2:1kfik7kgr;3:mj1;1:1l1gh3jjwrgx;1:fip;6:5la;1:bjmeip;2:3gx4he6h77j18gwamdchhfg7hjsjjfkhdmhbnheohapheqj4rjrsjpthduipwfo;2:0hg1gi3h34gs6hb7gz9gyaivbgvcg7dfyejcfjbggrhmcjlqkh3lj0mh6nh5ohbphbrgptimuk8viywke;2:4j3hj3rh7;1:dikuip;1:8jswjs;1:4je6hf8j29jyah9bgeco5ehdfg4gh5hh2jhckhglhhpjbtj1uhg;3:3hhil5wh8;1:njuuiv;1:njvrio;1:tj5;1:5mjhhcjhcwhe;1:8j6jikmjcogsrh7vjuwhg;1:6nz8e29muah6cipdh3egq;2:0hh1j92hd3h64hg6gj7lp8hf9gnbgzclodhggh6jjmkgtlk1nh4onrqguth2uh9wfg;3:ckbqik;2:bjkcitfhergxsio;2:wjc;1:gis;1:5iswip;1:0iovin;1:agxbjhffzghahh6qgyrmdwlz;1:dh8ej4;2:7ks9j6djllivwh5;2:5jtljirhewhf;2:ajw;2:8h2dluegzjiquir;1:7je8jf;1:jjiqj7;2:2ha3jw5hg7kddiyjhbriywgn;2:liq;1:wit;1:ij3;1:7lk9hhghajjdqh8rktsj8wh1;1:8j39h2bh7kh9lj3mkv;1:6jt8h99jcdeyel6phe;1:jh7qke;1:2gx5iw8ob9j9akkdh8ehafgxghajgykhgrggsirvjwwgs;1:3jj6j88hchit;1:nkl;2:hj4;3:6iw;1:ij3;2:bk2jgtvjswir;1:akhsgk;2:jj4oj7;1:8h4bhdpjmrl4;1:0im3h7cishhfrjgwlg;1:7h0divwj9;1:9ixbio;2:3jllj5riwwhg;2:okk;1:cixwiu;1:gikkhamklwir;1:dio;2:rip;2:diq;2:6joag8bh3ek9flggj9lhcrh9ugxwk9;1:8ja;1:rix;1:6ip8j79hasj1thewj0;1:aiufimjgdpko;2:6fwphfvgzwmy;2:8ix;1:7iskio;2:8jf9khbg5cj1ejojiorimwhc;2:5jg6kx7hbkjllgnqlcsj3ug3wgk;1:8hg9ijegehjpjgmsk4;1:qj5;2:wik;1:1hc7j68ir9h5ehhghanh0ph4qk7wlr;1:8irjhbqja;2:biv;4:sin;1:8hg9gkbhfgkgjh6rkhwjp;1:ris;1:jj1;1:bjeriv;1:1hdfkwggaikrkh1nkeoh6popqh8rguuhewfq;3:0jvwhf;2:wik;1:wiy;1:rjb;1:eiz;3:1lskhgwhe;2:mje;2:ujbwio;1:2iywj4;1:dk8uhd;3:4jgljnphhuim;1:jliwj4;2:giq;1:8hgdgbek4jjythd;2:7j3lheok6pj2ujawhd;1:4il;3:kistio;1:2iqcjdgip;1:3gt6krjh9kjupjpqh1th7uj1vk6wgz;1:aiq;2:6izwjk;1:8h09h3afxbggcgmdk6enogkdhj4jjhlhbqhcrkisjdugmwgk;1:fixoj0;2:gio;1:biu;3:6hacitqipvldwh4;3:8iwbhacj8;2:8j8ejt;1:1gz3gh5kc7j4ahdbkhcildgzgjdhhflh2mjkogwqgprh2slvwh3;1:8jq9hbkj2;4:4ir;3:bjfeim;1:7j6jha;1:uj4;1:8jbdj4egt;1:9iljh2njmsiw;2:bh4cj5jh0wmm;1:6l1phfqjtwgq;1:kin;1:jin;2:1h82ko3hc5jl6j97gfbjxch9jhgohfph8qmdwg9;1:8iqrit;1:1hg5kb7ik8iuagidh1gh3hhdjonlikoh4pipqikth1wg8;1:4im;1:4he9jlahcfh8jj4omarhgwin;4:gj9ih8;1:eh6hixkh4mn4;1:dip;1:jit;1:8iqejmgiqqiyuixwh9;2:bk3whc;1:0hc1me3hc4hg7hdbgpcipfh8ghcjh2kl9nizoj0qh3rgethfwiz;1:0mr3j34he6h57gu9gwal2bh3fjagk7ikwjiukh2lh3ogypgorgithguh8vhcwf9;1:egifk8gjz;2:hik;1:ghdhjciinjjerjptjp;1:rit;1:1gi2h34la6h17iu8h99h9bh7gisjgwlh0mhbnisoj3pju;2:8gm9jjhipjjy;2:2j7;1:8ktwhg;1:dhdejf;1:ugkvkt;2:5jc;1:5jc9hg;1:qim;1:fj1;1:hgyjj4;1:8ip;1:2kr3k54kx9ipjgyohbqh3wh5;2:3heaijbhaehegk3lkemjbuh9wh9;1:2h0hhepk1ujfvjv;2:rj1;1:4iv;3:vin;1:2j5;2:1h93h04he5hd6h27he8j99l5ajabiwcghdksel0fkegh4jgykislh9mh6nhcoikrh0shcth8wfw;3:ah7dgefl1jj0kjlwha;1:7k0;1:rhewke;3:aixciqpjc;1:jj2;1:1il6kmdjuehhfjkjgrmjerk1uhhwh7;1:dimtjl;1:1gf3ll4jh5hb6ka7g99kraf1bgqdgdgkehg3ihcjiwkg5lh4mgvnkzpg7qitrfqsiruipvjw;1:rim;1:gip;1:3gu7je8h0bhdch9eh8fgmhltjfjkh8mheojkphcrgfsjtth9ullviswiz;1:ajb;1:5gw7kk9h0cgzrllwk4;1:8jd9k0ak6bkvcjqegzfggghdjhckj4nhdqiorh4wgx;2:ok3pip;1:pim;1:2hc4gz5gt6gx7ga9iwagpbgvcgzefrfgchltjjukg4lgxmlqnjlpg0qgurg4sh4uo3vkywj9;1:8hgbkt;1:0he2hc3h24hd5hb6gz7hd8im9h8aknbk9cjkdhfej9fftgg8hohihgjjhkgjlhcmhbogupirrfgtjjuj2vjrwf7;1:ujf;1:7jg;1:8jq9gn;3:3io;2:3kobh1;2:6jf8hhehbrje;1:cj3;1:4j98ji9h9ah7ciyehafh2ggnhk6jkmpkbqgwrk4uhewgv;2:ahbfkzhj5jhgkgvlhdmhdnkurhduj0;1:6gr9h7sgxvl4wl8;1:1h78j9bhcgjahinintmiprh0uhgwhf;1:gjm;8:5jo;2:1ktkh5;1:pjz;3:1j05ll8h7gkajh9ljcwh3;2:9ingh9sit;1:0k78jl9h2;1:8io9h8cizmk2;1:cisjhepkpqhgwkg;1:7jkrj1;2:0hd1hb2hg3je6hh8izaijbjidgyfgfggxhgojhdkgtminnh1oggql9rlush3tj3vhgwiw;1:fjm;1:gipwix;2:qjd;2:2jg3in8keaj0iiyjijljpphcqgvrhhuh8wfe;1:jiu;1:chgfjn;3:0k21it2hc3km4m67es9hdbhdch9gh5ik1jg6kgylhcoj2pgwqherkwsgwthfuh6wjb;1:0j51h42ha3h74gz5h46h77gf8mq9kwag0bgedf6elqfgrggahgrjh1kk1lgwmoqnkhog4qglrg2sh9tjhvghwkp;1:chcgisrh7sixwkz;1:8ir;1:5izkjt;2:8gxehcjmrph8qgyrkithf;1:aiouirvka;1:tiv;1:0ik2ip7iofinghgjh6niophgrhasj1thauilvj7;1:4jrhixjj0nj0phb;1:0je1h23ns4h3bhh;1:1gr6jg7he8k89h3ahgbh6egtgm4hgejgqkhamh5oispgzql3uhgwlf;1:khcmknohe;3:4hg8k49j2bj7ej3gh7jirpisqhdrhcskwtgnwgw;1:0kn8j1bh4jhbmjqoj0qhfwhb;1:wjm;3:3gv8kc9eybkmch8dikejrgjthj3jhakgrlk3minnheohepheqh8rh8theuj3vio;1:2go3nf6h8jgnpmeqhbuglvm5wfz;1:ailcj0jhdwle;3:gjt;1:7j5gizjg7wku;1:5hb7kj8h2bitchfdk4eh6gj2jjlnj7qhgrh2siwthe;2:9jqahfgkglh7rk7whd;1:1h6agyblgchfdh2eg0flsgh6hj8jh9kh2lgomhgng5ohcpgsqh9rmksldtjcugtwj0;1:8ipbixejs;3:1ikkjf;1:8hd9jowiu;1:4iq8gy9kdbhgclqfgf;1:4j8pit;1:0hg1ki3hd4hd5h06h27go8h39g2ak2bjwcjsdggeh0fkegiqhj8jgukkllgzmk3phaqgjrjqtgpuhf;2:gk8jgl;1:4jslk7;1:glyhijwhg;1:oikphcqj8;1:9k9;1:5jycgvghfhjdqjwrjuwgx;1:3jkaj0fiphijrhgsgsuke;1:9h4diqejufjarjbuhewhd;1:ck7nin;1:6hg7l5fhhliyvhgwhg;1:qk1wha;1:hh3qjs;1:2iq3j68gv9jzchcfjfgjyrhgwh0;1:8h6bgriiwjhfniyrh9unvvkrwh7;1:uio;2:4j1fj5jhgrissir;1:gk1whg;1:bhguj8;2:ogipjz;1:bircj7ril;1:7hdahajm2;1:9iy;1:6h2vghwk3;3:8haaiqbhfehgfjwgjthiujgskilmiwphergvwkx;1:6hedinvj9;2:1hd9gvalebeyckuegzqk8;1:7j99isfipjjkqgfthd;1:0iz3h84h75hf6hd7hb9ikbiuck6dh4gguhh8ihajkpkhgljtoj8pgqqgtrjpsimthguhbwis;1:1j2;2:7mdah3bhbsizwhe;1:8jqjgg;2:fix;1:vik;1:0jy8kk9mcajdefzijhqharhdsgywgr;2:rj8;1:ah7fjr;1:8jn9h2ch2lhanl1phdujxwhc;1:8ny9fehhdogmwk7;3:pkn;1:4il8gv9j5;1:dhgejqfh6;1:pj7;1:8krcjldizefqfiygh7jj7;2:oj5;1:8j4;3:3lq6hh7nv8jcdhdejaghdjfrpgzrinuh9wgy;1:3iqoiy;2:gj0;1:1h3bkogjcrkowh1;3:1hg4gtbjscj0jhgoj8rh7wma;2:3h87hb8iu9h8aiycjediufhggksjisphgqh0rfzshethauiswl1;4:win;1:2kmjiuwgy;2:bkccjedjtehcfhcghclk5ojwqhfrgw;2:2jb3h7oj6;1:0ik;4:8ivgkv;1:civgiw;3:0gt1jl8fmbjbwkn;2:kiymjt;1:0hc1hb2ha3h74gy5h78e59jxak6bgsck6egkfglhhbiipjk9kjulirpgdqkerlaufnvh2wj0;1:1hb6h37joiinriwwhc;1:pjuwjc;2:8jz9h3oimpiu;1:ej7;1:cij;1:rgvvipwjg;1:mji;1:ah6ujk;1:6jo;1:aj4gj4iipjio;4:gh5rktwhc;1:jm0wh2;5:6lish9vgvwjl;3:8h3tjl;2:jhasjc;2:ql8wh1;1:3hb8lo9imkgvth8uj2wjx;1:1hb8ey9kjajsbh4ghejivnhaogxpkgtjpwh9;1:8hbjkwmipoh3pjjqhgwk1;1:2l9;4:8j2mjd;1:gimil3whg;1:hhbjiyqj0;1:gj9;1:2l5whd;1:qin;2:pj8;1:9iqblbck3rhf;1:ah6kjpsj4;2:0k64k28hc9jejitqhfwh3;1:4ijtjvwh8;1:eij;1:jjs;2:5ksrh3whd;1:jj9;1:njrwhf;2:cin;1:1ki6gw7hdcglggjjj5qlcrmywgd;6:rhewjg;2:1hgcjchiorj2;1:jh9qo1wh5;1:1jj2h0dj8giqwkn;2:4h2ijy;1:rip;1:5lfthd;1:3ji8kb9hfehbwgs;1:pis;1:6hbcgteitjiprhetj7ukjvkx;1:ak9bhd;1:8j5;1:rk3;2:1gw3jtnjj;4:2io4jh8h59jnrjmwha;1:uio;1:aiqjip;1:2kf;2:chbekigj5whf;1:chasj3wj2;1:rimsin;2:7h0wja;1:3iwcjggj5wh2;1:0hd5it7l68ha9h7cjvehhgjajh1lilphfrgdsjcwk0;1:3iudju;1:0im;3:8j7;1:5j8cio;5:1hb9h5ah9bhefh4gg1hs0jkwlheqixwgm;1:giorir;3:8iy;1:5j1ej2uhd;1:bjghhf;1:3k8;1:ijiljvuj6whb;2:jin;2:7m4jhc;1:niuwj0;1:pk5;1:9iwkik;1:cgpmjirixtiowj7;3:8ml9hbah7bhhjhbqk2rjash8uh4;1:2il;1:vj0wk9;1:kh7lmg;1:8jp9hcah8ojh;3:aitfjyhj0jh3kismizrh1wk5;1:hj6jhaoh1ql3rh4;2:9k0kir;4:8hbah9chgfivgh7hhfjhhkh6lksnkhojgrkewgw;1:9iuaj8ghc;1:7jhrh5;1:sjk;1:diuein;2:pjo;2:fij;1:1ir;2:gix;2:8h39k0ehehjqrga;1:3hg7fx9iowmi;2:3hgiil;2:oljwhd;1:afxwl9;1:bh7rj9;1:ije;1:1hh2hf4js7kcbh8giljgbkh6nhdok7phdqimrgnuhdwld;1:fju;2:cj8;1:7il;2:kivtk2uh1wit;1:9imjhg;3:0h91kv2hb3gr4h25h36hc7gz8gr9g0akgbjmcj4dgoeh6fjygirhjhjg9kktljamk2nh3ogvqgcrl5shgtguugzvh4;1:2j0cheristik;3:1hd2jzajdggwhimrjl;2:6j79iodgnejzjjgwh4;1:ff9gh8plfumw;1:jj3;3:mil;2:3hg6hd8h29k4ahccjzdijejtfhfgiukhdqh7rirthduioviywgh;3:vik;2:0jk2iw6h17h39h1bj1dj0gg0hh5jmrljpnhfogwph0qlvrgvuhf;1:cj1;1:9g9dhfeljfk3;1:fj7giohit;2:aj5;3:cipuji;2:cisqj5;2:9jaeijjik;3:uio;2:0fv1h84hh6he7he8jg9hgal5bjbcj0dinegxfjvggyhh4ijekglmhdnh9olcpkcqgkrgushethduhawj0;1:8kt9j4jha;1:kjznj0oiwwgn;1:dhdejf;2:bjerj5;1:dj0uit;1:0l0;1:2h08k4aixfh1hh4jhfpjwujdvjp;1:7ir;1:dio;1:6hb7ktgh7jhdqkpvh2wh4;1:1gv2kj3jk4in5ha6hg7jb8gsaikdh8fjhgguhiujgzkhglh2mk7nhdoh7phaqhasgoth5ulcvgz;2:1hh2m13nx4hc6jq7hejhbph7qharh9thhwgi;1:jhgwj7;2:0je6iz7irbiogk6qhfwha;2:dixghahj7jhduj7;2:3jo8hbgmehhcjhbpjiqj2rhfvitwg6;2:cj6;2:3krcj6ohf;1:giz;1:1ja7hc8iv9hgdh9ehffhdgjfjl3qizrg9sjuwil;1:6hc7hgoikqku;1:3jdijgvkdwh4;1:2jw3gx4ir6he7j78ew9gmalubmkcgiehffergiwih9jfikh5lirnhfohapgorjeshatk1ujcvjcwjo;1:3ip;2:jjnrh5;1:8hdgk5vip;1:1gr3jrahdfjdghhjizmniphgqhhrg5wje;5:8jxbh0hh6rjewj2;4:3jwjgbplmwjz;1:8jhak6bh4fh6jj2lgztjw;1:4jw6je8h5khgonopgmwgx;2:9inril;4:eh5fiysil;2:hiyrik;1:8gtbh8cjsehcjkanhfrkptlgwfq;3:1gp2h63gm4j55in6gw8do9lfahfbgudgpfirgg5hh0kkclh9mjpnl9omapgtqg4rgxskyth5ukb;2:5ij;2:5k1hgzkk9pin;2:bhggilrhguk3;2:4hd8ilaj3bjxdijeipfjdggnhhekklqimthbwhc;1:5k4;1:bjfjh9wji;2:ail;1:ogjpjqqjc;1:2k4ril;1:ciw;2:tix;3:sir;1:1iofj5kjvpj0;2:fiu;1:1j68isejs;1:ag3bjzuknvh8;1:njfphdqkxwh3;1:biogizrhh;1:0kv1jj2l73h65kl6hd7gh9hdaj3chefgugh3jg7kh8ogyph8ripthbuk6vjpwgh;3:kl3mhh;1:oiutjg;2:rj1;1:uj3;1:6gj8h59kdrhdtj4vll;2:2ik3gm4gx5ky6gj7gk8nqbh0cgpfhegg5hf3jlgkgplhfmh7pggqnzrh7tm0uk4vg7wfi;1:7heah9dileh9jm2sio;2:sik;1:0jj;1:1iv3gy6jb8g5ciuej0fiogkxjhekjhlinpgvqgzvik;1:5johhctiy;2:hiotiw;1:6qrbindh5egqmixwf1;2:1gh8gl9jdbj4dj1eh3jhgrjosj3wjf;2:wj3;2:dijtjpuh3;1:3hf6k17h9akqfgegl5hkhjgolhcmiuohcphaqirrixsgnthguh3vhh;4:jiu;1:7jjdiqvjc;2:akgfh3kjm;1:cisqk5;3:0j41ks6hf7jr8h69h1akrbiwchgehgfgwgh8hkiphbqh0wgm;1:uj4;3:mjcohbqj5;1:9irtiwwjk;1:8is9hb;3:ajxcgsjk0sgx;1:ijg;1:8heehefgxgmqjirqm4rhhtgtwhc;1:akqciwjhawhh;1:5ij8irwiq;3:0iovij;1:4jt6hhjhaojkpkcqgxwj5;1:8itaizfhbgja;1:8iubh5gjfjjill9sgcwh1;1:8gptjm;1:2gchjvojyrh0;1:oj0;1:0h41k03gt6hh7jk8jt9lmagvbgwcjgdhbeg5fh7hhakh8mhbph5qgwrj1siltj0ugtwjq;1:ck5ej2fh3okzrhewgx;1:0jc1l32iz3jn5h86h37guahfbk3cgrfh4ghdjj2kfqlgwmg1ngjok5ph7qhbrk5uirvj3wg6;1:5jp;1:1gvbj6dimgk3rh5;2:6l9agvbjb;1:pjn;1:4n3jhgkfjnl9ohepguqhcrhdtm7wft;1:kh5njxpix;1:6l08jv9h4ehehixphfwhb;3:6hh8jvaivjiwkggrhbul1vj5;1:iinriv;1:riw;6:hktrglwjd;2:5k0jhdvj3;1:5jv7kx;1:0h01iq3h64h95hg6k17kg8hf9gvbischdeh7fh8gl1hjyjjkkgslhemgyohaqilrl0shfviowe7;1:6haviy;2:2hb4is8hd9juola;2:gir;1:1hhaheggwil2khdlh8nkopm5rh2whc;1:kit;1:hh9qj7;2:jhfmk8pjqqit;1:dhcej0jktpiqrgs;2:lgurjf;2:gkcniq;3:8hf9j5;1:fh9pj9ugyvkr;1:9imjhh;1:gj2;1:1hf2ke3hd4gt6jq7kn8jv9fwagkbllcl1dh0egcggtjg1kgqlh4mh7ojfpiuqhgrikuinvh3wg4;2:bhdrjw;1:ajnbjyfh2wh9;1:3hb4hf5iu6hg8geah2ch5egxfheijvjg2khclhdnhcol8qgzrk6siptnbvha;1:4im;1:amwfgtjixkiqwhd;1:qkmrituis;1:eirhgxrk3;1:aheejfrhasj0;1:rj6;1:bix;1:3leth6;1:wjk;1:3hg7h09k8amcbjlehafgbgg5hh2jj6kh3phfqh7rj6sjythcukwwgb;2:3jsbiujjzritwhb;1:4l78gz9jjaiqbjachelk0qh1rgvwhc;1:ij1;2:7ip;1:8gtbj6jkn;1:8jb9jrfin;1:4hfjj0pjduje;1:eimniz;1:ajwdizhiqjinuhgwgx;2:0m51j03kj4h77hagh9hheih9jh0kgzohgqghrhfwmn;1:6iy8iodj0ehdnijpivwh8;1:1h93jwmk7riw;1:ugkvkx;3:hmvjj1phgqhfwgg;1:8h99hhdgkem4hhbrmwwh2;1:8mhahdbhgdhfeh1fh2glkjh5likqhbrj3tiluj6wgo;1:bik;4:6n7dkiegijh6pk6wge;1:njz;2:5hhjispkqwhb;1:fk2;1:8k59h9fj7oil;1:3in8heghchlgkhflk4nhhrj5;2:sjhuha;2:9h7bj4ghejg7khdlkpoiosizwl4;3:0ik;2:8haeisliooiz;2:7g8ejbgm1hgzjh7wir;1:6jw8gptjl;1:rix;2:3iyaiwhil;1:dit;1:0h21le2g83gl4gr5h76gt7gu8iw9gdbfldh4fhdgghhgsjgmko2ljgmlenl6oizpioqgprgbsknuisvj1wfd;1:wjo;5:1h97hf9guahhcitdjojkzmj5pj2ukdwgp;1:oiv;1:0h11h52h54gt6gn7h68je9gcakgbjbcl2dh6eh8fgbhgrih3jinkgwmj7ogxpivqgxrgxsgvtm1ufxvjkwlz;3:kj8mk7ojbph6wh5;3:8gfdh7emajjb;2:1gx8jbcg2rl1wjo;1:wix;2:pj2;2:4isah0bja;2:1jq7hf9j2aiwbhedhaejafj9gh1jhfljrqhgwiw;1:bir;1:8hbtk4whe;1:8hb9j1fhgriv;5:8l59frainch5dhdekt;1:rk6wha;1:5k4jh5lioqhhrk4;1:giliiwwjl;3:8iu9j0siw;2:6hh7hf8ikbhghhcjj3mkpqhbrkdwka;2:1isrhd;1:jipwja;1:8iygjtpizrh9;2:ril;2:9hbch0dhdhp3rh5wh9;2:cjdfhbsj8;1:oiluiz;2:ghdhj6jkcrk0whd;1:cj1;1:7j1cjhpiswiq;1:2k95j3bhddh1fhghlhjgxqijrjn;1:8gq9gwbh0ciuehgghghh5jj0kj4rgqtoqwhc;1:oiw;6:8iwqiouk8;1:2j7iil;1:jj0;2:8hachegh6hjvrkmwk4;1:bhfdgsem1hiv;1:nj6;1:qis;1:rjotjxwh7;1:6he8es9l2bfzcjvdj1em9fjvgishhajhcljanjcqhgrgjtgtwgi;1:0h11h62hb3hb4ha6h68gs9hbagobiodjffpzgj2hiyijbjgbkgzlh9mh3ngwohcph0qj6rg8shdujcvjgwjh;1:8it;1:elnjl1rgtwg2;2:cjjqikwin;1:6hhojh;1:9k8ah9;4:bir;1:eir;2:6h6fgigjbhh1jmypharl3uggvk1wfy;1:5j47j18jc9j1fgvgivjgtrjtsirwh9;2:0hf2l6rljwhc;2:4iweizjj7qklwgk;2:jis;1:sjc;2:jfxqjvwkh;1:wji;2:ehbpkywhd;1:uja;1:2h27j2;1:2iv;1:0gw2hd3gu4h15he6jq7jx8gjaj7bjich6dikegffh1gk7hj7kgimgsogyqkjrkltgtuikwfj;1:bj6wji;1:bj5cgepj6rjj;1:uiv;1:kir;2:iiy;2:cja;2:fjnghfjio;1:3jb7imjhfqimrjowhf;1:7ipajv;4:pilrka;1:jjt;2:0iwuj3;1:rjt;1:njk;1:0h62nz3na4k96iz7h6ah7ch8fh6ghajgvnhfpghqg8rhgthhuhgvhfwjb;1:ajgcijfjc;2:0ff3nl4gx7hb9h0bhdehfgh1irpjgooklqh7siruh4wg0;1:jk7;1:jjhnh8wkb;1:6gv8g39j3aj7fhggiwkhfphfqh6riwsh8thbumavlnwhb;2:biv;2:wip;1:8jvahfcjjeh8jgnkgankzrkduhfwhb;2:rhcwje;1:hhbrjf;4:1hg4ju7hd8ghchcjgwkhgmhcnheokzphgqj3rh8tjjuirwmb;1:6gk8ky9h5dipegxujyvjf;1:1j6;2:3hc8iobklcjhdh8fitgh6hggjhakiumj0nh2ogwqlsrj7thfwgx;1:1jj;2:0ld1ip4fx6hf7h69gwbk6ch0ehfgh5iizjh7kkdoilph8qhfrgvsh5ujtwjd;2:0hc1hc2hf3h25h66gj8gyagtciydj8ef6fh9ggshmqjjhkh6lgwmhengsohbpj9qgmrmosh6tggunhvkowh4;1:3gx4gv5h86hf7h48iq9kzaipbindj3giqhh5ihcjitkj9mh6pgpqhfrg5uixviz;5:6j1gj8uim;1:6hc8hgdixeguflqgj5jgophaqhbujuviqwl9;2:jgqwlt;1:fjpuirvjl;1:9jd;1:2in3io6j47h98k49ewak0bguciueiyfgxghghj6rjitk4ug9wgu;1:sj2;1:6ha7hg8jo9k8bh3ch9ehdfhdgk0hgnjkdkgdoheph7qgirikshfukqwj8;1:6iw;1:0gx1hf2hh3hh4h86ha7h48l29l6ak9bh3ch9el3fguhirjgfkgqmhcph1tgyuipvj1;1:pkwsip;1:0j2;1:kjfviz;1:1hf3h44hd6he7gu8j49gkaimbktcjnfgwghdhgkjgnkjylmjogdpgvqlgrjzthauhf;2:ljcphdwix;2:jik;1:1hb3h17h38my9mwakmbipdhaefzgguhh0jfqkjnlgqmhanjaoh5ph2qiprh5tleugzvhgwgc;2:ej8;1:liy;2:ijc;2:fiw;3:kio;1:0h9ahgflctiuwha;1:9iodiqeitjjtrh4viq;2:2ikuiq;2:wko;2:8iu;1:3klbgyjghrki;1:8gu9js;1:qjl;1:6j0vhd;1:pip;1:9j3;1:4ir5hf6k87h08hg9h5bj3cgjdh6ej6ggkhj0jgfmiznheph6qnyrgmtjsvhfwiv;1:7j8;1:eivjjaqj8;1:2k17j4bj1hitwh3;1:2kn6h98gn9jrehcfhbkhhrhevm2wjn;2:wjo;1:diwhiw;1:0h71h96gv8l99njailbgocimdgoefqfishj5jflkgymhcph6qgtrkptizuguvj6;3:8h4cjqqjurhdsjhwhg;1:eip;2:0io1g1khflmbrgtwmj;1:2jh6hdqkxwh3;1:dhdej1;2:bhakjpnin;2:0iu1jl3gz5hg6hb7l19jubh3dgtejufheghahgbkj3lhbmhenikoh5pgwqokrgotgwuh6wg1;2:8fu9ipajrch7kmvlflpim;1:bixjhaoilrkewh5;1:jj9;1:8imaiwfj5hj0jhhrgv;1:6iuhgltjz;1:qje;2:0h81hc4hb5hd7go8g9ak1dj1egvgjzhkyihbjf4kh3mjinhaph5rlpshbtgnvhdwiw;1:gh9iiprl2;5:aiufhggorih7jgvrhfwhe;1:8jb9h8;2:bj5rin;1:fjihhgoj8;4:jh7mjr;1:9indipeitijhjjqrh3vip;3:8j39k5ah0ul0vgm;1:0he8im9hbbh3chadhefgkggmhpdjl9qk3rh8th4wgm;2:cjiliq;1:8iwdgsej2riy;1:3j89isaipdjhek9hj4qhfugw;3:5j4ahhfk5tjuwh7;2:pk3skqwh0;1:5ikjiqkjtlgn;2:3kz9h8chheh6fixtin;1:9j3;1:6lf7hdjhcuh9vjywhf;2:0is8he9iv;1:wjl;3:1h82h73hg4n1akkbh4fgighejj8khgol7ph8rhfwgw;3:3he7h48j29h8ak4dhcfk4ggrjjfkh7mmknkfoh3pgnqiurh8th6wfv;2:2hb3hg4hf5h47gq8k29jugijigokijljwmh5ogzpggsjdtj1;2:3ks9hd;1:ghgwkb;1:4mlck1jh6mh9ogmqjbwhh;1:jk3wgw;1:kj2;3:jiktitwir;1:pjd;1:8g0afrjkrnj7rh9sjxtisvhfwl7;2:bjdkhf;1:1gxilw;1:sj8;1:6gldj0eh4uk3vjh;1:8heggbhkvjjx;1:1h0gl9rh6tixujzwh6;1:wim;3:1hcgpxjh4qjrrgmwgy;1:hiujiswhe;1:bhgmke;2:wja;2:gj6ok8;2:3j2cirmjpwgs;4:9it;3:0jf1g83mm4gubfwckogguhj3ijrjghkhbqh0rhftj8uh5wk4;1:5im8isaiq;1:8jf9gw;1:ais;2:9iyfj5;3:1jiijj;1:tiy;1:ljyrgx;1:aio;1:9j8bjacgrtkawh3;1:3he4jk8g19kabhcciydgweh5hj3jjblizqh0rj7vjpwgd;1:8goujx;2:2io4j97ik8h3dgdgixhhgphfqhdrizwk7;1:4itdh3ejdjiqmkiqjfrflwhe;2:6hh9hgumq;1:6hgql4wh4;1:5jg8j89hgjheohcqhgrk4sjutj8wh8;3:ojs;4:8hbeisjijlio;1:gikoj3;2:ajnfhf;1:3indiweh4;1:bhhrk2;1:wjb;2:gir;1:9ioghcjir;1:0jr1l92eu3j54lk5gy6jr7nr8h89hgbh6cgnfgxiiykhelh7mhenh5oh6ph0rhashathauh3vh0;1:mk9rjewhe;2:wkv;1:8io;1:8ioaj4blrcgxejqfhgkh4oheqjmrgssh7thevj4wh1;1:tj5;1:wjn;1:lip;1:sjd;2:1h68gechcjkerkpufxvl0;1:ej1;3:0lo8ikahe;1:1ikrgiwl7;2:qj7;1:2kf7jg8in9hhdikeiyfizjh9oh3qikwh0;1:7k5hiothe;1:jio;2:4h86ma7j0ah9bgwcj7fmdgh0hgljj0ohdplkqgnrk8thewew;1:8hgjh7rjowm8;1:bk2fj1rhd;1:8jp;1:8heajtciqik7rhgwhe;3:3jq7h08jm9giah1bhhch4egjfipjlumhfphfrgsvjxwlp;1:3jj8k59g9;1:0ix1gn2is5hh6h57ha8jb9l8bkfcmbdjgegxfftggiihajgukj0ljxngloghpgorfrvh9wgr;1:fjm;1:ahgeimfir;1:ajgrgz;3:8gsbhalhbrmi;1:0me1hf3gs4gt8inaiyeirgk4ikxjgmnixphfsgowgt;2:8iq;1:1jx7hc8hfbhddipegwfiqghajhhnluoiwpiyqjquh9wh0;1:bil;4:2l5pjhqhhwha;1:ciu;1:siq;5:qja;1:dhejhgqkoviy;3:citqin;1:oil;1:0gw1hd2hf3ll4h85hg6h97h29grbgtcjfdgbeggfsxgjthkpiinjjqkfvmhbnhfqk1rgisgzth3ugxvhcwdr;1:1h07jpbjnpipqiv;1:wiy;3:jgsqk7;2:8jo;2:0ha1ha3hd8ir9inajdcindgfejihg2ifvjgvll8pheqhbrmfthgwj6;3:hj7;2:6hadh5thdul5vix;1:jis;1:8k6bhhcgwhk9pik;2:hiwjim;1:ljk;1:jiv;3:8jd9gahgeihhrj6ujvwkd;3:3j6aj2riv;1:8h69k9wj2;1:ah5ghdjhbmhcsmltk5;1:8iuqj9;3:tj0;2:ak9bhb;3:wkh;1:1ha7hd8kd9fyajhbmbjgnphfqhfrkzthgwjs;1:6jd;1:0ji;2:nir;1:0n2wgw;2:jhclh7rjvwkd;4:wjh;1:1ju4j75gq8m79fwbhgdkbeglfhdgg0hhciinjmpkhdqh5rh5sj3uirwg9;1:bj2fjjuipvjk;1:8hd9io;1:eiqhimsik;2:0h94kupjywhd;4:lhaniqriw;2:5j29h4bgwdj9jgvkiqphhqhdrjasjntj6ul9wgo;2:bjzdgpgj1jkpqhg;2:nio;2:8hhcjcdj8;1:jiksj7;1:mix;1:7jycmiqivwh0;1:8jj9h2aj6ehekhgqk4;2:oivpjkwhg;2:1koehcgj5khdrjf;2:jj5whf;1:jjy;1:8j8ahgbhfgjpjl8kinnhfoflpm1qjlwfq;2:cisrji;1:3ja;2:9h3eilkhgokf;2:ciofmlgh6jhesjgwhd;1:wiv;5:3h15kd6gy7hd8h59hbdh6ghfjlmkj3qkprhguhevj7;2:jiu;1:0ik2io3iljh9klgnimph9sj2uhc;2:6j0il0wh8;1:rj1;2:djljiv;2:jj3;2:8j89ha;2:2iogh9jj6sj3;1:ejt;2:9ipehajhaql1;1:qkywhb;2:1ld2jm8iy9hbkheok8phaqhg;1:8h49l8agmbhccj1fizghgnkdqimwiu;2:wk0;2:qj1;1:1h23hb6j37hdaiqbkickwdgtej0fhagj8hgtihdjgxlh6mk7ngwoh3pnarfzthawfs;2:wir;5:aghbkudhgeikfldwh2;1:8hh9kjbh4cj2ejprip;1:gj3jha;1:ckmfkuggghgyjhekhgnhepjbrkhsjwwgq;2:jis;1:bim;2:gji;2:0h21gy2hc5hc6h07he8ha9izckkeghfekglthjmjh4lhfmgyoh8phfqh1rhdsp2tj1ugrwja;2:hju;2:gir;1:5jg;3:fh7khbofxpp8uj2whf;2:8gwuk7;2:sim;1:uis;4:1k07hd8j4aikbhccjaejjgh2hh9kjulhfnipphcqgotimwgy;1:7haejjgiqjj6;1:ejg;1:6gpritvjm;1:0ha3h44hd5ij6gz7jt8h4ajkbmrcjyggtjipkjhlhgnhhoh2phbqj2rhgshgth5uilvh9wey;1:1h02j33lu4j26hf7h98ij9m4aflbgcckndgtgjmhjqjggkh5lh4mh2nhfpguqg9riktj9ugvvhewgs;1:2h58jlhiqjhbokd;1:8gu9kiajacj3dh6eirfh3njfrgduj3;2:0h02iq3kl5gp6ko7h48f79fzag6biydgnfh7gezhgpih2jgzkjplgzmkgngqokmpf4qk8rgstn4uncvgk;1:ajfjizwhf;1:1ir;3:0jf1gxgiojjlwh1;2:jgrrk1;1:tjtwio;1:4j98ji9h9ah7ciyehafh2ggmhk6jkmpkbqgwrk5uhfwgv;3:0h9wm0;2:0lp1lc3mi4ik5hh6hd7h7agxbkzch4dh6ejdfhghhgjgakg9lgumg5ngrolgpgbqisrgotgwuh5vhbwg1;2:pj1;1:8hhdjjegmgjohhhuk4whf;1:rj3uivwhc;1:bjykh8;1:jik;2:lionjs;1:wj2;1:niw;3:ohepjx;1:5jr6k08ja9h9diofhgggujh6oh8pherk4sjytj4wgx;2:kik;2:gj4;2:wix;2:jj9;1:2g93gj4m06h47he8gu9h9cj9dj6egvffzggjhhejgikh8lkdmkhngkpowrgxthbujm;1:3l7bh0;1:4jm5h87hb8ip9e0bjqdmnehdfjgjkqkhgqh1rj1wgn;1:hg9rk3;1:qmmwhd;4:eixfje;3:fio;1:eiz;1:7js;2:jj8;2:pj8;1:jghqkj;2:2ix;1:1im2it3jb5ha6gy7gw8jw9hfaisch6ehafgygg5ihfjjkkjmlhcnguojqpk9rh8sjewfz;1:rjj;1:dinjiq;2:hik;1:hgfrjp;1:ojnshe;1:gk0whg;1:kik;1:uir;1:ukpvh8;1:1jm5ivfjc;1:6kxdgfejgghgjk6qh2tk7wgv;1:jja;1:3ksjheojj;1:aiycj5diqfitjk9pjbrh1wgy;3:7jvtim;2:gj9ih8;1:8gs9gjajqdloeg6gkc;1:ohfqn3whb;5:8hdgjnhkcjh3qm3sh0whh;1:1gt7hc8m2ah5ggvkgqrhauk1vjmwj5;1:8itpkf;2:oio;2:3io;4:3jy8h99io;1:7jq8ikaip;2:gim;1:gh1iliwhd;1:fj5;1:khfnmioh8piy;1:0h31h93hd8gw9k4al4bgccinehbfhdgjdjfukitmk4nh1ohfpiyqkmriythbwhc;1:2km3gz4l77jf8gwjiqoh4rh9;1:dhdek2;1:5kz7hb8hgahbbhbfhcjjppkbqh7sintjbwgx;1:dioeheok3whc;1:djqegh;1:8iq9h9aishh0jj2kkrwhb;1:ij6;1:3hd7h48iz9gyakldhcfk5ggsjjkkh6mmlnjgoh3pgmqitth7uiywfw;1:fik;1:bhbgjl;1:5hg9iuajhjik;2:uin;3:7mr9hddj5jg2phe;1:tjd;2:1h43hc4jp7hd8k89ljbgiekzgh4hjgjjokh9lgxphcqgwth4uhfwfq;2:2kt9jaahgeh3fgoggyhkgjkomh1oh2pioqgptisvjkwgp;1:8hdtlowh6;2:vik;1:0fuik6wim;1:jimwis;1:8gzciujhfqj6tjb;1:1klej5gj9jj8;2:0krwh9;1:1h59hfainbhfdgtejffjeggymkgoiqqhfwjo;1:fk3;1:4io6it8hcah3gheihdjh3nivpinqjergzthgwhh;4:2gn7jg;4:liu;1:oiy;1:fikwix;3:aiosir;1:8gskl0ll3rgewhc;1:8haaiu;1:3jffh8;1:pju;1:diujh2wlc;1:8jb9j5ah2bhbcgyfgxhhenh9ohapptqhcrjutiouh7wgq;2:hix;1:0h91h22h73j24hb7iv8ja9joah9chbdjpejofhcggykh1lhbphgvim;2:0he1hd2hg4hc6jh7jk8gg9hgbh6dh6ehfgknjfnkkclh6mitnjaokurfptggvhbwk1;1:0j19hbbivghcjk3ojrph6uh3;2:8h9jm1phgqh9th6;1:2gu4h55l57he8j8bhcgjskizph9qh0thawm2;1:aj9;3:8hgfhajgyokopjqshawin;1:2im8gyfiojinolupgttjfwh9;2:hio;2:0gb3m86hhjkcqiurh0wkf;2:1ki3hb4hf7hddj2ehgfhagiqjkknh2qjurhbwj9;1:aimujj;1:bj1;2:4j2hiplin;1:5ku;1:gin;1:ehdrj1ujy;5:bjxcj3rhg;1:dkdjh2rjhwik;1:4oa9j7chadhbfizjhcnhguhg;4:4ik;1:cipnk2pj7;3:3kl7h39kjakjbgveh7fgygkphknjh9kh0lj1mk6nhaoheph9sepuhgwgx;2:ahgujn;1:eh9fjn;2:hir;1:wjl;1:8jfahfbh5cikfh1gjjhilklmpixrgotimwhc;1:jj8;1:1iu;1:1h93hf6j88j59gkbj9cgvggzhh6jgikjyllfmh3njcogyph2qiztiywjx;1:6gq8gk9irbhbefkfj8rmfvkf;2:ggyhkajhetjuwhd;2:ghbiiokhalkonhephfwji;1:0hb1lw3gx4h67j88h49kmagibiudhcfj0ggihjaiiunjmohgph9uhcwfw;1:1io3j9qhg;1:0hb1it4kccjwjgrphfrhbujcwkp;2:dgwel5kiorgq;1:aizth3wjm;1:8fqtl4;1:lju;2:bilcjqjhesirwh6;1:gin;2:jio;1:7hfgkb;2:wis;1:3ixch6jjhtj6wha;2:7izeh1jh2pkgqj5wjq;1:jj8uji;1:7j1;1:ah8fio;1:8dt9mqgikjjk;2:6na7hcph3qhb;4:3hf7l0aiwbh3;1:his;1:9in;1:0h41g43j55ld6g77he9isajbbjkdgjegnfj9ih5jgkkh4mjlpisqgirh1tk5ujzvhawhb;1:cj3;1:ah5gl7jh9whc;2:qkcwhe;2:4j0aizbkxcjwdhaeiqfhgggtkj4pjcqj7rfm;5:jgswl5;6:1hb2hg4js6he7hc8h5ahhbhbeh4fhagizhjckh4llrok1pggqlctiyuhbwgp;1:9hguk3;1:aik;1:2l93kh6k28hhjimqhathewgx;1:wiw;1:0kl6hewha;1:2gn7jgjil;2:8in;2:8nt9dvah6ehesk9;1:4kjuhd;1:5lf8h7bh7gjzjhckh3lmxrhg;1:3j3bhfchbwki;3:5ja;5:jj5;1:0na3gk4iv8he9hfcixdikeiofiogjskhfuhgwgs;1:5ivajc;1:ciq;6:1jr8kw9gdak5bh5chcfgkgj5ijikganilohbpgwwlr;1:8iy9hapiw;1:0hb5in8gt9gtbhcdsuegagj1hgyjj8qhdth2vjlwg9;1:fiq;2:mh3rkg;1:2km8hfbkecgljk0rjfwh3;3:7j7win;4:gikqimtj7whd;1:2h47j0;1:ejy;1:0l31gv8is9j1bj0ejifjcgh8hipjhekhhwgs;1:6jy7jagjxqh9whd;1:ejchj5;1:1k82gpsj9;1:3o0agqfdsgjchimoikwh6;1:5jg7hc8hcahhck1rglwmm;2:3hg6iz7h78ka9hfcjheimghcjgnlikqhfrhavk0wiq;1:ahdeikfj2ij6;4:ahfbjj;1:3ikfil;3:1h52j1bhgehdgjyrikthfuiovk1wha;2:0kk8j29ikdh7jj3kiqwgy;1:jjgqkkrgzuhc;1:jhdohfqk7;3:iitwj2;1:fhckiz;1:3h88kw9h2agxbgsch7ehdfgjgmmhgbjg4kiplkcnkloh3rhbtk0;2:ajauha;1:hhdjka;3:fjo;1:8iw;3:wja;1:4hg5it6hegh2jgdlhcqgytpxwjs;1:1hg3jk9jkaitbh4fiyhjakhcmhbph8rjbshgtgxvh9;4:2il;1:1hb8gm9ipahfbk2clrghdjj0rgvwin;2:2j4;1:uj5;1:gh1iliwhd;1:uil;1:hh6jktqhgwhe;1:0gl1m73h06hf7h08ip9jeah9dj1egqfgmgnbjfpkl4lh6mhgnh6ogwph2qjothguh0whf;1:8kg9ineh8hjl;1:4j7dgvjhgugpvkkwim;1:1hb8gxcivdipjhekm9rgvwix;1:sim;1:ah9cj6ghehj3wis;1:1hh4hcaj8fjtgjfkgplh3ngpohfpptqh6thgwhg;2:jjkpguvim;2:1hhwjh;1:8hcbk7;1:0io1h36h78ki9gbahgcjigioih2jjzkgmlgqmh0nnmopvpfiqgqrg6thgwg2;1:rio;1:eiusk0;1:5iz7j8;2:0is;1:0h82ip3h67h88hbah6bjgcgzfkhgj7kk4mh9nhfoh5phdqjpuhawk9;1:0hg1h53k3hit;1:8jg;2:9ineip;2:aip;1:8ghhnxrhbtjgwhe;2:airbhfhj7qjb;2:1he7l38j59jzajfbkdcjgegwfgmghdjhekismhcnhdrgxwgr;1:bjr;2:2jl3hd5l96np7g68h39hebhdcj8dgmeh9ghahhcjg3kheogppj8qgrrg9sh1thaufdvofwk9;1:uh0vk2;1:wis;1:8iprin;1:3kocitdh8ej8hizuhgwh4;1:0hf1h35jh8g3dkyelrfkhgh2kh2lh7nh8qizrgysjntgzuhhvh8wge;1:diw;1:4kwdksegjrhcuha;1:8h19h4ah9bgmcgpdk6emhfipgjthj9jjklhbqherksugqwgr;1:aj6gh9;1:6hg7jo8hgninrimtiv;1:9izdheiiork4skith1wh1;1:9iwcj7wim;1:8j3aij;1:aijohfpiq;1:ijh;2:8nk9g5bgfchb;1:0jh4h2ijm;1:mjerhd;2:dioegphj1;1:9iyuk0wim;4:hj9jgx;4:8it9h9;2:agzhmuwj0;1:6g48jrah0bggciqdk2fmphftrgiuojvgewh8;2:ais;1:djo;2:ujk;1:3kgahefh0pkf;1:0he4kb8hfan5bhfehhrh9sjuwh4;1:3h04hg5ha6hg7mo8fp9jdbhccjgdj4eluhh7khelk5nh9phdqikrg6wgd;2:pjl;1:1hg3h98iw9n8ajmbg5dheehgfiugh6iklkiplhanivphfrhaugswfz;2:hinnik;2:sik;2:8ipbj7cgcghgjebmmfokdqhbrjzwkb;1:gjtjjf;1:1gvgk5rh8;1:0jw2ha3im4go5it6h97gt8j29h2bo8ch6dn7eg1fgyhkfih8kgbmh3nh5oj5pglqk5rhgsg0th5uh4vgz;1:8ka9gmahgbivdg6egoggjik5jh4klnlismhgphfqh2rhctmdvhgwil;1:0l73ks8h69gsahabhbefyghghhbjgemh9qgyrh4tgtulpvjown2;2:1h3ahgbh3cl4nh2ol9rirwhg;4:2ji3im5j18in9gxchcdj9ehgfh9ggxhhfjghkhbmjhnjnol5pk5qh0rgtuhe;1:bk6hispkiwgf;2:3ki;1:cir;2:8ki;1:0pl1hc2h93h74fn6he7h7dj1fijgfshixijijfokgrlj9nh2oh5ph8qgqrgsthduh3wny;2:gj9;5:jj8;1:jio;2:dhffjvris;1:wil;1:6hgvim;1:qin;2:3jg5jc7j6jgjokkphcqizshgwha;2:0hg1ha3gz4in7hd8jk9fbah2bnkclzfjxgfqjimkjzlhamh3ohfpgtrjhuhd;2:bijohfpj8;1:nip;1:bjdril;3:1he3hf8h49hfgh7hj8jkskhanjhojdph7qhcrj8tjfuh7wiu;1:uguvjn;2:5jesk2;1:4j58imbjd;2:ciu;1:bl5gh8lj3rh4wjj;1:0hf1gf4k36h77h0bhdcgwdlfejrgfxjgdkjhlimmhbnisph2qk0rj8tgjvh3wgd;2:0h63io4h95mv6ft7j5ailbhedlzekofh3gguhjejilkh8lhamh6nh8ohfrgrsgltgyuit;1:jh8wj3;1:uim;2:hirwjo;1:hjf;1:1jawjd;2:citojtwlb;3:1h93jv4hf5hb8h39gtan7bgjdgteiufm2hjbjgukgmlhhmhbojdpilqiyrhfthguh3wgb;1:jiz;1:bjg;1:5l3rh0wha;1:6jl;2:8imfjp;2:chdgizjfvwlt;2:7ggghfjmqqkorgfwha;1:8hbdlg;1:tjv;1:5ky7hf8h5ahabh9ghdhhgjjpmklqh9rgasintj4wjm;1:9jt;1:ohfpjjwku;1:0iu1km8h1jh2skcvhgwk8;2:5h2jjruj5;1:8imgj6;2:jj3;1:0j55hf9h5bjedk8eg0rjgwha;1:7hf8jiggljhdqpurh4;2:7il;1:0hd5jm6hf8h6dj1eimgh5hh3ohfqgxrh4tq3wh4;1:uik;1:0hc3h86hc7k68im9imak3bgfcipdjzehggkxjh8kgxliqmjnnh5ph7qgerh9sinthavhcwg2;1:5ivaj3gisrhc;1:wjm;1:dgoek2rj7;1:3h5bhgrjywjr;1:7k08iuciqghgijujk7ph0qj7rizwgf;1:6j0jhgkh1lk5wjg;2:vjx;3:eim;1:9ircj0rin;3:3jv8h69hbaiqch0eipfhghjhrhasimwjz;1:0jtnjbwiq;1:tiu;2:qirrir;1:aiwbineh8fipjjhmh0tjauha;1:wje;1:qiy;1:tnq;1:akgbjpchbfhbgh9wjk;2:tm5wg4;1:bivhil;1:hiy;1:1im2j98jk9haagsbioch5jhfrlhwhb;1:sjjuha;1:8jrcjdfhbkhfujewhf;1:1he8h9chedjaghfjmkqh8rk7wg9;2:5hg6kyaipbh5cgzdh7ejifilghghm2jkvqittheuhdwff;1:wiu;1:bhdfiw;2:6lhcgrjiyqkavh8whb;1:2hc4og7he8gk9j0agubg9jlwqhariquj6wh1;3:0iu3j06hc7jzdj1eizfj1ggzkgtlkkmhbpg7qj1whh;1:ck8hj6jivnklrh1;2:4ndphb;1:9hedizfirkj1;2:rjswjg;1:ghfjiz;3:0ga3m56hgcgkghchkajk3qirrguthhwkd;2:jhewj6;2:8kz9dxah7biqcildgufkbgggiiqjhbkkrliomhhqh6tizwiu;1:6jl;2:3lhwhe;3:ahebijgjvjh1wjn;1:0isgim;1:bkgcg9dl8eh7fgigjehhgrjowhf;2:jivuhfviv;1:pj7wil;1:8he9jacip;2:0kfgixihgwh9;1:5ikqjz;1:4ksqh9;2:cjerhe;2:4im6j8bj6che;1:1j22gg3h44n1ahboirph9wk1;1:riq;1:qim;3:1h17h58ipalgbjoch9eh7fgngh0hh1jgokhglgsmj5ohfqh2rjvslxtheujz;1:8lf9gh;1:1he3gp4hf5hb6hc8j49j1ak4bl2cj9efwff9gklhg3jnqmhdnhaohgph0rgdtgsufnwkk;2:7k3kiu;1:6hcahgkhglhdmheolbpinsjgtivwj5;2:6j2jit;1:4izcheohfpir;1:cjajk9whg;1:7kdcivfhejh2qjxwhf;1:6jg8hhehcrje;1:ujavkb;1:cgxhjeoje;1:2iz6jpcikwhg;1:kh1nkj;1:8il;1:0hg8iuagffhhhjunjuqk2the;3:4lp5h88ioailbhbck2gjcjgxoiyrgjwhf;1:wj7;2:iiypiz;1:8jr9h3aj3jir;2:1jk3j4;1:kkmpiz;2:ij4;7:0hc1l92ha3go4gw5gu6gz7gu8gg9fmal5bkhcjzdgjegqfkrhjqjgjklulh3mkinh4ohephgqg5rk8shgtgtugvvh0;7:dgsejq;1:vj7;1:qj5;1:8j49jkcisjipuj0;1:9io;1:5j38f99lvagrbj4djisj2whg;1:nix;1:3in8hbfitghchke;1:9hccm8rgb;1:sk1;1:1hf4juafybjcghahhckhhljpoinwkg;2:gk0wh9;2:2koqj7;1:bhggjenj8ritwhg;2:fio;3:fk3;1:6nj7h69hdbhccixdkbegmjgmrj5;1:uj8;1:ginjhgkizrikwis;2:8im;1:2l64gzhh3jh5wko;2:sip;2:dikjh3oj0sja;1:8hgbkg;2:3je;2:chcjjlrh6siwwkv;1:5jooj5;3:3ha7h99gqal6bjodhbekefhbgh9ilyjevohdqj1rh5sl4th8ufs;1:3h84ke6iz7hf8k59h3agqfh2giwjgakiwljaqh1rh6sittj1uhdwiq;1:piv;1:3hejhaniwoissipwlw;2:gkcjgu;1:ah4dg2rktsk8uhd;1:hhbqiy;1:ckdeh2wjj;1:pjnuikwir;1:uiy;2:am3fhdjg8wk7;2:5im6hd7hfdgvejtfiyjhgpkqql3uhfwgy;1:hj4rjpwhc;1:niswhc;1:0jbdhcejv;2:8lb9gmbhddilejgjh2ohbpjarlhsh6;1:4ivkjv;1:8h2aipdilej5kkkphbrh8tiouizvhb;1:4h26gu8gkak9bgvcgsdheegwfjogh2hl3jj5khenhfqhcrgnsikuowvkswga;1:0jo8kl9iudh6ghejgzljorgxwk9;1:hk6jhgnjzrg7;3:fjdgjq;2:fj2;1:0k7qiw;1:7j5mjcoikqiqtj4wh2;1:niopiv;3:8iw;1:ch0ojbtk0;1:fislh7wl0;1:4im;1:jhdwjb;2:4j2pj2;1:0hg1mw3iv5it7hb8kf9h4fgngh1hgyihfjknlj1mh8nhfognpj9qg5rfqsgfuhdwl1;1:6hdvke;4:8iq9iodjo;2:0h81h68hgdjkejlhh9jkbkitlhdmn9nhhwgs;1:wk4;1:biycis;3:7h48iv9lmajzbh5cfzdhdeg9fj3giuhhejggkh5mirqkwrgtthbuilwjl;1:dh0ejqrio;2:8l49gsjgz;1:0hd1p93h05hb6h28gz9hbahfbilcj2dgvegrhjcjg7khglhgmjxpgmqgpropshdth9ugzwfn;1:2gp7jeej2gj8;1:8io;2:7k49jraj9fgyniurhd;1:5irrjx;2:jm7wh3;2:win;1:8heogtpjjrk4;1:liw;1:2ko4gi6h48izfhfqhguj9vo4wgz;1:0oh5ga6h67jh8jt9g8ah5ch4dgleirfhgghdjk2kgqlgwmjdnhgoh2qjxrlssgstheugwvh3wg5;2:uj4;4:jiq;2:bir;2:bikhio;3:7j6dh0qik;1:0ivrhewl9;1:girjisrjjwgj;3:wkk;2:4j9;1:2l98iowgy;1:3hgjhckh7mkynheoiopmtqh5wgz;1:9jocistio;2:0hg1he3he8h4agtfh0ggghgukh2miznhdoghql0rnesh4tjauinwla;2:3hg4jgajrbk6cjwhh2jhckhhlhgnh1pmzqhfrh0shgtj8uh8wga;1:4j3njmoh7piy;2:ak3cj1eh4fgjgiohjtij3;1:ag4hgfrn9;2:jjb;1:ahacjwhjd;1:bipwjj;1:3hb8jq9gfagycn0djselafgvggvhgwkhgoh9pj5qhdrfstk1uil;2:2l99gvdl1egj;3:7jvaiy;1:9hfsnbwha;2:9jm;1:jk3rj2;1:tik;2:3it6h7vj8;1:5krghbhjbjg0qhcrkf;1:0iywju;4:0gn1hg2h73gl5ha6hd7gt8xy9jtafsbnzdgyef7fgvhgyih7jgskp0lfumgrnh7og3pgvqg9rh1sh0tg3vj1wg4;1:ck5jh6rjk;1:3k64he8h99h8dhaijloh4pj2qj2wkg;1:fim;4:aj9;1:lil;1:6jwphg;1:7ixpjiwha;2:ckmhjcrhh;2:djagj2kh0nkc;1:8iq;3:ah1hh4rm7;3:9jtegx;1:0iq6gz7jv9h9givih3jjskgplgpmh1nnooqbpfjqgqrhbvh7wgg;1:1io6jp8l09g6cjpdjeegsggxhj7jh0ph9rfpthgwlh;2:dipeh2njduj8;1:4jq5jsaheehakhgljknk7rikshawh6;1:4iu;1:3gz7hdahgfjfginjljmhdpisqgurh7wje;1:8iwchejjboisrk0siywh1;2:tk8uh4;1:2ky4gi8h8fgcgkwhixkhfmghnl8ujlvh1wh4;2:uje;2:6hgql4wh4;1:5iy6hb8gt9iudkheh5qgyrhbwm1;1:2gvolk;1:diykinqik;1:aim;2:6ixpjs;1:wiv;1:6jn9hbch1fl1jgoqhcuinwks;1:hje;1:aivjji;2:3h8bimfhfgkujhcrilsixwjv;3:7h7gj9ik9;1:oljqhgtjtwgn;1:0j11jn3h16l67ku9jwaisbh6ch6dgvejwfhegh8hgckj4lhemheniloh9ph7qk6rgstgzuh1wf8;1:rio;1:2h43h44hd7hf8j89j0ajubj1dhbegwgizhh3jh5kh7lhfnodoilphbrgath4uh8wit;2:2ir4ji7hb8h79h4dmvef1ggvjkfqhcrlzwgt;1:qjc;1:wj6;1:4ir;1:3hd8jk9jdakcbjhdhfeh2fgqjm5khfnh4rgxsjithbuhdwfr;1:4irejevj8;2:5j56he8gn9jhaivbh3diy;1:8haajbjjaklewha;1:dj8ehbuiz;2:2gr7jg;1:dhdjj7;3:8j59io;2:8ha9ix;1:qk1whe;1:4obojdphguhd;2:1hd7inalbbhdfhggh7kisnh4qj0rhfwjo;1:0he2hd4h95h87iu8gh9glbgpckoehbfh0hgyjlakillizmj5ninpgnqktrjzth0ugvvh8;1:wjc;1:iix;1:wix;2:2mc3kb4he6jxjhgphhqhfwgv;1:0jd3kxahggh6hjlklelh6nhdohdphfuitvh9wgz;1:1h6iknkhg;1:hhcjj4;1:piw;2:1hf2hd3hf4k15hg8heah5bj4ch9gimhjrihgjljkh1lk4nh7ofqpkkqj2tirwf6;2:8hg9hdaiwbiwdk4ehbhh6jh9ul1wh1;1:4kcoh5;1:dh2ejb;2:1hgcgidklel0gh9jgtrk7wjq;1:fgygljwhe;1:0h12ha3jc4hd5h76hd7gx8kg9ltah7bfeck1em9ggvhiqjh0kh6mheoh9ph8qijrjfvhdwh0;2:8j5dgbelpohfuj4;2:5j3;7:1iyrhfwj8;1:fip;1:niq;1:uiv;1:pio;1:ahdjjskiosgwuj9;2:2k14j57jkjhbwiq;2:3hf8hc9hbbg8ch1fjcjh1lh5pk6rq0tim;1:1jroh6uiz;3:6iobhbdkpeggmjqsjg;1:1kd2p74hg6hb7m38h89hbghghhdjhdohcphgqh5rhbvjgwg1;5:8klbj8ehe;2:lhanl7;2:8hd9j8dh5eiv;2:3k29gxfhgjm7wgl;1:wil;3:4k88hc9hgaisbiygjhuiwwhg;2:3jldj5;1:ah3ejtrjhtiouhc;1:qj6sik;2:0jbaipdj7egofiujiwqhdrj5sj3wgl;2:dirjjm;2:5iq8hgaj3cgjgishisrk4uiq;4:4hh7kk8gz9j3ahddk6egjfhcomaqhgwgl;1:0hgfkpgh3hinok6pjswhe;2:cin;2:0h22hb3jb4hf5h96hc7gv8lq9luahgbfqcjreloggxhipjgnkh9mheohbph9rjwthduh6vhawha;2:rip;1:8iy;1:5in;2:0h23jw6kkvhe;1:eja;1:3kqeimoir;1:dj1;1:4jbajqdgzpjawil;2:5k9;1:1kjehbfhfjhbkh6lllqizwgw;1:6ma8kx9h5cixeitrgzwhe;2:vix;1:2hb4itolz;1:5jz8iq;1:1it8g49lz;1:jjn;1:4iojh4rjrwjl;1:akpbithhekhe;2:8jkwhd;1:rjiwhc;1:fj1;1:7gwbildh4einghehixjmlmjhpj2qj2rfgwh9;2:ah0ch9eitfh0gj3olcrh5sivwkj;1:7iwdikgik;3:pix;2:dhaeix;1:gin;2:1iv2gz8mgak7bhedgkeh4fg9jiwkkdoiqrimsgn;1:jjalizmh3qhgrk3whe;2:1jl6jv9ikjjaqilwgk;2:0hg2hg3j24gy5gu6ju7k28kh9gfbirdgjelrffzggohflih3jj7kh3lhfmgznhgogkpgrqjiriqtniuj0vh7wfz;1:0h52hc5h76h97h4ahgbjlcgcdgmfk9gj6hfwig2jgakj0lr4mgynhcogzpgpro7shhtgrugjvhewjk;1:hh6jix;2:aj2;1:8ja9j5bgtcijejfjhe;2:bhfdjbegwfkjggiukeviz;1:9ij;1:1gq3hd6h58k19j1aiobh6ch7phgqhfrh7uknvkgwks;2:1hhdl6eh6jh1kj6lionhgrjd;3:8dp9occhh;2:5jdbk2chfghbnhaok9ph8qkerjlwfn;1:ghgpjzqhhsiowj7;1:4h45jh7hb8k09ipagrgh3hh3nn8ojcqjbrgnthbuhgwgx;1:1iu3hd4kn8iu9haah0bioch3ekijh0kg3lo9nh1ogzphaqgnuh5wit;5:0jg1h0tim;1:qk6;1:gik;1:4goehfip6whd;1:6mpairvdc;1:liq;2:nk2wkh;1:8l99fraijcheehfoj8pin;1:giu;1:oin;1:iirwim;2:2kb8j7bhejj6klfnjorgbwgz;1:ojb;2:5jxjiq;1:8m0civkgvuip;2:uij;1:mjj;1:gj6ojcshg;1:8jahgyjix;2:8izuik;1:ijhkkj;1:aiychbwjg;1:1g82is4gu5jb6gv7k68jp9kmbjvcjhegnfgaggohh3ihajj0kiylh5ng9ohbpghrg6tgqujxvko;1:bj6;1:pk9;2:aj5gilrimuhc;1:nj1;1:dgtekx;1:7j8tj8;1:2im;2:ehahiywjt;5:uiq;3:1ki2ff3h34h55he6gz7ra8jd9iuagnbgccgcdh0ehbfh2gj2hhdjkmkggmh2oippfotguuh5viowju;1:ij1;1:nim;1:0ik4h79ioah1ghdogjqkgriouhbwj4;1:8ikfiv;1:6jlajrbiochgdipehhhisiiljh0kjdrexwki;1:mj4rh9;1:2ik8j89h4rjn;1:mjd;2:3hf9l0agfbhcciufiwghgjiskhemionjwohhphdqjxrj9wh7;1:aiy;3:3ip;1:4kp8ijsjvwhf;1:jhbqk3;1:ah3citsjtuhf;1:0jsojv;1:3kkbh0dinghgjgarllwhe;1:ejhghb;2:mio;1:0hf4hg8gybjediqeg3fivggnhh8jjqnh7oiqrfosm6tjxuknwfb;3:fio;1:4jb;1:jhetkm;1:5k96hcbj8khf;1:wio;1:8jzbh0;1:gjn;1:bka;2:bhgqje;1:8kl9h5;4:vjh;1:8iq9hg;1:4io7ki8gkfhcjk6oixqh4riswh8;1:ujc;1:2j38gn9iyah3ikrjhbrhcsivuk2wio;1:vjwwis;1:5j1hiqjhbrimwix;1:4kd;1:1iw6molhfojprh9;1:cjm;1:wiq;1:8k59gzsik;2:2l34gm;1:2kj4iujh4rhdvis;2:8ja;1:3lp8ir9hedkcefzjhfwh1;2:dhcejv;2:gjkql7rgzwgz;2:ghekj1nj1wk7;2:gjdlj1pj0wgz;1:4lh6h98hcahfbjdcjvegyglwih6jgaohhph5qh8tjjuhcviowgt;3:1irdiveh7;1:1kcdj7khd;1:gip;5:8le9gl;4:4p38gzeh2gh5jgqoisph2rhhthgullvkfwgv;1:ikz;1:2kh5kwwhe;2:ajpfgqgiq;3:1hd4h95ha6hf8le9kpajwbiwchgdh7efzfg3gguklclgbmh1piqsikth8ukgwgb;1:0o56hegkzjhgriwwfo;1:lik;4:8gahhfojirjdwk5;3:jjcpizumrwh4;1:0iu1ke2ip3gn5j97gn8jg9inal0bhbdguek4fgzggshh2iimjgcljfmhcojhqg5rgish2uhcvimwgj;3:fil;2:0lk4h19iqgjtihfwgw;3:fiqjkswha;1:2jm;3:1ikghdrhhsijwk6;1:1hfclthikres;2:fimgizjhb;2:0hh1h92j33ip4hf5is7he9grahcbhbch2dj6egjfglggchjpiirjhekh4ljinj3okcpjkqgztheuh4wjm;1:7khniz;1:0hb1h42hf3go4gq6h37h18ks9hdaljch6djtegkgj1jgtkg7lh0mh5nhepgtriqsjltkdul6wgy;1:4iu;1:kjapje;1:2hd3lc8h39ggdp1eijfhdjh9lheokyph4rgmwh1;1:8j19jdah2hjrjh5skd;3:1h93gk4hc8jt9j9cgedh9eisfhgggzjk7qh0rjbskctj4uhc;3:8jc;1:0hd4ha7hf9h7ajacikdivegwggnhj9jhbkjxlhdmjonhcpk2qhgrkxth2wg6;1:0ik;2:vis;1:8kf9h7;3:rj2;1:ej3;1:rj8;1:4jtwh7;1:2iq4j98h19gtaggcikdnbefhfikghfkhgqhbrj3wl6;1:1j3dip;1:8iueiu;2:cjhmgmshetnkwh1;1:qkcwhf;2:iit;1:0ik3ge6kb7h39inagjbghdhbegcfizgg3jgzkivlkamh8njaoh8pgyqjirgmskhtiwugpwlp;4:8j0ajkbh7cixjgwrh9uj1wjx;1:cjl;1:jiw;1:0hg1hc3hc9hdagjdh1fgwgh6horjmnkhalhdmhcnhgphfqkkshbuhdwiy;2:ohfpj8;1:7ki;1:0ki3jkghgjh7mjooinpj3qhcwgr;1:oinwiu;1:nje;1:7hg8iogivjh7pgrqrirh6wfl;1:3hh6oa7hf8jubhfdj3egkjhhqiprgatj1;1:0gf1jr3l54h85h16fo7h09izah9bgacileklfivghdhgzijtjipkgflh4mh2ogspjdth4uirvilwjm;1:wka;2:8j9ag2ehawld;3:ljywh7;1:0oz1ha3h94h66hd7jf8j69ggajwbk9egxfhbgkyihbjj2kgzlj0mh4ohdqgargpshbthawff;4:himjh3rjg;1:lkj;1:hj3uhe;1:gh7jixqklwh6;1:ah8gkj;1:6kwggpjklwhd;1:5jd;1:0it;1:rik;1:aim;3:eio;2:cje;1:8jlrio;1:nji;1:3kf9j0iip;1:5j3;1:8iljh4qhhsjnwjl;1:8gtklalh0;1:8hf9hdbgqcjidgceizflngn9jgqqj8rgzwhe;1:3heiijjh6ojywkz;1:jip;2:fj2;3:2ff3jl4il6he7m69j7ahcihfjivuijwgj;1:0iz1hf8ji9gicm3rga;1:uh2vj3wio;1:9hgbj8fh7givqj8uiswiy;2:hjt;1:2gvolm;1:1nzbhdggcjkdrgs;1:6gvaiobjzeh6gh1jg9kilohhtlkwlm;1:0p13j34he7ha8j19h0ag6dhgfizij9jgslhephewga;1:ahebk1djzeh8fjyjhfujmvjbwgr;1:8hgajudj2;4:ain;1:8jhhh2qjs;1:aguwku;1:ak0kgtrilsjb;2:ajh;2:aj9bhe;1:rik;4:tiy;1:9iu;3:bjxrh9;1:2irch3rj5;2:0mq1im2g83j54j45kr6gw7gz9heah6bgwchbegffh7ggwhgzjjclgzmkwogppggqkirjasjjth7wf5;2:hksrg7vj2;3:8jj9h1;1:gjyjiy;2:1gx2iy4ij6hd7hb8jp9kobn4cjbdhffg7ggmhhdihdjgokkjlh2ng8pgxqh0rgtsixtiqvhh;1:2iy4iy8hf9ivbhegirriy;1:ej9hhf;2:3ir;1:cj4;2:ejm;2:2md7h38km9geajgbgugfkhkjjl9qh4rh1whf;2:wj3;2:1h32inak5dj9gjovil;1:7hfpniqhewgs;1:9it;1:0j92iwshc;1:bhhgjw;1:3ir;1:0hg1h03k3;1:oirqnyth7wgz;1:rj4;1:mgetlgwhd;2:ajb;2:hijjjo;1:3jc8gbaitbhacjaeh7ghgng8pjpuijwjn;1:dkuefe;1:5hg7g98ji9h3ajzbgycjidhfeiufgkhimihdjnvph5qjnth1wfm;1:0kt1gu4ha5je6gw7go8h7agyckrehgfkcgk9hhfihgjgqkhemhfohfpkqqh1sgvuj5vjnwfu;1:iim;2:3iv8h8bktehfqj9thg;1:8p99etah1dooeeifhbgj0hgzkh0pjyqhdrk7thguga;1:5ik8glaklbhefgqkh6qj9wk9;2:rjx;3:0j01kl2ha3jr4k75h96h87hb8gt9hdahcbgcdheehghjliknjjiog4pj1qisrg6the;1:0jc9ippjnwhc;2:8ghah0bj7hnvrhcwh9;1:0hd4iv;1:gj2ij2uio;1:8gkbgxrml;1:8k4hj0;1:3h09ikahcdjofivijcrj3tij;1:0in;1:8hebjjcldfh8rhbwjv;1:2iu3im8heagrbggcndgg5hitrkiwhg;1:8hgbkg;1:4iy;2:1io7h88h8cj8ej0gmuhhhjhcqjdrizwg5;1:9k1oj6;1:kheqiqrjs;1:1j18ggho5rgx;1:0iz;2:0jo1gy3he5h37g69gvajpbgtcjadhbeilfgdgk5ijdjnepkjqiztgmuhgwet;1:6fdvl8;1:3m0qgx;1:6ljwhd;1:8j1aj7;1:tkbwh9;1:8giakhbhfcjgfh9gffhn3jgzqhfrh1sjbvj9whd;1:hhbjjg;1:1io3gr4h25ha7gk8md9jpchbdiweivffygj1himjghkjmpgqqh4shdufnvjh;2:bivwip;2:oiy;1:jkb;2:8km9ghakecjdehhfhggheiliqh7wgr;1:0js1lsrfhwh1;1:wjo;1:bjc;1:fj7;1:6jo;2:sis;1:1h72hc3in4h75l36gxah7bh8ciqdhdeh9fh1ggdihdjmelgzmh6nh6ohbpguqlkrjgsimtgxugnvk2wis;3:1gy2hf4hg5he6hd7gu8h49h7am4bh5ckddk6egkhg7lhdmh8nh7ohdpktrimslatixvhewfh;2:2gn3n14hf6h27hg8kr9g2agtbjljg6kh4pmlqh4rhbvm6wfr;1:3j6;1:bim;1:ajudhgfjanhdpjc;1:3k09hguk4vh4wjl;1:1j77jqwhd;1:fikjikql3wgx;1:tip;2:jil;3:aiygj4;1:jim;1:8ip9hgwin;2:bjieil;1:9hbaj1;1:3mlbik;1:hfxjmg;1:3jr8jnjgg;3:0h51h93k98ky9hcag3bo1gjfhh9jk1kgrqh8rg3sjzthguh7wg0;1:1hh3h86hb8gcehckhdmjlokgpkkqhgrgyth8umbvjc;1:khbljlwkb;1:mk8uhb;1:8hgmmhoil;1:kh8lmu;2:hiu;2:hiq;1:hiujj0;1:0qf4hgahcdhgjh5khgmitng8pl1qhfwg2;1:wjv;1:bh3cje;1:6is;2:2inehcfj2;3:1iy;1:8iz;3:biycjnhj0mh7rm3th7ugvwhd;1:agwgjljkxrjfuh7wh5;1:jgtwk0;1:8in;1:mjj;1:8jzois;1:0j99gvel0oikphf;1:5ikvjl;1:0he1gx3gx4he6hg7gu8ji9j0blecirdjpegagjbhioihfkgrlgpmgvpgzqiksgjvitwkp;1:0hf2laqisthgwhg;2:phgwka;4:jiw;2:5jxdiweil;1:gjl;1:aiqjis;4:rj0whd;4:jiktkh;1:hj8;1:ahhhjvrjg;1:9ix;1:diu;1:tjy;1:1hdgk9njfrh4wja;1:8h79hgegxrjxujrvkk;1:4ischf;1:2kq3h97hc8he9jkahbckiej9fk8kgvmhaogupgxsh9vhdwij;1:gjmjj6;1:8h79hfajbej1fh4hh4jk0oivphbqjpsgkthcuix;3:aix;2:8gujk6pjv;1:tjp;3:fik;1:kin;5:8j9bhccikeikhk5jivsjbuh7whe;5:8kh9grcj1;2:8h09j3;3:dd1eob;1:cgqfiwtj0wjc;3:9j0tis;1:bkqfhf;1:3j27hg8h39khbg8chhdh1eimfj1iipjgzpkrqjmwiw;3:dionio;2:0k66gjugxvm8;1:pil;1:9illhgrje;4:8iuqkywh9;2:0j8;2:hin;1:9in;1:7g7qh3wmi;3:5lh9inahfnj1;1:1iqhgnjmgrg3;1:7jkeh7jjumgpphcqhgrikshatog;2:0h71hd2he3iq4h95gz6kj7fc8hc9hcagpbiwdg1ej7fgugj5jixkh5lhfnj4riwtgzvmcwjn;1:5hg8h8bgbehagmbjhekhelksrjuwh7;1:ahcjkgojeph9;2:aj0;3:bhdwld;7:3jf;1:0f93mjdilehdljprhawio;1:8j0dj6;3:4imchghispjmsgtthawiy;2:8kz9p4cg9eh3fhhkh8liprh4ugrvj0;1:dkdeh8iiwrhd;2:8kahhfqj8;1:7il;1:uj7;1:8ip9hfajpbmcch0fimggyhjhjgmkh7lh3nh9ohapjaqiqrgfthbuklvgvwjg;1:dj5jk6sgz;1:jgqpjdwkk;1:7h78haaj4bk8cithjyjh1kipliknjsqitrgksixuh2wh7;2:6ix;1:kju;1:5iwrj3;1:8hgbke;1:kjmnhf;2:ciyqjvwgz;1:0hd1gk3h24ha6gx7h98gt9gkagtbindgjeowggljiulkemnlngzokipgfrg8sh9ugwwjf;1:tip;1:7jgdh8ehafjugg7kjmlkooinrg7wl1;1:vkewhg;2:5ja7injhamh2qimwjo;2:uj1;2:cjcdj1egyhhbjg5mh5rgztp0;1:fir;1:bhavjbwl4;1:ciljjwnj2ohfwj8;1:8hfjheliupjbqikrh3whg;3:gjo;1:ejigipjh7qinwit;1:jlcwfk;1:hjwjgk;2:2jmoimphcwir;2:kio;2:eh7qjy;1:8ip9he;1:8jb9jsdj0fio;1:wj0;2:pjd;1:wjg;2:gim;1:kj5;5:8j6cherhduipvkf;1:nimrip;3:8j69h5;1:ghahlvjherh2;1:8h49inahfbilch5ejhfimhj5jhgrjxuh0vj9;1:2h04jo7jq;2:5jc;1:1he4ha5ha6hf8lp9l0ajzbj0dh8efyfg3ggyklglgamh1pitsimth9ujjwgd;2:cipdjlehfrh8wiw;1:ljp;1:1hg3h77h38jmajsbjwcjdditegugh6hhail7kh5oivpjkqgkrgvthbuhe;2:7h79hgfjmghcjjbshhtkcwiw;4:2l2jl0qherh6wh4;4:jheqj3rggwkt;1:8j29h6ciq;2:iixjhgrjisiq;1:nk2;1:qk5;2:siz;1:fix;1:qjs;1:jk4sh2wk0;1:8jt9in;1:jgwwl0;1:mh4wjy;1:hheiitjkf;1:bj1;4:5ilrkmwgy;1:bkj;1:0ip2io3gt4j26h4dgveh1jjlohgphaqjvukbvh1wjb;1:0j3bjf;1:eje;2:hinkjh;2:sio;1:5lfaixthd;1:0jq6hg7j29gwagybhddgqehgfiwgggjivkh4phcqjlrkcsh3tj2wlg;3:jit;2:jis;1:gj3;1:6etvlc;1:pk3whf;2:dhcekljil;2:8h49kjcgmdh4thcul6;1:6j9;2:5jz;1:9h4eiqqjjtirwhc;1:ainbk7ghfjgtohaqjitjc;1:7glciphhbjgukhgnktqiywkj;1:lis;3:ahgujm;1:8gjaixfhdjhgkhevn2wh1;1:7jibijjh9sir;1:cit;1:9ipajufh9giw;4:hixpjn;1:4ingivnj8;1:jix;6:6jlkhclh3nl6phg;2:3ivfip;1:3h45hg6gp7fu8jq9g4al5bl3ckffk2glbhjniixje6kgsmhbnj3oh2qgdrh7tgqujbvgqwik;1:1h33h44l05l37h78eo9kzdj3egzhgsihejfvkhamn5olhph5qgmrfftgsum1wff;1:giz;2:6hg8gv9kzaisbgkcikdh4eh5jh8miuoheqgmrk6sheuhbviuwmz;1:2ka8gz9jjgirhh1jh7ljc;1:0hf2l55ld9h5dkyeggjgswh9;2:0hh3hfajybmnckoehbgh7hh7jgtkjylkuoh7qhfrg5wgs;4:2it3h54jf7gh8gg9graf1bh1ehcgjyhh1igvjh2kh3oh9pilqjprguszrtgtuhawfs;1:0h81gd3h86gb7k18gp9hebldchdekxfj8jhekh3omrqh6rh1vjnwgy;2:4kw;1:wiv;4:6gxjgzkikwmw;2:1m52jkbirkhcok4ph9qhfrh4whc;2:1k2whh;1:5iqjhcsik;1:pj9;2:9ij;4:4iq8izagzjjoohbrjdtki;1:1ij8ir9gsbgzgh8jh0kgwmkgohcpj8qh4wns;5:3j95im;1:9h8fh3gjpjgsto9;1:4jljh2ol0phb;2:gk5jiolj8rh2;1:8in9hfekorgr;2:7jj;1:2ixqje;3:5fzwmu;1:0hf4j5bh6jhfmsxngtogophcrh6tj7wgb;1:8h99iz;2:8j0gjqqiuvjdwhe;1:tiz;1:3hb5lp6kq7h68jy9h9bjzch4dl9ejxffdggtjgskhdphcqh9thduhbvkzwf4;2:dg9ejyhis;1:0he1gz2gt3h84h85h86h27qv8ju9h0bfpeh6fhhgl6khhlhcmjirg6sgutiywh1;1:dj0;1:8iu;2:cio;2:4ky8jh9mleiwhhfpgzrf9wgt;1:0j01k03he5ou6g17h08h5ahejhckjfmiznkhoimqh4rgpthcvg2whb;2:aim;1:0gu1hd2h73je4hc7iq9kgah3djbejefh1gh1jiwkh1pha;4:0ha3h74hc5hd6hg7hb8j2bh9ch3dgleiygj3hg3ig1jgpkj3lrnmh6oh9ph2qgxrnlth8uhdwh8;2:4iq8joah4ein;1:7ilpiq;1:ch5jj6khbplx;1:dhgejqfh6;2:2kf4il8ik;1:aiz;1:hiy;3:6j4hgjjjgwki;1:pjd;1:0gx1h42iy3in5h56h37gk9mncj4dlyeglggeihbjgnkjzmh8nh9oherjbshcugzvh0;1:3hcwk0;2:ahffjljk9njopj5qherh7sl2ugzwfr;1:1iz6gx8ghahccjfdg9ejjgkijj1kjalkfmhgoijqh5vhgwfy;1:4j4;1:8h4bkoljywik;1:qjj;1:7h0wja;1:aj9;1:gin;1:0je9glrkf;1:8ja;1:9h7djdeisfj0gh4jk9;1:9hfrk4;4:3ipijj;5:8he9iwciu;1:8iw9j6alzfggkj4rhbwhc;1:hfxtkxuj7;1:1j4;1:wim;1:3je9j8jj2wjn;1:ugzvks;2:jit;2:6kc;2:1gc3hg6iz7ha8ji9kyak6bgqcisdh8fh2giuhjijh7kh9lhcmhcnheoilpj0qgmrlftj8uhewfw;3:7jn;2:3h3pj0wjp;1:8jy9jych6dh2ghfjhhrjn;3:bikcip;1:4j9;2:wiq;2:9jb;1:3ik4ivgh6hix;1:kjcqil;1:til;1:2jm6gqbiyvf4wmo;1:3ji8hfdjpejajhcuiv;1:ajofh4jjjnjb;2:1iw2k13hb5jd6gz7he8hg9inbj8gg9hh9ij1lh0mh0nh5rjktjaujsvilwgs;2:3lv5mq8gi9k0agzcgbdj6egqfgvgh0hgqij0jerkhdmiqoheph0qinriyth5wjk;1:djjeh4fkkhhgjiz;1:8jhdiofijnj2ril;1:ijtjkc;1:2jjgjijir;3:8jb9h4df6el0;1:8gs9jvafzbhcdgzfjrgiltlcuilwit;2:6hgehbfjsjhgvizwji;1:jjvwh5;3:fimsio;1:6h8viz;4:tis;1:uk1;1:7jlcimdgmejsfjpgkahhbjgqnhgphfqjbrh0tivuj6vjpwgt;1:3h75jx8ks9izdfoeo0jheqhgrh0wgz;1:ciw;1:cjkjhhnh3pn1shd;1:3hb6ip7jv9heahdej2jhcmjtpiorgutj5ujgwh0;1:iir;1:0h61hb4hb6ke7h98hf9hdbiucindimegzfj5ghghimjh5kjalgxmj7nkmpgcqhbrkfsjbtgvuhdwg3;2:4h88gi9klbhedh7ek2iikok4qh7;3:9kichf;1:fiz;1:0j4;1:1hd8k59nzam1biwcfzegpfgxggyjh5klqlh7nh6phdqgqrh6th7;2:9h7ajgqka;1:8jm;1:2gn3nd6h88hajglpmdqhauglvm4wfv;2:ghgwka;2:tip;2:0hf3h04k55iu7gc8js9gpbhfcjgdiqfhcggphgxjlenhdogzpguqkfthduh8vj1wiv;1:5kk7kk8h4ciseglgh5jgkoiqqlrrg0sirwj6;1:ekw;4:qh9wkq;2:fj0;3:0h73j77he8gw9haahfbn3ej0fh0hh5jgomhgojgpheqgqrk1shful8vh7wgf;1:qjr;1:qja;1:aizbin;1:bjmjjcrik;1:jis;1:8j59gttjl;1:nh8wkk;1:mintiq;2:8jq9ildhceippjb;3:nikogspl7tj1ujlwh3;1:8gyag3bg6cxpehgfgsgg1hg8jjpkh4lhcrhhtiquhgwg5;2:iil;2:agysjwujk;1:0jjuim;2:jj2;1:aiu;3:9hhtkp;2:niu;1:cf7tkxwix;4:3mqjh6mjbrjtwgm;3:aimdj7fhcnjp;1:aikdk9eg0jis;1:6h97he8ixdheghajjaoj3qlewh9;1:ekwghf;1:9jsciqdh9rhb;1:ciuwjh;2:1h47h78lg9jaahdbh6djifh6ihbjinkh2nhgohdpmdqh2tgnugqvhg;1:dj7egz;3:9il;1:dgvejm;1:0ikwk2;2:1n33hd7jmbjtgh9hj5jh4rh8wha;1:3j25g5gg5hh5jh2qnawkz;1:3jraj1rhcsinwgs;1:8iv;2:4ik;1:aiu;2:vje;3:3jfjj5miroh2qgxwkf;1:wjc;1:gjdwkp;1:8hadjbeh2rjv;1:cir;1:8h8ujo;2:wiq;1:6jcfhcij5uimwhe;1:wix;2:4hf9h7gj9jjplkaqirwh3;2:1gr4h65gz6h77in9gbagkbh8cjqdj4eiuih7jhdmh1ogbqisthfujtvk0wlj;2:1hg3h74ko6hc8gc9h8ah0cgqej3fk6ggrih4jhdkh5lhbmhgnhgohgph9qjitinuksvjuwjz;2:3jv4hf5hf6hf8iu9gxah4bh7chcdh8egugkwhjcjehmhbpk9qjirk5thavhdwki;2:3ju;1:9iofim;1:wis;2:7jb;1:0hd1h92ha3h14h05h56gw8ff9juah2bkpcjveh3fgkgh4hj0ijdjf0kgylh8mh8nhaol7qg2rkbsixtnd;4:nj4;1:vj3;1:pkxtj3wh1;1:fj0;1:gjywh4;1:filpkkqhg;3:fhbujm;4:6j99imagtbjdwhb;1:qjp;2:3j45m6ah3bhgfhggjfhjuqhcsgrwj2;1:oiz;2:rjn;2:1iv4j8;1:6is;2:6jl7h4oh7qltwjh;1:bkjdgpgj0jkmqhgrh8wij;1:chdjj6ris;1:rl3thbuhb;3:wk4;1:ggwohdphdqkbwko;1:hioujl;2:1k03h04he5hh8j59jbakkch9einfhdggyjghkh3nhfoj0qhdrlethbwjp;2:0h68it9hdagedh8eirfjpgjhjhfkh9lkoph8wls;2:jiw;1:iiwnji;2:1fw2h83gy4h95hc6h58ps9gmajcbeucj3de9ep9ij9jg0kh0linnizoh1pgxqgbtl2uh6vh6wiz;2:1hg3ha4hf8gxahacgpdj1egygj5hkhih4kghlhamhbnluokbph3qkhrfztj0uhgwjv;1:3he6kpeipgl9oj9pheqh5thdwgc;1:dj2eh8;2:qj5;1:9il;1:0kt1ky4he9h7ah9bgpcjneh8fgvgjrjh1kh1mhdohdphbrgxukqvjkwj6;5:ris;1:pjq;5:sja;1:fir;2:riy;3:1h93j87hd8jh9ixakcbg1fkvgk2hj2jfxkgknhfth9uhbvhfwh5;1:uj5;1:4mp8j4ajajfnmgxojqphfqjo;1:8h8jhcqjurj5wjw;2:rir;1:ais;1:8kp9ithhcjkvthdwh3;1:njf;1:jhawj9;1:0is1lg4ikhhbkjxrgnwhg;1:lj3rij;1:bjqrhg;1:6jbbheghauj9vgvwm8;1:0hg3k44ji8hfgkzjh5qgywin;1:0ip1hf5hg6hd7hg8j49lhahfbgzcgwdjaej7fgugj4hjkiirkiylggmhfoh1pherflsh9th8ugqvhgwkr;1:hhcjhbqk3;1:0he1h23iw4je7mz8gy9h9dlgfhcgh4qhcrj1wgm;2:3koaioijfwh0;1:khanm7rj5tik;1:1hhejxoh0pkq;1:9ipcisoiqqm4th5wh2;2:gjllit;1:0hg2la;2:2ir4h28hbbhcchgdg2el8firgirhhfjgwlhhmm0nfuoh2rglsh4tlxuh9wkc;1:fimsiz;1:mjl;1:aggfks;3:cjhrhe;1:8gsgjsjhdlmgphhrhetlduguwh3;7:8ki9mzegewhf;1:4ik;3:6h6vjm;2:lit;2:9jglimrgy;1:kl3mhh;1:wja;1:0k03jf6hc7h49imagkgg1hjgijfkh4lj4mhdnivojcph9qitth9wg3;1:6hd9jkaguuitviz;1:5jq;1:8h89it;2:8hbbj0kj2;1:0le4h25ixfj2ihgrhf;2:0je7gw8jk9jxahbchgdj0egwhhdjkhkhhmgnnj2oikphbqhfrguwkh;1:2iz3j45it9hbdjfeikgh1mixnhfohhwg4;3:hhfjix;1:sj9;4:njf;1:8ha9jk;1:eirfhgoilrh9tmjwin;1:1ix2j35is6gv7h68itajobkwcggehhfgmgg4ihejilkivlh9ngyohdpiqqitrhcsjlug5vjowg0;1:aiz;1:ij6tje;1:0jm1h16hg8mdak6bkpcildheegmiiojfumhgnhfpgwqkdreksh0tgzuiv;1:oj5;1:riy;1:3j5uiowh9;2:4ns8hbbj9jhhwij;1:5j0likwjc;2:fit;1:8h3tkmwks;1:3h35h97j88hh9hcbjwck1dhceh4fhhghfhhhikrjg8ohgphgqhgrgqul7;1:3im;1:6j08jnajpbk1ciseh4fhgjh7kjgnhepjcrgzwh1;3:9in;3:8ik;1:8ixgjejik;1:wl3;1:dik;1:4gi7hgajndiweiofjdhjeihfriuwh7;1:wip;1:6gl8gjelegheujxvjfwim;1:jj5whf;1:hja;2:3j7aj2dikritwhh;1:ahefjhjh9njxohdpjwqh2wj0;1:djd;1:0jt3hehh1rj0uj7;1:0jjuj2;1:0im1gz2j34ip6hd7hd8jz9k0ainblkck2egffg3ggshhcihejh1kjwlh6ngvph1qh6rh1siptiuuikwg3;1:8h0bh1gjwhk5jfklkmqiwrhawkr;1:8im;1:jlewgs;2:8ip;3:1hf8gk9h6ajpbh9ch8dh1eggfivhh7jkethgunbvju;1:cip;3:4h15jb7h68jo9h2chffhfgglhh1nmvoklqh0rk9shcuhdwgu;1:2irjjz;4:8eh9ml;1:bjgcgyjh6oivqjl;2:4itch3dinjitkjzmhfrj8win;2:3j4dhdeje;2:0izeiwnjs;2:1h92jv4irfiphknkhglkanhbqhhrh6;2:jin;2:3klcjrfhaijduhhwgz;1:7hfjj9tj4wio;1:1gr3hd6h58k19j1aiobhach1phfqhfrh8ukovkgwlc;2:hhdjit;1:iljwhg;2:rjcwh4;3:9itbk1chckjanh4;1:oin;1:ahfbh9djtfhfjhdukzvjuwiq;1:vje;1:chheiwiiyjjalks;2:iik;2:1he4hc5hd6hg8m59lfak5biudhbeg2fg2gh0jioklblgamh4siouh6wge;6:0ilaiouirvk9;1:8k5aj0fhc;1:qje;1:jjhuiowha;1:mj6;1:jk3wgw;4:sjg;1:1iv;1:pji;1:3iqbimchhhj6;3:lj7;1:ujl;2:9hbah4jiysinuk3viqwha;1:1hgciljjwnj2ohfwj7;1:eivjjd;1:wja;2:6jd;2:8j39io;2:8jw;1:ein;1:al1fh2kgnmk2ph4;1:mjq;1:8j0;1:3ip;3:sj5;1:pjv;1:9ip;1:jjc;1:bhefjugj6jiqkhgmkfuh5whd;2:pjq;1:khaoilpk5tj4whe;2:3itwin;3:7it;1:bh5ll6nis;1:3h97j4;2:3hcwk0;3:nk1rgq;1:git;1:7hf8heejofhdjhdkgrnjxol0pk9rj1wh4;2:eio;2:0jq1is2ge4lk5h86hg7ok9h3bh9cgygh9ijujgykh7lhgohdphbqhcshatheuh9vh3;1:0hc2he3ly4he6g57hdah4bgxcj0jjlkj7mh2pl6qgbrg7th8ugjvlmwj1;3:1ij;2:fh4gjdlk7;1:ljlwj5;2:oir;1:6ik7lrvg2;1:0iw4kb5jbahh;2:3ja;2:nj1;3:jj7;2:0h13hg4nk6ga7hccgxghfhipikwjglnhgoivpldqhgrhesh9vj9wgb;3:ek6;2:fj5sik;2:ghghl7;1:dj9;2:rje;1:6k1giuwgu;2:ujb;2:8hfkitpiy;2:qhhrls;1:aiybgxfikoh9pj7;2:8guah3ukt;1:2jy4ithkurha;1:dj4;1:1hejk0wkk;1:8ke9gm;1:2gr7mzohaphbtkcuiw;7:5js8gf9kdak4cixeg7fh8gj1hj8jj9pkiqgkrkpug5wf9;1:0hg6iqgh3sisvikwk7;2:oilwiu;2:1h64h35kw6gv9ivagrbh4dh8eh4fgwgg6ihajlqlgxngzoh8pgpqkyriksj8uhavjvwjw;1:8ioaimfh3giyil7;4:dgorjawj3;2:2mc4gx8k19h4dilehefgxghahldjk1mh7ohgqgrrfhtjguhe;1:uim;1:6hf7ll9hgbhclkyojipguqhfwhe;1:ij7;1:6jwphg;1:8jppkwwh7;1:vhcwj2;2:hgjjjl;2:wit;2:0h22h93jp4ha5js7h39m0bgvcgwdmjegkgjphjhkhaoh7pgvqgrrgcthbwjh;1:0jo1hd2iy6h17h79h9aiychadj3gfmhgrjmooh2ph7qm2ripvik;1:4lzaitbh0jhgmjioh2qhcwh7;1:cjsriw;2:9intk0ujmvhbwhc;1:8g7agoel3fj8;1:9jgfgigj7rlitgywhe;1:8ik;1:bj7killjr;1:bissin;1:8hcrkg;1:8k09j4ah3bjkej5ghfjizpiyqhgrhgsjntgqwh3;2:8izdil;1:7gz8gfahbdg6ejlgjxjk0mjmohapguqjrrhhwjo;1:qj6;2:ain;1:hj1;1:5lujgrkl0mhfrhgwh9;2:fil;1:8j2;2:ahcfj8oiz;1:rim;1:cl9;1:1lt4il6h9ghdhh6kjkrh3ufavnhwh5;1:9j7rh1;2:6hf7lm9hgbh8lkxojipguqhgwhe;1:4jccildgeejgfh4wjc;1:4j4;2:4ipril;1:1gk3hd5h68jyahdblbch6dg8ehcfk8hj1jgikgqlgsmh8ngdoh3pgbqgjrmysjotikulp;1:9j0;1:9h1ciorjp;2:lj9ph9qlkwgy;4:6j78hh9hfagxbixcivdiofh7gj9jgfkj9ljoqhbsiz;1:3hf4km5h78in9hdapfbjccgofg0kh5mheoh3qj6rj3tgowgx;1:wix;2:vim;2:aiouimvj3;1:4jx8jh9jkahdbh8cnjfghrh9wgy;1:4kh;1:7k6thc;1:8he9illh8wkw;3:1itwjx;2:8j5fjtjhb;2:rj1;1:uil;1:siv;1:8j39io;1:8iwhj1jjjmh8nikrertk8;2:9iy;1:hhbrji;1:ditehd;1:3in7fu8h39ixwku;1:wiz;2:1h79jmaj8fixrjgth0wjb;2:njj;2:0js2jy4hd5jf6kh7h98he9jhcgydh1eh2ghbhk8ihfphbuh8;1:9iz;3:ik1;3:rix;1:biukja;1:0iv1ga3ob4h4eittiqwhf;4:4io9ilgj6;2:5k4ghejhemkgqhg;1:njv;1:8iu;1:fiu;1:1gy3jrmjruguvkiwhd;2:8j7ejs;2:9iq;2:og7pl6;1:6hh7jqwhg;1:pjh;1:giwlj6riluio;1:div;2:3hd7h88ke9ghah6cgxdhfej6gj4jkekk2nheph8qgzrgusl4uiwvj3;2:aj6;2:9iq;3:kg6lmqnje;1:0gj9ioeilijo;1:fj1win;2:djaegnfjeuk1;1:1h03hd6h18gj9hddjiehagjtkhclg5mm9nh8phaqh4rj7sh8unxvg0;1:4ip;1:0hd3je9hfaipbgvej9fh2glphh7khgoixpgzqh6rkhtktuh1vhewgu;2:tja;1:eip;1:hh0rj9;3:piywio;1:ej2gj9;1:4io5k67hdahgfitghchj0jilmjfoh7pgvqgvrjowju;1:8fz9m7;1:9k0;1:8ji;1:diw;1:0is;1:bjjhjipjdrgx;2:lixriu;2:gj8jh6wj6;1:bildjreha;1:2j6;3:0hb1h14hc7iv8il9jvaitcjbdkpekmfg3ggshh0jjgkhclhdmh5phbrj9sjmth5ugivhbwgu;4:3hg5l76h68ei9m1aj5bh8ch5djkgh5jg2khaphgqjythauk6vg9wja;1:8gv9h8eh8gk8hgzqhatoqugewiq;1:hh6jkppjmqhfwgw;3:8gd9kbbjqfhfmk8nj5plgrh5wfj;1:1h95jb7h68hacgrggmkitmjqnm5oj4pgt;1:0fy1hb3he4mj9gmaj7bkccgpdfxej9fhcghcigzjg2oivqjrrl0sgwuk5;1:ain;1:chajjsnj1rj1wgv;2:0j34il5ja8hcbjikh0pj1rh5sin;1:7il;1:9hfak4eivghejjxlj2qjlrh2whf;1:wiw;1:gj0km8lfq;1:pj5;1:aiteh5jkhmiv;2:0hhdgvejrfj2giphj6lhetl6uj2vil;4:0k51ir3jr5ik6hf7h7agwgh1iixjh3kh8ljamhfnj2rgzwgz;2:1hb8gt9hgbkgjhakjooguvmvwgu;1:jiq;1:9iz;1:jhgnjeoikriwwik;2:8gb9l4bgyehefjhjhduiywjx;1:jjh;1:fhahj3kjh;1:hgfjh3qnzth9;1:cjf;1:piurjfuju;1:akrbgc;2:diq;1:sk1;1:7kb8gz9h3aikbh6dhgej1fjehj7jk0sgouh7;2:3hc4gg8gpfgghiximupjxrkjwhh;1:8h3bkvjh6rjktil;2:4jw8jm9jjahebgecoqfgfrgswh3;1:4is;1:ajbqijrh9;1:khanjk;1:akdbiqehgjj9oiuqhhrg6wjw;2:2j78hekiu;1:cin;1:ajdbiktiw;1:bjxcj4kiprhh;1:bjjgiykhd;3:3h56nohgqjh2qh9rm9tgb;1:jiy;1:dj2ehhrij;1:1iugis;1:khfnj3pjcuilwhd;1:uj3;2:nh8wki;2:llmnh6;1:lj5oh8rh0wmr;1:bjp;1:9jocistio;1:1jz3hb7h48io9g9ak0bh0cgqdfzfk0glnhgnjhgkkylkimh0ok7pj8re3th3vh8wgq;1:pij;2:ajdcikhhejhatit;1:uk9vh5;1:ojl;2:wiy;1:aixfjphgzkhfqjo;1:9h9givjhfqjuwio;3:jhdsjk;1:8ikakpbgzcitgm0qjerg5sf7;1:ijmwhe;1:wj2;1:0hd1od8hc9j9bh6cgzdlhegpjg2kiomhcqh5rlfthcwgv;1:4nj8gych7gh8jhglkkmkrujswgo;2:9im;1:aiwjfwqjswkf;1:0jc1g72k23gz6k88m39kcailbg3cgldfyeltff6ggmhgnihajejkgsljbmh0rhfsgwtgvuh4vmewji;1:1k9khclhbnmuph2uhg;1:ojotjw;1:2fk6h67lk8j8fiukimoh1qliwgy;2:0hh5iw7h38iy9hebgtej8fk2ghfhhaiimjkdkgplh2mhgngspkhqlssh8th7ugxvhewg7;1:cgrrjd;1:2go4jjjhaujlvk7;1:jis;3:0n41j33hg4k49h6eilkivlh6phdqhcrgywh6;1:gik;1:wjk;1:tme;1:2lx3hf4hc6gy7heol9pkeqgwrh6wiw;1:jk9;3:8iobhffil;1:8haaj5cilfh5gmmqissjqwh2;2:7gt8irbjgcjweilglkhherhcwgv;1:8gj9k0qip;4:uhgvio;2:gj2oitvj5;1:gir;1:6je8ijeioqjwrhbvgkwh8;1:0ha3jh4jn6hc7ha8fobkmcj9dhael9fiugh3ihekhboiwph1rgxshgthdugnvhgwlo;2:lki;2:1k8ijsrgk;1:2k46gx7iy8gxdlleixgg5hhcjh9lh9nh2pjwthe;1:4kg8gp9h1tk2;1:gjlhilpizriv;2:uiy;1:8hadk8ejg;1:jiw;4:8io;2:cgoij6mjirixwiu;1:gipwjw;2:1g7gjajj2wjl;1:9geaj5ejekhamkvohcph8;3:0h56hdagzdj9eh5fh8gmsihfjl5kh4lk0oh0pkarh5uhgwgj;4:9iztkmwh7;1:aitfhf;1:0ir;1:3hhil5wh8;1:kjd;1:8is;1:gjhjhdmixohfqjjwhd;1:wio;1:gje;2:wil;7:ojs;1:8js9hcahhbk4chf;2:dja;1:ah6divokw;1:jio;2:8hc9itakzkhdniroixpiywhb;1:1k82gowiq;1:9hftj6;2:4j0cgpwjp;2:7hg8gxbkjchgeh9hhajhdqlitltwgp;1:hjxrir;1:2ha3lf8j49gxghajjfohgpisqhbwiq;1:5inviu;2:fj0;3:miw;2:cjfggntjhuha;2:wjw;3:3ix7is8l0aipbjlcj6dkeegehhcjiuqherfb;2:ehbfjc;3:niv;1:mil;1:3hc9gxdkbelyfjqwgx;1:8ilchgrissj8;2:8h99iywj2;1:ciwdiujk6ok8qh3rha;2:cjbwhc;1:8jhmiq;3:ahceh9fo6hipjixwhf;1:piz;3:1hg9inahdjjmrkktiswhe;1:eiw;1:ah1hk0jh6rg3sisth9ulgvh9wkq;1:6hhphdqlewhd;2:3hcaj8bhewjz;1:cilollwiy;1:rin;1:8ip;2:sj1;1:5ip9hfjjgrjf;1:0iz6jn;1:ailoj9;1:9h6bk9rgwuk3;2:0ip1h73gy4hg7hb8imbh9cg8dkxeiqggjjlklitmhfoitphcqh5uhcwkb;1:3l7jhbkilmh0rkcwgz;1:jil;1:4hfhlgijfpinrhb;2:1j48hd9h7biuchgdh6fjqkiuliuninrhctjvuj5wh0;1:1j0;1:0jc2gk4jdbhgjgyol2rhfujivk4whb;1:ain;1:1hg8ip9iljgrrkdsjrwh1;1:1j12iy3gq4gp5hf7jq8j09fnafibhfch8eilgguihdjfkkm2lkimhdnm0pj8qgqrjasj1th5uk5vgpwg6;3:9ir;1:ajgcikfjc;1:girhiz;1:bip;1:9j8bh5eisfiyghgkk6;2:khgnjupn1wgx;2:ghfmobrgswgy;2:0he1hc3hg4h36hb8hcaiqciofg4hk6ijajkokk2nheokfpjsqgurgtshftgpuirwh5;2:1hawjn;1:4ix;2:qk8wh3;2:dik;2:9gvuji;2:iiloiuwjp;3:9iudimrhc;2:1jb2k73jc7io9gkaipdmiefvgjehh7jlrohephdqh5rgnsh2uhfwfm;2:cin;1:aj6bhawkc;1:oj6;1:9heujj;1:1ka;2:5is8gu9klul3vgl;1:3hg4gw6h57hc9hfaiqbjpcgbdhdgh7jlvkhemiwoistguugjvmuwj3;1:1is3k1divrhh;2:1j02jy5kb7hd8fx9h4bnech0ggjhhgij2jj9nhgqh2rjsth1ujswg2;1:0lm8ip9j6ahdjhhwhd;1:hiv;1:9ip;1:3h64ij5h56gn7h88gy9izbg4cilfoegfxhgcihejhfkgjmgxnh6qjorjvtl5ujswfm;2:2kd8hfsjvwh9;2:0h24iq7jd8iufh8jg8kjtlgtmhcnl2ohgph3rjmtj7;1:1h64ixah4rmlwgu;1:khflkh;1:9iufikoiu;1:fjo;2:1he4j39k0ajvjhbqjkrh5thbuiwwh3;3:rjk;1:0h92ik6iy9k2aj7bhbeldfg8ghbhh3mh4phbrl7sjgthdugywen;1:1hbqnfwgy;1:5iwjh4qjjwj3;1:6jlsk5vgu;1:5kjpiu;1:aizcikfj6hj0rgv;1:2km;5:hh3rkb;1:1kk2ha3hb4h45hf6hg7he8gi9h3bixcjndg6eh4fh8gikhjpjg6mj8oioph4qh1rootk4ugxvhewh8;1:wj5;1:9is;2:8jcaj0dlgegt;2:8g79liajwdk6fgmjheqitsjcuhgwgz;1:9ikojy;1:dikwj7;1:0h71g72jg3gx4ix6ha7gs8gcdh5fhdhh6jkrkgglgzngxonspj5qkjsj6ugxvhc;1:fitjis;1:oj5;2:3gg6ik7hd9goagybgucgufgghisjhekjdlkrmhbnj3ohbpitrk7tipugzwjl;1:6jd7hcah9bjqeiyphfshevl1;3:6jj7hgbgidjjefqfk0jmeqhhrj1wgu;2:wir;1:sil;3:ajqfhckhd;1:8j89imdh3ekl;1:wjc;3:riu;1:2is8h89kobimeirjhd;1:cj2dj1;1:4hfij7mlowhc;2:cio;1:kjwnha;1:4io;2:ajb;4:kinuiy;1:bh4cj1eixjiwrhfwjr;1:ugzvkswiv;1:7g7wkg;1:giy;1:ajvkh6nks;2:1iq4ixchckisliunj6pikrhg;2:1h24h88gxaljbh8cj5dheeheje6kg2lgfmgsno8phbqhdrivsjdtj5wkl;1:fip;1:8jwukavix;1:1ilqin;1:ijurkf;1:ijj;2:1he3k06jp9hebh7gjvjgqoh9pipqn9rh6uhcwgh;3:7g6ujawk8;1:fio;1:jjmwhb;1:8he9jtaqgbijch0dh1egyfh8ggvhh0jh9kh4qhfrgtskythfujhwgv;1:bixqjj;1:8h8qjaujn;1:jjr;2:1j0ahgch4dh1eh2fingg5iiqjh8qjfrmlujwwh5;1:8ha9jtegrqkmrj3whg;2:qiy;1:wjm;2:kh5ljh;1:0ix3hg9hadj1eiyfj0ggukgtlklujdvjc;1:6m17hgbl6ehbfh7gkahk0jh6khdlhdoggpiuqhgrg2sikth3wgh;1:gjg;2:fim;1:ahfjjd;2:sipujy;1:8hfgj3tl0ugz;1:ojb;2:1hb3gy4nl6h57goaj2bhacgydjdfh7gk8hl1jiqkgplijmjjpgarg1tguwhd;2:8in;1:nip;1:6j2dj7egtvhh;3:6krph5;2:3ha4iv7hh9guakccmkggwhh7kgephcqh8rkzsiytixwh4;1:gj3;1:8jabh9firuik;1:0hgfklhimrhatip;1:fipggvhfrkheliunjmqkfrhgwlw;1:1he3lg8j9ajvbhcehafh9gkthm9jh3nhgqixsf3tizvh4wf8;1:1hdbh6gkbhiwjggqh8rj6skptivujuwh7;3:aim;2:bkz;1:wjn;1:jip;1:4jg7imoh4;1:0hh1h93m36ha7ha9ggbl7co6eh3ffpggghkfjh9kkcmhbnhgohdph1qgmrimuhcwfr;1:ehggjw;1:1hd3he4he5kx8ij9jkajrbfschbeh9fkfgh1jhglh6nj3ohfqilugvwj5;1:6m4phawgy;2:0j9;2:8h5fgirlg;1:4kd8iz9hgcjmqjyrhfwh7;1:hj3rhb;3:4ik;1:1ha2ha4neagxgjsoiwphcrhbuk8vh9wgr;1:0h81he4m85he8izij3jgakhbmfwnhgompqjdtj4wgy;1:8ja;1:0kp3h54gh7haajaeivfj5ghehj2ih4ril;2:8gm9jiemrgh2hj4jhaqiwrh9thawjf;2:7j6eh9jhgoilrj2tirwh0;3:4j3;1:3ll4ikbjedh4hjjjh5khbrh2sixth9uh4wjj;1:hj4;3:4j2;3:2ip3hd4hc5jt6h19hcah6bkvcgoehefhfgh9hggjjqmh2phaqj5rm9shbugjvg7wkd;1:0hg1gw2jz3gg4h35je6l57hd8kg9ikal5bitej0fhajhbkhcmhboh7pgyqjgrgisghtg4ujcvhbwh9;1:2iq4go5hf6jh8hfaheihanhdpkhuhc;1:1hgbhcjj3kknmhaoirpjtwh2;1:9jpaijhhbjiquj3;4:aj5;1:8ki9j4jjnthdwh7;2:agzfipgjdjivnjnsj8whf;3:cj2jmxqilrh9wgw;2:rkh;2:0kq4gv7iuajcrh6;1:pk3;1:8j8hgojkwmjowhf;1:ah2fm7hhgljc;2:mhbojwpk6siy;1:ijerhf;3:tip;3:sjl;1:3khfgy;1:8h6cj9;2:3gk6l78iy9jwahfbhgcjagh3hgykh9ph6sh9ujtvk5wh3;1:niz;4:wil;1:tjg;2:djp;2:tkbwh9;3:0h51gv2he3gv4h66jl7gm8j89ggag8bj9cikekxfjfggghj9ihdjg5khalh5mj0ogqpgmqgbrj4sjvtkpuj5vkawh4;1:wjd;2:biljh9qjn;1:4irfipjix;1:6tgahadhbeh7fh5gk9jhbkhfuh3vixwem;1:7iu8isbl7hh9okjpherfq;1:agaljrpjesjv;2:0ha1iv4gz5h06h27h89g7ah8cjyeg7fmuhijjowkgolhemh5ogyqhargssgstixuh6viswj2;1:vik;3:jj2;1:ajnjgeolpqk3uhd;2:fitjk8lh7ph8qhhwk1;1:6hdugyvm7;1:1gz8lbkh6;2:gjmtja;1:4jkwhf;2:3ioakiwhg;1:qklwhd;1:2iv8h8aj6bh8hh1jjfqk8shcwhc;2:sio;1:cim;1:8itbisrhe;1:din;3:git;1:cim;1:8jvnj4qhawl2;1:djj;4:5ld7hcah1bj2gjdjhfrjkshcwgt;1:7h48hb9heag9bhfdh7ehefjugh1hgyjj0khgql2rlssh5tjrwj8;1:1j62itrh5;1:dh4jjr;2:8iq;1:8kg9h6;2:sjf;4:8hbjiz;1:cjxhju;2:5is8hbdj8emnghgjh7wha;3:9kngipihgrh8skk;3:oiv;1:8heahhbkpdh6eixfh7gjthjoojo;2:8h59j7wjz;1:3hc4hf7hb9h0ajebkmcizfgwhgjjh0kkclmyogxph4qh1rkgthf;1:1gw8jhah6jivrhfuk7vjpwju;1:6jqvgv;1:cmufhbgh5hhcqjerh9whg;1:6g4bhgck3oj8vgywlc;3:1k9gj2jjjkgvwh4;2:bipchhhiwjh6njhrjmuhdwj1;1:6ivghgjg7kh0lk1wmu;1:jj9wim;1:0js8j3chcihasjdwin;3:9ineir;2:aim;1:hir;1:2ix8kpck0rh2;1:3in7fuwkw;2:8kf9lyegz;1:4iqagtbk7ghhijm;1:2kicjrrhf;1:uiq;3:2k75ik6hh8iy9gyajcbgygizjgokixqitrgrviywjq;1:rhbtk3;1:nix;2:0h73gr4h9hhdipkjhdrj2silwjs;6:tio;1:0h63gs5h47gc8jt9h3ajhbgpciydheeikfgmilujmvnj7ohhphcqjariztgxwfg;1:fip;2:8ks9fwch4gj2jkewgw;1:dillh8wkw;2:8jzciojjnrhathd;2:0j2gj4ih7phbqlnuimwh0;2:bk7fh9rj5;1:civgjohhfjhfmh9rgusirtjswjl;1:bixjlqqh6thhuk5vh3;1:bj0;2:8isejb;1:cim;9:2h68h89knaipbimeirjh8ojmwhd;1:aiorjf;2:hj6jj9kk2wiy;1:ciukjvrhe;1:8hcdiugk2oik;1:8h2eh9fh3lkemlnnhcogqph8rh6uhavlc;1:fh4gjwhimkmalfk;1:2h67j5;1:miz;1:3kqqhd;2:ripuj2;2:1keaikrgpwj1;1:0k01fy3kj5h76h37ge8lu9kbcitegsfglhgziiljg6kftlgumgfogupimqh8sj3uh0vhawna;1:5iqbkjchcjhaqhhwkv;1:0he1h92ke3gv4go5hf6k07h28ivbiueh4fgzgjshh8kh5lgxmhanhgogmpioqjqsjqtgwumhvkswe5;2:biz;1:jl9rgs;2:dgrejihj7jgv;2:8j79gwhiujgwkj1pimrj5uiowjk;1:ah4jl5shc;3:kjdpiz;2:3jm5gu7jh8hbqjxwh8;2:8hfbjb;4:3h39hgajdcizdgneh8ftvghfhhcjhdkg8ohhpheuhgwh9;1:qil;1:8jb9h8;1:lk0siswh2;1:qjc;1:4ir;2:qin;1:6ofajwchadj4egnjh2qiqrgx;1:fj7;2:8h9aj7gh5sk8;1:gj1;2:jix;2:8g6bh1chfehahnhmjuwkf;1:1jm;2:8jxhgqlfurm2tjp;1:6gk8gc9kfehgulsvmrwh4;1:3im8hg9itdh1eiv;1:hin;1:2ipbhaiiwqkp;1:gipwjw;1:6hg8mxbhgcj9eh4fisgj6hg3khhtj5uhgvjxwgm;3:0hd1k33hb4gr8j0ffugnwhgzihdjm2nhgojrphfqgprkbsh2thfuh9wg4;1:2hb3h34ipajbiinjjfmlnqhbsj7wh0;1:2kh5kvjhcmjxng7whc;1:uj4wjy;1:9il;3:jlm;1:wiy;1:9jxekgfgyhhbjgapkqrjxsjwth3uh7whf;1:ggwkkmrjrwh6;1:jiq;1:uim;1:ahgbhbfjxmiorioulsvh2;2:qj9;3:iip;1:ajecgnjkkmin;2:bhfgj9ijqnj7ritwhg;1:eitojt;2:4iljhbqk2;1:8jvbgt;1:ajkgipqhg;2:8iwrjftjywh9;1:4l7ainfgpggmiiojgpkh5njlohfpmpqgdrk0uh0;2:1ip5iqgh8hgvoimqgkvio;1:2fl3h96l9dipeh7gikjjkuhfvj2;1:7io;1:4it;1:0he3hf4he7hd8jo9h8ah7bkieg6fgvhhgijwjghkkzlikmh9nhgoj3phargxtl7vh6;1:gjc;1:2k34go5ky6hh7jo9ilah5djreghfh4hhejh7njeokopgwqgjrh8th3wjv;1:4iq8hd9ivakyuhc;1:tio;1:vip;2:0he1jl2iq3h74j87gq9isajkijfjkzkjwmh1nggogzpgwqhhsheth2uh0vhbwiu;1:8he9hdbgechaghblhfrra;1:4jp8incgzjjrwjb;2:8ikfiv;1:dkeegz;1:lkr;1:aitpjp;1:4imaiutgzujf;1:4j4;1:1iztir;1:wks;3:gik;3:bj5dinehgpkb;1:tk5;1:5j76hg;2:0j5bitmjrwh9;1:0inghhjhcmhhoiwqjltjlwk1;1:phdqlkwh1;1:8j3;1:4hdainom3;1:ris;1:2ivalsegofktgipjhhuhawh3;2:bjxcj4;1:fj5;2:6kb7kvdhdiikjhfpgrqjmwgn;2:din;1:8hcgk1;1:5iv;2:1ir4iqein;1:sik;3:5j8;2:3m5whe;1:aisuj5wj6;1:amqfgtggzmhfpl6;2:3kc4jg5hg8h4bk6ekhfhagjfhirjharh2uh9wgu;1:3jl8haait;5:cetrlg;2:3h77hfahebh1ggzjkomhgpizrliuizwjb;1:8hcbkpgip;1:0iqfkygha;1:0he3hf4h05lu6h67h58gc9h6airbjzcj4fj8ghfhjbljtnhgojephdqhargjtiyuhawge;2:fip;3:8j29h8kjtrhf;1:ggijk3;1:7ijdk0ehggizjh9;3:fik;1:tirwiu;1:8k6ehg;1:oliwhd;1:eik;2:1ge4h85hd7h7agrbivcj5djfejefhfhj6iiwjgtkh7lgxmheoivpgrqgvrl6tinugtwiw;1:gjb;1:gj8jir;2:3j74isklbmheriu;1:ah3dinfhckgwlniolhph4tiq;2:cikhj6rhb;2:oj7;1:8ij;1:1ktcisghdkh1lj7;1:9izqjprh3;1:jo9kizqhdrhgwhf;1:jj2;1:fje;1:jku;4:4k2jjgwgf;1:3ik5gu7hd8j69h4agwcisfirhipniuph0qkpshdth0;3:1gt8hdglrrh7wit;1:8ke9h4bhedhdejepiqwk3;1:3iw8joil3;1:aj9;1:bj4;1:7j7ok3;1:wjh;1:jj5whf;1:eitok0;1:8fw9nqaizbhdch6dj3empfgmlhgqh8rgmsjdwgy;1:ujh;2:6jcpjawhc;2:1it8h3cjwjlgohgqh0rhaujdwjd;1:1il4hb8jc9glahhegqfhfghajgwkhbojhph7qmesiytiouj3wfr;1:4jw9ixbl2cj6fhcwh3;2:ris;1:1hf5k98hgcjadhfejffh4ggqhkioimwh8;4:eis;1:0h81hg2k63hd5iy6h77h1agcbhecgpdjceg1fglgfmhoyihejlpkhamgxnh8ogypgmqjnrimujgvkuwg8;1:6j9cj2wh9;1:8jm9gu;1:3g18jlahgcn3egyhkejivqh6rh2wj9;1:jjj;1:7j6;1:0jq3in8gogktqkb;1:ahdrk2;2:3jg;2:9h8ahbgj3kgznpcrhhwgx;1:3hdahafhegjejncphfqh7tkwugv;1:iljwhg;4:0jd;1:tikvjzwhg;1:hir;1:1gp6h58j79itbjrcgwfh4gjhhh9kh6phaqhcrg9shfthhuk3vk8wm1;1:0jl6jx8j9bh7gj1ih6wgh"}/*MODEL-BITIS*/;
  var _model = null;
  // Iki tur desteklenir: 'nb' (Naive Bayes sayilari) ve 'lr' (lojistik regresyon, nicemlenmis seyrek agirliklar).
  // d: ';' ile ayrilmis kovalar; her biri "<onceki kovadan fark (36lik)>:<girdiler>".
  //   nb girdisi: sinif(1 karakter) + sayi(1 karakter, '0' = 1);  lr girdisi: sinif(1) + agirlik(2 karakter, deger+648).
  function modelHazirla() {
    if (_model || !NIYET_MODEL) return _model;
    var M = NIYET_MODEL, C = M.c.length, lr = M.tur === 'lr';
    var kova = {}, parca = M.d.split(';'), onceki = 0, adim = lr ? 3 : 2;
    for (var i = 0; i < parca.length; i++) {
      if (!parca[i]) continue;
      var a = parca[i].split(':');
      onceki += parseInt(a[0], 36);
      var dizi = [], st = a[1];
      for (var j = 0; j < st.length; j += adim) {
        var sinif = parseInt(st.charAt(j), 36);
        if (lr) dizi.push(sinif, (parseInt(st.substr(j + 1, 2), 36) - 648) * M.q);
        else dizi.push(sinif, parseInt(st.charAt(j + 1), 36) || 1);
      }
      kova[onceki] = dizi;
    }
    var md = { M: M, C: C, kova: kova, lr: lr };
    if (!lr) {
      md.lA = Math.log(M.a); md.payda = []; md.onsel = [];
      for (var c = 0; c < C; c++) {
        md.payda.push(Math.log(M.t[c] + M.a * M.v));
        md.onsel.push(Math.log((M.n[c] + 1) / (M.N + C)));
      }
    }
    _model = md;
    return md;
  }
  // model log-olasiliklari (normalize) -> { sinif: logp }
  function modelPuanla(katli) {
    var md = modelHazirla();
    if (!md) return null;
    var f = ozellikler(katli, md.M.b);
    var sk = new Array(md.C), c, i, j, d;
    if (md.lr) {
      var olcek = 1 / Math.sqrt(f.length || 1);
      for (c = 0; c < md.C; c++) sk[c] = md.M.w0[c] * md.M.q;
      for (i = 0; i < f.length; i++) {
        d = md.kova[f[i]];
        if (d) for (j = 0; j < d.length; j += 2) sk[d[j]] += d[j + 1] * olcek;
      }
    } else {
      for (c = 0; c < md.C; c++) sk[c] = md.onsel[c] + f.length * (md.lA - md.payda[c]);
      for (i = 0; i < f.length; i++) {
        d = md.kova[f[i]];
        if (d) for (j = 0; j < d.length; j += 2) sk[d[j]] += Math.log(d[j + 1] + md.M.a) - md.lA;
      }
    }
    return logNormal(sk, md.M.c);
  }
  function logNormal(sk, adlar) {
    var mx = -Infinity, i;
    for (i = 0; i < sk.length; i++) if (sk[i] > mx) mx = sk[i];
    var top = 0;
    for (i = 0; i < sk.length; i++) top += Math.exp(sk[i] - mx);
    var lz = mx + Math.log(top), o = {};
    for (i = 0; i < sk.length; i++) o[adlar[i]] = sk[i] - lz;
    return o;
  }
  // kural puanlarini log-olasiliga cevir: softmax(beta * puan), "genel" taban puani g
  function kuralLog(puan, beta, g) {
    var sk = NIYETLER.map(function (a) { return beta * Math.max(0, puan[a] || 0) + (a === 'genel' ? beta * g : 0); });
    return logNormal(sk, NIYETLER);
  }
  // karma: lambda * kural + (1 - lambda) * model; kufur ve cok guclu kural her zaman kazanir
  function karma(kural, puan, modelLog, kp) {
    var rl = kuralLog(puan, kp.beta, kp.g);
    var en = null, enP = -Infinity, ik = null, ikP = -Infinity, toplam = {};
    NIYETLER.forEach(function (a) {
      var p = kp.lambda * rl[a] + (1 - kp.lambda) * (modelLog[a] == null ? -30 : modelLog[a]);
      toplam[a] = p;
      if (p > enP) { ik = en; ikP = enP; en = a; enP = p; } else if (p > ikP) { ik = a; ikP = p; }
    });
    if (kural.kufur) en = 'hakaret';
    // kural guclu puanla eminse kural kazanir (esik T)
    var kEn = null, kP = 0;
    NIYETLER.forEach(function (a) { if ((puan[a] || 0) > kP) { kP = puan[a]; kEn = a; } });
    if (kp.T != null && kEn && kP >= kp.T && !kural.kufur) {
      if (kEn !== en) { ik = en; ikP = enP; en = kEn; enP = toplam[kEn]; }
    }
    var guven = 1 / (1 + Math.exp(-Math.abs(enP - ikP)));
    return { niyet: en, ikinci: ik, guven: Math.round(guven * 100) / 100, toplam: toplam };
  }

  var NIYET_ESIK = 0.5;
  function niyetBul(metin, baglam, secenek) {
    var r = kuralNiyetBul(metin, baglam);
    var md = (!secenek || secenek.model !== false) ? modelHazirla() : null;
    if (!md) return r;
    var ml = modelPuanla(r._katli);
    var k = karma(r, r.puanlar, ml, md.M.k);
    var mEn = null, mP = -Infinity;
    Object.keys(ml).forEach(function (a) { if (ml[a] > mP) { mP = ml[a]; mEn = a; } });
    r.kural = { niyet: r.niyet, guven: r.guven };
    r.model = { niyet: mEn, guven: Math.round(Math.exp(mP) * 100) / 100 };
    r.niyet = k.niyet; r.ikinci = k.ikinci; r.guven = k.guven;
    // cok guclu kural (puan >= 4) ve emin olmayan model: kural kazanir
    { var kEn = null, kP = 0; Object.keys(r.puanlar || {}).forEach(function (a) { if (r.puanlar[a] > kP) { kP = r.puanlar[a]; kEn = a; } });
      if (kEn && kP >= 4 && r.model.guven < 0.6 && r.niyet !== kEn && !r.kufur) { r.ikinci = r.niyet; r.niyet = kEn; r.guven = Math.max(r.guven, 0.7); } }
    // hic kural tetiklenmediyse ve model de emin degilse tahmin yerine 'genel' (sohbette onceki konunun devami sayilsin)
    var kuralBos = !Object.keys(r.puanlar || {}).some(function (a) { return r.puanlar[a] > 0; });
    var esik = (secenek && secenek.esik != null) ? secenek.esik : NIYET_ESIK;
    if (kuralBos && r.model.guven < esik && r.niyet !== 'hakaret') { r.ikinci = r.niyet; r.niyet = 'genel'; r.guven = 0.3; }
    return r;
  }

  function kuralNiyetBul(metin, baglam) {
    baglam = baglam || {};
    var n = normal(metin);
    var k = ' ' + n.katli + ' ';
    var bas = n.katli;
    var puan = {};
    function ekle(ad, p) { puan[ad] = (puan[ad] || 0) + p; }
    KURAL_RE.forEach(function (r) {
      var hedef = r.re.source.charAt(0) === '^' ? bas : k;
      if (r.re.test(hedef)) ekle(r.n, r.p);
    });
    var soru = soruMu(n);
    var kufur = kufurVar(metin);
    var v = varlikBul(n, baglam);
    var nk = n.kelimeler.length;

    // kisa onay / ret
    ['evet', 'hayir'].forEach(function (a) {
      if (!puan[a]) return;
      if (nk <= 2) puan[a] *= 1.5; else if (nk > 4) puan[a] *= 0.5;
    });
    if (kufur) ekle('hakaret', 4);
    // "maas nasil yukseltilir": genel bilgi sorusu, kisisel zam istegi degil
    if (puan.zam_istegi && puan.yardim >= 3.5 && /\bnasil\b/.test(k) && !/\bmaas(im|imi|ima)\b/.test(k)) puan.zam_istegi -= 2.5;
    // "aptal bot": hakaret, bot sorusu degil
    if (puan.hakaret >= 3 && puan.bot_musun && !soru) puan.bot_musun -= 2.5;
    var s = sakaMi(n);
    if (s) ekle('saka', s);
    // teklif: tutar + teklif sozcukleri ya da "30 bine olur mu"
    if (v.tutar != null) {
      if (puan.teklif) ekle('teklif', 2.5);
      if (/(\d|bin|milyon|milyar|tl|lira)(e|a|ye|ya) (olur|alirim|veririm|satarim|verir misin|satar misin|anlasalim|anlasiriz|tamam|calis\w*|razi|kabul|verirsen|satarsan|yaparsan)/.test(k)) ekle('teklif', 3);
      if (/(maasi|maasimi|maasini) \S+ (yap|yaparsan|yapalim|olsun)/.test(k)) ekle('teklif', 1.5);
      if (/(maasa|fiyata|paraya|ucrete|rakama|kiraya) (calis|olur|veririm|alirim|satarim|razi|kabul|tamam)\w*/.test(k)) ekle('teklif', 4);
    }
    // meslek + aramak -> eleman; "olarak/is" varsa is arayan
    if (v.meslek) {
      var aramaVar = new RegExp('\\b(' + AR + '|lazim|aran\\w*|alinacak|alimi)').test(k);
      var isVar = /\b(is|ise|isi|olarak|calismak|calisacak)\b/.test(k) || /\b\w+l[iu](k|g[iu])\b/.test(k.replace(/\b(kiralik|satilik|aylik|gunluk|haftalik)\b/g, ''));
      if (aramaVar && !isVar && !/arayan (var|kimse|biri|olan)/.test(k)) ekle('eleman_ariyorum', 2.5);
      if (/(tavsiye|oner\w*|mantikli|iyi mi|kazandirir mi|karli mi|nasil bir is|nasil is|degerm\w*|iyi para|olsam|olayim|secsem|gecsem)/.test(k)) ekle('meslek_tavsiyesi', 2.5);
      if (v._meslekler.length >= 2 && soru) ekle('meslek_tavsiyesi', 3);
      if (/(ne kadar|kac para|kac bin|ne verir|kac lira)/.test(k) && !v.mulk) ekle('maas_sorusu', 1.5);
    }
    // "sen memur musun", "kuryemisin", "patron musun": kisinin meslegini soruyor
    if ((v.meslek || /\bpatron\w*\b/.test(k)) && /\b(misin|musun|misiniz|musunuz)\b/.test(k) &&
      !(puan.zam_istegi || puan.yetki_istegi || puan.teklif || puan.yardim || puan.kurs_sorusu) &&
      !new RegExp('\\b(' + AR + '|lazim|alir|aliyor|ister)').test(k)) ekle('kisisel_meslek', 4);
    if (v.meslek && /\bkimler?\b/.test(k) && /\b(burada|kanalda|var|aramizda)\b/.test(k) && !/\bal(ir|iyor|an)\b/.test(k)) ekle('kisisel_meslek', 3.6);
    // "Istanbulda misin", "Ankarali var mi": kisinin yerini soruyor
    if (v.yer && /\b(misin|musun|misiniz|musunuz)\b/.test(k)) ekle('kisisel_yer', 4);
    if (v.yer && /\b\w+l[iu](lar)? (var|kim|olan)\b/.test(k)) ekle('kisisel_yer', 3.6);
    // is ilaninda maas yazmak teklif degildir ("eleman ariyorum 30 bin veririm")
    if (puan.teklif && (puan.eleman_ariyorum >= 3 || (puan.is_ariyorum >= 3 && v.tutar == null)) && !/\bortak/.test(k)) puan.teklif -= 3;
    // fiyat egilimi ("fiyatlar duser mi", "neden artiyor") ekonomidir
    if (puan.fiyat_sorusu && /\b((fiyat|kira|piyasa|dolar|emlak|altin)\w* (\w+ )?(dus|art|yuksel|ucu|uctu|inecek|cikacak|neden)\w*|neden (art|pahalan|yuksel)\w*)/.test(k)) puan.fiyat_sorusu -= 3;
    // dert anlatimi kredi/maas sorusu degil ("borcum cok", "maasimi alamadim")
    if (puan.dert >= 3.6 && !soru) {
      ['kredi_sorusu', 'maas_sorusu', 'eleman_ariyorum', 'mulk_satiyorum'].forEach(function (a) { if (puan[a]) puan[a] -= 2; });
    }
    // "naber millet": topluluga selam
    if (/\b(naber|ne haber|selam\w*|merhaba\w*) (millet|herkes\w*|arkadaslar|ahali|gencler|ekip|cocuklar|beyler|kanal\w*)\b/.test(k) &&
      !/\b(nasilsiniz|nasilsin|iyi misiniz)\b/.test(k) && puan.hal_hatir) { puan.hal_hatir -= 2; ekle('selam', 2.5); }
    if (/\byeni (girdim|katildim)\b/.test(k) && puan.veda) puan.veda -= 2;
    // mulk varsa "kac veriyor/alir" fiyat sorusudur
    if (v.mulk && puan.maas_sorusu && !/\bmaas/.test(k)) puan.maas_sorusu -= 2;
    // acik "kredi" kelimesi + soru -> kredi
    if (/\bkredi/.test(k) && soru && puan.kredi_sorusu) ekle('kredi_sorusu', 1);
    // bankadaki faiz orani (kredi kelimesi yok) -> ekonomi
    if (puan.kredi_sorusu && puan.ekonomi && /\bfaiz/.test(k) && !/\b(kredi|borc|taksit|icra)/.test(k)) puan.kredi_sorusu -= 2;
    // pazarlik/indirim sorusu, tutar yoksa fiyat sorusu
    if (v.tutar == null && soru && puan.teklif && /\b(pazarlik|indirim|iner|duser|son fiyat)/.test(k)) ekle('fiyat_sorusu', 1.5);
    // Karsi tarafin ilanina atif: "eleman ariyormussun", "daire satiyomussun", "garson ariyorum diyordun", "hala satilik mi".
    // Konusan karsi roldedir: eleman <-> is arama, satma -> arama.
    var atif = /\b\w+(yormussun\w*|mussun|mussunuz|missin|missiniz)\b|\b(diyordun|demistin|demissin|yazmissin|yazmistin|paylasmissin)\b/.test(k) ||
      /\bhala (satilik|kiralik|var|duruyor|musait|satiyor|ariyor)\w*/.test(k) || /\b(satilik|kiralik)\b.*\bvarmis\b/.test(k);
    if (atif) {
      var el = puan.eleman_ariyorum || 0, is_ = puan.is_ariyorum || 0;
      if (el > is_) { puan.is_ariyorum = el + 0.5; puan.eleman_ariyorum = is_; }
      if (puan.mulk_satiyorum || (v.mulk && /\b(sat|kirali)/.test(k))) {
        puan.mulk_ariyorum = Math.max(puan.mulk_ariyorum || 0, (puan.mulk_satiyorum || 3)) + 0.5; puan.mulk_satiyorum = 0;
      }
    }
    // "satilik daire var mi / ariyorum" -> arayan
    if (/\b(satilik|kiralik)\b/.test(k) && new RegExp('\\b(' + AR + '|var mi|lazim|bakiyorum|nerede|bil\\w*)').test(k) &&
      !/\b(satiyorum|satacag|benim|elimde|dairem|evim|dukkanim|arsam|ilgilenen|isteyen|alan var|alici)/.test(k)) {
      if (puan.mulk_satiyorum) puan.mulk_satiyorum -= 3;
    }
    if (v.mulk) {
      if (puan.mulk_ariyorum) ekle('mulk_ariyorum', 0.5);
      if (puan.mulk_satiyorum) ekle('mulk_satiyorum', 0.5);
      if (puan.fiyat_sorusu) ekle('fiyat_sorusu', 0.5);
    }
    if (soru && puan.fiyat_sorusu) ekle('fiyat_sorusu', 0.5);
    if (!soru && puan.fiyat_sorusu && puan.ekonomi) puan.fiyat_sorusu -= 1.5;
    if (puan.fiyat_sorusu && puan.ekonomi && !v.mulk) puan.fiyat_sorusu -= 1;
    if (puan.fiyat_sorusu && puan.maas_sorusu && !v.mulk) puan.fiyat_sorusu -= 1.5;
    // zam_istegi varsa ekonomi'deki "zam" puanini dusur
    if (puan.zam_istegi && puan.ekonomi) puan.ekonomi -= 2;
    // kredi + faiz -> kredi
    if (puan.kredi_sorusu && puan.ekonomi && /\bfaiz/.test(k) && !/(enflasyon|dolar|doviz|borsa|altin)/.test(k)) puan.ekonomi -= 1.5;
    // is ariyorum ile "eleman arayan var mi"
    if (puan.is_ariyorum >= 4 && puan.eleman_ariyorum) puan.eleman_ariyorum -= 2;
    // selam + baska bir sey -> baska sey kazanir
    var dolu = Object.keys(puan).filter(function (a) { return a !== 'selam' && puan[a] >= 2; });
    if (puan.selam && dolu.length) puan.selam *= 0.5;
    if (puan.evet && puan.oneri_kabul) puan.evet *= 0.6;
    // bayram + tebrik -> bayram
    if (puan.bayram >= 3 && puan.tebrik) puan.tebrik -= 1.5;
    if (puan.tesekkur && puan.veda && /bana eyvallah/.test(k)) puan.tesekkur -= 1;
    // "ne yapmaliyim" + meslek -> meslek tavsiyesi
    if (puan.yardim && v.meslek && soru) ekle('meslek_tavsiyesi', 1);
    // "ne is yapiyorsun" sorusu hal hatir degil
    if (soru && puan.kisisel_meslek && puan.hal_hatir) puan.hal_hatir -= 2;
    // "yardim" genel bir sarmal: daha belirli bir istek varsa o kazanir ("is ariyorum yardim edin")
    if (puan.yardim && ['is_ariyorum', 'eleman_ariyorum', 'mulk_ariyorum', 'mulk_satiyorum', 'kredi_sorusu', 'kurs_sorusu', 'dert']
      .some(function (a) { return puan[a] >= 3; })) puan.yardim -= 2;

    var sira = Object.keys(puan).filter(function (a) { return puan[a] > 0; })
      .sort(function (a, b) { return puan[b] - puan[a] || NIYETLER.indexOf(a) - NIYETLER.indexOf(b); });
    var niyet = 'genel', ikinci = null, guven = 0.2;
    if (sira.length && puan[sira[0]] >= 1) {
      niyet = sira[0];
      var p1 = puan[sira[0]], p2 = sira[1] ? puan[sira[1]] : 0;
      ikinci = sira[1] || null;
      guven = Math.round(Math.min(0.97, (p1 / (p1 + p2 + 1)) * (0.75 + Math.min(p1, 6) / 24)) * 100) / 100;
    }
    return {
      niyet: niyet, guven: guven, ikinci: ikinci, soru: soru, kufur: kufur,
      varlik: { tutar: v.tutar, meslek: v.meslek, mulk: v.mulk, yer: v.yer, kisi: v.kisi, kanal: v.kanal },
      puanlar: puan, _katli: n.katli
    };
  }

  // =====================================================================
  // 6. EK UYUMU
  // =====================================================================
  // Kurallar: son unluye gore buyuk/kucuk unlu uyumu, sert unsuz benzesmesi (fistikci sahap),
  // unluyle bitende kaynastirma (y/n), ozel ad / sayi / kisaltmada kesme isareti.
  // Sayilar okunusuna gore: 5 -> bes -> 5'e, 6 -> alti -> 6'ya, 1.500.000 -> bin -> 1.500.000'e.
  // TL ve ₺ "te-le" okunur: 1.500.000 TL'ye, 1.500.000 ₺'ye.
  var UNLULER = 'aeıioöuüâîû';
  var KALIN_U = 'aıouâû';
  var SERT = 'fstkçşhp';
  var RAKAM_OKU = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
  var ONLAR_OKU = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
  var BUYUK_OKU = ['', 'bin', 'milyon', 'milyar', 'trilyon', 'katrilyon'];
  var HARF_OKU = {
    a: 'a', b: 'be', c: 'ce', 'ç': 'çe', d: 'de', e: 'e', f: 'fe', g: 'ge', 'ğ': 'ge', h: 'he', 'ı': 'ı', i: 'i', j: 'je',
    k: 'ka', l: 'le', m: 'me', n: 'ne', o: 'o', 'ö': 'ö', p: 'pe', r: 're', s: 'se', 'ş': 'şe', t: 'te', u: 'u', 'ü': 'ü',
    v: 've', y: 'ye', z: 'ze', q: 'ku', w: 've', x: 'iks'
  };
  // son hecesi ince okunan (alintilar): Kemal'e, saate, role
  var INCE_ISTISNA = {};
  ['saat', 'kemal', 'celal', 'cemal', 'hilal', 'bilal', 'ikbal', 'iclal', 'meral', 'rol', 'gol', 'alkol', 'petrol', 'hal',
    'kalp', 'istikbal', 'terminal', 'sembol', 'ideal', 'normal', 'metropol', 'kontrol', 'protokol', 'futbol', 'idol', 'hayal',
    'misal', 'mahsul', 'meal', 'sual', 'usul', 'emsal', 'ihtimal', 'kabul', 'harf', 'dikkat', 'hakikat', 'seyahat', 'saadet',
    'cemaat'].forEach(function (w) { INCE_ISTISNA[w] = 1; });

  function sayiOku(sonParca) {
    // sonParca: "1.500.000", "1,5", "%5", "34"
    var s = sonParca.replace(/^%/, '');
    if (s.indexOf(',') >= 0) s = s.split(',').pop();
    var d = s.replace(/\D/g, '');
    if (!d) return 'sıfır';
    if (/^0+$/.test(d)) return 'sıfır';
    var gruplar = [];
    for (var i = d.length; i > 0; i -= 3) gruplar.push(parseInt(d.slice(Math.max(0, i - 3), i), 10));
    var g0 = gruplar[0];
    if (g0) {
      if (g0 % 10) return RAKAM_OKU[g0 % 10];
      if (Math.floor(g0 / 10) % 10) return ONLAR_OKU[Math.floor(g0 / 10) % 10];
      return 'yüz';
    }
    for (var k = 1; k < gruplar.length; k++) if (gruplar[k]) return BUYUK_OKU[k] || 'bin';
    return 'sıfır';
  }

  function sonKelime(s) {
    var t = String(s).trim();
    var p = t.split(/\s+/);
    return p[p.length - 1] || '';
  }
  function kisaltmaMi(w) {
    return /^[A-ZÇĞİÖŞÜ]{2,5}$/.test(w) && (w.match(/[AEIİOÖUÜ]/g) || []).length <= 1;
  }
  function ozelMi(s) {
    var w = sonKelime(s);
    if (!w) return false;
    if (/[0-9₺%]$/.test(w) || w === 'TL' || kisaltmaMi(w)) return true;
    return /^\p{Lu}/u.test(String(s).trim()) || /^\p{Lu}/u.test(w);
  }
  // okunus: unlu uyumunu belirleyen sesli bicim
  function okunus(s) {
    var w = sonKelime(s).replace(/[.,!?;:]+$/, '');
    if (!w) return '';
    if (w === '₺' || /₺$/.test(w) || w === 'TL') return 'tele';
    if (/\d$/.test(w)) return sayiOku(w.match(/[\d.,%]+$/)[0]);
    if (kisaltmaMi(w)) return HARF_OKU[kucult(w.slice(-1))] || 'e';
    return kucult(w);
  }

  // Iyelik ekiyle biten tamlama mi? ("Muhasebe Kursu" -> Kursu'na, "Kahve Durağı" -> Durağı'nda, "yılbaşı" -> yılbaşına)
  var _adSet = null;
  function adSet() {
    if (_adSet) return _adSet;
    _adSet = {};
    VERI.erkekAdlari.concat(VERI.kadinAdlari).forEach(function (a) { _adSet[kucult(a)] = 1; });
    return _adSet;
  }
  function iyelikli(s) {
    var t = String(s).trim();
    var p = t.split(/\s+/);
    var w = kucult(p[p.length - 1] || '');
    if (/^\d/.test(w) || ozelSayiMi(w)) return false;
    if (/(başı|bayramı|günü|kursu|haftası|gecesi)$/.test(w)) return true;
    if (p.length < 2) return false;
    if (adSet()[w]) return false;
    return /[^aeıioöuü][ıiuü]$/.test(w) && w.length >= 3;
  }
  function ozelSayiMi(w) { return /[0-9]/.test(w); }

  function cozumle(s) {
    var o = okunus(s);
    var sonHarf = o.slice(-1);
    var sonUnlu = '';
    for (var i = o.length - 1; i >= 0; i--) if (UNLULER.indexOf(o.charAt(i)) >= 0) { sonUnlu = o.charAt(i); break; }
    var kelime = kucult(sonKelime(s));
    var ince = INCE_ISTISNA[kelime] === 1;
    var kalin = KALIN_U.indexOf(sonUnlu) >= 0 && !ince;
    var yuvarlak = 'ouöü'.indexOf(sonUnlu) >= 0;
    return {
      unluyleBiter: UNLULER.indexOf(sonHarf) >= 0,
      sert: SERT.indexOf(sonHarf) >= 0,
      a: kalin ? 'a' : 'e',
      i4: kalin ? (yuvarlak ? 'u' : 'ı') : (yuvarlak ? 'ü' : 'i'),
      ozel: ozelMi(s),
      iyelik: iyelikli(s)
    };
  }
  // Cins isimlerde unluyle baslayan ekte yumusama (durak->durağa, kebap->kebaba, ağaç->ağaca). Ozel adlarda yok.
  function yumusat(s, c) {
    if (c.ozel) return s;
    var w = sonKelime(s);
    if ((w.match(/[aeıioöuü]/g) || []).length < 2) return s;
    var son = w.slice(-1), once = w.slice(-2, -1);
    if (UNLULER.indexOf(once) < 0) return s;
    var harita = { k: 'ğ', p: 'b', 'ç': 'c' };
    if (!harita[son]) return s;
    if (/(market|dükkan|kat)$/.test(w)) return s;
    return s.slice(0, -1) + harita[son];
  }
  function bag(s, ek, c, unluEk) {
    var govde = unluEk ? yumusat(s, c) : s;
    return govde + (c.ozel ? "'" : '') + ek;
  }
  var ek = {
    // bulunma: Kadıköy'de, Beşiktaş'ta, 3'te
    de: function (s) {
      var c = cozumle(s);
      if (c.iyelik) return bag(s, 'nd' + c.a, c);
      return bag(s, (c.sert ? 't' : 'd') + c.a, c);
    },
    // yonelme: Ankara'ya, Üsküdar'a, 5'e, 6'ya
    e: function (s) {
      var c = cozumle(s);
      if (c.iyelik) return bag(s, 'n' + c.a, c);
      return bag(s, (c.unluyleBiter ? 'y' : '') + c.a, c, !c.unluyleBiter);
    },
    // ayrilma: Kartal'dan, Ataşehir'den, 4'ten
    den: function (s) {
      var c = cozumle(s);
      if (c.iyelik) return bag(s, 'nd' + c.a + 'n', c);
      return bag(s, (c.sert ? 't' : 'd') + c.a + 'n', c);
    },
    // ilgi: Eymen'in, Ayşe'nin, 100'ün
    in: function (s) {
      var c = cozumle(s);
      if (c.iyelik) return bag(s, 'n' + c.i4 + 'n', c);
      return bag(s, (c.unluyleBiter ? 'n' : '') + c.i4 + 'n', c, !c.unluyleBiter);
    },
    // belirtme: Kadıköy'ü, Ayşe'yi, 23 Nisan'ı
    i: function (s) {
      var c = cozumle(s);
      if (c.iyelik) return bag(s, 'n' + c.i4, c);
      return bag(s, (c.unluyleBiter ? 'y' : '') + c.i4, c, !c.unluyleBiter);
    },
    // vasita (ile): Eymen'le, Ayşe'yle
    le: function (s) {
      var c = cozumle(s);
      return bag(s, (c.unluyleBiter ? 'yl' : 'l') + c.a, c);
    },
    // yapim -li: Kadıköylü, İzmirli (kesme yok)
    li: function (s) {
      var c = cozumle(s);
      return String(s) + 'l' + c.i4;
    }
  };
  // takma adlar (sablonlarda {yer|da}, {tutar|ye} gibi de yazilabilsin)
  ek.da = ek.de; ek.te = ek.de; ek.ta = ek.de;
  ek.a = ek.e; ek.ye = ek.e; ek.ya = ek.e;
  ek.dan = ek.den; ek.ten = ek.den; ek.tan = ek.den;
  ek.nin = ek.in; ek.nın = ek.in; ek.un = ek.in; ek.nun = ek.in;
  ek.yi = ek.i; ek.ı = ek.i; ek.u = ek.i; ek.ü = ek.i;
  ek.la = ek.le; ek.yle = ek.le; ek.yla = ek.le;
  ek.lu = ek.li; ek.lı = ek.li; ek.lü = ek.li;
  ek.uygula = function (s, ad) { return ek[ad] ? ek[ad](s) : String(s); };
  Object.defineProperty(ek, 'uygula', { enumerable: false });

  // =====================================================================
  // 7. VERI
  // =====================================================================
  var VERI = {};
  VERI.erkekAdlari = ('Ahmet Mehmet Mustafa Ali Hüseyin Hasan İbrahim İsmail Osman Yusuf Murat Ömer Ramazan Halil Süleyman ' +
    'Abdullah Mahmut Recep Fatih Kadir Emre Hakan Adem Kemal Yaşar Bayram Burak Serkan Orhan Metin Salih Uğur Gökhan Volkan ' +
    'Cem Can Deniz Kerem Arda Berk Emir Eymen Yiğit Efe Mert Kaan Barış Onur Tolga Tuncay Erkan Erdem Ercan Erhan Sinan Serdar ' +
    'Selim Sedat Levent Kenan Okan Ozan Oğuz Oğuzhan Furkan Enes Yunus Muhammed Hamza Taha Talha Bilal Bekir Ertuğrul Alper ' +
    'Alp Batuhan Berkay Doğukan Egemen Engin Eren Ferhat Fikret Gürkan Harun Hikmet İlker İlhan Kazım Koray Mesut Necati ' +
    'Nihat Nuri Oktay Orçun Özgür Rıza Sami Selçuk Semih Sercan Şahin Şükrü Tamer Tarık Taner Tayfun Turgut Ufuk Umut Ünal ' +
    'Vedat Veli Yasin Yavuz Yılmaz Zafer Zeki Cihan Cengiz Caner Cemal Celal Bülent Burhan Bora Atakan Anıl Arif Asım Aydın ' +
    'Ayhan Bahadır Baran Berat Çağan Çağrı Dursun Emin Ekrem Ferit Faruk Gökay Halit Hayati İsa Kubilay Lütfi Mithat Necmi ' +
    'Nedim Polat Rasim Rüstem Sabri Seyfi Şenol Tuna Utku Yakup Yener Yücel Zihni Cevdet Erol Hilmi Kurtuluş Mücahit Nazım ' +
    'Oğulcan Özcan Rafet Rahmi Sadık Saffet Tahsin Tevfik Tufan Ümit Yalçın Yekta Zekeriya Alperen Ensar Kağan Mirza Yağız').split(' ');
  VERI.kadinAdlari = ('Ayşe Fatma Emine Hatice Zeynep Elif Meryem Şerife Zehra Sultan Hanife Merve Havva Zeliha Esra Fadime ' +
    'Özlem Hülya Yasemin Hacer Rabia Leyla Gül Songül Büşra Kübra Esma Sevgi Derya Dilek Ebru Gamze Tuğba Sibel Serap Seda ' +
    'Selin Sena Sevda Sinem Burcu Buse Ceren Cansu Damla Defne Duygu Ecrin Ece Eda Ela Elçin Esin Feyza Figen Filiz Gizem ' +
    'Gökçe Gülay Gülşen Hande Hilal İpek İrem Işıl Kader Kevser Lale Melek Melike Melis Meltem Neslihan Nur Nurcan Nihan ' +
    'Nilay Nisa Oya Özge Pelin Pınar Rukiye Saadet Sabiha Seher Semra Serpil Sevim Sezen Şeyma Şule Tuba Tülay Ümran Yağmur ' +
    'Yeliz Zerrin Zuhal Aslı Aynur Ayla Aysel Aylin Azra Bahar Banu Begüm Belgin Berna Betül Beyza Birsen Canan Cemile Çiğdem ' +
    'Demet Dilan Dilara Ayten Asuman Emel Esen Gonca Güler Gülsüm Gülten Handan Hayriye İlknur Jale Kezban Meral Mine Müge ' +
    'Naciye Nazlı Nermin Nesrin Nilgün Nuray Perihan Reyhan Sedef Selma Sema Sevil Simge Suna Şenay Şükran Tülin Türkan Yeşim ' +
    'Yıldız Zübeyde Ilgın Eylül Asya Ada Lina Mira Nehir Öykü Duru Gülizar Hazal İlayda Melda Nilüfer Sıla Tuana Ezgi Gülnur ' +
    'Hacer Hümeyra Miray Nazan Rana Zümra').split(' ').filter(function (a, i, d) { return d.indexOf(a) === i; });
  VERI.soyadlari = ('Yılmaz Kaya Demir Şahin Çelik Yıldız Yıldırım Öztürk Aydın Özdemir Arslan Kılıç Aslan Çetin Kara Kurt ' +
    'Özkan Şimşek Polat Özcan Korkmaz Yavuz Can Acar Şen Aktaş Güler Yalçın Güneş Bulut Keskin Ünal Turan Gül Özer Işık ' +
    'Kaplan Avcı Sarı Tekin Taş Köse Yüksel Ateş Aksoy Ekinci Uçar Çakır Karaca Tunç Altun Coşkun Akın Kaçar Durmaz Toprak ' +
    'Akgül Bayram Sönmez Karakaya Uysal Erdem Oral Güven Kocaman Yücel Ay Akbulut Özkaya Duman Bilgin Ergün Kahraman Er ' +
    'Gündoğdu Demirci Yazıcı Akdeniz Karataş Bayrak Uzun Tan Sezer Dinç Eren Önal Kandemir Erol Tuna Akyüz Dağ Ekici Kalkan ' +
    'Bal Özbek Aydemir Gürbüz Altıntaş Başaran Çiftçi Ercan Sevim Tatlı Kartal Ceylan Atalay Baysal Cengiz Cömert Durak ' +
    'Elmas Erkan Gök Gökmen Gümüş Günay Gürsoy İnce Kahveci Karabulut Karakuş Kocabaş Kuru Mutlu Okur Oruç Ölmez Özgür ' +
    'Pehlivan Saygılı Serin Süzer Şeker Tok Topal Turgut Tümer Uğur Uyar Varol Yaman Yaşar Yazgan Yetkin Yiğit Zengin Akar ' +
    'Akkaya Aksu Alkan Altay Arıkan Arı Aşık Ayhan Bakır Balcı Başar Bektaş Berber Bilgiç Biçer Boz Budak Cansız Ceviz Coşar ' +
    'Çakmak Çalışkan Çınar Çolak Dalkılıç Dikmen Dumlu Ekşi Erbaş Eroğlu Esen Ezer Gezer Göçer Gökçe Gönül Gültekin Gürel ' +
    'Güzel Hacıoğlu Irmak İpek Kabak Kalaycı Karadağ Karagöz Karahan Kasap Kaynak Keçeci Kılınç Kırmızı Konuk Kozan Kuzu ' +
    'Metin Nalbant Oğuz Orhan Öncel Örnek Özbay Özen Özgen Öztekin Parlak Pınar Sağlam Sarıkaya Sayın Selvi Sever Sezgin ' +
    'Soysal Şahan Şanlı Şenel Tarhan Taşkın Temiz Tezcan Toksöz Tosun Ulu Uslu Ünlü Vural Yalın Yanık Yener Yeşil Yurt ' +
    'Akçay Alp Ateşli Bayındır Bozdağ Canbaz Çevik Demirel Dönmez Duru Erdal Erkol Gedik Güçlü Gündüz Karaman Kayacan ' +
    'Kocaoğlu Köroğlu Mert Oktay Özmen Sarıgül Sertkaya Soylu Tekeli Türk Uçkun Yazar Yeşilyurt').split(' ')
    .filter(function (a, i, d) { return d.indexOf(a) === i && ['Demirel', 'Soylu', 'Türk', 'Sarıgül'].indexOf(a) < 0; });

  // Taninmis kisilerle ayni ada-soyada denk gelmesin (uretimde kullanilmamali)
  VERI.unluAdSoyad = ['cem yılmaz', 'ahmet kaya', 'arda turan', 'arda güler', 'kenan yıldız', 'burak yılmaz', 'şenol güneş',
    'abdullah avcı', 'cem karaca', 'murat boz', 'abdullah gül', 'mehmet şimşek', 'sezen aksu', 'yılmaz erdoğan', 'emre aşık',
    'ferdi tayfur', 'hande erçel', 'kerem bürsin', 'haluk bilginer', 'okan bayülgen', 'ahmet sezer', 'ertuğrul özkök',
    'selçuk inan', 'mustafa sandal', 'kenan doğulu', 'yıldız tilbe', 'ebru gündeş', 'demet akalın', 'hülya avşar', 'emre altuğ',
    'zeki müren', 'barış akarsu', 'gökhan özoğuz', 'mert hakan yandaş', 'volkan demirel', 'ali koç', 'ahmet kural',
    'murat yıldırım', 'binali yıldırım', 'tamer yiğit', 'erol evgin', 'kemal sunal', 'ayşe arman', 'cemal süreya', 'deniz baykal',
    'muharrem ince', 'hakan fidan', 'süleyman soylu', 'devlet bahçeli', 'mansur yavaş', 'sinan engin', 'uğur dündar',
    'ahmet hakan', 'hakan şükür', 'rıdvan dilmen', 'ümit özdağ', 'fatih terim', 'mustafa denizli', 'okan buruk', 'ali babacan',
    'aydın doğan', 'emine erdoğan', 'meral akşener', 'ekrem imamoğlu', 'nihat kahveci', 'tuncay şanlı', 'serdar ortaç'];
  function kimlikUygun(ad, soyad) {
    var t = kucult(String(ad || '') + ' ' + String(soyad || '')).trim();
    return VERI.unluAdSoyad.indexOf(t) < 0;
  }

  // yerler: { ad, il, ilceler }  (ad = il ya da ilce)
  VERI.istanbulIlceleri = ['Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler', 'Bakırköy', 'Başakşehir',
    'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü', 'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
    'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane', 'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik',
    'Sancaktepe', 'Sarıyer', 'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla', 'Ümraniye', 'Üsküdar', 'Zeytinburnu'];
  VERI.yerler = [
    { ad: 'İstanbul', ilceler: VERI.istanbulIlceleri },
    { ad: 'Ankara', ilceler: ['Çankaya', 'Keçiören', 'Yenimahalle', 'Mamak', 'Etimesgut', 'Sincan', 'Gölbaşı', 'Pursaklar'] },
    { ad: 'İzmir', ilceler: ['Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Bayraklı', 'Çiğli', 'Karabağlar', 'Gaziemir', 'Urla', 'Çeşme'] },
    { ad: 'Bursa', ilceler: ['Osmangazi', 'Nilüfer', 'Yıldırım', 'Mudanya', 'Gemlik', 'İnegöl'] },
    { ad: 'Antalya', ilceler: ['Muratpaşa', 'Konyaaltı', 'Kepez', 'Alanya', 'Manavgat', 'Kemer'] },
    { ad: 'Konya', ilceler: ['Selçuklu', 'Meram', 'Karatay', 'Ereğli'] },
    { ad: 'Adana', ilceler: ['Seyhan', 'Çukurova', 'Yüreğir', 'Ceyhan'] },
    { ad: 'Gaziantep', ilceler: ['Şahinbey', 'Şehitkamil', 'Nizip'] },
    { ad: 'Kocaeli', ilceler: ['İzmit', 'Gebze', 'Darıca', 'Gölcük', 'Körfez', 'Kartepe'] },
    { ad: 'Eskişehir', ilceler: ['Odunpazarı', 'Tepebaşı'] },
    { ad: 'Trabzon', ilceler: ['Ortahisar', 'Akçaabat', 'Yomra', 'Of'] },
    { ad: 'Kayseri', ilceler: ['Melikgazi', 'Kocasinan', 'Talas'] },
    { ad: 'Samsun', ilceler: ['İlkadım', 'Atakum', 'Canik', 'Bafra'] },
    { ad: 'Diyarbakır', ilceler: ['Bağlar', 'Kayapınar', 'Yenişehir', 'Sur'] },
    { ad: 'Mersin', ilceler: ['Mezitli', 'Yenişehir', 'Toroslar', 'Akdeniz', 'Tarsus'] },
    { ad: 'Sakarya', ilceler: ['Adapazarı', 'Serdivan'] },
    { ad: 'Tekirdağ', ilceler: ['Çorlu', 'Süleymanpaşa', 'Çerkezköy'] },
    { ad: 'Denizli', ilceler: ['Pamukkale', 'Merkezefendi'] },
    { ad: 'Muğla', ilceler: ['Bodrum', 'Fethiye', 'Marmaris', 'Menteşe'] },
    { ad: 'Aydın', ilceler: ['Efeler', 'Kuşadası', 'Didim'] },
    { ad: 'Manisa', ilceler: ['Yunusemre', 'Şehzadeler', 'Akhisar'] },
    { ad: 'Hatay', ilceler: ['Antakya', 'İskenderun', 'Defne'] },
    { ad: 'Malatya', ilceler: ['Battalgazi', 'Yeşilyurt'] },
    { ad: 'Erzurum', ilceler: ['Yakutiye', 'Palandöken'] },
    { ad: 'Van', ilceler: ['İpekyolu', 'Tuşba'] },
    { ad: 'Şanlıurfa', ilceler: ['Haliliye', 'Eyyübiye'] },
    { ad: 'Balıkesir', ilceler: ['Karesi', 'Altıeylül', 'Edremit', 'Ayvalık'] },
    { ad: 'Edirne', ilceler: [] }, { ad: 'Çanakkale', ilceler: [] }, { ad: 'Bolu', ilceler: [] }, { ad: 'Rize', ilceler: [] },
    { ad: 'Ordu', ilceler: [] }, { ad: 'Giresun', ilceler: [] }, { ad: 'Sivas', ilceler: [] }, { ad: 'Elazığ', ilceler: [] },
    { ad: 'Kahramanmaraş', ilceler: [] }, { ad: 'Zonguldak', ilceler: [] }, { ad: 'Isparta', ilceler: [] }, { ad: 'Afyon', ilceler: [] }
  ];
  // Kisa ya da sik kullanilan kelimeyle karisan ilce adlarini aramada kullanma ("Of", "Sur", "Defne", "Akdeniz", "Kemer")
  VERI.yerAramaDisi = ['Of', 'Sur', 'Defne', 'Akdeniz', 'Kemer', 'Talas', 'Canik', 'Yıldırım', 'Yeşilyurt', 'Efeler', 'Fatih'];

  VERI.yabanci = {
    en: {
      adlar: ['Thomas', 'William', 'Henry', 'Oscar', 'Lewis', 'Callum', 'Kyle', 'Nathan', 'Owen', 'Tyler', 'Marcus', 'Ben', 'Sam', 'Alfie', 'Connor', 'Aaron', 'Megan', 'Holly', 'Abbie', 'Zoe', 'Ruby', 'Freya', 'Katie', 'Beth', 'Niamh', 'Erin', 'Ava', 'Isla', 'Rachel', 'Jade', 'Kirsty', 'Phoebe', 'Leah', 'Morgan', 'Tara', 'Aisha', 'James', 'Oliver', 'Jack', 'Harry', 'George', 'Noah', 'Liam', 'Ethan', 'Daniel', 'Ryan', 'Emma', 'Olivia', 'Amelia',
        'Sophie', 'Grace', 'Chloe', 'Emily', 'Hannah', 'Lucy', 'Ella', 'Mia', 'Jessica'],
      soyadlar: ['Martin', 'Baker', 'Kelly', 'Murphy', 'Ward', 'Morris', 'King', 'Lee', 'Scott', 'Price', 'Bennett', 'Reid', 'Murray', 'Shaw', 'Carter', 'Mills', 'Hunt', 'Fox', 'Patel', 'Khan', 'Byrne', 'Lynch', 'Ross', 'Graham', 'Bell', 'Fraser', 'Gray', 'Pearce', 'Dixon', 'Riley', 'Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White',
        'Hughes', 'Edwards', 'Green', 'Hall', 'Wood', 'Harris', 'Clarke', 'Cooper', 'Turner'],
      sehirler: ['London', 'Manchester', 'Liverpool', 'Bristol', 'Leeds', 'Glasgow', 'Dublin', 'New York', 'Chicago', 'Boston',
        'Toronto', 'Sydney', 'Melbourne', 'Auckland']
    },
    de: {
      adlar: ['Niklas', 'Moritz', 'Jakob', 'Simon', 'David', 'Tobias', 'Luca', 'Noah', 'Philipp', 'Erik', 'Fabian', 'Kai', 'Ben', 'Nico', 'Mia', 'Emily', 'Johanna', 'Lina', 'Emma', 'Nele', 'Paula', 'Greta', 'Ida', 'Frieda', 'Sarah', 'Katharina', 'Svenja', 'Miriam', 'Lukas', 'Leon', 'Jonas', 'Felix', 'Paul', 'Max', 'Finn', 'Elias', 'Tim', 'Jan', 'Anna', 'Lena', 'Laura', 'Lea',
        'Sophie', 'Marie', 'Julia', 'Hannah', 'Clara', 'Lisa'],
      soyadlar: ['Braun', 'Hofmann', 'Schäfer', 'Bauer', 'Schröder', 'Lehmann', 'Werner', 'Krause', 'Meier', 'Schmitt', 'Vogel', 'Jung', 'Hahn', 'Keller', 'Graf', 'Berger', 'Frank', 'Roth', 'Beck', 'Lorenz', 'Sommer', 'Kraus', 'Busch', 'Engel', 'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch',
        'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Zimmermann', 'Krüger', 'Hartmann', 'Lange'],
      sehirler: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Leipzig', 'Bremen',
        'Wien', 'Graz', 'Zürich', 'Basel']
    },
    es: {
      adlar: ['Adrián', 'Álvaro', 'Iván', 'Rubén', 'Raúl', 'Óscar', 'Andrés', 'Jorge', 'Marcos', 'Gonzalo', 'Nicolás', 'Tomás', 'Santiago', 'Emilio', 'Rocío', 'Nerea', 'Irene', 'Andrea', 'Claudia', 'Alba', 'Sara', 'Cristina', 'Natalia', 'Ana', 'Pilar', 'Noelia', 'Ximena', 'Camila', 'Carlos', 'Javier', 'Pablo', 'Diego', 'Alejandro', 'Sergio', 'Miguel', 'Daniel', 'Hugo', 'Mateo', 'Lucía', 'María',
        'Paula', 'Sofía', 'Carmen', 'Laura', 'Elena', 'Marta', 'Valeria', 'Isabel'],
      soyadlar: ['Muñoz', 'Gil', 'Serrano', 'Blanco', 'Molina', 'Morales', 'Suárez', 'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Iglesias', 'Medina', 'Garrido', 'Cortés', 'Castillo', 'Santos', 'Vargas', 'Rojas', 'Herrera', 'Mendoza', 'García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
        'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Ramos'],
      sehirler: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Bilbao', 'Zaragoza', 'Granada', 'Ciudad de México',
        'Guadalajara', 'Buenos Aires', 'Bogotá', 'Lima', 'Santiago']
    },
    az: {
      adlar: ['Murad', 'Səməd', 'Emin', 'Anar', 'Ceyhun', 'Toğrul', 'Rauf', 'Şahin', 'Elşən', 'Fuad', 'Azər', 'Cavid', 'Nicat', 'Ülvi', 'Könül', 'Sevinc', 'Aytən', 'Şəbnəm', 'Gülnar', 'Xədicə', 'Nərgiz', 'Zəhra', 'Ayan', 'Arzu', 'Elvin', 'Orxan', 'Rəşad', 'Tural', 'Ramil', 'Kamran', 'Elnur', 'Vüsal', 'Fərid', 'Nihad', 'Aysel', 'Leyla', 'Nərmin',
        'Günay', 'Səbinə', 'Aynur', 'Lalə', 'Nigar', 'Fidan', 'Ülviyyə'],
      soyadlar: ['Əliyev', 'Hacıyev', 'Qasımov', 'Salmanov', 'Tağıyev', 'İbrahimov', 'Allahverdiyev', 'Şirinov', 'Musayev', 'Əsgərov', 'Yusifov', 'Mirzəyev', 'Paşayev', 'Rüstəmov', 'Səfərov', 'Əzizov', 'Məmmədov', 'Hüseynov', 'Həsənov', 'Quliyev', 'İsmayılov', 'Abbasov', 'Bağırov', 'Rzayev', 'Kərimov', 'Cəfərov',
        'Rəhimov', 'Nəsirov', 'Sadıqov', 'Mustafayev', 'Əhmədov', 'Babayev', 'Orucov', 'Novruzov', 'Zeynalov', 'Vəliyev'],
      sehirler: ['Bakı', 'Gəncə', 'Sumqayıt', 'Şəki', 'Lənkəran', 'Mingəçevir', 'Şamaxı', 'Quba', 'Qəbələ', 'Naxçıvan']
    },
    ar: {
      adlar: ['Mahmoud', 'Mustafa', 'Ali', 'Hamza', 'Bilal', 'Rami', 'Fadi', 'Nabil', 'Adel', 'Majed', 'Salem', 'Jamal', 'Walid', 'Anas', 'Yara', 'Reem', 'Salma', 'Nadia', 'Hala', 'Jana', 'Malak', 'Aya', 'Ruba', 'Nour', 'Heba', 'Dalia', 'Ahmad', 'Omar', 'Khalid', 'Youssef', 'Karim', 'Tariq', 'Sami', 'Faisal', 'Hassan', 'Ziad', 'Fatima', 'Layla', 'Noor',
        'Mariam', 'Sara', 'Huda', 'Rania', 'Amira', 'Dana', 'Lina'],
      soyadlar: ['Haddad', 'Khoury', 'Saleh', 'Nasser', 'Hamdan', 'Mansour', 'Aziz', 'Farouk', 'Darwish', 'Najjar', 'Qasim', 'Rashed', 'Sabbagh', 'Shami', 'Zaki', 'Masri', 'Awad', 'Bakri', 'Halabi', 'Omari', 'Haddad', 'Nasser', 'Khoury', 'Saleh', 'Mansour', 'Hamdan', 'Darwish', 'Aziz', 'Qasim', 'Farouk', 'Habib', 'Najjar',
        'Shami', 'Masri', 'Rashed', 'Hijazi', 'Odeh', 'Barakat', 'Sabbagh', 'Zayed'],
      sehirler: ['Doha', 'Dubai', 'Amman', 'Kuwait', 'Riyadh', 'Jeddah', 'Cairo', 'Alexandria', 'Beirut', 'Muscat', 'Manama',
        'Casablanca', 'Tunis', 'Algiers']
    }
  };

  // Yabanci adlardan kadin olanlar (geri kalan erkek; Sam, Morgan, Kai, Nour, Noor iki cinse de konur, erkek listesinde sayilir)
  VERI.yabanciKadin = {
    en: ['Megan', 'Holly', 'Abbie', 'Zoe', 'Ruby', 'Freya', 'Katie', 'Beth', 'Niamh', 'Erin', 'Ava', 'Isla', 'Rachel', 'Jade', 'Kirsty', 'Phoebe', 'Leah', 'Tara', 'Aisha', 'Emma', 'Olivia', 'Amelia', 'Sophie', 'Grace', 'Chloe', 'Emily', 'Hannah', 'Lucy', 'Ella', 'Mia', 'Jessica'],
    de: ['Mia', 'Emily', 'Johanna', 'Lina', 'Emma', 'Nele', 'Paula', 'Greta', 'Ida', 'Frieda', 'Sarah', 'Katharina', 'Svenja', 'Miriam', 'Anna', 'Lena', 'Laura', 'Lea', 'Sophie', 'Marie', 'Julia', 'Hannah', 'Clara', 'Lisa'],
    es: ['Rocío', 'Nerea', 'Irene', 'Andrea', 'Claudia', 'Alba', 'Sara', 'Cristina', 'Natalia', 'Ana', 'Pilar', 'Noelia', 'Ximena', 'Camila', 'Lucía', 'María', 'Paula', 'Sofía', 'Carmen', 'Laura', 'Elena', 'Marta', 'Valeria', 'Isabel'],
    az: ['Könül', 'Sevinc', 'Aytən', 'Şəbnəm', 'Gülnar', 'Xədicə', 'Nərgiz', 'Zəhra', 'Ayan', 'Arzu', 'Aysel', 'Leyla', 'Nərmin', 'Günay', 'Səbinə', 'Aynur', 'Lalə', 'Nigar', 'Fidan', 'Ülviyyə'],
    ar: ['Yara', 'Reem', 'Salma', 'Nadia', 'Hala', 'Jana', 'Malak', 'Aya', 'Ruba', 'Heba', 'Dalia', 'Fatima', 'Layla', 'Mariam', 'Sara', 'Huda', 'Rania', 'Amira', 'Dana', 'Lina']
  };

  // Takma ad kaliplari: {a}=ad, {s}=soyad, {i}=soyad bas harfi, {n}=sayi, {A}/{S}=buyuk harfle baslayan
  VERI.kullaniciAdiKaliplari = ['{a}_{n}', '{a}.{i}', '{A}{S}', '{a}{s}', '{a}_{s}', '{a}{i}{n}', '{a}.{s}', '{a}{n}',
    '{a}_{i}', '{i}{a}', '{a}_tr', '{A}_{S}', '{a}.{s}{n}', '{s}.{a}', '{a}x', 'the{a}', '{a}{a2}', '{A}{n}', '{a}__', '{a}.{n}'];
  var PLAKA = ['34', '06', '35', '16', '07', '01', '42', '27', '41', '26', '61', '38', '55', '21', '33', '54', '59', '20', '45', '10'];
  function takmaAd(ad, soyad, rng) {
    rng = rng || rngOlustur(1);
    var a = katla(kucult(ad || 'oyuncu')).replace(/[^a-z0-9]/g, '');
    var s = katla(kucult(soyad || '')).replace(/[^a-z0-9]/g, '');
    var kaliplar = VERI.kullaniciAdiKaliplari.filter(function (k) { return s || !/\{[sSi]\}/.test(k); });
    var k = sec(rng, kaliplar);
    var n = sans(rng, 0.55) ? sec(rng, PLAKA) : String(80 + Math.floor(rs(rng) * 28)).slice(-2);
    return k.replace(/\{a\}/g, a).replace(/\{s\}/g, s).replace(/\{i\}/g, s.charAt(0))
      .replace(/\{A\}/g, a.charAt(0).toUpperCase() + a.slice(1)).replace(/\{S\}/g, s.charAt(0).toUpperCase() + s.slice(1))
      .replace(/\{a2\}/g, a.slice(-1)).replace(/\{n\}/g, n);
  }

  // =====================================================================
  // 8. SABLONLAR
  // =====================================================================
  // Sozdizimi:  [a|b|]  -> secenekler (bos secenek = hic)
  //             {slot}  -> slot degeri;  {slot|ek} -> ekli (ek.de, ek.e, ek.den, ek.in, ek.i, ek.le, ek.li)
  // Bir sablonda gecen her slot zorunlu sayilir; verilmeyen slotu kullanan kalip secilmez.
  // Sablonlarda emoji yok (stillendir ekler) ve hicbir rakam/para uydurulmaz (para slotlardan gelir).
  var SABLON = {};
  var DUYGU = {};
  var EKCUMLE = {};   // uzunluk yuksekse eklenebilecek ikinci cumleler
  function tanim(anahtar, duygu, liste, ekler) {
    SABLON[anahtar] = liste;
    DUYGU[anahtar] = duygu;
    if (ekler) EKCUMLE[anahtar] = ekler;
  }

  // ---------------- CEVAPLAR ----------------
  tanim('cevap.selam', 'mutlu', [
    '[Selam|Selamlar|Merhaba]!',
    '[Selam|Merhaba] {oyuncuAd}, [hoş geldin|nasılsın?|ne var ne yok?]',
    'Aleyküm selam, [hoş geldin|nasılsın?]',
    '[Selam|Merhaba], [kolay gelsin|iyi oyunlar|hayırlı işler]',
    'Oo selam, [nasıl gidiyor|işler nasıl]?',
    'Merhabalar, hoş geldin',
    'Selam {oyuncuAd}! [Bugün nasılsın|Ne yapıyorsun bugün|Nasıl gidiyor oyun]?',
    'Selam, [ben de yeni geldim|ben de şimdi girdim|tam çıkıyordum ama söyle]',
    '[Selam|Merhaba], hoş geldin {oyuncuAd}',
    'Selamlar, [keyifler nasıl|ne var ne yok]?',
    'Hey selam! [Nasılsın?|Naber?]',
    'Selam selam, [ne var ne yok?|hoş geldin]',
    'Merhaba {oyuncuAd}, [seni görmek güzel|nasılsın?]'
  ], ['Bugün [kanal|ortalık] [çok hareketli|biraz sakin].', 'Ben de işten yeni çıktım.', 'Yeni misin buralarda?']);

  tanim('cevap.hal_hatir', 'mutlu', [
    '[İyiyim|Fena değilim|Bomba gibiyim|İdare eder], [sen nasılsın|sende ne var ne yok|senden ne haber]?',
    'İyiyim [valla|ya|], [işler yoğun ama|biraz yorgunum ama] şikayetim yok. Sen?',
    'Çok şükür iyiyim. Sen nasılsın {oyuncuAd}?',
    '[Bugün|Bu aralar] {meslek} olarak koşturuyorum, iyiyim yani. Sen?',
    'Ne olsun, çalışıyoruz işte. [Sende ne var?|Sen ne yapıyorsun?]',
    'İyi ya, [ay sonunu bekliyorum|maaş gününü sayıyorum|biraz para biriktirmeye çalışıyorum]. Sen nasılsın?',
    'Valla [yorgunum|biraz yorgunum] ama iyiyim, sorduğun için sağ ol. Senden?',
    'Harikayım! Bugün [işler iyi gitti|güzel bir gün oldu]. Sen?',
    'İdare ediyoruz işte, [sen anlat|senden haber ver]',
    'Ne olsun be, [iş güç|koşturmaca]. Sen nasılsın?',
    'İyiyim iyiyim. [Sen neler yapıyorsun bu aralar?|Senin işler nasıl?]',
    '{yer} tarafında işler fena değil, keyfim yerinde. Sende ne var ne yok?',
    'Çalışıp duruyorum, [şükür|fena değil]. Sende durumlar nasıl?'
  ], ['Bu ay biraz yoğun geçti.', 'Akşama biraz dinlenmeyi düşünüyorum.', 'Hafta sonu biraz nefes alacağım inşallah.']);

  tanim('cevap.tesekkur', 'tesekkur', [
    'Rica ederim[!|, ne demek]',
    'Ne demek, [her zaman|ne zaman istersen yaz]',
    'Lafı mı olur[!|, ne demek]',
    'Önemli değil, [kolay gelsin|bol şans]',
    'Asıl ben teşekkür ederim',
    'Rica ederim {oyuncuAd}, [işine yaradıysa ne mutlu|bir şey olursa yine yaz]',
    'Estağfurullah, [ne demek|görevimiz]',
    'Sen de sağ ol!',
    'Bir şey değil, [başka sorun olursa sor|takıldığın yer olursa yaz]',
    'Ne demek, buralarda birbirimize yardım etmezsek olmaz',
    'Eyvallah, [kolay gelsin|bol kazançlar]',
    'Ne demek, [bana da zamanında yardım ettiler|biz birbirimizin destekçisiyiz]'
  ]);

  tanim('cevap.veda', 'mutlu', [
    'Görüşürüz[!|, kendine iyi bak]',
    '[Hadi|Tamam] görüşürüz {oyuncuAd}, [kolay gelsin|bol kazançlar]',
    'Görüşmek üzere, [iyi oyunlar|kendine iyi bak]',
    'Bay bay, [yine yaz|sonra konuşuruz]',
    'Tamam, kendine iyi bak',
    'Hadi eyvallah, [ben de işe dönüyorum|ben de birazdan çıkıyorum]',
    'Görüşürüz, [işlerin rast gelsin|bol şans]',
    'Hoşça kal, [yine beklerim|yolun açık olsun]',
    'Tamamdır, sonra yazışırız',
    'İyi geceler, [yarın görüşürüz|tatlı rüyalar]',
    'Görüşürüz, [bir dahakine daha uzun konuşuruz|yine uğra]'
  ]);

  tanim('cevap.tebrik', 'sevinc', [
    'Çok sağ ol[!|, eksik olma]',
    'Teşekkür ederim, [inşallah devamı gelir|çok uğraştım valla]',
    'Sağ ol {oyuncuAd}, [senin de işlerin rast gitsin|sıra sende]',
    'Eyvallah, [daha yolun başındayız|bu daha başlangıç]',
    'Teşekkürler! [Bakalım nereye kadar|Az kalsın vazgeçiyordum]',
    'Ah sağ ol, [moral oldu|çok mutlu oldum]',
    'Teşekkür ederim, sen de [çok yakında|yakında] aynısını yaşarsın',
    'Sağ olasın, [birlikte büyüyeceğiz|hepimiz için hayırlı olsun]',
    'Teşekkürler, [emeklerin karşılığı|sabrın sonu selamet]'
  ]);

  tanim('cevap.ozur', 'sakin', [
    'Sorun değil[!|, takma kafana]',
    'Önemli değil, olur öyle şeyler',
    'Yok canım, dert etme',
    'Tamam tamam, [geçti gitti|unuttum bile]',
    'Estağfurullah, [hiç sorun değil|ne özrü]',
    'Kafana takma {oyuncuAd}, [hepimizin başına geliyor|olur böyle]',
    'Rahat ol, [kırgın değilim|bir şey olmadı]',
    'Boş ver, devam edelim',
    'Hiç önemli değil, [sen iyi ol yeter|gönlünü ferah tut]'
  ]);

  tanim('cevap.evet', 'mutlu', [
    'Süper, [o zaman anlaştık|tamamdır]',
    'Tamamdır, [haber veririm|ben hallederim]',
    'Güzel! [Devam edelim o zaman|O zaman öyle yapalım]',
    'Harika, [sevindim|iyi oldu]',
    'Tamam o zaman',
    'Anlaştık {oyuncuAd}',
    'Oh, rahatladım. [Sağ ol|Teşekkürler]',
    'Peki, [ona göre ayarlarım|ben not aldım]',
    'Tamam, [güzel|iyi], böyle devam'
  ]);

  tanim('cevap.hayir', 'sakin', [
    'Tamam, [sorun değil|zorlamıyorum]',
    'Peki, [sen bilirsin|nasıl istersen]',
    'Anladım, [başka zaman belki|aklına yatarsa yine yaz]',
    'Olsun, [canın sağ olsun|kafana takma]',
    'Tamamdır, [fikrin değişirse buradayım|haberleşiriz]',
    'Hmm peki, saygı duyarım',
    'Eyvallah, [anladım|zorlama yok]',
    'Sorun yok {oyuncuAd}, belki ileride'
  ]);

  tanim('cevap.is_ariyorum', 'is', [
    'Kanallara göz at, [her gün ilan açılıyor|sürekli eleman arayan çıkıyor]',
    'Kariyer sekmesinden ilanlara bak, [şansını dene|oradan başvurabilirsin]',
    'Benim yerde şu an açık yok ama [duyarsam haber veririm|bir kulak kabartayım]',
    '{yer|de} [birkaç|epey] işletme eleman arıyordu, oraya bakabilirsin',
    'Ne iş arıyorsun? [Kurye|Garson|Market] işleri hep açık oluyor',
    'Başlangıç için kurye ya da garsonluk fena değil, [hemen para kazandırıyor|deneyim de veriyor]',
    '{meslek} arayan bir yer görmüştüm, [Türkiye kanalına bak|kanalda paylaşmışlardı]',
    'Kolay gelsin, inşallah çabuk bulursun. [Ben de öyle başladım|Herkes bir yerden başlıyor]',
    'Kanala kısa bir mesaj at, [ne iş yaptığını yaz|tecrübeni yaz], biri mutlaka döner',
    'Ben de yeni sayılırım ama [elimden geleni yaparım|tanıdıklara sorarım]',
    'Bu aralar {meslek} işleri [iyi para veriyor|çok aranıyor], bir bak derim',
    'Pes etme, [iş mutlaka çıkar|herkes bir yerden başladı], ilanları takip et'
  ]);

  tanim('cevap.eleman_ariyorum', 'is', [
    'Hangi pozisyon için? [Detay yazarsan bakarım|Maaşı ne kadar?]',
    'Ben şu an çalışıyorum ama [çevreme sorarım|duyurmaya yardım ederim]',
    'Kanala ilan aç, [hemen dönüş olur|başvuran çok olur]',
    'Ne kadar veriyorsun? [Uygunsa düşünürüm|Şartlar iyiyse konuşuruz]',
    '{meslek} mi arıyorsun? [Bir arkadaşım iş arıyordu|Tanıdık biri vardı], [sorayım|haber veririm]',
    '{tutar} için [biraz düşünmem lazım|fena değil aslında]',
    'Kolay gelsin, inşallah iyi birini bulursun',
    'Tecrübeli mi arıyorsun yoksa yeni başlayan da olur mu?',
    'İşletme nerede? [Yakınsa ilgilenirim|Uzaksa benim için zor]',
    '{isletme} mi? [Duymuştum|Güzel yer], iyi şanslar',
    '{yer} tarafındaysa [ilgilenirim|bakarım], detay yaz'
  ]);

  tanim('cevap.maas_sorusu', 'para', [
    '{meslek} için şu an [aşağı yukarı|ortalama] {tutar} civarı',
    'Benim maaşım {tutar} kadar, [idare ediyor|şikayet etmiyorum]',
    'Mesleğe göre değişiyor. [Kariyer sekmesinde hepsi yazıyor|Kariyer ekranında maaşlar var]',
    'Kurye ve garsonlar çalıştıkça kazanıyor, memurlar sabit maaş alıyor. [Sana hangisi uyar?|Ona göre seç]',
    'Valla çok değil ama [geçiniyoruz|her ay biraz kenara koyuyorum]',
    'Maaşlar enflasyonla birlikte artıyor [ama fiyatlar da artıyor|, o yüzden takipte kal]',
    'Kademe atladıkça maaş da [ciddi artıyor|yükseliyor], kurslara bak',
    'Ne kadar çalışırsan o kadar, özellikle kuryelikte',
    '{meslek} fena kazanmıyor, [ayda {tutar} gibi|{tutar} civarı] bir şey'
  ]);

  tanim('cevap.meslek_tavsiyesi', 'merak', [
    'Bence [hızlı para için|başlangıç için] kurye mantıklı. [Biraz yorucu ama|Tempo ister ama] iyi kazandırıyor',
    'Sabit gelir istiyorsan memurluk, [hareket seviyorsan kurye|aktif oynuyorsan kurye]',
    'Muhasebe kursu alırsan sonradan [çok işine yarar|kapılar açılıyor]',
    '{meslek} [iyi seçim|fena değil], [ben de düşünmüştüm|çevremde yapanlar memnun]',
    'Hangisini seviyorsan onu seç, [para zaten geliyor|sonra kurs alıp atlarsın]',
    'Ben olsam önce para biriktirirdim, sonra kurs alıp [kademe atlardım|bir üst mesleğe geçerdim]',
    'Emlak danışmanlığı primle iyi kazandırıyor ama [satış yapman lazım|sabır istiyor]',
    'Usta olursan iş hiç bitmez, [herkesin bir tamiri var|herkes usta arıyor]',
    'Kısa vadede {meslek}, uzun vadede kendi işin. [Benim tavsiyem bu|Ben öyle yaptım]',
    'Oyuna pek giremiyorsan maaşlı bir iş seç, [memur ya da muhasebeci|sabit maaşlı bir şey] iyi olur',
    'Ne kadar vaktin var ona bak. [Çok oynuyorsan kurye|Az oynuyorsan memurluk] daha mantıklı'
  ]);

  tanim('cevap.kurs_sorusu', 'merak', [
    '{kurs} [iyi bir kurs|bence değer], [biraz sürüyor ama|bekleme süresi var ama] sonra maaş farkı büyük',
    'Kurslar kariyer ekranında, [ücretini ödeyip başlıyorsun|parası peşin ödeniyor]',
    'Ben aldım, [pişman değilim|iyi ki almışım]',
    'Kurs bitene kadar beklemek lazım, Kum Saati varsa [hızlanıyor|kısaltabilirsin]',
    'Hangi kursu düşünüyorsun? [Muhasebe|Emlak danışmanlığı] kursları popüler',
    'Önce biraz deneyim kazan, sonra kursa gir [derim|bence]',
    '{kurs} için yeterli paran varsa [hiç bekleme|hemen başla]',
    'Kurs pahalı gelebilir ama [kendini kısa sürede çıkarıyor|uzun vadede kazandırıyor]',
    'Ben de {kurs|i} almayı düşünüyorum, [birlikte başlayalım mı?|sen başlarsan haber ver]',
    'Üst kademelerde kurs tek başına yetmiyor, [deneyim de lazım|biraz çalışmak da şart]'
  ]);

  tanim('cevap.mulk_satiyorum', 'merak', [
    'Nerede? [Fiyatı ne kadar?|Kaç metrekare?]',
    '{yer|de} mi? [Bölge güzel|Oralar değerleniyor], [fiyatı ne?|ne istiyorsun?]',
    '{mulk} için ne istiyorsun?',
    '{tutar} biraz yüksek değil mi? [Biraz iner misin?|Pazarlık payı var mı?]',
    'Şu an nakitim yok ama [çevreme sorarım|ilgilenen olursa yönlendiririm]',
    'İlana koydun mu? [Mülk ekranından|Pazardan] daha çok kişi görür',
    'Bakarım, [ama acelem yok|biraz düşüneyim]',
    'Kira getirisi nasıl? [Kiracı var mı?|Boş mu?]',
    'Hayırlı olsun, inşallah iyi bir alıcı çıkar',
    '{tutar} uygunsa ciddi düşünürüm'
  ]);

  tanim('cevap.mulk_ariyorum', 'merak', [
    '{yer} tarafında satılık bir şeyler görmüştüm, [pazara bak|mülk ekranında var]',
    'Ne kadar bütçen var? [Ona göre söyleyeyim|Bölgeye göre değişiyor]',
    'Kiralık mı satılık mı arıyorsun?',
    'Benim elimde şu an yok ama [duyarsam yazarım|göz kulak olurum]',
    '{mulk} fiyatları bu aralar [biraz arttı|epey yükseldi], acele etme',
    'Merkezden biraz uzaklaşırsan [daha uygun buluyorsun|fiyatlar düşüyor]',
    'Mülk ekranında ilanlar var, [her gün yenileri geliyor|sürekli göz at]',
    'Bir emlak danışmanına sor, [prim karşılığı bulur|o işi iyi bilirler]',
    'Kira getirisi için {mulk} iyi yatırım bence',
    'Ben de bakıyorum aslında, [bulursam paylaşırım|birlikte bakalım]',
    '{yer} için bütçen ne kadar? [Fiyatlar orada biraz yüksek|Oralar epey değerlendi]'
  ]);

  tanim('cevap.fiyat_sorusu', 'merak', [
    'Bölgeye göre çok değişiyor, [nereye bakıyorsun?|hangi semt?]',
    '{yer} tarafında [fiyatlar yükseldi|fiyatlar biraz daha uygun]',
    'Piyasa fiyatı mülk ekranında yazıyor, [oradan bakmak en iyisi|ona göre pazarlık et]',
    'Bence {tutar} makul',
    '{tutar} civarı diyorlar ama [pazarlık payı var|biraz inebilir]',
    'Fiyatlar her ay biraz artıyor, [enflasyon işte|erken alan kazanıyor]',
    'Tam bilmiyorum açıkçası, [bir emlak danışmanına sor|kanala sorarsan biri bilir]',
    'Geçen ay daha ucuzdu, şimdi [biraz arttı|epey arttı]',
    '{mulk} için mi? [Konuma göre değişir|Ne kadar büyük?]'
  ]);

  tanim('cevap.ekonomi', 'notr', [
    'Enflasyon [her şeyi yiyor|cepleri yakıyor], [fiyatlar sürekli artıyor|biriktirmek zorlaştı]',
    'Faizler [yüksek|yükselmiş], kredi çekmeden önce [iki kere düşün|hesabını iyi yap]',
    'Bence mülk en sağlam yatırım, [değeri hep artıyor|kira da getiriyor]',
    'Piyasa biraz durgun gibi, [beklemek lazım|herkes temkinli]',
    'Fiyatlar artınca maaşlar da [artıyor ama geç kalıyor|biraz artıyor]',
    'Haberleri takip et, [kararlar bir gün önceden duyuruluyor|faiz kararı önceden açıklanıyor]',
    'Valla ben ekonomiden pek anlamam, [sadece çalışıp biriktiriyorum|işime bakıyorum]',
    'Paranı nakit tutma bence, [bir yere yatır|enflasyon eritiyor]',
    'Herkes bir şey söylüyor, [ben kendi hesabımı yapıyorum|kimseye kulak asmıyorum]',
    'Zor günler ama [geçer bunlar|sabır lazım]',
    '{yer} tarafında [kira artışları çok|fiyatlar uçmuş]'
  ]);

  tanim('cevap.kredi_sorusu', 'notr', [
    'Kredi çekeceksen [taksitleri iyi hesapla|gelirine göre çek]',
    'Bankadan çekebilirsin ama taksitleri aksatırsan icra var, [dikkat|ona göre]',
    'Ben bir kere çektim, [ödemesi biraz zor oldu ama|biraz zorlandım ama] mülk aldım',
    'Faizler yüksek, [mecbur değilsen çekme|gerçekten lazımsa çek]',
    'Borcun varken yatırım yapamıyorsun, [önce onu kapat|bilgin olsun]',
    'Banka ekranından [faizleri görebilirsin|ne kadar çekebileceğini görürsün]',
    '{tutar} çekeceksen [taksit planına iyi bak|aylık ödemeyi hesapla]',
    'Kredi notun iyiyse [daha kolay veriyorlar|şartlar daha iyi]',
    'Kredi mülk için mantıklı [ama tüketim için çekme|, harcamak için değil]'
  ]);

  tanim('cevap.bayram', 'bayram', [
    'Sana da iyi bayramlar[!|, sevdiklerinle güzel geçsin]',
    'Bayramın mübarek olsun {oyuncuAd}',
    'Teşekkürler, [senin de bayramın kutlu olsun|sana da]',
    'Sana da! [Bol tatlılı bir bayram olsun|Ailenle güzel vakit geçir]',
    'İyi bayramlar, [bugün herkes çok cömert|kanalda herkes kutluyor]',
    'Hepimizin bayramı kutlu olsun',
    'Sağ ol, senin de bayramın güzel geçsin',
    'Sana da, nice güzel günlere!',
    'Teşekkürler, sana da kutlu olsun',
    '{konu} kutlu olsun, [sana da|herkese] nice güzel günler',
    'Sağ ol {oyuncuAd}, {konu} sana da kutlu olsun'
  ]);

  tanim('cevap.dert', 'uzgun', [
    'Üzüldüm, [geçmiş olsun|moralini bozma]. [Böyle dönemler oluyor|Herkesin başına geliyor]',
    'Takma kafana, [toparlarsın|bu da geçer]',
    'Ben de geçen ay zarar ettim, [sonra toparladım|ertesi ay düzeldi]',
    'Ne oldu, anlatmak ister misin?',
    'Moralini bozma {oyuncuAd}, [birlikte bir çözüm buluruz|yardım lazımsa yaz]',
    'Param bitti diyorsan bir işe gir, [kurye hemen kazandırıyor|maaşla toparlarsın]',
    'Geçmiş olsun, [biraz ara ver|yarın daha iyi olacak]',
    'Herkes bir yerden düşüp kalktı, [sen de kalkarsın|pes etme]',
    'Hay aksi, [sıkma canını|üzülme], [düzelir|toparlanırsın]',
    'Zor ama [geçecek|sabır]. Bir şey lazımsa söyle',
    'Bazen böyle oluyor, [önemli olan devam etmek|bir sonraki ay telafi edersin]'
  ], ['Giderlerine bir bak, belki kısabileceğin bir şey vardır.', 'Ben de çok kez sıfırdan başladım.']);

  tanim('cevap.kisisel_meslek', 'notr', [
    'Ben {meslek} olarak çalışıyorum',
    '{meslek} [işte|valla], [koşturup duruyorum|fena değil]',
    '{isletme|de} çalışıyorum, {meslek} olarak',
    'Şu an {meslek}, ama [kurs alıp yükselmeyi düşünüyorum|ileride kendi işimi kurmak istiyorum]',
    '{yer} tarafında {meslek} olarak çalışıyorum',
    'Ben mi? {meslek}. Sen ne iş yapıyorsun?',
    'Biraz ondan biraz bundan, [şimdilik idare ediyorum|kendime bir yol çiziyorum]',
    '{meslek} olalı çok olmadı, [alışmaya çalışıyorum|yeni sayılırım]',
    'Şimdilik {meslek} olarak devam, [bakalım nereye gider|memnunum]'
  ]);

  tanim('cevap.kisisel_yer', 'notr', [
    '{yer|den} yazıyorum',
    '{yer|de} oturuyorum, sen?',
    'Ben {yer} tarafındayım',
    '{yer} [benim memleket|benim yerim], sen nerelisin?',
    '{yer|li} sayılırım',
    'Oyunda {yer|de} yaşıyorum, [çok severim oraları|güzel yer]',
    'Buralıyım işte, [sen nerelisin?|sen neredesin?]',
    '{yer}, [bilirsin|duymuşsundur], güzel yerdir',
    'Şu sıralar {yer|de} kalıyorum, [işe yakın|fena değil]'
  ]);

  tanim('cevap.kisisel_ad', 'mutlu', [
    'Ben {ad}, [memnun oldum|tanıştığımıza sevindim]',
    'Adım {ad}. Senin adın ne?',
    '{ad} [derler|diyorlar], sen?',
    '{ad}, profilde yazıyor ya',
    'Ben {ad}, {meslek} olarak çalışıyorum',
    'Ben {ad}, [sen?|seninki ne?]',
    'Herkes bana {ad} der, sen de öyle de',
    'Memnun oldum, ben {ad}'
  ]);

  tanim('cevap.bot_musun', 'gulme', [
    'Haha, ben bu oyunun bir karakteriyim, [ama sohbete her zaman varım|ama muhabbetim iyidir]',
    'Oyunun karakterlerinden biriyim {oyuncuAd}, [işim gücüm burada|burada yaşıyorum diyelim]',
    'Ben oyunun bir karakteriyim, [ama kiramı ben de ödüyorum|ama maaşımı ben de bekliyorum]',
    'Şöyle diyeyim, ben bu oyunun bir karakteriyim. [Ama tavsiyelerim sağlam|Yine de yardım ederim]',
    'Bu dünyanın karakterlerinden biriyim, [seni de aramızda görmek güzel|buranın emektarıyım]',
    'Ben mi? Oyunun bir karakteriyim. [Ama bu şehri iyi bilirim|Ama buraları iyi tanırım]',
    'Haha, yakaladın! Oyunun bir karakteriyim. [Yine de yardım ederim|Ama dostluğumuz baki]',
    'Oyunun bir karakteri olarak söylüyorum, [burada herkes çalışıyor|sohbet etmeyi severim]',
    'Ben bu oyunun karakterlerindenim, [sen gerçek oyuncusun|sen asıl oyuncusun], hoş geldin'
  ]);

  tanim('cevap.iltifat', 'mutlu', [
    'Ay çok sağ ol[!|, utandırdın]',
    'Sen de çok iyisin {oyuncuAd}',
    'Teşekkür ederim, [moral oldu|güne güzel başladım]',
    'Eksik olma, [sen de öylesin|asıl sen iyisin]',
    'Haha sağ ol, [elimizden geldiği kadar|bir bildiğimiz var]',
    'Böyle deyince insanın daha çok çalışası geliyor',
    'Estağfurullah, [sen de çok naziksin|ne demek]',
    'Çok naziksin, [teşekkürler|sağ ol]'
  ]);

  tanim('cevap.hakaret', 'sakin', [
    'Sakin ol, [burada herkes kendi işinde|kimseye kötülüğüm yok]',
    'Tamam, [tartışmaya gerek yok|ben karışmayayım]',
    'Böyle konuşmasak daha iyi olur bence',
    'Herkesin kötü günü olur, [geçer|takmıyorum]',
    'Peki, [sen bilirsin|anlaşamadık galiba]',
    'Kibar olursak daha iyi anlaşırız',
    'Kırıcı olmaya gerek yok, [sorun neyse konuşalım|derdin ne?]',
    'Neyse, ben işime bakayım'
  ]);

  tanim('cevap.saka', 'gulme', [
    'Haha [aynen|çok iyi]',
    'Güldürdün beni',
    'Hahaha [ciddi misin|olmaz böyle bir şey]',
    'Sen de az değilsin ha',
    'Haha [güzel espriydi|komiksin]',
    'Gülmekten [işe geç kalacağım|çayım döküldü]',
    'Bu iyiydi',
    'Hehe, [kanalın neşesi sensin|iyi geldi bu]',
    'Ahahah [olmaz ya|koptum]'
  ]);

  tanim('cevap.yardim', 'mutlu', [
    'Önce bir işe gir, [kurye ya da garson iyi başlangıç|para kazanmaya başla], sonra biriktirip [kurs al|mülk al]',
    'Kariyer sekmesinden meslek seçiyorsun, [kurslarla yükseliyorsun|kademe atladıkça kazancın artıyor]',
    'Para biriktir, sonra kiraya vermek için bir daire al. [Kira düzenli gelir sağlar|Ben öyle başladım]',
    'Her ay barınma ve geçim ödüyorsun, [onu hesaba kat|kenara biraz para ayır]',
    'Günlük görevleri yap, [Kum Saati veriyor|beklemeleri kısaltırsın]',
    'Borçlanmadan ilerle bence, [kredi en son çare|faiz canını yakar]',
    'Takıldığın yeri sor, [bildiğim kadarıyla anlatırım|yardımcı olurum]',
    'Yeni misin? Hoş geldin! [İlk iş bir meslek seç|Önce bir işe gir], gerisi kolay',
    'Sabırlı ol, [bu oyunda acele eden kaybediyor|yavaş yavaş büyüyorsun]',
    'İtibarını koru, [borcunu zamanında öde|maaşları zamanında öde], gerisi gelir',
    'Ev sahibi olursan kira ödemiyorsun, [ilk hedefin bu olsun|bence en iyi başlangıç bu]'
  ], ['Takıldığın yer olursa yine yaz.', 'Ben de ilk günlerde çok zorlanmıştım.']);

  tanim('cevap.zam_istegi', 'notr', [
    'Bu ay [biraz sıkışığız|kasa zayıf], ama [ay sonu bakarız|bir düşüneyim]',
    'Hak ediyorsun aslında, [bir hesap yapayım|ay sonuna bakalım]',
    '{tutar} biraz fazla, [ortada buluşalım mı?|biraz inebilir miyiz?]',
    'Tamam, [önümüzdeki ay|bir dahaki maaşta] düzenleriz',
    'Şu an zor, işler toparlanınca [ilk sen alacaksın|ilk aklıma sen geleceksin]',
    'Çalışmanı görüyorum, [haklısın|emeğin büyük], bakacağım',
    'Ciro artarsa [herkese zam var|seni unutmam]',
    'Peki, [ne kadar düşünüyorsun?|bir rakam söyle]'
  ]);

  tanim('cevap.teklif', 'merak', [
    '{tutar} mı? [Biraz düşük|Az kaldı], [biraz artırır mısın?|biraz daha yukarı çık]',
    '{tutar} olursa [tamam|anlaşırız]',
    'Hmm, {tutar}... [bir düşüneyim|yarına kadar haber veririm]',
    'Teklifin için sağ ol, [biraz düşüneyim|değerlendireceğim]',
    'Olmaz, [o fiyata veremem|bu benim için çok düşük]',
    'Ortada buluşalım, [ne dersin?|olur mu?]',
    'Ciddi misin? [O zaman konuşalım|Tamam, detayları özelden konuşalım]',
    'Son sözün bu mu?',
    '{tutar|e} [razı olabilirim|olur gibi], ama [peşin olsun|bugün halledelim]'
  ]);

  // Anlaşılmayan bir cümleye cevap: içi boş onay YOK; merak eder ya da sohbeti açar.
  tanim('cevap.genel', 'notr', [
    'İlginç, [anlat bakalım|devamı?]',
    'Öyle mi? [Bilmiyordum|Hiç duymamıştım]',
    'Hmm, nasıl yani?',
    'Valla [bilemedim|emin değilim], biraz açar mısın?',
    '[Ne demek istedin|Tam anlayamadım], biraz daha anlatsana',
    'Bu konuda pek bilgim yok açıkçası',
    'Hangi konudan bahsediyorsun?'
  ]);
  // Anlaşılmayan bir SORU
  tanim('cevap.genel_soru', 'notr', [
    'Bilmiyorum valla, [başka biri bilir belki|sorayım bir]',
    'Hangi konuda soruyorsun?',
    '[Tam anlamadım|Anlayamadım], ne demek istedin?',
    'Bunu ben de merak ediyorum açıkçası',
    'Emin değilim, [kariyer ya da banka ekranına bak istersen|biri bilen çıkar elbet]',
    'Onu bilmiyorum, biri cevaplar elbet',
    'İyi soru, [hiç düşünmemiştim|ben de bilmiyorum]'
  ]);
  // Başka birinin GÖRÜŞÜNE katılma (yalnız NPC'ler arası sohbette)
  tanim('cevap.katilim', 'notr', [
    'Haklısın[ aslında|]',
    'Aynen öyle',
    'Doğru diyorsun',
    'Ben de aynı şeyi düşünüyordum',
    'Evet ya, [bu aralar herkes bundan bahsediyor|bence de]',
    'Olabilir tabii',
    'Kesinlikle',
    'Bence de öyle',
    'Valla doğru'
  ]);
  // ---- Sohbet yöneticisi: bağlamlı takip cevapları ----
  // Bir NPC işletmesinde gerçekten açık var: patron değil, başka biri yönlendiriyor
  tanim('cevap.is_firsati_yonlendir', 'is', [
    '{kisi} {meslek} arıyordu, [ona yaz|özelden yaz bence], {tutar} veriyormuş',
    '{yer|de} {kisi|in} {isletmesi} var, {meslek} lazımmış. [Bir sor|Yaz istersen]',
    '{kisi|e} yaz, {isletme} için {meslek} arıyor, maaş {tutar} civarı',
    'Bildiğim kadarıyla {kisi|in} yerinde açık var, {meslek}. {tutar} diyorlardı',
    '{kisi|in} {isletmesi} eleman bakıyordu, {meslek} için. Bir yaz bence',
    '{kisi} geçen gün {meslek} arıyorum demişti, {tutar} veriyormuş',
    '{yer} tarafında {kisi|in} {isletmesi} var, {meslek} lazım dedi'
  ]);
  // Şu an açık iş yok (gerçekten yok)
  tanim('cevap.takip_yok', 'notr', [
    'Şu an [açık|eleman arayan] [göremedim|bilmiyorum] açıkçası, [duyarsam yazarım|biri çıkarsa haber veririm]',
    'Valla şu sıralar herkesin kadrosu dolu gibi. [Kariyer ekranından kurye ya da garson olarak hemen başlayabilirsin|Başlangıç işleriyle başla, sonra bakarsın]',
    'Benim bildiğim bir açık yok şu an, [kusura bakma|ama gözümü açık tutarım]',
    'Yok gibi görünüyor ama [ilan veren olursa kanala yazar|yarın tekrar sor], [bu aralar hareketli|her gün yeni yer açılıyor]',
    'Şu an kimse eleman aramıyor gibi, [ama kanala sık bak|birkaç gün sonra tekrar sor]',
    'Açık iş yok valla şu an, [ben de bakıyordum|herkes dolu]',
    'Bugünlük göremedim, [yarın bir daha bakarız|kanala biri yazarsa haber veririm]'
  ]);
  // Takip: maaş ne kadar (cevap veren patron)
  tanim('cevap.takip_maas', 'is', [
    '{tutar} veriyorum, [ay sonu yatar|her ay düzenli]',
    'Maaş {tutar}, [görevlerini yaparsan tam alırsın|pazarlığa da açığım biraz]',
    'Aylık {tutar}. [Uygun mu sana?|Ne dersin?]',
    'Şimdilik {tutar}, [iyi çalışırsan artar|ilerde zam da olur]',
    '{tutar} veriyoruz, [üstüne prim yok ama düzenli|her ay aksatmadan]',
    'Aylığı {tutar}. [Az mı geldi?|Bence fena değil]',
    '{tutar}, [pazarlık edebiliriz biraz|net rakam bu]'
  ]);
  // Takip: nerede
  tanim('cevap.takip_yer', 'is', [
    '{yer|de}, {isletme}',
    '{yer|de} bizim {isletme}. [Uzak mı sana?|Bilir misin oraları?]',
    'Yerimiz {yer|de}, [merkezi bir yer|ulaşımı kolay]',
    '{yer}. [Gelir misin?|Yakın mı sana?]',
    '{yer|de} oturuyorum, işyeri de orada',
    '{isletme} {yer|de}, [kolay bulursun|herkes bilir]',
    '{yer}, [metroya yakın|ana caddede]'
  ]);
  // Takip: oyuncu "tamam / olur" dedi → patron özelden teklif yolladı
  tanim('cevap.takip_onay', 'sevinc', [
    'Süper, özelden [yazdım|teklifi yolladım], [bak oradan|kabul edersen başlarsın]',
    'Tamamdır, [DM attım|mesaj attım], oradan anlaşalım',
    'Anlaştık o zaman, teklifi özelden gönderdim 👍',
    'Harika, özel mesajına bak, [teklif orada|detaylar orada]',
    'Tamam o zaman, özelden teklif geldi sana, [bak|onayla yeter]',
    'Oldu bu iş, özel mesajlarına bak 👍',
    'Anlaştık, teklif özelde. [Kabul edince başlarsın|Hayırlı olsun şimdiden]'
  ]);
  // Takip: oyuncu vazgeçti
  tanim('cevap.takip_ret', 'notr', [
    'Tamam, sorun değil. [Kolay gelsin|Fikrin değişirse yaz]',
    'Peki, [başka zaman|aklında olsun]',
    'Olsun, [bol şans|bir şey olursa yaz]',
    'Anladım, [sorun değil|kolay gelsin]',
    'Tamamdır, [başka bir şey lazım olursa yaz|şans]',
    'Peki, [aklına yatarsa yazarsın|kapımız açık]',
    'Olur, [iyi günler|bol şans o zaman]'
  ]);
  // Takip: oyuncu "kimse yok mu" diye tekrar sordu ve yeni biri cevap veriyor
  tanim('cevap.takip_tekrar', 'is', [
    'Buradayım buradayım, {kisi} bak: {meslek} lazımmış, {tutar}',
    'Kusura bakma geç gördüm. {isletme} için {meslek} arıyorum, {tutar} veriyorum, ister misin?',
    'Var var, bende {meslek} açığı var, {tutar}. [Yazayım mı?|Ne dersin?]',
    'Ben buradayım! {isletme} için {meslek} arıyorum, {tutar}',
    'Bende var iş, {meslek}. Maaş {tutar}, [ister misin?|yazayım mı?]',
    'Bende {meslek} işi var, {tutar}. [Bakarsan yaz|Düşünürsen yaz]',
    'Geç kaldım pardon, {kisi} değil ama ben {meslek} arıyorum, {tutar}'
  ]);
  // Oyuncu kendi mesleğini söyledi ("ben de garsonum")
  tanim('cevap.ben_de_meslek', 'notr', [
    '[Güzel|Ooo], {meslek} olarak [tecrübeli misin?|ne zamandır çalışıyorsun?]',
    '{meslek} iyi iş, [kolay gelsin|ben de bir ara düşünmüştüm]',
    'Hmm {meslek}, [benim tanıdık arıyordu sanki|bir bakayım biri arıyor muydu]',
    'Ooo {meslek}, [hayırlı işler|kolay gelsin]',
    '{meslek} demek, [nasıl gidiyor bu aralar?|kazancı nasıl?]',
    'Ben de bir ara {meslek} olarak çalışmıştım, [zor iş|fena değildi]',
    '{meslek} olarak arıyorsan [biraz bekle, soracağım|bir bakarım çevreye]'
  ]);
  // Eleman arayan oyuncuya iş arayan NPC: "ben varım"
  tanim('cevap.aday_benim', 'is', [
    'Ben varım! {meslek} olarak {sayi} gündür çalışıyorum',
    'Ben bakıyorum iş, {meslek} olurum. [Maaş ne kadar?|Detay verir misin?]',
    'Benimle ilgilenir misin? {sayi} gün deneyimim var, [başvurdum ilanına|özelden yazdım]',
    'Hala arıyorsan ben varım, [hemen başlayabilirim|yarın başlarım]',
    'Ben varım, ne zaman başlıyoruz?',
    'İlanına bakıyorum, {meslek} olarak [uygunum|hazırım]',
    'Ben ilgileniyorum, [maaş ne kadar?|nerede çalışacağım?]'
  ]);

  tanim('cevap.anlamadim', 'merak', [
    'Tam anlamadım, [biraz açar mısın?|ne demek istedin?]',
    'Pardon, [ne dedin?|kaçırdım]',
    'Hmm, anlayamadım',
    'Neyi kastettin?',
    'Bir daha yazar mısın? [Anlamadım|Kafam karıştı]',
    'Yani?',
    'Kusura bakma, [tam olarak ne soruyorsun?|anlamadım]',
    'Hı? [Anlamadım|Ne dedin?]'
  ]);

  tanim('cevap.tanidik_selam', 'mutlu', [
    '{oyuncuAd} hoş geldin yine!',
    'Oo {oyuncuAd}, [nerelerdesin?|özledik seni]',
    'Selam {oyuncuAd}! [Ne var ne yok?|Nasıl gidiyor işler?]',
    'Bak kim gelmiş! [Hoş geldin {oyuncuAd}|Selam {oyuncuAd}]',
    '{oyuncuAd}! [Görüşmeyeli nasılsın?|Uzun zaman oldu]',
    'Hoş geldin {oyuncuAd}, [geçen konuştuğumuz iş ne oldu?|son durum ne?]',
    'Selam yine, [nasılsın?|hoş geldin]',
    'Oo kimler gelmiş, [hoş geldin|selam]'
  ]);

  tanim('cevap.tavsiye_meslek', 'is', [
    'Bence {meslek} ol, [şu an ortalama|ayda] {tutar} civarı kazandırıyor',
    '{meslek} dene derim, {tutar} gibi bir kazancı var',
    'Senin durumunda {meslek} mantıklı',
    '{meslek} işine bir bak, [çok aranıyor|kapısı açık]',
    'Ben olsam {meslek} olurdum, [ayda {tutar} fena değil|hem de kazancı iyi]',
    '{meslek} hem [kolay|keyifli] hem de {tutar} civarı getiriyor',
    'Şu sıralar {meslek} [iyi para kazandırıyor|en mantıklısı bence]',
    'Önce {kurs} al, sonra {meslek} ol; ayda {tutar} civarı kazandırıyor',
    '{kurs} bitirirsen {meslek} olabilirsin, [değer|bence değer]',
    'Kariyer ekranına bak, [kendine uygun bir meslek seç|maaşlar orada yazıyor]'
  ]);

  tanim('cevap.is_teklif_ediyorum', 'is', [
    'Bizim {isletme} {meslek} arıyor, maaş {tutar}. [İlgilenir misin?|Ne dersin?]',
    'Benim yerde açık var: {meslek}, {tutar}. [Gel konuşalım|Düşünürsen yaz]',
    '{isletme|e} {meslek} lazım, [istersen sen gel|sana uygun olabilir]',
    '{tutar} maaşla {meslek} olarak çalışmak ister misin?',
    'Bak bizde {meslek} arıyoruz, [iş hafif|ortam iyi], maaş {tutar}',
    '{isletme} için eleman arıyorum, [sen olur musun?|aklıma sen geldin]',
    'Bizde bir yer açıldı, [ilgilenirsen yaz|istersen anlatayım]',
    'Hâlâ arıyorsan {isletme|de} {meslek} olarak başlayabilirsin, {tutar} veriyoruz'
  ]);

  // ---------------- KANAL PAYLASIMLARI ----------------
  tanim('paylasim.gunaydin', 'mutlu', [
    'Günaydın [herkese|millet|arkadaşlar]!',
    'Günaydın, [herkese bol kazançlı bir gün|kolay gelsin herkese]',
    'Günaydın [ahali|millet], [çaylar benden|bugün işler iyi gidecek bence]',
    'Hayırlı sabahlar, [herkese kolay gelsin|bereketli bir gün olsun]',
    'Günaydın! [Kahvemi aldım, işe başlıyorum|Erkenden işe çıktım]',
    '{yer|den} günaydın',
    'Günaydın, bugün [yine|] erken başladım',
    'Herkese günaydın, [bugün ne yapıyorsunuz?|planlar ne bugün?]',
    'Günaydın! [Yeni gün yeni para|Yeni bir gün, yeni fırsatlar]',
    'Sabah sabah işteyim, günaydın herkese',
    'Günaydın, [bu sabah trafik bitirdi beni|uyanmak zor oldu bugün]',
    '{yer|den} herkese günaydın, [hava güzel bugün|işler başlasın]'
  ]);

  tanim('paylasim.iyi_aksamlar', 'mutlu', [
    'İyi akşamlar [herkese|millet]',
    'İyi akşamlar, [bugün yoğundu ama bitti|mesai bitti nihayet]',
    'Akşamınız hayırlı olsun',
    'İyi akşamlar, [bugün nasıl geçti herkese?|kim ne yaptı bugün?]',
    'Herkese iyi akşamlar, ben [çay demledim|biraz dinleneceğim]',
    'İyi akşamlar! [Yarın görüşürüz|Yarın erken kalkacağım]',
    '{yer|den} iyi akşamlar',
    'Günü kapattık, iyi akşamlar',
    'İyi akşamlar, [kimse yok mu?|bu akşam kanal sessiz]'
  ]);

  tanim('paylasim.is_degisti', 'sevinc', [
    'Artık {meslek} olarak çalışıyorum[!|, yeni bir başlangıç]',
    'Yeni işime başladım, {meslek} oldum',
    'Bugünden itibaren {meslek} olarak devam ediyorum',
    '{meslek} işine geçtim, [bakalım nasıl olacak|heyecanlıyım]',
    'Sonunda {meslek} oldum, [emeklerim boşa gitmedi|çok sevindim]',
    'İş değiştirdim arkadaşlar, [yeni yerim çok iyi|yeni bir sayfa]',
    'Yeni iş, yeni heyecan! {meslek} olarak ilk günüm',
    '{meslek} olarak başladım, tavsiyesi olan [yazsın|var mı?]',
    'Mesleğimi değiştirdim, [artık daha iyi kazanacağım inşallah|yeni bir dönem başlıyor]'
  ]);

  tanim('paylasim.kurs_basladi', 'mutlu', [
    '{kurs|e} başladım, [heyecanlıyım|bakalım nasıl geçecek]',
    'Bugün {kurs|e} kaydoldum',
    'Sonunda {kurs|e} başlayabildim, [parayı zor biriktirdim|epeydir bekliyordum]',
    '{kurs} başladı, [biraz sürecek|biraz sabır]',
    '{kurs|i} alan var mı? Ben bugün başladım',
    'Kendime yatırım yapıyorum, {kurs|e} başladım',
    'Yeni kursuma başladım, [şans dileyin|bakalım nasıl olacak]',
    '{kurs} için ödemeyi yaptım, başlıyoruz'
  ]);

  tanim('paylasim.kurs_bitti', 'sevinc', [
    '{kurs|i} bitirdim[!|, sertifikam elimde]',
    'Sonunda {kurs} bitti, [artık bir üst kademeye geçebilirim|yeni kapılar açıldı]',
    '{kurs|i} tamamladım, [çok yorucuydu ama değdi|emeklerin karşılığı]',
    'Kursum bitti arkadaşlar, [yeni işe hazırım|kutlama zamanı]',
    'Bugün {kurs} sertifikamı aldım',
    '{kurs} bitti, herkese tavsiye ederim',
    'Kurs bitti, şimdi [iş bakma zamanı|yeni mesleğe geçiş]',
    '{kurs|i} bitirince kendimi bambaşka hissettim, [tavsiye ederim|değer]'
  ]);

  tanim('paylasim.ay_sonu_iyi', 'para', [
    'Bu ay {tutar} biriktirdim[!|, fena değil]',
    'Ay sonu geldi, kasada {tutar} var, [şükür|mutluyum]',
    'Bu ay iyi geçti, {tutar} kâr ettim',
    'Ay sonu hesabı: {tutar} artı, [devam|yolumuza bakıyoruz]',
    'Bu ay [hedefimi tutturdum|beklediğimden iyi geçti]',
    'Ay kapandı, [beklediğimden iyi|güzel bir ay oldu], herkese bol kazançlar',
    '{tutar} kenara koydum bu ay, [yatırım zamanı|bakalım ne alacağım]',
    'Maaş yattı, kiralar geldi, bu ay [keyifliyim|her şey yolunda]',
    'Bu ay da artıda kapattık, [küçük küçük büyüyoruz|devamı gelsin]'
  ]);

  tanim('paylasim.ay_sonu_kotu', 'uzgun', [
    'Bu ay [kötü geçti|pek iyi geçmedi], [ay sonunu zor getirdim|kasa boş]',
    'Ay sonu geldi ama para yok, [kiralar, faturalar derken|giderler bitirdi beni]',
    'Bu ay eksiye düştüm, [toparlarım inşallah|gelecek ay telafi ederim]',
    'Ay sonu hep böyle mi olur ya',
    'Bu ay harcamalar fazla oldu, [kemer sıkma zamanı|biraz tasarruf lazım]',
    '{tutar} zarar ettim bu ay, [moral bozuk|ders oldu]',
    'Bu ay biraz zorlandım ama [pes etmek yok|gelecek ay düzelir]',
    'Ay sonu geldi, cüzdan ağlıyor'
  ]);

  tanim('paylasim.mulk_aldi', 'sevinc', [
    '{yer|de} {mulk} aldım[!|, hayırlı olsun bana]',
    'Sonunda ilk {mulk} sahibi oldum, {yer} tarafında. [Çok mutluyum|Yıllardır hayalimdi]',
    '{yer|den} bir {mulk} aldım, [kiraya vereceğim|kendim kullanacağım]',
    'Yeni mülküm hayırlı olsun bana, [biraz borçlandım ama|uzun zamandır biriktiriyordum]',
    '{mulk} aldım arkadaşlar, [yeri {yer}|{yer} tarafında]',
    'Bugün {yer|de} tapuyu aldım',
    'Mülk sahibi olduk sonunda, [kira derdi bitti|yatırımımı yaptım]',
    '{yer|de} bir {mulk} buldum, [fiyatı da uygundu|kaçırmadım]'
  ]);

  tanim('paylasim.mulk_satti', 'para', [
    '{mulk|i} sattım, [iyi bir fiyata gitti|kârla çıktım]',
    'Mülkü sattım, şimdi [yeni yatırım arıyorum|elimde nakit var]',
    '{mulk|i} {tutar|e} sattım',
    'Sattım gitti, [biraz üzüldüm ama|duygusal oldum ama] doğru karar',
    '{mulk} satıldı, [alıcısı hayrını görsün|yeni sahibine hayırlı olsun]',
    'Satış tamam, [tapu işleri bitti|para hesaba geçti]',
    'Mülkü {tutar|e} sattım, [fena değil|beklediğimden iyi]',
    'Elimdeki {mulk|i} elden çıkardım, [başka işe yatıracağım|biraz nakit lazımdı]'
  ]);

  tanim('paylasim.isletme_acti', 'sevinc', [
    '{isletme} açıldı[!|, herkesi bekleriz]',
    '{yer|de} {isletme|i} açtım, [yolunuz düşerse uğrayın|herkes davetli]',
    'Bugün {isletme} kapılarını açtı, [çok heyecanlıyım|hayırlı olsun bize]',
    'Kendi işimi kurdum arkadaşlar, [yeni bir dönem|patron oldum]',
    '{isletme} hizmetinizde, [{yer} tarafına gelen uğrasın|bekleriz]',
    'Uzun uğraşların sonunda {isletme|i} açtık',
    'Yeni işletmem açıldı, [şans dileyin|herkesi beklerim]',
    '{yer|de} yeni yerimizi açtık, eleman da arıyoruz'
  ]);

  tanim('paylasim.isletme_kapandi', 'uzgun', [
    '{isletme|i} kapatmak zorunda kaldım, [üzgünüm|olmadı bu sefer]',
    'Dükkanı kapattık, [bir dahakine|yeniden başlayacağım]',
    'İşletmeyi kapattım, [giderler çok fazlaydı|ciro yetmedi]',
    '{isletme} artık yok, [ama ders aldım|yeni bir şeye başlayacağım]',
    'Bazen olmuyor işte, kepenk kapattık',
    'Kapattık ama pes etmek yok, [tekrar deneyeceğim|biraz çalışıp geri döneceğim]',
    '{isletme|in} kapısına kilit vurduk, emeği geçen herkese teşekkürler'
  ]);

  tanim('paylasim.eleman_ariyor', 'is', [
    '{isletme|e} {meslek} arıyoruz, maaş {tutar}. İlgilenen yazsın',
    '{yer|de} {meslek} arıyorum, [özelden yazın|DM atın]',
    'Eleman arıyoruz! {meslek}, {tutar}, [yer {yer}|{yer} tarafı]',
    '{isletme} için {meslek} lazım, [tecrübe şart değil|hemen başlayabilir]',
    'Acil {meslek} aranıyor, {tutar} veriyoruz',
    '{yer} tarafında çalışacak {meslek} arıyorum, [maaş {tutar}|maaş iyi]',
    'Ekibimize katılmak isteyen var mı? [{meslek} arıyoruz|Eleman lazım]',
    'Eleman arıyoruz, [maaşlar zamanında|ortam güzel], yazın',
    '{isletme} {meslek} alacak, {tutar} maaş, [özelden yazın|başvurular açık]'
  ]);

  tanim('paylasim.is_ariyor', 'is', [
    '{meslek} olarak iş arıyorum, [bilen var mı?|elinde iş olan yazsın]',
    'İş arıyorum arkadaşlar, [ne iş olsa yaparım|her işe açığım]',
    'Tecrübeli {meslek} arayan var mı? [Hemen başlarım|Müsaitim]',
    '{meslek} işi olan varsa [özelden yazsın|bana yazsın]',
    'Boşa çıktım, iş bakıyorum. [Önerisi olan?|Bilen var mı?]',
    'Çalışacak yer arıyorum, [{meslek} olarak|her işe] hazırım',
    'Yeni bir iş arıyorum, [maaşı düzenli olsun yeter|ciddi teklifler]',
    '{meslek} arayan işletme var mı? Ben buradayım'
  ]);

  tanim('paylasim.satilik', 'para', [
    '{yer|de} satılık {mulk}, {tutar}. İlgilenen yazsın',
    'Satılık {mulk} var, [{yer} tarafında|yeri {yer}], {tutar}',
    '{mulk|i} satıyorum, {tutar}, [pazarlık payı var|son fiyat]',
    'Acil satılık {mulk}! [Fiyatı {tutar}|{tutar} istiyorum], [özelden yazın|DM]',
    '{yer|de} {mulk} elden çıkarıyorum, [uygun fiyat|fiyatı {tutar}]',
    'Satılık mülküm var, [ilgilenen özelden yazsın|bakmak isteyen yazsın]',
    '{yer} merkezde {mulk}, {tutar}, [kiracılı|boş]',
    '{tutar|e} {mulk}, {yer|de}. Kaçırmayın'
  ]);

  tanim('paylasim.ekonomi_zam', 'uzgun', [
    'Her şeye [yine|] zam gelmiş, [maaşlar yetmiyor|nereye gidiyoruz böyle]',
    'Market fiyatları [uçmuş|ateş pahası] arkadaşlar',
    'Kiralar yine arttı, [geçinmek zorlaştı|ev sahipleri yine mutlu]',
    'Fiyatlar her gün artıyor, [tasarruf zamanı|paranızı koruyun]',
    'Sabah çaya simide bile zam gelmiş',
    'Enflasyon [yine|] canımızı yakıyor',
    'Geçen ay aldığım şey bu ay daha pahalı, [inanılır gibi değil|hayırdır]',
    'Zamlar bitmiyor, maaşa da zam lazım artık',
    'Benzine de zam gelmiş, [kuryeler yandı|nakliyeciler yandı]'
  ]);

  tanim('paylasim.ekonomi_genel', 'notr', [
    'Faiz kararı ne olacak sizce?',
    'Piyasa bugün [sakin|hareketli] gibi',
    'Mülk fiyatları [yükselişte|epey arttı], [alacaksanız acele edin|beklemek mantıklı mı?]',
    'Bence şu an nakit tutmanın anlamı yok, [yatırım şart|bir yere yatırın]',
    'Haberlerde yeni ekonomi kararları var, [takip edin|okudunuz mu?]',
    'Ekonomi [toparlanıyor gibi|biraz durgun], siz ne düşünüyorsunuz?',
    'Kredi faizleri [düştü mü|arttı mı] bilen var mı?',
    'Bu ay piyasada [para dönüyor|hareket var], işletmeler iyi kazanıyor',
    'Yatırım için [en iyi zaman şimdi|ne önerirsiniz?]'
  ]);

  tanim('paylasim.bayram', 'bayram', [
    'Herkesin {konu} kutlu olsun!',
    '{konu} kutlu olsun[!|, sevdiklerinizle güzel geçsin]',
    'İyi bayramlar herkese[!|, bol tatlılı günler]',
    '{konu|i} kutlarım, [nice bayramlara|nice güzel bayramlara]',
    'Bayramınız mübarek olsun, [herkese sağlıklı günler|ailenizle güzel vakit geçirin]',
    'Bugün bayram, [dükkanı erken kapattım|herkese tatlı ikram ediyorum]',
    'Hayırlı bayramlar arkadaşlar, [küsler barışsın|herkese huzur dolu günler]',
    '{konu} vesilesiyle herkese [mutluluklar|huzurlu günler] dilerim',
    'Bayram sabahı herkese günaydın, iyi bayramlar'
  ]);

  tanim('paylasim.ozel_gun', 'bayram', [
    '{konu} kutlu olsun!',
    'Herkesin {konu|i} kutlarım',
    'Mutlu {konu}, [herkese güzel bir gün|nice yıllara]',
    '{konu} için herkese [en güzel dileklerimi gönderiyorum|iyi dileklerimle]',
    'Bugün {konu}, [dükkanı süsledik|bizde herkese ikram var]',
    '{konu} coşkusu her yerde, [kutlu olsun|herkese iyi eğlenceler]',
    'Özel bir gün bugün, herkese [kutlu olsun|güzel bir gün dilerim]',
    '{konu} vesilesiyle bugün [biraz bağış yaptım|herkese ikramımız var]'
  ]);

  tanim('paylasim.motivasyon', 'sevinc', [
    'Pes etmek yok arkadaşlar, [azar azar büyüyoruz|her gün biraz daha]',
    'Bugün biraz çalışırsan yarın rahat edersin',
    'Herkes sıfırdan başladı, [sabredin|çalışan kazanıyor]',
    'Küçük adımlar büyük servet yapar',
    'Kimse bir günde zengin olmadı, [devam|sabır]',
    'Borcunu zamanında öde, itibarını koru, [gerisi gelir|kapılar açılır]',
    'Bugün de çalışıyoruz, [hadi bakalım|kolay gelsin herkese]',
    'Damlaya damlaya göl olur arkadaşlar',
    'Zor günler geçer, [emek kalır|çalışan kazanır]',
    'Hedefim bu ay kendi işimi açmak, [inşallah olur|bakalım]',
    '[Ekip iyi olunca|Çalışanın iyi olunca] her şey kolaylaşıyor [valla|]'
  ]);

  tanim('paylasim.soru', 'merak', [
    '{kurs|i} alan var mı? [Nasıl, değer mi?|Tavsiye eder misiniz?]',
    '{yer|de} kiralar ne durumda, bilen var mı?',
    '{meslek} olarak çalışan var mı? [Kazanç nasıl?|Memnun musunuz?]',
    'Kredi çeken var mı, [faiz ne kadar?|nasıl buldunuz?]',
    'İlk mülk için nereyi önerirsiniz?',
    'Kum Saati\'ni nerede kullanmak mantıklı?',
    'Kademe atlamak için ne kadar deneyim lazım, bilen?',
    '{mulk} almak mı mantıklı kiralamak mı?',
    'Arkadaşlar işletme açmak için hangi semt iyi?',
    'Bu ay maaşlar yattı mı herkese?',
    'Eleman arayan var mı bu aralar?',
    'Siz paranızı nerede değerlendiriyorsunuz?'
  ]);

  tanim('paylasim.gorev_bitti', 'yorgun', [
    'Bugünkü {gorevIs} bitti, [yorgunum ama mutluyum|eve gidiyorum]',
    '{meslek} olarak bugünkü görevlerimi bitirdim',
    'Mesai bitti, [çay zamanı|ayaklarım ağrıyor]',
    'Bugün de bitti, [iyi kazandım|fena değildi]',
    '{gorevIs} tamam, [yarın yine|şimdi biraz dinlenme]',
    'Görevleri bitirdim, [Kum Saati\'mi aldım|ödül de geldi]',
    'Bugünlük bu kadar, [herkese kolay gelsin|ben çıkıyorum]'
  ]);

  tanim('paylasim.yorgun', 'yorgun', [
    'Çok yoruldum bugün',
    'Bugün [ayaklarım koptu|belim tutuldu], [erken yatacağım|biraz dinleneceğim]',
    'Yorgunluktan gözlerim kapanıyor',
    'Bu tempoya [dayanamıyorum|zor dayanıyorum] ama devam',
    'Bugün çok yoğundu, [biraz mola|bir çay içip kendime geleyim]',
    'Hafta bitse de dinlensek',
    'Yorgunum ama [para lazım|ay sonu yaklaşıyor], çalışmaya devam',
    'Bütün gün koşturdum, [şimdi oturuyorum|bitti mi bugün?]',
    '{meslek} olmak kolay değil, [bugün çok yoruldum|bugün beni bitirdi]'
  ]);

  tanim('paylasim.kredi_cekti', 'notr', [
    'Kredi çektim, [inşallah çabuk kapatırım|bakalım hayırlısı]',
    '{tutar} kredi çektim, [mülk alacağım|işletmeye yatıracağım]',
    'Bankadan kredim onaylandı, [yatırım zamanı|heyecanlıyım]',
    'Krediyle {mulk} aldım, [taksitler başlıyor|borç da olsa benim]',
    'Kredi çektim ama [faizler biraz yüksek|dikkatli ödeyeceğim]',
    'İlk kredimi çektim, kredi notum [iyiymiş|fena değilmiş]',
    'Borçlandım ama [doğru yatırım bence|uzun vadede kazanacağım]'
  ]);

  tanim('paylasim.bagis', 'mutlu', [
    'Bugün mahalleye {tutar} bağış yaptım, [paylaşmak güzel|hayırlı olsun]',
    'Okul yapımına {tutar} bağışladım',
    'Kazandıkça paylaşmak lazım, [bugün biraz bağış yaptım|bir çeşmeye katkı verdim]',
    '{tutar} bağış yaptım, [herkesi davet ediyorum|siz de katılın]',
    'Hayır işine katkım olsun, [bağış yaptım|bugün bir vakfa destek oldum]',
    'Bağış yapmanın verdiği huzur başka',
    '{yer} için bağış kampanyasına katıldım',
    'Mahallemize bir çeşme yaptırdık, [herkese hayırlı olsun|emeği geçenlere teşekkürler]'
  ]);

  tanim('paylasim.zengin_oldu', 'sevinc', [
    'Servetim ilk kez {tutar} geçti[!|, inanamıyorum]',
    'Sıfırdan başladım, şimdi {tutar} servetim var',
    'Sıralamaya girdim arkadaşlar, [emekler boşa gitmedi|çok mutluyum]',
    'Bir zamanlar kuryeydim, şimdi patronum',
    'Hedefime ulaştım, [yeni hedef daha büyük|şimdi yeni yatırımlar]',
    'Bu oyunda sabredenler kazanıyor, [ben de sabrettim|kanıtı benim]',
    'Bugün servetim {tutar} oldu, [herkese teşekkürler|çalışanlarıma teşekkür ederim]',
    'Zirveye bir adım daha yaklaştım'
  ]);

  tanim('paylasim.sirket_ici', 'is', [
    'Arkadaşlar bugün [yoğun|kalabalık] olacak, [hazır olun|herkes yerinde olsun]',
    'Bu hafta ciro iyi, [herkesin emeğine sağlık|devam böyle]',
    'Vardiya düzenini [güncelledim|kontrol edin]',
    'Maaşlar yattı, [kontrol edin|bir sorun varsa yazın]',
    '{isletme} için yeni müşteriler geliyor, [hizmet kalitesi önemli|güler yüz şart]',
    'Yarın erken açıyoruz, [unutmayın|herkes vaktinde gelsin]',
    'Bugünkü hedefi tutturduk, [eline sağlık ekip|süpersiniz]',
    'Malzeme azaldı, [sipariş verelim|yarın tamamlarım]',
    'Müşteriler çok memnun, [teşekkürler ekip|böyle devam]',
    'Toplantı yok bugün, herkes işine baksın',
    '{kisi} bugün izinli, [işleri paylaşalım|ona göre ayarlayalım]',
    'Kasa sayımı tamam, [her şey yolunda|eksik yok]'
  ]);

  tanim('paylasim.npc_cevap', 'notr', [
    '{kisi} [haklısın|doğru diyorsun]',
    '@{kisi} aynen öyle',
    '{kisi} bence de',
    '{kisi} ben de aynısını yaşadım',
    '{kisi} kolay gelsin',
    '{kisi} katılıyorum, [bu aralar herkes öyle|aynı fikirdeyim]',
    '{kisi} [bende de aynı|ben de aynısını düşündüm]',
    '{kisi} geçen gün bunu konuşmuştuk',
    'Aynen öyle',
    'Bence de'
  ]);

  // ---------------- OZEL MESAJLAR ----------------
  tanim('dm.zam_istegi', 'notr', [
    'Patron merhaba, [bir şey konuşabilir miyiz?|müsait misin?] Maaşı biraz konuşmak istiyordum',
    'Selam, epeydir burada çalışıyorum, [bir zam düşünür müsün?|maaşımda bir düzenleme mümkün mü?]',
    'Bu aralar her şey çok pahalandı, maaşı {tutar} yapabilir misin?',
    'Patron, {tutar} olursa [çok rahatlarım|daha da motive olurum]',
    'Merhaba, [çalışmamdan memnunsan|işlerimi aksatmıyorum], küçük bir zam rica ediyorum',
    'Kira arttı, [maaş yetmiyor|geçinmek zorlaştı], zam mümkün mü?',
    'Bir zam olsa [fena olmaz|çok iyi olur] açıkçası, {tutar} düşünüyordum',
    'Patron, başka yerler {tutar} veriyor [ama ben burayı seviyorum|ama ben burada kalmak istiyorum]'
  ]);

  tanim('dm.zam_tesekkur', 'tesekkur', [
    'Zam için çok teşekkür ederim[!|, emeğimi gördüğün için]',
    'Çok sağ ol patron, [daha da iyi çalışacağım|beni çok mutlu ettin]',
    'Zammı gördüm, [eksik olma|ellerine sağlık]',
    'Teşekkürler, bu ay [nefes aldım|rahatladım]',
    'Patron sen bir harikasın, [söz, işleri aksatmayacağım|hakkını ödeyemem]',
    'Zam yatmış, teşekkür ederim, [mahcup etmeyeceğim|kendimi değerli hissettim]',
    'Çok sağ ol {oyuncuAd}, [unutmayacağım|bunu hak etmek için çalışacağım]'
  ]);

  tanim('dm.maas_dusurme_tepki', 'uzgun', [
    'Maaşım düşmüş, [bir sorun mu var?|neden böyle oldu?]',
    'Patron, maaşımı düşürmüşsün, [açıkçası çok üzüldüm|bunu konuşabilir miyiz?]',
    'Böyle olunca [motivasyonum düştü|biraz kırıldım], umarım geçicidir',
    'Maaş azalınca geçinmek zor, [tekrar düşünür müsün?|bir çare bulalım]',
    'Anladım, işler kötü galiba. [Ama ben de zor durumdayım|Umarım düzelir]',
    'Bu maaşla [uzun süre devam edemem|başka iş bakmak zorunda kalabilirim]',
    'Haber vermeden düşürmen [hoş olmadı|beni şaşırttı]',
    'Peki, [şimdilik idare ederim|anlıyorum] ama ileride düzelirse sevinirim'
  ]);

  tanim('dm.istifa', 'uzgun', [
    'Patron, [istifa etmek istiyorum|ayrılmaya karar verdim]. {gun} sonra son günüm olacak',
    'Merhaba, başka bir yerden teklif aldım, {gun} içinde ayrılıyorum',
    'Üzgünüm ama ayrılıyorum, [her şey için teşekkürler|burada çok şey öğrendim]',
    'İstifamı veriyorum, [kırgınlık yok|kişisel sebeplerden]. {gun} daha çalışırım',
    'Patron, artık devam edemeyeceğim, [kusura bakma|anlayış göstereceğini biliyorum]',
    'Kendi işimi kuracağım, o yüzden [ayrılıyorum|istifa ediyorum]. Her şey için teşekkürler',
    'Haber vermek istedim, {gun} sonra ayrılıyorum, [yerime biri bulunana kadar yardım ederim|devir teslim yaparım]'
  ]);

  tanim('dm.is_teklifi', 'is', [
    'Merhaba, {isletme} için {meslek} arıyoruz, {tutar} maaş. [İlgilenir misin?|Ne dersin?]',
    'Selam, kanalda iş aradığını gördüm. Bizde {meslek} pozisyonu var, {tutar}',
    '{isletme|e} gel, {meslek} olarak {tutar} veririm',
    'Senin gibi birine ihtiyacımız var: {meslek}, {tutar}, [hemen başlayabilirsin|saatler esnek]',
    'Merhaba, iş arıyorsan {isletme|de} yer var. [Konuşalım mı?|Detayları yazayım mı?]',
    'Bizde çalışmak ister misin? Maaş {tutar}, [ortam iyi|maaşlar hep zamanında]',
    'Selam {oyuncuAd}, {meslek} olarak çalışmak ister misin? [Teklifim {tutar}|{tutar} veririm]'
  ]);

  tanim('dm.mulk_teklifi', 'para', [
    'Merhaba, {mulk} için {tutar} teklif ediyorum',
    'Selam, ilanını gördüm. {mulk} için {tutar} veririm',
    '{tutar} nakit, [hemen alırım|bugün öderim]. {mulk} hâlâ satılık mı?',
    'Mülkün için {tutar} düşünüyorum, [olur mu?|ne dersin?]',
    '{mulk} ilgimi çekti, {tutar|e} anlaşır mıyız?',
    'Merhaba, {mulk|i} satıyor musun? [Ciddi alıcıyım|Nakit hazır]',
    'Son teklifim {tutar}, [kabul edersen yarın tapuya gidelim|olursa haber ver]'
  ]);

  tanim('dm.mulk_teklif_kabul', 'sevinc', [
    'Tamam, anlaştık[!|, hayırlı olsun]',
    'Kabul ediyorum, [hayırlı olsun|güle güle kullan]',
    'Olur, bu fiyata razıyım',
    'Anlaştık, [işlemleri başlatalım|tapuda görüşürüz]',
    'Tamamdır, {tutar|e} veriyorum, hayırlı olsun',
    'Sana hayır diyemedim, [kabul|tamam], hayrını gör',
    'Teklifin makul, kabul ediyorum'
  ]);

  tanim('dm.mulk_teklif_red', 'sakin', [
    'Kusura bakma, [o fiyata veremem|bu teklif düşük]',
    'Teşekkürler ama [biraz düşük kaldı|olmaz bu fiyata]',
    'Maalesef kabul edemem, [biraz daha artırırsan konuşuruz|daha iyi teklif var]',
    '{tutar} olmaz, [biraz daha çık|en azından biraz daha lazım]',
    'Şimdilik satmaktan vazgeçtim, [kusura bakma|belki ileride]',
    'Yok, [bu fiyata olmaz|vermem], ama teşekkürler',
    'Teklifin için sağ ol ama [kabul edemiyorum|anlaşamadık]'
  ]);

  tanim('dm.yetki_verildi', 'tesekkur', [
    '{konu} yetkisi için çok teşekkürler[!|, güvenini boşa çıkarmayacağım]',
    'Bana güvendiğin için sağ ol, {konu} işini [en iyi şekilde yapacağım|dikkatle takip edeceğim]',
    'Yetkiyi aldım, [merak etme|her şey kontrolümde]',
    'Tamam patron, {konu} artık bende',
    'Teşekkürler, [seni mahcup etmeyeceğim|elimden geleni yapacağım]',
    'Yetki için sağ ol, [sana düzenli rapor veririm|haftalık bilgi veririm]',
    'Bu güven benim için çok değerli, [sözüm söz|işleri aksatmam]',
    '{konu} konusunu bana bıraktığın için teşekkürler, [rahat ol|gözün arkada kalmasın]'
  ]);

  tanim('dm.yetki_red', 'sakin', [
    'Anladım, {konu} konusunda [şimdilik sen karar ver|sana güveniyorum]',
    'Tamam, [sorun değil|anlıyorum], belki ileride',
    'Peki, [kendimi kanıtlamaya devam edeceğim|daha çok çalışırım]',
    'Olsun, [zamanı gelince|hazır olduğumda] tekrar konuşuruz',
    'Biraz üzüldüm ama [haklısın|anlıyorum]',
    '{konu} senin kararın, saygı duyarım',
    'Anlıyorum patron, [önce biraz daha deneyim kazanayım|biraz daha çalışayım o zaman]',
    'Peki, ama [ileride tekrar sorarım|aklında olsun], hazırım'
  ]);

  // Oyuncu bir NPC'yi işe aldı: NPC patronuna yazar (işe giren kişinin ağzından)
  tanim('dm.ise_basladim', 'sevinc', [
    'Beni seçtiğiniz için teşekkürler, [yarın sabah oradayım|elimden geleni yapacağım]',
    'Teşekkür ederim {oyuncuAd}, [işe başlamak için sabırsızlanıyorum|güvenini boşa çıkarmayacağım]',
    'Çok sevindim, [teşekkürler|sağ olun]! {isletme} için [elimden geleni yapacağım|çalışmaya hazırım]',
    'Haberi aldım, [çok mutlu oldum|harika]. [Ne zaman başlıyorum?|Yarın görüşürüz]',
    'Teşekkürler, [ilk gün|hemen] işe koyuluyorum 💪',
    'Bu fırsat için sağ ol, [pişman olmayacaksın|söz, iyi çalışacağım]',
    'Merhaba {oyuncuAd}, işe alındığımı gördüm. [Teşekkürler|Çok teşekkür ederim], [bir şey lazım olursa yazarım|kolay gelsin bize]',
    'Harika haber! [Ekibe katıldığım için mutluyum|Sabırsızlıkla başlıyorum]'
  ]);

  tanim('dm.basvuru_kabul', 'sevinc', [
    'Başvurunu kabul ettim, [hoş geldin aramıza|yarın başlayabilirsin]',
    'Tebrikler, işe alındın[!|, ekibe hoş geldin]',
    'Seni ekibimizde görmek güzel, [hemen başlayalım|kolay gelsin]',
    'Başvurun olumlu, {isletme} ailesine hoş geldin',
    'Tamamdır, [seni aldık|işe başlıyorsun], maaşlar ay sonu yatıyor',
    'Hoş geldin {oyuncuAd}, [bir sorun olursa bana yaz|ilk gün kolay gelsin]',
    'Seninle çalışacağımız için memnunum, [başarılar|hadi bakalım]'
  ]);

  tanim('dm.basvuru_pazarlik', 'merak', [
    'Başvurunu gördüm ama {tutar} verebilirim, [olur mu?|ne dersin?]',
    'İstediğin maaş biraz yüksek, {tutar} desem?',
    '{tutar} ile başlayalım, [iyi gidersen artırırız|ileride zam yaparız]',
    'Seni almak istiyorum ama bütçem {tutar}, [anlaşabilir miyiz?|uygun mu?]',
    'Başvurun güzel, maaşta biraz anlaşmamız lazım. [Ne kadar düşünüyorsun?|Ortada buluşalım mı?]',
    '{tutar} son teklifim, [kabul edersen yarın başla|düşün, bana yaz]',
    'Maaş konusunda biraz esneyebilir misin? [Ben {tutar} diyorum|Benim sınırım {tutar}]',
    'İlk ay {tutar} ile başlarsan [sonra konuşuruz|performansa göre artırırım]'
  ]);

  tanim('dm.basvuru_red', 'sakin', [
    'Başvurun için teşekkürler [ama şu an pozisyon doldu|ama başka birini aldık]',
    'Kusura bakma, [şimdilik alım yapmıyoruz|kadromuz doldu]',
    'Maalesef bu sefer olmadı, [ileride tekrar dene|bir dahaki ilanda beklerim]',
    'Başvurunu değerlendirdik ama [biraz daha deneyim lazım|kademen bu iş için uygun değil]',
    'Üzgünüm, [olmadı|şimdilik olumsuz], ama başka bir yer mutlaka çıkar',
    'İlgin için teşekkürler, [ama bu sefer anlaşamadık|ama şimdilik olmayacak]',
    'Şu an bütçemiz yeni birine yetmiyor, [kusura bakma|ileride yazarım]',
    'Bu pozisyon için başka birini seçtik, [başarılar dilerim|bol şans]'
  ]);

  tanim('dm.isten_cikarildi', 'uzgun', [
    'Anladım, [bir hatam olduysa kusura bakma|her şey için teşekkürler]',
    'İşten çıkarıldığımı gördüm, [biraz üzüldüm|beklemiyordum açıkçası]',
    'Peki, [hakkını helal et|helalleşelim]. Yeni bir iş bakarım',
    'Bu haber kötü geldi ama [anlıyorum|saygı duyuyorum]',
    'Nedenini söylersen [kendimi geliştiririm|ders alırım]',
    'Tamam patron, [birlikte çalışmak güzeldi|her şey için sağ ol]',
    'Olsun, [bir kapı kapanır, başkası açılır|yolumuz açık olsun]'
  ]);

  tanim('dm.calisan_rapor', 'is', [
    'Patron, bugün [işler yoğundu|müşteri çoktu], her şey yolunda',
    'Bugünkü işleri bitirdim, [bir sorun yok|kasa tamam]',
    'Malzeme azaldı, [sipariş verelim mi?|yarın alalım mı?]',
    'Müşteriler [memnun|çok memnun], haberin olsun',
    'Bugün biraz sakin geçti ama [yarın kalabalık olur|hafta sonu iyi olur]',
    'Patron, {kisi} bugün gelmedi, [ben idare ettim|işleri paylaştık]',
    '{isletme|de} her şey kontrol altında',
    'Bu hafta ciro [iyi gidiyor|geçen haftadan iyi]',
    'Bir şey lazım olursa buradayım, işler yolunda',
    'Bugün {tutar} ciro yaptık'
  ]);

  tanim('dm.cevap_genel', 'notr', [
    'Tamam, [anladım|not aldım]',
    'Olur, [hallederim|bakarım]',
    'Haklısın, [öyle yapalım|mantıklı]',
    'Sonra konuşalım mı? [Şu an biraz meşgulüm|İşteyim de]',
    'Peki, [haberleşiriz|döneceğim sana]',
    'Tamamdır',
    'Mesajını gördüm, [birazdan dönerim|bakıyorum]',
    'Anlaştık o zaman',
    'Hmm, [bir düşüneyim|bakalım]'
  ]);

  // ---------------- DONUS RAPORU (hep yuz gulduren ton) ----------------
  tanim('rapor.kar', 'sevinc', [
    'Hoş geldin patron! Sen yokken {gun} boyunca işleri idare ettik, {tutar} kâr çıktı. Az ama olsun, ben senin kadar iyi yönetemiyorum',
    'Döndün mü sonunda! {gun} içinde {tutar} kâr ettik. [Senin kadar iyi değilim ama elimden geleni yaptım|Sen olsan daha fazlası olurdu]',
    'Patron özledik seni! Sen yokken %{sayi} kâr ettik, az ama olsun. Ben senin kadar iyi yönetemiyorum',
    'Hoş geldin! İşler yolunda, {tutar} kâr var. [Ama sen olunca işler başka|Gerisini sana bırakıyorum]',
    'Sen yokken dükkanı ayakta tuttuk, {tutar} artıdayız. [Ekip çok çalıştı|Herkes elinden geleni yaptı]',
    'Patron geldin mi! {gun} oldu, merak ettik. Kasada {tutar} kâr var, [fena değil değil mi?|umarım beğenirsin]',
    'Hoş geldin, sen yokken kâr ettik ama müşteriler hep seni sordu',
    'Yokluğunda {tutar} kâr çıkardık, [küçük bir başarı ama bizim için büyük|ekip adına gurur duyuyorum]. Hoş geldin!'
  ]);

  tanim('rapor.zarar', 'ozur', [
    'Hoş geldin patron. Sen yokken biraz zarar ettik, {tutar} kadar. Lütfen bizi bir daha bu kadar bırakma',
    'Döndüğüne çok sevindim! {gun} içinde işler biraz bozuldu, {tutar} zarar var. [Sensiz olmuyor|Senin dokunuşun lazım]',
    'Patron özledik, sen yokken [işler pek iyi gitmedi|ciro düştü]. Ama sen geldin ya, toparlarız',
    'Hoş geldin! Biraz zarar ettik ama [ekip moralini bozmadı|herkes yerinde]. Bir daha bu kadar uzun gitme olur mu?',
    '{tutar} eksideyiz, kusura bakma. [Elimden geleni yaptım ama senin kadar iyi yönetemiyorum|Sen olmayınca işler karıştı]',
    'Sonunda geldin! {gun} boyunca seni bekledik, biraz zarar var ama [kolayca toparlanır|sen olunca düzelir]',
    'Hoş geldin patron, kasada biraz açık var ama [sen dönünce her şey düzelir|sen varsan sorun yok]'
  ]);

  tanim('rapor.calisan', 'mutlu', [
    '{kisi} sen yokken her gün işe geldi, maaşı da zamanında yattı',
    '{kisi} çok çalıştı, [bir teşekkür etsen sevinir|bir aferini hak ediyor]',
    'Sen yokken herkesin maaşı yattı, [kimse mağdur olmadı|ekip mutlu]',
    '{kisi} {gun} boyunca işleri aksatmadı, [haberin olsun|gerçekten iyi çalışan]',
    'Çalışanların maaşları zamanında yattı, toplam {tutar} ödedik',
    '{kisi} seni sordu, [özlemiş|bir zam umuyor galiba]',
    'Ekipte herkes yerinde, [kimse ayrılmadı|moraller iyi]'
  ]);

  // ---------------- YABANCI OYUNCULAR (global kanal) ----------------
  tanim('global.en.selam', 'mutlu', [
    '[Hi|Hello|Hey] everyone[!|, how is it going?]', 'Good morning all', 'Hey guys, what\'s up?', 'Hello from {yer}!',
    'Hi! New here, nice to meet you all', 'Hey there, hope you\'re all doing well', 'Anyone online?', 'Hi all, have a great day',
    'Evening everyone'
  ]);
  tanim('global.en.paylasim', 'notr', [
    'Just bought my first apartment!', 'Anyone hiring couriers?', 'Rent went up again, ugh', 'Finally finished my course!',
    'Working hard today, good luck everyone', 'Prices are crazy lately', 'Saved {tutar} this month!',
    'Opened my own café today, come visit!', 'Any tips for a new player?', 'Long day at work, time to rest',
    'Interest rates are high right now, careful with loans'
  ]);
  tanim('global.en.cevap', 'mutlu', [
    'Thanks!', 'Haha nice', 'Good luck!', 'Same here', 'I agree', 'Sorry, my Turkish isn\'t great', 'Sounds good',
    'No idea, sorry', 'That\'s great, congrats!', 'Hello! How are you?', 'Take care!'
  ]);
  tanim('global.de.selam', 'mutlu', [
    'Hallo zusammen!', 'Hi, wie geht\'s euch?', 'Guten Morgen!', 'Grüße aus {yer}!', 'Moin moin!', 'Hallo, ich bin neu hier',
    'Guten Abend allerseits', 'Hey Leute, was geht?'
  ]);
  tanim('global.de.paylasim', 'notr', [
    'Endlich meine erste Wohnung gekauft!', 'Sucht jemand einen Kurier?', 'Die Miete ist schon wieder gestiegen', 'Kurs geschafft!',
    'Heute viel gearbeitet, jetzt Feierabend', 'Alles wird teurer...', 'Diesen Monat {tutar} gespart!',
    'Mein Café ist jetzt offen, kommt vorbei!', 'Hat jemand Tipps für Anfänger?'
  ]);
  tanim('global.de.cevap', 'mutlu', [
    'Danke!', 'Haha, gut', 'Viel Glück!', 'Stimmt', 'Sehe ich auch so', 'Sorry, mein Türkisch ist nicht so gut', 'Klingt gut',
    'Keine Ahnung, sorry', 'Glückwunsch!', 'Mach\'s gut!'
  ]);
  tanim('global.es.selam', 'mutlu', [
    '¡Hola a todos!', '¡Buenos días!', 'Hola, ¿qué tal?', '¡Saludos desde {yer}!', 'Hola, soy nuevo por aquí', '¡Buenas tardes!',
    '¿Qué tal, gente?', 'Hola amigos'
  ]);
  tanim('global.es.paylasim', 'notr', [
    '¡Por fin compré mi primer piso!', '¿Alguien busca repartidor?', 'El alquiler subió otra vez', '¡Terminé mi curso!',
    'Mucho trabajo hoy, ahora a descansar', 'Todo está más caro...', '¡Este mes ahorré {tutar}!', 'Abrí mi cafetería, ¡vengan!',
    '¿Algún consejo para novatos?'
  ]);
  tanim('global.es.cevap', 'mutlu', [
    '¡Gracias!', 'Jaja, buenísimo', '¡Suerte!', 'Yo también', 'Estoy de acuerdo', 'Perdón, mi turco no es muy bueno',
    'Suena bien', 'Ni idea, perdón', '¡Felicidades!', '¡Cuídate!'
  ]);
  tanim('global.az.selam', 'mutlu', [
    'Salam hamıya!', 'Salam, necəsiniz?', 'Sabahınız xeyir!', 'Hamıya {yer} şəhərindən salam!', 'Salam dostlar, nə var nə yox?',
    'Axşamınız xeyir', 'Salam, mən burada yeniyəm', 'Hamıya uğurlar!'
  ]);
  tanim('global.az.paylasim', 'notr', [
    'Nəhayət ilk mənzilimi aldım!', 'Kuryer axtaran var?', 'Kirayə yenə bahalaşıb', 'Kursu bitirdim!',
    'Bu gün çox işlədim, yoruldum', 'Hər şey bahalaşır...', 'Bu ay {tutar} yığdım!', 'Öz kafemi açdım, gəlin!',
    'Yeni başlayanlara məsləhət?'
  ]);
  tanim('global.az.cevap', 'mutlu', [
    'Sağ ol!', 'Haha, əla', 'Uğurlar!', 'Mən də elə', 'Razıyam', 'Bağışla, başa düşmədim', 'Yaxşı fikirdir',
    'Bilmirəm, bağışla', 'Təbrik edirəm!', 'Özünə yaxşı bax!'
  ]);
  tanim('global.ar.selam', 'mutlu', [
    'Marhaba lil jami3!', 'Salam, kayfak?', 'Sabah el kheir!', 'مرحبا بالجميع', 'Ahlan ya shabab', 'Salam min {yer}!',
    'Masa el kheir', 'صباح الخير يا جماعة'
  ]);
  tanim('global.ar.paylasim', 'notr', [
    'Akhiran ishtarayt awal shaqqa!', 'Hal ahad yabhath 3an mowazzaf?', 'El ijar ghali jiddan', 'خلصت الدورة!',
    'Yawm tawil fil shoghl', 'Kol shi sar ghali', 'Haza el shahr wafart {tutar}!', 'Fatahtu maqhaya, ahlan wa sahlan!',
    'أي نصيحة للمبتدئين؟'
  ]);
  tanim('global.ar.cevap', 'mutlu', [
    'Shukran!', 'Hahaha, helw', 'Bil tawfiq!', 'Ana kaman', 'Sah', 'Asif, turki mish mumtaz', 'Fikra helwa',
    'Ma ba3rif, asif', 'Mabrook!', 'شكرا لك', 'Ma3 el salama'
  ]);

  // =====================================================================
  // 9. URET ve STILLENDIR
  // =====================================================================
  var GOREV_IS = {
    kurye: ['teslimatlar', 'paketler', 'siparişler'], garson: ['servis', 'masalar'], 'inşaat işçisi': ['şantiye işleri', 'mesai'],
    'market çalışanı': ['reyon işleri', 'kasa mesaisi'], usta: ['tamirler', 'işler'], nakliyeci: ['taşımalar', 'seferler'],
    memur: ['evraklar', 'dosyalar'], muhasebeci: ['hesaplar', 'beyannameler'], 'emlak danışmanı': ['randevular', 'ev gösterimleri'],
    taşeron: ['şantiye işleri'], 'kafe sahibi': ['siparişler', 'servis'], 'dükkan sahibi': ['satışlar', 'dükkan işleri']
  };
  var VARSAYILAN_SLOT = {
    ad: 'ben', oyuncuAd: 'dostum', meslek: 'bu iş', yer: 'buralar', tutar: 'iyi bir para', isletme: 'dükkan', kurs: 'kurs',
    mulk: 'mülk', sayi: 'birkaç', gun: 'birkaç gün', ay: 'bu ay', kisi: 'arkadaşlar', konu: 'bu konu', gorevIs: 'işler'
  };
  var EMOJI = {
    mutlu: ['🙂', '😊', '😄', '👍', '😁'], sevinc: ['🎉', '👏', '💪', '🥳', '😄'], uzgun: ['😔', '😕', '🙁', '😞'],
    gulme: ['😂', '😄', '🤣', '😅'], tesekkur: ['🙏', '😊', '🙂'], bayram: ['🎉', '💐', '🙂', '🌸'], notr: ['🙂', '👍'],
    yorgun: ['😅', '😴', '😮‍💨'], merak: ['🤔', '🙂'], is: ['💼', '👍', '💪'], para: ['💰', '📈', '👍'], ozur: ['🙏', '😅'],
    sakin: ['🙂', '🤝']
  };

  var STIL_VARSAYILAN = { resmi: 0.3, emoji: 0.3, kisaltma: 0.2, hata: 0.05, nese: 0.3, uzunluk: 0.5, ascii: false };
  function stilTamamla(stil) {
    stil = stil || {};
    return {
      resmi: sinirla(stil.resmi, 0, 1, STIL_VARSAYILAN.resmi),
      emoji: sinirla(stil.emoji, 0, 1, STIL_VARSAYILAN.emoji),
      kisaltma: sinirla(stil.kisaltma, 0, 1, STIL_VARSAYILAN.kisaltma),
      hata: sinirla(stil.hata, 0, 1, STIL_VARSAYILAN.hata),
      nese: sinirla(stil.nese, -1, 1, STIL_VARSAYILAN.nese),
      uzunluk: sinirla(stil.uzunluk, 0, 1, STIL_VARSAYILAN.uzunluk),
      ascii: !!stil.ascii,
      buyukHarf: typeof stil.buyukHarf === 'boolean' ? stil.buyukHarf : null
    };
  }

  function dolu(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }
  var _gerekOnbellek = {};
  function gerekSlotlar(s) {
    if (_gerekOnbellek[s]) return _gerekOnbellek[s];
    var r = [], m, re = /\{(\w+)(?:\|[^}]*)?\}/g;
    while ((m = re.exec(s))) if (r.indexOf(m[1]) < 0) r.push(m[1]);
    _gerekOnbellek[s] = r;
    return r;
  }

  function cevir(sablon, slot, rng) {
    var t = sablon, onceki;
    do {
      onceki = t;
      t = t.replace(/\[([^\[\]]*)\]/g, function (x, ic) { return sec(rng, ic.split('|')); });
    } while (t !== onceki);
    t = t.replace(/\{(\w+)(?:\|([^}]+))?\}/g, function (x, ad, e) {
      var v = dolu(slot[ad]) ? String(slot[ad]) : (VARSAYILAN_SLOT[ad] || '');
      return e ? ek.uygula(v, e) : v;
    });
    return duzelt(t);
  }
  function duzelt(t) {
    return t.replace(/\s+/g, ' ').replace(/\s+([,.!?;:…])/g, '$1').replace(/,\s*,/g, ',').replace(/([,])([^\s\d])/g, '$1 $2')
      .replace(/^[\s,;:]+/, '').replace(/[,;:\s]+$/, '').trim();
  }

  // uzunluga gore egilimli secim: kisa kaliplar basta
  function egilimliSec(liste, uzunluk, rng) {
    var sirali = liste.slice().sort(function (a, b) { return a.length - b.length; });
    var b = (uzunluk - 0.5) * 2;
    var x = rs(rng);
    if (b > 0) x = 1 - Math.pow(1 - x, 1 + 2 * b);
    else if (b < 0) x = Math.pow(x, 1 - 2 * b);
    return sirali[Math.min(sirali.length - 1, Math.floor(x * sirali.length))];
  }

  function uret(anahtar, slot, stil, rng) {
    rng = rng || rngOlustur(7);
    slot = slot || {};
    var st = stilTamamla(stil);
    var liste = SABLON[anahtar];
    var yabanci = /^global\./.test(anahtar);
    if (!liste) {
      var dil = yabanci ? anahtar.split('.')[1] : null;
      liste = (dil && SABLON['global.' + dil + '.cevap']) || SABLON['cevap.genel'];
    }
    var s = {};
    Object.keys(slot).forEach(function (k) { if (dolu(slot[k])) s[k] = String(slot[k]); });
    if (s.meslek && !s.gorevIs) {
      var g = GOREV_IS[kucult(s.meslek)];
      if (g) s.gorevIs = sec(rng, g);
    }
    var uygun = liste.filter(function (sb) { return gerekSlotlar(sb).every(function (n) { return dolu(s[n]); }); });
    if (!uygun.length) uygun = liste;
    // Emniyet: katlama/yazim hatasi tesadufen kufure benzeyen bir sey uretirse yeniden dene, olmazsa sade bicim
    var sonuc = '';
    for (var deneme = 0; deneme < 6; deneme++) {
      sonuc = uretBir(anahtar, uygun, s, st, rng, yabanci);
      if (!kufurVar(sonuc)) return sonuc;
    }
    var sade = { resmi: 0.5, emoji: 0, kisaltma: 0, hata: 0, nese: st.nese, uzunluk: st.uzunluk, ascii: false, buyukHarf: true };
    return uretBir(anahtar, uygun, s, sade, rng, yabanci);
  }

  function uretBir(anahtar, uygun, s, st, rng, yabanci) {
    var sablon = egilimliSec(uygun, st.uzunluk, rng);
    var metin = cevir(sablon, s, rng);
    var ekler = EKCUMLE[anahtar];
    if (ekler && st.uzunluk > 0.6 && sans(rng, st.uzunluk - 0.45)) {
      var ekUygun = ekler.filter(function (sb) { return gerekSlotlar(sb).every(function (n) { return dolu(s[n]); }); });
      if (ekUygun.length) {
        if (!/[.!?…]$/.test(metin)) metin += '.';
        metin += ' ' + cevir(sec(rng, ekUygun), s, rng);
      }
    }
    var korunan = Object.keys(s).map(function (k) { return s[k]; });
    return stillendir(metin, st, rng, { duygu: DUYGU[anahtar] || 'notr', yabanci: yabanci, korunan: korunan });
  }

  // ---- stil yardimcilari ----
  var HARF = '\\p{L}\\p{N}';
  function kelimeRe(kalip) { return new RegExp('(^|[^' + HARF + '])(' + kalip + ')(?=[^' + HARF + ']|$)', 'giu'); }
  function harfKoru(asil, yeni) {
    if (!yeni) return yeni;
    return /^\p{Lu}/u.test(asil) ? ilkBuyuk(yeni) : yeni;
  }
  function degistir(t, kalip, yeni, rng, p) {
    return t.replace(kelimeRe(kalip), function (x, once, asil) {
      if (p !== undefined && !sans(rng, p)) return x;
      var y = typeof yeni === 'function' ? yeni(asil) : yeni;
      return once + harfKoru(asil, y);
    });
  }

  var RESMI_DEGIS = [
    ['kendine iyi bak', 'kendinize iyi bakın'], ['hoş geldin', 'hoş geldiniz'], ['sağ ol', 'sağ olun'], ['eyvallah', 'teşekkür ederim'],
    ['ne haber', 'nasılsınız'], ['naber', 'nasılsınız'], ['nasılsın', 'nasılsınız'], ['nerelisin', 'nerelisiniz'],
    ['neredesin', 'neredesiniz'], ['kimsin', 'kimsiniz'], ['iyisin', 'iyisiniz'], ['haklısın', 'haklısınız'],
    ['naziksin', 'naziksiniz'], ['komiksin', 'komiksiniz'], ['senin', 'sizin'], ['seninle', 'sizinle'],
    ['senden', 'sizden'], ['sende', 'sizde'], ['sana', 'size'], ['seni', 'sizi'], ['sen', 'siz'],
    ['musun', 'musunuz'], ['misin', 'misiniz'], ['mısın', 'mısınız'], ['müsün', 'müsünüz'],
    ['görüşürüz', 'görüşmek üzere'], ['bi', 'bir'], ['tşk', 'teşekkürler'], ['tmm', 'tamam'], ['kendine', 'kendinize'],
    ['bak', 'bakın'], ['söyle', 'söyleyin'], ['bekle', 'bekleyin'], ['dene', 'deneyin'], ['yaz', 'yazın'], ['gel', 'gelin'], ['başla', 'başlayın'], ['yap', 'yapın'], ['sor', 'sorun'], ['hesapla', 'hesaplayın'], ['ilerle', 'ilerleyin'], ['biriktir', 'biriktirin'], ['çek', 'çekin'], ['gelirine', 'gelirinize'],
    ['düşün', 'düşünün'], ['gitme', 'gitmeyin'], ['takma', 'takmayın'], ['etme', 'etmeyin'], ['çekme', 'çekmeyin'], ['seç', 'seçin'],
    ['al', 'alın'], ['gir', 'girin'], ['kapat', 'kapatın'], ['koru', 'koruyun'], ['öde', 'ödeyin'], ['ver', 'verin'], ['çık', 'çıkın'],
    ['kafana', 'kafanıza'], ['canını', 'canınızı'], ['moralini', 'moralinizi'], ['teklifin', 'teklifiniz'], ['teklifini', 'teklifinizi'],
    ['güvenini', 'güveninizi'], ['başvurun', 'başvurunuz'], ['başvurunu', 'başvurunuzu'], ['mesajını', 'mesajınızı'], ['mülkün', 'mülkünüz'],
    ['işlerin', 'işleriniz'], ['bayramın', 'bayramınız'], ['adın', 'adınız'], ['paranı', 'paranızı'], ['bütçen', 'bütçeniz'],
    ['emeğin', 'emeğiniz'], ['ilgin', 'ilginiz'], ['kademen', 'kademeniz'], ['hakkını', 'hakkınızı'], ['senin için', 'sizin için'],
    ['işine', 'işinize'], ['aklına', 'aklınıza'], ['fikrin', 'fikriniz'], ['derdin', 'derdiniz'], ['ailenle', 'ailenizle'],
    ['sevdiklerinle', 'sevdiklerinizle'], ['çalışmanı', 'çalışmanızı'], ['ilanını', 'ilanınızı'], ['kredi notun', 'kredi notunuz'],
    ['borcunu', 'borcunuzu'], ['itibarını', 'itibarınızı'], ['giderlerine', 'giderlerinize'], ['tecrübeni', 'tecrübenizi'],
    ['geldin', 'geldiniz'], ['gittin', 'gittiniz'], ['oldun', 'oldunuz'], ['yaptın', 'yaptınız'], ['dedin', 'dediniz'],
    ['gördün', 'gördünüz'], ['kazandın', 'kazandınız'], ['aldın', 'aldınız'], ['sattın', 'sattınız'], ['başardın', 'başardınız'],
    ['yakaladın', 'yakaladınız'], ['güldürdün', 'güldürdünüz'], ['utandırdın', 'utandırdınız'], ['ettin', 'ettiniz'],
    ['istersen', 'isterseniz'], ['istiyorsan', 'istiyorsanız'], ['arıyorsan', 'arıyorsanız'], ['çekeceksen', 'çekecekseniz'],
    ['olursan', 'olursanız'], ['alırsan', 'alırsanız'], ['diyorsan', 'diyorsanız'], ['giremiyorsan', 'giremiyorsanız'],
    ['uzaklaşırsan', 'uzaklaşırsanız'], ['seviyorsan', 'seviyorsanız'], ['oynuyorsan', 'oynuyorsanız']
  ];
  var DOLGU_SIL = ['kanka', 'knk', 'abi', 'abla', 'valla', 'vallahi', 'lan', 'moruk', 'dostum', 'kardeşim', 'be'];
  function resmilestir(t) {
    RESMI_DEGIS.forEach(function (d) {
      t = degistir(t, kacis(d[0]), d[1]);
    });
    t = t.replace(kelimeRe('ya(?!\\s+d[ae](?![\\p{L}]))'), '$1');
    DOLGU_SIL.forEach(function (w) { t = t.replace(kelimeRe(w), '$1'); });
    // -yorsun / -ırsın / -acaksın / -meli -> cogul
    t = t.replace(/(\p{Ll}{2,}(?:yor|ır|ir|ur|ür|ar|er|acak|ecek|malı|meli|abilir|ebilir))(sın|sin|sun|sün)(?=[^\p{L}]|$)/gu,
      function (x, g, e) { return g + e + { 'sın': 'ız', 'sin': 'iz', 'sun': 'uz', 'sün': 'üz' }[e]; });
    // kosul: değilsen -> değilseniz, aksatırsan -> aksatırsanız
    t = t.replace(/(^|[^\p{L}])(\p{Ll}{2,}[rlyzkmnt])(san|sen)(?=[^\p{L}]|$)/gu,
      function (x, o, g, e) { return o + g + e + (e === 'san' ? 'ız' : 'iz'); });
    // "Sizin limitin" -> "Sizin limitiniz" (iyelik de çoğul olur)
    t = t.replace(/(^|[^\p{L}])([Ss]izin) (\p{Ll}{2,}?)(ın|in|un|ün)(?=[^\p{L}]|$)/gu, function (x, o, s1, g, e) { return o + s1 + ' ' + g + e + { 'ın': 'ız', 'in': 'iz', 'un': 'uz', 'ün': 'üz' }[e]; });
    // siz'li sözcükten sonra bağlaç uyumu: "size da" -> "size de", "sizin da" -> "sizin de"
    t = t.replace(/(^|[^\p{L}])([Ss]ize|[Ss]izin|[Ss]izde|[Ss]izi|[Ss]iz) da(?=[^\p{L}]|$)/gu, '$1$2 de');
    return duzelt(t.replace(/\s+,/g, ',').replace(/,\s*([.!?])/g, '$1'));
  }

  var SELAMLASMA = /^(selam|merhaba|günaydın|hoş|iyi |hayırlı|tebrik|teşekkür|rica|sağ ol|görüşürüz|bay|aleyküm|oo|ooo|hey|haha|hehe|ah|bak|valla|ya |hocam|kanka|abi)/i;
  // Başına dolgu kelimesi almayan cümleler: zaten dolgulu, kişisel ya da çok kısa
  var ONEKSIZ = /^(ben\b|bence|bildi[gğ]im|benim bildi|bilmiyor|onu |ke[sş]ke|evet|hay[ıi]r|yok\b|valla|bak\b|ya\b|yaa|of\b|dedi[gğ]im|az [oö]nce|aa+\b|ha(ha)+|tamam|sa[gğ] ?ol|eyvallah|kusura|emin de[gğ]il|hmm|oo+\b|s[uü]per|helal|aynen|kesinlikle)/i;
  function samimilestir(t, st, rng, korunan) {
    t = degistir(t, 'teşekkür ederim', 'sağ ol', rng, 0.5);
    t = degistir(t, 'merhaba', 'selam', rng, 0.4);
    var p = (0.4 - st.resmi) * 0.45;
    if (sans(rng, p) && !SELAMLASMA.test(t) && !/^[@\d]/.test(t) && !ONEKSIZ.test(t) && t.split(' ').length >= 4) {
      var dolgu = st.nese < -0.3 ? ['of', 'ya', 'off', 'ah'] : ['ya', 'valla', 'hocam', 'kanka', 'abi', 'yaa', 'e', 'hmm', 'şey'];
      var ilk = (t.match(/^[\p{L}\p{N}']+/u) || [''])[0];
      t = sec(rng, dolgu) + ' ' + (korunuyor(ilk, korunan || []) ? t : ilkKucuk(t));
    }
    if (sans(rng, p * 0.25) && !/[?]$/.test(t) && !/ (ya|valla)[.!]?$/.test(t)) {
      t = t.replace(/[.!]*$/, '') + ' ' + sec(rng, ['ya', 'valla', 'ya']);
    }
    return t;
  }

  var KISA = [
    ['teşekkür ederim', 'tşk ederim'], ['teşekkürler', 'tşk'], ['selam', 'slm'], ['merhaba', 'mrb'], ['tamamdır', 'tmmdır'],
    ['tamam', 'tmm'], ['kanka', 'knk'], ['hocam', 'hcm'], ['ne haber', 'nbr'], ['nasılsın', 'nslsn'], ['bir şey', 'bişey'],
    ['bir', 'bi'], ['ne yapıyorsun', 'napıyorsun'], ['eyvallah', 'eyw'], ['inşallah', 'inş'], ['kendine iyi bak', 'kib'],
    ['değil mi', 'di mi'], ['öyle', 'öle'], ['böyle', 'böle'], ['bilmiyorum', 'bilmiyom'], ['falan', 'flan'], ['şimdi', 'şimdi'], ['yapıyorsun', 'yapıyon'], ['gidiyorum', 'gidiyom'], ['geliyorum', 'geliyom'], ['herkese', 'herkese'], ['teşekkür', 'tşk'], ['kardeşim', 'kardo'], ['tamamdır', 'tmmdır'], ['abi', 'abi'], ['gerçekten', 'gerçkten'], ['hiçbir şey', 'hiçbişey'], ['ne kadar', 'nekadar'], ['nasıl', 'nasıl'], ['görüşürüz', 'görüşürüz'], ['lütfen', 'lütfen'], ['şey', 'şey']
  ];
  function kisalt(t, k, rng) {
    var p = Math.min(0.9, 0.15 + k * 0.95);
    // gelecek zaman konuşma dilinde: yapacağım -> yapcam, geleceğim -> gelcem
    t = t.replace(/(\p{L}{2,})[ae]cağım(?=[^\p{L}]|$)/gu, function (x, g) { return sans(rng, p * 0.7) ? g + 'cam' : x; });
    t = t.replace(/(\p{L}{2,})[ae]ceğim(?=[^\p{L}]|$)/gu, function (x, g) { return sans(rng, p * 0.7) ? g + 'cem' : x; });
    KISA.forEach(function (d) { if (d[0] !== d[1]) t = degistir(t, kacis(d[0]), d[1], rng, p); });
    t = t.replace(/(\p{L}{2,}[ıiuü])yorum(?=[^\p{L}]|$)/gu, function (x, g) { return k > 0.45 && sans(rng, p * 0.6) ? g + 'yom' : x; });
    t = t.replace(/(\p{L}{2,}[ıiuü])yorsun(?=[^\p{L}]|$)/gu, function (x, g) { return sans(rng, p * 0.5) ? g + 'yon' : x; });
    return t;
  }

  function noktalama(t, st, rng) {
    // Soru eki ya da soru sözcüğüyle biten cümle: nokta değil soru işareti (resmî kişi her zaman, diğerleri çoğu zaman)
    if (!/[.!?…)]$/.test(t) && /(\s(m[ıiuü]|m[ıiuü]s[ıiuü]n|m[ıiuü]y[ıiuü]m|m[ıiuü]y[ıiuü]z|m[ıiuü]s[ıiuü]n[ıiuü]z|m[ıiuü]d[ıiuü]r)|\b(ne|neden|niye|nasıl|nerede|nerde|kim|kaç|hangi|hangisi|var mı|yok mu))$/i.test(t) || (!/[.!?…)]$/.test(t) && /(^|\s)(m[ıiuü]|m[ıiuü]s[ıiuü]n|m[ıiuü]y[ıiuü]z)(\s|$)/i.test(t) && !/(bilmiyorum|bilmem|emin değilim)\.?$/i.test(t) && !/(ne güzel|ne iyi|ne kadar güzel)/i.test(t) && (st.resmi >= 0.4 || sans(rng, 0.6))) && (st.resmi >= 0.4 || sans(rng, 0.6))) t += '?';
    // Soru sözcüğü olan cümle ("Kitaplar neden elli koli") noktayla bitmez
    if (!/[.!?…)]$/.test(t) && /(^|\s)(neden|niye|nasıl|nasil|kaç|kac|hangi\S*|kim|nerede|nerde|ne zaman|n[eı]reye)(\s|$)/i.test(t) && !/(bilmiyorum|bilmiyom|bilmem|hatırlamıyorum|merak ediyorum|emin değilim)/i.test(t) && /^(\S+\s+){0,4}(neden|niye|nasıl|nasil|kaç|kac|hangi\S*|kim|nerede|nerde|ne zaman)(\s|$)|(neden|niye|nasıl|kaç|hangi\S*|nerede|nerde)$/i.test(t)) t += '?';
    if (!/[.!?…)]$/.test(t) && /(^ne\s|\sne kadar$|^ne kadar|\sne oldu$|^ne oldu$|\sne zaman$|\sne yapay[ıi]m$|\sne diyorsun$|\sne dersin$|\sne düşünüyorsunuz$)/i.test(t) && !/(ne güzel|ne iyi|ne hoş|bilmiyorum)/i.test(t)) t += '?';
    if (st.resmi >= 0.6) {
      if (!/[.!?…)]$/.test(t)) t += '.';
    } else if (st.resmi < 0.6) {
      // Çoğu kişi gündelik yazarken sona nokta koymaz, bazen soru işaretini de atlar, virgülleri unutur
      if (sans(rng, 0.95 - st.resmi * 0.5)) t = t.replace(/\.$/, '');
      if (sans(rng, 0.35 - st.resmi * 0.3)) t = t.replace(/\?$/, '');
      if (sans(rng, 0.3)) t = t.replace(/,(?=\s)/g, function () { return sans(rng, 0.6) ? '' : ','; });
      if (sans(rng, 0.25)) t = t.replace(/\. (\p{L})/gu, function (x, c) { return (sans(rng, 0.5) ? ', ' : ' ') + c.toLocaleLowerCase('tr'); });
    }
    if (st.nese > 0.6 && sans(rng, 0.3)) t = t.replace(/!$/, '!!');
    if (st.nese < -0.3) {
      t = t.replace(/!+/g, '.');
      if (sans(rng, 0.35)) t = t.replace(/\.?$/, '...');
    }
    return t;
  }

  function korunuyor(kelime, korunan) {
    var k = kucult(kelime).replace(/[^\p{L}\p{N}]/gu, '');
    if (!k) return false;
    for (var i = 0; i < korunan.length; i++) {
      var w = kucult(korunan[i]).split(/\s+/);
      for (var j = 0; j < w.length; j++) {
        var f = w[j].replace(/[^\p{L}\p{N}]/gu, '');
        if (f && k.indexOf(f) === 0) return true;
      }
    }
    return false;
  }
  function harfDurumu(t, st, rng, korunan) {
    var buyuk = st.buyukHarf;
    if (buyuk === null) buyuk = st.resmi >= 0.5 ? true : sans(rng, 0.35 + st.resmi);
    if (buyuk) {
      t = ilkBuyuk(t);
      return t.replace(/([.!?…]\s+)(\p{Ll})/gu, function (x, a, b) { return a + buyut(b); });
    }
    function kucultBas(parca) {
      var ilk = (parca.match(/[\p{L}\p{N}']+/u) || [''])[0];
      if (korunuyor(ilk, korunan) || /^\p{Lu}{2,}/u.test(ilk)) return parca;
      return ilkKucuk(parca);
    }
    var parca = t.split(/([.!?…]\s+)/);
    for (var i = 0; i < parca.length; i += 2) parca[i] = kucultBas(parca[i]);
    return parca.join('');
  }

  // Gerçek telefon hataları: mesaj başına en çok bir tane, nadiren (insanlar çoğu mesajı düzgün yazar).
  // Türler: komşu tuşa basma (Türkçe Q klavye), harf düşürme, çift harf, harf takası. Kısa/sık kelimelere dokunulmaz.
  var KOMSU = { a: 'sq', s: 'adw', d: 'sfe', f: 'dgr', g: 'fht', h: 'gjy', j: 'hku', k: 'jlı', l: 'kş', e: 'wrd', r: 'etf', t: 'ryg', y: 'tuh', u: 'yıj', 'ı': 'uok', o: 'ıpl', p: 'oğ', i: 'üçl', n: 'bm', m: 'nö', b: 'vn', v: 'cb', c: 'xv', z: 'xs' };
  function hataEkle(t, h, rng, korunan) {
    // Bitişik yazım (gerçek sohbetteki en yaygın hata): "var mı" -> "varmı", "ben de" -> "bende"
    if (sans(rng, Math.min(0.35, h * 1.2))) t = t.replace(/(\p{L}{2,}) (m[ıiuü])(?=[^\p{L}]|$)/gu, function (x, a, b) { return sans(rng, 0.6) ? a + b : x; });
    if (sans(rng, Math.min(0.2, h * 0.8))) t = t.replace(/(^|\s)(ben|sen|o|biz|siz|bu|şu) (de|da)(?=[^\p{L}]|$)/giu, function (x, o, a, b) { return o + a + b; });
    if (!sans(rng, Math.min(0.14, h * 0.45))) return t;
    var parcalar = t.split(' '), adaylar = [];
    for (var i = 0; i < parcalar.length; i++) { var m = parcalar[i].match(/^(\p{Ll}+)([^\p{L}]*)$/u); if (m && m[1].length >= 5 && !korunuyor(m[1], korunan)) adaylar.push(i); }
    if (!adaylar.length) return t;
    var k = adaylar[Math.floor(rs(rng) * adaylar.length)], m2 = parcalar[k].match(/^(\p{Ll}+)([^\p{L}]*)$/u), g = m2[1], tur = rs(rng), poz = 1 + Math.floor(rs(rng) * (g.length - 2));
    // Çoğu gerçek hata Türkçe harf eksikliği (ı→i, ş→s ...); sonra harf düşmesi; yan tuş seyrek
    var TRH = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ç': 'c', 'ö': 'o', 'ü': 'u' };
    // Harf ikileme ve yer değiştirme yapay duruyordu (hakem: "kaadarıyla", "toparalnırsın"); yalnız gerçekçi olanlar kaldı
    if (/[ışğçöü]/.test(g) && tur < 0.8) { g = g.replace(/[ışğçöü]/g, function (c) { return TRH[c]; }); }
    else if (tur < 0.9) { var sp = Math.max(1, g.length - 1 - Math.floor(rs(rng) * 2)); var komsu = KOMSU[g.charAt(sp)]; if (komsu) g = g.slice(0, sp) + komsu.charAt(Math.floor(rs(rng) * komsu.length)) + g.slice(sp + 1); }
    else { var sp2 = g.length - 1 - Math.floor(rs(rng) * 2); if (sp2 > 3) g = g.slice(0, sp2) + g.slice(sp2 + 1); }
    parcalar[k] = g + m2[2];
    return parcalar.join(' ');
  }

  function emojiEkle(t, st, rng, duygu) {
    // Emoji ölçülü: mesajların aşağı yukarı beşte biri; iş konuşmasında ve resmi kişide daha da az
    var p = st.emoji * 0.32;
    if (st.resmi > 0.6) p *= 0.4;
    if (duygu === 'is' || duygu === 'notr') p *= 0.5;
    if (!sans(rng, p)) return t;
    if (/\p{Extended_Pictographic}/u.test(t)) return t; // zaten emoji varsa ikincisi eklenmez
    var d = duygu || 'notr';
    if (st.nese < -0.3 && (d === 'mutlu' || d === 'sevinc' || d === 'gulme')) d = 'notr';
    if (st.nese > 0.5 && d === 'notr') d = 'mutlu';
    var havuz = EMOJI[d] || EMOJI.notr;
    var e = sec(rng, havuz);
    if (st.emoji > 0.9 && sans(rng, 0.12)) e += e;
    return t + ' ' + e;
  }

  function stillendir(metin, stil, rng, secenek) {
    rng = rng || rngOlustur(11);
    var st = stilTamamla(stil);
    secenek = secenek || {};
    var korunan = secenek.korunan || [];
    var t = duzelt(String(metin == null ? '' : metin));
    if (!t) return t;
    if (!secenek.yabanci) {
      if (st.resmi >= 0.7) t = resmilestir(t);
      else if (st.resmi < 0.35) t = samimilestir(t, st, rng, korunan);
      if (st.kisaltma > 0 && st.resmi < 0.7) t = kisalt(t, st.kisaltma, rng);
    }
    t = noktalama(t, st, rng);
    t = harfDurumu(t, st, rng, korunan);
    var hata = st.hata * (1 - 0.8 * st.resmi);   // resmi yazan daha dikkatli
    if (hata > 0) t = hataEkle(t, hata, rng, korunan);
    if (st.ascii) t = katla(t);
    t = emojiEkle(t, st, rng, secenek.duygu);
    return t.replace(/\s+/g, ' ').trim();
  }

  function anahtarlar() { return Object.keys(SABLON); }

  // =====================================================================
  // DISA AKTARMA
  // =====================================================================
  var NPCDil = {
    surum: '1.0.0',
    normal: normal,
    dilBul: dilBul,
    niyetBul: niyetBul,
    // egitim betigi icin (tools/niyet-egit.cjs): ayni ozellik ve birlestirme kodu
    ONEKSIZ: ONEKSIZ,
    _egitim: { ozellikler: ozellikler, karma: karma, kuralLog: kuralLog, logNormal: logNormal, modelVar: function () { return !!NIYET_MODEL; } },
    uret: uret,
    stillendir: stillendir,
    ek: ek,
    veri: VERI,
    takmaAd: takmaAd,
    kimlikUygun: kimlikUygun,
    // yardimcilar
    tutarBul: tutarBul,
    paraYaz: paraYaz,
    kufurVar: kufurVar,
    katla: katla,
    kucult: kucult,
    buyut: buyut,
    rngOlustur: rngOlustur,
    anahtarlar: anahtarlar,
    NIYETLER: NIYETLER.slice(),
    MESLEK_ADLARI: MESLEK_ADLARI,
    _sablon: SABLON
  };
  globalThis.NPCDil = NPCDil;
  if (typeof module !== 'undefined' && module.exports) module.exports = NPCDil;
})();
