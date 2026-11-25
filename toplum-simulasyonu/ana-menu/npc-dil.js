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
    var r = /^(\p{L}{2,}[ıiuü])yo(n|sun|m|z|nuz|sunuz|lar|du|muş)?$/u.exec(g);
    if (r) {
      var son = { '': 'yor', n: 'yorsun', sun: 'yorsun', m: 'yorum', z: 'yoruz', nuz: 'yorsunuz', sunuz: 'yorsunuz', lar: 'yorlar', du: 'yordu', 'muş': 'yormuş' };
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

  function normal(metin) {
    var ham = String(metin == null ? '' : metin);
    var k = temizle(kucult(ham));
    var toks = k ? k.split(' ') : [];
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
      if (m) ekle(r.id, r.p, m.index);
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
    ['maas_sorusu', 3.5, '\\b(kac|kaca|ne kadar)( para| bin| lira| tl)? (veri|ode|ali(yor|r)|kazan|calis)\\w*'],
    ['maas_sorusu', 3, '\\b(prim (var|veriliyor|ne kadar)\\w*|brut|net maas\\w*|net mi|sigorta\\w* (var|yapiliyor)\\w*|gunluk (kac|ne kadar)|haftalik (kac|ne kadar)|yevmiye\\w*|bahsis\\w*)'],
    ['meslek_tavsiyesi', 3.2, '\\b(en (karli|iyi|mantikli|kazancli|garanti) (is|mesle[kg])\\w*|(is|mesle[kg])\\w* hangisi|\\w+ olmaya deger\\w*|\\w+(dan|den|tan|ten) sonra ne (yap|ol)\\w*|baslangic icin (ne|hangi)\\w*|neye gecsem|ne olsam)'],
    ['kurs_sorusu', 3.8, '\\b(sinav\\w*|kpss|ales|belge\\w*|ehliyet\\w*|lisans\\w* (al|nasil)\\w*)'],
    ['yardim', 3.5, '\\bnasil (\\w+ )?\\w{2,}(ilir|ulur|inir|unur|nir|nur|lir|lur|irim|urum|arim|erim|iriz|uruz|ariz|eriz|abilirim|ebilirim)\\b'],
    ['yardim', 3.5, '\\b(ne ise yar\\w*|nereden (alinir|acilir|bakilir|yapilir)|nerede(n)? (bulurum|bulunur)|(menu|ayar|buton|sekme|ekran|profil|envanter|harita|magaza)\\w* (nerede|yok|acilmiyor|nasil)|nerede (menu|ayar|buton|sekme)\\w*)'],
    ['zam_istegi', 4, '\\b(zam (yok|gelmezse|gelmedi|almadim|alamadim|yapmadin\\w*|yapilmadi|gormedim)|(biraz |daha )+(fazla )?vers(en|eniz|ene)\\b|maas\\w* (\\S+ )?(cikar|artir|arttir|yukselt)\\w*)'],
    ['yetki_istegi', 4, '\\b(admin\\w*|moderator\\w*|mod (yap|ol)\\w*|mod\\b|yonetici (yap|ol)\\w*|hile\\w*|bedava\\w*|para (gonder|yolla|at)\\w*|bana \\S+( \\S+)? (gonder|yolla)\\w*|para verir mi\\w*)'],
    ['teklif', 3.6, '\\b(ortak\\w*|beraber (\\w+ )?(ac|al|kur|yap|isle)\\w*|birlikte (\\w+ )?(ac|al|kur|yap)\\w*|\\w+ (acalim|alalim|kuralim|yapalim)( mi)? (beraber|birlikte)|yari yariya|seninle (\\w+ )?(is|ortak)\\w* (yap|kur)\\w*|is birligi\\w*|isbirligi\\w*|is yapalim)'],
    ['dert', 3.6, '\\b(bat(ti|tim|tik|tilar|iyorum|acagim)\\b|dolandiril\\w*|odeyemiyor\\w*|odeyemedim|odeyemeyecegim|alamadim|alamiyorum|maas\\w* (yatmadi|odenmedi|gecikti)|atilacag\\w*|kovul\\w*|(elemanlar|calisanlar|isciler)\\w* (kacti|gitti|birakti|istifa)\\w*|beni (oldur|bitir|mahved)\\w*|borcum (cok|var|bitmiyor|buyuk)|borca (battim|girdim)|icraya (dus|gitt|verdi)\\w*|yardim etmiyor\\w*|kimse (yardim|umursa|bakm)\\w*|parasiz kaldim|meteliksiz\\w*)'],
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

  function niyetBul(metin, baglam) {
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
      !new RegExp('\\b(' + AR + '|lazim|alir|aliyor|ister)').test(k)) ekle('kisisel_meslek', 4);
    if (v.meslek && /\bkimler?\b/.test(k) && /\b(burada|kanalda|var|aramizda)\b/.test(k) && !/\bal(ir|iyor|an)\b/.test(k)) ekle('kisisel_meslek', 3.6);
    // "Istanbulda misin", "Ankarali var mi": kisinin yerini soruyor
    if (v.yer && /\b(misin|musun|misiniz|musunuz)\b/.test(k)) ekle('kisisel_yer', 4);
    if (v.yer && /\b\w+l[iu](lar)? (var|kim|olan)\b/.test(k)) ekle('kisisel_yer', 3.6);
    // is ilaninda maas yazmak teklif degildir ("eleman ariyorum 30 bin veririm")
    if (puan.teklif && (puan.eleman_ariyorum >= 3 || puan.is_ariyorum >= 3) && !/\bortak/.test(k)) puan.teklif -= 3;
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
      puanlar: puan
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
    'Aleyküm selam, [hoş geldin|buyur|nasılsın?]',
    '[Selam|Merhaba], [kolay gelsin|iyi oyunlar|hayırlı işler]',
    'Oo selam, [nasıl gidiyor|işler nasıl]?',
    'Merhabalar, [buyur|hoş geldin]',
    'Selam {oyuncuAd}! [Bugün nasılsın|Ne yapıyorsun bugün|Nasıl gidiyor oyun]?',
    'Selam, [ben de yeni geldim|ben de şimdi girdim|tam çıkıyordum ama buyur]',
    '[Selam|Merhaba], hoş geldin {oyuncuAd}',
    'Selamlar, [keyifler nasıl|ne var ne yok]?',
    'Hey selam! [Nasılsın?|Naber?]',
    'Selam selam, [buyur|ne lazım?|hoş geldin]',
    'Merhaba {oyuncuAd}, [nasıl yardımcı olabilirim?|seni görmek güzel]'
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
    'İsmim profilimde yazıyor, [sen?|sen kimsin?]',
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
    '{yer|de} {kisi|in} {isletme} var, {meslek} lazımmış. [Bir sor|Yaz istersen]',
    '{kisi|e} yaz, {isletme} için {meslek} arıyor, maaş {tutar} civarı',
    'Bildiğim kadarıyla {kisi|in} yerinde açık var, {meslek}. {tutar} diyorlardı',
    '{isletme} sahibi {kisi} eleman bakıyordu, {meslek} için. Bir yaz bence',
    '{kisi} geçen gün {meslek} arıyorum demişti, {tutar} veriyormuş',
    '{yer} tarafında {kisi|in} {isletme} var, {meslek} lazım dedi'
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

  function hataEkle(t, h, rng, korunan) {
    var sayac = 0;
    var parcalar = t.split(' ');
    for (var i = 0; i < parcalar.length && sayac < 2; i++) {
      var w = parcalar[i];
      var m = w.match(/^(\p{Ll}+)([^\p{L}]*)$/u);
      if (!m || m[1].length < 4 || korunuyor(m[1], korunan)) continue;
      if (!sans(rng, h * 0.18)) continue;
      var g = m[1], tur = rs(rng), poz;
      if (tur < 0.45) {
        poz = 1 + Math.floor(rs(rng) * (g.length - 2));
        g = g.slice(0, poz) + g.charAt(poz + 1) + g.charAt(poz) + g.slice(poz + 2);
      } else if (tur < 0.8) {
        poz = 1 + Math.floor(rs(rng) * (g.length - 1));
        g = g.slice(0, poz) + g.slice(poz + 1);
      } else {
        poz = 1 + Math.floor(rs(rng) * (g.length - 1));
        g = g.slice(0, poz) + g.charAt(poz) + g.slice(poz);
      }
      parcalar[i] = g + m[2];
      sayac++;
    }
    return parcalar.join(' ');
  }

  function emojiEkle(t, st, rng, duygu) {
    var p = st.emoji * 0.75;
    if (st.resmi > 0.8) p *= 0.5;
    if (!sans(rng, p)) return t;
    var d = duygu || 'notr';
    if (st.nese < -0.3 && (d === 'mutlu' || d === 'sevinc' || d === 'gulme')) d = 'notr';
    if (st.nese > 0.5 && d === 'notr') d = 'mutlu';
    var havuz = EMOJI[d] || EMOJI.notr;
    var e = sec(rng, havuz);
    if (st.emoji > 0.85 && sans(rng, 0.3)) e += sans(rng, 0.5) ? e : sec(rng, havuz);
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
