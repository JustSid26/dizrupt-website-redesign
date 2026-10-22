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
   on, in the desktop train's own colours (public/models/train.glb: white paint, dark glass, the violet
   stripe, a dark underbody) on the desktop line's elevated deck with its violet light strips.
   As the section arrives the scene stays where it is and fades up, and the train runs in along it from
   the left, standing with its first carriage in the middle of the screen: the solution's film in its
   window, the words under it. Each gesture moves it on one carriage (lib/stops.ts); after the last it
   runs off to the right as the page goes on. The section is N + 1 screens tall: one for the train to
   run in over, one for each carriage. */
const N = SOLUTIONS.length;
export const RAIL_SCREENS = N + 1;

/* The leading car: the carriage's body run on into a bullet nose, its windscreen wrapped over the top
   of the nose and the stripe sweeping up it to the lamp. Drawn over the body's box (270 by 200). */
function Nose() {
  return (
    <svg className="solc-nose" viewBox="0 0 270 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="solc-paint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfaff" />
          <stop offset="0.1" stopColor="#ebe9f5" />
          <stop offset="0.45" stopColor="#d5d2e4" />
          <stop offset="0.7" stopColor="#b4b0c9" />
          <stop offset="0.85" stopColor="#8e89a7" />
          <stop offset="0.86" stopColor="#2e2c3a" />
          <stop offset="1" stopColor="#17161f" />
        </linearGradient>
        <linearGradient id="solc-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4258" />
          <stop offset="0.5" stopColor="#1a1f2d" />
          <stop offset="1" stopColor="#0d1018" />
        </linearGradient>
      </defs>
      <path d="M0 22 Q0 2 22 2 H96 C176 2 238 44 260 128 C266 152 266 172 250 186 L236 200 H0 Z" fill="url(#solc-paint)" />
      {/* the cool light of the sky along the top, and the shadow under the nose */}
      <path d="M22 5 H96 C150 5 196 22 226 52" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      {/* the passenger windows behind the cab, and the door */}
      <rect x="10" y="26" width="98" height="88" rx="10" fill="url(#solc-glass)" />
      <rect x="14" y="30" width="44" height="80" rx="7" fill="#232a3b" />
      <rect x="62" y="30" width="42" height="80" rx="7" fill="#232a3b" />
      <path d="M17 34 L40 34 L22 70 Z" fill="#ffffff" opacity="0.08" />
      <rect x="118" y="30" width="22" height="140" rx="5" fill="none" stroke="#8e89a7" strokeWidth="1.5" />
      <rect x="122" y="36" width="14" height="46" rx="4" fill="url(#solc-glass)" />
      {/* the windscreen over the nose */}
      <path d="M150 10 C192 14 228 44 246 100 C234 106 214 106 202 100 C190 64 172 40 148 30 Z" fill="url(#solc-glass)" />
      <path d="M160 16 C190 22 214 42 228 72" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.25" strokeLinecap="round" />
      {/* the stripe, sweeping up the nose to the lamp */}
      <path d="M0 150 H168 C204 150 232 138 254 120 L258 129 C236 148 206 159 168 159 H0 Z" fill="#a650ed" />
      <path d="M0 150 H168 C204 150 232 138 254 120" fill="none" stroke="#e2c9ff" strokeWidth="1" opacity="0.7" />
    </svg>
  );
}

