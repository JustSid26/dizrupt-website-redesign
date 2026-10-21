"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { signals } from "@/lib/signals";
import { bannerFor } from "@/content/banners";
import { clients, slugOf } from "@/content/projects";
import { SOLUTIONS, matchesSolution, solutionSlug, type Solution } from "@/content/solutions";

/* A solution's own page, reached from its billboard: its photograph and line, then every project
   where Dizrupt delivered it, each a card that opens its case study. The solution's model turns in
   the scene behind, as a case study's does. */
export function SolutionPage({ solution: s }: { solution: Solution }) {
  const root = useRef<HTMLElement>(null);
  const work = clients.filter((p) => matchesSolution(s, p.client));
  const n = SOLUTIONS.findIndex((x) => x.name === s.name); // by name: the page is handed a copy from the server

  useEffect(() => {
    signals.caseShape = { shape: s.shape, colors: s.colors };
    scrollTo(0, 0);
    requestAnimationFrame(() => root.current?.classList.add("in"));
    return () => {
      signals.caseShape = null;
    };
  }, [s]);

  return (
    <article ref={root} className="case-page sol-page" style={{ "--project-a": s.colors[0], "--project-b": s.colors[1] } as React.CSSProperties}>
      <figure className="project-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.image} alt="" />
      </figure>
      <div className="project-inner">
        <header className="project-head">
          <h1 className="project-title">{s.name}</h1>
          <p className="project-lead">{s.line}</p>
        </header>
        <h2 className="sol-page-count">
          {work.length ? `${work.length} project${work.length > 1 ? "s" : ""}` : "Work coming soon"}
        </h2>
        <ul className="sol-page-grid">
          {work.map((p) => {
            const img = bannerFor(p.title);
            return (
              <li key={p.title}>
                <Link href={`/work/${slugOf(p)}`} className="sol-card">
                  <span className="sol-card-img">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" />
                    ) : (
                      <span className="sol-card-word">{p.title}</span>
                    )}
                  </span>
                  <span className="sol-card-meta">
                    <strong>{p.title}</strong>
                    <span>{p.tags}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <nav className="project-foot">
          <Link className="back" href="/" scroll={false}>
            Back to the line
          </Link>
          <Link className="project-next" href={`/solutions/${solutionSlug(SOLUTIONS[(n + 1) % SOLUTIONS.length])}`}>
            <span className="project-next-label">Next solution</span>
            <strong>{SOLUTIONS[(n + 1) % SOLUTIONS.length].name}</strong>
          </Link>
        </nav>
      </div>
    </article>
  );
}
