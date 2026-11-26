// Küçük Unigram (SentencePiece) parçalayıcı: budanmış sözlükle anlam modelinin girdisini üretir.
// Tarayıcıda ve Node'da aynı dosya. Sözlük biçimi: { parcalar: [ ... ], skor: [ ... ], unk: 3 } (kimlik = dizideki sıra).
(function (g) {
  function kur(sozluk) {
    const P = sozluk.parcalar, S = sozluk.skor, unk = sozluk.unk == null ? 3 : sozluk.unk;
    const harita = new Map(); let enUzun = 1, enDusuk = 0;
    for (let i = 4; i < P.length; i++) { harita.set(P[i], i); if (P[i].length > enUzun) enUzun = P[i].length; if (S[i] < enDusuk) enDusuk = S[i]; }
    const unkSkor = enDusuk - 10;
    // Bir kelimeyi (başında ▁) en olası parçalara böler (Viterbi)
    function kelime(w) {
      const n = w.length, en = new Float64Array(n + 1).fill(-Infinity), geri = new Int32Array(n + 1), kim = new Int32Array(n + 1); en[0] = 0;
      for (let i = 0; i < n; i++) {
        if (en[i] === -Infinity) continue; let bulundu = false;
        for (let L = 1; L <= enUzun && i + L <= n; L++) { const id = harita.get(w.substr(i, L)); if (id === undefined) continue; if (L === 1) bulundu = true; const s = en[i] + S[id]; if (s > en[i + L]) { en[i + L] = s; geri[i + L] = i; kim[i + L] = id; } }
        if (!bulundu) { // tek karakter sözlükte yoksa bilinmeyen (vekil çiftler tek karakter sayılır)
          const L = (w.charCodeAt(i) & 0xfc00) === 0xd800 ? 2 : 1, s = en[i] + unkSkor; if (s > en[i + L]) { en[i + L] = s; geri[i + L] = i; kim[i + L] = unk; } }
      }
      const out = []; for (let j = n; j > 0; j = geri[j]) out.push(kim[j]); out.reverse();
      const t = []; for (const id of out) if (!(id === unk && t[t.length - 1] === unk)) t.push(id); return t; // art arda bilinmeyenler birleşir
    }
    /** metin -> kimlikler (<s> ... </s>), en çok 128 */
    return function parcala(metin) {
      const temiz = String(metin).normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
      const ids = [0]; for (const w of temiz.split(/\s+/)) if (w) for (const id of kelime('▁' + w)) ids.push(id);
      if (ids.length > 127) ids.length = 127; ids.push(2); return ids;
    };
  }
  const api = { kur };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.AnlamSozcuk = api;
})(typeof window !== 'undefined' ? window : globalThis);
