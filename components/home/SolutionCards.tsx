"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { T } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { SOLUTIONS, solutionSlug } from "@/content/solutions";
import { useSection } from "@/components/home/useSection";

/* What Dizrupt does, on a phone: the six solutions as cards side by side, swiped across, while the
   page scrolls straight past them (the train ride between billboards is a wide screen's,
   SolutionsTrain.tsx). A card's film plays only while it is the one in view, and loads only then. */
const N = SOLUTIONS.length;
const pad = (n: number) => String(n).padStart(2, "0");

export function SolutionCards() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  const films = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(false); // on screen: its film may play
  const reduce = useStore((s) => s.reducedMotion);
  useSection(section, "solutions");

  useEffect(() => {
    // no train on a phone: nothing for the engine to drive
    signals.scroll.trainS = 0;
    signals.rideTarget = null;
    const st = ScrollTrigger.create({ trigger: section.current, start: "top bottom", end: "bottom top", onToggle: (self) => setSeen(self.isActive) });
    return () => st.kill();
  }, []);

  // one card from the next: where card i sits in the track's scroll
  const step = () => {
    const [a, b] = cards.current;
    return a && b ? b.offsetLeft - a.offsetLeft : track.current?.clientWidth ?? 1;
  };
  const onScroll = () => {
    const t = track.current;
    if (t) setActive(Math.min(N - 1, Math.max(0, Math.round(t.scrollLeft / step()))));
  };
  const goTo = (i: number) => {
    const k = Math.min(N - 1, Math.max(0, i));
    track.current?.scrollTo({ left: k * step(), behavior: reduce ? "auto" : "smooth" });
  };

  // the film in view plays; the rest wait, unloaded
  useEffect(() => {
    films.current.forEach((v, i) => {
      if (!v) return;
      if (seen && i === active && !reduce) void v.play().catch(() => {});
      else v.pause();
    });
  }, [active, seen, reduce]);

  // change channel: the title loses the signal for a moment as its card comes in
  useEffect(() => {
    const el = cards.current[active];
    if (!el || reduce) return;
    el.classList.add("glitching");
    const id = setTimeout(() => el.classList.remove("glitching"), T.micro * 1000);
    return () => clearTimeout(id);
  }, [active, reduce]);

  return (
    <section ref={section} id="solutions" className="solc" aria-labelledby="solutions-title">
      <header className="solc-head">
        <h2 id="solutions-title" className="eyebrow">Solutions</h2>
        <p className="solc-count" aria-live="polite">
          CH <strong>{pad(active + 1)}</strong> / {pad(N)}
        </p>
      </header>
      <ul
        ref={track}
        className="solc-track"
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Solutions, swipe across"
        data-lenis-prevent
        onKeyDown={(e) => {
          // ← → move between the cards here, rather than riding the page on
          const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          e.stopPropagation();
          goTo(active + d);
        }}
      >
        {SOLUTIONS.map((s, i) => (
          <li
            key={s.name}
            ref={(el) => {
              cards.current[i] = el;
            }}
            className="solc-card"
            aria-label={`${i + 1} of ${N}: ${s.name}`}
            style={{ "--a": s.colors[0], "--b": s.colors[1] } as React.CSSProperties}
          >
            <div className="solc-media">
              {s.film ? (
                <video
                  ref={(el) => {
                    films.current[i] = el;
                  }}
                  src={s.film}
                  poster={s.image}
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-hidden
                  style={{ objectPosition: `50% ${(1 - (s.filmY ?? 0.5)) * 100}%` }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" />
              )}
            </div>
            <div className="solc-body">
              <h3 className="sol-title">
                <span>{s.name}</span>
              </h3>
              <p className="sol-desc">{s.line}</p>
              <p className="sol-proof">
                <span>Proof</span> {s.work}
              </p>
              <Link
                href={`/solutions/${solutionSlug(s)}`}
                className="solc-cta"
                tabIndex={i === active ? 0 : -1}
                onClick={() => sessionStorage.setItem("home-scroll", String(scrollY))}
              >
                <span>View the work</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <ol className="solc-dial" aria-label="Choose a solution">
        {SOLUTIONS.map((s, i) => (
          <li key={s.name} style={{ "--a": s.colors[0] } as React.CSSProperties}>
            <button type="button" aria-label={s.name} aria-current={i === active || undefined} onClick={() => goTo(i)}>
              <span />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
