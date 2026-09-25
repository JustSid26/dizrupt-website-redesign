"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// The one canvas behind every page. The engine is imported on the client only, and lives for the
// whole visit — routes change what it shows, never whether it exists.
export function Stage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const go = useRef(router.push);
  go.current = router.push;

  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | null = null;
    import("@/lib/engine/engine").then(async ({ createEngine }) => {
      if (!alive || !canvas.current || !layer.current) return;
      const engine = await createEngine({
        canvas: canvas.current,
        indexLayer: layer.current,
        onOpenProject: (slug) => {
          sessionStorage.setItem("home-scroll", String(scrollY));
          go.current(`/work/${slug}`, { scroll: false });
        },
      });
      if (!alive) engine.dispose();
      else dispose = engine.dispose;
    });
    return () => {
      alive = false;
      dispose?.();
    };
  }, []);

  return (
    <>
      <canvas ref={canvas} id="gl" aria-hidden />
      {/* the spiral's cards are WebGL; their click targets and labels are DOM, placed here */}
      <div id="index" aria-label="All projects">
        <div ref={layer} className="index-cards" />
      </div>
    </>
  );
}
