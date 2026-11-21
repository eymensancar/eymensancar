/* Burger Ustası: oynanış, arayüz, ekranlar (çekirdek). 7. tur: Eymen'in resmi (docs/referans/mutfak-v3-eymen.png).
   Resmin kendisi arka plan (g/v3/mutfak.webp, kenarları uzatılmış); değişen parçalar resimden kırpılmış ya da yamanmış
   (tools/mutfak-v3/hazirla.py), burger katmanları, tahta, tepsi, patates kutusu resmin biçeminde çizilmiş (tools/burger/uret.mjs). Sahne birimi = resmin pikseli (1852×849);
   #dunya bu birimlerde, tek ölçekle (translate + scale) ekrana oturur (fit).
   Akış (Eymen, 21 Kasım): açık ızgaraya dokun → köfte 8 sn pişer, kendiliğinden köfte haznesine uçar (en çok 6).
   Çiğ patatese 10 dokunuş → kendiliğinden fritöze, 15 sn kızarır, dokununca patates haznesine (4 porsiyon); fritöz doluyken
   doğrama yok. Malzemeye dokun → tezgâhtaki tek burgere konur (önce alt ekmek, en son üst ekmek). Biten burgere dokun → tepsiye
   dokun; patates haznesine dokun → tepsiye dokun; tepsiye dokun → müşteriye dokun (tepsi müşteriye gider).
   Modüller: BU.VERI (ekonomi), BU.SIMGE (simgeler), BU.SES (ses). Müşteriler www/musteri.js + karakterler.js.
   Zamanlayıcılar: her gün/ana menü geçişi S.oturum'u artırır; gecikmeli işler (zaman()) eski oturumdaysa çalışmaz. */
(()=>{'use strict';
const BU=window.BU=window.BU||{};
const $=id=>document.getElementById(id);
const APP=$('app'),FX=$('fx');
const DEBUG=/[?&]debug\b/.test(location.search);
const VERI=BU.VERI,SIMGE=BU.SIMGE||{svg:()=>'<svg class="ic" viewBox="0 0 48 48"></svg>'};
const SES=BU.SES||{ac(){},cal(){},muzik(){},ayar(){},durdur(){},ADLAR:[]};
const M=VERI.MUTFAK;
const ic=(ad,s)=>SIMGE.svg(ad,s);
const PARA=()=>ic('para');

/* ================= metinler ================= */
const T={
 tr:{day:n=>`Gün ${n}`,play:'OYNA',cont:n=>`OYNA · Gün ${n}`,logo2:'USTASI',
  dayT:n=>`Gün ${n}`,dayP:'Herkes aynı şeyi istiyor: turşulu peynirli burger ve patates. Hazırla, tepsiye koy, müşteriye ver.',cust:n=>`${n} müşteri`,start:'Başla',
  winT:'Gün bitti!',failT:'Gün kaybedildi!',failP:'Üç can gitti. Bir daha dene!',next:'Sonraki gün',retry:'Tekrar dene',home:'Ana menü',
  pauseT:'Durakladı',resume:'Devam',fx:'Efekt',music:'Müzik',on:'AÇIK',off:'KAPALI',
  gelir:'Gelir',gider:'Gider',net:'Net kâr',bahsis:'Bahşiş',kasa:'Kasa',
  needBun:'Önce alt ekmek!',done:'Burger hazır: tepsiye koy',dup:'Bu burgerde var',topEarly:'Önce köfte koy',noPatty:'Köfte yok: ızgaraya dokun',
  noFries:'Patates yok: patatesleri doğra',pattyFull:'Köfte haznesi dolu',friesFull:'Patates haznesi dolu',frying:'Patates kızarıyor',fryerBusy:'Fritöz dolu: önce patatesi al',
  fryerEmpty:'Patatese dokun, doğra',lockGrill:'Dükkân\'dan açılır',grillBusy:'Köfte pişiyor',trayFull:'Bu tepside burger var',trayFries:'Bu tepside patates var',
  pickTray:'Önce bir tepsiye dokun',notDone:'Üst ekmekle kapat',emptyTray:'Tepsi boş',
  gone:'Gitti!',wrong:'Yanlış!',tip:'bahşiş',angryPay:'Ödemedi!',gotPart:'alındı',
  g:{bunBot:'Alt ekmeğe dokun',patty:'Köfteye dokun',cheese:'Peynire dokun',pickle:'Turşuya dokun',bunTop:'Üst ekmekle kapat',grill:'Izgaraya dokun: köfte pişir',
   cooking:'Köfte pişiyor…',burger:'Burgere dokun',tray:'Tepsiye dokun',fries:'Patates haznesine dokun',chop:'Patatese 10 kez dokun',
   fryer:'Fritöze dokun: patatesi al',frying:'Patates kızarıyor…',cust:'Müşteriye dokun'},
  up:{cook:['Hızlı ızgara','Köfte 0,5 sn, patates 1 sn daha çabuk'],pat:['Sabırlı müşteri','Daha uzun beklerler'],tip:['Cömert bahşiş','Daha çok bahşiş'],slot:['Izgara',n=>`${n}. ızgaranın kilidi açılır`,'4 ızgara açık']},max:'TAM',
  sound:'Ses',lang:'Dil',pause:'Duraklat',lives:'Can',bin:'B',mil:'M',ondalik:',',
  shop:'Dükkân',shopSub:'Izgara ve geliştirme',grills:'Izgaralar',upgrades:'Geliştirmeler',grillN:n=>`${n}. ızgara`,grillP:'Kilit açılır, aynı anda bir köfte daha pişer',
  owned:'Açık',locked:'Önce öncekini aç',negShop:'Kasa ekside: kasa artıya geçene kadar alışveriş yok.',negKisa:'Kasa ekside',
  kira:'Kira',kiraBugun:'Bugünün kirası',easier:'Müşteriler bugün biraz daha sabırlı',easierNext:'Sonraki denemede müşteriler daha sabırlı olacak.',
  closedT:'Dükkân kapandı!',closedP:n=>`Kasa ${n} gün art arda ekside kaldı. 50 parayla yeniden başlıyorsun (ızgaraların ve geliştirmelerin duruyor).`,devam:'Devam',
  cevirT:'Telefonu yan çevir',cevirP:'Burger Ustası yatay ekranda oynanır. Bilgisayarda pencereyi genişlet.',
  eksiUyari:(n,m)=>`Kasa ekside (${n}/${m} gün). ${m} gün art arda eksi kalırsa dükkân kapanır!`,menu:'Menü',price:n=>`${n} para`},
 en:{day:n=>`Day ${n}`,play:'PLAY',cont:n=>`PLAY · Day ${n}`,logo2:'MASTER',
  dayT:n=>`Day ${n}`,dayP:'Everyone wants the same: a cheeseburger with pickles and fries. Build it, put it on a tray, give it to the customer.',cust:n=>`${n} customers`,start:'Start',
  winT:'Day complete!',failT:'Shop closed!',failP:'You lost three lives. Try again!',next:'Next day',retry:'Try again',home:'Main menu',
  pauseT:'Paused',resume:'Resume',fx:'Sound',music:'Music',on:'ON',off:'OFF',
  gelir:'Income',gider:'Costs',net:'Profit',bahsis:'Tips',kasa:'Cash',
  needBun:'Bottom bun first!',done:'Burger ready: put it on a tray',dup:'Already on the burger',topEarly:'Add a patty first',noPatty:'No patties: tap the grill',
  noFries:'No fries: chop the potatoes',pattyFull:'The patty tray is full',friesFull:'The fries tray is full',frying:'The fries are frying',fryerBusy:'Fryer is full: take the fries first',
  fryerEmpty:'Tap the potatoes to chop',lockGrill:'Unlock it in the Shop',grillBusy:'The patty is cooking',trayFull:'This tray has a burger',trayFries:'This tray has fries',
  pickTray:'Tap a tray first',notDone:'Close it with the top bun',emptyTray:'The tray is empty',
  gone:'Left!',wrong:'Wrong!',tip:'tip',angryPay:'No pay!',gotPart:'got it',
  g:{bunBot:'Tap the bottom bun',patty:'Tap the patties',cheese:'Tap the cheese',pickle:'Tap the pickles',bunTop:'Close it with a top bun',grill:'Tap the grill: cook a patty',
   cooking:'The patty is cooking…',burger:'Tap the burger',tray:'Tap a tray',fries:'Tap the fries',chop:'Tap the potatoes 10 times',
   fryer:'Tap the fryer: take the fries',frying:'The fries are frying…',cust:'Tap the customer'},
  up:{cook:['Fast grill','Patties 0.5 s, fries 1 s quicker'],pat:['Patient customers','They wait longer'],tip:['Big tippers','Bigger tips'],slot:['Grill',n=>`Unlocks grill ${n}`,'All 4 grills open']},max:'MAX',
  sound:'Sound',lang:'Language',pause:'Pause',lives:'Lives',bin:'K',mil:'M',ondalik:'.',
  shop:'Shop',shopSub:'Grills and upgrades',grills:'Grills',upgrades:'Upgrades',grillN:n=>`Grill ${n}`,grillP:'Unlocks it: cook one more patty at a time',
  owned:'Open',locked:'Unlock the previous one first',negShop:'Your cash is below zero: no shopping until it is back above zero.',negKisa:'Cash below zero',
  kira:'Rent',kiraBugun:'Today\'s rent',easier:'Customers are a bit more patient today',easierNext:'Customers will be more patient on the next try.',
  closedT:'Shop closed!',closedP:n=>`Your cash stayed below zero for ${n} days in a row. You start again with 50 coins (you keep your grills and upgrades).`,devam:'Continue',
  cevirT:'Turn your phone sideways',cevirP:'Burger Master is played in landscape. On a computer, make the window wider.',
  eksiUyari:(n,m)=>`Cash below zero (${n}/${m} days). ${m} days in a row below zero and the shop closes!`,menu:'Menu',price:n=>`${n} coins`}};

/* ================= kayıt ================= */
const KEY='burgerustasi.v1';
const cihazDili=()=>(navigator.language||'tr').toLowerCase().startsWith('tr')?'tr':'en';
// coins eksi olabilir; mal = eski dükkânda alınan malzemeler (yeni mutfakta yeri olmayanlar şimdilik kullanılmaz, kayıtta durur);
// eksi = art arda eksi gün; kolay = {g, n} (art arda kayıpta sabır); seen: 'tut3' = yeni mutfak rehberi görüldü
const SAVE=(()=>{let o={},ham=null;try{ham=localStorage.getItem(KEY);o=JSON.parse(ham)||{}}catch(e){}if(!o||typeof o!=='object'||Array.isArray(o))o={};
  const ilk=!ham||!Object.keys(o).length;
  const d={day:1,coins:ilk?(VERI.BASLANGIC|0||50):0,stars:{},up:{cook:0,pat:0,tip:0,slot:0},lang:cihazDili(),seen:[],ayar:{efekt:true,muzik:true},eksi:0,kolay:{g:0,n:0},yeni:[]};
  const s=Object.assign({},d,o);s.up=Object.assign({},d.up,o.up&&typeof o.up==='object'?o.up:{});s.ayar=Object.assign({},d.ayar,o.ayar&&typeof o.ayar==='object'?o.ayar:{});
  if(!Array.isArray(s.seen))s.seen=[];if(!s.stars||typeof s.stars!=='object'||Array.isArray(s.stars))s.stars={};
  // geliştirme düzeyleri 0…max (eski kayıtta slot 3–4 = 4 ızgara açık)
  const G=VERI.GELISTIR||{};['cook','pat','tip','slot'].forEach(k=>{const mx=(G[k]&&G[k].max)|0||4;s.up[k]=Math.max(0,Math.min(mx,Math.floor(+s.up[k]||0)))});
  if(s.lang!=='tr'&&s.lang!=='en')s.lang=cihazDili();s.ayar.efekt=s.ayar.efekt!==false;s.ayar.muzik=s.ayar.muzik!==false;
  s.coins=Math.round(+s.coins||0);s.day=Math.max(1,Math.floor(+s.day||1));
  if(!Array.isArray(s.mal))s.mal=ilk?[]:(VERI.eskiSahip?VERI.eskiSahip(s.day):[]);
  s.eksi=Math.max(0,Math.floor(+s.eksi||0));
  if(!s.kolay||typeof s.kolay!=='object')s.kolay={g:0,n:0};s.kolay={g:s.kolay.g|0,n:Math.max(0,Math.min(3,s.kolay.n|0))};
  if(!Array.isArray(s.yeni))s.yeni=[];return s})();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(SAVE))}catch(e){}};
