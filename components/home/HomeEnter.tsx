"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { goToSection } from "@/lib/sections";
import { scrollToTarget } from "@/lib/scroll";

// Coming back to the home page puts you where you left it (from a case study), or where the menu
// asked for; a fresh visit starts at the top.
export function HomeEnter() {
  useEffect(() => {
    const back = sessionStorage.getItem("home-scroll");
    const target = sessionStorage.getItem("home-target");
    sessionStorage.removeItem("home-scroll");
    sessionStorage.removeItem("home-target");
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      if (back) scrollToTarget(Number(back), true);
      else if (target) goToSection(target, true);
    });
  }, []);
  return null;
}
