import { openDatabase } from "./db.js";
import { createTicketRepository } from "./ticketRepository.js";

/**
 * Loads realistic demo tickets so the dashboard and reports have
 * something to show. All people and data are fictional.
 *
 * Each ticket is created at a point in the past (hoursAgo) and then
 * walked through its lifecycle using the same rules the API enforces,
 * so the audit trail and SLA numbers are consistent.
 */
const DEMO_TICKETS = [
  {
    hoursAgo: 3, impact: "High", urgency: "High", category: "Network",
    title: "Wi-Fi down across the Registrar's Office",
    description: "No staff on the second floor can connect to the wireless network since 9 a.m.",
    requesterEmail: "registrar.office@example.edu",
    steps: [["assign", "priya.n", 0.1], ["status", "In Progress", 0.3]],
  },
  {
    hoursAgo: 30, impact: "Medium", urgency: "High", category: "Access",
    title: "New hire cannot log in to the student information system",
    description: "Account was created yesterday but login fails with 'user not provisioned'.",
    requesterEmail: "hr.onboarding@example.edu",
    steps: [["assign", "marcus.l", 1], ["status", "In Progress", 2],
            ["comment", "Role mapping missing in the identity system; raised with IAM team.", 3],
            ["status", "On Hold", 3.5]],
  },
  {
    hoursAgo: 26, impact: "Medium", urgency: "Medium", category: "Software",
    title: "Excel crashes when opening the monthly enrolment report",
    description: "The macro-enabled workbook crashes Excel on two machines in Finance.",
    requesterEmail: "finance.team@example.edu",
    steps: [["assign", "priya.n", 2], ["status", "In Progress", 4],
            ["status", "Resolved", 9, "Repaired Office install and disabled a conflicting add-in."]],
  },
  {
    hoursAgo: 50, impact: "Low", urgency: "Low", category: "Hardware",
    title: "Request: second monitor for reception desk",
    description: "Front desk would like a second monitor to view the booking calendar.",
    requesterEmail: "reception@example.edu",
    steps: [["assign", "jordan.k", 6], ["status", "In Progress", 20],
            ["status", "Resolved", 40, "Monitor installed and configured."], ["status", "Closed", 44]],
  },
  {
    hoursAgo: 14, impact: "High", urgency: "Medium", category: "Email",
    title: "Shared admissions mailbox not receiving external email",
    description: "Applicants report bounce-backs when emailing the admissions address.",
    requesterEmail: "admissions@example.edu",
    steps: [["assign", "marcus.l", 0.5], ["status", "In Progress", 1],
            ["status", "Resolved", 10, "Mail-flow rule was blocking external senders; rule corrected."]],
  },
  {
    hoursAgo: 2, impact: "Low", urgency: "Medium", category: "Software",
    title: "Request to install Power BI Desktop",
    description: "Analyst needs Power BI Desktop for the new reporting project.",
    requesterEmail: "analytics@example.edu",
    steps: [],
  },
  {
    hoursAgo: 40, impact: "Medium", urgency: "Medium", category: "Hardware",
    title: "Printer jams on every second page in Library",
    description: "Library public printer jams frequently; students waiting.",
    requesterEmail: "library.desk@example.edu",
    steps: [["assign", "jordan.k", 5], ["status", "In Progress", 30]],
  },
  {
    hoursAgo: 8, impact: "Medium", urgency: "Low", category: "Access",
    title: "Shared drive permission for new project folder",
    description: "Team needs read/write access to the Strategic Planning folder.",
    requesterEmail: "planning@example.edu",
    steps: [["assign", "priya.n", 1]],
  },
];

export function seed(db, { now = new Date() } = {}) {
  let clock = now;
  const repo = createTicketRepository(db, { now: () => clock });

  for (const t of DEMO_TICKETS) {
    const createdAt = new Date(now.getTime() - t.hoursAgo * 3600_000);
    clock = createdAt;
    const ticket = repo.create(t);

    let assignee = null;
    for (const [kind, value, afterHours, note] of t.steps) {
      clock = new Date(createdAt.getTime() + afterHours * 3600_000);
      // The lead assigns; after that the assigned agent does the work.
      const actor = assignee ?? "team.lead";
      if (kind === "assign") {
        repo.assign(ticket.id, value, "team.lead");
        assignee = value;
      }
      if (kind === "status") repo.changeStatus(ticket.id, value, actor, note);
      if (kind === "comment") repo.addComment(ticket.id, value, actor);
    }
  }
  return DEMO_TICKETS.length;
}

// Run directly: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDatabase(process.env.DATABASE_FILE || "service-desk.db");
  db.exec("DELETE FROM ticket_events; DELETE FROM tickets;");
  console.log(`Seeded ${seed(db)} demo tickets.`);
}
