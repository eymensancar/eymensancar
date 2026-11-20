/* Burger Ustası 2.0: oynanış, arayüz, ekranlar (çekirdek).
   Modüller: BU.VERI (ekonomi), BU.SIMGE (simgeler), BU.SES (ses), BU.BURGER (çizim). Biri yoksa küçük bir yedekle çalışır.
   Mutfak görünümü (5. tur): solda/üstte müşteri penceresi, kalan alan BU.MUTFAK sahnesi (gündüz → akşam).
   Akış: dolaptan ekmek / küvetten malzeme / hazır tepsisinden köfte seç → tahtadaki yere dokun (koy) → yığını müşteriye
   sürükle (teslim) ya da çöpe. Köfte ızgarada pişer, pişince hazır tepsisine uçar (en çok STOK_MAX). Yan ürünler (patates,
   soğan halkası) fritözde pişer, hazır kutusuna geçer (en çok 3); kutu müşteriye sürüklenir ya da seçilip müşteriye dokunulur.
   Teslim parça parça (VERI.teslimParca): müşteri burger + istediği yan ürünü alınca öder.
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
    yigin:(ks,o)=>`<div class="bu-yigin" style="display:flex;flex-direction:column-reverse;align-items:center;width:${typeof o.gen==='number'?o.gen+'px':o.gen}">`+ks.map((k,i)=>`<span class="${i===ks.length-1&&o.yeni!==false?'bu-yeni':''}" style="display:block;width:100%;height:${o.yukMax?'calc('+(typeof o.yukMax==='number'?o.yukMax+'px':o.yukMax)+'/'+Math.max(4,ks.length)+')':'.4rem'};background:${k.startsWith('bun')?'#f4c676':'#8a4a26'};border:2px solid #3a1d0c;border-radius:9px"></span>`).join('')+'</div>',
    siparis:(ks)=>'<div style="display:flex;flex-wrap:wrap;justify-content:center">'+['bun',...ks.slice(1,-1)].map(k=>`<img src="${src(k)}" style="width:.8rem" alt="">`).join('')+'</div>'}})();
function modul(ad,yedek,adlar){const m=BU[ad];if(!m){EKSIK.push(ad);return yedek}
  const eks=adlar.filter(k=>m[k]===undefined);if(!eks.length)return m;
  eks.forEach(k=>EKSIK.push(ad+'.'+k));const o=Object.create(m);eks.forEach(k=>o[k]=yedek[k]);return o}
const VERI=modul('VERI',YV,['MALZEME','STOK_MAX','acik','maliyet','fiyat','bahsis','ruh','yuz','dogruMu','odeme','gun','siparis','pisme','GELISTIR']);
const SIMGE=modul('SIMGE',YS,['svg']);
const SES=modul('SES',YSES,['ac','cal','muzik','ayar','durdur']);
const BURGER=modul('BURGER',YB,['yigin','siparis','simge']);
if(!BU.MUTFAK)EKSIK.push('MUTFAK');
if(EKSIK.length)console.warn('Burger Ustası: eksik modül/alan, yedek kullanılıyor:',EKSIK.join(', '));
const STOK_MAX=VERI.STOK_MAX||6,KAT_MAX=VERI.KAT_MAX||10;
if(BURGER.CSS){const st=document.createElement('style');st.id='buCss';st.textContent=BURGER.CSS;document.head.insertBefore(st,document.head.querySelector('style'))}
const ic=(ad,s)=>SIMGE.svg(ad,s);
const PARA=()=>ic('para');
const SRC=k=>BURGER.src?BURGER.src(k):YB.src(k);   // malzeme görselinin yolu
const RAW='g/raw.svg';

/* ================= metinler ================= */
const T={
 tr:{day:n=>`Gün ${n}`,play:'OYNA',cont:n=>`OYNA · Gün ${n}`,grill:'Izgara',logo2:'USTASI',plate:n=>`Tahta ${n}`,trash:'Çöp',newIng:'YENİ',lockDay:n=>`Gün ${n}`,
  dayT:n=>`Gün ${n}`,dayP:'Burgeri hazırla, müşteriye sürükle. Üç can gidince gün biter.',cust:n=>`${n} müşteri`,start:'Başla',newT:'Yeni malzeme!',
  winT:'Gün bitti!',failT:'Gün kaybedildi!',failP:'Üç can gitti. Bir daha dene!',next:'Sonraki gün',retry:'Tekrar dene',home:'Ana menü',
  pauseT:'Durakladı',resume:'Devam',fx:'Efekt',music:'Müzik',on:'AÇIK',off:'KAPALI',
  gelir:'Gelir',gider:'Gider',net:'Net kâr',bahsis:'Bahşiş',kasa:'Kasa',
  needBun:'Önce ekmek!',closed:'Burger kapandı!',full:'Burger çok yüksek!',noPatty:'Hazır köfte yok: ızgaraya dokun!',stockFull:'Hazır tepsisi dolu',pick:'Önce malzeme seç',cooking:'Pişiyor…',
  lockGrill:'Dükkân\'dan açılır',noSide:'Önce fritöze dokun',sideFull:'Hazır kutusu dolu',sideToCust:'Kutuyu müşteriye ver',gotPart:'alındı',sideTag:'Yan ürün',layerTag:'Burger',
  gone:'Gitti!',wrong:'Yanlış!',tip:'bahşiş',angryPay:'Ödemedi!',
  g:{selBun:'Dolaptan ekmeği al',tapPlate:'Tahtaya dokun',tapGrill:'Izgaraya dokun: köfte pişir',cooking:'Köfte pişiyor…',selPatty:'Hazır köfteyi al',sel:k=>`${T.tr.acc[k]} al`,close:'Dolaptan ekmekle kapat',drag:'Burgeri müşteriye sürükle',trashIt:'Yanlış oldu: çöpe sürükle'},
  acc:{bun:'Ekmeği',patty:'Köfteyi',cheese:'Peyniri',lettuce:'Marulu',tomato:'Domatesi',onion:'Soğanı',bacon:'Pastırmayı',egg:'Yumurtayı',pickle:'Turşuyu',
   sauce:'Ketçabı',mayo:'Mayonezi',mushroom:'Mantarı',jalapeno:'Jalapeñoyu',onionring:'Soğan halkasını',fries:'Patatesi',avocado:'Avokadoyu',premium:'Altın Wagyu\'yu'},
  ing:{bun:'Ekmek',patty:'Köfte',cheese:'Peynir',lettuce:'Marul',tomato:'Domates',onion:'Soğan',bacon:'Pastırma',egg:'Yumurta',pickle:'Turşu',
   sauce:'Ketçap',mayo:'Mayonez',mushroom:'Mantar',jalapeno:'Jalapeño',onionring:'Soğan halkası',fries:'Patates kızartması',avocado:'Avokado',premium:'Altın Wagyu'},
  ingK:{onionring:'Halka',premium:'Wagyu',fries:'Patates'},
  up:{cook:['Hızlı ızgara','Köfte ve patates daha çabuk pişer'],pat:['Sabırlı müşteri','Daha uzun beklerler'],tip:['Cömert bahşiş','Daha çok bahşiş'],slot:['Geniş ızgara',n=>`${n}. ızgara gözü`,'6 göz açık']},max:'TAM',
  credit:'Yiyecek görselleri: Bluc (itch.io)',sound:'Ses',lang:'Dil',pause:'Duraklat',lives:'Can',bin:'B',mil:'M',ondalik:',',
  shop:'Dükkân',shopSub:'Malzeme ve geliştirme',tabIng:'Malzemeler',tabUp:'Geliştirmeler',buy:'Satın al',owned:'Alındı',locked:'Önce öncekini al',
  adds:'menü fiyatına',porsiyon:n=>`Porsiyonu ${n}`,need:n=>`${n} daha lazım`,negShop:'Kasa ekside: kasa artıya geçene kadar alışveriş yok.',
  trayT:'Mutfağın',negKisa:'Kasa ekside',bought:'Mutfağa eklendi!',lockTap:'Ana menüdeki Dükkân\'dan alınır',allOwned:'Bütün malzemeler senin!',
  kira:'Kira',kiraBugun:'Bugünün kirası',easier:'Müşteriler bugün biraz daha sabırlı',easierNext:'Sonraki denemede müşteriler daha sabırlı olacak.',
  closedT:'Dükkân kapandı!',closedP:n=>`Kasa ${n} gün art arda ekside kaldı. 50 parayla yeniden başlıyorsun (malzemelerin duruyor).`,devam:'Devam',
  cevirT:'Telefonu yan çevir',cevirP:'Burger Ustası yatay ekranda oynanır. Bilgisayarda pencereyi genişlet.',
  eksiUyari:(n,m)=>`Kasa ekside (${n}/${m} gün). ${m} gün art arda eksi kalırsa dükkân kapanır!`,yeniMal:n=>n>1?`${n} yeni malzeme!`:'Yeni malzeme!'},
 en:{day:n=>`Day ${n}`,play:'PLAY',cont:n=>`PLAY · Day ${n}`,grill:'Grill',logo2:'MASTER',plate:n=>`Board ${n}`,trash:'Trash',newIng:'NEW',lockDay:n=>`Day ${n}`,
  dayT:n=>`Day ${n}`,dayP:'Build the burger and drag it to the customer. Lose three lives and the shop closes.',cust:n=>`${n} customers`,start:'Start',newT:'New ingredient!',
  winT:'Day complete!',failT:'Shop closed!',failP:'You lost three lives. Try again!',next:'Next day',retry:'Try again',home:'Main menu',
  pauseT:'Paused',resume:'Resume',fx:'Sound',music:'Music',on:'ON',off:'OFF',
  gelir:'Income',gider:'Costs',net:'Profit',bahsis:'Tips',kasa:'Cash',
  needBun:'Bun first!',closed:'Burger is closed!',full:'Burger is too tall!',noPatty:'No cooked patties: tap the grill!',stockFull:'The patty tray is full',pick:'Pick an ingredient first',cooking:'Cooking…',
  lockGrill:'Unlock it in the Shop',noSide:'Tap the fryer first',sideFull:'The side tray is full',sideToCust:'Give the box to a customer',gotPart:'got it',sideTag:'Side',layerTag:'Burger',
  gone:'Left!',wrong:'Wrong!',tip:'tip',angryPay:'No pay!',
  g:{selBun:'Take a bun from the cabinet',tapPlate:'Tap the board',tapGrill:'Tap the grill: cook a patty',cooking:'The patty is cooking…',selPatty:'Take a cooked patty',sel:k=>`Take the ${T.en.ing[k].toLowerCase()}`,close:'Close it with a bun from the cabinet',drag:'Drag the burger to the customer',trashIt:'Oops: drag it to the trash'},
  acc:{},
  ing:{bun:'Bun',patty:'Patty',cheese:'Cheese',lettuce:'Lettuce',tomato:'Tomato',onion:'Onion',bacon:'Bacon',egg:'Egg',pickle:'Pickle',
   sauce:'Ketchup',mayo:'Mayo',mushroom:'Mushroom',jalapeno:'Jalapeño',onionring:'Onion rings',fries:'Fries',avocado:'Avocado',premium:'Golden Wagyu'},
  ingK:{onionring:'Rings',premium:'Wagyu',mushroom:'Mushroom'},
  up:{cook:['Fast grill','Patties and fries cook quicker'],pat:['Patient customers','They wait longer'],tip:['Big tippers','Bigger tips'],slot:['Wide grill',n=>`Grill slot ${n}`,'All 6 slots open']},max:'MAX',
  credit:'Food art: Bluc (itch.io)',sound:'Sound',lang:'Language',pause:'Pause',lives:'Lives',bin:'K',mil:'M',ondalik:'.',
  shop:'Shop',shopSub:'Ingredients and upgrades',tabIng:'Ingredients',tabUp:'Upgrades',buy:'Buy',owned:'Owned',locked:'Buy the previous one first',
  adds:'to the menu price',porsiyon:n=>`Costs ${n} a serving`,need:n=>`${n} more needed`,negShop:'Your cash is below zero: no shopping until it is back above zero.',
  trayT:'Your kitchen',negKisa:'Cash below zero',bought:'Added to your kitchen!',lockTap:'Buy it in the Shop on the main menu',allOwned:'You own every ingredient!',
  kira:'Rent',kiraBugun:'Today\'s rent',easier:'Customers are a bit more patient today',easierNext:'Customers will be more patient on the next try.',
  closedT:'Shop closed!',closedP:n=>`Your cash stayed below zero for ${n} days in a row. You start again with 50 coins (you keep your ingredients).`,devam:'Continue',
  cevirT:'Turn your phone sideways',cevirP:'Burger Master is played in landscape. On a computer, make the window wider.',
  eksiUyari:(n,m)=>`Cash below zero (${n}/${m} days). ${m} days in a row below zero and the shop closes!`,yeniMal:n=>n>1?`${n} new ingredients!`:'New ingredient!'}};

