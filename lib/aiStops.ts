/* AI & Automation, as its beats: where its scroll (0..1 through the section) stops, one gesture each
   (lib/stops.ts) — the chip, what we do, how we do it, and how it makes life simple. A beat's
   animation and the page's glide to it run on one clock and end together (AiNetwork.tsx,
   lib/motion.ts: a beat). Also the HUD's chapters. view: the words the HUD shows for it. */
export type AiChapter = { id: string; view: "core" | "what" | "how" | "simple"; at: number; label: string };

// how we do it runs from what we do (0.3) to its last stage complete (0.62); each stage is complete
// at its share of that (where the network's picture of it is whole, just before the next begins)
const HOW_FROM = 0.3, HOW_TO = 0.62;
const howAt = (f: number) => HOW_FROM + (HOW_TO - HOW_FROM) * f;

export const AI_CHAPTERS: AiChapter[] = [
  { id: "core", view: "core", at: 0, label: "Core" }, // the chip, floating
  { id: "what", view: "what", at: HOW_FROM, label: "What we do" }, // it powers on and steps aside: what we do, said plainly
  { id: "how", view: "how", at: howAt(0.345), label: "How we do it" }, // the business comes up round the core and the audit scans it; the stages are toggled from here
  { id: "simple", view: "simple", at: 0.82, label: "Made simple" }, // the business running, inside and out
];

/** Where the AI section's beats land. */
export const AI_STOPS = AI_CHAPTERS.map((c) => c.at);
/** How we do it, stage by stage (audit, evaluate, implement): where on the section's clock each
    stage's picture is whole. The page rests at the first; the others are toggled to from the text
    (AiNetwork.tsx), never scrolled to: the next gesture goes straight on to made simple. */
export const AI_STAGES = [howAt(0.345), howAt(0.645), HOW_TO];
/** Past the last one, the way out to the work. */
export const AI_EXIT_FROM = 0.9;

/* The chip's world, keyed to the same scroll (lib/engine/ai/world.ts): it powers on by `wire` (as
   it always has) and pulls back to the whole network by `chaos`; the camera slides it aside for the
   text between `asideFrom` and `asideTo`; the traces flicker as the work is put in order, from
   `sortFrom` to `order`. */
export const AI_WORLD = { wire: 0.16, chaos: 0.27, asideFrom: 0.2, asideTo: 0.3, sortFrom: 0.51, order: 0.62 };
