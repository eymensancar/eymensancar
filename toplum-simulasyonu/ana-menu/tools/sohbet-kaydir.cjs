// Sohbette okurken yerinde kalma ve "en alta in" tuşu. Sunucu: python3 -m http.server 8850 (ana-menu içinde)
const pw=require('playwright');(async()=>{const b=await pw[process.env.TARAYICI||'chromium'].launch();const c=await b.newContext({viewport:{width:852,height:393},hasTouch:true});const p=await c.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/index.html*',async r=>{const res=await r.fetch();r.fulfill({body:'<meta charset="utf-8">'+(await res.body()).toString('utf8'),headers:{'content-type':'text/html; charset=utf-8'}})});
await p.goto('http://localhost:'+(process.env.PORT||8850)+'/index.html?anlamyok');await p.waitForTimeout(800);
let hata=0;const ok=(ad,v)=>{console.log(v?'GEÇTİ':'KALDI',ad);if(!v)hata++};
if(process.env.SAFARI_GIBI)await p.addStyleTag({content:'*{overflow-anchor:none!important}'});await p.fill('#kAd','Eymen');await p.click('#kBasla');await p.waitForTimeout(1500);console.log('  oyuncu:',await p.evaluate(()=>[K.oyuncuId,!!K.npc,document.getElementById('tost').textContent]));
await p.evaluate(()=>{SOH().onay={s:ONAY_SURUM,t:Date.now(),yz:true};sohbetAc('ulke')});await p.waitForTimeout(500);
const ekle=n=>p.evaluate(n=>{const k=K.npc.kanal[shKanal];for(let i=0;i<n;i++)k.push({id:'t'+Math.random().toString(36).slice(2),ad:'Deneme Kişi',npcId:'',metin:'Deneme mesajı '+i+' biraz uzun olsun ki satırlar dolsun',zaman:Date.now()});shCiz()},n);
await ekle(40);
const d=()=>p.evaluate(()=>{const l=$('shListe');return {top:l.scrollTop,alt:l.scrollHeight-l.scrollTop-l.clientHeight,tus:!$('shAsagi').hidden,say:$('shAsagiSay').hidden?0:+$('shAsagiSay').textContent}});
let s=await d();ok('başta en altta, tuş gizli',s.alt<60&&!s.tus);
await p.evaluate(()=>{const l=$('shListe');l.scrollTop=Math.max(0,l.scrollTop-600)});await p.waitForTimeout(200);
s=await d();ok('yukarı kaydırınca tuş göründü',s.tus);
const ilk=await p.evaluate(()=>{const c=shCapa();return c});
await ekle(5);await p.waitForTimeout(100);
const son=await p.evaluate(()=>shCapa());s=await d();
ok('yeni mesajda yerinde kaldı ('+(ilk&&ilk.id)+' '+(son&&son.id)+', fark '+(ilk&&son?Math.round(son.y-ilk.y):'?')+')',ilk&&son&&ilk.id===son.id&&Math.abs(son.y-ilk.y)<3);
ok('tuşta 5 yeni ('+s.say+')',s.say===5);
// 140 sınırını aşınca da (eski mesajlar listeden düşer) yerinde kalmalı
await ekle(150);await p.waitForTimeout(100);const son2=await p.evaluate(()=>shCapa());
ok('liste sınırı aşılınca da aynı mesajda ('+(son2&&son2.id)+')',son2&&son2.id===ilk.id);
await p.click('#shAsagi');await p.waitForTimeout(1500);s=await d();console.log('  ',JSON.stringify(s));ok('tuşa basınca en altta, tuş gizli',s.alt<60&&!s.tus);
await ekle(3);await p.waitForTimeout(100);s=await d();ok('alttayken yeni mesaj gelince altta kalır',s.alt<60&&!s.tus);
await p.evaluate(()=>{const l=$('shListe');l.scrollTop=0});await p.waitForTimeout(100);
await p.fill('#shGiris','merhaba');await p.click('#shGonder');await p.waitForTimeout(300);s=await d();ok('kendi mesajını gönderince en alta iner',s.alt<60);
ok('sayfa hatası yok '+errs.join(' | '),!errs.length);
await b.close();process.exit(hata?1:0)})();
