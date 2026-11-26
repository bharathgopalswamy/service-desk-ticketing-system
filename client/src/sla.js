const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function formatDuration(ms) {
  const totalMinutes = Math.floor(Math.abs(ms) / MINUTE);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Describes where a ticket stands against its resolution SLA.
 * state: "met" | "breached" | "at-risk" (under 25% of the window left or < 1h) | "on-track"
 */
export function slaStatus(ticket, now = new Date()) {
  const due = new Date(ticket.resolveDueAt).getTime();
  const created = new Date(ticket.createdAt).getTime();

  if (ticket.resolvedAt) {
    const resolved = new Date(ticket.resolvedAt).getTime();
    return resolved <= due
      ? { state: "met", label: "SLA met" }
      : { state: "breached", label: `Resolved ${formatDuration(resolved - due)} late` };
  }

  const remaining = due - now.getTime();
  if (remaining < 0) {
    return { state: "breached", label: `Breached ${formatDuration(remaining)} ago` };
  }

  const windowMs = due - created;
  const atRisk = remaining < HOUR || remaining < windowMs * 0.25;
  return { state: atRisk ? "at-risk" : "on-track", label: `${formatDuration(remaining)} left` };
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
