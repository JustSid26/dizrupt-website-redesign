"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { TECH_PROJECTS, type TechProject } from "@/content/techProjects";

/* An AI & Automation project, as a system console: a status bar with the node's path, the name
   decoding in out of noise, the film in a monitor frame with its feed readouts, the spec as a
   register table, the build in three logged chapters, and the system drawn as a live flow — four
   nodes with data running between them. The page is a dark pane over the same world. */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#%&$@";
const pad = (n: number) => String(n).padStart(2, "0");

function useDecode(text: string, delay: number, reduce: boolean) {
  const [out, setOut] = useState(reduce ? text : text.replace(/\S/g, " "));
  useEffect(() => {
    if (reduce) return void setOut(text);
    let raf = 0;
    const start = performance.now() + delay;
    const dur = 500 + text.length * 40;
    const step = (now: number) => {
      const t = (now - start) / dur;
      if (t >= 1) return void setOut(text);
      const lock = Math.max(0, Math.floor(t * text.length));
      setOut([...text].map((c, i) => (c === " " ? " " : t < 0 ? " " : i < lock ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join(""));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, reduce]);
  return out;
}

export function AiProjectPage({ project }: { project: TechProject }) {
  const reduce = useStore((s) => s.reducedMotion);
  const root = useRef<HTMLElement>(null);
  const n = TECH_PROJECTS.findIndex((p) => p.slug === project.slug); // by slug: the prop is a copy from the server
  const next = TECH_PROJECTS[(n + 1) % TECH_PROJECTS.length];
  const title = useDecode(project.name.toUpperCase(), 250, reduce);
  const [clock, setClock] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    scrollTo(0, 0);
    requestAnimationFrame(() => root.current?.classList.add("in"));
    document.body.classList.add("is-aip");
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const t = () => setClock(f.format(new Date()));
    t();
    const id = setInterval(t, 1000);
    return () => {
      clearInterval(id);
      document.body.classList.remove("is-aip");
    };
  }, [project]);

  // the chapters come up as they scroll into view
  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? [];
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("seen")), { threshold: 0.2 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [project]);

  const chapters: [string, string][] = [
    ["Problem", project.problem],
    ["System", project.system],
    ["Result", project.result],
  ];

  return (
    <article ref={root} className="aip">
      <div className="aip-bg" aria-hidden>
        <div className="aip-grid" />
        <div className="aip-scan" />
      </div>

      {/* in the site's nav row, so it has to live beside the nav, not inside the page */}
      {mounted && createPortal(
      <header className="aip-bar">
        <Link
          href="/"
          className="aip-back"
          onClick={() => {
            // arrived here directly: go back to the section rather than the top of the home page
            if (!sessionStorage.getItem("home-scroll")) sessionStorage.setItem("home-target", "ai");
          }}
        >
          <span aria-hidden>←</span> <span className="aip-back-label">AI &amp; Automation</span>
        </Link>
        <p className="aip-path">
          ~/dizrupt/ai/projects/<strong>{project.slug}</strong>
        </p>
        <p className="aip-status">
          <i /> Node {pad(n + 1)} · online · {clock} IST
        </p>
      </header>,
        document.body,
      )}

      <section className="aip-hero">
        <p className="aip-kicker">
          <span>[{pad(n + 1)}]</span> {project.about} <span className="aip-dim">/ {project.year}</span>
        </p>
        <h1 className="aip-title" aria-label={project.name}>
          <span aria-hidden>{title}</span>
        </h1>
        <p className="aip-summary">{project.summary}</p>
      </section>

      <figure className="aip-monitor" data-reveal>
        <div className="aip-monitor-bar" aria-hidden>
          <span>FEED {pad(n + 1)}</span>
          <span>{project.video ? "1080P · PLAYBACK" : "NO SIGNAL"}</span>
          <span className="aip-rec">● REC</span>
        </div>
        <div className="aip-screen">
          {project.video ? (
            <video src={project.video} poster={project.poster} controls playsInline preload="metadata" />
          ) : project.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.poster} alt={`${project.name} — still`} />
          ) : (
            <div className="aip-nosignal">
              <span>Film incoming</span>
              <small>The walkthrough for {project.name} is on its way.</small>
            </div>
          )}
          <i className="aip-corner tl" aria-hidden />
          <i className="aip-corner tr" aria-hidden />
          <i className="aip-corner bl" aria-hidden />
          <i className="aip-corner br" aria-hidden />
        </div>
      </figure>

      <dl className="aip-spec" data-reveal>
        <div>
          <dt>Type</dt>
          <dd>{project.about}</dd>
        </div>
        <div>
          <dt>Year</dt>
          <dd>{project.year}</dd>
        </div>
        <div>
          <dt>Node</dt>
          <dd className="aip-live">{pad(n + 1)}</dd>
        </div>
        <div className="aip-stack">
          <dt>Stack</dt>
          <dd>
            {project.stack.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </dd>
        </div>
      </dl>

      <section className="aip-flow" data-reveal aria-label="How the system works">
        <p className="aip-label">
          <span>{"//"}</span> System map
        </p>
        <ol>
          {project.flow.map((step, i) => (
            <li key={step} style={{ "--i": i } as React.CSSProperties}>
              <span className="aip-node">
                <small>{pad(i + 1)}</small>
                {step}
              </span>
              {i < project.flow.length - 1 && <span className="aip-wire" aria-hidden />}
            </li>
          ))}
        </ol>
      </section>

      <section className="aip-log">
        {chapters.map(([h, body], i) => (
          <div key={h} className="aip-entry" data-reveal>
            <p className="aip-label">
              <span>{pad(i + 1)}</span> {h}
            </p>
            <p className="aip-body">{body}</p>
          </div>
        ))}
      </section>

      <Link href={`/ai/${next.slug}`} className="aip-next" data-reveal>
        <span className="aip-label">
          <span>→</span> Next node
        </span>
        <strong>{next.name}</strong>
        <small>{next.about}</small>
      </Link>
    </article>
  );
}
