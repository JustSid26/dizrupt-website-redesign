"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Stage } from "@/components/Stage";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Nav } from "@/components/Nav";
import { Menu } from "@/components/Menu";
import { Cursor } from "@/components/Cursor";

// Everything that lives for the whole visit: the canvas, the scroll, the nav and menu, the cursor.
export function Experience({ children }: { children: React.ReactNode }) {
  const set = useStore((s) => s.set);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => set({ reducedMotion: mq.matches });
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [set]);

  return (
    <>
      <Stage />
      <div className="vignette" aria-hidden />
      <div className="grain" aria-hidden />
      <SmoothScroll />
      <Nav />
      <Menu />
      <main id="main">{children}</main>
      <Cursor />
    </>
  );
}
