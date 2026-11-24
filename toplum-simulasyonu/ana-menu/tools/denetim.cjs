// Taşma denetimi: sahnedeki her öğe ebeveyninin içinde mi, yazı kırpılıyor mu, kardeşler üst üste mi
const pw=require('playwright');
const VP=[['se',667,375,0],['ip15',852,393,59],['promax',932,430,59],['ipad',1180,820,0],['masaustu',1280,720,0],['dar',740,360,0]];
const DURUM=['patron','issiz','calisan','p-kariyer1','p-kariyer3','p-kurs','p-banka','p-mulk','kayit'];
const HAZIRLA=require('./hazirla.cjs');
(async()=>{const b=await pw.chromium.launch();let toplam=0;
for(const tema of ['light','dark'])for(const [ad,w,h,ins] of VP)for(const d of DURUM){
 const p=await b.newPage({viewport:{width:w,height:h},colorScheme:tema});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.route('**/index.html',async r=>{const res=await r.fetch();let t=(await res.body()).toString('utf8');if(ins)t=t.replace('max(8px,env(safe-area-inset-left,0px))','max(8px,'+ins+'px)').replace('max(8px,env(safe-area-inset-right,0px))','max(8px,'+ins+'px)').replace('max(8px,env(safe-area-inset-bottom,0px))','max(8px,21px)');r.fulfill({body:'<meta charset="utf-8">'+t,headers:{'content-type':'text/html; charset=utf-8'}})});
 await p.goto('http://localhost:8850/index.html');await p.waitForTimeout(1200);
 await p.evaluate(HAZIRLA,d);await p.waitForTimeout(450);
 const sorun=await p.evaluate(()=>{const out=[],sahne=document.getElementById('sahne'),S=sahne.getBoundingClientRect(),k=S.width/780;
  const ad=e=>(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ').join('.'):'')+(e.textContent||'').trim().slice(0,18).replace(/\s+/g,' ');
  const vis=e=>{const cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&!e.closest('[hidden]')&&!e.closest('.telefonAcik,.perde,.telefonPerde,.bildirim,.tost,.panel:not(.acik)')};
  sahne.querySelectorAll('*').forEach(e=>{if(!vis(e)||e.tagName==='svg'||e.closest('svg'))return;const r=e.getBoundingClientRect();if(!r.width)return;
   // sahne dışı
   if(r.left<S.left-1||r.right>S.right+1||r.top<S.top-1||r.bottom>S.bottom+1){if(!e.closest('.telefonKutu'))out.push('sahne dışı: '+ad(e))}
   // ebeveyn dışı
   const pa=e.parentElement;if(pa&&pa!==sahne&&!pa.classList.contains('izgara')&&!e.classList.contains('rozet')&&!e.classList.contains('telefon')){const q=pa.getBoundingClientRect(),t=1.2*k;if(r.left<q.left-t||r.right>q.right+t||r.top<q.top-t||r.bottom>q.bottom+t)out.push('taşıyor: '+ad(e)+' ⊄ '+ad(pa))}
   // yazı kırpılması
   if(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible')out.push('yazı kırpık: '+ad(e));
  });
  // grid kardeş çakışması
  const g=[...document.querySelector('.izgara').children].filter(vis).map(e=>[e,e.getBoundingClientRect()]);
  for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){const a=g[i][1],c=g[j][1];if(a.left<c.right-1&&c.left<a.right-1&&a.top<c.bottom-1&&c.top<a.bottom-1)out.push('çakışma: '+ad(g[i][0])+' × '+ad(g[j][0]))}
  // tek satır olması gereken yazılar: satır sayısı (metin aralığının satır kutuları)
  const satir=e=>{const tops=new Set();const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);[...r.getClientRects()].filter(x=>x.width>1).forEach(x=>tops.add((x.top+x.height/2)/k))}const t=[...tops].sort((a,b)=>a-b);let c=t.length?1:0;for(let i=1;i<t.length;i++)if(t[i]-t[i-1]>7)c++;return c};
  document.querySelectorAll('.satir span,.satir b,.ustBtn,.menuBtn,.kucukBtn>span,.isimKart .meslek,.baslik:not(.blok .baslik),.dunyaEtiket,.lejant span,.paraBtn,.halkaOrta b,.olcu b,.ben .istat div,.siraBtn b,.katki b,.cubukYazi,.btn,.cip,.rozetK,.gorev,.pBas .baslik,.sekmeler button').forEach(e=>{if(!vis(e))return;if(e.querySelector('small'))return;if(satir(e)>1)out.push('iki satır: '+ad(e))});
  document.querySelectorAll('.blok .baslik,.katki .etiket').forEach(e=>{if(vis(e)&&satir(e)>2)out.push('üç satır: '+ad(e))});
  return out});
 const ust=await p.evaluate(()=>{const u=document.querySelector('.ustSag');return [u.getBoundingClientRect().width,[...u.children].map(c=>Math.round(c.getBoundingClientRect().width))].join(' ')});if(ad==='ip15'&&d==='calisan'&&tema==='light')console.log('ustSag',ust);const u=[...new Set(sorun)];if(u.length||errs.length){toplam+=u.length+errs.length;console.log(`[${tema} ${ad} ${d}]`,u.join(' | '),errs.join(';'))}
 if(['se','ip15'].includes(ad))await p.screenshot({path:`/tmp/claude-0/geo/v-${tema}-${ad}-${d}.png`});
 await p.close()}
console.log('toplam sorun',toplam);await b.close()})();
