// Lenis smooth scroll only (npm import)
import Lenis from "lenis";

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

  if (href.startsWith("#")) {
    const el = document.querySelector(href);
    if (el) {
      e.preventDefault();
      lenis.scrollTo(el, { offset: 0, duration: 1.2 });
    }
  }
});

// Expose lenis for other scripts
window._lenis = lenis;
