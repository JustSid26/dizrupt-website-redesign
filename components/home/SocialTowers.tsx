"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { signals } from "@/lib/signals";
import { SOCIALS } from "@/content/socials";

// Links riding on the social skyscrapers' lit signs at contact (the engine places the signs).
export function SocialTowers() {
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  useEffect(() => {
    const tick = () => {
      refs.current.forEach((el, i) => {
        const r = signals.socials[i];
        if (!el || !r) return;
        el.style.visibility = r.on && r.w > 8 ? "visible" : "hidden";
        el.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
        el.style.width = `${r.w.toFixed(1)}px`;
        el.style.height = `${r.h.toFixed(1)}px`;
      });
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  return (
    <nav aria-label="Dizrupt elsewhere">
      {SOCIALS.map((s, i) => (
        <a
          key={s.name}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="tower-link"
          href={s.href}
          target={s.href.startsWith("mailto") ? undefined : "_blank"}
          rel="noopener noreferrer"
          aria-label={s.name}
          style={{ "--c": s.color } as React.CSSProperties}
        >
          <span>{s.name}</span>
        </a>
      ))}
    </nav>
  );
}
