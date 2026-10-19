"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { site } from "@/content/site";
import { useSection } from "@/components/home/useSection";
import { T } from "@/lib/motion";

/* The landing. One pinned stretch of scroll, read in beats:
     landing  DIZRUPT on black; the Z keeps losing the signal; the cursor opens a hole in the black
     reveal   the camera pulls back: the landing was a billboard, on a tower, in a city of light,
              and he stands on a plinth in the middle of it, lit by a beam as you arrive
     stats    he flexes; the count arrives at his corners, each label decoding out of another tongue
     profile  he turns side on and the line stands in the space he leaves
   Scroll back and every beat runs backwards. */
const WORD = ["D", "I", "Z", "R", "U", "P", "T"];
const BEATS = { reveal: 0.015, stats: 0.5, profile: 0.76 };
const HOLE = 280; // px, the radius the cursor opens in the black

const STAT_TONGUES: Record<string, { text: string; latin: boolean }[]> = {
  "founded in": [
    { text: "स्थापना", latin: false }, { text: "تأسست", latin: false }, { text: "ก่อตั้ง", latin: false },
    { text: "成立于", latin: false }, { text: "opgericht in", latin: true }, { text: "fondée en", latin: true },
  ],
  solutions: [
    { text: "समाधान", latin: false }, { text: "حلول", latin: false }, { text: "โซลูชัน", latin: false },
    { text: "解决方案", latin: false }, { text: "oplossingen", latin: true }, { text: "izixazululo", latin: true },
  ],
  countries: [
    { text: "देश", latin: false }, { text: "دول", latin: false }, { text: "ประเทศ", latin: false },
    { text: "国家", latin: false }, { text: "landen", latin: true }, { text: "amazwe", latin: true },
  ],
  clients: [
    { text: "ग्राहक", latin: false }, { text: "عملاء", latin: false }, { text: "ลูกค้า", latin: false },
    { text: "客户", latin: false }, { text: "klanten", latin: true }, { text: "amakhasimende", latin: true },
  ],
};
// where each number is, as a place for him to look (the cursor's own left-right, up-down)
const STAT_CORNER: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]]; // he is the windows now; nothing to look at
// the numbers come up one after another, three staggers apart, all four read inside a ui reveal's time
const STAT_STEP = T.stagger * 3 * 1000;
// (glitch timings, the count's own: he glances at a number as it lands, its label faults into another
// language a moment later)
const STAT_LOOK = 160;
const STAT_TONGUE = 560;
const ENCODE = "0123456789ABCDEF";
const r = (a: number, b: number) => a + Math.random() * (b - a);

