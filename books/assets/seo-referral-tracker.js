/* Source-only SEO attribution for public, indexable pages. No cookies, visitor IDs,
   referrer paths, search queries, form contents or checkout URLs are transmitted. */
(() => {
  "use strict";
  const HOST = "books.freddybremseth.com";
  const BRAND = "freddypublishing";
  const ENDPOINT = "https://realtyflow.chatgenius.pro/api/public/search-discovery";
  const SOURCES = [
    [/^gemini\.google\.com$/i, "google_gemini"],
    [/(^|\.)google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/i, "google_search"],
    [/(^|\.)bing\.com$/i, "bing_search"],
    [/(^|\.)chatgpt\.com$/i, "chatgpt"],
    [/^copilot\.microsoft\.com$/i, "microsoft_copilot"],
    [/(^|\.)perplexity\.ai$/i, "perplexity"],
    [/^search\.brave\.com$/i, "brave_search"],
    [/(^|\.)duckduckgo\.com$/i, "duckduckgo"],
  ];
  if (window.location.protocol !== "https:" || window.location.hostname !== HOST) return;
  const path = window.location.pathname;
  if (!(/^(?:\/(?:en|es))?\/(?:book|series|topics)\/[a-z0-9-]+\/?$/.test(path) || /^\/(?:en\/?|es\/?|(?:en|es)\/(?:about|library|contact)\/?|(?:about|library|contact)\/?)?$/.test(path))) return;
  let source;
  let host;
  try {
    const referrer = new URL(document.referrer);
    if (referrer.protocol !== "https:" || referrer.username || referrer.password || referrer.port) return;
    host = referrer.hostname.toLowerCase();
    source = SOURCES.find(([pattern]) => pattern.test(host))?.[1];
    if (!source) return;
  } catch {
    return;
  }
  const storageKey = BRAND + ":search-discovery:" + path + ":" + source;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
  } catch {
    // Disabled session storage cannot imply a prior measured arrival.
  }
  // The collector accepts only the public brand origin and a trusted source
  // hostname. The actual referrer URL stays in the visitor's browser.
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, referrer: "https://" + host + "/" }),
    keepalive: true,
  }).then(response => {
    // HTTP 204 means the collector confirmed its database write.
    if (response.status !== 204) return;
    try { window.sessionStorage.setItem(storageKey, "1"); } catch {}
  }).catch(() => undefined);
})();
