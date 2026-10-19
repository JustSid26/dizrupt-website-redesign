// Device-level constants the engine is built around. Only ever imported on the client.
export const isMobile =
  typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || innerWidth < 768);
// a phone draws at 1.25x: the difference is hard to see at arm's length, the work it saves is not
export const PIXEL_RATIO = typeof window !== 'undefined' ? Math.min(devicePixelRatio, isMobile ? 1.25 : 2) : 1;
export const COUNT = isMobile ? 26000 : 70000; // particles in the field
export const TRANSITION_MS = 3000;
export const CAMERA_Z = isMobile ? 9.5 : 7;
export const reducedMotion =
  typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
