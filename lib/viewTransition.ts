/* Page changes in the work, as one connected move: the browser's View Transitions snapshot the page
   before and after, and anything sharing a view-transition-name (the card ↔ the case's banner, the
   panel's title ↔ the case's title) travels from one to the other instead of cutting. The kind of
   move (open, next, back) is set on <html data-vt> so the CSS can shape each one.

   The new route renders asynchronously, so the "after" snapshot waits until the page that arrives
   says it is ready (routeReady, called from its first effect), with a ceiling in case it never does.
   Without the API, or with reduced motion, it is a plain navigation. */
type Kind = 'open' | 'next' | 'back';
type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };

let pending: (() => void) | null = null;

/** The arriving page has rendered: take the "after" snapshot now. */
export const routeReady = () => {
  pending?.();
  pending = null;
};

export function transitionTo(navigate: () => void, kind: Kind, hooks: { before?: () => void; after?: () => void } = {}) {
  const doc = document as VTDocument;
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    navigate();
    return;
  }
  const html = document.documentElement;
  hooks.before?.(); // name the elements leaving, before the "before" snapshot
  html.dataset.vt = kind;
  const vt = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const done = () => {
          hooks.after?.(); // names must be unique in the "after" snapshot
          resolve();
        };
        pending = done;
        navigate();
        window.setTimeout(() => pending === done && routeReady(), 1500);
      }),
  );
  vt.finished.finally(() => {
    if (html.dataset.vt === kind) delete html.dataset.vt;
  });
}
