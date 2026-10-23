"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { AI_CHAPTERS, AI_EXIT_FROM, AI_STAGES, AI_STOPS } from "@/lib/aiStops";
import { BACK, EASE, T, camera } from "@/lib/motion";
import { isPhoneLayout } from "@/lib/layout";
import { PANEL_VIEWS } from "@/components/home/ai/Panels";
import { Matrix } from "@/components/home/ai/Matrix";
import { GROUPS, foundFor, linksFor, mapFor, panelsFor, placesFor, scanSpan, threadFor, SIDE, type PanelId } from "@/components/home/ai/layout";

const at = (id: string) => AI_STOPS[AI_CHAPTERS.findIndex((c) => c.id === id)];
const WHAT = at("what"), HOW = AI_STAGES[AI_STAGES.length - 1], SIMPLE = at("simple");
/** The beat the page rests at for how we do it; its three stages are toggled to from there. */
const HOW_K = AI_CHAPTERS.findIndex((c) => c.id === "how");
/** How far past a beat the scroll has to go, as a share of the way to the next, to set it playing. */
const NUDGE = 0.1;

const HEADLINE = ["Less friction.", "Smarter workflows.", "Greater potential."];
const BODY =
  "From identifying inefficiencies to implementing tailored automation solutions, we help businesses create more efficient, connected ways of working. Every solution begins with understanding the process, evaluating the opportunity, and designing an approach around real operational needs.";
const METHOD = ["Audit", "Evaluate", "Implement"];
/** A portrait screen: the least room the picture is given over the words (px), and the share of the
    screen's height the chip takes at its closest when it has the whole screen. */
const MIN_STAGE = 96;
const CHIP = 0.38;

/* What the audit flags on each panel, and what it is once connected. The leads carry the workflow
   followed through all three stages. Not everything goes hands-off: exceptions stay with a person. */
const TAGS: Record<PanelId, { find: string; done: string }> = {
  inbox: { find: "Sorted by hand", done: "Auto-triaged" },
  leads: { find: "WF-01 · Enquiry to lead", done: "WF-01 · Running" },
  messages: { find: "Replies wait", done: "Drafted · you approve" },
  sheet: { find: "Re-keyed · duplicates", done: "Synced" },
  invoices: { find: "Chased by hand", done: "Exceptions to a person" },
  report: { find: "Built by hand", done: "Builds itself" },
  tasks: { find: "Repetitive", done: "Handled" },
};

/* The order each panel's own work is done once it's connected: the inbox triaged first, the report
   last, because it's built from the rest. */
const DONE: PanelId[] = ["inbox", "leads", "messages", "sheet", "invoices", "tasks", "report"];

/* A phone's chip, in detail (drawn in the chip's own box, 0..100): eight pins a side, each led in to a
   bond pad on the die by a trace that runs in straight and then on the diagonal, the die's grid under
   the heart, the pin-one mark and the fiducials. Over it, a lit layer of the same pins and traces: it is
   what powers up in what we do. */
type ChipSide = "t" | "r" | "b" | "l";
const PIN = Array.from({ length: 8 }, (_, j) => 14 + (j * 72) / 7);
const PAD = Array.from({ length: 8 }, (_, j) => 30 + (j * 40) / 7);
const DIE = 28; // how far in from the body's edge the die starts
// a point on a side, by how far along it (a) and how far in from its edge (d)
const onSide = (s: ChipSide, a: number, d: number) => (s === "t" ? [a, d] : s === "b" ? [a, 100 - d] : s === "l" ? [d, a] : [100 - d, a]).map((v) => +v.toFixed(2));
const lead = (s: ChipSide, j: number) => {
  const bend = 12 + Math.abs(PIN[j] - PAD[j]);
  const pts = [onSide(s, PIN[j], 1), onSide(s, PIN[j], 12), onSide(s, PAD[j], bend), onSide(s, PAD[j], DIE)];
  return "M" + pts.map((p) => p.join(" ")).join(" L");
};
const pinRect = (s: ChipSide, j: number) => {
  const p = +(PIN[j] - 2.3).toFixed(2);
  return s === "t" ? { x: p, y: -7, width: 4.6, height: 8 } : s === "b" ? { x: p, y: 99, width: 4.6, height: 8 } : s === "l" ? { x: -7, y: p, width: 8, height: 4.6 } : { x: 99, y: p, width: 8, height: 4.6 };
};
// round the body the way current runs round it as it powers up: along the top, down the right, back along the bottom, up the left
const ROUND: [ChipSide, number][] = [
  ...PIN.map((_, j) => ["t", j] as [ChipSide, number]),
  ...PIN.map((_, j) => ["r", j] as [ChipSide, number]),
  ...PIN.map((_, j) => ["b", 7 - j] as [ChipSide, number]),
  ...PIN.map((_, j) => ["l", 7 - j] as [ChipSide, number]),
];

