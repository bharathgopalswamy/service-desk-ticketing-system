/**
 * Service desk reporting queries — the numbers a support lead looks at
 * every week. Written as plain SQL so each one can be explained and
 * reused in a BI tool such as Power BI.
 */
export function createReports(db, { now = () => new Date() } = {}) {
  function countBy(column) {
    return Object.fromEntries(
      db.prepare(`SELECT ${column} AS key, COUNT(*) AS count FROM tickets GROUP BY ${column}`)
        .all()
        .map((row) => [row.key, row.count])
    );
  }

  function summary() {
    const nowIso = now().toISOString();

    const totals = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS open,
        -- Breached = resolved late, or still open past the due time.
        SUM(CASE
              WHEN resolved_at IS NOT NULL AND resolved_at > resolve_due_at THEN 1
              WHEN resolved_at IS NULL AND status <> 'Closed' AND ? > resolve_due_at THEN 1
              ELSE 0 END) AS breached,
        -- Average hours from creation to resolution (julianday returns days).
        ROUND(AVG(CASE WHEN resolved_at IS NOT NULL
                       THEN (julianday(resolved_at) - julianday(created_at)) * 24 END), 2)
          AS avgResolutionHours
      FROM tickets`).get(nowIso);

    const resolved = db.prepare(`
      SELECT COUNT(*) AS resolved,
             SUM(CASE WHEN resolved_at <= resolve_due_at THEN 1 ELSE 0 END) AS onTime
      FROM tickets WHERE resolved_at IS NOT NULL`).get();

    return {
      total: totals.total,
      open: totals.open ?? 0,
      breached: totals.breached ?? 0,
      avgResolutionHours: totals.avgResolutionHours,
      slaCompliancePercent: resolved.resolved
        ? Math.round((resolved.onTime / resolved.resolved) * 1000) / 10
        : null,
      byStatus: countBy("status"),
      byPriority: countBy("priority"),
      byCategory: countBy("category"),
    };
  }

  return { summary };
}
