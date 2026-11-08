// Sancar Games: menü davranışı, kaydırmayla belirme, hafif parallax, kopyalama. Kütüphane yok.
(function(){
  var d=document,root=d.documentElement,rm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  // üst menü: aşağı kayarken gizlenir, yukarı kayınca döner; sayfa başında çizgisiz
  var bar=d.querySelector('.bar'),lastY=window.scrollY,ticking=false;
  function onScroll(){
    var y=window.scrollY;
    if(bar){bar.classList.toggle('lift',y>8);
      if(!d.body.classList.contains('menu-open'))bar.classList.toggle('up',y>lastY&&y>320);}
    lastY=y;par();ticking=false;
  }
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(onScroll)}},{passive:true});

  // mobil menü
  var sheet=d.getElementById('sheet'),openB=d.querySelector('.burger'),closeB=null;
  var scrim=d.createElement('div');scrim.className='scrim';d.body.appendChild(scrim);scrim.addEventListener('click',function(){setMenu(false)});
  function setMenu(o){if(!sheet)return;sheet.classList.toggle('open',o);d.body.classList.toggle('menu-open',o);
    openB&&openB.setAttribute('aria-expanded',o?'true':'false');if(o&&bar)bar.classList.remove('up');}
  openB&&openB.addEventListener('click',function(){setMenu(!sheet.classList.contains('open'))});
  closeB&&closeB.addEventListener('click',function(){setMenu(false)});
  d.addEventListener('keydown',function(e){if(e.key==='Escape'&&sheet&&sheet.classList.contains('open'))setMenu(false)});
  sheet&&sheet.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setMenu(false)})});

  // kaydırmayla belirme
  var els=d.querySelectorAll('.rv,.mask,.settle');
  if(rm||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')})}
  else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px',threshold:.08});
    // maskeli öğe kendi kırpması yüzünden görünmez sayılır; kesişimi üst öğesinde ölç
    els.forEach(function(e){if(e.classList.contains('mask')){var o=new IntersectionObserver(function(es){if(es[0].isIntersecting){e.classList.add('in');o.disconnect()}},{rootMargin:'0px 0px -10% 0px'});o.observe(e.parentNode)}else io.observe(e)})}

  // hafif parallax: yalnızca [data-par] görseller, en çok ±6%
  var pars=rm?[]:Array.prototype.slice.call(d.querySelectorAll('[data-par]'));
  function par(){var h=window.innerHeight;pars.forEach(function(el){var r=el.parentNode.getBoundingClientRect();if(r.bottom<0||r.top>h)return;
    var k=((r.top+r.height/2)-h/2)/(h+r.height);el.style.transform='translate3d(0,'+(k*-12).toFixed(2)+'%,0)'})}
  par();

  // video: ekrandayken oynar
  d.querySelectorAll('video[data-auto]').forEach(function(v){
    if(rm){v.removeAttribute('autoplay');v.pause();return}
    if('IntersectionObserver' in window){new IntersectionObserver(function(es){es.forEach(function(e){e.isIntersecting?v.play().catch(function(){}):v.pause()})},{threshold:.2}).observe(v)}
  });

  // e-posta kopyala
  d.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){
    var t=b.getAttribute('data-copy'),o=b.textContent,done=b.getAttribute('data-done')||'✓';
    function ok(){b.textContent=done;setTimeout(function(){b.textContent=o},1600)}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,function(){});
  })});
})();
