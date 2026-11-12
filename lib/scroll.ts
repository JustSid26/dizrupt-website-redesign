import type Lenis from "lenis";
import { signals } from "@/lib/signals";
import { T } from "@/lib/motion";

// Single Lenis instance, owned by <SmoothScroll/>.
let instance: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};
export const getLenis = () => instance;

/* A trigger's progress from where the smooth scroll really is, to the fraction of a pixel, for what the
   3D flies by. The browser rounds the page's scroll to whole device pixels (on a screen at 100%, a
   laptop's usual, whole pixels), and the train or a camera driven by the rounded one moves in uneven
   steps, worst where a ride is slowest. Lenis keeps the exact position it set; where it isn't driving
   the page (reduced motion, the light version) or the two have parted (a jump the browser made itself),
   the trigger's own. The page's own type and layers keep the trigger's: they move with the real scroll. */
/* (Parted: further apart than a frame's lag. Safari reports the page's scroll a frame behind the one
   just set, so on a quick ride the two were several pixels apart on every other frame, and the train
   was driven by one and then the other, a stutter; a jump the browser made is hundreds) */
export const exactProgress = (self: { progress: number; start: number; end: number }) => {
  const y = instance?.animatedScroll;
  const span = self.end - self.start;
  if (y === undefined || !(span > 0) || Math.abs(y - window.scrollY) > Math.max(48, Math.abs(instance?.velocity ?? 0) * 3)) return self.progress;
  return Math.min(1, Math.max(0, (y - self.start) / span));
};

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
