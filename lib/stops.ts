import { SOLUTIONS } from "@/content/solutions";
import { clients } from "@/content/projects";
import { AI_STOPS } from "@/lib/aiStops";

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

export function scrollStops(): ScrollStop[] {
  const intro = document.getElementById("intro");
  const lp = landingPositions();
  const ys = stopPositions();
  if (!intro || !lp || ys.length < 2) return [];
  const top = intro.getBoundingClientRect().top + scrollY;
  const span = intro.offsetHeight - innerHeight;
  const bridge = document.getElementById("bridge"), ai = document.getElementById("ai"), work = document.getElementById("work");
  return [
    { y: lp.start, dur: 0, train: null }, // DIZRUPT
    { y: lp.built, dur: 5.5, train: null }, // the city built, him standing in it
    // the count, in its windows: late in it, so the ride on starts where the camera does (0.76)
    { y: top + span * introRaw(0.72), dur: 2.6, train: null },
    { y: ys[0], dur: 2.8, train: 0 }, // the station built, the train at it
    // pulling out of the station is the first ride: slower than the hops between billboards (4.35s)
    ...ys.slice(1).map((y, i) => ({ y, dur: i === 0 ? 4.35 : 3.5, train: i + 1 })), // each billboard
    // on to AI & Automation in two: him whole again, the line read (Bridge.tsx: its progress runs from
    // its top at the middle of the screen to its bottom there; the line is up at 0.28–0.42) …
    ...(bridge ? [{ y: bridge.offsetTop - innerHeight / 2 + bridge.offsetHeight * 0.36, dur: 3.6, train: null }] : []),
    // … then into his heart and through the glitch to the chip
    ...(ai ? [{ y: ai.offsetTop + 2, dur: 3.8, train: null }] : []),
    // AI & Automation's own stops: the whole board, then each of its projects (AiAutomation.tsx) …
    ...(ai ? AI_STOPS.slice(1).map((st, i) => ({ y: ai.offsetTop + (ai.offsetHeight - innerHeight) * st, dur: i === 0 ? 3 : 2.6, train: null })) : []),
    /* … then one swipe out to the work, played in three legs, each at its own pace, so it can be
       followed: the AI world's way out (the network fires, the screens break up) …; the glitch back to
       the city (it plays in time, 2s, as the section's end passes) and the tower's wide shot …; then
       the camera in to the first window. Then the work, window by window. */
    ...(ai && work ? [
      { y: ai.offsetTop + (ai.offsetHeight - innerHeight) * 0.97, dur: 3.2, train: null, pass: true },
      { y: work.offsetTop + 2, dur: 2.4, train: null, pass: true },
    ] : []),
    ...workStops().map((w, k) => (k === 0 ? { ...w, dur: 5.5 } : w)),
  ];
}

/* The work: a camera through a tower of windows (Projects.tsx). Its scroll runs p from -WORK_LEAD
   (the whole tower) through 0..N-1 (project k filling the screen) to N-1+WORK_LEAD (pulled back
   out). One gesture flies from one project to the next, at the camera's own pace. */
export const WORK_LEAD = 0.6;
export const workP = (progress: number) => -WORK_LEAD + progress * (clients.length - 1 + WORK_LEAD * 2);
export const workProgress = (p: number) => (p + WORK_LEAD) / (clients.length - 1 + WORK_LEAD * 2);

/** Seconds for the camera to fly from one project's window to the next. */
const WORK_STEP = 5;

export function workStops(): ScrollStop[] {
  const work = document.getElementById("work");
  if (!work) return [];
  const top = work.getBoundingClientRect().top + scrollY, span = work.offsetHeight - innerHeight;
  const stops: ScrollStop[] = clients.map((_, k) => ({ y: top + span * workProgress(k), dur: k ? WORK_STEP : 0, train: null }));
  /* and from the last project, one gesture all the way out: the camera pulls back from the tower and
     the contact comes up, landing at the foot of the page where it has fully arrived */
  const contact = document.getElementById("contact");
  if (contact) {
    const end = Math.min(contact.offsetTop + contact.offsetHeight - innerHeight, document.documentElement.scrollHeight - innerHeight);
    if (end > stops[stops.length - 1].y + 1) stops.push({ y: end, dur: 3.6, train: null });
  }
  return stops;
}
