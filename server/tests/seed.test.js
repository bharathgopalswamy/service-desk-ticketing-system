import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db.js";
import { seed } from "../src/seed.js";
import { createReports } from "../src/reports.js";

describe("demo seed", () => {
  it("creates consistent tickets that follow the workflow rules", () => {
    const db = openDatabase(":memory:");
    const now = new Date("2026-11-26T12:00:00Z");
    const count = seed(db, { now });

    const summary = createReports(db, { now: () => now }).summary();
    expect(summary.total).toBe(count);
    expect(summary.open).toBeGreaterThan(0);
    expect(summary.byStatus.Closed).toBe(1);

    // Every ticket has a "created" event first in its audit trail.
    const firstEvents = db
      .prepare("SELECT type FROM ticket_events WHERE id IN (SELECT MIN(id) FROM ticket_events GROUP BY ticket_id)")
      .all();
    expect(firstEvents.every((e) => e.type === "created")).toBe(true);
  });
});
