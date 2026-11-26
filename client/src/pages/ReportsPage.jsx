import { useEffect, useState } from "react";
import { api } from "../api.js";

function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <span className="stat-value">{value ?? "—"}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  );
}

/** Simple horizontal bar chart — no chart library needed for counts. */
function BarChart({ title, data, order }) {
  const entries = (order ?? Object.keys(data)).map((k) => [k, data[k] ?? 0]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="card">
      <h2>{title}</h2>
      <ul className="bars" aria-label={title}>
        {entries.map(([label, value]) => (
          <li key={label}>
            <span className="bar-label">{label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(value / max) * 100}%` }} />
            </span>
            <span className="bar-value">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.summary().then(setSummary).catch((err) => setError(err.message));
  }, []);

  if (error) return <p role="alert" className="error">{error}</p>;
  if (!summary) return <p className="muted">Loading…</p>;

  return (
    <section>
      <header className="page-header">
        <h1>Service desk report</h1>
        <p className="muted">Calculated live with SQL from the ticket and audit tables.</p>
      </header>

      <div className="stats">
        <Stat label="Total tickets" value={summary.total} />
        <Stat label="Open" value={summary.open} />
        <Stat label="SLA breaches" value={summary.breached} hint="resolved late or overdue" />
        <Stat
          label="SLA compliance"
          value={summary.slaCompliancePercent == null ? null : `${summary.slaCompliancePercent}%`}
          hint="of resolved tickets"
        />
        <Stat
          label="Avg. resolution"
          value={summary.avgResolutionHours == null ? null : `${summary.avgResolutionHours} h`}
        />
      </div>

      <div className="detail-grid">
        <BarChart title="By priority" data={summary.byPriority} order={["P1", "P2", "P3", "P4"]} />
        <BarChart
          title="By status"
          data={summary.byStatus}
          order={["New", "Assigned", "In Progress", "On Hold", "Resolved", "Closed"]}
        />
        <BarChart title="By category" data={summary.byCategory} />
      </div>
    </section>
  );
}
