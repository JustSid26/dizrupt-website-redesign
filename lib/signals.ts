// Mutable per-frame values shared between the DOM and the WebGL engine. Written by scroll triggers
// and listeners, read by the engine every frame. Never triggers a React render.
export type Section = 'intro' | 'solutions' | 'bridge' | 'ai' | 'projects' | 'contact';

export const signals = {
  pointer: { x: 0, y: 0, px: 0, py: 0, active: false }, // ndc (-1..1) and pixels
  scroll: {
    velocity: 0,
    section: 'intro' as Section,
    intro: 0, // 0..1 through the pinned landing
    solutions: 0, // 0..1 through the pinned solutions
    solutionIndex: 0, // which solution is on (integer)
    trainS: 0, // where his train is on its line: 0 the plaza, 1..6 the stations
    projects: 0, // 0..1 through the pinned work
    projectIndex: 0, // float index of the front card
    projectsIn: 0, // 0..1 how much the work section holds the screen
    contact: 0, // 0..1 how far the contact hand-over has come
    bridge: 0, // 0..1 through the bridge: the train back into him, then into his heart
  },
  // where the mascot looks while the count is being read, or null to follow the cursor
  glance: null as [number, number] | null,
  // the intro's staged beats, written by <Intro/>
  introBeat: 'landing' as 'landing' | 'reveal' | 'stats' | 'profile',
  // the case page's model, when a case study is open
  caseShape: null as null | { shape: string; colors: [string, string]; spin?: boolean },
  // the spiral card being presented before its case page opens (-1 none)
  presenting: -1,
  // the menu's hovered solution takes the field over
  preview: null as null | { shape: string; colors: [string, string] },
  menuOpen: false,
  // the count's four windows on screen (the engine writes them, the landing places the numbers in them)
  statWindows: Array.from({ length: 4 }, () => ({ x: 0, y: 0, w: 0, h: 0, yaw: 0, pitch: 0 })),
  // the billboard the train is standing at, on screen (the engine writes it; Solutions puts a link on it)
  billboardHit: { x: 0, y: 0, w: 0, h: 0, on: false, index: -1 },
  rideTarget: null as number | null, // the stop a swipe sent the train to (null: follow the scroll)
  rideS: 0, // where the train actually is (it drives itself towards trainS)
  // the social skyscrapers' logos on screen at contact (the engine writes them, SocialTowers links them)
  socials: Array.from({ length: 5 }, () => ({ x: 0, y: 0, w: 0, h: 0, on: false })),
  night: 1, // 0 blue hour, 1 full night (the nav's switch)
  // AI & Automation: its own world, handed over to through a transition (lib/engine/ai)
  ai: { mix: 0, p: 0, play: 0, mode: 0, warm: false }, // p: the scroll through it; play: where its animation is
  // the AI world's chip on screen: its centre and half its width in px (the engine writes it; the
  // section's network grows out of it)
  aiChip: { x: 0, y: 0, size: 0 },
  // until when (performance.now()) the page is jumping to a place the nav sent it: scenes it passes
  // on the way should be where the scroll is at once, not play their way there
  navJumpUntil: 0,
  // the pointer turning the chip (AiAutomation.tsx): movement since the world last read it, held or not, and when it last moved
  aiGrab: { dx: 0, dy: 0, down: false, at: 0 },
  // where the Mac should grow from when something other than a billboard opens it
  macFrom: null as null | { x: number; y: number; w: number; h: number },
  workApply: null as null | (() => void), // the work's tower: draw this scroll position's frame now
  // the work's tower: each project window on screen (the engine writes them), the ones the page has up
  // full (the engine hides their own glass), and the page's draw for the frame
  workWindows: Array.from({ length: 16 }, () => ({ x: 0, y: 0, w: 0, h: 0, on: false, face: 1 })),
  workHidden: [] as number[],
  onWorkFrame: null as null | (() => void),
  ready: false, // the engine has built everything it needs
  /* scenes still playing out on their own clock after the scroll has landed: while any is, a gesture
     doesn't ride on to the next stop (SmoothScroll.tsx), so every beat is seen whole */
  busy: {
    ai: false, // an AI & Automation beat playing (AiNetwork.tsx)
    handover: false, // the glitch into or out of the AI world (AiAutomation.tsx)
    morph: false, // the particles reshaping on a timer, not the scroll (engine.ts)
    train: false, // the train still pulling in to its stop (engine.ts)
  },
};
