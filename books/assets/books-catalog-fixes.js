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
    'declutter-digital-life': 'assets/covers/declutter-digital-life.webp',
    'fra-jord-til-bord': 'assets/covers/fra-jord-til-bord.webp',
    'polyfenolens-kraft': 'assets/covers/polyfenolens-kraft.webp',
    'let-me-explain-you': 'assets/covers/skatt-og-staten.webp',
    'spania-2030': 'assets/covers/spania-2030.webp',
    'olive-oil-cookbook': 'assets/covers/olive-oil-cookbook.webp',
    'the-olive-oil-cure': 'assets/covers/the-olive-oil-cure.webp',
    'relationship-blueprint': 'assets/covers/relationship-blueprint.webp',
    'time-mastery': 'assets/covers/time-mastery.webp',
    'guide-lalfas-albir-en': 'assets/covers/guide-lalfas-albir-en.jpg',
    'guide-lalfas-albir-no': 'assets/covers/guide-lalfas-albir-no.jpg',
    'guide-el-campello-no': 'assets/covers/guide-el-campello-no.jpg',
    'birokt-og-oliven': 'assets/covers/birokt-og-oliven.webp',
    'kunsten-a-hoste-tidlig': 'assets/covers/kunsten-a-hoste-tidlig.webp',
    'premium-olive-oil-processing': 'assets/covers/premium-olive-oil-processing.webp',
    'growing-premium-olives': 'assets/covers/growing-premium-olives.webp'
  };
  series.forEach(function (s) {
    (s.books || []).forEach(function (b) {
      if (recoveredCovers[b.id]) b.cover = recoveredCovers[b.id];
    });
  });

  var recoveredSeriesCovers = {
    'hidden-systems-of-power': 'assets/covers/hidden-systems-of-power-series.webp',
    'victoria-andreas': 'assets/covers/victoria-andreas-series.webp'
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