const t=(k,...a)=>{const v=T[SAVE.lang][k];return typeof v==='function'?v(...a):v};
const tg=(k,...a)=>{const v=T[SAVE.lang].g[k];return typeof v==='function'?v(...a):v};
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
['gesturestart','gesturechange'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));

/* ================= yardımcılar ================= */
const cq=()=>parseFloat(getComputedStyle(document.documentElement).fontSize)/10||APP.clientWidth/190;
function rel(el){const r=el.getBoundingClientRect(),a=APP.getBoundingClientRect();return {x:r.left-a.left,y:r.top-a.top,w:r.width,h:r.height,cx:r.left-a.left+r.width/2,cy:r.top-a.top+r.height/2}}
function zaman(fn,ms){const o=S.oturum;if(!ms){fn();return 0}return setTimeout(()=>{if(o===S.oturum)fn()},ms)}
function fxEl(cls,html,x,y){const d=document.createElement('div');d.className=cls;if(html)d.innerHTML=html;d.style.left=x+'px';d.style.top=y+'px';FX.appendChild(d);return d}
function yazi(x,y,html,cls,gec=0){y=Math.max(y,9*cq());const W=APP.clientWidth;x=Math.min(W-8*cq(),Math.max(8*cq(),x));zaman(()=>{const d=fxEl('yazi '+cls,html,x,y);setTimeout(()=>d.remove(),1500)},gec)}
function uyari(el,msg){FX.querySelectorAll('.uyari').forEach(x=>x.remove());const r=rel(el);const d=document.createElement('div');d.className='uyari';d.textContent=msg;FX.appendChild(d);
  const w=d.offsetWidth,W=APP.clientWidth;d.style.left=Math.min(W-w/2-4,Math.max(w/2+4,r.cx))+'px';d.style.top=Math.max(d.offsetHeight+4,r.y+2*cq())+'px';setTimeout(()=>d.remove(),1350);ses('uyari');tit()}
