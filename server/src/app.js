import express from "express";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { IMPACTS, PRIORITIES, URGENCIES } from "./domain/sla.js";
import { STATUSES } from "./domain/workflow.js";
import { createTicketRepository, TicketError } from "./ticketRepository.js";
import { createReports } from "./reports.js";

export const CATEGORIES = ["Hardware", "Software", "Network", "Access", "Email", "Other"];

const createTicketSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(2000),
  category: z.enum(CATEGORIES),
  requesterEmail: z.email(),
  impact: z.enum(IMPACTS),
  urgency: z.enum(URGENCIES),
});

const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.string().trim().min(1).optional(),
});

const assignSchema = z.object({ assignee: z.string().trim().min(1).max(80) });
const statusSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().trim().min(1).max(2000).optional(),
});
const commentSchema = z.object({ note: z.string().trim().min(1).max(2000) });

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
    throw new TicketError(`Invalid request. ${details.join("; ")}`, 400);
  }
  return result.data;
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new TicketError("Ticket id must be a positive integer.", 400);
  return id;
}

/**
 * Until authentication is added, the acting agent is read from the
 * X-Agent header so the audit trail records who did what.
 */
function actorFrom(request) {
  return request.get("X-Agent")?.trim() || "unknown-agent";
}

export function createApp({ db, now, clientDist } = {}) {
  const tickets = createTicketRepository(db, { now });
  const reports = createReports(db, { now });
  const app = express();

  app.use(express.json({ limit: "20kb" }));

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  app.get("/api/meta", (req, res) =>
    res.json({ categories: CATEGORIES, impacts: IMPACTS, urgencies: URGENCIES, statuses: STATUSES, priorities: PRIORITIES })
  );

  app.post("/api/tickets", (req, res) => {
    res.status(201).json(tickets.create(parse(createTicketSchema, req.body)));
  });

  app.get("/api/tickets", (req, res) => {
    res.json(tickets.list(parse(listQuerySchema, req.query)));
  });

  app.get("/api/tickets/:id", (req, res) => {
    res.json(tickets.requireTicket(parseId(req.params.id)));
  });

  app.get("/api/tickets/:id/history", (req, res) => {
    res.json(tickets.history(parseId(req.params.id)));
  });

  app.patch("/api/tickets/:id/assignee", (req, res) => {
    const { assignee } = parse(assignSchema, req.body);
    res.json(tickets.assign(parseId(req.params.id), assignee, actorFrom(req)));
  });

  app.patch("/api/tickets/:id/status", (req, res) => {
    const { status, note } = parse(statusSchema, req.body);
    res.json(tickets.changeStatus(parseId(req.params.id), status, actorFrom(req), note));
  });

  app.post("/api/tickets/:id/comments", (req, res) => {
    const { note } = parse(commentSchema, req.body);
    res.status(201).json(tickets.addComment(parseId(req.params.id), note, actorFrom(req)));
  });

  app.get("/api/reports/summary", (req, res) => res.json(reports.summary()));

  app.use("/api", (req, res) => res.status(404).json({ message: "Not found." }));

  // Serve the built React dashboard (production / Docker).
  if (clientDist && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  // Central error handler: known errors keep their status; anything else
  // is logged and returned as a generic 500 without internal details.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error instanceof TicketError) return res.status(error.status).json({ message: error.message });
    if (error?.type === "entity.parse.failed") return res.status(400).json({ message: "Malformed JSON." });
    console.error(error);
    return res.status(500).json({ message: "Something went wrong." });
  });

  return app;
}
