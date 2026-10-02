/* Catalog placement fixes and latest-book metadata.
   Keep this file small and idempotent: it runs both at build time and in the browser. */
(function () {
  var series = window.BOOKS_SERIES = window.BOOKS_SERIES || [];

  function byId(id) {
    for (var i = 0; i < series.length; i++) if (series[i].id === id) return series[i];
    return null;
  }

  function moveBook(bookId, fromSeriesId, toSeriesId) {
    var from = byId(fromSeriesId);
    var to = byId(toSeriesId);
    if (!from || !to) return;
    from.books = from.books || [];
    to.books = to.books || [];

    var book = null;
    var kept = [];
    for (var i = 0; i < from.books.length; i++) {
      if (from.books[i].id === bookId) book = from.books[i];
      else kept.push(from.books[i]);
    }
    from.books = kept;
    if (!book) return;

    for (var j = 0; j < to.books.length; j++) {
      if (to.books[j].id === bookId) {
        to.books[j] = Object.assign({}, to.books[j], book);
        return;
      }
    }
    to.books.push(book);
  }

  moveBook('the-chokepoints-of-power', 'anatomy-of-empires', 'hidden-systems-of-power');
  moveBook('maktens-flaskehalser', 'anatomy-of-empires', 'hidden-systems-of-power');

  // These two original covers are already committed in assets/covers.
  // Restore their catalog links without changing any book titles or editions.
  var recoveredCovers = {
    'arms-power': 'assets/covers/arms-power.png',
    'lev-100-ar': 'assets/covers/lev-100-ar.jpg',
    'declutter-digital-life': 'api/cover?id=declutter-digital-life',
    'fra-jord-til-bord': 'api/cover?id=fra-jord-til-bord',
    'polyfenolens-kraft': 'api/cover?id=polyfenolens-kraft',
    'let-me-explain-you': 'api/cover?id=let-me-explain-you',
    'spania-2030': 'api/cover?id=spania-2030',
    'olive-oil-cookbook': 'api/cover?id=olive-oil-cookbook',
    'the-olive-oil-cure': 'api/cover?id=the-olive-oil-cure',
    'relationship-blueprint': 'api/cover?id=relationship-blueprint',
    'time-mastery': 'api/cover?id=time-mastery',
    'guide-lalfas-albir-en': 'api/cover?id=guide-lalfas-albir-en',
    'guide-lalfas-albir-no': 'api/cover?id=guide-lalfas-albir-no',
    'guide-el-campello-no': 'api/cover?id=guide-el-campello-no',
    'birokt-og-oliven': 'api/cover?id=birokt-og-oliven',
    'kunsten-a-hoste-tidlig': 'api/cover?id=kunsten-a-hoste-tidlig',
    'premium-olive-oil-processing': 'api/cover?id=premium-olive-oil-processing',
    'growing-premium-olives': 'api/cover?id=growing-premium-olives'
  };
  series.forEach(function (s) {
    (s.books || []).forEach(function (b) {
      if (recoveredCovers[b.id]) b.cover = recoveredCovers[b.id];
    });
  });

  var recoveredSeriesCovers = {
    'hidden-systems-of-power': 'api/cover?id=hidden-systems-of-power',
    'victoria-andreas': 'api/cover?id=victoria-andreas'
  };
  series.forEach(function (s) {
    if (recoveredSeriesCovers[s.id]) s.cover = recoveredSeriesCovers[s.id];
  });

  var latest = {
    'hvordan-makt-fungerer': '2026-08-26T17:58:22Z',
    'the-cables-beneath-the-world': '2026-08-26T17:55:01Z',
    'red-revolution': '2026-08-26T17:48:50Z'
  };

  series.forEach(function (s) {
    (s.books || []).forEach(function (b) {
      if (latest[b.id]) b.addedAt = latest[b.id];
    });
  });
})();
