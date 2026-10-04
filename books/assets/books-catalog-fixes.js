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
    'growing-premium-olives': 'assets/covers/growing-premium-olives.webp',
    'hvordan-makt-fungerer': 'assets/covers/hvordan-makt-fungerer.jpg',
    'the-cables-beneath-the-world': 'assets/covers/the-cables-beneath-the-world.jpg',
    'red-revolution': 'assets/covers/red-revolution.jpg',
    'the-empire-of-the-tsars': 'assets/covers/the-empire-of-the-tsars.jpg'
  };
  series.forEach(function (s) {
    (s.books || []).forEach(function (b) {
      if (recoveredCovers[b.id]) b.cover = recoveredCovers[b.id];
    });
  });

  var recoveredSeriesCovers = {
    'michael-thorne': 'assets/series/2026-10-homepage/01-michael-thorne-series.webp',
    'elias-holm': 'assets/series/2026-10-homepage/02-elias-holm-series.webp',
    'power-behind-curtain': 'assets/series/2026-10-homepage/03-makten-bak-kulissene.webp',
    'mediterraneo-vital': 'assets/series/2026-10-homepage/04-mediterraneo-vital.webp',
    'balanced-life': 'assets/series/2026-10-homepage/05-balanced-life.webp',
    'let-me-explain': 'assets/series/2026-10-homepage/06-let-me-explain-it-to-you.webp',
    'let-me-guide-you': 'assets/series/2026-10-homepage/07-let-me-guide-you.webp',
    'anatomy-of-empires': 'assets/series/2026-10-homepage/08-anatomy-of-empires.webp',
    'hidden-systems-of-power': 'assets/series/2026-10-homepage/09-hidden-systems-of-power.webp',
    'victoria-andreas': 'assets/series/2026-10-homepage/10-victoria-andreas.webp',
    'empire-after-the-empire': 'assets/series/2026-10-homepage/11-empire-after-the-empire.webp'
  };
  series.forEach(function (s) {
    if (recoveredSeriesCovers[s.id]) s.cover = recoveredSeriesCovers[s.id];
  });

  // Keep all series artwork consistent as cinematic landscape cards.
  var seriesCoverLayout = {
    'michael-thorne': { fit: 'cover', bg: 'dark' },
    'elias-holm': { fit: 'cover', bg: 'dark' },
    'power-behind-curtain': { fit: 'cover', bg: 'dark' },
    'mediterraneo-vital': { fit: 'cover', bg: 'light' },
    'balanced-life': { fit: 'cover', bg: 'light' },
    'let-me-explain': { fit: 'cover', bg: 'dark' },
    'let-me-guide-you': { fit: 'cover', bg: 'light' },
    'anatomy-of-empires': { fit: 'cover', bg: 'dark' },
    'hidden-systems-of-power': { fit: 'cover', bg: 'dark' },
    'victoria-andreas': { fit: 'cover', bg: 'light' },
    'empire-after-the-empire': { fit: 'cover', bg: 'dark' }
  };
  series.forEach(function (s) {
    var layout = seriesCoverLayout[s.id];
    if (!layout) return;
    s.coverFit = layout.fit;
    s.coverBg = layout.bg;
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
