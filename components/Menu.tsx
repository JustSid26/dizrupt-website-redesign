"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SOLUTIONS } from "@/content/solutions";
import { site } from "@/content/site";
import { signals } from "@/lib/signals";
import { useStore } from "@/lib/store";
import { goToSection } from "@/lib/sections";
import { MumbaiClock } from "@/components/ui/MumbaiClock";

/* The menu is a channel change: nine bands of signal slide in from alternating sides, each trailing
   a red and blue ghost that locks into register as it lands; then the words decode out of noise.
   Hovering a solution hands the particle field that solution's model. */
const BANDS = 9;
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#%&";
const NAV = [
  { id: "solutions", label: "Solutions" },
  { id: "work", label: "Work" },
  { id: "contact", label: "Contact" },
] as const;

function decode(el: HTMLElement, delay: number, reduce: boolean) {
  const text = el.dataset.text ?? "";
  if (reduce) return void (el.textContent = text);
  const start = performance.now() + delay;
  const dur = 380 + text.length * 22;
  const step = (now: number) => {
    const t = (now - start) / dur;
    if (t < 0) {
      el.textContent = text.replace(/\S/g, " ");
      return requestAnimationFrame(step);
    }
    if (t >= 1) return void (el.textContent = text);
    const lock = Math.floor(t * text.length);
    el.textContent = [...text]
      .map((c, i) => (c === " " ? " " : i < lock ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
      .join("");
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function Menu() {
  const open = useStore((s) => s.menuOpen);
  const set = useStore((s) => s.set);
  const reduce = useStore((s) => s.reducedMotion);
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [on, setOn] = useState(-1);
  const router = useRouter();
  const pathname = usePathname();

  const close = useCallback(() => set({ menuOpen: false }), [set]);

  useEffect(() => {
    signals.menuOpen = open;
    document.body.classList.toggle("menu-open", open);
    if (open) {
      setMounted(true);
      setClosing(false);
      requestAnimationFrame(() => {
        root.current?.classList.add("open");
        root.current?.querySelectorAll<HTMLElement>(".menu-word").forEach((w, i) => decode(w, 380 + i * 55, reduce));
      });
      return;
    }
    signals.preview = null;
    setOn(-1);
    if (!root.current) return;
    root.current.classList.remove("open");
    setClosing(true);
    const t = setTimeout(() => (setMounted(false), setClosing(false)), reduce ? 0 : 700);
    return () => clearTimeout(t);
  }, [open, reduce]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [open, close]);

  const go = (id: string) => {
    close();
    if (pathname !== "/") {
      sessionStorage.setItem("home-target", id);
      router.push("/");
    } else setTimeout(() => goToSection(id), 250);
  };
  const preview = (i: number) => {
    setOn(i);
    signals.preview = i < 0 ? null : { shape: SOLUTIONS[i].shape, colors: SOLUTIONS[i].colors };
  };

  return (
    <div
      ref={root}
      className={`menu${closing ? " closing" : ""}`}
      id="menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      hidden={!mounted}
    >
      <div className="menu-bands" aria-hidden>
        {Array.from({ length: BANDS }, (_, i) => (
          <span key={i} className="menu-band" style={{ "--i": i, "--dir": i % 2 ? 1 : -1 } as React.CSSProperties} />
        ))}
      </div>
      <div className="menu-inner">
        <nav className="menu-nav" aria-label="Site">
          <p className="menu-label">
            <span className="hud-no">{"//"}</span> Navigate
          </p>
          <ul>
            {NAV.map((n, i) => (
              <li key={n.id}>
                <button type="button" onClick={() => go(n.id)}>
                  <span className="menu-no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="menu-word" data-text={n.label} aria-label={n.label}>
                    {n.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="menu-foot">
            <a className="u-link" href={`mailto:${site.contact.email}`}>
              {site.contact.email}
            </a>
            <span>
              Mumbai · <MumbaiClock /> IST
            </span>
          </div>
        </nav>
        <section className="menu-solutions" aria-labelledby="menu-sol-title">
          <p className="menu-label" id="menu-sol-title">
            <span className="hud-no">{String(SOLUTIONS.length).padStart(2, "0")}</span> Solutions
          </p>
          <ol onPointerLeave={() => preview(-1)}>
            {SOLUTIONS.map((s, i) => (
              <li key={s.name}>
                <button
                  type="button"
                  className={`sol${on === i ? " is-on" : ""}`}
                  style={{ "--a": s.colors[0], "--b": s.colors[1] } as React.CSSProperties}
                  onPointerEnter={() => preview(i)}
                  onFocus={() => preview(i)}
                  onClick={() => go(`solution-${i}`)}
                >
                  <span className="menu-no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="sol-body">
                    <span className="menu-word sol-name" data-text={s.name} aria-label={s.name}>
                      {s.name}
                    </span>
                    <span className="sol-line">{s.line}</span>
                    <span className="sol-work">{s.work}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
