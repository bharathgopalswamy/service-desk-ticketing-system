import { describe, expect, it } from "vitest";
import { calculateDueDates, calculatePriority, isResolutionBreached } from "../src/domain/sla.js";
import { allowedNextStatuses, canTransition, isOpen } from "../src/domain/workflow.js";

describe("calculatePriority (impact × urgency)", () => {
  it.each([
    ["High", "High", "P1"],
    ["High", "Low", "P3"],
    ["Medium", "Medium", "P3"],
    ["Low", "High", "P3"],
    ["Low", "Low", "P4"],
  ])("%s impact + %s urgency → %s", (impact, urgency, expected) => {
    expect(calculatePriority(impact, urgency)).toBe(expected);
  });

  it("rejects unknown values", () => {
    expect(() => calculatePriority("Huge", "High")).toThrow();
  });
});

describe("calculateDueDates", () => {
  it("P1 must be answered in 30 minutes and resolved in 4 hours", () => {
    const due = calculateDueDates("P1", "2026-11-26T10:00:00.000Z");
    expect(due.responseDueAt).toBe("2026-11-26T10:30:00.000Z");
    expect(due.resolveDueAt).toBe("2026-11-26T14:00:00.000Z");
  });

  it("P4 is resolved within 72 hours", () => {
    expect(calculateDueDates("P4", "2026-11-26T10:00:00.000Z").resolveDueAt).toBe(
      "2026-11-29T10:00:00.000Z"
    );
  });
});

describe("isResolutionBreached", () => {
  const ticket = { resolveDueAt: "2026-11-26T14:00:00.000Z", resolvedAt: null };

  it("open ticket before the deadline is not breached", () => {
    expect(isResolutionBreached(ticket, new Date("2026-11-26T13:00:00Z"))).toBe(false);
  });
  it("open ticket after the deadline is breached", () => {
    expect(isResolutionBreached(ticket, new Date("2026-11-26T15:00:00Z"))).toBe(true);
  });
  it("ticket resolved late stays breached", () => {
    expect(isResolutionBreached({ ...ticket, resolvedAt: "2026-11-26T14:30:00Z" })).toBe(true);
  });
  it("ticket resolved on time is not breached", () => {
    expect(isResolutionBreached({ ...ticket, resolvedAt: "2026-11-26T13:59:00Z" })).toBe(false);
  });
});

describe("workflow", () => {
  it("allows the normal path New → Assigned → In Progress → Resolved → Closed", () => {
    expect(canTransition("New", "Assigned")).toBe(true);
    expect(canTransition("Assigned", "In Progress")).toBe(true);
    expect(canTransition("In Progress", "Resolved")).toBe(true);
    expect(canTransition("Resolved", "Closed")).toBe(true);
  });

  it("blocks skipping steps and reopening closed tickets", () => {
    expect(canTransition("New", "Resolved")).toBe(false);
    expect(canTransition("Closed", "In Progress")).toBe(false);
    expect(allowedNextStatuses("Closed")).toEqual([]);
  });

  it("allows reopening a resolved ticket", () => {
    expect(canTransition("Resolved", "In Progress")).toBe(true);
  });

  it("treats Resolved and Closed as not open", () => {
    expect(isOpen("On Hold")).toBe(true);
    expect(isOpen("Resolved")).toBe(false);
  });
});
