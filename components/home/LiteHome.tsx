"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ScrollTrigger } from "@/lib/gsap";
import { useStore } from "@/lib/store";
import { goToSection } from "@/lib/sections";
import { routeReady } from "@/lib/viewTransition";
import { site } from "@/content/site";
import { SOLUTIONS, solutionSlug } from "@/content/solutions";
import { TECH_PROJECTS } from "@/content/techProjects";
import { clients, slugOf } from "@/content/projects";
import { bannerFor } from "@/content/banners";
import { MumbaiClock } from "@/components/ui/MumbaiClock";
import { useSection } from "@/components/home/useSection";

/* The home page without the 3D: for a device that can't draw it, or one that took too long to
   (Stage.tsx), and anyone who asks for it with ?lite. The same words, the same work, the same way to
   get in touch, as a plain page that scrolls the browser's own way. Nothing here moves on its own. */
export function LiteHome() {
  const set = useStore((s) => s.set);
  const intro = useRef<HTMLElement>(null);
  const solutions = useRef<HTMLElement>(null);
  const ai = useRef<HTMLElement>(null);
  const work = useRef<HTMLElement>(null);
  const contact = useRef<HTMLElement>(null);
  useSection(intro, "intro");
  useSection(solutions, "solutions");
  useSection(ai, "ai");
  useSection(work, "projects");
  useSection(contact, "contact");

  useEffect(() => {
    // no count to wait for; and coming back from a case, the page the full home would have held still
    // while it found its place (HomeEnter.tsx) is let go at once
    set({ loaded: true });
    const root = document.documentElement;
    root.classList.remove("is-loading", "is-landing");
    const target = sessionStorage.getItem("home-target");
    sessionStorage.removeItem("home-scroll");
    sessionStorage.removeItem("home-target");
    ScrollTrigger.refresh();
    if (target) goToSection(target, true);
    routeReady();
  }, [set]);

  const c = site.contact;
  return (
    <div className="lite-home">
      <section ref={intro} id="lite-intro" className="lite-hero" aria-label="Dizrupt">
        <p className="lite-mark">{site.profile.mark}</p>
        <h1 className="lite-word">DIZRUPT</h1>
        <p className="lite-line">{site.profile.line}</p>
        <p className="lite-body">{site.profile.body}</p>
        <dl className="lite-stats">
          {site.stats.map((s) => (
            <div key={s.key}>
              <dt>{s.label}</dt>
              <dd>
                {s.to}
                {s.suffix}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section ref={solutions} id="lite-solutions" className="lite-section" aria-labelledby="lite-solutions-h">
        <p className="eyebrow">What we do</p>
        <h2 id="lite-solutions-h" className="lite-h2">Solutions</h2>
        <ul className="lite-grid">
          {SOLUTIONS.map((s) => (
            <li key={s.name}>
              <Link href={`/solutions/${solutionSlug(s)}`} className="lite-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt="" loading="lazy" decoding="async" />
                <span className="lite-card-title">{s.name}</span>
                <span className="lite-card-text">{s.line}</span>
                <span className="lite-card-meta">{s.work}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section ref={ai} id="lite-ai" className="lite-section" aria-labelledby="lite-ai-h">
        <p className="eyebrow">What we build</p>
        <h2 id="lite-ai-h" className="lite-h2">AI &amp; Automation</h2>
        <ul className="lite-grid">
          {TECH_PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link href={`/ai/${p.slug}`} className="lite-card">
                {(p.still ?? p.poster) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.still ?? p.poster} alt="" loading="lazy" decoding="async" />
                )}
                <span className="lite-card-title">{p.name}</span>
                <span className="lite-card-text">{p.summary}</span>
                <span className="lite-card-meta">{p.about}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section ref={work} id="lite-work" className="lite-section" aria-labelledby="lite-work-h">
        <p className="eyebrow">Selected work</p>
        <h2 id="lite-work-h" className="lite-h2">Work</h2>
        <ul className="lite-grid lite-grid-wide">
          {clients.map((p) => {
            const banner = bannerFor(p.title);
            return (
              <li key={p.title}>
                <Link href={`/work/${slugOf(p)}`} className="lite-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {banner && <img src={banner} alt="" loading="lazy" decoding="async" className="lite-banner" />}
                  <span className="lite-card-title">{p.title}</span>
                  <span className="lite-card-meta">{p.client}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section ref={contact} id="lite-contact" className="lite-section lite-contact" aria-labelledby="lite-contact-h">
        <p className="eyebrow">Contact</p>
        <h2 id="lite-contact-h" className="lite-h2">Have a project?</h2>
        <p className="lite-body">Tell us what you&apos;re building. We&apos;ll come back within a working day with how we&apos;d approach it.</p>
        <a className="lite-cta" href={`mailto:${c.email}?subject=New%20project%20with%20Dizrupt`}>
          Start a project
        </a>
        <dl className="lite-contact-grid">
          <div>
            <dt>Write</dt>
            <dd>
              <a className="u-link" href={`mailto:${c.email}`}>{c.email}</a>
            </dd>
          </div>
          <div>
            <dt>Call</dt>
            <dd>
              <a className="u-link" href={`tel:${c.tel}`}>{c.phone}</a>
            </dd>
          </div>
          <div>
            <dt>Studio</dt>
            <dd>
              Mumbai, India · <MumbaiClock /> IST
            </dd>
          </div>
          <div>
            <dt>Follow</dt>
            <dd>
              <a className="u-link" href={c.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
