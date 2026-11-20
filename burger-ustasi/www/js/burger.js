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
 // soğan halkası burgere konmaz (yalnız yan ürün: yan('onionring',…), simgesi g/s-onionring.svg)
 mayo:{h:34,bin:14,sik:.4,svg:
  `<path d="M8 13Q8 5 18 5Q36 9 56 6T104 7 150 5 182 5Q192 5 192 13Q192 20 184 20H160Q153 20 153 25Q153 31 146 31Q139 31 139 25Q139 20 133 20H98Q92 20 92 26Q92 33 84 33Q76 33 76 26Q76 20 70 20H44Q38 20 38 24Q38 28 32 28Q26 28 26 24Q26 20 20 20H16Q8 20 8 13Z" fill="#fff3d2" ${O}/>`+
  L('M20 15q40 3 80 1t74-1','#ead198',3.5)+L('M20 10q22 2 44 0M112 10q22 1 44-1','#ffffff',4)},
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
const SIM={bun:1,patty:1,cheese:1,lettuce:1,tomato:1,onion:1,bacon:1,egg:1,pickle:1,sauce:1,mayo:1,mushroom:1,jalapeno:1,onionring:1,avocado:1,premium:1,fries:1};
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
// o.yan: ['fries','onionring',…] yan ürünler; burger ızgarasının sağında ince ayraçla ayrılmış ayrı hücre(ler). Aynı yan ürün ×N rozetiyle.
// Yan ürünler: burger satırı yan ürün sayısından azsa yan yana, değilse alt alta (tek sütun). Toplam genişlik yine gen'i aşmaz.
function siparis(ks,o={}){
  const gr=grupla(ks),g=olc(o.gen!=null?o.gen:'100%'),sin=o.sinif?' '+o.sinif:'';
  const al=o.alindi||{};   // isteğe bağlı: {anahtar:sayı} zaten konmuş/verilmiş olanlar (soluk); yan ürünler de aynı nesnede
  const yg=[];(o.yan||[]).forEach(k=>{const v=yg.find(x=>x.k===k);if(v)v.n++;else yg.push({k,n:1})});
  const c=gr.length?Math.max(1,SUTUN(gr.length)):0,sat=c?Math.ceil(gr.length/c):0;
  const yc=yg.length?(sat>=yg.length?1:yg.length):0,ay=c&&yc?.34:0,T=c+yc+ay,hu=100/Math.max(T,3);
  const hucre=(x,w,ek='')=>`<span class="bu-hucre${ek}${al[x.k]>=x.n?' bu-tamam':''}" data-k="${x.k}" style="width:${+w.toFixed(4)}%">${simge(x.k)}${x.n>1?rozet(x.n):''}</span>`;
  const izg=c?`<div class="bu-izgara" style="width:${+(hu*c).toFixed(3)}%">`+gr.map(x=>hucre(x,100/c)).join('')+'</div>':'';
  if(!yc)return `<div class="bu-siparis${sin}" data-n="${gr.length}" style="width:${yaz(g.n,g.u)}">${izg}</div>`;
  return `<div class="bu-siparis bu-yanli${sin}" data-n="${gr.length}" data-yan="${yg.length}" style="width:${yaz(g.n,g.u)}"><div class="bu-sira">${izg}`+
    (ay?`<i class="bu-ayrac" style="width:${+(hu*ay).toFixed(3)}%"></i>`:'')+
    `<div class="bu-yanlar" style="width:${+(hu*yc).toFixed(3)}%">`+yg.map(x=>hucre(x,100/yc,' bu-yanh')).join('')+'</div></div></div>'}

// =====================================================================
// MUTFAK PARÇALARI (5. tur): küvet içleri, ekmek dolabı, sos kâseleri, yan ürünler.
// Hepsi tam bir <svg> metni döndürür; şeffaf zemin, sabit viewBox. Son parametre o (isteğe bağlı):
//   {x,y,w,h} → bir dış SVG'nin içine gömülecekse konum/boyut özniteliği olur; yoksa width/height %100.
//   {sinif}   → ek sınıf.
// Her çağrı kendi defs kimliklerini üretir (bu-m<N>…), aynı sayfada çok kopya çakışmaz.
// =====================================================================
let UID=0;
const f1=n=>+(+n).toFixed(1);
const SW=2.6,OK=`stroke="${K}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;
const Ls=(d,c,w=2.4,ek='')=>`<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"${ek}/>`;
const tohum=s=>{let a=0;for(const ch of String(s))a=(a*31+ch.charCodeAt(0))>>>0;a=a||1;
  return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}};
const koyu=(h,f)=>{if(f===1)return h;const n=parseInt(h.slice(1),16);
  return '#'+[n>>16,n>>8&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(v*f))).toString(16).padStart(2,'0')).join('')};
// yumuşak kapalı eğri: noktaların orta noktalarından geçen ikinci derece Bézier
function yumusak(p){const n=p.length,m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let s=m(p[n-1],p[0]),d=`M${f1(s[0])} ${f1(s[1])}`;
  for(let i=0;i<n;i++){const c=p[i],e=m(p[i],p[(i+1)%n]);d+=`Q${f1(c[0])} ${f1(c[1])} ${f1(e[0])} ${f1(e[1])}`}return d+'Z'}
