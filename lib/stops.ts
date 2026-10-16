import { SOLUTIONS } from "@/content/solutions";
import { clients } from "@/content/projects";
import { AI_CHAPTERS, AI_STOPS } from "@/lib/aiStops";

/* The train's stops, as scroll positions: the start station at the end of the landing, then each
   billboard. Between them the scroll doesn't wander — one gesture carries you to the next stop. */
const N = SOLUTIONS.length;

// where Solutions' own scroll has the train standing at stop k (see Solutions.tsx: x counts stops)
const solutionsProgress = (k: number) => Math.min(1, 0.01 + (0.99 * Math.min(k + 0.01, N)) / N);

export function stopPositions() {
  const intro = document.getElementById("intro");
  const sol = document.getElementById("solutions");
  if (!intro || !sol) return [];
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

/* Every place the scroll rests between the DIZRUPT screen and the last billboard. One gesture
   carries you from one to the next at a fixed pace, so the animation between them plays out the
   same however hard you scroll. `dur` is the ride into this stop from the one before it (and back);
   `train` is the stop the train drives itself to, or null while it is still in the intro. */
export type ScrollStop = { y: number; dur: number; train: number | null; pass?: boolean }; // pass: a waypoint the ride carries on through, either way

/** The one pace of the site: every gesture from one stop to the next takes this long, wherever it is.
    Only the two longer stretches of the landing (the city building itself, the figure turning into the
    count) take a set multiple of it, because each plays a whole scene. */
export const STEP = 3.4;
/** Seconds the page takes to glide from one AI beat to the next (its animation runs on its own clock). */
const AI_GLIDE = 1.4;

export function scrollStops(): ScrollStop[] {
  const intro = document.getElementById("intro");
  const lp = landingPositions();
  const ys = stopPositions();
  if (!intro || !lp || ys.length < 2) return [];
  const top = intro.getBoundingClientRect().top + scrollY;
  const span = intro.offsetHeight - innerHeight;
  const bridge = document.getElementById("bridge"), ai = document.getElementById("ai");
  return [
    { y: lp.start, dur: 0, train: null }, // DIZRUPT
    { y: lp.built, dur: STEP * 1.6, train: null }, // the city built, him standing in it
    // the count, in its windows: late in it, so the ride on starts where the camera does (0.76)
    { y: top + span * introRaw(0.72), dur: STEP * 1.5, train: null }, // slow: the figure dissolving into the count is worth watching
    { y: ys[0], dur: STEP, train: 0 }, // the station built, the train at it
    // pulling out of the station is the first ride: slower than the hops between billboards
    ...ys.slice(1).map((y, i) => ({ y, dur: STEP, train: i + 1 })), // each billboard
    // on to AI & Automation in two: him whole again, the line read (Bridge.tsx: its progress runs from
    // its top at the middle of the screen to its bottom there; the line is up at 0.28–0.42) …
    ...(bridge ? [{ y: bridge.offsetTop - innerHeight / 2 + bridge.offsetHeight * 0.36, dur: STEP, train: null }] : []),
    // … then into his heart and through the glitch to the chip, floating in the dark …
    ...(ai ? [{ y: ai.offsetTop + 2, dur: STEP, train: null }] : []),
    /* … and one gesture per beat of AI & Automation: powered on, the business as it is, in order, said
       plainly. The page glides to each; the beat's animation plays in time at its own pace
       (AiNetwork.tsx), whatever the gesture was. */
    ...(ai ? AI_CHAPTERS.slice(1).filter((c) => !c.through).map((c) => ({ y: ai.offsetTop + (ai.offsetHeight - innerHeight) * c.at, dur: AI_GLIDE, train: null })) : []),
  ];
}

/* The work: a camera through a tower of windows (Projects.tsx). Its scroll runs p from -WORK_LEAD
   (the whole tower) through 0..N-1 (project k filling the screen) to N-1+WORK_LEAD (pulled back
   out). One gesture flies from one project to the next, at the camera's own pace. */
export const WORK_LEAD = 0.6;
export const workP = (progress: number) => -WORK_LEAD + progress * (clients.length - 1 + WORK_LEAD * 2);
export const workProgress = (p: number) => (p + WORK_LEAD) / (clients.length - 1 + WORK_LEAD * 2);

/** Seconds for the camera to fly from one project's window to the next. */
const WORK_STEP = STEP;

export function workStops(): ScrollStop[] {
  const work = document.getElementById("work");
  if (!work) return [];
  const top = work.getBoundingClientRect().top + scrollY, span = work.offsetHeight - innerHeight;
  const stops: ScrollStop[] = clients.map((_, k) => ({ y: top + span * workProgress(k), dur: k ? WORK_STEP : 0, train: null }));
  /* led in from AI & Automation's statement: from there one gesture plays the whole way out at its
     own pace, however far you scroll — the network clears and the glitch hands back to the city
     (it plays in time as the section's end passes), the tower's wide shot, then in to the first
     window — in three legs that carry on through each other */
  const ai = document.getElementById("ai");
  if (ai) {
    const at = (p: number) => ai.getBoundingClientRect().top + scrollY + (ai.offsetHeight - innerHeight) * p;
    stops[0].dur = STEP;
    stops.unshift(
      { y: at(AI_STOPS[AI_STOPS.length - 1]), dur: 0, train: null },
      { y: at(0.97), dur: STEP * 0.6, train: null, pass: true },
      { y: top + 2, dur: STEP * 0.4, train: null, pass: true },
    );
  }
  /* and from the last project, one gesture all the way out: the camera pulls back from the tower and
     the contact comes up, landing at the foot of the page where it has fully arrived */
  const contact = document.getElementById("contact");
  if (contact) {
    const end = Math.min(contact.offsetTop + contact.offsetHeight - innerHeight, document.documentElement.scrollHeight - innerHeight);
    if (end > stops[stops.length - 1].y + 1) stops.push({ y: end, dur: STEP, train: null });
  }
  return stops;
}
