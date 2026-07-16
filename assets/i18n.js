/*
 * freddybremseth.com språkhåndtering. Hvert språk har egne indekserbare
 * sider (/, /en/, /fr/, /es/, /de/, /ru/ — generert av scripts/build-i18n.mjs),
 * så språkvelgeren NAVIGERER til riktig side i stedet for å bytte tekst i
 * DOM-en. Ordbøkene (assets/i18n-dict.js, lastes før denne) brukes her kun
 * til dynamiske strenger via window.FB_T(key, fallback).
 */
(function () {
  var dict = window.FB_DICT || {};
  var LANG_NAMES = { no: "Norsk", en: "English", fr: "Français", es: "Español", de: "Deutsch", ru: "Русский" };
  var LANG_CODES = ["no", "en", "fr", "es", "de", "ru"];

  function pathLang() {
    var match = location.pathname.match(/^\/(en|fr|es|de|ru)(\/|$)/);
    return match ? match[1] : "no";
  }

  function targetPath(lang) {
    var path = location.pathname.replace(/^\/(en|fr|es|de|ru)(?=\/|$)/, "");
    if (path === "") path = "/";
    return (lang === "no" ? "" : "/" + lang) + path + location.hash;
  }

  var lang = pathLang();
  window.FB_LANG = lang;

  window.FB_T = function (key, fallback) {
    var d = window.FB_LANG !== "no" ? dict[window.FB_LANG] : null;
    var value = d ? d[key] : null;
    return value != null ? value : fallback;
  };

  function init() {
    document.querySelectorAll(".lang-switch").forEach(function (sel) {
      if (sel.options.length === 0) {
        LANG_CODES.forEach(function (code) {
          var opt = document.createElement("option");
          opt.value = code;
          opt.textContent = LANG_NAMES[code];
          sel.appendChild(opt);
        });
      }
      sel.value = lang;
      sel.addEventListener("change", function () {
        try { localStorage.setItem("fb_lang", sel.value); } catch (e) { /* private mode */ }
        location.href = targetPath(sel.value);
      });
    });

    // Førstegangsbesøk på norsk side: send til lagret/nettleser-språk hvis
    // det finnes en egen språkside for det.
    if (lang === "no") {
      var stored = null;
      try { stored = localStorage.getItem("fb_lang"); } catch (e) { /* private mode */ }
      var pick = stored;
      if (!pick) {
        var nav = String((navigator.languages && navigator.languages[0]) || navigator.language || "").slice(0, 2).toLowerCase();
        if (dict[nav]) pick = nav;
      }
      if (pick && pick !== "no" && dict[pick]) {
        location.replace(targetPath(pick));
        return;
      }
    }
    try { localStorage.setItem("fb_lang", lang); } catch (e) { /* private mode */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
