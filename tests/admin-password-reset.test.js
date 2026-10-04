import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newDb } from "pg-mem";
import { resetAdministratorPassword } from "../server/lib/reset-admin-password.js";
import { hashPassword, verifyPassword } from "../server/lib/security.js";

const settings = {
  ADMIN_PASSWORD_RESET_REQUEST: "e82f766f-0a22-410b-96ea-0b6c79222c57",
  ADMIN_PASSWORD_RESET_EMAIL: "admin@example.test",
  ADMIN_PASSWORD: "new-test-password-123",
};

async function database(t) {
  const memory = newDb();
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  t.after(() => pool.end());
  await pool.query(
    await readFile(new URL("../server/db/schema.sql", import.meta.url), "utf8"),
  );
  for (const [email, role] of [
    ["admin@example.test", "admin"],
    ["another-admin@example.test", "admin"],
    ["learner@example.test", "learner"],
  ]) {
    const { rows } = await pool.query(
      "INSERT INTO users (full_name, email, role, password_hash) VALUES ('Test User', $1, $2, $3) RETURNING id",
      [email, role, await hashPassword("old-test-password-123")],
    );
    await pool.query(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, '2099-01-01')",
      [String(rows[0].id).padStart(64, "0"), rows[0].id],
    );
  }
  return (sql, values) => pool.query(sql, values);
}

test("reset stays disabled without an explicit request", async () => {
  const unusedQuery = () => assert.fail("No database access was expected.");
  assert.equal(await resetAdministratorPassword(unusedQuery, {}), false);
  assert.equal(
    await resetAdministratorPassword(unusedQuery, {
      ...settings,
      ADMIN_PASSWORD_RESET_REQUEST: "",
    }),
    false,
  );
});

test("reset rejects invalid settings before changing data", async () => {
  const unusedQuery = () => assert.fail("No database access was expected.");
  for (const overrides of [
    { ADMIN_PASSWORD: "short" },
    { ADMIN_PASSWORD: "a".repeat(129) },
    { ADMIN_PASSWORD: undefined },
    { ADMIN_PASSWORD_RESET_EMAIL: "invalid" },
    { ADMIN_PASSWORD_RESET_EMAIL: undefined },
    { ADMIN_PASSWORD_RESET_REQUEST: "true" },
  ]) {
    await assert.rejects(
      resetAdministratorPassword(unusedQuery, { ...settings, ...overrides }),
      { code: "ADMIN_RESET_SETTINGS_INVALID" },
    );
  }
});

test("reset changes only the selected administrator and revokes their sessions", async (t) => {
  const runQuery = await database(t);
  const before = await runQuery("SELECT * FROM users ORDER BY id");
  assert.equal(
    await resetAdministratorPassword(runQuery, {
      ...settings,
      ADMIN_PASSWORD_RESET_EMAIL: " ADMIN@example.test ",
    }),
    true,
  );
  const after = await runQuery("SELECT * FROM users ORDER BY id");
  assert.equal(
    await verifyPassword(settings.ADMIN_PASSWORD, after.rows[0].password_hash),
    true,
  );
  assert.equal(
    await verifyPassword("old-test-password-123", after.rows[0].password_hash),
    false,
  );
  assert.deepEqual(after.rows[0], {
    ...before.rows[0],
    password_hash: after.rows[0].password_hash,
  });
  assert.deepEqual(after.rows.slice(1), before.rows.slice(1));
  assert.deepEqual(
    (await runQuery("SELECT user_id FROM sessions ORDER BY user_id")).rows,
    [{ user_id: before.rows[1].id }, { user_id: before.rows[2].id }],
  );
});

test("restarting with the same request does not reset the password again", async (t) => {
  const runQuery = await database(t);
  assert.equal(await resetAdministratorPassword(runQuery, settings), true);
  const newHash = (
    await runQuery("SELECT password_hash FROM users WHERE email = $1", [
      settings.ADMIN_PASSWORD_RESET_EMAIL,
    ])
  ).rows[0].password_hash;
  assert.equal(
    await resetAdministratorPassword(runQuery, {
      ...settings,
      ADMIN_PASSWORD: "another-test-password-123",
    }),
    false,
  );
  assert.equal(
    (
      await runQuery("SELECT password_hash FROM users WHERE email = $1", [
        settings.ADMIN_PASSWORD_RESET_EMAIL,
      ])
    ).rows[0].password_hash,
    newHash,
  );
});

test("reset refuses a learner account or a missing administrator", async (t) => {
  const runQuery = await database(t);
  const before = await runQuery("SELECT * FROM users ORDER BY id");
  for (const [index, email] of [
    "learner@example.test",
    "missing@example.test",
  ].entries()) {
    await assert.rejects(
      resetAdministratorPassword(runQuery, {
        ...settings,
        ADMIN_PASSWORD_RESET_EMAIL: email,
        ADMIN_PASSWORD_RESET_REQUEST: `${index}82f766f-0a22-410b-96ea-0b6c79222c57`,
      }),
      { code: "ADMIN_RESET_ACCOUNT_NOT_FOUND" },
    );
  }
  assert.deepEqual(
    (await runQuery("SELECT * FROM users ORDER BY id")).rows,
    before.rows,
  );
  assert.equal((await runQuery("SELECT * FROM sessions")).rows.length, 3);
});
