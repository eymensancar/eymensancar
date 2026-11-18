// Demolition Master'ın gerçek oynanışından 150 karelik (5 sn, 30 fps) telefon ekranı dizisi üretir.
// Oyun: /home/user/clauderepo/www (yalnız okunur). Önce yerel sunucu:
//   python3 -m http.server -d /home/user/clauderepo/www 8811
// Sonra: node src/oyun_cek.cjs            -> assets/img/oyun/f0001..f0150.jpg + meta.json + out/oyun-onizleme.mp4
//        node src/oyun_cek.cjs --ham      -> yalnız ham kareleri (geçici klasör, OYUN_HAM) ve temas sayfalarını üretir (seçim ayarı için)
// Zaman Playwright'ın sahte saatiyle (page.clock) ilerletilir: her kare tam 1/30 sn oyun zamanı; Math.random tohumlu.
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');

const KOK=path.resolve(__dirname,'..');
const URL_=process.env.OYUN_URL||'http://localhost:8811/index.html?debug';
const HAM=process.env.OYUN_HAM||path.join(require('os').tmpdir(),'oyun-ham'); // ara kareler proje dışında
const HEDEF=path.join(KOK,'assets','img','oyun');
const FPS=30, W=450, H=800;
const yalnizHam=process.argv.includes('--ham');

// Hangi ham kareler son diziye girer: [klip, ilk, son, açıklama] (ham kare numaraları, dahil). Toplam 150.
const SECIM=[ // k1/k2 aralıkları çalışırken kazanma/süre bitişi karesine göre yeniden hesaplanır
  ['k1', 33, 87, 'Bölüm 3 "Shanty": dinamit ve C4 patlar, tuğla bina yana yatıp çöker, toz, +altın yazıları, COMBO, DEMOLISHED! damgası'],
  ['k2', 68,127, 'Bölüm 5 boss "Old Textile Mill" (süre 2 sn): C4 patlar, beton kule yana yatıp yıkılır, COMBO x2.00, süre biter: TIME\'S UP damgası'],
  ['k3',  3, 24, 'Gerçek "Time\'s up" sonuç kartı (Try again / Shop / Main menu), "Try again"e basılır, kepenk iner (Old Textile Mill etiketi)'],
  ['k3', 60, 72, 'Kepenk açılır: aynı bölüm baştan, bina yeniden ayakta (TIME 73 s)'],
];