function ChipArt() {
  return (
    <svg className="ain-chip-art" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <pattern id="ain-die-grid" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M4 0 H0 V4" fill="none" stroke="rgb(201 184 255 / 0.16)" strokeWidth="0.35" />
        </pattern>
        <radialGradient id="ain-die-glow">
          <stop offset="0" stopColor="#d9b8ff" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#8f3dff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#3cf0ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the leads, cold */}
      <g className="ain-chip-cold">
        {ROUND.map(([s, j]) => (
          <path key={s + j} d={lead(s, j)} />
        ))}
      </g>
      {/* the die: its grid, its edge, the bond pads round it */}
      <rect className="ain-chip-die" x={DIE} y={DIE} width={100 - DIE * 2} height={100 - DIE * 2} rx="2.5" />
      <rect x={DIE} y={DIE} width={100 - DIE * 2} height={100 - DIE * 2} rx="2.5" fill="url(#ain-die-grid)" />
      <rect className="ain-chip-core" x={DIE - 6} y={DIE - 6} width={100 - DIE * 2 + 12} height={100 - DIE * 2 + 12} fill="url(#ain-die-glow)" />
      <g className="ain-chip-pads">
        {ROUND.map(([s, j]) => {
          const [x, y] = onSide(s, PAD[j], DIE);
          return <rect key={s + j} x={x - 1.1} y={y - 1.1} width="2.2" height="2.2" rx="0.4" />;
        })}
      </g>
      {/* the pins, and the pin-one mark and fiducials in the corners */}
      <g className="ain-chip-pins">
        {ROUND.map(([s, j]) => (
          <rect key={s + j} {...pinRect(s, j)} rx="0.8" />
        ))}
      </g>
      <circle className="ain-chip-one" cx="7.5" cy="7.5" r="1.9" />
      <g className="ain-chip-fid">
        <circle cx="92.5" cy="7.5" r="1.6" />
        <circle cx="92.5" cy="92.5" r="1.6" />
        <circle cx="7.5" cy="92.5" r="1.6" />
      </g>
      {/* lit: the same pins and leads, powered up in what we do (AiNetwork's timeline) */}
      <g className="ain-chip-lit">
        {ROUND.map(([s, j]) => (
          <path key={s + j} className="ain-chip-lead" pathLength={1} d={lead(s, j)} />
        ))}
        {ROUND.map(([s, j]) => (
          <rect key={s + j} className="ain-chip-pin-lit" {...pinRect(s, j)} rx="0.8" />
        ))}
      </g>
    </svg>
  );
}

/** The picture is portrait: a phone's arrangement. */
function useTall() {
  const [tall, setTall] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-aspect-ratio: 1/1)");
    const update = () => setTall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return tall;
}

/* The network the core powers, carried on from the traces in the AI world. First what we do, said
   plainly beside the chip. Then how, all on one page as one gesture plays it: the business comes up
   round the core (its external workflows on the near side, its internal ones on the far), the audit
   scans it and maps where the work breaks, the viability report weighs what it found and ranks it,
   and the implementation connects the ones worth it and sets them running. One workflow (an enquiry
   becoming a qualified lead) is followed all the way. Last, the same business, running, its two sides
   named: how it makes life simple. The text for each is the HUD's (AiAutomation.tsx); which of the
   three stages is up is written onto its text (--h0..--h2) for it to follow. */
