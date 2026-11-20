/* Burger Ustası 2.0: oynanış, arayüz, ekranlar (çekirdek).
   Modüller: BU.VERI (ekonomi), BU.SIMGE (simgeler), BU.SES (ses), BU.BURGER (çizim). Biri yoksa küçük bir yedekle çalışır.
   Akış: tepsiden malzeme seç → tabağa dokun (koy) → yığını müşteriye sürükle (teslim) ya da çöpe sürükle.
   Köfte ızgarada pişer, pişince tepsideki Köfte kutusuna uçar (stok, en çok STOK_MAX).
   Zamanlayıcılar: her gün/ana menü geçişi S.oturum'u artırır; gecikmeli işler (zaman()) eski oturumdaysa çalışmaz. */
(()=>{'use strict';
const BU=window.BU=window.BU||{};
const $=id=>document.getElementById(id);
const APP=$('app'),FX=$('fx');
const DEBUG=/[?&]debug\b/.test(location.search);
const EKSIK=[];   // sözleşmede olup modülde bulunamayanlar (test kancasında görünür)

/* ================= yedekler (modül yoksa) ================= */
const YV=(()=>{const M=[{k:'bun',gun:1,maliyet:2},{k:'patty',gun:1,maliyet:6},{k:'cheese',gun:1,maliyet:3},{k:'lettuce',gun:2,maliyet:1},{k:'tomato',gun:3,maliyet:2},{k:'onion',gun:5,maliyet:1},{k:'bacon',gun:7,maliyet:4},{k:'egg',gun:9,maliyet:2},{k:'pickle',gun:11,maliyet:1}];
  const c=k=>k==='bunTop'?0:((M.find(x=>x.k===(k==='bunBot'?'bun':k))||{}).maliyet||0);
  const V={MALZEME:M,STOK_MAX:6,KAT_MAX:10,
    acik:g=>M.filter(x=>x.gun<=g).map(x=>x.k),maliyet:ks=>(ks||[]).reduce((s,k)=>s+c(k),0),
    fiyat:o=>Math.max(15,Math.round(V.maliyet(o)*2.25/5)*5),
    bahsis:(o,f,up,seri)=>Math.max(1,Math.round(V.fiyat(o)*(.08+.66*Math.max(0,f-2/3))*(1+((up&&up.tip)||0)*.25))+(seri>=3?Math.min(5,seri-2):0)),
    ruh:f=>f>2/3?'mutlu':f>1/3?'somurtkan':'kizgin',yuz:f=>f>2/3?'happy':f>.5?'wait':f>1/3?'imp':'angry',
    dogruMu:(o,ks)=>!!ks&&ks.length>=2&&ks[0]==='bunBot'&&ks[ks.length-1]==='bunTop'&&o.slice(1,-1).sort().join()===ks.slice(1,-1).sort().join(),
    odeme(o,ks,f,up,seri){const d=V.dogruMu(o,ks),r=V.ruh(f),x={dogru:d,ruh:r,ucret:0,bahsis:0,kayip:0,can:0};
      if(!d){x.kayip=V.maliyet(ks);x.can=1;return x}if(r==='kizgin'){x.kayip=V.maliyet(ks);return x}
      x.ucret=V.fiyat(o,up);if(r==='mutlu')x.bahsis=V.bahsis(o,f,up,seri);return x},
    gun:(d,up)=>({musteri:Math.min(18,5+d),aralik:[5,8],sira:d<2?2:3,sabir:30,sabirSiparis:o=>30+(o.length-2)*4,ekstra:[0,1]}),
    siparis(g,R){R=R||Math.random;const h=V.acik(g).filter(k=>k!=='bun'&&k!=='patty');const n=Math.min(h.length,Math.floor(R()*2));const o=['patty'];
      for(let i=0;i<n;i++)o.push(h.splice(Math.floor(R()*h.length),1)[0]);return ['bunBot',...o,'bunTop']},
    pisme:up=>4-((up&&up.cook)||0)*.5,
    GELISTIR:{cook:{max:4,cost:l=>150+l*90},pat:{max:4,cost:l=>180+l*100},tip:{max:4,cost:l=>200+l*110},slot:{max:1,cost:()=>450}}};
  return V})();
const YS={svg:(ad,s='')=>`<svg class="ic ${s}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="#ffc21a" stroke="#2a1a10" stroke-width="3"/></svg>`,ADLAR:[]};
const YSES={ac(){},cal(){},muzik(){},ayar(){},durdur(){},ADLAR:[]};
// çizim yedeği: yollar BU.BURGER.src varsa ondan (g/s-<k>.svg), yoksa aynı adlandırmayla
const YB=(()=>{const src=k=>{k=k==='bunBot'||k==='bunTop'?'bun':k;return BU.BURGER&&BU.BURGER.src?BU.BURGER.src(k):'g/s-'+k+'.svg'};
  return {src,simge:k=>`<img src="${src(k)}" alt="">`,CSS:'',
    yigin:(ks,o)=>`<div class="bu-yigin" style="display:flex;flex-direction:column-reverse;align-items:center;width:${typeof o.gen==='number'?o.gen+'px':o.gen}">`+ks.map((k,i)=>`<span class="${i===ks.length-1&&o.yeni!==false?'bu-yeni':''}" style="display:block;width:100%;height:${o.yukMax?'calc('+(typeof o.yukMax==='number'?o.yukMax+'px':o.yukMax)+'/'+Math.max(4,ks.length)+')':'4cqw'};background:${k.startsWith('bun')?'#f4c676':'#8a4a26'};border:2px solid #3a1d0c;border-radius:9px"></span>`).join('')+'</div>',
    siparis:(ks)=>'<div style="display:flex;flex-wrap:wrap;justify-content:center">'+['bun',...ks.slice(1,-1)].map(k=>`<img src="${src(k)}" style="width:8cqw" alt="">`).join('')+'</div>'}})();
function modul(ad,yedek,adlar){const m=BU[ad];if(!m){EKSIK.push(ad);return yedek}
  const eks=adlar.filter(k=>m[k]===undefined);if(!eks.length)return m;
  eks.forEach(k=>EKSIK.push(ad+'.'+k));const o=Object.create(m);eks.forEach(k=>o[k]=yedek[k]);return o}
const VERI=modul('VERI',YV,['MALZEME','STOK_MAX','acik','maliyet','fiyat','bahsis','ruh','yuz','dogruMu','odeme','gun','siparis','pisme','GELISTIR']);
const SIMGE=modul('SIMGE',YS,['svg']);
const SES=modul('SES',YSES,['ac','cal','muzik','ayar','durdur']);
const BURGER=modul('BURGER',YB,['yigin','siparis','simge']);
if(EKSIK.length)console.warn('Burger Ustası: eksik modül/alan, yedek kullanılıyor:',EKSIK.join(', '));
const STOK_MAX=VERI.STOK_MAX||6,KAT_MAX=VERI.KAT_MAX||10;
if(BURGER.CSS){const st=document.createElement('style');st.id='buCss';st.textContent=BURGER.CSS;document.head.insertBefore(st,document.head.querySelector('style'))}
const ic=(ad,s)=>SIMGE.svg(ad,s);
const PARA=()=>ic('para');
const SRC=k=>BURGER.src?BURGER.src(k):YB.src(k);   // malzeme görselinin yolu
const RAW='g/raw.svg';

/* ================= metinler ================= */
const T={
 tr:{day:n=>`Gün ${n}`,play:'OYNA',cont:n=>`OYNA · Gün ${n}`,grill:'Izgara',logo2:'USTASI',plate:n=>`Tabak ${n}`,trash:'Çöp',newIng:'YENİ',lockDay:n=>`Gün ${n}`,
  dayT:n=>`Gün ${n}`,dayP:'Burgeri hazırla, müşteriye sürükle. Üç can gidince dükkân kapanır.',cust:n=>`${n} müşteri`,start:'Başla',newT:'Yeni malzeme!',
  winT:'Gün bitti!',failT:'Dükkân kapandı!',failP:'Üç can gitti. Bir daha dene!',next:'Sonraki gün',retry:'Tekrar dene',home:'Ana menü',
  pauseT:'Durakladı',resume:'Devam',fx:'Efekt',music:'Müzik',on:'AÇIK',off:'KAPALI',
  gelir:'Gelir',gider:'Gider',net:'Net kâr',bahsis:'Bahşiş',kasa:'Kasa',
  needBun:'Önce ekmek!',closed:'Burger kapandı!',full:'Tabak dolu!',noPatty:'Köfte yok: ızgaraya dokun!',stockFull:'Köfte kutusu dolu',pick:'Önce malzeme seç',cooking:'Pişiyor…',
  gone:'Gitti!',wrong:'Yanlış!',tip:'bahşiş',angryPay:'Ödemedi!',
  g:{selBun:'Ekmeği seç',tapPlate:'Tabağa dokun',tapGrill:'Izgaraya dokun: köfte pişir',cooking:'Köfte pişiyor…',sel:k=>`${T.tr.acc[k]} seç`,close:'Ekmekle kapat',drag:'Burgeri müşteriye sürükle',trashIt:'Yanlış oldu: çöpe sürükle'},
  acc:{bun:'Ekmeği',patty:'Köfteyi',cheese:'Peyniri',lettuce:'Marulu',tomato:'Domatesi',onion:'Soğanı',bacon:'Pastırmayı',egg:'Yumurtayı',pickle:'Turşuyu'},
  ing:{bun:'Ekmek',patty:'Köfte',cheese:'Peynir',lettuce:'Marul',tomato:'Domates',onion:'Soğan',bacon:'Pastırma',egg:'Yumurta',pickle:'Turşu'},
  up:{cook:['Hızlı ızgara','Köfte daha çabuk pişer'],pat:['Sabırlı müşteri','Daha uzun beklerler'],tip:['Cömert bahşiş','Daha çok bahşiş'],slot:['Geniş ızgara','3. ızgara gözü']},max:'TAM',
  credit:'Yiyecek görselleri: Bluc (itch.io)',sound:'Ses',lang:'Dil',pause:'Duraklat',lives:'Can',bin:'B',mil:'M',ondalik:','},
 en:{day:n=>`Day ${n}`,play:'PLAY',cont:n=>`PLAY · Day ${n}`,grill:'Grill',logo2:'MASTER',plate:n=>`Plate ${n}`,trash:'Trash',newIng:'NEW',lockDay:n=>`Day ${n}`,
  dayT:n=>`Day ${n}`,dayP:'Build the burger and drag it to the customer. Lose three lives and the shop closes.',cust:n=>`${n} customers`,start:'Start',newT:'New ingredient!',
  winT:'Day complete!',failT:'Shop closed!',failP:'You lost three lives. Try again!',next:'Next day',retry:'Try again',home:'Main menu',
  pauseT:'Paused',resume:'Resume',fx:'Sound',music:'Music',on:'ON',off:'OFF',
  gelir:'Income',gider:'Costs',net:'Profit',bahsis:'Tips',kasa:'Cash',
  needBun:'Bun first!',closed:'Burger is closed!',full:'Plate is full!',noPatty:'No patties: tap the grill!',stockFull:'Patty box is full',pick:'Pick an ingredient first',cooking:'Cooking…',
  gone:'Left!',wrong:'Wrong!',tip:'tip',angryPay:'No pay!',
  g:{selBun:'Pick the bun',tapPlate:'Tap the plate',tapGrill:'Tap the grill: cook a patty',cooking:'The patty is cooking…',sel:k=>`Pick the ${T.en.ing[k].toLowerCase()}`,close:'Close it with the bun',drag:'Drag the burger to the customer',trashIt:'Oops: drag it to the trash'},
  acc:{},
  ing:{bun:'Bun',patty:'Patty',cheese:'Cheese',lettuce:'Lettuce',tomato:'Tomato',onion:'Onion',bacon:'Bacon',egg:'Egg',pickle:'Pickle'},
  up:{cook:['Fast grill','Patties cook quicker'],pat:['Patient customers','They wait longer'],tip:['Big tippers','Bigger tips'],slot:['Wide grill','A 3rd grill slot']},max:'MAX',
  credit:'Food art: Bluc (itch.io)',sound:'Sound',lang:'Language',pause:'Pause',lives:'Lives',bin:'K',mil:'M',ondalik:'.'}};

/* ================= kayıt ================= */
const KEY='burgerustasi.v1';
const cihazDili=()=>(navigator.language||'tr').toLowerCase().startsWith('tr')?'tr':'en';
const SAVE=(()=>{let o={};try{o=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){}if(!o||typeof o!=='object'||Array.isArray(o))o={};
  const d={day:1,coins:0,stars:{},up:{cook:0,pat:0,tip:0,slot:0},lang:cihazDili(),seen:[],ayar:{efekt:true,muzik:true}};
  const s=Object.assign({},d,o);s.up=Object.assign({},d.up,o.up&&typeof o.up==='object'?o.up:{});s.ayar=Object.assign({},d.ayar,o.ayar&&typeof o.ayar==='object'?o.ayar:{});
  if(!Array.isArray(s.seen))s.seen=[];if(!s.stars||typeof s.stars!=='object'||Array.isArray(s.stars))s.stars={};
  // geliştirme düzeyleri 0…max tam sayı (bozuk kayıtta pişme süresi eksiye düşmesin)
  const G=VERI.GELISTIR||{};['cook','pat','tip','slot'].forEach(k=>{const mx=(G[k]&&G[k].max)|0||4;s.up[k]=Math.max(0,Math.min(mx,Math.floor(+s.up[k]||0)))});
  if(s.lang!=='tr'&&s.lang!=='en')s.lang=cihazDili();s.ayar.efekt=s.ayar.efekt!==false;s.ayar.muzik=s.ayar.muzik!==false;
  s.coins=Math.max(0,Math.round(+s.coins||0));s.day=Math.max(1,Math.floor(+s.day||1));return s})();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(SAVE))}catch(e){}};
