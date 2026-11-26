import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";

// A controllable clock lets tests check SLA deadlines without waiting.
let clock;
let app;

const validTicket = {
  title: "Laptop will not connect to Wi-Fi",
  description: "Since this morning my laptop cannot see the office network.",
  category: "Network",
  requesterEmail: "jane@example.com",
  impact: "Medium",
  urgency: "High",
};

beforeEach(() => {
  clock = new Date("2026-11-26T09:00:00.000Z");
  app = createApp({ db: openDatabase(":memory:"), now: () => clock });
});

async function createTicket(overrides = {}) {
  const res = await request(app).post("/api/tickets").send({ ...validTicket, ...overrides });
  expect(res.status).toBe(201);
  return res.body;
}

function advanceHours(hours) {
  clock = new Date(clock.getTime() + hours * 3600 * 1000);
}

describe("creating tickets", () => {
  it("calculates priority and SLA deadlines", async () => {
    const ticket = await createTicket();
    expect(ticket).toMatchObject({ id: 1, status: "New", priority: "P2" });
    expect(ticket.resolveDueAt).toBe("2026-11-26T17:00:00.000Z"); // P2 = 8 hours
    expect(ticket.allowedNextStatuses).toEqual(["Assigned"]);
  });

  it("rejects invalid input with a clear message", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send({ ...validTicket, requesterEmail: "not-an-email", category: "Coffee" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/requesterEmail/);
    expect(res.body.message).toMatch(/category/);
  });

  it("rejects malformed JSON", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
  });
});

describe("listing tickets", () => {
  it("orders by priority, then oldest first, and filters", async () => {
    await createTicket({ impact: "Low", urgency: "Low", title: "Low priority one" });
    await createTicket({ impact: "High", urgency: "High", title: "Server room outage" });

    const all = await request(app).get("/api/tickets");
    expect(all.body.map((t) => t.priority)).toEqual(["P1", "P4"]);

    const p4 = await request(app).get("/api/tickets?priority=P4");
    expect(p4.body).toHaveLength(1);

    const bad = await request(app).get("/api/tickets?status=Banana");
    expect(bad.status).toBe(400);
  });

  it("returns 404 for a missing ticket and 400 for a bad id", async () => {
    expect((await request(app).get("/api/tickets/99")).status).toBe(404);
    expect((await request(app).get("/api/tickets/abc")).status).toBe(400);
  });
});

describe("ticket lifecycle", () => {
  it("assigning a new ticket moves it to Assigned", async () => {
    const { id } = await createTicket();
    const res = await request(app)
      .patch(`/api/tickets/${id}/assignee`)
      .set("X-Agent", "bharath")
      .send({ assignee: "bharath" });
    expect(res.body).toMatchObject({ status: "Assigned", assignee: "bharath" });
  });

  it("blocks invalid transitions with 409", async () => {
    const { id } = await createTicket();
    const res = await request(app).patch(`/api/tickets/${id}/status`).send({ status: "Closed" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Allowed: Assigned/);
  });

  it("requires a resolution note to resolve", async () => {
    const { id } = await createTicket();
    await request(app).patch(`/api/tickets/${id}/assignee`).send({ assignee: "bharath" });
    await request(app).patch(`/api/tickets/${id}/status`).send({ status: "In Progress" });
    const res = await request(app).patch(`/api/tickets/${id}/status`).send({ status: "Resolved" });
    expect(res.status).toBe(400);
  });

  it("records first response, resolution and a full audit trail", async () => {
    const { id } = await createTicket();
    const agent = (r) => r.set("X-Agent", "bharath");

    await agent(request(app).patch(`/api/tickets/${id}/assignee`)).send({ assignee: "bharath" });
    advanceHours(1);
    const working = await agent(request(app).patch(`/api/tickets/${id}/status`)).send({ status: "In Progress" });
    expect(working.body.firstResponseAt).toBe("2026-11-26T10:00:00.000Z");

    await agent(request(app).post(`/api/tickets/${id}/comments`)).send({ note: "Reset network adapter." });
    advanceHours(1);
    const resolved = await agent(request(app).patch(`/api/tickets/${id}/status`)).send({
      status: "Resolved",
      note: "Driver updated; connection restored.",
    });
    expect(resolved.body.resolvedAt).toBe("2026-11-26T11:00:00.000Z");

    const history = await request(app).get(`/api/tickets/${id}/history`);
    expect(history.body.map((e) => e.type)).toEqual([
      "created", "assigned", "status_change", "status_change", "comment", "status_change",
    ]);
    expect(history.body.at(-1)).toMatchObject({ fromValue: "In Progress", toValue: "Resolved", actor: "bharath" });
  });

  it("reopening a resolved ticket clears the resolution time", async () => {
    const { id } = await createTicket();
    await request(app).patch(`/api/tickets/${id}/assignee`).send({ assignee: "a" });
    await request(app).patch(`/api/tickets/${id}/status`).send({ status: "In Progress" });
    await request(app).patch(`/api/tickets/${id}/status`).send({ status: "Resolved", note: "Fixed" });
    const reopened = await request(app).patch(`/api/tickets/${id}/status`).send({ status: "In Progress" });
    expect(reopened.body.resolvedAt).toBeNull();
  });
});

describe("reports", () => {
  it("summarises volume, SLA breaches and compliance", async () => {
    // Ticket 1: P1 (4h SLA), resolved after 2h → on time.
    const a = await createTicket({ impact: "High", urgency: "High" });
    // Ticket 2: P2 (8h SLA), left open.
    await createTicket();

    await request(app).patch(`/api/tickets/${a.id}/assignee`).send({ assignee: "a" });
    await request(app).patch(`/api/tickets/${a.id}/status`).send({ status: "In Progress" });
    advanceHours(2);
    await request(app).patch(`/api/tickets/${a.id}/status`).send({ status: "Resolved", note: "Done" });

    advanceHours(10); // Ticket 2 is now 12h old → breached.
    const res = await request(app).get("/api/reports/summary");

    expect(res.body).toMatchObject({
      total: 2,
      open: 1,
      breached: 1,
      avgResolutionHours: 2,
      slaCompliancePercent: 100,
      byPriority: { P1: 1, P2: 1 },
      byStatus: { Resolved: 1, New: 1 },
    });
  });
});

describe("unknown routes", () => {
  it("returns JSON 404", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
  });
});
