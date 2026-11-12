// Device-level constants the engine is built around. Only ever imported on the client.
// a phone's screen, or a window as narrow: the layout (the camera further back, the cards smaller, the
// city only as wide as can be seen). What the picture costs is `lean`, below, not this.
export const isMobile =
  typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || innerWidth < 768);

/* How much the device can draw, decided before anything is built: most of what a frame costs is fixed
   when the scene is (how many points the city, his line and the field are made of, how the steel is lit,
   whether there is a bloom at all), and the governor (engine.ts) can only move what can be changed
   while it runs (the resolution, his points thinned).
   'full': everything. 'lean': the scene a phone was tuned for (fewer, finer points, matt steel, him as
   points rather than light, the bloom from a half-size picture, no sprite huge),
   drawn at the computer's own layout, and down to 0.75x if it must.
   Every phone is lean. A computer is when its graphics are known to be weak (Intel's before Iris Xe,
   AMD's and NVIDIA's older and entry-level chips, a phone's chip in a Chromebook), when it has 4GB of
   memory or less, or when it won't say what its graphics are (Safari calls every Mac's "Apple GPU") and
   has four cores or fewer (the cores alone don't decide: Brave reports a random number of them).
   Apple silicon is full in any browser: where its name is hidden, it gives itself away by the
   compressed textures (ASTC) only Apple's own graphics read, which an Intel Mac's can't, so it never
   rests on the cores Safari reports. Where Safari won't say even that (its privacy protection can hide
   the extensions too, and an M-series Mac was then taken for an Intel one and given the lean scene,
   which looked wrong on it), the graphics are timed instead: a fixed piece of drawing, waited for (gpuTime,
   below). An Intel Mac's integrated graphics take several times an Apple silicon Mac's, and an Intel
   Mac's own Radeon, as quick as Apple's, is full too, as it should be. ?tier=lean or ?tier=full on a
   computer forces either (for testing). */
const WEAK_GPU = [
  /\bIntel\b(?!.*\b(Xe|Arc)\b)/i, // Intel's integrated graphics before Iris Xe: HD, UHD, Iris, Iris Plus, Iris Pro
  /Radeon(\(TM\))? (HD|R[2-7]|Vega \d)/i, // AMD's older integrated graphics
  /GeForce (MX ?\d|GT \d|\d{3,4}M)/i, // NVIDIA's entry-level and older laptop chips
  /\b(Mali|Adreno|PowerVR|VideoCore)\b/i, // a phone's graphics, in a computer
];
const NAMED_GPU = /\b(Intel|AMD|Radeon|NVIDIA|GeForce|Quadro|Apple M\d|Mali|Adreno|PowerVR)\b/i;

/* How quick the graphics are, timed: a fixed piece of drawing (two full-screen passes of arithmetic on a
   canvas of its own, 1024 square) and the wait for it, in ms, the best of three (the first may catch the
   chip still waking). Blended, each over the last: Apple's graphics skip whatever a later opaque draw
   covers, and timed opaque, the second pass cost them nothing (and an Intel chip's all of it). Only where
   the name won't decide it, while the page is still loading: ~4ms on an M5, ~25 on an Intel Iris
   (timed so on this M5 in WebKit and Chrome, the Iris as the same work six times over). -1 where it
   can't be timed */
const PROBE = 1024;
function gpuTime(gl: WebGL2RenderingContext): number {
  const sh = (type: number, src: string) => { const x = gl.createShader(type)!; gl.shaderSource(x, src); gl.compileShader(x); return x; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; out vec4 o;\nvoid main() { vec2 p = gl_FragCoord.xy * 0.013; float a = 0.0;\n  for (int i = 0; i < 128; i++) { a += sin(p.x + a * 0.7) * cos(p.y - float(i) * 0.31); p = p.yx * 1.003 + a * 0.001; }\n  o = vec4(fract(a), 0.0, 0.0, 1.0); }'));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return -1;
  gl.useProgram(prog);
  gl.viewport(0, 0, PROBE, PROBE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  const px = new Uint8Array(4);
  const run = (n: number) => {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // (waits for all of it)
    return performance.now() - t0;
  };
  run(1); // (the program made, the chip woken)
  return Math.min(run(2), run(2), run(2));
}

/** The graphics chip's name, as the browser gives it ('' when it won't), whether it reads ASTC, and, where
    neither settles it (or ?perf asks), how long it takes over a fixed piece of drawing (gpuTime). */
function gpuProbe() {
  try {
    // (asked for as the engine's renderer asks: a Mac with two chips answers for the one it will use)
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PROBE;
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance', antialias: false });
    if (!gl) return { name: '', astc: false, ms: -1 };
    const astc = !!gl.getExtension('WEBGL_compressed_texture_astc');
    let name = String(gl.getParameter(gl.RENDERER) ?? '');
    // (Chrome and Safari give a generic name there, the real one through the extension; Firefox the reverse)
    if (/^WebKit/i.test(name)) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? name);
    }
    const unsure = (/^(Apple GPU|WebKit.*|)$/i.test(name.trim()) && !astc) || new URLSearchParams(location.search).has('perf');
    const ms = unsure ? gpuTime(gl) : -1;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { name, astc, ms };
  } catch {
    return { name: '', astc: false, ms: -1 };
  }
}
/* Under this, as quick as Apple silicon's graphics: the slowest of them, an M1's, ~7–8ms by its arithmetic
   against the M5's (twice that still waking, which the best of three mostly avoids); an Intel Mac's
   Iris ~25, its UHD ~45. (An Intel Mac's own Radeon comes in under it: full, as it should be) */
