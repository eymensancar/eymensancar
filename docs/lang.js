// Shows the page in Turkish or English. Without JavaScript both languages stay visible.
(function () {
  var html = document.documentElement, key = 'yikim-lang', q = /[?&]lang=(tr|en)/.exec(location.search), l;
  try { l = localStorage.getItem(key); } catch (e) {}
  l = q ? q[1] : l || ((navigator.language || '').slice(0, 2) === 'tr' ? 'tr' : 'en');
  function set(v) {
    html.setAttribute('data-l', v); html.lang = v;
    try { localStorage.setItem(key, v); } catch (e) {}
  }
  set(l);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-set]');
    if (b) set(b.getAttribute('data-set'));
  });
})();
