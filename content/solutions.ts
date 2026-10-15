// The six things Dizrupt does. Each one has a particle model (shared with the case studies) and
// the work that proves it.
// image: the solution's own photograph (from dizrupt.in/solutions), shown on its station's banner
// film: a clip that plays on the banner instead, from the start each time the train pulls in
// live: a film drawn in code instead (lib/engine), restarted the same way
// filmY: which part of a clip survives the billboard's crop, 0 its bottom … 0.5 its middle (the default) … 1 its top
export type Solution = { name: string; line: string; shape: string; colors: [string, string]; work: string; image: string; film?: string; filmY?: number; live?: 'branding' };

// the words a project's services line uses for each solution, to find its work
const MATCH: Record<string, RegExp> = {
  'Social & Paid Media': /social|paid media/i,
  Branding: /branding/i,
  'Website Development': /website/i,
  'Search Engine Optimisation': /\bseo\b|search engine/i,
  'Digital Content Creation': /content/i,
  Production: /production/i,
};

export const SOLUTIONS: Solution[] = [
  { name: 'Social & Paid Media', line: 'Strategy, content plans and paid boosting that grow the audience and the sales behind it.', shape: 'hanger', colors: ['#ff3d8b', '#ffc2da'], work: 'SlickFix · Kiaash', image: '/solutions/paid-media.png', film: '/solutions/social-film.mp4' },
  { name: 'Branding', line: 'Names, identities and logos built on research into the sector they have to stand out in.', shape: 'shield', colors: ['#3d6bff', '#b8c8ff'], work: 'Alwrite · KP Packaging', image: '/solutions/branding-v2.jpg', film: '/solutions/branding-film.mp4' },
  { name: 'Website Development', line: 'Full UX/UI revamps and builds that meet the standard of the brands they represent.', shape: 'openBox', colors: ['#1fd6b8', '#2a6bff'], work: 'Mae Mae Industrial · Furnfetch', image: '/solutions/solutions-page-hero-img.jpg', film: '/solutions/web-film.mp4' },
  { name: 'Search Engine Optimisation', line: 'Technical and content SEO that puts the business in front of the people already looking.', shape: 'windscreen', colors: ['#2ad4ff', '#dff6ff'], work: 'AVG Windscreens · KP Packaging', image: '/solutions/SEO.png', film: '/solutions/seo-film.mp4', filmY: 0 },
  { name: 'Digital Content Creation', line: 'Launch films, artist reveals and campaign content made to move as fast as the brand.', shape: 'vinyl', colors: ['#8a5bff', '#ff4fd8'], work: 'Nykonos · Samir Gems · Maverick', image: '/solutions/graphic-sol.png', film: '/solutions/content-film.mp4' },
  { name: 'Production', line: 'Shoots and production for products that have to look as good as they are.', shape: 'glasses', colors: ['#ff5b5b', '#ffc9b8'], work: 'Crossline · SlickFix', image: '/solutions/production-v2.jpg', film: '/solutions/production-film.mp4' },
];


export const solutionSlug = (s: Solution) => s.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const solutionBySlug = (slug: string) => SOLUTIONS.find((s) => solutionSlug(s) === slug);
export const matchesSolution = (s: Solution, services: string) => (MATCH[s.name] ?? /$^/).test(services);
