"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { transitionTo } from "@/lib/viewTransition";
import { bannerFor } from "@/content/banners";
import { bySlug } from "@/content/projects";

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
        onOpenProject: (slug, card) => {
          sessionStorage.setItem("home-scroll", String(scrollY));
          const banner = bannerFor(bySlug(slug)?.title ?? "");
          /* The card, squared up in the middle of the screen, becomes the case's banner: its hit area
             wears the banner for the "before" snapshot, named as the banner is on the case page. */
          transitionTo(() => go.current(`/work/${slug}`, { scroll: false }), "open", {
            before: () => {
              if (!card) return;
              card.style.viewTransitionName = "work-hero";
              if (banner) card.style.background = `url(${banner}) center / cover`;
            },
            after: () => {
              if (!card) return;
              card.style.viewTransitionName = "";
              card.style.background = "";
            },
          });
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
