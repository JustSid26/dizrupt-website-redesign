// Device-level constants the engine is built around. Only ever imported on the client.
export const isMobile =
  typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || innerWidth < 768);
export const COUNT = isMobile ? 26000 : 70000; // particles in the field
export const TRANSITION_MS = 3000;
export const CAMERA_Z = isMobile ? 9.5 : 7;
export const reducedMotion =
  typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
