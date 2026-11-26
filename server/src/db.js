import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tickets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL,
  category        TEXT    NOT NULL,
  requester_email TEXT    NOT NULL,
  impact          TEXT    NOT NULL,
  urgency         TEXT    NOT NULL,
  priority        TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'New',
  assignee        TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL,
  first_response_at TEXT,
  resolved_at     TEXT,
  response_due_at TEXT    NOT NULL,
  resolve_due_at  TEXT    NOT NULL
);

-- Audit trail: every change to a ticket is recorded, never edited.
CREATE TABLE IF NOT EXISTS ticket_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,          -- created | status_change | assigned | comment
  from_value TEXT,
  to_value   TEXT,
  note       TEXT,
  actor      TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_events_ticket    ON ticket_events(ticket_id);
`;

/** Opens a database (":memory:" for tests) and makes sure the tables exist. */
export function openDatabase(filename = ":memory:") {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}
