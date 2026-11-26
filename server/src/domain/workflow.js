/**
 * Ticket lifecycle. Only these status changes are allowed, which stops
 * mistakes like closing a ticket nobody worked on.
 *
 *   New → Assigned → In Progress ⇄ On Hold
 *                         ↓
 *                     Resolved → Closed
 *                         ↓ (reopen)
 *                    In Progress
 */

export const STATUSES = ["New", "Assigned", "In Progress", "On Hold", "Resolved", "Closed"];

const TRANSITIONS = {
  New: ["Assigned"],
  Assigned: ["In Progress", "New"],
  "In Progress": ["On Hold", "Resolved"],
  "On Hold": ["In Progress"],
  Resolved: ["Closed", "In Progress"],
  Closed: [],
};

export function allowedNextStatuses(current) {
  return TRANSITIONS[current] ?? [];
}

export function canTransition(from, to) {
  return allowedNextStatuses(from).includes(to);
}

export function isOpen(status) {
  return status !== "Resolved" && status !== "Closed";
}
