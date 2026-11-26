// Dikey tutulan telefonda oyun yatay çizilir mi? (sayfa 90 derece döner; "telefonu çevir" ekranı yok)
// Kullanım: ana-menu klasöründe `python3 -m http.server 8850`, sonra `node tools/yatay-test.cjs [ekran-görüntüsü-klasörü]`
// İki telefon boyu (390x844, 375x667), dokunmatik: açılış (Sancar logosu), kayıt, ana menü, panel, küre sürükleme,
// onay ekranı (parmakla kaydırma), sohbet ve klavye, modal, ayarlar; en sonda telefon yan çevrilince dönüşün kalkması.
const pw=require('playwright'),fs=require('fs'),path=require('path');
const DIR=process.argv[2]||path.join(require('os').tmpdir(),'yatay');fs.mkdirSync(DIR,{recursive:true});
const URL='http://localhost:8850/index.html';
let kaldi=0;const ok=(ad,v,ek)=>{if(!v)kaldi++;console.log(v?'GEÇTİ':'KALDI',ad,ek!==undefined?JSON.stringify(ek):'')};
(async()=>{const b=await pw.chromium.launch();
for(const [W,H] of [[390,844],[375,667]]){console.log(`\n== ${W}x${H} (dikey) ==`);const ad=`${W}x${H}`;
  const c=await b.newContext({viewport:{width:W,height:H},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await c.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())});
  // artifact iskeleti charset ve viewport ekler; burada da eklenir
  await p.route('**/index.html*',async r=>{const res=await r.fetch();r.fulfill({body:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style>'+(await res.body()).toString('utf8'),headers:{'content-type':'text/html; charset=utf-8'}})});
  const cdp=await c.newCDPSession(p);
  /** Ekranda parmakla sürükleme (dokunma olaylarıyla). */
  const kaydir=async(x0,y0,x1,y1,n=12)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]});
    for(let i=1;i<=n;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/n,y:y0+(y1-y0)*i/n}]});await p.waitForTimeout(16)}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(400)};
  const foto=n=>p.screenshot({path:path.join(DIR,`${ad}-${n}.png`)});
  const ekranda=sel=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1},sel);

  // ---- açılış ----
  await p.goto(URL);await p.waitForTimeout(1600);
  const ac=await p.evaluate(()=>{const s=document.querySelector('.sgi'),r=s&&s.getBoundingClientRect(),g=s&&s.querySelector('svg').getBoundingClientRect();
    return s&&{don:document.documentElement.classList.contains('don'),ebeveyn:s.parentElement.tagName,tam:Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2,logoDik:g.height>g.width,logoIcerde:g.top>=0&&g.bottom<=innerHeight&&g.left>=0&&g.right<=innerWidth}});
  ok('Sancar açılışı dönük sayfada, tam ekran, logo yatay (ekranda dik duruyor) ve ekranın içinde',ac&&ac.don&&ac.tam&&ac.logoDik&&ac.logoIcerde,ac);
  ok('"telefonu çevir" ekranı yok',await p.evaluate(()=>!document.getElementById('cevir')&&!/Telefonu yan çevir/.test(document.body.innerText)));
  await foto('1-acilis');
  await p.waitForTimeout(6000);ok('açılış kendiliğinden bitti',await p.evaluate(()=>!document.querySelector('.sgi')));

  // ---- kayıt (modal) ----
  const sahne=await p.evaluate(()=>{const r=document.getElementById('sahne').getBoundingClientRect();return {w:r.width,h:r.height,l:r.left,t:r.top,r:r.right,b:r.bottom}});
  ok('sahne dönük (ekranda boyu eninden uzun) ve ekrana sığıyor',sahne.h>sahne.w&&sahne.l>=0&&sahne.t>=0&&sahne.r<=W+.5&&sahne.b<=H+.5,sahne);
  ok('sahne ekranı iyi kullanıyor (uzun kenarın en az %85i)',sahne.h>=H*.85||sahne.w>=W*.85,sahne);
  ok('kayıt penceresi açık',await p.isVisible('#kAd'));await foto('2-kayit');
  await p.locator('#kAd').tap();await p.keyboard.type('Eymen');await p.locator('#kBasla').tap();await p.waitForTimeout(700);
  ok('oyuncu oluştu (dokunarak)',await p.evaluate(()=>!!K.oyuncuId));
  if(await p.isVisible('#perde.acik #evet'))await p.locator('#evet').tap();
  await p.evaluate(()=>{kapat()});await p.waitForTimeout(300);
  await foto('3-ana-menu');

  // ---- küre: sahnede sağa sürükleme (ekranda aşağı) dünyayı boylamda döndürür ----
  await p.waitForFunction(()=>typeof proj!=='undefined'&&!!proj,null,{timeout:5000}).catch(()=>{});
  const kr=await p.evaluate(()=>{const r=document.getElementById('kure').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,h:r.height}});
  const d0=await p.evaluate(()=>[...don]);
  await p.mouse.move(kr.x,kr.y-kr.h*.25);await p.mouse.down();for(let i=1;i<=10;i++){await p.mouse.move(kr.x,kr.y-kr.h*.25+kr.h*.05*i);await p.waitForTimeout(16)}await p.mouse.up();await p.waitForTimeout(100);
  const d1=await p.evaluate(()=>[...don]);
  ok('küre: sahnede yatay sürükleme boylamı değiştirdi, enlemi değil',d1[0]-d0[0]>20&&Math.abs(d1[1]-d0[1])<1,{once:d0,sonra:d1});

  // ---- panel ----
  await p.locator('[data-menu="kariyer"]').tap();await p.waitForTimeout(400);
  ok('panel açıldı',await p.evaluate(()=>document.getElementById('panel').classList.contains('acik')));
  await p.locator('[data-sk="kurs"]').tap();await p.waitForTimeout(250);
  const gv=await p.evaluate(()=>{const g=document.getElementById('pGovde');return {kayar:g.scrollHeight>g.clientHeight,r:g.getBoundingClientRect().toJSON()}});
  if(gv.kayar){const r=gv.r,cx=r.left+r.width/2,cy=r.top+r.height/2;await kaydir(cx-r.width*.3,cy,cx+r.width*.3,cy);
    ok('panel listesi parmakla kaydı (ekranda sağa çekince sahnede aşağı)',await p.evaluate(()=>document.getElementById('pGovde').scrollTop>10))}
  ok('panel yerinde (dış kutu kaymadı)',await p.evaluate(()=>{const a=document.getElementById('alan'),r=document.getElementById('panel').getBoundingClientRect();return !a.scrollLeft&&!a.scrollTop&&r.top>=0&&r.left>=0}));
  await foto('4-panel');
  await p.locator('#pGeri').tap();await p.waitForTimeout(400);

  // ---- onay ekranı ----
  await p.locator('[data-sohbet="ulke"]').tap();await p.waitForTimeout(450);
  ok('onay ekranı açıldı, dönük sayfanın tamamını kaplıyor',await p.evaluate(()=>{const e=document.getElementById('onayEkran'),r=e.getBoundingClientRect();return e.classList.contains('acik')&&Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2}));
  ok('kabul düğmesi ekranda',await ekranda('#onKabul'));await foto('5-onay');
  const ok0=await p.evaluate(()=>document.getElementById('onKay').getBoundingClientRect().toJSON());
  for(let i=0;i<14&&await p.evaluate(()=>document.getElementById('onKabul').disabled);i++){const cx=ok0.left+ok0.width/2,cy=ok0.top+ok0.height/2;await kaydir(cx-ok0.width*.35,cy,cx+ok0.width*.35,cy)}
  ok('onay metni parmakla sonuna kadar kaydı, düğme açıldı',await p.evaluate(()=>!document.getElementById('onKabul').disabled));
  await foto('6-onay-son');
  await p.locator('#onKabul').tap();await p.waitForTimeout(500);

  // ---- sohbet ve klavye ----
  ok('sohbet açıldı ve tam ekran',await p.evaluate(()=>{const e=document.getElementById('sohbet'),r=e.getBoundingClientRect();return e.classList.contains('acik')&&r.width>=innerWidth-1&&r.height>=innerHeight-1}));
  ok('yazı kutusu ekranın sol kenarında (sahnenin altı)',await ekranda('#shGiris'));
  await foto('7-sohbet');
  const tr0=await p.evaluate(()=>document.getElementById('sahne').style.transform);
  await p.locator('#shGiris').tap();await p.waitForTimeout(200);
  // klavye: görünen alan ekranın üst kısmına iner
  const KH=Math.round(H*.58);await p.setViewportSize({width:W,height:KH});await p.waitForTimeout(500);
  const kl=await p.evaluate(()=>{const g=document.getElementById('shGiris').getBoundingClientRect(),s=document.getElementById('sohbet').getBoundingClientRect(),v=visualViewport;
    return {don:document.documentElement.classList.contains('don'),giris:g.bottom<=v.height+1&&g.top>=0&&g.left>=0&&g.right<=innerWidth+1,sohbet:s.bottom<=v.height+1,odak:document.activeElement.id}});
  ok('klavye açıkken sayfa dönük kalıyor, sohbet ve yazı kutusu klavyenin üstünde',kl.don&&kl.giris&&kl.sohbet&&kl.odak==='shGiris',kl);
  ok('klavye açılınca sahne yeniden ölçeklenmedi',await p.evaluate(t=>document.getElementById('sahne').style.transform===t,tr0));
  await p.keyboard.type('Merhaba Türkiye!');await p.locator('#shGonder').tap();await p.waitForTimeout(300);
  ok('mesaj gönderildi ve görünüyor',(await p.textContent('#shListe')).includes('Merhaba Türkiye!'));
  await foto('8-sohbet-klavye');
  await p.evaluate(()=>document.activeElement.blur());await p.setViewportSize({width:W,height:H});await p.waitForTimeout(600);
  ok('klavye kapanınca sohbet yeniden tam ekran',await p.evaluate(()=>{const r=document.getElementById('sohbet').getBoundingClientRect();return r.width>=innerWidth-1&&r.height>=innerHeight-1}));
  await p.locator('#shKapat').tap();await p.waitForTimeout(450);
  ok('sohbet kapandı, sahne yerinde',await p.evaluate(t=>!document.getElementById('sohbet').classList.contains('acik')&&document.getElementById('sahne').style.transform===t&&scrollY===0,tr0));

  // ---- telefon ve modal ----
  await p.locator('#telefon').tap();await p.waitForTimeout(500);await foto('9-telefon');
  await p.locator('[data-u="Haberler"]').tap();await p.waitForTimeout(250);ok('telefon > haberler açıldı',(await p.textContent('#tGovde')).length>20);
  await p.locator('#tKapat').tap();await p.waitForTimeout(450);
  await p.locator('[data-menu="kariyer"]').tap();await p.waitForTimeout(300);await p.locator('[data-sk="kurs"]').tap();await p.waitForTimeout(200);
  const kursBtn=p.locator('[data-kurs]').first();if(await kursBtn.count()){await kursBtn.tap();await p.waitForTimeout(300)}
  await p.locator('#pGeri').tap();await p.waitForTimeout(400);

  // ---- ayarlar ----
  await p.locator('#ayarlar').tap();await p.waitForTimeout(300);await foto('10-ayarlar');
  await p.locator('[data-tema="dark"]').tap();await p.waitForTimeout(200);
  ok('ayarlar: koyu tema dokunarak seçildi',await p.evaluate(()=>document.documentElement.dataset.theme==='dark'));
  await p.evaluate(()=>kapat());await p.waitForTimeout(300);await foto('11-koyu');

  // ---- telefon yan çevrilince dönüş kalkar ----
  await p.setViewportSize({width:H,height:W});await p.waitForTimeout(500);
  const yt=await p.evaluate(()=>{const r=document.getElementById('sahne').getBoundingClientRect();return {don:document.documentElement.classList.contains('don'),w:r.width,h:r.height}});
  ok('yatay tutunca dönüş yok, sahne yatay',!yt.don&&yt.w>yt.h,yt);await foto('12-yatay');
  await p.setViewportSize({width:W,height:H});await p.waitForTimeout(500);
  ok('yeniden dikeyde dönük',await p.evaluate(()=>document.documentElement.classList.contains('don')));
  ok('hata yok',!errs.length,errs);
  await c.close()}
// masaüstünde (fare) dar pencere döndürülmez
{const c=await b.newContext({viewport:{width:500,height:900}});const p=await c.newPage();await p.goto(URL+'?nosplash');await p.waitForTimeout(500);
  ok('masaüstü dar pencere: dönüş yok',await p.evaluate(()=>!document.documentElement.classList.contains('don')));await c.close()}
console.log(kaldi?`\n${kaldi} KALDI`:'\nhepsi GEÇTİ','| ekran görüntüleri:',DIR);await b.close();process.exit(kaldi?1:0)})();
