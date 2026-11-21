/* Burger Ustası: oynanış, arayüz, ekranlar (çekirdek). 7. tur: Eymen'in resmi (docs/referans/mutfak-v3-eymen.png).
   Resmin kendisi arka plan (g/v3/mutfak.webp, kenarları uzatılmış); değişen parçalar resimden kırpılmış ya da yamanmış
   (tools/mutfak-v3/hazirla.py), burger katmanları, tahta, tepsi, patates kutusu resmin biçeminde çizilmiş (tools/burger/uret.mjs). Sahne birimi = resmin pikseli (1852×849);
   #dunya bu birimlerde, tek ölçekle (translate + scale) ekrana oturur (fit).
   Akış (Eymen, 21 Kasım): açık ızgaraya dokun → köfte 8 sn pişer, kendiliğinden köfte haznesine uçar (en çok 6).
   Çiğ patatese 10 dokunuş → kendiliğinden fritöze, 15 sn kızarır, dokununca patates haznesine (4 porsiyon); fritöz doluyken
   doğrama yok. Malzemeye dokun → tezgâhtaki tek burgere konur (önce alt ekmek, en son üst ekmek). Biten burgere dokun → tepsiye
   dokun; patates haznesine dokun → tepsiye dokun; tepsiye dokun → müşteriye dokun (tepsi müşteriye gider).
   Modüller: BU.VERI (ekonomi), BU.SIMGE (simgeler), BU.SES (ses). Müşteriler www/musteri.js + karakterler.js.
   Zamanlayıcılar: her gün/ana menü geçişi S.oturum'u artırır; gecikmeli işler (zaman()) eski oturumdaysa çalışmaz.
   9. tur (21 Kasım): gerçek sesler ve müzik (BU.SES, www/ses/), para uçuşu ve akan kasa, görünür seri, doğrama gamı,
   dokunuş tepkisi (ezilme + kırıntı + titreşim), burger kapanınca kısa duraklama; CAN YOK (kaçan müşteri yalnız parasını ve
   seriyi götürür); müşteriler tek hâlli görseller (www/g/karakter/, musteriGorsel); sol alttaki tablet Dükkân'ı açar (oyun durur);
   "Hızlı ızgara" dükkândan kalktı (alınmışsa parası iade).
   10. tur (21 Kasım, docs/SHAWARMA_INCELEME.md): gün SAATLE biter (saat üst bilgide, son 10 sn tik-tak), tezgâhta hep 3 müşteri
   (boşalan yere 3–5 sn'de yenisi), sabır ~50 sn, malzemeler bedava (eksi yazı yok), geç teslimde yalnız bahşiş gider;
   ödeme TEZGÂHA düşer (para yığını), dokununca bozukluklar kasaya uçar; toplanmayan para gün sonunda kendiliğinden kasaya.
   Büyük ödeme anı ("Çok hızlı!", "Seri N!", "Hazırdı!", "İlk satış!"), hazır tepsi parlar (+1 bahşiş), gün sonu kartında
   yıldız = mutlu oranı ve rekorlar; dükkân mutfağın içinde açılır (gri eşya + ipli fiyat etiketi; radyo = sabırlı müşteri,
   kavanoz = cömert bahşiş); sahne boşta da yaşar (#canli: neon, lamba ışığı, salonda silüetler; ızgara/fritöz buharı). */
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
  dayT:n=>`Gün ${n}`,dayP:'Herkes aynı şeyi istiyor: turşulu peynirli burger ve patates. Tezgâhta hep 3 müşteri var; saat bitene kadar sat, parayı tezgâhtan topla.',cust:n=>`${n} müşteri`,start:'Başla',
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
   fryer:'Fritöze dokun: patatesi al',frying:'Patates kızarıyor…',cust:'Müşteriye dokun',para:'Paraya dokun: kasaya at'},
  up:{cook:['Hızlı ızgara','Köfte 0,5 sn, patates 1 sn daha çabuk'],pat:['Sabırlı müşteri','Daha uzun beklerler'],tip:['Cömert bahşiş','Daha çok bahşiş'],slot:['Izgara',n=>`${n}. ızgaranın kilidi açılır`,'4 ızgara açık']},max:'TAM',
  sound:'Ses',lang:'Dil',pause:'Duraklat',lives:'Can',bin:'B',mil:'M',ondalik:',',
  shop:'Dükkân',shopSub:'Izgara ve geliştirme',grills:'Izgaralar',upgrades:'Geliştirmeler',grillN:n=>`${n}. ızgara`,grillP:'Kilit açılır, aynı anda bir köfte daha pişer',
  owned:'Açık',locked:'Önce öncekini aç',negShop:'Kasa ekside: kasa artıya geçene kadar alışveriş yok.',negKisa:'Kasa ekside',
  kira:'Kira',kiraBugun:'Bugünün kirası',easier:'Müşteriler bugün biraz daha sabırlı',easierNext:'Sonraki denemede müşteriler daha sabırlı olacak.',
  closedT:'Dükkân kapandı!',closedP:n=>`Kasa ${n} gün art arda ekside kaldı. 50 parayla yeniden başlıyorsun (ızgaraların ve geliştirmelerin duruyor).`,devam:'Devam',
  cevirT:'Telefonu yan çevir',cevirP:'Burger Ustası yatay ekranda oynanır. Bilgisayarda pencereyi genişlet.',
  eksiUyari:(n,m)=>`Kasa ekside (${n}/${m} gün). ${m} gün art arda eksi kalırsa dükkân kapanır!`,menu:'Menü',price:n=>`${n} para`,
  seri:n=>`Seri ${n}`,hedef:(a,n)=>`${a}: ${n} kaldı`,hedefOk:a=>`${a} alınabilir!`,hedefBitti:'Dükkânda her şey alındı',tabletT:'DÜKKÂN',mutfaga:'Mutfağa dön',
  servis:'Servis',kacan:'Kaçan',upN:(a,n)=>`${a} ${n}`,iade:n=>`"Hızlı ızgara" kalktı: ${n} para kasana geri kondu.`,
  sure:'Günün süresi',kapanis:'Kapanış saati!',hizli:'Çok hızlı!',seriB:n=>`Seri ${n}!`,hazirdi:'Hazırdı!',ilkSatis:'İlk satış!',
  rekorlar:'Bugünün rekorları',enHizli:'En hızlı servis',enSeri:'En uzun seri',yeniRekor:'Yeni rekor!',sn:n=>`${n} sn`,
  iler:n=>`İlerleme %${n}`,dukN:(a,b)=>`Dükkân ${a}/${b}`,sonKar:n=>`Son gün kârı ${n}`,
  dkIp:'Etikete dokun',al:'Satın al',kapat:'Kapat',yetmez:n=>`${n} para daha lazım`,duzey:(a,b)=>`Düzey ${a}/${b}`,kavanoz:'BAHŞİŞ',
  esya:{pat:'Radyo çalar, müşteriler keyifle bekler: sabır +%10',tip:'Bahşiş kavanozu: bahşişler +%25'}},
 en:{day:n=>`Day ${n}`,play:'PLAY',cont:n=>`PLAY · Day ${n}`,logo2:'MASTER',
  dayT:n=>`Day ${n}`,dayP:'Everyone wants the same: a cheeseburger with pickles and fries. Three customers are always waiting; sell until the clock runs out and pick up the money from the counter.',cust:n=>`${n} customers`,start:'Start',
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
   fryer:'Tap the fryer: take the fries',frying:'The fries are frying…',cust:'Tap the customer',para:'Tap the money: into the till'},
  up:{cook:['Fast grill','Patties 0.5 s, fries 1 s quicker'],pat:['Patient customers','They wait longer'],tip:['Big tippers','Bigger tips'],slot:['Grill',n=>`Unlocks grill ${n}`,'All 4 grills open']},max:'MAX',
  sound:'Sound',lang:'Language',pause:'Pause',lives:'Lives',bin:'K',mil:'M',ondalik:'.',
  shop:'Shop',shopSub:'Grills and upgrades',grills:'Grills',upgrades:'Upgrades',grillN:n=>`Grill ${n}`,grillP:'Unlocks it: cook one more patty at a time',
  owned:'Open',locked:'Unlock the previous one first',negShop:'Your cash is below zero: no shopping until it is back above zero.',negKisa:'Cash below zero',
  kira:'Rent',kiraBugun:'Today\'s rent',easier:'Customers are a bit more patient today',easierNext:'Customers will be more patient on the next try.',
  closedT:'Shop closed!',closedP:n=>`Your cash stayed below zero for ${n} days in a row. You start again with 50 coins (you keep your grills and upgrades).`,devam:'Continue',
  cevirT:'Turn your phone sideways',cevirP:'Burger Master is played in landscape. On a computer, make the window wider.',
  eksiUyari:(n,m)=>`Cash below zero (${n}/${m} days). ${m} days in a row below zero and the shop closes!`,menu:'Menu',price:n=>`${n} coins`,
  seri:n=>`Streak ${n}`,hedef:(a,n)=>`${a}: ${n} to go`,hedefOk:a=>`${a} ready to buy!`,hedefBitti:'You bought everything in the shop',tabletT:'SHOP',mutfaga:'Back to the kitchen',
  servis:'Served',kacan:'Missed',upN:(a,n)=>`${a} ${n}`,iade:n=>`"Fast grill" was removed: ${n} coins were put back in your cash.`,
  sure:'Opening hours',kapanis:'Closing time!',hizli:'Super fast!',seriB:n=>`Streak ${n}!`,hazirdi:'Ready and waiting!',ilkSatis:'First sale!',
  rekorlar:'Today\'s records',enHizli:'Fastest service',enSeri:'Longest streak',yeniRekor:'New record!',sn:n=>`${n} s`,
  iler:n=>`Progress ${n}%`,dukN:(a,b)=>`Shop ${a}/${b}`,sonKar:n=>`Last day's profit ${n}`,
  dkIp:'Tap a price tag',al:'Buy',kapat:'Close',yetmez:n=>`You need ${n} more coins`,duzey:(a,b)=>`Level ${a}/${b}`,kavanoz:'TIPS',
  esya:{pat:'A radio plays, customers wait happily: patience +10%',tip:'Tip jar: tips +25%'}}};

/* ================= kayıt ================= */
const KEY='burgerustasi.v1';
const cihazDili=()=>(navigator.language||'tr').toLowerCase().startsWith('tr')?'tr':'en';
// coins eksi olabilir; mal = eski dükkânda alınan malzemeler (yeni mutfakta yeri olmayanlar şimdilik kullanılmaz, kayıtta durur);
// eksi = art arda eksi gün; kolay = {g, n} (art arda kayıpta sabır); seen: 'tut3' = yeni mutfak rehberi görüldü
const SAVE=(()=>{let o={},ham=null;try{ham=localStorage.getItem(KEY);o=JSON.parse(ham)||{}}catch(e){}if(!o||typeof o!=='object'||Array.isArray(o))o={};
  const ilk=!ham||!Object.keys(o).length;
  const d={day:1,coins:ilk?(VERI.BASLANGIC|0||50):0,stars:{},up:{cook:0,pat:0,tip:0,slot:0},lang:cihazDili(),seen:[],ayar:{efekt:true,muzik:true},eksi:0,kolay:{g:0,n:0},yeni:[],rekor:{hiz:0,seri:0},son:null};
  const s=Object.assign({},d,o);s.up=Object.assign({},d.up,o.up&&typeof o.up==='object'?o.up:{});s.ayar=Object.assign({},d.ayar,o.ayar&&typeof o.ayar==='object'?o.ayar:{});
  if(!Array.isArray(s.seen))s.seen=[];if(!s.stars||typeof s.stars!=='object'||Array.isArray(s.stars))s.stars={};
  // geliştirme düzeyleri 0…max (eski kayıtta slot 3–4 = 4 ızgara açık)
  const G=VERI.GELISTIR||{};['cook','pat','tip','slot'].forEach(k=>{const mx=(G[k]&&G[k].max)|0||4;s.up[k]=Math.max(0,Math.min(mx,Math.floor(+s.up[k]||0)))});
  if(s.lang!=='tr'&&s.lang!=='en')s.lang=cihazDili();s.ayar.efekt=s.ayar.efekt!==false;s.ayar.muzik=s.ayar.muzik!==false;
  s.coins=Math.round(+s.coins||0);s.day=Math.max(1,Math.floor(+s.day||1));
  // 9. tur: "Hızlı ızgara" (cook) satılmıyor, etkisi yok; alınmış düzeylerin parası bir kez kasaya geri konur
  if(s.up.cook>0&&VERI.cookIade){const n=VERI.cookIade(s.up.cook);s.coins+=n;s.iade=n;s.up.cook=0}
  if(!Array.isArray(s.mal))s.mal=ilk?[]:(VERI.eskiSahip?VERI.eskiSahip(s.day):[]);
  s.eksi=Math.max(0,Math.floor(+s.eksi||0));
  if(!s.kolay||typeof s.kolay!=='object')s.kolay={g:0,n:0};s.kolay={g:s.kolay.g|0,n:Math.max(0,Math.min(3,s.kolay.n|0))};
  if(!Array.isArray(s.yeni))s.yeni=[];
  // 10. tur: rekorlar (en hızlı servis sn, en uzun seri) ve son günün özeti. Eski kayıtta yok: 0. Kalkan alanlar (malzeme
  // stoku/fiyatı, 'mal') okunur ama kullanılmaz; kayıtta dokunulmadan durur.
  const rk=s.rekor&&typeof s.rekor==='object'?s.rekor:{};s.rekor={hiz:Math.max(0,+rk.hiz||0),seri:Math.max(0,Math.floor(+rk.seri||0))};
  if(!s.son||typeof s.son!=='object')s.son=null;else s.son={gun:s.son.gun|0,net:Math.round(+s.son.net||0),mus:s.son.mus|0};
  return s})();
const save=()=>{try{const o=Object.assign({},SAVE);delete o.iade;localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}};
if(SAVE.iade)save();
const t=(k,...a)=>{const v=T[SAVE.lang][k];return typeof v==='function'?v(...a):v};
const tg=(k,...a)=>{const v=T[SAVE.lang].g[k];return typeof v==='function'?v(...a):v};
function fmt(n){const a=Math.abs(n),s=n<0?'−':'';if(a<100000)return s+a;
  const [b,x]=a<1e6?[1e3,t('bin')]:[1e6,t('mil')];const v=a/b;return s+(v<100?(Math.floor(v*10)/10).toString().replace('.',t('ondalik')):Math.floor(v))+x}