// ekran (app) koordinatında uçuş (sikke, kalp)
function ucur(html,from,to,{sure=420,yay=-10,s0=1,s1=1,don=0,cls='',easing='cubic-bezier(.35,.1,.45,1)'}={}){
  const d=fxEl('ucan '+cls,html,from.x,from.y);
  const dx=to.x-from.x,dy=to.y-from.y,ay=yay*cq(),tr=(x,y,s,r)=>`translate(-50%,-50%) translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
  d.style.transform=tr(0,0,s0,0);
  return new Promise(res=>{let bitti=false;const son=()=>{if(bitti)return;bitti=true;d.remove();res()};
    try{const a=d.animate([{transform:tr(0,0,s0,0)},{transform:tr(dx*.5,dy*.5+ay,(s0+s1)/2*1.08,don/2),offset:.5},{transform:tr(dx,dy,s1,don)}],{duration:sure,easing,fill:'forwards'});a.onfinish=son}catch(e){}
    setTimeout(son,sure+250)})}
function sac(x,y,renkler,n=5,{yay=7,yuk=5,cls='parca',sure=520}={}){const c=cq();
  for(let i=0;i<n;i++){const d=fxEl(cls,'',x,y);const col=renkler[i%renkler.length];if(cls==='parca')d.style.background=col;
    const a=(-Math.PI/2)+(i-(n-1)/2)*(Math.PI*1.1/n)+(Math.random()-.5)*.4,v=(yay*.6+Math.random()*yay*.6)*c;
    const tx=Math.cos(a)*v,ty=Math.sin(a)*v,s=.6+Math.random()*.6;
    try{d.animate([{transform:`translate(-50%,-50%) translate(0,0) scale(${s})`,opacity:1},{transform:`translate(-50%,-50%) translate(${tx}px,${ty}px) scale(${s})`,opacity:1,offset:.45},{transform:`translate(-50%,-50%) translate(${tx*1.3}px,${ty+yuk*c}px) scale(${s*.5})`,opacity:0}],{duration:sure+Math.random()*160,easing:'ease-out',fill:'forwards'})}catch(e){}
    setTimeout(()=>d.remove(),sure+300)}}
const DUR=[[0,[229,50,43]],[.3,[240,138,36]],[.6,[242,194,48]],[1,[60,196,90]]];
function sabirRenk(f){f=Math.max(0,Math.min(1,f));for(let i=1;i<DUR.length;i++){const [b,cb]=DUR[i],[a,ca]=DUR[i-1];if(f<=b){const u=(f-a)/(b-a);return `rgb(${ca.map((v,j)=>Math.round(v+(cb[j]-v)*u)).join(',')})`}}return 'rgb(60,196,90)'}

/* ================= durum ================= */
const S={on:false,paused:false,gun:1,cfg:null,kasa:0,kasa0:0,gelir:0,gider:0,bahsis:0,sayi:{mutlu:0,somurtkan:0,kizgin:0},kacan:0,yanlis:0,can:3,kalan:0,bitti:0,seri:0,
  kolay:0,kira:0,kapandi:false,cust:[null,null,null],slotT:[0,0,0],now:0,nextAt:0,rehber:false,bitis:false,bitisT:0,oturum:0,yildiz:0,
  // mutfak
  izg:[],hk:0,hkUcan:0,hp:0,dogra:0,fr:{st:0,t:0,kalan:0},burger:[],tepsi:[{b:null,f:false},{b:null,f:false}],sec:null,mesgul:{}};
const WHO=window.KARAKTERLER||[];
function pickWho(){if(!WHO.length)return null;const busy=S.cust.filter(Boolean).map(c=>c.who);let k,n=0;do{k=WHO[Math.floor(Math.random()*WHO.length)];n++}while(busy.includes(k)&&n<20);return k}
// müşteri gölgeli çizilir (index.html #musGolge: sıcak ışık, yumuşak gölge, kontur); yüz ve saç aynı kalır
function golgeli(svg){return svg.replace(/(<svg[^>]*>)/,'$1<g filter="url(#musGolge)">').replace(/<\/svg>\s*$/,'</g></svg>')}
function face(c,e){if(!c.who||!window.Musteri||c.emo===e)return;c.emo=e;c.yuzEl.innerHTML=golgeli(Musteri.draw(c.who.m,e))}

/* ================= üst bilgi ================= */
let kasaGor=0,kasaRAF=0,bekle=0,canGor=3;
function kasaYaz(v){$('kasa').textContent=fmt(v);$('kasaC').classList.toggle('neg',v<0)}
function kasaPop(){const k=$('kasaC');k.classList.remove('pop');void k.offsetWidth;k.classList.add('pop')}
function kasaHedef(v,{sessiz=false,sure=350}={}){cancelAnimationFrame(kasaRAF);
  if(sessiz||v===kasaGor||!S.on){kasaGor=v;kasaYaz(v);return}
  const a=kasaGor,t0=performance.now();kasaPop();
  const f=now=>{const u=Math.min(1,(now-t0)/sure),e=1-Math.pow(1-u,3);kasaGor=Math.round(a+(v-a)*e);kasaYaz(kasaGor);if(u<1)kasaRAF=requestAnimationFrame(f)};kasaRAF=requestAnimationFrame(f)}
function hud(o={}){kasaHedef(S.kasa-bekle,o);
  $('gunT').textContent=t('day',S.gun);$('prog').style.width=(S.cfg?100*S.bitti/S.cfg.musteri:0)+'%';
  const cn=$('canlar');cn.setAttribute('aria-label',t('lives')+' '+canGor);
  if(cn.children.length!==3)cn.innerHTML=[0,1,2].map(()=>'<span></span>').join('');
  [...cn.children].forEach((s,i)=>{const dolu=i<canGor,ad=dolu?'can':'can_bos';if(s.dataset.ad!==ad){if(s.dataset.ad==='can'&&!dolu){s.classList.remove('gitti');void s.offsetWidth;s.classList.add('gitti')}s.dataset.ad=ad;s.innerHTML=ic(ad)}s.classList.toggle('bos',!dolu)})}
function sesBtn(){const on=SAVE.ayar.efekt||SAVE.ayar.muzik;$('sesBtn').innerHTML=ic(on?'ses_acik':'ses_kapali');$('sesBtn').setAttribute('aria-label',t('sound'))}
$('sesBtn').onclick=()=>{const on=SAVE.ayar.efekt||SAVE.ayar.muzik;SAVE.ayar.efekt=SAVE.ayar.muzik=!on;sesAyar();sesBtn();ses('tik')};

/* ================= para efektleri ================= */
function paraYagdir(from,miktar,gec){const o=S.oturum;const n=Math.max(4,Math.min(8,Math.round(miktar/6)+3));bekle+=miktar;let ilk=true;
  zaman(()=>{const k=rel($('kasaI'));
    for(let i=0;i<n;i++)zaman(()=>{const ox=(Math.random()-.5)*6*cq(),oy=(Math.random()-.5)*4*cq();
      ucur(PARA(),{x:from.x+ox,y:from.y+oy},{x:k.cx,y:k.cy},{sure:450,yay:-8-Math.random()*6,s0:1,s1:.7,don:200,cls:'sikke',easing:'cubic-bezier(.5,0,.7,1)'}).then(()=>{
        if(o!==S.oturum)return;if(ilk){ilk=false;bekle=Math.max(0,bekle-miktar);hud({sure:600})}
        ses('tik');const c=$('kasaC');c.classList.add('tik');setTimeout(()=>c.classList.remove('tik'),90)})},i*60)},gec)}
function parilti(x,y,gec){zaman(()=>sac(x,y,[0],8,{yay:9,yuk:-2,cls:'yildizcik',sure:700}),gec)}
function kirikKalp(from,gec){const o=S.oturum;zaman(()=>{const hedefI=Math.max(0,canGor-1),sp=$('canlar').children[hedefI];const to=sp?rel(sp):{cx:APP.clientWidth-30*cq(),cy:8*cq()};
  ucur(ic('can'),from,{x:to.cx,y:to.cy},{sure:520,yay:-12,s0:1.3,s1:.9,cls:'kalp'}).then(()=>{if(o!==S.oturum)return;canGor=Math.max(S.can,canGor-1);hud({sessiz:true});
    const k=fxEl('kirik',`<span class="y1">${ic('can')}</span><span class="y2">${ic('can')}</span>`,to.cx-3.4*cq(),to.cy-3.4*cq());
    try{k.children[0].animate([{transform:'none',opacity:1},{transform:`translate(${-2*cq()}px,${6*cq()}px) rotate(-30deg)`,opacity:0}],{duration:600,easing:'ease-in',fill:'forwards'});
      k.children[1].animate([{transform:'none',opacity:1},{transform:`translate(${2*cq()}px,${6*cq()}px) rotate(30deg)`,opacity:0}],{duration:600,easing:'ease-in',fill:'forwards'})}catch(e){}
    setTimeout(()=>k.remove(),700)})},gec)}
function damga(c,metin,gec){zaman(()=>{const r=rel(c.yuzEl);const d=fxEl('damga',ic('carpi')+`<span>${metin}</span>`,r.cx,r.y+r.h*.35);setTimeout(()=>d.remove(),1400);
  APP.classList.remove('sars');void APP.offsetWidth;APP.classList.add('sars');setTimeout(()=>APP.classList.remove('sars'),260)},gec)}

/* ================= mutfak: resim + parçalar (sahne birimi = resmin pikseli) ================= */
const G='g/v3/';
// parçaların sahnedeki yeri [x, y, w, h] (tools/mutfak-v3/hazirla.py → g/v3/yer.json)
const P={kuvetKofte:[1024,340,188,112],kuvetPatates:[1236,464,206,114],kofte:[1034,354,102,58],
  izgara3:[583,466,208,105],izgara4:[801,466,208,105],gosterge:[1557,522,57,41],tablet:[34,615,192,167],
  ekmekUst:[312,340,111,76],ekmekAlt:[312,452,111,66],peynir:[1264,354,102,62],tursu:[1103,484,59,52],
  fritoz:[1478,350,182,78],arka:[-240,-380,2332,1459]};
// dokunma alanları (resimdeki nesnelerin üstü; komşusuna binmez). iPhone SE'de (0,307 pt/birim) en küçüğü ≥ 44 pt:
// raflar dolabın üst/alt kenarına, ızgara ve hazne sıraları arka tezgâha ve alta doğru uzar
const HIT={ekmekUst:[192,262,352,168],ekmekAlt:[192,430,352,150],
  izg0:[592,300,208,154],izg1:[800,300,208,154],izg2:[576,454,218,146],izg3:[794,454,222,146],
  kofte:[1018,300,198,156],peynir:[1216,300,214,156],tursu:[1018,456,216,146],patates:[1234,456,214,146],
  fritoz:[1440,282,262,330],cig:[1702,440,150,175],tezgah:[372,620,272,160],tepsi0:[694,620,300,170],tepsi1:[1000,620,300,170]};
// ızgara merkezleri (0,1 açık; 2,3 resimde kilitli)
const IZG=[{x:697,y:391,s:1.25},{x:902,y:391,s:1.25},{x:687,y:518,s:1.3},{x:905,y:518,s:1.3}];
const HAZNE_K={x:1118,y:395},HAZNE_P={x:1338,y:520},SEPET={x:1570,y:388},CIG={x:1780,y:528};
const TEZGAH={x:508,y:712},TEPSI=[{x:844,y:706},{x:1150,y:706}];
const MUS_X=[722,992,1262],MUS_ALT=311,MUS_W=168;   // müşteri yüzünün merkezi; MUS_ALT: arka tezgâhın üst çizgisi (müşteri bunun arkasında)
const W0=1852,H0=849;
const DUNYA=$('dunya'),WFX=$('wfx'),MUSK=$('musK'),BALON=$('balonK');
const LAY={s:.4,ox:0,oy:0};
const kutu=(r,cls='',html='')=>`<div class="${cls}" style="left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px">${html}</div>`;
const img=(ad,r,cls='')=>`<img class="${cls}" src="${G}${ad}.webp" alt="" style="left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px">`;
// dünya (sahne birimi) → ekran (app) noktası
const ekr=(x,y)=>({x:LAY.ox+x*LAY.s,y:LAY.oy+y*LAY.s});

/* ---- burger (yandan, ~17° üstten): katmanlar tools/burger/katman.mjs'te çizilir, uret.mjs 3× webp'ye döker ---- */
// her katman: s görsel, h yükseklik, a görselin altından oturma noktasına (alttaki katmanın üst yüzü), k kalınlık
// (bir üstteki katman bu kadar yukarıya oturur). Genişlik hepsinde 140 birim, merkez x=70. (uret.mjs bu satırı yazar)
/*KAT>*/const KAT={bunBot:{s:'b-alt',h:60.15,a:19.05,k:21},patty:{s:'b-kofte',h:58.7,a:21.85,k:15},cheese:{s:'b-peynir',h:54,a:31,k:3},pickle:{s:'b-tursu',h:50.75,a:26,k:3.5},bunTop:{s:'b-ust',h:72.25,a:21.25,k:47}};/*<KAT*/
const BW=140;
// katmanların oturma yükseklikleri (burger kutusunun altından, birim): [ilk katmanın a'sı, +k, +k, ...]
function oturma(ks){const o=[];let y=ks.length&&KAT[ks[0]]?KAT[ks[0]].a:0;ks.forEach(k=>{const L=KAT[k];o.push(y);if(L)y+=L.k});return o}
// burgerin yüksekliği (birim): en alttan en üst katmanın tepesine
function burgerYuk(ks){if(!ks.length)return 0;const o=oturma(ks);let m=0;ks.forEach((k,i)=>{const L=KAT[k];if(L)m=Math.max(m,o[i]-L.a+L.h)});return m}
// ks katmanları; sonuç: kutunun (140 birim genişlik) altına göre dizilmiş katmanlar. Her katmanın altındakine düşen gölgesi:
// üstteki katmanın biçimi (3 birim aşağı kaydırılmış, bulanık), alttaki katmanın biçimiyle kırpılır (havaya taşmaz).
function burgerHTML(ks,{yeni=-1}={}){if(!ks.length)return '';const o=oturma(ks);let h=`<i class="bz${yeni===0?' yeni':''}"></i>`;
  ks.forEach((k,i)=>{const L=KAT[k];if(!L)return;const b=o[i]-L.a;
    if(i>0){const A=KAT[ks[i-1]];if(A){const ab=o[i-1]-A.a;
      h+=`<div class="gl${i===yeni?' yeni':''}" style="bottom:${ab.toFixed(2)}px;height:${A.h}px;-webkit-mask-image:url(${G}${A.s}.webp);mask-image:url(${G}${A.s}.webp)"><div><i style="bottom:${(b-ab-3).toFixed(2)}px;height:${L.h}px;-webkit-mask-image:url(${G}${L.s}.webp);mask-image:url(${G}${L.s}.webp)"></i></div></div>`}}
    h+=`<img${i===yeni?' class="yeni"':''} src="${G}${L.s}.webp" alt="" style="bottom:${b.toFixed(2)}px;height:${L.h}px">`});
  return h}
const PORSIYON=`<img class="pors" src="${G}porsiyon.webp" alt="">`;

/* ---- yerleşim: bir kez kurulur ---- */
let MK={};
function buildMutfak(){
  const h=[];
  // değişen parçalar (resimde dolu olan hâller resmin kendisi: o zaman gizli)
  h.push(`<img class="p" id="kvK" alt="" style="left:${P.kuvetKofte[0]}px;top:${P.kuvetKofte[1]}px;width:${P.kuvetKofte[2]}px;height:${P.kuvetKofte[3]}px" hidden>`);
  h.push(`<img class="p" id="kvP" alt="" style="left:${P.kuvetPatates[0]}px;top:${P.kuvetPatates[1]}px;width:${P.kuvetPatates[2]}px;height:${P.kuvetPatates[3]}px" hidden>`);
  h.push(img('izgara-3',P.izgara3,'p acilan" id="iz3" hidden data-x="'),img('izgara-4',P.izgara4,'p acilan" id="iz4" hidden data-x="'));
  // ızgaralardaki köfteler
  IZG.forEach((g,i)=>{const w=102*g.s,hh=58*g.s;
    h.push(`<div class="gk" id="gk${i}" style="left:${g.x-w/2}px;top:${g.y-hh/2}px;width:${w}px;height:${hh}px" hidden><img class="cig" src="${G}kofte-cig.webp" alt=""><img class="pis" src="${G}kofte.webp" alt=""><i class="duman d1"></i><i class="duman d2"></i><i class="duman d3"></i></div>`);
    h.push(`<div class="halka" id="hl${i}" style="left:${g.x+44*g.s}px;top:${g.y-46*g.s}px" hidden><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" class="z"/><circle cx="20" cy="20" r="16" class="d" pathLength="100"/></svg></div>`)});
  // fritöz: sepette patates, kabarcıklar, gösterge, ışıklar
  h.push(`<img class="p fr" id="frPis" src="${G}fritoz-pisiyor.webp" alt="" style="left:${P.fritoz[0]}px;top:${P.fritoz[1]}px;width:${P.fritoz[2]}px;height:${P.fritoz[3]}px" hidden>`);
  h.push(`<img class="p fr" id="frHaz" src="${G}fritoz-hazir.webp" alt="" style="left:${P.fritoz[0]}px;top:${P.fritoz[1]}px;width:${P.fritoz[2]}px;height:${P.fritoz[3]}px" hidden>`);
  h.push(`<div class="kabarcik" id="frKab" style="left:1490px;top:356px;width:168px;height:64px" hidden>${Array.from({length:14},(_,i)=>`<i style="left:${(i*37)%96+2}%;animation-delay:${(i*0.13).toFixed(2)}s"></i>`).join('')}</div>`);
  h.push(`<div class="buhar" id="frBuh" style="left:1500px;top:280px;width:150px;height:90px" hidden><i></i><i></i><i></i></div>`);
  h.push(img('gosterge-bos',P.gosterge,'p" id="gstB'));
  h.push(`<svg class="rakam" id="gst" viewBox="0 0 57 41" style="left:${P.gosterge[0]}px;top:${P.gosterge[1]}px;width:${P.gosterge[2]}px;height:${P.gosterge[3]}px"></svg>`);
  h.push(`<i class="led kir" id="ledK" style="left:1520px;top:527px"></i><i class="led yes" id="ledY" style="left:1520px;top:558px"></i>`);
  // doğrama çubuğu (çiğ patateslerin üstünde)
  h.push(`<div class="dogra" id="dgr" style="left:1722px;top:440px;width:116px;height:18px" hidden>${Array.from({length:M.dograma},()=>'<i></i>').join('')}</div>`);
  // sipariş ekranı (askılı tablet): sağ yarısı oyunda yazılır
  h.push(img('tablet-bos',P.tablet,'p" id="tbB'));
  h.push(`<svg class="neon" id="tbN" viewBox="0 0 80 80" style="left:120px;top:637px;width:86px;height:86px"></svg>`);
  // tezgâh: hazırlık yeri (tahta) ve iki tepsi
  h.push(`<img class="tahta" src="${G}tahta.webp" alt="" style="left:${TEZGAH.x-130}px;top:${TEZGAH.y-51}px;width:260px;height:100px">`);
  h.push(`<div class="burger" id="brg" style="left:${TEZGAH.x-BW/2}px;top:${TEZGAH.y-200+14}px;width:${BW}px;height:200px"></div>`);
  TEPSI.forEach((p,i)=>h.push(`<div class="tepsi" id="tp${i}" style="left:${p.x-135}px;top:${p.y-56}px;width:270px;height:112px"><img class="tp" src="${G}tepsi.webp" alt=""><div class="ic-b"></div><div class="ic-f"></div></div>`));
  // dokunma alanları
  Object.entries(HIT).forEach(([k,r])=>h.push(`<div class="hit" data-h="${k}" style="left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px"></div>`));
  $('parca').innerHTML=h.join('');
  MK={kvK:$('kvK'),kvP:$('kvP'),iz:[null,null,$('iz3'),$('iz4')],gk:[0,1,2,3].map(i=>$('gk'+i)),hl:[0,1,2,3].map(i=>$('hl'+i)),
    frPis:$('frPis'),frHaz:$('frHaz'),frKab:$('frKab'),frBuh:$('frBuh'),gst:$('gst'),ledK:$('ledK'),ledY:$('ledY'),dgr:$('dgr'),tbN:$('tbN'),
    brg:$('brg'),tp:[$('tp0'),$('tp1')],hit:{}};
  document.querySelectorAll('#parca .hit').forEach(el=>{MK.hit[el.dataset.h]=el;el.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();dokun(el.dataset.h,el)})});
  MUSK.innerHTML='';BALON.innerHTML='';WFX.innerHTML=''}
