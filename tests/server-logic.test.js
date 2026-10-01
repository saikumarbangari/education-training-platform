import test from "node:test";
import assert from "node:assert/strict";
import { distanceMetres, validCoordinates } from "../server/lib/geo.js";
import {
  createSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../server/lib/security.js";
import {
  validateCourse,
  validateEnrolment,
  validateRegistration,
} from "../server/validation.js";

test("passwords are salted and verified without storing plain text", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
  assert.equal(
    await verifyPassword("correct horse battery staple", first),
    true,
  );
  assert.equal(await verifyPassword("wrong password", first), false);
});

test("session tokens expose a raw token but store only its hash", () => {
  const session = createSessionToken();
  assert.equal(session.token.length, 64);
  assert.equal(session.tokenHash, hashToken(session.token));
  assert.notEqual(session.tokenHash, session.token);
});

test("malformed password hashes cannot authenticate", async () => {
  for (const value of [
    null,
    "scrypt$bad$bad",
    "scrypt$0123$zz",
    "scrypt$00$00",
    "",
  ]) {
    assert.equal(await verifyPassword("anything", value), false);
  }
});

test("validators safely reject null and oversized input", () => {
  assert.equal(Object.keys(validateRegistration(null)).length, 3);
  assert.equal(Object.keys(validateCourse(null)).length > 0, true);
  assert.ok(
    validateEnrolment({ courseId: "python", goal: "x".repeat(501) }).goal,
  );
});

test("registration and enrolment validation reject incomplete input", () => {
  assert.deepEqual(Object.keys(validateRegistration({})), [
    "fullName",
    "email",
    "password",
  ]);
  assert.deepEqual(Object.keys(validateEnrolment({})), ["courseId", "goal"]);
});

test("course validation accepts a complete course", () => {
  const course = {
    id: "intro-to-python",
    title: "Intro to Python",
    summary: "Learn Python fundamentals.",
    category: "Programming",
    level: "Beginner",
    duration: "3 weeks",
    outcome: "Build a small command-line program.",
    skills: ["Python"],
    modules: [{ id: "variables", title: "Variables" }],
  };
  assert.deepEqual(validateCourse(course), {});
  assert.equal(
    validateCourse({
      ...course,
      modules: [course.modules[0], course.modules[0]],
    }).modules,
    "Add 1 to 30 modules with unique IDs and titles.",
  );
});

test("distance calculation supports location-based attendance", () => {
  const distance = distanceMetres(
    { latitude: -33.8688, longitude: 151.2093 },
    { latitude: -33.8698, longitude: 151.2093 },
  );
  assert.ok(distance >= 110 && distance <= 112);
  assert.equal(validCoordinates(-33.8688, 151.2093), true);
  assert.equal(validCoordinates(95, 151.2093), false);
});
