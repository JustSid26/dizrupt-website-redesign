/* The AI & Automation work. Each project has a screen in the AI section's world and its own page at
   /ai/<slug>. Drop a film in public/tech/ and set `video` to its path; `poster` (optional) is its
   still. The stack lists the tools it's built with, not how or where it runs. */
export type Chapter = { at: number; label: string; title: string; text: string }; // at: seconds into the film

export type TechProject = {
  slug: string;
  name: string;
  about: string; // its kind, in a word or two
  video: string | null;
  poster?: string;
  still?: string; // a still from the film, shown on its page in the AI section until the film can play
  chapters?: Chapter[]; // the film in its parts, in order: its page in the AI section shows which is playing
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
    still: "/tech/lead-gen.jpg",
    chapters: [
      { at: 0, label: "Brief", title: "“Find diamond jewelers in Krakow.” That’s the whole brief.", text: "One line in plain language: who to find and where." },
      { at: 4, label: "Find", title: "Leads found, enriched and scored.", text: "It searches Maps, reads each business’s website, pulls out the right contacts and rates every lead." },
      { at: 8, label: "Write", title: "An intro drafted for each lead.", text: "The assistant writes the first email in the lead’s own context, ready to send." },
      { at: 12, label: "Outreach", title: "The whole list, written and sent.", text: "Emails for every contact are generated in one go, then tracked from queued to sent to opened." },
      { at: 18, label: "Invoice", title: "Quote, invoice and get paid.", text: "The deal closes in the same CRM, from the same lead." },
      { at: 23, label: "Follow up", title: "Reminders that keep it moving.", text: "Type the follow-up the way you’d say it, and it lands in the priority tasks." },
      { at: 26, label: "Recap", title: "Find. Write. Follow up.", text: "A lead command centre, from the first search to the paid invoice." },
    ],
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
    still: "/tech/payment-recon.jpg",
    chapters: [
      { at: 0, label: "Before", title: "Hundreds of settlements a day, still checked in spreadsheets.", text: "Every UPI, card and netbanking settlement has to tie back to a transaction before a merchant is paid." },
      { at: 6, label: "Upload", title: "Drop in the settlement files.", text: "The day’s files go in together, and their columns are mapped for you." },
      { at: 12, label: "Match", title: "Every transaction matched and balanced.", text: "Each payment is checked against what the bank actually settled, down to zero mismatches." },
      { at: 18, label: "Exceptions", title: "Exceptions flagged, never guessed.", text: "New merchants and held transactions come up on the dashboard for review instead of slipping through." },
      { at: 24, label: "Resolve", title: "Resolved with one saved preset.", text: "Fee rules and column mappings are saved as presets, so a whole merchant is fixed in one step." },
      { at: 30, label: "Payouts", title: "Payouts calculated to the paisa.", text: "Refunds, chargebacks, reserves and the settlement fee are worked out line by line, down to the net payout." },
      { at: 36, label: "Merchants", title: "Merchants see exactly what’s owed.", text: "Each merchant gets its available balance, the reserve held and every payout in one view." },
      { at: 45, label: "Ledger", title: "Every rupee, traceable.", text: "A single UPI payment can be followed through every ledger entry, balanced to zero." },
      { at: 50, label: "Statements", title: "Statements, not spreadsheets.", text: "Gross, fees, reserve and net payout go out as a finished statement." },
      { at: 55, label: "Recap", title: "Settlements, reconciled automatically.", text: "Files matched automatically, exceptions caught before payouts, every rupee traceable to source." },
    ],
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
    video: "/tech/post-stack.mp4",
    still: "/tech/post-stack.jpg",
    chapters: [
      { at: 0, label: "Channels", title: "Every client. Every channel. One calendar.", text: "Instagram, LinkedIn, X, Facebook, TikTok, YouTube, Pinterest and Threads, run from one place." },
      { at: 5, label: "Calendar", title: "Every client’s week, in one view.", text: "Each client’s scheduled posts sit on the same calendar, colour by channel." },
      { at: 11, label: "Create", title: "Pick a client first. Then one, some or all channels.", text: "A post starts in the client’s workspace, so it only goes to that client’s accounts." },
      { at: 15, label: "Preview", title: "Write once. See it exactly as Instagram will.", text: "The caption is written once and previewed live, the way each platform will show it." },
      { at: 23, label: "Plan", title: "Any date range, or the whole month at a glance.", text: "Pick any start and end date, or step back to the month and see every client’s posts." },
      { at: 32, label: "Posts", title: "Every post as a card, with its numbers.", text: "Scheduled and published posts in one list, each with its reach and engagement." },
      { at: 37, label: "Analytics", title: "Reach, likes and followers for every channel.", text: "Impressions, likes, comments and followers per channel, down to each post." },
      { at: 42, label: "Activity", title: "Every login, post and edit, logged.", text: "Who scheduled, edited or connected what, and when, across the whole team." },
      { at: 47, label: "Approvals", title: "Clients review and approve, right in the chat.", text: "The client sees the post as it will go out and signs it off in the same thread." },
      { at: 51, label: "Assistant", title: "A support assistant, built in.", text: "Ask how to schedule, connect a channel or read the analytics, without leaving the app." },
      { at: 54, label: "Team", title: "Settings, team, and light or dark mode.", text: "Roles, notifications and preferences for every workspace." },
      { at: 56, label: "Recap", title: "Every client. Every channel. One calendar.", text: "Planned, approved, scheduled and published from one place." },
    ],
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
