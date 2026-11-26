import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueuePage } from "../src/pages/QueuePage.jsx";
import { TicketPage } from "../src/pages/TicketPage.jsx";
import { NewTicketPage } from "../src/pages/NewTicketPage.jsx";

const future = new Date(Date.now() + 6 * 3600_000).toISOString();
const past = new Date(Date.now() - 2 * 3600_000).toISOString();

function ticket(overrides = {}) {
  return {
    id: 1, title: "VPN not connecting", description: "Cannot connect to VPN from home.",
    category: "Network", requesterEmail: "a@example.com", impact: "Medium", urgency: "High",
    priority: "P2", status: "New", assignee: null, createdAt: past, updatedAt: past,
    firstResponseAt: null, resolvedAt: null, responseDueAt: future, resolveDueAt: future,
    allowedNextStatuses: ["Assigned"], ...overrides,
  };
}

function json(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("QueuePage", () => {
  it("lists open tickets with priority, status and SLA", async () => {
    fetchMock.mockReturnValue(json([
      ticket(),
      ticket({ id: 2, title: "Old resolved ticket", status: "Resolved", resolvedAt: past }),
    ]));
    render(<QueuePage onOpenTicket={() => {}} />);

    const row = (await screen.findByText("VPN not connecting")).closest("tr");
    expect(within(row).getByText("P2")).toBeInTheDocument();
    expect(within(row).getByText("New")).toBeInTheDocument();
    expect(within(row).getByText(/left$/)).toBeInTheDocument();
    // "Open tickets only" is on by default.
    expect(screen.queryByText("Old resolved ticket")).not.toBeInTheDocument();
  });

  it("sends the selected filter to the API", async () => {
    fetchMock.mockReturnValue(json([]));
    render(<QueuePage onOpenTicket={() => {}} />);
    await screen.findByText(/No tickets match/);

    await userEvent.selectOptions(screen.getByLabelText("Priority"), "P1");
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?priority=P1", expect.any(Object)));
  });

  it("shows API errors", async () => {
    fetchMock.mockReturnValue(json({ message: "Database unavailable" }, 500));
    render(<QueuePage onOpenTicket={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
  });
});

describe("TicketPage", () => {
  function mockTicket(t) {
    fetchMock.mockImplementation((url) =>
      url.endsWith("/history")
        ? json([{ id: 1, type: "created", actor: "a@example.com", createdAt: past, fromValue: null, toValue: "New", note: null }])
        : json(t)
    );
  }

  it("offers only the workflow's allowed next statuses", async () => {
    mockTicket(ticket({ status: "In Progress", allowedNextStatuses: ["On Hold", "Resolved"] }));
    render(<TicketPage ticketId={1} onBack={() => {}} />);

    expect(await screen.findByRole("button", { name: "Move to On Hold" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move to Resolved" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Move to Closed" })).not.toBeInTheDocument();
    expect(screen.getByText("Ticket created")).toBeInTheDocument();
  });

  it("requires a note before resolving and sends it", async () => {
    mockTicket(ticket({ status: "In Progress", allowedNextStatuses: ["On Hold", "Resolved"] }));
    render(<TicketPage ticketId={1} onBack={() => {}} />);

    await userEvent.type(await screen.findByLabelText(/Note/), "Reset VPN profile");
    await userEvent.click(screen.getByRole("button", { name: "Move to Resolved" }));

    const call = fetchMock.mock.calls.find(([, opts]) => opts?.method === "PATCH");
    expect(call[0]).toBe("/api/tickets/1/status");
    expect(JSON.parse(call[1].body)).toEqual({ status: "Resolved", note: "Reset VPN profile" });
  });
});

describe("NewTicketPage", () => {
  it("previews priority from impact × urgency and submits", async () => {
    fetchMock.mockReturnValue(json({ id: 7 }, 201));
    const onCreated = vi.fn();
    render(<NewTicketPage onCreated={onCreated} />);

    expect(screen.getByTestId("priority-preview")).toHaveTextContent("P3");
    await userEvent.selectOptions(screen.getByLabelText("Impact"), "High");
    await userEvent.selectOptions(screen.getByLabelText("Urgency"), "High");
    expect(screen.getByTestId("priority-preview")).toHaveTextContent("P1");

    await userEvent.type(screen.getByLabelText("Title"), "Server room outage");
    await userEvent.type(screen.getByLabelText("Description"), "All servers in rack B are offline.");
    await userEvent.type(screen.getByLabelText("Requester email"), "ops@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(7));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ impact: "High", urgency: "High", category: "Software" });
  });
});
