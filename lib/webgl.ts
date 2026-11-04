/* Can this device draw the 3D at all? Asked once, before the engine is even downloaded.

   three.js needs WebGL 2. And a browser that has blocked the GPU (an old or blocklisted driver) may
   still offer WebGL by drawing it in software, at a few frames a second: failIfMajorPerformanceCaveat
   turns that down, and the light version is better than a slideshow. `?lite` in the address forces
   the light version on any device, to see it. */
export function canRunEngine(): boolean {
  if (new URLSearchParams(location.search).has("lite")) return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext(); // (the engine makes its own; don't hold two)
    return true;
  } catch {
    return false;
  }
}

/* How long the 3D may take to be ready before the visitor is let in to the light version instead:
   enough for the scene's downloads on a slow mobile connection, not so long they think it's broken */
export const ENGINE_TIMEOUT_MS = 20000;
