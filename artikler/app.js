(function () {
  const API_URL = "https://realtyflow.chatgenius.pro/api/public/website-content?brand=freddyb&destination=artikler&limit=50";
  const mount = document.getElementById("articles-app");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
  }

  function titleFromMarkdown(markdown, fallback) {
    const lines = String(markdown || "").split(/\r?\n/);
    for (var i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith("# ")) return line.slice(2).trim();
      if (line.startsWith("## ")) return line.slice(3).trim();
      if (line.startsWith("### ")) return line.slice(4).trim();
      break;
    }
    return String(fallback || "").trim();
  }

  function stripLeadingHeading(markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    let skipped = false;
    const output = [];
    lines.forEach(function (rawLine) {
      const line = rawLine.trim();
      if (!skipped && !line) return;
      if (!skipped && /^#{1,3}\s+/.test(line)) {
        skipped = true;
        return;
      }
      skipped = true;
      output.push(rawLine);
    });
    return output.join("\n").trim();
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    let html = "";
    let list = [];

    const flushList = function () {
      if (!list.length) return;
      html += "<ul>" + list.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>";
      list = [];
    };

    lines.forEach(function (rawLine) {
      const line = rawLine.trim();
      if (!line) {
        flushList();
        return;
      }
      if (/^[-*]\s+/.test(line)) {
        list.push(line.replace(/^[-*]\s+/, ""));
        return;
      }
      flushList();
      if (line.startsWith("### ")) html += "<h3>" + escapeHtml(line.slice(4)) + "</h3>";
      else if (line.startsWith("## ")) html += "<h2>" + escapeHtml(line.slice(3)) + "</h2>";
      else if (line.startsWith("# ")) html += "<h1>" + escapeHtml(line.slice(2)) + "</h1>";
      else html += "<p>" + escapeHtml(line) + "</p>";
    });

    flushList();
    return html;
  }

  function pathSlug() {
    var parts = window.location.pathname.replace(/\/+$/, "").split("/");
    if (parts.length >= 3 && parts[1] === "artikler") return parts[2] || "";
    return "";
  }

  function setSlug(slug) {
    var nextPath = slug ? ("/artikler/" + slug) : "/artikler/";
    history.replaceState({}, "", nextPath);
  }

  function selectedSlug() {
    return pathSlug() || new URL(window.location.href).searchParams.get("slug") || "";
  }

  function render(items) {
    if (!items.length) {
      mount.innerHTML = '<div class="empty-card">Ingen publiserte artikler enda.</div>';
      return;
    }

    const preparedItems = items.map(function (item) {
      const displayTitle = titleFromMarkdown(item.markdown, item.title);
      return Object.assign({}, item, {
        displayTitle: displayTitle,
        bodyMarkdown: stripLeadingHeading(item.markdown),
      });
    });

    const currentSlug = selectedSlug();
    const active = preparedItems.find(function (item) { return item.slug === currentSlug; }) || preparedItems[0];
    const detailOnlyClass = currentSlug ? " is-detail-only" : "";

    mount.innerHTML =
      '<div class="articles-layout">' +
        '<aside class="article-list">' +
          preparedItems.map(function (item) {
            const activeClass = item.slug === active.slug ? " is-active" : "";
            return (
              '<article class="article-card' + activeClass + '" data-slug="' + escapeHtml(item.slug) + '">' +
                '<div class="article-body">' +
                  '<div class="article-meta">' + escapeHtml(formatDate(item.published_at || item.created_at)) + '</div>' +
                  '<h3>' + escapeHtml(item.displayTitle) + '</h3>' +
                  '<p>' + escapeHtml(item.summary || "") + '</p>' +
                '</div>' +
              '</article>'
            );
          }).join("") +
        '</aside>' +
        '<article class="detail-panel' + detailOnlyClass + '">' +
          (active.image_url ? '<img class="detail-cover" src="' + escapeHtml(active.image_url) + '" alt="' + escapeHtml(active.title) + '">' : '<div class="detail-cover"></div>') +
          '<div class="detail-inner">' +
            '<a class="back-link" href="/artikler/">Tilbake til alle artikler</a>' +
            '<div class="detail-meta">' + escapeHtml(formatDate(active.published_at || active.created_at)) + '</div>' +
            '<h2>' + escapeHtml(active.displayTitle) + '</h2>' +
            '<p class="detail-summary">' + escapeHtml(active.summary || "") + '</p>' +
            '<div class="markdown">' + renderMarkdown(active.bodyMarkdown) + '</div>' +
          '</div>' +
        '</article>' +
      '</div>';

    mount.querySelectorAll(".article-card").forEach(function (card) {
      card.addEventListener("click", function () {
        setSlug(card.getAttribute("data-slug"));
        render(items);
      });
    });
  }

  fetch(API_URL)
    .then(function (response) { return response.json(); })
    .then(function (payload) { render(Array.isArray(payload.items) ? payload.items : []); })
    .catch(function () {
      mount.innerHTML = '<div class="empty-card">Kunne ikke laste artiklene akkurat na.</div>';
    });
})();
