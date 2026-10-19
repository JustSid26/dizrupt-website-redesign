import type Lenis from "lenis";
import { signals } from "@/lib/signals";
import { T } from "@/lib/motion";

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
    instance.scrollTo(target, { immediate, force: true, duration: T.nav });
    return;
  }
  if (typeof target === "number") window.scrollTo({ top: target, behavior: immediate ? "auto" : "smooth" });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior: immediate ? "auto" : "smooth" });
  }
};

/* A ride to one of the stops (SmoothScroll.tsx), sent from the page rather than a gesture: the AI
   section's step buttons. Without the rides (reduced motion) it is a plain jump there. */
let rideTo: ((y: number) => boolean) | null = null;
export const setRideTo = (fn: ((y: number) => boolean) | null) => {
  rideTo = fn;
};
export const rideToStop = (y: number) => {
  if (rideTo?.(y)) return;
  scrollToTarget(y, true);
};
