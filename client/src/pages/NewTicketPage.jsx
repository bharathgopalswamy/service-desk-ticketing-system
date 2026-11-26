import { useState } from "react";
import { api } from "../api.js";

const CATEGORIES = ["Hardware", "Software", "Network", "Access", "Email", "Other"];
const LEVELS = ["High", "Medium", "Low"];

// Mirrors the server's matrix so the requester sees the priority before submitting.
const MATRIX = {
  High: { High: "P1", Medium: "P2", Low: "P3" },
  Medium: { High: "P2", Medium: "P3", Low: "P4" },
  Low: { High: "P3", Medium: "P4", Low: "P4" },
};

const EMPTY = {
  title: "",
  description: "",
  category: "Software",
  requesterEmail: "",
  impact: "Medium",
  urgency: "Medium",
};

export function NewTicketPage({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ticket = await api.createTicket(form);
      onCreated(ticket.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>New ticket</h1>
        <p className="muted">
          Priority is calculated from impact × urgency — currently{" "}
          <strong data-testid="priority-preview">{MATRIX[form.impact][form.urgency]}</strong>.
        </p>
      </header>

      <form className="card form" onSubmit={submit}>
        <label htmlFor="title">Title</label>
        <input id="title" value={form.title} onChange={update("title")} required minLength={5} maxLength={120} />

        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={4}
          value={form.description}
          onChange={update("description")}
          required
          minLength={10}
        />

        <label htmlFor="requesterEmail">Requester email</label>
        <input
          id="requesterEmail"
          type="email"
          value={form.requesterEmail}
          onChange={update("requesterEmail")}
          required
        />

        <div className="form-row">
          <div>
            <label htmlFor="category">Category</label>
            <select id="category" value={form.category} onChange={update("category")}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="impact">Impact</label>
            <select id="impact" value={form.impact} onChange={update("impact")}>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="urgency">Urgency</label>
            <select id="urgency" value={form.urgency} onChange={update("urgency")}>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {error && <p role="alert" className="error">{error}</p>}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Creating…" : "Create ticket"}
        </button>
      </form>
    </section>
  );
}
