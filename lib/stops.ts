import { SOLUTIONS } from "@/content/solutions";

/* The train's stops, as scroll positions: the start station at the end of the landing, then each
   billboard. Between them the scroll doesn't wander — one gesture carries you to the next stop. */
const N = SOLUTIONS.length;

// where Solutions' own scroll has the train standing at stop k (see Solutions.tsx: x counts stops)
const solutionsProgress = (k: number) => Math.min(1, 0.08 + (0.92 * Math.min(k + 0.1, N)) / N);

export function stopPositions() {
  const intro = document.getElementById("intro");
  const sol = document.getElementById("solutions");
  if (!intro || !sol) return [];
  const iSpan = intro.offsetHeight - innerHeight;
  const sTop = sol.getBoundingClientRect().top + scrollY;
  const sSpan = sol.offsetHeight - innerHeight;
  const ys = [intro.getBoundingClientRect().top + scrollY + iSpan * 0.965]; // the train at its station
  for (let k = 1; k <= N; k++) ys.push(sTop + sSpan * solutionsProgress(k));
  return ys;
}