/* ================= ses ve dokunsal ================= */
let sesAcik=false;
function sesKilit(){try{SES.ac()}catch(e){}if(sesAcik)return;sesAcik=true;try{SES.ayar({efekt:SAVE.ayar.efekt,muzik:SAVE.ayar.muzik});SES.muzik(!!SAVE.ayar.muzik)}catch(e){}}
document.addEventListener('pointerdown',sesKilit,{capture:true});
const ses=(ad,o)=>{if(!SAVE.ayar.efekt)return;try{SES.cal(ad,o)}catch(e){}};
// döngüler (ızgara cızırtısı, fritöz): yalnız değişince bildir
const dongu=(()=>{const son={};return(ad,v)=>{v=Math.round(v*100)/100;if(son[ad]===v)return;son[ad]=v;try{SES.dongu&&SES.dongu(ad,v)}catch(e){}}})();
const muzikMod=m=>{try{SES.muzikMod&&SES.muzikMod(m)}catch(e){}};
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
const S={on:false,paused:false,gun:1,cfg:null,kasa:0,kasa0:0,gelir:0,gider:0,bahsis:0,sayi:{mutlu:0,somurtkan:0,kizgin:0},kacan:0,yanlis:0,alis:0,kalan:0,bitti:0,seri:0,
  kolay:0,kira:0,kapandi:false,cust:[null,null,null],slotT:[0,0,0],now:0,rehber:false,bitis:false,bitisT:0,oturum:0,yildiz:0,
  // 10. tur: saat (kalan sn), tezgâhtaki para yığınları (yer başına {u ücret, b bahşiş, el}), gelen müşteri, rekorlar
  saat:0,sure:0,gelen:0,tezgah:0,yig:[null,null,null],enHizli:0,enSeri:0,
  // mutfak
  izg:[],hk:0,hkUcan:0,hp:0,dogra:0,fr:{st:0,t:0,kalan:0},burger:[],tepsi:[{b:null,f:false},{b:null,f:false}],sec:null,mesgul:{}};
// müşteriler: 20 karakter görseli (Eymen, yeşil ekrandan: tools/karakter/yesil.py → g/karakter/NN.webp, liste js/karakter.js).
// Tek hâl: kızgın/sabırsız/üzgün yüz yok. Karakter çizimi TEK YERDEN: musteriGorsel(m) (ileride görsel değişirse yalnız burası).
const WHO=BU.KARAKTER||[];
const KAR_OLCEK=.62;   // görsel pikseli → sahne birimi (baş ~95 birim: masaların önünde doğru boyda; docs/inceleme/v5)
function pickWho(){if(!WHO.length)return null;const busy=S.cust.filter(Boolean).map(c=>c.who);let k,n=0;do{k=WHO[Math.floor(Math.random()*WHO.length)];n++}while(busy.includes(k)&&n<20);return k}
function musteriSrc(m){return `g/karakter/${String(m.no).padStart(2,'0')}.webp`}
// tam boy (sahnede, sahne biriminde) ya da 'bas' (kartlarda küçük: baş ve omuzlar)
function musteriGorsel(m,tur){if(!m)return '';
  if(tur==='bas')return `<i class="kb" style="background-image:url(${musteriSrc(m)})"></i>`;
  return `<img class="kg" src="${musteriSrc(m)}" alt="" draggable="false">`}

/* ================= üst bilgi ================= */
let kasaGor=0,kasaRAF=0,bekle=0;
function kasaYaz(v){$('kasa').textContent=fmt(v);$('kasaC').classList.toggle('neg',v<0)}
function kasaPop(){const k=$('kasaC');k.classList.remove('pop');void k.offsetWidth;k.classList.add('pop')}
function kasaHedef(v,{sessiz=false,sure=350}={}){cancelAnimationFrame(kasaRAF);
  if(sessiz||v===kasaGor||!S.on){kasaGor=v;kasaYaz(v);return}
  const a=kasaGor,t0=performance.now();kasaPop();
  const f=now=>{const u=Math.min(1,(now-t0)/sure),e=1-Math.pow(1-u,3);kasaGor=Math.round(a+(v-a)*e);kasaYaz(kasaGor);if(u<1)kasaRAF=requestAnimationFrame(f)};kasaRAF=requestAnimationFrame(f)}
// kasada görünen: gerçek kasa − uçmakta olan bozukluklar − tezgâhta toplanmamış para
const kasaGorunen=()=>S.kasa-bekle-S.tezgah;
function hud(o={}){kasaHedef(kasaGorunen(),o);
  $('gunT').textContent=t('day',S.gun);saatCiz();
  seriCiz();hedefCiz($('hedefC'),kasaGorunen())}
// saat (10. tur): gün kutusunda kırmızı yedi parçalı rakamlar (fritöz göstergesiyle aynı biçem), altında geçen zaman çubuğu.
// Rehber sürerken saat durur (tam süreyi gösterir). Son 10 sn kutu kızarır ve tik-tak.
function saatCiz(){const v=S.rehber?S.sure:Math.max(0,Math.ceil(S.saat)),m=Math.floor(v/60),sn=v%60,key=v+'|'+(S.rehber?1:0);
  $('prog').style.width=(S.sure?100*(1-S.saat/S.sure):0).toFixed(1)+'%';
  const C=$('gunC');C.classList.toggle('son',!S.rehber&&v>0&&v<=10&&S.on);C.classList.toggle('bitti',S.on&&!S.rehber&&v<=0);
  const el=$('saatS');if(el.dataset.k===key)return;el.dataset.k=key;
  el.innerHTML=rakam(String(m),4)+'<rect x="20" y="13" width="3.4" height="3.4" rx="1" class="on"/><rect x="20" y="23.6" width="3.4" height="3.4" rx="1" class="on"/>'+rakam(String(Math.floor(sn/10)),28)+rakam(String(sn%10),45)}
const sureYaz=v=>`${Math.floor(v/60)}:${String(v%60).padStart(2,'0')}`;
// görünür seri: art arda bahşişli (mutlu) servis; 3'ten sonra rozet. Müşteri giderse sessizce söner.
let seriGor=0;
function seriCiz(){const el=$('seriC'),n=S.seri|0;if(!el)return;
  if(n>=3){el.hidden=false;el.classList.remove('sondu');$('seriT').textContent=t('seri',n);if(n!==seriGor){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}}
  else if(!el.hidden&&!el.classList.contains('sondu')){el.classList.add('sondu');setTimeout(()=>{if(el.classList.contains('sondu'))el.hidden=true},400)}
  seriGor=n}
// sıradaki hedef: dükkânda en ucuz alınmamış öğe ("3. ızgara: 120 kaldı"); kasa yetince "alınabilir"
function sonrakiHedef(){let en=null;VERI.SATILIK.forEach(k=>{const d=upDurum(k);if(!d.mx&&(!en||d.c<en.c))en={k,c:d.c,l:d.l}});return en}
function hedefAd(h){return h.k==='slot'?t('grillN',h.l+3):t('upN',t('up')[h.k][0],h.l+1)}
function hedefCiz(el,kasa){if(!el)return;const h=sonrakiHedef();
  const ik=h?(h.k==='slot'?'izgara':UPI[h.k]):'yildiz',ok=h&&kasa>=h.c&&kasa>=0,f=h?Math.max(0,Math.min(1,kasa/h.c)):1;
  const txt=!h?t('hedefBitti'):ok?t('hedefOk',hedefAd(h)):t('hedef',hedefAd(h),fmt(h.c-Math.max(0,kasa)));
  if(el.dataset.ik!==ik){el.dataset.ik=ik;el.querySelector('.i').innerHTML=ic(ik)}
  el.querySelector('.ht').textContent=txt;el.querySelector('.prog b').style.width=(f*100).toFixed(1)+'%';el.classList.toggle('ok',!!ok)}
function sesBtn(){const on=SAVE.ayar.efekt||SAVE.ayar.muzik;$('sesBtn').innerHTML=ic(on?'ses_acik':'ses_kapali');$('sesBtn').setAttribute('aria-label',t('sound'))}
$('sesBtn').onclick=()=>{const on=SAVE.ayar.efekt||SAVE.ayar.muzik;SAVE.ayar.efekt=SAVE.ayar.muzik=!on;sesAyar();sesBtn();ses('tik')};

/* ================= para efektleri ================= */
// para anı: bozukluklar müşteriden kasa rozetine TEK TEK uçar (ücret 3–5, bahşiş 1–2 parlak sikke); her biri varınca şıngırdar,
// rozet zıplar ve kasa sayısı o sikkenin payı kadar AKARAK artar (ara değerler tam sayı, sonunda tam doğru).
function paraYagdir(from,ucret,bah,gec){const o=S.oturum,miktar=ucret+bah;if(miktar<=0)return;
  const n1=ucret>0?Math.max(3,Math.min(5,Math.round(ucret/12)+1)):0,n2=bah>0?(bah>=8?2:1):0,n=n1+n2;
  const pay=[];for(let i=0;i<n1;i++)pay.push(Math.floor(ucret/n1)+(i<ucret%n1?1:0));for(let i=0;i<n2;i++)pay.push(Math.floor(bah/n2)+(i<bah%n2?1:0));
  bekle+=miktar;
  zaman(()=>{const k=rel($('kasaI'));
    for(let i=0;i<n;i++)zaman(()=>{const ox=(Math.random()-.5)*6*cq(),oy=(Math.random()-.5)*4*cq(),bh=i>=n1;
      ucur(bh?ic('para','parlak'):PARA(),{x:from.x+ox,y:from.y+oy},{x:k.cx,y:k.cy},{sure:430+i*25,yay:-9-Math.random()*6,s0:bh?1.15:1,s1:.72,don:220,cls:'sikke'+(bh?' bah':''),easing:'cubic-bezier(.5,0,.7,1)'}).then(()=>{
        if(o!==S.oturum)return;bekle=Math.max(0,bekle-pay[i]);hud({sure:260});
        ses('para',{perde:bh?4:(i%3)*.5,ust:true,ses:bh?.9:.75});kasaPop();tit();
        const c=$('kasaC');c.classList.add('tik');setTimeout(()=>c.classList.remove('tik'),90)})},i*95)},gec)}
function parilti(x,y,gec){zaman(()=>sac(x,y,[0],8,{yay:9,yuk:-2,cls:'yildizcik',sure:700}),gec)}
/* ================= tezgâhtaki para (10. tur, Eymen: S4) ================= */
// Ödeme müşterinin önüne, arka tezgâhın üstüne düşer (bozukluk ve kâğıt para yığını). Oyuncu dokununca bozukluklar kasaya
// uçar (paraYagdir), şıngırdar, kasa akarak artar. Toplanmayan para kaybolmaz: gün sonunda kendiliğinden kasaya girer.
// Yığının dokunma alanı 150×150 birim (iPhone SE'de ≥ 44 pt). Müşterinin gövdesinin altını örter; tepsi seçiliyken oraya
// dokunmak o yerdeki müşteriye teslim eder, böylece yeni gelen müşterinin yeri engellenmez.
const YIG_Y=318,yigX=i=>MUS_X[i]-34;
const SIKKE='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 17v6a15 7 0 0 0 30 0v-6" fill="#d8960c" stroke="#2a1a10" stroke-width="3"/><ellipse cx="20" cy="17" rx="15" ry="7" fill="#ffc21a" stroke="#2a1a10" stroke-width="3"/><ellipse cx="16" cy="15.5" rx="6" ry="2.2" fill="#fff6c0" opacity=".85"/></svg>';
function yiginSVG(u,b){const m=u+b,n=Math.min(10,2+Math.floor(m/9)),nb=b?Math.min(2,1+Math.floor(b/8)):0,kn=u>0?Math.min(3,1+Math.floor(u/40)):0;let h='';
  // kâğıt para (ücret): yeşil banknotlar, altta
  for(let j=0;j<kn;j++)h+=`<g transform="translate(${18+j*9} ${54-j*6}) rotate(${-7+j*8} 35 15)"><rect width="70" height="30" rx="4" fill="#86d270" stroke="#2a1a10" stroke-width="3.5"/><rect x="6" y="5" width="58" height="20" rx="3" fill="none" stroke="#3d8a34" stroke-width="2"/><circle cx="35" cy="15" r="7" fill="#c4efb4" stroke="#3d8a34" stroke-width="2"/></g>`;
  // bozukluklar üç sütunda üst üste; bahşiş sikkeleri en üstte ve parlak
  const st=[[34,78],[66,82],[98,76]];
  for(let k=0;k<n;k++){const [x,y0]=st[k%3],yy=y0-Math.floor(k/3)*8,bh=k>=n-nb;
    h+=`<g transform="translate(${x} ${yy})"><path d="M-14 0v5a14 5.5 0 0 0 28 0v-5" fill="${bh?'#f0a01a':'#d8960c'}" stroke="#2a1a10" stroke-width="2.8"/><ellipse rx="14" ry="5.5" fill="${bh?'#fff07a':'#ffc21a'}" stroke="#2a1a10" stroke-width="2.8"/><ellipse cx="-3" cy="-1" rx="6" ry="2" fill="#fff6c0" opacity=".85"/></g>`}
  return `<svg viewBox="0 0 140 92" aria-hidden="true">${h}<path class="pr" d="M114 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff8c8"/></svg>`}
function yiginEkle(i,u,b,gec){const m=u+b;if(m<=0)return;S.tezgah+=m;const o=S.oturum;
  const y=S.yig[i]||(S.yig[i]={u:0,b:0,el:null});y.u+=u;y.b+=b;
  // bozukluklar müşteriden tezgâha düşer (uçuşta ses yok; düşünce şıngırdar)
  zaman(()=>{const n=Math.min(5,2+Math.floor(m/15));
    for(let j=0;j<n;j++)setTimeout(()=>{if(o!==S.oturum)return;
      ucW(SIKKE,{x:MUS_X[i]+(Math.random()-.5)*50,y:205},{x:yigX(i)+(Math.random()-.5)*60,y:YIG_Y-28},{w:40,h:40,sure:330,yay:-60,s0:1.1,s1:1,don:200,cls:'cn',easing:'cubic-bezier(.5,0,.8,1)'}).then(()=>{
        if(o!==S.oturum)return;if(j===0||!S.yig[i]||!S.yig[i].el)yiginCiz(i,true);ses('para',{perde:-4+j,ses:.4,ust:true})})},j*70)},gec)}