function obek(rx,ry,n,jit,r,don=0,kat=0){const p=[];for(let i=0;i<n;i++){const a=don+i*2*Math.PI/n,k=1+(r()-.5)*jit-(i%2?kat:0);p.push([Math.cos(a)*rx*k,Math.sin(a)*ry*k])}return yumusak(p)}
const kutu=(o,vb,sinif)=>{o=o||{};const yer=o.w!=null?` x="${o.x||0}" y="${o.y||0}" width="${o.w}" height="${o.h}"`:' width="100%" height="100%"';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="bu-ciz ${sinif}${o.sinif?' '+o.sinif:''}" viewBox="${vb}"${yer} aria-hidden="true">`};
// üstten bakış: parça yerel koordinatta (daire gibi) çizilir, sonra eğik bakış için y'de basılır
const P=.74;
const yer=(x,y,a,ic,sy=P)=>`<g transform="translate(${f1(x)} ${f1(y)}) scale(1 ${sy}) rotate(${f1(a)})">${ic}</g>`;
// küvete dağıt: sıralar arkadan öne (öndekiler biraz büyük), kenara taşmayacak biçimde sıkıştırılır
function dagit(r,{x0=16,x1=184,y0=18,y1=102,dx=30,dy=20,boy=14,jx=.32,jy=.28,ex=1,ey=P}){
  const out=[];let sira=0;
  for(let y=y0;y<=y1+.01;y+=dy,sira++){const kay=sira%2?dx/2:0;
    for(let x=x0-kay;x<=x1+dx*.5;x+=dx){const t=(y-y0)/Math.max(1,y1-y0),s=boy*(.86+.28*t)*(.9+.2*r());
      let px=x+(r()-.5)*2*jx*dx,py=y+(r()-.5)*2*jy*dy;const hx=s*ex+2,hy=s*ey+2;
      px=Math.max(4+hx,Math.min(196-hx,px));py=Math.max(5+hy,Math.min(115-hy,py));out.push({x:px,y:py,s,a:r()*360,d:1})}}
  return out.sort((a,b)=>a.y-b.y)}
// iki kat: alttaki kat koyu (derinlik), üstteki normal
const ikiKat=(r,ayar,ciz)=>{const alt=dagit(r,Object.assign({},ayar,{y0:(ayar.y0||18)-4})).map(p=>Object.assign(p,{d:.74}));
  const ust=dagit(r,Object.assign({},ayar,{y0:(ayar.y0||18)+ (ayar.dy||20)/2,y1:(ayar.y1||102)}));
  return alt.map(p=>ciz(p,r)).join('')+ust.map(p=>ciz(p,r)).join('')};
// küvet tabanını kapatan koyu yığın (aralıklardan çelik görünmesin)
const taban=(c,r)=>`<rect x="3" y="3" width="194" height="114" rx="12" fill="${c}"/>`;

// ---- parçalar (yerel koordinat, merkez 0,0; s = yarıçap; d = koyuluk çarpanı) ----
const PAR={
 lettuce(s,r,d){const c=['#7fd24f','#6fca47','#8fdc5a','#62bf3e','#9be46a'][r()*5|0];
  return `<path d="${obek(s,s*.92,16,.3,r,r()*6,.13)}" fill="${koyu(c,d)}" ${OK}/>`+
   Ls(`M${f1(-s*.55)} ${f1(s*.3)}Q${f1(-s*.05)} ${f1(-s*.05)} ${f1(s*.6)} ${f1(-s*.3)}`,koyu('#3f9a26',d),2.2)+
   Ls(`M${f1(-s*.1)} ${f1(s*.1)}l${f1(s*.12)} ${f1(s*.42)}`,koyu('#3f9a26',d),1.8)+
   (d===1?Ls(`M${f1(-s*.55)} ${f1(-s*.35)}q${f1(s*.3)} ${f1(-s*.28)} ${f1(s*.62)} ${f1(-s*.2)}`,'#d4f7a8',2.4):'')},
 tomato(s,r,d){const n=5+(r()*2|0),a0=r()*6;let h=`<circle r="${f1(s)}" fill="${koyu('#e23a26',d)}" ${OK}/><circle r="${f1(s*.82)}" fill="${koyu('#ff6b4b',d)}"/>`;
  for(let i=0;i<n;i++){const a=a0+i*2*Math.PI/n,cx=Math.cos(a)*s*.47,cy=Math.sin(a)*s*.47;
   h+=`<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(s*.21)}" ry="${f1(s*.14)}" transform="rotate(${f1(a*57.3)} ${f1(cx)} ${f1(cy)})" fill="${koyu('#ffb347',d)}"/>`+
    `<circle cx="${f1(cx*1.08)}" cy="${f1(cy*1.08)}" r="1.5" fill="${koyu('#fff1b8',d)}"/>`}
  h+=`<circle r="${f1(s*.2)}" fill="${koyu('#ff9a7c',d)}"/>`;
  return h+(d===1?Ls(`M${f1(-s*.78)} ${f1(-s*.2)}A${f1(s*.8)} ${f1(s*.8)} 0 0 1 ${f1(-s*.2)} ${f1(-s*.78)}`,'#ffc4b4',2.6):'')},
 pickle(s,r,d){let h=`<path d="${obek(s,s,10,.08,r,r()*6)}" fill="${koyu('#5e9a2a',d)}" ${OK}/><circle r="${f1(s*.84)}" fill="${koyu('#b5d870',d)}"/><circle r="${f1(s*.56)}" fill="${koyu('#cfe796',d)}"/>`;
  const n=7,a0=r()*6;for(let i=0;i<n;i++){const a=a0+i*2*Math.PI/n;h+=`<ellipse cx="${f1(Math.cos(a)*s*.5)}" cy="${f1(Math.sin(a)*s*.5)}" rx="2.8" ry="1.6" transform="rotate(${f1(a*57.3)} ${f1(Math.cos(a)*s*.5)} ${f1(Math.sin(a)*s*.5)})" fill="${koyu('#8db84a',d)}"/>`}
  return h+(d===1?Ls(`M${f1(-s*.72)} ${f1(-s*.12)}A${f1(s*.74)} ${f1(s*.74)} 0 0 1 ${f1(-s*.12)} ${f1(-s*.72)}`,'#d8f4a6',2.4):'')},
 onion(s,r,d){return `<circle r="${f1(s)}" fill="${koyu('#9c4fd2',d)}" ${OK}/><circle r="${f1(s*.84)}" fill="${koyu('#f8efff',d)}"/>`+
   `<circle r="${f1(s*.69)}" fill="none" stroke="${koyu('#b46ae4',d)}" stroke-width="2.6"/><circle r="${f1(s*.56)}" fill="${koyu('#f8efff',d)}"/>`+
   `<circle r="${f1(s*.44)}" fill="${koyu('#62337c',d)}" stroke="${K}" stroke-width="2"/>`+
   (d===1?Ls(`M${f1(-s*.76)} ${f1(-s*.1)}A${f1(s*.77)} ${f1(s*.77)} 0 0 1 ${f1(-s*.1)} ${f1(-s*.76)}`,'#ffffff',2.2):'')},
 mushroom(s,r,d){const k=s;return `<path d="M${-k} ${f1(k*.08)}Q${-k} ${f1(-k*.95)} 0 ${f1(-k*.95)}Q${k} ${f1(-k*.95)} ${k} ${f1(k*.08)}Q${f1(k*.62)} ${f1(k*.22)} ${f1(k*.34)} ${f1(k*.14)}L${f1(k*.3)} ${f1(k*.8)}Q0 ${f1(k*.95)} ${f1(-k*.3)} ${f1(k*.8)}L${f1(-k*.34)} ${f1(k*.14)}Q${f1(-k*.62)} ${f1(k*.22)} ${-k} ${f1(k*.08)}Z" fill="${koyu('#f6e6c8',d)}" ${OK}/>`+
   Ls(`M${f1(-k*.8)} ${f1(-k*.02)}Q${f1(-k*.8)} ${f1(-k*.76)} 0 ${f1(-k*.76)}Q${f1(k*.8)} ${f1(-k*.76)} ${f1(k*.8)} ${f1(-k*.02)}`,koyu('#a8693a',d),3)+
   Ls(`M${f1(-k*.5)} ${f1(-k*.1)}Q0 ${f1(-k*.3)} ${f1(k*.5)} ${f1(-k*.1)}`,koyu('#e2c79c',d),1.8)+
   (d===1?Ls(`M${f1(-k*.1)} ${f1(k*.3)}v${f1(k*.35)}`,'#fffaf0',2):'')},
 jalapeno(s,r,d){let h=`<circle r="${f1(s)}" fill="${koyu('#1f7a22',d)}" ${OK}/><circle r="${f1(s*.66)}" fill="${koyu('#9fd65a',d)}" stroke="${koyu('#14561a',d)}" stroke-width="1.6"/>`;
  const n=4+(r()*2|0),a0=r()*6,p=[];for(let i=0;i<n*2;i++){const a=a0+i*Math.PI/n,rr=i%2?s*.14:s*.5;p.push([Math.cos(a)*rr,Math.sin(a)*rr])}
  h+=`<path d="${yumusak(p)}" fill="${koyu('#ffe45a',d)}" stroke="${koyu('#c9a21a',d)}" stroke-width="1.4"/>`;
  for(let i=0;i<n;i++){const a=a0+i*2*Math.PI/n;h+=`<circle cx="${f1(Math.cos(a)*s*.3)}" cy="${f1(Math.sin(a)*s*.3)}" r="1.8" fill="${koyu('#fffbe0',d)}" stroke="${koyu('#c9a21a',d)}" stroke-width=".8"/>`}
  return h+(d===1?Ls(`M${f1(-s*.78)} ${f1(-s*.1)}A${f1(s*.8)} ${f1(s*.8)} 0 0 1 ${f1(-s*.1)} ${f1(-s*.78)}`,'#9fe07a',2.2):'')}
};