export function AiNetwork({ section, chapter, onBeat, seek }: {
  section: RefObject<HTMLElement | null>; chapter: string; onBeat: (k: number) => void; seek: MutableRefObject<((step: number) => void) | null>;
}) {
  const reduce = useStore((st) => st.reducedMotion);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const onBeatRef = useRef(onBeat);
  onBeatRef.current = onBeat;
  const root = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null); // a phone's chip: drawn here, there is no AI world behind it
  const stage = useRef<HTMLDivElement>(null);
  const tall = useTall();
  const places = placesFor(tall);
  const found = useMemo(() => foundFor(tall), [tall]); // where the audit finds the tools: scattered, askew
  const ids = panelsFor(tall);
  const links = linksFor(tall);
  const map = mapFor(tall);
  const thread = threadFor(tall);

  useEffect(() => {
    const el = root.current!, sec = section.current!;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const panels = q<HTMLElement>(".ain-panel");
      /* a value only one part reads is written onto that part, not the network's root: on the root,
         every frame it changes restyles the whole network under it */
      const scan = q<HTMLElement>(".ain-scan")[0] ?? el, report = q<HTMLElement>(".ain-matrix")[0] ?? el, pulses = q<SVGGElement>(".ain-thread-flow")[0] ?? el;
      // (linear inside: the play head that drives it carries the ease, lib/motion.ts)
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
      /* each beat is placed as a fraction of the ride it plays in, so the stops can move (the network's
         own choreography: its scan, its report, its wiring keep those shares of the beat). Every beat
         plays in one beat's time (lib/motion.ts), so a span of the timeline is so many seconds: s1, s2
         and s3 turn seconds into the timeline's units in what we do, how (its three stages), and made
         simple, so words arrive and stagger at the site's own tempo however long the span */
      const g1 = WHAT, g2 = HOW - WHAT, g3 = SIMPLE - HOW;
      const in1 = (f: number) => g1 * f, in2 = (f: number) => WHAT + g2 * f, in3 = (f: number) => HOW + g3 * f;
      const s1 = (sec: number) => (sec * g1) / T.beat, s2 = (sec: number) => (sec * g2) / (T.beat * AI_STAGES.length);
      const hide = { strokeDashoffset: 1, autoAlpha: 0 }, draw = { strokeDashoffset: 0, autoAlpha: 1 };

      // What we do: said plainly beside the chip as it powers on and steps aside, a line at a time
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: g1 * 0.1 }, in1(0.55));
      // (the words start at 55–60% of the ride and are read by the time it lands)
      tl.fromTo(q(".ai-say-w > span"), { yPercent: 110 }, { yPercent: 0, duration: s1(T.ui), stagger: s1(T.stagger), ease: EASE.in }, in1(0.55));
      tl.fromTo(q(".ai-say-rest"), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: s1(T.ui), stagger: s1(T.stagger), ease: EASE.in }, in1(0.6));

      /* A phone's chip powers up as what we do comes in (a wide screen's is the AI world's): current
         runs round its pins, down its leads into the die, the core lights under the heart, and the
         board's lines carry it out to the edges of the screen. Played back, it powers down. */
      const cq = gsap.utils.selector(chip.current);
      tl.fromTo(cq(".ain-chip-pin-lit"), { opacity: 0 }, { opacity: 1, duration: g1 * 0.05, stagger: (g1 * 0.3) / ROUND.length }, in1(0.06));
      tl.fromTo(cq(".ain-chip-lead"), hide, { ...draw, duration: g1 * 0.14, stagger: (g1 * 0.22) / ROUND.length }, in1(0.26));
      tl.fromTo(chip.current, { "--core": 0 }, { "--core": 1, duration: g1 * 0.2, ease: EASE.inOut }, in1(0.56));
      tl.fromTo(cq(".ain-board i"), { scaleX: 0 }, { scaleX: 1, duration: g1 * 0.22, stagger: g1 * 0.035, ease: EASE.in }, in1(0.7));
      // the board's lines go as the business comes up round the core
      tl.to(cq(".ain-board"), { autoAlpha: 0, duration: g2 * 0.04 }, in2(0));

      /* How we do it, one stage after another on one gesture: the statement makes way and the business
         comes up round the core */
      tl.to(q(".ai-say"), { autoAlpha: 0, y: -24, duration: s2(T.uiOut), ease: EASE.out }, in2(0));
      tl.fromTo(hub.current, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: g2 * 0.06, ease: EASE.in }, in2(0.02));
      panels.forEach((p, i) => tl.fromTo(p, { "--e": 0 }, { "--e": 1, duration: s2(T.ui), ease: EASE.in }, in2(0.05) + i * s2(T.stagger)));
      /* which stage the text is on: written onto the text (not the section, where every change would
         restyle the whole network under it, frame after frame) */
      const how = sec.querySelector<HTMLElement>(".ai-how") ?? sec;
      tl.fromTo(how, { "--h0": 0 }, { "--h0": 1, duration: g2 * 0.04 }, in2(0.04));
      tl.to(how, { "--h0": 0, duration: g2 * 0.04 }, in2(0.36));
      tl.fromTo(how, { "--h1": 0 }, { "--h1": 1, duration: g2 * 0.04 }, in2(0.36));
      tl.to(how, { "--h1": 0, duration: g2 * 0.04 }, in2(0.66));
      tl.fromTo(how, { "--h2": 0 }, { "--h2": 1, duration: g2 * 0.04 }, in2(0.66));

      // 01 Audit: a scan sweeps it and flags each panel as it passes; the hand-offs are traced, and where they break
      const span = scanSpan(tall);
      tl.fromTo(scan, { "--scanO": 0 }, { "--scanO": 1, duration: g2 * 0.02 }, in2(0.12));
      tl.fromTo(scan, { "--scan": 0 }, { "--scan": 1, duration: g2 * 0.18, ease: EASE.inOut }, in2(0.13));
      tl.to(scan, { "--scanO": 0, duration: g2 * 0.02 }, in2(0.31));
      panels.forEach((p) => {
        const at = (found[p.dataset.id as PanelId].x - span.from) / (span.to - span.from);
        tl.fromTo(p, { "--f": 0 }, { "--f": 1, duration: g2 * 0.03 }, in2(0.13 + 0.18 * Math.min(1, Math.max(0, at))));
      });
      tl.fromTo(q(".ain-map path"), hide, { ...draw, duration: g2 * 0.06, stagger: s2(T.stagger) }, in2(0.17));
      tl.fromTo(q(".ain-faults"), { autoAlpha: 0 }, { autoAlpha: 1, duration: g2 * 0.03 }, in2(0.27));
      tl.fromTo(q(".ain-thread path"), hide, { ...draw, duration: g2 * 0.05, stagger: s2(T.stagger) }, in2(0.29));

      // 02 Evaluate: the map steps back and the report rises over it; the workflows settle into their ranking
      tl.fromTo(el, { "--v": 0 }, { "--v": 1, duration: g2 * 0.07, ease: EASE.inOut }, in2(0.37));
      tl.fromTo(report, { "--mx": 0 }, { "--mx": 1, duration: g2 * 0.07, ease: EASE.in }, in2(0.4));
      q<HTMLElement>(".aim-row").forEach((r) => {
        const found = Number(r.style.getPropertyValue("--from")) || 0;
        tl.fromTo(r, { "--in": 0 }, { "--in": 1, duration: s2(T.ui), ease: EASE.in }, in2(0.44) + found * s2(T.stagger));
        tl.fromTo(r, { "--m": 0 }, { "--m": 1, duration: g2 * 0.06 }, in2(0.46) + found * s2(T.stagger));
      });
      tl.fromTo(report, { "--rk": 0 }, { "--rk": 1, duration: g2 * 0.08, ease: EASE.inOut }, in2(0.56));

      // 03 Implement: the report gives way, the workflows worth it are wired to the core and set running
      tl.to(report, { "--mx": 0, duration: g2 * 0.05, ease: EASE.out }, in2(0.66));
      tl.to(el, { "--v": 0, duration: g2 * 0.07, ease: EASE.inOut }, in2(0.69));
      tl.to(q(".ain-map, .ain-faults"), { autoAlpha: 0, duration: g2 * 0.04 }, in2(0.72));
      // the tools, found scattered and askew, are gathered into order before the core is wired to them
      panels.forEach((p, i) => tl.fromTo(p, { "--k": 0 }, { "--k": 1, duration: g2 * 0.06, ease: EASE.inOut }, in2(0.71) + i * s2(T.stagger) * 0.5));
      tl.fromTo(q(".ain-link"), hide, { ...draw, duration: g2 * 0.06, stagger: s2(T.stagger) }, in2(0.74));
      tl.fromTo(hub.current, { "--live": 0 }, { "--live": 1, duration: g2 * 0.04 }, in2(0.78));
      tl.fromTo(pulses, { "--tl": 0 }, { "--tl": 1, duration: g2 * 0.04 }, in2(0.8));
      tl.fromTo(q(".ain-flows"), { autoAlpha: 0 }, { autoAlpha: 1, duration: g2 * 0.03 }, in2(0.83));
      panels.forEach((p) => tl.fromTo(p, { "--a": 0 }, { "--a": 1, duration: g2 * 0.04 }, in2(0.8 + DONE.indexOf(p.dataset.id as PanelId) * 0.022)));

      // Made simple: the stages' tags give way to the two sides, framed and named, running
      tl.fromTo(el, { "--sm": 0 }, { "--sm": 1, duration: g3 * 0.35, ease: EASE.inOut }, in3(0.1));

      // and all of it gives way, as the hand-back to the work begins
      tl.to(el, { autoAlpha: 0, duration: 0.05 }, AI_EXIT_FROM + 0.01); // (timeline units, not seconds: the scroll's own past the last beat)
      tl.set({}, {}, 1);
      /* Not scrubbed: the scroll picks the beat, and the animation plays there in time. A gesture's
         ride to a beat and the beat itself share one clock: the beat plays for as long as the page has
         left to ride (signals.rideEnd), so the two land together; with no ride under way (a reload, a
         nav jump), a beat's own time. Back past a beat, the same in reverse, quicker. Past the last it
         hands over to the scroll again: the way out to the work is a ride already (lib/stops.ts). The
         AI world reads the same clock (signals.ai.play), so the chip and the camera keep in step. */
      const head = { t: 0 };
      let k = 0, lastP = 0, tw: gsap.core.Timeline | null = null;
      const S = AI_STOPS, n = S.length;
      /* where how we do it rests on the clock: its first stage to begin with, then whichever stage
         was last toggled to (seek, below), so the scroll's beat and the toggle never fight */
      let howRest = S[HOW_K];
      const rest = (i: number) => (i === HOW_K ? howRest : S[i]);
      const apply = () => {
        tl.time(head.t);
        signals.ai.play = head.t;
      };
      /* a jump on the clock hidden behind a short fade of the picture: what lies between is never
         seen (the stages of how we do it are toggled, not played through) */
      const fadeJump = (seq: gsap.core.Timeline, t: number) => {
        const st = stage.current;
        seq.to(st, { autoAlpha: 0, duration: reduceRef.current ? T.reduced : 0.22, ease: EASE.out });
        seq.call(() => { head.t = t; apply(); });
        seq.to(st, { autoAlpha: 1, duration: reduceRef.current ? T.reduced : 0.3, ease: EASE.in });
      };
      // to beat `to`, through every beat on the way
      const playTo = (to: number) => {
        tw?.kill();
        const fwd = rest(to) >= head.t;
        const legs: number[] = [];
        if (fwd) for (let i = 0; i <= to; i++) { if (rest(i) > head.t + 1e-4) legs.push(i); }
        else for (let i = n - 1; i >= to; i--) { if (rest(i) < head.t - 1e-4) legs.push(i); }
        if (!legs.length) legs.push(to);
        const seq = gsap.timeline({ onUpdate: apply });
        // the page's ride, if one is under way: the beats share what is left of it
        const left = (signals.rideEnd - performance.now()) / 1000;
        let from = head.t;
        // a leg out of how (or back into it) skips what lies between the stage it rests at and the stages' end
        const skip = (t: number) => fadeJump(seq, t);
        const PAST_HOW = HOW + 0.002; // just past the stages' end, where made simple's picture has taken over
        legs.forEach((i) => {
          seq.call(() => onBeatRef.current(i));
          // out of how we do it (from wherever it rests among the stages): over the rest of them at once
          if (fwd && i > HOW_K && from >= S[HOW_K] - 1e-4 && from < HOW + 1e-4) { skip(PAST_HOW); from = PAST_HOW; }
          const whole = fwd ? S[i] - (S[i - 1] ?? 0) : (S[i + 1] ?? 1) - S[i];
          const part = Math.min(1, Math.abs(rest(i) - from) / Math.max(1e-4, whole));
          /* the chip to what we do (either way) is the wake: on a wide screen it powers on, pulls back
             and steps aside, all in the middle of the leg, so it runs at the camera's steady pace
             rather than inOut's, which would rush that middle through in a quarter of the time */
          const wake = (fwd ? i === 1 : i === 0) && !isPhoneLayout();
          const own = (wake ? T.wake : T.beat) * part * (fwd ? 1 : BACK);
          const dur = reduceRef.current ? T.reduced : left > 0.2 ? left / legs.length : own;
          if (!fwd && i === HOW_K && from > HOW + 1e-4) {
            // back into how: made simple's picture goes, then across to the stage it rests at
            seq.to(head, { t: PAST_HOW, duration: dur, ease: EASE.inOut });
            skip(howRest);
            from = howRest;
            return;
          }
          seq.to(head, { t: rest(i), duration: dur, ease: wake ? camera() : EASE.inOut });
          from = rest(i);
        });
        tw = seq;
      };
      const step = (p: number) => {
        // out past the last beat, once it has played: the scroll's own
        if (p > SIMPLE && head.t >= SIMPLE - 0.001 && !tw?.isActive()) {
          head.t = Math.min(1, p);
          return apply();
        }
        const last = k;
        // forward, the furthest beat whose nudge it has passed; back, the nearest it has come back past
        if (p > lastP) {
          let f = 0;
          for (let i = 1; i < n; i++) if (p >= S[i - 1] + NUDGE * (S[i] - S[i - 1])) f = i;
          k = Math.max(k, f);
        } else if (p < lastP) {
          let b = n - 1;
          for (let i = n - 2; i >= 0; i--) if (p <= S[i + 1] - NUDGE * (S[i + 1] - S[i])) b = i;
          k = Math.min(k, b);
        }
        lastP = p;
        // sent here by the nav: be at the beat at once rather than play every page on the way
        if (performance.now() < signals.navJumpUntil) {
          tw?.kill();
          head.t = p > SIMPLE ? Math.min(1, p) : rest(k);
          apply();
          if (k !== last) onBeatRef.current(k);
          return;
        }
        if (k !== last || (!tw?.isActive() && head.t !== rest(k))) playTo(k);
      };
      /* a stage of how we do it, picked from the text: the network plays to it where the page stands,
         forward or back, at a beat's pace; the page itself doesn't move. Between neighbours the one
         plays into the other; between audit and implement the evaluation in between is never seen:
         behind a fade, the clock jumps past it, and only the stage asked for plays. */
      let howStage = 0;
      seek.current = (i: number) => {
        const from = howStage;
        howStage = i;
        howRest = AI_STAGES[i];
        if (k !== HOW_K) return;
        tw?.kill();
        const seq = gsap.timeline({ onUpdate: apply });
        const dur = (part: number) => (reduceRef.current ? T.reduced : T.beat * Math.max(0.4, Math.min(1, part)));
        if (Math.abs(i - from) > 1) {
          if (i > from) {
            // audit to implement: in just past the report's going (it is gone by 0.71), then the gathering and the wiring play
            const wire = in2(0.716);
            fadeJump(seq, wire);
            seq.to(head, { t: howRest, duration: dur((howRest - wire) / (AI_STAGES[2] - AI_STAGES[1])), ease: EASE.inOut });
          } else fadeJump(seq, howRest); // implement to audit: straight back to the audit's picture
        } else seq.to(head, { t: howRest, duration: dur(Math.abs(howRest - head.t) / Math.max(1e-4, HOW - S[HOW_K])), ease: EASE.inOut });
        tw = seq;
      };
      const st = ScrollTrigger.create({ trigger: sec, start: "top top", end: "bottom bottom", onUpdate: (self) => step(self.progress) });
      // while a beat plays, the scroll waits for it (SmoothScroll.tsx)
      const busy = () => void (signals.busy.ai = !!tw?.isActive());
      gsap.ticker.add(busy);
      // arriving partway (a reload, the nav): be at the beat already, without playing up to it
      {
        const p = (lastP = st.progress);
        while (k < AI_STOPS.length - 1 && p >= AI_STOPS[k + 1] - NUDGE * (AI_STOPS[k + 1] - AI_STOPS[k])) k++;
        head.t = p > SIMPLE ? Math.min(1, p) : rest(k);
        apply();
        onBeatRef.current(k);
      }
      return () => {
        tw?.kill();
        gsap.ticker.remove(busy);
        signals.busy.ai = false;
        seek.current = null;
      };
    }, el);
    return () => ctx.revert();
  }, [section, tall, places, found, seek]);

  // the core rides on the chip wherever the camera has it, and the network moves with it
  useEffect(() => {
    /* A portrait screen: the words take the bottom, and the picture (the chip, the network, the
       report) is fitted into the room between the HUD's tag and the top of whatever words are up —
       the stage, which follows them as they change from beat to beat. */
    const portrait = matchMedia("(max-aspect-ratio: 1/1)");
    const room = { top: -1, bottom: -1 };
    const tick = (_: number, dtMs: number) => {
      const h = hub.current, el = root.current, st = stage.current, sec = section.current;
      if (!h || !el || !st || !sec || signals.scroll.section !== "ai") return;
      const f = signals.frame.ai;
      if (portrait.matches) {
        const top = (sec.querySelector(".ai-tag")?.getBoundingClientRect().bottom ?? 80) + 10;
        const words = sec.querySelector(".ai-ch[data-on], .ai-how[data-on], .ai-say:not([inert])");
        const bottom = (words ? words.getBoundingClientRect().top : innerHeight * 0.55) - 18;
        const k = room.top < 0 ? 1 : 1 - Math.exp((-6 * Math.min(dtMs, 50)) / 1000);
        room.top += (top - room.top) * k;
        room.bottom += (bottom - room.bottom) * k;
        const height = Math.max(MIN_STAGE, room.bottom - room.top);
        st.style.top = `${room.top.toFixed(1)}px`;
        st.style.height = `${height.toFixed(1)}px`;
        // the panels are drawn to the stage's size
        el.style.setProperty("--ms", Math.min(0.6, height / 420).toFixed(3));
        f.lift = innerHeight / 2 - (room.top + height / 2);
        f.zoom = Math.min(1, Math.max(0.3, (height * 0.85) / (innerHeight * CHIP)));
        // the chip in the middle of the stage: close up to begin with, then the hub the network hangs off
        const cs = Math.min(innerWidth * 0.5, height * (sec.dataset.chapter === "core" ? 0.62 : 0.3));
        Object.assign(signals.aiChip, { x: innerWidth / 2, y: room.top + height / 2, size: cs / 2 });
        chip.current?.style.setProperty("--cs", `${cs.toFixed(1)}px`);
      } else if (room.top >= 0) {
        room.top = room.bottom = -1;
        st.style.top = st.style.height = "";
        el.style.removeProperty("--ms");
        f.lift = 0;
        f.zoom = 1;
      }
      const c = signals.aiChip, r = st.getBoundingClientRect();
      h.style.translate = `${(c.x - r.left).toFixed(1)}px ${(c.y - r.top).toFixed(1)}px`;
      const cp = chip.current?.offsetParent?.getBoundingClientRect();
      if (cp) chip.current!.style.translate = `${(c.x - cp.left).toFixed(1)}px ${(c.y - cp.top).toFixed(1)}px`;
      el.style.setProperty("--sx", `${(c.x - r.left - r.width / 2).toFixed(1)}px`);
      el.style.setProperty("--sy", `${(c.y - r.top - r.height / 2).toFixed(1)}px`);
      h.style.setProperty("--r", `${Math.max(24, c.size * 1.5).toFixed(1)}px`);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      signals.frame.ai.lift = 0;
      signals.frame.ai.zoom = 1;
    };
  }, [section]);

  const say = chapter === "what";
  return (
    <>
      {/* a phone's chip: beside the network, not in it, since it is up before the network is */}
      <div ref={chip} className="ain-chip" aria-hidden style={{ "--core": 0 } as React.CSSProperties}>
        {/* the board it sits on: lines out from its pins to the edges of the screen, lit as it powers up */}
        <div className="ain-board">
          {["l", "r"].map((side) => (
            <span key={side} className={`ain-board-${side}`}>
              <i />
              <i />
              <i />
            </span>
          ))}
        </div>
        <ChipArt />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/heart.png" alt="" />
      </div>
    <div
      ref={root}
      className="ain"
      data-tall={tall || undefined}
      style={{ "--dim": 0, "--map": 1, "--scan": 0, "--scanO": 0, "--v": 0, "--mx": 0, "--rk": 0, "--tl": 0, "--sm": 0 } as React.CSSProperties}
    >
      {/* the picture: on a portrait screen it is fitted into the room over the words */}
      <div ref={stage} className="ain-stage">
        <svg className="ain-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <g className="ain-map">
            <g className="ain-map-v">
              {map.lines.map((d) => (
                <path key={d} pathLength={1} d={d} />
              ))}
            </g>
          </g>
          {links.map((l) => (
            <path key={`l-${l.id}`} className="ain-link" pathLength={1} d={l.d} />
          ))}
          <g className="ain-flows">
            {links.map((l, i) => (
              <path key={`f-${l.id}`} pathLength={1} d={l.d} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </g>
          <g className="ain-thread">
            {thread.map((d) => (
              <path key={d} pathLength={1} d={d} />
            ))}
          </g>
          <g className="ain-thread-flow">
            {thread.map((d, i) => (
              <path key={d} pathLength={1} d={d} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </g>
        </svg>
        <div className="ain-faults" aria-hidden>
          {map.faults.map((f) => (
            <i key={`${f.x}-${f.y}`} style={{ "--x": f.x, "--y": f.y } as React.CSSProperties} />
          ))}
        </div>
        <div className="ain-scan" aria-hidden />

        {/* made simple: the two sides of the business, framed and named */}
        <div className="ain-groups" aria-hidden>
          {GROUPS.map((g) => (
            <div key={g.side} className={`ain-group is-${g.side}`} style={{ "--x0": g.x0, "--x1": g.x1 } as React.CSSProperties}>
              <p>
                <i /> {g.name}
              </p>
            </div>
          ))}
        </div>

        <div ref={hub} className="ain-hub" aria-hidden>
          <span className="ain-hub-label">
            DZ core <b>· online</b>
          </span>
        </div>

        <div className="ain-panels" aria-hidden>
          {ids.map((id) => {
            const P = places[id], F = found[id];
            const View = PANEL_VIEWS[id];
            return (
              <div
                key={id}
                className={`ain-panel ain-${id} is-${SIDE[id]}${id === "leads" ? " is-thread" : ""}`}
                data-id={id}
                style={{ "--cx": F.x, "--cy": F.y, "--cr": F.r, "--ox": P.x, "--oy": P.y, "--e": 0, "--k": 0, "--f": 0, "--a": 0 } as React.CSSProperties}
              >
                <p className="ain-tag">
                  <span className="is-find">{TAGS[id].find}</span>
                  <span className="is-done">{TAGS[id].done}</span>
                </p>
                <div className="ain-body">
                  <View />
                </div>
              </div>
            );
          })}
        </div>

        <div className="ain-matrix">
          <Matrix />
        </div>
      </div>

      <div className="ai-say" inert={!say}>
        <p className="ai-kicker ai-say-rest">What we do</p>
        <h3 className="ai-say-title" aria-label={HEADLINE.join(" ")}>
          {HEADLINE.map((line, l) => (
            <span key={l} className="ai-say-line" aria-hidden>
              {line.split(" ").map((w, i) => (
                <span key={i} className="ai-say-w">
                  <span>{w}</span>
                </span>
              ))}
            </span>
          ))}
        </h3>
        <p className="ai-say-body ai-say-rest">{BODY}</p>
        <ol className="ai-say-method ai-say-rest" aria-label="How we do it">
          {METHOD.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>
      </div>
    </div>
    </>
  );
}
