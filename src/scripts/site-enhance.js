// Lenis smooth scroll only (npm import)
import Lenis from "lenis";
import gsap from "gsap";

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

  // Same-page anchors → smooth scroll
  if (href.startsWith("#")) {
    const el = document.querySelector(href);
    if (el) {
      e.preventDefault();
      lenis.scrollTo(el, { offset: 0, duration: 1.2 });
    }
  } else if (
    a.hostname === window.location.hostname &&
    a.pathname !== window.location.pathname
  ) {
    // Internal link → fade out, then navigate
    e.preventDefault();
    gsap.to("body", {
      opacity: 0,
      duration: 0.5,
      ease: "power2.inOut",
      onComplete: () => {
        window.location = href;
      },
    });
  }
});

// Fade in on page load
window.addEventListener("pageshow", () => {
  gsap.fromTo(
    "body",
    { opacity: 0 },
    { opacity: 1, duration: 0.5, ease: "power2.inOut" }
  );
});

// Expose lenis in case other scripts want to use it
window._lenis = lenis;