// ---- küvet içleri (viewBox 0 0 200 120) ----
const KUV={
 lettuce:r=>taban('#3f9a26',r)+ikiKat(r,{dx:34,dy:21,boy:19,y0:20,y1:100},(p,r)=>yer(p.x,p.y,p.a,PAR.lettuce(p.s,r,p.d),.8)),
 tomato:r=>taban('#a8241a',r)+ikiKat(r,{dx:44,dy:27,boy:24,y0:24,y1:96},(p,r)=>yer(p.x,p.y,p.a,PAR.tomato(p.s,r,p.d))),
 pickle:r=>taban('#3d7a1c',r)+ikiKat(r,{dx:36,dy:22,boy:19,y0:22,y1:98},(p,r)=>yer(p.x,p.y,p.a,PAR.pickle(p.s,r,p.d))),
 onion:r=>taban('#5a2c78',r)+ikiKat(r,{dx:40,dy:23,boy:22,y0:22,y1:98},(p,r)=>yer(p.x,p.y,p.a,PAR.onion(p.s,r,p.d),.66)),
 mushroom:r=>taban('#8a5a32',r)+ikiKat(r,{dx:36,dy:21,boy:18,y0:22,y1:98,ey:.95},(p,r)=>yer(p.x,p.y,(p.a%70)-35,PAR.mushroom(p.s,r,p.d),.86)),
 jalapeno:r=>taban('#1d5c18',r)+ikiKat(r,{dx:34,dy:21,boy:17.5,y0:22,y1:98},(p,r)=>yer(p.x,p.y,p.a,PAR.jalapeno(p.s,r,p.d))),
 cheese(r){   // üst üste cheddar dilimleri: üç deste
  const dilim=(w,a,c,d)=>{const q=w/2;return `<g transform="scale(1 ${P}) rotate(${f1(a)})"><rect x="${-q}" y="${-q}" width="${w}" height="${w}" rx="4" fill="${koyu(c,d)}" ${OK}/></g>`};
  const deste=(x,y,w,n,a0)=>{let h=`<g transform="translate(${x} ${y})">`;
   for(let i=0;i<n;i++){const a=a0+(r()-.5)*14,dx=(r()-.5)*5,dy=-i*3.6,ust=i===n-1,d=ust?1:.9+.1*i/n;
    h+=`<g transform="translate(${f1(dx)} ${f1(dy+2.6)})">${dilim(w,a,'#d98a0a',1)}</g><g transform="translate(${f1(dx)} ${f1(dy)})">${dilim(w,a,i%2?'#ffc61f':'#ffd23a',d)}`+
     (ust?`<g transform="scale(1 ${P}) rotate(${f1(a)})">${Ls(`M${f1(-w*.38)} ${f1(-w*.3)}H${f1(w*.1)}`,'#fff3a8',3)}${Ls(`M${f1(-w*.38)} ${f1(-w*.16)}V${f1(w*.12)}`,'#fff3a8',3)}</g>`:'')+'</g>'}
   return h+'</g>'};
  return taban('#c77a08',r)+deste(36,38,46,3,-10)+deste(100,36,46,3,6)+deste(164,38,46,3,12)+deste(56,84,60,5,8)+deste(144,84,60,5,-8)+deste(100,92,52,3,-2)},
 bacon(r){   // kıvrık pastırma şeritleri
  const serit=(x,y,L,a,ph,d)=>{const w=16,n=16,A=3.2,top=[],alt=[];
   for(let i=0;i<=n;i++){const t=-L/2+i*L/n,yy=A*Math.sin(t/L*Math.PI*3+ph);top.push([t,yy-w/2]);alt.push([t,yy+w/2])}
   const yol=pts=>pts.map((p,i)=>(i?'L':'M')+f1(p[0])+' '+f1(p[1])).join('');
   const orta=f=>yol(top.map((p,i)=>[p[0],p[1]+w*f]));
   return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})"><path d="${yol(top)}${yol(alt.slice().reverse()).replace('M','L')}Z" fill="${koyu('#c23a28',d)}" ${OK}/>`+
    Ls(orta(.36),koyu('#f8cbb8',d),3.4)+Ls(orta(.72),koyu('#8e2216',d),2)+(d===1?Ls(orta(.16).replace(/^M[^L]+L/,'M'),'#ff8f78',1.8):'')+'</g>'};
  let h=taban('#7a1c10',r);const sira=[[22,.76],[42,.84],[62,.92],[80,1],[98,1]];
  sira.forEach(([y,d],i)=>{const k=i%2?18:0;[48+k,140+k-(i%2?30:0)].forEach(x=>{const L=82+r()*10,a=(r()-.5)*16;
   const hx=L/2*Math.cos(a/57.3)+8;h+=serit(Math.max(4+hx,Math.min(196-hx,x+(r()-.5)*10)),y+(r()-.5)*4,L,a,r()*6,d)})});
  return h},
 egg(r){   // sahanda yumurtalar
  const yum=(x,y,rx,ry,yx,yy,d)=>`<g transform="translate(${x} ${y})"><path d="${obek(rx,ry,11,.18,r,r()*6)}" fill="${koyu('#ffffff',d)}" ${OK}/>`+
   `<path d="${obek(rx*.84,ry*.8,11,.15,r,r()*6)}" fill="none" stroke="${koyu('#f3e4cc',d)}" stroke-width="3"/>`+
   `<ellipse cx="${yx}" cy="${yy+2}" rx="${f1(rx*.36)}" ry="${f1(ry*.42)}" fill="${koyu('#f2e9dc',d)}"/>`+
   `<ellipse cx="${yx}" cy="${yy}" rx="${f1(rx*.3)}" ry="${f1(ry*.4)}" fill="${koyu('#ffad14',d)}" ${OK}/>`+
   `<ellipse cx="${f1(yx-rx*.09)}" cy="${f1(yy-ry*.14)}" rx="${f1(rx*.1)}" ry="${f1(ry*.1)}" fill="#ffe7a0"/>`+
   (d===1?Ls(`M${f1(-rx*.7)} ${f1(-ry*.3)}q${f1(rx*.15)} ${f1(-ry*.4)} ${f1(rx*.45)} ${f1(-ry*.5)}`,'#ffffff',3):'')+'</g>';
  return taban('#e9dcc6',r)+yum(150,40,44,28,6,-2,.9)+yum(50,42,42,27,-4,0,.9)+yum(100,58,46,30,-6,-2,.95)+yum(52,84,46,26,4,-2,1)+yum(148,84,46,26,-4,-2,1)},
 avocado(r){   // yarım avokadolar (bazısı çekirdekli) + önde yelpaze dilimler
  const yarim=(x,y,rx,ry,a,cek,d)=>`<g transform="translate(${x} ${y}) rotate(${a})"><path d="${obek(rx,ry,12,.06,r,0)}" fill="${koyu('#2f5a14',d)}" ${OK}/>`+
   `<ellipse cy="1" rx="${f1(rx*.86)}" ry="${f1(ry*.84)}" fill="${koyu('#9fcb48',d)}"/><ellipse cy="1.5" rx="${f1(rx*.74)}" ry="${f1(ry*.7)}" fill="${koyu('#e1ed92',d)}"/>`+
   (cek?`<ellipse cx="1" cy="${f1(ry*.12)}" rx="${f1(rx*.34)}" ry="${f1(ry*.4)}" fill="${koyu('#8a4b22',d)}" ${OK}/>`+Ls(`M${f1(-rx*.18)} ${f1(-ry*.1)}q${f1(rx*.1)} ${f1(-ry*.16)} ${f1(rx*.24)} ${f1(-ry*.14)}`,'#c98a5a',2.6)
    :`<ellipse cx="1" cy="${f1(ry*.12)}" rx="${f1(rx*.3)}" ry="${f1(ry*.36)}" fill="${koyu('#c9b468',d)}" stroke="${koyu('#9a8a3c',d)}" stroke-width="1.6"/>`)+
   (d===1?Ls(`M${f1(-rx*.62)} ${f1(-ry*.2)}q${f1(rx*.18)} ${f1(-ry*.42)} ${f1(rx*.5)} ${f1(-ry*.5)}`,'#fbfde0',2.6):'')+'</g>';
  let h=taban('#466e1c',r)+yarim(38,30,32,22,-12,0,.84)+yarim(100,28,32,22,6,1,.84)+yarim(162,30,32,22,14,0,.84)+
   yarim(42,82,37,26,-8,1,.96)+yarim(158,82,37,26,10,1,.96)+yarim(100,88,37,25,2,0,1);
  return h},
 premium(r){   // altın varaklı wagyu köfteler (üstten), parıltılı
  const kofte=(x,y,rx,ry,d)=>{let h=`<g transform="translate(${x} ${y})"><ellipse rx="${rx}" ry="${ry}" fill="${koyu('#7c3a1c',d)}" ${OK}/>`+
    `<ellipse cy="-2" rx="${rx-6}" ry="${ry-6}" fill="${koyu('#94502c',d)}"/>`+
    `<path d="M${-rx+5} 3Q${-rx+6} ${ry-3} 0 ${ry-3}Q${rx-6} ${ry-3} ${rx-5} 3" fill="none" stroke="${koyu('#4e2210',d)}" stroke-width="5" stroke-linecap="round"/>`;
   [-.42,0,.42].forEach(t=>{const yo=t*ry,hl=rx*Math.sqrt(1-t*t)*.7;h+=`<path d="M${f1(-hl)} ${f1(yo+hl*.22)}L${f1(hl)} ${f1(yo-hl*.22)}" stroke="${koyu('#3a1608',d)}" stroke-width="4.2" stroke-linecap="round"/>`});
   [[-.45,-.35],[.1,-.5],[.5,.05],[-.2,.25]].forEach(([u,v],i)=>{if(i===3&&d<1)return;const px=u*rx,py=v*ry,s=6+r()*3,a=r()*90;
    h+=`<g transform="rotate(${f1(a)} ${f1(px)} ${f1(py)})"><path d="M${f1(px-s)} ${f1(py)}l${f1(s*.6)} ${f1(-s*.9)} ${f1(s*1.4)} ${f1(s*.25)} ${f1(-s*.3)} ${f1(s*1.2)}z" fill="#ffcc2e" stroke="${K}" stroke-width="1.8" stroke-linejoin="round"/>`+
     Ls(`M${f1(px-s*.5)} ${f1(py-.5)}l${f1(s*.4)} ${f1(-s*.5)}`,'#fff6b0',1.8)+'</g>'});
   return h+(d===1?Ls(`M${f1(-rx*.62)} ${f1(-ry*.48)}Q${f1(-rx*.2)} ${f1(-ry*.82)} ${f1(rx*.3)} ${f1(-ry*.7)}`,'#c8825a',3):'')+'</g>'};
  const yildiz=(x,y,s,gec)=>`<path d="M${x} ${y-s}Q${f1(x+s*.18)} ${f1(y-s*.18)} ${x+s} ${y}Q${f1(x+s*.18)} ${f1(y+s*.18)} ${x} ${y+s}Q${f1(x-s*.18)} ${f1(y+s*.18)} ${x-s} ${y}Q${f1(x-s*.18)} ${f1(y-s*.18)} ${x} ${y-s}Z" fill="#fff7c2" stroke="${K}" stroke-width="1.8" stroke-linejoin="round" style="animation-delay:${gec}s"/>`;
  return taban('#2a1206',r)+kofte(52,36,40,24,.82)+kofte(148,36,40,24,.82)+kofte(100,52,40,25,.9)+kofte(54,84,44,26,1)+kofte(146,84,44,26,1)+
   `<g class="bu-parilti">${yildiz(24,20,9,0)}${yildiz(180,58,10,-.6)}${yildiz(100,100,8,-1.2)}${yildiz(124,18,7,-.9)}${yildiz(70,62,6,-.3)}</g>`}
};
KUV.sauce=r=>sosIc('sauce');KUV.mayo=r=>sosIc('mayo');   // küvet olarak da istenirse
function kuvetIci(k,o){const f=KUV[k];if(!f)return '';const id='bu-m'+(++UID),r=tohum('kuvet-'+k);
  return kutu(o,'0 0 200 120','bu-kuvet-ici')+`<defs><clipPath id="${id}c"><rect x="3" y="3" width="194" height="114" rx="12"/></clipPath>`+
   `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e0e05" stop-opacity=".42"/><stop offset=".26" stop-color="#1e0e05" stop-opacity="0"/><stop offset=".82" stop-color="#1e0e05" stop-opacity="0"/><stop offset="1" stop-color="#1e0e05" stop-opacity=".16"/></linearGradient>`+
   `<linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e0e05" stop-opacity=".22"/><stop offset=".12" stop-color="#1e0e05" stop-opacity="0"/><stop offset=".88" stop-color="#1e0e05" stop-opacity="0"/><stop offset="1" stop-color="#1e0e05" stop-opacity=".22"/></linearGradient>`+
   `<radialGradient id="${id}l" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#fff6d8" stop-opacity=".22"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient></defs>`+
   `<g clip-path="url(#${id}c)">${f(r)}<rect width="200" height="120" fill="url(#${id}l)"/><rect width="200" height="120" fill="url(#${id}g)"/><rect width="200" height="120" fill="url(#${id}h)"/></g></svg>`}

