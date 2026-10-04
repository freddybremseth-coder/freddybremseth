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
    'michael-thorne': 'assets/series/michael-thorne-editorial.webp',
    'elias-holm': 'assets/series/elias-holm-2026-final.webp',
    'power-behind-curtain': 'assets/series/power-behind-curtain-2026-final.webp',
    'mediterraneo-vital': 'assets/series/mediterraneo-vital-editorial.webp',
    'balanced-life': 'assets/series/balanced-life-2026.webp?v=20261004c',
    'let-me-explain': 'assets/series/let-me-explain-2026.webp?v=20261004c',
    'let-me-guide-you': 'assets/series/let-me-guide-you-2026-final.webp',
    'anatomy-of-empires': 'assets/series/anatomy-of-empires-2026.webp?v=20261004c',
    'hidden-systems-of-power': 'assets/series/hidden-systems-of-power-2026.webp?v=20261004c',
    'victoria-andreas': 'assets/series/victoria-andreas-editorial.webp',
    'empire-after-the-empire': 'assets/series/empire-after-the-empire-editorial.webp'
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

  // Localized series metadata. The canonical catalog still owns the book data,
  // but the Spanish UI must not fall back to English for series labels/descriptions.
  var spanishSeries = {
    'michael-thorne': {
      title: 'Serie Michael Thorne',
      tag: 'Crimen psicológico',
      desc: 'Thrillers psicológicos sobre justicia, culpa, identidad, responsabilidad, manipulación y autoengaño.',
      count: '8 libros'
    },
    'elias-holm': {
      title: 'Serie Elias Holm',
      tag: 'Thriller criminal nórdico',
      desc: 'Una serie de investigación sobre motivos humanos, identidades ocultas, pruebas y verdades que no siempre encajan con los registros oficiales.',
      count: '8 libros'
    },
    'power-behind-curtain': {
      title: 'El poder tras el telón',
      tag: 'Poder · geopolítica · sistemas ocultos',
      desc: 'Una investigación sobre cómo funciona el poder global en la práctica: capital, guerra, información, instituciones, recursos y narrativas.',
      count: '7 libros'
    },
    'mediterraneo-vital': {
      title: 'Mediterraneo Vital',
      tag: 'No ficción · vida mediterránea',
      desc: 'Aceitunas, polifenoles, agricultura regenerativa, longevidad y vida en la Costa Blanca, desde una perspectiva práctica y documentada.',
      count: '9 libros'
    },
    'balanced-life': {
      title: 'The Balanced Life Series',
      tag: 'Salud · hábitos · equilibrio',
      desc: 'Libros prácticos sobre tiempo, hábitos digitales, relaciones, decisiones de vida y cómo construir una vida cotidiana más equilibrada.',
      count: '5 libros'
    },
    'let-me-explain': {
      title: 'Let Me Explain It to You',
      tag: 'Economía · tecnología · ideas complejas',
      desc: 'Temas complejos explicados con lenguaje claro: dinero, economía, tecnología, inteligencia artificial, psicología, poder e instituciones.',
      count: '10 libros'
    },
    'let-me-guide-you': {
      title: 'Let Me Guide You',
      tag: 'España · Costa Blanca · guías prácticas',
      desc: 'Guías prácticas sobre ciudades, zonas, vivienda y vida cotidiana en España, con especial atención a la Costa Blanca.',
      count: '25 libros'
    },
    'anatomy-of-empires': {
      title: 'The Anatomy of Empires',
      tag: 'Historia · imperios · poder',
      desc: 'Libros sobre cómo surgen, funcionan y caen los imperios, y sobre las fuerzas políticas, económicas y militares que moldean la historia.',
      count: '1 libro'
    },
    'hidden-systems-of-power': {
      title: 'Hidden Systems of Power',
      tag: 'Infraestructura · recursos · poder estructural',
      desc: 'Una serie sobre las redes, materias primas, rutas, cables y cuellos de botella que sostienen y condicionan el poder moderno.',
      count: '4 libros'
    },
    'victoria-andreas': {
      title: 'Victoria & Andreas',
      tag: 'Libros infantiles · mirar y aprender',
      desc: 'Libros visuales sencillos para niños pequeños y adultos que quieren mirar, señalar, hablar y aprender juntos.',
      count: '12 libros'
    },
    'empire-after-the-empire': {
      title: 'The Empire After the Empire',
      tag: 'Historia · Rusia · revolución',
      desc: 'Una historia estructural de Rusia, la revolución, la construcción del Estado y los órdenes políticos que surgieron tras el imperio.',
      count: '2 libros'
    }
  };
  series.forEach(function (s) {
    var es = spanishSeries[s.id];
    if (!es) return;
    s.title = s.title || {};
    s.tag = s.tag || {};
    s.desc = s.desc || {};
    s.count = s.count || {};
    s.title.es = es.title;
    s.tag.es = es.tag;
    s.desc.es = es.desc;
    s.count.es = es.count;
  });

  // Mark the actual edition language of every catalog entry. UI translations of
  // descriptions are not treated as translated book editions.
  var englishIds = {
    'the-facade-of-justice':1,'shadows-of-the-past':1,'the-ascendants':1,'the-hollow-witness':1,
    'the-black-archive':1,'the-unseen-trial':1,'the-badge-and-the-blade':1,'the-last-exhibition':1,
    'the-suspicion-machine':1,'arms-power':1,'the-olive-oil-cure':1,'premium-olive-oil-processing':1,
    'growing-premium-olives':1,'olive-oil-cookbook':1,'my-journey-as-a-father':1,'time-mastery':1,
    'declutter-digital-life':1,'relationship-blueprint':1,'how-money-works':1,'the-economy-explained':1,
    'understanding-artificial-intelligence':1,'crypto-explained':1,'the-psychology-of-you':1,
    'guide-costa-blanca':1,'rome':1,'the-chokepoints-of-power':1,'the-minerals-of-power':1,
    'the-empire-of-the-tsars':1,'red-revolution':1,'the-cables-beneath-the-world':1
  };
  var norwegianIds = {
    'mannen-som-dode-to-ganger':1,'huset-uten-navn':1,'rommet-med-knoklene':1,'den-siste-passasjeren':1,
    'de-dode-signerer-ikke':1,'den-levende-graven':1,'navnene-vi-begravde':1,'den-siste-identifikasjonen':1,
    'krig-kapital':1,'hvem-eier-virkeligheten':1,'vapenmakten':1,'mistankens-maskin':1,
    'birokt-og-oliven':1,'fra-jord-til-bord':1,'polyfenolens-kraft':1,'kunsten-a-hoste-tidlig':1,
    'lev-100-ar':1,'jeg-er-ikke-et-eksempel':1,'hvordan-penger-fungerer':1,'okonomien-forklart':1,
    'teknologi-enkelt-forklart':1,'psykologien-i-deg':1,'let-me-explain-you':1,'spania-2030':1,
    'maktens-flaskehalser':1,'hvordan-makt-fungerer':1
  };
  series.forEach(function (s) {
    (s.books || []).forEach(function (b) {
      if (/-en$/.test(b.id)) b.editionLang = 'en';
      else if (/-no$/.test(b.id)) b.editionLang = 'no';
      else if (/-es$/.test(b.id)) b.editionLang = 'es';
      else if (b.id === 'la-maquina-de-la-sospecha') b.editionLang = 'es';
      else if (englishIds[b.id]) b.editionLang = 'en';
      else if (norwegianIds[b.id]) b.editionLang = 'no';
    });
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
