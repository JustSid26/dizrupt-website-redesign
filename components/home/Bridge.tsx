"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useSection } from "@/components/home/useSection";

/* Between the last billboard and AI & Automation: the train comes apart into his particles and he
   stands whole again, the camera coming round to face him; then the scroll carries it in, into the
   heart beating in his chest, until the signal breaks and hands over to the AI world. The engine
   does all of it from signals.scroll.bridge; this is only the scroll. */
export function Bridge() {
  const section = useRef<HTMLElement>(null);
  useSection(section, "bridge");

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top center",
      end: "bottom center",
      onUpdate: (self) => (signals.scroll.bridge = self.progress),
      onLeaveBack: () => (signals.scroll.bridge = 0),
    });
    return () => st.kill();
  }, []);

  return (
    <section ref={section} id="bridge" aria-label="Into the heart" style={{ height: "320svh" }}>
      <div className="bridge-pin" />
    </section>
  );
}
