/* Replaces the single hard-coded featured book with the three newest catalog titles.
   New catalog entries only need an `addedAt` timestamp to enter this section automatically. */
(function () {
  function currentLang() {
    var path = location.pathname.replace(/^\/books/, '');
    var m = path.match(/^\/(en|es)(?=\/|$)/);
    return m ? m[1] : 'no';
  }

  function isHome() {
    var path = location.pathname.replace(/\/+$/, '').replace(/^\/books/, '');
    path = path.replace(/^\/(en|es)(?=\/|$)/, '');
    return path === '' || path === '/';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderLatest() {
    if (!isHome()) return;
    var series = window.BOOKS_SERIES || [];
    var rows = [];
    series.forEach(function (s) {
      (s.books || []).forEach(function (b) {
        if (b.addedAt) rows.push({ s: s, b: b, ts: Date.parse(b.addedAt) || 0 });
      });
    });
    rows.sort(function (a, b) { return b.ts - a.ts; });
    rows = rows.slice(0, 3);
    if (!rows.length) return;

    var lang = currentLang();
    var base = /^\/books(\/|$)/.test(location.pathname) ? '/books' : '';
    var prefix = base + (lang === 'no' ? '' : '/' + lang);
    var labels = lang === 'en'
      ? { kicker: 'New releases', title: 'Latest books' }
      : lang === 'es'
        ? { kicker: 'Novedades', title: 'Últimos libros' }
        : { kicker: 'Nye utgivelser', title: 'Siste bøker' };

    var cards = rows.map(function (o) {
      var b = o.b;
      var cover = b.cover
        ? '<img src="' + esc(base + '/' + String(b.cover).replace(/^\//, '')) + '" alt="' + esc(b.title) + '" loading="lazy">'
        : '<span class="ph">' + esc(b.title) + '</span>';
      return '<a href="' + esc(prefix + '/book/' + b.id) + '" class="book-cell">' +
        '<div class="cover">' + cover + '</div>' +
        (b.subtitle ? '<div class="sub">' + esc(b.subtitle) + '</div>' : '<div class="sub">&nbsp;</div>') +
        '<h3>' + esc(b.title) + '</h3></a>';
    }).join('');

    var featured = document.querySelector('.featured');
    var section = featured ? featured.closest('section') : null;
    if (!section) return;
    section.innerHTML = '<div class="container">' +
      '<p class="kicker">' + esc(labels.kicker) + '</p>' +
      '<h2 class="serif" style="font-size:30px;margin-bottom:24px">' + esc(labels.title) + '</h2>' +
      '<div class="book-grid">' + cards + '</div></div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(renderLatest, 0);
  });
})();