const t=(k,...a)=>{const v=T[SAVE.lang][k];return typeof v==='function'?v(...a):v};
const tg=(k,...a)=>{const v=T[SAVE.lang].g[k];return typeof v==='function'?v(...a):v};
// büyük sayılar kısa: 123.456 → 123B (TR) / 123K (EN)
function fmt(n){const a=Math.abs(n),s=n<0?'−':'';if(a<100000)return s+a;
  const [b,x]=a<1e6?[1e3,t('bin')]:[1e6,t('mil')];const v=a/b;return s+(v<100?(Math.floor(v*10)/10).toString().replace('.',t('ondalik')):Math.floor(v))+x}

/* ================= ses ve dokunsal ================= */
let sesAcik=false;
function sesKilit(){if(sesAcik)return;sesAcik=true;try{SES.ac();SES.ayar({efekt:SAVE.ayar.efekt,muzik:SAVE.ayar.muzik});SES.muzik(!!SAVE.ayar.muzik)}catch(e){}}
document.addEventListener('pointerdown',sesKilit,{capture:true});
const ses=ad=>{if(!SAVE.ayar.efekt)return;try{SES.cal(ad)}catch(e){}};
const sesVar=ad=>!!(SES.ADLAR&&SES.ADLAR.includes(ad));
function tit(tur){try{const H=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.Haptics;
  if(H){tur==='ag'?H.notification({type:'ERROR'}):H.impact({style:tur==='orta'?'MEDIUM':'LIGHT'});return}
  navigator.vibrate&&navigator.vibrate(tur==='ag'?[40,50,40]:tur==='orta'?20:8)}catch(e){}}
function sesAyar(){try{SES.ayar({efekt:SAVE.ayar.efekt,muzik:SAVE.ayar.muzik});SES.muzik(!!SAVE.ayar.muzik)}catch(e){}save()}
// iOS Safari: iki parmakla yakınlaştırma oyunu bozmasın
['gesturestart','gesturechange'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));

/* ================= yardımcılar ================= */
const cq=()=>APP.clientWidth/100;
function rel(el){const r=el.getBoundingClientRect(),a=APP.getBoundingClientRect();return {x:r.left-a.left,y:r.top-a.top,w:r.width,h:r.height,cx:r.left-a.left+r.width/2,cy:r.top-a.top+r.height/2}}
const icinde=(p,r,pay=0)=>p.x>=r.x-pay&&p.x<=r.x+r.w+pay&&p.y>=r.y-pay&&p.y<=r.y+r.h+pay;
// gecikmeli iş: gün değişirse (startDay/openHome) çalışmaz
function zaman(fn,ms){const o=S.oturum;if(!ms){fn();return 0}return setTimeout(()=>{if(o===S.oturum)fn()},ms)}
function fxEl(cls,html,x,y){const d=document.createElement('div');d.className=cls;if(html)d.innerHTML=html;d.style.left=x+'px';d.style.top=y+'px';FX.appendChild(d);return d}
function yazi(x,y,html,cls,gec=0){zaman(()=>{const d=fxEl('yazi '+cls,html,x,y);setTimeout(()=>d.remove(),1500)},gec)}
function uyari(el,msg){FX.querySelectorAll('.uyari').forEach(x=>x.remove());const r=rel(el);const d=document.createElement('div');d.className='uyari';d.textContent=msg;FX.appendChild(d);
  const w=d.offsetWidth,W=APP.clientWidth;d.style.left=Math.min(W-w/2-4,Math.max(w/2+4,r.cx))+'px';d.style.top=Math.max(d.offsetHeight+4,r.y+2*cq())+'px';setTimeout(()=>d.remove(),1350);ses('uyari');tit()}
