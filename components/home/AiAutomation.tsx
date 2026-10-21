"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { useSection } from "@/components/home/useSection";
import { TRANSITIONS } from "@/lib/engine/ai/transition";
import { AI_CHAPTERS } from "@/lib/aiStops";
import { EASE, T } from "@/lib/motion";
import { AiNetwork } from "@/components/home/ai/AiNetwork";

/* AI & Automation: not a seventh solution but its own world. Past the last billboard the page loses
   its signal and hands over — on the real pixels, in the engine (lib/engine/ai) — to a
   microcontroller floating in the dark, the Dizrupt mark glowing on it. Four stops: the chip; it
   powers on and steps aside for what we do; how we do it, the three stages played one after another
   on the network round it (components/home/ai); and how it makes life simple, the same business
   running, inside and out. Leaving hands back to the city. */
/* place: where it sits — "left" at the left edge, centred top to bottom (clear of the chip at its
   biggest); "col" the column beside the network once the chip has stepped aside (a phone keeps them
   all at the bottom). note: a short highlighted line under it; sides: the two kinds of workflow */
type Caption = {
  no: string; kicker: string; title: string; line: string; chips?: string[]; place: "left" | "col";
  note?: { k: string; items: string[] }; sides?: { side: string; name: string; areas: string }[];
};
const CAPTIONS: Record<string, Caption> = {
  core: {
    no: "00",
    kicker: "Exclusive",
    title: "AI & Automation",
    place: "left",
    line: "We optimise internal and external workflows through intelligent automation.",
    chips: ["In-depth audit", "Viability report", "Design & implementation"],
  },
  simple: {
    no: "03",
    kicker: "How it makes life simple",
    title: "We optimise how your business works.",
    place: "col",
    line: "We analyse internal and external workflows to uncover inefficiencies, eliminate repetitive tasks, and identify opportunities for intelligent automation. By connecting systems and streamlining processes, we help businesses operate more efficiently, improve productivity, and scale with confidence.",
    sides: [
      { side: "external", name: "External workflows", areas: "Customer enquiries · Lead management · Client communication" },
      { side: "internal", name: "Internal workflows", areas: "Operations · Administration · Reporting · Data handling" },
    ],
    note: { k: "Built to improve", items: ["Cost efficiency", "Time efficiency"] },
  },
};

/* How we do it: the three stages on one page, beside the network as one gesture plays them
   (AiNetwork.tsx writes which is up onto the section, --h0..--h2: the one playing opens out) */
type Stage = { no: string; name: string; title: string; line: string; points: string[] };
const STAGES: Stage[] = [
  {
    no: "01",
    name: "Audit",
    title: "Understand before you automate.",
    line: "We examine existing workflows, systems, dependencies, and operational bottlenecks to uncover where time and money are lost.",
    points: ["Workflow mapping", "Bottlenecks found", "Systems reviewed", "Opportunities identified"],
  },
  {
    no: "02",
    name: "Evaluate · Viability report",
    title: "Know what is worth automating.",
    line: "Each opportunity weighed on feasibility, suitability, complexity, dependencies, and business value, then prioritised.",
    points: ["Feasibility", "Dependencies", "Prioritised recommendations", "Risks considered"],
  },
  {
    no: "03",
    name: "Implement",
    title: "Turn insight into intelligent operations.",
    line: "Tailored automation designed around your systems, integrated, tested, and refined with you.",
    points: ["Workflow redesign", "Integrations", "AI where suitable", "Testing & support"],
  },
];

const CAPTION_LIST = Object.entries(CAPTIONS);

const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#%&$@";

/** A title that decodes out of noise whenever it comes on. */
function Decode({ text, on, reduce }: { text: string; on: boolean; reduce: boolean }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!on || reduce) return void setOut(text);
    let raf = 0;
    // two staggers in, it resolves a letter at a time (30ms each: a longer title takes longer)
    const start = performance.now() + T.stagger * 2 * 1000;
    const dur = T.uiOut * 1000 + text.length * 30;
    const step = (now: number) => {
      const t = (now - start) / dur;
      if (t >= 1) return void setOut(text);
      const lock = Math.max(0, Math.floor(t * text.length));
      setOut([...text].map((c, i) => (c === " " ? " " : i < lock ? c : NOISE[(Math.random() * NOISE.length) | 0])).join(""));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, on, reduce]);
  return <span aria-hidden>{out}</span>;
}

