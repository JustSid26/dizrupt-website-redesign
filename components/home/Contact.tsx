"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { site } from "@/content/site";
import { MumbaiClock } from "@/components/ui/MumbaiClock";
import { useSection } from "@/components/home/useSection";
import { goToSection } from "@/lib/sections";
import { SocialTowers } from "@/components/home/SocialTowers";

/* Contact. Scrolling on past the last card hands over: the cards drift off, the particles gather
   back into him on the left — he sees you out — and the page comes up on the right. Every frame of
   it is tied to the scroll, so it runs backwards just as readily. */
const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

// "Have a" and "project?" as masked glyphs that arrive from alternate sides
function Counterflow() {
  let i = 0;
  const seg = (text: string, emphasis: boolean) => (
    <span className="contact-segment" aria-hidden>
      {[...text].map((l, k) =>
        l === " " ? (
          <span key={k} className="contact-space" />
        ) : (
          <span key={k} className={`contact-mask ${i % 2 ? "from-top" : "from-bottom"}${emphasis ? " emphasis" : ""}`}>
            <span className="contact-char" style={{ "--i": i++ } as React.CSSProperties}>
              {l}
            </span>
          </span>
        ),
      )}
    </span>
  );
  return (
    <h2 className="contact-heading" aria-label="Have a project?">
      {seg("Have a", false)}
      <span className="contact-segment-gap" aria-hidden />
      {seg("project?", true)}
    </h2>
  );
}

export function Contact() {
  const section = useRef<HTMLElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  useSection(section, "contact");

  useEffect(() => {
    const root = document.documentElement;
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top bottom",
      end: "bottom bottom",
      onUpdate: (self) => {
        const p = self.progress;
        signals.scroll.contact = p;
        root.style.setProperty("--handoff", p.toFixed(4));
        root.style.setProperty("--contact-in", smooth(0.55, 0.85, p).toFixed(4));
        const el = pane.current;
        if (!el) return;
        el.classList.toggle("handing", p > 0.001);
        // hysteresis, so a slow scroll near the line doesn't restart the reveal
        if (p >= 0.84) el.classList.add("contact-text-in");
        else if (p <= 0.72) el.classList.remove("contact-text-in");
      },
    });
    return () => st.kill();
  }, []);

  const c = site.contact;
  return (
    <section ref={section} id="contact" aria-label="Contact" style={{ height: "200svh" }}>
      <SocialTowers />
      <div ref={pane} className="contact-pin">
        <div className="contact-inner">
          <p className="eyebrow">
            <span className="hud-no">04</span> Contact
          </p>
          <Counterflow />
          <p className="contact-lead">Tell us what you&apos;re building. We&apos;ll come back within a working day with how we&apos;d approach it.</p>
          <a className="contact-cta" href={`mailto:${c.email}?subject=New%20project%20with%20Dizrupt`}>
            <span>Start a project</span>
            <i aria-hidden>→</i>
          </a>
          <dl className="contact-grid">
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
                <a className="u-link" href={c.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
              </dd>
            </div>
          </dl>
          <button type="button" className="back" onClick={() => goToSection("work")}>
            ← Back to work
          </button>
        </div>
      </div>
    </section>
  );
}