function yiginCiz(i,buyu){const y=S.yig[i];if(!y)return;let el=y.el;
  if(!el){el=y.el=document.createElement('div');el.className='hit yigin';el.dataset.h='yig'+i;
    Object.assign(el.style,{left:(yigX(i)-75)+'px',top:(YIG_Y-150)+'px',width:'150px',height:'150px'});
    el.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();yiginDokun(i)});$('paraK').appendChild(el)}
  el.innerHTML=`<div class="yg">${yiginSVG(y.u,y.b)}</div><span class="ym">+${fmt(y.u+y.b)}</span>`;
  if(buyu){el.classList.remove('buyu');void el.offsetWidth;el.classList.add('buyu')}
  rehber()}
// yığına dokun: tepsi seçiliyse ve o yerde müşteri varsa teslim; yoksa para toplanır
function yiginDokun(i){if(!aktif())return;const c=S.cust[i];
  if(c&&S.sec&&S.sec.startsWith('tepsi')){musteriDokun(c);return}
  basTepkiEl(S.yig[i]&&S.yig[i].el);topla(i)}
function basTepkiEl(el){const g=el&&el.querySelector('.yg');if(g)ezAnim(g,160)}
function topla(i,{aninda=false}={}){const y=S.yig[i];if(!y)return false;S.yig[i]=null;const m=y.u+y.b;S.tezgah=Math.max(0,S.tezgah-m);
  const el=y.el;let from;
  if(el){const r=rel(el.querySelector('.yg')||el);from={x:r.cx,y:r.cy};el.classList.add('git');el.style.pointerEvents='none';setTimeout(()=>el.remove(),340)}
  else from=ekr(yigX(i),YIG_Y-40);
  if(aninda){hud({sessiz:true});return true}
  paraYagdir(from,y.u,y.b,0);tit();
  if(!SAVE.seen.includes('para')){SAVE.seen.push('para');save()}
  rehber();return true}
// bütün yığınlar (gün sonu, dükkân): sırayla uçar ya da anında kasaya
function toplaHepsi(o={}){let n=0;[0,1,2].forEach(i=>{if(!S.yig[i])return;if(o.aninda)topla(i,o);else{zaman(()=>topla(i),n*160)}n++});return n}
// ilk satış (P11): bozukluk yağmuru ve jingle
function ilkKutlama(gec){zaman(()=>{ses('satin');tit('orta');konfeti(FX)},gec+250)}
function damga(c,metin,gec){zaman(()=>{const r=rel(c.yuzEl);const d=fxEl('damga',ic('carpi')+`<span>${metin}</span>`,r.cx,r.y+r.h*.35);setTimeout(()=>d.remove(),1400);
  },gec)}   // ekran sallanması yok (Eymen, 9. tur)

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
  fritoz:[1440,282,262,330],cig:[1702,440,150,175],tezgah:[372,620,272,160],tepsi0:[694,620,300,170],tepsi1:[1000,620,300,170],
  tablet:[34,600,300,190]};   // 9. tur: sol alttaki tablet Dükkân'ı açar (sağ kısmı güvenli alanda, ≥ 44 pt)
// basılınca ezilen görsel (resmin kendi parçası kırpılır, ya da üstteki parça): dokunuş tepkisi (ezVis)
const VIS={ekmekUst:[205,335,330,85],ekmekAlt:[205,445,330,75],izg0:[596,333,202,120],izg1:[800,333,202,120],izg2:[583,458,208,135],izg3:[801,458,208,135],
  kofte:[1015,338,198,118],peynir:[1213,338,195,118],tursu:[1022,458,205,138],patates:[1238,458,222,138],fritoz:[1435,283,282,310],cig:[1722,462,112,140],tablet:[34,615,192,167]};
// basınca saçılan kırıntı renkleri (3–6 parça)
const KIR={ekmekUst:['#f2b25a','#fbe0a4','#d98a2e'],ekmekAlt:['#f6d79a','#fff0c8','#e8b468'],kofte:['#7a3a1c','#a8572c','#5a2810'],peynir:['#ffcf3a','#ffe27a','#f2a91a'],
  tursu:['#8cbf3a','#b8dc5a','#5f8f22'],patates:['#ffd36a','#fff0b0','#f2b233'],fritoz:['#ffd36a','#fff0b0'],cig:['#e7c48a','#c9a064','#f6e2b4'],izg:['#ffb347','#ff7a1a','#ffe08a'],
  tezgah:['#f2b25a','#7a3a1c'],tepsi:['#fff4dc','#e2c9a0'],tablet:['#ffb84a','#ffd27a']};
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
  h.push(`<div class="buhar" id="frBuh" style="left:1500px;top:280px;width:150px;height:90px"><i></i><i></i><i></i></div>`);
  // P7: açık ızgaralardan pişmese de hafif sıcak hava/duman
  IZG.forEach((g,i)=>h.push(`<div class="isi" id="isi${i}" style="left:${g.x-80}px;top:${g.y-110}px" hidden><i></i><i></i></div>`));
  // dükkân eşyaları (10. tur, P6): radyo = sabırlı müşteri, bahşiş kavanozu = cömert bahşiş (alınmamışsa yalnız dükkân kipinde, gri)
  h.push(`<div class="esya radyo" id="esPat" style="left:${ESYA.pat[0]}px;top:${ESYA.pat[1]}px;width:${ESYA.pat[2]}px;height:${ESYA.pat[3]}px">${RADYO}<div class="nota"><i></i><i></i><i></i></div></div>`);
  h.push(`<div class="esya kavanoz" id="esTip" style="left:${ESYA.tip[0]}px;top:${ESYA.tip[1]}px;width:${ESYA.tip[2]}px;height:${ESYA.tip[3]}px"></div>`);
  h.push(img('gosterge-bos',P.gosterge,'p" id="gstB'));
  h.push(`<svg class="rakam" id="gst" viewBox="0 0 57 41" style="left:${P.gosterge[0]}px;top:${P.gosterge[1]}px;width:${P.gosterge[2]}px;height:${P.gosterge[3]}px"></svg>`);
  h.push(`<i class="led kir" id="ledK" style="left:1520px;top:527px"></i><i class="led yes" id="ledY" style="left:1520px;top:558px"></i>`);
  // doğrama: yığından alınan patates (her dokunuşta küçülür) ve yanında biriken dilimler
  h.push(`<div class="dpat" id="dPat" style="left:${CIG.x-62}px;top:${CIG.y+38}px" hidden>${PATATES}</div><div class="dilimler" id="dDil" style="left:${CIG.x-150}px;top:${CIG.y+78}px"></div>`);
  // doğrama çubuğu (çiğ patateslerin üstünde)
  h.push(`<div class="dogra" id="dgr" style="left:1722px;top:440px;width:116px;height:18px" hidden>${Array.from({length:M.dograma},()=>'<i></i>').join('')}</div>`);
  // sipariş ekranı (askılı tablet): sağ yarısı oyunda yazılır
  h.push(img('tablet-bos',P.tablet,'p" id="tbB'));
  h.push(`<svg class="neon" id="tbN" viewBox="0 0 80 80" style="left:120px;top:637px;width:86px;height:86px"></svg>`);
  h.push(`<div class="tbrz" id="tbRz" style="left:178px;top:612px" hidden></div>`);
  // tezgâh: hazırlık yeri (tahta) ve iki tepsi
  h.push(`<img class="tahta" src="${G}tahta.webp" alt="" style="left:${TEZGAH.x-130}px;top:${TEZGAH.y-51}px;width:260px;height:100px">`);
  h.push(`<div class="burger" id="brg" style="left:${TEZGAH.x-BW/2}px;top:${TEZGAH.y-200+14}px;width:${BW}px;height:200px"></div>`);
  TEPSI.forEach((p,i)=>h.push(`<div class="tepsi" id="tp${i}" style="left:${p.x-135}px;top:${p.y-56}px;width:270px;height:112px"><img class="tp" src="${G}tepsi.webp" alt=""><div class="ic-b"></div><div class="ic-f"></div></div>`));
  // dokunma alanları
  Object.entries(HIT).forEach(([k,r])=>h.push(`<div class="hit" data-h="${k}" style="left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px"></div>`));
  $('parca').innerHTML=h.join('');
  MK={kvK:$('kvK'),kvP:$('kvP'),iz:[null,null,$('iz3'),$('iz4')],gk:[0,1,2,3].map(i=>$('gk'+i)),hl:[0,1,2,3].map(i=>$('hl'+i)),
    frPis:$('frPis'),frHaz:$('frHaz'),frKab:$('frKab'),frBuh:$('frBuh'),gst:$('gst'),ledK:$('ledK'),ledY:$('ledY'),dgr:$('dgr'),tbN:$('tbN'),
    brg:$('brg'),tp:[$('tp0'),$('tp1')],hit:{},dPat:$('dPat'),dDil:$('dDil'),tbRz:$('tbRz'),tahta:document.querySelector('#parca .tahta'),
    isi:[0,1,2,3].map(i=>$('isi'+i)),esPat:$('esPat'),esTip:$('esTip')};
  document.querySelectorAll('#parca .hit').forEach(el=>{MK.hit[el.dataset.h]=el;el.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();if(aktif())basTepki(el.dataset.h);dokun(el.dataset.h,el)})});
  MUSK.innerHTML='';BALON.innerHTML='';WFX.innerHTML='';$('ezK').innerHTML='';$('paraK').innerHTML='';$('dkK').innerHTML='';canliKur()}
// dükkân eşyaları (10. tur, P6): ön tezgâhın sağında, resmin biçeminde (kalın koyu kontur, sıcak renkler)
const ESYA={pat:[1500,574,190,116],tip:[1338,546,120,144]};
const RADYO='<svg viewBox="0 0 190 116" aria-hidden="true"><path d="M150 26L172 2" stroke="#2a1a10" stroke-width="5" stroke-linecap="round"/><circle cx="172" cy="3" r="4.5" fill="#ffc21a" stroke="#2a1a10" stroke-width="3"/>'+
  '<path d="M58 28V14q0-7 7-7h60q7 0 7 7v14" fill="none" stroke="#2a1a10" stroke-width="7"/><path d="M58 28V14q0-7 7-7h60q7 0 7 7v14" fill="none" stroke="#a8572c" stroke-width="3"/>'+
  '<rect x="6" y="26" width="178" height="84" rx="16" fill="#d9532c" stroke="#2a1a10" stroke-width="5.5"/><path d="M16 36h158" stroke="#f08a5a" stroke-width="4" stroke-linecap="round" opacity=".8"/>'+
  '<circle cx="54" cy="70" r="29" fill="#3a1d0c" stroke="#2a1a10" stroke-width="4"/>'+[[-14,-12],[0,-15],[14,-12],[-18,0],[-6,0],[6,0],[18,0],[-14,12],[0,15],[14,12]].map(([x,y])=>`<circle cx="${54+x}" cy="${70+y}" r="3.2" fill="#8a4a24"/>`).join('')+
  '<rect x="98" y="44" width="72" height="30" rx="6" fill="#fff4dc" stroke="#2a1a10" stroke-width="4"/>'+[0,1,2,3,4,5,6].map(i=>`<path d="M${106+i*9} 50v${i%2?8:12}" stroke="#a8572c" stroke-width="2"/>`).join('')+'<path class="ign" d="M128 46v26" stroke="#d2281e" stroke-width="3"/>'+
  [0,1,2,3].map(i=>`<rect class="lv" x="${104+i*15}" y="84" width="11" height="8" rx="2"/>`).join('')+'<circle cx="160" cy="98" r="6" fill="#ffc21a" stroke="#2a1a10" stroke-width="3"/></svg>';
function kavanozSVG(l){let c='';const n=[0,4,8,12,16][Math.max(0,Math.min(4,l|0))];
  for(let k=0;k<n;k++){const x=28+(k%4)*21+(Math.floor(k/4)%2)*9,y=126-Math.floor(k/4)*11;c+=`<g transform="translate(${x} ${y})"><path d="M-10 0v4a10 4 0 0 0 20 0v-4" fill="#d8960c" stroke="#2a1a10" stroke-width="2.2"/><ellipse rx="10" ry="4" fill="#ffc21a" stroke="#2a1a10" stroke-width="2.2"/></g>`}
  return `<svg viewBox="0 0 120 144" aria-hidden="true"><path d="M20 30q-8 6-8 18v76q0 14 14 14h68q14 0 14-14V48q0-12-8-18z" fill="rgba(200,232,240,.35)" stroke="#2a1a10" stroke-width="5"/>${c}`+
    `<path d="M22 50v70" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/><rect x="16" y="14" width="88" height="20" rx="6" fill="#b5651d" stroke="#2a1a10" stroke-width="5"/>`+
    `<rect x="18" y="62" width="84" height="26" rx="5" fill="#fff4dc" stroke="#2a1a10" stroke-width="3.5"/><text x="60" y="81.5" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="900" font-size="17" fill="#8d140e">${t('kavanoz')}</text></svg>`}
function esyaCiz(){if(!MK.esPat)return;const lp=SAVE.up.pat|0,lt=SAVE.up.tip|0;
  MK.esPat.classList.toggle('yok',!lp);MK.esPat.querySelectorAll('.lv').forEach((x,i)=>x.classList.toggle('on',i<lp));
  const k=lt+'|'+SAVE.lang;if(MK.esTip.dataset.k!==k){MK.esTip.dataset.k=k;MK.esTip.innerHTML=kavanozSVG(lt)}MK.esTip.classList.toggle('yok',!lt)}