// küçük bir nesneyi yay çizerek uçurur (WAAPI). from/to: app içi merkez noktaları
function ucur(html,from,to,{sure=420,yay=-10,s0=1,s1=1,don=0,cls='',easing='cubic-bezier(.35,.1,.45,1)'}={}){
  const d=fxEl('ucan '+cls,html,from.x,from.y);
  const dx=to.x-from.x,dy=to.y-from.y,ay=yay*cq(),tr=(x,y,s,r)=>`translate(-50%,-50%) translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
  d.style.transform=tr(0,0,s0,0);
  return new Promise(res=>{let bitti=false;const son=()=>{if(bitti)return;bitti=true;d.remove();res()};
    try{const a=d.animate([{transform:tr(0,0,s0,0)},{transform:tr(dx*.5,dy*.5+ay,(s0+s1)/2*1.08,don/2),offset:.5},{transform:tr(dx,dy,s1,don)}],{duration:sure,easing,fill:'forwards'});a.onfinish=son}catch(e){}
    setTimeout(son,sure+250)})}
// parçacıklar: n tane renkli nokta merkezden saçılır, yerçekimiyle düşer
function sac(x,y,renkler,n=5,{yay=7,yuk=5,cls='parca',sure=520}={}){const c=cq();
  for(let i=0;i<n;i++){const d=fxEl(cls,'',x,y);const col=renkler[i%renkler.length];if(cls==='parca')d.style.background=col;
    const a=(-Math.PI/2)+(i-(n-1)/2)*(Math.PI*1.1/n)+(Math.random()-.5)*.4,v=(yay*.6+Math.random()*yay*.6)*c;
    const tx=Math.cos(a)*v,ty=Math.sin(a)*v,s=.6+Math.random()*.6;
    try{d.animate([{transform:`translate(-50%,-50%) translate(0,0) scale(${s})`,opacity:1},{transform:`translate(-50%,-50%) translate(${tx}px,${ty}px) scale(${s})`,opacity:1,offset:.45},{transform:`translate(-50%,-50%) translate(${tx*1.3}px,${ty+yuk*c}px) scale(${s*.5})`,opacity:0}],{duration:sure+Math.random()*160,easing:'ease-out',fill:'forwards'})}catch(e){}
    setTimeout(()=>d.remove(),sure+300)}}
// sabır rengi: yeşil → sarı → turuncu → kırmızı, kesintisiz
const DUR=[[0,[229,50,43]],[.3,[240,138,36]],[.6,[242,194,48]],[1,[60,196,90]]];
function sabirRenk(f){f=Math.max(0,Math.min(1,f));for(let i=1;i<DUR.length;i++){const [b,cb]=DUR[i],[a,ca]=DUR[i-1];if(f<=b){const u=(f-a)/(b-a);return `rgb(${ca.map((v,j)=>Math.round(v+(cb[j]-v)*u)).join(',')})`}}return 'rgb(60,196,90)'}
// koyma parçacıklarının renkleri
const RENK={bunBot:['#f4c676','#fde6b4'],bunTop:['#f4c676','#fffaf0'],patty:['#6b381c','#93552f'],cheese:['#ffd21f','#fff0a0'],lettuce:['#6fca47','#b5ee8c'],tomato:['#ee4a32','#ffd36b'],onion:['#fbf3ff','#c99be8'],bacon:['#b8321f','#f3b0a0'],egg:['#fff','#ffb21f'],pickle:['#5c9e2e','#9fd66a']};

/* ================= durum ================= */
const S={on:false,paused:false,gun:1,cfg:null,kasa:0,kasa0:0,gelir:0,gider:0,bahsis:0,sayi:{mutlu:0,somurtkan:0,kizgin:0},kacan:0,yanlis:0,can:3,kalan:0,bitti:0,seri:0,
  tabak:[[],[]],sec:null,stok:0,ucan:0,izgara:[],cust:[null,null,null],slotT:[0,0,0],now:0,nextAt:0,rehber:false,surukle:null,bitis:false,bitisT:0,oturum:0,koyNo:[0,0],yildiz:0};
const queue=$('queue'),tray=$('tray'),grillEl=$('grill'),TB=[$('t0'),$('t1')],COP=$('cop');
const WHO=window.KARAKTERLER||[];
function pickWho(){if(!WHO.length)return null;const busy=S.cust.filter(Boolean).map(c=>c.who);let k,n=0;do{k=WHO[Math.floor(Math.random()*WHO.length)];n++}while(busy.includes(k)&&n<20);return k}
function face(c,e){if(!c.who||!window.Musteri||c.emo===e)return;c.emo=e;c.yuzEl.innerHTML=Musteri.draw(c.who.m,e)}

/* ================= sokak sahnesi (kodla çizilir) ================= */
function sokakCiz(){const P=[];const r=(x,y,w,h,f,ek='')=>P.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${ek}/>`);
  P.push('<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc8f5"/><stop offset=".7" stop-color="#cdeefc"/><stop offset="1" stop-color="#fff2d6"/></linearGradient></defs>');
  r(0,0,400,400,'url(#sg)');
  // bulutlar
  const bulut=(x,y,s,cls)=>P.push(`<g class="bulut ${cls}"><g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity=".92"><ellipse cx="0" cy="0" rx="26" ry="14"/><ellipse cx="22" cy="-8" rx="20" ry="16"/><ellipse cx="44" cy="2" rx="22" ry="12"/><ellipse cx="20" cy="6" rx="34" ry="10"/></g></g>`);
  bulut(40,70,1,'');bulut(250,40,.8,'b2');bulut(320,120,.6,'');bulut(150,150,.5,'b2');
  // uzak binalar
  [[0,190,70,'#e9b98d'],[60,165,60,'#f0c99a'],[115,200,50,'#e3ad86'],[160,175,80,'#f2cf9e'],[235,185,55,'#e7b58c'],[285,160,65,'#efc596'],[345,195,60,'#e5b088']].forEach(([x,y,w,c])=>{r(x,y,w,400-y,c,'opacity=".75"');
    for(let yy=y+12;yy<330;yy+=22)for(let xx=x+8;xx<x+w-10;xx+=16)r(xx,yy,8,10,'#fff3cf','opacity=".55"')});
  // yakın binalar: sıcak renkler, pencere sıraları, saçak
  const B=[[-10,230,95,'#e2774f','#b9512f'],[85,250,80,'#f2b45c','#c98a32'],[165,222,75,'#d9665a','#a8443b'],[240,245,85,'#f0a25a','#c47632'],[325,228,90,'#c96e8a','#9b4a64']];
  B.forEach(([x,y,w,c,k])=>{r(x,y,w,400-y,c,`stroke="#5a2f1a" stroke-width="2"`);r(x-3,y-6,w+6,8,k,`rx="2" stroke="#5a2f1a" stroke-width="2"`);
    for(let yy=y+14;yy<322;yy+=28)for(let xx=x+10;xx<x+w-16;xx+=24){r(xx,yy,15,18,'#ffe7a3',`stroke="#5a2f1a" stroke-width="2" rx="2"`);P.push(`<path d="M${xx+7.5} ${yy}v18M${xx} ${yy+9}h15" stroke="#5a2f1a" stroke-width="1.5"/>`);r(xx-2,yy+18,19,3,k)}});
  // kaldırım: karolar ve bordür
  r(0,322,400,78,'#e8cf9e');r(0,322,400,6,'#c79a55');
  for(let x=0;x<400;x+=40)P.push(`<path d="M${x} 328v72" stroke="#d1b07a" stroke-width="2"/>`);
  P.push('<path d="M0 356h400M0 384h400" stroke="#d1b07a" stroke-width="2"/>');
  $('sahne').innerHTML=`<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${P.join('')}</svg>`}

/* ================= üst bilgi ================= */
// kasa sayısı yuvarlanarak artar/azalır. bekle: yolda olan (sikkeleri henüz varmamış) para
let kasaGor=0,kasaRAF=0,bekle=0,canGor=3;
function kasaYaz(v){$('kasa').textContent=fmt(v);$('kasaC').classList.toggle('neg',v<0)}
function kasaPop(){const k=$('kasaC');k.classList.remove('pop');void k.offsetWidth;k.classList.add('pop')}
function kasaHedef(v,{sessiz=false,sure=350}={}){cancelAnimationFrame(kasaRAF);
  if(sessiz||v===kasaGor||!S.on){kasaGor=v;kasaYaz(v);return}
  const a=kasaGor,t0=performance.now();kasaPop();
  const f=now=>{const u=Math.min(1,(now-t0)/sure),e=1-Math.pow(1-u,3);kasaGor=Math.round(a+(v-a)*e);kasaYaz(kasaGor);if(u<1)kasaRAF=requestAnimationFrame(f)};kasaRAF=requestAnimationFrame(f)}
function hud(o={}){kasaHedef(S.kasa-bekle,o);
  $('gunC').textContent=t('day',S.gun);$('prog').style.width=(S.cfg?100*S.bitti/S.cfg.musteri:0)+'%';
  const cn=$('canlar');cn.setAttribute('aria-label',t('lives')+' '+canGor);
  if(cn.children.length!==3)cn.innerHTML=[0,1,2].map(()=>'<span></span>').join('');
  [...cn.children].forEach((s,i)=>{const dolu=i<canGor,ad=dolu?'can':'can_bos';if(s.dataset.ad!==ad){if(s.dataset.ad==='can'&&!dolu){s.classList.remove('gitti');void s.offsetWidth;s.classList.add('gitti')}s.dataset.ad=ad;s.innerHTML=ic(ad)}s.classList.toggle('bos',!dolu)})}
function sesBtn(){const on=SAVE.ayar.efekt||SAVE.ayar.muzik;$('sesBtn').innerHTML=ic(on?'ses_acik':'ses_kapali');$('sesBtn').setAttribute('aria-label',t('sound'))}
$('sesBtn').onclick=()=>{const on=SAVE.ayar.efekt||SAVE.ayar.muzik;SAVE.ayar.efekt=SAVE.ayar.muzik=!on;sesAyar();sesBtn();ses('tik')};

/* ================= para efektleri ================= */
// müşteriden kasaya yay çizen sikkeler; ilk sikke varınca kasa sayısı yuvarlanır
function paraYagdir(from,miktar,gec){const o=S.oturum;const n=Math.max(4,Math.min(8,Math.round(miktar/6)+3));bekle+=miktar;let ilk=true;
  zaman(()=>{const k=rel($('kasaI'));
    for(let i=0;i<n;i++)zaman(()=>{const ox=(Math.random()-.5)*6*cq(),oy=(Math.random()-.5)*4*cq();
      ucur(PARA(),{x:from.x+ox,y:from.y+oy},{x:k.cx,y:k.cy},{sure:450,yay:-8-Math.random()*6,s0:1,s1:.7,don:200,cls:'sikke',easing:'cubic-bezier(.5,0,.7,1)'}).then(()=>{
        if(o!==S.oturum)return;if(ilk){ilk=false;bekle=Math.max(0,bekle-miktar);hud({sure:600})}
        ses('tik');const c=$('kasaC');c.classList.add('tik');setTimeout(()=>c.classList.remove('tik'),90)})},i*60)},gec)}