// doğrama bıçağı: çelik ağız (ışıklı sırt), ahşap sap ve perçinler, kalın koyu kontur; sap sağ üstte, ağız aşağı iner
const BICAK='<svg viewBox="0 0 140 120" aria-hidden="true"><defs><linearGradient id="bkA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".55" stop-color="#bcc4cc"/><stop offset="1" stop-color="#7e8894"/></linearGradient>'+
  '<linearGradient id="bkS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8622c"/><stop offset="1" stop-color="#5e2e10"/></linearGradient></defs>'+
  '<g transform="rotate(-28 70 60)"><path d="M8 66Q6 52 22 50L84 46L86 72L30 76Q12 78 8 66Z" fill="url(#bkA)" stroke="#2a1a10" stroke-width="3.5" stroke-linejoin="round"/>'+
  '<path d="M20 54L82 50" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/><path d="M14 70Q40 72 84 69" stroke="#5a6470" stroke-width="2" fill="none" opacity=".6"/>'+
  '<rect x="84" y="49" width="10" height="21" rx="3" fill="#6e7884" stroke="#2a1a10" stroke-width="3"/>'+
  '<path d="M94 51H128Q134 51 134 59.5Q134 68 128 68H94Z" fill="url(#bkS)" stroke="#2a1a10" stroke-width="3.5" stroke-linejoin="round"/>'+
  '<path d="M98 55H126" stroke="#d89a5c" stroke-width="2" stroke-linecap="round" opacity=".8"/><circle cx="104" cy="60" r="2.4" fill="#e8d8b8" stroke="#2a1a10" stroke-width="1.2"/><circle cx="122" cy="60" r="2.4" fill="#e8d8b8" stroke="#2a1a10" stroke-width="1.2"/></g></svg>';
// tahta (g/v3/tahta.webp) ve tepsi (tepsi.webp): tools/burger/nesne.mjs

/* ---- çizim: durum değişince ---- */
function kuvetCiz(){const k=Math.max(0,Math.min(M.hazneKofte,S.hk));
  if(k>=M.hazneKofte)MK.kvK.hidden=true;else{const s=G+'kuvet-kofte-'+k+'.webp';if(MK.kvK.dataset.s!==s){MK.kvK.src=s;MK.kvK.dataset.s=s}MK.kvK.hidden=false}
  const p=Math.max(0,Math.min(M.haznePatates,S.hp));
  if(p>=M.haznePatates)MK.kvP.hidden=true;else{const s=G+'kuvet-patates-'+p+'.webp';if(MK.kvP.dataset.s!==s){MK.kvP.src=s;MK.kvP.dataset.s=s}MK.kvP.hidden=false}}
function burgerCiz(yeni){MK.brg.innerHTML=burgerHTML(S.burger,{yeni:yeni?S.burger.length-1:-1});MK.brg.classList.toggle('bitti',S.burger[S.burger.length-1]==='bunTop');MK.brg.classList.toggle('sec',S.sec==='burger')}
function tepsiCiz(i,yeni){const tp=S.tepsi[i],el=MK.tp[i];
  el.querySelector('.ic-b').innerHTML=tp.b?`<div class="mini">${burgerHTML(tp.b)}</div>`:'';el.querySelector('.ic-f').innerHTML=tp.f===true?PORSIYON:'';
  el.classList.toggle('sec',S.sec==='tepsi'+i);el.classList.toggle('dolu',!!(tp.b||tp.f));
  if(yeni){el.classList.remove('kon');void el.offsetWidth;el.classList.add('kon')}}
// sipariş ekranı: neon patates + bekleyen sipariş sayısı (burger simgesi resimde)
function tabletCiz(){const n=S.cust.filter(c=>c&&!c.gitti).length;const key=n+'';if(MK.tbN.dataset.k===key)return;MK.tbN.dataset.k=key;
  MK.tbN.innerHTML='<g class="nn"><path d="M14 12h26l-4 24H18z"/><path d="M17 12l-2-9M22 12l0-10M27 12l1-9M32 12l3-8M37 12l4-6"/><path d="M22 22h10"/></g>'+
    `<text x="44" y="70" text-anchor="middle" class="nt">×${n}</text>`}
