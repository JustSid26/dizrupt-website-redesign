"use client";

import { useEffect, useState } from "react";
import { gsap } from "@/lib/gsap";
import { signals } from "@/lib/signals";

/* A readout for tuning on a real phone, shown only when the address ends in ?perf: the frame rate
   over the last second, the resolution the engine chose (device pixels per CSS pixel), whether it
   has dropped to the lighter picture (and thinned his points, below that), and the section; under it,
   for each section seen so far, the share of its frames dropped and its worst (a screenshot of it, from
   the top of the page to the contact, says where a phone struggles). Nothing of it runs otherwise. */
type Eng = { renderer?: { getPixelRatio(): number }; quality?: () => { low: boolean; base: number; thin: number } };

export function PerfReadout() {
  const [on, setOn] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("perf")) return;
    setOn(true);
    let frames = 0, worst = 0, last = performance.now(), prev = last;
    // and since the page opened, per section: how many frames, how many dropped (a refresh missed), the worst
    const by: Record<string, { n: number; late: number; worst: number }> = {};
    const tick = () => {
      const now = performance.now();
      frames++;
      const dt = now - prev;
      worst = Math.max(worst, dt);
      prev = now;
      if (dt < 250) {
        const b = (by[signals.scroll.section] ??= { n: 0, late: 0, worst: 0 });
        b.n++;
        if (dt > 24) b.late++;
        b.worst = Math.max(b.worst, dt);
      }
      if (now - last < 1000) return;
      const eng = (window as unknown as { engine?: Eng }).engine;
      const q = eng?.quality?.();
      const dpr = eng?.renderer?.getPixelRatio() ?? 0;
      setText(`${frames} fps · worst ${worst.toFixed(0)}ms · ${dpr.toFixed(2)}x of ${devicePixelRatio}x${q?.low ? " · LIGHT" : ""}${q && q.thin < 1 ? ` · points ${Math.round(q.thin * 100)}%` : ""} · ${signals.scroll.section}\n`
        + Object.entries(by).map(([k, b]) => `${k} ${Math.round((b.late / b.n) * 100)}% dropped, worst ${b.worst.toFixed(0)}ms`).join("\n"));
      frames = 0;
      worst = 0;
      last = now;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  if (!on) return null;
  return (
    <p
      aria-hidden
      style={{
        position: "fixed", left: 8, bottom: 8, zIndex: 999, margin: 0, padding: "6px 9px", borderRadius: 6,
        background: "rgba(0,0,0,0.75)", color: "#7cf2ff", font: "500 11px/1.3 ui-monospace, Menlo, monospace", pointerEvents: "none", whiteSpace: "pre",
      }}
    >
      {text || "measuring…"}
    </p>
  );
}
