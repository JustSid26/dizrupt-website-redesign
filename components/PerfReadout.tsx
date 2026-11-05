"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { signals } from "@/lib/signals";

/* A readout for tuning on a real device, shown only when the address ends in ?perf: the frame rate
   over the last second, the resolution the engine chose (device pixels per CSS pixel), whether it
   has dropped to the lighter picture (and thinned his points, below that), and the section; under it,
   for each section seen so far, its frame rate, the share of its frames dropped, its worst, and what
   the picture was there. "Copy report" puts all of it on the clipboard, with the browser, the screen
   and the graphics, to be pasted where it can be read: what a weak laptop really does, section by
   section, rather than what a fast one guesses. Nothing of it runs otherwise. */
type Q = { frames?: number; low: boolean; base: number; thin: number; pr?: number; bench?: Record<string, number>; tier?: string; why?: string; gpu?: string; glow?: boolean | null; fps30?: boolean; cap?: string | null; trying?: boolean };
type Eng = { renderer?: { getPixelRatio(): number }; quality?: () => Q };
type Section = { n: number; late: number; worst: number; time: number; at: string; drawn: number };

// what the picture is, in a few words
const look = (q: Q | undefined, dpr: number) =>
  `${dpr.toFixed(2)}x${q?.glow === false ? ", no glow" : ""}${q?.fps30 ? ", held to 30" : ""}${q && q.thin < 1 ? `, points ${Math.round(q.thin * 100)}%` : ""}`;

export function PerfReadout() {
  const [on, setOn] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState("");
  const report = useRef<() => string>(() => "");
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("perf")) return;
    setOn(true);
    let frames = 0, worst = 0, last = performance.now(), prev = last;
    // and since the page opened, per section: frames, dropped (a refresh missed), the worst, time spent, and the picture there
    const by: Record<string, Section> = {};
    const order: string[] = [];
    let drawnBefore = -1; // the 3D's own frames so far (it draws every other one, held to 30)
    const tick = () => {
      const now = performance.now();
      frames++;
      const dt = now - prev;
      worst = Math.max(worst, dt);
      prev = now;
      const eng = (window as unknown as { engine?: Eng }).engine;
      if (dt < 250) {
        const k = signals.scroll.section;
        if (!by[k]) { by[k] = { n: 0, late: 0, worst: 0, time: 0, at: "", drawn: 0 }; order.push(k); }
        const b = by[k];
        b.n++;
        const drawn = eng?.quality?.().frames ?? -1;
        if (drawn >= 0 && drawnBefore >= 0) b.drawn += drawn - drawnBefore;
        drawnBefore = drawn;
        b.time += dt;
        if (dt > 24) b.late++;
        b.worst = Math.max(b.worst, dt);
        if (b.n % 30 === 0) b.at = look(eng?.quality?.(), eng?.renderer?.getPixelRatio() ?? 0);
      }
      if (now - last < 1000) return;
      const q = eng?.quality?.();
      const dpr = eng?.renderer?.getPixelRatio() ?? 0;
      const lines = (fps: boolean) => order.map((k) => {
        const b = by[k];
        return `${k} ${fps ? `${Math.round((b.n * 1000) / Math.max(1, b.time))}fps (3D drawn ${Math.round((b.drawn * 1000) / Math.max(1, b.time))}/s) · ` : ""}${Math.round((b.late / b.n) * 100)}% dropped, worst ${b.worst.toFixed(0)}ms${fps && b.at ? ` · at ${b.at}` : ""}`;
      });
      setText(`${frames} fps · worst ${worst.toFixed(0)}ms · ${dpr.toFixed(2)}x of ${devicePixelRatio}x${q?.low ? " · LIGHT" : ""}${q?.glow === false ? " · no glow" : ""}${q?.fps30 ? " · held to 30fps" : ""}${q?.trying ? " · trying for 60" : q?.cap === "browser" ? " · the browser holds 30" : ""}${q && q.thin < 1 ? ` · points ${Math.round(q.thin * 100)}%` : ""} · ${signals.scroll.section}\n`
        // which scene this device was given (lib/engine/config.ts: lean), why, and the graphics it reported
        + (q?.tier ? `${q.tier} (${q.why}) · ${(q.gpu || "graphics unnamed").replace(/^ANGLE \((.*)\)$/, "$1").slice(0, 70)}\n` : "")
        // what the benchmark timed at startup: ms a frame at each resolution it tried
        + (q?.bench && Object.keys(q.bench).length ? `test ${Object.entries(q.bench).map(([pr, ms]) => `${pr}x ${ms}ms`).join(" · ")}\n` : "")
        + lines(false).join("\n"));
      // the whole of it, for the clipboard
      report.current = () => {
        const nav = navigator as Navigator & { deviceMemory?: number };
        return [
          `dizrupt perf report · ${new Date().toISOString()}`,
          `page ${location.pathname}${location.search}`,
          `browser ${navigator.userAgent}`,
          `screen ${innerWidth}×${innerHeight} css at ${devicePixelRatio}x · ${nav.hardwareConcurrency ?? "?"} cores · ${nav.deviceMemory ?? "?"}GB`,
          `graphics ${q?.gpu || "unnamed"}`,
          `tier ${q?.tier ?? "no 3D"} (${q?.why ?? ""}) · started at ${q?.base ?? "?"}x · now ${look(q, dpr)}${q?.cap ? ` · 30fps cap: ${q.cap}` : ""}`,
          q?.bench && Object.keys(q.bench).length ? `startup test ${Object.entries(q.bench).map(([pr, ms]) => `${pr}x ${ms}ms`).join(" · ")}` : "startup test none",
          "sections, in the order seen:",
          ...lines(true).map((l) => "  " + l),
        ].join("\n");
      };
      frames = 0;
      worst = 0;
      last = now;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  const copy = async () => {
    const t = report.current();
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      // (no clipboard API, or not allowed: the old way)
      const a = document.createElement("textarea");
      a.value = t;
      document.body.appendChild(a);
      a.select();
      document.execCommand("copy");
      a.remove();
    }
    setCopied("copied: paste it to whoever asked");
    setTimeout(() => setCopied(""), 3000);
  };

  if (!on) return null;
  return (
    <div
      style={{
        position: "fixed", left: 8, bottom: 8, zIndex: 999, padding: "6px 9px", borderRadius: 6,
        background: "rgba(0,0,0,0.75)", color: "#7cf2ff", font: "500 11px/1.3 ui-monospace, Menlo, monospace", pointerEvents: "none",
      }}
    >
      <p aria-hidden style={{ margin: 0, whiteSpace: "pre" }}>{text || "measuring…"}</p>
      <button
        type="button"
        onClick={copy}
        style={{ pointerEvents: "auto", marginTop: 6, padding: "4px 8px", border: "1px solid #7cf2ff", borderRadius: 4, background: "transparent", color: "#7cf2ff", font: "inherit", cursor: "pointer" }}
      >
        {copied || "Copy report"}
      </button>
    </div>
  );
}