(async()=>{
  fs.rmSync(HAM,{recursive:true,force:true}); fs.mkdirSync(HAM,{recursive:true});
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,locale:'en-US',isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('SAYFA HATASI',e.message));
  await p.clock.install({time:new Date('2026-11-14T23:40:00')});
  await p.addInitScript(()=>{
    let s=20261115>>>0; Math.random=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
    try{localStorage.clear();localStorage.setItem('yu_lang','en')}catch(e){}
  });
  await p.goto(URL_);
  // install() saati akıtır; durdurup yalnız elle ilerletiyoruz (ekran görüntüsü zamanı kaydırmasın)
  await p.clock.pauseAt(new Date('2026-11-14T23:40:06'));
  await p.clock.runFor(500);
  await p.evaluate(()=>{const Y=window.__yk,s=Y.save;
    s.owned={hammer:4,drill:4,torch:3,ball:3,crusher:3,dyn:3,c4:2};s.ammo={dyn:6,c4:3};s.level=40;s.lang='en';s.gold=12000;});

  const adim=()=>p.clock.runFor(1000/FPS);
  const bekle=ms=>p.clock.runFor(ms);
  const bolum=async n=>{await p.evaluate(n=>{const Y=window.__yk;Y.startLevel(n);Y.renderTools();Y.go();Y.L.extended=true},n);};
  // gerçek dokunuş yolu: oyunun işaretçi durumunu doldurur, bir sonraki karede araç kullanılır (denge botu da böyle yapar)
  const dokun=async(arac,x,y)=>{await p.evaluate(([arac,x,y])=>{const Y=window.__yk;Y.save.sel=arac;Y.renderTools();
    if(y<0)y=Y.L.H+y; if(x<0)x=Y.L.W+x; const s=Y.toScreen(x,y),P=Y.ptr;P.x=s.x;P.y=s.y;P.in=true;P.down=false;P.just=true},[arac,x,y]);};
  const durum={};
  const kaydet=async(klip,n,olay)=>{fs.mkdirSync(path.join(HAM,klip),{recursive:true}); const d=durum[klip]=[];
    for(let i=0;i<n;i++){ if(olay) await olay(i);
      d.push(await p.evaluate(()=>window.__yk.state));
      await p.screenshot({path:path.join(HAM,klip,`${String(i).padStart(3,'0')}.png`)}); await adim(); }};

  // Klip 1: Bölüm 3 (Shanty) — dinamit + C4, bina çöker, DEMOLISHED!
  await bolum(3); await bekle(1600);
  await dokun('dyn',2,-1.2); await adim(); await adim(); await dokun('c4',6.5,-0.8);
  await kaydet('k1',110);

  // Klip 2 + 3: Bölüm 5 (Old Textile Mill, boss) — dinamit + C4, dev kule yana yatıp çöker, süre biter: TIME'S UP, sonra "Try again"
  await bolum(5); await bekle(2500);
  await p.evaluate(()=>{window.__yk.L.timeLeft=4.2});
  await dokun('dyn',3,-1.5); await adim(); await adim(); await adim(); await dokun('c4',-4,-1.5);
  await kaydet('k2',150);
  // sonuç kartı tamamen açılsın
  await bekle(2400);
  const bt=await p.evaluate(()=>{const r=document.querySelector('#next').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,txt:document.querySelector('#next').textContent}});
  console.log('düğme:',bt.txt);
  await kaydet('k3',75,async i=>{
    if(i===14) await p.mouse.move(bt.x,bt.y);
    if(i===15) await p.mouse.down();
    if(i===19) await p.mouse.up();
  });
  await b.close();
  // klip 1 ve 2'nin sonu oyunun kendi anına bağlanır (kazanma / süre bitişi), ham kare numarası kaymasın
  const won=durum.k1.indexOf('won'), lost=durum.k2.indexOf('lost');
  console.log('k1 won @',won,' k2 lost @',lost);
  if(won<0||lost<0) throw new Error('beklenen an yok');
  SECIM[0][2]=won+8; SECIM[0][1]=won+8-54;
  SECIM[1][2]=lost+14; SECIM[1][1]=lost+14-59;

  // temas sayfaları (seçimi ayarlamak için)
  for(const k of ['k1','k2','k3']){
    execFileSync('ffmpeg',['-loglevel','error','-y','-start_number','0','-i',path.join(HAM,k,'%03d.png'),
      '-vf',"select='not(mod(n\\,3))',scale=150:-1,drawtext=text='%{frame_num}':start_number=0:x=4:y=4:fontsize=16:fontcolor=yellow:box=1,tile=13x4",
      '-frames:v','1',path.join(HAM,k+'-temas.png')]);
  }
  if(yalnizHam){console.log('ham kareler:',HAM);return;}

  fs.mkdirSync(HEDEF,{recursive:true});
  for(const f of fs.readdirSync(HEDEF)) if(/^f\d{4}\.jpg$/.test(f)) fs.unlinkSync(path.join(HEDEF,f));
  const klipler=[]; let no=1;
  const liste=path.join(HAM,'liste.txt'); const satir=[];
  for(const [k,a,z,ne] of SECIM){ const ilk=no;
    for(let i=a;i<=z;i++,no++){ const src=path.join(HAM,k,`${String(i).padStart(3,'0')}.png`), dst=path.join(HEDEF,`f${String(no).padStart(4,'0')}.jpg`);
      execFileSync('ffmpeg',['-loglevel','error','-y','-i',src,'-vf',`scale=${W}:${H}:flags=lanczos`,'-q:v','3',dst]); }
    klipler.push({klip:k,ham:[a,z],kareler:[ilk,no-1],ne}); }
  const count=no-1; if(count!==150) throw new Error('kare sayısı 150 değil: '+count);
  fs.writeFileSync(path.join(HEDEF,'meta.json'),JSON.stringify({count,w:W,h:H,fps:FPS,kaynak:'Demolition Master (www/, ?debug), İngilizce arayüz, src/oyun_cek.cjs',klipler},null,2)+'\n');
  fs.mkdirSync(path.join(KOK,'out'),{recursive:true});
  execFileSync('ffmpeg',['-loglevel','error','-y','-framerate',String(FPS),'-i',path.join(HEDEF,'f%04d.jpg'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18',path.join(KOK,'out','oyun-onizleme.mp4')]);
  console.log('tamam:',count,'kare ->',HEDEF);
})().catch(e=>{console.error(e);process.exit(1)});
