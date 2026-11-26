import { useEffect, useState } from "react";
import { CURRENT_AGENT } from "./api.js";
import { QueuePage } from "./pages/QueuePage.jsx";
import { TicketPage } from "./pages/TicketPage.jsx";
import { NewTicketPage } from "./pages/NewTicketPage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";

// Minimal hash router: #/queue, #/tickets/12, #/new, #/reports
function parseHash(hash) {
  const [, page = "queue", id] = hash.replace(/^#/, "").split("/");
  return { page, id: id ? Number(id) : null };
}

export function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const go = (path) => {
    window.location.hash = path;
  };

  const nav = [
    ["queue", "Queue"],
    ["new", "New ticket"],
    ["reports", "Reports"],
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Service Desk</div>
        <nav>
          {nav.map(([key, label]) => (
            <a
              key={key}
              href={`#/${key}`}
              className={route.page === key ? "active" : undefined}
              aria-current={route.page === key ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <p className="agent muted small">Signed in as {CURRENT_AGENT} (demo)</p>
      </aside>

      <main className="content">
        {route.page === "tickets" && route.id ? (
          <TicketPage key={route.id} ticketId={route.id} onBack={() => go("/queue")} />
        ) : route.page === "new" ? (
          <NewTicketPage onCreated={(id) => go(`/tickets/${id}`)} />
        ) : route.page === "reports" ? (
          <ReportsPage />
        ) : (
          <QueuePage onOpenTicket={(id) => go(`/tickets/${id}`)} />
        )}
      </main>
    </div>
  );
}
