"use client";

// Opening the projects from AI & Automation opens a Mac: a macOS desktop grows out of its
// screen, Spotlight types "projects", and a Finder window of the work opens — each project a video
// file that plays in its own window.
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { TECH_PROJECTS, type TechProject } from "@/content/techProjects";

export function MacProjects() {
  const open = useStore((s) => s.macOpen);
  const set = useStore((s) => s.set);
  const reduce = useStore((s) => s.reducedMotion);
  const root = useRef<HTMLDivElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<"desktop" | "spotlight" | "result" | "window">("desktop");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<TechProject | null>(null);
  const [time, setTime] = useState("");
  const direct = useStore((s) => s.macProject);
  const close = () => set({ macOpen: false, macProject: null });

  useEffect(() => {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit" });
    const t = () => setTime(f.format(new Date()));
    t();
    const id = setInterval(t, 20000);
    return () => clearInterval(id);
  }, []);

  // grow out of the laptop's screen, and shrink back into it
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const from = () => {
      const r = signals.macFrom ?? signals.billboardHit;
      const box = el.getBoundingClientRect();
      return {
        x: r.x + r.w / 2 - (box.left + box.width / 2),
        y: r.y + r.h / 2 - (box.top + box.height / 2),
        scaleX: Math.max(0.05, r.w / box.width),
        scaleY: Math.max(0.05, r.h / box.height),
      };
    };
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        if (reduce) return void gsap.set(el, { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1 });
        gsap.fromTo(el, { opacity: 0.2, ...from() }, { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.75, ease: "expo.site" });
      });
    } else if (visible) {
      setPlaying(null);
      if (reduce) return void setVisible(false);
      gsap.to(el, { opacity: 0, ...from(), duration: 0.5, ease: "power3.in", onComplete: () => setVisible(false) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // desktop → Spotlight types "projects" → the folder opens
  useEffect(() => {
    if (!open) {
      setStage("desktop");
      setQuery("");
      return;
    }
    // opened from a project's screen: straight to its film, no Spotlight
    if (reduce || direct) {
      setStage("window");
      if (direct) setPlaying(TECH_PROJECTS.find((p) => p.name === direct) ?? null);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    setStage("desktop");
    at(900, () => setStage("spotlight"));
    "projects".split("").forEach((_, i) => at(1300 + i * 110, () => setQuery("projects".slice(0, i + 1))));
    at(2350, () => setStage("result"));
    at(2950, () => setStage("window"));
    return () => timers.forEach(clearTimeout);
  }, [open, reduce, direct]);

  useEffect(() => {
    if (stage !== "window" || !win.current || reduce) return;
    gsap.fromTo(win.current, { opacity: 0, scale: 0.92, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "expo.site" });
    gsap.fromTo(root.current!.querySelectorAll(".mac-file"), { opacity: 0, y: 14, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.05, delay: 0.15, ease: "back.out(1.6)" });
  }, [stage, reduce]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (playing) setPlaying(null);
      else close();
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playing]);

  return (
    <div className="mac-layer" data-open={visible || undefined} onClick={close}>
      <div ref={root} className="mac-desktop" role="dialog" aria-modal="true" aria-label="Tech & Automation projects" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sr-only" onClick={close}>
          Close
        </button>
        <div className="mac-menubar">
          <span className="mac-apple" aria-hidden></span>
          <strong>Finder</strong>
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span className="mac-menubar-right">{time} IST</span>
        </div>
        {(stage === "spotlight" || stage === "result") && (
          <div className="mac-spotlight" aria-live="polite">
            <div className="mac-spot-bar">
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              <span className="mac-spot-text">
                {query || <span className="mac-spot-ph">Spotlight Search</span>}
                <i className="mac-caret" />
              </span>
            </div>
            {query.length >= 3 && (
              <div className="mac-spot-results">
                <p>Top Hit</p>
                <div className="mac-spot-row" data-active={stage === "result" || undefined}>
                  <span className="mac-folder" aria-hidden />
                  <span>
                    <strong>projects</strong>
                    <small>Folder — ~/dizrupt/tech-and-automation</small>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={win} className="mac-window" hidden={stage !== "window"}>
          <div className="mac-titlebar">
            <div className="mac-lights">
              <button type="button" className="mac-close" aria-label="Close" onClick={close} />
              <i />
              <i />
            </div>
            <span className="mac-title">~/dizrupt/tech-and-automation/projects</span>
          </div>
          <ul className="mac-files">
            {TECH_PROJECTS.map((p) => (
              <li key={p.name}>
                <button type="button" className="mac-file" onClick={() => setPlaying(p)}>
                  <span className="mac-file-icon" aria-hidden>
                    {p.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.poster} alt="" />
                    ) : p.video ? (
                      <video src={`${p.video}#t=0.5`} muted preload="metadata" />
                    ) : null}
                  </span>
                  <span className="mac-file-name">{p.name}.mp4</span>
                  <span className="mac-file-kind">{p.about}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {playing && (
          <div className="mac-player" role="dialog" aria-label={playing.name}>
            <div className="mac-titlebar">
              <div className="mac-lights">
                <button type="button" className="mac-close" aria-label="Close video" onClick={() => setPlaying(null)} />
                <i />
                <i />
              </div>
              <span className="mac-title">{playing.name}.mp4</span>
            </div>
            {playing.video ? (
              <video src={playing.video} controls autoPlay playsInline />
            ) : (
              <p className="mac-player-empty">The video for {playing.name} is on its way.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