/* ================= kayıt ================= */
const KEY='burgerustasi.v1';
const cihazDili=()=>(navigator.language||'tr').toLowerCase().startsWith('tr')?'tr':'en';
// 2. tur: coins eksi olabilir; mal = dükkânda alınan malzemeler (ekmek, köfte hariç), eksi = art arda eksi gün,
// hikaye = eski açılış hikâyesi izlendi mi (hikâye kaldırıldı, Eymen 21 Kasım; alan eski kayıtlarda zararsız kalır), kolay = {g: gün, n: o gün art arda kayıp} (sabır kolaylığı), yeni = son günden beri alınanlar
const SAVE=(()=>{let o={},ham=null;try{ham=localStorage.getItem(KEY);o=JSON.parse(ham)||{}}catch(e){}if(!o||typeof o!=='object'||Array.isArray(o))o={};
  const ilk=!ham||!Object.keys(o).length;   // hiç kayıt yok: yeni oyuncu
  const d={day:1,coins:ilk?(VERI.BASLANGIC|0||50):0,stars:{},up:{cook:0,pat:0,tip:0,slot:0},lang:cihazDili(),seen:[],ayar:{efekt:true,muzik:true},eksi:0,kolay:{g:0,n:0},yeni:[]};
  const s=Object.assign({},d,o);s.up=Object.assign({},d.up,o.up&&typeof o.up==='object'?o.up:{});s.ayar=Object.assign({},d.ayar,o.ayar&&typeof o.ayar==='object'?o.ayar:{});
  if(!Array.isArray(s.seen))s.seen=[];if(!s.stars||typeof s.stars!=='object'||Array.isArray(s.stars))s.stars={};
  // geliştirme düzeyleri 0…max tam sayı (bozuk kayıtta pişme süresi eksiye düşmesin)
  const G=VERI.GELISTIR||{};['cook','pat','tip','slot'].forEach(k=>{const mx=(G[k]&&G[k].max)|0||4;s.up[k]=Math.max(0,Math.min(mx,Math.floor(+s.up[k]||0)))});
  if(s.lang!=='tr'&&s.lang!=='en')s.lang=cihazDili();s.ayar.efekt=s.ayar.efekt!==false;s.ayar.muzik=s.ayar.muzik!==false;
  s.coins=Math.round(+s.coins||0);s.day=Math.max(1,Math.floor(+s.day||1));
  // malzemeler: eski kayıtta yoksa 1. turda o güne kadar açılmış olanlar (eski oyuncu kaybetmesin); yeni oyuncuda hiçbiri
  const SIRA=VERI.SATIN_SIRA||[];
  if(!Array.isArray(s.mal))s.mal=ilk?[]:(VERI.eskiSahip?VERI.eskiSahip(s.day):[]);
  s.mal=SIRA.filter(k=>s.mal.includes(k));
  s.eksi=Math.max(0,Math.floor(+s.eksi||0));
  if(!s.kolay||typeof s.kolay!=='object')s.kolay={g:0,n:0};s.kolay={g:s.kolay.g|0,n:Math.max(0,Math.min(3,s.kolay.n|0))};
  if(!Array.isArray(s.yeni))s.yeni=[];s.yeni=s.yeni.filter(k=>s.mal.includes(k));return s})();
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
// birim (px): 1rem = 10 birim (index.html: güvenli yüksekliğin %1'i ya da güvenli genişliğin 1/190'ı, hangisi küçükse)
const cq=()=>parseFloat(getComputedStyle(document.documentElement).fontSize)/10||APP.clientWidth/190;
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
const RENK={bunBot:['#f4c676','#fde6b4'],bunTop:['#f4c676','#fffaf0'],patty:['#6b381c','#93552f'],cheese:['#ffd21f','#fff0a0'],lettuce:['#6fca47','#b5ee8c'],tomato:['#ee4a32','#ffd36b'],onion:['#fbf3ff','#c99be8'],bacon:['#b8321f','#f3b0a0'],egg:['#fff','#ffb21f'],pickle:['#5c9e2e','#9fd66a'],
  sauce:['#d8321f','#ff8a3c'],mayo:['#fff4d6','#efdcaa'],fries:['#ffc93a','#e5322b'],mushroom:['#a8714a','#e8cfae'],jalapeno:['#3f9a2c','#8fd65a'],onionring:['#e0a23c','#ffd98a'],avocado:['#7bbf3c','#f2e48a'],premium:['#ffc21a','#7a3a1c']};

/* ================= durum ================= */
const S={on:false,paused:false,gun:1,cfg:null,kasa:0,kasa0:0,gelir:0,gider:0,bahsis:0,sayi:{mutlu:0,somurtkan:0,kizgin:0},kacan:0,yanlis:0,can:3,kalan:0,bitti:0,seri:0,
  tabak:[[],[]],sec:null,yanSec:null,fritoz:{},yanStok:{},yanUcan:{},acik:null,yeniler:[],kolay:0,kira:0,kapandi:false,stok:0,ucan:0,izgara:[],cust:[null,null,null],slotT:[0,0,0],now:0,nextAt:0,rehber:false,surukle:null,bitis:false,bitisT:0,oturum:0,koyNo:[0,0],yildiz:0};
const queue=$('queue');
const WHO=window.KARAKTERLER||[];
function pickWho(){if(!WHO.length)return null;const busy=S.cust.filter(Boolean).map(c=>c.who);let k,n=0;do{k=WHO[Math.floor(Math.random()*WHO.length)];n++}while(busy.includes(k)&&n<20);return k}
function face(c,e){if(!c.who||!window.Musteri||c.emo===e)return;c.emo=e;c.yuzEl.innerHTML=Musteri.draw(c.who.m,e)}

/* ================= sokak sahnesi (kodla çizilir) ================= */
// Yatay sahne: 1000×400 birim, alttan hizalı (xMidYMax slice); dar ekranda yanlar, geniş ekranda gökyüzü kırpılır.
function sokakCiz(){const P=[],GW=1000;const r=(x,y,w,h,f,ek='')=>P.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${ek}/>`);
  P.push('<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc8f5"/><stop offset=".7" stop-color="#cdeefc"/><stop offset="1" stop-color="#fff2d6"/></linearGradient></defs>');
  r(0,0,GW,400,'url(#sg)');
  // bulutlar
  const bulut=(x,y,s,cls)=>P.push(`<g class="bulut ${cls}"><g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity=".92"><ellipse cx="0" cy="0" rx="26" ry="14"/><ellipse cx="22" cy="-8" rx="20" ry="16"/><ellipse cx="44" cy="2" rx="22" ry="12"/><ellipse cx="20" cy="6" rx="34" ry="10"/></g></g>`);
  [[60,90,1,''],[250,60,.8,'b2'],[430,120,.6,''],[560,70,.9,'b2'],[720,110,.7,''],[880,55,.8,'b2'],[150,160,.5,'b2'],[800,170,.5,'']].forEach(([x,y,s,c])=>bulut(x,y,s,c));
  // uzak binalar (dikey sahnedeki dizi yan yana tekrarlanır)
  const UZ=[[0,190,70,'#e9b98d'],[60,165,60,'#f0c99a'],[115,200,50,'#e3ad86'],[160,175,80,'#f2cf9e'],[235,185,55,'#e7b58c'],[285,160,65,'#efc596'],[345,195,60,'#e5b088']];
  for(let o=0;o<GW;o+=400)UZ.forEach(([x,y,w,c])=>{x+=o;if(x>GW)return;r(x,y,w,400-y,c,'opacity=".75"');
    for(let yy=y+12;yy<330;yy+=22)for(let xx=x+8;xx<x+w-10;xx+=16)r(xx,yy,8,10,'#fff3cf','opacity=".55"')});
  // yakın binalar: sıcak renkler, pencere sıraları, saçak
  const YK=[[-10,230,95,'#e2774f','#b9512f'],[85,250,80,'#f2b45c','#c98a32'],[165,222,75,'#d9665a','#a8443b'],[240,245,85,'#f0a25a','#c47632'],[325,228,90,'#c96e8a','#9b4a64'],
    [415,240,85,'#e2774f','#b9512f'],[500,224,80,'#7fb0c9','#4f7f99'],[580,248,90,'#f2b45c','#c98a32'],[670,226,78,'#d9665a','#a8443b'],[748,242,86,'#c96e8a','#9b4a64'],[834,230,82,'#f0a25a','#c47632'],[916,246,94,'#e2774f','#b9512f']];
  YK.forEach(([x,y,w,c,k])=>{r(x,y,w,400-y,c,`stroke="#5a2f1a" stroke-width="2"`);r(x-3,y-6,w+6,8,k,`rx="2" stroke="#5a2f1a" stroke-width="2"`);
    for(let yy=y+14;yy<322;yy+=28)for(let xx=x+10;xx<x+w-16;xx+=24){r(xx,yy,15,18,'#ffe7a3',`stroke="#5a2f1a" stroke-width="2" rx="2"`);P.push(`<path d="M${xx+7.5} ${yy}v18M${xx} ${yy+9}h15" stroke="#5a2f1a" stroke-width="1.5"/>`);r(xx-2,yy+18,19,3,k)}});
  // kaldırım: karolar ve bordür
  r(0,322,GW,78,'#e8cf9e');r(0,322,GW,6,'#c79a55');
  for(let x=0;x<GW;x+=40)P.push(`<path d="M${x} 328v72" stroke="#d1b07a" stroke-width="2"/>`);
  P.push(`<path d="M0 356h${GW}M0 384h${GW}" stroke="#d1b07a" stroke-width="2"/>`);
  $('sahne').innerHTML=`<svg viewBox="0 0 ${GW} 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${P.join('')}</svg>`}

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

/* ================= mutfak: sahne ve canlı katmanlar ================= */
// Sahne (BU.MUTFAK.ciz) bir kez çizilir ve <img> olarak konur (gündüz + akşam, akşam katmanının saydamlığı günle artar).
// Üstündeki canlı öğeler YER dikdörtgenlerine oturur (#ic: 1600×900 birimlik kutu, öğeler yüzdeyle). Statik çizimler
// (küvet içleri, ekmek dolabı, sos, fritöz, kutular) de <img> (bir kez rasterlenir; üstünden bir şey geçince yeniden boyanmaz).
const MT=BU.MUTFAK,YER=MT.YER,ICP=MT.IC;
const IC_=$('ic'),MUT=$('mutfak');
const IMG=new Map();
function imgUrl(key,fn){let u=IMG.get(key);if(u)return u;let s=fn();if(!/^<svg[^>]*xmlns=/.test(s))s=s.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
  try{u=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'}))}catch(e){u='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)}IMG.set(key,u);return u}
const im=(key,fn,cls='')=>`<img${cls?` class="${cls}"`:''} src="${imgUrl(key,fn)}" alt="" draggable="false">`;
const yuzde=r=>`left:${+(r.x/16).toFixed(4)}%;top:${+(r.y/9).toFixed(4)}%;width:${+(r.w/16).toFixed(4)}%;height:${+(r.h/9).toFixed(4)}%`;
// iç yerleşim: r dikdörtgeni, kapsayan E kutusuna göre yüzde
const icYuzde=(r,E)=>`left:${+(100*(r.x-E.x)/E.w).toFixed(3)}%;top:${+(100*(r.y-E.y)/E.h).toFixed(3)}%;width:${+(100*r.w/E.w).toFixed(3)}%;height:${+(100*r.h/E.h).toFixed(3)}%`;
const icine=(r,p)=>({x:r.x+p,y:r.y+p,w:r.w-2*p,h:r.h-2*p});
const genis=(r,x,u,a=u)=>({x:r.x-x,y:r.y-u,w:r.w+2*x,h:r.h+u+a});
const SATIS=k=>(VERI.MALZEME.find(m=>m.k===k)||{});
const yanMi=k=>VERI.yanMi?VERI.yanMi(k):k==='fries'||k==='onionring';
const ACIK=()=>VERI.acik(SAVE.mal);   // sahip olunanlar (ekmek ve köfte her zaman; yan ürünler dahil)
const fiyatAc=k=>VERI.fiyatAc?VERI.fiyatAc(k):0;
const ANAHTAR=()=>VERI.MALZEME.map(m=>m.k);
const YANLAR=()=>VERI.YAN||['fries','onionring'];
const YAN_MAX=VERI.YAN_STOK_MAX||3;
// ızgara gözlerinin açılma sırası: önce alt sıra (oyuncuya yakın), soldan sağa; sonra üst sıra
const GOZ_SIRA=[3,4,5,0,1,2];
// dokunma kutuları: çizimin çevresindeki boşluğun yarısı kadar büyür (komşusuna binmez; 852×393'te hepsi ≥ 44 px)
const HIT={kuvet:[3,4],goz:[4,4],sos:[6,6,14],tahta:[4,6,14],yanHazir:[6,6,14],hazir:[5,4],fritoz:[4,4],ekmek:[0,0],cop:[6,6]};
let MK={kuvet:{},sos:{},fritoz:{},yanHazir:{},tahta:[],yig:[],goz:[]};
function kur(cls,r,tur,html,{btn=true,attr=''}={}){const h=HIT[tur]||[0,0],E=genis(r,h[0],h[1],h[2]!=null?h[2]:h[1]);
  const el=document.createElement(btn?'button':'div');el.className='y '+cls;el.setAttribute('style',yuzde(E));if(btn)el.type='button';
  el.innerHTML=`<span class="gor" style="${icYuzde(r,E)}">${html||''}</span>`;if(attr)attr.split(';').forEach(a=>{const [k,v]=a.split('=');if(k)el.setAttribute(k,v)});
  IC_.appendChild(el);el._E=E;el._r=r;return el}