// ---- ekmek dolabı içi (viewBox 0 0 200 140): üst rafta üst ekmekler, altta alt ekmekler, sıcak ışık ----
function ekmekUst(x,y,w){const h=w*.58,x0=x-w/2,x1=x+w/2;let s='';
  [[-.26,-.62,-20],[.04,-.8,0],[.3,-.58,22],[-.06,-.42,-8],[.2,-.38,14],[-.34,-.3,-30]].forEach(([u,v,a])=>{const cx=f1(x+u*w),cy=f1(y+v*h);s+=`<ellipse cx="${cx}" cy="${cy}" rx="3.6" ry="2" transform="rotate(${a} ${cx} ${cy})" fill="#fffaf0" stroke="${K}" stroke-width="1.4"/>`});
  return `<path d="M${f1(x0)} ${y}C${f1(x0)} ${f1(y-h*1.28)} ${f1(x1)} ${f1(y-h*1.28)} ${f1(x1)} ${y}Q${f1(x1)} ${y+4} ${f1(x1-5)} ${y+4}H${f1(x0+5)}Q${f1(x0)} ${y+4} ${f1(x0)} ${y}Z" fill="#eba24a" ${OK}/>`+
   `<path d="M${f1(x0+2)} ${y-1}Q${f1(x)} ${f1(y-h*.36)} ${f1(x1-2)} ${y-1}" fill="none" stroke="#f7cf86" stroke-width="5" stroke-linecap="round"/>`+
   Ls(`M${f1(x0+7)} ${f1(y-h*.55)}Q${f1(x0+w*.2)} ${f1(y-h*.92)} ${f1(x-w*.04)} ${f1(y-h*.94)}`,'#ffe2a8',4)+s}
