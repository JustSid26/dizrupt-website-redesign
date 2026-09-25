"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { SectionRail } from "@/components/SectionRail";
import { ModeToggle } from "@/components/ModeToggle";

export function Nav() {
  const open = useStore((s) => s.menuOpen);
  const loaded = useStore((s) => s.loaded);
  const set = useStore((s) => s.set);
  return (
    <header className="nav" data-loaded={loaded || undefined}>
      <Link href="/" className="logo" aria-label="Dizrupt, home">
        <span className="logo-word" aria-hidden>
          DI<span className="flip-z">Z</span>RUPT
        </span>
      </Link>
      <SectionRail />
      <div className="nav-right">
        <ModeToggle />
        <button
          type="button"
          className="menu-btn"
          aria-expanded={open}
          aria-controls="menu"
          onClick={() => set({ menuOpen: !open })}
        >
          <span className="menu-btn-label">{open ? "Close" : "Menu"}</span>
          <i />
          <i />
        </button>
      </div>
    </header>
  );
}