const QUICK_MS = 16;

export function chooseTier(gpu: string, threads: number, memory: number, phone: boolean, forced: string | null, astc = false, ms = -1): { tier: 'full' | 'lean'; why: string } {
  if (phone) return { tier: 'lean', why: 'phone' };
  if (forced === 'lean' || forced === 'full') return { tier: forced, why: '?tier' };
  // Apple's own graphics (named, or "Apple GPU" and reading ASTC): every Apple silicon Mac
  if (/\bApple\b/i.test(gpu) && (astc || /\bApple M\d/i.test(gpu))) return { tier: 'full', why: 'Apple silicon' };
  /* Safari's "Apple GPU" that doesn't read ASTC (or won't name its graphics at all): an Intel Mac, or
     Apple silicon with its extensions hidden. Not guessed: timed (gpuTime). Safari says nothing more,
     not even the real number of cores to go on (a quad-core MacBook Pro says 8) */
  if (/^(Apple GPU|WebKit.*|)$/i.test(gpu.trim()) && ms > 0) return ms < QUICK_MS ? { tier: 'full', why: `quick graphics, ${ms.toFixed(1)}ms` } : { tier: 'lean', why: `slow graphics, ${ms.toFixed(1)}ms` };
  if (/^Apple GPU$/i.test(gpu.trim())) return { tier: 'lean', why: 'Intel Mac' };
  if (WEAK_GPU.some((re) => re.test(gpu))) return { tier: 'lean', why: 'graphics' };
  if (memory <= 4) return { tier: 'lean', why: `${memory}GB` };
  if (threads <= 4 && !NAMED_GPU.test(gpu)) return { tier: 'lean', why: `${threads} cores` };
  return { tier: 'full', why: 'graphics' };
}

const probe = typeof window !== 'undefined' ? gpuProbe() : { name: '', astc: false, ms: -1 };
export const GPU = probe.name;
/** The probe's timing (gpuTime), -1 where it wasn't needed (shown with ?perf, which always asks for it) */
export const GPU_MS = probe.ms;
const decided =
  typeof window !== 'undefined'
    ? chooseTier(
        GPU,
        navigator.hardwareConcurrency || 8,
        (navigator as { deviceMemory?: number }).deviceMemory ?? 8,
        isMobile,
        new URLSearchParams(location.search).get('tier'),
        probe.astc,
        probe.ms,
      )
    : { tier: 'full' as const, why: '' };
export const TIER = decided.tier;
export const TIER_WHY = decided.why;
export const lean = TIER === 'lean';

/* the sharpest the picture is ever drawn, on any screen: 1.5 device pixels to the CSS pixel. A 2x screen
   at 2x is 78% more pixels than at 1.5x for a difference in the points' and lines' edges only (the type
   is the page's, at the screen's own); those pixels are better spent on frames */
export const MAX_PIXEL_RATIO = 1.5;
// a phone starts at 1.25x and is then measured (engine.ts): a phone that can hold more gets more. A
// computer starts at its screen's own, up to the most above, and is measured too
export const PIXEL_RATIO = typeof window !== 'undefined' ? Math.min(devicePixelRatio, isMobile ? 1.25 : MAX_PIXEL_RATIO) : 1;
/* particles in the field. A phone's figure is drawn from more, smaller points than it was: what a
   frame pays for is the pixels the points cover, not their number, so the same light from twice as
   many points at half the area each is the same work and a finer figure (field.ts, engine.ts) */
export const COUNT = lean ? 40000 : 70000;
export const TRANSITION_MS = 3000;
export const CAMERA_Z = isMobile ? 9.5 : 7;
export const reducedMotion =
  typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
