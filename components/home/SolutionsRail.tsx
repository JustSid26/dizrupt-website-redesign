"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { EASE, T } from "@/lib/motion";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { SOLUTIONS, solutionSlug } from "@/content/solutions";
import { transitionTo } from "@/lib/viewTransition";
import { useSection } from "@/components/home/useSection";

/* What Dizrupt does, on a phone: the wide screen's train ride (SolutionsTrain.tsx) drawn flat and side
   on. His train pulls in from the left and stands with its first carriage in the middle of the screen,
   the solution's film in its window and the words under it; each gesture moves it on one carriage
   (lib/stops.ts: one stop a carriage), and after the last it rides off to the right as the page goes on.
   The section is N + 1 screens tall: one for the train to pull in over, one for each carriage. */
const N = SOLUTIONS.length;
export const RAIL_SCREENS = N + 1;

export function SolutionsRail() {
  const section = useRef<HTMLElement>(null);
  const train = useRef<HTMLDivElement>(null);
  const cars = useRef<(HTMLDivElement | null)[]>([]);
  const engine = useRef<HTMLDivElement>(null);
  const films = useRef<(HTMLVideoElement | null)[]>([]);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const prev = useRef(0);
  const [seen, setSeen] = useState(false); // on screen: the film in the window may play
  const reduce = useStore((s) => s.reducedMotion);
  const router = useRouter();
  useSection(section, "solutions");

  useEffect(() => {
    // no train for the engine to drive on a phone: this one is the page's
    signals.scroll.trainS = 0;
    signals.rideTarget = null;
    const sec = section.current;
    if (!sec) return;
    let moving = false;
    const place = () => {
      const tr = train.current, first = cars.current[N - 1], second = cars.current[N - 2], eng = engine.current;
      if (!tr || !first || !eng) return;
      /* u counts the carriages: 0 the train still off to the left, 1 the first carriage in the middle of
         the screen … N the last, and past N it has ridden off. One screen of scroll per step, measured
         from the section itself so a phone's toolbar coming and going can't put the stops off the carriages */
      const pitch = sec.offsetHeight / RAIL_SCREENS;
      const top = sec.getBoundingClientRect().top + scrollY;
      const u = Math.max(0, (scrollY - top) / pitch + 1);
      // carriages run back from the engine, so the first is the last in the row: its middle, from the row's left edge
      const W = second ? first.offsetLeft - second.offsetLeft : first.offsetWidth;
      const mid = first.offsetLeft + first.offsetWidth / 2;
      const at1 = innerWidth / 2 - mid; // the first carriage in the middle
      const off = -(eng.offsetLeft + eng.offsetWidth) - 40; // the whole train off the left edge
      const x = u <= 1 ? off + (at1 - off) * u : at1 + (u - 1) * W; // (on to the right: the next carriage back comes to the middle)
      tr.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      const k = Math.min(N - 1, Math.max(0, Math.round(u) - 1));
      signals.scroll.solutionIndex = k;
      signals.scroll.solutions = Math.min(1, Math.max(0, (u - 1) / (N - 1)));
      setActive((c) => (c === k ? c : k));
      // under way: it leans into the run (the CSS)
      const m = u > 0.05 && Math.abs(u - Math.round(u)) > 0.03;
      if (m !== moving) { moving = m; tr.classList.toggle("is-moving", m); }
    };
    const st = ScrollTrigger.create({
      trigger: sec,
      start: "top bottom",
      end: "bottom top",
      onUpdate: place,
      onRefresh: place,
      onToggle: (self) => setSeen(self.isActive),
    });
    place();
    return () => st.kill();
  }, []);

  // the film in the window plays; the rest wait, unloaded
  useEffect(() => {
    films.current.forEach((v, i) => {
      if (!v) return;
      if (seen && i === active && !reduce) void v.play().catch(() => {});
      else v.pause();
    });
  }, [active, seen, reduce]);

  // change channel: the old copy tears out upward, the new one comes in from below (as on a wide screen)
  useEffect(() => {
    const from = items.current[prev.current];
    const to = items.current[active];
    const dir = active > prev.current ? 1 : -1;
    prev.current = active;
    if (!to || from === to) return;
    const d = reduce ? T.reduced / T.swapIn : 1;
    if (from) {
      gsap.to(from.querySelectorAll("[data-line]"), { yPercent: -110 * dir, opacity: 0, duration: T.swapOut * d, stagger: T.stagger, ease: EASE.out, overwrite: true });
      from.classList.remove("is-on");
    }
    to.classList.add("is-on");
    gsap.fromTo(
      to.querySelectorAll("[data-line]"),
      { yPercent: 110 * dir, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: T.swapIn * d, delay: (T.swapOut - T.swapOverlap) * d, stagger: T.stagger, ease: EASE.in, overwrite: true },
    );
    if (!reduce) {
      to.classList.add("glitching");
      setTimeout(() => to.classList.remove("glitching"), T.micro * 1000);
    }
  }, [active, reduce]);

  const s = SOLUTIONS[active];
  return (
    <section ref={section} id="solutions" className="solc" aria-labelledby="solutions-title" style={{ height: `${RAIL_SCREENS * 100}svh` }}>
      <div className="solc-pin" style={{ "--a": s.colors[0], "--b": s.colors[1] } as React.CSSProperties}>
        <header className="solc-head">
          <h2 id="solutions-title" className="eyebrow">Solutions</h2>
        </header>
        {/* his line across the screen, and his train on it: the engine leading, a carriage a solution behind it */}
        <div className="solc-scene" aria-hidden>
          <div className="solc-ground" />
          <div ref={train} className="solc-train">
            {[...SOLUTIONS].reverse().map((sol, r) => {
              const i = N - 1 - r;
              return (
                <div
                  key={sol.name}
                  ref={(el) => {
                    cars.current[r] = el;
                  }}
                  className={`solc-car${i === active ? " is-at" : ""}`}
                  style={{ "--a": sol.colors[0], "--b": sol.colors[1] } as React.CSSProperties}
                >
                  <div className="solc-body">
                    <div className="solc-window">
                      {sol.film ? (
                        <video
                          ref={(el) => {
                            films.current[i] = el;
                          }}
                          src={sol.film}
                          poster={sol.image}
                          muted
                          loop
                          playsInline
                          preload="none"
                          style={{ objectPosition: `50% ${(1 - (sol.filmY ?? 0.5)) * 100}%` }}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sol.image} alt="" />
                      )}
                    </div>
                    <p className="solc-plate">{sol.name}</p>
                  </div>
                  <span className="solc-bogie" />
                  <span className="solc-bogie" />
                </div>
              );
            })}
            <div ref={engine} className="solc-engine">
              <div className="solc-body">
                <span className="solc-cab" />
                <span className="solc-lamp" />
              </div>
              <span className="solc-bogie" />
              <span className="solc-bogie" />
            </div>
          </div>
        </div>
        <div className="solc-copy">
          <div className="sol-stack">
            {SOLUTIONS.map((sol, i) => (
              <div
                key={sol.name}
                ref={(el) => {
                  items.current[i] = el;
                }}
                className={`sol-item${i === 0 ? " is-on" : ""}`}
                style={{ "--a": sol.colors[0], "--b": sol.colors[1] } as React.CSSProperties}
                aria-hidden={i !== active}
              >
                <h3 className="sol-title" data-text={sol.name}>
                  <span data-line style={i ? { opacity: 0 } : undefined}>{sol.name}</span>
                </h3>
                <p className="sol-desc" data-line style={i ? { opacity: 0 } : undefined}>
                  {sol.line}
                </p>
                {sol.work && (
                  <p className="sol-proof" data-line style={i ? { opacity: 0 } : undefined}>
                    <span>Proof</span> {sol.work}
                  </p>
                )}
              </div>
            ))}
          </div>
          <Link
            href={`/solutions/${solutionSlug(s)}`}
            className="solc-cta"
            onClick={(e) => {
              // the page crossfades into the solution's own (lib/viewTransition.ts), and comes back to this carriage
              e.preventDefault();
              sessionStorage.setItem("home-scroll", String(scrollY));
              transitionTo(() => router.push(`/solutions/${solutionSlug(s)}`), "open");
            }}
          >
            <span>View the work</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
