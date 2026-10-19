"use client";

import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { AI_CHAPTERS, AI_EXIT_FROM, AI_STOPS } from "@/lib/aiStops";
import { PANEL_VIEWS } from "@/components/home/ai/Panels";
import { Matrix } from "@/components/home/ai/Matrix";
import { GROUPS, linksFor, mapFor, panelsFor, placesFor, scanSpan, threadFor, SIDE, type PanelId } from "@/components/home/ai/layout";

const [, WHAT, HOW, SIMPLE] = AI_STOPS;
/** Seconds the animation takes per unit of the section's 0..1, where a beat doesn't set its own. */
const PACE = 20;
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
  leads: { find: "WF-01 · Enquiry → lead", done: "WF-01 · Running" },
  messages: { find: "Replies wait", done: "Drafted · you approve" },
  sheet: { find: "Re-keyed · duplicates", done: "Synced" },
  invoices: { find: "Chased by hand", done: "Exceptions to a person" },
  report: { find: "Built by hand", done: "Builds itself" },
  tasks: { find: "Repetitive", done: "Handled" },
};

/* The order each panel's own work is done once it's connected: the inbox triaged first, the report
   last, because it's built from the rest. */
const DONE: PanelId[] = ["inbox", "leads", "messages", "sheet", "invoices", "tasks", "report"];

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
   three stages is up is written onto the section (--h0..--h2) for it to follow. */
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
  const stage = useRef<HTMLDivElement>(null);
  const tall = useTall();
  const places = placesFor(tall);
  const ids = panelsFor(tall);
  const links = linksFor(tall);
  const map = mapFor(tall);
  const thread = threadFor(tall);

  useEffect(() => {
    const el = root.current!, sec = section.current!;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const panels = q<HTMLElement>(".ain-panel");
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
      // each beat is placed as a fraction of the ride it plays in, so the stops can move
      const g1 = WHAT, g2 = HOW - WHAT, g3 = SIMPLE - HOW;
      const in1 = (f: number) => g1 * f, in2 = (f: number) => WHAT + g2 * f, in3 = (f: number) => HOW + g3 * f;
      const hide = { strokeDashoffset: 1, autoAlpha: 0 }, draw = { strokeDashoffset: 0, autoAlpha: 1 };

      // What we do: said plainly beside the chip as it powers on and steps aside, a line at a time
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: g1 * 0.1 }, in1(0.55));
      tl.fromTo(q(".ai-say-w > span"), { yPercent: 110 }, { yPercent: 0, duration: g1 * 0.2, stagger: g1 * 0.02, ease: "power3.out" }, in1(0.62));
      tl.fromTo(q(".ai-say-rest"), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: g1 * 0.2, stagger: g1 * 0.05, ease: "power2.out" }, in1(0.72));

      /* How we do it, one stage after another on one gesture: the statement makes way and the business
         comes up round the core */
      tl.to(q(".ai-say"), { autoAlpha: 0, y: -24, duration: g2 * 0.05 }, in2(0));
      tl.fromTo(hub.current, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: g2 * 0.06, ease: "power2.out" }, in2(0.02));
      panels.forEach((p, i) => tl.fromTo(p, { "--e": 0 }, { "--e": 1, duration: g2 * 0.08, ease: "power2.out" }, in2(0.05 + i * 0.012)));
      // which stage the text is on
      tl.fromTo(sec, { "--h0": 0 }, { "--h0": 1, duration: g2 * 0.04 }, in2(0.04));
      tl.to(sec, { "--h0": 0, duration: g2 * 0.04 }, in2(0.36));
      tl.fromTo(sec, { "--h1": 0 }, { "--h1": 1, duration: g2 * 0.04 }, in2(0.36));
      tl.to(sec, { "--h1": 0, duration: g2 * 0.04 }, in2(0.66));
      tl.fromTo(sec, { "--h2": 0 }, { "--h2": 1, duration: g2 * 0.04 }, in2(0.66));

      // 01 Audit: a scan sweeps it and flags each panel as it passes; the hand-offs are traced, and where they break
      const span = scanSpan(tall);
      tl.fromTo(el, { "--scanO": 0 }, { "--scanO": 1, duration: g2 * 0.02 }, in2(0.12));
      tl.fromTo(el, { "--scan": 0 }, { "--scan": 1, duration: g2 * 0.18, ease: "power1.inOut" }, in2(0.13));
      tl.to(el, { "--scanO": 0, duration: g2 * 0.02 }, in2(0.31));
      panels.forEach((p) => {
        const at = (places[p.dataset.id as PanelId].x - span.from) / (span.to - span.from);
        tl.fromTo(p, { "--f": 0 }, { "--f": 1, duration: g2 * 0.03 }, in2(0.13 + 0.18 * Math.min(1, Math.max(0, at))));
      });
      tl.fromTo(q(".ain-map path"), hide, { ...draw, duration: g2 * 0.06, stagger: g2 * 0.012 }, in2(0.17));
      tl.fromTo(q(".ain-faults"), { autoAlpha: 0 }, { autoAlpha: 1, duration: g2 * 0.03 }, in2(0.27));
      tl.fromTo(q(".ain-thread path"), hide, { ...draw, duration: g2 * 0.05, stagger: g2 * 0.02 }, in2(0.29));

      // 02 Evaluate: the map steps back and the report rises over it; the workflows settle into their ranking
      tl.fromTo(el, { "--v": 0 }, { "--v": 1, duration: g2 * 0.07, ease: "power2.inOut" }, in2(0.37));
      tl.fromTo(el, { "--mx": 0 }, { "--mx": 1, duration: g2 * 0.07, ease: "power2.out" }, in2(0.4));
      q<HTMLElement>(".aim-row").forEach((r) => {
        const found = Number(r.style.getPropertyValue("--from")) || 0;
        tl.fromTo(r, { "--in": 0 }, { "--in": 1, duration: g2 * 0.04, ease: "power2.out" }, in2(0.44 + found * 0.012));
        tl.fromTo(r, { "--m": 0 }, { "--m": 1, duration: g2 * 0.06 }, in2(0.46 + found * 0.012));
      });
      tl.fromTo(el, { "--rk": 0 }, { "--rk": 1, duration: g2 * 0.08, ease: "power2.inOut" }, in2(0.56));

      // 03 Implement: the report gives way, the workflows worth it are wired to the core and set running
      tl.to(el, { "--mx": 0, duration: g2 * 0.05, ease: "power2.in" }, in2(0.66));
      tl.to(el, { "--v": 0, duration: g2 * 0.07, ease: "power2.inOut" }, in2(0.69));
      tl.to(q(".ain-map, .ain-faults"), { autoAlpha: 0, duration: g2 * 0.04 }, in2(0.72));
      tl.fromTo(q(".ain-link"), hide, { ...draw, duration: g2 * 0.06, stagger: g2 * 0.01 }, in2(0.74));
      tl.fromTo(hub.current, { "--live": 0 }, { "--live": 1, duration: g2 * 0.04 }, in2(0.78));
      tl.fromTo(el, { "--tl": 0 }, { "--tl": 1, duration: g2 * 0.04 }, in2(0.8));
      tl.fromTo(q(".ain-flows"), { autoAlpha: 0 }, { autoAlpha: 1, duration: g2 * 0.03 }, in2(0.83));
      panels.forEach((p) => tl.fromTo(p, { "--a": 0 }, { "--a": 1, duration: g2 * 0.04 }, in2(0.8 + DONE.indexOf(p.dataset.id as PanelId) * 0.022)));

      // Made simple: the stages' tags give way to the two sides, framed and named, running
      tl.fromTo(el, { "--sm": 0 }, { "--sm": 1, duration: g3 * 0.35, ease: "power2.inOut" }, in3(0.1));

      // and all of it gives way, as the hand-back to the work begins
      tl.to(el, { autoAlpha: 0, duration: 0.05 }, AI_EXIT_FROM + 0.01);
      tl.set({}, {}, 1);
      /* Not scrubbed: the scroll picks the beat, and the animation plays there in time, at its own
         pace, however far or fast the scroll went. A nudge past a beat plays the whole of the next
         one; back past it, the same in reverse. Past the last it hands over to the scroll again:
         the way out to the work is a ride at its own pace already (lib/stops.ts). The AI world reads
         the same clock (signals.ai.play), so the chip and the camera keep in step with the page. */
      const head = { t: 0 };
      let k = 0, lastP = 0, tw: gsap.core.Timeline | null = null;
      let held = false; // parked on a step that was picked, not on the beat: the scroll leaves it be until it moves on
      const S = AI_STOPS, n = S.length;
      const apply = () => {
        tl.time(head.t);
        signals.ai.play = head.t;
      };
      /* to beat `to`, through every beat on the way, each at its own pace; a beat that holds is held
         a moment on the way through, so it reads */
      // quick: leaving a picked step, the first leg (the rest of how we do it, played already) goes by quickly
      const playTo = (to: number, quick = false) => {
        tw?.kill();
        if (reduceRef.current) {
          head.t = S[to];
          apply();
          return onBeatRef.current(to);
        }
        const fwd = S[to] >= head.t;
        const legs: number[] = [];
        if (fwd) for (let i = 0; i <= to; i++) { if (S[i] > head.t + 1e-4) legs.push(i); }
        else for (let i = n - 1; i >= to; i--) { if (S[i] < head.t - 1e-4) legs.push(i); }
        if (!legs.length) legs.push(to);
        const seq = gsap.timeline({ onUpdate: apply });
        let from = head.t;
        legs.forEach((i, j) => {
          seq.call(() => onBeatRef.current(i));
          // a beat's own length is for the whole ride into it (or back out of it): from partway, that part
          const leg = fwd ? AI_CHAPTERS[i] : AI_CHAPTERS[i + 1];
          const whole = fwd ? S[i] - (S[i - 1] ?? 0) : (S[i + 1] ?? 1) - S[i];
          const part = Math.min(1, Math.abs(S[i] - from) / Math.max(1e-4, whole));
          const dur = leg?.len ? leg.len * part : Math.abs(S[i] - from) * PACE;
          seq.to(head, { t: S[i], duration: Math.max(0.6, quick && j === 0 ? Math.min(dur, 1.2) : dur), ease: "power1.inOut" });
          const hold = AI_CHAPTERS[i].hold;
          if (fwd && hold && j < legs.length - 1) seq.to({}, { duration: hold });
          from = S[i];
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
          held = false;
          head.t = p > SIMPLE ? Math.min(1, p) : S[k];
          apply();
          if (k !== last) onBeatRef.current(k);
          return;
        }
        const quick = held && k !== last;
        if (k !== last) held = false;
        if (k !== last || (!held && !tw?.isActive() && head.t !== S[k])) playTo(k, quick);
      };
      /* a step of how we do it, picked from the text: the network goes there (forward or back), at a
         quicker pace than it plays on its own, and holds there until the scroll moves on. Each step's
         place is where its picture is complete, just before the next begins. */
      const STEP_AT = [0.345, 0.645, 1].map((f) => WHAT + (HOW - WHAT) * f);
      seek.current = (i: number) => {
        if (k !== AI_STOPS.indexOf(HOW)) return;
        tw?.kill();
        held = true;
        const to = STEP_AT[i];
        if (reduceRef.current) {
          head.t = to;
          return apply();
        }
        const len = AI_CHAPTERS[AI_STOPS.indexOf(HOW)].len ?? 8;
        const dur = Math.max(0.8, (Math.abs(to - head.t) / (HOW - WHAT)) * len * 0.55);
        tw = gsap.timeline({ onUpdate: apply }).to(head, { t: to, duration: dur, ease: "power2.inOut" });
      };
      const st = ScrollTrigger.create({ trigger: sec, start: "top top", end: "bottom bottom", onUpdate: (self) => step(self.progress) });
      // while a beat plays, the scroll waits for it (SmoothScroll.tsx)
      const busy = () => void (signals.busy.ai = !!tw?.isActive());
      gsap.ticker.add(busy);
      // arriving partway (a reload, the nav): be at the beat already, without playing up to it
      {
        const p = (lastP = st.progress);
        while (k < AI_STOPS.length - 1 && p >= AI_STOPS[k + 1] - NUDGE * (AI_STOPS[k + 1] - AI_STOPS[k])) k++;
        head.t = p > SIMPLE ? Math.min(1, p) : AI_STOPS[k];
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
  }, [section, tall, places, seek]);

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
      } else if (room.top >= 0) {
        room.top = room.bottom = -1;
        st.style.top = st.style.height = "";
        el.style.removeProperty("--ms");
        f.lift = 0;
        f.zoom = 1;
      }
      const c = signals.aiChip, r = st.getBoundingClientRect();
      h.style.translate = `${(c.x - r.left).toFixed(1)}px ${(c.y - r.top).toFixed(1)}px`;
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
            const P = places[id];
            const View = PANEL_VIEWS[id];
            return (
              <div
                key={id}
                className={`ain-panel ain-${id} is-${SIDE[id]}${id === "leads" ? " is-thread" : ""}`}
                data-id={id}
                style={{ "--cx": P.x, "--cy": P.y, "--cr": 0, "--ox": P.x, "--oy": P.y, "--e": 0, "--k": 0, "--f": 0, "--a": 0 } as React.CSSProperties}
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
        <p className="ai-kicker ai-say-rest">
          <span>01</span> What we do
        </p>
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
          {METHOD.map((m, i) => (
            <li key={m}>
              <span>{String(i + 1).padStart(2, "0")}</span> {m}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
