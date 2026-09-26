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
  return (
    <nav className="rail" aria-label="Sections">
      {ITEMS.map((it, i) => (
        <button key={it.id} type="button" aria-current={cur === it.id || undefined} onClick={() => goToSection(it.dom)}>
          <span className="hud-no">{String(i + 1).padStart(2, "0")}</span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
