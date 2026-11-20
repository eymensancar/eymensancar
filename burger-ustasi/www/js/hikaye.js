/* Burger Ustası: açılış hikâyesi (BU.HIKAYE). Kendi başına çalışan modül; DOM'u yalnız verilen kapsayıcının içine kurar.
   Arayüz:
     BU.HIKAYE.oynat(kapsayici, {dil:'tr'|'en', bitince:fn, sesAc:fn, muzik:true, yol:'g/'})
       kapsayici: oyun alanını kaplayan bir div (ör. #app içinde position:absolute;inset:0 olan). İçine .hk kökü eklenir.
       bitince: hikâye bitince ya da "Geç"e basılınca bir kez çağrılır (kök kaldırıldıktan sonra).
       sesAc: ilk dokunuşta çağrılır (oyunun ses kilidi; verilmezse BU.SES.ac). muzik:false → müzik isteği gönderilmez.
       yol: tente görselinin klasörü (varsayılan BU.BURGER.YOL ya da 'g/').
     BU.HIKAYE.durdur()   her şeyi hemen kaldırır, bitince çağrılmaz.
     BU.HIKAYE._git(i)    (deneme) i. sahneye atlar.
     BU.HIKAYE.SAHNELER   sahne adları; BU.HIKAYE.METIN {tr:[…], en:[…]} sahne cümleleri.
   Hikâye: Bombastik Burger (rakip zincir, sahibi Bombastik Bey / Mr. Bombastic) → alay → küçük dükkân kapanır →
   cepte 50 para → karşıdaki eski dükkân kiralanır → "Kirayı öde, müşterileri kazan, rakibi geç!" → oyunun adı.
   Dokunuş sonraki sahneye geçer; sağ üstteki "Geç" her şeyi atlar. Hareketi azalt açıkken animasyonsuz, sade geçiş.
   Bütün ölçüler --u birimiyle: min(1cqw, .55cqh) (kök container-type:size). Sınıflar 'hk-' önekli. */
