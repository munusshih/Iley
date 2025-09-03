import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

// Animation configurations
const ANIMATION_CONFIG = {
  duration: 1.2,
  ease: "power3.out",
  stagger: 0.1,
  fadeDistance: 60,
  scaleStart: 0.95,
};

class SiteAnimations {
  constructor() {
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.setupAnimations()
      );
    } else {
      this.setupAnimations();
    }
  }

  setupAnimations() {
    // SAFETY: Ensure all critical elements are visible before any animations
    gsap.set(
      ".project-header, .project-header *, .left-column, .left-column *, .right-column, .right-column *, .project-title, .project-title *, .project-meta, .role, .short-description",
      {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        clearProps: "transform",
      }
    );

    this.setupPageLoadAnimations();
    this.setupScrollAnimations();
    this.setupHoverAnimations();
    this.setupVideoAnimations();
    this.setupProjectNavigationAnimations();
    this.setupCustomCursor();
  }

  // Page load animations
  setupPageLoadAnimations() {
    // Ensure all elements are visible by default (fallback)
    gsap.set(
      "header, .project-detail, .video-carousel, main > *, .project-title h1, .project-meta, .role, .short-description, .project-thumbnail",
      {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
      }
    );

    // Create master timeline for page load
    const tl = gsap.timeline({ paused: true });

    // Animate header only
    tl.fromTo(
      "#site-navigation",
      {
        y: -100,
        opacity: 0,
      },
      {
        y: 0,
        opacity: 1,
        duration: ANIMATION_CONFIG.duration,
        ease: ANIMATION_CONFIG.ease,
      }
    );

    // Start the timeline
    tl.play();
  }

  // Scroll-triggered animations
  setupScrollAnimations() {
    // First ensure all elements are visible by default

    // Simple fade-in for media gallery items
    gsap.utils
      .toArray(".media-gallery .media-viewer")
      .forEach((element, index) => {
        gsap.fromTo(
          element,
          {
            opacity: 0.3,
            scale: 0.98,
          },
          {
            opacity: 1,
            scale: 1,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: element,
              start: "top 90%",
              toggleActions: "play none none none",
            },
            delay: index * 0.05,
          }
        );
      });

    // Footer slide-up animation - dramatic slide from bottom
    gsap.fromTo(
      "footer",
      {
        y: "100%",
        opacity: 0.8,
      },
      {
        y: "0%",
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "main",
          start: "bottom bottom",
          end: "bottom 90%",
          toggleActions: "play reverse play reverse",
          scrub: 1.5,
        },
      }
    );

    // Optional: Add body slide effect for enhanced footer reveal
    gsap.fromTo(
      "main, .main-content",
      {
        y: 0,
      },
      {
        y: -20,
        duration: 1.0,
        ease: "power2.out",
        scrollTrigger: {
          trigger: "footer",
          start: "top 80%",
          end: "top 40%",
          toggleActions: "play reverse play reverse",
          scrub: 1,
        },
      }
    );

    // Simple video carousel animation
    gsap.utils.toArray(".video-slide").forEach((element, index) => {
      gsap.fromTo(
        element,
        {
          opacity: 0.5,
          scale: 0.98,
        },
        {
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".video-carousel",
            start: "top 80%",
            toggleActions: "play none none none",
          },
          delay: index * 0.02,
        }
      );
    });

    // Scale animation for all images and videos (including YouTube embeds)
    gsap.utils
      .toArray("img, video, iframe[src*='youtube'], iframe[src*='youtu.be']")
      .forEach((element, index) => {
        gsap.fromTo(
          element,
          {
            scale: 0.85,
          },
          {
            scale: 1,
            duration: 1.2,
            ease: "power2.out",
            scrollTrigger: {
              trigger: element,
              start: "top 85%",
              end: "bottom 15%",
              toggleActions: "play reverse play reverse",
            },
            delay: index * 0.02,
          }
        );
      });
  }

  // Hover animations
  setupHoverAnimations() {
    // Media viewer hover effects
    gsap.utils.toArray(".media-viewer").forEach((element) => {
      const video = element.querySelector("video");
      const image = element.querySelector("img");
      const mediaElement = video || image;

      if (mediaElement) {
        // Set initial state
        gsap.set(element, { transformOrigin: "center center" });

        element.addEventListener("mouseenter", () => {
          gsap.to(element, {
            scale: 1.02,
            y: -8,
            duration: 0.4,
            ease: "power2.out",
          });
        });

        element.addEventListener("mouseleave", () => {
          gsap.to(element, {
            scale: 1,
            y: 0,
            duration: 0.4,
            ease: "power2.out",
          });
        });
      }
    });

    // Next project button hover
    gsap.utils.toArray(".next-project-card").forEach((button) => {
      // Set initial state
      gsap.set(button, { transformOrigin: "center center" });

      button.addEventListener("mouseenter", () => {
        gsap.to(button, {
          scale: 1.05,
          y: -5,
          duration: 0.4,
          ease: "power2.out",
        });

        // Animate the arrow in the "Next Project ➔" text
        const arrow = button.querySelector(".next-project-pre");
        if (arrow) {
          gsap.to(arrow, {
            x: 10,
            duration: 0.3,
            ease: "power2.out",
          });
        }
      });

      button.addEventListener("mouseleave", () => {
        gsap.to(button, {
          scale: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
        });

        const arrow = button.querySelector(".next-project-pre");
        if (arrow) {
          gsap.to(arrow, {
            x: 0,
            duration: 0.3,
            ease: "power2.out",
          });
        }
      });
    });
  }

  // Video-specific animations
  setupVideoAnimations() {
    // Animate sound toggle button
    gsap.utils.toArray(".sound-toggle").forEach((button) => {
      // Initial state
      gsap.set(button, { scale: 0, opacity: 0 });

      const container = button.closest(".video-container");
      if (container) {
        container.addEventListener("mouseenter", () => {
          gsap.to(button, {
            scale: 1,
            opacity: 1,
            duration: 0.3,
            ease: "back.out(1.7)",
          });
        });

        container.addEventListener("mouseleave", () => {
          gsap.to(button, {
            scale: 0,
            opacity: 0,
            duration: 0.2,
            ease: "power2.in",
          });
        });

        // Click animation
        button.addEventListener("click", () => {
          gsap.to(button, {
            scale: 1.2,
            duration: 0.1,
            ease: "power2.out",
            yoyo: true,
            repeat: 1,
          });
        });
      }
    });

    // Video description overlay animation
    gsap.utils.toArray(".video-description-overlay").forEach((overlay) => {
      const container = overlay.closest(".video-container");
      if (container) {
        // Initial state
        gsap.set(overlay, { y: 20, opacity: 0 });

        container.addEventListener("mouseenter", () => {
          gsap.to(overlay, {
            y: 0,
            opacity: 1,
            duration: 0.4,
            ease: "power2.out",
          });
        });

        container.addEventListener("mouseleave", () => {
          gsap.to(overlay, {
            y: 20,
            opacity: 0,
            duration: 0.3,
            ease: "power2.in",
          });
        });
      }
    });
  }

  // Project navigation animations
  setupProjectNavigationAnimations() {
    // Ensure all project header elements are visible and in correct position
    gsap.set(".left-column > *, .right-column > *", {
      opacity: 1,
      x: 0,
      y: 0,
    });

    // Simple fade-in only (no position changes)
    gsap.fromTo(
      ".left-column > *",
      {
        opacity: 0,
      },
      {
        opacity: 1,
        duration: ANIMATION_CONFIG.duration,
        ease: ANIMATION_CONFIG.ease,
        stagger: 0.1,
      }
    );

    gsap.fromTo(
      ".right-column > *",
      {
        opacity: 0,
      },
      {
        opacity: 1,
        duration: ANIMATION_CONFIG.duration,
        ease: ANIMATION_CONFIG.ease,
        delay: 0.3,
      }
    );
  }

  // Custom circular cursor
  setupCustomCursor() {
    // Create cursor elements
    const cursor = document.createElement("div");
    const cursorInner = document.createElement("div");

    cursor.className = "custom-cursor";
    cursorInner.className = "custom-cursor-inner";

    cursor.appendChild(cursorInner);
    document.body.appendChild(cursor);

    // Set initial styles to ensure visibility
    gsap.set(cursor, {
      opacity: 1,
      scale: 1,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    // Hide default cursor
    document.body.style.cursor = "none";
    document.documentElement.style.cursor = "none";

    // Cursor position tracking
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;

    // Update mouse position
    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Smooth cursor follow animation
    const updateCursor = () => {
      cursorX += (mouseX - cursorX) * 0.15;
      cursorY += (mouseY - cursorY) * 0.15;

      gsap.set(cursor, {
        x: cursorX,
        y: cursorY,
      });

      requestAnimationFrame(updateCursor);
    };
    updateCursor();

    // Hover effects for links and interactive elements
    const updateHoverElements = () => {
      const hoverElements = document.querySelectorAll(
        "a, button, .next-project-card, .media-viewer, .sound-toggle"
      );

      hoverElements.forEach((element) => {
        element.addEventListener("mouseenter", () => {
          gsap.to(cursor, {
            scale: 2.5,
            duration: 0.2,
            ease: "power2.out",
          });
          gsap.to(cursorInner, {
            scale: 0.3,
            duration: 0.2,
            ease: "power2.out",
          });
        });

        element.addEventListener("mouseleave", () => {
          gsap.to(cursor, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out",
          });
          gsap.to(cursorInner, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out",
          });
        });
      });
    };

    // Initial setup and re-setup for dynamic content
    updateHoverElements();
    setTimeout(updateHoverElements, 1000); // Re-setup after content loads

    // Hide cursor when leaving window
    document.addEventListener("mouseleave", () => {
      gsap.to(cursor, { opacity: 0, duration: 0.2 });
    });

    document.addEventListener("mouseenter", () => {
      gsap.to(cursor, { opacity: 1, duration: 0.2 });
    });
  }

  // Utility method to refresh ScrollTrigger (useful for dynamic content)
  refresh() {
    ScrollTrigger.refresh();
  }

  // Method to kill all animations (cleanup)
  destroy() {
    ScrollTrigger.killAll();
    gsap.killTweensOf("*");
  }
}

// Initialize animations when script loads
const siteAnimations = new SiteAnimations();

// Expose globally for debugging and dynamic content updates
window.siteAnimations = siteAnimations;

// Refresh animations on resize
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    siteAnimations.refresh();
  }, 250);
});

// Re-initialize animations for single-page app navigation
document.addEventListener("astro:page-load", () => {
  // Small delay to ensure content is rendered
  setTimeout(() => {
    siteAnimations.setupAnimations();
  }, 100);
});

export default siteAnimations;
