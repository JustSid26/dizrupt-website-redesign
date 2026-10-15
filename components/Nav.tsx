"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { SectionRail } from "@/components/SectionRail";

// The logo and the sections. The city is always at night; there is no menu.
export function Nav() {
  const loaded = useStore((s) => s.loaded);
  const home = usePathname() === "/";
  // on the home page it waits for the landing (the count, then DIZRUPT assembling); anywhere else it's there
  const ready = loaded || !home;
  return (
    <header className="nav" data-loaded={ready || undefined}>
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