function ekmekAlt(x,y,w){const h=w*.34,x0=x-w/2,x1=x+w/2;   // alt ekmek: alçak, açık renk kubbe, kesik kenarı altta
  return `<path d="M${f1(x0)} ${f1(y-3)}C${f1(x0+1)} ${f1(y-h*1.15)} ${f1(x1-1)} ${f1(y-h*1.15)} ${f1(x1)} ${f1(y-3)}Q${f1(x1)} ${y+3} ${f1(x1-6)} ${y+3}H${f1(x0+6)}Q${f1(x0)} ${y+3} ${f1(x0)} ${f1(y-3)}Z" fill="#f2c47a" ${OK}/>`+
   `<path d="M${f1(x0+3)} ${f1(y-2)}Q${f1(x)} ${f1(y+2)} ${f1(x1-3)} ${f1(y-2)}" fill="none" stroke="#fde7bb" stroke-width="4.4" stroke-linecap="round"/>`+
   Ls(`M${f1(x0+8)} ${f1(y-h*.55)}Q${f1(x0+w*.24)} ${f1(y-h*.84)} ${f1(x-w*.06)} ${f1(y-h*.86)}`,'#ffe7b8',3.6)}
function ekmekDolabi(o){const id='bu-m'+(++UID);
  const raf=y=>`<path d="M6 ${y-9}H194L198 ${y}H2Z" fill="#c9a06a" opacity=".55"/>`+
   [30,60,100,140,170].map(x=>Ls(`M${x} ${y-9}L${f1(x+(x-100)*.04)} ${y}`,'#e9e4dc',1.6)).join('')+
   `<rect x="2" y="${y}" width="196" height="5" rx="2.5" fill="#d9dde3" stroke="${K}" stroke-width="2"/>`+Ls(`M8 ${y+1.6}H190`,'#ffffff',1.4);
  return kutu(o,'0 0 200 140','bu-dolap')+`<defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3a0"/><stop offset=".55" stop-color="#f7b55c"/><stop offset="1" stop-color="#e48a35"/></linearGradient>`+
   `<radialGradient id="${id}b" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#fff8dc" stop-opacity=".9"/><stop offset=".6" stop-color="#ffd27a" stop-opacity=".15"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>`+
   `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a3a10" stop-opacity=".35"/><stop offset=".14" stop-color="#7a3a10" stop-opacity="0"/><stop offset=".86" stop-color="#7a3a10" stop-opacity="0"/><stop offset="1" stop-color="#7a3a10" stop-opacity=".35"/></linearGradient></defs>`+
   (o&&o.arka===false?'':`<rect width="200" height="140" rx="8" fill="url(#${id}a)"/><rect width="200" height="140" rx="8" fill="url(#${id}b)"/>`)+
   `<rect x="22" y="3" width="156" height="6" rx="3" fill="#fffbe8" stroke="${K}" stroke-width="1.6"/>`+
   raf(70)+ekmekUst(36,64,60)+ekmekUst(100,64,60)+ekmekUst(164,64,60)+
   raf(130)+ekmekAlt(36,125,60)+ekmekAlt(100,125,60)+ekmekAlt(164,125,60)+
   (o&&o.arka===false?'':`<rect width="200" height="140" rx="8" fill="url(#${id}s)"/>`)+'</svg>'}

