import { SOLUTIONS } from "@/content/solutions";

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
