"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "@/lib/gsap";
import { signals, type Section } from "@/lib/signals";
import { goToSection } from "@/lib/sections";
import { useStore } from "@/lib/store";

/* A phone's navigation: the wordmark at the top right, and the sections dropping down from it when
   it is tapped (a wide screen has the rail across the top instead, SectionRail.tsx). On the home page
   a section is scrolled to; from anywhere else the home page is opened on it (HomeEnter.tsx). */
const ITEMS: { id: Section; dom: string; label: string }[] = [
  { id: "intro", dom: "intro", label: "Intro" },
  { id: "solutions", dom: "solutions", label: "Solutions" },
  { id: "ai", dom: "ai", label: "AI & Automation" },
  { id: "projects", dom: "work", label: "Work" },
  { id: "contact", dom: "contact", label: "Contact" },
];

export function NavMenu() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState<Section>("intro");
  const root = useRef<HTMLDivElement>(null);
  const home = usePathname() === "/";
  const router = useRouter();
  const set = useStore((s) => s.set);

  // the section you are in is marked, as on the rail
  useEffect(() => {
    const tick = () => setCur((c) => (c === signals.scroll.section ? c : signals.scroll.section));
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  // open: the keys stay with the menu (SmoothScroll.tsx); a tap outside it or Escape closes it
  useEffect(() => {
    set({ menuOpen: open });
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    addEventListener("pointerdown", down);
    addEventListener("keydown", key);
    return () => {
      removeEventListener("pointerdown", down);
      removeEventListener("keydown", key);
    };
  }, [open, set]);
  useEffect(() => () => set({ menuOpen: false }), [set]);

  const go = (dom: string) => {
    setOpen(false);
    if (home) return goToSection(dom);
    sessionStorage.removeItem("home-scroll");
    sessionStorage.setItem("home-target", dom);
    router.push("/", { scroll: false });
  };

  return (
    <div ref={root} className="nav-menu">
      <button
        type="button"
        className="nav-menu-logo"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="nav-menu-list"
        onClick={() => setOpen((o) => !o)}
      >
        {/* the mark: the one lasered into the chip and beating in his chest (public/heart.png, tinted) */}
        <span className="nav-menu-mark" aria-hidden />
      </button>
      <ul id="nav-menu-list" className="nav-menu-list" data-open={open || undefined} aria-hidden={!open}>
        <li className="nav-menu-head" aria-hidden>
          <span>
            DI<span className="flip-z">Z</span>RUPT
          </span>
        </li>
        {ITEMS.map((it, i) => (
          <li key={it.id} style={{ "--i": i } as React.CSSProperties}>
            <button type="button" tabIndex={open ? 0 : -1} aria-current={(home && cur === it.id) || undefined} onClick={() => go(it.dom)}>
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
