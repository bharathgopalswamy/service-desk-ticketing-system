import { calculateDueDates, calculatePriority } from "./domain/sla.js";
import { canTransition, allowedNextStatuses } from "./domain/workflow.js";

export class TicketError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Map database rows (snake_case) to API objects (camelCase).
function toTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    requesterEmail: row.requester_email,
    impact: row.impact,
    urgency: row.urgency,
    priority: row.priority,
    status: row.status,
    assignee: row.assignee,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstResponseAt: row.first_response_at,
    resolvedAt: row.resolved_at,
    responseDueAt: row.response_due_at,
    resolveDueAt: row.resolve_due_at,
    allowedNextStatuses: allowedNextStatuses(row.status),
  };
}

/**
 * All database access for tickets lives here, so routes stay thin and
 * every query uses parameters (no string-built SQL → no SQL injection).
 */
export function createTicketRepository(db, { now = () => new Date() } = {}) {
  const addEvent = db.prepare(`
    INSERT INTO ticket_events (ticket_id, type, from_value, to_value, note, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  function getById(id) {
    return toTicket(db.prepare("SELECT * FROM tickets WHERE id = ?").get(id));
  }

  function requireTicket(id) {
    const ticket = getById(id);
    if (!ticket) throw new TicketError("Ticket not found.", 404);
    return ticket;
  }

  function create(input) {
    const createdAt = now().toISOString();
    const priority = calculatePriority(input.impact, input.urgency);
    const { responseDueAt, resolveDueAt } = calculateDueDates(priority, createdAt);

    const result = db
      .prepare(`
        INSERT INTO tickets (title, description, category, requester_email, impact, urgency,
          priority, status, created_at, updated_at, response_due_at, resolve_due_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?)`)
      .run(
        input.title, input.description, input.category, input.requesterEmail,
        input.impact, input.urgency, priority, createdAt, createdAt, responseDueAt, resolveDueAt
      );

    const id = Number(result.lastInsertRowid);
    addEvent.run(id, "created", null, "New", null, input.requesterEmail, createdAt);
    return getById(id);
  }

  function list({ status, priority, assignee } = {}) {
    const conditions = [];
    const params = [];
    if (status) { conditions.push("status = ?"); params.push(status); }
    if (priority) { conditions.push("priority = ?"); params.push(priority); }
    if (assignee) { conditions.push("assignee = ?"); params.push(assignee); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    // Highest priority first, then oldest first (first in, first out).
    return db
      .prepare(`SELECT * FROM tickets ${where} ORDER BY priority ASC, created_at ASC`)
      .all(...params)
      .map(toTicket);
  }

  function assign(id, assignee, actor) {
    const ticket = requireTicket(id);
    if (ticket.status === "Closed") throw new TicketError("Closed tickets cannot be reassigned.", 409);

    const timestamp = now().toISOString();
    const nextStatus = ticket.status === "New" ? "Assigned" : ticket.status;

    db.prepare("UPDATE tickets SET assignee = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(assignee, nextStatus, timestamp, id);
    addEvent.run(id, "assigned", ticket.assignee, assignee, null, actor, timestamp);
    if (nextStatus !== ticket.status) {
      addEvent.run(id, "status_change", ticket.status, nextStatus, null, actor, timestamp);
    }
    return getById(id);
  }

  function changeStatus(id, nextStatus, actor, note) {
    const ticket = requireTicket(id);

    if (!canTransition(ticket.status, nextStatus)) {
      throw new TicketError(
        `Cannot move a ticket from "${ticket.status}" to "${nextStatus}". ` +
          `Allowed: ${allowedNextStatuses(ticket.status).join(", ") || "none"}.`,
        409
      );
    }
    if (nextStatus === "Resolved" && !note) {
      throw new TicketError("A resolution note is required to resolve a ticket.");
    }

    const timestamp = now().toISOString();
    // First move into active work counts as the first response.
    const firstResponseAt =
      ticket.firstResponseAt ?? (nextStatus === "In Progress" ? timestamp : null);
    const resolvedAt =
      nextStatus === "Resolved" ? timestamp
      : nextStatus === "In Progress" ? null   // reopened
      : ticket.resolvedAt;

    db.prepare(`
      UPDATE tickets SET status = ?, updated_at = ?, first_response_at = ?, resolved_at = ?
      WHERE id = ?`).run(nextStatus, timestamp, firstResponseAt, resolvedAt, id);
    addEvent.run(id, "status_change", ticket.status, nextStatus, note ?? null, actor, timestamp);
    return getById(id);
  }

  function addComment(id, note, actor) {
    requireTicket(id);
    const timestamp = now().toISOString();
    addEvent.run(id, "comment", null, null, note, actor, timestamp);
    db.prepare("UPDATE tickets SET updated_at = ? WHERE id = ?").run(timestamp, id);
    return history(id).at(-1);
  }

  function history(id) {
    requireTicket(id);
    return db
      .prepare(`SELECT id, type, from_value AS fromValue, to_value AS toValue, note, actor,
                created_at AS createdAt FROM ticket_events WHERE ticket_id = ? ORDER BY id`)
      .all(id)
      .map((row) => ({ ...row }));
  }

  return { create, getById, requireTicket, list, assign, changeStatus, addComment, history };
}
