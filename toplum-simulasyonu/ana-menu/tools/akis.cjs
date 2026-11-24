const pw=require('playwright');(async()=>{const b=await pw.chromium.launch();const c=await b.newContext({viewport:{width:852,height:393}});const p=await c.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.route('**/index.html',async r=>{const res=await r.fetch();r.fulfill({body:'<meta charset="utf-8">'+(await res.body()).toString('utf8'),headers:{'content-type':'text/html; charset=utf-8'}})});
await p.goto('http://localhost:8850/index.html');await p.waitForTimeout(800);
const ok=(ad,v)=>console.log(v?'GEÇTİ':'KALDI',ad);
const durum=()=>p.evaluate(()=>{const {w,p}=G();return {cash:p.cash,pend:p.pendingEarnings,prof:p.profession,tasks:p.tasksToday,kum:p.hourglasses,day:w.day,kurs:p.courseInProgress,props:p.propertyIds.length,loans:p.loans.length,okun:K.okunmamis,tost:document.getElementById('tost').textContent}});
ok('kayıt penceresi açık',await p.isVisible('#kAd'));
await p.fill('#kAd','Eymen');await p.click('#kBasla');await p.waitForTimeout(300);
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
console.log('hatalar:',errs.length?errs:'yok');await b.close()})();
