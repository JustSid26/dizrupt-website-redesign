/* The Tech & Automation work, shown as video files on the Mac at its stop. Drop each video in
   public/tech/ and set `video` to its path; `poster` (optional) is the file's thumbnail. */
export type TechProject = { name: string; about: string; video: string | null; poster?: string };

// PLACEHOLDER — rename these and add the videos when they arrive
export const TECH_PROJECTS: TechProject[] = [
  { name: "Project 01", about: "Automation", video: null },
  { name: "Project 02", about: "Internal tool", video: null },
  { name: "Project 03", about: "Integration", video: null },
  { name: "Project 04", about: "Dashboard", video: null },
];
