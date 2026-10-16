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

// a phone keeps four of them: the two external ones above the core, the two internal ones below
const TALL_IDS: PanelId[] = ["inbox", "leads", "sheet", "tasks"];
const TALL: Record<PanelId, Spot> = {
  ...WIDE,
  inbox: { x: 26, y: 37 },
  leads: { x: 74, y: 37 },
  sheet: { x: 26, y: 63 },
  tasks: { x: 74, y: 63 },
};

export const placesFor = (tall: boolean) => (tall ? TALL : WIDE);
export const panelsFor = (tall: boolean) => (tall ? TALL_IDS : PANELS);

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

/** What the audit maps: how the work passes between the tools today, by hand, and where it breaks. */
export function mapFor(tall: boolean): { lines: string[]; faults: Spot[] } {
  if (tall)
    return {
      lines: ["M37 39 H63", "M37 63 H63", "M74 42.5 V57.5"],
      faults: [{ x: 50, y: 63 }, { x: 74, y: 50 }],
    };
  return {
    lines: ["M30 30.5 V44", "M30 70 V56", "M70 27 V35", "M70 47 V55", "M70 65 V73.5", "M37 80 H63"],
    faults: [{ x: 30, y: 63 }, { x: 70, y: 51 }, { x: 50, y: 80 }],
  };
}

/** The workflow followed through all three stages: an enquiry in the inbox (external), qualified as a
    lead, on into the records (internal). Found in the audit, ranked first, the first to run. */
export function threadFor(tall: boolean): string[] {
  if (tall) return ["M37 35 H63", "M16 42.5 V57.5"];
  return ["M33 30.5 V44", "M37 47 H41 V13.5 H70 V16.5"];
}

/** The two sides, framed and named once the business is running (wide screens). */
export const GROUPS: { side: Side; x0: number; x1: number; name: string }[] = [
  { side: "external", x0: 22, x1: 38, name: "External workflows" },
  { side: "internal", x0: 62, x1: 78, name: "Internal workflows" },
];
