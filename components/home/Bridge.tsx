"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { useSection } from "@/components/home/useSection";

/* Between the last billboard and AI & Automation: the train comes apart into his particles and he
   stands whole again, the camera coming round to face him; then the scroll carries it in, into the
   heart beating in his chest, until the signal breaks and hands over to the AI world. The engine
   does all of it from signals.scroll.bridge; this is the scroll, and one line of copy. */
export function Bridge() {
  const section = useRef<HTMLElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  useSection(section, "bridge");

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top center",
      end: "bottom center",
      onUpdate: (self) => {
        const p = self.progress;
        signals.scroll.bridge = p;
        // the line is read while he stands whole, and gone before the camera goes in
        const el = line.current;
        if (el) {
          const a = Math.min(1, Math.max(0, (p - 0.2) / 0.08)) * Math.min(1, Math.max(0, (0.5 - p) / 0.08));
          el.style.opacity = a.toFixed(3);
          el.style.transform = `translateY(${((1 - a) * 12).toFixed(1)}px)`;
        }
      },
      onLeaveBack: () => (signals.scroll.bridge = 0),
    });
    return () => st.kill();
  }, []);

  return (
    <section ref={section} id="bridge" aria-label="Into the heart" style={{ height: "320svh" }}>
      <div className="bridge-pin">
        <p ref={line} className="bridge-line">
          <span className="hud-no">03</span> Every solution runs on one heart.
        </p>
      </div>
    </section>
  );
}
