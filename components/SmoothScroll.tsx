"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { setLenis, setRideCanceller, setRideTo } from "@/lib/scroll";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { scrollRuns, workStops, type ScrollStop } from "@/lib/stops";
import { LINGER, lingering, onward, QUEUED, ride, T } from "@/lib/motion";

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
    /* From the DIZRUPT screen to the contact the scroll goes stop to stop: one gesture and you are
       carried to the next stop at the ride's own pace (lib/motion.ts), however hard or soft the
       gesture was. Everything the hand does while a ride plays is swallowed, the ride's own momentum
       (a trackpad's tail) and real gestures alike, so the animation between two stops always plays
       out whole, at its own pace, and never skips ahead: the next gesture counts once it has landed. */
    // auto: a ride the page started by itself (an onward stop), not a gesture
    let glide: { stops: ScrollStop[]; i: number; dir: number; auto?: boolean } | null = null;
    let queued = false; // (kept for the landing's bookkeeping; nothing queues a stop any more)
    let landedAt = 0; // when the last ride came to rest: its momentum is still arriving for a moment
    let seq = 0;
    let lastEvent = 0, lastAbs = 0, peak = 0, trough = 0, freshAt = 0, rising = 0;
    let push = 0, pushed = false; // how far the current gesture has gone, and whether it has moved a stop yet
    let sure = false; // the current gesture is unmistakably new (see gesture)
    let lastDir = 1; // which way the page last went: a stop it carries on from does so only forwards
    const DWELL = 2600; // ms a stop the page carries on from is held before it does (the tower, whole, under its sign)
    const TOL = 40;
    // a gesture has to mean it: a brush of the trackpad isn't a ride (a wheel's notch is past this at once)
    const INTENT = 60;
    // a ride's momentum, still arriving after it lands, for this long (a new gesture is told apart by
    // its rising delta before then: see isNew)
    const SETTLE = 400;
    const busy = () => Object.values(signals.busy).some(Boolean);
    /* the stop's own scene is still playing: it plays out whole first (with a ceiling, so a scene that
       never says it has finished can't hold the page for good), then the ride. Only the latest waits. */
    let waiting: (() => void) | null = null;
    let pending: { stops: ScrollStop[]; i: number; dir: number; auto?: boolean } | null = null; // the ride waiting on it
    // minMs: a dwell the page keeps at the stop whatever the scene is doing (the wide shot of the tower,
    // seen under its sign, before the page carries itself on into the first window)
    const afterScene = (fn: () => void, minMs = 0) => {
      if (waiting) gsap.ticker.remove(waiting);
      const t0 = performance.now(), token = seq;
      const wait = () => {
        if (token !== seq) return void (gsap.ticker.remove(wait), (waiting = null), (pending = null));
        const held = performance.now() - t0;
        if (held < minMs || (busy() && held < T.hold * 1000)) return;
        gsap.ticker.remove(wait);
        waiting = null;
        pending = null;
        fn();
      };
      waiting = wait;
      gsap.ticker.add(wait);
    };
    const go = (stops: ScrollStop[], i: number, how: { queued?: boolean; turning?: boolean; auto?: boolean } = {}) => {
      const y = window.scrollY, to = stops[i];
      const dir = to.y > y ? 1 : -1;
      const leg = dir > 0 ? to : stops[i + 1] ?? to; // the leg being ridden, whichever way
      const from = dir > 0 ? stops[i - 1] : stops[i + 1];
      // the whole leg takes its full time; from partway along it, that part of it
      const part = from ? Math.min(1, Math.abs(to.y - y) / Math.max(1, Math.abs(to.y - from.y))) : 1;
      const r = ride(leg.kind, dir as 1 | -1);
      // a leg that lingers over a stretch of its way (lib/stops.ts: slow): that stretch, in this ride's terms
      const prev = stops[stops.indexOf(leg) - 1];
      if (leg.slow && prev && to.y !== y) {
        const a = prev.y, b = prev.y + leg.slow * (leg.y - prev.y);
        const u = (v: number) => Math.min(1, Math.max(0, (v - y) / (to.y - y)));
        const [lo, hi] = [u(a), u(b)].sort((m, n) => m - n);
        if (hi - lo > 0.01) r.ease = lingering(r.ease, lo, hi, LINGER);
      }
      const duration = Math.max(T.micro * 4, r.duration * part * (how.queued ? QUEUED : 1));
      // the train drives itself there now, rather than when the page catches up
      signals.rideTarget = to.train;
      signals.rideEnd = performance.now() + duration * 1000;
      glide = { stops, i, dir, auto: how.auto };
      lastDir = dir;
      const token = ++seq;
      lenis.scrollTo(to.y, {
        duration,
        // turned round mid-ride it is already moving: carry on, then settle
        easing: how.turning ? onward : r.ease,
        lock: true,
        force: true,
        onComplete: () => {
          if (token !== seq) return;
          landedAt = performance.now();
          glide = null;
          signals.rideEnd = 0;
          if (!queued) {
            // a stop the page doesn't rest at (lib/stops.ts: onward): once its scene is done, on it goes
            if (dir > 0 && to.onward && stops[i + 1]) {
              pending = { stops, i: i + 1, dir: 1, auto: true };
              afterScene(() => go(stops, i + 1, { auto: true }), typeof to.onward === "number" ? to.onward : DWELL);
            }
            return;
          }
          queued = false;
          // the queued stop: as soon as this stop's own scene has finished, the next ride, a little quicker
          if (stops[i + dir]) afterScene(() => go(stops, i + dir, { queued: true }));
        },
      });
    };
    /* true: the gesture is the ride's (started one, queued one, turned one round, or swallowed);
       false: scroll freely. fresh: a new gesture, not the tail of the last one. A trackpad's momentum
       keeps sending events for a second or more after the swipe, so a pause alone can't tell them apart. */
    // sure: unmistakably a new gesture (a key, a wheel's notch, a swipe after a pause), not momentum
    const gesture = (dir: number, fresh: boolean, sure = false) => {
      /* A ride under way plays out whole, whatever the hand does: every gesture during it is
         swallowed, never queued (so it can't skip a stop) and never turned round (so it can't be cut
         short or hurried). The same while a ride waits on a stop's scene, with one exception: at a
         stop the page is about to leave by itself (an onward stop's dwell), a gesture its way takes
         that ride now rather than waiting out the dwell. */
      if (pending && !glide) {
        if (fresh && pending.auto && dir === pending.dir) {
          const p = pending;
          seq++; // (the wait lets go: see afterScene)
          pending = null;
          queued = false;
          go(p.stops, p.i);
        }
        return true;
      }
      if (glide) return true;
      const y = window.scrollY;
      lastDir = dir;
      // the run of stops this point is in: from the landing to AI & Automation, or the work's tower
      // (two runs share a stop, the AI statement: take the one there's somewhere to go in, this way)
      const stops = [...scrollRuns(), workStops()].find(
        (g) => g.length > 1 && y >= g[0].y - TOL && y <= g[g.length - 1].y + TOL && (dir > 0 ? y < g[g.length - 1].y - TOL : y > g[0].y + TOL),
      );
      if (!stops) { signals.rideTarget = null; return false; } // off the end of a run: free again
      if (!fresh) return true; // one gesture, one stop
      // just landed: what arrives now is the last gesture's momentum, unless it can't be
      if (!sure && performance.now() - landedAt < SETTLE) return true;
      const i = dir > 0 ? stops.findIndex((st) => st.y > y + TOL) : stops.findLastIndex((st) => st.y < y - TOL);
      if (i < 0) return false;
      // the stop's own scene still playing: the gesture isn't lost, the ride waits for it to finish
      if (busy()) {
        pending = { stops, i, dir };
        afterScene(() => go(stops, i));
      } else go(stops, i);
      return true;
    };
    const lenis = new Lenis({
      // where the scroll is free (a case page, past the contact) it moves as the rides do: a wheel's
      // deltas as they come, eased a little
      lerp: 0.1, smoothWheel: true, syncTouch: false, wheelMultiplier: 1,
      // return false to take the gesture away from Lenis (and the browser: a swipe would scroll natively)
      virtualScroll: (d) => {
        const take = () => {
          if (d.event.cancelable) d.event.preventDefault();
          return false;
        };
        // a finger going across, not down (the phone's cards, swiped): theirs, untouched
        if (d.event.type.startsWith("touch") && Math.abs(d.deltaX) > Math.abs(d.deltaY)) return true;
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
        const notch = gap > 220 && abs >= 90 && abs >= lastAbs;
        const pause = gap > 900 || notch || (gap > 220 && abs > lastAbs);
        const dying = trough < peak * 0.6; // the last gesture had been falling away
        rising = abs > lastAbs ? rising + 1 : 0;
        const climbing = dying && rising >= 3 && abs >= trough * 2.2 + 6 && now - freshAt > 220;
        const isNew = pause || climbing;
        // sure: unmistakably a new gesture, not momentum, even straight after a landing
        if (isNew) { peak = abs; trough = abs; freshAt = now; push = 0; pushed = false; sure = notch || gap > 900 || climbing; }
        else { peak = Math.max(peak, abs); trough = abs > peak * 0.98 ? abs : Math.min(trough, abs); }
        lastEvent = now;
        lastAbs = abs;
        // the gesture counts once it has gone far enough, and only once
        push += abs;
        const fresh = !pushed && push >= INTENT;
        if (fresh) pushed = true;
        if (glide) { if (d.deltaY !== 0) gesture(Math.sign(d.deltaY), fresh, fresh && sure); return take(); }
        if (!useStore.getState().loaded || d.deltaY === 0) return true;
        if (gesture(Math.sign(d.deltaY), fresh, fresh && sure)) return take();
        signals.rideTarget = null;
        return true;
      },
    });
    const onKey = (e: KeyboardEvent) => {
      // → and ↓ ride forward to the next stop, ← and ↑ back to the last
      if (e.metaKey || e.ctrlKey || e.altKey || useStore.getState().menuOpen || useStore.getState().macOpen) return;
      // a focused control keeps its own keys: Space presses a button, arrows move a slider or a caret
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("input, textarea, select, [contenteditable]") || (e.key === " " && t?.closest("button, a, [role=button]"))) return;
      const dir = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key) ? 1 : ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 0;
      // (a key held down repeats: one stop per press, never faster than the ride)
      if (dir && gesture(dir, !e.repeat, !e.repeat)) e.preventDefault();
    };
    addEventListener("keydown", onKey);
    setLenis(lenis);
    // sent to a stop by the page (a step picked): ridden there like a gesture, at that ride's pace
    setRideTo((y) => {
      const stops = [...scrollRuns(), workStops()].find((g) => g.some((st) => Math.abs(st.y - y) < TOL));
      const i = stops?.findIndex((st) => Math.abs(st.y - y) < TOL) ?? -1;
      if (!stops || i < 0) return false;
      queued = false;
      go(stops, i);
      return true;
    });
    // sent somewhere else mid-ride (the nav, a button): the ride is over, the train follows the scroll
    setRideCanceller(() => {
      seq++; // (and with it, any ride waiting on a scene)
      glide = null;
      queued = false;
      landedAt = 0;
      lastDir = 1; // sent somewhere counts as going on
      signals.rideEnd = 0;
      signals.rideTarget = null;
    });
    lenis.on("scroll", (l: Lenis) => {
      signals.scroll.velocity = l.velocity;
      ScrollTrigger.update();
    });
    /* come to rest on a stop the page doesn't rest at, without riding there (the rail sent it, or it was
       scrolled to freely): a moment's pause, then on it goes, the way a ride landing there would */
    let restAt = 0, restChecked = false;
    const idle = () => {
      const now = performance.now();
      if (glide || pending || waiting || now < signals.navJumpUntil || Math.abs(lenis.velocity) > 0.1 || !useStore.getState().loaded) {
        restAt = now;
        restChecked = false;
        return;
      }
      if (restChecked || now - restAt < 350 || lastDir < 0) return;
      restChecked = true;
      const y = window.scrollY;
      for (const run of [...scrollRuns(), workStops()]) {
        const i = run.findIndex((st) => st.onward && Math.abs(st.y - y) < TOL);
        if (i < 0 || !run[i + 1]) continue;
        pending = { stops: run, i: i + 1, dir: 1, auto: true };
        afterScene(() => go(run, i + 1, { auto: true }), typeof run[i].onward === "number" ? run[i].onward : DWELL);
        return;
      }
    };
    gsap.ticker.add(idle);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.remove(idle);
      removeEventListener("keydown", onKey);
      setRideCanceller(null);
      setRideTo(null);
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