// sahne boşta da yaşar (10. tur, P7): neon tabela ara sıra titrer (resmin kendi pikselleri, parlaklıkla), lambaların ışığı
// hafifçe dalgalanır, arka salonda masalarda oturan silüetler arada kıpırdar. Hepsi CSS animasyonu; bir kez kurulur.
const NEON=[1000,16,226,178];
const LAMBA=[[480,120,300,170],[1360,110,300,170],[930,118,160,96],[1770,160,160,96]];
const SIL=[{x:857,s:1,d:0,v:0},{x:1127,s:.92,d:-3.1,v:1},{x:1428,s:1,d:-5.2,v:1},{x:1736,s:1.06,d:-1.7,v:0}];
const SILUET=v=>`<svg viewBox="0 0 120 104" aria-hidden="true"><g class="gv"><path d="M14 104q2-40 46-42q44 2 46 42z"/><g class="bs"><ellipse cx="60" cy="38" rx="21" ry="24"/>`+
  (v?'<path d="M37 34q2-26 24-26q24 1 23 30q-6-14-24-14q-14 0-23 10z"/>':'<path d="M38 30q4-22 22-22q20 0 22 22q-10-8-22-8q-12 0-22 8z"/>')+`</g><g class="kl"><path d="M92 70q16 6 16 30h-14q0-16-8-20z"/><rect x="96" y="56" width="14" height="16" rx="3"/></g></g></svg>`;
function canliKur(){const c=$('canli');if(!c||c.dataset.ok)return;c.dataset.ok='1';
  let h=`<div class="neonP" style="left:${NEON[0]}px;top:${NEON[1]}px;width:${NEON[2]}px;height:${NEON[3]}px;background-position:${-NEON[0]-240}px ${-NEON[1]-380}px"></div>`;
  LAMBA.forEach(([x,y,w,hh],i)=>{h+=`<i class="lisik" style="left:${x-w/2}px;top:${y-hh/2}px;width:${w}px;height:${hh}px;animation-delay:${(-i*1.7).toFixed(1)}s"></i>`});
  SIL.forEach(o=>{h+=`<div class="sil" style="left:${o.x-60*o.s}px;top:${262-104*o.s}px;width:${120*o.s}px;height:${104*o.s}px;--d:${o.d}s">${SILUET(o.v)}</div>`});
  c.innerHTML=h}
// doğramada yığından alınan patates (resmin biçeminde: kalın koyu kontur, sıcak vurgu)
const PATATES='<svg viewBox="0 0 124 90" aria-hidden="true"><path d="M14 52C8 30 30 10 62 11C96 12 118 28 114 50C110 74 86 84 58 82C32 80 18 70 14 52Z" fill="#d9a35a" stroke="#3a1d0c" stroke-width="5" stroke-linejoin="round"/>'+
  '<path d="M26 40C32 24 52 18 70 19" fill="none" stroke="#f3d08e" stroke-width="6" stroke-linecap="round" opacity=".85"/><path d="M20 58C34 74 70 78 98 64" fill="none" stroke="#a8702e" stroke-width="5" stroke-linecap="round" opacity=".55"/>'+
  '<circle cx="44" cy="46" r="3" fill="#8a5a24"/><circle cx="78" cy="36" r="2.6" fill="#8a5a24"/><circle cx="88" cy="58" r="3.2" fill="#8a5a24"/><circle cx="58" cy="64" r="2.4" fill="#8a5a24"/></svg>';
// dokunuş tepkisi (60 ms kuralı): basıldığı anda nesne %7 ezilir ve hafifçe taşarak toparlanır, 3–6 kırıntı saçılır.
// Resmin parçası (ekmek dolabı, hazne, ızgara, fritöz) kırpılıp ezilir; üstünde duran parça (köfte, kuvet, burger, tepsi) da birlikte.
const EZ=[{transform:'scale(1,1)'},{transform:'scale(1.05,.93)',offset:.3},{transform:'scale(.98,1.03)',offset:.65},{transform:'scale(1,1)'}];
function ezAnim(el,sure=180){if(!el||el.hidden)return;try{el.animate(EZ,{duration:sure,easing:'ease-out'})}catch(e){}}
function basTepki(k){const v=VIS[k];
  if(v){const d=document.createElement('div');d.className='ez';Object.assign(d.style,{left:v[0]+'px',top:v[1]+'px',width:v[2]+'px',height:v[3]+'px',backgroundPosition:`${-v[0]-240}px ${-v[1]-380}px`});
    $('ezK').appendChild(d);ezAnim(d);setTimeout(()=>d.remove(),220)}
  const ust={kofte:[MK.kvK],patates:[MK.kvP,$('patSec')],fritoz:[MK.frPis,MK.frHaz,MK.frKab],cig:[MK.dPat],tablet:[MK.tbN],tezgah:[MK.brg,MK.tahta],tepsi0:[MK.tp[0]],tepsi1:[MK.tp[1]]}[k]||[];
  if(k.startsWith('izg')){const i=+k[3];ust.push(MK.gk[i],MK.iz[i])}
  ust.forEach(el=>ezAnim(el));
  const r=v||HIT[k],renk=KIR[k]||KIR[k.replace(/\d$/,'')]||(k.startsWith('izg')?KIR.izg:null);
  if(r&&renk)kirinti(r[0]+r[2]/2,r[1]+r[3]*.35,renk,3+Math.floor(Math.random()*3),34)}
// burger kapanınca kısa duraklama (hit-stop, 70 ms): yalnız görsel animasyonlar durur, zamanlayıcılar (sabır, ızgara, fritöz) sürer
function hitStop(ms,sonra){let a=[];try{a=DUNYA.getAnimations({subtree:true}).filter(x=>x.playState==='running');a.forEach(x=>x.pause())}catch(e){}
  setTimeout(()=>{a.forEach(x=>{try{x.play()}catch(e){}});sonra&&sonra()},ms)}
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
  el.classList.toggle('sec',S.sec==='tepsi'+i);el.classList.toggle('dolu',!!(tp.b||tp.f));el.classList.toggle('hazir',!!(tp.b&&tp.f===true));   // P8: tam menü hafifçe parlar
  if(yeni){el.classList.remove('kon');void el.offsetWidth;el.classList.add('kon')}}
// sol alttaki tablet (9. tur): Dükkân'ı açar. Ekranında neon tente + "DÜKKÂN"; şu an alınabilecek öğe sayısı rozette.
// (Siparişler müşteri baloncuklarında görünüyor; tablet artık sipariş göstermiyor.)
function tabletCiz(){const n=S.on?alinabilir(S.kasa):0,key=n+SAVE.lang;if(MK.tbN.dataset.k===key)return;MK.tbN.dataset.k=key;
  MK.tbN.innerHTML='<g class="nn"><path d="M10 26h60l-6-14H16z"/><path d="M22 12l-3 14M34 12l-1 14M46 12l1 14M58 12l3 14"/><path d="M14 30v20h52V30"/><path d="M33 50V38h14v12"/></g>'+
    `<text x="40" y="72" text-anchor="middle" class="nt tk">${t('tabletT')}</text>`;
  MK.tbRz.hidden=!n;MK.tbRz.textContent=n}
