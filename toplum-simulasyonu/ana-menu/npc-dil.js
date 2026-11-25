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
  var NIYET_MODEL = /*MODEL-BASLA*/{"tur":"lr","b":15,"c":["selam","hal_hatir","tesekkur","veda","tebrik","ozur","evet","hayir","is_ariyorum","eleman_ariyorum","maas_sorusu","meslek_tavsiyesi","kurs_sorusu","mulk_satiyorum","mulk_ariyorum","fiyat_sorusu","ekonomi","kredi_sorusu","bayram","dert","kisisel_meslek","kisisel_yer","kisisel_ad","bot_musun","iltifat","hakaret","saka","yardim","zam_istegi","yetki_istegi","teklif","oneri_kabul","genel"],"q":0.0125757,"w0":[29,-52,-34,19,14,-16,-24,-32,-14,-16,-28,17,-1,-19,-45,7,85,-32,-15,88,-36,-39,-25,-41,-7,60,101,9,-15,1,33,-60,90],"k":{"lambda":0.5,"beta":2,"g":1,"T":null},"d":"4:5iq8h69jsukyvga;3:ej3;3:1hf2k38gp9k3ah3cleej9fjegjkjhckhbmheoh7phfwh7;1:8kpkizlhhnhdqk6sjythf;1:ajkjhgqkbrhbwju;2:kgtnlh;6:gjqhkurhg;1:2jw3k2akkbhcfheghajhenhgqh8tlv;6:eikgiokka;8:5j7;7:1je8ix9iraivlh2nl3pjcwhg;2:rkn;4:jmhqit;a:0h61ja;2:rj7;3:rjdskh;6:ciufk4;5:6kjfj8gimhkaqh8uhc;5:3jkjjq;7:8h49jybk7cikkjm;7:tjt;4:2k44jp;7:8il;f:cjadgiejr;1:ciy;9:oheqku;2:oix;5:mlcoh9;5:7kidj3ehg;b:8h8ejdkk6uj3;1:1k94jpgkiwh4;1:0h21km2fx3fy4jr5iy6gf9gjagbbepcfjdh0egnfg9ghchgjigqjexkmtlo8mj9nl8osbpm0qf5rgauh2vh4wet;1:aj3;2:1k84joaj0gkfwh0;1:wk8;b:0nq2h05gz6h77h38j29g2aj4bghefvfj3gonhgyinbjj1kh3lgkmh3nkhogupgiqharhfsgytgwuh3vhbwfy;3:3jqahdcitfjc;5:diq;2:wjv;5:9h9bjyeimfm9;e:qju;1:8issll;5:cksgikqk6rha;1:6mf;3:0h41h13iw7hg8lv9jlal0bj0cj6dgzegwggwhjkjg1kh1lhamilpharj6shcthauh0wir;4:fk7;5:0j1ahgfh7ghenjaqjowjm;4:cjkjj7rhg;4:kkslgh;c:4j6;1:kjb;8:6guwl5;4:7kd;8:4ik8h4ah3djeejdgh3phfrjhtisumdwhb;6:1iz2jy3h54gw5hg6lr7jp8je9h1bgwcj6dgyggtjgkkj5mh2nh9oj0pgwqgorgnshetkqugxwgu;6:hik;5:4n1iip;1:kjclhfmjdohdpk8;5:0j0;2:oix;6:fhfgkq;5:2is;1:0iycivfkughdsj0;1:0ix4jm5j0njf;2:0hg1h14h65hg7hc8fe9gebgzdqrejofl1gimhj7ihgjmdkgwlhcmh7ojxph4qh0sh1th6uhgwg0;5:ijs;3:8hfdl2ek2fipjk9whd;4:8j89jbeiv;2:jkwwgx;e:8gt9jk;8:pk3;1:iiv;2:4jswk7;5:jh4lhepjwqnh;e:jjg;9:cjedk9sk6;1:ej3;1:8je;1:agjfgagqmhjt;5:jjc;3:4iu9imghgkhfok8wks;8:qka;4:9j3;1:jj8;4:9jpcj1ehe;1:8iq9jeajdbjrcj5egtkjhnhg;6:0in3hggh5qo5rjrwhb;2:5ipjh3mjlrjw;2:bjd;7:0gm1lf4hebj0chbgh1ik0jhbkj5nhfokgph9qh2rj4sinth9uhfwh4;4:fjf;2:1marh2;2:8joiiqmj8;1:dip;1:0kw1lw;1:cjt;4:hje;4:1e04g55l26fc7hd8lp9k2bh8cgpdj5ej2fdhgdzhj7ihcjqkkdnleoml3nf3og5pfsqdwrkdsgdupcvmtwk6;2:fl1;3:2gu7o1;8:5k9oherir;5:5jw8gzujy;h:cjm;4:jjx;6:iki;1:4m0;4:8j4ck2rgk;4:3k3;a:ej0mja;a:3j35iw;5:0ju3hg8hgahfbircikhkujh7mitrh8tkl;4:uiw;3:fjc;4:khglkd;b:aj0;7:0ha2k83hh4m3bgwfhfil2kj8qhg;a:6mhjiuqhg;6:9itdj6ehg;g:ajhhjfjh5;4:fit;2:hg9jn0rjtshf;5:ohgpn0qhg;g:0j0;2:fh3uji;2:9k7cjm;1:uit;2:wkf;2:jhdqjm;3:8h2uk0;a:nlc;1:8iq9j7ainbj9;4:2jn3he4kg7hg9kdahcbhechddk1ghbjj9phdqh8rhhujlwgy;1:ak9;1:bhdkjulhg;6:tjt;b:eiv;b:sl0;4:9jwajldjzegjfhhjh8qjcrla;2:0h81jn2h63go4jk5hc7hb9llajubjqcmqdgzeg5gg9hgxih8jg5kmelk8mh4ngtokvpguqgnrfyth2ugbwg4;2:olc;6:qh7wlp;2:9h1dimeky;7:nk0;6:ej3;l:1jd2iv3hc7ha8jg9gjah2bjichgjj8kh1lhgmj2njhokcpjnqgxrh7theuhdwgq;5:jjf;2:2kn4gofhegjvhiviilmj7;2:pl5;4:9j3;a:0gt2ha3gs4gw5hb6he7h78km9gragnbiqcgadgrfiqgg6hgyih5kkelj3mh3nlrogppinqjksiqugiwnb;7:4jjhh2jkaojr;5:bjf;3:8g4andpjxwhe;5:8gz9k9dk5egnrk7;1:1j8;7:pk3;6:ljctki;9:bjcriu;5:8j5;3:ainfhfgimjj1oj9rkwwj9;1:gje;4:hik;2:hiq;5:4j29hbbgzclndh4eld;3:ah3cizejdjj3sjh;3:8he9hhdgoenwgj4jh7riquj0;1:iirolm;1:qkw;9:ris;2:khdmpk;9:4iw8gc9h8ah2cv3ehdgh2hhbjh4lk9rgzshfth9uhgwh7;1:jju;2:1mjkf4;1:9h7dncegd;4:uiy;4:bkf;6:3kgqhg;6:biu;1:gin;6:gj9;8:1lo7hclizwh6;1:0nk1ky2gx3g94gb5gr6gz7gx8ff9gnbhfcindguegafhegj3hgxihejgukp1llgmlhnj5oispjwqfnsfotg4vh7wh1;3:djaehe;1:9j3;5:3kgqhg;6:4ku;k:cj4;4:1j6;3:0j44h89jfaj3fhdglljiklhhqitrizwhc;1:aja;2:3o8ihfqhb;7:3kyrjb;5:0he1hg2he3j94mgbhgfhdgh2jhekgglh2ng6ojzpp6qiqwha;3:niz;3:aj8;1:0hc3hd4jo8gb9j8ah4bh9chbdk5elzfkaggpihekjvmhgphdqhauj2wh1;1:3ja;d:fl1;1:2infjz;1:tiq;1:0h31h12hd3ha4h35ha7he8mr9jvagsbgich3dh4egifk8hhcihgkgolh8mh4okwqkqrj9skrtgvwgo;7:hjh;1:cj9;a:aj9;6:djoehb;7:gk8;2:8j8iiq;3:okmqk8;3:rir;2:8iupjq;4:8k0;6:ris;4:ml4;4:4iv;d:2is;1:pjj;1:6jg7j3;2:qka;3:5jf8ilahccizjlfwhf;1:gjw;e:aj5bjukm4lh4;k:bip;q:ml4;8:iir;4:0gp1gz3gw4h45hd6he7k68gn9h1bgjcjjdhbeh5fgfgkihjnihdkislhemh1nhcohdpgzqk1rhbsrtth8ugevjpwgb;3:8jl;2:8hdiq1;2:oll;f:6hfpg4qgswom;6:5jk;b:ajbujg;8:8jl9hebh7cj0kjrlhf;5:0kp1h22ha3kk4hc6lt7hf8iranlbgyck0eh4hhcjgrkh6lkumh3nheohgpgsqg7rflshftheuh8wgi;a:ljp;1:0j31hb2hf5ha8g9am6bgpdh5fjzhjkih9jgmlk9mgtoh1pjrqgzrgasiktjhugq;3:jj2;1:ikj;1:ak9;1:khelj9ml7;2:cimjjxpld;8:3iknk2;a:2kcbiqjhhok5;4:0j7;1:6jg7j3;1:0iv9h9chcfklqk3;2:ghejh6rjbtkrwkk;5:1je2n63l44knjh6ohaph9qgnwha;1:0go1o6rh3;5:uj8;7:2kk4iyiiq;5:ein;6:4iz;7:1jsjikwl5;1:fjjllz;2:8ikdhgej4;3:mk0;1:8k79hcdgrek7;1:hh3jkipke;4:rix;3:4jr;1:rim;2:chgejdrj9;3:7kj;6:6kr8hbbhfiituk9;4:aj0;2:2is;e:jk8;1:jj8;2:5ipjh3mjlrjw;4:wkf;2:6mf;o:0js;1:pjz;1:diy;3:cjl;2:8l0bhd;1:lk8;1:rjs;5:bj7;2:0ke1gr;2:cja;4:rjfsku;2:1j8;3:8hb9ix;9:qiq;2:riz;3:rk3;p:5il;6:0j1ahgfh7ghenjaqjowjm;5:kj9;1:jh5qmx;2:ok5;3:1hc4j38gyajxbh2dheegqfj7ghajhdklpmj9ohcrjbshcth5uktwhe;m:8iuajafhd;1:ah3rlb;3:9ioej9;3:8iofir;5:6gtajurhgwl4;9:1gv3he4hf8ha9goalubh7cj6dioejdfljjh3kgylhfmh2ohdpkhqhhrj5siwtheuh2wgx;4:gin;1:qjk;4:cla;1:8jp9gybje;9:0hc2hf3hd4he5he6hf8jx9nlah2bg4cjzdhaelwfioggzjglkhclhemhaohgpkcqgzrjltheuh1wgr;6:cjsrha;4:jjo;5:1ng7jpghfojwpisrgx;1:9isnjg;5:4in;9:0l2wkk;4:2kj4gkiivjhdqh9rhfskuvljwh8;7:8ir;2:mjh;d:5lt;7:uju;3:cixnhcpjv;1:8hh9k4;6:8iq9jzdj2egugjfuiv;4:3llbjkfj1ghdrhfukd;7:8j9;5:ojn;3:jizmjkrjl;4:9joaiqbk4egwkjknhh;1:git;1:qjt;i:0js;5:tj4;1:kkblgx;6:diojjirjwshf;3:0k04j15ktaj0jhf;1:8j5bjfeh6rjm;4:1ki8j1kje;2:2j1;7:djy;2:wju;3:8hdiq1;1:tln;3:0ix1jocindhdeiwfjt;1:0j7;6:4ko;3:rip;9:8gr9glahddnhemgflpgh9jh9uhawhd;6:7jabhecj1fjjikfjhdqjc;4:eik;a:0hf1ha4hf5hh8mz9npah2bfjck0dhcelzfipggxjgskhdmh8phbqhcrjbshgtheuh0wgy;2:5lrohc;1:0iudj9ej3;8:jg9uhhvnk;1:1hg2h83j94jc8ji9kobhfdh7eh2fhfgh9jh7mk1phfqhatlpwhc;d:gh1sjstj6;2:hja;c:9io;3:3k9jjx;2:2ju;3:fk0;1:gk4jj6;1:oheqku;4:8fz9li;1:9it;3:fjq;1:jkc;4:8is;1:gknhh1jkl;8:fjq;6:bivml3;1:eipfja;1:dh6ejd;4:aja;5:pjz;1:0gr1io2h73gb4gw5l86ha7gs8ktamfbfjcmddgcff4hipjlokg9lgxnh5ogspgprj1sgjtj6ugcvh9wlk;4:cjg;2:ej3;4:1hd3h58ji9hfajnbh6eh6hl2jh4mionhgpherklsijtjquhd;4:3k1;3:wju;1:hjb;3:1je2n63l44knjh6ohaph9qgnwha;4:wkt;3:4iv;6:4m3qhf;4:1hc4iv8ge9ijah5bhdcgweiufhdgl4hjpjguohdpkvqh9sl7wh9;5:rj2;2:0is4jojjq;1:ak4fhb;1:0kw1lw;3:wjg;5:eikwk3;2:ciw;1:fjrgkfhikjhekjjmizwhg;1:0h61h92hg3go4h75hb6hd7l78h49jpagbbjfcgvdkdeirfk0ggrjk8kgnlj9mgznh3ohbpgqqg2rg7sk4tk2uixvha;2:iiu;6:mkirgx;4:8io;4:0hd8g39h0bhgchhduoejvgh4jh2nhgoiyph7qhgrhcthauiswh5;2:8jx;3:2kk7jr;2:fh2gk5;2:9hedkdegz;9:0lw1ip2jw5hd6h67jk8hh9gqbgqch0ejrgg1jgkkitmgyngxoivpghqhdsh0tj7uljwge;6:7jlhil;8:aj2;1:1hg3lq5kb8hf9h9dhdeikghdjjhqhgwj6;9:8ij9jcdikegz;8:bjf;3:rjq;3:6heqheuluvmg;1:9l8ah7bilgj6;4:4iz;2:3gvvm6;3:oil;7:djcegrfk1ujm;1:fjc;5:djz;1:3kgqhg;l:qk9;1:6mfoitqhf;7:dipuje;4:qkx;2:0l2;5:ajsrhh;1:2nr7k3dixjhdohcqh8siw;7:0hf3kz4hd5hc8jl9maah8bltcivdhaeglggljgokjfmhhnh4ph9qh3rgzthful4wgw;4:qj2;3:4iz;3:fjtnhaph8rk4tkpuhg;5:aio;5:8iq9jeajdbjrcj5egtkjhnhg;6:ljv;8:5jk8h99iv;6:khelkx;3:ris;i:0j15iu9k2aj9chgfh4jj3;3:5jk;3:7ks;1:jjc;2:qk0shf;b:cj9;4:0im4jeik5;1:3m9;4:lj4;1:sl9;1:qjk;1:rjfsku;2:2l17k9dj7ehf;4:0h31jk2h53gv5hb6he7ha8f59grakpbnfdhbeh4fjdggnhh6ih9jgbknxlnhmh3nh8ok2pgsqgdrg9th9wg3;b:8ineil;1:1hd4j98habk3ghhijrjhdmmzthh;4:oj4;6:9hbfhfhjkjiumjark4;2:2k9;3:git;f:1kf;1:3il;1:dj8;4:aj0;j:rjz;6:0lc1j6;6:uja;2:8ikdhgej4;e:9j5;1:1jvrh7;1:agzfjsjjwril;2:4iz;8:ciw;7:1iz;6:ajbchg;2:fjb;4:8it;6:jjgpk2whf;2:3hg8g69kaagvbixch5dlfeimfhcgh3hirjj1phdqivrizsj7tj9ugwwgx;9:rin;8:0jmbjorhh;9:riz;x:4j89ja;a:jg9uhhvnk;4:0mlqh7;2:qj7;b:4jvfio;8:4jljinojs;5:0hc3ha4he8h89hgahgciudheeiwfhdghfipsjldnipqhcrh9thguhfwgv;6:8j1nk8;7:0isdh6ejc;4:8h6bjzqj1;d:9jdtjr;4:jkwwgx;4:1it2kb3it4hf6jcfhcjhgkj1mj0oixqhgwhg;3:8je;4:gjljixoliphg;2:3inehdjln;4:lja;5:6hgphcqmowh6;6:bk9qjh;2:5ko;7:3hfahdfh7jlcwjx;2:0gk1gd3g95gq6gt7gr8jt9lfag5bgccgdegmgf1ih2jizkg0lgoolipjeqkvrjqsm8tg5uojvh3wiw;3:ahecj1iioqku;7:jj9mjn;7:9j8ejzfh3;h:1hbbiogljrh1wkj;1:9iu;g:8gm9jkgkn;1:0h11gz2hh3kn4hb5lc7hg8g69gfainbixcgbdhaegzfm5gh4hjhjk2kh7lh7mh6nh8oh7pgwqjbrjgsh6tk1wgm;4:khblkcvlm;2:bj8;2:fjq;1:1k3;2:1h42gr4gy5go6gx7gs8lu9oaal0ckjeiugemhh7igqlj6mj1ngyog8qfasg9tglupivh3wen;6:iki;1:0he1he8ir9hdbo9cixghbjh8kkmlm0ogophdqgyrhbuhewh6;1:wk9;1:8ik;9:glvrh6;8:mj6qj4;1:fhepnp;1:njk;5:git;9:tkz;4:qiy;5:0he2imgh4jhfkgenrwpjmqhfwhf;3:8ikbk8;1:dik;1:wka;2:0gx1k53gt6he7h98fl9koagvcjzdh4egrfgvgg6il2jfulh4mltngzojcrjssh4tgjuhevj2;2:jjc;2:8gv9jjalrcimfgsjioqjhrilsh8;1:4ip9h7ehgfj4glarjh;4:0ju3iqajhbkvcinfhfggwrje;9:9hdbjeeimfkjkjqlhc;3:hjxtiz;6:tjt;6:bja;1:cjl;b:8hc9hccisfj4oiurh7tmw;d:8gt9jfgivqjq;1:ok7;1:1ix2il8jvbjecivrheuj0;5:0hb1h52jv3h94h85io8g49j5ahfbjjcl0djlfj0giyhh8jgzkh2lhbnheogxpiwqh0tj3uh7wj0;1:uiu;3:filgk4;2:9inujn;3:ahecmxwjl;d:dkeeha;2:6kfniv;4:nmhphe;1:8il;4:8l0bhd;4:8jcriv;2:ahecj2gj6iiq;6:tkj;a:4iv;3:1pg2gj3ft4fz5gj6gm7g28ge9esalnbktclgdgaef6flhgjphkvigijfekl9lfpmmqngmpj6qfmrktsgwtg7uf0vgw;1:8j7;1:1li2gv4kw5it6fh7gz8fgae1bebdgrefvfingfmhg4ifjjepkmqlnompjnjeooypj4qdyrgytkduitvgcwe6;6:0hg1hg3hg8h59iyaplchcehbffuggfhhfjjzkhbohdph6qh7snpuipwh1;3:8h39kp;2:wjr;1:gh1sjt;1:aja;1:8jtehbiit;d:fjajhgwm5;9:3jhwjp;3:0lc3hcgksikljhcqhe;4:ahbckp;2:1h92kh3he4j15hb8h39hfbhhhhfijtjgwkh6mofnhdohcphbqh5rh9tm4uhcwgu;1:gjk;8:0gy1h42he3kp4h65h96ha7hc8fn9gfaplbgxcizdgfef9fuigk3hioihbjh7lh9mhanh8oh6ph1qgirglsh0th0ug7vhawjf;1:0isqjh;4:uiu;b:5mqjh8;1:sja;1:dio;1:qk1;1:0iu;2:pk2;1:4jj9k5ahhcjjjh8ojp;1:0g71om3h24h55hf8gu9gfbh9ckxdhdegvfh1gjlhkyjgjkhclhfmjloh2ph7qgsromshgtheugzwgy;6:0ha1hf4hf8gm9h4ahechedgien8giqjjelk3okwph0qhethgujwwh7;6:3jujjq;2:jjnrjn;2:pjw;6:diofh3uk4;c:ul3vgb;1:8he9hhdgoenwgj4jh7riquj0;4:bl3;1:biwkhbnknpjlqiy;5:fim;8:9jenjg;3:3k08jz9n3eh5fhfghfjjjqh5uhb;c:mjh;4:1iw2im8jv9gsalqbh3fgfkinliwnik;2:gj9;2:fjp;5:fjughhsm4uil;1:3kz;l:mh9tmq;4:0im;3:iiv;1:ej6;2:qiq;4:0gp1iz3h64h55he8g89hbch9dhbegzfgqggwhhhjgqkp7mmhnjtokdpl5qh4rg4sh0tgquiwwgl;2:4j9;4:lippk4;2:pjy;5:biz;2:8giah8bj3chfdngegsjjarj7sjdtjeuh1wh8;3:ej2;a:pmmqh7;3:8k4;4:sj5;2:hk7rh9;d:8h59krbhcdkpek8fh7ghejjarivuh2wjc;2:8iq9jeajdbjrcj5egtkjhnhg;4:0ixdix;2:hjy;1:0gb1gl2h13jk4gm5gz6gw7jx8j79mnafxcg6dlnelbfg3gg4ihfkgklgvnh7og9pgjqnmrgxtj1uilvj6wgm;5:siw;4:9ir;3:uiu;3:hhhjja;i:8ir;1:rhhtkv;4:8iq9jeajdbjrcj5egtkjhnhg;n:tjx;3:fixgjqljg;3:6jg7j3fj9;9:tjm;9:0jv3h0gjt;3:bj4hjr;d:1hc3hh7hg9glajwbhddhceiwfkpgh6jl1phfqhdrjttk6wgz;1:3k1;4:eipfja;4:mj7;5:4jfdj1eheiilmj3qk3;b:kilmja;d:4myaivch9iin;1:hjgjjn;6:0iuggvij3qjysjotj1;3:9jpehf;7:8fz9li;3:mk0;1:8lwbha;s:wk5;b:eir;6:cjt;3:4mv;1:0ke1gr;f:rjw;b:3j45iw;4:0k71k1;1:0j24hd9jjajcfhgghejixnjuqhhrj2;d:bjeniv;3:hhajj2okl;l:ciy;3:8kogj8kixlhfnhbqk0sjxthewhe;4:wjq;5:0h41ev2he3gr4h55jo7ha8u69h9bn3cizdfmgjchh8jftkm2lh3mgunhdogyph3qgtrfxsgwtgkukdwg7;4:8hgukf;2:8h59krbhcdkpek8fh7ghejjarivuh2wjc;4:8j7jip;3:cjkdh6fjarhgsjruhbvjf;1:7jcikhqjg;7:ej9;1:0iwqk4;6:2k98hbbiljhdnmzojvph9wh9;6:8j7;6:djaej5;4:mjn;3:anhbjhchdfgxjherjz;2:3jn;f:gjm;3:oix;5:4jr;8:0l2;6:3jhcix;1:ogyqqt;1:2gu7o1;j:8ikdirjhhqhbrj6skqwjs;1:3he8kr9lyajrblicfregjfh7ghdjgyklpnhbph2qj0rhduhcwh1;6:4ju;5:aim;1:qlz;2:eiv;1:niz;8:eikgishik;4:pjz;b:hjssj2;4:4mv;2:ijs;4:ljl;b:wje;2:fmaghc;1:ciufk4;2:1gp2lm4js5jh6hc7h58iz9fvam7bg9ch8dh2eggfgdhjfjj7kgvlh3mgwnh1ogipgqsh0tgaunjvl2wf1;b:ahecj2jk9riq;4:8io;5:6kphhbjiy;4:jkk;8:fkk;1:5j8;1:wjp;9:8l0bhd;1:sisujr;4:ris;4:riz;5:3ha4j1fh2jkgwlp;7:0iwqk4;g:lhhnmgphdsio;b:0jkeim;2:0hh8k39nrah4bg6ck3dhcem0firgh3jgvmhdphdqherjothguh3wh3;2:3it;2:ahdfh8jhewnd;f:2ik;4:jil;2:jhfwjn;5:8iplhcqj3rjm;2:jhbwjt;4:ein;3:ak9;3:tk2;6:ljv;1:ljutjx;4:nhcpjv;1:6jt;5:wk5;3:ris;9:jj5;1:ajfbhe;1:wjr;4:okm;4:aimdj4jherjeuinwjj;5:8j1;2:ojc;1:qk7tl2;4:8gx9gwdkreo0ghb;1:ajifha;3:2k2oj8;1:ujwvhb;8:hin;2:fjotll;4:hh5jjc;1:fix;6:hit;2:4l5;h:aj9;7:lhdrjr;9:wk7;6:rj0;2:ujz;7:5ki;3:gj8rlg;3:wk5;1:8j9;9:ejdsj5;8:0qe1jkjhdqhbrhgwhe;a:5j47lcnjeqil;4:sj3;2:khglkd;f:jjl;1:4ju;7:tjd;5:8imgj4tjc;7:giojk6pjr;5:9jn;2:gj7;1:wjx;1:8iz9h8;9:kk7uj8;1:9khahfchhdkaeitghgjjqujswhb;c:ahdcko;7:8jq9h3bk3eh5;2:8hd9jkdiveikfh5ujg;5:jhark4;2:lj4;6:tm1;1:cj1;6:4j9;1:oix;3:hin;2:9iw;6:nk2;6:hjh;c:5jv8ip;2:iki;2:qjr;2:2jb4ivilg;e:1iy8kzbhb;2:diveh7ljvtj1;6:8h19jvdlbehejj1uhcwk2;2:4j6;d:biz;1:ek2fh4;7:9ir;3:gja;3:0hg1h43hc4hd7gw8gv9g5ag6bjzcixdm7ejffjxhhejgxkgrlhdmhaok7phfqgvrgtsj7tkiuir;2:tjx;a:njnrkvthd;4:0gc1j04ha8hcbjdciodhdeiwfj8ghgikokg8lgwmhdngzplrqh9rkguhgwhc;3:jjh;6:2k9;f:qk1;3:khclkd;5:lje;3:9j3;3:iis;1:0isdh6ejc;1:uk0;1:0kw1nn2iy3im4jx5gm6gt8kx9gaagucgvdgaeg6flogkkhgdigmjjglg7ngeofypfzqfurkosgitkhuh0vh6wgn;2:1je2io;1:9je;4:0iv1j82jw6j47hf9hbahachcfg9ggkhhdij2jh2mionisph3qivuj8vh1wis;2:8iw;3:6guwl5;1:0kfah9ch2gjahkajirmj8rhgsj3;3:qki;2:hj7;6:5mkahefhfjhgpjp;f:8iv9j6;2:niz;2:2k64jo;f:9jb;8:fjp;3:8gr9glahddnhemgflpgh9jh9uhawhd;1:5ko;5:8hdlkm;5:0iudj9ej3;1:qk1;2:bj7;3:hiyjij;6:ait;3:wk9;3:oku;7:wj6;4:fmaghc;5:8j9;9:0k88h3rjzwjc;1:chchkmmjh;f:8hbahecj4jlzrh6;1:pmz;3:fik;1:9k6cjldil;4:khglkd;4:jkc;2:1hfckbfhagh5hk3jhdkjcsipuh4vk6whe;1:8hdlkm;9:6kp;6:8jl9hfcj1;3:0k71k1;8:cja;2:6n3;1:wju;2:bj8;4:2k8uhfvjl;1:pk3;1:3iq9lsbhbehgjj1pjcqjvuhewh5;1:9iq;6:6kriit;6:hjv;2:1j8;a:aj7;8:bhckjt;1:4imljvrh1;5:1h32jm3jc4kg6hc8h39hfagybh4chcdh7fkugjahgrjlfoh9phaqh3rhesjqtheujowgs;2:1jl8imajlfiorgn;3:ajujjgrhf;1:ljemja;f:dis;5:bje;6:qj7;1:8kpkizlhhnhdqk6sjythf;d:jjf;7:ej5riw;5:3jo8irblvhiujhcrh5;4:9j0gk5;8:7mvqh9;5:1iz8jx9gtaltbh5fggkipliynim;2:kjs;4:0hc4hgimi;3:2ns7k4jhgohfqhb;2:4j9aiweh0fjpkkbrjmthduit;1:gjm;d:1jjkhb;9:uiw;1:8io;1:ckvrhh;2:5j49h5dk8egvjhemj3tjmwk7;4:djxehb;7:4n1iip;5:8k69hbajedgrek7fh6;1:tiw;1:0hd6m27kebhcjh1ph6qgyrjjuh8vkawj6;9:0hh3hg4hd5iu8h29gyagfchfdiqem4fkugj4hhdjl6phgqhgriywgw;5:ah9ej6fp9gjqjhdpheqharhethcuk0whf;2:dipuje;1:djxsj2;3:9ikaj0fin;2:bjz;c:2is;1:0hb1h64hd5kx8kv9lcaipcgudheegwfgvgh3hhhkjhmhgnhhokppgzqh6sh7thewgw;4:anmrhc;4:6kp;1:8iq9j7ainbj9;9:dj7eh7;4:plh;3:bjg;e:8iw;4:1hg8h49krbhbdkoek7fh6ghcjj8riuuh0wja;1:dj8;6:qjpwk5;4:1j72jx6j47he8hd9heahbch8eh7fgqgithk7jgzllsminnh6pgzqh5th0uj5vh1wh0;4:0js;b:4in8jv9h3ahgdgmek0glljhbqj2tjduhg;g:0js;2:1h53hd4he7gx8gw9g5ag7bk2dm8ejgfjyjgzkgslhdmhbok8phfqgvrgxsj8tkmuis;1:mh9tmq;9:qj6;4:0ji1nr2gu3lw5h76h57h98fwagobjycisdh2eh4fgpggahjxiirjfpkfwlglngfolcpg6rjusgztj4ugmvkswg4;5:fix;4:9ir;9:8hc9ivdipfgpjj0rjfujc;5:qka;2:bip;3:aildiuegdgjkhgojkbnh5ohapjfqk8uj4whe;1:4im;3:1hg6hbah8chhfhcghfjgdkhbmj7ok5phgqjgrjaukrvm6wh1;7:1h32h43lo4he9h5ah3bj0dineiohgyjk8kh4mnjohhph6qh2rjwsh3th9uh4wgw;1:ah3djeejdgh3phdrjdtirumawha;2:6mnaikjhg;4:bja;2:ujz;2:2k44jp;9:6m7jhgphcqh7uhdvkgwjn;1:3lx8gi9khahcbivchfdkdghgjhclj5qhbuj8vh4wh7;5:cjc;6:4j68ikciwdghejp;2:wjg;1:dj8;1:qkp;3:3j15ivahgfhanjcwjm;b:8it;6:9hedkdegz;5:iis;4:0hgfhhgh5jizkgfnrvpjkqh5whd;2:2he3hg4hd6mn9hdahabgychbdj1fkshjvjh7ph9qgdrhftheukmvj2wh8;4:0h11h53h64hd6hf7he8h69gwagwbh0ch0dk8eiqfhegg8hs2ihgjkgkj2lk3mh9nhfohdph6qgurl2shfthdugtwgn;2:1kf8gc9k4;a:piu;3:ok7;2:bjcchfeirgjznhgok9rh8wk8;3:cjshim;1:8h2dk6wjt;2:fhfgjp;3:1m5aiudixeh4fjjkhbljjnhfphgrhduis;2:qjt;2:wj8;3:aj7fit;b:fjq;j:iir;4:0hf1hd2io8iw9heaiubl5civghcjh8kkslm3oglpheqh0uhdwhb;1:0jo;3:8il9lsah6bk5eh8kjynhbuhh;2:bkb;1:ejhjgxmjlqjq;1:ch1fl8;3:hixljd;4:ag3fkr;1:3lsbjq;6:fh3uji;1:six;1:chbhkhjky;1:9itkhglkc;f:ein;2:wjg;2:9iw;1:0ha2k94m4fhgil3;f:0l41h62he3h94hd7hg8h49hgak8bjkcitehggiwhhbihfjgpko9mh7nh4oh5pgyqgprkwshbtheuhawgm;2:5j1;3:9jw;3:bip;b:cjrdj4fhg;4:eiulk4;1:ljv;1:kjg;5:0h91h22hb3ji4h58it9nibjkcjxdh7egjgg4hkhihhkirlhamh4nhdoizph3qgfrjbth1ug1vjowgd;6:1hfbhfcl4ojv;1:8hh9k4;2:5iw8hc9j0ahgfhbnj3rjywjh;3:6kr;8:fjt;d:0il4jbdk9eh6ikcjharhh;2:0hf1h33h14hg8ke9gzakfbh0citdhfeh0ghehl8jgskhglhgnheohhph7qharkutjiujdwhc;4:oheqku;4:1jjkhb;1:8il;4:0hf3n25iq7juohcphdqhfwja;7:0fv1jp2gj4h55gc6gp7j98md9kgalgbfxdjoelwfg8ggghj9ihdjinnglpfsqfirgv;7:ek2fh4;3:0jh1is3gj5il8jpahgbhcgj6khfojaqhhrm2uhcwh0;2:hj7;f:gjm;1:nmhphe;1:8kh9jrah8bh8chbdl3ejsfh3hjljj1rh2sh8tgxujdwh4;3:aj7;2:3j88h7ehcfglgnojiyrhbsl4whf;4:oheqku;1:0kv8gy9joukwvga;2:ahaeisfh5skluki;1:5mc;d:tjm;4:8jr9h0;9:3kmaj1jja;3:gjonjj;4:0hb1f23gy4he5hh7hf8vbahebnkch7dh4efzggyhhejgckmelh8mh0oh4phbqh1rg9sh7tgrukrwgl;3:0j7;3:gir;5:cirrjs;3:8jt9jf;4:8jm9ki;3:0gy1gm2hb3hd4h87hf8he9heagnbgych1fglgkzhkrihgjl0kg5lhfnp2ognpoiqj2rewsh9tiluguwgl;3:aj8hik;5:uiy;b:0lq3in;b:3gr4hg8n19m3agvbh0chbdh7eltgh4kh6qgzrj1shaujjwh6;3:diojka;5:bjf;6:jj6rj5;1:agkckadhgeiyghbhgqjitkhflj8qjdrjduikwhd;c:mio;a:6kl;3:2he3mf;2:bjkris;1:ckvrhh;1:9imdjpegcfjbjhgujv;2:9kxehd;5:2k9;8:agjfgagqmhjt;2:cjg;1:eil;3:0iy8ivdjs;1:9ir;5:qin;2:ujs;2:tkj;1:dkdeg9;1:cj1;1:5lrohc;5:dh1foskhg;4:fh2gjp;1:dl6;3:8j1;8:ul3vgb;2:pjr;6:1kf;5:dipuje;1:8ggsj3tlp;c:iki;k:8k0;3:fjc;1:tjx;a:gin;c:8io9j6aimbj5uiq;5:ijsrip;6:3ja;3:0kk4l57hcik0whf;2:gik;2:8h89ju;3:dj1eh8iipjj8;8:8hf9h6bj5dkbegyuix;2:4myaivch9iin;2:cjcwk6;4:pjr;4:0gvikx;f:1kg8j0kjdrir;2:ijs;8:jg6mjxuhgvni;3:jjk;3:6kq;1:jja;6:0gl2gw3gc4ik5h06h57h18f19hgbg8cjxdiuelsgnzhl3igujj7kixlgzmiungzogppghqfvrn1sgtvh9wgn;7:him;4:qjk;3:8j0;6:cjsfhd;4:biz;1:5j1jjd;5:ris;8:3he8kr9lzajsblncfsegkfh7ghdjgyklvlh7nhbph4qj0rhduhdwh1;6:8is;1:qjw;3:0gx1gb2li3gq4j95h76hb7gs8gx9h5bh8dh7egzfgrgjsihajkkkgolh2mhcnjfon3qjqth8uguwil;h:3jahjfojipj7wjk;3:dj8ehg;7:oisskguis;1:2ki9jschfeirfj5;7:anmrhc;c:mjb;3:jg9uhhvnk;3:iiv;1:7l5hijjgq;6:1khwh9;c:qk9;4:rji;2:el0;1:gja;4:4lr6kn;1:9h9bjyeimfm9;3:tjd;5:6k6bkgkherhg;9:dix;6:ej0njj;1:8imlgwrk7;1:ah9ej6fp9gjqjhdpheqharhethcuk0whf;a:ejdrjkwk3;4:fj6rix;1:ciy;3:2im4hg7ks9gpbk6cnedgpekcfh7gh0lhfmhgrj2shgth6wh9;8:jj8;5:1hg8hachhehefhagj8jgznjopjorlpwis;1:0gw1h33h34hf7gx8gt9h9bh0cjsdhfehafgrgkthjsjfukivmh7ph7qjhss5thcuglvjvwgp;5:0iwqk4;2:fis;2:ah1ckkrjr;1:tiw;6:jjb;2:iki;5:jk8sjr;2:qjr;6:wkt;5:dh6ejd;8:gjpmkz;d:cknhjrjgzpl9qj4rh4whc;4:dip;d:9j2cjnfilgiwrh6uik;1:hiq;m:0he1hb3hd4hg8hdchcehehhhjjakjanj0ohepjfqiwriusjawk1;7:1gx9gzbh0ckieoqgl5jh0qj6rg6wha;2:jkc;1:ljb;1:0hf1h52jv3hf4jc8iz9gtah1bjlcgregnfhghksjgfkhflllmj2oh8phaqh2wj3;7:1k5jheohcpmsqh9wj9;5:qjk;2:ajw;9:9h7dioej8flhghf;4:5mc;3:uiw;g:dj8ehg;c:0j7;2:0hb1l83h94iq9h9ahhbiqch6fheggthhdilhjgzkj1mjbnhdokaph4qj2riwshetgyuh5wgt;9:pkh;4:djxehb;3:aj8;2:jjf;3:bjbginnjp;2:8hckhbmphqju;a:8fd9mmbhhehbgjthj7iimjiqshdthcwkn;3:rj2;1:6m7jhgphcqh7uhdvkgwjn;4:mkirgx;1:okl;6:9iw;2:dj6eh6sj5;1:pmz;5:bioqk1;7:gjb;6:gimrk6;2:3iy9ku;2:8hfrlk;1:qj7;2:ciw;9:2iu8izqlb;3:9j9pld;2:bim;4:0jl;2:2jz4ky;3:0jo;3:qjv;b:8jt;4:bj8;2:bj2jg8uhevnj;7:jjf;a:8jf;1:8ky9fs;2:0hd4hggjlhjxikrjkuqh6rh3shb;c:8hc9hgaincimdmtghhjikkhfokkwh8;3:3hh5iybj7cikeilfhajhgrilwk1;6:fhgwjx;4:fk5;2:rjc;3:0fs1gc2gl3os5o36gz7gu8lh9foagybjhdh4einffohjginujkekgolgnmgongzognpg9qf5rj2sgrtl2ufivh7wgg;3:oix;3:oiz;5:aiwcj8;4:8h2bk9;5:pl5;9:5jj8jarir;1:8j2;4:0gw1gz2hc3gm4h75lh6gz7lp8jq9gbaj5bgjdh7fovggnih8jjllgqmh9ngroh3pgirixsj1tj9uh6wfr;8:fkk;1:1j26kr;1:0kr1lqfhdgipjhgukd;1:8ix;3:0he1hb3hd4hg8hdchcehehhhjjakjanj0ohepjfqiwriusjawk1;1:0g71om3h24h55hf8gu9gfbh9ckxdhdegvfh1gjlhkyjgjkhclhfmjloh2ph7qgsromshgtheugzwgy;2:1je2io;c:1h82he4gv7hb8jp9j3agqbgwcgxdjuek4ffmgilhj7ik5khdlhbmhcngzohepmiqgysgxtgmumcwgh;5:ej3;4:0hf1hc3hb4ha8ilal3bh4chbdjzegsfiwjgdkgulh3mhbngvoh4pgoqh0rj2slbtmtujfwgs;1:rjz;5:omb;1:9inujn;a:3hg8h29fwagtbhedh0eo6fm1ggxjilohhqhbuiqwjv;2:gk6;1:rj7;3:okl;2:5lt;7:uj1;1:6mf;3:rin;1:mj7;5:jk0;1:ahdpk6tjb;6:9j6ahecmrfhhrhewjk;2:fjnuiq;7:8irbjd;6:fjf;3:2j1;2:hjsmj6;4:2jv3itaiv;c:wka;3:0j1;2:0hd1ha3hg4hg9h2bpuckkeh3fhggh2jh6kkjllwogkphaqgxrh2uhbwh4;d:wk8;4:diy;a:8jj9jxfjfgj9;9:pl5;5:bjgrir;8:3kz;1:8gn9jragybhfdkfegvgh8jgxrhbsk5upcwhg;3:biz;3:ljb;2:1kf;3:0iu;e:ciw;6:aiy;b:gin;2:0hb1h99hfah9bhcchcej8gh5jh4kj1lr3mhdoh4ph9qh3rm1wh2;1:9jvmlcuhg;1:fh3uji;9:1kf;2:3k1bl0;2:0kw4iodj7ehb;2:4jm;2:0j5ciyej3;a:6k5ikevj4whd;7:mkirgx;8:3hf7h99gqag5bkgchcejvfkwjgxkhdqh8rhbsjttkyujiwhd;2:eip;2:0iunk9qk0;6:djn;j:ojc;1:wja;3:fjykhelka;8:3gy8nw9mjah4bh7dgaemufhfghgjgvkhbqh9whg;3:4ilrjz;3:9l8aipfil;9:jj8;6:giw;d:1hgkhfmoa;4:ej9;2:rjt;6:ej3;d:0gq4hebl9hitikqojiwhg;2:hgwjjr;1:git;4:jkk;9:0mh8j5ril;1:1kbwji;2:3hd7kt8hbdh7hiwjkq;1:bjf;4:dkdeh5;8:0kh4l37hadixeh7ijyqhgwh9;5:3o8ihfqhb;3:0j08h49lbahfeh4fh4ghcnj9qjluhgwjk;2:ikw;1:9jlajgjj3rj9;2:0le;5:8jl9hfcj1;9:hjssj2;5:glvrh6;3:aj1fhe;3:4mb;1:0hf2md7jh8ik9iybgwchhjhfkj0ljlrhfuhhwhc;9:8jl;1:3kbjivmjiqh8rjj;4:iiv;3:9iu;6:2klbiyjjaqk9rh7;3:7kc;1:jjc;2:8k49h9dgqek5ikg;9:ajifha;5:0io;2:5mc;1:aivhijrhguki;1:bhdkjulhg;2:ej3;5:0h61ja;3:jjb;5:8ir;2:fjp;2:jkv;8:9irfjhgjalk3;4:nk2;8:bjf;2:4in;1:cla;3:ak2biscjfkj2;7:1j9rki;1:gjmlio;5:gis;2:bj4cixhkojjz;c:fjf;1:5ik;1:gkc;3:3kh8heal0diqehgjhgsj1;1:1hcgkyrgq;5:ait;9:wjr;5:9j3;3:8jy9h3eh6gjj;5:biz;2:0gy1gj2gw3gt4l15h86he7hcao2bkgch6dgofg4ggrih8jjnkfllgnmgzngcpkrqg9rh0smvtguvhfwl4;9:0ik7h38jbjiskh1mmqph8rgywkj;c:qjk;4:pl5;4:sju;4:3jojgzqiqwlp;2:1h38hb9jlajdcj7eh8fh4ghajhakj7ohdpjkrm8whg;2:djg;c:9leelgjh9;4:2k6aj7cheujn;4:vln;3:iiu;3:lja;2:dj7eh7;1:fin;8:8gtum3vjf;4:jj9qirwk0;7:riz;8:4ix;2:7k8bhbfj7kjellwohfph9;4:9jg;9:8kl9h2;1:qiz;3:4iz;2:4j29hcbh0clodh4ele;5:hjo;1:1k3;7:qjt;7:gix;1:2k9;c:8iq9jeajdbjrcj5egtkjhnhg;2:2ix;2:pjz;1:ej3;9:9jc;2:fl1;2:pk7;2:jj8;2:dip;4:8j8;p:8hflly;1:9h5bky;5:fjo;h:hhbjj4uiv;2:8knkiylhgnhdqk4sjwthewhg;1:pkh;5:bjejj5;8:gju;1:1h7gm3qjkrgo;3:8kpkizlhhnhdqk6sjythf;2:eji;4:jkv;2:8jsbhgdhdehfjirrjktl6;9:4jr;5:viv;7:ahfpk8;1:jjl;1:3he5m18iw9h8ah9bhcch3dh5fhbggqjh9kjjljiniwphgqj5rhctiyuj0wim;4:bjg;1:oiz;1:ik4;6:9j3;5:kk9lgvqkn;1:khblkcvlm;5:9jb;7:aiocjfiiq;f:5jw;1:aincip;2:8j1;a:ljsrjz;b:jjm;1:fjc;5:8iw;2:8kpkizlhhnhdqk6sjythf;b:chbhkhjky;2:1l28gx9j2agxbhffhcggliijjjikl0sjgtiywhf;2:qjq;1:8j0ck0fjorgf;6:pjy;4:gkc;5:akicgyfh5jjerh6so3uhh;3:tjfwks;5:tln;3:aj0;1:0j5;1:1hg2io3h84hh7hd8jkahfcjadh4eipfgkggzhk5khgmk8oj4phgqiptk8ugvwh0;3:0kd1gr8ip;1:0h68j7im9khdljorjouh6;b:8gz9h9ekngjj;3:3kgqhg;1:ciw;1:ak9;3:ljd;f:ujg;2:1hf3hb8h2ah1bjscmoekjfkqgh1jgxkhelhemhgqherjgth5uixwh5;3:4io;b:bj7qj1;1:0j4;2:dh7em4;6:bj7qj1;3:0kc4ku7h88im9hddj0egmfjvijsjhfuinwh0;4:glxqj9;5:0jw3h0bj5;3:8hglkl;1:bjp;1:ujg;5:1h63jv8je9kbkhcljhok6;5:ej1;1:9lnagxbjzeh0fiygh4jhdkjvnh9uk5;1:0jk3jj4h98ke9h1ahbbh2chbehcgkgijajiumhgnixphaqj7rjhsgfugwwgt;1:lk8;a:skhuit;7:wju;2:uiq;2:agbflh;7:hiyjij;3:2kj3kb4gtqhc;5:0k61ir3ix;1:9joaiqbk4egwkjknhh;3:4ingj5hilrjo;a:0jnaj7;2:ej3;3:wk9;1:tk0;3:8ik9j3bkqghfkk5nhdphe;1:4iz;4:jjc;6:8h5ej6gkiuiw;3:9gxejdfinukh;3:qk8;7:0fv1jp2gj4h55gc6gp7j98md9kgalgbfxdjoelwfg8ggghj9ihdjinnglpfsqfirgv;6:bjkgjkjkd;7:9k7cjm;8:8j7;2:1fi5iv8f7ahebnbjhgknjrgwwj5;e:jjc;1:3iv;3:glssjj;2:mkirgx;8:0j0;1:rip;3:gju;3:bjg;1:fjp;1:ak7fjygha;7:jj9nj1;4:cj9;9:hh4jko;3:5j8;6:ciw;3:2l83j95j4;4:fix;7:0iz;1:1h0gllhl7jjuqiyrfv;8:iirolm;2:fjf;9:8k0;1:dir;2:1j6;3:8jgwk7;1:0haaiubjhfhaggzjh4kkplgzmhdnpoohbpjfqh6wh1;o:anmrhc;b:aio;b:rj0;2:dhaej2;b:4ipsj2;3:8kh9iuahhehdjh7mh9tkvwj0;1:cil;6:fl1;3:bj5cizhktjiv;8:gis;2:8h3bj7rlnuk5;1:jj2;3:3ha8kgekmfjpghejh9nj9oiruhe;5:9izejkfgqsiuuk6;2:hj7;2:sj3;2:pk3;6:pjz;3:ljv;1:0gz1iv2hc3gm4h25h37h58kz9gkamubfvcmydglfffhj0jmokgflh1nhaogypgzqghrjfsgpth0ugpvhdwma;a:8h59jrhjqsj0ukxvga;1:tkj;k:8iw;3:eisikhlk1;1:1h18j0agxbirchaehcfh4jhhkkuljwmk1ohaphfuikwje;1:cjadgiejr;3:fjp;4:eipfja;9:2klbizjjdqk9rh8;1:oje;3:riz;9:ahfbkxiiprjo;4:birgiq;1:8j1;1:gjw;a:uiu;2:8jz9gzajcfh9jh8kjwlisol5pharh8ujqwhh;1:3kg8hd9j5ahhcjcdjtegtjhdsk4uh9;4:6kq;1:ok7;9:0gtikwlj9;6:ciw;1:gja;2:glssjj;3:wjx;4:3jn4jk8h8aj0jkzohguhavk4wh5;5:uj2;1:3ji;8:9k7;7:ajkjhgqkcrhcwjv;a:3lr5kdjhg;a:tjx;3:6k5aj5bkekhdrhf;2:ajbchg;1:0gp1jy2hb3h44h05ha6hg7gt8mzaimbfvdjoejgffpgfthh6kj1lkbmh0oh3pgwqgmsh3tkevhawll;2:qiz;3:1k03hh8itaisbk6chegh4jh1kn9mhgoh1phfqh7wj6;1:wj8;3:3jv;2:5kh;9:1gf2gz3mw4lt5gy6iy7gy9jjagodgiffuggxhgnigvkgglgimgtngcogipl4ressgbtphujfvkmwh6;3:mji;1:4jhehekkj;b:0iv8hb9kfqk1;3:tjd;3:0k61ir3ix;8:djxehb;3:9j3;3:tjx;2:ijb;6:8ll9mkcioegzfheghejjjrhfuh2;1:bjg;1:3kz;1:1j8;1:kkblgx;2:0gvikx;6:bkmhivojk;3:tjm;1:9h8disejg;2:0hgiju;3:dh8fji;4:3hfahdfh8jkywjy;2:0ow1lsfhbgh9qhg;a:0hc3hd4jo8gb9j8ah4bh9chbdk5elzfkaggpihekjvmhgphdqhauj2wh1;1:3hfahdfh7jlcwjx;6:dj2fik;4:3hd8m1ak5biwcitdhheh2fhdgh7lhgqitritwhd;1:qka;2:riv;8:4j9;c:ris;9:fjf;9:ojy;6:fk4tjsuhf;2:jjc;5:rjfsku;5:dj2;1:4m3qhf;9:qk1;3:fiz;7:cj3;4:4j8iiq;4:hj6qji;6:8jl9khehdfj4;1:gix;2:0is;1:0h91hb3h04hg5hg8ga9gjaq2bhacj9dhfefqfotgkthiyihgjgbkiolhfmhfnhfohephaqh1rgssh8thbugowk1;2:0hgahgblcpmrqj6shgwgl;5:9h7dn5eg7fjd;3:gju;9:ciw;g:ciy;9:8im9j0bj6cjofj7rg2;b:biz;5:aj3;b:rjv;5:3is;2:4ivghfok8wks;1:qjk;4:ein;3:0h11jb2n43kx4kk8hfghaijfjh3mixoh8ph7qgiwh7;4:bjz;5:ah9ej6fp9gjqjhdpheqharhethcuk0whf;8:5j8;9:jk0;6:nj2;2:qjt;b:2izjkt;5:chehkjjjm;8:1hg7jg9jxbhgcl0rjf;2:bjbginnjp;b:qkp;3:wjg;3:fjc;2:8iq9j7ainbj9;8:agzfgxgmdhir;2:gir;a:ris;7:8j1;4:wj6;1:5j48h2ej4gk0hk1jhenjergpuiq;1:pmvqhewgs;2:0hd1h24hg9heah4bh8chedhfeinfovgnajhhkgxljsmheohaph6qh0rgcth5ulrwh4;8:3h97kp8h89hadl5egrhisjkcqhg;2:civek1fh3;a:rix;1:8iq9jeajdbjrcj5egtkjhnhg;1:chgejdrj9;7:2k44jp;4:bhbkjeljq;7:2kk7jq8jn9gy;7:1k43kv4jl8hediueh1givjh3qjbrgv;2:3j1;6:okl;3:dk6;1:0kd1it;1:oj4;i:6mi;8:git;2:jkwwgx;3:9jacj6dj5;2:6hfqhfulavmg;8:jk0;4:hjsmj6;i:0hf1h93gw5hg7lf8hc9j3agdbjicgxdh4ej9fkcggxjinkguljemh6nh8ohdpgyqgcsk8tkdvhf;6:wjg;c:hk7rh9;6:plh;9:ajw;1:iis;6:rjz;b:1hg8imahfchegh9kjlljenmiph7tj3wis;1:3o5iheqh8wjv;1:agwckcej0ghdhgsjixljaqjgrjgwhf;2:8j4ck2rgk;4:iiv;2:0hf4mlbhfpkxqhcwhe;1:0ka;1:jhark4;g:ujz;c:8ku9je;5:fja;1:jjc;1:riz;1:6k6vj6;6:8j9;1:hizjhc;2:bjf;2:jjeuin;1:aisrjv;1:sj3;6:ajv;a:jkk;1:3j9mkhrgv;8:oku;6:gir;1:qk1;1:tjd;5:ej3;8:nkmple;4:5kc;2:agjfgagqmhjt;3:wj6;2:8hbahecj4jlzrh6;7:ej3;1:0h01gy3h44h66lp7h68hf9gcbh1ckadgyejafgfggkhk5iinjh4kiylh9miooh9pgrrm0thgug3vle;b:0lkhhejj5;4:1hg8hbchhfhagj8jgznjopjprlpwit;4:0h51iz2im3gx5j56he9h3agjbl9cgtdjveg9fgphhbihejlrkgulh4mipnh6ok0pj9qgfrg3tlnwg3;2:0gx1gb2li3gq4j65h96hb7gs8gy9h4bh8dh5egtfgogjrihajkdkgqlh3mhbon5qjqth8wik;3:8gx9jl;2:fjf;6:dj8rjg;2:8iw;7:8lf9grdlwegluhc;7:chbhkhjky;3:0hc1gw3h68m79msalobh4ckydk0efpffsggxjgrkh2lhfmhdnheohgph5qh4sheuj3wh1;4:qk1;4:8hgukf;1:0hf1ha8h4bhhcheehgfh8ggshssjleokxph7qhgrgfuhdwh3;5:8k0aivcj7;8:3it9lybheqk0uhh;1:dkkeh8jje;3:8jcriv;1:9h4dinej6flcghcnhfohepjjrkmth7;1:hin;1:fhbwkg;2:8iw;4:3hg8kreku;5:8im;a:8j9;a:djaehe;6:iis;1:0ga1ko3h34h56hh7hg8hd9h1bjocgvdhdeh6ffigmgijpjgokjwojzpiyqgltgvugzwio;7:jk7;1:lkt;9:0k81gp3klfkfuhe;8:djcegrfk1ujm;7:2ix;2:1jf2nf3ip4kqjhaohcphdqh7whe;2:4jodloehdjhg;b:9j6jhdpl9wjh;e:gknhh1jkl;5:qjt;7:0in3hggh5qo4rjrwhb;4:0j7;1:9hbaiufhbjlgnk0uhc;1:4jv;c:fjaqjq;6:qka;7:sj5;1:8jj;8:3mcqhg;5:0hf1hb3ha4h98ikal2bh4chbdjzegsfivjgdkgulh3mhbnguoh4pgoqh0rj2slbtmsujfwgs;3:3j45iw;5:3kp;9:hiz;2:qjv;o:3mh;1:ukn;7:olc;2:3l5fjl;1:dj3eiwmim;3:0mlqh7;1:oix;5:8h3bj7rlnuk5;a:qkk;2:hk7rh9;2:0hgiju;1:kkb;5:9je;3:3jwajp;7:1k4;4:8iqqk9;6:nkb;7:4jt;8:4io;3:eipfja;7:3gy8nw9mjah4bh7dgaemufhfghgjgvkhbqh9whg;1:0ke1gr;2:cjxehe;4:4iu8jgaivcj7uhg;3:akr;1:5ko;4:0iw;1:bj7qj1;6:dkdeh5;7:8h89jsjjiwk8;3:4it8llaiucj6uhf;2:niw;c:qle;3:7mvqh9;4:six;2:2kt4gx;5:5j4jhgmkdqk4rgftkw;1:nj1;3:7hd8g79h8bkwdh9ej2jh6qhdsj6tl5ujv;2:1hf3kw8ijbj1dkmgiojh2khduh8wj6;4:8hbahecj4jlzrh6;4:ljd;3:wj8;3:jjg;2:3lsbjq;4:khclkd;1:riu;6:wja;g:8iv;9:chgrja;2:2ju7kedj0ehejhbojb;1:pj7;1:ej3;6:bjjcisfjggj0rkp;9:uj8;2:djoehb;1:pmvqhewgs;3:0hc3hd4jo8gb9j8ah4bh9chbdk5elzfkaggpihekjvmhgphdqhauj2wh1;1:1j8;3:jj8;6:6k6vj6;1:8ji9hdgin;3:akjfh5;a:iir;3:0my1jz2ji3ju4mf5k36hc7iw8h39h0bgvcgtdgyhg7kjalgymilnh6oghpgwqgergfshctgzugy;g:6guwl5;1:fk2qj6sj0;4:6jt;4:iiv;4:7mvqh9;5:git;3:wjg;1:5l6;1:4jujiumjhrji;3:ak0biqcjbfhfkixlknnhg;1:aiucj7ggxsjr;c:8fx9lftj7;4:oix;a:5jjjjarh6;2:1kf;4:8ju;3:2kh4im7jm8jcairbhfcj1uhd;2:8jk;8:oix;c:lje;4:pjjrik;6:dj2;4:git;7:lj4;a:1hgkhfmoa;2:ej1;2:gis;2:wje;h:8fn9lgwjk;1:cjc;2:qja;4:0pn1jg3h74me5hffhhghbjgumhbol4pguqgyrh1theuhfwgz;3:0kd3k3djaijkjhaqjtsh4whg;4:njk;6:1hh3gp4he8mq9lwal7bggch4elyfh7gh5jgbkgsohdqh2rj5wh2;1:qkw;1:0ka1it3jzghcijinj4qjqrhash4whc;3:8k0jh6rj7;4:8k49imajbbjeehgjizriz;3:0hd1hg3hg4he8ml9jkaj9ch8dhdegvfh0gh2kh0mhfojfpirqllripsgyth8wh7;e:jjo;9:8g39j6jjzqjbtmvuhc;3:1jvrh7;7:8iw;2:9jzcjrohgpjrrjf;3:9leelffitjh7whg;5:rip;2:9j4;4:gjw;9:3j28kvbiurl5th1;1:3gvvm6;8:six;5:doheff;8:wju;4:qk9;2:gis;a:ej0fgtukc;2:2ml7jloiv;4:4m3qhf;9:3ju5jc8h6gjwjh2wkj;3:3jx8hhgkfriu;3:pjz;7:hk5jk5qhgrh8;1:wk0;9:bkb;7:jjm;5:8itahcckndjrfhc;4:dguek5;2:jks;3:9k3ahecjgfhggh8ohgqmq;1:qk9;5:3j55ix;4:4hgbllijoqjrshd;5:hik;8:djlegv;3:ahecj1iioqku;4:rk0wj9;3:fiu;1:0jt3iqajgbkucjnfhfggujhhlhgrj4;2:pk2qkf;6:9iycjjgislkprh0;1:2k8bjbjkdok1qhewh7;1:tjx;6:nil;1:aj5bjpfjmkheokk;3:0ka;1:uiw;8:uiy;1:4iz;2:ljv;5:9hdcilrjn;7:0ik8im9j0ej7fh1gheqje;1:ait;4:agpfk5;1:3kyrjb;7:0hg1ha3hd5lx7hc9gpajrbh9dh9eitfkfgh1jkhkhhlhgph8qgvrjishdtk0wgp;1:2k34jouis;c:lgyrk9;8:3ko;3:1jjkhb;1:9j3;f:bilkjk;1:cjegk9;1:5is;5:ujwvhb;2:bk7gjt;5:jjd;1:0k21is2gk4kl7n58ja9gqbhcgheijrkh8phgqgxwgz;1:2kr;4:1k5;6:4kz8kkch8gka;3:nk0;4:9h8ejx;4:pj6;4:5j9giv;f:gix;4:oix;1:4ikgj3hikqhgrjmwk9;3:8hdfhdggyhskjj7rgk;b:lk8;3:aj0;7:jjv;1:2j1;7:gjr;3:0io5iv7h48jajizrh2wkp;3:3m9;1:bj8;3:5mkehgghehlmjkawh8;b:bj9;6:0j68jk;2:4jlpl7;3:ajsbizehffherkw;4:nlsoirphf;3:bim;e:kkb;1:bk2;1:5mc;2:cixrl3;b:8hc9kr;9:qk1;2:jjo;h:7jcbitdj5ghghk8jk6whh;3:0lk3il4j5iio;4:jjk;1:cj3;2:ijb;2:bj4jj9;2:ehaukt;2:3hd5ha8in9hbbjlcjjegzgheojbpkyqhbrlyuh9wgs;5:9jcgk4jh8shgwjb;4:ahecmxwjl;8:qjk;4:8j0;8:0hg1hh4hh8lv9jpbh2dheegzfh7ghbjjhkh3mhfojgpisqlmsh7thawh9;3:8jc;e:fh3uji;8:8jn9jkdj6eh5;1:jh1wn3;2:8iz;1:aheejeghfjhekjflkhqhermfwhe;1:ej6hijrjptjouhf;2:8hegipkk8lguqjmtkg;3:wkf;1:0hc3hd4jo8gb9j8ah4bh9chbdk5elzfkaggpihekjvmhgphdqhauj2wh1;3:8gxalsehafjmghgjhckh6lhcnh5ph0rjotkbujkwhf;5:bhegjr;3:rip;1:hit;6:ek2fh4;3:9h7dioej8flhghf;2:4jb8gn9jlahdfhdjjgpk3;2:bhdcks;1:0iq7h68imwl3;8:1jy3j34je7hd9g3ahbbhgdj0eh2gipkhelj0ohhqiurgruj5vkpwhc;2:0ir5in8ju9m8ajkbivcj7egyfjfgh5jipphgrfkuh7whb;3:ahcdjzghctjlukc;9:2h73he8hb9ivbj1oleqjz;5:4j1;1:rjh;1:ej1;2:chgejdrj9;6:4mv;2:ohgpn0qhg;6:uj8;3:hhhjja;3:1r52gq3l35gv6h07gt8g7afjblmcg7dgfegcffogeehh1ij4jfukiklgamfknj2ok8pfaqjirjhsimtkkukhvh4;4:0k61ir3ix;1:5kh;1:2kn4gusiyvlm;1:cjsrha;2:rjs;1:3jc;1:4j8dlieghghgjh8kkctiyuin;8:glxqj9;b:0m2;m:ckvrhh;3:8go9jsagybhgdj8ehfgh9jgzrhcsk5upewhh;3:ikj;4:pmmqh4;2:2k44jp;3:qjv;2:hin;3:sj5;1:eipfja;e:5j9;6:1k3;5:gjr;f:gj6;6:hjs;a:gje;1:8jt;4:qka;6:olc;2:5kqdhfej1niy;2:eipfja;2:0jb1hb3gb4j48kp9hdbjeghghgmkh3mhanheoklpipqirtlquh5wh1;2:4iucjrrha;f:tk2;2:diweh8;1:wjp;3:1jq4ipghelj8wl1;3:git;3:0m81h9biocimfh2gh2hkiihcpjcqhetheuhfwjx;6:9j6mlcuhg;4:8j4ck2rgk;7:uiu;1:fjf;3:1l13fg4fr5fx6g77g18ki9fpaj7bkicj2dfcejrfl6hkfignjdekislkkmivnnaod9qfztnaujavgewet;3:4ix8jl;7:eik;3:5jk;3:8m6ak9cizeh4jhcrj4;4:fj6;9:2kp;1:8jmdj0eh7fjcgj7qk1uhh;2:wka;3:0h41l33j04ik7hf8ha9k5aj8cgpdh5eh8ggghh6il9jghkiulhemj2nh9ok3pgyqimtgqugnwgf;1:4j38hfahdbh3cn4fhcgkb;4:nkopjn;g:jjc;6:5j8;4:qh7wlp;1:nk2;5:8j4ck2rgk;2:ljb;4:0hd1ja2it3h95jd8jv9gfah0bjachdfhhjkpkh1lhemizok8pjkqgsrgmthcuh6wgm;2:ljb;a:rjw;k:0jt3grqjxshe;c:6kriit;5:rj0;4:1k23jh4jj5mf8h9gisjgtohhqivrgqwhe;7:qiwwk6;2:3hg7mk8gu9jkalsfglgh0jjhph9qgwrkcsh8wgw;5:gj1jitsix;4:1hfckbfhagh5hk3jhdkjcsipuh4vk6whe;2:eiulk4;a:8k2bjm;6:mk0;3:dip;4:ggvsjsukm;1:uit;6:ris;e:8jq9h3bk3eh5;3:jj8;1:9k0;1:jhfwjn;2:iipoj2rje;8:2j0ojj;7:pjz;1:gjr;9:jjtsjk;1:2k43hf7k89imbimdjbfgqghgjgpkjblh6miqojtpheqh7uiqwh6;6:qjk;3:aj1bj7knvlgzwhg;1:jjb;4:7kjgjjjhd;3:1je;9:agjfgagqmhjt;j:hhbjj6;3:2iz4jp;6:oheqku;1:9j3;6:jjo;8:wjr;2:0gh1jc2h63fx4j95h66ha7gq8n0bfncitekxffjgfojfkkinlk1mgwpglqgcsgxtjwvl1wkw;2:jje;5:rj0;2:ajcfhd;5:gje;3:8iq9j7ainbj9;5:pjr;4:mio;4:nizwk4;i:biu;1:hiltjxuhd;2:8h7chgfhagguhswjlirghuhfwh8;1:6kpgj9;1:1jd4j28hbahcbjicn4dgyeh9fj4ghgkh3;5:6js;5:1gsbj3dhhehhfhegh4hk8mh8nkwphcsiluj4wjf;2:ej3gjphgujjn;4:3j35kk;2:wju;4:ljv;9:8iofir;4:dipuje;6:fix;4:0gz1h62j23h14gw5lv6ma7ha9gybizdiseh8fk4hjjih8jfwlh9mh9nh2oikpgtqflrgnsh6tikujxvir;1:fkk;3:8jw9heghdqjprk1;3:3hg6h97gy9gnbjedioeilfjjgjjjgwkheqh5shbuk8wk7;1:gim;2:4irqirrjttlmuhd;a:biz;1:jkf;7:ojh;8:4mb;2:3is;3:1hb8h09kvaixcisgh8jhcrjrwjm;7:qk9;7:8gr9glahddnhemgflpgh9jh9uhawhd;1:fis;2:hk7rh9;6:oiz;3:9j6fjmuio;4:wk9;1:ej3;3:tiw;9:4ingj5hilrjo;2:dj6;8:0j64ix5kp8hfahffjngh5jgzqhdsm0whh;2:3hd9jhajdblgegpfh7jjikjhnhe;c:8it;2:cjt;6:2k98hbbiljhdnmzojvph9wh9;4:gko;1:rin;4:ajw;3:minukyvgb;1:0gx1gz2h23go5l66hf7h58iq9k5bkqcrndh4eftgg5hguijjjflkl1lgpngqoh3pgfsgwtgvwg3;3:ris;d:bjf;5:ml4;1:eil;1:hjh;8:njg;6:7jlhil;5:gjr;1:uj8;3:5jk;6:jjh;2:3jp;2:iir;2:gjk;2:2il5j1ahefhegj8hgrjlflj9qj0;2:tjm;2:0jbpjo;2:8h59ipbljdhfeh8fh7ghfhiljh6ojeqhgrhdumjvj8wgz;1:0kq1it2hb3h04k85h67gy8fw9gxagobmhggxhioijojglkgwln4mh9ng8oirpkeqgjrgwshatipugkwfu;4:9ix;4:ej1;1:bkmhivojk;4:jkr;4:0hh1hh3iw5h88jo9hcbh7chdegzfhdghclgxoj6phcqhcrqtshgthguj0wil;2:dj7jjj;8:mjh;1:1jg2k26j8fh2gh9jhakiqmiuoikphcqhaujfvh3wha;3:0itbjj;g:fjolj9;p:2iwdhbeizfgyghfjilmjdojdqj1rjcuhgwha;6:4iucjrrha;6:0l2;4:jja;6:ciy;5:jh5qnk;2:cjsrha;1:fjc;6:bipdioujb;5:eiu;5:9hcrkc;2:8iv9j6;8:kgsnh7pml;5:0inriruiu;5:egrfjo;4:cjg;n:1ha3kj8l59m8ahbbhbdh5eiqggujj1ohgqh5rh5thgugswje;d:6ko8kh9h8bj2jhgujv;2:rkythe;2:aj8;2:0iz;8:qiy;1:6guainwl3;2:1hf3h98ipahabh9cjadgzfixgh8hktjh5misrl1tkhuhc;6:qk8;1:aiwehffhdkm8mjj;5:9jpehf;8:2ik4kc7ky8h89hbblacjseh6fhcghbjh8rjjthcuh6whc;7:wk8;3:hin;4:bjg;6:0hgiju;4:7k2;5:jl0;4:3kp;5:qiq;5:1je3itbizdiygh9khalhhmk7nhgpjxqjgrfstiz;4:bkqeiyjj3qhbsk5;5:hgwjjr;3:kl0phg;3:0le2jp3j35jn6th7pr8df9eiadbbabcc3dewebzfhdgd3hcvifojkdlk4mkhok9povqrsrf1sfptgbuayvmiwnl;5:2gw7k6;2:wk9;1:pjr;1:0h91he3gi7ml9gjcjcdgeegjfgngh9hlrjnumk2phaqgqshatjzuh7vhgwgj;5:0g71om3h24h55hf8gu9gfbh9ckxdhdegvfh1gjlhkyjgjkhclhfmjloh2ph7qgsromshgtheugzwgy;8:uiu;1:8j59jxehgjj4rjduh3;1:0h94he5hg8l19l8aiucgxdhcegvfgygh5hhfjjnkjulfzmhfohaph9sh9thcuinwln;4:0is3jwajnbj5dikrh7;3:fh2gk5;1:0jy3h1;j:uiq;3:bgzgl4qjr;7:fhfgkq;2:pjy;1:mkirgx;7:9jb;b:8fm9lfujhwji;3:klh;7:cj1;h:8j1;5:dkeeha;1:1jm;3:4ko;2:9kz;8:fjq;2:3j7;c:dguek5;4:jjb;1:1hdglhlk3nhgphfrh1wko;1:1hb3h68h4ahbbj2cjffheghghkijgvkhhlhfpheqh6rkytk7uhevl9wh7;1:8ir9hadjhejr;3:aj0fiqsj6;3:wkr;4:1hf4iz8h4ahcbh3cn2fh9hhgkh7mpbrhgthf;1:0hf3jh8h2ipzwhf;2:fhfgkq;2:0kf3k6ijkqjwsh5;1:1is4kx8kubh7dizkhf;3:8ghtlr;1:dka;2:0hg1hg3hg8h59iyaplchcehbffuggfhhfjjzkhbohdph6qh7snpuipwh1;1:1jz;3:qkp;1:0lzjk0;3:rjw;5:bj5cizhktjiv;5:jhfwjn;2:cj3;6:qjt;2:okmqk8;b:njg;2:0j7;4:9ioej9;7:lji;3:8j4ck2rgk;1:4lr6kn;a:klh;5:pj9;3:diy;4:8j9ehc;1:tjm;2:8g79jrnlqphcrjeuju;1:ml4;2:8io;2:jjw;2:8j1;a:rim;2:qk9;7:qk1;2:3kgqhg;3:8gj9k2rjk;c:0iodk3gjujj6shc;c:qjt;5:pk3;3:fhbwkg;1:uja;7:8inciu;2:ojn;1:eil;2:ujs;9:2hdaj6oje;e:hjv;2:dj5ehgfhcnjdwjs;4:njk;9:8ikeil;b:fissj5;2:1k53jn4jmgixjhbqjdrgy;2:ciw;9:jjfnj1;4:fjq;1:oix;4:0gvikx;1:plt;9:8izahdbjschceh0fheggvjhgkjnljonj2qjctj0wip;3:9jw;d:4mv;2:0j0;2:oj2;2:4jt;4:6k88medloeg9jh6pkpqh1uh1wgy;1:4ik8h99g0ahgenjfkmgh9jj1uitwhd;1:jjb;6:rkythe;2:1jvrh7;h:8h69iqoknpk8;1:tiu;1:aipgisjhfrlfwjb;2:bjg;6:tkj;2:hhajlrwj7;2:3kn;4:4jh8gf9jtehejhbmkzuiqvji;3:1jkbkarhd;3:8k4akidimfh4tha;3:aiy;c:0ks1gr;e:airbh3fh0gnkjjk;2:3k08jz9n3eh5fhfghfjjjqh5uhb;a:0mt1gl;1:0hc1gb3hf4h35hg8jg9h5ahabhbchfdhgfj2gh3jhbkjrlkynndoflpj1qgyripsjzwh4;4:5ml;2:bka;1:ej3;2:9mvahbbgkcjafjfghejhbrkiuhewhg;4:8ju;1:0jg;3:8hcdk7;3:tjx;2:0h61hg3im8gt9h3bhachbdh8ek8fovgm1khdlhgmhbohfph7qh2rgpshath7ukpwgz;8:8g0angnisqk8uhfwhd;1:ait;4:dh6ejd;4:4j8iiq;2:qj0;2:bim;1:lji;2:8ip9iuaivjhdrll;1:8iw;4:aj1bj7knvlgzwhg;1:gjr;p:0ha1h52hg3he4h85hd8l29jzah3bgrchadh8egqfivggphhhjh7kgulhdmhaol2ql0rjysl2th1uilwgx;2:fhggk0hj5;1:0jq3il9heajabm7fhdggtjhbkhhohgpherjbshg;5:kko;1:9je;k:ljv;9:wja;2:jjw;2:ej4;5:8iw;8:lji;a:9j3;a:uiy;e:4iv;2:nlc;a:gj9;1:cla;4:9k0;2:ajifha;1:tjp;5:9je;b:njg;1:8kf9kpblnegyfhajhckjtnhauha;3:8h89ju;3:0jjwjr;1:qh7wlp;4:bjpgjo;3:ait;1:0gv1gs2gu4gf5gx6gp7fx8jb9fmal8bkpdh1ejmfjbhgtilsjgcklnlgwmgpnmyogrpg4qforhfujxvhc;6:0il7h38jbjivkh1mmrogrpharh4wkk;3:rjw;1:qka;8:4kkdimuj9;3:lk8;4:0hh8k39nrah4bg6ck3dhcem0firgh3jgvmhdphdqherjothguh3wh3;4:7j58j1;1:3lsbjq;f:0ka;3:0ip7gw8ilsixwky;1:ait;d:9jb;3:oja;8:bjp;4:cjbeilfiogj7hitphg;4:djz;5:niz;1:bj8;4:dj3eix;6:1j72jx6j47he8hd9heahbch8eh7fgqgithk7jgzllsminnh6pgzqh5th0uj5vh1wh0;3:ljd;2:aja;1:nhaplm;9:uk0;9:9h8ckzrin;c:9hedkdegz;3:khdmpk;7:gij;2:ujr;1:1fjah4bh9chceh9fhgggvkoeljmnj1qjdtj2wis;5:eiv;2:8hf9jbwjn;5:8iyaj2rjq;3:bkb;5:pkw;1:jk8;5:0ke1gr;1:2kcbiqjhhok5;1:ciy;2:ahcfh1gnljjn;1:kjwlivrld;c:3l94gi5gu6jp7g78ep9iwah6cfudjzehfffaggqkiyljbmkgokiphaqgisj6thgug6vjxwkr;8:9iydli;1:0ka1it3jzghcijinj4qjqrhash4whc;2:pkh;1:ljb;1:4imljvrh1;6:gj4hjv;c:1kbwji;3:ciufk4;5:9ikbj2ej7jj4;1:ajgfh5;1:lji;2:jjc;4:fjq;3:bjf;5:6m6jhfohapj3qh6uhbvkfwjk;7:3kifkcjkluhb;5:uiq;4:pla;1:5jk;4:8j1kjzljytjbwh1;5:sjo;3:ujwvhb;3:7kd;9:8h59jleiwuit;p:djf;4:8jalk1tjfwh9;7:fin;1:bix;i:ej3;2:jkb;3:jh6qiswls;4:nk0;7:rjh;3:9jw;2:8ir;7:4iv;2:ait;5:7js;6:nlc;2:ris;4:9hedkdegz;5:rjh;2:3he8kr9lzajsblncfsegkfh7ghdjgyklvlh7nhbph4qj0rhduhdwh1;2:siw;3:iki;4:8jl;4:ek0ukj;5:rjb;1:3j68lo9iqaknbhecgmdh4eh6fgyghbhk3jgdmj2uhbwj9;4:ujr;f:ej1fjlkgplhfnh6pmg;i:aivmj4uki;3:3ix8ktbisjhcphhqhgrksskrtgzwhb;4:4iv;4:wk5;1:ahdcko;1:aj8;9:hj6qji;1:2ix;4:uiu;2:git;2:fjq;1:qma;1:cj1;e:hhhjja;2:ika;5:iir;9:9jddj6;f:djy;d:aj3bjtjhfkm1lh3ohawjd;4:9j3;a:0go3izikw;5:0hagkihh1ijqjkk;5:3ja;9:8k0;5:0he3he7im8gyah0dj9ejbgh1ph7qkgrjdtiqum7wgy;3:9hedkcegy;1:3j1;7:ikj;7:6hejh9qheukxvmfwiy;3:glvrh6;2:3is;2:nlcphg;6:rjw;d:6k7;1:jhark4;g:8ir;2:wk9;2:ml2rji;2:9iybkpghekk4nhdphd;2:8hdlkm;1:eil;2:3lraiqbjacj3rhf;1:4j49hfaiyeimfj4jhgwjq;5:9h1dimeky;4:0h61gs2hg3h24h45hf7hb8hgakobgrcghegwfhegjwhh0ijojinlo7mh0ogtpggqgsrjkwks;3:fis;4:rjfsku;2:jiusiy;2:jhbwjt;2:8it9j4ahhciw;5:pjw;4:0hd5j68jc9inbhach7dh6flbgjkjggkhhoheph9qjfritth6ujnwh4;i:9ioej9;a:jja;4:lji;3:gjr;9:8j4aj3eharin;2:biljj0;1:dj4;1:1k4;1:0h51h33hc4hd7ix8hf9hgaipchaehbfhehjiik1jg7kgrlhdmitnmqoh7pgzqirrh8shdth9wlm;7:8in;5:jj5;1:0gp1gv2h73k54gt5h46h27k68k19k5ag6bkkcgcdm1ekefg8gg4jgrkgrlh1nhaoh0pgrqj2rhctj4uixvjawh5;1:hizjhc;3:nmhphe;6:8jl9hfcj1;8:8it;1:ak8;9:oj2;1:6hgphcqmowh6;1:glxqj9;3:1hf8h09h6akbchdfl6ghdjherk2tkhuil;7:njg;1:ahfcivfjj;2:dj7eh7;3:9l6ajbrj5;4:oji;2:8k09hbdkmeh9jiz;3:1hd2k13h94hg8gh9jyagfcnydhaej2fj4gjajj4khamhcoh5phcqhgwgw;8:8kq9itbjhhhhrh7tjeuj5;2:ojy;3:hh4jky;3:4ka8hg9h9ehdgjrjkxqivuin;3:wjx;3:ujh;1:1kv2fz3hd7qbah9bh8chdgh5jijmhgoh3ph8qimrh7sk9thfuh7wj3;a:jjw;3:1j92kb4h77k29hdbhcdh6einghbjhekjelilmhgnhfojcphaqhcrhetirwhe;h:0k78hfcirrjw;8:diopjj;1:djduir;4:aiwchajhcsks;1:5lg6kohixiiqrhawhh;8:hjs;3:3ju;2:3ly5lxagocllfh7gh7jh4phhqhfrj3wh1;3:mkirgx;6:ciy;1:5j4hmijh7nj9rhf;4:8gg9k6;6:jkk;f:rip;2:dip;8:0ix;4:7jccj6qjk;d:5mqjh8;5:qjk;2:jjf;3:bkb;3:djcumwvfm;2:5iydgkekcniwsj2;7:ej1;c:1l1;3:qk9;1:1k3;2:aj6bjzjjbrj3;a:jjg;c:8iv9iu;1:gkk;8:6mpqgs;3:jizmjkrjl;1:olm;a:cknghehkbrhcsja;5:0nj1jnqhe;3:0gx1hf2jy3h64m3chdeh6fh9hlvihgjh3kh8lhcmhfnmdoj9pk0qgvrgzshath7uhawge;4:8iq9jeajdbjrcj5egtkjhnhg;3:0k81gmgjp;3:ciy;5:cjedk9sk6;3:8j7;f:8jl;1:5iq;8:qle;7:3jw8k39hb;1:jjm;5:pjr;2:3k1;1:5j2;1:8irlhdrjn;2:fh3uji;h:9h3ck9rjh;7:bjk;9:3jy;2:4hfpli;3:bikej0jgrpjbqjauj1;1:mj7;f:1k73ha4ix8g39h6akkbgxch0ehefjugh7jgzkl3lkpolephdqhargpsimuhdwgt;o:eiulk4;3:0ha2k73hg4lzfheil2khdqhguiw;9:4lpih6;3:wk7;5:3k1;9:dikek9qk7;a:9hdbk1eimfkk;4:gjd;1:8gtum3vjf;3:jjk;4:rhhtkv;d:bkmhivojk;1:5jvbkcchbfj9;b:5lrohc;2:qh7wlp;2:2l93jb;2:8hdiq1;f:hgwjjr;2:dj8ehg;a:4hfpli;e:5jk;h:ljd;1:rj2;2:fjf;2:liunh9plj;9:jll;4:lm0;8:ujg;4:tk9;i:3jh5le8hbdgyehhfofghbjh9khc;2:cj3;2:8jl;2:okw;4:8jicjqhiorhctk5;a:hjr;1:0kw1ha3hg7ja8gmdjxeghfh6gh0hjxihemj3phgqh8rjqwja;2:pl9;1:girhil;3:9jb;2:lk8;1:0md1je3he4gt7he8hb9j3bhdcjydh9ejbfg2girjj4khflimmhfoh6phaqgmthhuhdwjw;4:tjm;9:lj9;2:dgpeknkjb;1:fj5;2:nhcpjv;3:3ja;1:jjcsj1;2:8j9;4:4jr;4:ahfpk8;1:dhaej2;1:jmhqit;3:tkj;a:bj8;6:aj3fjmrju;8:ml9ojnuhf;8:rit;2:9ikaj0fin;2:8ki9h1nis;1:qka;4:eiufh8uk0;8:okm;7:0hf1km4he6kfbgfkk6ll2mhaokypgtqhargwuhfwhg;1:ahdckmsj2;5:8gx9jl;3:gjv;3:7iz;2:bk2rir;1:biz;3:bjuciu;6:tjd;1:ojp;1:wju;6:ah1fh5glkpk1sji;2:sj7;8:hja;5:0jt;1:jjx;4:wjv;4:sik;1:8hdiirtmx;2:iis;1:ej8jhdpmw;5:lj2;1:5mibgyglfjhfqhe;a:1kogj2rh0;2:dj2eh3;2:0he8jagldjjjrjjshcuhb;1:ris;3:8j29ikej5pjh;5:dit;3:jjx;1:3jp;1:pjz;7:ajpfgy;1:8j0;1:jjo;3:iis;3:qjv;c:8jfbj4chadj8eiofgznixriywjc;1:dj6;3:fj4lj8rit;d:ej3;2:wju;4:0kn3gu4jgbjsrjc;3:7kj;3:1k73ha4ix8g39h6akkbgxch0ehefjugh7jgzkl3lkpolephdqhargpsimuhdwgt;5:0js;2:7leij1qio;4:0l2;2:3j96hb8hgehbghfjkcojbpheqh7uksvm8wh9;2:jjf;3:1l2;3:nj2;4:8na9fsajpfhd;1:0h31h53hd5iv8iwagzbn3ch7eh8fhegk6jhakhflj1mheqjarh2sguthgwk0;1:7kd;4:njg;3:bkmhivojk;6:0jfcjr;3:4j5ahgbhdcnafhf;8:4jjhh2jkaojr;l:8jq9gzqjq;e:ikjqit;1:bip;4:0ivcj7dgeejmqk2;3:0j4;8:8h9unc;1:0gx1l27harhgskz;3:2jz4ky;2:2ml7jloiv;b:cjadgiejr;2:fis;3:sj5;1:djdegtujp;i:qka;3:gir;1:8j9;2:6kp;2:2kr;6:ein;4:okm;c:pmmqh7;2:angbjgchdfgwiiyjhcrjx;1:1hc2h63j44j78j69kibhachfdgseizfh4gh3hhhjh0khgmjwnhcph3qh3tl9ukvwh8;3:8hb9ix;3:qk7wkk;2:rkythe;4:2jw3j48he9h6bhcjkiqikrhcthhvlrwgz;4:hjm;8:1lq7hdwh8;2:9j7;4:hj0;6:5lrohc;2:5lmhjajh3mj7oh8phhwjy;1:jjl;1:mkirgx;1:fjq;2:7lnhgojjophgrlpthcwhe;1:rjfsku;1:jhbwku;5:4n0iiotiq;4:bim;8:8iw;4:0fs1nm2h53gp4gn5h26h77h7akdbgnclbdgweg6fgtgiuhkcih8jhbkgbmizngtoispg9rmwsmstguufyvhfwg5;b:bjbjk2qjbsjh;1:rjt;6:ciurjy;5:4iu8heah7ehffkdgh0khbok5rjfwkl;2:cja;5:4jr;d:pjz;6:bkihimjhgmh6ojftmiwh5;1:jj0vkb;1:rj2;4:pmmqh4;4:firtiv;2:pl6qhesjhujd;2:eixqk9;1:ml4;s:wk8;1:8j9;3:cjc;d:8is;9:3jtch3fji;b:ciy;3:jjgpk2whf;2:wk9;3:tkj;a:0fu1k32gq3g74g95gt6gy7gt8kp9h7alhblhcjmdebekhfl2gkjjf3lj8miwnl1oghpfxqh0rh0sgmtjtuhgvgzwgi;5:sj3;6:8kkthb;4:8j59hgukd;5:4jfjjd;2:1kf;d:bilkjk;2:8h29jvblkfhfkjknhh;8:6jc7iybhgmkiqioriw;3:gjr;8:ej0njj;1:wks;2:8j2;1:tj4;4:3jy8habkichgdhceimfhfjiskhfohephgqkfrj0sjwthbwhe;d:8ixbh9fipkjr;3:7ko8j2bjjjisrilwhe;4:9izejkfgqsiuuk6;1:5jj8jarir;2:gj5;1:pkh;7:2ml7jloiv;7:4iz;7:biuuir;5:8jtiit;f:0is;b:1iwoju;2:8gtum3vjf;b:1k53jn4jmgixjhbqjdrgy;6:jj8;6:gj1jitsix;5:5ix9j1fhenj5wjm;2:8jmahgdhaeiughejhgkjtlirqhhrl5whf;2:bhajhgkjrqlf;7:fis;4:ika;2:ohgpn0qhg;2:jj8;2:7mp8hehj3jgduil;3:8j9;1:2ir5j7;3:0ft1f12gn4g16gr7js8zs9j5afwbpkcejdfweg5fj3geihgsiggjf5knglj0mnmnfvofgpf1qg6rhgth6vgmwgg;2:lk8;2:3jf4jnwjn;1:0lq3in;3:iir;e:wk7;4:8is;6:jjv;5:pk1qjh;5:7mp8hghj4jgf;6:3k3;4:9l5ajw;3:3ha4j1fh2jkgwlp;1:0k61ir3ix;d:eipfja;3:hja;4:gjr;7:uiq;1:okm;3:5lt;8:3kenh9plg;1:0iw1jn8k19gwbhfcildk7egifjtghc;1:gin;9:8hf9jl;2:4ju;9:0j7;2:8h99heeoafkeuhh;e:0jl;4:aimgjtqhfsktwha;3:fh1gjkwjv;a:qk1;4:wjv;4:aipbjd;7:0ha2hh3hc4jm8g89j6ah2bh7ch9dk4elxfk2ggnihdkjsmhfohbphaqjfshguiuwh0;6:fjtnhaph8rk4tkpuhg;3:ej6;6:pjz;5:8j79ixaj1;1:0l78h09hfah0bhfdjcejaggwjhblhhph7rj8timum7wh4;6:0kn3gu4jgbjsrjc;7:4jw;2:0j0;9:8j1;3:jjf;4:wjg;h:0h81jw;5:hin;3:kjq;1:rkythe;2:8he9j3dlpehc;1:8hdlkm;1:hil;d:lji;1:bjp;1:4jjhh2jkaojr;3:9j3;4:bkb;9:6kq;2:hin;4:1j8;2:jjk;1:eizpjj;2:9j3;a:fjq;1:9j5;3:cj3;6:pk3;8:fit;5:mjt;g:bixcj1gimnjo;3:1k3;a:qkx;e:8ix;4:0iu3oy4he9gmahdbj9dh7fh5gh1hinphgqirrgxsh3tk1uh2vlcwgh;3:dj8;k:aiwlizqk8;4:jl0;a:8jd9hebhccjmhkfjhbmiwrh5tknuhf;2:cjnwjs;5:7iz;2:0gj1h02gy3kz4h75hd7ha8gi9gsagpcgudh0eh5fhcglehqpihdjlvkhalhgmj4nheohbph1qgkrflsgoth4ugrwnt;9:ejn;1:0jo;4:mj7;3:kjq;1:7jfajzbikcj9fheghbjhckiwlklnhf;1:4j0;4:8jvbhakjr;3:8k19n6eh7fhhjjnuhc;4:9ilwk7;2:1kf;3:ris;b:aj0;3:0fu1k32gq3g74g95gt6gy7gt8kp9h7alhblhcjmdebekhfl2gkjjf3lj8miwnl1oghpfxqh0rh0sgmtjtuhgvgzwgi;3:eiv;5:8it9j4bjd;1:5j8njg;2:uju;3:8gg9k6;c:3k3;1:8j9;q:qki;7:8h09jhejyfh3;5:0hg6jx7kjbhejh8qh5rjqvj5wjj;3:aiteh9gjxujs;4:lj4;4:njz;4:hja;2:bim;1:0lq3in;1:plh;2:6k08heaizbkqeixgjhjhekh8qherh2uhewjc;2:mjb;5:4j7ciydgiejq;3:biz;7:1jl2im6h37hd8in9hgeizjh2pkpqfxwmy;3:0hh8k39nrah4bg6ck3dhcem0firgh3jgvmhdphdqherjothguh3wh3;9:0gy1ha2hf3he4he5hh6q27h89hcbilfgsggthkekh1lh9mkfnheojvqg7rgwshbth3ug7vk2;2:8iobj7dlxejqfhd;c:3kh8hf9hgcjddk3ehejhgsk4uhe;5:4ju;1:gltjh1ohbqm2whc;2:2im5j2ahffhhgjahgsjk0ljaqj5;6:wk9;4:ejy;4:uit;2:0gj1je2h73fz4gu5h76hb7gr8n3bfpcivekzffkgfrjfwkiolk3mgxoispgqqgesgztjzvl2wl0;4:qiwwk6;h:kkbphh;3:bkf;5:eik;1:aj5bjpfjmkheokk;2:sj5;1:ukj;a:0io;8:lk8;4:gl7;1:9jpehf;7:ein;2:bim;8:6mf;2:qk1;7:fk0;2:pk7;7:0jcil3;1:fmgghaukg;2:iir;b:biz;4:fkb;6:8kodjoiir;8:bj4jj9;8:gl7;5:hjssj2;1:8k49h2ahfcj1;2:0j71jo2fl3ge4gz5hb6h67pf8gx9guagncgndh1egsfgoggjhh1ih7jmqkjzlh3mgsniqoizqh6rjpsjetk6ugdvhe;2:3jr;2:8jl9hdckt;1:dkeeha;2:gje;3:git;6:giphju;6:4ir8h8bjdchdeilgjzqirrjbth6uh7wk6;1:qk9;6:0jl;2:djaej5;8:0ix2h64gy5h86hb7gw8nc9mdagebfxcgzdkoenmfg3glbhgyjgukghlh2mh5nh2ojgpitqg8rg1sjwtgqvh6wg3;8:iki;5:8k3ahbfh0gnuuh8;8:aj6bjzjjbrj3;6:5jj8jc;4:cjnwjs;2:0ij3l6;2:8gx9jl;5:3kgqhg;1:fjllgwrk4uip;7:8ineil;c:9gwdkqenygha;3:0mw4h89jfaipckcfh9ghdlhgrixwh5;1:3jk;1:biu;1:9ir;3:qka;4:lj3;2:1h98ha9jucl6ghgij5rjf;4:bkbhix;1:8hdjixrjauixwjw;2:0h91hb3h04hg5hg8ga9gjaq2bhacj9dhfefqfotgkthiyihgjgbkiolhfmhfnhfohephaqh1rgssh8thbugowk1;2:0lm;1:1j8;2:8ik;4:dh7fixnj6wjq;3:9j4;1:fk0;4:9j7cjeeh7;3:nn8whg;3:ij7pkf;3:bkjkhe;2:ejl;4:lku;b:kh5ln4phg;1:dluehg;4:uiu;2:wju;6:3hg8kq9hdeksjhfuhd;1:bj7qj1;3:cjg;3:8hg9jk;5:2jz4ky;1:1jvrh7;4:jjj;1:8k19n6eh7fhhjjnuhc;5:qk9;1:fjf;4:ajhhjfjh5;6:9iu;d:rk2;1:8j9ehc;3:jl7wka;3:ginriv;4:6k6vj6;1:2k9;3:9h8disejg;5:8io;2:iiqrjh;3:2in;2:jjb;6:ahecmxwjl;5:wit;3:mhetl1;5:8iq9jeajdbjrcj5egtkjhnhg;4:8gx9jl;7:oj2;1:dj3eix;6:7lfqiq;7:1lc8h19j7ah4kl5;8:ahgcj3iir;1:0lj2mf3hf4hh7jg8jgbheghbjhboiqqh9rh9wh9;2:0jy3h1;8:gjpqj5;1:0gv1jm2hc3h14jq6hc7ha8ip9goagtbgkdfueixgjdhh8ih5jgskjnljxmhenmjoeapkmqglrkgsj9timwgg;3:9il;1:ljb;2:0imqkh;2:bj6;a:9jm;4:4iv8k69hbdgrek6;2:ej6hijrjptjouhf;6:gin;3:3j0bj2jhckhgmkcqjmtj3;i:0hgiju;1:qk9;c:5j9giv;6:0h71gvak2bh6fiuggojh3mmfnpppixqh3rh3wgq;4:qiwwk6;2:bkf;m:mlf;2:chbhkljhemjeqkm;2:eja;3:2he3hg4hd6mm9hbahabgychadj2fkshjvjh7khfmhgoh7piyqgcrhgshgtheuklvj2wh7;2:9hafhehjjjjdmjark3;3:uju;2:0hc2kv6hg7jwjgxohbpkhqkfrjgthdwh0;3:bjmcj5riq;b:eiyfj1;1:0hgiju;1:ah9dggel9fp3gjnjh9phdqh9rhcthaujywhe;2:kkblgx;8:iiqrjh;1:6kp;6:ujwvhb;1:5laohd;2:pl9;1:uj9;4:qjk;5:dj7jj5;2:dismio;6:qj7;1:9jnajhrja;d:2k68h6bj7fgwgh9jjrojzphfqhcwmi;2:6jx8gr9jwdjdegmfixjh2rhcumnvj0wha;e:8io9jdajbbkxcjoegtghfkj8nhf;1:bilkjk;2:niz;3:7kiqiv;3:8hflly;d:bjg;2:3ix8ktbisjhcphhqhgrksskrtgzwhb;5:mjh;3:jj4;4:dkq;3:ein;2:siw;1:2h57jn;4:diweh8;3:qka;c:7jlhil;2:8k29h4;c:2iwqjt;a:aipgisjhfrlfwjb;7:8jo9gyqjpwj4;8:biz;6:4j0uh8vkd;8:diweh8;4:4is8hffm5gh7qirrjvtheuh8;4:4indh1enw;h:0gg1kv2h03gk4gp5h36h57h39fjamvbilckqdexem3fkdgkmhirjflkg7miwnmbogrpgbqg0rfrsgbtjwuh3vh7;1:aio;e:1h22hd3o24gx5hc6jf7hd8ip9jmah7bioch7dh2fgsgglhhcihdkgxlhamh9nh7oh8pgqqjjrgdsgttnjvl1wfx;8:bje;6:3gvvm6;1:2kk7jr;3:ej1;1:wk7;5:chchkmmjh;3:bkqeiyjj3qhbsk5;2:qk1;1:dis;1:dj3eix;2:jjcsj1;3:ajrqkfrhg;4:7jpaitjjmolfqhdwhg;3:8gzujhvl1;1:bj7;6:9h1dimeky;4:2jz4ky;1:ejm;4:3k0sj4;1:gjw;3:8l0;2:ljv;2:1jf2k16j8chgfh2gh8jh7kiqmitoikphbqhaujfvh3wh9;g:0go2je3gm4na5ha6hc7h39g4afobg1cgndg5ejefk6ggfhh7ikbjg6kodlixmgznl5okeqgerg9th1wfy;4:tjd;8:9iw;c:0h11g73ld4fk5gk6hf7jb8ftaqybhgcj3egbfsfih8kgolg2mgcngzofyph5qg0rgpsgrtgxugrvk3wim;1:cj1;3:qiq;h:oj4;4:gkk;6:2ml7jloiv;3:0ff1kz3jp4gk5kv6go7gy8jq9gsafncf1dg4egdfgpggqhgmih3ljemg9niyoj3pguqgrrqhsistjruk9vgrwix;1:jj2;2:0j01h23fy4kg5h67hd8j29j2ah1bj1chbegufh3hgfih8jhckgulhbmk3nh6okbrhdshftmpvj5wgr;9:tjp;2:uiu;e:0iz;9:9ipeiq;2:0hf1gs2hd3jn4h85h96hf7h89g1agsbnocj5dh1ehgfgfgh7hkuihckgmlh6mk8nhdohdpgzrk7shctksugkvktwga;3:fjq;4:3ke5kcjhgkh6lk3;g:fizgk2;4:aincip;1:fin;2:hh4jky;b:nk6phf;5:ikj;2:oje;2:gjb;6:8k29h4;3:2hdaj6oje;1:8kf9kpblnegyfhajhckjtnhauha;3:qlh;5:8ivchfdjsriy;7:8jtkj0nheqk7sk0thf;3:6mpqgs;2:ak2biscjfkj2;2:4io;4:ojc;2:gjr;4:sj5;2:dipriz;3:dka;6:hiz;3:jj8;2:lje;9:rjw;e:njg;1:0iudj5ej2jj1;5:7j4;2:qj2;1:ejijh2qjr;y:djwehawj7;4:8kfuis;1:0h61io3hb4gz5hd8ja9gzah3bh2chadheehffiqggxhhfjh8kk3lk9nn2oeqpl5qgvsjrtj9wgv;a:ijb;5:1hb4jojkcqjw;a:4jr;b:fhbwkg;2:8k9ciwuhg;1:5j7;g:3lsbjq;f:jj8;7:uiy;1:0ge2j93k94kv5gw6gd7gp8pe9dtahcch5dkaen6fjjgfkhh4iizjhfkgclgmmgjngvok1pfwrfpsgotgfuimvl5wgp;8:ajr;3:0h51h74hg6h69gxbhach6fgkggqhhdjjokgzljjmiynjbojwpgwqj1rjlsh6thguk0vlvwgo;2:ahfpk8;2:eipfja;1:1jo8hcghfohgqjurhftk4wkw;a:1jo3js8h7ah1ckeejofgmgjcoheqh7rhawkl;e:8hbumi;2:0in;5:0gx1h92hc3gk4h25ln6h17h98j59kwafxbj4ch3dj0eg7fjqgjjihajfxkkalh0mhbngeoh3pgurgoskrukj;8:jk0;1:0hg1ga3hg4hd8hc9giagscjzeoagp2hhbjgikh9lhamhcnj1ohcph8qiorh7th3ujmwgp;5:8io;8:1heghdklaokkpjz;1:7kaikh;3:ljl;f:jir;c:8j9;5:ikh;8:egqfjy;6:jk0;3:qka;1:4ik;2:6n3;1:2he3ji8l69hdrj8tlzuh4;2:8gq9heej1gkthjxjheohdrk6siv;1:tln;h:5jqgkghgzjkdnhgpjwwhg;2:cjhfj5;2:8j8jj2rjn;3:fj6;1:qj2;1:ohgpn0qhg;8:eir;6:8gm9h9biuckvdk7egolki;3:glxqj9;3:4iv8k69hbdgrek6;2:fis;2:pkh;1:8iq9j7ainbj9;b:jjc;a:djaehe;1:ehfjk9;1:fjb;4:0isrjaskt;4:kkn;1:0js1jd8gb9hgahefjlgh7jhhlmpngupl6qhfrhfth8uh8wh9;2:1h9kjk;4:gjn;1:aio;2:ikj;1:dh6ejd;6:pmz;2:0pb1hc2hc3h86hh7hc9j8bhfcjzdhaeh7fgtgglhhhjh9kh5lh6mhcnhgojsph2qk7thauhgwjc;6:fk6rin;1:bkmhivojk;2:9l5ajw;4:ajccivjjgrhe;2:5j2;9:gjm;1:9je;1:2kf4iq5lifjziinoh1whh;g:2h17li;4:mjfwk6;1:2iy;1:4lg5iq6kj8hgbkeghchiqjh9oj7phdqhcwh5;g:ciuhjm;d:jk0;7:0jy3h1;2:aio;3:3j1;e:0h61hd2lz3gz4mb7j18goahgbh7cgxdgxegyfhdgh9jgikhdlhgphaqgsrh4tkzul1vj3wio;2:filriv;2:hgwjjr;9:9j8;5:5j8;1:aj7bj9kj6;6:nj5ois;6:1k0ljt;5:4iucjrrha;k:eiulk4;5:5ko;5:8ix;1:5j8dip;3:ajhciogj1ij5jjckjcwhh;a:5jk;5:1k43kw4jl8hfgiwjh5qjcrgw;2:7kq8j5jiuwhh;6:bj7qj1;3:8hf9k4kkmlgg;2:wje;6:ek2fh4;6:pj4;5:3k1;c:tk2;e:8it;8:1iw2im8jv9gsalqbh3fgfkinliwnik;3:bir;f:qk0shf;3:0hgiju;9:jje;1:pjy;3:4ik8h4ah3djeejdgh3phfrjhtisumdwhb;5:bjcjizrit;8:3jc8gs9h8ahebh9dkjfgrgk5kgzlkomipqhfrjqwhb;10:4j8iiq;e:8l0bhd;3:wj8;8:0h71j32jm3g74ix5h06gy7oo8gy9grbgkchadgtegnfgdih0jl4kgclgrmguomaphfqkfrhaskotgqug6vhawjp;c:8gtum3vjf;1:1jxkjf;2:djlegv;1:9j3;4:8ha9judj7jke;1:dip;5:rj2;d:cj4hkejj0;l:8jj;5:7k2;4:8ivlkc;4:lk8;3:3kmqjs;7:2h87lb;1:wj6;7:6guwl5;6:5mc;5:4it8h79ju;3:1hg7juokfpj4;2:0he1kh3hg4hf6jr7ha8hd9hdaktfjujiwkkioh7ph1qgyrgithhviwwgn;3:6mf;3:njz;7:jjcsj1;2:uiq;1:ahfpk8;6:pjz;2:0hc3hd4jo8gb9j8ah4bh9chbdk5elzfkaggpihekjvmhgphdqhauj2wh1;1:uit;1:8hb9ix;1:wk8;3:lhbqiurjmwk3;2:gk6;5:lj2oiv;1:9gxejdfinukh;5:1h73ka8h89kzah1cm1ghdrjauhg;1:4iq;2:8iv9j6;6:pmvqhewgs;1:rk3;2:ah8cixjk3tmswhh;1:civkkalgw;1:jjh;2:5lt;3:jivmjjrjk;2:8j9;4:4n1iip;5:8hb9ix;f:9j3;9:pl9;6:eje;6:0hd1ha4hg8iq9hdbpwcipgh4jh7kkjllxogkphbqgxrh4uhdwh5;7:aj7;2:jjo;1:ciwhixtjb;1:1jvrh7;e:eje;2:gk6;1:gjcjj9;5:bjecjfshg;7:fjq;4:8jt9h3bjbeh3oks;6:0isgh9qlxrjv;4:gj5;5:eiofj9ij2;1:8ir;6:kkb;4:0lq3in;2:tjfwks;j:8ka9hc;5:gjw;f:gjb;6:hil;9:8g9am8;5:aj9;1:gm8;2:tji;9:gh1sjstj6;1:0fh1jm2gk3fo4fy5gm6gr7gj8ju9hcakmbkwcj6dmqeisfk9gmyjfnkh6livnkmog6pfhqgctjbugjvgswfq;2:0hf3j74hd6mm7h49hcak1bhfchgdgpfgtggsjm4lh2phcqgnriysk9wgs;5:sj5;2:djxehb;1:1io2ja4jb5h96iq7h28gbaghcgpdkjekogfehh9jh8kkbpgjsh7uk6vgr;3:3ij;9:pmmqh7;9:1lq7hdwh8;9:4iz;2:8h29h7akccgefl7ghfjhfrketkjuim;3:8ghtlr;c:angbjgchdfgwiiyjhcrjx;1:qjk;2:1hgahgbjefheojxwjs;b:1gy2ha3ha4nr8hgahdglajh3ohdqhfrgwsimtjrujnwhf;9:hk5jk5qhgrh8;2:0hdik8;2:8kkthb;3:4io;5:pjz;3:8ip9l1ch6eh5jiuml7rl7thguge;4:klc;2:ait;4:ujs;7:0h42k53h64ly9hbah8bkvfhbgh4ikyjhfkhcqj8rhfshfwhf;1:fis;3:mjb;2:wjx;1:ciz;2:iiqrjh;a:8gf9k4dip;7:5ip9j6bj2ml4;8:tkj;7:jjb;2:ois;1:0ljgiq;1:nmhphe;1:wk8;2:jhfwjn;1:8in9j7;4:2in;1:jkwwgx;3:8k0;1:8j7;1:ek0ukj;9:fk5;1:dj0eha;5:3is;5:bj5kkurin;8:himjik;1:ajgfh5;6:hjxtiz;1:5il7k8aikch5fhcjh0khblj4ml1qhgrh7skmwhb;2:tjx;e:8io9j6aimbj5uiq;3:gkn;2:8gzujhvl1;c:cj8hk1jhh;1:3kp;d:bj3;1:0iu;2:0hf1j82n64kkbhfghejgroghph6qlawj1;1:fis;5:1j8;f:ckvrhh;5:jj3ojp;h:8iybkfeh7gh4hgwjmskjynhaph8uhe;j:1h7gm3qjkrgo;8:1hg8hbchhfhagj8jgznjopjprlpwit;5:0he1lm3jd6k98hc9hebiychggh7jgfohfpkjqgvrgqwm9;2:8hg9inuj6;7:pkd;5:pk3;2:aheljupk2;5:0iq1hf3op4hb9gjah1bj2chedh4fgrgkojhakheohephargosiktjtugvvl9wg7;a:8is9j4bh2kj8ljs;3:0jq1jc3ga4iy5hf7hg8kg9fobitdhgeh5fgjggjhhfijqjitkh9lh8mh9nheohdph5qh2shetlvugxwlp;b:bhckjt;a:wk5;1:rjwtlr;4:bjpgjo;d:1jlal8jjdkjbohhrh0uiwwhe;7:aj9;4:9j3lja;3:1hf3hb8h2ah1bjscmoekjfkqgh1jgxkhelhemhgqherjgth5uixwh5;a:8kebjtchgdkgeh2fh2girjjylh6qherj4tinuh5wha;2:8kr9gwaiybjk;1:0h13nl4hb8h7ehgipfjhaqh0wh6;2:9j1pk1;5:pk7;2:mkirgx;5:5jf8j7ohfpjvwhe;6:rj7;1:gjk;7:0gw1h33h34hf7gx8gt9h9bh0cjsdhfehafgrgkthjsjfukivmh7ph7qjhss5thcuglvjvwgp;2:jjcsj1;b:8h89ju;k:olk;8:ujg;1:cj1;2:bkb;9:0he1hg8h5aitbh5eh6fh9jh8klsmj7okkpj6rhbsistheujowhb;a:bj3dgtek3jj8;7:hja;4:fh3uji;2:girhil;1:5jijkgwgu;1:riw;1:qk1;2:fh3uji;2:kkslgh;3:hiq;6:3kajjf;7:0hc1gb2lj3gq4ja5h96hb7gs8gy9h6bh8dh7eh0fgrgjtihajkikgrlh3mhcon6qjqth9ugvwik;a:9jc;a:njwpjn;9:0j0;8:0he1he8ir9hdbo9cixghbjh8kkmlm0ogophdqgyrhbuhewh6;3:ah1fk0;9:ajifha;1:kjr;1:8mbthg;2:8il;4:0kp2h93gv4h35mm6hb8iy9glah1bj7cgydhdeh7fh6ggkhg4ih9jmokh3lhcmhhnh9ojlqgdrnksgotguugdvhcwjb;1:rjv;6:hhhjja;4:wk9;3:0kw1lw;3:mkirgx;6:0ka;2:0hg1hg3hg8h59iyaplchcehbffuggfhhfjjzkhbohdph6qh7snpuipwh1;9:ej1;3:ejc;6:wka;2:finwk9;1:1h62h53j24j68j89kgah1bh8chddh4egxfglggmhhgjgzkh3ljdmjtniloheph1qiwtlgwiv;1:bj7;5:3k3;5:0jk4hg8hebhguke;k:qjt;a:0h62hf3ld4gz5lm7hg8j89g4bgqch2eh5fh8ggphiwihfjh2kkslhamhcnmbpioqgsrgtshdthcwim;4:9k0;7:3il;5:iki;1:fkduhe;4:sje;2:0lm3hfiko;7:0gp1jy2hc3h54h15hb6hg7gu8n1aimbfwdjpejhffpgfvjgakj1lkcmh0oh4pgxqgosh3tkgvhawlm;2:qk9;2:8ik;c:bjh;1:wjg;1:1h0gllhl7jjuqiyrfv;1:6k4fikghfvj5wjw;5:qk9;c:pjj;h:0jitiuwjq;1:dismio;3:4j9;5:uj1;2:6k7;3:0kw1j93g74h76j17im8grafxbladgxfg0gjjigxkg9mgaogbqhcrh2srgtgdug3wjo;a:6k7;6:0h61hf3mu5ik7jrfheghdnh3oh8pkwqh8uhfwkd;5:0jjbjvqk7;3:qj3;8:jj5pjx;6:rix;8:2k9;i:3k08kf9h9bhdcj2dhbekkjhaqhesiquhe;1:hk6qjorh6;6:fis;3:3inah9ehdfh7jlopk2;2:jjg;9:el0;1:dj6;2:jjc;b:il5;8:8jufjggjb;6:rj9;1:finwk9;1:8gr9glahddnhemgflpgh9jh9uhawhd;1:5mc;1:uiw;1:0h51h32jt3h24gy5he6m77h48hg9gmaireh5fk8hjkihckgolj4mh8nh9oh6pgpqkssh3tgtujvviuwgh;4:kkb;2:qk8;e:gj7;9:sj3;8:bjg;9:8je;8:0kd4kx7h8ijwjgpphaqh2uj4wli;b:biz;b:ch7jjkrh8sms;3:8gg9k6;2:0hh8gqahgbhcchbegsfhcgh8jjpml1phfqhdrhatj8upvwha;d:hh4jj8sjl;1:4j3jijohgwkc;8:8io9itaitehefiyjhcrlhwhh;2:ohgpn0qhg;2:hh5jjc;1:2iv7khdj2ehfjhg;a:6k2qhevjbwjz;1:jjc;4:bjg;3:ahefh2gny;4:dj5ehf;4:hin;b:eiv;9:olm;2:sik;1:8j7;3:jjcsj1;3:4mb;1:0hc1gz3hf4hf8j19hbbjnckgdhdegvfjqghaihfkirlirmhfnkmohcph8qiprg7sirth7;1:djfeh3;1:rir;1:4j2;9:2irgis;6:jkv;7:ej0mja;1:1hf6jwgj3ojt;2:qiwwk6;5:rjs;9:ikh;b:wjg;5:sl0;8:8iw;1:pk7;1:tjt;7:hiz;5:qlc;5:tj4;8:ujs;8:0jl1h72m73jr4ha5hh7jc9hhahhbh8chggguij9jh2oikphfqjdrh1sgythguhgwjm;5:hj1;c:0jc4j35kv;5:0h91io2hg3h24h55he7hh9fuaj4bh0clpeiwfgpgjwhkykhdlhgmjknhfoh9ph5qgqrofsh9th9ugowgs;6:ahdejgjgpsm4;7:0gy1l22hh3gi4h35h97h88heag3bkucgqdh1egufgagfgjgykk7lh3mg7nkdognpggqivrkjsjctlpulcvhhwjl;1:cldfh9lj9;2:8jx;1:dj6;2:wju;1:8iw;2:cjxehe;b:8ikdhgej4;1:njg;4:9kz;1:kkaoil;2:3k09k0;9:jinqjf;1:cj1;c:diz;2:0isgjzjjcshf;1:1hbkj6oju;2:oj2;2:3kfakpqhf;6:3kh8hf9hgcjddk3ehejhgsk4uhe;1:3k3;1:qj2;5:rjh;2:lk6;1:dlqehe;1:9gxejdfinukh;3:jir;2:2in;4:0lm;3:1kf5ix8ixeipfh8ghgkjcrin;6:bl6ciuiiprjo;1:ujr;9:mjn;a:3k1;3:djoehb;3:0ix1jphgtjjbqkr;1:ujy;6:3kijgxqhdwm3;4:0gr1kn2gf3gq4ge5gy6h07h48h89ilagibgkcgtdh2eh0ggcih4jgeklkllymgenm6olkpjpqg0rjssj4vhh;2:1k2diveh7tj3;2:qjk;4:hjm;1:0l2;6:4ik8h6dlaljsrgz;h:0l2;1:3kn9iw;6:rip;1:vjg;6:hil;4:0g71om3h24h55hf8gu9gfbh9ckxdhdegvfh1gjlhkyjgjkhclhfmjloh2ph7qgsromshgtheugzwgy;5:8jt9hfalbfgrmizqiwrgyth4uk7;1:0qe1jkjhdqhbrhgwhe;c:8gt9jmahefhfpk7;2:8h99jtdj6jjvohcqkkwhc;1:2l93jb;2:4m3qhf;9:0gp1lt8h49jobj5chcgh8jh5khbmhgok5pj8qhbrj7th9uhcwji;1:8gt9h9dgwenughgjjvlkcuikwhg;c:8iu;3:wjp;2:ahdfh8jhewnd;4:0j2;2:5is;1:mlf;3:tj4;6:jk0;6:ck0;2:9j7plcrhcsjs;2:9ikaj0fin;2:tln;4:ejiliurjj;4:fjx;8:8h69heagzbnpgl1qjmsh8;8:cja;b:giu;1:pjr;2:2j1;9:0h51gi2h83iq4io5he6hf7h58jp9keagibiwcnnfivhh0ihcjfkkgwlgymgzngvogupkiqgmsh6tgkumnvhgwhf;b:1gxbj4fhfghdmh9nkxphdsimuj8wjg;5:oix;b:2hg3hb4jm5j48g99j5ah2bh6ch9dk3elxfk6ggmihakjtmheohgphaqh5shhuizwgx;6:1hf2k38gp9k3ah3cleej9fjegjkjhckhbmheoh7phfwh7;4:fis;4:2k9;5:qka;3:ahhbitcimhkxjhdmiwrhatkn;4:jjprha;2:8hf9jmdj0;4:4jr;2:mh9tmq;2:qjk;i:hhbjj6;5:5lt;2:0f91o72f43ex5ja7he9gsahdbfhcj4dg6egrfeogg3ifzje5kktlmmnjvoruplgqdjrj4sgvtggulevgl;4:jk0;2:ahfpk8;1:1khwh9;8:2it7kgdj1eheljf;1:5ki;4:0jf;3:ajw;5:0lhaj8situjc;1:8ix;1:ek0hhdjj5uki;a:8iw;j:8gi9jkikh;1:hje;5:ajccjmfipqjnsjc;4:ahfpk8;1:jjb;4:6k5aj5bkekhdrhf;8:jkwwgx;1:0he1hb3hd4hg8hdchcehehhhjjakjanj0ohepjfqiwriusjawk1;1:9jb;4:aja;3:4iq;1:hin;2:0iz;3:0hg1hf3in8hg9lobh4ehejhbkh7mpaqjmrhdthcuhcwhc;8:bkf;4:jjo;2:cj9;4:1lk7jnqhgsjpwgp;6:aio;6:5mpjh7rij;1:mjb;3:khelkx;2:skgujj;2:jkb;5:8k4;7:gis;1:8hdiq1;4:1jy3j24jd7hd9g3ahabhfdjlegygiokhelj0ohhqitrgquj4vkpwha;4:bj9qjz;2:3il;2:qk8;4:gjl;3:9hfbjw;5:2l93ja8j0;1:jkc;2:cj4;2:gm5sj0;1:8ineil;1:8it9j4jjiwj6;4:tj4;5:lk8;6:qkp;1:8lc9loaj0bipch3eh0fh4ghekk0lg4ohhrinshfuinwhb;b:mj7;2:0hd1h08h6am9bhcciuflpjh9kh2mh8pkqrh3sj0uh9wh8;3:iis;2:kkblgx;7:2hf3hc4he6h77gn9g9am6bjrfj6gjdhhfjgekh7njbpheqgyrh1thcujwwjr;2:fjf;4:lhdnlvpgs;6:0gq1gw2h93k64gu5h46h37k88k39k6ag9cgjdm2ekzfgaggcjgskgslh0nhcoh0pgsqj5rhctj8uj0vjbwh5;3:0h62mf7jgbhajhckjzlgpqhgrhdwk4;2:jj2;3:0io7h58jejiyoitrh1wkq;1:4iorjq;1:eiv;3:qka;6:jjprha;1:tkj;8:ckvrhh;1:eiulk4;4:ej1;2:rj2;9:2isbizkl2qiv;3:3j1;f:okopk8;1:8j9;4:uit;1:8kc9mzajtbjncg1ehefh6ghfjhbklylh8nhbph5qherhfuhhwh3;6:1le8iy9iraiughglhgnliph5rgswhg;c:8jp9hf;b:2k7fiktj2;2:cje;1:8inaj3;2:0hg1gl2h63gr4gr5j46j57gg8k39g9af5bgncgrdirekwfjnhgxih5jkqlgqml5oispgbqgdrjgsh3tj9uhgvhfwl6;p:gje;7:2iu3hf5k87hgdhgej4ghglj0mjepj6qj8rhewhd;4:fmaghc;2:hin;1:hh5jjc;1:diw;2:1iy;2:ajcfgxgjmjl0;7:8gvdhgjjclj8ujfvky;2:qjq;2:dh6ejd;2:0hgiju;4:lkjrj1;2:5iqija;1:ak1biqcjddhbeiwkj0wj1;1:qka;8:9h5bky;3:wk9;1:8fz9li;1:njk;2:3ix5ha8ix9hdbhacheeh1oj9pheqhgrp8uj3wio;5:sj3;8:agzfjsjjwril;4:fjf;4:0j7;2:0kf3k6ijkqjwsh5;1:2kt4gx;2:8it9hcdjiejs;7:8ijhik;3:rjh;7:hil;5:9ipeiq;2:5im;7:qka;d:rj9;3:finwk9;2:0ke1gr;2:0j22kb4jy5km8j1chfijejh5rhhuhbwhc;w:8ix;5:aj5bj8kj5wj6;2:1h56j87iw8h9bhgchbfh8gj1jgunjmohfpjkqh8rmp;3:pk3;5:fix;8:fkv;4:nk0;2:hk7rh9;4:wjp;1:2k98hbbiljhdnmzojvph9wh9;6:2imrip;7:niz;5:gjb;3:8jq9h3bk3eh5;5:djoehb;2:qiq;1:hin;3:9jdajfbhd;2:wkx;1:gjw;1:aj4kh9ljiokduiu;7:8ixaisbh6cinkjolhcuk2;3:hk7rh9;7:1ke8l79fm;1:0k61ir3ix;4:dkcsj1;1:iiu;9:9ilejkril;1:7ko8j3jkirhcwhf;1:0hh1h28hdamobhecixeh1fmnjhgkh4mhapkvrh8shcuhfwhc;b:khelkx;3:3jt;3:girhil;1:0ij3l6;1:cjm;1:fjkuj4;9:cj3;4:mjn;3:9kpeh9gltrh3;1:7kpgjfhhejiprit;2:2he4he6mn9hdahbbgzchbdj2fkugijhjwjh7ph9qgdthfukmvj3wh9;3:6k6vj6;e:3kgqhg;3:vln;3:9imaio;3:8k0ohcrmuwhe;6:ikw;3:0j68jk;6:jjg;7:5j0;5:cj9;1:mio;4:tj4;8:rjz;4:llyohbpk9;1:ciurjy;d:bjl;2:rhhtkv;7:0iu;9:8ineil;c:5j8;1:ej1glw;5:0mlqh7;2:0j3khglkc;4:eil;2:lji;4:bjngj3;3:0hh3ji4k37he8lj9fvagtbh8dgbejgggwkl1nmnohdph6qh5rhgwh2;2:kjq;3:0g51ol3h04h35he8gjbh6ckpefzfgygjhhkxihhjghkhalhdmjjoh0ph5qgqrojshethcugxwgv;4:1jvrh7;2:mj7;5:ah1ckkrjr;1:qiwwk6;3:1j7ainbhgflqjhflhanl6ph2qhgrhcshbthfwik;3:4j9;4:wje;2:biz;7:5j2;8:niy;8:8it;5:oheqku;8:2iliit;1:0ioris;6:fjb;4:4jkjjwuj9vk7whe;2:0io;f:1k84j28heeimghfij4wka;2:2k6sjhuja;4:mk0;1:mk0;2:qk1;4:bjg;2:0k61ir3ix;d:8j9ehc;6:9j3;s:8h69l5ejg;4:8kpkizlhhnhdqk6sjythf;9:8ky9hbaikfh9kjl;5:qkp;4:hikjjv;5:7j4;7:rjz;i:5iu8je9kbjj3;1:jj4;1:him;3:wks;2:4hf8h29gzaggchgdirem5fkwgj9hhdjlbrizwgy;d:6kpjjrljb;1:dj8ehg;3:8j9;8:wkt;2:fkjkjn;1:ajrqkfrhg;b:viv;4:ehaukt;6:0gt1gx2lm3gt5h16h77ir8j99k6bkqcrpdh3efwgg4hgujfjkl4lgqmgzngvpgerfvtgsujcvhgwfw;3:0hf1hc3ha4hg5l26h98gz9h1agzbhfchcfh0gh8jjqkh8mj3ojzphcqj7rj0sheuk8vlxwgs;f:0is7kc8hgaj6ciqdinjitojfqhfrh8;1:fj7nk2;1:biz;1:rj9;2:pkh;1:0h21gy3h54h86hb7is8k99gzagobgndizfirggrjgekirlqomh3nhdoh0pgzrmmshdth4ugwwgc;c:ahddisejdghdjhbkjelkhqhcrmduhfwhd;7:ahdcko;2:niz;6:5j8;1:1ha8hf9jvcl7rjg;6:ujm;1:giz;b:jk0;6:0jd1hh3iz4hh8hdahdbhgchefhdgiyhjajkqpiqqjlrhguhgwiq;6:bj7;1:4imgivhikqjbrjm;1:bjichgeisgk3rhbwke;1:8ki9h1nis;3:3m9;1:bkf;3:mj6qj4;5:0l71hbbhacivghdjhdkhbmntphgrjawhb;6:wjg;1:git;1:diweh8;g:0h61kb2hf3h84h55hg6k77jq8j49j9ahcbg7ciueipggyjh0kjxlmdmh2okqpgiqgsrfwshgthhugvwgx;2:2it8hgbiycisfh6ghchkojlmpjjqhethhwhg;3:fjf;1:ak2biscjfkj2;1:pjz;1:4jodloehdgikjhd;2:biz;3:bjpgjo;2:glojiwsji;2:8hdjixrjauixwjw;1:cj3;1:0hceiofj9ik6;5:1ha7k28h79irbilcgrggrjivkh7mkrph4qilrgism7uh8wj5;4:wju;7:3j18h39hfaj6ej4gkfrhfuis;2:chbhkhjky;2:0jo;b:gix;2:0j0;3:4jjbl1cioej5fgxghfjh7rjjuhfwj4;a:8gm9kl;5:0iy;5:0hh3hg4hd5iu8h29gyagfchfdiqem4fkugj4hhdjl6phgqhgriywgw;2:8ldth5;3:qk1;5:mjh;1:cj1;1:dk6rip;2:rkythe;4:gis;2:8h19jagjrikf;19:klh;2:0jo1mu2hc3n04j28grahebj0chgdhdehgfhbgguij7jgwkgglh7mhbngtokwph0qivrh2shcth1uhbwgy;6:0js;5:0ju1j43gzbjb;5:fit;2:0gs2h33go5h46h07h98kk9myafobh2djkem3fj0gf8hlckg1lgqmgonkeogopivqg4thdvjewfl;4:qk1;b:8j9;9:oj2;3:iir;1:lje;a:jkjnix;6:dip;4:gkijj7;3:fjmqiw;1:eiulk4;7:5ko;3:0jnikh;e:ajw;1:0h42k53h64ly9hbah8bkvfhbgh4ikyjhfkhcqj8rhfshfwhf;5:dn9;3:vj3;1:1h55hf8jx9gybhceiqfh7gjjhjzjgpkhfohaphfqherjtshfthguo6whc;3:pjj;2:ej5wk6;5:mjh;1:ujz;1:5j9;1:0gm1iv2hf3h34h25ha6hg7hg8go9h3ch6dh7ehffh6ggmhhdihejgfkozmmcnjpok6pkzqgurfwsjdtglujlwgd;7:pjz;5:njg;2:7jlmja;4:rk3;5:5mc;7:jjc;2:4m0;1:4jr;6:1jujjarh6;2:8h39knbhgdmyek5fh5ghgjj9rj2ugswh2;4:gjb;2:5j8fjagit;7:8ikfirqjr;5:hhbjj6;4:3haej0jjz;v:6je7iymkkqip;5:rit;3:1k4;8:jiq;1:4iv;5:fjo;5:aj9cisjjerj6;8:3hf4iu8g39gtahcch5diyerdfiwjhbrijuhcwh5;6:git;a:bj7;1:jhaqjvwk2;1:8hdjixrjauixwjw;1:8kg9gmalefh5;3:jjcsj1;1:ljv;3:4j9;1:8jl9hfcj1;5:4m3qhf;1:ej3;1:rim;3:ak9;2:4j9ajucharhg;4:dip;2:ikj;6:9khahfchhdkaeitghgjjqujswhb;6:1jicirdh7fjukha;1:wjv;2:rk0;3:ghejnisjn;6:0h91h92he3hb8gv9jlah2bitcisdhffgxgj9jgzkh6lhbmh7nh6onipguriotkxugmwjj;1:ciy;3:hja;8:kko;7:4jt;2:5iw8hc9j0ahgfhbnj3rjywjh;4:iiv;5:0j7;1:dipuje;4:5lq8ipohb;3:9jc;2:8g5ani;3:glssjj;1:hje;4:qin;3:fk5;4:9ikaj0fin;4:dj3eix;1:pjw;7:0g71jn2g33g64fz6gn7gn8k89irah7bjhcfudgjeg4gfyigpjf6ko1ljomiunmeoklpipqh5ujwvh7;1:0m29is;2:9jg;1:4iz;2:rkythe;7:wjx;8:0itcjrrh9;3:eiuwkk;2:5jb;2:6iu;2:ukj;1:0iz;1:qka;1:1j8;3:4jf5lijh4ok2ph8;7:fin;2:3js4iy8jh9hbcimiiq;7:uj8;3:bhccm7fiy;6:hhhjja;2:3k3;3:ahdcko;9:gjw;2:ej0mja;3:dh1enx;3:gin;3:jg9uhhvnk;5:glvrh6;7:aj0;6:0h31jv3h84gx5ha6hg7hf8j59gwah1bgvch8dhdehefiogguhhdihcjh4kjylk6nmroeipkyqgsrkrsjktiswgs;2:uit;8:jheqjrwje;9:5lt;3:8ggqjztlp;3:8h99heeoafkeuhh;1:gj5ukl;1:4m1njeqhbwhf;3:5m7hmfjh7rhc;5:ajw;1:0ns2h53im4lb5h16o27h28jp9ghagwbgicgwdh8egygj2hh8ij3jhfkh5lh7mgvnknoh1pfxqk1riqsfytgwugzvhewf9;b:wjr;d:dj3eix;7:ej3;4:oil;2:sj4;2:0h61h93gx4hd5hb6hg8fy9ghapubh6cj5dhbefnfoogkhhiuihdjgrkimlhcmhenhcohcph7qgwrgosh6th6uglwmp;1:8kzjhdrhd;4:fjq;4:hh5jjc;3:aipbjd;2:kjc;3:5j9;b:sj5;7:ajrfjbjivkhbljknhgoherknwj1;a:8hf9jzdjc;6:bizeiv;2:8j4khflkc;2:8io;9:0ha1jl3hg8h9bgofhgghdkm5mlhnk5pk2rh8shdthcuh7wha;2:rjh;7:8j9;2:9h7dncegd;9:jhfwjn;1:dh6ejaniz;c:ek2fh4;8:qkp;5:bl3;2:fjb;7:9j2cjnfilgiwrh6uik;2:3jn4hf8jh9gkah4bhejimklgnmuphbqhduivwhd;6:0k52il3hd4kp7gy8hhbhfdhgeisfheghaijsjj1pilqgkrhfuiswk6;2:9jb;5:5hf8jwojhrmduhfwh6;3:lgyrk9;1:rjw;4:0he1ha2jz3ha4hb8gk9jxagockpdhcej5fj6gj3hk0jjzkh5lhgmh4oh1ph4qh4shfuhfwix;7:aj8;4:glkrh3siqujm;1:cj1;1:0jf2gc3ip4k65j76ha7pa8io9h0ah2bktcikehcfgxghdijgjipkgulhdmh8nheoh9ph0qgfrgtsheugwvhcwg7;2:tjx;3:pjw;4:nhcpjv;2:0hc8gxbhfchadunejrgh5jh0phcqhhrhbth9uijwh6;c:hiz;4:ahgfhawkb;6:0iu;8:0hd2k23hc7j78h4bkgcioehffhdgh5jh1khblhbnm2ojopknqh5rhethfuhawgw;2:uiu;4:bhckjt;6:9h8fj4glbrjh;1:ulnvkz;2:0hd1ha3hc8gaah3bhacheensflsgh1jh7khflisokbpjoqhdthduhawh9;7:aj7;7:0l2;3:njepl1;5:mjj;8:mkirgx;5:1je2io;7:pjj;1:vjn;6:nkb;4:njg;2:9l9ah8gj7;6:0jqljf;h:ij4;6:ajrfjbjivkhbljknhgoherknwj1;2:ljd;2:4jk5j88h6iinjlaoh7uhevk5wgz;4:8imiki;3:git;c:0k61ir3ix;b:fgsgjo;5:bhckjt;6:0h81ha2jw3h34h25hg6m97h79gpaivdijeh9fkehjmihejgjkh5lhfmhdohepgyql1rgosh5th7uk6viwwgp;8:ciw;4:bjpgjo;a:0q91ja3hcjh9qh6rj5whc;8:1k18jr9jd;3:rkl;6:4iwghhok8wkt;5:0h91h72he3h45h97ha8ji9kgaimbl2csadhaeg1fimgghhh1jg1klelgxmh5nh1ohapgorgcsh4th1wgf;3:jjlwkc;1:0h01gr2hg3h05hc6hf7ha8fm9n3al5cgcdkmefcghdhguih7jhakjclh6mlcnh8ohbpgwqgnrnesh4uh3wk5;1:2ix;3:8ke9knajbbmbegxfh0ghdjhakjmnh9rheuh7whf;3:rip;7:3kl;1:jjx;2:0fu2fs3fr4fr5gm6io7lt8lb9kuajnbh6dgbef7fjngf8hjpigmjg8lg0mh1ngfoh6pksqivrpxsl0tk6ufower;3:dip;1:1hd3hc8hgbhcdhdeheghcjhdkl8okhpjxqhdtld;2:pjj;3:eir;5:8iq9jeajdbjrcj5egtkjhnhg;5:amycjrfhcrh7whe;4:mio;9:cjxehe;3:1j42k44h58h7aj0bhdchcdhhjh2kjbmhbnhboj4ph7qhbrkvtinuhhwiu;3:himjik;7:wju;1:hjs;2:hio;1:5lqrhetkr;7:wjg;e:8iq9j7bjegikjhgqjlrhguj1;2:giojk6pjr;1:8h19jagjrikf;2:5mqjh8;c:iis;3:3jdojlwjv;2:9k7;3:jjnmjn;5:0gz1gc2ll3gr4jc5ha6hc7gu8gx9gyailbh9dh2fgmihcjkmkgtlh2mhdnikon9qjvth9ugwwio;1:aj2bjsjh4km0lh3oh8qhfwll;1:0iv8hb9kfqk1;1:4iz;2:cjgsj5;1:jj9qirwk0;3:1jw7k88iqbhbkjeljqoh5rhd;2:wjg;4:7kbkk3;2:ahfcivfjj;1:uiu;1:0hceiofj9ik6;4:ajrjjluj3;6:2hg3hg9gcahfbjkch5djbekdflpgh6nhdokvpheqheuirwh8;1:8k6;7:0k24hb5he8gw9geamhbh1cixej7fkhgiohjlihdjgukgulhamgynhfoh5pk4qhbrissiqtgzugwwgp;3:fjxljs;1:8hflly;5:8hgukf;6:dke;4:nj0;4:fh2gjp;d:8j5;l:cjsrha;1:8ik;4:9jpehf;a:ejl;6:mld;2:cj1;4:iiv;1:eja;a:hik;i:gilsjo;2:ljd;6:9k7cjm;e:3k1;1:ris;3:9h9bjyeimfm9;1:4ingj5hilrjo;3:0jl1ke4hh;2:njepl1;4:2ix;2:5jk;6:wjg;5:4j9;5:0l05j6;7:rin;3:6kr;2:0h91gy4hg8h39hbam5bhbciqdikejdfm1jh3kh1mh6pklrh1sixuh5wh5;2:aj8hik;1:ljv;2:ajifha;1:1j8;4:0jc4j35kv;7:ris;1:wka;1:8ir;9:1kbwji;6:8hg9l0;a:biuhjrkhalk6;1:qlh;b:ahekh3mmuogtpjl;5:ajhhjfjh5;3:0hgiju;2:5mc;7:ml4;9:tk2;1:ckrrheuk1vjh;2:8hgukf;1:aio;5:8hftkgukh;1:8io9jlqil;1:jhark4;a:0hh8h59hcbhgchfdjjehefh8ggthssjl5qhgrghuhcwh7;2:cji;b:qiy;2:riu;4:9ioej9;1:0iqqh5wll;i:4km9imuiq;4:gja;i:cjgsj5;g:dj8ehg;3:ejl;b:bkf;1:uiw;2:2kc4im5lf8h4chaehdfjughciikjheogzphetm1ugzwha;2:gin;2:1k3;3:4iwghhok8wkt;9:njz;4:0iu1j72k94h47k09hcbhadgcejwgh5jhbkjclijmhfnhdojaph9qhbrhctinwhb;2:3jkjjq;2:8ke;5:anmrhc;3:gin;1:ciytjo;7:ahdejgjgpsm4;3:2hdojf;1:1j7nj1;b:4jlfj9jhdwm3;5:6guainwl3;1:qjv;a:ajbujg;9:ml6;2:uiu;6:5j9;1:6hdjh5qhduksvmewiw;7:lgyrk9;4:3m9;7:ejogkx;2:riv;1:pjr;3:fjf;3:0j11js;5:jkc;4:ej0;7:gjpjjc;6:9j1jjm;2:2jz4ky;7:0ip;1:9io;4:1he8hcck5dk3eheghakhelirolbqhcrgusjyuh3;1:9iw;6:8j7ehgfkcuj2;5:git;6:4j7bj5;1:4j6cjklja;1:pmz;4:8kf9kpblnegyfhajhckjtnhauha;c:0gz1hh3h74j86lz8f09ggah6cgzdlteqwihglj9ohgphcqgxrhcth9uh5wgk;2:4ksljc;4:3ipqjq;2:1marh2;e:djmeh7hiy;d:fhfgkq;2:8j9;2:8iz9h8ah2ckwehhfjgjjzrg3tmpwhd;7:gkk;1:lipsix;4:fhggjgrj3ujf;2:fis;1:aj0;2:aipbjd;5:tj7;1:1h6glxljaqjhrgmuip;1:ckfgjfrhd;a:jjc;3:3hd8h49hdahgbhfdkpfgsgk8kh3ljnmirrjtwhg;c:uiu;1:1j72jx6j47he8hd9heahbch8eh7fgqgithk7jgzllsminnh6pgzqh5th0uj5vh1wh0;1:2izjkt;2:ojp;5:aik;b:3hf4iu8g39gtahcch5diyerdfiwjhbrijuhcwh5;1:6lewh1;7:rjh;g:0lm;7:ajbchg;2:jhfwjn;c:ljl;1:0je1rf2h23mc4im5hf6he7he8fq9jaagech3dh6eh6fgrgfmhhbijpjghkjblgvmh0ngjolcpgjrgnsiqugswgg;1:3iu5is8hgiiqqjzrhgtkuwhe;6:qis;2:jjc;6:bj4jj9;1:jkwwgx;5:ek0ukj;3:njk;e:hj0;2:3jg8h9eipwm9;3:fmgghaukg;3:3kz;6:glxqj9;1:0h61gx3h64h85h87h98kfaivbhccindj3fjtghajn1kgulkwmh8ngxoh9pgvqgvrkesh7tjhuh7wg3;9:jiymk8rji;2:ajwrhh;2:njk;5:1j8;6:0hd1hg3hc4h88glag0bh6elbfmjgiohh6jkokhfmhgohcph9qh1rikslhth7uivwgq;5:dj9;5:ahaeisfh5skluki;2:jg8tj1uhgvni;d:njk;3:aj7jj8;7:qjk;1:dlpehcmjf;2:9j0gjy;2:dgnejj;b:9jc;b:9j4fjjljbuil;d:9iq;5:qka;2:5jk;h:0m18jo;6:hjh;3:rk3;2:rjc;1:fjq;f:gju;1:8h9ahfgj3una;8:0iudj9ej3;9:ajqbhafhekj9lj3nit;7:gis;3:gjm;7:djdegtujp;4:6hfqhful0vmh;4:dip;1:6kq;8:0ks1lsfheghfukf;3:wj8;2:hhhjja;2:0is;1:1go2gu3jr4gf5gx6gr7jo8ja9jsafxcgzdlnekkffygflihdjplkgglgtnh4og3pg6qisrintivuikvj3wfy;9:cja;7:jkpmkzwgs;5:9iubk8dklehcfhfjiwtiuuhe;f:bj1rk9sj0;6:tiw;1:jkb;2:cjg;4:1j6wjw;1:8k6;1:0l51l22f83kc4l85gr6gs7lw8g09gfahcbmmdgbfg1gflhgtilwjgtkj3lkmmgkngspfxqkerfysgttglugevha;2:aio;3:eik;6:8ik;1:wjv;3:2kk4iyiiq;1:9gxbitcmxdgyekzrhb;3:0fk1j82g94gs5g46gf7ir8lr9jtam3bfhcjpdj4elffflgfnih4jmfngfoiqpfbqgkrhdwje;1:ciy;1:ik4;7:7ks;3:8j8jj2rjn;8:2l93jb;6:2k98hbbiljhdnmzojvph9wh9;9:3j1;5:8hg9gzdkeekxfj1;4:4j6;9:wja;2:1kb8g69jydiveh3iiljj3tjouhc;6:2k9;4:4iq;6:8fy9lhcix;1:ej3;1:0h94j9agsegxfg2gjyjruohaphcqh6rhguh4vjywiu;5:5lk;c:biz;6:0kw1lw;d:5lt;6:djdujuvha;5:gjn;c:ait;4:khdnjg;2:jjk;7:qkp;4:miv;2:0hg1gw3jq8gh9jbah6fh2ghakh9mn8ohhpjnrhftmhwh3;3:jhaqkn;3:4io;2:0gy1h42he3kp4h65h96ha7hc8fn9gfaplbgxcizdgfef9fuigk3hioihbjh7lh9mhanh8oh6ph1qgirglsh0th0ug7vhawjf;3:5lg8j89injhewjd;1:hil;2:1lc8h19j7ah4kl5;m:ljd;7:7ko8j3jkirhcwhf;2:9j0;4:8h9unc;3:8j9;b:ak1;2:0kb1gr4iu;3:ak1;1:tln;1:fis;1:5lk;2:3k3;2:hit;b:9lcel8jik;2:jjb;1:9k7cjm;9:fiu;1:8gt9jfgivqjq;h:rj7;7:ukn;5:dik;b:tj7;a:aio;5:git;2:kkkmh4;l:rim;6:8jo9h5ajlbh6dgoek0fh7kirlinpjz;7:rin;5:wjr;c:ajifha;1:0lq3in;2:eisfje;8:gilok3phgql6;6:3jb8hd9gxagscm9ehgfgwgj5iikjj5skyuhf;p:wk6;2:8izgij;2:jhfwjn;1:njkrir;6:bjpgjo;a:8hd9jkdiveikfh5ujg;3:dkdeh5;1:0k03gy4jkbjwrim;4:gjb;2:iipoj2rje;l:qjr;1:dj7eh7;g:8j9;5:0h01gu2jx3h45kx6hc7hb8jk9hcagobgrcgoejifj3gjajg9ll8mkmnhaoggpgtqgsrl5sheth6ugowgh;5:8k4;5:8jl9hfcj1;3:rk3;b:1k1uix;2:gjhnjy;6:3il;6:1jj2jw3ir4hg5ly8kc9h8bhgejsfhhjgwnhgohbpheqh9rhdtimuh8wha;7:iir;7:iiv;2:8iu;d:0l2;2:ciufk4;3:fjb;1:qka;1:ajw;2:hin;2:4ml8j1aiqghdlhgokzphgqhcrj1uh3whb;2:0iz;2:ej3;1:rji;4:fjxljs;2:5lt;2:jjc;4:0hd1h08h6am9bhcciuflpjh9kh2mh8pkqrh3sj0uh9wh8;1:dj8ehg;1:riv;7:6n3;3:ehbjo3;5:ujs;8:oix;f:0hb3jx8hcbkjchfdhceikfhcjiskhhohfqlbrh7sk1uhdwhd;2:0gvikx;5:tiw;d:qk1;9:0ma1fd2jp3kg4h25jo6hb7is8gc9h5ah3bh7dh4egyfgpgiohjjihajj9kgwlgynleoiwpjuqgarh4tgxugtvhf;5:ej0njj;3:qjw;2:iki;a:fja;5:qka;1:0j61hf8kf9ioagybj4ehffgogmqhhajj1mhgphfrgvtj4uiswh9;2:iis;9:gkk;2:ckuiiprhf;1:9ioahdciufji;1:bjegjl;1:3j55ix;1:ein;6:bhckjt;2:bip;4:1lc8h19j7ah4kl5;3:hjv;5:8ip9h9djfejpjjb;7:0j7;8:3ko;6:filqkf;2:agzfgxgmdhir;1:ris;3:jj8;5:wjx;2:giojkrrjd;2:8k5;4:rhhtkv;4:1hh8lm9jbaj9fisjhbkgyliumhgrkewhd;6:ahhbitcimhkxjhdmiwrhatkn;5:ajj;e:2mg7jk8in9izoitrhgwhg;1:uit;4:cj3;4:hhbjj6;2:mio;6:1j83m7;9:8h49jnukg;1:0ij3l6;2:uhdvji;3:4ju;6:6hfqhfulavmg;3:blahiuojk;4:gj6;1:sj4;1:fix;6:hikqiwwk5;3:gje;6:8iqfjf;1:7md9kmbhbhivqhcrheuh2wis;2:ajghjejh3ojb;2:8hbumi;1:hja;3:8ineikfim;4:lje;1:0j15j0ahhfhanjdwjn;1:riu;3:cjxehe;6:fmaghc;4:8ha9jdlkk;2:gix;3:4jjhh2jkaojr;5:fh3gj8;6:jkc;1:hhbjj6;1:1ng7jpghfojwpisrgx;3:niz;3:2kk7jr;3:lin;q:jjm;2:ujz;5:0j5ck4rgj;1:5lrohc;1:qiw;9:0kxbiwihhnjmwkb;8:jjw;3:gju;4:ciwijstjm;1:9iw;1:9k0;7:fjq;2:5lqij9ohb;9:5jw;2:0h81hc2jz3h44gb5hd8jq9njagxbfucjudh8elsfimggwihfjgfkgqljnmh6ohfph5qgxrjyshfth9ugyvl3wgo;4:8h19jk;8:hik;1:6hfqhful0vmh;2:9injkvwgx;1:3j15m28kf9haejujh7tiquhf;1:jiy;6:3kjjh9;9:1gu4ja5ldbj8chegk1jh0kirlhdmhbolmpgzrgxuhgwhf;5:hit;1:0ka1it3jzghcijinj4qjqrhash4whc;2:dj7eh7;5:diz;3:eiw;4:4iv9ivghfkhgok7wkq;2:0kfah9ch2gjahkajirmj8rhgsj3;6:qknsh9;k:eiz;3:5mqjh8;2:0is;1:8ivfjlgje;3:ahdfh8jhewnd;1:sj4;9:dj8;3:ahedk5fjcuio;6:0go1o6rh3;1:chchkmmjh;5:qjt;1:8iq9jeajdbjrcj5egtkjhnhg;4:4hfpli;1:gjqjkc;7:fhggk0hj5;3:4l38kxbha;5:3kz;3:0iv1ha3nb4jy6hf7he8h29h2ahfbh7chgdheeh8fhcggohhbih1jlpkh9lhgnkvoh5pgvqhgrh8sj6thcuh8wkn;6:cj3;2:tkj;8:diw;3:0k51ir3js8heijgjh9nj3qjnrh7sh2wj5;2:ijs;3:bh1gll;7:ekqfh3;1:njg;6:8gr9glahddnhemgflpgh9jh9uhawhd;6:0jj3gk5im8jtbhgojdrm6uhdwh2;6:eipfja;7:9jddj6;7:iki;2:kjl;1:tln;2:0ljsiv;1:git;8:bim;2:iiqrjh;2:jhcom1pjf;2:9j3qjktjo;4:4jp;g:ik3wk6;9:qin;1:riluix;1:qjv;1:tir;1:2is;1:dh7fjhgit;1:aiy;4:mnc;5:khflkcqjz;1:1iz8j8ciueh9fjbgh8qjprhf;1:ikj;1:3m9;2:9jbuj8;b:gir;5:git;4:gisuj7;b:0iudj9ej3;5:gjk;1:bkjkhe;1:ul3vgb;2:8h3bj7rlnuk5;1:ej3;2:0iudj9ej3;1:1kr2fy3hb7q69hdah3ch5dhgehffhbkh8mhcnj8oh0ph1rh5sk1thcuh3wiv;3:mjz;1:fjaqjj;2:0iudj9ej3;5:ij8;2:cjt;5:8jufjggjb;5:jil;6:bjkgkdrhe;8:ejdrj5;3:fkl;5:jjc;4:8gt9imciofjfgheikaokjpk2;2:0m76hggj1phgqgtrlawhb;3:kj9;1:2kr;2:3j2hj7jjfmkdrgr;2:uja;1:4hfpli;5:qki;3:eiv;5:8gr9glahddnhemgflpgh9jh9uhawhd;4:lhdnlvpgs;6:2j4;1:wjr;e:8h19jk;1:3k1;9:chfhkq;e:4ki;5:jj3ojp;4:ehfjk9;1:fk5;2:9io;7:qk1;1:uit;1:olk;c:gjk;8:lj4;1:8h39heaiweiwfkjgjyjiyrh7uio;1:bhckjt;4:pjz;9:8h79hdaj1biockjdjrfhcjiykkoqhgrisuh6whd;8:5ml;7:qk1;2:4iz;3:8jl9hfcj1;2:bjbcheeiqgjyhh9jj0nhgok8rh7wk6;a:dkbeh3gjk;8:1kqrh2;6:bjw;2:ak4fhb;j:3kb9izcjlgitqh8rh5;1:kkblgx;5:ciw;d:bkqeiyjj3qhbsk5;7:1gu4ja5ldbj8chegk1jh0kirlhdmhbolmpgzrgxuhgwhf;4:ajykkhlgf;2:fj6;1:iiu;4:gis;e:eiofj9mkergs;e:qh7wlp;3:8j5kh4mmyogvphd;2:0l2;1:9je;2:agabiwflg;2:eiuwkk;7:fjq;1:1je2n63l44knjh6ohaph9qgnwha;1:fj6rix;2:aj7wju;4:2k98jf9haciujhbklslg8ojtuhf;6:ujg;8:ahgcj2wk9;a:8h9aiwbhbeh8fhdkm4mjhujx;7:mj5wkr;4:9h7dioej8flhghf;9:4iv8k69hbdgrek6;4:ahhcj3giq;1:1jf3lx4h88h49hbakubjefh5gjahheiiukj2oh5phcqgzrgpsh9thdwgw;2:njz;8:dj0ej7ujo;6:bj6jjn;4:8fvamjckjqkerhftheuhgwh6;1:8k49h1bjm;5:0io;3:sk2;3:8j9;5:2jc;4:0m3;d:0jjwjr;3:4ilgkgjipqjgrjh;7:8j9;4:0hc3hc5lr7jt8jj9hgbh5diveh7ghgjhfkjylgjoj3ph8qgsrlyshduh8wgn;2:bjk;2:vln;6:4m3qhf;3:0in3j48h29k9jjbpjiqjpwhh;1:2ix;5:ait;1:2k44jp;4:0jp1iv3gvbixjhfkgrlmynhgohgphcwiu;4:0ir1jn9j3bhdjheohfqmzwhh;3:8irlhdrjn;4:5li8h69j6jhcrjl;6:iir;8:gjjhhgjj4;1:dh6ejc;8:aj3;7:8h19inciteh8fj8gh6okjpk5qjj;2:8ka;6:9izcjlgitqkgrh4;c:gjw;2:0jt;1:gis;f:dk6;1:8it9hcdjiejs;1:ek0fh0khblksoj5;8:fit;6:aivhijrhguki;3:akr;2:1jyjj0wh4;1:cil;3:jkwwgx;4:dksegt;4:8ikdj8ehafir;1:qki;9:bl3;9:2jefimghhwk3;4:jjk;7:8il;2:3m9;b:8j4ck2rgk;1:cjg;6:2jz4ky;1:tiz;5:ehejjltit;4:0he2jn3h94ki8kz9m2ahebhbdjreg7fh2gh5jiuphhqharh7thfwh3;6:jin;1:gjw;1:0k21in3js4hd6k78hcgh7ijejh3nj0pkgqj3rh6sh1wgv;1:ml8;3:8hc9ljeh9;1:8ke9kobmbegyfh9ghhjhckjnnharhguh9;6:njfrjt;8:1kprgrwjv;3:bj7qj1;9:1k68mleh3fiwgh6jhbql0rhguhdwhg;3:rhhtkv;2:0isdh6ejc;1:okl;6:jjx;4:pk7;4:ej1;3:8ju;6:0kudj7ehbnje;1:4iz;b:4j0uh8vkd;1:4j7gk0;1:hjqjix;4:2m9;7:gir;2:fjb;3:rji;2:8k49imajbbjeehgjizriz;1:fhggk3;6:9j3;6:0gi1jf2j93gf4mx5h46h97gz8k39f0aj8bf9cgcdg1ej4fiogg5hh2ik4jfukowljsmgunlook4qg6rfztgxvhewfp;6:0h82mi7jjghfoitrhfwk9;4:8inbl9hiuojj;4:0jc4j35kv;8:ogyqqt;7:oheqku;c:1jq2ld3g64me5gw6h17gl8jr9epaenbfjcildfoeksgh8hgqijujflknllikmgknkpojgpjlqgyrfwtgfuhavh9wiv;1:0gu1h32hc3gd4h46hc8fp9g0agpbh7cgvegofiygfuhrlihajjxkimmh0nh9ogkpinqg6rgysjkth0uiuvk6wn6;1:2isrjesku;1:9ixcjkgiqnhgplkrh2;3:8k5lhbrjj;1:fjo;7:3jbojkpjawjp;2:4hf8ky9gpijojhbmh9tkvwj0;6:sisujr;1:kjqrio;3:pjj;5:jjb;2:hil;4:ljv;2:3il;4:wkr;c:qk1;1:bk0khgnlarhg;5:ahgfh7gkp;2:8il;6:0k31ip3iwajocitgh9rhf;1:8knhk1kixlhgnhcqk2rgvsjvthewhf;4:4jt8h0mkcrguujr;1:ciy;6:0m52gg3he4ki7n28hfbh3fhggh1ijhjh0kh7ph9qgrrhgwjp;2:sjy;3:wja;f:jir;1:jhaljdqjj;1:sj4;3:ajzjki;3:airokl;2:0j93is5ipghdjliwhc;7:giojkrrjd;a:0iz3jz8ke9h6bhecj2dhaekkjhaqheuhe;4:djkeh9;5:0kk4l57hcik0whf;3:jja;4:0l2;2:0js;2:1jw7k88iqbhbkjeljqoh5rhd;h:0hf1h63hc4hb5he8jn9kzbngcgydhaegpfingjcjgwkiwlh4mh9oh4pgiqh7rkfsh2tjowh2;4:djqeh5;1:rjs;6:8ikahfchdehgghbjhekjpljpnj4pkvqh6tj4win;3:4j8iiq;1:wk8;b:bhdrkg;4:fh8gkphipmj4;2:1ha2he3hb4hd6h67gm9g8alnbjocjrfitgixhjijg8kh5mhfnj9ohgph9qgvrgathbujrwjn;2:anhbjhchdfgxjherjz;1:1ku6jw7heah9fk2jhhkkvph9qharhdsikuhgvj0wh2;2:qka;2:0fj1g92oa3fo4m06l37lc8je9g1agsbofcjfdhaeftgh2hhaijhjggkfrmganglog3pfqqmjrgksfwth8ujkwer;4:ljb;7:dim;6:cj1;1:0jy3h1;7:hjh;a:9jb;1:3j28kvbiurl5th1;6:ajbujg;e:8h19jk;1:okl;6:8h99ivajbfhd;b:kkblgx;2:hikrm3;7:9hdcilrjn;1:wks;6:3k1;8:wk8;1:ahfcj5jka;2:0j0;1:hgwjjr;b:8jufjggjb;4:8io;4:8gtum3vjf;5:9ioej7jik;6:3hf4iu8g39gtahcch5diyerdfiwjhbrijuhcwh5;1:siu;3:wjx;6:qjk;1:hgsjkg;9:gkjuj1;3:1iz2jm3gw4k95jr7h49h3akvcgahg8iixjitkgglgfmgunfyoggpjoqgsrjttiwvhgwik;1:eiulk4;b:biokjj;1:3gruilvm5;b:4hg8jt9gnah9bhgklinmvphcuit;5:ckfhk4sj1uh6vk7;2:8j9;3:hjh;6:jjv;3:8l0bhd;1:4ikoj0;1:bhegjr;1:eipfja;1:jjc;1:rjwtlr;8:him;6:0is;1:9j9rjcskt;4:gis;g:2hb3jb8kt9haahbfhfgj7hkljh9qhgriotliuh0whd;4:sje;c:4ingj5hilrjo;3:5jw;a:4iz;2:8hbdhfjizlj7rjjujavkw;6:0ha2k83hh4m3bgwfhfil2kj8qhg;3:1k13j84kn8h1dhefizgh8iixrh6thauhcwlv;2:1jroivqju;c:okl;4:jh2qpkwhf;a:3lsbjq;5:3gz7mt9gsah2bhgcitdgkegphizjolmj8qh2shgthfwgr;6:kl3nj2uj5;1:8j9;7:8k8jjjuhe;9:sjo;5:0hg3he8m1almciudhhegzfhfgh5hj6jj0lhgqh9riwuh8whd;4:rjq;5:qjt;5:9j2;e:8iw;6:wje;1:9j3;6:bka;3:3j1;2:wk5;4:8j5;1:2il5j1ahefhegj8hgrjlflj9qj0;4:ejkhikjhc;7:ahecj2gj6iiq;m:8izaj3;2:3hg8l4hgsjj2phdqj8tm6;1:eis;1:7kj;4:pjq;1:eikgishik;5:jj8;4:3j9rjr;3:fk0;4:3hb8hfaisbjifj7glajhbkhbokbrhhsjcwhb;2:wje;2:cj3;3:git;8:jja;2:pk7;2:8gt9jmahefhfpk7;8:8jcriv;5:vjn;2:8iq9imdj3egvgivuiwwiy;2:miv;3:8jq9h3bk3eh5;1:nj3;2:mjb;8:ajfbhe;1:rjq;1:0hd4hf5ix7hfahafhagj0hgojoplj5ohhph9qltrhfthgwgv;6:ojp;a:1he2hh4m8aj6biwcheujr;1:4j9fhdwjt;1:rix;1:jkv;2:bj3;8:fiukj7;3:1hc2jd3h4ghckl8okipjy;5:kh4mmzphc;1:2ml7jloiv;6:4iv;4:jje;2:bkb;1:gix;2:2in;4:hio;1:0m18jo;3:wk5;8:qjt;1:3m68h29kuejbwhg;9:kjr;3:0go1o5jj0rh1;3:ajcfgxgjmjl0;3:gjyhh2jk1shfwjg;d:4jr;1:glojiwsji;1:fk0;7:ujg;2:0ij3l6;8:0hf8la9ljaizbioch1egzfh1ghckjzlg3ohgqhgrimshfukdwh8;5:4jr;6:hilqj2;1:dip;2:3m9;2:3m35m4whg;1:sl0;1:4j6;h:0gs1gz2j43ix4jo5gt6ha7h48ln9krbg8cgodgsekthh8ih0jitkgmlgwmgwnh2ok7pgpqh4tgouj4vkzwhe;2:hj7;5:glssjj;1:4jp7kn8gzmkargrujq;6:5mc;2:ej3;1:sik;7:jjo;1:gin;1:1gl2ll4jn5jg6hb7h49fkalybg7ch6dgrehbfg7hjfkjdlh0mgrngyoghpgnqhfsgztg1un2vl0wh1;2:cjcejfjgipmvqjcrh0whd;4:4jr;4:anhbjhchdfgxjherjz;3:sj5;4:qjt;2:ahepk7;1:3kp;3:kirnh3pki;6:2hb3j08kbah8bhefhagj3hkdjgyqharjfshhtlfugywji;5:fk5;2:fl1;9:cj1;3:gin;2:0jt;1:fit;4:ujwvhb;7:cj8hk1jhh;6:gjr;1:jkc;h:3kurkytjguhe;1:0lx1k62jw3k34kb5hg6hg7j38hb9h8bh2ch0dh6hhdihdjgikjflh2miunhbogpph5qgnrgoshgth6uhd;6:uiu;c:lku;5:wjg;2:pmmqh7;1:wjx;3:dim;4:1hf9h5an5chbdilej4flpghhrh3whc;1:bhckjt;4:uiu;1:5mc;c:5iyajwfhgkkflgf;d:qjj;2:ajcfhd;e:2he4hd6mn9hbahbbgychadj2fkphjwjh7ph9qgdtheuklvj2wh9;a:qjt;2:kkjmh3uix;2:aj8hik;c:hil;3:0isgjzjjcshf;c:lj9;1:jjfwk5;4:vln;9:bj3;4:tj4;4:hikjjv;1:rjv;2:9jm;2:0kp7kg8hgghbjk4mk7phhqh6rg2tl7wgr;1:5ko;3:1keiip;a:8ilsiotjw;4:ris;6:djo;8:ujh;4:9h1dimeky;1:9k7;3:nk0;2:tiu;3:0k51ir3js8heijgjh9nj3qjnrh7sh2wj5;1:dj8ehagju;8:oix;2:7l78hf9hcah4bh6ej8fjjgh9jg3rh6so6whh;1:1k1giquj3;8:aj0;5:jjw;2:dhheiyglohgrjiuqkxrhgtj6whd;1:aiykjp;3:0j7;8:djxehb;4:bhccm7fiy;2:rk2;3:jjkrlfthb;2:aj9;2:0hg1he3he6h98h79h4ah3chefh3ghbjjxkhamj4ok3pheqj9rj6shfukcvlzwgw;1:hh5jjc;6:djxehb;7:rjz;h:0j5;g:7k0jkhohh;1:hk7rh9;7:1he2k14hf8gn9jqah2clcdkweivfj6gjgjgykh9mhcoh5phduhawh3;1:0l61gs3h78h89irbh0cjcglkikgjh4kjumhhphgqh7rgswhd;2:4jf8kmbh1fhcgjohiviilmizrhg;6:njg;7:0hc2ju3jd4l35hd9hcailbizchhfhhjmenhdoh7phdqh9rheuguvjxwgl;2:2jh3il4gw5h26h77h08nd9n3akcbehcn1dlvejkfedgj4hjnigvjh1kg8lglmgingjoglpg3qhhrgnsgbtgzujsvhbwfl;8:aj0;4:0iunk9qk0;1:uk0;6:ij4;1:sj7;1:ehgmj6rjy;5:bj4jj9;2:dh6ejd;5:iiv;6:bkf;1:8gj9juah8dljeedkkhthguhfwmo;3:3hc4hc8jy9mpbl7ciydhcegsfgdgj4hiljgzkjjmixnh6phfqhbrh8thdugxwh8;7:9ikaj0fin;8:ej3;d:8it;2:6k7;2:3je8hfagxcivfhbgjhiiljjbrhfsld;3:3ka8h4jjelkj;4:oix;2:fiv;2:8le9h0ehf;t:dj3eix;3:1je2io;a:9j6fjmuio;2:djg;7:bjl;8:0jg;7:gjb;8:chgejdrj9;4:jhfol5pji;1:1jk8iy9iraivghfjk1lhfnlgph1qh4whd;3:8j4ck2rgk;2:0ivwju;2:hik;2:qkw;9:rjh;1:wk9;4:mkirgx;b:sj5;2:cjc;2:jh1wn3;4:0kk3gq4je8f79lsbjkjherj9thbwj7;6:eipfja;7:qk1;1:gjk;3:8h4aj4ch8gjdun9;4:ajcbjcgiokhh;3:1kf;2:nk0;2:8kc9mxeh8uhg;3:gko;e:1kr2fy3hb7q69hdah3ch5dhgehffhbkh8mhcnj8oh0ph1rh5sk1thcuh3wiv;2:oku;4:9iybh3cj2hjoijq;i:dik;8:cj1;2:wjn;4:dj7eh7;1:okm;1:2j08iw;2:jhaqkn;l:rkythe;2:rj0;4:4j2gl3;1:8jybjkuj4;2:niw;2:iki;5:hil;2:2is;1:2l27ka;1:fkjkjn;8:khglkd;1:jix;5:8h9unc;5:0itcj6dggejpgks;3:oje;4:4jjaijbl1ciofhfghgjh7rjjuhhwj4;2:8j9;c:0jz1io3it8jpfj8giy;4:bjlcj4rip;4:ahceikfiopnk;1:jje;4:ckvrhh;1:ahfpk8;2:glssjj;9:1jsjikwl5;1:5j7aji;1:jir;2:jj0vkb;2:3je8h5eherjhujpwjk;1:qk0shf;1:9iu;1:qki;4:sl0;4:ggziiqsjrtj5;6:pjz;6:rjs;2:4iz;7:0iytjz;2:4m3qhf;5:8il;1:rjw;4:gk1jjkshg;2:njk;1:jg9uhhvnk;6:ahefh8jiosixwk7;3:rj0;1:0hf8h69h5bheegxfhbgh8jjjml1phcqjgrhcthguq2wh8;2:ej0mja;3:gjqrhd;5:1k4;4:qk9;9:dguek5;2:nkb;3:7mvqh9;9:cjwehefh2gj6;4:0in9l7aindh6eit;2:gmahhfjjh;1:4iv8k69hbdgrek6;d:oiz;1:jjb;5:4iz;4:9itlim;b:8k6;3:bkb;2:8h69jruiu;4:0hb1h63iy4ha7hc9m7ah8bgsch3djfej5fn8hhakgylhgmhfohgphaqh2shath9ujcwin;1:0iq5jgdjweiyjhe;4:ukn;5:hjgjjn;1:tkz;5:0iu;2:gh6jhgkgfnrxpjnqhf;1:akjdinfh5;2:2ir4ha8hb9ioahdgllijljk8qirwhg;3:jghvkf;1:0hc6fa7h0jgzpfyqm3wpk;3:ek2fh4;1:8jh9jtfj9gj5lkn;7:8jo9gzkjzlgusiytiv;3:8jm9ki;1:9j8hjxtiy;5:rix;2:9infja;3:1j32k23hf4h26lu7ju9habh9chgdgyejjggxjgskj9mhbniuoj0pgyqgprh9shftiluhdwgx;3:ak9;4:ujh;1:jjm;3:lix;2:0j34k85krdj0eh4hgsiitjj0whg;5:1k0wha;1:1j8;2:3h48m89mmahdbhcdgfelnjh0qhf;1:khelkx;c:0hcglbjj9rlbshb;2:eje;1:gim;4:3k1;3:hizjhc;2:0io7h58jejiyoitrh1wkq;3:1hd6jveirlk0ojq;5:mj7;2:7mp8hghj4jgf;5:8inahechekjlll2niytj4wiu;9:qka;2:fjb;2:ijb;5:ljv;7:fis;b:0hc1ha3hg4hf8io9hbbpuciofhggh2jh5kkillwmhhogjpharh3uhbwh1;8:wja;3:jjc;5:2kk4iyiiq;6:0io;6:1kbwji;1:8j1;1:9hgahfbkggl4qjo;3:5j9;5:1he3h74hd8jf9q4akubj6cf1dhfegrgj0hhfklnlh2mhbnh4ohcpgqqh0sh4thcugw;2:dj5wks;1:8h3bj7rlnuk5;1:hjm;6:1je2io;g:4iq;3:il8oj0rjd;2:mj7;5:3kz;1:8jybjkuj4;4:dj9fij;2:wjx;3:kj2siztiw;2:1j92h93jj4h57hg8h49h8bjsdh7fj8ghgkhclheoggph9qp3rh0sjsthhuh4wh2;5:ciw;7:7mvqh9;2:8hhajmfhagjnkj5lj1niq;2:0k61gn6k5bkceizkhcrhe;7:0hf1io6h89h8agzbhbch7eh4gh4jg8kg4ln9miynh3ojupgyqjcrizshcthcukgvm2wgt;1:4ju;4:3j7;3:9j0cjijj5rhe;2:rjfsku;1:3k94hg8hcan7bj4ch9fjdghaiitjh3khfqhgrjnuh7wh9;1:0jj3ji4h88kd9h0ah9bgwchaehcgkbhhfij8jiokhgmheniwph8qj5rj8sgethgugswj0;1:8j89jajjt;3:8iv;2:hit;2:1jjkhb;2:ij4;1:kjl;4:gis;2:qk8;2:0j4;2:tk2;2:lk7;1:dio;4:nkb;3:1gt3hf8gh9gkagwck2dkfenegkrhhejgnllcnhcphgqivrfzth7uiuwgu;2:djdegtujp;2:9j2oj3;9:oix;1:dka;1:2ns7k4jhgohfqhb;4:4mv;3:9j6fjmuio;2:gj2;3:git;2:8ik;1:finwk9;6:fix;2:nk2;3:0ka;3:0j2qj0;k:tjcwjt;1:eimfj8jjh;5:8gt9jfgivqjq;5:uj1;3:3is;2:8heeiumj9tkb;2:gjcjj9;2:8jr9h0;4:0js;a:bjg;2:0k9dj6eh6;8:git;3:qjt;f:0hc3hd4jo8gb9j8ah4bh9chbdk5elzfkaggpihekjvmhgphdqhauj2wh1;3:fjnuiq;1:lk8;a:hlfjk2qherh7;2:jjbpjw;7:0ke1gr;4:4jf9jzahfcjgghghgziiljk4ojmphe;1:bj4civfh9hkrjiupjn;2:iiv;f:3kjjh9;2:7l2fj9jgo;2:ajbujg;1:giw;1:0it8ja9gkbjichbegugjbhgsjn4qiyrhash7win;8:8h89ju;2:bjpgjo;1:cjl;9:cj9;2:gk8;5:lin;2:4ly;9:glxqj9;3:bjdnjg;3:8il;e:ckvrhh;4:bka;6:dh8fji;1:wjg;4:tjx;2:8k0;7:gja;3:bizrjx;1:8heahgchcgqbhjorhfsiwuhfwhf;b:ciy;5:1jurh7;6:jjf;5:uj9;7:njq;4:9h1dimeky;4:jhbwjt;4:8iklju;5:0j3ij4;3:rk2;5:0ke1gr;a:cjadgiejr;4:0h31ik2ja3h84ks5hg6hd7hg8k29h9bjnch4dkfeoafkfggiiiqjgekh3lhemhdnheohbph1qgwrgwshfth0ugpwgh;4:rip;1:qk9;1:9jbsij;7:0hf1h03hc5lu7hb9goajpbgvdh9eisfkaggyjkflhcmhcnhbohcph1qgtrjbtkuwgm;1:ikj;2:8ik;1:8h2uk0;3:1il8kdajebh0fh4gjdkijlilpjxrh6;c:3k1cj1;b:9it;1:4j9fikjhhlh9nlqpk7qhg;4:fguujp;2:3j9hjejhhojipj6wjj;1:0ks1lsfheghfukf;1:7k08km;4:gj7;3:2pq4kg7jydhgehfjgyoh9phfqh0wh8;2:dhfeixtkj;7:1iq8jp9gqal7gixjh8lk3qhfrhcwhg;3:wkf;1:jjo;m:oiz;6:0h31ju3h84gw6hg7hf8j39gvah0bguch8dhdehdfinggshhdihbjh2kjwlk5nmroeipkxqgrrkpsjktirwgr;3:1he4j8aiqeh5fjcghfklwmjcoherjlthcuh2;4:himjik;5:oll;c:lhfnh6pmi;5:jjd;1:qk8;5:fjelk7;c:9j5fjjjkmrhfuik;2:0h72io6h47hg8irej0fiojh6pktqg2wn4;6:4ivoheqks;7:sik;6:gk8;1:oiz;3:0kn3gr4h05mh6ha8iv9gkagzbj4cgwdhceh5fh4gghhg3ih8jmgkh1lh8mhfnh8olmqg9rn3sgntgtugbvhbwj4;4:3it4hgfhbgj4ikpjhgujd;1:0ip1kf8iq;1:ahdcko;5:0hc1hb4in9j8agkbhecjndhdfgsggxhhhjjhkh7lhfmj5ojwpheqhbrlvsh7uh7wk8;3:wkf;4:8k79hcdgrek7;1:jjw;8:wjr;4:dkkeh8jje;7:pmmqh7;2:hhbjj6;9:1jrghfljawl2;2:ak8hjk;6:cjofj1ljjrh6;3:2kbbipjhfok3wiw;3:wjr;6:lix;1:dj7eh7;2:4jr;7:gk0;6:qk9;1:uiu;7:gix;2:4j9;1:uju;5:llxqk3;3:0he3h58gp9hbah3bh7dj7eiwfh5gkjjgxkhclhfmhhnhcohdph3riysj5tmhulxwgy;6:8gtum3vjf;6:8imahdchbehggj7kjnljonj4tj4wiu;5:eitfhdlk3wju;2:nj2;5:ojp;4:cj3;8:3jbojkpjawjp;3:8ir;9:gis;2:khelkx;2:njc;3:8ipajpbj6nip;1:ljvrh1;9:0hg1iw8gu9hads2ejggh9jhbrh9uh8whd;1:sjiujf;1:0go1o6rh3;3:0m3;4:9iouit;7:pkh;7:7jk;1:gknhh1jkl;4:hiyjij;b:jj3ojp;2:9lbel7uhg;g:ujg;1:dj8eh0fk8lh7qjxrjfuhd;b:0ilkk1lkquj6;2:lk8;8:bindjdmj9;6:tjm;5:giu;a:jjw;4:fkk;1:4imljvrh1;4:1l8gjcohb;8:ahhbitcimhkxjhdmiwrhatkn;a:hhhjja;3:ajfbhe;e:klh;1:jjo;3:4j2iis;3:8jt9jf;3:agxckfej2ghehgsjj7ljarjh;a:4j1;3:tjb;3:al3dirsj3uim;5:ul3vgb;5:8hd9jkdiveikfh5ujg;1:gja;1:2j3;6:7k8jhc;8:ujz;1:pjz;1:9j3;1:jkk;4:dim;2:4ik8h4ah3djeejdgh3phfrjhtisumdwhb;1:hhdjlarjushf;5:5ml;6:1hg3j38hgahabhhchdgldhj3jgzojdpj0qisripuhewj7;4:8h59ju;2:rix;1:8ineikfim;5:ajbchg;3:uit;1:riz;1:0j94iw5kshh7ijfjik;2:iki;5:8lb9fn;1:dkeeha;1:8h3bj7rlnuk5;b:1hd2k93h94im8h49heahdch6dh6eh7fjtghdiikjillizmk2ohfqhcrivuixvkqwh4;4:0k41it2gl4kp7n8bhgghgijsjh7khbqh2wh5;2:tjt;1:8jj;4:dj4eh6fjughgsm3uik;1:tjd;2:liy;1:gj6jkj;8:biz;3:gjk;6:wk8;3:oj5;1:ojy;6:fjrgkfhikjhekjjmizwhg;1:8hgahedjvehbgl2jhbqhdrhdsjctjduk4whc;4:4im8j29ilbkicijehgghakk2nhcphc;4:wjr;1:9k0cjbrjm;e:1jz;4:1irgmhrfb;1:4iz;b:0le2gf3gp4f05gc6gm7fx8ku9g8amobe6cilejmfizgjzipfjgckgzmfnnjqogmqersixtjiuhavgnwik;7:8ix;1:ajefh7gikhjs;1:ujg;1:rk0;3:fj8ukq;2:6hgphcqmowh6;2:8ix;7:1hg8hbchhfhagj8jgznjopjprlpwit;1:iki;1:fjf;9:5ipqk0;3:bj7;9:8iofir;5:hk7rh9;3:5j7aikgin;1:8gt9hgdjejiylj7ujcvkw;4:eks;7:gk4jj6;e:2hdojf;1:ej3;1:bkihitjhbojjqkbwhf;1:eix;a:8k1aimbjisjb;1:8hg9hcak5cgofmp;3:qjr;1:qk1;6:8hd9imeiofhdrk9ujf;3:ciwhixtjb;5:8j7;k:dj8ehg;4:oje;1:1j13jt8h6ciqgjwjhewkl;2:0iy1h73h74is5m78j89gkbh9fhfggvjglkl0okcpjpqhfrhauhewh7;3:tjm;1:9ilejl;2:0it3jx8g79jxajobj5chcdilrha;9:wjx;2:dgseki;3:wja;1:5jk;b:8ki9g9;2:civgjajjn;1:aj3bje;3:mj6qj4;2:rj9;4:jh6qiswls;1:oix;5:2kj4gp8hdahgfjrghcjh5qh6slzvliwhf;4:5lrohc;f:1j2hk7rh8;1:fis;5:0iu;1:jjj;2:1hg3lr5kc8hgdhhghdjjiqhgwj7;1:9j7;3:6kr;2:8jlehdnna;3:9izahhdj0njhuiq;4:0ha3hf7h18hbbhech8ehgjgtqjurhfstuwhd;6:0jb1jv3jm4ja8hf9hdahdchhdhdfhgjgrkhhnj8oh8pmtqimrgfthhwgz;8:1j52k53hh4h46lw7jv9hbbhadh3eikgh5jgykjamhcnhdoj5ph2qgtrhashhtinuhewh0;2:0hg1hg3hg8h59iyaplchcehbffuggfhhfjjzkhbohdph6qh7snpuipwh1;1:ahekh3mmuogtpjl;6:glssjj;7:4j18hb9heaiqcjoeh7fhhghehixiiljh9lj6rj7wji;2:0hd1hg3hd4k67ks8gq9h4ah7bkxcjhdh5fgggjujgmkh8nhgphfrkvshfth6uh0wh1;7:4ju;1:ek0fgzjhawl3;5:hlpjl0;3:1l1;a:jkmsjs;3:uiu;3:git;2:5mmjjjohepjmuhfwhg;8:2ix;9:3hf7h99gqag5bkgchcejvfkwjgxkhdqh8rhbsjttkyujiwhd;6:ak9;1:cjxehe;2:iiqrjh;5:8j9;4:diy;1:8iv;1:eje;3:0isgh9qlxrjv;1:9jdhj4tjq;3:bixrjwsis;4:girniy;3:ajcbiqkjalha;c:2k98hbbiljhdnmzojvph9wh9;1:7ks;4:gjk;2:dlbekbfiv;4:2ml7jloiv;8:agvclzfhfrjm;2:tiz;a:2k2oj8;d:dj9;1:jjkrlfthb;b:6n3;3:citgjs;1:aio;2:8k19n6eh7fhhjjnuhc;a:1hh3hc7h88ha9gjag1bk9ch6ejrfktghekhaqh2riyskrtkvuj1wh7;1:ol4qk6;2:mjh;4:8hgukf;1:bikcjm;1:8jv9gzaiybjl;7:aj8;3:fk8;a:ojp;7:qkp;4:3iv;2:9j2cjnfilgiwrh6uik;b:bjofje;4:njg;4:eh9umt;4:8ha9jhpjpuiv;1:ml4;8:1k88h4ahbkll;5:wj8;7:8gw9lubhbdknek4fh5ghdjj9riuuh0wjc;1:rjt;5:7gz8m29geah8bheehbghdkj6lhgmlyogkph2qhdrgttkguhgwle;4:2kbjhgkjklhbok2;c:hjh;2:0hh8k39nrah4bg6ck3dhcem0firgh3jgvmhdphdqherjothguh3wh3;7:bj7qj1;3:5ir8iw9k2ajlbhfehgfh3jiwkjolj8rhduhg;3:lje;9:9h8dj1rka;1:8heklqnm5phfuj0;4:gis;4:ej0njj;4:bjp;4:wjx;2:iis;8:0jh4hfujkwjp;2:8jy9h8dkhegzjkn;3:0ip;1:0l2wkk;2:bj3skguis;4:8iofjpgh9iipjkmmkxwgf;c:0hd1ja2it3h95jd8jv9gfah0bjachdfhhjkpkh1lhemizok8pjkqgsrgmthcuh6wgm;5:pk7;7:bjkckc;3:glssjj;3:qjk;k:rjt;4:5iz6kr;4:jjb;2:uiz;6:9iqrj1;6:2ju7kedj0ehejhbojb;4:pmmqh4;6:8jk;1:9gxbj1ckoehdfingk2rir;1:7kj;5:3kwijs;b:tk0;1:0l41gx3jlbh5ciughajhakhamnrohcpheqhfrj8wh7;5:8jf;1:1h22hd3o24gx5hc6jf7hd8ip9jmah7bioch7dh2fgsgglhhcihdkgxlhamh9nh7oh8pgqqjjrgdsgttnjvl1wfx;1:bl7civrjq;2:lj4;2:0io;3:jhbwjt;4:bkhgikkhhnjoqix;2:0ixokk;a:8hgukf;1:2ixljc;8:2h37js;3:jks;3:nit;3:khclkd;3:5lk;1:3kl;3:3k2bjb;1:8hgukf;7:fk9;9:8gf9kruin;5:0js;1:4hfkj9plf;5:akabj2;4:1jlkhd;6:0h21iq3h75ha7hf8gu9h5ag9bh6ckydgqeh5gg1hsbjlkkgvlhemhgnhdoj5pkaqgqshethbuh5wgc;3:9j3;2:8h2bk9;3:jjo;4:8jcjjlrhf;1:nhcpjv;7:gjw;1:rjs;8:bjp;1:0mlqh7;4:8gx9jl;3:gjtwjr;3:qk8;1:ehdjls;9:4ko;4:olc;6:9inojwrjh;6:ajqch6fhhjjkrh8smo;5:mhetl1;2:qj0;6:9h3ekr;4:0haimc;6:3he8kr9lzajsblncfsegkfh7ghdjgyklvlh7nhbph4qj0rhduhdwh1;6:uj1;2:nj3;2:fis;b:0hc4hgimi;3:9l5ajw;4:bjlcj4rip;3:uk0;8:aio;b:2l73j5qjy;2:oj4;1:djy;7:0hd6kd8hcah4bj5chcehhfgkgp4jj3kl4mhgphaqh8rhbuhgwgx;2:8hgukf;4:glssjj;1:0gz2j73h24ki6jx7hc8ju9febk8cgvdkjeoofkbggfiinjg7kgylh9mh9nhcoh4pgpqgmrgqshdtgxwg7;3:mj7;5:0iy1jqcipfjz;1:3hf7ha9grbkjejyfhhjgxqh9rhcsjwtkzujjwhe;4:1gu2hg3jr4ha5hc7hb9gtagwbntcindhafgwghehkyihejfmkgolh8mkdnhfohgph3qilrisshetkwugpvkwwgm;1:7k48gvagvcj2dk3eh2fj2giwjh9lljnhephcqhdrhhsjvuh8wh5;2:8io;1:5ko;1:0mlqh7;6:jkv;4:6n3;8:2j1;1:wja;4:8jidjiegm;2:diqwkq;1:0iqdh4ejbijr;3:gl7;6:2j1;5:gjqjkc;2:nj2;1:9jb;5:iiqrjh;d:8gg9k6;4:8h99h4ep2ghduil;4:lix;3:pk3;1:ik9;1:8iplhcqj3rjm;3:7ks;5:sj4;f:ajw;4:8ki9h1nis;b:gik;1:ujh;7:nj2;d:lje;1:rkythe;6:pjj;2:uiw;1:9j1fjlqjmuim;8:dje;6:8j1;3:1hc6js9imjhfnj9ojotkp;3:8ismle;1:3jwbj9wjo;9:bjkgkdrhe;3:pjj;7:tjm;5:hhhjja;8:gjuhkc;4:7m69kkbh7dheghfhitjjnqharj4shgth8uh0win;2:gjr;1:dj3eix;2:qjv;2:uiy;7:4jjhh2jkaojr;1:3mdagxckeghgjhdrjiwh7;3:nkb;3:8l0bhd;8:pkh;j:4ir6kp;8:2hdojf;1:lj2;9:4j95ld9juahbcjffhbghcjgqojspgzqhgrhdsk9whd;1:8j8bhcmj4qj3;b:aj3fjvljr;1:djaehe;2:8gt9jn;5:lhdrjr;7:ej1;1:qk1;3:6jx;1:cjkrhhsiztiw;5:dj3eix;4:8h79ju;1:3hg8kreku;5:hj0;1:ujwvhb;1:8irpl9;3:pmmqh4;9:qka;3:dik;2:9hdcilrjn;2:civtjs;e:jjo;1:ehagj3jnxwhf;1:cjadgiejr;1:eip;4:3k0qjm;g:2pq4kg7jydhgehfjgyoh9phfqh0wh8;3:eje;3:8k6;1:hh4jko;2:1h8bm4kh4mhfnl8rj6;3:ej3;1:0jl1gp2hg4il5hb6hd7he8ix9ixchadh8egpfgtggvhgfih9kktlh6milnh1ojxtkrujwwgh;a:jje;4:jjasj1;1:8jc9kbfhdkhbljhokcrhhtjp;5:0hf2k43hd7ja8h8ciwghejh3khclhdnm6ojppkpqh8uhewgy;1:fj1;9:mj7;6:hik;2:ajifha;6:8l0bhd;2:4iucjrrha;8:hirjh8oiurhgtk0wjh;a:dis;b:riv;2:ejkrjo;1:6jd7iybhhcismkjqio;2:qjk;2:aj9chfgjk;4:0ke1gr;3:dlqehe;c:9j2ujp;6:jk0;j:0jq3hh4is5km7k58ghaildikfgkihdjgoqixtl4uh6wgy;2:gin;3:5jktiq;9:1j8;4:jjo;8:dh6ejd;2:3hf9hgalibiqchbfgugh4hhfjn2qhdriwsjiwh9;2:8hcehdhlkjkztk5whd;5:4iucjrrha;b:liooirpk2;b:rjw;3:7khdj1;6:uiy;1:7ks;3:7jk;5:sj3;1:lj2;3:8m39jkajjchgfhb;3:fix;1:hil;2:fix;4:bip;5:wk8;6:olc;2:mjd;7:lj9;4:8iofir;2:6guwl5;3:5j8;4:vl5;5:fis;b:ciw;1:fjhnklplb;b:1k3;b:git;2:dgjejt;2:omb;a:chgejdrj9;a:8ju;2:8j1;1:bkqeiyjj3qhbsk5;1:8it;a:dj0eha;4:qk1;4:bkf;2:5jgohgpjwwhf;2:ojn;5:mk9;3:8j1;4:0oc2hf4gf5hd6hb7h99h4ajlbgucgzdhaegxfj2gn9hh8inwjgfkhblgomhfnkooh5pgrqgish5th6ugywge;4:8j1iiprjf;2:0hh4mopkzqhdwhg;f:3kgqhg;c:1gu3h64hf8js9jhbkvch3dk6emqggqjgtkkplhdmhdnh2ojbpheqh6rgzshgthbwh3;b:tj4;1:0hf1h42jg3jf4ke6me9hhagzbh9chgdhcfgkgjvhgsjj7oh7ph6qgurhgsk3thgujuwgj;3:ajfhjdujn;2:rk0;1:8iq9jeajdbjrcj5egtkjhnhg;4:0hg8goahabhcch9egofh6gh4hiujjmml0phdqhcrh9tj7uptwh8;2:bkhcimgk1hkajiurh6;c:hk0jjprh7;2:ris;1:uh9vke;1:iis;f:5lt;2:gh1sjt;3:pl4qhfwjx;3:3jv9iqaitjh6rljwhf;b:0kh1iw4kz7h8ijxjh9khdqhewja;1:4h67gy8lz9gdah7bhcchgehaghbijhkj4lhfmlxogjph0qhcrgrtkeuhewlb;5:jjk;5:0ij3l6;2:kh5mn0ogvphe;3:8iw;1:0iz;4:0irdjhej7ujj;1:2he3mf;1:kj9;8:bixfjokhdlhcnh0ohgpgvrlnsjltk6uha;1:8j1;5:cjsrha;1:4j2iis;1:1on3ha5ga6g37fs8fy9efakobk1ckxdg5efbfk5glahjrig8jgtkktlfimm9ng3oj6qf0rkasiptfvugsvgowhc;2:4ij;1:ljd;5:wkp;1:fjf;6:uiu;8:8iw;1:jjx;5:fkjkjn;3:ajfbhe;2:hhajlrwj7;8:9j0ah9cizikj;5:8k39hhwjt;3:pkh;2:eiv;2:dj0eha;6:7jlhil;4:rjz;n:0h51jq;3:1hf3ha8ft9j9aitbhcck3dh0fh5ggthggjkjkh3lizoj8phgqjnrk4uh8wkd;4:8jp9hf;5:ujs;d:fiy;6:qka;2:sj0tix;1:jkbpjt;9:2j23il;4:ciy;3:0ke4j6dj4;a:qjk;6:2ix;3:qlz;1:1k4;2:ij4;5:gisuj7;k:bim;5:bip;1:ris;5:8h7chgfhagguhswjlirghuhfwh8;7:3jp;4:8in;5:mj7;6:khglkd;4:fkjkjn;7:khclkd;3:hin;a:hiq;1:9je;4:okm;4:4iughfkhgok6rhfwmj;5:fik;5:0gs1o42g53f64ff5g46g17fl8g39e5am9bjkckddfneg2fmigkhhl7je3kn6ln3mobnfzogjqedrn1sgdtfouegvgjwgt;4:ajbchg;3:fhfukw;1:jjb;2:8io;8:8hgbiqeiojl9ljxph7qkowha;3:gis;7:qj6;5:9hbejh;2:dj8ehg;2:njg;1:ej6;4:0ka;1:aj8;2:qjk;1:qjv;1:2kg4itchefk2iinmkbrhd;2:2l33nj;7:pjr;6:hjgjjn;3:7kbbingjk;b:4iz;3:wjx;1:8irlhdrjn;1:olm;2:9j3;7:histk1;3:0hg1gx3hg4jb7kc8ez9jcahach7dhhehfghclh4mjxnlfol1pgtqh7thhukwwh2;8:9ikaj0fin;g:8j1;1:ujr;1:qk8;2:5jv8ip;3:klh;5:9jschh;2:3hd8kk9izhgqjizphbqj5rhgtlyuio;1:jjx;c:wju;3:fh6gkihinjhgmj2qjx;8:qk1;3:0ioris;5:bip;6:gjrhjt;5:0j0;3:gk7ljh;2:2hdojf;2:1jv8jw9mxeh6fheghejjiohhuha;1:oku;1:0j51m73m54ip5gy6hc7h4ah3ch1diwegifgzgg6hjbiizjjikg7lgwmgzngnom4pgjrkasgyugcvhdwfz;4:6kp;2:4m3qhf;1:kiznit;1:8j9ehc;3:8kk9hauk2;a:9j5;1:5kh;1:0hcglbjj9rlbshb;3:9j3;3:nkmple;5:eimjjnpjqrh7;2:lgyrk9;8:gix;1:2iq7l08ha9hcbldcjvehdghejhfrjmthfuhg;4:8h8iiook0tmtwhb;2:alq;8:8gz9jpam0cipfgwghgjj0riosha;2:riz;1:ljd;5:diw;1:eik;1:nk0;3:0l2wkk;7:ej3;6:6n1bikdjcjhg;1:nlc;2:pl9;3:hjm;4:eisfhalk2nj0wjq;5:ojp;8:0ha1jk3hf8h39hgbglfhcgh9jhakm2mlfnk4pjzqherh4sioth9wh6;6:jjmuj7;2:0h81h63ha4h85hf6hg8ga9j2ajcbgxcludinehcfgihhblijmh9ogspk9rgash6thcugzwp2;e:cim;1:9j9ejafh2lj1;b:gitiiq;5:jj9rjo;a:cjt;6:hjm;1:8hctn2;b:rk3;1:ej3;4:8ha9hfbhcckldh5elflj7;1:0he1hd8h3ah3bhgchheisfotgjdhj6jh5khelhcmhfnhfohfph7qjgrh5tgyujjwjx;2:hhbjj6;9:hil;3:sj3;2:rjs;2:jinqjf;8:fjf;4:gj8rlg;a:fjp;6:9hdrkk;1:jj8;5:1je2n63l44knjh6ohaph9qgnwha;3:0h13nl4hb8h7ehgipfjhaqh0wh6;3:8gtum3vjf;c:4iwghhok8wkt;4:eimfj6hirqiw;3:0jjwjr;2:8gvbivciqehdfhfghfhknjikth9umswhe;1:9khahfchhdkaeitghgjjqujswhb;6:fkk;2:wj6;1:fjf;2:8j7;2:8k89j9jiyujy;2:1hd3gn4hb7hg8mm9lqal3bgech2elagh1jg7kgrlhgmhgohcphfqh1riutheuk4wgz;4:0h31h92hg3h84hc7hf8is9hbaisbkwcisehegh8jgwkktllxofuphaqntrh5uhdwh3;5:8ji9khtjv;7:8iofir;4:ahfcivfjj;a:qk1;4:4it8gdqjitlp;4:2iz8hdujzvjhwk9;4:1hh8jw9nwah8bhbck2eh1fh8ggthjwjgzmhfsivugmvk1wha;6:eiulk4;4:bhckjt;2:ajccivjjgrhe;3:9io;1:jk8;5:hjcjh8mjdwk3;6:glvrh6;c:8j3uki;1:chehkjjjm;4:dimeji;f:sj4;1:4mb;3:mjh;2:0hc1jq3hc4hc8im9joagrbh5ch9ek2fiujh0kjblkimhfnh6ohdpgyqilrkbshfth8wgt;6:fik;5:jje;1:tjc;3:sj3;2:jjm;5:glxqj9;2:mk0;4:oku;9:3l2wjj;8:0hd1k5;9:0it5ir8ip;2:8h2uk0;2:rjfsku;a:akr;3:hik;4:0k21is2gk4km7n6bhfgheijrjilkhbphgqgywh0;5:bj8;1:tjt;5:chfrj1;8:2ki7jodj9jhhqjg;4:6khpkvqhd;2:bj6;2:iki;3:jjx;1:3jv8jq9gy;1:8iu9j7bkeej0gh7kjtljpngypgyuha;7:0lc3hcgksikljhcqhe;3:8h69iqoknpk7;i:0hf3lu8h99h9ah7cirdguehdfocgh7jhakhbqkhshguhbwha;1:biz;7:hin;1:aheejeghfjhekjflkhqhermfwhe;9:jjb;8:aj7;2:sjy;6:ajl;4:rjs;2:0j6;3:0lm;1:hjs;1:wju;5:1kedj3ehdiio;1:fjf;a:rjdsktuja;2:jj8;7:civ;1:8jq9gzqjq;2:ojp;6:gjqjkc;7:fkv;6:jnmvk4wgz;8:dit;9:dj7eh7oiz;3:1jtoix;1:9k7cjm;5:9ivah8cjggionhfpnfrh0;h:3j59hedhgehafgggnijitpheqh8rh4sl1uhgwjm;6:9iw;4:8hgukf;7:ajdciw;3:rjh;1:7kiajcbjcjhdkhf;1:0he1h22jt3k44j78h19kvagyclxehffhcgh6iizjh6phbqh8rj7uhawh9;2:8iu9j6eiqfhg;2:0hc1jt3je4h86ls7il8f8ahebh6dhgeh6ggyhj1jgvkiulh4mimnhbph7qjfrh5shgtkqul2wg6;9:hk0jjprh7;5:0jo1mu2hc3n04j28grahebj0chgdhdehgfhbgguij7jgwkgglh7mhbngtokwph0qivrh2shcth1uhbwgy;8:lje;2:nk0;3:pjw;1:qj6rjdskqwhg;9:1jb2h83hc4lu8h3ah5fh4ghcjh8khglk6ml3nh5oh9pn2qh8thcwh1;1:9j7;1:diwjji;6:gis;d:8kpkizlhhnhdqk6sjythf;a:ujr;2:jj8;2:oje;1:hhhjja;6:aipgim;1:qle;5:qkw;1:sj4;1:8ix;9:hiw;2:gjm;4:1he8h39jvaj6ciwjhfrj3wjp;1:7kc;2:pkh;5:mjh;8:7ks;3:0iv4jojj5;1:dje;1:hk5jk5qhgrh8;7:gjejhfrjt;3:9j8ej9fh3mkgrgu;2:1iz2jx6j57hf9gwahgggyminnkqojepgzqgyrh5thduj2vh1wgz;d:aio;1:ljl;3:mjp;2:fhepnp;3:0gp1gs2h83k54gt5h46h27k78k29k5ag6cggdm1ekwfg6jgrkgolgznhcogzpgqqj3rh6tj7uizvjbwh2;2:5iw6jd7ixbhgcitmj1qiq;1:aj6;3:2ix;b:jjf;1:uja;d:4myiiomjc;8:ahhchbhklmjfsio;7:uiu;3:8izahdbjschceh0fheggvjhgkjnljonj2qjctj0wip;3:hjh;3:9k7cjm;5:ajr;7:jk0;6:pkgqj3;1:eik;c:3l75hg8j79j0bjdchfeh8fiwgh5jh5lj0mj3qhbrh7uk8wh5;h:hiylkopheql6;2:sj4;1:2l93jb;2:0l2;5:8jy9gj;1:4iz;1:5lqlkrqhd;3:jjc;7:0js;2:ciw;6:1iw2im8jv9gsalqbh3fgfkinliwnik;2:8h7dnvegz;2:dj0;c:0m2fiw;1:gjr;1:ejkhikjhc;2:gjk;f:qka;6:8ilchcfgukjlll2niytj3wis;b:8ijsintl6;1:8h99j9filghhuirwk4;5:cksjj8rhcsin;6:jjf;1:1kv8gz9j3ah1fhfgllkl2rgy;1:fis;1:sj6uhgvjm;4:kgsnh7pml;5:bk5;1:cj4jjjrh9wkb;6:bj3kjcqj0;b:8iq9jeajdbjrcj5egtkjhnhg;3:6m6jhfohapj3qh6uhbvkfwjk;3:8j5;2:0hd1hg3hd4hd8g4bjxch3dmqen1fl4jj1kh9lhfnhfohcphaqgorh1skgth3ugtwgs;2:dkeqj5;1:chgejdrj9;3:ein;3:ait;4:0jo;f:6hfdjbfjyghfukz;5:uj9;2:ajbsivujf;1:8h89hebh1clpdh5elg;3:8ir;6:jh5mldwjm;3:0kf1gy3h54hd5iu8iq9gzagxbmzch6dkfegkfhagjzih8jh3khdlizmhepheqj1rgzsgqthduhdwjs;1:8ks9j8eh8uhd;1:3jwcitdj1egyukj;2:okl;4:3jbojkpjawjp;7:0nk4hcdj3eh9wjh;6:aik;2:hhhjja;2:jjx;7:8he9gkbjvflughdjhcrk0uhdwjd;2:pjz;2:bil;3:4iuiinnjdoj1rja;3:sl0;4:1j8;1:0jw1in3iu8h1dl6ljprgs;2:8ik9iubhedizej3ujm;8:okiwk5;3:0hc1gz8h59hgam8bhcciudhdejpfljjh6kh1mh7pknrh3sizuh6wh7;6:fjq;2:jhbwjt;2:jjh;3:mkirgx;2:gjb;6:jjf;1:bk2rir;1:4ipqjj;3:8ijsintl6;2:7kg9izajqdiseiofh0jhaliyrhb;5:7kq8j5jiuwhh;1:0it;6:bjj;3:wjx;1:wk7;5:wjp;2:rhhtkv;1:ajxbil;5:8iqbjcsim;3:jkb;2:hjpjjg;5:4ku;3:0iudj9ej3;1:nkariq;2:4m3qhf;3:rjw;8:8k9fjmuhf;3:3k1;5:dk6rip;d:1jm2he4m7ohh;3:5j0;2:rjh;1:2io;1:bj6eh2ffxgkdjmjrhfuhewjw;2:7iz;1:omb;5:7iz;a:gjk;g:1pg2gj3ft4fz5gj6gm7g28ge9esalnbktclgdgaef6flhgjphkvigijfekl9lfpmmqngmpj6qfmrktsgwtg7uf0vgw;a:9jf;2:8fy9ldriq;3:8j4ck2rgk;2:bj9lik;b:6n2djcjhg;2:gipkjq;8:bjg;8:ahdejgjgpsm4;3:fhdnjewjt;3:sjm;2:cjxehe;6:eixfivqk7;5:rjq;2:kjc;1:8gt9jydjgegnfj0jh9umy;8:0iu;1:5j8;8:jhfwjn;3:1jsjjvwkz;5:8iw;2:8hcdk7;5:8in9j7;4:0g41oj2hh3h04h35hd7hhckjdhaegofgkgjghktihgjgekh9lhcmjioh0ph4qgpro7sheth9ugwwgs;7:jkk;3:rjf;2:2kn4guvlm;1:0py1jb3h98il9guah9bhgfh6ghblhemj2phdqh0rllsh5uhawgz;6:jjprha;j:ciojhhrlu;2:4irohfpmzqhf;3:ahecj2gj6iiq;4:ahdcko;2:3hc8klah4bhecmidgqem5fh3ghajgzoh7pjgqhfrh5wj2;9:jjk;9:0hb1f23gy4he5hh7hf8vbahebnkch7dh4efzggyhhejgckmelh8mh0oh4phbqh1rg9sh7tgrukrwgl;2:ej3;2:0iy;i:jjkwkc;1:djaehe;3:4j6;1:ejo;1:jjo;3:tjx;1:2kt4gx;c:6jwdjcuiq;4:8iugj7;3:iiv;1:okm;1:ajaciujjdoiyrhd;2:1jk8iz9isaiwlhgnljph6;2:jjl;4:8j79ixaj1;e:qk8;1:4mv;2:3is;1:3he8hf9hcaizbhfckjdh3eirfh6ggwhgkjjakh5lj0ojcqjqrinwkg;2:0hgiju;3:2l93jb;6:gjlhivjktlj9qhcrh7;2:bipujf;1:4ju;1:dh6ejd;2:8hhdlaekafivril;2:0hf1ha4hf5hh8mz9npah2bfjck0dhcelzfipggxjgskhdmh8phbqhcrjbshgtheuh0wgy;i:7kd;2:fjc;1:1krohd;3:djf;1:2l27ka;b:jk8;6:3k1;1:tjd;1:qk9;2:fjf;2:8iv;6:7kfdj0ehejhcniyoko;1:fl1;4:0hh8k39nrah4bg6ck3dhcem0firgh3jgvmhdphdqherjothguh3wh3;8:3k1;5:8hglkl;6:9jb;2:4jprju;1:ajdbio;2:8j9;3:8it;3:dip;8:aj9;5:2he3ji8l69hdrj8tlzuh4;1:0h21go2hh3hc5hg6hd8gw9h0agvcgmdh3ejpflmihdjgskiolqgmgwnh6ogrpgyrn5sh2tgougfwj3;6:fkk;4:dk6rip;3:8is;2:2kcbjgjhgok5;2:5j8njg;1:0j58jjljb;6:qk1;2:0hc4hgimi;4:wja;1:8jr9h0;1:gin;1:9io;3:2iwkjq;e:8iq9jzbkkchfghakk3nhcphcuhf;4:riv;6:wks;8:1kv2fz3hd7qbah9bh8chdgh5jijmhgoh3ph8qimrh7sk9thfuh7wj3;3:0isgh9qlxrjv;7:9k7cjm;4:dj8;3:cjhsj7;1:wk7;5:fjughhsm4uil;j:4iq;2:9ioiki;4:1jlrhe;3:8je;2:2kt4gx;1:4ju;c:4irfjigkw;1:jkc;1:fis;c:4mn8hgeh4ghdumj;1:iki;6:0hf8la9ljaizbioch1egzfh1ghckjzlg3ohgqhgrimshfukdwh8;1:pjy;5:9iroj3;3:ujx;1:8jl9hfcj1;5:0jo;8:cjhrhb;4:3jahjfojipj7wjk;2:0hd1ha3h94h87hh8khal0bh2ch9djuegofitjgakgslgxmh9ngrpglqgxrivsl9tmkujdwgj;3:9hedkdegz;1:8iw;3:0istk6;4:ej0mja;4:8je;b:mh9tmq;4:8iw;4:hjssj2;3:3hb8h69hbbhgchgfhaggths6jjdrgfwl0;2:pjz;2:0iz;4:6mi;1:3lq4hf8iq9isal6bgrch7ek2jh1linohfphcqh7rh2uh3wgx;7:0m1;7:jjiqjk;2:6kq;1:5ik;b:3kfiitqhf;4:ciufk4;3:9ik;4:3k1;1:0ir8j1ck1rgj;6:jjo;1:tkj;1:0qe1jkjhdqhbrhgwhe;1:djaeh3fkfqiu;6:8ix;f:bjm;3:0lcdirmjrsiu;5:8je;3:8izbkgdixgh7kk1nhbph8uhd;7:rj2;2:2iy8jijkq;4:ajw;1:pmmqh4;6:qki;6:jj8;1:dj8;1:dj5ehf;1:cj2ej8jltwhg;1:ckhfjdrhf;4:8ld9gpdlueg4rj3uhb;1:qjt;2:rk3;3:1k43jm4jlgiwjhbqjdrgx;1:0jg;6:8ir;1:fiz;2:cjnwjs;1:bhccm7fiy;1:bjg;3:eixgkn;6:cj2ej8jltwhg;1:uhdvji;5:sik;1:hhhjja;1:0gj1je2h73fz4gu5h76hb7gr8n3bfpcivekzffkgfrjfwkiolk3mgxoispgqqgesgztjzvl2wl0;7:8jf;1:1kqrh2;1:wkr;6:0h43k48he9hbahccjkeh6fh9ghbjnjphcqh1rhfuhbvjvwkn;3:1hfan5fh3glajhdrh2sjgwhb;2:2hb3ma8k99h3jhaujw;3:mjh;3:qka;6:gje;4:biz;2:3kl;5:3j48jubjhuj3;1:8hgukf;4:lku;i:1j9rki;5:5jhojb;3:8jtbkcchdehahipkj5nipwiy;p:nj8;1:8hhrjvujw;2:1hf2k38gp9k3ah3cleej9fjegjkjhckhbmheoh7phfwh7;5:ajh;2:jjo;1:tjd;9:hhbjj6;a:dgxek9;6:0iwqk4;b:qjt;b:mh9tmq;2:3j66ha8h8bk7dh7fhdgh4jk0oj7pheqh1uknvm4wgy;f:dj6eh4lja;4:1je2io;2:8is;6:bj3hjs;2:wj6;1:bjbginnjp;6:kkbphh;2:ciy;1:biudh4ekkjiykhbljuml1nheojgph5rhfuh8;2:4imljvrh1;7:dj7eh7;2:wkr;1:njg;5:dj3eix;c:riw;6:5j8;9:chfhkq;1:rj0;4:8lc9loaj0bipch3eh0fh4ghekk0lg4ohhrinshfuinwhb;4:dj8ehg;2:rk1;4:hhbjj6;5:8inahecjs;8:qkt;a:rjh;2:ujq;8:0k78hfcirrjw;g:qka;1:bj7;1:jj4;4:hio;4:9j3;7:fik;5:lhdnlvpgs;3:2hf3hc4he6h77gn9g9am6bjrfj6gjdhhfjgekh7njbpheqgyrh1thcujwwjr;1:4jt8gzmkcrgtujq;3:8hajiymjirjjwke;4:8jg9h8aj8ciskj3lk2;2:0iu;2:0ha3hf7h18hbbhech8ehgjgtqjurhfstuwhd;1:bivokr;9:1jtoix;7:7j6;4:1j6wjw;5:3ja;1:rhhtkv;1:4jmjhdojt;6:2ji7h8;4:1hfbhecj3khemo5;3:0ip;2:ek2fh4;3:1h57jrbgyglamk4okcpiyrgq;6:9k6bin;1:nj2;3:0gk1gm2h33ly4go5gz6gy7jz8j09mnafqcg8dlmelhfg1ggtihekgjlgwnh7ogppgjrh1tiyuikvj6;4:0hb1h99hfah9bhcchcej8gh5jh4kj1lr3mhdoh4ph9qh3rm1wh2;5:eiv;1:9iv;1:4j8iiq;7:0h51h83l74h67h58fy9libkjcjuditfgzhg6ihfjhengvoh5pgishetiuugt;3:fj7nk2;1:fj3ljk;1:4iv;6:9hhrjl;d:aj8;1:uit;3:3k1;5:6mpqgs;2:1h58hf9jmajxbircjaeh9fh5ghcjhekhgohepjlrlj;k:nkb;2:9it;2:3kd5mkjgqqha;3:iiv;5:tln;c:ujg;1:ahfejffkxgkh;1:3hg8kreku;2:pla;2:iiu;1:6koeiymj7niuwhf;5:9jb;3:8j69n2ajxbjpcg2ehgfhajhbkm0lh9nhcph6qhfrhgwh6;2:qiy;2:2he3mf;6:jmhqit;1:5j67ithgmohfpjpwlj;a:3kebjojgy;a:8k3eir;3:tjd;1:0in4iv8gy9h8ah4cv5ehggh3hhbjh3rgzshfwhd;i:3kz;8:wk5;2:0h81hg3hd6hf8m4biwdlgefpfh9gjthh6jjymipnhfohgpkfqgyrj4th9ugrwgu;9:qlh;1:ajw;m:0he1hg3hh4ja9hgaiwbjldkzehffhbghgmj1pkrqgurirthguh1wh8;2:4ik8h4ah3djeejdgh3phfrjhtisumdwhb;2:filqjgwk3;7:8h1fhdiilojyqhdtmqwjj;6:pl9;b:jhdqjm;2:3j35kk;8:oh5qm6;1:jj8;6:qjv;1:uj1;4:8ineil;5:0h51gr2hg3hb4ha8oaajnbg2dg0en8ffsggfiiljgnkgvlkrmhcniloheph5qgwritshatl3ugt;2:njyqku;2:diz;3:9jm;1:0ks1lsfheghfukf;b:2j1;6:0j84hb5hf9giamsbh2direjzfkfgiyhjmihdjgskgvlhdmh0nhhoh8pk7qhdrh8sirth2ugtwgt;a:1jz;3:qh7wlp;1:3jv8h7gjywkm;1:0ju1ij3jl4hc8iv9jdaixbh6ch7ehcgiyijajgnkhenivoh5pj3qjcrgusgqthfuh7win;2:djxehb;3:niz;2:qki;3:fis;2:khfmjgtmmwh8;7:8hediwehggiqllx;7:8jt9jf;9:klh;2:0l4ijrjhfoiqrjf;3:8gt9jn;3:0jm4hh5j5;2:0ip7h58jfjj1rh7wkr;1:0k61ir3ix;4:ske;2:9io;4:giprhgtku;1:8jtkj0nheqk7sk0thf;3:0jw3h0bj5;5:4jq;1:wjg;4:ehaukt;1:3jv;1:9joaiqbk4egwkjknhh;3:9j3;7:0jl;6:aj7;5:4im8j39ilbkjcijehhghbkk3nhcphc;1:jh1wn3;7:8h9unc;4:5j8njg;6:bjg;1:gjm;1:bj4jj3kktrimwhg;2:ej6;4:8iofir;4:ckq;1:tjd;3:hhbjj6;1:iki;7:8hfej2uki;4:ijs;2:8lc9loaj0bipch3eh0fh4ghekk0lg4ohhrinshfuinwhb;6:0j0;b:lji;5:ehfujv;3:njg;a:ak1;9:5j8;9:ej3;9:ej0njj;4:0k41is2gl4ko7n7bhgghgijsjh6khbqh2wh5;1:2hc3mahhcjjb;8:oju;2:0jf4j65j9;8:him;1:0gm4koikqpl0qhbwhf;a:riz;1:gj3;6:rk3;3:ujs;5:7k2;6:gik;1:dj3ehfjjt;5:0h33k24hhahccjeeh4fh8gh9jnhphaqgzrhathfuh9vjuwkl;1:ikj;6:hk5jk5qhgrh8;2:lj4;3:8iv;7:8im9jydj1egugjdjhfuiuwiv;1:aj7chcjlcqkuwhc;4:tk5;7:8iw;3:gjd;5:klh;8:1kcuhfvjl;3:lj4;1:eiv;4:1h58gybkach7fjbgjnjhckh1lh6mhengxoh1pgnrn8sjetjxwhf;7:gj6;2:anhbjhchdfgxjherjz;2:qiw;4:4iucjrrha;6:1j8;2:9j5;2:rix;4:hk7rh9;8:9jmajenjerj9;4:hiz;9:3l28it;a:uiw;2:8j1;a:gjcjjv;7:khelkx;4:djcegrfk1ujm;1:djbrjcul8vh9;2:9h3ejigl4jhgoj6rjd;3:dh6ejd;6:jk0;1:8fz9li;a:dj8ehg;4:8h49ksdn6ek8fh7jjjrh8uguwha;4:9jc;1:8hadj5tn1;1:jjf;3:bixpkg;1:2k98hbbiljhdnmzojvph9wh9;7:dj9fij;2:giukkalgx;2:ajh;2:tjpujq;4:0lq3in;2:8jy;6:jja;5:aix;4:jkc;2:ij4;1:8h7bkq;2:4iucjrrha;4:jjb;9:wjr;2:ris;5:tiw;3:wkt;3:0hh1jd2hd3h54ir8fw9h0ak3bgqcgpeh8fjlgkzhh9jgnkkxllwmhenheol8ph6qiprfdwgi;6:hil;2:fjmgir;5:siw;4:4mx8h2cheiimlkbml7thfwh8;4:8kpej3jfkljyrh8uh7vnf;1:nlc;4:8iqhgvjkwnhbpjs;6:0lm;4:2k9;5:glssjj;2:bjpgjo;a:9hceknjh0oj8qimwlk;5:0io1gq2o83gk4kg5h26h07lk8e79g5agdbglchbdsvgfqhgsigsjebkgwlgvmj3ngjogfplcqffrj1sgytgfujjvh3wkv;4:ujh;2:jiq;6:mj7;4:8iz9h8;3:ahcfgygnkjjmkhgljr;a:qka;c:8irbjd;6:ojp;6:8hfqjptki;1:him;1:civwj5;3:ait;a:dka;6:mix;1:djy;1:rip;p:6ji;4:8hfdl1ek1fipghejk8whd;5:1jjdh7fjwkha;2:okl;3:4he7in8jq9gmah9bhdjh1kldnmtoh6pjauiuwhd;7:bhckjt;4:mmb;2:ajhciogj1ij5jjckjcwhh;g:8hddk9eh0gjejkg;4:4j9;4:ukj;1:jjqpj4qh9wkz;7:9imfjjgiktjp;4:niz;1:rjz;3:fjf;2:ajuqjnrhf;4:6kh8h39kqdkpek8fh9ghcjj8qh9rj3uh5wgs;2:wjg;1:sjcuiy;1:5jw;6:qin;2:0h21ir3h24h65hd8gt9ghbhbcl5dhdegwfh2gjqhl4jgdkhblhgmjiokspgwqgtrpcthcuh0wgt;4:8ivdjt;2:ajifha;3:0gz1gc2lm3gs4jc5ha6hd7gu8gz9h7aimbhadh9eh3fguihcjkokgtlh5mhdnikonaqjwsijth9ugwwio;4:8ioahgchfghdkjmll3niztj4wiw;1:rir;3:4io;c:2is;2:mlf;c:wje;7:lhdnlvpgs;1:fja;c:8g5ani;1:bjp;2:jj8;3:4ivqivrk0;6:0isdj7ej2ujn;7:uja;4:0im4lyajxdj5eizgh9phgqhawh7;4:dj0ehc;5:9hcaiwfhdrk9;4:fikwj8;1:riusiv;1:4ingj5hilrjo;9:3jz9h8rka;2:5lq8ipohb;b:4mb;1:jhfol4pjh;2:0jl;2:hja;6:3j8qjh;2:dj6;5:bjyjjarkjshc;1:ajuqjnrhe;1:2l93jb;1:1heghdklaokkpjz;1:9jf;7:jiosiv;7:1joajurgp;2:jjw;3:ahfpk8;o:1hc3h25hg6h87h38h39geafvbjxcgyejifkjgh1hhejhgkh5lhdmhaohdphbqghrikskftkoulwvlx;5:6mf;4:0hf3h98h2aggchgegofkcgjkjojkhdphdqh5rjbuh0wkv;4:jjj;3:jk0;7:ak9;2:hgujj9qlf;4:bir;b:gk8;1:ciurjy;4:rix;a:dm1ekhfhe;7:bkmhivojk;3:1hh8h6aiyblncj0jhekkzlm8ogtphgqh4whe;4:6guainwl3;5:wjg;3:wk7;3:eil;7:8jt9jf;1:iiv;5:2io8jm9gygiljheqjnwj1;4:0hd3hb4hf8h2ipxjhbqhdwlv;7:cj1ej8jlsniwwhb;8:qka;3:9iqgkb;1:bjp;1:aj6;2:8j1;a:ojc;3:fik;3:aj4mj7;1:kkblgx;2:mlf;6:0ko1h93kt4hc5hc6hg7gt8lk9h7ahdchbdgpej2fh0ggvij6kh8lh9mh6nh8ohgph4qj1rjiskmtgguh5wje;1:bkewj7;1:6hbahffhdglbohhqh5rhdsj7ul0vm8wh3;3:jjprha;c:bim;4:dh1foskhg;8:6mi;8:wkr;3:lgyrk9;1:8gtum3vjf;1:dh6ejd;2:0iwqk4;2:qjr;3:0he8jagldjjjrjjshcuhb;7:jjb;2:8iw;9:ik4;3:iitnjz;a:1jf2k16j8fgzjh8kiqmitoikphbqh9ujfvh3wh9;4:8ks9j8eh8uhd;2:2ju7kedj0ehejhbojb;5:ainfhdgiljkdrkuwj8;2:4j9;4:lkm;2:1je2io;7:gik;3:tjd;7:olk;1:rip;1:aj8hik;9:5j0;8:0ky;1:9iw;1:alocis;2:4jr;8:8hdjixrjauixwjw;1:birgiq;1:fl1;1:lje;d:okm;3:0h31h32he3iw4h45he8iv9gocipdkheiuggihk7ij1jgakhalhanh9oizph9qgzrkfshftluugnwgi;4:bj5kkurin;1:lkm;8:jks;3:eiv;5:ejijh2qjr;b:okn;1:9leelgjh9;3:3is;4:4iv;3:5j2eitfhcris;2:hja;3:hlfjk2qherh7;3:cjvehd;3:qjv;5:nmhphe;1:giojkrrjd;1:iki;4:0jg;3:bjichgeisgk3rhbwke"}/*MODEL-BITIS*/;
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
      adlar: ['James', 'Oliver', 'Jack', 'Harry', 'George', 'Noah', 'Liam', 'Ethan', 'Daniel', 'Ryan', 'Emma', 'Olivia', 'Amelia',
        'Sophie', 'Grace', 'Chloe', 'Emily', 'Hannah', 'Lucy', 'Ella', 'Mia', 'Jessica'],
      soyadlar: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White',
        'Hughes', 'Edwards', 'Green', 'Hall', 'Wood', 'Harris', 'Clarke', 'Cooper', 'Turner'],
      sehirler: ['London', 'Manchester', 'Liverpool', 'Bristol', 'Leeds', 'Glasgow', 'Dublin', 'New York', 'Chicago', 'Boston',
        'Toronto', 'Sydney', 'Melbourne', 'Auckland']
    },
    de: {
      adlar: ['Lukas', 'Leon', 'Jonas', 'Felix', 'Paul', 'Max', 'Finn', 'Elias', 'Tim', 'Jan', 'Anna', 'Lena', 'Laura', 'Lea',
        'Sophie', 'Marie', 'Julia', 'Hannah', 'Clara', 'Lisa'],
      soyadlar: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch',
        'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Zimmermann', 'Krüger', 'Hartmann', 'Lange'],
      sehirler: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Leipzig', 'Bremen',
        'Wien', 'Graz', 'Zürich', 'Basel']
    },
    es: {
      adlar: ['Carlos', 'Javier', 'Pablo', 'Diego', 'Alejandro', 'Sergio', 'Miguel', 'Daniel', 'Hugo', 'Mateo', 'Lucía', 'María',
        'Paula', 'Sofía', 'Carmen', 'Laura', 'Elena', 'Marta', 'Valeria', 'Isabel'],
      soyadlar: ['García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
        'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Ramos'],
      sehirler: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Bilbao', 'Zaragoza', 'Granada', 'Ciudad de México',
        'Guadalajara', 'Buenos Aires', 'Bogotá', 'Lima', 'Santiago']
    },
    az: {
      adlar: ['Elvin', 'Orxan', 'Rəşad', 'Tural', 'Ramil', 'Kamran', 'Elnur', 'Vüsal', 'Fərid', 'Nihad', 'Aysel', 'Leyla', 'Nərmin',
        'Günay', 'Səbinə', 'Aynur', 'Lalə', 'Nigar', 'Fidan', 'Ülviyyə'],
      soyadlar: ['Məmmədov', 'Hüseynov', 'Həsənov', 'Quliyev', 'İsmayılov', 'Abbasov', 'Bağırov', 'Rzayev', 'Kərimov', 'Cəfərov',
        'Rəhimov', 'Nəsirov', 'Sadıqov', 'Mustafayev', 'Əhmədov', 'Babayev', 'Orucov', 'Novruzov', 'Zeynalov', 'Vəliyev'],
      sehirler: ['Bakı', 'Gəncə', 'Sumqayıt', 'Şəki', 'Lənkəran', 'Mingəçevir', 'Şamaxı', 'Quba', 'Qəbələ', 'Naxçıvan']
    },
    ar: {
      adlar: ['Ahmad', 'Omar', 'Khalid', 'Youssef', 'Karim', 'Tariq', 'Sami', 'Faisal', 'Hassan', 'Ziad', 'Fatima', 'Layla', 'Noor',
        'Mariam', 'Sara', 'Huda', 'Rania', 'Amira', 'Dana', 'Lina'],
      soyadlar: ['Haddad', 'Nasser', 'Khoury', 'Saleh', 'Mansour', 'Hamdan', 'Darwish', 'Aziz', 'Qasim', 'Farouk', 'Habib', 'Najjar',
        'Shami', 'Masri', 'Rashed', 'Hijazi', 'Odeh', 'Barakat', 'Sabbagh', 'Zayed'],
      sehirler: ['Doha', 'Dubai', 'Amman', 'Kuwait', 'Riyadh', 'Jeddah', 'Cairo', 'Alexandria', 'Beirut', 'Muscat', 'Manama',
        'Casablanca', 'Tunis', 'Algiers']
    }
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
    'Onu bilmiyorum ama [başka bir şey sorarsan yardım ederim|biri cevaplar elbet]',
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
    'Kimse cevap vermemiş, ben vereyim: {meslek} lazım, {tutar}',
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
    'Birlikte büyüyeceğiz, [işçi olmadan patron olmaz|herkesin emeği değerli]'
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
    '@{kisi} özelden yazdım sana',
    '{kisi} sende de mi? [Bende de aynı|Ben de şaşırdım]',
    '{kisi} geçen gün bunu konuşmuştuk',
    'Hahaha {kisi} [çok iyi|güldürdün]',
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
    return duzelt(t.replace(/\s+,/g, ',').replace(/,\s*([.!?])/g, '$1'));
  }

  var SELAMLASMA = /^(selam|merhaba|günaydın|hoş|iyi |hayırlı|tebrik|teşekkür|rica|sağ ol|görüşürüz|bay|aleyküm|oo|ooo|hey|haha|hehe|ah|bak|valla|ya |hocam|kanka|abi)/i;
  function samimilestir(t, st, rng, korunan) {
    t = degistir(t, 'teşekkür ederim', 'sağ ol', rng, 0.5);
    t = degistir(t, 'merhaba', 'selam', rng, 0.4);
    var p = (0.4 - st.resmi) * 1.1;
    if (sans(rng, p) && !SELAMLASMA.test(t) && !/^[@\d]/.test(t)) {
      var dolgu = st.nese < -0.3 ? ['of', 'ya', 'valla'] : ['ya', 'valla', 'hocam', 'bak', 'kanka', 'abi', 'yaa'];
      var ilk = (t.match(/^[\p{L}\p{N}']+/u) || [''])[0];
      t = sec(rng, dolgu) + ' ' + (korunuyor(ilk, korunan || []) ? t : ilkKucuk(t));
    }
    if (sans(rng, p * 0.6) && !/[?]$/.test(t) && !/ (ya|valla)[.!]?$/.test(t)) {
      t = t.replace(/[.!]*$/, '') + ' ' + sec(rng, ['ya', 'valla', 'ya']);
    }
    return t;
  }

  var KISA = [
    ['teşekkür ederim', 'tşk ederim'], ['teşekkürler', 'tşk'], ['selam', 'slm'], ['merhaba', 'mrb'], ['tamamdır', 'tmmdır'],
    ['tamam', 'tmm'], ['kanka', 'knk'], ['hocam', 'hcm'], ['ne haber', 'nbr'], ['nasılsın', 'nslsn'], ['bir şey', 'bişey'],
    ['bir', 'bi'], ['ne yapıyorsun', 'napıyorsun'], ['eyvallah', 'eyw'], ['inşallah', 'inş'], ['kendine iyi bak', 'kib'],
    ['değil mi', 'di mi'], ['öyle', 'öle'], ['böyle', 'böle'], ['görüşürüz', 'görüşürüz'], ['lütfen', 'lütfen'], ['şey', 'şey']
  ];
  function kisalt(t, k, rng) {
    var p = k * 0.75;
    KISA.forEach(function (d) { if (d[0] !== d[1]) t = degistir(t, kacis(d[0]), d[1], rng, p); });
    t = t.replace(/(\p{L}{2,}[ıiuü])yorum(?=[^\p{L}]|$)/gu, function (x, g) { return sans(rng, p * 0.7) ? g + 'yom' : x; });
    t = t.replace(/(\p{L}{2,}[ıiuü])yorsun(?=[^\p{L}]|$)/gu, function (x, g) { return sans(rng, p * 0.5) ? g + 'yon' : x; });
    return t;
  }

  function noktalama(t, st, rng) {
    if (st.resmi >= 0.6) {
      if (!/[.!?…)]$/.test(t)) t += '.';
    } else if (st.resmi < 0.4) {
      if (sans(rng, 0.7 - st.resmi)) t = t.replace(/\.$/, '');
      if (sans(rng, 0.25)) t = t.replace(/\. (?=\p{L})/gu, function () { return sans(rng, 0.5) ? ', ' : ' '; });
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
    if (!sans(rng, Math.min(0.12, h * 0.35))) return t;
    var parcalar = t.split(' '), adaylar = [];
    for (var i = 0; i < parcalar.length; i++) { var m = parcalar[i].match(/^(\p{Ll}+)([^\p{L}]*)$/u); if (m && m[1].length >= 5 && !korunuyor(m[1], korunan)) adaylar.push(i); }
    if (!adaylar.length) return t;
    var k = adaylar[Math.floor(rs(rng) * adaylar.length)], m2 = parcalar[k].match(/^(\p{Ll}+)([^\p{L}]*)$/u), g = m2[1], tur = rs(rng), poz = 1 + Math.floor(rs(rng) * (g.length - 2));
    if (tur < 0.4) { var komsu = KOMSU[g.charAt(poz)]; if (komsu) g = g.slice(0, poz) + komsu.charAt(Math.floor(rs(rng) * komsu.length)) + g.slice(poz + 1); }
    else if (tur < 0.75) g = g.slice(0, poz) + g.slice(poz + 1);
    else if (tur < 0.85) g = g.slice(0, poz) + g.charAt(poz) + g.slice(poz);
    else g = g.slice(0, poz) + g.charAt(poz + 1) + g.charAt(poz) + g.slice(poz + 2);
    parcalar[k] = g + m2[2];
    return parcalar.join(' ');
  }

  function emojiEkle(t, st, rng, duygu) {
    // Emoji ölçülü: mesajların aşağı yukarı beşte biri; iş konuşmasında ve resmi kişide daha da az
    var p = st.emoji * 0.32;
    if (st.resmi > 0.6) p *= 0.4;
    if (duygu === 'is' || duygu === 'notr') p *= 0.5;
    if (!sans(rng, p)) return t;
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
