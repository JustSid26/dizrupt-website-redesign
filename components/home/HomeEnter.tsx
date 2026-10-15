"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { goToSection, sectionTop } from "@/lib/sections";
import { scrollToTarget } from "@/lib/scroll";
import { routeReady } from "@/lib/viewTransition";
import { signals } from "@/lib/signals";

// Coming back to the home page puts you where you left it (from a case study), or where the menu
// asked for; a fresh visit starts at the top.
export function HomeEnter() {
  useEffect(() => {
    const back = sessionStorage.getItem("home-scroll");
    const target = sessionStorage.getItem("home-target");
    sessionStorage.removeItem("home-scroll");
    sessionStorage.removeItem("home-target");
    /* Put the scroll back, then wait until it has actually landed (the page's height settles over a
       frame or two after a route change) before telling a transition the page is ready: coming back
       from a case, the tower must already show that project, full screen, in its picture. */
    let tries = 0;
    const land = () => {
      ScrollTrigger.refresh();
      const want = back ? Number(back) : target ? sectionTop(target) : 0;
      if (back) scrollToTarget(want, true);
      else if (target) goToSection(target, true);
      if (Math.abs(scrollY - want) > 4 && tries++ < 12) return void setTimeout(land, 16);
      signals.workApply?.();
      routeReady();
    };
    // timers, not frames: while a view transition waits for this page the browser renders nothing,
    // and frame callbacks wait with it
    setTimeout(land, 0);
  }, []);
  return null;
}
