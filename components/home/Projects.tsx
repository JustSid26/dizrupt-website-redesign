"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { clients, slugOf } from "@/content/projects";
import { bannerFor } from "@/content/banners";
import { transitionTo } from "@/lib/viewTransition";
import { useSection } from "@/components/home/useSection";
import { WORK_LEAD, workP } from "@/lib/stops";

/* The work: a tower at the back of the city (lib/engine/workTower.ts), and the selected work is in
   its windows.

   The scroll is the camera (the engine flies it): from the whole tower into the first window until
   that project fills the screen, then back out to the facade and across into the next, up the
   building; scrolling back plays it all backwards.

   The projects themselves are laid over their windows here: each is a layer placed every frame on the
   rectangle the engine reports for its window and cut to it, so it is always in the building, never
   over it. The camera holds back from the glass, so the facade and the city stay round it; the
   project's name and the way into its story stand beside the window. */
const N = clients.length;
const pad = (n: number) => String(n).padStart(2, "0");
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, t: number) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

const LEAD = WORK_LEAD;
const pOf = workP;

export function Projects() {
  const section = useRef<HTMLElement>(null);
  const shots = useRef<(HTMLDivElement | null)[]>([]);
  const caps = useRef<(HTMLDivElement | null)[]>([]);
  const countRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const reduce = useStore((s) => s.reducedMotion);
  useSection(section, "projects");

  useEffect(() => {
    let p = -LEAD, enter = 0, exit = 0;
    const sts = [
      ScrollTrigger.create({
        trigger: section.current, start: "top top", end: "bottom bottom",
        onUpdate: (self) => {
          p = pOf(self.progress);
          signals.scroll.projects = self.progress;
          signals.scroll.projectIndex = Math.max(0, Math.min(N - 1, p));
        },
      }),
      ScrollTrigger.create({
        trigger: section.current, start: "top 60%", end: "top top",
        onUpdate: (self) => { enter = self.progress; signals.scroll.projectsIn = enter * (1 - exit); },
      }),
      ScrollTrigger.create({
        trigger: section.current, start: "bottom bottom", end: "bottom 40%",
        onUpdate: (self) => { exit = self.progress; signals.scroll.projectsIn = enter * (1 - exit); },
      }),
    ];

    // landing: the frame before the engine has placed the windows for this scroll (coming back from a
    // case): nothing is laid over the tower yet, its own glass shows the project until the next frame
    const apply = (landing = false) => {
      const vw = innerWidth, vh = innerHeight;
      const near = Math.round(Math.max(0, Math.min(N - 1, p)));
      if (countRef.current) {
        countRef.current.textContent = pad(near + 1);
        // how far through the tower: the counter's own progress line follows it
        countRef.current.parentElement?.style.setProperty("--wp", String(Math.max(0, Math.min(1, p / Math.max(1, N - 1)))));
      }
      const hidden: number[] = [];
      const gap = Math.max(20, vw * 0.025), edge = Math.max(16, vw * 0.03);
      for (let k = 0; k < N; k++) {
        const el = shots.current[k], cap = caps.current[k];
        if (!el || !cap) continue;
        const d = Math.abs(p - k);
        const r = signals.workWindows[k];
        // only while the camera is square on to its window: seen at an angle (going round a corner) the
        // tower's own glass shows it
        if (landing || d > 1.2 || !r.on || r.w < 1 || (r.face ?? 1) < 0.985) {
          el.style.visibility = "hidden";
          cap.style.visibility = "hidden";
          el.classList.remove("is-on");
          cap.classList.remove("is-on");
          continue;
        }
        el.style.visibility = "visible";
        hidden.push(k); // its own glass on the tower gives way to it
        // the picture covers the window and is cut to it
        const s = Math.max(r.w / vw, r.h / vh);
        const tx = r.x + r.w / 2 - (vw * s) / 2, ty = r.y + r.h / 2 - (vh * s) / 2;
        const L = Math.max(0, (r.x - tx) / s), T = Math.max(0, (r.y - ty) / s);
        const R = Math.max(0, vw - (r.x + r.w - tx) / s), B = Math.max(0, vh - (r.y + r.h - ty) / s);
        el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
        el.style.clipPath = `inset(${T}px ${R}px ${B}px ${L}px)`;
        // arrived: the picture settles and the glass clears; its name comes up beside it
        const settle = 1 - smooth(0.03, 0.22, d);
        el.style.setProperty("--m", settle.toFixed(4));
        el.style.setProperty("--g", (0.12 + 0.5 * (1 - settle)).toFixed(4));
        const on = settle > 0.9;
        el.classList.toggle("is-on", on);
        // beside the window if there's room, under it if not (a phone)
        const cw = cap.offsetWidth, ch = cap.offsetHeight;
        const side = r.x + r.w + gap + cw <= vw - edge;
        const cx = side ? r.x + r.w + gap : edge;
        const cy = side ? r.y + r.h / 2 - ch / 2 : Math.min(vh - ch - edge, r.y + r.h + gap);
        cap.style.visibility = settle > 0.01 ? "visible" : "hidden";
        cap.style.transform = `translate(${cx}px, ${cy + (1 - settle) * 24}px)`;
        cap.style.setProperty("--m", settle.toFixed(4));
        cap.classList.toggle("is-on", on);
      }
      signals.workHidden = hidden;
    };
    // drawn in the engine's frame, right after it has placed the windows, so the two never drift apart
    signals.onWorkFrame = () => apply();
    // coming back from a case, HomeEnter puts the scroll back and asks for the frame at once, so the
    // project the case grew from is on screen, full, before the transition takes its picture
    signals.workApply = () => { ScrollTrigger.update(); apply(true); };
    return () => { sts.forEach((s) => s.kill()); signals.onWorkFrame = null; signals.workApply = null; signals.workHidden = []; };
  }, [reduce]);

  // a project at full screen opens into its case: the picture becomes the case's banner
  const open = (k: number) => {
    const slug = slugOf(clients[k]);
    sessionStorage.setItem("home-scroll", String(scrollY));
    transitionTo(() => router.push(`/work/${slug}`, { scroll: false }), "open", {
      before: () => { shots.current[k]?.classList.add("is-leaving"); caps.current[k]?.classList.add("is-leaving"); },
      after: () => { shots.current[k]?.classList.remove("is-leaving"); caps.current[k]?.classList.remove("is-leaving"); },
    });
  };

  return (
    <section ref={section} id="work" aria-labelledby="work-title" style={{ height: `${(N + 0.4) * 110}svh` }}>
      <div className="work-pin tower-pin">
        {clients.map((c, k) => {
          const b = bannerFor(c.title);
          return (
            <div
              key={c.title}
              ref={(el) => { shots.current[k] = el; }}
              className="work-shot"
              style={{ "--pa": c.colors[0], "--pb": c.colors[1] } as React.CSSProperties}
              onClick={() => shots.current[k]?.classList.contains("is-on") && open(k)}
            >
              <div className="work-shot-media" style={{ backgroundImage: b ? `url(${b})` : undefined }} />
              <div className="work-shot-glass" aria-hidden />
            </div>
          );
        })}
        {clients.map((c, k) => (
          <div
            key={c.title}
            ref={(el) => { caps.current[k] = el; }}
            className="work-cap"
            style={{ "--pa": c.colors[0], "--pb": c.colors[1] } as React.CSSProperties}
          >
            <p className="work-shot-no">
              <span>Project {pad(k + 1)} / {pad(N)}</span>
              <span>{c.tags}</span>
            </p>
            <h3 className="work-cap-title">{c.title}</h3>
            <p className="work-shot-services">{c.client}</p>
            <button type="button" className="work-shot-open" onClick={() => open(k)} tabIndex={-1}>
              <span>View case study</span>
              <i aria-hidden>→</i>
            </button>
          </div>
        ))}

        <h2 id="work-title" className="eyebrow work-eyebrow">
          <span className="hud-no">03</span> Selected work
        </h2>
        <p className="work-count" aria-live="polite">
          <strong ref={countRef}>01</strong> / {pad(N)}
        </p>
        <p className="index-hint">Scroll to fly through the tower · Click a project for its story</p>
        <ul className="sr-only">
          {clients.map((c) => (
            <li key={c.title}>
              <a href={`/work/${slugOf(c)}`}>{c.title}, {c.client}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