const gor=el=>el.querySelector('.gor');
// seçilince küvetten "avuçla" kalkan malzeme
const avuc=k=>`<span class="al"><span class="im2">${BURGER.simge(k==='bunBot'||k==='bunTop'?'bun':k)}</span></span><span class="gol"></span>`;
const kilitFiyat=k=>`<span class="kf">${ic('kilit')}<b>${fmt(fiyatAc(k))}</b></span>`;
function buildMutfak(){const acik=S.acik||ACIK();IC_.innerHTML='';MK={kuvet:{},sos:{},fritoz:{},yanHazir:{},tahta:[],yig:[],goz:[]};
  // ekmek dolabı (ekmekler + cam)
  const e=YER.ekmek;MK.ekmek=kur('dolap',e,'ekmek',`<span class="dic">${im('dolap',()=>BURGER.ekmekDolabi({arka:false}))}</span>${MT.cam()}`+avuc('bun'));
  MK.ekmek.dataset.k='bun';MK.ekmek.setAttribute('aria-label',t('ing').bun);MK.ekmek.addEventListener('click',()=>sec('bun'));
  // ızgara gözleri ve hazır köfte tepsisi
  buildGrill();
  MK.hazir=kur('hazir',YER.hazir,'hazir','<span class="kofteler"></span>'+avuc('patty')+'<span class="rozet">0</span>');MK.hazir.dataset.k='patty';
  MK.hazir.setAttribute('aria-label',t('ing').patty);MK.hazir.addEventListener('click',()=>sec('patty'));
  // küvetler
  (MT.KUV_UST||[]).concat(MT.KUV_ALT||[]).forEach(k=>{if(!YER.kuvet[k]||k==='bos')return;const r=YER.kuvet[k],var_=acik.includes(k);
    const html=var_?`<span class="ici" style="${icYuzde(icine(r,ICP.kuvet),r)}">${im('kuvet-'+k,()=>BURGER.kuvetIci(k))}</span>`+avuc(k)
      :`${im('kapak',()=>MT.kuvetKapak())}<span class="fiyat">${fmt(fiyatAc(k))}</span>`;
    const b=kur('kuvet'+(var_?'':' kilit'),r,'kuvet',html);b.dataset.k=k;b.setAttribute('aria-label',(t('ing')[k]||k)+(var_?'':' ('+fmt(fiyatAc(k))+')'));
    if(var_&&(S.yeniler||[]).includes(k)){b.classList.add('yeni-m');b.dataset.yeni=t('newIng')}
    b.addEventListener('click',()=>var_?sec(k):(aktif()&&uyari(b,t('lockTap'))));MK.kuvet[k]=b});
  // sos kâseleri
  ['sauce','mayo'].forEach(k=>{const r=YER.sos[k];if(!r)return;const var_=acik.includes(k);
    const html=var_?`<span class="ici" style="${icYuzde(icine(r,ICP.sos),r)}">${im('sos-'+k,()=>BURGER.sosKase(k))}</span><span class="kasik">${MT.kasik()}</span>`+avuc(k):kilitFiyat(k);
    const b=kur('sos'+(var_?'':' kilit'),r,'sos',html);b.dataset.k=k;b.setAttribute('aria-label',(t('ing')[k]||k)+(var_?'':' ('+fmt(fiyatAc(k))+')'));
    if(var_&&(S.yeniler||[]).includes(k)){b.classList.add('yeni-m');b.dataset.yeni=t('newIng')}
    b.addEventListener('click',()=>var_?sec(k):(aktif()&&uyari(b,t('lockTap'))));MK.sos[k]=b});
  // hazırlık tahtası: iki çalışma yeri; burger yığını tahtanın üstünde yükselir
  YER.tahta.forEach((r,i)=>{const b=kur('tahta',r,'tahta','<span class="yer-iz"></span>',{btn:false});b.dataset.i=i;b.setAttribute('role','button');b.setAttribute('aria-label',t('plate',i+1));MK.tahta[i]=b;
    const y=document.createElement('div');y.className='yig';y.dataset.i=i;IC_.appendChild(y);MK.yig[i]=y;
    surukleBagla(b,{kaynak:()=>S.tabak[i].length?{tur:'burger',ti:i}:null,dokun:()=>koy(i)});
    // yığın küvetlerin üstüne binebilir: tahtanın üst kenarından yukarıda dokunulursa alttaki küvet/kâse seçilir, sürükleme yığını taşır
    surukleBagla(y,{kaynak:()=>S.tabak[i].length?{tur:'burger',ti:i}:null,dokun:e=>{const tr=MK.tahta[i].getBoundingClientRect();
      if(e&&e.clientY<tr.top){const alt=document.elementsFromPoint(e.clientX,e.clientY).map(x=>x.closest&&x.closest('#ic .y')).find(x=>x&&x!==MK.tahta[i]);if(alt){alt.click();return}}
      koy(i)}})});
  // fritöz ve yan ürün hazır tepsileri
  S.fritoz={};S.yanStok={};S.yanUcan={};
  YANLAR().forEach(k=>{const var_=acik.includes(k),r=YER.fritoz[k],h=YER.yanHazir[k];if(!r||!h)return;
    const f=kur('fritoz'+(var_?'':' kilit'),r,'fritoz',var_?'<span class="sepet"></span><span class="dm"></span><span class="pis"><b></b></span>':kilitFiyat(k));f.dataset.k=k;
    f.setAttribute('aria-label',(t('ing')[k]||k)+(var_?'':' ('+fmt(fiyatAc(k))+')'));
    if(var_&&(S.yeniler||[]).includes(k)){f.classList.add('yeni-m');f.dataset.yeni=t('newIng')}
    f.addEventListener('click',()=>var_?fritoz(k):(aktif()&&uyari(f,t('lockTap'))));MK.fritoz[k]=f;
    const y=kur('yanhazir'+(var_?'':' kilit'),h,'yanHazir',`<span class="ici" style="${icYuzde(icine(h,ICP.yanHazir),h)}"></span>`+avuc(k)+'<span class="rozet">0</span>',{btn:false});
    y.dataset.k=k;y.setAttribute('role','button');y.setAttribute('aria-label',t('ing')[k]||k);MK.yanHazir[k]=y;
    if(var_){S.fritoz[k]={st:0,t:0,durum:''};S.yanStok[k]=0;S.yanUcan[k]=0;
      surukleBagla(y,{kaynak:()=>S.yanStok[k]>0?{tur:'yan',k}:null,dokun:()=>yanSec(k)})}
    else y.addEventListener('click',()=>aktif()&&uyari(y,t('lockTap')))});
  // çöp (bırakma hedefi)
  MK.cop=kur('copk',YER.cop,'cop','',{btn:false});MK.cop.setAttribute('role','img');MK.cop.setAttribute('aria-label',t('trash'));
  hazirCiz();YANLAR().forEach(k=>yanCiz(k));trayDurum()}
// seçili malzemenin kaynağı (ekmek dolabı, hazır köfte tepsisi, küvet, sos kâsesi)
const kaynakEl=k=>k==='bun'?MK.ekmek:k==='patty'?MK.hazir:MK.kuvet[k]||MK.sos[k]||null;
function trayDurum(pop){['bun','patty',...Object.keys(MK.kuvet),...Object.keys(MK.sos)].forEach(k=>{const el=kaynakEl(k);if(el)el.classList.toggle('sec',S.sec===k)});
  YANLAR().forEach(k=>{const el=MK.yanHazir[k];if(el)el.classList.toggle('sec',S.yanSec===k)});
  if(MK.hazir){MK.hazir.classList.toggle('bos',!S.stok);const r=MK.hazir.querySelector('.rozet');r.textContent=S.stok?'×'+S.stok:'0';
    if(pop){r.classList.remove('pop');void r.offsetWidth;r.classList.add('pop')}}}
// hazır köfte tepsisi: pişmiş köfteler üst üste (en çok 6)
function hazirCiz(){if(!MK.hazir)return;const n=Math.min(STOK_MAX,S.stok);let h='';
  for(let i=0;i<n;i++)h+=`<img src="${SRC('patty')}" alt="" style="bottom:${(3+i*12.2).toFixed(1)}%;z-index:${10-i}">`;
  MK.hazir.querySelector('.kofteler').innerHTML=h;trayDurum()}
// yan ürün hazır tepsisi: kutular (1–3)
function yanCiz(k,pop){const el=MK.yanHazir[k];if(!el||!S.yanStok||S.yanStok[k]==null)return;const n=Math.min(YAN_MAX,S.yanStok[k]);
  el.querySelector('.ici').innerHTML=n?im('kutu-'+k+n,()=>BURGER.yan(k,'kutu',{adet:n})):'';el.classList.toggle('bos',!n);
  const r=el.querySelector('.rozet');r.textContent=n?'×'+n:'0';if(pop){r.classList.remove('pop');void r.offsetWidth;r.classList.add('pop')}}
function sec(k){if(!aktif())return S.sec;if(!(S.acik||ACIK()).includes(k)||yanMi(k))return S.sec;
  S.yanSec=null;
  if(S.sec===k){S.sec=null;ses('tik')}else{S.sec=k;ses('sec');tit()}
  if(S.sec==='patty'&&!S.stok)uyari(MK.hazir,t('noPatty'));
  const b=kaynakEl(k);if(b&&S.sec===k){b.classList.remove('sec');void b.offsetWidth}
  trayDurum();rehber();return S.sec}
// yan ürün seç (sonra müşteriye dokun) — sürüklemek de olur
function yanSec(k){if(!aktif()||!S.yanStok||S.yanStok[k]==null)return null;
  if(!S.yanStok[k]){uyari(MK.yanHazir[k],t('noSide'));return null}
  S.sec=null;if(S.yanSec===k){S.yanSec=null;ses('tik')}else{S.yanSec=k;ses('sec');tit()}
  const el=MK.yanHazir[k];if(el&&S.yanSec===k){el.classList.remove('sec');void el.offsetWidth}
  trayDurum();rehber();return S.yanSec}

/* ================= tahta (iki çalışma yeri) ================= */
// yığın: tahtanın üstünde, alt kenarı tahtanın ortasında; yukarı doğru küvetlerin üstüne binebilir (en çok YIG.yuk birim)
const YIG={gen:220,yuk:270,taban:.72};
function yigYer(i){const r=YER.tahta[i],cx=r.x+r.w/2,taban=r.y+r.h*YIG.taban;return {x:cx-YIG.gen/2,y:taban-YIG.yuk,w:YIG.gen,h:YIG.yuk}}
function cizTabak(i,yeni){const el=MK.yig[i];if(!el)return;const ks=S.tabak[i];
  el.innerHTML=ks.length?yiginHtml(ks,!!yeni):'';MK.tahta[i].classList.toggle('dolu',!!ks.length)}
// yığın: doğal yüksekliği sığıyorsa öyle (katmanlar yayılmasın), sığmıyorsa yukMax'a sıkışır
function yiginHtml(ks,yeni){let h=BURGER.yigin(ks,{gen:OLC.gen,yeni});const m=/aspect-ratio:200\/([\d.]+)/.exec(h);
  if(m&&parseFloat(OLC.gen)*parseFloat(m[1])/200>parseFloat(OLC.yuk))h=BURGER.yigin(ks,{gen:OLC.gen,yukMax:OLC.yuk,yeni});return h}
function wob(i){const y=MK.yig[i];if(!y)return;y.classList.remove('wob');void y.offsetWidth;y.classList.add('wob')}
function koy(i){if(!aktif())return false;const ks=S.tabak[i],tb=MK.tahta[i],k=S.sec,son=ks[ks.length-1];
  if(S.surukle&&S.surukle.ti===i&&S.surukle.drag)return false;
  if(!k){uyari(tb,t(S.yanSec?'sideToCust':'pick'));rehber(true);return false}
  if(son==='bunTop'){uyari(tb,t('closed'));return false}
  if(ks.length>=KAT_MAX){uyari(tb,t('full'));return false}
  let kat=k;
  if(k==='bun')kat=ks.length?'bunTop':'bunBot';
  else{if(!ks.length){uyari(tb,t('needBun'));return false}
    if(k==='patty'&&!S.stok){uyari(tb,t('noPatty'));const g=S.izgara.find(x=>x.st===0)||S.izgara.find(x=>x.st>=0);if(g){g.el.classList.remove('parla');void g.el.offsetWidth;g.el.classList.add('parla');setTimeout(()=>g.el.classList.remove('parla'),1600)}return false}}
  // maliyet: köfte ızgarada ödendi; diğerleri burada (üst ekmek bedava olabilir)
  let fiyat=0;if(kat!=='patty')fiyat=VERI.maliyet([...ks,kat])-VERI.maliyet(ks);
  if(kat==='patty'){S.stok--;hazirCiz()}
  const once=yukseklik(i),r=rel(MK.yig[i]);
  ks.push(kat);harca(fiyat,tb);
  const src=kaynakEl(k),kut=src&&(src.querySelector('.al')||src);
  const gen=parseFloat(OLC.gen)||26*cq(),inis={x:r.cx,y:r.y+r.h-once-1*cq()};
  const bit=()=>{cizTabak(i,false);wob(i);sac(inis.x,inis.y+1*cq(),RENK[kat]||['#fff'],kat==='bunTop'?4:6)};
  if(kut){const a=rel(kut);const tek=BURGER.yigin([kat],{gen:gen,yeni:false});
    const o=S.oturum,n=++S.koyNo[i];
    ucur(`<div style="width:${gen}px">${tek}</div>`,{x:a.cx,y:a.cy},inis,{sure:260,yay:-7,s0:.55,s1:1,cls:'kat',easing:'cubic-bezier(.3,0,.7,1)'}).then(()=>{if(o===S.oturum&&n===S.koyNo[i])bit()})}
  else bit();
  ses('birak:'+kat);tit();rehber();return true}
function yukseklik(i){const y=MK.yig[i]&&MK.yig[i].querySelector('.bu-yigin');return y?y.getBoundingClientRect().height:0}
function harca(n,el){if(!n)return;S.kasa-=n;S.gider+=n;hud({sure:250});const r=rel(el);yazi(r.cx+3*cq(),r.y+r.h*.3,`−${n}${PARA()}`,'mini')}

/* ================= ızgara (6 göz) ================= */
function acikGoz(){return Math.max(1,Math.min(6,VERI.izgaraGoz?VERI.izgaraGoz(SAVE.up):2+(SAVE.up.slot|0)))}
function buildGrill(){const n=acikGoz();S.izgara=[];MK.goz=[];
  YER.izgara.forEach((r,j)=>{const sira=GOZ_SIRA.indexOf(j),kil=sira>=n;
    const b=kur('goz'+(kil?' kilit':''),r,'goz','');b.dataset.i=j;b.setAttribute('aria-label',t('grill')+' '+(sira+1)+(kil?' ('+t('lockGrill')+')':''));
    const g={el:b,st:kil?-1:0,t:0,j,durum:''};MK.goz[j]=b;
    b.addEventListener('click',()=>kil?(aktif()&&uyari(b,t('lockGrill'))):izgaraDokun(g));
    if(!kil)S.izgara[sira]=g;gozCiz(g,kil)});
  S.izgara=S.izgara.filter(Boolean)}
// gözün görünüşü yalnız durum değişince yeniden kurulur; pişme çubuğu --pis değişkeniyle
function gozCiz(g,kil){const d=kil?'kilitli':g.st===0?'bos':g.st===2?'hazir':(g.t/VERI.pisme(SAVE.up))<.35?'cig':'pisiyor';if(d===g.durum)return;g.durum=d;
  const el=gor(g.el);
  el.innerHTML=d==='bos'?`<span class="sil"><img src="${RAW}" alt=""></span>`:im('goz-'+d,()=>MT.izgaraGoz(d))+(d==='cig'||d==='pisiyor'?`<span class="kor"></span><span class="dm">${MT.duman()}</span><span class="pis"><b></b></span>`:'')+(d==='hazir'?'<span class="parilti"><i></i><i></i><i></i></span>':'');
  g.el.classList.toggle('pisiyor',d==='cig'||d==='pisiyor');g.el.classList.toggle('hazir',d==='hazir')}
