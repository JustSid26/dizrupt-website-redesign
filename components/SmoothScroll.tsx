"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { setLenis } from "@/lib/scroll";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { landingPositions, stopPositions } from "@/lib/stops";

// One Lenis instance for the whole site, ticking with GSAP so ScrollTriggers stay in step.
export function SmoothScroll() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const loaded = useStore((s) => s.loaded);

  useEffect(() => {
    if (reducedMotion) {
      const onScroll = () => ScrollTrigger.update();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    /* The ride follows the scroll: the train moves as you scroll and never stops at a station on
       its own. The arrow keys can still carry it stop to stop. */
    let gliding = false;
    let lastGesture = 0;
    // the landing: one gesture plays the whole build-up, down or back up
    const autoLanding = (dir: number) => {
      const lp = landingPositions();
      if (!lp) return false;
      const y = window.scrollY, tol = 30;
      if (y < lp.start - tol || y > lp.built + tol) return false;
      if (dir > 0 && y >= lp.built - tol) return false; // past it: the scroll is free again
      if (dir < 0 && y <= lp.start + tol) return false;
      const now = performance.now();
      if (gliding || now - lastGesture < 350) { lastGesture = now; return true; }
      lastGesture = now;
      const target = dir > 0 ? lp.built : lp.start;
      gliding = true;
      lenis.scrollTo(target, {
        duration: Math.max(1.5, 5.5 * (Math.abs(target - y) / Math.max(1, lp.built - lp.start))),
        easing: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
        lock: true,
        force: true,
        onComplete: () => { gliding = false; lastGesture = performance.now(); },
      });
      return true;
    };
    const glide = (dir: number) => {
      const ys = stopPositions();
      if (ys.length < 2) return false;
      const y = window.scrollY;
      const tol = 40;
      // only between the station and the last billboard (and not scrolling up off the station, or down off the last)
      if (y < ys[0] - tol || y > ys[ys.length - 1] + tol) { signals.rideTarget = null; return false; }
      if (dir < 0 && y <= ys[0] + tol) return false;
      if (dir > 0 && y >= ys[ys.length - 1] - tol) return false;
      const now = performance.now();
      if (gliding || now - lastGesture < 350) { lastGesture = now; return true; } // one gesture, one stop
      lastGesture = now;
      const target = dir > 0 ? ys.find((v) => v > y + tol) : [...ys].reverse().find((v) => v < y - tol);
      if (target === undefined) return false;
      signals.rideTarget = ys.indexOf(target); // the train sets off now, not when the page catches up
      gliding = true;
      const dist = Math.abs(target - y);
      lenis.scrollTo(target, {
        // slow: the ride is the point. A sine ease has no rush in the middle.
        duration: Math.min(11, 7.5 + dist / 1500),
        easing: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
        lock: true,
        force: true,
        onComplete: () => { gliding = false; lastGesture = performance.now(); },
      });
      return true;
    };
    const lenis = new Lenis({
      lerp: 0.085, smoothWheel: true, syncTouch: false,
      // return false to take the gesture away from Lenis
      // the wheel and touch scroll freely, the train following; only the arrow keys ride stop to stop
      virtualScroll: (d) => {
        if (gliding) return false;
        if (Math.abs(d.deltaY) >= 2 && useStore.getState().loaded && autoLanding(Math.sign(d.deltaY))) return false;
        signals.rideTarget = null;
        return true;
      },
    });
    const onKey = (e: KeyboardEvent) => {
      // → and ↓ ride forward to the next stop, ← and ↑ back to the last
      if (e.metaKey || e.ctrlKey || e.altKey || useStore.getState().menuOpen || useStore.getState().macOpen) return;
      const dir = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key) ? 1 : ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 0;
      if (dir && (autoLanding(dir) || glide(dir))) e.preventDefault();
    };
    addEventListener("keydown", onKey);
    setLenis(lenis);
    lenis.on("scroll", (l: Lenis) => {
      signals.scroll.velocity = l.velocity;
      ScrollTrigger.update();
    });
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      removeEventListener("keydown", onKey);
      lenis.destroy();
      setLenis(null);
    };
  }, [reducedMotion]);

  // the landing holds until the count reaches 100
  useEffect(() => {
    document.documentElement.classList.toggle("is-loading", !loaded);
  }, [loaded]);

  return null;
}