// fritöz göstergesi: kırmızı yedi parçalı rakamlar
const SEG={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgedc',7:'abc',8:'abcdefg',9:'abcdfg'};
function rakam(ch,x){const s=SEG[ch]||'',w=11,hh=26,y=7,t=3;const p={a:[x,y,w,t],g:[x,y+hh/2-t/2,w,t],d:[x,y+hh-t,w,t],f:[x-1,y,t,hh/2],b:[x+w-t+1,y,t,hh/2],e:[x-1,y+hh/2,t,hh/2],c:[x+w-t+1,y+hh/2,t,hh/2]};
  return Object.keys(p).map(k=>{const r=p[k];return `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" rx="1.3" class="${s.includes(k)?'on':'off'}"/>`}).join('')}
function gostergeCiz(){let v=0;if(S.fr.st===1)v=Math.ceil(Math.max(0,S.fr.t));
  const s=String(Math.min(99,v)),key=s+S.fr.st;if(MK.gst.dataset.k===key)return;MK.gst.dataset.k=key;
  MK.gst.innerHTML=(s.length>1?rakam(s[0],15):'')+rakam(s[s.length-1],s.length>1?31:23);
  MK.ledK.classList.toggle('on',S.fr.st===1);MK.ledY.classList.toggle('on',S.fr.st===2)}
function fritozCiz(){const f=S.fr;MK.frPis.hidden=f.st!==1;MK.frHaz.hidden=f.st!==2;MK.frKab.hidden=f.st!==1;MK.frBuh.classList.toggle('hafif',f.st===0);   // P7: boşken de hafif buhar
  MK.hit.fritoz.classList.toggle('bekliyor',f.st===2);gostergeCiz()}
function dograCiz(){const n=S.dogra;MK.dgr.hidden=!n;[...MK.dgr.children].forEach((x,i)=>x.classList.toggle('on',i<n))}
function izgaraCiz(i){const g=S.izg[i],el=MK.gk[i],hl=MK.hl[i];if(!g)return;
  if(MK.iz[i])MK.iz[i].hidden=!g.acik;if(MK.isi&&MK.isi[i])MK.isi[i].hidden=!g.acik;
  el.hidden=g.st===0;hl.hidden=g.st!==1;el.classList.toggle('hazir',g.st===2);el.classList.toggle('pisiyor',g.st===1)}
function izgaraIlerle(i){const g=S.izg[i];if(!g||g.st!==1)return;const ps=VERI.izgaraPisme(SAVE.up),f=Math.min(1,g.t/ps);
  MK.gk[i].style.setProperty('--p',f.toFixed(3));MK.hl[i].querySelector('.d').setAttribute('stroke-dasharray',(f*100).toFixed(1)+' 100')}
function hepsiniCiz(){kuvetCiz();burgerCiz();S.tepsi.forEach((_,i)=>tepsiCiz(i));fritozCiz();dograCiz();S.izg.forEach((_,i)=>{izgaraCiz(i);izgaraIlerle(i)});tabletCiz();esyaCiz()}

/* ---- dünya içi uçuş (sahne biriminde) ---- */
function ucW(html,from,to,{w=100,h=60,sure=420,yay=-60,s0=1,s1=1,don=0,cls='',easing='cubic-bezier(.35,.1,.45,1)'}={}){
  const d=document.createElement('div');d.className='wu '+cls;d.innerHTML=html;d.style.width=w+'px';d.style.height=h+'px';WFX.appendChild(d);
  const tr=(x,y,s,r)=>`translate(${x-w/2}px,${y-h/2}px) scale(${s}) rotate(${r}deg)`;d.style.transform=tr(from.x,from.y,s0,0);
  return new Promise(res=>{let bitti=false;const son=()=>{if(bitti)return;bitti=true;d.remove();res()};
    try{const a=d.animate([{transform:tr(from.x,from.y,s0,0)},{transform:tr((from.x+to.x)/2,(from.y+to.y)/2+yay,(s0+s1)/2*1.06,don/2),offset:.5},{transform:tr(to.x,to.y,s1,don)}],{duration:sure,easing,fill:'forwards'});a.onfinish=son}catch(e){}
    setTimeout(son,sure+250)})}
// parçacık (10. tur: malzeme bedava, dokunuşta "−N" yazısı yok)
function kirinti(x,y,renk,n=6,yay=40){for(let i=0;i<n;i++){const d=document.createElement('i');d.className='kir';d.style.background=renk[i%renk.length];d.style.left=x+'px';d.style.top=y+'px';WFX.appendChild(d);
  const a=-Math.PI/2+(Math.random()-.5)*2.4,v=yay*(.5+Math.random()*.7),tx=Math.cos(a)*v,ty=Math.sin(a)*v;
  try{d.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(.9)`,opacity:1,offset:.45},{transform:`translate(calc(-50% + ${tx*1.3}px),calc(-50% + ${ty+60}px)) scale(.5)`,opacity:0}],{duration:480+Math.random()*200,easing:'ease-out',fill:'forwards'})}catch(e){}
  setTimeout(()=>d.remove(),800)}}
function sallaEl(el){if(!el)return;el.classList.remove('red');void el.offsetWidth;el.classList.add('red')}
function reddetH(k,msg){const el=MK.hit[k];sallaEl(el);if(msg)uyari(el,msg);else{ses('uyari');tit()}return false}

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
  if(k.startsWith('tepsi'))return tepsi(+k[5]);
  if(k==='tablet'){ses('tik');openShop(true);return true}}
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
  if(kat==='patty'){S.hk--;kuvetCiz()}
  burgerCiz();const son=MK.brg.lastElementChild,gl=son&&son.previousElementSibling;
  if(son)son.style.visibility='hidden';if(gl&&(gl.classList.contains('gl')||gl.classList.contains('bz')))gl.style.visibility='hidden';
  const hy=TEZGAH.y+14-(hs-L.a)-L.h/2-34;
  ucW(`<img src="${G}${L.s}.webp" alt="">`,kay,{x:TEZGAH.x,y:hy},{w:BW,h:L.h,sure:250,yay:-80,s0:.9,s1:1,cls:'mal',easing:'cubic-bezier(.3,.2,.4,1)'}).then(()=>{
    if(o!==S.oturum)return;burgerCiz(true);const b=MK.brg;b.classList.remove('bas','tamam');
    ses(k==='bun'?'kon_ekmek':'kon_'+(k==='patty'?'kofte':k==='cheese'?'peynir':'tursu'));
    if(kat==='bunTop'){tit('orta');hitStop(70,()=>{if(o!==S.oturum)return;void b.offsetWidth;b.classList.add('tamam');ses('tamam');
        const q=ekr(TEZGAH.x,TEZGAH.y-90);parilti(q.x,q.y,0);kirinti(TEZGAH.x,TEZGAH.y-110,['#fff4dc','#f2b25a','#fff'],6,50)})}
    else{void b.offsetWidth;b.classList.add('bas')}
    rehber()});
  tit();rehber();return true}   // P10: konma sesi var, genel "dokun" tıkı çalmaz
// bir malzeme bu burgerde en çok kaç kez olabilir: bekleyen müşterilerin siparişlerinden (yoksa varsayılan sipariş)
function enCok(k){let m=0;const ss=S.cust.filter(c=>c&&!c.gitti).map(c=>c.sip.katmanlar);if(!ss.length)ss.push(VERI.SIPARIS0.katmanlar);
  ss.forEach(ks=>{const n=ks.filter(x=>x===k).length;if(n>m)m=n});return Math.max(1,m)}
function kaynak(kat){return kat==='bunBot'?{x:367,y:485}:kat==='bunTop'?{x:367,y:377}:kat==='patty'?{x:1118,y:392}:kat==='cheese'?{x:1315,y:386}:{x:1130,y:512}}

// ızgara: açık ve boşsa çiğ köfte konur (maliyet o an), 8 sn pişer, pişince hazneye uçar (hazne doluysa bekler)
function izgara(i){const g=S.izg[i],k='izg'+i;if(!g)return false;
  if(!g.acik){const kl=MK.hit[k];sallaEl(kl);uyari(kl,t('lockGrill'));return false}
  if(g.st===1)return reddetH(k,t('grillBusy'));
  if(g.st===2)return reddetH(k,t('pattyFull'));
  g.st=1;g.t=0;
  const el=MK.gk[i];izgaraCiz(i);izgaraIlerle(i);el.classList.remove('dus');void el.offsetWidth;el.classList.add('dus');
  ses('kon_kofte',{perde:-2});tit();rehber();izgaraSes();return true}
// ızgara cızırtısı: pişen köfte sayısına göre (1 köfte kısık, 4 köfte dolgun); köfte kalkınca söner
function izgaraSes(){const n=S.izg.filter(g=>g.st===1||g.st===2).length;dongu('cizirti',n?Math.min(1,.45+.18*(n-1)):0)}
function izgaraAdim(dt){const ps=VERI.izgaraPisme(SAVE.up);
  S.izg.forEach((g,i)=>{if(g.st===1){g.t+=dt;izgaraIlerle(i);if(g.t>=ps){g.st=2;izgaraCiz(i);ses('hazir',{perde:7,ses:.55})}}
    if(g.st===2&&S.hk+S.hkUcan<M.hazneKofte){g.st=0;izgaraCiz(i);izgaraSes();S.hkUcan++;const o=S.oturum;
      ucW(`<img src="${G}kofte.webp" alt="">`,IZG[i],{x:HAZNE_K.x+(Math.random()-.5)*40,y:HAZNE_K.y},{w:102*IZG[i].s,h:58*IZG[i].s,sure:520,yay:-120,s0:1,s1:.9,don:-10,cls:'kof'}).then(()=>{
        if(o!==S.oturum)return;S.hkUcan=Math.max(0,S.hkUcan-1);S.hk=Math.min(M.hazneKofte,S.hk+1);kuvetCiz();
        MK.kvK.classList.remove('kon');void MK.kvK.offsetWidth;MK.kvK.classList.add('kon');ses('kon_kofte',{ses:.6});rehber()})}})}

// çiğ patates: her dokunuş doğrama çubuğunu doldurur; 10'da kendiliğinden fritöze. Fritöz doluyken (kızarıyor ya da bekliyor) red.
function dogra(){if(S.fr.st!==0){const el=MK.hit.cig;sallaEl(el);uyari(el,S.fr.st===1?t('frying'):t('fryerBusy'));tit('ag');MK.dgr.hidden=false;MK.dgr.classList.remove('red');void MK.dgr.offsetWidth;MK.dgr.classList.add('red');setTimeout(()=>dograCiz(),500);return false}
  if(S.dogra>=M.dograma)return false;
  S.dogra++;dograCiz();
  // doğrama gamı: her dokunuşta bıçak sesi bir basamak yükselir (majör gam), 10.'da "tamam"
  ses('bicak',{perde:GAM[S.dogra-1]-4,ust:true});tit();
  patatesKucult();
  // bıçak darbesi ve patates kırıntıları
  const b=document.createElement('div');b.className='bicak';b.style.left=(CIG.x-70+Math.random()*24)+'px';b.style.top=(CIG.y-120+Math.random()*20)+'px';b.style.setProperty('--r',(-8+Math.random()*16)+'deg');
  b.innerHTML=BICAK;WFX.appendChild(b);setTimeout(()=>b.remove(),380);
  kirinti(CIG.x,CIG.y-10,['#fbe6a6','#f3d27a','#fff4d0'],5,46);
  const ci=MK.hit.cig;ci.classList.remove('vur');void ci.offsetWidth;ci.classList.add('vur');
  if(S.dogra>=M.dograma){const o=S.oturum;S.fr.st=-1;   // doğrandı: çubuklar fritöze uçuyor
    setTimeout(()=>{if(o!==S.oturum)return;ses('tamam',{perde:3,sabit:true})},90);
    setTimeout(()=>{if(o!==S.oturum)return;S.dogra=0;dograCiz();patatesKucult()},350);
    const n=7;for(let j=0;j<n;j++)setTimeout(()=>{if(o!==S.oturum)return;
      ucW('<i class="cubuk"></i>',{x:CIG.x+(Math.random()-.5)*60,y:CIG.y-20},{x:SEPET.x+(Math.random()-.5)*110,y:SEPET.y+(Math.random()-.5)*20},{w:44,h:12,sure:420,yay:-110,s0:1,s1:.9,don:200+Math.random()*300,cls:'cub'})},j*45);
    setTimeout(()=>{if(o!==S.oturum)return;S.fr={st:1,t:VERI.fritozPisme(SAVE.up),kalan:M.haznePatates};
      fritozCiz();ses('fritoz_dal');dongu('fritoz',1);kirinti(SEPET.x,SEPET.y,['#ffd36a','#fff0b0','#ffb733'],9,55);rehber()},n*45+400)}
  rehber();return true}
const GAM=[0,2,4,5,7,9,11,12,14,16];
// yığından alınan patates her dokunuşta küçülür, dilimler yanında birikir (10 dokunuş kuralı aynı)
function patatesKucult(){const n=S.dogra,p=MK.dPat,d=MK.dDil;if(!p)return;
  if(!n){p.hidden=true;d.innerHTML='';return}
  p.hidden=false;p.style.setProperty('--k',(1-n*.06).toFixed(2));
  if(d.children.length<n)for(let j=d.children.length;j<n;j++){const c=document.createElement('i');c.className='dl';
    c.style.left=(8+(j%5)*20+Math.random()*6)+'px';c.style.top=(Math.floor(j/5)*-12+Math.random()*4)+'px';c.style.setProperty('--r',(-20+Math.random()*40)+'deg');d.appendChild(c)}}
function fritozAdim(dt){const f=S.fr;if(f.st!==1)return;f.t-=dt;gostergeCiz();if(f.t<=0){f.st=2;f.t=0;fritozCiz();dongu('fritoz',.25);ses('hazir');rehber()}}
// fritöze dokun: kızarmış patates hazneye (4 porsiyon; hazne doluysa kalanı sepette bekler)
function fritoz(){const f=S.fr;
  if(f.st===1){const el=MK.hit.fritoz;sallaEl(el);uyari(el,t('frying'));return false}
  if(f.st===0||f.st===-1)return reddetH('fritoz',t('fryerEmpty'));
  const yer=M.haznePatates-S.hp;if(yer<=0)return reddetH('fritoz',t('friesFull'));
  const n=Math.min(yer,f.kalan);f.kalan-=n;if(!f.kalan){f.st=0;dongu('fritoz',0)}fritozCiz();
  const o=S.oturum;ses('fritoz_al');tit();
  for(let j=0;j<n;j++)setTimeout(()=>{if(o!==S.oturum)return;
    ucW(`<img src="${G}patates-tutam.webp" alt="">`,{x:SEPET.x+(j-1.5)*30,y:SEPET.y},{x:HAZNE_P.x+(j-1.5)*28,y:HAZNE_P.y+4},{w:110,h:56,sure:460,yay:-120,s0:.8,s1:.9,cls:'tut'}).then(()=>{
      if(o!==S.oturum)return;S.hp=Math.min(M.haznePatates,S.hp+1);kuvetCiz();MK.kvP.classList.remove('kon');void MK.kvP.offsetWidth;MK.kvP.classList.add('kon');ses('kon_tursu',{perde:-3,ses:.6});rehber()})},j*90);
  return true}
function patatesSec(){if(S.sec==='patates'){secim(null);return true}
  if(S.hp<=0)return reddetH('patates',t('noFries'));
  secim('patates');ses('dokun',{ses:.45});tit();return true}
function burgerSec(){const b=S.burger;if(!b.length)return reddetH('tezgah',t('needBun'));
  if(b[b.length-1]!=='bunTop')return reddetH('tezgah',t('notDone'));
  secim(S.sec==='burger'?null:'burger');ses('dokun',{ses:.45});tit();return true}
// tepsiye dokun: seçili burger/patates tepsiye kayar; seçim yoksa tepsi seçilir (sonra müşteriye dokun)
function tepsi(i){const tp=S.tepsi[i];
  if(S.sec==='burger'){if(tp.b)return reddetH('tepsi'+i,t('trayFull'));
    const ks=S.burger.slice();S.burger=[];secim(null);burgerCiz();const yk=burgerYuk(ks),o=S.oturum;
    ucW(`<div class="mini">${burgerHTML(ks)}</div>`,{x:TEZGAH.x,y:TEZGAH.y-2-yk*.64},{x:TEPSI[i].x-43,y:TEPSI[i].y+32-yk*.425},{w:BW,h:yk,sure:300,yay:-60,s0:1/.78,s1:.85,cls:'brgu'}).then(()=>{
      if(o!==S.oturum)return;tp.b=ks;if(tp.f===true)tp.tamT=S.now;tepsiCiz(i,true);ses('tepsi');rehber()});
    tit();return true}
  if(S.sec==='patates'){if(tp.f)return reddetH('tepsi'+i,t('trayFries'));if(S.hp<=0){secim(null);return false}
    S.hp--;kuvetCiz();secim(null);const o=S.oturum;tp.f='ucuyor';
    ucW(PORSIYON,{x:HAZNE_P.x,y:HAZNE_P.y-60},{x:TEPSI[i].x+62,y:TEPSI[i].y-30},{w:100,h:108,sure:300,yay:-50,s0:1,s1:.86,cls:'prs'}).then(()=>{if(o!==S.oturum)return;tp.f=true;if(tp.b)tp.tamT=S.now;tepsiCiz(i,true);ses('tepsi',{perde:3,ses:.8});rehber()});
    tit();return true}
  if(S.sec==='tepsi'+i){secim(null);return true}
  if(!tp.b&&!tp.f)return reddetH('tepsi'+i,t('emptyTray'));
  if(tp.f==='ucuyor')return false;
  secim('tepsi'+i);ses('dokun',{ses:.45});tit();return true}

/* ================= müşteriler ================= */
// müşteri: salondan yürüyerek gelir (yaylanarak, küçükten büyüyerek), arka tezgâhın arkasında durur (#musK y 311'de keser:
// bel/göğüs hizasından görünür), hafifçe nefes alır. Ayak çizgisi MUS_AYAK; boy oranları görsellerdeki gibi (hepsi aynı ölçek).
const MUS_AYAK=505;
// 10. tur: yer yer gelir (i); adim() saati ve yerin zamanını (S.slotT) denetler
function spawn(i){if(S.cust[i])return false;
  const sip=VERI.siparis6();
  const who=pickWho();
  const el=document.createElement('div');el.className='mus';
  const w=who?who.w*KAR_OLCEK:MUS_W,h=who?who.h*KAR_OLCEK:400,ay=who?who.ayak*KAR_OLCEK:0;
  Object.assign(el.style,{left:(MUS_X[i]-w/2)+'px',top:(MUS_AYAK-h+ay)+'px',width:w+'px',height:h+'px'});
  el.innerHTML=`<div class="yuz">${musteriGorsel(who)}</div>`;el.style.setProperty('--kd',(-Math.random()*7).toFixed(2)+'s');   // P7: kıpırdanma her müşteride ayrı
  const yon=i===0?-1:i===2?1:(Math.random()<.5?-1:1);el.style.setProperty('--gx',(yon*230)+'px');
  MUSK.appendChild(el);
  const bub=document.createElement('div');bub.className='balon';bub.style.left=(MUS_X[i]+70)+'px';
  bub.innerHTML=`<div class="sip"><span class="b">${'<div class="mini">'+burgerHTML(sip.katmanlar)+'</div>'}</span><span class="f">${PORSIYON}</span></div><div class="sabir"><b></b></div>`;
  BALON.appendChild(bub);
  const hit=document.createElement('div');hit.className='hit mh';hit.style.left=(MUS_X[i]-82)+'px';hit.style.width='300px';
  BALON.appendChild(hit);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.classList.add('in');bub.classList.add('in')}));
  const sb=S.cfg.sabirSiparis(sip);
  const max=S.rehber?Math.max(240,sb*6):Math.round(sb*(1+.15*S.kolay));
  const c=S.cust[i]={i,el,bub,hit,sip,durum:VERI.yeniDurum(sip),max,p:max,who,yuzEl:el.querySelector('.yuz'),fill:bub.querySelector('.sabir b'),ruh:'mutlu',rehberli:S.rehber,gelT:S.now};
  hit.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();musteriDokun(c)});
  S.gelen++;tabletCiz();return true}
// başın üstü (yazı, para): görselin üst kısmı, ekran koordinatında
function basNokta(c){const r=rel(c.yuzEl),bs=c.who?c.who.bas/c.who.h:0;return {x:r.cx,y:r.y+r.h*(bs+.06),r}}
// müşteri gider: tepsiyi aldıysa sevinip (zıplar) yürüyerek çıkar; süresi dolduysa tepkisiz yürüyerek çıkar (ceza sesi yok)
function cikar(c,tur,gec=0){if(S.cust[c.i]!==c)return false;S.cust[c.i]=null;c.gitti=true;
  // boşalan yere 3–5 sn sonra yenisi (P1); gidiş animasyonu bitmeden değil
  const anim=tur==='mutlu'?900:500,[a,b]=S.cfg.aralik;S.slotT[c.i]=S.now+Math.max((gec+anim+1100)/1000,gec/1000+a+Math.random()*(b-a));
  c.hit.remove();
  zaman(()=>{c.el.classList.add('cik',tur==='mutlu'?'mutlu-git':'normal-git');c.bub.classList.add('cik');
    setTimeout(()=>{c.el.classList.add('out');c.bub.classList.add('out');setTimeout(()=>{c.el.remove();c.bub.remove()},1000)},anim)},gec);
  S.bitti++;if(c.rehberli){S.rehber=false;rehberBitti();if(!SAVE.seen.includes('tut3')){SAVE.seen.push('tut3');save()}}hud({sessiz:true});tabletCiz();return true}
// rehber bitti: saat şimdi başlar, günün ilk üç müşterisi (0., 2., 5. sn; ilk yer rehber müşterisinin yeri değil) gelir
function rehberBitti(){const t0=S.slotT.slice(),ilk=S.cfg.ilk.slice();for(let j=ilk.length-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));[ilk[j],ilk[k]]=[ilk[k],ilk[j]]}
  [0,1,2].forEach(i=>{const y=S.now+ilk[i]+.6;S.slotT[i]=t0[i]<1e8?Math.max(t0[i],y):y})}   // rehberde boş tutulan yerler (1e9) hemen açılır
function custAdim(dt){let bekleyen=0;S.cust.forEach(c=>{if(!c)return;bekleyen++;c.p-=dt;const f=Math.max(0,c.p/c.max);
  c.fill.style.width=(f*100).toFixed(2)+'%';c.fill.style.background=sabirRenk(f);
  c.ruh=VERI.ruh(f);c.bub.classList.toggle('acil',f<.25&&f>0);   // son çeyrekte baloncuk hafifçe titrer (yüz ifadesi yok)
  if(c.p<=0)kacti(c)});
  try{SES.yogun&&SES.yogun(bekleyen>2)}catch(e){}}
// süre doldu: müşteri yalnız gider. Can yok; o müşterinin parası ve seri kaçar (seri sessizce söner), gün sürer.
function kacti(c){if(!cikar(c,'normal'))return;S.kacan++;S.seri=0;hud({sessiz:true});kontrol();rehber()}
// baloncukta verilen parça soluklaşır
function alindiCiz(c){const d=c.durum;c.bub.querySelector('.b').classList.toggle('alindi',!!(d&&d.burger));c.bub.querySelector('.f').classList.toggle('alindi',!!(d&&d.yan))}
// müşteriye dokun: seçili tepsi o müşteriye gider
function musteriDokun(c){if(!aktif()||S.cust[c.i]!==c)return;
  if(!S.sec||!S.sec.startsWith('tepsi')){if(S.yig[c.i]){topla(c.i);return}uyari(c.bub,t('pickTray'));return}   // tepsi seçili değil: önündeki parayı topla
  const i=+S.sec[5],tp=S.tepsi[i];if(!tp.b&&!tp.f){secim(null);return}
  if(tp.f==='ucuyor')return;
  const parca={};if(tp.b)parca.katmanlar=tp.b;if(tp.f)parca.yan='fries';
  // P8: tepsi müşteri gelmeden hazırdı ve müşteri gelir gelmez (8 sn içinde) verildi → "Hazırdı!" ve +1 bahşiş
  const hazir=!!(tp.b&&tp.f===true&&tp.tamT!=null&&tp.tamT<=c.gelT+.3&&S.now-c.gelT<=8);
  // tepsi (içindekilerle) müşteriye kayar, yerine boş tepsi gelir (uçuşta ses yok, yalnız varınca servis sesi)
  const kl=MK.tp[i].cloneNode(true);kl.removeAttribute('id');kl.classList.remove('sec','kon');kl.classList.add('giden');
  const x0=TEPSI[i].x,y0=TEPSI[i].y,x1=MUS_X[c.i],y1=MUS_ALT-6;
  kl.style.left=(x0-135)+'px';kl.style.top=(y0-56)+'px';WFX.appendChild(kl);
  try{kl.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${(x1-x0)*.55}px,${(y1-y0)*.5-40}px) scale(.8)`,offset:.55},{transform:`translate(${x1-x0}px,${y1-y0}px) scale(.62)`,opacity:1,offset:.85},{transform:`translate(${x1-x0}px,${y1-y0+40}px) scale(.55)`,opacity:0}],{duration:520,easing:'cubic-bezier(.4,0,.5,1)',fill:'forwards'})}catch(e){}
  setTimeout(()=>kl.remove(),620);
  S.tepsi[i]={b:null,f:false};secim(null);tepsiCiz(i);MK.tp[i].classList.remove('yeni');void MK.tp[i].offsetWidth;MK.tp[i].classList.add('yeni');
  tit();zaman(()=>ses('servis'),400);
  teslimEt(c,parca,430,{hazir})}

