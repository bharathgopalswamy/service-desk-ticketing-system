import path from "path";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";
import { seed } from "./seed.js";

const port = Number(process.env.PORT) || 4000;
const db = openDatabase(process.env.DATABASE_FILE || "service-desk.db");

// Optional demo data on first start (used by Docker Compose).
if (process.env.SEED_DEMO === "true") {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM tickets").get();
  if (count === 0) console.log(`Seeded ${seed(db)} demo tickets.`);
}

const clientDist = path.resolve(process.cwd(), "client/dist");

createApp({ db, clientDist }).listen(port, () => {
  console.log(`Service desk running on http://localhost:${port}`);
});