function izgaraDokun(g){if(!aktif())return false;
  if(g.st===0){const m=VERI.maliyet(['patty']);g.st=1;g.t=0;gozCiz(g);g.el.style.setProperty('--pis','0');
    harca(m,g.el);ses('izgara');tit();sac(rel(g.el).cx,rel(g.el).cy,['#ff9a2a','#ffd36b'],5,{yay:5,yuk:2});rehber();return true}
  if(g.st===2){uyari(g.el,t('stockFull'));return false}
  ses('tik');return false}
function izgara(i){const g=S.izgara[i];return g?izgaraDokun(g):false}
function izgaraAdim(dt){const ps=VERI.pisme(SAVE.up);S.izgara.forEach(g=>{
  if(g.st===1){g.t+=dt;const f=Math.min(1,g.t/ps);g.el.style.setProperty('--pis',f.toFixed(3));
    if(g.t>=ps){g.st=2;ses('pisti');rehber()}gozCiz(g)}
  if(g.st===2&&S.stok+S.ucan<STOK_MAX){S.ucan++;const a=rel(g.el);g.st=0;g.t=0;gozCiz(g);
    const h=rel(MK.hazir),n=S.stok+S.ucan-1,o=S.oturum;
    const to={x:h.cx,y:h.y+h.h*(1-.1-.15*Math.min(5,n)*(.82))};
    ucur(`<img src="${SRC('patty')}" alt="">`,{x:a.cx,y:a.cy},to,{sure:480,yay:-9,s0:1.1,s1:.85,don:200,cls:'kof'}).then(()=>{
      if(o!==S.oturum)return;   // gün değişti: bu köfte yeni güne geçmez
      S.ucan=Math.max(0,S.ucan-1);S.stok=Math.min(STOK_MAX,S.stok+1);hazirCiz();trayDurum(true);
      MK.hazir.classList.remove('dolu-gel');void MK.hazir.offsetWidth;MK.hazir.classList.add('dolu-gel');ses('birak:patty');rehber(true)});
    rehber()}})}

/* ================= fritöz (yan ürünler) ================= */
function fritozCiz(k){const f=S.fritoz[k],el=MK.fritoz[k];if(!f||!el)return;const ps=VERI.yanPisme?VERI.yanPisme(SAVE.up,k):5;
  const d=f.st===0?'':f.st===2?'hazir':f.t/ps<.3?'cig':'pisiyor';if(d===f.durum)return;f.durum=d;
  el.querySelector('.sepet').innerHTML=d?im('sepet-'+k+d,()=>BURGER.yan(k,d)):'';
  el.querySelector('.dm').innerHTML=d==='pisiyor'||d==='cig'?MT.duman():'';
  el.classList.toggle('pisiyor',d==='cig'||d==='pisiyor');el.classList.toggle('hazir',d==='hazir')}
function fritoz(k){if(!aktif())return false;const f=S.fritoz&&S.fritoz[k];if(!f)return false;const el=MK.fritoz[k];
  if(f.st===0){f.st=1;f.t=0;el.style.setProperty('--pis','0');fritozCiz(k);harca(SATIS(k).maliyet|0,el);ses('izgara');tit();rehber();return true}
  if(f.st===2){uyari(el,t('sideFull'));return false}
  ses('tik');return false}
function fritozAdim(dt){if(!S.fritoz)return;for(const k in S.fritoz){const f=S.fritoz[k],el=MK.fritoz[k],ps=VERI.yanPisme?VERI.yanPisme(SAVE.up,k):5;
  if(f.st===1){f.t+=dt;el.style.setProperty('--pis',Math.min(1,f.t/ps).toFixed(3));if(f.t>=ps){f.st=2;ses('pisti')}fritozCiz(k)}
  if(f.st===2&&S.yanStok[k]+S.yanUcan[k]<YAN_MAX){S.yanUcan[k]++;f.st=0;f.t=0;const a=rel(el);fritozCiz(k);const h=rel(MK.yanHazir[k]),o=S.oturum;
    ucur(im('tek-'+k,()=>BURGER.yan(k,'kutu',{tek:true})),{x:a.cx,y:a.cy},{x:h.cx,y:h.cy},{sure:520,yay:-10,s0:.7,s1:.9,don:0,cls:'kutu'}).then(()=>{
      if(o!==S.oturum)return;S.yanUcan[k]=Math.max(0,S.yanUcan[k]-1);S.yanStok[k]=Math.min(YAN_MAX,S.yanStok[k]+1);yanCiz(k,true);
      const y=MK.yanHazir[k];y.classList.remove('dolu-gel');void y.offsetWidth;y.classList.add('dolu-gel');ses('birak:'+k);rehber(true)})}}}

/* ================= müşteriler ================= */
function spawn(){const bos=[0,1,2].filter(i=>!S.cust[i]&&S.slotT[i]<=S.now);const n=S.cust.filter(Boolean).length;if(!bos.length||n>=S.cfg.sira||S.kalan<=0)return false;
  const i=bos.includes(0)&&n===0?0:bos[Math.floor(Math.random()*bos.length)];
  const sip=S.rehber?{katmanlar:['bunBot','patty',...(S.acik.includes('cheese')?['cheese']:[]),'bunTop'],yan:null}
    :VERI.siparisTam?VERI.siparisTam(S.gun,Math.random,SAVE.mal):{katmanlar:VERI.siparis(S.gun,Math.random,SAVE.mal),yan:null};
  const who=pickWho();
  const el=document.createElement('div');el.className='cust';
  el.innerHTML=`<div class="bub"><div class="sip"></div><div class="sabir"><b></b></div></div><div class="yuz" role="img" aria-label="${who?who.ad:''}"></div>`;
  queue.children[i].appendChild(el);requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('in')));
  const sb=typeof S.cfg.sabirSiparis==='function'?S.cfg.sabirSiparis(sip):(VERI.sabirSiparis?VERI.sabirSiparis(sip,S.gun,SAVE.up):S.cfg.sabir);
  const max=S.rehber?Math.max(240,sb*6):Math.round(sb*(1+.15*S.kolay));   // art arda kayıpta sabır +%15 (en çok +%45)
  const c=S.cust[i]={i,el,sip,durum:VERI.yeniDurum?VERI.yeniDurum(sip):null,max,p:max,who,yuzEl:el.querySelector('.yuz'),fill:el.querySelector('.sabir b'),emo:'',ruh:'mutlu',tut:0,heyecan:false,rehberli:S.rehber};
  el.addEventListener('click',()=>{if(S.yanSec&&aktif()&&S.cust[c.i]===c)yanVer(S.yanSec,c.i)});
  custFit(c);face(c,'happy');S.kalan--;return true}
// müşteri hemen sıradan çıkar (ikinci teslim, sabır, hedef olamaz); yalnız çıkış animasyonu gecikir
function cikar(c,tur,gec=0){if(S.cust[c.i]!==c)return false;S.cust[c.i]=null;c.gitti=true;c.heyecan=false;
  const anim=tur==='mutlu'?800:tur==='kizgin'?900:500;S.slotT[c.i]=S.now+(gec+anim+550)/1000;
  c.el.classList.remove('hedef');
  zaman(()=>{c.el.classList.add('cik',tur==='mutlu'?'mutlu-git':tur==='kizgin'?'kizgin-git':'normal-git');
    setTimeout(()=>{c.el.classList.add('out');setTimeout(()=>c.el.remove(),500)},anim)},gec);
  S.bitti++;if(c.rehberli)S.rehber=false;hud({sessiz:true});aksamGuncelle();return true}
function custAdim(dt){S.cust.forEach(c=>{if(!c)return;c.p-=dt;const f=Math.max(0,c.p/c.max);
  c.fill.style.width=(f*100).toFixed(2)+'%';c.fill.style.background=sabirRenk(f);
  const r=VERI.ruh(f);if(r!==c.ruh){c.ruh=r;c.el.classList.toggle('kizgin',r==='kizgin')}
  if(S.now>=c.tut)face(c,c.heyecan&&f>1/3?'happy':VERI.yuz(f));
  if(c.p<=0)kacti(c)})}
function kacti(c){if(!cikar(c,'kizgin'))return;face(c,'angry');S.can=Math.max(0,S.can-1);S.kacan++;S.sayi.kizgin++;S.seri=0;
  const r=rel(c.yuzEl);yazi(r.cx,r.y+r.h*.3,t('gone'),'kotu');ses('kacti');setTimeout(()=>ses('can_gitti'),180);tit('ag');
  kirikKalp({x:r.cx,y:r.y+r.h*.4},120);kontrol();rehber()}
const sipKat=c=>c.sip&&c.sip.katmanlar?c.sip.katmanlar:c.sip;
const sipYan=c=>c.sip&&c.sip.yan?[c.sip.yan]:[];
// baloncukta verilen parça soluklaşır (sipariş alındı)
function alindi(c){const a={},d=c.durum;if(!d)return a;
  if(d.burger&&BURGER.grupla)BURGER.grupla(sipKat(c)).forEach(x=>a[x.k]=x.n);if(d.yan&&c.sip.yan)a[c.sip.yan]=1;return a}

/* ================= teslim (parça parça) ================= */
// parca: katman dizisi (burger) ya da yan ürün anahtarı. VERI.teslimParca: 'parca' (doğru, sipariş sürüyor), 'tamam' (ödeme), 'yanlis'.
function teslimEt(c,parca,gec=0){const f=Math.max(0,c.p/c.max);
  const o=VERI.teslimParca?VERI.teslimParca(c.durum,parca,f,SAVE.up,S.seri):Object.assign({sonuc:'tamam'},VERI.odeme(sipKat(c),parca,f,SAVE.up,S.seri));
  if(o.durum)c.durum=o.durum;
  const yr=rel(c.yuzEl),x=yr.cx,y=yr.y+yr.h*.12;
  if(o.sonuc==='parca'){   // ilk doğru parça: sabır %15 dolar; baloncukta verilen parça soluklaşır
    if(o.sabirEk>0)c.p=Math.min(c.max,c.p+o.sabirEk*c.max);c.tut=S.now+(gec/1000)+.9;
    zaman(()=>{face(c,'happy');c.gen=null;custFit(c);ses('teslim_normal');tit();const b=rel(c.el.querySelector('.bub'));
      yazi(b.cx,b.y,`${ic('tik')}<span>${t('gotPart')}</span>`,'iyi kucuk');c.el.classList.remove('aldi1');void c.el.offsetWidth;c.el.classList.add('aldi1')},gec);
    rehber();return o}
  const ucret=o.ucret||0,bah=o.bahsis||0;S.kasa+=ucret+bah;S.gelir+=ucret;S.bahsis+=bah;
  let tur;c.tut=1e9;
  if(o.dogru&&o.ruh==='mutlu'){tur='mutlu';S.seri++;S.sayi.mutlu++;
    zaman(()=>{face(c,'love');ses('teslim_mutlu');tit('orta')},gec);
    yazi(x,y,`+${ucret}${PARA()}`,'iyi',gec);parilti(x,yr.y+yr.h*.1,gec);
    if(bah){const W=APP.clientWidth,bx=x+12*cq();yazi(Math.min(W-14*cq(),Math.max(14*cq(),bx)),y-10*cq(),`${ic('kese')}<span>+${bah}</span><small>${t('tip')}</small>`,'bahsis',gec+400)}
    paraYagdir({x,y:yr.y+yr.h*.45},ucret+bah,gec+150)}
  else if(o.dogru&&o.ruh==='somurtkan'){tur='normal';S.seri=0;S.sayi.somurtkan++;
    zaman(()=>{face(c,'wait');ses('teslim_normal');hud({sessiz:true})},gec)}   // somurtkan: efekt yok
  else{tur='kizgin';S.seri=0;S.sayi.kizgin++;if(!o.dogru)S.yanlis++;
    zaman(()=>{face(c,'angry');c.el.classList.add('ret');ses(o.dogru?'teslim_kizgin':'yanlis');tit('ag')},gec);
    damga(c,o.dogru?t('angryPay'):t('wrong'),gec);
    yazi(x,y-6*cq(),`−${o.kayip||0}${PARA()}`,'kotu',gec+200)}
  if(o.can){S.can=Math.max(0,S.can-1);zaman(()=>ses('can_gitti'),gec+250);kirikKalp({x,y:yr.y+yr.h*.4},gec+250)}
  cikar(c,tur,gec);if(tur!=='mutlu')hud({sessiz:tur==='normal'});kontrol();rehber();return o}
// tahtadaki yığını müşteriye ver
function teslim(ti,ci,gec=0){if(!aktif())return null;const ks=S.tabak[ti],c=S.cust[ci];if(!c||c.gitti||!ks||!ks.length)return null;
  S.tabak[ti]=[];cizTabak(ti,false);return teslimEt(c,ks.slice(),gec)}
// hazır kutusundaki yan ürünü müşteriye ver
function yanVer(k,ci,gec=0){if(!aktif())return null;const c=S.cust[ci];if(!c||c.gitti||!S.yanStok||!(S.yanStok[k]>0))return null;
  S.yanStok[k]--;if(S.yanSec===k&&!S.yanStok[k])S.yanSec=null;yanCiz(k);trayDurum();
  if(!gec){const a=rel(MK.yanHazir[k]),r=rel(c.yuzEl);ucur(im('tek-'+k,()=>BURGER.yan(k,'kutu',{tek:true})),{x:a.cx,y:a.cy},{x:r.cx,y:r.y+r.h*.7},{sure:260,yay:-8,s0:.8,s1:.5,cls:'kutu'}).then(()=>torba({x:r.cx,y:r.y+r.h*.78}));gec=260}
  return teslimEt(c,k,gec)}
function copeAt(ti){if(!aktif()||!S.tabak[ti].length)return false;S.tabak[ti]=[];cizTabak(ti,false);copYut();ses('cop');tit();rehber();return true}
function yanCope(k){if(!aktif()||!(S.yanStok[k]>0))return false;S.yanStok[k]--;if(S.yanSec===k&&!S.yanStok[k])S.yanSec=null;yanCiz(k);trayDurum();copYut();ses('cop');tit();return true}
function copYut(){const c=MK.cop;if(!c)return;c.classList.remove('yut');void c.offsetWidth;c.classList.add('yut')}