// mutlu teslimde baş üstünde parıltı
function parilti(x,y,gec){zaman(()=>sac(x,y,[0],8,{yay:9,yuk:-2,cls:'yildizcik',sure:700}),gec)}
// kırık kalp: müşteriden üst bilgideki cana uçar, varınca ikiye ayrılır; can o an söner
function kirikKalp(from,gec){const o=S.oturum;zaman(()=>{const hedefI=Math.max(0,canGor-1),sp=$('canlar').children[hedefI];const to=sp?rel(sp):{cx:APP.clientWidth-30*cq(),cy:8*cq()};
  ucur(ic('can'),from,{x:to.cx,y:to.cy},{sure:520,yay:-12,s0:1.3,s1:.9,cls:'kalp'}).then(()=>{if(o!==S.oturum)return;canGor=Math.max(S.can,canGor-1);hud({sessiz:true});
    const k=fxEl('kirik',`<span class="y1">${ic('can')}</span><span class="y2">${ic('can')}</span>`,to.cx-3.4*cq(),to.cy-3.4*cq());
    try{k.children[0].animate([{transform:'none',opacity:1},{transform:`translate(${-2*cq()}px,${6*cq()}px) rotate(-30deg)`,opacity:0}],{duration:600,easing:'ease-in',fill:'forwards'});
      k.children[1].animate([{transform:'none',opacity:1},{transform:`translate(${2*cq()}px,${6*cq()}px) rotate(30deg)`,opacity:0}],{duration:600,easing:'ease-in',fill:'forwards'})}catch(e){}
    setTimeout(()=>k.remove(),700)})},gec)}
function damga(c,metin,gec){zaman(()=>{const r=rel(c.yuzEl);const d=fxEl('damga',ic('carpi')+`<span>${metin}</span>`,r.cx,r.y+r.h*.35);setTimeout(()=>d.remove(),1400);
  APP.classList.remove('sars');void APP.offsetWidth;APP.classList.add('sars');setTimeout(()=>APP.classList.remove('sars'),260)},gec)}

/* ================= tepsi ================= */
// bu turda tepside 1. turun malzemeleri (2. turun yenileri dükkânla birlikte bağlanacak)
const ANAHTAR=()=>VERI.MALZEME.filter(m=>(m.gun||1)<99).map(m=>m.k);
function malGun(k){const m=VERI.MALZEME.find(x=>x.k===k);return m?m.gun:1}
function buildTray(){const acik=VERI.acik(S.gun);tray.innerHTML='';
  ANAHTAR().forEach(k=>{const b=document.createElement('button');const kilit=!acik.includes(k),g=malGun(k);
    b.className='ing'+(kilit?' kilit':'')+(!kilit&&g===S.gun&&S.gun>1?' yeni-m':'');b.dataset.k=k;b.setAttribute('aria-label',t('ing')[k]||k);
    if(!kilit&&g===S.gun&&S.gun>1)b.dataset.yeni=t('newIng');
    const im=BURGER.simge(k);
    b.innerHTML=`<span class="gol"></span><span class="im">${im}</span><span class="ad">${kilit?ic('kilit')+t('lockDay',g):t('ing')[k]||k}</span>`+(kilit?'':`<span class="al"><span class="im2">${im}</span></span>`)+(k==='patty'?'<span class="rozet">0</span>':'');
    if(!kilit)b.addEventListener('click',()=>sec(k));tray.appendChild(b)});
  trayDurum()}
function trayDurum(pop){tray.querySelectorAll('.ing').forEach(b=>{const k=b.dataset.k;b.classList.toggle('sec',S.sec===k)});
  const p=tray.querySelector('[data-k=patty]');if(p){p.classList.toggle('bos',!S.stok);const r=p.querySelector('.rozet');r.textContent=S.stok?'×'+S.stok:'0';
    if(pop){r.classList.remove('pop');void r.offsetWidth;r.classList.add('pop')}}}
function sec(k){if(!aktif())return S.sec;if(!VERI.acik(S.gun).includes(k))return S.sec;
  if(S.sec===k){S.sec=null;ses('tik')}else{S.sec=k;ses('sec');tit()}
  if(S.sec==='patty'&&!S.stok)uyari(tray.querySelector('[data-k=patty]'),t('noPatty'));
  const b=tray.querySelector(`[data-k="${k}"]`);if(b&&S.sec===k){b.classList.remove('sec');void b.offsetWidth}
  trayDurum();rehber();return S.sec}

/* ================= tabaklar ================= */
function cizTabak(i,yeni){const el=TB[i].querySelector('.yig');const ks=S.tabak[i];
  el.innerHTML=ks.length?BURGER.yigin(ks,{gen:OLC.gen,yukMax:OLC.yuk,yeni:!!yeni}):'';
  TB[i].querySelector('.tno').textContent=t('plate',i+1)}
function wob(i){const tb=TB[i];tb.classList.remove('wob');void tb.offsetWidth;tb.classList.add('wob')}
function koy(i){if(!aktif())return false;const ks=S.tabak[i],tb=TB[i],k=S.sec,son=ks[ks.length-1];
  if(S.surukle&&S.surukle.ti===i&&S.surukle.drag)return false;
  if(!k){uyari(tb,t('pick'));rehber(true);return false}
  if(son==='bunTop'){uyari(tb,t('closed'));return false}
  if(ks.length>=KAT_MAX){uyari(tb,t('full'));return false}
  let kat=k;
  if(k==='bun')kat=ks.length?'bunTop':'bunBot';
  else{if(!ks.length){uyari(tb,t('needBun'));return false}
    if(k==='patty'&&!S.stok){uyari(tb,t('noPatty'));const g=S.izgara.find(x=>x.st===0)||S.izgara[0];if(g){g.el.classList.remove('parla');void g.el.offsetWidth;g.el.classList.add('parla');setTimeout(()=>g.el.classList.remove('parla'),1600)}return false}}
  // maliyet: köfte ızgarada ödendi; diğerleri burada (üst ekmek bedava olabilir)
  let fiyat=0;if(kat!=='patty')fiyat=VERI.maliyet([...ks,kat])-VERI.maliyet(ks);
  if(kat==='patty'){S.stok--;trayDurum()}
  // uçan nesne katmanın kendi çizimi; yığın iniş anında yeniden çizilir
  const once=yukseklik(tb),r=rel(tb.querySelector('.yig'));
  ks.push(kat);harca(fiyat,tb);
  const kut=tray.querySelector(`[data-k="${k}"] .al`)||tray.querySelector(`[data-k="${k}"]`);
  const gen=parseFloat(OLC.gen)||26*cq(),inis={x:r.cx,y:r.y+r.h-once-1.2*cq()};
  const bit=()=>{cizTabak(i,false);wob(i);sac(inis.x,inis.y+1*cq(),RENK[kat]||['#fff'],kat==='bunTop'?4:6)};
  if(kut){const a=rel(kut);const tek=BURGER.yigin([kat],{gen:gen,yeni:false});
    const o=S.oturum,n=++S.koyNo[i];
    ucur(`<div style="width:${gen}px">${tek}</div>`,{x:a.cx,y:a.cy},inis,{sure:230,yay:-5,s0:.55,s1:1,cls:'kat',easing:'cubic-bezier(.3,0,.7,1)'}).then(()=>{if(o===S.oturum&&n===S.koyNo[i])bit()})}
  else bit();
  ses('birak:'+kat);tit();rehber();return true}
function yukseklik(tb){const y=tb.querySelector('.bu-yigin');return y?y.getBoundingClientRect().height:0}
function harca(n,el){if(!n)return;S.kasa-=n;S.gider+=n;hud({sure:250});const r=rel(el);yazi(r.cx+5*cq(),r.y+r.h*.35,`−${n}${PARA()}`,'mini')}

/* ================= ızgara ================= */
function buildGrill(){const n=2+(SAVE.up.slot?1:0);grillEl.querySelectorAll('.gs').forEach(e=>e.remove());S.izgara=[];grillEl.classList.toggle('g3',n>2);
  for(let i=0;i<n;i++){const b=document.createElement('button');b.className='gs';b.setAttribute('aria-label',t('grill')+' '+(i+1));b.addEventListener('click',()=>izgara(i));grillEl.appendChild(b);const g={el:b,st:0,t:0};S.izgara.push(g);bosGoz(g)}
  $('grillT').textContent=t('grill')}
function bosGoz(g){g.st=0;g.t=0;g.el.className='gs';g.el.style.removeProperty('--pis');g.el.innerHTML=`<span class="sil"><img src="${RAW}" alt=""></span>`}
function izgara(i){if(!aktif())return false;const g=S.izgara[i];if(!g)return false;
  if(g.st===0){const m=VERI.maliyet(['patty']);g.st=1;g.t=0;g.el.className='gs cig';
    g.el.innerHTML=`<span class="cember"></span><span class="kof"><img src="${RAW}" alt=""><img class="pis" src="${SRC('patty')}" alt=""></span><span class="duman d1"></span><span class="duman d2"></span><span class="duman d3"></span><i class="kivilcim k1"></i><i class="kivilcim k2"></i><i class="kivilcim k3"></i>`;
    harca(m,g.el);ses('izgara');tit();rehber();return true}
  if(g.st===2){uyari(g.el,t('stockFull'));return false}
  ses('tik');return false}
