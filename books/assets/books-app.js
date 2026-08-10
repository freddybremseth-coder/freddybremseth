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
      '<a class="brand" href="' + href('home') + '">Freddy Bremseth</a>' +
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
      '<span class="brand">Freddy Bremseth</span>' +
      '<span>' + esc(t('footerLine')) + '</span>' +
      '</div></footer>';
  }

  function coverCell(s, b, viewClass) {
    var inner = b.cover ? '<img src="' + esc(asset(b.cover)) + '" alt="' + esc(b.title) + '" loading="lazy">' : '<span class="ph">' + esc(b.title) + '</span>';
    return '<a href="' + href('book', b.id) + '" class="book-cell"><div class="cover">' + inner + '</div>' +
      (b.subtitle ? '<div class="sub">' + esc(b.subtitle) + '</div>' : '<div class="sub">&nbsp;</div>') +
      '<h3>' + esc(b.title) + '</h3></a>';
  }

  /* ---------- views ---------- */
  function viewHome() {
    var featured = findBook('hvem-eier-virkeligheten');
    var gallery = booksWithCovers().map(function (o) {
      return '<a class="gallery-item" href="' + href('book', o.b.id) + '"><img src="' + esc(asset(o.b.cover)) + '" alt="' + esc(o.b.title) + '" loading="lazy"><span>' + esc(o.b.title) + '</span></a>';
    }).join('');
    var pillars = [
      ['pillar1Title', 'pillar1Text', 'michael-thorne'],
      ['pillar2Title', 'pillar2Text', 'power-behind-curtain'],
      ['pillar3Title', 'pillar3Text', 'mediterraneo-vital']
    ].map(function (p) {
      var s = seriesById(p[2]);
      var img = s && s.cover ? '<img src="' + esc(asset(s.cover)) + '" alt="">' : '';
      return '<div class="pillar">' + img + '<h3>' + esc(t(p[0])) + '</h3><p>' + esc(t(p[1])) + '</p></div>';
    }).join('');

    var feat = '';
    if (featured) {
      var b = featured.book;
      feat = '<section><div class="container"><div class="featured">' +
        '<div>' + (b.cover ? '<img src="' + esc(asset(b.cover)) + '" alt="' + esc(b.title) + '">' : '') + '</div>' +
        '<div><p class="kicker">' + esc(t('featuredKicker')) + '</p>' +
        '<h2>' + esc(t('featuredTitle')) + '</h2>' +
        '<p>' + esc(t('featuredBlurbShort')) + '</p>' +
        '<a class="btn btn-primary" href="' + href('book', b.id) + '">' + esc(t('ctaReadMore')) + '</a></div>' +
        '</div></div></section>';
    }

    return '' +
      '<section class="hero"><div class="hero-inner">' +
      '<p class="kicker">' + esc(t('heroKicker')) + '</p>' +
      '<h1>' + esc(t('heroTitle')) + '</h1>' +
      '<p>' + esc(t('heroSubtitle')) + '</p>' +
      '<div class="btns"><a class="btn btn-primary" href="' + href('library') + '">' + esc(t('ctaBrowse')) + '</a>' +
      '<a class="btn btn-secondary" href="' + href('about') + '">' + esc(t('ctaAbout')) + '</a></div>' +
      '</div></section>' +
      feat +
      '<section><div class="container"><h2 class="serif" style="font-size:26px">' + esc(t('galleryTitle')) + '</h2>' +
      '<div class="gallery">' + gallery + '</div></div></section>' +
      '<section class="section-tint"><div class="container center">' +
      '<h2 class="serif" style="font-size:30px">' + esc(t('pillarsTitle')) + '</h2>' +
      '<div class="pillars">' + pillars + '</div></div></section>' +
      '<section><div class="container narrow">' +
      '<h2 class="serif" style="font-size:28px">' + esc(t('newsletterTitle')) + '</h2>' +
      '<p>' + esc(t('newsletterText')) + '</p>' +
      '<form class="inline-form" data-form="newsletter">' +
      '<input type="email" name="email" required placeholder="' + esc(t('newsletterPlaceholder')) + '">' +
      '<button class="btn btn-primary" type="submit">' + esc(t('newsletterButton')) + '</button></form>' +
      '<div class="form-msg" data-msg></div>' +
      '</div></section>';
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
    var cards = SERIES.map(function (s) {
      var top = s.cover ? '<div class="top"><img src="' + esc(asset(s.cover)) + '" alt=""></div>' : '<div class="top placeholder"><span>' + esc(pick(s.title)) + '</span></div>';
      return '<a class="series-card" href="' + href('series', s.id) + '">' + top +
        '<div class="body"><span class="tag">' + esc(pick(s.tag)) + '</span>' +
        '<h3>' + esc(pick(s.title)) + '</h3>' +
        '<p>' + esc(pick(s.desc)) + '</p>' +
        '<span class="count">' + esc(pick(s.count)) + '</span></div></a>';
    }).join('');
    return '<section><div class="container">' +
      '<p class="kicker">' + esc(t('seriesKicker')) + '</p>' +
      '<h1>' + esc(t('seriesPageTitle')) + '</h1>' +
      '<p class="pill">' + esc(t('bundleAllNote')) + '</p>' +
      '<p style="max-width:720px;margin-top:16px">' + esc(t('discountNote')) + '</p>' +
      '<div class="gallery" style="margin-top:24px">' + carousel + '</div>' +
      '<div class="series-grid">' + cards + '</div>' +
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
      case 'book': body = viewBook(); break;
      case 'contact': body = viewContact(); break;
      default: body = viewHome();
    }
    var app = document.getElementById('app');
    app.innerHTML = header() + '<main>' + body + '</main>' + footer();
    setMeta();
    wire(app);
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

  document.addEventListener('DOMContentLoaded', render);
})();