/* ================= teslim (parça parça) ================= */
// Can yok (9. tur). 10. tur: doğru teslimde HER ZAMAN burgerin parası ödenir (Y1); bahşiş yalnız sabır > 2/3'te (seri artar).
// Para müşterinin önüne, tezgâha düşer (yiginEkle); kasaya oyuncu dokununca uçar. Büyük an (P5): en önemli tek başlık
// ("İlk satış!" > "Hazırdı!" > "Seri N!" > "Çok hızlı!"), altında "+30" ve ayrı renkte "+9 bahşiş". Yanlış: ödemez, seri sıfırlanır.
function teslimEt(c,parca,gec=0,ek={}){const f=Math.max(0,c.p/c.max);
  const o=VERI.teslimParca(c.durum,parca,f,SAVE.up,S.seri,{hazir:!!ek.hazir});
  if(o.durum)c.durum=o.durum;
  const bn=basNokta(c),x=bn.x,y=bn.y,yr=bn.r;
  if(o.sonuc==='parca'){
    if(o.sabirEk>0)c.p=Math.min(c.max,c.p+o.sabirEk*c.max);
    zaman(()=>{alindiCiz(c);tit();const b=rel(c.bub);c.el.classList.remove('sevin1');void c.el.offsetWidth;c.el.classList.add('sevin1');
      yazi(b.cx,b.y,`${ic('tik')}<span>${t('gotPart')}</span>`,'iyi kucuk');c.bub.classList.remove('aldi1');void c.bub.offsetWidth;c.bub.classList.add('aldi1')},gec);
    rehber();return o}
  const ucret=o.ucret||0,bah=o.bahsis||0;S.kasa+=ucret+bah;S.gelir+=ucret;S.bahsis+=bah;
  let tur='normal';
  zaman(()=>{alindiCiz(c)},gec);
  if(o.dogru){const sure=S.now-c.gelT,ilk=!SAVE.seen.includes('ilk');
    if(o.ruh==='mutlu'){tur='mutlu';S.seri++;S.sayi.mutlu++}else{S.seri=0;S.sayi[o.ruh==='somurtkan'?'somurtkan':'kizgin']++}
    S.enSeri=Math.max(S.enSeri,S.seri);
    const rekor=S.sayi.mutlu+S.sayi.somurtkan+S.sayi.kizgin>=3&&S.enHizli>0&&sure<S.enHizli;if(!S.enHizli||sure<S.enHizli)S.enHizli=sure;
    const sr=S.seri;let bas=null,bcls='';
    if(ilk){bas=t('ilkSatis');bcls='ilk';SAVE.seen.push('ilk');save()}
    else if(o.hazir){bas=t('hazirdi');bcls='hazir'}
    else if(sr>=3){bas=t('seriB',sr);bcls='seri'}
    else if(o.hizli){bas=t('hizli')}
    zaman(()=>{ses('kasa',{perde:tur==='mutlu'?Math.min(7,sr-1):-2,ust:true,ses:tur==='mutlu'?1:.7});tit(bas?'orta':undefined);
      c.el.classList.add(tur==='mutlu'?'sevin':'sevin1');if(tur==='mutlu')kirinti(MUS_X[c.i],MUS_ALT-150,['#ffd84a','#fff','#ff9d1a','#ff6f61'],6,60)},gec);
    // başlık başın üstünde, "+30" altında, bahşiş "+30"un sağında (ekranın üstünden taşmasın diye aşağıya doğru dizilir)
    const yb=Math.max(y,(bas?13:9)*cq()),yu=yb+(bas?8*cq():0);
    if(bas)yazi(x,yb,`<span>${bas}</span>`,'buyuk '+bcls,gec);
    yazi(x-(bah?5*cq():0),yu,`+${ucret}${PARA()}`,'iyi',gec+(bas?180:0));
    if(tur==='mutlu')parilti(x,yu,gec);
    if(bah){const W=APP.clientWidth,bx=x+9*cq();yazi(Math.min(W-14*cq(),Math.max(14*cq(),bx)),yu+1.5*cq(),`${ic('kese')}<span>+${bah}</span><small>${t('tip')}</small>`,'bahsis',gec+450)}
    if(rekor)zaman(()=>{const q=rel(c.yuzEl);sac(q.cx,q.y+q.h*.2,[0],10,{yay:12,yuk:-3,cls:'yildizcik',sure:800})},gec+250);   // günün en hızlı servisi
    if(ilk)ilkKutlama(gec);
    yiginEkle(c.i,ucret,bah,gec+200)}
  else{S.seri=0;S.yanlis++;
    zaman(()=>{c.bub.classList.add('ret');ses('uyari');tit('ag')},gec);
    damga(c,t('wrong'),gec)}
  cikar(c,tur,gec);hud({sessiz:true});kontrol();rehber();return o}

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
  // 10. tur: tezgâhta para varsa ve oyuncu daha hiç toplamadıysa "Paraya dokun"
  if(!a&&!SAVE.seen.includes('para')){const j=S.yig.findIndex(y=>y&&y.el);if(j>=0)a=[S.yig[j].el,tg('para')]}
  // rehberden sonra ilk günlerde bir kez: ızgara ve doğrama ipuçları (P11: 1. gün doğrama ipucu ilk müşteriden hemen sonra)
  if(!a&&S.ipucu){if(!S.ipucu.izg&&S.hk<=3&&S.izg.every(g=>g.st===0)){a=[MK.hit.izg0,tg('grill')];S.ipucuAktif='izg'}
    else if(!S.ipucu.cig&&S.fr.st===0&&(S.hp<=1||S.gun===1&&S.bitti>=1&&S.hp<=3)){a=[MK.hit.cig,tg('chop')];S.ipucuAktif='cig'}
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
function aktif(){return S.on&&!S.paused&&!S.bitis}
function yeniOturum(){S.oturum++;clearTimeout(S.bitisT);S.bitisT=0;cancelAnimationFrame(kasaRAF);bekle=0;loopNo++}
function mutfakSifirla(){const n=VERI.izgaraGoz(SAVE.up);
  S.izg=[0,1,2,3].map(i=>({acik:i<n,st:0,t:0}));S.hk=M.hazir.patty;S.hkUcan=0;S.hp=M.hazir.fries;S.dogra=0;S.fr={st:0,t:0,kalan:0};
  S.burger=[];S.tepsi=[{b:null,f:false},{b:null,f:false}];S.sec=null;S.koyNo=0;dongu('cizirti',0);dongu('fritoz',0)}
function startDay(d,hemen){yeniOturum();S.gun=d;S.cfg=VERI.gun6(d,SAVE.up);
  S.kolay=SAVE.kolay.g===d?Math.min(3,SAVE.kolay.n):0;
  S.kasa=S.kasa0=SAVE.coins;S.gelir=S.gider=S.bahsis=0;S.sayi={mutlu:0,somurtkan:0,kizgin:0};S.kacan=S.yanlis=0;S.alis=0;
  S.bitti=0;S.seri=0;S.cust=[null,null,null];S.now=0;S.bitis=false;S.on=false;S.paused=false;
  S.sure=S.saat=S.cfg.sure;S.gelen=0;S.tezgah=0;S.yig=[null,null,null];S.enHizli=0;S.enSeri=0;
  S.rehber=!SAVE.seen.includes('tut3');
  // günün ilk üç müşterisi 0., 2., 5. saniyede (yerler karışık); rehberde önce yalnız ortadaki yere bir müşteri
  {const ilk=S.cfg.ilk.map(x=>x+.6);for(let j=ilk.length-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));[ilk[j],ilk[k]]=[ilk[k],ilk[j]]}S.slotT=S.rehber?[1e9,.8,1e9]:ilk}S.ipucu=d<=2||S.rehber?{izg:false,cig:false,frt:false}:null;S.ipucuAktif=null;
  FX.innerHTML='';mutfakSifirla();buildMutfak();hepsiniCiz();muzikMod('oyun');
  kasaGor=S.kasa;hud({sessiz:true});sesBtn();$('home').hidden=true;dkGizle();
  $('durBtn').innerHTML=ic('duraklat');$('durBtn').setAttribute('aria-label',t('pause'));$('kasaI').innerHTML=PARA();fit();
  const go=()=>{$('ov').hidden=true;S.on=true;S.paused=false;ses('gun_basla');donguBasla();hud({sessiz:true});tabletCiz();rehber();yonKontrol()};
  if(hemen){go();return}
  const w=pickWho(),mf=w?`<i class="mf">${musteriGorsel(w,'bas')}</i>`:ic('gulen');
  const kr=VERI.kira(d),fy=VERI.fiyat(VERI.SIPARIS0);
  card(`<h2>${t('dayT',d)}</h2><div class="kol"><div class="info"><span title="${t('sure')}">${mf}<em class="ledT">${sureYaz(S.cfg.sure)}</em></span><span class="${S.kasa<0?'neg':''}">${PARA()}${fmt(S.kasa)}</span></div>`+
    `<div class="kirasatir">${ic('kira')}<span>${t('kiraBugun')}</span><b>${fmt(kr)}${PARA()}</b></div>`+
    (S.kolay?`<div class="kolay">${ic('kumsaati')}<span>${t('easier')}</span></div>`:'')+`</div><div class="kol"><div class="menu"><span class="mbg" style="--mk:${(2.4*cq()*10/170).toFixed(3)}"><span class="mini">${burgerHTML(VERI.SIPARIS0.katmanlar)}</span></span><span class="mp">${PORSIYON}</span><b>${fy}${PARA()}</b></div><p>${t('dayP')}</p>`+
    `</div><div class="btns"><button class="btn" id="go">${ic('oynat')}${t('start')}</button></div>`,'iki basi');
  $('go').onclick=()=>{ses('tik');go()}}
// can yok: gün SAATLE biter (10. tur). Saat bitince yeni müşteri gelmez; içerdekiler gidince gün biter (kaybedilen gün yok).
// Tezgâhta toplanmamış para kendiliğinden kasaya uçar.
function kontrol(){if(!S.on||S.bitis||S.rehber)return;
  if(S.saat<=0&&!S.cust.some(Boolean)){const n=toplaHepsi();bitisBaslat(true,1300+(n?700:0))}}
