"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

/* 404: the page lost the signal. The number and the words are each a stack of copies — the
   picture, a red and a blue channel, and a set of horizontal bands — and every so often the signal
   drops: the bands tear sideways on their own, the channels come apart, the picture flickers and
   the words scramble. Nothing is a keyframe; every step of every burst is rolled fresh, so no two
   look alike. The last 4 is Dizrupt purple. */
const BANDS = 7;
const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#%&$@!?";

function Glitch({ text, accentLast, className, scramble }: { text: string; accentLast?: boolean; className: string; scramble?: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);
  const reduce = useStore((s) => s.reducedMotion);

  useEffect(() => {
    const el = root.current;
    if (!el || reduce) return;
    const bands = [...el.querySelectorAll<HTMLElement>(".g-band")];
    const r = el.querySelector<HTMLElement>(".g-r")!, b = el.querySelector<HTMLElement>(".g-b")!;
    const base = el.querySelector<HTMLElement>(".g-base")!;
    const rnd = (a: number, z: number) => a + Math.random() * (z - a);
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;

    const calm = () => {
      bands.forEach((s) => (s.style.opacity = "0"));
      r.style.transform = b.style.transform = "";
      r.style.opacity = b.style.opacity = "0";
      base.style.transform = base.style.opacity = base.style.clipPath = "";
      el.style.transform = "";
      setShown(text);
    };
    // one step of a burst: everything rolled again
    const step = (heavy: number) => {
      const w = el.offsetWidth;
      let y = 0;
      bands.forEach((s, i) => {
        const h = i === bands.length - 1 ? 100 - y : rnd(4, 26);
        const on = Math.random() < 0.35 + heavy * 0.5;
        s.style.clipPath = `inset(${y}% 0 ${Math.max(0, 100 - y - h)}% 0)`;
        s.style.transform = on ? `translateX(${rnd(-1, 1) * w * (0.03 + heavy * 0.14)}px)` : "";
        s.style.opacity = on ? "1" : "0";
        s.style.filter = on && Math.random() < 0.25 ? "brightness(1.8)" : "";
        y = Math.min(100, y + h);
      });
      const split = w * (0.008 + heavy * 0.035);
      r.style.opacity = b.style.opacity = "0.9";
      r.style.transform = `translate(${rnd(0.3, 1) * split}px, ${rnd(-1, 1) * split * 0.25}px)`;
      b.style.transform = `translate(${-rnd(0.3, 1) * split}px, ${rnd(-1, 1) * split * 0.25}px)`;
      r.style.clipPath = Math.random() < 0.5 ? `inset(${rnd(0, 50)}% 0 ${rnd(0, 50)}% 0)` : "none";
      b.style.clipPath = Math.random() < 0.5 ? `inset(${rnd(0, 50)}% 0 ${rnd(0, 50)}% 0)` : "none";
      // the picture itself: cut into, dropped out, shoved
      base.style.opacity = Math.random() < heavy * 0.35 ? "0" : Math.random() < 0.3 ? "0.55" : "1";
      base.style.clipPath = Math.random() < 0.4 ? `inset(${rnd(0, 40)}% 0 ${rnd(0, 40)}% 0)` : "";
      el.style.transform = Math.random() < heavy * 0.6 ? `translate(${rnd(-1, 1) * w * 0.02}px, ${rnd(-1, 1) * 6}px) skewX(${rnd(-1, 1) * 10 * heavy}deg)` : "";
      if (scramble)
        setShown([...text].map((c) => (c !== " " && Math.random() < 0.2 + heavy * 0.4 ? NOISE[(Math.random() * NOISE.length) | 0] : c)).join(""));
    };
    const burst = () => {
      if (!alive) return;
      const heavy = Math.random() < 0.4 ? rnd(0.7, 1) : rnd(0.2, 0.55);
      const steps = Math.round(rnd(4, 9) + heavy * 6);
      let n = 0;
      const tick = () => {
        if (!alive) return;
        if (n++ >= steps) {
          calm();
          timer = setTimeout(burst, rnd(900, 3200));
          return;
        }
        step(heavy);
        timer = setTimeout(tick, rnd(35, 85));
      };
      tick();
    };
    timer = setTimeout(burst, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
      calm();
    };
  }, [text, scramble, reduce]);

  const chars = (s: string) =>
    [...s].map((c, i) => (
      <span key={i} className={accentLast && i === s.length - 1 ? "g-accent" : undefined}>
        {c}
      </span>
    ));
  return (
    <span ref={root} className={`glitch ${className}`} aria-hidden>
      <span className="g-base" aria-hidden>
        {chars(shown)}
      </span>
      <span className="g-r" aria-hidden>
        {shown}
      </span>
      <span className="g-b" aria-hidden>
        {shown}
      </span>
      {Array.from({ length: BANDS }, (_, i) => (
        <span key={i} className="g-band" aria-hidden>
          {chars(shown)}
        </span>
      ))}
    </span>
  );
}

export function NotFound() {
  const path = usePathname();
  return (
    <section className="nf" aria-labelledby="nf-title">
      <div className="nf-scan" aria-hidden />
      <p className="nf-readout">
        <span className="hud-no">GET</span>
        {path}
        <span className="nf-status">→ 404 Not Found</span>
      </p>
      <h1 id="nf-title" className="nf-title">
        <span className="sr-only">404, not found</span>
        <Glitch text="404" accentLast className="nf-code" />
        <Glitch text="NOT FOUND" className="nf-words" scramble />
      </h1>
      <p className="nf-copy">This page lost the signal. Whatever was here has moved, or never was.</p>
      <Link href="/" className="nf-home">
        <span>Back to Dizrupt</span>
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
