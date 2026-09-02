import test from "node:test";
import assert from "node:assert/strict";
import { courseProgress, filterCourses } from "../src/utils/courses.js";
import { validateEnrolment } from "../src/utils/validation.js";

const courses = [
  {
    title: "Web Foundations",
    summary: "Build a website",
    skills: ["HTML", "CSS"],
    category: "Web development",
    level: "Beginner",
    modules: [{ id: "one" }, { id: "two" }],
  },
  {
    title: "Data Stories",
    summary: "Explain a chart",
    skills: ["visualisation"],
    category: "Data",
    level: "Intermediate",
    modules: [{ id: "one" }, { id: "two" }],
  },
];

test("course filters work together", () => {
  assert.deepEqual(filterCourses(courses, "css", "Web development", "Beginner"), [courses[0]]);
  assert.equal(filterCourses(courses, "missing").length, 0);
});

test("enrolment validation catches missing details", () => {
  const errors = validateEnrolment({ fullName: "", email: "wrong", goal: "short", agreed: false });
  assert.deepEqual(Object.keys(errors), ["fullName", "email", "goal", "agreed"]);
  assert.deepEqual(
    validateEnrolment({
      fullName: "Sam Lee",
      email: "sam@example.com",
      goal: "Build a portfolio site",
      agreed: true,
    }),
    {},
  );
});

test("progress is derived from completed modules", () => {
  assert.equal(courseProgress(courses[0], { completedModules: ["one"] }), 50);
});
