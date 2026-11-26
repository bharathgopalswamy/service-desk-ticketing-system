# Service Desk Ticketing System

[![CI](https://github.com/bharathgopalswamy/service-desk-ticketing-system/actions/workflows/ci.yml/badge.svg)](https://github.com/bharathgopalswamy/service-desk-ticketing-system/actions/workflows/ci.yml)

An IT service desk backend modelled on how internal support teams handle incidents: tickets get a priority from **impact × urgency**, carry **SLA deadlines**, move through a controlled **status workflow**, and keep a full **audit trail**. A reporting endpoint gives the numbers a support lead reviews each week.

> Status: v0.1 — REST API, SQLite database and automated tests. A React agent dashboard is next (see Roadmap).

## Why this project

It demonstrates the day-to-day logic of IT support and application support work — triage, prioritisation, SLA tracking, ticket lifecycle and reporting — implemented as a tested, documented application.

## Features

- **ITIL-style priority matrix** — impact (High/Medium/Low) × urgency → P1–P4
- **SLA targets** per priority (response and resolution), with breach detection
- **Status workflow** — New → Assigned → In Progress ⇄ On Hold → Resolved → Closed (resolved tickets can be reopened); invalid moves return `409`
- **Resolution notes required** before a ticket can be resolved
- **Audit trail** — every creation, assignment, status change and comment is recorded with actor and time
- **Reporting** — totals, open tickets, SLA breaches, SLA compliance %, average resolution time, and counts by status, priority and category, all in SQL
- **Input validation** with Zod; parameterised SQL queries only

## SLA targets

| Priority | First response | Resolution |
|---|---|---|
| P1 | 30 min | 4 h |
| P2 | 2 h | 8 h |
| P3 | 8 h | 24 h |
| P4 | 24 h | 72 h |

## Tech stack

Node.js 22 · Express 5 · SQLite (`node:sqlite`) · Zod · Vitest · Supertest · ESLint · GitHub Actions

## Run locally

```bash
npm install
npm run dev        # API on http://localhost:4000
npm test           # 28 tests, in-memory database
```

Requires Node.js 22.5 or newer (built-in SQLite).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/meta` | Allowed categories, impacts, urgencies, statuses, priorities |
| POST | `/api/tickets` | Create a ticket |
| GET | `/api/tickets?status=&priority=&assignee=` | List (highest priority, then oldest first) |
| GET | `/api/tickets/:id` | Ticket details incl. allowed next statuses |
| GET | `/api/tickets/:id/history` | Audit trail |
| PATCH | `/api/tickets/:id/assignee` | Assign (New → Assigned) |
| PATCH | `/api/tickets/:id/status` | Change status (`note` required for Resolved) |
| POST | `/api/tickets/:id/comments` | Add a work note |
| GET | `/api/reports/summary` | SLA and volume report |

The acting agent is sent in an `X-Agent` header until authentication is added.

Example:

```bash
curl -X POST localhost:4000/api/tickets -H "Content-Type: application/json" -d '{
  "title": "Printer offline",
  "description": "Second floor printer shows offline for everyone.",
  "category": "Hardware",
  "requesterEmail": "user@example.com",
  "impact": "Medium",
  "urgency": "Medium"
}'
```

## Project structure

```text
server/
├── src/
│   ├── domain/
│   │   ├── sla.js           # Priority matrix, SLA targets, breach logic
│   │   └── workflow.js      # Allowed status transitions
│   ├── db.js                # Schema and connection
│   ├── ticketRepository.js  # All ticket queries and business rules
│   ├── reports.js           # Reporting SQL
│   ├── app.js               # Routes, validation, error handling
│   └── index.js             # Starts the server
└── tests/                   # Domain and API tests
```

## Roadmap

- React agent dashboard (queue, ticket detail, SLA countdown)
- Authentication and roles (requester, agent, lead)
- Business-hours SLA clock
- Knowledge-base articles linked to resolved tickets
- Power BI / CSV export of the report data
- Docker and hosted demo

## Development log

See [DEVLOG.md](DEVLOG.md).

## Author

Bharath Gopalsamy — [LinkedIn](https://www.linkedin.com/in/bharathgopalsamy) · [Portfolio](https://bharathgopalsamy.vercel.app)
