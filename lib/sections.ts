import { scrollToTarget } from "@/lib/scroll";
import { SOLUTIONS } from "@/content/solutions";

// Where each named place on the home page is, as a scroll position. Pinned sections are taller
// than the screen, so "the second solution" is a point partway through one of them.
export function sectionTop(id: string) {
  const top = (el: Element | null) => (el ? el.getBoundingClientRect().top + scrollY : 0);
  const span = (el: Element | null) => (el ? (el as HTMLElement).offsetHeight - innerHeight : 0);
  if (id === "intro") return 0;
  if (id.startsWith("solution-")) {
    const el = document.getElementById("solutions");
    const i = Number(id.slice(9));
    return top(el) + span(el) * ((i + 0.5) / SOLUTIONS.length);
  }
  const el = document.getElementById(id);
  if (id === "contact") return top(el) + span(el); // the hand-over complete
  return top(el);
}

export const goToSection = (id: string, immediate = false) => scrollToTarget(sectionTop(id), immediate);
