import { SOLUTIONS } from "@/content/solutions";
import { clients } from "@/content/projects";
import { AI_CHAPTERS, AI_STOPS } from "@/lib/aiStops";
import { isPhoneLayout } from "@/lib/layout";
import type { RideKind } from "@/lib/motion";

/* The train's stops, as scroll positions: the start station at the end of the landing, then each
   billboard. Between them the scroll doesn't wander — one gesture carries you to the next stop. */
const N = SOLUTIONS.length;

// where Solutions' own scroll has the train standing at stop k (see Solutions.tsx: x counts stops)
const solutionsProgress = (k: number) => Math.min(1, 0.01 + (0.99 * Math.min(k + 0.01, N)) / N);

export function stopPositions() {
  const intro = document.getElementById("intro");
  const sol = document.getElementById("solutions");
  if (!intro || !sol) return [];
  // a phone: no train; the intro's end, then the cards (the section's top)
  if (isPhoneLayout()) return [intro.offsetTop + intro.offsetHeight - innerHeight, sol.getBoundingClientRect().top + scrollY];
  const iSpan = intro.offsetHeight - innerHeight;
  // Solutions' ride runs from its top reaching the bottom of the screen (see Solutions.tsx)
  const sTop = sol.getBoundingClientRect().top + scrollY - innerHeight;
  const sSpan = sol.offsetHeight;
  const ys = [intro.getBoundingClientRect().top + scrollY + iSpan * 0.995]; // the train at its station
  for (let k = 1; k <= N; k++) ys.push(sTop + sSpan * solutionsProgress(k));
  return ys;
}

/* The landing plays itself: one gesture from the DIZRUPT screen runs the whole build-up (the city,
   the billboard's rig, him beamed in) and lands where he stands whole in the city. Where that is,
   as a scroll position: intro progress 0.42, through the reshaping in Intro.tsx (0.5 at 0.675). */
export function landingPositions() {
  const intro = document.getElementById("intro");
  if (!intro) return null;
  const top = intro.getBoundingClientRect().top + scrollY;
  const span = intro.offsetHeight - innerHeight;
  return { start: top, built: top + span * (0.42 / 0.5) * 0.675 };
}

// the intro's scroll, reshaped (see Intro.tsx): the raw progress at which its own progress is p
const introRaw = (p: number) =>
  p <= 0.5 ? (p / 0.5) * 0.675 : p <= 0.76 ? 0.675 + ((p - 0.5) / 0.26) * 0.15 : 0.825 + ((p - 0.76) / 0.24) * 0.175;

/* Every place the scroll rests from the DIZRUPT screen to the contact. One gesture carries you from
   one to the next at a fixed pace, so the animation between them plays out the same however hard you
   scroll. `kind` is the ride into this stop from the one before it (and back, quicker: lib/motion.ts),
   by what changes on screen: a hop within a scene, a scene change, or one of the landing's two
   payoffs; `train` is the stop the train drives itself to, or null while it is still in the intro. */
/* onward: the page doesn't rest here; it carries on to the next stop by itself (SmoothScroll.tsx), after
   its usual dwell, or after this many ms */
export type ScrollStop = { y: number; kind: RideKind; train: number | null; slow?: number; onward?: boolean | number };

/** The runs of stops from the DIZRUPT screen to AI & Automation's last beat. On a phone the train is
    gone and Solutions is a row of cards swiped across: one stop, the sections either side of it. */
