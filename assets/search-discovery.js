(function () {
  var referrer = document.referrer || "";
  if (!referrer) return;

  var host = "";
  try { host = new URL(referrer).hostname.toLowerCase(); } catch (_) { return; }

  var known =
    host.indexOf("google.") !== -1 ||
    host === "bing.com" || host.endsWith(".bing.com") ||
    host === "chatgpt.com" || host.endsWith(".chatgpt.com") ||
    host === "copilot.microsoft.com" ||
    host === "perplexity.ai" || host.endsWith(".perplexity.ai") ||
    host === "gemini.google.com" ||
    host === "search.brave.com" ||
    host === "duckduckgo.com" || host.endsWith(".duckduckgo.com");

  if (!known) return;

  var path = window.location.pathname || "/";
  var key = "freddy:search-discovery:" + path + ":" + referrer;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch (_) {}

  fetch("https://realtyflow.chatgenius.pro/api/public/search-discovery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: path, referrer: referrer }),
    keepalive: true
  }).catch(function () {});
})();