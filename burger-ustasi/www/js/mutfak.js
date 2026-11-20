/* Burger Ustası: mutfak sahnesi (BU.MUTFAK). DOM'a dokunmaz, SVG metni döndürür.
   - ciz({aksam:0..1, vb:{x,y,w,h}}) → tek <svg viewBox="0 0 1600 900"> (vb verilirse görünür alan o kadar uzar: duvar,
     tezgâh, lamba kabloları ve baca yukarı/yanlara devam eder; oyun ekranı boş kenar kalmasın diye kullanır): sahnenin SABİT arka planı (duvar, davlumbaz, lambalar, neon,
     raflar, pencere, tezgâh, ekmek dolabı gövdesi, ızgara gövdesi ve boş gözler, boş küvetler, sos kâseleri, tahta,
     fritöz, hazır tepsileri, içecek makinesi, çöp). aksam 0 = gündüz, 1 = akşam; renkler hesaplanır, filtre yok.
   - ciz({katman:'on'}): aynı çizimin yalnız servis tezgâhı çizgisinden (SERVIS_Y) aşağısı + lambalar + davlumbaz (ön katman):
     oyunda müşteriler arka ve ön katmanın arasında durur, gövdelerinin altı tezgâhın arkasında kalır.
   - YER: aynı 1600×900 koordinatında dokunma/yerleşim dikdörtgenleri {x,y,w,h}. İç içerik (küvetin içi, ekmekler,
     köfte…) başka modülden gelir ve dikdörtgenin İÇ alanına (IC kadar içeri) oturur.
   - Parçalar (her biri kendi viewBox'lı bağımsız <svg>; id kullanmaz, sayfada çok kez durabilir):
     kilit(), izgaraGoz(durum), duman(), neon(acik), kuvetKapak(), cam() (ekmek dolabının cam parlaması, içeriğin üstüne).
   - CSS: 'mt-' önekli sınıflar (duman, kor, neon titremesi).
   Işık hep sol üstten; çizgi rengi burger.js ile aynı (#3a1d0c). */
