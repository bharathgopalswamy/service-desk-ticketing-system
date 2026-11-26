// Thin wrapper around the REST API. The acting agent is sent in the
// X-Agent header so every change lands in the audit trail.
export const CURRENT_AGENT = "demo.agent";

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Agent": CURRENT_AGENT,
      ...options.headers,
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response (e.g. network error page).
  }

  if (!response.ok) {
    throw new Error(body?.message || `Request failed (${response.status})`);
  }
  return body;
}

export const api = {
  meta: () => request("/meta"),
  listTickets: (filters = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value)
    );
    const query = params.toString();
    return request(`/tickets${query ? `?${query}` : ""}`);
  },
  getTicket: (id) => request(`/tickets/${id}`),
  getHistory: (id) => request(`/tickets/${id}/history`),
  createTicket: (data) => request("/tickets", { method: "POST", body: JSON.stringify(data) }),
  assign: (id, assignee) =>
    request(`/tickets/${id}/assignee`, { method: "PATCH", body: JSON.stringify({ assignee }) }),
  changeStatus: (id, status, note) =>
    request(`/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
  addComment: (id, note) =>
    request(`/tickets/${id}/comments`, { method: "POST", body: JSON.stringify({ note }) }),
  summary: () => request("/reports/summary"),
};
