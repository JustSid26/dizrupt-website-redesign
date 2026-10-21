/* 02, the viability report: the workflows the audit found, weighed against what decides whether
   automating them is worth it, then ranked into recommendations. A sample, and qualitative on
   purpose: no scores or savings, only how each one measures up (one to three marks) and what we'd do
   with it — including keeping one with a person. AiNetwork.tsx plays it: rows come in in the order
   the audit found them (--in), their marks fill (--m), then they settle into rank order (--rk). */

type Row = { id: string; name: string; marks: [number, number, number, number, number]; rec: "auto" | "assist" | "person"; thread?: boolean };

export const CRITERIA = ["Feasibility", "Fit", "Complexity", "Dependencies", "Value"];
const REC = { auto: "Automate", assist: "AI-assisted", person: "Keep with a person" };

// in rank order; `found` is where each came up in the audit
const ROWS: (Row & { found: number })[] = [
  { id: "wf-01", name: "Enquiry to qualified lead", marks: [3, 3, 1, 2, 3], rec: "auto", thread: true, found: 2 },
  { id: "wf-02", name: "Data entry between tools", marks: [3, 3, 1, 2, 2], rec: "auto", found: 1 },
  { id: "wf-03", name: "Invoice follow-ups", marks: [3, 3, 2, 2, 3], rec: "auto", found: 4 },
  { id: "wf-04", name: "Client updates & replies", marks: [2, 2, 2, 1, 2], rec: "assist", found: 0 },
  { id: "wf-05", name: "Weekly reporting", marks: [2, 3, 2, 3, 2], rec: "auto", found: 3 },
  { id: "wf-06", name: "Disputes & exceptions", marks: [1, 1, 3, 3, 1], rec: "person", found: 5 },
];

export function Matrix() {
  return (
    <div className="aim" aria-hidden>
      <header className="aim-head">
        <span>
          <b>Viability report</b> Sample assessment
        </span>
        <span className="aim-head-n">{ROWS.length} workflows assessed</span>
      </header>
      <div className="aim-cols">
        <span>#</span>
        <span>Workflow</span>
        {CRITERIA.map((c, i) => (
          <span key={c} className={`aim-crit aim-c${i}`}>
            {c}
          </span>
        ))}
        <span>Recommendation</span>
      </div>
      <ol className="aim-rows">
        {ROWS.map((r, rank) => (
          <li key={r.id} className={`aim-row${r.thread ? " is-thread" : ""}`} style={{ "--from": r.found, "--to": rank } as React.CSSProperties}>
            <span className="aim-rank">{String(rank + 1).padStart(2, "0")}</span>
            <span className="aim-name">
              <em>{r.id.toUpperCase()}</em>
              {r.name}
            </span>
            {r.marks.map((n, i) => (
              <span key={CRITERIA[i]} className={`aim-crit aim-c${i} aim-meter`} data-n={n}>
                <i />
                <i />
                <i />
              </span>
            ))}
            <span className={`aim-rec is-${r.rec}`}>{REC[r.rec]}</span>
          </li>
        ))}
      </ol>
      <dl className="aim-foot">
        <div>
          <dt>Integrations needed</dt>
          <dd>Email · CRM · Spreadsheets · Accounting</dd>
        </div>
        <div>
          <dt>Risks &amp; considerations</dt>
          <dd>Data quality · Approval steps · Edge cases</dd>
        </div>
      </dl>
    </div>
  );
}
