"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { SectionRail } from "@/components/SectionRail";

// The logo and the sections. The city is always at night; there is no menu.
export function Nav() {
  const loaded = useStore((s) => s.loaded);
  return (
    <header className="nav" data-loaded={loaded || undefined}>
      <Link href="/" className="logo" aria-label="Dizrupt, home">
        <span className="logo-word" aria-hidden>
          DI<span className="flip-z">Z</span>RUPT
        </span>
      </Link>
      <SectionRail />
      <span aria-hidden className="nav-right" />
    </header>
  );
}
