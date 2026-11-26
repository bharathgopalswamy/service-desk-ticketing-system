import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PriorityBadge, SlaIndicator, StatusBadge } from "../components/Badges.jsx";
import { formatDateTime } from "../sla.js";
import { useNow } from "../useNow.js";

function describeEvent(e) {
  switch (e.type) {
    case "created": return "Ticket created";
    case "assigned": return `Assigned to ${e.toValue}${e.fromValue ? ` (was ${e.fromValue})` : ""}`;
    case "status_change": return `Status: ${e.fromValue} → ${e.toValue}`;
    case "comment": return "Work note";
    default: return e.type;
  }
}

export function TicketPage({ ticketId, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0); // bump to reload after an action
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getTicket(ticketId), api.getHistory(ticketId)])
      .then(([t, h]) => {
        if (cancelled) return;
        setTicket(t);
        setHistory(h);
        setError("");
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [ticketId, version]);

  async function run(action) {
    setBusy(true);
    try {
      await action();
      setNote("");
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !ticket) return <p role="alert" className="error">{error}</p>;
  if (!ticket) return <p className="muted">Loading…</p>;

  return (
    <section>
      <button type="button" className="link" onClick={onBack}>← Back to queue</button>

      <header className="page-header">
        <h1>
          #{ticket.id} {ticket.title}
        </h1>
        <div className="meta-row">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
          <SlaIndicator ticket={ticket} now={now} />
        </div>
      </header>

      {error && <p role="alert" className="error">{error}</p>}

      <div className="detail-grid">
        <div className="card">
          <h2>Details</h2>
          <p>{ticket.description}</p>
          <dl>
            <dt>Requester</dt><dd>{ticket.requesterEmail}</dd>
            <dt>Category</dt><dd>{ticket.category}</dd>
            <dt>Impact / Urgency</dt><dd>{ticket.impact} / {ticket.urgency}</dd>
            <dt>Assignee</dt><dd>{ticket.assignee || "Unassigned"}</dd>
            <dt>Created</dt><dd>{formatDateTime(ticket.createdAt)}</dd>
            <dt>Response due</dt><dd>{formatDateTime(ticket.responseDueAt)}</dd>
            <dt>Resolution due</dt><dd>{formatDateTime(ticket.resolveDueAt)}</dd>
            <dt>Resolved</dt><dd>{formatDateTime(ticket.resolvedAt)}</dd>
          </dl>
        </div>

        <div className="card">
          <h2>Actions</h2>
          {ticket.status !== "Closed" && (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (assignee.trim()) run(() => api.assign(ticket.id, assignee.trim()));
              }}
            >
              <label htmlFor="assignee">Assign to</label>
              <input
                id="assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="agent username"
              />
              <button type="submit" disabled={busy || !assignee.trim()}>Assign</button>
            </form>
          )}

          <label htmlFor="note">Note (required to resolve)</label>
          <textarea
            id="note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Work note or resolution details"
          />

          <div className="button-row">
            <button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => run(() => api.addComment(ticket.id, note.trim()))}
            >
              Add note
            </button>
            {/* Only the transitions the workflow allows are offered. */}
            {ticket.allowedNextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className="primary"
                disabled={busy || (status === "Resolved" && !note.trim())}
                onClick={() => run(() => api.changeStatus(ticket.id, status, note.trim() || undefined))}
              >
                Move to {status}
              </button>
            ))}
          </div>
          {ticket.allowedNextStatuses.length === 0 && (
            <p className="muted">Closed tickets cannot be changed.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Audit trail</h2>
        <ol className="timeline">
          {history.map((e) => (
            <li key={e.id}>
              <span className="muted">{formatDateTime(e.createdAt)} · {e.actor}</span>
              <strong>{describeEvent(e)}</strong>
              {e.note && <p>{e.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
