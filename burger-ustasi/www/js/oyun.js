/* Burger Ustası 2.0: oynanış, arayüz, ekranlar (çekirdek).
   Modüller: BU.VERI (ekonomi), BU.SIMGE (simgeler), BU.SES (ses), BU.BURGER (çizim). Biri yoksa küçük bir yedekle çalışır.
   Akış: tepsiden malzeme seç → tabağa dokun (koy) → yığını müşteriye sürükle (teslim) ya da çöpe sürükle.
   Köfte ızgarada pişer, pişince tepsideki Köfte kutusuna uçar (stok, en çok STOK_MAX). */
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
const YSES={ac(){},cal(){},muzik(){},ayar(){},durdur(){}};
const YB=(()=>{const src=k=>{k=k==='bunBot'||k==='bunTop'?'bun':k;return 'g/'+k+({bun:1,cheese:1,patty:1,raw:1}[k]?'.svg':'.webp')};
  return {simge:k=>`<img src="${src(k)}" alt="">`,CSS:'',
    yigin:(ks,o)=>`<div style="display:flex;flex-direction:column-reverse;align-items:center;width:${o.gen}">`+ks.map((k,i)=>`<span class="${i===ks.length-1&&o.yeni!==false?'bu-yeni':''}" style="display:block;width:100%;height:${o.yukMax?'calc('+o.yukMax+'/'+Math.max(4,ks.length)+')':'4cqw'};background:${k.startsWith('bun')?'#f4c676':'#8a4a26'};border:2px solid #3a1d0c;border-radius:9px"></span>`).join('')+'</div>',
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

/* ================= metinler ================= */
const T={
 tr:{day:n=>`Gün ${n}`,play:'OYNA',cont:n=>`OYNA · Gün ${n}`,grill:'Izgara',logo2:'USTASI',plate:n=>`Tabak ${n}`,trash:'Çöp',newIng:'YENİ',lockDay:n=>`Gün ${n}`,
  dayT:n=>`Gün ${n}`,dayP:'Burgeri hazırla, müşteriye sürükle. Üç can gidince dükkân kapanır.',cust:n=>`${n} müşteri`,start:'Başla',newT:'Yeni malzeme!',
  winT:'Gün bitti!',failT:'Dükkân kapandı!',failP:'Üç can gitti. Bir daha dene!',next:'Sonraki gün',retry:'Tekrar dene',home:'Ana menü',
  pauseT:'Durakladı',resume:'Devam',fx:'Efekt',music:'Müzik',
  gelir:'Gelir',gider:'Gider',net:'Net kâr',bahsis:'Bahşiş',kasa:'Kasa',
  needBun:'Önce ekmek!',closed:'Burger kapandı!',full:'Tabak dolu!',noPatty:'Köfte yok: ızgaraya dokun!',stockFull:'Köfte kutusu dolu',pick:'Önce malzeme seç',cooking:'Pişiyor…',
  gone:'Gitti!',wrong:'Yanlış!',tip:'bahşiş',angryPay:'Ödemedi!',
  g:{selBun:'Ekmeği seç',tapPlate:'Tabağa dokun',tapGrill:'Izgaraya dokun: köfte pişir',cooking:'Köfte pişiyor…',sel:k=>`${T.tr.acc[k]} seç`,close:'Ekmekle kapat',drag:'Burgeri müşteriye sürükle',trashIt:'Yanlış oldu: çöpe sürükle'},
  acc:{bun:'Ekmeği',patty:'Köfteyi',cheese:'Peyniri',lettuce:'Marulu',tomato:'Domatesi',onion:'Soğanı',bacon:'Pastırmayı',egg:'Yumurtayı',pickle:'Turşuyu'},
  ing:{bun:'Ekmek',patty:'Köfte',cheese:'Peynir',lettuce:'Marul',tomato:'Domates',onion:'Soğan',bacon:'Pastırma',egg:'Yumurta',pickle:'Turşu'},
  up:{cook:['Hızlı ızgara','Köfte daha çabuk pişer'],pat:['Sabırlı müşteri','Daha uzun beklerler'],tip:['Cömert bahşiş','Daha çok bahşiş'],slot:['Geniş ızgara','3. ızgara gözü']},max:'TAM',
  credit:'Yiyecek görselleri: Bluc (itch.io)',sound:'Ses',lang:'Dil',pause:'Duraklat',lives:'Can'},
 en:{day:n=>`Day ${n}`,play:'PLAY',cont:n=>`PLAY · Day ${n}`,grill:'Grill',logo2:'MASTER',plate:n=>`Plate ${n}`,trash:'Trash',newIng:'NEW',lockDay:n=>`Day ${n}`,
  dayT:n=>`Day ${n}`,dayP:'Build the burger and drag it to the customer. Lose three lives and the shop closes.',cust:n=>`${n} customers`,start:'Start',newT:'New ingredient!',
  winT:'Day complete!',failT:'Shop closed!',failP:'You lost three lives. Try again!',next:'Next day',retry:'Try again',home:'Main menu',
  pauseT:'Paused',resume:'Resume',fx:'Sound',music:'Music',
  gelir:'Income',gider:'Costs',net:'Profit',bahsis:'Tips',kasa:'Cash',
  needBun:'Bun first!',closed:'Burger is closed!',full:'Plate is full!',noPatty:'No patties: tap the grill!',stockFull:'Patty box is full',pick:'Pick an ingredient first',cooking:'Cooking…',
  gone:'Left!',wrong:'Wrong!',tip:'tip',angryPay:'No pay!',
  g:{selBun:'Pick the bun',tapPlate:'Tap the plate',tapGrill:'Tap the grill: cook a patty',cooking:'The patty is cooking…',sel:k=>`Pick the ${T.en.ing[k].toLowerCase()}`,close:'Close it with the bun',drag:'Drag the burger to the customer',trashIt:'Oops: drag it to the trash'},
  acc:{},
  ing:{bun:'Bun',patty:'Patty',cheese:'Cheese',lettuce:'Lettuce',tomato:'Tomato',onion:'Onion',bacon:'Bacon',egg:'Egg',pickle:'Pickle'},
  up:{cook:['Fast grill','Patties cook quicker'],pat:['Patient customers','They wait longer'],tip:['Big tippers','Bigger tips'],slot:['Wide grill','A 3rd grill slot']},max:'MAX',
  credit:'Food art: Bluc (itch.io)',sound:'Sound',lang:'Language',pause:'Pause',lives:'Lives'}};

/* ================= kayıt ================= */
const KEY='burgerustasi.v1';
const SAVE=(()=>{let o={};try{o=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){}
  const d={day:1,coins:0,stars:{},up:{cook:0,pat:0,tip:0,slot:0},lang:(navigator.language||'tr').toLowerCase().startsWith('tr')?'tr':'en',seen:[],ayar:{efekt:true,muzik:true}};
  const s=Object.assign({},d,o);s.up=Object.assign({},d.up,o.up||{});s.ayar=Object.assign({},d.ayar,o.ayar||{});if(!Array.isArray(s.seen))s.seen=[];if(!s.stars||typeof s.stars!=='object')s.stars={};
  if(s.lang!=='tr'&&s.lang!=='en')s.lang='tr';s.coins=Math.max(0,Math.round(+s.coins||0));s.day=Math.max(1,s.day|0);return s})();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(SAVE))}catch(e){}};
