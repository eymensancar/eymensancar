// Picks the visitor's language (link ?lang= > saved choice > browser languages > English), loads its
// dictionary and renders the page. The HTML ships pre-rendered in English, so it reads fine without JS.
(function () {
  var LANGS = [['tr','Türkçe'],['en','English'],['de','Deutsch'],['fr','Français'],['es','Español'],['pt','Português'],['it','Italiano'],
    ['pl','Polski'],['ru','Русский'],['uk','Українська'],['ar','العربية'],['hi','हिन्दी'],['bn','বাংলা'],['id','Bahasa Indonesia'],
    ['vi','Tiếng Việt'],['th','ไทย'],['ja','日本語'],['ko','한국어'],['zh','简体中文'],['zh-Hant','繁體中文']];
  var CODES = LANGS.map(function (l) { return l[0]; });
  var EMAIL = 'sancarrgamess@gmail.com', KEY = 'yu-site-lang';
  var page = document.body.getAttribute('data-page');
  document.documentElement.classList.add('js');

  function pick() {
    var q = /[?&]lang=([A-Za-z-]+)/.exec(location.search);
    if (q && CODES.indexOf(q[1]) > -1) return q[1];
    try { var s = localStorage.getItem(KEY); if (s && CODES.indexOf(s) > -1) return s; } catch (e) {}
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var t = String(list[i]).toLowerCase();
      if (/^zh-(tw|hk|mo|hant)/.test(t)) return 'zh-Hant';
      var p = t.split('-')[0];
      if (CODES.indexOf(p) > -1) return p;
    }
    return 'en';
  }

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };
  var ICONS = [
    '<path d="M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8"/><path d="M5 20h6"/>',
    '<path d="M4 20V9l4-3v14M10 20V4l5 3v13M17 20v-8l3 2v6"/><path d="M2 20h20"/>',
    '<path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18.4 5.6l-2.1 2.1M21 12h-3"/><circle cx="12" cy="15" r="5"/>',
    '<path d="M3 21V10h5v11M10 21V3h6v18M18 21v-7h3v7"/><path d="M12 7h2M12 11h2M12 15h2"/>',
    '<path d="M6 8c0-2 2.7-4 6-4s6 2 6 4-2.7 4-6 4-6-2-6-4z"/><path d="M6 8v8c0 2 2.7 4 6 4s6-2 6-4V8"/>',
    '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 14l2 2 4-4"/>'];
  var SKY = '<svg class="skyline" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true"><path fill="#121729" d="M0 180V110h60V70h50v40h40V40h70v70h30V90h60v20h50V30h40v-20h20v20h30v100h60V80h80v30h40V60h60v50h50V20h30v-10h30v10h20v100h60V90h70v20h40V50h60v60h50V80h60v100z"/><path fill="#0d1120" d="M0 180v-40h90v-30h70v30h60v-50h80v50h50v-20h90v20h60v-40h70v40h50v-30h100v30h60v-60h70v60h60v-20h80v20h60v-40h70v40h90v-30h70v30h60v40z"/></svg>';

  function header(d) {
    var cur = function (p) { return page === p ? ' aria-current="page"' : ''; };
    var items = LANGS.map(function (l) { return '<li><button type="button" data-lang="' + l[0] + '" lang="' + l[0] + '"' + (l[0] === d.code ? ' aria-current="true"' : '') + '>' + esc(l[1]) + '</button></li>'; }).join('');
    return '<div class="tape"></div><div class="wrap"><a class="brand" href="./"><img src="icon.png" alt="" width="36" height="36"><b>' + esc(d.gameName) + '</b></a>' +
      '<nav><a href="./"' + cur('home') + ' class="hide-sm">' + esc(d.nav.game) + '</a><a href="support.html"' + cur('support') + '>' + esc(d.nav.support) + '</a><a href="privacy.html"' + cur('privacy') + ' class="hide-sm">' + esc(d.nav.privacy) + '</a>' +
      '<div class="lang" id="lang"><button type="button" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(d.nav.language) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9"/></svg><span class="cur">' + esc(d.langName) + '</span></button><ul role="menu">' + items + '</ul></div></nav></div>';
  }
  function footer(d) {
    return '<div class="wrap"><span>© 2026 ' + esc(d.gameName) + '. ' + esc(d.footer.rights) + ' · ' + esc(d.footer.made) + '</span>' +
      '<nav><a href="./">' + esc(d.nav.game) + '</a><a href="support.html">' + esc(d.nav.support) + '</a><a href="privacy.html">' + esc(d.nav.privacy) + '</a><a href="mailto:' + EMAIL + '">' + EMAIL + '</a></nav></div>';
  }
  function shots(code) { return code === 'bn' ? 'en' : code; }
  function home(d) {
    var s = shots(d.code), imgs = '';
    for (var i = 1; i <= 9; i++) imgs += '<img src="shots/' + s + '/0' + i + '.jpg" alt="' + esc(d.gameName) + ' ' + i + '" width="440" height="956" loading="' + (i < 4 ? 'eager' : 'lazy') + '">';
    return '<section class="hero">' + SKY + '<div class="wrap"><div class="rise"><span class="eyebrow">' + esc(d.hero.eyebrow) + '</span><h1>' + esc(d.gameName) + '</h1><p class="tag">' + esc(d.hero.tagline) + '</p><p class="lead">' + esc(d.hero.lead) + '</p>' +
      '<div class="actions"><span class="badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.7c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>' + esc(d.hero.badge) + '</span>' +
      '<a class="btn g" href="#shots">' + esc(d.hero.cta) + '</a></div></div>' +
      '<div class="hero-art rise"><img src="shots/' + s + '/01.jpg" alt="" width="440" height="956"><img class="b" src="shots/' + s + '/03.jpg" alt="" width="440" height="956"></div></div></section>' +
      '<div class="wrap"><div class="facts">' + d.facts.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div></div>' +
      '<section class="blk" id="shots"><div class="wrap"><h2 class="rise">' + esc(d.hero.shots) + '</h2></div><div class="rail-wrap"><div class="rail" id="rail">' + imgs + '</div>' +
      '<div class="rail-nav"><button type="button" data-dir="-1" aria-label="‹"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" data-dir="1" aria-label="›"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg></button></div></div></section>' +
      '<section class="blk" style="padding-top:20px"><div class="wrap"><h2 class="rise">' + esc(d.features.title) + '</h2><div class="grid" style="margin-top:34px">' +
      d.features.items.map(function (f, i) { return '<div class="card rise"><div class="ic"><svg viewBox="0 0 24 24">' + ICONS[i] + '</svg></div><h3>' + esc(f.t) + '</h3><p>' + esc(f.p) + '</p></div>'; }).join('') + '</div></div></section>' +
      '<section class="blk" style="padding-top:10px"><div class="wrap"><div class="cta rise"><h2>' + esc(d.cta.title) + '</h2><p>' + esc(d.cta.p) + '</p><a class="btn y" href="mailto:' + EMAIL + '">' + esc(d.cta.btn) + '</a></div></div></section>';
  }
  function support(d) {
    var s = d.support;
    return '<div class="wrap page"><h1>' + esc(s.title) + '</h1><p class="lead">' + esc(s.lead) + '</p>' +
      '<div class="mailbox"><a class="btn y" href="mailto:' + EMAIL + '">' + EMAIL + '</a><button type="button" class="btn g" id="copy">⧉</button></div>' +
      '<div class="faq"><h2>' + esc(s.faqTitle) + '</h2>' + s.faq.map(function (f) { return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>'; }).join('') + '</div></div>';
  }
  function privacy(d) {
    var p = d.privacy, g = '<a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>', m = '<a href="mailto:' + EMAIL + '">' + EMAIL + '</a>';
    return '<div class="wrap page"><article class="policy"><h1>' + esc(p.title) + '</h1><p class="muted">' + esc(p.updated) + '</p><p>' + esc(p.intro) + '</p>' +
      p.sections.map(function (sec) { return '<h2>' + esc(sec.h) + '</h2>' + sec.p.map(function (t) { return '<p>' + esc(t).replace('{google}', g).replace('{email}', m) + '</p>'; }).join(''); }).join('') + '</article></div>';
  }

  function render(d) {
    var html = document.documentElement;
    html.lang = d.code; html.dir = d.code === 'ar' ? 'rtl' : 'ltr';
    var t = page === 'home' ? d.meta.title : (page === 'support' ? d.support.title : d.privacy.title) + ' · ' + d.gameName;
    document.title = t;
    var md = document.querySelector('meta[name=description]'); if (md) md.setAttribute('content', d.meta.desc);
    $('top').innerHTML = header(d);
    $('main').innerHTML = page === 'home' ? home(d) : page === 'support' ? support(d) : privacy(d);
    $('foot').innerHTML = footer(d);
    wire(d);
  }

  function load(code, save) {
    fetch('i18n/' + code + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      d.code = code; render(d);
      if (save) { try { localStorage.setItem(KEY, code); } catch (e) {} }
    }).catch(function () { if (code !== 'en') load('en', false); });
  }

  function wire(d) {
    var box = $('lang'), btn = box.querySelector('button');
    btn.addEventListener('click', function (e) { e.stopPropagation(); var o = box.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    box.querySelectorAll('li button').forEach(function (b) { b.addEventListener('click', function () { box.classList.remove('open'); load(b.getAttribute('data-lang'), true); }); });
    document.addEventListener('click', function () { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('open'); });
    var rail = $('rail');
    if (rail) document.querySelectorAll('.rail-nav button').forEach(function (b) {
      b.addEventListener('click', function () { var dir = +b.getAttribute('data-dir') * (document.documentElement.dir === 'rtl' ? -1 : 1); rail.scrollBy({ left: dir * rail.clientWidth * 0.8, behavior: 'smooth' }); });
    });
    var c = $('copy');
    if (c) c.addEventListener('click', function () { try { navigator.clipboard.writeText(EMAIL).then(function () { c.textContent = '✓'; setTimeout(function () { c.textContent = '⧉'; }, 1500); }); } catch (e) {} });
    var els = document.querySelectorAll('.rise');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  load(pick(), /[?&]lang=/.test(location.search));
})();