/* ---- sürükle-bırak (Pointer Events, parmak başına kayıt): burger yığını ya da yan ürün kutusu ---- */
const BAS=new Map();   // pointerId → {x0, y0, drag, kay, src}
function surukleBagla(el,{kaynak,dokun}){
  el.addEventListener('pointerdown',e=>{if(e.button>0||!aktif())return;e.preventDefault();e.stopPropagation();try{el.setPointerCapture(e.pointerId)}catch(_){}
    BAS.set(e.pointerId,{id:e.pointerId,x0:e.clientX,y0:e.clientY,drag:false,kay:false,el:null,hedef:null,kaynakEl:el})});
  el.addEventListener('pointermove',e=>{const d=BAS.get(e.pointerId);if(!d||d.kaynakEl!==el)return;
    if(!d.drag){if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<8)return;d.kay=true;   // kaydırma artık dokunuş sayılmaz
      const src=kaynak();if(S.surukle||!src||!aktif())return;Object.assign(d,src);baslat(d)}
    tasi(d,e)});
  const son=(e,iptal)=>{const d=BAS.get(e.pointerId);if(!d||d.kaynakEl!==el)return;BAS.delete(e.pointerId);
    if(d.drag){if(S.surukle===d)S.surukle=null;iptal?geriDon(d):birak(d)}
    else if(!iptal&&!d.kay)dokun(e)};
  el.addEventListener('pointerup',e=>son(e,false));
  el.addEventListener('pointercancel',e=>son(e,true));
  el.addEventListener('lostpointercapture',e=>son(e,true))}
function baslat(d){d.drag=true;S.surukle=d;const g=document.createElement('div');g.className='hayalet'+(d.tur==='yan'?' yan':'');
  if(d.tur==='yan'){const w=Math.round(Math.max(12*cq(),parseFloat(OLC.gen)*.5));g.innerHTML=`<div class="gov">${im('tek-'+d.k,()=>BURGER.yan(d.k,'kutu',{tek:true}))}</div>`;g.style.width=w+'px';MK.yanHazir[d.k].classList.add('tasiniyor')}
  else{g.innerHTML=`<div class="gov">${yiginHtml(S.tabak[d.ti],false)}</div>`;g.style.width=OLC.gen;MK.yig[d.ti].classList.add('tasiniyor');MK.tahta[d.ti].classList.add('tasiniyor')}
  FX.appendChild(g);d.el=g;d.golge=fxEl('golge','',0,0);
  if(d.tur==='yan'){S.yanSec=null;trayDurum()}
  ses('al');tit();rehberGizle()}
function tasi(d,e){const a=APP.getBoundingClientRect(),x=e.clientX-a.left,y=e.clientY-a.top;d.x=x;d.y=y;
  const g=d.el,w=g.offsetWidth,h=g.offsetHeight,lift=5*cq();d.gm={x,y:y-lift-h/2};
  const h2=hedefBul(d);if(h2!==d.hedef){if(d.hedef)hedefIsaret(d.hedef,false);d.hedef=h2;if(h2)hedefIsaret(h2,true)}
  let gx=x-w/2,gy=y-h-lift;
  // müşterinin üstündeyken hayalet küçülür ve yüzün üstüne oturur: yüz görünür kalır
  if(d.hedef&&d.hedef!=='cop'){const r=rel(d.hedef.yuzEl);gx=r.cx-w/2;gy=r.y+r.h*.25-h;g.classList.add('hedefte')}else g.classList.remove('hedefte');
  g.style.transform=`translate(${gx}px,${gy}px)`;
  d.golge.style.transform=`translate(${x}px,${y+1*cq()}px)`;d.golge.style.opacity=d.hedef?0:1}
function hedefBul(d){const pts=[d.gm,{x:d.x,y:d.y}];
  if(MK.cop&&pts.some(p=>icinde(p,rel(MK.cop),2*cq())))return 'cop';
  let en=null,ed=1e9;for(const c of S.cust){if(!c||c.gitti)continue;const r=rel(c.el);if(pts.some(p=>icinde(p,r,1.2*cq()))){const dd=Math.hypot(d.x-r.cx,d.y-r.cy);if(dd<ed){ed=dd;en=c}}}
  return en}
function hedefIsaret(h,on){if(h==='cop'){if(MK.cop)MK.cop.classList.toggle('hedef',on)}else if(h&&h.el){h.el.classList.toggle('hedef',on);h.heyecan=on&&!h.gitti;if(on)face(h,'happy')}}
const elde=d=>d.tur==='yan'?S.yanStok[d.k]>0:S.tabak[d.ti].length>0;
function birak(d){if(d.hedef)hedefIsaret(d.hedef,false);
  // bırakılan yere göre yeniden bak: hedef müşteri bu arada gittiyse yerine gelene teslim edilmez
  const h=d.gm?hedefBul(d):null;
  if(h==='cop'&&aktif()&&elde(d)){const r=rel(MK.cop);hayaletUc(d,{x:r.cx,y:r.y+r.h*.3},{s:.25,don:40}).then(()=>bitir_(d));d.tur==='yan'?yanCope(d.k):copeAt(d.ti);return}
  if(h&&h!=='cop'&&h===d.hedef&&S.cust[h.i]===h&&aktif()&&elde(d)){const r=rel(h.yuzEl),to={x:r.cx,y:r.y+r.h*.7};
    hayaletUc(d,to,{s:.35,sure:200}).then(()=>{torba(to);bitir_(d)});d.tur==='yan'?yanVer(d.k,h.i,200):teslim(d.ti,h.i,200);return}
  geriDon(d)}
function torba(p){const d=fxEl('torba',TORBA,p.x,p.y);
  try{d.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1.15)',opacity:1,offset:.35},{transform:'scale(1)',opacity:1,offset:.7},{transform:'translateY(.3rem) scale(.9)',opacity:0}],{duration:800,easing:'ease-out',fill:'forwards'})}catch(e){}
  setTimeout(()=>d.remove(),850)}
const TORBA='<svg viewBox="0 0 48 52" aria-hidden="true"><path d="M8 14h32l3 34H5z" fill="#d9a86a" stroke="#2a1a10" stroke-width="3" stroke-linejoin="round"/><path d="M8 14l3-8h26l3 8" fill="#c48d4e" stroke="#2a1a10" stroke-width="3" stroke-linejoin="round"/><path d="M17 14q0-8 7-8t7 8" fill="none" stroke="#2a1a10" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="30" r="7" fill="#d2281e" stroke="#2a1a10" stroke-width="2.5"/><path d="M20.5 30h7" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
function geriDon(d){if(d.hedef)hedefIsaret(d.hedef,false);d.hedef=null;
  const yer=d.tur==='yan'?MK.yanHazir[d.k]:MK.yig[d.ti],r=rel(yer);
  hayaletUc(d,{x:r.cx,y:d.tur==='yan'?r.cy:r.y+r.h-yukseklik(d.ti)/2},{s:1/1.1,sure:220}).then(()=>bitir_(d));ses('geri')}
function bitir_(d){if(d.tur==='yan'){if(MK.yanHazir[d.k])MK.yanHazir[d.k].classList.remove('tasiniyor')}else if(MK.yig[d.ti]){MK.yig[d.ti].classList.remove('tasiniyor');MK.tahta[d.ti].classList.remove('tasiniyor')}
  if(d.el)d.el.remove();if(d.golge)d.golge.remove();d.el=d.golge=null;rehber()}
function hayaletUc(d,to,{s=1,don=0,sure=260}={}){const g=d.el;if(!g)return Promise.resolve();if(d.golge)d.golge.style.opacity=0;const w=g.offsetWidth,h=g.offsetHeight;
  g.style.transition='none';const from=g.style.transform||'',tx=to.x-w/2,ty=to.y-h/2;
  return new Promise(res=>{let ok=false;const son=()=>{if(ok)return;ok=true;res()};
    try{const a=g.animate([{transform:from,opacity:1},{transform:`translate(${tx}px,${ty}px) scale(${s}) rotate(${don}deg)`,opacity:s<.5?.2:1}],{duration:sure,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});a.onfinish=son}catch(e){}
    setTimeout(son,sure+200)})}
function surukleIptal(){if(S.surukle&&S.surukle.drag)geriDon(S.surukle);S.surukle=null;BAS.clear()}

/* ================= ilk gün rehberi ================= */
// yeni akış: dolaptan ekmek → tahta → ızgara → hazır köfte → tahta → (peynir) → ekmekle kapat → müşteriye sürükle
let rehberHedef=null,elAnim=null;
function rehberGizle(){document.querySelectorAll('.parla').forEach(e=>e.classList.remove('parla'));FX.querySelectorAll('.ipucu,.el').forEach(e=>e.remove());rehberHedef=null;elAnim=null}
function rehber(zorla){if(!S.on||!S.rehber||S.bitis){if(rehberHedef)rehberGizle();return}
  if(S.surukle&&S.surukle.drag)return;
  const c=S.cust.find(x=>x&&x.rehberli);if(!c){if(rehberHedef)rehberGizle();return}
  const ti=S.tabak[0].length||!S.tabak[1].length?0:1,ks=S.tabak[ti],gerek=sipKat(c).slice(1,-1);
  let ok=ks.length===0||ks[0]==='bunBot';const kalan=gerek.slice();
  ks.slice(1).forEach(k=>{if(k==='bunTop')return;const j=kalan.indexOf(k);if(j<0)ok=false;else kalan.splice(j,1)});
  const kapali=ks[ks.length-1]==='bunTop';if(kapali&&kalan.length)ok=false;
  let el,msg,surukleEl=false;
  if(!ok){el=MK.tahta[ti];msg=tg('trashIt');surukleEl='cop'}
  else if(kapali){el=MK.tahta[ti];msg=tg('drag');surukleEl=c}
  else{const need=!ks.length?'bun':kalan.length?kalan[0]:'bun';
    if(need==='patty'&&!S.stok){const pis=S.izgara.find(g=>g.st>0);
      if(pis||S.ucan){el=(pis||S.izgara[0]).el;msg=tg('cooking')}else{el=S.izgara[0].el;msg=tg('tapGrill')}}
    else if(S.sec!==need){el=kaynakEl(need);msg=need==='bun'?(ks.length?tg('close'):tg('selBun')):need==='patty'?tg('selPatty'):tg('sel',need)}
    else{el=MK.tahta[ti];msg=need==='bun'&&ks.length?tg('close'):tg('tapPlate')}}
  const anahtar=msg+'|'+(el&&(el.dataset.k||el.dataset.i)||'')+'|'+(surukleEl?1:0);
  if(!zorla&&anahtar===rehberHedef)return;rehberGizle();rehberHedef=anahtar;if(!el)return;
  el.classList.add('parla');
  const tp=document.createElement('div');tp.className='ipucu';tp.innerHTML=ic('el')+`<span>${msg}</span>`;FX.appendChild(tp);
  const r=rel(el),w=tp.offsetWidth,h=tp.offsetHeight,W=APP.clientWidth,c1=cq(),hb=rel($('hud'));let x=Math.min(W-w-1.5*c1,Math.max(1.5*c1,r.cx-w/2)),y=r.y-h-2*c1;
  // üstte yer yoksa (üst bilgiye biner) altına
  if(y<hb.y+hb.h+.5*c1){y=r.y+r.h+2*c1;tp.classList.add('alt')}
  tp.style.left=x+'px';tp.style.top=y+'px';tp.style.setProperty('--ok',Math.max(12,Math.min(w-12,r.cx-x))+'px');
  if(surukleEl){const hd=document.createElement('div');hd.className='el';hd.innerHTML=ic('el');FX.appendChild(hd);
    const to=surukleEl==='cop'?rel(MK.cop):rel(surukleEl.yuzEl),s=6*c1,yg=MK.yig[ti].querySelector('.bu-yigin'),fr=yg?rel(yg):r;
    try{elAnim=hd.animate([{transform:`translate(${fr.cx-s}px,${fr.cy-s}px) scale(1)`,opacity:0},{opacity:1,offset:.12},{transform:`translate(${fr.cx-s}px,${fr.cy-s}px) scale(.9)`,offset:.22},{transform:`translate(${to.cx-s}px,${to.cy-s}px) scale(.9)`,opacity:1,offset:.8},{transform:`translate(${to.cx-s}px,${to.cy-s}px) scale(1)`,opacity:0}],{duration:1800,iterations:Infinity,easing:'ease-in-out'})}catch(e){}}}

/* ================= gün akışı ================= */
function aktif(){return S.on&&!S.paused&&!S.bitis&&S.can>0}
function yeniOturum(){S.oturum++;clearTimeout(S.bitisT);S.bitisT=0;cancelAnimationFrame(kasaRAF);bekle=0;surukleIptal();loopNo++}
function startDay(d,hemen){yeniOturum();S.gun=d;S.acik=ACIK();S.cfg=VERI.gun(d,SAVE.up,SAVE.mal);
  S.kolay=SAVE.kolay.g===d?Math.min(3,SAVE.kolay.n):0;
  // son günden beri dükkânda alınanlar bu gün "YENİ" rozetiyle görünür
  S.yeniler=SAVE.yeni.slice();if(SAVE.yeni.length){SAVE.yeni=[];save()}S.kasa=S.kasa0=SAVE.coins;S.gelir=S.gider=S.bahsis=0;S.sayi={mutlu:0,somurtkan:0,kizgin:0};S.kacan=S.yanlis=0;S.can=3;canGor=3;
  S.kalan=S.cfg.musteri;S.bitti=0;S.seri=0;S.tabak=[[],[]];S.koyNo=[0,0];S.sec=null;S.yanSec=null;S.stok=0;S.ucan=0;S.cust=[null,null,null];S.slotT=[0,0,0];S.now=0;S.nextAt=.8;S.bitis=false;S.on=false;S.paused=false;
  S.rehber=d===1&&!SAVE.seen.includes('tut');
  [...queue.children].forEach(s=>s.innerHTML='');FX.innerHTML='';
  buildMutfak();kasaGor=S.kasa;hud({sessiz:true});sesBtn();$('home').hidden=true;$('shop').hidden=true;APP.classList.remove('dukkanda');
  $('durBtn').innerHTML=ic('duraklat');$('durBtn').setAttribute('aria-label',t('pause'));$('kasaI').innerHTML=PARA();fit();cizTabak(0);cizTabak(1);aksamGuncelle(true);
  const yeni=S.yeniler;
  const go=()=>{$('ov').hidden=true;S.on=true;S.paused=false;ses('gun_basla');donguBasla();rehber();yonKontrol()};
  if(hemen){go();return}
  const w=pickWho(),mf=w&&window.Musteri?`<i class="mf">${Musteri.draw(w.m,'happy')}</i>`:ic('gulen');
  const kr=VERI.kira?VERI.kira(d):(S.cfg.kira|0);
  // yatay kart: solda bilgiler (müşteri, kasa, kira, kolaylık), sağda açıklama, yeni malzemeler ve Başla
  card(`<h2>${t('dayT',d)}</h2><div class="kol"><div class="info"><span>${mf}${t('cust',S.cfg.musteri)}</span><span class="${S.kasa<0?'neg':''}">${PARA()}${fmt(S.kasa)}</span></div>`+
    `<div class="kirasatir">${ic('kira')}<span>${t('kiraBugun')}</span><b>${fmt(kr)}${PARA()}</b></div>`+
    (S.kolay?`<div class="kolay">${ic('kumsaati')}<span>${t('easier')}</span></div>`:'')+`</div><div class="kol"><p>${t('dayP')}</p>`+
    (yeni.length?`<div class="newing"><span class="ims">${yeni.slice(-3).map(k=>`<span class="im">${BURGER.simge(k)}</span>`).join('')}</span><span>${t('yeniMal',yeni.length)}<br>${yeni.map(k=>t('ing')[k]).join(', ')}</span></div>`:'')+
    `</div><div class="btns"><button class="btn" id="go">${ic('oynat')}${t('start')}</button></div>`,'iki basi');
  $('go').onclick=()=>{ses('tik');go()}}
