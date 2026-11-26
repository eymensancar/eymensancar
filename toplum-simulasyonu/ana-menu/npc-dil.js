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
    ['hal_hatir', 3.2, '\\b(ben de|bende|ben|ben de cok) (iyiyim|iyi|idare ediyor|fena degil|iyi sayilir)\\b|^(iyiyim|iyidir|idare|eh iste|fena degil)\\b'],
    ['iltifat', 3.2, '\\b(guzel|hos|cok guzel|ne guzel) (isim|ad|adin|ismin)\\b|\\b(ismin|adin) (cok )?(guzel|hos)\\w*'],
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
  var NIYET_MODEL = /*MODEL-BASLA*/{"tur":"lr","b":15,"c":["selam","hal_hatir","tesekkur","veda","tebrik","ozur","evet","hayir","is_ariyorum","eleman_ariyorum","maas_sorusu","meslek_tavsiyesi","kurs_sorusu","mulk_satiyorum","mulk_ariyorum","fiyat_sorusu","ekonomi","kredi_sorusu","bayram","dert","kisisel_meslek","kisisel_yer","kisisel_ad","bot_musun","iltifat","hakaret","saka","yardim","zam_istegi","yetki_istegi","teklif","oneri_kabul","genel"],"q":0.0178429,"w0":[5,-18,-15,22,0,-3,11,15,-59,-28,-54,-13,-42,-15,-39,-7,36,-29,-22,86,5,-17,-14,-16,10,54,53,5,-34,12,12,-30,128],"k":{"lambda":0.35,"beta":1,"g":0.5,"T":null},"d":"2:8jr9h6hgyjl0;2:4j96hc8iu9iugikrh0ukgvgp;3:4lumhaogu;3:2kf6he7ha8gs9jdag8bimckfejffj1hk2jgrkhalhbmk9nh9pglqgxrj8sh6vhawg8;1:1iw2iz5he6hd7h88ju9hbaimchcehcfh1ggmjjukj6lhdnh0oj5pjirh7sivwgp;1:1j23jt4hf5k16hd7gt8hf9h9aj8bhhcgyhk1jhgkhelhgmhcnhbphaqm9rk0thgwha;2:njf;1:8il;2:3ky5izehfgjouh8;1:tis;2:7hg8h2agceh8fg9gmihmdjfrlh3qpbwh9;1:2ll3jo4he6ha8gtakqbh0chhgh8hhejgjkk5mgoohdqh0rgztmrwiz;1:qiz;1:3hgsipvje;2:6jmvh0;1:2iv4j2dk7ehfrhb;1:7gc8fdbgach9gimkjzrlkumjwkf;1:ch2hhboh9pkbqjqriytjo;2:8h09j2ehbml2tizwh0;2:qik;1:mj2qjg;2:pmgsil;2:aj2fiq;2:kh9pk9;3:2gu3h14h87hd8j59iwajibj2eh7fgughajh7kgylh8mhannuoj8pjqrgxthauh8wiq;2:bjljgfkh3rousikuhewir;2:rjowhc;1:ljj;1:5jn6ik7h79h9dinghfhh8jnlohfqm7vhawev;1:cgyjji;9:0h21jl8hg9in;2:jhfqj3;1:wkw;2:7hgaiuhgvjjirjisltugq;2:wis;2:7g8gj9jke;2:5itbgxcjxfmagiwqhauh5;1:4j3;1:uiy;3:2gb3hf6o18ka9hgaixdixfimhlujh8phhqh9rgtughveqwhb;5:0hb3jy5hd7g4agubhgdijeh9gimhhfjlsohcpj4qixvh3wk2;3:jir;1:bip;2:7il;1:9jdajuciwkjvnhfrh8;4:ejl;1:gl2;2:dgwekzgh1rjstkywhb;4:2jk3hf4l0ij1ogx;1:ciumjm;1:uitvjb;1:qja;1:9iz;1:1itiikkiy;1:0hfdh9ek1;1:1jirhbuip;3:biw;1:8hcajmejkfhf;4:8iq;5:rjcvhdwiy;1:hix;1:dgfejugj8kin;3:njh;1:1j9rhd;4:3imcizfja;1:aisbh5mjhskqwh0;1:ohhqkiwhg;2:5ik8hhbh5cj6djaehghhajgdok0phcro9wgp;2:8iq;2:3jghis;1:mkcwim;1:8ijqim;3:lin;1:1ik7klagzdjvegjfgxgkaiiwwgx;2:gjg;1:ghbsiq;1:2j5aildjfehbnjmoivwhe;1:3jd6jkqhetinwh2;1:pje;4:dgueje;1:0iu1hh2h23h79gxah7bh6cj9diyeimfh7gh5hgcjilkk8nheqh8riwtlkukpvhgwh5;1:1jn2k24j77h38ix9hgah8bh9ch4dh5eh9fhgglajgqkh1ljmmhdphhqhfrj0sj0ujlvinwfx;1:3gs4ij7h2ahbbghcgkfgzgh1hgsih9jg2kkwll8njgooqpknqfxrglthgujuwf4;1:aj3;2:1ki2jv4iv7h09hfbgqcgldgygkpjfskh0lj4mh8nhaphcqinrklsiotjbwfj;1:9ikwkx;1:6lc7hd8imjh9uh6vjv;1:bil;1:aitjix;1:2j46jn8hg9iybiojiksj4wha;1:5ka8jf;1:1hd8il9lbbh4ejkghfhk0jh7lh8qherk7uhhwgu;3:sil;1:1jo4kiahhfk3;1:0ks4ij6gx7gz8in9g2akbbhecj8dgzgkcijmjiqlhbogpph0tjpwg2;3:0gz3jjahdblueh4fjqngdpjjwhb;1:jjk;5:gik;1:chcwky;1:tj9;3:wiz;1:4hc9gdahcbl9cgrfmjgg3hitjiykh7oh0plkqhewh6;2:8iqqjc;1:jke;2:8h8ajcgjf;1:1j0wiv;2:8gs9ipeim;2:8jw9gg;1:9in;2:oim;1:6hechfeiofjfhjtuimvjp;1:9hfagiejghhgjh2mhephfritsp2tjpuha;2:6in;1:bj1;1:6irriw;1:0h51h93hf4hf7g28h9cm0ghfhhbjh9phaqlfrfpshawr1;1:3hf6sm8h2ahddheeh7fhagiujjclh0mhbqh4rjhsh2tjfugvvilwf1;1:gh7ritsipuiv;1:uj4;1:0he1g12h03h77gh8k6ak3bj9ck6dhdeh0fkxghdhipjijkgvlhfnhdoh9qggrkhshhtgrugvwjh;3:1iq;1:chadhfehefkdggpjk2uk7vj4;4:miy;1:0iw1ir8h09h6ah8ggnjj8kh8lhbnirqjyrjhuiqviy;1:8jk;2:0j48js;1:3jw5ip7hg8hebivckgdh3jjeqh1riuth8wiq;2:ih6wkg;2:fjqkk1lgu;1:bij;1:kio;1:6j0biv;1:7j4;1:ejloj4;1:pit;1:6gjuivvjl;4:4jrqiz;1:4kz5jj8k99g0chegj1jkjsgowgg;3:oip;2:2il;1:4ji;2:8ikkj0pizwix;1:6gavgzwli;1:wiw;2:aipjh7sit;1:2j34j57izbiucitjhcwiv;1:9h7jj7kjy;4:8ik;2:1j0rhf;1:3h94l26hd8gsbhfch3fj7ggoih2kh7lhfnhepheqj5tirulvvjn;2:1jeahfqkg;1:fiv;3:4hc6kq8jc9h6dh7jgykjymj8nheph4qgwrgs;4:2ik8is;2:8hgbk3tik;1:8k4qjh;4:4onjhc;1:1na2fx3h44j6firjhelj2mk8nhaogwpjfthguhgwh3;4:bivgkgqk2rhgtimwh6;1:wix;2:4hg8j7bh4lgyokdrjlshbtjw;1:9jbaizhioshewj0;5:ahgcilfg1gn4jg6sks;1:8j09haaitdkbjinqgqrinvh6;2:1iy6k8wgu;2:riy;1:7hbbhecjbeh9fktsk4theuk3wh2;1:3jy5j27hdagadh4eitfgzgjkjh5ljnnm9oisph5rgzugzwgc;2:1h43h05hf6h78hf9h6bgodklejkfkwgisjk6ph6whb;1:gjg;1:8jbqhg;1:9jmaheehgiiojhdrjpuj4wj7;2:8iriin;3:0ip3h37ha9j0bhgcg9djtejagh5jjaliuoiwphfqhfuh1wkl;1:wj1;1:dhbejf;2:9nubg6cgvdgvemhfhehgskheqhcth5uhdwl1;2:8jzbgyjjs;1:8la9gu;1:df2el2;1:aj4ogjpjrrhd;1:jiznjq;2:1khwhc;4:7k5tj3whc;1:hj3jhc;1:7hhjj1kgunl4pktqharj2wgk;2:9jwjh5olvpgzwh7;1:jivnil;7:mhdoh8pm7;1:5k58hachggh8hjaijljgpqk5rk7thdwhc;1:eiw;1:4ixciuwky;1:rip;1:jheniloh6qkqwhe;2:6hechgeiofjbhjuuimvjq;1:6kp7hdjgynhhpk5qmrwg8;1:4lz5hbahd;2:jj7;4:fim;5:9inciudj6rhc;2:jjtrimtixwh0;1:bkkdjawh7;1:0io1h79h0bj9dhbeh9qirrinsjdwh4;2:gk8;1:2l2ok7rhewhg;1:2ji;1:jguqks;1:8isglijhapj5rhduhh;1:1hh3h44jh8j99h8ah7cizdjgfitjjcohfphbrj6sldthfugkwga;1:6he8h6hk6rhfuk8vil;1:6k58jr9gybk3cgy;1:2h37hg8hgagmbh8fgbgp1hmejh0pj0qhdrh4uj7vjcwgx;1:8heekxhh9jivwh8;1:qkf;2:9j0miu;1:ahchiwjkkuiu;2:tik;1:1h82hd4j98hd9irbhechhehhfhfjgemijol4phbqijrhdsk1thcugnwlf;1:0j5fh6ghcjk9kjvlhemhcnhfojfpgqqhfwjy;2:2l9;1:hiq;2:mhfwk0;1:5jljgwwj9;1:8ivqn2wgi;3:8j9diwehdgiujmnphfwgw;1:8gt9kg;1:3hg7hb8h5bhddirehhiinjk3ql5ugtwil;1:ujb;2:9iqaj9;1:0hf3hd7hd8h59joblcck0dkuegsfj0ggjjfakhcmh9nh8ojbphfqinrgpsh9tlduhhvhf;1:3hb7hf8j69k3ajobkkcjeegzfghghekj7nhcphdqj4rh4thdwit;1:gir;1:8hcgkt;3:eix;1:4h6cimfhfkh5ogjqlrrimuhbwiu;2:jglmk8qhcrnavhe;1:aiu;1:ahfbk4uj5;1:8h8al8wha;5:wjq;1:1kw2ik3h54gj6hd7he8isbizfioggmhiqij7mkjnhbpgcqgvrjwtgrugbwhb;1:ejdhheqj0;2:djzehfjh7;1:9haekxfj4;2:1mk2isgitojapgsrhewjt;1:mik;1:0h93hc6h77j48kraj9elgggmjh1kjelh9mj7ohapivqharhetgluhbwg5;1:biufhhhlrrhb;1:0kx1n48j5bh6fh7gjyjh4kgimhgohgpgyrhbwji;1:cjxfhfnik;3:6ksvfp;1:6h8cjqhkajh4rheuj2vkbwhc;1:7ilqj8;2:ajucj9hgwjlioixsgh;1:1h65it8jkeiufh2ghbjjmkgrlhbohdpgurirujlvit;1:1j4whc;1:fks;3:2gq3h07ttahehh9jherhgvhbwgq;1:cj8;1:jj5;1:7iqjjy;1:tj1;4:riw;1:8jjehb;1:cix;3:3h75iwajdkh7mmxnh7phfuj5;2:wjx;3:cio;1:bk8;1:8in9itjit;2:nmpph1tjo;1:jj4;1:qiu;1:jiroiypha;2:9il;1:4iutik;2:cjwshf;1:3jnwha;1:jj0oir;2:gh0jl6pl6wha;2:bjn;2:dhdejsrhf;1:giz;1:ik9;1:4l5;1:7ik;1:0ip2jm;2:8jc9gqclwrgc;3:hjq;1:1hg3jv8jf9h9jioohgpjpqkesjsthfwh5;1:8gmujw;1:ajr;1:ghghjgpiotj5;1:wj8;2:aiq;3:dhgeix;1:0hd4ha7h79h4bjidileh3fiygguhitkjylhgmjoph2rl0th1wgy;1:til;3:8ha9juahg;2:5in8is9hfajdrjf;1:4j3diu;1:0ir2in;2:0gy1h16hf7gv8he9jbah3bilch2djwehbhk1ijqjkskgslh1mh2nkkoh4ph4qilrgisizvha;4:aj2mjgnik;1:0jx3he8gvck7ej7gh9hmjjg8rggtk3wgj;1:tkm;2:8gwakyffqgh9uj4vkbwkz;1:2iphjmuim;2:jiu;2:wj2;3:1inlil;2:7hfjh9qkc;1:8h39jk;2:9ivbixkjcnha;2:ch5fk3riv;3:jjfnj9wh7;1:5h4ak4fgygh4sjkujswjw;1:mj9rjg;1:cjxrh2;1:eil;1:8hgahejm5niloiqqgurhbwk9;1:oiw;2:1hc2jy3hg4lr6hf7ha8j8bgjchfdhdej8fgvhh7ikqjh3lh6nheog5qh3uj7wip;3:jhamjawjl;1:iin;2:piv;3:agofkegjowhd;1:5jh6lk8ilwhc;5:8gt9k1jgumikwkg;1:9iw;1:cjcmjqrhesioujbwhf;1:4iqlh8rjksh3tkh;2:fis;1:8ilgl8hguoizqipwiu;1:agofkegjowhd;2:5j7;6:wk0;1:bjftiw;1:8hbajjhj9jghqj4sj8;6:0hg3hb5kq7he8kl9hcagybg8ciwegshgqjn9nj1oh8ph2uivvh8;1:qjl;3:ijk;1:8j7chdjhdlhenfdoh7ppdriusha;1:bjockdrhd;3:8j5;1:0ilghejhdmhboj2qjrtjjwjy;3:9ik;3:uis;1:jh5qkq;1:mh6oj8;1:vjg;1:fir;1:0is8h3bhbckceiujikmh2qiyrk3whe;2:4hg6ha8ip9jeagxkizukovj9;1:6ixtj8;1:3hf8hg9l7agbbhfcj2fishhbjilnjupj0rj2whg;1:5jjbiqch4fl0;2:pgywkn;2:hiwqjlrhg;1:ijcpjk;2:8h7bjtpk7qh8ul9whb;2:cjlrhc;1:rio;1:7ik;1:qjb;1:0j2jj0;2:aituiq;2:fiqnkk;1:3hg8ji9jmaijbjbdiyeh8fjigjlhhbphcqh7rg8th1uipvipwgb;3:3hg7heakubj2ehbfhdghghhbjh2lh0mjgohfqh9sm2ujzwg5;1:5h46h47gn9jrbiochfgh1hh2ih9jkxmguok9pk8qhfrgtuimwgq;1:8ilakbgh1wjb;1:bgxkjltipvit;2:nj9wiy;1:jln;1:0izwjs;2:6in9j3tix;1:khapke;3:ah6ok7;1:8jgoh5pjirh0;2:sip;1:mistjn;2:7h9qhewkv;3:pjb;3:1mk8gj9hbah6bh5rml;2:8jd;2:dil;1:bhgcjajkawh9;1:3hc6k67h88hdajwcj3fguhh8jh3ph1rgssmdvm6wfc;1:tin;1:oimrj2tir;1:4hggjsqix;1:0gv1gr3gj5h26h08hg9kkak3ck1eh1fh7ggfhisihgjgekgalhbmjqoh3pgiqllrl1vjmwis;2:0hf1iw3h57h98jk9k7ajjckydgvegnggwhh4kjxlk4mh5oj9pisrftugmvhewgn;1:uj1;1:dj1eiljhhon5phawhg;1:ij6phcqmiwgm;1:il2kix;2:3kmij5;2:wma;2:9ghdjuelkfj2ghc;1:ch4jj2wiq;3:1h2ilduhg;2:liy;1:2iqkhdnkb;1:qj4;1:8is;1:5h3wjs;2:jh9wjf;1:dheejj;1:bk1gil;1:din;2:8j69h8;1:ailliz;3:qjm;1:4jj;2:8j8;2:8h4almehcghcslq;1:wit;4:0j2;1:pl4wh3;1:wix;1:1j02gp3gw5j16h77gobijchbehbggyhgylg9njsok4pjoqipshetj9vgrwko;3:ahabjo;2:9iljin;1:cikwke;1:0h52k73h94g75k76kw7h38gsagjbhecjtdjifffgl8hiyjh4kgylhenk1ohapgwqgwrjbtheujevfg;2:2kv4jb5h46j58fo9g6aimegygh9jhekivpjvqj3rg3whf;3:rjauis;1:ahephewl5;1:qj1wis;1:8h9tk8;1:fj9;2:aj2;3:wix;2:1iy5h96h88j89izbgvcghdgbejnfjkghhhgoigujimlhfmj9njnohfrissjctgyughviwwjn;3:1mv3hc7jeghehiziimjh8wha;1:7jjajhijirj3uh9;1:tio;1:8iz;1:4ky6j57hf8j79h3ah5hhajkaolfpgoqh5sjxuhgwgl;5:bj6chg;1:0lh4ip9jhehfjhfphaskqwgf;1:8iqhj3;1:8h69k2ap6biwchddhbeh0fhcggwhh6jh5kh3pisrgnskvthdujdwgt;2:wj2;2:3j8;1:0h81he3h16he7ks9jvah6cmieh0fheggwhiokgomheph3qglrkksh7vje;1:ciodhgehcfjk;3:iirpjwuij;4:9irpjpwhb;1:qjf;1:gjkuj0;2:ahhfk5wim;1:nj4;1:8hdeh9ggghhgil8lkhnjqpipqhdtklvitwg6;1:eiq;2:3jnwha;2:tir;1:1j0;1:1k8;1:pjmqh9wis;1:bjfkgdrjm;1:ciq;1:dioeh9ijdjiqkh9pk7qhctj1whf;2:0jf3iojjxojvwhg;1:1jj8km9gkghciiuoio;1:aj3;1:pil;1:1k72ix3hf7gr8h39j8airbgncgzgisijijkqkimmh2ngmpgpqiqrjushfth5uh7wh3;1:6kddhhgjbjhdsj4ujevjfwgr;5:2hg7ipgil;1:ciphkbrfq;1:wj6;1:hgxrjzwkg;3:1je3gt4jv6h77lvahebhbcj4el9gjohhfjj8kguljdmh6nh6ohapgzrg2sglwey;1:jhdwku;1:wl5;1:7h59iqadzekshiojjgqheskf;2:nk4rjd;1:1hg6j17jg8gh9gcdjuemugkrjg2lhemj3qh5tj0vhawh7;1:4ji8gsbhbfhggk8ijikhhlhconcpgtrikwgw;1:3hf8h9bipgjmhjtjgyqlwsgwujywhg;3:njr;1:jikmiz;2:vj0;3:rim;2:7hg8gv9gvbhbdj7ghchh9jgzkgwmp0nhcojwpkpqhdwh1;1:jj6;1:9iq;2:gj6;3:jirrjk;2:8iuaffbgbcv3fghgfrhgqjiqkizliqnhdrhesh3uivwgk;1:5k08h69k8ajbdh5egzfivhirjj1qh2rjcug8;2:1o98h9kg8wh5;1:8gr9jbdp2edzfikgh0ritwha;2:8in;2:bimujb;1:hio;1:3ir;1:rio;1:blpdhaejbgh7;1:3kuhiqqir;1:8inaip;1:aghfkkgisuik;1:3in;1:gixlim;1:3kk6h9vin;1:wje;1:lh8rjc;1:ejf;2:jh9pkgqh9;2:gk6;1:bjy;1:aik;2:fik;1:8h1dj6ehbfl3ghfkk9whc;1:gjl;4:fj0jhdqlwwgj;3:aj0;1:0iq1pg7gnggskhewfw;1:0ln1io2go6h67hf9fwah7dh8eh1jghkjulivmjznjuok4pk0qh6sh1viowfn;2:dhbejf;1:7ijdj5eh2;1:jnbwgz;2:ejqfhd;1:ejehha;1:8khbhggjslivwhg;1:3l0ghgkkbwhd;5:bjc;1:2hg4oj8gu9jdjgeqhd;3:4jd6h49jcehdviv;1:dh3ekuuh7;2:5j1hirjhfwj3;1:giz;1:8hgjja;1:6isgixsj4;1:8ir;3:2ha3jtcik;1:sj6;1:hiq;4:ije;1:cin;1:qip;1:jiu;1:6iucmxfhcgh8hhbqizrh4;2:6jnth7;1:jggoirqkc;1:0kd1hc2he4h97h18gv9iuaivch5fivgnrigvlhenh8ohfthd;1:aj9gir;2:0hg3pp6izigmwgy;3:1jc2h3;1:7jwwhg;1:eiw;2:0hc2j93m24h95jl6hc7jf9izal1cjfdhceh6ihfjg3kh6lfwnhgohdph0qgprjwtgm;2:pip;1:bilfimpirwj4;2:0h41h52ha4nd5gq6gm7j98kj9gkdhbeh8hgyih8jg6kgplgomh6ok4pp0rh7sgqthgug9vm7wf0;3:8jidhceilohf;2:0japiz;1:aj4;1:3h84in8h49itahcbirchgdkyel0fk9gglhimihfkjdmh5nhdpgwrgtshfuiywg8;1:1gh3k88o4bj9dj4ehgjhakgjnj2ohaphguhcwgt;2:pk2;1:4ix9isuj4wip;1:6iv9ikij2;2:mik;2:kj3;3:7ivuiuvjg;1:aithjjjil;1:civfkt;1:1hc3judkdegvfj7khhlh5nknojmphfqhe;1:jiqtij;1:0gw1gs2h84ha6h08km9jlahabindj7ehgigzjj0lh6mgrojvqh5sjmth8uivvh1;1:8iuviy;1:4h56haojxvlc;3:4ipjhemjk;1:jjf;1:hjnjh5rhg;1:bh5ckg;1:giy;2:5ik8kh9jbkhbrhgth2ul6vh9;7:8hh9injhcoirtl6;1:mistjm;1:bj2hj9jjh;1:uir;3:dl4egb;1:djdehghj6sin;1:rj1;4:bix;1:8jp9h6dhggk0hgyjlbqhfsha;1:0ir6ijdh9eh9hikqiwrgwvik;1:4jg8kqjh4qj9rh3;1:wiu;1:2kbcgvjkf;1:1k48gkah9bj6cgkehffhfgj3hj4jh5kh9lhfnhcoksphbqlsrjttjquh2vgpwfl;1:qir;1:1ir;1:8kcahcbjtohc;2:ogupkx;1:6iqwhd;1:5jebjdek0rh3vivwik;1:cilpmb;1:8n89heeh2whg;1:wj7;1:wip;2:3j15ke8hc9ivjio;2:dizriutk2;3:oij;1:1hdchdmjzrjq;1:0iw;3:4n5ih7ph7;3:jj5lherh0wkj;1:jl0niz;1:8is;2:ah5bjm;2:bj5rhh;3:hiktin;1:2ip3jrjfmrj8wm3;1:8ja9haojfpkfwh7;1:6jg;1:jil;1:phfqlswh9;1:ciphhfjimoj3;1:2l17h5;1:1h93hb6h47jo9j0ag0bizdjgjkokjbmh4njgph6rjkuh1vgwwfw;1:chgfgxgl7jl6ogtpglqj3rkiwgf;1:oki;2:nik;1:hiy;1:jiw;4:4j1agahggrmy;3:nju;1:tk7uh5;1:0hb1h03iy8h1aj3bmjcjcfhfghghh8jh5kn0lh8mh9nhcrhg;3:hhapjlrjl;2:6iqul9vh6wk1;1:0j0ahfjiy;4:hjalir;1:1iq3j44iz5ch8gv9iuahbbitchddj6ehahh6ijwjjzkhgmjcpheqgtrh7uiywk8;2:bjljk9rhc;5:1gn3jmahacimfjejh9mnbrfqwk3;1:tk7;1:ahbbj0kj9;1:fiwjipkhcnjpqiv;1:9hgainnjv;2:0iw8izbiu;1:8ik;2:gj8;1:kj6;2:4j4cjufiprh5;1:4inuj2wiu;2:6jo8g8ajejk9oimpgxqh4rinuj6;2:8j4nikrh9tkawhe;1:njr;2:qjc;1:7j0jhfkfwnlkphgtlswh7;1:jitwhg;1:8izwjc;1:tjq;1:4ip9in;1:cjrpjz;1:hgjrjl;1:dhgeimmk4rh9;1:0gu3gz4j16ku9hgjhfmj0thgvkiwh8;1:vik;3:6mu7fybjbwgq;1:ij6lhbnkuuin;1:8iz;1:0jibhchj0il6jh9miquhbwhd;2:8h7iipjjbtlewh0;1:uh9vkg;1:0h01h33h35h16g17ki8h2bgtdh6eh0fgjgjfhirihglh7mh2nhapjnqk1srktglugqvikwgl;1:8kseheujd;2:8jhrj0;1:sjj;1:0h33hb4h86j08io9h8bhfiq9jhcqharjzwgs;1:1j2qkl;1:0ixokm;3:ujfwk3;1:hiowj7;1:wiy;3:5iuahgcirfjk;2:1jo2kqrgzwhf;2:9in;2:8j19ipgj3;1:0ly6gv7h5pfeqh5wmk;1:sip;1:8h79hebgeghdjh5lharozwl3;1:8j49hbaisdiooinwjl;1:bin;1:qit;1:6he8ja9gtbhcrjcvio;2:qj9uiy;2:kh2plz;1:dh1ej9hinrhgwkh;1:hjc;2:6imil2pj4qhgwh7;1:fj9;1:6j2;1:8hdankbhfehchhgjhcmiurhguj3viw;3:8ikjiq;3:2ik;1:6j8jj4whb;1:8ix9ikajbbf8cjmehdfirkkg;1:rj9;4:0jt1gy2hc3ji4h45jv6o27ik8ikakabgvcjldhafh1hh5jfekgolj3mkunheoh1qg4rgdtgeug8vimwgk;1:4iz;3:6m0oh5;2:mj6;1:0il;1:til;1:5jv8j49h6giwjjxqhewh2;1:gj9;1:3ik7h98ik9hhak0bgidhgegxfkrgilhj4jgwlj3mh9ojprgm;1:tk3;1:akb;1:8h8bjkejcfhdgh2jl7lk7qhathdujbwh2;1:imk;1:ake;1:0fsej0ik7kh8lizmjy;1:7gtjkd;1:0gy1jj2hg4h95hb6ha8gr9hgahbbgydh8eg6fjmgh3hh4ihdjoskjilhcmh9niuoh6pk3qkyrhetgzuh3;2:8iuejbqip;2:8h2bj6jkb;2:7hdch2jl6qjowhc;2:nk4;2:sip;3:0in8j99inbh7kj4;3:1k38irbhecjoeirhh1jixqhbrhauhfwji;1:hiqpiw;1:2in5jibimghekixnh4ojcphdqj6ripwh1;1:4jc;1:7j88itjlfmhaqhg;1:bik;1:0ikfh7gk6wh7;1:3h56l17k98h0jh9ogyqh8rhfuixwm5;1:3hg4hg6hf8ke9gjbglchdfohgghhknjgnkh8mhgph1qjorh9th0vis;2:1hhgh8jg6liyofwpk9qgmto4wlm;1:4iwej8hhdpiwwj3;3:1jvfhcgj8;1:0il1jd2ju3js4j85h88ha9hfah1eh5gh5ih6ljjmhbnhgoippiorhb;1:0gr1r3ahhrfowhb;2:8hguiq;1:lim;2:ujw;4:5jtrhf;1:rir;1:8iweikjjk;1:2l54j37j4chhqjhsh0uh3;1:7lpdiweh7jhcqju;2:citjhf;2:aisejs;1:9ijmja;4:3hd7mhahdbimfjnrgkth3wiz;1:4j2ciqhkhjharh8;4:cij;1:6jc;1:8ir9hf;1:0hg1mf3kr8k99gwal2chdfgaggujjzkgslh9nh3ogtph9qh1rggug8wma;1:1ivdhhfjrkhalnaoh8;1:ohhwko;1:1iq6kp8jiah4bhfcitdf9eisfinhgzjlakjpqhfrh3wh5;1:kip;2:3ha7hgagwbficloeh5fgygj2jgkkkvlh5mlxnhgohbph0qgyrkptinuhd;1:7is8kf9ggagmdgaejwghdhj3jllphdqhhsixuhgwhc;1:1jn2iu3h35ja7hf9h7fhchg5jjyljloh9pkyqghrg6shgwg7;1:bk3;3:lip;1:6js;2:3gt4io8jndjphhgij3jh9ljdqj5rgpwgz;1:fhggk5jjtriz;2:8ha9hcbglcgudjaeo8fj6gl9hhdjhbugrwha;1:6h98ilah9kjdwju;2:7m0aj3qhewhf;1:8jh;1:bik;2:chgijdjjergttjl;1:kj7;1:3gz5k26lj7io8g1ahfchfdh8egrfhfijykhamjhnhdojrpgiqgirizthgulxwha;2:mh1nkg;2:akvghd;2:2jq4iyah7bh1jhgkjcsiy;1:djr;2:8ivhisjiy;1:eiwljqtiruizwhe;3:aizgis;1:jil;2:iix;1:fip;1:8ik;1:bj6;2:4hfgjhjk2;1:jkzsjuwhe;1:8gs9k1jgimk7qhcrn8vhe;2:5l37hcahebhbjj8qhesiltj7;1:fke;1:pgywko;1:piz;1:6t58hcdhdeh8jgmmhbsh9tjbuh0viowgn;4:aiydjueh4;1:jiqwio;3:8in;2:ah2fgwgkh;1:8j7gk1jhbpj7rhd;4:ekk;1:pjvtj3;3:wjr;1:oiz;1:8j6;2:8j3;1:0k73h94lz8gw9kbbioeizfilgiwjh1khblhhph0qhfuh4wgv;1:pj9;1:1jswhf;1:cj7ggv;1:8ix;1:3j8ah2ckjjlnoh9qk4rh4wfe;1:giwrj8;1:0ha8kvgjdjhb;1:kh0llsnhe;1:eitrlq;4:6h58hbakydj2eh2fhfhhfmgnpl6qhfuisvkj;1:1gubiqck5pkaqherl8;2:0l21g5nir;3:cj4;2:9jrcgv;1:5je8iu9hdghdjhfohdrjwsjttjhwh7;1:9hcqjo;1:1ingjdsin;3:9j1;2:8glwkq;1:bj3ch2oj5;2:wjm;1:lis;1:6ktwh3;1:9imkjjwji;1:qkmwhc;2:hk7rik;1:tj9;2:rm8;1:0ja1h3uiz;4:iil;2:vj0;4:oj3;4:8h79k4;2:uj4;1:jhfpl7;1:gjg;2:8ga9iwamfbhfdjgegqggmjh8rj9slcuhf;1:8j29ha;1:ojq;2:7lbpirqhg;3:8h29ival7ghawh9;3:0j31iq8h5fhaggokj1lhgnj1qk8viy;1:giu;1:bhfmjb;2:bisgip;1:3he7mfahefjmkk4mgkrglth0wj1;1:6hf7ix8hc9j9jh9phfqn0wgy;2:4hedjgehdhjaojr;2:6jalkpwhg;1:0hf1h83h84ij5he6hc7gt8m69gdak7bg7ch5deqejfgh6hhdjftklhlilmizokgph0qggrj5sh6ukavj0wgf;2:gheqim;1:jin;3:fik;2:jj3lkjnhf;3:8iu;2:7ilahgdj6egvhisjggqjmujj;1:8gzdl9ej9;1:uj3;1:fjb;1:gj4;2:1iodizugxvjr;1:gkf;2:0h44h38j79l5aj6ciodiogh1iizkgnqharjzsk5tgwuh9wgf;1:1h8rku;1:7ir;1:8h0aj0rhbujk;1:3he5jh9ikdgwejzjfswm1;1:mka;2:8jqciufirkhc;5:0f23lo4kd6g6gkwqh8vgvwjw;1:6h48hb9h0diseh4plvujyvir;1:1j9;2:8j7;1:1kbdinjh2kiqrlo;4:1h53j75hb6hh7hf9h7akeckndheflmjgumh1nhgrh2uh3vhfwha;1:gk1khclje;2:rio;1:gk7;1:5fs6gz7kaqlowhc;2:filghg;1:dje;1:8hgcm3rhcwkg;1:1h33he6jc8m29eccgmdhgeinjiukh9mn1qh7rh1uhewjr;2:8j5jhdkgznjm;2:jix;2:jim;1:hg4rk3tip;1:khdrjl;1:3j45hd7gw8iy9llahgbgqcitelmggpjghmjgth8uhbvhbwga;4:kit;1:chejh0ql7;1:4ij8gb9jzahecmxfh2;1:2j2;1:3iv;1:0io1ha3h14h95ik7he8j19hdahbbhadgqfnsgiuhh7jgmkhelhgmjqnhcoh5pfpqkgrgysivtk8;1:7my9kqcgnjj7qh2rhawgj;1:4k3whc;2:2iqhjkjguoiswhf;2:1nd3gt4ka5hf6h67jt9j8ah5ihejghkg8lgtmgvoj5pj7qgyrgbsh9tivuhfvhc;1:3kn8hfdikfjkghenistjqwgv;5:wk4;2:hjf;1:7ik;1:6jtaip;1:5h9jhcwl3;4:0m31ja3ki4hb7hf8imbgmghdihbjhakgtphgqh2wmh;3:8gmvmywgm;1:0h12k43h45hd6gj7h19h9il0kh9lh6mheniooh1ph1qhfrgnslyth9vpcwfc;3:6l9ohdtjr;1:jjmvj0;1:cj3;2:8lirjduhf;2:mjlriv;2:1jq6iskhdlk8qitwhf;5:0h78isilgsj2wgk;1:6juphf;5:5lo8h7gkdjhdwhc;2:jk8phb;3:6h8vix;2:hk9rheuk2;2:pmewgt;1:5ivck5dgmekjfheghajgulh4nh5pm2qk7thdwhe;3:2jl;1:jiy;3:0h43h75jy7h59n2bgqchedm6eh1gkehiqkhdnhhph8qh5rglthb;1:ghbjixoik;1:air;2:0hd1gp3m66h97im9gfaikbk2dhfggzhh7jgnkh5mhfph1qgwrjnumiwir;3:5j4biz;2:ahffj1kh2plywhg;2:8j4;2:liz;1:aja;1:jjwljgpk2;1:4h0ah6fhdnjsolxwji;1:qjz;2:2j78gx9jnaiolinmiroheqgsriyshgwj6;3:2j9bhggjgnj5rivwh5;1:8juajwbkecileh3fhekjhnhergxwh9;1:8ix9h9bjpcj1gkrsixwgu;1:jhdpirqkgwio;1:qio;6:uj9;3:3j2okbrjewhc;1:7izah8dhgrkrsh6;1:ej7;2:7ilbh6kjjwil;1:8h39k8ahbchgfj2hktrkouguvhfwha;1:mjc;1:jir;1:0k93ha4m48gy9kdej0fingiyjh3khcoh3ph7uh5wha;2:6kidinehcwh3;2:fiz;1:8h7piurlawhh;1:8h7aglbgwchfflvghgkjolg8okeph9rln;2:4j3shg;2:pji;2:6iu7h58irbhbch1dileg4jjmohgpheqjzrkhshetj0uhfvhfwj1;1:wjm;2:0jb2hg3h85n76hf7h98ip9ipagzciqehcfgdgkrhjljgckhdnirpheqgsrhguhcwg4;1:1h78jhah8bmmch9egxfiohh7rk0whb;3:6kdwha;1:0gr1ko2hf3h84il6h97hg8hb9j1ahbcgtjk7kl5lh8mh5ph4qh4ujqvjawgx;1:aivcjiggshix;1:2m94h77h78k5aj6bgogh7jgqmizokqphaqh1rhewh1;2:1iw;2:jjc;2:6ixoiyphavhc;1:3hd9gtdkoel4fjrwgw;2:3jh6hh7gt9h2bilghgilvjhckk8og7plpqh5;3:0h53gn4hebhgiq5rirsijwhf;1:tkl;1:0iu;1:8j1hhgrj9;1:1k53hf4ha6k17ha8iqagnbgzckxdewflmglpkiyljpnhcph3qgjrg7ugxwgc;1:0is3h3ik5;2:8ha9iqgimjh1kitqjiuiz;4:4kw6hdjgvoh5ph5qh2rhgtjquhgvjfwky;1:oiq;2:rik;1:1h1dheejwilbuhe;2:eikfj0;1:hixjil;1:filtir;1:tj6;1:8j1;2:0hd1hg3h74j06gr7ix9h5ah9bhbchgdltem9fl0gh0jglphatgzuir;2:dj2nit;1:limrjm;1:9ip;2:2gw3im4jy5jc7jf9hdagkbgjcjpdilehefkogizhh8ijyjgfkh6lhdmhhph7tixuh8wgr;2:oj4pjrwis;2:jir;1:3ip;2:jj8wh5;2:9imhj0nju;1:1km;1:3jehhcjis;1:1kd;2:0h12h93j74hb5h66hc7gx8ls9lgah8bfncjvelyggxhirjgvkh5mhcph7qj1rjivh5wfy;1:liq;1:5of7h38gp9h9bk3ch8dhceirfj3gjbjh2khdph8qj6th4uhbwgu;1:0j3dj2eiskhcliy;2:pj6;1:5jmalichdfh6gh8jgekh7njywjs;3:cikjjqrhf;1:4h9eijij5pjf;1:1g33hg5j26m67iz9hgah8ghdjg3khblj2mhcnj5ph2qharh8theug9vnvwk2;1:1h12h84it5iy6j27j19l6bhgcg3ejdggfhgsigwjgnkhelh9mk2nh4ojtpghtktujuvhdwfj;1:8j8;1:rjl;1:8jk9gy;2:hgzrk0wku;1:qio;1:sip;1:fhdgkc;2:ain;3:9iyeitghesimtivuhd;2:5goagpehfgh1hoijjopheqisthguj7vitwhd;1:fm5phaqiq;1:8iv;2:jj4oh1pjs;1:5iq;1:bja;1:ahhkinsj0;3:ijhlhdwkf;1:8j6;1:9imbk4cgv;3:1jb2k23mg7jp8gz9ioah7ehcgikjjlohdphgqjprgzuhawdw;1:cin;1:2j7bj1ej4rh2;3:1klfiq;1:1kggipjjoqh7;1:oh4qkkwhg;1:gim;2:0iw;1:8fs9lqah5bjcdj3eil;1:3j0ej7rgx;1:0j31il6in8h9bhafhgwj7;2:ajhfl9;1:jjh;2:gh2jjd;1:1gz3h47ma8kskh4likqh3thawis;1:8iohj0limrhdwhf;1:3k37gm8imag0gkghgujllpiqqjbrhesh8wir;1:1gzgk0kirrh8;1:3je5ipaiwsiy;4:vim;1:hgprjg;1:firjh0ql7;1:sim;1:1h3mmurgj;1:6hgbjqrjhvj5whg;1:uk4;2:bjemmjpj2rgxwgr;1:8j4aikbjqdheeipfiwkj2nh0qj2;1:8j39h0aixdhgeiofhaphgwmj;1:cgwjj7;1:siv;1:hhatiw;1:3kdajgdirehfhipijijh4qhbrhduhg;3:1ischgeixfjmhk5ugv;2:kh5ohfpl4;1:0ha1jc2hg4hc5iy6h5al3bfzcjedh1eiujkllhfohdpgurijsh5uh7;1:wk5;2:fjtiinjipuin;1:cjbfhg;1:ah5gikjhbpkasjtwgz;3:6it8eu9m4ahaejlghejijljcristj4ugzvk2wgw;1:bl1dj8khemkuphfwgh;1:0hd1gj2hg3h05hf6h97h88j7alebgxckrdmsegyfgghjajfilh5nhdpgyrlmsh1ug8wir;1:5j19j1;3:1ki3ji4h76h6jh4lj9ohbpkdqh8wja;1:pjb;1:rj5;1:wj0;1:hjzrg4;2:8hgeji;1:2k23k45hd6in8hbah2ehaghfih8jhcmhdnh5oivpizwip;1:sjj;1:1h13jwaj7ggz;2:7jqjh8lj6ogzrh2wkj;2:1lr7jwahgjfxqm7rgnwjb;1:4jl9j0afubk2ck0;3:pirris;3:4oc6hbgioijqjhcph4qh5wh0;3:hk1jh0rfzth9umpvil;1:0hg1gm3h34j45hf7haaftbgfejjfgcgmphjwlh9nh7ogopj0qgorjasmfuilvgwwgp;1:0gx3jr8j1jj5qh1;1:0h92kc3j67lydirjhdqhgrha;2:7jalir;1:6ip8ipdhdekgjh7ojcqhfuj4vh3;1:3ip;1:4ke5is8h6ekijlsphgqh8rghthfwgp;1:8l4ajfbhefg8kio;1:0lk1lk4jb8j4fh8ggxhj0jhgkharhcuhfwgo;1:jkrsjb;2:5ixwjb;1:8hgrlb;1:wjq;1:jkc;1:fjklh6nikrk4;1:1gm4h29j4cgodgtejyfh2gh9hktiixjh4kh4ljumhfngyoj8pizrimtj9uiqwiu;1:gjljh8rhhtj2;1:3npcioffvhja;1:3hd6jy7hdalsbhacitgk5hlqjfulhemjqogvph3qh5rg6sh8thfugyvhgwjf;1:0hd1gj2h43gv7j38hd9kwbk0cgxdkmeizfioggoihdjiwkg6likmh4nhaohcphdrglsjktjsujfvgkwhb;2:hiq;1:8g39kl;2:jir;1:rjn;1:bjf;1:1hemkr;1:8ix;3:8j4;2:rip;2:0hc1hd3he4hd6hg7j68gm9gobh8chhdsjel1fikggmkj2lhemhaph7qh5th2uh6wgk;2:3jf8mi9gaaimbgfcindjuehfhhfmhdqk3rh2th4uhc;2:vj1;1:0hf1h92ly4hc7ip9hdagtdivgkthfzjjrnhfoguqh5rl4tj1wg5;1:uim;1:ehafh6gn1hjcuh9;2:disehcgju;1:9imwj2;2:8imjk3sgw;1:iiv;1:fipjk7oh4;1:8j29jaehe;3:0io3iq5io8il9hdbhdfj8gh9jh9kheuilwha;2:sis;3:4hg7majh2ph0qh8tjuuhgwll;1:7jmhikpja;2:9j1wik;1:kjh;1:8jz9h2chb;1:5ip;1:fiz;2:0ip1hh3ivaikfh6kk2;1:1ja2iv3ke5jm6h67h38h29grahebhddh4fjrggshiliiqjjrkiplhamh9ninpgbqjnuguvhbwhf;1:7jr8ixhhdwjo;2:biy;4:1hbqkguiqwhe;2:9j4bjgegssin;1:cgtjlqnjmwh7;2:8im;2:6im8iq;1:jilqix;1:hh6riw;1:3j3bitkhcwhg;3:8j1ej5rjq;2:0iu;1:6nwjh6ohdphbqharhdukpvkjwgi;1:8h79mwbgoch4fgygikhh1jgpkhalh2pj7qharprsj5thdwgv;2:8jj;1:aio;1:4jgoj4;2:6pf8ik9f8ejyuh6vfywgu;3:ah8fgykjkokc;3:pjz;1:aiy;3:djjeh5fjcujt;2:biyjjerhd;1:9j5;2:8ik;1:ditrhf;1:3ip;2:eilfj7hkcugw;2:pk6;1:2ik;5:hj9;2:divehe;1:air;2:2j03hd;2:0kd;1:5iw;3:eipfh1gjdjj0qlhwgu;1:3h84h95hg6rt8h49hgbincixdhceh4ghfjg5mhbojjqh5rhash9tj4ugxvilwix;7:1itaheeh3fhgsjvukovim;2:kiruj6;2:givqliwhd;1:wjo;1:0ki6hc;3:7io;1:bk6jguqjmrh2;1:1h13ikalnfh7ghdhkkqh5wgr;1:1in2p64gw6he7lgajhbkkcg9ggqhh1jgvkhdlheogkpgwqgarkuwfo;2:4kz5j0ph1wh3;2:aj2;2:jj0kis;1:0ha1gr2hh3jm5hg6h88jq9meajnbkddh2egwgglhgwihdjgjkiulhcmhapgurivsh8uk4wh0;1:sjf;2:ngdpjp;1:pk5qiywhe;2:pip;1:8jtahhujf;3:8hdbkbdh7fleghclhcngwrilshctkq;1:4lo8kwpilrhdwhe;2:8is;1:0jj;1:8ivaitojo;1:3itolapfvwj4;1:jnzqgtwh9;1:5jxpjr;2:8j99k5ak4bkecjfegzfgijhekj7nhfrh7thfwhe;4:fh8hilkikmheuli;2:5j48iplkf;3:mjlsil;2:2lfjha;3:ijjrj3;1:tix;2:kj1;2:wj7;1:8inchekg5lmerh6vka;2:riq;1:rik;1:7izcipwhc;1:kjclhbnhcpk2;1:rjowhc;1:3jb;1:ajjfhbjim;1:tke;1:8ga9kpajncjmpjkthg;1:likplrqhgwhb;2:0m26hb;1:dlwegqfhf;3:8hf9jxlimnjxrgj;2:bjkcj8rhc;2:2hg3h97iz8ji9fkaiqbhacgzdj6eiwfiygephkejl4kh3nhfoh6pgnqmfrgttheugx;1:nin;2:rjcwiq;1:lit;1:fim;1:7jh8he9ja;1:aijfgegjajki;1:1kp6hd9h5dj1jhcqhgwla;1:qkmsgu;1:6iw;1:qj5;2:3ik;1:8jk9hbghgujp;1:0jfvj9;1:1in7ja;1:ojmuix;2:6h7viv;1:cjwfjq;1:8iy;1:qj1;1:rip;1:chdfjcijxpinrh9tix;1:3m7;2:hkarhe;3:6hfakifhcjh6kgwmjnpherklsmhuh9wgb;1:ghaqj6;1:5jv8iz9hbjheohdrjvsk0tjfwh6;1:eiwgip;1:1kj2jx7msdisegwhhejhaohbqhgvjjwgw;3:hiv;1:0hg1ju2hf3h67h08ip9giajmbljdgffjggh3hgqjgjkkqlm3mhdoinqgnrh8th0uhbvhcwgk;5:8hh9imaghdjjfjdsiq;2:jk3;1:vil;1:ailcj0;1:1ja8gwdheeixgh0hgkriptmkuiw;1:0h93he4hf5ik9h8agfdgyeitfjtpheqh7tknwls;1:1h97h8ahabl7cj6fh1gjxhitjgfkh3lh7mlbnk6pixqhergzthcuh8wha;2:5ikeisqjj;1:8is9gyegjih5jh8mkoqjkrk7sizwj6;3:9ip;1:aj5fispil;1:8iwhjtrhatha;1:9ghak3;1:1h93h19gubjcckedhgfgdhjzjipkkfmisohbph0qimrlfshguh3vhewfh;2:2l73h94in8h2aisfgzij8jjckirnj2qhgrhawhf;1:7ipjhdqjt;1:9in;1:4ir8ivpl9wiy;3:0kjklilhdohd;1:ggghk8;1:8jdch7;1:fimoix;1:bk0dhceg5fjoghfij5jherjwsj8;1:8izvj0;3:0k39k9egx;1:3in;1:5jvhiu;1:hjdjh3;1:1l7;1:0ij;1:dj5uj7vis;1:1js7jbcip;1:sj8;1:bio;1:aiu;1:ciljiw;1:4iq8h7jjvrim;3:uiw;1:mjg;2:eiv;3:eik;1:jl2qhdthg;3:8j1;1:fjaghe;3:1h98h1bl4gj9jh9khelj0qiqrjywji;3:dhbeiq;1:ej9jj2qh0vha;2:0mr1j93h24gs8hh9j7bhdckuih8jfykj7lhepgvrikwgv;2:jjkqhftjdwjt;1:9jwdh6uhavjd;1:njq;3:8h3jjpujewjs;1:6kt8jjah4ciudf9eitfirjiskjqwhb;1:1h33jr;1:jiowj9;3:3ix;5:9hajiu;2:8hf9iw;2:9in;2:1he4h66iq7h39gqah4bh9ch9dgdfm7gisih1jkrohcpgxqkorjfthgvkswgf;1:0jc;1:2j43h54kiuhd;1:9iuahdbkl;1:6k4viywit;3:fkkrji;3:8h49j9cip;2:1gsahebj1gimhhcrlw;2:cj9pix;2:jja;1:hj1nk5rh0;2:gimnitqfzwle;1:tjuwh2;3:ajdcgu;2:8kz9g7bhgch7einfl9hiq;1:cik;2:2ji;1:8jd9h8;6:3iz7im9j2agxdinegxfjyjjtlhgmh9oh2pleqhewgk;1:rjk;1:0h03gr4h96h87gz9hfag8bivcirdm6ejwfg5gfshk8jiskgtmk8ng1ogwphcqgmrl3slhtjjuh0vgn;1:fj1;3:tjh;1:8j29ha;1:9im;1:oh2pku;1:dhceiv;1:ahafjyrjh;1:ej5kk0lgz;1:til;1:1gbah9bitginhk9rm2whg;1:4l45ir8k09gswha;2:4irahcrjkwhb;2:0k01g75hg7h88dr9jxagsbludikek4fhfgjljgzkgvljemh6nhfoispgvqgcrkhshatisujnvinwfe;2:dioehejj5rim;1:tjo;1:1j5gikkjplio;1:ij2;2:nj9tim;1:jilqj8;1:6j57hh8h6aglckaiiljh9khenj6qjgriltheuj4;1:firij5;6:8ju9h6jhgoix;3:tj1;1:bj3;1:ojxpharj8;1:ij2;2:8juahhujg;1:8injl0oitwfr;1:vil;8:rkawhd;1:2j63ha;2:8is;2:cilij1;1:8jk;1:vim;1:8hc9jvahe;1:8ilcgkjjjojgqhbrjrskcwh2;2:2iy7jfajbjjqsh0;1:7ipjheqju;1:fivrjp;1:lkc;2:wit;2:3h85k16nm7jm9hdah6biofhdjf9lhanjdohepgrqh4shgtheugovpiwfz;4:0oi6gv7hh8izphdqhdwhb;1:8jv9h4chb;1:ginohgqj0;1:bj4ek1jh2qhgrh7tjewjk;5:eitsip;2:rik;3:2he4lg8gx9j7ah3gjphj0jgwqhasj3uhg;3:jgpqj4rhhwl8;1:qj9;2:kjn;1:ej0;1:4jhjj3ojgphc;1:piw;1:7ik;1:1iz;2:1gz3gg4g85h87g79gxahabh0dhefh6irqjkilhcmhfnjdoh8pj4wfk;1:6mw7fywgv;3:oiuwj3;2:4hg6ks9jbgitjhdnk8ph5qh3sirtjv;3:ij0;3:hh6rj7;1:0jw6j9dgvej7jgkminohgph7qhgvkwwix;1:jjbplnwh8;2:pj4;1:4jr8h8bjwjheqiprh2;1:jhgtko;1:aj1qioshh;4:qil;1:ohcqj9;1:4ip9itfirjjc;1:dgthjp;2:ois;2:8iq9l4dhatit;2:nj6riu;1:7ipjiuwir;1:hj9jkvoh9;2:5j6;1:bgyeiukjjrixwhh;1:1jr2j36go7h68h2agtbfwchhdg8eh5fj3hhdihgkkrmiuokyqh2rg8tgzukjvku;3:6k88iwrhb;3:qj8;1:0h83hg4jt6hfahhehcfivgj2jj0oleph9qh4rgquh5wkk;1:8hbsjr;1:1hc3hg4hc5in7iw8in9gmakreh3fgwjmmmhfnh0ph6qlmrh5sh6thgvh8;4:6lhqhcshdvgwwjl;1:aka;1:jh5qkq;1:8kw9h1bhdejghj4;1:3jc8im9h0riq;1:6he7hdpglqntwgd;1:aiukik;4:giqwiu;1:8h89h7bkneixjgiqinwkt;1:ij9;1:5j88j09gijgimgynkowjy;1:ehgtk1;1:0jughdjhbmhboj0phgqjjtjiwjt;1:sjw;3:2ji6j1;1:3h28iyagqbhack1eggfhfgjmhhajjwph4sh9thgugpvj7wmn;2:0ha1h74hg6ha8ix9j5ggghimihdjj4kgilhemh6nilripsj1thauk9wiw;3:3h44hf8h99gwajabhhcj3fh1glwhkjkhaoizphgqkvrh4sgpthgwgz;3:fiv;1:lji;3:7iveh9jjrqiqrh8wgq;1:khfmj4;4:ajh;1:jj0;1:1hg3hf6kz8kt9jkajfbkgdktejhfftggqjgskh4mhdph8qh4th8vjkwg7;1:kjl;5:dit;1:jhgkhelilmm3phb;2:ais;1:1lj2ftjhfogvqkz;3:8hgakafhhghesk4tk8whd;3:kjc;1:1h53hd9h0akudhcehffh5go6hgdih1jl4lhgrh3theuhcwkl;3:2iyniurhgwhd;1:4ixnjjoinrh6;1:8ky;4:8jo9il;1:jkzqjjwh0;1:wjm;1:djzeg6;2:1h0dheejvilapjguhewh4;1:pj3;2:2ji7hf8gt9inchdgn3whh;1:1h22hb3io4h75ji6h88h99ggaitchcdgyflygj4hirijjjiskgilh8mh1nhdoh1pgfqkstktviwwe8;2:8j7;1:uiu;1:6h78h2ghcjh8khdlkunkioj9phhqhdrisuhbvntwgm;2:1itbjd;2:8gqbj3chefjpggoilmjk6lhcwh3;1:1ji;1:8ijaip;1:1hd2hc4hh6hh7h68iu9k1ajidk8jhcnh8qh2ujwwh6;2:8ix;1:wkr;1:8ik;1:8h4wky;1:ailbipiltwh9;1:1hf3hc4hb7h89gvbnjcjtggpjh0kjklmbogrph0qgvrjgth8uhd;1:wiv;2:fj2hixjjxqhbrhfsj3whd;2:8in;1:kkb;1:4j08h4kj3;4:fhfgppihcjgmwh4;1:jjkqir;1:ojo;3:jhfnkxrkowh6;2:ahbfjv;1:3h45k46h27hg8j89iwaggbj2chcghgmipnh9omkph0rjatgxwik;1:4ivaitfgngheoh1ppowh7;1:nio;1:tiz;2:uj5;1:0iv1ip3iq8h9ailbgyfh1hldkh1lizrh5th8;1:5k6;1:2h53jm6gd7mjphdwh7;1:7hhjnhkipph9wgb;1:0j73hcwiu;1:chcwiw;3:rhhuinwjm;2:tkg;2:rjowhc;2:8ka9hfditohepjg;2:wis;3:1hf3hh7go8he9haah6bhfghghk0jggkgpnu6pmeqh9rgntheuhcwfh;2:8ik9kvagweh4fh7gjykhdljaqjrrh3uitwhg;1:8kfbk5dgxehcggziiuwjj;1:djoehe;1:rftwli;2:2iy3ha4h66h37gzdh7ejdggxhjcjgukislgxmkxogqrjrtjgwgs;1:ej8;1:8h19jejllrilwhf;2:1hg3hf7gu9juam4birehefgagh4hh4jj4khdphgqj0rj1sj9th9ukowgq;1:1hg3hc4m06ja7hg8h8cj7egwfhdglkih1jhekh4lhemhcohcph9qgrrkatk8uh5vilwgh;1:0khqhg;1:7in8hc9iy;1:9h2bjnggdjjgqjirhd;1:1h02j34h57j19ijakbbjichbdioggijitkj4lhgnh0oh8phbqh1rjhth6uh9vixwgv;1:hg9rjjtjt;2:eg4fkbhik;1:ciy;2:hhgrjb;3:8h99gtbkhch0fligglhimkikqk7wh0;1:bipjk1uin;2:0he1hg3gq6hf7h89gvajebgtck3fgwgj8hj6igdjllkhgljznh1ohepkzqguujmvh2;6:ag6bjzrkytl5wha;1:aiz;2:0ir;1:tjl;1:9k1eh3jgqkmlqjv;2:ckqpjargx;3:9iy;1:hik;1:uj3wk2;1:1he9j1chahimjj1rju;1:pk5;4:4ju8ga9fucjfdj1ej6fjhghekhaojppgyrg5toauh4wh2;1:dik;1:9iyhik;1:9irsin;1:4j5;1:8ilqj2;2:fhfkinuji;3:sjg;2:hh1jhhqirrk2;1:8h59j3ehggitjhbqk8wiq;1:oiu;1:0hg8ivbkajjnrgzwhd;3:wit;2:0hg2k73gz4hg6hf7h78h5agrbj6cjjdk8ejofjkghfhh3kgqlh9og1pl4qh6rjfsh9tipuhfvhb;1:ah9fjpjizujt;1:3jj;2:4jacizehafj8tjh;1:gjgtip;1:5heagobhfdhbejnfj6gguhh4jhashcunivjmwhg;1:jjrpj8wgz;2:8h19hbah1bj2cq7fh1hgljisrh4wka;1:flopik;1:8j29h8giq;1:3hejj6vje;1:6kjphd;2:2lfjha;2:6havix;1:4jhrj0;3:8hc9jl;1:1h33hd6hg8h09gpaj7bh7chbdmgegdfgpgj3hgvjggkislh5nisojmpgnrjmtkcvhgwik;1:3jw;1:6jbnilvh2;1:gljrikwh9;1:civjjo;2:9hfgjbkhennzpinwhe;1:2k46jlwhg;2:3j2miv;1:4izajf;1:8knbgx;3:mklwhf;1:1ha9ioch3dipfinhiljgqkk0mhfrjxtisuhfviswhh;2:8ilajdcjcdgkeklfgrhj8ij7jh5qj5rgush8uhd;3:vj1;1:akbkh6;2:1h2ijotlkwhd;1:4hcbimgjjhjzphhrgzwja;1:8im;1:9iyhhe;1:jhfsjc;1:4ircimjjr;1:1jb5lejhbrh0;2:8hf9jgwk6;1:8jv9h7ail;1:4n06kjih5pgoqh6whf;2:bhgkjg;1:1li2h93go4h05gx6gz7gu8gp9ffalebkkcjudgkeg9fl3giqhjujg9kl6lh2mkrngxogoqg8rkhshctgvugzvh0;1:8mv9jkbgndgwejhhjeqjarjeugvwh6;1:1ix2ik4iv6h17h0ahebgrghdihgjglkkqljymiyol1pinqgqrgeuilwg2;5:hil;1:1h53gx6ir9irapnch8eh7fg2gg3hhgjimmh8nhcph1qh9smstgzujfvixwfl;2:0iq6j6aincinhipvgx;1:2gv5j98dd9ojahasisvkb;2:bhdhj4kj7mirqj2rfqwmf;1:ggqsjd;1:aji;1:4j28j79j0cguem3gh6jhhrhg;1:1j7rhd;1:dnzedo;1:eiyhjw;2:ajh;1:likwip;3:cfwtko;2:5kchiqjhfkjd;1:1kbphd;1:1h82ha3jb4h06h87jb8h29juah7bh8cmpdhcehcfiuggxhiqjh9khgmhfph2rfgtj1uhcviswlq;4:pk8;3:vjrwim;1:2iv8hb9iy;1:3o26hc9heehgrgtthgugivjfwlm;3:0mk1h63gn4gxaggeiqfhegk3il4jgyninpinqhbsj2wgo;1:qis;1:jja;1:8j79h8;1:1h76in8g79iwah7bh4co1fglijqjjhkgtnhaohcph3rmathcuhewh4;2:2l03h15hc6he7h88gyahdbhddfzekcgh2ijjjgflhhmq5ng2oh0qh1rgyshftlmuh6vhf;1:birijepjfuiwwha;2:lj3;1:qiwwim;1:0jkklllhdohd;3:pjm;1:0h11h42hh3lh4h95hb6h47h88fq9fzanpbgvcindg7egcfrkgixhkgkkqlhemhfoh3pgsqg5rg7sh7tgtvh3wgw;1:0j1ajqdh2eipfgygiomj8qjkrhdwh9;1:jiv;3:8iwbhghivjhdll5nhfuiowjn;2:6lkgj6wgk;3:3j28hejgnwlg;1:vjj;5:5qmjgjwh8;2:dj3piy;1:qk8;1:0k31hehit;2:1ja8hggg6jiynhcpk2rj5tit;1:3hg4j18hg9l2agcbhfcj1firhhcnjtokaph5rj3whc;1:1nr2hg3hf8h39gpahgcjfdg9fhahjvkhfmjjohgqh8rmwuh0vha;3:1im4io6hfdiokjxvjx;1:ojd;1:8hcgk4;1:0hf1ji5hb7ip8fz9geah0bhgdjzelwfh5gjsjimkgullrnh4ok2pgaqh6uj2vgzwfy;3:8inwiz;3:2ik3jr9izjn8phdrhbwgd;1:3h75is6hb7jx8j39hbfiuoj6ph9qgzthgwm5;1:1lo4j4bh7gg8jjwkheqhdrl5wh4;2:pk3;1:ajr;2:qk8whe;3:4hc6hd8gzdh6eh5fikghchhdjhfqhcupovkw;1:air;1:0k43hd8jo9hgbhcdliegqfh6gh7jgnlgyphcrjdsjruhhwki;1:0iukiw;4:kjw;2:0im;1:oj2;1:iil;1:6hgjj2uk2vgs;1:6j67jk8gq9gdahhdjzen9fk8gjwjgcphcqh8vhcwh8;1:3jl;1:7hg8jbtkn;1:4iwjiv;1:7grahfbl0cjffjejixkgzmitwiq;1:1he2gx3gu4h47hcbjogkaiiujiokgwlgqnkkolapj6qjethfuhewhb;1:uiy;1:7ix9h8uk5;3:9itdinegufjjmj7whe;2:jjc;1:jhgkh5likmlmwhd;2:8ilbjdgiqkg7nk8;1:ajaiiujk3rh2whf;2:3hf4jn8in9hgeikghgkk9niroh4phbqjkthfuhcvgzwip;2:rlk;1:3jj8k79m4ah3chfdhgegwfhdghfjj0rjrtjkuh3wgs;1:7hd8gz9h8aixbh7cjcditgjehipjiwqh7rhfuj0wki;1:3jggj5;3:eiopkn;1:6hawkq;3:aiw;3:akafirlijmj2niqphhuhg;2:fit;1:7imjil;1:1jm8kg9gwajxbh5chffgsgj4ijhkgkohcpgywlp;1:hk7;1:gj6;1:3gxdk0egljlswgf;1:8h9agufkogkiwhd;1:0imghcjimmhboiyqjntk1wjh;1:hj2;3:3hd7hdahabh6dh9ehffk5gh4jliohgqharh8smnuklwgb;1:1ik3pt9hbciwhikjh5lhcmivrj9vhfwf9;3:dip;2:2j2;2:6jt;1:3k0;4:oin;1:1iurha;2:3h86n0iizjhckhcnkfpjwqh7rh3tg9wgv;2:tik;1:jgeom8qjz;2:dh6ej4;1:hhgjhekismgmtpe;1:bhacjckjenjmwhd;1:0k5wh9;3:3iyciujjr;1:pk2whg;1:fiygh2ijq;1:dheej8fh5gjnwh9;2:2kh7hgqlswh3;2:0hg3j14jf8h19jeah5jgvqkjtj4wh8;1:8jo9ikkjvnhgsj0;1:0gr1k62ge3gn5he6gl7gx8im9fsbgvch0dgqehdfgxhh0ih9jfwkoclixmmanm7om3pljqgerettghuimviswfw;2:4irfim;1:rji;1:uir;1:1k9kh0;1:2iodhdfirgh5kh6mhhplksj0thguh5;1:8ja9hdeiupj7;1:pjd;2:pis;1:7imjipkj2lhd;1:7g88iubimwkc;1:bju;1:3ix;1:0gm1gy3h44ha6h57gz9gwag8bj7cm5dp2eg3fgvgfvhgujk4kg9lgvmgtngyohfpj0qgerkosljtkoug8vikwhe;1:nin;2:dis;4:wj6;1:pj0;2:4j28h59jy;1:jin;1:0j3;1:ajcplqqh2rh4wgw;3:8ku9k3agkbh1dglekbfldggohh7jgtkhcpirth7uj8;1:2h43jo6gc7m9lj7ph4wh2;1:civ;1:airehgjhhnikuiyvj0;1:eh8fftgl5hj5jhhsk7ujt;2:4j37hb9h8ciyegzfh8ggehljjgwpkaqkcrjtshethauhd;1:ijeogxpl7wh7;1:8jl9gfhj3ljrrh8;1:tj1;4:dje;2:8hdciudj7gl7hfwjkwqhdrkmwgh;1:5j0;3:0hh1gq3j25hb9jzaijbhgch2el4fhaggvhh0khemkuohhph9riusjguh0wiw;2:7l28j19k1ajnbkccizegyfgmghgjivkiwnhepheqhfrh0th9wgv;2:8hfejfkjnuh9;3:0jb5isrk3thh;1:hjgjin;1:0h51h92h33ik4hc7ix8im9kdah1ch8djmejlfgugh0hhgjilkgyphaqiysil;3:8gs9ilair;2:7gs9inahgeinfmfgheojxpheuiswhc;4:8hf9ilbj2;1:gj3;2:0gr4h45hg6lh8mx9gtaj8bh5ckcfhbgh5hj3im1jhclhfoh5pharfosgjthavhb;1:fjq;2:cjhjj0;2:9iz;1:8jlohf;2:diu;1:ehgkh2lkf;2:1m2ch5jh9rlhwh8;2:ait;1:bir;2:jj5;3:8il;2:0is8j4jhf;1:tmh;3:bizcj3gh9hixrgh;1:8j79juajrbkrcj7egzfgpkj4nhfrh7thg;1:cjh;1:2ik;2:8jd9hd;2:2ilkik;1:jgxmiwwj7;2:uip;1:8m49f8firhio;1:0gk3m66hgjk4qh2rhfwl7;1:ujgwiw;2:0imkiy;2:5ivuiq;2:qil;2:aj5;1:1ik2iodhdjgxpl3rhhsj2uhawiu;1:jiy;1:tiy;2:ch3jkj;1:1h66h67hb8iyahcdfuek7fjohk1jgykjaljrmhfoiqph7qhgrjhwhd;1:7jujhcoj5qikwgy;1:3gw4iq6kr8h4ghahh3jj0phbtkzvkcwg8;1:3h56l17k88gzjh9ogyqh8rhfuixwm5;1:wjm;6:7ks;2:8h3tlp;1:ejc;1:8hf9il;1:wj0;1:vis;1:fis;2:8lc9gvbhechceizfhchippjyujl;1:uiw;1:0ke3fl8k99fnalubjpeh1gk6jh2qiprhcshduhfwgz;2:hjmqhh;1:2isbkpgiwrh9;2:mjj;3:4kq5hajgeqke;2:ij8;2:6j88j9whg;1:tjl;1:givsin;1:hj6;1:1hd4hg5gn6h97g19h5ajsdhhehdflggj6ih5jklkgvlhcmh9nh8oheqivriytl3wft;1:2fb3j96hf7m59j5ah4jixuimwgv;2:aj1bkrch8dh8eirgh3kj2pj8qja;1:ij2;1:8gq9j6bhhcjyej0fiy;1:vj4;2:oh7qje;1:1iu8jimj8rh9;1:qjh;2:kilnim;2:3j78h8ehfjjlqjtwh6;4:7hg8ip9hccilkisljjnjpphfrg6ujw;1:qkqwhg;1:9k8;2:cja;3:keqmn0;1:jj1;1:1iyrhd;2:0kjwha;2:pli;1:jj5;1:mjaoil;1:bipvj4;1:ogvpjm;1:aiz;1:pj4;1:0hg2hb4nq8ikaivbjucgeeimggdhhfjh8kjyohcphdwhb;1:7hf8j3cimjlfoizrgksjdwhd;1:fhegithh5jj2sj5;2:nik;2:cjarh4ugavjy;1:2io8h69inahebh4ghaiiojj5kilqjvsj6tip;2:9j0ahefk5jiw;1:9j9ehetk2;1:4j3;1:eitgk4;5:8ff9mdagxbjadj2eik;1:8gp9ja;1:6ix;1:1j58h49gsahgbh2fhhgjrjgeklvlh7mlwph6qhdrjxthgwj9;1:4hg8ne9nrbfuejyph9rh5tgzuh6wgv;4:3iw;1:siswim;8:ajscimfh9khg;1:pksqio;1:6kkliyrh3vgswh8;4:9ijjjupiq;3:9j2;2:4j3rixwij;2:8ineip;2:6ka9hcahebiojgzqhbrgwsmwwiv;2:lin;1:jjlsh8;4:5jaohgqkfwhg;3:ciu;1:dm1ef1fjf;3:0im;1:2jg;1:4hegjmhk5jirqiurh3wh6;1:bjmcjnlik;1:bildijpit;1:1jl8h29inciwjhdnjgrgy;1:4qc6hfoj7phdqhduh9wh3;1:0jt1gxej3hiqkjc;1:0jg;3:8ij;1:eikwje;1:8j49h5fj2;1:ah5fjt;1:8iu9ixahbbgmcmieh8fhcrjgtjbwgz;2:rj5;1:0j33gyrj2wh8;2:eik;2:jh7rlswh9;3:0j0;1:dj2uitwjg;2:9j9bjjehewh9;1:4lj8h7gjswh3;2:bhgkkoljb;2:3in5ik8ip9gwbjxcguphgqj5rh9tjbwj4;2:wj9;1:9l3;1:0kj1lbwh7;1:0l71h22hf3ip4gk7h49inaj3ch3fj2hj6igtjjsnj7ohgqgbrj5;1:ugivjx;3:lk0nh3;3:qix;1:viq;1:siv;2:aizrk0;2:bjpch9khdnijtjx;2:ujd;1:0im4hf5hgbgzdh6eilgj1hivihajitkhblhgnjdoj8pkdqh0tgxvh6wil;2:9iu;4:ujp;1:ajrfhehhbjjwlinpipqjlsgsthf;1:7jeaildikgj8;1:qiyriz;1:9iwkkc;2:4iqahefhcgkmlh2rk9;1:ojf;3:1isrjf;1:0ha4j7dlfeetfil;2:wip;1:8is9hgekifipjhd;1:cj3;1:jjhwhb;1:fil;1:1in2iv5hd6h47h38js9hdaioch3ehbfhdghajjvkjllhcngvojspjgrh7sjdwga;2:8k8aiofjgghfriltha;1:ohfpjy;1:jhfrh5wmm;1:6hf9k0ah9bhacjbfj5jjnrh3siluiswgy;1:bj7;1:biw;2:0hg2hc3gx7hg8op9j9ailbkodgnehefgyjhfklalgknhdohaph5qh0rgmtgiujlwgr;2:9iv;2:8gnokvph8thcum1;2:7il9keairchcelhfg9gh2hh3lhbmharjhsjluh4;1:uj4;1:sin;2:8isjja;1:vk6;2:6gs7jfag9cj8fj5gh0hksqhfrfhsjzwkn;1:2h83jd5jw7jjdixiksjgywgc;1:ggwiljjj2wh6;2:ej1pj1;1:gj9;1:0j01hh7hejgpkkblhfpkkqh3wmw;2:dgmeksfhg;1:2iqiitqkj;1:8irkio;2:wje;1:1k2rg7;1:fiq;1:1h85j77h48h8aimggkmjrnmtoizpgorhewgu;1:rk8;1:ajh;1:ojw;3:8ik9hgpirsiz;2:ljx;1:1k4sj3;1:8izbhe;2:8ildj0eiqmj0wh8;1:ojrwj1;1:hjc;1:uiqvim;1:dh2el8mjhwha;1:4il9ixjkcrhcwir;1:0jf;1:3hg4lx5h88iy9hfaocbjqcgxffpggzhhbkh6mhcoh9phfqimrjbtgy;1:jiulji;1:1jg2ke3lb7jpditqgtrhdwgd;1:jgzwjk;2:kiowjk;1:qisuim;1:9hcch3fhfgh7hm2rheujowil;2:1iw;3:bjwwj9;1:4jiwhd;1:8h39jl;3:4hg7hggishimijbjkslikrhb;1:8hejjlkjpmhdphcrilshfuji;1:5fv7kaak1fjfgiltjq;1:qix;1:wiq;1:7lymiswh9;2:8ip9h0khfole;1:4jd;1:8j4jhcqiltj4;5:bgpcjk;2:0ka5l16h6jhephcqkqwgx;6:3iqcindj9;1:3he7h3jh5ogyqsdwgu;1:2fp3gu4ha7w48hc9hbakvbh2dgyfhchgujh7qhdrhdtjevhawgu;3:hj2;1:0it6il7iqbkhcgvjhh;1:9iychbtiv;2:eh7jl0qjq;3:8hb9jv;4:0ftika;3:8j2jik;1:gil;1:1hg3hg4hf5je7ja8lbcj2ejpfhehhfjgykhgoh5ph7qgpskptiquhfwhc;1:3h94hf7h88lo9lbal5bnncfzegbfgyghehh8ihhjg4kk6nh0oheph9qj0rh4th5uhcwg8;1:3iqvir;3:9h1dlaegkgjr;2:4k25l18hgjggogdphgqh9slbtjuuhbwjf;1:hjm;2:8irdij;1:cj8ulb;1:akyjiukhapj9;1:7h2jheqlcwjb;1:4ikjil;1:dheejpfha;1:khfnmcphh;1:lkeuhf;3:4ip8fy9lvdm9efiliq;1:6gfvk9;1:hio;1:0jrrhc;1:8fyagzrlqumk;1:8gz9h6ajabj5cinfjkghdhizjj5kj2pj2wh1;1:aiqtit;2:jiqohfpku;1:kil;2:8j1qio;2:5kd9hfdhfjjf;1:uiv;3:wiy;2:8jecjadipeh7pisuj7;2:dh8ejquhg;2:4n5ojjuhd;2:hhgiinrj5;4:kk3ll9wh2;3:ajdjik;1:1ls3hc7k2einjgmqkjrgawh2;2:biv;1:bgojmorj5whe;1:8h2tjnwkv;1:5ip9gvbkucgijk3rjg;2:wj4;1:klkuim;1:8hcfngghfshcujpwhd;1:1ivbgpcjpdhaflsgn4jh4qh8rhguh6wgq;1:gkaqluwga;1:1gw2iz4j56jn7h48kz9h8ch0dgufgshj4jiokg4mh0nhdoghpgnqgzrjxsh0tgrum3vlmwfw;1:hj1;1:cis;2:1h7rji;1:lim;1:4js8gk9juaj1;3:piz;2:1hf9ioag2ckbggnhjljlu;1:7jnbjuhgwjiyrgssim;2:0il6khahgcm8gh4kjolhenh8phdwh8;1:8kt9h4ajr;1:4j1whe;1:0io5ikcik;1:piu;1:gjkrj6wh7;1:1j63j46jt7hdeirghdhiniitlikqhergsvkcwgx;1:rjf;3:1jl8hbjn1rgvwh9;3:3ll8knij3jhguhdwgn;2:4lmwh7;1:hjb;2:3hb6hebhedj5eh2fk3gjojgwmj2ohgph8qheujzvirwl4;1:5jv8ji9h5fhfgitjjeqh8sjlwh1;1:wix;1:fio;2:cio;1:fgehks;3:0io8hhghemhboj1qjqtjiwju;2:1h95ju8mb9h8bgvdjjegljgvljcmkbqjurgathewg9;1:7ip8f49heekajh9sjqukzvjrwha;3:dj7;1:ck2hjbjhdnj7rh5;1:3iw8h9tk5wit;3:ahciisnjfrjp;2:0hb2nz7h3hhbjizljhqh1rinwha;2:wm7;1:4iu5h66h57h68j1agqcksehdfh0ggcjkkkjcnhcphaqgbrk2sh2th4vj0wk6;4:mje;1:3j0;1:rk7;1:1k72ik8hbbgofjgghgiipjhclkwqk6rgiwhe;4:wka;1:bixejq;2:4jw8kn9g0ah8cixditfhdggyih3jh1qltrhcsjawh7;2:qjb;2:ciu;1:8ikfgehksjh1wiw;1:tio;2:8h79iwfk0;1:6jc9h2ah1bhbcm5fgshh5jh3khcmhhnqtqh3rgiwgw;1:1j9;2:sjq;1:1iq;1:0is2h03gw4h16im8hbbipihdnheojcqiwuhbwjf;2:aiu;3:1ip9itrgz;1:0kg2he3gv4hg7jc8jaaivejgfinhisogtqhgrikth9uhc;1:9kqbh1ekyjhfrikwhg;1:0h12h93jj4hd5h56h37ja8ks9n7ahcbg4cjtemqggvhiojgjkh6mheoh8pgyqh2rjkuh3vgvwfx;2:3juwh8;2:8hdafjffzghfjherj9wri;2:tiu;1:7ip;1:diw;1:jiwoitrinsinwhg;1:mjl;2:qitsjh;1:wko;4:5in8hd9gzcjbej2ojw;1:8j49gttit;3:jij;1:6iu8ha9iuwhb;1:jiosjc;1:bj4;1:7k7jgkmhfpjxqjfwls;2:dil;1:biv;1:jgzrjm;1:3ip4ha6ha7h99hcaj1bh3ciydikfgfgiphjyiiqjhflgwmj0phhrhctljugtviwwgm;2:8ikbjxch8jjqrgkwjz;1:2in;3:dh9ej8;1:9imaj3wiq;1:aio;1:akd;1:eik;2:tk5;3:7jpjkuph7qh9;2:6heaiwviq;1:0j8ll3wh9;1:3hg7he8kn9j5ah0chfehhkjfljvnhaohdqhhtmsuh8whc;2:8hg9j3;1:0ha3km5hcaiodgffnmkh4oiywh0;1:dilehgpke;1:hhariz;2:0jk1j04in8emwl8;1:5h5jk6;2:oiqwjj;1:aknhhcsgb;2:8h49kseh4rij;1:kjenha;4:8he9il;1:jim;1:4iz5jt7irwhc;2:bixhgzjjg;1:4isal5bezlj0rhdsin;1:gilwip;4:olkphg;2:wiz;1:giy;1:1hh8hc9h9cgwej1fk4gm4ikekh3nhfoh2qgvrhe;1:4im;4:9j5ejnhj1pil;2:0hf2gz4iu7ha9j7fizggzjk2khbnhhoj6qiorj5uivwiy;1:5hf8gzaivfhdhg3jg5rgysl5trpuj2vhawh3;1:dit;1:8hacj9jiu;1:3hd8ir9ikainfizhjjjhbqh8uk1;1:3h86he8fe9edag5bhfch3dpfeplfnugguhgzkh1ohdph7qh6rhftgxuitviywgz;1:8h29jrakpfgisji;1:8iswil;1:2iw4j2;1:2ku7jfbh9chdgjfojcrgusgx;1:6hd8h7fisjjctj1ukdwh3;3:qio;1:1iw;3:8ha9iz;1:1ipgio;1:girjhgwjk;1:8h8bhbfl7tlg;1:hit;1:3j3ajufgskiq;1:dhfehfuku;1:givhgzjl0;1:fioqjy;2:aggchbfjmhhdjj3nk5qiwrje;5:0ikhj3;1:4pbcgxkj6oh4piysh7;2:0in4ir;2:8ha9iofjzhit;2:cirjj0;1:9iwriowiz;3:hhesijtiv;1:kkj;2:gin;3:fin;1:9irakrjhbshewj5;1:hgstju;1:8gc9kj;1:3iz9it;1:9ip;3:lh1rjgvik;1:lin;2:eikgke;3:mggtli;3:1ik4j4wio;1:cjnlikrgs;1:1j1;2:nlbwhe;2:kjsrj0;2:eh1ujwvks;1:7ik8ik9hg;2:1gxgjomjtrh0ujuvjewhg;1:uj4;2:uji;1:5kw7j5ghfjk6;1:9jqch1;2:0h21im2hf3h94ha5hh6k57kk9h0chfehdfh6gjrhjyjinkgylhemgznhfoh3pisqiqrlbviqwem;1:8imtim;1:ch8fgyhirkke;1:wjn;1:3jv8jsbgscildk2jhemhgqkbrh0thdwhc;3:ag3bkg;3:jh8wk5;3:9hfdk7fh8ggmsk4uju;2:bkhrhe;3:3gmjkirik;3:0tq3iy4hc7h7ghdijajgqkhcohdpgorhhthgwgf;1:1ir;3:8ircjfhhepiy;1:0jakis;2:2lbbh9eh7jgvrkn;1:1jb2in3hd9h9aikeinhh9jikkitljuoh4pizqh0rgush4tiwvikwgv;1:8ip;1:4gn5ip6gv7qd8iyagqbh4chaeh4fh2ggtjflkhgmhdnlwokppjtqjxrgithcugzvhewfx;1:kheml7nha;2:4j0;1:1ke9j2jgnkhaqjnrjpsiz;1:4jojh2qk8;1:5jh7jjbkwjh0kheljhwgy;1:ril;1:8k9thg;2:riv;2:bir;1:1il;1:2gm4jg7l0tiz;1:ijk;2:8ja9hebiv;3:4jj;1:2is4jd9gmdmqef7jkvrij;1:3kf4jv5kn7hf8hcbhgjg8mhgog2pj8qgxrhgskztjquh8wiv;2:5kw;5:8j1bilhlsrh1;1:6j5lis;1:1iw;1:1h0cj8ijq;1:aitbhdghawkx;1:1hd6iw8hd9ffdhcejbfiwgikkiumh9qiwris;1:jh1qjy;4:siuuit;1:hhejir;1:8hbjkyoh9pk4qhewkm;2:8gw9jfbiqjiw;1:8io;2:8h39j4jhdnistkk;1:8il;1:fgsgl4rj5;1:8j99h6bhdghhkh8mkoogswkn;1:8ka9g2;2:diveh4uk5;2:5jghg8ok2rjkwhc;1:giyjin;4:0iy9gvahccixeikjjrkktmj0nhgukawg5;1:1hh2hb3gs4kx5ir6h87gy8io9kmairbiodizhh3ihdkj4mh0oh8pg2qh6rg5uivviq;1:uitwit;1:uj3;3:8hdjjb;1:gkm;4:3gd5im6jb7hbeh5gk4iinjgtkj7nhdph2qgzrj5th0uh8vouwgh;2:8h39hbcjgkhgokb;2:tjg;1:8js;2:gis;1:jiltkm;1:1ka3hd8jublrch0dgzjhdmjuwh3;2:6hg8h39izajtdgkelqfh2ghdkhgnh5sj2th9ungvgu;1:ak2fgh;1:8gp9jsqiq;1:6gr7jv;2:jgzrl3wj5;1:air;1:pl4;3:bhecj2fhdgjwhikpjpwhf;3:6kfqhgtngwgx;1:cjkeisfgwgh5tjf;4:aio;1:4j5;1:4iraiychh;1:0ijol9;1:aio;1:ej3jlxwg9;1:9h1dl6egnhklrha;1:liqwir;1:8gn9jycgyjjd;2:miq;2:8in;2:jj4nk6wh5;1:8hgmmh;5:2ilcilghahjtjh3tjf;3:vhewjq;2:jin;1:ajjfjh;1:fj7;1:din;2:dh5ej4kj7;1:dlwegtfhc;1:0j92l33hb4j15kl6hb7geajfbhcfh7ggwjg9oh3ph5qiyvjlwgs;2:8jviktkhb;1:wik;1:8hgqjcujm;1:6hgahakjrpkwwh6;1:0jc2ip4l7aj9bhbdhfejffgvhhgih2jhekh1ph3qh9tipuiywkh;3:iiw;3:jitsik;1:5jjjh8;1:4lj7kuqgywgf;3:ajpgj2;2:nj9uiz;1:8k09lrbgrohcphbrhawjc;1:6jttha;1:1jn4h47h2bglcgueh0fijggrhh1ihdjg6kgtljmmjknh5ogzpjrqnkrgkvj5;2:fj1;2:7il;1:gip;1:8gi9l3ak1bhedouee8fgsghhhh5jmkkgwnhephdqgzrj5sh9tirugr;2:4jysh9;2:jit;1:5hf6ji8hbej0jorqh6wfd;5:pj0;1:6j6;2:1jjjhbqirwhb;1:7j8;1:bjj;1:8ikbh0dh1el3fgxrjz;2:3jm7ikglpjhdqhfvhbwgz;1:gij;3:uil;1:8hf9ikak8fh3siq;1:givjhbqjvrik;2:chfij8pjjriowkr;3:0hb1gy4hc6ha8km9h4dkbejtghdjillhamhfph0qghrh4tk1wfr;1:biseim;1:5iv8jwtkouh6whg;2:2itaj5dj3gh7;1:bhefirjh6wjs;1:8iqfiz;2:3j37hg8ir;1:2isojfphg;1:kkpphd;2:1hf3hb7gc8fx9lmeghfhhgmyhg1jiokgslh3nl6pj4qghrmyugnwj2;1:9iv;2:8h89iw;1:0im1im2is3h14g15h86hb7gw8fybnbcivdgxej8fk8hh3ikjjftkh2lgimgtngeojhppdqfqrkotgrugovhawfg;2:8h49itmkd;1:8ikjkergb;1:gim;1:qh8wkr;1:3jw;2:8jjoiy;1:2mf8j39h6rhf;1:3gnbhbgh6il6jh6mhboiuqjfrjqtjawjb;7:3hgwk2;1:qiv;1:kjx;1:cinghg;3:bjb;1:qk8;3:3it8h6ghgjhfkhflkknkmojjriz;1:7j6dilehggknjirogqpiowg9;3:1jx;1:liwnk2;2:1kh;1:9k6dikqjk;1:rip;1:nin;1:giujjt;1:0ilch8dgtek0gh5hjekitmix;1:vka;1:0iu1l92it4il5hc6h48jjchbdh7fj7gizkhclhfmh8nhdpgoqgnriutimuipwg3;2:4ipaiqsgu;1:8hd9m1gjaihf;4:1il3hh5io6irggqhgwnil;1:ain;1:rjo;1:pk0;2:6g9vgywm7;1:0l11gz2h93iv4iv6gz7jv9jidh0fh3gk2iipkgjngzogqpgcqgusgztgtujvwj6;1:rj1;1:2iw4j2ciw;1:oiwqntth7whb;1:sin;1:5l77fohl6jfmqhfrilwlk;2:8imris;1:gjl;3:5pb7hc8gpagwchadikfgyhh1ij9jgtkhamivoh3piuqghrguthb;1:7jhthf;1:git;6:pmc;1:qil;1:rik;3:bhepimrlv;2:8il9jeahebioegygikuiw;1:sjg;1:khfnmd;1:fil;1:2m74kgejojh0rhcwh6;1:ahckiq;1:9in;1:oim;1:0iz;1:9j0;2:wim;1:3hakh8mn7nh6ph8qji;1:gil;2:8kn9gtfilkjh;4:8hd9knaiwbhdhj6;2:aimfhcpk5;3:gis;2:3ip;1:ah6fkowk0;3:0hg8gu9gsah7bhfdmcemafl9gh8jh5risth6uilwh3;1:5l88im9gfjllmgknkkohephgqgxwj6;3:1gxlhhrmb;1:jje;1:4j18h8chglle;2:dim;3:0ix8imdivej2fj1gh8kh2lkkqhfwjo;1:7j1qk1wh3;1:3hf5l36hgah6jg5khemlpnj7ph1qijsjhth0vjgwh2;1:1gr5j0biock2ejfkhgqh6rkx;1:jionit;1:7j0hhd;1:aipfhcggqhmijiutj2wh8;1:6j8whd;6:ijf;1:7jx;1:5ikghejjjsituglvk4wkb;3:gjgoinwja;2:tj1;2:aj9;1:2ipiivjjn;1:1ju;1:2h73lg8jb9gxbhgjgukheljuohaphdrhgwl5;2:aiu;1:gke;1:1j72jfbhefnjgh9sheuha;2:uil;1:giu;2:8l39hgbhbsiy;4:0il;2:vj6;2:8hdbj9sja;1:0kf8ivcgogh0rl1tjdwhf;1:3ha8hccijfivmkmqh6rjbuh6wkq;2:8jxjipkhd;2:8gy9jl;1:7iv;1:jjdnikqh9;1:bjocir;1:4jj7j8kil;1:wjn;1:agyhmwwhd;1:2it7ijjiy;4:4jo6hd7lq8g89k0ag8chcdgkeilhhcjn9kj0njzph2rh0vfz;1:8jb9iuaitjh4pmtrhcwg5;1:gjprj3;1:nipoj5;1:8gt9ka;1:0hg1he3h74hf6k47hd8hf9kjagtfjsgj2hiskhgnjhoh8pharilsgstgzviy;3:8j0til;1:6h8fjjgh9kh0lm6vim;1:dix;1:eiyoh5pkw;1:9j0;1:2m44gy8jv9gzahhdinfgyghehlsjiuohdqh2thcwha;1:wjg;1:1hb4hf6gh7io8ip9jcaiybh8cixdhhehgfgxgimhk3iikjh9mh9pgzqj6rjisg0thfuh5vjkwj5;1:8fb9jxfjllld;1:7h4ojl;1:ij5;2:dkmeh1gj1rhgwiy;2:9in;1:8in;2:6lcginwha;3:jj3;2:gj1riq;1:9jqbhecjcdhbegtfiqjiysjjuiy;3:0kf1lu7j6rhawh4;4:iik;1:phgvjiwk2;1:9k2bhaejgjj7qk8wgu;1:9iyjj1wil;1:8j1cit;1:hik;1:6mrwhe;1:0kj1iq3ir4gzrhawja;1:4haij6qil;1:biqjje;2:2ja5mi6ffaiofhgjh6ohbphdqhfrhdtheuk7vgvwlu;1:liu;1:2lc7ikdinehhugovjd;1:ek6mhaoh7pmzrhcugzwha;1:2gy3io4hc6g87iz8n49kxaitciqegmfh8gh3hgpjknkgymh4nh7ojcrg8th1uhewhe;1:9ixuha;4:eip;2:7jjik1tiwwhg;1:qiv;1:4jlkir;1:8kp9gt;1:gjfjh5;2:1hg5he7kgbkgcfvfhagixhimlkhoh1phaqh4rl6tjauhewh4;1:kjqlhcrhb;1:1inoh8wl3;4:6lawhc;1:8h1bj6jk7;1:mh6tl6;1:fks;1:nm5whb;2:3j3aishiwris;3:wim;2:2iybixhiljjdqha;2:9iz;1:bgxkl0;1:0hg4mt8irahebj6cjsdg9ek3fklggxhhdjgplkfmh0ogvqh3rfmtheuit;5:1gr2j03lh4jg5h36gp7g19jtaf2bgxcirdgeej4fligiphgbihdjl6kgnlh7mh3niopgkqimrfntitvjvwgn;1:6hevjr;1:0kd1j54gxajhfiujgxkhelk1nhaqgprjpwgs;1:kir;2:0f61hb3ln8j49hdajwbhbcishhbjjmqh4rgkujuwh7;1:livmjknjzviwwh1;2:1j0;2:qir;2:dit;1:8ioaj0bh7cgnejgghghj2jj8ljdqilwgz;1:siu;1:1iqiiz;3:cjgjiluj2;1:wl5;1:ijd;3:uka;1:jhfqj4;2:bkrchagitkhe;1:rj2;3:jik;2:8j29h6gj8himqik;1:1iv2j25he6gy7h78jo9h5aj3ehcfh2ggijjokj3lh8nh0oippjgsj5uhdvixwgm;1:1ir4iskj6;4:eim;2:mkpwh5;3:3kgchgfhghiwjh8klergxwhb;1:dil;1:4iw;1:gh9hh3jmdqhgwhd;3:qiw;2:6j08j19hadj4eh2qiuujyviu;1:gk4hh4siwtiv;1:ahddhcej3ghdjh8rj7skx;4:1gr4jc8inajhfgtih8jh1khhqk3rj1uhewk3;1:0he1h73ju4ha5hb7j78kt9gdah4bnoch2egufg6gimhh0jh8kgpnhcohbph3qhfrjcuj9;1:hiq;2:phaqlewhd;1:9j2gj4;1:1ix;1:miysil;1:gik;3:ris;2:2ff7pvpiwqgiwh1;2:1ivliswio;1:dj7;2:1j73hf6im8l49ggajobh0ch2ehgfglijejh4kginiooh5pgtqhcsj9tjwwkc;2:kji;3:1ik4ipagkbjrdhbek2kitnjarhg;1:4guiow;1:dil;1:win;1:1jq2qt3gu4h97mabhechbdhahhcjh1ogmphdqgsrhavj8wgm;2:1h67h38nf9g5ailbgich8df0ejnfjighcjg6kn7lh9mh4nhaojupgwqgorknsgytiwujtvgowgw;1:0j51k18iv9gxbinhijljmoheph9wha;1:1j7rhd;1:iik;2:jiwuiz;1:wj1;1:8iw;1:8ir;1:8gbkjoplj;3:ajgfjfghemhgshatjs;1:9im;1:1jd8heaipbj8kj0lj2;5:ij2;1:lji;2:7irwiw;1:8hd9ipjjiuilwjc;1:8iv9h9;1:9h1cm9hgyjjerhashe;1:3j3;1:1hg3h77hc8j29fbah9bhecgvdngeesfj0gg2hgkihdjhamiunjrohdpjqqjwrkztjsuhfwjj;1:ll7oh4rlgwh0;1:hil;2:6j68hfbhfdkegj8jiv;3:hjergz;1:4il;2:9iweik;1:2k13hg4nwah0cgyhlvjgnogypj9qh8wgv;1:6j5jipuiqvh7;1:8hgmml;2:8jt9j7khcmiy;1:7hd8jnakndg7ejufh2hitjhaqhdskfuhe;1:tiz;1:0gv1he2kn3ke4hb6ko7p38k69f9ah3bh3dgzeh6fh2hgoihejh5khfmh7nhgoh9pgfqgoriqth1uflvmk;1:aj3fhh;2:hj4;1:uj1viu;1:4inkik;2:8g79lc;2:0hc1h63h86hg8gh9f6ag8bh3cgwdnjekqfjlhinihfjinkh8lh5mh2nheoh6ph4qjyrk2tgwujrvkkwg1;3:aiywjb;1:3iw;1:0hb3hb4hd6hd7j38hc9h7ah6bhbdjgfo1gk2hh1jh2nhaph7qh6rgrukfvjowgr;1:gim;1:ahheh4sjwukpvin;1:3hc9gxafxdkgekzfjosjiuknwgt;1:uh7vjv;1:1h57jieikhirjiu;1:4haaj3bjechadikeikfirggehh8kn8qikwh9;1:rkawhd;1:8h1bo8rhctixwhb;1:8j1ahe;1:8he9ip;1:wj8;1:6j1vhc;1:ck7;1:gjewj7;1:6givk5;1:4jfdilih8;1:eitflm;2:pk2;2:2hg4h15je6ha8kj9jnaiqcj1dheeghffvggnhhfkjnmgxnhbokmqhguirwiy;2:fiqiix;2:0k0amzckhfjjggnhgujh8khenhephgqh7rgtskeuiwwgv;1:airfh5mheriqwk9;1:ojruhe;1:5jcdhcej0;1:6l9gimwh7;1:8j89jlajxbjnch2diteipfjkjikkipnhdqhfrgiuhewgb;5:sil;1:mjz;3:9irdinehdoj7;1:8gq9jbpit;1:6iq9guahglljmivnhgrh8;1:1iodk6miy;1:jhcoixpnkqh4wgb;1:6hfviu;2:8hbbjuchgkkp;2:cir;2:wio;1:ej0jhblitqj6;2:8iprj8;1:rj7;2:6iwjj2;2:eilsin;2:8iy9k9ekqth7uhf;3:9imaitbfzkje;1:0hc1gm3j94he6hb8h29jfcguel5fgxggaijejj3kh6liwmktnheohbpgxrissiwth8uhhvhbwj8;4:6ly7hfoiwph2qh8rivtk3uh4wgg;3:7lcfijggujhbqj2wjf;1:8j59h6hit;2:riu;1:6ilah2ehefhcgiuihgjhdlj0qizwhe;1:wlk;2:fkhhiqpimugy;1:0nq2iq3h84ilbioeiwfixggujhgphfuhcwgt;1:6hdgiujh6likuh7vm5;2:8h49jkghdhhbjhbkixpisrm4whe;2:jgekiwrkrwhg;1:8na9h1agfkilohcthfuj2;4:gje;1:1hf4l98jp9grahgdghejkgo7jgmoilph7qjgrggwgj;1:tj7;1:biw;1:pj2vjg;2:vir;1:nij;1:fiv;1:aiy;1:mim;2:0ge8izdixejn;2:2ikahauj0;2:agzbkf;1:0k83h94m08gw9kceizfilgiwjh1khbph1qhfuh4wgw;1:2gl4jg6hfjh7kjsohbpm5ujavjxwg4;1:0he1h04hc6hg7gp8j19g7aipbiydkfek1fivjhglhboitph6qgotkiwgn;1:hhgjk0mglshgtpgwhe;1:dhgeiy;1:aim;2:9io;1:1j4;2:4hbijekiy;1:qit;1:qky;2:5jy8j59h6;2:0jw1nm3jy5ha6h67gsahabl7dg8ejhfh8hjejgmkgnlgongpojzpg0qjdrhcugnwfb;1:ail;1:cj1;1:8hd;2:5iqfin;1:min;1:7kabjknjbrhgsimwhb;1:jhgvke;1:8g89ms;2:2he3lvfgh;1:3ilbhggjmjh5riywju;1:cgztk7;1:cir;1:6k07l18k1dgneijfhbhhejiukhbpg3rh9tl7ujavg8wha;2:fjl;1:8h99iwajvch6eiqfh0jirkhfnh7rjhsj2um2vgx;1:6ir;1:3jlaix;2:8gu9jhhgdjirrkh;1:fhgqknwhf;3:alnffy;1:pk8uij;1:0hc1gu3h95jn6hh8je9jybgxciyfiphgokfvlgnmh5nikoguqk5rktujcvikwfk;1:jiqujb;3:0hd1j92jf3gz4gw8go9hgah9bh8cj6ehbfh4ggwihajf0kgolh6minokoqj8rkrshftgyulbvlcwgw;5:piq;2:1h13k75ip6gs8iqchgggqhgqjipkhblixmmsoghpikrimsh3ufpwjm;1:3h84l06hc8hg9hbah3bhach5fkkggohinih1jhekh4lhbnh9ph4qkvrijtipulsvjhwgt;1:8h39k7eiu;1:0hg1hd3hb4h96r67h5ailggyjgmoj8pgxqknwgj;1:8is;3:bk0direhbtjb;1:qkhwhe;1:ehhhiwujd;2:2in3h84jo8k2oja;3:jjv;1:fil;2:7io;1:dipehffj2ghcvji;2:2je3hc5j46md7il8h59h0dgiehbhhdmhgohfph0qgpufmvo0wjk;1:1io3le4he5h86gn7h78gf9l0dm4egjfhdgg6hknijikh7mh9nhcoh6pgkqjxth8uipvgewgz;1:ijdjil;2:1ix2ilfhbrha;1:7jo;1:ahgcknfh4;1:1ippjjrhc;2:qiv;1:5j5fiztjx;1:2l5riq;1:3j64it8kc9h4ahgbh6cjpdgcek2fhdgjshjmij9jh7mh8nivphcqgztheuhcwg9;2:5ivjjbwj7;1:dj1uj7vit;1:jjboh0pjvqkgsivwgy;1:jik;1:gir;1:0jd2h07gv9gqagwbipchfdkceglghaijmjlmkgzmhbohbqiqrhgsj5vhcwil;1:ejj;1:ojr;1:oiprjv;1:oil;2:wjv;1:1ji;1:9jljhesiq;1:uj4;1:giwrj8;1:8jd9h8;5:qjr;1:9fadpdeey;2:7j4kj5;1:kh5mkb;1:fit;1:5jlhj2ikujh9rikuha;3:eiprip;1:1j43hb6hb7ivah0dh3ej2fh9gh1hhbkfklh8mh8nxaogspj4rgsth9wfm;1:wj9;1:0hb1gp2g53h34gz5h56mb7h28l8ailbg6chadjdej7fj3gj8hkzih2jftkgtlh3mhanh4oh6qg5th2ukevlnwg8;1:wj0;1:1kcajashf;1:hj5;1:0hg1ha3hc6hf8haahedj0ggmhn3ighjjmljmphfrjxugt;1:jk4pinsim;1:1jc3h85nb6g37h08kwajrbhgeh2fhbggpjirkgdmiroh5ph5qgfsintkaujrvg1wfs;4:3hb6ng9iphgxjharlltgawg7;2:wiv;3:4j2;1:nhfpjmtio;2:wj1;1:9j3om8phc;2:8h19hbbp7fhggjfhhhjhdkhangyokuqgzrgfuhgwk5;1:7jx8hf9ilbiq;2:bhhckg;1:0h76gh8h59heaj7ch9dnjfh4hhcjj9qiuvjcwj1;1:8h3ejn;1:1isaj9bhgfhdgjurhc;1:ggnjke;2:0h61li2h53h34kf6h07he8m19h7aj1cixgfzhhdijbjjplkdmgmngqogepglqgdrg0shbtheukiviwwfi;2:jhcqkcsinwik;1:win;1:pjk;1:9iq;1:1it;1:ak1fj1kgo;4:2gm7jewkb;1:pje;1:8h5kjqlkymheniptj3wh1;1:wjq;4:dk6ehafk4;1:ojr;3:7jf;4:8k7aj6ghc;1:hgvjgytm1;1:qja;2:bjb;3:hip;1:pj4;3:iin;1:8ilbiqnilqin;3:0hd1hc2j43hg4ha6ha7h5blaciydhgfgxglohg7jgslmonh8ogopgvqgsrl2shftgwuiuvhgwh8;1:0lggj3jijwhb;2:9hdsj1;1:5he8kq9ldbkich0eh5jh6kk5oj0phhugvwh2;1:hj3jgy;1:4hd8lk9gpbk3gjijheqjhrh9wgy;1:5gucimfivgiphiojh7mimniqqjwrh5tgxwh8;1:0jt4ilcghfmvgh3jjqkhhqhathb;1:pk6;2:1ja3hg4h36hf7in8jgairehffh7ggghlxilqjk4nj5oh5phdrfrsgctiruh4wh0;1:bimjhfwkj;1:sip;2:agofka;1:3mr5hf7iv8j4bkifhahiqjgsphfqh7uhbwgr;1:0iy8hbbhdcjrokf;3:sjj;2:ukbvil;1:7ip9hfjirskl;1:0h91ha3h66hd7he9heah5bh0cgzdhfehffh6ggihpqjo0qirtkduhgwfv;1:9imbh4dj0ehcjgjkh1lkzrljwj8;2:vje;5:biv;1:9ip;1:8h6cjf;2:5jh8ipfiq;1:gjanio;1:tij;2:dhaeja;2:wjj;2:aj0ejbjheuj5;1:1hb2jz3hf4lv6ha7h48iybh1chedhdeisfgvhh6ikpjgzlhbmjrnheog1qh1rheuj9wik;2:giy;1:7jcjh9;1:dj7;1:6lbdj7jhfkhenjywh4;1:9in;1:qk9whe;3:jip;1:win;1:8he9iswiy;3:0kg1gr2ko3go6h07gxakxbmbfhghgzih6jgjkm4mh1ogqpgkrjbshgugyvhewfx;2:5ikhil;3:9j7;1:bjkgk7rh9;2:bj8df1el1;1:8ha9jdojd;2:wjp;1:qk0;1:1mnah6dhcjhcrl5wh3;2:ghahj1jk7rke;3:6ixhjhrgzvhc;1:1gzaincjkdjlejifh5hiyrj5sjfthfugrwhh;1:cio;1:uis;2:0k82ja6hddk7jh4ljsqh2rgzviuwh9;1:8jjkh4lk7nizwjl;1:kmlpgm;5:0h71gy2h94hb5hf6go8jo9m9aineg1hj1lipmh1nh9ojfpghrkksgougp;1:gjv;2:oio;3:1h86ha8jz9ohagxcmseh4fhbhf7kgyoj9qhaugfviowh9;1:8gs9j8gimjjc;2:8fs9ldagncjxdhhegufg9giwhivjhelhdnjmohgqjfrjgtgywk9;2:1lb8gg9gzdhdrn4uhg;1:6jr7jb8h3bj3jh9kh8qhbtl5uipwiz;2:oje;3:pix;3:ah9bh6fk2hitij3rjfwhf;2:1iq;1:diu;3:8j6jj3;1:6h48ikvkh;1:hjb;2:giz;2:wip;1:0jl1hf2hh3h54it6hc7h69gzaiobhhcgqdkzgk3ijkjjjlgzmj8ojjqhfrevtiowfr;2:0hc1gi2he3in4h95hb7h38k49h1alubhacjwdjseiofguhktjfskh4lgznh3oh2pgtqhdrlfshethbujowh7;1:gir;1:0k66h4;1:qjd;1:hikjh8phdql4wh9;1:uix;1:ej8;1:ail;1:1jd8heaipbj8kj0lj2;1:6h07j0mjhtj7virwhd;1:fiq;3:0gy1h22fe3nq4gs6gy7n89hhbk6egnfggggchh7im4jitkgrmhfnhcogfpf4qgvrgfsjdtk3wim;1:8h9glhhh0;1:0imgiv;2:0jg4hb8h39ilajwbhhjhfkldlhbmj8phewh6;3:0hc1ir2hg8iw9j1aiybh2ej7;1:lixrh5;4:iiv;2:7k9elufgd;1:3ip;2:1ik2kr3ft4ik5iw6gu7gn8jcairbgbcgteiofgtggwhioihdjlqkitlh6mgzngzojxpgaqk7rlgshdtgbugpwh0;2:8io9gkcm3fh8ggyhpplgrqhgrjeuhcwft;1:hj6;5:mjl;4:lix;1:bj1ljr;1:bkj;1:7j7rj2;2:giyhio;1:9hfgjbkhennzpinwhe;1:0hf3he4hg8jq9jvah8bgnchadn4ekrfg1gg7jjekh0mh9ph3tg7ulowg5;2:mik;1:3j4aivbhgjhdmj9rir;1:0l9hiu;1:0h63ml4hc5h66h57fu8graipbh8egrfeugmykhelhemh5ohariysppugxvgzwhd;4:gh9hjajgmoheph2qn0rh2uk1vj3wgv;1:0ll1gr4hb6gy9jueitfiyghajh1qhgrhfumhwgp;2:8inbh8cildh2eiqfgoghfkgvnkhsk3ulqviwwh4;1:3hb5m57kjaizjhcwhh;2:dkaeh6;3:ak6;1:8irdh8ek4;1:akn;1:1k85j8giukhh;1:njosj5;4:tim;1:miv;1:jh6wlc;1:fil;1:5jb8m8dg0ejifhdhilwhg;2:gip;7:3o08h5ajlehhfk3gh9jlkqhgrh5shauhfwf6;2:6l7dheeh0;1:aj4fkfgj4nimrgrwh6;2:0j0bir;1:mj3;1:0go1h62h53gl5ha6h57gp8x89j0aggbo0eeughchh5ih5jgpkoqlfvmgtnh5og1pgwqg9rfpsh3tg2uizvjg;2:9ipdjjegy;1:8hh9gyahdfhdgk9kh8ljkok8;1:ah7fj7mj8;1:3jsiizwhg;1:gio;2:win;2:9gpel5;1:9jncijfh5rj1;1:ljr;2:8k89ozcj5dh8ee2rhdvilwhh;1:njr;1:0kd4h9;1:gjdhil;1:8k39mnakzbiudhcegjfgthhbjgikimlheqizshgthewhf;1:4jt;1:2j1;1:0gs1g63gt4is6gp7f88h79ikafdbglcg9dk2eg6ffygjdhmtih9jmrkgfmh1npcoh7plfrgdsh8;3:alndhcegvfktgikuhg;1:rh1tlawhg;1:wkt;2:fipqj0;1:8h39l6ciqdgbrisuimviu;1:bjm;1:8kn9j4ehb;1:fjz;1:wiy;1:8jaahb;1:9ikcgxjk6lhgng2pl1rjl;1:kj4;1:fikpim;1:eiv;2:0k81il3ju5ik6hg7h9agucipgh7iivjh7kh8lj7nj5rgusinthfwgl;1:ggpqk5;1:chffjn;1:2jdsh4;1:9imrizwij;1:qjy;6:0h42hg3h37h98nc9moag1enphhgjh6qgzrgvsh2thguijvimwh0;1:7ij;2:djyjlhqh8wgu;1:fh3gjivim;1:wik;1:ajgfjy;1:qj7rj1;1:bn5giskjqlh5wh6;1:riz;2:dij;1:uj4;1:hh1jkn;1:0jh1gv3gv4hg6k57kz9heahcbk7dgqfh8gh8jj0kh3lhcmgypghql2tjnuhf;1:1hb3jm7hc8g6aecbhdck9dfpekkhgbkkzliymhgngwok0qipriuth9ulxwhe;4:kir;4:jio;1:8j2khbml5ohbph6;1:1kegim;1:eiy;1:ijxuj0;1:8jq;1:oh1pj6;1:2khbhdeingj8qj2;3:4ke8fs9jlekqjhepijwh0;3:tkawhh;3:pk2;1:2gl3na6h5jgipmeqhaugnvm4wfx;2:5hg8kjbjkehgrj0;1:cmfrgkshf;1:8hhagmeh8fjoulb;2:8h79lgak2dgxfgwjherhgsj2;1:wiz;1:kj2lhd;2:8isciw;1:2l48h59jhahebj3dh9jhfohgrhfsilujnwhd;1:wio;2:oio;1:kiz;3:ciopj0;1:1in2gz5he7h98h19jjah6bgach9dhgej7ffxgp9hm0jgkkhbpipqgyuivvl4wfy;1:ukf;1:1hc3he6l77h0ah9bitckzfgygiljgkok0qhbrhbuk1whb;1:kh3ljyqkerh5;1:4iusio;1:0ja1h3;1:7he8is9hgcjadktgjkjh6rgfuhgwio;1:8eb9luhgiqmg;1:5ka7hejiu;2:cglql8rhgwjj;2:6kcdhdejsqiwshgwgk;1:8h8fkcjkwpjvuh6whc;1:ah6qj6ujm;1:jkawhg;1:8gsbjoghahhankuqiztlowhg;1:7iodmdegb;1:cj6fj3gh4hj8;1:0it5pl7h7fjejh7qh3wgo;3:oiz;2:3gyaj9dgveh7ftqjhdkg9uhg;2:0k42kbah5fhggjckjslh3rh4sjwwh9;1:eisqjk;1:3iufhdgklhjb;1:9hedmcjhaugivk2;1:0jsjit;2:4hd8izejhjhesiywh1;1:2il8hcbkoeivgjswin;2:jjn;3:lirnje;2:6hbumyvgo;1:piz;1:9jhalkejqfgcpjiqhgwh6;3:rj5;2:agufjhgh1pjl;1:1jg8hdgiwjit;2:pj0;1:8g09km;2:3k4ahheh2sjvuknvim;1:8h9afxsjptklukxwhg;1:8ikajkfji;1:dil;1:9il;1:fik;3:eit;2:ll7oh2rlewgz;1:qklwh4;1:4ir;1:ikv;3:8hc9jc;1:8iksip;2:9irbjohjq;5:bixgiv;1:jh6okepji;1:ajnkjd;1:8hbqkh;1:jhdqj0wjx;3:9iokj4;2:8k3;2:9jb;1:0hb1ji2hh3h94jx6h88ikch7eilggkkjfmgrniloh1pgmqh3sjgthcvjnwjb;1:5iu8jrtkouh5whe;2:dik;1:3jn8h9ahhckbjheliqwkc;1:1je3hd6knahcbh3ghbhh5ihdjj2kjamkvoj5phdqgrrhgtipuhcwgj;2:6hdql3whd;1:8hf9iyciqpkf;1:cim;2:dk1ekagjz;1:cik;3:oiv;1:iir;1:3j9fh7wju;1:eis;1:ail;1:8kk9gqjh6pjgqk3;1:iinsip;1:wiu;1:2ha3jl8jq9juairbj4ch8fjgjj9lhemhgnhboh7ph8qh7rglthcuiy;2:3j3lit;2:git;1:ah7hj1iinrin;2:ojsuhe;1:wj3;1:jj6;1:jje;1:3k58hf;3:0jh1hc2hg3j44l47g89haaipfjlgh3hjfikajhbqhfthguh9wh3;1:3jefh8;1:gik;2:7ls8h99j4divjhdwh6;1:jikwim;1:1ji;1:6hgdj4egrggnjirnj3oiqpklqirrhesj6thfuhfvj8wha;2:oiv;1:5j87iqagnfjfgjgqh1ujh;1:ejblim;2:8hgrji;2:8hf9ghbjpdlkeg7ujg;1:0ki;1:0hc2ha3hg4nx8ikairbj0cgedisfilggmhhdkjwpgysikuhfwh7;1:9iv;1:1gyahehiljhgkkorkcwjw;3:8hc9jloj9;1:piu;3:kiz;1:0h74gyilx;2:cjepit;2:cir;2:8iw9hg;1:1jjajiwh4;3:8gbek1jl1qjkwfo;2:hinil2wha;1:2hd7inlip;2:0g81k22he3h54j66h17hd8gn9itah5ciogj6hjzjk8kkxlh8mgynhdph0qgrshhujkvj5wgi;1:pke;1:iim;1:2in;1:fh8hkv;3:ekipjb;1:9h7ej7;2:1ir3gy5ln6lz7is9h0ah5bhbfhggh6hgslh4mllnjbpgzqgurgqth5uguvmlwft;3:jk0;1:gj0;2:1j93j66k18ijeisiivjhblimrh7vipwh5;1:1khjjrqjb;4:1kn6h2jh2phdqh7tjawm2;2:0hg1ik3h7eixfilgj5hjhlhhpgzqh1rjr;7:hivriv;1:sjw;1:0ix;1:0j23gzsj8;1:gh2qju;2:9glekgnj1uiq;2:aiq;1:mllwhb;1:8h59j3bipok6;3:8j69jvbjhcjddipghejhgwha;1:7gvfj9jhdok2rj1;2:cjk;1:6ge7lgbjfniyphguk7wh1;1:5k8jiu;3:9jzah3;2:rik;1:1km8j2rh1;1:ajh;1:8incin;5:3h97h88lx9lialcbmpcfkegcfgwgh1hhbjg4kkylh0nh1ohfphbqj5th8uhewg8;1:tjh;4:5kb7hf8hbajbcgzfj8gh1hj6jgrphbqk0rjjth9whd;1:8ir;1:0iv;3:0h81g62jf3gw4iy6ha7gq8geaimbh5dh6fhcgiqhh7jl4kgmlgznh8onopj2qkgsj7ugwvhb;2:2l87irwhg;1:ij2;3:0hc1he3h17jw8hbahggk5jgckk6lhfpkiqgmrhdsj7th9wm7;2:1ndaiskgemh5nh7;2:8ir;1:bincgtjjc;2:0jj8jn9gu;2:8hdgk4;1:liy;1:0hf1h82j43is5j37hd9gvahdchfehafgxggihjhjgdkh3ljlmiknj7okdpjlqgkthguh5wl0;1:aj0;1:tik;1:djoeh9njmwhf;2:djvegv;2:jhewka;3:8iynhfojpskyujvvh4;1:1ik2l08gd9jubhbdipeh7gh1jh8ohaphgriktjeuj7whd;2:mkb;2:lju;1:8gvbh5lhcrm9;1:0iz;1:1h78hhaosckffjdggmhgskhcnherg9skouiwwgv;1:lhdnhdpk1rj1;1:kk1;1:5inbj0;3:hix;1:8k4ljirgvwiv;2:cixeix;1:0io;1:5ij8jh9iwehahjk;1:8iqaix;1:jknsgzufdvl0;1:bjo;1:1g23he5j06m37iyah5dhfgh8jfykhalj1mhbnj3pgzqh7rh6shgthdug4vo3wks;1:5jv;2:iio;1:7lx9iqjfrwh6;1:6iw8iq9hdtj8;2:sip;1:6jg7gzjhfphfqh5wlv;1:cio;1:1kuahbrjiwgg;2:3k3rhb;1:8j29h1bjfjk9whd;1:aitej1mjbrgr;1:8la9l3bgycjkehbghahiqjhekiwrjfwgu;2:5ji7kdjh5;1:hikohewjq;3:sir;1:qnkwgw;3:jiq;1:rjt;1:bj9jh3wjf;1:8iyek3fhd;1:aiqfhcgiyhimsk3;1:fis;1:chermhuh3vjfwh2;2:0gl1hg2j33gs4ol5hc6iu7ij8gi9haahfdileh6fhehijkh5ohdph3qhdrh9tk2uiuvhg;1:4hc9gdahbbl8cgrejhfmhgg2hitjivkh7ogzplfqhcthhwh6;1:lji;1:1ju6hf7jkcgujiv;2:jjq;1:1iskit;1:8n4bhdthg;1:8jp9irehahjm;1:1hc3jk4ha6ki7iy8gi9h7bjoegtgk6ij8kh4mh9nilph2rhethduhfvghwm3;3:bj2oha;1:kj2;2:2kg4heoip;4:2gn4jmjhdujfvk3;1:3ijqk6rit;2:viu;1:jjn;1:7hd9hgejhjh6kgknjsollpjqqhdriwvjzwgs;1:8j2dh9ej5riu;1:0hb1hc3h94hc6h87iz8hb9h9ah3bh9djbfqfgkjhh0jh1khhmhanh9ph3qh3rgoshgukcvjmwg5;2:qj9;1:eik;1:3in;1:9j4;4:6lgwha;1:8jt9gzaijbh6elhfghgjbhhgjfiqhgtheuhewlz;2:wjb;2:ahefj9hiwrj7;1:cjq;1:fiyhirkjesio;1:8h89k2njz;1:0il1h92jm3gq4gt6iq7mh8h79jaagmbjwcledh3eiygh8hhfihfjfukghmh1rh1shgtituitvguwf8;1:uje;1:9heej4;1:8j8;5:4haij9qkgrj1wgw;1:jhgrj3;2:kjk;2:0iv1h02hc4h05hb6he7h1chfgjwhhbiitlitmh1nj4rkksh7tiruh5vhewjm;1:0h11h43h94ip5ha6gi7h88h0bgvcimdhcegtfgngl8hj0jfclhgmh4nhfpgiqjzrhfstrtgougyvis;2:gj1;2:8hbbkgljv;1:2iriitqkk;1:1jtjhfkhfqj3;1:3kh9hg;1:nj5;1:9inagjclmfh9jh0rjt;1:4ixtin;1:8k09h7;1:ok0qhdwio;4:eheijhjj3;1:0hf3ipsji;1:eiwik8miknhbohapj1;5:afajlwpj2rhdskd;2:7hg8k99hfcj2gj5hhflj1rhgtj1vjwwga;2:2fr6l9vj2;1:8ha9jd;1:0j81h43iq9ikaj7whd;2:lj3ogyrh0uilwmq;1:lgarkh;1:ikrniq;3:dgqej4mitsj0uj7;4:hjerj0sin;2:7hh8h79gsahcch9fhgggijk0lh7mh9nhgokypotqitrkeshgwh5;1:6h4diueh3tj6uk2vis;1:fh0gldmjwrh0wgz;1:pk5;3:jjlojdqgp;3:fj3;1:8hegjnihbjjjqhgthcwje;3:8hdgk5;1:qkgwh7;1:0hf1hb3h05h96gu7gt9hfah0bjxcjbdhgeg9fg0hpnihejglkjllhgmhdngroh9pklqirrimsh0tgvujgvj4;1:bj3cix;3:diuehc;1:sip;1:3l3aizciojjeqh5thawhf;1:hix;3:qimwkk;4:9ha;3:1hf3hg6hd8iyaizbk0cjtdh3eivgjjhjqjhekjblhdmh5nhhrh3th1wge;1:hkzjhgrft;1:fio;6:0hdwk9;1:lk4nhf;1:6epvll;1:6knwgq;2:gk1jhf;1:aggklw;2:sipuim;3:tl6wha;2:7he8iqak5bhgcilghgmhaoj6ph8qhgrlbwhe;1:sir;1:0h31j22iz3jh4gz6h88gs9h6bgmcgzdhgeh8fkmhh0igzlfymlcnjsriqsj3tgrugdvkj;1:uio;2:ajbcil;2:9j1hj0wja;1:kj8;1:1gh3ha4hc6h27h38k79k6agxbgjck7djoen7fingmehgvihckgxmhfnhdohhphbrg2sh9th3uiswgj;1:4it;1:1iydhfehcjn0whf;1:lj1;1:0gy2jd5h26gv7gr9iqaiobjhcghdj6efnfgkhjeih8kgdlm5mjgngupgeqh2rjssg6tisujjwj8;3:rhawkk;1:0hg1h83h87iv9jcajhbhfeh9ghahhhjkoogupivrhhuirwik;1:9jdehdrjl;1:1k38is9j9ahadh7ejmjlrkgxphfsh8uh9wgy;1:1k4agzbh6ggejl5kh4lh9nf8oh0poargqugfvjowkx;2:3iwwjr;1:9imiij;2:ahggguhl5jfwqjqwl1;2:1h5aki;1:aix;2:ngdpjp;3:2hbtiqujwvjd;3:8ggah7bg7dkkekdfmqggrrkbwhe;1:5kn;1:gin;1:6juphe;1:3hb5nc7jz9h9dixegsjfumj4qj7thhwh5;1:wiu;1:flfgj5jirthfuh6wh8;1:uim;2:fh9wjl;1:ril;1:fgehkt;2:8j2ais;1:6h18l6jh1vlu;2:tiw;2:7gf8imgipjjh;1:ciy;1:3kp;1:8jctko;1:8j89hfhjm;1:8im9j4ajidj5eh7ghgjjfoj9ph5qherhbwiy;3:8h5skc;3:jgepg4qma;2:khgmivwj1;1:miq;1:aj1ujl;1:0iwjgzqlm;1:4iz8he9kneh0fitjgcrgzskg;2:1kh2iv4gt6hg7h78l69gbeh0fixgghhjpijgjh7mkjnhdohdpghrjlshgtg6ugxwgn;2:sj3;1:7jhthh;3:8h09isgiokkh;1:8k39h5;2:8ik9jphh3jj3plmqhgwh2;1:hhatiw;1:hip;1:lizrh5;1:bipdkyeh1jh7;3:9k1al2;2:bh5gh3hgzjm7ll4qh8wh3;2:gij;1:1hg7h68h0akebk3cithjwjh4mhanjkqinrgrsjyuh4wh7;1:6hg9hdeivlhgpjewju;1:1hg3j08gsbhgfh0ghgjgykgqljrms5oh3pgzqkerhdwgb;1:uiq;1:6kcwha;2:jix;5:2ik4j16hgolpphcwh8;1:0hh3gq4h45gz6he8h59lvah8bjhcgrfh2gkthj1ijumh4ohgph5qgbrkfsikvh0;3:ejsrhg;1:2je3he5jh6ny7g48hb9hbdgjhhfjgpohdpjdqgtrhgshcufovoewjc;1:bjfcin;2:wjj;1:1hcmklrgnwl1;1:5knbjmgijjhamhfngsol0qh4wh7;6:0jyaj1jhfuj2whf;2:aipdinehdsio;1:fiqpmtrhhwgh;2:bj1eiuwj2;1:wj3;2:qkwwhb;1:bhclkwsil;4:4k2jiv;2:iimpjqwiy;3:0ir4ip9itahdhj2oj2wj3;1:oirphdsj2win;2:0g51gz3gx4j97gp8l19gfahebgvdh5egofgrgivhh4ik7jfnkhblhcmgnninpgxqj6rllsjktj0ugbvj4wly;1:9iwgjvjh4;1:0in8l89jgaftbh7ciojh6kh1pl4rh5sjauhbwhe;2:2jo7hg8hgjhbrlkwix;1:lizohfqip;2:civdiqwj8;4:rik;5:8j2ek5fhgghejjjohepheqm8thc;3:8hf9koaijbhcfhggjfhikjh5pkfshauhfwgt;1:jj7;1:pj6wim;3:3lcthd;1:0ko3gy4gk7hbaj0dineitfj0ghdhj0ih4wjh;1:uip;1:1jo2k63kg4le7h3dhcjgwlisojgpgyrhcthawgp;1:2jn;2:0li4h29iy;1:8ivglojhgwh3;1:8iruiv;1:0jh7jl8h5bisdh7gh1hikjkgqjyrh8wg1;1:cgrhiykh2lkdrk3;1:8gs9jrpin;4:diqeh3uk0vjf;1:dinehejh6wk2;4:8kz9hf;4:bl0ch8;2:3he5j36mf7j38hgah5bjighgjg9khdlhbnj7ph2qhgrheshetjkugevn2wgq;1:qjf;1:ij8uip;5:girhh1jlbwhc;2:vj9;2:2hc4jg7irbiqghhojn;2:8j0qjr;4:8la9gwbh9cj0;1:8kb9ddelb;2:1h12lj3gd4fk6jk7h58k29gqahbehhhkcin1jlwmh0ogspgirf9sgctj1uh3vhgwj5;1:0jjhh5riv;1:3iw;1:7iy;1:jji;3:6iwciohh5jiprja;1:qiq;1:8j0;2:5h8jhewjq;1:1h36hb7kd8h9aisdm8hh1jkjkjxnizok0ph7qgvrgxsh8thcugrvj5wfl;1:6j7;2:1j12ij5je6hd7h49gmbimcjteilfivgg6hjhiiqjfpkhgojdphcsh6uh8wir;3:kheml8nha;3:9irfhgglsjh3wk3;2:3ke9hg;2:fjs;1:9kf;1:1hf6gq7kvjhgrk7;1:8h9bjk;2:0gu1hf2hf3j65ip8ivcgwdhdej0fh7gimhiwikjkhclh1mhcph2rj3tjhuh2wh1;3:ajqjgxokbphf;1:gkg;2:7g9cl1fhbjjgoiyqj7rilwhc;1:5k46gz;2:kj0;2:8h8ajhbiwckq;1:jj0;1:jjh;2:8gybj9;1:div;2:uim;2:6h7pm8wgv;1:eh8hiuuit;1:jjdqkkwh3;4:wik;1:wjn;2:1gs3ki7hgahcbj0cj3djhhjjjfnkjgmh5nhfph9qh1rjgtikugvwgt;1:8jt9gbwj7;2:ogepmxwh2;1:din;1:3h45ke6gr9h5cheegpflrgjnihajjhlh2mhfnh7qhetjmvipwgj;1:1jv;3:0ls;1:2ixwix;1:pjk;2:6hc8hebhcdiyeh1fljgjajgwkixphaujnvipwl0;1:6lp7j9ag8bhfflngipjh0mjpoh6phcqhbrj4wgo;1:0kb1kf2hf3hf4kf6hf7h99h3ah4bh5egwfgxgjaih9jgkkgxmhbqh7riuth2uknvjbwjv;1:8irqj3;2:fj2ghajijvj2;1:0h31j22iz3jh4gz6h88gt9h6bgmcgzdhgeh8fkphh0igzlfymldnjsriqsj3tgrugcvkj;1:1pk2hf3he4hg7hf8gn9geahabh5cjcdg9eh9fhbhkdjgtkhbmjlohdphaqh6rottheugxvhfwhb;2:4io6j5chgkitpizshe;2:2l37m3qhfrhdth2whb;1:0j94hhvip;2:3gq6la7is8h29hgagpbk0ciqghghjqikjjfgph4qh3rilshdukzvhg;1:2ivshe;1:kluwhd;5:0hf4h35hbdiwekpfh7gj4iivjhhkh4lh3mgznh3oghpl3qh2rjmtheuk4vhcwgh;2:uj4;1:cjdhhckkw;2:wim;2:1gs3hc6h48k39j0aivbhcch1phgqhgrh5ukgvk6wll;1:riy;1:0h91h72hg3go4gx6h37h38jdalnch7djnegrgjnjhekg6lh5mh6ohepgoriysjktkpul6vinwfu;1:1h28hcbk5gj5hizjgvlimrkcwh7;3:qjgvj1wj0;1:4j1ej7;1:gikmhgollpgz;1:8iqag5ghehhhqhbrisun1viy;2:nil;1:1ip3k28j2gjojh5pitrgqwhc;1:8gz9j9gjr;1:6hdpixvk8whf;2:bimwj0;2:fkigip;1:0ga4iq7hg8gn9g9ah9bjzeo3fldggvhjmjj2kgwoh0phgth1wh6;1:dj0;1:fingj6jgjwjv;1:bjhrhc;1:7ik;1:gio;1:0ni3ha4h6ghgjh6nk7oktpglqgt;2:5lxaiscgxgh9hjgjiuwhe;1:jjjrh4;1:2h34hech6hj0olm;1:8jkrh4wiw;3:7kc8gp9l7cgpqhewh6;1:ujh;1:6sp7hb8hedheeh9jhdqjjuh1viqwf0;1:ciu;3:6lhmj9wge;1:9iohik;1:pjm;1:3m9birciodgeel3hiwjhcrgruhgwh2;2:jkbph8qhg;1:8k99jqdjbegkfh6jkjofupnmqgvwgj;1:jj3plaqhhwh7;3:7jijk7;2:1hb3go4je7hc8jd9joajbcn3dh0hitij1kg6lhgmgzognph5rgquhcvh9wj6;2:8ha9gtciyej4fk9gh9kheuj1;5:wiq;1:djwejkogoppawg2;1:1jo3h78k59h2ag4bj6ehdfk4hhgij1jh7oj9rj6;3:5je;3:ch8fk7uikvjf;2:wk0;1:0jq2k47gz8h49gjqkztkswhd;1:7ir8j89gzaj4jh1kjgngyqjjrjl;1:8iqaj8cingh9hjljgxmj7qhftj1;1:1gzgk0qirrh8;1:iiwkhglkhnhbph9wjf;2:2j93la6g0ahdchafgzjhbkkaqhfrhgsjyujb;1:uja;1:rj1wiw;1:ojy;4:ah9kjg;5:sivwje;1:2gt7j98gw9gmeheqlktkx;1:6kkwh6;1:0jt3hdlim;2:3he4he7ha8iu9gnbmqclceh1gh7hgojh1kjillrogwph5qgyrjgthduhe;6:0ik6h97hcgjxjhfpjwqlcwgg;1:7jb;1:jixsip;5:wkx;2:miv;4:eir;1:8hfaintji;5:8hgrlrthh;2:3h38kj9khah6bh8cg6eilfizgkujh4kjyphbqh9rhdshfwjm;1:iiynmoph1tjowh9;1:hio;1:jin;1:8iu;1:8ikpkh;3:jim;1:6hd8iqdj6pk3wh9;4:8j39h7bim;1:8h4bjzhh8kjm;1:4jp7k6;2:hj4;3:tin;1:jl6;1:3li9inrhe;1:2hd3ha5hc6gk8gp9h7ak6cgjegiggjhjxihfkgsmkenh6ogyphaqh3sjxuqbvl0wg0;2:rio;1:bjjciw;3:iivkhfllinhbph7wj7;2:1jgsim;2:8iujjs;1:0j3jiz;3:4ireil;2:8jb9h8df9ekv;5:wjj;3:6iz;1:cjifh6lj7pjhwh8;4:9jqcgu;1:iim;1:6kcajebgiwh5;1:lin;6:ajjfhbjir;1:dit;1:0iwjk1lhcnj8ojjphbsh4whe;2:8ilgk1;2:0h83h74ha5hd6hd7h7bhecgsdgoej2hg5ifwjgrkjolsnmh5oh1pgyqgwrp3th4uhcwh2;1:4h69l4ajwbirfhggh8hhfiixjhekhgml2oknph4rgsthfuhfwgg;1:4iqfgauk0;2:wj2;1:0iq;6:1kxkgunjiwji;2:1h53kdajhbk3ch9ehcggjhh7kk7mhfpisqkjrgysh5thb;2:0nu1gt3h08ja9itdjtfhahiwjgkmiuphdqharh3thf;1:9h1pm0;1:4iv;1:kk6phf;1:1hd2hh6he9kraiochedirfj6gijhhejg1kj3ljumhcngwpgwqhargqvhdwkp;1:0jkklllhdohd;1:rhhsjptjx;6:0gy4j6;1:hin;1:1h72jv3hd4hg6il8heimcjhdmgeph8qhhrgwsj2tkhvinwj3;2:uhdvj8;3:qja;1:8h39k4wj9;1:1hdmkmrgowkn;1:wio;3:9il;1:dgyel6;1:sip;1:3jw;1:3gw7hd8jy9foagmbjmelafktgh8hiwjfolhaoh9phcrfnsjwtlvuk3vh8whd;1:uiq;1:ej1;1:5iz7jgwhb;1:2ik8h3ahbbhbgh5hheiiljlinjlphdqjlrh4siowjp;2:1iqfinjippiwwir;4:8jcdm9eh2ghchhbtjluh5;3:rik;1:wil;1:iik;3:dgthjq;1:8j2cilehbhh7kjk;1:wik;3:8j8;1:gil;1:oir;2:3im;1:cj6;1:2gt8h99kvbiqeimjhakjbojhwhg;1:eilpklwj8;2:djbhj2;1:8ixbhcfjajimkh8lm1;3:1ik8ixdip;1:cim;1:qjl;1:ois;2:0gq7g58o09o8afsbgpchedh0eovfgxijrjgnqgyrg3sh8;2:ohfqju;1:rl1;2:9it;1:8kc9o9agubhgchcdhgeherhawhd;3:pisqkewh0;2:ujm;1:2l64l7jh7ohgqguwha;1:8hg9iwrix;2:jik;1:tis;1:rjx;2:bki;2:4j67h0ojj;1:ajgfhd;1:7jeah3liksja;1:5iv;1:8jv9g3jizljcrgy;3:1klgiwkhc;1:siuvip;1:4imaiz;1:8hheiu;1:qj0;1:8isfilijcpjkrhc;1:4j58haaixbjachffhfhfgkg0ms8nh1ogoph6rjeshgtkcuh9wh1;1:9is;1:gil;1:ehaqkd;1:dgreje;2:jjy;2:qin;2:ah3uk5;1:aiy;2:1j72gx6hb9iwbj5ch8ej0himmimvjqwhg;2:9jaehd;3:7j4whd;1:8h49k8;1:qjetjhwhe;1:8h2glghgykjkrhd;4:4h08jw9iqah3bjychhdhbfh1gj3hjgijljgjkhgojepheqhdrh6thgvj4wit;1:cim;1:8jhfikjk0rik;1:4ip9isdixjhgwjf;2:8iz9hfaiywiz;1:gitil1wha;1:1jj8hcjn4lkbph4rgvwha;2:8ku9jd;4:1iy;1:biw;2:0lk1hf3jh6gu7gxagqdiljg7kinlinmgynj7ohdqh7rinthfujfviwwfy;1:1kcahbbh6ggejlhkhemhdninohgphcrgpsiluggvjqwlf;2:3hd7jz8hg9jzcj9dfpejkfh7jk4phfqgprkosj6wh9;1:ahbbjb;2:jit;2:9hgajcdngefgsh2;1:8j5;2:6givk5;4:8iv;1:0jb1h52ha3j24mk7g88h8aj1bj5himikdjhdkgnlk9mhgnh8ohdph7qhfthguh7wfz;1:agrfgwgm7;1:uir;1:gja;1:glajh9wkx;1:0he3s69gwigjjhaqhewj7;2:8j9ais;1:0iy6it8gl9mcagwdj8egdfimggpjgzkhenimqk1vh5wiv;1:3jp8h4bh2ehbtng;1:0j74gxaijiniuguwje;1:1h23jv8io9j5aj0chfjitqgrrj8wgx;2:0mcwhd;1:8iojix;1:2il8hcbkqeivgjvjjdsh5;1:1je8j5eiwfgvhhdjgjkioohapj2qj0th0wjc;2:9jdaimcjeeh5fj1jh6wix;3:1it;1:biw;2:jjq;1:1ivjhfqhctixwk7;1:ll7;1:8kacjwuj5;4:kis;1:gobihejgo;2:ak3fh0qj8;1:ajdfgq;2:gjk;1:2hb4n2ahcojawh8;1:0hg2my4h57jh8j69j4bgueh1fhehh5niyph6uh2wje;2:0iy2fc5is6gy7kq9hgkitoh0phgqm8wgj;3:8iwdhe;2:tjq;2:8jzbhedjnehgkixmirrivuhe;1:3jy8gv9jncjheh9jizmiuoheqgywk8;1:kiz;1:9ikdiyfhekj4;2:hjcikojherjxthc;1:7ik;1:bhalkw;1:9iufh2gjfpjq;3:uis;1:7iv;1:qiusil;1:0hf1ks2k54j16hb8gg9h8bjhcj4ejhfgxghfhivjh1kgrpgzqjrsgvtheuhfvh6wgt;3:2k34j47johiojgxrhfwik;1:dikhixjj0;2:6iy7h78kc9gudg4ekmhixil5qj8rgqsjfuguvgl;4:gje;1:7jleipgj5hgojh5siyujqvh4;1:dit;2:ditehg;1:ajlfh7;1:skxwh5;1:2k3;2:6jkainmix;1:wis;2:3hc5m67k9hhcjh6rirwhf;1:8g59kjakhcgtdfzekyfh7gishj6iikjhfrh1ujwvh1;1:bgxkjz;2:njg;3:ggijk3okipirqh9;2:1iy;2:9jd;1:ehgjld;1:fiw;2:uj4;1:ij1wir;1:8j5jhf;2:fjd;1:8hdgk4ij1;1:jjf;1:wjj;3:gjl;2:kiz;1:jkspgyqj3sjc;1:8jzah9bhdch7eirfjrgjjjh4kjjljkphcriyshgwh5;1:fj8;1:qj1;2:9hdnm5;3:giy;3:uh6vjh;2:8gxbj7cimkhdtjx;1:pkb;1:fj0ghg;1:8hgcm6wiw;1:pin;2:3hh8j49gwalebkscixehcfgvgh2hh9kkzlhdnhfqkfsh7thawgv;2:6lawhd;2:1ikkiknj7;1:nk8;2:1ku8ix9haaiwbincjdghchjemhbnhbohcphdrloth3uh5;1:jhhkh2liwninqiy;2:6h5viw;2:qip;1:0jeajyfgwgiq;1:nik;1:bjccjrfgpgh5hmgjk3phhqhfriythguikvhgwga;1:ojkph9;3:ciqjil;1:bj5;3:ah9fjh;3:8iu9h5ahfekh;1:8h59hbblsehgfjhqkwwhg;2:gjn;1:pjqwhf;1:4h8ok3wix;1:0hc1hh3j04h37hf8fj9iqangbh4chfdjfeexfh9ggmhl9jgpkgfnjooipph5rimskbtgkujuvj1wh1;1:1g82izgl0rh7;5:8na9h8ahebhbehgjhcqklriwsh5uh4;1:lj5rj3whd;2:tjrwjt;1:6he7hchgxjh5pgwqo0rjvwj3;2:8iz;1:nik;1:3lkciwjhgojdphdwh8;1:ij7wja;4:4im;1:7h99j2ghdhivjjspgpqilsj4tj1wjd;2:jitwhh;1:8m09fjagfehdgj3hhfjkg;3:vk6;2:bjjcit;1:8gx9jibit;1:0hc1go3gp6h87h2ao3ch1ehefh0gimhhgjitkh1lhcmh1nikpiuqh0sl5tgwuiv;1:siq;2:0iorj3wll;1:1hg4ir5j98ipaiqbh7ciwfjggflhj2jgkkj0lilnj4oj9phfqjesh5uggwh1;1:rkh;2:rj5;1:jjnqgr;1:0j21hg3hd4h97gl8l89jhbhgch9egghh3jj5kgvmmmnikolypglqgwrfjwjh;1:giqwj4;1:3jm;4:5h49itjk2;1:gj2;1:qk1;1:jis;3:ghaqj6;2:piu;1:8is9k2ahebjachgejhkjcwgv;1:0ik2im3im4jf5h56j98fn9g5aimegvgh8kixpk0qj9rg3;1:ah3nl9;1:0kjwha;1:5ikmhfwjz;1:jilsk5;1:1j9;1:wiw;2:3j08hg9hcahcblmegyfirgh8jghwnw;1:ril;1:1gc3hf4hf7hb8jb9k0ajecj2dgyegsfhbgjrhkjjh6kiplh8mh7nhepiwqgwrl5tjkuh6wgc;1:fiujik;1:bikdjxjhgwhf;1:qjx;1:8izjhdkj5sis;2:fix;7:2is;1:8fy9oaaj5dfwem2fgthhgjgorgzsjftimwhg;1:jl6ogwpgtqj5rktwh3;3:1h32ml3hb4it5hf6gz8jrbhcdh6eiwfkpggqhkiijljglkh3lixmhfnheohfph7qgmshgtjkuhdwgd;4:vmm;1:ejchh6;2:aiudgoel3qhbwje;1:gim;2:0eu3mcliwmlgrhguiuwgy;1:cis;1:dioehe;3:kh9pk9;1:1kbjhdkiunjioj1qherixwgg;4:jis;1:1gt6h58m1kgdultvm9wh5;1:gim;1:2gr7hgajfjkbrhdsh0vkk;2:0ja1il3he5hfah0chhfjgggrkilnh7pheqk5rhbwo4;2:jiv;2:1hg7jmaj1fh7hkkqhftjswgx;1:3ir9h6khemjloleph5;1:bhehiwmjarhbwio;1:rja;2:bjqlhd;3:wks;1:9ip;1:3j8aiqeiuqhc;1:8iu;1:jjgwhf;1:0h92jd3h86h97iw9hcbh0egcgj6hkijjckjrliwmhfoh3pgxqgmth8wix;1:rjf;1:fj3hik;1:rjt;1:9iz;1:wil;1:8go9juhik;4:sj5;2:kiy;1:8ky9h4ahb;1:kj9qjs;1:njc;1:wkb;1:4l1aguejufl9ihgugz;2:1jh3gr4k25h76hb7m9ahabgwcj2dhhelogjshhgkgxljimh9nh7ohbph4qisrg2sh5uhgvh9wgu;4:9hdaj3khdrj5;1:hl7rfa;1:1li;1:6imqis;1:bhhkiomjarheuit;1:oin;1:5jtij0;2:4iouip;1:ainqiy;1:biq;3:jiykj0;2:jjo;2:2mf;1:0j31jtkhf;2:ajfbhacj8fjcmk0sgp;3:jin;1:jh9qk9;1:nlbwhe;4:7l08io9jxaj6blzcizegzfgjghbjiukipmhgnh9phbqhcrgzsiuth6uhdwgq;1:bgvcjcqiv;1:aizfhg;1:jhgohaqk3;1:aiqkgxohcpm4;2:3j8fj5jh2qjmwhb;1:wij;2:ok9phd;1:9j2wj5;1:0mz7h2wgq;3:9iyaj0;2:flq;2:khfnhgpmg;1:bjwjh4kiuqhbwkr;1:7hf9gyiiujkeqm3wh2;2:bj8dijlj9rgywjn;2:4j1titwjc;2:8nx9fqagb;1:tis;1:8jb;2:wiz;2:ajzclcfh7hjcjhgrgzvjd;1:cfvrki;4:3ir;1:hhariz;3:6mv7fxwgu;2:jiy;2:lks;1:9it;3:6hggj8pkuwh1;2:ak2ghello;1:8g49gvagnbnzcgojk9;1:8il;1:8ik;1:8il;1:ajvbjych3dh8ej8kixpjnqhcwh0;1:fk2;1:fiq;1:eixjh7qje;3:8io;3:eiy;2:giykhgmjsnhc;1:5j1hirjhepizwiv;1:2l27isqhawjd;1:bhckkpqjs;1:0ks4h0;3:1iohj9jkrrg5ujs;2:1il2iu5hd6h57h38kb9hcaiwchaehcgg9jj8kk3lhbnh3ojjpjsrh7sj9wga;1:pkk;1:jjv;1:3ioaj5uhb;2:3ilbh8dj4rj2wjr;1:3he7hc8gobj3ch1diriimjkbkh7qldsijtjjuhbwgq;1:8in;1:2fj7kwainbjaeh8jiqtil;1:5in9ip;1:qip;2:aj3gipjitljarin;1:0kb;1:8hg9h0ak8bjvgksuhh;1:1g68ja9jfgp5hh3qj6rfqwh8;2:4ir;1:1il2iv3hf5hc6gl7gx8jz9h8chaeh8fgzihfjizkiylhbngzoj7piuqkjrh9sj0uhgvjbwgl;1:ojm;1:ejo;1:6jcuip;2:3ip;1:2hg3jd7h9dhceinjpvphdqfuwh5;1:8hc9ir;1:0gy1gj2h33gh4k15h96j37ge8hd9kcbfsdixfhgggmhh9jlvkh8mhfohepjwqkkrk9sk7tixuggvhawfu;4:jk7;1:9iljik;4:3kh4j08hgbircindh7ej7hitjhfuhfwh3;3:5h3wk6;1:tj7uj7;4:cgztk7;1:hj0;3:5gu7h48gp9l6aitbgzcgzdk2ehcfgygh2hhgjnakhdmhhniuofupmnqgkrhhuilvhgwj4;1:2ir4k18gm9gqahednpef6fipjlmqhhuhcwhe;1:1hc2he3gh4hc5m47j28jo9g0bgbch9dgdek3fhegikhh5ijgjfxkikljsmh7nilogtpgduiyvh9wkw;3:7hfjh9qkc;1:8j6aj1bk5hgv;1:oir;1:4leinajixph0wh9;2:kin;2:uim;2:8hh9lc;4:ajbjiqwhe;1:kkelh0phcqkzwh7;1:6h57hf8h1ehefikghajh3khdlkgnkfoj8phdqh6riruhbvnpwhc;1:jio;4:8jb9l2ahdmimnhc;1:bjy;3:8injhawjt;2:1ixgj0;1:7h88j6akpbgccjxfh3gjhhj8kjynhfphgrhdsheuhgwim;1:8ku;3:rik;3:9j1;2:tk1;1:rit;2:ehbqj7uj6vitwhg;3:5k69hejilriy;1:9jwcinfh4;2:8l09h5pka;2:njowhg;3:nj1;1:9iv;3:ajz;1:bhacimghfhiojjfkhflkcqh6rlvwh9;3:5k5;2:win;6:ah9fjcjjw;1:fjegiksl7ugv;2:jkbwh1;2:ggwill;1:8kr9izejcjixpivsjhth2wh6;2:2io3hc6gv7h38k99izajzch6eh0fgsgg9ihdjj6kjalh7ngupiuqisrgysj1tiwwg9;4:2ki8jg;1:jim;2:riz;1:fis;1:fjukhf;2:0h81ha3h16hf7hg9hfbgmcgjdhbfgzgikhp3ihhjnemhhph8qikrhgshgtltuhfwg0;1:nj0;1:0ha1ku3go4hg6hb7gl8hf9jcafzdiseh1fgthiwiiwjk0klqlh3mhdnh5oh0pgyqimrjosijuh1vhhwjf;1:3h98jqbhffkfhjfjgyqh4ujy;1:6h8dhdojaqk7thfvjpwiz;1:8iw9ghclgfkwjhhrg8wk0;1:dhfeju;1:oil;2:piq;1:1j1fjb;1:0o37hggj8wfa;4:7jagjajhdmixwhe;2:gin;3:1hf3hhamgbgpfh4ggljjvmhfnhhriqsmithauh1vhfwg7;2:aimqjc;1:2mo4hhghdjgtlizogxphdqh0rh1shatm8wk0;1:0gdejcikp;3:hhbrj4;1:4innistlh;1:lj9;2:al0fh6ghasjp;1:8h8bjacixfjwgh5hjiiinwh6;1:0hg1gy2is3gt4gp5jg7gd8l3ciudgeejwgguhj9ihbjfplh9milnipoirpgoqjqrg4tilugqwly;1:9iqciyfixmj8rhd;1:jh8wjd;1:0js1h0kivpis;1:0h11hf2ha3h24h25hg6ik7gw9hgbgreh7gfuhizipckg6lmungzoh0rldugqvjywge;2:rk9;2:cis;1:8im;2:4il;1:biv;1:6klwh8;1:ojzqjr;1:8gx9hfdfyemygjg;3:3mtjipqhb;1:ciy;1:7h28ilakaeh7gh1hikjjqwj4;2:3he4hf8n59knbgxcipeh2ghbhitjiskheljsnhaphhrjith4uh9vhfwgz;1:4laej3lk1qh4rh9whe;2:chcrk2;1:cj1lk0;1:rjb;1:biuhlsrhb;2:8incjhpj9viw;1:jjt;3:6h5viwwio;1:eim;1:5iw;2:ujm;1:fiq;1:0hd2iw3hb4h95hh6he7gx8ju9isag4bjbcjkdiyekzflhgjihiljgpkg9lgqmh7njiqhgrhgshdth7vhfwg6;2:6h7viv;3:njs;2:wiq;2:kir;1:hj9til;4:3hc7h78heahdbjtgkvjj7kh9lhaqjorj5skdthfuhfwhb;1:0jcjgkqhewmg;1:aiujissjsugu;1:0iu7k38fr9lqdfleodhggrgp;1:5g7wls;1:djdmil;1:aisgjsjjmlinrjkuh7;2:qj3;1:3he7hcbjygkcjjckhalh7qjtriu;3:0it1h22h83in4ls6hb7fo9g1akgdjqfkbggiijpjgqkggljmmhanh3pgqsgvth6uk4whe;1:8gu9k3nj4thgwj1;2:bim;1:1hhahegndqk1rggwh8;1:mjsnhc;1:7it;2:lgzrjq;1:0jf1gl3j96hf7hc8m2aisbjacitdheegpfjfggxhimjfakhemm1nhfohbpgiqjyrf7sgxth0uiswh7;1:hh7jj4;2:lk7;1:bjo;1:ujm;1:ej1;2:pjqwhf;1:7kh8h4ehfhlgwhg;1:1h43jr4he6hc7hd8jg9mkal2dh8eg8fgngiyjg6kiylj9mhgnhfoj8ph8qjtrh5shcth1uhfwfn;3:3jg7k5aj6birgh2;1:qky;1:bioeiolj1mk2ngcwj3;1:3he4h95hg6hc7hg8ko9lvah6bk6cgzdhdegyfilggmhhejh5kkclhfoisph4rhfulhwgk;1:0iu1iw3it6h97h98l7ah8bgkcijfgtglwhhbij1jknkh4lgdoivrglsfuugxvhg;1:5itfhfgixkgwllknhd;1:jhfmjo;1:tjuwh2;2:nj9;1:wje;1:1l38grrgx;1:6lahisvf5;3:sktukhvh6;2:jim;3:dj7sim;1:5kmjj1;1:3j1ej0hh1jknqgywku;1:1hbwkh;3:agpfka;7:fhfgh7hkajirrintj6whg;1:jj5;2:0is2k93md4gj6h4dheghfjjvqgztheuiqviowh0;3:vj6;2:0ik2ip3izagwbh6diwggjhisjhfkhdmkgnjwoh9shc;1:8joajybk9cj8eh0fhfkjinherh9;1:5jo7iv;1:hjb;1:1hbahcbhcgjqhnbjh9khcohgqh3rjcsk0wgy;1:cjarh5;7:lin;2:0l93hc4h08jm9guaiwfhegiwuk2;2:9iw;1:9h9dhdejojivwjn;2:ij1wk4;1:1he3hd6li7h38h99iqciwjgrojatjmuj7wh8;1:9kf;2:0io1hc2j34h66hc7gt8kc9l1bjach3dhbeh4fgtghbhitjmakj5lhanh6oguph2qgerhesiqth6uikwgq;2:oj0;2:gij;1:8k9jh7rirwhg;1:qin;1:jka;1:dhbeiv;2:7lz8kq9j4bhejhc;1:2iq4iy8j99fxahgbglchcejrfh6gp6himjk1ogtpjkrf9sgwwgu;2:wis;1:0hf3hebl9cijejlgj3khfnh9ohbph6rhgsizth8ujh;1:gitrjk;2:qj0;5:1hdhj6jijmjxrh1;1:dh0eja;1:0hb1iq2hg8ix9j1aiwbh2ej6;5:8h0hiujjv;1:bkgcjrgjsjkcoh8rh6wgh;5:rio;2:9kxagabhgcj3fiyghajjonjy;1:hfnrkksil;1:tjt;6:8ix;2:0h41da2he3j44h95kc7hf8fq9hfah3bpgjgrksnphbqh7rhbtgnugp;1:9hebjsciwqjnwj2;2:wks;1:0jg;1:qj7;1:8j89hgdivwjw;2:cjedh3ejcjfvwki;1:gik;1:dhbfjj;1:pjl;1:6izrjs;1:8k4;1:dj1jjx;1:2ir;2:2h83j5;1:2j0cikfgzglpqkhrhgsjkuhdwh3;2:1hemksrgo;1:7guojhqj3skc;1:8hakgxnle;1:hhakislivqiy;2:2j5;1:cje;3:rim;1:fjnhirrgy;1:8iw;1:3jc4in8hg9ghak7bjtgkokhduhgwip;2:hh6jix;1:6jl8j1bjpchgdj3whd;1:fj6;1:9imakbfjnghe;1:8jc9jlrh6;1:2iu3j74jh8gy9gzdmpefljippj4qhgrh3sittj4whd;2:1kljgyrk7wh7;1:bjteivmiyrjdwhh;2:1io3hc6hg7hdck0hhejqipioqgarh3uj5wh4;4:cjnjggqjy;4:8j39h9;1:8io;1:9hgcjfril;1:1im3jjcgveiqhimmjk;1:biqhjbjjbrj4wgy;1:5jugishgqjkyqhb;1:viq;2:1h95jwbhgghbjjbmh9oiyqj9tjgwj5;2:2j63h9gj2tir;3:jktmizwhe;1:3ipciw;1:7k6oiowh3;1:gim;1:2jh4go6jq8hbahhihcjhfnhgpjduh8wil;1:fj1gik;1:sio;1:jj4;1:fip;1:4it6h5vjg;3:riy;3:0kpjhemjpoj3qhdwh5;1:0h51g02jv3ha5ir7gvag7bhbcg4djeeghfghgm3hnfihejlvkhdlhfmgunh3oghpgbqkyuixvjkwfr;1:9jhagzciuuilviq;2:5izfja;4:ciwrhc;1:4jg8gxbhbde0elwfhfgk6ijikhglhcon9pgsqhgrijwgt;2:8h89h9ek8fj9tjc;2:9hfnix;5:uix;1:wj0;1:8mmeh3jhcthhwkb;1:dl0efe;2:8io;2:9h2bk9ch8ghdhirkjaujy;1:2jz5iy7jm8j39ivahbck3gh7jh7phdqh4;1:1he3hf7hg8gr9hbaiobn4cixfh9gh4hh3jgnklolh5mhbnpkohapjtqh5rgpth6uhbwfr;1:gis;2:7il;3:wis;2:9imjhe;1:djxegj;1:8jr9h6;2:cisgjh;2:8jr9ilkk2sil;1:dio;1:8jg;2:pkiwhg;1:1ilbhfcjajivkj9rha;5:an5ckkfjfgg9hgwkhfnhfrgtskjuiwwh7;1:uj4;1:ahghjd;4:fiylik;3:1k8;1:5iwhim;1:0kbaip;2:3k6ois;2:2gv7jrbjbehd;1:0jf1h3;3:ij9;2:8ka9ilehahjl;1:8iwbh8ch0disfj8gitriu;1:dhfeju;1:bisdh0eji;3:chajj4;2:5lg7hewh7;3:ujm;1:dh9ej3;2:0mo1hg4h77ky8g39l4eg7fhcjipkhenj1pgfqgurjwsiuwgl;3:0h81io3h34h85hb6hb7h78kx9mpag8bhach0dj5fhbghahhcjgamjknl7ogyqgcrhfshdtk7ugjvh6wjs;1:biv;1:9izehehh5ljlohbriu;1:ciq;3:8h8tjz;1:8il9hgbkcehdfkjgjlpk5rhhthhwgs;1:3ix;2:0hf6hc9izagvbipckxeh8fijhncjiuph7qh7rj2shevh9wg0;4:8js9h2;1:ajdojh;3:giu;1:oik;1:1hg3hc5lq7jo8h3cizehfgiljh5kh9qgmrm8sj3uizwfx;2:9ip;1:8j89h0fiyjjqojhph7qhfrhdwj3;1:0h81h03jo4gy6ha7h18k6agvdkeekigisihhkgrlg4mgxnjzol8pggqfvrkfsh3uhbvilwge;1:8iq;1:4j5;3:3hc4j76h57hb8h89jxciydgwfglggqhkljhblj3nj3phaqh1rgusk0th6ukavkcwgf;2:ahafh9ghfhofjh5tjawh5;2:6kccjghhesiowgo;2:mhboh7pn1rhcwha;1:eip;2:mjv;3:ohhpk7;1:qjowh6;3:0hb1ju2hh4h85h96h4alebfjck2dgxej2girhiojjxkillhfpgwqhgrizsh8th5uh3;5:8imwjq;1:3hf9hcddpem0kiulhamm5rhdujtvh4wij;1:dhaeir;1:2l8lip;1:8hc9j8;1:6h99isahfbk7cjtrh5ulgvghwhe;1:pl3tkuwh7;3:siq;1:oiztjduhb;2:1iv;1:8gu9j4tim;3:bj2;2:fj2ghg;3:jimvij;3:5j6riq;1:aiuciphhfkhbnkmqj1whe;2:qikwij;2:ilajhelju;1:0h01gg3gy4kw5h76ha7h18l29ixdjdeh8fhdgghhh5ihcjhckljmmhnlvog6pg2qgzrgksh5tiuugovixwfi;1:dggejugjdkin;1:jiu;1:8it;1:fjk;4:9irahabj4ckfdhgeivfiu;2:9iy;2:njj;2:jik;1:0ix8h7gjfjk8qh4sjl;1:ajnkk7;1:1jq2kh4ik6hg7ha8gq9hbbjrcjbfh9hj4kh3ohcphaqk0rinsgwvhawhd;1:3jx9hggh7jgnolgrheuiswkc;3:rj9;2:hh0rk3;1:7ki;1:6h9phdqld;1:fh3gjivim;1:wjc;2:vil;1:1h27hb8h2ah1bkuciwdhbfjfggdhk0ik5jh2lh2miunj9ohaphbqh7rkhshhthbughvjcwj0;2:aim;2:5j4bkjgij;1:8iqejx;1:9keaixdh3fgygkrjh4rjbwgu;2:cj9rhd;1:giu;1:7ltdixjhewh7;3:9jxihfwjl;1:tkm;2:8j4hiyuj4;2:0he3h74hf6hc7gf9h6akfbh5chffg4gh9hhbjhekm0lk7mh6nh7okrrgcthbujnwky;1:0h93pg4ip6gz7h58in9ikahebh6dj6ef4ggsjh5kgplhcmhbpgaqjsrilskmthhvh3;1:8j7;1:ilfwhg;1:oio;1:0hf1iu3k15it7h29h3ahgbh0dh9fh8gh2jg4khgmhbnizohdrk5sh3tjhuh6vmjwh0;1:9ijbiloiu;1:8heeiulio;4:his;2:5iupjc;2:0h34gxilqliwwje;3:jh5pm9qjj;1:riw;2:bhbciwfijhj4;1:9iyaiwfhcgiphin;2:aj3fh2glsjh4qkerh3sjnuhbviowh3;1:bh0rk8;2:3jqjgtrikwjy;3:vj1;1:1hg2jt3im4iq6gx7ha8gnaj0bhfcj6diweh9fhcggmhgtiiujlmojaph3qgvsikth3uguvjx;1:8h8gje;2:bj0;1:hj2;1:aixuk1;1:dj2sj5;4:2ji;1:gj9wjm;1:dh4ejejg2wkm;1:bio;2:7ji8itjleohaqh4;2:8ha9jd;1:fh6hkuuh8vjb;1:oix;1:4j2;1:1j73jw6hf7h08h6ajghj7jh8nhephfqmcwhg;1:sjo;1:2lfjha;1:ojn;2:9il;1:diuuiw;3:rjo;1:3js5lr6h7hjpjg1oj6qhgwja;2:8h39jk;2:bj1ljq;2:jin;1:8iu9hd;1:diq;4:qio;1:0h92j24hf5hh6jt8hg9graizbiudhgegkfglgjdhjhigwjfwkgklhfmjiokhpgrqizsj5th2uh9vgkwl1;1:eis;1:8j49h5an3biocgnrhhsg6wis;1:1j12iq3gz4h75h96gv7gh8kp9jtbgzdjbejbfgggiuiirjhakjxpgnqh9shbtiyvgnwil;2:1itej8jiwvha;3:0iy1jl2h93h04im5hd6gz7h6bkzfhgghbhhgihgknclh0nh3ogkqgpshduitvimwhd;1:gimjherh7wkj;3:3k78hfblmfglkjhvj2whe;1:jh0qjh;1:5lt7kfqh6;1:9ix;1:0jjdiuehgjis;1:8hfgkt;1:kjl;1:eix;1:7ix9gxakndhaegqfmgggxhikkhaqituhgwgw;1:dhgek0;1:ljbogswkl;1:1gs3k57is8j1ahcbh4dhbeivfgxghchh8ihakg8lgxmhboheqjargctlkujf;2:djejh8;1:1gl8g59kcbhfkmdmkgoh3;1:4j68h99hdahfdhbeh2fiyjh0kktokergvtk6uiy;1:8j1;1:fj3;9:3j18kcbhddheej9hh9iikjhbqjwsiv;2:6j2wji;1:2j8;1:7j7kjd;1:cip;1:0ik2is3io5ilahdditggohiwmilnhcohg;3:wir;1:aik;1:akj;1:0hd4it;1:qim;1:0h12ju3il4hh6kd7ki8gq9h5ah6bh4dlzfh4jh7livph1rh1sjathaugsvj6wgz;1:llinh0;2:9jddim;1:1is;2:5kp8jrjhdqhetleuh1wha;2:8jf9ilbhdikdjjikgpnl2ohfuh3;1:3j8biodgqej9;1:uiz;1:0iu;2:cj3finrhd;1:3gz8l89ohbh9cilefqghbhhgjirqhfrj8tjbuh2wh1;1:8h6blcchedgzejwfh4hio;1:0hg1ik3og6j57h1ahabh8clfggwkhfmivoiypgvqhbriovhewfm;2:7j3fj0jmckm6lfyphfqhhwfq;2:0ha4gzikp;3:8h4tkl;1:3j2jj2qh5;2:bkffhagjlhjujgzojnqhgwjg;3:6ji8gzagwbjbdinkjtqhawjx;1:bh9dh7em1fl1ghbrh6uim;1:lj6;1:1gx3hf4hb6hf8h1inxsj2ulswhe;2:3ip8kl9h7bhdjjfmjephdwh5;1:ah6fli;1:2jf;1:0j94hhcgujjc;1:ijnuhg;1:8jvbhgckddinfhggiuqh7ugnvjs;1:3josikwhh;1:0o71la2hg3h87hf8jmah3dileinih8jgqkgdlhemhaohcpgrtheuhc;3:ojc;1:2hd6jc;1:8ha9iu;1:0j3;1:2iudj3ghf;3:0gz3hc4ik9j8birdkbejyfjwggtihgkilmhbnhgph8qhergvuj4viowgn;1:3gy5h58isagpbh8cjzehffhdgj1hhajpxph6sh4thfugnvj1wjr;1:ojd;1:rjn;2:9inrghtma;2:djdegsfit;1:8fztkv;2:flkwhc;1:1gx3k26hh7hc8m99h3aiqbizcloggjkh5ohdpipqh4tjqugqwfz;1:qju;2:1hf8hgcjmggqhkm;5:rip;1:3im8hf9gzjhgplwwir;2:4is;5:2ji;4:6ky7hg8h7jhgkjkml4oj9phgqh7rhfwgk;1:jimtio;2:dj1rij;5:oil;2:8jp9ikaheeh8ghchh0jj9kizlknmhfnjpohdph7qhask1wgk;2:0h88isdiyegmfipgkdhgqjjvkilqh5rk8siq;2:1iu;1:miu;1:1j83iy4hc9hfjh3kiulj7shewgh;2:eik;3:ajdjhboj2;1:4j1fhdgj4;1:5ixwir;2:lheoj5pk2;1:3imfio;1:3hd8hhaj1binegnfl8ghahj5jhgkhhlhfnhfqhfrj5tkfuk1vhg;1:aj7ghg;1:jiz;3:aggchbfjmhhejj3nk6qixrje;2:5je6ikrjlsjptj1whc;2:bj8;1:bikeiy;1:sisvio;1:cisdkbeh5;1:4miukawha;2:8it;2:fiq;2:4irahffhcgknlh2rk9;1:8j8;1:5kx;1:qjcwko;2:6hgpkxwh8;1:ahbfjp;2:8h09kech4ril;1:4hdah8qhftk3ukcvjb;1:jj0;3:8hd9j4cjskjfwhg;4:0h82jx4lsag4chahexjhfmipogvphfqjkrlnsilwjr;1:hklrh8;3:ah9fh8ggrho8jfzwkf;2:gjj;1:giu;2:jiy;1:3hd8ju9m2akhblxdh4eg5gh5hh8jg6kj4lh5nhfqiqrgvth6uhc;1:hh2jjgqjcthe;1:0ir;2:0h71h43gx4hb6hf7hf8ft9geaorbh0cjhdgiegkforgjqhkkjfxkkxoh9ph6qgkrgnsh6tgxugyvh7wis;2:0hc3ha6hc9gtag7bmxehehhhpllql0rh7sisuinwfj;2:ciq;1:mj2;2:4is9gydlqeh7fjfjj6rj9th1uj4;1:5jm;2:9giakabjxgkt;1:sis;2:1iv6jp;2:6gmdikfjtvjmwhg;4:cix;4:gjl;2:8k3aiwdh5ek5jgqwhg;5:0ixjk6;4:8h7gkw;1:lix;1:0np3hajhfwhc;1:dj7egv;2:jja;1:6gvvj7;1:bjbehc;1:wk2;2:1hc7hb8kb9j0bjhcjhfmbkimmhfnhcphdrf3wgm;1:8ix;1:ciu;2:8imhhfpiutj1;1:mjk;2:2iu4ir;1:oij;1:9j7;2:bjiwiy;2:jiqwj9;1:gjjihf;2:aj5;1:1jdrh0;2:8gw9jipin;1:8iw;5:0j8;6:oh2pj6;1:7lxjgsvgm;1:ejt;1:1h22hd4ja8hgdioehajggkhflgonhholxphaqiurivtjgugywl3;1:fhdgjlqk9uivwgu;3:ghajiwujf;1:9jeahgdh6eimij0skitha;1:qjd;2:2k03jq4k25hb8gyaguch0ghbjgynh4oj2pgyriwwjj;1:8k7fik;1:pj9;2:8h2bnzrhbtixwha;3:jj0wh8;1:gjo;1:0hb1hc3h94hc6h97iz8hb9h9ah2bh9dj9fqogkchh0jh1khhmhanh9ph3qh3rgnshgukcvjmwg7;3:1ko6hgrhfwkc;1:rj5wh9;2:ah9dizjjskjawh1;1:tj1;6:2ildhdjhbomspgjuil;1:8joahcpik;1:ij2jjjrh3;1:1jq5h18ijkhdojmwjo;1:4iw5k4ahgghghj2jikmjgoh8pgvqh6rjm;1:ojjrjh;2:wjm;1:7iojh7wjv;2:kglmhdnmbpiq;1:ciojip;1:9ilqkm;1:3lg7hf9h8jhgqje;1:ciqjhg;2:fgehks;7:2m87h58isajlbglfgkhkkjljqgzrh1shewhd;1:qix;4:ahachddhgfh6ggxho7jl8qjyth6wgw;1:wjo;1:gijhjkjgrmiywit;3:8iprj8uis;1:0ha8hhchefjahhdkhfpjorjguhfwjh;1:6kmwh9;1:1gy2h23j25h77jm8jyagqbgiclkehcfk8githgtjjdkhhlh8mhbph2qh4rkbtjmuhdwgc;1:ij4;1:7h98h1airbk6cithjxjh6kimnjnqiurgssiwuh5wh9;4:2j9;1:0iz1n66jkkggmh4nh6siqvgp;1:8il;1:bivcip;1:jh1qld;1:ckdhgvrjx;1:9imjhe;1:5jpkiophbqkq;2:wj6;1:wji;1:0ja1h3;1:uh4vk6;1:1k94h9ahgfj1gisiiykhfnj3rgo;1:7jx;1:8jn9kkaizbjkfjdggxkirnherglwgr;1:bk1cguhixkiz;3:kj7;1:8hc9itbirdkiefijhcrjv;1:8jebj7jhgvke;2:agzfgogm0hm6jh4pj6rhasitwh5;1:hix;1:djeehbfgtgl8hgcjkarhfujvvgvwiu;4:7jkjkmwg1;5:4k8;2:givjh9qjt;1:7k1;1:oip;1:hhbrj5;1:jjcmj9whg;1:8j1sk1uhb;1:8j6ejwhh9rj1;1:ciu;1:ain;1:vju;1:jgzwlp;1:1h02im3he5iy7h68j99fsafwbgjcj6eizfgzgmfhkkjimmiknlfqh7rgjsh2th3wgm;1:pmisixwgh;1:1im2io4im6gl7lbdhefiqjh7phcrhhsj0uh6;1:0h71h33gx4h65il6gu7ik8ikah6bgsdjaegwfmagmnih0jfxkgylk4mhfnh6ohcqgrrg3shguktvklwh6;3:1iwfjnghfwj0;1:pk0;1:7ishjuuip;1:7h3ljwojk;1:qj7;1:2hh3h44hg5iv6hg7j78h09ikaheclhdn4eflfh9ggxhhgkh8mh7nh9ohgqgdrixskcugvvhfwka;2:3ko4kkcisdg5em8fgijhgoj7phawh4;1:fj9wis;7:6h8vis;1:8hf9iodl4egm;1:pmcrilwgs;1:8j69k0ajvbkrcjeegyfgfjgykj5nheqikrh4thewh7;1:8hc9hcbgqcgxdjien8fjcgkbhhgjhcrimugu;1:9iw;2:2hg4jp;2:4j1;1:1irliv;1:2k03h54ko9k4jhcogupirrhatis;3:ciuhiqijc;1:kj0lis;1:3he9iufjeik9jjgwfy;2:jk4;2:8jxkhd;2:2mc4hd7j58kp9g3agxgjfhh2jjbogvrj8wgt;1:fin;2:9jb;2:tiv;1:6imsiy;1:0j01kx3lz4jg5h36hb7h89f9ch6dlmefofgxgiohj2ikbjhalhdmhbogmpgvqhcrgisiuth6ugyvhbwk4;2:3ir5iz;2:7ikij6;1:ciq;1:oip;1:wit;1:1kdnk5oklpgwqhgrilwh9;1:cj0;1:qik;1:dk4jikrj1whc;1:0ip2jj3jv4h9bhgfhcgk2ijgwh7;1:bjphjioj7rk4;1:djgehf;1:1iq5jc;3:aj1rjr;3:0lw8hgej7jhgvhawh6;1:kjprhb;2:jizqjq;2:dj7;2:8j1;3:6ojgj0ohgqhewgx;1:2lawgy;1:iji;1:1j1ait;2:hgnjjr;1:rg7wm2;1:8io;1:jjm;2:jj2;3:3he7iw9j4ck4djjehbgheqhdrg3tk3ujbvjbwh5;2:4h86jr7hfjguoh8pgrqgurh1univnwwh0;1:kiklir;1:oiy;1:dhaej9;5:jkcphc;4:4ip7hc8imaj4ggxhjfjjbmj3pgvsj0tiowh2;1:ijw;2:jhgmjwnkfwha;3:gilnis;1:mktnkjwfl;3:8hg9itaizjkrogvpgsqj0rkkshdwgw;6:ug9vjxwjq;1:1h5bjlriw;1:0hc1g62h53gw5h87ja8j99ikahdbkmek2fj6ggfihbjgqkh4ogwphfqglripsjstk2whb;1:sj5;1:8k0fiyjj3qhawhg;3:3j2qjewhe;1:5iv9iycileixjhdwja;1:8in;3:fgzglzwh8;1:wip;2:ciy;1:him;1:ghbtjy;1:mja;2:hj1;2:biq;1:ejgjlhqhgwip;3:dikjhbpngwgc;2:9ioamcfh7gg9jj7wk1;2:9geejirk9;1:aiufjrkhd;1:nioojj;3:nim;1:hj3ikvrimuhc;3:7jd;2:kjylhh;1:1h84jkoh8rk9vikwhh;1:wjg;4:ejjhimrgy;2:fj0;2:8jkah7;2:1hf8jy9ehah4ch9ehggimhhbjh6kj5limmhcno7ph2qh0rixtj8wik;1:0hg3rw4hf9grciligijh4phgqhhwk4;1:3hg7hg8he9iqagdcl4dh8ejsfgyhgmkhfljvqjbrj5;2:8k89grclugijrga;3:fin;3:1gi2h43h94kv6h48jq9j8bgxcipfgxhhelh7mh9ninoizpiq;1:0ka2jn3jkjfkqh7wlr;1:7lp8hccixhiwjggogupjiqh4rlbwfq;1:8in;2:ij0jj6pj9rha;1:bhejj4kks;1:dinsim;1:ajnjjcuhbviswh4;1:1kh3im;1:ojsuhe;1:1jg;1:gioohapiwrik;4:8is;1:5ft7ki;1:aiqegxgglikhrhcujtvkpwh9;3:4kfiiloh8piowj3;1:6js;4:jk4ohepjg;4:0hf3hh8m79lzjhdrhewhb;3:niqwk7;2:fiqtiq;1:jjh;1:1he4h26ir8hg9k5agmbh0cl3firhhhik7jizmirpheth4uikwgr;1:2k96ix8jo9gqailvizwhg;1:uiq;4:siruj5;1:6he8k69gpagybjugh1hjojgykk3mj7phbqhetjouj9wh6;1:8ikhk7jgwqhe;1:1k1rgc;2:kj3;1:jixuj6;1:8ioaivjgwrjvwjw;1:sil;1:8iz;1:eim;2:tilwk1;1:7in;1:aj4cjefh5rg8sjw;5:aix;1:4iw;2:1ip;2:1jp8hbaitjldrh5whg;1:1h23js8j6bjigh9hhfjj3mktnhgphfrfttgzuhfwn5;1:ciz;1:8js9h2;3:fip;3:iinoj8;5:aiwfjbhinrh3;1:fh5glh;1:qjl;1:jh7qhdtjfwl6;1:oj1;2:9hcekc;2:8h6bjmhj1jiskhgqj4rhb;1:8iw9guejahjhjhftk8;2:win;1:bja;1:mjc;1:dil;2:gheij4khblh7nkkplvrhg;1:0k58jaah3ljrrgmsjcwgz;1:bjxeh9hiu;1:jhbwja;1:8it9h3fikjhfoitwjb;1:cisij5;1:2h26h97isagmbh7fgagp0hmajgspiwqh9uj2vj6wgj;1:3j3;2:8hcbkneiugjejgnohgrhgwl8;1:4j5jhe;1:6he7m28g09koagtchbdgpeikjmynk4phdrh1vfzwh1;1:cipjjb;1:aj9fh6;1:9j5;2:wj6;1:dhgpjkvkdwhg;1:aiuelm;1:1hf3he6j48ja9h8bhahj2ij9lhgphfqjurjvsh3th8ugjvj7;1:ij8;1:8jl9he;6:wip;2:8jc;1:0nx8h7bjpcj8jilqhdwgq;4:0iw1h42hc4h25hb6he7h1bh8chfgk9hhciitlj1mh4nj6rkmsh7tisuh6vhfwk1;1:hjajjh;1:hh8qjg;2:0h94h86ipbj5chfeiyggjmj7ngqojurgxtj1uhg;2:0h61g72jd3gt4kd6h77go8gfbh5dgufh5gishh7jkjkgolgzngwonjpixqk6sj6vh7;2:8jd9j4jgi;1:8h9ehhrjr;1:7k1mjnthg;1:fjhuikvjf;4:6jp;1:oio;1:3h36in7hb9gyak1bhfgh6jlckhfljvpkkqj2vhewft;4:bkngk3;2:ais;2:akacirfldgh1ojiphd;1:8pc9f8agrbivdp9efhggmkh7ugv;1:jil;2:8ikkj1;1:6juvgn;1:9in;1:oio;1:0h91ha3h74ij6hg7hg9heah5bh1cgzdhgehffh7ggjhptjngphbqivtkeuhgwg7;1:ajd;2:0hd1fv2gz3gn6ha7gx8lt9kzam3bghdnweilfg5gk3hiqjfakg2lgungvoh0pgnqh4rhbtj2uj0whb;3:aj7;1:djwegmqk7whf;1:1it;1:0jj;1:qjl;1:3hf8gnehcjj3mk3oknph4rh5th6um0wgc;1:0h91gu3h55hd6h67he8gb9h6agfbh6clafh4gjehspihfjkblgrmhfnh6olepgrqjgrg2shguh7wf8;3:jim;1:8j99im;1:2hf3hb7l88le9gpailcl4dinegzjh3qharh6tj9wgg;1:4j4;4:3jm8heuj8;1:mj0;2:3j28mm9lsaizcj2dh8eh9fhcgh7hgvjj9kh3mhaph7qirrgmth9uh3wgv;1:6hh7ha9hddkmejgfgyghcjm0nipqgvthduixwh0;3:1h43hg9ikbhgch3diojgjkjpmhcrk5uklwhg;1:0h91hc7gm9ggahabgzdjxem0fljgl3hh6ihhjgnlh9mhcnh1oh0pkuqh9rk5uhfwh9;2:agkfg3wlv;1:nik;1:3gc6kf7h48h69h6eh5gg4kiplk5mh5nj5oh6pgwqjkrgpskmtipughwme;4:3h38kw9j6depeosfh7ggohjrjh6risuhh;1:pik;1:rj0;3:8kj9g0ejcnjoqhgrhcwjy;4:oh2pj6;1:9in;2:hh6riw;1:eiy;1:al2djbegsghfrjksjd;1:8iweix;1:rjv;1:gh2jjd;1:mklwhf;1:9iywkh;1:1ijrit;1:tjh;1:0is;1:0iz1ko2j03h37gs9h9eikghehh5kijljoojrpitqh0rgosh2tiwwgo;2:0ksdj1eh0jhbwj4;2:0j43ky8hgbinwh5;1:eiskhcljbmk2uhe;1:qjzwhf;2:4jkij1kiq;1:1jl2h73hg4ga5gw8ha9jjbiqfgugmmhiyjh9kgulhemjlnh1oh1pk4qfkrfhsiruilwj1;1:lj1;3:pjb;1:pk2;1:4ik8h4ghejjvqh6ujfwjn;1:3js9h1jmqwgp;1:khblmo;3:sin;2:0io7jbfhcgiwmj3niyphdqh8tk1whf;4:0jc1gr3jl4h96gy7hh8hebh7dj2eh6fk0gjfjgqohepjxqh9rhdujpvilwjw;1:9ik;3:civrhawk5;3:8ij;1:dj0eh3fjcujt;3:bixijk;1:2j79j2fgfgk3she;1:3ik;1:dil;1:giq;1:hiljiswhd;1:0ha1il2oc3iy4ke6j57h3ah9fhgjh2pgpqgwrhhvhbwjm;1:4im;1:3jz4in8hc9h5ahgdntghejglqhgrh6uh6vjqwgz;5:8gr9jbdjkegs;1:jiu;1:win;3:jl9;1:6hg7he8h59k2bj5ch4diofh1hhfjk6khfmhdnh5ohdpjaqgerjusgstisughwlk;1:dj8;1:gjbqix;1:8j5jhd;1:jil;2:rjo;1:chcwiw;1:1k8ah7bjboh8rkjwhg;1:bix;5:3k34il6h97ko8jq9hfafzdhheisfhegk1hgnjkoohcph7qgmrhhsh5thduhawkm;5:jgvogupl3qjgvl5wgw;2:sjp;1:9j2riq;1:wip;3:4h46gwah3fheogcpivqoguha;2:qj9;1:6lgwha;1:6isfhbgj7kgqlmungvrhavhbwk9;1:0iw1h83h94h58kg9h6aiqbgydh4ej1fgpgguiiqjlakghlgymh9nkrogzpj0qh3sjavh3wkm;1:4ko8gx9jgjha;2:njy;2:ain;1:0kg2jeqheviywh8;1:qjr;3:1jf;3:8jr9gyahgchbej7flcphgqjdwip;1:fj2;3:8jguh6vjc;2:8h09k1ahfgjenilqjqrhfuhfwhd;3:8imgj9;2:rj3;3:8kd9kiah4;1:jh8pkfqh9;1:wj1;1:sin;1:jj7;1:6h9mjhrhdwk4;1:3n3fg0hj0;1:8il;1:3mc9hbihg;1:1is;1:5jm;3:0h91h62hg3go4gx6h47h1alpchadjtegtgknjh4kg4lh5mh5ohdpgoritsjmtkculxwfm;3:7he8hd9jfah7bjoch9dj5gh7ikcjkmph4rgesjmtixuh4;1:jh5qjprjxwit;3:ciy;1:3j6uhcvjhwjg;3:8ktehg;3:1iw;2:tik;1:hjf;2:gh9qjv;3:0ir;3:0in7h3jju;2:0js;2:bk8rhevim;1:qiq;1:8h4oj2ujg;1:3nfphfwgk;2:rkh;1:9jb;1:3iofh9gjc;1:4iv;3:4kcuhd;3:3n98hddiwfhgjimvhewiq;1:8hfeh6ulwvk0;1:ujk;4:cgkrk4;2:3kj6hg7hddiwhisjh4lhhoofpgyrh8wh3;1:0gx3kijirkj7whd;1:0j01kl3oa4gb7ir8hdaj8bh8dhgehefjaij4jgkqh5rgiwga;1:ejkkjh;2:6lgwha;1:0oi6gv7hh8iyjhdpheqhcwh9;1:6hdoiyuh7vm6;1:8j5;1:lj4;1:6gj8g7ekzghehj3ujtvjg;1:8j1fip;1:1hf3h65k47lz8giciwehbjgtkh5mhgohfqgurm1sjeujrwfo;1:kj1;1:5k3pim;5:fke;1:9je;2:3j4qj8;2:hj1;2:7iv8itiinjh8pjaqj8;1:0j4klcwgu;3:sjj;1:tim;1:8gj9jkbk9eimjh8rkk;1:uil;1:8iu;1:1gj3ip6j17h79g5afydh9eh7fjlgkvhiniiyjjakhflhbmhgqh3rm1thg;2:hhbqj4;2:8j4fj2;3:1jh2h2wkn;1:dj4riz;1:kj0;2:8j5qkfwh4;1:0hd1kx3hb7jk8iweinfh4ghejfbqn9rfswkl;2:9iv;1:rix;1:kjhtik;1:9hfnnn;1:0jeej7fh3hh2ujo;2:5iv;4:4jrwim;1:ahfbjk;1:dh7eizjjp;1:8ip;4:5harke;1:4kcaj6fhcgh4ihdjherjnwis;2:1iv3kb;1:8j4aikbjqdhdeinfj3kj2nh0qj2;1:bipghbwj6;1:lj2rhf;2:wj6;1:6ixdil;1:djueglhio;1:0h53ha7hc8oe9nhafqbgschfdh3eo3jgllhgqh3rh7sh9wha;1:0j11hghitiik;2:ckeegz;4:4it9haaimckojhgriltj5whd;1:liq;1:oj5;1:al6gh4uir;1:5iv8iq9ggjl8mgsnkfphawk0;2:jix;1:0imrjh;2:3hd7hbbk0gkzjjdkhalgzqjrrin;1:ej4qil;3:fimnj2;1:4jc7ildhefilghejh1kl8ohfphfrhfsj0uha;1:9hgdncefgfl3phgwhf;1:vik;4:3ik;2:3h84hg5kk6h28fv9m5aisch6dkceh9fhbghbhh8jm1kguohaph8qjztgvuj9vg9whf;1:piztip;1:jj1;1:4j18l79gockzeh2ihcjhetjeuhgwh7;2:filnil;2:9j1ahabhchkd;3:vip;2:tjq;4:4kkohfqjv;1:qmuwh7;1:pit;2:2ff7pvojaqghwh2;4:jiwsj5;2:2kw4gqujovh2;1:4iy;1:1h43jreip;2:tip;1:0hg1gw3hc4gx5in7hd8h69h9agibhechfehgggphfojhfkhalkumkankdoj4qh1rfcskitpqvh5wio;1:jk9;2:jh7wl1;1:7h68jq9e4bjxdgufgxjhgkhhrhfsiztnuujtwha;1:jh5rke;1:1g62hd3ls4gn5h86he8j69gyaiqbkncl5djdegggjlhhgijsjh3kgflh6mh6nh5oh9pipqgerfaugovhbwko;3:0hbdjmeguggpilhwjo;1:6he7kv8fq9l1ag3cipehgjlunk6phbrgxvfz;2:6iu;2:lj7;1:8he9iqwjl;1:8inoiq;1:djlehgjj7;1:4l4ph2wh7;1:wil;1:qkbuhgvin;1:giw;1:3n97iz8gybjnhhbiijjh5qhfriuuhfwgs;4:ljrnhhoj3;1:rjatiw;1:4it;2:kiuuip;3:jirwk2;1:2isghbjj4sjj;1:cj5;1:cfurk8;1:fij;1:9ik;1:aje;1:gik;2:hgprjg;2:tiy;1:8kt9hcgiq;1:6jxdhfeh1;1:aj0tiu;1:jhawjr;2:1j9;1:pk5;4:jjb;1:jgmqj8wk0;1:ej4fixuim;2:3ky5je;1:2jz4gv7jpah6djbegnfhajh1khdnjgokqph3qh1rh7wkc;1:9ioghasip;1:ej7;1:8gy9j5kj5;1:wit;2:8jm9h3;1:hippiz;1:1hg8go9g9agybnmcj2fjtjgqkgqmhfohbpjnqharlzthc;1:2im;3:olhpfz;4:1jfrhc;1:skkuhh;2:dm4eg4;1:pmlwgi;2:8it;1:0gs3ha4io8h49itahdbischhdkzel1fkbggmhilihfkjemh6nhdph2qhcrgtshfuizwgh;1:9ipdjseggjhfoh7rilwlx;1:6jznipwgs;2:jkc;2:9hgajmcjcgh5pis;1:bhchj6nj5tim;3:2k86jr8jf9h0vizwha;1:8lg9fjbj2cizgkorh2siwwgt;1:2iu6kgoj6phariqshcwhf;1:3iw;1:8imajwfkckhfmj2phcwgu;2:rjm;1:8j3cinwjp;2:bk3;1:fjgqjz;1:ojf;1:aja;2:aj0iim;1:8gaaj7oiwritujc;2:0kq1js2k93it4jk5jh6h7bh5dheginhiwjizlhamhfog8pgvqgcrh8th5ugrvhawgy;1:5k5hgvrjy;2:jix;1:9ik;2:hk9rh7wj5;2:airwiy;2:3ji8h4wk3;1:8iuriytkawh5;1:jinqissikwhc;2:6gi7lpqikwhc;1:gj4;1:6ga8invgywlf;1:8jodh3fj9gj4qjvrk4uh3wh5;3:mij;1:6ipeisflk;1:8inpkfqh9;2:4j38j4jhb;2:8ikuiz;1:3in;2:2ff7pvqgiwh2;3:eiqljg;1:8j3mix;1:dhfjjwuj0;1:7hgaheghghj7jkjpgxqjvsjt;2:5ixwjb;1:5l6jjf;1:1hb3hb4jr5jf6hf7jlbhgchbdhegj0jmdmjfnhfphfqg2rjgsgcthewhc;3:0hg3hc7hg8jg9h6akubkjcinehffgwggwhh7jhgkk4ll1nhcphdqk1th8uh7wgp;1:aiycjwggpsj9;2:2ik8hcbkheivgkl;2:mjcrhe;2:cin;1:wjy;1:bim;3:vin;1:8fb9m5agxbiydizjgyqhatj4wlj;1:cjd;2:pjl;2:9ixaimchdfj5giohikjjkrjiugx;4:dizriw;3:wiy;2:6hd7ldbhhjjbnjyoiuphfskmvfwwgr;1:uj9;1:1kymj3wjc;1:0ivcj8;3:6j98ipbh8cjcwhg;3:2lm6hc7iu8io9h6ajccjtfhcihhjgyogqqk2tituhewgq;1:uin;1:4jr8j0bl8fhakj1lh2whg;1:4jncil;1:4hdij0;1:fhdhk8tio;1:4k5iit;2:ljlohb;2:jj1okd;3:kgznjm;1:qj4;5:giv;1:8hfdgcely;1:5is;1:aimlio;1:8l99l3aivbh0civehcfhfhiwjherjnwh5;2:jj3;1:3iz5ha9j9bh9chfdj4fh8gj2jkipikqgrsh3uhawjl;2:rghtmb;5:1he2ikwj3;3:4iq9iwwjn;5:6in;1:dj1;1:lkx;1:sj8;1:8hdgk4;2:ljv;6:kg3monnh9tk5;2:rj1;2:ekcth6ul5vh9;2:wis;2:hjvuip;2:jjvvjh;1:0k76h4;3:airbilwij;1:aj3;1:ahaqjhrjkwhc;2:uj4;1:pjs;3:khgljrmixnitqk8wgi;1:8f19lzah3bj6cghdj0hjvjizwiu;1:aj3cjfjgu;1:8j29ha;1:jjmojkphb;2:aio;1:uin;1:0qm1il3ik4l86hc7h98h69hdahfbhcehdgh6iizjgkkh6lh7mhfnh9okerh6thfuh8wfq;3:0ko1h83kj4iy6h79hfdjvej1ggyijzjg9phbqjbsgdwgo;1:1k8;2:6l9aj7rhdvgk;1:3iraj9ninqiurh4;1:9imcio;3:pio;2:0gx1hg4h96hg7gz8lk9luak8bg2chbel4fgogh6hj3jgkkgpmhdphfqhbth1uip;1:8habiqgjrhjujh5qm0sgx;1:0js3j94it8j59iveiofhfgh9ijtlgdphdqjjrfgsgewjb;2:wji;1:8jjehfjgxrltwgy;2:ch5rix;2:1h03kr8ke9iobj5cj9fikgh9hj5jitqgprimtheugswgq;3:0gy1h52ha3jb4h25io6h08nc9g4aktbjochadgbeisgh0hiwigvjh1kg3lhfmgpoippjoqgyrjmsiutgvuhbvh3wjw;2:tjcwj6;1:6haij0nizoinph8qkv;a:nil;1:1ha6he7h08jb9jdbgtdftej4fgvgj1mjrohcqh2rg1siwthcukavirwjr;1:oiv;3:1haditqn2wgy;1:cj9;1:4j3;1:pjaqj7wh7;2:1jb7he8g4bhdegzhhcjlvqjdrgntojuhbwgy;3:dixjhewip;1:3h34j76ge8h1jhanjkpj0qilrjgsh2vmuwhd;1:4it;3:ojm;1:2h57j7ajkfhb;1:2gw5he7hg8ja9jlekgghdhh5jhfkhelhgoh6plvqhgrj3tguvjf;2:1gx9k1agxcj9dhbehgfixgivhjwkhblhfmhgogtpjoqhfrjotkbuhhwh5;2:pioqiz;1:8ga9mvaisdjeelngh3hh9kgtmjxnhdqhargysjawh3;1:nijoiq;3:jjewjc;1:rim;3:1it9jakj0;1:1issin;1:wj1;1:8hh9ikfjjgjpwh8;1:oio;2:jghsk0;1:6gcvjr;1:8f99kraj7djcehd;1:six;2:8jhujg;1:3kj7he8mv9mnah1egefh2gh0hikihakgblh8mhangypjsqgrrl5shbtimvhawes;1:3h06ob8im9fkehdjh5qhbtheucgvrg;1:gim;1:8hb9j8bh3giowkj;5:fil;2:5h3jjyqikwin;4:ds8ecajgtvjd;2:til;1:9j1;2:jil;3:tio;1:cjcdir;1:7ij;2:lilqjz;2:1jc8hfaitbileglfk3hhgrhb;2:fipjhcolb;4:pij;1:9j3binjhdok6;3:4ivujl;1:biv;1:2n64hf7kc8iqjhdrhbwh4;2:3ir;1:4il;1:4oggitjhephdqh9vilwh8;1:rja;2:jj2oiy;2:uhhvj7;2:4irrjz;2:3jn8hf9jcagdbhgchbfk2gk3jh2qh9riuuh5vizwiy;3:1hb3n86hg7h18is9jiagubizcjgfh6gmcjh6kinlhdngvqgqtgpugzwgo;1:kj1;2:jirohgpk6;1:cj6jh7pjh;1:ojs;1:tko;2:6h8jh3vixwjn;2:2kvaheeh9fgvgh3hjyjk6mh3oh8ph7qgttiyuimvjgwh3;1:ogzwl7;5:disqiy;4:8k79h3bk5eivrhfwhb;1:ql7;3:8gk9lnegd;2:jjbqh5;1:8ip9hdjjusiv;3:bimqil;1:6jo8ix;1:8itcirdkshijjhhuhd;2:pip;1:6h89ixeikviw;1:dh7em2;2:jobkjwqhbrhewh7;2:4j5;1:7hf9k2agbbhecj5fiuggwnk4ohfqo9rhawgx;1:qjqrk4wg9;2:cgxdjbhjywj0;2:kh5ok2pjk;1:3j65ixdjxfhfjgwwiz;1:8jr9imkk3sil;1:ek8uh2;2:8geagvbniql8sgtwhd;2:1jg8hgrjh;1:7ilgil;1:9io;3:0jn8j1kj5;4:kio;1:phbwja;1:djxegb;2:khenlaqj6whc;1:3hg4hgcj8fh6gm2hkokhcql6rh7sgtwh5;2:9izdhhhir;2:rjiwiz;1:wj7;1:biq;1:fimwjb;1:0kl1gz4gw7iqajwbjrciyggckixlh5mjhng3ogmpixrirth1uh3vivwfz;1:7h09j7hjgjodogsqgw;1:hiwjhenhgoispjgqnsth5wha;1:wio;2:8jm9hd;3:1hb3hc6he7he8j8aixbk0cjndh4eipgjjhhbjh0kiqll0mh4nhgohergzth3;1:1h72iq3h74hf5iy6hc7gu8in9gpaiqbk8cgyfh7hhhihgjkcmgwnh7ojgpikqj9rkftjguhdwg9;1:8jvriytjcwhg;1:5iwaiogik;2:ainrjwvkvwgi;3:njgqjj;1:0hd1g53gz6km7hd8g29gpak1bllcjjfkbjhckfilhenhgop4pgwqgwrh3wgq;1:8h49jvrhdwl2;2:0km;1:hjljiw;2:7jt;2:8iy;1:phhqmmwgs;3:8go9h0ahfdl4egsghgjh6mkbqherh0tivum2wj9;1:4jdqkw;1:0jt4h1til;1:1j26gy8hfghgllwtjjvjswh2;1:eim;2:fiw;2:4ixahgfh9hhhjj6kh2rkjtj9ukyvh4;3:rja;1:5kqrjpsikwgz;1:1j1;1:fhggin;1:1hf5ky7gt8krdgtej2fitgfnjh3qnxtha;1:2lofhchh5jgrphfqhbrlxthdujavhf;1:egijkfphdqj7wml;1:th8ulovhb;1:dgpek9khcujk;1:ah5fjs;1:0hg2j83m14h95jk6hc7je9iyallcjddhceh6ihfjg2kh6lfwnhfohdph0qgprjvtgm;1:6gk8gldioektghfujtvjg;2:wiw;3:0io1g55ipljxrh2wla;1:5m26h47g19h5aj1egwfjwgimjjqkh3lh7oh6phatkawfw;1:2k13hd4kp9hacindlgeguogwrhbuio;1:gk2jlgwh8;1:gij;2:8isbjxwhg;1:bij;1:8j79h7;3:dilhh4rj8;2:8gjdhaeiqmjmwkg;1:hgxlgdrmztjdujiwhc;2:8hgjkbwh9;1:ljipj9;3:0ir4he8h5bh0ck6ujb;2:0h92ku3nu7hg8giailbhgdhcgimhhcjh0ph9qgtujxviv;1:ahdfix;1:4im;1:1joait;1:bjt;6:6iq7j18iljk8nj3qh4whc;7:jjs;1:9h9jioqj1wix;1:bj4kkqrh1;1:cjkfhggja;2:jje;3:khapiz;1:ul2vfx;1:ij2;1:aj3bl0eikfgzgm6hhhjh5rhbwge;1:3ixainuipvke;3:jkp;1:jjw;1:0jj1l32ev3j54lg5gz6ka7nh8jb9fvch8ehgfgwij0khflh5mhdnh4oh6pgxrhcsh3th8ugwvgywgz;1:1hc2lc3iy4jebireiwjhfohhrgw;1:6ik;1:ljsrgu;1:jheogzphdqmywh2;1:0ha1k8;1:8kk9hfjh9;1:9j3jhfoiyqiz;3:3iwwj7;1:4nj8li9kpah3cgaeh7gkzhh6jk5lhamh3nh1qh1rgysgxth6uh4wg7;1:8j8eh7qjq;2:dh1ej9nj6;1:bj1;1:pj1;1:4ktjh1;1:9gpdh4el8;3:8h09j9;1:piq;1:pj0;2:uir;1:5jf8iy9h7bh5dioeh3ghehjrjiwqilth6wjk;1:pit;1:jhgwk8;1:3im7iy;1:5j2;2:hj0;3:giv;1:2ha7kfqipwhh;1:5jvah9jh5nl9pk7qh4;1:jiz;2:jjq;1:giphip;4:cixokg;1:1hcgkhhj5jh1pgtqharjfsk2wjv;1:jik;1:8gxbhbehdrl4;1:ahedhgfhegglhorjk8lheqj9wh2;2:8ha9jc;4:jjn;1:6l0bipdj4phgrjcwhf;1:wjo;2:aja;1:ljc;3:9ilalafh0gh9sjp;3:7kzjh6ph9vjfwgv;1:9ip;1:ej1;1:8iv;1:7h88j6hgljk6pikrk2sjgwgx;1:2k55jtjjrqh2;1:2im;1:5io9ixdiz;1:eiy;3:eirgiq;1:gjq;1:0in;1:2kaagvsiw;1:0jd7gw9ktdisegrhhcjk8mh1nj8rfpwkh;2:tk1;1:0n23lh4h67hf9hggheihdjgqojlpguqgxris;1:8h49inbky;2:dlwegtfhf;1:1gn3h95nq6hd7h89h0bh5cghdghehdfikggshm7jjekhcmhanheoh8ph7rjhtgfukfviq;2:6j6dipuh2vlewh7;1:ojruhe;1:vj2;3:gj0uh9vjb;1:4iokin;2:dhblimpisriu;1:bjrljbrhb;1:jin;4:9im;1:0ki4haafzbgsdhgek6fkggjjhhelldngooh5ph1qh6rh7th8ughwmc;1:5iy;1:1gp2hd3he4hc6ha7iz8h79h2aiqbhegiqjg0lhcnj2ok0pjkqimuivwiw;2:4hcije;1:1h98ik9inak3bjscjefh8jh7ojbrirwha;1:ois;3:8h5ahfnq8oixqhgrh9sj4wg3;1:0iuqjc;4:2hg7jpdjjwha;1:gir;1:3he4hf9jgagecjhfkigh7jgwpk5qh6rgdthcul9vkiwgc;1:rj4;3:hh8jjykgwlhgplcrjcsgztiw;1:7jfkir;1:7k7jhgpl0qhgwgx;1:5le7hf8hc9inaj8wh6;3:0j49h2klcwgu;1:bkzoh7pkdwhd;1:0iq3k55n26h87j98hb9geeh7miznhgqjpthcwgs;1:hg2jlmtimviq;1:9g6aiobk6cizfioggbhhejlqkhcmh5qh9ro6th7uhdwgn;2:3j5aivwh9;2:4j1;4:aiv;1:hix;2:9oibgxegyjgokj1pilqj4;2:4hgwjr;2:okc;1:2it;1:iivjjnnix;1:wik;2:qjm;2:jio;1:1j8;5:qjd;4:fim;1:8ik;1:0iv;1:8hd9juwio;1:8iu9hd;1:8iy9hb;2:0h61h72he3kn4ha5h16gz7l78kx9h7bkpcikdk1efqfgsggehizjh9kgtlgrmhaogpqj3rgdtgzuj5vglwlg;1:8h7ajldhbehafiphj5mikrld;2:0j71jy2j83j76h77h38ip9haaffghchg9iiljg0kgtll9mhanj2ogyriksiytjauhgvhf;1:3nuffzjitqhgwh5;1:6jnoimwhg;1:vim;1:uj7;1:bgzcj7ijwqj3whg;1:dil;1:ikjjjxuhe;2:bjyej5;1:3iv;1:eh1fheula;1:jim;1:0gz1gx2j13ji4gs5gz6he8h0ahebkbcjddgvfhcgh3hh6jjdkhbnhgok1pktrljth9uh2vh5;4:6kkcjqwh6;1:3h34hg5h38iz9jkbhafhcgnkik5jfrlinqgnrk0sh2th8wjd;2:eji;2:8h19haah2bixcq6fgyghfjh9phgrh3wli;1:bjwhh8qjn;1:4joqhd;1:2innji;5:6gickdfgrgjlhjdjh6ql6rhevjdwh2;4:1ir3jk;1:5jmjh5;3:8hdjjbrinuiqvio;2:oik;1:wiz;1:0gy1gq2h93jj4h25is6gz8nk9g7aj3bizdg9eizfhfggkhj9igukg3lhdmgnoiupkmqh0rk1tgvuhdvgtwk2;2:0il;1:4jm8jn9h3;2:4iy;1:rlb;3:cis;5:dio;1:fhdgkd;2:ukbvil;6:9ipah0vjt;1:aj6bkdch9dh8eirgh3kj5mimpixqjawhf;1:0ij1kl3gr4hd7hg8ir9mqaggcggdjcemthgkihcjfqkgsljmmgqngzogwqhgrgvtgevhawl5;1:dhfhkmjfeqj4rinwko;2:8m89f8;1:0hd3he9irdgrejigjahfsifpkirlldpheqh8rn3th9wj6;1:6hg9hdagzbj3cgwdhcek9filgh5hhgjgskhfnhbqgtrlztjwumkviwwg8;1:wir;1:7he8gj9h6ahcbj2hh8jgvkmhlg0pkzql5rhctldwgt;1:jhgqir;2:8j1pgxwke;1:0gz3hc8h59j1birdkuekdfjtggqihgkjhmh7nheph4qhergvshhuj2vikwgj;1:diqehc;1:8ha9heagybkpcgxfhajjwrjfsjuujg;1:0ha1h53gt4gs5h76he7hb9ilam2ch7disefyfj7gh4hk7jftkg3lgzmhepgpqhcrlmsipthful8vjmwha;3:sil;1:lk0;1:bh2gks;2:aipbixcj4;1:ckejjx;1:1ir8h8cj3hiwjhbtk0uinwha;1:jik;1:ujp;2:aikfjpkheuj9;2:0o7dhbekefgyph5wfm;3:8hcah4bh7dkkekhfmpggqrgowiu;1:8jjah5kkm;1:4iu9j0ahedgxejefh8mgqonppksqgxritwgd;2:8hb9fncknfkjjgrrmgwh9;1:8h39isgh8jhbnjhwka;1:jil;2:cir;3:ejh;2:0it1m74j46ka7gm8j79egbgrcgtdisgjhhgkiiyjiskh0mhbnh8ohfqgvrgeth8ugnvjrwiz;2:1gt3gq5hb6h27j28ke9lhajxbl4egnfj9nhgogzphbqkireztgkugpvha;2:4iwej5fimhgyqitwiy;1:chedj2egjqhetkfuk9vin;1:6is8k4bjfqitrhe;2:9jcchdfirjgyql4;1:sjw;1:biqjiz;1:vj1;3:1gx2ge3hh8h69j4agxbk7ok5qma;3:ail;3:1h03ge7ki8ival4cj6ehejgulg6phcqgwrjztgowl8;1:3ireiopjgviywh6;2:1he7hc8h29h7ahcbgkcgqdk1en7fiogjuhjhjiklhbqivrknughwgo;2:0ja4hh;4:4n5ojjuhd;2:kh4nh7oh9pmqrjishb;3:8h4gkr;1:0f03mk;1:jh9pkgqh9;1:eivjhfnhgrhftj4uk1vkl;2:7g8wkf;1:8hahh4jizuk2wjd;1:biq;2:1m56h67ip8h99j2agfbl2chdeh5fgdgh8jhalgsmgaoiqpfvqitrilsjgtjquj6wgp;1:uiv;2:5g7cj5jhdrj2wlf;1:2ir3il5ikahadirggnhivmiknhcohfuik;1:3h75ln7k6aivdhhfhajh6mj7qiyrh8wij;1:2kd3j54h95ji6gwchgihejh4kh7ljbnhgohbphdqh6rh1uk2vmrwgb;1:ciu;2:rls;2:8kj9gxaijbh0dljegoghghhfjhfkkemheoj9phdqgprgoshgtk3uk7wgv;3:hin;5:1hccfxgpijhaqjsrgdtk4wh3;1:jiy;1:7jc8hfbh2ehagh5iiwrk4tnfwh9;1:6l9vgk;1:2ioolwpgr;1:pituiv;1:mlaoj2wh7;1:8eo9lfhim;1:jiowhd;3:0n51gs2m73h84h95hf6hb7hedjtekkfitginih9jglkh6lheph0qgjthbuhgwfg;1:jmswfw;1:qjh;1:kjj;1:diwehb;4:5iw;2:6h7phewlg;1:cjzrhd;3:0j1;1:aim;1:3j7chcpip;3:uj8;2:4itviq;1:1hgbiucm3hjfrfdshe;1:5jo;2:2hd3hd5hf6gm8g89h6ajqcgmdgvehcfimggshkbkh0mhdnh9ogzphcqh5sk2uqwvldwg7;2:9kdbh9ejyuiq;1:in2whf;3:pip;1:7hhpmbwgi;2:2k33jx4kvjhaogvqhbrhetiv;1:6gi9imcinvk5;1:sip;1:0jl2je8gzbiogh3pijqkbwgm;1:gj9ihf;1:hkmjhg;3:oiksik;1:8j4aikbjrdhdeipfirjhgkj3ngzohfqj2;3:rj6;7:1ir;3:aj2eiuriw;1:5j5diqhhfriz;1:mjawiy;2:4k68hbjjr;1:hj4;1:cin;1:1io5iyciojik;1:1is4ir5jb;4:8glah9ch3gl5hjgjgokhcqfuvlpwlv;2:cil;1:2he4hgwke;1:ajifhaqix;1:9h7el2;1:0gx3j1fmewhc;1:4innjarikwh5;3:ehfqjvsje;1:9k2ahc;1:aj4ejipiywhh;1:1jf5iv;2:0in9imehdfjd;2:cisfhdvjl;1:8lr9h4gjg;2:ajkfjd;1:cimliswje;3:1jkrhd;1:wj3;3:8j5;2:8h3uj9;1:8jmcji;1:8jj;1:win;2:om9uha;1:jhgphhqm7wj0;3:3iuqlnwgs;2:lik;1:ciyokn;1:1itkis;1:5lh7h68k1bhgdh3eiujgzkhdnlypheqh9wim;2:8gd9j1ah9bjccjpdhcejffiwqj4;2:0j53fg4k56h07gn8nkahgdgsgg1hgjjjhkg3lhdnivojdpjkqk0rhatkjuh5vh0wgb;2:4js8iz9j4ahfbh4co3ehffh5ghekizrgowgv;3:alufh4ghbjggkhgmj9wk3;1:9imqiv;3:iil;1:pip;1:rjb;2:sj1;3:qim;1:9hddgheh9kkmtmvwhd;2:2isdiveh6;1:wix;3:0hf1lz3jb6ha8ki9hgchaehafgphhfih2jj9kh5ljinj8ogyph5qgqrghwja;2:uiz;3:pj5;1:0l53jd4h35iv6h87h58ki9iraghcj6dj2egbggihmeih2kgdmh5ogzqg4th5uikvh5wiw;5:hkarhe;1:9kjak2biughahhgjhgmlaokoph8qgyrgxthgwgw;1:cmbfh5iiulgrrjfwhb;2:ril;1:8jb9gpbilclthhcrgb;1:uj7;1:2j3;3:1ik3iz6hc8j89heejhwir;1:hhgqil;1:bheghbijgjikpjxqherhesirujivhbwiy;1:fjhuikvjf;1:bilhlpjhf;2:1j63ha4hf5he6h57h48is9g2aj6bjscjndgheimfizhjsjfxkj2lj8njxogfph7qh6vh1wh6;2:8k3eh8gil;1:4ja8jfiheriz;1:8hdajqgjrwio;2:6m3gisph9qhfwh1;1:rj0;1:6hepj5vjq;2:cioujw;1:hizjh2miquil;1:wjl;1:6j7;1:9iyehcoh9pjewjg;2:1h13kb8n19hebhecl2gh6jgykhfqh1tk2ugqwgr;1:6lg9h6nj4qhcshdvgxwjl;1:cgztk7;2:fj7;3:sjb;2:5j66em8h6ajevle;1:jjc;2:8g49l6;1:2jv7jh;1:1jz2hg4h66h08jdagvbh9chefisgj3ihgjhfkjtnhfoh2pjqqinrh7shctilugzvhewlb;2:7jv8he9kmcjighgqharh9sir;3:1ka3im4gq6h87h38m59koajfdh6ggeijnjiokh4lilmjknh2ohepg5tg8ugbwgh;1:4it8h7ah1bg1cobeiofg0glrjiwqh7rgntj7uhg;1:pks;1:jiv;1:oit;1:ij9misnkqpjlrhf;4:pj8;1:pj2ril;2:2j88k99imch6diuwhc;1:3iqrj9;1:6hf7jm;1:einqj6;1:8h99jcahdrjmwhb;1:qk3;3:hiy;1:8ip9hfghajkd;1:3j2;1:dh6ekr;1:1kophduj5;2:5j8ggtilhjjppiqwgw;1:0itkfonlqtio;2:jgiqkg;1:wj5;1:3hebhgwo6;1:nk6;2:8inpje;1:qiy;1:cio;1:8jc9gqclvrgc;2:kh7lipmn5nh6phd;2:8j39ip;1:6j6;1:3ip5j86iz7in8isdgleivggwjj1lipmjingqrg8thfuh8vgh;2:8ilbk5chgkiklj0rgu;2:0io3is4iqchfkiylimohdpiq;1:pk2;4:fjt;1:hixojm;2:1ja8go9k7gjljh7kh9qh5ripujpwkg;3:8in;1:9iu;4:0gz1im4jpdk1eilkj0nh7;1:3io;3:dk9eh5pio;3:ah9oimuiz;1:din;1:8jgjhhpj4;3:0jc3gc8j6ajgehgjguqmxsh6whd;1:dgquj9vk5;3:jh4mk3wj6;7:7h3jji;1:5kc6k97ix8hhahhehdik9jh0phhqgxrjqwj3;1:8hgbgnclffgzrkswhg;4:riu;1:8ks;1:4iqgkklh2rk7;1:4in;1:0io1kb3lu4jy5m26h87h18fxagych1eh0fh5hguikfkh8ogbpgdqgprghth6wk1;1:9imsj5;1:gij;2:uij;1:2ilnim;1:khclhfnmhpixwgy;1:0jk7hhah7fjsgh2hh7jiswl0;2:1h92g43h15hd6gp7ku9iyancchgej3fffgg1hgvkh5mhgohbpgurjrsj2tgxullvjc;5:6jl8gy9izah9cj0dj0ggtjjhrh5sk8uh2vh4wjv;3:ejo;1:1hb4hf6gi7ip8in9jcaj8bhacj6fgjgj5hk3iikjfzkirmhbph0qj7sg3thbuh9vjmwjf;1:8im;1:0in1g5khelmbnhcrh2wl1;1:wje;2:8is;1:bitlhdrjvthewkk;1:8je9gzpjr;1:3j6whf;4:0h91hf8l0agnbl6gjfjjikhgrgywhd;1:3l0gio;1:ajorh3;1:pk2;3:1j85l2hh0jinmk7qherguwhd;1:ajanj2rh4;2:din;1:pjm;1:8h8gldhgzjitsitwhe;1:9heej4;1:8j69ikahcegujh9sjjul9vjp;3:binhjqwhh;1:ditehd;1:jhcnioojoqj4;1:jikojc;1:5iqajabjirgz;2:8hf9gstm4;1:1ji8iukj0qhhwix;1:0ip;2:ciutiqwim;5:jit;2:ej5fil;1:1jp8l39goaimbkych3ehargt;3:eh6jkh;1:9n0cgf;1:8h99hgdj1ehgjgbkj2qjmwl2;2:hjiij1jjfoj3riytjnwh6;2:jijqju;1:pijwj1;2:5irgjfpjb;1:giqrh6tjz;1:7hach2jl2piwqjmwh8;1:2kd4gwah6fhbjhfkhbnjkom6phbwj4;2:8h79j2qjurh9wl9;1:0hc2j4ildjh6lkswft;1:eilgik;2:bjrrji;1:1hg2jk3jq4hf5hc8h99glchffheghchh7jn3kh8oh2pilqhesh9uk4vhawke;1:7iyah6femglmhixqh9rh0wkp;5:3jijhgqj5;3:4h78jzbgyol5;1:ahajiosk1;1:0h71iu2k93gy4hb5iv6h97jz8gq9ikaj8bgidjrggxjgdkjenh2ojlpgwqivthcujpvhgwfz;1:ch3gjnjj7;3:oiw;1:5k3;1:6gzqlqwhd;1:0j21il6in8h8fhfjhaqj1wij;1:dj2eh7;1:0hd1h82j53h76hg7h28geaktbmqcjfehafgbhg9jgzkq2lghmgxnimoheph9qh1rgzsjith1uh1;1:1ipcjxrh9ujdwki;3:fio;1:7lr8gugk3jh9kk8oisph1wgu;2:6kmfitggujgtlj1mjlrituhg;1:1jg8h79iu;1:djepio;1:ahheimhjc;1:wis;1:8l3ehekik;2:bij;1:bj2dhfehfuk4;2:2h15hh6iw7h48heagmbh8fg9gpshmdojapheqh0rh3uj4vj7wg5;2:5iv;3:kjy;1:5imvhcwjc;2:wj4;3:jjb;1:8h6gitjhcrj1sjo;1:uix;3:1is8ik;1:0hg7jy8j1aj4dh6eh8fiohjbjisristhduj7wgx;2:1ik5in6hg8j09gwehgjk3khgnipojhphcqherftsixtiuuiwwgn;2:7jxdg8;1:2m63k84iq7h58jdaj1dh6ej3himjgxqh9rh1uhbwh7;1:9im;4:aglrkg;1:ghdjh6ph8qkvuk6vj5wh8;1:9itfhegit;3:8iqjhepixrikwhg;3:jj0;1:hio;2:bhgcjh;1:bj2;1:8k4aiwdh5ek6jgqwhg;3:wjh;1:8hbajpdhdehdfishjgrj6;1:3gs4hg5h97hg8l79izchddilej1fgsgilhj4jgpkj5pgrqhdshhug5vixwj1;1:jit;1:1jehh3jke;1:qkawhe;2:min;2:9j9sip;2:air;6:ddtemckj3;1:oio;1:8jz9k0aixbjefjbggxkiqnheqhgrg5theujavhfwgp;1:dj7egvwjd;2:qjc;1:8lr9klbh0ciwehchiyjhfrjqwh5;1:pke;4:bk6;1:ah1fiqhkurhd;3:nlfwj9;1:dhhhir;1:8jmjhg;2:bjg;1:jik;2:eilmjn;1:bhegjq;5:wjx;2:biych1vkdwhg;2:wkp;1:4jg6nwdhcegzwgu;1:tkuuh8;1:riy;1:1h98ha9hgah9fh7gfyhrzjl4lhdqjprh9wgk;1:0h13im4j06mp8gk9ksagugk0hhcjh5lh6ph6qjlrhftiuwfq;1:0h41io3hb9h1biucnvdh6hhamhgohgph7qgpriqtk8uiovhewhe;1:fjaijjkhc;1:cim;1:5jzwir;2:6jmbis;1:njrwik;4:0h51gb2hd3g25h86h37jb9j1bjndh1eh5fg1gfjhkgij2jgolh3mgknk1oh2pjerm8sixukywgm;2:8im9hafjigjkhgnjjqojfpheqgyrgwtil;1:biqhgurj9;1:8he9iorjf;2:3j45lq7hfahghjpjftqhawkx;1:gim;1:8hc9gyah4cj8ggrhlgjk1rjawiw;2:bjlgikrhf;2:lkg;2:kjy;2:dh8fjjjh4rke;1:9iz;2:7io;1:9imjh4qj5;1:fikhljqhhuiwwha;1:hj8;3:ahheh4sjwukpvin;1:fit;1:9h3aj4fjujj6;2:dik;2:fio;1:ij8;1:pjeuin;2:0hb1gh3gs4h55ks6mm7hg8io9goailbildishilih3jgalh4nh8pgkqg8rjushgvkkwhd;1:djnehefknggmujsvj1wh1;1:sj0wim;1:gj0;1:8n1dgpeizggohhaqk1rjfthhwgr;2:gh5jimvjt;1:1gk3h64hc5hg6gh7fo8kh9g6ajabk7cllfkegmuhiqiiojfbkg9mhenk6ogyqgmrg4sh8tgvuk4vgkwj4;1:ait;1:ekthgkrj4;1:4is8gv9hebj3cioeh1jhbqk3rimtmtwh2;1:aj1rizvjj;2:6gsvjv;1:jgtwju;1:9ixdiuph8wk2;1:ahbrjr;1:3hf8jp9k1ak6bixchcghckikphftixuj3wh8;1:0j16im8h1fh9pij;2:bjj;1:dikgh0hlhjjlwhd;1:qjdwil;2:5jzjhdojduj0;4:bhgmju;1:5j1ej8hirjio;6:rghtmc;1:1gy2h83h54m46ld7gl8ikanibgych9fh9gj0hinjj6kh3lh6mhgnh9oj4qh4rh2thdvhbwfo;2:3it;1:vir;2:1h43h34hg7hd9joakpbh1eh3fh6gjijfkkinmiwngwohcqjvrketh3uhewjs;1:5ix;2:aiq;2:2jmaipoil;1:il3;1:qki;1:aggklw;1:2h34heolm;1:7io;2:dhbeiroin;1:fip;1:0hg3hg7hh8gs9gubhddmlem9flsgh7jh0phfrimth5wh0;1:wik;1:bj3;1:1h68iohh6jjmmh3tmiwha;1:4hgciuijakh1lkanj1rgn;1:til;1:6lhqhdshcvgxwjl;1:iilmh8wjg;2:7g79heclwjk4miwojxrhf;1:aiy;1:wjq;1:3im9jxagsbimejlfjwggokk6phcuiowh9;1:8khbhggjslivwhg;2:ajz;1:khaljwrf5wn1;1:8hd9h8dgzelwhhbnjcrm9wh2;1:8in;2:9irjgqpiwqjztixwhd;2:fj7;3:eixfjohk7ugv;2:jh6wjt;1:3imbik;1:1hc8gv9inbhdejegk9hirjgwqharj5sl5tinwhb;2:ehfll6;1:biq;2:7jckik;1:4jc;2:jjm;1:9io;1:4jh5lh6he8haagpbh4chedh3ehcfjmggyhhejjuohbphbqgysm2th5ujsvikwfv;2:1j83g44he5ha6hf8jc9juak9blach1dh9eggfj2ggshh5ihcjlhkn0lgxmh0oh4pg8qjktguugrvhgwfm;7:oji;1:finrix;1:9h5tk2;2:8he9io;1:8j69h7kjmrhd;1:fiy;1:bjncjn;2:1j8;3:jjgrhg;1:1h72it5j47h28h9fijggdkismjonmqoj0pgnthfwgh;2:8gp9jewim;2:7hg8hfchaej8gng;4:6ko8hgmmhqh3wh5;1:airckufkvggurgwsk5uj1whb;1:lis;1:sik;1:6hd9ijdjyukfvgp;1:1hg3he4jg5iw6hd9ixah1cpbdh2gh3hh8ijhjiolh4nh6ohbpgyvhfwfd;3:5j2cikejeuh5;1:gjk;1:9j1gj9;1:jh4wjp;4:kikpix;3:lk2;1:biyuim;2:8imah7bj4fl3ghhjhephbwip;1:5io;4:hinmk4rgy;1:9joeimrh7;1:6j2gh1hjojh1lj5piktj6wgx;1:4j6;1:pj3;3:4iqwin;3:nit;3:ij2;1:dgjfjjkjl;1:ailhjfjhh;1:7k29hfcilhikliu;2:giw;2:bjb;1:bh5gjqujc;1:5j5uik;2:9jaoio;1:diksj0;2:pir;1:3jb8j5bh7ch1ghajh6rjxwlj;1:eim;1:wiz;1:7jvjlargfthf;1:wiq;1:3ji7kojh1ph5vjuwgs;2:tiu;1:jiqwiy;1:gjj;2:3hb5jr6h97h68gbah0bgkchcgk0jjhnj2ohfph5qk1vl6wis;1:sim;3:0iz3hh7k5ahdpjnsin;2:1hf5ha6h09ivairbl7gjilh6mh8nh4pgtqh0rg8sh9tguulmvjpwj6;1:2h34kw5h66h07fy8hc9j0afbbmteiviivjgakfrlnfoiyqgpuhdvhbwfv;1:6j4gjduipvh7;1:9jvdj4;1:gk6jhhwit;1:9ivoiy;1:5ir9it;3:9j3cgzdjfkklph7;1:ahgbljfh3gkehinoirphguh8wjo;1:9ixpjp;1:gj0;1:9imfio;1:1ji7g98hdah0bgpcj8dh5fh5hhcjn9khanjroh8qharjssinwj1;3:agzrj7;1:0g21h32j03ju4gc5gt6jo7h09izbh4dgoeiqfh3ggghg8ijtjffkgglglmh2niroivpk5qg5rqmsh1tgfum2vjbwgd;1:fiujhgwjb;1:8iu9izdizegzjjw;2:piw;2:0iy6l5phfqhfsiywh6;2:6hevjp;1:3iwdgxejh;1:7j3fh3giwjh2mjwrjqwj4;1:1ip5iq6ilgh5hh0ihgoinqgi;1:ckboh2pj3rh5;1:8haaisdimgittj8wiy;1:ah0bk2wjb;1:cj2;1:iit;1:2js;3:ail;2:3ip;1:9j1;1:3kc5h97hd9gsakgfjhghdhhgij2jjskhgmikqgsrh5thfwhc;1:hj7jh1;2:uin;1:wj0;1:aj7hkx;1:0ex3licgyfjnjjskgzlitmmtnh4ohgpgyqhcrhdwj9;2:jiv;2:oh2pj6;3:rj8;1:ej0;2:hk9jgytjwwim;1:ejjrgr;1:2j43gx8g39kmhjzkjbrh2sheuhgwjb;1:eirpjn;1:gj5ojzqhg;1:1iw3k0jhfsimwip;4:3hbaitmjawim;1:8l39h4;1:wip;1:1jufk0;1:8hc9hgdinfiyghcvji;2:1gx2jl3h24gm5kj7gf8jr9h3ah2bhadgqfilgffhhgihfjh1kgylhhnj2ok5pgyql7riksh7uhgvhawnb;1:mjprgg;1:lj2;1:2jlojaphdwhf;2:sjj;1:4jt8j19j6bh9co8ehffh6ghfrgpwh2;3:9hgah9bjboizqji;1:uix;1:fiq;1:0m56nk7h6hjgjgzpgiqfnwgq;2:8j0eijkin;2:1kx6lx7hd8kv9h0einjjgkhclhcnhdoh7phdqgvrgtuhgwhb;1:nk8;2:8it;3:bjgcjq;1:rij;3:airjk5;1:jh7phdqowwgu;1:5iz8lb9hbrh3uiswhd;1:4ik8gf9jxco4fh2rgywiu;1:1jx4iu8iuah6eiqfiojiukjmmgwniroh7pgxrgesjqthfuit;1:biv;1:0hd4it;2:fimqjl;2:8h99h8aivbikdjujharhfukt;3:0j3vik;1:5jibj5jhdoh7phdwl9;1:6km8lcagtbircjfdfffilgjskjgqhdrgswgz;1:8haejqfhd;1:rh6tkb;1:jj7;1:8gm9kmjh1wj2;1:3h84ip7hd8iv9guahhbkaclxfg7ghdhgwkldph6qharkftiqwh9;2:8jo9j8eh3lj2;4:ciy;4:0hb8hcdgael7jkukgqlh4ngtpne;2:dhceiv;1:qlmsiowh9;1:dik;1:0it6jn8h79gvdl5egoqhfrjpuivwhd;2:djkehbgjurizwh6;3:akgdh3fjkuhd;1:wkn;1:8h69iysisuh6vjf;2:hisrjv;3:giyvij;2:cio;5:8iocim;2:eiu;4:aj4;1:jjjlj4;1:9hfch3dheghdhp8rh6whg;1:3j0ah5fgujkesj0ukhwj3;2:ah5bjl;2:0j11iv2hg3jz4gm7j58kh9libjgcikdj1eh3fhehhdjhdkhclgymh3nh6ohbpgwqg4rhesiougnwgy;1:eil;1:bjlrhe;3:8gq9jihjh;1:rkh;3:9ip;1:7ivjhd;3:6kd7j98le9glag2bj8djdghgohdph8qh5ukovimwgp;2:jikrjuuhe;2:ajtfhbkil;2:0kpjhfmjmoj3qhdwh5;1:2h63jk;1:wio;1:2jy8j79j1ehhgh8hharir;1:7ktjhh;4:8ixqiz;1:6g9aipojnvgxwld;2:0hh1gj2hh3h57h9cludiwgguhiyjfvlhcohhph3qh5rn7tiougmvijwj4;2:ak1qkfthe;3:gjc;1:phgqkwwh8;1:0hh1jv6hd7ha8gy9hedgvfgwghejgpkmhlirmkinjbqhhrijth7uftvl2wgx;2:chgfj4;1:5m57h1bhbojashg;2:9mbah6dh3efofhbghajn3qhhsji;3:tk9uim;1:5iq;3:9im;1:0hf1h22j93ha4jt6jc7mb8hg9h9agcbjpck4dh9eh0firgglihgjizkgilh3mh2oj2pilqgyuijvgzwfi;2:tjl;3:eisqjk;1:8j79h6;1:citiirwmb;2:3j3whg;1:9ivak2sin;1:fir;3:8h4ahcbknjgfpixsk3;1:3gz6kwvkkwhc;1:3jcqhg;4:iir;1:fj0;1:1lo4l1pgwwgo;1:jim;1:tinuj2;1:rin;4:7hb8iq9gtaj7jlqkh7mhepjrqhbwjg;1:kjl;3:3jw8h7bhcehcgjfhhfjhemlanh6thdvjxwhd;2:4iojh8kiusjiujf;3:aj5qkkwhc;1:2khjkowh7;2:9iu;2:0h82he4h36gw7gm8kw9haaghcjuegqfglghfihekfrlgmmjknglpj7qlargzshdtk5ukbwk7;1:diq;1:1jn4jg7jfkh5thgwh6;1:0il9j3cj6diufizrgu;1:1gy3iv5jx7ix8he9h7aiubkbdgrfjxgizhh7kh4lgwmj6nhgojupgcqgqrgoskwwgq;1:eixlhdoj4pk0;1:ciy;1:gjpoj4whg;1:jittjs;1:hh3jkd;1:ej3;1:jixwiz;1:km1lh4mimnh3;2:9iq;1:0j32j46ng7n38fp9fxag0bgicg3dioeexfh1gg3hguigrjgylj9ngyok4pm9qlfreasgotg5uguvg3wnt;1:2lteh3hixjmvqh8rhdthawg6;2:hhcriw;1:pk2;1:2hh7ij;1:giu;1:wj7;2:0ha1h72h94ha5h46gn7o18gw9jcdg6fh1ggqhkeihejn1lh7mk6oglpkgqhgsj3ugrvg9wer;1:kiq;1:jktwhg;1:wiu;2:0hh1pf3hb4hb5hf6hf8gj9gvah6bh1cj9dg8eh8fhfhjnjgzkh6mjiph7qh4rovuh1vhewgw;2:hjk;1:oiv;1:8ha9iyijh;4:8iw9hhhiylkknhfojjuio;1:1hc8jl9mmajgck4eg6fgxgh8jjfmhbohhpgxrjvtikufsvhcwgm;1:1gj2hd4gz6gt8l39jvaircgrdh1efxfhfggxih8jh8kkilfsmirnkdol3pjjqikrgltgwuivwiu;3:6hgafzbhehgejh6lj7rm9sj2tl8vikwh4;1:0ju1ga2in3k04hf7h78hb9h0akpbivdjcegxghchgxjh2kjklhcmisoiwqjbrggsh9tguuha;1:8ki9he;1:6jf8j09h4;1:egtfh5gn7hjbwio;1:0iv3h48jtaioqj8;1:6kl7l8phdqh6wh8;1:jjn;3:8is9hesj6;3:4lh8hebk3whe;5:jh9pkgqh9;1:9ix;1:4hc6h48iolhfrjtuk3;3:diwgjxjj1rik;2:pk6;1:citkhcnkoqj1whf;1:0jc7l1bg9gjwjhcqlathc;3:3io;3:tio;1:1ipahfcikfg0gmvjg5sks;2:1jd4hedjieh5ij9jispj0;1:1hemksrgo;2:wim;2:lj0rhf;1:cis;1:8iyfjv;1:8jm9jeahacheehcghfkl1;2:8ix;3:jjbpjd;1:jj2whd;1:mk3;1:kj4;1:gip;1:bipdgzejxpkg;1:0hh3hg6ki7l08fs9kgagzbivcg0djrfglghbhjhkhfoheph9qhetjeujqvhbwgu;2:aiufjrkhe;1:kl6;1:5jztis;2:2j0;3:tkbwhd;1:cirgiowik;3:pj8whg;3:oijpj0uj0;2:aiy;4:4j2hjljhcrj9;2:aiubis;2:njpwk0;1:8iqejg;1:agaehefkmgj3;2:rio;2:dntegofirghgokwrheuhe;1:1jo;2:8jr;1:4l1jheoh7phawlb;1:dikeir;1:8kx9ktbh7ojiph4rjrthguh8wha;1:ljc;4:hipom4phdwh5;2:jj5;1:fle;1:9ipgja;5:cfvjhbkiyrkd;4:8gy9izbjvpk0;2:2ilhiuije;2:dfgeosfhfuhc;2:5iqagrfjughbhhdjjslimqjqsgt;2:jj7;1:1h73hg7hg8hdfhcgnlhhdih8jgakg6lponh4phdqhcrgfwlq;1:1kb2go3gs4hd5hf6hg7h89h5bjdcj8dfxel3gguhlmlh4mj9oh0ph7rjgtj6uglvjuwev;1:8kb9kuah5bgmdjcej2jgcqhbrkhuhg;1:cgujje;2:4h68gvam7dhfehdfkfkggojfsjiuhb;1:gik;1:pik;1:bh6ckfwku;2:7hgpiounhwg4;1:dhcuiuvkb;1:8h59itagxbg2cotfghghahhdjjfkhblhfmnxnhaohcpizqh7rg7tiywh0;1:0h42ft6h97ks9ilagwbh9ip5pj1qh8rissiywgh;2:fgagmcjhepje;1:3gwdjyeh7oiztinwjc;1:0ke1ha3kf4j09jpggyik3jgkphgqjfsgewfe;1:4n37hd8li9l4aj6bfucgvdhhgh1jh2ljenhcqh3rh0sgzthbuh5win;1:2jb;1:7k8;1:8hbtm1whg;1:2h16il7ji8ivaindkaeh8hhdiijjhelhdpiprfitipuhbvh3wj9;1:rgiwlo;1:1h93h76go7h39iraorfgkggejjbmhcnhbphbqhasmgth4uk2vj7wfy;1:1kxiikwh9;1:5j3;2:ql1wha;1:0mt1gr2m23gp4h95hd6h77h98j8bipdjqekgih6jjbkh4lhdohdph3qgjrgrth7uhewfs;1:6ke8gs9ixaikbikjhemgsnkpokkqhgwge;1:biwmj3rjg;1:1j53h66kk7gc8jv9fxbjlcl1dggfheghbjgnlhfnhfoh8pgnqg7rlnuhbvjnwl4;1:dh0ek3;1:rjp;1:fjvgin;1:6kj8iqphd;1:0hb1hc3hc5ha6gl7haagtbimcjadjeeg7hmlihdkgylgvohfpjeqgorn8sh8tgkujgvj0;3:hiq;1:1iugj2rh9;1:9hfdj5jgdqjpwjn;2:8h19j4agwdiyeh4fkkkj2ljarhdwiu;1:wiy;2:7irbj6dhbeiogh3lj9qizrgnwk0;2:qin;1:3j94p45gyhgwjhaoheph7qilrjmujrwgd;2:1kd6im8h8cjbghehjfjhenhgokzqn3riuuh8vgqwej;2:dhbriy;2:jip;2:9jykin;3:8ivriy;2:jjcnikwjb;2:ahefh4gjnhj7jhgkgqlmtngvrh9wk9;2:dgtejqtkj;1:4ja;1:9imdh4ek1jfzwk9;1:7gg9izajejgxqjwrh8wkv;1:wiv;1:jiqkjf;1:hik;3:aiobik;2:7io;1:8jc9gqclvfh2gitrg2;1:0h34nl6jd7j7ch2jh3phdqhgrj9wiu;1:qixriz;5:cjbrh5;2:8iu;2:kl6;3:iizujm;1:2lejha;1:5l07jj8ha9ipbhffh3gjkjhcohcpiorh5whc;2:9is;3:1knpkg;2:8jo9hbehb;1:8h0hipjh7kj8phftl5;1:eio;1:1hf3he5hg6hf7hf8eg9l4ah0ch5dfwgh4iinjfukjdlhcmhdno3oj0pgwsmmth7ujswg0;1:1iu9jbjhamk0rfnwjw;2:8iq;2:hgejm2whe;1:4it;1:8ioejtwj4;1:9il;1:3io;2:lks;1:9jaaj3hinshewiz;2:3j37iwwhe;3:6kcvga;1:0ix4jyjjznirwh1;1:gh9jj9qk8;5:4hgoj0;2:1itqk5ujewhe;2:3mvqhg;2:8hfciugithjgjixljlqhcwhb;1:8gs9mvainegghiyjgxkh2nj1qixrj8shd;4:bj3;2:8is;3:7j2;1:uil;2:0jo1hc4gw5he6hf7h0aikbhfchbdk0eh6fh0gjdhfwikckilljfmhbnhcohdpgzrkasg9thfuh2wlm;3:9j2;1:rj8;1:9iu;2:8ipfmcwhb;2:1hafhbgiuijkqiqrikuil;1:gk4tit;2:8ijjhgqllwha;1:fki;3:jil;1:ggxkgzlldnhapiorh9wkd;3:agkfg3wlv;1:8h09j1ah6gj0um2;5:jiv;1:pjj;1:3j97iu8j39hecithinjh6kj2liuphcwhe;2:1iq5iq6inbhacgxdireisfhbhgojgzkillhcokvqhftj0vh8;1:9joeiqrh4;1:2ikdil;1:ah6dh9eiwujo;1:jhfuj7vk5;1:wl5;1:rj3;1:6j6ljj;2:2il5io8gn9jyjg3qlcrikwh9;3:2gd8iw9j7alsfglkheoj6pj7rhc;1:lj6tiu;6:iir;1:5j5;1:7isjio;1:gjxwhe;1:7jbwit;2:1m47iujh1qivrgs;1:7j98gubgyhiwlhbrlu;2:dj7egrfhgjjiniywio;2:wkb;2:1hc3h6bhhiinnjpojkpklwgt;1:1jqjh7kjvnj6ohfpj8sis;1:aj9fh6;1:8gi9jq;1:7ltdixjhewh7;2:8gwbj2ciqej9rh6;2:uil;1:9jzdgrek7fh7hhdjh2ok3pjoqirrhfuj8whf;1:ajb;3:cja;6:3jqdh8eiplij;1:gilhiorh3skp;1:9hdakvugy;1:0j81kr3jg4jq5hb6gx7he8h4bgrchgdhegiqiksogjpgzrh0wlr;2:cixsim;1:wiw;3:cip;2:giyjiywhf;3:jk3kh7mhfnl3rlhsj7wgj;1:dhaeiu;1:8hddk1ehdijdwjv;1:8iudhe;1:1in8hbbhdcjvfp5ggphhejh4khcpilqk2rgxwgy;1:hh3jhanitoiypkfqjaujwwhd;2:jjdqh9tk4uh4;2:0h54h5ilwokb;1:fh1pmh;1:9im;1:uis;1:mij;1:8ix;1:khelj1;1:9in;1:il3;1:8jrej2;1:1hb6jb8j69ghbjecheghchh3ihgjgnkinll9mh7njbogwph4qiyrijtiquhfwk0;2:8hflisuix;1:0k89izdimjgtmhfphcqherjssj2ujovh4wh1;1:5il;4:dipeh6hh6jhgljcrj5ujg;1:6f7vku;1:qj9;1:ghbmjioixrix;1:hh9rj9;2:2ij4it;1:ciw;1:4qd6hfaj6oj7phdqhcrhauhbwh2;2:jk0;3:eik;1:1he3hg4ks6j0ogowlv;2:8gkgmnjiy;2:5h76jj7hc8k39j7bhbchcdk1gh2hgsjhcpkeqjdtgqugr;1:0gj3h74iq7h98gf9fiah9bjrdiken6fjyggdhj6ijbjj1kktlgsmhfnhepgwrjotgowgc;1:0ha1in4kb7hfcjuhh3jjjphbqh6uj6wjh;1:6hgojdqiz;1:9j6aiwgjuwhd;4:7gl9h7gn5hixjh5nhcpiwqhgrlwuh0;2:1jo8j2oizphe;1:8hfahenikukkvjw;2:8ip9h1ahebiocitwjy;1:8iq;1:2jn;1:jjp;3:dj4ujm;1:pizwj5;1:4iw;1:dimuj6;1:pj2wik;2:6jl;2:2im4hf9ileh8nmhoiwpjmwhb;1:tiruil;1:1g77h68habh9eivglwikikjqliunh1ogpqjkrj3thdwh4;2:bjd;2:diykinoio;1:4ir;1:5iv;1:biy;1:9hhdjsehdfhggh6tlcujl;1:nio;1:0ix3hb4hd7h79j1biscjzdh6ghbhhbih9jk0lj5mhgojbph5qh0rjquh9wj1;1:2l53he4h85ja7h68h39jacimdj5egdfhggfnhhfiixjkfmhdnjaphbqgxsiyth1uj0vhdwh7;1:3lo8itaj0bjlch5fhbhhfjj6qj0rimsh5th5wgf;3:8jtahgujg;1:2j63h24il6h87hc8fvah8cgmem5fgfggyihgjgilh2mm7ohbpj0tkouiwwfo;2:8ixfhguiw;1:3iz8hcailbk9ehb;3:8nc9gjalbchfdpdeg1fgajhakhfnherh9tgvugkwhd;1:jim;2:aj8;1:aj0fhgwky;1:8jd9hd;2:cjsjgprkcwh9;4:2fi7kzjis;1:bir;1:nkm;1:mjs;1:0jv1gz4k48hhagcbk6mkgwgw;1:lkc;2:lk2;3:3ip;1:vjh;1:0hh3j7bipciljiuwhg;2:jispim;1:jim;2:7j5;1:0h16hfaiybhcdj9ehdfgpgmohh7jlakh3njaoh5pkdqiorhguh9wgp;2:1hc2hg3jc7hf8jc9ndagychddheegjfh9gh4hhfjklkjhpheqhcrj8tjcuh1wg2;1:wj1;1:1ir;1:gij;5:cikjjk;1:1kqkhd;1:0m41hb2hb3knahhbj5kh0;1:1gw4gq5h96hc8gz9haahbbh8djregrfjpgh0hhfjhflkimk3noqog7qh7skdtjkvgzwgp;2:ujg;2:1jp5mt7hd8gpahbbjoch3diteh9fh5hh3ij9kgpmisohgpgvrgsthd;1:fhegiuoh1piwwir;1:8j1bj8jgupisrk0whg;1:dh6ej7;2:2hf3jk5hc6hb7h68dv9l8bgtciqem5fixjgqkhfohfpherk3tiuwgv;2:8fz9h9ah6blvdiofizgh6kivwkl;2:0j45ik8in9hhbh5cjahiophfqj6rj7;1:0j4wj2;1:dip;2:0h88haaj8dnmfh4hhcjj4qivwh3;1:8k4ah7;1:hhdjh5lh8rl7wjv;1:aghchafjfhhejiznk3qiorj3tja;2:0h51in3iy6h39gfakqbg6dj6eitfkrgnihhfihcjjglhfmh8ngtoh1reysfkujmvinwgy;1:2jn;3:hjv;1:gj0liz;1:6kdejkwgk;2:1h03hg4hd6h67g58fz9jbaq5bj2cgzdgrehaggohglihcjgmkg4lh0mhcnkloh8pgxqkfrg6sk8tjiuj2wjg;1:aij;1:pkfwgy;3:eit;1:0j31ik6io8habhbkhfnixwit;1:2jm;1:8hcrjf;1:2ky4ik9hfagahggohhrmi;1:qje;3:3k4ciuqhcriv;3:1hf3he8is9iyajbbjucj6dh4fglggnhh4kh9nh8ph9qk4rm3tinuh6wio;1:3h38js9jtekiiimpj9sj0th2uh8;1:nj7;1:7itah9khgnk5rj2viwwh9;2:0hg1hd2hg3hg5iu8graldbnfcioehffgqggvhh2jg2kp6lgumgzniuphdqh6th8;1:gji;2:4ik9k3giopkaqhg;1:3j5;1:ujd;1:miuuiw;1:8im;1:1hfkjmmn7ol4ph0rhcwgn;1:uj4;1:rit;2:lhgwk2;1:6kkwh6;1:ujmwhg;1:hj1;3:jjiljx;4:akkghbwip;2:7iq;2:0gx1h42h94h16h38kl9k3bixdjfehbgh2ih1kfzmgsojrqhcrirsjythauj2vh1;1:bhegjp;1:fhggkhhit;1:1jp4h67ioaj1bjxch6ehafitggjij9kimngxph2qgvrkyth4uh0viywgy;1:9j7dhgej7;1:jhcpjpvjg;1:bjncgzojj;2:kmjlgy;1:8hb9ldahgdhgeiygiz;3:bknlhfoiw;1:8h9alaghbwhb;2:cixoje;1:diy;1:jj9;1:akp;3:aj6fhd;2:gio;2:ljp;3:fil;1:5j6llewhf;1:jiv;1:6k28jm9j3agnbhfejjfh4jharhewj4;1:1iw;1:1j4;1:oiqwis;1:og4pnz;1:ah0rjy;1:jhfqiq;1:wkp;1:2lc7jmjhauhavj3;1:jiu;2:8gd9jucjhdhgek2khfujo;4:1h0ok3;1:8jn9jtekjjhhoh7pm1tgw;1:8ixchfrhfuinvkf;1:0nm4hdaizjhaqh7wiq;1:pjs;3:ciw;1:jjl;1:bhelkrwhh;1:1hhainbhghitjivrj6;1:wiz;6:uin;2:1hb5ji7k19ioch7djqeh1fg7gh8hj4jhgqh8rjbvktwh9;1:3jpdh5ej6fijhkcugywhe;4:qiv;3:4il7grsgywlr;1:fj1;1:ug9vkr;3:lk4nhf;1:eislixrh3wip;2:dh0ejx;1:0j09io;3:2ji;2:9ithk6jitrgluj1;1:eis;1:3hg4jbah2bl6ciufhejj9tj3wgt;2:eizkhdlhbnnauhh;2:1j5;1:jj0;3:eilmjb;1:5is;1:bjmgikrhf;2:aiscj8ghb;1:8h3bh9cnmtijwit;1:9in;2:6lavgk;1:3j99kcagpcgpfkyrj9uhewgk;2:8h19joakodinfgisjh;1:8gzbhfeheqhgtl1wl3;5:9liplqwgd;3:hfzjka;3:pji;1:giq;2:6gr7kr;1:3ix;1:9hfbj9jjnlixniwoh6rhbsiowka;1:3hd8ld9m0al3bk3dhefgjgh3jgnkjmlhfphcqivrgstj6ugjwgf;1:hjsrh7;1:vjh;1:8hd9j8giq;2:bj6ghekhdnjmohfqj9sjy;1:0lm4g4hj9ij9jh6rh4wju;1:wm9;2:rix;1:6jh;1:8isbjsck0eikgk6rh8wh3;1:kimnj8;2:dinfgxgk8pitrhg;1:0he2h84hh5h97gp8j19h1ajcbjjcjreiwfj8givhjdiizjg7kipnjoohapghvgtwgm;1:agusja;3:8h29gptl8;1:4jj;1:0ja7gu8iq9jxdiregthhcjk5kgymllnitogvph2qhgrfqwkc;3:eiwjh8rk3;1:7ga8hgqm6wlz;4:cipoix;1:uk7;1:8jsahguje;2:4km8gp9h9ajsbfccindjqfhhjgvkj8oh2ph8qharheuklwly;1:pitsjy;4:qiqril;2:0h22h93jl4he5h66hc7gt8ku9n9ahcbg4cjvemfggzhiojgkkh7mhfoh9ph2qhbrjluh5vh8wgd;1:lim;3:8j7ejw;1:3n17ix8hc9h8bkqhh7jh3phgqharj4uhbwgx;1:aiubh8;1:6givk5;1:tjo;1:mjoqin;3:7liqhfwhg;4:kj0;3:6iuoj4;1:0klujg;3:7e28l2bgdgkliikjgenjjqhdrkssikwiy;1:wlo;4:1gzgk0rh8;1:8kseh2qiv;1:vim;2:8jcjh7klh;1:fh6ujs;1:6havix;1:qjw;2:8io9kuak4biucilrh8;1:8jd9jrdiqehdfimghfqhe;1:7jk;1:3jeaimojdwkd;1:cj2;1:gim;1:2jgeik;4:tir;1:bit;4:3mp5hc8j1adtbguciqeinfkxgiuhj4khephewhf;3:dil;1:dkajhduh5vjn;3:vj9;2:njs;1:5la6hg7j6bjaphgwgs;1:diypik;2:0j01h26hfmj6ql3wgw;1:eji;1:jirwim;1:fgdhkmiirrhbtj4;1:jmrwfw;3:5ijah2ehhfhegioihejhflj1qj2whg;2:ail;1:8j2kjxlhdwio;1:dhbeis;1:ainoit;1:jiklhcpmo;1:jjbogtqj7;1:9ipdhbeje;2:gjesik;1:jhbwkc;1:7kbnjhohf;2:njbsip;1:uiwvk6;2:7h9gj5;1:1jg;1:3kc7helhgpj5wj8;1:rip;1:niy;2:0hd4it;1:1h58hc9j7ahgckueikggvrf6tlewhf;1:dix;1:aiqbikkhclk4;6:ain;1:7hfgmijggtjcwhf;3:8h69gsdp8ej4jhhrgk;3:8gy9gxah7ghchh9jgzkgwmpdnhdojypkqqherjlwgn;1:dj7;1:wip;1:tin;2:8h8aijgk3;4:8h89j0uk1vhbwhc;1:1fz9gkahabh6ch8ehdhhcjgzkm0lkcmhdnizogypgqqj9rivtj8wlb;3:fiz;2:dheejpfhb;2:2io6j19ilbgzgjpjh4kimmhdogspiurgwtgluiswj3;3:bij;1:3hg6jyikyvjpwgz;1:0il8k09izajnbj8cj8ehffeugh2jgwnh8qgtrllthbwko;1:8jn9g9gkv;2:8hd9hcbkxeiy;1:aivbh6;1:6jc8ip;2:8jj9hcdix;1:hgojjypl5wh4;1:jir;3:6h4diseh4qkjuk0vir;2:0jv1h1sjf;1:2ik3hd5jm9irgh7hh4jimmh8nhdoj6phaqiqrj9;1:8he9iwciknjbsh5uit;1:vjf;1:0h06hb8h3agwciudj3eh6gmdjjxkgyohbpkhqinrj9thgwfy;1:ahackpdgnek2hiqifgjhckjwlj5qhgrirwjb;1:6kkwh6;1:piu;1:8im9ipcijehewit;1:dio;1:9hech4hmiqherhdwjf;2:8is;1:7it8irfhdsio;1:7iv;1:6n77jkdhaegyijtphdqiwwft;2:2hd3j14hf5hh6ipcgyfhggguhjtkj1liwoizqhbsirwh2;4:4lkwha;1:wiq;1:cjlgir;1:gj1;1:dp0efxuhe;1:0jk3jr4is8jfbhheiufh6gh5ijylgenipphdqjmrfgsghwj8;2:jjkpkgwhd;1:jislio;1:0hf4mvchgdg3ejifkegglhh0jgzkiplj5mgvnm3ogiqgyrj5thcuitwgt;2:cjbrh5;2:gh7jhdrkctjwwhc;2:8jbah0bhefgpglhjikqhe;1:4im9hhhiwjirkld;1:wil;2:sis;1:agiciqej6fj4;1:3hd5jg8hd9ikpjhwjc;1:uij;2:1ha3hc8jvagsbgdcmafgqghchjhkhbqhativuk3vjl;3:0hg1l63h9ah7bhcfjjjmokh7phargmsijthdufsvjswk2;1:rk7;2:1hb3m37h58fx9jgbgncjdehdfljgopjgfph8qgwuh2wga;2:2m1wgy;1:8iy;1:6jfjjh;1:8hhbjmcizdgvekyhijjgsqharh7wk0;1:akrffrpix;2:5io;1:jj1;3:tj5;1:cgyfkwjk3wje;1:0he3kn5hdfkpjhdrjdwh9;1:8h79j4;1:bj2chgkhdmjcnjdph6;1:hhhjhdqk0;1:jit;1:biwhk8rhd;1:9hbbj1tiq;1:2ji5j16nx7g38hdcizdgieh9ggdjgeogipj4rgrsh2thfufevowwj8;5:4k0fiv;1:aj0fh8;1:3jb6ha7h98hbbh8dj0egufjjgj5ihejnhlheohdph3qgqthdujkwjq;1:6io;1:1ju7gsfgsgjhjj2qj8;2:9j1;1:0io2j1;2:ojx;1:njx;1:4hbnh7ohapmeshcuj4;1:8h99hgbhhohdpjsqhfrj1wlr;1:8h9bhfcikfixhjajk8kh6mkoph5qharhbsizwh3;1:qlf;2:6ge8k69fvaisbjschfdkkeh9giphhakioljamh6phdtjtuivvivwfk;1:1ivoikwit;3:gj0;1:afmsl1tj9;2:bh1rk8;1:5it6h89hdahcdiseh3ghejiomgwnhdqldriptizuk1vfnwj8;1:eikjhgkjclj1mgxokdwh3;1:mirwjn;1:2j84j77kyeisghdjfgqji;1:rim;2:1jt;1:hiwjharl2wgx;1:5ispj7wjs;2:hip;2:8hd9izjjsuin;1:9is;3:2j9;1:nimrj9;2:9io;1:8l59gl;1:0im;2:4iq9hbsn9whh;3:2jfdjmehbmggtl7whd;2:dj4;1:uit;1:wit;1:8ly9hekgrmhepklwiw;2:uh5vjt;1:jjf;2:8he9ivbiucjrjhbkjanh8;1:djyegijhbpmi;2:4kkgjc;2:gjxkgsljjnittkywfn;3:8hakjepkl;1:9j5chfnju;1:1gxglekh1lkbrh6;2:fjsgik;1:bj3;2:bj0fkaqhg;1:4ijdh4ehdfjkqkgwhd;1:aiy;3:pn0qhewhe;1:ain;1:siq;5:wjz;2:dir;2:ej7tir;1:7kleizggtujm;1:9hfdjdfilhj2jktmjiqh5rh7wgr;3:3h67hfahffjfghfjgpqiptjlwoi;1:jj3;1:kiz;2:njnphcwjb;1:8hcah3eipfirgmxhgxqjawgv;1:9iotik;1:wku;3:0jr;1:rjx;1:gio;2:9j2fh3gjfsirujuvh6;1:jjk;1:8knjivrh7whe;2:mjc;1:khbmkkohcph9;1:4irehaqkb;1:0im;2:4jfah2bl7ciufhftjh;1:jhgrj3;1:riw;2:8iq;1:tis;2:7jksim;1:1k02im3h89h5ejeghbhh4kkhljlohfpj4qh5rgssh4titwgo;2:qkf;1:lkewh3;1:ggxkgzllenhawkq;1:nkl;1:3io;1:5ix9hhbitej3ghfhj1jh6qk7uh1whe;1:9iv;2:ahcriy;1:8h59gqdouej3jh9lhfokjrgj;1:1ld2ftqhfwjv;4:1h37hf8j89ilam0fgxhhcjhdlgtrlasinwgj;1:6hevjr;1:3h97h88lx9lqalbbmwcfkdh1eg3fgwgh1hhajg4kkwlh0nh1ohfphbqj4th8uhdwg8;1:8hcbl7;1:ah1flmghbmj7nltrh5wgp;2:ailojjrg2wl9;1:ik9;4:8jj;1:dit;1:2j0kjh;1:8hg9il;1:dh3ejhth4ukvvjy;1:giw;1:fim;1:fjr;1:nm1ohc;1:rjdtiv;1:0hf1g02gz3hd6im7gb8jdakgbh4cjjdh6egwfj2hjdiitkgmmiwoheqgkth1uh0vj9wla;1:gj9;3:ujhvhe;1:sj7uhg;1:ah3cituk4;6:giv;6:qjg;1:4hd5hc9h9ah7fm0gjmkgglh0nguogzpraqh7uhewhb;1:qiq;1:qkn;4:jj3;1:1ja8gmehehn6rgv;5:0je;2:mjo;1:3jcwj6;1:1irkirwhe;1:4ilgjrjhf;1:0gs1he3jzaj9cg3dgiej5hh8ijgjgymj5rjyujtvhawjg;2:oir;1:1gf3k35he7j38m89kmagwchbdh2egjggjih6jhekg8lh7mh6ngvoh8pj7qgerkkskwvh5wkc;4:3iu4ip5im;3:6ix;1:rhdsj8wk9;1:ckkrik;1:4ir8h3ahgkkfuk1;1:gilpir;1:8lkahebhfdhgfhegjalhcriktisujc;1:5ft7khiim;6:2jq8im9hgah9ch9fh7ggpho4jfuwjz;1:lizqjaris;4:1kgdhegjfqhfrk2ujwwgv;2:ogoplg;2:1jhfjuhh2ohgpj4wh1;1:phcqndwgx;1:cis;3:uiu;3:8ja;1:dikuiu;1:8jjwis;1:4k08jndim;1:4jx8jfbjmcipqjqrhfwh9;2:cj8hhg;2:hh8jjwqharkqwj9;1:4lmwh8;1:4h2imy;1:0io;1:lkknhh;2:4iycil;1:iit;1:qik;5:9iqah9hh3jilwis;2:mis;1:9j9divuk1vilwhe;1:8hfuke;1:1il6gv7itvj7;1:0l2ph5;1:0j0dixjk3;1:kit;2:ojn;1:giywiw;1:jh3wjp;5:ojd;1:3hd9gtdkoel4fjrwgw;1:6iw;2:ajobkbch8dh7eiqgh1kj6pj8qjb;1:2l68glehdhnjrhhwhd;1:aj3;1:gj6jiv;1:aiy;1:pik;1:2ikeiy;1:1it5ipfiy;1:1gziln;1:8hf9j2dfyemcrgbwk6;1:9h4aiybm0cj5gh0hh8jh2km9lh6mjfnhdogrqhewis;2:dilfji;2:8kj9kqdik;1:agyhhbjjsqlhsgrwiu;1:8imdl9efuujd;2:wjd;1:kja;2:wjq;1:cio;2:4guilx;1:aituiwviz;2:9imsj4;1:vim;1:1le3ka4gv6h57gnafvbh9fhegkchgjimxjmckg7mgxohgpgyqgurh2thauit;2:oj3;2:4ir;1:3lf8je9gtah5bkmghahj2khfqh5sjetheuh4wio;2:3hc7hd9h0bhdch0dhgeizhisjj1mkdqkbrh2uhewkm;1:2h83jt9ik;1:8j5;1:0jtph8;1:cj7;1:jir;1:3n28inffy;1:5gw8mgeh3jglojeph7thewmb;1:qj5;3:9ioijc;1:1hc3h64kp6hb7iq8gj9h1ah2eiqfizggkhkdigzkhclhdmgzph3qllrgmukdvje;3:disehdhhgnimrj4;1:0j2;5:2in5itsim;2:imgjheqj2wh8;2:eis;3:1ip4irahheiqkj5;1:chcwiv;1:5j16mwcheohephfqh4rhaujavl3;1:ghfrj1wit;2:fhggopihdjggpik;1:qk0;1:5iq;1:2h57j8;1:nj8pik;1:5nd6g2vgd;1:4is;2:uim;1:jhbrjs;1:jh7rk3wj8;1:8infiq;1:9lhhj1rhg;1:hj6jhfsjx;3:eiysiq;1:1ij3iyjgykijnjsohapjtqh4;1:8j4;2:kinqiorixwio;3:6iogj1nj4;1:rj5;2:8hbajibh7flxggziisjhfkk6mhgrivwh3;1:0he4ksaitfhgqil;5:oim;1:8jk9h0eio;3:4j6viw;1:fiqtjg;1:8h19k4eitjjg;1:tik;1:0k04pk5kr8iwdijeh5jh0ogvpgmqhcuhfwg5;2:3jh8j7akebh7hh8jhgqhbshdwlc;2:1h37h7ajlbmchhgjg5mm2phgqhdrk0shgwj4;2:0iz2j93im4hc6hg8jd9loailbjoehafgwgh8kj8lhbmiknh8ph9qh6rh3siqthbuiuwgi;1:4im;1:8h9llf;1:9ksdgweiohhglhfninpk4rgtujc;2:3mc7ir8g89h0aizbkfckdfhahgzjg9kl4phbqjzshbth8uh2wgf;1:3j54j38j89hgaiubiuciodh7eirggwhgajkangtrkzthduh5;1:rip;4:9ghdjteljfj2ghcuhg;2:wjf;1:cio;1:0hg1iv3gw5hb7go8kb9j2ak3bgtdgtfhcgj2hh6ik0jhalkymh2nj1ogqpgyrhhuh7vhh;1:biweit;2:gik;2:1jm;1:bimpk3;1:5j68ioghgjhdohaqjprl4sjstjbwgc;2:jissivuir;1:6im;1:jfowks;1:rir;1:8ka9j9bh8cj0eh1gjn;2:gj6;1:wku;2:8j7ah2fiogiljgwkhapljqh2rj3wh2;2:9ip;2:1lf2h53gs4he6gz7gz8jc9ivah5bjmch1djyefzflpgjzjg7kgplh8mh4ngsogipiprj2sh9tk8vh8wh5;1:8ha9itdjaehghivrhb;2:5j5ej3;2:ggthkf;1:cj9rhe;2:gil;1:8gv9j8mhgoim;1:4im;3:wjz;1:2io;1:nim;1:bjx;2:9ildh2ek2hj0jfzwk9;1:jhhwk2;2:fio;1:5j4bixjk1qh8whh;1:1jm;1:gk5mj9;1:bh1rk8;2:jh7qje;1:1kefgwgnmjjmqh2uhgwh3;1:2h57j7;2:qj3;1:bhelkr;1:tis;1:8g69kqaiv;1:ah1fg7gl3hiojhcqh9uiovhewlr;1:ehggk0thfvk7;1:wik;2:5iloij;1:jkd;3:cikdir;1:0iv8je9h3bkkeh8rjf;1:kh1lkc;1:5j37ivbl8ch9dh3fhfjlmkjhqh3rfsthfwgz;1:1gtdj7ek1hj2rj9sjgthgugr;1:1jqrio;1:0gs1gp2h13iy4h26ha7h38h6aj7bkjcjbdkdefngj7hjriinjfcmjmnjxoh1pguqj5tgevh6;3:cheriw;2:8jo9ilah9rj0;3:tjeuh7;3:8k99hguh0vjn;1:8injh6sji;1:0h31h32h33j44hd7iy8j39k2ahbch7djqejmfh6ggykgzlhfphg;1:9iyhkqjgvqhe;2:tik;1:9heahagj3khenp4pinwhd;1:9jp;1:9iujk4ogswhg;1:aj2;1:7ki8jndiyjhfwha;1:cizfhe;1:8iy9ilainbilcjgehdfj2oh7;4:8hfghhjm3nikojgqgqrhbwjs;1:dj7fhe;2:mim;1:8j8ej4rh7;1:8j1aksbgoij9rhh;1:bjd;2:kiq;3:oin;3:4jz7j49jmdgaeja;1:6hd7hbpggqnqwhh;1:1hhgo1jheqjzrggwh9;1:4j5;1:9h1bk9ch8ghdhiqkjaujw;1:1hg3h35gr6h97h18h89h0ak9chffldgiphgsiipjgwkgvlhfmhanheohepgzrjbsj0tnbwga;1:3jpajhdhcejrrgy;1:3in8imjh6rj8wka;1:oiypha;1:riv;3:jjynj0ohgwjw;1:0h0ahgfkg;2:cik;2:8jc;1:0h68gj9m0alfbh4ch4fh8jgdkgxmitoh0pizqkwwj7;1:qj7;1:3h74iwwkm;2:oj0;2:7in8kmagkch2dlcek6fjnggmjk8kh0qgqrj3sgsth4vhfwgl;3:2kl3h47h48gf9j7ah3clgejcfimiiojj9kjilhdmh7nhgoh5pgyqgyrjbshevhcwfy;5:nip;1:7jq8jltin;2:0h11h43gx4h55g76h37jx8lyaggbn5cgxdf9ejgkjamh3nhgoh8pgprfgtk0wk3;2:1hejh1ljloj5phfqj8wk6;1:8h6gjy;1:jhfpld;1:4jl8jj9haah6hhdjm3ojasggwhd;3:1h62hg3gh4ke5hf6h18g5aggckwdgzehfgkahh7jkqkgqlh6mhfnjxoh9pgzrl3tlevh5wgk;3:3jwjgxwil;2:dhbeir;1:dglemyuj2vhf;1:1ko2fk3h54h75hd6gz7r78jkagrbgfcg2dh5eh4fh4gjihh5jkakgqmgxoippfnrhgtgsuh5viowko;1:oiu;2:jjqwh6;2:6j7jj4tikwgz;2:sk2;3:jiu;2:rj7;1:1j32iu5iv6j67is8iqaipbhfnhhoimqh5thcvgwwil;5:mip;9:fm4wh4;1:diz;1:8kq9jdpir;1:0ji1h17iz8h59h8agyeh2fjtggqjiqpheqj9rl6tjduhewj0;1:8lo9h6;1:5lj8h09iwjhgql4wh9;1:8ir;5:4jx6gi8h09j8ah8ohdpknvjdwh4;1:9h9ch4eijfky;1:0j6;1:ajabirgj7jhg;1:oinvin;1:9h6alucikejhghdjj4rg5sliugvwh0;1:0he1hc3h54ha5n46j87kpafmch6eh4fgqggphliijcjh1kh4lggmh8nl7ogtpgtqkmshgugxvhbwh6;1:1kc2grjiu;2:fiuvj4;1:riq;1:6j4;1:tip;2:nikoitsj2wik;1:jka;2:3kbwh5;1:1ivah7bhbrkz;1:3m05kk6jx7il8h69ilafwcm4diqffuoh6pgvqgsshguj0viswgb;3:gimmkzrg6;2:8iltk0;1:5jc;1:8hajkkqh6;1:4jrtimwha;1:fk8qjsriqth6uh1;1:3hg4gw5iq6hdagebgmdh4eh8fgyggahlzjjgnlloinpl1qjdsk5tgnuh1wfg;4:3h54hc5kf6ha7hd8ip9kcbh0ehffgpgl9ih7jfzkgpmh9nisohcpjzsiztjovitwfz;1:8gu9j7mhg;1:2kx8iz9imjhcniloiqphaqh6rizwin;1:cinfitjil;3:8hdjlowhe;2:djweg8;2:aj3fhgoimuis;3:bk2;2:mik;2:2ip;1:ajf;1:6ggbkffivuitvjjwh9;2:8ghahgchckhepm5qhbwkg;1:2ix3iw8gw9jwchbfjbuhg;1:dim;1:jj2nim;4:bh7ll7;1:lil;2:0j8;4:2gz3j94ka5jq7jz9hgbgockfditfjahhdjgkkhfnhesiquhfwgb;1:9hhak0kimnja;1:aj3lj3;1:kil;3:2j2;2:9imej2;1:jhekiloh8qk1;3:8henleoikrj4wh6;1:5qndhbjgkwh7;1:1j0;1:1jp9infin;2:aipcgphiyrjy;1:ghaqiztil;1:fkkuha;1:hh3jkv;3:1ma3h84hd7j5bk6eijgh3hjgij1qh5rh7wgf;1:2j5eippkp;1:fiv;1:6gtupwvem;1:gk6;1:0it1hc2h37j29gtcjgdgxgggih5jhdnivphgqirrh4sj4tj3vjuwg9;1:chgditjir;1:qjb;2:8j2;3:ak5chbdj2fgrghciimjgikmpljgngxohdpiwrhauio;1:4iu;3:dh1eja;1:6jmilnjhcqh8wgn;3:jk8whg;2:rm3uik;1:fj8;1:1jhak6bh5;1:rj2;1:8jf9h2giz;1:qki;1:1l78fz9llkhg;2:3gv4hd6hd7jr9j2bjldgyfk4gj8lgrogtpheqimrj4shbtgkug5viu;2:gipkix;1:lip;3:hil;2:ojd;1:aiu;1:jouwf6;1:fkdsiv;2:oj2;3:8gs9l4cgy;1:8hd9ip;1:ij4;2:dil;1:bjughghjqpkc;1:1iq6l88h49j7dhggj5hgxjgmkkkql8rh7th9wga;1:8h8gjetjy;1:6guvj7;2:ofppm9;1:4jk;2:2imggdqjj;2:4hd6shjgzphcqgnwgd;1:ciu;1:rir;1:2lg6hc7he8hg9j0ehfhhejixmisohbwkc;1:4je6hg7fr8gzkhgon9pk2;2:9im;1:kj3;1:eithiquj2;1:0he4kqjhhsjq;1:6jg;1:8ip;2:viz;1:1hc9h2aj1bhfckgfgvhl3ij4jgykh8mhephcqhbriusk8;1:8j3;4:0qf1io3frijjjh5qiywh0;1:ljy;1:six;1:1g63gs4je6h18h99h9cj1giyhjjjh9lgznl6ojaphfqhfsirth6;3:cgxghbhjprk5;1:8j99kcajibkscjgeh0fgjjhbkj7nherh5thf;1:iirkjj;1:jiltkjwgf;1:0ln1eu2h34hdgjcolgwhg;1:7in;2:bjkcjq;1:jim;3:4jt;1:1hg3h04js9haah5civdk4hiwjjhohdph8qhhrj2slgtheugiwg6;1:0jwah8ujp;2:8jbsin;1:piu;3:3hg8jq9jzak6bjfchcghckikphgrh9tixuj3wh9;1:ajqfhh;6:hikuh5vjt;3:rir;1:8jj;3:7k9aj7bjkfhanjbrhhsimwh1;1:8iydin;1:2k16jlwhf;2:8imlinrh7;1:ij1jiq;1:bhfohgqncwjq;1:qiv;1:hizjiorh6;3:wj4;2:3j28n49gsbj6chddgqghghhaihfwj0;1:iiyjjswhb;1:ij5;2:vio;1:mheoilpjiqhcwjr;1:gj9;1:ajgfhbtji;1:3jc9j7jj8wh6;1:5k7dgngj6vk1whb;1:8jjbhhlh1riytk0;2:jj7qhaukavil;8:jkd;1:8ioah5sj5;1:5izuhbvj6;1:8j3;2:uj2;2:kiywio;2:9g3cmceh2fharjg;1:hhbqj3;4:8j8rin;3:hk2jh1siotjt;1:0im2h64hf6h67jgbj1cgudiskitnhbojwrjy;1:mim;3:jit;1:pis;1:pjh;1:3l04hg;1:cirqje;1:cikpj9;1:4is8jejim;2:3il5h58hb9jvaiychhdj3ejmfgugj8hiknhfqgsrh4shath9ujkvhdwl4;1:mjd;2:7mjwgu;1:jis;1:jh4qkd;2:skl;1:lio;1:gipmjpwgy;6:8j4;1:1kd2he3h97h68ik9h0akcbgqdgkegpfkfhh6jhakkvlkimh0okppkhqgxrewth3uhbvh7whb;1:ejj;1:mjc;1:jjhqjh;1:9j1;5:jke;3:gij;1:hk1rhc;2:3itdhaeir;4:lj0;1:8jv;1:3ivuitvhf;1:hj2;2:0im1g7hj0jgzkhhlmhrguwkd;1:tk0;2:2jt3hb4lr6gf7gp9jdbgzchbdgkeipfgrghchh3ikkjhbkgelh8nh9og3qgmrheul1vj1wl6;1:jis;2:gil;1:ais;2:8h7cipjko;2:hjy;1:0ix4li;1:eil;2:0jg6l67h6qhduh4vjtwio;2:8h9kl8ojkrh7whf;2:8ix9iv;1:3jzeitjipuhd;1:9in;2:eik;6:dinekeqltwh1;1:6haphcqm5wh4;1:oio;1:hjdrh5;1:9gvdhdekkvj0;1:9iz;5:8h09jnbkzcgxejlfl8gg9hilwhf;4:8gs9haaiugjhjg0mjfoh7phaql9thgwjo;1:6h48h2dhdeh7jgkqizrg4sixthcuntvljwjq;1:8is9gyegjih5jgjmknqjjrkpsizwio;2:jl9mgxnkwqhgrj9wgm;2:8jkwj2;1:8h0wke;1:jhdtofwh8;3:oiz;2:tir;1:0iw2jl8hbbh8cjqiim;2:8gv9isuj8;5:bkfehcfgzgjkhjtjgyojnwj9;1:2kr3gr4gy5m66h77kx8im9gxahfbk3ch5eghfjqggqiinjgoohfph8qhetgtviuwgo;2:hgjnilrkg;2:0iy;4:qjy;1:mjg;1:8j3;1:2h13jw4hd5l58ha9gjaipfjhghbhivjh6khcoh4ph7uj2vj9wkr;2:bhfqj2wm8;1:bjw;1:2m93k94hb6jw7hgdgzeirgiojhgpheqhdwgt;2:0h93gr4hebhhiphrirsikwhf;2:birqiz;2:qim;1:5j48fbahfcjaegwhjcmitrme;2:5j1airpj8ril;3:bis;1:uje;2:bgujhhohgpjjrla;2:hgtjjp;2:8jrak1bilcj7dj2eh2ghbjj7oj6ph4qhbrh5wiu;1:lizqikrh4;1:bj2;1:8jc9hdcgrjje;2:jnewh3;1:9hfch4ghfhm6jizrhe;4:jguposwgx;1:1j5aj7;3:6jhagwdjrfgzjjokjyqh6;3:8haahedirfl5glcjivkhalhfnj8qhawhd;1:jkpmkbwh1;3:8jalivsiz;1:ajf;1:9ix;1:jjkuj9vin;2:bkvhikjhglhh;1:4jb7jg9hdahejgnkkuljcnk5oh6pjlqgvwgg;2:2jsck6jhfqhgrhftj8;4:sj4;1:1ipgki;3:9h2ak8ehefjn;1:eixlhdpkj;1:ljr;1:7js;1:4l5bjqej1khgljwqh1rh6whb;1:ejsrhgvir;1:aiwhgurk4;1:dhgeh4fk2;1:6jodj0oiuvftwj3;1:3h75isfk4jgmkh8lh9nh0pnmqjxsiuwgy;1:6kn;5:pj3;1:1harj1;2:1l27hc8hb9hfdjdjnzkimnhcoh9qgewg8;3:8il;1:1j4lm9rgp;2:dioijf;1:7jnjhgqke;1:8ji;2:1jd7ixmilrhbujf;2:jkoqgruio;1:5iz;1:5j3;1:9je;1:oiutkc;4:wiz;6:8gm9iwafrjheshgup2vjj;1:jh9kjbrizvil;3:3iu;2:rglwkw;1:3j8jk6vinwgv;1:0h93ly5lo7ij8f39jsaj5bhfchfdh7egyfp2ggzjimkgbnhfohbph7qh3rikth6uh0vhewh4;1:sit;1:9ghcksfha;2:7ja8jcfiujhfliluhg;2:ojf;1:9k8dhc;1:jh8wk4;1:eiw;1:3hf7hb8kdah4cindh5el3fhfgishjijh6kisoh0pharejsiptj8ugvvj7wit;1:eis;1:7jw;2:dj1;1:gjv;2:jju;3:cj0hkxtipwh5;1:0j61gz2hd4hf6h27k58j2biqckndhcegmfh2hj9igyjjxkj5nhaoh0pgnqh6thcwhf;1:1iqjhgwke;1:gispldrk7uhcwgn;1:givhik;2:9j0ehc;1:7jj8jm9k9ak5biqghghgtjjlphbqh3rh1wh9;1:8iw9hg;1:1h8cjkeipgj2jj5rh5wj1;1:0kx1k12h63ha4g45h56in7hd8jnaj5ck8dj4fgeik6jjtkh3mh2ogppgcqfvrhhsh0tgruh2wjw;1:2kc5kijknwh8;1:8ku9gcahh;1:ciygguhjg;1:8h3tlp;3:aje;4:8ix;4:8h79g1deneo1kisohfpjrujnvha;1:dikehffj8ngfpjy;2:pke;1:qjm;2:3kc8iwbjiwgs;1:8hajj8siw;2:8jtbgwjgvkj7qj2rgswmg;1:dkneh2;1:4jl5j19l1fgtgizjhfqhhrhhuil;1:aipfil;1:4kmciteipfj2whe;1:wje;1:vj0;1:ch7jjfwim;1:pjdwip;1:ejn;1:0hg3h05iz7gd8j49gvcj7divggzhh5jm4oh3pgtqklthduh6vj6wjc;1:bj9cj5rh5tjv;1:sjg;1:kfxnlotm8;4:agefkggikrik;1:kil;2:0il6kgfj1wgl;2:bjtjhftkl;1:bkzch8;1:6h57hgqlu;2:aip;2:8in;1:8gu9jmaitfl2ghbhhajj4kgxmhfoivph4qjtrkqsgjth9wh4;2:0l41h53he;1:aitwiy;3:qjc;1:3k68hf9hbegxqixwlz;1:0hf3he6gz8h7ah2bgwchehh5jgzkiumqanheolopgtqjgrh5shftjcugxvivwgn;2:bilwip;1:8iyaglbisuk4;2:8j19imdj8eha;1:8h09klgiklitwhe;2:1is4jqwhd;2:4ha8itaj6bj5chadikeikfiwggehh9kmlqikwha;2:8ke9h4aharjq;1:qjtwhe;2:ah9bjwuim;2:dheejofhaujl;1:uiw;1:jir;1:rj1;2:8iq;3:olkphg;1:hiz;1:bkc;1:9io;2:9iyhh6ogoplerjgwgr;1:fik;1:0j61kj2ju3h74hb6jf9h0bg5ciudgbekuhiljghkkmlkkmgookdqgyrf5sgvtgxvj1wez;1:8gu9jgcjepk0qhc;1:qk8wh6;1:3lgfg3giujhfoggpk9;2:mjpqkh;1:8fz9kdaj1egkjh4qm9rikshgwiz;2:1jl2he4hfwkc;1:gj7;1:qit;1:jjr;1:7ixkio;2:0it9h4bk0dgqjjhrisuiqvjvwgn;1:bjj;3:cjz;5:3ik4lg9jcchh;1:4hhtj7uiv;1:ojqphh;1:3jg7gw9kgehcim1jhgphdqhgwil;1:8iqoj5tjp;2:bjf;2:3j1;1:fgjgl7mh6okmpjqqjarhgsjnthgwgx;2:sis;3:ahafj8hizoh9pix;8:njauip;1:hja;1:0ow7gxfimggsphgqiywgy;1:7h7jkrkl2wh4;1:gio;1:gj3;2:chcwkd;1:djc;2:nis;1:6jn8j0;1:3im5hh8h8chfehbhj2ik8jh2rj4tnkugdvkiwgc;1:mh6qj3tj2;1:giujjp;1:dgkekrfhapmuwgg;2:ofxpkn;1:bir;1:0fzghcin8pj7;1:7lmphgqhbuj7whh;1:5n36hb7k7bh6chbdilegufh3gjthhaij6kh9miqoheph2qh4rgmtgx;3:3io;4:ij2;2:4j1chfhlsnipwh7;1:0jj1m6gj5jjorf0;1:tis;1:8iudjceg1fisjgbpjqskf;2:0h91k03hc4gr8jnbhgfg5gomhhdjlknheojnph8qgssgythguh9wgb;1:5j3cil;3:6ky8jdah3bhcdgxejtfhgjftkh5llspjdthg;2:tjg;4:uimviw;2:7h8jl1;1:3ji7kojgyph5vjtwgs;1:9j1pj8;2:6jejhgtkn;1:dio;1:cil;1:rjc;1:iik;1:8h5al4kgpql3wh2;2:jjomj9pjqrhg;4:4ki6mmjhgwge;1:tiu;1:0jl8h3gh0jj0qjywik;8:bio;1:8jk;1:5il;1:rit;1:0ip1h53h94hd7hh8k69knagwbkudiyejqfgtgiqhgtjg4kgvlh8mhgnixphbrjruh9wj2;1:plgwg7;2:1ipwjt;1:1hf3m0ajwkgywiq;5:0k71h1vjnwhe;1:1j28iy9h7cilkjplknph5;1:4lf7gmcikjjeojkphcqh7thgwjt;2:7jd;3:kio;2:3io;1:cikwj0;1:ajjfhb;2:6jcnilpju;1:0lo1iy3fo4kb5h79lacj0eh8fhggh3hisjfrkh1mhgohgph9qgqrkqsiltgjuhf;3:7j1kituiv;2:1hg3h27jzagsfgwhj3khholopheqharh9sj1wkv;1:1kr3hb7h68iw9giakrbgwcgydgiegqfkfghbhhdjgmkkzlkvmh1ninokfpjfqh0rf7th6ugpvhd;2:njr;1:rir;1:sin;1:0ka3ha4m48gy9kdeizfingiyjh3khcoh3ph7uh5wha;1:tiw;1:0hb2ha3gu4fx5hb6gt7qj8j59hhbh7ehcgh8ilhjedkhdojeplprgnsk6uh3vhdwg4;2:tiw;1:3itdijhj5rh6;1:0kh6hbjjhqhdwhb;2:0h81hb3iu4ha5h26kn7f1agqbg6fh2hgojj6njdrjgsh7tgqvo6wk7;2:8incin;3:1n9ahgrgw;3:hhbkhbnlerio;1:fk1;2:ekinjb;1:8rv9d6an3bh4chcfgykhhrh5wh1;1:0g12hf3j84h45is6h77h18j89jhajdbocegcfgrgj3hk4kg7mgwnheoh6qkbrfxsfwth7vh6wj6;1:2jf7izkimwhh;1:uh9vjh;1:il2qiswhh;2:jj2nj7ohepjnqhawkn;1:0iw;2:bkqfhegjuhj1oiu;1:6jp;3:6jobinchgfj2;1:bj2hh8pjxqh4rmd;1:0j1aixbjlcjlfh5whc;3:4izah4bg8copfgojjhqhgrgttjh;1:wiq;1:7jc;1:6h58hd9jqagkcj9dioehfjhdpktqhdrh3ujsvjnwh1;5:0hh4kn6l27hd8jc9h6ah5diufhahh7jkeomvpfxqhcsgewgr;3:8it;1:3js;2:ahfbiusil;1:9kgbh9ek1rio;2:8isghgkj0riq;4:wj9;1:5is;3:ojmwhh;1:ainfhdnjr;1:agwfhbjjjlgmrl8sikujw;1:nj2;1:3h06il7gz8kh9h6cjhdh3gjchhfjj1kjcoheph7rheth2vjlwir;1:8jd9hd;1:cj8rhe;1:1hd3gv4jq8l19goak9bisdhaehgfh9hhhiiqkgfmh2phfqiqrh2sjotjluim;2:0ix;1:fir;2:tjd;2:piz;1:hj4;2:qj1;1:0jw1j14h17hg8hegjbhhaiiljglkjcqkatjnuj5wge;1:bip;1:ok3;3:2in8hhbhddgfejngj2iirjhdqkm;1:ojd;5:8im;3:jj3;1:dil;1:1he3hf8h09h6aj1bhcdh9egsfjcjjmqhdunfvjxwhc;1:0h01ke5j2sj1;1:gj8;2:1jv2ka3ka4lj7hadhejh3ojjph4qh8rglwh0;2:2o64h97kd8ikjglmjengrqhdrh9sh0uhhwjh;1:djaeh4;1:hilojw;3:bik;1:9is;1:0j94hhbiv;3:hjewip;1:dggek0;1:jh6wjx;2:eiqfikniq;1:8gm9jdhgcjjgpiyrkfwio;1:3ja7j0qhcsj1;1:dj1eh7ujv;1:olephgqjowjg;1:jim;1:jjkqhc;1:aj8pim;1:bhdhj8oim;5:ej2jl8wgs;3:1iw;2:hj5jherimtjf;1:8ix;1:wip;1:1lkghfhj2qkewgi;1:aj2kj8;2:8hbbhbcjbfh3gldujn;1:8ilwka;2:0ha1he4he6m08gqajbdh9eh7fjjhj2jh1kgyllbnhephcqheriwthf;1:iiq;1:2lq3j2biwej0qh8rgz;2:tjo;4:8h2bj6dhaej8jka;4:8iybheolkphf;2:cj8rhe;1:4iofintil;2:8jb9h6vj0;2:0j3;1:ej8;1:eitnji;1:glajh9wky;2:pltqh2wgw;2:0hg4iq5hh8ir9hfanabjmcgzffuggvhhbikhkh6mixnhgohapheqinrk4th0wh4;1:1h92hf3hg4it8kg9jyajpcg5dhgeizhgqiimjgvkgkmiyngwpgarhhtkfujpwgw;1:riq;1:nim;1:9iq;3:0gk1jh3la4j9bgxghfkh0wmr;2:7jl9hccj9dioeh6nhhrlttjkugpvir;4:0he2k24jg5gw6l97h48jz9h9ahbggmhhaih4jkzkgnlh2mh9ogypgtqiqrivsghufdvn4wg8;2:cir;1:jh1wlq;1:dh3hkurjfwhe;2:pjd;4:pittit;2:0in1pd5jz7gmggokherh7wfs;2:8h19jm;4:jhaqj3rji;1:sil;1:ajwkh8mhgsjetil;1:wio;1:ciy;2:5kyfjghimwhc;1:jiv;1:0gy1h44h25mc6hc7g08frakjbindineg7fj6gjuhkoih8jg4kh3mj3nhbpgxqj0rkqsh3tggvha;1:jkb;1:1hemksrgo;1:8ixbiofj7;1:sin;1:1h03ha7kg8iy9gtafzdl6ee7fknmh3nhaoivqirrl2tgxuh2;1:5j98ipjhgohdrjtsjutjkwh7;1:0je6hhjh8pheqk4wjd;3:sim;2:2hf3he4p88h19hech5ejfqjpwgw;1:jir;1:ogwpl4win;3:0jerjk;1:7itoh8piywhg;2:5ma7hcejsqhcuh6whc;2:7h08j19hcgnojgfkjuoheuhfwh6;1:8isfiu;1:8lr9gd;1:7jcjhdohaqhfwkz;3:0hh1k03h74hb7h59inajdbheciodh3ehghjdjhalikohgrk5sivuh7;1:6hc8is9gregqjhclh9nisojcph7qm5rgtsittipuj6wgh;4:fke;1:ujlwhg;3:jhfqjy;2:8jz9h4aeybjfchedipeh9ggyjkepiurh0skduh8wkb;1:1hd8heciydhaehgfisgfkhjlkinmimnhfrkouh0vjuwje;3:qj0;1:8hbbhgciofj3gikhiyjk1qherhhsj4;2:7hb8gxah6fjwhhhjj6qkprjptjmwgl;2:birmjj;1:8iu;2:1h82hb4in6hd7gs8gb9h4ag9bhddh1fmgggojl4khdolgpgjqj1tj5uixwjp;1:8l2aiwdh7ehbfh6gh3jiqthfuk0vj3;1:bhccj0fj0kjzwit;2:hiv;2:8jl9he;1:4obriowgv;3:2in;1:6greisjhfqjdtiovjswh6;2:3jerj0;2:mj9;3:sj8tl2;1:ujo;1:5jbpj6;2:wlj;4:8hfbkyeh4fh5gjehjfmglojiphgrhbtn8wha;1:5j46hdaiosinuhdvjk;1:cinjiprir;2:5implfwg7;1:fiwqj5;1:ajxpkarhdujowgn;1:siktjh;3:tio;2:9gnah6bh3fhdpknqhhsk2uktwjl;1:9ikbjklj3oj6phb;1:3jd7g58hbeinqlxrhdwlq;1:aivmmnrgswh7;1:eitlkjnhh;4:kin;1:8h39jbbh8kjc;2:aj6;1:bko;1:ijy;4:9ik;1:airqiy;1:ciq;1:eitoj0;1:jiysiw;5:bj3ch1riksj4wjg;1:eitpjc;3:pim;1:wjh;1:8jg;1:jki;1:oikuj1;1:1ij5j2cjgjgy;1:oj3;2:hikoilrjhtip;1:8in9jzah2fhdgk1khfljbrh7uiv;1:pklwh2;2:dj4kiz;3:6hduhevjo;3:8ivtk5;1:giq;1:jj0wh8;1:ahdfh5hjdoli;1:1io5ip9h9niqoj6phfrgpsiptipuj2wgz;1:8kb9gjrl4th2;1:kir;1:tis;1:ekk;1:cf1fl7;2:pit;2:7kwbjmcgyjgymiuwh6;1:9j2biwjh9qjx;1:fjbwiv;2:fik;1:ij9;2:cj4;3:3iw7ik9ipaiobiochaegyfjrjjklhdmh5oh2pl8qh1thdwgi;2:3jkajrjgspjmqherh4wlg;1:8ixiezrl6;1:4ir8go9kqdh1ek3jh5njeojiph9rh7wgv;1:tkz;1:oh1qke;2:finqjq;2:liy;3:ajmfhekh9qiz;1:bimjh6khgogvpk7qjnuixwh7;1:0hb1j02hf3h04h55ha6h67h38j49ftak7bkvck7dfleiufj5gjehkdjflkimliwnjtogopgrqh0sh3vgy;3:ohepjisj5;2:5jb8ik9hcsik;1:8guwkt;1:9h1ajtehefkd;1:8ixdhe;3:6j48izdl1thfugv;1:hiy;2:qj3wim;1:8iqah5ujs;1:3iv;2:cir;1:aipwk6;1:4iybh4gh4hh4jm0lkzqh9wh3;2:1l3ait;2:8is;3:1itvkdwhf;2:ej5qio;2:lin;1:8j7gk2jhbpiyrhe;3:bjakj4rhc;1:9j0;1:1hg8ip9k9aljbjtehbfh3ghekltlhfngqphaqhfrh4thguhbwh8;2:ilkvlpwg9;2:njwwhf;3:wj7;1:1hf3gw5he6jj7h49h7ajsbiodhefjrgh7hhajgjkh8mk9oktpgerg9tgyuikwll;1:8jkgj2rgw;2:fhbgk0;3:2io;1:jiw;1:2iy;2:7jwdh0ekpqheuiowha;1:8h9ejljh9kglnjuolopjurixwhd;1:1inbh4dj4hiqwl8;2:8ip9hf;1:tiu;4:1ir3jc4h55j86h8bjxdgnhgpqk1sk1uhgwet;2:gik;1:cj6;1:rjowhc;1:8jp;3:hipqis;2:aj8fhd;2:8ingj4;1:8inbgwejjfh7gjbkkrlj3phd;1:wjj;1:bitkik;1:1he7jb9jbbkacindhbfh6jjhmh5pgvql6rj3thbwg7;1:8is;2:0iv;1:3hd4j86h77hd8hg9jscj0dhefgmggthknjhdnj4phgqh3rgwsk0th7ukbvkdwgt;1:1h63hg7haahfbj4djoiijjg2kirlhcmh7njeoimpheqh9rkkuh2vikwgi;1:aj5fh8;2:pj4qiv;5:dir;2:2nz4hd7ke8iljh5rh8sh0;3:ckh;1:ail;1:8h4bhgcjcsjjuj3;1:3ijbjrrir;2:riz;1:2ix8j69h9;2:bjgkhe;3:5j0bilhiqjhfrikwiw;1:kir;2:9imak8bgoch5ejoghfhj4jj0kj7rh6wgv;1:9iv;1:8lu9hedgsek8iijthc;1:dh6eiqkj5;5:cilkjbphe;1:9hdah3djeejqfjirhfsiywhe;2:jj0wh8;1:6j88gvagcfgvgq7hherhewhd;2:wk1;1:5l16l6jhgphewgt;1:jil;1:8j1;1:diopj7;4:cjb;1:rkl;2:6l3phbqhatin;2:9fsrl2;1:aj4oj5wit;2:3h66h38hebhgcilthgunlvm4wgn;1:bjwrh6;1:cim;1:9it;4:hil;1:9iz;2:0lo;1:0jb1ku3ji4jt5he7hf8gr9hdbgschhdhggirikvjinogopgzrh7wk0;1:8hgmmh;2:2iq8hfchehipjlaoj0pgorh0wk9;1:9ikij6;1:8hdgk5;1:jjhqhe;1:rjf;1:1he3lt9h7cj1hjxrgusgyuiu;1:8hf9iq;1:giu;2:0j71gw6jm8h09j1ah9cj1dj1jjkrgmsk9uh3vha;3:gj9;1:1gygjunjarh4;1:8fr9l2agwbheeh1fgqgjmnjgrh6tkjwlk;1:pj9;1:1gs3h44hb5he8k69k2bhgcj2dh8gj4ifnkjsljfmhaohaph7rkzuh6vhfwh4;1:dhbeix;1:4kvbgtch8ggbhh4jg3kjpljnoh7qqewg1;3:wj1;1:gj7;1:wje;1:njf;1:gip;2:3gmjkj;2:4gvio4;2:1ix9h9jhckhhlhenfaoh7pperisshbvio;2:3k5bj2dgwgiwjjtqhawj3;1:wj4;1:7nkcjbghehj0jfplionjcpiuqh7rfzwgl;2:ahgfjn;1:8jxbhbkhgpjzrhgsim;1:tju;1:2iwjhcwko;1:7hf9inbjaehbjjz;1:0gx1gy2hc4ik8pg9j5ah8bkbchgggkihajhbkkdlhgmjoogiph0qgprglwgl;1:9in;1:7j7hiqkgzllpnhdwhb;1:mjb;1:3na4j76ha8gy9h2ah9ch0dh3fjcohgrg5tjuuh7vj5wlz;1:0kf3jt5ik6hg7h9agucipgh6iivjh6kh8lj6njergusimthfwgl;2:8h8cfqrk6tlkuiowh4;1:iit;2:fip;1:oj5uiu;1:gim;1:7jajh4ohfqjzvip;3:7j0;3:biz;1:6itgiuoil;2:0je3hd5hfaisfj6ghcplaqhcrgyujm;1:dimviz;1:fik;2:8jd9goiilpin;2:2j65hf8irbjwdhgjjhwh6;1:8isdhheix;1:8h9aksbjofj7hgljilmhcoh4rkbwhf;1:eiy;1:1iv2gq4hf5gt6gzah6bj8ch2dhbeipgh5hh3jkukh1nheoh8pjsrjmskstheuhfvjc;1:qj8;1:aguehgfm6gh8jhepjbrik;2:6iuvhh;1:akegh5milpjmqjsrhbsgtwh2;2:8isuji;1:8j5;2:7ni9j7ckgghbhiojfflinnjdqh2rgbwgm;3:9ik;1:cixtj2uj2;2:3j8;3:vhawji;1:8kl9p0akebhbdh3eh4fgnkhfrh3wh5;1:jj6lj9rgz;1:3k39heegzqj2wl1;1:4iz5hc6hg7hf8iv9j0ahabgnclnfh2ggujl2kh8phgqgcrkhth7ugdviywju;1:2it3it5is9h5ahddjaggoij1mixnhcwgm;2:qjl;4:vj0;1:aivqjg;2:jh2wls;1:8gy9isfil;1:6ldhgqrj7vgswha;1:bjb;1:8j3bjrdhdeiofirkj3ngzqjk;1:1jb;1:qj0;1:5goagpgh3hnqjjbphfqiwuj8viuwhg;2:9h5hjejisqix;2:gjxjim;3:2h34heolm;2:0ir6ikdgohikqixrgxvin;1:qiz;2:oj9;2:ahhfjc;1:5lo6jc8h7gjvhinjgvtgzwhb;2:lim;3:8is;3:0hf1k02hc3ko4h75hd7h28jr9j7ajdbhadh0eh8fhfih2jgxkgvnh9ohbpldqgsrhasiktj2vh3wjx;1:0im1jm8k19gsbgrckedj3egyflbgjpjhblhgphbqh5uh1wh6;1:giu;1:pik;1:9j1;1:4h7bivcj9ij5wh4;2:0is;1:0j15ix7gtaivbinjjh;1:bjelk2nhfrhg;2:8j1jhfpij;2:2ki4ixjhbohfrhgvje;3:5jc8k19k3ahebhfdh4fhcwj2;2:pk3;1:hir;1:gj9;1:8hdbjepl8;1:gj6pjh;1:bim;1:0hh8gx9hcahcbhfdkweo1fkqghbjhdrhfwh6;1:dim;1:4hg5hb8ggjh5mjrokkpktqglwke;2:ljc;2:3kmqhg;1:rik;2:1gbahcbiugiqhkcrl9;5:0jo1iz4h6rhf;2:8jb;2:3h88h8aipbj7ciwdhagk6hl3jh8khcnimph9qhgslpuhd;1:1jm;1:aix;1:fhcgk1hjfogswko;3:ojt;1:til;2:8joafdsl2;4:qkwwhc;4:6gochcdjxegojh7qj9vjkwk6;1:girrim;3:3h58gv9k0ajsbktfh5gh1jh0kiumhenhgrh9uhdwlm;3:8j69hcdkbeha;4:0gz1j13ha8h19j2bjach8dkpek7fjqggpihdkjcmh5nhcph3rggshftj0uivwg6;1:9jkeh9;2:8ip;1:gk9qk1wgn;1:4isajabk0chedh8ejegh9kj7pja;1:8hadh7flhkgwlhcnizriwshetkx;3:eingiojir;1:3j0ejohinrgz;1:dj6oix;1:aizcjsdh0fhfggvjhaqh8rh9sh6tjuujdvk2wj5;1:din;2:ohhpjnwiw;1:7inbip;3:qio;1:4im8ju9j8akobjgcileh9fgknhfqj4rh0wh2;1:0jg2hc3jf4k46h17h48hb9hgagceipfjgggahiojgwkgnmhbohcqisul2viuwgg;3:jj3;3:0ll1j13fo4k95h59lcaiocj0eh8fhggh4hitjgkkh1mhfogkpj1qgmrk4siktgguh6;1:kj8;3:0h91it3h34hf5k07haghghh9jkpkl3lmfmgwnm5og9pg0qgktgxuhd;2:wiz;1:3ir4kl5k67gs8hfmiyokbsgmwh1;5:2fa7mjagxuk0;1:4h8ok3;1:4j5aiv;1:ml2whb;1:fj9;1:jilqit;1:8im9ijeje;1:aiwnjlrh6whf;1:3ir;1:jis;4:wjj;1:okgsja;2:ljh;1:9izpjc;2:jilqim;1:miv;1:cj1fionjq;1:6haqm5wh3;2:7ix;2:djoeguvil;1:9jnciveik;1:jjrrj0wiy;2:0h71kn6khvfj;2:kirtj1;3:hkf;3:kk5uis;1:8hg9hcegygj1nhgrmauhcwj5;2:8gf9lmaindnsegphimjgprh2ug9vjqwhd;1:8h9llf;1:his;1:sip;2:ejh;3:8it;3:5iu8ij;1:4j3jhgrj3shg;1:dguhjp;1:1jikhe;2:bisogfpmvwh0;1:4kv6hg8jg9h8ah6hhcjl6olzph7qhgsggwh1;1:tju;2:9jtkhh;4:1h92jy6gf7hg8kg9h0bkhchbeirgh9hgzmiqnjeqherhbvj4;1:0kxjj5wh5;1:kj7pha;5:cisgk2;2:1j73j04im6jy8ixdhheiniiqjh4qhbvimwh1;1:6he8hgehfuh8vm7;1:4hf8h0ck2ujc;1:1ipkj5;2:vkewhg;1:agobjfghblj0phasjqujawji;1:bjnlilwh5;1:jjtrjb;1:1ir3k28j59h8eiloj9pk7rhdwgu;2:1h76he9j2bh3cj4djieh8hgyjjvsk1vjtwh2;1:vj9;1:qkkwha;1:mje;4:wj7;2:8kp9gthj5;1:fjrpkrwhg;1:gjm;1:3jwjgqwis;1:ait;1:2kp3hg4hg9jmah0cjaehgjjuoheph7uk2whg;2:9j0dipuir;1:0il;1:7kb;2:mhdoh8pm7;2:8ilnim;1:okuphf;2:eipfik;2:8hghh5riqujb;1:6hfviq;2:8h5kj5oj5;3:mj4;2:fil;3:8kc9gg;4:8h69j1eir;2:9ikehgijrsin;1:3ikjgzwjo;3:eil;1:7h68gz9hdbjbckdfjahjnjh3njnqisrhbsisuh1wh0;3:1l78fz9lkkhg;3:8j29il;2:ginpin;1:dil;1:3ip;3:dj9qljwhe;1:rimwjx;1:1jrjjvpjhqgmwhg;1:8iz9h5;2:wik;2:fjnqj0;1:8ivjhetj7;1:jhcvjm;2:wiz;3:8irkiqnj5;3:1ivkij;1:0iv1h62hb3pv4h85ga6j37im8jd9gkbiycgxdhdejdfgwgfthipihhkgunhgogwpgurg4sh5tjyuimvk8wgr;1:8gx9jibit;1:4j1whe;1:3jd8gg9ilaiwcipwjv;4:kjkwil;2:wis;1:jh6mixqivvizwjj;2:jjl;2:hh0rk1;1:tis;2:9hebj9hiyqiw;2:ris;1:8h7gjy;1:bimjio;1:eix;1:3hb4hg6gz7n59h0aktdhgejbfgogg0jgsohfpgnqm3rh6sjeuj4;1:wl6;1:8il;1:1itfixrj2;1:7hb8is9guaj8jlpkh7mhepjrqhcwjg;3:wll;1:7g7ajwuj8wk1;1:lir;1:wjv;1:6fojiwpivqjluhfvkz;3:3h56jf7h78l29g6cindgxekdfh9hkljg6mipogzph4qh4relsimtjsuhcviuwjm;1:9jr;1:bjiclifhdrhawju;2:hfzjka;2:giojinpjmqh3;1:7jpcipfhbjgtmheqjswji;1:7k3git;1:0h11h42h13j14gy6gk7hf8gwagrbgtchaeglgixhlnij1jkzlhgmhgoh9phbqjerjnsh0tgtugfwle;2:rj0;3:bhhwiz;1:jje;2:8k99iuehahjl;1:eivqir;1:0j74hc;2:ehengdplkujn;4:8hdaiqciwlisriuwhg;1:5ipkks;1:0h91hf2hd3jw5in6hb7la8j69j4akibjtcikegxfgrgghhhejgbkjllkjmhdnh4oh6pgsqj3th3ugrwg3;1:4jb;1:khfljq;2:1gn3jnahbfjgjh8mngrfxwk5;1:5gx8mhbhfeh3jgqkiythdwmg;1:8gk9jkhitjjr;1:0hg3he7ja8jf9jwajbbiwch1eh9fk5ggzlitphdrh3tivuj0wga;1:3h68kt9ldah4eh0fhfjj7rjytjouh6wh0;2:0ix;2:8hgjk2wm5;1:sjq;1:1kyghfwl0;2:wio;5:6m27hc8kq9gycjgeilfhglhfphgqkqrgtthguhgwgy;3:ijl;2:6jseh7qjmwhh;1:7jnbl8rgowhc;1:alcfh0ghasjq;3:0hb1j02ha3h04h65ha6h67h38j59ftak7bkvck8dfleivfj6gjfhkejflkimliwnjtognpgrqh1sh5vgs;1:oim;2:dheejnfhaiir;1:gj8rjbtiz;3:dilrjo;1:8j79inajpbizeh0fhdgk7qhbrh1tjj;1:4h45jj6iw8ikagugh9nn4ojaphguhgwhc;1:2ir;1:dh9uk4;1:jj3kjzphfuju;1:sj7;1:0il1ir8dn9laailtl9ujd;3:5j0;1:wj0;1:8j5kio;1:3jfahfgimskk;1:gimjikqk0;1:ujm;1:civ;1:dil;2:3k8gjipj5qjlwh6;1:8k9eioqjdrh8;1:9iyjhfoejqmssip;3:9iy;2:sin;1:5k0;1:tkc;4:kjj;1:uio;2:2hf4jjgk4ojpwhg;3:eim;5:fh6ujm;1:cj8hfzjk9rh4;1:3kp;1:jiooixqm3th6whb;1:bioqj6;1:eiqfik;2:uj0;1:giztip;1:5j7;1:8hd9inaijdh1el5fh1hjc;4:biq;1:0gv1hg2j33ku4hc6kd7pp8jg9emah6bh7dh0ehcfh2gh5hgoihgjh8khgmhbohcph6qgqrjjth7ufvvm1wj0;2:nim;1:1hh3hb6h77heakbbgdckgdhdegcgklhh8jgykh8lhamhgpgxqh0rjgsjktk5uikvj7wgr;1:mh6oj8;1:ij4;1:tjg;2:8isdj7ognpjg;3:8hd9l9ggykh0nm3phgqherh3wjh;1:8jg;1:vjb;2:4ip8h8cgkem7gilhipqjerhcsiltgqwil;2:dgqjkarilvk6wg3;1:0k81il3ju5ik6hg7h9agucipghbiivjh5kh8lj7nj5rgusinthfwgk;1:jhhpm9wgm;1:ainfhe;1:1hd5hb6jc9fwalvbjrdh6ehgfgxgkdhjdigzjfrkghljamj3pgwqintgtugpvgjwko;1:cgyrj5;1:mjk;3:cjuggc;2:4j4dghejugj7hgtjk5qhfvjh;2:fir;1:2ipbjvhjkqh0;1:bimnin;1:piq;2:8ik;3:0m51jf3ha4h56gf7gs8kl9h2agyejofh7gh4hkbjh2khbohhpjgqgjwk5;1:cj6;1:5mc6gkvgm;1:0h32hb3jd4hg5h77gz8kc9mpbg6cjxelcgh0hiqjgokh9mhgohcpharjsuh7vh8wgm;1:ij8;1:6jrth1;1:3ha7kgjhcwju;1:tik;1:hijwka;2:mjc;2:0gq1gq3hh4h46nk7g3ah5biqeh5ggnhjeihfjfakhemlhngmojkqgkrjmsgquh8vlzwhg;2:2h23ki4he6ixah8bldch5dkwelbfghgjnhh2jgzqherh7wg4;2:fim;1:jghsk1;4:8jq9gl;1:5jk7j8cirehb;4:0h01h72h73n24kf6ha7h38h19k2bgodjieh5jhdkgymhgnhgog0pj0qg5skyth1ufuvh7wl4;3:qjf;1:5hecilggxjivmhgrme;1:4k4ehffjcjh2oh3pjoqhesljuhgwh1;1:0j31gh2klahgdhggp5jgdlhgnhepgoqm6rfoujovivwfc;2:3hd6hb7h88gbah2bglch2gkenj6ph7qksvlfwji;3:5izfix;1:ciwhix;1:niqwiq;1:hk8jg1qji;1:hjx;1:vjj;2:dimmin;1:fio;1:eil;2:hg3tkruj9;2:1io3gq4h35h87gi8mh9jnbgzdimejcfgfgiyhimiimjgdkjjpguqh2shctilufovjk;1:gkjwh7;2:qjb;1:6ke7hbah6fjyjh9wkh;2:bh2jkn;1:8li9hdchggjikhg;3:tiv;1:hj2jjeqjhrh5;5:sj6;2:5iu7iljhdmh8qiqwja;2:pjwvio;1:kl4lhfnhewj0;2:dioehbhiuojdrhcwio;1:2km3h45kr7kqbjlfipghdjhelikqgoth9whg;2:hiw;1:1io;1:3jo;1:fgbgl1;1:0hf1ga3h18g29gpakcblocjmfkikfilhfoosphgqh9rg7whf;1:1gvggzjllkiwqjtrhe;1:eh8fftgl5hj5sk7ujt;1:ah2uogvgt;2:3jg;1:0ik9heaiwwk6;3:7iwaitbiucj3qh7wjh;2:ah5eikujt;2:0j0;1:oitphb;1:1h86jjgh1jlnvh0;1:pj2;2:nij;3:cgrhjekgqlmunh6;1:7ljoiuwh7;3:5gzgl8jg2wl4;1:4j88io9mpdh7efr;1:9hfnix;2:8jp9gl;1:nj2qiq;2:iij;1:aghdh8ej5fk8gir;1:gh8rju;1:bjnjhewks;1:jju;1:tix;1:ijx;1:9jc;1:8ip;3:3jc5jd6irqj2wh0;2:ajogglhikjhdohcqjwuh8wjq;1:bim;6:8imfjkojo;2:1jshj7kh0nh4pl0qisthhujzwhe;6:8hdak5iisjh9kh2lk9nh9pjzuirwiz;1:0lg1gz3gw9gzbikeisggmikvjh9khdnkgphbqh5rinuhdwh7;1:0j04hb8il9h5dlteg2fngghdkiqnhfphdqhdrhdth9ujhwh6;1:aji;1:uj9;1:5lg7hfwh7;2:jjxqjewgp;3:sjp;2:8hbchgjjdlknrk4tj1uhfwgz;1:3hf8jd9jsdisfip;1:uiw;1:3ip8hgahcbjddheehefo6ghghio;1:sik;2:1j52gx6hb8h69iobj2ch8githinmilqk0rhgvjpwha;1:fjougw;2:jj0whd;1:3lu9hbdj4eh3jizwgx;1:sj6;2:8lcak3dk3eimgh4qh9rh2timugx;3:mjc;4:piu;1:bjscj3jj2qj3whb;1:uim;1:5jc8j2;1:5k0;1:nju;1:1ir2h94im7h08gmcineh7fipjj8kitlhcph7qj1rgrwka;3:agmgl8jgwsjc;1:8ja;3:1iq3ivwin;1:8jgcjfuj8;1:8klah4bgpclm;1:pixskh;1:0k31l72fz3g14he5h36gf7na8h09h9bk6cgzegrfgpgh5ihbjk5kivoiypg7qg6rjatj1ug1wiz;2:3jd;2:8iwcl9ehdjhgqiw;1:dnzegpfitrhguhf;2:gjfsj7ujivjj;2:uivvh9;1:9j5jhdqh9tkcwkq;1:bikfipjh5rj9wkc;3:hj3jgwpkerhfwje;1:ij5;1:7jahj6;1:uij;2:riq;1:qjb;1:qir;1:4il8h3bn1cgzdhafh7gj4hh8jh0khdlheqjvrhgth5uhawlz;1:3jhqk3;2:rhewit;1:8jk9hcalffhcghf;3:0kz1j43gy4gj7haaj6diseitfj2hj4ih4wgx;2:8ikdj3eiu;3:wjg;1:hheqjb;3:tk7uh5;1:6he7gd8jr9keag8bgwch9djiemrgimjglkgvlijmheoh8rgzsj9th9wim;1:wjm;1:1h76hdkjymixqhgvikwjg;1:1isegijjz;1:bj6jkb;1:bhbrjf;3:3hg5ju8jz9iyikojh6uhgwhg;1:rj9wk5;1:aixwk8;2:7ipaiwbh6;1:1hc8li9ejahddh2fh7gmahhbihcjgykloliomhfqijrh0tj1uiwwgr;1:cinnjs;2:4jw;2:7jhthh;3:3gv4hd6hd7jr9j2bjjdgyfk4gj8lgrogtpheqilrj8shbtgjug5viu;2:9h0fiupm0;2:kinwji;2:1h48ju9gvcgmehgfjvgj1hjpihanhgsimtkk;4:9heahdbjhcmmfh3rh9wjj;2:1fz3oy4guah3bhbcheditfh4hheihdjhboljphfqh7rh4sipwk1;1:9is;1:1is7jh8hf9iraindisfjgghcjhbogfpj7qhfrj9whc;1:ajkfisskg;3:wki;1:3ki9ipsio;1:0hf3h65iv8jiah5bgqgj1iipjggkkrlg7mhfohgqhbrl8tizuj3vhbwgz;1:dj3egwjjbujewhb;1:rj7;5:3jk6k88iyejfkhaljjrhcwh4;1:8gnaixdh8elsfh9sj4;1:8hf9irgj1jhewjs;1:3ik8gqgkehgrjktoiuphetjewhc;2:8j6;3:egijn6whe;2:9jc;1:8iufiojheqj0;1:0hg3h46gz8h89joagpbh5cfvdn7eodfm9gghkgolhgmhenhhoh7ph5qh0rgzshftgpuk2vj3wgt;1:4ivvj2;1:4il9j6pjb;1:0ml2h53gg4g25hb6he7h49iuakibgmclsggrhimilhlh4mh8nh1pgyqgvrivsh3tgxugpvhcwkm;1:3kb;1:fhegiu;1:8gr9isah6jhcsjmujuwjv;1:8j2;1:fkiuh9;1:phgqm9wj4;4:9iylj2;1:biqeip;1:1gl3hf8gp9iwbhcckjehcfjzginhkniixjgmlhdmhgnhgpharkctjfwgw;2:8jn9h1;1:oj2;1:bkthjc;1:3hc7h78hf9irbh6ehefhcgiohh0jj9mheqh5rn5sizuivwj4;1:8iq;1:0h71h43gy4hc6hg8gd9geaoubh0cjhdgjegkforgjqhkkjg1kkuohbph8qgmrgmsh5tgvuguvh8wiu;2:0jm6hd8le9j2agyehhpil;1:1in9iswk5;1:0hg9g2bjgeh3fjegjohjfjh5qjtwhg;1:7ir8il9habj6kilqjhwhe;3:pjw;1:nj1wjk;1:0ip;2:jikmjbrhc;1:ejefjfok5;1:3j45hf;1:9h3rjs;2:8mk9g0cj9eg0fhhhkxrhc;1:sil;1:8gfajfujd;1:0hb1h83hg7h4ah5cikehdgj4lh8mjtnmroixphbrgjsikthd;3:pkf;1:kj9;1:9iogiv;1:bkegiwkhdrh4;1:tit;1:ej2;3:gjx;1:khalmqpj8;3:ok7qhf;1:pip;1:jjwmklrgz;3:0ioohbqj8;3:cjmkgzllorhe;1:9gnckzdogeg5gh6jh2rgtsj2uhfwit;3:6gr7kr;1:8j4hizkiquj4;1:bhgriz;1:cjaggqhjxqipwj5;1:siy;1:3ikekk;1:dix;2:njg;1:3ix8l49j2ahgdj3em4fh3ggphj9jh1qhbrituh7wh8;1:3hd7hbbk0gkzjjdkhalgzqjrrin;1:jk8sgw;2:hitrio;1:2gm7k7;1:uk0;1:9jfbhfwin;2:ojxpha;1:fjv;2:1jr2iq3kg4lf7hfdhfjheoiqph8rgtwh3;1:1k4ojlph9;2:8iw9hg;1:ojd;1:8jcbhejk1rh4uk1;1:3gw5in7k68kk9msagzchcegkfhcghahhfjipkheninphgqh8rjatjhuh1wgt;1:ckfnis;1:ciu;1:ah9hjm;2:qlkwja;1:9haek7fj7giswhe;4:aiyhjpjghqj5sjc;1:jin;1:7jldipej8hhbjgntiwvh9wjn;1:bitoiz;1:wim;1:jiqwiz;1:9irdj8;1:dip;1:lim;1:ajecixfj8pj7sgs;3:wiq;1:jipsj7;1:ij5;2:2hcoiq;3:7h78gyah9fk8jjdqj6riwtk7wgp;1:0ir8kh9hfehbfiq;1:njf;2:7jgahcfg9gkkhiljngofgwiu;3:gj4hiurj1uhdvja;1:win;3:2k96isvj4whf;1:2md;1:uiw;2:ahgbh9dh7em0fkygh6hiqrh3uil;2:8k09h2;1:gjc;2:8j99gufh6ujs;2:hjlij0jjmrj8tjpwh9;1:5ik;2:2jh;1:biq;1:8ipjj7sjg;1:rk8;2:wj7;2:4k3;1:1hf3hb8g69hcak4copdhagh2hj9kh4lhepheqiqrintiyugnwiz;3:eishit;2:8gx9jj;3:iirjhamgrtjiwj5;2:njr;1:gio;1:hhbqj4;1:7l38j29k1ajdbkncj0egzfgjghgjiwkiwnhepheqhfrh0th9wgv;1:8iq;1:fim;1:vje;1:8he9ja;1:2lb6h79iujgskh9lh0nmaoh1pgvqivsiquh5vjkwhc;1:3ik;4:bkn;1:ok8;1:ej8hiw;3:ojh;1:8ioaiocgqdisehfhjf;2:2hc4hb5hf6h57of8k2ahfbh9ghgjgskhfpkoqjauhcwh4;3:aj0fhgwky;1:djgegjhjkuh7vir;1:0iq9hgdhbeh9jhelh7qiwrh2vimwji;2:1n33h17h58iy9joagqdj5egufh2ghbhhbij3jgrkkilhanh5oh0ph3qjyuh4;1:jj2pkr;3:mil;2:6hc7fx8hfajvjjsul7vh7wj2;2:bgvcjngk6hirjjfkhfrhbwin;1:0ku1gx2l73hd4he7jt8jmahfcj4eimfiwghajh2qh9rhashbuhewgm;1:8in;1:0jj3ix8j79ipajgchaehdqitwh4;4:jik;1:1iqfj2;1:4j88g19kr;2:gjhql7;1:0gu1ko2h23gu4km5j76gx7gv8ju9fyahfbgegisihajgikjylkgnkvofuqh7uj0vh9wge;3:8je9gz;1:lio;2:0is8ja9fzaj2cj2gjhjhckhfmipnhcqjorjqtgxwh3;2:bjapiwuiu;2:qiv;2:4ki8h7;2:8h19h7elahh8plc;1:cjepkgwgx;1:8gk9kn;2:9kkehg;1:win;1:cj7rje;1:1jl2kj7k8diwqh6rgxwgx;1:4m28ku9gpdgcejvjh0ohg;2:6hg9hdagzbj3cgwdhcek9filgh5hhgjgskhfnhbqgtrlztjwumkviwwg8;1:5jijgzwir;5:giruin;1:9jm;2:1gm3ip5hb7h48mmagjck2dhgeh9fh5hh4kgolh1mjynhcohgph9tkvuguvh9wl8;1:ijf;6:5h2niqwk1;1:1l23heoiqpgxrh0uh8wmo;1:fil;1:7h1eikshcwk8;2:ajnfhg;2:4jx;4:ejhiiqqji;1:qjb;1:sij;1:oikuhbvj6;2:iiv;3:7j9cisjlvwfs;2:5kdhhh;2:5io;1:2hh3lc5ivdikhh1jiyphaqiysikthbwhd;1:pk2;4:oj6;1:0h21fb3h84h85he6h97hc8gs9h6ah7bftdhgfk7gg1jg9kkulh6mm2ntaoglqharjfsheugtvhgwk4;2:pjl;1:eh5rk9;1:0jk7hhah7fjwggejjowky;2:1hg6j57hf8hfah4bl0ch7diofkdglfhgukh7lhcph7qjq;4:9hcjhgrhdsn9;1:4k3whc;1:ljs;2:hikmj8ohaqirsjv;3:9iojhdom0ph5qiwthewiq;1:8j8;2:ahdhikrjp;1:8hf9ikgkcwh4;2:1jp5iydgkek6jhekhauk0win;1:7intik;1:5j39h2bitciufjuhin;2:6hf7js8hgajibhech7dimej6fhcijojjtwh3;1:7ijfivmj3;2:hgvjkhmm3phdqkkrhcwgg;1:8gq9ja;1:eitfhhth9uka;2:hh9rj9;1:0hf1hb2g33gv4h75ke6lx7gu8jl9h7bgdcjidjmfk7hj2ih5jg2kh5lhfnh7ognpj3qgdrgnth7ujivl5wg1;2:0hc1h83gw5hg6hg9gtbkjck6dh8fghhkajizkkblhcmiooh5pgxqj0rkougvvhcwgm;3:kikuk5;1:2j1;1:0h11ja2ne3gr4ju5gv6gn7l08gw9h5bkych7dhdehcfhfhh1ih9jfhkhblhcmhdoghpipql5rjksh4th2uh9vivwgn;2:wix;1:0in5h09gybitciqhiyiisjirkkzmhfrguwk3;2:bj7;1:3h87lgah5bgncjbghchk1jj1mjaohbqhbwir;5:2ipgjqthhvk4;2:lil;1:9h2eixfjm;1:1go2jd3hg4h46hd7he8gxbh3cjjghhindjh8okpphdrh8sj6uj9wgv;1:0hc3hc4hd6he7j28h1ah7bhcejyfnegjqhh3jh5nhbph9qh7rgsukdvjmwgt;1:jh8wjz;1:jilkjdlhc;1:7j6;2:dik;1:diuwjk;1:8je9h2hjqsjkuh4;1:7jgjh6;2:1hh8h59ilahgbj6ciohj6ijtjk8qhdriltjywgv;1:6lcgimwha;1:2mobk6chaphftj4;3:bip;1:dj8;1:6hejjgkikul0vfwwh9;1:5jb;1:2ir;1:gk1plhuhcwgu;1:ehguji;1:4izoji;1:8k7;1:hio;1:ghaqki;4:ujp;1:1hbbhgehffh5ghfhinjiznjjqh8tinuky;2:0iybiucijeiuhj1rhg;1:3h47h7iiwjgzmliwkd;1:6m47iscgugikqhauh1vjowgo;2:3hf8hd9joagocj3dimehejh5pkdqjwrh2ujpvjgwfx;2:qjd;1:1h79jnfj9rjh;2:7jq;1:fjwhgrtjswhd;1:8ku9il;2:0hf3he7jw8ivaj1dh5eh3filghahj1jimphhqhdrkgthduj5;2:7k08ildj5eh1thg;2:kj1;2:aitmjb;1:1h32io3h54hg5iw6hb7gu9gqahcbk4ch5fflggvhhdihejk4khflhgmgxnh4ojepikqjgrjstjcuhewme;1:hiy;1:2j33h64h25hd6hf7hf8g59hgakabh3ch1dh4egbfjbggohk9ihhjiwkgxmjinh8ohbph3qh2rh6tkjuo0vl7wfl;4:8ixdit;1:8je9iroik;3:iir;1:8hfalbghbwhb;1:pik;1:iilmitrip;1:himmoinh8wf6;2:0hd1gn2hd3h86hb7ke8kl9l0akublgegnfgjggshh9jh3kiwlh9mhanh6ohfph0qgyrj5sixvhdwg7;1:8g39gpbizemikkmrh8;2:eilkhfnmc;2:jj8;1:7ip8h19iwbimjj2qj4whd;2:cirpj8;1:1jeghhllmnhgohd;1:diwlik;3:eiz;1:hj1;1:aiufhggk3;2:dj1jj1rjj;1:5ilhiz;2:wir;2:9heag5bjpch9fjjnklqj6;1:hj8;1:1gi3k35hd7h78kz9lvagucgzeg4fgxggfih6jhckg9lh6mh6nguoh9pjkqgirkiskxtimuh3viywkf;1:8hdukd;2:tin;1:jis;2:cij;1:lkwwhd;1:jj3;1:ais;2:wjr;1:8hgdm6ek4fh4jk6kioqh2rjvsgtthhuftwhc;1:bim;2:dhaeja;1:2jo;1:jhcqjqwjy;1:2gp7kg;2:8h3ahhoissinujg;2:diweh6;3:qjswhe;3:wkb;1:jiz;2:dimehg;1:3hgdhajjamjpphdqiowjj;1:5j6;1:ij7uiq;3:3he4j87kw8h2ahabhfgh9jgtkkrlj9njhoh6pjiqgrwgr;2:6hd8ks9g8ahfnjnpjbvk2wh4;2:tjt;1:iipsizwj2;3:gh7riusiq;3:9j2rhatj9;3:ggxoh9qkbwkr;1:hiu;1:2h25p76g17jmjjaqhbvgawgv;2:eiq;1:ch5fj0rjp;3:wij;2:1g54kg7h18h9bh8chgeiugllikfkjnlisngvogmph8qj5rj3thcwg9;2:6j98iuajfwhf;1:0is9iqehf;3:7g8wke;1:2jn4it8jd9hbbgzjgukj6qizrhdwju;1:qj0;1:pjh;2:diqfj3ghf;1:hil;3:bjj;1:8hgdiowiq;1:3ol7hdhjajhcph9wge;1:2ik7itjikwin;2:rimtjf;1:6k47kg9h1agtchddg1eh3ggqhhdjgmkgcoh3pgyqkbrgzsghtgiuimvoywo9;1:piywjf;3:5je;1:ginjiulisqgfwjd;1:ej8;1:5k3sj0;1:diveh5;4:8h9bjschbeh1fmrggyjh7lhfnhbqmlrioshatgwuh2wj9;2:5iknjh;1:7hdwk8;1:3hg4iv6j58fhbj0ciydlneljghghhdohbqh3rh3uguwjp;2:ciukhcnkz;1:bk6rh3;4:dgzejg;3:3l48jr9h9disehewha;2:8imlil;1:1kaginhinphc;3:ch4hj8rj5;1:0h51k42h73gz4h65h96h27h59gealbbkjcl6df2ekigjhhl6jfdkgxmj7ogrpgpqgwrfvsgyvgqwkx;1:aiqojp;1:eij;1:0j9;1:aguflk;1:aj2uhgvki;1:4im;1:8j1jhekh9ml0oh7pgyqj3wit;2:2ivshe;1:fgkgju;3:4hdiiyjivmj5;2:1h53lu4gs5jk7jc8k69iucgpeisfgwgg1hgyih6jj3kg2lh7ogtpfxqkmrg5tlwuirvikwgj;1:miv;1:plgwg7;2:pj4;1:oin;1:jjftiswha;1:wik;1:bn7chegimkh8lh7;1:dh8jjs;1:7h3jl1wim;4:3h16og8im9fkehbjhdthcucfvrjwgh;1:2me7jb8ixjhfoh0;3:dhcekdfhc;1:0jkaj7fjejhgrh3;1:dh5ejfgin;3:8jm9hgahf;1:3hf8hbah6cisfhdmldqhcriluhfvimwjp;3:1h13ix5k37j19h0bkvdgtgj3hh9khhlh1mjdogmphdqgrrgvslcwh2;2:dhbeipqjcvilwil;2:ejxoinwjf;1:wir;1:8jh9j5eh7hjfjipqjbsiswgo;2:1it;1:1jd3kc6gr7h8ajphiojgjqk2rjtwg6;1:wik;1:dgnelhqisth7;1:8hcaiseirfik;1:0hc3hf4it6hd7jaaiybiych9ej0fipggrhhfjkjkjulheokupgnrhethduhgwgs;3:5ja6l57gxpkeqhcsiwth2vj8wgo;1:1gn8iybiock4ejdjh5lhhqj7rkr;1:dj3;2:dj4jgrrj2wj5;1:ah2ukgviu;1:2l6;1:9ghdjuelkfj2ghc;2:qilvj4;2:1jx2ir3kg4lf7hfdhfjheoiqph8rgtwh3;1:ejv;2:aix;1:1ji5jdjhapjhqhgwh0;1:0j61hd3ji8hgejnfhgjj4lj7siluhewil;1:9j5fh8glnwh7;1:wiw;1:sin;1:8pm9h2bh1rhbtgyuij;1:mjr;1:civlkc;2:1ik6in8j2agxgh0hipjhe;1:bhglkl;1:hh9ql0;1:jhfrlewh8;1:0jg;1:tka;2:hhdjio;2:qiqwk0;1:hgstju;1:7mj8j9wgt;4:qjs;1:1iq2jh3h54kk5hd6ha7gx8ij9h1bgtch9dg8fizggohgriixjfkkltlk3mhenkhojspkzqghrg1thfuipvhbwf6;1:6jjagvdipfhekjxwjy;1:1hfwj3;1:oj4wj3;1:gin;4:1ijjj7;1:njd;1:7jb;2:aj2piruj5;1:ris;1:8gu9j9agzfkjpl4whc;1:fk0;6:ajtbkwch0dh7eimgh1jhgkixpizqj3whb;2:0iy4jgjk1wh7;1:3j88ikajedheeh4fkhmherh9;1:ciqwjd;1:jiy;1:2ot7gnwh0;1:qkmwhc;3:jj1;1:9iwahf;2:tj9;3:4k2;1:4imagybk0;1:8j79ikaiymjztjiwhf;4:wj5;1:fillhcwki;2:kin;1:3hg9kcdh3jhawjy;2:gjf;4:lj2;1:6jmwhf;1:2n24ip7k48imhh9jh8rh9wgx;1:3ij9jiejq;2:0hc4he5iqeisfh6riqwiy;1:jl4niqqhdwik;2:3gm4j17h4dgxejmgh5hh0mj5pjgqiktjnwgb;1:0ml8h69ikjhbngbplbqh8win;1:jil;1:wik;2:tj9;1:3ha5jt7g28iz9h5givjjspikqh6wkd;1:gjvwhd;2:8hghijqixtlx;1:qit;1:6ha8gqah1bh6fhbhh7ijcmhcniyriqunivks;5:3h06hd7h4aj5dhgfgoghgiiwjgqkhanh6qh5rh2tk8uq8;3:8gywkd;5:qk3;1:0kfmjjwhg;2:gj8rh8wlg;1:eip;2:cis;1:aiocitvil;2:3jm;1:cijeithj4whc;1:0iy4iodh1ekooiyphbuimwh2;1:0hc2gs3iw4hb5gx6h67gc8jt9h8agibmicindglfgbihajk6kgdlgomjnogkpgsrjctm1ugpvj6wix;2:4j45ikaimjhg;1:fjtjheoj2phfwjg;1:8iq;1:jj9uin;2:0hf1hd3j24ha5jc6hg7hb8hdbgycjmdk8ek2fhbggwjewkghljdminnosoilpguqgyrhatglugfvh4wk8;1:8gz9j8gj9hj5qhcrilvix;1:gisljtnj1wh8;2:jh9wja;1:hh8qjf;3:din;2:gjl;1:6im7fork1wk1;2:tlowgx;1:8ja;1:8jy9ischgeh5gixhj7jhhrixtjzwgu;1:9ilgj1;4:9jxcitfh3;1:9j0fiw;1:1jijhdkjjlimmhfokxpj3qh5wh3;1:4jl8jj9h9ah6hhcjm0ojasggwhc;2:4j6;2:ahefj6lhcwkh;1:6im7jpjhgmjjpiorh3tj2uhf;6:niutio;2:gk3jl1whe;1:eil;2:hhfimj;1:jh8wk7;1:3jm8hcairffxgguhk7jg6ol6pgzqh3rh9timukewj2;1:8iy;1:pjqwjg;1:ck9hhc;2:2h57j7;2:8hd9jmcitulhvh8;1:8kf9geahgbjw;1:5lc8k6jh9kh7whf;2:2gd8iw9j7alsfglkheoj6pj7rhc;1:3he8k39mealhbkbegvfgrgh8jgqkjuoimpheqizrgvugnwgn;1:wj0;2:4l1ciogg6jg2ohfqqfwge;3:ah8rj7;2:8gz9khak4bh5cj6dksegwfgrjhdkitrhbuhbwix;1:cisfhf;2:fj0;1:8ipkj9;3:1j12j75hh6hf7hc8jt9fofhbggqjj4lhfmiknh2pjgqj2sjmtj5ugrwgv;1:8iudhbeje;2:2j04hd6sg7hfjgzohfph9qgnwg8;1:4ip5ln6ivailghfjgimkbohgthguh9whd;1:3h57hg8iz9gualbbk8cioeinfgwgh1hh3kkylhamimnhfqlesh4th4uh8wgk;2:4ix;1:1kl3iz;1:7jcqik;1:3inbhdhj8;1:2gu8ha9kxbireiojhdojj;2:8h5gjujlwpipqh4th5;2:7ki;1:gj6;1:3jv8h59j4ajbgh1skbthc;2:8hbchbej4hj2jhcrjbuhavjo;3:3j78jh9hebkjcjbdkbegskh4qhfrfquhe;1:1h33joaj6dhgghdrj6;4:viv;1:hk3;1:jjelin;1:8hb9iy;1:7k79habjxdgueizjkeqh4;1:uh9vkg;1:5j3cislin;2:ciukhcnkz;2:iirpir;3:jj4;1:4ip;1:jh8rk4;2:3ik;2:vim;4:5lf7hfgilwh7;1:vj0;3:ujm;1:9ivaixch7fjetis;1:jjxnj0ohgwjv;1:0iy1ij8je9h2ditej0fj2gh5kgvlkjqhf;5:7j18iloj3phc;1:uimwit;1:ajdcijqj1;1:3im5gu7hf8jb9h3ah6ciygh0hisjgvnj0ojhph2qkgrg9tgw;5:jjc;1:ej1;1:2j4ait;6:qjl;1:ainbjxcjfggnhijkhetil;1:aiqsjc;1:8iy9h9bjqcj2gkfsiywgy;4:fhfgjh;1:cj7jhb;2:hhajhglj3qiwtjf;1:hinril;3:qjwrip;3:ogypk0;2:cj6;2:0hc3j17ki8gy9haahdbhddmfeh3fhfgh8jj6nj0ph4ril;2:qk2;1:ujp;1:1h73hc4iu6ml7gy8iz9h4ciqdj3eh9ggpjgnkj2ljrmhhohbqgvujuvhg;1:0hb1ju2hc3ha4gd5gv6h57hd9gcagsbgrdiyeh3fingguhhajgvkk2lllmixnmxoe4pjkqgxsk1tjfukjvgrwhc;1:8ha9jtjixwio;2:ej1jjltil;3:1kf;2:2jf7jm;2:1il9glbh6chhgj3hj4ijntkq;2:4ixohhsjw;1:2jg;1:9h2aj4fjujj5;1:1gr4kj8gqfivjjwogsph0qnfrhesh6wh9;1:nip;2:3jleir;2:0kbch8rip;3:hh6riw;2:4ip8jqdjnfioljdrgpwh8;1:8is;2:ak4;2:cjjhherhesjrwko;1:bj2;2:6jh7h9aimvl5wh9;2:pjpqh5tis;1:8hakl9;1:chggijrh8sj1wl8;1:8ld9eaciydhcfhegh3jh0kl3lirqhasj8tkhuimwgy;1:aj8gh8jh4kh9ll5njyogupl8uhgwhd;1:eio;2:3jafh6jkk;2:8iyjip;2:gixwjk;1:9ij;1:wj9;1:direhc;1:3h87lo8itbgojl3riy;5:3n17ix8h89h2bkpdjbfhehh7jh2qh9rj4wgl;3:ejqlioriq;2:cjq;2:0fqik4win;2:7gpgo1jgfuhawhf;1:1ji3jqjhgrhdwkh;1:cj4mizrhc;4:eh5jm7;4:mj2;1:birrj5;1:rir;1:7h99gjdjsejighcjjgqj4thfuk1wha;1:0h33ip4j36j77fk8ks9gvdkgejnghghgljhekh3lh8oitqiorgoth8uhgvivwim;4:5ji;3:jio;4:2is3gf4gv7hc8im9gqbgmcjedgvffygh0iiljilkg1nj0oj9ph3rjnukgvjvwil;2:mh4olcpkbqhfsj5;1:qkj;1:8j2bjpdhceiofiwjh7kj1ngzqjk;1:0ha1ls3k47hf8jj9h9agxcipfg7gguhgaihgkh2lh8mhhnh2ognpgzrfrsjoto5vhewlb;1:fj6uiw;6:ojj;1:6gmjlbvjlwgj;1:1j2rh3;1:1jy5ha6iw7h78joagnbhhcltdjseikff8giyiitjixkg2mhangxogapgnqh6rjkshctgruh8vixwki;2:qiy;1:jjdqhe;8:vis;1:uiq;2:7ip8hb9h9bhfegwrirumjvjy;1:dhfjk8;1:0iv;2:0kiqhg;1:2j8;1:1jv;1:5k66gl7h28jw9jlbjfcgmeg4fj2giyhh4kirlh3nh6qgxrgxsiytj0uipvirwgr;5:1h9qn5wgy;1:fis;2:jkboj2ph5whg;1:0h61ga2hf3gr4gm6g77ju8k1ck0elyfhggmiih0jgqmh1oh2ph6rgjsjztgpuj6vj0wew;1:6jh;1:4kjaghbjbnj0;1:bhcciqris;1:min;1:8ipgis;1:aixfkbrh3;1:piu;3:jj4;1:8ipnjg;1:7in;1:1gr3hg7he8hebgtjhekm3mkuoljpk0wgl;1:ilgwhe;3:8h0kk5llcripwh4;1:gis;3:1is;1:6hevh8wjg;1:6j79heahdcj8gj1jh2nitrimsj8wgx;2:fiwuin;3:fiu;1:dhaeir;1:bj8;2:8h9gjemjgqjxtjiwh2;1:uix;1:mj3;2:8iu;3:liq;1:jk4ojopha;1:8ij;2:sj6;1:8jf;1:tiuvj1;1:ojf;2:hh4jj3kio;1:il2;3:jh7wl2;2:miq;1:oj7;1:fke;1:dgweh6fmb;2:dik;1:fm4wh4;1:8gg9j4skl;2:5k5ahgghhhj2mjfohapgyqh5rjnwj0;1:wj1;1:7mfbkyhjnjhgqh1wgq;1:fh7gk5qjrwgq;3:6mtwhe;1:0he2hf3j04h25gt6jr7jv8kp9gsbjacg0dgwem4fg2ggthg3ih3jj2kgzlhfmh0nhfognpinqjariqtnavh8wfk;2:1h04im5gx8il9gmbfzch8eldfh1gmojj2khbph0qh6rl0sk4uhdvhgwgs;1:4intlh;1:fllwhc;2:bkc;1:8hgjl1qhdthg;1:oji;1:rj6;3:6hfvip;3:9ftrl2;2:pivvil;2:3ik;1:0kj1ix2kf3j05jx6gz7fe9h6aggbhceh5gizihcjk0lh4mh4nhgoglpj7sgwtguujcviywh3;2:1heaguckifkpghgsil;1:4ir;1:1hc3hb6k37h08fp9k5aimbgudjsegxjjhphfqkmrkkthgugxwgj;2:9kehh8jj3qit;1:fmbgee;1:qj3;1:bhfck3jhfkh4njroh7pm8sh8whb;1:wj4;1:8j59hfaggek0fgfgo5hhdrhbuh9wiu;1:rjg;2:qjd;3:eio;1:jhbqiowiz;2:5k16jajhgvgxwj9;3:8kz9guaghcmsfh4gguhfpkkglkhnhgphgqisrhcsh6th9uj7vhhwh3;1:cik;2:1hg8h2gp3qk0rggwh6;1:ch5rix;1:7kgjgw;1:4lz8ky9gqdgcejvjgzoitphfwh6;2:8ha9iueippk1;2:2h43jf6hehjiil3pleth8whc;1:1hf8jp9jwaipbjidivehdfj3ginjhgkinnhbrg8th6vjgwgo;4:iik;1:ukm;1:ah5fikjjdpjlsgc;1:9j4fk9;2:jh8pl5wik;1:1jjwh7;1:aiswjf;3:1m04hg7hhahebgwcj8gh4hh7jj5kkwnj3oiwqh7rh5thauiqwg5;4:hj9sjluh5;1:qin;1:kiz;1:dlpega;1:girjjs;1:8jm9gqahabh9ch1eivfl6hinkjtwj0;1:7lpdiwjhbtimwgq;1:ek6hgk;2:0jz3hd4hg5iq8jt9gjbgmjg3kj5ljamiznhgojcpgvqgosjqtjxuhdwh1;1:8h19j3;1:qiyrj1;1:ij1;1:6j78gqehbkm4nhb;1:0in1ik3gm4gl5hh6h97h28gxahabjocjefljggxkgdlp2mionfroh3plpqg7rgktgzuio;1:9k1egdhjhkjyliynhhqhdthcwk1;1:kit;2:bj4ch3fix;2:gj4jhc;1:cirfjf;2:gipil2;1:dh1ejd;1:cjhhhfuj1;2:6ishjk;2:9je;1:fivpmsrhfwgj;2:0og1hb2gr3gc5h66gj7g89ikajqbh9cklehgfheikkjf0kjclgumh8ngrokepgvqm2sgrtguugavh5win;2:hgprjg;1:4hgsiquit;3:3hgaj7bireh3fkfhiokhhlhenhfrjeul5;1:blffh7gjmhjnojr;1:sjg;1:8kl9p0akebhbdh3eh4fgwkhfrh3wh5;4:0iw1jd3h27l28jh9jrbh3dgreipghahgumh4njfogzqkargutgyuh4;2:5k6gikjhaqjzwh3;1:2j9;3:jilrit;2:rj3;2:1ik8j99izbh0dh3jgoll1tjwwhb;1:gizkjfmhf;1:9ligjcihe;1:1hb2kb3jp5kb6hf7j08h39hgaj3eh0flegh3hiqjh4kh8lh2mhbnhbogxph0qhcrjxsgsuj2vh2wgi;1:6ilaj6fhhoinqiq;1:1iu;5:rjs;1:8iu;2:firqjb;1:9hegj3hilwik;1:9iy;1:0ji9guekv;3:2he7lpwgv;3:5kmcgxhinrjq;1:5hc7h9ajbbhhgkchhakhglijmjoqk7rinwjl;1:2ij;1:0h43he4ml5j56j17iu9gxahgbkcch7ehffh1gjrhj1jgqoiyph4qh9rh8thfuhe;4:3jbqhg;1:1ir3j94iqkj6wh5;2:fh7ujb;2:5ix;1:okc;1:eiofik;3:bjekh8nkjuij;1:bj5;1:8hdhlmjh3lk5nhfphdriw;1:fimgh7jkdwiu;1:0itgiurik;1:9jb;1:biw;2:8iooip;1:bjb;1:tk7uh5;2:diwehb;2:wij;1:jk8ph9qhd;1:uij;1:bj2;3:dhceis;2:0jn3gp8j4ajm;1:2ip7jp8jkchg;1:8it9gvakhkh0qjirjm;1:3j4;2:0j1pk2qhf;1:gjbjhdukd;3:oj5whg;1:4km6hb7hf8jf9j5agxek5jhbohfph7qh4rj0wj9;4:8j29habip;1:6kh9iwrj7;1:lit;1:7g8jke;2:0h11gz2lb3gr4mj5h96gq7im8jq9jdbh1dhbeg2fh8ggohgojh3kh3mheoh8qj4rfmujyvjawkt;1:cjcrhe;1:1hfahcfkqgh1mj8nmlrirwgb;2:8gx9godlmegkhgqjjmkizvit;1:hh9qjr;1:bix;2:ej3;1:dirrj5;1:chbeisghchiwkj1tim;3:rj0;1:5kg7hd9ja;1:3jmjjg;1:8h7nhdtmh;1:riw;1:dj5ghfjjcqit;1:8k89heal3bk2cglfh9jjpwh9;1:ojc;1:8io;1:bja;1:lji;2:nilpjs;3:9k2ahc;1:8j29ioliu;2:0gw1jp2hd3hb4kh5he6hf7he8ks9g0bljcgkdfoekyfh5hhcjh6khellmmh8nh5pgeqkctgquj1vhawfy;1:nil;3:mk0;1:4jc6hd9j2bh7cnbehafgughdhhhjhelhhpjbqhetj5wij;1:bix;1:hh7jilwjy;3:nilqim;2:nix;1:0ln2he3imjgowio;4:8lu9h6ah5wkm;1:1ik6kowgv;1:tkmwgz;1:jj7rixwhd;2:hj5wji;1:agrfjvgj4;1:5j6;1:0in1gwkhglmkrgowke;1:9hfrje;1:3im8jhdj3ril;1:6h67irbiuhiqph4qkxwha;1:iivjjo;1:5j48jb9gljglwko;1:3ivvjl;2:0ja4hh;2:8ja;1:pmbwgr;2:wj0;1:0h72hg3h84h76hb7hgcj5dhdeh5fhbhk1ijfjkfmhfnk1ok0pjmqgvshdth2ugq;1:gh0pjm;1:firqjr;1:bj9;1:sj0;2:0h96ik8heaizchdfj0pivqgo;1:wio;1:7iqqj1;1:8hc9ir;1:siq;3:4j3ilhjh9wgh;2:0j21l43m94jj5h66hd7h89g5ah9ch4ehafhggiwhiqikhlhcmhboglpguqhcrgksixth6uh0vhgwka;2:7jt8j2cixdhfjjvph5qj9riywgf;1:dljuh1;1:0il;1:2jg;3:3hd7hbbjtgkajjclgxqjqritwhf;2:8hcuk9;1:8h19m8ahbbh8kl1lgxoikrh1;2:5izjgtrjcsizwjn;1:3izcivwji;1:9imrjf;1:5iq;3:6ld8k19h2ahdbjucgydl6ejvffwgkajglkh9phhqhbth8vjrwfi;1:2l8sisvj1;1:qjs;1:hgxjj5kj2uiq;1:ogxpl5wh5;2:8jk9h0jiw;1:jje;2:0jbfiq;2:3o48k09j6egzjheqh9th2whe;3:3jj8iquit;1:8j69h7;1:liy;1:2h57j8;2:6j9;2:agkljirkf;1:rix;1:0j75ij6ha9gxfhajh4khaoktph5qhgrghsistm3uiowft;2:cis;1:cj9;4:3iqjhfwkg;1:4ij;4:vit;2:8il9ixdhdej8pkhrh5wgz;1:1mmggijh8rhf;1:8is9gleje;1:6jmcil;1:8iwaj1sjeuja;4:1jm4jm8kg9gwajxbh5chffgrgj3ijhjhdkgjohapgrqhcwlf;1:8iw9ha;1:2jb5ikliwvggwk0;3:qj4;1:agyhmawhc;2:dilpinwj5;4:dj2fkchj6jhbphg;5:8j3;1:aj1qklsgt;2:2ff7klwj0;2:jj6tj3uhg;1:tio;1:chcfh3hj2jk9klerh1;1:2j3;3:eik;1:dgtej7jituk6wik;1:8hcjjeriq;1:pjd;1:5in9iq;1:iiz;1:3hd4l98gw9hdahbbh4chgeizfilggphitih2lhfnhfphgqjdtiuuluvjrwh3;1:khfljqvj7;1:1iv4jy8h0kktrhc;1:jim;2:0hh1h43hf5j48gyakncgvfgwgj4hjmkfllhgnjfpiwqh2rjatj5wje;1:5j1;1:sj0;1:6heplq;5:1gu4h57h58itaj4bh2cj1dj4fglhjsihgjgskgjlk0qgurk8sinviq;1:jivwhh;6:5h3wjv;1:eiy;1:ujg;3:dimsim;2:vir;2:ainjgwkh8pkaqli;2:gkwjgtohhwjt;2:8iv9jmbh6cgndheejsghchj0jjeljathgviowgk;3:jh9wjz;1:jiwlgxrjp;2:jiyrjjwhg;4:3jgril;1:2j05hfck3ghakkemk1oiuph2rgtwgy;1:aj7gh2;3:cjpdkxeewrhgwjx;1:0h71ke2k84jbrgm;1:8hdgk1vip;1:5iq6k4lknnhhuhhwh4;3:cjdrhbtk7uhf;1:dh9eirmj4rkhwh2;1:qik;1:bisjjp;1:hiqwil;1:gim;1:5ir;2:ljo;1:8kqbgxwj3;1:1ix;1:8hc9ipditehgjk9phcqh7wkh;1:eik;4:birvip;4:0hg6h47kjbh6dh8fhchhfjkikh2mhgnh8olnqjithfuh3;1:ij7;2:hio;1:1is;2:tip;1:2il8hdbkqeivgjx;2:jj6;1:sjp;2:6h18h2dh9eh7jghoh8pk7qiurg3sivthfunmvlgwjb;1:1jhhinkir;1:9irehg;1:dizwj3;1:hix;1:3j3cil;1:9jkaixwjh;2:8f49lsdjpjjpwh7;1:din;1:ciu;3:rk7;1:bivejrrhe;1:hiniin;1:rk4;4:diw;3:qj6uil;1:9j2ahhbjajhfqj3rh1;1:1irdji;2:8hbahgbh1ck1fglgh9hn8jk4mipphfqhbrjvuj2vhfwgo;3:biq;1:gizjjiqim;1:mjp;1:dh0fk1khg;2:gik;4:8h69k5;4:1h1qhbrimwmw;3:uit;2:3jo8k49juagycjdehckhepizriswhb;3:gij;1:riw;1:2fg4hg7p4oh9phetk5uit;1:gj3wjd;1:pimriz;1:lj0rhg;1:1k8ghgkj6lkergiwix;1:fhegjcogipjq;1:hll;1:2gzujkvjzwiw;1:gj1kgxllonhe;1:7j5;2:3kcchaqkqwh7;2:1hg8l89iwaglbgjclreh6fhaqhcristizujavjpwgn;1:dfzekdfhakkn;1:himshbtjx;1:rip;2:2lb7mqqhgvizwgv;1:3he8j39gkcimehhgh8khbmkpnh7oh7pmawk7;1:rj3;3:8hecilgilukc;1:tim;1:9j6jjtkijrhd;1:3ip6ga9h5hikqjdvgwwkw;2:8jr;1:gimwk8;2:1k58h09j1cgohl9pixwh2;1:3hd5nk7k29hcdj0egtjh3pikqh8whc;1:8gnainbh7dhegitjjlrivula;1:kjwmhe;2:5gd7k1;1:9iopizvil;2:1jv;1:1hd4h06gz7lo9hfij6jinpisqhatjsuj1wim;2:0h31kv2j73gr4h15hb6ix7g98h99gvakddhcggzhjhihdjj6kj2lgyngzoiopimrgitk0vjvwfe;2:bij;1:3hb6s28hcdhceh5jgcqh9rhcuh0viowk0;1:jiv;2:gh7kh1nmeqhcrh7tiywj1;1:rk8ujo;1:9jpehg;2:ij2liv;2:wim;1:4iuagrbkhjj4siv;3:mhcojyplwwhd;2:3he8kvvj3;1:iiu;2:ainjiqsjg;1:bhejiqohgpk4riw;1:1iybis;1:0gz3hd4ik8hb9jjbirdkpejpfj9ggtihgkj3mhdnhgph7qhfrgwuj4vinwgl;1:6k88h09g0cjcdm7egwoikqhdwh4;1:1kaah7rkmwhg;1:wjh;3:1il4he7h88h4aikfinhj1iivlgytjlwkm;1:6jf7il8iojgyvl0wh8;1:8j5gl7jh0piwrhd;1:8im;1:piu;1:8j9bha;1:7iy;1:9gnbhgkh1ll4ootph5whb;1:0h33hb7he9hdbl2ejigixik1jhhkhdnh8ohaph4rhbsiyth6ujewij;1:3gu6jd7hc9iubh1hivjkiphgqgyrhdsjxtgouhawlg;2:7j4nkpwgy;1:kjk;1:1gk3l39lsafgcm1dgweh9fixgjchjgjh9khglhamhdph4qh4rjotj5uhbwgt;1:0ntgijjhfpgv;2:8iz9j0;2:jhgrkb;1:6hh8hb9gmahgciseh6rjduhcvkpwk7;1:8in;1:bhajiwrjbwiz;1:pmlwgi;1:4hf6h98ir9gregofhfghghjwjh9khblhgniooj9ph6qm9siruj3wg9;1:9iqaiv;1:7h78ir9k2dhdfhegh4hgzjlxpiwqgyrgusiutmnwgf;1:3j37j6cirfh4jlrkk9lgywfj;1:jk7rlgwgm;1:4ivvj1;1:5lrjlnph8qhfthewh5;3:1hg3he7k48in9gwch6egzgiwjmzmirohcqghrk3;2:8imkjbuio;3:oj3qkc;1:2hg4p6ch6jhcojzqhfwhd;2:8h8cj7dheejvfixqixrhb;2:eio;1:9iq;1:uip;1:7hd8gz9h8aixbh4cjcditgjqhimjiwqh7rhfuizwkg;1:1hgaj1ghfhkljiotjt;1:biqfil;1:tiq;2:mj3;1:1h05imilm;1:wir;1:3jn7jc8h4bh2ehbshftnb;1:rip;2:8kb9h6;2:diqfjklh6rl7tijwh5;1:ginlip;1:1iw;1:uji;4:8ixwio;2:jj4pjnwhg;3:biv;3:ejb;4:3h34j76ge8h1jhanjkpj0qilrjgsh2vmuwhd;2:3ha4hc6h47h68iv9grbn3cjwgh6hgpjgxkjhlllogtpk6qgnrjeshgthcuhdwgu;1:jikkj5;1:niq;1:sin;1:6h7phewlg;2:ol2whh;1:3j07jdakfbh6cishiujhbkhdqjlwh6;2:8h4jjtpja;1:6h07hc8libh5dhbem1ghfihfjh4mh5pktrgbtj3uh3wjj;1:1joaisdgyej2oixphe;1:8jf9j4jgm;3:7mijhhwgs;1:ij7;2:gjg;1:ehggjjplwuh8wh6;2:ej8rgz;1:fjr;1:7ikdgyejwoj5;2:djteio;2:gj1;1:6hc8j3cikdhcfh9giwhh7jinpktqh7rgusj0uk6vjmwgx;2:hh1jjj;3:8h4ah8blccjcsha;1:1iz7k18js9goail;2:hj9njq;1:agkbh4ek5flegj0lhbqiywja;2:qiv;1:fji;1:hinwis;2:dje;1:1ir8jo9goailbjich6eh4gjbhjgjhgkheol6qhcrjewgj;1:jh2piwuirwk0;2:jis;3:0im4h8ah4fhgoghqkiriouhbwj9;1:bj6;1:cin;1:4iy;1:8ipjjm;1:ciy;1:jis;1:dgqeja;1:9io;1:4gk7hg8imbjkdheeimfiughgikyjh6kiznh0pjgqjewh9;1:1hh9kgaj8bgbehdfj6kitlhanjgrhhuh5wk4;2:0j9jjl;1:fjz;3:0j48h2ghgkldnhf;3:8h9bjijh6wko;1:0kf3jt6hg7h9agucipgh6iivjh6kh8lj6nj5rgssimwgj;1:eio;1:ghgjhdlj3ogyqhgrh7tlovimwkr;1:9k5livqisrh0whg;5:8iosje;2:8gy9iuah7umh;4:7j7;1:5kohgprjx;1:ghdwjc;4:fjf;1:8lb9gowj0;1:3hf7krqhgthfwiy;3:iirpitsio;1:fkbgj7wh7;4:kh2plwqiywhf;1:2hdvjj;1:5hgej2jnewfw;1:nimqj4;1:3jq;4:hhfjj2;2:8ilqjl;1:0j21j4giyjjzrh4wiq;2:aiwjhdoh9qjz;2:ck0;2:hkm;2:4hhij1kj3;1:8k4;2:riz;1:0hd4kmbhgjipwk6;2:6k77hccgvuh4vl3;1:8fj9j5amzcgzeh2ggzhlvrhfuhewj5;3:jhaohfqk0;1:8j1;1:9jzahbhiqojcsgl;1:gnr;2:1iutiu;1:ojd;5:dizeh5;2:1iw8gzkkwrhc;1:9ixggpsj8tiuuik;1:0h82hg3hb4h85hg6h77h38ir9gaajibk0cjugjohjljg7kipnjhogxpgwqgwvgy;1:0k56h28hcgk3hil;1:0h41h43gw4ir6kd8gs9h9aoebg7dghfizgiphjwihgjkskh3lgvmh5nhdoglpgjqh0rixsk4ujkvixwe7;1:gir;3:ajhdl4egvfghkiyphgwk2;1:sir;1:aji;1:0hg7kq8hedlsehffirjgy;1:3hd6ipdj9fioggpkj8niqphaqh7uiowh4;1:ejuuh7;2:6k37lm8k7ahhbildh7ej5fhchj8jgxkhclhcmirnh8pgsqgprj1wg4;3:wj2;1:8h5dk7ejaij0whd;1:ijx;1:bik;3:plsqh2wgw;1:5g6wm0;1:qit;4:4j2gjdjh9rjy;2:uim;1:0io1pb7gicizgglkhewgp;1:uim;2:1ir8jj;1:cjbrhd;1:1kkgiojherll;1:sip;2:cj0;1:4kjuhd;2:3ha5gr6hb7h39hdakwbiqch4eh6fjwgj6hgwihgjhgkh4mhcnhgph9qiprj3tm7ujdwgr;1:2l38jfoiuph1;2:8gzfhgghatoywh7;1:4j2bh3kjfvij;1:riq;4:8j8ghgjjp;4:6hg7mvfhhggahh8jhfqlevhawh1;2:0hg3hh4iq5hh8iq9hcansbk0cgtffpggvhhaikgkh4mixnhgohaphdqilrk3th0wh5;1:bk6cjhdjweh7ggzjftojsqkurgmth3;1:3jg5j1pip;1:1g82jd3hg8hdah6bjifhbkhdmg6opnqh7wkg;4:hjorffth9umpvil;2:1it;4:qke;1:1gr2gw3gm4p35h16gd7ja8ikaj6bgjcgxdh5fg3gkohgxih1jgqlhamhangtojgpg9qggsj2tl2ulzviywff;4:dj1;2:ej4sk2;2:2iv;1:2ky8jg9h4ahefguggvhlrjjgmheoh9ph8qgtrf8tjvuirvjiwh1;1:9h2djgjit;1:3he4hh6m79isahbfjfghehjeiimjk4ogxpjwqghsiqthdwex;2:8lpdh6eji;3:4ix;1:tjn;1:8h19k4jjrqja;2:aj7;1:8j1jgvoh4qrjwfr;1:gik;1:5m87haaitjheqh1;1:0hg1h44h06hd7he8jf9mpaivbheckkefkfglgguhiuiimjiomkanj2oh0pglqhgrkzuffwgq;1:wix;1:filghg;2:1io4imajebg8fh7knk;2:1gz8h1alvbh2ch6ehdfgegjril4jh0qherj6tkmwh1;1:eix;1:cirwiz;1:kjh;1:ah6ujo;2:bjf;2:7io;3:1ha2js3h64ms6ha7h48jf9gyah0bkbch2dhbfgrhh0ikmjgqkgmlhcnhdofrpilqivrh6ujl;1:kjj;1:uiv;2:6kpmjkqhh;2:3jp8j8jguwjw;1:ciy;2:biycgwhjpiixjharjswh9;2:mjc;2:sjp;1:2ja3j88is9h3bgpdhcgh2kjhlisohdqiptikuhdwf9;2:8iwrkj;2:2h34heolm;1:8gr9jadim;1:gji;1:8hg9iz;1:oj3;1:6jrwhg;1:rj5;2:4hg5lu7hg9m8agnfh2jgqkgtmp0ohcphfsh5uh7wfj;1:9iq;2:mhhoiq;1:jil;1:7jgjh6;3:gijtlj;1:0jj;1:piw;1:3jv;3:2gv7j6jh3wjp;1:1im4fnehdfj8hinjjmrgyuh8wo6;1:gij;2:0mo6jcah5fh0gm9wgp;1:9hdaj1gjakg6nnwpimwhc;1:civwli;1:4ivtil;1:jgeqjpwjp;1:8h99lbakdbhfcgkegpjgjkh4milqlfthbuilwin;2:sipwj8;2:2j93hgciydgcekyfirjhfkixmm2nghthfwgh;1:jl1oha;1:ujn;2:8mpeh3wiy;1:8jo9j6dhaeitqjhrhd;1:8gy9juahcdgzejbmk3qhgrhath2ukhvjvwhe;1:ck6hh9jinmjhuin;2:tixwhc;2:dje;1:cheriw;1:bimpiu;2:fjmuj1;1:djcegrpk3;1:6kf8h39h7aiwbipcirfjpghghjywgz;1:jj0wh8;2:eh8hiz;1:kh9lm2rhbwj1;1:riq;4:1he3j57hf8irbirch8jjqkkdlh4mgonk7pheqhgrjlugxwiz;2:9hfaj4wit;2:9ipmiv;1:2ix;1:jjgwhf;1:9ip;1:8hehkbjjvqitrfdsje;1:aixfh4jin;2:jjq;1:0in7h4jji;1:8h5kj5;2:3hh4ir7gl9hbbgqcixhk2jixljgnhfojopiqqhbujjwh9;1:3h85l16hf7h99jealkbh0dgweipfgwggyhh3kgumm9oh5ph0qharffskiugcwjr;2:8k9dheeiqtkouh5;1:uj3;2:lip;2:8iwdhe;2:aiugiujjnriy;3:wj4;1:7j6hje;1:1jp3ha7kajh7khbrh3wjp;2:8ja9k9aiubj5chafj2jjblhfmhgnhbohbphergitheuj6wim;1:8hf9iv;2:ahdcikfg8gn2jg6sks;1:diy;1:5in6gr7hdjivujuvjlwh7;1:8j2;2:jhbwld;1:0h34kk8h99gfaizbkpcgpdggek4fhcih0jg9oiyqkmrjmsgwulgwgv;2:qiu;2:pjb;1:8isnjg;3:8hgbhgcjtfgshlvjikrkpwgx;1:3jftjq;1:1ko8gp9hdrjx;1:jh7nilqjewhc;1:8j7;3:5iwaisbimqk2wha;2:6it8j1dheeixrizvha;1:8k3ojnuip;1:9im;3:bixiim;1:0k6;2:0jw1ik2na4iz5he7jdah4bhefh9gh2ih8jkwkhflhdmhgnhboh6pfwqlhrghthduh8vh2;2:wj6;2:rj8;1:8jk;1:1ip;1:9it;1:biw;5:jjwrirwgz;1:dj2eh5hiu;4:1jgghbjit;2:wj7;1:5jdcmcrgjshc;2:2iv;1:9ip;1:1gu8jdahhbiwgjtkiyrh6wit;1:1h83h9jjekhgmkznk7ojeqh8;3:hitoim;1:5jc;1:hiw;1:aiu;1:8jiagrfjfginkiumh9;1:aiw;1:eisfjtgiwuim;1:8hcgk4;2:hix;2:3jt;3:1h35ij6h87gx8im9jvbkzegefgahgdjldkjclh2nhcpgoqiorh3sj1vhawg8;1:6im;2:8jhdhfhgxjkrtiywio;1:1im;1:2ik;5:aiumjr;1:nkm;1:fjw;1:0iyag9fkj;3:giz;1:2jfcil;2:1gj8hdaj1gqbhhfqixrg2whc;2:ajafheghdrka;5:8k3;1:0it1h12hb4h15ha6hd7h1bh6chdgjvhh9ijjjhcliymh2nj2qjerkosh5tiouh3vhewjz;1:aj4rjuwhc;1:9j0;1:5l77iv8gf9kxbh1cipeimghfjhgrgxwhb;1:8h7dleehh;1:0gv1l42hd3j84gn5h46l38g19gqah6ch7dgyegffjqgg5hphih3jgikj1lh6mginh2pkzqjhrgmsgvtg9ugtvhdwm0;1:aiw;1:8h29jibjhjhesjiuj4;1:tjnuhb;1:5ipagzbiofgxgkd;1:0iz;1:2kd5j4bilhinjh6qitrhawir;1:cix;1:8he9iv;1:nezpmf;1:wjm;1:3j0;2:fil;1:8hehgtjj0mhdoh7pm5rjkwhe;1:bj7;1:5gu7h69kyahfbh3cgwdkdfh3gh3hhdjllkhaljrnitofvpmwqgkrhguhbwj7;1:5in9j9dj6rja;2:egihipjmewja;1:fio;1:0il1h52h93oi4h65ge6in8k69ggdgyeirfg9givihekgglhdnhbogupgrqiprg2tjbuitvk3wgb;1:1iw8h0kkurhd;2:2iyijdrhd;5:qjq;1:jk4;1:8jl9j4bgkeh4gikkizrjbwj5;2:4jxhjuliomh8oh0uio;1:0j02h93g74ik5h06h97gq8k49iyakcbgaekiffrgh2hgeiiljk1mh2ngpogrpiwqgjsk7tl6ugjvh8wil;1:jjq;1:ajkbhcfjoohhpmuqhdwh6;3:8hhekyhh9ris;1:9j9mil;3:jip;2:bgxkl0;3:1j8qit;1:9im;1:7izggpqks;3:il2whb;1:8j3eh7;1:7k08hfhj1jitrgnwk1;1:7hfckffhdhjmiiwjhgqh5rixtmouhawgw;2:1h7rjh;2:7hg8iobklcjwgjthgzjh2rh0tjxwgz;1:8ikngfpk0;1:9is;1:kj1;1:wj1;1:8hc9k3;3:4j0bjeeijkhc;1:aggkmiwiz;4:0hb1jw3h64h56gw7h78gs9hcakkciufjmgh0hjjjk3kiylh1mh6nh2ojcpj7qgmrgjsh8ujlvjwwfh;2:uh7vkc;3:jkclja;2:aiw;1:uhgvj6;1:8jdakgdgifg9kk0;1:hgxjj7;1:3hb4hf6hg8gy9kuagaciqgh2iisjgvkh8lkpmhfnh6pl4qgtrg2th5uksvm7wh6;3:0hh1he3he4hf7h28jy9ivag6bjacjodj6ekmfljgjqhinjh7kgllh5mhanhgpinqgxshfth8wgi;1:ilhjhbwgi;1:eik;1:6j38hg9ikrkn;2:eik;1:9ik;2:gj1pit;1:ajn;1:0fy1im3g74h65is7ki8hh9kobjkch1djuej5ggyhh4ik1jiokgrlgrmgzpgoqiqrj5tivugmwgs;1:jil;1:5it8mh9gpakebjbcl4gfthj4jh9qirsh1thauglwh8;1:0fe3nb4gw5hg7he9gyahfbh9gh8irrjgmmhdolophdqh5sipthfuh3wg8;1:wkg;1:1j88h99k6dh3gg3nhbpjwrj3tipwiz;5:7mc9iljhgpkwwgj;1:wj1;1:giymj5rhawin;3:8ikgij;1:6jh7h9vl6whc;1:0hg1j22hf3h95ji8ir9gsag6bjhch1dh0eh2fgwgjkjlzkjfmhanjmogqrjpuh0;3:2gh3kz;2:ah2fjj;1:giwij7rj5;1:gk0;3:wj6;1:3h0wjv;1:fk0;2:0h11h53h94ip6gi7h98gzbgxciodhdeh0fgpgk7hj4jfclhgmh4nhfpgiqjystrtgougxvit;1:giljk4;1:8hajj9six;3:8hebhfcjt;1:0jn8j1kj5;1:mis;1:bis;1:vje;1:wjq;1:nj3;1:qh8wkt;1:8hb9iw;7:hhatiw;1:7hfjh9qkc;2:djlehgjj9;1:dgquj9vk5;1:5jsbiojiqpjwwgw;1:1k77hc8ixgjbjgxkgklhgmhanisrjmwjb;1:rj7;1:0j45iw7hflivqiwwh9;1:0hc3immilnilwjs;4:4hdolu;2:dgnejm;2:ah4uk4;1:1jr6hegh8hhdjh1kkzljomgrnilokpqh5wge;1:jj8;2:eisujl;1:bizcl6jirrgvwgv;2:8h39hcbkdcixfipvjawhe;3:sik;2:wiz;1:wiz;2:7it;1:0h61he4jo6hb7hb8f89h1bhcdgsfgrgh7jgekl2mkznlkomapjxqgsrfftgkuiyvkhwgb;2:2fo3hf6nidhhuhgvivwh1;2:jhewix;1:8ik;1:4fk8k4wn3;2:4jk;1:wje;1:0h98h69hbbjrdgleqdfisghgqhbrgzwh6;5:8il;1:7im;1:8h9cgtemchitqj5rhgtgw;1:2l9rjbwgi;3:ulkvij;2:aj2fiuuit;1:jktoh9rjawhe;1:dk8;1:aj2pheqj0wkw;1:bh1rk7;1:9jgfgasioujx;1:piq;1:8h2ah2kmwlgm;1:wj2;2:hkcrft;1:3jqgimiiywhf;1:cilqj3rjuwhe;1:3k5dl7efw;1:qj3;1:hk1jkerh8;1:3mv9isagoeh6fjxgiqjj6qkhthhuhbwem;1:uio;2:ek3riq;1:eix;1:4j3gj9lglrjt;1:5mm6gxwh3;1:1g92j83gw4iu6h97gq8h99hfaj3bh6dh5ehdfhbgjmhh6jklkgnngvoncpiyqk3rh2sj2ugwvhbwik;1:0izritwje;1:kj8;1:einuis;1:3h9iiz;5:ahebizcg3ghehhejjtkjcojjrjnsk8uh8wh3;1:7kl8h89j4ainbjfdimehenj7rhewh6;4:kio;1:gh7jirrl7;1:7imjit;2:4jr8g89juaj0ljf;2:0in3hgeiofhbgj8jhgkgnnm2ojeqh2tjkuhb;1:jk8sgw;4:jisrip;3:0hg3kx5he;1:fj1hgxjj5;2:hjf;5:4j78iqeizhhhuhc;1:1hg3hb4hd5hc6hf7ha9gubmscjwhgqkjgllpogwph5qgvrjqthcuhewh5;1:kk8;2:2iyageciqfj7gglhiqohfrk1;1:ril;1:7kr;6:miq;1:8h29jqam6ffusk9whc;1:kip;1:2fl3he5jd6kp8kyjfskgznhgok1qkwrh9thbvkcwgz;1:bjbrim;3:9h3aj4fjujj6;1:pldtk1;1:0jk1h63gi4it5l86gn8k69ekbjocijdh2fgtggghgkih0jmukh7lhemh6nh0oj6pgaqjhrk7shftgkugzvhbwkf;1:rj9;1:rir;2:liv;2:gh7jisrk6sjnwhf;1:cjgjiz;1:hio;3:fivwke;1:9j6aisrhdtkbwh3;1:4j2chfhkr;1:0m11lw8iqfhdgh2khbrhbwgv;1:4j3;2:biqmj0;2:8jl9gf;1:6hgjkuwkc;1:cj3jh9mikrkm;2:0kdlkyoh4rlawgj;1:dixqiu;1:1h73h56hf9izaq4ch9eh4fgagg7jj0khcmh5nhaph9qh8sn6th5ujywft;3:ciorix;1:3is;2:rij;2:cik;1:6hadjekkglhgplgwh1;1:jj5;1:bkcrh5;1:5irrj5whe;4:9im;2:9k6ah6bj3eh6gh9jheklrlhbnhdpjgqhbrfjwle;2:3kb7in8iy9h1ahfbh8cheehgfjngj0jgbqhbrkcwjj;1:2hb4iu5is6it7ik9khahcbhfcg1eiyfh4ggahgjigdkghliwmjmnhgoj9pgcrimtlcujwwfc;1:1gvbircjyrla;1:oio;1:4j5;1:fjllh6mj3rjyuirwh8;1:5iq;1:1hg3k08jk9hajgzohhpjtqkgsjtwh9;3:3iqcj5;1:gji;1:0k62hb3gc4g97gz8gv9ikeinij7jivkgxmjfojlpguqh4sjqtgcukl;1:mk4;2:qj7;1:fj1;5:8l9lixrh1;2:6hf9k0ah9bhacjbfj5jjnrh3siluiswgy;2:8he9j0;4:pin;1:cjm;2:8ikfj0qkuwhf;1:ejl;3:1in9h6jhhkjrljxojcrguwhd;1:cilej8kj1;3:jhdwjn;2:0h83js4gt5je6h97jg9gaagrbh2chfdioegqfg4ggzhj6ih8jgdkk2lismiwnlcoipqgjrjhsitth1ujlwge;4:8im9jpahcch7jj6rjw;1:1h03hg7k0ilmthe;1:3m2tirwgq;2:8j6jh9wio;1:ehggjtuhd;2:kkmlg4phbrgiwmk;5:iku;1:chffk1qj6;3:gj7sir;1:7eujlfsjquhcwkm;2:0n93gi4gzgh8hgoil6qhdrivtk1uhcwh6;4:uj7;1:mjj;2:1iz2ip3gz4h75h96h57gh8kj9jpbgydj8ejhfg7gj6iirjgskjwpgnqhbshbtiwvh7;1:bhdhjdnilriuwj9;1:9h0alncileh6fk3gh6qj4;1:8il;1:0k68io9h9bj3phfqjmwhb;5:din;1:7irbil;1:qjg;2:6f7ukqviv;3:bk7ekahh6rgj;1:5iwwj9;1:0h61g22jw3hd5iu6hb7gzag8bhdcgodjfegifglgm7hnoihfjm1khdmgwnh3ogipgeqjruj4vjmwfy;1:2kd3jh6j88im9j1ahdbh5egtfjggitjggkhhmg2pgvqgwrjytkfuh9;1:pj7uil;4:fkcqk7wha;2:7jhaj2dipej5jgmvh8wjf;2:8hd9jl;3:9j4jiu;1:iin;1:6h47hgcinoh5qlw;3:8ja9h9ojdpke;3:wjg;1:uil;3:ij9rit;2:3ikbj3;2:lio;1:oix;1:cimhkkjhbrh8;1:5in;1:jjy;2:0ls1ij4g4ij7rh7wjl;1:ejl;1:1is9hcdiqfgxglpnj3rhcwh6;2:4iz8im9jjah3fhfgkmhhejisuhg;7:3h85jp6l07j9fj3gk4nitphgqgcrhcthduhavglwj5;1:7g8jke;1:aiy;1:0kg7ir8il9gibj8dhdehbfh7jiokh2lhdoh8ph4qj5sl3tguugnvj0wgs;2:3j2;2:7ithhfihbriswkq;1:4lb8iw9g9ch4ej5hj2jkcmiyqh8rhfwgh;1:fiyliunjh;1:mio;1:4ix;1:giy;1:6jd7la8jf9h2ah9ehejgvqh2rhgsjztkbuipvguwgq;1:eja;5:0gr1j02fi3m74gm6gk7m48hg9hbbjqeglfgcgh6hggilbkgjlhhmgzngzog9rg0sj4tjiuhcwmk;1:qkawhe;2:5kj6iw7j69l7bgxdipfhagh7hj7jgsqhargmwj6;2:0l43j17he8ga9h4ahabpfdjfjgxkh9ph4qiprgotinugywg2;1:8ik;3:jj2wis;2:ij2;4:0jacj0ujo;1:3k07hg8h4bjfcj4dgufhhgiqjjlpj1qh7thfwiy;2:9jvegbfhdih4jh4mkmqjbrk0siywiu;1:8h09j3til;1:sjmuh6;1:jk7;1:rim;1:5iz8jiniypjotjpwh6;2:tkw;1:eit;1:dhbfj7;2:7j8iivjjj;1:2lenj6;2:9ik;1:aiodgwej7kiwrit;2:3kh6jr;4:8iqchahiutis;5:9h5bikeiokhcol9;3:gj3sirvio;1:0hf3m57hc8kfahabgxcj4dgfenikhaqh8rhgthduhcwg2;1:1hf4izhhbjiymh0ohdqkurgktm0;1:8k19gakhfnjyuj0;4:pj4;1:diy;1:qj4wj5;2:5j49h5aknfh7jn0ogbpkkqjjrhfugzwgf;1:cil;1:ch8ris;1:8ikjj6;2:3ilriq;1:1im;1:qir;1:gisiik;1:3jjcjmnjrrg9;1:ciqij3;1:8ja9ivdh5ej2;2:aj4djzeh6ghenik;1:ghbjkfkip;5:mjc;2:8la9gu;1:giq;1:1k22j43h69h9aikeinfhghh9kiqljuohgpj5qh6rgrsh4tiwvikwgu;1:8indh9jiypkfwgu;1:ikcsjr;2:uio;1:1iq4im6hgkj4vk0;2:nk8;1:bil;1:ain;1:1hg3h07jr8j5ah2bixfitgjpjhekjmminnilohfpgyqhcth8uhh;2:gjq;4:dilegurj1;1:2j33gs7io8iz9h1bhafl4jgnqherkhwk0;1:0hf4io8gu9gsah7bhfdmoembfl9gh8jh5th5uilwh2;1:3h55lz7k2cisjk9qhbrhdwgc;1:ufsvkt;1:0h41iw5h16kd7ga8jq9gpaj3ciqdioeipfimginhkyih4jgmkg8mh0nh2ogppgcqjerk8shgtgsuipvkdwes;4:0j48gvcjjklbwgr;1:uit;1:gliph7qkh;1:hj3;1:8jlahfeizuje;4:dix;2:1iyrhb;2:sil;3:7iudgquj9vk5;1:fgwgjz;1:0in;1:bivciljjerhc;3:2kpwim;2:fju;1:8j4;1:3iq6hcdhgjk4phcqkkwiv;1:hggjgomh5toh;4:7j4tjz;2:vj4;1:8hcbk8dh7jjt;3:wio;1:diy;5:8ke9h6riktj6;1:piq;1:jiw;3:pjk;1:pip;1:mjswh0;1:0iu1h42h93ip4l85hf6h87fb8h49h4aj8cgngh6ijnjiskgqljmmh7nh5oglpgeqh2sgrth8uj0vkwwki;6:0hc4kn6l5vilwh2;1:biqdharix;1:tilwiw;3:6kf7l1bjejhgniwohfpgqqhduk7wg4;3:jj0;1:aj6iiz;1:3kk;1:2ji;5:ajqdhdgh3hirjktpimqgtrfysnkth8ugcwj4;1:ojd;1:djzehdfgrkjiojavj8wir;1:5fu7kh8ek9me;2:1j73go4ha5h16h38iq9jxagxbgycgtdg9egogjthgwiilkgemm3oh5pgzrfvshftjjuoxvm2wfx;2:fiy;1:5kh6grjivvl9whc;6:vjm;1:aggchafjlhhejj3nk5qiwrje;2:3iv;1:1inginhhdjjdmiprh5sj9;1:2hg4jnghdojiqhbwjq;1:iin;1:2iw7jb9iwcisjgtkhbnkwwh9;1:aj9;3:5k4piz;1:eir;1:1hd3hf7guaj2bjucj0dhdej6ggohh4khanh1phcqkdrm4tiouh5vhh;2:9heailcj6ejmjh8nh6oh7pmcshduh5;1:9ja;1:ak8dg8ekbjjm;1:7k28isdjsegnjhgojaqh7uhawjt;1:ditkj1;1:bhgcitjh6khbnkvqipwjb;3:3ik;1:eil;1:8in;1:oj3;2:5jm6ms7gf8hd9h3dgifhejgrmjenjmph9qgmrh4shcufxvnwwkj;1:ij4jjjwhd;2:2ir3jn4j0chdhknsha;2:bjxqiq;1:gkf;2:6hh8hgahfgnzhhfqk4;1:9issj6;2:ah3uk4;1:djtegd;2:3kk8j8ah7jk4nj7ohfphbsgythbwjl;9:sil;2:dk6;2:8gt9jzdh8eiyfh9iirjhcvka;4:8ixhip;4:gj9;1:4jq8h6onnpgwwhe;3:8jj9j0dh9qk6rh7wj1;1:giwniv;1:iik;1:8hagiyjjcsiw;1:8isch0jkapj8whe;2:2hb4o4ahboixphdwh7;1:0h11gh2je3go4hb5h96h07hf8hd9kfbjhckkdisegzfikhj6jgnkgslirmgvoh5qglriutj2ugzwl0;1:djvegolkgnhhqj8;1:4ipagwbjxfhbgkhlh3rk0;1:4jh;2:tik;1:8jgfhdlj5pjc;1:hjijirsju;1:sjm;1:sis;2:wje;1:gin;6:jj1;2:jk3pj4;1:4j88go9jj;2:rjo;2:0hg4h67h8aj6cindiqeh6ggvhivkk0lhgmjpnhgpgzqhfrkzth2;1:1g92j73h86j67gx8jb9h3gj4hghjgdmfyooqqkrrh8th8wkr;1:fjj;1:0ji7h8ah6fjqjgupkvwld;1:vjq;4:rjn;1:6j9;1:aj4pju;1:4jhuim;3:6jh7h9vl5whb;1:8iodiqeh9ojzpgtql9;1:2kb;1:1h9ilurhdsjf;3:8h69j3;2:dkcegnlj1;4:tk8wip;1:0kr;1:wjj;1:wj2;2:aiwuhb;2:smvwgx;1:vj8;4:pk9;2:tiv;1:8ks9gsegykjl;1:ditpl9;1:tlb;1:djj;2:ril;1:8h89iv;1:bj6rim;1:8iqijf;1:0jt9jmdheeh5hjxjhgnjwpisqh8;2:cikujn;1:4iy8h2fhcjjokju;2:dltegtfheqkswhf;3:1im7hfgjjwhf;2:8h3hhfmmctj8;3:ol7;2:riq;2:eik;1:9hfujvvjs;3:aiohhbjikwjk;4:dil;1:0je1h22lq3je6gz7k08in9hbchhdhhejbhgeijhjh2kikph1qjergxsh3vhfwhd;1:hiu;1:5jrah9cj0;1:pinrix;1:bgucjbeizjk2sgv;1:hjbjh9oim;2:bip;2:ail;1:6ivjhemjnvhc;1:8ixjiqqikwhg;2:bjr;1:0jywhe;1:qir;2:0ix3ix4jx5mnjh1wh9;1:8k49g3hj3;3:fjchiujgquhcwjw;1:1ls2h63gk4h75hb6h27jk9hebgldgohk9jg3khdlhcnimoh7piornushdtikugtvhcwgw;1:dfjel5hfyjk9;2:ql8rj3wg6;2:ck1fh8rhdwjv;1:7ha8il9gqal6bjldh7eklikqjezlheoheqizrh7sl0th8ufi;1:cgwiiyjj5;3:kim;2:fik;1:0gs2h93g44h76h77jv8h59j9ag7bk8egvfg7gh1jilkj7lgvmgjogmpg2rkdskotliukbwhg;1:8ix9jobj4ckvdilgh2hgwlisqitshcthhwgt;1:jjn;1:0gy3m58lq9gxbgpdjxehfjhdmhfqjathauhgwha;1:1hg2in6h77hg8hg9itegwjgzkhbllrmmyng0phaqhdrj2vin;2:7l3vhcwj7;1:8lp9g6biyciv;1:fj2;1:ckdeh3;1:8io;1:5iqdjjegvhgzjiprj7ujj;2:gjc;2:gin;5:6kr8jgagpciudfgeirfirkjqsjnwh9;1:fjsnjhtjvwh4;1:liywit;1:8iyhhdrl0;1:kgtmlg;1:8l39kybhbkhalisrhd;1:kk5;1:wjw;1:0h91h63kw8jx9pdchbfjbgfzjh3khemgoqh4rh1wk3;3:4it6kr8ikfhfjjfkj1wgx;2:wiv;1:dhafjilji;1:7jrbipjipwgv;1:5iw6hg7hg8ir9imphaql8wh3;1:7hcdhgeivjinqo0wgi;1:aipcj3fioggzhj2jhetjz;3:3ja8ik9j7fh6gjrjfqphfqh4rgqsh7uhewmk;2:7j9bjpdhfvio;5:4j3ail;1:5j2;1:diq;2:0jv3ip4gr5he7h89hbbh7fh3gjphfjikhljmojkpimrj6sfxuh6wkm;1:1ha8h7hh6jhdkjsmh8ojdpkkriruj5;1:sj2;2:8h59j3bipok6;1:3k9al1ghehhawk2;2:gguhjciljjiqrhdwhg;2:vkdwhg;2:0h31hd3oa4jg7hc8gx9g6bh2cikdk7ehggh5kh4oh7pgtqgprj7skrth7uggvhewl2;1:1hb3l09hcak0ehdggxohcpivqksrheshathewiv;1:ainqj2;5:5io8graixbh6kk3rliwhf;2:5jjjgmqjxvkj;1:6jz8hbdnsej6filjgikhfoheqh9uh1vjf;1:0hb1hg3hb7h8bl7ejjgkfjhgkhbnh8ohaph2qjkrhdsiyth7ujf;1:1gr8ld9jafhfgjekfzmn8nh4rheuhbwh4;1:jix;1:ahcdikej8fitjin;2:2jf8ivij4rgy;1:ojzphg;3:0np8h19k5eh5lj5rgwwgw;2:1hdhgmjjuriu;1:0g91jz2ha3h34j15iz6h37h98gp9ilah2ej3ggehjvjjukkqlh7nhcpguqgrrk0sheuj6vj1wg7;1:gin;2:ais;3:2hg3h84hg5gw7hb9jqagobl0egyfjdggwhiuij5jiukjelh1mhbphdqhfrjntgnugxvk0wix;1:8h89j0uk1vhbwhd;1:8h49jphgnjjn;2:gio;3:3kh9iwbh3jh7rir;3:mjdrjlwha;1:pj0;1:kis;5:pj2;1:6hgtimuk1vhf;1:8imdizeh4;1:3kb8h6cgjej6fhghitjgslj6rjkwiq;1:2h93lodj3;2:dl0egd;1:0ix;1:8ip;1:0jz1kc3gq7hbghejikql8;1:3hf5j1eh1rhfuk6vklwjf;1:rj8;2:0j81h3rjw;3:0gz2he3lq4h95hf6hd7gy8h49ivah0bjfegzfhfgh8ihhjktkhanhfofxpj3rh7tgvujvvma;4:0gs1kh2gz3gq5gs6gv7gu9gbaiocgseh4gg3ih8jg8klglm5miqnjyon7qfssj9uitvgpwgx;1:vik;1:1mo2iv7h29izegrfj4ghfjhfkhdlhemhfpguqharh8tjmugtvhfwkm;2:ghaqj6;1:hg3tkq;1:qir;1:wjh;1:0iydh3hktrjcwhc;1:0ke6h9eijliopip;1:wis;1:3iw;1:gim;3:0h36in8gj9hbahgbhgdnvekyfkmggqjimkhfljxmhbrgith2vgnwge;1:9it;1:4jb6h79jzah9bhacj9fj4hj1jjcrg4sijuiqwgm;1:aisfjlrh1;3:diu;1:ah5ujt;2:8iu;1:cjbgim;1:jiu;1:6hewj8;2:1je;1:hh5jj5;2:0m46ni7h68jejhgpgiqfowgz;1:0hf3o5aj2jh6wgb;1:1is3jjhj2jh2wh5;2:8jpchffiqrhbvkd;1:wkc;1:4j2;2:6gbahebe9ejmfj9klyvjm;2:cjhrhc;2:1jzah7livrklwhg;1:wk0;1:8gr9k7eiv;2:bis;1:4js8hc9isojqwh2;1:1nq2hg3hf8h69gpcjhdgbehcfhchjwjgzkhfmjlphcqh9rncuh1vhh;3:aimqjk;2:3h64hc6h07fj8kk9h9an8bh4cgzdkoekvffrhiyjg1kgllh6ngzolcpgqrh1tgdumbvh7;1:0pe1in3j34hf7hgijdjh4qimwgn;1:5jvehauiz;2:hiw;2:gjnoim;2:jio;2:8gywkd;3:9jsaghfh2hjxjgumgqonzpl1qh8wgs;1:fhcujm;1:8fb9lldjpjjeohbqj3wh5;1:2m53ka4h16jt7hfjhgpjmqhcwgp;2:4l7whc;5:5jrajvjhgkh9mhg;1:cik;2:3jubha;1:1lo3h84hb6h77h09graixbl3dg6ej2gg5hjmih9jgnkgelh8mjbngxogwpj5qhetmivhfwh8;1:0ij1h34hc5hc6iq7he8hd9gych0dlcejhhhbjj2kh6lnlmjjnh2oixqhdrfhth8uimvh7wh3;1:1iqahfnjfuj4;1:oiz;1:dhaeir;3:9ijfh0pjp;6:8iosip;3:cgrgh3jirrk6tjq;2:ag1ffzjhfwsc;1:hiw;1:6hgugzvku;2:3j3jhaohdqjy;1:2hcujjvje;2:0hh9hcahbbgvhh8jh5mpwojrqjmrhatjhuh6wgw;1:bivqip;1:egpjk0;1:8hetjiwj7;1:9jl;3:rj3;2:jiv;5:4k19h7aitbj3fhfghhjh4kgylk7nh7pjwuirwiv;1:ckrwgx;1:1ip8gx9jibisrhf;1:8haaghcjgggrhjejgamh9pliqhgsm9tjguiuwgx;1:al5jk5wgv;1:0hg3iy4h8aj7bjeeiqfivgghhhdkkephgqkprhewg9;2:4iociojh6tlj;3:bip;1:8ha9jvaj8bikcfkehgfisheykhdljdrms;1:fjdghepiwwix;3:3kfbj7fjboikuikwh9;1:6jtnitphe;3:aijjijkj3;1:bj4;3:8gpafybpcgjxkheqlosgrwgx;2:jh7qje;2:wiw;2:8gy9jsdheeikhin;2:ciu;1:hjergy;2:gir;1:9iyij3;2:aip;4:jizsjn;1:8gbbguegvgiprmk;1:pja;2:2jo;1:pit;2:8it9he;4:4n7whd;2:0h21h47gv8j49k1agrciqdjdeilfj3gkbjg5lhgmh6ngvoh8pjuqhcrh9sj0tiluiswgt;1:8io;3:2m2wgy;1:mjj;2:7hfgjkwhh;4:0ha1gf3gl4hd5h96h97k09jrbjzchedh6fggggdiitlgzmgnnktoh7pg8rjttirultvis;1:gjo;2:ch4fl4;2:ok4phg;1:dhdeis;1:fh7gk6hjkwh6;1:8jobhfgjpjhdlitqirtjowh7;2:mjmwin;3:cj9;3:0gi3ha8hc9j1ahdbj2dk8ek4fkhggihitihckismhanhfph0qh9shfuiywh4;1:3kzrj9;2:mjz;1:8j2;1:8jr;1:2l23hd7hg8gi9jtah2bipckrejlfjlgiqkgxmhdoh8ph3qh6rixshavhewgt;1:pj7;2:1kx8h69judjheh9rfrujj;1:fhbgjijj2;1:ah3jiukk0;3:1hc2l13js4ha8he9heegxgj3ijakhelh6nk8ohgqiqrguuhgwk7;5:eioqlcwh1;1:riz;2:3hf8gycjpejtgh9hmqjg3kjcmj4rfptkuuhfwgf;1:ajgfh6mk2;1:jje;2:jkkrhb;2:9jlakejiouge;3:cje;1:4ix7ge9jbehdjh7sipwl2;1:qik;1:mgntocwil;2:gjlqjvwhc;1:gim;6:uj0;5:mgfnlapj6;2:jjhwhb;1:1jbaj1;1:7gj8jp9h9gnpjgekjvwh7;2:hikjijvik;2:vis;3:5lsghajjnpkxqhethewfq;1:wit;1:0hg1im3hd7h8eirfh4jh0kivljnokppjaqgluj8wg5;2:2iy8jfdij;1:8h99k5eh8;1:jkaqhhuhewhf;2:0mu1h53h84h47hc9j6ah2dj5egmfgwggzilgjlbmhgnhaofmpmkqfyrh5thduhh;1:1kfwgt;1:jiw;2:nja;2:jj9ohc;1:qjb;2:0gx1gw3h04j46hf7it8j69ivbjmcgndh7ekxfioigsjenkgylj2mgtnh5pjzrmpsh0tgwuipvhcwh6;1:5ku7j08gkah6ghcjjnrhdulo;1:gjgjhdwk0;3:0irliurha;1:biywiz;2:amnggf;5:0m02ga3jg4j76h27hc8hb9hfamhbh4ch0dh6ghbjivkhblhfmhdohgpgvsjbwgv;1:3ikjiw;1:4h87hc9j6ak8bh2dgweiwfikgh5qh7rj4tgtuk5vjjwha;1:2j2;3:8ipmitsik;4:6j5aj5;1:hexrl8;1:6ix8iy9k8ekqth6uhe;2:3jf;2:diknjy;1:3j1rinwhh;1:8j5hh3jkfmiywhf;1:6h6pj3qlbwhd;1:tjo;4:3jd8hcjhgoghpk4wjx;1:vj7wj7;4:pjb;1:6h9phdqld;1:1h78gr9j0dj5eg3gikhhhimjrh5sj5ukfwit;1:hjtjhf;1:kj3;3:cik;1:1gm3hb4h56hb7h78h79kealjbghdimfiqhiqjfxkgbmhbrjjtiyugdvhhwkv;1:9is;1:9it;2:1h7fhfojspilqn0wgv;1:1in4kiehdfj8hinjjbqhfrgyuh9wkg;1:jj6;3:1hg6jz7il9gvajvbizegjfh9gjbhjrih0jg9kgqmjrohdph8qjorixth4uhbvgkwjd;2:5irjh9ojwwh2;3:8iscin;1:3jqeiqvim;2:jl1oha;1:0h21j22iz3jg4gz6h88gt9h5bgmcgzeh5fkohgzigzlfxmlcnjrriqsj3tgrugbvki;1:4it8h09kgahgol6;2:2kdqim;2:8gw9j5aj6djbehagj3ijcnisqhgsimuhd;4:air;2:0kpjhfmjmoj3qhdwh5;2:ajikgq;1:1hb3im4hg6hf8le9kicildh6eh7ggphgfkg4mphoiupj0rh3th2uh0wfv;1:9hbbhdeivgixhh9jivrjl;1:aj9;1:2ji;1:jjj;1:njm;1:fh1uj4;2:1hb3il7he8j2agsbkudimehffk6gmnhhgkh1lj4mh5nh9ph2qgmrgothcuiqwiq;1:aikcj6gjx;1:wij;1:nlaph3;1:4iq7ha8iydgjehejk3rfzsjiul5vj1;1:3innj2;1:bh3cl1fjp;1:6imaiouhf;3:1kg7d6ah8dj0egkjp1kh1ojopgkqj3thfvjswh4;2:sj5;1:giqrjs;3:5je8hb9j8ailfgz;1:9hddmneev;1:ajajjnrh4;1:cix;1:jhcpijwk9;1:6m78ixal0bhdeh6sjduh7vh5whe;1:4he5sl8jcehghhejg6mhbqhatjauh7wgg;1:mjn;3:kh2lkgtjcuh9;1:ajhfjh;1:6hh8h0ajbehdgj1jhfkiqnhepl7qhhskgviswgx;2:8jn9hfahgdjejleqh4ujdwgn;3:piu;1:sio;1:1k48nq9h9dgqej5hhekhgwhb;2:7jl8hgnijrimtiu;1:jh2wjw;2:3is;1:7iudilgjb;1:4ipvip;1:0h53gq4hbbhgdgpeiwhhaippjiprjdsiywha;3:biq;1:0ip1kj4il5j26je7gg8k59e7ahabgccgedjhegygiqijpjj7mjwnh7oh8rfgtgzugeviywjt;2:1im;2:qktwh9;1:2ir;1:0ik3ik;1:biwhk8rhd;1:qjt;4:gji;3:8h69h2ahbbkvrj1;1:gir;1:1iwrh8;1:9h6ak1fjfnjppherkbsgzugg;1:uj4;1:2m93kf4hb6jv7hg8ml9f2ahdjhfpheqhdwgl;1:8gujmaohbqhc;1:bj1jgvwkr;1:ahgbj2cikjhfqkh;1:wjx;1:1glfhcgpljh3qhgrg4sjxuk0wh6;1:0h63hg4hd9haah9dgyeixfk0phdqh6uj8vinwln;1:2hf3gy5kr6h97h99lqah7bhdcj2ehcgh8hiqjh3khamj1nhdoh3pgjqgdtlouh9vhbwku;3:mjmuiy;1:8h3hhfmmetj8;1:8fe9l0giktki;2:qlc;2:kh1llsnhf;1:8iz;2:pl5;1:wkn;1:cjbrh5;1:phdqnhwgn;1:1he4hb5hf6hf8lp9kjak2chbdheeg7fgfgh4kl1lggmh6siptheujowhc;1:2j63h96jkth7;2:cishhbrj8;1:7il;1:bimfiq;1:bizmkpwh3;1:8io;3:3j45hf;1:cgvmjbrjh;2:1he3ju4hf5hd8gr9gtanfbgucj1ehefmzhj5jgzkgplhfmhcojfqitrg4thfuh2wgp;2:1im8jm9gzbgxjh9kjkljvoj8rgstixwhd;1:giujjt;1:aitjiz;1:kiplhe;3:oji;2:kh9pk8viq;1:giz;1:3h15hf6gk7fe8k09g2alablacknfk2glfhjkjekkgqlhfmhanj4ogvqhbrh7shgtgpujgvgn;1:biw;1:9h7bkdej9firgj6hjmjgaqhcrjmthcwh9;2:aj5;2:kgwlgpmh9npipgh;1:7it;1:aivpiqtis;1:bis;1:4im;2:0h81h12h63is4hd7iw8j69jvahbchddjpejwfh4ggykgzlhaphgvil;3:0hc2mt3io4h57jobgojh0kiulgkojnph5qgtrk2shb;1:4l7rim;1:hkmrj2;1:bjkdgmejl;2:0jd4hf7gt8iv9jzdiseguhhcjk5mh0nj8ojrrfkwkj;1:1hdah9fhagk2hijjherjmskl;1:cinej2fhcugvvke;1:airkgsmkknhc;2:qkgwh1;2:qjlrik;1:rgiwlm;1:fituh3vl4whd;2:2h13hg4hc6hb7lejjlnkwolcpherh4vfuwh8;1:tkz;1:6mhdikojerhh;1:1imajmbhcfjpokyph3wh6;1:hio;2:9in;1:fh6hkuuh8vjb;1:oj3pgz;1:cmfrgkshf;1:0in1g6khdln4nhbrh2wks;4:7la9hadh9ejfjgj;1:hh3jiwtin;1:cizejmjjtohfuj6;1:8h69jfuirvir;1:iiv;1:7l7ahemiqph6rhfsilwhb;1:diwfhfujgwio;3:wir;1:miurk7;1:0h12kc3gx4hh5js6hb7gh9hafh2hh2jlnkmfmguniqoh1ph1rfwtgwvhbwl0;3:0j16jlvh5;1:ehcuj7viu;3:uh9vjq;1:0iycjdfhauj5wj5;2:8iqahggjthjujhgrjq;1:pk7;3:8iw;1:9ik;1:1j79ixrh4wiu;1:hj3rh2;1:ojapkm;1:8k0bhf;2:6havix;2:jj1;1:1h98kx9nyaklbjncgeegofgzgh7jgxklclgzngzphcqh5thewgw;1:oh7qje;5:1iw2gv3h34hb8j59iyajibj3eh7fgughbjhakh7nocoj2pgwrgsth8uhcwjd;1:5l98hgjheqhatjbuja;4:wip;2:dgwej8;1:hjw;4:8jy9gzcj8gjd;1:tik;1:kj1ojm;4:dh4ekzrgq;1:1kc8j6khg;4:1hb2ls5hc6hd7j69h2biwehafhfghdmhhngtphfqjgrh1tizuizvhewjb;2:9goajhcipdhbehbfmzgh8hiujj0kgsohfqj8rj2uh8wh1;1:8ky9gxakncjmfh4gh4sh8;1:mil;1:1gk3gz4hd6hf7gvaffbgudk4elcfijhgzihclgvmjcnizoiqpguqjmrinthdvikwjg;3:ogvplzwhc;1:bk4cgvojm;2:iiw;2:ch7hjf;2:9ik;3:cjihgu;1:dilqit;1:qjd;2:8iy;2:9itcj3;3:1im;1:8jm9giqhgwlt;1:6h67irhioph4ql2whc;1:8h5ejcgjbjh9rhfsj4ujbvjfwj1;1:th4ukdvj6;3:1l43hb5iwpgyrhfuhbwl6;2:kj0;1:5iu6h27ir9iobhffjsggdhj0jgfmioogzpiyqjnsha;3:3hgiiq;1:bhcfndshguhcwh7;1:qko;1:3irhkbqjsrhdwh3;1:hgfjjn;1:8gd9jzdkvef3jhaqhhrjgsh8uk4vjs;2:oje;2:3gr7kfbh2cgydijegkffugnbhl2jiokhclhfmheojpph4qhgrggsjgthbuikvj2wgs;1:2li7h4hgujk0ok3qgzrh6sgvvh6wl0;2:8go9jtcgvjjckji;1:dgkejh;2:6ha8gdaj9jh7oiopgvqmarikuj8wj8;1:1kg3hc5iz6ka7h28ha9hedgufj4hhakh7lkomgznh1oiqpjeqh7rh5sj6virwg2;1:2jl;1:gk3hh5jhephdqivwkg;2:aiydhfeiqfhaphgwmc;1:1k8ejbhhfkgzqip;1:4kjiipljjwhf;4:0m44hh7hh8j89glbjochbihhjilkgylm0pheqh2rg2wkh;1:6hb7jbch0fk1ihajiptj3wim;1:jhawjm;1:0hg3hd8iz9gual7bkociudgzfguggxhh8jhfkkglhcnhcpj8qk6sh6thauhawim;1:qjswhd;1:kjzwjp;3:oh1pk4;2:8jd9hf;2:8ha9h9bk7;3:5ijghejjfsituglvk3wl2;1:0j98f29lqagvbj3cj5dj0jhgwiz;2:1iv8gzkkvrha;1:0hc1h92j73ky4ge5gy6gi9j7bhedgrej1fh6gh1hh0jg5kh3lhdmh9nh8ojepj6qgqrnzsh3tgqukavk8;1:1il4io7jbah7eilhj9jh9kjcqiq;2:cj1pjoshc;1:bj4cj4gklsixwh0;1:1hg6hh8jq9lfahgbfzchfdgwelcfgoghdhikkjkph2qh8rk1siwwgc;2:7iqpip;4:fiwuin;2:1hf4ha6gt7haag3bhbcgzdgnfl8jj5ql3rjvuiovl4wh0;3:dimmgpok7;1:al2ch6fjyghdkhelinvj9whb;2:4ixrj5;2:0il;2:0k53k34j4ej4gh1ik8jgpqjosgewfh;1:2kq3iv4gnjiu;1:7k19hgcim;1:8kudjfejpfhcjhf;1:4ir;1:oiypha;1:tk3;1:qirtjl;3:8gv9jxeiohjopimwhg;2:1ir2j63ha;1:1h8aivbiufhbrkksj3whc;2:8j2;2:2ik5hhbheehagjljjdkhgpixqh7rh8th7vkjwl1;4:jjv;3:ahbfg0wmh;1:eimhjfmiwvil;2:bimeiowjx;3:bjh;2:8graiusijtkguhe;2:7h7jjqqjnwhb;1:hilmjjrhg;1:0iq3hh8hdsjr;4:3l68iswh8;2:kiy;1:7lxphdwhg;2:jio;2:1iwriu;1:rj2;1:6gsainvjv;1:3k97im8io9h1ahebh7ehffjlgizjg9qharl4wjf;2:0jt1h0iijpj5;2:1h02jl4jk5ke6in9h3agccgndipeh8fh4hjaijujhhkhflj0mhhnhbohephathfuivwge;1:aj3rit;2:4hfmj6okm;1:8k5uhe;1:ah7ujh;1:cim;6:sjg;1:wj6;1:4ip;1:jj0;1:rjm;1:wj9;2:eizhh4jjl;4:9j0;4:ah7fjijhdrlqwhc;2:9in;3:rl9thf;2:8iq;2:sil;1:8k49hcakrbk3cgqfhaghewji;1:5ituiy;1:0ik1gt2h93h24h05h96is8gpbirch8gk4hh9ij6jh8ljamgsniloh2rkish3vhdwmg;3:pjqwhf;5:fir;4:pk5;1:fkdqj5;2:5in;1:9ikfl9gh8;1:ahaehefj9uj3;1:blueh6fhbjj4;2:njo;2:4jk8iq9h9cisehcggmhlpphbriq;2:fj7;2:ljhwir;1:1h95j97h68hbfingghkinmjsnmwoj4pgprhgwgx;2:silwjn;1:8gl9jr;1:0j99imjhc;2:0gu1h92ix3k9ahbfjzhhgrjf;1:wix;3:bjzqjb;1:djteh6hjqjiorh8;2:kiklis;1:7kvejbqhfwhg;2:aj0cir;2:mj0;2:pik;1:0il1jk8kp9gaaivblrcgweh9jh7;3:0j11ik6ik8grfhewiq;2:8h5dl3egbgjs;1:bitwjf;1:rik;1:cheijcjjipkhwgy;2:6j8bjbcixkhc;1:8gi9jlbl5rkkthd;1:qiq;1:8hd9hbcgoghdhgpjitnjarjesjeuk6wl8;1:fjygj8rh8wj2;1:0hg1gs2jw3he4hg6ks7ha8g49gwaiscgxdh3eiofikiiwkl5ljkmgwngpph6rgcsgztjpuldvh9wg1;3:2h83jt;2:qjpsiu;1:1k6kj2;1:1hc3js4hd7hf8jlajrch3deteknfgvghehlpjgalh4ogvpheth6uo4vfkwgo;3:8jhjjgmh6rfmtk9;1:fkwkhfsjp;1:dit;1:dhcelahhajjdwha;2:qh8wkt;1:9ik;1:0hd1il3h64hb8mt9daah7bgxch0enzfgxgjdhfyjlhkk7ljioh6phdqj1siltgywfz;1:1hg2io3im5il9j0ahadirehffhhggnhitjhgkjtlixnhfoh9;3:uk3;1:4jq8is9heaj1djtfhejk6ohfrjfugqwh8;1:8hadfyem7iim;1:2ikbkpchheivgjvjhb;1:9k9chg;1:hj3;1:vj9;2:5jjjh8ng3pl7;2:9izak7fgbukb;1:8gg9jjbhdgkkjjnliuritwhc;1:1hb7kl9heciudh7eitjkokhgmhfog9pkoqj0wg5;1:1hg3h55hf8gt9gyamvbgtcj7egmfo5gj7hj6jhfkgpmhgoitpj4qh7rgiwh7;5:wj0;3:tj8;2:giurin;1:kg6lmj;1:9io;1:chbeirwiu;1:2gx3jkkil;3:aj2fiuuit;1:0j21gz3nr4h1;1:cjikisshf;1:ehgfjmuiy;1:dh3ej5jjd;1:dio;5:3m78iu9hgcijghahlfjhfrhfuikvh9wgm;2:blsfh8;3:mjswh0;1:mjdrjlwha;1:cjdjiy;2:9jndhdeh7fhdgq6ihdjgnrh3;1:1he7mf8jsgj6hh8jh4oinpj0qhcriqthbwh8;1:diw;1:0hg1hd2g53gx4h45h66mx7h18lo9gfaiqbg3djpej3fjlgjdhjvih2jg9kgwlhfmhdnhaohbpgwqg8rgzth7ujvvm4wga;2:8j3fj5mj8qhd;1:2kb6ixvj0;1:5l47hcahdbhbjj9qhesiltj9;1:9ji;1:wik;1:7h18iljn2ogrqhf;3:4isjiu;1:jgjkj7mjvwj2;1:6jt;2:pj4;2:dikoin;1:3msmilqhfwhg;1:8io9ivbkacgcrh0;1:eiu;1:3hf4hg6h37hgiivqhgvocwjp;2:9j3pik;1:5j6ailej0pjxwhf;3:1he2j93hc4h85h68js9gwbh9dhbek8kfxnl2pgzqh7ropuhdvhgwh7;2:jjv;2:9iu;2:0j74gxilvrhewk9;2:pjk;1:8j8ahcfh9gj3kgnlmrngvuhdwk4;1:gjp;2:eiw;3:ah3jjj;1:ujf;1:8itaimkk3;2:aji;3:rjx;4:8hgajscirehbfldghbojhphd;1:bgxcl0fjo;1:khcmj5;2:eja;2:8iqailbh5tkm;1:mhcoiywj6;2:mhhoiq;2:3j25it7j8riwwh5;2:lin;1:1h88gtahhbl2gj8jh6khclizohdpjgqimrjuwja;1:nju;3:kh9lo0oh5pk1rhb;1:7h68hdagwdhgfkqhhfjj5qkorjstk7wgg;3:kh9lm7rhc;2:cjl;1:6jxvg5;1:2jacimhj4wit;1:9gtaitdjkugyvip;1:fiojkgpgyqhe;4:bj7cj5dizrh2tjx;2:bhgcivgipigkjh0sjetn1;2:kgomnruj4whb;1:0ip;1:win;2:1hdghgrjt;1:0im;2:1jmvil;1:jil;2:gkb;4:8j2dh9ej6ijbliz;1:lhcriy;1:qk0;2:5kdbhcdiseiyggqjjqoipqh8rj7sj7wh2;1:oir;1:3lu6hg7j3dheqgvvim;1:uj4;4:4kskh9ml3wgp;2:7hc8kkfjcgkthheoj5ph6qh2rgnshfth9wl3;2:5js;2:7hcal1fgojiu;1:0oi6gv8izpheqhdwhb;1:9h7djiij8;1:4he8h9ahafl5gghhj1jhgkgxllxoh8phbwj7;1:fin;1:aitqj1uis;1:hj2;1:1gt8k09ircgrdgsfhegjuhk0jg7lhfpjurk8uj1;1:iikwit;2:9j7hhejiokikrhg;2:njq;1:0iv8imbirpjmwiw;3:0hc1ip2gy3kl4ly5ha6gt7gp8k29heafqbh0ch6jhdkmfll0mhcnl4ogspf8qirsiytgovgswfb;2:1moahffhhkjamgynh1ugzvklwhg;2:wik;1:1np2h83hb5hg6hg7hcahcbhacijdgmegmgikhjqjghmj1ohdph5qh3rnrtjbvhawgv;4:1jpoj0phe;2:cgygj8mj9rjewhg;2:ddfeo6;1:pk4rjmwhg;2:9ikag9cltfh6ghhjgukh0lmirizwhe;1:0ji7haah4bixfjojgcqjcwm8;1:jj6;2:0hg2gp3gr4h15hc6gx7h99iwaj8dhdfkjhgzjfhkgqlh2mh1nmkpgmrfzsgpul3vjlwnm;1:aiv;1:ojspgn;1:0jg4is8jr9iych6dheehefiwsin;1:bj0;2:8gcel8;1:wj4;1:ailbil;1:bjjjj8qh4;2:8j3;2:eiy;1:lir;1:4lmwh8;1:5k8oirphf;4:aiochfjis;2:bik;1:ciwkhcnkr;1:7iw8ioeixnik;3:5jw;3:9hgaheghgjm4nikoiqqgurhbwk8;1:1iq3jochh;1:8jt;1:tio;2:0io9hgdimej0lk1wgw;1:4it;1:jh9phdql4wha;1:8iy;1:qijrjkwh8;2:oitvik;4:7jljipmim;1:0ix8ik9h5rk0;5:ail;1:8g39h2aj6ej4flcjgjkk0oh8phcqk7ritshfwhc;2:2kgwhd;2:2k65is6h28hejiooh9rgxsjauj3vm3wh0;1:1is;2:7j0hhcuil;2:1jk;1:6j6wke;2:ciydhaeiu;1:8k7;1:8ipsju;2:3l9ugr;3:2jy6gq;2:0jg1jh2je3gn4k95ha8kech8dhdggqhhakk9lhfogtpgfqirrj4shetgeugjwjl;1:qjctk2;1:2l8ah7fhcrhdsk3uku;1:bin;1:8io;1:dheeiv;1:2ga3k84he5lf6hebhaghajg2mltogtpgyqlhrj3th9wgb;1:mjv;2:9h5bizghehj5kh8oldph8qjswh7;1:3ikjik;2:1h83h97kpgh5jkxqhgwhe;1:bjach5jhbqk1;1:qkf;1:0ik1he2iq3j25ik8gwah3dirggkhitjhgnjzohc;4:wiq;1:jk0;1:5il;5:0jf7hgfjlgheqhgwkb;2:8j99haaheegkfk1hiorj3;2:pjd;1:0j91h3;2:8j2;1:1kp6hdjheqhfwla;1:pjl;1:oiz;8:cir;1:rim;1:5iz9iw;1:gip;3:fir;2:mj7qj7;3:biz;1:uix;1:8ijpij;1:jjhwhb;1:wiv;1:8fz9jzuj1;2:1ja3g76hd8g09lsafsdh1eiziiyjk6mhgph1qj3rkqwiz;4:1iq2ix5he6h57h68k69haailchcehcfh1ggejjpkj4lhdnh0ojipjerhdsixwgm;1:mjj;1:mj3;5:ljznh3;2:1hb2jt8pb9gach7fgkgh8jj2kjalhbqhbrh8sipugxvkbwg3;1:dhdeio;1:5jgjhcmj8rjzwh7;1:2iy8iycj7rhb;1:fiw;1:agwqkxrjptjtwh8;2:eil;2:0hg1in3gy4ja5jt7hb9h3bk8dhefh0ghchj6jj6lj8oh8ph0qlmrf2sgvuhewg7;1:kiw;1:8he9j0mk3;3:8je;1:ajagivwhf;1:ujk;4:vj2;1:1h4rkt;2:6j7cimwhf;2:ghchjtliyqik;1:9iu;1:ahgjix;1:5nd6g1oiwvgdwhd;2:2jvaizbiyciogh0uiv;1:tj5;2:gj1;3:rkfwhd;2:5jc;1:3hg8ja9mcakhbkxdh8eh8fgqhhckiulh6nhfphhrh6th5uhcwgu;2:hiokiv;3:aj1bhdshbwkp;1:8ja9in;1:0hf1h83hc8gu9fwagbbh5cgzdloelnfk4girihgjjykhelh5mhboharj4th5ukavj7wg4;1:qjl;3:ahbfkcijbrgxwik;3:ogipjt;1:birpjj;1:3h0cj9hk1jgnrh1uixwjr;1:qk5;2:hl1;1:6kp7j6bh2ck1fhgjkpkh9lknoh9pguqhbwg0;1:8im9j3ajhdj4eh7ghfjjeoj9ph5qherhbwj7;1:dj7egv;2:8jeahffim;2:bilsjj;2:tkmwgz;2:aiu;1:gjw;1:lj5ogzrh2wm5;1:0hf3hg4ip8gucinehekjclh7njboj8qh4rktuhfviswhg;1:fkakiswh4;1:1jg3kd6gs7h9ajqjgkqk4rjpwg7;3:nir;1:fhegj2;1:kj1;3:gkx;1:9iw;1:1jc6lckjgph1wgj;1:vkt;1:jk0sk2;1:hj5rha;1:tiu;1:0jgdheeh1ulh;1:7ji8jf9hfeiphj2qiprhg;3:8hbajjbindhcehcfithjgrjbsir;1:rjl;1:2kdahebikcotdh9fhgghdhhdlh2nhdph9uitvhfwgk;2:qjj;1:1il2iq3ga4gh5ju6hh7h98hdagrbgwdh5fg9ggtjjkkg6lgnnjvoiuph6rjtuk8vkuwiy;1:vjj;1:4jldh1fjekhf;2:7m6wgm;2:8is;3:jjo;2:5imfk9;4:0j41iy3gq4gv6hd7mr8ix9juagobh1ehafg3gj4hgrjiolhdnj3ok5qjirgmtgvuh0vhgwfy;1:1hfahffj8jk1njnqh9rhgskxtjsuj1wf8;1:bjj;1:rj1;2:plxwhb;1:0hc1hg2h13jn6hb8juajlbgkeinhg0igejgnlokmh1ogwpgvqgyrmbugqvhdwgr;1:oj1;2:biwwj1;1:uhgvj8wjm;2:1hhdjofh3riusjl;1:gj2;1:git;1:7jiagvsjvujk;2:dk4eio;1:0h91he3il4he6hf7heah9ciyejffjvigdjgekjbll4mhgniuoheph9qgyrlith7uh9vhf;2:8h09j9;1:jil;1:9jeghehj3rhftk2;1:fhegj3;1:ij2;1:cjgqiw;2:8j19hgkhbnlq;3:qjd;2:tim;2:1gp8gp9jmah0cjgdhbehffjfgizhjvphdrkdtjzwhd;3:4iy;1:ej8fj3;2:uisviz;1:ajhbhcfhbgiqjje;2:kj3;2:8kz9m0bh0civeh7hixjhfrjowh5;7:jkdphc;2:fir;2:ck8hfv;2:0ku1gf3he4h96gi7gm8h09gnah5ch7dinfh0hj1ih4kf1nk4ohcpk2qluuj9vilwja;3:jj0;1:5il;2:0io1gzbiock5ejhrkz;1:1hcbhegjwhj5jh7rjgsk2whg;1:8hdbl3gjqrgywjj;1:8kw9guah2rk3;1:cj1;2:0n53lv4h7ihgjgxojnpgxqh1;1:ahbbl5ch8diqfkhgmpkh9lheqh0whd;1:ogeplrwhe;2:7fijhdmizongphcqiqwk5;2:qim;2:8kathg;1:0mm2k13gr4m15gz6h98iu9grah4bg8dhgeikgguhh7ihcjfvkj2lkgmkwngmog9qizrgftl4uh0vhbwek;1:8jo;2:1ipuit;2:pkt;1:wj1;1:6kxqhd;1:8j7diveh2;2:ij1jilrhgwjd;1:hin;1:aj7gh2;1:giknj9;2:9j4wj2;1:aipbk1wiw;2:2k7ch9dgyfj1hh2rkpvjz;1:tir;1:em6rgm;1:9ir;1:mjk;1:ojr;1:1iq2ir3gp5he6jh9imafsbguckodflekbfiugikiimjfykjullbmgnoivqg0rguthbwgk;1:hjc;1:0h72l33h24h35it6gt7gu8in9j1cirdhfehbfh4ggrho8ihejjxlh8mh3nhfohfpjjqiwth8vh4wgh;1:9imbjccithjirgv;1:kiv;1:fjhuikvjf;1:3hf8iu9h8alcbkrciwehgfh1gh0hh9kl3lhcnheqkash5thbuhc;1:pj8;1:1h53ju4im5hg8hb9gyahfdnmjg7qgvrh2uhavjcwk0;1:rgwwji;1:bjdkikmkdpj3wgx;1:mjk;2:8isbjtck0eikgjyrh8wh3;1:9ip;1:aiufh8glbjktqiqsjmuhawgz;2:3h47h48gu9j5bh4ehcfhbghahh0jkxmhdqhhro7sixtheuiuwil;2:0hf2h83hd6lb7h78iy9hfbjhdh9eilfimhhfjhdkiungvokapgvqikwgk;1:7js;4:0ha1h62ir5jm6h47hg8ip9jwbhcdh8ggrihbkgklh6mlynhbogopjfrh8sl7th4ufvvh1wkf;2:5je8ix;2:0ki1ip3j94gz8hecikrh9wj8;2:jiv;4:aikbjc;1:3kv4ir9gvancbfgch4ej8fgzgobjjboh3qharf0seqth5vh9wge;1:3kz7juaj5dipjh6kirphfrh3whd;1:0h81ha6hd7hd9hdah4bgxcgzdhfehffh2hpljn6ph9qiotk9uhewg2;1:diugkojizwhf;1:0ls1j93hg4h28ilcj2whe;2:hjmilcthf;2:7it;1:3lr4h99h4cj1ijcjjgwgv;1:5im;2:giw;3:8hejh1oheqjutl0uh5;1:8hfait;2:hilihckivrj0wj4;2:1h92ha3go4kh9l0aj3bjtdh5ehdfhehiqjgrlgpmh2oh9pgzqgorl4ugivivwhe;2:oiz;3:pja;1:vit;1:8j2;2:3j49ikwhb;1:8h79jx;1:rjzsiq;1:uh6vjg;1:2hf4iuolb;5:9hdeiv;1:jil;1:0ha1h63h26hg8gd9faag8bhednpeknfjshhdihejjkkh9lh4mh2nh9ph4qjirjgtgvuk6vjtwfx;1:8iu;1:8hc9hgahebiojiuujq;1:uh6vj1;1:3iz6ju;1:1itqk7whg;2:fjeghewj6;1:qja;1:jj3;1:fh3gizjhgmjyrjpujawh5;1:aj1cjdfhehj0rhf;1:bixdjujh6kmbnh6ph9rj7whf;2:rmcuhe;2:fgwgku;2:1im7j8cikekaoikrhb;2:1h38gq9mddgwehefjohinimyjh3khbrgc;1:gja;4:8it9imeixsj3;4:6jcvhg;1:fiqlin;1:dkfefspj4;4:agrfksgjbhikkjawha;1:cjl;1:7h8ahahknqh8rj5wjr;1:oiv;1:9ituin;1:mkmwhe;1:3it;5:gil;2:sin;1:wkf;3:8j0qiq;1:oiu;1:mjr;2:ajg;2:2iy;1:8is9gyegjih5jh8mkoqjkrk7sizwj6;1:agvcgdjlj;1:uh4vjk;4:ch2jjgkl5;2:0l51l23lw5hg6he7h29j5agwbk4cjjdh7eh6fgnjgmkfwlgxmgwngvol9pghrh6uh6vh9wfs;2:wiv;2:4ip6h68hgbgrgl0jhblkppl4qh3wh1;2:1j7bircirejqfizgh9rh0;1:dj5gixqiktj9;1:1kuij6rg4;1:iis;2:0io1jg2j13gi5jj7h28jx9g7ajobj9chdegufh9gilhf1jkkkj8mjdngpoj5pgyqkbrensh9thbuhcvjkwgr;1:kjqrhd;1:oiv;2:oiu;3:0h33h95he6hg8is9jnejsgh6pjdqh8rjasimthawgz;1:cim;2:4jjjitwgt;1:qjl;1:jik;1:hjvjikrhc;1:liq;1:ljr;2:3lh9h7dileh5gh4hj1jjuqhcrjcsjcwgl;3:7l5fhhvhc;1:0is;1:8iu9ilainkhdnks;1:wjy;2:7it8hadh8kinuk6vj6;1:djieh4hiw;1:liz;4:oixqjb;3:iinkil;1:lio;1:8j8sj3;1:tiv;3:8hg9j3gj6qiu;2:lj3;1:aj6gh0oh8pnqwgd;1:ciq;1:8hdjlnwhe;1:1ki6he7jpvilwhc;2:5ilahhfgbgkuhiu;1:qit;1:hin;1:dio;4:0h82he3h04h66hc7h58f09jqagtbh3gklhh1jmlkh4lhgnheogppg4rgvshdtj8uhcvktwpp;2:pjl;1:fj5ghe;1:0in1g1bhgjirkhdlmbnhbrh0wks;4:kh1lkr;3:5j38ja9gkciqjgkljewkh;1:hiykj7whg;1:ahgciudh9ektrjlugg;1:0jz3h64lz8gx9kceiyfimgiuiiyjh1khalhgoh3ph4qhguh4wh0;2:wj1;1:lizoj3;2:2jo;1:oij;3:dij;1:agtfk0jhgrj6;1:cirjj4;3:ajdrha;1:1ha2jr3h64mq6ha7h48je9gxbk9ch1dhbfgahgzikljggkgmlhcnhdofrpikqjdrgyuji;1:8guwkt;2:8iv;1:ejh;1:ah3dnnhh9jgpkkyuh1vji;1:oj0;1:8kt;1:6mg8jrehgoizvdgwjc;1:0hg1gh2h93in5h16j07h78l59gnag5chadh5ejzgj3hjilh7mh6nh8ogmpgxqgirk9upiwg0;1:ahbfjv;2:6jrpjcwgt;1:ahfcipfk3rhe;1:dgzejwjfmwmp;1:4je6kfjh5oj5ph1qhgwhb;2:jitoj1whb;1:5jc;1:7h68iw9h8ak7fk4jh2kh4mjpnldogqqinsinthdwgp;1:cjneh9hkejg4mjnrh6ujk;2:0gt1jt2gg3gm5h96gi7gp8j19fwahabgqcgxdgaeirfh0hgsih8jfyknnlj2mm5nltolapktqgcreqsjmtgtuiyvjrwfq;2:3ip;1:ije;3:9jcfil;1:jirohgpk6;1:8h69jg;1:eiw;2:cjujhaoheqjyrhd;1:gg8jjsniroheqj7tk8wjb;2:hhemjl;4:8h69kgbhfeggfhfll1nhhoirrky;2:9habiuciufjtghdhikjj0;1:mkrwgt;1:6hfaiuhj1rhduk1vhf;1:3gz5mm7jwah9bgpcosehafgmjjkqh0rh3wg0;1:6lb7h7jh6uh5vju;2:1io;3:1irgj8;1:1h13jv;1:hhfjipmjb;1:4otchajhhwhf;1:4jppl3wgy;3:wki;1:6heginviu;1:5io;1:0kt4gw8injlioitphdwhd;1:1jb3jf6h9dhfeiziiqlirrhavir;1:0hg4hc5j17ip9k4ainbirdjyek6fg5ggghh4jj6kgumh4nhhphbrllsjvth1uglvh9wew;1:dj7rh4wjn;2:dj6;2:ah8gk4jhf;1:0h93hg5j17hd9hgaj7djdegcgjijknkh0lhfmhfohhphbrjesj3tgxwjz;1:fj2;1:miy;3:2iw;2:fiqjh9lkenhfqkb;1:8h99j8eji;4:jl2rgztik;2:dhbriy;2:3jz8k39fldjgjm5qh4thhwff;3:nij;2:fis;1:0hf4ku;1:qkjwio;2:njooir;2:hh5jj5;4:gitjhbqis;3:hk7jgr;1:djmgizrizvh9;2:gil;2:jj1rhewj1;2:ah2gm4rhhtiw;1:8jj;1:mjl;4:1hd3gq4hf5hd6k47h29h6ajpchgdhdehhfjngh6hh9jggkh1ljkmk6okopgaqiwrgwtgyvhhwl6;1:lj4uik;1:gj2;1:eg5jjwkin;1:kluwhd;1:3ipehgqin;2:3hchiykhdljtpknwhc;1:1lk9jddhfohasim;1:jiwkim;2:ogypk0;2:tk7uh5;3:jir;1:4k7;2:akq;1:wit;1:sjg;1:fk1wji;1:4h18hg9jxok4;1:9ir;3:0ij1io3gi4hg6hf7k98ir9jbbh8civdg9gfojhhkj2lh5niroguqjkrj9shftgtugcvj4wj6;1:qhgtjx;1:6iu;6:0he1ge3gu6h47gt8fk9g6aiubggdlpeshfjthh8ihhkgpmhenhhph0rjkshbth7uhbwim;1:1im6iu8inaisdhgej3tj4;1:eij;1:4it;1:9jinjm;1:7kkdh9fgguh1vlj;2:6ip;2:ajhsh0;2:2ka9hdejn;1:kiy;3:0jf4hf6jd8ha9ilkldlhdmhdnheojsph4wh0;1:bj0;1:5gq7iydixjj5qjxuh3vjb;1:3h77h68hd9irbh7ehfghchh1jjamhfroasj0uivwiq;1:8mx9gdanrch6eheffwgkuhh1kherh1wh3;1:ej0;1:iiwkhglkhnhbph9wjf;1:8hajj3olbpg0siv;1:jj4lkf;2:4k3whc;1:3j24j88ix9h9bhgcikdhdeilgivhivjilmhhnisrirwgz;1:4hfaisbhbcjmfirphbwk8;3:giy;2:4mu8gxbjgekdhjbjhfohfqhdrgsthgwh1;1:dh6ej9;1:nkepj2;1:8ir9jtbjbhikkj6uh7vjfwh3;1:8jaaj0fhfrim;1:9heal8dirghcjh9sk3whb;1:ak2eiwfgx;1:0hc1gs4is5hg7hc8kl9j5alhbhbdgzfiqgjahl9ihejipkh3mh1ph2qg7tgyuj7vhewgx;2:4ik9ix;1:cjqjh8;1:6h5bj6dj6hh3phbqharizwky;2:il4;2:1h73ji9ipdk9eh5ggwjl8qjlrh5wh4;1:jj3;1:4ip;1:7jedglej2;1:1hb2hd3gq4gp5h66h97gv9k8bixdiwgh8hh2ihbjjtkiomgwoj5pkvuivvikwhd;1:uky;1:cj6jhb;1:0hb1ja3h44kg5h46gz7ix8iz9gwagkbguchhdh5gglhgzjgpkkhll5mgtnjpom5pj7qgqth8wel;3:1j73iv8h49h4bitdh9fjtjhgkisliyninphgqh1rh7tjrujjvhgwh2;1:wiq;2:2il5h07kojhdrlysh8whd;1:tjo;2:3gu6h97jg8g79hagjvhkrjl6nhgohcrirsjzuj5wfk;4:mj2;1:8gtqj6tjj;1:1h92hf4il5hb6hf7h98fw9jeag5bnqdh7egthgrih8jhekgxlhbmhaninok1ph3qkwshbtlougjvhewk3;1:1h73jdfjgghfhgxim4jhcqj8wh8;3:0hg1gn3ji5goagpgh2hnojj9oipphcqiuuj6vitwhe;1:mhfnj1;1:2j7qipujf;2:pk0;2:8h79k4hil;2:kjb;1:ik5qj1;2:giouke;1:chfeiuhipmio;1:hgjjkvrjiwh4;1:1iu;1:1hf4kx9ikogr;1:8h8kgxnle;1:3ha6hg7hg8eq9kjagnbhacjidhdegtfg4gilhjflhbmhgnjfqgrrkitjhugxvkjwl3;3:jjm;1:5j27lh;1:rik;2:0jp8h8;1:jjw;1:8hgagzbitgiuhk2jikljjwhf;1:eh4sjouj2vis;4:1h93hd4gy5n99jyajhbfwcimehafk6gh5lgzmhgnj5ogupgzugrwj2;2:0k76h4;1:8h69ji;2:8h99k8annbixeh3gh8hhdjhekh7rh0ujuwh2;2:bio;1:aivdhffgygm5jhgqkfsjluhcwh2;1:3j2hkhjha;1:7jd;1:1h43jr;2:8j1rik;2:uit;1:fjs;1:0iv;1:8in;2:0hf2he4h88isaj3bjdchceivfiuggjhhejh9kkaqjw;2:bix;2:ejksio;1:piv;2:7izwh4;2:8j09hbdj3uk8;3:0gz1j62h93gp6gu7gl8is9j6aipbj2cheehbfh6ggtihejgikkslj2mjlniqokiphgrgzwhc;1:0m11gt3hg9ksahcbiseixfjbghahinjhgqhdwgu;1:jj7rhc;1:1hanjnqkdwgy;1:4j3;2:9hfrmfuhe;2:jje;5:3jrjguwjy;1:4krgiyhim;2:8jm;2:mjk;1:ujs;2:0izckmfh9;1:vj8;2:ij0wjw;2:5jl;2:aim;1:wk2;1:umdvgt;1:0j3;1:qju;1:1k7ik3kh6tjc;1:ejh;2:0h82js3hf4ja5kl6h47jm9gzbhdchfehefj3jfolimmhcojrpg3qgvujkvhcwjg;1:4j2ojfuiq;1:2in;2:llenk5ohdpgo;3:fiughe;2:2he3j04k47fqaitbhccj7ehfjh9oh5pkfqhasj1uhfwkx;1:nj4wjj;1:wjo;3:7ivgjijhg;1:8jn;1:4ix;3:2ir3io8hbagrbh6cn9gfthjjrkbwh5;2:piz;1:aj9fh6;2:ailcim;1:6j1jlokh4mirwgm;2:3kdak9;1:8inhis;2:aircjegik;3:9hbjhcpikrjuuhcvlcwj1;2:8ingk8;1:bhdnjuwko;1:gil;1:vis;1:fh9glhwh9;1:0k4whd;1:ajdcirditeh6hixkk4mjrph6th6whd;3:6jl8gndldekkgh9jhgrh6tjquh7;2:dj0;1:dk1ekagjz;2:dix;1:5j46mg7j5ah9dhbehefh9jg8khelhenjhph6qhguiqvn3wgr;1:7j8qje;3:2kg5j68l09g5bgjjhhkin;1:fhggorihdjgolimrhd;1:jjx;1:8jhfikghgvjc;1:3l0;1:jil;1:dipehc;2:8kl9he;2:aivgjk;4:0gx1kt2h53h24g65gt6h27h89fvahdbhcdipeh0fixggeihgjh2klollwnmoodupirqgnrjusjeujsvgtwg6;1:ilijhcwgi;3:cjhfheghf;2:hix;1:eilfipqj4;1:9gydlnegj;2:jh8qlbwip;1:jiw;1:2fo6nidhguhgvivwh3;2:eirfjo;1:9jbehetil;4:5lvghbjjqthf;1:jj0qjcsjd;1:1hf2io7hf8h99nuahbbgydlvjh4khflh6qhdrk5uh9wgo;1:1hh8haaj7bhfchdeh8fj3gh0jhbkh5mh7oh9pndqj7rhftojwg2;1:1h9rje;1:3kmcj3gherin;1:0hh8gy9hcahcbhgdkweo2fkqghbjhdrhfwhb;1:4k98h29hdahgegujh6oivpjculcvjqwiq;1:4m06h8aivckzhj5jjrniuphgqh6rglthdvj3wfw;2:gip;1:3h95lj7kqahdciqdhfghchlbjhdlhhqh3riysijthfwh0;1:wiq;1:bip;2:jim;1:0f23luaiwcilfilgislkeqherh4wh6;1:0kx4ma5h46ky7gj8kc9h8ahebg0dh9fglgishirij6jjzkgrmh4pgnrgqsgjugvvhdwfs;1:nip;1:fjdhiwjgruhcwjy;1:8kv;1:wiw;2:ujm;1:qip;2:bj2jip;2:2imwip;1:2ip;2:1ipdix;1:hjd;1:jke;3:8h5kj6;1:fjahkcugw;1:2in;2:8j4;1:3k04hb8hb9h6bhgdipij9mhgnjdohbph9qipwl0;1:9j1;3:6itljtqiu;2:vim;1:dh6ej8;4:bh9chhgkjsin;1:dhgej5;1:afzsjquky;1:pim;1:0h51h33gy4hb6he7hg8g09g7aoabgqcj4dg9eggfpngjhhkyjg1kkfoh9ph3rgish5ugtvh7wjj;1:0jk3hd5hf6gz7h78n79l5bg6ch6dfren1fglgh4hhbihejfvkhdojdpiwqj6rh5wgu;1:kiy;1:wk3;1:qkkwhe;1:0iufk5;1:8h8agcfgvgq9hhfwhh;2:ujf;4:9k5ajxbleehffh7ghbkj6nhhrhduhgwha;1:8k8bhhkikwiw;1:kjg;1:8ikrj9;2:4h65jm8imagughbliknmgojlwhd;1:pjn;2:wj5;1:4hcije;2:wit;4:bhgmju;1:ajegh4ske;1:9jcehefiq;1:4ix;3:lhdrk6;2:0h91k23gz6h87gr8jf9juajjbgzdgheingj0ijbjj6kj0ljpmh5ogvpgprjisgluhevh4wg7;3:aguejzfleuh1;1:1jn;3:1ipaj4iilkhe;1:7km8j69grbjdjhgkh7nj6okvph9rhfsipth9wh5;2:8f99lpdjmjiswhf;1:8h5kj5;1:pjy;4:8ik9hebjdeisfhdsip;2:0hd6ko8jcah6bh3kgpllxmhgohaqhbtjwwin;1:8j3;1:8ipfij;3:1hg8hfbimdh9einghfjgxkhammpogipgmqjuwk1;1:bip;1:wik;4:0h51lw2ga3gn4gt5hb6h17h88iv9ggbftch6dhdehcgguhhajgnkovlj6mmenldojipjbqgwrgmvhfwg4;1:1j9oh7pinuiz;1:hiwrit;1:6hf7jm;1:jiy;5:8jgfipiir;2:2ik9jhdpkedufhgjgwoj4ph0uhf;4:8gsdh8em3;3:cjo;2:4n28jfjgmmh7niwog0wjc;1:3kbdhheinfh2niz;1:8jtdhf;3:hix;2:2ivkismlj;1:5k1;1:2m68h6aixcizggriiljivnjlrffuij;3:3ir6jk;1:3hg6lf7hg8k29h1ahabk8chfdl9ejxffvgkajgjkh8phgrh0th8vjrwfd;8:oitphfqkmsimwgr;4:6he8jd9j4ajlchgwj6;1:8ha9izagybm8ciofitghfkhf;1:6gk8gldioektghfujtvjg;1:fjlwip;2:ej7hh4qh9tkz;1:niu;1:6givk5;1:4ja;1:ailwjb;1:1hb3hb6he8jxajibkbcjndh1eivgjnhhaihgjgkkivlhdmipnhhoh7qkerh4th2wgf;1:5j47mcbkmhjojgpqgzwgg;1:0hf1iz2hc3ld4gp5hb6gt7gr8ixag9bh2chddj1egefh8ghfhhcjixkmwllsmhfnm4ogmpfhqjlrirtgquinvgswex;1:his;1:7is;4:1gx2jk4k95hg6hg7f08ip9h4aj2bhach5ejlgh2ij7kgklj8minngvpgoqg9sgjvkiwk0;2:4j9jinliloir;1:6ka;1:1li2ftogvqm7;2:qjl;1:1h92ju3h34gn5h48j59j5dh3em7hgkjgmok3ph5qh1rq7thcuh6vh0wei;3:2jelh8rj8;1:hiwjgtrk0wj8;1:3gl6la8ix9jwah1cj0ghdhhajiqph6qheshcujzvjwwgy;3:2kd3gv6hd7h38gu9jqagock9dhgeiofithlajlqkgtlhfmh5nheoh2pgsqhhsh6tisvhbwh7;2:il2pinwh9;1:givhj8;2:1ix;1:1h23jh4iw9jraixeh4ljjoh8;1:ajkjinkgp;1:2iy;1:8hftk3;1:hj0rj1;1:1he4h76gs7kv8gc9h0ak7bhfej0fh6gmiihcjgjlhdphcqhcrhdsjeuk7vkcwgg;1:cl8rgy;1:0ix4iz6h97kz8ji9gubkregyfh0gh9hh0kgalh4mh3nh7oitqh6vj9wge;1:civ;1:5io8jfbh5chbfhggkijh9tm3uh4;1:4jbihfwj9;1:pis;1:pjn;3:5kewjd;1:mjlpkb;1:jiuqin;1:0hb1hd3hd4hd6hg7j49hdchbds9ekmgglkixlhfmhaohdph8qh5th1uh4wgl;4:aj4fiu;1:mit;2:fj2;2:ijf;3:0ju9jrbjachcdhaeh7hjrjiqqhb;1:nik;2:ciojix;1:ahegiljgsqjosj4wjs;2:hip;2:fj5;1:hj2;1:0k1dixjhetjt;1:eis;2:wio;5:0h81gp4h45im6hf7il8gsah1bj3cj7dileh5fkigj4hgqih9jgvlgumimnkipkdrjssjetgtvhawen;2:3hb7gi8gh9jiah3bgyehhfh5gishh8ij7jgumhcqknrjeum1vjuwgj;1:2hbujzvje;1:8lc9l3bh0civehchixjhfrjswh5;1:9jjeiqffvgma;1:0inbgxijikkywhb;2:3j3mmppiwqhbrhcthawjy;1:wk3;1:8ky9gxjh2;2:4in8hebjvegxfheglehhakh9ph8rkztkwuhcwh0;1:uklvkgwhd;2:1is3jn4hc6kn7j18gkbgodkielfflkgg5ij6jg7kgamh3njepgxqgxrgjtgsvh8wgj;4:ojgwjm;2:ciq;1:3j8aj7cgw;1:cj9;1:0jc;3:8j3bjurh5;1:bhdglojhdujhwjh;1:0jn6mlhimijvjh9pfmqj6wgz;3:0ha1hf3h24he6gvahefhejmckj1lfjohcplcqhcrg2wli;3:cip;2:mit;1:gj8hikjhd;1:ek7uh2;2:wio;1:4jc;3:1hafimjgymldqhgrg5wlj;1:bjmrhe;1:wjq;2:sjg;1:4itaiqqiksgu;3:2kc5j2hikjh2qirwj6;3:aj5ghg;1:9imaipcj5eiofirrha;1:1hg2ir4hh5k26k5ahagjkhinih0jfgkh9mhgnhhqgyrjjuenvn7wh5;2:bjfdgbekdkhd;1:sil;2:9ir;1:njeoje;1:4j2;1:8j4jhbph2qomwgp;1:8j6ainfiv;1:nj0whg;1:9isujuvh5wjd;1:4in8gv9mybh8chgeilfh3ginjgzoheqhfrljsj0uhgwhc;3:wjg;3:0j8rj7;1:4iy;1:0ju2fr3h16l0aivdjieghhituhevixwgy;3:4h5direjaok2;1:4j5;3:7lwfja;1:djeokk;1:9hhwjb;2:5h2cj7wjq;1:8iz;1:5j58ei9m8ciz;1:5iz;1:0iw4gailg;3:7kmpgvuj7;1:bj3;2:0h91kb3h36h97go8kf9jaairdg9einfhfgixijjkjalj1mh6ninogxpgsrk3sgmtgkvh8wgi;1:0ks4h08j3;1:liw;2:2k23h84ix6fv7k28hgah6ch8dh6ej7hiuijvjjckhemhgnjuohaph4qh7sjotgyuh7vjjwfs;3:jgroheqkp;1:8kr9giaisbhfciyik7whf;3:6le9isehghizth6whb;1:3h06hcvly;b:1he2il6hg7hd8hh9iyah7bhgdiufhfggmhipiiujh5kjnlj1ngxoh6wk2;1:gjf;1:6jt;2:riq;1:hgvrja;1:3jccjtej3hj8wgv;2:4j0hkejj7rix;1:cjtrh0wjd;2:2h37j28j99jdchgdj1egvgjwhj7jipqhcrheuhhwh8;1:qir;4:bgxkl0;1:kis;2:0jm8izkj4rit;2:fjfwhe;1:0h61h85h16km7gg8jl9h0ajecisditej1fivgjkhkyih8jetkghlh6mh2nh7ogxpgoqk5rj0th0uixvkmwf8;2:wix;2:jje;1:6lesj4wh3;1:cisgjwhinqhgvim;1:wjk;1:ahahj4rj9;2:wjn;1:rj2;1:8isbjtck0eikgjyrh8wh3;2:ajcfkcghbhiywhb;1:jghsk1;1:win;4:eiq;2:0sb3io4ha6he7gyah4chefh3gj4ij1jg5kj2lhfmhbohapgkqj7sjlth6uh4wfq;2:1k8;3:4h5ij4mlmtjbwh5;2:hiqsiq;1:1jd8ki9lwegxrhe;3:1hdainbincj2hj9rk5uhc;1:5issik;1:4h8ok3;4:1he2he4jgmiqolgpheqj1rh6uhcwki;1:ujg;2:gh2jjd;1:fjm;1:2ij7h59irbj1cq8dh7ghfhhgjiwlh2nh9ohfph8shgvhhwfz;1:6lt7hg8jo9glaikohfpgzqh9slgwg7;2:7j3jkzkhfniwokspgvqhb;1:0hf1h43hg7hg9joaj5bhadiohh8kjamiloiwrjrsh9uhgvhg;1:ohgwkn;1:qij;1:fhahjnmh7pjfrh7uh9wkt;1:3hc8lf9m8amvbk4egkfgaggtjgokjslhfnhcphdqisrgsugkwgh;3:dgyejujh9sjl;4:div;2:kixll8nltogspgwwh4;1:3jrqil;1:6mj7h8jl1vdr;2:0h61hb2ha3hf4h66hc7k88k4aiycitehbhivjgkkh8lh4mh6nh6oimrknsjfuh7vh5;1:3jn;2:dinhiy;1:4ikbgzehejhdkkkmheoj3pk8tlbwh3;1:vik;1:dinhhepjhwh6;1:4jiwhd;2:eir;1:cjxrh2;1:fjd;2:8k8;1:8j59k1ajpbkrcjheh0fgjkjsnherh7thf;4:six;1:1h8aohcl2fjagg8hgskhbnhfrgasknuivwgw;1:0kr;1:dj6jjb;1:7kppgv;1:mh6tkg;1:ij2;2:nio;3:aheok4rjh;2:jjqsh8;1:ckeeh3;2:dipehd;1:1io5je6jq8gcbg9dimfirgkeiiujjekjwliknguojfpfqtguvh4wfo;2:9in;1:hh6jiqpg5qmlrh5tjiwhe;2:nip;3:ljlpizwhe;2:9izggkhk8lgnrlawj1;1:8iwcim;1:7jr8h69jgkij;1:0jj;1:5l28h0gjpjj6phcqh2tn9wgq;1:qjktin;5:8j0cjugirhgzjjmrhg;1:0j24hd5j0jgjwkz;1:6j2vh1;1:2ka;1:ohbpj5;3:cim;2:akjhikkgvmhdoio;1:rhc;1:8ik;1:gjd;1:rim;1:8imdk0fhg;1:0h81h97ha8iw9imagjbmfehfgjhjk8kgvqjyrg9sjowgt;2:jkyoh9pk3qhewkm;1:1h24ir8gk9n8bh6chedfwek6fjuilojgnkh8pheqhfrfysivthc;2:5qnjhdwh5;1:1gt7hc8ld9j7gmgkgvuh1whd;3:iim;1:6j47j7nilpkoth2wgz;1:8de9n6pittiw;2:diq;1:6iu;2:gj7ljhnhfqjk;1:bhbhiril5lirmiprjhtheuha;1:4hdij0;1:8jpbgucil;1:2jl3j0djjehffhbgh3hgwjh8khflgymjpnjxojqqh1rjuwio;1:wj2;1:9mkfh9gjirgs;3:hiojjm;2:2jfcil;2:bj1;1:0h81g72jg3gw4iz6hb7gr8gv9heainbh6dh4fhchhajkwkgplh0ngxonppj4qkhsj8ugxvhc;1:3hf7hf9h2aj7bnpcj5fhegh1hh4jgrkm5lh4mjcnhbogpqgurhdthfwke;1:3j08kbbhddheej9iiljhaqkbrhgsiuuhb;1:2j23h24kgfhfjh4qhguhawjo;2:9gmaisbhfcjffh2ggxjgnmginh9pn3qhgsl8thevk2wix;1:0ji7hcah7fjpggzhgtjldwl1;1:ij0wji;2:1lm2jr3hf4ir6hf7jobhcchgfgzhinjgzkjullhmhcogyph2rg3uiv;1:bilgl6;1:5ir8gy9k8ejrgh1hixjh2uhdwkg;1:9izsiq;1:8in;1:6jt;1:2k34j17jmjhakk6ohf;2:0gzahefk6qjh;1:6ha8gvah5bgpfhbhh6ijcmheniyrisunivkswgz;1:0hf2h83hd6lb7h78iy9hfbjhdh9eilfimhhfjhdkiungvokapgvqikwgk;1:hjg;3:1h16h68h3ajabikcj5fh0ggnhh7jkrkh2lhhmhenhbogzpklqhdrjltilujrvkgwgn;2:0iw1j9qjwrirvix;3:hiw;1:0h71h62he3gf7h18me9jaah4bl0cgifjughdih8jeykgxmisniloj1pg4qknriqwgp;1:4in8lr9haehb;1:qiy;1:tiu;2:jheqkhril;3:1h63j16hf7he8ir9hfakack6fkwhiqjhfnhbrh1uh9vhewhb;1:6kl7l8phdqh6wh8;2:5j1ejafjvgh2lkzok5wh6;1:6ggllqvk3;4:dinsim;1:9jhah6bh6gj4hiqrhgujnwiw;1:0j24hd6im8inql9;3:5irrk1wgq;2:8gz9l8dlgefyjhbrj7;4:nir;3:ak9hh8qiz;1:ehagmahjeuh9;1:bimuil;3:9ir;2:wis;2:gj3;2:5md7hdmh4oj6qhb;1:8iw9hahjlrhh;2:cj9;2:cjaggs;3:hik;2:ah8gjphj2;1:gh8rkc;1:ril;2:fjq;1:8j3dhfgjgjiklhfrja;2:fhcgk6ljcqkjwgu;4:6itfjg;1:8ik;1:hjbwio;1:4ik8gf9jwahhco5fh2rgx;1:1hf7je9h3bioehefhcgh7nh3qkfuj5wjx;1:8io;1:oiy;2:8iy9mpdh6efoghehhgrjpuiu;3:wip;1:dil;1:kj0;1:qkawhe;3:pk7;1:9h4ek7;1:7ivwj9;1:6j0;1:rjl;3:3iqkgzmmv;1:kkloj0;1:cis;1:1ivvk4;2:mil;1:ijr;1:eiofiuugwvj4;1:kjr;2:wj0;1:eiy;1:0j66iljhgwiv;1:mggnlg;1:nj4;1:git;2:8henl5wh9;1:1k6ch8rj2;1:eheojbrjt;2:8h49isjj7;3:2hh7ip;3:chejj8qjurj3;1:uik;2:8hcgk3jheugzvj4wj7;4:1hg7itghcjilkivnhaqj5wko;1:gjgrj8sl6;2:4l2bhecineiyjgukgwljwnknphhqgprhewj0;1:pj7;3:tj7;1:liytit;1:9l6agbbhfcj3fithhcjiqnjwqijrj5;1:gjf;2:3jr;1:ril;1:cjejjz;3:qk3;2:biz;1:giu;1:uhhvjn;1:pk6;1:3ix;1:8in9ivdiwehfrintktugv;2:1iu8h0kksrh0wjs;1:8jk9g4ah9bl1cgrfmjgg2hirjizkh3og5pmgqhcthdwh7;1:1hcaipbhegjzhj4jh8qherk9sk1;1:bj8gh4lj9qj3rgpwkk;1:aj3;1:0k11kx4h0wjb;1:8j5hh4jjv;1:3ha6h18j89iljjtlg5nisplsrfawlg;2:ljr;1:3ha6h69ivdj7egtqisthevl7;2:diz;1:rjd;1:wj0;1:8gaeklmjb;3:8hfcjcdirgirjgxmjirh9tk3;1:5ivjhcogyqk9wj3;1:rjd;2:aikdil;2:4jl8ipch7jjx;1:5jaujk;1:rit;1:4jl5ir9lbahhpixrhgsj9uhfvitwgk;1:ejmuhd;1:0kf6hawiy;4:3io7kbwhg;1:qipukd;1:6hgwjv;1:cjg;2:8hfuke;1:6jr;1:8jahirjha;1:3jj4hd5h98ge9gpanlbgtciteipfo9hjdjgqkgjlhcmh3oj9rfzthfugtvhgwg7;1:gkirgtwiy;1:alkdhcegvfkwuhgwhh;3:albfgi;1:1kb7hd8hdbikjjiriztjnwhb;4:0ir4k35lwjh6;8:rf8wlg;1:1hg4h65kx9keaj9bgbehcfj1ghhkimlh6njeoh4phdrhguh1wjs;1:wip;1:tiq;1:hhaujh;3:hjijgx;1:mj3;2:1ksahbbh6ggejljkhhphfrgpsimuggvjrwkz;6:9kfagv;2:8j5iin;3:9j4;1:cj8fit;1:7jpjgr;1:wk3;1:8gv9j9;1:0hg4hg6hebmncgwfj1ggnhjljh8kgill1nh8ogxpiyqj0rgnthcukivgt;1:jhdqkd;1:ailbgocncfgzrj9wgo;3:0il8gl9ivbinciy;1:8h9jjwmjb;1:wiy;2:3ixaivbh8;1:8iumjcrhe;2:0h71hd3he4hb6hf7hcah8ghdjgglkbmp6nkuoj7qgysjsth8uhewg4;3:sil;1:jgyqjn;1:aj1hj9jghqj5sjc;1:0ix;1:oiyqj1;1:iir;1:9izrjb;1:3h65ms7jvah9bgqcoveiufglghfjgwqharh2uh3wha;4:hix;1:8h69hcbgdjh2lh9qheroxwkz;2:mk4rh9;1:9km;1:pjd;3:okc;1:8gx9jqait;3:tj0ujh;1:1hg6h88hf9hbcm3ehgghcjlgljhmhfnisqhbrg5thcuiqvm3wg5;1:oin;1:8h9uk0;1:7hgbgmfjdjm7rj1uj4wh3;4:8hajjy;1:0k28h89h0bhgchadhajh1kiwtkhulivjuwgu;1:8il9kvej7qit;1:gixjhfrkowgp;2:hir;1:3jv;1:tiv;1:mjg;4:8ghjh4uitwmj;1:1he8ha9h7ahcdjffh7gg4hpujkcqiqviqwgn;1:4im8h39jscilsil;1:cj0fhdph9qlcwhd;3:giyij3;1:3jcljtnh3wj3;1:5iwbhbrje;1:ljd;1:nik;3:lin;1:ejfjiuqik;1:qil;1:rj7;2:0itfhfgj1nj3qhgtka;2:8go9kabipdh0ek2fhfjfwwk6;1:3jwkjzlgzwim;1:qit;1:rk2;2:vip;3:8h6cjf;1:wji;1:7jejhgwha;1:8jslikujf;1:ahffhdgkxrio;6:dio;1:4kx9ikjhbohbphawl7;2:gin;2:3h8ailcj0fh4jgmlkxpk0rgysjnuirwgl;1:8j2;2:jiz;3:1iy2ilrhbuim;4:fmewhd;1:iitrjg;2:8j4;2:ajfeinujq;2:wjb;1:ah4cjxfjhhipjh2sl8wgt;1:aimfjskhe;3:8hdbh6dinkmlwhb;2:0hdkiqoj5wjk;1:rik;4:2jw;1:hix;4:8il9j3ajidj4eh7ghejjdoj9ph5qherhawiy;1:1j0hfyjk7;1:djfegzfhfrk4ujd;1:dkseg1;2:mhcoiywj5;1:0h33ip8iyoin;2:gis;1:8j3gkgjh8kiwpj0rhc;1:3j2;1:wjh;1:fh1uj4;1:4jndingj1jheqh8;1:5kn7jg8j59h6ailbkregogh0ikkjh5phfqgzriuwgo;1:vjy;2:0hf1go2ko3jt5jc6gz8j49foainbhbcgzegbfkkggchkojitkgrlgtmh1nh5oghpgnqggrimshatkdul7;2:2iq5is8iu9h1ahgbh3ch2jjgkkxoj6qhfwhg;1:2kdjh4;1:1lj;1:fijmj0;1:hh8qjqtjo;1:1h52he4jejgzkhfmison0phbqj3rh3uhewkn;2:aiqojisik;1:8j7nkd;4:wj6;2:1jo4io8jpah2bg4giljhdnn9okkph3qgorgcthf;2:cio;2:1j02j04hg5ir6j47in8js9h5ainbhcdh7nhgoikqh2th6vgx;1:wio;1:4h85hg7g79iogjdjl5pjlqh1th7wk1;1:3iukin;1:8mdchfkh4;1:ejv;3:kjh;1:1hganockifjcgg9hgukhdoivphgrgqskguiuwgy;2:2j43kb4j16h77hdbj7dhgjlfkh8lhgoh4pl3qh1rhduhcwg3;1:gk7;1:7h78jdcixeh7jiylgoqh7tkluh9wl1;1:tk0;1:5l2jhhql6wha;1:ajpfhekhc;1:cfvjgzkiupk7rk9;1:0incjogijtik;1:hkg;1:3hf7hb8il9gqalgbjrdh8eklfh8gh9hikiksjf4lhfoheqj2rh8sl1th9ug1;1:pj3;2:2h5oj0qjk;1:cizhiz;1:7ik;7:akq;2:oiz;1:0hb1h62h33j34m75h66h07iv8gn9jibgzcmcdh9eh9fikgg8ihhjghkhamh8ohcrf9tipuhdvimwll;1:dhfej6;4:4iu6g5aiogivojmvgswl4;1:gh6qkuwhc;2:mispk2rhg;3:gim;1:3ilmiv;1:jin;1:5krrh4;1:wjo;1:anpbhhehfuizvin;1:1j0wh5;1:eisqjk;1:2izdin;1:8jkah7;2:9godkheh9oix;3:mlq;2:8iojhcqjl;1:ojt;2:hh4jjq;3:5isdkc;1:3hd4jt5iv6m18hgdhfhiljh0oh2ph4qgyrgxthhujyvlmwh5;4:piprim;1:5ir;2:hgxlgern3tjn;1:fj8nivtik;3:3m7;1:kj2;1:ej5;2:1hg4kdfiwjhgpjwwh8;2:5ik;1:ciodgdeknfh7gmkrhctjauhg;2:8hd9h8ak9bh5hj4jjikisqikwh4;1:pjy;1:nj6;1:7katirwhg;1:fjq;3:0j41kj;2:kk1;3:jjboiyshg;3:1jl2kj7k8diwqh6rgxwgx;1:dj3eik;1:5k2ajeshf;2:ok8;2:7is;2:3ha4is7hf8gkagych0gj1kh7oh9pgyqjivlbwmh;1:vkg;2:8itfitgjd;3:8hf9izjjnpjs;1:uh9vjd;1:1j62jo3gy4lqjhgoixrhdwh9;3:2k88ir9gybiwdivhh7iikjh2;1:vip;1:8geajcujfwko;1:3j15ir6jnbirchcfixggrhhejivkjeqe7uh4wim;1:8j0wiu;1:9io;3:diswiy;1:0h91gx2hd3gw6hb8j09hfbipckldkbeiofj7ggdjj3kjlmhhnhfokwpg6rhaskpth1ugdvhgwfj;1:0hc4ip7jewhg;1:wik;2:vim;1:8j5bh0kjtlhd;1:2je6incil;1:8ka9fraj7bhecixdjufl2gg1jh5qhbul7viwwgi;1:4jy9ixdisiijjh6sj7;1:2iy9il;3:sjv;1:qk1;2:qis;1:wlg;2:8hfak7bgotj3;1:cjulj0shf;1:firpmvrhgwgk;1:2jc;2:tjfuhb;1:3he8kn9ljallbkdegwfgqgh8jgskjhoinphfqj1rgwshhugnwgo;1:1h9dhdqhbujkwlf;1:9it;1:7iy;3:hj5;2:8hghji;2:0imfiq;2:0gv3gj4hb5h46ob7gq8eq9fzaghbgncgydnlepbfl9gh5ihbjiukh4liqmh0nh4pglqj2rikshetgmugbwgu;2:1hg2he4ln7hb8ha9ivbgeghgjmnliqqhbriswhe;1:8j0;3:1j16jv9hgbgpdinegrjgzrjvvhawjm;2:1mjfhegh6hinmipojfpgxrhcwj4;4:gjl;1:8h2vjg;2:ahdfix;2:fj0qjb;1:hjx;4:0jr8he9jibixch7dk0efighghjxtiswha;3:chermcwh2;2:pj7;2:viq;1:cgwjk2qik;1:jj3;4:cinfg2gnajgjsj9;2:9jafjvwhg;1:kj0;1:3hg4hf6hg7h68jz9imahcbh1cl7dhbfjxggxhgtjlbkhdqgurfmsirtmjugs;2:8ik;1:jkspgyqj3sjc;2:tiw;1:tk5;1:dhhejrgjjjik;1:jitkhfljask3;4:1jx6h87jm9gcahgdgoel9fgygmcjfukh6pgqqj7rj9vhfwh6;2:fiughf;1:al0fh6gh9sjq;1:dirmjg;1:8gu9j8akdbj1fhgkk9nhaqj4uhd;2:9gpciodjyehflim;1:6hgjh0pllvk9;2:hjpjgutiuujfvk6;1:1g6agwdh1ekigp2hh2khhlioqj6rgfuj9wh8;1:0j31gv2hb3h04he6gw7h38im9juaiycjfeglglmjgrlkymh3ngwogopjgqgtrimsh5wfl;3:niu;3:fj9;1:biu;1:hj4;1:9jraio;1:gh9jkcqjuwh9;2:ljrmiunisoj2wgx;1:1h63h04h77hcajlch9dk0eh0fguginhjmjh1kgolikqh7rjcsj8th9uhfwik;1:8izcj4fiorhb;1:8iw9inah2dgfem5rgbsj1;2:djceh4jisrkrsiwwhd;3:iik;1:iir;1:9jl;2:6il;1:uix;1:1j4ah3ehgfhegioihejhelj1qj2whg;1:2m37h38inaj1bgkfgegjyhknjl4phgqgvrh4wgj;1:jjbqh5;2:jil;2:fkcoh6qkewh4;1:5h0jh5wmb;1:8jdaj0hhd;2:eiwkganmbojzph6whf;3:wjv;5:mjb;1:0he1h43gx6h37h68es9g2agfbgsdmresmfkdjiskgvlivmhgoimph0qiytheugwwft;1:6oiuhfveiwj4;2:4im8j49jq;2:wj1;1:jk7phb;1:ak6;1:9h4bixejrrjoshg;1:6jmikypj0wh1;2:siwujawj0;1:vjh;1:9j8;2:8jj;1:7h09j7ahhhjbjnxogqriw;8:0l8lhbrikwhb;2:aldkgrmhg;3:qj1;1:7jl8hd9j2ggihiujinqjothe;1:1hb4j2ajdggqhixrjs;1:ajihgjqjssil;1:dj5jgdqjpwjn;5:uiv;1:qkfwhb;2:dinehcgjk;1:igarkntir;3:8h0kk8ll7ripwh4;1:0k41pr3kh5ha6h77gn8gx9j9agabkuch2eh5fgjgikiiwjg3lgwmg5ngeokfpfvqk3rhcth1ugtvh2wgl;1:7h69gsah4bixchcdhfghahg6ijejghoheph5qivsl4tpkuivvh5;1:6o8vc5;2:jgxwlb;1:jhbkk1lh0qk1;1:diq;1:2ix3jbfh3wjv;2:hj4jjz;3:1iujim;2:wix;1:bjtcj4jj3whf;1:jknoh7tjnwim;3:9kdehejhhoj9phbriv;2:4ha7hf8il9irakebh4ch1dgvejqghfjh5qhgrjetgwuk8vjm;2:bhfrj3;1:lj2;1:mk9;2:3jq;2:7gublhfj7;1:dil;1:jj2;4:njh;1:pik;1:ggwhjl;1:hjp;1:1k8;1:0h92jh3lx4lq5h86gx8ja9h2ah4bhfcgrdhfggqhh0jh7kjtmhdoh3pg4qgzufkvitwn4;1:ijy;1:9iofh8hkvuh0;1:0hg1jc3h97ge8hc9hbagfbjddlqeg3fm4gipihgkh8phfthcujgwgr;3:1im3nxmj0rh8vhg;1:niu;3:9jrcgv;1:8j7;1:1hhgndhhdqk0rggtj2wh5;1:3gz4he5gw6hd7ge8j7ejufk6hh8iinjj6lkbmgrngvogxtkevhgwhg;2:piw;2:giy;1:8judhgnjrpjptjtuhgwgs;1:9hdhgsrl8;1:8gf9jmdj6;2:9ioehgjilmj6qh8rjhwka;1:6l47h9biuijvjh6qheuh3vjswh7;1:1h63h38jr9jyak2bjadh7ehfgizhimjghqgqrgtsh6thfujfwir;1:rj0;1:nio;3:9iucg6hjljjkqhgrjo;1:6j68j1pk6rhdtinuguwk5;1:1knjiowhd;1:3io;2:8ir9h7cj4kip;3:0hc1gz3h16hf8ha9gyagddkpejdfkfgithh9ihejlqkh5lh4mipnhcph0sjbuj8viqwfb;1:8ir;3:4l4hilph2wh7;2:ah3dimfjnjkbrhatkbwhe;1:mj9;1:oj3;2:agzdh3eizfgwskdum3vj7;1:1k7jkskgzpgmwhe;1:1hh3h35jy6ng7jk8gx9hcagweh7fhbhh4jfakhalh6mlbnj9ohepgpqh1shgugnvpfwfs;1:jiq;2:0hg1k33hfchbil8jirnhfpjuqhf;1:cjapil;1:3jw7hf9fibiyegvfjfgkbhjwjh7qjrrh8whe;2:dhcuiwvkc;1:ijnuhg;2:5j0jhdoixuj8wiv;1:pjd;1:wip;3:eiv;1:akxdh9eguflpjk5rh1uhewh8;3:aj5dj1gk9jh2qj8whb;2:0j3vip;1:wjk;1:ghaqj6;1:2ij8gk9gzajzdnfehbfjmjgokhgpherhbsimthdufmvjg;2:ahgfhegj1hl8jkskhfogrpl0qgjwgj;1:7hd8iqbinekohh8tka;1:8hedg9elf;1:lj4sio;2:riu;1:jimqin;3:8jcojh;1:uiwwip;3:9in;2:5im;1:8hdgk5;1:6io;1:oik;2:cja;2:bj3;2:0go1ha2gl3hf6ha7h68jc9iobhddhdeirfisgfpikbjghkj3mhaniyoispgnqgfrk9sixtj9wir;1:sjw;2:5mc7h3jh8qhbrj4;3:0ik1h92h63jt4hefhekhgmo6oirph3rj1uhdwgy;1:vin;2:8hebioqjn;1:uik;2:wk5;1:9ik;3:aimhhejiq;1:8gt9j7qja;1:4iuqjswhe;2:rja;1:hix;1:aj8;1:4kl7kkgh9wh7;1:4j2;1:0it8hcbh9jjlkh0mk4;1:5iqah2gkajhbtjduh9;2:fiq;1:3jgjj2;4:8hf9iv;2:0jjklklhcpgt;2:0m11gt8jdahfcjjeizfjcghahinjhcqhdwgv;2:rj5;1:ij9;1:jimnj0;2:cishgwujewis;1:1it4j38h89imqjb;2:bh7nipqjdrl8whg;1:sip;1:likrj1;1:fjyqjd;1:fjihimrim;1:9irbiw;3:oja;1:eit;1:8ix;1:0k8bjicilij4rh6whf;1:0jg8izsin;1:vir;2:rimsjd;2:8j2;1:4ip9giak4bjvgkoohf;1:1gz3gi4hb6h47j08gn9gvajdbh3ch6dh0eh1iirkh8lkamhenhfohhplbqh2rh4sj9thbunpvkfwg1;1:qis;1:finjh5njgqjc;1:ggchl3;3:iik;1:8iz9jl;1:0iw3hd9hddjpeiqfiojg8kgmlkhqh6sjctgwukewj9;1:4j4sj4;1:fjb;3:4iybjaqjc;1:1ix2ilrhb;2:6iwvha;1:8hbakqbh0fh0lioml5ph0wgx;1:8io;1:jlbwgj;1:3in;1:pilrip;1:4jieik;1:hgljj6litrk4;1:9lfgiwjh8rh8timwiz;1:djb;1:2iktik;1:giyhinjje;1:4k3;2:1k4;3:2il;1:dj1eh7ujv;4:6mbbhdjh2mj5oh9ph6qh1rh9thguj6vpowfv;1:6fpvmd;1:wj3;1:sj0;1:1ix2ikdinhhgrhasj3;1:6ix;2:ojj;1:agxlivsk1ujl;1:8hheiu;2:2ivshe;1:mlmwhb;1:0ks1ku9hbahbbhdeh9fh4gj4jgwkgylhcmhfohcrhdukovjmwjt;1:2k9;2:wiv;1:jjxwgr;1:ahgcikfj0jkqrh9;3:0hb1h64hc7iq8iy9j8dj6ejafhbggvjiwkh5oh7pgvqj8;1:kiw;1:8fvekd;1:wjp;1:8jydhdehgghfuk5vj5;1:tim;4:ciswiz;4:sip;1:diynil;2:1ha3jwdkcehbjlrkgpmncnh5oggpinqherg9wgl;4:9hfjjl;1:3h28fe9jjaixbk8ch3dlxeipfjbggkkh6qizrjpsgrtj4vhcwhc;2:3jb8j1ahdjhd;4:1ix;3:lit;2:1iu7gwjk6ok4;4:1h68iybizfiqjgakhdnhgphaqjzrkkslrtgtvh8whg;1:6h7gjhphcql3whb;2:dik;1:diwehewiw;2:8k7ahabh0cixdguehejiwkhbmgzqiurkgvjkwh8;1:8l99guah5dj0jjzqh6wjz;1:1j4;1:6lc7hc8itah8cl6fgzgiujgspharh9uk4wh6;1:bjx;1:8it9hd;1:jijrj5;1:8io9gmbgykgrmk5pj6qh0rimuh7wnr;1:8l19jgehgsj2;1:1k92f03ix4jq5j77ks8ik9gwbjldh0fgyhgyij4jheljamhgnh0ogvpgtrh4uh5;1:jix;1:9h0akjkh0qjprjowhb;1:biwpk5;1:1jnuit;1:ujw;1:8hhkj4;1:uiuvir;3:8jl9h1;1:6jrniowhg;1:chchfejkowkg;1:pj7;2:2ks3jt4ir5h87j98iy9gvbhgchbditfh8hj1jgmohcqhhrgztheukrwhb;1:7he8eu9knah4bkacmndheel9fjnjh4kh8lh0qh9rgxtixwh3;3:0hb1ix2hd4hg8iq9iuaj1bh0ejbjiwphguhf;2:2he4nd6hbin7jhfpgzwh9;2:0j7gjbihcnlsoh3;2:2ik8hdbkqeivgjw;1:6jcvgu;1:riq;1:7jlaj6fhd;1:kkbmjj;1:wjo;1:1hh3hb5gp6k77h0bh4diljjkqkpuh5wjo;2:4jdhgxjj6shg;1:9io;1:7juahfsjw;1:8ij;1:biu;1:8gt9jepiw;1:2mn3ka4hb6jx7hejhhphfqhcwgv;1:jje;2:8ju9gpgj5;3:0h81h62lg5j37h28h8ggbkinmjnnmnoixpgkthewgb;3:8hgrje;2:5ikljtwh2;1:7jkbjrhgtrh2sikwjk;2:his;1:0ikhh8kj6qjowhc;1:qiv;1:2gd6ki;3:3h28gx9esahfdmkeq9fltgh2jhgqharh0uh9wgd;2:tilwj2;1:hin;1:jjamjq;1:rin;1:jj0;4:6jfwiq;1:qlp;2:7hdbj0ej3jn6pharh2wh5;2:1it2hf3gt5jj6h47h48mfajdbhddioeg7fgagiuhhgjljkg9lh8mh4pitqgyrgnsj8tl7wea;2:wiv;4:2iu;2:jkm;1:8gq9j7aiv;1:pis;2:kit;2:jiv;1:ojcuiv;1:8f19lsdiyjhbwjp;1:dgyelhgj7;1:0hb2ji3gd5is6gg7h19gybgzcj8dh6eg5ffogkmhgyihgjpxkh8milnhgogwpglqj1rgnsjltggvk5wk2;1:rje;1:8hcajlfjnghc;2:1ja8iz9jfah9bg3cm0fhehhfkgzmipqheriztj1uivwgw;1:5mh7ix9ixahcfhejjlkhgnl2oh5qherg8uhe;b:8jg;1:bjm;2:hkokhfljorgo;2:bhdfjqjji;1:3j6whg;1:0l11l68iwfhagj1jhakh6phbrhewjo;1:8jf;1:ciz;1:8is9io;7:9gwcj8fj2;2:jjq;1:5me8h6gkajhblikwh8;2:0k86hgsjj;3:ij1uj7;1:2j6ukyvfw;2:kil;1:kkooj0;2:gj4jhc;2:wjh;1:gkg;2:8h6tjb;3:fik;1:gj3;1:hjk;2:9gzam7cileh9fjtgh7;2:dikfh0uj4;2:0ke8judipthd;2:jjwrjb;4:aiuehgjhgnikuixvj0;3:2fq3hf6ks9ipqkzwh6;1:eil;1:aiwjko;1:kjpnh1;1:miq;2:0gy1gi2h93k95h86gi7ha8gu9itch3eh7fg6ggvhezjg9kermv5nghokfpjeqhhsgutovuhgwez;1:siu;1:ngeplrqhb;1:qlgwhf;1:vil;2:4iwriw;1:tmf;1:0h21h33le4hc5hb6h87hd8g49gaannbgvcildggegbfrcgivhkekkmlhemhfogspguqhcrg7sh6tgsugnvh4wha;3:1hg5k06io8k29imdh4mhgogopiuqhetghwj1;1:dhfeiltjj;2:1n03h17h58he9jfagqdj6egufh2ghcij4jgqkljlhdnhdoh3ph7qjxuha;2:qja;1:jilpjt;3:fhhkh5mngwhg;1:qj1;1:ah8fj5;2:7j6cj4;1:tim;1:ij2;6:mj8nj2sin;1:sip;2:aj7jk2pkcrh2;1:bil;2:bjscir;1:2h03gv4h28hgijenheojbqiwuhdwje;2:tkk;2:1hc7jecivdhejlemhfogopkqqj8rilwg8;2:9ilah7gk6rimshfuj2;1:eje;3:1hd5ip8gt9hbajtbhadh9egqfjahhgjjhphgqhaunbvjzwh2;1:kiy;2:8jy;2:jjurj1wgp;2:jgvokppk1sha;3:1hbijl;4:ajyfhckhbojc;1:fjj;1:0jl1gt4iz8j8ahgejaghfhiljh9kj2ohbrh9uj2;2:ujb;1:ajyfhdkhe;1:8gvaglbhfehefkbgjhrimtl9wh3;1:giq;1:5mv7j1fhfghdjjtrhd;1:0ix3gwdgqpk3uj5vk4whc;1:3jqil1;2:ciyhjkjh0;1:ciy;3:kj9wk6;1:6j9uix;2:9io;3:bhgkjatip;1:0hc3he7hg8g39lrekugiuhj0qiqrg1sjruhbwgr;2:1ipeh8fj8hitjjlrgyuh8wl8;1:9l6agbbhfcj3fithhcjiqnjwqijrj5;a:7hh8h29iwbhacipehdjgmkh8nkrqjvwk1;2:0jgah1bji;2:jh1ljhuimwkm;2:6im9il;1:1it9hcdixnj5oiurhg;1:hiv;2:4il;4:jin;4:wjp;2:ej9uh9;2:8h29k7;2:0jd8hbdgvej7jheul5vjtwh9;1:0ir6ikdhcehahikqixrh2vin;1:6hhql5;4:8j7;1:ij5;1:qj5;4:ij9;3:eiwhiojkl;1:tip;1:8jh;2:1gv8jrgiwwjq;1:3iu9hfjjdriv;3:3in8h5aj6nittjauhb;1:8iteirqjg;2:9gzakekgzqiwrjdtkywj8;3:8hg9jeaj3fiu;2:4hgahfghhihcjh0khgoj5qh9rlxtikwlk;2:1gqkl8mklogh;3:giu;1:djeegj;2:8gq9kfhj4rjnuhh;2:ah7hjimjo;3:fitwje;1:dj5qjf;1:hil;1:6iq;1:8iofjm;3:wiv;2:hjfrh7;2:3jl8iy9h5eiqiizwhf;1:8itekphh8tkb;1:6in8io;3:0h03hb4gm5iq6kt7j59jvakidfxejogfsihfjh8nh1ogspmiqh8repsjftj7wgv;3:killjn;3:cit;1:cforkz;5:wki;2:4js;1:hhbqj4;1:hjzjhcrio;1:dgqek1;1:hhejipvj2;1:8iq;4:hh3limrix;1:8h29jqam7ffusjhwhd;1:0ll3k66gz7h5agvcinij0jh3kh6lj3mhdnjargfsikth7uh9viwwgf;2:ch2eivfj6ohbqj8;1:6j5;1:cjarh5;1:hirtik;1:cjf;1:2ik;1:3iq;1:df1el3;1:9j1gilom2ph2qkkwh3;1:hk7ojc;2:4jj;1:ej4wil;2:0ha1h83iz4he5ha7g98gm9h5aipbh1clbegufg6gikhiojjkmh6ohgsmztkduhavh0;2:rj0;2:jjj;3:8h19iz;1:ailhj0;1:8inah4bk1lkgwhd;1:din;1:6kavgr;7:rjt;1:mjb;5:uj1;1:5ik8k29h6bgxcjhfhbnjnqgrrh6ujqwjq;2:8k99gafiu;1:8ij9hdkiqlj2miz;1:dj5jgdqjpwjn;1:1gp5jk8h59hcaizbj5ghahjojj8ph9rjtwgh;1:jjo;1:oj5;3:qjq;1:8iqbj6cjxgjjhk5rh3wgu;2:3j0;1:dhceis;3:dik;1:7iuejt;1:vil;2:8hc9j3ajwej9fh5khgnh7sj4um6vgy;3:dllefrhiv;1:0l71j93fv4ki5ha8hc9lraisgh7hj0iiljfrkh2phbqgsriqsintgu;2:fiq;1:uj3;1:5h0jhfohcpmiqh8wmd;2:4hd9hedjneh3gj3hjkiitqikrjnthawh0;1:8jc9ixggzmkiwgu;1:ijcjgrqlb;5:2gl7jm8jc9h8;3:eiwgj1;1:3im6gsvkc;2:wjh;6:jit;1:qj7;2:8hb9j3agodipegpfj2giwhjcjh0kjdljfthfuikwh4;1:jj5;1:rjt;1:rj8uj8;3:9is;1:0j9ch8qirrk2wh7;3:9iyvja;3:fio;5:lhgnk2;2:qh7wiz;1:0hd1hb3hg4hh9jgajdbhgchedhefisgiqhjcigsjfylkuogbpgeqgxrlqsgwuimvgtwim;3:8ir;2:8lb9j0bj1chedgpeikghgrk4sj3thawh9;2:bh9cikgimrj1;1:viw;1:eil;1:9jgaincjfeh6fj1jh7wiy;2:fja;1:rk2;1:4h4gj0ok0;4:3iy;2:8il;1:cj4;2:cj8;1:1kn7h98ga9kbdjpejbgh4hhgjj9kh8phfqixthc;2:gjgnji;1:8h89gpdloegn;2:bj1dil;2:hhgrj4;5:1hd3jx9h1pirrin;2:0hb1jl2ju3ix5kw6gq8lh9isbgwch3dkbekfgfohjqih3jf9lh3mh2nh3oglrgisitufsvh6wj7;2:eix;1:6hh7jjahhgijrissj0tir;2:cil;1:5in;1:3io;6:gjp;1:bhegj4ijonj4riuwhf;2:bk8dikhgyrjmsiuthg;1:bj9nj4;2:lisqjw;3:ah8gk4jhe;2:jiq;1:8glkm3rhc;1:jj4;1:cgxginhijtk6;2:0kg6hb8hdgk2;1:8he9izdinehf;1:1hd8h7bgpcjodh9flrgp3jgzqh4rheuh6wh9;3:8hc9g6ch9djaek5fjr;1:qjrwhe;1:1h78ilakbghfhkurg9wjg;2:9gydlgegjhkkrh9;2:0gx1h82gy3h94ou5ha6gu7fsaivcikej6hh8kiwmhenheok9pjlqhdrh6shctgzvha;1:6iyvhc;1:0ip4ktaiwbh9chddhbeh3hhakhcmioogvqj1uh4wim;1:oio;1:4jgdgneilfjdih8;1:8gyjh5pldrjd;1:aj9;3:9hhainejafjvgh3ll0ok5uh3;1:hgyjj2liwtj1;1:5ld6hdgkbjgokh0mmhph9qh4rhawiu;1:wiz;1:iltjldqhewh0;4:1hf3k85he8gx9gyalkbgucirdhgfl1gj0hj7jh1kgrmheoivpivqj7rgjuhdwgv;1:8im9j3ajgdj4eh7ghgjjeoj9ph5qherhbuh8wiy;1:bjwgh9qjarjj;1:bj2ohcqjdwhb;1:jhbwlq;1:eiy;2:wiy;1:9iq;1:6oc7hc8h9bhefiphiojj7ph1qgysizwgh;1:aiubh8;1:1jzrj2;1:0j23h74ha7hfaiwdhcfgxhhgjs8qh3wgb;2:aj7ghg;3:ah0bjxgiwuji;1:5j68iujha;3:ghdhj5uj8;3:3j3;1:fj7;1:0ga4j06ixam4dheejjfh3ghchgwik3jl3kj2lheph0qjorggthevgwwfu;2:chgej6jjgnju;1:ujm;1:1hc8iqcgjjjckinrk1;1:aj0gjn;2:7jfqkbthdwhg;2:oix;1:0jd;2:9hgqim;2:0hb1gx2h73jm4ja5jw6h87im8hd9h8bl6dgtfikgilhh3jgvkhalgomiyogsph1qm6rgvsl4vhdwfu;1:giu;1:0gy1kh3h44gm6h67h78ilghfhgdilgjguohfph4qgutj0uj9wo7;3:jim;2:timuitviz;1:uip;1:fiy;3:dj0egsfinniluiz;2:rim;3:jjcwhe;1:sil;1:lji;1:fjklh5qjzrjywgs;1:4jr5is9lpwgz;1:jiv;6:djaejshha;1:0jn1ha3k05in6gy7ir8ha9h9bh1dhbfiplhdniroh4qjfth8;1:1ileizrha;4:4hd9jaeiwjh5kggnjsomqpjlqhgrivwgn;1:0jagik;1:uje;1:qio;2:ilgjimwhe;1:jil;1:6it;4:rim;3:pim;1:fjd;2:gj4;1:biuhispkgwgz;1:ciz;1:qju;1:0jb1gw2jc5g96gr7ja8kqagbblocgodgkejcfgxgjxjinmgtogsrfttj8uhhwiv;1:6gjuiuvjl;2:dhghir;1:cj4;2:6kraikphewgx;2:8j5git;3:gjg;1:ohepji;1:1he3hf5hfcm6giuilnrghshfwhd;1:0go9khagjdgyekhfjbjh5rh9wjz;1:8h0agxbj5ch7djxehgfiqgl7hh5jfwkkaoiqpheqhbrj2;1:3iq8gj9hebjkjhfqjywj4;1:dhaejajhcwjg;2:dhbeiz;4:9j8ag7bh1einfkgkk2whg;3:8im9j0ch1;1:3kvbik;1:0ji8hd9imklklhd;1:1kt3h27h98he9jhagrdj6egufh3ghdij4jgbklnlhdnheoh5qk0rirthfuhb;1:4ip;2:7j48gqbgydizehehk4lh5rm1;1:8hf9jd;1:rin;2:rk7;1:1h43ha4jy6hf7h08kl9l7agfbfzdmheg2ih7jjekj4lh9mh6nhfohbpgyrjzth1ugpvh9wjl;2:wjm;1:lisrhe;1:eh5kmr;1:siu;1:diteiv;1:0ik;3:il2whb;4:pjc;1:0hf3o58heaipjirqhgwgb;1:oji;1:nmqph1;2:8j4jj1;2:0j72ix3hg4hb5hg6hg7h98h79iudh3ejtgh7jjnkl1lh6nhepgxqmurgztgvuh9wgi;2:ah0fgogmyhmnjhdrhawhb;1:5j0cikej7pio;1:bj5rhgwiy;2:3hg5go8hgbk1dgsgh2hjuil3jkwphcqh4rh6th4wl4;1:iik;3:3io;1:3jibhajglmj7wls;2:8gxjl3tkgugxwkk;2:8l59h5aiochbeh8fhehjdjjb;4:pj4tmj;1:fjhnivpiowhf;1:8g09l0cj3dlyefjpk3rh2wha;1:3iv8h9ahgbkkjkioiurjgwh2;1:1hd2h37hh8kh9j4albbirdh9ehgggshh4jh6kgfljjmhcqh9rlhthguhdvjewg4;2:2kl4ll8gwbh5chhjhakkeohfqivrh8thg;1:aipdjwehdjgxujm;3:3hc7hh9h6cjfejngh2hmcjfskjcml4phdrfmsiotl0uhbwg8;1:pik;3:5jc;1:ajkjhbqk6;3:9h1albjj2ojasg9;2:2jjajqfhg;3:fh7gjthiowh8;2:oiuujm;2:5j2hisriowil;2:2na4h87jo8jl9j9eh1hh6jgznj3rh3uh3;1:hg3tknuj9;2:8gq9jb;3:6h8vk1;3:hinjk3rgz;1:wil;1:0j1bhbhj6uiq;2:4hcije;1:6iobj4;3:0kp3ka7hhaikfkdghejhaoirphesgtthfwhc;1:4hf8h6bh1ck7ujd;1:8gw9jjbij;1:kh2lkd;1:hj6kim;1:8jw9jgeh7;1:uj2;1:2lajh1uhavj2wjd;2:8gsah7bj2cgrdh8eh9fk3ghdhl8qhfrj0tl9uiqwgk;1:0ju1h33k58halivrh3;2:6hgvj9;3:4k7jj0ohc;1:hj1;1:tjq;1:0hapjw;2:9ixfh3gji;1:3hc4hb6jzjh5ohapgyqh5rh7unovo2wg4;2:nju;1:8jz9irahebk2fh4gjchjijgukhdokbph5qhdrh8thguhdwj1;1:ij3;1:8habjmwhf;1:jj1;2:fjbjio;1:6hg8habhecinehefjohiwjjroiupjhqh9rhesj2wh3;1:4ju8in9jyeh9wh8;2:9hhghahh5jj3pixqjm;1:ij3qix;1:0itoiz;1:3hf6gv7he8gm9jtbhgeikfjqghgjg7sikwp1;3:gjfsj6ujhvji;5:6k4gilvgt;1:6hh8ja9gxaj1chcditehbfirhisjiyqiysh7tgzuj1vizwha;1:0ha1hd2gx3ha4il5he6jb7m48gw9lrbm9cjbdjyeh4fgmggqjgskh9lgnmgzoh8qhargntgzugn;1:wj5;1:8h6ajeghghjnjgdqj1sk6;1:6k28hc9incjzjimoinphbrgxwgu;1:7ik8hb9h9egvghbqjerixumhvjxwhg;1:8hech4ellhj4qj8rhgtgy;3:8iuej4mjb;3:fikuj1vim;1:lio;1:0j42hg3kg5k5fhgjhdniwwj1;1:8ir9jtbjbklclh8nh4phcwh1;2:fil;1:cjneh1;2:bhchj8;4:fnygheshfuh6whe;3:hio;1:8gl9leahechbginll7whf;2:dk6;1:gil;1:9h1rj2;1:4ks6j78jf9h7agyhhbjkvolopgpqhesgduikwgz;2:iik;2:8ja9gdcj9;2:8ir;1:6jg;1:kk4phfwhe;1:4ijaj6qir;2:2itcimhhfjjk;1:jkzrgywiw;1:1mx2hf3gs4ls6gy7jj9iwagmdhdejpfjygimihcjgbkgblgvmgwojapj5qgtrg9sh6tj6ugrvh4wgs;1:glljh4pkbqhgwgv;2:khfnm8rivtik;1:0hg3h7agbch4fjjghchhdijvjkmnk0qiqrix;2:2me7jb8ixjhfoh0;2:wim;1:lkf;3:8io;1:0hg7kzdizeh9;4:8h69j1ehgmg8nm8;2:ahbrjr;1:bj8;3:tjr;1:hiwkisrhf;5:7kv;5:wjy;1:jk0rizshf;2:eh1miyujvvkr;5:0ikcknrgc;1:5oq7h4fjdjh9phgqh6ujuwh3;1:qiu;2:8ik9gsah7bk6ch6dikehdghchiqkkqshdujr;2:pjhris;1:2irjin;2:tk6uhgwjz;2:0l41iq3jq4gy7gp8hf9hgbjcehagh3hj6ih6jglmhdnj6ph8rggsj5thgugwwkr;3:7iqbk4;1:oiz;3:ril;1:jiotjm;1:9imbjccithjirgv;1:djb;1:9giakabjxgkt;2:8h69j3bipok5;2:0hf1hg2gy3l24hh6hb7hfbh4ciodhdgggijcphfqh1rj2tk6uhewjq;1:7iscjnhkfjfpmjorh6whe;1:9kdgiuhiujh3rixtitwhg;1:kit;6:8gc9jkagnchffmegjywis;2:1js2hd3ha4oe5re6ha7gu9heaj8bh6chcfjkggoijzjgzkgqlhcmh6nhbogapgcqgoshcth7ugiwfl;2:eja;2:7h09j5jmrogqqhe;3:6hgjmkohgplsqhdwgk;1:0h63l35h96jd7hgaindgueh6fnnihhkh2oirqhb;1:2ky5k5whh;1:jhgmilrl5;1:0gw1h32il4gn5h16is7gn8ju9l4agrbfzckldj0elcginhiyjgdkh1mghnkhojcpgcqguriyth7uhcviywey;1:ahejj9;3:8hcsimtkt;2:ghgrj2;1:2ji3ir7hgaj1gk6ljlphcqh6wg2;1:9hfch4dhfhmuliu;1:aj0;2:9j5gin;1:ahcfjw;1:3he6mqeijjgxohfqhaujhvkzwgv;2:9ilgk8jktoh8wgu;1:0he1iw3jh4h45lc6hc8m39ixbh1cgtdiyek6gfxhizih7jflkh6lh5mh6nhfogysizugwvh3;1:hj5;1:ej8;2:1lq;2:dj7;1:3kobj2jhgwgk;1:tim;1:cim;4:bjkcj2rhf;3:0gw1gh2lg3h45l16go7h38j19gyaixcgddhdehcfj1hh1ihgjfdkiumh3ngyok9pjxqg6rhgtk5ujt;4:3j45kh8hf9iwjivwgx;1:rl7whb;1:0jm3jd4is7hg8jfeiufhfgh8ijtlg9phcqjdrfgsgdwkj;1:aiz;1:dimehcjhfsjl;1:bim;1:njo;3:ahddioehcgj2tit;3:ej5;1:5fs7ohjhewhc;2:rj4whf;1:1h52hb4ja6hh7hf8hg9jwejafh9jgskhdmipnhgomppgxqiqrgzuh5wk3;2:0kz1gy2h93it4it6gz7ju9jwdh0fh3gk0hheiiokghliynguognpg9qhdsgztgsujswj3;3:3kz4h3hhfojv;1:ajgfgsgjg;1:gj4;1:qlmsga;1:uji;2:jh7qjh;1:kj3;4:4hgiit;2:9jb;1:8juahhujg;1:8iyfim;1:1j7dj6ehgrhc;5:1h2ojlqhdrjv;1:8ik9hh;1:9hgejn;1:njowhg;2:5qlahffk0jh2ohbrh5uh1wh6;1:hiu;2:8iseizfj4gjtkk8pheshhwha;2:agzfgygkfhk9whg;1:ag5cikffzwp2;4:1iwkkurhd;1:oio;5:9iv;1:0iu;1:ijm;1:dj0egugjhuiq;1:hiz;4:jip;1:0gl1q5ah9ghgmhgnikohbpjrrgiwhc;1:4ij8hf9inciughdij8mlowgr;2:uiw;1:wiu;1:5il;1:jhclkhnhgqkgwin;1:8j89kuak4bkecjfegzfghjhbkj5nhfrh7thewhd;1:gil;1:ciu;2:jgxpovwgx;1:8iy9h7bjigjqjkqnhgofcpnbqj5rgowgh;2:njwwhf;1:nik;1:hgyrk3;1:ghcjiy;2:fhggkjhiv;2:eij;1:4np8mh9l3bfvchcehamhgrh4sh3uh9wgu;1:0gy3ke6ljwgk;3:5j2diy;1:1ip3obgipmj1rh8uhhvhcwgi;1:oja;1:iinjjq;1:0km1gh2h63m84iz6jt7h38fr9fxahfeipfishjwigejilkgnlgymgznkfog8pg0qgorinsj2thewl3;1:9h5djl;1:1hcgipwjx;5:fipoiy;1:aheehehjzjgorg7tjzuljvk0;1:6mxwgq;1:wit;3:vju;1:8jaah8wis;2:dj3eh5rju;2:aj2wio;1:0iu3j56hfaghbh6dj2ekpfgogkkhjbij5jhfkh8lf7ohgpgzqilrheshauh1wk9;2:iin;3:bgggl5kgrlldnh8qiz;2:8lg9hechgkgvnkh;2:qk0;3:ejnfh5;1:jjwkhgljmohephdwl3;2:9kf;3:aj1ein;1:0he7hd8gt9gpah6bhadmieltflqgh4jgrphgqixth5;2:4iy;4:1he2io3g24go6gk7j78lfaj1bh8ch6dipej1fh3gh6hgmjj3kh1mhenh9oknpgqrkqsgyth8uh1vkywh0;1:3j6wk3;4:akcfh9jhfqjb;1:8j4aikbjqdheeipfiwkj2nh0qj2;3:cj6;1:wj9;1:3gt6im8j29gzghchjajj1qhcsiptgvvipwky;1:2he4it6heah7kjvol8;1:9j8divuk1vilwhc;2:fik;2:eiuhikqitsik;3:5jnik8;2:bhgdh1eitkk9qjb;1:0hd1h32hd3ha4lg8h8ehffhbggpjkppkjqj4rhbtkwwg5;1:kh9pk9;1:0mf2g73jy4ji6h57hfahdghcjjmlhgmhfpgxrj5sjtwgr;1:gj6ihgjh4oj9qhdrkztinwkd;1:9jb;1:9il;1:iil;1:qjd;1:jim;2:1iu4l18h0jhckkrph5qhfrhbwin;1:7hbghfjl5pgxqjrrinsjt;2:hjiiiyjjjrjdtjowh6;2:0hd1he4ln8iziivjg7khamgbnhboopqj7rhbtj6uhdwgq;2:2j44j65hg8jgbhgehfghejglohgph0qkztlguh8wj7;3:einmja;1:0k68h09k6dm5efjjhewhh;2:8he9izwjc;3:diz;1:wj1;1:uip;1:0hg8heajmdh5finhjemilrj9;1:liu;1:4io;1:4jsuip;3:0imehbuj5vj4;1:fipljb;1:2hd3ha4n86h87hhghgin1pgtqherfauhgwli;1:1hf5ircitkh8njopk6rh2;1:hip;5:7h3ojk;1:hiw;1:qjzsh2;1:1ip7ha8gd9k4bhdejifhagiwjjcqj2ritthbuinwgu;1:7h5cgzggvjivnjkoh6phaqk5wlu;2:ejdhhf;1:4ir8iuegdfiuhj0wjy;1:6hfairrirvk6;1:8ik;1:ilwjhfpiwqhfwhb;1:5iqdj0;1:mmjuhhvij;2:0kijh7qhh;1:8ixqil;2:4jtbhejg3kh8lm3phbqj5sjwwh1;1:2hg4hg6hg7hb9fuajabj1cl3eh9fkbgixhghjkakijlh0mhgnhaogxph0ritsh4uh6wk2;1:imk;1:3m17hg8j0wjt;1:8j29h3div;1:3hd5kw6h27ha8fd9m7aj4bhech8gh9jfgkh6nilphfqklrjdsixth0ulivg8wh1;1:ah0fkw;2:bh0gl3ll4whc;1:jh1wkr;1:8mbbh0gh3;1:ajvkh8mhguiu;1:qir;2:piu;1:qk0;1:1jdfh1glg;1:oiqwis;3:gghqjk;1:gio;1:fj1wip;1:aik;2:6he8h5bineisjh7lhgnhbrh5tj7ul2vkw;1:qkkwio;4:rhhwjj;2:3juwjs;1:7mawh5;2:jj3nklwgw;1:0j08imdiwej1fj4gh8kgylknqhg;2:aipuhf;1:lhdrjz;1:6gsvjv;1:3he5he9hfairbh7fh8hkpjksphgqjfrjeth9wip;1:bkdgivkhdrhb;1:6gvjmvqgrukjvgpwh4;1:4iphk0nitrj1;1:0hb1hf2kg3h55k06hd7lx8gicixehbfhfjg3kh2mhgohaphcqgsrm5sj0thgujrwf9;2:3iqcj9;1:0j08l59grdk1fhfgiujg6kh7livmj2whb;1:1ju2fu3gn4h55hc6h17qq8ioahfchadh0eh0fh4gj0hizjj1khbmgynj7pfsrgoug8wix;3:mmwwh3;1:9hbbhbch1fltgh6hivqiyrin;2:0j19jadjweijjh4khbliw;2:0iy;2:oj5;3:bjnckufhe;4:9in;1:3h58jmahbeiufj3gjojhakk3phdshgwjr;3:pis;1:8k0bgyjix;1:4j4;4:njb;1:eikmj0pjd;1:8jiajsbk7dhfejufhfgiuhjxjhdkhargnugx;3:aipwj9;2:5iw8iydhcejiggnkgullanh9wk1;1:bipdgleji;2:1h13hf8gu9h6ah2bfqcgqdjuemofj3gmmhjgjiqkhcljnqh1rkithfuggwgf;1:1in3j48hfdimehejj4rl7wh4;2:diufl5ufm;2:3in;1:4j0;1:4kabinmitnhdohepktrh8;2:8ha9k2eh8;1:eik;1:rjjwh5;1:1jk3h54hbagxbhddipegzfjsikdjgwkhcmhgnlhpjxrhfuhbwg2;1:mh8ohaqk0wjb;1:0m32hb3gv4h15fz6j67k08im9gych9eh5fh2gj7hjpkgxlhbmgvnhaogsrksvinwh6;1:4it;1:9hgaj4rjl;1:kiu;1:2lr8kz9gtqhfwhb;2:3j45jo6hd7gt8jr9hbaisbirdhbehdfh5hhcjnflhemk3nhaph7qgvrdvsiztg3uh4vhawlq;1:tjfuhb;1:ehgtk0ull;1:8jxah4ehefj9gh6hktjgmpobqherhfwgp;1:8hdbioqiv;1:ahcriy;1:wik;2:6jfoivqnjth7wgu;2:hirwlj;1:8h19inaktbjlcjxdh2ej4fgwjhdnjiojxqharfawhd;1:lim;2:cir;1:oj2;1:0h63j57hdagybh5dmbemffkmjgkkhhphdwh0;2:aj5jj6qgnuj1vit;2:1jk7h98kv9mbchhdjafh3ghfhhcjfskfflg8mo3nnvoh3pfyqh9rgrthewg7;3:fk0sj1;3:2jobhbrjd;1:hkawjb;1:rj5;3:vj4;3:8j5hh4jjv;4:1jrkjwohgpj8;1:5l17hbahcbhbghgjitqjvrhdsiktiy;1:1jj6h67hehj6phdsixwkn;1:8ha9iv;1:3k19j3ah4jjauiowh6;1:2iv8jb;4:wiq;1:wj0;2:jjq;1:hj6;3:ejgfji;1:iiz;2:air;1:7hd8gtaiobikjm4;6:5ivjim;1:4jm8jd9j3ahfgiqjghojcwhc;1:wiu;1:qit;1:3jg;2:1hf3h76izjj3ml1nk9ojgqh5rh3;1:8gfajdujf;1:bir;2:giljjeriv;1:fk9;1:2gh3kzpj3;1:9iofispir;1:cjkmiwuiq;5:ujo;1:djgqk4wh9;1:8l29glcjxrgxwhc;1:4hdiilolu;1:fj1;3:wj0;1:1irjil;5:jh8sj8wis;2:filgjaoir;3:hiz;1:0kh8k3thewh9;2:3k19imghgrh8sijwiz;1:1khwh8;1:wj9;1:2iq4il7hh8it9gmaivbgjej0fllgmqjjhoh4qh8rf6sg4thfuitvhfwgl;1:kilqjd;2:3jvnin;1:fin;1:pj8qhgwjp;2:ih4skuvik;1:hil;1:fiv;2:1ip3jggiljjqqhfrhb;3:2hd6h47k38j59imckxeglggyihdkk3lgxmh9ogsphbqitrh1tgdug5vk6wjk;3:7jujinrin;2:ris;3:3io4il5mx7hh8gragzbilch9diueh9fh5hgvijbkhdmizph8qgjthd;3:4j88hc9k8eh9jjj;1:wjz;1:wjf;2:cinqjl;2:4iyjl1kjvwh0;1:1hg8iodk9eg3rj3;1:4ijjgjwlf;1:8imcjywil;1:fis;1:3ha4hg5hc6jf7h88j69g8aghbotciqegbfgzgitigzjh8kh4mjwnguok7ph8sijth5uh5wjy;1:mikrj5;2:qij;2:0kz4h0;3:hirwjm;1:wke;1:9hbajadn7efugj9sh2;1:8il9h6oiy;4:5j4;3:0gs1mj4irgh7jmkkhfphgrgr;2:ujcvjd;2:jkcwgg;1:chcrk5;1:ahdbkneishh9jhdrkgwhg;1:5ir;1:ak4fge;1:2in;2:dh4ejf;1:dj7;1:8iq;2:8j3;1:ujd;4:4jvkj7;2:9jd;2:aikrir;2:okc;1:1ha3jc5hg6h47hcaivbl8cjldgugj4hh5ihekkvlh9mgtnhcohergxtgwvha;1:ahggipkmflg1;1:8h4bkojisogi;1:kim;3:9jy;2:9j6bh9fheghfhkyokhphd;3:aj9;1:1iy;2:bkaeio;1:2gq6kkdireh7vkjwgy;1:biphh6nj7rjbwiu;1:4ip;2:0iq1gx3ir4hg5jv7iq8he9h6aitbk9dgrfjwgixhh6kh4lgvmj4nhfojrpgaqhergoskvwfz;3:7gp8ipgntjgfkjywhb;1:2h36iu7ivbglch3diwiixjh1ohapjnrh2tj4vhawj0;2:jjrmjh;1:1gw2h63hd4ip5m56h47hh8jvaipch7fj8jggkkflgsmgqngtokxqh8uj5wg0;1:7g8jkf;1:kj4;1:6it;1:1he7ha8fk9gxajycjnehbfiljgakpolisnhcohdpipqj0sj1ugxwg5;1:0ir6ikdhcehagiohipqiwrgxshfvim;1:7iyfj6;1:4hc8h6bh1ck6wja;2:eiojiv;1:cgzeh9fkfhklugt;1:1h9ekajhfqh8wm1;1:8ik;3:pke;1:pit;3:cimsjs;2:0in;3:4j4fjk;1:1h88j3aikbjpdhdeiofiwjh8kj2mk1ngzqjkrh0whf;4:jm0wh2;1:lkknhh;1:qim;1:2k0;2:4ir;1:bjlcj2;1:1ip9jmciukiplhctik;2:nim;1:7hephewp0;1:hjhrgz;1:5kfwhe;1:8j8bhecimjgxkhdmnlok4ph0qhfrhgwh6;1:jj4;1:0kc4io6hb8j59hbtjt;1:9ix;2:ag0bj6flwhmqjimkh2rgpth0;1:hk7jgr;1:wjy;2:8k2eja;1:qjb;3:oj8;1:fim;1:0h71il2my3nd4k56j37h1ah8fheghgjgynhhpgqqggrheuhevh7wj8;1:ahffj9rj9;1:4j15ipoh8;1:3ha5hg8h29gwaipbhacjjdhdfg1gg1hotjjzkhhpheqh7rkttjbuge;4:1hb3h05j67h28j0aiobficiteh8ggyhh0jh9km6lh3mh1ngzojnpgtqixtkvuh5wkr;1:pip;1:0iz1ko2j03h37gr9h9ghehgxjh5ljoojrpitqh0rgosh2tivwgm;4:8izhj7lk2nheujj;1:qju;2:6hgejuphbqmruh7wgx;1:1iq5iq;4:agscjk;3:rip;3:0hh3hf8j79l0ak6biqchbkikphfrhdtiwuj3wh6;2:7ix8jfjh8;2:7hg8fnailbhfdgsfhdjh8klylipmk5nj9qherg6uj9vkywh4;2:8io;1:2go7l6;1:wk4;1:rjd;1:ij7;1:njtwjo;4:8hbah7bh7dl8ekffmpggtjh5rgwwit;3:dhbfjj;2:2h7hgyjm2;2:hgjrjl;2:4m38ky9gpdgcejvjh1;1:ojnqhd;2:8j3qiw;1:agrcjrfh4glc;1:3lp4kc5h36gx7gt8gt9gjakaehefhciiwjhgkk0mhfngroj3pj0rfish3th7vj1wfl;2:ggqkh1nmeqhfrh7tizwj2;2:uj2;1:dhbeis;2:civnjgrhh;1:9ik;2:6hg8ggahedmtek5ghghjkjikmhaphf;2:njs;2:3ijjj3;1:sje;1:1hg7hd8j2aixbkich2ghchj3jjlkhflhbnhdoh7plaqitrgwthguk3vh4wh1;2:dh6fijjj0wk2;1:ej7ghehj1;1:1hg6hd8gu9jkaoxbincjhdgzegzfgpggthh0jgwkgynhgph2qnirghskdtgquj0wg6;1:5it8jubjlcjsfivggjhjbqivrh9thgugqwh9;1:8h69gmgkfhj4jh0kiprkq;1:9hdjhgnj6rj3;1:uh8vjv;3:8js9h3ahhhjd;1:ril;1:8h4bh3ehcgh9sl2tni;2:8hgdiufipkiz;1:8k1bhf;1:jj4;1:4iphiwrhe;5:agyhmijipwhb;1:9k5aherim;1:0lt1gs3hg8is9itahfbixdileirfjfgh3hioihgwgp;1:jj0rhg;3:2kvjhd;1:kj9;1:8jqohf;4:6jt;1:2kj;2:0le4g26hc7j18g3aj3bhgdinehghhbiizjguqh9rgvuj1wm1;1:dir;1:pjc;1:1h03h66h87h5bh1ch5dh7fh7gkrjh3kh6ljnnh7ohfpjzqilslnuk6vj0wh1;1:chgriksil;1:wk8;5:8k0bhehh7uiv;4:0h51he2lf3gv4k95mp6gm8h99ivaivch4ejbfh5gh3hh4jjepg4qgirkwsh4tgluhcvh1wgo;2:8iuojz;2:vj2wjn;1:8ir;1:hio;1:4im;3:4mlwhb;1:2he3lufgh;1:qjj;1:0h81ha3kd4hb5ha6hg7ft8k4agnbgzfhfhh1jlalhcmhgnheoh9pl9qkhrgiuhcvgzwir;2:6hgpkvriuwh6;1:pjiqlgwh7;3:4haojjuj3;1:2k73hg4kyogx;2:ajkfgv;2:0jf1jb2iw3fn5jo7gy8l09goajcegjfhbgh5hf7jl3kj2lkbmh9nh3oilpgrqjurf1shbth5uh9vjbwix;1:lizrh4;1:hir;2:1jj2hg3go4h66gl7gf8h29jnah8dheehafh4ggyhiyjlykg0lh2mnrngdogypkkqowthguhcweq;1:9jujj3ujb;1:gin;1:8jjbhhlh1riytk0;1:4it;1:cj1;1:1izjknsh1;1:2ik5kf6iv7iqbh2kikogstgqwit;1:ciqoil;3:uiv;1:7kh8guhh0jiuql7thhwhc;1:iit;2:biq;1:4jq8hhfiv;4:ajojgmphewku;1:0j82lv3gkgjbhhaoh4qjvrhewgf;1:6jdah7ck8dhfeirfhbtitvgl;3:5k9;2:dgleji;2:dj6;1:akqfh8hherk3uhawhb;4:uiz;2:tju;1:0h81h12hg3h24jj6hd7hc8gi9gibiqcj4djeej2flggfkih8jgckj9lh1mgynktoixsh8uh2wks;1:2iy8ivwhd;1:8mc9efdgzeimgh9jh9kljliuqhgrh8tjbuiuwh4;1:wjc;1:ejhfhf;4:6he8jnbiockjfikgkrjh8mhepgqqjmrhdthfwgc;1:ahhbikljz;1:1h0iln;1:jixoipwhg;1:aim;1:ejpojl;3:ojr;1:ijf;1:pir;1:0iy;1:9irfkagj6wh4;2:0p37gxwgi;1:ujp;3:6im;3:eiw;1:liq;1:bhfmjc;4:pj0;1:4k5mhboh1;2:djpeimfhbjg3sjuwk4;1:8kudjjejmfhcjhe;1:3kcaivel3fgxjh7kgkllbojcph4uhdwhc;4:rj4sh6;3:8kipin;1:eiujik;2:6kfwgr;4:8gh9jtakicgtdg0el0fh7gishj6iiljhgrgyujwvh1;2:fj7;1:al7;1:gh7jjlrlcsh8;1:1n18l4jilkhdnhapltrh9we8;1:3je4iu8hgajdciqkinphdrgvwh7;2:jh2wjo;1:jl1oha;1:3j6ciwhiw;3:dkiegnvj0;1:bl5;3:8iodinehefissji;1:oiwqnuth8whb;5:jimwiq;1:tj8wik;3:7he8h1ah3bjmcjefiogh0jo7khhpgwqj9sj0wg0;1:fkhjik;1:4ikbh2cjkrhbtj9ujv;1:miztip;1:dheehcrkc;1:2is7kpfm5jghqhbtijwgn;2:sinuiu;2:2jq3hf8ks9gyagwbh3ejbfk5gh2hj3jhavhfwjj;1:win;1:tiw;1:qjb;1:8h6gj2jnaphaqgurj7thawh6;1:5gzjh0nivwle;1:7j48hguhgvlb;3:wj0;3:1knjgmwiv;1:3ol7h9;3:ailijnwiz;3:8gu9jafivhh4jg9qlp;2:eix;3:9hfaimclvrg9;1:cjbfhgjir;1:gip;2:hj9;3:1j62jo3gy4lqjhgoixrhdwhe;1:tiq;1:2h57j8;2:uh6vj1wis;1:djt;1:0h01hd3h04hf6hf7h1bjxchbegahh5jjykh6mgsohepkoqhesj5tjduk4vl6wgq;1:pit;2:4jnpjg;1:0hc1ha2kb3g24jo5hc6jd7h48jx9o9aghbh5dl8eeeggyhgfijukhamhdogwpguqgyrl1sh5tiouh4vjmwfg;2:6j18gv9h2aiobikcipehgfjmghdhjxlioojjtj2wh3;2:3in;2:ah6chefh3hj5jhdol2phgrgysiywku;1:fk2gjawh8;1:0ji1h43j25hg6kw8irag9bh4fk3hh5ijhjjckhblg9mheoh1pjvrgisghuh7wgz;1:8gd9k0kh6mo3qimwgp;3:1gt3hb6h59oobh9ch5diueg9hh9phfqhcrh0thcujavjzwku;1:3hd4hg8lh9mfal4bk8dhgeggfgngh5jgnkjwlhfnhfphdqiwrgsshgvhgwgf;1:rim;1:5mm6gxwh3;1:jgzrjm;2:cindikuiqvhd;1:8ha9hdfjmghdjginjephfqizrjhtjrwk4;2:4jicjwrh1wgv;3:bk2rhcuir;1:0jkklllhdohd;1:jik;1:0gw1m92h73imggojnnkhcogkph9qgurgowk3;1:3ot7hdjhgph9wge;1:oip;1:0kk3hc4gv7h6bjwgkujj7kh9lgyqjmrikwh9;2:dk3eio;3:9ilbiohjs;1:wip;1:bj5;1:3gz6krkjuqh9thevkgwh7;1:0ha2he3gu4h56gw7h88n2ajzbk7chddhfel6fgxhfsihfjj4kkimhbnh6ogzpgzqmfrh1tgguhcvhdwf8;1:7lzjgsvgn;3:kj7;1:0k1dh0ejamis;1:0j04kajhfnjuokvpirqhdwgc;1:djrehdrjb;1:cja;1:bh7jkomj2rkswh6;1:pio;2:jj7;2:5jg;2:2ip7ildhefirjh7kh7plpsj2uh6;1:jjnwk3;2:0hg4gbgk7wl6;1:6hhaj1chedguek1fh5ghciiojgjkmyljlngwrhcuip;3:8itbh8cjd;1:8gq9jndj6;2:wil;1:5l88ki9fvgilwgu;1:4iz;1:0oq1gn3gu4hh8j2bhfdjtfh9ghdhiskhgmirnilohbph6qh2rh9thcuhdwj8;1:4j1;2:wj0;1:jhfqiq;7:4kp5h9jg8qkb;1:6k57k39h1agvchedg1eh5gguhhejgpkgfoh9ph1qkdrh6sghtgiuimvp1wmq;1:4iu6iyfixohg;1:aj6bhhchafj7hktjjmqjxrgwthgwh4;2:ciugh9hivkhcnky;2:2khqhe;2:ojz;2:2k3;1:jiv;2:fh4gli;3:fiq;1:5is;1:rjs;2:1h03ki5im8kuaiubj1cj3gh3hjlthbugqwge;1:gkfjj1;2:tk6;2:fj2;2:9in;1:ojh;1:agrbj3sj8tiqvji;1:4iu8j1jh5rj8wk9;3:1iy2ji3gx4k15hd6hg8jw9gmbghch9dgmggjhgxij4jfrkkmljimh8nk1ok0pk1qgfrgjvh9wgk;1:pjauikwix;1:8j9;1:ujd;1:jk3wh7;1:kh1lkbpim;1:2n44hf7kb8ipjhcrha;2:gjk;1:ajffh7ljfrjpwhe;1:8kqahdbk3fh4gjahjgjgrkh4ojgqherh8thcuinwj1;1:diu;2:9jvcjojhgtjp;1:0io1hg4jy5le8h59ixahaghekiqnh8qh1wkj;1:gik;2:8imdin;1:rik;2:tiwwj6;1:8hdgk4jh2qje;1:3im7h5jh5ogyqriwge;2:pip;2:0k21gq;2:sinuh8vjq;1:egbhkzoh5qkhwhg;1:4iwqjrwhg;1:sim;2:hin;3:ejhuhg;1:dj4;1:aj2til;1:kj7;1:aheeirfik;1:1j62ji3h84jt5he7gw8iubgycitdhaggxhgyiinjgjkl2lj6mgynivpjgqgvrgjth8;1:0he3gz4hf5it8gr9gnahabhbeioghdhmujkbkhcmh4nh7qj7sinth3ugxvjawj5;1:2gt4k05j97je8is9h8bhhchejh8ognqhbrjgsjktj9wgt;1:3hf6is8jlbijckcdhdeiwgkhhhgjhcmhcnhepl1qh0rh7vgvwgi;1:oh5pji;2:0g91js3h77h28l09guchaehafh9hj1ikjjfwkiylfzmhgnjzohaph8qh7rkdtl0uh7;1:1j9fk2rh0;2:niu;2:hjxjgq;1:2jm;1:hil;1:2je3iq5j78iq9gvchbdj9ehafh7gh3hhajgykhfmjgnjnoktpk3qgqrgkuhcwio;1:eiu;1:0ha1hg4h35ha6h87he8lf9lsag8bh9ch0dj7eikfgmgh1hhcjffkikmjjnlbogypilqgdtk1vh3wjs;2:dhbeiu;1:jl1qhdthg;1:9ip;1:9hcekbviq;1:7io8gajhbrhfsjrul0vjswhc;1:1hh2is7j6chekk3rijwhe;1:5j6;2:piu;3:jir;1:fke;1:jj7;2:fiz;1:6ip;1:jjalio;2:6h5dj3eh1lk6qj3uk0vklwgy;1:ciufgvujx;1:aim;3:aijgik;1:bhcwl8;2:3hbijlwiq;2:pkkwh3;2:3kifgi;2:0itfke;2:aj9jgrqlerh3wiz;1:dio;1:8irqk7whd;1:bkgjh7kgplhbnmfrjftj3uh8whe;1:wiz;3:3hg8jp9k1ak5biwch8ghbphgtiwuj3wh7;1:fhegjnhhf;1:ij2;1:ejmliqojhuja;1:ch4jks;1:jj1whc;1:5kjbhdchggjljiowj4;2:0hc8ineixjikkjvoh6qkcshgwgz;1:1hc2io3iu4hg5il9gxal6ckldj6ggxjh5miqnh5ohfrgywgh;1:2in3he4is5ha6gt7gw8kc9h1aiqegzgfkhjtihejj4kjzlh8ngqoj8plrsj4uhfwfq;4:1h53im4kz5ld7h78eh9iyah6bgudiveh7fiqgh7hh6ihcjfpkhhmnaoloph0qglrfztgsumbwg4;1:5jbcim;1:8j69hb;1:qlc;1:cil;1:9jpcixdhghjbojaphf;1:8heag7fjcgj5rjxtjj;1:0kg1jg2g83jq4kx5h76h97nycgzeh7ggxijajgfkgglh9mhfpguqg5rjcsh4ugyvh1wkd;2:ah2oirslp;1:0gdil4;1:hj3;1:pin;3:biwhk7rhd;2:mjq;1:ej0;1:hhdrk2;1:bimikijhgqkfuhe;1:gjk;2:3hc7jg;3:gjxwhd;1:8hfqk8tjpwhb;1:8le9hfagzbh6dgqejqjh9nhhqj9rilwjt;2:til;2:1jn8h7ajmfh8jn5kgzrgzwgt;1:jguokvpjzsh9;1:8gfajfdj4ujcwkj;1:8krfh5nk6okupglqhduiswh6;1:9iw;1:0jc6h88j59g0ahgbjucj4dgzggnigzjlqmheoj2pgvrjbtgnvhewkl;2:8lg9l3bh0civehchixjherjowh2;3:8gz9j8;2:3ha4ji7h99hgah8dguegwfhdgjljmgphbqgtshftksuiqvh9wjj;1:5ja9hdbgcghgrph;1:4j6;2:4iovjf;4:3in;1:1hdriu;1:3m17hc8jwah3ciudgeencgimhjkkh1liznheohgphdqh3rh7thauh9wfq;2:gis;2:din;3:dhfeh0fjo;1:qj7;1:0jb1hb2hg3j64ld7fcaitch7hjjik8jhaqhhriksh5uhcwjb;1:biv;2:jip;4:0ki6hc;2:0ja3nk4il6hd7gvcikeivjgxphfqgiujiwgt;1:8gv9kb;1:1lm2j23hf4isbhcfh2ggzhiojh5kjtllimhbogypgzqj1rgi;5:5jkkj3wjr;1:uj0;2:clehjerhcvje;1:rjkwh5;2:hkbrh3;2:2jhohg;1:4j2miy;1:2ji;2:1ha2hf3h65h36hf7h98kd9muajobl7dgpeh7hgwihfjh6kiwlgvmhbnhbpglrhasgqtiyujo;1:nim;1:9gvekx;1:8jk9h9;1:djnegq;1:rls;1:dheejtrhg;2:5iqjgeqkb;1:cj8dhfeilrhe;1:bhgkjf;1:2hc4jm5he9fbah3egviilkjflimnkeojapkaqfnshftjjuirvgf;1:kknphbwk1;2:2k7ag5chdehghfnjh8ohaqikrlusiowko;1:4jv5ivwjl;2:qin;2:lj3;4:rjn;2:8hejj5mgynkzsj3wh2;1:9hfahdbgccisgh4jhdrnnujj;2:ij8;2:1j33he6k47haakxciyfgggkchkpjgolhcmisph6qhfrgishauh0wiv;2:3h45he6gn7fd8k29fualkblxckkfjfgkrhivjflkgplhfmgxnj2ogvqgergishgtiouixvgo;1:oim;1:4jx8j1ansbjtcgyffsgh4hhckh7mhdohaqisrjbth0;1:0hg1nf2jn3gz4hd5hh6k27ge9hcbgzcgadh7fj5gh7kkjok4pg0qjrrgmsj9tixuh1wew;2:qju;1:eil;1:0hf2ji3h74j55ha6j57j68irah6bjwdgzhiljgvkhclhgmh9ohbpgtqivrhavjb;4:lj0;1:wik;1:ch7jjg;4:8in;2:2ik;4:vk4;1:ckvrh3;1:0kp3g8;7:1hh2j1bhedjaeh8ghdhjdkhfnjeoiqsk6thbuj0wh9;1:4jimhfoha;1:kkapjt;2:4kz;1:ilkvlpwg9;1:6kr8iv9h8;3:min;1:8h29kk;1:1gh3kp7hf8ot9kbah2dh1egkgh7himihbkgdlhbmhbnh1pjxqgtrlbshctipvhbwfd;4:9h4aj5;2:anmbhfehfhhguixvim;2:9g9ak0mmrnhewgk;1:fjw;1:cjf;1:diy;2:1jg;1:pjoshc;1:jj3;3:eik;2:8hg9ipjil;1:nkcol2ph0;1:9km;1:dhekivvjq;1:ikhsinwgw;2:4k6hjjjh9;1:8iyajrehgfh6jiu;3:9irrilwir;1:pj3;1:6ji;3:jix;1:hhfjhftkm;1:pisuiu;1:jj1kjblhc;1:8mi9etbh7dhgekarh3;1:cijdh0ek4fhahimif6kjblitrjrwjd;4:wip;1:eiq;2:4j7rl5;1:8h29h7aimbkhcirgjqpk3qhfrhgwjp;2:9iv;1:0j91h3wj0;2:6in;1:0nx3kq8j0jh0qhewgv;1:8go9jucgyjjd;1:rj6;1:8gx9jj;1:aiz;3:bix;1:8jt9h7divwkt;1:9j6agkjk0;3:hgtjjp;1:0j94hgiirwk1;3:aisej7fhagjavh5;3:wiu;2:ujn;2:3h48k6agweitfj2gjlkjzph7shfwjo;1:6jt;2:lir;1:8iokje;2:1hb9iqiiy;1:6jh8kupiowhd;1:6h59h6ehgunxvm4wgo;1:pittik;1:eirpk2;3:9jbdgzejwjg4wk9;1:sjw;1:4k4mhboh1;2:2h57j79it;1:qik;1:0he1h53gx6h27h28es9g2agfbgqch9dmqesmfkdjirkgvliumhgoilph0qixrj0theugwwfq;1:0iy1k02jt4iy8h7bhgikvjg7kgnoh6pioqherhasjougyviu;2:lje;1:ogtwl3;2:ghglinrkg;2:0hd6ik8ixchgpivqglsipuhe;1:8hc9iq;1:ghaqj6;1:ehahinjjv;3:gjbqissip;2:cit;4:4ja8h99h5bgochddh7ejggohhiyjj4oh6rgauir;3:1hd2in4jc7h7aitcgweh1fimgixhixiiojgykh8lhfmh6qiuripth2uj9wgn;1:1g62hc3lhbj8fgegizkh8lmarh0wjp;1:7g68h5ah2einfiqgmqhgvwkw;1:oip;1:aisfhggk1jiwkhfnjy;2:9j3;1:lis;1:wiy;1:cghrkg;1:0f03mj;2:kjo;1:0jh3fk6md8jl9fabhdegthfljfxql9tj3ugovjywlc;7:hit;2:5j0;2:1ji2hg3hb4h16h89guag8bhffhdggzihfjh3kntllanmaoh5pfhqharj7ujmvgx;1:dhgejl;1:hhgqj8;2:giq;1:1hc6gg7iv8h2ak5bhdcjidhgfgmgjxhjyiirjgskh5mhbohhph7qgwrjguhdvjywjw;2:8ixbitlj9rglwjy;1:2h34heolm;1:ej0;3:qkf;3:1itqhhrhctjx;1:7heck5njhrh8sjktjcuhe;3:8k69haahgbgudixqk2ujp;1:4k78j2kh3ng2ok3piy;1:0iq8jebh9gjcjhh;1:8ivainbk1dhbeirfipkj1ngzqjh;1:jj0;1:8h9bj8qh2rjjtn1whe;4:1iqrhd;2:th5ul7;1:0hg1gr3h66h38k09iwairbh7cgighehhfil8phdqh2rh3thdukdvk3wl9;1:8ip9hgbkdgjwhgypk6rjkwgv;3:wiu;1:uiv;2:4jhjhaqipwhb;1:5j08ixfhfgh5hitjglkjbljhnhdphfsjhtj7wgi;3:ije;1:glz;1:jk1niowil;1:vj3;3:agarlg;1:pin;2:3jnrimwh8;2:7h4jjj;1:jk4;3:1hf2iw3ivchafj9mgmpl8uhcwhc;2:0hg1gz2hb3io4go5gt6jf7jh8jx9giagrbiqcfvdgyeksff8gjphjmij2jirkgilirmgzngtogopggqjvto4vh6wgi;2:jhcqjz;2:siw;1:bj0chbwik;1:gj0;1:jh5rke;3:dhaeiu;4:8j4linrh7;1:tjg;1:1hbbhdchffijgk7hjhjh0qhcrj6skzwh6;1:ljc;1:ahefix;1:2lg3h64h45jz7iqdikiivjhfqirthc;1:wjh;1:iji;1:ditwiu;1:7j7ciofhejhfujk;1:aizsim;3:fiowil;1:rivth9ul5vhg;1:4j06j8fip;1:eikgillhgrjz;1:1k32hh3h75j56k17gz9gqdgqejdfiyghfhgpkhamgwnhfpjkqh0rlqwfk;2:8j89h4ahhjj6siy;2:5jo8hgkio;1:djffj2gh2;1:1hc2jy3hg4ls6hf7ha8izbgtchedhdej8fguhh7ikqjh1lh6nheog4qh3rhhuj8wip;1:9ipmj8pj3wj1;2:0ip1im2is3kj4mv5h06gu7h68hb9k5agkbgzcgwdjwefafjtggfhh4jh5kj1mh5ogjpg3rh9ufxwmi;1:8j6gk1jh4pixrhd;1:1lc2j94gr7hf8go9kibivdh7ejwij3jgwkh2oliqjdrgquhbwge;3:rim;1:8hgakh;1:ij6;2:gipuky;1:cjjnjl;3:5it9j7ek8fhcoilphgwh1;1:liuok5;2:8h59jz;2:6hgjisph9qpdthgwgn;2:qk0;1:wjy;1:8je9hf;1:uio;2:ijf;1:9ikgit;1:fjm;1:3n97iw8gu9h6blqhh9jh4phhqh8ripuhcwgp;1:iiq;2:6ip;1:3iw9ipjhgujiwh7;1:1h92hc3gd5h56gq7qg8h89j7agkdg3ehcihfjpqkgwmiwogspj4qh0rjrtgpugzvgdwfw;1:oiy;5:4hc8gv9heknolm4nh4ohbpgeujtvh7;1:8ir9j2gil;3:5iu;1:rjh;1:bikpiv;1:kjiohg;1:1ky8m49egdgygfwjiyklblirqh9rgftj9uiswgv;1:3ilaiv;1:iik;1:8ix;1:1hd4j29hfchfhkrqh7wjj;1:9j7fj2hjpjhdqhc;4:afmsl2;1:5krbhchgyjkjmknqhduipwgk;1:phaqlewhd;2:qjg;1:0j21kp3jq4hf6hf7hd8kqainbheckkdheejrgh1hj6kgamh1nguoh0ph5qh6tjduglvhgwgh;2:6haphcqm5wh4;1:gj9jhg;1:8ilrjb;1:hjo;1:biz;2:8kr9kmbhadh1fjqhh8jh5kgulhcrilsiz;1:kjzqj7;2:fj1;2:6it;1:9k0kjylh0;1:aio;1:jim;1:wkb;3:bk3;2:chfeiohippit;2:8impjh;1:5jg8hb9hfbjmeirjh0qhcsjetirwiv;1:9jc;3:lh7rk4whg;4:qim;1:5j0jgywk0;1:1h96hf9j2bh3cj4djihgyjjwsk1vjuwh3;1:kj3njqoj9qhcwhb;1:0jb;1:8inehhjk5;2:rjl;1:8hgagmbkefk7gjfjhakh7rk9tj3wgw;3:3j4cij;2:bklwj1;1:8j7ah6pjg;2:hikwik;1:8j1bgxjhdrmi;1:3h95jp6h87h38g8ah0chbgjyjirnj1oheph3qk2vl4wjt;1:wjl;3:ej1hj3jh5;4:njb;3:ajqcj5fgtgikhjoij9sh8;2:0h51iq4h46ke9h9jg4kkelionhdoh0pl0qgxshbwjo;2:iik;3:8j3ahc;1:pj4;2:6k1jh4ph6qmc;6:sji;2:7grshdwlf;1:4jeah4jherj9uk1whd;1:3itbhegk2jkywhc;1:ll7;1:8jq9jiajmfh4rhh;2:0gx2is3gr4hc5iq6h67gs8rh9efagkbh5dh5ehbggahewjo5kh6mhenh6oh5pghqn7rh4sh7tnauh6vhfwhd;1:dfvekbwis;1:7ilcj6fh6rhbujr;1:djjhhfrj3;2:0jp;1:8iqbiqcjgmioogqpklrh6wio;1:8fw9h7ahhejhfh3rleump;1:wj1;1:3hbaivcjefhejkdplcrhgwgz;1:ah7cjqfjiijargu;1:8imiix;3:cilwjf;1:9jlahehkitikwhc;1:1he3j28k5ahccmhfh5ggthgwjgxkjirkmuh8;1:jijuj6;2:fjn;4:0hc1gn3gy6hh8g49gsakdbkvcjqfisgnchh4kfrlhdnhfondph8qimrfzsjgthauh9wg9;2:5j0jh1wk0;2:8hd9j4cjskjewhf;2:bk4;1:4ir9iwwjn;2:0jgph1ql8wgu;2:ej3mjysij;3:cj8;1:1lcjjvnhgqh7;2:6hd7m6pjnwh9;2:9jmahefhaiiljgtmgponwpkvqhcrhfujkvhdwgs;1:6lgwfx;5:hikojmqhd;1:rix;1:1h53hf6hd9ikbhgch3dinjgjkjomh9qhgrk4uk4vjlwhg;1:9kjah2;2:7j4hhhrj8;2:pjoqh9uglvjz;2:0h33h84hg5k07h79lwbgtchfdmpegigjqkhfohaph3qh0rgtsh9thcwks;1:1ja8glehdhnvrguthgwik;2:8iu9h8;2:1k23h58jsblfcgveh4jh2mjqrheuhgwgo;1:njhwhb;2:cjkdimjghmjhrk4wh6;1:pje;1:kis;1:7iw8hg9kaehawim;2:8j2;3:3ji8h69heak4fh8jiumhhrj2wjz;1:3hc8jx9haek4ohdphhrk9wjn;1:0iy2it3h05jb6go7gq8g19h3agvbgjchbeh6hgwihgjmomhbnisogppgjqnxrh6shftgyuhbvlewin;1:1ircjzjgwrheujiwkw;3:eiy;2:oje;2:2ix3in5h76je8fn9heaiogixjhbnitoh8rh8th1wjf;1:oimwj4;1:hforlb;1:qik;1:uim;1:qkg;1:ajhfjwgitrhc;2:1gk2hg3h34m57gzao5cgwdgufk3kh3lhbnhgpguqh3rj2ujkwfs;1:4is9kjchgfhbjgmohdqk7thewk1;1:riv;1:jmdwhc;1:7jseivhgy;1:bivgisoh8;1:2ir;1:lik;3:ojc;3:fiykiumj8;2:9ioiiv;1:0h61gn2jl3gt4hg6gy7j2bgqghdhh5jgzklzmkiokzpjnqhf;1:8h79j8eji;1:1j22iw4j2aizrgn;1:djh;2:1hb7g89hgclzgh2hgpjjmmm6ojxpgvqhgrjjwgd;1:2mi7kj8injherhfshcwhf;2:iikjgfsjz;3:pip;1:4j4;4:8itjjd;2:8jf9h3bkpeivrhfwhc;1:9jvgjgrhh;4:qk3;1:ois;1:jis;1:0md1gt2hg3hg8j9ahecjhdkkfjagh8himjhdkhhmhcqhcwgo;1:jis;2:wka;1:8hgeji;1:aj8;2:6jadilehgphgwjt;1:wiw;2:dil;1:0hc4isqkowit;1:1j13mw5he6h17hc8fq9l4afweiofhbghchhcijijjpmheohgpgsqiork4uhc;4:9in;2:0gw3kf8jydhejja;1:8imfim;2:9j3ehckio;1:sil;2:0go1oy3h67h78gwah4bhgdjnehbjk1nizphgqkwrgjuhbwgr;2:6jwsirwh0;1:3gr7kfbh2cgydijegkffugnbhl2jiokhclhfmheojpph4qhgrggsjgthbuikvj2wgs;1:gjdwj7;1:6iy;1:0gr4gu6hb7h18fw9lndk9egifgygk3heyimtjjrnhaoh8pgwqh8rjxshcthbugxvhdwky;2:dim;2:8hd9izhiq;2:qk9;1:9jy;2:aiodk7egoois;2:9iz;2:4ir8k3jhdljhqjcrgvuiowhc;1:8h3aiybhgfh6gnsjkwohgqikrhfsjhtheuh7wgp;1:fjn;1:bk4;1:0kb;2:qip;1:jiq;2:9gsdhcekrgjajhgkh8niyuk6whe;2:0j91h23me4h2;3:sj7;4:hio;1:1hf4he5hb6hf8lm9kmajzch8dhceg2fgegh1klhlg9mh3thaukgwg0;2:eizfjoghdjgbwjz;1:qio;2:4iv;1:4lj5jwagyhixjgzlj6phgqhbrj9ujfwgx;2:lgmqitrjy;1:aimjit;2:2lx7ittj8wgm;1:dim;2:3ok7h9whd;2:3n95l56hc7jhch9dj0fh2ghehizjgdpheqh9rh5uiuvj6wgf;1:jhcsn6vk6wgd;1:4iqwit;2:qip;1:5ilwjk;1:ej1;1:8j7;2:4jm9im;1:1gvgiywjz;3:ej5;6:0gz1hg4j95hc7gg8ka9kgahbel1hh4kgrlh7mhbphbqhgrirvjs;1:fiv;1:ahfhl1jhfrilwjq;2:8h6dkueioqim;1:0ivpiw;2:ahcglmkixlhbqhasj8;1:1h22hf3h64kk5k36hb8gt9k2agrbggchbdiueh8hh0ih9jh0kgvmmenheoklqfprfjshdtgkullwjv;1:uiv;1:wit;2:9iz;1:cjcdh2ek0jinrhctio;1:3h25no7jqciuikejgyphfqharhbwgx;1:0k44is6h3;1:dgmfj6ljg;6:vj5;1:4jjdhfehfuk8;1:1h28is9isaitdh6mj5pjnwhc;1:9hhdlmek2gjy;1:1gf2ir3io4iv6jc7h28k79hbch2fgihjjlhgmh0nhbogipgnqgyrjrth8ulbvl2wgm;2:5gs7h78jc9guagpckdeiogguhinjh0mgyniupkeqk4rgetiqwgx;1:uil;1:0jh;1:vilwis;1:4ivajo;3:5jjjgvmj7rjcuitwh8;1:3hg4ko5h18im9haaorbjmcgvffwggyhhajjekhbmhcoh9phcqikrjatgy;1:eil;2:cipfhfggwrhdskzuka;1:wku;3:8hg9hdcisqj8;1:jiq;1:0jf3hb6hc7l08jgagidh1fgpghdjgklj1mguokopjmqh2rgrujvvikwj6;1:3k8;1:8k3uha;2:1h5kjcljsmh9ng7ohhpk6;2:jj3;4:0h71h22hd4h45gu6jb7jc8jh9gwaghbipchedgyekjfgqgjahl0kgzlgxmgznh7ogqpgvqjorhftn9vhewh7;2:nja;1:lim;2:fjs;2:0hhdj8ehbfku;3:giqll8nh0;2:tj5;1:ojz;3:cl8rgy;2:wjp;1:gk7;2:0p17gxwgh;4:gj8;1:6hfbitfikjjnrj0tj6ukevfowh4;2:8iq;1:8habhfrkv;1:3j6whf;1:nik;2:bhccjofgmhpaph8qhgrkluhfwgi;5:1iqfiwjippiy;1:fj6gju;1:9imahghj3jkusgs;1:oixqlzwh2;1:ajnkgqvj3;2:iin;1:8imlir;2:airfhhuldvh7;2:4kyoiv;2:biw;1:jil;4:cipriv;1:0gv1gt2ir3lr4ir5kd6gv7io9imakccjbdh6eh2fh9gh5ihbjf6kgxlfinh8oh4pgjqfurnfsixuh2vhgwji;1:0kr1km2ko3js4jw5h76haaj3bgvcgtdh1fithjqlhgog1pgvqgirg8th3ugrvhcwgc;1:fh6hkuuh8vjb;2:1jm;3:8j8jjiujv;1:jjn;1:6gsaiwqhgsiqwla;1:jiw;1:wj1;2:wjo;2:eiyqj7;1:riq;1:hjcvj2;2:4kgehfgirkh8lmhwhe;1:8io;4:6h3djeegrqhgujzviqwju;2:6he7hfljcpnvqgswga;1:8j99h6bhdghgkh8mkoogswkn;1:8im;1:gjh;1:direkyugy;1:pjj;3:0hg1h53hg8gy9haamwbgvck5djweklflwgj6hfyihfkh7nh8ph3qhdrf8sk1th7uizwgi;1:3gy6je7hg8iv9inbfzjknkklphfqh5rhesintgouhgwlc;2:ghbtjy;2:2ij8h9bhhch3diqeh4ijfmhfnj0ukrvkdwhb;1:3h45nf7js9h9jh0mj3qh0wj8;2:8godlaehfpj8;1:wiz;1:6jo8iowhf;3:uj4;2:jj0;3:8h99gbajtcj2dh1eimghejgykq2lfjohfphfqj8rgqsjhwgv;1:hix;1:niyuis;1:9ij;2:aiybipgj5jhf;4:wip;1:njs;1:jk5;1:1im7jzmk4rh2;1:0ilgh0hj9qk8whf;1:ljs;1:8jyaj3kgz;1:sik;2:oinrik;1:2iwrjrwit;3:1iq3jiaj6uh1;1:0f03mk;4:fk0rji;2:0hg1gw2g54h55h36mr8jn9gnbgfdjaeimfjqgikih5jg1kgylhemh6nh8ohapguqggrkutiuuj8vm4wg2;1:6in9ipbhhljb;1:jj0;1:2ir3hh4it6j77hc8gv9h4bgrdl5ghcil8lirphaqherk6vgtwgt;1:eip;2:chcwiv;2:1iv5h0jh0wlb;1:fj3;1:8im9jsbj7chgklclh8nh4phcqj1wgt;1:oin;1:0hg4m68h79hgaknfh5koelh1misnh8ofapgyrgguirwhc;1:7jn;1:alndhcegvfktgikuhg;1:hh4uk9;1:niv;6:0hf5li6k1iiwjhfql4vfswgx;6:qjd;1:0jw3ip4gw5hf6hg7h08is9h9ailbh7fhdgiwhfhiklljnphbrjcsg9uh7wmg;7:gix;2:jjc;1:givkik;2:lik;1:3j87gr8ix9h7ak1bh3dhdgh5hgfjitkhfpj4qgxrj7skdwm1;1:2ittjp;2:6hefjvoja;1:likvmk;6:hil;1:1jldj1ehctjp;1:8iy9gmciqgj1ojivit;1:8iqbj4;2:jj9;1:9ip;1:ciokhenkjtir;1:4it;3:1ip3h75jv7hc9h7fhaghghh7jj4lj8oh9ph1qlrrgbsgvtjrwgu;1:rj9;2:8h59izej4fj8uis;2:0kb1ge2ha3gz4hb5h66k88h4bitcjidh1fgkhgzjlekgvlh1mjlnh3ofzpnwqkqrgytm8ugwvhewd5;1:5lf7ha8j79gijmcohgqh5;2:agtjl7ogxpgtqj4rkswh6;1:1jejir;3:sjw;2:1haej8;2:8h4ujh;1:kin;1:ah2flcghh;1:5jq8ipbiogh6jheqh0rh4tmyujawhc;1:fim;3:dj1rij;2:8ik9knbjcehfkjewh3;1:qj1;1:jja;1:4irom2phcwh6;1:6js8jk;4:3kmqhg;1:iir;1:ilxwhd;2:bhfeh9ghchhckjkml8ojkujhwh4;1:3io;2:8ja;1:8hf9gfbjydjtelifitgh7rhewh7;1:0h21jd9mlaimdj1eh5kitrgr;2:0ivhix;1:7j38hgkhgnjjqhatk2;2:tj0;2:4im9in;1:0iv3jk6hf8ipah4bh9djbek4fgzhj3ijckhblffph2qirsgfuh6wix;1:9fudn0efwginjjauhfwjv;1:cippiwwiz;7:9iljhb;1:titviv;1:0hb2gz3go4h45ha6ga7r79ggajgch0gh5hilijkjg4kh1lh6mh8nh5oitpiurfcsmztgq;1:1ku4m16hb8heeiqjgnlizmgsnheofvphdqhgrgwtj0ukgvkowh2;5:ajtcisehbflmgh4ojiphd;2:3j3;1:al1fh6ghasjq;3:2it;1:8hf9hgbjucguejyhk4thf;1:jiu;2:3hg5hc6je7h48j3agmbhdfitgkehgbjiskj8mhfoiupgoqjfrgkshbtjnuhdwkw;1:8jk9lfagrchdfhejh4kjtoj6ql5rghsg4whf;1:aiylj1;2:ahgfhdgkaljl;1:eipgjm;3:jiq;2:pk3;2:0he1iq7m08hadlqhhfjgk;1:oj7;3:1h82io3js8h1agjbgxcqdgfejk8lhgphgqiqrj5th8wgh;2:2gy3ha4h56iu8h2ahcbhffgzjgwlj0njsoktph8rkgwiq;1:8ikoip;1:qjb;1:0hg1kn3he4io6hh7gu8h5ajhbmpfhfgfvhhejhgkh6lh8ohhph4qgurnlsheth4uhhwka;1:3kp6h9lj5oja;1:ajd;2:2iy3gd4gg7hg8gy9hfagybgwdgvfgfgh2ij8jj1kg9lgsojkphgrjysikukzvk8wj5;1:gio;1:3iork7;2:ajm;1:bil;2:dkijh7;2:oiqwir;2:gjm;3:1h4rkt;4:uk4;1:ajhfjugisok3ph8rhb;1:kj0;1:vim;1:hhdriw;4:4ivgj6;1:8j0biu;1:jis;1:6jmjjikiywhg;1:jinmjl;1:3hc8h4ahdbiydhgehdfjmgk7hj7phbqh9wk9;1:6j97iyjhf;1:2iq;1:gj2rhd;2:biugk5;1:pln;3:bioqjb;1:ej8;3:cit;1:oj5;1:eilfjejk6ojrphgwhf;1:2gl4hf7mq8h7jlloh6phatk0uimwh5;1:4jb8im9gxcirehcggmhllpjiqhhrio;2:dj9wjh;3:2k47j1;1:tiw;1:2ks3hc7hd8gb9j3ah1ckjdlgfj7jgbkgwnhhph2qh6rjjvhbwgt;1:0la1fx3gg4h25hh6haainbjgcj6dh5eiufhggkwhgeijmjg8klflhcmg8ogxsh9tkbvhdwfs;1:4iy;1:1h42hg5js6ha7h78lp9h1agebgich9dhhehgfh6gj6kheliymjrph1qk6th4uju;2:7iy;1:rk6wgu;1:5lxciprgnwh8;1:0iw3he;1:8j7nj2whc;1:1he2k58isch0ghbhh6miynjmoikwhb;1:bj9gjjjgzwiu;3:sip;2:0h81h42m54kq6il7gu8gd9jfcijfh5ghehh9jowkh1mh5oglpgeqg5rh4sj5ugovj5wg3;1:6j2lj6pilwj7;1:5hc6gt7ix8lf9jgajubfudmeejzfg4gj9kg2lhfmh7ngzogxpgirh9sh9ujkviuwg0;2:6h5kiuviu;2:dipehg;1:0j2;1:qiy;1:iiwkhglkhnhbph9wjf;1:6iralvcilfh6gh5sjnvha;1:aj6fjy;3:4hg8gvah9bkdggthh9jl2khdlgznjhojeph9qkjrgxwj3;1:uj8vk4;1:8g79lc;3:9j0;2:4gcilt;1:6h18l4jh1vls;1:1gq4hg8gt9joaildileh4fhdhinkhemippjsqhbrkhwgt;1:wj8;1:bim;3:bjtcj5jj3whf;1:5irwji;1:dh1ejbmitpil;1:wik;1:0jvfjbll9pioqjqrflwgs;1:8io;1:his;1:ikyrka;3:fjb;1:dj7ekafhc;1:8jj;1:agsblkfh4gj3jhesjyuje;1:2g23h55hf6h98cs9plafybjachcdkweemfgahg4jk7kp7lgxmhgnhgph7qkhrhctgbvh3wko;1:8k9bhggjrlivwhg;1:wim;1:1h63h14h95iv6hf7hb8ja9n4ajjbjdcildh7egufh2jhbkj8lheminnikph2qiqshcuggwh6;1:8gcek2;2:dj4jhdlin;1:6mw7fxwgu;2:dhaeirgit;1:0hd1jp4h79joaj1bj5ch6eitfirggpij9jhckjopgywh0;1:8ix;2:5il;1:pj4;3:7j4;1:4j17jbdh5ej8;4:siw;1:8ivdk9;3:jjksiz;3:7khbjdch4;2:8ixoil;2:3hf6l37jb8hdgjtniyqgvvgowj9;1:wit;1:0hc3j24hf5ha7g88gt9hcbh4eh2fghgiwhiyiikjjpmh9ohhsnktkkuhbvh1;2:8j0bhdgjc;1:3mu8gq9itahaehcjjeqkkriuuhcwel;2:9in;1:4jb;1:oiu;2:0k21h03o96hc7hcbikfj9ghcijcjh5ph4qhewft;1:fiwljf;1:8rn9eleg8jhh;3:7khdil;2:3io;1:qiqrj3;2:kiz;1:jg8qj8sjy;1:njwwhf;1:1ir3jiggnqju;2:jkd;1:aj2fhg;1:gimjj0;5:jju;2:4isohftj3;2:rj5;1:gio;1:piy;1:9h2dlcegn;2:ejk;1:3kg;1:9j7fgwhk2;1:4irsgtuil;1:6hf8ix9gtegsjhekheojfph9qmcrgmsiutiquitwgi;1:mik;2:qj4;1:jmgkj2whd;1:jiptj7;1:2iz;1:8jl;2:1in8ivah3fjzggokjsuir;1:jhhskl;1:djl;1:1kdchdgj0rgn;1:8k2aj3uhe;2:nipoj5;3:4iw8h1bk2rh2tjwuiq;1:jiy;1:8k5rhg;3:air;2:2le;1:0it;3:diljjk;1:hj2;3:2gq6lv7jbohcpjgqh6wj7;1:gik;2:viu;3:hfzjk9;2:0gz1hc3h94k45hb7h58h09fwblbcfueozgjjigvjfqkkelh3mhcnhhoj1qjdrjcsgwtgzwfi;2:hkijg5mjq;1:qh9wke;1:0hf1he4jh8h6jgrkgymj0nktomdpkaqh1rgywgz;1:0hg1kf2kc3h54gg5is6he7gz8joaivbiscilegyffsgguhkeihejhgkh0mhennipgusiktgjugxvhfwgr;3:7kh8jo9ggcloehcrg4;2:0j53k6agnchehgwjggrlvwjn;4:6hc8h5bjtgk4hjmjh4qlrsgwthfuhbvj1whd;1:viv;6:7j0whd;2:1h03gg7km8jkal5cj7jh4lg6pheqh2rk0tgpwjq;1:3ikak2bhbjgzohbqitrhewk7;1:2j38h1jjhtkhuh9;3:mkwwh7;2:3jnwha;1:cio;1:ois;1:2j1sin;1:0jv3h45it7ki8jj9gmbjdcirgjtjh6lhephgqh0rh2sk8th9uhg;3:8gu9jjvj1;1:giq;1:8gu9j6mhfoiksk6wj3;2:hip;2:dhfhk0jfvqj2wli;3:5izcj9ehdgjhojzphgwh3;1:0kw1ir3fh4ju6jn7k18gm9n7bitchedj6ehafgvggwhjujf6kgslhfmh9nhdoh2pguqghrjktgguh3vhcwim;4:7is;1:gil;1:8j2bjpdhceipfk0ghgjhgkj0nh0qj1;3:6kyqhd;1:rjy;2:4ip6hc8hegjujkrkhgon8pgoqhewgv;1:aikfhepj8qk0whc;1:6gjfgpgjnhizvjq;3:1gu2jb8gq9h7akwbhach4dh7egkginjj7pheqh3rjfthcumtvjtwh2;4:1hg8h5aiobmucjlhjpij1kj3rgcwh3;3:1jd9j8jjkqjwwhf;2:jh8njnwj3;1:siv;1:8l19m8ah5eh2jgfrk6tjtuh7wh3;3:8hgchbej8gnh;1:6kc8li9gyagoeggmj9siyuj4whf;2:aj9fh6;3:tj7wil;2:8jcjh5vkd;1:dix;1:dkgefljjt;1:siv;1:jj7;2:1jt2fv3gn4h55hc6h17qn8ikchadh1eh1fh4gizhiykhamgynj6pfsrgnug8wjm;2:1h02il6ipcjehjnolbqk1rjdvh4wft;4:0j71in3hf4h56k17h58kg9kfaghbg9ckjeg8fj8hj9jh2kh9lhbmhfpgzqgergwsixtj8uipvgkwhd;2:dgcejq;4:uil;1:7jcjgrojewjg;3:uiz;1:ck7flgggzwhf;1:1jd3ipkjgphhriswh1;1:djkeh8fjojj3kgvmkgnhd;1:ghbsiq;1:kik;3:0kv4grlknnhhsir;2:4iy6hg7hfej1hhfjmskjiph4qhewg2;2:riuwj7;4:9j3aj3cjefhagh9;2:4jqaimoha;1:5j0mjlril;3:3hb6gneh8jh5mkinhepheriwvmi;1:2iqolapj1whd;1:2kc8ir;1:8inwjw;1:cikqlgwhf;3:jir;1:7k1;3:6ivrj4vhb;1:4j0wiy;2:9it;2:3ji9h8wk2;3:3jo;1:0heiim;2:rj9;2:ahbrjr;1:5io9hfrmeuhd;1:lkc;1:8hgag5fgtgoajgyphaql6wip;1:8il;2:9j8;1:8j4fimgkjjh5riu;1:0h81hb8j9agfbmngiqjkokgprg8sk0ujiwha;1:djkkjhrgdwml;1:nil;2:ikv;5:hipuk3;1:2iw4j2;1:9kybiseipjhergs;1:1ka2oy3hh4hg6hf7lz8hb9hgghbhhbjh8oh9phdqh6rhgvjewg3;1:aj1fjqhjajgzkioljsmiy;1:8ivtiuwje;5:ag4shcull;2:cinljl;2:1is;2:3klij5wh8;1:4jjsh8;1:7im8h39h7dh6egjghajj7rituoqvk5;1:cir;2:kkb;1:ujd;1:0jb4jl5im7he8ildg6ek3fhbgm9mj2pirqj5rgpsgvuh8wga;1:1h9qhewlg;1:iks;1:nim;4:1gq2h83go4ke5h39l0aiwbjrdhhegchipik5jgxlgnmh2oh8pgxqgcrkyugnviv;1:cj7jhb;1:4kf8k4eiljgrql4rh3wh4;5:1iw;2:cix;1:hh1jkn;2:1kbphf;2:1h77hf9jsagbbhcfiohj4jgrkj9njeoh4pherh4shgthewj7;2:bj8che;1:5im;1:2jg3iw5hd6gt7j09h5bilcj2fhehiuiikkknmgyphcqh3rgethduhavezwml;1:0ix;3:8gi9j8aitbhccj8dimfgfghdppwqhfuhg;1:8h4jj5siqtjp;1:fjllh7rjzwha;3:cmergjshf;1:9jgdjeegsfh3jmonhgofvpnjqgtwgl;2:8haaivcilfh8gmoqiusjqwh5;1:fhegj2;4:wj1;1:gjhpjcrhetjl;2:fkc;1:1mq8l2ghbjk7kh9lhanh6oh1phcqh5rgpwln;1:1iq4jw9hfakhbhachggh4kh7ohfplsqjnrguwh6;1:mjfwh6;2:jilvis;2:1hg2hb3mh6go8h6bh8dh7egpfh9gh1hgmihfjh5kizlhdmhbnh1ohbph6qhbrivshctgfuokvkzwkz;1:qkmsgu;1:3is9iu;1:chgejzqk4tiwwgw;1:4jujjdmirwh2;3:snowgx;1:airbiufhgmjxrjdwgu;1:1hf6k8aj1ghchkjph8qhftjs;1:5fm7jt8imch2jl5qjnwhc;1:9irjjlqhesiktis;2:ogipjt;4:7jijioohfpjz;2:6j6aj1vh6;3:fjdghg;1:rj2;1:5ilglgjimwiu;1:4j1pit;1:kh3lk8rhb;2:gisjk3;1:3jubh9;3:1hg4hg8jnagwbgpcjgdh1filhhdjkbkgrmgunk3ohfpherjxtizvjdwgy;2:4mhcinwh9;1:5hbagvfk9;2:hkarhe;3:8jdjgpkimlhaok1rjhwhe;1:2j1sjj;1:dkiegxuh6vis;1:1h0iln;1:0hb3ja4h29hfairbhfgjehfdil5jjxqinrl0sg7uhb;1:3kccjsrgithd;1:2jfnio;1:5j56mh7j5ghgjgalhfnjjph6qhgugvvn5wgq;1:8iu9habjpcj1ditgk8sixwgw;4:bhewkp;1:4h98jvbhgckhgjvjh3qh7ugtvjgwiq;2:ojy;1:rim;1:1j12hd3gy4h35gv6gu7ge8j49haagvbgqcgrdgleghfgrgj6hgtjk2kfzlgzmlknk2pfsqitrfpshdtgmupdvmbwk5;2:0hf7hgajdcirdireh6hixkk0lhhmjppjdth6wgt;1:aj6fimuhc;1:diz;1:biwgim;1:3injim;1:bj4him;1:7jm;1:fjfwhe;1:1jh2h2wkn;3:6gi8k1diqegtghgujwvjh;1:qjb;3:wje;4:3ikpjz;2:dftep1uhe;1:pkb;1:nj0;3:7jachgeiwfjmhk5ugswha;2:5injjmwgy;1:jipuin;3:hk6jiwwhb;1:jh2wls;2:ckceh2;1:4kzwhc;1:kjloil;2:8kb9obaguchcdgfwha;1:giqoj5whf;1:0hg3h44hd5hf6hc7heahgchffgjgn6hkmiiljmcnhdogopkbrgywg1;1:4m28ky9gpdgcejvjgxogyqiq;1:bitrk8;1:lis;2:1hc3ll7hg8gg9j4ahfhjvjjckj8phdqhergpwj8;1:oj2;2:1k05isrgq;1:kirpkq;5:8j49hgolophdsgu;1:aip;1:hja;2:ajhsh2;2:2j43h44kh8iruhc;3:8kbkha;1:9k6cgpfiolkc;3:sin;1:dinwiz;2:7j8biujhdwjj;3:ajefhfqiv;1:6jehhatiw;1:8lp9haehb;1:fil;1:oik;1:9hbbkkeixwhf;2:4jb8h99j5ej1hjkih7;1:6gi8k3dipeguujwvjh;2:fiq;1:0gu1h93jh4h86hc9kvaiqbj0djdej9fkejh1kgclhdnhaoh9phfqhcsiuth4wgw;1:0it3iu9hbbhddjaeisfiwgh3jirkgulkfmiqoh3phfqgvrj0wiy;1:okg;2:fip;1:8hfeh5ulwvk0;1:9hekjwril;1:nimqjj;1:njj;1:aimfik;1:7he8j4cinjlsrglsjfwhd;1:tkaugmvkywhe;5:0j3;2:9hbghdjgykgznucoh9pkorgtthhuhgwgf;1:9haalvdlzegtfgg;1:aj1;1:0je1gd2ku3h54h26h77gq8l09k3bf2cgqeg3gmxhivjj8kh7lgvmh7nhbohbpgtqinrllshatjauhcwfn;3:6hevjw;1:6fe7fgpfjqqwwjs;1:9it;1:2iu4j0dhaginuhevixwiq;1:6lg8k89h5ahfbjzcgzdlbejyffugh1jh0khbqhhth9uhevkywg7;1:1he3gq4jr8k19k0agnbgscfydhefkrgjrjglkizllgnhbpguqhbrjtshbthbuh7;7:1hf3gt6j07h68h89jrakbbgrfgzhgnjghkm4lgjnh1ohepjpqh8tk5wj6;2:mjyujw;1:1hd8k09lqaledhbeghfgqgh3hh4jfmkjflkjnhfqjwripshbthbwgx;1:0hc1ha3gp5hf6h97h79jqakwcjndhdfh8gimhisigejknkh5ljjmh4nh2ohaploqgargzthguj6vh2wgz;2:2j2;3:ahegjcrilsl0;1:6gxpk6vir;1:8he9ks;1:8iq;1:chfeimfjehjsjhbskmthavjfwhd;1:4hg6kn7ij9h8airbhechbhhgoj2pilqh1vguwj3;1:4imnilwiz;1:1il4j65in6gw7gvbimdh9eiwjjnoh1rhdvhfwij;1:akf;4:8jw9h0dgjemdth1uixvhc;1:1ij7j58fs9jqagbchafj8gilhk6jjiphfrgywjm;1:gj6;1:ijf;1:gghqjj;2:0k32j23gx4in5li6he7heagrdj4egdjkhohbpheqgvrjbuh1vhewhd;3:jh1wj8;1:wj8;1:1lawh8;1:ljc;1:bk8rh7;1:0hc7h68mr9nbagcbh9enhjgsqh7rgksh8wh1;1:jhekgjllhpkw;1:8h4bhfrku;2:8j3;2:8jp9gl;1:bjf;1:8jq9gl;1:piy;1:rj8;1:ejmjgurk8;2:0gk2hc3gz4h95hb6jm7k59giahfdisegvfh5gkqjmrkgxlhcmgunhcoh6rkkshbvilwg5;2:djqeipmj3;4:4hcije;1:1h13lfilauhbwhb;3:5l46lxciohk3jgjpgyqg6wfk;2:0j73j14h67gm8jm9jochgdipegthh9jixkillk1mgunipojmph7qhbrffuh9wkq;1:8hghj2ujlwhe;1:9is;1:1en2ix3h34hh6iv7gt8it9gwbh4dhffhghg2jitkh2llbmfmnh7oo0phcqk8rg2tguvh9wmx;2:rj1;1:8iq;2:cgvmjbrjh;2:5l16hg7ng8imghghjcjftlipphbqh1rhfwg4;2:mj9wjf;3:0hh3gm6ir8is9feah0bh2ch9fghgk7hiwkjolj2mhgnjgogwpj6timuh4wka;1:wj9;1:jir;1:8jq;1:win;1:lit;1:1h8ggzjllqjt;1:uk2;2:2l7jh8ohgqmbrhgwh2;2:2jkchafjohis;3:pk0;3:gj3;1:lkg;3:7imhitih8njxrgzsja;2:pjg;1:ahfcjxjhapitrhbujkwjx;1:fiughf;2:ij7kjnpit;2:oit;1:7iqjk2whb;3:aiw;1:1hewiz;2:0hg1hc3h24hc6he7gy8in9grbnecjohgokj6llkoguph3rkgth8uhawh7;1:9izjhdogxqkz;1:hjcwiy;1:6h58j79h8viu;3:2j33jc8jddj0ehgghf;1:8j0bhfoiv;1:0h31hf4kj9gdaizbkpcgodfsek9fhegheigyjg2oixphgqktrjisgwuk3wj6;1:qjgriu;2:jjh;1:1ko8gp9hdrjx;1:7jf8hd9jeah5mjb;2:dhdeiq;1:2ky3jo4j17j7chddinsgz;2:agmsju;2:jik;1:9iscjaginhj4jjcqhf;1:0iz9hfrjc;1:ejahh3rj0;2:9imsj4;3:1kdahbbh6ggkjljphfrgpsimughvjrwl8;1:0iqej9fhbhheqhaukhwiw;1:3hd6hd7kx8j39h5agubldegyfh5gkujhhkimphbqlbrh1sioth8uiqwg0;2:fio;1:4h55jl7hgahfghaiipnmeojkqhgwha;1:hh2jiu;2:rjn;1:1je8gyfgwjgfkiqohapj1qj0wlf;1:0hg1go2ha3gk4hg6gz8jf9miakibivcftfiugh9hj8ij0kkqlhang9ogupftqk1tgcuhe;2:8iwbh9wkp;1:1hh3hf5ka7jr8h5bilcj1ehggiojglkh9qh0rmdsj5th8uj1wg6;1:dh3hkurjfwhe;4:biqpiz;2:4iq8imsgu;1:aji;3:cjoeikfit;1:dg9ekn;3:jj9;1:8gxbhbehdrl4;3:0gr4jpbis;4:0jb6gzeiongdplfqgyviq;1:wik;1:1iouin;1:1gv3hb5hg8h3agnch6fizggyhj6iq5jirmhboiuph7qiksh6tl0wgl;1:jiw;1:cgujikmjatkiwhe;4:jiq;1:3ja6kfwgv;1:0h91hf5jz6h78jpagmbl3chegizjk1rgysjqvgvwhc;3:ah0chdehffl7gip;1:aj7djgegsfipkisrh3;2:3k7iirjgpkhelkdnh9ph3wn3;3:1ha8jb9jnaj6bg7fgtjgzkkrnh4ph4qk3shbtjdvh1;1:8h7ciykiwliv;1:2h43kv4gw5ja6gz9h9agybj7cixdgefkjglkhh5jg8kh1limmijnhcog1pglqncrg9skfuh5vhcwf9;1:dk8egjjik;2:dipol4wha;2:cix;1:0h78hdbjfcgohhdnj9pj9qkruhg;3:riz;1:gimhij;2:2ff7pqjh4qh8;1:7jlfkzijrph1qj0;1:1gz3hf5jo8ku9fcaltbiucgwdixegjfgjgmchh7jguljqmmupglqhcrg2tgtwfn;2:0j81gt3ha4hc6k87iy8gubjudixfhegk0jhfkjdlh9mhdpjyqgnrgtthfvgn;1:hjw;2:jiv;1:hiwjgewkt;1:pjl;1:1hb3he7j48iw9itajrehajlalikoh1phaqiuth8uik;1:0h41jr2is4gb5hh6ji7gx8g49gjahfcizdhheg7fh2gg9jfjkgzlmanhgojdrjfsh5uk7vlj;1:2jxdh4ej7hh0jj5nin;2:ejdhhf;2:3iq;2:rjlwjg;1:3jj5it7h98gu9jbahgbinckbdgffhggilkhbph9qlsriktgr;2:5je8jq9hajhdohcrjusjztjfwh6;1:0h63ik4iv5hb6hc7hb9haampbitcgteh0hgzik3jgokgwlgzmjbngxogypgtrktshgtgrujbwik;1:0ix1iv3iv6h97h98kuah8bgkcikfgtgluhhcij1jkokh3lgdoivreqsfuugzwk4;1:4hf8ks9myagsbfxcgxdf5elmfhggg9hgcjkukgxnhdohapk1qixtgkuh5wlg;1:bhfdj4kjf;1:hh5jj5;3:8hdgk1hisrh9;1:qjn;1:1jd8heaipbj8kj0lj2;1:gjk;1:2il8heaj5fhdggyij6jgqmjzrk8vjtwgr;1:4irbhdkke;1:biqtix;3:hjb;2:phgqkwwh8;2:0iz8hc9ip;1:8jc;1:gikhjjrhbtjr;2:khgljs;1:5io;1:fkf;2:kio;2:dgtojdqilvjq;2:0he1gm2hf3gz5hf6gu7h3ah7bgzcjedl1emufk4gjwjgvlj2mh6nh5oh0pgwrfushethhukavizwg2;2:dj1eh7ujv;2:8kh9kodijoj8thf;1:aix;3:jh8qlo;3:4h68jk9ivij5ojw;2:4iybh9khgok9phdrkk;1:3iw7iv8jlbjhcjedk2egrjimrfpuhf;1:0he1jk2qf3m84h56h37lv8hebhech8dhhghdhh8jghogiph7qfqrh3thguj7vj3wga;1:bheciukj1;2:qkkwhe;1:4owojhpheugt;3:0io9jyagvejjfjsghfjh8kk3lj3ohcph1qhdwis;1:qj7;1:giyhhctj7;1:hit;4:9iquij;1:2j33gs7io8ix9h1bhdeiufl1jgbqhgrkguh3vhewk1;1:8kz9jbbikkhelh8nnjogurgruh9whg;1:fhegiljiv;1:1j32jp5hc6kh7hc8g0bh7egijh3kjuljbnjsoh4pgkqgwthhwjc;3:fip;2:nip;3:0k23lq5hb6ha7hb8hfjj5khgphcqimriltgxwke;3:0it;1:disiim;1:9ix;1:bkqwh8;4:sj1;4:qko;4:rim;1:cjxrh2;2:hjcjinrhcwjp;1:hklrh8;1:bjvwjk;1:5js9inahbbipcjvdh7ej9fiqghgjjalh9nilqh4thaujowh3;2:9hdnj7;1:qjcug9vjy;2:8h59j4ehggioqkiwhf;1:aingkiwh7;1:8jd9jrdirfimjikqhh;2:oje;6:0ha1hf3hg4h77gv9hgaj3egwfirggskjwlhbmjjohgpilqhbrkvtjguhf;1:iip;1:6hc8j1chcdhcfh8giwhh8jimpkuqh3rhesj1uk6vjmwgw;1:wj9;1:2in3hd6ja7hf8jiaiojh1likphcrh7wjw;3:cja;1:0ne3h64ij9gscjqeikgkajh3kgznhcphdqhcuhawg8;4:wiv;1:mh1oj0pkp;1:bhalkw;2:wjm;2:8h7ahable;2:0kc5jm6hbdimehd;2:div;2:qim;3:3j1bis;2:eixnir;1:kiztjh;1:3j9dkxefgqkcwhh;1:jit;2:rit;1:3j1;3:8ik;3:9ik;1:aintiw;1:eh8jji;1:1g6fiulharh6wlt;1:hj9kjynhhphg;1:0gz3hc8h79j8biqdkhekdfjhggsihgkj1mhcnhgph4qhergwuj6vilwgj;3:8ha9gtciyej4fk9gh9kheuj1;1:aj0fhflja;1:7iz8j29jkchedjojh7ujzwgr;2:hirjhfmjorhb;1:9jqch1;1:aij;1:cjpghhpk0whf;1:3j3;3:0h91hg2k33he5ix6he7h2ag9bhhcgtdjjegkfgngg2honihhjlukhfmgxnhaogwpgkqj4rioujbvjswgb;2:6j0hgzjjsohdpjwrhauk3whc;1:iiz;1:8in9gzajmehdfkakhgmip;2:diuehf;1:rio;2:0jw1h1;4:0he1hd3h84k26hd8it9kbafobh9civdhcghchgsjlhnjlol8ph3riqsgethduh7wgs;1:0hf5ja8ji9jkagpbiqcj7gh0hlnjjekhemhgoh9pioqh8rimthdvhewfu;2:ikyrk9;1:9il;2:rj4whf;1:8js9h2;2:aj3bg0diwkiy;2:djoegx;3:pn4;1:4il;1:bizlim;1:2jo;1:3lteixjh5kjyphbuitwfu;1:1iw;1:7kv8jz9gqbk0dh6fiojg2kiyngzqin;1:rj1;1:anoehfuizvin;1:fizgivwjj;1:0j72hf4h45hd6h27g68jd9h1bjrdimegqfhghfkik1jlwkh2lj9mgxnh4pgsqjlrjcuh3vh3wk3;2:pjg;3:8h9albghbwhb;2:hj1;1:0kl8hf9iyahgrjnsiw;2:7h18iobjpcjyeikgldhhgrhcwgl;1:ckrrh0;1:6it;1:5j4;4:4ji7iyah1sik;1:cjsuio;2:bhbcjw;2:gk4jh6sha;2:pkv;1:ejchhf;1:cjerin;1:liysio;2:0gl2je3h64oo6hfchgdizehegh2hitjjyogwpioqh9;2:9is;3:diu;2:gj1;1:fiv;1:1hbahhgpzhhfjh2qjtrgewh2;3:3hd8j89imbj5ch9jjzkhflg5nitrf9wmg;1:eio;2:gjmrij;1:7iniir;8:0he3kd4h4nio;4:bimciqrh4tke;1:1hg2k65izclyjljoizphfqhfrg4sgywgt;2:aikojn;1:cj8lilrh9;1:3jr8gg9ikbkaeh5fivgh1jinkh8rjmtjduhdvitwg6;1:oh7qje;2:3kg9hfbhhwiv;1:qj6;1:5ivhgkjjiljw;1:fjc;1:9imwjf;1:gjfjh6;3:5k38jujhfqhhtk4uhgwhc;2:8m5eh2ghghivtjowh0;2:2j3uio;2:5ij;1:wj5;1:akp;1:1jhah8fhbgjpiitjh5qja;1:tj6;2:cijjhgrko;1:0h92gu3h04h15h96hb7h8cgjfftgq3hlljj8kktnhbohfpgrqgxriosizujlvilwft;3:tjg;1:kit;1:8ja;5:bjakhd;1:cj4;2:wis;3:0k44gn8he9hfcjgdjwek5gj8ihgjhflj5wgw;1:kinsis;1:2hf4iuolb;1:3io;1:cis;1:7is;1:1kh3he4hh5hg7hcbhefgkjkjkipnh6qjzrhgwjj;1:qjh;1:bja;3:3ivehcfilujd;2:6j7;1:ljstiwuiy;1:1im7jcgijjh8rha;1:7jk;1:qim;1:dj2egznjkwh8;1:0in1inaindj1;1:kiy;1:1h9aiyqmlrh4wju;1:9gidjselhfjlghauhd;1:7kopgv;1:6ja;1:8je;1:jffwl8;4:lj5ojp;5:0ks3hf4g8bj3ghcil4jgilj9qh8rgdwkz;1:rim;1:qjhsio;1:9h1jjdrk5;1:dgofilhke;1:bil;2:wjf;1:0jv1h1iik;2:8it;3:5im;2:1iw5ip9h8niqoj6phfrgmsiotipuj1wgz;2:lio;1:0gd4iwdgqejpgixikukikrhdwhd;1:0in2gz3gv4j08h6ah9fijihdnheoj4qjmuhcwj1;1:8j1;1:8inkjy;1:0h94j47hg8io9j0bk7dluekhfiqhgwjh7kh4lhdmhdohfph4qgnrgfthewh5;4:rimsj4;1:qjb;1:8h79krbisciodh0hjujh4kgxrhdsjethfujo;1:8hepjktj5;1:0fqik4win;3:8ildixfirwja;1:0iujiuuj0;1:1he5lg6h97g38imajcbhbehafjcjj1lh6oh1pgzqinshftkfujfwfo;1:imk;2:6jo8jn9gnniopj0wgx;1:uli;2:6mvahbbiqsikwgp;1:0gx2gi3gr4gs5jn6jm7jl8l3aksbiocgxdh6eh5fglgiuhggihbjggkh4linmk3nhbogqpnwqh3rectimuj0wf7;1:2ik;1:3hgah6djqeisjiqsj0vj5;5:1ip;1:ij8;1:ajh;1:vj0;2:3km8gq9jrch1hjclj9;2:pjf;3:il3;1:1g98h6ah5birgiohk8jgtokapj8rkzwhd;1:cjf;2:diljir;1:gj4;1:dk5egujh8qja;1:0jc1hg2hg3h94kr6gi7h08h09ikaglbg6corfh4gh7hjvjfykgclgkmgxnnrohhpllqgerh4sikth5uh6;1:8j6qh8wkm;1:cja;1:tjf;1:ffeuku;1:piz;1:0gt1g44jr5in6ik7gt8jt9hbaj2bglch8egwfftigbjgkliroj2qjzrj2tgcuiuvgzwm7;1:0kz1l64ir9h8ah8bhaeh7fh4gh0jgykh7pharj2th6ukqvjm;1:1he3hb8onah6bjschddh3elngiuhhejfxljbqikrh5shdthbuh2wh6;1:djmegi;3:1j88giahachfehcfgugjlhmmmjhqkhrgrthf;1:3j4;1:wja;1:0ha1ks2ts3ik4jt5hh6h77l18h49hdbh8ch0dh3ehdfh2ggvhh1ihdjgrmhgpgmqg3sheth5viswfp;2:4kw7iy9gzdgzeiwohhphgqgutl0uj3;1:wis;2:qj8;3:chbkjn;1:0gl1io3gz5iq8kc9g0aj4bhbcjifh0il1jh4kfrlhfmh1nilpg7qg7rllsjatijugowkn;2:wim;1:8j1airpgxwke;1:1it6h6dh8ej0fjduj4vj6;1:ril;4:6jgqj8;1:ahdhitujp;1:kij;2:pin;1:wjd;5:4is;2:1h33jnwk2;3:bkoqiywhd;1:8io9im;1:giznj4oixrhg;1:jir;2:ghbtjy;1:4it6jvchdwgq;1:diuqja;1:0h01l32h53h14g95jg6h27h58j79fzahdbgydimeh0fimgh9ihfjgykjhlkonlroftpirqgkrjbsj7ujqvgswfp;2:fj3ghe;1:2hd3hd4j66hg7h38gv9gsbgnchfdggfkbhhfihhjgfkltlj2mjtnivoinqgvrj3tk8ugmvk2wgr;1:pit;1:hik;1:2jqsgy;1:8h59jojk4qk4rg1;1:8hggm9hh8qjewh5;2:bjaehdrkb;1:3jm7k9ajtffrjh8qiysgntheuiwvkuwh7;1:4hgbiyfj6iisoj7;1:dncedq;4:ninoj7;2:rir;1:4im8hd9ivtjeuha;4:1h84h95h78ll9h9ahbbgugjhjh1kj4lh3mhfngsoh3pozqjosgxthbvgzwhc;1:aippjdujn;2:gkf;2:0jmhhejlgljnrgguimwgn;1:gjgqjswhe;2:3iyck0fhgrhe;1:pjpqh5whg;2:1h58isahbdj0egnfj7gkmhgtjjzljaqh5rjosirwh4;1:6hgphbqmtwgx;3:wip;1:5j1;7:0hf1hf3n36h87h69jgagschgejjfjmgg2jmhkjzohhpgyqfxrgvth5ukdvhhwgi;2:0l24hg6gg7gx8joaheejnfizghfjh5khdpjkqgmwkl;1:0ip;1:vj1;1:3kg5ha7hg9gxakjdhheh6fjigheij5jimmioqgwrh9;3:4ilggxhj2ohdph1qmjuk0vj0wgr;2:8j2;2:sip;1:sj1;1:qisrjisha;1:0j38jcaizbhahj3njkwgz;1:ej6riu;1:jix;2:vj2;2:6ipgk3jh2shb;2:iiynis;1:1h46j47iy8gpbh9ciohjejh4qhfvgpwjj;1:0jd1h53gg5kp6gl8jw9fqbj9dgzfguggxhfoihfjm4kh8lhdmh1ngyokbpgaqjirkjth1ugrvh7wk3;1:5k3njs;3:1ju3js4g76h28gn9h2ak0dgceh4fiwgknhimilhjgokgtohcpgeqh5rj5tj1vipwg7;1:1j48fu9jfbj7ch7ek2kl8qkhrgtth3wgt;1:cjj;1:oio;4:0h71gw2h23gn5h16gxafhbhcch6dhfeh8ijxjjhkh1lgynjbojspggqjcrkysgeumovjywh5;2:gj2lhcwkf;1:pgywk7;1:9ij;1:jimujc;1:8ioqiouke;1:7he8k29gkdgbejwhj1jheoilqhcsj0;1:tix;1:0hc3gw4j06md7h68gl9j6dh6eimghhjgunjbrj9sgyuimvluwfc;1:6lglj8qhdshdvgxwjl;1:6la7lkjhfqhath6wgw;2:8gq9jtpit;2:4je8hgbh8chffilghcijckj0linnjaoj9phcrgk;1:0hg3ks4gv5il6mc7ha8h59ioehcghhhgnihejlcmh5nh9ojfpgnqgcrl5tfzwj1;4:6hf7h89hcbhhdkiejbfgogiwjl9mj7qgerh3th5uitwiu;6:aj3;1:pltqh2wgw;3:mj0rhd;6:kit;1:cio;1:1mb3jh8kaah4chfehafgygguihfjjwkh6ljpnjdogzph5qh0rgjwjz;2:6heak0dh2gh6hl5pkcrjawg9;1:6hfvk8;1:livniq;1:7kajgxpk4whd;1:diujio;1:wj3;1:1gx3hf6he8ilagdbikcmedgzeheijujgzkirlkvqh5sj2tilwg9;1:4pi5helisphewgz;1:8j99hebiodhblil;1:5ji8gu9izbikciljh2kiwnh7pjsqh0wjk;1:9hdeiv;1:6j5jhclknpj1whb;1:wlg;1:1iqnikokcrhauj6;1:fjw;3:hjgkj9rgz;1:lk8rgw;1:dinehdgk1jh9;1:1kaajpfhfphgqixrgswjc;1:4oa8hekjfnhewgw;4:8hfbjtrj5;1:1in5ip8j49h6nipoj6phergosiotimuj2wgx;1:4it8ixwj4;1:gjvjl9ogtpleqguwgo;4:jiv;1:wik;1:3jhqk3;1:aivjjgujq;1:jj5;3:wje;1:jjb;1:9j0qjyriw;1:5jujg8oj1qhcwkn;1:dh0ejy;1:4irdj7ehc;1:uk5;4:hikjjh;1:1j2lm5qlergowgp;2:tjm;1:1h92hc3gq4jw6gy7h9glrigxjgykh3lh9mhenhcoh8pgyqjtrh8sistl7ul3vjawfk;1:5il;1:okcqhf;2:kilwip;2:3h44hf5hc6gx8fcbiugjjhhcihhjjdkgwmhgphcshaummvl2wjt;1:8h5tk3;1:tiu;1:uj8;3:3hf8jy9dbajhbhfch5ehdfhhgkzhhcjh5kjdlirmhenjoph9qh7riytjbuhfwjs;3:diltj6;1:kj3;1:9hhjgvkhglkqsj5wkz;2:1jl8izbitrhf;1:9jt;3:jiqwhf;1:kh1mh5om5;2:9h9jh8qlj;1:vjl;2:qio;4:djdehghjamj9;1:uil;1:lim;1:0hg2jd3ir5jg8im9gwch9djaeh8fgyhgqjgikhdlgwmjfnjjokspk2qgtrjeuha;2:wj5;1:8k0dijhjjjh4;1:bj0riv;1:ghgjhcolaujg;2:hja;2:wis;3:bk8kh4pk5whe;1:4iljix;1:kh0lkj;2:nit;3:7h88jr9gzalfbjgch8khcrgzsj8;1:ljxrgg;5:eio;1:gllwiv;3:7hf9gzaisbhbdpqejufiwggxjgzkjlohhthfugxvimwgx;1:ah6fgkhkksk1uk6vj0;1:1ps3gu9ioehfghhkh7ohepjxrggwhg;1:miw;1:8h49jzgin;1:0mf1go2hf3hg9irah4bitdikeikfj9gh0jhfkh8mleqhdthdwgj;1:5l3hitrhdtiq;1:hhdrmi;1:win;1:7kb9ipahafg3gh6ripukfvkv;1:5j3ahefkirh8tjq;4:2j63ha;2:pk3;3:aj2bh1wj2;1:jiz;1:qiz;2:2hc3h27kajh8wk5;1:3k87gx8inag1chdgkmhgvjmjqh7sh9wj2;4:8hcfilggkhlrphftjkwh3;1:qj0;1:rk8;1:1iuniowj4;6:7jtfilwh4;2:1hg3h7jj6ml3nk9ojhqh9rh4wik;2:0he3hd7hg8g39mbekwgj8hixqimrfusjquhbwgn;3:wj9;5:0jb6is7iu8h29ji;1:9hbaj6fjfmhfrj4;1:dit;4:fix;1:jjmsimwgy;1:9hebhgdjeuka;1:3ij4gz6h37hgah0bj3djnehdfjighchhfiinjgykhglh7mhcph9qj5tl7ujgvk3wfp;2:9iz;3:miy;2:aiscinfh4sio;1:jgxpguqrftjruhcwfr;3:0kc1gz3h97hg9gtah3bhccimgh7hhgkjullxnhboh6theuk0wir;1:glmwhc;1:8jk9kbbg7ejwginkgkllinhbphfwh5;1:8ex9l5;1:5izailbiq;1:6is8e69n5rjlth8uhdvkcwh7;1:hj5rhd;1:fke;2:9iq;1:0hh3h56hb7hd8kuagpbfzcktdizefxfhdgipjh8lhfmkqnhboh6pk1qgiuilvjc;4:bj0kiwljo;2:8gf9irphbtl6wjp;2:0j0sit;2:dh4ekyrgq;1:8h6bjdgj2wik;1:5jb;2:dj3eh8jj8;4:sjg;1:kgvmkjnhdpj5;2:jiu;4:djbeh4fkpggmukavj1wgz;1:8ji9g1ah7bjcchgfkygh9lksoiorgf;1:6hgajqjnophfqhd;1:cip;2:1olchfdjeeh0fiygipjhdkh1lh5nh8oghphdrhfsj0thguixvjbwhe;3:4imtj1;1:1in6iv8indhhej3tj5;4:3hf8gucjkejsghehmfjg4kjfmjgrfosistkpwgf;1:0j0;1:wj3;2:3l08j8aivghckjlnhdqhdtgv;3:plswhc;3:jkcugxvj9;3:akjbfijjf;3:9inpil;3:8kg9hgjhe;2:fj5wkx;6:kl0mhfnja;1:1h87io8h9jkapjwwhf;1:rir;1:8ioagjfmcpjy;1:4kk7k8oh9whf;1:2iq5hfeiwjiltiwuim;2:8kj9lyegx;1:6kbqhdwk1;1:ajowj3;1:9ixagbcl6fgwhgmjivkhelk2riwwh6;3:0ja1h3;1:ajdfhggh8himjgrqjarj4vk1;2:9jy;1:6kkbizdkeeg2jh7khhuhdvjbwk6;3:5k7cgwhjdjgvqk9rjq;3:mhfoiktip;1:fiw;1:6jlvil;1:0hb1hg3hb4h57hh8fj9iranhbh7djfeeyfh7gh0hl3jgrkglnjloinph4qizrisskatgkujyvj4wh5;3:8iwtir;2:6hbumyvgo;1:aithixjiswha;3:3is;1:0iu6g48hb9j1ajtejcfgrghfkhfnhgsj2ulxviv;1:9ilfhcgj6hio;1:2kr;1:ck7fjqrh0;3:1lfrhguhdwjk;1:7jo;1:7jb;1:3ikaj7ghd;3:jio;3:dhbejf;1:6hf8j79j5egyrgpukovkwwhf;1:8ixkgwohbpm5;1:9iu;1:1jo8hbjmrrgwwha;3:3k3gkzhh7wh9;1:dm0eg3;1:5jpgk2jhgmherks;1:3h74kx6ha7hg8h29h2ahcbhcchffkagglhiuih0jjekh4lhbmhgnh8oh7phbqj0riztioulnvjewhc;1:0hg3hb5ky6ip8kgbgxegnghdjm9nj6oh9ph8qiprirthduh0vhbwhg;3:dh9hiqrhdwku;2:4ik5pe7hgah7chbditeh6fh8hh4ijajgukhcmiwph6qghrgwth7;2:2in4llfjjwh4;4:0hd1gq2iw4hg5iu6hh7hb9gxah2bhachcehbfh3gmfhisjg0kh2lj2ninojypj2rhdthbugywjw;1:sin;1:3l96hccj3th9vij;2:8fv9lbche;1:cin;1:hilriosin;1:bhgdh8ej7pj9uiz;1:8k8airbhbciqnim;1:2j63ha;2:rik;1:ak3cgpkji;1:rhewkk;1:sjmuh6;1:hg2jh9tlbuj6;1:8j5rj2;1:1hc2gw3lj4j65lv6h67io8gvajibhgcjedheeimfgagghikajjdnizphdqh4rgztgyugxvhfwgd;1:gixjjrrixwgq;1:ilgwhf;1:diu;1:6jbcinuh9;3:8pr9byah2dhfenhgjjjh3kh9ljzuhcwhg;1:do2egrfh8uhg;1:1h93h95l07ji8h6cinehegilhhgjgskh5mhgnhdqgwrn8sixtj4uirwfp;1:eir;1:ejm;6:6j7chgjgyql2;1:fip;2:0hb1ip2jp3ip6j08hfdgcejefinghajh4kgwmisnh2ohgpioqgfrjyshctgyun0vhgwf7;1:nik;1:rin;1:0iu;1:0kh1io2gh4ln5hd6hf7n68hgghcijojh1kh8lheohdphbqh7sh6thfuhavh3;2:til;1:3jp8k89joah2cjg;1:9iwbh9fj1ghfhj4jilwha;1:vj6;2:3ha6h07h98heah5bh0dj7eftfjdggwhhbjkonj1ohdph4qgsrgxsmwthaum6vkpwh9;1:5io7ix9gybj8dh1fjnjjokh5rhetjevix;2:sj5;1:1j33h58giaiofgigj1jkplknpjbqhgrfzsk0wgh;3:pjm;1:ejf;2:8ij;1:oj3uj3;1:bjj;4:pj7;1:aiofhhgk9;1:2ip;2:giohjkrhc;1:8g8aj9cisoheujawlb;2:him;2:oj8;1:7fgfizjgtwmz;1:3hh4io6gn8iu9ivohgrj0vmmwhf;2:cj6oio;2:3hc6jt7hc8gxalabioeh4glohl7jftlh8mjjoh3pgyrfvsh7tl0ugkvhf;1:3hg5hh6ha8iw9ivah8cgzefwgn4hhephfqgarh7sistjeul5vj0;1:7iuwjv;1:ajqfhgkiolil;1:pja;1:0jf1h72io6hc7hc8kc9jlailblqciudh8eg9fg5ih8jhdkjingwpgzqgorgcsittiovhf;1:jj8;3:jj8qj7wj4;1:1ha8h89kkahafjphjtjhfrfztjlwj6;1:hj5;1:4heijj;1:hhbtj1;1:hhgrj5;2:0hf4ku;4:bhcfju;1:9j9dit;1:ah2gl3jhd;1:pjk;1:1j8;2:jj7;2:1qngn3milr8bth5whf;1:4j1jil;2:ujo;3:0jaeivkjzphdwh2;4:7ja;2:0iz3is4ha5h97gw8ilajxbh0fiygj5hioij1jh3lhfqhfrh5vhf;1:3ix;3:wiz;3:6lgjikll2wgg;1:7jm8fy9jfakebh7fghgizhiskhelh8qhfrlgsjawh2;1:uju;1:5h3rnc;2:siy;1:ah7fjhgh1uoi;2:6he7hdpglqntwgd;2:8is;1:tiu;3:8j1jhcrjm;3:0iu1h42hb4h15ha6hd7h1bh6chdgjphhdijmlizmh2nj3rkjsh7tipuh3vhewk9;1:1iuik2kju;1:6m2fjdoh3vj4;2:4iq8hg9iraivfh8gjolh2rk7;1:nix;1:0ji;2:9h8jiknj2oivsixtit;2:6hgcjdwjs;1:ogfpjmqk5whf;2:4hdij0;1:1gmbipck6ejhrl2;2:ij4;1:8jq9gl;1:3jn7iu8habhgcjeqhd;2:gj1jhemjb;3:8ilfirgit;1:fio;1:7h88ip9hcchbdh1egyghaho6ljhmhcnj5oispherg8uh7vis;2:4iwkk4;1:1gw8hfaj9eiqhlcijmjikrfcwh7;3:akakgwqiyrj7tj5wk0;1:1ju3h35j86jm7gx8h59gwdjjfingj0jj0khbmgwnhcoinpj7qgqrg7thduh3vkb;1:8imdjaehbghfjixrh5tk1uhewkr;1:pjr;2:bimdj4el4ffw;1:6kjphd;1:pja;2:wiq;3:1kggivjjoqh6;2:pk6;3:3iw6jreiptj5vgj;3:miz;6:2gbojx;1:dh4elumjwoilqhewhg;1:3k06hb7hebkfehffh9gjthjnjhcojnqjkrhcwh3;1:8it;3:mkjwhe;5:njr;1:8j7;1:0h71h02ij3he8kr9j6amtbjnchcehhfgyhgzkgpmhboioph7qh8rkesituh9wgn;1:8he9hdammcgafnuggqjheth8;1:0ik7m8ahhbhbghemh9wle;1:8k39j2jga;2:qk8;1:bin;1:jh5kgbnmaojipisqhftirwh4;2:wio;2:0j91h15heafxdgnej4fgwggmhfnjh5qh7rovunxvipwhg;2:oix;1:7h68jubh1dh9em0fhgghejh2mh8ohcph9rgytj5uhewn2;2:7j88ik;3:3jj4h86h57hb8lf9kibgkch6dgxej8gh4hhgihbpkpqkarjhthhuh3vhdwgp;1:1k8kh0;2:1in7izjhg;1:pj1;2:oimqjq;1:ciu;1:hjnrgztj5wjk;2:8h6dk7ejb;1:agxjjksikujx;1:5kk8k19hc;1:kgumkjnhd;2:jj1whd;1:bjljiknizrh3;1:jj4;2:kikphdwl3;1:3h67h28joajqcj2diyegxghbil9jitoivpjoqgzrh3thfuhf;1:ij8;1:ciqhik;1:3hgpkr;2:3jaahfbj0cjdgjslitph9qh2thcwkh;1:jk3;1:1gg2hf3h64iq5kw6is7iy8jx9eaagbbgkcgsggukinmlmnhgqg3sj3vhgwmf;2:1iu;1:8h3tlp;1:bj7fiyjh9oixph9qj6;1:jizogfplpwha;1:0ju1gh3j14gx5jl6hc7gr9j4ak8cgpdiyegtfhcgk0hguigyjfjkizlh6pjmqjcrg9wgm;1:8gu9ggahedm3eg9fgdhkfkiurjmujg;2:ghbjjf;1:3j4;1:9izgja;1:lheoj5pk2;2:aj6fjjkhe;1:3jjjgnwm0;1:gh0wkl;1:0ixdgeekj;1:5j3;2:ghgwny;1:0jc3io6ha7kl8ixagqbiydh1ehgfgzggeij1jgylj8ohdph7rixujpwiz;2:aj2fhg;1:pjh;1:cikll6;1:8h99jw;1:6kb7hg8gv9kmajujk3kj8mhbohapgmqhbsh7th0ukywgw;2:7iojjrqjbwh2;1:3jd9irfgchkqujiwh0;1:cjc;1:8ml9e5wiw;2:0hf8hb9guaj2bh9cj6dhaegzfk1gk5hkdjjzkgyohgpkkqhgthdwgv;1:al1bjbch5dh9egtfklhhhjj6njmrh9uhfwgy;2:2gy8jb9hdhiqjkl;1:6hb7hemivqjawjl;2:rj7;4:3hg7hgahffjfghfjgrqirwoh;1:aixjj4ljaojwphe;3:0h0fjc;2:2jy3gy4gk6gn7h08h79hcagwbgxdh3eh9fjjgimhhejkmnh9oh4ph7qgurgzsncthcul7vohwfo;1:8iz;1:ris;1:8iodk9egyfhg;1:5lfcivfjghimsijwh9;1:jhbwj9;2:piu;2:lip;1:8gaagvel5fizwj8;1:disehcfj6rjrwhf;1:sip;2:uiv;4:ahfkjqrhduiq;1:1k82ircitggkhjzjhgriswhg;3:ujf;3:0ixjj0rjq;1:jj0;2:1j82ir3k85jg6h29heahebh4eh6fjsggphiliipjjdkiolh5mh7nimohfpg7qk4rh1ughvhawgx;1:8jf;1:kiw;1:git;1:6ji7jkwh4;1:5k5;1:1he7h78kaahhehffirggjmk9nnaoheqijrgw;1:jgyqixvko;1:djkegz;1:1h83hd4hd5hf7h98hf9jsaiobj6diyfk4hhfkgynj0okwpiyqgtthcvh8win;1:6jckix;1:jje;2:0hd2iw3ha4jj7gi8g99gragfbhcchgehcgithgwigxjhckh7oh7ph2qjvrh1szstgruhbvhfwg3;1:jj1;1:ij1wjk;2:oisrix;2:0ji1j22h33p65gm6gr7g68ka9fzbivdgiegjfh2gh7ij3jgxkgblh2mgqpnrqitrgjtgsvh0;3:qkjwhe;2:hiojis;1:8hb9h2tl4uhb;1:fiv;1:1j02is5it6kh7io8inaiobhfnhgqh3thbvgw;1:njcriy;1:1h83h46hg7h39izaq4ch9eh4ffuggejj9khbmhcnhbqhasmgth7uk3wfy;1:0hffhejh1kgglklmpknjcpikthhwgu;2:ckajjhrhb;1:iinmiy;1:8hfuke;2:aiwcimfh9gkwqiwsjrwh9;2:8iloko;4:8jg;1:0hb1h25k66gq7gw9gjbheckidh8ehfggghlijkhlj3mh6nhcpgsqfzrlttj7ugivha;1:uk7;1:0hc1h32iq3gx4j07kp8h2bj7cipdgzhjiihejgzkgaljgqgkrk9shavgzwha;1:gik;1:jip;1:bio;3:2jbmkpwh7;1:4jmohgpil;1:0g51h82hf3ki4hb6ri7he8jm9gtahabjocgudknejeffogghhglih5jh9kh2mh3nhfohfpgkqfqrkpteuuh4vkawjp;3:6h9wka;1:jjv;1:1gg3h96ha7gu9gaal1bh3cgedgleh0ggrhnyjlokglmh7oh8phaqjbtgcukqviswiz;1:qjb;1:4iz5jt;1:1jy;1:8gttjjvj8;3:hij;4:3ik;1:3kbjg5wjq;1:7k2gjwhhfqh4rh3sl6vhcwgx;3:3j4jj2qh6wk2;3:7ingjr;1:4im;1:0h24jq5pk8h5ahhjj0oh2pitqgzwjc;2:ck7rin;1:4hefisijj;1:pl6;3:4jxsilwhf;1:9jd;3:cixhilmiuvkawhd;1:wiz;2:hip;2:fiukh9mistil;1:0hc1hc3h44h77gp8k79fnagpbjuel9fkoghdhiujfekgllhdojqph9rfqsjztmbuk5vh7wgn;1:8iv9hfjixujwvh5;2:kiw;1:rijwjm;1:ojh;1:akfqir;1:ckdeh2lk0oiqwhd;1:mim;1:bhfhjjij0jjmrj9tjpwh8;1:3j0;4:8kamjjohc;3:bj4;1:4in8g39gcak7bhcchgdimfkqjiymgkplb;2:dj1ej5;1:8jw9jgeh7;2:0in4hh6hfgh9hhbkhdoizpghqjswke;1:8jf9ksah4dh6fh5ggyhomjgzrizuhbwgs;2:mjf;1:cixrk0;1:dix;1:tjk;1:dj8;1:git;3:8h6ajgblxck0hhdjhekl1lhfrgfwh6;5:5j1diy;1:8ja9h0aj6bircgrkjingzqjgrin;3:4lc8g69kpwhg;1:vj3;1:ijjqiw;1:1h75j77h58gmggfkinmjqnlgoj0pgmrh7tlcuh5wgl;1:7jl;2:5k68gxajnfkvhivojlph8qh9uhfwh2;1:3l0cim;1:9j0eh5glw;1:ogfpjisj0;1:8h1dktekcfimrh9whe;4:2lr7kh8iljh8rhe;1:dg3ejnfhekko;1:0jb;2:7iy;2:0ix;1:8j6jiy;1:3hf6kx7jkafzcoefgdgijhhfjfwohgpgaqherj2uk1wgr;1:ujp;1:8jb9hanhhtiwwj7;1:fil;1:ij2;1:3iz;1:jj3;1:3kf;5:2j97jioj8;3:bjyojmphg;1:2izhik;3:cj9;4:8ka;2:dj0kiz;1:0hg1km3he4in6hg7gx8h5ajgbmogfwhhdjhfkh5lh7ohgph4qgtrnjsheth4uhgwk8;1:dhdekw;2:1im;1:7ja;3:fiq;1:gm6jhawh6;2:0js;1:6mtwhg;2:8j9;1:8j8ciufh4glewh6;1:9h0akjjitkh0qjprjowhc;1:ojr;1:3h58k09n1ah4egrfhfjj6rjqtjnuh5wgw;1:ijx;1:qjk;1:2iz7ja8h6bh4ehatnf;6:4klrjb;1:0h71h23h24hb5hg6hg7gn8kh9h3agdbjnch9dh3ekvfklggwhijjgalh6miwnhcoh5ph1qgqrk1skjtltujdwgj;1:1hg3hf6hc7h28gvah9bg2ch3dimggxhhejghkhcljpnhaonrpgtqlsrnwthhuh9vhgwiy;2:ajhfgmgiymk0rjpwh2;3:ajcbixghejh9tixukuwh0;1:8gmlirokxph6thaulywhd;1:8hgbj7cjjhherj5shf;1:8jwak2bipcjnfh9;7:8gm9l3ajsfhe;3:ainbj0flnrh8;2:ciq;2:wks;1:3kjbh3riv;3:8hf9hfbh9cl9;2:oj6;1:4j2khgnj4risuir;1:qkdwh7;1:wiz;4:bipgivqkwwh6;3:8h59ipoix;1:2gx3jsaik;1:nj6;1:1hg3hg6hf8j2aj8bkecjsdguejkgjwhhdjh5kiylhgmh7rh7wgm;1:cim;1:4hcijeoik;1:2kfeikfhggjeqirwhh;2:8jffj4;1:wj6;1:7jjcitjg4sjytk1;1:uh8vjv;3:2irbj1fjnrhasiu;3:hjg;1:eiljhcnj2wj2;4:8hfdhdegyumkvkw;2:7ixehh;1:9il;1:6kn9j9ghfkkgohfqhasjgwhc;1:4hb8j09hfij9mnurgbwh0;1:0j1;3:4h88h8bj3gjujkhoj6phd;1:nim;2:wj9;1:1lq8jlkjgwgm;1:9h5jji;4:hjgjj1;2:0ik;1:4inbip;1:iiyujl;1:mgowlm;1:wk8;1:0hg1gq3j08hc9k8bhgch3elifh8ggvhh0khemksohgph8rirsjnthgugzwiv;1:ril;1:riy;3:eij;1:0j91h52he3gm4h95h56h97gd8mu9l5ag8bgwcgqdeuem0fh3ggrhgyjh1kk4lhcmp9nkoog5qg5rfsshatjpugivh5wjy;2:0kiqhh;2:5jk7heainbg2ej5gh9hhdjh7kkxnhbok4ph9qk2rj0whc;5:4jdaizggwihbjhhkgqmkanhapivrjiwji;3:3jb7hdrix;1:6iu;1:8ir;1:tis;1:0f03mdciphhhsiluk3;2:0h22hb3ji4hg5h87gz8ka9lrbg6cjwelpgh0hiwjgokhaohcpharjwuh7vhdwgo;1:jhcrjrvlewgf;2:liouj5;2:hinjmdriqwh8;2:3hd7hbbjzgkxhh5jjrkhalgzqkrrilwhe;1:jik;1:rkb;1:1h43h84hh7h89jhalhbj3dgmgh0jgmknwlkrmhdngzogzpguqk1rh9thfuh2wfw;1:vj3;1:0k94gvghcikwjgupjrqiv;1:1in3hh8gs9l1ah8eh9fgqhipllgoirrh9ujhwh6;1:ej1;2:5il8gr9j1bil;2:sj0;1:wio;1:8jdhgwrjasiv;1:3l08fsekb;1:3h84in7hd8is9gnahebk6cmjdjoegxffzghchgwkl7ph6qh8rkatinuhcwh4;1:1jn3hg4h88h2ah8ghdhh7knullhnm7ogspfmqhcrhaujzvh5wgl;1:5iv;2:hip;1:1imekmhiprh5uhf;1:jhfpk9;3:1h17hc9glbj2dhbejlghfhhhjiukginj3okppjgqh3rirthgwjl;1:3j3;2:1klgiwkhc;1:bis;1:wjc;1:0jg3hb;1:gjajgyukx;1:3kaagochehgxjghrltwjv;2:bhdhiril4jhhlirmiophbqk4rjithfuhawh4;2:6hdhj5ql1whd;1:dkgefm;2:giqtjr;1:jj4;1:5j6;1:0kv4fz5hg6ha7h48gx9jeagpbjpchfehhggwhk8iiqjg8kjsmiyph1qh4rh5tj2uk7wit;1:hhelh8rl9;1:1h43hb4gz5hg6h88jx9jjah1bfucj7diyekwfjqgh7ihhjjvkh2mj1nhdohdqg9rgvsiutggul8wgu;1:3gy6kwjhgvl9whb;3:0m31iz3kh4ha7hf8ikbhgghchhgihbjh9kh0qgkwmi;2:5he6ha7hf8h3ajpbktdh7ej7fgrgixjgwlhanh9ogypkmqj0rgrsjjth5ujlvjowgm;1:8iy;2:rim;1:0he1h32gq3iz4gx5hc6hg7h98kp9heagxbhdch9djsfiqggshhfik1jk3kh2lh3mk9nk4okqpgxqh3th4uh1vj1wg4;1:8h89isagqdl6eh2fh0gheil3jizolephcqh9rhdsj9uhdwfv;1:oiw;1:1k9kh0;1:5ip;2:iim;4:qje;2:3ip5j86iz7in8isdgleivggwjj1lipmjingqrg8thfuh8vgh;5:nhfojbpl4;1:2jkwjp;6:6jz8fq9gnah9bl6cl6dgxeglfjtgh9khctjh;2:wj7;1:6hg8j6bhgdh8ehafgogn7kioqk5rhbsjmthawgu;1:oioqlo;1:dipmgnpld;1:6gzqlqwhd;1:8hhjjtpjd;2:oj8whc;2:hjo;1:ojn;1:hh5nitriv;1:rj0;1:cil;2:vik;4:8j9kgznjm;5:1hd7hg8hfak2cj3dhbgfkhjgkikmimnhfrkpuh0vjtwj7;1:wio;3:3iv5k26jx7jhwgs;2:8hcaj3hj8;1:dio;1:8k59inehfjkrwhb;1:fj2ojg;1:8h09j0uipviw;1:bjlcj3rhf;1:bk3rhd;1:5j3qjlsgtujlwhh;3:9o2agrbivch4gh5hhejglkgznkoogurk1tj8uhcwh4;1:0imajoeiz;1:ilg;2:siw;2:0hc2jr3hf4gr6hf7ji8itagabhddiqegifh9gh4hkcjgnkh6nl3ol5pgrqikrh8th7wk9;3:dje;1:7hfjitpmlqhhrjewg4;2:biydj7gilrjcwio;4:4jq8j3bl4fgskiulh2;1:9fibhecl4egkfiygk4rk1;1:7m2jivwh5;1:jja;2:1ir5jt8js9jpaiobh5dh1flijhakgumh9uhawh8;2:0kb3kq4jt6hg7l7ghejh1qgkwfi;1:sio;1:dj2;4:jir;1:wjo;1:tik;3:8in9iogikjkatjn;1:0lo1hd2jn3jd4ml5gs7h7agxbg0dhaggphgyih6jflkikljwmnangfof8piorfxshftk1uh8vh8;3:mjj;1:gjxwhg;1:8kb9goajqcivehghfxjlgqhd;1:1h53lm4gs5jj6k77j78k49itcgoeipfh4gg0hgyih5jj0kg0lh6ogtpftqkhrfytlcuipwgd;1:3hh4hg5gw7hc9jxah8blbeh7gh2hizjjbkjilh0mhbpheqhgrkstgougxvjhwim;2:1iswka;1:4jd7jxaitbh6gjtwgi;1:0jedjkegdfj7;1:bj9;2:8ikbjxch8hgsjjpwjy;2:pjj;1:aivdjnegy;1:1hb3h87gp8goaijblocinfhcgj9hjlnjcqkrsiqthdugowgs;1:2iz;1:0kjgikjhamjkomfph0qh7wgo;2:2is7j3;1:4lmwh8;2:6ka;2:tka;1:mjf;2:8gnulg;1:1j53hf4h07hf8jc9jvehefgtihdjg9ljqoh2tixuhawkx;4:0ki;1:0j1;1:kir;1:jiv;1:2he7ilciu;1:ljc;2:jocqhbwhb;3:kiqnjq;2:cjlgjqjizuiywh8;1:0hc8hdbjkljgoiu;2:akefge;1:5mt7j0fh9ghdjlorhduhf;1:1is3mo8jl9jxagwjhcok0qhbrgyth7uhgwh9;1:aix;1:wk5;1:1gz3l29hgajfbjech9ehcggohh7jh8kk2mhfoh4pjqqkkrh9sh5thawjh;1:8gnokvph8thcum1;1:4izhl2jj6riu;1:9j1;1:9jragrehffh5gjdkhclj6nhgpjqqhbrhesiruirwj6;1:9j1;2:0hg8izgjvhhbjjbkhdrgdwl7;1:5j59jqbhbegjfoggf6uh7;1:sjk;4:wit;3:pki;1:7hh8f79oqdjaeh6jjwrggwik;2:1jn;3:0mb3hf4ipbiocikeiwfijggxphhuhg;1:jgykkrpoawgx;5:8iu9ilal3fh5rhe;1:pip;3:1jykgx;3:3lc;1:9iz;1:jkp;1:0he3h14in5ha6kb7hc8hfaghck5dh9fh9gghhnbjjioj7pixsgptjjuiwvhbwf2;3:bjp;1:8ip;1:8gpbmxfkmghbthe;1:lji;1:0kzjhekikohepjtwgj;1:jjl;1:uik;1:lixoj3;1:6ja9iqjj7wh3;1:1lq6kj8j79hbfisgg2jjdqh4rgf;1:bjfpil;1:lis;3:dilwjo;1:9h4cjgpkhwgz;2:fh8gliuipwh5;1:cjh;1:qjd;1:djzehdjjb;5:qio;1:bit;1:0mr6h2;4:8h99jakiz;1:3hf8j79kyak7biychcghbkilphgtixuj3wh8;1:4jojjooiuwhb;1:9iqfkagj5wis;2:tik;1:qju;1:8jqcjfhikjkbwgr;2:wit;1:1k7;2:8imwj9;2:8imgip;2:4l1jheoh7phawlb;1:hhejip;1:wiu;2:kilokm;1:3it7izeiotkjuhg;5:8g49qwagvcgxdlkegcfh6gj2kgunjyok0pgxqh9rkcsh9tgcugxwgm;2:dilniosit;2:uk0;2:8gsaj2bhdfhfgh4jldkjgrflsmdwgo;3:5iraitlit;2:9hdml2nhatmxwet;2:3kochafgykkd;1:kk1lh0miurhh;2:dhdjkr;2:8gm9iwafrjhdshgup0vji;1:0kh8h09j0dikeki;1:djpegy;1:1iv3kikimoivphf;1:ej6;1:0ha4l66lngheinxjhepggqgywgw;1:oiv;4:3hgiiq;1:3h97h88lw9lialcbmqcfkegcfgxgh1hhbjg4kkxlh0nh1ohfphbqj4th8uhewg8;4:bisjgeqkmrk5whg;2:uji;1:fj9;1:hj0nitriu;1:ahcfjv;1:4j0;a:7jfbk2rh0wh8;1:4guiov;1:wiy;1:hiojghokppk1sha;1:8ki9ouak6bindh3eh3fgykhbrgjthewh3;2:jlbwgl;2:2jd3iu4hh5hb6gr7iu9gwcj0fhchitkklmgwqgzrgauh6vezwnm;1:6hhpkxwh8;1:8hf9iqnj4;1:uivvk6;2:jix;1:3hd8glcj7gj9jjzkh4rhftitujpwix;1:jh0ql8;1:ok9phd;3:8h59jbaiq;2:hgkjjdlkq;2:cik;2:3he8lj9k6aj1ehggh6jhgkijphfqhgrhftimuk9wh7;1:dinfjilh7rjywha;2:ajp;2:0hh2m93k94ha6ju7hejhcph6qj3wgf;1:bik;2:3ha9gtdknel2fjopivwgq;2:qij;1:9gqahcchdggijk3kh6lh7nhgokypotqitrkeshgwgh;2:ojb;2:1iw3hc4h85h76jm7fq9h7ah7fhbgqehfuih1jiulkxmgloikpj0qgirgqugswgu;1:jj1;1:8ik9izahdbhfchggj3hisrimshfujm;2:aixhgirjm;1:hjj;1:aipcilfh0glgqiwsjrwh8;1:0h94it6ik9h0aiobkccisdm7ekxfijhgvjgukh4lhdmhdohaph2qghrgathewgo;3:gjf;1:8h5dk6ejaij0qimwhd;2:0itok9;2:0im1jm4he8hg9j4ahebfocj0dh6eiqfl1gmcij0jgwkhflkaph7qgxrgwuh3wgv;1:0he3h77gs8k09gfbjzdh3ekphitjg6khcqh8rgrsjrtlquksvhbwgq;1:oipwir;3:0hf1hb2gr3im4gz5gy6hc8l39h3agxbo4dgreixfgohj2ihbjgxkgqlgomkfnh0ogvpgltlxuh0vjt;1:0hc1gj2jn3h24jk5h66h18gt9gpakdblfchdehdih4jgekgilkhmgcngmogbpkxqgyrjwskbtj7uhbwgx;1:8j0ajyrh5;1:4is8irril;1:5j28iw9gjiizjg6mgynkkwks;1:0oe6gu7h98itdgwekahh5jhgphaqj1uh6wh8;3:8hdsjr;1:8j69gqcj9;2:jooqh8wh4;1:3jc9j2aimbil;2:diy;1:6oc7he8h9bhefiphipjj6ph1qgzsizwgi;1:kh9pk8tik;1:bji;3:hio;2:3ha7m98j3jgdwit;1:9h7jk5rjm;1:wko;1:sj4;2:4iq;1:1hg3k88k09jlagscj7diwegmfh3jh8kgwnikog1po1rinuh8wh0;1:rittir;1:0ls7h08habgsgipjh7ohgvjqwkj;1:0k1dh0ejaiilmis;2:6is;1:fh9glkwh8;2:pit;1:0jfdhbgirjirrhg;3:2mi7h68k2aj2bgpeinjhdqhfuis;1:8il;3:wji;1:gk3jkoofbpnjqjawfo;3:8j69kwak4bijcjaghhhhejhcmfxokcqhcrh7;1:8itjj0kj3;4:8h9cizghehjgiizjjirj6tjmwh6;2:aitbhfcgzhisjkinj0;1:0js;2:pkiwgz;2:jiq;3:1lw3he7k6jg5qksrgnwh4;1:dk8eh8vh3;2:4he5kq7hh8do9l5ghgih8jganj5sjctk2uivvjbwh1;2:7jovhc;1:8glwkq;1:8g59ezah0ch8dm2eoafkcqhhwhd;1:diskj4njrohf;1:cip;2:lj2rh9;1:qkgwh8;1:3izqkk;1:dinehckh8mh4nkhoh3plyrhgwhh;1:ik5;1:1io3iy4hc6he8iqbh8iizjhflgxqiltlvuhfvj4wgz;2:bizohawjv;1:7jl;3:8kl9g2bhfgji;1:aikcj6ggm;1:afzsjquky;1:9iorio;1:jil;1:3il;3:pk5wjn;1:ail;1:kjjwhd;4:7j9dh4uj2;3:1hfakigiyiiwrgl;1:fhbull;3:8ke9h4khdrjo;3:9j0akydilhj3kj2rgqthg;1:4j7dgoejmoiz;2:uir;3:vit;2:dj5egvjgwqjl;1:8iuehdrikuj2;1:hezjlg;1:uj8;3:wio;1:oin;1:1j23iv4ha8imdhejh1lj3njyshbwge;1:0jseiu;3:diyehffingix;1:9io;2:8iv9hgbik;1:2il;3:hhgqj8;2:lj6;1:9hfrmfuhe;1:fik;2:his;2:2kchh8iimjh7;1:pl7whd;2:8isuj2;1:9jwagvejlfjxggnjhakk9phdqk4uipwh2;1:ljb;1:qjd;1:fhfujl;1:biyoin;1:cj6;5:8jzdhejjh;1:tituj0;3:8jxeje;1:kiv;2:0gw1g92hg3kp4gs5h16mc7g1agmbh0cimdizegbhghihcjeykh9lh5mglniyolpqkxrfrsh1tl1vk0wis;1:wj4;2:1j02ir4it6hf7k69h8citfhgml5phfqhgrgcwgq;1:0h91gv3k05he7hb8gu9gjbilciudh7eh3fhagfahnrihfjj8kjdmhanheoh7pixqjgrk4sgztimugcwjq;2:bjpch0;2:cjxrh2;2:2is8iohheiivqh6;2:giq;1:8kmailbiuch9giqjh1kheohhpkfrfetl1uhdvinwhg;1:1jqdizrgx;2:pkjwhg;4:rjowhc;1:him;1:bivgimhgyjhcpk8rgetls;1:dintil;1:silvil;2:9ix;1:3k64li5jv8heagxbgshiujgklj8qh8riruj9wh5;1:jkb;1:6kh;2:6jqvgn;1:0itjiwoj7wh4;3:airniurinsiw;1:6g88j0akadgtgjohn1jh2rgvsgzuh7vj3;1:oik;1:bjfnjaoimqil;2:0h71h12gt3gw5h86ix7l28f69ljbjlcj1dk8egufgkgh0jixkh6lglmgwnisoh3qjkrkbtgpugavhd;1:mjorhc;1:gk2;1:ejk;1:1jfbj2whc;1:gh6qkpwhc;2:jipuj5;2:ajchikrh4;2:kiz;3:4kq6l57hd8je9hdah6hh9jkhomvpfxqhcsgfuhgwgt;1:3o2agcclbdjffggghbhj3jgnqhbrj7vhgwg9;1:4hgjh5kj3oippkcqh3;1:qim;1:6h68hejjznj6ok1pjzqhb;2:kj1;1:1hf8ltagugj3jjnrh4;1:lil;1:dharjkthgujs;1:cjr;1:nim;2:unjwgb;1:kiw;1:6hb7ir8gobirdnbegdfiljl4khelhdohepl6qh4wg6;6:wl6;3:eiuhjgrgwwj0;1:6jtmivphcrjc;5:hix;1:ejsjh6wjq;1:5j6;1:gjo;1:6ma8hdfiojh5kgzllknhephcqhhwir;1:1jroj1phe;2:pis;2:8k1dhejjl;3:2gbojx;3:4iu7k6wh4;5:cgujiqqiq;1:jhdvkc;1:0gt1gn2j65jt6gl7gy8gd9jqbgmdh7egqfj3ihdjj2kiomh4ojupimsjhtgzuio;1:7fi8jcbhbjhgmj0onhphdqiqrhdwj4;1:tim;3:8j99h6sjnuhb;1:ah9uj0;2:ejdgjtuh5;2:ml0ng9;2:1in3hf4h78kg9j4ajpcjcdgtej3fipgh4ij3jhdkj6lk1nh7ph8qh3rh4sgltgzvhcwgr;1:dioehfqji;2:9jzjh5olxpgzwh9;3:cir;1:2iz;1:ahbjhalgznjbqj3rjbsjkvjk;2:5kk8hgcgwghfhjfijarjm;2:7k3;3:dh8ejsjhgkkkph7skf;1:4it8gw9jyoh7pikqk3whd;1:8hakjlungwgb;1:1il;1:6jw8ithjdwh1;1:8h9cjelh8nh9rgitk6uirwkv;2:sjp;1:gj9ignsiz;2:ejk;3:aik;1:8g19l8jiwniz;1:3h38kv9j5dgfeoffgwggkhjojh5uhhwhg;2:tisuhd;1:8iltis;1:ajibh6fizkjcwhb;1:dimhkajh5linrj5;1:6h8ijiukevh4wj2;1:8j19iycgupl7wgw;1:piu;1:pjg;1:7hghirjixpm1wg2;1:sil;1:6iwvhc;1:4it8ixdivwj6;2:4jssh7uiy;1:3hf4kyaireirfgrggeiggjipkjemh8ohfph2qhdrj2siluimwlq;1:7inhh8pizqja;1:8gg9k3;1:qn4wgo;1:5j1hirjhdwj2;2:djj;2:4j6gilrl3;1:ajggit;1:7ir8lg9gibhhcjbdgvekkggxqh8rjdtkdwh2;1:8k9ah3dhhfhhgjfrj4th0ujl;2:hj9rh3;6:4iscfwtko;1:7iythh;1:wlf;1:3ha7jmij2jgqpjcqk1wh8;2:6ftfj4jimvke;1:3hb7hadheeh2fhfgixhhgjs0ohdpjdqgx;1:dggejygje;1:7ir9ipeizjh8rgxukd;1:fhgujj;2:8j59grcj9;1:3jm8gzajkiivjh6oh9rjuwjs;4:ql5wh1;4:hj0jk5ljynh0;1:hgzniork0;2:uj4;1:dgnejlmiu;1:jh7qje;1:8gg9jhhjt;2:0h81ky2ub3im4l25hc6h77l98hcah6bhach3dh3ehefhdgh8hh9ihhjgcmhfpglqg7rg7thcuh9vivwfs;1:2gv7jraik;1:8g69lbak0ehhjhgpl9rkdsgvugd;1:0j78j7afcdjifgzginpixsku;2:hj8;1:8j69hhjiwkiw;1:7hf8h8bjfginhggjkyqkb;1:gka;1:1h63hf8g79h8ahdblrciseheggzjgkkgblhbmhenmhph9rlwtjiugxvizwgw;2:hik;2:0io3go4jb5iy6go7gk8js9j5ailbgzdgxfgvhgtjh7miyniqojepixqjjrhetimuj4wg3;1:vja;3:pkb;1:0h93hg8h49h0cjsdh7fivglnhjojj9pgvqjargythduh9wix;1:cisfhd;2:gj1mkluimwhd;1:hhfjhftkm;1:jlh;1:ejl;1:8h59j3bipok6;1:8jh;1:0je1hg3io6hc7ko8is9ioagudh1ehgfh7ggyjheljbohfph8qh3ujpwk2;1:1h53h34h45hf6gq7h38mk9maakcefefg9jflkjaliqmh7ngzoinpgxqk7rgttkmvjhwfk;1:wit;1:9h8aixdiweji;1:7ltdixjhdwh6;2:0hb1gz3ir4h75iw7j28h4bgvcjwehhfj2gfxhh0ihajgjlh7miynl6pl2qixrk7th3uhevhhwet;1:rjksj3;1:6iljj4;1:9hgjj4qk4wh4;1:uiv;2:rjt;1:uhavjc;1:8l9ej0gjtihejh3qhdrhb;1:ejvrj1;1:mjb;3:wj1;5:5je8hh9k4akifgfgg5jgpqj4sjg;1:gimhippim;3:9h2dh8ejfjk7;2:8k1bgy;1:8j0;1:4jn8iy9j5ahfbh5cohehefh0ghcliuoilrglwgw;1:6iyhisjhf;1:din;1:9iy;1:jjm;2:qki;1:hgvqjjrj2;1:3hg4hg6iz8gw9hgah6bikcj3dj8egyfhehisihdjgwlgyoj5ph2qh3rm5tl1uj8vh9;1:1ilfjqhjb;1:9iu;3:hirwjr;3:vj5;1:jgpohdql3;1:bjccin;1:jjj;5:rijwji;2:7ik8hc;1:fik;1:7j1;1:1hecjohgapk1rj6whe;1:gkg;1:1hf8h19k5biskj9lhbrkgwix;1:5h76iz7he9h3ajudgsfjrgguhh9ihfkjumjpok5pg0rgasiztghvh8wke;2:6gxqlpwhb;1:aj0klk;1:1he8jp9h5ajdbhdch7eh9fipgimkikohfrj8;3:fkh;1:0l41g4nir;1:8h59jgois;2:9h8dotegsfirhh2vjl;2:3imeh8fixuil;1:jj3;4:rj9wis;2:hipilhjhbwgi;2:1g58h6bj2kl0tj6wha;1:4il8jz9h0ag8eisfkcgh4jiorh9uitwja;2:kjo;1:cjxrh2;1:8h0gkv;1:phaqlewhd;1:jiv;1:ij2;3:him;1:kj8;2:wjn;1:ij5;2:2kl3hg9h0ak2ehcfk0;2:gik;1:sin;3:5gw7ge8gy9fnajmdgiekyhhejk2km2mh9nh3oilpixqh0rjhsgqugkwm0;2:1ik3j26hg7il8h2cjpjooohaph6qghrh1uj8;1:0jb1im2he3ip5lzah0fh1hk8jfikh3lhdogwpgoqjsrgitkduh2vh5wgm;1:7jd;3:bjweiylilwhf;1:jimqhctk1whb;4:lix;1:9jwcgznjdqin;1:bix;1:aipdjbeh9jj6tis;2:1kaik5kgp;3:miv;1:1l1ggwjk5rh5;7:5l4;1:bjfdhheis;2:3gw4he6hb7j18gwamnfglgj2hjujjhkhamhanhcoh8phcqj5sjeth9uirwft;2:1gh3h84gp6hd7gy9gzaitbh3cgidg5firggxhmmjlvkh2lj4mh5nh3oh8phdrh2ukiviwwjs;2:4ithj5rhd;1:dil;1:8jswjj;1:4jc6hb9jrbh8cn8ehafgzghehh3jhepjatixuhh;1:jit;2:il1whb;1:njsuiz;1:njwrin;1:tj5;1:5mijhdwhc;1:8jfjikmjaogrrh8vjq;1:6nd8ec9mnah9cisdh9egx;2:1jc2hg3h74hb6gq7lm8he9gjbh8clddhffhdgh9jjlkgqlk2ngzontqgutgvuh8wfe;3:cjlqikwiz;2:ciqfhdsil;2:wj9;1:gio;1:5inwiq;2:ah2bjjciuffpgh8hh3qgxrmuwkz;1:dh9ej1nin;2:7kp8ik9indiwliowh9;2:5jtkhhljkrhbwhe;2:ajs;2:8hd9hfdlregwuiv;1:7jk8j6;1:jjhqj9;2:2ha3ju5hg7k3dj3jherizwh5;2:lin;1:diowim;1:ij5;1:7lf8gwjjeqhcrkgsj2wh3;1:8j99h7bhekh6mkp;1:6jp8hd9jadfaekpphc;1:7hfjh9qkc;1:2gy5is8o39jnalcbh0chbdhaehffgtghfjh4khgrgysirvjtwgs;1:3jl6j78hghiq;1:nkm;1:fip;3:fip;1:6iw;1:ij4;2:bk9jgvvjowjb;1:ak9sgn;2:jj2oj6;1:8h4bhfpjlrkv;1:0ik3hdcitwlc;1:7h0ditwj9;1:9j2bir;2:3jjlizriq;2:oko;1:citwje;1:gj8khfmj4;1:dj4;2:rio;2:dj8;2:6jgagkbh5ekhflegj4lhfrhathhugywk6;1:8ja;1:bhgriz;1:6im8j8siuthgwiv;1:8ilaisjgapkd;2:6g5vgywne;3:7iskil;2:8jq9kfbg8ek0jinrilwhc;2:5jc6kt7hcjhfkjslgypheqlhsj1ug4wgk;1:8hd9ineghhjojghsjz;1:qj5;3:1he7j79h4biqehggh6nh1phhqjzwm2;1:qj5;2:bj4;5:9gugkhjh1rkt;1:iipril;1:jjc;1:bjiriv;1:1hc3h64hg8hfajoehefmpggdiirkgylhfnk0oiqpnkqh1rhauh2wg3;3:0k0;3:wiw;1:oinrj0;1:ej1;3:1lj;2:mjl;2:ujh;1:2ixwj5;1:dkcuh7;3:4jdljouimwhf;1:jl8wir;2:fil;1:dggek0jje;2:7j8khclh9ok7piruj5;1:4it;3:kit;1:cjdgio;1:3gu6knjh0kjspjkqh9thbuj6vk5wh2;3:6ixwjj;1:1hf8h29h7ag5bgkcgpdk2en8fipgk7hjejj4lhbqh8rkksjcughwgs;1:fj4oiz;2:iiv;1:bj7;3:6hacipqitvlawha;2:sip;1:8itbh8cjd;2:8j7ejw;1:1h13gj5kc7j49hebl1dgufiqgj7hhblh1mjfogyqgvrgzslnwh5;1:8jc9h8kj0;4:4im;2:fik;2:7jcjha;1:uj2;1:8j5dj5egn;1:9ikgikjh4njrsj2;2:jhewkw;1:6kgqjwwgr;2:jin;2:1h62kn3he5jn6ja7g69hgbjqgiujhbph6qm4wg4;1:bhgriy;1:1he5k17ip8hdagrbiydgvgh7jopoh9pimqikth3uhfwge;1:4ip;1:4hg8is9jjah9fhajj4om8wio;4:gj9ihf;1:eh8hivkh7mmk;1:dil;1:jit;1:8ioejpgirqj0uiwwhb;2:bk4;1:1md3he4hh7hfbgwcixgh7hhejh3kl3nj8oixqh7rgtthf;1:0mo3j04hb6h37gv9guakdbh9fj3gl5il2kh4lh3ogqpgnrghthfuh6vhcwgh;1:gk9;2:hik;1:ahdhjhiizjjlrj8tjowh6;1:jilrip;1:1ge2h53hd4lc6h57io8hc9h5bhagiqjhbkhflh7mhenisoiypjo;2:8go9jahitjjs;2:2j7;1:8kl;1:dheejc;1:ugjvko;2:5j6;1:5j78ir9hc;1:qir;1:fiu;1:hh0jj0;2:2kq3k74kx9ikjh2ohfqgzwh2;2:aisbhelkjmj9wh8;1:2gzpk0uj6vjy;2:ris;1:4iv;3:vik;1:2j9;2:1h72hh3h14hg5hb6h17hd8j69l7aj6bj1cgodkselbfjxgghjh0kiulh8mh4nhbrh1shbth5uipwg6;3:ahbdgifk7jj1kjhwhd;1:7jq;3:oip;1:aj0ciqpjb;1:jiv;1:1im6kidjyehcfjgjgqmjfrj7uhe;1:tjk;1:1gp3lm4jg5hc6kb7gg9jzaf6bh8cixdgdejdfgrgj2hgdihdjj1kg5lh7mgxnkvpgbqitrg6sisthguivvjxwgz;3:3gq7jd8gz9incheeh7fghhlnjfpkheok2ph9rgqsjsul3vit;1:aj9;1:5h17klrm4whg;1:8jl9k2ak2bkqcjeegyfghjhbkj5nheqilrh5thewh9;2:ok6pio;1:pik;1:2hc4h15gr6gp7gf9iwagmbglcgweftfgahlhjjpkg2lgymlrnjhpfvqgtrggsh4uo0vl0wjj;1:8hgbkk;1:0hg1hg2hc3h54hd5h96gx7ha9hdakxbjwcjidhdeinfg2ghchnlihgjj7kgjlhcmhaogspinrg5tjhuiovjswfs;1:uja;1:1in7jd;1:8jk9gl;3:3it;2:3kkbh4;2:6jf8hfrjc;1:ciz;1:4j58jj9heah7cj2ehafh8ggchkmjknpkeqgorjwuhfwgx;2:ahafkzhj7jhdkgxlhcnksrhbuj0;1:6gg9hcsgvvl5wl2;1:bhfgjfhiwil1miruha;1:gjj;8:5jp;1:3ik;1:1kqkhd;1:pjw;3:1j05lj8h5gk8jh9ljgphcwgv;2:9ilghesin;1:0ko8jj9h4;1:8j19hfmk2;1:citpkkqhhwkh;1:7jlrit;2:0he1ha3jj6hh7hg8iuaj0bjociydgufgighbhgwjhfkh3lhgmikngxogeqkzrlhtj9vhewh7;1:fjr;1:ginwiu;2:qjc;2:2jc3iq8k7aj0ghdij0jimkhgljkphcqh0uh6wfz;1:jin;1:fjn;3:0jz1iw2h83kl4m57eu9hhcgtgh9ijwjgckgzlh9oiypgvqhdrl0sguthguh9vhgwjj;1:0j51h22hc3hb4h15h56h57gd8mg9ksag4bgpdf2elqfgvgglhgwjh2kjtlgymoonkgog5phgqg4rfeshftjdvgkwl0;1:chhgijrh8sj1wl7;1:8iw;1:5izkjophg;2:8gxjmtphfqgyrkpthfwhe;1:aiouipvkf;1:tim;1:1ip2iq7indhefijjgvrhcsizuiqvj9;1:4jrhiujj1nisph9;1:0j21gz3nr4h1;1:0hh1gr6jj7he8k29h4ahdbhgegxglthgkjgnkh8mh2oivph1ql3rivwkt;1:khgml2oh8;3:8ke9iyejbghfjispisqhfrhgsknth1wh1;1:0ko8j0bh5jhdmjloj2qhdwh5;1:wjn;3:3gz8ko9eubkvchgek7ggwjh6kgvlk5mimnhhohgpheqh4rhaujrviuwhf;1:2gl3nb6h5jgkpmfqhbugnvm6wfz;1:aiqjhakiqwl4;3:gjp;1:7ixgirjgmwky;1:5he7k7bjhdikjjwnj8rhasixwgw;2:4im9jqgkhlh5rk3whe;1:1h69heah8bl9dh1ehffk7giqjhdkgzlgtng8ohdpgxqhfrlcslvtj8uh3;1:8imbixejvoh7;2:qij;1:1ipkj6;1:9j8;1:4il8gu9jxclafh8;1:4ixpiu;1:1ko3hf4hg5gz6h17gm8h99fzak4bjycjndgiegpfk7ginhjajgmkkilgymk8ohephaqgjrjytgvwhg;2:3im;1:4jslk4whg;1:glshilwhc;1:oinph9qja;1:9kf;1:5k8cgwghfhjfqkbrjpwh1;1:3jdaixbhgfiruj2wiq;1:8hg9hadivek4fj7rj7uhg;1:nim;1:7l6liyvhc;2:hh9qjq;1:3ix8gv9jvchefjegjduhfwhh;1:6hg8gwbgshhhijdmhfnj3rhbunqvkjwh5;1:riluiu;2:4j2fj1rivsip;1:gjm;1:uj5;2:oghpjy;1:biqcj9;1:7h8jl0;1:9iy;1:6h4vgkwk9;1:kik;2:aj2bhffjrgk0hisjgokikmixphdrhf;1:6hedipvjr;2:9gval5bg1eh9qka;1:7je9irfiqjjjqglthbuik;1:0it3ha4hb5he7hb9ipbilck2dh6gh6hh8ih7jkrkhgljvmhfoj5pgwqgxrjmsiluh8wit;1:1ip;2:7mdah2sizwhb;1:8jqjgf;2:fj3;2:0jp4hg8kb9m9aipegjggvijqqhbrhgsh4wh2;2:rj9;1:ahafjp;1:8jd9h7ch5lhdnl1ujw;1:8nm9fcgh4hhfogtwki;3:pkk;1:8gv9j9oil;1:dheejpfhb;1:piw;1:8jfcjddizefpfj5ghbjj3;2:oiz;1:8j0;3:3lr7nq8j6ghbjgfph4qgyuhcwhb;1:3ipoiy;2:giy;1:1h48hdbk6gj9rkhwhb;3:1hf4h0bjfciyojcrh5wmi;2:3hd7hc8gz9h9aiqcj9disgkqhikjisqh4rh5th9uiuwkc;5:2kijiywgz;2:8hebkqcjjdjxehdghglk1ojvqhdrgrwh4;2:2j63haoj7;5:8iogku;1:cilgip;3:0gu1jprk1;2:1hf8h9kjumji;1:0hb1ha2hc3h84gw5h98e49jwak1bh2ckpegnfgfghfjkskjdlinninpgbqkerlaufovh6wip;1:1hb6h57jkiilritwhc;1:lhfpjjwji;2:8jz9h5oirpio;1:ej6;1:cis;1:vip;1:mjr;1:ah6ujo;1:6jl;1:aiygjbiim;5:jm1wh2;5:6lhqhdshavgxwjl;3:8gztjj;2:jhgsj8;2:qldwh1;1:2it3he8lskgnth8uj0wjp;1:1hc8f59khajybh3eilfh7jimnh6oh0pkhtjuwhf;1:8hajkxoh9pjgqhgwks;1:2l8;4:8j2mji;1:gikil2whh;1:hh7jj4;1:gix;1:2kv5im;1:qin;2:pja;1:bjkcjo;1:ah9kjmsj7;2:0k04k49j6diojimohdwh6;1:tjo;2:jjk;2:5kqrh4;1:jjb;1:8iknjnwhd;3:1kj6gvcgtghfjj7phfqldrkzthewgw;6:rhhwji;2:hitrj5;1:qn9shgwh4;1:1jf2gr3hggiswkf;2:4h3ijg;1:rin;1:5lc;1:3jd8kfehawh3;1:pit;1:6hdcgweitjimnhgrhdtj1ukkvkxwim;2:8j5;3:1h23jqnjg;2:vil;2:4ja8h79jvoikrjrwhc;1:uil;1:aimjiq;1:2ke;2:gj5;1:six;1:rinsip;2:7h1wja;1:3iucj9jikwhe;1:0hd5in7l18h49hcahccjfgj7jhdlinrgysjgwja;1:3ipdjq;1:0il;3:8iz;1:5j3cil;5:1h89h0ah9fh6gg4hrrjkylheqiwrhcwgq;1:gim;3:8je;1:5ixeivuhg;1:hhdjio;1:3jokiquhfwip;1:ijhljruiy;2:jir;2:4io7m0whc;1:ninrik;1:pk7;1:9ilkij;1:cgumjdrjftir;3:8mn9heah5bhhjhdqk6rizsh5uh4;1:2ik;1:viywk7;1:bhfkhalm6;1:4ik8js9hbah8oje;3:aj5fjthj2jh0kiqmj0;1:hjfjhdogyql0rgx;2:9jykin;4:8h6ah9chggh3hhbkhelkonknojkrlbwgx;1:9iwaj7ghf;1:7jkrh5;1:sjc;1:ej5;2:pjm;3:1iq;2:giw;2:8hb9k2eh8hjwrg4;1:3hb7fu9iwwml;2:iik;2:olkphg;2:rin;1:ijf;1:1hd2hc4jw7kb8hgaijgikjg8khbmhenhdok5phbqiprgyuhbwm7;3:cj9;1:7il;2:kixtk5uh4wiu;1:9iljhd;3:0he1kw2hb3gq4h35h36he7h08gv9g4aknbjdciydgqegvfkagiqhjmjg1kkqljcmk4nh3ogxqgdrl3shftgwugyvh4;1:2iurintip;3:1hb2jtajfgguhj0rjb;2:6j49iodgzejwjjbwh8;1:ff4ghfpleumf;1:9j0ehhjj0;2:8iq;1:mij;2:8h99k3ahfejzgiskheqheriluitvixwgv;5:0jj2iz6h57h88ha9hbbj3diygg6hh5jmiljfnhgogupgyqlurgtthgvil;2:9ggel5fjs;1:ajqciqflhhj2ojrph9qhgwhg;2:ajd;3:cipujo;2:qiy;2:9jh;5:0fw1h86hf7hd8jjal1ciudiwegxfjggh4hhgijgjiskgymhcnhaol7pkfqgrrh4shfuhc;1:8kf9hgjhe;1:nj3whd;1:dheej8;2:rjb;1:dimuip;1:0km;1:2gz8ioajvfh1ghhhhepjvujbvjr;1:7is;1:dil;1:7kkgh6jhgqknvgqwh9;1:1gv2ki3jd4ip5ha6hg7j58gudh6fjkggxhiyjh5khdlh2mk6nhboh9phbqhcsgsthculxvh0wgp;2:1hf2lz3nz4h86jr7h7gj2jh8ph7qh7rgwvhewgq;1:bimwis;2:0ja6ir7iwbitgk1qhgwh8;2:4imdixjh4uje;2:3jm8hegmehh5jhepjqqj3rhdwgj;2:cj2;2:3kscj4;1:gj0;1:1j77hc8j0dhdgjtjlamhgrgfsjrvhgwgy;1:6h6mhgoinqkb;1:ij6vkcwhf;1:1hh2jz3h34iz5hh6ha7jc8f89gralvbmrcgpehbfedgiuihdjfpkh2linnhaohapgkrjeshbtjvuj5vj6wjr;1:3ir;2:jjjrh4;1:8hdgk1vip;1:1gn3jkahffj7jiwmnbrftwjz;5:8jzbgzhh7rj6wiy;4:3jnjg8plnwjk;1:8jhak5bh9fh9lh0tjx;1:4jp6jd8h5onhpgqwgy;2:9ik;6:hj2;1:8gtbh8cjpehagitjk1nherkjtliwg2;3:1gs2h83gn4j35ip6gx8dr9l1ahcbgjdglggghh5kkclhamjpnl9om5pgnqg3rh1skzthcukowh3;2:5ik8ip;2:5k2hh1kkapil;2:8iqbh8ciqgimrhbuk2;1:kim;1:4ha8ivaixbjfchddikeiwfjcgglhhhkkgqilwhg;1:5k6;1:bjcjhgwja;2:aio;1:ogipjrqjd;1:2jw;1:cj0;2:tiv;4:1ilfivkjvpix;2:fir;1:1j18ipejw;1:8h89j0ag8bjuuk0vhbwhd;1:njfphaqkvwh7;1:bikgir;1:0ki1jo2l33h65kl6h97gfaivchgfh9gh0jgbkh6ogyph8rinth8uk6vjkwge;3:kl6;1:oiwtjlwik;2:rj2;1:uj9;1:6gr8hd9kmchgrhgtj2vlb;2:3gj4gy5kw6gk7gl8o5bh6cgwfhbgg2hf2jlgkgplhgmh8pgcqnzrhgtm0uk2vg7wfq;1:7h9dinehcjl0;2:iinsio;1:0jj;1:1iv3h26jb8gm9hgfingl5kjllilpgwqh6vit;1:5jphh9tiu;2:hivtis;1:6q8dhaegxmitwfg;2:1gn3hh7hf8gn9jabj4diweh2jh8rk7sj3wk1;2:wj1;2:tjjuhb;1:3hd6k37hcakzciyfgfgkfhkrjgqlhgmitoh5phaqixrgishauh1wiq;4:jir;1:7jdditvjd;2:akffh5kjg;1:qk7whh;3:0ir1ko6hg7jy8h59h1aksfgoghchkrjilph9qh6wgm;1:sikuj6;3:mjbohaqj3;1:9iutiu;1:8j3;3:ajmch4jjgsgu;1:ijd;1:ehgfgrgnahgzjgzqm8tgw;1:akncisjhdwhg;1:5ik8irwit;3:0ik;1:4k26hgbhgjhbojgpk1qgxwj2;1:8j8aivfhagjb;1:8iwbhbgjyjj9lkysg6wgy;1:8gttjj;1:2gcailhjgojvrgw;1:oiz;1:0h91jv3gt7jh8jo9lwagsbh3cj7dhdegcfh5hhakhbmhdph8qgtriysiktj2ugtwje;1:1hgcipeizfhcoky;1:0jb1l02j13jk5h86h37grahgbk7ch1fgwjj2kfmlgxmg1ngmok7ph9qhcrk2uixvizwgb;1:5jr;1:1gzbj4gjyrh5;2:6lcginwha;1:pji;1:4mvjhgkfvnleohdph9qh7rhdtljwgj;1:kh4njwpiv;1:6kg8jn9haehchj1whg;2:qim;1:8jt9ilajijiskgcphgrhbukvvj1wj6;1:iilris;1:riv;6:hkprgvwjf;2:5jj9imjh9vjc;1:5k67ks;1:0gy1ik2he3h74ha5he6k37kh8hf9h2chfehdfh6gl4hjwjjrkgzlhfmh0nhfohbrl2shdvipwe9;1:6h7viv;2:2he4it8hf9jvola;2:gir;1:ij7khblh8nkmpm4;1:8ik;1:hhdqj7;2:jhdmk5pjwqiw;1:dh8ej2jkxpiyrh5;2:lh9rj9;2:gkfnipwhh;3:9j5;1:fh1pjkuh0vkp;1:9imjhe;1:giq;1:1hd2kc3he4gy6jp7km9g9agmbl7ckpdh3eh0fj3ggwjg4kgmlh4mh6ojcpixuisvh3wg2;2:bhfrju;1:ajmbk1fhdwhc;1:3ha4he5iy8gkah6chbegyijujg0khblhdnhdolaqgwrk6sintn0vh9wh4;1:4it;1:amjfgnjinkis;1:bhgqkdriwuiw;1:eimhh0rk3;1:ahgeiyrhesiw;1:rje;1:bj2;1:3lbthd;1:1hawjv;1:7h29jzalybivehdfgaggmhh4jjfkhephfqharj2sjuthbukqwgz;2:3jvbixch7gijjk0riw;1:4l78gq9jpbjrljyqh0rgowh8;1:ij6;2:7iv;1:8h2bj6jke;1:8jd9jrfio;1:4hhcilpjgujq;1:eijnj6;1:ajgdiweiphipwhc;2:0m21iz3kg4h97hdbheghchheihajh9kh0qgiwmg;1:6j48iodivnikpimwh5;1:1h73k4mk4rit;1:uggvks;3:cilfhfghghl3jjjwh8;1:8hbdgzelyhhbrmawhd;1:0ix8m1ah9ehdfh5gkojh8qheriztimuj6wh1;1:bik;4:6ncbizdjsegijh3pk7wgt;1:njy;2:jivpkqwhf;1:fjr;1:fjb;1:3ijhl8lk7nhfphfrj2wh7;2:sjnuhc;2:9hgbj0jgdkhglkgnimsj3wky;5:8hdeitlimoiy;2:7goejaglyhh3jhawio;1:6jr8gstjiwhe;1:riv;2:3j2aipciphim;1:dit;1:0h41le2ga3gk4gs5h66gt7gw8j59geah7bfoch1dh2ggnhgwihgjgmko2ljbmlrnl9oj1pitqgprgcskhuj1viywfo;1:wjq;5:1h39h4ahcciydjfehgjl8khhmj2pizuk8wgw;1:oin;1:0gz1gz2h54h16gn7h58jg9gcak2bj6clkdh4egwfgdhg8ih4kh2mjbogxpj2qh3rgqsgutm6ugbvjowlk;3:kj9mk9oj1ph5wh6;3:8gmdh8em2jjarhd;1:cil;1:1gy8jkcg0rkywjh;3:piy;2:4izagwbjd;1:oin;1:1jm7hdaimdhgejbfj0gh6lj7qhfwje;1:bip;1:8h9tk7;1:8hf9itriq;5:8je9hgdheekq;1:rjx;1:5k3jhalimrjq;1:giqiiqwjn;3:8it9iosj4;2:6hg7he8ikhhbjiwmkqpikqhcrkrwjv;2:1il;1:jikwj5;1:8ixgjrkilpivrh9;4:9hfch3dhfghehp9rgywhh;2:cj9fhfjiusin;1:cipoiluiy;2:ghahj0jk5rk7;1:cj0;1:7ivcjbpivwiv;1:2k55iydgxhlajgzqikrjawiw;1:8gm9goaj5bh2cjqeh3fkaggxhh5kitojdphcrh0tntuh7wgr;1:oiz;6:8ivqiouke;1:2j7iik;1:jis;2:8hc9itghchjyrkvwju;1:bhcdh4elvhj4;1:njh;1:qio;1:rjdtjr;1:8fi9l3bgvckcemggiqhhejhaljlnjhqhergntgswgh;1:0h91h02hc3h64h96h48gv9hfagnbhcdjgfqcgjjijgjgfkgylh9mh4ngwohcpgyqj6rgish9ujlvjewjz;1:8it;1:jkzrgz;2:cj9qilwiz;1:ojf;1:9k2ahc;4:bix;1:eiw;2:6hd7hgfgcgjehgzjn5pharl7ughvjrwfp;1:5j67ix9j3aindhefh4gisjgwrjxsiv;1:sis;1:2l4bj8ghfrlowhf;2:eivjioqkqwgx;2:jix;1:sjq;2:jfyqjswke;1:wjh;2:ehdpkywh7;1:uj4;1:2gu7j8;1:2ix;1:0gu2hb3gt4h55hd6ju7k28h49ilaj5ch9egtfgzgjbhjfjikkgpmgunhcogzpilqjzrksthfuixwfu;2:bj2cghpj6rji;1:uiq;1:kiw;4:cjd;2:bhgfj8ghfjip;1:3iyjhaoinqiorjrwhg;1:7iqajs;4:cikpimrke;1:jk8;2:0ivuj9;1:rjx;1:njh;1:0h72ns3n64k46iw7h0ah8fh5ghejgxlhhnhhpglqgfrhfuhevh8wj5;1:ajhfjh;2:0ff3nk4gz7hf9gyahfbh9ghairvjgomheokiphhqh8sipthguh4wg8;1:jkc;1:jjg;1:6h28gu9h6aivchhfhhgimqh8rinshethbumevls;2:biw;3:8iq9iocioehffitkgonl3;2:rhbwj3;1:rjd;4:1h92he4jv7hd8gbahfchgjgvmh9nheol8phcqj5rh4tjouipwmw;1:6gi8kjchgdipegughgujvvjg;1:1jfrhc;2:3hb8j0bjjcjgdhcfitghchgljh8kivmiwngwogwphfqlmrixwha;1:1jl;2:0lf4g16hg7h79h4ah5bk3ch1gh5iizjhakkfoiophaqhgrgxshaujjwjn;2:0h91hf2hg3h04he5h96gh8he9imagycizdj6efhgg8hmnjinkh4lgymhgngzohdpj8qglrmnsh7tgjunlvklwgl;1:3gw4gz5h86hf7h38is9kwaisbisdj3hh6ihejipkjemh5pgnqhfrg6uj7viu;5:6j5gj7uirvh7;1:6hd8hfditegzflpgjajgvphbqhbujovipwky;2:jgzwlp;1:fjeuikvjf;1:9jd;1:2im3iv6j97he8km9ezak4bhgcfodhbek6fgqhj0rjqtkougkwgv;1:sj1;1:5hf6ha7hc8js9kmaiybh5ehdgjzhgijkdkg9ohbph7qglshbukt;1:6iwiir;1:0gz1hf2hh4h96hb7h38ks9l6akcbhdchcekzfh1gh4hixjggkgrmhdph0tgzuj2vj0;1:pkqsip;1:0j3;1:kjevj1;1:0he1hf3h64ha6hb7gt8j99goainbkpcjjehefhchgojgukjvlmeogepgzqltrjlthauhcwh2;2:ljfwiu;2:jil;1:1hd3h24he7h48mz9mpaksbikdhceg4gh2hgxjfmkjclgzmhanj9oh4ph4qirrh6tl8ugwwgp;2:3ikej3;1:liv;2:4heijj;2:8ipfit;3:kiy;1:0h0ahgfketiu;1:9imchgdineiqjk4khcpimrgvvik;2:uil;2:wkr;2:8j5;1:3kibh1riv;1:8h09jf;1:qjm;1:6iyvhc;1:pis;1:8he9j0;1:4it5he6jw7gz8hc9h0bj4cgodh9ej6ggjhjajgmmj4nhgohfph8qnyrgmtjzvh9wij;1:7j5;1:jj1qjd;1:2k47j1hiuninohgwhb;1:2kh6hbbh9ehdfh6jhgohfrhcuisvmawk0;2:wkb;1:diuhj3;1:0h81ha6gp8kx9nuaijbh0citdh7efyfh1hj3jfpkh3mhaph1qgtrkmtj1ugvvj8wil;3:cjojh7qjtrhcsjv;1:eil;2:0im1g16hgjhdkhflmhrgywn2;1:2jg6hf7heql0wh0;1:dhaeiz;2:bh1kjpnil;2:0it1jh3gx6h97l49jtbh5dgpeisghahgukj7lhgmhdnikoh3ph2qojrgutgyuhawgc;2:8g39irajbkmrlfbpiorhf;1:9inbiuoilrk2;1:jj6;1:aixfjbhiorh3;1:6iohgstjt;1:qj9;2:0h51hb3io4hb5hb7gn8g4ajybindiweg7gjvhkzihcjf8kh9mjjnhgphaqisrl2sh9tgqvhewj0;1:gh7iivrla;5:fhggopihdjgo;1:8jd9hd;2:ahhbiv;1:oiy;4:jh7mjn;1:9imchgdineiqijcjk1rguvij;3:8jf9hdah7um9vgu;1:8ij9hgbhachfdhffguggzho4jl4qjtth4wgv;2:cj6litrhf;1:8ixdgqej5rip;1:3j69iwdisek8hj5ugw;3:5j3fjsrh6tjq;2:pk4rikskmwhd;1:5ikkk0lh0;2:3kp9heeh6fiktiw;1:8he9j0;1:6la7hdjhauh5vjo;2:0j38hc9ip;1:wjs;3:1hg2h94naak7bhefgjghgjj9khgol3ph7rhawgv;3:1hg5hh7h58iz9h7ak1dhffjtghfjh8khemmnnknoh1pgqqjarh7simth9wg6;2:2ha3hg4hd5h37gp8je9j2ciniglkipljvmh3ogwpgcrizsjetiw;2:3kh9hg;2:4mncjyjh8mh9ogpqj5whg;1:jjxwgr;1:kiy;3:jilpizwiq;1:pjh;1:8geahejktnj2rh1sjvtj2;2:bjgkhe;1:1h0iln;2:6gkdj2eh4uk1vji;1:8hdgg9hkvjjz;1:1hfujrwio;1:wiw;3:1hbgq1jh4qjurgfwh3;1:hj1jip;1:mkh;2:wj2;2:gj5ok7;2:3iqmjrwgy;7:0j51g63mj4gr7hf9hcbgocjyfingh8hizik8jgqnhhqh2tjcuh3wj4;1:5in8j39hc;1:8j29h8;1:aiu;2:9ip;3:0hf1j8ijhwhe;1:tj7;1:ljtrgu;1:aik;1:9j4bj6ch0tk5wh7;1:4jj8g09jxbhfciudgqehafinhj2jizlj2qh0rixvjpwgv;1:8gmujx;2:7ik8hc9izgj7riqwk2;1:4j4dh3ej5mkfqjcrgiwhg;2:uma;1:ql6wh2;1:5jf8iu9hdjhgohdrjxsjttjiwh7;3:ojq;4:2ik8hfeitlio;1:oj2;2:ajqfh8;1:3iodipehd;1:rk0;1:wj8;2:fhegiu;1:9ioghajix;1:0jl1l62et3j84lk5gz6jj7no8h79hecgxfgwij1khglh6mhenh5oh6pgxrhdsh4th9uh2vgz;1:mkarjewh7;2:wkp;1:8im;1:8ipaiublicgwdhfejzfhdkh2ohcqjorgyshathevj3;1:tjc;1:wjj;1:lin;1:sjg;2:1hb8gijkarjqufsvks;1:ejgfhf;3:0lo;1:1iorgiwlk;2:jhgqj0;1:2k57jh8ipdiqfj4jhcoh2qixwhd;1:7k3;1:jitwhe;1:jit;1:3hg4h96mf7j0ag7bhfflggimhgwjjcoh8plrqgvrj1wf4;1:jh2qherjvwlv;1:bk1fiw;1:8jt;1:ajlcipik4;1:9in;2:3jk6hf7gw8jk9gnchaegofirjkxmhgphdrgvsh7vjywm1;1:3jq8ke9fw;1:0ix1gy2ip5hf6h67hc8j59ljbkmclbdjhegpfg5ggpihajgqkj2lk0ngnoggpgqrfvvh8wh4;1:fjr;1:eirfik;1:ajarh5;3:8gtbh5diklhcrm8;1:0ml1hd3go4gyaj3eipgk3il4jgnnippheqhcsgmwgv;2:8io;1:1jq8hfbhcdivegyfj2gh6jhbmhfnluoiqpivqjiuhcwh4;2:tik;3:2l5pjcqhgwh7;1:civ;1:sin;5:qjd;1:dhdeikqkivil;3:qiowip;2:0h42hd3lb4h85hd6hb7h09grbh5cjrdgcegtfs5gkahl4ihdjjpkftlhdmhbnhcphgqk1rgvsgtth3ugvvhbwee;1:1h67jgbjqpipqiu;1:wiy;3:jgyqk7;2:8jt;2:0ha1ha3hd9isaj4dgiejlhg4ifnjh0kirllfpheqharmmthcwjb;3:hjc;2:6h7viv;1:jiq;1:8k4cgyhjx;2:hj5;1:ljh;1:jir;3:8ja9g8hghrizujvwkt;3:3j7aizriv;1:8h69kjwj4;1:agwghasmmtk9;1:8inqjb;3:tiv;2:akm;3:lil;1:1h97h98kl9fzajfbm7jgirl4shgwjx;1:6j7;1:0jm;3:0mhwgw;2:jhblharjmwk6;4:wji;1:1jp4j65gu8lq9g2djoegvgg9hhbiisjmjkhcphgqharh6sj0uilwgm;1:fjhuikvjf;1:8hg9il;1:chfeiuhip;2:0hb4kspjuwha;4:lheriq;2:5j49gxbgsdj5fhfjgzkiophgqhgrj3sjmtjful3wgt;2:bjvdgwgj0jkhqhfwik;2:nim;2:bhgcjfdja;1:sj3;1:miz;1:7k1cm7qiyrhfwgz;1:8jl9h8qk6;2:cizoj3pj4;2:1khehggivkhcrjdwhf;2:jj9wh8;2:8itahggjpjlfkinnhfofoplwqjkwfu;2:cirhhbrjb;1:3jcqhg;2:9h2eikokc;2:fm1ggwjhbsji;6:3he5k56h27hg8hg9hedh9jllqknuhgvj2;2:jir;1:2ipdhejh3klcphgrhgsj1uhb;2:6iwil0wha;1:rix;2:dj9jim;2:jj4;2:8j79ha;2:2isgh1jj5sjj;1:ek2;2:9isehbjhfqkw;1:qktwhh;2:1l42jl8jb9habhfojxph7;1:9k3agnbhgcj8fj2nkbqiqrhfwj3;4:5ip6iwqix;1:1h93ha5hg6j77hd8irbk4cjhdgsej2fh1gjahh0ihdjgxlh7mkcnh1oh4pnjqhfrgythbwfu;7:einfldwhb;1:9kgbhaek1rio;2:cksfl1gg6hh0jhgkhgpj2rkssjqwgn;2:jir;1:bio;2:gjc;2:0h31h02hc5he6gz7hc8hb9ilbgvckmegoff0glqhjhjh7lhfmh1oh8phgqh3sp4tj7uguwio;2:hk1rik;2:biwgim;1:5j6;3:fhckhfog2ppcuiovhe;2:8h9uk0;3:uiw;4:1jv8j3bhbcjfgh1kjvphfqh9wh6;1:7h9gj3jiy;2:6gprilvjm;1:0hb3h44hg5ik6gv7jt8h1ajgbnmcjngh0jirkislhfnheogtphaqj3rh4th1uijvhawfp;1:1gz2iw3lv4j46hc7h88iu9mcafobglckudgnegwgkhhjuiiljgbkh4lh6mh6nhfpguqgetj7uh0vhfwg4;1:2hf4hf8j5hisjhfokd;1:8gy9kjajicj9dh6einfh8njjrg7uiz;2:0gx2iq3ki5gp6kr7gx8fi9g3agbbjcdgsgeihghih4jg9kjllh4mknngookjpf6qjfrgstn6unfvgn;1:ajbjin;1:1iq;3:0j81h0gixjjdwhb;2:rix;1:tjswiu;1:4j58jj9hdah6cj2ehafh8ggbhkmjknpkfqgorjvuhgwgw;3:0hcwlx;2:0lk1la3mj4im5hg6hd7h49ikah3bl5chbdh2fgvjgbkg9lgvmg8ngsolkpgdqitrgttgxuh9vhcwg6;2:pji;1:8hhdjgeglgjyhh4uk3;1:rj1uipwhf;1:bjdkh7;1:cip;2:lixnjr;1:wj0;4:pjz;1:5jt6k58it9h4dirfheggxjhaohaphcrjwsjytjcwgu;2:kio;2:gj1;2:wiq;3:2ga3gj4lv6h77hb8gv9hgdj7egwfg1ggqhhfjgdkh7lkamkjngupolqh0rhaujuwio;1:3kj8hb9iubh2;1:1h94jk5h97hf9f8dmzehdfjtjklkhdlhfqh5rjwuhfwh2;1:hgrrjl;1:qmj;4:ek6;2:uik;2:eir;1:7jk;2:himjj3;2:pja;1:jgiqkg;2:2j1;1:1im2is3ja5hb6gz7gy8jr9hcaiqchbehafgyggcjjikjklhbngvojppk9rh7sj5wg8;1:rjq;1:dikjiu;2:hik;1:hgjrjl;1:ojg;1:gjm;2:jiluil;1:8hh9imuk1vhb;1:1jl5itfir;1:6kudgqejdghgjk5qh3tk2wgq;1:jje;1:3kqojsphb;1:9hfaiocindixfiljktpjdrh0wh8;3:7jqtip;2:gj9ihf;1:8gu9glajgdliegigk3;1:qmuwh7;5:8h9biqgjohk5jh5qlzsgx;1:1gv7hc8m1ahabh7ggukgurhbuk3vjkwj9;1:8iopkb;2:oj1;2:3iq;1:qij;3:3jz8h9;1:7jmais;2:gj2;1:ggwill;1:fj7;1:jhgkhbnmmoh6piw;1:0h51h53hc8hf9k9al2bh0ehefhfgj6jfrkinmk2ngxpizqkdriqthc;1:2kw3h74l37jl9hfjisoh6rhf;2:5kw7h8ahdbhafhfjjhpk8qh9rhgtj5wgw;1:dipehdojy;1:djgego;1:8im9hbairhh1jizkkj;1:ij8;1:1hh7h58it9gzakhdhgfjujhbkhdmmpnjfoh1pgrqj9rhfsinth9uitwg5;1:fim;1:gjb;1:9ikajewiy;5:7mt9hedj3jg5phe;1:tje;2:1hc3hb4jj7hd8jv9l9bglekvgh0hjijjskh9lgwmhdnhgphaqgvrj0tgzuhcwg2;2:2kt7hd9j3ahdeh7fgvgh2hjxjkqmh2oh2qgqtisvjfwgu;1:8h9tllwh4;2:vim;1:0fvik4win;1:jilwj4;1:8hdjh9qiytj8;1:1klgj9jjbrizwhf;2:0kzwh7;1:1gydgyejefj4gh2mkboiqqhgwjy;1:fk0;1:4iq6iwah2ggzihejhbniupilqj9rh1thgwh8;4:2gm7jg;4:liu;1:oj2;1:fiwwiz;3:aivsil;1:8h09hfcijkkxllerglwhb;1:8heaip;1:3jdfh8;1:mizohfpjw;1:divjgzwlc;1:8jo9iuah0ch4fgmnhfoheppsqh9rjptimuh5wh4;2:hiw;1:0h31h02h73j14hd7iu8jf9jlah9ch9djnejtgh1kgylhaphgvik;2:0hg1h82he4hf6jk7jl8gx9hedheginhh7jfukkdlh6mj1nj4okvqgxrgetgtuiuvhewk6;1:0j8ainghgjk1ojnph9uh4;2:8hejm2phgqh8th6;1:2gx4h85l27he8j5gjfkj2ohgphfqgxthgwlr;4:8hhfh8jgvokopk0sha;1:2im8h5jilolupgotj9whd;2:hio;2:0gl3m76hgjk5qh4rhewky;2:1kf3hd4hg5hf7hcahgdiqjkcnh6qjwrh7wjf;1:uj5;1:bjd;1:8hb9is;1:4j5hiq;1:5kz;2:dheehfrituk6;5:bjlcj2rhf;1:dk6jgxrjiwiq;1:3hf4od9j2dhgfj1jhcuhf;4:4ip;1:nk4pj4;3:1hb3kp4hf6hf7h99klak6bh9eh0fh0hkgjhfkh7liwmkbnh6oheph6sg0uhc;2:ujl;3:hiq;1:wjj;1:8juahfbh1cilfgygjjhioklapirrgo;1:jj0;1:1iv;1:1h92hg3hg6ja8j69ggahhbjdch0ghbhh3ihgjglkjyll6mh6njbogvph2qixtiquhewjw;1:6gi8ge9iubh0egwrmevki;2:cilghbhjtjh7tjf;2:ghfiivkhdlkhnhbph9wjd;1:0he1lq3h04ha7j28h99kkagabh9cimdhffiyggthjeiiukisnjkohfphbuh7wgh;1:1in3jaqhe;1:0ha1ip4kfcjxjgqpherhdujewkn;2:dh0el5kimrgm;1:aj7;1:8fztkv;1:ljx;2:bincjljhesipwhg;3:jiu;1:gk5;2:wik;1:3iwch6eipjjatj7;2:7izeh6jh4pkgqiywj7;1:cioujw;1:7iy;1:ah1fis;1:8em9lyjjj;1:jij;1:6ndph7qha;4:3hf7ksaiubh7;2:9im;1:0h11g13j84h75le6ga7he9iuajcbj0dglegmfjeghcih3jfokhamjopiqqh6tk5ujzvh9;2:gjejh3til;2:qkawhe;2:4ixaj1bkrch8dh7eirgh2kj2pj6qj6;5:jgxwlb;6:1hb2hh4jk7hf8h0ahgehcfhfgiqhizkh4llvok4pglql9tituhdwgd;1:8io9hdsiwthguk7;2:2le3kg6k3qh9wgx;1:wj5;1:0kh6hc;1:2gm7jfjim;2:8ir;2:8nh9dvah7sk5;1:4kiuhd;1:5lc8h4bhagjyjh8kh5lmwphe;1:3j0bhechewkl;2:jiu;1:5jb;5:jj5;1:0na3gi4io8he9hebioeiogk6khdphguhewh1;1:aj8;1:cixfij;5:wij;1:1jm8kd9gvajxbh3chefgsgj4ijhkgkohcpgywlm;1:8ip9h4piz;1:0h85in8gy9gybhddsneh2giyhh1jj2qhcugcvjkwgl;1:fip;1:dim;1:mh3rkl;1:2kj8hf9hgbkrcgxjjxrjb;3:7j4win;4:gimqimtja;1:2h47iz;1:ejrrhg;1:0l31gt8it9itahfbixdileiqfjighbhiowgy;1:6ja7jjgjyqh8whg;1:ej1hj3jh5;1:1kc2grsj4;1:3nwagpfdbgj8hiwwhd;1:5jl7hbck5wjj;2:3hf6iz7hb8j7cjaeiljg8likqhfrhevk1wj8;1:ahheiqfivij7;4:bja;1:fin;3:1h52ipgk4thcvk5;2:0kc8jfdhcjj7wh2;1:jj3qkarhf;1:jhfohaqk2;3:iivwj1;1:fhbkjd;1:0hd3hb8l39h5agnbh2ffxgkkhgajh5kiqlklnkkogytjpwiq;1:5iq;1:aj6uh6;1:hhejkcwis;4:8iw;3:wja;1:5ipfimggsjgglhdqgxtpkwk3;1:1hf3jr5hg9jqbh5dimeinfizhitjhhkhemhdph6rjgshfth0vhbwin;3:wj0;1:2iq;1:1he8gsbk0clxjj3rgw;2:2iudip;1:uiu;1:ggwill;1:uio;1:hh3jkywhe;1:1m23gw6hh7h38ip9jfagvdizegqfgogngjfpkkzlh9mhgnh4ogypgzqjithfuh2;1:8k89iseh6hjjwik;1:9ikjhfsipugivkcwim;1:1gv8hbcivdiokllrh4wja;1:sin;1:ah8cj1ghdhj7wim;1:5heaj6fjpgjakgnlh4ngroheppxqh6;2:jjhph0vil;2:1hawjt;1:8hfbjurik;1:0im1h63hg4hg6h78kg9gbahgcjlginih7jjxkgqlgnmh2nngoprpfiqgqrg7thbwgf;1:riu;1:eixsjv;1:5ir7j6;2:0ir;1:0hb2iq3h35he7h68hcah6bizchdfkigj9kk4mh8oh7phbqjmuh9wk0;1:1h83jx;1:4iw8je;2:eio;3:8glehbhnnrhgtja;2:aiqhiuqja;2:7l48j89k3ajebkacj1egzfgjjhekiumhfnhdohgrh2thewgw;1:bk7;2:2jj3hd5l46nd7g38hh9hfcjbdgieh9ghhhhcjgcogipj7qgprgtsh2thfufdvo7wjj;1:uh4vk6;1:wip;1:ril;1:3klbiscipdh8ej8hiyuhh;1:1h12hh5jj8gfbikdl6ellfkaggykh2lh7nh8qilrh1sjlth2vh6wgs;1:dj4;1:cikdlyegzqil;1:1hf8h39h7ahdbgpcgtdk2emcfiugjdhjkjj7lhcqhbrkwuglwh0;1:aj5;1:7jlnijrimtiu;1:9j9ahgdhaeipiiwrjnskfth5wgz;1:9iucj8wj1;1:8j0;2:ijg;2:bit;1:0je4h3ijm;1:mjcrhe;2:dinegphiz;1:9j2ujrwil;4:hj8jh1;4:8j29h7;2:agxhmwwit;1:6g28jgah1bgccj0dkbfl4hforgyuo2vg7;3:djj;2:ujg;1:3kbahafh4pkf;1:0he4kb8hdan1bhdehehhfrhasjluitwh9;1:3gy5h76hc7my8gj9j7cjuelohhckhclk4mhhnh9phbqinrg3wgg;2:pjf;1:1hf3h88iu9mbaj6bg7fizghcikkkislh8nivphhqikrhauh1wfy;4:cil;2:8inbizcgmhhfjejmmbok9qh9rjnwkm;1:gjujje;1:1gzgjzrh8;1:0jw2ha3ip4gq5it6h97gu8jd9gxbnkdmxef6giyhk3kgalhemh0nh5oj6pgmqkcrfzsfyth4ugwvh2;1:8l69gzdg9egofhggh1ik6jgzklalipphcqh7rhdtmhwgp;1:0l13ku4he8h39gyahaeg5jgfqh5rheth5ullvjqwj2;2:nh0ol9rj2;4:2jf3it5jb8iq9gxchbdjcehbfh8gh4hhcjglkhfmjhnjookwpk6qgyrgnuhc;1:biphippkgwgs;2:3kg;1:cis;3:0pj1h62h83h04fq6hd7h79ikdj2ehhfimggehjdijljfukgwlj8nh2oh6ph3qglrgnuhawml;2:gj6;5:jj8;1:jiw;2:fjq;3:qin;2:3je5jd7j8jgrokdphbqj5shcwgy;2:0hf1hf3h14ir8ju9fcah1bmlclnfjvgfuhhfjizkkclhdmh2nhfohdpgprjluhdvhg;2:bilpj8;1:nil;1:bjjrio;3:1hg8hb9hcghahjeiiwjkvkhdnjooj9ph5qhbrivtjeuh1vhgwir;1:uh5vjg;2:5j0sjw;1:4j58im;2:ciy;1:bjccinjhflj1phewjn;1:0hg1gc4kc6h47h39ijbh8chcdllejrgg4jgmlikmh9nisoimph3qk6rj4tghvh4wgh;2:3in4hf5mx6ft7j39hfaimbgwdmiej9fgfghahjpjilkhgmh4nheohergusgnth0uj1wh2;1:2irjhcwjc;3:6hghikrhfwjn;1:hjl;1:1j9wjf;2:ciuok2wld;1:tik;1:lik;1:1hb3jp4hg5hb8gp9gtanibgucixdgpeivfmwhjhjgvkgolhemhbojiqitrgltheugwwge;3:5l3rh0whe;1:6jq;2:fjt;2:fitjfywlf;2:7gcjmsqknrg5whc;1:8h7dldehh;1:tji;1:1hd5kx7hb8heahbbh9jjnmkfqh8rg8tixwjk;2:pjlwkx;1:1kq6hf8h0jhask9wka;2:5h4jk5uiz;1:8il9hggj9;2:jj2;1:0iw9hbbiydk3efxrjq;1:7hc8jhgg4qpxrh1;2:7ij;1:0hc5jk8h2dj0eilfinggvhhcohhqgurh7tpmuilwh4;1:uip;1:0hh3h86ha7kaajzbgucipdjmfijgl1kgwmjnnh9ph7qglrh1thbvhewgu;1:5itajbgiqrha;1:wjn;1:dgleixrj7;1:3h5bhgeirrjowk7;1:7jt8iyciwdhfjjvph5qj8riywgf;1:6j4jhgkh1lk4wjr;2:6hfvjw;3:eil;1:9iocj7rin;3:3jn8hg9goaioch5ejgfhahjcrhewjl;1:0jpnje;1:tir;2:qj0;1:8hhairdirehajjimh3riqtj4uhg;1:wix;1:qj0;1:to1whd;1:ajfbjqfhbwjb;2:tl4wh9;1:biwhip;1:hiq;1:1io2iv8jl9h8agpbjfchbrku;1:sjouhc;1:8jqaikfh7pitujd;1:1hb8hgchfdjahiljmhqh5rjbwgl;2:6l2aiobhfch2dhcfiwghghlyjkfqjkthduhewfe;1:wj1;3:6licgujiqqk0vhdwhg;1:1hg2he4oa7hb8gk9iyagtbgfjlpqh9rirujbwhf;3:0ix3j06hb7k4diuej0fj0gh3jhfkgxlkjmhapg9qiywhh;1:ahfcjzhj8jj5nk5rh3;2:4n8whb;1:diyfiukiz;2:rk0wjk;1:ghbjiy;3:0gj3m56hgcgvhk4jjyqh2rh7wkx;2:jhgwj2;2:8lo9ebah6cj5dgxeikfjtgh4ij3jgzkl0lioqhatj1uiowgq;1:6jh;2:3li;3:ahfgkajgnwjc;1:0j3;1:dl1eh9fhegjdhh6rk7;2:jj1uhgviu;1:pj7;1:9joehg;2:0khgivrinwh9;1:5ilqjw;1:4krqh9;2:cj7rhd;2:4im6j7;1:1j12gf3h34mpahboitphbwjs;2:qin;1:5io;2:1h07h88iwalbbjoehcfgtghahh6jgqlgrmj8oheqh4rkism1theujvwfr;1:8l39gmiiorhc;1:1hc2hg3gr4hf5hb6hc7ij8iz9j0ajybkucjddhfefuff9gkyhgajnlmh9nhboheph3rg8tgtufowl4;2:7jrjhckiq;1:6hakh8lh8mhdolcsjetiowjb;2:jiu;1:4ivoh9pix;1:jk7;1:7jqcirfhdjgvqju;1:6jg8hfrjc;1:jhguj8vk5;1:cgzhjfoj1;1:2iy6jncikwhe;1:kh2nkl;2:8jaagwdhcfhghjxnjtqk4th8;3:4lt5h98isbh9cjvgjkjh3oiwrgq;1:wje;2:piz;1:8jq9gzaizjix;2:1ji3j8;1:kkkpiw;2:ij2kil;7:1lg2h93gm4gx5gs6gy7gt8gq9fcalbbkicjqdgkeg7fkwgiohjtjg8klhlh1mkonh5ohaqg6rkfshctguuh2vgz;3:wil;4:dh2ejg;1:vj1;1:qiy;1:8j79jccizjiouis;1:9is;1:5iy8fd9lnagtbj4djksiz;1:nj4;1:9hdfirhke;1:9hgclzrgb;1:sk2;1:1hg4k1afxbjjghdhhfjhgljzmhfoirwkd;2:fh7gk7wh7;2:2kkqj6;1:bhggjhnj6riy;2:fim;3:fjz;1:6nh7h88hfbheciydjdegmjgfrje;2:jhbkj7wj2;2:8iu;1:2le4gyhh8jh6wk9;2:siu;1:8ij;1:0ikjh9oj4sj6;1:8h9ahhbko;2:3ji;2:chhgijrh8sj1wl7;1:5jooj7;3:3hd7h89gqal7bjodh8ekjfhagh6ilzjf3lhcohcqizrh6sl1th6ufz;1:3h64ke6iu7hh8k69h1ah3ciqjgokhbliwqh5rgwsiytizuhgwj8;1:piw;1:jhbnixsiowlf;2:gk5jgy;1:ahadfsrkosk7;1:hhbqj3;1:ckdeh2wjl;1:pjjuiowiu;1:uj4;2:alzfh9ghcjggwk5;2:6ha7hgdh9ek1fiyjhapkrqkwuhewh8;1:hiorj5;1:nj6whf;1:0j7dh9ek8;2:8je9h7diueiwjh3oh9pjcrlhsh5;1:4j2kk3;1:8h1disej8iimkknphcrh6uixvhg;1:4h45hh6gv8gmakrbh7cgodh5egqfjlggxhkpjj6khdnhfohhqh8rgzuotvkqwgm;1:0ji7ha8kb9jcdhbjgvljirh8wkl;1:hk7njyrgf;1:6j1;2:7infisgj1sik;2:fik;1:0k3qiw;1:7j0mjgqistj7wha;1:niopit;3:8io;1:cgzfikojgtk2;1:fiklhcwkv;2:jhfwjb;2:4impj4;1:0hg1mx3is5j47hb8k89h1ahefglggyhgwihdjkclivmh4nh8ogkpjcqg6rfqsgguhgwl7;1:6hfvk8;4:8il9iwdjbej0thg;2:0h21h68hcdjjejrhhdjk0kiqmn2nheohfphfwh1;1:wkh;1:bj5rhg;3:7h58gy9m1akbbhccgjeghgiujghkh1mikqlbrh3th8uijwjo;1:rio;2:8l19gwjgy;1:0hb1pc3gz5hc6h38hd9h4ahdcitdgtegygimhj5jgekhflhhmjypglqgqropshgth6uh3wft;1:2gl7jgej0gj9;1:8ik;2:7k79jqaj6fh2nitrh9;1:5ilrju;2:8hdjlwwhg;3:ogqpjlrjs;1:lit;1:2kl4gn6h08isfhhuj2vo7whb;1:0on2hg5g86h87jh8j09gjchhdh4jk2kgolgymjenheoh2qjxrkdsgsthgugrvh6wg2;2:uj2;6:bip;1:wip;1:bizhil;3:7jadh0;1:0iyrh5wl5;1:ginrjgwgz;3:wkc;2:4j5;1:2l98iowgv;1:kh8mkwnh7oikpmuqgzwgx;1:9jocivtik;2:1hd8h2ahdbiycildhcfhdggrhh6khgmivnhbogfqkmrmytjn;2:4j28hcajrbkicjlfithh4jh6khenh6oh8pm4rh1shdtj6uh8wgl;1:4isnjnoh7pj2;2:ajqcj5fgtgikhjnij9jhgsh8;1:agahggrmz;2:jj6;1:ah4cjthjb;2:1hb3ha7hf8k49g4agzcn4djjel9fgxgh2hh0khenhfohapj7qharfvtk3;2:2l89h0dl2egm;3:7jraj2;1:9hcbipjhfniorhgsn6whf;3:jjwrjb;3:3iw6h9vjq;1:5kqhjejgzriq;1:0ilwjz;4:0go1h62h63gl5hb6he7gr8xq9j0aggbo7dh0eeyfhfghdhh5ih5jgxkoylfumgtnh5og1pgwqgdrgesh3tg5uj6vj8wg7;1:ck3jh9rjc;1:3k04he8hf9hddh0ijeoh9pj3qizwkk;1:fis;5:hiplim;1:6juphf;1:7ixpjgwha;2:ckjhjgrhg;2:diwgiukh5nk2;4:agxhh0rm6whd;3:9jpegp;1:0iq3hg4hf6h27jm8hf9hcgiuih8jjnkgrlglmh4nnjoqdpfjqgqrhbthdvhawgo;1:1ip6ji8ks9gfcjrdjdeh0hj9jgwphgqhgrfxwjj;2:dinehcnjfuje;1:4jq5jseh9ljjnk0sh6wha;1:4j2;1:3h57hdahgfj8jm7mh7pitqgsrh6wjy;1:8ipcgjjjjoizrjwsj3whf;2:tjtuhb;1:2kt4gp8h6ahhfg6gkphizmgfnl5ujlvh1wh7;2:ujd;1:2ij;1:ql5wh1;1:5iw6hf8gm9j1dkoeh8qhfwk0;1:2h44heoll;1:dj6kin;1:aip;2:6ivpjrqhg;1:dinwiq;1:6jj7hg9hbbiqch4fkxjgxqhbwkc;1:ahhhje;1:aiyjje;2:3h9bincimfh9gkyjhbnhhsiqwkd;3:7hegj8ik3whe;1:olkphftjlwhf;1:0iw1ji3gx6l77kx9jvaipbh7dgteisgh5hgvkj7lhgmhgnikoh5ph5qkdrgzth0uh4wfc;1:rik;1:1iu2h33hc4hf8j89izajlbj5eh8fgvghdjhbkh8noiphbqilrgwth9uhg;2:2is4jd8h69gtdmuef6jkwrkithgwhh;1:qjb;1:wj5;1:4ir;1:3h88jf9j7ajvbjdeh2fgpjmbkhenh6rgwsjfthcuhewgg;1:4ilvjd;2:5j08gs9jdairbh7diw;1:8hejj3kl5whd;1:dj6ehbuiy;2:2go7jimik;1:dhcjj8;3:8jd9iqpit;2:8h69iuvim;1:qju;1:4o6ojiuha;2:1he7inal2fhfgh7kisnh8qiyshfwjy;1:0hc2hd4ha5ha7it8gg9gubgvckvfgvhh8ih6jldlitmj0nitpgmqkork4tgyugxvh9wje;1:wj9;1:iir;1:wiz;2:2ma3kb4hb6jx7hgphfqhewgv;1:0jf3l14hgahfehhghfhjhjhgklblh4ohaphguiuvh9wgz;1:1h0iklkhd;1:hhdjj5;1:cijpj0;2:1ha2hg3hg4k05he8h8ah5bjhcheeivfh8gijhjkjlikh7lk8nh8oftpkmqiwtiqwfb;2:8ha9h8aiwbindjtehehgtjherilukwwhg;1:4k8ohc;1:dh1ejd;2:7hf8hecgkdkoekwfirghcjgqrk6wjk;1:fh3glqwh8;1:0h12ha3je4he5h76hf7gx8kp9lqah8bfncjvemaggxhitjh0kh7mhdoh8ph8qinrjovhawg4;2:8j8dgrekqohdujc;1:pis;1:5j7;3:fil;4:1j0rhgwj4;1:fim;1:nis;1:uiw;2:ahgjjokissgyuje;2:2k74j67jrjhbwim;2:1hf3hf8he9hdbgdchhfj7jh4lh6pkcrpxwh2;1:1jvqinthguj1;3:6imbhfdjyegimjssj6;1:1kb2oz4hg6hg7m08hb9hgghchhbjh9ohapheqh6rhgvjewg4;5:8ktehg;2:lhcnl6;2:9jadh9eix;2:3k49gofhcjm1wgr;1:win;3:4keaj8bj0uiz;2:3jgdj1;1:ah5ejsrjhtiuuha;1:iimqjasin;2:0j8dj5egpfizjiprj5sivwh3;2:jjg;2:5ilaincgohiwrjtuir;4:7khahddjlegrfhcjhcom3wgp;1:fkoghhojmpjtwhh;2:cio;2:0h32hb3jb4hf5ha6hg7gy8ko9ltbg5cjxelxggyhitjgnkh9mheohcph7rk2uh7vh8wgi;3:8j7;1:5in;2:0h43k06l7vhd;2:3kq;1:diu;1:ajqfhfpj9wio;2:5k1;1:1kafhfkh5llnqj0whb;1:6m78kw9h1cj7eiqrgvwhc;2:viv;1:2he4iuolz;1:5k08iw;1:1is8gk9lz;1:jiz;1:4iljh3rjzwjy;1:akfkhe;2:8jf;3:7gxdh1eiohiyjmkmjcpj1qj1rgbwhe;2:ah2chfeirfgogivom8phgrh5sizwkj;1:7ixdim;3:pj4;2:dhbeis;1:gin;2:1ir2h28leakddgieh8fgbjiykk9oikrinsgk;1:jjalj2mh3qhcrkbwhf;2:1je6jo9imjj5wgn;2:0hf2hg3j14h25gu6jx7k08kp9grbjacg1dgxem4fg2ggthfyih3jjmkh0lhgmh0nhfogopgwqjgriqtnavh8wga;1:0h42hc5h76h97h28h9ahgbjucg6dgnfk9ginhfyifyjgbkj4lqzmh0nhdogwpgpro5tgougnvhcwk1;1:hh8jix;2:7imaj2jhf;1:8j39jdbh0ejr;2:djaeh4fkoggiukaviz;2:1gs3hd6h48k39j0aivbhbch5phgqhgrh5ukgvk6wl2;2:1hgdkzeh9jh6kj3litrjx;3:8dw9occhb;2:5j8bk0ch9ghbjgznhgok5ph8qkfrjewh0;1:ghdjiopjyqhfsiuwj4;1:4h55ji7hg8ik9ioagsehgghahhenn3ojaphgqjfrh2thfwhc;1:1iv4ko8ioah2bj3eiwfh4girjh4kg6lo5ngsoh7phbqgruh8wjf;5:0ja1h3tin;1:qk8;1:gil;1:4guiow;1:6mjaimvdh;1:liw;2:njqwkk;1:6ij8l39fioj9;1:giw;1:9iooio;1:iiswil;2:1h82ke7hf8j1jj5kl6njnrgjwh7;1:ojd;2:5k1jim;1:8m59hhkh4;3:mjf;1:gj9oj8;1:8j5hh4;2:8j1;1:ijfkklwhf;1:aiv;1:1gi2ip4h05j86gt7k68jp9kibjbegnfgrgg4hh6ihajj6kiulh7nggohepgkrgftgnujzvkowin;1:bjh;1:pk3whh;2:aj5uhb;1:nir;1:ejc;1:7j2tjb;3:eh8hixwjp;5:uil;3:1ki2fj3h54h75hd6h07r98jlagrbgecgidh5eh4fh4gjjhh5jkbkgqmgyoirpfotgsuh6viowk2;2:nis;1:0il4h89ijagyfhgoggqkhriouhawj9;1:fix;1:6jhajkbimhiliisjh9kj2rgp;1:mj0rhe;1:8j69h6rjl;1:mjb;1:aiz;1:3hf6hh9kyag9bhgcj2fiyjiomiwnjvohcqjv;1:aiy;3:3ip;1:4kosjr;1:jhcqk0;1:ahacissjv;1:0joojt;1:3kibh3jhbriv;3:mil;1:4hg6he8gvbjicimdiueg9fj5ggshh6jjknh4oisrfjsm9tjtuk1wfd;1:5ijwiq;2:fil;1:4j4;1:jhepiltkn;1:5k96hbail;1:wiw;1:8k0bgy;1:gjpjh9;1:bkc;1:din;1:qjf;1:8kb;4:vjg;1:8iw9hg;1:7ki8gyfhgjk2oixqh8wh8;1:ujh;1:2j78gp9iqah4iknjh6rhasjjujswj2;1:vjtwit;1:5j1hirjhfwj2;1:4ko;1:6mjojfrhg;1:cjk;1:wiu;1:8k99h9;2:2kx4gu;1:2ko4ivjh7rhfvje;1:cip;1:8ja;1:3lh8in9hgdkhefqwhe;2:dh0ejy;2:gjbliqql5rgy;2:kj2njrohewj7;1:5ik;1:gjyliypilrhcwh4;1:4le6h78h8bj7ck1eh5gluih4jgmph2qhdtjjuhavipwh4;1:jiu;2:1iqdisehg;1:1k9dj1kh8;1:gir;5:8lb9gk;4:4p68gyahfdheeh0gh7jgunhgoiwph4rheul6vkcwh4;1:iku;1:2kf5kl;2:ajsfgn;3:1he4h95ha6he8lo9kpajychadhaeg1fgdgh1klflg9mh3pirth8ukdwg0;1:0o27hgchggkmqhhwfh;1:lis;4:8ghojarixwk9;3:jjepj5umcvhcwhd;1:0in1kd2io3go5j97gm8jdakobheciwdgsek8fgqggohh0iinjgkljdmhaojgqgcrgpsh2uhavipwgl;3:fim;2:0lf3hh4h29ingjwwgx;3:fikjkmwhf;1:2jl;3:1ilrhf;1:clehisret;2:fikgjajh5wil;2:0hf1h82j23ip5iv6hh7hd9gvahabhdch1dipegxfgsgghhjlij2jhhkh6ljknj6ok5pjhqgythbugzwjo;1:7khniuwhf;1:0he1h52he3gn4gp6h37h18ky9hfaldch7djqeg9gjfjgukg8lgxmh5nhepgkrj6sjftkeul7wha;1:4iu;1:kjgmhfpjf;1:2h73l58h59godomej2fhgjh6lhdol4ph5qhgrgjwh2;1:8jb9j8ah1hjljh1sk6;3:1hb3gm4hg8k29j0bgscgndh4ej3gh6jk7khgqh2rj4sk4tjbuhbwiz;2:pim;1:8j8jhg;1:0he4ha7h79hcaj6cildinegzggshj5jhekjulhamjmnhhpjmrl0th2wgf;3:vim;1:8kl9hb;3:rix;1:0ilej7;1:riu;1:4jswh7;1:2is4ja8h89gtagmdnaefkfivgheriqwjy;1:1iydil;1:eiwmim;2:cj5mgktn7;1:qkhwhe;2:iik;1:3gc6kf7h48h69h6eh5gg4kiplk5mh5nj5oh6pgwqjkrgpskmtipughwme;4:8jhcjauj9;1:cji;1:jix;1:1h83hc8h79h7agodgvfgzhorjmskhelhbmhbphbqkjuhdwj4;2:pj9;1:7ki;1:0kl3jijhbmjloiqpixqh8wgs;1:wim;1:kiknjg;1:jh5pguqrjrhawfp;1:6oaciyeh6ohfqh7tjewgx;1:0hb1jt3l64ha5h16fp7h29jbah5bg3dh3ekxfj6hguik2jimkgplhbmh1ogrpjeth6uinwjc;1:wk3;2:8jgehd;3:ljuwhd;1:0oy1h73h84h96hf7jg8jk9gkaj4bjmegwfhggipihfjjykh3lj2mh0ohfqgkrgnthewfv;4:jgyrjj;1:lkknhh;1:hj2;1:gh5jj2qkjwha;1:giv;1:6kkwh9;1:5jd;1:0iy;2:aim;3:ein;2:cjb;1:8jfrio;1:nje;1:3kg9imiim;1:5j7;1:8iojh2sjowje;1:8h2kl6lgu;1:1hf8hf9hcbgocjndgoeipflmgn3jgtqjdrhewhb;1:3heiimjhaojxwku;1:jip;2:fjq;3:2fb3ji6hf7m59j5ah9jixuilwgv;1:0j18jb9gqclurgb;1:ugzvjc;1:8ilbimfh8giyqj8uit;2:hjl;1:2h34heolm;1:1npgg6jjzrh0;1:6gybjkggrjgfkioohcqiktlgwlm;1:0pc1im3j24hf7hfagqfizijbjh2qilrh4wgi;1:ahfbjydjvfjsjhgqioujnvj4wgn;1:ajodj5fhf;5:8j9hh8qjq;2:ajwkh8mhgsje;2:ajl;2:aj5;5:tj7;1:9iw;3:bjwfilrh5;1:2isch3riz;2:0mp1in2g43iz4j15ko6gw7gzahbbh0cheegsfh9ggzhhbjj1lh2mkwogmpgfqkbrjasj9th0wfd;2:hkmrggvja;3:8j3;1:gka;2:0ik1h72iu6hd7hf8jg9klbn9dhefgdggvhhfihdjgrkkklgzngfph0qgtrh3sixtitvhg;1:2iu4iz8hd9j1gixrip;1:eiyhhcjik;2:3ir;1:cio;2:ejs;2:2m87h38l49ghaiybgwgffhkljlfqgzrh9whe;2:wir;2:1h5ak5dj9fiugj4rhfvik;1:7hgpniwgh;1:9iv;1:0j72itailshd;1:gj7;2:1h13jy;1:oiwqnuth7wh9;1:rj3;1:mggtli;2:aj3;2:hitjk1;1:3j98gdaiucjceh9ngbpjnwjs;1:dkvef7;1:7g18jt9hdciweilfguhiwihgjo0pheqjxth7wgl;1:0kx1gv5iz6gx7go8h5ah8bh4ckqfk5gkihhdjgtkhfmhgnhgpkqqh6sh1uiyvjnwfr;1:iin;2:3ipbjwqja;1:6hd8oj9f7ahddo8eezfhagjchh6kgypjvqhdrkethfuggvhfwgx;1:akpfgukh5qj4;2:rk2;3:0j31kj2hg3jl4k55h96ha7h88go9hbahdbgiehfhjkikljitmipog6pixqisrgathd;1:0j49itpjjqhgwha;2:8glah3bjgehdhnlrhfwhg;1:0hd4it;1:gizij4;1:8gfbh0egxrmm;1:8k2hiv;1:3guahbdjsfiwij4rj2;1:0ik;1:bjiclifhcrhawju;1:2is3io8hbagrbh6cnagg4hj0rkbwh6;1:8h9ahhbko;1:4iw;2:1ik7h98h3ejigmtjhdrj8whe;1:9kdoiv;1:gheqiurj8;1:1ja8glehdhnvrguthgwik;1:0iw;2:0ju1h25h97fy8io9h3cirfglgj2hipijqjnapkkqj8tgqwfo;1:6f9vlk;1:3lxqgw;1:6lgwha;1:8iyaj9;1:tkcwhf;1:8gdal4bhecjieh5fhfgh4hm1jh6rh3sizvj3;1:hhcjjo;1:1ip3gq4h35h87gj8mh9jnbgxdimejcfgggiyhiniimjgdkjkpgoqh2shctilufovjl;2:wim;2:9ikoiz;1:jjv;2:8k39goak8cjeehefhegh9ilkqh4wh4;1:0ju1ltbinrfkwhg;1:wji;2:fja;1:6jl;2:siq;1:1h82hb3ir4h55l16gvagsbh9cirdheehafh1gggihfjm8khclh4mh5nhaohdpgsqltrjftguugovk3wjp;3:1gw2hd4hc5hf6hd7gr8h69h8allbhackodjyeglhgalhemhanh5ohapkpripsl7tiuvhewfr;2:2gl3mv6gz8kr9gfagubjejg2kh7pmfqh1rhcvm2wfs;1:3io;1:biz;1:ak1fiynhfpj8uhg;1:3jsmhhujvvh4wk1;1:1ja7jswhd;1:filql9wh0;1:tiy;2:jil;3:aizgis;1:jj2;3:bjj;1:9hgaj5;1:3mu;1:hfxjmc;1:3jq8jnjgj;3:0h71h93jz8kv9hcag7bo1gj5hhejjykgvmhgqh6rg4sjzthguh5wga;1:3ha6ha8giehakh8mjookdpk8qhfrh1th4ulqvjb;1:khfljw;1:4ijmkc;1:8hgmmhoim;1:khalmt;2:hit;3:hisjiz;1:0q96hg8hcihejh7miungcpl7qh7wg6;1:wji;1:cis;1:6io;2:2irfj7;4:8j1;1:3io;2:8ik9hgaiobj3cjgghehj0mhdrlzth8uh4;1:ah0gjijkrrjduhawh8;1:jguwjv;2:mjf;1:oir;1:0ja9gvdhhekwphg;1:5ikvjm;1:0hd1gu3gt6hg7go8jq9j9bmadjsegngj8kgxlgpmgvpgvqiksgfvirwkn;1:2lcqiqwhd;2:qhhwkd;4:ghejis;2:5jxdin;1:gjh;1:aiojiv;4:rj7wh9;4:tkc;1:hj7;1:hjgrje;1:9ixehe;1:diz;1:liltjz;1:nj9wha;1:8hdegzrjtujtvkowha;1:4io;1:2ku3h87hc8h19jqahcbikckqejcfjtkgwmhbogqpgwrissh9vhd;1:jj2;1:8haajefhdhhcjjxoixph7qjmsgrthfuiu;3:aiqbim;2:8h2jjqpjs;1:tj8;3:bik;6:8j2cimeimhjnjj0sjiuh9;5:8kn9gs;2:8h19j3;3:dcrep4;1:fiutit;3:tilwik;2:3j47hg8gs9kcbhddheej4iiljhcpkrqjvwh0;3:dilnim;2:0k56gjuh7vm7;1:pip;1:rj7;4:8ikqkuwhf;2:0j9;2:him;1:9in;1:7gaqh6wm4;3:5lf7he9ilahfbhgnj5;1:1ilhgfjkwrhe;1:7jiehejjrmghphfrilshgto1;2:0h91hd2he3ip4h65gz6ki7f89h9agpbivdg8fgtgj2jixkh1lhfnj6rizshatgwvmiwjx;1:bgsehdgl4lksrjowhc;1:ahejkaojdphdwhd;2:aja;3:bhdqikwl9;5:gij;2:3jd9hg;1:0f03midimehdljb;1:8j0dj1;3:4ipbhbgiphixpjisgs;2:6he8ky9picg6ehakh9lirrh1ugjvix;1:dk2eh8hj3ij2rh6;2:qj7riz;3:aiwbmvch4fhbgh9hjrjhbkhalgxnhaoh9pjbqj7rgvthfuktvgu;1:dj4jk7sgw;1:jgypj7wkg;1:7h98h1airbk7cithjxjh5kimnjnqiurgssiwuh5;1:fiu;1:6ix8in;1:kjd;1:5isrjc;1:8hgbk7;1:kjd;2:cj4;1:0h91gm3gu4h65hf6gr7h28go9gzagobiudgcep3fjbggpjislkhmndngwokepg3rg2sh3ugzwj8;1:tis;1:7jbfkzghalkroimrge;1:vkewhg;2:5iu7imjhdmh8qiqwjb;2:uj1;2:cjbdj0egujg8mh3rgztov;2:bhbvj6wl6;1:jjynj0ohgwjw;1:jhhliypjcrh3whd;3:gjt;1:ejigiojh9qikwil;1:jl6wfw;1:hjxjgq;2:2jloisphbwit;2:kik;2:eh7qju;1:8it9h9;1:8je9jsdisfip;1:wj2;2:pjo;1:wjo;2:gij;1:kj2;5:8ixchgrhguimvkf;1:nilrit;3:8j59h9;1:hm2jh9;1:8h79ixchbejcfikhj3jhbrjcugtvj7;1:2gs4jl7jv;2:5j4;1:1he4hb5ha6hf8ly9l1ak1chbdhbeg0fgegh3kljlg8mh4piusikth9ujiwg3;2:cj8rhc;1:ljr;1:3h77h28joajqcj2diyegxghbil9jivoiwpjpqh0rh3thfuhf;2:7h7fjqjjeqj7rj0tk7wgp;4:2l1jkvqhdrh9wh9;4:jh9qjlrghwl6;1:8iv9h9cip;2:ij1rjlsip;1:njwwhf;1:qk4;2:sj0;1:fiu;1:qkw;1:jk5sh5wjw;1:9im;1:jh7wl2;1:mh9wjl;1:iivjk6;1:bjd;4:5imrjx;1:bjziis;1:0it3gp6h9jjmoheqk0ujqvh5wj8;1:0ixbjf;1:ejj;2:hil;2:sil;1:5ldain;1:0jj7j09h3dh4fjjggpjiukhgphcqjarivtjcuhewj9;3:jij;2:jit;1:giw;1:6esvll;1:pkh;2:dh1ekqjijuin;2:8h79kacgu;1:6j2;2:5jz;1:9h7qjntj6wh8;1:8heaizbjrghgiimjgtohgqjctje;1:7gicithhfjh4khcnkwqizwkf;1:lim;3:ujk;1:8giaiyfhbvmzwgm;1:7jfjh6sil;2:9imajmfh8giy;2:aim;2:hirpjl;1:4ipgj1nj9;1:ahgjiw;6:6jokh8lh1nlopgy;2:3iufio;1:3h25hf6gn7fu8k29g1al9blacklfk3glbhjljehkgqmhanj4oh1qgcrgntgsujfvgn;1:1h33h74ks5l67h58ew9kdbgsdipeh6hh5ihcjfokhemn1olbph1qgerfzth3ulzwg5;1:gj2rhd;2:7hg8gn9l5aikbgrdh7eh5jhemioohcqgorjtshduhavirwn7;1:2kb8h39iwgj6hh3jh6ljg;1:0hf2l35l79h4dkzegljglwhf;2:3hgajyblrcktehagh8hhajh1kjyll0oh2qhgrg7whe;1:riv;3:2iw3h94ji5hg7gg8gf9graghbhaehdggxhh4igxkh6ohbpinqjlrh1szstgruhawgc;1:0he1gj3h56go7k48gzbmqgivjhgkgsomsqhdrh9vjlwgu;2:4ky;1:wj1;4:6h0jh0wmc;2:1lx2jkbj7khdojrph7qhergz;2:1k3;1:5ivjh5;1:pjc;6:8j4ah5jjiohdrj2tkgwir;1:8it9gvbh5gh1jh3kgsmk6pj9qgzwo4;5:3jd;1:9hfahgfhdgjnjgxtofwh7;1:4jdjh6okvphc;2:ch4jjilj9rh2;1:8ikeknrgn;2:7jd;1:2iy7hgqj3;3:5fxwmp;1:0hg1hg4j5bh5hhfmsjngvogqph7rh0tj0wgs;1:8h89iv;2:4hf8j2gjnqisvj4;1:tiu;1:3hc5lo6ki7ha8k69h5bjxch6dl8ejxffsggyjgukhaph5qh9th7uhcvkwwfd;2:hiq;1:1h02gi3hc4h15hc6h07qr8j79haaikbg3dhheh5fhfgkskhflhcmjepikrgbsh9tiywhc;1:dj6;1:8io;2:cim;2:4kx8hf9mgeixgilhhepgzrgtwgv;1:1k03he5on6g07h9ahbjhdkjnmj3nkioipqh5rgpthavg5wh4;1:aip;2:0gu1hd2h73jf4he7ip9kfah4ch9dj8ejjfh6gh7jivkgzph9;4:0h93h94he5hf6hg7h9cgudgpej3ginhg6ifwjgtkj7lrgmh7oh9ph3qh0rnqth5uhe;2:4ir8jgah7eil;1:7ikpiw;1:ch6jj9kh9plswhf;1:dheejpfhb;2:2kb4im8il;1:aj8;1:hj2;3:6j6hgljjcwke;1:pj8;1:0gw1h52iv3io4in5h36h37gh9mjainbisdlxegmgghihcjgokk2mh9nhaohfrjhshbuh0vgz;1:wjy;2:1hhahgfj8jkbnjxpj9qhfsl0uguwfk;1:1iv4hg6gz8grcj6dgbejsgkejivkjblk6qh5vhfwgb;1:4j5;1:8hbbkfljtwil;1:qja;1:7h1wja;2:gik;1:0j99gtrk1;1:8ja;1:9hddjjeizfioghajjq;1:9hdrk2;4:3ioijg;5:4ip9iucit;1:8iu9j2alwfggkj4rhb;1:hg3tknuji;1:1j2;1:wio;1:3j99j5jj3wji;1:uh1vkq;2:jir;2:6kg;2:1gd3hf6iy7h88hc9k9ak5bh1cjadh2eh1fhggjfhk2jhekh9lhdmh8nhfpj1qgzrlstj5uhewgd;3:7jq;2:3h0pivwjp;1:8jv9k4ch4dh4jherjp;3:bjn;1:4j5;2:wil;2:9je;1:4ivgguhji;1:jhfkj8qio;1:rit;1:2jj6gv7ipbiuvezwmx;1:3jl6hf8hedjmejfuiu;1:ajffh7jjpniw;1:uip;1:1ir2jx3hc5jb6h47hd9iqbileh9ggehhbij8lh0mh8nh6rjksijtjgujpwh9;2:3ls4in5mn8gh9juah2cgjdj9egtfgsgh6hgriizjf1khamioohcpgxqikriwth5wjb;1:djjeh6fkfjj1;1:8j59hediqfimkhfnjc;1:ghhijpjk5;1:2jhgjgjip;3:8jb9h8df9ekv;1:8h89ioagfbhedh0fjrtl7wj3;2:fitvj0wjo;1:jjtwgz;3:firsiq;1:6h9viw;4:tiq;1:uju;1:3hg7jkahfdghejsfjngkfhhajgsnhepheqj9rh3titujfvjowh8;1:3h85jy8ke9jfdflencjhergwwh7;2:cjdjhhnh7ohapm9shc;1:3he6il7jo9hgahdeiwjhdmjipiorh3tj1ujiwh5;1:iio;1:0h71h94he6kh7h3aireh0fj5hiljh7kj8lgvmj7nkrohgpgbqhcrkisj6tgtuhbwg9;2:4h38gs9krdh7ek4iiujh9ok3qh7wip;3:8hg9kfehg;1:fiz;1:0j8;1:1hb8jn9o2alabjqcggegwfh1ghajh0klmlh1nh0phcqgqrh5thgwh2;2:9hbajeqjw;1:8jq;1:2gl3na6h58hajgjpmeqhbugnvm6wfz;2:8iq;1:aiu;1:tim;2:0hg3h15iz7gd8j59gvcjbdj0ggzhh5jlkoh3pgwqkmthduh9vj7wjc;1:5k27k48habimcitegogh1jgjoioqlfrfzsinwje;1:ekk;4:qh8wkt;2:fiw;3:0h73j27he8gs9hdahbbn3dilfh3gilhhfjgqmhhojjphgqgqrk3shfulhvh3wgl;1:qjm;1:qjc;1:airbilwij;1:bjujj8rik;1:jix;1:8iy9h8tjf;2:mimtip;2:8judh7eixpjc;3:ogvpl2ujcwh6;1:8gxag1bgncx1fglgg0hg9jjkkh8lheshguhhwgw;2:iis;2:agysk4ujm;1:0jfuil;2:jj3;1:aix;3:9hftku;2:nio;1:cfvtkkwiz;4:3mdjh8mj3rjfwgt;3:aimdixfhdnjq;1:dkaefrjit;1:6h57hg8ivdheoiuqliwhe;1:cin;1:9jyciudhcrha;1:cisrhcwjm;2:1h67h58la9jbdjcfh8gimihbkh2nhfohbpmhqh3rirtgmugmvhc;1:djpegx;3:9il;1:dh8ej3;1:0ijwk5;2:1mw7jeghehjbjh9wha;1:3j15g4ggfhh7jgmqncwla;1:3jmaj1rh8wh2;1:8j0;3:aiw;2:vjh;1:rin;2:3jejjcmj1oh5phgqhcwk8;1:wjp;2:rjn;1:cik;1:8h4uji;2:aip;1:6jbfheij5uiowh7;1:wiu;2:4hc8im9hagjcjjrlk7qipwgu;2:1gz4h85gx6h47io9g6agyck5dj7ej2ih6mh0og9pimqivujcvk4wkc;1:8im;1:3h74l16hc8gu9hbah9bhfch5fk4ggjhinih1kh6lhdmhhnhcph9qj4tisukyvjnwjp;2:3jw5hd8ir9gwahdbh5chadheeh7fipgkyjeamhgpkaqjjrjzthfvhfwkp;2:3jt;1:9isfiq;1:wit;2:7j8;1:0hf1h92h83gx4gy5h66gv7il8fm9jiah7bjlck0eh4fgzghdhj3ijbjezkgzlhamh9nh9ol1qg3rkcsittn6wim;4:nj1;1:vis;1:pkqqhgtj3wh0;1:fj2;1:4ijaitfh5gk2wh5;1:pkkqha;3:fh6ujm;4:6j79iqwhd;1:qkd;2:3j45lragqgjmhjoqhcsgnwj3;1:oiv;2:rja;2:1iu4j5phh;1:6iu;2:6jl7h2oh2qmbwjm;1:bkcdgxgizjkbqherhfwik;1:chejj3riv;1:rl3thguhf;1:8ij;3:ggxohaqkcwkr;1:ujh;2:1k03h44hg5hg6hf8j49j6aklchdggwjgkkh7oj1qhgrl7th7wjo;2:0ha4hf8iragmdh6ej1fjqgjcjhgkhalkbph9qhcwls;2:jj4;1:ij2njg;2:1fp2h53gw4ha5hb6h48pk9gfajhbf3ddveq5ijdjg7kgxlioniwoh0pgvqgcrittkxuh2vh5wiw;2:3hc4hf8gyahech0fgmgivhkeihgjgikgplh8mhenllokxpgyqkerg0tj7wku;1:3hc6kkeimglkjimojbphcqhbtgzwgf;1:dj5eh6;2:qj6;2:0kt1kx9hbahbbhdeh9fgzgjqjgzkh6mhfph6rhcukpvjlwj5;5:ril;1:pjl;5:sjatil;1:fiv;2:riw;3:1ha3j77hd8j7akjbgacilfl4gj2hj6jgkkglnhgoikrh8thauh8vhgwhd;1:riluix;1:4mo8j6aj7jfpmh1ojophgqjnrhf;1:8hf9iwjh7qk3rirwju;2:riv;1:air;1:8knhhcjkzthewhd;1:8ionjk;1:wjg;1:0ir1lx4inhhfrh0;1:lim;1:bjb;1:6j8ghduj9vgzwlq;1:3k64jegkmjh3qh1wij;1:0il1he5hd6hc8j89lqbh7ch2dj5ejjfh2gijhjjiiulgdmhfoh0pherg5sh4thauh2wjt;1:hhhjhdqk0;1:0hb1h73ix4ji7mv8gy9h4dlifhagh9jj0rhgwh9;2:3kmaijij6wh9;1:khfnm9riv;1:ek0oh4pks;1:oiyqm6th9whf;1:0in;1:gjilit;1:2lcwhe;2:2iy4h58hfbhgdfpel7fisgiujh6lhgmljng5oh0rh6shbtlruhawj5;1:fiksj5;1:mje;1:agkfkl;3:cjbrhd;1:8gvahebiogjxjhflm9nhgphcrh8tl8ugz;7:8kl9myegafhg;4:6h9vjm;4:9julikrgo;1:kl6;1:wj1;1:0jy3jh4hf6hc7h69imaglcimgh1ijckh5lj0mhfniyojbphaqipth9wge;1:9jiah0uilviq;1:5jw;1:8h99is;2:bj3kj3rhg;1:0lb4h25ixdinsim;2:0je7gu8jt9jsdiseguhhcjk0mgpnj7oiqphdrfnwkl;1:2iv3ix5it9h5ahgdj9eingh9mitnhdwgn;3:jir;1:sjm;2:9io;1:3il;1:njn;1:8hg9je;1:eiwoilrh3tmf;1:1iv2j25io6gu7h78ioajqbipfgzggdihhjinkiylh8ngvohcpixqiprhesjptikug7vjuwga;1:aiw;1:ij6tjf;1:0jo8miajhbjicj6dhgegugh5hiuiinjfupgtqkgrgusgxth3uj1wfb;1:oj5;1:rj0;1:3j8whc;2:4o7;1:5iwlimwja;2:fir;1:8gu9iqqhgtkjuhgwkd;1:3h54io5ha7jf8hcbkedh8eh0gheikpjgjohephhqhdrh2ukuvik;1:3iv;1:6j18jsajwbk6cikeh3fhejhakjfnhepjaqhgrh1wha;3:9ik;4:8iwgje;1:wll;1:dik;1:4gl7hfajfdj2eimfj8hjbihfriuwhe;1:win;1:6gj8glel5ghcujuvjgwiq;1:jj9wh8;1:hiy;2:3j7aiybhddinriu;1:ah8fjkjh1njrohapjuqgywja;2:0ju3hh5iohh3rixtiluj2;1:0jiuj3;1:0im1hc2iy6he8jr9k1blwcj0eghfgcgh0hheihejh3kjwlh4ngyph5qh1rh8sintixwg4;1:bh6dhfhkgjfflkrqizwks;1:8ilbil;1:jlbwgl;2:8irvil;3:1hd8gu9hcajubhbchcdh5egpfjchhgjjkphfunfvjxwh8;1:cim;3:4h35jc7h89h9ahaggthhdnmsokfph9qh3rjzuhfwhh;1:2imjju;2:7iu;2:8es9m6;1:bj9ch5jh9qjv;1:gip;1:4inbivchhhipjiwkk1rj3wh5;2:3j3dheej7;2:0j4eisginnjm;2:1h72jp4isfimhkelkbnhcqhb;2:jil;2:3kicjvfhaij4wh6;1:jjktil;1:1gs3hc6h48k39j0aivbhcch1phgqhgrh5ukgvk6wll;2:jin;1:ilgwhf;2:rj0;3:9ipbjrkjanha;2:ahgbhfdjcjhbuksvjtwij;1:vjh;1:eiyij5jj3lkpnhg;2:iin;2:1hf4hc5he6hg8mc9lcak8chbdhfeg6fgegh5jirklblg8mh7sinuh6wg3;6:ainuipvke;1:8jxaikkhd;1:qj5;1:jj8wh6;1:mj0;1:jjxwgr;4:sjc;1:1ja;1:pjf;1:3itbimhiu;1:oik;2:lj0rhg;1:ehaujq;2:9h9ah3jj1ukdvit;1:9hgjjynj0ohgwjv;1:jka;3:6j8;2:8iv;2:8k7;1:eis;1:al0fh1kgsmk4phc;1:mjr;1:8j2;1:3iu;3:sj1;1:pjm;1:9iorik;1:jiz;1:fjugj6khamkbuh9;2:pjrqhb;1:kh9oikpkatizwhg;2:3iuwij;3:7irpin;1:bh6ll6nitwhg;1:3hc7jg;2:wjy;3:nk0rgx;1:jik;1:8haejmjhbkgmnjnokqpk2rj0whd;2:eit;2:0jl1is2g94ll5ha6hf7od9hach8ghcijpjh1kh8lheohephbqh6sh5thfuh8vh2;1:0hd2h03ly4hh6g9ah8bgsjjrkismh3pl9qgarg2thbugjvlpwjs;3:1il;2:fh2gj9lk2;1:ljfwj9;2:oip;1:7lqvg5whd;1:0ix4k65is;2:3jcqhg;2:nj0;3:jj5;1:hjarh9;1:0h03hg4mv6g17h9ch0ghhhinil6jgslhgoirplbrhgsh6uhfvj9wgf;3:eiytil;2:fj5;2:ghdhl7;1:dj0;2:rjf;1:6jvwh1;2:gimuj7;2:8hgkj3pir;2:rld;1:aiubh0ohbpj3;2:8gwah1uku;1:2js4ivhkqqhe;1:dj7fhe;2:8j8;1:2gk7n1ohaphftk6uit;6:gik;1:5jt8h29jyak5bhfciteghhjnjj7pkjqglrknug6wfw;1:6ikgh8sipvilwjb;2:oivwj4;2:0hh1h73il4h35kv6gt8ik9iqagebh5ciodhceh5fgxggbihejlmkh6lh1nh3oh9pgnqleriysj2uh8vjwwjc;1:8ikaikfhfgioil0;4:dghrjv;2:2mc4gw8jt9hadinfgyghahlhjk4mh4ohdqgsrfetjiuhh;1:uio;1:7lk9hfbhgiiokhelkyojjpgxqhgthfwhb;1:ij6oip;1:6juphf;1:8jipk9whf;1:vhcwj5;2:hggjjn;2:wiu;2:0h12h63jk4h95js7h09m4bgqchcdmdegjgjwhinjgzkhanhgoh5pgtqgurglth8wkb;1:0jo1ha2j16h67hb9hdaj4ch6dj1gfqhh1jmdoh1ph4qm2vin;1:4m1aipbh3jhfmjmoh8pipqhbwh6;1:cjhrin;2:6hd9imtjdujsvhc;1:8gbagsel6fizgil;1:9jagj2;2:bj1ljr;1:bj1sit;1:8h9rkf;1:8kn9izah1ejdjj0piwsjkth3wh6;2:8ixdim;1:7h08gbjjfmjjohbphaqjwwjo;1:qja;2:air;1:hj9;1:5lujgokl4rhgwhd;3:8j7;2:ahffj1oiv;2:cl1;1:1m74io6hghh6uf1vn0wh9;1:9jprgq;1:vin;1:7ll9hfbhfkhelkyojjpgxthgwhb;1:cipdhbejnfhawje;1:4iu;2:4ioril;1:1gl2hf3hg5h58jyahfbl0chddg4eiqfj2jgfkgplgtmhengeoh4pgjqglrncsk5tirulqwh6;1:9j1;1:9h3cimrjr;2:lj8ph6qldwhb;4:6j39heah9bj0cj1gisjgtljanioqhesj4wik;1:3hf4kn5h78it9hbapdbjmcgvffnggxhhakh6mhcoh4qj9rj5tgmwhf;1:wir;1:qiu;1:vip;1:sip;1:aikviw;1:4jt8j49j8bhecniehffh7gherhawgz;1:4km;1:7k2thf;1:8hc9iolhdwkq;3:1inwk7;2:8j3bhgehefjsjhb;2:3im;1:uij;1:sj4;1:8iv;1:8ishjcjjgmh5rettk9;2:9j1;1:hhgrjb;1:diqehc;1:3ip7fx8h59iswkl;1:wiz;1:7ik;1:1h69jlajjfizrjd;2:njh;2:0ji2ju4he5j66kh7hb8hc9jkbiqch5dgzeh3ghahk5ihdphduha;1:9j0ehe;3:ijy;3:riw;1:bizkjc;1:0iw1g73o04gzeiptio;4:4ik9iwgj2;2:5k7jhamk9;1:njr;1:8ix;1:fip;1:0hg1h33jpmjksimuggvkl;2:8j6ejw;2:9in;2:jijogfplb;1:6hf7jm;1:minpj9;1:8hflj0risuiv;1:diw;2:1hg3h87h48k49grch8dhgej5gj3hhgjjnkjtnhephbqh5rgsskpthguj1vj4;2:ajc;2:9in;3:kg6lmcnjb;1:0gh9ileilijn;1:firwil;2:dj1eh6fjcujt;1:6hg8gr9hcdjrjioqh0rjeshduo1vfvwh5;1:4in;1:0he3je8hb9hdejifh2glehh5khbnhfoj0pgwqh8rkgtkgugyvhfwgz;2:dirtj7;1:eitmil;1:hgvrja;3:9ijjhhpiuwim;1:eizgj9;1:4iw5k4ahgghghj2jikmjgoh8pgvqh6rjm;1:8gi9lm;1:9jy;1:8jn;1:eitiiq;1:0is;1:hjcpjc;2:lixrit;2:jhdwjg;1:biudjgehf;1:2iv;3:1hg4hc7iz8ik9k1airdklekrfg7ggfhh8jj6khemh9pharj4sjmth5ugovhbwgr;4:3he5l26h48f39mgajbbhfchbghdjg4kh9nipqk2th6uk3vgawj6;1:8he9hfhh5qhetoxwhg;1:hh2jkupjiwh2;3:8gh9kcbjrmk9nixplgrh6wfl;1:1h85j87h58hbfimgglkitmjrnm1oj3pgpwgz;1:0gz3hf4ky9gjaj1bkocgodh6ejifhbghgigyjg7oixqjvrjlsgxuk3;2:jjmnivritwhc;2:0iy4ip5j8bimchgkh4ohhpj0rhf;1:7in;1:9heak3ej0jjoliyqjirh4;1:wiu;1:gimkmalg2;1:pj7;1:aijeh5jk0mim;2:dikegwgixhj6tl5uizvik;4:0k41ik3js5ik6hg7h9agucipgh6iivjh7kh8lj6mhhnj4rgusimwh4;2:1hg8h0bkbjhbkjuogivmrwgh;1:jiq;1:8hg9j0;1:njcoilriqwiv;2:8g99l0;1:jj2;1:hizkjf;1:hgtjh4qnithf;1:cja;1:piprjkujn;1:aktbg5;3:sjv;1:7k38h59gxej4fiyhj0jk1sgruh0;1:wim;1:3h54ga8hfhj2imgpjq;1:8h6bkqjhfrj3til;2:4jt8j19j6bh9co8ehffh6ghfrgpwh2;2:aj7rhc;1:kh7njj;1:8im9hhakcbiqehajj9oixwhe;2:2j78hgkj2;1:cin;1:ajhbio;1:bjlcj3rhf;1:giz;3:3h66nehgxjh8rlytga;1:jiw;1:dj2rij;1:1isgit;1:nj0pjcwhg;1:uj6;2:til;2:llinh0;1:lj4ogzrh1wmq;1:bjv;1:9jocivtik;1:1jy2hg3h97h48il9ggajybh2cgudfyfk0glhhgtjggkkzlkomgzok6pj7re7th2uhgvh8wh3;1:pin;2:cijhhgtiu;1:uk0vh6;1:ojh;2:wiw;1:fjthh7qjl;1:9h9gixqjv;3:jhcsje;1:8iyal7bhdcj1gjdqjkrgksg7;1:ijn;1:wj0;1:0hc1o26hg7hg8he9jhbhecgzdlgegnjg1kilmhephcqh9rl7thewhb;1:2hf4nm8gxahgch7ghdjhelkkmkrohgujzwgm;2:9iv;1:aiwjfyqjqwkc;1:0jg1g92k33h16k68ma9k9ajfbfzchcdfuellfg8ggohgtihajegkgtljamh1rh7sgwtgtuh4vmgwhd;1:1k9khalh9nmkph0;1:ojktjs;1:2fg6h27l98jjfiqkiuoh3ql2wgz;2:0hh5iv7h48ix9grahbbh0ejcfjwghdhh7iiqjk5kgylh2ngnpkgqlvsh6th9uh3vhcwgw;1:chbris;1:2go4jmjhdujfvk3;1:jis;3:0n91j23hc4k39hceiokiulhcphdqherguwh3;1:gil;1:wjs;1:tmfwiq;1:2ls4h96gunhhol4pkbqh3rh3wiy;1:jk5;3:8inbhe;1:8haaivcilfh8gmoqiusjpwh4;1:iiu;1:7h18irbjpcjyeikglerh8wgm;1:8gt9k1ehaqiq;4:uhaviv;2:giuoj0phevjc;1:gin;1:6jd9imeirqjvrh6vgqwhe;1:0h93je4jn6hd7ha8g0bixcixdhgelmfixgh7ihglhhmhgoj1pgurh2shfthdugsvhdwm6;2:lkh;2:1ki4ikijargq;1:2k76gw7ix8gwcindlheirgg9jhclh9nh2pjzthewhh;1:4k68gp9h2tk5;1:gjohimjhgpitrj2;2:1imuj4;1:8h6dk8ejc;1:jiq;4:8io;2:cguij1mjdrjfwhf;1:giz;2:1gagj3jizwjs;1:8iw9g0aj6ejakhbml2ohaph6;3:0h16hcah3djaehcfhegmnhh5jlbkh3ljvoh6pkdrhdthfwgj;4:9iytkm;1:aiwfhe;1:0iq;1:il1wha;1:kja;1:8iz;1:gjcjhcmj0ohhqjmwhb;1:win;1:gj7;9:ojn;1:8ju9habk6;2:djd;1:ahcdiwojx;3:8h89ipal5khfnimoizpiqwhf;1:1kb2gqwit;1:9hctj7;2:4j2;2:8hfbjmghchhbjhcqlltlpwh4;1:hjhrjg;1:2h53l88j69gwciogh9jjipilqhfwiv;1:5ijviu;2:fikqil;3:miz;2:cjaggrtjeuhb;2:wjp;3:3iu7iv8kmbjicjadk2egijikqhhrfe;4:vik;2:niq;1:3hd9gtdkeelqfjqwgw;1:rimsj4;2:8hd9ipgikwjd;1:cj2divjk3ok5qh6rh4;3:8j79ikmir;3:3imahcdheehffo7hipjik;1:piz;3:1hf9injjnrk5tit;1:eiv;1:jhdsjmth9ullvha;1:6h9phdqld;2:aj3wjx;1:cijoldwit;1:rik;1:8iv;2:sj6;1:5ip9hedhehirjjcrji;1:0j16k2;1:aimoji;1:9h8uk5;2:0ik1h83gw7h7ahebhdcg5dl2einggujlcliqmheoitphbqh5shhuhawkq;1:3l5kimmh1rkgwgv;1:jin;1:chghl7ijbpil;2:1j88h59h5bizchedhafjukislizniophgqhcrhatjtujmvhgwh4;1:1j1;1:0j72gj4jijh5ol3ujcvk0whe;1:ain;1:8ivjgprkesjlwhf;1:1j32iv3gn4gs7jj8io9g6afebhfchcehcfh9gh5ihdjfmkm2lkhmhcnm2pj5qgnrj8siwth6ujvvgpwgu;3:9ir;1:ajhfjh;1:girhj2;1:bin;1:9j8bh1einfixghekk3;1:mik;1:njopmuqhdwgt;2:mnyrgrwhf;2:0hc1h43he4ha6hf8h9cinfgggj2hjtijpjkikjcnheokepjxqgzrgzshetgm;2:1hdqhhwjp;1:4j3;2:qk8wh5;1:cim;5:iiooivwjg;3:dip;2:1jc2k43jd7im9ggaisdmoefsgjyhhfjlhohephfqh4rggsgzuhewfp;3:qilwkj;1:oj7wil;1:uj5;1:1k18il;2:5ipumcvgs;1:4h56ha7hd9hfbjqcgmdhaghdjlomj2ointgzugkvmrwjc;1:1iu3kbdij;2:1iu2k43hg5kc7hb8gc9h5bn3chfggihhcij6jj1qh0rjrth3ujpwgr;1:0lm9j5whd;1:hj2;1:9im;1:0hf3h74im5h46gs7h48gu9j4bghciseiwfn2gfshgjihdjh4kgnlinmh0nh8qjprjztkzujrwfs;2:2kg8hdsjrwhb;2:0h51hg4ik7jd8ivfhaghhjg8kjulgnmhgnl1ohfph5qhgrjstj3;1:1h34irahbrmewgw;1:lko;1:9j0oil;1:fjq;2:1hf4iy9jtajujh9qk0rh8thfuiswhf;3:rjn;1:0hf2ik6iz9k1aiybhfch5dhgelhfg9ggzhh7jhemh8phbrlfsjetheugzwep;1:1h9qn5wgy;1:5ixwjb;1:6jksk7vgz;1:5k9pin;1:aizfjchiorh3;1:2kj;5:hh9rk5;1:1kn2ha3hf4h35hh7he8h39gmcjldg1eh9fhagikhjojg7mjdoioph5qh3rottk5ugxvhd;1:wj6;1:9iq;2:8jkaikdl1egv;2:8gi9l9ajydjyfgiqitsjcuhfwh6;1:ojp;1:dilwj4;1:0h81g72jg3gw4iz6hb7gq8geainbh8dh3fhdhhajkxkgplh0ngxonqpj4qkhsj8ugxvhc;1:fiojik;1:oiz;2:0hf3gj7hf9gragxbgwch7fgfhivjhgkjdlkgmhdnj2ohcpiork8ugwwjp;1:6je7h7ahfbjleipphfshhvkz;3:4io6jk7h8bgldjnefpfk3jm7rj2wgt;2:wiv;4:ajpfhekhc;1:8j1dh2ekr;1:wj6;3:rin;1:8ha9kxbireimjhe;1:cj9dja;1:4haijcmlfwhg;2:ciq;1:kjpnh1;1:4it;2:aj7;4:uiz;1:ejejje;1:uh1vkpwis;1:7g8wkf;1:gj5;1:ajxkhankj;2:1io4iuchgkiwlinniuohfpir;2:1h44hg8h1algcj6jepkg1lgbmgtno1ph9qhgsjatjcwk1;1:fir;1:ukavj6;1:qim;1:ijarkl;1:ijh;2:1hg3jt6ju8ilbh7givjgnoh7pimqnhrhfuh9wgk;3:7g8giqujewk2;2:jjfwhg;1:8h79k1aqgbiuchcdh0eh1fhcggyhh6jhakh1rgqskuthdujcwgv;1:bisqjh;1:8h4qjaujh;1:jj8;2:1j1ch5dh4eh7fiugg9jhcqjlrl2ujh;1:8h99jreh1qkxrj8whd;2:qj0;1:wjm;2:khdljf;1:0iw9h1diteizfixgh3kgxlkkqhhujjvjj;1:6lw7he8ivainbj1ehchkejh5lhgogcpiqrgfthcwh8;1:gje;3:ahgjj9;2:silujv;1:8hegj2tl0uh2;1:ojd;2:1hb3h04nh6h57gt9hdaj9bhfcgmdj5fhcgkmhkrjixkgsmjjpg9qhgrg0tgtuhg;2:8in;1:nil;1:6j1diyeh2;3:6kjphd;2:3ha4ir7hc9gnakdcmwfgzggxhh4kgwphaqh9rl3sj7tirwh9;2:8jibh5fiwuim;1:fkitis;1:finhfwkhcnjmqkawm6;1:1hb3lh8j8akibhgeh5fh8gjmhlojgznhdqj2riksfwtivvh3wg1;1:1hcbhdgk8hj1jgtqh9rj5sl6tiuwhb;5:bko;1:wjj;1:jin;1:4jgmheoh9qio;1:0hh1he3m96h87hf9glbkdcnseh2ffkggqhjyjhfkkkmhcnhdohdpgwqgnrj4uhawgi;1:ehhgjtuhd;1:1hc3he4ha5l09k2ajlbfxchfehafkdgh8kiklh5mhgnj8oh8phgqimugswja;1:6m4ph9qhgwh2;2:0j9;3:4jz8j2ciqqjtwhf;1:hiw;4:1hg2hc4n9ah0gjcoiuph9ukcvhdwh0;1:0he1hf4m68j1iiwjgckhbmgbnhcomhqjatj9uhgwgw;1:8ja;1:0ko3gy4gk7hbaj0dineitfj0ghdhj0ih4wjh;2:8h3chdem6hirjhfqizrhetgxwju;2:7j6eh6rjd;3:4iu;1:3lg4io8iqbj3ch6dh6fh4hjpjhekhcqiqrh5sizth6uh9;1:hiw;3:4j4;3:2il3hd4he5ju6h59hgahebkscgyehcfhgghchgfjj7mh1ph9qj0rmxsh8tilugkvg1wk1;1:1gv2jr3gh4h35jc6l67hf8ktakpcinfhgkhdmhbnheoh2pgxqjkrgasgltg9ujevha;1:2iv4gp5hh6jh8hgahgihbnhdpkguhb;1:bhdjj4kkmmheoiopjvrilwh3;1:9jgcithhgjipuiw;2:5ij;2:aj5;1:8kj9irjjlthf;2:ah5fitgjehizjipnjksit;3:jn0rhdwhg;1:lis;1:jhgrkb;2:0kx4h0ajarh4;1:pk4;1:8j4hgujkomjqwhc;1:ah0fkulje;2:ahgmhaojzpk7sj3;1:ijmrh5;3:tiy;1:8ij;2:sjm;1:3kcfh2;1:8h6cjf;2:3gm6l98iu9k0ah9cj2gh8hh7jiqkhaph5qhcsh9ujwvjwwgw;1:nj0;4:wir;1:tjg;2:djk;2:tkcwhg;3:0h51gx2hg3gw4h76jk7gn8jj9ghagibj8ch4ekyfjjggphj9ihfjg5khclh5mj4ogrpgnqgbrj3sjutkvujcvkjwg5;1:wjx;2:jhaqk1uim;1:4isfiljj0;1:6t08hdahcdhfeh9fh9gk9jhekhflilugyvipwf3;1:7iw8ikhhcokl;1:aggljspjasjs;2:0h91iu4gz5h06gy7h49g9ahabh2cjqeg3fn5joxkgslhemh5ogvqhfrhbsgstiwugyviuwjl;4:jj0;1:ajhjgeolkqjzuha;2:filjk5lhcph4qhfwk1;1:6heuh9vm7;1:1h28l2kh7;1:oim;1:gjntja;1:4jj;2:3itake;1:qkmwh4;1:2is8hdajebh6hgtjj7qkfshe;2:siq;1:ciq;2:dim;3:giq;1:cij;1:8jxnj5qhewkk;1:dji;4:5ld7heah4bj7gjtjh0phfrjpsh9wh2;1:7h68hdagzdhgfklhhfjj6qkorjttk7wgh;1:1j82inrgz;1:dh8jjs;2:8ip;1:8kd9h4;2:sjg;1:rit;3:8hhjix;1:cjphjtrim;2:5io8hadjiemifilghfjh7whc;3:9jiihfoj0skp;3:oj1;1:bkjfhagjohjwojq;2:8hc9izwk9;1:3he4he7ha9h4ajfbkgcisehgfhehgnjh5kkclmsogzph5qgzrk9thguhg;1:1gx8jiahbjivrheuk7vjnwjx;1:6jnvh1;1:cmyfhdgh9hhcqj0rh4;1:6g9aipojnvgxwld;3:1k7jkkkgzwh7;2:biohiujh3njorjkwj8;1:1hh6j0jgekh0lk0wn6;1:wiv;1:0jo8jeih5sjb;3:9inein;2:ail;1:hiq;1:2im8js9iocjxrgwwin;1:3ip7fxwkm;2:8kj9lyegx;1:4ivagrbk6ghfiji;1:2kj7hacjorhg;1:uik;3:2jv4it8ja9habgzgj2jgtkj5qixrgrwji;1:tk0;1:nj4;2:0h83gm4haahgbhfhhgip8jhdrj1wjy;4:2ik;3:0h83gr5h87g58k09hcahbbh6fgvghfhimim6jmykhgnj5qjiristh0wga;1:fip;2:8kf9g0ch4girjkeuikwh0;1:ehhlhdwkq;2:8jzciqjjirhathe;1:iik;1:0j2gj3ihcphbqlkuinwh3;2:bkpfh7rj0;1:cj1gj0jhgsivtkc;1:bitjljqh3rhgthgujuvh5;1:aip;2:8ipejf;2:fil;8:2gw8h89kvaipbiqeinjhaojjwhf;1:rje;2:8hdehhhj4jjbkkdmhewjv;1:cipkjprhc;1:8hddirgk0oisphf;1:8h3aijeh8fh5lkamlqnh7ogiph1rh9uh4vlg;1:fhagjrhikkmblfx;1:2h57j8;1:mj3;1:3klqhg;2:rikuiy;2:1kbaimrguwj0;1:0k51g23ko5ha6h27gd8lw9kfeh2fgkhgwiijjg1kfylh1mggogxpiqqhesiyugzvhbwn2;1:bkbjhfwkf;1:0he1h92kc3gs4gm5he6jt7h88iobiteh3fh4gjuhh4kh2lgzmh9nhcogmpirqjqsjmtgxumbvkzwet;2:bix;1:jldrh5;2:dgnejkhj6jgz;2:8j79h0fhfhiojgxkiwpitqhfrj6uimwj3;1:ah4fjpjkzshcwhf;3:kjkpjf;2:3ji5h07je8hfqk0whd;2:8hdbjn;4:3gyaj7cj5dgweh6ftkhhejhdkg9ohgphfuhgwhf;1:qio;1:8jd9hd;1:ljuwh9;1:qj9sim;1:4ir;2:qim;1:6ofajseh8hipjheohhqh7tikwgn;1:fir;2:8h5aj6gh8sk2;1:giv;4:8ggbh7chgeh3hn3jhgmjrthfwkk;1:1jk;2:hgylgern2tjp;1:6gw8h8um8vmuwh1;1:3j09iodh0eit;2:2iriitqkk;1:giz;1:6hf8jscj5gjkhgerjjtj9vjxwh6;3:0h91k03he4gr8izfg5gonhhejlmnheojoph8qgush0uhawgb;1:3gz4iqaj9iimjjemloqh9sj8wgy;1:2kd5klmjtngh;1:uj7wjv;1:9in;1:aik;2:ehgjlfwhf;1:wiw;1:8j69jyekbfiljg6pkqrh6sk1th2uh4;1:gh8rk9;1:cipjiu;1:uim;1:fjomiqulgvh4;1:oil;1:qjd;4:aj9ch0jkhmik;2:bhffhggj8ijnnjhriy;1:eixojq;2:4ixjhcqjy;1:8jubgv;1:ajegil;1:lis;1:8itjhdrj8tk2;1:4jcaiwfheggphheiirjhckhfnjhohfpmlqh3rjbuh2;2:1ip5iq6ilgh5hh0ihgoinqgi;1:2fq3h96l5direh6jjnvj0;1:7ip;1:4it;1:0hf3hd4hf7hc8km9hdbjvcj6eg7fgyik7jgckkomhanhdoj3ph6rgptl7vhawgb;1:8ijgjl;1:2jt4gt5l46he7jlah4dj7egnfh6jgvnjaokkpgzqglrh9th9wjv;1:4ip8hb9iral6uha;2:bilvis;2:1jn2ip3h96ik7gq9imajsbh5chbij7jldkjjmh8ngjoh0pgwrjcshath3uh2vhdwhc;1:9hebgfghdlharqi;1:4jj8ioch7jjvwjg;2:fix;1:9hadkkegu;1:lkm;1:aiwpjl;1:4inaittgxuji;1:4j8;1:1j0tiq;1:wkg;3:gis;3:bjcdirehgpkb;1:tjo;1:5j2;2:bj0mjl;1:0ilghejhdmhboj2qjrtjjwjy;1:phaqlewhd;1:8iz;1:4hdaijolu;1:ril;1:2ivalldhbegufksuhfwh9;2:bjlcj2rhf;1:fim;2:4ip6k47kudhbpgsqjmwgk;3:8h6gjy;3:1ip4iqeil;1:sik;3:5j6;2:0h93m3whe;1:aiquj5wj8;1:amdfglgh9pl6;2:3kb4j98h7bilcilekmfhfgjihitjh4rhduhbwhd;1:3j28hgaip;5:cffrl3;2:3h87hc9iuahebh7ghchh1jjmpj7rm2uiwwj4;1:bkjgil;1:0isfkv;1:3hb4h35lt6gz7h88gc9h2aikcjbfixhjnjhflk1oj7phbqh9tizuhewgi;2:fim;3:8imkjorhc;2:djyehejh7;3:fil;1:tiu;1:8kc;1:olgphg;1:eir;2:1gh3im4ha5hd7h79h2agrbjdcjddjcejgfhagivhiwiisjh2kh5lgvmhfoixpgqqgorlitivuh0;1:gji;1:gj6jiv;2:3jc4imbixcilklbmhfwgy;1:ah8divkh0ln5okxpgztio;2:cishjbrh3;2:oj6;1:8io;1:1kugh7liy;1:9j0qjqrhd;1:jockirqhbwhb;1:jiy;1:fit;1:jkp;4:4k2jjlwgi;1:3il5gu7he8j99h3agucj3fimggxhiqniyph2qkitgz;3:1gx8h7glxrh7wiq;1:8k3dh8ejkpimwk6;1:3iu8jdil2;3:7jdojw;2:jj9wh8;1:eirok7;1:8g99nlaiybhcdiuemifgogh5hhbqh8rgpsjawh4;1:ujd;2:6jlpjbwh2;2:1iq8h7cjyjl5qgxrhaujgwjg;1:6hf8jj9goegsfhgghfjgskhbojdph6qm3sistimuj1wg2;1:4jl9j3blbciywh6;2:iipril;1:5k58hfcjjdhdejgfh9ggphkhrhgwh9;4:eio;1:0h91hg2k23he5ix6hb7h2agabhgcgtdjgegdfgqgfwhomihhjltkhbmgxnhaogwpgkqj3rimuj6vkqwgb;1:6j5cj7rim;2:3g08jncm2eh2hk1qh9rhdwjj;1:jji;1:7jb;1:0jj3ir8gvgkpqkd;1:ahdrjy;2:3j1;2:9heah9gj3khdnp2pimrhhwhc;1:3he7heahbbiodhdehefhggjujncphgqh7rjdtkvugywgs;1:ilgwhf;4:0j5;1:tipvjq;1:hip;1:1gq6h38jd9iqairbk4cgwfhcgj6hh6kh6phaqhcrg6shgtheujyvjywm8;1:0jj6jv8j8bh8gj2ihewga"}/*MODEL-BITIS*/;
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
