// Mutable per-frame values shared between the DOM and the WebGL engine. Written by scroll triggers
// and listeners, read by the engine every frame. Never triggers a React render.
export type Section = 'intro' | 'solutions' | 'projects' | 'contact';

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
  statWindows: Array.from({ length: 4 }, () => ({ x: 0, y: 0, w: 0, h: 0 })),
  night: 0, // 0 blue hour, 1 full night (the nav's switch)
  ready: false, // the engine has built everything it needs
};
