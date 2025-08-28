// Site enhancement module: smooth scroll (Lenis), fade-in (GSAP), and a floating site-links panel
// Loads as an ES module in the browser and uses CDN ESM builds.

import Lenis from 'https://unpkg.com/@studio-freight/lenis?module';
import gsap from 'https://unpkg.com/gsap@3.12.2?module';

// Initialize Lenis for smooth scrolling
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
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href) return;

  // Only intercept same-page anchors
  if (href.startsWith('#')) {
    const el = document.querySelector(href);
    if (el) {
      e.preventDefault();
      lenis.scrollTo(el, { offset: 0, duration: 1.2 });
    }
  }
});

// GSAP fade-in when elements enter the viewport
const fadeSelector = '[data-animate="fade"], .animate-fade';
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        gsap.to(entry.target, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' });
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

function setupFadeIns() {
  document.querySelectorAll(fadeSelector).forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    observer.observe(el);
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', setupFadeIns);
} else {
  setupFadeIns();
}

// Build a floating panel that lists internal site links found on the page
function buildLinksPanel() {
  const anchors = Array.from(document.querySelectorAll('a[href^="/"]'))
    .map((a) => ({ href: a.getAttribute('href'), text: (a.textContent || a.getAttribute('aria-label') || a.getAttribute('title') || a.getAttribute('href')).trim() }))
    .filter((item) => item.href && !item.href.startsWith('/#'));

  // Deduplicate by href
  const seen = new Set();
  const links = anchors.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  if (links.length === 0) return;

  const panel = document.createElement('div');
  panel.id = 'site-links-panel';
  panel.innerHTML = `
    <button id="site-links-toggle" aria-expanded="false">☰</button>
    <div id="site-links-sheet" aria-hidden="true">
      <div id="site-links-inner">
        <h4>Pages</h4>
        <ul></ul>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const ul = panel.querySelector('ul');
  links.forEach((l) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = l.href;
    a.textContent = l.text || l.href;
    li.appendChild(a);
    ul.appendChild(li);
  });

  const toggle = panel.querySelector('#site-links-toggle');
  const sheet = panel.querySelector('#site-links-sheet');

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    sheet.setAttribute('aria-hidden', String(open));
    if (!open) {
      gsap.to(sheet, { autoAlpha: 1, y: 0, duration: 0.3 });
    } else {
      gsap.to(sheet, { autoAlpha: 0, y: -8, duration: 0.2 });
    }
  });

  // Basic styles
  const style = document.createElement('style');
  style.textContent = `
    #site-links-panel{position:fixed;right:18px;bottom:18px;z-index:9999;font-family:inherit}
    #site-links-toggle{background:#111;color:#fff;border:none;padding:10px 12px;border-radius:8px;cursor:pointer}
    #site-links-sheet{position:fixed;right:18px;bottom:64px;background:rgba(255,255,255,0.98);border-radius:10px;box-shadow:0 6px 28px rgba(0,0,0,0.12);padding:12px;max-height:60vh;overflow:auto;min-width:200px;display:block;opacity:0;transform:translateY(-8px)}
    #site-links-sheet[aria-hidden="true"]{pointer-events:none}
    #site-links-inner h4{margin:0 0 8px 0;font-size:13px}
    #site-links-inner ul{list-style:none;margin:0;padding:0}
    #site-links-inner li{margin:0 0 6px}
    #site-links-inner a{color:#111;text-decoration:none;font-size:14px}
  `;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', buildLinksPanel);
} else {
  buildLinksPanel();
}

// Expose lenis in case other scripts want to use it
window._lenis = lenis;
