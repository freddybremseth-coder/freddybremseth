(function () {
  function currentLocale() {
    var m = location.pathname.match(/^\/(en|es)(?=\/|$)/);
    return m ? m[1] : 'no';
  }

  function currentBookSlug() {
    var m = location.pathname.match(/\/book\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function query(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (_) { return null; }
  }

  function send(eventType, bookSlug, metadata) {
    if (!bookSlug || !eventType) return;
    var payload = {
      eventType: eventType,
      bookSlug: bookSlug,
      locale: currentLocale(),
      path: location.pathname,
      referrer: document.referrer || null,
      utmSource: query('utm_source'),
      utmMedium: query('utm_medium'),
      utmCampaign: query('utm_campaign'),
      utmContent: query('utm_content'),
      utmTerm: query('utm_term'),
      metadata: metadata || {}
    };
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon('/api/growth-event', blob)) return;
      }
    } catch (_) {}
    fetch('/api/growth-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function slugFromBookHref(href) {
    try {
      var u = new URL(href, location.href);
      var m = u.pathname.match(/\/book\/([^/?#]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (_) { return null; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var slug = currentBookSlug();
    if (slug) send('book_view', slug, { source: 'page' });
  });

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a,button') : null;
    if (!el) return;

    var pageSlug = currentBookSlug();
    var href = el.getAttribute && el.getAttribute('href');

    if (el.matches && el.matches('[data-buy]')) {
      send('direct_buy_click', el.getAttribute('data-buy') || pageSlug, { destination: 'direct_checkout' });
      return;
    }

    if (href && /amazon\.[^/]+\//i.test(href)) {
      send('amazon_click', pageSlug, { destination: href });
      return;
    }

    if (href && /assets\/samples\//i.test(href)) {
      send('sample_click', pageSlug, { destination: href });
      return;
    }

    var targetSlug = href ? slugFromBookHref(href) : null;
    if (targetSlug && /\/topics\//.test(location.pathname)) {
      send('topic_to_book_click', targetSlug, { source_path: location.pathname });
      return;
    }
    if (targetSlug && /\/series\//.test(location.pathname)) {
      send('series_to_book_click', targetSlug, { source_path: location.pathname });
    }
  }, true);
})();
