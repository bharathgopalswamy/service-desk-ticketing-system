import { createApp } from "./app.js";
import { openDatabase } from "./db.js";

const port = Number(process.env.PORT) || 4000;
const db = openDatabase(process.env.DATABASE_FILE || "service-desk.db");

createApp({ db }).listen(port, () => {
  console.log(`Service desk API running on http://localhost:${port}`);
});