function izgaraAdim(dt){const ps=VERI.pisme(SAVE.up);S.izgara.forEach(g=>{
  if(g.st===1){g.t+=dt;const f=Math.min(1,g.t/ps);g.el.style.setProperty('--pis',f.toFixed(3));
    if(g.t>=ps){g.st=2;g.el.className='gs hazir';g.el.innerHTML=`<span class="kof"><img src="${SRC('patty')}" alt=""></span><span class="parilti"><i></i><i></i><i></i></span>`;ses('pisti');rehber()}}
  if(g.st===2&&S.stok+S.ucan<STOK_MAX){S.ucan++;const a=rel(g.el);bosGoz(g);const kut=tray.querySelector('[data-k=patty]');
    const r=kut?rel(kut):{cx:a.cx,cy:a.cy+40*cq()},o=S.oturum;
    ucur(`<img src="${SRC('patty')}" alt="">`,{x:a.cx,y:a.cy},{x:r.cx,y:r.cy-1*cq()},{sure:480,yay:-9,s0:1.1,s1:.85,don:200,cls:'kof'}).then(()=>{
      if(o!==S.oturum)return;   // gün değişti: bu köfte yeni güne geçmez
      S.ucan=Math.max(0,S.ucan-1);S.stok=Math.min(STOK_MAX,S.stok+1);trayDurum(true);
      if(kut){kut.classList.remove('dolu-gel');void kut.offsetWidth;kut.classList.add('dolu-gel')}ses('birak:patty');rehber(true)});
    rehber()}})}

/* ================= müşteriler ================= */
function spawn(){const bos=[0,1,2].filter(i=>!S.cust[i]&&S.slotT[i]<=S.now);const n=S.cust.filter(Boolean).length;if(!bos.length||n>=S.cfg.sira||S.kalan<=0)return false;
  const i=bos.includes(1)&&n===0?1:bos[Math.floor(Math.random()*bos.length)];
  const sip=S.rehber?['bunBot','patty','cheese','bunTop']:VERI.siparis(S.gun,Math.random),who=pickWho();
  const el=document.createElement('div');el.className='cust';
  el.innerHTML=`<div class="bub"><div class="sip">${BURGER.siparis(sip,{gen:'27.6cqw'})}</div><div class="sabir"><b></b></div></div><div class="yuz" role="img" aria-label="${who?who.ad:''}"></div>`;
  queue.children[i].appendChild(el);requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('in')));
  const sb=typeof S.cfg.sabirSiparis==='function'?S.cfg.sabirSiparis(sip):(VERI.sabirSiparis?VERI.sabirSiparis(sip,S.gun,SAVE.up):S.cfg.sabir);
  const max=S.rehber?Math.max(240,sb*6):sb;
  const c=S.cust[i]={i,el,sip,max,p:max,who,yuzEl:el.querySelector('.yuz'),fill:el.querySelector('.sabir b'),emo:'',ruh:'mutlu',tut:0,heyecan:false,rehberli:S.rehber};
  face(c,'happy');S.kalan--;return true}
// müşteri hemen sıradan çıkar (ikinci teslim, sabır, hedef olamaz); yalnız çıkış animasyonu gecikir
function cikar(c,tur,gec=0){if(S.cust[c.i]!==c)return false;S.cust[c.i]=null;c.gitti=true;c.heyecan=false;
  const anim=tur==='mutlu'?800:tur==='kizgin'?900:500;S.slotT[c.i]=S.now+(gec+anim+550)/1000;
  c.el.classList.remove('hedef');
  zaman(()=>{c.el.classList.add('cik',tur==='mutlu'?'mutlu-git':tur==='kizgin'?'kizgin-git':'normal-git');
    setTimeout(()=>{c.el.classList.add('out');setTimeout(()=>c.el.remove(),500)},anim)},gec);
  S.bitti++;if(c.rehberli)S.rehber=false;hud({sessiz:true});return true}
function custAdim(dt){S.cust.forEach(c=>{if(!c)return;c.p-=dt;const f=Math.max(0,c.p/c.max);
  c.fill.style.width=(f*100).toFixed(2)+'%';c.fill.style.background=sabirRenk(f);
  const r=VERI.ruh(f);if(r!==c.ruh){c.ruh=r;c.el.classList.toggle('kizgin',r==='kizgin')}
  if(S.now>=c.tut)face(c,c.heyecan&&f>1/3?'happy':VERI.yuz(f));
  if(c.p<=0)kacti(c)})}
function kacti(c){if(!cikar(c,'kizgin'))return;face(c,'angry');S.can=Math.max(0,S.can-1);S.kacan++;S.sayi.kizgin++;S.seri=0;
  const r=rel(c.yuzEl);yazi(r.cx,r.y+r.h*.3,t('gone'),'kotu');ses('kacti');setTimeout(()=>ses('can_gitti'),180);tit('ag');
  kirikKalp({x:r.cx,y:r.y+r.h*.4},120);kontrol();rehber()}

/* ================= teslim ================= */
// tabaktaki yığını müşteriye ver. Sonuç VERI.odeme ile; para efekti sonuca göre.
function teslim(ti,ci,gec=0){if(!aktif())return null;const ks=S.tabak[ti],c=S.cust[ci];if(!c||c.gitti||!ks||!ks.length)return null;
  const f=Math.max(0,c.p/c.max);
  const o=VERI.odeme(c.sip,ks.slice(),f,SAVE.up,S.seri);   // seri: bu teslimden önceki art arda mutlu sayısı
  S.tabak[ti]=[];cizTabak(ti,false);
  const ucret=o.ucret||0,bah=o.bahsis||0;S.kasa+=ucret+bah;S.gelir+=ucret;S.bahsis+=bah;
  const yr=rel(c.yuzEl),x=yr.cx,y=yr.y+yr.h*.12;
  let tur;c.tut=1e9;
  if(o.dogru&&o.ruh==='mutlu'){tur='mutlu';S.seri++;S.sayi.mutlu++;
    zaman(()=>{face(c,'love');ses('teslim_mutlu');tit('orta')},gec);
    yazi(x,y,`+${ucret}${PARA()}`,'iyi',gec);parilti(x,yr.y+yr.h*.1,gec);
    if(bah){const W=APP.clientWidth,bx=x<W/2?x+15*cq():x-15*cq();yazi(Math.min(W-14*cq(),Math.max(14*cq(),bx)),y-12*cq(),`${ic('kese')}<span>+${bah}</span><small>${t('tip')}</small>`,'bahsis',gec+400)}
    paraYagdir({x,y:yr.y+yr.h*.45},ucret+bah,gec+150)}
  else if(o.dogru&&o.ruh==='somurtkan'){tur='normal';S.seri=0;S.sayi.somurtkan++;
    zaman(()=>{face(c,'wait');ses('teslim_normal');hud({sessiz:true})},gec)}   // somurtkan: efekt yok
  else{tur='kizgin';S.seri=0;S.sayi.kizgin++;if(!o.dogru)S.yanlis++;
    zaman(()=>{face(c,'angry');c.el.classList.add('ret');ses(o.dogru?'teslim_kizgin':'yanlis');tit('ag')},gec);
    damga(c,o.dogru?t('angryPay'):t('wrong'),gec);
    yazi(x,y-6*cq(),`−${o.kayip||0}${PARA()}`,'kotu',gec+200)}
  if(o.can){S.can=Math.max(0,S.can-1);zaman(()=>ses('can_gitti'),gec+250);kirikKalp({x,y:yr.y+yr.h*.4},gec+250)}
  cikar(c,tur,gec);if(tur!=='mutlu')hud({sessiz:tur==='normal'});kontrol();rehber();return o}
function copeAt(ti){if(!aktif()||!S.tabak[ti].length)return false;S.tabak[ti]=[];cizTabak(ti,false);COP.classList.remove('yut');void COP.offsetWidth;COP.classList.add('yut');ses('cop');tit();rehber();return true}

/* ---- sürükle-bırak (Pointer Events, parmak başına kayıt) ---- */
const BAS=new Map();   // pointerId → {ti, x0, y0, drag, kay}
function surukleBagla(i){const el=TB[i];
  el.addEventListener('pointerdown',e=>{if(e.button>0||!aktif())return;e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch(_){}
    BAS.set(e.pointerId,{id:e.pointerId,ti:i,x0:e.clientX,y0:e.clientY,drag:false,kay:false,el:null,hedef:null})});
  el.addEventListener('pointermove',e=>{const d=BAS.get(e.pointerId);if(!d)return;
    if(!d.drag){if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<8)return;d.kay=true;   // kaydırma artık dokunuş sayılmaz
      if(S.surukle||!S.tabak[i].length||!aktif())return;baslat(d)}
    tasi(d,e)});
  const son=(e,iptal)=>{const d=BAS.get(e.pointerId);if(!d)return;BAS.delete(e.pointerId);
    if(d.drag){if(S.surukle===d)S.surukle=null;iptal?geriDon(d):birak(d)}
    else if(!iptal&&!d.kay)koy(i)};
  el.addEventListener('pointerup',e=>son(e,false));
  el.addEventListener('pointercancel',e=>son(e,true));
  el.addEventListener('lostpointercapture',e=>son(e,true))}
