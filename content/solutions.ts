// The six things Dizrupt does. Each one has a particle model (shared with the case studies) and
// the work that proves it.
export type Solution = { name: string; line: string; shape: string; colors: [string, string]; work: string };

export const SOLUTIONS: Solution[] = [
  { name: 'Social & Paid Media', line: 'Strategy, content plans and paid boosting that grow the audience and the sales behind it.', shape: 'hanger', colors: ['#ff3d8b', '#ffc2da'], work: 'SlickFix · Kiaash' },
  { name: 'Branding', line: 'Names, identities and logos built on research into the sector they have to stand out in.', shape: 'shield', colors: ['#3d6bff', '#b8c8ff'], work: 'Alwrite · KP Packaging' },
  { name: 'Website Development', line: 'Full UX/UI revamps and builds that meet the standard of the brands they represent.', shape: 'openBox', colors: ['#1fd6b8', '#2a6bff'], work: 'Mae Mae Industrial · Furnfetch' },
  { name: 'Search Engine Optimisation', line: 'Technical and content SEO that puts the business in front of the people already looking.', shape: 'windscreen', colors: ['#2ad4ff', '#dff6ff'], work: 'AVG Windscreens · KP Packaging' },
  { name: 'Digital Content Creation', line: 'Launch films, artist reveals and campaign content made to move as fast as the brand.', shape: 'vinyl', colors: ['#8a5bff', '#ff4fd8'], work: 'Nykonos · Samir Gems · Maverick' },
  { name: 'Production', line: 'Shoots and production for products that have to look as good as they are.', shape: 'glasses', colors: ['#ff5b5b', '#ffc9b8'], work: 'Crossline · SlickFix' },
];
