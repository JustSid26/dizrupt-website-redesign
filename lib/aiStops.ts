/* AI & Automation, as its beats: where its scroll (0..1 through the section) stops, one gesture each
   (lib/stops.ts) — the chip, what we do, how we do it (audit, evaluate, implement, played on one
   page), and how it makes life simple. Each beat's animation plays in time at its own pace
   (AiNetwork.tsx). Also the HUD's chapters. */
/* through: no scroll stop of its own, the gesture before it carries on through it; hold: seconds it
   is held on the way through; len: seconds the ride into it takes (else its share of the scroll) */
export type AiChapter = { id: string; at: number; label: string; through?: boolean; hold?: number; len?: number };

export const AI_CHAPTERS: AiChapter[] = [
  { id: "core", at: 0, label: "Core" }, // the chip, floating
  { id: "what", at: 0.3, label: "What we do", len: 3.4 }, // it powers on and steps aside: what we do, said plainly
  { id: "how", at: 0.62, label: "How we do it", len: 8.5 }, // audit, evaluate, implement, one after the other
  { id: "simple", at: 0.82, label: "Made simple", len: 3.4 }, // the business running, inside and out
];

/** Where the AI section's beats land. */
export const AI_STOPS = AI_CHAPTERS.map((c) => c.at);
/** Past the last one, the way out to the work. */
export const AI_EXIT_FROM = 0.9;

/* The chip's world, keyed to the same scroll (lib/engine/ai/world.ts): it powers on by `wire` (as
   it always has) and pulls back to the whole network by `chaos`; the camera slides it aside for the
   text between `asideFrom` and `asideTo`; the traces flicker as the work is put in order, from
   `sortFrom` to `order`. */
export const AI_WORLD = { wire: 0.16, chaos: 0.27, asideFrom: 0.2, asideTo: 0.3, sortFrom: 0.51, order: 0.62 };
