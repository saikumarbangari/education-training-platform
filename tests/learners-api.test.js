import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newDb } from "pg-mem";
import request from "supertest";
import app from "../server/app.js";
import { configurePool, closePool } from "../server/db.js";
import { createSessionToken } from "../server/lib/security.js";

const database = newDb({ autoCreateForeignKeyIndices: true });
const { Pool } = database.adapters.createPg();
const pool = new Pool();
configurePool(pool);
let admin, adminToken, learnerToken;
const learners = [];

async function session(userId, expiresAt = "2099-01-01") {
  const { token, tokenHash } = createSessionToken();
  await pool.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt],
  );
  return token;
}

test.before(async () => {
  await pool.query(
    await readFile(new URL("../server/db/schema.sql", import.meta.url), "utf8"),
  );
  admin = (
    await pool.query(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES ('Test Administrator', 'admin@example.test', 'private-test-hash', 'admin') RETURNING id",
    )
  ).rows[0];
  adminToken = await session(admin.id);
  for (let index = 0; index < 27; index += 1) {
    const names = [
      "Ada Example",
      "Grace Example",
      "Percent% Name",
      "Under_score",
      "Back\\slash",
    ];
    const { rows } = await pool.query(
      "INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, 'private-test-hash') RETURNING id, full_name, email",
      [names[index] || `Student ${index}`, `learner${index}@example.test`],
    );
    learners.push(rows[0]);
  }
  learnerToken = await session(learners[0].id);
  await pool.query(
    `INSERT INTO courses (id, title, summary, category, level, duration, outcome, modules)
    VALUES ('python', 'Python Basics', 'Introduction', 'Programming', 'Beginner', '2 weeks', 'Learn Python', $1::jsonb)`,
    [
      JSON.stringify([
        { id: "one", title: "First" },
        { id: "two", title: "Second" },
      ]),
    ],
  );
  await pool.query(
    `INSERT INTO enrolments (user_id, course_id, goal, completed_module_ids)
    VALUES ($1, 'python', 'Build a small program.', $2::jsonb)`,
    [learners[0].id, JSON.stringify(["one", "one", "removed"])],
  );
  await pool.query(
    "INSERT INTO enrolments (user_id, course_id, goal) VALUES ($1, 'python', 'A different learning goal.')",
    [learners[1].id],
  );
  for (let index = 0; index < 26; index += 1) {
    await pool.query(
      "INSERT INTO attendance (user_id, course_id, distance_metres, checked_in_at) VALUES ($1, 'python', $2, $3)",
      [learners[0].id, index, new Date(Date.UTC(2026, 0, index + 1))],
    );
  }
  await pool.query(
    "INSERT INTO attendance (user_id, course_id, distance_metres) VALUES ($1, 'python', 99)",
    [learners[1].id],
  );
});

test.after(closePool);

const get = (path, token = adminToken) =>
  request(app)
    .get(`/api/admin/learners${path}`)
    .set("Authorization", `Bearer ${token}`);

test("learner records require a valid administrator session", async () => {
  const expired = await session(admin.id, "2000-01-01");
  for (const path of ["", `/${learners[0].id}`]) {
    assert.equal(
      (await request(app).get(`/api/admin/learners${path}`)).status,
      401,
    );
    assert.equal((await get(path, "invalid")).status, 401);
    assert.equal((await get(path, expired)).status, 401);
    assert.equal((await get(path, learnerToken)).status, 403);
  }
});

test("learner list is paginated, excludes administrators and returns only safe fields", async () => {
  const first = await get("");
  const second = await get("?page=2");
  assert.equal(first.status, 200);
  assert.equal(first.headers["cache-control"], "no-store");
  assert.equal(first.body.total, 27);
  assert.equal(first.body.pageSize, 25);
  assert.equal(first.body.learners.length, 25);
  assert.equal(second.body.learners.length, 2);
  const records = [...first.body.learners, ...second.body.learners];
  assert.equal(new Set(records.map((learner) => String(learner.id))).size, 27);
  assert.ok(
    records.every((learner) => String(learner.id) !== String(admin.id)),
  );
  for (const learner of records) {
    assert.deepEqual(Object.keys(learner).sort(), [
      "createdAt",
      "email",
      "fullName",
      "id",
    ]);
  }
  assert.deepEqual((await get("?page=3")).body.learners, []);
});

test("learner search matches names and emails without treating SQL as a command", async () => {
  for (const query of ["ADA EXAMPLE", "learner0@EXAMPLE.test", "  Ada  "]) {
    const result = await get(`?q=${encodeURIComponent(query)}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.total, 1);
    assert.equal(String(result.body.learners[0].id), String(learners[0].id));
  }
  const result = await get(`?q=${encodeURIComponent("' OR TRUE --")}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 0);
});

test("invalid query parameters and IDs fail safely", async () => {
  for (const path of [
    "?page=0",
    "?page=-1",
    "?page=1.5",
    "?page=1000000",
    "?page=1&page=2",
    "?q=a&q=b",
    `?q=${"a".repeat(101)}`,
    "/abc",
    "/0",
    "/-1",
    "/9223372036854775808",
    `/${learners[0].id}?page=0`,
  ]) {
    assert.equal((await get(path)).status, 400, path);
  }
  assert.equal((await get("/999999")).status, 404);
  assert.equal((await get(`/${admin.id}`)).status, 404);
});

test("learner detail reports current module progress and only that learner's attendance", async () => {
  const result = await get(`/${learners[0].id}`);
  assert.equal(result.status, 200);
  assert.equal(result.headers["cache-control"], "no-store");
  assert.equal(result.body.learner.fullName, "Ada Example");
  assert.deepEqual(Object.keys(result.body.learner).sort(), [
    "createdAt",
    "email",
    "fullName",
    "id",
  ]);
  const enrolment = result.body.enrolments[0];
  assert.equal(enrolment.goal, "Build a small program.");
  assert.equal(enrolment.completedCount, 1);
  assert.equal(enrolment.totalModules, 2);
  assert.equal(enrolment.progress, 50);
  assert.equal(result.body.attendanceTotal, 26);
  assert.equal(result.body.attendance.length, 25);
  assert.equal(result.body.attendance[0].distanceMetres, 25);
  assert.ok(result.body.attendance.every((item) => item.distanceMetres !== 99));
  const second = await get(`/${learners[0].id}?page=2`);
  assert.equal(second.body.attendance.length, 1);
  assert.equal(second.body.attendance[0].distanceMetres, 0);
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /password|token|latitude|longitude|private-test-hash/i,
  );
});

test("a learner without records has useful empty results", async () => {
  const result = await get(`/${learners[2].id}`);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.enrolments, []);
  assert.deepEqual(result.body.attendance, []);
  assert.equal(result.body.attendanceTotal, 0);
});

test("progress handles courses whose modules have been removed", async () => {
  await pool.query(
    "UPDATE courses SET modules = '[]'::jsonb WHERE id = 'python'",
  );
  const result = await get(`/${learners[0].id}`);
  assert.equal(result.body.enrolments[0].progress, 0);
  assert.equal(result.body.enrolments[0].completedCount, 0);
});

test("losing the administrator role immediately removes access", async () => {
  await pool.query("UPDATE users SET role = 'learner' WHERE id = $1", [
    admin.id,
  ]);
  assert.equal((await get("")).status, 403);
  assert.equal((await get(`/${learners[0].id}`)).status, 403);
});
