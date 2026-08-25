(function () {
  function asset(p) {
    var base = /^\/books(\/|$)/.test(location.pathname) ? '/books' : '';
    return p ? base + '/' + String(p).replace(/^\//, '') : p;
  }
  function currentSlug() {
    var m = location.pathname.match(/\/book\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function findBook(slug) {
    var series = window.BOOKS_SERIES || [];
    for (var i = 0; i < series.length; i++) {
      var books = series[i].books || [];
      for (var j = 0; j < books.length; j++) if (books[j].id === slug) return books[j];
    }
    return null;
  }
  function label() {
    if (/^\/es(\/|$)/.test(location.pathname) || /^\/books\/es(\/|$)/.test(location.pathname)) return 'Leer / descargar muestra gratis';
    if (/^\/en(\/|$)/.test(location.pathname) || /^\/books\/en(\/|$)/.test(location.pathname)) return 'Read / download free sample';
    return 'Les / last ned gratis prøveeksemplar';
  }
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var slug = currentSlug();
      if (!slug) return;
      var book = findBook(slug);
      if (!book || !book.samplePath) return;
      var buyRow = document.querySelector('.buy-row');
      if (!buyRow || buyRow.querySelector('[data-direct-sample]')) return;
      var link = document.createElement('a');
      link.className = 'btn btn-secondary';
      link.setAttribute('data-direct-sample', 'true');
      link.href = asset(book.samplePath);
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('download', '');
      link.textContent = label();
      buyRow.appendChild(link);
    }, 0);
  });
})();