export function scrollRuns(): ScrollStop[][] {
  const intro = document.getElementById("intro");
  const lp = landingPositions();
  const ys = stopPositions();
  if (!intro || !lp || ys.length < 2) return [];
  const top = intro.getBoundingClientRect().top + scrollY;
  const span = intro.offsetHeight - innerHeight;
  const bridge = document.getElementById("bridge"), ai = document.getElementById("ai");
  const landing: ScrollStop[] = [
    { y: lp.start, kind: "hop", train: null }, // DIZRUPT (nothing rides into it)
    { y: lp.built, kind: "signature", train: null }, // the city built, him standing in it
    // the count, in its windows: late in it, so the ride on starts where the camera does (0.76)
    { y: top + span * introRaw(0.72), kind: "signature", train: null }, // the figure dissolving into the count is worth watching
  ];
  const phone = isPhoneLayout();
  const onward: ScrollStop[] = [
    /* on to AI & Automation. A wide screen in two: him whole again, seen for a moment (Bridge.tsx:
       its progress runs from its top at the middle of the screen to its bottom there), and the page
       carries itself on into his heart. A phone in one: from the cards, one ride the whole way, out
       to him whole and in to his heart and the chip, nothing to scroll for in between. */
    ...(bridge && !phone ? [{ y: bridge.offsetTop - innerHeight / 2 + bridge.offsetHeight * 0.36, kind: "scene" as const, train: null, onward: 1200 }] : []),
    // … then into his heart and through the glitch to the chip, floating in the dark: seen for a moment,
    // and the page carries on by itself into what we do, so the chip isn't left standing still …
    ...(ai ? [{ y: ai.offsetTop + 2, kind: phone ? ("passage" as const) : ("scene" as const), train: null, onward: 600 }] : []),
    /* … and one gesture per beat of AI & Automation: powered on, the three stages of how, said
       plainly. The page glides to each and the beat's animation plays on the same clock, ending as the
       page lands (AiNetwork.tsx). */
    ...(ai ? AI_CHAPTERS.slice(1).map((c, i) => ({
      y: ai.offsetTop + (ai.offsetHeight - innerHeight) * c.at,
      // the first, from the chip, is its power-on and pull back (a wide screen's 3D; a phone's chip is flat)
      kind: i === 0 && !isPhoneLayout() ? ("wake" as const) : ("beat" as const),
      train: null,
    })) : []),
  ];
  // a phone: the cards are one stop (swiped across, not ridden through) between the count and the bridge
  if (isPhoneLayout()) return [[...landing, { y: ys[1], kind: "scene", train: null }, ...onward]];
  return [[
    ...landing,
    { y: ys[0], kind: "scene", train: 0 }, // the station built, the train at it
    // each billboard: the first a flight from the station, then hops along the line
    ...ys.slice(1).map((y, i) => ({ y, kind: i === 0 ? ("depart" as const) : ("hop" as const), train: i + 1 })),
    ...onward,
  ]];
}

/* The work: a camera through a tower of windows (Projects.tsx). Its scroll runs p from -WORK_LEAD
   (the whole tower) through 0..N-1 (project k filling the screen) to N-1+WORK_LEAD (pulled back
   out). One gesture flies from one project to the next, at the camera's own pace. */
export const WORK_LEAD = 0.6;
export const workP = (progress: number) => -WORK_LEAD + progress * (clients.length - 1 + WORK_LEAD * 2);
export const workProgress = (p: number) => (p + WORK_LEAD) / (clients.length - 1 + WORK_LEAD * 2);

export function workStops(): ScrollStop[] {
  const work = document.getElementById("work");
  if (!work) return [];
  const top = work.getBoundingClientRect().top + scrollY, span = work.offsetHeight - innerHeight;
  // one window to the next: a hop, a little slower (lib/motion.ts: window)
  const stops: ScrollStop[] = clients.map((_, k) => ({ y: top + span * workProgress(k), kind: "window", train: null }));
  /* the whole tower, seen across the street with WORK on the hoarding at its foot. A wide screen
     rests there a moment, then carries itself on in to the first window (SmoothScroll.tsx: onward).
     A phone doesn't stop at all: from AI & Automation one ride runs out to the whole tower and on in
     to the first window, nothing to scroll for in between. */
  const phone = isPhoneLayout();
  stops[0].kind = "scene";
  if (!phone) stops.unshift({ y: top, kind: "scene", train: null, onward: 1500 });
  /* led in from AI & Automation's statement: from there one gesture is one ride the whole way out —
     the network clears and the glitch hands back to the city inside it (it plays in time as the
     section's end passes), to the tower's wide shot (a phone: and in to the window) */
  const ai = document.getElementById("ai");
  if (ai) {
    const at = (p: number) => ai.getBoundingClientRect().top + scrollY + (ai.offsetHeight - innerHeight) * p;
    stops[0].kind = phone ? "sweep" : "passage";
    // the ride lingers over its first stretch, to the section's end: the network clearing and the glitch
    // (a wide screen; a phone doesn't linger, so the tower comes up sooner)
    const from = at(AI_STOPS[AI_STOPS.length - 1]), end = ai.getBoundingClientRect().top + scrollY + ai.offsetHeight - innerHeight;
    if (!phone) stops[0].slow = Math.min(0.9, Math.max(0, (end - from) / Math.max(1, stops[0].y - from)));
    stops.unshift({ y: at(AI_STOPS[AI_STOPS.length - 1]), kind: "beat", train: null });
  }
  /* and from the last project, one gesture all the way out: the camera pulls back from the tower and
     the contact comes up, landing at the foot of the page where it has fully arrived */
  const contact = document.getElementById("contact");
  if (contact) {
    const end = Math.min(contact.offsetTop + contact.offsetHeight - innerHeight, document.documentElement.scrollHeight - innerHeight);
    if (end > stops[stops.length - 1].y + 1) stops.push({ y: end, kind: "scene", train: null });
  }
  return stops;
}
