"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { useSection } from "@/components/home/useSection";
import { TRANSITIONS } from "@/lib/engine/ai/transition";

/* AI & Automation: not a seventh solution but its own world. Past the last billboard the page loses
   its signal and hands over — on the real pixels, in the engine (lib/engine/ai) — to an AI
   accelerator on its board, data pulsing out of the die along the traces. The scroll then flies the
   camera over it chapter by chapter while the HUD reads out what it's doing. Leaving hands back.
   Four hand-overs to choose from; the picker remembers yours. */
const CHAPTERS = [
  {
    no: "00",
    kicker: "Exclusive",
    title: "AI & Automation",
    line: "Agents, automations and custom AI tools, wired into the way your business already runs.",
    chips: ["Agents", "Workflows", "Integrations", "Custom tools"],
  },
  {
    no: "01",
    kicker: "Agents",
    title: "AI that does the work",
    line: "Agents that qualify leads, answer customers and research the market, around the clock and on brand.",
    chips: ["Lead scoring", "Support", "Research", "Sales follow-up"],
  },
  {
    no: "02",
    kicker: "Automation",
    title: "Workflows that never sleep",
    line: "The busywork between your tools — invoices, reports, reminders, hand-offs — done the moment it's due.",
    chips: ["Invoicing", "Reporting", "Onboarding", "Scheduling"],
  },
  {
    no: "03",
    kicker: "Integrations",
    title: "One brain across your stack",
    line: "WhatsApp to CRM, Shopify to Sheets, inbox to ERP: your systems talking to each other, with AI in between.",
    chips: ["WhatsApp", "Shopify", "HubSpot", "Google Workspace"],
  },
  {
    no: "04",
    kicker: "Build",
    title: "Custom AI, built for you",
    line: "Internal tools and AI products designed, built and shipped by the team that runs your brand.",
    chips: [],
    cta: true,
  },
];

const LOG = [
  "agent:leads    scored 142 new leads → 38 hot → pushed to CRM",
  "flow:invoice   12 invoices reconciled · ₹4,82,300 matched",
  "agent:support  resolved 64 / 71 tickets without a human",
  "sync           shopify ⇄ sheets · 1,204 rows · 0 conflicts",
  "whatsapp       311 follow-ups sent · 27 replies routed to sales",
  "report         weekly deck generated → founders@",
  "model:dz-a1    eval 0.931 ↑ · latency 212ms",
  "flow:onboard   new client workspace provisioned in 41s",
  "agent:research competitor pricing refreshed · 9 changes",
  "cron           03:00 IST backups verified ✓",
];
const BOOT = [
  "DZ-OS 4.2 · neural accelerator DZ-A1",
  "POST ........................ ok",
  "HBM3 6 × 24GB ............... ok",
  "loading agents .............. 12/12",
  "linking integrations ........ 9/9",
  "handing over ▌",
];
const pad = (n: number) => String(n).padStart(2, "0");
const KEY = "dz-ai-transition";

