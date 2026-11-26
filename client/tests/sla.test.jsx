import { describe, expect, it } from "vitest";
import { slaStatus } from "../src/sla.js";

const base = {
  createdAt: "2026-11-26T08:00:00.000Z",
  resolveDueAt: "2026-11-26T16:00:00.000Z", // 8h window
  resolvedAt: null,
};
const at = (iso) => new Date(iso);

describe("slaStatus", () => {
  it("is on track early in the window", () => {
    expect(slaStatus(base, at("2026-11-26T09:00:00Z"))).toEqual({ state: "on-track", label: "7h 0m left" });
  });

  it("is at risk with under 25% of the window left", () => {
    expect(slaStatus(base, at("2026-11-26T14:30:00Z")).state).toBe("at-risk");
  });

  it("is breached after the due time", () => {
    expect(slaStatus(base, at("2026-11-26T17:15:00Z"))).toEqual({ state: "breached", label: "Breached 1h 15m ago" });
  });

  it("reports met / late for resolved tickets regardless of the current time", () => {
    expect(slaStatus({ ...base, resolvedAt: "2026-11-26T12:00:00Z" }).state).toBe("met");
    expect(slaStatus({ ...base, resolvedAt: "2026-11-26T18:00:00Z" }).label).toBe("Resolved 2h 0m late");
  });
});
