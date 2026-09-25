"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { clients } from "@/content/projects";
import { useSection } from "@/components/home/useSection";

/* The work. The section holds the screen while the spiral of client cards turns under your scroll;
   the front card is built out of the particles that were the last solution, and each card after it
   is rebuilt from the one before (lib/engine/windowField.ts). The cards and their click targets
   are drawn by the engine; this is the scroll that drives them and the frame around them. */
const N = clients.length;
const pad = (n: number) => String(n).padStart(2, "0");
const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export function Projects() {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  useSection(section, "projects");

  useEffect(() => {
    let enter = 0;
    let exit = 0;
    const sts = [
      ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const x = self.progress * (N - 1);
          const i = Math.min(N - 2, Math.floor(x));
          // dwell on each card, then glide to the next
          const idx = i + smooth(0.25, 0.75, x - i);
          signals.scroll.projects = self.progress;
          signals.scroll.projectIndex = idx;
          setActive(Math.round(idx));
        },
      }),
      ScrollTrigger.create({
        trigger: section.current,
        start: "top 40%",
        end: "top top",
        onUpdate: (self) => {
          enter = self.progress;
          signals.scroll.projectsIn = enter * (1 - exit);
        },
      }),
      ScrollTrigger.create({
        trigger: section.current,
        start: "bottom bottom",
        end: "bottom 30%",
        onUpdate: (self) => {
          exit = self.progress;
          signals.scroll.projectsIn = enter * (1 - exit);
        },
      }),
    ];
    return () => sts.forEach((s) => s.kill());
  }, []);

  return (
    <section ref={section} id="work" aria-labelledby="work-title" style={{ height: `${N * 70 + 30}svh` }}>
      <div className="work-pin">
        <h2 id="work-title" className="eyebrow work-eyebrow">
          <span className="hud-no">03</span> Selected work
        </h2>
        <p className="work-count" aria-live="polite">
          <strong>{pad(active + 1)}</strong> / {pad(N)}
        </p>
        <p className="index-hint">Scroll to turn the spiral · Click a project for its story</p>
        <ul className="sr-only">
          {clients.map((p) => (
            <li key={p.title}>
              {p.title}, {p.client}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
