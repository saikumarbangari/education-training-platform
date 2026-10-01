// Foreground local development only. No Windows service or system database setup.
import "dotenv/config";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { createServer } from "vite";
import { query, closePool } from "../db.js";

if (process.env.NODE_ENV === "production")
  throw new Error("Use start:api with a managed database in production.");
const storage = resolve(".local-db");
await mkdir(storage, { recursive: true });
const settingsFile = join(storage, "connection.json");
let settings;
try {
  settings = JSON.parse(await readFile(settingsFile, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  settings = {
    user: "waypoint",
    password: randomBytes(24).toString("hex"),
    port: 55432,
  };
  await writeFile(settingsFile, JSON.stringify(settings), {
    flag: "wx",
    mode: 0o600,
  });
}
const databaseDir = join(storage, "data");
const database = new EmbeddedPostgres({
  ...settings,
  databaseDir,
  authMethod: "scram-sha-256",
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let initialised = true;
try {
  await access(join(databaseDir, "PG_VERSION"));
} catch {
  initialised = false;
}
process.env.DATABASE_URL = `postgresql://${settings.user}:${settings.password}@127.0.0.1:${settings.port}/waypoint`;
process.env.DATABASE_SSL = "false";
process.env.TRUST_PROXY_HOPS = "0";
process.env.CLIENT_ORIGIN = "http://localhost:5173,http://127.0.0.1:5173";
process.env.VITE_API_URL = "/api";
process.env.VITE_BASE_PATH = "/";
process.env.API_PROXY_TARGET = "http://127.0.0.1:3000";
let apiServer, frontend;

try {
  if (!initialised) await database.initialise();
  await database.start();
  const client = database.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  try {
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'waypoint'",
    );
    if (!exists.rowCount) await client.query("CREATE DATABASE waypoint");
  } finally {
    await client.end();
  }
  await query(
    await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"),
  );
  // Seeding inserts missing courses only. Administrator credentials are read from .env.
  await import("./seed.js");
  const { default: app } = await import("../app.js");
  apiServer = await new Promise((resolve, reject) => {
    const server = app.listen(3000, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
  frontend = await createServer({
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
  });
  await frontend.listen();
  console.log("Waypoint is ready at http://127.0.0.1:5173");
  console.log(
    "The database stays in .local-db. Press Ctrl+C to stop all local servers.",
  );
  if (process.argv.includes("--check")) {
    const response = await fetch("http://127.0.0.1:5173/api/courses");
    if (!response.ok || (await response.json()).courses.length < 10)
      throw new Error("Local startup check failed.");
    console.log("Local database, API and frontend proxy check passed.");
  } else {
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  }
} finally {
  await frontend?.close();
  if (apiServer) {
    apiServer.closeAllConnections();
    await new Promise((resolve) => apiServer.close(resolve));
  }
  await closePool();
  await database.stop();
  console.log("Local servers stopped. Your saved database has been kept.");
}
