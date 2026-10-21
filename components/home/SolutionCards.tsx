"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { transitionTo } from "@/lib/viewTransition";
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

/* His train, for a phone: the bullet train he becomes on a wide screen, drawn small and side on, a
   nose at each end so it rides back the way it came without turning. Set in his own silver, the
   violet stripe along it, the windows lit warm like the city's. */
function Train() {
  return (
    <svg viewBox="0 0 120 36" aria-hidden>
      <defs>
        <linearGradient id="solc-train-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f4ff" />
          <stop offset="0.55" stopColor="#cfd2e6" />
          <stop offset="1" stopColor="#8f93ad" />
        </linearGradient>
        <filter id="solc-train-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      {/* the light it throws on the rail */}
      <ellipse cx="60" cy="30" rx="54" ry="4" fill="#a310e7" opacity="0.35" filter="url(#solc-train-glow)" />
      {/* bogies */}
      <rect x="16" y="24" width="16" height="4" rx="1" fill="#1a1824" />
      <rect x="88" y="24" width="16" height="4" rx="1" fill="#1a1824" />
      <rect x="52" y="24" width="16" height="4" rx="1" fill="#1a1824" />
      {/* the body, a nose at each end */}
      <path d="M12 25 Q3 25 3 18 Q3 11 12 9 H108 Q117 11 117 18 Q117 25 108 25 Z" fill="url(#solc-train-body)" />
      {/* the roof, caught by the light: the face that makes it stand up off the page */}
      <path d="M14 9 Q17 5 24 5 H96 Q103 5 106 9 Z" fill="#ffffff" opacity="0.92" />
      {/* the stripe */}
      <path d="M6 20.5 H114" stroke="#a310e7" strokeWidth="2" strokeLinecap="round" />
      {/* the windows, lit */}
      <g fill="#ffe7b4">
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={20 + i * 12} y="12" width="7" height="5" rx="1.4" />
        ))}
      </g>
      <g fill="#ffe7b4" opacity="0.55" filter="url(#solc-train-glow)">
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={20 + i * 12} y="12" width="7" height="5" rx="1.4" />
        ))}
      </g>
      {/* headlights */}
      <circle cx="5.5" cy="17.5" r="2.2" fill="#fff" />
      <circle cx="114.5" cy="17.5" r="2.2" fill="#fff" />
      <circle cx="5.5" cy="17.5" r="4" fill="#fff" opacity="0.5" filter="url(#solc-train-glow)" />
      <circle cx="114.5" cy="17.5" r="4" fill="#fff" opacity="0.5" filter="url(#solc-train-glow)" />
    </svg>
  );
}

export function SolutionCards() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  const films = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(false); // on screen: its film may play
  const reduce = useStore((s) => s.reducedMotion);
  const router = useRouter();
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

  // the train rides to the card's station: under way it leans into the move and its lights come up
  const [moving, setMoving] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    setMoving(true);
    const id = setTimeout(() => setMoving(false), 1000); // (the rail's own ride, --t-rail in the CSS)
    return () => clearTimeout(id);
  }, [active, reduce]);

  return (
    <section ref={section} id="solutions" className="solc" aria-labelledby="solutions-title">
      <header className="solc-head">
        <h2 id="solutions-title" className="eyebrow">Solutions</h2>
      </header>
      {/* his line, over the cards where it is always in frame: a rail across the screen, a station for
          each solution, and his train standing at the one in view */}
      <div className="solc-line" style={{ "--at": active / (N - 1), "--a": SOLUTIONS[active].colors[0] } as React.CSSProperties}>
        <span className="solc-rail" aria-hidden />
        <ol className="solc-dial" aria-label="Choose a solution">
          {SOLUTIONS.map((s, i) => (
            <li key={s.name} style={{ "--a": s.colors[0] } as React.CSSProperties}>
              <button type="button" aria-label={s.name} aria-current={i === active || undefined} onClick={() => goTo(i)}>
                <span />
              </button>
            </li>
          ))}
        </ol>
        <span className={`solc-train${moving ? " is-moving" : ""}`} aria-hidden>
          <Train />
        </span>
      </div>
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
                onClick={(e) => {
                  // the page crossfades into the solution's own (lib/viewTransition.ts), and comes back to this card
                  e.preventDefault();
                  sessionStorage.setItem("home-scroll", String(scrollY));
                  transitionTo(() => router.push(`/solutions/${solutionSlug(s)}`), "open");
                }}
              >
                <span>View the work</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
