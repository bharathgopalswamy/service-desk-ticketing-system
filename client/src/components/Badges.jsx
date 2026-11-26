import { slaStatus } from "../sla.js";

export function PriorityBadge({ priority }) {
  return <span className={`badge priority-${priority.toLowerCase()}`}>{priority}</span>;
}

export function StatusBadge({ status }) {
  const key = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge status-${key}`}>{status}</span>;
}

export function SlaIndicator({ ticket, now }) {
  const { state, label } = slaStatus(ticket, now);
  return (
    <span className={`sla sla-${state}`} title="Resolution SLA">
      {label}
    </span>
  );
}
