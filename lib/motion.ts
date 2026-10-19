/* The site's one tempo. Every duration and ease is one of these, by what the motion means, and the
   same scale is mirrored as CSS custom properties in app/globals.css (:root, "the tempo") so CSS and
   GSAP motion read as one system. A raw number anywhere else needs a comment saying why.

   micro      answering your hand: hover, colour, focus, a small state flipping
   ui         words and panels arriving (in), and leaving quicker than they came (out)
   swap       content replacing content in place: the old out, the new in, overlapping a little
   hop        a short camera move within one scene: billboard to billboard, beat to beat (the work's
              window to window is one too, a little slower: window)
   scene      the camera into a different world
   signature  the two payoffs of the landing: the city building itself, him turning into the count
   handover   a shader hand-over between worlds (the glitch), never linear
   ambient    loops (grain, scan drift, the eq): their own clocks, left as they are */

export const T = {
  micro: 0.22,
  ui: 0.7,
  uiOut: 0.42, // exits run at 60% of the entrance
  stagger: 0.05,
  swapOut: 0.35,
  swapIn: 0.65,
  swapOverlap: 0.1,
  hop: 2.4,
  window: 2.4 / 0.8, // the work's window to window: a hop at 80% of the speed, so each project is taken in
  beat: 2.6, // an AI beat: a hop, the page and the network on one clock
  scene: 3.2,
  signature: 3.8,
  handover: 1.6,
  nav: 1.6, // a jump from the menu or the rail: quick, skipping what is between
  /** the longest a stop's own scene may hold the page (a signature ride, and a little over) */
  hold: 3.8 + 0.4,
  /** reduced motion: everything collapses to a quick crossfade, never a cut */
  reduced: 0.2,
} as const;

/** Going back over what you have seen is quicker than seeing it. */
export const BACK = 0.75;
/** A ride queued behind the one under way runs at this share of its own time. */
export const QUEUED = 0.8;

export type RideKind = "hop" | "window" | "beat" | "scene" | "signature";

/* The camera's one curve, for every ride: a short pull away, a steady run, a short settle. `ramp` is
   the share of the ride each end takes. (A sine spends most of a ride getting going and stopping.) */
export const RAMP = 0.18;
export const camera = (ramp = RAMP) => {
  const vmax = 1 / (1 - ramp);
  return (t: number) =>
    t < ramp ? (vmax * t * t) / (2 * ramp) : t > 1 - ramp ? 1 - (vmax * (1 - t) * (1 - t)) / (2 * ramp) : vmax * (t - ramp / 2);
};
/** The signature rides: from rest and back to rest with no steady run, so they breathe. */
export const sine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
/** Already moving (a ride sent on from partway along): carry on, then settle. */
export const onward = (t: number) => 1 - (1 - t) * (1 - t);

/** A ride of this kind, this way: its time and its curve. */
export function ride(kind: RideKind, dir: 1 | -1 = 1) {
  return { duration: T[kind] * (dir < 0 ? BACK : 1), ease: kind === "signature" ? sine : camera() };
}

/* GSAP's names for the same curves (lib/gsap.ts registers expo.site and inout.site). --ease-out in
   CSS is expo.site exactly; --ease is inout.site exactly. */
export const EASE = {
  in: "expo.site", // words and panels arriving
  out: "power3.in", // leaving
  inOut: "inout.site", // a value travelling from one state to another
  handover: "power2.inOut", // the glitch between worlds: gentler at the ends than inOut, never linear
  micro: "expo.site",
} as const;