// can biterse kısa bir an sonra kaybedilir; müşteriler bitince kazanılır. Sonuç hemen kaydedilir, kart gecikir.
function kontrol(){if(!S.on||S.bitis)return;
  if(S.can<=0){bitisBaslat(false,800);return}
  if(S.kalan<=0&&!S.cust.some(Boolean))bitisBaslat(true,1300)}
function bitisBaslat(win,ms){S.bitis=true;rehberGizle();surukleIptal();kaydet(win);S.bitisT=zaman(()=>{S.bitisT=0;sonKart(win)},ms)}
function kaydet(win){const st=Math.max(win?1:0,Math.min(3,3-S.kacan-S.yanlis));S.yildiz=st;
  // gün sonu (kazanılsın ya da kaybedilsin): kira düşer, eksi gün sayılır, 3 gün eksi → dükkân kapanır (kasa 50, malzemeler kalır)
  const gs=VERI.gunSonu?VERI.gunSonu(S.kasa,S.gun,SAVE.eksi):{kasa:Math.max(0,S.kasa),kira:0,eksiGun:0,kapandi:false};
  S.kira=gs.kira|0;S.kapandi=!!gs.kapandi;SAVE.coins=gs.kasa|0;SAVE.eksi=gs.eksiGun|0;
  // kolaylık: aynı gün art arda kayıpta sonraki deneme daha sabırlı; kazanınca sıfır
  if(win)SAVE.kolay={g:0,n:0};else SAVE.kolay=SAVE.kolay.g===S.gun?{g:S.gun,n:Math.min(3,SAVE.kolay.n+1)}:{g:S.gun,n:1};
  if(win){SAVE.stars[S.gun]=Math.max(SAVE.stars[S.gun]||0,st);if(S.gun===1&&!SAVE.seen.includes('tut'))SAVE.seen.push('tut');SAVE.day=Math.max(SAVE.day,S.gun+1)}
  save()}
function bitir(win){if(!S.on)return;if(!S.bitis){S.bitis=true;rehberGizle();surukleIptal();kaydet(win)}clearTimeout(S.bitisT);S.bitisT=0;sonKart(win)}
function sonKart(win){S.on=false;S.bitis=false;rehberGizle();FX.querySelectorAll('.hayalet,.golge').forEach(e=>e.remove());document.querySelectorAll('#ic .tasiniyor').forEach(x=>x.classList.remove('tasiniyor'));
  ses(win?'gun_bitti':'gun_kayip');
  const st=S.yildiz|0,net=S.gelir+S.bahsis-S.gider-S.kira,G=120,adim=[S.gelir,S.bahsis,-S.gider,-S.kira];
  const n=(v,i)=>`<b class="${v<0?'neg':v>0?'pos':''}" data-v="${v}" data-i="${i}">${v>0?'+':v<0?'−':''}0${PARA()}</b>`;
  const t0=win?.25+3*.3:.3;   // satırlar yıldızlardan sonra
  const sat=(ad,v,i,cls='',ik='')=>`<div class="r${cls}" style="--g:${(t0+i*G/1000).toFixed(2)}s"><span>${ik?ic(ik):''}${t(ad)}</span>${n(v,i)}</div>`;
  const ek=S.kapandi?'':SAVE.eksi>0?`<div class="eksi">${ic('kira')}<span>${t('eksiUyari',SAVE.eksi,VERI.KAPANIS_GUN||3)}</span></div>`:'';
  card(`<h2>${t(win?'winT':'failT')}</h2><div class="kol orta">`+(win?`<div class="stars">${[1,2,3].map(i=>`<span class="${i<=st?'dolu':'bos'}" style="--g:${(.25+(i-1)*.3).toFixed(2)}s">${ic(i<=st?'yildiz':'yildiz_bos')}</span>`).join('')}</div>`:`<p>${t('failP')}<br><small>${t('easierNext')}</small></p>`)+
    `<div class="yuzler" style="--g:${(t0+5*G/1000).toFixed(2)}s"><span title="${SAVE.lang==='tr'?'Mutlu':'Happy'}">${ic('gulen')}${S.sayi.mutlu}</span><span>${ic('somurtkan')}${S.sayi.somurtkan}</span><span>${ic('kizgin')}${S.sayi.kizgin}</span></div>`+
    `<div class="info"><span class="${!S.kapandi&&SAVE.coins<0?'neg':''}">${t('kasa')}: ${PARA()}${fmt(S.kapandi?S.kasa-S.kira:SAVE.coins)}</span></div>`+ek+`</div>`+
    `<div class="kol"><div class="tablo">${sat('gelir',adim[0],0)}${sat('bahsis',adim[1],1)}${sat('gider',adim[2],2)}${sat('kira',adim[3],3,' kira','kira')}${sat('net',net,4,' net')}</div></div>`+
    `<div class="btns yan"><button class="btn" id="nx">${ic(win?'ileri':'tekrar')}${t(win?'next':'retry')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`,'son iki');
  $('card').style.setProperty('--bg',(t0+6*G/1000).toFixed(2)+'s');
  // yıldız sesleri (artan perde: ses modülünde 'yildiz:1..3' varsa o, yoksa 'pisti')
  if(win)for(let i=1;i<=st;i++)setTimeout(()=>{if(!$('ov').hidden&&$('card').classList.contains('son'))ses(sesVar('yildiz:'+i)?'yildiz:'+i:'pisti')},(.25+(i-1)*.3+.35)*1000);
  // sayılar 0'dan sayar (net en son)
  $('card').querySelectorAll('.tablo b').forEach(b=>{const v=+b.dataset.v,i=+b.dataset.i,ilk=(t0+i*G/1000+.15)*1000;
    const yaz=x=>{b.innerHTML=`${x>0?'+':x<0?'−':''}${fmt(Math.abs(x))}${PARA()}`};
    setTimeout(()=>{const s0=performance.now(),sure=Math.min(700,250+Math.abs(v)*6);let son=0;
      const f=now=>{if(!b.isConnected)return;const u=Math.min(1,(now-s0)/sure),x=Math.round(v*(1-Math.pow(1-u,2)));yaz(x);
        if(x!==son&&now-(f.t||0)>70){f.t=now;ses('tik')}son=x;if(u<1)requestAnimationFrame(f)};requestAnimationFrame(f)},ilk)});
  if(win)setTimeout(()=>{if(!$('ov').hidden)konfeti()},(t0+.2)*1000);
  // dükkân kapandıysa önce kapanış kartı, sonra seçilen yere
  const sonra=fn=>()=>{ses('tik');if(S.kapandi){S.kapandi=false;kapanisKart(fn)}else fn()};
  $('nx').onclick=sonra(()=>startDay(win?S.gun+1:S.gun));$('hm').onclick=sonra(openHome)}
// "Dükkân kapandı": kepengi inmiş dükkân, kasa 50'ye döner, malzemeler kalır
const KEPENK='<svg viewBox="0 0 160 150" aria-hidden="true"><rect x="8" y="22" width="144" height="124" rx="5" fill="#e2774f" stroke="#2a1a10" stroke-width="5"/>'+
  [0,1,2,3,4,5,6,7].map(i=>`<rect x="${4+i*19}" y="6" width="19" height="22" fill="${i%2?'#a96a68':'#ad0000'}"/>`).join('')+
  '<rect x="4" y="6" width="152" height="22" rx="3" fill="none" stroke="#2a1a10" stroke-width="5"/>'+[0,1,2,3,4,5,6,7].map(i=>`<path d="M${4+i*19} 28a9.5 9 0 0 0 19 0" fill="#6e0505" stroke="#2a1a10" stroke-width="3"/>`).join('')+
  '<rect x="24" y="46" width="112" height="96" fill="#c3ccd6" stroke="#2a1a10" stroke-width="4"/>'+[56,66,76,86,96,106,116,126].map(y=>`<path d="M26 ${y}h108" stroke="#7d8794" stroke-width="3"/>`).join('')+
  '<rect x="24" y="130" width="112" height="12" fill="#8d97a3" stroke="#2a1a10" stroke-width="4"/>'+
  '<path d="M73 118v-6a7 7 0 0 1 14 0v6" fill="none" stroke="#2a1a10" stroke-width="4"/><rect x="68" y="116" width="24" height="17" rx="4" fill="#ffc21a" stroke="#2a1a10" stroke-width="3.5"/><circle cx="80" cy="124" r="2.6" fill="#2a1a10"/>'+
  '<g class="sal" style="transform-box:fill-box"><circle cx="80" cy="38" r="3.4" fill="#2a1a10"/><path d="M80 38L58 58M80 38l22 20" stroke="#2a1a10" stroke-width="3"/>'+
  '<rect x="48" y="56" width="64" height="32" rx="6" fill="#fff4dc" stroke="#2a1a10" stroke-width="4"/><path d="M70 63l20 18M90 63L70 81" stroke="#d2281e" stroke-width="6" stroke-linecap="round"/></g></svg>';
function kapanisKart(sonra){
  card(`<div class="kol orta kepenk">${KEPENK}</div><div class="kol"><h2>${t('closedT')}</h2><p>${t('closedP',VERI.KAPANIS_GUN||3)}</p><div class="info"><span>${t('kasa')}: ${PARA()}${fmt(SAVE.coins)}</span></div>`+
    `<div class="btns"><button class="btn" id="kpD">${ic('ileri')}${t('devam')}</button></div></div>`,'kapanis iki');
  ses('gun_kayip');tit('ag');$('kpD').onclick=()=>{ses('tik');sonra()}}
function konfeti(){const k=document.createElement('div');k.className='konfeti';const R=['#ff5b4f','#ffc21a','#37c25a','#4fb3ff','#ff8ad8','#fff'];let h='';
  for(let i=0;i<46;i++){const sk=i%5===0,x=Math.random()*100,du=1.8+Math.random()*1.6,de=Math.random()*.7;
    h+=`<i class="${sk?'sk':''}" style="left:${x}%;${sk?'':`background:${R[i%R.length]};`}--dx:${((Math.random()-.5)*3).toFixed(2)}rem;--r:${Math.round(360+Math.random()*540)*(Math.random()<.5?-1:1)}deg;animation-duration:${du.toFixed(2)}s;animation-delay:${de.toFixed(2)}s">${sk?PARA():''}</i>`}
  k.innerHTML=h;$('ov').appendChild(k);setTimeout(()=>k.remove(),4000)}
function card(html,cls=''){$('ov').querySelectorAll('.konfeti').forEach(e=>e.remove());const c=$('card');c.className='card'+(cls?' '+cls:'');c.style.removeProperty('--bg');c.style.zoom='';c.innerHTML=html;$('ov').hidden=false;kartSigdir()}
// kart ekrandan uzunsa (kısa/yatık ekran) orantılı küçülür; yine de sığmazsa katman kaydırılır
function kartSigdir(){const c=$('card'),ov=$('ov');if(ov.hidden)return;c.style.zoom='';const cs=getComputedStyle(ov);
  const H=ov.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom),h=c.offsetHeight;if(h>H)c.style.zoom=Math.max(.7,H/h).toFixed(3)}
function duraklat(){if(!S.on||S.paused||S.bitis)return;S.paused=true;rehberGizle();surukleIptal();
  const tgl=(id,on,ikon,ad)=>`<button class="tg${on?'':' kapali'}" id="${id}" aria-pressed="${on}"><span class="ti">${ic(ikon)}</span><span class="d">${t(ad)}<small>${t(on?'on':'off')}</small></span></button>`;
  const kart=()=>{card(`<h2>${t('pauseT')}</h2><div class="ayarlar">${tgl('pE',SAVE.ayar.efekt,SAVE.ayar.efekt?'ses_acik':'ses_kapali','fx')}${tgl('pM',SAVE.ayar.muzik,'muzik','music')}</div>`+
    `<div class="btns yan"><button class="btn" id="rs">${ic('oynat')}${t('resume')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`,'dur');
    $('pE').onclick=()=>{SAVE.ayar.efekt=!SAVE.ayar.efekt;sesAyar();sesBtn();kart();ses('tik')};$('pM').onclick=()=>{SAVE.ayar.muzik=!SAVE.ayar.muzik;sesAyar();sesBtn();kart();ses('tik')};
    $('rs').onclick=()=>{ses('tik');S.paused=false;$('ov').hidden=true;donguBasla();rehber(true)};
    // gün yarıda bırakılırsa o güne kadar harcanan para gider, kazanç sayılmaz (gün tekrar oynanır)
    $('hm').onclick=()=>{ses('tik');SAVE.coins=Math.min(S.kasa,S.kasa0-S.gider);save();S.on=false;openHome()}};
  kart()}
