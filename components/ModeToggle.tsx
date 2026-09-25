"use client";

import { useEffect } from "react";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";

// Blue hour or full night: the city's light, switched from the nav and remembered.
export function ModeToggle() {
  const mode = useStore((s) => s.mode);
  const set = useStore((s) => s.set);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("city-mode");
      if (saved === "night" || saved === "dusk") set({ mode: saved });
    } catch {}
  }, [set]);
  useEffect(() => {
    signals.night = mode === "night" ? 1 : 0;
    try {
      localStorage.setItem("city-mode", mode);
    } catch {}
  }, [mode]);
  return (
    <div className="mode" role="group" aria-label="City light">
      {(["dusk", "night"] as const).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => set({ mode: m })}>
          {m === "dusk" ? "Blue hour" : "Night"}
        </button>
      ))}
    </div>
  );
}