(function(){
'use strict';
const G=typeof window!=='undefined'?window:globalThis;
const BU=G.BU=G.BU||{};
const K='#3a1d0c';
const W=4;   // dış çizgi kalınlığı

// ---------- renk yardımcıları ----------
const hx=c=>{c=c.replace('#','');if(c.length===3)c=c.replace(/./g,'$&$&');return [0,2,4].map(i=>parseInt(c.substr(i,2),16))};
const mix=(a,b,t)=>{const A=hx(a),B=hx(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')};
const r1=v=>+v.toFixed(1);
// küçük, tekrarlanabilir rastgele
const hash=(i,j)=>{let h=(i*374761393+j*668265263)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0)/4294967296};

// gündüz → akşam paleti
const PAL={
 red:['#d9473b','#c73a26'], redD:['#c63b30','#a52e24'], cream:['#f6e9d2','#f0caa0'], grout:['#b9a284','#8a5a3a'],
 stL:['#e6eaee','#ddd2c6'], stM:['#aeb6bf','#a39389'], stD:['#6c7580','#615148'], stIn:['#8e98a3','#857266'], stDeep:['#4f5761','#47372f'],
 marb:['#efe6d9','#ecd6b8'], marbD:['#d6cbbd','#d4b896'], vein:['#bfb3a5','#bf9c78'],
 wood:['#c87a3e','#a85e2c'], woodD:['#93501f','#743a17'], woodL:['#e09a5c','#c97c40'],
 board:['#eeb173','#e09a58'], boardD:['#cf8546','#bb6e34'],
 sky1:['#7cc8f5','#2a2a58'], sky2:['#d8f1ff','#e48a54'], bld:['#a9c4dc','#3b2f4a'], bld2:['#c7dbea','#4a3a56'], tree:['#5bb244','#2f5a32'],
 lamp:['#2f2b2a','#262120'], warm:['#fff2c8','#ffc76a'], oil:['#d89a2c','#c0761c'],
 kraft:['#dcb17a','#c89458'], kraftD:['#b98a52','#9a6a38'],
 pot:['#d8703a','#b8582c'], leaf:['#5aae3c','#4a8a34'], leafD:['#3c8a2a','#2f6a26'],
 inside:['#f7dca8','#f6b868']
};
let C={};   // o anki renkler
// çizilen alan: varsayılan sahne 0..1600 × 0..900; ciz({vb}) ile yukarı/yanlara uzatılır (duvar, tezgâh, lamba kabloları, baca uzar)
let V={x0:0,y0:0,x1:1600,y1:900};
const pal=t=>{C={};for(const k in PAL)C[k]=mix(PAL[k][0],PAL[k][1],t)};

// ---------- yerler ----------
const R=(x,y,w,h)=>({x,y,w,h});
const KUV_UST=['lettuce','tomato','pickle','onion','cheese','bacon'];
const KUV_ALT=['mushroom','jalapeno','egg','avocado','premium','bos'];
const KW=194,KH=112,KG=6;
const SATIR1={x:205,y:502},SATIR2={x:155,y:626};   // sıra arası 12: iPhone SE'de de dokunma kutusu 44 pt
const kuvet={};
KUV_UST.forEach((k,i)=>kuvet[k]=R(SATIR1.x+i*(KW+KG),SATIR1.y,KW,KH));
KUV_ALT.forEach((k,i)=>kuvet[k]=R(SATIR2.x+i*(KW+KG),SATIR2.y,KW,KH));
const GZW=154,GZH=112,GZG=12,GX0=418,GY0=230;
const izgara=[];
for(let r=0;r<2;r++)for(let c=0;c<3;c++)izgara.push(R(GX0+c*(GZW+GZG),GY0+r*(GZH+GZG),GZW,GZH));
const YER={
 ekmek:R(36,232,330,224),
 izgara,                                  // 0-2 üst sıra, 3-5 alt sıra (soldan sağa)
 hazir:R(906,230,114,236),                // pişmiş köfte bekleme tepsisi (ızgaranın sağ ucu)
 kuvet,
 sos:{sauce:R(60,746,172,110),mayo:R(244,746,172,110)},
 tahta:[R(494,746,298,110),R(800,746,298,110)],
 fritoz:{fries:R(1058,240,162,226),onionring:R(1228,240,162,226)},
 yanHazir:{fries:R(1134,744,222,112),onionring:R(1368,744,222,112)},
 cop:R(1440,548,142,182),
 icecek:R(1410,190,180,310),
 // müşteriler: servis tezgâhının arkasında, damalı duvarın önünde (y < SERVIS_Y görünür; altı tezgâhın arkasında kalır).
 // Her yer: yüz solda, sipariş baloncuğu sağda. Oyun (oyun.js) üst bilgi köşelere sığmazsa yerleri bu aralıkta sıkıştırır.
 musteri:[R(255,-14,360,194),R(620,-14,360,194),R(985,-14,360,194)],
 musteri4:[R(255,-14,268,194),R(529,-14,268,194),R(803,-14,268,194),R(1077,-14,268,194)],   // ileride 4 müşteri
 yuz:[R(255,22,150,180),R(620,22,150,180),R(985,22,150,180)],                              // yüz kutusu, 150 birim (alt %16'sı tezgâhın arkasında)
 balon:[R(400,-10,212,184),R(765,-10,212,184),R(1130,-10,212,184)],                        // baloncuk en çok bu kadar (yüzün sağında)
 servis:R(-200,180,2000,50)                                                            // servis tezgâhı (müşteriler ona yaslanır)
};
const SERVIS_Y=180;   // müşterilerin görünen alt kenarı: ciz({katman:'on'}) bu çizginin altını (ve lambaları, davlumbazı) çizer
// küvet/kâse/tepsi kenar payı: içerik bu kadar içeri oturur
const IC={kuvet:10,sos:12,yanHazir:14,fritoz:10,izgara:8,hazir:10};

// ---------- çizim yardımcıları ----------
const O=(w=W)=>`stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const rect=(x,y,w,h,rx,fill,ek='')=>`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" fill="${fill}" ${ek}/>`;
const line=(d,c,w=3,op=1)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op<1?` stroke-opacity="${op}"`:''}/>`;
// paslanmaz parlama: dikdörtgen içinde eğik yarı saydam şeritler (dışarı taşmaz)
function parla(x,y,w,h,op=.35,egim=.35,seritler=[[.18,.10],[.34,.04],[.62,.07]]){
  const k=h*egim;let s='';
  seritler.forEach(([a,g])=>{let x0=x+k+a*(w-k),gw=g*w;if(x0+gw>x+w)return;
    s+=`<path d="M${r1(x0)} ${r1(y)}h${r1(gw)}l${r1(-k)} ${r1(h)}h${r1(-gw)}z" fill="#fff" fill-opacity="${op}"/>`});
  return s}
// yumuşak gölge (filtresiz): üst üste saydam yuvarlak dikdörtgenler
const golge=(x,y,w,h,op=.16)=>[10,6,2].map((p,i)=>rect(x-p,y-p*.4,w+2*p,h+p*1.2,14+p,'#2a1006',`fill-opacity="${r1(op*(i+1)/3*100)/100}"`)).join('');

// ---------- duvar ----------
function duvar(){
  const T=52,j0=Math.min(0,Math.floor((V.y0+28)/T)-1),i0=Math.min(0,Math.floor((V.x0+14)/T)-1),i1=Math.max(Math.ceil(1600/T)+1,Math.ceil((V.x1+14)/T)+1);
  let s=rect(V.x0,V.y0,V.x1-V.x0,232-V.y0,0,C.grout);
  const yol={red:'',redD:'',redL:'',cream:'',creamD:''},par={red:'',cream:''};
  for(let j=j0;j<5;j++)for(let i=i0;i<i1;i++){
    const x=i*T-14,y=j*T-28,h=hash(i,j),chk=(i+j)%2===0;
    // sol yarı belirgin dama, sağa doğru kırmızı ağırlıklı (referanstaki gibi serpiştirilmiş krem)
    const oran=x<620?.92:x<1000?.5:.42;
    const krem=chk&&h<oran;
    const t=krem?(h<oran*.3?'creamD':'cream'):(h>.82?'redD':h>.6?'redL':'red');
    yol[t]+=`M${x+2.5} ${y+2.5}h${T-5}v${T-5}h${-(T-5)}z`;
    par[krem?'cream':'red']+=`M${x+7} ${y+T-14}V${y+8}h${T-22}`;
  }
  s+=`<path d="${yol.red}" fill="${C.red}"/><path d="${yol.redD}" fill="${C.redD}"/><path d="${yol.redL}" fill="${mix(C.red,'#ff8a70',.12)}"/>`+
     `<path d="${yol.cream}" fill="${C.cream}"/><path d="${yol.creamD}" fill="${mix(C.cream,C.grout,.18)}"/>`+
     `<path d="${par.red}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3" stroke-linecap="round"/>`+
     `<path d="${par.cream}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>`;
  return s}

// ---------- davlumbaz ----------
// ince ve yüksekte: müşterilerin başının üstünde kalır (alt kenarı y=-22). Telefonda çoğu ekranın üstünde, iPad'de baca görünür.
const DAV={x:630,w:340,y:-22};
function davlumbaz(){
  const x0=DAV.x,x1=DAV.x+DAV.w,cx=x0+DAV.w/2,yb=DAV.y;let s='';
  // baca
  const by=Math.min(yb-200,V.y0-10);
  s+=`<path d="M${cx-62} ${by}H${cx+62}V${yb-70}H${cx-62}z" fill="url(#mt-stH)" ${O()}/>`+parla(cx-62,by,124,yb-70-by,.22,.4,[[.15,.1],[.5,.05]]);
  for(let y=yb-110;y>by+20;y-=90)s+=line(`M${cx-62} ${y}H${cx+62}`,C.stD,2.5,.55);
  // gövde (yayvan, alçak)
  s+=`<path d="M${cx-108} ${yb-74}H${cx+108}L${x1} ${yb-34}H${x0}z" fill="url(#mt-stV)" ${O()}/>`;
  s+=`<path d="M${cx-90} ${yb-70}l-22 32M${cx-40} ${yb-70}l-6 32M${cx+50} ${yb-70}l8 32M${cx+92} ${yb-70}l22 32" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>`;
  // havalandırma kanatları ve dudak
  s+=rect(x0-4,yb-38,DAV.w+8,24,7,C.stL,O(3.5));
  for(let x=x0+16;x<=x1-26;x+=22)s+=rect(x,yb-33,11,14,3,C.stDeep);
  s+=line(`M${x0+8} ${yb-34}H${x1-8}`,'#fff',2.5,.7);
  s+=rect(x0-10,yb-16,DAV.w+20,10,5,C.stM,O(3.5));
  return s}

// ---------- lambalar ----------
// iki lamba: solda raflarin üstünde ve sağda (müşterilerin başının üstünde, abajur alt kenarı LY)
const LAMBA=[118,1188],LY=-22;
function lamba(x){const d=LY-84;
  return line(`M${x} ${Math.min(-5+d,V.y0-5)}V${30+d}`,'#1d1715',4)+
    rect(x-12,22+d,24,14,4,C.lamp,O(3))+
    `<path d="M${x-58} ${84+d}Q${x-56} ${46+d} ${x-22} ${36+d}H${x+22}Q${x+56} ${46+d} ${x+58} ${84+d}z" fill="${C.lamp}" ${O()}/>`+
    line(`M${x-40} ${70+d}Q${x-38} ${52+d} ${x-18} ${44+d}`,'#fff',4,.25)+
    `<ellipse cx="${x}" cy="${84+d}" rx="54" ry="7" fill="${C.warm}" ${O(3)}/>`}
function lambaIsik(x,t){
  const a=.03+.06*t,y=LY+2;
  return `<path d="M${x-50} ${y}L${x+50} ${y}L${x+300} 860L${x-300} 860z" fill="url(#mt-koni)" opacity="${r1(a*100)/100}"/>`+
    `<path d="M${x-44} ${y}L${x+44} ${y}L${x+190} 700L${x-190} 700z" fill="url(#mt-koni)" opacity="${r1(a*.8*100)/100}"/>`}
function lambaAmpul(x,t){
  return `<circle cx="${x}" cy="${LY+4}" r="${r1(44+28*t)}" fill="url(#mt-par)" opacity="${r1((.55+.45*t)*100)/100}"/>`+
    `<ellipse cx="${x}" cy="${LY+2}" rx="20" ry="8" fill="#fffbe8"/>`}

// ---------- duvardaki yerler (müşterilerin başının üstünde; telefonda çoğu ekranın üstünde kalır) ----------
const PEN={x:230,y:-134};                          // pencere (352×104)
const NEON='translate(1292 -142) scale(.8)';         // neon tabela (170×150 → 136×120), sağ lambanın sağında
// ---------- neon ----------
// burger tabelası, 170×150 kutuda
const NEON_YOL={
 ust:'M22 58Q22 14 85 14T148 58Z',
 susam:'M60 34l6-3M84 26l7 0M108 34l6 3M72 46l5-2M98 46l5 2',
 marul:'M18 74q10-8 20 0t20 0 20 0 20 0 20 0 20 0 20 0',
 kofte:'M24 86H146Q154 86 154 94Q154 102 146 102H24Q16 102 16 94Q16 86 24 86Z',
 peynir:'M70 86l15 12 15-12',
 alt:'M22 114H148Q148 136 120 136H50Q22 136 22 114Z'
};
function neonCiz(acik,guc){
  const tup=Object.keys(NEON_YOL);
  const renk=k=>k==='marul'?['#72ff5a','#e6ffd8']:['#ff8a1c','#fff1b8'];
  let s='';
  if(acik){
    s+=[[118,100,.06],[92,80,.08],[66,58,.1]].map(([rx,ry,o])=>`<ellipse cx="85" cy="76" rx="${rx}" ry="${ry}" fill="#ff6a14" fill-opacity="${r1(o*guc*100)/100}"/>`).join('');
    tup.forEach(k=>{const [c]=renk(k);
      s+=`<path d="${NEON_YOL[k]}" fill="none" stroke="${c}" stroke-opacity="${r1(.10*guc*100)/100+.04}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`+
         `<path d="${NEON_YOL[k]}" fill="none" stroke="${c}" stroke-opacity="${r1(.22*guc*100)/100+.08}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`});
    tup.forEach(k=>{const [c,i]=renk(k);
      s+=`<path d="${NEON_YOL[k]}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`+
         `<path d="${NEON_YOL[k]}" fill="none" stroke="${i}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`});
  }else{
    tup.forEach(k=>{s+=`<path d="${NEON_YOL[k]}" fill="none" stroke="${K}" stroke-opacity=".35" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`+
      `<path d="${NEON_YOL[k]}" fill="none" stroke="#b9aea4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`+
      `<path d="${NEON_YOL[k]}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"/>`});
  }
  // tutturma vidaları
  s+=[[30,10],[140,10],[30,140],[140,140]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="#8a8580" stroke="${K}" stroke-width="1.5"/>`).join('');
  return s}

// ---------- pencere ----------
function pencere(t){
  const x=196,y=92,w=352,h=104;
  let s=rect(x-4,y-4,w+8,h+8,10,C.stD,O());
  s+=`<g clip-path="url(#mt-pen)">`;
  s+=rect(x+10,y+10,w-20,h-20,0,'url(#mt-gok)');
  // bulutlar (gündüz)
  if(t<.95)s+=`<g fill="#fff" opacity="${r1((1-t)*.85*100)/100}"><path d="M250 132q2-14 18-12 6-10 18-4 14-2 14 12q8 2 6 10h-58q-6-4 2-6z"/><path d="M420 118q3-10 15-8 6-8 16-2 10 0 10 10h-44q-3-0 3 0z"/></g>`;
  // şehir silueti
  const bin=[[214,150,30],[246,128,28],[276,140,34],[312,118,26],[340,146,30],[372,124,40],[414,136,26],[442,112,30],[474,140,28],[504,126,34]];
  bin.forEach(([bx,by,bw],i)=>{s+=rect(bx,by,bw,200-by,2,i%2?C.bld:C.bld2);
    for(let wy=by+8;wy<186;wy+=12)for(let wx=bx+5;wx<bx+bw-5;wx+=9){
      const on=hash(wx,wy)<.55;
      s+=rect(wx,wy,5,6,1,on?mix('#ffffff','#ffd77a',t):'#000',`fill-opacity="${on?r1((.25+.7*t)*100)/100:.08}"`)}});
  // ağaçlar iki yanda (gündüz yeşil, akşam koyu)
  s+=`<g fill="${C.tree}"><circle cx="214" cy="120" r="26"/><circle cx="236" cy="104" r="20"/><circle cx="208" cy="150" r="22"/><circle cx="532" cy="118" r="24"/><circle cx="512" cy="100" r="18"/><circle cx="540" cy="152" r="22"/></g>`;
  s+=`<g fill="#fff" opacity="${r1((1-t)*.25*100)/100}"><circle cx="228" cy="110" r="8"/><circle cx="522" cy="106" r="7"/></g>`;
  // cam yansıması
  s+=`<path d="M300 102h40l-60 92h-40zM360 102h14l-60 92h-14z" fill="#fff" opacity="${r1((.28-.12*t)*100)/100}"/>`;
  s+=`</g>`+rect(x+10,y+10,w-20,h-20,0,'none',O(3));
  // orta kayıt
  s+=rect(x+w/2-4,y+10,8,h-20,2,C.stM,O(2.5));
  // denizlik
  s+=rect(x-12,y+h+2,w+24,12,5,C.stL,O(3.5));
  return s}

// ---------- raflar ve saksılar (sol üst) ----------
function raflar(){
  let s='';
  // dikey boru
  s+=rect(184,Math.min(-10,V.y0-10),12,240-Math.min(0,V.y0),4,'#3a3330',O(3));
  // raf 1
  s+=rect(-10,112,186,13,4,C.wood,O(3.5))+rect(20,125,8,16,2,'#3a3330',O(2.5))+rect(140,125,8,16,2,'#3a3330',O(2.5));
  // kaktüs saksısı
  s+=`<path d="M10 112l3-26h26l3 26z" fill="${C.pot}" ${O(3)}/>`+rect(8,82,36,8,3,mix(C.pot,'#fff',.15),O(3));
  s+=`<path d="M20 82V58q0-8 6-8t6 8v24" fill="${C.leaf}" ${O(3)}/>`;
  // sarkan bitki
  s+=`<path d="M64 112l4-30h52l4 30z" fill="${C.pot}" ${O(3)}/>`+rect(60,76,68,10,4,mix(C.pot,'#fff',.15),O(3));
  const yap=(x,y,r,a)=>`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.62}" transform="rotate(${a} ${x} ${y})" fill="${C.leaf}" ${O(2.5)}/>`;
  s+=line('M78 86Q66 120 74 160Q78 178 70 196','#3d6a26',3)+line('M112 86Q130 120 122 150','#3d6a26',3)+line('M96 86Q96 110 100 128','#3d6a26',3);
  s+=[[74,128,11,40],[66,150,10,-30],[78,170,10,50],[70,194,9,-20],[124,118,11,-40],[126,146,10,30],[100,124,9,70]].map(a=>yap(...a)).join('');
  s+=[[70,64,16,-30],[92,52,18,10],[116,62,16,40],[82,74,14,-60],[106,74,14,50],[96,64,12,0]].map(a=>yap(...a)).join('');
  s+=line('M86 50q4-4 10-2M110 58q4-2 8 2','#fff',2.5,.45);
  // raf 2
  s+=rect(-10,190,200,13,4,C.wood,O(3.5));
  // kırmızı çiçekli saksı
  s+=`<path d="M12 190l3-22h30l3 22z" fill="${C.pot}" ${O(3)}/>`;
  s+=`<g ${O(2.5)}><circle cx="20" cy="160" r="9" fill="${C.leaf}"/><circle cx="40" cy="158" r="9" fill="${C.leaf}"/><circle cx="24" cy="152" r="7" fill="#e5322b"/><circle cx="38" cy="148" r="7" fill="#e5322b"/><circle cx="31" cy="158" r="6" fill="#ffc21a"/></g>`;
  // kavanoz
  s+=rect(70,150,40,40,8,'#cfe6ee',O(3)+' fill-opacity=".85"')+rect(68,144,44,10,3,'#c0392b',O(3))+rect(76,166,28,18,4,'#f6c27a');
  s+=line('M78 158v20','#fff',3,.6);
  // küçük yeşil saksı
  s+=`<path d="M130 190l2-18h26l2 18z" fill="#6d9b8e" ${O(3)}/>`+`<g fill="${C.leaf}" ${O(2.5)}><path d="M144 172q-14-6-12-20 10 4 12 20z"/><path d="M146 172q10-14 20-12-2 12-20 12z"/><path d="M145 172q0-16 6-24 6 10-6 24z"/></g>`;
  return s}

// ---------- paket kutuları (sağ üst) ----------
function kutu(x,y,w,h){
  const cx=x+w/2,cy=y+h*.55,r=Math.min(w,h)*.22;
  return rect(x,y,w,h,5,C.kraft,O(3.5))+rect(x,y,w,h*.22,5,C.kraftD,O(3))+line(`M${x+6} ${y+h*.22+5}H${x+w-6}`,'#fff',2.5,.35)+
   // kutu üstündeki burger damgası
   `<g fill="${mix(C.kraftD,K,.35)}"><path d="M${cx-r} ${cy-1}q0-${r} ${r}-${r}t${r} ${r}z"/><rect x="${cx-r-2}" y="${cy+2}" width="${2*r+4}" height="${r*.4}" rx="${r*.2}"/><path d="M${cx-r} ${cy+r*.6}h${2*r}q0 ${r*.5}-${r*.5} ${r*.5}h-${r}q-${r*.5} 0-${r*.5}-${r*.5}z"/></g>`}
// servis tezgâhının sağ ucunda, üst üste paket kutuları (müşterilerin sağında)
function kutular(){
  return kutu(1384,106,96,74)+kutu(1486,92,112,88)+kutu(1398,50,76,56)}

// ---------- tezgâh ----------
function tezgah(){
  let s='';
  const a=V.x0-10,b=V.x1+10,w=b-a;
  // servis tezgâhı: müşterilerin yaslandığı ahşap üst + paslanmaz ön yüz (müşterilerin gövdesi bunun arkasında)
  s+=rect(a,192,w,40,0,'url(#mt-stV)',O(3.5));
  for(let x=a+30;x<b;x+=60)s+=line(`M${x} 200V226`,'#fff',2,.16);
  s+=rect(a,192,w,8,0,'#2a1006','fill-opacity=".22"');
  s+=rect(a,SERVIS_Y,w,15,5,C.woodL,O(3.5))+rect(a,SERVIS_Y+9,w,6,0,C.wood)+line(`M${a+10} ${SERVIS_Y+4}H${b-10}`,'#fff',3,.45);
  s+=rect(a,212,w,20,4,C.stM,O(3.5))+line(`M${a+10} 217H${b-10}`,'#fff',2.5,.6);
  // mermer
  s+=rect(a,228,w,Math.max(690,V.y1-228),0,C.woodD);
  s+=`<path d="M${a} 228H${b}V862H${a+54}Q${a} 862 ${a} 808z" fill="url(#mt-mer)" ${O()}/>`;
  // damarlar
  const vy=[[0,560,'M0 560q120-30 260 10t300-6 280 24 330-20 300 12 160-8'],[0,680,'M0 690q160 20 300-14t340 10 260-22 360 18 360-12'],[0,800,'M30 800q200-24 420 6t380-10 360 20 410-14'],[0,620,'M140 640q60-40 140-30M980 760q60-26 150-14M1180 600q80 20 160-6']];
  vy.forEach(v=>{s+=line(v[2],C.vein,2.2,.7)});
  s+=line('M300 590q40 10 70 30M1240 820q30-20 70-18M700 640q30 20 70 14',C.vein,1.6,.6);
  // ön kenar
  s+=`<path d="M${a+54} 860H${b}V878H${a+50}Q${a} 878 ${a} 824V806Q${a} 860 ${a+54} 860z" fill="${C.marbD}" ${O(3.5)}/>`;
  s+=line(`M${a+58} 864H${b-10}`,'#fff',3,.7);
  // ahşap ön panel
  const yb=Math.max(910,V.y1+10);
  s+=`<path d="M${a} 878H${b}V${yb}H${a}z" fill="${C.wood}" ${O(3.5)}/>`;
  for(let x=46+44*Math.floor((a-46)/44);x<b;x+=44)if(x>a+20)s+=line(`M${x} 882V${yb-4}`,C.woodD,3,.8);
  s+=line(`M${a+30} 882H${b-10}`,C.woodL,3,.7);
  return s}

// ---------- ekmek dolabı ----------
function ekmekDolabi(t){
  const e=YER.ekmek;let s='';
  s+=golge(14,470,376,36,.18);
  // taban
  s+=rect(14,456,376,48,10,'url(#mt-stV)',O());
  s+=parla(14,456,376,48,.25,.4,[[.05,.05],[.6,.1]]);
  s+=`<circle cx="356" cy="480" r="10" fill="#2f2b2a" ${O(3)}/>`+line('M356 480l5-5','#fff',2.5)+rect(30,472,60,14,4,'#2f2b2a',O(2.5))+rect(36,476,22,6,2,mix('#ff7a2a','#ffb04a',t));
  // iç (ısıtılmış, sıcak)
  s+=`<path d="M26 458V268Q26 216 80 214H324Q378 216 378 268V458z" fill="url(#mt-dolapIc)" ${O()}/>`;
  // arka panelde ısıtıcı şeritler
  s+=line('M60 230H344',mix('#fff0c8','#fff6d8',t),5,.9);
  // yan camlar (perspektif)
  s+=`<path d="M26 268Q26 216 80 214L96 236Q50 238 50 280V440L26 458z" fill="#fff" fill-opacity=".22"/>`+
     `<path d="M378 268Q378 216 324 214L308 236Q354 238 354 280V440L378 458z" fill="#fff" fill-opacity=".14"/>`;
  // raflar: orta raf içeriğin yarısında, alt tepsi dipte
  const ry=e.y+e.h*.5;
  s+=rect(30,ry-4,344,8,3,C.stL,O(3))+rect(30,e.y+e.h-6,344,8,3,C.stL,O(3));
  // çerçeve: kemer ve dikmeler
  s+=`<path d="M26 458V268Q26 216 80 214H324Q378 216 378 268V458" fill="none" stroke="${K}" stroke-width="16" stroke-linejoin="round"/>`+
     `<path d="M26 458V268Q26 216 80 214H324Q378 216 378 268V458" fill="none" stroke="${C.stL}" stroke-width="9" stroke-linejoin="round"/>`+
     `<path d="M24 300V268Q24 222 70 216" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3" stroke-linecap="round"/>`;
  return s}
// cam (içeriğin üstüne konacak parlama); ciz() içinde de hafifçe var
function camYansima(op){return `<path d="M26 268Q26 216 80 214H324Q378 216 378 268" fill="none" stroke="#fff" stroke-opacity="${op*1.6}" stroke-width="6"/>`+
  `<path d="M70 222h46L60 456H34V300zM140 222h16L98 456H82z" fill="#fff" fill-opacity="${op}"/>`+
  `<path d="M300 222h30L276 456h-30z" fill="#fff" fill-opacity="${op*.6}"/>`}

// ---------- ızgara ----------
function izgaraGovde(t){
  let s='';
  s+=golge(400,470,634,34,.2);
  s+=rect(430,198,574,24,8,C.stL,O(3.5))+parla(430,198,574,24,.4,.5,[[.1,.04],[.5,.08]]);
  s+=rect(400,214,634,280,14,'url(#mt-stV)',O());
  s+=rect(410,226,614,250,8,C.stDeep,O(3));
  YER.izgara.forEach(r=>{s+=`<g transform="translate(${r.x} ${r.y})">${gozIc('bos',t,false)}</g>`});
  // hazır bekleme tepsisi
  const h=YER.hazir;
  s+=rect(h.x,h.y,h.w,h.h,8,C.stL,O(3.5))+rect(h.x+IC.hazir,h.y+IC.hazir,h.w-2*IC.hazir,h.h-2*IC.hazir,5,'url(#mt-kIc)',O(2.5));
  for(let y=h.y+30;y<h.y+h.h-16;y+=22)s+=line(`M${h.x+18} ${y}H${h.x+h.w-18}`,C.stDeep,2.5,.5);
  s+=rect(h.x+10,h.y+10,h.w-20,8,3,`url(#mt-sicak)`,`opacity="${r1((.5+.4*t)*100)/100}"`);
  // ön dudak ve düğmeler
  s+=rect(404,470,626,26,8,C.stL,O(3.5))+line('M414 476H1020','#fff',3,.7);
  [470,560,650,740,830].forEach(x=>{s+=`<circle cx="${x}" cy="484" r="8" fill="#2f2b2a" ${O(2.5)}/>`+line(`M${x} 484v-6`,'#fff',2.2)});
  s+=`<circle cx="960" cy="484" r="4.5" fill="${mix('#ff6a1a','#ff9a3a',t)}" ${O(2)}/>`;
  return s}
// bir ızgara gözü (155×112). durum: bos | cig | pisiyor | hazir | kilitli
function gozIc(durum,t=0,anim=true){
  const w=GZW,h=GZH,kil=durum==='kilitli';
  const kor=kil?.12:durum==='pisiyor'?1:durum==='bos'?.6:.8;
  let s=rect(0,0,w,h,8,'#1c1615',O(3.5));
  // kor ışığı: ortada parlak, kenarlara sönük (çubukların arasından görünür)
  s+=`<ellipse cx="${w/2}" cy="${h/2}" rx="${w*.5}" ry="${h*.48}" fill="#c42a0a" fill-opacity="${r1(.55*kor*100)/100}"/>`+
     `<ellipse cx="${w/2}" cy="${h/2}" rx="${w*.36}" ry="${h*.32}" fill="#ff6a1a" fill-opacity="${r1(.55*kor*100)/100}"/>`+
     `<ellipse cx="${w/2}" cy="${h/2}" rx="${w*.2}" ry="${h*.16}" fill="#ffb040" fill-opacity="${r1(.45*kor*100)/100}"/>`;
  // alttaki dikey taşıyıcılar
  s+=`<path d="M${w*.25} 6V${h-6}M${w*.5} 6V${h-6}M${w*.75} 6V${h-6}" stroke="#141010" stroke-width="5"/>`;
  // tel ızgara: yatay çubuklar
  const n=8,ar=(h-14)/(n-1);
  let alt='',par='';
  for(let i=0;i<n;i++){const y=7+i*ar;alt+=`M6 ${r1(y)}H${w-6}`;par+=`M10 ${r1(y-2)}H${w-10}`}
  s+=`<path d="${alt}" stroke="#120d0c" stroke-width="10" stroke-linecap="round"/>`+
     `<path d="${alt}" stroke="${kil?'#3e3836':'#3a3331'}" stroke-width="6.5" stroke-linecap="round"/>`+
     `<path d="${par}" stroke="#fff" stroke-opacity="${kil?.08:.22}" stroke-width="1.6" stroke-linecap="round"/>`;
  if(durum==='pisiyor'&&anim)s+=`<path class="mt-kor" d="${alt}" stroke="#ff7a24" stroke-opacity=".0" stroke-width="2" stroke-dasharray="6 14" stroke-linecap="round" transform="translate(0 ${r1(ar/2)})"/>`;
  s+=rect(2.5,2.5,w-5,h-5,6.5,'none',`stroke="#7a726e" stroke-width="2.5" stroke-opacity=".8"`);
  if(kil)s+=rect(0,0,w,h,8,'#120c0a','fill-opacity=".35"');
  return s}
// köfte (üstten, hafif perspektif)
function kofte(cx,cy,durum){
  const c=durum==='cig'?['#d65a5a','#b53e44','#f08a86']:durum==='pisiyor'?['#9a4a28','#7a3418','#c26a3e']:['#6b381c','#4a2410','#93552f'];
  let s=`<ellipse cx="${cx}" cy="${cy+6}" rx="46" ry="26" fill="${c[1]}" ${O(3.5)}/><ellipse cx="${cx}" cy="${cy}" rx="46" ry="25" fill="${c[0]}" ${O(3.5)}/>`;
  if(durum==='cig'){s+=`<g fill="#f6b0aa" fill-opacity=".8"><circle cx="${cx-18}" cy="${cy-6}" r="3"/><circle cx="${cx+6}" cy="${cy-10}" r="2.5"/><circle cx="${cx+20}" cy="${cy+4}" r="3"/><circle cx="${cx-4}" cy="${cy+8}" r="2.5"/></g>`}
  else{s+=line(`M${cx-28} ${cy-6}l14-10M${cx-8} ${cy+4}l22-16M${cx+14} ${cy+10}l16-12`,durum==='hazir'?'#2a1206':'#5a2410',5)}
  s+=line(`M${cx-30} ${cy-12}q12-8 30-9`,c[2],4,.9);
  return s}
function izgaraGoz(durum='bos'){
  let s=gozIc(durum,0,true);
  if(durum==='cig'||durum==='pisiyor'||durum==='hazir')s+=kofte(GZW/2,GZH/2-2,durum);
  if(durum==='hazir')s+=rect(2,2,GZW-4,GZH-4,8,'none',`class="mt-hazir" stroke="#ffd84a" stroke-width="5"`);
  if(durum==='kilitli')s+=`<g transform="translate(${GZW/2-26} ${GZH/2-28}) scale(1.08)">${kilitIc()}</g>`;
  return `<svg class="mt-goz mt-goz-${durum}" viewBox="0 0 ${GZW} ${GZH}" aria-hidden="true">${s}</svg>`}

// ---------- fritöz ----------
function fritozGovde(t){
  let s=golge(1044,470,356,34,.2);
  s+=rect(1044,214,356,280,14,'url(#mt-stV)',O());
  s+=rect(1054,226,336,250,8,C.stDeep,O(3));
  Object.values(YER.fritoz).forEach(r=>{
    s+=rect(r.x,r.y,r.w,r.h,8,C.stL,O(3.5));
    const i=IC.fritoz;
    s+=rect(r.x+i,r.y+i,r.w-2*i,r.h-2*i,6,'url(#mt-yag)',O(3));
    // yağ kabarcıkları ve parlama
    for(let k=0;k<7;k++){const bx=r.x+22+hash(k,r.x)*(r.w-44),by=r.y+40+hash(r.x,k)*(r.h-70);s+=`<circle cx="${r1(bx)}" cy="${r1(by)}" r="${r1(3+hash(k,k)*4)}" fill="none" stroke="#ffe7a0" stroke-opacity=".55" stroke-width="2"/>`}
    s+=line(`M${r.x+20} ${r.y+24}h${r.w-60}`,'#fff3c8',4,.45);
    // sepet teli ve sapı (öne doğru)
    let ag='';for(let x=r.x+30;x<r.x+r.w-20;x+=14)ag+=`M${x} ${r.y+20}V${r.y+r.h-20}`;for(let y=r.y+32;y<r.y+r.h-20;y+=14)ag+=`M${r.x+18} ${y}H${r.x+r.w-18}`;
    s+=`<path d="${ag}" stroke="#3a2a10" stroke-opacity=".16" stroke-width="2"/>`;
    s+=rect(r.x+16,r.y+18,r.w-32,r.h-36,6,'none',`stroke="${K}" stroke-width="6"`)+rect(r.x+16,r.y+18,r.w-32,r.h-36,6,'none',`stroke="#d8d4cc" stroke-width="3"`);

  });
  // ön panel
  s+=rect(1048,470,348,26,8,C.stL,O(3.5))+line('M1058 476H1388','#fff',3,.7);
  [1190,1360].forEach(x=>{s+=`<circle cx="${x}" cy="484" r="8" fill="#2f2b2a" ${O(2.5)}/>`+line(`M${x} 484l5-4`,'#fff',2.2)});
  s+=`<circle cx="1225" cy="484" r="4.5" fill="${mix('#ffb020','#ffc040',t)}" ${O(2)}/>`;
  // sepet sapları: öne, panelin üstüne
  Object.values(YER.fritoz).forEach(r=>{const x=r.x+r.w/2-20;
    s+=`<path d="M${x} ${r.y+r.h-18}V${r.y+r.h+12}" stroke="${K}" stroke-width="10" stroke-linecap="round"/><path d="M${x} ${r.y+r.h-18}V${r.y+r.h+12}" stroke="#d8d4cc" stroke-width="5" stroke-linecap="round"/>`+rect(x-14,r.y+r.h+6,28,20,6,'#2f2b2a',O(3))+line(`M${x-8} ${r.y+r.h+11}h10`,'#fff',2,.4)});
  return s}

// ---------- içecek makinesi ----------
function icecek(t){
  const r=YER.icecek;let s=golge(r.x,r.y+r.h-30,r.w,32,.2);
  s+=rect(r.x,r.y,r.w,r.h-30,12,'url(#mt-stV)',O());
  s+=rect(r.x+6,r.y+6,r.w-12,16,6,C.stL,O(3));
  const kart=[['#e5322b','#a81f1a'],['#ff9a1c','#d06a0a'],['#ffd21f','#d8a800']];
  kart.forEach(([a,b],i)=>{const x=r.x+12+i*54,y=r.y+30;
    s+=rect(x,y,48,80,8,a,O(3.5))+rect(x,y+58,48,22,0,b)+rect(x,y,48,80,8,'none',O(3.5))+line(`M${x+9} ${y+10}v40`,'#fff',4,.5);
    // etiket
    s+=`<circle cx="${x+24}" cy="${y+32}" r="14" fill="#fff" ${O(2.5)}/>`;
    if(i===0)s+=`<path d="M${x+18} ${y+26}h12l-2 14h-8z" fill="#e5322b" ${O(2)}/>`+line(`M${x+26} ${y+26}l3-7`,K,2);
    else{const c=i===1?'#ff9a1c':'#ffd21f';s+=`<circle cx="${x+24}" cy="${y+32}" r="9" fill="${c}" ${O(2)}/>`+line(`M${x+24} ${y+24}v16M${x+16} ${y+32}h16M${x+18} ${y+26}l12 12M${x+30} ${y+26}l-12 12`,mix(c,'#fff',.6),1.6)}
  });
  // musluklar
  for(let i=0;i<3;i++){const x=r.x+36+i*54;s+=rect(x-12,r.y+118,24,22,5,'#2f2b2a',O(3))+rect(x-6,r.y+138,12,26,4,'#3a3432',O(3))+rect(x-14,r.y+122,28,6,3,C.stL,O(2))}
  // bardak yeri
  s+=rect(r.x+10,r.y+172,r.w-20,86,8,C.stDeep,O(3));
  s+=parla(r.x+10,r.y+172,r.w-20,86,.12,.3,[[.2,.08]]);
  // damlalık
  s+=rect(r.x+6,r.y+250,r.w-12,22,6,'#2f2b2a',O(3));
  for(let x=r.x+16;x<r.x+r.w-14;x+=12)s+=line(`M${x} ${r.y+256}v10`,'#6a625e',3);
  s+=rect(r.x+4,r.y+r.h-34,r.w-8,34,8,C.stM,O(3.5));
  s+=parla(r.x,r.y,r.w,r.h-30,.22,.3,[[.02,.04],[.9,.04]]);
  return s}

// ---------- küvetler ----------
function kuvetCiz(r){
  const i=IC.kuvet,ox=r.x+i,oy=r.y+i,ow=r.w-2*i,oh=r.h-2*i;
  // taban (perspektif: arka duvar yüksek, ön duvar ince)
  const fx=ox+12,fy=oy+24,fw=ow-24,fh=oh-30;
  return rect(r.x+3,r.y+6,r.w,r.h,10,'#2a1006','fill-opacity=".18"')+
    rect(r.x,r.y,r.w,r.h,10,'url(#mt-stR)',O(3.5))+
    rect(ox,oy,ow,oh,6,C.stIn)+
    `<path d="M${ox} ${oy}H${ox+ow}L${fx+fw} ${fy}H${fx}z" fill="${C.stDeep}"/>`+
    `<path d="M${ox} ${oy}L${fx} ${fy}V${fy+fh}L${ox} ${oy+oh}z" fill="${C.stD}"/>`+
    `<path d="M${ox+ow} ${oy}L${fx+fw} ${fy}V${fy+fh}L${ox+ow} ${oy+oh}z" fill="${mix(C.stD,C.stM,.5)}"/>`+
    rect(fx,fy,fw,fh,4,'url(#mt-kIc)')+
    `<path d="M${fx} ${fy+fh}L${ox} ${oy+oh}H${ox+ow}L${fx+fw} ${fy+fh}z" fill="${C.stL}" fill-opacity=".7"/>`+
    rect(ox,oy,ow,oh,6,'none',O(2.5))+
    line(`M${r.x+12} ${r.y+4}H${r.x+r.w-12}`,'#fff',2.5,.85)+
    line(`M${fx+10} ${fy+8}l14 0M${fx+30} ${fy+8}h40`,'#fff',2,.3)}
function kuvetler(){
  let s='';
  // soğutmalı ray (arka sıra)
  s+=golge(SATIR1.x-10,SATIR1.y+KH,6*KW+5*KG+20,14,.18);
  s+=rect(SATIR1.x-10,SATIR1.y-8,6*KW+5*KG+20,KH+16,12,'url(#mt-stV)',O());
  KUV_UST.forEach(k=>s+=kuvetCiz(kuvet[k]));
  s+=golge(SATIR2.x-10,SATIR2.y+KH,6*KW+5*KG+20,14,.18);
  s+=rect(SATIR2.x-10,SATIR2.y-8,6*KW+5*KG+20,KH+16,12,'url(#mt-stV)',O());
  KUV_ALT.forEach(k=>s+=kuvetCiz(kuvet[k]));
  return s}

// ---------- sos kâseleri ----------
function sosKaseler(){
  let s='';
  Object.values(YER.sos).forEach((r,j)=>{const i=IC.sos;
    s+=rect(r.x+4,r.y+8,r.w,r.h,14,'#2a1006','fill-opacity=".2"');
    s+=rect(r.x,r.y,r.w,r.h,14,C.stL,O(3.5))+rect(r.x+i,r.y+i,r.w-2*i,r.h-2*i,8,'url(#mt-kIc)',O(2.5));
    s+=line(`M${r.x+14} ${r.y+5}H${r.x+r.w-14}`,'#fff',2.5,.8);
    // kaşık: sap kâsenin sağ üst köşesinden dışarı çıkar
    const x0=r.x+r.w-62,y0=r.y+40,x1=r.x+r.w-8,y1=r.y-30;
    s+=line(`M${x0} ${y0}L${x1} ${y1}`,K,13)+line(`M${x0} ${y0}L${x1} ${y1}`,'#d9dde2',7)+line(`M${x0+16} ${y0-22}L${x1-4} ${y1+4}`,'#fff',2.4,.8);
  });
  return s}
// kaşığın kâse içinden görünen ucu (içerik üstüne konabilir)
function kasik(){return `<svg class="mt-kasik" viewBox="0 0 172 106" aria-hidden="true">`+line('M98 52L170 -36',K,13)+line('M98 52L170 -36','#d9dde2',7)+`<ellipse cx="94" cy="58" rx="16" ry="10" transform="rotate(-50 94 58)" fill="#d9dde2" ${O(3)}/></svg>`}

// ---------- tahta ----------
function tahta(){
  const x=482,y=748,w=628,h=106;
  let s=rect(x+5,y+10,w,h,16,'#2a1006','fill-opacity=".22"');
  s+=rect(x,y,w,h,16,C.boardD,O());
  s+=rect(x,y,w,h-12,16,'url(#mt-tahta)',O());
  s+=line(`M${x+40} ${y+22}q120-8 260 2t300-4`,C.boardD,2.5,.55)+line(`M${x+30} ${y+46}q160 10 300-2t280 6`,C.boardD,2.5,.45)+line(`M${x+60} ${y+68}q140-6 280 4t240-6`,C.boardD,2.5,.4);
  s+=line(`M${x+120} ${y+34}q30-6 60 0M${x+420} ${y+58}q40 6 80-2`,'#fff',2.5,.35);
  s+=line(`M${x+16} ${y+9}H${x+w-16}`,'#fff',3,.55);
  return s}

// ---------- hazır tepsileri (yan ürün) ----------
function yanIsaret(k,cx,cy){
  if(k==='fries')return `<path d="M${cx-9} ${cy-4}l-2-9M${cx-3} ${cy-4}l-1-12M${cx+3} ${cy-4}l1-11M${cx+9} ${cy-4}l2-8" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M${cx-9} ${cy-4}l-2-9M${cx-3} ${cy-4}l-1-12M${cx+3} ${cy-4}l1-11M${cx+9} ${cy-4}l2-8" stroke="#ffd84a" stroke-width="3" stroke-linecap="round"/><path d="M${cx-13} ${cy-6}h26l-3 18h-20z" fill="#e5322b" ${O(2.5)}/>`;
  return `<circle cx="${cx-5}" cy="${cy+1}" r="9" fill="none" stroke="${K}" stroke-width="7"/><circle cx="${cx-5}" cy="${cy+1}" r="9" fill="none" stroke="#e8a440" stroke-width="3.5"/><circle cx="${cx+6}" cy="${cy-2}" r="9" fill="none" stroke="${K}" stroke-width="7"/><circle cx="${cx+6}" cy="${cy-2}" r="9" fill="none" stroke="#f0b450" stroke-width="3.5"/>`}
function yanHazirCiz(t){
  let s='';
  Object.entries(YER.yanHazir).forEach(([k,r])=>{const i=IC.yanHazir;
    s+=rect(r.x+5,r.y+10,r.w,r.h,14,'#2a1006','fill-opacity=".22"');
    s+=rect(r.x,r.y,r.w,r.h,14,C.stM,O());
    s+=rect(r.x+i,r.y+i,r.w-2*i,r.h-2*i-8,8,'url(#mt-kIc)',O(3));
    for(let y=r.y+i+26;y<r.y+r.h-i-14;y+=11)s+=line(`M${r.x+i+12} ${y}H${r.x+r.w-i-12}`,C.stDeep,2.4,.55);
    // ısıtma ışığı (üst kenar)
    s+=rect(r.x+r.w/2-36,r.y+2,72,7,3.5,mix('#ffb84a','#ffd27a',t),O(2));
    s+=rect(r.x+i+4,r.y+i+3,r.w-2*i-8,10,4,'url(#mt-sicak)',`opacity="${r1((.55+.35*t)*100)/100}"`);
    s+=line(`M${r.x+14} ${r.y+5}H${r.x+r.w/2-44}M${r.x+r.w/2+44} ${r.y+5}H${r.x+r.w-14}`,'#fff',2.5,.8);
    // ön etiket
    const cx=r.x+r.w/2,cy=r.y+r.h-10;
    s+=rect(cx-22,cy-18,44,30,8,'#fffaf0',O(3))+yanIsaret(k,cx,cy-2);
  });
  return s}

// ---------- çöp ----------
function cop(){
  const r=YER.cop;let s=golge(r.x+4,r.y+r.h-20,r.w-8,24,.22);
  s+=`<path d="M${r.x+12} ${r.y+52}H${r.x+r.w-12}L${r.x+r.w-20} ${r.y+r.h}H${r.x+20}z" fill="url(#mt-stH)" ${O()}/>`;
  for(let k=1;k<5;k++){const x=r.x+12+k*(r.w-24)/5;s+=line(`M${r1(x)} ${r.y+64}L${r1(x+(x<r.x+r.w/2?2:-2))} ${r.y+r.h-14}`,C.stD,3,.55)}
  s+=line(`M${r.x+28} ${r.y+64}L${r.x+34} ${r.y+r.h-12}`,'#fff',5,.45);
  // kapak (kubbe + sallanan ağız)
  s+=`<path d="M${r.x+4} ${r.y+56}Q${r.x+4} ${r.y+6} ${r.x+r.w/2} ${r.y+4}Q${r.x+r.w-4} ${r.y+6} ${r.x+r.w-4} ${r.y+56}z" fill="${C.stL}" ${O()}/>`;
  s+=`<path d="M${r.x+30} ${r.y+44}Q${r.x+r.w/2} ${r.y+26} ${r.x+r.w-30} ${r.y+44}V${r.y+52}H${r.x+30}z" fill="#2f2b2a" ${O(3)}/>`;
  s+=line(`M${r.x+22} ${r.y+26}q16-14 40-16`,'#fff',4,.7);
  s+=rect(r.x+2,r.y+52,r.w-4,10,4,C.stM,O(3));
  // pedal
  s+=rect(r.x+r.w/2-22,r.y+r.h-6,44,10,4,'#2f2b2a',O(2.5));
  return s}

// ---------- tanımlar (gradyanlar; sahnede bir kez) ----------
function defs(t){
  return `<defs>`+
   `<linearGradient id="mt-stV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.stL}"/><stop offset=".55" stop-color="${C.stM}"/><stop offset="1" stop-color="${C.stD}"/></linearGradient>`+
   `<linearGradient id="mt-stH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.stD}"/><stop offset=".2" stop-color="${C.stL}"/><stop offset=".55" stop-color="${C.stM}"/><stop offset=".8" stop-color="${C.stL}"/><stop offset="1" stop-color="${C.stD}"/></linearGradient>`+
   `<linearGradient id="mt-stR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(C.stL,'#fff',.4)}"/><stop offset=".5" stop-color="${C.stL}"/><stop offset="1" stop-color="${C.stM}"/></linearGradient>`+
   `<linearGradient id="mt-kIc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.stDeep}"/><stop offset=".35" stop-color="${C.stIn}"/><stop offset="1" stop-color="${C.stM}"/></linearGradient>`+
   `<linearGradient id="mt-mer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.marbD}"/><stop offset=".25" stop-color="${C.marb}"/><stop offset="1" stop-color="${mix(C.marb,C.marbD,.4)}"/></linearGradient>`+
   `<linearGradient id="mt-tahta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(C.board,'#fff',.12)}"/><stop offset="1" stop-color="${C.board}"/></linearGradient>`+
   `<linearGradient id="mt-gok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sky1}"/><stop offset="1" stop-color="${C.sky2}"/></linearGradient>`+
   `<linearGradient id="mt-yag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(C.oil,'#fff2a0',.3)}"/><stop offset="1" stop-color="${mix(C.oil,'#5a2a08',.45)}"/></linearGradient>`+
   `<linearGradient id="mt-sicak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a2a" stop-opacity="0"/><stop offset=".5" stop-color="#ffc45a"/><stop offset="1" stop-color="#ff9a2a" stop-opacity="0"/></linearGradient>`+
   `<radialGradient id="mt-dolapIc" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${mix(C.inside,'#fff6dc',.5)}"/><stop offset="1" stop-color="${mix(C.inside,'#c8742c',.35)}"/></radialGradient>`+
   `<linearGradient id="mt-koni" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c0" stop-opacity=".95"/><stop offset=".55" stop-color="#ffe0a0" stop-opacity=".35"/><stop offset="1" stop-color="#ffd890" stop-opacity="0"/></linearGradient>`+
   `<radialGradient id="mt-par"><stop offset="0" stop-color="#fff6d0"/><stop offset=".4" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb040" stop-opacity="0"/></radialGradient>`+
   `<radialGradient id="mt-vin" cx=".5" cy=".6" r=".8"><stop offset=".5" stop-color="#2a0c04" stop-opacity="0"/><stop offset="1" stop-color="#2a0c04" stop-opacity=".8"/></radialGradient>`+
   `<radialGradient id="mt-havuz"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".6"/><stop offset="1" stop-color="#ffd080" stop-opacity="0"/></radialGradient>`+
   `<clipPath id="mt-pen"><rect x="206" y="102" width="332" height="84"/></clipPath>`+
   `</defs>`}

// ---------- sahne ----------
function ciz(o={}){
  const t=Math.max(0,Math.min(1,+o.aksam||0));
  const vb=o.vb||{};V={x0:Math.min(0,vb.x!=null?vb.x:0),y0:Math.min(0,vb.y!=null?vb.y:0)};V.x1=Math.max(1600,(vb.x!=null?vb.x:0)+(vb.w||1600));V.y1=Math.max(900,(vb.y!=null?vb.y:0)+(vb.h||900));
  const VW=V.x1-V.x0,VH=V.y1-V.y0;
  pal(t);
  const on=o.katman==='on';
  let s='';
  s+=duvar();
  s+=`<g transform="translate(0 -24)">${raflar()}</g>`;
  s+=`<g transform="translate(${PEN.x-196} ${PEN.y-92})">${pencere(t)}</g>`;
  s+=`<g transform="${NEON}">${neonCiz(true,.45+.55*t)}</g>`;
  s+=kutular();
  s+=tezgah();
  s+=ekmekDolabi(t);
  s+=izgaraGovde(t);
  s+=fritozGovde(t);
  s+=icecek(t);
  s+=kuvetler();
  s+=cop();
  s+=sosKaseler();
  s+=tahta();
  s+=yanHazirCiz(t);
  s+=camYansima(.12);
  // akşam: genel kararma ve köşe gölgesi (sahnenin üstü daha koyu)
  if(t>0){
    s+=`<rect x="${V.x0}" y="${V.y0}" width="${VW}" height="${232-V.y0}" fill="#3a0e10" opacity="${r1(.22*t*100)/100}"/>`;
    s+=`<rect x="${V.x0}" y="${V.y0}" width="${VW}" height="${VH}" fill="#4a1a04" opacity="${r1(.10*t*100)/100}"/>`;
    s+=`<rect x="${V.x0}" y="${V.y0}" width="${VW}" height="${VH}" fill="url(#mt-vin)" opacity="${r1(.58*t*100)/100}"/>`;
  }
  s+=davlumbaz();
  // lamba ışıkları, ışık havuzları, ampuller
  LAMBA.forEach(x=>{s+=lambaIsik(x,t)});
  LAMBA.forEach(x=>{s+=`<ellipse cx="${x}" cy="620" rx="340" ry="220" fill="url(#mt-havuz)" opacity="${r1((.08+.2*t)*100)/100}"/>`});
  LAMBA.forEach(x=>{s+=`<ellipse cx="${x}" cy="${LY+70}" rx="150" ry="110" fill="url(#mt-havuz)" opacity="${r1((.15+.4*t)*100)/100}"/>`});
  LAMBA.forEach(x=>{s+=lamba(x)+lambaAmpul(x,t)});
  // neon akşam daha parlak: üstte bir kez daha parıltı
  if(t>.05)s+=`<g transform="${NEON}" opacity="${r1(t*.6*100)/100}">${neonCiz(true,1)}</g>`;
  // ön katman: yalnız servis tezgâhının çizgisinden aşağısı, lambalar ve davlumbaz (müşteriler iki katmanın arasında durur)
  if(on){const lm=LAMBA.map(x=>`M${x-62} ${V.y0}H${x+62}V${LY+10}H${x-62}z`).join('');
    s=`<clipPath id="mt-on"><path d="M${V.x0} ${SERVIS_Y}H${V.x1}V${V.y1}H${V.x0}z${lm}M${DAV.x-12} ${V.y0}H${DAV.x+DAV.w+12}V${DAV.y+2}H${DAV.x-12}z"/></clipPath><g clip-path="url(#mt-on)">${s}</g>`}
  s=defs(t)+s;
  // aynı sayfada birden çok sahne: o.ek ile kimlikler ayrışır
  if(o.ek)s=s.replace(/(id="|url\(#)mt-/g,`$1mt${o.ek}-`);
  const kutu=o.vb?`${V.x0} ${V.y0} ${VW} ${VH}`:'0 0 1600 900';V={x0:0,y0:0,x1:1600,y1:900};
  return `<svg xmlns="http://www.w3.org/2000/svg" class="mt-sahne" viewBox="${kutu}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`}

// ---------- parçalar ----------
function kilitIc(){
  return `<path d="M15 24v-7q0-11 11-11t11 11v7" fill="none" stroke="${K}" stroke-width="10" stroke-linecap="round"/>`+
    `<path d="M15 24v-7q0-11 11-11t11 11v7" fill="none" stroke="#c9ced4" stroke-width="5" stroke-linecap="round"/>`+
    `<path d="M20 12q2-3 5-3.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`+
    rect(6,22,40,30,8,'#f4efe6',O(3.5))+rect(6,42,40,10,0,'#d8cfc2')+rect(6,22,40,30,8,'none',O(3.5))+
    `<circle cx="26" cy="34" r="5" fill="${K}"/><path d="M24 36h4l1 9h-6z" fill="${K}"/>`+line('M11 28v8','#fff',3,.8)}
const kilit=()=>`<svg class="mt-kilit" viewBox="0 0 52 56" aria-hidden="true">${kilitIc()}</svg>`;
function kuvetKapak(){
  const w=KW,h=KH;
  return `<svg class="mt-kapak" viewBox="0 0 ${w} ${h}" aria-hidden="true">`+
    rect(4,8,w-8,h-12,10,'#2a1006','fill-opacity=".25"')+
    rect(2,2,w-4,h-6,10,'#b3bac2',O(3.5))+
    `<path d="M8 ${h-14}Q8 14 ${w/2} 12T${w-8} ${h-14}z" fill="#d6dbe0" stroke="${K}" stroke-width="2.5" stroke-opacity=".5"/>`+
    parla(6,6,w-12,h-16,.35,.35,[[.1,.08],[.32,.03]])+
    rect(w/2-28,h/2-14,56,16,8,'#8d949c',O(3))+line(`M${w/2-20} ${h/2-10}H${w/2+20}`,'#fff',2.5,.7)+
    line(`M12 6H${w-12}`,'#fff',2.5,.8)+
    `<g transform="translate(${w/2-17} ${h/2-4}) scale(.66)">${kilitIc()}</g></svg>`}
function duman(){
  const yol=['M30 120q-14-20 0-40t0-40','M54 124q14-22 0-44t2-44','M76 120q-12-18 2-38t-2-38'];
  return `<svg class="mt-duman" viewBox="0 0 100 140" aria-hidden="true">`+
    yol.map((d,i)=>`<path class="mt-dm mt-dm${i}" d="${d}" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-opacity=".35"/><path class="mt-dm mt-dm${i}" d="${d}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-opacity=".5"/>`).join('')+`</svg>`}
const neon=(acik=true)=>`<svg class="mt-neon${acik?' mt-neon-acik':''}" viewBox="-20 -10 210 170" aria-hidden="true">${neonCiz(acik,1)}</svg>`;
// ekmek dolabının camı: içerik (ekmekler) üstüne konacak saydam parlama, YER.ekmek'e göre
const cam=()=>{const e=YER.ekmek;return `<svg class="mt-cam" viewBox="${e.x} ${e.y} ${e.w} ${e.h}" aria-hidden="true">${camYansima(.14)}</svg>`};

const CSS=`
.mt-sahne{display:block;width:100%;height:100%}
.mt-goz,.mt-kilit,.mt-kapak,.mt-duman,.mt-neon,.mt-cam,.mt-kasik{display:block;width:100%;height:100%;overflow:visible;pointer-events:none}
.mt-kor{animation:mt-kor 1.1s ease-in-out infinite alternate}
@keyframes mt-kor{from{stroke-opacity:.45}to{stroke-opacity:1}}
.mt-hazir{animation:mt-hazir 1s ease-in-out infinite alternate}
@keyframes mt-hazir{from{stroke-opacity:.35}to{stroke-opacity:1}}
.mt-dm{opacity:0;transform-box:fill-box;transform-origin:50% 100%;animation:mt-dm 2.4s ease-out infinite}
.mt-dm1{animation-delay:.8s}.mt-dm2{animation-delay:1.6s}
@keyframes mt-dm{0%{opacity:0;transform:translateY(18px) scale(.7,.6)}25%{opacity:.8}100%{opacity:0;transform:translateY(-36px) scale(1.5,1.1)}}
.mt-neon-acik{animation:mt-neon 6s steps(1) infinite}
@keyframes mt-neon{0%,91%,95%,100%{opacity:1}92%,94%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.mt-kor,.mt-hazir,.mt-dm,.mt-neon-acik{animation:none}.mt-dm{opacity:.4}}
`;

BU.MUTFAK={ciz,YER,IC,kilit,izgaraGoz,duman,neon,kuvetKapak,cam,kasik,CSS,KUV_UST,KUV_ALT,GOZ_DURUM:['bos','cig','pisiyor','hazir','kilitli']};
if(typeof module!=='undefined')module.exports=BU.MUTFAK;
})();