$('durBtn').onclick=()=>{ses('tik');duraklat()};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(S.on&&!S.paused)duraklat();try{SES.muzik(false)}catch(e){}}else if(sesAcik&&SAVE.ayar.muzik){try{SES.muzik(true)}catch(e){}}});

/* ================= döngü ================= */
// tek döngü: her başlatma eskisini geçersiz kılar (iki döngü aynı anda koşmaz)
let last=0,loopNo=0;
function donguBasla(){const no=++loopNo;last=performance.now();
  const f=now=>{if(no!==loopNo||!S.on||S.paused)return;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;adim(dt);requestAnimationFrame(f)};requestAnimationFrame(f)}
function adim(dt){S.now+=dt;if(S.bitis){izgaraAdim(dt);fritozAdim(dt);return}const n=S.cust.filter(Boolean).length;
  if(S.kalan>0&&!S.bitis){
    if(S.rehber&&n>0){S.nextAt=Math.max(S.nextAt,S.now+1.5)}   // rehberde ilk müşteri bitmeden kimse gelmez
    else if(S.now>=S.nextAt){if(spawn()){const [a,b]=S.cfg.aralik;S.nextAt=S.now+a+Math.random()*(b-a);rehber()}else S.nextAt=S.now+.4}
    if(!n&&S.nextAt-S.now>1.2)S.nextAt=S.now+1.2}   // tezgâh boşsa bekletme
  custAdim(dt);izgaraAdim(dt);fritozAdim(dt)}

/* ================= ana ekran ================= */
const UPI={cook:'ates',pat:'kumsaati',tip:'kese',slot:'izgara'};
function heroFaces(){if(!WHO.length||!window.Musteri)return;const a=WHO[Math.floor(Math.random()*WHO.length)];let b;do{b=WHO[Math.floor(Math.random()*WHO.length)]}while(b===a&&WHO.length>1);
  $('heroA1').innerHTML=Musteri.draw(a.m,'happy');$('heroA2').innerHTML=Musteri.draw(b.m,'love')}
// ana menü burgeri: kahraman alanına sığacak boyda (kısa ekranda logoya binmesin)
function heroCiz(){const c=cq()||3.9,h=$('heroB').closest('.hero').clientHeight||40*c;const ym=Math.max(14*c,Math.min(34*c,h-15*c));
  $('heroB').innerHTML=BURGER.yigin(['bunBot','patty','cheese','lettuce','tomato','bunTop'],{gen:Math.round(Math.min(40*c,ym*1.3)),yukMax:Math.round(ym),yeni:false})}
function openHome(){yeniOturum();S.on=false;S.paused=false;S.bitis=false;rehberGizle();FX.innerHTML='';heroFaces();$('ov').hidden=true;$('shop').hidden=true;APP.classList.remove('dukkanda');$('home').hidden=false;document.documentElement.lang=SAVE.lang;
  $('playBtn').innerHTML=ic('oynat')+(SAVE.day>1?t('cont',SAVE.day):t('play'));$('logo2').textContent=t('logo2');
  $('langBtn').innerHTML=ic('dil')+`<span class="${SAVE.lang==='tr'?'on':''}">TR</span><span class="${SAVE.lang==='en'?'on':''}">EN</span>`;$('langBtn').setAttribute('aria-label',t('lang'));$('credit').textContent=t('credit');
  $('hKasa').textContent=fmt(SAVE.coins);$('hKasaI').innerHTML=PARA();$('hKasaC').classList.toggle('neg',SAVE.coins<0);
  $('hEfekt').innerHTML=ic(SAVE.ayar.efekt?'ses_acik':'ses_kapali');$('hEfekt').classList.toggle('kapali',!SAVE.ayar.efekt);$('hEfekt').setAttribute('aria-label',t('fx'));
  $('hMuzik').innerHTML=ic('muzik');$('hMuzik').classList.toggle('kapali',!SAVE.ayar.muzik);$('hMuzik').setAttribute('aria-label',t('music'));
  const n=alinabilir();
  $('shopBtn').innerHTML=`<span class="si">${ic('dukkan')}</span><span class="st"><b>${t('shop')}</b><small>${t('shopSub')}</small></span>`+(n?`<span class="rz" aria-hidden="true">${n}</span>`:'');
  $('shopBtn').classList.toggle('var',!!n);$('shopBtn').setAttribute('aria-label',t('shop')+(n?' ('+n+')':''));
  cevirYaz();
  heroCiz()}

/* ================= dükkân (tedarikçi) ================= */
// İki sekme: Malzemeler (SATIN_SIRA sırasıyla, yalnız sıradaki alınır) ve Geliştirmeler (ana menüden buraya taşındı:
// para harcanan tek yer dükkân). Eksi kasayla hiçbir şey alınmaz (VERI.alabilir).
const alabilir=f=>VERI.alabilir?VERI.alabilir(SAVE.coins,f):SAVE.coins>=f;
const siradaki=()=>VERI.siradaki?VERI.siradaki(SAVE.mal):null;
function upDurum(k){const u=VERI.GELISTIR[k],l=SAVE.up[k]|0;return {u,l,mx:l>=u.max,c:u.cost(l),kilit:k==='slot'&&SAVE.day<4}}
// geliştirme açıklaması: geniş ızgara bir sonraki açılacak gözü söyler ("4. ızgara gözü")
function upAciklama(k,l,mx){const a=t('up')[k];if(k!=='slot')return a[1];return mx?a[2]:a[1](acikGoz()+1)}
// ana menü rozeti: şu an alınabilecek şeylerin sayısı
function alinabilir(){let n=0;const s=siradaki();if(s&&alabilir(fiyatAc(s)))n++;
  ['cook','pat','tip','slot'].forEach(k=>{const d=upDurum(k);if(!d.mx&&!d.kilit&&alabilir(d.c))n++});return n}
const SH={tab:'mal',mesgul:false};
function openShop(tab){if(tab)SH.tab=tab;SH.mesgul=false;$('shop').hidden=false;APP.classList.add('dukkanda');FX.innerHTML='';
  $('shT').textContent=t('shop');$('shBack').innerHTML=ic('ev');$('shBack').setAttribute('aria-label',t('home'));
  $('shKasaI').innerHTML=PARA();shopKasa(SAVE.coins);
  document.querySelectorAll('#shop .sh-tabs button').forEach(b=>{const on=b.dataset.tab===SH.tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);
    b.innerHTML=(b.dataset.tab==='mal'?`<span class="ti">${BURGER.simge('cheese')}</span>`:`<span class="ti">${ic('ates')}</span>`)+t(b.dataset.tab==='mal'?'tabIng':'tabUp')});
  const u=$('shUyari');u.hidden=SAVE.coins>=0;u.innerHTML=ic('kira')+`<span>${t('negShop')}</span>`;
  shopListe();$('shList').scrollTop=0;shopFit(cq())}
let shKasaGor=0,shRAF=0;
function shopKasa(v,sure){cancelAnimationFrame(shRAF);const yaz=x=>{$('shKasa').textContent=fmt(x);$('shKasaC').classList.toggle('neg',x<0)};
  if(!sure){shKasaGor=v;yaz(v);return}const a=shKasaGor,t0=performance.now();
  const f=now=>{const u=Math.min(1,(now-t0)/sure),e=1-Math.pow(1-u,3);shKasaGor=Math.round(a+(v-a)*e);yaz(shKasaGor);if(u<1)shRAF=requestAnimationFrame(f)};shRAF=requestAnimationFrame(f)}
function shopListe(){const L=$('shList'),y=L.scrollTop;$('shTepsi').hidden=SH.tab!=='mal';
  if(SH.tab==='mal'){const sr=siradaki(),sahip=ACIK();
    L.innerHTML=(sr?'':`<div class="sh-hepsi">${ic('yildiz')}<span>${t('allOwned')}</span></div>`)+(VERI.SATIN_SIRA||[]).map((k,i)=>{const m=VERI.MALZEME.find(x=>x.k===k)||{},f=fiyatAc(k);
      const durum=sahip.includes(k)?'var':k===sr?'sira':'kilit',ok=durum==='sira'&&alabilir(f);
      let sag;
      if(durum==='var')sag=`<span class="mdur var">${ic('tik')}${t('owned')}</span>`;
      else if(durum==='sira')sag=`<button class="mb${ok?'':' yok'}" data-al="${k}" aria-label="${t('buy')} ${t('ing')[k]} ${f}"><span class="mf">${PARA()}${fmt(f)}</span><small>${ok?t('buy'):SAVE.coins<0?t('negKisa'):t('need',fmt(f-Math.max(0,SAVE.coins)))}</small></button>`;
      else sag=`<span class="mdur kilit">${ic('kilit')}<span>${PARA()}${fmt(f)}</span></span>`;
      return `<div class="mk ${durum}${ok?' ok':''}" data-k="${k}"><span class="no">${i+1}</span><span class="mi">${BURGER.simge(k)}</span>`+
        `<span class="mt"><b>${t('ing')[k]}<i class="tur ${yanMi(k)?'yan':''}">${t(yanMi(k)?'sideTag':'layerTag')}</i></b><small class="ek">+${m.satis|0}${PARA()} ${t('adds')}</small><small>${durum==='kilit'?t('locked'):t('porsiyon',m.maliyet|0)}</small></span>${sag}</div>`}).join('');
    // mutfağın: sahip olunanlar renkli (yan ürünler sarı çerçeveli)
    $('shTepsi').innerHTML=`<div class="tt">${t('trayT')} <b>${sahip.length}/${ANAHTAR().length}</b></div><div class="tk">${ANAHTAR().map(k=>`<span class="${sahip.includes(k)?'on':''}${yanMi(k)?' yan':''}" data-k="${k}" title="${t('ing')[k]||k}">${BURGER.simge(k)}</span>`).join('')}</div>`;
    L.querySelectorAll('[data-al]').forEach(b=>b.onclick=()=>malAl(b.dataset.al,b))}
  else{const G=VERI.GELISTIR;
    L.innerHTML=`<div class="ups">`+['cook','pat','tip','slot'].map(k=>{const {u,l,mx,c,kilit}=upDurum(k);
      return `<button class="up ${kilit?'kilit':mx?'max':!alabilir(c)?'no':''}" data-u="${k}" aria-label="${t('up')[k][0]}"><span class="e">${ic(UPI[k])}</span><b>${t('up')[k][0]}</b><small>${upAciklama(k,l,mx)}</small>`+
        `<span class="pips">${Array.from({length:u.max},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')}</span>`+
        `<span class="c">${kilit?ic('kilit')+t('lockDay',4):mx?t('max'):PARA()+fmt(c)}</span></button>`}).join('')+`</div>`;
    L.querySelectorAll('.up').forEach(b=>b.onclick=()=>upAl(b.dataset.u,b))}
  L.scrollTop=y}
function reddet(el){ses('uyari');tit();el.classList.remove('red');void el.offsetWidth;el.classList.add('red')}
function malAl(k,btn){if(SH.mesgul)return false;const f=fiyatAc(k);
  if(k!==siradaki()||!alabilir(f)){if(btn)reddet(btn);if(SAVE.coins<0&&btn)uyari(btn,t('negShop').split(':')[0]);return false}
  SH.mesgul=true;SAVE.coins-=f;SAVE.mal=(VERI.SATIN_SIRA||[]).filter(x=>x===k||SAVE.mal.includes(x));if(!SAVE.yeni.includes(k))SAVE.yeni.push(k);save();
  ses('satin');tit('orta');
  const kart=$('shList').querySelector(`.mk[data-k="${k}"]`),kr=kart?rel(kart):{cx:APP.clientWidth/2,cy:APP.clientHeight/2,x:0,y:0,w:0,h:0};
  if(kart){kart.classList.add('aldi');const b=kart.querySelector('.mb');if(b)b.outerHTML=`<span class="mdur var">${ic('tik')}${t('owned')}</span>`}
  // sikkeler kasadan karta akar, kasa sayısı geri sayar
  const kc=rel($('shKasaI'));const n=Math.max(5,Math.min(9,3+Math.round(Math.log10(f+1)*1.5)));
  for(let i=0;i<n;i++)setTimeout(()=>{ucur(PARA(),{x:kc.cx,y:kc.cy},{x:kr.x+kr.w*.78+(Math.random()-.5)*8*cq(),y:kr.cy+(Math.random()-.5)*3*cq()},{sure:420,yay:-6-Math.random()*5,s0:.8,s1:.6,don:180,cls:'sikke',easing:'cubic-bezier(.4,0,.7,1)'}).then(()=>ses('tik'))},i*55);
  shopKasa(SAVE.coins,n*55+400);
  // malzeme karttan tepsideki yerine uçar
  setTimeout(()=>{const hedef=$('shTepsi').querySelector(`[data-k="${k}"]`),mi=kart&&kart.querySelector('.mi');
    const fr=mi?rel(mi):kr,to=hedef?rel(hedef):{cx:APP.clientWidth/2,cy:APP.clientHeight-10*cq()};
    if(kart)sac(fr.cx,fr.cy,RENK[k]||['#ffc21a'],8,{yay:9,yuk:-2,cls:'yildizcik',sure:650});
    ucur(`<div class="mal">${BURGER.simge(k)}</div>`,{x:fr.cx,y:fr.cy},{x:to.cx,y:to.cy},{sure:620,yay:-16,s0:1.25,s1:.8,don:360,cls:'mal'}).then(()=>{
      if(hedef){hedef.classList.add('on','gel');}ses('birak:'+k);
      const tt=$('shTepsi').querySelector('.tt b');if(tt)tt.textContent=ACIK().length+'/'+ANAHTAR().length;
      const r=hedef?rel(hedef):to;yazi(r.cx,r.y-2*cq(),t('bought'),'iyi kucuk');
      setTimeout(()=>{SH.mesgul=false;if(!$('shop').hidden)shopListe()},650)})},Math.min(700,n*55+250));
  return true}
function upAl(k,btn){if(SH.mesgul)return false;const {u,l,mx,c,kilit}=upDurum(k);
  if(kilit||mx||!alabilir(c)){if(btn)reddet(btn);return false}
  SAVE.coins-=c;SAVE.up[k]=l+1;save();ses('satin');tit('orta');shopKasa(SAVE.coins,500);shopListe();
  const nb=$('shList').querySelector(`[data-u="${k}"]`);if(nb){nb.classList.add('aldi');const r=rel(nb);sac(r.cx,r.cy,[0],8,{yay:9,yuk:-2,cls:'yildizcik',sure:650})}return true}
