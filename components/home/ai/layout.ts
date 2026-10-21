/* Where the business sits on screen, in percent of the pinned frame (x across, y down), centres, with
   the chip at 50/50 (the whole network rides on the chip, wherever the camera has it). By the time
   it's up the camera has slid the chip aside (to 70% across on a wide screen, 32% down on a phone),
   so it keeps to the side away from the text. Two sides either side of the core: the external
   workflows (what customers see) and the internal (the work behind the scenes). Two arrangements:
   the wide screen, and a portrait one for phones, which keeps four panels. */
export type PanelId = "inbox" | "leads" | "messages" | "sheet" | "invoices" | "report" | "tasks";
export type Side = "external" | "internal";
type Spot = { x: number; y: number };

export const PANELS: PanelId[] = ["inbox", "leads", "messages", "sheet", "invoices", "report", "tasks"];
export const SIDE: Record<PanelId, Side> = {
  inbox: "external", leads: "external", messages: "external",
  sheet: "internal", invoices: "internal", report: "internal", tasks: "internal",
};

// external down the near side, internal down the far side, the core between them
const WIDE: Record<PanelId, Spot> = {
  inbox: { x: 30, y: 24 },
  leads: { x: 30, y: 50 },
  messages: { x: 30, y: 76 },
  sheet: { x: 70, y: 22 },
  invoices: { x: 70, y: 41 },
  report: { x: 70, y: 60 },
  tasks: { x: 70, y: 79 },
};

/* a phone keeps four of them: the two external ones above the core, the two internal ones below, out
   at the stage's top and bottom (the stage is the room over the words, AiNetwork.tsx) */
const TALL_IDS: PanelId[] = ["inbox", "leads", "sheet", "tasks"];
const TALL: Record<PanelId, Spot> = {
  ...WIDE,
  inbox: { x: 26, y: 24 },
  leads: { x: 74, y: 24 },
  sheet: { x: 26, y: 76 },
  tasks: { x: 74, y: 76 },
};

export const placesFor = (tall: boolean) => (tall ? TALL : WIDE);
export const panelsFor = (tall: boolean) => (tall ? TALL_IDS : PANELS);

/* Where the audit finds the tools: not in their places but as a business keeps them, scattered and
   askew (r: degrees), each a step off its place. The implementation gathers them (AiNetwork.tsx:
   --k) into the ordered arrangement above. A phone keeps them in place: its stage is too small. */
type Found = Spot & { r: number };
const FOUND_WIDE: Record<PanelId, Found> = {
  inbox: { x: 25, y: 20, r: -5 },
  leads: { x: 33, y: 50, r: 4 },
  messages: { x: 28, y: 80, r: -3 },
  sheet: { x: 69, y: 18, r: 5 },
  invoices: { x: 63, y: 40, r: -4 },
  report: { x: 71, y: 61, r: 3 },
  tasks: { x: 65, y: 83, r: -5 },
};
export const foundFor = (tall: boolean): Record<PanelId, Found> =>
  tall ? (Object.fromEntries(Object.entries(TALL).map(([k, v]) => [k, { ...v, r: 0 }])) as Record<PanelId, Found>) : FOUND_WIDE;

/** Where the audit's scan sweeps, in the frame's units, from the near side to the far. */
export const scanSpan = (tall: boolean) => (tall ? { from: 4, to: 96 } : { from: 21, to: 79 });

/** Orthogonal routes from the core out to each panel, once connected (drawn in a 0..100 box
    stretched over the frame, so they meet the panels wherever the frame's corners are). */
export function linksFor(tall: boolean): { id: PanelId; d: string }[] {
  if (tall)
    return [
      { id: "inbox", d: "M47 47 V45 H26 V42.5" },
      { id: "leads", d: "M53 47 V45 H74 V42.5" },
      { id: "sheet", d: "M47 53 V55 H26 V57.5" },
      { id: "tasks", d: "M53 53 V55 H74 V57.5" },
    ];
  return [
    { id: "inbox", d: "M45.5 50 H41 V24 H37" },
    { id: "leads", d: "M45.5 50 H37" },
    { id: "messages", d: "M45.5 50 H41 V76 H37" },
    { id: "sheet", d: "M54.5 50 H59 V22 H63" },
    { id: "invoices", d: "M54.5 50 H59 V41 H63" },
    { id: "report", d: "M54.5 50 H59 V60 H63" },
    { id: "tasks", d: "M54.5 50 H59 V79 H63" },
  ];
}

/* a hand-off between two of the tools as found: down from the foot of one, across, and down into the
   head of the next (a panel is about 13 of the frame's units tall) */
const handoff = (a: Spot, b: Spot) => `M${a.x} ${a.y + 6.5} V${((a.y + b.y) / 2).toFixed(1)} H${b.x} V${b.y - 6}`;

/** What the audit maps: how the work passes between the tools today, by hand, and where it breaks.
    Drawn between the tools where they were found (wide screens), so it goes askew with them. */
export function mapFor(tall: boolean): { lines: string[]; faults: Spot[] } {
  if (tall)
    return {
      lines: ["M37 26 H63", "M37 74 H63", "M74 42.5 V57.5"],
      faults: [{ x: 50, y: 74 }, { x: 74, y: 50 }],
    };
  const f = FOUND_WIDE;
  const foot = Math.max(f.messages.y, f.tasks.y) + 5; // the line along the bottom, between the two sides
  return {
    lines: [
      handoff(f.inbox, f.leads), handoff(f.leads, f.messages),
      handoff(f.sheet, f.invoices), handoff(f.invoices, f.report), handoff(f.report, f.tasks),
      `M${f.messages.x + 7} ${f.messages.y + 4} V${foot} H${f.tasks.x - 7} V${f.tasks.y + 4}`,
    ],
    faults: [
      { x: f.messages.x, y: (f.leads.y + f.messages.y) / 2 }, // the hand-off into the messages breaks
      { x: f.report.x, y: (f.invoices.y + f.report.y) / 2 }, // and the one into the report
      { x: (f.messages.x + f.tasks.x) / 2, y: foot }, // and the one along the bottom, between the sides
    ],
  };
}

/** The workflow followed through all three stages: an enquiry in the inbox (external), qualified as a
    lead, on into the records (internal). Found in the audit, ranked first, the first to run. */
export function threadFor(tall: boolean): string[] {
  if (tall) return ["M37 22 H63", "M16 42.5 V57.5"];
  const f = FOUND_WIDE;
  return [
    // the enquiry, down from the inbox into the leads (a little to the right of the hand-off)
    `M${f.inbox.x + 3} ${f.inbox.y + 6.5} V${((f.inbox.y + f.leads.y) / 2 + 1.5).toFixed(1)} H${f.leads.x + 3} V${f.leads.y - 6}`,
    // and out of the leads, up over the top, into the records
    `M${f.leads.x + 7} ${f.leads.y - 3} H${f.leads.x + 11} V${f.sheet.y - 8.5} H${f.sheet.x} V${f.sheet.y - 5.5}`,
  ];
}

/** The two sides, framed and named once the business is running (wide screens). */
export const GROUPS: { side: Side; x0: number; x1: number; name: string }[] = [
  { side: "external", x0: 22, x1: 38, name: "External workflows" },
  { side: "internal", x0: 62, x1: 78, name: "Internal workflows" },
];
