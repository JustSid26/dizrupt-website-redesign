"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { EASE, T } from "@/lib/motion";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { SOLUTIONS, solutionSlug } from "@/content/solutions";
import { useRouter } from "next/navigation";
import { useSection } from "@/components/home/useSection";

/* What Dizrupt does, six stations long (a wide screen; a phone has SolutionCards.tsx). The mascot
   turns himself into a train and rides his own line round the city; at each station the solution's
   model turns over the platform (the engine reads signals.scroll.trainS), and the copy here changes
   channel with it. */
const N = SOLUTIONS.length;

export function SolutionsTrain() {
  const section = useRef<HTMLElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const bar = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const prev = useRef(0);
  const reduce = useStore((s) => s.reducedMotion);
  const hit = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // a click target riding on the billboard the train stands at
  useEffect(() => {
    const tick = () => {
      // the copy follows where the train really is: its stop's words while it stands there, none between
      const r = signals.rideS;
      const at = Math.min(N - 1, Math.max(0, Math.round(r) - 1));
      signals.scroll.solutionIndex = at;
      setActive((c) => (c === at ? c : at));
      section.current?.classList.toggle("sol-docked", r > 0.6 && Math.abs(r - Math.round(r)) < 0.12);
      const el = hit.current;
      const b = signals.billboardHit;
      if (!el) return;
      // not while the AI world has the screen
      const on = b.on && signals.ai.mix < 0.02;
      el.style.visibility = on ? "visible" : "hidden";
      if (!on) return;
      el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0)`;
      el.style.width = `${b.w.toFixed(1)}px`;
      el.style.height = `${b.h.toFixed(1)}px`;
      el.dataset.index = String(b.index);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  useSection(section, "solutions");

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: section.current,
      // the ride starts the moment the landing lets go, not a screen later when this pins
      start: "top bottom",
      end: "bottom bottom",
      onUpdate: (self) => {
        const p = self.progress;
        signals.scroll.solutions = p;
        /* His train leaves the plaza and stops at each of the six stations in turn: x counts the stops,
           and within each one it travels, then stands, so each solution is read while it is still. */
        const x = Math.min(1, Math.max(0, (p - 0.01) / 0.99)) * N;
        const i = Math.min(N - 1, Math.floor(x));
        // straight with the scroll: no standing at a station
        signals.scroll.trainS = Math.min(N, x);


        if (bar.current) bar.current.style.transform = `scaleX(${(p >= 1 ? 1 : x - i).toFixed(3)})`;
      },
    });
    return () => st.kill();
  }, []);

  // change channel: the old copy tears out upward, the new one comes in from below
  useEffect(() => {
    const from = items.current[prev.current];
    const to = items.current[active];
    const dir = active > prev.current ? 1 : -1;
    prev.current = active;
    if (!to || from === to) return;
    const d = reduce ? T.reduced / T.swapIn : 1; // reduced motion: a quick crossfade
    if (from) {
      gsap.to(from.querySelectorAll("[data-line]"), { yPercent: -110 * dir, opacity: 0, duration: T.swapOut * d, stagger: T.stagger, ease: EASE.out, overwrite: true });
      from.classList.remove("is-on");
    }
    to.classList.add("is-on");
    gsap.fromTo(
      to.querySelectorAll("[data-line]"),
      { yPercent: 110 * dir, opacity: 0 },
      // in as the old goes, overlapping it a little
      { yPercent: 0, opacity: 1, duration: T.swapIn * d, delay: (T.swapOut - T.swapOverlap) * d, stagger: T.stagger, ease: EASE.in, overwrite: true },
    );
    if (!reduce) {
      to.classList.add("glitching");
      setTimeout(() => to.classList.remove("glitching"), T.micro * 1000);
    }
  }, [active, reduce]);

  return (
    <section ref={section} id="solutions" aria-labelledby="solutions-title" style={{ height: `${N * 110 + 60}svh` }}>
      <div className="sol-pin">
        <button
          ref={hit}
          type="button"
          className="billboard-hit"
          aria-label={`See the ${SOLUTIONS[active].name} work`}
          onClick={() => {
            const k = Number(hit.current?.dataset.index ?? active);
            sessionStorage.setItem("home-scroll", String(scrollY));
            router.push(`/solutions/${solutionSlug(SOLUTIONS[k] ?? SOLUTIONS[active])}`);
          }}
        >
          <span>View the work</span>
        </button>
        <div className="sol-copy">
          <h2 id="solutions-title" className="eyebrow">Solutions</h2>
          <div className="sol-stack">
            {SOLUTIONS.map((s, i) => (
              <div
                key={s.name}
                ref={(el) => {
                  items.current[i] = el;
                }}
                className={`sol-item${i === 0 ? " is-on" : ""}`}
                style={{ "--a": s.colors[0], "--b": s.colors[1] } as React.CSSProperties}
                aria-hidden={i !== active}
              >
                <h3 className="sol-title" data-text={s.name}>
                  <span data-line style={i ? { opacity: 0 } : undefined}>{s.name}</span>
                </h3>
                <p className="sol-desc" data-line style={i ? { opacity: 0 } : undefined}>
                  {s.line}
                </p>
{s.work && (<p className="sol-proof" data-line style={i ? { opacity: 0 } : undefined}>
                  <span>Proof</span> {s.work}
                </p>)}
              </div>
            ))}
          </div>
          <ol className="sol-dial" aria-label="Solutions">
            {SOLUTIONS.map((s, i) => (
              <li key={s.name} aria-current={i === active || undefined} style={{ "--a": s.colors[0] } as React.CSSProperties}>
                <span className="sol-dial-bar">{i === active && <span ref={bar} />}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
