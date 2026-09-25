"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { bannerFor } from "@/content/banners";
import { clients, slugOf, type Project } from "@/content/projects";

/* A case study: the client's banner across the top, the work under it in three chapters, and the
   client's particle model turning beside the copy — the page is a dark pane in the same world. */
export function CaseStudy({ project }: { project: Project }) {
  const root = useRef<HTMLElement>(null);
  const reduce = useStore((s) => s.reducedMotion);
  const n = clients.indexOf(project);
  const next = clients[(n + 1) % clients.length];
  const banner = bannerFor(project.title);

  useEffect(() => {
    signals.caseShape = { shape: project.shape, colors: project.colors, spin: project.spin };
    scrollTo(0, 0);
    requestAnimationFrame(() => root.current?.classList.add("in"));
    return () => {
      signals.caseShape = null;
    };
  }, [project]);

  // the headline numbers count up once they are on screen
  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>(".project-results strong") ?? [];
    els.forEach((el, i) => {
      const to = Number(el.dataset.to);
      const suffix = el.dataset.suffix ?? "";
      if (reduce) return void (el.textContent = `${to}${suffix}`);
      const t0 = performance.now() + 500 + i * 140;
      const step = (now: number) => {
        const k = Math.min(1, Math.max(0, (now - t0) / 1600));
        el.textContent = `${Math.round(to * (1 - Math.pow(1 - k, 4)))}${suffix}`;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, [project, reduce]);

  const cs = project.caseStudy;
  return (
    <article ref={root} className="case-page" style={{ "--project-a": project.colors[0], "--project-b": project.colors[1] } as React.CSSProperties}>
      <figure className="project-hero">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt={`${project.title} — campaign banner`} />
        ) : (
          <figcaption className="project-hero-word">{project.title}</figcaption>
        )}
      </figure>
      <div className="project-inner">
        <header className="project-head">
          <p className="project-no">Project {String(n + 1).padStart(2, "0")}</p>
          <h1 className="project-title">{project.title}</h1>
          <p className="project-lead">{project.summary}</p>
        </header>
        {project.results && (
          <ul className="project-results" aria-label="Results">
            {project.results.map((r) => (
              <li key={r.label}>
                <strong data-to={r.value} data-suffix={r.suffix}>
                  {r.value}
                  {r.suffix}
                </strong>
                <span>{r.label}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="project-meta">
          <div>
            <dt>Client</dt>
            <dd>{project.title}</dd>
          </div>
          <div>
            <dt>Services</dt>
            <dd>{project.client}</dd>
          </div>
          <div>
            <dt>Sector</dt>
            <dd>{project.tags}</dd>
          </div>
        </dl>
        {cs && (
          <div className="project-chapters">
            {[
              ["The Ask", cs.ask],
              ["The Solution", cs.solution],
              ["The Dizruption", cs.dizruption],
            ].map(([h, body], i) => (
              <section key={h} className="chapter">
                <p className="chapter-no">{String(i + 1).padStart(2, "0")}</p>
                <div>
                  <h3>{h}</h3>
                  <p>{body}</p>
                </div>
              </section>
            ))}
          </div>
        )}
        <nav className="project-foot">
          <Link className="back" href="/" scroll={false}>
            ← Back to work
          </Link>
          <Link className="project-next" href={`/work/${slugOf(next)}`}>
            <span className="project-next-label">Next project</span>
            <strong>{next.title}</strong>
          </Link>
        </nav>
      </div>
    </article>
  );
}
