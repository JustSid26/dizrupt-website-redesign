"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "@/lib/gsap";
import { signals, type Section } from "@/lib/signals";
import { goToSection } from "@/lib/sections";

// Where you are on the page: the chapters, the current one lit.
const ITEMS: { id: Section; dom: string; label: string }[] = [
  { id: "intro", dom: "intro", label: "Intro" },
  { id: "solutions", dom: "solutions", label: "Solutions" },
  { id: "ai", dom: "ai", label: "AI" },
  { id: "projects", dom: "work", label: "Work" },
  { id: "contact", dom: "contact", label: "Contact" },
];

export function SectionRail() {
  const [cur, setCur] = useState<Section>("intro");
  const home = usePathname() === "/";
  useEffect(() => {
    const tick = () => setCur((c) => (c === signals.scroll.section ? c : signals.scroll.section));
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  if (!home) return <span />;
  // the logo in the middle, the sections either side of it
  const item = (it: (typeof ITEMS)[number]) => (
    <button
      key={it.id}
      type="button"
      aria-current={cur === it.id || undefined}
      aria-label={it.id === "intro" ? "Dizrupt, intro" : undefined}
      className={it.id === "intro" ? "rail-logo" : undefined}
      onClick={(e) => {
        goToSection(it.dom);
        // clicked, not tabbed to: let go of focus, or the arrow keys that ride on would ring it
        if (e.detail > 0) e.currentTarget.blur();
      }}
    >
      {/* the intro is the logo itself */}
      {it.id === "intro" ? (
        <span aria-hidden>
          DI<span className="flip-z">Z</span>RUPT
        </span>
      ) : (
        it.label
      )}
    </button>
  );
  const [logo, ...rest] = ITEMS;
  const half = Math.ceil(rest.length / 2);
  return (
    <nav className="rail" aria-label="Sections">
      <span className="rail-side is-left">{rest.slice(0, half).map(item)}</span>
      {item(logo)}
      <span className="rail-side is-right">{rest.slice(half).map(item)}</span>
    </nav>
  );
}
