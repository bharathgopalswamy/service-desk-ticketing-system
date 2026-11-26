/**
 * Priority and SLA rules, modelled on the ITIL impact × urgency matrix.
 *
 * Impact  = how many people or how much of the business is affected.
 * Urgency = how quickly the business needs it fixed.
 * Priority is derived from both, so agents don't pick it by feel.
 */

export const IMPACTS = ["High", "Medium", "Low"];
export const URGENCIES = ["High", "Medium", "Low"];
export const PRIORITIES = ["P1", "P2", "P3", "P4"];

// Rows = impact, columns = urgency.
const PRIORITY_MATRIX = {
  High: { High: "P1", Medium: "P2", Low: "P3" },
  Medium: { High: "P2", Medium: "P3", Low: "P4" },
  Low: { High: "P3", Medium: "P4", Low: "P4" },
};

// Targets in hours: time to first response and time to resolution.
export const SLA_TARGETS = {
  P1: { responseHours: 0.5, resolveHours: 4 },
  P2: { responseHours: 2, resolveHours: 8 },
  P3: { responseHours: 8, resolveHours: 24 },
  P4: { responseHours: 24, resolveHours: 72 },
};

const HOUR_MS = 60 * 60 * 1000;

export function calculatePriority(impact, urgency) {
  const priority = PRIORITY_MATRIX[impact]?.[urgency];
  if (!priority) {
    throw new Error(`Unknown impact/urgency combination: ${impact}/${urgency}`);
  }
  return priority;
}

/** Returns ISO timestamps for the response and resolution deadlines. */
export function calculateDueDates(priority, createdAt) {
  const target = SLA_TARGETS[priority];
  if (!target) throw new Error(`Unknown priority: ${priority}`);

  const start = new Date(createdAt).getTime();
  return {
    responseDueAt: new Date(start + target.responseHours * HOUR_MS).toISOString(),
    resolveDueAt: new Date(start + target.resolveHours * HOUR_MS).toISOString(),
  };
}

/**
 * A ticket breaches its resolution SLA if it was resolved after the due
 * time, or is still open and the due time has passed.
 */
export function isResolutionBreached(ticket, now = new Date()) {
  const due = new Date(ticket.resolveDueAt).getTime();
  const finishedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : null;

  if (finishedAt !== null) return finishedAt > due;
  return now.getTime() > due;
}