function baslat(d){d.drag=true;S.surukle=d;const tb=TB[d.ti];
  const g=document.createElement('div');g.className='hayalet';g.innerHTML=`<div class="gov">${BURGER.yigin(S.tabak[d.ti],{gen:OLC.gen,yukMax:OLC.yuk,yeni:false})}</div>`;g.style.width=OLC.gen;FX.appendChild(g);d.el=g;
  d.golge=fxEl('golge','',0,0);
  tb.classList.add('tasiniyor');ses('al');tit();rehberGizle()}
function tasi(d,e){const a=APP.getBoundingClientRect(),x=e.clientX-a.left,y=e.clientY-a.top;d.x=x;d.y=y;
  const g=d.el,w=g.offsetWidth,h=g.offsetHeight,lift=6*cq();d.gm={x,y:y-lift-h/2};
  const h2=hedefBul(d);if(h2!==d.hedef){if(d.hedef)hedefIsaret(d.hedef,false);d.hedef=h2;if(h2)hedefIsaret(h2,true)}
  let gx=x-w/2,gy=y-h-lift;
  // müşterinin üstündeyken hayalet küçülür ve baloncukla yüzün arasına oturur: yüz görünür kalır
  if(d.hedef&&d.hedef!=='cop'){const r=rel(d.hedef.yuzEl);gx=r.cx-w/2;gy=r.y+r.h*.12-h;g.classList.add('hedefte')}else g.classList.remove('hedefte');
  g.style.transform=`translate(${gx}px,${gy}px)`;
  d.golge.style.transform=`translate(${x}px,${y+1*cq()}px)`;d.golge.style.opacity=d.hedef?0:1}
function hedefBul(d){const pts=[d.gm,{x:d.x,y:d.y}];
  if(pts.some(p=>icinde(p,rel(COP),3*cq())))return 'cop';
  let en=null,ed=1e9;for(const c of S.cust){if(!c||c.gitti)continue;const r=rel(c.el);if(pts.some(p=>icinde(p,r,1.5*cq()))){const dd=Math.abs(d.x-r.cx);if(dd<ed){ed=dd;en=c}}}
  return en}
function hedefIsaret(h,on){if(h==='cop')COP.classList.toggle('hedef',on);else if(h&&h.el){h.el.classList.toggle('hedef',on);h.heyecan=on&&!h.gitti;if(on)face(h,'happy')}}
function birak(d){if(d.hedef)hedefIsaret(d.hedef,false);
  // bırakılan yere göre yeniden bak: hedef müşteri bu arada gittiyse yerine gelene teslim edilmez
  const h=d.gm?hedefBul(d):null;
  if(h==='cop'&&aktif()&&S.tabak[d.ti].length){const r=rel(COP);hayaletUc(d,{x:r.cx,y:r.cy},{s:.25,don:40}).then(()=>bitir_(d));copeAt(d.ti);return}
  if(h&&h!=='cop'&&h===d.hedef&&S.cust[h.i]===h&&aktif()){const r=rel(h.yuzEl),to={x:r.cx,y:r.y+r.h*.78};
    hayaletUc(d,to,{s:.35,sure:200}).then(()=>{torba(to);bitir_(d)});teslim(d.ti,h.i,200);return}
  geriDon(d)}
function torba(p){const d=fxEl('torba',TORBA,p.x,p.y);
  try{d.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1.15)',opacity:1,offset:.35},{transform:'scale(1)',opacity:1,offset:.7},{transform:'translateY(3cqw) scale(.9)',opacity:0}],{duration:800,easing:'ease-out',fill:'forwards'})}catch(e){}
  setTimeout(()=>d.remove(),850)}
const TORBA='<svg viewBox="0 0 48 52" aria-hidden="true"><path d="M8 14h32l3 34H5z" fill="#d9a86a" stroke="#2a1a10" stroke-width="3" stroke-linejoin="round"/><path d="M8 14l3-8h26l3 8" fill="#c48d4e" stroke="#2a1a10" stroke-width="3" stroke-linejoin="round"/><path d="M17 14q0-8 7-8t7 8" fill="none" stroke="#2a1a10" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="30" r="7" fill="#d2281e" stroke="#2a1a10" stroke-width="2.5"/><path d="M20.5 30h7" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
function geriDon(d){if(d.hedef)hedefIsaret(d.hedef,false);d.hedef=null;const yg=TB[d.ti].querySelector('.yig'),r=rel(yg);
  hayaletUc(d,{x:r.cx,y:r.y+r.h/2},{s:1/1.1,sure:220}).then(()=>bitir_(d));ses('geri')}
function bitir_(d){TB[d.ti].classList.remove('tasiniyor');if(d.el)d.el.remove();if(d.golge)d.golge.remove();d.el=d.golge=null;rehber()}
function hayaletUc(d,to,{s=1,don=0,sure=260}={}){const g=d.el;if(!g)return Promise.resolve();if(d.golge)d.golge.style.opacity=0;const w=g.offsetWidth,h=g.offsetHeight;
  g.style.transition='none';const from=g.style.transform||'',tx=to.x-w/2,ty=to.y-h/2;
  return new Promise(res=>{let ok=false;const son=()=>{if(ok)return;ok=true;res()};
    try{const a=g.animate([{transform:from,opacity:1},{transform:`translate(${tx}px,${ty}px) scale(${s}) rotate(${don}deg)`,opacity:s<.5?.2:1}],{duration:sure,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});a.onfinish=son}catch(e){}
    setTimeout(son,sure+200)})}
function surukleIptal(){if(S.surukle&&S.surukle.drag)geriDon(S.surukle);S.surukle=null;BAS.clear()}

/* ================= ilk gün rehberi ================= */
let rehberHedef=null,elAnim=null;
function rehberGizle(){document.querySelectorAll('.parla').forEach(e=>e.classList.remove('parla'));FX.querySelectorAll('.ipucu,.el').forEach(e=>e.remove());rehberHedef=null;elAnim=null}
function rehber(zorla){if(!S.on||!S.rehber||S.bitis){if(rehberHedef)rehberGizle();return}
  if(S.surukle&&S.surukle.drag)return;
  const c=S.cust.find(x=>x&&x.rehberli);if(!c){if(rehberHedef)rehberGizle();return}
  const ti=S.tabak[0].length||!S.tabak[1].length?0:1,ks=S.tabak[ti],gerek=c.sip.slice(1,-1);
  let ok=ks.length===0||ks[0]==='bunBot';const kalan=gerek.slice();
  ks.slice(1).forEach(k=>{if(k==='bunTop')return;const j=kalan.indexOf(k);if(j<0)ok=false;else kalan.splice(j,1)});
  const kapali=ks[ks.length-1]==='bunTop';if(kapali&&kalan.length)ok=false;
  let el,msg,surukleEl=false;
  const kutu=k=>tray.querySelector(`[data-k="${k}"]`);
  if(!ok){el=TB[ti];msg=tg('trashIt');surukleEl='cop'}
  else if(kapali){el=TB[ti];msg=tg('drag');surukleEl=c}
  else{const need=!ks.length?'bun':kalan.length?kalan[0]:'bun';
    if(need==='patty'&&!S.stok){const pis=S.izgara.find(g=>g.st>0);
      if(pis||S.ucan){el=(pis||S.izgara[0]).el;msg=tg('cooking')}else{el=S.izgara[0].el;msg=tg('tapGrill')}}
    else if(S.sec!==need){el=kutu(need);msg=need==='bun'?(ks.length?tg('close'):tg('selBun')):tg('sel',need)}
    else{el=TB[ti];msg=need==='bun'&&ks.length?tg('close'):tg('tapPlate')}}
  const anahtar=msg+'|'+(el&&el.id||el&&el.dataset.k||'')+'|'+(surukleEl?1:0);
  if(!zorla&&anahtar===rehberHedef)return;rehberGizle();rehberHedef=anahtar;if(!el)return;
  el.classList.add('parla');
  const tp=document.createElement('div');tp.className='ipucu';tp.innerHTML=ic('el')+`<span>${msg}</span>`;FX.appendChild(tp);
  const r=rel(el),w=tp.offsetWidth,h=tp.offsetHeight,W=APP.clientWidth,c1=cq(),ct=rel($('counter'));let x,y;
  const sinir=v=>Math.min(W-w-2*c1,Math.max(2*c1,v));
  if(el.classList.contains('gs')){   // ızgara: gözün sağında, ok sola bakar
    x=r.x+r.w+2.4*c1;y=r.cy-h/2;tp.classList.add('yan');if(x+w>W-2*c1){x=sinir(r.cx-w/2);y=r.y-h-2.4*c1;tp.classList.remove('yan')}}
  else if(el.classList.contains('tabak')){   // tabak: tezgâhın üst şeridinin hemen altında, ok tabağa iner
    const gr=rel(grillEl);x=Math.min(W-w-2*c1,Math.max(gr.x+gr.w+1.2*c1,r.cx-w/2));y=ct.y+3.6*c1;const yg=rel(el.querySelector('.tab'));if(y+h+2*c1>yg.y)y=Math.max(ct.y-h-1*c1,yg.y-h-2.4*c1)}
  else{x=r.x+r.w+2.2*c1;y=r.cy-h/2;tp.classList.add('yan');   // tepsi kutusu: yanında (tabak etiketlerinin üstüne binmez)
    if(x+w>W-2*c1){x=r.x-w-2.2*c1;tp.classList.add('sag')}
    if(x<2*c1){x=sinir(r.cx-w/2);y=r.y-h-2.4*c1;tp.classList.remove('yan','sag')}}
  tp.style.left=x+'px';tp.style.top=y+'px';if(!tp.classList.contains('yan'))tp.style.setProperty('--ok',Math.max(12,Math.min(w-12,r.cx-x))+'px');
  if(surukleEl){const hd=document.createElement('div');hd.className='el';hd.innerHTML=ic('el');FX.appendChild(hd);
    const to=surukleEl==='cop'?rel(COP):rel(surukleEl.yuzEl),s=6*c1,fr=rel(el.querySelector('.tab'));
    try{elAnim=hd.animate([{transform:`translate(${fr.cx-s}px,${fr.cy-s}px) scale(1)`,opacity:0},{opacity:1,offset:.12},{transform:`translate(${fr.cx-s}px,${fr.cy-s}px) scale(.9)`,offset:.22},{transform:`translate(${to.cx-s}px,${to.cy-s}px) scale(.9)`,opacity:1,offset:.8},{transform:`translate(${to.cx-s}px,${to.cy-s}px) scale(1)`,opacity:0}],{duration:1800,iterations:Infinity,easing:'ease-in-out'})}catch(e){}}}

