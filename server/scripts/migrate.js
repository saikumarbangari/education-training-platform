import "dotenv/config";
import { readFile } from "node:fs/promises";
import { closePool, query } from "../db.js";

try {
  const sql = await readFile(
    new URL("../db/schema.sql", import.meta.url),
    "utf8",
  );
  await query(sql);
  console.log("Database schema is ready.");
} finally {
  await closePool();
}
