(() => {
  const body = document.body;
  if (!body) return;
  body.classList.add("fb-enhanced");

  const header = document.querySelector(".site-nav");
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