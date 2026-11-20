/* Burger Ustası: karikatür müşteri üretici (SVG, kodla çizilir; telif bizim).
   Musteri.draw(m, duygu) → SVG metni. m = {yuz,ten,sac,sacRenk,kas,goz,burun,biyik,sakal,gozluk,sapka,kiyafet,kRenk,ek} (her biri sıra numarası)
   Musteri.random(tohum) → aynı tohum her zaman aynı müşteri. Duygular: happy wait imp angry love sad.
   Musteri.PARTS: her parçanın seçenek adları (Türkçe). */
(function(){
const INK='#2a1f1a';
const SKIN=['#ffe3cf','#f9d1b4','#f0bd94','#e2a47a','#c98a5e','#a86c45','#875234','#5f3a26'];
const HAIRC=['#1e1a18','#3b2a20','#5c3b26','#8a5530','#b5562c','#d99a3c','#ecd28a','#9aa0a6','#e8e6e1','#4a76c9','#d85f9c'];
const CLOTHC=['#e8483b','#2f7fd8','#2fa36b','#f2b630','#8c5ad8','#f07aa6','#2d3a4a','#e9e3d6','#f08a3c','#3fb6c8'];
const FACES=[ // wT alın, wM yanak, wB çene yarı genişliği; yT tepe, yM yanak hizası, yB çene
 {n:'oval',wT:28,wM:31,wB:17,yT:24,yM:60,yB:98},{n:'yuvarlak',wT:31,wM:35,wB:25,yT:28,yM:62,yB:96},
 {n:'uzun',wT:25,wM:28,wB:15,yT:19,yM:60,yB:104},{n:'kare',wT:29,wM:31,wB:30,yT:26,yM:60,yB:97},
 {n:'kalp',wT:33,wM:32,wB:10,yT:26,yM:58,yB:99},{n:'armut',wT:24,wM:33,wB:31,yT:29,yM:63,yB:98}];
const P={
 cinsiyet:['kadın','erkek'],
 yuz:FACES.map(f=>f.n),
 ten:SKIN.map((_,i)=>'ten '+(i+1)),
 sac:['kel','yanlar','kısa','yan ayrık','kirpi','afro','kıvırcık','ibik','perçem','küt','uzun düz','dalgalı','at kuyruğu','topuz','iki örgü','kabarık'],
 sacRenk:['siyah','koyu kahve','kahve','açık kahve','kızıl','sarı','açık sarı','kır','beyaz','mavi','pembe'],
 kas:['ince','kalın','gür','kemerli','kısa','tek kaş'],
 goz:['nokta','boncuk','oval','iri','uykulu','kirpikli'],
 burun:['nokta','patates','sivri','kanca','geniş','kalkık','kırmızı top','çizgi'],
 biyik:['yok','ince','fırça','pala','at nalı','kalem','gür','kıvrık'],
 sakal:['yok','kirli sakal','keçi','tam sakal','uzun sakal','çene','favori'],
 gozluk:['yok','yuvarlak','kare','güneş','yarım','monokl'],
 sapka:['yok','kep','bere','fötr','aşçı','baret','kovboy','ters kep'],
 kiyafet:['tişört','gömlek','balıkçı yaka','ceket ve kravat','kapüşonlu'],
 kRenk:CLOTHC.map((_,i)=>'renk '+(i+1)),
 ek:['yok','çil','ben','kırışık','küpe','çil ve küpe','allık']
};
function shade(hex,a){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;
  const f=a<0?0:255,t=Math.abs(a);r=Math.round(r+(f-r)*t);g=Math.round(g+(f-g)*t);b=Math.round(b+(f-b)*t);return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
const dark=(h,a=.22)=>shade(h,-a),light=(h,a=.25)=>shade(h,a);

function headPath(F,cx=60){const {wT,wM,wB,yT,yM,yB}=F,u=(yM-yT)*.5,d=(yB-yM)*.55;
  return `M${cx} ${yT}C${cx+wT} ${yT} ${cx+wM} ${yM-u} ${cx+wM} ${yM}C${cx+wM} ${yM+d} ${cx+wB} ${yB} ${cx} ${yB}C${cx-wB} ${yB} ${cx-wM} ${yM+d} ${cx-wM} ${yM}C${cx-wM} ${yM-u} ${cx-wT} ${yT} ${cx} ${yT}Z`}

/* ---------- saç: arka katman ve ön katman ---------- */
function hairBack(i,F,c){const {wM,yT,yM}=F,cx=60,W=wM+6;
  switch(P.sac[i]){
   case 'afro':return `<circle cx="${cx}" cy="${yT+20}" r="${wM+15}" fill="${c}"/><circle cx="${cx}" cy="${yT+20}" r="${wM+15}" fill="none" stroke="${dark(c)}" stroke-width="2" stroke-dasharray="3 5"/>`;
   case 'küt':return `<path d="M${cx-W} ${yM+18}V${yM-8}C${cx-W} ${yT-12} ${cx+W} ${yT-12} ${cx+W} ${yM-8}V${yM+18}Q${cx} ${yM+24} ${cx-W} ${yM+18}Z" fill="${c}"/>`;
   case 'uzun düz':return `<path d="M${cx-W} 128V${yM-10}C${cx-W} ${yT-10} ${cx+W} ${yT-10} ${cx+W} ${yM-10}V128Z" fill="${c}"/>`;
   case 'dalgalı':{let s=`M${cx-W} ${yM-10}C${cx-W} ${yT-12} ${cx+W} ${yT-12} ${cx+W} ${yM-10}`;
     for(let y=yM-4;y<124;y+=12)s+=`Q${cx+W+6} ${y+3} ${cx+W} ${y+6}Q${cx+W-5} ${y+9} ${cx+W} ${y+12}`;
     s+=`L${cx-W} 124`;for(let y=124;y>yM-4;y-=12)s+=`Q${cx-W+5} ${y-3} ${cx-W} ${y-6}Q${cx-W-6} ${y-9} ${cx-W} ${y-12}`;return `<path d="${s}Z" fill="${c}"/>`}
   case 'at kuyruğu':return `<path d="M${cx+wM-4} ${yT+14}C${cx+wM+22} ${yT+4} ${cx+wM+24} ${yM+30} ${cx+wM+8} ${yM+38}C${cx+wM+14} ${yM+18} ${cx+wM+6} ${yT+26} ${cx+wM-6} ${yT+22}Z" fill="${c}"/><circle cx="${cx+wM-3}" cy="${yT+17}" r="4" fill="${CLOTHC[0]}"/>`;
   case 'topuz':return `<circle cx="${cx}" cy="${yT-8}" r="13" fill="${c}"/><path d="M${cx-9} ${yT-2}q9 5 18 0" stroke="${dark(c)}" stroke-width="2" fill="none"/>`;
   case 'iki örgü':{let s='';for(const sx of [-1,1]){const x=cx+sx*(wM+2);for(let k=0;k<5;k++)s+=`<ellipse cx="${x}" cy="${yM+4+k*9}" rx="${6-k*.4}" ry="6" fill="${c}" stroke="${dark(c)}" stroke-width="1.2"/>`;
       s+=`<circle cx="${x}" cy="${yM+48}" r="3.5" fill="${CLOTHC[2]}"/>`}return s}
   case 'kıvırcık':{let s='';for(let a=200;a<=340;a+=20){const r=wM+5,x=cx+Math.cos(a*Math.PI/180)*r,y=yT+22+Math.sin(a*Math.PI/180)*(r-2);s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${c}"/>`}
     return s+`<circle cx="${cx-wM-2}" cy="${yM-4}" r="8" fill="${c}"/><circle cx="${cx+wM+2}" cy="${yM-4}" r="8" fill="${c}"/>`}
  }return ''}
function hairFront(i,F,c){const {wT,wM,yT,yM}=F,cx=60,hl=yT+(yM-yT)*.38,L=cx-wM-1,R=cx+wM+1,top=yT-5;
  const cap=(h=hl,extra='')=>`<path d="M${L} ${yM-4}C${L-1} ${top} ${R+1} ${top} ${R} ${yM-4}L${R-4} ${yM-6}C${R-6} ${h} ${cx+8} ${h-2} ${cx} ${h}C${cx-8} ${h-2} ${L+6} ${h} ${L+4} ${yM-6}Z" fill="${c}"/>${extra}`;
  switch(P.sac[i]){
   case 'kel':return `<ellipse cx="${cx-10}" cy="${yT+9}" rx="8" ry="4" fill="#fff" opacity=".35" transform="rotate(-20 ${cx-10} ${yT+9})"/>`;
   case 'yanlar':return `<ellipse cx="${cx-wM+3}" cy="${yM-8}" rx="6" ry="11" fill="${c}"/><ellipse cx="${cx+wM-3}" cy="${yM-8}" rx="6" ry="11" fill="${c}"/><ellipse cx="${cx-10}" cy="${yT+9}" rx="8" ry="4" fill="#fff" opacity=".35" transform="rotate(-20 ${cx-10} ${yT+9})"/>`;
   case 'kısa':return cap();
   case 'yan ayrık':return cap(hl,`<path d="M${cx-14} ${yT+2}C${cx-4} ${hl+4} ${cx+18} ${hl-6} ${R-2} ${hl+6}C${R} ${yT+2} ${cx+10} ${yT-6} ${cx-14} ${yT+2}Z" fill="${c}"/><path d="M${cx-14} ${yT+3}Q${cx-12} ${hl} ${cx-16} ${hl+6}" stroke="${dark(c)}" stroke-width="1.6" fill="none"/>`);
   case 'kirpi':{let s=`M${L} ${yM-4}`;const n=7;for(let k=0;k<=n;k++){const t=k/n,x=L+(R-L)*t,y=yT+8-Math.sin(t*Math.PI)*10;s+=`L${(x-(R-L)/n/2).toFixed(1)} ${(y-9).toFixed(1)}L${x.toFixed(1)} ${(y+2).toFixed(1)}`}
     return `<path d="${s}L${R} ${yM-4}L${R-4} ${yM-6}Q${cx} ${hl-2} ${L+4} ${yM-6}Z" fill="${c}"/>`}
   case 'afro':return `<path d="M${L-2} ${yM-2}C${L-2} ${hl-4} ${cx-10} ${hl+2} ${cx} ${hl+1}C${cx+10} ${hl+2} ${R+2} ${hl-4} ${R+2} ${yM-2}L${R+8} ${yM-2}V${yT}H${L-8}V${yM-2}Z" fill="${c}"/>`;
   case 'kıvırcık':{let s='';for(let k=0;k<7;k++){const x=L+3+k*(R-L-6)/6;s+=`<circle cx="${x.toFixed(1)}" cy="${(hl-2+Math.abs(k-3)*1.6).toFixed(1)}" r="6" fill="${c}"/>`}return cap(hl-4,s)}
   case 'ibik':return `<path d="M${cx-7} ${hl+2}C${cx-10} ${yT-14} ${cx+2} ${yT-26} ${cx+12} ${yT-20}C${cx+6} ${yT-8} ${cx+8} ${hl-4} ${cx+7} ${hl+2}Z" fill="${c}"/><path d="M${cx-wM+2} ${yM-6}v-8M${cx+wM-2} ${yM-6}v-8" stroke="${c}" stroke-width="3" opacity=".5" stroke-linecap="round"/>`;
   case 'perçem':{const b=yT+(yM-yT)*.6;return `<path d="M${L} ${yM-2}C${L-1} ${top} ${R+1} ${top} ${R} ${yM-2}L${R-3} ${b}H${L+3}Z" fill="${c}"/><path d="M${cx-14} ${b}v-6M${cx} ${b}v-7M${cx+14} ${b}v-6" stroke="${dark(c)}" stroke-width="1.4"/>`}
   case 'küt':return `<path d="M${L} ${yM-2}C${L-1} ${top} ${R+1} ${top} ${R} ${yM-2}L${R-4} ${yM-4}C${R-8} ${hl} ${cx+4} ${hl+4} ${cx-6} ${hl+2}C${cx-14} ${hl+10} ${L+6} ${yM-6} ${L+4} ${yM}Z" fill="${c}"/>`;
   case 'uzun düz':case 'dalgalı':case 'iki örgü':return `<path d="M${L} ${yM+4}C${L-1} ${top} ${R+1} ${top} ${R} ${yM+4}L${R-4} ${yM-4}C${R-6} ${hl} ${cx+6} ${hl} ${cx} ${hl-4}C${cx-6} ${hl} ${L+6} ${hl} ${L+4} ${yM-4}Z" fill="${c}"/><path d="M${cx} ${yT-2}V${hl-4}" stroke="${dark(c)}" stroke-width="1.4"/>`;
   case 'at kuyruğu':case 'topuz':return cap(hl,`<path d="M${cx-wM+8} ${hl+2}Q${cx} ${yT+2} ${cx+wM-8} ${hl+2}" stroke="${dark(c)}" stroke-width="1.2" fill="none" opacity=".6"/>`);
   case 'kabarık':return cap(hl,`<path d="M${L+2} ${hl+4}C${L-2} ${yT-18} ${R+8} ${yT-24} ${R} ${hl}C${R-8} ${yT} ${cx-8} ${yT-4} ${L+2} ${hl+4}Z" fill="${c}"/><path d="M${cx-8} ${yT-6}Q${cx+6} ${yT-14} ${R-4} ${yT-2}" stroke="${light(c,.3)}" stroke-width="2" fill="none"/>`);
  }return ''}

/* ---------- gözler ---------- */
function eyeBase(t,x,y,s=1){const r=v=>(v*s).toFixed(2);
  switch(P.goz[t]){
   case 'nokta':return `<circle cx="${x}" cy="${y}" r="${r(3.4)}" fill="${INK}"/><circle cx="${x+1.1}" cy="${y-1.2}" r="1" fill="#fff"/>`;
   case 'boncuk':return `<circle cx="${x}" cy="${y}" r="${r(5.2)}" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="${x+.8}" cy="${y+.4}" r="${r(3)}" fill="${INK}"/><circle cx="${x+1.8}" cy="${y-.8}" r="1.1" fill="#fff"/>`;
   case 'oval':return `<ellipse cx="${x}" cy="${y}" rx="${r(3.2)}" ry="${r(4.8)}" fill="${INK}"/><circle cx="${x+1}" cy="${y-1.8}" r="1.2" fill="#fff"/>`;
   case 'iri':return `<ellipse cx="${x}" cy="${y}" rx="${r(6.4)}" ry="${r(7.2)}" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="${x+.6}" cy="${y+1}" r="${r(3.6)}" fill="${INK}"/><circle cx="${x+1.9}" cy="${y-.4}" r="1.3" fill="#fff"/>`;
   case 'uykulu':return `<ellipse cx="${x}" cy="${y+1}" rx="${r(5.4)}" ry="${r(3.6)}" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="${x}" cy="${y+2}" r="${r(2.4)}" fill="${INK}"/><path d="M${x-6} ${y}Q${x} ${y-2.6} ${x+6} ${y}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
   case 'kirpikli':{const o=x<60?-1:1;return `<ellipse cx="${x}" cy="${y}" rx="${r(3.4)}" ry="${r(4.6)}" fill="${INK}"/><circle cx="${x+1}" cy="${y-1.6}" r="1.2" fill="#fff"/><path d="M${x+o*3} ${y-3.5}l${o*3} -2.5M${x+o*3.6} ${y-1}l${o*3.4} -1" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`}
  }return ''}
function eyes(m,e,F,skin){const y=F.yM-5,dx=12,L=60-dx,R=60+dx;
  if(e==='happy')return `<path d="M${L-5} ${y+1}q5 -7 10 0M${R-5} ${y+1}q5 -7 10 0" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`+(m.cinsiyet===0?`<path d="M${L-5} ${y+1}l-3 -2M${R+5} ${y+1}l3 -2" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`:'');
  if(e==='love')return [L,R].map(x=>`<path class="hb" d="M${x} ${y+6}l-6.5 -6.5a3.9 3.9 0 0 1 6.5 -4.4a3.9 3.9 0 0 1 6.5 4.4z" fill="#e8384f"/>`).join('');
  const lash=m.cinsiyet===0&&P.goz[m.goz]!=='kirpikli'?`<path d="M${L-4} ${y-3}l-3 -2.4M${R+4} ${y-3}l3 -2.4" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`:'';
  let s=`<g class="blink">${eyeBase(m.goz,L,y,e==='imp'?1.18:1)}${eyeBase(m.goz,R,y,e==='imp'?1.18:1)}${lash}</g>`;
  if(e==='angry')s+=`<path d="M${L-8} ${y-8}L${L+6} ${y-1}L${L+6} ${y-9}ZM${R+8} ${y-8}L${R-6} ${y-1}L${R-6} ${y-9}Z" fill="${skin}"/><path d="M${L-7} ${y-5.5}L${L+5} ${y-1}M${R+7} ${y-5.5}L${R-5} ${y-1}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  if(e==='sad')s+=`<path d="M${L-7} ${y-1}L${L+6} ${y-6}L${L-7} ${y-8}ZM${R+7} ${y-1}L${R-6} ${y-6}L${R+7} ${y-8}Z" fill="${skin}"/><path d="M${L-6} ${y-1.5}L${L+5} ${y-5.5}M${R+6} ${y-1.5}L${R-5} ${y-5.5}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
  return s}
/* ---------- kaşlar (duyguya göre eğilir) ---------- */
function brows(m,e,F,c){const y=F.yM-15,dx=12;const tilt={happy:-4,wait:0,imp:-10,angry:18,love:-6,sad:-16}[e],lift={happy:-2,wait:0,imp:-4,angry:2,love:-3,sad:-2}[e];
  const one=(sx)=>{const x=60+sx*dx,yy=y+lift;let d,w=2.4,fill='none';
    switch(P.kas[m.kas]){
     case 'ince':d=`M${x-6} ${yy+1}Q${x} ${yy-3} ${x+6} ${yy+1}`;w=1.8;break;
     case 'kalın':d=`M${x-6} ${yy+1}Q${x} ${yy-3} ${x+6} ${yy+1}`;w=4.4;break;
     case 'gür':return `<path transform="rotate(${-sx*tilt} ${x} ${yy})" d="M${x-7} ${yy+2}l2 -5l2 3l2 -5l2 4l2 -5l2 4l2 -3l1 6q-7 -3 -15 1z" fill="${c}"/>`;
     case 'kemerli':d=`M${x-7} ${yy+3}Q${x-2} ${yy-6} ${x+6} ${yy}`;w=2.6;if(sx<0)d=`M${x+7} ${yy+3}Q${x+2} ${yy-6} ${x-6} ${yy}`;break;
     case 'kısa':return `<rect transform="rotate(${-sx*tilt} ${x} ${yy})" x="${x-4}" y="${yy-2.5}" width="8" height="5" rx="2.5" fill="${c}"/>`;
     case 'tek kaş':d=`M${x-sx*6} ${yy+1}Q${x} ${yy-3} ${60+sx*.5} ${yy+1}`;w=4.2;break}
    return `<path transform="rotate(${-sx*tilt} ${x} ${yy})" d="${d}" stroke="${c}" stroke-width="${w}" fill="${fill}" stroke-linecap="round"/>`};
  return one(-1)+one(1)}
/* ---------- burun ---------- */
function nose(i,F,skin){const x=60,y=F.yM+6,d=dark(skin,.18),dd=dark(skin,.35);
  switch(P.burun[i]){
   case 'nokta':return `<ellipse cx="${x}" cy="${y+2}" rx="3" ry="2.2" fill="${dd}" opacity=".7"/>`;
   case 'patates':return `<circle cx="${x}" cy="${y}" r="7.5" fill="${d}"/><circle cx="${x-2.5}" cy="${y-2.5}" r="2" fill="#fff" opacity=".35"/><circle cx="${x-3}" cy="${y+4}" r="1.2" fill="${dd}"/><circle cx="${x+3}" cy="${y+4}" r="1.2" fill="${dd}"/>`;
   case 'sivri':return `<path d="M${x-2} ${y-12}L${x+9} ${y+5}Q${x+1} ${y+7} ${x-3} ${y+4}Z" fill="${d}" stroke="${dd}" stroke-width="1.2" stroke-linejoin="round"/>`;
   case 'kanca':return `<path d="M${x-1} ${y-11}C${x+8} ${y-6} ${x+10} ${y+4} ${x+3} ${y+6}C${x} ${y+7} ${x-3} ${y+5} ${x-1} ${y+2}" fill="${d}" stroke="${dd}" stroke-width="1.4" stroke-linecap="round"/>`;
   case 'geniş':return `<ellipse cx="${x}" cy="${y+2}" rx="9" ry="5.5" fill="${d}"/><path d="M${x-5} ${y+4}q2 2 3 0M${x+2} ${y+4}q1 2 3 0" stroke="${dd}" stroke-width="1.4" fill="none"/>`;
   case 'kalkık':return `<path d="M${x-1} ${y-7}Q${x+6} ${y+2} ${x+4} ${y+4}Q${x} ${y+6} ${x-4} ${y+4}" fill="${d}" stroke="${dd}" stroke-width="1.2"/><ellipse cx="${x-1.5}" cy="${y+3.4}" rx="1.4" ry="1" fill="${dd}"/><ellipse cx="${x+2.4}" cy="${y+3.4}" rx="1.4" ry="1" fill="${dd}"/>`;
   case 'kırmızı top':return `<circle cx="${x}" cy="${y+1}" r="6.5" fill="#e0675a"/><circle cx="${x-2}" cy="${y-1.5}" r="1.8" fill="#fff" opacity=".5"/>`;
   case 'çizgi':return `<path d="M${x} ${y-8}L${x-3} ${y+4}L${x+3} ${y+4}" stroke="${dd}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }return ''}
/* ---------- ağız (duyguya göre) ---------- */
function mouth(e,F,lip){const x=60,y=F.yM+20,LC=lip?'#c4455a':INK;
  switch(e){
   case 'happy':return `<path d="M${x-10} ${y-2}Q${x} ${y+13} ${x+10} ${y-2}Z" fill="#6b2422" stroke="${LC}" stroke-width="${lip?2.6:1.8}" stroke-linejoin="round"/><path d="M${x-8.5} ${y-1}h17v2.6q-8.5 2.2 -17 0z" fill="#fff"/><path d="M${x-4} ${y+6}q4 -3.5 8 0q-4 2.6 -8 0z" fill="#e8737b"/>`;
   case 'love':return `<path d="M${x-7} ${y-1}Q${x} ${y+9} ${x+7} ${y-1}Z" fill="#6b2422" stroke="${LC}" stroke-width="${lip?2.6:1.8}" stroke-linejoin="round"/><path d="M${x-3} ${y+3.5}q3 -2.5 6 0q-3 2 -6 0z" fill="#e8737b"/>`;
   case 'wait':return `<path d="M${x-6} ${y}q6 3.5 12 0" stroke="${LC}" stroke-width="${lip?3:2.2}" fill="none" stroke-linecap="round"/>`;
   case 'imp':return `<rect x="${x-8}" y="${y-3}" width="16" height="7" rx="3" fill="#fff" stroke="${INK}" stroke-width="1.6"/><path d="M${x-3} ${y-3}v7M${x+2} ${y-3}v7" stroke="${INK}" stroke-width="1"/>`;
   case 'angry':return `<path d="M${x-10} ${y+5}Q${x} ${y-7} ${x+10} ${y+5}Z" fill="#6b2422" stroke="${LC}" stroke-width="${lip?2.6:1.8}" stroke-linejoin="round"/><path d="M${x-7} ${y+2.4}Q${x} ${y-3.4} ${x+7} ${y+2.4}l-1 1.6q-6 -3.6 -12 0z" fill="#fff"/>`;
   case 'sad':return `<path d="M${x-7} ${y+4}q7 -7 14 0" stroke="${LC}" stroke-width="${lip?3:2.2}" fill="none" stroke-linecap="round"/>`;
  }return ''}
/* ---------- bıyık ve sakal ---------- */
function mustache(i,F,c){const x=60,y=F.yM+14,dc=dark(c);
  switch(P.biyik[i]){
   case 'ince':return `<path d="M${x-10} ${y+2}Q${x-5} ${y-3} ${x} ${y}Q${x+5} ${y-3} ${x+10} ${y+2}Q${x+5} ${y} ${x} ${y+1.6}Q${x-5} ${y} ${x-10} ${y+2}Z" fill="${c}"/>`;
   case 'fırça':return `<rect x="${x-6}" y="${y-3}" width="12" height="6" rx="2" fill="${c}"/>`;
   case 'pala':return `<path d="M${x} ${y-1}C${x-6} ${y-5} ${x-12} ${y-3} ${x-14} ${y+1}C${x-17} ${y+3} ${x-20} ${y-1} ${x-18} ${y-5}C${x-17} ${y+1} ${x-14} ${y+5} ${x} ${y+3}C${x+14} ${y+5} ${x+17} ${y+1} ${x+18} ${y-5}C${x+20} ${y-1} ${x+17} ${y+3} ${x+14} ${y+1}C${x+12} ${y-3} ${x+6} ${y-5} ${x} ${y-1}Z" fill="${c}"/>`;
   case 'at nalı':return `<path d="M${x-12} ${y+16}V${y+1}Q${x-10} ${y-4} ${x} ${y-2}Q${x+10} ${y-4} ${x+12} ${y+1}V${y+16}H${x+8}V${y+3}Q${x} ${y+1} ${x-8} ${y+3}V${y+16}Z" fill="${c}"/>`;
   case 'kalem':return `<path d="M${x-9} ${y+1}Q${x} ${y-2} ${x+9} ${y+1}" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
   case 'gür':return `<path d="M${x-14} ${y+5}C${x-14} ${y-5} ${x-4} ${y-5} ${x} ${y-2}C${x+4} ${y-5} ${x+14} ${y-5} ${x+14} ${y+5}C${x+9} ${y+3} ${x+5} ${y+6} ${x} ${y+4}C${x-5} ${y+6} ${x-9} ${y+3} ${x-14} ${y+5}Z" fill="${c}"/><path d="M${x-8} ${y}v3M${x-4} ${y-1}v3M${x+4} ${y-1}v3M${x+8} ${y}v3" stroke="${dc}" stroke-width="1"/>`;
   case 'kıvrık':return `<path d="M${x} ${y}C${x-5} ${y-4} ${x-11} ${y-2} ${x-12} ${y+2}C${x-12} ${y+5} ${x-9} ${y+5} ${x-8} ${y+3}C${x-6} ${y+1} ${x-3} ${y+2} ${x} ${y+3}C${x+3} ${y+2} ${x+6} ${y+1} ${x+8} ${y+3}C${x+9} ${y+5} ${x+12} ${y+5} ${x+12} ${y+2}C${x+11} ${y-2} ${x+5} ${y-4} ${x} ${y}Z" fill="${c}"/>`;
  }return ''}
function beard(i,F,c){const {wM,wB,yM,yB}=F,x=60,my=yM+20,d=(yB-yM)*.6;
  const outer=(ext=7)=>`M${x-wM} ${yM}C${x-wM} ${yM+d} ${x-wB-2} ${yB+ext-1} ${x} ${yB+ext}C${x+wB+2} ${yB+ext-1} ${x+wM} ${yM+d} ${x+wM} ${yM}`;
  const inner=`L${x+wM-5} ${yM+3}Q${x+17} ${my-6} ${x+11} ${my-4}Q${x} ${my+11} ${x-11} ${my-4}Q${x-17} ${my-6} ${x-wM+5} ${yM+3}Z`;
  switch(P.sakal[i]){
   case 'kirli sakal':return `<path d="${outer(1)}${inner}" fill="${c}" opacity=".16"/>`;
   case 'keçi':return `<path d="M${x-7} ${my+7}Q${x} ${my+5} ${x+7} ${my+7}Q${x+5} ${yB+8} ${x} ${yB+10}Q${x-5} ${yB+8} ${x-7} ${my+7}Z" fill="${c}"/>`;
   case 'tam sakal':return `<path d="${outer(7)}${inner}" fill="${c}"/><path d="M${x-8} ${yB}l2 4M${x} ${yB+2}v4M${x+8} ${yB}l-2 4" stroke="${dark(c)}" stroke-width="1.2"/>`;
   case 'uzun sakal':return `<path d="M${x-wM} ${yM}C${x-wM} ${yM+d} ${x-wB-6} ${yB+14} ${x} ${yB+30}C${x+wB+6} ${yB+14} ${x+wM} ${yM+d} ${x+wM} ${yM}${inner}" fill="${c}"/><path d="M${x-6} ${yB+4}q2 8 4 14M${x+6} ${yB+4}q-2 8 -4 14" stroke="${dark(c)}" stroke-width="1.2" fill="none"/>`;
   case 'çene':return `<path d="M${x-wM+1} ${yM-2}C${x-wM+1} ${yM+d} ${x-wB} ${yB+3} ${x} ${yB+3}C${x+wB} ${yB+3} ${x+wM-1} ${yM+d} ${x+wM-1} ${yM-2}" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
   case 'favori':return `<path d="M${x-wM+1} ${yM-12}V${yM+10}Q${x-wM+6} ${yM+16} ${x-wM+9} ${yM+8}V${yM-12}Z M${x+wM-1} ${yM-12}V${yM+10}Q${x+wM-6} ${yM+16} ${x+wM-9} ${yM+8}V${yM-12}Z" fill="${c}"/>`;
  }return ''}
/* ---------- gözlük, şapka, kıyafet, ekler ---------- */
function glasses(i,F){const y=F.yM-5,L=48,R=72,f=INK;
  switch(P.gozluk[i]){
   case 'yuvarlak':return `<g fill="#fff" fill-opacity=".18" stroke="${f}" stroke-width="2"><circle cx="${L}" cy="${y}" r="8"/><circle cx="${R}" cy="${y}" r="8"/></g><path d="M${L+8} ${y}q4 -3 8 0M${L-8} ${y-1}l-${F.wM-20} -2M${R+8} ${y-1}l${F.wM-20} -2" stroke="${f}" stroke-width="2" fill="none"/>`;
   case 'kare':return `<g fill="#fff" fill-opacity=".18" stroke="${f}" stroke-width="2.4"><rect x="${L-9}" y="${y-7}" width="18" height="13" rx="3"/><rect x="${R-9}" y="${y-7}" width="18" height="13" rx="3"/></g><path d="M${L+9} ${y-2}h6M${L-9} ${y-3}l-${F.wM-21} -1M${R+9} ${y-3}l${F.wM-21} -1" stroke="${f}" stroke-width="2.4"/>`;
   case 'güneş':return `<path d="M${L-10} ${y-7}h20q0 13 -10 13t-10 -13zM${R-10} ${y-7}h20q0 13 -10 13t-10 -13z" fill="#1b1b22"/><path d="M${L+10} ${y-6}h4M${L-10} ${y-6}l-${F.wM-22} -1M${R+10} ${y-6}l${F.wM-22} -1" stroke="#1b1b22" stroke-width="2.4"/><path d="M${L-6} ${y-4}l4 0M${R-6} ${y-4}l4 0" stroke="#fff" stroke-width="1.6" opacity=".6"/>`;
   case 'yarım':return `<path d="M${L-8} ${y+1}h16q0 6 -8 6t-8 -6zM${R-8} ${y+1}h16q0 6 -8 6t-8 -6z" fill="#fff" fill-opacity=".2" stroke="${f}" stroke-width="2"/><path d="M${L+8} ${y+1}h8" stroke="${f}" stroke-width="2"/>`;
   case 'monokl':return `<circle cx="${R}" cy="${y}" r="8.5" fill="#fff" fill-opacity=".18" stroke="#c9a227" stroke-width="2.2"/><path d="M${R+6} ${y+6}q6 14 -2 30" stroke="#c9a227" stroke-width="1.2" fill="none"/>`;
  }return ''}
function hat(i,F,cc){const {wM,yT}=F,x=60,W=wM+3;
  switch(P.sapka[i]){
   case 'kep':return `<path d="M${x-W} ${yT+14}C${x-W} ${yT-12} ${x+W} ${yT-12} ${x+W} ${yT+14}Z" fill="${cc}"/><path d="M${x+W-6} ${yT+12}Q${x+W+18} ${yT+10} ${x+W+20} ${yT+16}Q${x+W+4} ${yT+18} ${x-4} ${yT+16}Z" fill="${dark(cc)}"/><circle cx="${x}" cy="${yT-6}" r="2.6" fill="${dark(cc)}"/>`;
   case 'ters kep':return `<path d="M${x-W} ${yT+14}C${x-W} ${yT-12} ${x+W} ${yT-12} ${x+W} ${yT+14}Z" fill="${cc}"/><path d="M${x-W+6} ${yT+8}Q${x-W-14} ${yT+6} ${x-W-16} ${yT+12}Q${x-W-2} ${yT+15} ${x-W+8} ${yT+14}Z" fill="${dark(cc)}"/><rect x="${x-6}" y="${yT+8}" width="12" height="5" rx="2" fill="${light(cc)}"/>`;
   case 'bere':return `<path d="M${x-W} ${yT+16}C${x-W} ${yT-16} ${x+W} ${yT-16} ${x+W} ${yT+16}Z" fill="${cc}"/><rect x="${x-W-1}" y="${yT+8}" width="${2*W+2}" height="10" rx="5" fill="${dark(cc)}"/><circle cx="${x}" cy="${yT-11}" r="6" fill="${light(cc,.45)}"/>`;
   case 'fötr':return `<ellipse cx="${x}" cy="${yT+12}" rx="${W+12}" ry="6" fill="${dark(cc,.35)}"/><path d="M${x-W+6} ${yT+11}L${x-W+8} ${yT-10}Q${x} ${yT-4} ${x+W-8} ${yT-10}L${x+W-6} ${yT+11}Z" fill="${dark(cc,.25)}"/><rect x="${x-W+6}" y="${yT+3}" width="${2*W-12}" height="5" fill="${cc}"/>`;
   case 'aşçı':return `<path d="M${x-W+4} ${yT+14}V${yT}C${x-W-6} ${yT-6} ${x-W+2} ${yT-22} ${x-10} ${yT-18}C${x-6} ${yT-30} ${x+8} ${yT-30} ${x+11} ${yT-18}C${x+W-2} ${yT-22} ${x+W+6} ${yT-6} ${x+W-4} ${yT}V${yT+14}Z" fill="#fff" stroke="#d9d2c4" stroke-width="1.6"/><path d="M${x-W+4} ${yT+6}H${x+W-4}" stroke="#d9d2c4" stroke-width="1.4"/>`;
   case 'baret':return `<path d="M${x-W} ${yT+14}C${x-W} ${yT-14} ${x+W} ${yT-14} ${x+W} ${yT+14}Z" fill="#f2b630"/><rect x="${x-W-6}" y="${yT+11}" width="${2*W+12}" height="6" rx="3" fill="#d99a1c"/><rect x="${x-3}" y="${yT-9}" width="6" height="20" rx="3" fill="#ffd25e"/>`;
   case 'kovboy':return `<path d="M${x-W-14} ${yT+8}Q${x-W-10} ${yT+18} ${x} ${yT+17}Q${x+W+10} ${yT+18} ${x+W+14} ${yT+8}Q${x+W} ${yT+14} ${x} ${yT+13}Q${x-W} ${yT+14} ${x-W-14} ${yT+8}Z" fill="#8a5a33"/><path d="M${x-W+6} ${yT+13}L${x-W+4} ${yT-6}Q${x-8} ${yT-14} ${x} ${yT-6}Q${x+8} ${yT-14} ${x+W-4} ${yT-6}L${x+W-6} ${yT+13}Z" fill="#a46d3e"/><rect x="${x-W+5}" y="${yT+6}" width="${2*W-10}" height="4" fill="#5b3a20"/>`;
  }return ''}
function clothes(i,c,skin){const dc=dark(c),neck=`<path d="M50 ${92}h20v18q-10 6 -20 0z" fill="${dark(skin,.12)}"/>`;
  const body=`<path d="M14 140C14 116 30 106 60 106C90 106 106 116 106 140Z" fill="${c}"/>`;
  switch(P.kiyafet[i]){
   case 'tişört':return neck+body+`<path d="M48 107Q60 118 72 107" stroke="${dc}" stroke-width="3" fill="none"/>`;
   case 'gömlek':return neck+body+`<path d="M60 116L47 105L52 120ZM60 116L73 105L68 120Z" fill="#fff" stroke="${dark('#ffffff',.15)}" stroke-width="1"/><circle cx="60" cy="124" r="1.6" fill="${dc}"/><circle cx="60" cy="132" r="1.6" fill="${dc}"/>`;
   case 'balıkçı yaka':return neck+body+`<rect x="46" y="100" width="28" height="12" rx="6" fill="${dc}"/><path d="M50 104v6M55 103v8M60 103v8M65 103v8M70 104v6" stroke="${dark(c,.35)}" stroke-width="1"/>`;
   case 'ceket ve kravat':return neck+`<path d="M14 140C14 116 30 106 60 106C90 106 106 116 106 140Z" fill="${dark(c,.3)}"/><path d="M48 106L60 140L72 106Z" fill="#fff"/><path d="M57 110h6l-1 4l3 18l-5 6l-5 -6l3 -18z" fill="#c8322b"/><path d="M48 106L56 128L44 116ZM72 106L64 128L76 116Z" fill="${dark(c,.45)}"/>`;
   case 'kapüşonlu':return `<path d="M34 112Q60 92 86 112Q60 124 34 112Z" fill="${dc}"/>`+neck+body+`<path d="M44 108Q60 124 76 108" stroke="${dc}" stroke-width="4" fill="none"/><path d="M53 114v14M67 114v14" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
  }return neck+body}
function extras(i,F,skin,hc){const {yM,wM}=F,x=60,list=P.ek[i];let s='';
  if(/çil/.test(list))for(const sx of [-1,1])for(const [a,b] of [[0,0],[4,2],[-3,3],[2,5]])s+=`<circle cx="${x+sx*(17+a)}" cy="${yM+6+b}" r=".9" fill="${dark(skin,.35)}"/>`;
  if(list==='ben')s+=`<circle cx="${x+14}" cy="${yM+15}" r="1.5" fill="${dark(skin,.55)}"/>`;
  if(list==='kırışık')s+=`<path d="M${x-10} ${F.yT+14}q5 -2 10 0t10 0M${x-8} ${F.yT+19}q4 -1.6 8 0t8 0M${x-wM+5} ${yM-6}l-3 -1M${x-wM+5} ${yM-3}l-3 1M${x+wM-5} ${yM-6}l3 -1M${x+wM-5} ${yM-3}l3 1" stroke="${dark(skin,.3)}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  if(/küpe/.test(list))s+=`<circle cx="${x-wM-1}" cy="${yM+8}" r="2.4" fill="#f2c94c" stroke="#c9a227" stroke-width=".8"/><circle cx="${x+wM+1}" cy="${yM+8}" r="2.4" fill="#f2c94c" stroke="#c9a227" stroke-width=".8"/>`;
  return s}
function cheeks(i,e,F){const {yM}=F,list=P.ek[i];const o=e==='angry'?.75:list==='allık'?.6:(e==='happy'||e==='love')?.45:.18;const c=e==='angry'?'#ff5a4a':'#ff8fa3';
  return `<ellipse cx="${60-20}" cy="${yM+10}" rx="6" ry="3.5" fill="${c}" opacity="${o}"/><ellipse cx="${60+20}" cy="${yM+10}" rx="6" ry="3.5" fill="${c}" opacity="${o}"/>`}
function moodFx(e,F){const {yT,yM,wM}=F;
  if(e==='angry')return `<g fill="#d6dbe1"><circle class="st" cx="${60-wM}" cy="${yT+4}" r="6"/><circle class="st d2" cx="${60+wM}" cy="${yT+4}" r="6"/><circle class="st d3" cx="60" cy="${yT-8}" r="5"/></g>`;
  if(e==='imp')return `<path class="sw" d="M${60+wM+2} ${yM-22}q-4 7 0 9q4 -2 0 -9z" fill="#5fb1f0"/>`;
  if(e==='sad')return `<path class="tr" d="M${60+17} ${yM+1}q-3 5 0 7q3 -2 0 -7z" fill="#5fb1f0"/>`;
  if(e==='love')return `<path class="hb" d="M${60+wM+4} ${yT+6}l-5 -5a3 3 0 0 1 5 -3.3a3 3 0 0 1 5 3.3z" fill="#e8384f"/>`;
  return ''}

function draw(m,e='wait'){const F=FACES[m.yuz],skin=SKIN[m.ten],hc=HAIRC[m.sacRenk],cc=CLOTHC[m.kRenk];
  const ears=`<g fill="${skin}"><ellipse cx="${60-F.wM}" cy="${F.yM}" rx="6" ry="8"/><ellipse cx="${60+F.wM}" cy="${F.yM}" rx="6" ry="8"/></g><path d="M${60-F.wM-1} ${F.yM-3}q-2 3 0 6M${60+F.wM+1} ${F.yM-3}q2 3 0 6" stroke="${dark(skin,.25)}" stroke-width="1.4" fill="none"/>`;
  const head=`<path d="${headPath(F)}" fill="${skin}"/>`;
  const browC=m.sacRenk===8?dark(hc,.25):m.sacRenk>=9?HAIRC[1]:hc;
  const body=hairBack(m.sac,F,hc)+clothes(m.kiyafet,cc,skin)+ears+head+extras(m.ek,F,skin,hc)+cheeks(m.ek,e,F)+beard(m.sakal,F,hc)+mouth(e,F,m.cinsiyet===0)+mustache(m.biyik,F,hc)+nose(m.burun,F,skin)+eyes(m,e,F,skin)+brows(m,e,F,browC)+glasses(m.gozluk,F)+hairFront(m.sac,F,hc)+hat(m.sapka,F,cc);
  return `<svg viewBox="-4 -14 128 154" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g class="mu m-${e}">${body}</g>${moodFx(e,F)}</svg>`}

/* cinsiyete göre izin verilen seçenekler (adlarla) */
const ALLOW={
 kadın:{yuz:['oval','yuvarlak','uzun','kalp','armut'],sac:['perçem','küt','uzun düz','dalgalı','at kuyruğu','topuz','iki örgü','kıvırcık','afro','kısa'],
   kas:['ince','kemerli','kalın'],goz:['oval','iri','kirpikli','boncuk','nokta'],burun:['nokta','kalkık','çizgi','sivri','patates'],
   biyik:['yok'],sakal:['yok'],kiyafet:['tişört','gömlek','balıkçı yaka','kapüşonlu','ceket ve kravat'],sapka:['yok','kep','bere','fötr','aşçı','ters kep']},
 erkek:{sac:['kel','yanlar','kısa','yan ayrık','kirpi','afro','kıvırcık','ibik','kabarık','perçem'],goz:['nokta','boncuk','oval','iri','uykulu'],
   ek:['yok','çil','ben','kırışık']}
};
function allowed(m,k){const g=P.cinsiyet[m.cinsiyet|0],a=ALLOW[g]&&ALLOW[g][k];return a?a.map(n=>P[k].indexOf(n)):P[k].map((_,i)=>i)}
function coerce(m){for(const k of Object.keys(P)){if(k==='cinsiyet')continue;const a=allowed(m,k);if(!a.includes(m[k]))m[k]=a[Math.abs(m[k]|0)%a.length]}return m}
function rng(seed){let s=seed>>>0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const pickW=(r,w)=>{let t=w.reduce((a,b)=>a+b,0),x=r()*t;for(let i=0;i<w.length;i++){if((x-=w[i])<0)return i}return w.length-1};
function random(seed){const r=rng(seed);const m={cinsiyet:r()<.5?0:1};const W=m.cinsiyet===0;
  const n=k=>{const a=allowed(m,k);return a[Math.floor(r()*a.length)]};
  Object.assign(m,{yuz:n('yuz'),ten:n('ten'),sac:n('sac'),kas:n('kas'),goz:n('goz'),burun:n('burun'),kiyafet:n('kiyafet'),kRenk:n('kRenk')});
  const old=r()<.18;
  m.sacRenk=old?(r()<.5?7:8):pickW(r,[14,14,10,8,5,8,4,1,1,1.2,1.2]);
  m.biyik=!W&&r()<.35?1+Math.floor(r()*7):0;
  m.sakal=!W&&r()<.35?1+Math.floor(r()*6):0;
  m.gozluk=r()<(old?.6:.25)?pickW(r,[0,5,5,2,old?4:1,.6]):0;
  m.sapka=r()<.28?1+Math.floor(r()*7):0;
  m.ek=old?3:W?pickW(r,[6,3,2,0,5,2,4]):pickW(r,[10,3,2,0,0,0,0]);
  if(W&&old&&r()<.5)m.ek=4;
  if(m.sapka&&['afro','ibik','topuz','kabarık','kirpi'].includes(P.sac[m.sac]))m.sapka=0;
  return coerce(m)}
function total(){return ['kadın','erkek'].reduce((t,g)=>{const m={cinsiyet:P.cinsiyet.indexOf(g)};return t+Object.keys(P).filter(k=>k!=='cinsiyet').reduce((a,k)=>a*allowed(m,k).length,1)},0)}
window.Musteri={draw,random,PARTS:P,total,allowed,coerce,EMOTIONS:['happy','wait','imp','angry','love','sad']};
})();
