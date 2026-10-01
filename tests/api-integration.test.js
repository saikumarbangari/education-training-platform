import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newDb } from "pg-mem";
import request from "supertest";
import app from "../server/app.js";
import { closePool, configurePool } from "../server/db.js";

const memory = newDb({ autoCreateForeignKeyIndices: true });
const adapter = memory.adapters.createPg();
const pool = new adapter.Pool();
configurePool(pool);

const schema = await readFile(
  new URL("../server/db/schema.sql", import.meta.url),
  "utf8",
);
await pool.query(schema);

test.after(async () => {
  await closePool();
});

test("full API lifecycle covers auth, CRUD, progress and sensor attendance", async () => {
  const adminRegistration = await request(app).post("/api/auth/register").send({
    fullName: "Admin User",
    email: "admin@example.com",
    password: "admin-password-123",
  });
  assert.equal(adminRegistration.status, 201);
  const adminToken = adminRegistration.body.token;
  await pool.query(
    "UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'",
  );

  const learnerRegistration = await request(app)
    .post("/api/auth/register")
    .send({
      fullName: "Learner User",
      email: "learner@example.com",
      password: "learner-password-123",
    });
  assert.equal(learnerRegistration.status, 201);
  assert.equal(learnerRegistration.body.user.role, "learner");
  const learnerToken = learnerRegistration.body.token;
  const storedSessions = await pool.query("SELECT token_hash FROM sessions");
  assert.equal(
    storedSessions.rows.some((session) => session.token_hash === learnerToken),
    false,
  );

  const duplicate = await request(app).post("/api/auth/register").send({
    fullName: "Other Learner",
    email: "LEARNER@example.com",
    password: "another-password-123",
  });
  assert.equal(duplicate.status, 409);

  const protectedRequest = await request(app).get("/api/enrolments/me");
  assert.equal(protectedRequest.status, 401);

  const invalidJson = await request(app)
    .post("/api/auth/register")
    .set("Content-Type", "application/json")
    .send('{"fullName":');
  assert.equal(invalidJson.status, 400);
  assert.equal(invalidJson.body.message, "Request body contains invalid JSON.");

  const course = {
    id: "community-python-workshop",
    title: "Community Python Workshop",
    summary: "A practical in-person Python course.",
    category: "Programming",
    level: "Beginner",
    duration: "3 weeks",
    outcome: "Build and explain a small Python program.",
    skills: ["Python", "Problem solving"],
    modules: [
      { id: "variables", title: "Variables and values" },
      { id: "functions", title: "Reusable functions" },
    ],
    venueName: "Sydney Training Hub",
    venueLatitude: -33.8688,
    venueLongitude: 151.2093,
    checkInRadiusMetres: 250,
  };

  const createCourse = await request(app)
    .post("/api/courses")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(course);
  assert.equal(createCourse.status, 201);
  assert.equal(createCourse.body.course.id, course.id);

  for (const body of [
    { ...course, venueName: 42 },
    { ...course, venueLatitude: true },
    { ...course, checkInRadiusMetres: "250abc" },
    [],
  ]) {
    const invalid = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);
    assert.equal(invalid.status, 400);
  }
  const missingBody = await request(app)
    .post("/api/attendance/check-in")
    .set("Authorization", `Bearer ${learnerToken}`);
  assert.equal(missingBody.status, 400);
  const publicCors = await request(app)
    .get("/api/courses")
    .set("Origin", "http://localhost:5173");
  assert.equal(
    publicCors.headers["access-control-allow-origin"],
    "http://localhost:5173",
  );
  const foreignCors = await request(app)
    .get("/api/courses")
    .set("Origin", "https://unrelated.example");
  assert.equal(foreignCors.headers["access-control-allow-origin"], undefined);

  const learnerCannotCreate = await request(app)
    .post("/api/courses")
    .set("Authorization", `Bearer ${learnerToken}`)
    .send({ ...course, id: "not-allowed" });
  assert.equal(learnerCannotCreate.status, 403);

  const listCourses = await request(app).get("/api/courses");
  assert.equal(listCourses.status, 200);
  assert.equal(listCourses.body.courses.length, 1);
  assert.equal(listCourses.headers["x-content-type-options"], "nosniff");
  assert.equal("venueLatitude" in listCourses.body.courses[0], false);

  const adminCourses = await request(app)
    .get("/api/courses/admin")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(adminCourses.status, 200);
  assert.equal(
    adminCourses.body.courses[0].venueLatitude,
    course.venueLatitude,
  );

  const updateCourse = await request(app)
    .put(`/api/courses/${course.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ ...course, title: "Updated Community Python Workshop" });
  assert.equal(updateCourse.status, 200);
  assert.equal(
    updateCourse.body.course.title,
    "Updated Community Python Workshop",
  );

  const enrol = await request(app)
    .post("/api/enrolments")
    .set("Authorization", `Bearer ${learnerToken}`)
    .send({
      courseId: course.id,
      goal: "Use Python for a small community project.",
    });
  assert.equal(enrol.status, 201);

  const duplicateEnrolment = await request(app)
    .post("/api/enrolments")
    .set("Authorization", `Bearer ${learnerToken}`)
    .send({
      courseId: course.id,
      goal: "Use Python for a small community project.",
    });
  assert.equal(duplicateEnrolment.status, 409);

  const progress = await request(app)
    .patch(`/api/enrolments/${course.id}/progress`)
    .set("Authorization", `Bearer ${learnerToken}`)
    .send({ completedModuleIds: ["variables"] });
  assert.equal(progress.status, 200);
  assert.deepEqual(progress.body.enrolment.completedModules, ["variables"]);

  const invalidProgress = await request(app)
    .patch(`/api/enrolments/${course.id}/progress`)
    .set("Authorization", `Bearer ${learnerToken}`)
    .send({ completedModuleIds: ["unknown"] });
  assert.equal(invalidProgress.status, 400);

  const farCheckIn = await request(app)
    .post("/api/attendance/check-in")
    .set("Authorization", `Bearer ${learnerToken}`)
    .send({ courseId: course.id, latitude: -33.85, longitude: 151.2093 });
  assert.equal(farCheckIn.status, 422);

  const missingCoordinates = await request(app)
    .post("/api/attendance/check-in")
    .set("Authorization", `Bearer ${learnerToken}`)
    .send({ courseId: course.id });
  assert.equal(missingCoordinates.status, 400);

  const checkIn = await request(app)
    .post("/api/attendance/check-in")
    .set("Authorization", `Bearer ${learnerToken}`)
    .send({ courseId: course.id, latitude: -33.8688, longitude: 151.2093 });
  assert.equal(checkIn.status, 201);
  assert.equal(checkIn.body.attendance.distanceMetres, 0);

  const attendanceHistory = await request(app)
    .get("/api/attendance/me")
    .set("Authorization", `Bearer ${learnerToken}`);
  assert.equal(attendanceHistory.status, 200);
  assert.equal(attendanceHistory.body.attendance.length, 1);

  const login = await request(app).post("/api/auth/login").send({
    email: "learner@example.com",
    password: "learner-password-123",
  });
  assert.equal(login.status, 200);

  const logout = await request(app)
    .post("/api/auth/logout")
    .set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(logout.status, 204);

  const loggedOutSession = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(loggedOutSession.status, 401);

  const deleteCourse = await request(app)
    .delete(`/api/courses/${course.id}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(deleteCourse.status, 204);

  const coursesAfterDelete = await request(app).get("/api/courses");
  assert.deepEqual(coursesAfterDelete.body.courses, []);
  const enrolmentsAfterDelete = await request(app)
    .get("/api/enrolments/me")
    .set("Authorization", `Bearer ${learnerToken}`);
  assert.deepEqual(enrolmentsAfterDelete.body.enrolments, []);
  const attendanceAfterDelete = await request(app)
    .get("/api/attendance/me")
    .set("Authorization", `Bearer ${learnerToken}`);
  assert.deepEqual(attendanceAfterDelete.body.attendance, []);
});

test("authentication attempts are rate limited", async () => {
  let result;
  for (let attempt = 0; attempt < 31; attempt += 1) {
    result = await request(app).post("/api/auth/login").send({});
  }
  assert.equal(result.status, 429);
  assert.match(result.body.message, /Too many sign-in attempts/);
});
