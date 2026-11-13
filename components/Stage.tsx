"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { transitionTo } from "@/lib/viewTransition";
import { bannerFor } from "@/content/banners";
import { bySlug } from "@/content/projects";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { canRunEngine, ENGINE_TIMEOUT_MS } from "@/lib/webgl";
import { fetchEngineFiles } from "@/lib/engineFiles";

// The one canvas behind every page. The engine is imported on the client only, and lives for the
// whole visit — routes change what it shows, never whether it exists.
export function Stage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const go = useRef(router.push);
  go.current = router.push;
  const set = useStore((s) => s.set);
  const gl = useStore((s) => s.gl);

  // without the 3D the canvas, the grain over it and the cards' layer are put away (globals.css: html.lite)
  useEffect(() => {
    document.documentElement.classList.toggle("lite", gl === "none");
  }, [gl]);

  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | null = null;
    /* The 3D not to be had (no WebGL 2, a software renderer, an error building it) or too slow in
       coming: the visitor gets the light version rather than a count that never finishes. An engine
       still being built when it's given up on is thrown away when it arrives. */
    let gaveUp = false;
    const giveUp = (why: unknown) => {
      if (gaveUp || !alive) return;
      gaveUp = true;
      console.warn("[dizrupt] the light version:", why);
      dispose?.();
      dispose = null;
      set({ gl: "none" });
    };
    if (!canRunEngine()) {
      giveUp("no hardware WebGL 2 (or ?lite)");
      return;
    }
    fetchEngineFiles(); // (the 3D's files, alongside its code: lib/engineFiles.ts)
    const timer = window.setTimeout(() => {
      if (!signals.ready) giveUp(`not ready after ${ENGINE_TIMEOUT_MS / 1000}s`);
    }, ENGINE_TIMEOUT_MS);
    import("@/lib/engine/engine").then(async ({ createEngine }) => {
      if (!alive || gaveUp || !canvas.current || !layer.current) return;
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
      if (!alive || gaveUp) engine.dispose();
      else {
        dispose = engine.dispose;
        set({ gl: "ok" });
      }
    }).catch(giveUp);
    return () => {
      alive = false;
      clearTimeout(timer);
      dispose?.();
    };
  }, [set]);

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