// fritöz göstergesi: kırmızı yedi parçalı rakamlar
const SEG={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgedc',7:'abc',8:'abcdefg',9:'abcdfg'};
function rakam(ch,x){const s=SEG[ch]||'',w=11,hh=26,y=7,t=3;const p={a:[x,y,w,t],g:[x,y+hh/2-t/2,w,t],d:[x,y+hh-t,w,t],f:[x-1,y,t,hh/2],b:[x+w-t+1,y,t,hh/2],e:[x-1,y+hh/2,t,hh/2],c:[x+w-t+1,y+hh/2,t,hh/2]};
  return Object.keys(p).map(k=>{const r=p[k];return `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" rx="1.3" class="${s.includes(k)?'on':'off'}"/>`}).join('')}
function gostergeCiz(){let v=0;if(S.fr.st===1)v=Math.ceil(Math.max(0,S.fr.t));
  const s=String(Math.min(99,v)),key=s+S.fr.st;if(MK.gst.dataset.k===key)return;MK.gst.dataset.k=key;
  MK.gst.innerHTML=(s.length>1?rakam(s[0],15):'')+rakam(s[s.length-1],s.length>1?31:23);
  MK.ledK.classList.toggle('on',S.fr.st===1);MK.ledY.classList.toggle('on',S.fr.st===2)}
function fritozCiz(){const f=S.fr;MK.frPis.hidden=f.st!==1;MK.frHaz.hidden=f.st!==2;MK.frKab.hidden=f.st!==1;MK.frBuh.hidden=f.st===0;
  MK.hit.fritoz.classList.toggle('bekliyor',f.st===2);gostergeCiz()}
function dograCiz(){const n=S.dogra;MK.dgr.hidden=!n;[...MK.dgr.children].forEach((x,i)=>x.classList.toggle('on',i<n))}
function izgaraCiz(i){const g=S.izg[i],el=MK.gk[i],hl=MK.hl[i];if(!g)return;
  if(MK.iz[i])MK.iz[i].hidden=!g.acik;
  el.hidden=g.st===0;hl.hidden=g.st!==1;el.classList.toggle('hazir',g.st===2);el.classList.toggle('pisiyor',g.st===1)}
function izgaraIlerle(i){const g=S.izg[i];if(!g||g.st!==1)return;const ps=VERI.izgaraPisme(SAVE.up),f=Math.min(1,g.t/ps);
  MK.gk[i].style.setProperty('--p',f.toFixed(3));MK.hl[i].querySelector('.d').setAttribute('stroke-dasharray',(f*100).toFixed(1)+' 100')}
function hepsiniCiz(){kuvetCiz();burgerCiz();S.tepsi.forEach((_,i)=>tepsiCiz(i));fritozCiz();dograCiz();S.izg.forEach((_,i)=>{izgaraCiz(i);izgaraIlerle(i)});tabletCiz()}

/* ---- dünya içi uçuş (sahne biriminde) ---- */
function ucW(html,from,to,{w=100,h=60,sure=420,yay=-60,s0=1,s1=1,don=0,cls='',easing='cubic-bezier(.35,.1,.45,1)'}={}){
  const d=document.createElement('div');d.className='wu '+cls;d.innerHTML=html;d.style.width=w+'px';d.style.height=h+'px';WFX.appendChild(d);
  const tr=(x,y,s,r)=>`translate(${x-w/2}px,${y-h/2}px) scale(${s}) rotate(${r}deg)`;d.style.transform=tr(from.x,from.y,s0,0);
  return new Promise(res=>{let bitti=false;const son=()=>{if(bitti)return;bitti=true;d.remove();res()};
    try{const a=d.animate([{transform:tr(from.x,from.y,s0,0)},{transform:tr((from.x+to.x)/2,(from.y+to.y)/2+yay,(s0+s1)/2*1.06,don/2),offset:.5},{transform:tr(to.x,to.y,s1,don)}],{duration:sure,easing,fill:'forwards'});a.onfinish=son}catch(e){}
    setTimeout(son,sure+250)})}
// sahnede kısa yazı (−6 para, uyarı) ve parçacık
function maliyetYaz(n,x,y){if(!n)return;const p=ekr(x,y);yazi(p.x,p.y,`−${n}${PARA()}`,'mini')}
function kirinti(x,y,renk,n=6,yay=40){for(let i=0;i<n;i++){const d=document.createElement('i');d.className='kir';d.style.background=renk[i%renk.length];d.style.left=x+'px';d.style.top=y+'px';WFX.appendChild(d);
  const a=-Math.PI/2+(Math.random()-.5)*2.4,v=yay*(.5+Math.random()*.7),tx=Math.cos(a)*v,ty=Math.sin(a)*v;
  try{d.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(.9)`,opacity:1,offset:.45},{transform:`translate(calc(-50% + ${tx*1.3}px),calc(-50% + ${ty+60}px)) scale(.5)`,opacity:0}],{duration:480+Math.random()*200,easing:'ease-out',fill:'forwards'})}catch(e){}
  setTimeout(()=>d.remove(),800)}}
function sallaEl(el){if(!el)return;el.classList.remove('red');void el.offsetWidth;el.classList.add('red')}
function reddetH(k,msg){const el=MK.hit[k];sallaEl(el);if(msg)uyari(el,msg);else{ses('uyari');tit()}return false}
function harca(n,x,y){if(!n)return;S.kasa-=n;S.gider+=n;hud({sure:250});maliyetYaz(n,x,y)}

/* ---- dokunuşlar ---- */
function dokun(k,el){if(!aktif())return;
  if(k==='ekmekAlt'||k==='ekmekUst')return malzeme('bun',k);
  if(k==='kofte')return malzeme('patty',k);
  if(k==='peynir')return malzeme('cheese',k);
  if(k==='tursu')return malzeme('pickle',k);
  if(k.startsWith('izg'))return izgara(+k[3]);
  if(k==='patates')return patatesSec();
  if(k==='fritoz')return fritoz();
  if(k==='cig')return dogra();
  if(k==='tezgah')return burgerSec();
  if(k.startsWith('tepsi'))return tepsi(+k[5])}
function secim(v){S.sec=v;burgerCiz();S.tepsi.forEach((_,i)=>tepsiCiz(i));MK.hit.patates.classList.toggle('sec',v==='patates');
  const sp=$('patSec');if(v==='patates'&&!sp){const d=document.createElement('div');d.id='patSec';d.className='patsec';d.innerHTML=PORSIYON;d.style.left=(HAZNE_P.x-50)+'px';d.style.top=(HAZNE_P.y-110)+'px';WFX.appendChild(d)}
  else if(v!=='patates'&&sp)sp.remove();
  S.cust.forEach(c=>{if(c)c.bub.classList.toggle('bekle',!!v&&v.startsWith('tepsi'))});rehber()}

// malzemeye dokun → tezgâhtaki burgere kendiliğinden konur. Alt ekmek ilk, üst ekmek son; ortadakiler siparişte olduğu kadar.
function malzeme(k,hk){if(S.sec)secim(null);
  const en=k==='bun'?null:enCok(k);
  let r=VERI.koyKarar(S.burger,k,en);
  // raf ayrımı: alt raf alt ekmek, üst raf üst ekmek
  if(k==='bun'){if(hk==='ekmekAlt'&&S.burger.length)r=S.burger[S.burger.length-1]==='bunTop'?'bitti':'altVar';else if(hk==='ekmekUst'&&!S.burger.length)r='ustYok'}
  if(r==='bitti')return reddetH(hk,t('done'));
  if(r==='ekmekYok'||r==='ustYok')return reddetH(hk,t('needBun'));
  if(r==='altVar')return reddetH(hk,t('notDone'));
  if(r==='eksik')return reddetH(hk,t('topEarly'));
  if(r==='fazla')return reddetH(hk,t('dup'));
  if(k==='patty'&&S.hk<=0)return reddetH(hk,t('noPatty'));
  const kat=r==='alt'?'bunBot':r==='ust'?'bunTop':k;
  // kaynaktan burgere uçar: yerinin biraz üstünde süzülmeden durur, düşer, oturunca ezilir (dusK); alttakiler hafifçe basılır
  const L=KAT[kat],kay=kaynak(kat),o=S.oturum;
  S.burger.push(kat);const hs=oturma(S.burger)[S.burger.length-1];
  if(kat==='patty'){S.hk--;kuvetCiz()}else harca(VERI.katmanMaliyet(kat),kay.x,kay.y-30);
  burgerCiz();const son=MK.brg.lastElementChild,gl=son&&son.previousElementSibling;
  if(son)son.style.visibility='hidden';if(gl&&(gl.classList.contains('gl')||gl.classList.contains('bz')))gl.style.visibility='hidden';
  const hy=TEZGAH.y+14-(hs-L.a)-L.h/2-34;
  ucW(`<img src="${G}${L.s}.webp" alt="">`,kay,{x:TEZGAH.x,y:hy},{w:BW,h:L.h,sure:250,yay:-80,s0:.9,s1:1,cls:'mal',easing:'cubic-bezier(.3,.2,.4,1)'}).then(()=>{
    if(o!==S.oturum)return;burgerCiz(true);const b=MK.brg;b.classList.remove('bas','tamam');void b.offsetWidth;b.classList.add(kat==='bunTop'?'tamam':'bas');
    zaman(()=>{ses('birak:'+(kat==='bunBot'||kat==='bunTop'?kat:k));if(kat==='bunTop'){const q=ekr(TEZGAH.x,TEZGAH.y-90);parilti(q.x,q.y,0)}},120);
    rehber()});
  ses('sec');tit();rehber();return true}
// bir malzeme bu burgerde en çok kaç kez olabilir: bekleyen müşterilerin siparişlerinden (yoksa varsayılan sipariş)
function enCok(k){let m=0;const ss=S.cust.filter(c=>c&&!c.gitti).map(c=>c.sip.katmanlar);if(!ss.length)ss.push(VERI.SIPARIS0.katmanlar);
  ss.forEach(ks=>{const n=ks.filter(x=>x===k).length;if(n>m)m=n});return Math.max(1,m)}
function kaynak(kat){return kat==='bunBot'?{x:367,y:485}:kat==='bunTop'?{x:367,y:377}:kat==='patty'?{x:1118,y:392}:kat==='cheese'?{x:1315,y:386}:{x:1130,y:512}}

// ızgara: açık ve boşsa çiğ köfte konur (maliyet o an), 8 sn pişer, pişince hazneye uçar (hazne doluysa bekler)
function izgara(i){const g=S.izg[i],k='izg'+i;if(!g)return false;
  if(!g.acik){const kl=MK.hit[k];sallaEl(kl);uyari(kl,t('lockGrill'));return false}
  if(g.st===1)return reddetH(k,t('grillBusy'));
  if(g.st===2)return reddetH(k,t('pattyFull'));
  g.st=1;g.t=0;harca(VERI.katmanMaliyet('patty'),IZG[i].x,IZG[i].y-40);
  const el=MK.gk[i];izgaraCiz(i);izgaraIlerle(i);el.classList.remove('dus');void el.offsetWidth;el.classList.add('dus');
  ses('izgara');tit();rehber();return true}
function izgaraAdim(dt){const ps=VERI.izgaraPisme(SAVE.up);
  S.izg.forEach((g,i)=>{if(g.st===1){g.t+=dt;izgaraIlerle(i);if(g.t>=ps){g.st=2;izgaraCiz(i);ses('pisti')}}
    if(g.st===2&&S.hk+S.hkUcan<M.hazneKofte){g.st=0;izgaraCiz(i);S.hkUcan++;const o=S.oturum;
      ucW(`<img src="${G}kofte.webp" alt="">`,IZG[i],{x:HAZNE_K.x+(Math.random()-.5)*40,y:HAZNE_K.y},{w:102*IZG[i].s,h:58*IZG[i].s,sure:520,yay:-120,s0:1,s1:.9,don:-10,cls:'kof'}).then(()=>{
        if(o!==S.oturum)return;S.hkUcan=Math.max(0,S.hkUcan-1);S.hk=Math.min(M.hazneKofte,S.hk+1);kuvetCiz();
        MK.kvK.classList.remove('kon');void MK.kvK.offsetWidth;MK.kvK.classList.add('kon');ses('birak:patty');rehber()})}})}

// çiğ patates: her dokunuş doğrama çubuğunu doldurur; 10'da kendiliğinden fritöze. Fritöz doluyken (kızarıyor ya da bekliyor) red.
function dogra(){if(S.fr.st!==0){const el=MK.hit.cig;sallaEl(el);uyari(el,S.fr.st===1?t('frying'):t('fryerBusy'));tit('ag');MK.dgr.hidden=false;MK.dgr.classList.remove('red');void MK.dgr.offsetWidth;MK.dgr.classList.add('red');setTimeout(()=>dograCiz(),500);return false}
  if(S.dogra>=M.dograma)return false;
  S.dogra++;dograCiz();ses('dogra');tit();
  // bıçak darbesi ve patates kırıntıları
  const b=document.createElement('div');b.className='bicak';b.style.left=(CIG.x-70+Math.random()*24)+'px';b.style.top=(CIG.y-120+Math.random()*20)+'px';b.style.setProperty('--r',(-8+Math.random()*16)+'deg');
  b.innerHTML=BICAK;WFX.appendChild(b);setTimeout(()=>b.remove(),380);
  kirinti(CIG.x,CIG.y-10,['#fbe6a6','#f3d27a','#fff4d0'],5,46);
  const ci=MK.hit.cig;ci.classList.remove('vur');void ci.offsetWidth;ci.classList.add('vur');
  if(S.dogra>=M.dograma){const o=S.oturum;S.fr.st=-1;   // doğrandı: çubuklar fritöze uçuyor
    setTimeout(()=>{if(o!==S.oturum)return;S.dogra=0;dograCiz()},350);
    const n=7;for(let j=0;j<n;j++)setTimeout(()=>{if(o!==S.oturum)return;
      ucW('<i class="cubuk"></i>',{x:CIG.x+(Math.random()-.5)*60,y:CIG.y-20},{x:SEPET.x+(Math.random()-.5)*110,y:SEPET.y+(Math.random()-.5)*20},{w:44,h:12,sure:420,yay:-110,s0:1,s1:.9,don:200+Math.random()*300,cls:'cub'})},j*45);
    setTimeout(()=>{if(o!==S.oturum)return;S.fr={st:1,t:VERI.fritozPisme(SAVE.up),kalan:M.haznePatates};harca(M.haznePatates*VERI.maliyet([],'fries'),SEPET.x,SEPET.y-60);
      fritozCiz();ses('fritoz');kirinti(SEPET.x,SEPET.y,['#ffd36a','#fff0b0','#ffb733'],9,55);rehber()},n*45+400)}
  rehber();return true}
function fritozAdim(dt){const f=S.fr;if(f.st!==1)return;f.t-=dt;gostergeCiz();if(f.t<=0){f.st=2;f.t=0;fritozCiz();ses('pisti');rehber()}}
// fritöze dokun: kızarmış patates hazneye (4 porsiyon; hazne doluysa kalanı sepette bekler)
function fritoz(){const f=S.fr;
  if(f.st===1){const el=MK.hit.fritoz;sallaEl(el);uyari(el,t('frying'));return false}
  if(f.st===0||f.st===-1)return reddetH('fritoz',t('fryerEmpty'));
  const yer=M.haznePatates-S.hp;if(yer<=0)return reddetH('fritoz',t('friesFull'));
  const n=Math.min(yer,f.kalan);f.kalan-=n;if(!f.kalan){f.st=0}fritozCiz();
  const o=S.oturum;ses('al');tit();
  for(let j=0;j<n;j++)setTimeout(()=>{if(o!==S.oturum)return;
    ucW(`<img src="${G}patates-tutam.webp" alt="">`,{x:SEPET.x+(j-1.5)*30,y:SEPET.y},{x:HAZNE_P.x+(j-1.5)*28,y:HAZNE_P.y+4},{w:110,h:56,sure:460,yay:-120,s0:.8,s1:.9,cls:'tut'}).then(()=>{
      if(o!==S.oturum)return;S.hp=Math.min(M.haznePatates,S.hp+1);kuvetCiz();MK.kvP.classList.remove('kon');void MK.kvP.offsetWidth;MK.kvP.classList.add('kon');ses('birak:pickle');rehber()})},j*90);
  return true}
function patatesSec(){if(S.sec==='patates'){secim(null);return true}
  if(S.hp<=0)return reddetH('patates',t('noFries'));
  secim('patates');ses('sec');tit();return true}
function burgerSec(){const b=S.burger;if(!b.length)return reddetH('tezgah',t('needBun'));
  if(b[b.length-1]!=='bunTop')return reddetH('tezgah',t('notDone'));
  secim(S.sec==='burger'?null:'burger');if(S.sec)ses('al');return true}
// tepsiye dokun: seçili burger/patates tepsiye kayar; seçim yoksa tepsi seçilir (sonra müşteriye dokun)
function tepsi(i){const tp=S.tepsi[i];
  if(S.sec==='burger'){if(tp.b)return reddetH('tepsi'+i,t('trayFull'));
    const ks=S.burger.slice();S.burger=[];secim(null);burgerCiz();const yk=burgerYuk(ks),o=S.oturum;
    ucW(`<div class="mini">${burgerHTML(ks)}</div>`,{x:TEZGAH.x,y:TEZGAH.y-2-yk*.64},{x:TEPSI[i].x-43,y:TEPSI[i].y+32-yk*.425},{w:BW,h:yk,sure:300,yay:-60,s0:1/.78,s1:.85,cls:'brgu'}).then(()=>{
      if(o!==S.oturum)return;tp.b=ks;tepsiCiz(i,true);ses('birak:bunTop');rehber()});
    ses('al');tit();return true}
  if(S.sec==='patates'){if(tp.f)return reddetH('tepsi'+i,t('trayFries'));if(S.hp<=0){secim(null);return false}
    S.hp--;kuvetCiz();secim(null);const o=S.oturum;tp.f='ucuyor';
    ucW(PORSIYON,{x:HAZNE_P.x,y:HAZNE_P.y-60},{x:TEPSI[i].x+62,y:TEPSI[i].y-30},{w:100,h:108,sure:300,yay:-50,s0:1,s1:.86,cls:'prs'}).then(()=>{if(o!==S.oturum)return;tp.f=true;tepsiCiz(i,true);ses('birak:cheese');rehber()});
    ses('al');tit();return true}
  if(S.sec==='tepsi'+i){secim(null);return true}
  if(!tp.b&&!tp.f)return reddetH('tepsi'+i,t('emptyTray'));
  if(tp.f==='ucuyor')return false;
  secim('tepsi'+i);ses('al');return true}

/* ================= müşteriler ================= */
function spawn(){const bos=[0,1,2].filter(i=>!S.cust[i]&&S.slotT[i]<=S.now);const n=S.cust.filter(Boolean).length;if(!bos.length||n>=S.cfg.sira||S.kalan<=0)return false;
  const i=bos.includes(1)&&n===0?1:bos[Math.floor(Math.random()*bos.length)];
  const sip=VERI.siparis6();
  const who=pickWho();
  const el=document.createElement('div');el.className='mus';el.style.left=(MUS_X[i]-MUS_W/2)+'px';
  el.innerHTML=`<div class="yuz" role="img" aria-label="${who?who.ad:''}"></div>`;
  const yon=i===0?-1:i===2?1:(Math.random()<.5?-1:1);el.style.setProperty('--gx',(yon*170)+'px');
  MUSK.appendChild(el);
  const bub=document.createElement('div');bub.className='balon';bub.style.left=(MUS_X[i]+70)+'px';
  bub.innerHTML=`<div class="sip"><span class="b">${'<div class="mini">'+burgerHTML(sip.katmanlar)+'</div>'}</span><span class="f">${PORSIYON}</span></div><div class="sabir"><b></b></div>`;
  BALON.appendChild(bub);
  const hit=document.createElement('div');hit.className='hit mh';hit.style.left=(MUS_X[i]-82)+'px';hit.style.width='300px';
  BALON.appendChild(hit);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.classList.add('in');bub.classList.add('in')}));
  const sb=S.cfg.sabirSiparis(sip);
  const max=S.rehber?Math.max(240,sb*6):Math.round(sb*(1+.15*S.kolay));
  const c=S.cust[i]={i,el,bub,hit,sip,durum:VERI.yeniDurum(sip),max,p:max,who,yuzEl:el.querySelector('.yuz'),fill:bub.querySelector('.sabir b'),emo:'',ruh:'mutlu',tut:0,rehberli:S.rehber};
  hit.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();musteriDokun(c)});
  face(c,'happy');S.kalan--;tabletCiz();return true}
function cikar(c,tur,gec=0){if(S.cust[c.i]!==c)return false;S.cust[c.i]=null;c.gitti=true;
  const anim=tur==='mutlu'?900:tur==='kizgin'?900:500;S.slotT[c.i]=S.now+(gec+anim+700)/1000;
  c.hit.remove();
  zaman(()=>{c.el.classList.add('cik',tur==='mutlu'?'mutlu-git':tur==='kizgin'?'kizgin-git':'normal-git');c.bub.classList.add('cik');
    setTimeout(()=>{c.el.classList.add('out');c.bub.classList.add('out');setTimeout(()=>{c.el.remove();c.bub.remove()},650)},anim)},gec);
  S.bitti++;if(c.rehberli){S.rehber=false;if(!SAVE.seen.includes('tut3')){SAVE.seen.push('tut3');save()}}hud({sessiz:true});tabletCiz();return true}
function custAdim(dt){S.cust.forEach(c=>{if(!c)return;c.p-=dt;const f=Math.max(0,c.p/c.max);
  c.fill.style.width=(f*100).toFixed(2)+'%';c.fill.style.background=sabirRenk(f);
  const r=VERI.ruh(f);if(r!==c.ruh){c.ruh=r;c.el.classList.toggle('kizgin',r==='kizgin')}
  if(S.now>=c.tut)face(c,VERI.yuz(f));
  if(c.p<=0)kacti(c)})}
function kacti(c){if(!cikar(c,'kizgin'))return;face(c,'angry');S.can=Math.max(0,S.can-1);S.kacan++;S.sayi.kizgin++;S.seri=0;
  const r=rel(c.yuzEl);yazi(r.cx,r.y+r.h*.3,t('gone'),'kotu');ses('kacti');setTimeout(()=>ses('can_gitti'),180);tit('ag');
  kirikKalp({x:r.cx,y:r.y+r.h*.4},120);kontrol();rehber()}
// baloncukta verilen parça soluklaşır
function alindiCiz(c){const d=c.durum;c.bub.querySelector('.b').classList.toggle('alindi',!!(d&&d.burger));c.bub.querySelector('.f').classList.toggle('alindi',!!(d&&d.yan))}
// müşteriye dokun: seçili tepsi o müşteriye gider
function musteriDokun(c){if(!aktif()||S.cust[c.i]!==c)return;
  if(!S.sec||!S.sec.startsWith('tepsi')){uyari(c.bub,t('pickTray'));return}
  const i=+S.sec[5],tp=S.tepsi[i];if(!tp.b&&!tp.f){secim(null);return}
  if(tp.f==='ucuyor')return;
  const parca={};if(tp.b)parca.katmanlar=tp.b;if(tp.f)parca.yan='fries';
  // tepsi (içindekilerle) müşteriye kayar, yerine boş tepsi gelir
  const kl=MK.tp[i].cloneNode(true);kl.removeAttribute('id');kl.classList.remove('sec','kon');kl.classList.add('giden');
  const x0=TEPSI[i].x,y0=TEPSI[i].y,x1=MUS_X[c.i],y1=MUS_ALT-6;
  kl.style.left=(x0-135)+'px';kl.style.top=(y0-56)+'px';WFX.appendChild(kl);
  try{kl.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${(x1-x0)*.55}px,${(y1-y0)*.5-40}px) scale(.8)`,offset:.55},{transform:`translate(${x1-x0}px,${y1-y0}px) scale(.62)`,opacity:1,offset:.85},{transform:`translate(${x1-x0}px,${y1-y0+40}px) scale(.55)`,opacity:0}],{duration:520,easing:'cubic-bezier(.4,0,.5,1)',fill:'forwards'})}catch(e){}
  setTimeout(()=>kl.remove(),620);
  S.tepsi[i]={b:null,f:false};secim(null);tepsiCiz(i);MK.tp[i].classList.remove('yeni');void MK.tp[i].offsetWidth;MK.tp[i].classList.add('yeni');
  ses('al');tit();
  teslimEt(c,parca,430)}