function bitisBaslat(win,ms){S.bitis=true;rehberGizle();kaydet(win);S.bitisT=zaman(()=>{S.bitisT=0;sonKart(win)},ms)}
function kaydet(win){const st=VERI.yildiz(S.sayi.mutlu,S.gelen);S.yildiz=st;   // P9: yıldız = mutlu teslim oranı
  // rekorlar (P9): en hızlı servis (sn, tam sayı), en uzun seri
  const hz=S.enHizli>0?Math.max(1,Math.round(S.enHizli)):0;S.rekorHiz=hz>0&&(!SAVE.rekor.hiz||hz<SAVE.rekor.hiz);S.rekorSeri=S.enSeri>=3&&S.enSeri>SAVE.rekor.seri;
  if(S.rekorHiz)SAVE.rekor.hiz=hz;if(S.rekorSeri)SAVE.rekor.seri=S.enSeri;S.hizSn=hz;
  const gs=VERI.gunSonu(S.kasa,S.gun,SAVE.eksi);
  S.kira=gs.kira|0;S.kapandi=!!gs.kapandi;SAVE.coins=gs.kasa|0;SAVE.eksi=gs.eksiGun|0;
  // kolaylaştırma (9. tur): müşterilerin üçte biri ya da fazlası kaçtıysa / yanlış aldıysa ertesi gün sabır +%15 (art arda en çok 3 kez)
  const zor=S.gelen>0&&S.kacan+S.yanlis>=Math.ceil(S.gelen/3);
  SAVE.kolay=zor?{g:S.gun+1,n:Math.min(3,(SAVE.kolay.g===S.gun?SAVE.kolay.n:0)+1)}:{g:0,n:0};
  if(win){SAVE.stars[S.gun]=Math.max(SAVE.stars[S.gun]||0,st);SAVE.day=Math.max(SAVE.day,S.gun+1)}
  SAVE.son={gun:S.gun,net:S.gelir+S.bahsis-S.kira,mus:S.gelen};
  save()}
function bitir(win){if(!S.on)return;if(!S.bitis){S.bitis=true;rehberGizle();kaydet(win)}clearTimeout(S.bitisT);S.bitisT=0;sonKart(win)}
function sonKart(win){S.on=false;S.bitis=false;rehberGizle();secim(null);dongu('cizirti',0);dongu('fritoz',0);try{SES.yogun&&SES.yogun(false)}catch(e){}
  ses('gun_sonu');
  const st=S.yildiz|0,net=S.gelir+S.bahsis-S.kira,G2=120,adim=[S.gelir,S.bahsis,-S.kira];
  const n=(v,i)=>`<b class="${v<0?'neg':v>0?'pos':''}" data-v="${v}" data-i="${i}">${v>0?'+':v<0?'−':''}0${PARA()}</b>`;
  const t0=win?.25+3*.3:.3;
  const sat=(ad,v,i,cls='',ik='')=>`<div class="r${cls}" style="--g:${(t0+i*G2/1000).toFixed(2)}s"><span>${ik?ic(ik):''}${t(ad)}</span>${n(v,i)}</div>`;
  const ek=S.kapandi?'':SAVE.eksi>0?`<div class="eksi">${ic('kira')}<span>${t('eksiUyari',SAVE.eksi,VERI.KAPANIS_GUN||3)}</span></div>`:'';
  card(`<h2>${t(win?'winT':'failT')}</h2><div class="kol orta">`+(win?`<div class="stars">${[1,2,3].map(i=>`<span class="${i<=st?'dolu':'bos'}" style="--g:${(.25+(i-1)*.3).toFixed(2)}s">${ic(i<=st?'yildiz':'yildiz_bos')}</span>`).join('')}</div>`:`<p>${t('failP')}<br><small>${t('easierNext')}</small></p>`)+
    `<div class="yuzler" style="--g:${(t0+5*G2/1000).toFixed(2)}s"><span title="${t('servis')}">${ic('tik')}${S.sayi.mutlu+S.sayi.somurtkan+S.sayi.kizgin}</span><span title="${t('bahsis')}">${ic('kese')}${S.sayi.mutlu}</span><span title="${t('kacan')}">${ic('kumsaati')}${S.kacan+S.yanlis}</span></div>`+
    `<div class="info"><span class="${!S.kapandi&&SAVE.coins<0?'neg':''}">${t('kasa')}: ${PARA()}${fmt(S.kapandi?S.kasa-S.kira:SAVE.coins)}</span></div>`+ek+
    `<div class="chip hedef kart" id="hedefK"><span class="i"></span><span class="ht"></span><div class="prog"><b></b></div></div></div>`+
    `<div class="kol"><div class="tablo">${sat('gelir',adim[0],0)}${sat('bahsis',adim[1],1)}${sat('kira',adim[2],2,' kira','kira')}${sat('net',net,3,' net')}</div>`+
    `<div class="rekor" style="--g:${(t0+4*G2/1000+.3).toFixed(2)}s"><b>${t('rekorlar')}</b>`+
      `<span>${ic('kumsaati')}${t('enHizli')}<em>${S.hizSn?t('sn',S.hizSn):'–'}</em>${S.rekorHiz?`<i>${t('yeniRekor')}</i>`:''}</span>`+
      `<span>${ic('yildiz')}${t('enSeri')}<em>${S.enSeri}</em>${S.rekorSeri?`<i>${t('yeniRekor')}</i>`:''}</span></div></div>`+
    `<div class="btns yan"><button class="btn" id="nx">${ic(win?'ileri':'tekrar')}${t(win?'next':'retry')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`,'son iki');
  $('card').style.setProperty('--bg',(t0+6*G2/1000).toFixed(2)+'s');
  // sıradaki hedef: kasa sayılırken çubuk da dolar
  {const hk=$('hedefK'),son=S.kapandi?SAVE.coins:SAVE.coins,bas=S.kasa0;hedefCiz(hk,bas);const s0=performance.now()+(t0+.4)*1000;
    const f=now=>{if(!hk.isConnected)return;const u=Math.max(0,Math.min(1,(now-s0)/900));hedefCiz(hk,Math.round(bas+(son-bas)*u));if(u<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
  if(win)for(let i=1;i<=st;i++)setTimeout(()=>{if(!$('ov').hidden&&$('card').classList.contains('son'))ses('para',{perde:4+i*3,sabit:true})},(.25+(i-1)*.3+.35)*1000);
  $('card').querySelectorAll('.tablo b').forEach(b=>{const v=+b.dataset.v,i=+b.dataset.i,ilk=(t0+i*G2/1000+.15)*1000;
    const yaz=x=>{b.innerHTML=`${x>0?'+':x<0?'−':''}${fmt(Math.abs(x))}${PARA()}`};
    setTimeout(()=>{const s0=performance.now(),sure=Math.min(700,250+Math.abs(v)*6);let son=0;
      const f=now=>{if(!b.isConnected)return;const u=Math.min(1,(now-s0)/sure),x=Math.round(v*(1-Math.pow(1-u,2)));yaz(x);
        if(x!==son&&now-(f.t||0)>85){f.t=now;ses('para',{perde:Math.min(7,u*7),ses:.45,ust:true})}son=x;if(u<1)requestAnimationFrame(f)};requestAnimationFrame(f)},ilk)});
  if(win&&st>=2)setTimeout(()=>{if(!$('ov').hidden)konfeti()},(t0+.2)*1000);
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
  ses('uyari');tit('ag');$('kpD').onclick=()=>{ses('tik');sonra()}}
function konfeti(kap){const k=document.createElement('div');k.className='konfeti';const R=['#ff5b4f','#ffc21a','#37c25a','#4fb3ff','#ff8ad8','#fff'];let h='';
  for(let i=0;i<46;i++){const sk=i%5===0,x=Math.random()*100,du=1.8+Math.random()*1.6,de=Math.random()*.7;
    h+=`<i class="${sk?'sk':''}" style="left:${x}%;${sk?'':`background:${R[i%R.length]};`}--dx:${((Math.random()-.5)*3).toFixed(2)}rem;--r:${Math.round(360+Math.random()*540)*(Math.random()<.5?-1:1)}deg;animation-duration:${du.toFixed(2)}s;animation-delay:${de.toFixed(2)}s">${sk?PARA():''}</i>`}
  k.innerHTML=h;(kap||$('ov')).appendChild(k);setTimeout(()=>k.remove(),4000)}
function card(html,cls=''){$('ov').querySelectorAll('.konfeti').forEach(e=>e.remove());const c=$('card');c.className='card'+(cls?' '+cls:'');c.style.removeProperty('--bg');c.style.zoom='';c.innerHTML=html;$('ov').hidden=false;kartSigdir()}
function kartSigdir(){const c=$('card'),ov=$('ov');if(ov.hidden)return;c.style.zoom='';const cs=getComputedStyle(ov);
  const H=ov.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom),h=c.offsetHeight;if(h>H)c.style.zoom=Math.max(.7,H/h).toFixed(3)}
function sesDur(){dongu('cizirti',0);dongu('fritoz',0)}
function sesSur(){izgaraSes();if(S.fr.st===1)dongu('fritoz',1);else if(S.fr.st===2)dongu('fritoz',.25)}
function duraklat(){if(!S.on||S.paused||S.bitis)return;S.paused=true;rehberGizle();sesDur();
  const tgl=(id,on,ikon,ad)=>`<button class="tg${on?'':' kapali'}" id="${id}" aria-pressed="${on}"><span class="ti">${ic(ikon)}</span><span class="d">${t(ad)}<small>${t(on?'on':'off')}</small></span></button>`;
  const kart=()=>{card(`<h2>${t('pauseT')}</h2><div class="ayarlar">${tgl('pE',SAVE.ayar.efekt,SAVE.ayar.efekt?'ses_acik':'ses_kapali','fx')}${tgl('pM',SAVE.ayar.muzik,'muzik','music')}</div>`+
    `<div class="btns yan"><button class="btn" id="rs">${ic('oynat')}${t('resume')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`,'dur');
    $('pE').onclick=()=>{SAVE.ayar.efekt=!SAVE.ayar.efekt;sesAyar();sesBtn();kart();ses('tik')};$('pM').onclick=()=>{SAVE.ayar.muzik=!SAVE.ayar.muzik;sesAyar();sesBtn();kart();ses('tik')};
    $('rs').onclick=()=>{ses('tik');S.paused=false;$('ov').hidden=true;sesSur();donguBasla();rehber(true)};
    // gün yarıda bırakılırsa o güne kadar harcanan para gider, kazanç sayılmaz (gün tekrar oynanır)
    $('hm').onclick=()=>{ses('tik');SAVE.coins=Math.min(S.kasa,S.kasa0);save();S.on=false;openHome()}};   // dükkân alışverişi kasa0'dan da düştü
  kart()}
$('durBtn').onclick=()=>{ses('tik');duraklat()};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(S.on&&!S.paused)duraklat();try{SES.muzik(false)}catch(e){}}else if(sesAcik&&SAVE.ayar.muzik){try{SES.muzik(true)}catch(e){}}});

/* ================= döngü ================= */
let last=0,loopNo=0;
function donguBasla(){const no=++loopNo;last=performance.now();
  const f=now=>{if(no!==loopNo||!S.on||S.paused)return;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;adim(dt);requestAnimationFrame(f)};requestAnimationFrame(f)}
// 10. tur: saat (rehber sürerken durur), yer yer gelen müşteriler (tezgâhta hep 3; boşalan yere 3–5 sn'de yenisi)
function adim(dt){S.now+=dt;if(S.bitis){izgaraAdim(dt);fritozAdim(dt);return}
  if(!S.rehber&&S.saat>0){const o=S.saat;S.saat=Math.max(0,S.saat-dt);saatAdim(o)}
  if(S.saat>0){let n=S.cust.filter(Boolean).length;
    for(const i of [0,1,2])if(!S.cust[i]&&S.now>=S.slotT[i]&&n<S.cfg.sira&&!(S.rehber&&(n||S.bitti))){if(spawn(i)){n++;rehber()}}}
  custAdim(dt);izgaraAdim(dt);fritozAdim(dt);saatCiz();kontrol()}
// son 10 sn tik-tak (hafif), saat bitince "Kapanış saati!"
function saatAdim(o){const v=Math.ceil(S.saat);
  if(v<Math.ceil(o)&&v<10&&v>=0&&S.saat>0){ses('tik',{perde:v%2?7:2,ses:.55,sabit:true,ust:true})}
  if(o>0&&S.saat<=0){ses('hazir',{perde:-5});const r=rel($('gunC'));yazi(APP.clientWidth/2,Math.max(r.y+r.h,14*cq()),`<span>${t('kapanis')}</span>`,'buyuk kapanis');tabletCiz();rehber()}}

/* ================= ana ekran ================= */
const UPI={cook:'ates',pat:'kumsaati',tip:'kese',slot:'izgara'};
function heroFaces(){if(!WHO.length)return;const a=WHO[Math.floor(Math.random()*WHO.length)];let b;do{b=WHO[Math.floor(Math.random()*WHO.length)]}while(b===a&&WHO.length>1);
  $('heroA1').innerHTML=musteriGorsel(a);$('heroA2').innerHTML=musteriGorsel(b)}
// ana menü: resmin kendi ekmek, köfte, peynir, turşusuyla burger
function heroCiz(){const c=cq()||3.9,h=$('heroB').closest('.hero').clientHeight||40*c,ks=VERI.SIPARIS0.katmanlar,by=burgerYuk(ks);
  const ym=Math.max(14*c,Math.min(28*c,h-14*c)),k=ym/by;
  $('heroB').innerHTML=`<div class="burger hb3" style="width:${BW}px;height:${by}px;transform:scale(${k.toFixed(3)});transform-origin:50% 100%">${burgerHTML(ks)}</div>`;
  $('heroB').style.height=ym+'px';$('heroB').style.width=BW*k+'px';
  // burger kesme tahtasının ortasına oturur (tahta 260×100 birim, üst yüzün ortası y=46; alt ekmeğin altı kutunun 19 birim altı)
  const pl=$('heroB').nextElementSibling;pl.style.width=260*k+'px';pl.style.height=100*k+'px';$('heroB').style.marginBottom=(-65*k)+'px'}