export function Intro() {
  const section = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLHeadingElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const staticCanvas = useRef<HTMLCanvasElement>(null);
  const stats = useRef<HTMLDListElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const loaded = useStore((s) => s.loaded);
  const reduce = useStore((s) => s.reducedMotion);
  const set = useStore((s) => s.set);
  useSection(section, "intro");

  /* ---- the count to 100 while the scene is built ---- */
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = () => {
      const t = Math.min((performance.now() - start) / 1600, 1); // (the loader's own count: 1.6 s at least, longer if the scene isn't ready)
      if (meter.current) meter.current.textContent = String(Math.round((1 - (1 - t) ** 3) * 100));
      if (t < 1 || !signals.ready) raf = requestAnimationFrame(step);
      else set({ loaded: true });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [set]);

  useEffect(() => {
    if (loaded) word.current?.classList.add("in");
    wrap.current?.classList.toggle("ready", loaded);
  }, [loaded]);

  /* ---- the beats ---- */
  useEffect(() => {
    const el = wrap.current!;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const clearTimers = () => timers.splice(0).forEach(clearTimeout);
    let beat: typeof signals.introBeat = "landing";
    let zTimer = 0;
    let firstZ = true;

    // the snow over the black
    let snow: { start(): void; stop(): void } | null = null;
    import("@/lib/engine/staticNoise").then(({ createStatic }) => {
      if (!staticCanvas.current) return;
      snow = createStatic(staticCanvas.current);
      if (beat === "landing") snow?.start();
    });

    /* The Z loses the signal now and then: every number rolled fresh, so no two faults repeat. */
    const glitchZ = () => {
      const mask = word.current?.querySelector<HTMLElement>(".char-mask.flip");
      const ch = mask?.querySelector<HTMLElement>(".char");
      if (!mask || !ch || beat !== "landing") return;
      const steps = 4 + ((Math.random() * 4) | 0);
      mask.classList.add("glitch");
      const channel = (key: string, spread: number) => {
        const top = r(0, 58);
        ch.style.setProperty(`--${key}-x`, `${r(-spread, spread).toFixed(1)}px`);
        ch.style.setProperty(`--${key}-y`, `${r(-9, 9).toFixed(1)}px`);
        ch.style.setProperty(`--${key}-o`, Math.random() < 0.18 ? "0" : r(0.6, 1).toFixed(2));
        ch.style.setProperty(`--${key}-clip`, Math.random() < 0.45 ? `inset(${top.toFixed(0)}% 0 ${r(0, 88 - top).toFixed(0)}% 0)` : "none");
      };
      const settle = () => {
        mask.classList.remove("glitch");
        mask.style.transform = "";
        mask.style.clipPath = "";
        ["r", "g", "b"].forEach((k) => ["x", "y", "o", "clip"].forEach((p) => ch.style.removeProperty(`--${k}-${p}`)));
        // the first torn Z resolves into the brand violet
        if (firstZ) {
          firstZ = false;
          word.current?.classList.add("brand-purple");
        }
      };
      const step = (n: number) => {
        if (n >= steps || beat !== "landing") return settle();
        const spread = r(11, 44);
        channel("r", spread);
        channel("g", spread * r(0.35, 1));
        channel("b", spread * r(0.6, 1.25));
        mask.style.transform = `scaleX(-1) translate(${r(-18, 18).toFixed(1)}px, ${r(-7, 7).toFixed(1)}px)`;
        mask.style.clipPath = Math.random() < 0.32 ? `inset(${r(0, 56).toFixed(0)}% 0 ${r(0, 40).toFixed(0)}% 0)` : "none";
        setTimeout(() => step(n + 1), r(36, 96));
      };
      step(0);
    };
    const scheduleZ = () => {
      clearTimeout(zTimer);
      if (reduce) return;
      zTimer = window.setTimeout(() => {
        if (beat === "landing" && useStore.getState().loaded) glitchZ();
        scheduleZ();
      }, 700 + Math.random() * 800);
    };
    scheduleZ();

    const restoreWord = () => {
      word.current?.parentElement?.querySelectorAll(".intro-word-shard").forEach((n) => n.remove());
      if (word.current) word.current.style.opacity = "";
    };

    /* ---- the count ---- */
    const cells = () => [...(stats.current?.querySelectorAll<HTMLElement>(".stat") ?? [])];
    const statText = (lab: HTMLElement, text: string, foreign: boolean | null = null) => {
      lab.innerHTML = `<i class="stat-mark">//</i>${text}`;
      lab.dataset.text = `//${text}`;
      if (foreign !== null) lab.classList.toggle("is-foreign", foreign);
    };
    const drawStat = (n: HTMLElement, text: string) => {
      n.innerHTML = `<i class="stat-key">${n.dataset.key}</i>${text}`;
      n.dataset.text = text; // the key sits above, out of the line, so the ghosts carry the number only
    };
    const realValue = (n: HTMLElement) => `${n.dataset.to}${n.dataset.suffix ?? ""}`;
    const encode = (n: HTMLElement) => {
      delete n.dataset.resolved;
      const width = realValue(n).length;
      const scramble = () => {
        if (n.dataset.resolved === "1" || beat !== "stats") return;
        drawStat(n, Array.from({ length: width }, () => ENCODE[(Math.random() * 16) | 0]).join(""));
        later(65 + Math.random() * 50, scramble); // (ambient: the digits churn until each resolves)
      };
      scramble();
    };
    const resolve = (n: HTMLElement) => {
      n.dataset.resolved = "1";
      drawStat(n, realValue(n));
    };
    // one burst of broken signal on a stat; with `to`, its label changes language inside the fault
    const fault = (cell: HTMLElement, ms: number, to: string | null = null) => {
      const n = cell.querySelector<HTMLElement>(".stat-n")!;
      const lab = cell.querySelector<HTMLElement>(".stat-l")!;
      if (reduce) return void (to && (statText(lab, to, false), resolve(n)));
      const t0 = performance.now();
      let swapped = !to;
      cell.classList.add("faulting");
      const clear = () => {
        if (to && !swapped) {
          statText(lab, to, false);
          resolve(n);
        }
        cell.classList.remove("faulting");
        cell.style.removeProperty("--slip");
        cell.style.removeProperty("clip-path");
        for (const e of [n, lab]) for (const k of ["r", "b"]) for (const p of ["x", "y", "o", "clip"]) e.style.removeProperty(`--${k}-${p}`);
      };
      const channel = (e: HTMLElement, k: string, spread: number) => {
        const top = r(0, 58);
        e.style.setProperty(`--${k}-x`, `${r(-spread, spread).toFixed(1)}px`);
        e.style.setProperty(`--${k}-y`, `${r(-7, 7).toFixed(1)}px`);
        e.style.setProperty(`--${k}-o`, Math.random() < 0.2 ? "0" : r(0.7, 1).toFixed(2));
        e.style.setProperty(`--${k}-clip`, Math.random() < 0.55 ? `inset(${top.toFixed(0)}% 0 ${r(0, 88 - top).toFixed(0)}% 0)` : "none");
      };
      const step = () => {
        const t = (performance.now() - t0) / ms;
        if (t >= 1) return clear();
        if (!swapped && t > 0.45) {
          swapped = true;
          statText(lab, to!, false);
          resolve(n);
        }
        const force = 1 - t * 0.55;
        const spread = r(9, 32) * force;
        channel(n, "r", spread);
        channel(n, "b", spread * r(0.6, 1.3));
        channel(lab, "r", spread * 0.8);
        channel(lab, "b", spread * r(0.5, 1.2));
        cell.style.setProperty("--slip", `${(r(-16, 16) * force).toFixed(1)}px`);
        cell.style.clipPath = Math.random() < 0.38 ? `inset(${r(0, 52).toFixed(0)}% 0 ${r(0, 40).toFixed(0)}% 0)` : "none";
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const revealStats = () => {
      cells().forEach((cell, i) => {
        cell.classList.remove("is-in");
        const lab = cell.querySelector<HTMLElement>(".stat-l")!;
        const english = lab.dataset.english!;
        const tongues = STAT_TONGUES[english] ?? [];
        const pick = tongues[(Math.random() * tongues.length) | 0];
        statText(lab, pick ? pick.text : english, pick ? !pick.latin : false);
        const at = i * STAT_STEP;
        later(at, () => (cell.classList.add("is-in"), encode(cell.querySelector<HTMLElement>(".stat-n")!)));
        later(at + STAT_LOOK, () => (signals.glance = STAT_CORNER[i]));
        later(at + STAT_TONGUE, () => fault(cell, 260 + Math.random() * 120, english));
      });
      later(cells().length * STAT_STEP + 620, () => (signals.glance = null));
      const idle = () =>
        later(2200 + Math.random() * 3400, () => { // (ambient: a fault now and then while the count is up)
          if (beat !== "stats") return;
          const c = cells();
          fault(c[(Math.random() * c.length) | 0], 110 + Math.random() * 120);
          idle();
        });
      idle();
    };
    const resetStats = () => {
      cells().forEach((cell) => {
        cell.classList.remove("is-in", "faulting");
        const n = cell.querySelector<HTMLElement>(".stat-n")!;
        n.dataset.resolved = "1";
      });
      signals.glance = null;
    };

    const setBeat = (next: typeof beat) => {
      if (next === beat) return;
      const prev = beat;
      beat = next;
      signals.introBeat = next;
      el.classList.toggle("sweeping", next !== "landing");
      el.classList.toggle("stats-in", next === "stats");
      el.classList.toggle("profile-in", next === "profile");
      // the page hands over to the billboard, which looks exactly like it, so it simply goes
      if (prev === "landing") snow?.stop();
      if (next === "landing") {
        restoreWord();
        snow?.start();
        scheduleZ();
      }
      if (prev === "stats") {
        clearTimers();
        resetStats();
      }
      if (next === "stats") revealStats();
    };

    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        /* the scroll, reshaped: everything up to the count as it was, then less of a wait on the
           count (0.5 → 0.76) and on the station (0.76 → 1), so the train sets off sooner */
        const r = self.progress;
        const p = r < 0.675 ? (r / 0.675) * 0.5 : r < 0.825 ? 0.5 + ((r - 0.675) / 0.15) * 0.26 : 0.76 + ((r - 0.825) / 0.175) * 0.24;
        signals.scroll.intro = p;
        // the last line fades before the train sets off
        el.style.setProperty('--profile-out', String(1 - Math.min(1, Math.max(0, (p - 0.93) / 0.06))));
        setBeat(p < BEATS.reveal ? "landing" : p < BEATS.stats ? "reveal" : p < BEATS.profile ? "stats" : "profile");
      },
    });

    // the hole in the black trails the cursor, and opens only once there is one to follow
    const spot = { x: innerWidth / 2, y: innerHeight / 2, r: 0 };
    let lastMask = "";
    const tick = (_: number, dtMs: number) => {
      const dt = Math.min(dtMs, 50) / 1000;
      const p = signals.pointer;
      spot.x += (p.px - spot.x) * (1 - Math.exp(-11 * dt));
      spot.y += (p.py - spot.y) * (1 - Math.exp(-11 * dt));
      spot.r += ((p.active && beat === "landing" && useStore.getState().loaded ? HOLE : 0) - spot.r) * (1 - Math.exp(-4 * dt));
      const mask = `radial-gradient(circle ${spot.r.toFixed(0)}px at ${spot.x.toFixed(0)}px ${spot.y.toFixed(0)}px, transparent 0%, rgba(0,0,0,0.5) 42%, #000 76%)`;
      if (mask !== lastMask && veil.current) {
        lastMask = mask;
        veil.current.style.webkitMaskImage = mask;
        veil.current.style.maskImage = mask;
      }
    };
    gsap.ticker.add(tick);
    // each number sits in its own window: the engine says where those are on screen
    const placeStats = () => {
      if (beat !== "stats") return;
      cells().forEach((cell, i) => {
        const r = signals.statWindows[i];
        if (!r || r.w < 10) return;
        // tilted with its window
        cell.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px) perspective(900px) rotateY(${r.yaw.toFixed(3)}rad) rotateX(${(-r.pitch).toFixed(3)}rad)`;
        cell.style.width = `${r.w.toFixed(1)}px`;
        cell.style.height = `${r.h.toFixed(1)}px`;
      });
    };
    gsap.ticker.add(placeStats);

    return () => {
      gsap.ticker.remove(placeStats);
      st.kill();
      gsap.ticker.remove(tick);
      clearTimers();
      clearTimeout(zTimer);
      snow?.stop();
    };
  }, [reduce]);

  return (
    <section ref={section} id="intro" aria-label="Dizrupt">
      <div ref={wrap} className="intro-pin">
        <div ref={veil} className="intro-veil" />
        <canvas ref={staticCanvas} className="intro-static" aria-hidden />
        <div className="intro-inner">
          <h1 ref={word} id="intro-word" aria-label="Dizrupt">
            {WORD.map((l, i) => (
              <span key={i} className={`char-mask${l === "Z" ? " flip" : ""}`} aria-hidden>
                <span className="char" data-char={l} style={{ "--i": i } as React.CSSProperties}>
                  {l}
                  {l === "Z" && <span className="z-ghost" aria-hidden />}
                </span>
              </span>
            ))}
          </h1>
          <p className="intro-tag">{site.tagline}</p>
        </div>
        <dl ref={stats} className="intro-stats">
          {site.stats.map((s) => (
            <div key={s.key} className="stat">
              <dt className="stat-n" data-key={s.key} data-to={s.to} data-suffix={s.suffix} data-resolved="1">
                <i className="stat-key">{s.key}</i>
                {s.to}
                {s.suffix}
              </dt>
              <dd className="stat-l" data-english={s.label}>
                <i className="stat-mark">{"//"}</i>
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
        <p className="intro-meter">
          <span ref={meter}>0</span>
        </p>
        <p className="intro-enter" aria-hidden>
          Scroll to enter
          <i />
        </p>
        <div className="intro-scan" aria-hidden />
      </div>
    </section>
  );
}
