// Every language has its own static pages (/de/, /ja/ …). The root pages are English; on a first visit they
// send the visitor to their own language (link ?lang= > saved choice > browser language). Also: language menu,
// copy-email button and the gentle rise-in of sections.
(function () {
  var CODES = ['tr','en','de','fr','es','pt','it','pl','ru','uk','ar','hi','bn','id','vi','th','ja','ko','zh','zh-Hant'];
  var KEY = 'yu-site-lang', body = document.body, here = body.getAttribute('data-lang'), root = body.getAttribute('data-root') === '1';
  document.documentElement.classList.add('js');

  function wanted() {
    var q = /[?&]lang=([A-Za-z-]+)/.exec(location.search);
    if (q && CODES.indexOf(q[1]) > -1) return q[1];
    try { var s = localStorage.getItem(KEY); if (s && CODES.indexOf(s) > -1) return s; } catch (e) {}
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var t = String(list[i]).toLowerCase();
      if (/^zh-(tw|hk|mo|hant)/.test(t)) return 'zh-Hant';
      var p = t.split('-')[0]; if (CODES.indexOf(p) > -1) return p;
    }
    return 'en';
  }
  if (root) {
    var w = wanted();
    if (w !== 'en') { location.replace(w + '/' + (body.getAttribute('data-file') || '') + location.hash); return; }
  }

  var box = document.getElementById('lang');
  if (box) {
    var btn = box.querySelector('button');
    btn.addEventListener('click', function (e) { e.stopPropagation(); var o = box.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    document.addEventListener('click', function () { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('open'); });
    box.querySelectorAll('a[data-lang]').forEach(function (a) { a.addEventListener('click', function () { try { localStorage.setItem(KEY, a.getAttribute('data-lang')); } catch (e) {} }); });
  }
  if (here && !root) { try { localStorage.setItem(KEY, here); } catch (e) {} }

  var c = document.getElementById('copy');
  if (c) c.addEventListener('click', function () { var m = c.getAttribute('data-mail'); try { navigator.clipboard.writeText(m).then(function () { c.textContent = '✓'; setTimeout(function () { c.textContent = '⧉'; }, 1500); }); } catch (e) {} });

  var els = document.querySelectorAll('.rise');
  if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (e) { io.observe(e); });
})();
