/* The site's one tempo. Every duration and ease is one of these, by what the motion means, and the
   same scale is mirrored as CSS custom properties in app/globals.css (:root, "the tempo") so CSS and
   GSAP motion read as one system. A raw number anywhere else needs a comment saying why.

   micro      answering your hand: hover, colour, focus, a small state flipping
   ui         words and panels arriving (in), and leaving quicker than they came (out)
   swap       content replacing content in place: the old out, the new in, overlapping a little
   depart     the train leaving its station: up over the city and round to the first billboard
   wake       the AI chip powering on and pulling back to its network: two beats' worth, so it is seen
   hop        a short camera move within one scene: billboard to billboard, beat to beat (the work's
              window to window is one too, a little slower: window)
   scene      the camera into a different world
   passage    AI & Automation out to the work's tower, whole: a scene change carrying three things, lingering over the glitch
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
  depart: 2.4 * 2, // the train leaving its station for the first billboard: a flight over the city, not a hop
  window: (2.4 / 0.8) * 1.15, // the work's window to window: a hop at 80% of the speed and 15% slower again, so each project is taken in
  beat: 2.6, // an AI beat: a hop, the page and the network on one clock
  wake: 6.5, // the chip to what we do: it powers on, pulls back to the whole network and steps aside, all in one ride
  scene: 3.2,
  passage: 6.5, // AI & Automation out to the work: the network clears, the glitch, the city and the tower whole, in one ride
  sweep: 4.5, // a phone's: the same, on in to the first window, hurrying through the glitch so the tower comes up sooner
  signature: 3.8,
  handover: 1.6,
  nav: 1.6, // a jump from the menu or the rail: quick, skipping what is between
  /** the longest a stop's own scene may hold the page (the longest ride, the passage, and a little over) */
  hold: 6.5 + 0.4,
  /** reduced motion: everything collapses to a quick crossfade, never a cut */
  reduced: 0.2,
} as const;

/** Going back over what you have seen is quicker than seeing it. */
export const BACK = 0.75;
/** How much slower a ride takes the stretch it lingers over (lingering, below). */
export const LINGER = 1.75;
/** A ride queued behind the one under way runs at this share of its own time. */
export const QUEUED = 0.8;

export type RideKind = "hop" | "depart" | "window" | "beat" | "wake" | "scene" | "passage" | "sweep" | "signature";

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
/** A ride that lingers over part of its way: `base`'s pace in time, but the stretch of the distance
    from lo to hi (0..1) taken `w` times slower than the rest, eased in and out of so the speed never
    jumps. (The way out of AI & Automation: the network clearing and the glitch are a few hundred
    pixels of a long ride, and at an even pace they would be gone in half a second.) */
export function lingering(base: (t: number) => number, lo: number, hi: number, w: number) {
  const N = 256, edge = 0.04;
  const step = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  // how long each bit of the distance takes, summed: then read backwards, time → distance
  const cum = new Float32Array(N + 1);
  for (let j = 1; j <= N; j++) {
    const x = (j - 0.5) / N;
    cum[j] = cum[j - 1] + 1 + (w - 1) * step(lo - edge, lo + edge, x) * (1 - step(hi - edge, hi + edge, x));
  }
  for (let j = 1; j <= N; j++) cum[j] /= cum[N];
  return (t: number) => {
    const s = base(t);
    let j = 1;
    while (j < N && cum[j] < s) j++;
    const a = cum[j - 1], b = cum[j];
    return (j - 1 + (b > a ? (s - a) / (b - a) : 0)) / N;
  };
}

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
