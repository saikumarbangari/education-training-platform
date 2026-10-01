import "dotenv/config";
import app from "./app.js";
import { closePool, query } from "./db.js";

const port = Number(process.env.PORT || "3000");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a number between 1 and 65535.");
}

await query("SELECT 1");
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Waypoint API listening on http://localhost:${port}`);
});

function shutdown() {
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