/* ================= gün akışı ================= */
function aktif(){return S.on&&!S.paused&&!S.bitis&&S.can>0}
function yeniOturum(){S.oturum++;clearTimeout(S.bitisT);S.bitisT=0;cancelAnimationFrame(kasaRAF);bekle=0;surukleIptal();loopNo++}
function startDay(d,hemen){yeniOturum();S.gun=d;S.cfg=VERI.gun(d,SAVE.up);S.kasa=S.kasa0=SAVE.coins;S.gelir=S.gider=S.bahsis=0;S.sayi={mutlu:0,somurtkan:0,kizgin:0};S.kacan=S.yanlis=0;S.can=3;canGor=3;
  S.kalan=S.cfg.musteri;S.bitti=0;S.seri=0;S.tabak=[[],[]];S.koyNo=[0,0];S.sec=null;S.stok=0;S.ucan=0;S.cust=[null,null,null];S.slotT=[0,0,0];S.now=0;S.nextAt=.8;S.bitis=false;S.on=false;S.paused=false;
  S.rehber=d===1&&!SAVE.seen.includes('tut');
  [...queue.children].forEach(s=>s.innerHTML='');FX.innerHTML='';TB.forEach(x=>x.classList.remove('tasiniyor','parla','wob'));
  buildTray();buildGrill();cizTabak(0);cizTabak(1);kasaGor=S.kasa;hud({sessiz:true});sesBtn();$('home').hidden=true;$('copT').textContent=t('trash');$('copI').innerHTML=ic('cop');COP.setAttribute('aria-label',t('trash'));
  $('durBtn').innerHTML=ic('duraklat');$('durBtn').setAttribute('aria-label',t('pause'));$('kasaI').innerHTML=PARA();fit();
  const yeni=VERI.MALZEME.find(m=>m.gun===d&&d>1);
  const go=()=>{$('ov').hidden=true;S.on=true;S.paused=false;ses('gun_basla');donguBasla();rehber()};
  if(hemen){go();return}
  const w=pickWho(),mf=w&&window.Musteri?`<i class="mf">${Musteri.draw(w.m,'happy')}</i>`:ic('gulen');
  card(`<h2>${t('dayT',d)}</h2><div class="info"><span>${mf}${t('cust',S.cfg.musteri)}</span><span>${PARA()}${fmt(S.kasa)}</span></div><p>${t('dayP')}</p>`+
    (yeni&&ANAHTAR().includes(yeni.k)?`<div class="newing"><span class="im">${BURGER.simge(yeni.k)}</span><span>${t('newT')}<br>${t('ing')[yeni.k]}</span></div>`:'')+
    `<div class="btns"><button class="btn" id="go">${ic('oynat')}${t('start')}</button></div>`);
  $('go').onclick=()=>{ses('tik');go()}}
// can biterse kısa bir an sonra kaybedilir; müşteriler bitince kazanılır. Sonuç hemen kaydedilir, kart gecikir.
function kontrol(){if(!S.on||S.bitis)return;
  if(S.can<=0){bitisBaslat(false,800);return}
  if(S.kalan<=0&&!S.cust.some(Boolean))bitisBaslat(true,1300)}
function bitisBaslat(win,ms){S.bitis=true;rehberGizle();surukleIptal();kaydet(win);S.bitisT=zaman(()=>{S.bitisT=0;sonKart(win)},ms)}
function kaydet(win){const st=Math.max(win?1:0,Math.min(3,3-S.kacan-S.yanlis));S.yildiz=st;
  SAVE.coins=Math.max(0,S.kasa);
  if(win){SAVE.stars[S.gun]=Math.max(SAVE.stars[S.gun]||0,st);if(S.gun===1&&!SAVE.seen.includes('tut'))SAVE.seen.push('tut');SAVE.day=Math.max(SAVE.day,S.gun+1)}
  save()}
function bitir(win){if(!S.on)return;if(!S.bitis){S.bitis=true;rehberGizle();surukleIptal();kaydet(win)}clearTimeout(S.bitisT);S.bitisT=0;sonKart(win)}
function sonKart(win){S.on=false;S.bitis=false;rehberGizle();FX.querySelectorAll('.hayalet,.golge').forEach(e=>e.remove());TB.forEach(x=>x.classList.remove('tasiniyor'));
  ses(win?'gun_bitti':'gun_kayip');
  const st=S.yildiz|0,net=S.gelir+S.bahsis-S.gider,G=120,adim=[S.gelir,S.bahsis,-S.gider];
  const n=(v,i)=>`<b class="${v<0?'neg':v>0?'pos':''}" data-v="${v}" data-i="${i}">${v>0?'+':v<0?'−':''}0${PARA()}</b>`;
  const t0=win?.25+3*.3:.3;   // satırlar yıldızlardan sonra
  const sat=(ad,v,i,cls='')=>`<div class="r${cls}" style="--g:${(t0+i*G/1000).toFixed(2)}s"><span>${t(ad)}</span>${n(v,i)}</div>`;
  card(`<h2>${t(win?'winT':'failT')}</h2>`+(win?`<div class="stars">${[1,2,3].map(i=>`<span class="${i<=st?'dolu':'bos'}" style="--g:${(.25+(i-1)*.3).toFixed(2)}s">${ic(i<=st?'yildiz':'yildiz_bos')}</span>`).join('')}</div>`:`<p>${t('failP')}</p>`)+
    `<div class="tablo">${sat('gelir',adim[0],0)}${sat('bahsis',adim[1],1)}${sat('gider',adim[2],2)}${sat('net',net,4,' net')}</div>`+
    `<div class="yuzler" style="--g:${(t0+5*G/1000).toFixed(2)}s"><span title="${SAVE.lang==='tr'?'Mutlu':'Happy'}">${ic('gulen')}${S.sayi.mutlu}</span><span>${ic('somurtkan')}${S.sayi.somurtkan}</span><span>${ic('kizgin')}${S.sayi.kizgin}</span></div>`+
    `<div class="info"><span>${t('kasa')}: ${PARA()}${fmt(SAVE.coins)}</span></div>`+
    `<div class="btns"><button class="btn" id="nx">${ic(win?'ileri':'tekrar')}${t(win?'next':'retry')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`,'son');
  $('card').style.setProperty('--bg',(t0+6*G/1000).toFixed(2)+'s');
  // yıldız sesleri (artan perde: ses modülünde 'yildiz:1..3' varsa o, yoksa 'pisti')
  if(win)for(let i=1;i<=st;i++)setTimeout(()=>{if(!$('ov').hidden)ses(sesVar('yildiz:'+i)?'yildiz:'+i:'pisti')},(.25+(i-1)*.3+.35)*1000);
  // sayılar 0'dan sayar (net en son)
  $('card').querySelectorAll('.tablo b').forEach(b=>{const v=+b.dataset.v,i=+b.dataset.i,ilk=(t0+i*G/1000+.15)*1000;
    const yaz=x=>{b.innerHTML=`${x>0?'+':x<0?'−':''}${fmt(Math.abs(x))}${PARA()}`};
    setTimeout(()=>{const s0=performance.now(),sure=Math.min(700,250+Math.abs(v)*6);let son=0;
      const f=now=>{if(!b.isConnected)return;const u=Math.min(1,(now-s0)/sure),x=Math.round(v*(1-Math.pow(1-u,2)));yaz(x);
        if(x!==son&&now-(f.t||0)>70){f.t=now;ses('tik')}son=x;if(u<1)requestAnimationFrame(f)};requestAnimationFrame(f)},ilk)});
  if(win)setTimeout(()=>{if(!$('ov').hidden)konfeti()},(t0+.2)*1000);
  $('nx').onclick=()=>{ses('tik');startDay(win?S.gun+1:S.gun)};$('hm').onclick=()=>{ses('tik');openHome()}}
function konfeti(){const k=document.createElement('div');k.className='konfeti';const R=['#ff5b4f','#ffc21a','#37c25a','#4fb3ff','#ff8ad8','#fff'];let h='';
  for(let i=0;i<46;i++){const sk=i%5===0,x=Math.random()*100,du=1.8+Math.random()*1.6,de=Math.random()*.7;
    h+=`<i class="${sk?'sk':''}" style="left:${x}%;${sk?'':`background:${R[i%R.length]};`}--dx:${((Math.random()-.5)*30).toFixed(1)}cqw;--r:${Math.round(360+Math.random()*540)*(Math.random()<.5?-1:1)}deg;animation-duration:${du.toFixed(2)}s;animation-delay:${de.toFixed(2)}s">${sk?PARA():''}</i>`}
  k.innerHTML=h;$('ov').appendChild(k);setTimeout(()=>k.remove(),4000)}
