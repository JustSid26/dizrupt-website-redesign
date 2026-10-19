import { scrollToTarget } from "@/lib/scroll";
import { SOLUTIONS } from "@/content/solutions";
import { stopPositions, workProgress } from "@/lib/stops";

// Where each named place on the home page is, as a scroll position. Pinned sections are taller
// than the screen, so "the second solution" is a point partway through one of them.
export function sectionTop(id: string) {
  const top = (el: Element | null) => (el ? el.getBoundingClientRect().top + scrollY : 0);
  const span = (el: Element | null) => (el ? (el as HTMLElement).offsetHeight - innerHeight : 0);
  if (id === "intro") return 0;
  // Solutions: the first billboard, where the train stands (its top would leave it between stations);
  // on a phone, the cards
  if (id === "solutions") return stopPositions()[1] ?? top(document.getElementById(id));
  if (id.startsWith("solution-")) {
    const el = document.getElementById("solutions");
    const i = Number(id.slice(9));
    // the ride runs from a screen before the section pins (see Solutions.tsx)
    return top(el) - innerHeight + (el ? (el as HTMLElement).offsetHeight : 0) * ((i + 1) / SOLUTIONS.length);
  }
  // a project in the work's tower, full screen in its window
  if (id.startsWith("work-")) {
    const el = document.getElementById("work");
    return top(el) + span(el) * workProgress(Number(id.slice(5)));
  }
  const el = document.getElementById(id);
  if (id === "contact") return top(el) + span(el); // the hand-over complete
  return top(el);
}

export const goToSection = (id: string, immediate = false) => scrollToTarget(sectionTop(id), immediate);
