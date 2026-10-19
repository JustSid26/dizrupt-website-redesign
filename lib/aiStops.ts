/* AI & Automation, as its beats: where its scroll (0..1 through the section) stops, one gesture each
   (lib/stops.ts) — the chip, what we do, how we do it in its three stages (audit, evaluate,
   implement: a stop each), and how it makes life simple. A beat's animation and the page's glide to
   it run on one clock and end together (AiNetwork.tsx, lib/motion.ts: a beat). Also the HUD's chapters.
   view: the words the HUD shows for it (the three stages share one page of them). */
export type AiChapter = { id: string; view: "core" | "what" | "how" | "simple"; at: number; label: string };

// how we do it runs from what we do (0.3) to its last stage complete (0.62); each stage is complete
// at its share of that (where the network's picture of it is whole, just before the next begins)
const HOW_FROM = 0.3, HOW_TO = 0.62;
const howAt = (f: number) => HOW_FROM + (HOW_TO - HOW_FROM) * f;

export const AI_CHAPTERS: AiChapter[] = [
  { id: "core", view: "core", at: 0, label: "Core" }, // the chip, floating
  { id: "what", view: "what", at: HOW_FROM, label: "What we do" }, // it powers on and steps aside: what we do, said plainly
  { id: "audit", view: "how", at: howAt(0.345), label: "Audit" }, // the business comes up round the core; the scan maps where it breaks
  { id: "evaluate", view: "how", at: howAt(0.645), label: "Evaluate" }, // the viability report ranks what was found
  { id: "implement", view: "how", at: HOW_TO, label: "Implement" }, // the ones worth it wired in and set running
  { id: "simple", view: "simple", at: 0.82, label: "Made simple" }, // the business running, inside and out
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
