"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { setLenis } from "@/lib/scroll";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { stopPositions } from "@/lib/stops";

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
    /* From the station on, the ride goes stop to stop: one swipe and the train carries you to the
       next billboard, slowly, on its own. Outside that stretch the scroll is free. */
    let gliding = false;
    let lastGesture = 0;
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
      virtualScroll: (d) => {
        if (Math.abs(d.deltaY) < 2) return !gliding;
        return !glide(Math.sign(d.deltaY));
      },
    });
    const onKey = (e: KeyboardEvent) => {
      // → and ↓ ride forward to the next stop, ← and ↑ back to the last
      if (e.metaKey || e.ctrlKey || e.altKey || useStore.getState().menuOpen || useStore.getState().macOpen) return;
      const dir = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key) ? 1 : ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 0;
      if (dir && glide(dir)) e.preventDefault();
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