/* ================= teslim (parça parça) ================= */
function teslimEt(c,parca,gec=0){const f=Math.max(0,c.p/c.max);
  const o=VERI.teslimParca(c.durum,parca,f,SAVE.up,S.seri);
  if(o.durum)c.durum=o.durum;
  const yr=rel(c.yuzEl),x=yr.cx,y=yr.y+yr.h*.12;
  if(o.sonuc==='parca'){
    if(o.sabirEk>0)c.p=Math.min(c.max,c.p+o.sabirEk*c.max);c.tut=S.now+(gec/1000)+.9;
    zaman(()=>{face(c,'happy');alindiCiz(c);ses('teslim_normal');tit();const b=rel(c.bub);
      yazi(b.cx,b.y,`${ic('tik')}<span>${t('gotPart')}</span>`,'iyi kucuk');c.bub.classList.remove('aldi1');void c.bub.offsetWidth;c.bub.classList.add('aldi1')},gec);
    rehber();return o}
  const ucret=o.ucret||0,bah=o.bahsis||0;S.kasa+=ucret+bah;S.gelir+=ucret;S.bahsis+=bah;
  let tur;c.tut=1e9;
  zaman(()=>{alindiCiz(c)},gec);
  if(o.dogru&&o.ruh==='mutlu'){tur='mutlu';S.seri++;S.sayi.mutlu++;
    zaman(()=>{face(c,'love');ses('teslim_mutlu');tit('orta');c.el.classList.add('sevin')},gec);
    yazi(x,y,`+${ucret}${PARA()}`,'iyi',gec);parilti(x,yr.y+yr.h*.1,gec);
    if(bah){const W=APP.clientWidth,bx=x+12*cq();yazi(Math.min(W-14*cq(),Math.max(14*cq(),bx)),y-10*cq(),`${ic('kese')}<span>+${bah}</span><small>${t('tip')}</small>`,'bahsis',gec+400)}
    paraYagdir({x,y:yr.y+yr.h*.45},ucret+bah,gec+150)}
  else if(o.dogru&&o.ruh==='somurtkan'){tur='normal';S.seri=0;S.sayi.somurtkan++;
    zaman(()=>{face(c,'wait');ses('teslim_normal');hud({sessiz:true})},gec)}
  else{tur='kizgin';S.seri=0;S.sayi.kizgin++;if(!o.dogru)S.yanlis++;
    zaman(()=>{face(c,'angry');c.bub.classList.add('ret');ses(o.dogru?'teslim_kizgin':'yanlis');tit('ag')},gec);
    damga(c,o.dogru?t('angryPay'):t('wrong'),gec);
    yazi(x,y-6*cq(),`−${o.kayip||0}${PARA()}`,'kotu',gec+200)}
  if(o.can){S.can=Math.max(0,S.can-1);zaman(()=>ses('can_gitti'),gec+250);kirikKalp({x,y:yr.y+yr.h*.4},gec+250)}
  cikar(c,tur,gec);if(tur!=='mutlu')hud({sessiz:tur==='normal'});kontrol();rehber();return o}

/* ================= rehber (yeni mutfakta ilk müşteri) ================= */
let rehberHedef=null;
function rehberGizle(){document.querySelectorAll('.parla').forEach(e=>e.classList.remove('parla'));FX.querySelectorAll('.ipucu').forEach(e=>e.remove());rehberHedef=null}
function rehberAdim(){const c=S.cust.find(x=>x&&x.rehberli);if(!c)return null;
  const tpi=S.tepsi.findIndex(x=>x.b&&x.f===true),tpb=S.tepsi.findIndex(x=>x.b);
  if(tpi>=0)return S.sec==='tepsi'+tpi?[c.hit,tg('cust')]:[MK.hit['tepsi'+tpi],tg('tray')];
  if(tpb>=0){if(S.sec==='patates')return [MK.hit['tepsi'+tpb],tg('tray')];
    if(S.hp>0)return [MK.hit.patates,tg('fries')];
    if(S.fr.st===2)return [MK.hit.fritoz,tg('fryer')];if(S.fr.st===1||S.fr.st===-1)return [MK.hit.fritoz,tg('frying')];return [MK.hit.cig,tg('chop')]}
  const b=S.burger;
  if(b[b.length-1]==='bunTop')return S.sec==='burger'?[MK.hit.tepsi0,tg('tray')]:[MK.hit.tezgah,tg('burger')];
  if(!b.length)return [MK.hit.ekmekAlt,tg('bunBot')];
  for(const k of ['patty','cheese','pickle'])if(!b.includes(k)){
    if(k==='patty'&&S.hk<=0){const g=S.izg.findIndex(x=>x.acik&&x.st>0);return g>=0?[MK.hit['izg'+g],tg('cooking')]:[MK.hit.izg0,tg('grill')]}
    return [MK.hit[k==='patty'?'kofte':k==='cheese'?'peynir':'tursu'],tg(k)]}
  return [MK.hit.ekmekUst,tg('bunTop')]}
function rehber(zorla){if(!S.on||S.bitis||S.paused){if(rehberHedef)rehberGizle();return}
  let a=S.rehber?rehberAdim():null;
  // rehberden sonra ilk günlerde bir kez: ızgara ve doğrama ipuçları
  if(!a&&S.ipucu){if(!S.ipucu.izg&&S.hk<=3&&S.izg.every(g=>g.st===0)){a=[MK.hit.izg0,tg('grill')];S.ipucuAktif='izg'}
    else if(!S.ipucu.cig&&S.hp<=1&&S.fr.st===0){a=[MK.hit.cig,tg('chop')];S.ipucuAktif='cig'}
    else if(!S.ipucu.frt&&S.fr.st===2){a=[MK.hit.fritoz,tg('fryer')];S.ipucuAktif='frt'}
    else if(S.ipucuAktif){S.ipucu[S.ipucuAktif]=true;S.ipucuAktif=null}}
  if(!a){if(rehberHedef)rehberGizle();return}
  const [el,msg]=a,anahtar=msg+'|'+(el&&el.dataset.h||'');
  if(!zorla&&anahtar===rehberHedef)return;rehberGizle();rehberHedef=anahtar;if(!el)return;
  el.classList.add('parla');
  const tp=document.createElement('div');tp.className='ipucu';tp.innerHTML=ic('el')+`<span>${msg}</span>`;FX.appendChild(tp);
  const r=rel(el),w=tp.offsetWidth,h=tp.offsetHeight,W=APP.clientWidth,H=APP.clientHeight,c1=cq();let x=Math.min(W-w-1.5*c1,Math.max(1.5*c1,r.cx-w/2)),y=r.y-h-1.2*c1;
  // tezgâhtaki burger: ipucu burgerin üstüne binmesin, burgerin tepesinin üstünde dursun
  if(el===MK.hit.tezgah&&S.burger.length)y=Math.min(y,ekr(0,TEZGAH.y-2-burgerYuk(S.burger)).y-h-1.2*c1);
  const eng=engeller(),carp=yy=>yy<.5*c1||eng.some(e=>x<e.x+e.w&&x+w>e.x&&yy<e.y+e.h&&yy+h>e.y);
  if(carp(y)){const y2=r.y+r.h+1.2*c1;if(y2+h<H-.5*c1&&!carp(y2)||y<.5*c1){y=y2;tp.classList.add('alt')}}
  tp.style.left=x+'px';tp.style.top=y+'px';tp.style.setProperty('--ok',Math.max(12,Math.min(w-12,r.cx-x))+'px')}
