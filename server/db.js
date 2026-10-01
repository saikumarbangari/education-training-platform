import pg from "pg";

const { Pool } = pg;
let pool;

function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Managed databases normally require TLS. Never disable certificate verification.
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_CA
              ? { ca: process.env.DATABASE_CA.replace(/\\n/g, "\n") }
              : {}),
          }
        : undefined,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
  return pool;
}

export function configurePool(customPool) {
  if (pool) throw new Error("Database pool is already configured.");
  pool = customPool;
}

export function query(text, values) {
  return getPool().query(text, values);
}

export async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work((text, values) => client.query(text, values));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) await pool.end();
  pool = undefined;
}