function card(html,cls=''){$('ov').querySelectorAll('.konfeti').forEach(e=>e.remove());const c=$('card');c.className='card'+(cls?' '+cls:'');c.style.removeProperty('--bg');c.innerHTML=html;$('ov').hidden=false}
function duraklat(){if(!S.on||S.paused||S.bitis)return;S.paused=true;rehberGizle();surukleIptal();
  const tgl=(id,on,ikon,ad)=>`<button class="tg${on?'':' kapali'}" id="${id}" aria-pressed="${on}"><span class="ti">${ic(ikon)}</span><span class="d">${t(ad)}<small>${t(on?'on':'off')}</small></span></button>`;
  const kart=()=>{card(`<h2>${t('pauseT')}</h2><div class="ayarlar">${tgl('pE',SAVE.ayar.efekt,SAVE.ayar.efekt?'ses_acik':'ses_kapali','fx')}${tgl('pM',SAVE.ayar.muzik,'muzik','music')}</div>`+
    `<div class="btns"><button class="btn" id="rs">${ic('oynat')}${t('resume')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`);
    $('pE').onclick=()=>{SAVE.ayar.efekt=!SAVE.ayar.efekt;sesAyar();sesBtn();kart();ses('tik')};$('pM').onclick=()=>{SAVE.ayar.muzik=!SAVE.ayar.muzik;sesAyar();sesBtn();kart();ses('tik')};
    $('rs').onclick=()=>{ses('tik');S.paused=false;$('ov').hidden=true;donguBasla();rehber(true)};
    // gün yarıda bırakılırsa o güne kadar harcanan para gider, kazanç sayılmaz (gün tekrar oynanır)
    $('hm').onclick=()=>{ses('tik');SAVE.coins=Math.max(0,Math.min(S.kasa,S.kasa0-S.gider));save();S.on=false;openHome()}};
  kart()}
$('durBtn').onclick=()=>{ses('tik');duraklat()};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(S.on&&!S.paused)duraklat();try{SES.muzik(false)}catch(e){}}else if(sesAcik&&SAVE.ayar.muzik){try{SES.muzik(true)}catch(e){}}});

/* ================= döngü ================= */
// tek döngü: her başlatma eskisini geçersiz kılar (iki döngü aynı anda koşmaz)
let last=0,loopNo=0;
function donguBasla(){const no=++loopNo;last=performance.now();
  const f=now=>{if(no!==loopNo||!S.on||S.paused)return;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;adim(dt);requestAnimationFrame(f)};requestAnimationFrame(f)}
function adim(dt){S.now+=dt;if(S.bitis){izgaraAdim(dt);return}const n=S.cust.filter(Boolean).length;
  if(S.kalan>0&&!S.bitis){
    if(S.rehber&&n>0){S.nextAt=Math.max(S.nextAt,S.now+1.5)}   // rehberde ilk müşteri bitmeden kimse gelmez
    else if(S.now>=S.nextAt){if(spawn()){const [a,b]=S.cfg.aralik;S.nextAt=S.now+a+Math.random()*(b-a);rehber()}else S.nextAt=S.now+.4}
    if(!n&&S.nextAt-S.now>1.2)S.nextAt=S.now+1.2}   // tezgâh boşsa bekletme
  custAdim(dt);izgaraAdim(dt)}

/* ================= ana ekran ================= */
const UPI={cook:'ates',pat:'kumsaati',tip:'kese',slot:'izgara'};
function heroFaces(){if(!WHO.length||!window.Musteri)return;const a=WHO[Math.floor(Math.random()*WHO.length)];let b;do{b=WHO[Math.floor(Math.random()*WHO.length)]}while(b===a&&WHO.length>1);
  $('heroA1').innerHTML=Musteri.draw(a.m,'happy');$('heroA2').innerHTML=Musteri.draw(b.m,'love')}
// ana menü burgeri: kahraman alanına sığacak boyda (kısa ekranda logoya binmesin)
function heroCiz(){const c=cq()||3.9,h=$('heroB').closest('.hero').clientHeight||40*c;const ym=Math.max(14*c,Math.min(34*c,h-15*c));
  $('heroB').innerHTML=BURGER.yigin(['bunBot','patty','cheese','lettuce','tomato','bunTop'],{gen:Math.round(Math.min(40*c,ym*1.3)),yukMax:Math.round(ym),yeni:false})}
function openHome(){yeniOturum();S.on=false;S.paused=false;S.bitis=false;rehberGizle();FX.innerHTML='';heroFaces();$('ov').hidden=true;$('home').hidden=false;document.documentElement.lang=SAVE.lang;
  $('playBtn').innerHTML=ic('oynat')+(SAVE.day>1?t('cont',SAVE.day):t('play'));$('logo2').textContent=t('logo2');
  $('langBtn').innerHTML=ic('dil')+`<span class="${SAVE.lang==='tr'?'on':''}">TR</span><span class="${SAVE.lang==='en'?'on':''}">EN</span>`;$('langBtn').setAttribute('aria-label',t('lang'));$('credit').textContent=t('credit');
  $('hKasa').textContent=fmt(SAVE.coins);$('hKasaI').innerHTML=PARA();
  $('hEfekt').innerHTML=ic(SAVE.ayar.efekt?'ses_acik':'ses_kapali');$('hEfekt').classList.toggle('kapali',!SAVE.ayar.efekt);$('hEfekt').setAttribute('aria-label',t('fx'));
  $('hMuzik').innerHTML=ic('muzik');$('hMuzik').classList.toggle('kapali',!SAVE.ayar.muzik);$('hMuzik').setAttribute('aria-label',t('music'));
  const G=VERI.GELISTIR;
  $('ups').innerHTML=['cook','pat','tip','slot'].map(k=>{const u=G[k],l=SAVE.up[k]|0,mx=l>=u.max,c=u.cost(l),kilit=k==='slot'&&SAVE.day<4;
    return `<button class="up ${kilit?'kilit':mx?'max':SAVE.coins<c?'no':''}" data-u="${k}" aria-label="${t('up')[k][0]}"><span class="e">${ic(UPI[k])}</span><b>${t('up')[k][0]}</b><small>${t('up')[k][1]}</small>`+
      `<span class="pips">${Array.from({length:u.max},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')}</span>`+
      `<span class="c">${kilit?ic('kilit')+t('lockDay',4):mx?t('max'):PARA()+fmt(c)}</span></button>`}).join('');
  $('ups').querySelectorAll('.up').forEach(b=>b.onclick=()=>{const k=b.dataset.u,u=G[k],l=SAVE.up[k]|0,c=u.cost(l);
    if(b.classList.contains('kilit')||l>=u.max){ses('uyari');return}if(SAVE.coins<c){ses('uyari');tit();return}
    SAVE.coins-=c;SAVE.up[k]=l+1;save();ses('satin');tit('orta');openHome();const nb=$('ups').querySelector(`[data-u="${k}"]`);if(nb)nb.classList.add('aldi')});heroCiz()}
$('playBtn').onclick=()=>{ses('tik');startDay(SAVE.day)};
$('langBtn').onclick=()=>{SAVE.lang=SAVE.lang==='tr'?'en':'tr';save();ses('tik');openHome()};
$('hEfekt').onclick=()=>{SAVE.ayar.efekt=!SAVE.ayar.efekt;sesAyar();ses('tik');openHome()};
$('hMuzik').onclick=()=>{SAVE.ayar.muzik=!SAVE.ayar.muzik;sesAyar();ses('tik');openHome()};

/* ================= ekran uyumu ================= */
// müşteri yüzü sokakta kalan yüksekliğe göre (iki sıralı baloncuk için pay bırakılır); burger tezgâhın ~%70'i
const OLC={gen:'26cqw',yuk:'31cqw'};
const BUB_PAY=31;   // en yüksek baloncuk (iki sıra simge + sabır + kuyruk), cqw
function fit(){const c=cq(),H=APP.clientHeight;if(!c)return;
  APP.style.setProperty('--kh',Math.min(23,Math.max(15.5,16+(H/c-180)*.25)).toFixed(2)+'cqw');
  const st=$('street'),h=st.clientHeight;if(h){const yz=Math.max(20*c,Math.min(36*c,(h-3*c-BUB_PAY*c+3*c)/1.2));APP.style.setProperty('--yz',yz+'px')}
  const ct=$('counter').clientHeight;if(ct){const W=APP.clientWidth,gen=Math.min(28*c,(W-37*c)/2-3*c);OLC.gen=Math.round(gen)+'px';OLC.yuk=Math.round(Math.max(26*c,ct-14.5*c))+'px';
    TB.forEach(x=>x.querySelector('.yig').style.width=OLC.gen)}
  if(S.tabak)[0,1].forEach(i=>cizTabak(i,false))}
addEventListener('resize',()=>{fit();if(!$('home').hidden)heroCiz();if(S.on)rehber(true)});
TB.forEach((_,i)=>surukleBagla(i));
sokakCiz();

/* ================= test kancası ================= */
if(DEBUG)window.__bu={S,SAVE,VERI,startDay,sec,koy,teslim,izgara,bitir,copeAt,adim,openHome,save,EKSIK,
  basla:()=>{const g=$('go');if(g)g.click()},musteri:()=>S.cust.map(c=>c&&{sip:c.sip,f:c.p/c.max,ruh:c.ruh,emo:c.emo})};
openHome();fit();
})();