function engeller(){const a=[rel($('hudL')),rel($('hudR'))];S.cust.forEach(c=>{if(c&&!c.gitti)a.push(rel(c.bub))});return a}

/* ================= gün akışı ================= */
function aktif(){return S.on&&!S.paused&&!S.bitis&&S.can>0}
function yeniOturum(){S.oturum++;clearTimeout(S.bitisT);S.bitisT=0;cancelAnimationFrame(kasaRAF);bekle=0;loopNo++}
function mutfakSifirla(){const n=VERI.izgaraGoz(SAVE.up);
  S.izg=[0,1,2,3].map(i=>({acik:i<n,st:0,t:0}));S.hk=M.hazir.patty;S.hkUcan=0;S.hp=M.hazir.fries;S.dogra=0;S.fr={st:0,t:0,kalan:0};
  S.burger=[];S.tepsi=[{b:null,f:false},{b:null,f:false}];S.sec=null;S.koyNo=0}
function startDay(d,hemen){yeniOturum();S.gun=d;S.cfg=VERI.gun6(d,SAVE.up);
  S.kolay=SAVE.kolay.g===d?Math.min(3,SAVE.kolay.n):0;
  S.kasa=S.kasa0=SAVE.coins;S.gelir=S.gider=S.bahsis=0;S.sayi={mutlu:0,somurtkan:0,kizgin:0};S.kacan=S.yanlis=0;S.can=3;canGor=3;
  S.kalan=S.cfg.musteri;S.bitti=0;S.seri=0;S.cust=[null,null,null];S.slotT=[0,0,0];S.now=0;S.nextAt=.8;S.bitis=false;S.on=false;S.paused=false;
  S.rehber=!SAVE.seen.includes('tut3');S.ipucu=d<=2||S.rehber?{izg:false,cig:false,frt:false}:null;S.ipucuAktif=null;
  FX.innerHTML='';mutfakSifirla();buildMutfak();hepsiniCiz();
  kasaGor=S.kasa;hud({sessiz:true});sesBtn();$('home').hidden=true;$('shop').hidden=true;APP.classList.remove('dukkanda');
  $('durBtn').innerHTML=ic('duraklat');$('durBtn').setAttribute('aria-label',t('pause'));$('kasaI').innerHTML=PARA();fit();
  const go=()=>{$('ov').hidden=true;S.on=true;S.paused=false;ses('gun_basla');donguBasla();rehber();yonKontrol()};
  if(hemen){go();return}
  const w=pickWho(),mf=w&&window.Musteri?`<i class="mf">${Musteri.draw(w.m,'happy')}</i>`:ic('gulen');
  const kr=VERI.kira(d),fy=VERI.fiyat(VERI.SIPARIS0);
  card(`<h2>${t('dayT',d)}</h2><div class="kol"><div class="info"><span>${mf}${t('cust',S.cfg.musteri)}</span><span class="${S.kasa<0?'neg':''}">${PARA()}${fmt(S.kasa)}</span></div>`+
    `<div class="kirasatir">${ic('kira')}<span>${t('kiraBugun')}</span><b>${fmt(kr)}${PARA()}</b></div>`+
    (S.kolay?`<div class="kolay">${ic('kumsaati')}<span>${t('easier')}</span></div>`:'')+`</div><div class="kol"><div class="menu"><span class="mbg" style="--mk:${(2.4*cq()*10/170).toFixed(3)}"><span class="mini">${burgerHTML(VERI.SIPARIS0.katmanlar)}</span></span><span class="mp">${PORSIYON}</span><b>${fy}${PARA()}</b></div><p>${t('dayP')}</p>`+
    `</div><div class="btns"><button class="btn" id="go">${ic('oynat')}${t('start')}</button></div>`,'iki basi');
  $('go').onclick=()=>{ses('tik');go()}}
function kontrol(){if(!S.on||S.bitis)return;
  if(S.can<=0){bitisBaslat(false,800);return}
  if(S.kalan<=0&&!S.cust.some(Boolean))bitisBaslat(true,1300)}
function bitisBaslat(win,ms){S.bitis=true;rehberGizle();kaydet(win);S.bitisT=zaman(()=>{S.bitisT=0;sonKart(win)},ms)}
function kaydet(win){const st=Math.max(win?1:0,Math.min(3,3-S.kacan-S.yanlis));S.yildiz=st;
  const gs=VERI.gunSonu(S.kasa,S.gun,SAVE.eksi);
  S.kira=gs.kira|0;S.kapandi=!!gs.kapandi;SAVE.coins=gs.kasa|0;SAVE.eksi=gs.eksiGun|0;
  if(win)SAVE.kolay={g:0,n:0};else SAVE.kolay=SAVE.kolay.g===S.gun?{g:S.gun,n:Math.min(3,SAVE.kolay.n+1)}:{g:S.gun,n:1};
  if(win){SAVE.stars[S.gun]=Math.max(SAVE.stars[S.gun]||0,st);SAVE.day=Math.max(SAVE.day,S.gun+1)}
  save()}
function bitir(win){if(!S.on)return;if(!S.bitis){S.bitis=true;rehberGizle();kaydet(win)}clearTimeout(S.bitisT);S.bitisT=0;sonKart(win)}
function sonKart(win){S.on=false;S.bitis=false;rehberGizle();secim(null);
  ses(win?'gun_bitti':'gun_kayip');
  const st=S.yildiz|0,net=S.gelir+S.bahsis-S.gider-S.kira,G2=120,adim=[S.gelir,S.bahsis,-S.gider,-S.kira];
  const n=(v,i)=>`<b class="${v<0?'neg':v>0?'pos':''}" data-v="${v}" data-i="${i}">${v>0?'+':v<0?'−':''}0${PARA()}</b>`;
  const t0=win?.25+3*.3:.3;
  const sat=(ad,v,i,cls='',ik='')=>`<div class="r${cls}" style="--g:${(t0+i*G2/1000).toFixed(2)}s"><span>${ik?ic(ik):''}${t(ad)}</span>${n(v,i)}</div>`;
  const ek=S.kapandi?'':SAVE.eksi>0?`<div class="eksi">${ic('kira')}<span>${t('eksiUyari',SAVE.eksi,VERI.KAPANIS_GUN||3)}</span></div>`:'';
  card(`<h2>${t(win?'winT':'failT')}</h2><div class="kol orta">`+(win?`<div class="stars">${[1,2,3].map(i=>`<span class="${i<=st?'dolu':'bos'}" style="--g:${(.25+(i-1)*.3).toFixed(2)}s">${ic(i<=st?'yildiz':'yildiz_bos')}</span>`).join('')}</div>`:`<p>${t('failP')}<br><small>${t('easierNext')}</small></p>`)+
    `<div class="yuzler" style="--g:${(t0+5*G2/1000).toFixed(2)}s"><span>${ic('gulen')}${S.sayi.mutlu}</span><span>${ic('somurtkan')}${S.sayi.somurtkan}</span><span>${ic('kizgin')}${S.sayi.kizgin}</span></div>`+
    `<div class="info"><span class="${!S.kapandi&&SAVE.coins<0?'neg':''}">${t('kasa')}: ${PARA()}${fmt(S.kapandi?S.kasa-S.kira:SAVE.coins)}</span></div>`+ek+`</div>`+
    `<div class="kol"><div class="tablo">${sat('gelir',adim[0],0)}${sat('bahsis',adim[1],1)}${sat('gider',adim[2],2)}${sat('kira',adim[3],3,' kira','kira')}${sat('net',net,4,' net')}</div></div>`+
    `<div class="btns yan"><button class="btn" id="nx">${ic(win?'ileri':'tekrar')}${t(win?'next':'retry')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`,'son iki');
  $('card').style.setProperty('--bg',(t0+6*G2/1000).toFixed(2)+'s');
  if(win)for(let i=1;i<=st;i++)setTimeout(()=>{if(!$('ov').hidden&&$('card').classList.contains('son'))ses(sesVar('yildiz:'+i)?'yildiz:'+i:'pisti')},(.25+(i-1)*.3+.35)*1000);
  $('card').querySelectorAll('.tablo b').forEach(b=>{const v=+b.dataset.v,i=+b.dataset.i,ilk=(t0+i*G2/1000+.15)*1000;
    const yaz=x=>{b.innerHTML=`${x>0?'+':x<0?'−':''}${fmt(Math.abs(x))}${PARA()}`};
    setTimeout(()=>{const s0=performance.now(),sure=Math.min(700,250+Math.abs(v)*6);let son=0;
      const f=now=>{if(!b.isConnected)return;const u=Math.min(1,(now-s0)/sure),x=Math.round(v*(1-Math.pow(1-u,2)));yaz(x);
        if(x!==son&&now-(f.t||0)>70){f.t=now;ses('tik')}son=x;if(u<1)requestAnimationFrame(f)};requestAnimationFrame(f)},ilk)});
  if(win)setTimeout(()=>{if(!$('ov').hidden)konfeti()},(t0+.2)*1000);
  const sonra=fn=>()=>{ses('tik');if(S.kapandi){S.kapandi=false;kapanisKart(fn)}else fn()};
  $('nx').onclick=sonra(()=>startDay(win?S.gun+1:S.gun));$('hm').onclick=sonra(openHome)}
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
function kartSigdir(){const c=$('card'),ov=$('ov');if(ov.hidden)return;c.style.zoom='';const cs=getComputedStyle(ov);
  const H=ov.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom),h=c.offsetHeight;if(h>H)c.style.zoom=Math.max(.7,H/h).toFixed(3)}
