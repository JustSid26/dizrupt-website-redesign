"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { SOLUTIONS } from "@/content/solutions";
import { useSection } from "@/components/home/useSection";

/* What Dizrupt does, six stations long. The mascot turns himself into a train and rides his own
   line round the city; at each station the solution's model turns over the platform (the engine
   reads signals.scroll.trainS), and the copy here changes channel with it. */
const N = SOLUTIONS.length;
const pad = (n: number) => String(n).padStart(2, "0");

export function Solutions() {
  const section = useRef<HTMLElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const bar = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const prev = useRef(0);
  const reduce = useStore((s) => s.reducedMotion);
  useSection(section, "solutions");

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        const p = self.progress;
        signals.scroll.solutions = p;
        /* His train leaves the plaza and stops at each of the six stations in turn: x counts the stops,
           and within each one it travels, then stands, so each solution is read while it is still. */
        const x = Math.min(1, Math.max(0, (p - 0.08) / 0.92)) * N;
        const i = Math.min(N - 1, Math.floor(x));
        const f = x - Math.floor(x);
        const k = Math.min(1, Math.max(0, (f - 0.35) / 0.55));
        signals.scroll.trainS = Math.min(N, Math.floor(x) + k * k * (3 - 2 * k));
        const at = Math.min(N - 1, Math.max(0, Math.round(signals.scroll.trainS) - 1));
        signals.scroll.solutionIndex = at;
        setActive(at);
        // the copy is only there while the train stands at a station; between them it goes
        const d = Math.abs(signals.scroll.trainS - Math.round(signals.scroll.trainS));
        const docked = signals.scroll.trainS > 0.6 && d < 0.3;
        section.current?.classList.toggle("sol-docked", docked);
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
    const d = reduce ? 0.01 : 1;
    if (from) {
      gsap.to(from.querySelectorAll("[data-line]"), { yPercent: -110 * dir, opacity: 0, duration: 0.45 * d, stagger: 0.04, ease: "power3.in", overwrite: true });
      from.classList.remove("is-on");
    }
    to.classList.add("is-on");
    gsap.fromTo(
      to.querySelectorAll("[data-line]"),
      { yPercent: 110 * dir, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.8 * d, delay: 0.25 * d, stagger: 0.06, ease: "expo.site", overwrite: true },
    );
    if (!reduce) {
      to.classList.add("glitching");
      setTimeout(() => to.classList.remove("glitching"), 160);
    }
  }, [active, reduce]);

  return (
    <section ref={section} id="solutions" aria-labelledby="solutions-title" style={{ height: `${N * 110 + 60}svh` }}>
      <div className="sol-pin">
        <div className="sol-copy">
          <h2 id="solutions-title" className="eyebrow">
            <span className="hud-no">02</span> Solutions
          </h2>
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
                <p className="sol-ch" data-line style={i ? { opacity: 0 } : undefined}>
                  CH {pad(i + 1)} <span>/ {pad(N)}</span>
                </p>
                <h3 className="sol-title" data-text={s.name}>
                  <span data-line style={i ? { opacity: 0 } : undefined}>{s.name}</span>
                </h3>
                <p className="sol-desc" data-line style={i ? { opacity: 0 } : undefined}>
                  {s.line}
                </p>
                <p className="sol-proof" data-line style={i ? { opacity: 0 } : undefined}>
                  <span>Proof</span> {s.work}
                </p>
              </div>
            ))}
          </div>
          <ol className="sol-dial" aria-label="Solutions">
            {SOLUTIONS.map((s, i) => (
              <li key={s.name} aria-current={i === active || undefined} style={{ "--a": s.colors[0] } as React.CSSProperties}>
                <span className="sol-dial-no">CH {pad(i + 1)}</span>
                <span className="sol-dial-bar">{i === active && <span ref={bar} />}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