(function(){
'use strict';
const W=window,BU=W.BU=W.BU||{};
const INK='#2a1a10';
const O=`stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2=`stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;

/* ---------------- metinler ---------------- */
const METIN={
 tr:{
  s:['Şehrin en gösterişli burgercisi: <b>Bombastik Burger</b>.',
     'Sahibi <b>Bombastik Bey</b>, küçük dükkânımızla alay etti.',
     'Müşteriler ona gitti; küçük dükkân kapandı.',
     'Cebinde yalnız <b>50 para</b> kaldı.',
     'Sokağın karşısında küçük, eski bir dükkân kiraladın.',
     '<b>Kirayı öde, müşterileri kazan, rakibi geç!</b>',
     ''],
  marka:'BOMBASTİK',burger:'BURGER',gec:'Geç',kapandi:'KAPANDI',kiralik:'KİRALIK',tabela:['BURGER','USTASI'],
  ha:'HA HA HA!',hedef:['Kira','Müşteri','Rakip'],logo:['BURGER','USTASI'],basla:'Başlamak için dokun',
  etiket:'Açılış hikâyesi'},
 en:{
  s:['The flashiest burger joint in town: <b>Bombastic Burger</b>.',
     'Its owner, <b>Mr. Bombastic</b>, laughed at our little shop.',
     'The customers went to him, and our little shop closed.',
     'All you had left: <b>50 coins</b>.',
     'So you rented a tiny old shop across the street.',
     '<b>Pay the rent, win the customers, beat the rival!</b>',
     ''],
  marka:'BOMBASTIC',burger:'BURGER',gec:'Skip',kapandi:'CLOSED',kiralik:'FOR RENT',tabela:['BURGER','MASTER'],
  ha:'HA HA HA!',hedef:['Rent','Customers','Rival'],logo:['BURGER','MASTER'],basla:'Tap to start',
  etiket:'Opening story'}};

/* ---------------- karakterler ---------------- */
// rakip: kare yüz, parlak siyah yan ayrık saç, kıvrık bıyık, mor takım, altın şeritli silindir şapka
const RAKIP={cinsiyet:1,yuz:3,ten:1,sac:3,sacRenk:0,kas:1,goz:2,burun:3,biyik:7,sakal:0,gozluk:0,sapka:0,kiyafet:3,kRenk:4,ek:0,
  ozel:{ust:`<g><rect x="39" y="-6" width="42" height="30" rx="4" fill="#2a1f1a"/><rect x="39" y="15" width="42" height="7" fill="#ffc21a"/><path d="M45 -2v14" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/><ellipse cx="60" cy="25" rx="31" ry="6" fill="#2a1f1a"/><path d="M33 23.5q27 4 54 0" stroke="#4a3f3a" stroke-width="1.6" fill="none"/></g>`}};
// kahraman: genç, kızıl kirpi saç, iri gözler, çil, aşçı şapkası, kırmızı tişört
const KAHRAMAN={cinsiyet:1,yuz:1,ten:2,sac:4,sacRenk:4,kas:0,goz:3,burun:0,biyik:0,sakal:0,gozluk:0,sapka:4,kiyafet:0,kRenk:0,ek:1};

function koyu(hex,a){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;r=Math.round(r*(1-a));g=Math.round(g*(1-a));b=Math.round(b*(1-a));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
// tam boy: Musteri.draw'un büstü + altına gövde ve bacak (büstle aynı duygu animasyonu, kopmasın diye)
function kisi(m,duygu,tur){
  const M=W.Musteri;if(!M)return '';
  const ic=M.draw(m,duygu).replace('<svg ','<svg x="-4" y="-14" width="128" height="154" ');
  const cc=(M.CLOTHC||[])[m.kRenk]||'#e8483b';
  let govde;
  if(tur==='rakip'){const ceket=koyu(cc,.3);
    govde=`<path d="M14 136L19 184H101L106 136Z" fill="${ceket}" ${O}/><path d="M60 136V184" stroke="${koyu(cc,.5)}" stroke-width="2"/><circle cx="60" cy="152" r="2.4" fill="#ffc21a"/><circle cx="60" cy="166" r="2.4" fill="#ffc21a"/>`
      +`<path d="M84 150q8 6 2 14" fill="none" stroke="#ffc21a" stroke-width="2.4" stroke-linecap="round"/>`
      +`<path d="M30 182h26v22H30zM64 182h26v22H64z" fill="#2d2440" ${O}/><path d="M24 210q0-8 10-8h22v9H26q-2 0-2-1zM64 202h22q10 0 10 8 0 1-2 1H64z" fill="#14100e" ${O}/>`}
  else{govde=`<path d="M14 136L18 184H102L106 136Z" fill="${cc}" ${O}/><path d="M34 128h52l3 56H31z" fill="#fff" ${O2}/><path d="M42 160h36" stroke="#e3dccf" stroke-width="3" stroke-linecap="round"/><rect x="50" y="146" width="20" height="10" rx="3" fill="none" stroke="#d9d0c2" stroke-width="2"/>`
      +`<path d="M32 182h24v20H32zM64 182h24v20H64z" fill="#3a6fb8" ${O}/><path d="M26 210q0-8 10-8h20v9H28q-2 0-2-1zM64 202h20q10 0 10 8 0 1-2 1H64z" fill="#e8483b" ${O}/><path d="M30 207h24M66 207h24" stroke="#fff" stroke-width="2"/>`}
  return `<svg viewBox="-4 -14 128 230" aria-hidden="true"><g class="mu m-${duygu}">${govde}</g>${ic}</svg>`}

/* ---------------- binalar ---------------- */
const SPARK=(x,y,r,c='#fff')=>{const q=r*.3;return `<path d="M${x} ${y-r}Q${x+q} ${y-q} ${x+r} ${y}Q${x+q} ${y+q} ${x} ${y+r}Q${x-q} ${y+q} ${x-r} ${y}Q${x-q} ${y-q} ${x} ${y-r}z" fill="${c}" ${O2}/>`};
function catiBurger(){return `<g class="hk-cburger">`
  +`<path d="M52 -14h116q7 0 7 7 0 15-19 15H64q-19 0-19-15 0-7 7-7z" fill="#f4c676" ${O}/>`
  +`<rect x="45" y="-31" width="130" height="19" rx="9.5" fill="#6b381c" ${O}/><path d="M60 -25q50-5 100 0" stroke="#93552f" stroke-width="3" fill="none" stroke-linecap="round"/>`
  +`<path d="M43 -38h134v6q0 3-3 3h-12l-6 10-6-10H98l-7 12-7-12H54q-3 0-3 0l-5 7-3-7z" fill="#ffd21f" ${O}/>`
  +`<path d="M41 -40q8-7 15 0t15 0 15 0 15 0 15 0 15 0 15 0 15 0 15 0 15 0v5H41z" fill="#6fca47" ${O}/>`
  +`<path d="M44 -41q0-40 66-40t66 40z" fill="#f4c676" ${O}/><path d="M60 -56q12-16 36-18" stroke="#fde6b4" stroke-width="4" fill="none" stroke-linecap="round"/>`
  +`<g fill="#fff8e6" stroke="${INK}" stroke-width="1.4"><ellipse cx="92" cy="-62" rx="3.4" ry="2" transform="rotate(-20 92 -62)"/><ellipse cx="116" cy="-68" rx="3.4" ry="2" transform="rotate(10 116 -68)"/><ellipse cx="136" cy="-58" rx="3.4" ry="2" transform="rotate(25 136 -58)"/><ellipse cx="108" cy="-52" rx="3.4" ry="2"/><ellipse cx="76" cy="-50" rx="3.4" ry="2" transform="rotate(-30 76 -50)"/><ellipse cx="150" cy="-46" rx="3.4" ry="2" transform="rotate(35 150 -46)"/></g>`
  +`</g>`}
function rakipBina(L){
  let amp='';for(let i=0;i<15;i++){const x=28+i*11.6;amp+=`<circle class="hk-amp ${i%2?'b':'a'}" cx="${x.toFixed(1)}" cy="81" r="3.6"/><circle class="hk-amp ${i%2?'a':'b'}" cx="${x.toFixed(1)}" cy="131" r="3.6"/>`}
  const pen=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#ffe27a" ${O}/><path d="M${x+w/2} ${y}v${h}M${x} ${y+h/2}h${w}" stroke="${INK}" stroke-width="2.4"/><path d="M${x+4} ${y+h/2-4}l6-8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`;
  return `<svg viewBox="0 -86 220 388" aria-hidden="true">`
  +catiBurger()
  +`<rect x="102" y="-6" width="16" height="30" fill="#9aa0a6" ${O}/>`
  +`<rect x="52" y="20" width="116" height="40" rx="4" fill="#5a2f9e" ${O}/>`+SPARK(72,40,7,'#ffc21a')+SPARK(110,40,8,'#ffc21a')+SPARK(148,40,7,'#ffc21a')
  +`<rect x="8" y="60" width="204" height="240" fill="#7a4bc9" ${O}/><path d="M160 62h50v236h-50z" fill="#64399f"/><rect x="8" y="60" width="204" height="240" fill="none" ${O}/>`
  +`<rect x="2" y="54" width="216" height="13" rx="3" fill="#ffc21a" ${O}/>`
  +`<rect x="16" y="78" width="188" height="56" rx="10" fill="#d2281e" ${O}/>`+amp
  +`<text x="110" y="118" text-anchor="middle" font-size="31" font-weight="900" fill="#fff" stroke="${INK}" stroke-width="6" paint-order="stroke" textLength="160" lengthAdjust="spacingAndGlyphs">${L.marka}</text>`
  +`<rect x="64" y="137" width="92" height="21" rx="5" fill="#ffc21a" ${O}/><text x="110" y="153" text-anchor="middle" font-size="15" font-weight="900" fill="${INK}" textLength="70" lengthAdjust="spacingAndGlyphs">${L.burger}</text>`
  +pen(20,170,38,34)+pen(68,170,38,34)+pen(114,170,38,34)+pen(162,170,38,34)
  +pen(20,216,38,34)+pen(162,216,38,34)
  +`<rect x="72" y="216" width="76" height="84" rx="4" fill="#ffc21a" ${O}/><rect x="79" y="223" width="29" height="77" fill="#bfe8ff" ${O2}/><rect x="112" y="223" width="29" height="77" fill="#bfe8ff" ${O2}/><path d="M86 236l12-10M119 236l12-10" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="104" cy="262" r="2.4" fill="${INK}"/><circle cx="116" cy="262" r="2.4" fill="${INK}"/>`
  +`<path d="M24 258h30M166 258h30" stroke="#5a2f9e" stroke-width="5" stroke-linecap="round"/>`
  +`</svg>`}
// eski küçük dükkân (bizim). kapali: kepenk ve "KAPANDI" tabelası
function eskiDukkan(L,kapali){
  let serit='';for(let i=0;i<9;i++)serit+=`<path d="M${8+i*12} 50h12v16h-12z" fill="${i%2?'#fff4dc':'#e9a49a'}"/>`;
  let kep='';
  if(kapali){let ciz='';for(let y=58;y<138;y+=8)ciz+=`M10 ${y}h100`;
    kep=`<g class="hk-kepenk"><rect x="8" y="48" width="104" height="92" fill="#a7b0b8" ${O}/><path d="${ciz}" stroke="#7d878f" stroke-width="2"/><rect x="8" y="132" width="104" height="8" fill="#7d878f" ${O}/></g>`
      +`<g class="hk-kpt"><path d="M44 74l16-12 16 12" fill="none" stroke="${INK}" stroke-width="2"/><rect x="30" y="74" width="60" height="20" rx="4" fill="#e5322b" ${O}/><text x="60" y="89" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" textLength="48" lengthAdjust="spacingAndGlyphs">${L.kapandi}</text></g>`}
  return `<svg viewBox="0 0 120 142" aria-hidden="true">`
  +`<rect x="6" y="20" width="108" height="120" fill="#f3e2c0" ${O}/><path d="M86 22h26v116H86z" fill="#e6d1a8"/><rect x="6" y="20" width="108" height="120" fill="none" ${O}/>`
  +`<rect x="2" y="13" width="116" height="11" rx="3" fill="#a8643a" ${O}/>`
  +`<rect x="26" y="27" width="68" height="19" rx="4" fill="#fff4dc" ${O2}/><g transform="translate(48 30)"><path d="M2 6q0-6 12-6t12 6z" fill="#f4c676" stroke="${INK}" stroke-width="1.6"/><rect x="1" y="6.5" width="24" height="4" rx="2" fill="#6b381c" stroke="${INK}" stroke-width="1.6"/><path d="M2 11h22q0 3-3 3H5q-3 0-3-3z" fill="#f4c676" stroke="${INK}" stroke-width="1.6"/></g>`
  +serit+`<path d="M8 50h104v16H8z" fill="none" ${O2}/><path d="M8 66q6 6 12 0t12 0 12 0 12 0 12 0 12 0 12 0 12 0 8 0" fill="#e9a49a" ${O2}/>`
  +`<rect x="14" y="76" width="46" height="40" rx="2" fill="#bfe8ff" ${O}/><path d="M37 76v40" stroke="${INK}" stroke-width="2"/><path d="M19 90l8-8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`
  +`<rect x="70" y="76" width="36" height="64" fill="#8a5530" ${O}/><rect x="76" y="82" width="24" height="22" fill="#bfe8ff" ${O2}/><circle cx="99" cy="112" r="2.4" fill="#ffc21a" stroke="${INK}" stroke-width="1.4"/>`
  +kep+`</svg>`}
// kiralanan eski dükkân (gövde); tabela, tente, KİRALIK kâğıdı ayrı katmanlar
function yeniDukkan(){
  let tug='';for(let y=34;y<150;y+=10){const k=(y/10)%2?0:10;for(let x=10+k;x<132;x+=20)tug+=`M${x} ${y}h14`}
  return `<svg viewBox="0 0 140 160" aria-hidden="true">`
  +`<rect x="6" y="24" width="128" height="134" fill="#c8754f" ${O}/><path d="${tug}" stroke="#a95b3a" stroke-width="2.4" stroke-linecap="round"/><path d="M104 26h28v130h-28z" fill="#000" opacity=".08"/><rect x="6" y="24" width="128" height="134" fill="none" ${O}/>`
  +`<rect x="2" y="16" width="136" height="11" rx="3" fill="#7a5a48" ${O}/>`
  +`<path d="M14 36l10 6M120 34l-8 9" stroke="#8a4a2e" stroke-width="2"/>`
  +`<rect x="14" y="88" width="56" height="48" rx="2" class="hk-cam" fill="#9fb3bd" ${O}/><path d="M42 88v48M14 112h56" stroke="${INK}" stroke-width="2"/>`
  +`<rect x="82" y="86" width="42" height="72" fill="#6d4a35" ${O}/><rect x="89" y="94" width="28" height="22" class="hk-cam" fill="#9fb3bd" ${O2}/><circle cx="117" cy="126" r="2.6" fill="#ffc21a" stroke="${INK}" stroke-width="1.4"/>`
  +`<path d="M14 88l10 10M14 98l4 4" stroke="#e6edf0" stroke-width="1.2" opacity=".8"/>`
  +`</svg>`}
// arka plandaki şehir silueti (renk: gökyüzüne göre)
function sehir(x,w,renk,op=1){let d='';const H=[52,78,40,96,62,84,46,108,58,72,44,90,66,50,82,60];let px=0;
  H.forEach((h,i)=>{const bw=18+(i*7)%14;d+=`M${px} 120V${120-h}h${bw}V120z`;if(i%3===1)d+=`M${px+bw/2-2} ${120-h}v-10h4v10z`;px+=bw+2});
  let p='';px=0;H.forEach((h,i)=>{const bw=18+(i*7)%14;for(let y=120-h+10;y<112;y+=14)for(let xx=px+4;xx<px+bw-6;xx+=8)if((xx*7+y*3+i)%5<2)p+=`M${xx} ${y}h4v6h-4z`;px+=bw+2});
  return `<div class="hk-sehir" style="${at(x,0,w)};opacity:${op}"><svg viewBox="0 0 ${px} 120" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="${renk}"/><path d="${p}" fill="#fff" opacity=".35"/></svg></div>`}
function bulut(x,y,w,s=''){return `<div class="hk-bulut ${s}" style="${at(x,y,w)}"><svg viewBox="0 0 100 50" aria-hidden="true"><path d="M18 46q-16 0-16-12t14-12q2-14 18-14 10 0 16 8 4-6 14-6 16 0 18 16 14 0 14 10 0 10-14 10z" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/></svg></div>`}

/* ---------------- yardımcılar ---------------- */
const U=n=>`calc(var(--u)*${n})`;
// dünya konumu: x (−50..50 ortadan), y (zemin çizgisinden yukarı), w genişlik; hepsi u
const at=(x,y,w)=>`left:${U(x)};bottom:${U(y)};width:${U(w)}`;
const simge=(ad)=>BU.SIMGE&&BU.SIMGE.svg?BU.SIMGE.svg(ad):'';
const rnd=(a,b)=>a+Math.random()*(b-a);
function parcalar(tur,n,x0,y0,w,h){let s='';
  for(let i=0;i<n;i++){const x=rnd(x0,x0+w),y=rnd(y0,y0+h),d=rnd(0,1.6).toFixed(2),r=rnd(2.2,4.4).toFixed(1);
    if(tur==='yildiz')s+=`<i class="hk-p hk-pyil" style="left:${U(x.toFixed(1))};bottom:${U(y.toFixed(1))};width:${U(r)};animation-delay:${d}s"><svg viewBox="-10 -10 20 20">${SPARK(0,0,8,i%3?'#fff6c2':'#ffc21a')}</svg></i>`;
    else if(tur==='yagmur')s+=`<i class="hk-p hk-pyag" style="left:${U(x.toFixed(1))};bottom:${U(y.toFixed(1))};animation-delay:${(-rnd(0,.8)).toFixed(2)}s"></i>`;
    else if(tur==='konfeti'){const c=['#ffc21a','#e8483b','#3cc45a','#5fb1f0','#fff4dc','#8c5ad8'][i%6];
      s+=`<i class="hk-p hk-pkon" style="left:${U(x.toFixed(1))};top:${U((-rnd(4,30)).toFixed(1))};background:${c};animation-delay:${rnd(0,1.4).toFixed(2)}s;animation-duration:${rnd(2.2,3.6).toFixed(2)}s;--r:${Math.round(rnd(-300,300))}deg"></i>`}}
  return s}
function toz(n,x,y){let s='';for(let i=0;i<n;i++){const a=i/n*Math.PI*2+rnd(-.2,.2),d=rnd(16,30);
  s+=`<i class="hk-p hk-ptoz" style="left:${U(x)};bottom:${U(y+rnd(0,26).toFixed(1))};width:${U(rnd(9,16).toFixed(1))};--dx:${U((Math.cos(a)*d).toFixed(1))};--dy:${U((Math.sin(a)*d*.6-6).toFixed(1))}"></i>`}return s}

/* ---------------- CSS ---------------- */
const CSS=`
.hk{position:absolute;inset:0;z-index:60;overflow:hidden;container-type:size;background:#2b1a12;color:${INK};font-family:"Baloo 2","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer;animation:hk-fade .35s both}
.hk *{box-sizing:border-box}
.hk.hk-son{animation:hk-out .35s ease-in both;pointer-events:none}
.hk-sahne{--u:min(1cqw,.55cqh);--yer:max(27%,calc(var(--u)*44));position:absolute;inset:0;overflow:hidden;background:var(--gok,linear-gradient(#8fd3ff,#d9f3ff))}
.hk-kam{position:absolute;inset:0;transform-origin:50% 60%;will-change:transform}
.hk-yer{position:absolute;left:-30%;right:-30%;bottom:0;height:var(--yer);background:linear-gradient(#c79a55 0 calc(var(--u)*1.2),#e9c58a calc(var(--u)*1.2) calc(var(--u)*11),#b48a55 calc(var(--u)*11) calc(var(--u)*12.2),#5d5560 calc(var(--u)*12.2));}
.hk-yer::after{content:"";position:absolute;left:0;right:0;top:calc(var(--u)*22);height:calc(var(--u)*1.6);background:repeating-linear-gradient(90deg,#f3e2c0 0 calc(var(--u)*9),transparent calc(var(--u)*9) calc(var(--u)*17))}
.hk-dunya{position:absolute;left:50%;bottom:var(--yer);width:0;height:0}
.hk-dunya>*{position:absolute}
.hk-dunya svg,.hk-kisi svg,.hk-ob svg{display:block;width:100%;height:auto;overflow:visible}
.hk-kisi{aspect-ratio:128/230;transform-origin:50% 100%}
.hk-kisi.ayna>svg{transform:scaleX(-1)}
.hk-golge{position:absolute;height:calc(var(--u)*3);border-radius:50%;background:rgba(40,20,5,.28);transform:translateX(-50%)}
.hk-bulut{color:#fff;opacity:.95}
.hk-sehir svg{height:calc(var(--u)*46)!important}
.hk-bulut.gri{color:#9aa3ad}
.hk-bulut.kay{animation:hk-bkay 9s linear both}
.hk-p{position:absolute;display:block;pointer-events:none}
.hk-pyil{aspect-ratio:1;animation:hk-yil 1.4s ease-in-out infinite both}
.hk-pyil svg{display:block;width:100%;height:100%;overflow:visible}
.hk-pyag{width:calc(var(--u)*.7);height:calc(var(--u)*4);border-radius:1em;background:#5fb1f0;opacity:.8;animation:hk-yag .8s linear infinite}
.hk-pkon{width:calc(var(--u)*2.2);height:calc(var(--u)*3.2);border-radius:calc(var(--u)*.5);border:calc(var(--u)*.35) solid ${INK};animation:hk-kon 3s linear infinite both;opacity:0}
.hk-ptoz{aspect-ratio:1;border-radius:50%;background:#e9e1d4;border:calc(var(--u)*.5) solid #b9ad9c;opacity:0;transform:translate(-50%,50%)}
/* üst: Geç */
.hk-gec{position:absolute;z-index:5;top:calc(env(safe-area-inset-top,0px) + var(--u)*3);right:calc(env(safe-area-inset-right,0px) + var(--u)*3);--u:min(1cqw,.55cqh);min-width:44px;min-height:44px;height:calc(var(--u)*11.2);display:flex;align-items:center;gap:calc(var(--u)*1.2);padding:0 calc(var(--u)*2.4) 0 calc(var(--u)*3.6);border-radius:calc(var(--u)*6);background:rgba(255,255,255,.94);border:calc(var(--u)*.6) solid ${INK};box-shadow:0 calc(var(--u)*.8) 0 rgba(0,0,0,.25);font:inherit;font-weight:900;font-size:calc(var(--u)*4.6);color:${INK};line-height:1;cursor:pointer}
.hk-gec .ic{width:calc(var(--u)*6.4);height:calc(var(--u)*6.4)}
.hk-gec::before{content:"";position:absolute;inset:-6px}
.hk-gec:active{transform:translateY(calc(var(--u)*.6));box-shadow:0 calc(var(--u)*.2) 0 rgba(0,0,0,.25)}
/* alt: cümle ve noktalar */
.hk-alt{position:absolute;z-index:4;left:calc(env(safe-area-inset-left,0px) + var(--u)*5);right:calc(env(safe-area-inset-right,0px) + var(--u)*5);bottom:calc(env(safe-area-inset-bottom,0px) + var(--u)*4);--u:min(1cqw,.55cqh);display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*2.6);pointer-events:none}
.hk-cumle{width:100%;min-height:calc(var(--u)*19);display:flex;align-items:center;justify-content:center;text-align:center;background:#fff4dc;border:calc(var(--u)*.9) solid ${INK};border-radius:calc(var(--u)*5);padding:calc(var(--u)*2.6) calc(var(--u)*4.4);box-shadow:0 calc(var(--u)*1.4) 0 rgba(0,0,0,.35);font-size:calc(var(--u)*5.2);font-weight:800;line-height:1.22;color:#4a3426}
.hk-cumle b{color:#b8170f;font-weight:900}
.hk-cumle.yeni{animation:hk-pop .35s cubic-bezier(.2,1.4,.4,1) both}
.hk-cumle.bos{display:none}
.hk-nok{display:flex;gap:calc(var(--u)*1.6)}
.hk-nok i{width:calc(var(--u)*2.2);height:calc(var(--u)*2.2);border-radius:50%;background:rgba(255,255,255,.45);border:calc(var(--u)*.4) solid rgba(42,26,16,.6);transition:background .3s,transform .3s}
.hk-nok i.on{background:#ffc21a;transform:scale(1.3);border-color:${INK}}
/* geçişler */
.hk-sahne.g-iris{animation:hk-iris .6s cubic-bezier(.5,0,.2,1) both}
.hk-sahne.g-kay{animation:hk-kayg .7s cubic-bezier(.6,0,.25,1) both}
.hk-sahne.c-kay{animation:hk-kayc .7s cubic-bezier(.6,0,.25,1) both}
.hk-sahne.g-fade{animation:hk-fade .3s both}
@keyframes hk-iris{from{clip-path:circle(0% at 50% 45%)}to{clip-path:circle(150% at 50% 45%)}}
@keyframes hk-kayg{from{transform:translateX(100%)}}
@keyframes hk-kayc{to{transform:translateX(-100%)}}
@keyframes hk-fade{from{opacity:0}}
@keyframes hk-out{to{opacity:0}}
@keyframes hk-pop{from{transform:scale(.7) translateY(calc(var(--u)*3));opacity:0}}
@keyframes hk-yil{0%,100%{transform:scale(0) rotate(0);opacity:0}50%{transform:scale(1) rotate(45deg);opacity:1}}
@keyframes hk-yag{from{transform:translateY(0)}to{transform:translateY(calc(var(--u)*24));opacity:0}}
@keyframes hk-kon{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:1;transform:translateY(calc(var(--u)*170)) rotate(var(--r))}}
@keyframes hk-toz{0%{opacity:0;transform:translate(-50%,50%) scale(.3)}25%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(50% - var(--dy))) scale(1.6)}}
@keyframes hk-bkay{from{transform:translateX(calc(var(--u)*-14))}}
@keyframes hk-zip{0%{transform:translateY(calc(var(--u)*-3)) scale(.98,1.02)}50%{transform:translateY(0) scale(1.03,.97)}100%{transform:none}}
/* müşteri yüzü animasyonları (oyunla aynı; deneme sayfasında da çalışsın) */
@keyframes mu-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes mu-tap{0%,100%{transform:rotate(0)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}
@keyframes mu-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
@keyframes mu-sink{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
@keyframes mu-rise{0%{transform:translateY(4px);opacity:0}40%{opacity:1}100%{transform:translateY(-12px);opacity:0}}
@keyframes mu-drip{0%{transform:translateY(0);opacity:1}100%{transform:translateY(12px);opacity:0}}
@keyframes mu-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
@keyframes mu-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
.hk .mu{transform-box:view-box;transform-origin:60px 140px}
.hk .m-happy{animation:mu-hop 1s ease-in-out infinite}.hk .m-wait{animation:mu-sink 2.6s ease-in-out infinite}.hk .m-imp{animation:mu-tap .5s ease-in-out infinite}
.hk .m-angry{animation:mu-shake .22s linear infinite}.hk .m-love{animation:mu-hop .8s ease-in-out infinite}.hk .m-sad{animation:mu-sink 3s ease-in-out infinite}
.hk .mu .blink{animation:mu-blink 4s infinite;transform-box:fill-box;transform-origin:center}
.hk svg .st{animation:mu-rise 1.1s ease-out infinite}.hk svg .st.d2{animation-delay:.37s}.hk svg .st.d3{animation-delay:.74s}
.hk svg .sw,.hk svg .tr{animation:mu-drip 1.3s ease-in infinite}.hk svg .hb{animation:mu-pulse .8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.hk-yuz{display:contents}
/* ---- 1: Bombastik Burger ---- */
.hk-s1{--gok:linear-gradient(#2c2263,#6a3f9e 45%,#f08a5a 85%)}
.hk-s1 .hk-kam{transform-origin:50% 22%;animation:hk-k1 3.6s cubic-bezier(.45,0,.2,1) both}
@keyframes hk-k1{0%,15%{transform:scale(2.1) translateY(14%)}}
.hk-amp{fill:#fff3a8;stroke:${INK};stroke-width:1.4}
.hk-amp.b{animation:hk-amp .5s steps(1) infinite}.hk-amp.a{animation:hk-amp .5s steps(1) .25s infinite}
@keyframes hk-amp{0%{fill:#fff3a8}50%{fill:#b8820f}}
.hk-isik{width:calc(var(--u)*16);height:calc(var(--u)*150);transform-origin:50% 100%;background:linear-gradient(to top,rgba(255,246,190,.75),rgba(255,246,190,0) 85%);clip-path:polygon(42% 100%,58% 100%,100% 0,0 0);animation:hk-isik 3.2s ease-in-out infinite alternate}
.hk-isik.i2{animation-delay:-1.6s}
@keyframes hk-isik{from{transform:rotate(-28deg)}to{transform:rotate(26deg)}}
.hk-hali{height:calc(var(--u)*5);background:#d2281e;border:calc(var(--u)*.6) solid ${INK};border-top:0;border-radius:0 0 calc(var(--u)*2) calc(var(--u)*2);transform:perspective(calc(var(--u)*40)) rotateX(55deg);transform-origin:50% 0}
.hk-yildizlar{height:0}
.hk-s1 .hk-cburger{animation:hk-sal 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
@keyframes hk-sal{50%{transform:rotate(-3deg) translateY(-2px)}}
.hk-s1 .r1{animation:hk-gir .7s cubic-bezier(.2,1.4,.4,1) 1.9s both}
@keyframes hk-gir{from{transform:translateY(calc(var(--u)*30)) scale(.6);opacity:0}}
/* ---- 2: alay ---- */
.hk-s2{--gok:linear-gradient(#3a2a78,#7b4fa8 50%,#f3a06a 90%)}
.hk-s2 .hk-kam{animation:hk-k2 3.4s cubic-bezier(.5,0,.2,1) both}
@keyframes hk-k2{0%,10%{transform:translateX(calc(var(--u)*-28)) scale(1.15)}}
.hk-balon{z-index:3;background:#fff;border:calc(var(--u)*.8) solid ${INK};border-radius:calc(var(--u)*4);padding:calc(var(--u)*1.6) calc(var(--u)*3.2);font-weight:900;font-size:calc(var(--u)*6);line-height:1;white-space:nowrap;color:#b8170f;box-shadow:0 calc(var(--u)*1) 0 rgba(0,0,0,.2);transform-origin:80% 120%;animation:hk-balon .45s cubic-bezier(.2,1.6,.4,1) 1.5s both,hk-titre .18s linear 1.95s 6}
.hk-balon::after{content:"";position:absolute;right:22%;bottom:calc(var(--u)*-2.4);width:calc(var(--u)*3.4);height:calc(var(--u)*3.4);background:#fff;border-right:calc(var(--u)*.8) solid ${INK};border-bottom:calc(var(--u)*.8) solid ${INK};transform:rotate(45deg)}
@keyframes hk-balon{from{transform:scale(0);opacity:0}}
@keyframes hk-titre{50%{transform:rotate(-4deg) scale(1.04)}}
.hk-parmak{transform-origin:100% 50%;animation:hk-parmak .4s ease-in-out 1.6s 4 alternate both}
@keyframes hk-parmak{to{transform:rotate(-12deg) translateX(calc(var(--u)*-1.5))}}
.hk-s2 .kucul{animation:hk-kucul 1.4s ease-in-out 2s both}
@keyframes hk-kucul{to{transform:scale(.92) translateY(calc(var(--u)*1))}}
/* ---- 3: kapandı ---- */
.hk-s3{--gok:linear-gradient(#5b6676,#9aa5b2 70%,#c4ccd4)}
.hk-s3 .hk-kam{transform-origin:40% 70%;animation:hk-k3 3.8s ease-out both}
@keyframes hk-k3{from{transform:scale(1.18)}}
.hk-s3 .hk-kepenk{transform-box:fill-box;transform-origin:50% 0;animation:hk-kepenk .7s cubic-bezier(.5,0,.6,1.2) .5s both}
@keyframes hk-kepenk{from{transform:scaleY(.02)}}
.hk-s3 .hk-kpt{transform-box:fill-box;transform-origin:50% 0;animation:hk-tabdus .8s cubic-bezier(.2,1.5,.4,1) 1.25s both}
@keyframes hk-tabdus{0%{transform:translateY(-140%) rotate(-10deg);opacity:0}60%{transform:rotate(8deg);opacity:1}80%{transform:rotate(-4deg)}}
.hk-s3 .hk-eski{animation:hk-poof .5s cubic-bezier(.6,-.4,.7,1) 2.5s both;transform-origin:50% 100%}
@keyframes hk-poof{to{transform:scale(.2,.05);opacity:0}}
.hk-s3 .hk-ptoz{animation:hk-toz 1.1s ease-out 2.75s both}
.hk-s3 .hk-yagmur{animation:hk-fade .8s 1s both}
.hk-bos-yer{height:calc(var(--u)*2.4);border-radius:50%;background:rgba(40,30,20,.28)}
/* ---- 4: cepte 50 para ---- */
.hk-s4{--gok:radial-gradient(circle at 50% 62%,#ffcf73 0,#d67a32 34%,#5a2d18 75%)}
.hk-s4 .hk-kam{animation:hk-k4 3.8s ease-out both}
@keyframes hk-k4{from{transform:scale(1.14)}}
.hk-s4 .hk-yer{background:linear-gradient(#a8743c,#7a4f26)}
.hk-s4 .hk-yer::after{display:none}
.hk-sayac{position:absolute;z-index:3;left:50%;top:calc(env(safe-area-inset-top,0px) + var(--u)*24);transform:translateX(-50%);display:flex;align-items:center;gap:calc(var(--u)*2);background:rgba(255,255,255,.96);border:calc(var(--u)*.9) solid ${INK};border-radius:calc(var(--u)*8);height:calc(var(--u)*17);padding:0 calc(var(--u)*6) 0 calc(var(--u)*2);font-weight:900;font-size:calc(var(--u)*10);line-height:1;box-shadow:0 calc(var(--u)*1.4) 0 rgba(0,0,0,.3);animation:hk-pop .4s cubic-bezier(.2,1.5,.4,1) .3s both}
.hk-sayac .ic{width:calc(var(--u)*12);height:calc(var(--u)*12)}
.hk-sayac.vur{animation:hk-vur .18s ease-out}
@keyframes hk-vur{50%{transform:translateX(-50%) scale(1.12)}}
.hk-kese{aspect-ratio:1;animation:hk-kese .5s ease-in-out .5s 5 alternate both;transform-origin:50% 100%}
.hk-kese .ic{width:100%;height:100%;display:block}
@keyframes hk-kese{to{transform:scale(1.08,.94) rotate(-4deg)}}
.hk-sikke{position:absolute;z-index:2;width:calc(var(--u)*9);aspect-ratio:1;opacity:0;animation:hk-sikke .75s cubic-bezier(.3,0,.6,1) both}
.hk-sikke .ic{width:100%;height:100%;display:block}
@keyframes hk-sikke{0%{opacity:0;transform:translate(0,0) scale(.4)}15%{opacity:1}40%{transform:translate(calc(var(--dx)*.35),calc(var(--dy)*.55 - var(--u)*10)) scale(1.1)}90%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.7)}}
/* ---- 5: kirala ---- */
.hk-s5{--gok:linear-gradient(#8fd3ff,#d9f3ff 70%)}
.hk-s5 .hk-kam{animation:hk-k5 1.2s cubic-bezier(.3,0,.2,1) both}
@keyframes hk-k5{from{transform:translateX(calc(var(--u)*24))}}
.hk-s5 .yuru{animation:hk-yuru 1.6s cubic-bezier(.3,.1,.4,1) .2s both}
.hk-s5 .yuru .hk-kisi{animation:hk-adim .2s ease-in-out .2s 8 alternate}
@keyframes hk-yuru{from{transform:translateX(calc(var(--u)*-58))}}
@keyframes hk-adim{to{transform:translateY(calc(var(--u)*-1.6)) rotate(2deg)}}
.hk-kiralik{z-index:2;background:#fff;border:calc(var(--u)*.5) solid ${INK};padding:calc(var(--u)*.8) calc(var(--u)*1.2);font-weight:900;font-size:calc(var(--u)*3.4);line-height:1;text-align:center;color:#d2281e;transform:rotate(-6deg);opacity:0;animation:hk-kirdus .7s ease-in 1.5s backwards}
@keyframes hk-kirdus{0%{opacity:1;transform:rotate(-6deg)}30%{opacity:1;transform:rotate(-20deg) translateY(calc(var(--u)*-1))}100%{opacity:0;transform:rotate(-70deg) translateY(calc(var(--u)*30))}}
.hk-tabela{z-index:2;display:grid;place-items:center;background:#ffc21a;border:calc(var(--u)*.8) solid ${INK};border-radius:calc(var(--u)*2.4);box-shadow:0 calc(var(--u)*1) 0 rgba(0,0,0,.3);padding:calc(var(--u)*1) 0;font-weight:900;line-height:.9;color:#fff;-webkit-text-stroke:calc(var(--u)*.55) ${INK};paint-order:stroke fill;text-align:center;transform-origin:50% 0;animation:hk-tabela 1s cubic-bezier(.3,1.5,.5,1) 2s both}
.hk-tabela span{display:block;font-size:calc(var(--u)*5.4)}
.hk-tabela span+span{color:#fff4dc;font-size:calc(var(--u)*4.4)}
@keyframes hk-tabela{0%{transform:translateY(calc(var(--u)*-50)) rotate(-8deg);opacity:0}40%{transform:translateY(0) rotate(9deg);opacity:1}65%{transform:rotate(-5deg)}85%{transform:rotate(2deg)}}
.hk-tente{z-index:2;transform-origin:50% 0;animation:hk-tente .55s cubic-bezier(.3,1.4,.5,1) 2.75s both}
.hk-tente img{display:block;width:100%;height:auto}
@keyframes hk-tente{from{transform:scaleY(.04)}}
.hk-s5 .hk-cam{animation:hk-yan .4s steps(1) 3.1s both}
@keyframes hk-yan{from{fill:#9fb3bd}to{fill:#ffe27a}}
.hk-s5 .hk-cam{fill:#ffe27a}
.hk-s5 .hk-pyil{animation-delay:3.1s}
.hk-s5 .sevin{animation:hk-fade .2s 2.9s both}
/* ---- 6: hedef ---- */
.hk-s6{--gok:linear-gradient(112deg,#ffcf5a 0 52%,#6a3fb5 52%)}
.hk-s6 .hk-kam{animation:hk-k6 3.6s ease-out both}
@keyframes hk-k6{from{transform:scale(1.12)}}
.hk-s6 .hk-yer{background:linear-gradient(#c79a55 0 calc(var(--u)*1.2),#e9c58a calc(var(--u)*1.2))}
.hk-s6 .hk-yer::after{display:none}
.hk-hedefler{position:absolute;z-index:3;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + var(--u)*21);display:flex;justify-content:center;gap:calc(var(--u)*4)}
.hk-hedef{display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*1.2);animation:hk-pop .45s cubic-bezier(.2,1.6,.4,1) both}
.hk-hedef:nth-child(2){animation-delay:.7s}.hk-hedef:nth-child(3){animation-delay:1.4s}.hk-hedef:nth-child(1){animation-delay:.1s}
.hk-hedef span{width:calc(var(--u)*21);height:calc(var(--u)*21);display:grid;place-items:center;border-radius:50%;background:#fff4dc;border:calc(var(--u)*.9) solid ${INK};box-shadow:0 calc(var(--u)*1.2) 0 rgba(0,0,0,.3)}
.hk-hedef span .ic{width:72%;height:72%}
.hk-hedef b{font-size:calc(var(--u)*4.4);font-weight:900;color:#fff;-webkit-text-stroke:calc(var(--u)*.5) ${INK};paint-order:stroke fill;line-height:1;white-space:nowrap}
.hk-ok{z-index:3;aspect-ratio:1;animation:hk-oksal .5s ease-in-out infinite alternate}
.hk-ok .ic{width:100%;height:100%;display:block}
@keyframes hk-oksal{to{transform:translateX(calc(var(--u)*2))}}
/* ---- 7: başlık ---- */
.hk-s7{--gok:linear-gradient(#ffcf5a,#ff9a3c 55%,#e2562a)}
.hk-s7 .hk-yer{background:linear-gradient(#b17a2c,#8a5a1c 55%,#6d4410);border-top:calc(var(--u)*1.4) solid #4a2c08;box-shadow:inset 0 calc(var(--u)*2) 0 rgba(255,255,255,.12)}
.hk-s7 .hk-yer::after{display:none}
.hk-tabak{height:calc(var(--u)*9);border-radius:50%;background:radial-gradient(ellipse at 50% 42%,#fff 0 46%,#e7e3da 47% 62%,#fff 63%);box-shadow:0 calc(var(--u)*1.2) 0 rgba(0,0,0,.28),inset 0 0 0 calc(var(--u)*.6) #cfc8ba}
.hk-isinlar{position:absolute;left:50%;top:40%;width:calc(var(--u)*240);aspect-ratio:1;margin:calc(var(--u)*-120) 0 0 calc(var(--u)*-120);border-radius:50%;background:repeating-conic-gradient(rgba(255,255,255,.22) 0 10deg,transparent 10deg 20deg);animation:hk-don 18s linear infinite}
@keyframes hk-don{to{transform:rotate(360deg)}}
.hk-logo{position:absolute;z-index:2;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + var(--u)*24);text-align:center;line-height:.86;font-weight:900;color:#fff;-webkit-text-stroke:calc(var(--u)*1.6) ${INK};paint-order:stroke fill;font-size:calc(var(--u)*17);transform:rotate(-4deg);text-shadow:0 calc(var(--u)*1.6) 0 ${INK};animation:hk-logo .6s cubic-bezier(.2,1.5,.4,1) .15s both}
.hk-logo small{display:block;font-size:calc(var(--u)*11.5);color:#ffc21a}
@keyframes hk-logo{from{transform:rotate(-4deg) scale(0);opacity:0}}
.hk-burger{z-index:2;font-size:var(--u)}
.hk-burger .bu-ly{animation:hk-katman .4s cubic-bezier(.25,1.45,.45,1) both}
@keyframes hk-katman{from{transform:translateY(-500%);opacity:0}}
.hk-burger .bu-ly:nth-child(1){animation-delay:.5s}.hk-burger .bu-ly:nth-child(2){animation-delay:.68s}.hk-burger .bu-ly:nth-child(3){animation-delay:.86s}.hk-burger .bu-ly:nth-child(4){animation-delay:1.04s}.hk-burger .bu-ly:nth-child(5){animation-delay:1.22s}.hk-burger .bu-ly:nth-child(6){animation-delay:1.4s}
.hk-burger .bu-yigin{animation:hk-zip .3s ease-out 1.75s both}
.hk-ipucu{position:absolute;z-index:3;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + var(--u)*16);text-align:center;font-weight:900;font-size:calc(var(--u)*6);color:#fff;-webkit-text-stroke:calc(var(--u)*.7) ${INK};paint-order:stroke fill;animation:hk-fade .4s 1.8s both,hk-nabiz 1.1s ease-in-out 2.2s infinite}
@keyframes hk-nabiz{50%{transform:scale(1.08)}}
/* hareketi azalt: sahnelerde animasyon yok, son hâl görünür; sahneler arası kısa solma */
.hk.hk-az .hk-sahne *,.hk.hk-az .hk-cumle{animation:none!important;transition:none!important}
.hk.hk-az .hk-sahne.g-iris,.hk.hk-az .hk-sahne.g-kay{animation:hk-fade .3s both}
.hk.hk-az .hk-sahne.c-kay{animation:hk-out .3s both}
.hk.hk-az .hk-s3 .hk-eski{opacity:1}
.hk.hk-az .hk-p,.hk.hk-az .hk-sikke,.hk.hk-az .hk-kiralik{display:none}
`;
function cssKur(){
  if(!document.getElementById('hkCss')){const st=document.createElement('style');st.id='hkCss';st.textContent=CSS;document.head.appendChild(st)}
  if(BU.BURGER&&BU.BURGER.CSS&&!document.getElementById('buCss')){const st=document.createElement('style');st.id='buCss';st.textContent=BU.BURGER.CSS;document.head.appendChild(st)}}

/* ---------------- sahneler ---------------- */
// her sahne: {ad, sure (ms, otomatik geçiş), gecis ('iris'|'kay'), html(L), olay: [[ms, fn(kok)]]}
const SAHNE=[
 {ad:'rakip',sure:4200,gecis:'iris',
  html:L=>`<div class="hk-yildizlar" style="${at(-50,0,100)}">${parcalar('yildiz',7,-48,120,96,50)}</div>`+sehir(-80,160,'#4f3c93')+`<div class="hk-isik" style="${at(-30,40,16)}"></div><div class="hk-isik i2" style="${at(14,40,16)}"></div>`
   +bulut(-46,128,26,'kay')+bulut(28,140,20,'kay')
   +`<div style="${at(-30,0,60)}">${rakipBina(L)}</div>`
   +`<div class="hk-hali" style="${at(-9,-5,18)}"></div>`
   +`<div class="hk-yildizlar" style="${at(-50,0,100)}">${parcalar('yildiz',16,-36,10,72,110)}</div>`
   +`<div class="hk-golge" style="${at(37,-9,24)}"></div><div class="hk-kisi r1" style="${at(22,-9,30)}">${kisi(RAKIP,'happy','rakip')}</div>`,
  olay:[[400,()=>ses('satin')],[2000,()=>ses('gun_bitti')]]},
 {ad:'alay',sure:4400,gecis:'iris',
  html:L=>`<div class="hk-yildizlar" style="${at(-50,0,100)}">${parcalar('yildiz',6,-48,110,96,50)}</div>`+sehir(-80,160,'#5a4598')+bulut(-40,120,22)
   +`<div style="${at(4,0,60)}">${rakipBina(L)}</div>`
   +`<div class="kucul" style="${at(-50,0,46)};transform-origin:50% 100%">${eskiDukkan(L,false)}</div>`
   +`<div class="hk-golge" style="${at(-29,-9,20)}"></div><div class="hk-kisi kucul" style="${at(-41,-9,24)}">${kisi(KAHRAMAN,'sad','kahraman')}</div>`
   +`<div class="hk-ob hk-parmak" style="${at(1,13,22)}"><svg viewBox="0 0 92 30"><path d="M50 9h40v16H50z" fill="#62408f" ${O2}/><path d="M50 7v20" stroke="#fff" stroke-width="4"/><path d="M48 10H22q-4 0-4-4t-4-4H8q-6 0-6 8v10q0 8 8 8h16q4 0 4-4h-4q4 0 4-4h-6q4 0 4-4h-6V14h26z" fill="#f9d1b4" ${O2}/></svg></div>`
   +`<div class="hk-golge" style="${at(26,-9,24)}"></div><div class="hk-kisi ayna" style="${at(14,-9,26)}">${kisi(RAKIP,'happy','rakip')}</div>`
   +`<div class="hk-balon" style="left:${U(4)};bottom:${U(62)}">${L.ha}</div>`,
  olay:[[1600,()=>ses('teslim_kizgin')],[2300,()=>ses('kacti')]]},
 {ad:'kapandi',sure:4000,gecis:'iris',
  html:L=>sehir(-80,160,'#7f8a98')+bulut(-44,112,30,'gri')+bulut(14,124,26,'gri')
   +`<div class="hk-bos-yer" style="${at(-44,-1.2,50)}"></div>`
   +`<div class="hk-eski" style="${at(-44,0,50)};transform-origin:50% 100%">${eskiDukkan(L,true)}</div>`
   +toz(12,-19,0)
   +`<div class="hk-golge" style="${at(30,-9,26)}"></div><div class="hk-kisi" style="${at(15,-9,30)}">${kisi(KAHRAMAN,'sad','kahraman')}</div>`
   +`<div class="hk-yagmur" style="${at(14,46,32)};height:${U(30)}">${bulut(0,12,32,'gri')}<div style="position:absolute;left:0;bottom:0;width:100%;height:100%">${parcalar('yagmur',11,3,-10,26,16)}</div></div>`,
  olay:[[550,()=>ses('cop')],[1300,()=>ses('uyari')],[2500,()=>ses('can_gitti')],[3000,()=>ses('gun_kayip')]]},
 {ad:'cep',sure:4000,gecis:'iris',
  html:L=>`<div class="hk-golge" style="${at(0,-6,40)}"></div><div class="hk-kisi" style="${at(-22,-8,44)}">${kisi(KAHRAMAN,'wait','kahraman')}</div>`
   +`<div class="hk-kese" style="${at(8,6,22)}" data-kese>${simge('kese')}</div>`
   +`<div class="hk-yildizlar" style="${at(-50,0,100)}">${parcalar('yildiz',6,-30,20,60,60)}</div>`,
  ust:L=>`<div class="hk-sayac" data-sayac>${simge('para')}<span>0</span></div>`,
  olay:'para'},
 {ad:'kirala',sure:4800,gecis:'kay',
  html:L=>sehir(-80,160,'#a9d3ee')+bulut(-48,124,26,'kay')+bulut(20,136,22,'kay')
   +`<div style="${at(-16,0,60)}">${yeniDukkan()}</div>`
   +`<div class="hk-kiralik" style="${at(-11,25,21)}">${L.kiralik}</div>`
   +`<div class="hk-tabela" style="${at(-10,51,48)}"><span>${L.tabela[0]}</span><span>${L.tabela[1]}</span></div>`
   +`<div class="hk-tente" style="${at(-20,-3,68)}"><img src="${S.yol}awning.webp" alt="" draggable="false"></div>`
   +`<div class="hk-yildizlar" style="${at(-50,0,100)}">${parcalar('yildiz',9,-14,4,54,64)}</div>`
   +`<div class="yuru" style="${at(-50,-9,27)};height:${U(49)}"><div class="hk-golge" style="left:50%;bottom:0;width:${U(22)}"></div>`
   +`<div class="hk-kisi" style="position:absolute;left:0;bottom:0;width:100%"><span class="hk-yuz" data-yuz>${kisi(KAHRAMAN,'wait','kahraman')}</span></div></div>`,
  olay:[[1500,()=>ses('sec')],[2400,()=>ses('birak')],[2800,()=>ses('gun_basla')],[2900,k=>yuzDegis(k,'happy')]]},
 {ad:'hedef',sure:4600,gecis:'iris',
  html:L=>`<div style="${at(10,0,40)};opacity:.55">${rakipBina(L)}</div>`
   +`<div class="hk-golge" style="${at(-27,-9,34)}"></div><div class="hk-kisi" style="${at(-48,-9,40)}">${kisi(KAHRAMAN,'happy','kahraman')}</div>`
   +`<div class="hk-golge" style="${at(33,-9,28)}"></div><div class="hk-kisi ayna" style="${at(17,-9,32)}">${kisi(RAKIP,'angry','rakip')}</div>`
   +`<div class="hk-ok" style="${at(-6,26,15)}">${simge('ileri')}</div>`,
  ust:L=>`<div class="hk-hedefler">${[['para',0],['gulen',1],['yildiz',2]].map(([s,i])=>`<div class="hk-hedef"><span>${simge(s)}</span><b>${L.hedef[i]}</b></div>`).join('')}</div>`,
  olay:[[150,()=>ses('teslim_normal')],[850,()=>ses('teslim_mutlu')],[1550,()=>ses('satin')],[2300,()=>ses('teslim_kizgin')]]},
 {ad:'baslik',sure:4200,gecis:'iris',
  html:L=>`<div class="hk-tabak" style="${at(-30,-1,60)}"></div><div class="hk-burger" style="${at(-24,3,48)}">${BU.BURGER&&BU.BURGER.yigin?BU.BURGER.yigin(['bunBot','patty','cheese','lettuce','tomato','bunTop'],{gen:'48em',yeni:false}):''}</div>`
   +`<div class="hk-golge" style="${at(-34,-8,22)}"></div><div class="hk-kisi" style="${at(-48,-10,26)}">${kisi(KAHRAMAN,'love','kahraman')}</div>`
   +`<div class="hk-yildizlar" style="${at(-50,170,100)}">${parcalar('konfeti',26,0,0,100,0)}</div>`,
  arka:`<div class="hk-isinlar"></div>`,
  ust:L=>`<div class="hk-logo">${L.logo[0]}<small>${L.logo[1]}</small></div><div class="hk-ipucu">${L.basla}</div>`,
  olay:[[500,()=>ses('birak')],[1450,()=>ses('birak:bunTop')],[1800,()=>ses('gun_bitti')]]}
];

/* ---------------- oynatıcı ---------------- */
const S={kok:null,i:-1,zaman:[],bitince:null,dil:'tr',az:false,yol:'g/',sesAc:null,sesAcildi:false,son:false,sonDokun:0};
function ses(ad){try{BU.SES&&BU.SES.cal&&BU.SES.cal(ad)}catch(e){}}
function zamanla(ms,fn){S.zaman.push(setTimeout(()=>{if(S.kok)fn(S.kok)},ms))}
function temizle(){S.zaman.forEach(clearTimeout);S.zaman=[]}
function yuzDegis(kok,duygu){const ss=kok.querySelectorAll('.hk-sahne'),y=ss.length&&ss[ss.length-1].querySelector('[data-yuz]');if(y)y.innerHTML=kisi(KAHRAMAN,duygu,'kahraman')}
function paraOlay(sahne){
  const say=sahne.querySelector('[data-sayac]'),sp=say&&say.querySelector('span'),kese=sahne.querySelector('[data-kese]');
  if(!say||!sp)return;
  if(S.az){sp.textContent='50';zamanla(300,()=>ses('teslim_normal'));return}
  const N=10;
  for(let i=0;i<N;i++)zamanla(700+i*190,()=>{
    if(!kese||!say.isConnected)return;
    const a=kese.getBoundingClientRect(),b=say.getBoundingClientRect(),r=sahne.getBoundingClientRect();
    const c=document.createElement('div');c.className='hk-sikke';c.innerHTML=simge('para');
    const w=a.width*.42,x=a.left-r.left+a.width*.5-w/2+(Math.random()-.5)*a.width*.3,y=a.top-r.top+a.height*.2;
    c.style.left=x+'px';c.style.top=y+'px';c.style.width=w+'px';
    const ic=say.querySelector('.ic').getBoundingClientRect();
    c.style.setProperty('--dx',(ic.left-r.left+ic.width/2-(x+w/2))+'px');c.style.setProperty('--dy',(ic.top-r.top+ic.height/2-(y+w/2))+'px');
    sahne.appendChild(c);if(i%2===0)ses('sec');
    zamanla(720,()=>{sp.textContent=String((i+1)*5);say.classList.remove('vur');void say.offsetWidth;say.classList.add('vur');c.remove();
      if(i===N-1)ses('teslim_normal')})});
}
function sahneKur(i){
  const d=SAHNE[i],L=METIN[S.dil],kok=S.kok;
  const el=document.createElement('div');el.className='hk-sahne hk-s'+(i+1);
  el.innerHTML=(d.arka||'')+`<div class="hk-kam"><div class="hk-yer"></div><div class="hk-dunya">${d.html(L)}</div></div>`+(d.ust?d.ust(L):'');
  const eski=[...kok.querySelectorAll('.hk-sahne')];
  const tur=S.az?'fade':i===0?'':d.gecis;
  if(tur)el.classList.add('g-'+tur);
  if(tur==='kay')eski.forEach(e=>e.classList.add('c-kay'));
  kok.insertBefore(el,kok.querySelector('.hk-alt'));
  zamanla(tur?720:0,()=>eski.forEach(e=>e.remove()));
  return el}
function goster(i){
  if(!S.kok)return;temizle();S.i=i;
  const d=SAHNE[i],L=METIN[S.dil];
  const el=sahneKur(i);
  const c=S.kok.querySelector('.hk-cumle');c.innerHTML=L.s[i]?'<span>'+L.s[i]+'</span>':'';c.classList.toggle('bos',!L.s[i]);c.classList.remove('yeni');void c.offsetWidth;if(L.s[i])c.classList.add('yeni');
  S.kok.querySelectorAll('.hk-nok i').forEach((n,k)=>n.classList.toggle('on',k===i));
  if(d.olay==='para')paraOlay(el);
  else if(d.olay)d.olay.forEach(([ms,fn])=>{if(S.az&&ms>200)ms=200;zamanla(ms,fn)});
  zamanla(d.sure,()=>{if(i<SAHNE.length-1)goster(i+1);else bitir()})}
function ileri(){if(S.son||!S.kok)return;const t=Date.now();if(t-S.sonDokun<280)return;S.sonDokun=t;
  if(S.i<SAHNE.length-1){ses('tik');goster(S.i+1)}else bitir()}
function bitir(){
  if(S.son||!S.kok)return;S.son=true;temizle();
  const kok=S.kok,fn=S.bitince;kok.classList.add('hk-son');
  setTimeout(()=>{kaldir();if(typeof fn==='function')try{fn()}catch(e){console.error(e)}},S.az?120:350)}
function kaldir(){temizle();if(S.kok){S.kok.remove();S.kok=null}S.i=-1}
function sesKilit(){if(S.sesAcildi)return;S.sesAcildi=true;try{(S.sesAc||(BU.SES&&BU.SES.ac)||function(){})()}catch(e){}}

function oynat(kap,o){
  o=o||{};kaldir();cssKur();
  S.dil=o.dil==='en'?'en':'tr';S.bitince=o.bitince||null;S.son=false;S.sonDokun=0;S.sesAc=o.sesAc||null;S.sesAcildi=false;
  S.yol=o.yol||(BU.BURGER&&BU.BURGER.YOL)||'g/';
  S.az=!!(W.matchMedia&&W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const L=METIN[S.dil];
  const kok=document.createElement('div');kok.className='hk'+(S.az?' hk-az':'');
  kok.setAttribute('role','dialog');kok.setAttribute('aria-label',L.etiket);
  kok.innerHTML=`<button type="button" class="hk-gec" aria-label="${L.gec}">${L.gec}${simge('ileri')}</button>`
    +`<div class="hk-alt"><div class="hk-cumle" aria-live="polite"></div><div class="hk-nok">${SAHNE.map(()=>'<i></i>').join('')}</div></div>`;
  kok.addEventListener('pointerdown',e=>{sesKilit();if(e.target.closest('.hk-gec'))return;ileri()});
  kok.querySelector('.hk-gec').addEventListener('click',e=>{e.stopPropagation();sesKilit();ses('tik');bitir()});
  kok.addEventListener('keydown',e=>{if(e.key==='Escape'){bitir()}else if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.hk-gec')){e.preventDefault();ileri()}});
  kok.tabIndex=-1;
  kap.appendChild(kok);S.kok=kok;
  if(o.muzik!==false)try{BU.SES&&BU.SES.muzik&&BU.SES.muzik(true)}catch(e){}
  goster(0);
  try{kok.querySelector('.hk-gec').focus({preventScroll:true})}catch(e){}
}
function durdur(){S.son=true;kaldir()}

BU.HIKAYE={oynat,durdur,_git:i=>{if(S.kok&&SAHNE[i])goster(i)},SAHNELER:SAHNE.map(s=>s.ad),METIN:{tr:METIN.tr.s.slice(0,-1),en:METIN.en.s.slice(0,-1)}};
})();
