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
   points rather than light, no sprite huge), drawn at the computer's own layout, and down to 0.75x if it must.
   Every phone is lean. A computer is when its graphics are known to be weak (Intel's before Iris Xe,
   AMD's and NVIDIA's older and entry-level chips, a phone's chip in a Chromebook), when it has 4GB of
   memory or less, or when it won't say what its graphics are (Safari calls every Mac's "Apple GPU") and
   has four cores or fewer (the cores alone don't decide: Brave reports a random number of them).
   ?tier=lean or ?tier=full on a computer forces either (for testing). */
const WEAK_GPU = [
  /\bIntel\b(?!.*\b(Xe|Arc)\b)/i, // Intel's integrated graphics before Iris Xe: HD, UHD, Iris, Iris Plus, Iris Pro
  /Radeon(\(TM\))? (HD|R[2-7]|Vega \d)/i, // AMD's older integrated graphics
  /GeForce (MX ?\d|GT \d|\d{3,4}M)/i, // NVIDIA's entry-level and older laptop chips
  /\b(Mali|Adreno|PowerVR|VideoCore)\b/i, // a phone's graphics, in a computer
];
const NAMED_GPU = /\b(Intel|AMD|Radeon|NVIDIA|GeForce|Quadro|Apple M\d|Mali|Adreno|PowerVR)\b/i;

/** The graphics chip's name, as the browser gives it ('' when it won't). */
function gpuName() {
  try {
    // (asked for as the engine's renderer asks: a Mac with two chips answers for the one it will use)
    const gl = document.createElement('canvas').getContext('webgl2', { powerPreference: 'high-performance' });
    if (!gl) return '';
    let name = String(gl.getParameter(gl.RENDERER) ?? '');
    // (Chrome and Safari give a generic name there, the real one through the extension; Firefox the reverse)
    if (/^WebKit/i.test(name)) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? name);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

export function chooseTier(gpu: string, threads: number, memory: number, phone: boolean, forced: string | null): { tier: 'full' | 'lean'; why: string } {
  if (phone) return { tier: 'lean', why: 'phone' };
  if (forced === 'lean' || forced === 'full') return { tier: forced, why: '?tier' };
  if (WEAK_GPU.some((re) => re.test(gpu))) return { tier: 'lean', why: 'graphics' };
  if (memory <= 4) return { tier: 'lean', why: `${memory}GB` };
  if (threads <= 4 && !NAMED_GPU.test(gpu)) return { tier: 'lean', why: `${threads} cores` };
  return { tier: 'full', why: 'graphics' };
}

export const GPU = typeof window !== 'undefined' ? gpuName() : '';
const decided =
  typeof window !== 'undefined'
    ? chooseTier(
        GPU,
        navigator.hardwareConcurrency || 8,
        (navigator as { deviceMemory?: number }).deviceMemory ?? 8,
        isMobile,
        new URLSearchParams(location.search).get('tier'),
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