// ---- sos kâseleri (viewBox 0 0 200 120) ve kaşık sapı (viewBox 0 0 200 200, alttaki 200×120 kâseyle çakışır) ----
const SOS={sauce:{t:'#b81f14',a:'#e0321f',k:'#9c180e',p:'#ff8f78',c:K},mayo:{t:'#efdcaa',a:'#fff4d6',k:'#d9bf82',p:'#ffffff',c:K}};
function sosIc(k){const c=SOS[k]||SOS.sauce;
  return `<path d="M4 26Q4 6 24 6H176Q196 6 196 26V94Q196 114 176 114H24Q4 114 4 94Z" fill="${c.t}"/>`+
   `<ellipse cx="100" cy="64" rx="90" ry="46" fill="${c.a}" opacity=".5"/>`+
   `<path d="M20 70Q16 46 46 40Q60 22 100 24Q142 24 156 40Q186 46 182 70Q178 102 100 104Q24 102 20 70Z" fill="${c.a}" ${OK}/>`+
   Ls('M34 80Q60 98 104 96Q150 94 164 72Q168 56 140 48Q104 40 74 50Q56 58 66 70Q80 82 110 78Q134 74 128 60Q120 52 104 54',c.k,3.2)+
   Ls('M30 66Q36 48 60 46',c.p,4)+Ls('M80 40Q98 34 122 38',c.p,3.4)+Ls('M76 62Q84 70 104 70',c.p,2.6)+
   `<path d="M96 60Q92 40 112 30Q108 44 116 56Q108 62 96 60Z" fill="${c.a}" ${OK}/>`+Ls('M101 52Q101 42 108 36',c.p,2.4)+
   `<ellipse cx="150" cy="42" rx="12" ry="5" fill="${c.k}"/>`+
   `<ellipse cx="30" cy="22" rx="10" ry="4" fill="#ffffff" opacity=".5"/><ellipse cx="174" cy="98" rx="7" ry="3" fill="#ffffff" opacity=".3"/>`}
function sosKase(k,o){const id='bu-m'+(++UID);
  return kutu(o,'0 0 200 120','bu-sos bu-sos-'+(k==='mayo'?'mayo':'sauce'))+`<defs><clipPath id="${id}c"><path d="M4 26Q4 6 24 6H176Q196 6 196 26V94Q196 114 176 114H24Q4 114 4 94Z"/></clipPath>`+
   `<radialGradient id="${id}g" cx=".5" cy=".55" r=".62"><stop offset=".6" stop-color="#1e0e05" stop-opacity="0"/><stop offset="1" stop-color="#1e0e05" stop-opacity=".3"/></radialGradient></defs>`+
   `<g clip-path="url(#${id}c)">${sosIc(k)}<rect width="200" height="120" fill="url(#${id}g)"/></g></svg>`}
function sosKasik(k,o){const c=SOS[k]||SOS.sauce;   // sap kâsenin (150,42) noktasından sağ üste çıkar
  return kutu(o,'0 0 200 200','bu-kasik')+`<path d="M150 124L186 14" stroke="${K}" stroke-width="14" stroke-linecap="round"/>`+
   `<path d="M150 124L186 14" stroke="#c4cad2" stroke-width="8.4" stroke-linecap="round"/>`+Ls('M155 104L182 22','#f6f8fb',2.6)+Ls('M149 116L176 34','#8e959f',1.6)+
   `<ellipse cx="150" cy="123" rx="13" ry="6" fill="${c.a}" ${OK}/>`+Ls('M142 121q6-3 12-2',c.p,2.4)+'</svg>'}

