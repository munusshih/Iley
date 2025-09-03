// Lenis smooth scroll only
import Lenis from "https://unpkg.com/@studio-freight/lenis?module";

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Smooth-scroll handler for same-page anchors
document.addEventListener("click", function (e) {
  const a = e.target.closest ? e.target.closest("a") : null;
  if (!a) return;
  const href = a.getAttribute("href");
  if (!href) return;
  // Only intercept same-page anchors
  if (href.startsWith("#")) {
    const el = document.querySelector(href);
    if (el) {
      e.preventDefault();
      lenis.scrollTo(el, { offset: 0, duration: 1.2 });
    }
  }
});

// Expose lenis in case other scripts want to use it
window._lenis = lenis;
