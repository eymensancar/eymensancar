/* Burger Ustası: burger çizimi (BU.BURGER). DOM'a dokunmaz, HTML metni döndürür.
   - KATMAN: yandan görünen katmanlar, 200 birim genişlik. Her biri {h: yükseklik, bin: alttaki katmanın üstüne binme payı, sik: sıkışınca saklanabilecek en çok pay oranı, svg}.
   - yigin(katmanlar,{gen,yukMax,yeni}): tabaktaki yığın. Katmanlar alttan üste mutlak konumla dizilir; yükseklik yukMax'ı aşarsa önce dolgular daha çok biner, yetmezse bütün burger orantılı küçülür. Asla yukMax'ı aşmaz.
   - siparis(katmanlar,{gen}): baloncuk içi simge ızgarası. Ekmek tek simge (alt+üst), aynı malzeme birden çoksa tek simge + "×2" rozeti. Hücreler sabit oranlı, asla üst üste binmez, genişlik gen'i aşmaz.
   - simge(k): malzeme görseli (<img>), src(k): yalnız yolu. Hepsi kendi SVG'miz g/s-<k>.svg. Görsellerin yolu BU.BURGER.YOL (varsayılan 'g/').
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
 tomato:{h:34,bin:8,sik:.45,svg:
  `<rect x="6" y="5" width="92" height="24" rx="11" fill="#ee4a32" ${O}/><rect x="102" y="5" width="92" height="24" rx="11" fill="#ee4a32" ${O}/>`+
  L('M18 12h40M114 12h40','#ff9a80',4)+
  `<g fill="#ffd36b"><ellipse cx="70" cy="19" rx="4.5" ry="3"/><ellipse cx="84" cy="19" rx="4.5" ry="3"/><ellipse cx="166" cy="19" rx="4.5" ry="3"/><ellipse cx="180" cy="19" rx="4.5" ry="3"/></g>`},
 onion:{h:30,bin:7,sik:.45,svg:
  `<g fill="#fbf3ff" stroke="#9b4fd0" stroke-width="5"><rect x="6" y="5" width="66" height="20" rx="10"/><rect x="128" y="5" width="66" height="20" rx="10"/><rect x="64" y="5" width="72" height="20" rx="10"/></g>`+
  L('M80 13h40M18 13h20M150 13h30','#c99be8',4)},
 bacon:{h:30,bin:12,sik:.45,svg:
  `<path d="M2 10q16-10 33 0t33 0 32 0 32 0 33 0 33 0v10q-16 10-33 0t-33 0-32 0-32 0-33 0-33 0z" fill="#b8321f" ${O}/>`+
  L('M12 15q12-8 23 0t33 0 32 0 32 0 33 0 23 0','#f3b0a0',4)},
 egg:{h:36,bin:8,sik:.4,svg:
  `<path d="M8 22q0-11 15-11h20q8-7 20-4 6-3 14 0h46q10-4 18 0h34q17 0 17 12 0 12-17 12H23Q8 31 8 22z" fill="#fff" ${O}/>`+
  `<path d="M74 16q0-13 26-13t26 13z" fill="#ffb21f" ${O}/>`+L('M88 9q8-3 14-2','#ffe08a',3)+L('M22 18h20M140 18h24','#eee6dc',3)},
 pickle:{h:32,bin:8,sik:.45,svg:
  `<g fill="#5c9e2e" ${O}><rect x="8" y="5" width="56" height="22" rx="11"/><rect x="72" y="5" width="56" height="22" rx="11"/><rect x="136" y="5" width="56" height="22" rx="11"/></g>`+
  L('M18 12h26M82 12h26M146 12h26','#9fd66a',4)+
  `<g fill="#3e7a1c"><circle cx="50" cy="19" r="2.4"/><circle cx="56" cy="15" r="2"/><circle cx="114" cy="19" r="2.4"/><circle cx="120" cy="15" r="2"/><circle cx="178" cy="19" r="2.4"/><circle cx="184" cy="15" r="2"/></g>`},
 // ---- 2. tur malzemeleri ----
 sauce:{h:36,bin:14,sik:.4,svg:
  `<path d="M8 13Q8 5 18 5Q40 9 62 6T110 6 156 6 182 5Q192 5 192 13Q192 21 184 21H172Q166 21 166 26Q166 33 158 33Q150 33 150 26Q150 21 144 21H114Q108 21 108 27Q108 34 100 34Q92 34 92 27Q92 21 86 21H60Q54 21 54 25Q54 30 47 30Q40 30 40 25Q40 21 34 21H16Q8 21 8 13Z" fill="#e0321f" ${O}/>`+
  L('M20 11q22 2 44 0M116 11q20 1 40-1','#ff9a80',4)},
 mushroom:{h:30,bin:10,sik:.45,svg:
  [2,49,96,143].map(x=>`<path d="M${x} 26Q${x} 4 ${x+28} 4Q${x+56} 4 ${x+56} 26Z" fill="#f3e2c6" ${O}/>`+L(`M${x+7} 22Q${x+8} 10 ${x+28} 10Q${x+48} 10 ${x+49} 22`,'#9a6236',5)+`<path d="M${x} 26Q${x} 4 ${x+28} 4Q${x+56} 4 ${x+56} 26Z" fill="none" ${O}/>`).join('')+
  L('M14 15q4-5 10-6M108 15q4-5 10-6','#fffaf0',3)},
 jalapeno:{h:26,bin:9,sik:.45,svg:
  [27,75,125,173].map(x=>`<ellipse cx="${x}" cy="13" rx="23" ry="9" fill="#2f8f2a" ${O}/><ellipse cx="${x}" cy="13" rx="12" ry="4.2" fill="#d8ef9a" stroke="#1f6a1b" stroke-width="2"/><ellipse cx="${x}" cy="13" rx="5" ry="1.8" fill="#2f8f2a"/>`).join('')+
  L('M12 9q6-3 12-3M110 9q6-3 12-3','#a6e07a',3)},
 onionring:{h:38,bin:10,sik:.35,svg:
  `<path d="M14 7q9-5 18 0t18 0 18 0 18 0 18 0 18 0 18 0 18 0 18 0q12 0 12 12 0 12-12 12q-9 5-18 0t-18 0-18 0-18 0-18 0-18 0-18 0-18 0-18 0Q2 31 2 19 2 7 14 7Z" fill="#e3922a" ${O}/>`+L('M12 26q9 4 18 0t18 0 18 0 18 0 18 0 18 0 18 0 18 0 18 0','#b9661a',4)+
  `<g fill="#b8661c"><rect x="28" y="14" width="5" height="4" rx="1"/><rect x="70" y="22" width="5" height="4" rx="1"/><rect x="112" y="13" width="5" height="4" rx="1"/><rect x="150" y="22" width="5" height="4" rx="1"/><rect x="178" y="15" width="5" height="4" rx="1"/></g>`+
  `<g fill="#f8d27a"><rect x="48" y="21" width="5" height="4" rx="1"/><rect x="92" y="18" width="5" height="4" rx="1"/><rect x="132" y="22" width="5" height="4" rx="1"/><rect x="18" y="22" width="5" height="4" rx="1"/></g>`+
  L('M20 13h40M120 12h30','#ffe2a0',4)},
 avocado:{h:28,bin:10,sik:.45,svg:
  [2,50,98,146].map(x=>`<path d="M${x} 22Q${x+20} 2 ${x+54} 7Q${x+44} 24 ${x} 22Z" fill="#d6e98a" ${O}/>`+L(`M${x+6} 17Q${x+22} 5 ${x+50} 8`,'#3e6e1e',5)).join('')+
  L('M14 20q12-3 26-4M110 20q12-3 26-4','#f3f9cf',3)},
 premium:{h:52,bin:12,sik:.5,svg:
  `<path d="M22 10h156q20 0 20 18t-20 18H22Q2 46 2 28T22 10z" fill="#8c4426" ${O}/>`+
  L('M14 34q8 6 22 6h128q14 0 22-6','#5a2a14',5)+L('M24 24q10 3 20 0M58 30q12 3 22-1M96 22q10 4 22 0M132 30q10 3 22 0M162 22q8 3 16 0','#e0a892',3.5)+
  `<g fill="#ffcf33" stroke="${K}" stroke-width="3" stroke-linejoin="round"><path d="M64 12l14-9 18 3-3 9-20 4z"/><path d="M118 11l10-7 14 4-4 7-14 1z"/><path d="M160 14l8-6 10 4-4 6z"/><path d="M28 14l8-5 9 4-5 5z"/></g>`+
  L('M70 9l18-3M124 8l10-2','#fff6b0',3)+
  `<path d="M186 -2q1.5 6 7 7.5q-5.5 1.5-7 7.5q-1.5-6-7-7.5q5.5-1.5 7-7.5z" fill="#fff7c2" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>`},
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
// s<0: gevşeme (yer artınca binme azalır, s=-1'de binmenin %40'ı kalır)
function yerles(ks,s){const y=[];let ust=0;
  ks.forEach((k,i)=>{const d=KATMAN[k]||KATMAN.patty;let b=0;
    if(i>0){const once=KATMAN[ks[i-1]]||KATMAN.patty;b=s<0?d.bin*(1+.6*s):d.bin+s*d.sik*(d.h-d.bin);b=Math.min(b,once.h-13)}   // alttakinin üstünden en az ~8 birim görünsün
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
    else if(ks.length>2){const gev=yerles(ks,-1);   // yer bol: bindirmeyi azalt, yığın kalan yüksekliğe yayılsın
      if(gev.H<=butce){s=-1;p=gev}else{let lo=-1,hi=0;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(yerles(ks,m).H>butce)lo=m;else hi=m}s=hi;p=yerles(ks,s)}}
    genS=yaz(g.n*olcek,g.u);yukS=yaz(g.n*olcek*p.H/200,g.u)}
  else if(ym){p=yerles(ks,.6);genS=`min(${yaz(g.n,g.u)},calc(${yaz(ym.n,ym.u)} * ${+(200/p.H).toFixed(4)}))`;yukS='auto'}   // birimler farklı: CSS min()
  else{genS=yaz(g.n,g.u);yukS=yaz(g.n*p.H/200,g.u)}
  const son=ks.length-1,yeni=o.yeni!==false;
  return `<div class="bu-yigin" data-n="${ks.length}" style="width:${genS};height:${yukS};aspect-ratio:200/${+p.H.toFixed(2)}">`+
    ks.map((k,i)=>{const d=KATMAN[k];
      return `<span class="bu-ly bu-${k}${yeni&&i===son?' bu-yeni':''}" style="bottom:${+(100*p.y[i]/p.H).toFixed(3)}%;height:${+(100*d.h/p.H).toFixed(3)}%"><svg viewBox="0 0 200 ${d.h}" preserveAspectRatio="none" aria-hidden="true">${d.svg}</svg></span>`}).join('')+'</div>'}

// ---- simgeler ----
// bütün malzemeler kendi çizimimiz: g/s-<k>.svg (KATMAN biçemi). Listede olmayan anahtar eski dosyaya düşer (raw.svg vb.).
const SIM={bun:1,patty:1,cheese:1,lettuce:1,tomato:1,onion:1,bacon:1,egg:1,pickle:1,sauce:1,mushroom:1,jalapeno:1,onionring:1,avocado:1,premium:1};
const ESKI={raw:'raw.svg'};
const ANA=k=>k==='bunBot'||k==='bunTop'?'bun':k;
const src=k=>{k=ANA(k);return BU.BURGER.YOL+(SIM[k]?'s-'+k+'.svg':ESKI[k]||k+'.webp')};
function simge(k,sinif=''){return `<img class="bu-simge${sinif?' '+sinif:''}" src="${src(k)}" alt="" draggable="false">`}

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
.bu-siparis .bu-hucre{position:relative;display:block;box-sizing:border-box;aspect-ratio:1;padding:0;overflow:visible}
.bu-siparis .bu-simge{display:block;width:96%;height:96%;margin:2%;object-fit:contain}
.bu-siparis .bu-rozet{position:absolute;right:-10%;bottom:-8%;width:46%;height:auto;overflow:visible}
.bu-siparis .bu-tamam .bu-simge{opacity:.28;filter:grayscale(.6)}
img.bu-simge{-webkit-user-drag:none;user-select:none}
@media (prefers-reduced-motion:reduce){.bu-yigin .bu-yeni{animation:none}}
`;

BU.BURGER={KATMAN,yigin,siparis,simge,src,grupla,CSS,YOL:'g/'};
if(typeof module!=='undefined')module.exports=BU.BURGER;
})();