function openHome(){yeniOturum();S.on=false;S.paused=false;S.bitis=false;rehberGizle();FX.innerHTML='';SH.oyunda=false;dongu('cizirti',0);dongu('fritoz',0);muzikMod('menu');heroFaces();$('ov').hidden=true;dkGizle();$('home').hidden=false;document.documentElement.lang=SAVE.lang;
  $('playBtn').innerHTML=ic('oynat')+(SAVE.day>1?t('cont',SAVE.day):t('play'));$('logo2').textContent=t('logo2');
  $('langBtn').innerHTML=ic('dil')+`<span class="${SAVE.lang==='tr'?'on':''}">TR</span><span class="${SAVE.lang==='en'?'on':''}">EN</span>`;$('langBtn').setAttribute('aria-label',t('lang'));
  $('hKasa').textContent=fmt(SAVE.coins);$('hKasaI').innerHTML=PARA();$('hKasaC').classList.toggle('neg',SAVE.coins<0);
  $('hEfekt').innerHTML=ic(SAVE.ayar.efekt?'ses_acik':'ses_kapali');$('hEfekt').classList.toggle('kapali',!SAVE.ayar.efekt);$('hEfekt').setAttribute('aria-label',t('fx'));
  $('hMuzik').innerHTML=ic('muzik');$('hMuzik').classList.toggle('kapali',!SAVE.ayar.muzik);$('hMuzik').setAttribute('aria-label',t('music'));
  const n=alinabilir();
  $('shopBtn').innerHTML=`<span class="si">${ic('dukkan')}</span><span class="st"><b>${t('shop')}</b><small>${t('shopSub')}</small></span>`+(n?`<span class="rz" aria-hidden="true">${n}</span>`:'');
  $('shopBtn').classList.toggle('var',!!n);$('shopBtn').setAttribute('aria-label',t('shop')+(n?' ('+n+')':''));
  hedefCiz($('hHedef'),SAVE.coins);ilerCiz();
  if(SAVE.iade){const n=SAVE.iade;delete SAVE.iade;setTimeout(()=>{if(!$('home').hidden)uyari($('shopBtn'),t('iade',n))},600)}
  cevirYaz();heroCiz()}

/* ================= dükkân: mutfağın içinde (10. tur, P6) ================= */
// Satılanlar: resimdeki 2 kilitli ızgara (sırayla; GELISTIR.slot) ve geliştirmeler (pat = radyo, tip = bahşiş kavanozu).
// Tablete (oyunda) ya da ana menüdeki Dükkân'a dokununca mutfak "dükkân kipine" geçer: oyun durur, alınmamış şeyler gri,
// üstlerinde ipli fiyat etiketi; alınabilenin etiketi turuncu parlar. Etikete/eşyaya dokununca kısa açıklama kartı ve
// "Satın al". Oyunda günün kasasıyla (S.kasa), ana menüden SAVE.coins ile alınır; alınan şey hemen işler. Eksi kasayla alınmaz.
const SH={mesgul:false,oyunda:false,acik:false,sec:null};
const shKasa=()=>SH.oyunda?S.kasa:SAVE.coins;
const alabilir=(f,k)=>VERI.alabilir(k==null?shKasa():k,f);
const UPS=['pat','tip'];
function upDurum(k){const u=VERI.GELISTIR[k],l=SAVE.up[k]|0;return {u,l,mx:l>=u.max,c:u.cost(l)}}
function alinabilir(k){let n=0;VERI.SATILIK.forEach(x=>{const d=upDurum(x);if(!d.mx&&alabilir(d.c,k))n++});return n}
// dükkân kipindeki eşyalar: r = gri örtü/eşyanın yeri, h = dokunma alanı (SE'de ≥ 44 pt), e = etiketin asıldığı nokta
const DK=[{id:'slot0',k:'slot',j:0,r:P.izgara3,h:[576,454,222,150],e:[687,470]},{id:'slot1',k:'slot',j:1,r:P.izgara4,h:[798,454,222,150],e:[905,470]},
  {id:'tip',k:'tip',r:ESYA.tip,h:[1290,470,220,230],e:[1398,428]},{id:'pat',k:'pat',r:ESYA.pat,h:[1512,470,262,225],e:[1644,436]}];
// bir eşyanın dükkândaki durumu: tam (hepsi alındı), kilit (önce öncekini aç), ok (alınabilir), yok (para yetmiyor)
function dkDurum(it){const sl=SAVE.up.slot|0;
  if(it.k==='slot'){const c=VERI.GELISTIR.slot.cost(it.j);if(sl>it.j)return {d:'tam',c,l:1,mx:1};if(sl<it.j)return {d:'kilit',c,l:0,mx:1};return {d:alabilir(c)?'ok':'yok',c,l:0,mx:1}}
  const {l,mx,c,u}=upDurum(it.k);return {d:mx?'tam':alabilir(c)?'ok':'yok',c,l,mx:u.max}}
const dkAd=it=>it.k==='slot'?t('grillN',it.j+3):t('up')[it.k][0];
function dkCiz(){const K=$('dkK');let h='';
  DK.forEach(it=>{const d=dkDurum(it),r=it.r,sahip=it.k==='slot'?d.d==='tam':d.l>0;
    if(!sahip&&it.k==='slot')h+=`<div class="dkgri" style="left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px"></div>`;
    const yazi_=d.d==='tam'?ic('tik'):`${PARA()}<b>${fmt(d.c)}</b>`,pips=d.mx>1?`<span class="pp">${Array.from({length:d.mx},(_,i)=>`<i class="${i<d.l?'on':''}"></i>`).join('')}</span>`:'';
    h+=`<div class="etk ${d.d}" style="left:${it.e[0]}px;top:${it.e[1]}px"><svg class="ip" viewBox="0 0 20 70" aria-hidden="true"><path d="M10 0V58"/><circle cx="10" cy="3" r="6"/></svg><div class="kt">${d.d==='kilit'?ic('kilit'):''}${yazi_}${pips}</div></div>`;
    h+=`<div class="hit dkh" data-dk="${it.id}" style="left:${it.h[0]}px;top:${it.h[1]}px;width:${it.h[2]}px;height:${it.h[3]}px"></div>`});
  K.innerHTML=h;
  K.querySelectorAll('.dkh').forEach(el=>el.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();dkSec(el.dataset.dk)}));
  shopKasa(shKasa());const u=$('shUyari');u.hidden=shKasa()>=0;u.innerHTML=ic('kira')+`<span>${t('negShop')}</span>`}
function dkSec(id){const it=DK.find(x=>x.id===id);if(!it)return;SH.sec=id;ses('tik');tit();
  const el=document.querySelector(`#dkK .dkh[data-dk="${id}"]`);if(el)el.classList.remove('red');
  const d=dkDurum(it),K=$('dkKart'),ik=it.k==='slot'?IZG_IMG(d.d==='tam'):`<span class="e">${ic(UPI[it.k])}</span>`;
  const acik=it.k==='slot'?(d.d==='tam'?t('owned'):t('grillP')):t('esya')[it.k];
  const durum=d.d==='tam'?`<span class="dd tam">${ic('tik')}${it.k==='slot'?t('owned'):t('max')}</span>`:d.d==='kilit'?`<span class="dd">${ic('kilit')}${t('locked')}</span>`:
    d.d==='yok'?`<span class="dd">${shKasa()<0?t('negKisa'):t('yetmez',fmt(d.c-Math.max(0,shKasa())))}</span>`:'';
  K.innerHTML=`<button class="hb dkx" id="dkX" aria-label="${t('kapat')}">${ic('carpi')}</button><div class="ust">${ik}<div><b>${dkAd(it)}</b>`+(d.mx>1?`<small>${t('duzey',d.l,d.mx)}</small>`:'')+`</div></div><p>${acik}</p>${durum}`+
    (d.d==='tam'||d.d==='kilit'?'':`<button class="btn" id="dkAl"${d.d==='ok'?'':' disabled'}>${PARA()}${fmt(d.c)}<span>${t('al')}</span></button>`);
  K.hidden=false;K.classList.remove('gel');void K.offsetWidth;K.classList.add('gel');
  $('dkX').onclick=()=>{ses('tik');K.hidden=true;SH.sec=null};
  const al=$('dkAl');if(al)al.onclick=()=>{if(upAl(it.k)){const r=it.r,q=ekr(r[0]+r[2]/2,r[1]+r[3]/2);sac(q.x,q.y,[0],10,{yay:12,yuk:-2,cls:'yildizcik',sure:800});dkSec(id)}else{reddet(al)}}}
function openShop(oyunda){SH.mesgul=false;SH.oyunda=!!oyunda;SH.sec=null;
  if(SH.oyunda){if(!S.on||S.bitis)return;S.paused=true;rehberGizle();sesDur();secim(null);toplaHepsi({aninda:true});FX.querySelectorAll('.uyari,.ipucu').forEach(e=>e.remove())}
  else{   // ana menüden: boş mutfak (müşteri yok, gün başlamadı)
    yeniOturum();S.on=false;S.paused=false;S.bitis=false;S.rehber=false;S.cust=[null,null,null];S.yig=[null,null,null];S.tezgah=0;FX.innerHTML='';
    mutfakSifirla();buildMutfak();hepsiniCiz();$('home').hidden=true;$('ov').hidden=true;fit()}
  SH.acik=true;APP.classList.add('dkKip');$('dk').hidden=false;$('dkKart').hidden=true;
  $('shT').textContent=t('shop');$('dkIp').textContent=t('dkIp');$('shBack').innerHTML=ic(SH.oyunda?'oynat':'ev');$('shBack').setAttribute('aria-label',SH.oyunda?t('mutfaga'):t('home'));
  $('shKasaI').innerHTML=PARA();esyaCiz();dkCiz()}
function dkGizle(){SH.acik=false;APP.classList.remove('dkKip');$('dk').hidden=true;$('dkKart').hidden=true;$('dkK').innerHTML=''}
function shopKapat(){ses('tik');dkGizle();if(!SH.oyunda){openHome();return}
  SH.oyunda=false;
  if(S.on&&!S.bitis){S.paused=false;hud({sessiz:true});tabletCiz();sesSur();donguBasla();rehber(true)}}
let shKasaGor=0,shRAF=0;
function shopKasa(v,sure){cancelAnimationFrame(shRAF);const yaz=x=>{$('shKasa').textContent=fmt(x);$('shKasaC').classList.toggle('neg',x<0)};
  if(!sure){shKasaGor=v;yaz(v);return}const a=shKasaGor,t0=performance.now();
  const f=now=>{const u=Math.min(1,(now-t0)/sure),e=1-Math.pow(1-u,3);shKasaGor=Math.round(a+(v-a)*e);yaz(shKasaGor);if(u<1)shRAF=requestAnimationFrame(f)};shRAF=requestAnimationFrame(f)}
// ızgara simgesi: resmin kendisinden (kilitli ya da açık göz)
const IZG_IMG=(acik)=>acik?`<span class="izr" style="background-image:url(${G}izgara-3.webp)"></span>`:`<span class="izr kil">${ic('kilit')}</span>`;
function reddet(el){ses('uyari');tit();el.classList.remove('red');void el.offsetWidth;el.classList.add('red')}
function upAl(k){if(SH.mesgul)return false;const {mx,c,l}=upDurum(k);
  if(mx||!alabilir(c))return false;
  SAVE.coins-=c;SAVE.up[k]=l+1;
  // oyunda: günün kasasından da düşer (gün sonunda SAVE.coins zaten günün kasasından yazılır; yarıda bırakılırsa kasa0'dan)
  if(SH.oyunda){S.kasa-=c;S.kasa0-=c;S.alis=(S.alis|0)+c;kasaGor=S.kasa;S.cfg=VERI.gun6(S.gun,SAVE.up)}
  if(k==='slot'){const n=VERI.izgaraGoz(SAVE.up);S.izg.forEach((g,i)=>{if(i<n&&!g.acik){g.acik=true;izgaraCiz(i);const el=MK.iz[i];if(el){el.classList.remove('kon');void el.offsetWidth;el.classList.add('kon')}}})}
  save();ses('satin');tit('orta');shopKasa(shKasa(),500);esyaCiz();dkCiz();return true}
// ana menü: ilerleme (dükkânda harcanan / hepsinin fiyatı), alınan öğe sayısı, son günün kârı
function ilerleme(){let top=0,har=0,n=0,N=0;VERI.SATILIK.forEach(k=>{const G_=VERI.GELISTIR[k],l=SAVE.up[k]|0;for(let i=0;i<G_.max;i++){const c=G_.cost(i);top+=c;N++;if(i<l){har+=c;n++}}});
  return {yuzde:top?Math.floor(100*har/top):0,n,N}}
function ilerCiz(){const el=$('hIler');if(!el)return;const p=ilerleme(),sn=SAVE.son;
  el.innerHTML=`<div class="ir"><b>${t('iler',p.yuzde)}</b><span>${t('dukN',p.n,p.N)}</span></div><div class="prog"><b style="width:${p.yuzde}%"></b></div>`+
    (sn?`<small>${t('sonKar',(sn.net>=0?'+':'−')+fmt(Math.abs(sn.net)))}</small>`:'')}
$('shBack').onclick=shopKapat;
$('shopBtn').onclick=()=>{ses('tik');openShop(false)};
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
if(DEBUG)window.__bu={S,SAVE,VERI,LAY,burgerHTML,burgerYuk,KAT,startDay,bitir,adim,openHome,openShop,shopKapat,upAl,alinabilir,save,fit,SES,WHO,musteriGorsel,
  dokun:k=>dokun(k,MK.hit[k]),musteri:i=>S.cust[i]&&musteriDokun(S.cust[i]),hit:k=>MK.hit[k],topla,toplaHepsi,dkSec,DK,ilerleme,canliKur,
  basla:()=>{const g=$('go');if(g)g.click()},durum:()=>({hk:S.hk,hp:S.hp,dogra:S.dogra,fr:{...S.fr},burger:S.burger.slice(),tepsi:S.tepsi.map(x=>({...x})),sec:S.sec,izg:S.izg.map(x=>({...x})),
    cust:S.cust.map(c=>c&&{i:c.i,f:+(c.p/c.max).toFixed(2),ruh:c.ruh,durum:{burger:c.durum.burger,yan:c.durum.yan}}),kasa:S.kasa,kasaGor,seri:S.seri,paused:S.paused,bitti:S.bitti,kacan:S.kacan,saat:S.saat,sure:S.sure,gelen:S.gelen,tezgah:S.tezgah,yig:S.yig.map(y=>y&&{u:y.u,b:y.b,el:!!y.el}),gorunen:kasaGorunen(),rehber:S.rehber})};
openHome();fit();
})();
