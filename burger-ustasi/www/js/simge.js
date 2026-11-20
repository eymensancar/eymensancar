/* Burger Ustası: simge seti (emoji yerine kendi SVG'lerimiz; telif bizim).
   BU.SIMGE.svg(ad, sinif) → '<svg class="ic …" viewBox="0 0 48 48" aria-hidden="true">…</svg>' metni.
   BU.SIMGE.ADLAR → bütün adlar. Bilinmeyen ad boş bir simge döndürür (hata vermez).
   Biçem: oyunun burger katmanlarıyla aynı çizgi film dili. Kalın koyu çizgi (#2a1a10, 3 birim),
   düz canlı renk, alt tarafta bir ton koyu gölge, sol üstte beyaz parlama (ışık hep sol üstten).
   Hiçbir simge id/clipPath kullanmaz; sayfada yüzlercesi yan yana durabilir. */
(function(){
const BU=window.BU=window.BU||{};
const K='#2a1a10';
const O=`stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2=`stroke="${K}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
// parlama: beyaz, yuvarlak uçlu, saydam
const H=(d,w=2.6)=>`<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="${w}" stroke-linecap="round"/>`;
// çift çizgi (koyu kenarlı renkli şerit): ok, tik, çarpı gibi çizgisel simgeler için
const BAND=(d,c,w=6)=>`<path d="${d}" fill="none" stroke="${K}" stroke-width="${w+6}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// dört köşeli parıltı
const SPARK=(x,y,r)=>{const q=r*.3;return `<path d="M${x} ${y-r}Q${x+q} ${y-q} ${x+r} ${y}Q${x+q} ${y+q} ${x} ${y+r}Q${x-q} ${y+q} ${x-r} ${y}Q${x-q} ${y-q} ${x} ${y-r}z" fill="#fff" ${O2}/>`};

const HEART='M24 41.5C11 33.5 5 25.5 5 17.5 5 11.5 9.6 7 15.2 7 19 7 22.2 9.2 24 12.6 25.8 9.2 29 7 32.8 7 38.4 7 43 11.5 43 17.5 43 25.5 37 33.5 24 41.5z';
const STAR='M24 4.5l5.6 11.6 12.7 1.8-9.2 8.9 2.2 12.6L24 33.4l-11.3 6 2.2-12.6-9.2-8.9 12.7-1.8z';
const SPEAKER=`<path d="M6 18.5q0-2 2-2h6l9-8q2.5-2 2.5 1.2v28.6q0 3.2-2.5 1.2l-9-8H8q-2 0-2-2z" fill="#f08a3c" ${O}/><path d="M14 31.5l9 8q2.5 2 2.5-1.2V26H6v3.5q0 2 2 2z" fill="#d06a20"/><path d="M6 18.5q0-2 2-2h6l9-8q2.5-2 2.5 1.2v28.6q0 3.2-2.5 1.2l-9-8H8q-2 0-2-2z" fill="none" ${O}/>${H('M10 20.5h3.5M17 15l4-3.5')}`;

// küçük yuvarlak yüzler (müşteri yüzlerinin ten rengi ve mürekkebi)
const FACE=(ten,yanak,ic)=>`<circle cx="24" cy="25" r="18.5" fill="${ten}" ${O}/><path d="M9.5 33a18.5 18.5 0 0 0 29 0" fill="none" stroke="${K}" stroke-opacity=".12" stroke-width="5" stroke-linecap="round"/>${yanak?`<ellipse cx="13.5" cy="30" rx="3.6" ry="2.4" fill="${yanak}" opacity=".85"/><ellipse cx="34.5" cy="30" rx="3.6" ry="2.4" fill="${yanak}" opacity=".85"/>`:''}${ic}${H('M12.5 17.5q3-6 9-7.5')}`;

const S={
// altın sikke: kenarı, üstünde kabartma burger işaretimiz, yanında parıltı
para:`<circle cx="22" cy="28.5" r="17" fill="#d68f00" ${O}/><circle cx="22" cy="25" r="17" fill="#ffc21a" ${O}/><circle cx="22" cy="25" r="12.2" fill="none" stroke="#e39a00" stroke-width="2.2"/>`
 +`<g fill="#bf7200"><path d="M13.5 22.6q0-8.6 8.5-8.6t8.5 8.6q0 1.2-1.2 1.2H14.7q-1.2 0-1.2-1.2z"/><path d="M12.6 26.3q2.4-1.6 4.7 0t4.7 0 4.7 0 4.7 0v2.2q-2.4 1.6-4.7 0t-4.7 0-4.7 0-4.7 0z"/><path d="M13.6 30.4h16.8q0 4.4-4 4.4h-8.8q-4 0-4-4.4z"/></g><g fill="#ffe27a"><ellipse cx="19" cy="18.6" rx="1.3" ry=".8"/><ellipse cx="24.4" cy="17.4" rx="1.3" ry=".8"/><ellipse cx="22" cy="21" rx="1.3" ry=".8"/></g>`
 +H('M9.5 21q2-7 8.5-9.5')+SPARK(40,9,6),

// yazar kasa: ekranı yukarıda, tuşlar, çekmece; sevimli yuvarlak hatlar
kasa:`<path d="M21 13v5h6v-5" fill="#9aa0a6" ${O}/><rect x="13.5" y="4.5" width="21" height="10" rx="3" fill="#3cc45a" ${O}/><path d="M18 9.5h5M26 9.5h4" stroke="#c9f5b0" stroke-width="2.4" stroke-linecap="round"/>`
 +`<path d="M10 33l3-13.5q.6-2.5 3-2.5h16q2.4 0 3 2.5L38 33z" fill="#e8483b" ${O}/><path d="M11.4 27h25.2L38 33H10z" fill="#c4352a"/><path d="M10 33l3-13.5q.6-2.5 3-2.5h16q2.4 0 3 2.5L38 33z" fill="none" ${O}/>`
 +`<g fill="#fff4dc"><rect x="15.6" y="20" width="4.8" height="3.6" rx="1.4"/><rect x="21.6" y="20" width="4.8" height="3.6" rx="1.4"/><rect x="27.6" y="20" width="4.8" height="3.6" rx="1.4"/><rect x="14.6" y="26" width="5.2" height="3.6" rx="1.4"/><rect x="21.4" y="26" width="5.2" height="3.6" rx="1.4"/><rect x="28.2" y="26" width="5.2" height="3.6" rx="1.4"/></g>`
 +`<rect x="5" y="33" width="38" height="11" rx="3" fill="#ffc21a" ${O}/><path d="M18 38.5h12" stroke="${K}" stroke-width="3" stroke-linecap="round"/>`
 +H('M17.5 8h0')+H('M14.5 22.5l1-3.6'),

can:`<path d="${HEART}" fill="#e8384f" ${O}/><path d="M43 17.5c0 8-6 16-19 24-5-3-9-6.2-12-9.5 13 3 24-4 31-14.5z" fill="#b8243a"/><path d="${HEART}" fill="none" ${O}/>`+H('M10.5 17q0-5 5-5.5'),
can_bos:`<path d="${HEART}" fill="#e3dccf" ${O}/><path d="M43 17.5c0 8-6 16-19 24-5-3-9-6.2-12-9.5 13 3 24-4 31-14.5z" fill="#c9bfae"/><path d="${HEART}" fill="none" ${O}/><path d="M24 12.6l-2.6 7 4.6 4-3 6.5" fill="none" stroke="${K}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,

duraklat:`<rect x="10" y="7" width="10.5" height="34" rx="4" fill="#5fb1f0" ${O}/><rect x="27.5" y="7" width="10.5" height="34" rx="4" fill="#5fb1f0" ${O}/><path d="M11.5 31h7.5v6.5q0 2-2 2h-3.5q-2 0-2-2zM29 31h7.5v6.5q0 2-2 2H31q-2 0-2-2z" fill="#3a8fd0"/><rect x="10" y="7" width="10.5" height="34" rx="4" fill="none" ${O}/><rect x="27.5" y="7" width="10.5" height="34" rx="4" fill="none" ${O}/>`+H('M14 12v8')+H('M31.5 12v8'),
oynat:`<path d="M13 9.5q0-4.5 4-2.3l22.5 13.6q4 2.4 0 4.8L17 39.2q-4 2.2-4-2.3z" fill="#3cc45a" ${O}/><path d="M13 30l26.5-5.4q.4 0 .4.6-.4.6-.4.6L17 39.2q-4 2.2-4-2.3z" fill="#2a9a44"/><path d="M13 9.5q0-4.5 4-2.3l22.5 13.6q4 2.4 0 4.8L17 39.2q-4 2.2-4-2.3z" fill="none" ${O}/>`+H('M17.5 13v8'),

ses_acik:SPEAKER+`<path d="M31 17.5q4 6.5 0 13M36 12.5q8 11.5 0 23" fill="none" stroke="${K}" stroke-width="3.4" stroke-linecap="round"/>`,
ses_kapali:SPEAKER+BAND('M31 18l11 12M42 18L31 30','#e5322b',3.6),

muzik:`<path d="M18.5 35V11.5l20-5V30" fill="none" stroke="${K}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/><path d="M18.5 35V11.5l20-5V30" fill="none" stroke="#8c5ad8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M18.5 11.5l20-5v6l-20 5z" fill="#8c5ad8" ${O}/>`
 +`<ellipse cx="13" cy="36" rx="7" ry="5.6" transform="rotate(-18 13 36)" fill="#8c5ad8" ${O}/><ellipse cx="33" cy="31" rx="7" ry="5.6" transform="rotate(-18 33 31)" fill="#8c5ad8" ${O}/>`+H('M9.5 34.5q1.2-2.6 4-3.2')+H('M29.5 29.5q1.2-2.6 4-3.2'),

// çöp kutusu: kapak, tutamak, oluklu gövde
cop:`<path d="M10.5 15.5h27l-2.6 25q-.3 3-3.3 3H16.4q-3 0-3.3-3z" fill="#a7b0b8" ${O}/><path d="M12.9 38.5h22.2l-.2 2q-.3 3-3.3 3H16.4q-3 0-3.3-3z" fill="#7d878f"/><path d="M10.5 15.5h27l-2.6 25q-.3 3-3.3 3H16.4q-3 0-3.3-3z" fill="none" ${O}/>`
 +`<path d="M18.5 21l.8 16.5M24 21v16.5M29.5 21l-.8 16.5" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/>`
 +`<path d="M19.5 9.5V8q0-2.5 2.5-2.5h4q2.5 0 2.5 2.5v1.5" fill="none" ${O}/><rect x="7" y="9.5" width="34" height="6" rx="3" fill="#c9d0d6" ${O}/>`+H('M14 20.5l1.2 12'),

ates:`<path d="M24 44c-9.5 0-15-6-15-14 0-6.5 4-10 6.5-14.5 1 3 2 5 4.2 6C19 15 21.5 8.5 27 4c.2 6.5 4 9.5 7 13 3 3.5 5 7.2 5 12.6C39 38 33.5 44 24 44z" fill="#ff6a2b" ${O}/>`
 +`<path d="M24 44c-5.6 0-9-3.5-9-8.4 0-4.6 3.2-6.8 5-10 .8 2.2 2 3.4 3.4 4 0-4.2 1.6-7 4.6-9.6.4 4 2.6 6 4 8.2 1.4 2.2 2 4 2 7 0 5.2-4 8.8-10 8.8z" fill="#ffc21a" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/><path d="M24.5 44c-2.6 0-4.4-1.6-4.4-4 0-2.6 2-3.6 3-5.6 1 1.6 2.6 2.6 3.6 3.6.8.8 1.8 2 1.8 3 0 1.8-1.8 3-4 3z" fill="#fff4dc"/>`+H('M13.5 28q.5-3 2.5-5.5'),

// kum saati: ahşap başlıklar, cam, akan kum
kumsaati:`<path d="M13 9h22q0 8.5-7 13.5v3q7 5 7 13.5H13q0-8.5 7-13.5v-3Q13 17.5 13 9z" fill="#d9f3ff" ${O}/>`
 +`<path d="M17.5 15.5h13q-2 3.6-5.2 5.2v1.6h-2.6v-1.6q-3.2-1.6-5.2-5.2zM24 25.5v8M15.8 37.5q2-4 8.2-4.6 6.2.6 8.2 4.6z" fill="#f2c230" stroke="#c98500" stroke-width="1.6" stroke-linejoin="round"/>`
 +`<path d="M13 9h22q0 8.5-7 13.5v3q7 5 7 13.5H13q0-8.5 7-13.5v-3Q13 17.5 13 9z" fill="none" ${O}/>`
 +`<rect x="9" y="4" width="30" height="5.5" rx="2.6" fill="#a8702a" ${O}/><rect x="9" y="38.5" width="30" height="5.5" rx="2.6" fill="#a8702a" ${O}/>`+H('M16.5 11.5q.4 3.4 2.6 6')+H('M13 6.5h4',2),

// bahşiş kesesi: bağcıklı çuval, önünde sikke
kese:`<path d="M18 12.5c-9 5-13 13-13 19.5 0 7 5 11.5 12 11.5h14c7 0 12-4.5 12-11.5 0-6.5-4-14.5-13-19.5z" fill="#d9a066" ${O}/><path d="M6 34c.8 5.8 5.6 9.5 11 9.5h14c5.4 0 10.2-3.7 11-9.5-4 4-30 4-36 0z" fill="#b57d45"/><path d="M18 12.5c-9 5-13 13-13 19.5 0 7 5 11.5 12 11.5h14c7 0 12-4.5 12-11.5 0-6.5-4-14.5-13-19.5z" fill="none" ${O}/>`
 +`<path d="M16.5 6.5q3.5 2 7.5 2t7.5-2l-1.5 6.5h-12z" fill="#e8b47c" ${O}/><rect x="13" y="10" width="22" height="6.4" rx="3.2" fill="#e8483b" ${O}/>`
 +`<circle cx="24" cy="30" r="8" fill="#ffc21a" ${O}/><path d="M20.5 28q0-3.2 3.5-3.2t3.5 3.2zM20.2 30h7.6M21 32h6q0 2-2 2h-2q-2 0-2-2z" fill="#d98c00" stroke="#d98c00" stroke-width="1.2" stroke-linejoin="round"/>`+H('M10 28q1.5-6 6-9.5'),

// ızgara: ızgara teli, üstünde köfte, altında alev; ayaklar
izgara:`<path d="M16 34l-5 10M32 34l5 10M24 36v8" stroke="${K}" stroke-width="3" stroke-linecap="round"/>`
 +`<path d="M14.5 13q2-3.5 0-6.5M24 12q2-3.5 0-6.5M33.5 13q2-3.5 0-6.5" fill="none" stroke="#9aa0a6" stroke-width="2.4" stroke-linecap="round"/>`
 +`<rect x="11" y="13.5" width="26" height="9.5" rx="4.7" fill="#6b381c" ${O}/><path d="M15.5 16.4q8.5-1.6 17 0" stroke="#93552f" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M17 20.2h4M25 20.4h6" stroke="#3a1a0a" stroke-width="2" stroke-linecap="round"/>`
 +`<path d="M5 23h38q0 14-19 14T5 23z" fill="#e8483b" ${O}/><path d="M7.5 30.5q16.5 4 33 0Q37 37 24 37T7.5 30.5z" fill="#c4352a"/><path d="M5 23h38q0 14-19 14T5 23z" fill="none" ${O}/>`
 +`<path d="M4 23h40" stroke="${K}" stroke-width="4" stroke-linecap="round"/><path d="M5.5 23h37" stroke="#b8c0c7" stroke-width="1.6" stroke-linecap="round"/>`+H('M10 26.5q1.4 3.4 4.4 5'),

yildiz:`<path d="${STAR}" fill="#ffc21a" ${O}/><path d="M42.3 17.9l-9.2 8.9 2.2 12.6L24 33.4l-11.3 6 1-5.8q9 1.2 18.2-8.8z" fill="#e39a00"/><path d="${STAR}" fill="none" ${O}/>`+H('M18 18.5l2.6-.4 1.8-3.6'),
yildiz_bos:`<path d="${STAR}" fill="#e3dccf" ${O}/><path d="M42.3 17.9l-9.2 8.9 2.2 12.6L24 33.4l-11.3 6 1-5.8q9 1.2 18.2-8.8z" fill="#c9bfae"/><path d="${STAR}" fill="none" ${O}/>`,

kilit:`<path d="M14.5 22v-6.5a9.5 9.5 0 0 1 19 0V22" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round"/><path d="M14.5 22v-6.5a9.5 9.5 0 0 1 19 0V22" fill="none" stroke="#b8c0c7" stroke-width="3.4" stroke-linecap="round"/>`
 +`<rect x="8" y="20" width="32" height="24" rx="5" fill="#ffc21a" ${O}/><path d="M8.5 37h31v2q0 4.5-4.5 4.5H13q-4.5 0-4.5-4.5z" fill="#e39a00"/><rect x="8" y="20" width="32" height="24" rx="5" fill="none" ${O}/>`
 +`<path d="M24 27.5a3.4 3.4 0 0 1 2 6.2l.8 4.3h-5.6l.8-4.3a3.4 3.4 0 0 1 2-6.2z" fill="${K}"/>`+H('M12.5 25.5v6'),

ev:`<rect x="30" y="7.5" width="6.5" height="12" rx="1.2" fill="#a8702a" ${O}/><path d="M9.5 22v18q0 3 3 3h23q3 0 3-3V22" fill="#fff4dc" ${O}/><path d="M10 37h28v3q0 3-3 3H13q-3 0-3-3z" fill="#e9dcc0"/><path d="M9.5 22v18q0 3 3 3h23q3 0 3-3V22" fill="none" ${O}/>`
 +`<path d="M19.5 43V33q0-2.5 2.5-2.5h4q2.5 0 2.5 2.5v10" fill="#a8702a" ${O}/>`
 +`<path d="M4.5 23.5L24 6.5l19.5 17q1.4 1.4 0 2.6-1.2 1-2.6 0L24 11.5 7.1 26.1q-1.4 1-2.6 0-1.4-1.2 0-2.6z" fill="#e8483b" ${O}/>`+H('M9 22.5l7-6'),

tekrar:`<path d="M37.5 26A13.5 13.5 0 1 1 30.5 13" fill="none" stroke="${K}" stroke-width="12" stroke-linecap="round"/><path d="M26.5 4.5l12 6.3-7.6 11.3z" fill="#f08a3c" ${O}/><path d="M37.5 26A13.5 13.5 0 1 1 30.5 13" fill="none" stroke="#f08a3c" stroke-width="6" stroke-linecap="round"/>`+H('M14 22q1-4 4-6.2',2.2),

ileri:`<path d="M7 18.5h15.5V10q0-3 2.4-1.2l16.4 13.2q2.6 2 0 4L24.9 39.2q-2.4 1.8-2.4-1.2v-8.5H7q-2.5 0-2.5-2.5v-6q0-2.5 2.5-2.5z" fill="#3cc45a" ${O}/><path d="M5 26.5h17.5l.5 3H7q-2.5 0-2.5-2.5zM24 33l18-6.5-17.1 12.7q-2.4 1.8-2.4-1.2v-4z" fill="#2a9a44"/><path d="M7 18.5h15.5V10q0-3 2.4-1.2l16.4 13.2q2.6 2 0 4L24.9 39.2q-2.4 1.8-2.4-1.2v-8.5H7q-2.5 0-2.5-2.5v-6q0-2.5 2.5-2.5z" fill="none" ${O}/>`+H('M8 22h9'),

tik:BAND('M9.5 25.5l9 9.5L39 13.5','#3cc45a',7)+H('M11.5 25l5.6 6',2),
carpi:BAND('M12 12l24 24M36 12L12 36','#e5322b',7)+H('M13 15.5l3.4 3.4',2),

gulen:FACE('#f9d1b4','#ff8fa3',`<path d="M14.5 21.5q2.5-3.4 5 0M28.5 21.5q2.5-3.4 5 0" fill="none" stroke="${K}" stroke-width="2.8" stroke-linecap="round"/><path d="M15.5 28h17q0 9-8.5 9t-8.5-9z" fill="#8d2a1e" ${O2}/><path d="M19.5 34q4.5-3 9 0q-2 3-4.5 3t-4.5-3z" fill="#ff7a6a"/>`),
somurtkan:FACE('#f0d0b0','',`<path d="M14 18.5l5.5 1.2M34 18.5l-5.5 1.2" fill="none" stroke="${K}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="18" cy="24" rx="2.2" ry="2.6" fill="${K}"/><ellipse cx="30" cy="24" rx="2.2" ry="2.6" fill="${K}"/><path d="M18 34.5q6-3.4 12 0" fill="none" stroke="${K}" stroke-width="2.8" stroke-linecap="round"/>`),
kizgin:FACE('#f7a487','#e5322b',`<path d="M13 17.5l7.5 4M35 17.5l-7.5 4" fill="none" stroke="${K}" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="18.5" cy="25" rx="2.2" ry="2.4" fill="${K}"/><ellipse cx="29.5" cy="25" rx="2.2" ry="2.4" fill="${K}"/><path d="M16.5 36.5q1-5.5 7.5-5.5t7.5 5.5z" fill="#8d2a1e" ${O2}/><path d="M18 34.6h12" stroke="#fff" stroke-width="1.8"/><path d="M38 5.5l1.4 4.5 4.5-1.4-2 4.2 3.6 2.6" fill="none" stroke="#e5322b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),

// dil: dünya, yanında konuşma balonu
dil:`<circle cx="21" cy="25" r="17" fill="#5fb1f0" ${O}/><path d="M9.5 15.5q5 1 6.5 5.5-2 4 1 7.5-1 5-4.8 7.5M24 8.5q-2.5 4 1.5 6t5.5 6.5-3 7.5-1 10.4" fill="none" stroke="#3a8fd0" stroke-width="2"/>`
 +`<path d="M12.5 13q4 2.5 4 6.5-3.5 2.5-.5 6.5l-4 3.5q-4-3-4.5-8.5 1.4-5 5-8zM22 8.5q5.5-1 10 2.5l-2.5 4.5 4 5q-3.5 4-6.5 1.6-3-3-5.5-7z" fill="#6fca47" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>`
 +`<circle cx="21" cy="25" r="17" fill="none" ${O}/>`
 +`<path d="M29 29q0-4 4-4h7.5q4 0 4 4v5q0 4-4 4h-3.5l-4 4.5v-4.5q-4 0-4-4z" fill="#fff4dc" ${O}/><path d="M33 35.5l3-7.5 3 7.5M34 33h4" fill="none" stroke="${K}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`+H('M9.5 22q1.2-5 4.6-8'),

// el: yukarıyı gösteren işaret parmağı (rehber); beyaz çizgi film eldiveni
el:`<path d="M16 22V9a4.6 4.6 0 0 1 9.2 0v10.5h7.3a5.4 5.4 0 0 1 5.4 5.4V32q0 9-9 9h-7.6q-9 0-9-9v-5q0-4 3.7-5z" fill="#fff" ${O}/><path d="M12.6 35q1.6 6 8.4 6h7.6q8.2 0 8.9-7.6-12.6 3.6-24.9 1.6z" fill="#e3dccf"/><path d="M16 22V9a4.6 4.6 0 0 1 9.2 0v10.5h7.3a5.4 5.4 0 0 1 5.4 5.4V32q0 9-9 9h-7.6q-9 0-9-9v-5q0-4 3.7-5z" fill="none" ${O}/>`
 +`<path d="M25.2 19.5v5.5M25.2 26.5h12.6M26.5 32.6h11.2M12.6 28.6q6.4-1 9.4 1.6 1.6 1.4 3.6 1.4" fill="none" stroke="${K}" stroke-width="2.3" stroke-linecap="round"/>`
 +`<rect x="13.5" y="40.5" width="23" height="5.5" rx="2" fill="#e8483b" ${O}/>`+H('M19.3 10v8',2.4),

'artı':`<path d="M19 6.5h10q2 0 2 2V17h8.5q2 0 2 2v10q0 2-2 2H31v8.5q0 2-2 2H19q-2 0-2-2V31H8.5q-2 0-2-2V19q0-2 2-2H17V8.5q0-2 2-2z" fill="#3cc45a" ${O}/><path d="M7 26.5h34v2.5q0 2-2 2h-8v8.5q0 2-2 2h-8q-2 0-2-2V31H9q-2 0-2-2z" fill="#2a9a44"/><path d="M19 6.5h10q2 0 2 2V17h8.5q2 0 2 2v10q0 2-2 2H31v8.5q0 2-2 2H19q-2 0-2-2V31H8.5q-2 0-2-2V19q0-2 2-2H17V8.5q0-2 2-2z" fill="none" ${O}/>`+H('M20.5 11v6')+H('M11 21h4')
};
S.arti=S['artı']; // ASCII yazımı da çalışsın

const ADLAR=['para','kasa','can','can_bos','duraklat','oynat','ses_acik','ses_kapali','muzik','cop','ates','kumsaati','kese','izgara','yildiz','yildiz_bos','kilit','ev','tekrar','ileri','tik','carpi','gulen','somurtkan','kizgin','dil','el','artı'];

function svg(ad,sinif=''){
  const ic=S[ad]||'';
  return `<svg class="ic${sinif?' '+sinif:''}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${ic}</svg>`;
}
BU.SIMGE={svg,ADLAR};
})();
