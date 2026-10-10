(() => {
  const body = document.body;
  if (!body) return;
  body.classList.add("fb-enhanced");

  const header = document.querySelector(".site-nav");
  // Every page needs a visible language entry. Localised detail pages are not
  // published yet, so these links lead to each translated homepage.
  if (header && !header.querySelector(".lang-switch")) {
    const localeNames = { no: "Norsk", en: "English", es: "Español", fr: "Français", de: "Deutsch", ru: "Русский" };
    const currentLocale = (location.pathname.match(/^\\/(en|es|fr|de|ru)(?:\\/|$)/) || [])[1] || "no";
    const language = document.createElement("select");
    language.className = "lang-switch fb-header-language";
    language.setAttribute("aria-label", "Velg språk / Choose language");
    language.setAttribute("title", "Andre språk åpner den oversatte forsiden");
    Object.entries(localeNames).forEach(([code, label]) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = label;
      language.appendChild(option);
    });
    language.value = currentLocale;
    language.addEventListener("change", () => {
      try { localStorage.setItem("fb_lang", language.value); } catch (_) {}
      location.href = language.value === "no" ? "/" : "/" + language.value + "/";
    });
    const nav = header.querySelector(".nav-links");
    if (nav) header.insertBefore(language, nav);
    else header.appendChild(language);
  }
  // Keep the language selector visible even when mobile navigation is collapsed.
  if (header) {
    const selector = header.querySelector(".lang-switch");
    const nav = header.querySelector(".nav-links");
    if (selector && nav) {
      selector.classList.add("fb-header-language");
      header.insertBefore(selector, nav);
    }
  }
  if (header) {
    const setScrolled = () => header.classList.toggle("is-scrolled", window.scrollY > 18);
    setScrolled();
    addEventListener("scroll", setScrolled, { passive: true });

    const nav = header.querySelector(".nav-links");
    if (nav && !header.querySelector(".fb-menu-toggle")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fb-menu-toggle";
      button.setAttribute("aria-label", "Åpne meny");
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = "☰";
      button.addEventListener("click", () => {
        const open = header.classList.toggle("nav-open");
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Lukk meny" : "Åpne meny");
        button.innerHTML = open ? "×" : "☰";
      });
      nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
        header.classList.remove("nav-open");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Åpne meny");
        button.innerHTML = "☰";
      }));
      header.insertBefore(button, nav);
    }
  }

  const footer = document.querySelector(".footer");
  if (footer && !footer.querySelector(".fb-brand-network")) {
    const network = document.createElement("nav");
    network.className = "fb-brand-network";
    network.setAttribute("aria-label", "Freddy Bremseth prosjektnettverk");
    network.innerHTML = '<strong>Freddy Bremseth network</strong>' +
      '<a href="https://www.zenecohomes.com/">Zen Eco Homes</a>' +
      '<a href="https://www.pinosoecolife.com/">Pinoso Eco Life</a>' +
      '<a href="https://www.donaanna.com/">Doña Anna</a>' +
      '<a href="https://www.chatgenius.pro/">ChatGenius</a>' +
      '<a href="https://books.freddybremseth.com/">Books</a>' +
      '<a href="https://art.freddybremseth.com/">Art</a>' +
      '<a href="https://remaster.freddybremseth.com/">Re-Master Freddy</a>';
    footer.appendChild(network);
  }

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const candidates = document.querySelectorAll(
    ".card,.intent-card,.image-card,.panel,.about-quote,.role-card,.stat,.hero-media,.hero-photo-wrap,.booking-embed,.section-title"
  );
  candidates.forEach((element, index) => {
    element.classList.add("fb-reveal", "fb-reveal-delay-" + ((index % 3) + 1));
  });

  if (!("IntersectionObserver" in window)) {
    candidates.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  candidates.forEach((element) => observer.observe(element));
})();