export function AiAutomation() {
  const section = useRef<HTMLElement>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const [chapter, setChapter] = useState(0);
  // set by AiNetwork: go to one of the three steps of how we do it
  const seek = useRef<((step: number) => void) | null>(null);
  const grabAt = useRef<{ x: number; y: number } | null>(null);
  const [grabbed, setGrabbed] = useState(false); // the hint goes once it's been tried
  const readout = useRef<HTMLParagraphElement>(null);
  const depth = useRef<HTMLParagraphElement>(null);
  const [on, setOn] = useState(false);
  const reduce = useStore((s) => s.reducedMotion);
  // read when the hand-over starts, not when the section mounted (the preference can change)
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  useSection(section, "ai");

  useEffect(() => {
    const f = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(3)}`;
    const tick = () => {
      if (signals.scroll.section !== "ai") return;
      if (readout.current) readout.current.textContent = `X ${f(signals.pointer.x)}  Y ${f(signals.pointer.y)}`;
      if (depth.current) depth.current.textContent = `Z ${signals.ai.play.toFixed(3)}`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  useEffect(() => {
    // the hand-over, played in time rather than scrubbed: once it starts, it runs
    const play = (to: 0 | 1) => {
      tween.current?.kill();
      const ai = signals.ai;
      const TR = TRANSITIONS[ai.mode] ?? TRANSITIONS[0];
      if (reduceRef.current) {
        // reduced motion: no glitch, a quick crossfade
        tween.current = gsap.to(ai, { mix: to, duration: T.reduced, ease: EASE.inOut });
        return;
      }
      tween.current = gsap.to(ai, { mix: to, duration: TR.duration * Math.abs(to - ai.mix), ease: EASE.handover });
    };
    signals.ai.mode = 0; // signal loss, both ways
    const el = section.current!;
    const sts = [
      // build the world well before it's needed, so the hand-over doesn't hitch; well past it, it may go
      ScrollTrigger.create({ trigger: el, start: "top bottom+=250%", end: "bottom top-=150%", onToggle: (self) => void (signals.ai.warm = self.isActive) }),
      // (late in the ride from the bridge: the fly-in to his heart plays out first, then the glitch)
      ScrollTrigger.create({ trigger: el, start: "top 60%", onEnter: () => play(1), onLeaveBack: () => play(0) }),
      ScrollTrigger.create({ trigger: el, start: "bottom bottom", onEnter: () => play(0), onLeaveBack: () => play(1) }),
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        // (the chapter is the beat the animation is playing to: AiNetwork says which)
        onUpdate: (self) => void (signals.ai.p = self.progress),
      }),
    ];
    const r = el.getBoundingClientRect();
    signals.ai.warm = sts[0].isActive || (r.top < innerHeight * 3.5 && r.bottom > -innerHeight * 1.5);
    // arriving mid-section (a reload, the menu): be there already
    if (sts[1].progress > 0 && !sts[2].progress) signals.ai.mix = 1;
    return () => {
      sts.forEach((s) => s.kill());
      tween.current?.kill();
    };
  }, []);

  // the page itself glitches while the hand-over runs; the HUD comes up once the world is there
  useEffect(() => {
    let last = -1;
    const root = document.documentElement;
    const tick = () => {
      const m = signals.ai.mix;
      const shifting = m > 0.001 && m < 0.999;
      signals.busy.handover = !!tween.current?.isActive();
      root.classList.toggle("ai-shifting", shifting);
      if (shifting) {
        root.style.setProperty("--ai-jx", `${((Math.random() - 0.5) * 24 * Math.sin(Math.PI * m)).toFixed(1)}px`);
        root.style.setProperty("--ai-cl", `${(Math.random() * 60).toFixed(0)}%`);
      }
      const nowOn = m > 0.85;
      if (nowOn !== (last === 1)) {
        last = nowOn ? 1 : 0;
        setOn(nowOn);
      }
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      root.classList.remove("ai-shifting");
      signals.busy.handover = false;
    };
  }, []);

  // the words up: the three stages of how we do it share one page of them
  const id = AI_CHAPTERS[chapter].view;
  const caption = ([key, c]: [string, Caption], i: number) => (
    <article key={key} className={`ai-ch${key !== "core" ? " is-compact" : ""} is-${c.place}`} data-on={key === id || undefined} aria-hidden={key !== id}>
      <p className="ai-kicker">{c.kicker}</p>
      {key === "core" ? (
        <h2 id="ai-title" className="ai-title" aria-label={c.title}>
          <Decode text={c.title} on={key === id} reduce={reduce} />
        </h2>
      ) : (
        <h3 className="ai-title" aria-label={c.title}>
          <Decode text={c.title} on={key === id} reduce={reduce} />
        </h3>
      )}
      <p className="ai-line">{c.line}</p>
      {c.sides && (
        <dl className="ai-sides">
          {c.sides.map((sd) => (
            <div key={sd.side} className={`is-${sd.side}`}>
              <dt>
                <i /> {sd.name}
              </dt>
              <dd>{sd.areas}</dd>
            </div>
          ))}
        </dl>
      )}
      {c.note && (
        <p className="ai-note">
          <span>{c.note.k}</span>
          {c.note.items.map((it) => (
            <b key={it}>{it}</b>
          ))}
        </p>
      )}
      {c.chips && (
        <ul className="ai-chips">
          {c.chips.map((ch) => (
            <li key={ch}>{ch}</li>
          ))}
        </ul>
      )}
    </article>
  );
  return (
    <section ref={section} id="ai" className={`ai${on ? " is-on" : ""}`} data-chapter={id} aria-labelledby="ai-title" style={{ height: "380svh", "--h0": 0, "--h1": 0, "--h2": 0 } as React.CSSProperties}>
      <div className="ai-pin">
        {/* the business the core runs, the method played on it, and what it adds up to */}
        <AiNetwork section={section} chapter={id} onBeat={setChapter} seek={seek} />

        {/* the instrument frame over the world: brackets, rulers, readouts, a scan sweeping down */}
        {/* the chip, at first: drag it round; left alone it goes back to floating (lib/engine/ai/world.ts) */}
        <div
          className="ai-grab"
          aria-hidden
          onPointerDown={(e) => {
            const g = signals.aiGrab;
            g.down = true;
            g.at = performance.now();
            grabAt.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
            setGrabbed(true);
          }}
          onPointerMove={(e) => {
            const g = signals.aiGrab, last = grabAt.current;
            if (!g.down || !last) return;
            g.dx += e.clientX - last.x;
            g.dy += e.clientY - last.y;
            g.at = performance.now();
            grabAt.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => {
            signals.aiGrab.down = false;
            signals.aiGrab.at = performance.now();
            grabAt.current = null;
          }}
          onPointerCancel={() => {
            signals.aiGrab.down = false;
            grabAt.current = null;
          }}
        >
          <p className="ai-grab-hint" data-gone={grabbed || undefined}>
            Drag to turn the chip
          </p>
        </div>

        <div className="ai-frame" aria-hidden>
          <div className="ai-grid" />
          <div className="ai-sweep" />
          <div className="ai-ruler">
            {Array.from({ length: 41 }, (_, k) => (
              <span key={k} className={k % 5 ? "" : "major"} />
            ))}
          </div>
          <p className="ai-read ai-read-tr">
            SYS DZ-M1 <b>·</b> BUS 16× <b>·</b> <span className="ai-ok">LINK OK</span>
          </p>
          <p className="ai-read ai-read-br" ref={readout}>
            X +0.000 Y +0.000
          </p>
          <p className="ai-read ai-read-bl" ref={depth}>
            Z 0.000
          </p>
        </div>

        <div className="ai-hud">
          <p className="ai-tag">
            <span className="hud-no">AI</span> Neural systems
            <span className="ai-live">
              <i /> live
            </span>
          </p>

          <div className="ai-placed">{CAPTION_LIST.map(caption)}</div>

          {/* how we do it: the three stages together, the one playing opened out */}
          <div className="ai-how" data-on={id === "how" || undefined} aria-hidden={id !== "how"}>
            <p className="ai-kicker">
              How we do it <em className="ai-how-hint">· Select a step</em>
            </p>
            <ol className="ai-how-list">
              {STAGES.map((s, i) => (
                <li key={s.no} className="ai-hw" style={{ "--h": `var(--h${i})` } as React.CSSProperties}>
                  {/* a step opens on its own, as the network plays it; or pick one, and the network goes to it */}
                  <button type="button" className="ai-hw-head" tabIndex={id === "how" ? 0 : -1} onClick={() => seek.current?.(i)}>
                    <span className="ai-hw-name">{s.name}</span>
                    <span className="ai-hw-title">{s.title}</span>
                  </button>
                  <div className="ai-hw-more">
                    <p className="ai-hw-line">{s.line}</p>
                    <ul className="ai-hw-points">
                      {s.points.map((pt) => (
                        <li key={pt}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ol className="ai-steps" aria-hidden>
            {AI_CHAPTERS.map((c, i) => (
              <li key={c.id} data-on={i === chapter || undefined}>
                <span>{c.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