export function AiAutomation() {
  const section = useRef<HTMLElement>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const [mode, setMode] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState<{ id: number; text: string }[]>([]);
  const [metrics, setMetrics] = useState({ tps: 18420, tasks: 12840, hours: 3120 });
  const reduce = useStore((s) => s.reducedMotion);
  const set = useStore((s) => s.set);
  const boot = useRef<HTMLDivElement>(null);
  useSection(section, "ai");

  // the hand-over, played in time rather than scrubbed: once it starts, it runs
  const play = (to: 0 | 1) => {
    tween.current?.kill();
    const ai = signals.ai;
    const T = TRANSITIONS[ai.mode] ?? TRANSITIONS[0];
    const dist = Math.abs(to - ai.mix);
    if (reduce) {
      ai.mix = to;
      return;
    }
    tween.current = gsap.to(ai, { mix: to, duration: T.duration * dist, ease: ai.mode === 1 ? "power1.inOut" : "none" });
  };

  useEffect(() => {
    // which hand-over: ?t=1..4, else the last one picked
    let m = 0;
    try {
      const q = Number(new URLSearchParams(location.search).get("t"));
      m = q >= 1 && q <= TRANSITIONS.length ? q - 1 : Number(localStorage.getItem(KEY) ?? 0) || 0;
    } catch {}
    signals.ai.mode = m;
    setMode(m);
  }, []);

  useEffect(() => {
    const el = section.current!;
    const sts = [
      // build the world well before it's needed, so the hand-over doesn't hitch
      ScrollTrigger.create({ trigger: el, start: "top bottom+=250%", onEnter: () => (signals.ai.warm = true) }),
      ScrollTrigger.create({
        trigger: el,
        start: "top 60%",
        onEnter: () => play(1),
        onLeaveBack: () => play(0),
      }),
      ScrollTrigger.create({
        trigger: el,
        start: "bottom bottom",
        onEnter: () => play(0),
        onLeaveBack: () => play(1),
      }),
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          signals.ai.p = self.progress;
          setChapter(Math.min(CHAPTERS.length - 1, Math.round(self.progress * (CHAPTERS.length - 1))));
        },
      }),
    ];
    if (sts[0].isActive || el.getBoundingClientRect().top < innerHeight * 3.5) signals.ai.warm = true;
    // arriving mid-section (a reload, the menu): be there already
    if (sts[1].progress > 0 && !sts[2].progress) signals.ai.mix = 1;
    return () => sts.forEach((s) => s.kill());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the page itself glitches while the hand-over runs; the HUD comes up once the world is there
  useEffect(() => {
    let last = -1;
    const root = document.documentElement;
    const tick = () => {
      const m = signals.ai.mix;
      const shifting = m > 0.001 && m < 0.999;
      root.classList.toggle("ai-shifting", shifting);
      if (shifting && signals.ai.mode !== 1) {
        root.style.setProperty("--ai-jx", `${((Math.random() - 0.5) * 24 * Math.sin(Math.PI * m)).toFixed(1)}px`);
        root.style.setProperty("--ai-cl", `${(Math.random() * 60).toFixed(0)}%`);
      }
      const nowOn = m > 0.85;
      if (nowOn !== (last === 1)) {
        last = nowOn ? 1 : 0;
        setOn(nowOn);
      }
      // the CRT's boot log, in the dark between power-off and power-on
      boot.current?.classList.toggle("is-on", signals.ai.mode === 3 && m > 0.34 && m < 0.6);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      root.classList.remove("ai-shifting");
    };
  }, []);

  // the live log and the counters
  useEffect(() => {
    if (!on) return;
    let i = 0;
    const stamp = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });
    setLines(LOG.slice(0, 5).map((l, k) => ({ id: k, text: `${stamp()}  ${l}` })));
    i = 5;
    const a = setInterval(() => {
      const k = i++;
      setLines((ls) => [...ls.slice(-7), { id: k, text: `${stamp()}  ${LOG[k % LOG.length]}` }]);
    }, 1400);
    const b = setInterval(() => {
      setMetrics((mm) => ({
        tps: 17000 + Math.round(Math.random() * 3400),
        tasks: mm.tasks + Math.round(Math.random() * 4),
        hours: mm.hours + (Math.random() < 0.2 ? 1 : 0),
      }));
    }, 450);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [on]);

  const pick = (m: number) => {
    signals.ai.mode = m;
    setMode(m);
    try {
      localStorage.setItem(KEY, String(m));
    } catch {}
    // show it: run the hand-over again from the city
    tween.current?.kill();
    signals.ai.mix = 0;
    play(1);
  };

  const openProjects = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    signals.macFrom = { x: r.left, y: r.top, w: r.width, h: r.height };
    set({ macOpen: true });
  };

  return (
    <section ref={section} id="ai" className={`ai${on ? " is-on" : ""}`} aria-labelledby="ai-title" style={{ height: "560svh" }}>
      <div className="ai-pin">
        <div ref={boot} className="ai-boot" aria-hidden>
          {BOOT.map((l, i) => (
            <p key={i} style={{ "--i": i } as React.CSSProperties}>
              {l}
            </p>
          ))}
        </div>

        <div className="ai-hud">
          <p className="ai-tag">
            <span className="hud-no">AI</span> Dizrupt · Neural systems
            <span className="ai-live">
              <i /> live
            </span>
          </p>

          <div className="ai-chapters">
            {CHAPTERS.map((c, i) => (
              <article key={c.no} className="ai-ch" data-on={i === chapter || undefined} aria-hidden={i !== chapter}>
                <p className="ai-kicker">
                  <span>{c.no}</span> {c.kicker}
                </p>
                {i === 0 ? (
                  <h2 id="ai-title" className="ai-title">
                    {c.title}
                  </h2>
                ) : (
                  <h3 className="ai-title">{c.title}</h3>
                )}
                <p className="ai-line">{c.line}</p>
                {c.chips.length > 0 && (
                  <ul className="ai-chips">
                    {c.chips.map((ch) => (
                      <li key={ch}>{ch}</li>
                    ))}
                  </ul>
                )}
                {c.cta && (
                  <button type="button" className="ai-cta" onClick={openProjects} tabIndex={i === chapter ? 0 : -1}>
                    <span>Open the projects</span>
                    <span aria-hidden>→</span>
                  </button>
                )}
              </article>
            ))}
          </div>

          <aside className="ai-term" aria-label="Live activity">
            <p className="ai-term-head">
              <span>~/dizrupt/agents</span> <span>tail -f activity.log</span>
            </p>
            <ol>
              {lines.map((l) => (
                <li key={l.id}>{l.text}</li>
              ))}
            </ol>
          </aside>

          <dl className="ai-metrics">
            <div>
              <dt>Tokens / s</dt>
              <dd>{metrics.tps.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt>Tasks automated</dt>
              <dd>{metrics.tasks.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt>Hours saved</dt>
              <dd>{metrics.hours.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt>Uptime</dt>
              <dd>99.98%</dd>
            </div>
          </dl>

          <ol className="ai-steps" aria-hidden>
            {CHAPTERS.map((c, i) => (
              <li key={c.no} data-on={i === chapter || undefined}>
                {c.no}
              </li>
            ))}
          </ol>
        </div>

        <div className="ai-picker" role="group" aria-label="Transition">
          <span className="ai-picker-label">Transition</span>
          {TRANSITIONS.map((t, i) => (
            <button key={t.id} type="button" aria-pressed={mode === i} onClick={() => pick(i)}>
              <span>{pad(i + 1)}</span> {t.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
