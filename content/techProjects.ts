/* The AI & Automation work. Each project has a screen in the AI section's world and its own page at
   /ai/<slug>. Drop a film in public/tech/ and set `video` to its path; `poster` (optional) is its
   still. Everything marked PLACEHOLDER is waiting on the real copy. */
export type TechProject = {
  slug: string;
  name: string;
  about: string; // its kind, in a word or two
  video: string | null;
  poster?: string;
  summary: string;
  stack: string[];
  year: string;
  problem: string;
  system: string;
  result: string;
  flow: [string, string, string, string]; // the system in four steps: in → brain → hands → out
};

// PLACEHOLDER — rename these and write their copy when it arrives
export const TECH_PROJECTS: TechProject[] = [
  {
    slug: "project-01",
    name: "Project 01",
    about: "Automation",
    video: null,
    summary: "PLACEHOLDER — one sentence on what this automation does and who it does it for.",
    stack: ["PLACEHOLDER", "Node.js", "OpenAI", "Google Sheets"],
    year: "2026",
    problem: "PLACEHOLDER — the manual work this replaced: who did it, how often, and what it cost them.",
    system: "PLACEHOLDER — how it works: what triggers it, what the AI decides, and where the results land.",
    result: "PLACEHOLDER — what changed: the time saved, the errors gone, what the team does instead.",
    flow: ["Trigger", "Agent", "Integrations", "Report"],
  },
  {
    slug: "project-02",
    name: "Project 02",
    about: "Internal tool",
    video: null,
    summary: "PLACEHOLDER — one sentence on what this tool does and who uses it.",
    stack: ["PLACEHOLDER", "Next.js", "Postgres", "Claude"],
    year: "2026",
    problem: "PLACEHOLDER — the problem the team had before this tool existed.",
    system: "PLACEHOLDER — what the tool is: its screens, its data, and the AI inside it.",
    result: "PLACEHOLDER — how the team works now.",
    flow: ["Input", "Model", "Database", "Dashboard"],
  },
  {
    slug: "project-03",
    name: "Project 03",
    about: "Integration",
    video: null,
    summary: "PLACEHOLDER — one sentence on the systems this connects.",
    stack: ["PLACEHOLDER", "WhatsApp API", "HubSpot", "Webhooks"],
    year: "2026",
    problem: "PLACEHOLDER — the systems that weren't talking to each other, and what fell through the gap.",
    system: "PLACEHOLDER — what flows where, and what the AI does on the way.",
    result: "PLACEHOLDER — what arrives where it should now, and how fast.",
    flow: ["WhatsApp", "Classifier", "CRM", "Sales"],
  },
  {
    slug: "project-04",
    name: "Project 04",
    about: "Dashboard",
    video: null,
    summary: "PLACEHOLDER — one sentence on what this dashboard shows and who it's for.",
    stack: ["PLACEHOLDER", "React", "BigQuery", "Python"],
    year: "2026",
    problem: "PLACEHOLDER — the questions nobody could answer quickly before.",
    system: "PLACEHOLDER — where the data comes from, how it's cleaned, and what the AI summarises.",
    result: "PLACEHOLDER — the decisions it now informs, and how often it's opened.",
    flow: ["Sources", "Pipeline", "Insights", "Dashboard"],
  },
];

export const techProjectBySlug = (slug: string) => TECH_PROJECTS.find((p) => p.slug === slug);