// ---- yan ürünler: yan('fries'|'onionring', 'cig'|'pisiyor'|'hazir'|'kutu') → viewBox 0 0 200 160 ----
const KIZ={cig:{a:'#f5e7b4',g:'#ddc684',u:'#f5e7b4',p:'#fffbe6'},pisiyor:{a:'#f6d572',g:'#d9a640',u:'#e9b44a',p:'#fff2b8'},hazir:{a:'#ffc93a',g:'#e0901c',u:'#c8701a',p:'#fff0a0'},kutu:{a:'#ffc93a',g:'#e0901c',u:'#c8701a',p:'#fff0a0'}};
const HAL={cig:{a:'#f2dfae',g:'#d8bf86',n:'#c9ad74',p:'#fffaea'},pisiyor:{a:'#efc06a',g:'#cf9440',n:'#b97a2c',p:'#ffe3a8'},hazir:{a:'#e8962c',g:'#b9661a',n:'#8f4a12',p:'#ffd894'},kutu:{a:'#e8962c',g:'#b9661a',n:'#8f4a12',p:'#ffd894'}};
const cubuk=(x,y,l,a,c)=>`<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)})"><rect x="-4" y="${f1(-l/2)}" width="8" height="${f1(l)}" rx="2.6" fill="${c.a}" ${OK.replace(SW,'2.2')}/>`+
  `<rect x="1" y="${f1(-l/2+2)}" width="2" height="${f1(l-4)}" rx="1" fill="${c.g}"/>`+`<rect x="-2.4" y="${f1(-l/2+3)}" width="1.6" height="${f1(l*.45)}" rx=".8" fill="${c.p}"/>`+
  (c.u!==c.a?`<rect x="-3" y="${f1(-l/2+1)}" width="6" height="3" rx="1.5" fill="${c.u}" opacity=".8"/>`:'')+'</g>';
const halka=(x,y,s,a,sy,c,r)=>{let h=`<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a)}) scale(1 ${f1(sy)})"><path d="${obek(s,s,14,.1,r,r()*6)}" fill="${c.a}" ${OK}/>`+
  `<ellipse rx="${f1(s*.5)}" ry="${f1(s*.5)}" fill="#4a2a12" stroke="${K}" stroke-width="2.2"/><ellipse cy="${f1(s*.12)}" rx="${f1(s*.4)}" ry="${f1(s*.3)}" fill="#6b3e1c"/>`;
  for(let i=0;i<9;i++){const b=r()*6.28,rr=s*(.62+r()*.28);h+=`<rect x="${f1(Math.cos(b)*rr-1.6)}" y="${f1(Math.sin(b)*rr-1.4)}" width="3.2" height="2.8" rx=".8" fill="${i%3?c.n:c.p}"/>`}
  return h+Ls(`M${f1(-s*.78)} ${f1(-s*.3)}A${f1(s*.82)} ${f1(s*.82)} 0 0 1 ${f1(-s*.2)} ${f1(-s*.8)}`,c.p,2.6)+'</g>'};
function yigYan(k,durum,r,alan){   // alan: {x0,x1,y0,y1,aci} yığının kapladığı yer, aci: çubukların en çok eğimi (derece)
  const {x0,x1,y0,y1}=alan,aci=alan.aci||70;let h='';
  if(k==='onionring'){const c=HAL[durum]||HAL.hazir,n=[];
    for(let y=y0;y<=y1;y+=15)for(let x=x0+((y/15|0)%2)*14;x<=x1;x+=30)n.push([x+(r()-.5)*8,y+(r()-.5)*5]);
    n.sort((a,b)=>a[1]-b[1]).forEach(([x,y])=>{h+=halka(x,y,15+r()*3,r()*360,.5+r()*.35,c,r)});return h}
  const c=KIZ[durum]||KIZ.hazir,n=[];
  for(let y=y0;y<=y1;y+=7)for(let x=x0+(r()*8);x<=x1;x+=9+r()*5)n.push([x,y]);
  n.sort((a,b)=>a[1]-b[1]).forEach(([x,y])=>{const t=(x-(x0+x1)/2)/((x1-x0)/2||1);h+=cubuk(x,y,28+r()*16,t*aci*.45+(r()-.5)*aci,c)});return h}
// kendi işaretimiz: beyaz rozette küçük burger
const isaret=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})"><circle r="17" fill="#fff8e6" stroke="${K}" stroke-width="3"/>`+
  `<path d="M-10 -1Q-10 -11 0 -11T10 -1Z" fill="#f4c676" stroke="${K}" stroke-width="2.2" stroke-linejoin="round"/><rect x="-11" y="0" width="22" height="5" rx="2.5" fill="#6b381c" stroke="${K}" stroke-width="2.2"/>`+
  `<path d="M-10 6.5H10Q10 11 6 11H-6Q-10 11 -10 6.5Z" fill="#f4c676" stroke="${K}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-11 0q3 2 6 0t6 0 6 0 5 0" stroke="#6fca47" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`;
