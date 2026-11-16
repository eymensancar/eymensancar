/* b001 — Doğuş bölgesi. BÖLGE TANIMI: sınır, geçiş bandı, taban, doğuş noktası. Kılavuz: tasarim/KILAVUZ.md
   ŞABLON: `sinir` verilmediği sürece bölge etkin değildir (dünya bugünkü gibi yalnız algoritmadan gelir).
   Etkinleştirmek için aşağıdaki örnek satırların başındaki // işaretlerini kaldırıp değerleri doldurun. */
SO.tasarim.bolge({
  id: 'b001', ad: 'Doğuş bölgesi',
  // sinir: [[x, z], [x, z], ...],            // çokgen (saat yönü önemsiz) ya da { kutu: [x0, z0, x1, z1] } / { daire: [x, z, r] }
  // gecis: 150,                               // sınırdan içeri bu kadar metrede prosedürel araziyle kaynaşır
  // taban: { kip: 'prosedurel' },             // 'prosedurel' | 'duz' | 'izgara' | 'noktalar'
  // mikro: { genlik: .4, olcek: 24 },         // küçük tümsekler (tepe-çukur farkı ≈ genlik m)
  // varsayilan: 1,                            // prosedürel ağaç/kaya yoğunluğu çarpanı (0 = bölgede yalnız tasarlanan nesneler)
  // dogus: { x: 0, z: 0, yon: 0 },            // yon: pusula açısı (0 kuzey, 90 doğu)
});
