"use client";

import { useEffect, type RefObject } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { signals, type Section } from "@/lib/signals";

// Marks a section as the one you are in while it holds the middle of the screen.
export function useSection(ref: RefObject<HTMLElement | null>, id: Section) {
  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start: "top center",
      end: "bottom center",
      onToggle: (self) => {
        if (self.isActive) signals.scroll.section = id;
      },
    });
    if (st.isActive) signals.scroll.section = id;
    return () => st.kill();
  }, [ref, id]);
}
