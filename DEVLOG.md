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