const t=(k,...a)=>{const v=T[SAVE.lang][k];return typeof v==='function'?v(...a):v};
const tg=(k,...a)=>{const v=T[SAVE.lang].g[k];return typeof v==='function'?v(...a):v};

/* ================= ses ve dokunsal ================= */
let sesAcik=false;
function sesKilit(){if(sesAcik)return;sesAcik=true;try{SES.ac();SES.ayar({efekt:SAVE.ayar.efekt,muzik:SAVE.ayar.muzik});SES.muzik(!!SAVE.ayar.muzik)}catch(e){}}
document.addEventListener('pointerdown',sesKilit,{capture:true});
const ses=ad=>{if(!SAVE.ayar.efekt)return;try{SES.cal(ad)}catch(e){}};
function tit(tur){try{const H=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.Haptics;
  if(H){tur==='ag'?H.notification({type:'ERROR'}):H.impact({style:tur==='orta'?'MEDIUM':'LIGHT'});return}
  navigator.vibrate&&navigator.vibrate(tur==='ag'?[40,50,40]:tur==='orta'?20:8)}catch(e){}}
function sesAyar(){try{SES.ayar({efekt:SAVE.ayar.efekt,muzik:SAVE.ayar.muzik});SES.muzik(!!SAVE.ayar.muzik)}catch(e){}save()}

/* ================= yardımcılar ================= */
const cq=()=>APP.clientWidth/100;
function rel(el){const r=el.getBoundingClientRect(),a=APP.getBoundingClientRect();return {x:r.left-a.left,y:r.top-a.top,w:r.width,h:r.height,cx:r.left-a.left+r.width/2,cy:r.top-a.top+r.height/2}}
const icinde=(p,r,pay=0)=>p.x>=r.x-pay&&p.x<=r.x+r.w+pay&&p.y>=r.y-pay&&p.y<=r.y+r.h+pay;
function yazi(x,y,html,cls,gec=0){const go=()=>{const d=document.createElement('div');d.className='yazi '+cls;d.innerHTML=html;d.style.left=x+'px';d.style.top=y+'px';FX.appendChild(d);setTimeout(()=>d.remove(),1400)};gec?setTimeout(go,gec):go()}
function uyari(el,msg){const r=rel(el);const d=document.createElement('div');d.className='uyari';d.textContent=msg;FX.appendChild(d);
  const w=d.offsetWidth,W=APP.clientWidth;d.style.left=Math.min(W-w/2-4,Math.max(w/2+4,r.cx))+'px';d.style.top=Math.max(d.offsetHeight+4,r.y+2*cq())+'px';setTimeout(()=>d.remove(),1350);ses('uyari');tit()}
