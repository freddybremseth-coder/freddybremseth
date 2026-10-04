/* books.freddybremseth.com — client app. Renders the 6 views from
 * window.BOOKS_SERIES (catalog) + window.BOOKS_L (UI strings), with real
 * per-language URLs (/books/, /books/en/…, /books/es/…). */
(function () {
  var SERIES = window.BOOKS_SERIES || [];
  var L = window.BOOKS_L || {};
  // Extra UI strings not in the design's L table (post-purchase download flow).
  var LX = {
    purchaseThanks:  { no: 'Takk for kjøpet!', en: 'Thank you for your purchase!', es: '¡Gracias por tu compra!' },
    downloadEbook:   { no: 'Last ned e-bok (PDF)', en: 'Download the ebook (PDF)', es: 'Descargar el ebook (PDF)' },
    downloadFailed:  { no: 'Kunne ikke hente nedlastingen. Kontakt oss hvis det vedvarer.', en: 'Could not fetch the download. Contact us if this persists.', es: 'No se pudo obtener la descarga. Contáctanos si persiste.' },
    ebookNotReady:   { no: 'Denne e-boken er ikke klar for salg ennå. Last ned et gratis prøvekapittel i mellomtiden.', en: "This ebook isn't for sale yet. Grab a free sample chapter meanwhile.", es: 'Este ebook aún no está a la venta. Descarga un capítulo de muestra gratis mientras tanto.' },
    checkoutSoon:    { no: 'Kjøp kommer snart.', en: 'Checkout coming soon.', es: 'Pago disponible pronto.' }
  };
  // Works both mounted at site root (subdomain project rooted at books/) and
  // under /books (shared project). BASE prefixes both routes and asset URLs.
  var BASE = /^\/books(\/|$)/.test(location.pathname) ? '/books' : '';
  function asset(p) { return p ? BASE + '/' + String(p).replace(/^\//, '') : p; }

  /* ---------- language + routing ---------- */
  function parseRoute() {
    var path = location.pathname.replace(/\/+$/, '');
    if (BASE) path = path.replace(/^\/books/, '');
    var lang = 'no';
    var m = path.match(/^\/(en|es)(?=\/|$)/);
    if (m) { lang = m[1]; path = path.replace(/^\/(en|es)/, ''); }
    path = path.replace(/^\//, '');
    var parts = path ? path.split('/') : [];
    var view = parts[0] || 'home';
    return { lang: lang, view: view, slug: parts[1] || null };
  }
  var R = parseRoute();
  var LANG = R.lang;

  function href(view, slug) {
    var p = BASE + (LANG === 'no' ? '' : '/' + LANG);
    if (!view || view === 'home') return p + '/';
    return p + '/' + view + (slug ? '/' + slug : '');
  }
  function langHref(target) {
    var p = BASE + (target === 'no' ? '' : '/' + target);
    if (R.view === 'home') return p + '/';
    return p + '/' + R.view + (R.slug ? '/' + R.slug : '');
  }

  /* ---------- i18n helpers ---------- */
  function pick(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v; // language-agnostic array
    return v[LANG] || v.en || v.no || '';
  }
  function t(key) { return pick(L[key]); }
  function tx(key) { return pick(LX[key]); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- data helpers ---------- */
  function seriesById(id) { for (var i = 0; i < SERIES.length; i++) if (SERIES[i].id === id) return SERIES[i]; return null; }
  function findBook(slug) {
    for (var i = 0; i < SERIES.length; i++) {
      var bs = SERIES[i].books || [];
      for (var j = 0; j < bs.length; j++) if (bs[j].id === slug) return { series: SERIES[i], book: bs[j] };
    }
    return null;
  }
  function booksWithCovers() {
    var out = [];
    SERIES.forEach(function (s) { (s.books || []).forEach(function (b) { if (b.cover) out.push({ s: s, b: b }); }); });
    return out;
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  /* ---------- chrome ---------- */
  function header() {
    return '' +
      '<header class="site-header"><div class="container">' +
      '<a class="brand" href="' + href('home') + '"><img class="brand-logo" src="' + esc(asset('assets/logo.png')) + '" alt="Freddy Bremseth — Bøker & serier"></a>' +
      '<button class="nav-toggle" aria-label="' + (LANG === 'no' ? 'Meny' : LANG === 'es' ? 'Menú' : 'Menu') + '" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '<nav class="nav">' +
      '<a href="' + href('about') + '"' + (R.view === 'about' ? ' class="active"' : '') + '>' + esc(t('navAbout')) + '</a>' +
      '<a href="' + href('library') + '"' + (R.view === 'library' || R.view === 'series' || R.view === 'book' ? ' class="active"' : '') + '>' + esc(t('navSeries')) + '</a>' +
      '<a href="' + href('contact') + '"' + (R.view === 'contact' ? ' class="active"' : '') + '>' + esc(t('navContact')) + '</a>' +
      '<span class="langs">' +
      ['no', 'en', 'es'].map(function (l) { return '<a href="' + langHref(l) + '"' + (LANG === l ? ' class="active"' : '') + '>' + l + '</a>'; }).join('') +
      '</span></nav></div></header>';
  }
  function footer() {
    return '<footer class="site-footer"><div class="container">' +
      '<img class="footer-logo" src="' + esc(asset('assets/logo.png')) + '" alt="Freddy Bremseth — Bøker & serier" loading="lazy" decoding="async">' +
      '<span class="footer-line">' + esc(t('footerLine')) + '</span>' +
      '<nav class="books-brand-network" aria-label="Freddy Bremseth prosjektnettverk">' +
      '<strong>Freddy Bremseth network</strong>' +
      '<a href="https://www.freddybremseth.com/">FreddyBremseth.com</a>' +
      '<a href="https://www.zenecohomes.com/">Zen Eco Homes</a>' +
      '<a href="https://www.pinosoecolife.com/">Pinoso Eco Life</a>' +
      '<a href="https://www.donaanna.com/">Doña Anna</a>' +
      '<a href="https://www.chatgenius.pro/">ChatGenius</a>' +
      '<a href="https://art.freddybremseth.com/">Art</a>' +
      '<a href="https://remaster.freddybremseth.com/">Re-Master Freddy</a>' +
      '</nav>' +
      '</div></footer>';
  }

  function coverCell(s, b, viewClass) {
    var inner = b.cover ? '<img src="' + esc(asset(b.cover)) + '" alt="' + esc(b.title) + '" loading="lazy" decoding="async" width="320" height="480">' : '<span class="ph">' + esc(b.title) + '</span>';
    return '<a href="' + href('book', b.id) + '" class="book-cell"><div class="cover">' + inner + '</div>' +
      (b.subtitle ? '<div class="sub">' + esc(b.subtitle) + '</div>' : '<div class="sub">&nbsp;</div>') +
      '<h3>' + esc(b.title) + '</h3></a>';
  }

  function galleryBlock(itemsHtml) {
    return '<div class="gallery-wrap">' +
      '<button class="gallery-nav prev" aria-label="' + (LANG === 'no' ? 'Forrige' : LANG === 'es' ? 'Anterior' : 'Previous') + '" type="button">‹</button>' +
      '<div class="gallery">' + itemsHtml + '</div>' +
      '<button class="gallery-nav next" aria-label="' + (LANG === 'no' ? 'Neste' : LANG === 'es' ? 'Siguiente' : 'Next') + '" type="button">›</button>' +
      '</div>';
  }

  var TOPICS = {
    'psychological-thrillers': {
      seriesIds: ['michael-thorne', 'elias-holm'],
      title: {
        no: 'Psykologiske thrillere om identitet, skyld og makt',
        en: 'Psychological Thrillers about Identity, Guilt and Power',
        es: 'Thrillers psicológicos sobre identidad, culpa y poder'
      },
      desc: {
        no: 'Mørke thrillere og krimserier om identitet, moralsk ansvar, manipulering, institusjoner og mennesker som tvinges til å tvile på det de tror de vet.',
        en: 'Dark thrillers and crime series about identity, moral responsibility, manipulation, institutions and people forced to question what they think they know.',
        es: 'Thrillers oscuros y series criminales sobre identidad, responsabilidad moral, manipulación, instituciones y personas obligadas a cuestionar lo que creen saber.'
      }
    },
    'geopolitics-power': {
      seriesIds: ['power-behind-curtain', 'hidden-systems-of-power'],
      title: {
        no: 'Bøker om geopolitikk, makt og verdensorden',
        en: 'Books on Geopolitics, Power and the World Order',
        es: 'Libros sobre geopolítica, poder y orden mundial'
      },
      desc: {
        no: 'Sakprosa om strategiske ressurser, kapital, krig, energi, valuta, forsyningskjeder og de strukturelle systemene som former global makt.',
        en: 'Nonfiction about strategic resources, capital, war, energy, currency, supply chains and the structural systems that shape global power.',
        es: 'No ficción sobre recursos estratégicos, capital, guerra, energía, divisas, cadenas de suministro y los sistemas estructurales que moldean el poder global.'
      }
    },
    'money-economics': {
      seriesIds: ['let-me-explain'],
      title: {
        no: 'Bøker om penger, økonomi, bank og finans',
        en: 'Books about Money, Economics, Banking and Finance',
        es: 'Libros sobre dinero, economía, banca y finanzas'
      },
      desc: {
        no: 'Klare forklaringer på hvordan penger, banker, kreditt, skatt, inflasjon, renter, gjeld og økonomiske insentiver faktisk fungerer.',
        en: 'Clear explanations of how money, banks, credit, taxes, inflation, interest rates, debt and economic incentives actually work.',
        es: 'Explicaciones claras de cómo funcionan realmente el dinero, los bancos, el crédito, los impuestos, la inflación, los tipos de interés, la deuda y los incentivos económicos.'
      }
    },
    'mediterranean-living': {
      seriesIds: ['mediterraneo-vital'],
      title: {
        no: 'Bøker om olivenolje, middelhavsliv og dyrking',
        en: 'Books about Olive Oil, Mediterranean Living and Growing',
        es: 'Libros sobre aceite de oliva, vida mediterránea y cultivo'
      },
      desc: {
        no: 'Olivenolje, polyfenoler, tidlig høsting, dyrking, mat, levetid og praktisk middelhavsliv — samlet i Mediterraneo Vital.',
        en: 'Olive oil, polyphenols, early harvest, cultivation, food, longevity and practical Mediterranean living — collected in Mediterraneo Vital.',
        es: 'Aceite de oliva, polifenoles, cosecha temprana, cultivo, alimentación, longevidad y vida mediterránea práctica — reunidos en Mediterraneo Vital.'
      }
    },
    'spain-costa-blanca': {
      seriesIds: ['let-me-guide-you'],
      title: {
        no: 'Bøker og guider om Spania og Costa Blanca',
        en: 'Books and Guides about Spain and Costa Blanca',
        es: 'Libros y guías sobre España y Costa Blanca'
      },
      desc: {
        no: 'Guider til steder, områder, boligvalg og hverdagsliv i Spania, med særlig vekt på Costa Blanca.',
        en: 'Guides to towns, areas, property choices and everyday life in Spain, with a strong focus on Costa Blanca.',
        es: 'Guías sobre ciudades, zonas, vivienda y vida cotidiana en España, con especial atención a la Costa Blanca.'
      }
    },
    'health-balanced-life': {
      seriesIds: ['balanced-life'],
      title: {
        no: 'Bøker om tid, relasjoner og et balansert liv',
        en: 'Books about Time, Relationships and a Balanced Life',
        es: 'Libros sobre tiempo, relaciones y una vida equilibrada'
      },
      desc: {
        no: 'Praktiske bøker om tid, digitale vaner, relasjoner, livsvalg og hvordan hverdagen kan bli mer balansert.',
        en: 'Practical books about time, digital habits, relationships, life choices and building a more balanced everyday life.',
        es: 'Libros prácticos sobre tiempo, hábitos digitales, relaciones, decisiones de vida y una vida cotidiana más equilibrada.'
      }
    },
    'childrens-books': {
      seriesIds: ['victoria-andreas'],
      title: {
        no: 'Barnebøker for å se, peke og lære sammen',
        en: 'Children’s Books for Looking, Pointing and Learning Together',
        es: 'Libros infantiles para mirar, señalar y aprender juntos'
      },
      desc: {
        no: 'Enkle, visuelle barnebøker med Victoria, Andreas og fuglevennen Pip — laget for små barn og voksne som vil se, peke, snakke og lære sammen.',
        en: 'Simple visual books with Victoria, Andreas and their bird friend Pip — made for young children and adults who want to look, point, talk and learn together.',
        es: 'Libros visuales sencillos con Victoria, Andreas y su amigo Pip — creados para niños pequeños y adultos que quieren mirar, señalar, hablar y aprender juntos.'
      }
    }
  };

  function topicById(id) { return TOPICS[id] || null; }

  function seriesCard(s) {
    var topCls = 'top' + (s.coverFit === 'contain' ? ' fit-contain' : '') + (s.coverBg ? ' bg-' + s.coverBg : '');
    var top = s.cover ? '<div class="' + topCls + '"><img src="' + esc(asset(s.cover)) + '" alt="" loading="lazy" decoding="async" width="360" height="200"></div>' : '<div class="top placeholder"><span>' + esc(pick(s.title)) + '</span></div>';
    return '<a class="series-card" href="' + href('series', s.id) + '">' + top +
      '<div class="body"><span class="tag">' + esc(pick(s.tag)) + '</span>' +
      '<h3>' + esc(pick(s.title)) + '</h3>' +
      '<p>' + esc(pick(s.desc)) + '</p>' +
      '<span class="count">' + esc(pick(s.count)) + '</span></div></a>';
  }

  /* ---------- views ---------- */
  function viewHome() {
    var copy = LANG === 'en'
      ? {
          kicker: 'Stories · ideas · a wider perspective',
          title: 'Books about people, power and the world around us',
          intro: 'From psychological crime and thrillers to geopolitics, economics, health, history, Mediterranean life and children’s books. I write for readers who like stories, questions and ideas that stay with them a little longer.',
          browse: 'Explore the books',
          series: 'See the series',
          about: 'About the author',
          worldsKicker: 'Different genres · the same curiosity',
          worldsTitle: 'One author, several worlds',
          worldsText: 'Crime. Power. History. Economics. Health. The Mediterranean. Children’s discoveries. Different genres, but the same curiosity about why people and systems work the way they do.',
          featuredSeries: 'Selected book series',
          allSeries: 'See all series',
          themes: 'Choose by theme',
          allThemes: 'See all themes',
          latest: 'Latest / current books',
          allBooks: 'See all books',
          aboutKicker: 'About the author',
          aboutTitle: 'Freddy Bremseth',
          aboutText: 'I write because I am curious about people, society and the world. Across genres I explore power, history, ideas and the good life — from dark crime stories to sunlit Mediterranean days and large historical dramas.',
          aboutCta: 'Read more about me',
          newsletterKicker: 'Stay updated',
          newsletterTitle: 'Get news about new books',
          newsletterText: 'Receive news about releases, book series and current themes directly in your inbox. No spam — only what is relevant.',
          subscribe: 'Subscribe',
          email: 'Your email address'
        }
      : LANG === 'es'
        ? {
            kicker: 'Historias · ideas · una perspectiva más amplia',
            title: 'Libros sobre personas, poder y el mundo que nos rodea',
            intro: 'Desde novela negra psicológica y thrillers hasta geopolítica, economía, salud, historia, vida mediterránea y libros infantiles. Escribo para lectores a quienes les gustan las historias, las preguntas y las ideas que permanecen un poco más.',
            browse: 'Explorar los libros',
            series: 'Ver las series',
            about: 'Sobre el autor',
            worldsKicker: 'Géneros distintos · la misma curiosidad',
            worldsTitle: 'Un autor, varios mundos',
            worldsText: 'Crimen. Poder. Historia. Economía. Salud. Mediterráneo. Descubrimientos infantiles. Géneros distintos, pero la misma curiosidad por comprender por qué las personas y los sistemas funcionan como lo hacen.',
            featuredSeries: 'Series destacadas',
            allSeries: 'Ver todas las series',
            themes: 'Elegir por tema',
            allThemes: 'Ver todos los temas',
            latest: 'Libros nuevos / actuales',
            allBooks: 'Ver todos los libros',
            aboutKicker: 'Sobre el autor',
            aboutTitle: 'Freddy Bremseth',
            aboutText: 'Escribo porque siento curiosidad por las personas, la sociedad y el mundo. A través de distintos géneros exploro el poder, la historia, las ideas y la buena vida — desde oscuros misterios hasta días mediterráneos y grandes dramas históricos.',
            aboutCta: 'Leer más sobre mí',
            newsletterKicker: 'Mantente al día',
            newsletterTitle: 'Recibe noticias sobre nuevos libros',
            newsletterText: 'Recibe información sobre lanzamientos, series y temas actuales directamente en tu bandeja de entrada. Sin spam — solo lo relevante.',
            subscribe: 'Suscribirse',
            email: 'Tu correo electrónico'
          }
        : {
            kicker: 'Historier · ideer · et større perspektiv',
            title: 'Bøker om mennesker, makt og verden rundt oss',
            intro: 'Fra psykologisk krim og thrillere til geopolitikk, økonomi, helse, historie, Middelhavsliv og barnebøker. Jeg skriver for lesere som liker historier, spørsmål og ideer som blir værende litt lenger.',
            browse: 'Utforsk bøkene',
            series: 'Se bokseriene',
            about: 'Om forfatteren',
            worldsKicker: 'Ulike sjangre · samme nysgjerrighet',
            worldsTitle: 'Én forfatter, flere verdener',
            worldsText: 'Krim. Makt. Historie. Økonomi. Helse. Middelhavet. Barnas oppdagelser. Ulike sjangre, men samme nysgjerrighet på hvorfor mennesker og systemer fungerer som de gjør.',
            featuredSeries: 'Utvalgte bokserier',
            allSeries: 'Se alle bokserier',
            themes: 'Velg etter tema',
            allThemes: 'Se alle temaer',
            latest: 'Nyeste / aktuelle bøker',
            allBooks: 'Se alle bøker',
            aboutKicker: 'Om forfatteren',
            aboutTitle: 'Freddy Bremseth',
            aboutText: 'Jeg skriver bøker fordi jeg er nysgjerrig på mennesker, samfunn og verden. Gjennom ulike sjangre utforsker jeg makt, historie, ideer og det gode livet – fra mørke krimgåter til solfylte middelhavsdager og store historiske dramaer.',
            aboutCta: 'Les mer om meg',
            newsletterKicker: 'Hold deg oppdatert',
            newsletterTitle: 'Få nyheter om nye bøker',
            newsletterText: 'Motta informasjon om nye utgivelser, bokserier og aktuelle temaer rett i innboksen. Ingen spam – bare det som er relevant.',
            subscribe: 'Abonner',
            email: 'Din e-postadresse'
          };

    var seriesOrder = [
      'michael-thorne',
      'elias-holm',
      'power-behind-curtain',
      'let-me-guide-you',
      'mediterraneo-vital',
      'balanced-life',
      'let-me-explain',
      'anatomy-of-empires',
      'hidden-systems-of-power',
      'victoria-andreas',
      'empire-after-the-empire'
    ];
    var selectedSeries = seriesOrder.map(seriesById).filter(Boolean);
    var seriesCards = selectedSeries.map(seriesCard).join('');

    var gallery = shuffle(booksWithCovers()).slice(0, 18).map(function (o) {
      return '<a class="gallery-item" href="' + href('book', o.b.id) + '"><img src="' + esc(asset(o.b.cover)) + '" alt="' + esc(o.b.title) + '" loading="lazy" decoding="async" width="150" height="225"><span>' + esc(o.b.title) + '</span></a>';
    }).join('');

    var themes = LANG === 'en'
      ? [
          ['Crime & thriller','psychological-thrillers','topics','⌁'],
          ['Power & geopolitics','geopolitics-power','topics','◎'],
          ['History','anatomy-of-empires','series','Ⅱ'],
          ['Economics','money-economics','topics','▥'],
          ['Health & lifestyle','health-balanced-life','topics','◒'],
          ['Mediterranean & Spain','spain-costa-blanca','topics','☼'],
          ['Children’s books','childrens-books','topics','◉']
        ]
      : LANG === 'es'
        ? [
            ['Crimen y thriller','psychological-thrillers','topics','⌁'],
            ['Poder y geopolítica','geopolitics-power','topics','◎'],
            ['Historia','anatomy-of-empires','series','Ⅱ'],
            ['Economía','money-economics','topics','▥'],
            ['Salud y estilo de vida','health-balanced-life','topics','◒'],
            ['Mediterráneo y España','spain-costa-blanca','topics','☼'],
            ['Libros infantiles','childrens-books','topics','◉']
          ]
        : [
            ['Krim & thriller','psychological-thrillers','topics','⌁'],
            ['Makt & geopolitikk','geopolitics-power','topics','◎'],
            ['Historie','anatomy-of-empires','series','Ⅱ'],
            ['Økonomi','money-economics','topics','▥'],
            ['Helse & livsstil','health-balanced-life','topics','◒'],
            ['Middelhavet & Spania','spain-costa-blanca','topics','☼'],
            ['Barnebøker','childrens-books','topics','◉']
          ];
    var themeCards = themes.map(function (item) {
      return '<a class="home-theme-card" href="' + href(item[2], item[1]) + '"><span class="home-theme-icon" aria-hidden="true">' + item[3] + '</span><strong>' + esc(item[0]) + '</strong></a>';
    }).join('');

    var releases = [];
    SERIES.forEach(function (s) {
      (s.books || []).forEach(function (b) {
        if (b.addedAt) releases.push({ s: s, b: b, ts: Date.parse(b.addedAt) || 0 });
      });
    });
    releases.sort(function (a, b) { return b.ts - a.ts; });
    releases = releases.slice(0, 3);
    var latestCards = releases.map(function (o) {
      var cover = o.b.cover
        ? '<img src="' + esc(asset(o.b.cover)) + '" alt="' + esc(o.b.title) + '" loading="lazy" decoding="async">'
        : '<span class="ph">' + esc(o.b.title) + '</span>';
      return '<a class="book-cell" href="' + href('book', o.b.id) + '">' +
        '<div class="home-latest-cover">' + cover + '</div>' +
        '<div><span class="home-latest-label">' + esc(pick(o.s.title)) + '</span><h3>' + esc(o.b.title) + '</h3>' +
        (o.b.subtitle ? '<p>' + esc(o.b.subtitle) + '</p>' : '') +
        '<strong>' + (LANG === 'en' ? 'Read more →' : LANG === 'es' ? 'Leer más →' : 'Les mer →') + '</strong></div></a>';
    }).join('');

    return '' +
      '<section class="hero"><div class="home-hero-media" aria-hidden="true"></div><div class="container home-hero-inner">' +
        '<div class="home-hero-copy"><p class="home-kicker">' + esc(copy.kicker) + '</p>' +
        '<h1>' + esc(copy.title) + '</h1><p class="home-hero-intro">' + esc(copy.intro) + '</p>' +
        '<div class="home-hero-actions"><a class="btn btn-primary" href="' + href('library') + '">' + esc(copy.browse) + ' →</a>' +
        '<a class="btn home-btn-outline" href="#bokserier">' + esc(copy.series) + '</a>' +
        '<a class="btn home-btn-outline" href="' + href('about') + '">' + esc(copy.about) + '</a></div></div>' +
      '</div></section>' +

      '<section class="home-worlds"><div class="container home-worlds-grid"><div><p class="home-kicker">' + esc(copy.worldsKicker) + '</p><h2>' + esc(copy.worldsTitle) + '</h2></div>' +
        '<div class="home-worlds-text"><p>' + esc(copy.worldsText) + '</p></div></div></section>' +

      '<section id="bokserier" class="home-series-section"><div class="container">' +
        '<div class="home-section-heading"><h2>' + esc(copy.featuredSeries) + '</h2><a href="' + href('library') + '">' + esc(copy.allSeries) + ' →</a></div>' +
        '<div class="series-grid home-series-grid">' + seriesCards + '</div></div></section>' +

      '<section class="home-themes-section"><div class="container">' +
        '<div class="home-section-heading"><h2>' + esc(copy.themes) + '</h2><a href="' + href('library') + '">' + esc(copy.allThemes) + ' →</a></div>' +
        '<div class="home-themes-grid">' + themeCards + '</div></div></section>' +

      (latestCards ? '<section class="home-latest-section"><div class="container"><div class="home-section-heading"><h2>' + esc(copy.latest) + '</h2><a href="' + href('library') + '">' + esc(copy.allBooks) + ' →</a></div><div class="home-latest-grid">' + latestCards + '</div>' + (gallery ? '<div class="home-more-titles"><h3>' + (LANG === 'en' ? 'More titles' : LANG === 'es' ? 'Más títulos' : 'Flere titler') + '</h3>' + galleryBlock(gallery) + '</div>' : '') + '</div></section>' : '') +

      '<section class="home-about-section"><div class="container home-about-grid">' +
        '<div class="home-about-photo"><img src="' + esc(asset('assets/freddy-bremseth.jpg')) + '" alt="Freddy Bremseth" loading="lazy" decoding="async"></div>' +
        '<div class="home-about-copy"><p class="home-kicker">' + esc(copy.aboutKicker) + '</p><h2>' + esc(copy.aboutTitle) + '</h2><p>' + esc(copy.aboutText) + '</p><a class="btn btn-primary" href="' + href('about') + '">' + esc(copy.aboutCta) + ' →</a></div>' +
        '<blockquote class="home-author-quote">“' + (LANG === 'no' ? 'Gode historier stiller spørsmål vi tar med oss videre. De kan underholde, opplyse – og kanskje også endre hvordan vi ser verden.' : LANG === 'es' ? 'Las buenas historias plantean preguntas que llevamos con nosotros. Pueden entretener, iluminar y quizá cambiar cómo vemos el mundo.' : 'Good stories ask questions we carry with us. They can entertain, illuminate — and perhaps change how we see the world.') + '”<cite>— Freddy Bremseth</cite></blockquote>' +
      '</div></section>' +

      '<section class="home-newsletter"><div class="container home-newsletter-grid"><div><p class="home-kicker">' + esc(copy.newsletterKicker) + '</p><h2>' + esc(copy.newsletterTitle) + '</h2><p>' + esc(copy.newsletterText) + '</p></div>' +
        '<form class="inline-form home-newsletter-form" data-form="newsletter"><input type="email" name="email" required placeholder="' + esc(copy.email) + '"><button class="btn btn-primary" type="submit">' + esc(copy.subscribe) + '</button><div class="form-msg" data-msg></div></form></div></section>';
  }

  function viewAbout() {
    var worlds = pick(L.worldsList) || [];
    var rows = '';
    for (var i = 0; i < worlds.length; i += 2) {
      rows += '<div class="row"><div>' + esc(worlds[i]) + '</div>' + (worlds[i + 1] ? '<div>' + esc(worlds[i + 1]) + '</div>' : '<div></div>') + '</div>';
    }
    return '<section><div class="container about-wrap">' +
      '<p class="kicker">' + esc(t('aboutKicker')) + '</p>' +
      '<h1>' + esc(t('aboutTitle')) + '</h1>' +
      '<img class="about-photo" src="' + BASE + '/assets/freddy-bremseth.jpg" alt="Freddy Bremseth">' +
      '<div class="about-bio">' + esc(t('aboutBio')) + '</div>' +
      '<div class="quote" style="clear:both;margin-top:32px">' + esc(t('whyIWriteQuote')) + '<span class="meta">— Freddy Bremseth</span></div>' +
      '<h2 class="serif" style="font-size:22px;margin-top:40px">' + esc(t('worldsTitle')) + '</h2>' +
      '<div class="divider-list">' + rows + '</div>' +
      '</div></section>';
  }

  function viewLibrary() {
    var carousel = shuffle(booksWithCovers()).map(function (o) {
      return '<a class="gallery-item" href="' + href('book', o.b.id) + '"><img src="' + esc(asset(o.b.cover)) + '" alt="' + esc(o.b.title) + '" loading="lazy"><span>' + esc(o.b.title) + '</span></a>';
    }).join('');
    var cards = SERIES.map(seriesCard).join('');
    return '<section><div class="container">' +
      '<p class="kicker">' + esc(t('seriesKicker')) + '</p>' +
      '<h1>' + esc(t('seriesPageTitle')) + '</h1>' +
      '<p class="pill">' + esc(t('bundleAllNote')) + '</p>' +
      '<p style="max-width:720px;margin-top:16px">' + esc(t('discountNote')) + '</p>' +
      galleryBlock(carousel) +
      '<div class="series-grid">' + cards + '</div>' +
      '</div></section>';
  }

  function viewTopic() {
    var topic = topicById(R.slug);
    if (!topic) return notFound();
    var selected = SERIES.filter(function (s) { return topic.seriesIds.indexOf(s.id) !== -1; });
    var seriesCards = selected.map(seriesCard).join('');
    var books = [];
    selected.forEach(function (s) {
      (s.books || []).forEach(function (b) { books.push({ s: s, b: b }); });
    });
    var bookCards = books.map(function (o) { return coverCell(o.s, o.b); }).join('');
    var labels = LANG === 'en'
      ? { kicker: 'Explore by theme', series: 'Series in this theme', books: 'Books in this theme', back: 'All books' }
      : LANG === 'es'
        ? { kicker: 'Explorar por tema', series: 'Series de este tema', books: 'Libros de este tema', back: 'Todos los libros' }
        : { kicker: 'Utforsk etter tema', series: 'Serier i dette temaet', books: 'Bøker i dette temaet', back: 'Alle bøker' };
    return '<section class="topic-page"><div class="container">' +
      '<p class="breadcrumb"><a href="' + href('library') + '">← ' + esc(labels.back) + '</a></p>' +
      '<p class="kicker">' + esc(labels.kicker) + '</p>' +
      '<h1>' + esc(pick(topic.title)) + '</h1>' +
      '<p class="topic-intro">' + esc(pick(topic.desc)) + '</p>' +
      (seriesCards ? '<h2 class="serif topic-section-title">' + esc(labels.series) + '</h2><div class="series-grid">' + seriesCards + '</div>' : '') +
      (bookCards ? '<h2 class="serif topic-section-title">' + esc(labels.books) + '</h2><div class="book-grid">' + bookCards + '</div>' : '') +
      '</div></section>';
  }

  function viewSeries() {
    var s = seriesById(R.slug);
    if (!s) return notFound();
    var books = (s.books || []).map(function (b) { return coverCell(s, b); }).join('');
    var placeholders = '';
    var n = s.placeholderCount || 0;
    if (n > 0) {
      var ph = '';
      for (var i = 0; i < n; i++) ph += '<div class="placeholder-card">' + esc(t('coverComing') || 'Cover and text coming') + '</div>';
      placeholders = '<div class="book-grid">' + ph + '</div><p class="pending-note">' + esc(t('pendingNote') || '') + '</p>';
    }
    return '<section><div class="container">' +
      '<p class="breadcrumb"><a href="' + href('library') + '">' + esc(t('backLabelAll')) + '</a></p>' +
      '<p class="kicker">' + esc(pick(s.tag)) + '</p>' +
      '<h1>' + esc(pick(s.title)) + '</h1>' +
      '<p style="max-width:720px">' + esc(pick(s.desc)) + '</p>' +
      '<p class="pill" style="margin-top:16px">' + esc(t('bundleSeriesNote')) + '</p>' +
      '<div class="book-grid">' + books + '</div>' + placeholders +
      '</div></section>';
  }

  function viewBook() {
    var f = findBook(R.slug);
    if (!f) return notFound();
    var s = f.series, b = f.book;
    var cover = b.cover ? '<img src="' + esc(asset(b.cover)) + '" alt="' + esc(b.title) + '">' : '<span class="ph">' + esc(b.title) + '</span>';
    var descFull = pick(b.descFull);
    var quote = '';
    if (b.excerpt) {
      var wc = b.words ? b.words.toLocaleString() + ' ' + (t('wordsLabel') || 'words') : '';
      var pc = b.pages ? '~' + b.pages + ' ' + (t('pagesLabel') || 'pages') : '';
      var meta = [wc, pc].filter(Boolean).join(' · ');
      quote = '<div class="quote">' + esc(b.excerpt) + (meta ? '<span class="meta">' + esc(meta) + '</span>' : '') + '</div>';
    }
    var siblings = (s.books || []).filter(function (x) { return x.id !== b.id; });
    var more = '';
    if (siblings.length) {
      more = '<section><div class="container"><h2 class="serif" style="font-size:22px">' + esc(t('moreInSeriesLabel')) + '</h2>' +
        '<div class="book-grid">' + siblings.map(function (x) { return coverCell(s, x); }).join('') + '</div></div></section>';
    }
    var lead = '';
    if (b.samplePath) {
      lead = '<div class="lead-panel" data-lead data-book="' + esc(b.id) + '" data-sample="' + esc(b.samplePath) + '">' +
        '<h3>' + esc(t('leadTitle')) + '</h3>' +
        '<form data-form="lead">' +
        '<div class="field"><input name="name" required placeholder="' + esc(t('leadNamePlaceholder')) + '"></div>' +
        '<div class="field"><input type="email" name="email" required placeholder="' + esc(t('leadEmailPlaceholder')) + '"></div>' +
        '<button class="btn btn-primary" type="submit">' + esc(t('leadSubmitLabel')) + '</button></form>' +
        '<div class="form-msg" data-msg></div></div>';
    }
    var qs = new URLSearchParams(location.search);
    var purchasePanel = '';
    if (qs.get('purchase') === 'success') {
      purchasePanel = '<div class="lead-panel" data-download data-session="' + esc(qs.get('session_id') || '') + '">' +
        '<h3>' + esc(tx('purchaseThanks')) + '</h3>' +
        '<button class="btn btn-primary" data-download-btn>' + esc(tx('downloadEbook')) + '</button>' +
        '<div class="form-msg" data-msg></div></div>';
    }
    return '<section><div class="container">' +
      '<p class="breadcrumb"><a href="' + href('series', s.id) + '">' + esc(t('backLabelSeries')) + '</a></p>' +
      purchasePanel +
      '<div class="detail"><div class="cover">' + cover + '</div><div>' +
      '<p class="kicker">' + esc(pick(s.title)) + (b.subtitle ? ' · ' + esc(b.subtitle) : '') + '</p>' +
      '<h1>' + esc(b.title) + '</h1>' +
      (descFull ? '<p class="desc">' + esc(descFull) + '</p>' : '<p class="desc" style="font-style:italic;color:var(--muted)">' + esc(t('descComing') || '') + '</p>') +
      quote +
      '<div class="buy-row">' +
      '<button class="btn btn-primary" data-buy="' + esc(b.id) + '">' + esc(t('buyButtonLabel')) + '</button>' +
      '<a class="btn btn-secondary" href="' + esc(b.amazon || '#') + '"' + (b.amazon ? ' target="_blank" rel="noopener"' : ' data-amazon-missing') + '>' + esc(t('printButtonLabel')) + '</a>' +
      '</div>' +
      '<a class="bundle-link" href="' + href('series', s.id) + '">' + esc(t('bundleSeriesButtonLabel')) + '</a>' +
      '<p class="small-print">' + esc(t('storesNote')) + '</p>' +
      lead +
      '</div></div></div></section>' + more;
  }

  function notFound() {
    return '<section><div class="container narrow"><h1>404</h1><p><a href="' + href('home') + '">' + esc(t('backLabelAll') || '← Home') + '</a></p></div></section>';
  }

  /* ---------- forms + checkout ---------- */
  function api(path, body) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  function wire(root) {
    root.querySelectorAll('form[data-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var kind = form.getAttribute('data-form');
        var data = {};
        form.querySelectorAll('input,textarea').forEach(function (el) { if (el.name) data[el.name] = el.value; });
        data.locale = LANG;
        var panel = form.closest('[data-msg]') ? form.closest('[data-msg]') : form.parentNode;
        var msg = panel.querySelector('[data-msg]');
        if (kind === 'newsletter') {
          data.source = 'newsletter';
          api('/api/subscribe', data).catch(function () {});
          form.reset(); if (msg) msg.textContent = t('newsletterThanks') || '✓';
        } else if (kind === 'contact') {
          api('/api/contact', data).then(function(){ form.reset(); if (msg) msg.textContent = t('contactThanks') || '✓'; })
            .catch(function(){ if (msg) msg.textContent = t('contactThanks') || '✓'; });
        } else if (kind === 'lead') {
          var leadEl = form.closest('[data-lead]');
          data.book = leadEl.getAttribute('data-book'); data.source = 'sample';
          var sample = leadEl.getAttribute('data-sample');
          api('/api/lead', data).catch(function () {});
          // reveal the download (client-side gate, persistence is fire-and-forget)
          leadEl.innerHTML = '<h3>' + esc(t('leadTitle')) + '</h3><a class="btn btn-primary" href="' + esc(asset(sample)) + '" target="_blank" rel="noopener" download>' + esc(t('sampleButtonLabel')) + '</a>';
        }
      });
    });
    root.querySelectorAll('[data-download-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = btn.closest('[data-download]');
        var sid = panel.getAttribute('data-session');
        var msg = panel.querySelector('[data-msg]');
        btn.classList.add('is-disabled'); btn.textContent = '…';
        fetch('/api/download?session_id=' + encodeURIComponent(sid))
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.url) location.href = j.url; else throw new Error('no url'); })
          .catch(function () {
            btn.classList.remove('is-disabled'); btn.textContent = tx('downloadEbook');
            if (msg) msg.textContent = tx('downloadFailed');
          });
      });
    });
    root.querySelectorAll('[data-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-buy');
        btn.classList.add('is-disabled'); btn.textContent = '…';
        api('/api/create-checkout', { bookId: id, kind: 'single', locale: LANG })
          .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
          .then(function (x) {
            if (x.j && x.j.url) { location.href = x.j.url; return; }
            btn.classList.remove('is-disabled'); btn.textContent = t('buyButtonLabel');
            alert(x.j && x.j.error === 'ebook_not_available' ? tx('ebookNotReady') : tx('checkoutSoon'));
          })
          .catch(function () { btn.classList.remove('is-disabled'); btn.textContent = t('buyButtonLabel'); alert(tx('checkoutSoon')); });
      });
    });
  }

  /* ---------- mount + SEO meta ---------- */
  function setMeta() {
    document.documentElement.lang = LANG;
    var title = 'Freddy Bremseth';
    var desc = t('heroSubtitle');
    if (R.view === 'book') { var f = findBook(R.slug); if (f) { title = f.book.title + ' — Freddy Bremseth'; desc = pick(f.book.descShort) || desc; } }
    else if (R.view === 'series') { var s = seriesById(R.slug); if (s) { title = pick(s.title) + ' — Freddy Bremseth'; desc = pick(s.desc) || desc; } }
    else if (R.view === 'topics') { var topic = topicById(R.slug); if (topic) { title = pick(topic.title) + ' — Freddy Bremseth'; desc = pick(topic.desc) || desc; } }
    else if (R.view === 'about') title = t('aboutTitle') + ' — Freddy Bremseth';
    else if (R.view === 'library') title = t('seriesPageTitle') + ' — Freddy Bremseth';
    else if (R.view === 'contact') title = t('contactTitle') + ' — Freddy Bremseth';
    document.title = title;
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', desc);
  }

  function render() {
    var body;
    switch (R.view) {
      case 'about': body = viewAbout(); break;
      case 'library': body = viewLibrary(); break;
      case 'series': body = viewSeries(); break;
      case 'topics': body = viewTopic(); break;
      case 'book': body = viewBook(); break;
      case 'contact': body = viewContact(); break;
      default: body = viewHome();
    }
    var app = document.getElementById('app');
    app.innerHTML = header() + '<main>' + body + '</main>' + footer();
    setMeta();
    wire(app);
    var navToggle = app.querySelector('.nav-toggle');
    if (navToggle) navToggle.addEventListener('click', function () {
      var h = app.querySelector('.site-header');
      var open = h.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    app.querySelectorAll('.gallery-wrap').forEach(function (wrap) {
      var g = wrap.querySelector('.gallery');
      var prev = wrap.querySelector('.gallery-nav.prev');
      var next = wrap.querySelector('.gallery-nav.next');
      function update() {
        var max = g.scrollWidth - g.clientWidth - 2;
        prev.disabled = g.scrollLeft <= 2;
        next.disabled = g.scrollLeft >= max;
      }
      function step(dir) { g.scrollBy({ left: dir * Math.max(320, Math.round(g.clientWidth * 0.85)), behavior: 'smooth' }); }
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
      g.addEventListener('scroll', update, { passive: true });
      update();
    });
    window.scrollTo(0, 0);
  }

  function viewContact() {
    return '<section><div class="container narrow">' +
      '<p class="kicker">' + esc(t('contactKicker')) + '</p>' +
      '<h1>' + esc(t('contactTitle')) + '</h1>' +
      '<p>' + esc(t('contactText')) + '</p>' +
      '<form data-form="contact" style="text-align:left;margin-top:22px">' +
      '<div class="field"><input name="name" required placeholder="' + esc(t('contactNamePlaceholder')) + '"></div>' +
      '<div class="field"><input type="email" name="email" required placeholder="' + esc(t('contactEmailPlaceholder')) + '"></div>' +
      '<div class="field"><textarea name="message" required placeholder="' + esc(t('contactMessagePlaceholder')) + '"></textarea></div>' +
      '<button class="btn btn-primary" type="submit">' + esc(t('contactSendLabel')) + '</button></form>' +
      '<div class="form-msg" data-msg></div>' +
      '</div></section>';
  }

  // A remote /api/cover image may fail when storage is unavailable. Show the
  // book title instead of the browser's broken-image icon; never substitute
  // artwork from another book or imply that a missing cover has been published.
  document.addEventListener('error', function (event) {
    var img = event.target;
    if (!img || img.tagName !== 'IMG' || !img.closest) return;
    var selector = '.book-cell .cover img, .detail .cover img, .gallery-item img, .series-card .top img, .featured img';
    if (!img.matches(selector)) return;
    var parent = img.parentElement;
    if (!parent) return;
    var fallback = document.createElement('span');
    fallback.className = 'ph book-cover-fallback';
    fallback.textContent = img.alt || 'Freddy Bremseth';
    if (parent.classList.contains('top')) parent.classList.add('placeholder');
    if (parent.classList.contains('gallery-item')) parent.classList.add('has-cover-fallback');
    if (parent.closest('.featured')) parent.classList.add('featured-cover-fallback');
    img.replaceWith(fallback);
  }, true);

  document.addEventListener('DOMContentLoaded', render);
})();