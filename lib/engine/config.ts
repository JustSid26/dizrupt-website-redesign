// Device-level constants the engine is built around. Only ever imported on the client.
export const isMobile =
  typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || innerWidth < 768);
// a phone starts at 1.25x and is then measured (engine.ts): a phone that can hold more gets more
export const PIXEL_RATIO = typeof window !== 'undefined' ? Math.min(devicePixelRatio, isMobile ? 1.25 : 2) : 1;
/* particles in the field. A phone's figure is drawn from more, smaller points than it was: what a
   frame pays for is the pixels the points cover, not their number, so the same light from twice as
   many points at half the area each is the same work and a finer figure (field.ts, engine.ts) */
export const COUNT = isMobile ? 40000 : 70000;
export const TRANSITION_MS = 3000;
export const CAMERA_Z = isMobile ? 9.5 : 7;
export const reducedMotion =
  typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
