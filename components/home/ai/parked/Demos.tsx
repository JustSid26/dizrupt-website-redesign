"use client";

/* PARKED: not used on the site right now (kept for later). Its timings are its own miniatures' and
   predate the tempo (lib/motion.ts): move them onto it if it comes back.
   The four service demonstrations for the AI section: Lead Engine, Payment Recon, PostStack and
   Try-On, each a small working miniature played when its service comes up. Their styles are in
   ./demos.css (not loaded anywhere yet).
   To bring them back: add a chapter per service after "close" in lib/aiStops.ts, e.g.
     { id: "lead-gen", at: …, dur: 2.6, label: "Lead Engine" }, (and payment-recon, post-stack,
     virtual-tryon), give the section more height in AiAutomation.tsx, and render one demo per
     TECH_PROJECTS entry with `active` set while its chapter is the current one and `flow` from the
     project's `flow`. */

import { useState } from "react";
import { useDemo } from "@/components/home/ai/parked/useDemo";

/* Each service shown doing its job, small: a working miniature of what the product does, played
   when its service is up and again on its button. The data is illustrative. */

type DemoProps = { active: boolean; reduce: boolean; flow: string[]; title: string };

function Frame({ title, flow, step, action, onRun, children, className }: { title: string; flow: string[]; step: number; action: string; onRun: () => void; children: React.ReactNode; className: string }) {
  return (
    <div className={`aid ${className}`}>
      <div className="aid-bar">
        <span className="ain-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <strong>{title}</strong>
        <button type="button" className="aid-run" onClick={onRun}>
          {action} <span aria-hidden>↻</span>
        </button>
      </div>
      <div className="aid-stage" aria-hidden>
        {children}
      </div>
      <ol className="aid-steps" aria-label="How it works">
        {flow.map((f, i) => (
          <li key={f} data-on={i <= step || undefined} data-now={i === step || undefined}>
            <span>{String(i + 1).padStart(2, "0")}</span> {f}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- Lead Engine: a one-line brief becomes scored leads and a drafted intro ---------- */
const BRIEF = "Find diamond jewellers in Kraków";
const FOUND = [
  { name: "Złota Nić Jewellers", site: "zlotanic.pl", mail: "biuro@zlotanic.pl", score: 92 },
  { name: "Amber & Oak", site: "amberoak.pl", mail: "hello@amberoak.pl", score: 81 },
  { name: "Wawel Diamonds", site: "waweldiamonds.pl", mail: "sales@waweld…", score: 67 },
];

export function LeadDemo({ active, reduce, flow, title }: DemoProps) {
  const { root, step, run } = useDemo(active, reduce, (tl, q) => {
    const typed = q(".ld-typed")[0] as HTMLElement;
    const n = { v: 0 };
    tl.addLabel("0")
      .fromTo(n, { v: 0 }, { v: BRIEF.length, duration: 1.1, ease: "none", onUpdate: () => void (typed.textContent = BRIEF.slice(0, Math.round(n.v))) })
      .fromTo(q(".ld-row"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.16, ease: "power2.out" }, "+=0.15")
      .addLabel("1", "+=0.2")
      .fromTo(q(".ld-mail"), { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.14 }, "1")
      .addLabel("2", "+=0.25")
      .fromTo(q(".ld-bar i"), { scaleX: 0 }, { scaleX: 1, duration: 0.6, stagger: 0.12, ease: "power2.out" }, "2")
      .fromTo(q(".ld-score"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, stagger: 0.12 }, "2+=0.3")
      .fromTo(q(".ld-row")[0], { "--hot": 0 }, { "--hot": 1, duration: 0.3 }, "2+=0.7")
      .addLabel("3", "+=0.3")
      .fromTo(q(".ld-draft"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" }, "3")
      .fromTo(q(".ld-line"), { scaleX: 0 }, { scaleX: 1, duration: 0.35, stagger: 0.12, ease: "power1.out" }, "3+=0.25")
      .to(q(".ld-status em")[0], { autoAlpha: 0, duration: 0.15 }, "+=0.35")
      .fromTo(q(".ld-status em")[1], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, "<")
      .to(q(".ld-status em")[1], { autoAlpha: 0, duration: 0.15 }, "+=0.7")
      .fromTo(q(".ld-status em")[2], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, "<")
      .to({}, { duration: 1.6 });
  });
  return (
    <div ref={root}>
      <Frame className="aid-lead" title={title} flow={flow} step={step} action="Run the brief" onRun={run}>
        <div className="ld-search">
          <span className="ld-icon" />
          <span className="ld-typed">{BRIEF}</span>
          <i className="ld-caret" />
        </div>
        <div className="ld-table">
          {FOUND.map((f) => (
            <div key={f.name} className="ld-row">
              <span className="ld-name">
                <b>{f.name}</b>
                <small>{f.site}</small>
              </span>
              <span className="ld-mail">{f.mail}</span>
              <span className="ld-bar">
                <i style={{ width: `${f.score}%` }} />
              </span>
              <span className="ld-score">{f.score}</span>
            </div>
          ))}
        </div>
        <div className="ld-draft">
          <p>
            <b>To:</b> biuro@zlotanic.pl <span className="ld-status"><em>Queued</em><em>Sent</em><em>Opened</em></span>
          </p>
          <i className="ld-line" style={{ width: "92%" }} />
          <i className="ld-line" style={{ width: "78%" }} />
          <i className="ld-line" style={{ width: "54%" }} />
        </div>
      </Frame>
    </div>
  );
}

/* ---------- Payment Recon: transactions matched to what the bank settled ---------- */
const TXNS = [
  { ref: "TXN 7781 · UPI", amt: "₹48,000" },
  { ref: "TXN 7782 · Card", amt: "₹1,12,500" },
  { ref: "TXN 7783 · NEFT", amt: "₹2,40,000" },
  { ref: "TXN 7784 · UPI", amt: "₹10,000" },
];
const SETTLED = [
  { ref: "STL 0412", amt: "₹1,12,500" },
  { ref: "STL 0413", amt: "₹48,000" },
  { ref: "STL 0414", amt: "₹2,40,000" },
  { ref: "STL 0415", amt: "₹9,990" },
];
const PAIRS: [number, number][] = [[0, 1], [1, 0], [2, 2], [3, 3]]; // transaction → settlement
const ROW = 34, HEAD = 26;
const inr = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v);
const NET = 398475; // the three that tie out (₹4,00,500), less the card fee (₹2,025); the short one held

export function ReconDemo({ active, reduce, flow, title }: DemoProps) {
  const { root, step, run } = useDemo(active, reduce, (tl, q) => {
    const net = q(".rc-net b")[0] as HTMLElement;
    const v = { n: 0 };
    tl.addLabel("0")
      .fromTo(q(".rc-col li"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.07, ease: "power2.out" })
      .addLabel("1", "+=0.25")
      .fromTo(q(".rc-wire"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, stagger: 0.3, ease: "power1.inOut" }, "1")
      .fromTo(q(".rc-ok"), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.25, stagger: 0.3, ease: "back.out(2)" }, "1+=0.35")
      .addLabel("2", "+=0.2")
      .fromTo(q(".rc-fee"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.15 }, "2")
      .addLabel("3", "+=0.3")
      .fromTo(q(".rc-net"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, "3")
      .fromTo(v, { n: 0 }, { n: NET, duration: 1.1, ease: "power2.out", onUpdate: () => void (net.textContent = inr(Math.round(v.n * 100) / 100)) }, "3")
      .fromTo(q(".rc-done"), { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.3 }, "+=0.1")
      .to({}, { duration: 1.6 });
  });
  const h = HEAD + ROW * 4;
  return (
    <div ref={root}>
      <Frame className="aid-recon" title={title} flow={flow} step={step} action="Reconcile" onRun={run}>
        <div className="rc-cols">
          <ul className="rc-col">
            <li className="rc-h">Transactions</li>
            {TXNS.map((t, i) => (
              <li key={t.ref}>
                <span>{t.ref}</span>
                <b>{t.amt}</b>
                <em className={`rc-ok${i === 3 ? " is-warn" : ""}`}>{i === 3 ? "Held" : "✓"}</em>
              </li>
            ))}
          </ul>
          <svg className="rc-wires" viewBox={`0 0 60 ${h}`} preserveAspectRatio="none" style={{ height: h }}>
            {PAIRS.map(([a, b], i) => {
              const y1 = HEAD + ROW * a + ROW / 2, y2 = HEAD + ROW * b + ROW / 2;
              return <path key={i} className={`rc-wire${i === 3 ? " is-warn" : ""}`} pathLength={1} d={`M0 ${y1} C30 ${y1} 30 ${y2} 60 ${y2}`} />;
            })}
          </svg>
          <ul className="rc-col">
            <li className="rc-h">Bank settled</li>
            {SETTLED.map((s, i) => (
              <li key={s.ref}>
                <span>{s.ref}</span>
                <b>{s.amt}</b>
                <em className={`rc-ok${i === 3 ? " is-warn" : ""}`}>{i === 3 ? "Short ₹10" : "✓"}</em>
              </li>
            ))}
          </ul>
        </div>
        <div className="rc-foot">
          <span className="rc-fee">Card fee 1.8% · −₹2,025.00</span>
          <span className="rc-fee is-warn">Exception held for review · ₹10,000.00</span>
          <span className="rc-net">
            Net payout <b>{inr(NET)}</b>
          </span>
          <span className="rc-done">Statement ready</span>
        </div>
      </Frame>
    </div>
  );
}

/* ---------- PostStack: one post from draft to published on every channel ---------- */
const CHANNELS = ["Instagram", "LinkedIn", "X", "Facebook"];

export function PostDemo({ active, reduce, flow, title }: DemoProps) {
  const { root, step, run } = useDemo(active, reduce, (tl, q) => {
    const card = q(".ps-card");
    tl.addLabel("0")
      .fromTo(card, { autoAlpha: 0, y: 14, xPercent: 0 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" })
      .fromTo(q(".ps-cap i"), { scaleX: 0 }, { scaleX: 1, duration: 0.4, stagger: 0.12 }, "<0.15")
      .addLabel("1", "+=0.35")
      .to(card, { xPercent: 100, duration: 0.6, ease: "power3.inOut" }, "1")
      .fromTo(q(".ps-chat"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, "1+=0.45")
      .addLabel("2", "+=0.45")
      .to(card, { xPercent: 200, duration: 0.6, ease: "power3.inOut" }, "2")
      .fromTo(q(".ps-when"), { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, "2+=0.45")
      .addLabel("3", "+=0.45")
      .to(card, { xPercent: 300, duration: 0.6, ease: "power3.inOut" }, "3")
      .fromTo(q(".ps-ch"), { "--on": 0 }, { "--on": 1, duration: 0.25, stagger: 0.14 }, "3+=0.45")
      .fromTo(q(".ps-live"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, ">-0.1")
      .to({}, { duration: 1.6 });
  });
  return (
    <div ref={root}>
      <Frame className="aid-post" title={title} flow={flow} step={step} action="Schedule a post" onRun={run}>
        <div className="ps-board">
          {flow.map((f) => (
            <span key={f} className="ps-colh">
              {f}
            </span>
          ))}
          <div className="ps-lane">
            <div className="ps-card">
              <i className="ps-img" />
              <span className="ps-cap">
                New collection drops Friday ✦
                <i />
                <i />
              </span>
              <span className="ps-when">Fri · 10:00</span>
            </div>
          </div>
        </div>
        <div className="ps-foot">
          <p className="ps-chat">
            <b>Client</b> Looks great, approved ✓
          </p>
          <ul className="ps-chans">
            {CHANNELS.map((c) => (
              <li key={c} className="ps-ch">
                {c}
              </li>
            ))}
          </ul>
          <span className="ps-live">Published on 4 channels</span>
        </div>
      </Frame>
    </div>
  );
}

/* ---------- Try-On: the real piece placed on a person, from two photos ----------
   A schematic of the pipeline, not a render: the person and the piece are drawn, the landmarks are
   where it finds them (shoulders for a necklace, the jaw for earrings), and the before/after slider
   is the product's own. */
export function TryOnDemo({ active, reduce, flow, title }: DemoProps) {
  const [split, setSplit] = useState(38); // where the line is, in percent: before to its left, after to its right
  const { root, step, run } = useDemo(active, reduce, (tl, q) => {
    tl.addLabel("0")
      .fromTo(q(".to-in"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.15, ease: "power2.out" })
      .fromTo(q(".to-bust"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, "<0.2")
      .addLabel("1", "+=0.3")
      .fromTo(q(".to-bone"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, stagger: 0.1 }, "1")
      .fromTo(q(".to-mark"), { autoAlpha: 0, scale: 0, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.25, stagger: 0.08, ease: "back.out(2.5)" }, "1+=0.1")
      .addLabel("2", "+=0.3")
      .fromTo(q(".to-piece"), { x: -150, y: -66, scale: 0.42, autoAlpha: 1 }, { x: 0, y: 0, scale: 1, duration: 0.9, ease: "power3.inOut" }, "2")
      .to(q(".to-bone, .to-mark"), { autoAlpha: 0.25, duration: 0.3 }, "2+=0.6")
      .addLabel("3", "+=0.25")
      .fromTo(q(".to-light"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, "3")
      .fromTo(q(".to-split"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, "3+=0.3")
      .to({}, { duration: 1.6 });
  });
  return (
    <div ref={root}>
      <Frame className="aid-tryon" title={title} flow={flow} step={step} action="Try it on" onRun={run}>
        <div className="to-scene" style={{ "--split": `${split}%` } as React.CSSProperties}>
          <svg viewBox="0 0 320 210" className="to-svg">
            <defs>
              <radialGradient id="to-glow" cx="50%" cy="40%" r="60%">
                <stop offset="0" stopColor="#ffe9b0" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
              </radialGradient>
              <clipPath id="to-after">
                <rect x={(320 * split) / 100} y="0" width={320 - (320 * split) / 100} height="210" />
              </clipPath>
            </defs>
            {/* the inputs: the piece's own photo, and the person's */}
            <g className="to-in">
              <rect x="10" y="12" width="66" height="54" rx="6" className="to-card" />
              <text x="43" y="80" className="to-cap">product</text>
            </g>
            <g className="to-in">
              <rect x="10" y="94" width="66" height="54" rx="6" className="to-card" />
              <circle cx="43" cy="114" r="9" className="to-thumb" />
              <path d="M24 148 C26 130 60 130 62 148 Z" className="to-thumb" />
              <text x="43" y="162" className="to-cap">person</text>
            </g>
            {/* the person, as the camera has them */}
            <g className="to-bust">
              <ellipse cx="208" cy="62" rx="27" ry="33" className="to-skin" />
              <path d="M194 88 L222 88 L224 112 L192 112 Z" className="to-skin" />
              <path d="M128 210 C130 150 168 120 196 110 L220 110 C248 120 286 150 288 210 Z" className="to-cloth" />
            </g>
            {/* where it finds the body: shoulders, the base of the neck, the jaw */}
            <path className="to-bone" pathLength={1} d="M160 128 L208 116 L256 128" />
            <path className="to-bone" pathLength={1} d="M188 78 L208 96 L228 78" />
            {[[160, 128], [256, 128], [208, 116], [188, 78], [228, 78]].map(([x, y]) => (
              <circle key={`${x}-${y}`} className="to-mark" cx={x} cy={y} r="4" />
            ))}
            {/* the real piece, placed on those points (and the relight), on the "after" side */}
            <g clipPath="url(#to-after)">
              <g className="to-piece" style={{ transformOrigin: "208px 130px" }}>
                <path d="M182 112 C188 136 228 136 234 112" className="to-chain" />
                <path d="M208 134 L214 142 L208 152 L202 142 Z" className="to-gem" />
              </g>
              <ellipse className="to-light" cx="208" cy="120" rx="80" ry="70" fill="url(#to-glow)" />
            </g>
            <g className="to-split">
              <line x1={(320 * split) / 100} x2={(320 * split) / 100} y1="0" y2="210" />
              <text x={(320 * split) / 100 - 6} y="200" textAnchor="end">before</text>
              <text x={(320 * split) / 100 + 6} y="200">after</text>
            </g>
          </svg>
        </div>
      </Frame>
      <label className="to-range">
        <span>Before / after</span>
        <input type="range" min={0} max={70} value={split} onChange={(e) => setSplit(Number(e.target.value))} />
      </label>
    </div>
  );
}
