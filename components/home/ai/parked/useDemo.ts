"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

/* A service's demonstration: one timeline, built once, that plays from the start each time its
   service comes up and stops when it goes. Under reduced motion it isn't played: it is shown done.
   `run()` plays it again (the demo's own button). `step` is which of its stages is showing, from
   labels named "0".."n" on the timeline. */
export function useDemo(active: boolean, reduce: boolean, build: (tl: gsap.core.Timeline, q: (s: string) => Element[]) => void) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const [step, setStep] = useState(-1);
  const buildRef = useRef(build);

  useEffect(() => {
    const el = root.current!;
    const ctx = gsap.context(() => {
      const t = gsap.timeline({ paused: true });
      buildRef.current(t, gsap.utils.selector(el));
      const labels = Object.entries(t.labels).sort((a, b) => a[1] - b[1]);
      t.eventCallback("onUpdate", () => {
        let s = -1;
        for (const [name, at] of labels) if (t.time() >= at - 0.001) s = Number(name);
        setStep((prev) => (prev === s ? prev : s));
      });
      tl.current = t;
    }, el);
    return () => {
      ctx.revert();
      tl.current = null;
    };
  }, []);

  useEffect(() => {
    const t = tl.current;
    if (!t) return;
    if (reduce) {
      t.progress(1).pause();
      return;
    }
    if (active) t.restart();
    else t.pause();
  }, [active, reduce]);

  const run = () => {
    if (!tl.current) return;
    if (reduce) tl.current.progress(1).pause();
    else tl.current.restart();
  };
  return { root, step, run };
}