function yan(k,durum,o){k=k==='onionring'?'onionring':'fries';durum=KIZ[durum]?durum:'hazir';const r=tohum('yan-'+k+durum),id='bu-m'+(++UID);
  const cls=`bu-yan bu-yan-${k} bu-yan-${durum}`;
  if(durum==='kutu'){
   if(k==='fries')return kutu(o,'0 0 200 160',cls)+`<path d="M58 54L142 54L136 70H64Z" fill="#a81c16" ${OK}/>`+yigYan(k,durum,r,{x0:68,x1:132,y0:20,y1:60,aci:34})+
    `<path d="M52 62Q66 76 78 64Q90 76 100 64Q110 76 122 64Q134 76 148 62L136 152Q135 156 130 156H70Q65 156 64 152Z" fill="#e5322b" ${OK}/>`+
    Ls('M60 80L68 146','#ff7a68',4)+Ls('M70 148H130','#b8221c',3)+isaret(100,112,1.05)+'</svg>';
   return kutu(o,'0 0 200 160',cls)+`<path d="M34 78H166L160 92H40Z" fill="#a81c16" ${OK}/>`+yigYan(k,durum,r,{x0:52,x1:150,y0:44,y1:82})+
    `<path d="M28 86Q40 98 52 88Q64 98 76 88Q88 98 100 88Q112 98 124 88Q136 98 148 88Q160 98 172 86L160 150Q159 155 154 155H46Q41 155 40 150Z" fill="#e5322b" ${OK}/>`+
    Ls('M36 100L44 146','#ff7a68',4)+Ls('M46 147H154','#b8221c',3)+isaret(100,122,.95)+'</svg>'}
  // sepet: arka kenar y=44, ön kenar y=62, gövde y=62..150
  const sepet=`M28 62H172L164 146Q163 150 158 150H42Q37 150 36 146Z`;
  let h=kutu(o,'0 0 200 160',cls)+`<defs><clipPath id="${id}c"><path d="${sepet}"/></clipPath>`+
   `<clipPath id="${id}u"><path d="M0 0H200V66H0Z"/></clipPath><pattern id="${id}p" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0H10M0 0V10" stroke="#8d949d" stroke-width="2"/><path d="M0 1H10M1 0V10" stroke="#dfe3e8" stroke-width=".8"/></pattern></defs><g class="bu-sepet">`+
   `<path d="M34 44H166L172 62H28Z" fill="#3c4046" ${OK}/>`+   // arka iç
   `<path d="M166 52L192 30" stroke="${K}" stroke-width="9" stroke-linecap="round"/><path d="M166 52L192 30" stroke="#c4cad2" stroke-width="4.6" stroke-linecap="round"/>`+
   `<path d="M180 40L196 26" stroke="${K}" stroke-width="13" stroke-linecap="round"/><path d="M180 40L196 26" stroke="#2b2b30" stroke-width="8.6" stroke-linecap="round"/>`+
   `<path d="${sepet}" fill="#33373d"/>`;
  const dolu=durum==='pisiyor'?{x0:44,x1:156,y0:40}:{x0:40,x1:160,y0:26};
  const ic=(k==='onionring'?HAL:KIZ)[durum];
  h+=`<path d="${sepet}" fill="${ic.g}" opacity=".62"/><path d="M32 74H168" stroke="${ic.a}" stroke-width="14" opacity=".55"/><path d="M40 136H160" stroke="#1e1a16" stroke-width="18" opacity=".25"/>`+`<g clip-path="url(#${id}u)">${yigYan(k,durum,r,{x0:dolu.x0+4,x1:dolu.x1-4,y0:dolu.y0,y1:62,aci:56})}</g>`;
  if(durum==='pisiyor'){
   h+=`<g clip-path="url(#${id}c)"><path d="M20 84Q40 78 60 84T100 84 140 84 180 84V160H20Z" fill="#e3a12e" opacity=".88"/><path d="M20 84Q40 78 60 84T100 84 140 84 180 84" fill="none" stroke="#ffd96e" stroke-width="3"/></g>`;
   const kab=[[50,96,4],[74,120,3],[96,92,5],[118,128,3.4],[140,100,4],[62,138,2.8],[150,132,3],[86,108,3.6],[130,86,3]];
   h+=`<g class="bu-kab">`+kab.map(([x,y,s],i)=>`<circle cx="${x}" cy="${y}" r="${s}" fill="#fff3c0" stroke="#b87418" stroke-width="1.4" style="animation-delay:${f1(-i*.19)}s"/>`).join('')+'</g>'}
  h+=`<path d="${sepet}" fill="url(#${id}p)" opacity=".85"/><path d="${sepet}" fill="none" ${OK.replace(SW,'3.2')}/>`+
   `<path d="M28 62H172" stroke="${K}" stroke-width="8" stroke-linecap="round"/><path d="M28 62H172" stroke="#d6dbe1" stroke-width="4" stroke-linecap="round"/>`+
   `<path d="M38 150H162" stroke="${K}" stroke-width="5" stroke-linecap="round"/></g>`;
  if(durum==='pisiyor')h+=`<g class="bu-buhar">`+[60,100,140].map((x,i)=>Ls(`M${x} 30q-6-8 0-14t0-14`,'#ffffff',3,` opacity=".7" style="animation-delay:${-i*.5}s"`)).join('')+'</g>';
  return h+'</svg>'}

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
.bu-siparis .bu-sira{display:flex;align-items:center;justify-content:center;width:100%}
.bu-siparis .bu-sira>.bu-izgara{margin-inline:0}
.bu-siparis .bu-ayrac{display:block;align-self:stretch;position:relative;flex:none}
.bu-siparis .bu-ayrac::after{content:'';position:absolute;left:50%;top:8%;bottom:8%;width:2px;margin-left:-1px;border-radius:1px;background:rgba(58,29,12,.3)}
.bu-siparis .bu-yanlar{display:flex;flex-wrap:wrap;justify-content:center;flex:none}
svg.bu-ciz{display:block;overflow:visible}
.bu-yan-pisiyor .bu-kab circle{transform-box:fill-box;transform-origin:center;animation:bu-kab 1.5s ease-in infinite}
@keyframes bu-kab{0%{transform:translateY(5px) scale(.2);opacity:0}25%{opacity:1}85%{opacity:1}100%{transform:translateY(-9px) scale(1.15);opacity:0}}
.bu-yan-pisiyor .bu-sepet{animation:bu-cizz .16s linear infinite alternate}
@keyframes bu-cizz{from{transform:translate(-.4px,0)}to{transform:translate(.4px,-.5px)}}
.bu-yan-pisiyor .bu-buhar path{animation:bu-buhar 1.6s ease-out infinite}
@keyframes bu-buhar{0%{transform:translateY(6px);opacity:0}40%{opacity:.7}100%{transform:translateY(-12px);opacity:0}}
.bu-parilti path{transform-box:fill-box;transform-origin:center;animation:bu-par 1.9s ease-in-out infinite}
@keyframes bu-par{0%,100%{transform:scale(.55);opacity:.5}50%{transform:scale(1.1);opacity:1}}
@media (prefers-reduced-motion:reduce){.bu-yigin .bu-yeni,.bu-yan-pisiyor .bu-kab circle,.bu-yan-pisiyor .bu-sepet,.bu-yan-pisiyor .bu-buhar path,.bu-parilti path{animation:none}}
`;

BU.BURGER={KATMAN,yigin,siparis,simge,src,grupla,kuvetIci,ekmekDolabi,sosKase,sosKasik,yan,KUVETLER:Object.keys(KUV).filter(k=>k!=='sauce'&&k!=='mayo'),YANLAR:['fries','onionring'],YAN_DURUM:['cig','pisiyor','hazir','kutu'],CSS,YOL:'g/'};
if(typeof module!=='undefined')module.exports=BU.BURGER;
})();
