import type Lenis from "lenis";

// Single Lenis instance, owned by <SmoothScroll/>.
let instance: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};
export const getLenis = () => instance;

export const scrollToTarget = (target: string | number | HTMLElement, immediate = false) => {
  if (instance) {
    // the page may have just changed height (a route change); measure before clamping to it
    instance.resize();
    instance.scrollTo(target, { immediate, force: true, duration: 1.6 });
    return;
  }
  if (typeof target === "number") window.scrollTo({ top: target, behavior: immediate ? "auto" : "smooth" });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior: immediate ? "auto" : "smooth" });
  }
};
