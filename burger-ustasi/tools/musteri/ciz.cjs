// Bir karakteri çizip PNG'ye kaydeder: üstte 6 duygu, altta "bekliyor" ve "mutlu" 3 kat büyük (ince ayar için).
// Kullanım: node ciz.cjs karakterler/017.json [çıktı.png]   (çıktı yoksa karakterler/017.png)
// JSON yerine doğrudan seçenek de olur: node ciz.cjs --tohum 1234 cikti.png  (rastgele temel karakter)
const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
(async()=>{const a=process.argv.slice(2);let m,out;
  if(a[0]==='--tohum'){global.window={};eval(fs.readFileSync(path.join(__dirname,'musteri.js'),'utf8'));m=window.Musteri.random(+a[1]);out=a[2]||'tohum-'+a[1]+'.png';console.log(JSON.stringify(m))}
  else{const j=JSON.parse(fs.readFileSync(a[0],'utf8'));m=j.m||j;out=a[1]||a[0].replace(/\.json$/,'.png')}
  const js=fs.readFileSync(path.join(__dirname,'musteri.js'),'utf8');
  const html=`<!doctype html><meta charset=utf-8><style>*{animation:none!important}body{margin:0;background:#f3e6d2;font:13px sans-serif;width:1200px}
.r{display:flex}.c{width:200px;text-align:center}.c svg{width:200px}.b{width:600px;position:relative}.b svg{width:600px;background:#fbf3e6}
.g{position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px);background-size:${600/128*10}px ${600/128*10}px;pointer-events:none}</style>
<script>${js}</script><div id=o></div><script>const M=window.Musteri,m=${JSON.stringify(m)};
o.innerHTML='<div class=r>'+M.EMOTIONS.map(e=>'<div class=c>'+M.draw(m,e)+e+'</div>').join('')+'</div><div class=r><div class=b>'+M.draw(m,'wait')+'<div class=g></div></div><div class=b>'+M.draw(m,'happy')+'<div class=g></div></div></div>'</script>`;
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.setContent(html);await p.waitForTimeout(50);await p.screenshot({path:out,fullPage:true});await b.close();
  if(errs.length){console.error('HATA',errs);process.exit(1)}console.log('kaydedildi:',out)})();
