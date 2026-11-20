/* Burger Ustası: burger çizimi (BU.BURGER). DOM'a dokunmaz, HTML metni döndürür.
   - KATMAN: yandan görünen katmanlar, 200 birim genişlik. Her biri {h: yükseklik, bin: alttaki katmanın üstüne binme payı, sik: sıkışınca saklanabilecek en çok pay oranı, svg}.
   - yigin(katmanlar,{gen,yukMax,yeni}): tabaktaki yığın. Katmanlar alttan üste mutlak konumla dizilir; yükseklik yukMax'ı aşarsa önce dolgular daha çok biner, yetmezse bütün burger orantılı küçülür. Asla yukMax'ı aşmaz.
   - siparis(katmanlar,{gen}): baloncuk içi simge ızgarası. Ekmek tek simge (alt+üst), aynı malzeme birden çoksa tek simge + "×2" rozeti. Hücreler sabit oranlı, asla üst üste binmez, genişlik gen'i aşmaz.
   - simge(k): malzeme görseli (<img>). Görsellerin yolu BU.BURGER.YOL (varsayılan 'g/').
   - CSS: oyunun bir <style>'a koyacağı metin. Bütün sınıflar 'bu-' önekli. */
(function(){
'use strict';
const G=typeof window!=='undefined'?window:globalThis;
const BU=G.BU=G.BU||{};
const K='#3a1d0c';   // çizgi rengi (g/*.svg ile aynı)
const O=`stroke="${K}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const L=(d,c,w=4)=>`<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

// h: kutu yüksekliği; bin: alttaki katmana binme (kutu üst/alt boşlukları dahil); sik: sıkışmada görünen kısmın en çok ne kadarı saklanabilir
const KATMAN={
 bunBot:{h:48,bin:0,sik:0,svg:
  `<path d="M10 8h180q7 0 7 7 0 29-34 29H37Q3 44 3 15q0-7 7-7z" fill="#f4c676" ${O}/>`+
  L('M22 36q8 4 20 4h116q12 0 20-4','#d99a48',5)+L('M16 15h168','#fde6b4',5)},
 patty:{h:46,bin:12,sik:.5,svg:
  `<path d="M22 6h156q20 0 20 17t-20 17H22Q2 40 2 23T22 6z" fill="#6b381c" ${O}/>`+
  L('M14 30q8 6 22 6h128q14 0 22-6','#4a2410',5)+L('M28 14q72-7 144 0','#93552f',5)+
  L('M40 24l14-4M86 25l18-5M138 24l14-4','#3a1a0a',4)},
 cheese:{h:40,bin:22,sik:.45,svg:
  `<path d="M1 6h198v8q0 6-6 6h-12q-4 0-4 6v4q0 7-7 7t-7-7v-4q0-6-5-6h-34q-5 0-5 5 0 10-8 10t-8-10q0-5-5-5H50q-5 0-5 6t-7 6-7-6-5-6H7q-6 0-6-6z" fill="#ffd21f" ${O}/>`+
  L('M12 11h176','#fff0a0',3)},
 lettuce:{h:32,bin:14,sik:.45,svg:
  `<path d="M2 11q13-10 25 0t24 0 24 0 25 0 24 0 24 0 25 0 25 0v8q-6 12-16 6-8 10-20 2-10 9-22 0-12 8-24 0-12 9-24 0-12 8-24 0-10 8-20-2-10 6-17-6z" fill="#6fca47" ${O}/>`+
  L('M14 12q7-5 13 0M62 12q7-5 13 0M111 12q7-5 13 0M160 12q7-5 13 0','#b5ee8c',3)+L('M40 22q8 3 16 0M120 22q8 3 16 0','#3f9a26',3)},
 tomato:{h:28,bin:12,sik:.45,svg:
  `<rect x="6" y="5" width="92" height="18" rx="9" fill="#ee4a32" ${O}/><rect x="102" y="5" width="92" height="18" rx="9" fill="#ee4a32" ${O}/>`+
  L('M18 11h40M114 11h40','#ff9a80',3)+
  `<g fill="#ffd36b"><ellipse cx="70" cy="15" rx="4" ry="2.4"/><ellipse cx="84" cy="15" rx="4" ry="2.4"/><ellipse cx="166" cy="15" rx="4" ry="2.4"/><ellipse cx="180" cy="15" rx="4" ry="2.4"/></g>`},
 onion:{h:24,bin:10,sik:.45,svg:
  `<g fill="#fbf3ff" stroke="#9b4fd0" stroke-width="5"><rect x="6" y="5" width="66" height="14" rx="7"/><rect x="128" y="5" width="66" height="14" rx="7"/><rect x="64" y="5" width="72" height="14" rx="7"/></g>`+
  L('M80 12h40M18 12h20M150 12h30','#c99be8',3)},
 bacon:{h:30,bin:12,sik:.45,svg:
  `<path d="M2 10q16-10 33 0t33 0 32 0 32 0 33 0 33 0v10q-16 10-33 0t-33 0-32 0-32 0-33 0-33 0z" fill="#b8321f" ${O}/>`+
  L('M12 15q12-8 23 0t33 0 32 0 32 0 33 0 23 0','#f3b0a0',4)},
 egg:{h:36,bin:13,sik:.4,svg:
  `<path d="M8 22q0-11 15-11h20q8-7 20-4 6-3 14 0h46q10-4 18 0h34q17 0 17 12 0 12-17 12H23Q8 31 8 22z" fill="#fff" ${O}/>`+
  `<path d="M74 16q0-13 26-13t26 13z" fill="#ffb21f" ${O}/>`+L('M88 9q8-3 14-2','#ffe08a',3)+L('M22 18h20M140 18h24','#eee6dc',3)},
 pickle:{h:26,bin:11,sik:.45,svg:
  `<g fill="#5c9e2e" ${O}><rect x="8" y="5" width="56" height="16" rx="8"/><rect x="72" y="5" width="56" height="16" rx="8"/><rect x="136" y="5" width="56" height="16" rx="8"/></g>`+
  L('M18 11h26M82 11h26M146 11h26','#9fd66a',3)+
  `<g fill="#3e7a1c"><circle cx="52" cy="15" r="2"/><circle cx="116" cy="15" r="2"/><circle cx="180" cy="15" r="2"/></g>`},
 bunTop:{h:84,bin:16,sik:.15,svg:
  `<path d="M5 74Q5 6 100 6t95 68q0 6-6 6H11q-6 0-6-6z" fill="#f4c676" ${O}/>`+
  L('M14 70h172','#d99a48',5)+L('M30 44Q44 18 84 14','#fde6b4',6)+
  `<g fill="#fffaf0" stroke="${K}" stroke-width="2.5"><ellipse cx="70" cy="34" rx="7" ry="4" transform="rotate(-20 70 34)"/><ellipse cx="108" cy="24" rx="7" ry="4"/><ellipse cx="142" cy="40" rx="7" ry="4" transform="rotate(25 142 40)"/><ellipse cx="96" cy="50" rx="7" ry="4" transform="rotate(10 96 50)"/><ellipse cx="50" cy="56" rx="7" ry="4" transform="rotate(-30 50 56)"/><ellipse cx="160" cy="58" rx="7" ry="4" transform="rotate(30 160 58)"/><ellipse cx="124" cy="60" rx="7" ry="4" transform="rotate(-8 124 60)"/></g>`}
};
KATMAN.bun=KATMAN.bunBot;

// '28cqw' → {n:28,u:'cqw'}; 120 → {n:120,u:'px'}
const olc=v=>{if(typeof v==='number')return {n:v,u:'px'};const m=/^\s*(-?[\d.]+)\s*([a-z%]*)\s*$/i.exec(String(v||''));return m?{n:+m[1],u:m[2]||'px'}:null};
const yaz=(n,u)=>+n.toFixed(3)+u;

// konumlar: s = sıkışma (0..1), her katmanın alt kenarının yüksekliği (birim) ve toplam yükseklik
function yerles(ks,s){const y=[];let ust=0;
  ks.forEach((k,i)=>{const d=KATMAN[k]||KATMAN.patty;let b=0;
    if(i>0){const once=KATMAN[ks[i-1]]||KATMAN.patty;b=d.bin+s*d.sik*(d.h-d.bin);b=Math.min(b,once.h-6)}   // alttakinin içine en çok kendi boyu kadar
    const a=Math.max(0,ust-b);y.push(a);ust=Math.max(ust,a+d.h)});
  return {y,H:ust}}

function yigin(ks,o={}){
  ks=(ks||[]).filter(k=>KATMAN[k]);const g=olc(o.gen!=null?o.gen:200),ym=o.yukMax!=null?olc(o.yukMax):null;
  if(!ks.length)return `<div class="bu-yigin bu-bos" style="width:${yaz(g.n,g.u)};height:0"></div>`;
  let s=0,p=yerles(ks,0),olcek=1,genS,yukS;
  if(ym&&ym.u===g.u){const butce=200*ym.n/g.n;   // yukMax, 200 birimlik genişlikte kaç birim eder
    if(p.H>butce){let lo=0,hi=1;const tam=yerles(ks,1);
      if(tam.H>butce){s=1;p=tam;olcek=butce/p.H}
      else{for(let i=0;i<18;i++){const m=(lo+hi)/2;if(yerles(ks,m).H>butce)lo=m;else hi=m}s=hi;p=yerles(ks,s)}}
    genS=yaz(g.n*olcek,g.u);yukS=yaz(g.n*olcek*p.H/200,g.u)}
  else if(ym){p=yerles(ks,.6);genS=`min(${yaz(g.n,g.u)},calc(${yaz(ym.n,ym.u)} * ${+(200/p.H).toFixed(4)}))`;yukS='auto'}   // birimler farklı: CSS min()
  else{genS=yaz(g.n,g.u);yukS=yaz(g.n*p.H/200,g.u)}
  const son=ks.length-1,yeni=o.yeni!==false;
  return `<div class="bu-yigin" data-n="${ks.length}" style="width:${genS};height:${yukS};aspect-ratio:200/${+p.H.toFixed(2)}">`+
    ks.map((k,i)=>{const d=KATMAN[k];
      return `<span class="bu-ly bu-${k}${yeni&&i===son?' bu-yeni':''}" style="bottom:${+(100*p.y[i]/p.H).toFixed(3)}%;height:${+(100*d.h/p.H).toFixed(3)}%"><svg viewBox="0 0 200 ${d.h}" preserveAspectRatio="none" aria-hidden="true">${d.svg}</svg></span>`}).join('')+'</div>'}

// ---- simgeler ----
const SVGI={bun:1,cheese:1,patty:1,raw:1};
const ANA=k=>k==='bunBot'||k==='bunTop'?'bun':k;
function simge(k,sinif=''){k=ANA(k);const B=BU.BURGER.YOL;return `<img class="bu-simge${sinif?' '+sinif:''}" src="${B}${k}${SVGI[k]?'.svg':'.webp'}" alt="" draggable="false">`}

// sipariş: ekmek (tek simge) + ortadakiler, aynı malzeme gruplanır (×N rozeti). Sıra: ilk görülüş sırası
function grupla(ks){const ad=[],n={};const ekle=k=>{if(!n[k]){n[k]=0;ad.push(k)}n[k]++};
  ks=ks||[];const ekmek=ks.some(k=>k==='bunBot'||k==='bunTop'||k==='bun');if(ekmek)ekle('bun');
  ks.forEach(k=>{if(k!=='bunBot'&&k!=='bunTop'&&k!=='bun')ekle(k)});
  if(ekmek)n.bun=1;return ad.map(k=>({k,n:n[k]}))}
// kaç sütun: hücre en çok gen/3, yükseklik en çok gen×0,75 kalsın
const SUTUN=n=>n<=3?n:n===4?2:n<=6?3:4;
const rozet=n=>`<svg class="bu-rozet" viewBox="0 0 40 28" aria-hidden="true"><rect x="2" y="2" width="36" height="24" rx="12" fill="#e5322b" stroke="${K}" stroke-width="3"/><text x="20" y="21" text-anchor="middle" font-size="19" font-weight="900" fill="#fff" font-family="inherit">×${n}</text></svg>`;
function siparis(ks,o={}){
  const gr=grupla(ks),c=Math.max(1,SUTUN(gr.length)),hu=100/Math.max(c,3),g=olc(o.gen!=null?o.gen:'100%'),sin=o.sinif?' '+o.sinif:'';
  const al=o.alindi||{};   // isteğe bağlı: {anahtar:sayı} zaten konmuş olanlar (soluk)
  return `<div class="bu-siparis${sin}" data-n="${gr.length}" style="width:${yaz(g.n,g.u)}"><div class="bu-izgara" style="width:${+(hu*c).toFixed(3)}%">`+
    gr.map(x=>`<span class="bu-hucre${al[x.k]>=x.n?' bu-tamam':''}" data-k="${x.k}" style="width:${+(100/c).toFixed(4)}%">${simge(x.k)}${x.n>1?rozet(x.n):''}</span>`).join('')+'</div></div>'}

const CSS=`
.bu-yigin{position:relative;display:block;margin-inline:auto;max-width:100%;pointer-events:none}
.bu-yigin.bu-bos{aspect-ratio:auto}
.bu-yigin .bu-ly{position:absolute;left:0;width:100%;display:block}
.bu-yigin .bu-ly svg{display:block;width:100%;height:100%;overflow:visible}
.bu-yigin .bu-yeni{animation:bu-dus .26s cubic-bezier(.2,1.4,.4,1) both}
@keyframes bu-dus{0%{transform:translateY(-160%);opacity:.2}60%{opacity:1}100%{transform:translateY(0)}}
.bu-siparis{display:block;max-width:100%;box-sizing:border-box}
.bu-siparis .bu-izgara{display:flex;flex-wrap:wrap;justify-content:center;margin-inline:auto}
.bu-siparis .bu-hucre{position:relative;display:block;box-sizing:border-box;aspect-ratio:1;padding:0}
.bu-siparis .bu-simge{display:block;width:96%;height:96%;margin:2%;object-fit:contain}
.bu-siparis .bu-rozet{position:absolute;right:0;bottom:0;width:64%;height:auto;overflow:visible}
.bu-siparis .bu-tamam .bu-simge{opacity:.28;filter:grayscale(.6)}
img.bu-simge{-webkit-user-drag:none;user-select:none}
@media (prefers-reduced-motion:reduce){.bu-yigin .bu-yeni{animation:none}}
`;

BU.BURGER={KATMAN,yigin,siparis,simge,grupla,CSS,YOL:'g/'};
if(typeof module!=='undefined')module.exports=BU.BURGER;
})();
