const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const c=await b.newContext({viewport:{width:852,height:393}});const p=await c.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.route('**/index.html',async r=>{const res=await r.fetch();r.fulfill({body:'<meta charset="utf-8">'+(await res.body()).toString('utf8'),headers:{'content-type':'text/html; charset=utf-8'}})});
await p.goto('http://localhost:8850/index.html');await p.waitForTimeout(800);
const ok=(ad,v)=>console.log(v?'GEÇTİ':'KALDI',ad);
const durum=()=>p.evaluate(()=>{const {w,p}=G();return {cash:p.cash,pend:p.pendingEarnings,prof:p.profession,tasks:p.tasksToday,kum:p.hourglasses,day:w.day,kurs:p.courseInProgress,props:p.propertyIds.length,loans:p.loans.length,okun:K.okunmamis,tost:document.getElementById('tost').textContent}});
ok('kayıt penceresi açık',await p.isVisible('#kAd'));
const olc=()=>p.evaluate(()=>({tr:document.getElementById('sahne').style.transform,sy:scrollY,fs:parseFloat(getComputedStyle(document.getElementById('kAd')||document.body).fontSize)}));
const o0=await olc();await p.focus('#kAd');await p.setViewportSize({width:852,height:180});await p.waitForTimeout(300);const o1=await olc();
ok('klavye açılınca sahne yerinde ('+o0.tr+' / '+o1.tr+')',o0.tr===o1.tr);
await p.fill('#kAd','Eymen');await p.click('#kBasla');await p.setViewportSize({width:852,height:393});await p.waitForTimeout(600);const o2=await olc();
ok('klavye kapanınca yerine döndü ('+o2.tr+', kaydırma '+o2.sy+')',o2.tr===o0.tr&&o2.sy===0);
ok('küre çizildi',await p.evaluate(()=>{const c=document.getElementById('kure'),d=c.getContext('2d').getImageData(180,180,40,40).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n>1000}));
ok('oyuncu oluştu',await p.evaluate(()=>!!K.oyuncuId));
await p.click('.kucukBtn.oneri');await p.waitForTimeout(250);await p.click('#evet');await p.waitForTimeout(250);
let d=await durum();ok('kurye oldu ('+d.prof+')',d.prof==='kurye');
for(let i=0;i<6;i++){await p.click('#gorevBtn');await p.waitForTimeout(120)}
d=await durum();ok('5 görev, 6. reddedildi: '+d.tasks+' bekleyen '+d.pend+' kum '+d.kum,d.tasks===5&&d.pend===2350&&d.kum===1);
console.log('  tost:',d.tost);
// kurs
await p.click('[data-menu="kariyer"]');await p.waitForTimeout(300);await p.click('[data-sk="kurs"]');await p.waitForTimeout(200);
await p.click('[data-kurs="kamu_sinavi"]');await p.waitForTimeout(250);d=await durum();ok('kurs başladı '+JSON.stringify(d.kurs)+' nakit '+d.cash,d.kurs&&d.cash===85000);
await p.click('[data-hizlan]');await p.waitForTimeout(250);await p.click('#evet');await p.waitForTimeout(300);d=await durum();ok('kum saati ile kısaldı '+JSON.stringify(d.kurs)+' kum '+d.kum,d.kum===0);
await p.click('#pGeri');await p.waitForTimeout(300);
// zaman: +1 ay
await p.evaluate(()=>ileriSar(30));await p.waitForTimeout(300);d=await durum();ok('1 ay geçti: gün '+d.day+' nakit '+d.cash+' bekleyen '+d.pend+' haber '+d.okun,d.day>=30&&d.pend===0&&d.cash===85000+2350-18000);
console.log('  bildirim:',await p.textContent('#bMetin'));
// telefon haberler
await p.click('#telefon');await p.waitForTimeout(500);await p.click('[data-u="Haberler"]');await p.waitForTimeout(200);
console.log('  haberler:',(await p.textContent('#tGovde')).slice(0,300));d=await durum();ok('okundu',d.okun===0);
await p.click('#tKapat');await p.waitForTimeout(400);
await p.evaluate(()=>{for(let i=0;i<31;i++){for(let j=0;j<5;j++)eylem({tur:'gorev_yap'},1);ileriSar(1)}});await p.waitForTimeout(200);
// memur ol (kurs bitti + 30 gün deneyim?)
await p.click('[data-menu="kariyer"]');await p.waitForTimeout(300);await p.click('[data-sk="2"]');await p.waitForTimeout(200);
const memurAcik=await p.isEnabled('[data-meslek="memur"]');ok('memur açık',memurAcik);
if(memurAcik){await p.click('[data-meslek="memur"]');await p.waitForTimeout(200);await p.click('#evet');await p.waitForTimeout(300)}
d=await durum();ok('meslek: '+d.prof,d.prof==='memur');
// banka
await p.evaluate(()=>panelAc('banka'));await p.waitForTimeout(300);
const lim=await p.evaluate(()=>T.hesap.krediLimiti(G().p));console.log('  limit',lim);
if(lim>0){await p.fill('#krediTutar','10000');await p.click('#krediCek');await p.waitForTimeout(300);d=await durum();ok('kredi çekildi',d.loans===1)}
await p.evaluate(()=>{K.world.players[K.oyuncuId].cash+=200000;hepsiniCiz()});
// mülk: kredili arsa
await p.evaluate(()=>panelAc('mulk'));await p.waitForTimeout(300);
await p.click('[data-al="arsa"][data-kredi="1"]');await p.waitForTimeout(200);await p.click('#evet');await p.waitForTimeout(300);d=await durum();ok('arsa alındı (kredili) mülk '+d.props+' nakit '+d.cash,d.props===1);
await p.click('#pGeri');await p.waitForTimeout(300);
await p.screenshot({path:'/tmp/claude-0/geo/akis-son.png'});
// yeniden yükle: kayıt korunuyor
await p.reload();await p.waitForTimeout(800);d=await durum();ok('yeniden yüklemede kayıt duruyor: '+d.prof+' mülk '+d.props,d.prof==='memur'&&d.props===1&&!(await p.isVisible('#kAd')));
// ---- Şirketim ----
await p.evaluate(()=>{ornekSirket()});await p.waitForTimeout(300);
ok('şirket ekranı açık',await p.isVisible('#izgaraSirket')&&!(await p.isVisible('#izgaraAna')));
ok('ana proje kartı dolu',(await p.textContent('#sAnaProje')).includes('Kadıköy şubesi'));
await p.click('#sProjeler');await p.waitForTimeout(300);
const kutu=await p.$$('[data-sec]');await kutu[1].click();await p.waitForTimeout(150);await p.click('#prAna');await p.waitForTimeout(200);
ok('ana proje değişti: '+await p.evaluate(()=>anaProjem().ad),await p.evaluate(()=>anaProjem().ad)!=='Kadıköy şubesi');
await p.click('#prYeni');await p.waitForTimeout(200);await p.fill('#fAd','Test projesi');await p.fill('#fButce','5000');await p.click('#evet');await p.waitForTimeout(200);
ok('yeni proje eklendi',await p.evaluate(()=>S().projeler.some(x=>x.ad==='Test projesi')));
await p.click('#pGeri');await p.waitForTimeout(300);
await p.evaluate(()=>sirketModu('kisitli'));await p.waitForTimeout(200);
ok('kısıtlıda unvan Satış Müdürü, çoğul başlık',(await p.textContent('#sAd')).includes('Satış Müdürü')&&(await p.textContent('#sProjeler')).includes('Projeleriniz'));
await p.click('#uEkle');await p.waitForTimeout(250);ok('yetkiniz bulunmamaktadır uyarısı',(await p.textContent('#mBaslik'))==='Yetkiniz bulunmamaktadır');
await p.click('#evet');await p.waitForTimeout(200);await p.click('[data-k]');await p.waitForTimeout(200);await p.click('#evet');await p.waitForTimeout(200);
ok('talep mesajı gitti',await p.evaluate(()=>S().mesajlar[0].durum==='bekliyor'));
await p.evaluate(()=>ileriSar(1));await p.waitForTimeout(200);
ok('ertesi gün yetki verildi',await p.evaluate(()=>yetkiVar('calisan')));
await p.click('#uEkle');await p.waitForTimeout(300);
if((await p.textContent('#pBaslik'))==='Başvurular'){await p.click('#bIlan');await p.waitForTimeout(200)}
await p.fill('#iPoz','Depocu');await p.click('#iYayinla');await p.waitForTimeout(200);
ok('ilan yayınlandı',await p.evaluate(()=>S().ilanlar.some(i=>i.poz==='Depocu')));
await p.evaluate(()=>ileriSar(1));await p.waitForTimeout(200);
const bv=await p.evaluate(()=>S().basvurular.length);ok('başvuru geldi ('+bv+')',bv>0);
await p.evaluate(()=>panelAc('basvurular'));await p.waitForTimeout(200);const once=await p.evaluate(()=>S().uyeler.length);await p.click('[data-al]');await p.waitForTimeout(200);
ok('işe alındı',await p.evaluate(n=>S().uyeler.length===n+1,once));
await p.evaluate(()=>ileriSar(30));await p.waitForTimeout(200);
ok('geçmiş aya yazıldı',await p.evaluate(()=>S().gecmis.length>0));
await p.evaluate(()=>{panelKapat();ekran('ana')});await p.waitForTimeout(200);
ok('ana menü Projem ana projeyi gösteriyor',(await p.textContent('#projem')).includes(await p.evaluate(()=>anaProjem().ad)));
ok('varsayılan tema açık',await p.evaluate(()=>document.documentElement.dataset.theme==='light'));
await p.evaluate(()=>{kapat();document.getElementById('ayarlar').click()});await p.waitForTimeout(200);await p.click('[data-tema="dark"]');await p.waitForTimeout(150);
ok('koyu seçildi ve zemin koyu',await p.evaluate(()=>getComputedStyle(document.body).backgroundColor!=='rgb(230, 224, 212)'&&document.documentElement.dataset.theme==='dark'));
await p.reload();await p.waitForTimeout(700);ok('koyu tema yeniden yüklemede hatırlandı',await p.evaluate(()=>document.documentElement.dataset.theme==='dark'));
console.log('hatalar:',errs.length?errs:'yok');await b.close()})();
