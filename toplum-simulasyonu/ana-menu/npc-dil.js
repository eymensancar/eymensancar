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
  var NIYET_MODEL = /*MODEL-BASLA*/{"tur":"lr","b":15,"c":["selam","hal_hatir","tesekkur","veda","tebrik","ozur","evet","hayir","is_ariyorum","eleman_ariyorum","maas_sorusu","meslek_tavsiyesi","kurs_sorusu","mulk_satiyorum","mulk_ariyorum","fiyat_sorusu","ekonomi","kredi_sorusu","bayram","dert","kisisel_meslek","kisisel_yer","kisisel_ad","bot_musun","iltifat","hakaret","saka","yardim","zam_istegi","yetki_istegi","teklif","oneri_kabul","genel"],"q":0.010929,"w0":[18,0,-30,18,13,-39,12,5,25,14,-10,0,4,11,-30,23,20,-25,-62,63,8,-37,-41,-32,5,42,50,6,-43,-3,10,-118,121],"k":{"lambda":0.65,"beta":0.5,"g":0.5,"T":null},"d":"4:5j28gy9jyuk9vh5;2:dik;1:dhdejf;3:1hg2ke8fu9k7agsbircljdh9ekjfilgjbhixjh6kh7ohdphcqhdwgx;1:0hg3ha4hc7ha8knfhcgh7jjlkjmlhgnhaojkpixqjtrheskithbuhgwh7;1:1hf3hh5jw6hfajpcitjgzqn2rgzwja;2:ej7hh7kgmnl7;3:3l3gk2;1:tjz;2:8h1ag6bhdehcfgkgljhmxjgglh9qngrintinwhc;1:2lv3l28hbaknbh6fhfghgjh0nh4qh2rhctmwuhgwh8;6:8gxbh9eimgiqhipkkzukf;3:tk9;3:giz;2:pku;7:1iv4hg8ja9jcaj8fh2jh5khblh3nlaokipjwqhbrhfuhewgo;2:bjarlvwgy;4:7hd9hgcipjofqlwwgs;a:0gm1jn;2:rjr;3:rk3sl9;1:sit;3:7frjll;2:bhhcj0fmi;5:2he6mf8hdahfeisfk0giyhk7jhcphgqh9sj8tijugnwh9;5:3jpjky;6:tja;1:8h19kabj9ciyehbkkw;4:9h6ekn;3:tk5;4:2l84lgiirjha;6:0hcdhfek5;1:1kq8isrh2;f:cjjdfyekb;1:cis;3:1j1;5:skv;1:jh7oh2qmi;2:cjrdjdehcok4rjm;5:khcmmmoh9ph8;5:7l8djqehaijlwh7;4:2im5in;6:dgrejq;1:0k33hg8hbbhccjtdipejcfhgghahh5jhfkk4rj2ujlwh3;1:1ks2jo4jcbheglmjh2khglj9oherikuhdwgj;1:1ip2hg3gy4il8h1ah9bgdch7fh4ghahh9jgjkkllknnjmonvpklqgtrh2wg5;1:8h5akxfhf;2:1kw2jn4jbaj1bhdchcglthhfjh0khglj7ohewgh;1:wkj;4:jjbsjn;1:9j2;1:hktrj4;4:4mcahffkt;1:0kl4iy6ha7he8iq9ghaj2egzfisgkqijukh9ohdph4wgx;3:0h53k7ah4bkzeh1fkijhg;5:dk1egh;2:wky;5:8h29hgbkofnhgh8;7:wjm;6:oj4;1:ohgqk1uj6;1:8imaggejnfhbgjkjh6sqfuhg;4:rjs;1:1hdclrjhdqmfrgmsheuhfwkq;1:6qe8hfeh5;1:kin;2:0hg1gx4hh6he7he8lv9inal0cj6eglfj2gh1hivjghkgylhcphdrjwth9ugvwio;4:ch5fkt;5:0k0ah8fhaghgnj4qjvwk6;3:0ip;1:clajjjrgy;4:8hfkmvlgkrh8;1:biu;3:7jt;1:ejr;7:4iu8ipjjkwh6;1:1jb;8:6fvwmb;2:1h7kj2;1:pjwsj6;1:2kc4iy7jy;5:eiw;2:1j1;1:4jw8h5ah4dj9ej8gh2igsphgrjhtjkumrwh2;1:bjj;5:1in2j73h64h65hf6lh7j9bh6dgthj7jhbkj1mhdpgzrgtshetksuh2vhe;4:2j9;2:bjetjx;5:4p0che;1:1kk2gg4hfkjfmjsnh9ogvpmk;4:bjl;1:0j5;2:ojx;1:hjm;5:ah7fgqgm5jhesj4;1:djfeha;4:2iu;1:0jrck1dhgehffkyghbsjd;1:0it3kp4j05jmghejh9nlwphcrhhwhb;2:1h63hf6hg8gm9h5bh8dlaejgfk1hisjjokhfphdshfwh2;3:9j4ijz;2:ij1;3:3hd8h5bhgch1dlrekkjkalj0wij;4:9mbbhddgyenz;2:jkuwhe;3:8ip;4:9it;5:plu;2:8gv9jgdir;8:pkm;1:5k6hirijnrj2;2:1h64k4ohgwm3;4:uj7;1:jgvpl7qoawhc;1:4l1ah8;d:jl4tjr;2:1h0rk5skr;5:cj1jgyqkf;1:9j4pjy;1:4kp8h2ah3cjedjvehejhdoherjdsktuh5;1:5izdhdejd;1:8jp;1:agmfg3grmhkyjhewh9;1:dj8eka;4:jjx;3:1hc2hd3jt4j48h9fhfkheom7phbqharh5wmp;1:jkq;2:2k3;3:2jc;2:qmz;4:9iu;1:jkm;4:8ha9lzckvdjaeg5fgyghejhcrhdsiktjmuim;1:8iz9k0ajobk6cj3egvfhbghgkk2nhfphg;5:ejr;1:6h97hggh7ohgphfqr5rk3wgj;2:5ilgj2jgpmk1rmgwhe;2:bj5;7:1l43h84gc7hg8jb9gxaizbjcehefisggyhiyijgjh3lh8mivnhfoixpguqh4rj0tgzuh9whg;3:djp;1:ehgfjt;2:1oqrgr;2:0h34jb8kh9h8ajedjvefvfirhitmjcrjhth9wha;1:dj5;1:0ld1noahgbhgfh5gjyrhdwh8;1:4j2cka;4:cj7hjm;4:8jcfh7jjrkhamioohgpheuj9vim;2:flv;3:2g14hf6he7r7niqqhg;1:ck5;1:bjh;6:5k0rj6;5:5k28hbuk1;6:bkf;1:8iq;2:nmrohfphd;8:ck0;1:dit;3:ggvjm5ohgpkd;4:dhhejy;1:1iv;1:ilt;1:4ni9is;4:8jw9gzcl5rg1;4:1h33lmpkb;3:ciptk7;6:eiq;1:0h84hb8h6ajpbijdileh8fj4hj3iiqmjlrjs;1:tjf;9:3iw5it9h9biochfdkgfhghjrjirkhbnkfphgrgqtilwha;5:0kz3hg7hf8heagrbiwghfhkvjgxmj7qiurgttlewh8;3:wl0;1:2jchj3uj2;3:fjo;4:bh9khfllf;b:ak0fh7sj5;6:wjp;1:2kq3hf4ms7h8ah4bgzchfdh8fhaghgildjgxlhfoh7pj3qh9ujmwh9;2:2j1;1:jhfwl1;6:ahcfjw;1:6nhjj6wgy;5:jhgwl3;1:9iydin;6:ahcfjw;2:5ka;6:8he9ja;2:al6hiqjgzqj2siv;4:fir;2:5kr9hgah8bhfcj4hg4jn8qhdrkzsh0wh2;1:qjr;3:iip;1:khgngupob;1:bk4;f:0j5;2:fgnuk5;2:9lgahgcko;1:uj4;2:wla;2:jheqjb;3:8h3bjeul0;a:nmephg;1:8jj9jlaixbkfchgehdfipgj3whc;3:ajxbjajh5ritskk;1:0he1ik2j64jj6hc7h69ikbixch8diqhhbjk3khcmhfoj5pj2qh3rgqshhtheuj0wg8;1:8ikal4;1:bgtkls;2:cip;1:jkp;3:8h89jotjy;4:ah4fheom3;7:eiu;b:aj8rhdsnswhc;1:dik;3:1gu3he7he9j3aiybhadj1egefh8gh7hhckh8ml9ohgpheqkirmbshctjcwgz;2:1j33hb9jrakackmdhbegzghehhajh0kkmljcnheoiwphbrgltheuh3wh5;2:7haongphe;1:qkw;1:kjn;4:wnu;2:8ha9gjdkqel2;6:lk7;1:2jdkh9nkm;6:dhdejf;1:1hdrjm;3:8k79gt;e:0jq;3:1j33gr4h75jm6h57gd8jrah0chadhcehbfh8hhgkgrlhamiwnkeoldpjvqglrh0th6uhawjs;5:jkb;2:2kj4ghdkvegtfh3gkhhjamit;2:2k36h97iujhboh8pksql2whc;3:cjt;1:9iu;7:uj0;3:1j55hh6hc7h68j9agxch1dgwfkfghdhh9kixlilnkmogsrhfuh7wki;3:1k7iiqkgz;1:rj1;3:4k4hgtjkuokgphesk0whb;5:bjukhf;1:skv;1:hju;1:8fm9j9aq8chdehegh6hhcjhbpjkrh8sj2uk8wgy;5:1hg8gu9jucijdjneghjiyrlrtis;1:1j6;3:pkd;4:pkm;4:fkfiiy;2:lkunjltkswhd;1:dhbejm;4:tj5;4:bjlkhdrip;2:diltl2;2:jkq;1:8lq9go;3:1h82ik8ip9hgbhgfhchhgjk9ojeph9rlf;1:fh8gkcsiwuk1;4:him;2:hjirgp;2:wlb;3:7k08hg9h8bgaclkdgwemefj7jj3lhgqivrh8thdwgu;3:7hg8hf9hgafgcjjdh4el5jkbskn;3:8gx9h0ahcdiqeobgkljgsrjhwhe;1:4ki6hc7hg8gvgiwijeoncqhgwhe;1:qm9sh1uks;6:cip;3:rir;2:kgxmszwh9;7:rjytj2;2:1hc8h69gvag5bh8cxjdioeh6fh3gh2hgyjgtkilljdnhfphgqh9riksheth9uhewgv;1:5l9ahahhdjjarjhtj4whe;2:1pikeg;1:5is9gsdotefcghghj0jj7;4:uj4;2:4in;2:bmj;3:ahcfjw;1:3ivlj6;2:2hg3m2;5:jgupl6;2:gjb;5:7jy;1:fhfgjm;8:1pn7g7lj6wh5;1:0l31jd2h34gr6h58gm9h0ahfbhceh5hhcjh6kl2liqmjznk0oj2pjpqgrrhfsh8th7wha;3:dk6egq;1:9iu;2:ejm;1:ejg;1:gjs;1:2hg3m2;6:2h84o6;3:4jg;3:5ismiowkg;e:cj2;4:1j3;2:8j8;1:0jz3gz4gv5hg7h98gtajtdirgmkihbphgqivrj4thfuhcwgs;1:ajm;2:0gz3q1ih6;7:3n2aj8fh5lgurmgwhd;5:0h91h42hd3jf4ms6hc7hc8he9hhbhgchfehefimgh1jh8kgglgzojspq4qipthbuh9wgn;3:nj6;3:aiw;1:0hc3he4iz8h09ilahachedkfel2fjugh4jitkj9pheqhcwh1;1:3jrbizjhckhgnl7;c:hjwsjc;1:flv;1:8hgdjgfjsghejixkhglh8nmdoj4ph3;1:tiz;1:0gx1gz2he4ha6hb8j39kaahefj4ghfkgplhbmh9nj2ojrsj6tgzwhc;7:hjy;1:bh9ckd;7:ujv;1:1jcrhg;2:9jb;6:dl4egf;7:gkvjl9sh4whe;2:8jc;2:2l8;1:1jq2iw4hh7ha8gobhdehffhagk1hjijh5khdokdqljrj7uh8wgj;3:agyrji;2:8imohcpkz;4:8mj;6:djkrik;4:1h4djxegrhhcmlyrkj;4:4n7ihe;3:bhglhewl6;1:jmb;8:tk3;1:2ipjhewmn;1:ojopjmwhh;1:6k37iv;2:ql7;3:1hc4hg5iq6h17kx8is9h5aglbgwcj0diweh5hhfiirjm0kjsrilthawgv;1:fh3glz;e:aiqbmjfh7jhgkn6lhbwh8;5:wks;8:jkw;5:9hfahefjsjhgmk8wlf;1:gip;1:kk5;b:iiz;2:rjt;6:tkz;7:mmf;3:mip;2:6oh7h8qhgwhe;1:nkp;2:0il5imijgrin;2:0irijo;2:0h81hf2h83gy4h75hf6ge7kb8h5airbgwcindh5eh4fh1gjpmhenhhogzpikqjsrh1squth1ugtvjiwgf;3:8js;2:0hd1h93hg4hc9hbirv;2:olephg;5:wjg;5:1jy2llrh2;5:0n56gw7h1jhfpf1qh5wpq;6:5jg;5:dhaeju;3:6ko;3:amyfgzuj8;7:9is;1:8ix9jobh4cjceh0fiqkkv;2:aj1;3:0jg1ha2h63k54h85jo6lv7h9almbh3cjtdhfeikfhfhhejgvkhcljmmhfohgph3qgtrfxth1uhawgn;4:6ln;5:5kojkjwhe;1:ljo;1:9hhakrbhafkrhj8jh1liloivrh1uh7wh9;2:al3uhc;1:jlk;1:ina;1:al6;1:ljfmkq;2:0hf1l93gz7h58hd9hbagvbh7fj0gh4jmxpljqjerhawgo;7:ij3;1:nl2;8:ck6;2:2jt5k7bivngyokf;2:jl5wh3;2:0jb;1:6ji7l1qhbwm0;1:8h5ah3cgqfnjghchlejhfqjnwha;2:gh8jgpohfqhfrjqtnlwkr;1:jgypld;4:0he1kd2lz3kv4kd5he6jj8ha9haahebh9chgdhgehdfh1gh4ihhjiokgzlitmhfojdpgxqglrgpth5uh6wip;1:0g81s5rglwh3;5:uj4;4:5lxrgt;1:rjl;2:2kx4k2;1:7lvwhf;4:eik;6:4kgihd;6:tjd;1:1mfghgohdqherh8wm4;1:dhffjzkh8lowoh1;1:5io;1:8isdh1ejp;3:3hb6hb8it9jeahfcjvhjhmknqhcrhgwky;1:0jo8kw9g6dgoekfkjp;1:1is4in5jihgqjktplqrhfwh8;1:blheh2fhc;3:rit;3:4j69iudiylje;1:rj5;2:8h3chcdjjekxrkj;1:kjq;2:7oljgzwh1;1:8jg;5:3h95kt6md7he8gebh6dhceh7ijfjhdkhdoiwph1qh3tj0ulmwiy;4:ak1fh9sj6;2:2j5ah7kk5sj8;d:cip;1:eiujjk;1:jjt;1:jk6;1:5ipjgsmk3rmk;3:flv;1:wla;1:jgypld;1:6q38heeh7qizwhe;4:njr;7:pk0;4:ekp;1:pkd;6:aip;2:0l23h64le8hcahhcinejjfitghchiojhgohaphguhfwhd;1:ohdpk2;1:dj4;3:ckcrh0;2:0h78l8bl0khd;1:lmrnh2;1:rks;4:8hfakzhhhujo;1:bjhckukhgrj1uhf;2:0l51gq;2:cjk;4:5km8ikjhbphcrk8sk7tjm;2:1j6;3:9iw;2:8gvwm4;7:qjb;2:rjgwik;3:rkl;d:fgzujh;2:8gl9m1;6:rjw;4:5kx;3:dir;3:0jzah7fh6ghekj9nj2qjswk2;2:9it;3:klbmhboh7;1:9jqjh7qnn;2:jhgole;3:0hh1h54iv6hg7h58j29gqajabgxchfdh0egifjwgh5ihfjgpkmslhdmj8njfoj2pimqh1ritsh2tgyukpwgt;2:dio;5:8j8;1:lk9;6:dlf;6:gky;2:0h58jm9k8aj7biwcioejvfh4;1:agdrn7;3:9iueju;3:8isfiq;5:0f71hf3lv4kc6fxajngkujhdqhbrh9wlc;9:1h85hg9h0akycivfm1jh1mhfpisqiruhbwh1;2:hjg;2:gjb;1:qjq;2:fik;2:clswje;1:8jj9g7bizeinjhcmmguhfwk6;9:0h71hf2he4hd5hb6hc7hg8k19m9ah7bgmcjxdhcekogh2hjcjgwkh6oh8qiprj2uhcwgr;6:4iycn7;4:9jjjjm;5:0ir1nb2hg3gu4k16ha7ke8h9ahceixgh4jh4kh6lhcmhfnhfojfpjbqh8rgnuh9wgx;1:3kx9irnj9;2:oiy;3:4jiihfwma;3:7it;2:wjh;4:0m61hhbhaihfwm6;4:0h22kg3hd4j15hf6hf7ha8hgahfimcjgxkhgoh8ph2qh4rh2smuvmhwgp;3:6mr;3:sis;1:8lnjha;2:hkajhamkz;2:qji;5:2ik;6:5mv8h4gkqjhd;2:jkq;5:ukq;3:clchhgnh3pliqjwrhf;1:8h99k9;6:0h13he8h39nqah6dkmegvgj1jherh4uijwis;4:0hf3ly6hg8j39h6ahfbj5fjbgh3jhcqhfulqwhd;7:8jj;5:khank6okmphd;3:7h49hcehgjitmk4qhdrk8wlf;4:8it9j4ajbbkwcioegvfhdkkhnhgwhc;1:bjzgktwhe;1:qjy;1:1iv;1:bjv;9:ahgrjw;1:ejh;2:kk8;1:bhfhirrkl;3:0l23h64le8hcahhcinejjfitghchiojhgohaphguhfwhd;2:8hf9jadik;3:tjz;1:kkrlgn;6:8imahbdiseh6jk6rm9sh2whe;3:0ja4k85oufhhhj5iitjgrqhgrgjuhfwh6;1:8jb9gpbooehahh7rj4;4:1jr4ir8ik9hgchfgh4jjokmplh2qhfwha;2:2m7mjf;7:djqejv;2:wki;3:0hc1h83hg4hb8hfis3;1:tmg;2:5ip;1:1jpbh2cimdgyej1flakhdlj7qhfwhd;1:0kv;3:9j6;3:4lsjhf;3:rix;9:0he4io8gx9grahadn4eltfl5ghgjheuhdwhc;6:2he3hf4kk5ku7j89hfah9bgxcjffjqgilijijh3khgphgqixrgtwh4;2:pkhwjg;7:rir;1:1l8;1:3kh;3:0h91hg2hh4he5hc8me9mbah6bg0ck0dhfeksgh5hjejh0khaphaqh5rj3uhcwgu;2:5p88h29hhbkifj4ghhhimjhfkhgohbphgqhhth6wh9;1:0j3dj1ej7fj9;2:jgypld;1:alcrio;4:eisiiv;1:3hb6np7kk8hdehdjfsqheuh0vnowh0;1:1h62gy4is6iy7iw8iu9k1bh6chcdguejffgmggzhgwjh6khdlhgmk4nhfpgztlauj0wgm;5:wlb;8:ggjsjytjn;2:8heagyhnujj9qk0;4:jk6;6:bhfijglhewl1;2:9irbk9chd;3:1jk2kx3m64hg6hd7kz8h0ah8chffh4ghdjkyqhargvuhewfu;2:2iy3jr;3:1l5fkdwhf;1:gk2jjoqhg;1:jh7oh2qmi;3:0ju;1:8ey9o8;1:9iu;3:8j89h5fju;1:1iqahejm1rhash2;3:7l6;1:8jm;1:gkvhgzjl9;8:fjw;1:siq;1:5j1mkg;4:bj5mmc;1:8j89h9cj2eirfjjjhgqj5;1:6hgdh0ejkwmf;2:sj7;2:ajjrj5;5:ohdpk2;1:0hc1jb3hf4hc5ip6hf7h8ajwbgwcjvdghejefgqhirjkolheohcph7uh9wiw;1:wmg;2:iijujt;1:cjc;2:dhdejf;2:9kzbhddkeegpwhg;1:2in;1:1gm3hd7hh8iz9h4ajjbh4cj3djxegrghehjvjgvkikphcrn1shctjauhawh6;4:1k83kmljtwhf;3:wki;1:hjurgo;3:0hg2mf3la4ko6jr7in8hc9hbehdfhcgh9jgpkhfmhhojkpgyqgnrhfuhawj0;4:wlo;2:1meahefhejh6ql0rgwwkj;1:4jebjlckg;6:4mm;3:ukm;1:1gx3hd4iq9h8ageeiqfgugkyhmbjgxkhbnheoh9pjgqh4rj7smqth6wgv;1:0gl3l0;1:2kvdjz;3:rjg;2:0iv4lyhhhjjmwhd;1:8kbak5fgv;1:0lm1o1fh6gharhewhg;3:wk6;5:1gxch9hjxqj7rkawk9;2:0hf3ozahacjgffxhj2whf;1:1hf3hg6ld7heajkbh6fj4gk7hjnjhckjilhdmk5oheph9qhdrgxsh4wh5;1:0h91hc3h04ha5io7j89isbj5ch5divejhfioggzhinkgwmhfoh7ph6sj6tjewhd;2:iil;3:jjf;3:mlwrgq;4:8it;4:8gq9h3ah9drzejshhbwh4;2:3hd8mf9gvbgsqk6wk7;3:2md7kdgjrjjooh9wh7;2:fheglnhka;2:9hadk6eh8;3:8j0jj5;3:8kg9jc;3:0j91im2j35hg6it7j6bh9ej7fingh5ihajhfmhgnhepgyqhdshdtiuujgvhf;5:7npphbqh5wju;1:7m0;3:kjn;5:aiwfhb;1:1l22jo3m05jw6hg7h49heagydhegh0ihejjqkheohaph7qh4rgrthguhg;9:9jnbjrdipegn;1:jmb;5:5j3jjs;2:bjtkhf;3:8ixjhdrks;3:6l9jhaqh1rhculuvmnwh9;1:8h39pfagzfh8gjo;4:4kj;2:3gf4hg6qz8h39gljgvqhfthduh9vnnwh3;3:ciqojr;7:dj4egtfkoukf;1:fjo;5:dk8;1:3jm;5:2j8;1:5io;b:0kw;1:5ke;3:ejjqm5;1:0iw6pz8hdeh4jhbojkphgwhg;7:uk6;4:qlt;2:0m56h9;3:7ke;1:bj2;1:ak8cjarhb;1:1jh2ph3h64ha7l88hb9heahhbk0fhgghbjh9oh3ph7qgwriouhawh4;2:5jbmjd;5:0hd1he3jv4hg6hd8k59lwbkgcikdhbegrggzhhgjgtkiqnhfohgphfrh8thgukwwgu;4:qje;5:kin;1:8hbbktfkhkhdlh8nh2pharkktkquh3;1:4j8;4:aikojm;1:om5pfr;2:pkc;2:8j09k2ajpbk9cj5egvfhckk4nhgwh9;4:9in;2:lkf;5:2ltjha;3:5jf9iu;3:bh9kkz;3:bhbkh6ll4;2:rjd;1:rin;6:tjv;1:8gy9jusij;1:pnnwhd;3:dkuegm;5:9irgio;2:0il5im8jlakfbhechddj8eh7ggejixkhgmjlqk8wgu;3:5jg;3:7kvjhg;1:jk6;1:1kh;1:qkzsgt;6:fk9;5:bh9ckd;1:aiv;2:rir;1:0in4iuijorhdtj5;1:3nq;4:lj0;1:rhdsodwhe;1:qjq;1:5km8ikjhbphcrk8sk7tjm;2:1k82ka7m9djfehcjhhohcqh8whe;3:hjf;1:1jc2hf3h86hf7hg8gj9h5ak3blfdhaehcfj4ghahh2jh1kl3lmenhgoioph4qh3rh8thewgv;a:0iq;1:8imahbeiyfjhwkz;1:1gw7hc8hcbl8chghhfij9jhfmmfohfpk2rizwh5;3:cir;1:oj8;4:hjg;2:1ha9h4ah6bjwdhbehcfgpghbhl4jjdkjfmjsohfrklwgz;2:2munk3phh;3:giz;3:kmwlhgnh9phd;3:ahdfjj;1:blbeh2fh9hjr;5:3iw;3:1lnrhb;2:dj7;4:akhfh9;c:8h9jm6;7:1hbbk9gjbrkl;6:0p01jh2jk4h86hebhhihdjhbmijphfqhfsiqwh9;2:jkp;2:nkp;2:uj5;2:8isdh1ejp;e:9jj;1:1jarhg;1:4hcaj1dh4eh8fk9hhfjl2rjcujtwhg;1:0ju;1:2js;5:fjb;3:cit;2:1h2rkn;2:cja;2:jjv;1:1j1hj7rh4;6:ajrcgw;2:9gyahcchgeizfluhj4;4:8jh;2:kiv;2:cis;2:8k59j5ah5fjcjjmpk5rhfwh3;2:0gx1hb2j13hc4hg8gs9j9agbbj4ch4dkcek8fgyghgjj8lh0nhgohephcriwslktj0ugv;7:pk0;2:rij;1:ejh;1:tjf;1:1gyhktrkh;1:8il;4:0k71gy3h24hf8gu9jyahcbk3djweizgilhirjh4phdqhbuj4wh0;9:ahcjhcqjkrk3ujh;4:fit;3:8j1;3:tl3;2:ojs;e:2jt;5:8ir;1:ujg;1:4iz9jx;1:8j8gizjj2sjr;9:3hb5il6nk7ki8hdehcjfnqheuh0vnjwgz;4:0nuphd;2:ohcqk3;1:2il;a:2h54nb;3:jh1qk8wl6;3:kjm;2:4kbjitokwphgqhf;5:0h21h23h94gk7h49hbahcbhgcjhfh9ghdirljk1khcnjaohfpjgrh3th7wgo;1:6oh7h8qhgwhe;5:6lr8j9gjwnkpqhgwgz;7:0jmdh1ejl;1:pnkuiqwhc;3:8gvbkoqj9wis;2:ak1;3:diq;3:4j5;5:8h89l7tjw;2:wjj;2:hiujm9wgy;3:eirkk7;1:0im1is2kb4h96im7h18in9heahhbhdfh8ghhjhdkjpljrmk3nh4okuph4qhcrh9wgu;3:8jp;4:dheehffhbgkajkxokxphd;2:2iu4hd7ju8j2ak3dhaehffhejm8pheqjdsh2uhcwh3;4:6mjljf;3:8jkdjc;2:6h8phdqplwh3;6:8hdblkghbqjm;2:5kiuil;1:jix;2:skv;4:3gt8iyah6fhcgj3jnmqjnwj7;2:0h71h25il6h99j8fimggkjiqkgvlheniqoj5rimsj8th3ukl;3:8hb9hbck3ejefhgqm0sgw;3:fjh;4:jkdmjfwh9;1:khgmk9;6:8h59kaaj4biqciwdlzej8ffpghcuhcwhh;7:wjm;3:1ld2g9ohbqlo;2:fir;1:hjfjj4sjw;3:kld;1:1h0bikgmqqiqrgxwmd;1:9iy;9:jh0qkz;1:1k9kgz;6:2jw8gl9jbgmk;1:1h73iv4hc5je7hh8gp9h0ajecgxdhaehafl3hisjjjkhdmhgohgphcqiorintl2wgr;4:8hejhekgullunj4vn2;2:bis;2:ahefkn;1:1mi;2:8jg9jiaizcirditghdoheqh5uk4wgv;4:8ir;2:ilt;1:1ha3hd4hc6hf7hf9h6bolfhggglhiljh4kk2lmjoguph7qh0rij;1:jhfwlo;1:8iu;1:cizhj0;8:1h4gnprh3;7:fk3;1:5l97h28jliiwmiuqj9;1:ajmghangsohbpps;1:njj;3:9il;2:gir;3:3hhwkj;6:tlp;4:qji;5:0hf3hg4hf7hg8hdahgbhcfhfgh8hiyjh0kfznt2ohepmbqh2wgq;3:8k3bk2dfyekf;1:dklegk;1:wkv;2:1it3h54h06h57hbcjaegygh1hivij0jgulh5mkcnhdrj8shftiuvik;2:jlj;2:8gn9kianyfggjjeqisrj6sgtwhd;1:0iv4lc9h4ahfbhhegufjfglqihdjgxnjaqherk7uhfwh6;3:ggrqjy;1:0in2jy3ik4h65h76hf7jx9jeajkbkadj1fh9iiojgrkhelhfmhgnhfoheph7qh1rj7thfuhcwgk;9:8h8ahfbivfljghdkl5;1:jkd;2:8hg9h6bikcldfhahlrjhaljkqhdrgtwiv;6:agrbjytk4;1:ak9;4:7ji;1:bji;1:ckcrh0;3:ciy;3:1h9rl9;5:1he4kc8g29fiaimbhdcizej4fj6hhgoj5rgitppwh5;3:siw;9:hgzrkr;1:8hf9j5gj4qjp;1:okr;1:2ji4iz7h98ja9hbaiqbkpdhdeh9ghbhhbjiqnhfoh1qgurhdth7uijwgz;5:0hg1hc2js3hb6hf7he8gl9jabjlckoejnginhhdjgskh2lhgogtpkfqh2uhcwix;1:ukr;3:4l3ehcfjlgkl;2:8h7riwuno;3:4iu8h89guah1bjhcowfh7ghcphcwl2;2:8j69hb;4:2ltjha;6:3jh;1:dmpegwnheokyphfsiwuhg;1:3l9;1:6lhnizvhc;1:glchil;3:lh5nno;1:8iu;4:8mrbgn;4:1hg8izbgzfirkkfrjo;2:8j29haahhciwfhfgjdijg;1:ljn;5:tlp;1:0iu;5:5ln;3:8k3;1:4n7ihe;3:1kf2hg3h94ha5hb6ha7h28h39gdak5bj6cjwdh8egrfkjhiljh7kjllhbmk8nhbqgwrivuh4;1:8jy9iwdhgejnjh6;1:1im4iu8hcbh4jh0kjiljeminoklpj1qhdrhawgt;6:1hf3he4hg7ha8h69irapcehdfg4ghdjj3khaohbphbqh8smbuiwwh2;2:6iwljb;1:8f19nuahc;2:iiywk1;1:ggjsk2;1:ajm;1:4k78judjuegf;2:ejb;9:5lo;2:3k68h69j0ahgcl4dh8ehdfj9ggzjgwwmc;9:3m2wkf;3:0n01hf4h68hegl5il3jh6qhewha;3:8k79gt;1:ah4bheckahj4jkioh5qj2rhgwk4;2:1ha2lf3hc7hg8gw9hgbhgehehhaiisjh0moonhdohaphbqhatmewgu;1:gk6;4:kmwlhgnh9phd;4:0h51h83kk4hc6ha7hb8g99gkamwbh5cindgheg6fqrhiykitlhgohcph5qgzrgxshhth7;1:0j7ej4gheqjl;1:jj9;3:citllguj8;1:uik;a:4hb5qljgswhg;1:sis;1:dis;1:qkx;1:0im;2:jjvpk7rjqwh8;1:4jz9l8aheckijgtokhphfwhf;1:0gz1nm3he8h89guahabhhcj4dhcehcfhehjujgtpheqhcro4uh5wgz;5:8hdgkm;1:0hf1jd3hg6hf7ha8gq9gyah8bhfchgdiuem9gk3jiykh8ljzojoph4qh3wh2;3:riy;3:3keghgjjl;1:wln;1:jjork7;2:fh0pli;6:dj1fgnukj;2:8ja9hedkgeghjhdqitskgwkk;6:kiw;1:0jg;3:ukevh6;1:8gx9gyahddiwep3gk4jgtwhf;2:2jb9j0;2:agzbm8mjd;1:bjhkgxlhanl7ojfpkpqirwhc;5:djgegy;2:jjv;1:8ir;2:bjd;1:0irijo;2:1il4kx8gy9j9jhfkkrnj4phgwhf;3:2hd3jy8kc9npahachedhfegtjiuqherj5uh8whc;1:djp;b:ak6fj2mkz;4:1jm8k29gralxbgnffwgj1iirjhhnikrhgwjd;1:hkrrh4;1:fhfgjm;1:jjx;1:fkh;1:jjg;4:5j58hhahbfknghdjhasnwuizwhf;1:1j23o0rinwhh;2:diz;d:3hb6oukhcnk8th4wh5;3:old;2:dgxek5;1:ehfmh3tq4whg;1:kjm;1:dk3;3:ck3jil;2:ijt;1:ejg;2:2kxqj5;3:sk0;1:0h21kc2gr3h24gu5hc6h57gw8g69gubhfcgzdh8egyfgpghahh4jg7koemm9nmiolrplkqgurgltgywg7;2:4iy;4:0iu3jc9ioliopl7;1:8kk9h7pj3;1:pkc;5:bjc;2:0gt1hc3hd4hg8g69iragdbjjch9dn6fhbgh1jk2kh2lgxnhephgqh9rjjslytjhuhf;3:dhdeje;a:pnoqhcwhf;3:8lx9gjagwciodgjekafk8;1:lj6;3:sjl;2:1hg4jxdhfggmhmjjimqk3shcwhg;2:lk7;3:kiv;4:gknjkn;4:0hh1hg2in3hd7hg9k0ah4bh4chcdk0eldghbhh3jikkhgmj3phcqh9rivuhawk6;2:8j09k2ajpbk9cj5egvfhckk4nhgwh9;2:8h4kkm;2:0j4dj3;1:5ik;1:hjx;1:0h81ha3it7ij8j99juahbchddjlejjfh6ghdkhdphdqit;5:sj8;4:8hg9ix;3:4h68kg9hfcioikquj5;3:hhgjjq;5:djc;1:lkvnhb;c:8jmjhe;1:to6;3:gh8hjf;1:8j09k2ajpbk9cj5egvfhckk4nhgwh9;2:2j9;5:mja;3:8k79gt;1:3j8jhfwmk;3:0iq;7:0it3jbpn6qhhwha;2:tk5;3:1he8gtah4bhech8dhgfllgiqhlejh5kk9lkqrhfwh1;3:6jh7kz9h9ahgfj1jhgqhbwlz;7:3h87ll;2:tjz;1:ejr;6:8jgdkb;2:0ka3gcbjmgl3;3:bjvhkirh4;1:tj4;4:4l1ah8;4:2iw;1:tk3;2:hik;1:1h93hf5hb7h89gsaj7bh9cirdh9fm5jk1khdohgphdriptn0wgr;1:3kuah5ujk;2:bjj;2:cjlej4fjk;4:mjt;5:4j3miyqkh;4:cjn;2:9l0;2:cja;3:kj2mikqj6;5:gjf;5:ogvplf;3:0hc4nkajjcgyej4filghbwhb;1:jl9;1:hhdjju;5:0iu8hefh8gggij5kjgqk4sjqtjewhh;1:iio;1:fk6;1:9jzeh6;2:ej8;5:8ey9o8;3:6hdmlawlu;1:8lb9nwbgidjeek3hhgkhgphcthbwhe;4:3jf;a:qij;c:8j4;2:jh4skpwko;b:8hddkyegzfix;3:0jg;3:bjxckm;1:dis;1:1k9rgy;1:4oj;1:0l51gq;8:8j19jpck8hjr;5:9ip;2:jharkn;6:8kg9jc;1:4l78h4gl9jhg;2:lj6;2:3jb5j38j09hgbj2jjf;3:9km;1:0lv1lykhfwhb;1:0k63hb4gx7hb8h89ipak0dixghbhimihanjnqh6rjeuhewh4;1:9j2;2:1im;2:sj7;4:siw;4:bjtkhenix;3:1h88he9iphj5jiynksokeplyqh9rhdwh3;7:diqujs;2:qj7shg;8:4iu;3:ekp;1:ciqwjf;3:0hf3h94hb7h98klehffhbjjgkjllhenh8ojhpivqjorheskgthauhfwh4;2:fj1;2:jirwjz;1:sj2ujr;4:0h61fq2hf3h76hh7hf8si9gwbkzdgueh0fh8gj7jglkm7lh0mheoh4phaqh9rgosheth2uj6wgj;1:4j5;3:8gyojmulh;2:2is3hf9kkahhbh9dkcelwfgyghehh4jizqhdrj2uhc;4:8izjir;3:6h9ahgck3dgkfkpsjauh9vkj;1:4hg5ld7jnik3jh9qjdrgt;3:pkc;2:jh3wnw;2:4j3dh2ek8;1:0iziinqkh;6:2je5jl8h7ghhjhfkhanovojfph2wgq;3:ojx;3:8jo;2:ljp;4:dj2ej8fjc;1:cip;3:mkh;1:hhdjju;2:1hh4js8hb9h3aq5bjcchffg3jh3khfrk2whf;2:1jp2l73lg7l2ghhjh3qhdrgzwgr;9:ciw;6:gjv;2:ajg;5:8jg;1:4jr;8:0lz5lj6h5whf;6:3jwcip;1:3ha6hh7gujhcogsqu2whb;1:0hh2ed4hc6hc7taajvfhgjhhqhf;4:bkachd;3:wjv;7:0ip;5:3hf5jw8kp9hdahfbhackaejqfh3gguhhejh1ohdph8qh8rjask3tiywil;1:0ha1ha3hd7hh8l29mjajybmfcfvdhgegdfgzgh8hhbjh6klzngyohfph7qj6rhfthcuhcwgt;6:4ki5ijjgrohbskn;1:hjw;3:cjy;1:ajo;1:qnf;2:ejkfh8;1:8j9khgnkv;1:5illlm;3:4jv9k6dkgegg;4:8hebhheingiuhiquki;1:8h29h3ajhbivcixehdfk0hk8rij;1:tjq;2:ohdpk2;5:5lo;6:cjehk9sit;4:4oj;2:ij1;4:8gwkl0lm0;4:1mtrgy;2:bjd;1:jkw;2:bkf;2:jhfwjq;1:km9;1:fofshewha;1:cizfmb;1:gky;1:1hf2iy4jp6jj7h78j69gdajcbh5chcdhfeh5fgqhiujiykh0mhfnhaoh2ph1qh8rj3shgth1um4vjjwgh;4:1h1rka;2:4lm;5:agmcjnjlmrik;4:8jj9h5;2:5ixcix;2:gk4rj0;1:6k0jjk;1:rjy;3:1kijlsrh1;5:4le;3:djfeh4fl6gkg;1:5l6jkfwhd;1:wje;3:cjo;6:8mh9h2bgmdkeegtlji;1:8h5ah0sjruku;4:rir;1:3ki;3:rk7;4:5j0;1:3jd4ix8itaikfh0gh9jl5qgywlv;4:mjg;3:0iv1kfiikkhdljlqkargy;4:wjg;3:4kg8km9gzcjiigs;3:pkz;5:8h79jc;1:lh6nnm;5:2ha3he6l57jgjhcol0wke;6:0kk1ip3h04gm7ha8itaj6diuejdfioghghiwjh9ripthgwha;2:0ha4hg5hc8k79miah8bgnck2dhgekugh7hjgjh2khbphcqh6rj7uhdwgy;1:tj4;1:3kt;2:ag2fg7jgvwrl;8:siw;1:wkw;4:ejl;1:rio;1:2iq;4:jjb;2:6hejgmqkhwo5;5:8irajgfhehjllh8qiwrjesj3;2:bj0jgvwkb;4:ej6;3:al6;1:8j19h9;2:ehgtmi;2:5jv;1:8h5jm2tir;3:lkf;1:9ixlkbtl0;4:nh4pm0;1:6k1;2:8g3wlf;3:wky;1:al4sg7;2:rin;7:7j9;2:hgajl2;1:akwbft;1:wk4;4:olp;4:aipdj2jh8oh8rkcuizwiz;3:7j9;2:8jbekd;2:ok8;1:1hg3hd5hd7hf8gz9hhaj4bhejgpqjkrh9sjntpoujdwha;3:8ikais;1:3hd8g59fdagubhcch0doheqcfltggshh7pheqhbrh9thfwha;1:8gy9koalxfgfwhf;1:8iq;2:2juok2uj4;1:6hbung;8:his;2:8h6fjosirtm0whh;4:hgzjjp;1:fja;8:4olchaohepjo;4:2io;7:ljs;5:fjb;1:alwsh7;2:8hg9jg;1:3jh;4:lh9rk2;3:gky;6:wk8;1:ljc;5:kj5rj9;2:ehduku;1:7kr;6:5ly;3:3hf7k7gjjjkdohgqhfrlowh4;3:wky;1:8jdbhbqkh;9:8hgdj0ejwhhbrjjsje;2:bkf;6:0sn1j33jq6heghajh3pheqhawgp;4:8j2;1:tj3;2:2ltjha;1:1iz4iy;2:3hd4h55j86gz7rr8hfbh6chfehggh6jh0nl0ogvpjtrh6uhewgt;3:4m8ah8sj9;1:jhdqjpsiv;2:bh9khfllf;2:8la;7:iji;6:8h49gsdn8efzjlfwhf;1:3kz4kdjgloh3skg;7:tiq;1:diz;2:cja;1:qj7wl4;1:8kb9hbaiybhcchedjgegtfgtgjahhfjiyqjnrh8tjm;1:jh0qkz;6:jl4oh5pjn;5:9j3;2:fhbgm1riy;1:mj9oh9wk4;1:8k39g8;9:0jt8h4cj3hh9kkkrjhuk4wh6;1:2hg3h84l97hd8ik9j0bjechedjaeitgiyhhajizohfph8qh8rhdujkwgp;2:uiy;8:1hd5jfrjl;2:ahgckt;3:8ir;3:jj3siltj8;1:1j38jm9juah6blbchheh6mk3uhdwhh;2:8hf9jyah5ej6fh1uk0;5:jgxrn1;1:nix;1:lj3;6:tnp;1:cj9tjg;6:4j8;1:0jeojt;2:ejbjknwh6;1:hkd;2:9ik;6:nl4;6:hjy;6:fj1;5:dkuegm;1:5k08jbtix;2:ilt;2:qj3;2:0j12l94kq7hf8iqbhgchdeirghhikzjgzkh7ohfpilqhbwhe;4:8jc;4:4lh7ksqhewhe;3:akcfhe;3:1ip8jo9m5bgiwjt;2:1jk3hg7j08hg9ilbheegrfhejh8khcljvnheph8qmvrgxtjbujlwh8;6:9j6ahcdlneh0jjqohgqhcrj2uh7wkc;2:4ivrip;3:ej9jllwh3;5:9iw;4:7jf;1:bjc;1:birdheel4fgh;2:gl1;4:uj7;1:8hf9iuak9fgjsj8;3:gj3iivwks;3:0h91h64ha8j59gmbindk6ejcfj2hirjiokh1lhephaqh3rhgsiktjiwhb;2:tleuhc;2:3jh;2:8ix;3:2io;3:8gu9kmnjcojsphdqhgrkstk9whd;4:0gy1jx2hg4gm6hg7he8gp9h6ah2bn9ciqdh5eikfjygh6hhcikqjh7kg3lgsmhbngcpmvqh5rkashgtheuh5wh4;2:mkk;1:jk3;2:wlo;1:3l9;3:2mz;1:iky;e:qkx;3:kgwllznj7;5:ljbnjr;3:9j2;2:nk4;1:iin;1:0jmdh1ejl;1:ul1;1:0j61jl2iu6he8ikdhfeinfiwoh6ph8shdtikwh7;2:0j31is2js4jc7hbaj3bh8chddhgeh9hhgjjakillipoh4pilqh0sh5thewhb;1:9ly;4:1it2il6izggvhhflipoj0phfqh8th5win;2:8j3;3:6fvwmb;1:0kw1h92hf3gu4jb7he8gwbj0cimdhfeiogjmhjiiimjj3khalh9misnhcoh6ph4qgxrh0sgzwji;3:qn0;2:fhbhk5;3:gku;3:5p8ahgfghjhbohhpkvwhg;1:7ka;1:9iy;8:rj1;5:9jfeh6gk0;2:nkx;1:fik;1:2mp4lojhenhg;5:9j7;6:8k19h4;1:8j6;3:8h79jfhjl;8:ehcfk9wkq;3:0he4io8gx9grahadn2elsfl4ghgjhfuhdwhc;1:5kk;3:rj4;2:8h7llp;5:0j3dj1ej7fj9;1:qkx;1:5ln;1:5k0bjdckqkhgqhhriwuhd;3:hmdqj0rha;6:aj9;3:jhbqjgwle;3:okuwkh;5:0ip2j5ijn;1:dkpegr;1:3jowkn;3:gkwiix;1:1iu4itfo6ghgshewh7;3:gkd;2:8k9ghfsiq;9:0lxrk4;1:ahbchchlqjhcmk7wj8;a:ahehkk;1:2iw7ir;4:4jx6h07lj8h7agncjhehghhfjn9rh8thewh5;1:po6wh7;3:fj1;1:1hc6ln8hd9kxahbckcdilfhdgk0jgxpheqh9ujnwgy;4:bh9khfllf;2:1hgohhpl9;2:2lz4g7jk9;2:6gh8il9jhal3bhcck4ehcfh1hj2jgskj2phfqirrh7ugzvl3wh3;1:8h4ahffkvlllwhf;9:6nbgjtwhc;2:0ik;4:8j09juaikbhfcjmeh1fj9;3:0lv1lykhfwhb;6:ejh;2:ck3;1:hj1;1:6ohwhc;1:0jx4gtwke;1:iiw;1:bis;2:uj7;2:2mv6h2uh8vkt;1:pkl;1:0he1iw8kn9n2bgydhceh2fh7ghbjjwkh3pilqj3rh7uh1wgs;1:9jmuhe;6:6kqehgiirtk0;3:8k19h4;3:hjsjhftkj;2:1j3wkf;7:fjw;3:ajm;3:rj3;2:jim;3:bh7kkf;1:4jobjzihhlkfrga;5:0he1gs2jt3jp4km5hb6h87h58gsagmbgwch0dgrfl1gj2hgljlqkhalhcmhfnjaogypgyqgxrgxsjftj9ujpwg6;2:0jy4gsajvcj4ljzrgswhd;3:0fa1hg3lv8jjakcbhhchegitjiyqharh7uk1;1:lj9mk6njo;7:eiq;1:sjj;2:hik;4:ij0;6:bjskhf;6:qjd;1:0hg3ha4hc7ha8knfhcgh7jjlkjmlhgnhaojkpixqjtrheskithbuhgwh7;7:8h69izmnn;3:km9;3:jkb;5:qkpuk9;2:ejcrjgsit;4:8k4;1:1hg3jc4hf7jw8jk9gkahgbpdch3dh7ehcfgskh3mj8phdqivrggthauj0wgz;4:9jkgk1;3:fh8gjo;5:2f47pn;5:1jp8k69gqam2bgnffviitnimwjj;2:kjj;3:dhhejy;1:0h92hg3hgiql;3:1jv2q43h24hc7lj8ivbhfdhgghgjhcoh5phbqgxuhhwh7;2:4jl8ku9guainbhddh2egjfl4ghdjh5kmymhgnheohgphdqhdrjdth8uitwh8;1:8jy9h4gjs;8:plq;3:fj1;2:1jv8h2aj6kju;8:7l6;1:hj5uj6;1:8jj9h5;1:cm7rgx;2:8jk9guajodjnegxgh7hhgjh2mj9ohgpjzrhftjmwk5;4:6kd8hdbhddkeegtfhbgknjjf;7:2kh4okah9ch6fhhghchjtjh3ohewhd;4:0iv9kpmje;1:8jv9italddgnek6fg9kjkwh8;1:tj8;1:0h01hc2ki3iw4he5jm6mw7ja8grahgbh1chediwehafhcghahhejggmhfohdpgwqgsrk3shcthdugmvlmwio;3:hju;4:9jk;2:0h71hf3hf4h75is8gc9giah1bhbdmael1fjfgj7hhcjjnpheqjjrilshgthbujkwgt;4:3js;1:0hd4hh8hf9hbah5bhddiweiufpkgklhh9jh5phgqherh7shgukfwh4;2:uk6;1:ah1djnejtsiyuja;3:0hg9ipak4chcdijejqfj5;2:blxrh7;5:cjy;1:gku;2:4kmigs;4:2iu;1:0hf1h94hb5ji6hh7hg8l49k2aiwdheeh1fghgh4hhckjjlimmhenhgolcph1qh4sinth7uimwgt;4:1h98hgaoxcjggh9rh6siywhd;4:6nbgjtwhc;1:8jl9jmaizbkjdj5eh3firjhhuhcwhd;9:dj1eh8;4:png;3:8hbbk4kl7;e:8jq9k5djneklthf;4:0hf1h83h94he7hd9jkah0bh2ch9djnekqgh7hgwjkhkhemivph9qh3rj0uh6wl5;1:dj7;3:rje;3:7megh0jheqjmwjm;1:8j9;3:0hg6ioahdhjcjhelk1oippheqip;1:wm7;2:rjk;1:0lc3h78hgbilciqejrfiyghehis;1:diqljb;5:8ki9h2kjt;4:gky;1:4jj8jy9gfdgqejtfhfgomjgqkh7phfqjwwh5;1:tjd;5:niw;5:0gq8jydilejq;2:2j7ah7ujl;3:0l23h64le8hcahhcinejjfitghchiojhgohaphguhfwhd;1:4kajhcpmbwh2;1:0hb1ha4hc7h29gabivchhdkgejjfjckh3lhgoimphfqh8siptjq;1:ehfjj7mh3tpwwhe;1:eiq;3:8ha9jv;3:ijn;1:jio;1:7h1ql0;2:5ks;2:0jz1nc3jg5hc6h67h18h0aghbkmdh9ehbfh2ggwjgakh7lgwngwok4pglqj9timugzvjiwgd;5:fj9;2:bj0sjg;1:mj9;1:8hd9kk;2:3jy;4:6kx8hgjj3;2:fjw;1:8hb9j4ah5cisfgqjj4rjpujv;4:hik;1:ql7;5:0hc1h83hd4h65hd7hd9kmah8bh0efxfkjgjehfxjiwkgslhfnk4oh1pj1qkzritth6ujfwhc;4:0he1j33hc4gz6k67h28gy9heah6bh9ciqdhfehdfh3ggzhivjfxkhblhdmixnhdojjph5qk0rkdshbthdul7vl8wfz;7:1hb2ha3kq4h95j86hf7hb9h5agzghehh3jjfkh8mofnheohcph6qh3rk5sh4thauhcwgg;1:3hg4ju9hhah3dj8ej7gh1igsjhfphdrjdtjjumlwh1;2:6o4ghbjhgojfphcqirwh7;1:8is;3:bk3rh6;2:eheukk;2:4k6;6:dir;1:djbehe;2:5kk6nw7h68hfjh2ph4qh3rhdugpvm4wjg;1:3m26h48g89l7aj0bj3chbdlkfh0ggihjgjhblimqharheuikwgy;3:nix;2:cjo;6:4jd8ldcjndfzejxjh8whd;2:wk6;1:dj7;1:qlz;3:3iv5ix9h4ah9bitdktegzfh3jiyniwwjq;1:ekp;a:8jh;6:9hadk6eh8;3:kh1mli;2:ijjrip;4:3hf4hg8hcbhffhggh8jijkfnnx3ohapj9qgywgt;2:0hf1gy2h43h74hb5hf6ml7h98jd9h0agxbgncgrdj7ejafkbhk5jgwkhblhgohfph3qgnrisuk2vjdwgy;1:wj9;3:8ha9heah6bh6cgndiqfhdgh1hp6jjeljkrkfthguhfwh1;2:1k33h84jv5ok6gwaj1bhfcitghgjgyqhethhwgy;4:3hb6p7th5wh6;6:pk2;3:9isomt;2:8h9bjlchgeijgkangholdrhbwk9;3:cl9hip;1:0gy8gm9h2dmgek1jhcqjewk8;1:8h69hceko;1:ainfh8gki;3:0hf1lx2hg3h94iy5he8jp9hcbh4egqfiuhh8jjmlkhnh6ogvph6qh1rh9sh7thduk8wgu;2:qjy;2:wiy;3:am0fj4khg;1:1jcrhg;3:wl0;2:kkbrhftje;5:dk0fju;a:qkw;9:ik9;4:1h93hg4hc6he7hbblzehcfhgghahh4iiqjh5kk4lmnogxph7qh3rj0uhg;1:0lu4hc;2:sj5;1:8ju9lwah7bkscheeh0jhakk1nhhqipuhcwhe;2:8kgbl8whg;1:7hcaiqeiyfhhhikjgkmk0qm3rhgwhc;1:ahdcg7fosjk2th5;3:1j34h5ghchliik5jk0lisohgrgi;1:ljc;3:afrflt;1:3mf8jd9ipahgbjchjrjhduhfwh9;6:fgnuk5;1:jivsiy;1:ahech2fhgghehp5jniqh5rgvwh0;1:9iqbgpdjgkh3lk6rj3wkk;8:9ix;3:qjc;4:ej6;2:wk6;2:ejq;1:1hg2kl3he4mk7h5ah6bhbchedh8fh8ghfil7jgvmjloh2piyqh7rheujhwh5;c:8he9ja;3:0ke1h92hg3h95hg6hg7hgajvbjldixjh4kkumhhnhgohfph8qh7rjtuhfwgs;5:9jw;3:birgik;5:rjj;2:rjz;4:4iz9hbck3djkfhcrip;1:cjy;3:cildkfjhgllx;1:khhlk8nhgwku;1:8hbjheknh;5:2hc3il4he6gs8iz9mgajhbimcj4egpfhdhipmhgpharj0th8ugsvjfwgs;6:1h48jp9lfbh7coeegofheghehhfjgukhbol3rhbwhc;1:8h69k3jjh;2:5j38gw9jsah8fh9niwrk9wk6;3:6khbj0qhftl7;1:iin;7:fk4;4:wjg;2:jji;7:8imbirdl5fhgijmjhcnheokcpherh2uhfwhd;2:1gn3hb7hg8j39gtal5bh3cjfdj6egthkcjguohgphbrlish8tiruj1wh3;4:jh7oh2qmi;4:1jv8h2aj6kju;1:8iu;4:0h51hb2hg3ok4hc5ip7lt9gybindj4eh8fh9ghgjj6khgogupgmqh3uhfwiu;4:kmwlhgnh9phd;3:0hd8j39iuaimej7phe;7:dh8em2fgh;1:3j2;2:0is1j42jx3g95jj6hf7h8ahdbh3chffhcgimhgyjjckhdmheoj0ph3qk1rloth5uhdwgl;2:ajccl7hjnrhe;c:bld;3:gjv;1:lh5nno;1:6hf8km9jbagzbh0dl0ejifgvhinjj3phfqijrgwsh7th6ukxwh0;3:ajjmjd;2:3ng6hb7hb8gz9h5bhddhfeh5ffigo9hh9iiknhfph0qgzrh9sohuh3wgp;2:8il;2:0iujh7oh2qmc;1:0me3ha4ha6hd8it9jzbhgdixejhfh8jhbqhaul0vhawhe;2:agudhcej5fgsnktslaulbwhf;1:3he5no7izaj8jh9whh;2:dkpegr;4:eka;1:ajq;1:1jo5jbgjkkhe;3:sit;2:tjz;2:wjm;1:fj5;1:8mx9ga;9:3mz8gyakfehffjrghejkwsh6uhfwgj;3:fkhgjinjf;2:0jq;2:0h21fd3h45hg6hg7hd8w49h2blych5dhgefcjghknhlgumhbnhfogzph9qh7rgeshdtgyuiywgf;2:dk4egu;1:0jb;1:mjj;1:9iy;1:gio;4:9h4ekp;1:cixrkm;3:8jc9nfegp;1:9ip;1:0kf;2:8ko9m9ak3egkjgwqjmwhf;3:0gz1gg2j23h14io6h87gv8h5afzbgtch5djgeghfgkgk2hltihejkwkggnobog8pllqixrfwshetjeugvwg2;3:akofj3;1:mjyrhe;1:wkw;3:uj4;2:8k0;2:win;2:9inwjl;2:fjeghf;3:0ls3j9eiz;1:tj8;3:hgzrkr;7:0hd3h98ly9mvagodhgembghgjh8khaqhcuikwgw;3:dipjlpqhgwh4;3:aj9;2:bjrcinkhe;6:6lwbimjj9riowhf;1:3keag8clsdh8eiufgzgh5hgfkhaljmpheqiwrjaukmwgw;4:jiu;6:diwrji;2:min;1:8jr;2:2kvbhdgkt;3:4mj;4:6kr;3:2gn3ol;2:5hgbkgrjw;1:cm9rgw;1:efyfjsul2;2:9modhaej1jhc;5:2mz;8:agmfg3grmhkyjhewh9;2:1hd3he6njcixfhbokwphgqhhwhg;1:eit;3:0is8jmaj4dkoehbgk1jhguhgwhf;1:8fh9l7hgsqn1;3:cheqkawju;2:eitqir;1:jk3wha;1:8h6ahdukz;1:jkw;1:8h7khanlbtm6;1:dqqecp;1:cja;1:5pk8heaiofjahiqjhhohcthbwhc;5:3hgdgcegvfsmkgu;2:0kefiv;2:fhfgj3hkl;1:dld;3:1is8jaekc;1:blj;7:unevh5;2:pjx;4:giz;2:1ku;3:8fx9kx;2:uk6;1:8gwagvsj2tn3ujfwh7;1:8jffir;b:ilt;1:mjj;2:9k5;c:wjn;3:8ha9jv;2:8k5;3:1jx4k9fjiigrrgywj9;1:giqtlcuhc;3:ck6wln;1:1js3hd8h0ahdbh7cj7fhfjhgkkcmlvokiwh8;3:oh4pld;2:mil;1:9h6dkzej8gj3;2:6it;4:4ik;1:eka;2:8k19h4;2:hik;1:3iy8ja9jfaitbk7chaeh7fipgioujbwh7;5:ag0hkniiyrjd;3:wjs;1:jk6;2:3jz;3:0ke1h83il4lm7gt8h4ailchgghehikikejhcphfriuuhcwh3;2:gis;2:7lt8gw9jxwhd;3:diyegxjje;1:iis;2:ahcfjw;5:8he9h2bk8dk2eh8uiu;2:0hc4nnajkcgyej5finghdwhe;2:1hdcjfrj1wk7;4:pjf;4:0h84h9ilv;7:akzjh8sh9;8:1jk3hb4io9hbahdch9gjpjjikmflh2pheqhbrj2wh7;1:pln;1:ij1;6:eis;2:3gw5kn6mw7k18h99hfehcjfmmkmphgqh1ugyvn2wgk;3:jjw;3:6k6;1:jjx;4:1kh;2:0hh1j33hf8h2eiygiuhjapherkywhc;7:his;1:skv;2:sk0;1:qjq;3:8iz;2:mmn;4:8it9izbjnck0fj5whc;4:6h77mibiwjhgnjgpheuknwh7;1:5ipjk7;2:0iu;3:rin;1:1l8;7:0hb1hb3hd8l49mlajzbmpcfudhgegcfgzgh8hhbjh6km8lh9ngyohfph8qj6rhfthcuhcwgu;5:5kafiphiu;1:8jm;1:qkm;3:0hc1gl2jl3h45hh6hd7gw8h29h8bhfdhcehefh5gjejkakgylh8on3pj0qj9sjdthcuh8wir;2:2jz7j5;4:0hc3h47l18hcgkcjgmwn6;2:1nukgunh1;5:8k19h4;2:8hdgkm;1:lk7;1:3j45j7gh6hj2jh0nk1okupivqhewj4;2:tjd;1:djbeh8;2:djaeim;5:ojnsl8uil;1:2lm4iu9k3ch0fj2;7:1h98hgaoxcjggh9rh6siywhd;3:bjl;4:ljn;3:0iw;1:8k09j7hk3;1:mj6;2:bld;1:3hb6np7kk8hdehdjfsqheuh0vnowh0;3:iiv;1:7lxcgvhirjgirjw;5:cjo;1:1lxwgs;3:jkw;1:ajl;1:8kobh9hiqjhfrkd;4:9ix;3:qm8;4:rki;1:bjd;1:8j99j1dheel0;1:9j5ahdfhfgk3;1:ahafkd;3:0hc2kt3hf4lx6jkfhegh7jiwohdph6qh4rhctk5;1:8h29hgbkofnhgh8;3:tiq;3:8l8bhg;1:8k09j7hk3;1:3hh4hf6kn7iy8h39hhbk5gl9ij3jhgkh9qhcrhbwje;4:8hgkkh;2:9heairek4;3:dj3;1:4kg;1:qlp;4:7hdejfjhekgpnj8oknpko;1:8irej2lhcrj2;1:0hd4hh8hf9hbah5bhddiweiufpkgklhh9jh5phgqherh7shgukfwh4;5:9iy;4:6m8;1:8hecisdg9en3fh9jhfrjnwjv;2:6hgwmi;2:fjerjg;1:cka;2:khenkg;1:1he2jn3h54gz5hg6jb7mt8h39g3ah4bkrcmddgvek0ggphh9jgxkgxlh4mhenhgogzpiuwgn;8:4hfijkjjz;5:0iw1gw4hf8gubh9ehafh4gj8lj1nj8pivqh7rm8tip;1:0h83h14hg5hg6gl7gm8h6aj5bh1cj3dh9eh3fh0gkjjfsmhgohcph3qk1rh0stnth0ugsvjzwgl;5:0iziinqkh;2:fj8;2:agocmrfhejh1rkawhf;1:tj8;6:jjj;2:ilroh2pl5;5:agvjlirh9slu;2:qj3;6:wlo;5:0ipdh2ejn;6:ollpln;2:fgvglrmm8rhfwhe;4:mkj;4:8hdjkw;3:8hdgkm;2:6hg7hg8hccklehcfgfgj4hloplrqk1rgjwh1;4:diwehf;6:qj7wl4;7:3hf8ik9jbaixcjwgkqqhfrhawhf;1:hjirgp;i:tj4;2:hgzkjorkn;2:0hd2j14hb6hf7h68h29hdah7bh0ch9dh7egufm6hhbjj1kj8nkgogyqiorilsjcthauhb;1:uis;4:9irtj3;2:1gp3he8iuagqbgtcl7djyennfjlgl6jgjkhclhenhgphbrgcthewgv;2:dhbegujnh;1:ljj;1:0h82jd3gp4j65hg6he7hfbjhdjueghfgwhjvjggkgwllkmk1nhhoj1ph1qh2rhgsh9thhwjb;4:9ipjkbwkl;3:1knbhcjjnkh4lhgngsohfpneqiqwje;5:qjq;2:akgrhd;1:ajj;5:siutjy;3:8h89haahbdk3el1fmkgherhewhd;4:5nojhc;1:wjw;1:7kk;1:uje;9:tjl;4:3js;1:9j2;2:djbeh8;8:mja;4:0j9sji;2:1kq3h44gv6hg7hd8kr9gcaisbj3dhdehefipggzhiqik2jh1lhamj6nhfoirpgwrioshetgvuh7whg;3:7ka;6:pmb;4:dkzegv;3:8h59jwalpfh0;2:jk9ljq;3:bjsgiklkcnk0sj1;1:eis;1:3hg5ip8h6fh9jhfkgwms8ohgql7wgx;9:2ij4jf;1:1it3he8es9o4ahebhgdheehbglfhjhjj3qhgrhdsh5thguhewjp;3:rjg;1:5kk6nw7h68hfjh2ph4qh3rhdugpvm4wjg;1:cjo;3:1hgmlnrgrwkr;1:0jengkols;6:9ik;2:dizeh7sjk;1:po6wh7;5:bipqkv;5:4le;2:gjcwjn;6:0ha4iu5j66hf8iv9hegkihizik4jgophhqharkgtj0wh3;2:3im8mf9m1bhbehekh5uhg;2:8hbciljhgrmr;1:ohcqk3;2:cjr;9:0hf7hb8izek0fhcghgjk1pgyqmuriuthfwh6;3:9iuhj9jhdplyriqwhd;2:bj0;4:0kt1iu3h34gv7hc8h3ajcdjaeitfiwhj0ihbjhcriwwha;1:uj0;1:1ju2kw3j64lvdhhjh6rgvwhe;1:2kz;2:0lu4hc;1:gl2;2:qk8;1:lkunhb;6:gjf;4:8kg;4:aixbkxcha;2:3h46ni7kf8gw9hfbkuehdjfsqhbrhcugvvnjwgx;7:gj5jk7;4:4ji;6:8lv9gsaiu;1:8mw9ccel6;2:0h72l23he4ez7hgbhddhggjqilpjngohgph4qh1rgksgrwjh;3:7j4;5:qjv;2:hiq;2:1he7kc8h89h9ajedmvghfjjkkheojvqhbrhcsh8thhuhdwgk;3:3haah2bjsdheeiqfjuiiqwjp;6:0iwahafhcgkvwke;2:uil;2:fkx;1:9jy;1:1hgrkl;3:0h71hh2hb3j95j38iochffhcgiohimijjjiqkhdlhcohgriytixwgy;3:okl;1:gky;2:7fuckmjl3ok7wh8;1:5jw;4:akdcjp;4:8gsbk8jj2;5:6hfpo4whe;2:fj6jinqka;7:1hf5j28jn9hcbgwdj7fijij0jhbkk5rje;1:8jf9h0wjs;2:ogvplf;2:0hg1h92gq3h84hc5j76he7iw8il9gwaijbhdeh9fm2hhgjj6lhdnhcqiktkguhgwgm;3:hjg;5:djceh3fkugkdjhekkcwhg;1:1is6ncpheqhhwhe;1:0kr1mw2he3hc4jv6hf7hg8ha9hgahdbhachfehefgwgkijh6khclhgmhgohgphcqh7rhauk7wjl;1:8jd;3:0hd2j14hb6hf7h68h29hdah7bh0ch9dh7egufm6hhbjj1kj8nkgogyqiorilsjcthauhb;1:0h01ne3he8h99gvahacj1dhdehcfhehk8jgspheqhcro3uh6wgz;2:0iz2ji4j67h9aisbh6chbdhgeh9ghghhejirkjklimnhfogvqgvthdwjc;5:1jc5iq6nmphgwhe;7:3ik4h66hb7hddinej5gjdij2kh4nh8oh9pkpshath9ukgwgp;5:dhdejf;2:3hf8jywm7;1:hh2rkj;1:0he1h93h74hc5iq6he7hb8jpakgchcdk2egighchjwjh5kgtlhbnh8oh9ph5qh1rivsjctkiuk0wgr;1:1hbbk9gjbrkl;3:jhfqjs;1:ejh;1:khgoo4ph1;1:8h79ikaglriyuo3;3:1jc3k7pjp;1:8gu9kg;6:0h28gm9glah2bj1eo5fl9gh5jiukhdqhf;1:dj0;1:gk6;1:riy;3:nl9olbph9;2:5mugh5hjsjhesj9;6:9jl;1:uiy;1:6qj8hfeh8;3:rik;1:mjt;1:hj3;2:3lg;2:jkl;1:ahfdjjeh5fh5oh1pmt;4:jkswk2;2:2hg3hf4j78gq9kjbiwcnidhaehefgvgh7khhohgph9qhcrheuhfwka;2:ejcfjpuj8;6:0hf1hddlaegojhdohdppbwgz;1:8ipah6bk2fksiiv;3:5jt;3:ch9fk1;2:wkw;1:2mc7hgqjg;1:biqqjq;1:hk0jhdmk0tim;1:qj9;3:3k2ain;2:cip;a:ghfsiowk1;1:2g77kbqjw;2:0j23jl;2:1ha2hh3hf4hc6hf7hf9h0bplck0eh0fhbgh7hh1jh5kk2lmlogtph6qh0uhh;3:nix;3:gky;2:sjj;5:wkj;2:mk7;2:dj4;a:8jt9khah6chgdh9ej3fjsgjd;1:nmrohfphd;2:8j1;6:plb;4:8j9;1:1hh8hcbl8kjbrit;1:4kg;6:jkv;1:3md;1:2he3hf6hg8gn9iwaiqbhdegtgh9jgwohephhrhaskkushwh7;3:bjc;3:ljj;2:1ku;3:0im;5:8ix;9:4gwcjpik6;6:aix;9:0jh;2:8iygja;2:0he1h73h94h96hd7hh8h19hfah4bhbcg5dh5eitjh0kk3lsomhhoh1ph8qh9rn2uhhwgw;1:4hd8gs9lbaj5ciwfhgij8mm0ugz;1:fgnuk5;9:1lnrhb;2:1h43l78h7ahgblkchcghgkkrqjzsh7wha;2:0np3h94iu8j6airbhedkffh2ghgjh8phgqherhfthgwh8;2:4je;2:0iy9lrbhgcj0djaeiojhhwix;1:kmwlhgnh9phd;1:tkp;8:1h62iz6jl8h2iltuhgvkc;5:qkw;1:8gn9m3;1:1hgmlnrgrwkr;8:0h51hf3h14he6iu8jm9fsbjlch7ek6fk0ghahj1jgwkh1lhfohephdqh5sjrtl5uiv;2:ej5;2:0iviiknl8qk8wha;6:8kadjwuhd;f:mju;3:cjn;1:kjkok4;1:jh5pmawkt;2:djlojl;1:bh7fkbkhell9;8:0hd3hc8mo9nlagqbgxchfdheen3fhdjgwkhbqherhfwh0;3:9hhbhhrly;3:8km9ofahgchddheehcwhf;6:2ll4lcjh7qhe;1:rj9;2:jjt;6:4kf;4:8jk9h2;3:1k5gjkkhf;2:rj8;1:8heej2;1:qji;1:ij0;1:khbmtmphhrhgwh9;4:dgxek3filuk9;2:rjv;2:qju;4:dhdejf;6:7jh;1:8gz9l0ahe;1:qjx;1:kjj;1:6il;3:0h84h3bldfhbgjchj3il2jhgojjwhe;2:8jzhgejjnrjo;1:giz;2:ajc;2:1kfghgjlpljfrgyuhg;9:0lo1hg3iz8j59hbbgveirjhgkjvlhhrj6whe;1:1l0bhcjjxniqqj1wjo;2:3hg7l18hf9hbdghejfjo5qhgwh0;1:agtbk1;2:9iy;2:dlxeg4;8:0k71h64lc7gs8gybischfdimik7jhalivnhephcqhgripuhbwh0;4:gkzmjr;1:0gy3rv9hbih5whg;2:8k4;1:0jv8gw9ndah3dhbeggfh5ghfjhfnizqjluh5wjx;1:3l9;1:4h9ils;1:9j4aklfh7jjiqheriz;2:0mp;2:blj;1:ejmlj1mik;2:8j09juaikbhfcjmeh1fj9;9:8iucjdhk7siq;5:1h4gnprh3;3:aj6fh6;2:gir;1:1h52h94o0;1:2ml3hh4h56hd7jl8iv9j9ahgbgceh9fh9jh7kjlljqoikph9qherhcwju;2:2g87lh;3:8j2;2:uil;2:8js;1:2ha3la7h08he9h8ehdjimmk0qgyrk1wl5;4:hjqijp;2:lj6;1:9iy;6:0hg1he2kw3j84he5jh7hb9hdbiscjzfhcghcjinkhaqlzsh0uh3wh0;3:2l04it7kijhf;1:jjx;2:8kw9g3dgnekfilikjpwhg;5:eingjbsit;3:djhegx;1:aj7fhe;1:skv;6:5nwjhb;1:8h7alddhefh6giqhisrgiumi;1:bgtkls;2:dhdejf;3:old;2:0h01jm;2:9j2;1:dhgjlh;5:8jmjhe;2:fkm;1:8hdgkm;1:jkh;1:wks;6:siw;1:8il9jqahcdhdej3fjrgjdljv;3:ghgsir;1:nmp;8:bjukhf;1:1jf;1:4iv;1:clswje;3:8j0alebixcjsfh9ghgkk7whb;4:8hf9j3jja;3:1ka8il9haajkbjrcjgfinghghjjjhfkhdlhgmhgohaph8qhhrkdth3whg;1:gk9lj3;5:akngiz;2:6hf8is9hbaj5bjlcioehefgvghbhn6jjuqhfrhethbuj7wgq;4:cir;4:agqfk9;3:ejl;1:bl7dhgfjw;1:5im;1:glp;2:wl0;1:1hf3k58gaambchhdkteg7fgrgh9hn9jh1kh8qhfrhdsjfthbwh5;1:1gfgmbrgs;5:8l2aiwbhfrik;3:sin;1:wlb;4:3lj;1:wk4;5:9ixsiqtkr;3:8lx9fbgk5;5:bjc;2:1h13h86hg7h9alpfgzkgvpiqqh2sklthewiv;4:4jk;3:rj2;2:1he7gn8ka9gkehajkgkgrmnbpgrqhgrgiwlm;1:gkewjf;1:3kk;a:qjq;4:ohbpl2qlh;4:sju;4:3jxbkuegxfh2jgqqiquhewo2;1:rj2;1:1gp8gt9j9ajkcjqdhceh4fgrghajh8kixlhfohcpisqhermjtkcwhc;1:fjeghf;1:djo;1:ail;1:sjj;7:sit;3:8h49mrdh1en7fhehh7jh2whf;4:2lzdhafl2ggzjhbnh9phgqhdrhetkfujtwhg;4:vnf;1:ejg;1:8j19h9;1:iiu;3:0f03mcljamm9rhhwhd;2:dj1eh8;1:fiq;8:6h58h1uncvklwhe;2:jke;2:7ivah4fj8jikqkiwlz;4:hj1tkm;1:8jg;2:rji;2:bio;5:eiq;1:4j4;1:jkd;1:0hf1h72k93he6hg7jy8hgbgtdj3efyfj8gjnjjckiylknohdph6qh8siruhgwh0;4:9jl;2:qip;7:8la9gvah7;1:qj3;3:4k9ah3fkuihe;2:7k28hh9h9bg9clndgwemifj2jiolhgqiwrh8thewgu;5:hldrg7;1:1mi;4:iiw;2:4j7;1:ajeqjv;5:sit;2:gj4;1:2mz;3:akrcivfjymj7sgo;8:8jt;1:8j09k2ajpbk9cj5egvfhckk4nhgwh9;2:2iuako;2:ajjohbpjz;1:dhdejf;1:fjs;3:olkphd;2:0oe7gxwhc;3:8hd9iz;2:flv;2:pls;2:jkm;2:dj5;4:8oi9fyagh;1:fit;e:6oh7h8qhgwhe;4:llp;6:8hflnynhg;1:8gs9gkbnf;4:8hf9jcaipbj7fjg;1:fkf;2:jgyqki;9:5ismiowkg;1:2jx7k5;1:qlp;1:0k94gu;3:hjdjjcuk7;2:0hd3ha4hc7ha8kighfjjfkjjlhgnhbojhpivqjprheskdthbuhgwh7;1:pmb;4:3kadjm;1:bjqjkfkhd;2:2g97kcajm;4:civlk6;1:0kh;1:bjrgl9;1:1gf8jf9jlch7gp6hhaqjkrg9wh8;3:0hc1he3h94hb7h88kgehgfhbgj6jjgkjilhenh9ojhpivqjprhdskfth9uhewh2;2:ek4;4:dhgjnx;2:0he1hb2he3h74ip6he7h29jhahgbh2dh7ejdfh8gh0jlrkhapkhqh4rjmtkiuh9wgp;9:3lb4jf;5:6h7vjx;7:9j4ahebhgdkuegofh3jjnoh0pmc;1:8h49grdnwefujldwhe;1:3h84hg5m58jy9g5ah6bh6cgzdgpek9fguhhgjgskiuljknj0ohcph2rhashguimwke;4:8jqajwbkyhh4whd;1:okmwhf;1:2hd4luio5jheuhe;6:8hh9km;4:ak7fhftjh;1:kkmlglqlw;1:8hejhekgullunj4vn2;5:9jqcjg;3:4jg;3:1jk;1:ckbfhdjhdklgphfwkr;1:8k69gqcim;a:7j9;1:qjg;3:5k4;1:9jaaimcio;2:8m59hdeh9khgoh1pl4;1:9ix;4:nj2;5:khglkcrki;b:jjf;1:fjo;5:8k5ekg;2:0hg3ha4hc7ha8kr9ixehffhbgh6jjgkjhlhfnhaojgpiuqjorhdskcthauhfwh1;4:8im;5:fkg;2:8irahbch2fhgghdhoxjndqh5rgvwgw;1:nk4;1:0hf1ns3h98gbagjbh0cheehffh0gg6hj9iiukmblheohcqh8rj4sixtimuhewj0;1:fjx;1:qkg;1:8jo9gvcl1fjrrg0;1:eit;5:0p5gj2jhgpjcwf9;3:kip;1:glp;5:9gxandbhaeipfh2ggwjj8kheohcpheqhcrgzsozwh8;3:2lk4hhgh9jh2phhqhcrhgtmxwkj;5:4jl8hcsistlxwhg;3:ak0fh9sj5;1:8gyahgbjociwfk8ghbhjkiinrio;1:1h13h74hf5je6hc7gw8iv9h4bh9cindgygg9hl5jh3lhdmj8nimoirph3qjhrixtjgugxwip;1:ciy;1:3jh;1:0l41gr8ix;1:0h32hc3he4jd8ipipekh8ljknhfphgqherjjuh4whg;4:hjg;3:rj8;2:hjg;2:8h99grel9gjy;3:2hg3m2;1:cjr;1:8ikal4;2:8kkbh8hinjhcll8nhfrk8;1:4l8ejakhhljyrhb;5:2j0;a:ujv;2:0ha1hd2iu3h94hb6hb7ha8imagrbjmck9dhfel5fkijhfkgrlh6njnpj3qh5shdthfuijwgr;e:bjxkhgqj8;1:0kcjglwkv;2:7lz8h8dgvennfhaqhargz;6:bjxkhgqj8;3:0jt1h54ks6hd7gu8il9gxailbinchadj1ehafjgijvjh5linnhdphawgu;1:8h99js;3:gn0jguqkkwhd;3:fhegk2;2:0jx3g99h8bk5cj0fj7jh6mjwphfwki;3:8hflmx;1:bk6;1:ujv;4:8h29gthns;1:1gu3kb4h96he8k99lmajrdhhegkfhfhhcjgskh9ljenheokhphaqj1uhhwh8;5:ejj;1:8ji9l9ah2bkbchbdhgegyfivgh3jh8kjqnhfukuwh9;1:0jo3jm4h16hh7he8l59hbah6bh2chdgk3hhfijfjjrkhaohgph8qiprjfsgbuh9wgn;1:5j1lmlnh2;7:6k9;3:slcuim;7:ej4jk5qhgwm8;2:uio;2:aftfn3;7:hl4qj2rhb;3:2kk3lo4gdfhhjkiqhd;5:0jh2j23jg4hfdjwggxhisjhekhbnk5ohapheqherhfuhgwhf;1:8it9j4ajbbkwcioegvfhdkkhnhgwhc;1:5ka;1:9hdhk9;1:1hfah4fh5gkqhlerjisik;a:0lh4h8ak8fhbukb;2:dhdejf;3:wkd;1:1he3h66ni7hgbhdjhdokvphfqhatkuwhf;1:9jy;2:8j49jebk3ehbfhhjj9kkpngvphf;5:8jjjka;2:jkw;3:7mi;1:4il8ha9guchedimek0fheglzjiprh7uiy;3:8jj9fgbkeejxgjwjh1ul0whd;1:rk5;2:ql1;4:gjc;2:sil;1:0hd8j39iuaimej7phe;6:0iqbjtckrehdfh9gkqjkzohgphfqheuhdwh1;6:1iv;1:9lgahgcko;1:5j6;5:kiv;2:8jo;2:0h41dn3il4he8f4ahdbrfghajh8krfmhcpherghuh9wip;5:qjg;3:eiv;6:jjx;1:3ik;1:1j4;2:ahcgmzjhbsjy;2:mlyrgq;1:skh;1:khcnlj;1:ljpojw;3:cji;2:0j5;1:rix;3:bjrgl9;3:bkd;1:fkh;1:al1bhhfkowha;1:8jr9jtrhg;1:8h69gsdnrefxjjh;2:1l8;3:1izjlm;4:cjx;9:5jphgujld;3:5l6jkfwhd;2:2jqtjy;1:iji;3:cjq;3:2ld3is4h95il6ke7j0ehgjgyokfphcqh8wjn;2:sji;2:fj9;4:rjt;3:0k4mjxoit;1:0h31ga2kh3hg5j77hg8h29h6agrbhfchbdiweh7fhbgmshnpjkznhbohbpgzqk8rfmth6uhawgn;8:4ki6hc7hg8gvgiwijeoncqhgwhe;2:ehgfjt;9:8mj;1:dmnefifhf;2:1j3;3:5je8jh9isclbggxwjb;1:1he8heblachffh1gh7jh1kl2lh8np5ohcpj2qh8wgx;3:7j0;d:sil;2:plu;6:1h98hgaoxcjggh9rh6siywhd;a:5jdhik;1:0kg;2:3kg;2:2g87ke;6:8k09j7hk3;1:8jl;1:eit;1:dfweks;3:fit;6:dhaejt;2:0j8fhbgjqjjcsiq;3:1jg3he8ki9mbag9bh5djtekwfhbghhkh8mh2phdqhcrh6tjhuhc;1:ciq;6:8hgbkzeheflhghcplgwh7;3:0he6he9j7ah3bj7eh5fjnhm1phfqhbrivthcuiywgp;3:iiz;2:ojx;3:gj2;2:1h63hc5mz8g29h6bkefhgjh8kh0mhfqhbrmysiuthdukhwh1;1:jiv;3:0hb1hf3iy4hb6hg7hd8jq9hcah9bh2cikdk5ekrgh2hhejgvkh4lgmnlgojspgxqh2thfwis;5:7he9j7ej6fgijipsiuukq;2:fhbhk5;2:siw;2:pkm;6:ohdpk2;3:lkf;1:0hd1jk4hc6hf7h98ioak9bgvck1dgdejefgrhiyjl8lhcohcph7rinth9uh9wj9;6:8hebhfkjmlhbwkz;4:6hc8gk9jkbkscj8hk0jhdsioujvvh6;1:plotktwhd;4:tjb;f:hgrnl7qje;1:8j2;2:eiv;1:0iwilhjgullqwiw;1:0h61ge3h44lm5hg6hb7h98mwag9cgzehffgxggzhh6ihgjgpkncljkmmlog0pgnrhfsh1th9;1:cjjdfyekb;2:8iq;1:fkh;4:8jc9h9ckfeixfjm;2:9k1;4:biu;1:0jq;2:1hg2l63jg7he8hd9hfbj1ck6fheghgjiykhcql1sh1uh6whb;1:3kqiitojtwjw;3:rji;6:eiw;3:1h48hcagwbmkhhdij4kh0miznjtohdrkk;4:bjzgix;1:8jbekd;1:cimfh3glx;4:7lvwhf;4:tjw;2:civuji;2:1h93hh4h89glakbfgoghahhejgkkmjljonhgoozpgsqh7rgosjaujbwgt;1:0h63nq4jv6hg7hb8gb9kbagubhfcjodjoefnfh7ghajglnirphbqioriosk1ugxwgn;2:il8;2:6k2tkn;1:okr;1:2ja8hdej0;7:diq;1:0h74h8iltljg;4:riy;2:cjnfip;1:ahefhfgk6;2:ahcgmzjhbsjy;2:2il;1:3k8jhawjt;4:1hg2j53je4io5iq6go7h88gr9hbcj7dhgfhggh3hhcjleoitphfqh3ripsjeuh5vkswgr;1:8h6gk1;4:ajcujp;1:3jx;6:eiv;2:9jdaj2;1:jktwj7;6:1hf6hgajvcixjh8qnirh5wjj;1:sjp;1:2ltjha;8:3mh5lg8hfjgs;a:tk5;3:1jb2jk3hd6kf7is8h3bjjfgwgl4jh0kgyoktphbqh5rghthfwh3;2:al5cgush1;1:0hd1ip2iw3hc4hb5hg6h57gs8l39jeaimbgxejifh3jh7kiwmhfoh4ph4qgzshftj4wj6;2:qik;3:1ix2hg3he9hcbl7ch6ggyhhejimkp5ogwph6qh6;1:wko;3:3kdbl7egofh7;2:5mh;6:iik;1:ekp;1:5io;1:1h62ha3kq4j55iy8j9ah6fgvghgkgzlhcmhcoh2rggshftkxvjewhg;2:djp;1:2ilmk4;1:4ka8hgegwfkekma;b:0iq8il9j6ahedheej7qk1siywhh;2:wjv;1:tiq;3:0jj2j33ji4hgdjyggzhivjhfqherhg;4:aik;3:8iv;1:2km8hcbh8dm9egjfh9gkhjjethhwhf;3:9j2;1:cj3;2:5k3tl8uhb;2:ijmkhbnlf;5:fj0;1:3hd8l19nybhdcindhcegfjioriwuh9wh9;1:akgbkafgj;1:1j23nyhh0rjrwhg;1:1j6;1:gj7jkvkkllgnwh0;2:0h84h9ilv;4:3k29hfsiz;2:bl8fhfgjihj6ojm;3:kjmsjgtjv;1:8hh9heemsfjg;2:4hgilasik;2:2j83k09hf;1:dgufjw;1:rj0;3:3h08jbfhdjmsqhawjo;1:3lqjhewgr;1:0o51l52hf3h34hh6hf7hhah4eiqhijjh9khdlhfmhgohgphdqh8thguhbwgx;4:sik;3:3jh;3:0hc3he4iz8h09ilahachedkfel2fjugh4jitkj9pheqhcwh1;1:3gs8il9hdah6eiqfhbgishhgjq4phgqjdshg;3:hjc;1:rgatmw;2:dj7ehdfiu;4:0it3hf8mz9iqajfbipcj3egtfhhgh6jiskhhwh0;1:ql7;2:rir;8:4iy;9:8h0kkumm9;3:djkrik;7:8k99j9chgkk1sjb;2:djjefqfjsgkcjkasj9;3:sin;3:5jb;3:1h9olu;4:pln;2:dhefkkriwtl4uhb;2:jk6;5:5kn8ikjhaphcrk8sk7tjd;5:dkqehf;1:4mhuj3;9:qkw;3:fjc;3:4h8ah7um4;1:jim;3:8h89jscjr;4:4iwnjq;4:fh9hk4qjk;6:8k79lvajrbkgdh3egbfj1ghghhdjgrqjfrh7whb;1:gj4;2:0iz;1:0ha1ha3h88gg9gfaowbh9cjcdgtegdfp5githjjjgkphfqh8rh0th8ugnwje;2:0hb3h98hg9h8agnbmcghcjjnpneqjwsh7wgd;2:cjn;3:4jt9grdodef3fj1jk1;1:5ka;2:bjrgl9;2:4jq;1:6ko;6:cjr;4:gku;2:0jfek4;5:0jnjkq;4:8h6glf;1:cis;7:wld;2:8kh9ivaitbkfck6eh9fkarg0uhbwha;8:mjj;3:bjc;2:wjj;3:8h5akxfhf;3:9io;8:rkvwh0;5:3il6h17mkjh1;1:9grele;1:1hc2hf4j5dizfhgkheom6phfqhewmo;1:ql5;4:8kbeiuij9;3:0h42m33kp4ke6jk7ik8h99haahfchedhgehcfhagh3hhgiivjgpkhemirnhfojfpgyqglthfuh9wiq;1:ahcfjw;3:blxrh7;5:0hd4hh8hf9hbah5bhddiweiufpkgklhh9jh5phgqherh7shgukfwh4;3:1kh;3:kjq;2:5ik;5:2io;1:sil;3:4j55k8jk6phd;1:nhfolgphf;5:nil;2:qjy;1:3k49hg;a:2m17hgaj4fh5gjljkxphgqh8;5:ah9bjfchcfhfghghn7jkewh5;6:wl0;2:1gy7ja8gv9k0ah8bgycm3ghghiskhgqhhrk8tk2;2:bjsgiklkcnk0sj1;5:1nukgunh1;3:qji;1:ckc;2:qlz;3:wk6;3:1jxfj3gj3rgzwj8;2:8jn9jpaj0bkmehefiuuhcwhe;1:bk9chd;4:dkbeg0;1:bjd;2:agqfgignhhk9jh3skawhf;2:cisglbhhdjja;2:8ip;2:jl5wh3;6:rir;7:8jbekd;1:mja;3:wkt;1:1h35jl8gy9gtahabh9ciuejbfh1gjuhnankqoh7ph8qhcwh2;1:poawgh;1:0j13jk;1:0hc1h03hd4hd6hgah2bgychbfnkgmijh6kh6lj6ohgphbqhargpshgthgul5wgr;6:ljp;1:qjg;1:3h76hf7kb8h79gpdm2egdfhhgh9jmppj7qh5wjk;2:3kz4kdcjhdh5elkfgawhf;1:fkm;9:rit;1:8iz9k0ajobk7cj4egsfhbkk3nhgwh9;1:8h3chcdjjekxrkj;3:4ji;4:2l74lfjhb;3:cj0hj1;1:bh7kjwlk4;3:jkp;4:1hh2mb6hh7kb8jj9gfgjqjjmoh8wh4;5:fistja;1:6iq;1:1l53lr4jd7he8h49heegygj6jimphdrgawio;2:3j1tjc;2:2il;4:nl7ol8ph8;3:dleehesip;1:0li1is2jv3jrdgzfh6iip;1:okmrja;5:aj9;4:kjj;2:jkv;3:3im;4:6niwgz;8:gipwj1;2:jmgwh0;3:7ky9jmcjydiyrgu;2:3hg4h96l4cirjh8qh0rheumzvmewh7;8:jkl;4:hjzjh9mjzsistim;1:ij0;2:nkf;4:nl3;5:2ik;5:1h1rka;1:0h51h93h24hb7jl9iqbjvch5ejgfj0ggzhisjhfkgtlinmhfohcph7ritsjftjqwh0;6:9ipwk2;4:fhegk2;3:cj4;5:hkijhfril;3:9h6ekn;3:png;2:alg;2:9gorkm;1:tjd;1:okl;3:8heak2fhf;1:ijjrip;3:7kr;3:1hcrl1;b:0in8il9heahdbhgchgeheghakjhlk0nn1ph8qhatj0;1:0gy3ra8hb9h4ih4jhcphgqhewl9;1:aglcmaej2fh9hgikheljuqj7rjkwh8;2:8jv9gzcl3rg2;4:iit;2:4m49ixbhdiinohcplfwh7;1:0lmjhcwls;1:7ktjh2rk3;4:bh9kkz;1:hj6;b:ehduku;8:jkd;4:0hb8l49mveitjhfwhf;5:fji;1:jk6;1:cj9mj6rjvsiuujh;1:2j56jt8jo9h1vkkwhe;6:8jytkn;1:hj6jhc;2:bjukhf;2:8hbjkguiw;1:aj7jh7rkj;1:siw;4:tj5;2:am2fh0;1:bj8;9:1kijlsrh1;1:1hd3jpbixjj0mloqhhrgn;8:olkwh7;6:glh;1:qkv;1:tki;3:9heejz;2:dhdejf;1:diseil;7:1hgjhgkhdlhgnl5ojcpmhqhesj4whd;2:3j6;2:5jq;2:agmfg3grmhkyjhewh9;3:blcwkm;2:6h07ln8h7aglcjiehgjnirh8thgwh7;2:akrfgj;5:dhaekh;1:0h21hb3h46jf7gtaj3bhbciwdgtej4fgnijpjgxlhaoh7qjsrkdsgyth8ugfvknwha;b:0nr4hgbkbhhfjj7qhdwh7;4:0ix1gw4hf8gvbh9fh4gj9lj1nj9piwqh7rmatip;2:hguqjl;2:0h43il5ji6gw7j39h0ah0bjich0diyeg8gh1hgvjjqkgtoilqhgtl6wio;2:0ha1gk2jh3h24jg5hg6hb7gv8h29h7bhfdh8ehcfh0gjajk1kgzlh7nhgomzpixqj6sjbthcwio;3:9jc;2:ch9fk1;6:djmeh9filjh4qjjrk7;2:8j3;2:bld;2:ajt;2:8hcakxfjghiuojauhe;1:8nr9focikdolefbghhuh6;1:jiw;6:ahech2fhgghehp5jniqh5rgvwh0;3:1gv3h94hf8lv9l8aljbh6cjwdkaegoffzjgvkh0lhcmhfohgph9qh1tj1uj7wgw;4:qkx;4:8gxbhgojlumhwhd;1:1he7h88h5ahcbh5chffh2gh2hrwjkgojyphfrgrwh3;5:2hf3hd4jc7lb8kx9gsaimcjneh3jhcwh1;8:8l19nraipbh2cioeh5fh9jhfkh7qjkrheuh7whf;1:dlyegyjl7shhujowhd;3:1hg8izbgzfirkkfrjo;1:0hc8gt9h5ah7djoen0flyghahhgjh6lhgnhaoh7pj8qhfrkbuhewh7;1:his;1:ag6fg9jh0wo0;2:8ipjj8kk3sk1;4:3hb8lp9h6dfvendrjh;5:8iwwma;9:rjw;1:8j8rje;4:qj7wl4;3:0jc;1:0jp1iw4ir;2:0kfdk3egq;2:3lfbji;4:ijk;1:1k24gj6hb7ha9iraiubiyeh3fhbgk7hixiinjgopjqqgtuh5wit;1:lkm;6:8h6jmv;1:llz;5:mjftjr;1:fj0;3:0km1gm3kv6hg8h6ahedj7eh4fksgjzjh8mjeuh7whb;8:dj4egtfkoukf;3:iip;4:2iw;2:1ix2ob3is4lk6h7jhboh3phdqhcwh2;2:3kq4j7dokeg9jhbwhd;5:dkdegh;1:jjq;4:jio;1:0h81hc3ik8h69ixbiodhdeitghehitjj7pl4qh4wku;1:9indjq;d:gkvhgzjl9;5:qjy;7:6h97hggh7ohfphfqr0rk1wgi;3:6m8;1:0jb;1:8jn9flajofh1ghgijfjmtnkhrhbsituh6;1:2h84m2;c:9h3eizfjyhj5jhgqk2;6:ql7;7:sj5;1:8ju9jyeha;1:jgupl6;3:jj7;2:3o79haahgfg0hk3;2:3nw9hc;2:9io;3:0he1h93h74hd5ip6he7hc8jjakdchddjzegjghbhjyjh5kgulhcnh9ohaph6qh2rissjptk8ujxwgr;1:wik;2:3j85j18ip9hcbizdjmehdjjc;1:rje;4:3lj;9:eithje;2:qk8;6:jjr;4:bjt;2:ojn;1:3q36hfjh9ph6qhfwh3;b:3nqjj1;1:ulk;5:rj2;2:3l17h8hinomypha;2:1iu3nn4h9dhdfjviiukh0whf;1:direjhfij;2:6m8;1:0nuphd;1:ojx;3:ejyhj4;2:1h53hb4in5km8g29h6bkhjhakgzmheohdqhgrn0sk4thdukiwh3;3:pj3;5:9jy;2:mimqmpwh8;2:hkijhfril;2:0hg1hd3hd8jvijrohepl4;1:0k08hfkkxwhc;3:sjh;2:3j59jebj9ej8tjt;3:3k89h7ajgrkqwhf;7:1k9;1:hjg;3:8jeqkd;1:1m48ir9h8ahedjkeg3fhbqksrgxwk9;3:rjt;1:iiy;1:nl2;3:5j2;4:1hb4kd;4:kin;6:1je3ka;1:8j89h9cj2eirfjjjhgqj5;1:bj0;6:0hd3hc8mo9nlagqbgxchfdheen3fhdjgwkhbqherhfwh0;1:0l31gq;2:ckxeh1;2:4ij;2:4k58jaaincjsihd;3:alb;1:5kk;4:0im;1:bjxkhgqj8;5:0iy3ji4j4;1:dlxeg4;5:3js;2:5lj6gw8ip9itdh2ejbjk8oheqh8thgwkl;3:4k18mk9gsaikcjoeh7ihd;2:nj1;2:ah7hk7;5:tls;4:4mj;1:ph4qnl;3:2f47pn;4:7hgjixsj1;2:2le4gj;2:8heej2;2:tjb;1:1h13h94hf5j17h88gn9hfahgbh7chhfhgghdjghmkhnjvohfphcqj0rgasjato7uj3wj9;1:jksnis;3:3h26jo7gz8jj9fkahfbk0chfeknfgfghfhhfjh1khdohgqhcrh6skctn4ujpwgv;2:1gv3ly4he6hg8jgbjxciodkeeh1fhagjlhhdihhjgrkgzlhdnhgpheqh8rhethfuh6wjz;4:6h07lj8gb9jbagocjgehfjn9khgljerh8thgwh3;4:lk7rhe;3:dk2wiw;3:jjf;1:git;1:3mvbjocio;4:kgylm6;1:riztjt;3:oiz;3:wlp;1:2jh;5:3ix;5:tjw;1:8l2;2:tjb;1:jhgwl3;1:8io;7:qjv;2:ris;1:3lj;1:2jt7kadjdeh9jhakh5njqojzph2qhfwk7;1:3jvnhdpjj;1:eiw;4:8j6;2:1h98gyblicj2fj8givjhckh4qhgrljwj2;4:om5pfr;5:sjuuiy;2:dmpeg3;1:poawgh;3:0hc3he4iz8h09ilahachedkfel2fjugh4jitkj9pheqhcwh1;1:1j3wkf;3:jjt;2:ajf;1:hik;3:2j66juvklwhf;1:8kx9g0bjwgkowhc;2:3jf;1:akmfhc;3:wkn;7:ik9;1:airrjq;2:0kp1j32jf3im4it5j96he9h4chejiplhgoh1ph8qh4thfuhcwh9;1:5kd;5:wjj;8:6ha7mzphg;2:6fvwmb;1:dhgfkoqjfrjpsj2whf;4:6jw;1:jgupl6;3:iiv;4:2f47pn;1:2j1;2:3jh;2:giz;1:siw;2:wk6;1:5mnjhd;1:4iv7h29h3eh7fhfgjejlcmjqqh9rjpwk3;3:8ival2biqcjhfh5ghbkjslkprhewh9;1:aircjygggsjx;2:blj;a:8ev9o3tk8;4:okl;1:9jt;9:5j66h07m4jjyrhawh6;2:1lnrhb;4:8k5;3:2m34j97k58ioajfcixihejhfoh8wh9;2:8jibk2;2:iiw;6:ojx;4:ql9;5:git;1:dgoelu;2:lje;1:8kmbh9hiojhfrkt;3:eiohj8jk3pjmriowgq;2:rgatmw;4:dil;4:giz;7:bgwlml;2:8hdgkm;8:mof;2:ejj;2:gj2;2:jhfwjq;a:1j3jjb;3:plq;3:jhhlkgniusj3;1:8em9n9hjvwj0;1:cjzjh7;2:qjjsjh;4:0q21iu3jd4ld6hd7he8hggh9ihgjgzmheojepgvqh6rhewgo;3:0ku1hc3kk4hcdj5eioghcijyjh4qjgsgrwh5;3:6l1;1:njhqje;1:cim;5:0hb3ha8kw9m7aj2bgzdinel8fgvghdhjcjgrkh4qha;1:qmksh2;1:0kv3kk4hb8ikeiqfhgghbik0jh7ninqjhrhfsgswh6;3:8kkjh8rlm;4:8kv9jvaizbj7ehfjj4qh6riowhd;3:0gz1gz2he4h66hb7iv8kw9hdak2bjgchhdgthj7kgplhdmh6oj4pjdqj4tgy;3:ijboj2;b:dh6jkdmk9ukawhf;5:cj3;4:1jw8gnehdhhejkqqitrgttohuh7whc;3:1jarhg;7:8jb9jydjjekhpkqrhcthd;2:1gz8gu9k6ahackfhisjheohbpj5rk8tl1;3:8h49mmahbdh0en2fj9hh5jh0whc;5:rix;2:9jl;4:fkjgjp;5:8fx9kx;4:1he3je8lk9izahdehffhfghchhfkhepk7qhgrn7th5wfz;1:3gf4hg6qz8h39gljgvqhfthduh9vnnwh3;2:wld;5:fj9;1:sj2;1:ciw;4:dt8ecxfhd;8:wkh;1:ckj;3:qkq;2:ajhbhdgj0;a:eiufgmul5;2:2nu7k9jhfoj0wh9;4:4mm;9:0he3k05iy8h79jxafdfl2gkjhh5jh3wk9;3:3kb8j9bhggmbwhd;3:ohdpk2;7:2lkhjajldphcqhergq;1:wl2;9:8kgbl8whg;1:jhdqjr;3:8go9ksehd;3:hj8jjb;4:6ko;1:8k7aiockedkrehefhbjhewh7;4:dh2elehh6;2:jmp;3:7h09l2aheckbfhhghcoheqnvwh7;1:qle;2:hj1;2:7hejhgkgpol0pl1;1:3jl5jajh8;4:8h99heagpbmxiisqkgsgs;5:hj8;8:dl7efg;3:ah6ck8qm8sgw;4:jherkiwjg;3:fiu;1:0im4h65h86hf7ju8hh9jbajcbk8cj3dizfh7ghfiinjgnkhflhfmhgnhgoh4ph3qj1riutheuhbwgm;1:cjfgiljjq;1:pjlqmv;1:bk8;1:2il;4:3hb9j5aiqcjkgkajhbkhglkophcqhcrh3;1:2jf5jn9hcajcbjyfhajjvkhdojpphdrhfwh1;1:rj7tk3;1:5j5;5:nj3qjo;1:1gt3h9ajibl4ehdfkskh3oo1rh8whf;3:0m5;1:hj4jjm;2:7mj;3:qkw;2:tj4;1:8hcdl7eh8mka;1:4kj;1:0k94gu;1:lkf;3:fjl;2:bhhcjzehdjiurl3;4:rk1;3:5kz9ilagxdh4ej6fjngg3hj6jhaqkfthfwh0;1:2mcaj6;1:jjtqkp;3:ag7flh;1:3n2aj8fh5lgurmgwhd;1:ek3;6:1ha3hd5kc7h69gpaizbh9cimfkqjjokhdohfphbshhtmewgo;1:2kw4l38h7dkoeh5jh9;b:8gvwm4;1:hgtlgrroe;6:0jauja;2:0hg3o5cj2wh9;3:1jv8h2aj6kju;1:9iu;4:eiz;2:nl9;9:bj3klelhg;1:cj4fhfglj;1:5j4;5:6hcukl;2:ajybl1fg7gl6whc;1:3jcukb;3:jjq;1:jkawh9;1:0ji1jk2gj4ke5hh6k67li9gsbhgchcgh8ijqkhclhdohdph1qgvthguh9wgd;1:2lp3jw8imqj1;2:lkargj;2:1ky;5:3ki;1:1hc4nm8j09l8ahccgtehbgl9hhfjhakhdohbpj9qhfshgwgz;1:8izrit;2:nke;4:9glelz;4:nh2pjs;4:2ik5j0giz;4:5jh;7:jgvpl3riq;4:gj4hjd;4:ojx;1:1hdfh9gkqhj7pherjisikwkg;3:8hgahfbh6chgfh8gh5hs8jj0rgtwhg;b:ljy;3:7ixak0fh8sj3;3:3j5;3:8j6;1:hgbjlp;1:2ma7hhjkfqhh;7:fhegkn;3:5io7gp9ipehcjkpnirrhatijwly;3:3nnsix;1:bl1chc;1:2k2;1:dkuegm;1:1gy3hf4h05o97hebhgdgwehdghfhjniiojlwphgqharhashgtheuizwjr;1:8im;2:hjg;7:ljc;1:bjzkhh;6:0l98j8agrbgwfk9gk5lh8qhgthfwka;2:4ixiivpm8whh;2:ijn;1:1hf9h9al7bjdehbfgurli;4:lhenmtok3phcwh5;3:bj0;4:8ha9j2dj3hirujx;6:plu;4:0k08hfkkxwhc;1:bm6;1:3j55nn9hd;1:jkv;1:1hfcjmkhgrma;b:8fz9olajoegwjgxqk0;6:0irijo;3:qkw;2:jji;f:8k79gt;2:1hh6hb7kd9h4ahcbkvcj1dipfh3gh1hklkhfphbqh9rhauhbwlh;1:0hb8hcak2bisdh5eh7fjnhjjrkb;2:0lc1k33j0bhfeitjhckh9ljargxwhf;1:0hd3p37j4ahefg1jkhphewgj;2:ujg;1:jjw;1:bh3cjt;1:cjl;1:ijo;2:bk4ejcjjiqhg;2:eh4um1;2:0gu1hf2k43h24gt5h26hg7h78hf9h3blicjcdh6fhbgh7hgyjj1kh8mhgojrpkkqiurmoshgthduhbwgi;5:9kcgmejgjsh5wjg;4:4ik8h99guah0bjhcoxfh6ghdphcwl1;8:qjq;4:3ki8iu;8:0gy1gy2hf3ip4h76ha7j88kudgsggzhjijjskgplhdmh5ojbpjmqjgsgxtgx;3:8jh;e:fgnuk5;6:uiz;1:bjj;1:1jh8ky9k9ahfbhbdioeiufhagiqhhcjhckhfwh5;1:jh0wo0;2:8om9fu;1:3heah7cfzdh6ej6ghdjh9kiwllvqhgrp0uikwh9;1:ej4hiljh6rk9tkzuhd;2:8h99irbhcgiwkkdlgoqjctlv;3:wla;1:0hc3he4iz8h09ilahachedkfel2fjugh4jitkj9pheqhcwh1;1:din;1:bkf;1:0hg1h53h94hbalgbischadjkegeggxhl3jgykgulh3nh6ohbph5qh9rletimukmwh2;4:lk2;1:bh6gkv;2:9jhajx;1:rix;1:hjr;1:jj2;5:0pfdhcel5fgbph3wfe;3:8h89haahbdk3el1fmkgherhewhd;2:8gs9j8ahcfh8jjiokxpkhqh9;2:9gjbiqclu;1:0is7gw8iujhcwlj;6:ejp;2:1ko3jg4j36jy7gp9ftahcbhceh0giuhh8jjgkhelimmhhohdph8rg4thduj1vka;2:1h52hf3h34h86h97jg8iz9luaktbkecileg0fiphh1jh9kh4lhemjpoh9pioqjmrg6shfth4ugtwhf;3:ahadk1ehgfirgh9tkkukq;1:qji;2:9jy;2:bjijjm;4:1gt2g93hd8gt9jpahbbkaoo5qk7whh;6:1haajsfhflh3rmiwkp;1:eji;2:8h1chadj2ektrm7;6:4oj;2:khgngupob;4:0f23mt;1:jgupl6;1:jhfumm;3:hhgjjq;3:1m86h97h28gbagybkrch3dh9eh7fgqggnjh6lh5mh5oiqpgmrissjftj8uj9;3:hherjv;1:0jj2j33ji4hgdjyggzhivjhfqherhg;1:5mh;1:2l34ggjhgphfsiuvn8;1:cje;2:rks;1:3j7;1:0hg4jh8jw9gbbh9dmmefefjaghgklbnhfphfqhfrh6tjbuitwhb;8:gn3jgwqkmwhe;3:6l1;1:2io;2:mmn;3:fik;2:0lv3h7ahebipdkjejnfiqhiljhcqhbwhb;4:njs;a:0jq;8:cm9rgw;3:2hd3hf6hg8gm9ixairbhcchhdh2ehbgh9jgwohephhrhasknusuwh6;3:ina;4:pnnwha;2:2l94lijhc;2:jje;1:qk8;2:hkd;3:sjl;1:8ja9h8cj2eirfj4jhgqj5;5:sj6;8:eis;1:5j3;3:4lb8h7;3:1jy;5:1j2fh9gkb;5:dgpem9;1:0ga3jnflt;9:0iteh3fk6gis;3:8ilgko;3:cjghkb;3:1k9rgy;1:wjs;6:gj5;1:8k4;4:jhfphdqkzwl4;3:qkw;3:7haongphe;1:1jk;1:5msdh4ej7fhbkhhnkm;2:cjkej3fk0;2:0j31h42he3fz4jw6h97ha8mo9h5ah7bilch5dh6eh7fhbggxhhdjjekgqlhenh9okdpj9qjhshatlougowgn;1:cio;1:4jcbhgcn0kix;3:alg;c:8h99hcehctolwhg;2:diveh8;1:wje;3:1lp4jgajifh4gh6ih9khelk0nj2ohbphhqh6rh1wl7;3:gir;3:0l01h84hc6hd7hgagpbildizegmfioggwhleihekhfohcpjdqh2rh9thauiqwj9;6:8h69kpaj8cizfhgmm7ugz;1:aheckruiv;3:8ju9gxcl4rg1;5:wjh;1:hguqjl;1:ghesinukr;1:ch9fk1;3:1is3hf6hd7hc8j39gzbj5cipdgseiuhj6jgvkiolimnjnoh3tiy;3:4kd8joihc;7:4hfuke;2:sil;1:5jg;1:oh4pld;2:8nl9j3ajobh1cjaegwripwh8;1:6mm;3:ahefkf;8:8g29m4;1:2lh;1:1jr8ji9iwah4eipfjigj9jhgqjqwhd;2:9j9cllgh2wjm;3:1js4gz6hg7hd8km9jkajigh0ijcjgzmimnhdpgytgyuh7wh4;1:8h79hgahcbgkcqcfh7glbrhf;1:pkd;1:gip;2:khfnlcojipku;5:iiz;2:9ix;9:jk6;2:dhbejm;1:ujv;3:tjw;4:wnu;1:nl4;3:qjj;1:cjo;1:8jw9gzcl5rg1;2:ljj;4:0h71io3jj5kh6gv7k38jj9g1ch9dh5eh1fgwghfhhbjkqkgpmiooj1pj1qg8rhcthfuh1wis;2:blgljgrhd;a:jh9rkk;8:dlkegs;7:ah7ujn;1:8j9;4:0kb3fxahdjheqlksj1;c:3hd5l56ka8hcehbijlqhatjhwjv;5:1hgrk5;4:1kw3mi4j65nh6he7h78h29h7dh9ehgfh7gipohcph5rg6thduhg;6:nk4;1:ah7fjgqiqwmp;2:1hf2ft3hf7ly8gm9k8anfbhddhffgcgh1hhajjoohfph8qiwrkjsgruiuwgu;5:0j7giojivsit;4:6gh8il9jhal3bhcck4ehcfh1hj2jgskj2phfqirrh7ugzvl3wh3;2:eiplm3;4:bhglhewl6;1:8ka9gj;1:jjc;4:0h78k0bn6kha;1:3l9;4:gioiil;1:3hg5lbmlbwhf;3:dj5;1:pln;3:ggdsjyulh;3:hkb;2:njgojl;2:rin;3:1k6;3:ciy;8:8kr9hablrehe;3:dhdegvjm7;1:8gg9m5;1:jgqqkswjv;2:8hgghghjfij4jjnok9rjvwhg;6:tkp;2:2j6kh9nk2okhphc;7:jhfohbpjurjrujf;1:fh8gkf;2:kin;6:nhfolgphf;1:ahejjiskf;1:1j42iw3hb4hf5j56ha7jsah9dj2filgh6hikjgikjtlhbngvojbphbthauj7wgb;6:qjq;1:gjp;2:1hd8h6alhblachaghfhhhjheko6lh4wgz;1:1j3jjg;3:dim;1:7odgk2jguwh0;3:1ly;5:tjq;2:bjl;2:agmfg3grmhkyjhewh9;4:8ir;1:kjm;c:0hb8hcak2bisdh5eh7fjnhjjrkb;2:jjdnjfojb;3:2m13l34j85hh7hgjhb;6:jh7oh2qmi;1:9jh;6:jji;5:eka;3:wk4;1:0hb8hcak2bisdh5eh7fjnhjjrkb;1:0h83h35hd6ja8ll9iobgxej8fh1jgfmhepgzqgwshetiquhcvizwix;2:jk8;7:ajr;5:gj5;1:8hfkjy;2:8jn9jpaj0bkmehefiuuhcwhe;4:8kobh9hiqjhfrkd;1:pjx;4:min;1:5j0;3:nkuwk6;2:8ir;g:4l0ah8;1:0inhiotl9uh7;1:rje;1:8h6ahcbh5chffh4gh3hs8jkmrgswh6;1:6n09kbehdgkrqhgwh7;1:1j29h5biqcpodgoegughbhgujhbkirlh8qhgrkqwh2;1:fkeiio;1:ciy;3:6kf;1:rir;4:0ha1gl3ha4io5hf7hd8hg9kbch6dh3eh6fgrggfhmhjiukivlhemh5njyoh3pgoqh0rj2sjuujz;2:ej2fkdgjlhghjjl;2:rjy;2:3jd5lnjh1;2:ggrhkpwkb;4:lkf;2:kjm;7:8isfiq;1:hj6;3:uk6;2:ajyfjb;4:fj9;1:8hfak3;1:ujd;2:0hc1gx3h44hc5kn6kj7h29h5firjgckixlhfmj0nhepgzqgkrj4uizvis;1:djleh6flc;3:8lz9gfdgyek9ghcqjmrk8wh0;2:0ix;1:1he3hc4hd6gx7gu8jr9fsaj3bksckdeipfj6githh4iinjgfkhanj7ohephdqh0rh7shathbukiwj7;3:0j48hcqimrk1tn0uhgwhf;7:8iy9jy;3:bjc;1:8hcej2hjxjlewhc;7:ojh;1:5ismiowkg;6:rgatmw;1:1gz2h33hd4n76lyah4fjeginohcphasitwhd;2:3ir;3:1gv3hg8h19lmakibh8ghbjh4kheqhgrl5wiq;1:5j5;4:2kz;2:qku;7:0he4io8gx9grahadn4eltfl5ghgjheuhdwhc;1:fj8;2:1hbdhghj1jjhniprke;3:6mo;3:7fuclrjl1ok4wh7;3:8itchcelefjfuiw;1:gjs;3:kheljprhdwkp;1:dh8ela;3:tj8;2:fjs;7:1hefh6gkphj6jhdrjhsj8tj5;2:9iodio;8:3hc4k55lv8hb9hfagrbhhdhgfjzgh6hhgjgqphfqhbsmiwh3;2:1kl3h17h68h89jyajqbm3cildhdegmgh6jl0kjonhdph9qh9rhbuh7wgj;8:fj0;1:8k79gt;2:biu;1:8jakjf;2:bjxckm;6:2je5jl8h7ghhjhfkhanovojfph2wgq;1:cio;3:gmq;1:rij;4:8hhak5cjxfk3rhb;1:lk2;2:9ixeinuk3vh7;1:0ha1hb3hc4ir5isbiwcmwdhdij4jgvkiwlhgnhhphbrinwh0;3:rin;d:agtbk1;5:mmf;1:eit;1:hjy;8:njf;4:fjh;1:ajk;1:7m0;5:fhegkn;1:uk4;3:5jg;2:9io;1:wld;3:jkk;2:3ks;2:iij;2:5j9gk2;2:2il7hc8hg9heah9bh3fgygjbhgkjlukjflisnizphgqlcrhbwh3;2:tjz;2:0jhpjpwj7;2:3he4hd6h19ipblwegvgjmjgyoixphhqharhdth7ulkvjkwgr;1:0j82hf4k35hh6hb7gy8gz9iuahbbkjchgeirij9jgwkgvlljmhhqgysheuh1wgc;1:gjt;1:8j6;2:9ir;4:djr;1:bl9fhggjjhiwojo;4:8jcdh8ej2jmoqhgwhc;4:0h81h72k23j04go5h26l37gz8jyahabh2dh0fh0gh2hh7jhbkh0lh0mhanitoizpirqgvroishbtgwuiq;2:8k79j1dinjjwwhe;8:hkajh0mkvwj1;1:1ix2iq6j4gh1hhhliuoj5qgith6;2:njowj6;1:0iuah2bjv;1:ck6;2:2k84h6;c:aktdivhjijh2sh9;1:0f43mgah9fkflja;7:rjp;3:hiztlo;5:3l0;4:ajl;4:djbehe;2:1h53hd5ka6hd7gyagvdgxeikfj6gg5kgymj2nj3ojcph4qjerl3th9uh9wjg;2:wj8;1:2k2;3:4jecn4;6:0li6os7h6jhdphbqh3wh3;4:8ld9hcjjrkhf;6:cka;4:jkd;1:jh6qom;1:5kb8jk;1:4iycn7;1:1jx4k9fjiigrrgywj9;6:bisdj0ukj;5:ej7giy;1:8h69h5eksrivuil;1:rgbtlo;2:8ha9k5eha;1:1he9h4ahdbktcinehdfh0hhgkk4rljtiu;2:8jr9kcehc;8:0h91hg8hcdgrelrkgwlh9ngappb;3:qkw;2:0j78h9dkveharjpuit;1:9is;1:1hg3jcdimgku;3:8heamkdh6eg6fkduhb;4:cjhrj5;b:iil;1:8j1;6:2in;1:ujl;4:3jx4h68jl9ltbirdjaehchhdkgxlhhqhcuh2;d:6mv8ke9h2agqbjjfhdlhgphaqhauktwh6;2:rlq;1:hiq;1:ajl;2:0k4mjxoit;3:2iv8jh;1:4j5;4:qji;1:6fuojjwm5;2:1gm3hg9haagvbh5cjzdguehhgh8hkwjh0kiornttjsuh9whc;2:qlb;4:ql1;1:1h74hc7h68gv9hdaiqegzfgzjh4knlmk2nk5olkpj9qhdshcuhcwhd;5:9mdegfhhajlg;4:5j0;3:9iz;1:0he1hb2j63h94kq6jn7lv8gu9gbah6bm7ck2dhgeh0fh4gguhhfjimkgulhdmhhogvpj4qheripuh6wgh;7:wm8;3:his;4:bkd;6:ijv;4:7nkogwph8;5:aj7jlkqhf;4:3la8h9mjnnil;2:bjh;3:qjb;5:0hg1jj4hf7hc9j9ahebj5civehcfhegh7hhdjiykgylhamk9nhdohhpjzqjbrg2tj3uhdwgs;2:1jr7k8khe;2:3k38h29hfbl4dhaeitfhgjjpkh6nhfok0ph0qgyrhgsleuhfwhc;1:pln;4:hgkjjx;3:9hekoplhdngsphg;3:0jd6l87l58g79haagibgbcgsdhdegcggshgqpkgqjyrgtshdth7ugvvj2wjr;1:2m88hb9j5ehgwhh;4:2fz7kr;2:wkd;1:pjf;1:0he1h92hd4hc5hc6go7n4bimdglfglggihj4jnhkizlhamiynhgoh0piqrh3shctj5uh4wgv;5:0gz1nj3he8h69h3ah9bhhcj3dhcehbfhehjtjgtpheqhcro9uh5wgy;8:citlldnhgoituj7;1:8j99kxcjieh5fh4jk0khgrjwugt;1:0hf1h42hc3he4h65hd6h27h28la9juaj1cgxdh5egqgh0hh6kjrlgoojppiqqhasioth0uilwl4;4:0jh1h23kg8h19hcajcbiycj6fhchhajh6kk9mj8qj5rgwsh5uhcwh0;2:8j6;1:fheglnhka;1:0kq3gb;1:6kx7mophhwha;4:sis;3:4mfbjd;5:jgupl6;2:ukf;4:uio;2:hgrnl7qje;1:7m5bghch5glnjhdqlrwgw;3:3ki;1:4ikliu;3:ah7fgqgm5jhesj4;2:dk9efzpkb;1:mlyrgq;7:8k69j5;b:7lw8em9mxdhhehgfgihjpukcwim;3:km5;7:cjnrha;c:hkrrh4;2:bjm;2:9j1wmb;1:8jbekd;5:dn0egwnheol4phf;1:0hg1jy;2:8kd;1:4lsjhf;2:8m99mdbhdehejhfkh4oj9uhfwhg;5:oo8whb;3:fjw;7:tj4;3:8j19h9;4:dh2elehh6;4:jjj;1:1gugmlkh4lnbnh2phdrglwkq;1:1jf2gg3h37h69h0agocivghahk9jghkiolhapharkutkkuh8vldwh7;1:8jodjrektjhg;3:andkhcsit;3:8hfcjuwku;2:updwh8;2:1hf8h39heah7bgocopfh6hhejhfkijmpvohhphgrh9wh4;1:0hc1h73jg4h68h8ah1irsjhhuixwh9;2:fgqgmb;1:djn;1:0l11hc3ku4hc8ineirghdik3jh9qjmsgrwh8;1:4n38j89l8bgjch7dijegvghbjh6khcoh5pj2wj0;1:2me;1:3hc7kt;1:8gwtn8wh8;1:dltehe;2:1hg3he4hg7hb8h29inapcdhhfg6ghejj3khaohbphbqh7smbuixwh3;1:1l7rhc;3:qlz;1:0lo2hh3h18j7ah8bildkeejjjj0khgqh7thguhfwh8;3:8m89gojh8rkh;1:ejo;4:0hd6hd9j8ah0biseh8fjrgh5hm7jikkhelhbphfqharhbth9ukowit;5:jgqqkswjv;2:8h79jpcjewjn;1:7j9;5:3ke4m5jh5phgqj5ukhwh6;2:1k02j27hc8hccjjfhbghbhjsjh8khgokmqlzuhawgl;1:1j4;8:8jt;2:njf;2:0jb;4:9iueju;1:akzjh8sh9;2:jj0kkd;4:ljw;3:8jw9gzcl5rg1;1:4mx6k7wio;5:ait;5:km5;4:2ltjha;1:8gm9l9dkdegqpjdwhc;3:dj4;4:8ke9h4ehf;1:tjz;2:1hh4hd8fm9k8ah6cheijalhenlephfriusjbuli;1:1ismmcrhc;2:8it;2:hgxjlq;2:8jbekd;2:3iw;2:llp;1:hjm;5:rj5;1:jkw;1:qku;7:qkpuku;2:2hg3m2;2:jjv;1:8g29kwrj7uk4;4:8im;5:7jt;3:0jb3h84gr9hdbhhdljeh4fhbgkfhgrijgjjgqhasgswlp;7:flsqj1;5:qle;1:fk6sirtj2;4:pkm;3:ag6fg9jh0wo0;1:ukk;7:8j6cjo;2:ol0;1:eit;1:2jc;1:8h6ahdukz;2:wjr;1:rjl;1:lj6;5:2gf8h19jraljfgzojnpkvwhh;a:gl2;3:1mtrgy;1:hjx;2:0isahddixeh6fhcnj7wkl;4:njgol2;2:akrfgj;2:7lvwhf;5:8iweip;4:cjn;7:gj4slu;2:1ld3kg4jj7hg8h5dhagjcjj5phfqiqrgawix;2:cjr;6:jl5wh3;3:jkjnik;2:dkd;1:8j2;1:8hbcjzfn0;1:njnoki;2:jim;2:0h84h9ilv;1:ngspn7;2:ujg;7:8j6ahabkach7egzfh5ggfjh8kj8lk4njgohcph2qiutipwle;3:9jpgj8sis;1:5iw;c:4oj;2:0j18h9jm3qhg;2:oja;2:1h93hf4k8uizwki;2:8gkgnw;2:1he2hg6kj8lt9jaah5bh4dktejlfh8hh2jh1khgoh8pj5qjith5ugxwgo;1:8gl9gkahfbj6chfdixeo1fjpgh7jj0khewh9;1:1j04lgjj9;2:9jw;4:rlmtjd;2:1lerhd;5:2k3;c:9ilehfnmfojkpjk;1:tj0;1:1hdailjh8kj5oh8rm9wis;2:bkd;6:tma;2:1itgh8jn4ljpphgqhf;1:1je2lj4hc5lc9iqahgbhgch3eheijhjiukjqnhhqhbrguwh5;1:0hf3nv7hh8izehgjh0ujgwgx;4:1h22jv3hc6gy7hc8fu9k3ahhdjgegcfhdghehhgjgzkhfmnsnhbohfpjkqh8tjfuilvk4wgh;3:1is3kf8hbbkk;3:8lr9h5ak3dnnegjfh1rhbthb;1:jiw;2:aix;1:6hgwmi;4:sjk;3:2g87ke;4:0lj1go4ktah5;d:7kk;1:0h86ha8haajfbhdchfdjcfgfgoohhajkikhcoh9pjmqipuhfwhb;2:0ip1hg2hc3jt8k89ngah5chadheegtfhhghgjklqh9riyuh7wh1;a:0nu1gi3ir;1:0h91io2hc3h84gm5hc6h77h89gvagwbgtch4dh6ehcfilggvhh9jh2kkalldmisnonogxpj0qgysjqtjgwgq;2:gix;2:5p6bixfhcjhf;2:bm2rhh;1:dh5ejf;2:0h85he8gp9mmahbbgockkekgfipghdhhcjhbkhhqhdrkgsitwh7;2:1hf8gibl4rimwls;2:8k0bhgciyqjn;1:0jkwjb;3:0gz8gw9h7dmlek5jhfqjg;2:lhhrkq;1:tleuhc;2:0h86hb8h29grak3bh4ch4divejkfm8glwohephcqh4rgusgqthfuk5wgu;1:2kz;5:eis;2:1hc4hh8fi9j2apjbhdch8eh8ggvhh5jh5kh6lh3njpohgph8qlksiuujqwgn;1:aj9;4:dh1ejp;2:2k3;2:4j0;2:qji;2:bj0;1:ljw;2:0in8jf9j0aj8cimehhgh7hhbjgrphdqiyrl9uhg;1:8jb9jydjjekhpkqrhcthd;4:1hd8hbal3blichdfgyhhgjhfkoilh4rijwgz;1:fhegkn;5:mkl;2:mkl;4:bhglhewl6;6:ljp;4:fik;2:sj9;2:0gu1gx2hd4h96hb9kjegyfimggqkgmlhbmh7njaok3pilsjjtgwuilwhd;2:fhagkvhjm;1:0il4h55h96hg7jp9j6aj2bl8divehgfipghgij2jgrkhamhhnhgohcph5qh2rj2thfuhbwgo;1:ej1;2:bkachd;2:eh2kna;1:9lqej9;3:bkf;1:5ip;8:aj7fh7;7:nix;1:lkf;1:jj9;1:8g99jpek2;1:1k6;6:wlp;1:2ltjha;1:jjx;2:elnhh7;5:8jb9jydjjekhpkqrhcthd;3:plq;5:ljw;a:1h65ku8hh9irdkvehdfhdghghhhjh9rl2uip;a:ujc;e:4jbblmcjr;2:ejynmaphf;a:fhfgjm;1:clswje;3:6l1;1:9jo;2:8gy9koalxfgfwhf;1:tkt;5:9lsjhfplzwh2;b:0imnje;1:8ku9llajrblcch5ehafgzjh3kjhnhgrhduh5wh5;3:8h09k1;2:8hg9imnkvohf;1:0na4g8hiyihdwk1;1:wnu;2:rj6;2:bk0ckzfhagl4wh5;3:aj8dir;1:2hd6h57gy8iq9grajkbjecisej1fj0hhaijgjh7kjsnjgoh8pgyqh8uil;6:1hg7gn8ikehdjkskgrmnkogrpgurgqtilwlt;3:jharkn;1:ijnqmq;8:4ljdixjh4ukf;3:ljy;3:nje;1:0ha4hg5hc8k79miah8bgnck2dhgekugh7hjgjh2khbphcqh6rj7uhdwgy;4:7j18j9eka;1:3mvbjocio;7:7nf;8:0m5;3:0iq7gd8isiirjgysjawlb;1:aj9;8:km4;3:qlp;2:8h99l0ajicj5;1:8j09jifjo;1:7kp;1:ojywks;5:rj8;2:tjx;1:bk6;4:5hf9hfagcbhecjtfpkgj6hiqphewhc;4:dk8;5:nkx;1:7mhbio;1:plu;3:ditejifim;6:0hg6ioahdhjcjhelk1oippheqip;3:lj4;2:ajm;1:nh2pnt;9:ul1;9:1h99hacl9hjkrfatl3;1:diw;8:tjl;3:9hadk6eh8;3:kgxmszwh9;1:dk8;4:8hdgkm;2:giruij;2:9ipuk6;1:1eu9gyah6bh8chcehafhdggsjhckowljznjfohbph4qivtiuwlg;3:ahcfjw;2:ejkfh8;2:8jikjjsipwjo;3:tjf;1:6lyvgq;1:0ja8j59imajrbiqfh5jh4rjywip;1:8h6glf;2:8hebln;1:njj;4:hjbplgwhf;1:9hbjktniu;5:0l51gq;1:2jo5jzbirjhangxokawk7;1:ajycinkit;2:0h76ha8heah5chgdjefgugozhhajksohdpjqqiuuhfwhc;1:8h9ahdhiokjtlkkrlqwhd;3:8gv9kb;9:3j48hcch6ghchirkj0oitvir;6:gk2;2:9ipdm7eh3jhf;1:0kl3ko4hb8ikeiqfhgghbik1jh7ninqjirhfsgrwh6;2:pmb;1:ljj;1:4jrihhkh9lkfnldrg7;6:fh9glvhjd;1:km9;3:sjb;1:njr;2:uj3;1:hip;1:8is9j9ck3dikeizfhdhjn;3:1l3bhdjjyqj3wjq;3:cizfmb;2:2me;3:8hgbjydhaekxjj4qh6tjr;1:alnffq;1:ljw;2:jjw;4:ahefkn;1:fjb;2:bjn;5:0hg5kd6nm7h38hegghjgtogypjjqikrhcugovlywj9;5:4le;2:3kd4hg6hd8h4ahddjoegvfk9gjmjmimj8phgqheuh5wh2;2:1ko;3:uio;4:4hgngwpmwuj7;1:5jg;1:cizhj0;1:qjx;2:8l99gpehfkk6lkytjawg9;5:agljhhsl3tk7;3:5ix6haqjoul3;1:ujg;2:2kc4iy7jy;5:wlm;4:8gy9jthj3uj3;7:8ha9jv;2:0jg;2:jh9sks;3:2ivdjm;9:1jcrhg;2:dk1ehf;2:4mj;2:8jskh5ll4nittjewgj;1:bjj;2:pkd;1:nlb;3:fjh;1:bil;2:ahcfjw;5:pn8wha;9:dj1;2:eiw;2:jltwh5;3:jh5qiywog;1:ljc;3:kh9nko;2:9ix;1:wkw;1:9hfbiu;3:rjn;3:9jndhdeilgj8sir;2:8jljhc;7:4jnblkcjq;2:aj9;2:8j8;1:tjz;2:7mj;1:1iz4iy;5:nmephg;2:hkgriq;4:9hadk6eh8;1:1ld2g97hfwlu;4:1hcajwrlr;2:0hb1hb3hd8l49mlajzbmpcfudhgegcfgzgh8hhbjh6km8lh9ngyohfph8qj6rhfthcuhcwgu;2:fk8njasj4;2:jj2;1:ilt;4:8jotj3;1:djc;3:dhgekculb;3:fl0;1:njwohg;1:giqrjctjq;1:1h73im7hg8lkalfbh6ch3egqgh7hjkiijjghkh7miurjcthhuh6wje;4:ukb;8:aix;7:1hgdhbej2fkhkgulh7ngbpoz;6:jjq;1:8h29gthns;5:0ke;3:3ki;1:lkm;2:8h4al4dhbfh2hhajgsmjcum7wkc;3:1ha3j45hd6hg8kc9ilah5dh6fhagh2hhakhblhenhdohgpjnqh6rmbslytgwuhfwir;8:wky;1:ahgckt;1:aisujl;1:gjb;2:ijp;6:fh9hk4qjk;1:2iw;4:1kzfhegjfukhwhg;2:oh4plb;2:fjw;1:qno;1:cjnrha;3:ujg;4:ujg;2:4j2dir;1:4j5;4:hhgjjq;1:4le;1:2hgiov;1:0iw;1:lk9;3:ik9;6:dipujq;3:9jtdj3;2:7j7;2:jkw;b:djqejv;3:bjj;1:2jy8h19gschhehghnp;1:aix;7:rj6wkz;1:aimbmbfh6jh8kmwlhbmikoh1wiv;4:9j2;2:dk4egu;8:0h73it4h9ils;5:0hd1n13hc4h88hegkbhguikujkvkgsngzwhd;5:3jvbj3jhfsip;2:8h6eisjhcmmgqjguhgwk9;6:3o3ahfffxhj7;1:8mj;4:il8;1:0he1hg3hb4jm6he7ja8gz9hbah2bhgdj0eixggzigsnhfph1qkmriytjbum7wgb;3:9hadk4eh9iiv;1:3j2;1:3io;4:5ip;2:ina;7:6l7jh4qgyrhcukyvmlwj5;1:wjw;2:1h4gnmrh3;2:3ir;2:nlm;1:5m76h3;5:jharkn;2:8f99mhhkg;1:jh9sks;3:eio;1:jgupl6;1:8ip9ja;2:rjr;3:6kvgjz;1:jhbrka;2:8h1aktbh5fisij5kkm;1:4lb;3:biu;1:cis;6:uiq;1:jkp;2:0k64ns8jcjgtphfwh4;2:jhewlm;2:1hfbjsmm8rk7;2:9kwaimbkcch3kktngv;2:8h7llp;1:9j3eipnjk;2:3mc8h19hfajnbj2cjsfhgkjnuhhwhe;1:3jr4j38is9h5aivciodhffizjgqqirrhgwju;5:8ha9gjdkqel2;3:ciz;1:1gu3h85hg6hd7hd8k29h8ak2bgtdhfehagjkhh7ij2lllnj8ogvph2qgz;3:fiq;4:5km8ikjhbphcrk8sk7tjm;2:jitsivuix;2:jgywkf;2:8jj9jyah6ckcehb;1:3jx;4:aipfgvjhaogcpo1sip;4:1kn3h84hf5iy6hd7h19jachcehcflagjxhh7jgbkhclhfmhgoh7ph6thaujf;i:9iueju;4:ij4jik;2:mjg;3:jgyqki;1:fhegjyjjs;4:ljw;1:tjz;2:fh8gkf;1:uiq;4:jjl;3:ciz;1:8jj9gpairbljehdriq;2:5iqblgdh7fhbjmekjvqhfrh5whd;1:djpris;1:1k9;1:0h51h54h95j19h4aixbjhchddjeegqhk9jgbkh1lh9mionkuoh4ph7rimth9wik;7:8ip;1:rimtja;3:8jv;1:jiw;1:0h61hc3iu7ij8jc9j8chhdjlejefhgghcjhfkhdphdwil;1:hj6jhc;1:8iv;2:lh5nno;4:7lvwhf;2:8j09juaikbhfcjmeh1fj9;8:8jddhgejurh8;1:9heam2;9:4keoj5;1:6h8phdqplwh3;1:gn3jgwqkmwhe;3:1ha5hb8gk9h2akebhccgufmbgiqhh7khhqhariwtnswh6;2:rjy;5:njf;1:0h6ah6fle;2:dj1eh8;3:1hd8ha9mualgbhdchffh9jhbrjjwha;4:okk;2:8ld9giagxdkyejafjqghghhejk2uhdwh3;3:1he2k63hb7hb8fw9jzagubincmddh9ekcgj7jikkiuohaph9qhcwgr;6:8j8tj3;2:0hc2jd4he7hg8kv9jfah6bk9ciydfwel1fizgh5jhckhdphdqhcrgjtituiuwh9;2:1h9olu;1:8gxbj2gld;1:pkz;1:hgvjmpshg;3:3ha4m06he8h59gvagpchhdhbegtfjhgkoihbjl0nimphgsj1wha;3:3k8jhawjt;3:ujz;1:1m42fb3hc4hg6h57r89hcah8bh9chaehcfhbgh5jjkkh0lhfmh8nhcoj3pgeqiwrh4sjhthcuhd;5:jjg;5:jjx;2:rj2;1:1jb2k23hb4h56jr7k88h8aiobhfch6dgphhgoj5ph1qh4sheuhavhdwip;7:3iw;1:1iv;9:0kh3gx7k28h99hhagwcivdh5fjogh7hhajgophfqj0rl3wkc;1:8ir;1:5lo;6:4kadizpjn;1:dj6uj2;2:akcfhe;2:amjjgmsk6;1:1hh3h65n56jb7hc9ioag8bhgch8dhfegzfgqgh5hm2iixjh1kh9lh7mhhniwoh0ph9qjashetjuuhcwio;1:1lk2gf;7:hki;1:jkw;2:0hg3o0whd;1:tj4;1:3ky5lq6l67hgagmcl9fgsghbhh6jivoheph7qh6rivwgp;2:ojf;1:mlyrgq;2:tkp;2:8hdjkw;2:cis;1:0iz5jcbhaghbhmmjgtnl2qhcrhbwhd;4:5lg8gi9jcfhdgjt;3:fjeghf;3:jlj;2:dk7egi;2:akcfhe;4:sj6;2:wje;5:pn5rinwha;2:dj5;5:ljs;3:0jb;4:4kg5lf7jmbgycjyjh5qjbrgrwhd;c:nje;1:4hb5qljgswhg;5:qjktjc;2:jkb;3:1jy9ikbl6ijbkgwwhf;1:ek6pka;2:6gxdj2upmvgu;2:1hg2h14ha6k27mr9gzahebhddfzek0fh2ghajgvkhamhgnkrojwpgwqgyrhdsjxthguhbwit;7:djhfh6klooh7pks;8:jkw;2:ujbwjh;2:1l8nhf;2:1iv;1:qku;1:1md9jd;2:1hh7hf8gw9iuaizblsdgneipfj7hhajinkh1misnjpphdqherj8wh1;a:jlz;1:flv;5:9jjcil;6:1is9jxjgvkktqkj;1:gl0;3:kh9ohcpm8;3:ggrqjy;2:6ogphfqh6whd;3:2lu3hf7gz8hf9haehemk1qh5rk3wky;1:4kp6hf8h2jilonn;4:dhbejljip;1:4lm;5:9hgaixcm0gh6hk5iiqjh6khhqhfsjqwhd;5:0s11jc3gt6hhghfjh7qhgwh7;2:sil;1:1hf2ik3ha4k35im6hf7h89hdbitchfdhcfhbgishkljgxkh7lh9mhgnlepjbqh1rh3thcuhd;1:ej1;2:hj1;1:8j09k2ajpbk9cj5egvfhckk4nhgwh9;3:0kr1glfhagkg;3:cka;4:4ko;1:3hg4kn8h29heah3cjcdl0eh9fhfjhcohdrjbskruh5;3:8jo;4:8iy9jy;b:8js;3:bj0sjg;6:gheph2qofwkj;1:qjv;6:0hf3jt8l99gkbikdgzek0wjx;1:jjn;3:0ix;1:wlx;1:pjf;2:3kw;1:2ij5iq;1:8jilh9rjx;2:fgnuk5;8:jjq;9:9fwcmveh2fherjw;7:bja;1:hj1tkm;1:6iw7jyok3wio;6:1hgohhpl9;1:1h53lu;2:4hgpmm;1:4j1;1:8ik;1:8h8ekcfhfhizjixpjbujqwgk;1:mjt;2:7nzqhawh9;6:gim;7:1kn3h98gs9h7alhbgqch1dh9ehbfk4ghghh9jh2klvlkxmhenhcok2ph8qhcrg9thduh8;9:jio;f:eiojhellz;1:tkp;2:2kp3hf4mr7h88hd9izah6bhcchfdh8fhaghgilcjgwkgvoh7pj3qh9uk4wha;9:0iw4ohdhf;3:wk8;2:8gxklz;3:3kw;9:8hhdjkejeqlxwhb;4:9grele;6:8gw9jvbjvchffltghd;4:8gtgjgwlt;1:6h58h1uncvklwhe;1:cir;1:hjc;1:jjw;1:bj2;3:to6;6:2ku4hfijf;5:kjn;2:bl5diwfh6gjghj5ojlwhh;1:4he5jn7k59hgblacgxehcfjaiikjhaqhhrjnwhe;2:hj2;9:5m4aiofjehisohbuj4;2:wnu;1:bkachd;1:2mn3jlwhg;2:0hc1h83hg4hb8hfis3;f:hgkjjx;2:8jy9h5djaeh5;a:4hgfimpmk;4:jjukjnqhf;3:fkg;1:mkl;4:ak2shc;2:5jcuka;2:bkf;1:8hfjgrkkgpl1;4:sj7;3:1izgjb;4:pln;1:lk7;2:4l8ejakhhljyrhb;1:rjg;1:hgzrkr;1:fk3;2:bhgcj1fjtgithhejhgkhalivngxpmsqjlrhdwhd;6:gip;3:jnmqh1wh3;4:khelnlohf;8:ujv;2:5ka;2:tlp;a:ahhujy;7:jkw;1:0hd3nl5l88h4dhbeghfodgh7jgzkgtphgqhcuhdwh2;1:sj5;1:9grcjz;2:7ko8jp;2:oke;4:8jj9hcahfbhdcj6fhchlajhfkjeqj1rg9tksuhc;a:eirhkx;1:0k11h14h66ha7je8h0ah3bj5cj8egpfgrggshjzihejl2kimlhhmiyohbph7qgrrj4;1:wl0;1:pmh;1:hio;3:8h99l0ajicj5;2:jkakhgljz;1:0k51kg2hd3gx4gk6hg7h98h4aj3cisdj7ej2fgogimjjvogrph6qh9thguh7wit;2:8kf9he;1:ggshku;1:tjz;3:ajp;6:ljr;2:8gu9gubhedg8en5klg;1:fjc;2:nh4pm0;1:qkf;2:3jwbj5jhg;1:jj5rj2sk6;2:8jd;1:tjz;1:2ij8ka;2:4m1ciu;4:ahgfhapkt;1:ek2hh6;1:2iq7hb8h39heciodhgjo2qlmwgs;3:8hg9hgtnf;4:ahcfjw;1:4ij;5:bl1chc;4:rir;2:8gr9kyakxchbfj2ghgqjnrjnthf;2:0kb3hd;5:wlx;1:dilmmqokbphcuh5;3:ah7ujn;5:ril;2:0hg9ipak4chcdijejqfj5;2:8l89gvah5nix;1:qlg;2:ujq;2:ejhfh0uk3;4:2ik;4:olp;3:7j2aj6;2:eitoh4pl9riu;2:0hc1l72he3h54h25hg6l97h59hcahbbf0chafgughcjgykn9lmomh6nhdolfqgyrgswgc;1:ahfckosiu;2:3mqfg5ogupl5;3:8ff9maeh7qkfshg;2:1ko;1:gk7;3:7kjjh9;2:5hgbkmrju;1:bjc;3:bjwcjf;5:4mr8im;1:tki;1:okj;1:9khwk8;3:bjd;3:agtfgxgmljh4okepk3qhgsjtwhg;2:sj1;3:agkfjphkbpjg;5:hj4;5:0pu7gujhfphhqhgwh9;1:jlr;1:gjn;3:wkv;5:8h09hbehahjaijetqowh8;1:cisqma;1:iin;1:dh0ek6jhepo2wh5;2:oh9pjt;3:7n9lj9whg;1:3he5oo7lj8hcbgjch6fh7gl7jgyphdqj5rhethdwgu;3:dit;6:hkrrh4;1:1ml3h95iogjrjjxrg9whc;2:djhegdpljsjd;2:0hc3h74hg8kj9hdgmajm3qh8rjtsh0uhewh0;1:rin;3:6ls8j6dhbejmjhbpjlqhfwha;8:jlr;1:3ks;1:ohdpk2;2:6j6;5:ajufh8;1:3iv8iy;1:ajijjj;3:iin;2:tk3;1:qk8;8:bjl;2:ij0;2:8jo9ikbmwdj5ejifgsgh8hgxjh6kh9nikqhhuhfwj8;1:dip;3:3n6ahffj1jhfljhriw;5:0iv;2:4lz5hgfhdjkfohdphdthgwlu;6:eiw;1:9io;1:wki;4:0lf3gc4la5he8h19iqbjhjh8rkfthg;3:7lhwhe;2:agtfheginom1;1:1kr3h98gt9h7allbgsch7dhaehbfk5hh9jh2kkrll0mhgnhgok4phaqhcrg9thduh9;5:0l53h64ld8hcahhcinejifisghchinjhgohbphguhgwhd;1:tjl;1:0h92h63h94g26gx7ri8h5ahfbh6chfehegheilljh4kh7oh2pmtrgrsjfuhewgq;4:0m56h9;2:1hh2hh3iw6kq7hb8h7bhechgeh8fhagh0hgnjkikhemhgnjyojipgxrhcthgukevlzwgr;2:jkb;3:0hg1nmrh3;3:nil;3:ekp;1:8r29dgandch7fgjjhgkhbwhd;1:0gk1h43gz4h95jm7hd8hh9j2ajcbokeh4fgwgjahjcjiskgvmh9nhgph6qkargtsgeth9ugswjm;1:2k94iv7jvkjy;4:njf;3:bl9fhggjjhiwojo;1:6ko;3:6ko;2:0jdbjtckhwha;3:4ij8heahgbgtcqvfharhg;3:8ha9j2dj3hirujx;5:4k5diphgujlhokophfshdwhg;4:3l6;2:bj6gio;d:9ilgjisj3;2:2j68jn9gadhaeirjiyqit;3:4izak0bjwch7dhhjiwsj3;7:jgypld;4:4hdik7qj6;1:bjy;4:0ixcjedfxek2iimqke;3:0iy;6:5j3jjs;2:1he8h89gyairchfehdjixrjstiluol;1:0gj1m67gvjherhhsl4;3:1ju2kw3j64lvdhhjh6rgvwhe;2:2nr7l0jhdoizwh7;1:dir;a:cjjdfyekb;2:fj8;1:njr;1:hik;1:sjl;1:dj6egwukk;1:ol9wlf;2:jim;2:hik;5:ejbjknwh6;5:tku;3:1l37hgqka;3:gli;1:8jj;2:0h51hc4hg6lz7hd8h69heajkdh1egtfjagj4hj3jh9lj1qhfrjs;2:2lv3k3qhf;5:ajl;1:ej6;4:olp;6:gim;4:gl2;2:pnoqhcwhf;2:0hd1hh4in8h79h4ap8bj5chefg6ghgil0jh2khgqhgrjswha;1:1h72gw4iq6ik9jjaj2ch2dgjejufgghgwkhbmjgnhbpgxrgstk7ujxwgg;3:9iw;3:bhddhcjjipheql2wm1;2:7l2rll;4:0ha1iv2ke4k95h66nk7h68iu9fnagqchadh9eh8fh0ggoih4jm7kh5lhfmhfnhaoh8ph1th4uhhvlzwgh;3:eja;1:hjt;6:tjq;2:1ps7g9wh6;2:8h19kn;4:hj0qjt;1:cis;2:wjw;3:5maairfjghitohdril;2:0h41h84h85mh6hd7h68gt9h9ajechhegyfjhgh4hlmjhbkhdmj7oh4ph8rj9shftgywiu;1:jk7;1:mlyrgq;1:bjjfju;1:sja;1:7mldl1eeyjjjphfrm0wh6;1:5km8ikjhbphcrk8sk7tjm;1:jh6wlt;5:4ojchdej4tir;4:bj0;2:7j6ohfpjk;2:5m2;4:8lt9gghiy;1:phewmf;3:0h91ko3hd4hd7he8hgaj2bhdcioehehimjhekhfrkwsj7uhe;1:njgojdqjp;4:flv;6:agmbjsgh4jl8qj8rh2smjuhfwhg;1:biymjcrki;2:mix;2:cizhj0;2:agxcjafkbhhfqjrrkctimwhf;2:bji;3:0h81h92hb3hf4iq8gy9hcagmbhcdh9eh9fluggthh8jj1khbol4ph2qitrj1uivwl7;2:cjn;5:4m3;4:tjq;7:tj4;2:ohdpk2;2:wko;4:8hbbkseh1fh4gj7hiyjh8mh6ojcqhdto2wh3;1:5jc6gr7hfjjjskavlqwhd;1:rjg;4:pnnwha;4:fj7tj7;2:ahbfgqpm7skbukdwhf;1:lk2;1:ej4qmt;1:mmf;1:lk9;4:kk4;1:8is;9:aiu;3:ghgsir;a:wkj;1:8jd;3:1ixcjxjh7;3:rj8;2:pln;1:jiw;7:8jm;3:ah4fheom3;1:njkojf;4:ekp;1:2gy3kocftfl2;4:bk8chcwjd;1:rjl;1:fk0;2:fj5;3:cis;3:8k59j5ah5fjcjjmpk5rhfwh3;2:jhapk6wli;1:8io;2:tl0;a:0h92hg3hc4hc6hb7hc8jq9gzaisbjucj4dg5ejfgiwhjljgrnjeoh5ph2qherhdshgtimwiu;5:siw;3:8j2;3:8ktoj0;1:5j0;3:8ji9hdah5ulg;5:4kzjjykhgljj;2:1liajhrha;a:pk0;3:bj6kjv;1:9j7;1:8g19lyakcbkkciteh5fgokkmnhhuhewhf;2:ijs;5:3hhwkj;1:1hf6j27jo8hhajjbh9chgfipghhjh9lhhml3nhhphbwl1;3:ainfh9gkl;5:2jh;2:7moghd;1:7hdejfjhekgpnj8oknpko;1:bhgdj8wms;2:8j1;1:tjz;4:0iq2h93jo5hg6hc7ha8hdahebjxchcdh7fh3hhfjk5khaoh8ph6qlorj2skoth2uh9wgs;3:cjn;7:aj7fh7;2:wik;1:8j6bgwek8kk1lit;2:bj9;1:7l98ikbjnjkqrjpwh4;1:8is;2:0js2im;1:7he9j7ej6fgijipsiuukq;1:1hf5j28jn9hcbgwdj7fijij0jhbkk5rje;2:giw;1:pkc;4:ais;3:2nu7k9jhfoj0wh9;9:8j2;2:bj6;3:5iqbinjhgminwkd;3:eiq;2:8mdiir;c:wjn;1:6m8;2:0iz;4:kin;1:cjn;3:6m0qhg;2:9gorkm;1:1jkoln;2:6h58h1uncvklwhe;1:blj;a:1lf3kh4jj7hg8ha9hfdhagjdjj6phfqiqrgawiy;3:hjajl6oh2wkm;2:8hdgkm;1:jj0;2:ak1;4:0j7giojivsit;2:cj3;3:5iz8gt9j8ahafhcnivojlphhtjwwk6;2:1hf3hg4hh8j99habjxfj0ghejhakj8lk3rkluhgwh5;1:eiq;1:4ku8hgbh1gglhgsjgnkjuqqtwh9;2:hik;5:fiq;3:9ip;1:2hgiov;2:khgngupob;2:jjt;2:7pm9hdhjbjg8qhdwhc;3:8jftji;1:2it;1:wlo;1:9ix;1:0h91gt8o0bjgch6ghcjhckkkmjaoh2phfwgr;2:lmrnh2;2:3ls4it8hfchhdhcjiorhfsixwk8;1:0ls3j9eiz;3:ik9;c:gim;2:wk8;3:5iq;1:8jxehc;4:jjo;2:hgajl8pjywl5;2:agycivdhgfks;3:ajlghfpkhqjlsgy;4:jjr;1:7pm9hcciwhjajg4qh9whc;4:rk5;2:1ha3lq;2:ah8hjo;2:8jo9p9akgchbdhbeh7jhgrhfwha;2:wk4;1:3jd4ix8itaikfh0gh9jl5qgywlv;1:0jh2j23jh4hbdjxggzhiuiinjhfqherhg;5:2il;3:rir;2:eir;1:4im;2:8jb9h9cj3eirfj4qj6;3:8heagyhnujj9qk0;4:fhegkn;5:eiv;2:uio;1:9iloln;1:4iz;2:5mv8h4gkqjhd;8:0hg1jt3m0nh2pn0rh8;1:1jq8k69g5bh9cjodkueftflbgh7whb;1:gjb;2:9j7;1:iiw;3:aik;3:8ja;2:2k44jvjh6;3:8kd;2:pkv;4:0jb;2:0hh8h09hbah8dk5eoffkyjhhthguhewhe;2:ogrplb;7:1gyhktrkh;2:mip;3:0kq1j04herh6;4:3he8hf9hgak2cj7dhdeh8fj2gixhjyjh4phaqhbrhasm5wj9;3:fhegizhkrjhgoh9wjt;6:8ip9jb;4:qkw;4:qjtwku;4:8gj9jwajvbl6fgruhewkg;3:dkpegr;4:0hb1io3hd4iw7hc8gv9ivah8chadkaekufjoghbjinkj6nhhohdphcwgy;1:0ix9j1;1:nip;2:gky;1:bjj;1:8h8fkjkgvlh7nkfoh9ph8rkutkuuh4;3:ejg;3:nj2;1:dis;2:ohdpk2;5:8jy9jvajpbimfh6jj4;1:0ki3ik4jd6hg7he9hbah1bhfdjeejuggxigsjhbkhgnhgphbrj2tj5ultwgw;2:eip;4:0lf3gc4la5he8h19iqbjhjh8rkfthg;4:1gx3hd5l37helk5nioqh8sirwl5;3:4j8fhegjw;2:0j5;3:ah7ujn;6:1is8jaekc;3:jkb;4:wk6;1:sil;3:9jk;6:mil;7:0h91ke6iu;5:hkd;3:1hdahgkkf;1:rlq;2:8gy9j3dp4eg8;1:8h7llp;1:hj0;2:5inhj9;1:ejp;3:8jg;3:5ip;4:ljw;1:bk2ogtpla;1:0io4k6hgtjlkoknphdshd;3:8hh9kk;4:8l5bl5fhhghewhf;2:7j9;2:gir;5:6k0rk9;2:hisuj8;4:1j2lk0;2:jjw;1:1j93k1dh7ej7ojdpjbwh9;2:9jlhj9;2:qkw;6:rj4;1:8k19h4;1:ahefkn;1:9jhbhegku;3:2kq8g79kpcjiehfjjc;2:djn;1:0iw;3:pkm;8:fir;5:mkj;5:8ji9hb;4:1iv;2:4h8il1;4:eiq;1:7hhahgbj1cjqkhflk7njwsizwhg;2:hjc;1:1md9jd;7:8hgukc;3:qlt;1:rio;1:hj2;1:8je9ha;4:fl0;1:rhftjg;6:8jd;3:1iv;1:1h72he3p64h95h4ahcbizchffh6ggshiqkh2mhgohdph6rggtj7vl5wgg;3:dj7;7:wk4;2:jk7;8:8h6glf;1:jk3wha;2:0hd3hc5hf6hc7naajkfgxghejh4lixohfpgwqk3rhdsiswk1;4:aj7jlkqhf;3:wm7;2:uiz;5:8jg9gyahebh7cizfhdghhhmnjh0kj9mj3qisrg2tl5uh8;2:4it9hebjrck1wk8;5:7kjjh9;2:0hb3is4h56hf7h88gx9h5ah7ch9ehgfhdgjlhmzjjqph7qjgrgrshbthduhbwju;8:8k09j7hk3;1:eke;1:0jj;4:mj3;2:nir;1:1hdahgkkf;1:7kc8j79hcakrbikcjaehgfh2gh1jhckjmlkfnhhpheqhdrhcwh1;1:4lx;3:9hfahefjsjhgmk8wlf;1:8mebh6kk7;1:jjv;1:8iy9jy;1:3he8kt9nlahcchgdhhegwjj0rj9uhawhf;4:8hc9imwm6;2:1lnrhb;3:rir;4:8kd;3:iji;4:7ixak0fh8sj3;3:0h92hg3hc4hc6hb7hc8jq9gzaisbjucj4dg5ejfgiwhjljgrnjeoh5ph2qherhdshgtimwiu;3:ejkfh8;1:gj7rjy;3:rjw;1:8jm9k4aivbjiehb;1:5k3nma;2:ukq;1:jkq;2:8gl9jl;c:1ha3lq;1:8jd;6:9io;3:ck6;6:4ji;2:gjf;8:3js;1:qn0;1:qjg;3:ujd;3:8gg9k2dhdel7fgg;5:0h31hf2jq3j74hg5jy6lt7jr8hc9glbh2chgdj3ehbfhfghchhhjgkmhhph2qh0rkeshdthhugxvjqwj8;1:njs;2:8ir9iuch9dheegefkdgknjh1niqqhgrh5sj1ujlwhe;1:1j2;2:tjl;1:lj0;4:8h59ktnjsok0;4:gjhhj9qjw;2:bj0;1:0ls3j9eiz;1:png;2:3h76k07jpaitbkpfh7gmtjhakh2phfqh4rh6theuhb;1:cgvrk4;1:mka;5:4jkciwdg0ek8;3:bjc;7:0m81jg3h24h66gj7gl8km9guahebhddh2ekfggzjgukh7lhhohfpkeqghrhguhewmx;2:5m76h3;1:0ha4hg5hc8k79miah8bgnck2dhgekugh7hjgjh2khbphcqh6rj7uhdwgy;2:6m1th7;7:0h21gy4h85ir6mm7gv9iuagrbjidhdehbggrhjrjh6kgulh2mjanhaoj2qghshctgyvjzwj1;2:3is9h0ahebkedojek5fgfghghherhfwh9;c:0h63nv4jy6hf7hc9gnagqbh8cjqdk0egpfh4ghbhjajgloggpk2qh8riosk2ugywgj;5:4knjgrohdskp;1:gmqjg7oh1phaqohwh0;2:2imahcbh5fh1gjhhgkjk8kjiliunj1qlvrhewhc;4:cjc;2:wkd;4:ek1;2:eiq;4:0h92in3gy4h65he6iw7gr8lw9isbgwejdfh2jgkkilmheqgxshftituhdvj3wip;1:gl2;3:ah7fjgqiqwmp;3:gjt;b:5j2;3:kllngy;3:7krbl9;2:hjm;4:1gt3h9ajibl4ehdfkskh3oo1rh8whf;1:cisghgjl4;1:sjl;1:ul3;3:0j3wkw;3:7k39jfajv;4:0jh;1:om5pfr;1:ghgjl6;3:niw;3:lmrnh2;1:7moghd;3:gmfjhg;1:4jc9miegf;4:njs;3:ahcej3fjp;2:bkxchh;4:9jb;4:6mhghghjb;2:qkuris;7:fkdojv;2:pls;6:pld;1:0kc1gv3gy4he8hbejgfirghbhikil0rjc;1:5ipahgdiueh3fotrhcul1whd;2:iij;8:lj4uip;1:8j09jifjo;2:3jbbj7fjs;4:0izfl1;6:5io8nj9hcaiudk4eh0jj0rhethguhbwh9;8:bk7jjrqhh;2:5k8;6:gmfjhg;5:cjehk9sit;1:8ks9ikbhdck1nir;1:jh9sks;1:0kt1jc2fn3ga4gu5h66go7or8gi9gsagqbj4cgrdh2egyfgrggvhh5jkxkjemitok7pgoqgprj2siztjgugs;2:3jw;2:4iq8iv9jgbhbclgeh1fiwwhg;1:dn5egw;2:fh8gkcsiwuk1;2:sit;1:gixrhetjf;1:rjy;2:8gu9je;3:givhjv;6:8gxbjachcfhagjrhhgqilrjjthcuhbwmx;1:qkq;3:alg;3:0kt1iu3h34gv7hc8h3ajcdjaeitfiwhj0ihbjhcriwwha;2:dj2ej8fjc;5:nj2;3:4hh8k59jwah1bh4djleldgivjhekh9nipqharh9siuwgz;2:1gm8hckli;1:rip;5:8imilr;2:3hhwkh;2:7j8;1:6hg8mu9gkah2bhfchffgvgpfhhejhcqiy;3:4lm;2:7ka;3:1hh7hf8gw9iuaizblsdgneipfj7hhajinkh1misnjpphdqherj8wh1;6:5je8jn;4:4is9h1ahebjqclrfhawjz;1:riy;1:1gv3nmah4djbehgfhcol9;2:9jc;1:sjj;4:2hg3m2;1:4heah8bgofjrhgriiwkjylgepjcrmuuiwwha;1:djceh8jk6tjs;1:rj2;5:8isej3;1:9gvejysjw;2:gjf;5:jj0;2:ajwfhf;2:0hg3ha4hgagtbh7cgzdnieoofl7ggqkhglhgohhphcqharh8theuipwh5;1:4jk;2:0l81j13gu4gh7ha8h6ajtcjfgh6hikiiwoh4phduhbwj9;1:3j0;2:8hg9ivsja;3:jhfphdqkzwl4;1:riy;3:ljy;1:ejg;1:1gp4h68gu9jsah9clighhhj1ijwkhglhfrk8tjt;4:bl9fhggjshiy;1:8h69j3ehcjjkrk0sisujiwj4;2:0ha1ha3h88gg9gfap4bh9cjbdguegefp3githjjjgkphfqh8rh0th7ugnwjd;2:0lw8k09gm;1:1j3wkf;1:9h9bj1cj5fk7hjg;1:7j18jk;4:ahcdgtfj9nj2wkn;3:9jl;1:ejhfk9ojs;4:8ju9gmck9egdhn0;3:8j8bj4gjhlhcnovph9wga;3:ij7plt;3:bkugj7khcrhg;2:ejh;3:gky;1:lm1;5:mkj;6:bhakgzlmz;1:9h8dnkegnghehj1jhdwku;4:civuji;2:ggrhkpwkb;1:sjp;1:ekp;4:3h98la9h3djyel9jhcrjluhe;1:bjxkhgqj8;1:jjm;2:cjjrj1;1:7l6;2:9j9;2:ojs;3:1ju2kw3j64lvdhhjh6rgvwhe;1:1lcdiwrhd;4:8jpjj8ukb;1:3he8kt9nlahcchgdhhegwjj0rj9uhawhf;1:ckc;2:ahehkk;1:ljp;1:qm8;1:ehgfjt;4:akehirjgzqj5six;3:bjm;3:9iwdjp;2:ljc;1:akrcivfjymj7sgo;5:il8;5:agxcimfkdqjtrkhtirwhf;1:8ke9h4ehf;3:9hfjmhohfqhgwl6;3:gishiyrj3;4:2j66juvklwhf;1:2msrir;3:8hh9heemsfjg;5:8jj9h5;2:8hhhjjij9jjwrk0;3:2ks;2:jjj;5:4le;1:8h79gqaj0bjbcosfgvghbphbwl1;5:wio;3:mhftkv;5:8j09k2ajpbk9cj5egvfhckk4nhgwh9;4:9jc;1:2ljjh6khglhdnn4oh9ph5;5:blheh2fhc;1:ojq;1:ditejifim;4:djhegx;2:2h84hc6h67pibhckh9oh9pkpsilwh9;3:6hgwmi;2:bhglhewl6;2:1pg3hd8ge9ioagjbh4fh3ghdiimjh8knnlheoherhcwjl;1:8ja9h8pkc;7:ah7ckeiik;1:0l12l93h84hf6hh7j48jaahdeijfilgh6jh6khfphfqhbuhgwh1;2:0me3g9;6:4jg;2:fhbgklqj8;1:0h41k02h93h64j56h87h69gldgkjgtkjflk6nlpog5pjkqgwrisuhf;3:9ix;1:ljj;2:0j9mj3qktrjh;2:bj8jgxplb;4:4lb8h7;2:8ha9hfemo;4:8gm9loehf;2:hherjv;1:1jt2ld7lijhdrh1wh3;1:4k78lb9gfdgpekdkhc;2:ej4hiljh6rk9tkzuhd;1:sit;5:gjb;3:1h13is8il9jeahfbjdcj0ehfghfkh6mkiqjotjcwh0;8:1kdrhc;6:4kg;4:ijv;1:qku;7:jl5wh3;2:5jj;3:3jj5izgiy;6:0h91gk3h94h98h99hdbirdhceh6flfggohhajgvlhemncnrrogzqh4rh0uh8wgh;4:ah7fjgqiqwmp;2:bm5fk0ggghgqql4whf;4:jh9sks;2:lk7;5:oo8whb;8:5jm9h8bj0cj4fk5hjd;3:mlxuh8;2:ah7chbhl8jhbmk7qlpwh9;2:ejf;3:0hf1hg2h13h14h95k36mk7h59h7ah1bgqch3ej3fkqgiqhiwjglkhdmhgogzpj2qgirh1ukdvjewgp;2:1ha3hg9h4ah5bjsdh5ehafgqghahkxjk4kjbmjnohfphfqhgrkeuhe;3:ukq;2:0h11jg2ob3h24jb5h96gx7lw8gl9h8agxbitchddhbehgfhhgj5hhbjglkhblhgmhenhgogwpjnqkgrj8shgth4uh6wfx;3:5hfbk5cjciitrjm;3:jkw;5:uiq;3:eizfj9;1:0hh2kr3hg4heil6;1:0he8hdah7bhedh5elbfo6gknhhbjh6qhfrh8uk8wh6;2:kkrlgn;4:jhgwl3;1:aitsio;3:8hahjgij5jl3rjvwhe;1:6nbgjtwhc;1:2n7;4:dk8;1:6hcukl;1:5kr;2:pmh;1:9h5ujy;2:8kd;2:qjq;5:5ixdj3jjj;2:0jjcjfejd;1:7hdjgvmmaqhbwmw;3:8ha9j2dj3hirujx;2:qjd;1:9jjrj6;6:0hb8hcak2bisdh5eh7fjnhjjrkb;2:ej1;4:ajl;1:2jb3hg5ji7hg9h9bjuchfffwghdjizkhcojophbrhdwng;2:3hf4h16iy7hg8gk9j2ajjbhfdhgegdghejgzohhpheqhfrhcuqbvjqwh2;c:hji;1:tjn;1:1hc3hh8jf9l3ajcbl7cj6egufh9ghcjhckjdnhfphfqhdsjkuh8wgt;1:8g89gibivchheo6kl2lhg;2:nkx;3:7lfqj6wh9;3:8hflnynhg;1:0ivdjl;6:rj2;1:djnrjvsip;5:bkd;1:hj6;1:1ha3j45hd6hg8ke9isah6dhgeh6fhagh2hhbkhblhenhdohgpjnqh6rmdsm0tgwuhfwir;5:miz;3:jj7;4:dmzeh2jiy;3:ej6;2:cinsj8;1:2g97kb;4:diveh8;3:qlg;3:wkw;1:oj9;8:7ls8haghejgjkk8ohgpknqhgwhd;2:8kv9gm;9:9it;3:2imghaohgphbqjswlx;1:1is;1:5pk6gzjhd;3:rki;5:1ha4ky8hhfhfjgwkj0oh6rm4wil;7:8k19g8bhckjzqiuwkb;1:qji;3:djbehe;4:bjc;2:3q36hfjh9ph6qhfwh3;3:ristjk;1:0j06gihgrjhgqmmuh3vma;4:5j0;4:diveh8;4:8hbbhdfnogh1qilrk2shcthbuh8wk4;2:5j0;1:5j3jjs;1:4il8gu9hdbiqcj8diwenvqhcrhcuh8whf;2:nl9;1:bj2;4:dfzelr;9:riy;1:0h41j32hd3ha4ha5hg6h87h98jd9gzajjbjicjudfqek1gj1hjzjgnkh1nj5oh5ph0qharh1sh9tiwwju;1:aikojl;2:0ik;1:ah4fl1;9:iiw;2:1h42hb3ly4h15jp7iu8kfah8ch5dhhfh2jj5kgwlhfmhanhdoh5pgpqj4rgdshdtkuvjzwg9;8:bjlciljjjkhd;6:3gf4hg6qz8h39gljgvqhfthduh9vnnwh3;1:2ms7kmohbwhh;3:dgxelufis;1:wk8;1:0hb8hgdgrem0;4:ahdchdhlwjhfmk9;3:3k78hg9hbbl6dhbeitjjroh5qgzsliuhgwhd;2:jixqks;2:ditejifim;2:8jg9iyhjmjiurirsjywhf;3:ak6cj4qmdrhawgw;2:8jiem9thg;2:0h41hg3hg4jh6h87kdajach7ej1fikghajkekhholiphcqh6rhcwh0;1:wik;2:3hf6lb7h38gxehfjhhsj6ujxvl9wh8;1:1hd9isbjecknkhgrk2uh5;3:djc;1:8hdukb;2:8ha9gjdkqel2;4:1ju2kw3j64lvdhhjh6rgvwhe;1:dhfelu;4:3ki8hg9hddimejdljrsjcwhh;1:8h89khfh2gly;3:8mrjhf;2:lkf;2:0hg1iq2ik6iu8inahfggyhjooiw;2:qlb;7:wjs;2:7nzqhawh9;5:2j13hb4ku6hh7hd9gwbh2ch7dgwfj2gh5hhcijbjgiklulitmhfnj6pj8qh4rgvthguitwgn;1:jhfkjmwkw;2:ojz;1:tki;8:9ik;2:plu;2:eir;5:8hf9jcaipbj7fjg;2:jkw;1:3ip7imajwehcfkr;1:cjnrha;2:2oq7h48h4wh9;1:qjb;3:jjosiq;6:4laehefji;7:bhglhewl6;1:oj8;4:gl0;6:2nu7k9jhfoj0wh9;3:0h84hg5il6hachdfh3qh6rjruimwik;1:jl9;2:1gy3ga4jf6gw7h58jn9ipchcdipegdfgqhhfjj7kgslhbmkinh5oj4pjbqj8rhftlmuhbvirwg8;6:5kojkjwhe;3:tkt;2:ukt;5:updwh8;9:0k6mjz;2:wm7;7:9iueiz;2:2gu4h85h96h88j99gragnblocisdgseh9fgpgh4hisjjjkhdlh4mjqnhfohapgzqjsrjcshdtjzvjiwh1;2:5jt;1:ahefkn;2:uis;2:1hg3js4hh5k38il9juahebhbdjoek2fh9ghchhejh6kgolk6mirniyphaqhgthauh7wh8;1:diqujs;1:jhhlkgniusj3;3:hguqjl;5:gjt;5:8jw9j6ghghk0tivwhf;1:fiogk3;4:9jaaimcio;1:fiz;1:4ij;1:hgsiiwjmjshg;4:bhglhewl6;5:jjk;2:lh6nkp;4:1j0;1:ina;2:3kqiitojtwjw;2:gj7wl1;1:rjt;5:8kv9gm;1:0hf5lh8jt;2:2gf8h19jraljfgzojnpkvwhh;1:8kw9lnajsblechaegufh3jh3kjhnhgrhduh5wh5;3:4kr8hhcipggnjgnqqfwhc;5:9l2al5bh8chfdkkehafhajhfrj7uh1whd;7:3ha4hc7h98io9hefhdgh8jjxkjwnhaojppj1qk1skdthauhhwha;1:4ij;2:6ogphfqh6whd;1:wjm;1:8iyalbbitcjjfh7ghchhhkk5qjjrhcwha;3:1l43k8;1:7kr;1:hik;1:ok8;2:8h8fhcgkfjlw;4:sjl;2:1hgdj2rk4;3:bjbdlreha;1:rjz;5:eithje;3:jjt;2:lje;2:nl9;5:jkp;1:4j7;1:jharkn;e:njf;1:0j2dizej6fj6jil;7:qje;1:7he8j39hbej4hitjgoqml;d:qjr;1:bkp;2:bk1gjw;4:fhegk2;7:qlp;7:8h9dmdegkjjfwk9;4:6lm8kfbjmehefinghgjh7lhfujwwgy;1:0h81jn2hc3h84go5hb6h77h69gragtbgodh7ehdggthh8jh3kknllsno3og0pjzqgzsjdtjdwgp;1:9jt;2:ejftk0;3:rjk;4:4h6il0;2:skv;2:ajyfjb;1:1gs4kvjkrohaqkd;3:8heej2;2:0kh;5:4j69iudiylje;5:jheskswl8;5:tjq;1:jh0wkj;2:8nw9gjcj2rh7;1:pku;a:dj4ehd;1:jkw;5:3mvbjocio;a:wlx;5:dhcegvjmd;2:0jc;5:dl6egzuiw;1:0he2io4im7hc8ki9g3djuejnghahhbkhblhgrgz;8:aj9;3:0hf1il3h84gs6jd7gx9fsbh0dhbfgjggrjj8kh2ljenjeoiwpgzqj3rjpthaujtvkawfx;1:jim;1:ahcfh8ol3pkr;2:8j89h9cj2eirfjjjhgqj5;1:1lm3hf4hg8h5bhfghboh4phdqjcrgrtn3wl4;1:fjs;6:nhfolgphf;2:1klrgf;1:0he1kg2hg3j54h87hg8h79h8agzcj5dkmeinffsgjxjj3kh7nilogmph7rgtuh6wl2;3:jjwqhf;5:0il;6:1hf8hd9h2rkaun9;5:2in;2:0hd1hd2hg3h24h85jz6h97h89jdah7bj0ch7egufjmgj7kjdlhgnh6qimrh5sjeuiy;8:jkl;1:0hd1ge3h64h86hc7j78ixag9ck1dj8eltfivgmahh9jhakh2oh9ph1sikth7uipwgh;2:4l1ah8;3:8it;6:njh;2:0hf1gt3hc7hf8gzbh2fhcghajhfknfmliomlpjjqhdrhdwgy;1:7jfilr;3:8gwkl0lm0;6:giv;9:gjotj4;4:1jcrhg;4:jkq;4:8jq;4:8is;1:1haimb;7:flv;1:ahedgveflfozghf;6:5kcjkaphe;3:ql7;1:4ip;2:6ohwhc;1:0hc1hg2gx3it4h75ha6jl7jr8kq9grah9bhbchddh7el8fgygh1hh2mhbohbph5qjbtn3wgr;2:1h19gqagqbh5ch5ejffgvgmnhjnohaphbrl7sl8th7wh9;1:4jl8hcsistlxwhg;4:8h9jm6;8:9gorkm;5:3hd5jn8iwehgfjjgk7hgxjk7pkrqhgwhb;2:ck7fjc;2:8hc9k9bhfjk6rkb;2:9jy;1:fl9gfz;1:qje;1:khenjxpo0;2:ekr;6:ej1;6:5ir9goah1bj3cnwdlaegifhcghbhhdkhelkvqhcrh4wh4;3:8h2gpyjgrqkfwha;2:7l9jhb;1:4k58la9gfdgpekckhc;2:fj8;2:il2plvwhf;1:8jm9joaizbklehefitwhe;5:ujl;6:jjw;3:cis;7:dk6egq;1:jkz;1:9h4ej2fk4hj7;1:7lvwhf;3:0jf3hg5k5bhffhdgjnjgxmjaph7qhbrjpsjrtjawh2;4:8hf9hfklt;1:0j71j83h34hd8fz9h9ahbbkldimehefkkggthhcjhbkh6locngdplyqh0rh9thauh5wgj;2:1gwkjt;2:ak7bin;2:gkb;1:ajgfhd;2:ikb;1:dh1ejp;3:hlb;3:po6wh7;2:0mm2h83gt6h47h78h1aj5civfheggjiinlhdmhgnhhojbph2ql7thcuh6wja;6:dhffkpgiqrj3;1:bl8fhfgjihj6ojm;2:8jo9p9akgchbdhbeh7jhgrhfwha;4:8h99j8ajhciudgoej4jj4nkfrhc;2:5ipjheqjp;4:9iy;4:ljr;1:gjv;1:9ly;1:1hh2jz3k04j35l58he9hgbhfchbdhbehefl1ghejh9kheoh4phcrituhewh2;d:9grele;3:2gq7ky;3:5kbhiv;1:hk1jixmkqqhgwkw;1:2jv;1:4lk6jm8hebk9fhagivhirjhaoiuphbqhbthf;4:tj4;5:5j5;7:8h3cjghlnljv;1:hhdjju;c:jkl;7:0ko3gabir;1:7mj;1:ajgfhd;3:3ixpl8whf;1:ul3;4:wjp;7:7frjll;2:0hd1h92ks3h34kt5hg6gs7ipahebhech8dh7egwfhbgh0khcpiqqh4rh5tjkujtvj3wke;2:bhefljnlzwhc;2:hgkjjx;5:ditrj1;4:9j4;1:5jv;4:dk4sir;1:4im8jmajrbjgcirkij;1:4im;2:hk7;3:niookh;6:0h01kz2he3hc4lo8iz9gjah8bk5dgneknfh9hhhigrjj8kgsllenh9ogvpgzqjnrh1sh6ugzwh6;5:4j9bhfcmxdj1fhanji;d:1jfwh5;5:ahcfjw;2:eiplm3;4:0irijo;1:5kk;1:3jf;4:8kq;1:5ikdj4;2:wj9;1:0h71gx3he4hf6ha7hf8gr9h4ak0cjsfgohkgiivjjolhgmhfnk6ol2pixqh1rh5shhthduh9wh0;6:aisfjl;4:5jg;5:1l93lw4jf7hd8h39hddhagj8jinphdrg9wip;2:7lf8injkvrjjwh8;6:bjukhgqj5;3:8h99mtklblgkrh7;2:jhfwjq;1:wjr;1:9ip;4:3ipbj1dm8ejhffsgk4jhfuhgwhb;2:qkj;4:pjp;1:jjq;4:3kk8jm;4:8j9;1:ljn;6:rje;1:0io8h9eipiisnj8oj5tlywh6;3:cjy;9:sit;2:8jadhfejrplgrh7whg;8:1jj3hf4kb8k09gpalsbgnffugiwiiqjh6ohfphdqhfrhdwj6;2:cj3;1:biz;3:ahehkk;2:wjn;4:flv;6:qkzsgt;2:2f47m0;1:ijv;1:jje;1:tk3;1:hhbjjjkm4;5:jim;1:jkrrjm;1:pkc;3:4jw8h5ah4dj9ej8gh2igsphgrjhtjkumrwh2;2:1it4l28h1kky;3:8hbaksbj5fhhhipkh8rj0tk4;2:fj5;6:1hb4hb6jj7h8bgjdjmeizfgegiuhjnkgwlm0ph1qh0rk6sh7thcuhawgo;i:jhgwl3;2:eiq;f:ck6;1:1km4ixrh2;1:8hdgkm;1:5iylln;3:ck6;8:lk9;1:8mobgmwj5;3:eimwix;8:0hh3h45hg6h97k58h79h7bhadhcehdfh4jkekgwlh7nhdomiqjbsjjthauh8wip;4:1kgrh3;3:blj;5:6h58h1uncvklwhe;1:1khah9kl1;2:djgeh0;1:9iu;2:ajrfhc;2:8gn9l7dj9jlg;1:dj5;5:rjg;1:hjc;a:djn;1:cip;1:8habhccj7fh3hmqjjkthgujrwhf;c:8gz9l0ahe;4:1h3wm3;5:8ju9jyeha;4:rj6;1:7nkogwph8;4:8ivbh6kkvllvphgrha;3:6lfehb;1:lmonh2;3:0he3ktqkn;2:8j19jpck8hjr;1:df2em3;4:1h32og7nd8h1qh8wh0;1:jhapn6qj6wjz;4:0jl;1:tjq;2:3jw6fu9hewm6;6:5nnhiwjh7;5:4j28gx9jz;2:1l7;1:1h66hg7mjolvwhg;2:0h21l13gz4h45hb7go8gp9h2aknbhgdh9ehgggthipjjakjmlhanhdok0qgmth7ujmvjfwfy;3:0ix6q78hdeh5;3:0innknok0;1:ij2;6:jj5rj2sk6;2:uio;1:ah9fh6okypo9qhbwhd;2:8k79gt;1:iji;2:jjq;1:ohcpk1siv;2:0hc3he4iz8h09ilahachedkfel2fjugh4jitkj9pheqhcwh1;1:uj3;1:9iw;1:wkj;3:8h8aiqchdfitghehjgjhdlh7rjcsj0wly;2:gk1pjt;5:bgtlm1oo0phbwh4;1:8jj9fgbkeejxgjwjh1ul0whd;1:jkp;2:nl4;2:1gr3kd9ldagibhecmafhfghahisjhakhglhepheqharjrtjcuhgwhd;1:0jdfhdgjx;2:8ip9io;6:poawgh;1:njdojbqjerk9whf;1:rje;1:4hf7h88iq9h6agmbhecj6ej7hhfjkorhftpzuhhwh6;1:cjojkxkkilgnwgz;1:jkk;1:4jk;1:5mxfhegh9jkbthgwhg;3:7h29h3ehbjlqmjkqharjxwkh;2:8jq;4:4ovchdoke;2:qj7shg;3:9iw;2:djp;1:hj1tkm;1:ujd;6:3l9;5:9iysirtj9;1:2j1;8:pld;6:ejg;6:1ha3hg4hc6hf7hf9h5bpofhegh7hh4jh6kk3lmnogtph6qh1;3:sja;4:ajjgij;2:jjp;1:cj2hj3qjnrgvtk3;1:1lcdg5ejwrhd;4:7nzqhawh9;1:kij;3:gk7;6:dj3ejz;2:gk6;1:fh6gk9jj1siuujz;5:bkacjqshe;1:8k19h4;3:agsbgyfkfgkflhcsiuwko;1:4im;2:ahefkn;4:1h78jm9h4bk7eh6gjnhjljhgkhdokmrjhwgu;6:0ik6hfghcqohrk6wgs;1:bjx;3:giw;1:cjk;2:4in;2:0hf4gy7hg8ir9h5civeilfjailojhapkeqivrh7whd;1:8j1aj7fjj;2:fik;3:cio;1:0k08hfkkxwhc;4:0ls3j9eiz;1:ej1;1:ghfjhctn5wkz;6:ska;2:ujt;5:5ke;6:8lu9gc;1:3h87ljeiu;4:fkjgjp;6:ejbjknwh6;9:1k6gk4jk3rgv;2:aj0;1:aim;3:hjf;6:4lcqixwku;3:8ft9joaoxhhgripuhawh8;5:9j8ajl;1:gnojh3qhf;2:tio;8:1iw8h2kl3;1:ggjsjytjn;1:0h73he4he6he7he8j69h7bjecisej3giuhj8jgzniyph4qhcwiu;1:8hdgkm;1:0h71h82hf3iu4jb6l87gv9h2allbhadgifh4jl3lh0mhgoh9ph2qgssjmuj1wgd;5:sjl;2:8hgdmqegmfjk;1:djbej9fipgh0niqphdqha;3:6kl7m88js9iyghchjwjhdphcqhgwgw;4:dlf;5:pnoqhcwhf;9:1pv7g8wh6;b:1hd5hc8gk9h2akibhbcfwfligivhhaqhcrjdto7wh8;3:8gmtp0wh5;1:kk7;4:gjf;2:nj2;3:ggrhgtqli;2:0hd1hh4in8h79h4ap8bj5chefg6ghgil0jh2khgqhgrjswha;1:cjwdjsfhcgh8qjirhgsimuit;2:1gv2k9ah3bjzfhcolgwkj;4:ukm;4:wiv;3:1gd2h33h14oz7hg8gl9j1agvglshhbjh1ohcpheqh6rgusiztk1ullwh2;9:2lnhisjlkphcqhdrgq;2:ika;2:8m3;5:jkw;3:jhfoh9pjkqo2;2:5m0;1:0hg1ha4h68ja9m0bhccj4eglfgyghbhhfiiqjjakgxmkknj5ohbphdqhcrm2theug7wh1;2:fik;2:bgvkmn;2:aledirfhb;3:kkznhb;1:8h6ahdukz;7:2kk3h94mi7h99hbaglbjlchedh8fhaghdil4jgukgxoh7pj0qimrhhsh5ujhwh9;1:fj5kjl;3:6ljmk5;2:3k38jujh9wjq;1:civ;2:hjrjhdrk9;2:jj2;5:rje;3:8gk9jjdj5;7:2il5jp7hf8gq9jeah4bjjchgfhajh5kh3mq8sh4wha;6:5iq;2:tlp;3:0in3l4;3:2g87ke;1:dhgjlh;2:oj7;1:0o2gjiqhgwhf;1:lh5nno;1:wm8;2:jgqqkswjv;1:2is8iu9j8miyqk3shf;4:2ko8hekjq;1:jmgwh0;3:8mj;1:8k9dhgejqjh6;1:8gq9klah7dhbejzmk8thgukq;1:cjy;8:fkx;1:djpegkpku;1:8h79h4aisbixcj0ehdfk2hkaril;4:3ipljq;1:ciw;4:bjsklhlhgrjo;6:jkd;1:9ix;1:hjajikqj6;1:akefgc;6:cj5hmbrgv;1:1hf2jf3hf5j86hc7hc8h29hdal8bhafh1gh4jimkh0linmoqohbph7rh7sj2uhcwgu;2:tlcuhb;5:8j2;7:1ksrh2;2:8jd9jiaivbkbchceh8givujewhb;1:8he9ja;2:ah2fhggm2jhesj4;2:6jk7hb8h0ujwvlvwhf;4:0h74k58h89h6bkzdgdemfigrjhcqkhrheshe;5:nkp;1:mix;2:cjdfh8hmz;1:3lj;2:jgyqki;2:2is;9:bjc;1:0im;2:0ix2n74jy5hg6gw7lb9hdbhffhgghbih7jgsog2pgsqm5rhgthhuhe;1:fj7wir;4:8jo;1:1j6;1:8he9ja;1:9jb;2:0ix;b:5jqcm5rgwshe;5:jjonktojuwh9;5:hjm;1:ajo;4:8hdgkm;4:wk4;3:1hc3hc4il5iu7hd8iy9jebm1cjlegdfh3gh9hgrjmfkjvngvohdph6qhcrhauhbwgw;4:1jfwh5;9:0jh;6:1gfgplhhdqjsrgqwhc;8:0ix1gw4hf8gvbh9fh4gj9lj1nj9piwqh7rmatip;3:8gm9ladkeegqnitwhg;1:dlf;1:0h91ly2hf3jw4h45he6l87h58g29gaah5biucgxdhceh3fhggh1hlzjgekjolhamhbnhaoh3plergcsh2th5uh9wkr;1:ait;1:8hb9jtujt;2:5j2;2:2kn5injhemilwk3;3:nghpld;2:3kk;3:hgypkjrkd;1:bj9;1:9j2ahdbhgdktegofh2jjlkhaljznhgogwpm2;3:jku;2:1h62hf3nz4ha5h7ah4birchgfh3gj0kh4ohdph7rgjsiltjdvkqwgg;1:1iw8h2kl3;8:jk1;1:5ir8jk9k3bg1ehbfhdkknlko;3:0j42hb3gc4j55h96hf7h18ix9g2ejxfgeggqij6jj7kiolhcmhbnheoh9qgxrintl5uh5wjy;2:pn8wha;3:dj8eka;6:bh7kkf;5:jhfqjs;4:8ix;1:wky;1:qhfrk8tne;2:1h1rka;2:bk0ckzfhagl4wh5;9:kkc;4:0ha1jy2hb3h74hb6h77hd8gz9h9alucixdhffgogh3hjrjjlkislhgmheokzpizqgurgqsh9thcukowgj;5:jjnlk6;2:ait;4:8gx9kcahddj0ehfhiplj6ujt;3:0hc3hb4he6hd7hc8iragrbjtckiekvfkwkgwlhepjiqh6shfthguiowgu;a:0h91im3gw4ha5hf6hb7l78j99jhagmbkgch8dkghgvjiqkgylgumhhniuohcph3rj9sh6uh1whe;2:5jq8n39h3akwbj5fh7jheqhgrhbwh9;1:0gp1h53o14h98h79hciqijhcqhfwh6;2:9itjjupk6rjowh5;3:cis;2:7nqplbqh5wh1;2:mk1rhc;5:1hd5jo8ip9hbahdbl0dh3fh5gjyjlckktogzpj6qh8rgwuhewgx;6:rjr;1:fhfgk4;7:0h83h14hg5hg6gl7gm8h6aj5bh1cj3dh9eh3fh0gkjjfsmhgohcph3qk1rh0stnth0ugsvjzwgl;2:jj5rj2sk6;5:mk7;4:njs;1:wlo;1:8h09k0;a:dk3;a:iikolbphg;5:ujg;3:dikujt;1:ckmrha;2:blg;9:0h91gz3hf4h45hg6hg7h28fr9h9bh1chfdh9egofgsggzhhfjg9kmflheml8njmonypmeqgzrh7th3ujzwgm;6:7jg8kb;2:4jh;2:0hg8hg9h7ah9bjqelkfk6jizqhe;7:hjnqjz;4:fgnuk5;2:hio;1:5jcjm1wgu;1:rit;1:aisjhhqkdwl9;1:9j6;1:fgnuk5;2:8h6knilgirh8;3:hjirgp;2:qjr;1:dkbegf;2:jkg;1:3mm8h1agxfk3jlkuhgwgi;7:1gn2jh3h56he7gx8h19h9bhedhdehefh6gjojk2kh2nhfomvpiyqj6rhasjathcuh9win;1:rje;8:8jcjj8sjw;1:8h49jebiysje;5:jiz;3:4lm;2:0iknkjojypje;1:jjm;5:cj3;3:0j5;7:8jg;1:1hb3hg4hc6hf7hf9h6bowfhgghahh4jh6kk5lmpogtph7qh1ril;1:bh9kkz;2:2imagycjcfjo;2:7moqhcrhctiq;7:8gy9koalxfgfwhf;1:kke;1:5k58mcjgskh7qmuth4wh4;2:8iy;2:ajyfjb;1:tlb;1:0jt1hd3gz4h05ku6hd8ix9gsah5bixchfdhafh9gh3hghjmnkhdqh9rlksh7thauh6wjd;1:rkvwh0;5:jjbsjn;1:hhgjjq;4:firwk9;1:hj6;1:hkrrh4;1:0lm1o1fh6gharhewhg;3:mk1rhc;6:0m5;2:1hg3he4hg7hb8h69itaplehdfg9ghejj5khaohbphcqh8smguizwh3;9:djr;2:blj;1:ejd;6:wnl;2:3jsahewko;1:0it1h22gx4im6is7is8il9jqbh5ch9dgsej8fgbggqhgvjh3kh2mjwpguqjarhgtkzuiu;1:bjhckukhgrj1uhf;5:1h33lmpkb;3:3j0cjl;2:0ke1im3gz4gm7haaj2dipej7fijghfhiqjh6oipqhethaukowgv;9:8k79gt;2:sj2ujr;9:qle;1:9h6ekn;5:rj1;2:jhgwl3;2:0hg1hf3jo4h55kb6hh9gmbgyehafgxgh9hhcjgkkkvlh7nktojdpj5qhgrjfthhuir;4:9jp;5:gk7;7:ilt;1:ailfllugv;4:7fqjkvsjrwkn;2:0nv1hg4h9ghgil6whc;7:0hc1ip2ix3hc4hb5hg6h57gs8l49jeaimbgxejifh2hipjgrkixmhfoh4ph4qh0shftj4wj6;1:hlb;1:qku;1:8iq;1:0ke8ji;c:bld;1:wk6;1:0h31ga2kh3hg5j77hg8h29h6agrbhfchbdiweh7fhbgmshnpjkznhbohbpgzqk8rfmth6uhawgn;1:2iz3jb6jn7hh9jfahaghgjhfqheuhfvkewjv;5:flrqkhwhg;7:9j5;5:ojopjmwhh;9:3iw;8:0nh3hg4g7ihctj2wk3;1:ejkmil;1:fhegk1;2:4jqche;5:uiy;2:6l97j68hfgkkqhg;1:7frjll;2:0k37hb8hf9gwbj7ehafh9khaoh1sm9th0uh2;2:3k49hg;2:7jt;1:4l78haeizjhemkb;5:6lo7m5ggrqhd;6:0h01ir2hd3n04h76hc7kz9gxchddiqeh6fh4hhdkhdlhcnh0ogspkhqgrrgwthfuh4wlx;3:9m3bhgdjwegkhjsrhdwjk;2:0kn3h24hf8h1ahgblkdjfejafiqgh6hiljhaphdqjyrh2uhfwha;3:qj0;3:ij1;4:cjn;1:jjmpk8;2:9kjbhhfhdkjm;4:0hg1in;3:9hgtka;1:eje;3:0irijo;1:2munk3phh;5:3ki;9:8itej1;4:0hc3mc7he8kz9gsah7bgyckbdg3emefhgjh8qhesj8uhgwgw;1:4iydhbhj4jj1nimqk0wj8;6:djffj5;1:qkw;2:2iz4hfajvdh9ehhfgzgh8jmoogypm5qjfsh4uhgwh6;2:jjv;4:1jfwh5;1:qik;2:3lg;1:ijc;1:8gr9jielu;1:dip;2:jk6;9:1iz4iy;1:8j3;1:0haimc;8:8jt9izah3dh7ej2fjrgjzjhgsiq;6:eharjv;1:fimwkt;1:0he4io8gx9grahadn4eltfl5ghgjheuhdwhc;1:5nscj6jh9;1:uj0;1:0h71gu2j44h15ha6ln7gt8iq9gpbhgcj1fjmihgjhekgqlinmhanh6oh6pgtql2thfuj5vj5wfy;4:0jy8hehhdkkwrjpwhb;2:gl8qkr;e:gj8;1:0j0aiy;1:ciy;3:2kz;3:0iw;1:jizsiv;8:bkd;9:8jp;2:jjg;6:0k31h54l56hg7gp8gychcgh6ik5jgjlivnheph3qhcrimuiowjx;6:4lm;5:6h77mibiwjhgnjgpheuknwh7;5:3ki;6:9h9akwgh7jjsrgzsoguhdwhd;2:dipwju;1:8gl9jl;2:1iv2hg3hf4h28ge9jcah7bh6chcdh6egrfh8gh4hh8jjomkzphbqh9rgytisustwgx;2:fl0;b:ahehgyjjlski;1:4jxwjp;2:9iqnl6;6:8jh9j3ajacioeh4fjvgh9hhcjgrqj4rldwh1;2:aiukhfngtpo7;2:hgzjjp;1:2iv7krdjleh9jhgwku;2:nl7qj8;6:ojx;2:5kx6mmjh8phbqhbuh2vk0wk2;1:jk6;2:hkrrh4;2:bkbqj6;1:gky;2:6hhah9fgugqnhhejhdqj7;3:jix;1:cj5dj7eh8;2:3mw;2:his;b:8gv9jgejefh9;4:8j2;5:4kp6hf8h2jilonn;3:8k9dhgejqjh6;3:jj5rj2sk6;3:1h52h94o0;1:0hc1gx2hg3ha6hf9j7bk4ckefj3jhdkisniqoh6ph0rgosipwj7;1:dkaeg4lk4;1:agyrji;1:4ka;2:tjd;4:4ij;3:2itgiy;6:jkh;3:4jg;4:0h84hb8h6ajpbijdileh8fj4hj3iiqmjlrjs;1:1gt2jt3ha4hg6jv7h59hgehafhghgojggokuqlethcwlo;2:ah4fjejhfohdpkvqilwmg;5:rks;7:khfolopgsqjp;2:1haimb;5:dkiegh;4:tknwj4;1:0kn;1:wk6;3:aiv;2:rhesnywhe;6:pk1;2:8kpehg;1:pls;1:tk5;3:rj1;4:eirhjcpka;2:cis;3:dknegkqml;3:8io;2:tjz;3:okb;5:ula;3:ciy;5:0jh1h72l23jh4h66hg7iybh8eirgh7ij4jh0phdqilrh9sh0tikwj1;2:cjg;1:rje;1:jjm;1:hj2;8:bka;4:0it4kw5mnah6jh5;1:8jk9h2;4:1k42hg3hc4hh7hg8hd9h7bhccj0fh6hksjh2kheqh8rnsuh3wgx;5:ohewkp;1:8im9h6aikbiudh4ekrfhchiljfxqkfslbthg;1:iis;6:0gw1je2he3gu4he6hb7hd8ge9itah3bk2cgydh8eh5fgkggehj1kjulh8mh2nimogupgprkaskctknukm;1:9jfbjhclifizhgolj2qivwh6;2:8mi9gzbguqka;1:dip;2:wki;1:8lz9gg;2:ckxeh1;1:8il;1:dkiegh;2:gja;5:2in;2:8isdh1ejp;1:njf;1:ljn;3:8md9mibhdehekh5uhh;1:kl4oit;1:wjv;1:0hf3k08mr9muahcbh6eh3gh1kh8;7:jl5wh3;2:jjpqn6;1:cj8tjvuiy;3:hjm;8:5jh;1:djs;2:0jh3hd4grgkrhgtijmjjvqhbsgtwm9;1:1gy8gwbitkl8omo;1:ljc;1:ojr;1:jjc;1:2hf3lwal3qhh;6:0h83oh4k87hf8go9gpagvck1dkbegufh9jh0ohbqhfrizskcuh2wgx;1:1ha3liqk9she;1:qje;5:rkb;2:5ka8hdjgvljeqn8thc;1:doseg8jhapkywix;1:8jc9ffbkbejugm6jgxukuwh6;1:kh1mli;2:jin;1:ait;1:2ks;4:0oc;3:1jl3hg4io9heahechdeixgh1jjikmglh3phgqherj2wh9;6:5he8gv9keah7bmeehafjughbijrjhckhgrkwwh0;1:9ipuk9;1:9k0;3:1jd;5:mkh;8:tjb;2:3kl9hfdioejfljt;1:3js;2:dl4egf;3:0ik1jz7h1hgljjfqma;1:ehduks;2:sjh;1:rkd;3:0hb3mi7he8guah9cj3eh6jhaphcqhdujfwlf;2:aj0;2:0h11k82gn3gy4ij5hf6h27h29haah6bhbdh4eh5ggoihfjgkkl8ll8mhbnklomwpikqgmuhfwgv;2:1o79itegtrh1tjm;2:qjq;4:hjt;1:0m26h8ljyphg;6:0gr4je8gr9gxdnoek6fhdihgjhelk4qj9rg6;2:sj2ujr;9:jj1;4:hhdjju;2:0li6os7h6jhdphbqh3wh3;1:0hg3o2cj0wh9;4:wl0;2:rix;1:6envm6;6:9j4sj4;4:0gz1nm3he8h89guahabhhcj4dhcehcfhehjujgtpheqhcro4uh5wgz;3:qjr;2:3hh7h18kf9gvamoch9dm8egdfgegj1jh7phcqiprfzshdth7ulfwhc;1:0rv1j43js6hfghbjh5phfqhbwgr;1:5kr;b:8gq9j9agsfh1hkaokypkk;2:8gn9l5dj8ehhjkuohbqkiwh8;1:2mn3jlwhg;2:4mm;9:0gi1lf2hc3h74h95it6hc7hb9ijaj3bjsdhdehcfj0ggvhjiihhjgrkgwlh5mh0nhboinpjiqgxshatl3uh3;1:8gj9habhfdjfen8jkallkphdqh6rgfwh5;c:8k3;3:wje;2:ag2fg7jgvwrl;4:0ji;2:5j4;1:mn1uh6;3:tjz;6:jjy;5:4kvah5pl9;1:ckn;2:8hdah7cjjgh5hjsjh1plcqheslywhf;2:0hg9ioak3ejofj2;2:4jl8hcsistlxwhg;4:cfuejhljmrnw;4:3kg9h9fk9;8:3hf8gt9h6afrbp8ch7glqjhgkhhqlxrhhsgowhb;2:jgyqki;4:wj8;2:cjn;3:gjs;1:8h99jriix;6:9ipsjo;1:gj1;1:pjx;2:2meaim;7:4mn;2:0h51h86he7hf9kfah6cjbeitfiygizjh4kh2lhenh9ohgpjnqhguj1;4:2me;7:0hd1gw3he4hd7hg9kpaimbisch9dhfeh8fgvghchjokj6mh8nkfoh7pguqh5riysiruki;5:okl;2:hjw;1:gjs;2:ajrfhc;3:cjn;3:1hf3hb4ir8gmahfbj3djwekhfkeggykiyphbqh8wgy;1:3lj;5:2kf8fv9k9ah3bisclldhaekmfiqgjejh7kh7phdqhfwh0;1:8in;2:1klrgf;1:fiq;1:ojz;3:2ma4hegj1ij8jh8njvphcwjh;5:qlg;1:nj1;2:8h7agobirghhhl2jgrkjfml6phgqitrghtlfwhe;4:jk2;2:9k1ah9;2:mil;1:cji;1:4jg;2:ehfmh3tq4whg;2:gkhqjl;i:hiljjp;5:5mzgh9jkcthg;2:0hg1iw3h5bh5fh6jh0kizljaniookxpjkqh1uiswhe;2:8jg;2:jkl;2:ahedjgeh4fh2il1ogzpmg;1:1lxwgs;8:0h01h73he4je6ha7ju8gw9h2ahdbjsek3fh9ghdhhbigskh5lj3oh6pl6qj8shauh8wje;1:5ls8h6ujx;1:wjs;3:0kf;3:am9ghgkj4sh8;5:0mc3hg4k17h99hcaludhcfgughemhhphguiswh3;1:8j4;1:9indheek6hhcjjful4;a:8jo9k3djlekjhhfthe;7:pko;5:3kfjhfogupl9;7:1h98gw9jsim5;1:hjq;5:4hg8g19j6al4bh4cj3diqejbhhbjh0khhohbph1qimrhaskdthduhawlc;4:ahcfh8ol3pkr;1:dhgjlh;4:6ko7iz8h6aj3bjpciofhgglqkh9qharh9whd;8:jmgwh0;1:0hd2j14hb6hf7h68h29hdah7bh0ch9dh7egufm6hhbjj1kj8nkgogyqiorilsjcthauhb;1:2il4jc9jv;2:2l8;2:ajggjarj1;1:rjq;3:aj9hip;2:0k4mjxoit;3:8k89mlbgzdhfeh6fh6ghejh7kgkmpbohfphdqj1rh8thfuh7wh0;8:bm7fk2;1:ck0;2:nmrohfphd;1:dh7jkjoinukb;1:3iw;1:bh9ckd;4:1ljjkikh5okqpgkqivsjawgy;6:ajffhd;1:8h69gsdnieg6;4:8kd;1:4hb5q5dj4jgswhd;1:mka;3:bhakh6ll2tj9;1:fj1;1:gjvsl3uiv;2:jltwh5;5:8mb9gidh0ekh;6:5iw7lrjhcwhd;1:1imgiuriq;1:0ha1h93hg4hb8heeiqirqjhg;4:0hg1k02hd3j14io5ix6jf7gp9g6ah7bh2chddj7eh2fhahh7jinkh8mkeoh8ph1qivrg7thavjvwj0;3:1haija;1:bjeqkr;4:ql1;4:fh6gl3njm;3:8he9h7bkm;3:ah9fisrjt;2:2mi3jh8m19g7ah6jhewhc;1:2hajl1;2:cj2;2:gnjjh0qhcsjd;1:8imahbeiyfjhwkz;1:4iv5jx8jh9k1ehajjbohhphawiz;2:9io;1:5j3jjs;1:tjz;2:mju;1:qjx;2:lmrnh2;4:7hbwn6;2:qlz;1:0hf1he4hg8mq9l4ajych2dhcegufgrghahhdkkvlgqoh7pheqh8sj5th4uj6wh1;1:2jt;2:rk8;8:mjrriv;2:1hd5hg8gu9haamobh9ciudh7fn2jh4kh6oimpixqixrh8uh6wh4;3:iin;2:kkrlgn;7:1im3h84hc5hh6gz7go8j89fualwbkccjleipfiphh3iikjfzkh6njxohbphbqgvrh3thbujvwik;2:ch5fk2;4:5iokgulgynnkph1;6:0h51hb3it7ij8jb9j7djjejhfhgghcjhdkhdphewik;3:0hg2nh4hg7k0bhfjhckjllgvoiurhgwiv;1:4kv;1:hj0jis;1:bk6;2:7gp8imehfjksnitojdrgktinwm8;1:1hffhbgl0hiprjnsin;1:cjmej3;3:fj5qkg;2:qjr;4:6h17majkdrhcwhd;1:tl0;1:6mr;1:olkphd;6:cm9rgw;1:eiplm3;4:7l3ej7jhb;2:rjg;3:7mysjd;1:djoeh5;5:0hg1ja2m53he4h55kd6hb7h7ahechbdhhfhcghbhhajkskkylhgmhaohbph5rgmtheuhhwjx;3:3j2;b:8jn;2:9k1;2:ok6pk8;1:8jj;4:3hguj2wkd;1:1he4hg8kh9njak6bkrcg0egpfgyghajhfkmqlh8ngxph9qh5theuhgwh2;6:1k28ji9jjajefh4jhgkhflhcnlpoj9ph7rh4wgv;1:5lo;3:fjb;8:8ky9ggcjwkhg;b:2mc7k58j4jhbnhgqhetjk;2:3j9aj4cj2fio;1:8l09gcakqfhe;2:1gz3h64h67gzaggbh2chfdknek3hh2jiolhcmiuph3qj8shewka;3:jl4;1:bkachd;e:3jh;7:9h4ek9fh3gk9siuujy;4:1kdrhc;3:0ha1hd2kk3h64he5ml6hb7gwbh4chbdh7fh3gh4hjsjh0lirmj2ohfql6uh4wgi;2:kip;2:fofshewha;1:qlp;1:hkd;1:hgzjjp;1:8h59j5dm3eg8tiy;4:4hf8h89heajabh7dhffgtgk9hkejkrkhgokkphbrhcuj0wgy;6:qksrjq;1:3ha6kz7h18gs9hgehdjiplmenhephfrhfsj0ujkvl3wgx;2:qj5;2:6hgdh0ejkwmf;2:0he4mgijs;4:jhglliwj3;2:5inijl;1:1hg8it9hgal4biscjkdh1fh5ghcjhckk1nhfwk1;1:qlg;4:oh4pld;4:8gs9gkbnf;3:jh7qjdwmw;1:8ey9o8;1:njj;1:1iw8h2kl3;1:0hb1hc2kc3jj4gp5h46he7h88jgahbbh5dh1fh4ghahh9khdmheojdpj7qh4ro3shdthcuiz;1:7jt;3:bk1gjw;1:siw;7:2in;1:4hdahadh5eh8fj6hhgjldrjtujz;3:dir;1:aksch8fjyjh9sha;4:0jb;2:0kr1hc3kz4hc8ineisghdik4jhaqjnsgrwh9;1:2l73jn4ge;2:8jqdjsekujhh;7:hkgsj1;2:2jt;1:rl2;2:8k0;2:jiwuilwkq;8:9iqeiuhjx;2:5jl;7:ql7;d:eharjv;1:cip;2:3jsahewko;2:0l51gq;2:2ji3hc4kq5kv8j59gyah0bhechgghbijxkhdlk3nhfoheph9qherh2uipwh6;1:1h2rk2;e:ojc;4:jkv;d:8jd;5:8jfajkbjbcilfhfjhdwkl;2:0ik1gq2hg4hc7j88gsch8dheehbfh1gjqhhdjhfliomhdniuqgurlpuhewkd;3:pkm;5:fj5;5:flv;3:flj;1:ahceh6fma;1:blheh2fhc;2:kh9nko;2:1hg4k1dhggglhmqjiv;2:fjs;2:wje;1:2jf5jn8h7ghgjhgkhdno8ojlph5wgq;6:1hf2kifjnhh7rkv;5:mj6;2:lko;5:gj9;3:8kr9hablrehe;3:ujg;2:8h1dkyegegla;1:bjm;1:qjb;1:bjehilpliwhe;3:3j79jjak0bj6;2:ukvwln;1:fkjgjp;1:1h42k54gt6la7gy8hc9hdak3fgzjiukgtljbmhenhaokhpgsqh3rh6tj8ujswh7;7:1he8ij9h6aknbgrciqdhcfgthknjhfkjarheulk;3:hjgjjrrgr;1:fkg;2:8hfekxjk8;2:wlo;2:1k38lk9c3chcdjielfgh5jjwkksrhfsj1wh3;1:0jj2j33ji4hgdjyggzhivjhfqherhg;4:4kx8h3dk0ehfohgrjisiy;1:iiu;1:blh;7:akkfghul1;1:8h79kaahgejoriz;1:7l4jm6mhhogwpkkrj3wh5;1:1hd8h29hcancbh8cj1dhgegtfndhitjhckh7pjfqharhauhgwh7;9:8iv;2:bhbkh6ll4;3:2gy3kq;3:hio;1:1gx3o7;1:ck0;1:fleghcuj1;7:ciz;2:bh3cjt;4:mkh;3:1h49l3eh2gnjrh1;1:7nmgjyhhdrj3wha;2:2h23h64ha5hf6nb7h88jq9h1agvbglch2diyej1fkugishiyjgvkhcohfph4qgkrh3sikukgvjjwgx;3:2j66juvklwhf;3:8im;1:cjj;3:jjr;7:2hg3m2;3:vnf;2:9iy;1:8he9iqaj5;3:2j34h05h78k7bhfdh6eiujivoh8phgqhgroztj1wh3;6:4h9ils;3:0j98jr;6:agojli;7:5j6hh0rkm;4:8h9akvehgfjehitoj7tisuhe;1:bh9ckd;1:miy;4:tjz;4:jiw;1:5kb6hesiz;3:1hbbk9gjbrkl;4:jhgkh5lp9ogvplkrhdwhg;1:agxcjafkbhhfqjrrkctimwhf;3:ljs;5:ait;5:bkcdjj;2:9hetpf;5:4jg;2:0iv;3:jj2;6:8isej3;4:5m4eim;6:9jl;1:jiu;1:5ik;1:eizfk5glw;5:0nuphd;2:4hd5ik8gyahfbizciqfk1ghbhjgiikkh9lkhrikwhg;4:1h1cheeinhk3rkj;2:ljw;4:bk0gj4wjf;3:1hf2h13j04lz6hf7he8li9f9agnbh6cheeixgh4ko0nl3oh5pgsqh1rheshdwgo;2:1n5ahckj8nh1;3:0h01nc3he8h79h9ah9bhgciyeh2fhehjvjgspheqhcroeuh5wgz;4:1lerhd;2:mjrriv;2:dfpemf;3:agmcmofhdjh0khgljjrjvwhd;1:ah6fjdjgjql1wmh;3:2he3hb4ha5hh7hg9jfailchadhfeh8fl8gj9hh8jglkh6lh4nktoirpgyqh6rh7sgythauk9wkt;3:4j09iw;4:jhfwjq;2:bjc;6:4le;1:5iq;7:nl9;1:7j8nit;8:8jk;3:9heejz;2:jh7oh2qmi;8:2joiij;1:0jdrjx;5:aj5;1:9h9fkbhja;1:9h6ekn;1:2me;2:2jf3he4j15ix6gq7ha8h29hagh8jkqoh6qhbrhcsjsuk4vl8wh7;2:0ke;3:1k6;1:uj0wkm;3:8kd;8:0jf1jz3h64l98iybh5ghbjh9kknlgfphhqhguhgwjl;2:2mpahafgrsk9uk8;4:3hc5l4jh7ml2oh9qmtwh2;1:mka;2:8jeqkp;3:3gz7lfghdjkp;1:bkd;2:0jg2j03jf4hfahcdjvfj1ggwhirjhekhbnk3ohaphfqherhfuhgwhd;6:5iq;5:wln;2:8jj9h0ah1eggflfhjirjlwhg;6:1kg9is;i:mjgqkr;5:8ir;5:8gu9n9ahbeji;4:0hg3ha4hc7ha8knfhcgh7jjlkjmlhgnhaojkpixqjtrheskithbuhgwh7;9:1ha8qz9g7ehefgykjewhf;5:qlz;4:5jwbkiegzfh4ghhhipjj7qimrh4uhgwje;c:1hcrl1;7:5m76h3;2:2kvbk8whh;1:tio;2:gir;6:3hg5im8jv9lnajnbkjdhgegjfhfghehheqj9rhdwh9;1:jj7;1:hjemim;3:bhgwmv;2:0ha1hf4ha8gj9giah0bhfdmdelefjkgjdhhcjkcphfqhbriqshgujrwgv;1:qjr;3:ahgfkviiy;8:hjm;1:6mvbhbcjxjjikhaljfpgzqhbrimwh1;1:djbeh8;3:8jq;8:wlo;1:bhgcjhhgslhcrna;1:fkvkk8;1:ak6cj4qmdrhawgw;1:sj7;7:ahbsjb;1:8ha9js;1:6m5;1:6h7vjx;4:eh4um1;4:0hb8hcak2bisdh5eh7fjnhjjrkb;1:3jh;1:0hd1h92j93he9ikbj6cnidhefh8jgwkj4lhenhephcuilwgx;2:qjx;1:1io3h14gt5jv6jg7h08hfagubh5dhfehdfgrggtiiljjjkh1lhamiknj0oinph1qj5rj6thbujwvkbwg1;4:7kz;b:0j57k78gy9iraj1bhbfheiizkhemirnjpojuph7qh8rh4wgl;1:ah9fjcnkvukr;1:bjc;1:eharjv;2:pmb;1:0ha1h22he3ja5je6hb8jk9h1bgschdjh9kj4lo6mhfnheoh2ph1rl3shhth9uh3wgi;3:wl8;3:dkaris;5:dlkegs;1:3hfah2bhhcgpdiwfj0ghajh9kisllpqhgronwh8;4:9jbait;3:ahgckt;2:5ilnku;6:5ik;1:1go8gv9jzah9cluhj5lhfrkftjz;6:ujk;1:fhfgjn;4:8kj9ivbh9ehchipjhfrkb;4:1jcrhg;3:jkl;1:9ir;5:0k81ha4gw6hd7h88glah5hixjmmkh9lhfniqpkprh6sh9tiruh3whc;3:jjq;3:1hebjgckqkhgrk5uh6;1:1hffhagkghj8qj6rjh;1:8habjreilgkdrhewkg;1:8l89gvah5nix;1:ck6;2:3nq;1:bm9fk3;1:ogvplf;2:7h5mj1qjm;1:aio;3:8la;1:0lw1hg2hg3h64ma5ha6ha7hf9hdbhbcisehffhfgh8jgikh8lj8mmbogzph5qk2th8uhgwgu;1:8jr;5:wjb;1:giz;1:diveh8;2:ij0jj7;5:9j7;1:wkw;2:jj8uiv;5:ah4fheom3;1:0h61jd3gx5hd6jh9ilagmbgzcjldh1ggrihfjh8km3lmamh7nhbojmpiyqgorgdshfwgs;2:0h81hh2ks3h74he5hg6h67h99itbitdheeh6hlnjk8khdogjpldqgqrh7th9uiowgd;1:hli;2:ch9fk1;1:8j0alebixcjsfh9ghgkk7whb;1:ohdpk2;1:1h03kg4j48hg9hgdoaeg2jh0rhfwkx;2:bjc;2:gir;1:bk0ckzfhagl4wh5;2:ah8gmljk8qhfsjswhg;2:8h69j3ehcjjkrk0sisujiwj4;1:bh3cjt;1:0hg2hg3he4j98ix9h8ciyeiofjeijkjheqiz;5:0he1h72jf5iq6h97h68goakbbikch9dheehefh8ggahhejkdkgylhdmmwnhhoh7ph1rglsliuh0;4:0jx4gtwke;6:bj6;1:3j08h69gsamrchaejlfhagl7rh3sgkuiqwhf;2:8h7ahdch2fhegjkhoxjnamhgqh3rgvwgy;2:0lu4hc;2:il8;2:7iw;1:4hhcjvijm;6:gj4;2:0j5;1:rj2;2:1he3h64jy9jhaj8blach9ggviiujghkh4lhdmhephcqh9rlnthduhb;a:8g49lg;1:rjdsj9;2:4ji;2:0im;3:eis;2:0h61hf3he4h75iq7hf8gc9ghah0bhbchhdmsekufj7gj1hhcjjjpheqjgrijthbujxwgt;2:8mcthg;3:qkx;3:qkw;2:hkcjh9mkx;1:cjnrha;1:8iw9h6dmneh2;2:rlq;4:gj2;1:giz;1:1h58gk9jrehhfk6gjcilvwhe;5:5iq;6:dk7egi;4:ahcfjw;1:clc;1:hj1;c:jh4wl9;a:cir;1:ah4jjt;5:km5;2:0kh1ml3kq4io6h97hc8h49izagwbjxdhbeh8fh6gh3iinjgskgllh2mhdnguokvpgwrgvth8uh7wgk;2:3jl;2:gjdlj4;2:0jb1jr2hc3hhbimciqejzfizghdhirrh1;2:1k4rh3;3:0jk1k23g74he5ke8ip9hbaj8bjtchdehchghjjlkhephaqlqrhbth7wgp;1:kjj;4:fir;2:0hg3hg6h79jnekdgheohg;4:qkw;4:lk7;2:rjz;5:8j8nl9;6:iil;3:ojr;3:ik9;1:lje;2:tjb;3:9j5;3:pmkwh4;2:jlhnj2;1:1l8;5:dj5;4:1il8h4ahbfh4gjehgljmjqjuwk1;3:fjsqjf;1:eiplm3;7:5kk;3:0ks1hg3gz4l78h9ahecikejffimgh8hilikkjhckhgoh9phcqhhuhdwh5;a:hik;1:jkd;3:akgrhd;1:2kk3h94mi7h99hbaglbjlchedh8fhaghdil4jgukgxoh7pj0qimrhhsh5ujhwh9;4:ejp;1:3hgah2dotfjejhf;3:6h58h99jtvkf;1:1gt3hd5hf6hf7he8jm9ggahbbh4fgjgjrhkfjh0kh9oh6phcqhcrkwth6uq6wh5;3:pk2;2:9irdhgejpwk7;5:1hfajxfivkhamkjnkhqiy;1:eheukk;1:5j4;1:0h31jz2gt3h24gx5ha6h57gy8gj9gvahebhdch1dh1ehefgvgh8hh4jgrknkmlynlxol6pl1qgsrgnsjetgyuikwg7;4:wis;3:ohdpk2;5:ggqnjeqjt;2:7kbmk3;4:rkl;2:9h9bj1cj5fk7hjg;3:5nscj6jh9;7:jk6;1:bk8;1:4nl;1:4jlplp;4:gj2;2:0k01j34gsjldrhc;2:3hf4hg5k37hh9k0ahfchgdm4elffgwghchh3jjokhhqh8ritthfuh0wfz;1:diq;2:dk8;1:gjj;1:gk8;1:5iqajwdjgefugkujjwsj2;7:fimlk4qjr;1:8h69hceko;4:hiljjp;4:3gpdjzejjjku;6:4lm;1:qkj;4:hhdjju;e:gk8;1:8kd;5:1hf6j17jn8hgajhbh9chffioghhjhaml1nhhphbqjlrhewkw;1:oix;1:7ji;3:rj9;3:1mnohc;1:jjg;7:jip;1:4n7ihe;5:fkf;5:8h39j2aj7cildgpeivhhdjivkhdmiynk2rjkwhd;8:0hg1gq3gy8g99ggairch9djaeszfj7gilhgyjgqqharituh4wjb;1:wjg;2:4jg;3:giz;9:kmslhfnh8oimpha;1:ajhbj1;1:3hg7ljjguqkawjx;1:8h69j3ehcjjkrk0sisujiwj4;1:8m89gpaotfg6whf;3:jizolupftrj0sk5;1:lkf;3:4jo;1:8j29isailbhhcjtehdfjc;5:4mahlephh;1:dh5ejf;1:rj5;3:al6;2:1he4jdak7fjihkirh7;4:dj5;2:ikb;2:9jsdknegighdjky;1:jjo;1:4j7;2:1hf3ha4h76hf7hc9ixbjbchedj9eirgixhhejj0khdojxpjoqhbrhbthhujkwgn;3:2jo8h8ghfjfxkk4lk8nipoh9pkisivuj1wha;3:1js8h0aj1bhddgofjgkjruiz;1:wky;2:rm1;3:ahffhagiyjnusjo;1:4iw;5:1ha2hf3h95he6ha7hf8gg9k3ah2cjcdhefgugj0hh7jgykh4lhgmhengaomppgwqirriptlfugywl4;1:ciqqjo;3:8heagyhnujj9qk0;6:8gn9m3;2:kk6;3:ul3;4:1hb4kd;1:khcnlj;1:5iw8gk9j1ah8chfehbfh7hj0nirojhphgqhfrjxtjjwjv;2:ail;1:jjv;1:iit;5:0jb;1:uk6;4:5lt9hgajrfknhinohdwhc;3:8hd9iz;2:8fn9jeaqpchgehgghdhhgrhgshfukhwh2;3:ahcgmzjhbsjy;1:hjq;1:7kr;3:qirrjj;3:fkx;4:0hf9ioak2chcejnfj0jhaqj9;4:ditejifim;1:fh1pkb;4:8jgdjsehc;2:wik;1:0h71iu2h53h36h77h68iobirchbdh8eh9fhbggyjglkl3ljbmj4njjokmwh6;1:0me3h79k3ah7bisdikeivfj1gh5hisjhfqhbwha;2:9jl;1:4kgihd;2:rlq;7:3k8jhawjt;1:4krgj8;5:gix;2:clh;3:8haeitwku;2:5jw;2:6il;1:wk4;1:ul3;1:0iz;1:ql7;1:1kcij5tjd;3:1he4jj5lj7k88he9hdfj6ghehimjfuolaph1uiuwgz;2:2iz;5:fin;2:3k04k08j6bhdcjpehajhg;5:gin;2:uj4;3:9heahabgxcoxghgrklwhd;3:akrfgj;1:cis;2:hhgjjq;2:1ha3lq;3:aiockofhb;5:9j6;1:nlaphfwl6;3:fh3glu;2:0ha8h6ajtbikdimeh8fj6hj5mjnrjw;3:8gtdj7eosjharhdtj3uhe;3:9h6dkzej8gj3;3:3hb6np7kk8hdehdjfsqheuh0vnowh0;4:5jt;1:1h4gnprh3;2:9j5;1:3lj;1:jjc;1:din;2:8juaj1;6:0h41ko2hb3h64gr5ha6h77h69gkdh6ehbfinggrjgzkjzlkwnmuog0pj9qgvrj9sivtipwgo;2:uj4;8:jhdql5wjs;9:5mzgh9jkcthg;1:siw;1:9k2ah9dkhegirizsj1;1:1hb6hg8giahgehffh8ghfjhekj6pmlqk6toewg6;1:rj4;1:3jpcjj;1:0hh8h09hbah8dk5eoffkyjhhthguhewhe;1:4kggiujhgqhhul0wkm;1:4minjcphf;3:5mjbhghlyjgurhe;5:0f43miak9gj3rhd;1:0la1hc2ha4jf5he6kk7h28jx9h4ah1bguginiixkh4lj0mhfnj4oh6pghqjbsgjuhgwg0;3:8k79gt;6:bj0;2:wk4;a:tj8;3:dioejaijcwjr;4:qji;3:dh5ejf;4:oj6;2:ah2sj4uji;1:pkd;1:0ha1hb3h98gd9gfaojbh8cj5dgvegffojginhk6jgsphfqh6rh0ugowjr;1:8ly9itdhbek4jh3rhb;4:fjw;4:hgzjjp;3:8gl9jzak1blcfgtuhg;2:8h4bhfklq;1:rir;2:5k4nkv;4:ijn;7:sjl;5:lhgrkv;2:1h13hg4hg8jhaipbh3cindhdeh9fiojkxlkgnjkogsph7qh9rk0shftheuhd;3:ah3fl2;4:1kh;1:8jbbiysje;2:8gp9ledjdjj7;6:ajibj7ej2;2:6lt8jdbh6khall5whc;2:8it;2:ciw;1:8gvwm4;6:0hc1lz2gp3h64h36he7h88hd9h1ah1bg7ch4fh7gh3hh9jgwkntlilmlmnmupjsqh7rh4thauh3wgn;1:kjl;1:rjn;7:8jd;2:9grdpmefb;4:ek3;5:wjz;1:dh1ejnnj3;6:2j0mmx;1:5jt;1:1jz2mcjjdrgxwhh;4:bj3dmhejkffqgk7jhguhgwhb;8:qltsit;3:5j5;1:3hfbjdwm4;1:agzbmg;1:ek3;1:9hcfkh;5:4kq;2:3hd9j7aivcjsgkijhaohaphbqkhrh7wh8;2:3ji4h98k69g6agvbhadixehdghgjiwko7nm4ohdpgvqh4shewgw;6:0jp1h42jf4kk5hh6ha7gi8grch9eisggzijskhglimnhcoh7qgzthewiy;2:9j3;2:1ld2g9ohbqlo;2:qjr;1:2ko3hf4gy5h67hf8jybhedh8eiohhgok7phdqhcrnuwgz;3:lhdrj3sis;1:jharkn;4:0hh1hc2jx3he7hf8fz9jqagxckpdh7ek2gixhkljjdkh6mheohcph8qh0uhgwil;3:hkb;4:ajl;4:1h38h19hgagxbikgn3rh1sjguke;1:ckmrha;1:0ip2ga4j66h47m99gzbkhehdfhaghbijcjimkh2lheoh9uiwwgk;1:cjc;1:8j1tlauha;3:fh0pli;4:mjgnh4plt;1:qjv;1:8hfah9dreejehhbthhwh6;4:8hd9jcajdfje;8:eithje;3:kip;1:fhfqkkwjy;6:0im;8:0hg1h92it3h94hd5j06hh7im8gx9hcbkbcjqehffiuhh7jgxkgtlhbmhgnmloivpkiqilrh0thbuhewg6;2:ukt;2:8kmbh9hiojhfrkt;2:bh7iinkkd;2:molwj1;1:wjs;1:8j1;2:9h6egxfjwglzjhgrko;1:6gsjheqh7umavo6whd;2:0h51h43ji4ha6k07hd8gn9hfagybh8chcdjgemvfkwgh4jgykhenjlojdqh3th8uh6wgu;7:ajn;1:cjy;1:0ju;3:blj;2:0li6os7h6jhdphbqh3wh3;3:1he2ip3he6hckjanj2pnjqhawh7;5:mk4;8:mlyrgq;5:0j31is2js4jc7hbaj3bh8chddhgeh9hhgjjdkillipoh4pilqgzsh5thewhb;3:2kn5injhemilwk3;4:aiqfjipjm;1:6h8uhfvl1;2:bj6;4:nl2;2:qmd;1:9jfaiqfjj;1:njf;1:9it;1:5ik8hb9omagzfhagjs;6:0jiljt;f:8dk9n8;2:4ghin9;6:1h38jvaixbh9dheehafitjjekimlj5njrogrph9qhfrk9shfthfuhg;1:0k94gu;1:lk7rhe;2:2j33ha4ir5jf6g37kf8hf9h7ahfehbgh8hiyij0jlloh0phgqh6sjbthfuhevkiwgm;4:8l39h1bhfilp;3:gir;c:0jd2iz3jd4h97hhdjtggxhisiikjh8phfqh5rheuhhwju;6:ciy;2:hkrrh4;3:8iu9jbfj0githk9whd;5:bh7kkf;3:rjl;3:0h91gz2j74h35hb6lt7gw8iv9gqcj6fjsjghkh0lhdmhdnhgoh9pgyqldrhcujcvj7wg2;3:8j9;2:6m8;1:cj0hj1;2:cjl;4:bk0ckzfhagl4wh5;a:0r21il3je6hefh8gj9jh0phcqh8rinwgo;5:iirmml;3:1lz8j89n5egokhg;3:9hdajrbircjkfirghhhjoohfpherkoth8;6:1hf2hf4j8khfomfphfqherhawn0;1:tjd;4:0hc1h63hd9iubjlcp3dhbjgvkjjlhbnhbphbrilshdwgy;1:8jw9h2skt;2:jl1wl9;1:0hg1h23h96hg7hg9klajpbhhdj9eg4hh2kjimjdnhgohbph5rlcwil;1:2iv5io;3:8kp9leakublfch8egvfgnghcjh1kjcnhgrhbuh4wh3;3:rix;3:wjm;4:3l5;1:6jvjllvh7;2:0h92h54ha7ji8ilcireh8ghdhiolhanhfpijrkwsiptijuh5wh5;3:dj5;1:1ha4jr7hg8h6bhcdhgehefhfghfjhfklimhcojqpjpsiktlkwgz;2:dirpk0;3:ej1;5:8j09k2ajpbk9cj5egvfhckk4nhgwh9;5:1h98hgao5cllgh8hhgjhgqhgrh6siwwh2;1:0kn;3:min;9:ckxeh1;3:1jm2ka3hh4gz6jp8h99haaimbh9ehfjgykk1mhbnhbojjph6qh9rksvhd;3:hjajikqj6;4:0j1;1:kip;2:ggrhkpwkb;1:cjghkb;2:hje;1:3hh5lz8gxfh5gjwjjlpheqhcrhctn6uhgwh4;1:qjr;3:fit;2:ck6;1:wk6;3:oh4pld;3:ciy;8:0h68j39ijbmfgiojh8kh7qjbrhgsjauilwhb;2:jl4oh5pjn;1:1h44jx8gl9jnehcfjwgjailawhd;2:4ha5qguhfwhc;c:5imijhrio;1:iiw;2:2il3jcghehhbjhclh8nk8ojirkawjs;2:9n0;3:jjnmkl;5:0hc1gm2jk3h45hh6hd7gw9h0bhfdh8fh3giujkakh1lh8on2pj1qjasjcthcuh9wis;1:1hgbm5fh5ghghhfjh3kmqlhboh0phgqhbwkl;1:0iq8il9j6ahedheej7qk1siywhh;1:2js;2:ah5cjnghgsjyuhbwkq;1:ah6fjdjjnwme;3:1l02ke3hd6hg7jvbghfhajh4klnlkqoh1pgyqharh2wh5;2:wk6;4:2ky4ir7kgbh6jhekjx;2:0h6ah6fle;1:ukt;1:0hg2hg3he4j98ix9h8ciyeiofjeijkjheqiz;4:1hc8h9al4ciufh2ghghh4jkekhaogxpjqqherj1shgulbwhb;5:hjm;1:0hg3h94he6hh7hh8j49h3bl7ch0diuek0fjtgguhh9jh1khdnjdokjpgvqj3rhduivwgq;1:4ix8lk9gzehc;2:tk9;5:4hg9h2akqcipfkzhipjh3uh8wh2;1:6kx7mophhwha;2:ejefkpghdkhhlk1nhdojl;1:8hflnynhg;5:8gl9inulj;1:qjx;5:9hcdmcegohj7;4:nj4;2:ojz;1:bil;1:fhfgl4hkc;a:5m2;1:8k79gt;2:8in;2:bj6;a:jjc;9:4iycn7;1:7kk8jh;4:9mmegf;5:uil;5:ejh;2:6jm;1:lhgrkv;3:mm7;1:kld;1:cjnrha;4:ijt;1:ejg;a:hilnik;d:8h9gkkwk5;4:7jn;1:agzfhggk9sn4;2:4l2ej6khfljtnkuqhcrh9;5:ljltk0;1:9lgahgcko;5:jkw;7:4ij;2:3kw;1:8ha9j3cizdjf;2:1iw8h2kl3;1:8h29hgbknfnfgh8;1:1hgfhbgkvhj9rjlsil;3:0ki1lg4h8rh8;2:6hdnj8pnzqhewhb;2:bhelkh;1:djhegx;1:2iw;2:5jg;6:4k7dhgihfjhdohcqlkwjs;5:4jqche;1:ukm;2:8kc;2:0m36h9;1:wjw;3:3iw;1:ul3;2:rij;3:6ky;2:1hc5hg8go9h8amdbh8ciqdipfmwjh1kh6mhgpiuqisrh6thhuh4wh1;2:akofj3;1:lkf;2:am7fgesj7;1:1lb;1:oj2;3:0iy4l15lwah7jh8;7:rir;1:wkv;1:8j1aj7fjj;3:hhfukq;5:hil;1:1l3bhdjjyqj3wjq;6:9kcehf;2:iik;2:aim;1:9iy;1:fjeghf;4:bmifhfhkvjh8kgylkjwj6;1:qli;1:8ipriy;5:wjp;5:ahcfh7kgrmojnhdojupjkwhb;5:akehirjgzqj5six;1:0jh;2:ijv;2:5nscj6jh9;4:hju;3:mmf;6:8gi9l9;3:tju;1:1hf6h38hgahgcllghflk4ninrgnuk2vkiwh5;2:8gyulm;1:aj9fhbjku;5:8hhtktulb;1:9leejo;1:jgzrmo;a:8h5ahcbh5chffh3gh3hsbjkdrgsthhwh3;1:4j4cj0;1:cj8;4:3ki;7:jjoqje;2:rj1;1:iiz;1:tjv;1:jiv;1:9iuaj4ejtfh3;1:0j7wkg;2:hjw;g:4lh9iuahejhfuj1;4:ahdfhbgjxljm;a:flv;1:rjt;7:ah8cjrhilsk1uhf;g:djbeh8;2:disrjd;1:ejz;3:8j1;3:pk0;1:3k39hg;4:7khbltrjy;1:ujy;2:1h32jl3jk4ip5ki8h49hcbhbch6dh8eh9fkhgh4jgtkhcmhfoh2phaqhbrjptlguiowgx;2:5imgj9;2:1mi;3:1hf2hf4j8khfomfphfqherhawn0;2:oizsji;1:8jh;6:9ijnjxok6;4:1j72jx3ha4h46jl7k3ailbhech7dg9ej9hheoj2ph1qh3sheuhavhewik;2:3jsjkr;1:3jf;1:8mc9hakhh;4:kjn;1:1h98hgaoxcjggh9rh6siywhd;1:wjm;1:3lcfj7gh4ohdpl3;1:gjb;1:cjhrh4tkp;1:8j9;1:5lo;5:8ik9h6aj4bitdh4ekqfh9hikjfxqkesl7thg;3:2gdoki;1:1j5nil;a:2ka5ip;1:3jz4kx8gz9ivahfbhhckydh5ehcfj4ggtjgrqhfrhdwlz;5:6fuojjwm5;1:qk8;2:5is;4:3ik;2:5lxrgt;2:amyfgzuj8;3:ghgsir;6:mlm;2:uix;6:5j3dkmegs;1:3hf4l96kx8hadhhghfjgukhfoh7phaqgvrh9ukkvm7wir;1:fj0;6:hgtlgrroe;4:3nq;1:8hgkkh;6:dh3eksgm0;2:rir;1:pjf;3:fk3;3:0ip1k9;5:ahejm5rhgsh2;3:1jt2ld7lijhdrh1wh3;1:eit;3:ojf;4:1iwahebk5fh5giuhgrjjiqkkwhf;6:9jbjjm;2:2lk4m8jh8;7:0iy;1:9iv;4:0h41h53h84jg6ha7hf8hdaipbhgcjzdkkeimfilgh4khcolsphbqhasjvthfugzwgz;1:9ik;3:ujg;3:8l49gndj3egpfkoghcuk0;1:4la9j2dio;4:gir;6:4jwajebix;1:4ix9ijcjwljf;1:po6wh7;3:tjb;1:8kw9lnajsblechaegufh3jh3kjhnhgrhduh5wh5;1:1h3wm3;2:7j9;3:hik;4:0jg;2:0hd3h14im6l17h88fr9gaahebhhchbdlieqtfilhh1ihglinph7rh5thduh2wgm;2:2h64nwjk4lj3wh9;3:aip;1:3k2jhdqjfwjy;2:1oqrgr;4:gjt;a:9hfdkjehahjatjj;d:ah7fgqgm5jhesj4;2:8j4;2:4he7h78k09gcagjbhcclkdhgeixfiwhhajkdkhgrfutpauhgwh3;2:8ir;1:siw;4:chfeiogn4;1:7hgjiwlj2sj0;4:1ja9h5ah8eitfhegn0jgukh7liprkguizwhe;2:fiq;1:ak1fh9sj6;2:8gt9k1ak8bjmfgx;5:tjo;1:1gegpahh9lj3qjnrgouitwh6;1:0ji1hc4go5j89j6ah8bhgckiehbfiugkahjojhalktnhdphargqsh9uh6wh0;9:aj6ujs;1:jk6;2:jhhlkgniusj3;1:1hf3h74hf6k67hb8h79hbaj0bhacg4dkheikfgegjchixjivkh5lj2phaqh8rl8sh7uhfwh1;4:dk4eg1rjusjd;8:uix;1:0hg1jl6inahdhjcjhelk0oiophdqin;1:2m17hgaj4fh5gjljkxphgqh8;2:ok8;5:8k8ak2;2:nlb;3:njr;6:3h38gc9gmchcdjjetdfjkgirhh2jgwqheuh6wgx;1:6pqvghwgv;2:4j49iw;3:jkq;2:ekkrk7;3:wkk;5:cjfgiljjq;8:0ly;6:aivjjo;1:aj9sik;1:hguqjl;1:jgqqkswjv;6:qjg;3:ij2;3:8gwkl0lm0;1:0jj1pm3jl5he6h77h68g1aggbk5ch6dhaeh9fgtggriitjgikj0lgzmh8ngvok4pgnqisuh2;1:1hf7hc9h5chfdhdij5phcqj2rh2sj8to7uj6wgx;1:6lmvf3;2:jhgwl3;3:qj4;2:jjx;2:9il;4:bk7jjrqhh;1:jmaohgsijwgy;3:9jy;2:8hfdhbekxul5;3:njj;e:hl9;2:3kn4ky8iq9hdah1bh5chcgh6hhajjckkflgeph8qhcrh9siruhdwls;3:0hg1jr5imahcbhcdiseh2foijhfrhbukvwh8;3:1j33o5rhf;6:gn3jgwqkmwhe;1:0hf3ha4hd5hf6hh7h98jr9h7fjthhaiinjjzkh2ljsnhcohbshhtkkwgh;6:hgzrkr;3:7h49hcehgjitmkbqherk7wlf;2:8ikal5rhc;2:njj;3:cgvjjtrjz;2:1l9jit;6:0h91he3hd4hh7hd8gdbh8dl7ejkfk5giyhh7jj9khglhfohephbqh5rimsjgujrwgq;4:hik;1:dj4;1:iiwjkp;4:agvdheej9fgzsleuli;2:3h66ng7kd8h9ehcjfkqh9tjfugzvnfwgz;3:bjfplkwhe;1:cjy;1:9h9bj1cj5fk7hjg;8:njj;3:aklcinfiwjjf;3:gky;3:wjn;1:qjq;1:0in3iy8hbajpdnqegefimjhfmjewhg;2:gk4jm7phcqhe;1:8he9indj8ek3;1:dekemg;4:qjc;4:wj4;3:8hd9iz;3:8hdgkm;4:cjy;2:bj5;2:0hg4is5j5ahbbhcch9ekffirhivijyjgolinpheqh6rjgtixwh3;3:5m2;3:0jh;6:wmg;1:9iq;5:4jgphfqldwhg;2:5jg;3:4mibj7;1:4jq;1:jk3wha;1:gk4tj9;7:8he9ja;2:kmwlhgnh9phd;2:0mf3h88jzahddineiwfj1gh5hitjhdkhgqhdwhb;4:nk4;2:hjdukk;1:4kq;2:qk8rkh;2:rju;1:ahefkn;1:5jwaivfjohixrio;5:ejs;2:0kh;7:2j1bjpgl6;1:1hc8h79gwchdehdfh0gj3jiwlj6rjruolwhg;2:jgyqki;5:9is;1:0j3dj1ej7fj9;8:6ix;1:akqbh5fhckj7lj3nix;3:cj6;4:5imtjw;2:2j7tjc;1:gjv;1:4le;6:dj6egwukk;4:6lejhcqh1rhgul5vmswh9;2:wlb;1:sk5;1:dj5;1:6k6;4:8heej2;3:mmi;1:0l61ne8hgahfbhdfh2gjpjhfrhcuknwh5;3:kj4wkl;2:cixhhgjjo;2:0iz;1:0hf1hd4hg8ir9j1ahfdj4ej3ghakhfphbwip;9:cjn;2:tj8;5:djljlvmlzohfrhewgo;5:3h47ha8h29j3agnbkwdl1egqfjjgh6hh2jixqjirj6shftiyuh9wix;b:jkw;4:8ircitfisgiqjherjqsl3thfuhf;6:jj2tj5uiu;1:jltwh5;1:1iv;1:6npciyfhd;4:1itjhbkhfmiyogppk0wnn;1:8ks9k2eh7;1:0iv1j02gd4jk5iu7je9h4bjmdhefhdij9jh4liwph0uh9;1:jjr;1:ajgfhd;3:4hfuke;6:8iu;1:hgajk3wkw;3:2ki3ko4jkjh3rhcujswhe;1:7hf9g2blgcmsdgxelrfirghargy;3:0hd8ix9iqailbhgej7fhgjirphd;1:cis;1:2hd4luio5jheuhe;2:njvohf;2:blj;3:7kuaj4fh5jhh;3:8jcbhgjkarke;5:8ir;3:2nh3jjwhf;3:8km9hcgjk;3:2je5jl8h7ghhjhfkhanovojfph2wgq;6:wl0;3:3j2;5:8h29gfdm9em1fiz;3:hj5;1:4iw;6:wks;3:wiv;2:0hh1jp3h94ji5kgaivbhdcimegmfgxgiujjmqh6rhetk6ugwwgy;6:2jr;1:iio;9:8fl9lxcit;1:dhaekh;1:0hd2jh3gw6gi7h09h3bhechedh5eh1fgdgk7hhajr4oh1ph6qjmrh2sj2thdugzvk4;1:rjy;2:rir;1:8j79l5cjm;1:5m48j59jdnjioherha;c:bjc;4:fky;2:0ld1noahgbhgfh5gjyrhdwh8;d:5mv8h4gkqjhd;6:6hcdj6uki;5:gkb;3:gky;9:aj9;1:hjc;3:8jskhbnjt;2:jjw;7:qlz;2:jjq;2:mjd;2:0ha1gk2hg3jy6hc8glah1bh7chgdhgehbfgwgh8hhfjh2kgglhemswnh6ojipixqgzrh9tn8uhcwgp;1:iiz;1:9j8;1:jhcql0;5:0h61h73ki6hc7hf8ga9gvamybh5cimdgteg3fqhhixkitlhgoh9ph7rgzshgth7ugn;3:5l38li9gzdh0ejifh7ghcjh7kirqhfthdwkm;1:hj7;2:1pn3hd8gi9ioagkbh4fh4gheiimjh8kn6lhfohfrhcwjm;6:kh1mli;1:0iw;b:mjg;4:lj4;3:2h93hd6l17jecjmjhbokwphhrhcwk7;4:7l4jm6mhhogwpkkrj3wh5;2:9j5;4:1he8h89gyaitchgehdjizrjwuos;3:8jj;2:cip;5:biu;4:al5fhekh0;2:0l31gq;3:al5fhekh0;1:8hbahafjosistlzwhg;1:fiq;1:5mj;2:1ha3lq;2:hjujhf;4:wl8;7:0he8h09llcimdglelzfj6ghfuhhwhb;2:dhgjlh;1:9lgahgcko;9:fiu;1:8hc9j0giujhdnl0qjfwip;4:jhgwl3;3:ojg;a:riy;7:ulk;5:dja;a:jjq;1:tjo;1:8jg;2:8k4;1:jjo;6:ajefhdtj3;2:8jr;1:9je;2:jherkftjqwj2;2:kmumguogs;4:fj2;4:ahchkfmk5;c:jiy;1:rj5;2:8he9indj8ek3;4:1im3hb4h66hb7hc8h79jkajccgwdglej9ggshhejgtkjjoguporqh1rfytkyuhdwjj;7:cfqrm1;5:8irwk0;5:dgwelm;7:8gy9koalxfgfwhf;1:0ls3j9eiz;2:cguejnfjl;5:2j9;3:4hg9imcinjh9omepgtqm2wha;1:hkrrh4;2:4kq;2:2jc;1:1he3it8h29goahdbhbclweh5fgogk3hh5iisjj4pheqhcsonuh9wh9;b:6l1;7:bla;7:5j1cjjwk6;2:8jw9hf;2:jgqqkswjv;1:1gwnjgrku;1:jjv;5:bk0ckzfhagl4wh5;2:3kk;8:8hf9jyah5ej6fh1uk0;3:dlxeg4;1:0kl3gh4ll5he8hebjshipjhcrj4;3:ukc;1:gj1plhwkj;2:djehjhjj7oiyrjy;2:il8;5:8ix;e:qj4;1:8hgdizeh6kke;d:kjt;3:8jn9h4;5:0hb1gx5j16iu7h59h3aiqcgaeitfizhizjgpkiullzmizogupguqh2rkish8th8uh3wgl;5:8m09gjbirdh0ekd;5:8j09juaikbhfcjmeh1fj9;3:rkl;1:gjc;a:1lt9ixdkxegxkhcuip;2:fh5gl3kh9nkg;c:1jm2k63iv4hc5ld8jubh9chhejdgh5jgqlhenh9ohapiqqh3tikuh8wh5;5:ciy;2:iij;7:ijt;2:8iwdir;6:gk8;3:8gzkltlgh;4:0lz6h88hbgkg;2:cizfmb;3:8hf9fxaj4divek9fju;1:qlg;1:1hfakahl7rhb;2:hkd;2:0h71hh2hb3hg4ne6hcajhbh9fj6gh8khfokqph9qhdripthguhewh0;2:0k2mjuqk9shf;1:2iksj4;1:4kkdh5ejaigs;1:2iw8h8jheplhrjw;1:ajmrir;3:ejefkpghdkhhlk1nhdojl;1:khgljptju;1:1hg5mr8h4gkljhbkgwml6phbwhe;1:wjp;1:jlj;4:1hd5hh8h19hbalybh8citdhafmtjh5kh8pj5qj5rh9uhcwh5;1:djbeh8;1:rir;2:5iq;3:8hf9inkimriw;2:6nycivhiujhhwha;2:rjk;1:aiudh6egnfh6ghgjszwh9;5:8h6ahdukz;8:okl;1:kjiqjb;2:ejr;2:8jg;1:aix;2:7ka;7:2ha3k06hd7he8h09hcbkmchgdh8eilfhcjikkhhoh6phbqnbrhgsl0uhdwgv;2:0h71ka4h49kfiln;5:tj8;5:djsegg;2:riu;6:qkx;1:8kd;1:jj9;6:dj8eka;1:0jz2ir3iv5ix6he8gy9hgdhcgiojiwkh3lh9njbrgosh7thc;5:7hc9j8bhgej9jhbkglnj6oklpkkqhgshg;1:9j8;2:qkt;2:ilt;a:fji;2:gjc;1:pln;2:ql7;1:0j31h72jn3h44h56h17hc8jk9jdagtbj8dhael5gkthhgjiskh7mhdoh6rgmwgy;2:iin;9:gl0;2:clzik6rgw;1:0h58fi9lragfdhfek7fkxjhhsj1;1:8h9bjvglhjhbkktoipwhg;1:3ji5is8hcbj5jj0niv;1:ej6;3:tj4;3:bh7kke;4:3lg;1:kmslhfnh8oimpha;1:1n58gj9iragnbh4fh5ghgiiojhekndrhewjz;3:hjx;4:rje;1:3h86hh7hg8lgah9bhach3dncfgsgh5hgqjkikk9ohcphaqjrrhdthbuha;2:dil;3:sjj;2:0jb;8:0hg3o5cj2wh9;2:nmrohfphd;2:8k2;2:dhfeirjj4km5lhdnh4ph2qm3rhcthfwhb;2:agsfghgnohkc;1:rikujk;3:il4jjk;5:1j53jyjh7rhbwl6;2:gikjm4rjy;2:8l19gveh8hjrsj8;4:to6;2:dkqegg;1:bke;1:1h93hg8mr9jcam3bh9dhdehgghhjh3kgllj5qhbrk5uhdwh1;2:4l28gtjhfqlvthe;1:djp;3:8haagpbixhl6jgzkjlmj9qixrgitlk;5:ald;3:al4sg7;9:5ismiowkg;2:2mz4h77jr8iy9jeeh9jh8oisphcqhfrhdwk6;5:bh3cjt;4:hiljjp;2:0jomik;2:ijn;4:0ip1ik2ji3lo4j27h29hgaiwbh5ch9dhbeh6fkrghehheihhjiuliknhfoh0qgpsh4thawgw;1:ujd;4:8jv;2:2lnjh3wjt;2:8gx9jqahfhizul1;1:0jq1gx3m4;2:6hcuhbvku;3:4kr;6:4ha6l6jhaqh0rhfun3vmgwh9;3:blkfhegjghj5ojm;4:gio;1:sj8;1:ciyfj5hiy;1:8in9jf;2:hguqjl;1:ij1qj4shg;2:8h89ilah3fj8jhbsjmtj1wm7;3:fh8gkcsiwuk1;5:3iy;1:8jech8dinfjsjhaujn;1:3hd6hh7ng8fu9ncbledhdehdfh2gh6kh9lhcpheqivrgwthguh8;2:al3hipjgvojjqiysit;2:1hf8hd9h2rkaun9;1:hjdqk1;3:8ioeizmjc;4:lje;1:0jx3jb5imah9fhbnj5wkc;1:rj1;2:fj5;1:ckxeh1;2:7j0hik;4:fofshewha;4:8gx9ltahhllbwhf;2:gj7;3:4k1ghghgsjlfoklphcshcujywhh;2:iip;2:8k19h4;1:gj5;1:9k3;1:mix;4:2hajl1;1:hiljjp;1:0io1my2hg3gv4jw6h97k88h5agvejbfjpgh3jh4kh7lhdmhgnhgojbpj7qh8rgouh9wgw;1:aitgkvjhcpktwh5;2:lhcnksrjbtiy;1:bjj;2:2ms7kmohbwhh;3:ljr;4:dk3;m:jjk;2:ehduku;5:0jacl9rg0;1:5pb8hcaikfj6ghghinjhcohaqheth9uk6wh5;1:qj9;2:div;2:mix;3:wl0;2:0ll1ha4ha7h78hdah8bizchfihdjhdkhgljynjophgqhcsitwlc;3:bk8;5:jjx;1:hli;2:bjrgl9;4:3jd8hhahcciyeiwhgtijwrivtk0;1:9ik;1:9jggj1rjs;7:ahcfkjgko;2:3hc4mc5ov8ha9hgbhgfj0ghbij3jh3oh6ph7qhath8uhewh1;4:cjiujd;3:pld;2:5k4;2:0h61hc2iq4gx5hc6he7he8k89lrah5bgkcjiekchiykgxliumhgohdph7qh0rixuh7vjnwgr;4:8gg9k5;3:gjo;5:ahefjrolaphc;1:6lejhcqh1rhgul5vmswh9;2:jmdwh0;1:3j55ls8k3bhcejnfhfghhjgxlhgpizqh7tiouhdwh9;1:jjy;5:dk5sis;1:3mqjh6wgu;6:9irgio;3:1gh2hc3hd4iz5ko6he7hf8gn9h6aj2bjecgxgj6jgakjulhcmhconzpgpqhcrgdshftkpwgp;5:him;1:0kl3ko4hb8ikeiqfhgghbik1jh7ninqjirhfsgrwh6;2:dj1eh8;5:djs;3:eix;4:1hg2hf4j58hd9infh2khfom7phfqherhauhfwmq;2:0kw1h92hf3gu4jb7he8gwbj0cimdhfeiogjmhjiiimjj3khalh9misnhcoh6ph4qgxrh0sgzwji;3:3lj;3:qlqsgf;8:4gvikc;4:8j2;6:rip;1:gir;1:ej2;3:4hb5qljgswhg;1:bjj;1:0iz;1:8is9j3ahfdhdejbfjygjk;3:ag1fg7jgxwq4;1:sj8;3:1iw8h2kl3;6:dj7;3:ahadk8fk7givuij;6:0g51qioh9pk9rgo;1:4jcahcchchlsjhemk7;5:lk7qjv;1:8j09k2ajpbk9cj5egvfhckk4nhgwh9;4:4hgpmm;1:2hd4hfbiogjqjmmogipmmqgywgx;4:gix;3:fhagkvhjm;3:4nr8jh9lmbgkchbehejheohdpjgwh6;5:1j33o5rhf;3:0j41gk2h63mf4j55he6l67go8gq9gxagydheeioigyjjukh9lhemhgnjvogwpgiqhbsilthcuh2wk9;2:fhggjm;4:cj3;2:jhdtksukd;8:djm;3:0jp3jy4h99hbahdbhedjvejcfh7gilhj0ijkjgupheqiyrhbsgp;2:ij1;3:bgjchagmelkmnh3qjy;2:khenkg;5:dhgellfgv;1:njf;2:9jy;3:eik;1:0he4io8gx9grahadn4eltfl5ghgjheuhdwhc;6:0j51hf2k23g84gx7hc8jh9hebh6fhehh0jjxojoph9qjcrmnuhgwgr;5:wjg;1:8j89h9cj2eirfjjjhgqj5;6:4ji;1:9jtdj3;7:ilt;2:8iwbh5jhfkk7rip;1:4j98h6ehcgh8jkgpl4sintlkwgv;2:0nb4kn7h6phgqivsiqwh4;1:jhgrkltjs;7:1it4l28h1kky;1:bizsiv;2:8hhhjjij9jjwrk0;2:4heijyjh4mhdop9pj0rhdwhe;2:9iljgvqn0tkn;4:0jvdkjegh;8:0hb8hcak2bisdh5eh7fjnhjjrkb;3:4l9qhguk4;5:0hg2hb4loghbinyphfqherheuhcwjp;9:ciqqjvsh2;1:9j2dkvegzriwuir;1:ghbphdqjvwm1;2:2iu;1:dgtfjugiy;1:aix;2:jgypld;2:mnu;5:4l2bh5khall6pheqkjwhf;1:1j52hf3hh4hg8km9gjdhbegufj7gj2jjdkiqoh8ph3qitrgstj6uhgwkj;1:ina;1:3nq;2:5ls6gz9iodh8ejeuk6;3:gjdlj4;1:jhgwl3;2:ujg;5:gli;4:ggrqjy;1:giz;4:gisjheumi;7:3l0wkn;1:7mj;3:0j3dj1ej7fj9;3:ciplhgrkt;2:gkd;1:bksgj6khc;1:ukevh6;1:4kg;1:1h53hd4io5kn8g39h7bkkjhdkh1mhfohfrn4siwtheukkwh4;1:dhdejf;1:cja;1:0j2dj0ej5fj3;1:1lg2fi3gu4ha5hf6h37s28hg9h7agzbikch2dhdeh8fh7hhfjiwkgqlj1mh7niooiqpg8rh1sjzth6uh8;3:mll;1:9h8fk8ghghj9qjk;2:0j3dj1ej7fj9;2:0jh;5:bjxckm;5:8k09j4ah6dh9ej8fjugjh;5:jj0;5:eiq;1:aj9bjtgknrhg;5:8j2;3:8h1bhgdizekmgiulilrlr;1:djhegx;2:flr;4:jhfmkapkr;1:jjx;3:riy;1:4h78haah6cj5ehffjoijrjhhnlooj6pj4qhdwhb;2:0ml1hg3h66hb7jtchfgjbjjzohdpgyqh3rlhwgt;3:kj1;1:2m3siyuin;2:1hb3j65ky7hebiojlkml2qh5rgnthbwh7;1:tjb;1:0ioukh;1:0hf4hf8h39ioahgfjphkupm5whc;5:qn0;2:wm5;1:ajfcj7ejhfh3;3:cir;2:0he4io8gx9grahadn4eltfl5ghgjheuhdwhc;3:sil;1:1js5ikkgwlh0nn4ph1;6:2je;1:wk4;d:9hdhk9;1:8gg9k5;1:3kuah5ujk;4:sin;5:hkv;7:jjo;7:4ke;1:wjh;4:jjonktojuwh9;4:jkz;1:fllshf;2:9iv;7:qkx;1:uj4;1:iikolbphg;c:fhfgk4;4:8jv;2:ghgsir;2:lj3;1:8h59grakbbhgch8ej7fjxgksjjtqherh4sh3uilwh8;1:bh7kkf;2:3l9;2:ohdpk2;6:3kk;3:1he8gm9ilaitbirckjdjlfh4hh5kkamijnjmpheqherizuhbwh4;7:8ip;1:5pgfhdjhg;5:1jcrhg;2:qkw;2:4k9fhgihcjkmkje;3:8jgck9ehd;2:8h8bj4gk7hh3jjanghol9rh8wk1;1:riu;4:0k94gu;5:8hfdlnegnfh3gkv;5:5ka;3:1kx4j6gh8jkarh1;6:bk6eiq;2:ak7fgy;3:eiv;9:ail;7:2h93k94hg9j3aircjngkajj6phdqh1rh6wh9;1:giukkolgo;5:cim;2:9jy;4:1jk;3:5ip;4:3k38h29hfbl4dhaeitfhgjjpkh6nhfok0ph0qgyrhgsleuhfwhc;6:gix;1:1gl2hc3he4j35ky6he8gr9h9ajach7fikgjdjgakk1lhdmhdoohpgsqhdthcwgt;1:7frjll;3:1hb8fy9h9ajicj3fh3gjhjgxkpuohgrgqsk2uhcwh9;1:giv;1:ahefkf;1:iijwji;4:1h3gj0wm0;8:skv;2:0kb3hd;2:8is;1:4kofjr;1:1hf8j69h7cizeipfjgjhdmkuqj0rgp;5:lk9;2:2iw;3:9irgio;4:wnu;3:8jbbhecjckgumounheogtpguwhg;2:0m46h9;1:9j2uiw;2:8ivafrbj4fmvkh6;2:8haeitwku;2:8kh;5:fjw;1:1iu2nl3m74la6h37hejh6oh0phbqgywgy;1:fjerjg;1:4j7;1:al6fhaggohldwk2;4:2iz5jc9j8cixegyghhjgpklylginh0ojiphcqimrhcwj5;1:pln;1:0jp1iw4ir;4:ujv;8:ah7ckcwjy;6:9k2;4:1ha4hb7ha8g2aiubhbegwfgyjh8kndmk0nk2ojspjbqhgsh9thdukewh5;4:wk4;3:mj1wkb;4:8h89haahbdk3el1fmkgherhewhd;9:4k78lb9gfdgpekdkhc;4:ah6ckagla;1:1iw2h43m84gx5hc6h47h58gh9gyakbbipehafgegj1hitkk8lhbnhdok9rgnsgsth5ujiwfe;2:0innknok0;8:8hfdkgej7hh6uk9wjq;6:bm0ch9hj8jjcrhgwhg;3:sjh;1:8fp9iyaobcljehdfh7gh3hhajh0khhnhgpheqlergzsiuthaujuwgg;1:5jx8kn9inaikbjewhe;1:9hdhk9;3:9j8;1:0io;3:sjs;3:8jj;1:jje;1:4jq;3:2j1;2:ahehkk;2:0mj3h88imahdbiudioeixfj3gh6hiujhfqhewhc;4:2ltjha;9:0n93hh4g8djgihcwjz;3:1h78haah3dhfehffgkgm0hitljgqixrixsjptituj2wha;7:8jgukk;4:0hb1hc2le3h14ja5lc6he7is8inbh0chgfhhgh9hhfjhakiwlgwmheoj1ph4rltshetheuhbwgk;2:aijbje;2:jh2vndwj9;1:sj7;1:hiq;4:4mm;1:3jy;2:3iw7hh9ivah7bhcdhbeizgh7jk2pj7qjhsj3uhhwh7;1:2iw;5:aj9;1:2l94lijhc;4:0jc1jp3g84hb5k58ik9h9aj3bj4chcehcfhghgjjj8kgpll4nhboh7pgxql8rh9th5uhfwik;4:1jl2hg3ha4he6hd7gi8hc9j8ahefh5ghbjh0oh9plxqqpwgp;1:9ku;2:8jilh9rjx;4:5lw8j1jgwkj9rjqsikwhg;1:cj6;3:ujg;1:jinqku;1:ik9;3:4kt8h9;5:2m8gjxhhejj9whc;1:ahgck5dh2ejm;8:alnfhe;7:0he1h03hg4l97hg8h4ahbbhdcimdhcegofj5ggpjgvlhemhgnlgqitrhdtj5uhgwkn;1:mju;1:8o69gj;6:3hc9jaaiubh4cjwgkojhgphdqkirh9wh9;c:fkjgjp;2:0pu7gujhfphhqhgwh9;1:gim;3:6j6;1:7jn;2:oir;9:9hedldehcfhdwkr;1:8jqdjsekujhh;1:3l0aiybh7dh6elmffokh3lkoojlphgwhc;7:8kh;1:dhaejkfio;2:fit;4:8h7alddhefh6giqhisrgiumi;2:fjs;1:alb;2:1kyjjbwg8;1:ciq;3:jmgwh0;4:dmjeg1;4:8indk3egnfio;1:qmu;9:agzbmg;1:git;1:4ilcjl;1:tjx;2:flkhj9tix;4:2j98je9hfahgdj7wkl;4:8h8jnzqh5;7:8iy;2:3nq;3:iip;3:jh0qkz;5:cl7rg1;1:cjc;6:2lk4m8jh8;1:his;5:djregvjl1pjttitukrwhf;4:0hg2j33h34jf6j98jr9m3bhadk8eg1ghbiiqohgphfqhfwgw;2:8h79h4aisbixcj0ehdfk2hkaril;1:1iwrhd;3:ah3fhejiqom1;1:fkjgjp;1:0kf3k44h46ko7hcbheeikfhbgh5ijqjgykhfohdpkyqirrhbshathguhgwgh;1:8hbjhdkh9mr8qilshbwhg;3:3hc8j39ncdh7egdjhauh6wls;1:8kv9llajrblmchaegufh2jh3kjfnhgrhduh5wh4;1:8iw;4:gip;1:jgunj9qjerkb;5:bkachd;1:kmwlhgnh9phd;2:1kr4j1gh5jlnoh3qh5rgtwjq;1:3q36hfjh9ph6qhfwh3;2:0k54grbjvkhgqj6;2:dlkegs;5:bj9;1:jj9;1:0he1j12hf3h64hb6hg7hf8mb9glaj5bjmch3ej5ggnhh8kjtphbql7rgzthbuh8wgm;1:6h17mnjh4;2:tj0;2:0jmdh1ejl;1:nl9olbph9;1:rjw;2:jkw;3:jjx;4:0iy3jfplf;3:gky;1:ejefhakm2;3:8k5;4:8isjjmwh8;2:0nu3h78j7airbhedkgfh1ghgjh9nipqhcrhfwh8;1:4kgihd;a:4l1ah8;1:0j06gihgrjhgqmmuh3vma;1:4izgka;1:5irdhghk6jkwwhe;2:nl9;2:2ls7hh;2:ojx;3:jk6;2:gli;2:9hefje;2:5k6;1:rki;2:5jl8kh9jkakqbizehefh2jivqh1wh7;1:gldjji;6:9j2;2:bj0;1:rjx;3:1im2j03ha4kc7he8j19grbguch6dh0gh9hhaijajglkl0liqmhgnj2oitpivqh5rgwthguimwh3;6:0hh2np4hh7k7jhdoizwiz;4:blhfhdgjfhj4ojlwhh;1:djb;2:9jjcil;1:0iy4l15lwah7jh8;7:8hcgkijgvqkc;1:3ha6hh7gujhcogsqu2whb;7:hjdjh8oh3qmc;1:qkj;6:kin;5:1j12j34kc7hd9gtahgbhaiinjhfkkdniopiprh1thg;1:1hc3ha8gy9h4ah6bh7gh5hnnjjgoh9siwthdvipwjs;1:5kljhaphbrk7sk6tjlwhg;1:3h99j6aiubh1cjsdhhgkgjhfngvplfqhbrh8wh8;3:1hf8kqahfbkpfh4jhgkkxlgvnk2oh9phbrj0;1:fkf;7:3j75j9gh9hhgjh1nk5okzpiyqhewjb;2:3he4hd8ld9koagabh9dk0eldfhdiinjgckhfmh3qherhbtjouhdwik;3:8h9jm6;2:9heejz;1:8h5ah0sjruku;1:1h62iv7iqahfkkarit;3:pju;4:flv;1:jjj;4:ljs;2:lkcuka;6:wl5;4:eimplm;2:3jy;2:0j6;3:dj1;1:qkx;1:blpkh6nm0pherhd;4:8iy9jy;1:ahefgzgl1;2:8itqjq;3:8k79gt;3:0j52is3j54hb8ikak0cjjdjkfhgjh0phgqhcrgwuhgwhe;1:0hb1h93h74io7h88k59hgchgdhbehfggkhkljjvkjblhenh9oj9pimqjdsk2th9uh9wh1;4:0it1hc4kw5jn7hh8h29hehhfjh4mn4qhdrgotheuko;1:cis;3:ciz;2:hik;1:0kh2ft4kd6h67ly8gychcgh7ijljgzkhblhbph4qh2uhawio;2:ah9jhhoj7smp;3:plbwin;8:ijq;3:dik;3:gl2;1:jiltj7;1:jhbljcqj7;1:sj8;1:tjf;2:1kdakrfhcjlpkgvrh1uhg;2:djr;1:8iraj3fhgnl6ol8ph8;1:9jm;1:0js7jb9h9bj6dh9ehagh2hjbjmvph9qgwrh4th8wix;2:8kobh9hiqjhfrkd;5:8hdbj5dhdjn2rjrwhf;a:3me7he8l09gqahfbgzckddg2emgfhgjh9qhewgw;4:dkqegi;5:0ke1h83il4lm7gt8h4ailchgghehikikejhcphfriuuhcwh3;3:jjx;4:0m56h9;2:0kw3l04he7hg8h7ahecilejjfingh8hiljh5phfqh7ujvwhb;2:1l62jr7ja8ikbghfhbjh6kltlkuoh1pgyqhcrh2wh7;9:riy;2:hkrrh4;6:0hh1h73hc4hb5hg6hg7hc8iz9khaiqbmlch1dh8egthh8jgtlh8mhgoh8pgxqjtrkash9tikujlwgs;2:9grele;2:dkgegs;1:rks;1:dhhejy;5:6hf7hg8il9hbah8bhgchfehdgh9ijgkjmlkfnjqpkjqgwtj2;1:wkw;2:4j0;1:wkj;b:7j7bg6rm3;1:1jj;3:1jk4hf6lm7heajvfgqgkkhjujhglhboisph6qherh3sh5whf;2:3h84hb6h17gq8iy9fwalrbkycjldhhjgwkh7nk0ohbph9qgvrhdthbujl;2:1hh4js8hb9h3aq5bjcchffg3jh3khfrk2whf;1:0he1n53h64hb6ir7gk8h99hbagmbh3fjlgh9hhekkvmj6olspgpqh2rhasituh2vjywg6;2:ql7;2:2ku3hg4jd6ivah1bjjdh5jhgkhboh5phhqj5rhguijwh3;4:ljj;3:ait;5:hil;5:ckmrha;1:0kq3gb;7:2il5ilhjv;4:4kv;1:ijs;1:8kd;4:9jz;1:1he3je8lk9izahdehffhfghchhfkhepk7qhgrn7th5wfz;6:amyfgzuj8;e:8gg9k5;1:nl9olbph9;2:5io;4:9ioajq;3:9k1;1:pk0;1:6kp;3:jjr;3:kkrlgn;1:8kj;1:8hbeh7fhghiykkjrmv;2:1jcrhg;5:9h8cizrk3;1:8gwaisbkrpl6wlx;3:7ji;3:3kw;2:8il;2:biq;4:8jswkg;1:agocjqjlo;2:0j5;1:hgkjjx;1:iji;3:fhegk2;3:wjv;4:8jw9j3ah6dh9ej7fjsgjfjir;4:8iqkkk;3:8k79gt;1:6h58h1uncvklwhe;1:tjf;4:9itejpjij;1:skv;3:4j49j8;2:3h38gc9gmchcdjjetdfjkgirhh2jgwqheuh6wgx;1:skw;2:lk2;1:oh9wkb;6:qjq;1:hg8jls;9:4it9h1chfgmqrheujc;3:4jg5ik6hd7h89h3aiychfeh1mhfngvoh2rjouj6;1:3jseimjhgllz;9:0f23mt;1:wk1;1:1hdahgkkb;1:3gf6jo8jf9gpjh7thevo7;b:4hc8iv9gzagtbhadilfhfghcjh2koxnmiohfpgvqh8shewjn;2:hguqjl;3:6gg9h8akscl3ehffhegj8hjkiikjgzkheqh3uh1vljwh6;2:8jfbhgwji;3:hjy;6:hgbjlp;3:8mjbgmdjo;1:4la8h3jipojw;1:bh6gkv;1:8jb9h9cj3eirfj4qj6;1:jjw;1:qhfrk8tne;7:3hf8jywm7;1:bl6fhfhilpljwhg;1:cj3;5:0iz;1:5kj9ikjhaphbrk4sk5tjkwhh;4:gj2;g:0ha1hg2gz4h55hb6j27j78jo9gsaggbh4chcdh5ekafghgjmhkmjhgkhhlh6mheohcph7qk4rittlhwgp;4:sjf;1:ajafhd;4:0j3;7:1hf4jmfhagkqhj7rjhsik;2:cil;1:5k3iit;a:4kgihd;1:ej1;1:3h96kr7gz9hbdhgeh6hhalizqherlqsixujjvkwwgv;4:8hfkjy;2:2kq3hf4ms7h8ah4bgzchfdh8fhaghgildjgxlhfoh7pj3qh9ujmwh9;3:0iu1j62h93ju4n75hd6hf9ivagwbgxch4dinegrfinggxhhdkjrlgfmhgohaph4qh7rh1sjcthauh3wkl;1:pk0;1:1lp4h3ahgbkziipoitphbqk8rhc;4:8hfald;6:8il;1:5j5;1:ngkolx;4:jh2phgqr9whc;2:gj4;8:3mvbjocio;1:iik;4:2hf3gv5hg6gm7py8iw9geagocimdgefheghfhhcjr0khdminohcphdqgpshdth3uhb;6:8gtjhako0nk9phaqhduir;1:8iw9ir;3:5ip;3:nj0;1:8o29gijjd;4:hkrrh4;1:8ir;4:aglsl7;4:rji;1:0hf1lj3he8m19ilakzbgqcisdheeiqfhbgh3jj1kgrmhfngxohaph7thcuh6wgw;4:8izrk0;4:8kd;1:qjy;5:9kf;3:wlo;7:plu;2:9j2;2:8j2;5:giz;1:jhfwjq;1:9jlhj9;3:jkw;3:ah9blxfjnrhg;3:3j2;2:wky;1:8kaah8;3:8jdbjf;1:2ik7ha8hg9heah8fgygjahgkjlrkjdlilniyphfql8rhbwh1;4:ejfhiyjhf;7:ahgcixfhfgjeijh;2:jh3wnw;8:8k0;6:siw;3:gix;3:8iy9j0ak2bivfh7;2:0he1he3gz4h96hc8pg9gwbhcchadhfghahgkjllkhbmhenhdoh9pgwqkwrgvshbtnsugowh3;1:ejb;1:7lhwhe;3:0ip;1:ohcpkz;1:8hc9habhhdk1gishipuke;2:cjn;1:agjckcfjeiiy;2:jj0;4:3js8j7bitjhbrkh;1:ujd;2:fkg;4:0hg3h78hgaiqbkbehdfjhgmnhhgjh3kh3ommphgqhbrgssj9uhfwgy;1:9j6;1:jhfwjq;2:8h89jscjr;3:giz;4:mk7;4:jjx;2:pls;2:8gs9j9ahafh8okxpkluiq;1:6mo;7:1hg8izbgzfirkkfrjo;3:8iv;2:6h8uhfvl1;2:0h03he8h49nbah6dkoegugiljhbohgqhgrh4uilwkl;1:8h29gthns;4:1j38jm9juah6blbchheh6mk3uhdwhh;1:nj5;2:mka;3:7j9;5:akifhdjhgwln;1:8ivjh5rkqwjf;1:0hd3hf4hb6he7h28h89h9ah7bh2dhgehffgwhfsjozkj6lilnisoh8ph8qparh9thfwgb;1:1j4;5:ok8;8:aj9;2:1gw2h53ha4mn8hcbipflmgh6jhfkhgohdphcqhdtkhujvwhb;1:4ix9jtahcfhdwkt;1:rit;1:jmr;2:bj6lix;2:eij;2:njs;4:fj3kjlohf;2:9jp;1:0hc1gr2jf3gv4hg6hf7hc8gxbh1fhbgh9jhcknwmlcombpjeqhcrhdwgv;1:8h69hceko;2:dk3;2:1hd7fuclkjkrkgumo3nhboizpgpwgr;1:2nu7k9jhfoj0wh9;a:jjd;2:8jqblf;1:9krgj3;2:2im;4:hiv;1:0mf3h88jzahddineiwfj1gh5hitjhdkhgqhdwhb;3:0ivwku;4:6kn;4:qle;1:3n68gv9maah2dhgej4fhhwhb;6:jiwwjj;1:8iq;2:kke;3:0g91qadj5jjqrgm;3:4hf8h89heajabh7dhffgtgk9hkejkrkhgokkphbrhcuj0wgy;1:gku;2:0h81it3hh4grdkkeh5fhhgkdhh7ijfjkvphgqh9rh8sguwlp;6:qkf;2:eiw;5:4jdljm;1:8h7ah8fhggohjk3qhdsjpwhe;1:fkg;2:0kh;5:9goel5fh7gjgujm;2:1gx3o7;5:lk7;3:0he1hd4he8mk9kxajvch2dhbegtfgpgh8hhdkkslgroh7phdqh7sj3th4ukhwgz;5:4jg;1:4kzah8lj5;5:2m9qjfwhf;1:dj5;2:3nq;2:3m45mvjhawhe;1:rhesnywhe;1:4it;5:9j2;2:4l1ah8;a:0hb4j16iw7he8ka9kdagyejykh5phcqhathfvj0wh7;2:fh2hjxwks;1:aix;1:dlf;3:ahcgmzjhbsjy;1:0il1h93hc4kl5jg6hf7kn8gy9h7dh9hhejj2mmoohfphbqh6rgithaukfwh1;4:9j8;1:dhgejwwk1;1:5nwjhb;1:jk7;1:dh5ejf;8:jjp;1:9h6dkzej8gj3;1:1hd2is4jc6ja7h78io9gdaj0bh5chffgnhiljipmhenh8oh1ph0qh7risth1ulivjdwha;2:3hh7h38iw9h9cjseiyfhdhikjg8pneqm4rgjwgv;3:rj2;1:4jg;4:1hg4jq8ha9h2apzbjachefg2ghfkheqhgrjzwhc;3:sjl;1:wkw;3:qjvtjh;2:7ly8hbah5fgyjh8ljsokopk8qhcrgcujwwhe;1:3lj;3:ngxplc;6:0h91hc2gz4h85ha6iz7j28jd9h1ag6bh1ch8dh2ejygjehkcjhbkhflh5mhcnhgohaph4qjwrj2shetla;3:ljc;2:fkx;2:5ikdineheflr;6:ole;3:ckmrha;2:dit;1:gjb;2:0pu7gujhfphhqhgwh9;1:fir;4:6hcul9;7:cjdfh8hmz;3:cis;3:fhegkn;1:9jvahcjlzrhesh1;9:4kv;8:0ha3me4k35j28hd9heaiybhcfh2ghehhfjh8lgsphdqh5rnutituhcwh0;1:0kn1jp2k33j16hg9h9aizchdfinlhfoh1ph9qh6rhgtheuhgwh6;3:1ko;3:ukr;a:hj7;2:4kfgiwlln;5:wk6;2:6hglj1pngqhcwhd;1:mj9oh9wk4;7:0hf1h83hg8gw9h7amhciydj9ejyfm4gj5hgsphgqh8rgruhfwgs;1:bh5jkmkk9;4:ukt;1:5nsjhc;2:dlf;1:riy;9:5iz8fw9haak4fhbjh1kp8lgfrh6skawhd;1:1im;1:ujg;3:akcfhe;8:0iwdizqj7;1:lkargj;1:8jvajifhf;7:3kgajh;1:0f23mt;4:fjb;2:1h22h53h84hb5hf6mv7ha8ij9haah2bgucgzejafkkgiohinjgzkheohgph5qgprjjukbvjfwgz;3:il8;7:qjy;2:1hd4m98gxkqylhgmgnnhgofyph1uipwhd;2:akofj3;1:hhfukq;7:5lo;7:0jj3hd4grgk7hgtijojk0qhbsgswmf;a:gk2;2:ljr;1:hg8jkjpjrqh8woh;1:2it7is;3:vnf;8:8k19h4;1:0ipbjp;2:jk6;2:khdnketjv;1:giq;3:1ij5jyhitjjdqiprh4wji;1:rkvwh0;2:9jg;2:0ka1gr2he3h44h75hg6mw7jw8h19h4ah5bh6cj9dh9eh3fgvgh4hh7jkxkh5lhemkdnh8ogkpjlqgirhftmzuh8wfo;1:5kk;2:afpckj;1:1kq;5:1h2rk2;4:agzdhgfky;1:5jp8jhjhgkhfrhetmf;2:hil;2:djkrik;5:oo8whb;1:dij;8:1he8h0bhekkimm0okpujiwhf;4:8ha9gjdkqel2;1:0h81js8he9m7aj9djoehejhg;2:0j0;1:ek7kh8nkm;2:3j4tkj;3:0jq3jz4h89habhedjwejcfh7ghchj0ijljgxphdqizrh7sgtwik;1:1k8dk0egpgjzrhb;8:ojx;2:1hg2h53h64h66gx7p59gxch9dheejbfj4ggxjfnkh5mhgogtpjbqjcrgvsnnwgm;1:1m4giojh8oh5um5;5:8hcakxfjghiuojauhe;2:3ki;1:ak1fh9sj6;3:2jg;2:jjx;1:jjg;1:8heahfdheeitfjhglehgcjipkj0qkdtj8wh6;1:1hc8j99kqairch6kjyqjxrh5she;3:0jb;1:gky;7:dmxegl;4:1hg8hd9itah8bgxcojgh0hhgjjzqhgrkcwh7;2:cinnkkrka;3:7iqbkyjj8qhcrmmthawhg;1:3mrlk4;1:ajz;2:1iu3h14gm6jo7gy8gg9gtagwbh7dhfehdfgyggwhinij8jjvkhalhcmiqoj5ph4qjhrjrthdukavknwg1;1:hgzjjp;6:dkzegv;2:rj8;2:gky;3:1hcrl1;5:aj7olfphb;7:4kg;3:jj2;2:4hd8gnahebjhcipfk1gk3hjfiikrik;c:diwehh;2:old;2:7n9jlbogppgy;1:1hg4k1dhggglhmqjiv;2:djr;5:2ka8fx9k0ah4bipcledj7ek4filgjbjh1kh8ohepheqhfuhgwh0;1:0lm1g53hc4h47hd9incj3dhggm4hhhijvjh0kknmhfohfph9qh3rh4shgwgz;2:4iu8lqahfbgifh3gkchj9jhhlj8mipwhg;4:5lxrgt;2:njf;1:8ji;1:gku;5:0hd1ha2lp3it4kt6j07h08hg9h0biucimdh8ehcfh8hh7jlfkhdnh9ogyph0qgssiytheugvvkawg7;2:4he6he7it8kh9jgaj7bgjcjhdjqfgokh7lhbohfph7rhcshfujcwgi;8:ak1fh9sj6;1:ajyfjb;3:0ir8hcbjijh8nl2qlqwgv;1:uky;1:9jk;5:4ghin9;1:sj1;1:dhgeh9mjorl8;5:bk7jjrqhh;2:0iudh2ejm;2:lkargj;3:iju;3:fk0;3:bmj;1:1ha2hf3he4he6hg8em9p5agoch4dmqed2gkehhcjh0knilgwnhdohephcqherh4th8uh8wl9;1:gjs;2:1hh8jv9mmaivbkbciqdhgegvfgogizjgzkj0rhauh3wh0;4:6oh7h8qhgwhe;3:0hg9ipak4chcdijejqfj5;8:dh5ejf;5:dkpegr;6:bkachd;4:6l97j68hfgkkqhg;2:3iy8h49hbbhffgwgkehhbiivjjbqherhfspauhawhc;3:3mt8glah9fh8jlolkyuhfwgd;4:oj7;2:3pm6hefksgh3jh8ph5qhewh2;1:lj6;1:8sc9ehegfjhc;b:3kk;i:ditejifim;2:8hg9jg;1:0j31is2jr4jc7hbaj3bh9chdeh8hhhjj9killipoh4pilqh0sh5thewhb;1:njgojdqjp;4:jio;3:8k4;2:8jm9itchfeizfjiuiy;2:djo;2:air;5:bjwtji;2:8jb;5:2ltjha;1:0jl4ik;7:6lbgj3wko;8:0h74js8gh9guahgbkhch9eomfheigtjh7qk0rjqshdwhf;3:wky;1:ghdjgtkh9mjponcplzqhhwhc;1:1j22kq4g78jg9jhajdfh3ghehhdjj8khelhbnlloizpgtqh4uhewgo;3:7mc8jm9gvckvehgqharfh;2:0j53kpjgzwl8;2:him;2:qmksh2;9:1hcajvlh4rmo;1:jhfwlo;4:mlyrgq;5:2im5in;1:bk1gjw;5:sl3;2:cjzjh7;2:jh0wo0;3:5jh;1:0ku1he3ga4ks5hc7kk8eu9lzahdbj4chfdhdehafhehjnjh0khephdqhdrk0thbuhg;4:7jn;2:8j89h9cj2eirfjjjhgqj5;4:hgzrkr;2:4jeolhphc;1:aiofh9qkw;1:fhfgk4;3:1he8h49gtajqeh5fgvgjyjiurjnuo1whe;4:ajabkqhk8kherh3;3:1ku;2:kh9nko;2:8la9nlahfchgegwjh3rjduhc;2:4in;1:gmq;1:mjg;2:akrfgj;2:2j1;5:dkbegf;2:jje;2:1lg2fi3gu4ha5hf6h37s28hg9h7agzbikch2dhdeh8fh7hhfjiwkgqlj1mh7niooiqpg8rh1sjzth6uh8;2:1h82j6cjphk0okzqk0wgv;4:1iu4hf6ljbgqcjnghehkdiinjhaojbph5qhgrgywgy;1:9j6;1:dgpejh;9:8hhck6fk4;1:tin;1:djwehdfkx;5:0k34gpllk;2:1jcrhg;6:cja;2:oinwjs;1:5jh;3:dj1eh8;1:olp;1:2me8j9;2:jhcql0;c:8j59hg;9:5izrll;2:rjb;4:4irgmbjhf;1:0h68jpbmtkh8sjfuiqwhg;1:dinkjlwj2;1:nj0;2:ilt;5:4hehiyuki;2:2j7;1:1k02q06hf7lm8h2jhfohapheqh2wgv;1:bhgfkpkk1mjv;6:ah7ujn;2:bh9khfllf;1:jjfwhd;5:1hf8ha9h1eherk4upg;5:0js4hdcj9dfzek0fh6gn0whf;1:1h3wm3;2:ok1;4:0hf1hd2hg3h64jx5h26hf7hb9jgaj8bl8ch9egzfipggwiiujgikh2lhcmhcohgph9qh7rllthduhewka;2:8jbjheqjq;c:0j42is3j34hc8jzah8dj3eirfj1jh9khanjqoh8phbqharhbshfuhdwha;2:bkachd;2:bk3cjbiisrjk;4:8hg9hgcj8eixngvohepp3;1:jjd;2:ail;2:cm9rgw;1:ahgdjkeh5fh5oh1pmw;2:8h8ahbgozjh9sjv;9:1mdgheohcqhdrh7wn3;1:amdfhcghgpkg;1:jin;2:6gr7hhjj8sjxvm1;2:3l94hg9iucjhdhheh0fhdghhjhdriquk2wjn;1:qkzsgt;1:9iy;1:ql5;1:4l5;3:rhesnywhe;2:hj1tkm;2:ggjiilsjxtjm;6:ohdpk2;6:rks;1:gle;1:4kgihd;7:0ixjiukhcnk8tkuuip;2:4mm;1:5hfagwfkm;4:8iu;1:jharkn;4:0he4gsgkjhgtijwjlisgrwk0;2:njj;1:3hb6np7kk8hdehdjfsqheuh0vnowh0;1:8h7bjvejzgjrwhd;4:rivwl9;1:3hf8jdfhdjktsikwjt;3:rjb;1:1iw2hd3hc4gz5hh6hg7he8gw9gyahbbh5chddh9egtfh5ggvhh8jlgmmpohepgyqj7rgwthbusdwgr;2:0ha8h6ajtbikdimeh8fj6hj5mjnrjw;3:1h4gk9rh1;5:1k9;4:qku;9:dh2elehh6;1:pnnwhd;1:nl2;3:7lq;9:ckveh1fhbgj3;2:kjlojt;2:8kh9o9ahfchcdgojhhwhd;2:dhegomhh7jn2ph8qh5wha;1:4k78lb9gfdgpekdkhc;4:jj2;9:bk6oik;1:jjj;5:2jriiy;4:9iqfj4ljo;4:dis;7:8lp9gzehc;3:blg;2:4kd8gx9juhj3igsuiv;4:0gy1hg3k14hd7he8ha9lsbimdizeivfkdkh0phbqh6thhuio;1:0iw5j5djyeiyfj5jhdwhg;4:ulk;2:qjq;1:nje;2:jl9;1:tlp;5:0im;2:8hgghcjh9kfyntrpjpqhewh8;1:8h39hbakddnyegjfh1;2:2lb3he4hb7hdbhegmbiimjjlph9qjrwh1;3:6grjguvmd;1:0gx3h26f77f9jh0ohcpfdqsvwqs;2:riy;1:bj5dmpejoffs;1:4jo8jd9jzagych9dh8eirfk3gjukhdlknphgqherhfwhc;7:2j19jtak3bgzeirkk0lgmphgsiotiuuhb;3:1hf8l39lwajuegjfhhhhgjgvkimlj3qjirhawhc;1:8gw9jzaixckrehgfh4ghdhlajh9ljcqh8rgqwin;5:rirsiv;2:8gb9lnfj8;2:uj7;1:1j12jn3h84gy5hh6mj7ji8h2bhcch5dgiej5hhejhamhgokeqgrsh5uh6vhd;3:al5oj2;4:8lw9gjujr;1:9keafdfl5gjnjj5;3:ggrlj4qjw;2:0k31hd2hg4jx5lo8ix9gtah5dj7egphfxjk2qhcrjcuh9;5:1l3wgu;1:1j6;1:blj;1:0hc3hc8mw9mqah3bgychgemifhejgzqhfrhfwh1;1:bhbkh6ll4;6:bjd;4:dhhejy;2:0h03ha7k08hf9hhdjiehagm1jkrohfphfqh6rldsh0wgp;2:dj3ejy;4:ijn;1:3kw;3:hj5jhc;2:7goehejkolkxmheoj8pheqhgrghtiluhgwm3;3:1gp2jj3h44h96ji7h09hcahgbhedhdfhbghfhghjjrkhcll0mhdokdphdqknrhgth9uhewl0;5:mjrriv;2:7pq9hehjcjg9qhewhc;5:1hc9hbahabhfch7eilfhfhjsjhbkjmlm0njaqhargxtiv;3:ljr;3:ghgjl6;1:uj0;2:qmz;1:iio;1:2kq9h8fk7hj8;2:ijo;5:lkf;6:ck6;1:fiq;5:jkp;6:1ha2hg3hf4hb6he7hf9h5bplfhdgh7hh4jh5kk2lmlogsph6uhh;1:ohdqlx;1:5iowjn;1:8k79gt;4:ojh;1:0h54k18h49hbahfbktdgoelafhgigqjgzqkbrhbshcwl4;3:jk6;2:mjg;3:2kp3ku4jrrhewhg;4:jj2;1:jjv;1:0jh;6:1l3bhdjjyqj3wjq;1:8jbekd;1:0hg3ha7ls8h7agjbl2ch5glejh6phhqlurhgsh3wh3;3:5k3iinnkv;3:ak6;1:lj0wlf;1:1h93hb4he7hg8jj9mpakqbj8cfvegegishh9jhgkkrlh9minnh2oheph2sh8th9uhbwhc;2:bhgdikwms;1:1h63he5kq8g29h7bknjhekh0mhfrn9sixtheuknwh7;1:hjt;6:0j31is2js4jc7hbaj3bh8chddhgeh9hhgjjakillipoh4pilqh0sh5thewhb;c:4irbjg;7:4h98h7ghahj7inkjixojyph6qivrjkwh7;2:mjrriv;5:3le9iw;1:0h68j49hgbmnkj1sjcuinwhe;2:kip;1:agzdhgfky;1:djqehbfis;2:3ktjh2wlb;3:1he9kyajpbgcfhekkrphdsijtiq;1:ljp;1:1ir2h53kx4h45hg6ha7gs8gt9h6ahebjfdh5fjthhfkh2nhgogbpgzqq0rh7sk8thfuh7wgi;3:nhfolgphf;2:cjr;1:bkachd;3:rja;1:hje;2:2f37piwis;2:8ix9guak8biqfh0gkkkiqlk8niowh5;2:0kd1go6km7iy8h5bjzdjafh5gl0kh9qhdrhb;4:hjh;2:9irjkgwj1;1:0hb1jl3h94gr6jf7h18gr9gvbh5ciqdhbegxfh0ggshizjfvllwnguoiupgsqj8rjfshath6uk2vke;1:2k34jwjh6;4:3jf;3:8h69k0ckvhhdkhgnjfqm0rgt;2:5km8ikjhbphcrk8sk7tjm;1:0ha1hd3jg5hh6hg8gr9h1ao5bitchbeh8giuhhgikmjgqkhbminohdphcqharjguh7wh0;1:0jm2hg3jj4h06hg7he8l39h7ah3bgzchcgk0hhdijdjjlkh8ohfph6qinrj9sgbthhuh8;1:9mbbhcdfqen5ggphhgjl7khgohcpjothhuhcwhb;2:hhdjju;1:8io;2:8hegkfhil;1:jhfqjs;1:1jv8h2aj6kju;1:gjt;1:4goilcnix;1:bh5kkb;4:hjdrhg;2:ql1;1:iiz;1:0iy;2:8hhehghjptm7whe;2:lkh;1:dir;4:nl2;1:tj2;2:0hc1gt3h64hb6he7he8hbck1dm8emnfjxgjejh0kh6ljknhbohcph6rgeth7uj3wgi;2:dj6egwukk;2:9iyokm;9:okiwj2;1:dltehe;1:0h81jo2pm3kz4h96hb7l48hgbhddh8fhdghbhhejgzoh1ph6qgjujrwgz;4:4oj;3:8iqbgzchbel8fjbghfljqrizuit;2:fh7gkm;3:gir;2:8il;1:fimwkt;1:8jp9jrnjsohfrhg;1:jj8;4:fj9;2:njt;3:0lg3iyjhbwll;3:0joqjj;1:djd;2:tj8;6:gip;9:3hhwkj;2:tiowkh;1:5kn8iv9h5bhdcj1eirfjfjinqhbthfujt;4:kip;1:8hf9j5gj4qjp;1:gl2;1:8j09jifjo;3:uiy;3:3ir;2:0h84ha8gyajjeh6fj1hixiiomjgrjntjrwhc;2:fh6gk9jj1siuujz;2:2j98jv9gaeiw;3:cja;1:0l93h78hfbikcioejnfiwghehirmiv;4:3hhwkj;2:lj6;4:bkd;2:0lw5ln6h1diseh4wh7;8:gir;3:dk9egeqjw;c:dheegwjl7;2:klgnh4;1:0hc3he4iz8h09ilahachedkfel2fjugh4jitkj9pheqhcwh1;3:ejcfjpuj8;1:ljy;1:8ju;9:0h51hh2kq5jc8h89h8agudj3ehegh1hojjlgohfph4qizrgithauhfwh3;2:jj2ohdpjxukg;1:ijq;3:djl;3:0l01gq;4:1hg4je9kpahack6fhgghdhgsijrjkqok5phcqhgshcwh7;1:0hd6he8ik9j9agsbjaeh9fj4gh4hmejikkhgohfpjuqharhdsikthbuj0wgo;2:iju;6:diq;7:ljc;1:2l7;1:3nheivjh0wgq;2:7ky8j09gycj0eikfj1jgaqiwwhf;2:amyfgzuj8;2:4gt6hd7h58ji9gfahabkich7dizegnfh9giwhgmiiqjn8khelirmhfohdph1rh6shathduh5wkw;8:0kf8gy9juhjs;2:bk0ckzfhagl4wh5;1:ckcrh0;1:8im;5:4kt9iqah2jj0sj4;3:bh9ckd;2:glcjgzsh6;2:wjg;3:ljr;2:0hg2l64mighcjjbohhphe;9:gn3jgwqkmwhe;3:bjskhenjb;3:8ir9hhfhggjm;9:0gq3kd;4:rgbtlo;1:5jnclyjjcrgvshd;4:3heblsdj3ehdjjcrhh;5:ljp;1:dgufjw;1:wk6;4:5k5tk0;2:8mj;2:hip;5:1k2ahcfhdgjzjgxqkc;3:1hgbiqrll;1:0hc8ikbhdch7eipgpfhk6jh8qhdrhfuhdwh1;5:8kd;5:bj3;1:cis;5:0jl1j04gr9h6dkvej6gj1rhb;2:4ji;3:iil;1:1kg7jajjwqhgwhh;4:3j5;1:9h5ehafj4ujx;7:njq;2:kjn;2:8ha9gjdkqel2;1:gjf;2:8jr;1:jgywkf;4:8iwlke;5:0jn4ggbjmimqjgkwk5;2:qjx;1:ciprke;4:9in;1:0l51gq;7:njkojf;3:cjhdfzek4qja;1:2ha3he6l57jgjhcol0wke;1:biu;1:kjm;1:0hf4iv6hg8isbjcdkrektfiojhdphgqh9rh4wgz;4:rix;1:qku;1:8h59j8bizggrhlx;4:sil;2:jjnuiv;1:1h54he5jw6hf7h3ajgbgpdh8fkrhhfjj5kijlhgnhgoh9ph4tm2wgl;1:ina;2:8itjip;1:8hbul5;3:0hf1j73h94h55hg6h97h98jh9juaj8cgrdhgeh5fgogj2hhajgulj5mhgogvpo6qgzrfwshctkkuhcwj0;1:2j9;b:3krcj7ljw;2:1hgohhpl9;4:1gxhkrrkfsiv;1:8ha9jv;3:gjc;1:9itqjt;1:1hc2h14mhghejhekgrlgynmwohbpl4wh7;1:8jxwlg;1:cja;2:fgmukf;2:0hg4je5it8j2ahfbh9chddhgeh6fhcgk0hiqigsjgpkhbnjmokaqh7rhfthfuh8wjx;1:0l81nj4hbbhffh4gh3iirrheukpwhc;1:8k6aj4bk3ch9dhfelmfhgghfhhejgrliyqjhrhdwh4;1:dk7egi;3:8h29gtgj1hne;3:0hb1kt2s24k76h67khbhcchcdh5fhdgh8hinjgnogyph2qgurgrthhuhawgt;2:4l6dh2ej7jhgtm4;7:0h81ja2j93h95ix6hc7he8it9gpajrciodhfehgfgzijskh0oh0ph4qgprj9ugvwki;3:wla;1:jji;f:4j1;7:nixokfwhc;4:4j6;2:0h51km2hb3h54gs6h77h59gldh6ehaggqjgykjwlkunmqog1pj8qgvrj7siutiowgo;3:1h74jc7h68gn9hbaikbhbdhdegsfkoghcihgjh5kmjlhgmjpnjtpj3qh6rjfshcth9uh0wh7;2:iim;2:hjajikqj6;3:1hbrl3;1:dk0uj1;1:ij1olbphf;1:dlmegc;4:oki;3:tjb;4:1h34he8k59hfahhbgtfimkk6lh7ngcohapog;5:jlplk2rgd;1:ql1;2:cj1;3:djhefqfjqgk9jk8ljosj8whe;c:3lh7hbahabhach8dhgektfixgh5jl7phfqh1rh9thgul3wh6;2:0ls1hg3h64hb6gj7gl8kt9gudh3eklfijgh5jgukh9ohgpknqglwn9;6:0in4k7ihdjh5oh2qm4whh;6:8jq;2:ejh;5:glcjgzsh6;1:oiq;2:wk4;1:0jl1he2io3h14h15kg6he8ir9guah6birchfdhcfhagh5hgijlwkhdoj7rkush4thcuh8wj1;4:1iw3ke4gl6hh7hg8gn9h6aimbivdgoeggfkkgkuhiuikxjgtkh2ph1qh8uiswgx;1:0is1km9h2klhlgh;1:ahgckt;5:0h41h53h75hf6hc7hc9ioah1cj4dgrej9fgihh6iipjiwkh9lh9mimokrpgrqgrrlvsh0ulkwja;2:2ikbhflhewl4;1:1jcwkf;4:8l39g5dgoekkkjt;1:jjstjt;1:eit;1:6mo;3:8ha9k5eha;2:4jk;1:3kb6ob7he8h6gh7jhdqh8tgywll;4:dluegxfhgjl0mjzshgujlwh6;7:pnoqhcwhf;2:hgrjk5;2:8jc9hb;7:1m4gh6lk9nj7ohbqh7rh3wll;2:al1hjo;3:7l6jhb;3:8g59hbagqbjwclpehdfjbgh3jhfkk6lkxphfrgztiyuipwh4;1:4mn;2:2jp5k0birjh5ngwok9wku;1:eis;2:wmv;6:liu;1:ahgdizeh8gk0siv;1:1kdphbqkgrgbwl9;1:4m3;5:njkojf;2:gkajmlphdqhf;6:qkq;1:ukr;7:gj4;2:4iy;1:ukq;5:6hhkhclncohdphdqlqrhgwhg;3:1h92hf3h54j16hc7hc8hhah3bh9ch9fipglwigyjgokhblhenhaohfph8siytmoukuwgj;6:6h38gybirdj3ehejjcumpvkcwha;6:9heahcchfehcfhfgkjkjglk9njoqh8tiw;3:rhftjg;2:0iv8hfahaeilfhbjhgllwwke;2:nil;1:9it;4:kgtmhenh3on3pk4;4:bh3cjt;1:qjv;6:ljc;1:3j25j68hfgh7hh9jh1khhlh7nk0oktpivqhcrk3wj5;2:wjr;1:8jljhc;6:njs;3:7hdgixjhdkgpokypkz;2:bhbkh6ll4;2:nk3;3:7hfal3bjlchggj4jh5ljcsj4;1:lkprg7;6:gle;3:3hg8hb9h4ah8dqjek8fipjh9uhewh9;1:ahcfgsskgukl;1:0g61qd8h59juoh9pk6rgl;1:mja;2:0mj3h88imahdbiudioeixfj3gh6hiujhfqhewhc;4:8h89ikah7djnrimum1;5:2jt;2:pmb;5:0iq;2:7k5;1:gkvhgzjl9;4:8h99jbfikhm3qiwrha;6:hiv;2:4j5;3:jjonktojuwh9;2:0he8h09ljcimdglelxfj5uhgwha;g:ukt;1:ahgbjcdjregpfkllh3qk2rjguhbwhe;8:qo7;3:0jz3he8h2cisghdhh6jh5kjyll5qhfrj0ujqwja;1:gle;1:lmonh2;3:8gn9m3;2:flv;3:1it7iw9jbahfcjpdjdeh3hj5mkoqhergxthewgy;6:tjz;5:gkn;1:cip;2:dkuegm;7:jjx;3:7j1;1:djleh6flc;1:4jtlklrg8;4:1o3dizeh9fh2gk4lh8nh8og4phgsipujr;3:4in;5:8haagpbixhl6jgzkjlmj9qixrgitlk;7:pnnwhd;3:hhfjle;3:akwbft;5:9j6;1:8ir;2:wln;2:9il;4:km5;1:7jnjjm;3:4kd7jf;3:8jc9nhegp;3:agmcmeej4fh9hgijinkhfljvrjmwhc;4:qm4the;2:9ku;1:bjddl0eg9;3:5k9hiv;3:tj4;1:ailfjx;2:1hh8giamjdkxeg7fgsghbhnejh8kh9rhgsjithcwh9;1:rik;2:tjq;2:unevh5;5:0jj8he9juah2ej3fh0ujx;1:ahefhfgk6;1:2jf;1:fjb;3:1kdrhc;2:7jw;8:8jj9jiehcrhduko;1:ohdpk2;1:9jh;1:1kijlsrh1;3:3lg;1:djreh4;1:aitgjd;1:4jw8h5ah4dj9ej8gh2igsphgrjhtjkumrwh2;1:5ky8ilah9hhbjlwrl8sh0wh3;5:5pgfhdjhg;2:4krgj8;4:1ha3ir5it8he9hhahfbhechdfhdgl6jg7khfnjkokbqjmripthguhe;4:8gn9kn;2:rit;1:8irej1fij;1:8kd;1:2jt;3:ajrcgw;4:rji;1:3ix4k35ll8hdagyeilfhcghfijsqherjkuhewh7;2:ilt;1:djc;1:cjn;3:8n69buchgennljgwhh;1:dn5egw;1:1h63he5l88g39h7bkojhakh0mhgrn2siwtheukkwh7;2:ejr;9:1h02jh3ja4it5hd6jt7gu8hc9h6ahabhechadgpfj7ghbhh6jhgkhglikmjuohbphaqh5rk6thcuipvk5whb;3:0j1;1:0jw1io2gj4kx6h87ll8h3chfghcik1jh5khflhfph8qhbrikuhcwgv;2:tk5;1:8ju9jyeha;1:ajl;3:5j28hb9h4ahabhddjgegmfkighbhhbjh7qhgsnnukwwh7;1:8hgbk5djreh5jjbtk2;2:lir;1:1k39itah6fh8gjcjldljargwuhd;3:pln;4:oj2;1:bjc;3:gju;2:gky;1:2k84h6;2:hjw;1:wm8;3:oka;1:1h9olu;4:cjn;1:9io;1:1hf3hg6ld7heajkbh6fj4gk7hjnjhckjilhdmk5oheph9qhdrgxsh4wh5;1:3hg8hcahadjfeh9fjmgl5jh1qh9rhcsjgtkdujtwh3;4:0in1hf4io8iz9jnaipbm6cjodhgegrfh9gitjh5kjzlj3ngtohfphargfuhfwh3;4:wk4;1:1h38h19l2ahgcjehj6rj7tjg;2:ik0;4:4lm;2:9ir;2:fk0gik;1:djc;1:gk8;2:1kd;2:jj5;2:1o72hfgnkrbi;1:4kgihd;5:ejp;6:0ip7h88ilajfbhcfingiriisjh4;7:8jd;1:8gy9kgaljfgggimhjljhfwha;1:ujv;1:rm1;1:cj3;2:fjvgh9ums;2:6h8phdqplwh3;2:8jd;1:tjb;6:0ix1gw4hf8gvbh9fh4gj9lj1nj9piwqh7rmatip;1:ilt;1:6mnch6fjv;6:njkojf;2:cji;1:5izqku;2:iiw;1:1hebjgckqkhgrk5uh6;4:7j4;5:8isfiq;5:djlhl0jhcrgq;3:ajafhbgiurhetjd;1:3h76ky7h08gs9hddjgehbjiklj3qhhsj0ujqvl2wgt;1:3jh;3:dikemofgg;3:jim;3:tjf;1:gk2jjoqhg;5:gky;9:2gdoki;1:dhaekh;1:6hf8hcbl1fhcgk7hj3jh7ojiqlmthfwgs;1:9j5eix;a:0h78k59h3al2blufh5gh4kh6sl2uhfwha;1:8h19h7al7cgbfo9thd;3:qj4;1:qkx;1:bjx;1:nlb;4:8h0agkdh2ej0fh5hhgrmvunb;3:cj2hj3qjnrgvtk3;5:0je8jt9isdhfejijgswj2;8:rhftjg;2:dlf;1:9ilgjisj3;9:8jy9h5djaeh5;4:ok1;1:1im3k38hacjnfhggkphhbjhgljgrhgwkd;2:1gx3h34jr5l97h99g7agtbh1cildh8fh9gh2hhejgakjymkfniroispilqh4shgthfwkb;3:tjz;1:bj5ejtjhfwjd;1:jkaogvpl5;1:0jc1h13k54he5kg7hg8fwajabixch7fh1gjvhhcjgykk4mj1phfqixrh2sh5thguhawgu;5:9j8;1:pln;3:3k0jh7wli;2:dgoel4;3:wok;1:5j87m48hcjh4lk0rgcuk2whe;3:1hgohhpl9;2:9k6;1:8gy9jusij;2:ujv;1:9j8;1:9hgaipcjv;1:8m59et;2:0haahdcjogjwhkljkxohcpjxqhgrhgwhg;1:akebk3fj2;3:7h5mj1qjm;2:ehbrjr;4:jh2qixwo9;1:ak8litok9;3:0h9fjj;2:2kc3ha4gf5iy7hf8gs9h8ah9bhbfkcgjbhhfjgtohfphdqh3rhdsnduiovmbwh1;3:diq;1:5maairfjghitohdril;a:uiq;4:kjj;1:1kmggohmxjhb;1:fj8;5:0ilniw;1:jjd;2:1l02jk3ls5jt6hd7jgagxdheehaggzihejjhkhdoh9ph5qgyrgqthfuhfwhf;1:9iw;3:6ky;2:8jv9h8ehbnptohgphdwgy;1:qjr;1:9hddkkegu;1:7hd9isdipjhckgpnj5okhpkhshguis;4:0hd3h37gm8gl9glaglbhachbdhaehdfhggk0jglkhdohgph8qjzrheszcth6uh9wgu;2:ij1;3:sin;1:0iw1jv2h63mh5h86h57gm8gw9gwbjhdgufh1hgxkgklh7mhapooqiwrg0shfuh5wh9;7:fjeghf;1:1j62jv3h84h46mu7jz8h7ailbhech6dgphhfoiypgxqgysheuh8vhd;2:1hg3he4hg7hb8h69itaplehdfg9ghejj5khaohbphcqh8smguizwh3;1:ahcfh7kgrmojnhdojupjkwhb;6:ahcgmzjhbsjy;7:0hc1hb3j08ha9goaiwcjydh7eh9gh1hlmphfqh7rjesheuh8wj5;1:ujg;1:0he1hb2ip3h64jq6iu7kj8gs9gibkedh2einfgjkgrljrnhhogupilqh8rksuh6wgj;7:4kr;1:0h71hg4hc6n77j78h79hbbipdlrej0ffoggwjgfpheqgvrhftgtuh9wnh;5:1gv5iwaiudgwehefh3hk4jnfrhgthfujhwka;3:1l8nhf;3:gip;6:wl8;1:fhbgj6jkjsjv;3:1iu9iv;3:giz;2:0h84k45prjjdogzpj0qh7rhguh6wh3;2:cjy;1:ik0;1:pln;4:2iw;3:hj1;5:kh1mli;1:0h61hd3h14he6ix7gx8jk9fsbjnch7ek5fk2ghahj1jgxkgzlhemhgoj7phcqh8sjrtl6uivwgq;6:al6;1:ckxeh1;2:8hhhjjij9jjwrk0;5:8k3;4:dj4;1:8io;1:ejg;1:8jv;2:0ilghdqn8rk9wgy;1:8jd9kpahafh5hjxrj2tjlwhb;3:1hfbiprljsim;4:gj1nj3;3:aj2blefhdkkglhgwhg;6:biqqjq;3:4jg;3:2je5jl8h7ghhjhfkhanovojfph2wgq;1:7kvjhg;2:1hh5l68haaknfj9oj2uha;1:3lj;1:fhagmm;2:8h6dmpelarhg;4:2nu7k9jhfoj0wh9;1:df2em3;6:8iz;1:6n4aghcnffgughfjgtphfqhdrjzwh1;2:tj5;a:2jvok4;7:cja;1:aix;5:dj4;1:7iqbkyjj8qhcrmmthawhg;1:ekp;3:7kr;4:gl2;3:6ohwhc;3:cjlfh2glr;1:ajgfhd;2:3he8kt9nlahcchgdhhegwjj0rj9uhawhf;9:4mj;1:0h71h93h44he6is7gz8k09fubjych5ejxfjtgh8hiokgylhgohepheqh7rjnsk6tknuilwgt;1:1hf7h7on3phaqmo;2:hkcjh9mkx;4:8gyljnojiuld;1:8hdbkmcjp;1:8jyal7bjefha;7:9jcakhfh9;3:dhgfkt;1:ait;3:wkw;6:okj;1:wjj;1:qjg;5:jjdqlq;4:3ik;1:khenkg;1:3he9jaaiwcjvgkoqhfrhawhe;2:ijn;1:2ktbhdfhegkoqhhtjl;4:7l6;4:2jdbjddhgfjx;2:djoeh5;2:njf;4:8hdeh1uoo;4:8hd9jzpjb;1:4hfijjmma;1:0jq;1:tj8;6:1n68h5ah1fh9kluwha;1:4ij;4:wiy;7:0hh1hg2im3hc7hf9kvah1bh4chcdjxel7ghbhh3jijkhgmj2phcqh7rituh9wk3;1:rjv;1:rjt;4:0j91h73h44hg5hf6he7gm8ks9jcag5bgxch8dj4ejsfh7gh5hhfjivkjrlhdmm8ogppgrqgzrgetjjuh4wkr;4:2jj5jyfh7jh0kkslhgngxok5qj4whb;3:cis;9:0f23mlhjajhfukf;2:0h94hg5hc8j99n2ah8bgnck3dhgekwgh7hjhjh3khcphcqh6rj8uhdwgy;5:jintim;2:bjxkhgqj8;2:1hbrl3;1:1h43hc9keaksbjhchedhfegkfgzgh9hhbkmuljioh8phcqirrglsj8thfuh9wgu;2:0k94gu;1:1j68gz9klahcdjfehelkl;7:8j9sik;1:3l9;1:1he9h3ahdbkncildk7egwfgxhhejh9kjzrlatiq;1:4he8gh9hcjh6kpnnm5ph0qhcshgwhf;4:gizhjc;4:7hdejfjhekgpnj8oknpko;3:1k5gjkkhf;1:bk6;4:3ktjh2wlb;2:5imijhrio;3:dkbegf;5:0mq3hg4g98iw9h9hiqihdjhaqhgtk4ujfwjl;1:lhgrkv;1:4hb8ks9giagvbhbdjzeizfjbghbhhajlkkhfmjkphfrheshfthduk3wgp;3:0ip;1:0m61hhbhaihfwm6;2:ah8blkcingjhhivjheskswhc;4:0hb1hb2hg4hd9hcahbdj6ejmfjbgh6hhfij7jkskh5lh5ml7nlvoilpgtqharh5uhgwg7;1:ah4dlreh9fhcolo;b:0h71io3jj5kh6gv7k38jj9g1ch9dh5eh1fgwghfhhbjkqkgpmiooj1pj1qg8rhcthfuh1wis;5:ojqplk;1:wk4;2:fit;4:8hb9g8bmxckwehatj4;2:7ji;1:ahbgmqjhbsjxtiq;2:rja;1:qjq;b:eiz;9:al1bivfgymj9rkewhe;4:5io6kv;2:8hdaj7hj0riu;1:dk3;1:jjj;2:ujl;1:9irgio;1:bkachd;1:ak1;3:8ft9mufhdkh8nlwoh9rj2tjhwhc;2:il8;2:jh9sks;2:2jp6hg7k58hcaggdj9eh4fhbghehm0jh6kh5njnojvph1qh8wjy;4:jijpnjwh6;2:1hddjorjh;4:8jibk2;1:9fmahecnjegafjvgk9rj9;1:7lhwhe;3:8kd;2:0jr1hc3n27m78hdehfghfiisjhgpheqgzsinwh0;b:tl6;1:0ks1gv2hd3ja4lb5h56h87hb8h69h7ahbbgwdhdehefhagh1hhdjgfkh1litmponhbogspgwqjath1wjb;3:djc;1:gky;1:8lp9gqaisjkl;1:1h32ha3lq4h05jn6k77ip8kaah8ch5dhgfh1ghgjj2kgwlhemh9nhcoh4pgnqizrgcshctklvjxwg1;1:5hf8gy9kpbmtghhiiljhgrl9wh4;2:1kelizrh3;2:0ke;2:aiq;1:bj0jgvwkb;4:7hf8hcblikh1lk1njwqissizwhe;2:0jymjrom6phe;2:2jd7k5;1:4le;4:tjv;3:8gyulm;1:2jd7hellrnhaphbwla;6:dik;2:2gq7jk;3:jmp;1:hherjv;2:niv;3:0h98h3bk8kgvllw;2:akrfgj;1:5mj;1:3mk8kv9h9;3:1h53la8h8bjmkkxqk2sh7whe;1:8gyojmulh;1:hkrrh4;2:ghgsir;1:9j7;2:gknjkn;1:fmu;4:2io;5:8f49pgdin;1:wjg;4:0la3h68hebijcioejpfixghahiqwil;1:4he8h1bhdklnpmd;5:9h9amebjhfgw;4:1k6kgd;4:9j8;2:3hc5hf6ji7hb8grah6bh4cj8dgwfhcggshppjk1piushgthdwgm;3:9isblfeh1fhc;2:8gabmefjq;2:pmkwh4;1:jjp;4:8jnjjk;1:nh9pk1;2:8iw;5:fh3glz;1:rks;2:djkjk1;2:uik;3:qjc;1:bk6;1:0nrphd;4:9jc;1:9k2;1:4j5;1:fkggjnwk5;3:ql1;1:jm8;2:kin;1:ahbsjb;6:4lsjhf;1:5j0;3:7haongphe;2:8is;4:0hf8fp9orchedjseg8fhfghfjhdkh4nl8ol6ph7rjkuhfwh1;6:aldehefhgghbjjpohdphfrh0sn7uimwhc;5:mhftkv;2:3mrqj2;3:jjc;2:ahghirujw;1:0jf8hb9ghelx;4:0h52hc3hd4lq8hfghdiptjhduhe;6:0hb1hb3hd8l49mlajzbmpcfudhgegcfgzgh8hhbjh6km8lh9ngyohfph8qj6rhfthcuhcwgu;4:jgyqki;2:uiy;1:ahafjz;1:hjsnio;2:fj8;2:9io;9:0h92hg3hgiql;3:8jo9p9akgchbdhbeh7jhgrhfwha;4:9hhbk1cjaiirjh8rjiwj5;3:ul1;3:bj2jk8;2:olkphd;3:8gb9kjaik;2:ljp;4:9k2;1:5ip;4:2mi3jf4hh6hd7hdjhgqklwh6;2:oj8;1:djqejv;3:ollpln;2:ojf;2:2hc3h96jw7hcaguciwegwfgcgqchgvjiskj1mh1ninogrrgsshfth8uh6wiv;2:ulj;4:ahcgmzjhbsjy;1:0hf4it8iw9gabjgdksel4finjhckhgohgpheqh8rh3wgy;3:mjt;1:dlf;2:ojt;2:1jubh3citflnkhdljbqhgwhg;1:0h63h24hg6j47gx8j89fqairbjxchfekcghdhj8jgykheohgqhbsk0tlkuj3wgu;4:2gq3is4h85h96ha8iw9gsagpbn0dh2eh1fgugh9hjajhdlh4mkfnhfohbph1qjmshetk2vjywgk;1:0hg1h02js3h24ka6he7ji8g69h0agabkzcijdiveh1firjgqkh0lmsnh0oh1pgyqh0sjpthbuguwiu;2:8is;1:5kiiiu;1:0nuphd;4:8k19h4;2:dinjnt;1:9k3;3:6nycivhiujhhwha;1:tjq;4:hj3;4:wlp;4:8ju9jxdj5egd;1:rje;1:wl3;1:0jkdh0ejkiix;3:fh3gng;3:jjc;2:hj1;1:2mg;5:2he4hfgjrjmrogjpmpqgywgz;2:nil;1:8h99l0ajicj5;5:8hfhjiij8jjvrjz;a:1mtrgy;3:5ll8gj9je;3:8gvwm4;1:8go9ftah4bhgch2dl1eqjfktgh2jhgrhf;4:liu;3:pkm;1:il5;1:8jdlh8qj7rjw;3:7kvjhg;3:fhhgjn;2:ah2sj4uji;f:akcgj7rhe;4:8l89gvah5nix;3:8he9ja;1:4kh;7:gis;1:ujz;1:hhdjju;6:8j1nil;1:0kd9heek5;3:agzdirfkm;6:sj6;1:hguqjl;2:ll2;1:rlq;6:pju;2:uje;1:8iobhgchaelcfjfghhjhhqjfuiu;2:qjx;3:4j5;3:dj9;2:jjc;1:tjl;3:1ir8l2eka;3:0hf1gt2j33j74h95hh6m47gu9ipah6bhddiregwfh3ghahhejg7khdmhfojmph3qjtrh1tjpuitwk4;3:7mb8ipehejhfmmnqh8rh7tikuh2whc;1:0hf1h43ks8h4bjcggfhl1jhbkkpqjksh6wji;2:bkachd;4:iis;3:aj4bjoch4fhggkerfvtmeuhf;1:1k3dizrh2;2:pju;6:bjgrg7tmo;1:tjz;1:ujg;3:4kwah7lj4rim;1:hhgjjq;3:6k2;1:jjr;2:hij;2:6h8gl3hkttit;4:3hd5hg6hg7n48fp9n3aimdhdehdfhagh3jjokhalhbphbqisrj8th7uh5;2:fhegkn;1:ditejifim;2:qk8;2:uj4;7:4k7hgtjlmokqpheshd;1:3n4agiclyfh2jgzrjrwh4;1:jgupl6;2:3hgjj4nkspm6qhewjc;3:8mrbgn;4:fil;2:updwh8;2:dkpegopm4;f:hjh;1:diuejl;2:fhhgjn;1:6mwehggjijhgljbwiy;5:jjc;3:2gdoki;1:ljc;2:4jk;7:1h13h54j05kk6hg7hg8gw9l6bh7cjbdhgeh8khbokepgvqh3sjttheuiowgu;1:7h48jgbhhmj0qjk;4:sis;1:ah7ujn;2:gkb;1:aiv;3:1hg8ilaisbhgfjjhhejjokiolldnhcqhfwhb;1:dk6egq;2:8gu9jj;5:lh9rk2;1:rj8;1:5kbhiv;1:dj0;1:fir;3:ejj;1:qkx;1:up9wh8;2:6kwwhb;1:bhdck3khhlhbrgxsivtixwkz;5:ditejifim;4:8gf9l8;1:3hc8lu9h6dg9enk;4:ajfbhbfjhkk0;1:7j4hl7;1:6hciinukj;1:8jdpmd;3:pnnwha;6:4kmigs;1:7j7njr;2:qmz;1:5ismiowkg;2:dklegk;2:9h8cizrk3;2:cjntjx;a:7ka;4:jji;1:7hhdh4eglfhcgilhhhjstqh9wip;1:cjjdfyekb;1:ej5;3:8k19h4;1:3lw8hgdhdjh9qjbwjq;d:jgyqki;3:0h61kw2sc4md5hd6h57kk8hh9hhah3bhbchcdh4fhegh5hhdjgpmhhogxph0qgtrgquh8wgs;1:2g97kcajg;1:ahgrju;1:9iydj0eju;2:hj6;1:8k5ehgjjjkju;1:hgujll;2:1gz9hgbp0dizehbfhfjhfkglmhcnlmph8rk7uhewhd;2:hj3;1:dhdeje;1:0j41gt2hb3h84is5iz6gt7h08jr9hgch2dh3fgpgguhh7kj7mjdok2pj3tjtuiywg7;5:0hd9h7bivckzehefjyghdhj8jk7rhf;5:8hejlj;1:9h6ekn;3:7lu8gzhhgjikljuqhhrhgsjxujqwhg;1:1h73ha4h86ha7hc8jv9m3ajlchbdhfeggfhdhgxjgikh7lj9nhdokeph3qkyrhbshgtjquj2wgx;2:9hdeju;1:7lvwhf;2:1hb2iy3ha5j47iw8h29hgck2fhdhh9jh1kh3lhcnn2oiypkvqirrh6thewge;1:fjg;2:qjg;5:ejr;2:mj3;6:him;2:8gf9lralqfgfggnqjjwhc;4:jjo;1:cis;1:8mrbgn;2:4jcbh9cn1liz;8:6jm8h6cj8diwegzghghk6jghlh9ojfphhristkwwip;7:iip;3:cjn;8:fj5;3:rir;1:gjf;1:bizejurk9;1:3ip6ix7jh8hfaj8bh7ghcjhbmktnhgph8rh8thewkr;2:qjq;1:km9;1:9h2aiyfh3gktkjo;3:fl0;1:0l31gqdin;3:dp4eg9;b:1gk8hcklhrhatjf;1:8kdaglfk2ukj;4:8h6glf;2:aipjjv;g:ahgrju;2:1iv3k8jn0ohfqh9rhgwgp;1:0im1in2ha3gz4ja5mj6in7ja8gqah0ghchj6jgbkh9lhgmhgnhcohcph5qivrgntlcuh2wh1;5:5jatk3;7:dk3;2:1kjij7kh4;3:sj2;1:jjp;8:dh1ejp;2:3hg8hg9gwanhbiochffg4jlnqhdrizsj4wha;2:1gv3hh5iv8hfbhgdgvehcghghjyjnaqhfrhetjrujcwk6;5:4j9cmvhgsnjhqj5;2:lj5;3:rir;4:8g29m4;2:1h54hg7fubgocl0dhggh9jk4khcllamhgnhcomypk9qh9rikwgr;3:ciw;2:kiv;6:jharkl;1:nk4;2:7l7djdwh6;2:5kkrh2;4:8hddlceh9uix;1:7kvjhg;3:7k6;3:dis;2:jjlsiu;1:ljamj8;1:dg4ek0;2:4ik8ng9jnamkch6dhefgcjhbkhbwh5;3:fj9;1:hjf;2:fja;2:7ip;7:wm8;6:7haongphe;2:khbmku;3:rir;2:dk4;2:6k5agwbgxfkdgkckh7thewkd;3:8hg9jg;1:8iofinjji;2:6fvwmb;3:5ik;4:6la7h5qj3uh2vljwh8;2:qjr;3:7k48jbphgwle;3:1iobj0;6:iik;2:ciu;1:1he3he8h7ajwehgflaghbkh5lhbnkooirplzqh8uh4wh9;2:6jv;9:1mi;2:mkj;7:lk7;2:gir;1:fjeghf;1:dfyekejjf;2:khgoo4ph1;4:tjk;3:aix;3:8h1chadj2ektrm7;3:gip;7:8k5;2:8jbekd;1:8h5bledhdeiyjk1ohcqh5sls;1:8jh;8:fik;2:djpegluik;4:qkx;4:bljgj1;2:5k2dh8jm8ohapjnwh9;2:0it8ikokv;2:civ;3:kh1moa;3:8jbekd;3:wjs;1:0lr3ir6ha7ha9gtajaeh8fixgl1iktjgpkh8ohaph2qheuhawgr;4:8izhjiij8jjvrjy;2:4mliirohepltwha;2:jjv;8:8j6;3:hgbjk7;2:2ky3lk4l1jh1ohgqgywhg;2:ajl;a:0hf1h63h84he6hf8in9jsbjicgydl4elgfjgggvjhdkjnlhfnhgoj5ph7rh3shhthcwgw;3:agzdhgfky;7:dkpegr;1:tjz;1:0hd1gu2jw3ju4kq6m37h88h29iragpbh3ch5dgtfgkgjghgqjj6khdlhcmhenjhogvpgsqgvrh6sk2uk0wgg;3:8heajdfh8khgokxqilrhgsimulbwh9;2:rm1;1:8ix9k1ajobk6cj3egufhbghgkk2nhgwh9;2:ojf;2:1ij2he3hb4h16hg8gd9iwah0bh6ch9dj9egefgqggxhirjkpkhglhamluoheph2qh5tijuqgwgs;1:9ilbji;1:6hg8gt9hbakbbldeh4fgfhntjinkhcohgphbqhcrfvtknujbwgo;3:8jk9h2;3:3iw;6:1hf4jzdhfgghhm9jkmwhb;2:fkeril;1:6gjuh5vmp;1:ijjrip;9:1jcrhg;3:pkd;3:5mv8h4gkqjhd;2:ggjsk2;1:0kjiim;2:jhgpm2wlp;1:rj1;2:0hg1hg3jm8j49itaj9cildhceimgh7hhbjgophgqitrl9uhfwgr;2:gjn;9:0k31iq3jt4l16hg7gp8gychbghcik2jgvkh7lhdnhgojbpgwqheriluh9win;1:0j31h32he3h54h85hf6he7gp8kf9j4ag4bgmciudixejkfh2gh0hhdjilkjdlh0mlqognpgsqgzrgftjbuh4wm9;5:8h8jnzqh5;1:ukc;2:0j13jk;1:4kbjjl;1:1gx3o7;1:8jmgl9;1:kgvmp5nhgogtpgv;3:7iu8k4ekf;1:0k4mjxoit;4:0ir9graiwbkhdiwekbghejh7uk1whf;1:2gn3ol;1:kj1;5:bj0sjg;2:9ku;1:1h99habkqciqfjbhhhjh8kh1lgzngroh9pgyqhgrlsslktjiugpwhh;1:8jbekd;5:4iycn7;1:4kf;1:1jw5hb6h97h38h19gpajobivcjjdh9egyfjyjhdkj9lhbmjxqgwrim;3:4lekhglk1rhc;1:glb;2:9jy;1:5kbhiv;1:hilwka;1:ehgfjt;4:giunjr;2:ukt;1:1ilrit;1:2io;2:gku;4:8j1cj1;1:jlr;1:cj3;4:bhgfkpkk1mjv;3:akwbft;1:7ka;1:1iqgh7jmzljophfqha;4:8jpjhc;4:9ircixikg;2:1hhrkpuh9;2:gjalhdnn7ohfph8;1:8m29gkeilohawjr;3:pmb;2:ejkfh8;2:djnegkhjf;6:7ly;4:1hbbk9gjbrkl;3:9irgio;2:djlgjd;3:njs;4:cjydjtfhdsipuiv;2:2jt;1:0j9;4:8gx9j2glb;4:0gn1kc;3:0hg1gt2he3gw4h05hg6h77hc8fm9itaipbgscmbdh6fg4gh4hgeiijjndkgrmhdnj3ph5qkcrjvthbugswk7;4:8l19gu;5:8h6ahdukz;c:6mo;7:qlg;2:1h98fy9leak5bh9fhgjj9oh8pkhsiqtiuuha;1:jl7oh6pjq;9:2jf;4:cka;3:0kh2h94ks8iqditwhg;5:5lxrgt;1:qjx;4:qjq;6:2it;3:qnf;1:1k9;2:4goilg;2:5lm;3:gisjheumi;9:2j1;3:2l8;8:bj0;6:rin;5:8h6ahcbh5chffh4gh3hs8jkmrgswh6;7:3ks;1:iip;2:hiz;1:8ip;5:mjrriv;3:8lebhgrim;1:2j9;2:bh9khfllf;4:bhgfkpkk1mjv;1:ohdqlx;6:kgwllznj7;3:giwsjw;5:bj8;5:hjirgp;1:9j4;4:olp;4:1hd2hb3hf4jx7iwchhfhdghfjhckhaoluphaqharh7uhewnz;3:cj3;2:fj1;5:1jn3h94hb5he7h58h39goak0bilcizdh8eh4fjxhipjh5kjflj2mjunheqgzrj4uh6;1:rj2;3:ajb;2:dgiek5;1:ghbumn;1:jjj;2:8it;2:diq;6:0hf7hf8h6bitggjhgtjlgllaohgpheqmzthh;2:9h4ekp;1:8hbakvfjegimhiroj8uhe;7:7h5qjo;2:9j7;3:9hhej8;2:8jp9gydj3eh3khfol5pm7wh7;1:8ir;1:njf;1:ejg;2:rjt;2:0m5;1:ajf;2:qjq;1:6h07mkjh2qk2whf;1:1h92ka3ke4jechfdgyej3fjwjh8mkurh4uhgwhc;2:2m83or4he6hd7hgjhcphgqhgwh6;5:dipgiw;2:3l7pjo;4:3l9;2:jl7;2:3iu;1:1he2kl3hf4ik7k58h59heahcbm1fh7gj1hhgjh7khelj7phbqharhewjs;4:8hdgkm;1:9hfahefjqjhfmk6wlc;9:3k4jh7ohfpl7wjl;1:8jilh9rjx;1:4kp6hf8h2jilonn;2:9iu;7:8hbcjneh8hj5rj8tlqwhc;3:1gt2hg3h34iz5il6h67jd8feahhbh9ciodh2eh8fgugh4hh5iijjjwkh9lh7mknnkcokgpgqqgxsj7th6ul6wgf;6:cjn;2:0hg9ipak4chcdijejqfj5;2:bjd;3:jgyqki;8:fj0;2:fix;1:8jbekd;1:9ipuk6;1:nkmqky;2:5k18jf;3:km5;5:9mkcgwrhe;2:0hb1hd3gs4h55l36gl7hf8or9hhahgbh7ch5dgveimfhegh5hgkjkzkh4mhdnhboh7pgsqkgrgssh9tn1wgu;1:jlr;4:gle;6:1h3wn9;2:wki;3:6lm7heajyfgpgknhjylhdmijphcqk2rh4sh5whc;7:akrfgj;1:qkx;3:0jdrjx;1:sja;8:akqsgn;2:bhffh9gmpjgtqlkthg;5:0j5;1:8k9ogqpl8;2:gl5jijljtsgrwhh;2:2gdoki;2:1kk3hd8kg9n3ah9chddhfegwjj0kherj2uh8whb;1:olkwh7;1:0j61mo2j43je4ip6h87h58hcah2biych9ehefh3gh0jinkgelh7mh6ngpokcqhfrjqwgb;2:diw;2:6nbgjtwhc;2:4metktwhh;1:iiwkjw;1:8ke9h4ehf;3:8k29h0ajvukh;4:9j6;6:9jj;1:5mh;1:0hb3hb7k2gm8jkwohgphfqh8rlhsh0wgp;3:4je8hc9kj;3:khgnlbpn2;1:8ir;4:eiyjl4pjarhe;2:lhdrj4;2:gky;6:gj7;1:2jx3ha4gy6k17mk8gw9g6ah8bn3ckkeh1fh6gguhhgjh0kgulhdoh0pjfrizuhbwgr;4:4hf5iy8gubhbcheeh4hizij5jh3nhfolhphdqhfrhdtpiwgz;2:an5fg9jj7sj0;8:8gp9kpao8fggghejjmrjasgt;2:3l2jjwrj1;1:4la8h59kckhgljzqhgrh8;5:8iz9jffjl;1:4hfuke;1:kh7nkn;1:djp;2:0m61hhbhaihfwm6;1:djn;1:3jh;5:dh8ela;1:0khgjj;5:6nz7hhbj2djpehdwh6;1:nmephg;2:pmh;1:fl0;2:8hbhltljz;4:8hdah8bizfh8jgxlliniwwlp;3:0j9;2:2j98hceizokd;4:rjw;2:cjc;2:0ha1ln2gq3h54h45he6hc7h88h99gzagxbg8ch4dhffh4gh2hh8knbmlanmgpjkqh4rh3sjuth9uhgwgk;6:8hfcj6dkkeghhh7jjarj7uk6;2:0hb1h22hb5he6ha7ha8hf9gtaitbj8cl0ehgfg6gilhh3jiklismhcoglpiqrh6sh9tk2uh3wo3;6:ek3;2:8k4;7:1ju9iuah0dh6ejbfjughhhj7liywhb;3:iil;5:8k49gpel6;3:givik8;5:jj5mmgrkb;2:1is;2:pk0;4:2in;2:ckdsjh;3:rjz;2:ck6;1:2kj5imhjijhcwju;1:8gn9h6akiehbfj8oj1qh9toluh7;b:ghgrmawkk;1:dhaekf;1:njs;3:8gvbh5ckjdgven4fj6ghejhdlk4njcrhcthfwhc;1:0hc1hd3he4hf8gkagzbh7chddizfo5gjwhjejh0nheohgpheqjxrh0shethcujq;2:hiljjp;6:8jc;6:siw;1:sjb;1:rks;2:jkz;3:sj5;2:jh0qkz;3:ehgfjt;4:3ha7jyehggjbjjwohfphgqhdrlc;2:cgvrk4;8:fju;6:9h4civehhohhpl6rkq;1:jjt;3:rjz;2:1iu2nl3m74la6h37hejh6oh0phbqgywgy;1:fj1;2:0gp1h53o14h98h79hciqijhcqhfwh6;1:jl5wh3;2:6h58h0dj8ehejhbun6vkjwhc;4:wik;1:ciyhiykhbnlb;7:1hf2hf4j8khfomfphfqherhawn0;4:8j29h8cixeinfjchj3jheqk2rhb;1:1jb;2:0nl4g7ihcwk5;2:0hc1h73hb6hb9ivah1egrfj9gh0hl5khalhbphcqh6ritth4uot;1:3he4hg7hh8ip9j5bjichgdjfeiwfiogj5hhfjjcphgqherhfujtwgw;5:gky;1:djfeh4fl6gkg;2:wkt;1:ch9fk1;1:2im9jx;1:8jqeke;2:8jhajfgj8hhgjj9qhbrjbuk0whd;2:0hb3ha8kn9lxaiyekwfhbghchj8jgqkh4qhathh;1:pkd;3:0hd1h62he3h94h86hc7gv9h6bm0fhggh9hh5jgzkk5lmlogaph2qmjuhg;2:lj4wjs;3:3hf8k69mnajuchfeghfhfghghh7jgokhdnk9qj9tk2whc;5:ik0;2:8isfiq;4:0h6ah6fle;5:wlb;5:qkw;4:3ha6k78grcilgg1ql1tmmwj2;4:2j56h68h8uk6vkkwkb;2:wks;2:3hf6gp8jp9mzaj8bheckcdheegofhchipjglkhfphgqh3riyugsvk9wh1;3:jh9sks;2:7j9;1:eiplm3;4:bh7kkf;2:8h99j8ajhciudgoej4jj4nkfrhc;2:8gzkltlgh;1:9iv;1:9hbjkw;3:4ij;2:0h61hc3j44hg7h98h59hgajadiqegxfiughghm1jgamjuqh8rjathcuiswjp;1:ijc;5:1h4gnprh3;4:eil;8:8jcahbul0;1:ahfchdhnbjkhwh8;4:9jodioej5;8:tjw;7:sj8;1:1h52h94o0;3:ajxfiymkrniuqiz;2:0h82hf3h36hc7hf8izbjndjofiqgilhhdkj0ljfmhgnhdohdph4rjgsiqth7wgg;4:ciy;2:fj1;5:8hajl6niysj3uhe;2:bj6;2:siw;2:jjk;5:gn3jgwqkmwhe;2:mln;4:olkwh7;2:ciw;7:1gx3nicj9jhcwjd;1:rir;1:8j69hb;3:9ix;3:0h41l8;2:lkargj;3:4l9dh8jkuqheuio;4:0is5iz8j9dhgejqrh5;2:8hbul5;2:5km8ikjhbphcrk8sk7tjm;7:2j85im8haeix;3:alkfgz;3:him;4:0ji1jl2gj4kf6k77lk8h1chcgh8ijrkhdlhdohdph1qgwthguh9wge;1:nj1;2:wkw;2:bm4chahja;1:tk1;5:rjr;7:jhdqjr;1:2mh7kddirjhcoh8qjhwhc;4:6ngpn8qh0wgv;2:8hgbli;2:ilt;3:7hf9hfjlbwlj;1:3kg8kh9gb;1:1hd3hc7hh8j49kyblecjhdk9egwfh3ghdjgwkjmlk4ngsoheph4qhbrheuhawgz;7:0n01hf4h68hegl5il3jh6qhewha;3:9ikehfnmcojipji;g:ciw;1:ojxwhf;1:0hg3lg4hg6hf8h09h4cjddgeegqfrlhhejh8kgsphdqktsgyuhbwh3;1:bjc;1:5ikwkt;6:hip;1:3hgah8cg2dh6ej9ghejhakixllxrp5wha;3:hkrrh4;4:8l5bhfhiy;2:jjj;3:siw;5:ajn;2:ahbsmu;1:8iq;3:tjb;2:akq;4:bjzrko;2:0ki;2:ujv;1:0ly;1:hkk;1:wki;5:1k94k68jw9h4dj0egzjj7;1:ch9fk1;4:0hf4lhpknwhe;6:5kifhdjh3phark4sk4tjkuk2whf;2:jjt;7:bhdcmu;1:8kf9gcqj2;2:ok8;2:1k5gjkkhf;4:2he4hfgjrjmrogjpmpqgywgz;2:rk8;5:flj;6:5iy6gl7h48h99hedhdghbhhgjmrqlesjvvl8wgq;3:0j13jk;5:djd;3:jje;3:2jh;1:biu;2:dixeh6jhhojxqllwh6;3:1m8oj1;1:9lgahgcko;4:qji;1:3hb9j3cjldhgfhggkajhcngtohapnvqh9rh8wh7;a:ck7fk5;5:gk5;2:bhackcdhheh1ffngnahh6phdqh4rh7soatheuh5;2:riu;4:9ik;4:8gyulm;7:ajmcj3nkm;1:jjq;2:rin;1:0hb7k88h89hfakybl0dgxeh4fjbhj6jh9khcrjvwgv;1:0hh1gq2jn3js4iz7hf9kpaglbhaclhdhcehgfhchilij9jh0khelhdph9qh7rjatj2uhbwh8;2:8jq9kbdhgeisfh7;2:0fj1j52jg3l44iv5h86l27j48fd9h4agtcipdh6egufgqgfljfvkitlgynh7pgcqizrgjsh9tlzumywiu;1:jjc;8:1hf4jzdhfgghhm9jkmwhb;3:wlb;2:0kw1n83la4iu6h97hb8gfah0bkfchcdhdehefhbgh3hhdiisjgskgklh1mhdngrolcpgvrh1thauh7wgm;4:sj2;1:bjh;3:lje;2:nke;3:fh0pli;1:5kidimfhggh7jh9ph9qj0rk2sk3tjjwhe;9:0hh1ij2gt3gz4lv6he8gu9hcaixbhfchddiueh1ggxhhdjgwkhalkfmlknggogqpo0qh9uiswgl;1:9iv;1:8j09flchgdo3jkwwh6;6:gj2;d:0h92hg3kq4ha7h38kfdhgehffh7gh4hhfjj9kjjlhenh8ojfpiuqjirhdsketh7uhdwh4;2:jiz;5:gku;3:9ipuk9;2:6m2jjhwhg;2:3leojx;1:cixhhgjjo;3:tj5;3:ajwgj8;1:ph4qnl;5:qmksh2;1:8l1jh3sjf;1:8jd;2:ojx;7:8iu;2:gjv;2:fjs;1:nlb;1:1gy8h49liakybhcfh9jh5khfmijrk4wiv;1:2kw4lo7kf8h7jhcoheqhg;2:fhbgjspm4;3:8il;2:ak2fj0mkvqj1;8:7nydimjgrwhh;1:tio;2:4lihkkjiwriu;1:dj9;1:2lkhjajldphcqhergq;7:gjujjurk9;3:1h69ipagybhcdh4ej3fjpghfhj6ml0thbwjs;2:0he4ir9h1ggxhj8nj3oj2ph7qijwhe;d:aip;1:8gwkl0lm0;3:mkb;1:diq;1:8isfgvngsohcpqd;2:hjm;1:0h51ha3is8ja9j6chhdjiejgjhckhdphd;2:4in5iv6j87jybhgjhcohfphhqimrhewlg;1:aj6jkn;2:8h9jm6;1:2ir5l8fhbgjbwlb;5:2imjjo;4:3j8jhfwmk;2:1kg7jajjwqhgwhh;1:uj5;6:tin;5:9irgio;1:dkpegr;1:4oschdmj8;5:cjj;3:ajvciqhlejh9mk1rhhshawhe;7:bh2ciskkopjrrhhujd;3:8j4ah9bk8ch6egzfh2ggfjh6kkjlk0njeoh9pgzqistiowla;3:hjy;2:8ir;1:1jp9l9aheckjij7kgw;2:1j14li;3:aj5;2:ljp;5:jjy;6:plzqiswko;1:4hfuke;1:7j9;2:8fx9kx;2:0hg6pl7hbqhdwhg;4:3h87ll;3:0gy1gz2ir3js4hf6hd7hc9jhaj2bitdh3eh8fjohirjh0kilmj4nhhohgphcshftheujtwgs;6:bjj;5:jhgwl3;6:4k27hegimhipjhckhfll7pgyqmdwh9;1:sju;1:sj8;1:2mn3jlwhg;2:0m56h9;5:8m89ez;2:5m98h2bhbgk5jh9llkphdqhhwjn;1:wld;2:jjx;5:ait;2:0lc3h78hgbilciqejrfiyghehis;2:cjr;6:1jm8k29gralxbgnffwgj1iirjhhnikrhgwjd;2:0gx5j28gp9h2dsfjhawhb;2:djxeha;2:2kvbk8whh;a:0mh3h58imahcbiudineiufjjgh5hiujhfqhdwhb;1:fhegkn;1:ejfhiyjhf;1:1lk2gf;1:3jvahafh1gk0;1:cjswkm;2:2ja8hdej0;9:uiq;2:jjc;1:1l37hgqka;4:ij2;1:ail;1:8jt9h5bh3chdfgjgkbhh5jhbkjellqnj5phgqh6tik;2:ajj;9:5jk8jcjhfkhetoguhg;1:3je9irahedl3egvghguinwk2;3:wj9;2:1hf8habj6clohhgjivsjm;6:jkb;1:1o33ha7hf8giaglbh4fh1gllhhdjh6kn1lheohcqhcrgquhgwj7;1:8jz9j6fiuhk1;1:6h8siyuhcvkz;1:1h38hcklh;1:sja;1:cjg;1:fjmkgwlh9ngapp5;5:bkk;1:1h72hg6ha7hb9h7ahfcjoghfjjzkhbnjdoo0pgyqh4rgpsilwk2;6:1k42jubiykjkqizrgy;6:aix;1:8h29gthns;2:hj6;2:8j09k2ajpbk9cj5egvfhckk4nhgwh9;3:0hg5ke6np7h48heghgjgwogypjkqh1rhcugovm0wjc;3:8in;1:3lg;1:5in8gdbisdm9ekpfjqkhgph8qh6rhasj8thduh5wh1;2:9hbdmaqj2;1:8h1chadj2ektrm7;3:8k7dhgeirij7rjp;1:cja;1:8j6;1:aj9;3:bjb;1:0lu4hc;e:ahehkk;1:6gx8jxbh3dipej0fkkgh7hh8ums;5:9h5ujy;2:0hg4kr7heamifgzsiouj1;1:7k88gt9hdbg7clvdgvemxfj4lhgqj0rhbthe;1:uiq;2:8j1aj7fjj;6:bitjgmmmuuh4wjw;3:0jp1gt2hf3hc4gw5jj6hg7h69glboecgndl7egjfgtgj1hj8ih7jilkgrmhbnh1ojrpguqk3rgtsgath6ugnwj8;1:8n89k7dhgegaikljhe;1:0k53kf8hb9h8djnegbjhgkikul6wh9;2:ngkolx;4:3j75j9gh9hhgjh1nk5okzpiyqhewjb;7:0q01hc2hg3h04g97hgdjkfijgh3hj6jh1phcqh6thfuhe;8:hhgjjq;2:jjx;5:3k86hg7mpphbqhf;2:1hc3he8gw9grah2bmlflqggxhhbjh7kjipheqhhrkpwiy;2:ohdpk2;2:0inbis;3:8hdghehjbij0jjenkpojjphaqhgrjpwhb;3:5jhrhgsl0;4:1j2lk0;1:2io3iy7ha8h69gydmzejffhdggvjh1kh6lj2njmoj7ph7rgruhcwh2;2:3hd4hf5nd6gybh3chfdl9fgwgh9hgpjj0pheqj4ukcwh2;4:7jd;1:hlb;3:4hbolswly;3:1hc5hg8gu9haammbh9citdgvfmyjh3kh6oimpiwqiwrh8uh5wh4;3:5lxrgt;3:ahefkn;2:fiqjgywkc;2:jk3;1:dlf;1:tk8;1:1hgmlnrgrwkr;2:gj7wl1;1:1kh;5:jkb;1:5hgbkidk0egirjs;1:ggaqll;3:5jj8ja9hgdjeehdjhckhfqhgrhctoduhg;2:1j96hg7kdaiubhddimfjhhiwjhakhglirmioohhqh8rhgthfwgj;5:7lf8injkvrjjwh8;1:0jjwk1;6:bjh;3:3jx8hghjpjh6sj8wjj;1:wk8;3:qj7shg;1:uiq;1:wje;2:to6;1:am2biufhe;2:tj4;3:8iubk8;1:sis;2:1h4jlfqhgrliwh6;2:5iodh9hk2jm1whb;5:2h74o0jk8whc;3:0j3dj1ej7fj9;1:nl0rio;2:4mm;3:jharkn;4:3j7hiujhewmf;4:8nn9ggaheeh6fjwil3;3:3kw;3:gk8;2:dmteh5;6:eiw;2:4lm;5:1ja2h13hd4ntoha;3:5iq;2:1hbajpbj3jh3rlkskd;2:2hf3gy4hf5hh6hd8hg9iyajybjydheeh2ffggl3hhhjpgohfpheqgwrh8thgugvwkg;2:7kjjh9;1:khgoo0ph1tj6;5:7kjjh9;3:olkphd;4:agnhm6;3:4ksajhfh9gjw;3:jgypld;1:jje;8:djc;4:1kf2hg3h94ha5hb6ha7h28h39gdak5bj6cjwdh8egrfkjhiljh7kjllhbmk8nhbqgwrivuh4;7:dh5ek2;3:9jv;2:8f09o5;3:cl8rg0;2:agpbjzghgljfqixwkp;4:2kz;7:6oa7hgdjtehewh7;2:1hdahfgj2kke;2:8j6;1:2mq4g7jh9;4:0jg;1:bkd;8:8im9h6aikbiudh4ekrfhchiljfxqkfslbthg;1:4j7git;2:0iuahcfhdnj9wkn;3:ahfskk;2:ckxeh1;4:alg;2:dh0ejofjoqkq;1:tin;4:8imdivjhbrklwjg;2:8h2bhfklouiv;1:4h38go9j7ajqegbfinghgjh4rhgur4whg;1:0imlk9rgi;6:fjb;1:0im;1:5ik;5:ojx;1:bhglhewl6;1:4kc;1:wjz;3:1mr2hg5j56hb7hggh4jjfoh8phcqh4rgtwol;5:8jz9k0djreje;2:0h08gy9h7dmpeka;1:wkn;4:2is8iu9j8miyqk3shf;1:uj4;2:8j1;1:0h01nf3hb4hg6hf7io9heciqdhbeh8hjejgrkhcmj5ohgph8qh5rn6uh6wgn;1:cirej0;3:9k0akmfgj;3:jlj;3:ogvpl7rjs;2:2l54ggjhhvna;1:0o33iu6hd7hf9h3dgtek0fh3hhflheohgphbqh5rlcsh9uhbwgk;6:jix;9:riy;3:wl0;4:pnnwhd;3:7iq9hgcizfjhghfhhfjgtqjcrmdwh8;2:4j3aitbl8cjifhgkhbngvohfpn5uhfwhc;3:ahgcixfhfgjeijh;4:ahgckt;2:0h63ha8l49jiah4ck9emjfh1ghahhejgrkhgohcqhargutjf;6:jh9sks;3:jjw;9:0h21fd3h45hg6hg7hd8w99h2blzch5dh8efdjghknjlgumhbnhfogzph9qh7rgfshdtgyuiywgf;2:dh3ej7ijfwjy;2:0iy;6:1hgohhpl9;4:8gq9kjgj0kh8nm3ohgwhd;8:2hg3hh6h47jf9h8ghgjjlkhdnjdoo2pgyqh5wk1;1:6khdk0egrhjs;2:djhegx;1:4itljlrim;1:9h5ek0;1:jjp;1:8jfjja;2:tk5;1:2le4gj;b:dirjit;1:6kf7hgdiwehejgtqhcuiwwme;4:8jyaiwbjigkulhgwjl;3:iit;1:olp;1:6mz7hg8h69j1ajbbhgdgmeiyfhfjiqnk8oimph7qh9rh6wh0;2:1j58jj9jkajffh4khflhcnlrojaph7wgw;2:8h49gsdnaefyjlhwhf;4:8jy9jxajpbimfh5jjk;5:djr;3:jjz;6:ql1;1:4oj;2:3in7jgaksgipjgzsh7;1:1gw2hg3gx4hc6h87hc8h09h9aikbgtclldh6fgigh9hgcjnhkgslionjgoioph4qkuthduhfwkv;2:ijv;3:2mn3jlwhg;1:kmwlhgnh9phd;1:1jeij9kha;4:1hh2hd4jreinfhggj1hk6jllkhcljaogkplfrgpwgt;2:bisukq;1:4kr;1:dh1ejp;2:8h9ch0dmfel3rjkwhh;1:fhegk2;1:0h91hg4he5hc8lh9mvah6bfzck1dhfekugh5hjfjh1khaphaqh5rj5uhcwgu;4:5ka;6:gir;1:1j1;1:qin;6:2l24iu7kkjhf;2:fjo;1:1kvoh2;3:dk1ehf;1:1k02q06hf7lm8h2jhfohapheqh2wgv;7:lhennaph9;4:9h7jn1;1:uiq;3:4l1ah8;2:3kkdjjehggj7;1:ahfekerjptk0;1:qku;2:djqefqfjzsjf;2:8io;6:7kzdjlehajhfom3phewgy;1:flv;4:0ha4hg5hc8k79miah8bgnck2dhgekugh7hjgjh2khbphcqh6rj7uhdwgy;3:8jt;1:5j7;4:3ku;1:djc;4:1ju8hedj2ehgfhcgj7khalmb;1:8kd;3:4ji;2:8is9km;2:4jejh7rkj;1:ajjbjw;2:8jq;3:8jabjddhbejrrh7;2:ah4fheom3;1:dj5;8:ajbkjp;1:jjwqhf;4:0hc1hg2gx3it4h75ha6jl7jr8kq9grah9bhbchddh7el8fgygh1hh2mhbohbph5qjbtn3wgr;1:0hb2hf3h64hc5hh6hb7hc8gh9h6agxcfydh3eiqfkegisjgwkjilqsmhdnhcogwph3rmtshath3ugzwj1;4:eiq;2:djleh6flc;2:3hf8jywm7;2:dmteh5;3:8fk9mpeh7;2:2jm5jybkcjh0ngyok8qj5whf;1:ghgsir;1:5k3nma;1:0ix4l18jeej7jhhkhdljtqherh7;6:qkx;2:0h92hg3hgiql;1:6k5vgu;3:wlp;1:8km9gc;1:gjb;1:9iv;3:2lokk9whg;3:5ln;9:kjm;2:0hh4hg5k87jd8kc9ksbjicgzdixgh5jh4kk1ngwph6qh9whc;2:pkv;2:rir;3:rj8;3:wkd;2:9io;6:1m42fb3hc4hg6h57r89hcah8bh9chaehcfhbgh5jjkkh0lhfmh8nhcoj3pgeqiwrh4sjhthcuhd;2:eio;1:0ik6hfghcqohrk6wgs;2:aj3cj3fhcjh7kjgwkl;4:8hfak3;1:9lgahgcko;4:dj7;1:4lm;2:ah8cjtsk3;1:wk8;5:3hg5iw7he9j1ah6bhfcj6djyegzfjogh3hhcjh3qhfrh1snoujhwh7;1:8j3;i:fhdgjvjji;2:8hc9irilpsj7;2:5irmiowke;1:4kb;1:1io6mprhg;3:8jp;2:2le4gj;1:2k44jvjh6;3:3loaipdk2egiwhe;4:qkf;4:0ipgj6lk7rgi;1:0iv4lb8hgahfbjjeh9fjmgliihdjh2qhfrimuhgwhd;1:ahgjlcsha;1:fj8;1:djhegx;1:djr;6:8km9h7;4:4ni8h7dheeh7jhfphguna;1:ilt;6:0he1hd4he8mk9kxajvch2dhbegtfgpgh8hhdkkslgroh7phdqh7sj3th4ukhwgz;1:0p5gj2jhgpjcwf9;5:9iohgxokjrki;3:hj0umx;1:0j51il3hd8iq9jjakjbhccjaeitghbjharhdwhf;5:0lu4hc;4:2k3;4:clvrf4;4:3j25j5gh6hisjh1njyokqpitqherinwj2;1:fj8;1:1h93h64hc5im6hd7hb8kxak8chddjueggghbhjpjh2kgulh5nh8ph4qh1rizsj7tk6ujswgp;3:3jr9h8dk3eh8;1:8j3;3:8jnek3jhgniotky;2:ljp;2:0h84hb9hdajodikeh6fj3hj3iipmjkrjrwhg;4:8kf;4:0jg;3:8gz9grdo8efujjawja;4:mh5to2;4:8ipjj8kk3sk1;4:cjehk9sit;1:ckt;1:gjk;1:8hb9heahebh4chgdhafh8ghghr2jjkqj1rgswj2;2:ohdpk2;2:0jz3ktmjt;1:ojs;2:qo7;1:6nfhgxrkjwgx;1:1is3ky4hg9jnajpbgpchbdh5elfjh5khcohephfqhbrgyuhb;7:0p14hfgjcjheljqqherghwh9;1:2j1;4:lk9;2:jjuqjr;2:6nogh2whd;2:0jh;3:ain;2:eiv;2:cjn;1:riu;2:2hf3m0iis;1:5ka;2:8gzkltlgh;1:bhhciydh9ejgfm4;1:3heiiywkg;3:aj5;3:3kuah5ujk;1:0ik8ju9gzcl3rg1;4:hk0;2:jjp;1:tma;1:0rv1j43js6hfghbjh5phfqhbwgr;1:8h8bjldjyegqfkxqj1uhg;6:8kq;f:bkirhh;1:2j9;2:0lz1hg3h14jz5kb6hf7gz8hc9h8ahgdkxegcfhegh7mk4oh3ph5qlbuhfwgi;5:8jp;3:1hf3hf4ip8j69jqbmfcjsghdjhbkk3ngwohgphbrhhuhewh7;1:gjf;2:wjg;4:rjg;2:2m27hg8kl9h4egwjl0qha;4:akdgj8rhd;1:pnnwha;6:qn0;6:jjt;1:cj1dj4;1:dj8eh8;1:7hc8iv9hdckpeimfh7jm0qjdth7wh1;1:0k04gt5jncl9fjqrgvshe;4:8na9fpdnqeeufhfohgpkerj7uh4whf;1:qjy;2:rkl;3:1l63k84jd6hg7ha8h79hcbhddh8gj4hjejitohepk6rg9;1:0jn;2:8h29gthns;4:8jljhc;1:9ivdizeijfj1tj3;2:4it9hebjrck1wk8;1:9heahabgxcoxghgrklwhd;1:bkd;3:dhaej2fizgm2;1:8j8;2:8h29gthns;1:2in;2:7h99h9cklfh6jltpkqqj9rh7th6wgs;1:6hcuhbvku;2:6m8;3:8hfakrehgggmhkfuil;1:hhgjjq;1:0h92io3gy4h65he6ix7gr8ly9itbgwejefh2jglkinmhfph2qgxshftiuuhdvj3wir;7:8lv9gsaiu;1:1nb9j1rgb;1:wl5;2:sj5;4:0h21hb2hc3k84h76gh7j28ik9ggah3bh8cj5dh2ehefgxgh2jmrkhcmheohcph5qkdrh7sj3thbuh7vk9wk8;3:1h98h4ameck7disgl5hhfiiojh2qhcrgysk7wh3;2:2gn3o18ka9h3agwjheukwwhh;3:akbfj5mjs;1:wlm;2:qlg;1:tjw;5:gjc;4:bjc;2:3mt;5:0h43jg8jg9hgbnrjh0kh6rhhsjcuiowha;1:8gxbhgojlumhwhd;1:ljs;1:mkl;2:lm1;i:1ka8il9haajkbjrcjgfinghghjjjhfkhdlhgmhgohaph8qhhrkdth3whg;1:ahgrjw;4:5jeok2;1:9grele;2:1gz4he8lz9j4bm4cgvdhgfh4hjijhblhdohdqharh2tinwil;3:wlx;g:tjv;6:nj6;1:8hhcimeh9rk7uko;2:1he2ka3hg7hg8fu9k3ah1bipclhdh7ekhfilgj8jh0kh7oh3ph7qj1;2:diqujs;3:ajw;2:jjp;1:tki;9:ej4jjhrjqsim;a:ddfeow;1:tjq;5:0it8he9hfdheejeplbqk4wh8;4:giz;3:rj2;4:qle;2:0ik;6:djc;2:1iqhhdjjt;1:ehfmh3tq4whg;2:2hf3in4hd6k77hb8h29heahabk0dgjfgzjjrnjioiuph7rhbth7ujuvl7wgn;1:djdegwgjclj3;3:ak8;3:qj7wl4;8:0f33mndiyeh7lje;1:djq;3:0j31is2jr4jc7hbaj3bh9chdeh8hhhjj9killipoh4pilqh0sh5thewhb;2:8kg9m1egx;1:djkija;2:hgzrkr;3:blyhl3jhawjh;1:djjjjh;1:wko;1:bjsgiklkcnk0sj1;3:kir;2:9ilbji;1:kllngy;2:cis;1:0hd1hg3hg4hg8h19gzah2bj9diuelcfjoghdhhdkh9lksmlgnheojnph1qh6rhdugzwgz;2:4jtlklrg8;3:5j2;4:dj1eh8;2:wl5;1:njf;4:gk2;1:ditejifim;4:2k3;6:8j09jifjo;2:rit;5:cil;1:5ik;4:ais;2:tj8;2:8j2;1:chhhnfjh5;1:1hgrk5;1:gkb;3:0he1he4hg8mt9l5ajzch3dhcegufgrghahhekkwlgqoh7phdqh9sj5th4uiywh0;3:lk7;1:8jy9h5djaeh5;2:cimfjqqjtrkftiqwhf;4:hiljjp;5:8ji9h4ck6;2:sj5;6:qlp;a:rkb;1:4hgbkcijf;1:9indkeegguk2;7:5lo;1:0kk3gx7k48ha9hgagwcixfjqgh9hhbjgpphgqj1rjpwkf;c:9iz;1:6k0;3:9hgqlctjmwhg;1:bkxsj8;1:hgrjixnl4qjb;4:hje;1:aj5fhf;1:biu;2:9j2;7:fj1;5:kgulgynnmph2;3:1im3h84hc5hh6gz7go8j89fualwbkccjleipfiphh3iikjfzkh6njxohbphbqgvrh3thbujvwik;1:0ir1hc4kq5ji7hg8gw9h6aj3fh5hhfjgxmmvqhbrgosj2thbukb;3:7h48h19hbeh9jiqmk0qhcrk2wo6;1:9j5gj7;3:8ik9j6aj8bjzciveh1jhekjhlk8rhewh7;2:0im;2:0he3h47gm8gn9gmagnbhbchbdhdehfjgtkhephaqk3rheszsth7uhbwh2;1:1gy3hgbjqkhgop3;2:4kv;7:1lwbl6oiyrhe;1:1jcrhg;9:9j2;1:1itjhbkhfmiyogppk0wnn;5:3jy5ikjhd;1:to3;1:4kdjgyoky;5:7kr;1:2ji7hg;4:bhacj0khamtdphgrhdwh8;2:3k49hg;1:0iy;2:bj3cildmlejmfftwhf;3:0he1gk3h84hc5hc6h67q58hg9hgbgfch3glejh0khflhhml1nhgoldqj2rgcthauhhwgp;6:9my;1:1iq3hh5ox6gy8gtjhakkrwhc;1:aj1;2:0h61hg3j68j29jrahedjbejefheghgkhdphd;4:0hf1h93ha4hb6hf8h19hfah5bhccg5dh5eiujh2kk7lrjoh9phaqharn6wgx;5:ejkfh8;1:9jj;1:4j0;1:akhfj8;4:wks;2:0hb3iq6hb7h98ha9loaimcikdjmeh3ghejh5kjanhcoh3qhbriztituh3;3:ahcfjhnl2;1:8gn9itah8fjnghckkmllkpjdrhgwh9;7:0jsrjc;c:cjk;1:8h59jwalpfh0;4:3kswj2;5:6ogphfqh6whd;2:1gr8gv9jcakhbiocjudhceh4fgrghcjh9kheohdpiwqhgrlqtjq;6:rki;8:9jy;1:ggthkq;4:dlf;1:nl2;1:ujt;1:1ju2k05l28j1ijnrguwh8;2:3m35ok7kq8hffgvgh5jg8qh1wiq;1:djwehdfkx;2:ijqjkr;1:2k3;3:8ix;1:8gn9juah9dh8fjesiqtltwhf;2:wk4;a:ujv;1:ahgejyfkcglnjhc;1:3hc8lu9h6dg9enk;2:ngwpn0;2:iiu;1:0h41hd4h76ln7hd8h29heajcchfegxfivgj1hiriijjhekhemj7njuphcqherjgthewgy;2:iiw;3:9l4chd;3:1he8jg9nuakfbkvcfzegpfh0ghbjhfkmvlh8ngxph9qh6theuhhwh4;2:qji;2:2gn3oh;2:8jv;1:aj9;1:tjq;2:2iq7hb8h39heciodhgjo2qlmwgs;1:5k17jl8hddhfehefiugh3hg7jk6ohapj6qh5rh5wn1;1:ekp;4:wlo;2:ehffjl;3:0hg3jg9hdbkvdjdfhgjh4rgwuk0;6:8k79gt;2:tjz;2:8kf9h9dgpem0;3:tiq;1:8gw9h4agkbhfcxxehffhbgh7hh0jguqharioshfthcwh5;b:9hgtkc;3:aj3;4:3m5hh1rk6;4:dk7egi;1:8j1ojr;3:wky;2:0h61gz2hd3hc4hc6h37he8kr9iqah0cisdjseiufgwgiqjjrkh3lhenheognpm0qixrjishftgyugrwgi;1:diu;4:dhbejr;1:wl0;2:1k9kgz;1:ggphgujhcqor;1:akgrhd;k:jkd;2:0h61gw2hc5hb6h6bjbcitdk2eivgh0hizjh8lhdmiloh7pipqgprizth4ul6wgl;2:4jw8h5ah4dj9ej8gh2igsphgrjhtjkumrwh2;2:3jiahcdhhgkhjhaqjawk8;2:3l9;5:1hf4hf7hg8ge9iwbh5ck3eh2fh8hioiizjh3lhgnheokyphbqharh5tol;6:pmh;a:ril;1:jheqjb;2:3ja5lggjujgs;8:7h1ogvqou;1:jjs;6:ghbphdqjvwm1;1:uiy;2:8jbalb;2:8imahbeiyfjhwkz;5:0h51h02hb3hg4hd5hf6ha8nlajfbgddf5encfh3ggihj0jgwkh8lj7mhhnizoh9ph8qh3tk2uh9wj0;2:8h9agzfh4ghfkhfnkboncpheqlqsh2whd;1:3ha6o6gkljiqqhcth7wgu;1:djs;3:9jg;1:0l61ne8hgahfbhdfh2gjpjhfrhcuknwh5;a:cis;7:4hg8iral0bhbfkyhisjh3kharh7theuh6wh2;1:oj3ril;1:old;1:qm4the;5:cirdja;2:1l24jjrhb;1:iilljb;2:wnu;1:3kb8hcgl0hhgwks;1:0jc3j64h87he9kxaj1bh9ch8dj1ejeij2jgqkhhoh8rh7sgsuhh;2:4k48he9hhdmeegkjjc;3:lhcnksrjbtiy;1:1hgejfpl4;1:qn0;1:0j1;2:fj8;2:2jv8h9jhcmmdohbrhetmhwh6;3:afffm3;4:8h7bj8diuehdginkhflpenh7phd;7:8jb9nfegp;9:km5;2:0l33iq9hgeisghgijbjh5ojwrk0wgn;3:8gu9jk;3:0li4hb5iv;2:7go8ioehfjl3nivrgrtipwmd;1:0jj2j33ji4hgdjyggzhivjhfqherhg;4:8h9sn3thd;2:9iv;2:nmrohfphd;1:9k6;1:gilto2;1:3ha4hc7h9fhdgh8jjwkjvnhaojopj1qjyskbthauhgwh9;2:tjl;1:0kd3g9bkncjg;5:4lxij1;1:wk6;3:9j7;1:1jeeh3ulx;1:3kh;1:8it9j4ajbbkwcioegvfhdkkhnhgwhc;3:9iu;4:gjl;1:wm7;2:0j61hd4gw7hd8h4ajgdjeeiwfizhj6ihfjhgrjswhf;2:ek1wjr;4:ajn;1:jgupl6;2:5ke;2:1hf4ir8j79jsbmhcjvdiregjfhajhekk4ngwphduhfwh9;1:bhfjh0lj1wnw;7:1he8h89gyaitchgehdjizrjwuos;4:5k1djejhbnm5;5:8dk9n8;1:bkd;1:gjv;1:bjrjjikliwhh;2:ejg;4:fijhkilk3rh3;4:cku;1:tiq;1:3hf8jywm7;2:hgrjk5;1:ilt;2:9j6;5:9j9ditejeukv;2:llp;2:ij1;2:0he1he4hg8n79laak1ch2dhdegufgqghahhekkzlgqoh7phdqh9sj7th6wh1;2:kin;4:0j2uka;b:ljw;1:hj6;4:ehgukj;2:8hgukc;1:njf;1:ghfjkq;7:8kd;1:uj8;1:al5fhekh0;3:1j1;6:5ik;4:tl3;5:eiw;1:ljs;8:7hdejfjhekgpnj8oknpko;4:0ju1in2fp4ku6h87mp9hgchfghcijzjh5khelhfohhph8qhauhcwgv;1:3nzhhciirjjiwhc;8:oky;1:6ha7n3;1:0j24la5klah7jhf;4:nk4;3:jkw;1:his;1:0h04n27hecheil0jh7ohbpn6wh6;5:fjw;2:hlb;3:rji;1:fhcgk3;6:rkl;1:8j2oh4pla;2:8h6ahdukz;1:hkrrh4;3:8kd;1:7nkogwph8;7:5kxah7eheghghhcjl4rkptivwh0;5:0h21hb2hc3k44h86gi7j08jg9gqah3bh8cizdh2ehbfgygh0jmkkhbmhfohcph5qk8rh6sj1th7uh7vk6wk4;1:gj6ik9;6:2ls4g6hj1jlwphgqhgrgr;1:hik;1:bgwlmgoiz;3:8jf;7:0h04hg8h29neah6dkgegwgiujh9ohfphdqhdrh3wk9;1:ajfcgugglhgujmiqnhwgv;1:4lm;3:tj8;7:8k5ekg;3:8gtgj9wlv;1:qkw;2:ajo;1:hlb;1:km5;2:fj3;4:rj4;1:ckt;1:1lc4je6h6rh7uhavkr;3:bgwlmgoiz;1:ejkfh8;4:1h04ha8hbbkudh3ehefikgjohh2jh0kh0lh0ngwoh2pgwqhcro4skctiqukjwh5;7:gio;1:giv;1:1hg4jq8ha9h2apzbjachefg2ghfkheqhgrjzwhc;2:qj9;4:4jdcn0;1:4kv;2:bhglhewl6;3:1j3wkf;2:9jj;2:3ivrj1;4:hjfjjpnitrgq;1:iiz;3:din;4:9j9akmfh7nj7rj0;4:2kh5ikbheeinhj5jh9wju;9:1gx3nz8iq;a:sivuiz;2:8jbekd;4:kh9ohcpm8;4:diq;2:7hf8jv9ghahddh9ejofh1gjvjknmiwrhgsimujowha;2:8hhajfbio;5:bhbkh6ll4;4:dj4egtfkoukf;1:6hbdizlhgrk1umw;2:3k39gzbhgdgzejvgl4hhgoj5phdqhcrk6uhewh5;3:dh1ejp;5:ej1;1:4j55k8jk6phd;1:8fg9mx;a:djbeh8;4:2im3h74hg9jzbhachgdm8emffgxghdhh6jk0qh9rh6uh2;4:5lz6h29iqdh8ejk;1:8h39hcdiztpj;1:jkb;3:bj6jikpm4;1:2je5jl8h7ghhjhfkhanovojfph2wgq;1:0h74k58h89h6bkzdgdemfigrjhcqkhrheshe;4:9ip;2:djneh9fiqqjk;2:gj5kkolgn;2:ajtdhdegujl5;2:tlcukj;4:0lp3j8eiy;2:1h28jpehdklf;6:jkc;2:qlp;3:aiu;4:dgpelafhfgisjl0rj6sh2;2:0hh4gdimxojjpkvrhdwhf;1:8gzbml;2:4jecn4;3:kh8nkc;1:ajhcj7jj8;4:tja;1:9irgio;4:3h46p2qhgth4wj8;2:djkrik;5:tj8;3:wlo;3:1jr2hf3h88gq9h5al4bgqch2dh6eh6fjvgl6hgxjgvkkillbmhfnhaojvph6rfothbwh6;6:8gv9jd;2:ahbfkkgiw;1:uir;4:akoshf;3:1kkdknegsrgf;1:2hc4ns8h0ch7ghgjhelkkmlhuivwh2;3:jh0qkz;1:1hc2k83h14hc6m67jm8khaj5bh7chbdgyejpfh1ghajelkhelkhmhhohaphaqh0rhathfugsvmewgh;1:nmephg;1:sin;1:2g87lc8kd;2:1hb8jr9gqahhbhcciufjlhfgjl5khbngzpkvqjgrjjuhfwil;2:4kg;4:0nf4kqej6jhgqh9wha;2:wlb;2:2mw3hd4he6hg7hg8hgjilnhfohfplmqhcrhfuhfwkp;1:jkd;4:5ja8h8ahbfhfgotjh4sjpwhf;1:iji;1:bk0ckzfhagl4wh5;1:8gv9jh;9:2hg3k24jl6hg8h29h2bhhcj1dgvelrgh9jguoj6ph5rhguhgwm8;4:0iv3jgiiq;1:0il2jy6hd7is8h59h7ah8bhadm4gh2hh4jh8khflhhnh9pij;1:4lb8h7;3:ujz;1:dlf;1:jip;6:mjrriv;4:8k39g8;3:0h61hc6h98hdah3bhgdjdfgsgothh9jklkh6ljmmhgnhaoh9pjiqiouhdwhc;5:aj5fhf;5:qletil;2:gim;a:8iwbka;3:ahcdipokg;3:ok7;1:1lk2gf;5:qjotm7;1:his;1:3jjcjjwkg;3:aj9;5:tjb;2:aiv;3:dltehe;5:nj2;1:miy;1:djqejv;1:rix;2:qj3;1:djxsiquiy;6:3jdfjt;4:1harkxtkt;8:8jt;4:6kb;4:3hd8h5bhgch0dlpekjghhjk9liz;1:3lj;2:hkrrh4;2:1jt8h0aj2dgnfjikjsuj0;2:4kcngiolq;2:riu;1:4gy8iw9ggafxbhffh4hhfjfuko0nm2ojnpkuqh0rhfshaujywh0;4:fj1;3:bh7kkf;2:pn8wha;2:mo3rhg;2:0h81gy3he4hf6hc7hf8gvak0cj7fgqgilhjyiizjjwkiyolopj6qh2rhathhuhawgo;6:ciy;5:3heiiywkg;5:1jj2kr3hc8gqdl9egmfgrgk6jlorgwuhgwhb;3:qj7wl4;1:4j1;2:1kd;2:ul3;1:birjksohdpjbqh9wm7;1:1je3ka;2:1jr2jy5kzbluch2ijljhfrguwgz;1:9io;3:ahfcjhfmalj8tjhwhe;2:2me;2:kj4nks;1:1hcrl1;2:9j7;1:fk3;2:akcqk9rhc;4:2ir3hg6iz9kkahgbhadkaeltfgzgh8hh6jk6qharj3uhawfy;2:wk6;1:sjuuiq;1:5k4;6:qis;2:0hg1ku2hg3he4hg8h59grah9bhfcjbdh7eh9fhcgilhk5jgokhgoilph9qharpvuh2wh3;1:8im;3:8k9aj7dkuehf;2:8gy9koalxfgfwhf;1:9ivoj3;2:0hc1gl2jn3h45hh6hd7gv8h39h8bhfdhdehffh6giwjkdkh1lh8on7pj3qjcsjethcuh9wit;1:tin;3:1ha9hbahbbhech8eikfhegh4hjqjh9kjflnlnj2phbqh7rgvtis;1:agzeirrjh;3:jku;7:eka;5:2j7;1:cjy;1:4hdijjmmvuh5;b:ejh;1:jhfwjq;3:khenkg;4:8hfalckgrlgxnnfph0;1:fji;3:iiwrk7;3:7jgqm4;6:8fn9jcaqdchfehfgh9hhfjhgrhdsj6ukbwh1;1:bk6;2:jji;3:qj1rkh;6:0izdivej1fj2ukq;1:6m7fhggithl0rhdsiy;1:fhhgjn;5:ukk;4:0iv4lt8ilakdbhfdiweizfiwgh7phewh2;2:8jv;2:djnegz;5:9h5ajmcilehgfgxghhrlysiztix;4:gixjhakhgljfwmo;1:akecj7hinrixshe;1:1hefh6gkphj6jhdrjhsj8tj5;5:bkf;2:hik;2:1h93k59gzahbbkncikeh9fgyhhejhdkjuljjpherlatiowhc;1:gk7;1:5lt9hgajrfknhinohdwhc;6:4j5;5:1h52h54nbuk6;1:4hgik2jhbmhfonlpj5whh;2:0kt1iu3h34gv7hc8h3ajcdjaeitfiwhj0ihbjhcriwwha;2:hjnqjz;2:rkd;4:3jqbizej2ghcjhbqjcsik;2:dip;5:5kh9haah8bjujjjrmlsgzwh4;1:1hg8ki9hcakrjhdqjwrh7ujc;1:2li3iv4ha6kg7j1ehgjgzokjphcqh8wjp;1:1hcklumheojzpjz;1:9jv;7:jinsj7;3:jio;1:lj6;3:0k51is4guakdrgt;2:jjx;2:1jcrhg;1:ahcfh8ol3pkr;1:ij2;3:tjw;8:khenkg;c:0h61h63h24hb6k77gz8jk9g0ahfbjkch2ejjfjegh4jh8kh0lhdmhfohaphaqgvrj6sjotk5ujrvjnwhf;1:ohcwlb;3:jjb;1:6qj8hfeh8;2:ljp;2:0hb2j33hf4h85ha6h87hb8h09h6bhdcj0dh8egxfl7gj9hhcjowkhdmhgoh8ph6shd;4:jjd;1:old;2:bhfjkglhewkw;7:al6;2:8hgajebhghgljjaql7;4:biz;1:dik;5:lj4;1:dk3;4:glcjgzsh6;1:agxcjafkbhhfqjrrkctimwhf;4:rj3;1:8km9h7;1:tjf;6:ck4hkc;2:8h8dnhelifgs;3:sjp;4:bl8fhfgjihj6ojm;3:1hc4hd6he7hf8gt9hebn2cilghchh3jh9kknlncogwph6qh2riu;1:8k4;1:6ji;2:6fuojjwm5;5:wk6;1:jh8wn0;2:5iowk4;2:ait;1:eit;7:8jc9nhegp;1:ijt;5:2j08jx9g9bhbgijjhekjxqirwk3;1:tkp;3:0hb1h43h74h68h7irfjhawlo;7:7h78ip9hcckbfh7ik3jlikhenk0phfqj3rhhth6wgu;3:8isjjmwh8;1:bhglhewl6;2:8jv;2:ql1ujb;3:9ingla;1:bk2fhhjkt;1:aj9;2:8jbekd;2:fik;8:ok8;3:kjn;1:kjj;1:8hdgkm;1:ajhkiuohc;1:kkrlgn;2:mn1uh6;5:1klrgf;1:0jm1gw2hf3jy4h75hc6h77gr8jwahbbh9fgyhh5iiqkh9lhdmhaoharjbsjethguh8wm5;1:blewkd;1:0hh1h92ks3hb4h16jw7h88h7ah3chggldjj0lhhoh8ph7qgprh6sj0thgul8vl2wgu;3:jlarhf;8:kjn;4:bj0;4:3hgdgcegvfsmkgu;3:lkjsj4;1:sjj;4:6nbaksjgysh9wgy;6:jio;2:8gl9grchgeh9hn9lhgrixwkn;1:rjl;2:hgtlgrroe;1:6h58h1uncvklwhe;1:3k29hfdh0ejk;2:0iziinqkh;2:hgrqj0rko;3:0hc3h74hg8kj9hdgmajm3qh8rjtsh0uhewh0;1:mmn;2:ukf;2:sit;1:cin;1:dhgjlh;2:8j89judjhekcpknrh9sj1thbuhg;6:0j9;3:ik5;1:bjh;2:ijpkh8nkk;6:lj6;1:hherjusik;1:pn8wha;2:1iw2ip6j3ghghhglitoj4qghth6;4:8mf9jtahgcj4dixeg4fgsgioikpjhbphgrhbwhf;1:gky;1:2jl5km6he7k5dj7eh6jh4kh4njkojspgzqhbthgwjy;2:tj4;3:1h38ik9hdajbbh8cildh8ehffgthhbjkokjyogwrkywki;2:4jqche;4:lkq;2:0j31is2js4jc7hbaj3bh8chddhgeh9hhgjjakillipoh4pilqh0sh5thewhb;2:tjz;4:giv;4:0ittkg;7:iikolbphg;1:rix;1:akofj3;2:9irgio;3:6kx7mophhwha;3:8h6glf;1:5j9;8:0jq3m2wh8;1:9ik;1:amzcj9fgasj1;2:3kz4jy8h3ekfgk3jhcwhg;6:cfqrlj;1:iil;1:8h69j3ehcjjkrk0sisujiwj4;1:bjzgix;1:flv;1:2iw8gn9h1ainbirciudhdfjuhk2killiu;5:kji;2:djp;6:olp;3:1gy3il4hb7hh9grahfbiucirdk3eiqfh5gh7hiviivjh1lhdpherlgtjjuh8wgv;2:pk0;2:bjuklk;1:ah2dirfh8kh9lmhokz;5:djc;1:1k4rh3;2:jmp;3:ej3jjp;5:7hd8j19h9ej2hisqmhwhh;3:8h6gk1;1:wkk;4:oj2;3:4hhom4;1:8h49mrdh1en7fhehh7jh2whf;3:3ir;2:1j1jk9;1:njgojdqjp;1:4jbblocjt;2:iik;1:5iqejhfh8rio;2:hj4;3:0h51hh2kq5jc8h89h8agudj3ehegh1hojjlgohfph4qizrgithauhfwh3;1:cjy;2:8jcckneh1hj7;3:gl1qk0;4:2iw;1:lh5nno;1:8hebj5dhejn7rjswhg;1:ilt;4:0jn;3:3hd8j39hbbjgch5fhggk3rhbwo7"}/*MODEL-BITIS*/;
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

  var NIYET_ESIK = 0.3;
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
    var p = (0.4 - st.resmi) * 0.7;
    if (sans(rng, p) && !SELAMLASMA.test(t) && !/^[@\d]/.test(t) && !ONEKSIZ.test(t) && t.split(' ').length >= 4) {
      var dolgu = st.nese < -0.3 ? ['of', 'ya', 'valla'] : ['ya', 'valla', 'hocam', 'bak', 'kanka', 'abi', 'yaa'];
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
    t = t.replace(/(\p{L}{2,}[ıiuü])yorum(?=[^\p{L}]|$)/gu, function (x, g) { return sans(rng, p * 0.7) ? g + 'yom' : x; });
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
