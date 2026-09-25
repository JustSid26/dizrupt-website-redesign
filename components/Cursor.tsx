"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { signals } from "@/lib/signals";

// The dot that follows the pointer (and swells over anything clickable). Also the one place the
// pointer is read for the engine.
export function Cursor() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pos = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
    const p = signals.pointer;
    const move = (e: PointerEvent) => {
      p.x = (e.clientX / innerWidth) * 2 - 1;
      p.y = -(e.clientY / innerHeight) * 2 + 1;
      p.px = e.clientX;
      p.py = e.clientY;
      p.active = true;
      pos.tx = e.clientX;
      pos.ty = e.clientY;
      el.current?.classList.toggle("hover", !!(e.target as Element).closest?.("a, button"));
    };
    const leave = () => (p.active = false);
    addEventListener("pointermove", move);
    addEventListener("pointerdown", move);
    document.addEventListener("pointerleave", leave);
    const tick = (_: number, dtMs: number) => {
      const k = 1 - Math.exp(-18 * Math.min(dtMs, 50) / 1000);
      pos.x += (pos.tx - pos.x) * k;
      pos.y += (pos.ty - pos.y) * k;
      if (el.current) el.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    };
    gsap.ticker.add(tick);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerdown", move);
      document.removeEventListener("pointerleave", leave);
      gsap.ticker.remove(tick);
    };
  }, []);
  return <div ref={el} className="cursor" aria-hidden />;
}
