/* The AI & Automation work. Each project has a screen in the AI section's world and its own page at
   /ai/<slug>. Drop a film in public/tech/ and set `video` to its path; `poster` (optional) is its
   still. The stack lists the tools it's built with, not how or where it runs. */
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

export const TECH_PROJECTS: TechProject[] = [
  {
    slug: "lead-gen",
    name: "Lead Engine",
    about: "Lead generation",
    video: "/tech/lead-gen.mp4",
    summary: "An AI lead generation engine: it finds businesses in any industry worldwide, enriches and scores them, and runs the outreach from one CRM.",
    stack: ["Node.js", "React", "TypeScript", "Playwright", "OpenAI", "Google Maps", "Hunter.io", "WhatsApp Cloud API", "Gmail API", "Twilio"],
    year: "2026",
    problem: "Finding the right buyers meant searching country by country, copying contacts by hand and chasing replies across inboxes and phones.",
    system: "It searches Google Maps by continent, country or city, reads each business's website, uses AI to pull out the right contacts and scores every lead. Outreach goes out by email and WhatsApp in the lead's own language, with follow-ups, reminders, meetings and invoices in the same CRM.",
    result: "A ranked list of the best leads every day, and outreach that follows itself up, so the team spends its time on conversations instead of research.",
    flow: ["Maps search", "AI enrich", "Score", "Outreach"],
  },
  {
    slug: "payment-recon",
    name: "Payment Recon",
    about: "Fintech tool",
    video: "/tech/payment-recon.mp4",
    summary: "A reconciliation dashboard for a payment gateway: it checks every merchant transaction against what the banks actually settled before anyone gets paid.",
    stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Prisma", "SheetJS", "pdf-lib", "OpenAI"],
    year: "2026",
    problem: "Finance matched transaction files against bank settlements in spreadsheets, where duplicates, short payments and missing money were easy to miss.",
    system: "Upload the transaction and settlement files and it maps the columns, matches every payment and marks it ready, on hold, pending, missing or failed. It works out fees by rule, flags duplicates and underpayments, then produces settlement reports, wire sheets and ledgers, with an optional AI summary that can only use numbers from the report.",
    result: "Payout runs that are checked line by line, with every report and email on record for the finance team.",
    flow: ["Upload", "Match", "Fees", "Reports"],
  },
  {
    slug: "post-stack",
    name: "PostStack",
    about: "Social publishing",
    video: null,
    summary: "One calendar to plan, approve, schedule and publish social posts across 19+ platforms, with a workspace for every client.",
    stack: ["Next.js", "NestJS", "TypeScript", "Postiz", "OpenAI", "Meta Graph API", "LinkedIn API", "X API", "YouTube API", "TikTok API"],
    year: "2026",
    problem: "Posting for many clients meant logging in and out of every platform, with approvals scattered across chats.",
    system: "Each client gets a workspace with its team, roles and an approval flow. Posts are written once, tailored per platform (Reels, Stories, Shorts, threads), previewed, and scheduled into a queue, with AI help on captions and analytics per channel.",
    result: "Every client's content on one calendar, approved in one place and published on time.",
    flow: ["Draft", "Approve", "Schedule", "Publish"],
  },
  {
    slug: "virtual-tryon",
    name: "Dizrupt Try-On",
    about: "Virtual try-on",
    video: null,
    summary: "Virtual try-on for clothing and jewellery: add a product photo and a photo of a person, and see them wearing it.",
    stack: ["Node.js", "JavaScript", "MediaPipe", "OpenAI", "Gemini", "FASHN"],
    year: "2026",
    problem: "Shoppers can't try jewellery or clothes on online, and AI images tend to redraw the product until it no longer looks like the real piece.",
    system: "AI recognises the piece, then the real product is placed using body landmarks found in the browser: shoulders for a necklace, jaw for earrings, the ring finger for a ring. Hair falls back over the chain, lighting and shadow are matched, and an optional pass relights the result.",
    result: "A try-on that keeps the real product, with a before and after slider, in seconds.",
    flow: ["Photos", "Detect", "Place", "Relight"],
  },
];

export const techProjectBySlug = (slug: string) => TECH_PROJECTS.find((p) => p.slug === slug);