function duraklat(){if(!S.on||S.paused||S.bitis)return;S.paused=true;rehberGizle();
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
let last=0,loopNo=0;
function donguBasla(){const no=++loopNo;last=performance.now();
  const f=now=>{if(no!==loopNo||!S.on||S.paused)return;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;adim(dt);requestAnimationFrame(f)};requestAnimationFrame(f)}
function adim(dt){S.now+=dt;if(S.bitis){izgaraAdim(dt);fritozAdim(dt);return}const n=S.cust.filter(Boolean).length;
  if(S.kalan>0){
    if(S.rehber&&n>0){S.nextAt=Math.max(S.nextAt,S.now+1.5)}   // rehberde ilk müşteri bitmeden kimse gelmez
    else if(S.now>=S.nextAt){if(spawn()){const [a,b]=S.cfg.aralik;S.nextAt=S.now+a+Math.random()*(b-a);rehber()}else S.nextAt=S.now+.4}
    if(!n&&S.nextAt-S.now>1.2)S.nextAt=S.now+1.2}
  custAdim(dt);izgaraAdim(dt);fritozAdim(dt)}

/* ================= ana ekran ================= */
const UPI={cook:'ates',pat:'kumsaati',tip:'kese',slot:'izgara'};
function heroFaces(){if(!WHO.length||!window.Musteri)return;const a=WHO[Math.floor(Math.random()*WHO.length)];let b;do{b=WHO[Math.floor(Math.random()*WHO.length)]}while(b===a&&WHO.length>1);
  $('heroA1').innerHTML=golgeli(Musteri.draw(a.m,'happy'));$('heroA2').innerHTML=golgeli(Musteri.draw(b.m,'love'))}
// ana menü: resmin kendi ekmek, köfte, peynir, turşusuyla burger
function heroCiz(){const c=cq()||3.9,h=$('heroB').closest('.hero').clientHeight||40*c,ks=VERI.SIPARIS0.katmanlar,by=burgerYuk(ks);
  const ym=Math.max(14*c,Math.min(28*c,h-14*c)),k=ym/by;
  $('heroB').innerHTML=`<div class="burger hb3" style="width:${BW}px;height:${by}px;transform:scale(${k.toFixed(3)});transform-origin:50% 100%">${burgerHTML(ks)}</div>`;
  $('heroB').style.height=ym+'px';$('heroB').style.width=BW*k+'px';
  // burger kesme tahtasının ortasına oturur (tahta 260×100 birim, üst yüzün ortası y=46; alt ekmeğin altı kutunun 19 birim altı)
  const pl=$('heroB').nextElementSibling;pl.style.width=260*k+'px';pl.style.height=100*k+'px';$('heroB').style.marginBottom=(-65*k)+'px'}
function openHome(){yeniOturum();S.on=false;S.paused=false;S.bitis=false;rehberGizle();FX.innerHTML='';heroFaces();$('ov').hidden=true;$('shop').hidden=true;APP.classList.remove('dukkanda');$('home').hidden=false;document.documentElement.lang=SAVE.lang;
  $('playBtn').innerHTML=ic('oynat')+(SAVE.day>1?t('cont',SAVE.day):t('play'));$('logo2').textContent=t('logo2');
  $('langBtn').innerHTML=ic('dil')+`<span class="${SAVE.lang==='tr'?'on':''}">TR</span><span class="${SAVE.lang==='en'?'on':''}">EN</span>`;$('langBtn').setAttribute('aria-label',t('lang'));
  $('hKasa').textContent=fmt(SAVE.coins);$('hKasaI').innerHTML=PARA();$('hKasaC').classList.toggle('neg',SAVE.coins<0);
  $('hEfekt').innerHTML=ic(SAVE.ayar.efekt?'ses_acik':'ses_kapali');$('hEfekt').classList.toggle('kapali',!SAVE.ayar.efekt);$('hEfekt').setAttribute('aria-label',t('fx'));
  $('hMuzik').innerHTML=ic('muzik');$('hMuzik').classList.toggle('kapali',!SAVE.ayar.muzik);$('hMuzik').setAttribute('aria-label',t('music'));
  const n=alinabilir();
  $('shopBtn').innerHTML=`<span class="si">${ic('dukkan')}</span><span class="st"><b>${t('shop')}</b><small>${t('shopSub')}</small></span>`+(n?`<span class="rz" aria-hidden="true">${n}</span>`:'');
  $('shopBtn').classList.toggle('var',!!n);$('shopBtn').setAttribute('aria-label',t('shop')+(n?' ('+n+')':''));
  cevirYaz();heroCiz()}

/* ================= dükkân ================= */
// Satılanlar (yeni mutfağa göre): resimdeki 2 kilitli ızgara (sırayla; GELISTIR.slot) ve geliştirmeler (cook, pat, tip).
// Eksi kasayla hiçbir şey alınmaz (VERI.alabilir).
const alabilir=f=>VERI.alabilir(SAVE.coins,f);
const UPS=['cook','pat','tip'];
function upDurum(k){const u=VERI.GELISTIR[k],l=SAVE.up[k]|0;return {u,l,mx:l>=u.max,c:u.cost(l)}}
function alinabilir(){let n=0;['slot',...UPS].forEach(k=>{const d=upDurum(k);if(!d.mx&&alabilir(d.c))n++});return n}
const SH={mesgul:false};
// ızgara simgesi: resmin kendisinden (kilitli ya da açık göz)
const IZG_IMG=(acik)=>acik?`<span class="izr" style="background-image:url(${G}izgara-3.webp)"></span>`:`<span class="izr kil">${ic('kilit')}</span>`;
function openShop(){SH.mesgul=false;$('shop').hidden=false;APP.classList.add('dukkanda');FX.innerHTML='';
  $('shT').textContent=t('shop');$('shBack').innerHTML=ic('ev');$('shBack').setAttribute('aria-label',t('home'));
  $('shKasaI').innerHTML=PARA();shopKasa(SAVE.coins);
  const u=$('shUyari');u.hidden=SAVE.coins>=0;u.innerHTML=ic('kira')+`<span>${t('negShop')}</span>`;
  shopListe();$('shList').scrollTop=0}
let shKasaGor=0,shRAF=0;
function shopKasa(v,sure){cancelAnimationFrame(shRAF);const yaz=x=>{$('shKasa').textContent=fmt(x);$('shKasaC').classList.toggle('neg',x<0)};
  if(!sure){shKasaGor=v;yaz(v);return}const a=shKasaGor,t0=performance.now();
  const f=now=>{const u=Math.min(1,(now-t0)/sure),e=1-Math.pow(1-u,3);shKasaGor=Math.round(a+(v-a)*e);yaz(shKasaGor);if(u<1)shRAF=requestAnimationFrame(f)};shRAF=requestAnimationFrame(f)}
function shopListe(){const L=$('shList'),y=L.scrollTop,sl=SAVE.up.slot|0,mxS=VERI.GELISTIR.slot.max;
  // ızgaralar: 3. ve 4. (sırayla)
  let h=`<div class="sh-bas">${t('grills')}</div><div class="ups izg">`;
  for(let j=0;j<mxS;j++){const no=j+3,var_=sl>j,sira=sl===j,c=VERI.GELISTIR.slot.cost(j),ok=sira&&alabilir(c);
    h+=`<button class="up izgk ${var_?'max':sira?(ok?'':'no'):'kilit'}" data-g="${j}" aria-label="${t('grillN',no)}">${IZG_IMG(var_)}<b>${t('grillN',no)}</b><small>${var_?t('owned'):sira?t('grillP'):t('locked')}</small>`+
      `<span class="c">${var_?ic('tik')+t('owned'):sira?PARA()+fmt(c):ic('kilit')+fmt(c)}</span></button>`}
  h+=`</div><div class="sh-bas">${t('upgrades')}</div><div class="ups">`+UPS.map(k=>{const {u,l,mx,c}=upDurum(k);
    return `<button class="up ${mx?'max':!alabilir(c)?'no':''}" data-u="${k}" aria-label="${t('up')[k][0]}"><span class="e">${ic(UPI[k])}</span><b>${t('up')[k][0]}</b><small>${t('up')[k][1]}</small>`+
      `<span class="pips">${Array.from({length:u.max},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')}</span>`+
      `<span class="c">${mx?t('max'):PARA()+fmt(c)}</span></button>`}).join('')+`</div>`;
  L.innerHTML=h;
  L.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>upAl(b.dataset.u,b));
  L.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>+b.dataset.g===(SAVE.up.slot|0)?upAl('slot',b):reddet(b));
  L.scrollTop=y}
function reddet(el){ses('uyari');tit();el.classList.remove('red');void el.offsetWidth;el.classList.add('red')}
function upAl(k,btn){if(SH.mesgul)return false;const {mx,c,l}=upDurum(k);
  if(mx||!alabilir(c)){if(btn)reddet(btn);if(SAVE.coins<0&&btn)uyari(btn,t('negKisa'));return false}
  SAVE.coins-=c;SAVE.up[k]=l+1;save();ses('satin');tit('orta');shopKasa(SAVE.coins,500);shopListe();
  const nb=$('shList').querySelector(k==='slot'?`[data-g="${l}"]`:`[data-u="${k}"]`);if(nb){nb.classList.add('aldi');const r=rel(nb);sac(r.cx,r.cy,[0],8,{yay:9,yuk:-2,cls:'yildizcik',sure:650})}return true}
$('shBack').onclick=()=>{ses('tik');openHome()};
$('shopBtn').onclick=()=>{ses('tik');openShop()};
$('playBtn').onclick=()=>{ses('tik');startDay(SAVE.day)};
$('langBtn').onclick=()=>{SAVE.lang=SAVE.lang==='tr'?'en':'tr';save();ses('tik');openHome()};
$('hEfekt').onclick=()=>{SAVE.ayar.efekt=!SAVE.ayar.efekt;sesAyar();ses('tik');openHome()};
$('hMuzik').onclick=()=>{SAVE.ayar.muzik=!SAVE.ayar.muzik;sesAyar();ses('tik');openHome()};

/* ================= ekran uyumu (yatay) ================= */
// #dunya resmin pikselleriyle (1852×849); tek ölçek s ile ekrana oturur. Dokunulan her şey (ekmek dolabından çiğ patatese,
// müşteri baloncuklarından tepsilere: GEREK dikdörtgeni) güvenli alanın içinde ve olabildiğince büyük; resim ortalanır,
// kenarda kalan yer resmin uzatılmış kenarıyla dolar (g/v3/mutfak.webp). Ölçek hiç bozulmaz.
const GEREK={x0:186,x1:1846,y0:150,y1:784};
function guvenli(){const g=$('guv'),s=getComputedStyle(g);return {l:parseFloat(s.paddingLeft)||0,r:parseFloat(s.paddingRight)||0,t:parseFloat(s.paddingTop)||0,b:parseFloat(s.paddingBottom)||0}}
function fit(){const W=APP.clientWidth,H=APP.clientHeight,g=guvenli();if(!W||!H)return;
  const Wa=W-g.l-g.r,Ha=H-g.t-g.b;
  // resmin tamamı ekran genişliğine sığsın (sol alttaki sipariş ekranı da görünsün), gerekli bölge güvenli alana
  const s=Math.min(Wa/(GEREK.x1-GEREK.x0),Ha/(GEREK.y1-GEREK.y0),W/W0);
  let ox=(W-W0*s)/2,oy=(H-H0*s)/2;
  ox=Math.max(g.l-GEREK.x0*s,Math.min(W-g.r-GEREK.x1*s,ox));   // gerekli bölge güvenli alanda
  oy=Math.max(g.t-GEREK.y0*s,Math.min(H-g.b-GEREK.y1*s,oy));
  // resmin kendisi ekranı dolduruyorsa kenar payı görünmesin (sağ/sol, üst/alt)
  if(W0*s>=W)ox=Math.min(0,Math.max(W-W0*s,ox));if(H0*s>=H)oy=Math.min(0,Math.max(H-H0*s,oy));
  Object.assign(LAY,{s,ox,oy});
  DUNYA.style.transform=`translate(${ox}px,${oy}px) scale(${s})`;APP.style.setProperty('--s',s.toFixed(4))}
const DIK=window.matchMedia?matchMedia('(orientation: portrait)'):{matches:false};
function cevirYaz(){$('cevirT').textContent=t('cevirT');$('cevirP').textContent=t('cevirP')}
function yonKontrol(){if(DIK.matches&&S.on&&!S.paused&&!S.bitis)duraklat()}
addEventListener('resize',()=>{fit();kartSigdir();if(!$('home').hidden)heroCiz();if(S.on)rehber(true);yonKontrol()});
if(DIK.addEventListener)DIK.addEventListener('change',yonKontrol);

/* ================= test kancası ================= */
if(DEBUG)window.__bu={S,SAVE,VERI,LAY,burgerHTML,burgerYuk,KAT,startDay,bitir,adim,openHome,openShop,upAl,alinabilir,save,fit,
  dokun:k=>dokun(k,MK.hit[k]),musteri:i=>S.cust[i]&&musteriDokun(S.cust[i]),hit:k=>MK.hit[k],
  basla:()=>{const g=$('go');if(g)g.click()},durum:()=>({hk:S.hk,hp:S.hp,dogra:S.dogra,fr:{...S.fr},burger:S.burger.slice(),tepsi:S.tepsi.map(x=>({...x})),sec:S.sec,izg:S.izg.map(x=>({...x})),
    cust:S.cust.map(c=>c&&{i:c.i,f:+(c.p/c.max).toFixed(2),ruh:c.ruh,durum:{burger:c.durum.burger,yan:c.durum.yan}}),kasa:S.kasa,can:S.can,bitti:S.bitti,kalan:S.kalan})};
openHome();fit();
})();
