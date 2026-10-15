"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { setLenis } from "@/lib/scroll";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { scrollStops, workStops, type ScrollStop } from "@/lib/stops";

// One Lenis instance for the whole site, ticking with GSAP so ScrollTriggers stay in step.
export function SmoothScroll() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const loaded = useStore((s) => s.loaded);
  const home = usePathname() === "/";

  useEffect(() => {
    if (reducedMotion) {
      const onScroll = () => ScrollTrigger.update();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    /* From the DIZRUPT screen to the last billboard the scroll goes stop to stop: one gesture and
       you are carried to the next stop at the ride's own pace, however hard or soft the gesture was.
       Anything more while it plays (a trackpad's momentum, a second flick) is ignored, so the
       animation between two stops always plays out whole. Past the last billboard the scroll is free. */
    /* A ride is under way from one stop to another: nothing sent while it plays (its own momentum, a
       second swipe, a double scroll) changes it. */
    let glide: { stops: ScrollStop[]; i: number; dir: number; chain: boolean } | null = null;
    let landedAt = 0; // when the last ride came to rest: its momentum is still arriving for a moment
    let seq = 0;
    let lastEvent = 0, lastAbs = 0, peak = 0, trough = 0, freshAt = 0, rising = 0;
    let push = 0, pushed = false; // how far the current gesture has gone, and whether it has moved a stop yet
    const TOL = 40;
    // a gesture has to mean it: a brush of the trackpad isn't a ride (a wheel's notch is past this at once)
    const INTENT = 60;
    const sine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t); // from rest: no rush in the middle
    const onward = (t: number) => 1 - (1 - t) * (1 - t); // already moving: carry on, then settle
    const go = (stops: ScrollStop[], i: number, moving: boolean) => {
      const y = window.scrollY, to = stops[i];
      const dir = to.y > y ? 1 : -1;
      const leg = dir > 0 ? to : stops[i + 1] ?? to; // the leg being ridden, whichever way
      const from = dir > 0 ? stops[i - 1] : stops[i + 1];
      // the whole leg takes its full time; from partway along it, that part of it
      const part = from ? Math.min(1, Math.abs(to.y - y) / Math.max(1, Math.abs(to.y - from.y))) : 1;
      // the train drives itself there now, rather than when the page catches up
      signals.rideTarget = to.train;
      // chain: this ride runs through a waypoint (the hand-over): it plays out whole, nothing extends it
      glide = { stops, i, dir, chain: !!to.pass || !!glide?.chain };
      const token = ++seq;
      lenis.scrollTo(to.y, {
        duration: Math.max(1.2, leg.dur * part),
        easing: moving ? onward : sine,
        lock: true,
        force: true,
        onComplete: () => {
          if (token !== seq) return;
          // a waypoint: carry on through it to the next stop the same way, from rest at its own pace
          const next = stops[i + dir];
          if (to.pass && next) return go(stops, i + dir, false);
          landedAt = performance.now();
          glide = null;
        },
      });
    };
    /* true: the gesture is the ride's (started one, sent it on, or swallowed); false: scroll freely.
       fresh: a new gesture, not the tail of the last one. A trackpad's momentum keeps sending
       events for a second or more after the swipe, so a pause alone can't tell them apart. */
    const ride = (dir: number, fresh: boolean) => {
      // a ride under way plays out whole: a second swipe (or a double scroll) while it runs is ignored,
      // so one gesture is always exactly one stop
      if (glide) return true;
      const y = window.scrollY;
      // the run of stops this point is in: the landing and the train, or the work's tower
      const stops = [scrollStops(), workStops()].find((g) => g.length > 1 && y >= g[0].y - TOL && y <= g[g.length - 1].y + TOL);
      if (!stops) { signals.rideTarget = null; return false; }
      const first = stops[0].y, last = stops[stops.length - 1].y;
      if (dir > 0 && y >= last - TOL) return false; // off the last stop: free again
      if (dir < 0 && y <= first + TOL) return false;
      if (!fresh) return true; // one gesture, one stop
      // just landed: what arrives now is the last gesture's momentum, however it looks
      if (performance.now() - landedAt < 1000) return true;
      const i = dir > 0 ? stops.findIndex((st) => st.y > y + TOL) : stops.findLastIndex((st) => st.y < y - TOL);
      if (i < 0) return false;
      go(stops, i, false); // (onComplete carries it on through any waypoint)
      return true;
    };
    const lenis = new Lenis({
      lerp: 0.085, smoothWheel: true, syncTouch: false,
      wheelMultiplier: 0.7, // where the scroll is free, it goes a little less far for each turn of the wheel
      // return false to take the gesture away from Lenis (and the browser: a swipe would scroll natively)
      virtualScroll: (d) => {
        const take = () => {
          if (d.event.cancelable) d.event.preventDefault();
          return false;
        };
        const now = performance.now(), abs = Math.abs(d.deltaY);
        /* new: after a pause, or the delta climbing clearly back up out of a momentum that was dying.
           A real trackpad swipe made during the last one's momentum starts small and climbs in gentle
           steps (1, 2, 3, 5, 8…), so the test is against the lowest point the momentum reached, not
           the last event; the climb at the start of a swipe from rest is the same gesture. */
        /* A gap alone isn't a new gesture: a busy frame (the hand-overs are heavy) can hold back a
           momentum's events for a few hundred ms, and they come back still falling. After a gap it takes
           the delta rising again (momentum only ever falls), a mouse wheel's notch, or a gap long enough
           that the last gesture is over. */
        const gap = now - lastEvent;
        const pause = gap > 900 || (gap > 220 && (abs > lastAbs || (abs >= 90 && abs >= lastAbs)));
        const dying = trough < peak * 0.6; // the last gesture had been falling away
        rising = abs > lastAbs ? rising + 1 : 0;
        const isNew = pause || (dying && rising >= 3 && abs >= trough * 2.2 + 6 && now - freshAt > 220);
        if (isNew) { peak = abs; trough = abs; freshAt = now; push = 0; pushed = false; }
        else { peak = Math.max(peak, abs); trough = abs > peak * 0.98 ? abs : Math.min(trough, abs); }
        lastEvent = now;
        lastAbs = abs;
        // the gesture counts once it has gone far enough, and only once
        push += abs;
        const fresh = !pushed && push >= INTENT;
        if (fresh) pushed = true;
        if (glide) { if (d.deltaY !== 0) ride(Math.sign(d.deltaY), fresh); return take(); }
        if (!useStore.getState().loaded || d.deltaY === 0) return true;
        if (ride(Math.sign(d.deltaY), fresh)) return take();
        signals.rideTarget = null;
        return true;
      },
    });
    const onKey = (e: KeyboardEvent) => {
      // → and ↓ ride forward to the next stop, ← and ↑ back to the last
      if (e.metaKey || e.ctrlKey || e.altKey || useStore.getState().menuOpen || useStore.getState().macOpen) return;
      const dir = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key) ? 1 : ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 0;
      if (dir && ride(dir, !e.repeat)) e.preventDefault();
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

  // the landing holds until the count reaches 100 (only the home page counts: a project page opened
  // directly never does, and must not be held)
  useEffect(() => {
    document.documentElement.classList.toggle("is-loading", home && !loaded);
  }, [loaded, home]);

  return null;
}
