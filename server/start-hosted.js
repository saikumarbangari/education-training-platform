import "dotenv/config";
import { prepareDatabase } from "./bootstrap.js";
import { closePool } from "./db.js";

try {
  await prepareDatabase();
  console.log("Database setup checked. Starting the API.");
  await import("./index.js");
} catch (error) {
  // Database driver errors can include sensitive connection/query details.
  console.error(
    "API startup failed. Check the database connection, TLS and administrator settings.",
    { code: error.code || "STARTUP_ERROR" },
  );
  await closePool();
  process.exitCode = 1;
}
