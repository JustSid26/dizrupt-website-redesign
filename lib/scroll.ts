import type Lenis from "lenis";
import { signals } from "@/lib/signals";

// Single Lenis instance, owned by <SmoothScroll/>.
let instance: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};
export const getLenis = () => instance;

// A ride between scroll stops under way (SmoothScroll.tsx) is dropped when the page is sent somewhere
// else: the jump replaces its scroll, so the ride would never hear that it ended, and would keep
// swallowing every gesture after it while it waited.
let cancelRide: (() => void) | null = null;
export const setRideCanceller = (fn: (() => void) | null) => {
  cancelRide = fn;
};

export const scrollToTarget = (target: string | number | HTMLElement, immediate = false) => {
  cancelRide?.();
  signals.navJumpUntil = performance.now() + (immediate ? 300 : 1900);
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