// küçük bir nesneyi yay çizerek uçurur (WAAPI). from/to: app içi merkez noktaları
function ucur(html,from,to,{sure=420,yay=-10,s0=1,s1=1,don=0,cls=''}={}){
  const d=document.createElement('div');d.className='ucan '+cls;d.innerHTML=html;d.style.left=from.x+'px';d.style.top=from.y+'px';FX.appendChild(d);
  const dx=to.x-from.x,dy=to.y-from.y,ay=yay*cq(),tr=(x,y,s,r)=>`translate(-50%,-50%) translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
  return new Promise(res=>{let bitti=false;const son=()=>{if(bitti)return;bitti=true;d.remove();res()};
    try{const a=d.animate([{transform:tr(0,0,s0,0)},{transform:tr(dx*.5,dy*.5+ay,(s0+s1)/2*1.08,don/2),offset:.5},{transform:tr(dx,dy,s1,don)}],{duration:sure,easing:'cubic-bezier(.35,.1,.45,1)',fill:'forwards'});a.onfinish=son}catch(e){}
    setTimeout(son,sure+250)})}
// sabır rengi: yeşil → sarı → turuncu → kırmızı, kesintisiz
const DUR=[[0,[229,50,43]],[.3,[240,138,36]],[.6,[242,194,48]],[1,[60,196,90]]];
function sabirRenk(f){f=Math.max(0,Math.min(1,f));for(let i=1;i<DUR.length;i++){const [b,cb]=DUR[i],[a,ca]=DUR[i-1];if(f<=b){const u=(f-a)/(b-a);return `rgb(${ca.map((v,j)=>Math.round(v+(cb[j]-v)*u)).join(',')})`}}return 'rgb(60,196,90)'}

/* ================= durum ================= */
const S={on:false,paused:false,gun:1,cfg:null,kasa:0,kasa0:0,gelir:0,gider:0,bahsis:0,sayi:{mutlu:0,somurtkan:0,kizgin:0},kacan:0,yanlis:0,can:3,kalan:0,bitti:0,seri:0,
  tabak:[[],[],],sec:null,stok:0,ucan:0,izgara:[],cust:[null,null,null],now:0,nextAt:0,rehber:false,surukle:null,bitis:false};
const queue=$('queue'),tray=$('tray'),grillEl=$('grill'),TB=[$('t0'),$('t1')],COP=$('cop');
const WHO=window.KARAKTERLER||[];
function pickWho(){if(!WHO.length)return null;const busy=S.cust.filter(Boolean).map(c=>c.who);let k,n=0;do{k=WHO[Math.floor(Math.random()*WHO.length)];n++}while(busy.includes(k)&&n<20);return k}
function face(c,e){if(!c.who||!window.Musteri||c.emo===e)return;c.emo=e;c.yuzEl.innerHTML=Musteri.draw(c.who.m,e)}

/* ================= üst bilgi ================= */
let kasaSon=null;
function hud(){const k=$('kasa');k.textContent=S.kasa;$('kasaC').classList.toggle('neg',S.kasa<0);
  if(kasaSon!==null&&kasaSon!==S.kasa){$('kasaC').classList.remove('pop');void $('kasaC').offsetWidth;$('kasaC').classList.add('pop')}kasaSon=S.kasa;
  $('gunC').textContent=t('day',S.gun);$('prog').style.width=(S.cfg?100*S.bitti/S.cfg.musteri:0)+'%';
  const cn=$('canlar');cn.setAttribute('aria-label',t('lives')+' '+S.can);
  if(cn.children.length!==3)cn.innerHTML=[0,1,2].map(()=>'<span></span>').join('');
  [...cn.children].forEach((s,i)=>{const dolu=i<S.can,ad=dolu?'can':'can_bos';if(s.dataset.ad!==ad){if(s.dataset.ad==='can'&&!dolu){s.classList.remove('gitti');void s.offsetWidth;s.classList.add('gitti')}s.dataset.ad=ad;s.innerHTML=ic(ad)}s.classList.toggle('bos',!dolu)})}
function sesBtn(){const on=SAVE.ayar.efekt||SAVE.ayar.muzik;$('sesBtn').innerHTML=ic(on?'ses_acik':'ses_kapali');$('sesBtn').setAttribute('aria-label',t('sound'))}
$('sesBtn').onclick=()=>{const on=SAVE.ayar.efekt||SAVE.ayar.muzik;SAVE.ayar.efekt=SAVE.ayar.muzik=!on;sesAyar();sesBtn();ses('tik')};

/* ================= tepsi ================= */
const ANAHTAR=()=>VERI.MALZEME.map(m=>m.k);
function malGun(k){const m=VERI.MALZEME.find(x=>x.k===k);return m?m.gun:1}
function buildTray(){const acik=VERI.acik(S.gun);tray.innerHTML='';
  ANAHTAR().forEach(k=>{const b=document.createElement('button');const kilit=!acik.includes(k),g=malGun(k);
    b.className='ing'+(kilit?' kilit':'')+(!kilit&&g===S.gun&&S.gun>1?' yeni-m':'');b.dataset.k=k;b.setAttribute('aria-label',t('ing')[k]);
    if(!kilit&&g===S.gun&&S.gun>1)b.dataset.yeni=t('newIng');
    const im=BURGER.simge(k);
    b.innerHTML=`<span class="gol"></span><span class="im">${im}</span><span class="ad">${kilit?ic('kilit')+t('lockDay',g):t('ing')[k]}</span>`+(kilit?'':`<span class="al"><span class="im2">${im}</span></span>`)+(k==='patty'?'<span class="rozet">0</span>':'');
    if(!kilit)b.addEventListener('click',()=>sec(k));tray.appendChild(b)});
  trayDurum()}
function trayDurum(pop){tray.querySelectorAll('.ing').forEach(b=>{const k=b.dataset.k;b.classList.toggle('sec',S.sec===k)});
  const p=tray.querySelector('[data-k=patty]');if(p){p.classList.toggle('bos',!S.stok);const r=p.querySelector('.rozet');r.textContent=S.stok?'×'+S.stok:'0';
    if(pop){r.classList.remove('pop');void r.offsetWidth;r.classList.add('pop')}}}
function sec(k){if(!aktif())return S.sec;if(!VERI.acik(S.gun).includes(k))return S.sec;
  if(S.sec===k){S.sec=null;ses('tik')}else{S.sec=k;ses('sec');tit()}
  if(S.sec==='patty'&&!S.stok)uyari(tray.querySelector('[data-k=patty]'),t('noPatty'));
  // seçim animasyonu yeniden başlasın
  const b=tray.querySelector(`[data-k="${k}"]`);if(b&&S.sec===k){b.classList.remove('sec');void b.offsetWidth}
  trayDurum();rehber();return S.sec}

/* ================= tabaklar ================= */
function cizTabak(i,yeni){const el=TB[i].querySelector('.yig');const ks=S.tabak[i];
  el.innerHTML=ks.length?BURGER.yigin(ks,{gen:OLC.gen,yukMax:OLC.yuk,yeni:!!yeni}):'';
  TB[i].querySelector('.tno').textContent=t('plate',i+1);
  if(yeni){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump')}}
function koy(i){if(!aktif())return false;const ks=S.tabak[i],tb=TB[i],k=S.sec,son=ks[ks.length-1];
  if(S.surukle&&S.surukle.ti===i&&S.surukle.drag)return false;
  if(!k){uyari(tb,t('pick'));rehber(true);return false}
  if(son==='bunTop'){uyari(tb,t('closed'));return false}
  if(ks.length>=KAT_MAX){uyari(tb,t('full'));return false}
  let kat=k;
  if(k==='bun')kat=ks.length?'bunTop':'bunBot';
  else{if(!ks.length){uyari(tb,t('needBun'));return false}
    if(k==='patty'&&!S.stok){uyari(tb,t('noPatty'));const g=S.izgara.find(x=>x.st===0)||S.izgara[0];if(g){g.el.classList.remove('parla');void g.el.offsetWidth;g.el.classList.add('parla');setTimeout(()=>g.el.classList.remove('parla'),1600)}return false}}
  // maliyet: köfte ızgarada ödendi; diğerleri burada (VERI.maliyet farkı, üst ekmek bedava olabilir)
  let fiyat=0;if(kat!=='patty')fiyat=VERI.maliyet([...ks,kat])-VERI.maliyet(ks)-(0);
  if(kat==='patty'){S.stok--;trayDurum()}
  ks.push(kat);harca(fiyat,tb);
  // avuçtaki malzeme tabağa uçar, sonra katman düşer
  const kut=tray.querySelector(`[data-k="${k}"] .al`)||tray.querySelector(`[data-k="${k}"]`);
  if(kut){const a=rel(kut),r=rel(tb.querySelector('.yig')),hedef={x:r.cx,y:r.y+r.h-yukseklik(tb)-6*cq()};
    ucur(`<span class="im2">${BURGER.simge(k)}</span>`,{x:a.cx,y:a.cy},hedef,{sure:150,yay:-4,s0:1.2,s1:1,cls:'mal'})}
  cizTabak(i,true);ses('birak:'+kat);tit();rehber();return true}
function yukseklik(tb){const y=tb.querySelector('.bu-yigin');return y?y.getBoundingClientRect().height:0}
function harca(n,el){if(!n)return;S.kasa-=n;S.gider+=n;hud();const r=rel(el);yazi(r.cx+5*cq(),r.y+r.h*.35,`−${n}${PARA()}`,'mini')}

/* ================= ızgara ================= */
function buildGrill(){const n=2+(SAVE.up.slot?1:0);grillEl.querySelectorAll('.gs').forEach(e=>e.remove());S.izgara=[];
  for(let i=0;i<n;i++){const b=document.createElement('button');b.className='gs';b.setAttribute('aria-label',t('grill')+' '+(i+1));b.addEventListener('click',()=>izgara(i));grillEl.appendChild(b);const g={el:b,st:0,t:0};S.izgara.push(g);bosGoz(g)}
  $('grillT').textContent=t('grill')}
function bosGoz(g){g.st=0;g.t=0;g.el.className='gs';g.el.innerHTML=`<span class="art">${ic('artı')}</span>`}
function izgara(i){if(!aktif())return false;const g=S.izgara[i];if(!g)return false;
  if(g.st===0){const m=VERI.maliyet(['patty']);g.st=1;g.t=0;g.el.className='gs cig';
    g.el.innerHTML=`<span class="kof"><img src="g/raw.svg" alt=""><img class="pis" src="g/patty.svg" alt=""></span><span class="halka"><b></b></span><span class="duman d1"></span><span class="duman d2"></span>`;
    harca(m,g.el);ses('izgara');tit();rehber();return true}
  if(g.st===2){uyari(g.el,t('stockFull'));return false}
  ses('tik');return false}
function izgaraAdim(dt){const ps=VERI.pisme(SAVE.up);S.izgara.forEach(g=>{
  if(g.st===1){g.t+=dt;const f=Math.min(1,g.t/ps);const b=g.el.querySelector('.halka b');if(b)b.style.width=f*100+'%';g.el.style.setProperty('--pis',f.toFixed(3));
    if(g.t>=ps){g.st=2;g.el.className='gs hazir';g.el.querySelector('.kof').innerHTML='<img src="g/patty.svg" alt="">';ses('pisti');rehber()}}
  if(g.st===2&&S.stok+S.ucan<STOK_MAX){S.ucan++;const a=rel(g.el);bosGoz(g);const kut=tray.querySelector('[data-k=patty]');
    const r=kut?rel(kut):{cx:a.cx,cy:a.cy+40*cq()};
    ucur('<img src="g/patty.svg" alt="">',{x:a.cx,y:a.cy},{x:r.cx,y:r.cy-1*cq()},{sure:480,yay:-9,s0:1.1,s1:.85,don:200,cls:'kof'}).then(()=>{S.ucan--;S.stok++;trayDurum(true);
      if(kut){kut.classList.remove('dolu-gel');void kut.offsetWidth;kut.classList.add('dolu-gel')}ses('birak:patty');rehber()});
    rehber()}})}

/* ================= müşteriler ================= */
function spawn(){const bos=[0,1,2].filter(i=>!S.cust[i]);const n=S.cust.filter(Boolean).length;if(!bos.length||n>=S.cfg.sira||S.kalan<=0)return false;
  const i=bos.length===3?1:bos[Math.floor(Math.random()*bos.length)];
  const sip=S.rehber?['bunBot','patty','cheese','bunTop']:VERI.siparis(S.gun,Math.random),who=pickWho();
  const el=document.createElement('div');el.className='cust';
  el.innerHTML=`<div class="bub"><div class="sip">${BURGER.siparis(sip,{gen:'28.6cqw'})}</div><div class="sabir"><b></b></div></div><div class="yuz" role="img" aria-label="${who?who.ad:''}"></div>`;
  queue.children[i].appendChild(el);requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('in')));
  const sb=typeof S.cfg.sabirSiparis==='function'?S.cfg.sabirSiparis(sip):(VERI.sabirSiparis?VERI.sabirSiparis(sip,S.gun,SAVE.up):S.cfg.sabir);
  const max=S.rehber?Math.max(240,sb*6):sb;
  const c=S.cust[i]={i,el,sip,max,p:max,who,yuzEl:el.querySelector('.yuz'),fill:el.querySelector('.sabir b'),emo:'',ruh:'mutlu',tut:0,rehberli:S.rehber};
  face(c,'happy');S.kalan--;return true}
function ayril(c,tur){if(S.cust[c.i]!==c)return;S.cust[c.i]=null;c.el.classList.add('cik',tur==='mutlu'?'mutlu-git':tur==='kizgin'?'kizgin-git':'normal-git');c.el.classList.remove('hedef');
  setTimeout(()=>{c.el.classList.add('out');setTimeout(()=>c.el.remove(),500)},tur==='mutlu'?800:tur==='kizgin'?900:500);
  S.bitti++;if(c.rehberli)S.rehber=false;hud();setTimeout(kontrol,50)}
function custAdim(dt){S.cust.forEach(c=>{if(!c)return;c.p-=dt;const f=Math.max(0,c.p/c.max);
  c.fill.style.width=(f*100).toFixed(2)+'%';c.fill.style.background=sabirRenk(f);
  const r=VERI.ruh(f);if(r!==c.ruh){c.ruh=r;c.el.classList.toggle('kizgin',r==='kizgin')}
  if(S.now>=c.tut)face(c,VERI.yuz(f));
  if(c.p<=0)kacti(c)})}
function kacti(c){face(c,'angry');S.can--;S.kacan++;S.sayi.kizgin++;S.seri=0;const r=rel(c.yuzEl);yazi(r.cx,r.y+r.h*.3,t('gone'),'kotu');ses('kacti');setTimeout(()=>ses('can_gitti'),180);tit('ag');ayril(c,'kizgin');rehber()}

/* ================= teslim ================= */
// tabaktaki yığını müşteriye ver. Sonuç VERI.odeme ile; para efekti sonuca göre.
function teslim(ti,ci,gec=0){if(!aktif())return null;const ks=S.tabak[ti],c=S.cust[ci];if(!c||!ks||!ks.length)return null;
  const f=Math.max(0,c.p/c.max),seri=S.seri+1;
  const o=VERI.odeme(c.sip,ks.slice(),f,SAVE.up,seri);
  S.tabak[ti]=[];cizTabak(ti,false);
  const gelir=(o.ucret||0)+(o.bahsis||0);S.kasa+=gelir;S.gelir+=gelir;S.bahsis+=o.bahsis||0;
  const yr=rel(c.yuzEl),x=yr.cx,y=yr.y+yr.h*.12;
  let tur;
  if(o.dogru&&o.ruh==='mutlu'){tur='mutlu';S.seri++;S.sayi.mutlu++;
    setTimeout(()=>{face(c,'love');ses('teslim_mutlu');tit('orta');hud()},gec);
    yazi(x,y,`+${o.ucret}${PARA()}`,'iyi',gec);if(o.bahsis)yazi(Math.min(APP.clientWidth-12*cq(),Math.max(12*cq(),x+6*cq())),y-9*cq(),`<span class="s">+${o.bahsis}${PARA()}</span><small>${t('tip')}</small>`,'bahsis',gec+260)}
  else if(o.dogru&&o.ruh==='somurtkan'){tur='normal';S.seri=0;S.sayi.somurtkan++;
    setTimeout(()=>{face(c,'wait');ses('teslim_normal');hud()},gec)}   // somurtkan: efekt yok
  else{tur='kizgin';S.seri=0;S.sayi.kizgin++;if(!o.dogru)S.yanlis++;
    setTimeout(()=>{face(c,'angry');ses(o.dogru?'teslim_kizgin':'yanlis');tit('ag');hud()},gec);
    yazi(x,y,`−${o.kayip||0}${PARA()}`,'kotu',gec)}
  if(o.can){S.can--;setTimeout(()=>ses('can_gitti'),gec+200)}
  c.tut=S.now+99;hud();setTimeout(()=>ayril(c,tur),gec);rehber();return o}
function copeAt(ti){if(!aktif()||!S.tabak[ti].length)return false;S.tabak[ti]=[];cizTabak(ti,false);COP.classList.remove('yut');void COP.offsetWidth;COP.classList.add('yut');ses('cop');tit();rehber();return true}

/* ---- sürükle-bırak (Pointer Events) ---- */
function surukleBagla(i){const el=TB[i];
  el.addEventListener('pointerdown',e=>{if(!aktif()||S.surukle)return;if(e.button>0)return;e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch(_){}
    S.surukle={id:e.pointerId,ti:i,x0:e.clientX,y0:e.clientY,drag:false,el:null,hedef:null}});
  el.addEventListener('pointermove',e=>{const d=S.surukle;if(!d||d.id!==e.pointerId)return;
    if(!d.drag){if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<8)return;if(!S.tabak[i].length||!aktif()){return}baslat(d)}
    tasi(d,e)});
  el.addEventListener('pointerup',e=>{const d=S.surukle;if(!d||d.id!==e.pointerId)return;S.surukle=null;
    if(!d.drag){koy(i);return}birak(d,e)});
  el.addEventListener('pointercancel',e=>{const d=S.surukle;if(!d||d.id!==e.pointerId)return;S.surukle=null;if(d.drag)geriDon(d)});
  el.addEventListener('lostpointercapture',e=>{const d=S.surukle;if(!d||d.id!==e.pointerId)return;S.surukle=null;if(d.drag)geriDon(d)})}
function baslat(d){d.drag=true;const tb=TB[d.ti];const yg=tb.querySelector('.bu-yigin');
  const g=document.createElement('div');g.className='hayalet';g.innerHTML=`<div class="gov">${BURGER.yigin(S.tabak[d.ti],{gen:OLC.gen,yukMax:OLC.yuk,yeni:false})}</div>`;g.style.width=OLC.gen;FX.appendChild(g);d.el=g;
  tb.classList.add('tasiniyor');ses('al');tit();rehberGizle()}
function tasi(d,e){const a=APP.getBoundingClientRect(),x=e.clientX-a.left,y=e.clientY-a.top;d.x=x;d.y=y;
  const g=d.el,w=g.offsetWidth,h=g.offsetHeight,lift=6*cq();
  g.style.transform=`translate(${x-w/2}px,${y-h-lift}px)`;d.gm={x,y:y-lift-h/2};
  const h2=hedefBul(d);if(h2!==d.hedef){if(d.hedef!==null)hedefIsaret(d.hedef,false);d.hedef=h2;if(h2!==null)hedefIsaret(h2,true)}}
function hedefBul(d){const pts=[d.gm,{x:d.x,y:d.y}];
  if(pts.some(p=>icinde(p,rel(COP),3*cq())))return 'cop';
  for(const c of S.cust){if(!c)continue;const r=rel(c.el);if(pts.some(p=>icinde(p,r,1.5*cq())))return c.i}
  return null}
function hedefIsaret(h,on){if(h==='cop')COP.classList.toggle('hedef',on);else{const c=S.cust[h];if(c)c.el.classList.toggle('hedef',on)}}
function birak(d){const h=d.hedef;if(h!==null)hedefIsaret(h,false);
  if(h==='cop'){const r=rel(COP);hayaletUc(d,{x:r.cx,y:r.cy},{s:.25,don:40}).then(()=>bitir_(d));copeAt(d.ti);return}
  if(h!==null&&S.cust[h]&&aktif()){const c=S.cust[h],r=rel(c.yuzEl);hayaletUc(d,{x:r.cx,y:r.y+r.h*.55},{s:.35}).then(()=>bitir_(d));teslim(d.ti,h,200);return}
  geriDon(d)}
function geriDon(d){if(d.hedef!==null)hedefIsaret(d.hedef,false);const yg=TB[d.ti].querySelector('.yig'),r=rel(yg);
  hayaletUc(d,{x:r.cx,y:r.y+r.h/2},{s:1/1.1,sure:220}).then(()=>bitir_(d));ses('geri')}
function bitir_(d){TB[d.ti].classList.remove('tasiniyor');if(d.el)d.el.remove();d.el=null;rehber()}
function hayaletUc(d,to,{s=1,don=0,sure=260}={}){const g=d.el;if(!g)return Promise.resolve();const w=g.offsetWidth,h=g.offsetHeight;
  const from=g.style.transform||'',tx=to.x-w/2,ty=to.y-h/2;
  return new Promise(res=>{let ok=false;const son=()=>{if(ok)return;ok=true;res()};
    try{const a=g.animate([{transform:from,opacity:1},{transform:`translate(${tx}px,${ty}px) scale(${s}) rotate(${don}deg)`,opacity:s<.5?.2:1}],{duration:sure,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});a.onfinish=son}catch(e){}
    setTimeout(son,sure+200)})}

/* ================= ilk gün rehberi ================= */
let rehberHedef=null,elAnim=null;
function rehberGizle(){document.querySelectorAll('.parla').forEach(e=>e.classList.remove('parla'));FX.querySelectorAll('.ipucu,.el').forEach(e=>e.remove());rehberHedef=null;elAnim=null}
function rehber(zorla){if(!S.on||!S.rehber){if(rehberHedef)rehberGizle();return}
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
    if(need==='patty'&&!S.stok&&S.sec!=='patty'||need==='patty'&&!S.stok){const pis=S.izgara.find(g=>g.st>0);
      if(pis||S.ucan){el=(pis||S.izgara[0]).el;msg=tg('cooking')}else{el=S.izgara[0].el;msg=tg('tapGrill')}}
    else if(S.sec!==need){el=kutu(need);msg=need==='bun'?(ks.length?tg('close'):tg('selBun')):need==='patty'?tg('sel','patty'):tg('sel',need)}
    else{el=TB[ti];msg=need==='bun'&&ks.length?tg('close'):tg('tapPlate')}}
  const anahtar=msg+'|'+(el&&el.id||el&&el.dataset.k||'')+'|'+(surukleEl?1:0);
  if(!zorla&&anahtar===rehberHedef)return;rehberGizle();rehberHedef=anahtar;if(!el)return;
  el.classList.add('parla');
  const tp=document.createElement('div');tp.className='ipucu';tp.innerHTML=ic('el')+`<span>${msg}</span>`;FX.appendChild(tp);
  const r=rel(el),w=tp.offsetWidth,h=tp.offsetHeight,W=APP.clientWidth;let x=Math.min(W-w-2*cq(),Math.max(2*cq(),r.cx-w/2)),y=r.y-h-2.4*cq();
  if(el.classList.contains('tabak'))y=r.y+.5*cq();   // tabakta: yazı tezgâhın içinde, müşterilerin üstüne binmez
  else if(y<rel($('street')).y+2*cq()){y=r.y+r.h+2.4*cq();tp.classList.add('alt')}
  tp.style.left=x+'px';tp.style.top=y+'px';tp.style.setProperty('--ok',Math.max(12,Math.min(w-12,r.cx-x))+'px');
  if(surukleEl){const hd=document.createElement('div');hd.className='el';hd.innerHTML=ic('el');FX.appendChild(hd);
    const to=surukleEl==='cop'?rel(COP):rel(surukleEl.yuzEl),s=6*cq();
    try{elAnim=hd.animate([{transform:`translate(${r.cx-s}px,${r.cy-s}px) scale(1)`,opacity:0},{opacity:1,offset:.12},{transform:`translate(${r.cx-s}px,${r.cy-s}px) scale(.9)`,offset:.22},{transform:`translate(${to.cx-s}px,${to.cy-s}px) scale(.9)`,opacity:1,offset:.8},{transform:`translate(${to.cx-s}px,${to.cy-s}px) scale(1)`,opacity:0}],{duration:1800,iterations:Infinity,easing:'ease-in-out'})}catch(e){}}}

/* ================= gün akışı ================= */
function aktif(){return S.on&&!S.paused&&!S.bitis}
function startDay(d,hemen){S.gun=d;S.cfg=VERI.gun(d,SAVE.up);S.kasa=S.kasa0=SAVE.coins;S.gelir=S.gider=S.bahsis=0;S.sayi={mutlu:0,somurtkan:0,kizgin:0};S.kacan=S.yanlis=0;S.can=3;
  S.kalan=S.cfg.musteri;S.bitti=0;S.seri=0;S.tabak=[[],[]];S.sec=null;S.stok=0;S.ucan=0;S.cust=[null,null,null];S.now=0;S.nextAt=.8;S.bitis=false;S.on=false;S.paused=false;
  S.rehber=d===1&&!SAVE.seen.includes('tut');
  [...queue.children].forEach(s=>s.innerHTML='');FX.innerHTML='';TB.forEach(x=>x.classList.remove('tasiniyor','parla'));
  buildTray();buildGrill();cizTabak(0);cizTabak(1);kasaSon=null;hud();sesBtn();$('home').hidden=true;$('copT').textContent=t('trash');$('copI').innerHTML=ic('cop');COP.setAttribute('aria-label',t('trash'));
  $('durBtn').innerHTML=ic('duraklat');$('durBtn').setAttribute('aria-label',t('pause'));$('kasaI').innerHTML=PARA();fit();
  const yeni=VERI.MALZEME.find(m=>m.gun===d&&d>1);
  const go=()=>{$('ov').hidden=true;S.on=true;S.paused=false;last=performance.now();ses('gun_basla');requestAnimationFrame(loop);rehber()};
  if(hemen){go();return}
  card(`<h2>${t('dayT',d)}</h2><div class="info"><span>${ic('gulen')}${t('cust',S.cfg.musteri)}</span><span>${PARA()}${S.kasa}</span></div><p>${t('dayP')}</p>`+
    (yeni?`<div class="newing"><span class="im">${BURGER.simge(yeni.k)}</span><span>${t('newT')}<br>${t('ing')[yeni.k]}</span></div>`:'')+
    `<div class="btns"><button class="btn" id="go">${ic('oynat')}${t('start')}</button></div>`);
  $('go').onclick=()=>{ses('tik');go()}}
function kontrol(){if(!S.on||S.bitis)return;if(S.can<=0){bitir(false);return}
  if(S.kalan<=0&&!S.cust.some(Boolean)){S.bitis=true;setTimeout(()=>{S.bitis=false;bitir(true)},900)}}
function bitir(win){if(!S.on)return;S.on=false;S.bitis=false;rehberGizle();if(S.surukle&&S.surukle.el){S.surukle.el.remove();TB[S.surukle.ti].classList.remove('tasiniyor')}S.surukle=null;
  SAVE.coins=Math.max(0,S.kasa);const net=S.gelir-S.gider,st=Math.max(win?1:0,Math.min(3,3-S.kacan-S.yanlis));
  if(win){SAVE.stars[S.gun]=Math.max(SAVE.stars[S.gun]||0,st);if(S.gun===1&&!SAVE.seen.includes('tut'))SAVE.seen.push('tut');SAVE.day=Math.max(SAVE.day,S.gun+1)}
  save();ses(win?'gun_bitti':'gun_kayip');
  const n=v=>`<b class="${v<0?'neg':v>0?'pos':''}">${v>0?'+':v<0?'−':''}${Math.abs(v)}${PARA()}</b>`;
  card(`<h2>${t(win?'winT':'failT')}</h2>`+(win?`<div class="stars">${[1,2,3].map(i=>`<span>${ic(i<=st?'yildiz':'yildiz_bos')}</span>`).join('')}</div>`:`<p>${t('failP')}</p>`)+
    `<div class="tablo"><div class="r"><span>${t('gelir')}</span>${n(S.gelir)}</div><div class="r"><span>${t('gider')}</span>${n(-S.gider)}</div><div class="r"><span>${t('bahsis')}</span>${n(S.bahsis)}</div><div class="r net"><span>${t('net')}</span>${n(net)}</div></div>`+
    `<div class="yuzler"><span title="${SAVE.lang==='tr'?'Mutlu':'Happy'}">${ic('gulen')}${S.sayi.mutlu}</span><span>${ic('somurtkan')}${S.sayi.somurtkan}</span><span>${ic('kizgin')}${S.sayi.kizgin}</span></div>`+
    `<div class="info"><span>${t('kasa')}: ${PARA()}${SAVE.coins}</span></div>`+
    `<div class="btns"><button class="btn" id="nx">${ic(win?'ileri':'tekrar')}${t(win?'next':'retry')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`);
  $('nx').onclick=()=>{ses('tik');startDay(win?S.gun+1:S.gun)};$('hm').onclick=()=>{ses('tik');openHome()}}
function card(html){$('card').innerHTML=html;$('ov').hidden=false}
function duraklat(){if(!S.on||S.paused)return;S.paused=true;rehberGizle();if(S.surukle&&S.surukle.drag){geriDon(S.surukle)}S.surukle=null;
  const kart=()=>{card(`<h2>${t('pauseT')}</h2><div class="ayarlar"><button class="tg${SAVE.ayar.efekt?'':' kapali'}" id="pE">${ic(SAVE.ayar.efekt?'ses_acik':'ses_kapali')}${t('fx')}</button><button class="tg${SAVE.ayar.muzik?'':' kapali'}" id="pM">${ic('muzik')}${t('music')}</button></div>`+
    `<div class="btns"><button class="btn" id="rs">${ic('oynat')}${t('resume')}</button><button class="btn alt" id="hm">${ic('ev')}${t('home')}</button></div>`);
    $('pE').onclick=()=>{SAVE.ayar.efekt=!SAVE.ayar.efekt;sesAyar();sesBtn();kart();ses('tik')};$('pM').onclick=()=>{SAVE.ayar.muzik=!SAVE.ayar.muzik;sesAyar();sesBtn();kart();ses('tik')};
    $('rs').onclick=()=>{ses('tik');S.paused=false;$('ov').hidden=true;last=performance.now();requestAnimationFrame(loop);rehber(true)};
    $('hm').onclick=()=>{ses('tik');S.on=false;openHome()}};   // gün yarıda bırakılırsa kasa değişmez
  kart()}
$('durBtn').onclick=()=>{ses('tik');duraklat()};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(S.on&&!S.paused)duraklat();try{SES.muzik(false)}catch(e){}}else if(sesAcik&&SAVE.ayar.muzik){try{SES.muzik(true)}catch(e){}}});

/* ================= döngü ================= */
let last=0;
function loop(now){if(!S.on||S.paused)return;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;adim(dt);requestAnimationFrame(loop)}
function adim(dt){S.now+=dt;const n=S.cust.filter(Boolean).length;
  if(S.kalan>0&&!S.bitis){
    if(S.rehber&&n>0){S.nextAt=Math.max(S.nextAt,S.now+1.5)}   // rehberde ilk müşteri bitmeden kimse gelmez
    else if(S.now>=S.nextAt){if(spawn()){const [a,b]=S.cfg.aralik;S.nextAt=S.now+a+Math.random()*(b-a);rehber()}else S.nextAt=S.now+.4}
    if(!n&&S.nextAt-S.now>1.2)S.nextAt=S.now+1.2}   // tezgâh boşsa bekletme
  custAdim(dt);izgaraAdim(dt)}

/* ================= ana ekran ================= */
const UPI={cook:'ates',pat:'kumsaati',tip:'kese',slot:'izgara'};
function heroFaces(){if(!WHO.length||!window.Musteri)return;const a=WHO[Math.floor(Math.random()*WHO.length)];let b;do{b=WHO[Math.floor(Math.random()*WHO.length)]}while(b===a&&WHO.length>1);
  $('heroA1').innerHTML=Musteri.draw(a.m,'happy');$('heroA2').innerHTML=Musteri.draw(b.m,'love')}
function openHome(){S.on=false;S.paused=false;rehberGizle();FX.innerHTML='';heroFaces();$('ov').hidden=true;$('home').hidden=false;document.documentElement.lang=SAVE.lang;
  $('playBtn').innerHTML=ic('oynat')+(SAVE.day>1?t('cont',SAVE.day):t('play'));$('logo2').textContent=t('logo2');
  $('langBtn').innerHTML=ic('dil')+(SAVE.lang==='tr'?'EN':'TR');$('langBtn').setAttribute('aria-label',t('lang'));$('credit').textContent=t('credit');
  $('hKasa').textContent=SAVE.coins;$('hKasaI').innerHTML=PARA();
  $('hEfekt').innerHTML=ic(SAVE.ayar.efekt?'ses_acik':'ses_kapali');$('hEfekt').classList.toggle('kapali',!SAVE.ayar.efekt);$('hEfekt').setAttribute('aria-label',t('fx'));
  $('hMuzik').innerHTML=ic('muzik');$('hMuzik').classList.toggle('kapali',!SAVE.ayar.muzik);$('hMuzik').setAttribute('aria-label',t('music'));
  $('heroB').innerHTML=BURGER.yigin(['bunBot','patty','cheese','lettuce','tomato','bunTop'],{gen:'40cqw',yukMax:'36cqw',yeni:false});
  const G=VERI.GELISTIR;
  $('ups').innerHTML=['cook','pat','tip','slot'].map(k=>{const u=G[k],l=SAVE.up[k]|0,mx=l>=u.max,c=u.cost(l),kilit=k==='slot'&&SAVE.day<4;
    return `<button class="up ${kilit?'kilit':mx?'max':SAVE.coins<c?'no':''}" data-u="${k}" aria-label="${t('up')[k][0]}"><span class="e">${ic(UPI[k])}</span><b>${t('up')[k][0]}</b><small>${t('up')[k][1]}</small>`+
      `<span class="pips">${Array.from({length:u.max},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')}</span>`+
      `<span class="c">${kilit?ic('kilit')+t('lockDay',4):mx?t('max'):PARA()+c}</span></button>`}).join('');
  $('ups').querySelectorAll('.up').forEach(b=>b.onclick=()=>{const k=b.dataset.u,u=G[k],l=SAVE.up[k]|0,c=u.cost(l);
    if(b.classList.contains('kilit')||l>=u.max){ses('uyari');return}if(SAVE.coins<c){ses('uyari');tit();return}
    SAVE.coins-=c;SAVE.up[k]=l+1;save();ses('satin');tit('orta');openHome();const nb=$('ups').querySelector(`[data-u="${k}"]`);if(nb)nb.classList.add('aldi')})}
$('playBtn').onclick=()=>{ses('tik');startDay(SAVE.day)};
$('langBtn').onclick=()=>{SAVE.lang=SAVE.lang==='tr'?'en':'tr';save();ses('tik');openHome()};
$('hEfekt').onclick=()=>{SAVE.ayar.efekt=!SAVE.ayar.efekt;sesAyar();ses('tik');openHome()};
$('hMuzik').onclick=()=>{SAVE.ayar.muzik=!SAVE.ayar.muzik;sesAyar();ses('tik');openHome()};

/* ================= ekran uyumu ================= */
// müşteri yüzü sokakta kalan yüksekliğe göre (baloncuk için pay bırakılır)
const OLC={gen:'23cqw',yuk:'31cqw'};
function fit(){const c=cq(),H=APP.clientHeight;if(!c)return;
  // uzun ekranda tepsi kutuları biraz uzar
  APP.style.setProperty('--kh',Math.min(23,Math.max(15.5,16+(H/c-180)*.25)).toFixed(2)+'cqw');
  const st=$('street'),h=st.clientHeight;if(h){const yz=Math.max(18*c,Math.min(32*c,(h+4*c-24*c-2*c)/1.2));APP.style.setProperty('--yz',yz+'px')}
  const ct=$('counter').clientHeight;if(ct){const gen=Math.min(25*c,(APP.clientWidth-41*c)/2-3*c);OLC.gen=Math.round(gen)+'px';OLC.yuk=Math.round(Math.max(26*c,ct-15*c))+'px';
    TB.forEach(x=>x.querySelector('.yig').style.width=OLC.gen)}
  if(S.tabak)[0,1].forEach(i=>cizTabak(i,false))}
addEventListener('resize',()=>{fit();if(S.on)rehber(true)});
TB.forEach((_,i)=>surukleBagla(i));

/* ================= test kancası ================= */
if(DEBUG)window.__bu={S,SAVE,VERI,startDay,sec,koy,teslim,izgara,bitir,copeAt,adim,openHome,save,EKSIK,
  basla:()=>{const g=$('go');if(g)g.click()},musteri:()=>S.cust.map(c=>c&&{sip:c.sip,f:c.p/c.max,ruh:c.ruh,emo:c.emo})};
openHome();fit();
})();
