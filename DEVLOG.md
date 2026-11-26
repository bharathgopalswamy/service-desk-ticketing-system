# Development log

What changed each day, why, and what to understand about it. Each entry ends with interview practice questions.

---

## 2026-11-26 — v0.1: ticket API, SLA rules, workflow, reporting

### What was built

| Area | What | File |
|---|---|---|
| Priority | ITIL impact × urgency matrix → P1–P4 | `server/src/domain/sla.js` |
| SLA | Response/resolution targets, due dates, breach check | `server/src/domain/sla.js` |
| Workflow | Allowed status transitions; reopen from Resolved | `server/src/domain/workflow.js` |
| Database | `tickets` and `ticket_events` (audit) tables, indexes | `server/src/db.js` |
| Business rules | Create, list, assign, change status, comment, history | `server/src/ticketRepository.js` |
| Reporting | SLA breaches, compliance %, average resolution time, counts | `server/src/reports.js` |
| API | 10 endpoints, Zod validation, central error handler | `server/src/app.js` |
| Tests | 28 tests (domain + API), in-memory DB, controllable clock | `server/tests/` |
| CI | Lint + tests on every push / PR | `.github/workflows/ci.yml` |

### Key concepts

**Impact vs urgency.** Impact is how much of the business is affected; urgency is how fast it must be fixed. Deriving priority from both makes triage consistent between agents. A whole-office outage (High/High) is P1; one person's cosmetic issue (Low/Low) is P4.

**SLA (service level agreement).** A promise of how fast the desk will respond and resolve. We store the due times when the ticket is created so later rule changes don't rewrite history.

**Breach logic.** A ticket is breached if it was resolved after its due time, *or* it is still open and the due time has passed. The SQL uses `CASE WHEN` for both cases.

**State machine.** `workflow.js` lists which statuses can follow each status. Anything else returns HTTP 409 (Conflict), because the request is valid but conflicts with the ticket's current state.

**Audit trail.** `ticket_events` is append-only. Support teams need to show who changed what and when (for escalations, audits, and reviewing SLA breaches).

**Repository pattern.** All SQL lives in `ticketRepository.js` and `reports.js`; routes only validate input and call it. Every query uses `?` parameters, which prevents SQL injection.

**Testable time.** The app takes a `now()` function. Tests pass a fake clock and "advance" it, so we can test an 8-hour SLA breach in milliseconds.

**`julianday()`.** SQLite function that turns a timestamp into a day number; subtracting two and multiplying by 24 gives hours.

### Verified today
- `npm test`: 28/28 passing · `npm run lint`: clean
- Server started against a file database; created a ticket and read the report successfully

### Practice questions
1. A user reports their own mouse is broken but they have a spare. What impact, urgency and priority would you give it, and why?
2. Why does changing a "Closed" ticket return 409 rather than 400?
3. How does the report decide a ticket has breached its SLA? Walk through the SQL.
4. Why store `resolve_due_at` on the ticket instead of calculating it every time?
5. How do the tests check an SLA breach without waiting hours?
6. What is SQL injection and how does this code prevent it?

---

## 2026-11-26 — v0.2: React agent dashboard, demo data, Docker

### What was built

| Area | What | Files |
|---|---|---|
| Dashboard | Queue with priority/status badges, filters and live SLA countdown | `client/src/pages/QueuePage.jsx`, `client/src/sla.js`, `client/src/useNow.js` |
| Ticket detail | Details, actions limited to allowed transitions, resolution-note rule, audit trail timeline | `client/src/pages/TicketPage.jsx` |
| Create ticket | Form with live impact × urgency priority preview | `client/src/pages/NewTicketPage.jsx` |
| Reports | KPI tiles and bar charts from `/api/reports/summary` | `client/src/pages/ReportsPage.jsx` |
| Demo data | 8 fictional tickets walked through the real workflow | `server/src/seed.js` |
| Serving | Express serves the built dashboard; optional seeding on start | `server/src/app.js`, `server/src/index.js` |
| Docker | Two-stage image, non-root, health check; Compose with a data volume | `Dockerfile`, `docker-compose.yml` |
| Docs | Architecture doc with diagrams and design decisions; screenshots | `docs/` |
| Tests | +11 (client components, SLA countdown, seed) → 39 total | `client/tests/`, `server/tests/seed.test.js` |
| CI | Adds build step, Docker build and container smoke test | `.github/workflows/ci.yml` |

### Key concepts

**Show only valid actions.** The API returns `allowedNextStatuses` for each ticket, and the UI renders buttons only for those. The server still enforces the rule (409) — the UI just avoids offering mistakes. *Validate on the server, guide in the client.*

**SLA countdown states.** `sla.js` classifies a ticket as on track, at risk (under 25% of its window or under an hour left), breached, or met. `useNow()` re-renders every 30 seconds so the countdown stays current without reloading data.

**Effects that fetch.** Each page fetches inside `useEffect` and ignores the result if the component has unmounted (`cancelled` flag) — this avoids "state update on unmounted component" bugs when the user navigates quickly.

**Mocking `fetch` in component tests.** Tests replace `fetch` with a fake that returns prepared JSON, so they check what the user sees and what the page sends to the API without a server.

**Seeding through the real rules.** Demo tickets are created and moved through the same repository functions the API uses, with a fake clock set in the past — so the audit trail and SLA figures are internally consistent.

**One process in production.** Vite builds static files; Express serves them and the API on the same port. No CORS configuration needed.

**Known limitation (documented).** The SLA clock keeps running while a ticket is On Hold, which is why the "new hire login" demo ticket shows as breached. Pausing the clock is a v0.3 item.

### Verified today
- `npm run lint` clean · `npm test` 39/39 · `npm run build` succeeds
- Ran the production server with demo data; checked queue, ticket detail, new ticket and reports in headless Chrome and captured screenshots
- Docker image not built locally (no Docker daemon here); CI builds and smoke-tests it

### Practice questions
1. If the UI already hides invalid buttons, why does the server still return 409 for invalid status changes?
2. How does the queue decide a ticket is "at risk"? What would you change for a P1?
3. Why does the ticket page use a `cancelled` flag inside `useEffect`?
4. How do the component tests check the right request is sent without a running API?
5. The SLA clock doesn't pause On Hold. How would you implement pausing, and which table would you use to calculate it?
6. Walk through what happens, end to end, when an agent clicks "Move to Resolved".