export function SolutionsRail() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const train = useRef<HTMLDivElement>(null);
  const cars = useRef<(HTMLDivElement | null)[]>([]);
  const engine = useRef<HTMLDivElement>(null);
  const shadeEl = useRef<HTMLDivElement>(null);
  const headEl = useRef<HTMLElement>(null);
  const copyEl = useRef<HTMLDivElement>(null);
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
    let moving = false, shown = true;
    /* Where everything is, measured once (and again on a resize: ScrollTrigger's refresh), never in the
       middle of a frame's writes: a read after a write makes the browser lay the page out again then and
       there, every frame the page scrolls. */
    const geo = { pitch: 1, W: 1, at1: 0, off: 0 };
    let bogies: HTMLElement[] = [];
    const measure = () => {
      const first = cars.current[N - 1], second = cars.current[N - 2], eng = engine.current;
      if (!first || !eng) return;
      geo.pitch = sec.offsetHeight / RAIL_SCREENS;
      // carriages run back from the engine, so the first is the last in the row
      geo.W = second ? first.offsetLeft - second.offsetLeft : first.offsetWidth;
      geo.at1 = innerWidth / 2 - (first.offsetLeft + first.offsetWidth / 2); // the first carriage in the middle
      geo.off = -(eng.offsetLeft + eng.offsetWidth) - 60; // the whole train off the left edge
      bogies = Array.from(train.current?.querySelectorAll<HTMLElement>(".solc-bogie") ?? []);
    };
    // what was last written, so a frame that changes nothing writes nothing
    const last = { x: NaN, enter: NaN, lift: NaN };
    const place = () => {
      const tr = train.current, pn = pin.current;
      if (!tr || !pn) return;
      /* arriving: while the section's top is still on its way up the screen, the scene is held where it
         will stand (it doesn't rise with the page) and fades up, so all that moves is the train */
      const rt = sec.getBoundingClientRect().top;
      const lift = rt > 0 && rt < innerHeight ? Math.round(rt) : 0;
      const enter = rt >= innerHeight ? 0 : rt <= 0 ? 1 : +(1 - rt / innerHeight).toFixed(3);
      if (lift !== last.lift) { last.lift = lift; pn.style.transform = lift ? `translate3d(0, ${-lift}px, 0)` : ""; }
      if (enter !== last.enter) {
        last.enter = enter;
        const shade = Math.min(1, enter * 1.8), words = Math.min(1, Math.max(0, (enter - 0.55) * 2.3));
        if (shadeEl.current) shadeEl.current.style.opacity = String(shade);
        if (headEl.current) headEl.current.style.opacity = String(shade);
        if (copyEl.current) {
          copyEl.current.style.opacity = String(words);
          copyEl.current.style.transform = words < 1 ? `translate3d(0, ${((1 - words) * 14).toFixed(1)}px, 0)` : "";
        }
        const show = enter > 0.002;
        if (show !== shown) { shown = show; pn.style.visibility = show ? "" : "hidden"; }
      }
      /* u counts the carriages: 0 the train still off to the left, 1 the first carriage in the middle of
         the screen … N the last, and past N it has run off. One screen of scroll per step, measured from
         the section itself so a phone's toolbar coming and going can't put the stops off the carriages */
      const u = Math.max(0, -rt / geo.pitch + 1);
      const x = +(u <= 1 ? geo.off + (geo.at1 - geo.off) * u : geo.at1 + (u - 1) * geo.W).toFixed(1); // (on to the right: the next carriage back comes to the middle)
      if (x !== last.x) {
        last.x = x;
        tr.style.transform = `translate3d(${x}px, 0, 0)`;
        // the wheels turn with the distance run (9px wheels): set on each bogie, not the train, so only they restyle
        const roll = `${(x / 9).toFixed(3)}rad`;
        for (const b of bogies) b.style.setProperty("--roll", roll);
      }
      const k = Math.min(N - 1, Math.max(0, Math.round(u) - 1));
      signals.scroll.solutionIndex = k;
      signals.scroll.solutions = Math.min(1, Math.max(0, (u - 1) / (N - 1)));
      setActive((c) => (c === k ? c : k));
      // under way: the lamp's beam reaches out ahead (the CSS)
      const m = u > 0.02 && Math.abs(u - Math.round(u)) > 0.02;
      if (m !== moving) { moving = m; tr.classList.toggle("is-moving", m); }
    };
    const st = ScrollTrigger.create({
      trigger: sec,
      start: "top bottom",
      end: "bottom top",
      onUpdate: place,
      onRefresh: () => { measure(); last.x = last.enter = last.lift = NaN; place(); },
      onToggle: (self) => setSeen(self.isActive),
    });
    measure();
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
  const bogies = (
    <>
      <span className="solc-bogie" />
      <span className="solc-bogie" />
    </>
  );
  return (
    <section ref={section} id="solutions" className="solc" aria-labelledby="solutions-title" style={{ height: `${RAIL_SCREENS * 100}svh` }}>
      <div ref={pin} className="solc-pin" style={{ "--a": s.colors[0], "--b": s.colors[1] } as React.CSSProperties}>
        {/* the dark it stands in, faded up as it arrives */}
        <div ref={shadeEl} className="solc-shade" aria-hidden />
        <header ref={headEl} className="solc-head">
          <h2 id="solutions-title" className="eyebrow">Solutions</h2>
        </header>
        {/* his line across the screen, up on its deck, and his train on it: the engine leading, a carriage a solution behind it */}
        <div className="solc-scene" aria-hidden>
          <div className="solc-line">
            <span className="solc-rails" />
            <span className="solc-deck" />
            <span className="solc-pillars" />
          </div>
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
                    <span className="solc-door" />
                    <span className="solc-door" />
                    <div className="solc-band">
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
                    </div>
                    <p className="solc-plate">
                      <i />
                      {sol.name}
                    </p>
                  </div>
                  {bogies}
                </div>
              );
            })}
            <div ref={engine} className="solc-engine">
              <Nose />
              <span className="solc-lamp" />
              <span className="solc-beam" />
              {bogies}
            </div>
          </div>
        </div>
        <div ref={copyEl} className="solc-copy">
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
