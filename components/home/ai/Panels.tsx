import type { PanelId } from "@/components/home/ai/layout";

/* The business as the audit finds it: seven small windows onto the tools a company already runs,
   customer-facing (inbox, leads, client messages) and internal (records, invoices, reporting, tasks).
   Each is drawn twice over where it changes — how it is now (`.is-before`) and how it is once the
   core runs it (`.is-after`) — and the section's scroll crossfades between them (AiNetwork.tsx).
   The data is illustrative. */

function Head({ title, before, after }: { title: string; before: string; after: string }) {
  return (
    <header className="ain-head">
      <span className="ain-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <strong>{title}</strong>
      <span className="ain-state">
        <em className="is-before">{before}</em>
        <em className="is-after">{after}</em>
      </span>
    </header>
  );
}

const MAIL = [
  { from: "Priya S.", subj: "Bulk order enquiry, 200 units", to: "Lead" },
  { from: "Website form", subj: "Pricing for the annual plan?", to: "Lead" },
  { from: "Kora Ltd, Accounts", subj: "Remittance advice INV-1042", to: "Recon" },
  { from: "R. Mehta", subj: "Re: following up on the quote", to: "Lead" },
];

function Inbox() {
  return (
    <>
      <Head title="Inbox" before="14 unread" after="Triaged" />
      <ul className="ain-mail">
        {MAIL.map((m) => (
          <li key={m.subj}>
            <i className="ain-unread is-before" />
            <span>
              <b>{m.from}</b>
              {m.subj}
            </span>
            <em className="ain-route is-after">→ {m.to}</em>
          </li>
        ))}
      </ul>
    </>
  );
}

const SHEET = [
  ["Company", "Contact", "Stage", "Value"],
  ["Kora Ltd", "a.kora@…", "Qualified", "₹2.4L"],
  ["Nexa Retail", "#N/A", "New?", "#REF!"],
  ["Kora Ltd", "a.kora@…", "Qualified", "₹2.4L"],
  ["Vela Foods", "", "—", "₹90K"],
];
const FIXED: Record<string, string> = { "#N/A": "ops@nexa…", "New?": "New", "#REF!": "₹1.1L", "": "m.vela@…", "—": "Won" };

function Sheet() {
  return (
    <>
      <Head title="leads_final_v3 (2).xlsx" before="3 errors" after="Synced · live" />
      <div className="ain-grid">
        {SHEET.map((row, r) =>
          row.map((cell, c) => {
            const bad = r > 0 && cell in FIXED;
            const dup = r === 3;
            return (
              <span key={`${r}-${c}`} className={`${r === 0 ? "is-th" : ""}${bad ? " is-bad" : ""}${dup ? " is-dup" : ""}`}>
                {bad ? (
                  <>
                    <em className="is-before">{cell || "·"}</em>
                    <em className="is-after">{FIXED[cell]}</em>
                  </>
                ) : (
                  cell
                )}
              </span>
            );
          }),
        )}
      </div>
    </>
  );
}

const MESSAGES = [
  { from: "Kora Ltd", text: "Any update on the delivery date?", after: "Draft ready" },
  { from: "Vela Foods", text: "Could you resend last month's invoice?", after: "Sent" },
  { from: "Nexa Retail", text: "Moving our call to Thursday", after: "Noted" },
];

function Messages() {
  return (
    <>
      <Head title="Client messages" before="Waiting on a reply" after="Answered" />
      <ul className="ain-rows ain-msgs">
        {MESSAGES.map((m) => (
          <li key={m.from}>
            <span>
              <b>{m.from}</b>
              {m.text}
            </span>
            <em className="ain-chip is-before">Waiting</em>
            <em className="ain-chip is-after">{m.after}</em>
          </li>
        ))}
      </ul>
    </>
  );
}

const LEADS = [
  { name: "Priya S.", score: 92, to: 2 },
  { name: "Nexa Retail", score: 78, to: 1 },
  { name: "R. Mehta", score: 64, to: 1 },
];

function Leads() {
  return (
    <>
      <Head title="Leads" before="Unsorted" after="Qualified daily" />
      <div className="ain-kanban">
        {["New", "Qualified", "Won"].map((c) => (
          <span key={c} className="ain-col">
            {c}
          </span>
        ))}
        {LEADS.map((l, i) => (
          <span key={l.name} className="ain-lead" style={{ "--row": i, "--to": l.to } as React.CSSProperties}>
            <b>{l.name}</b>
            <em className="is-after">{l.score}</em>
          </span>
        ))}
      </div>
    </>
  );
}

const INVOICES = [
  { no: "INV-1040", amt: "₹48,000", after: "Paid" },
  { no: "INV-1041", amt: "₹1,12,500", after: "Paid" },
  { no: "INV-1042", amt: "₹2,40,000", after: "Paid" },
  { no: "INV-1043", amt: "₹10,000", after: "Short ₹10" },
];

function Invoices() {
  return (
    <>
      <Head title="Invoices" before="4 open" after="Matched" />
      <ul className="ain-rows">
        {INVOICES.map((v, i) => (
          <li key={v.no}>
            <span>{v.no}</span>
            <b>{v.amt}</b>
            <em className={`ain-chip is-before${i === 2 ? " is-late" : ""}`}>{i === 2 ? "Overdue" : "Unpaid"}</em>
            <em className={`ain-chip is-after${i === 3 ? " is-warn" : " is-ok"}`}>{v.after}</em>
          </li>
        ))}
      </ul>
    </>
  );
}

const BARS = [0.42, 0.58, 0.5, 0.74, 0.66, 0.9];

function Report() {
  return (
    <>
      <Head title="Weekly report" before="Not built" after="Built 08:00" />
      <div className="ain-report">
        <dl>
          <div>
            <dt>Qualified</dt>
            <dd>
              <em className="is-before">—</em>
              <em className="is-after">38</em>
            </dd>
          </div>
          <div>
            <dt>Collected</dt>
            <dd>
              <em className="is-before">—</em>
              <em className="is-after">₹4.0L</em>
            </dd>
          </div>
        </dl>
        <div className="ain-bars">
          {BARS.map((h, i) => (
            <i key={i} style={{ "--h": h } as React.CSSProperties} />
          ))}
        </div>
      </div>
    </>
  );
}

const TASKS = ["Copy leads into the sheet", "Match payments to invoices", "Chase INV-1042", "Build the weekly report"];

function Tasks() {
  return (
    <>
      <Head title="To do" before="4h a day" after="Handled" />
      <ul className="ain-tasks">
        {TASKS.map((t) => (
          <li key={t}>
            <i className="ain-check" />
            <span>{t}</span>
            <em className="is-after">auto</em>
          </li>
        ))}
      </ul>
    </>
  );
}

export const PANEL_VIEWS: Record<PanelId, () => React.ReactElement> = {
  inbox: Inbox,
  sheet: Sheet,
  messages: Messages,
  leads: Leads,
  invoices: Invoices,
  report: Report,
  tasks: Tasks,
};
