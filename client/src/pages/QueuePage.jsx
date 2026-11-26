import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PriorityBadge, SlaIndicator, StatusBadge } from "../components/Badges.jsx";
import { useNow } from "../useNow.js";

const STATUS_FILTERS = ["", "New", "Assigned", "In Progress", "On Hold", "Resolved", "Closed"];
const PRIORITY_FILTERS = ["", "P1", "P2", "P3", "P4"];

export function QueuePage({ onOpenTicket }) {
  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState({ status: "", priority: "" });
  const [openOnly, setOpenOnly] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    api
      .listTickets(filters)
      .then((data) => {
        if (!cancelled) {
          setTickets(data);
          setError("");
        }
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const visible =
    openOnly && !filters.status
      ? tickets.filter((t) => t.status !== "Resolved" && t.status !== "Closed")
      : tickets;

  return (
    <section>
      <header className="page-header">
        <h1>Ticket queue</h1>
        <p className="muted">Sorted by priority, then oldest first.</p>
      </header>

      <div className="filters" role="group" aria-label="Filters">
        <label>
          Status
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s || "All"}</option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            {PRIORITY_FILTERS.map((p) => (
              <option key={p} value={p}>{p || "All"}</option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={openOnly}
            disabled={Boolean(filters.status)}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
          Open tickets only
        </label>
      </div>

      {error && <p role="alert" className="error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && !error && visible.length === 0 && (
        <p className="empty">No tickets match these filters.</p>
      )}

      {visible.length > 0 && (
        <table className="queue">
          <thead>
            <tr>
              <th>#</th>
              <th>Priority</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Resolution SLA</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td><PriorityBadge priority={t.priority} /></td>
                <td>
                  <button type="button" className="link" onClick={() => onOpenTicket(t.id)}>
                    {t.title}
                  </button>
                </td>
                <td>{t.category}</td>
                <td><StatusBadge status={t.status} /></td>
                <td>{t.assignee || <span className="muted">Unassigned</span>}</td>
                <td><SlaIndicator ticket={t} now={now} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