$('shBack').onclick=()=>{ses('tik');openHome()};
document.querySelectorAll('#shop .sh-tabs button').forEach(b=>b.onclick=()=>{if(SH.mesgul||SH.tab===b.dataset.tab)return;ses('tik');SH.tab=b.dataset.tab;openShop()});
$('shopBtn').onclick=()=>{ses('tik');openShop('mal')};

$('playBtn').onclick=()=>{ses('tik');startDay(SAVE.day)};
$('langBtn').onclick=()=>{SAVE.lang=SAVE.lang==='tr'?'en':'tr';save();ses('tik');openHome()};
$('hEfekt').onclick=()=>{SAVE.ayar.efekt=!SAVE.ayar.efekt;sesAyar();ses('tik');openHome()};
$('hMuzik').onclick=()=>{SAVE.ayar.muzik=!SAVE.ayar.muzik;sesAyar();ses('tik');openHome()};

/* ================= ekran uyumu (yatay): müşteri penceresi + mutfak ================= */
// İki düzen, hangisinde sahne büyükse o (ölçek s = px / sahne birimi):
//  'sol': solda dar müşteri sütunu (sipariş penceresi, 3 müşteri alt alta), sağda sahne; üst bilgi sahnenin duvarının üstünde.
//         Telefonlar (19,5:9). Sahne genişliğe göre ölçeklenir; artan yükseklik duvarın yukarı uzamasıyla dolar.
//  'ust': üstte müşteri şeridi (üst bilgi + 3 müşteri yan yana), altında sahnenin tamamı; iPad ve bilgisayar (4:3 … 16:10).
//         Artan genişlik duvar ve tezgâhın yanlara uzamasıyla dolar. Böylece hiçbir boyda boş kenar kalmaz.
// Sahnenin 0..1600 × 185..900 bölümü (oyun alanı) her zaman görünür; duvarın üstü süs, kırpılabilir/uzar.
const OLC={gen:'3rem',yuk:'2.4rem'};
const LAY={mod:'',s:0,vb:'',ox:0,oy:0};
const pd=(el,a,b)=>{const s=getComputedStyle(el);return parseFloat(s[a])+parseFloat(s[b])};
function guvenli(){const g=$('guv'),s=getComputedStyle(g);return {l:parseFloat(s.paddingLeft)||0,r:parseFloat(s.paddingRight)||0,t:parseFloat(s.paddingTop)||0,b:parseFloat(s.paddingBottom)||0}}
function yerlesim(){const W=APP.clientWidth,H=APP.clientHeight,g=guvenli(),hudH=$('hud').offsetHeight||40,Wa=W-g.l-g.r;
  // sol düzen
  const Cmin=Math.max(116,Math.min(220,H*.36)),Cmax=Math.max(Cmin,Wa*.34);
  let C=Math.max(Cmin,Math.min(Cmax,Wa-1600*(H-g.t-hudH)/900));
  let sS=Math.min((Wa-C)/1600,(H-g.t-hudH)/715);
  if(1600*sS<Wa-C)C=Math.min(Cmax,Wa-1600*sS);   // sahne yüksekliğe takıldıysa artan genişlik sütuna
  // üst düzen: şerit = güvenli üst + üst bilgi + müşteriler (en az 96 px); sahnenin duvarına en çok 120 birim biner
  const custMin=Math.max(96,H*.2);
  const sU=Math.min(Wa/1600,(H-g.t-hudH-custMin)/780);
  // 4:3'e yakın ekranlarda (iPad) üst şerit; daha yatıklarda (telefon, 16:10 bilgisayar) sol sütun: duvar, lambalar, neon görünür kalır
  const mod=W/H<1.45&&sU>sS?'ust':'sol',s=mod==='ust'?sU:sS;
  let ox,oy,pen;   // ox, oy: sahne başlangıcının (0,0) ekrandaki yeri; pen: müşteri penceresi kutusu
  // sahnenin alt kenarı (870. birim, tahtanın altı) güvenli alanın üstünde: sahne o kadar yukarı kayar, tezgâh aşağı uzar
  // (üst bilgi oyun alanına, 185. birimin altına inmesin)
  const oyAyar=(s,ust)=>Math.min(H-900*s,Math.max(ust-185*s,H-g.b-870*s));
  if(mod==='sol'){ox=g.l+C;oy=oyAyar(s,g.t+hudH);pen={x:0,y:0,w:g.l+C,h:H}}
  else{ox=g.l+(Wa-1600*s)/2;oy=oyAyar(s,0);const band=Math.max(g.t+hudH+custMin,oy);pen={x:0,y:0,w:W,h:band}}
  return {mod,s,ox,oy,pen,W,H,g,hudH,C}}
let sahneAnahtar='';
function sahneCiz(L){const ust=L.mod==='ust'?L.pen.h:0;
  // görünür alan: mutfak kutusu (sol düzende sütunun sağı, üst düzende tüm genişlik) sahne birimiyle
  const mx=L.mod==='sol'?L.ox:0,mw=L.W-mx;
  const vb={x:Math.round((mx-L.ox)/L.s),y:Math.floor(-L.oy/L.s),w:Math.ceil(mw/L.s)+1,h:Math.ceil(L.H/L.s)+1};
  MUT.style.left=mx+'px';MUT.style.width=mw+'px';
  IC_.style.left=(L.ox-mx)+'px';IC_.style.top=L.oy+'px';IC_.style.width=1600*L.s+'px';IC_.style.height=900*L.s+'px';
  const ana=vb.x+','+vb.y+','+vb.w+','+vb.h;if(ana===sahneAnahtar)return;sahneAnahtar=ana;
  // aynı oturumda eski sahne görüntüleri bırakılır
  ['sahne0','sahne1'].forEach(k=>{const u=IMG.get(k);if(u&&u.startsWith('blob:'))try{URL.revokeObjectURL(u)}catch(e){}IMG.delete(k)});
  $('mtGun').src=imgUrl('sahne0',()=>MT.ciz({aksam:0,vb}));$('mtAk').src=imgUrl('sahne1',()=>MT.ciz({aksam:1,vb}));
  const pw=vb.w*L.s,ph=vb.h*L.s;
  [$('mtGun'),$('mtAk')].forEach(i=>{i.style.left=(L.ox-mx+vb.x*L.s)+'px';i.style.top=(L.oy+vb.y*L.s)+'px';i.style.width=pw+'px';i.style.height=ph+'px'})}
// günün ikinci yarısı akşam (yumuşak geçiş): akşam katmanının saydamlığı
function aksamGuncelle(hemen){const f=S.cfg?Math.max(0,Math.min(1,S.bitti/Math.max(1,S.cfg.musteri))):0;
  const a=Math.max(0,Math.min(1,(f-.4)/.5)),v=a*a*(3-2*a);[$('mtAk'),$('penAk')].forEach(el=>{if(hemen)el.style.transition='none';el.style.opacity=v.toFixed(3);if(hemen){void el.offsetWidth;el.style.transition=''}})}
// müşteri: yüz + baloncuk (sipariş simgeleri + sabır). Yerine iki biçimden hangisi sığarsa: 'yan' (yüz solda, baloncuk sağda) ya da
// 'alt' (baloncuk üstte, yüz altında). Simge hücresi en büyük olan seçilir (en çok 11 birim).
const SUTUN=n=>n<=3?n:n===4?2:n<=6?3:4;
const grupSay=c=>BURGER.grupla?BURGER.grupla(sipKat(c)).length:new Set(sipKat(c).map(k=>k==='bunBot'||k==='bunTop'?'bun':k)).size;
function custFit(c){const sl=c.el.parentNode;if(!sl)return;const u=cq(),W=sl.clientWidth,H=sl.clientHeight-Math.max(4,1.2*u);if(!W||!H)return;
  const n=grupSay(c),yan=sipYan(c).length;
  const krom=Math.max(10,2.8*u),dik=Math.max(18,2.2*u)+Math.max(6,.8*u)+2.4*u,oran=154/128*.86;   // yüzün alt %14ü (omuzlar) pervazın arkasında kalır   // baloncuk iç payı; dikey: dolgu+çerçeve+aralık+sabır
  const cIdeal=Math.max(26,6.5*u),yMax=Math.min(34*u,W*.62);   // simge hücresi bundan büyük olmaz; artan yer yüze
  const yMinYan=Math.max(26,Math.min(W*.34,H*.6/oran)),yMinAlt=Math.max(26,H*.4/oran);
  let en=null;const sec_=[];
  for(const bicim of ['yan','alt'])for(let col=1;col<=Math.min(4,n);col++){const sat=Math.ceil(n/col);
    const T=col+(yan?(sat>=yan?1:yan)+.34:0),hu=Math.max(T,2);let cell,yz;
    if(bicim==='yan'){cell=Math.min((W-yMinYan-1*u-krom)/hu,(H*.96-dik)/sat,cIdeal);yz=Math.min(yMax,W-cell*hu-krom-1*u,H*.9/oran)}
    else{cell=Math.min((W*.96-krom)/hu,(H-yMinAlt*oran-dik-1.6*u)/sat,cIdeal);yz=Math.min(yMax,W*.7,(H-sat*cell-dik-1.6*u)/oran)}
    if(cell<=0||yz<=0)continue;
    sec_.push({bicim,col,sat,cell,hu,yz})}
  // önce sipariş okunsun: en büyük hücrenin %70'inden küçük olanlar elenir; kalanlarda hücre ve yüz birlikte puanlanır (yüz hücrenin 3,2 katından büyükse fazlası sayılmaz)
  const cm=Math.max(0,...sec_.map(x=>x.cell));
  for(const x of sec_)if(x.cell>=cm*.7){const puan=x.cell+.6*Math.min(x.yz,x.cell*3.2);if(!en||puan>en.puan)en=Object.assign(x,{puan})}
  if(!en)en={bicim:'yan',col:SUTUN(n),sat:1,cell:8,hu:3,yz:28};
  const cell=Math.max(8,en.cell),gen=cell*en.hu,yz=Math.max(22,en.yz);
  c.el.classList.toggle('alt',en.bicim==='alt');c.el.classList.toggle('yanli',en.bicim==='yan');
  c.el.style.setProperty('--bw',Math.round(gen+krom)+'px');c.el.style.setProperty('--yz',Math.round(yz)+'px');
  const g=Math.round(gen)+'px',al=alindi(c),an=g+en.col+JSON.stringify(al);
  if(c.gen!==an){c.gen=an;c.el.querySelector('.sip').innerHTML=BURGER.siparis(sipKat(c),{gen:g,yan:sipYan(c),alindi:al,enAzSutun:2,sutun:en.col})}}
// dükkân paneli: mutfağın (sahip olunanlar), 3 sütun
function shopFit(c){const p=$('shTepsi');if($('shop').hidden||p.hidden)return;const tt=p.querySelector('.tt');const n=Math.ceil(ANAHTAR().length/3);
  const H=p.clientHeight-pd(p,'paddingTop','paddingBottom')-(tt?tt.offsetHeight+1.6*c:0);
  APP.style.setProperty('--tkw',Math.max(24,Math.min(12*c,(H-(n-1)*1.2*c)/n)).toFixed(1)+'px')}
function fit(){const c=cq();if(!c)return;const L=yerlesim();Object.assign(LAY,L);
  APP.classList.toggle('ust-duzen',L.mod==='ust');APP.classList.toggle('sol-duzen',L.mod==='sol');
  const P=$('pencere');P.style.left=L.pen.x+'px';P.style.top=L.pen.y+'px';P.style.width=L.pen.w+'px';P.style.height=L.pen.h+'px';
  const hd=$('hud');
  if(L.mod==='sol'){hd.style.left=(L.g.l+L.C)+'px';hd.style.right='0px';P.style.setProperty('--pl',L.g.l+'px');P.style.setProperty('--pt','0px')}
  else{hd.style.left='0px';hd.style.right='0px';P.style.setProperty('--pl',L.g.l+'px');P.style.setProperty('--pt',(L.g.t+L.hudH)+'px')}
  P.style.setProperty('--pr',(L.mod==='ust'?L.g.r:0)+'px');
  sahneCiz(L);APP.style.setProperty('--s',L.s.toFixed(4));
  // tahtadaki burger: genişlik ve en çok yükseklik sahne biriminden
  OLC.gen=Math.round(YIG.gen*L.s*.92)+'px';OLC.yuk=Math.round(YIG.yuk*L.s)+'px';APP.style.setProperty('--gen',OLC.gen);
  MK.yig&&MK.yig.forEach((y,i)=>{if(!y)return;y.setAttribute('style',yuzde(yigYer(i)))});
  if(S.tabak)[0,1].forEach(i=>cizTabak(i,false));
  S.cust.forEach(x=>{if(x){x.gen=null;custFit(x)}});shopFit(c)}
// telefon dik tutulursa "yan çevir" ekranı (CSS) görünür; oyun duraklar
const DIK=window.matchMedia?matchMedia('(orientation: portrait)'):{matches:false};
function cevirYaz(){$('cevirT').textContent=t('cevirT');$('cevirP').textContent=t('cevirP')}
function yonKontrol(){if(DIK.matches&&S.on&&!S.paused&&!S.bitis)duraklat()}
addEventListener('resize',()=>{fit();kartSigdir();if(!$('home').hidden)heroCiz();if(S.on)rehber(true);yonKontrol()});
if(DIK.addEventListener)DIK.addEventListener('change',yonKontrol);
sokakCiz();

/* ================= test kancası ================= */
if(DEBUG)window.__bu={S,SAVE,VERI,startDay,sec,koy,teslim,izgara,bitir,copeAt,adim,openHome,save,EKSIK,
  openShop,malAl,upAl,alinabilir,buildMutfak,fit,fritoz,yanSec,yanVer,yanCope,LAY,MK:()=>MK,aksamGuncelle,hazirCiz,yanCiz,
  basla:()=>{const g=$('go');if(g)g.click()},musteri:()=>S.cust.map(c=>c&&{sip:c.sip,durum:c.durum,f:c.p/c.max,ruh:c.ruh,emo:c.emo})};
// açılış: doğrudan ana menü (açılış hikâyesi kaldırıldı, Eymen 21 Kasım)
openHome();fit();
})();
