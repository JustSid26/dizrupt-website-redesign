"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { SectionRail } from "@/components/SectionRail";
import { NavMenu } from "@/components/NavMenu";

// The logo and the sections. The city is always at night. On the home page the logo is the first of
// the sections (it takes you to the intro); anywhere else it sits at the left and takes you home.
// A phone has the wordmark at the top right instead, with the sections dropping from it (NavMenu.tsx).
export function Nav() {
  const loaded = useStore((s) => s.loaded);
  const home = usePathname() === "/";
  // on the home page it waits for the landing (the count, then DIZRUPT assembling); anywhere else it's there
  const ready = loaded || !home;
  // on the home page it stays off the DIZRUPT screen, and comes in with the first scroll
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (!home) return;
    const check = () => setMoved(scrollY > 24);
    check();
    addEventListener("scroll", check, { passive: true });
    return () => removeEventListener("scroll", check);
  }, [home]);
  const shown = !home || moved;
  return (
    <header className="nav" data-loaded={ready || undefined} data-shown={shown || undefined}>
      {home ? (
        <span aria-hidden className="logo" />
      ) : (
        <Link href="/" className="logo" aria-label="Dizrupt, home">
          <span className="logo-word" aria-hidden>
            DI<span className="flip-z">Z</span>RUPT
          </span>
        </Link>
      )}
      <SectionRail />
      <span aria-hidden className="nav-right" />
      <NavMenu />
    </header>
  );
}
