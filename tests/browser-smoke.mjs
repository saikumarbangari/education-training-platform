// One bounded, sequential browser run against real PostgreSQL. All owned servers
// stop in finally; nothing is installed as a service or left running.
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
import { build, preview } from "vite";
import react from "@vitejs/plugin-react";
import { configurePool, closePool } from "../server/db.js";
import { prepareDatabase } from "../server/bootstrap.js";
import { checkLearnerDashboard } from "./dashboard-browser.mjs";

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const databaseDir = await mkdtemp(join(tmpdir(), "waypoint-test-"));
const databasePort = await freePort();
const frontendPort = await freePort();
const password = randomBytes(24).toString("hex");
const databaseUrl = `postgresql://waypoint:${password}@127.0.0.1:${databasePort}/waypoint`;
const database = new EmbeddedPostgres({
  databaseDir,
  port: databasePort,
  user: "waypoint",
  password,
  authMethod: "scram-sha-256",
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
const basePath = "/education-training-platform/";
const origin = `http://127.0.0.1:${frontendPort}`;
const screenshots = "output/e2e";
let pool, apiServer, frontend, browser;
const pageErrors = [];
const accountPassword = randomBytes(18).toString("hex");

async function apiRequest(path, { method = "GET", token, body } = {}) {
  return fetch(`http://127.0.0.1:${apiServer.address().port}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

try {
  console.log("Starting temporary PostgreSQL database…");
  await database.initialise();
  await database.start();
  await database.createDatabase("waypoint");
  pool = new pg.Pool({ connectionString: databaseUrl });
  configurePool(pool);
  const schema = await readFile(
    new URL("../server/db/schema.sql", import.meta.url),
    "utf8",
  );
  await pool.query(schema);
  await pool.query(schema);
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: "false",
    ADMIN_EMAIL: "admin@example.test",
    ADMIN_PASSWORD: accountPassword,
  };
  await assert.rejects(
    prepareDatabase({ ...env, ADMIN_PASSWORD: "short" }),
    /ADMIN_PASSWORD/,
  );
  assert.equal(
    (await pool.query("SELECT COUNT(*) FROM courses")).rows[0].count,
    "0",
  );
  await prepareDatabase(env);
  const adminHash = (
    await pool.query(
      "SELECT password_hash FROM users WHERE email = 'admin@example.test'",
    )
  ).rows[0].password_hash;
  await prepareDatabase(env);
  assert.equal(
    (
      await pool.query(
        "SELECT password_hash FROM users WHERE email = 'admin@example.test'",
      )
    ).rows[0].password_hash,
    adminHash,
  );
  console.log(
    "PASS hosted bootstrap rollback and repeated startup without password reset",
  );
  assert.equal(
    (await pool.query("SELECT COUNT(*) FROM courses")).rows[0].count,
    "10",
  );
  process.env.CLIENT_ORIGIN = origin;
  process.env.TRUST_PROXY_HOPS = "0";
  const { default: app } = await import("../server/app.js");
  apiServer = await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const apiOrigin = `http://127.0.0.1:${apiServer.address().port}`;
  await mkdir(screenshots, { recursive: true });
  await build({
    configFile: false,
    envDir: false,
    base: basePath,
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(`${apiOrigin}/api`),
    },
    build: { outDir: `${screenshots}/site`, emptyOutDir: true },
    logLevel: "warn",
  });
  frontend = await preview({
    configFile: false,
    envDir: false,
    base: basePath,
    build: { outDir: `${screenshots}/site` },
    preview: { host: "127.0.0.1", port: frontendPort, strictPort: true },
  });
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chrome",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    geolocation: { latitude: -33.8688, longitude: 151.2093 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const goto = (route) => page.goto(`${origin}${basePath}#${route}`);
  const course = JSON.parse(
    await readFile(
      new URL("../public/data/courses.json", import.meta.url),
      "utf8",
    ),
  )[0];

  await goto("/admin/learners");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();

  await goto("/");
  await expect(page.locator(".course-card")).toHaveCount(10);
  await page.screenshot({
    path: `${screenshots}/discover-desktop.png`,
    fullPage: true,
  });
  await goto(`/courses/${course.id}/enrol`);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Enter a name between 2 and 100 characters."),
  ).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Test Learner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("learner@example.test");
  await page.getByLabel("Password", { exact: true }).fill(accountPassword);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Join ${course.title}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm enrolment" }).click();
  await expect(page.locator(".error-summary")).toBeFocused();
  await expect(page.getByLabel("What do you want to achieve?")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page
    .getByLabel("What do you want to achieve?")
    .fill("Build a useful small programming project.");
  await page.getByLabel("I want to add this course to My learning.").check();
  await expect(page.locator(".error-summary")).toHaveCount(0);
  await expect(page.getByLabel("What do you want to achieve?")).toHaveAttribute(
    "aria-invalid",
    "false",
  );

  await page.route("**/api/enrolments", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          headers: { "access-control-allow-origin": origin },
          body: JSON.stringify({
            message: "Enrolment is unavailable. Try again.",
          }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Confirm enrolment" }).click();
  await expect(page.locator(".error-summary")).toHaveText(
    "Enrolment is unavailable. Try again.",
  );
  await expect(page.locator(".error-summary")).toBeFocused();
  await expect(page.getByLabel("What do you want to achieve?")).toHaveValue(
    "Build a useful small programming project.",
  );
  await expect(
    page.getByRole("button", { name: "Confirm enrolment" }),
  ).toBeEnabled();
  await page.unroute("**/api/enrolments");
  await page
    .getByLabel("What do you want to achieve?")
    .fill("Build and test a useful small programming project.");
  await expect(page.locator(".error-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm enrolment" }).click();
  await expect(
    page.getByRole("heading", { name: "Your current courses" }),
  ).toBeVisible();
  const firstModule = page.locator(".module-row input").first();
  await firstModule.click();
  await expect(
    page.getByText("Progress saved to your account.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(firstModule).toBeChecked();
  console.log(
    "PASS enrolment validation recovery, failed-save retry, progress and refresh",
  );

  await page.route("**/api/enrolments/*/progress", (route) => route.abort());
  await firstModule.click();
  await expect(page.getByText(/Changes were not saved/)).toBeVisible();
  await expect(firstModule).toBeChecked();
  await page.unroute("**/api/enrolments/*/progress");
  await firstModule.click();
  await expect(
    page.getByText("Progress saved to your account.", { exact: true }),
  ).toBeVisible();
  await firstModule.click();
  await expect(
    page.getByText("Progress saved to your account.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/learning-desktop.png`,
    fullPage: true,
  });

  // Leaving a different course removes only that enrolment.
  const secondCourse = JSON.parse(
    await readFile(
      new URL("../public/data/courses.json", import.meta.url),
      "utf8",
    ),
  )[1];
  await goto(`/courses/${secondCourse.id}/enrol`);
  await page
    .getByLabel("What do you want to achieve?")
    .fill("Practise another programming language.");
  await page.getByLabel("I want to add this course to My learning.").check();
  await page.getByRole("button", { name: "Confirm enrolment" }).click();
  await expect(page.locator(".learning-card")).toHaveCount(2);
  await goto("/progress");
  const summaryCount = (label) =>
    page
      .locator(".progress-ledger dl div")
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator("dd");
  await expect(summaryCount("Enrolled")).toHaveText("2");
  await expect(summaryCount("Not started")).toHaveText("1");
  await expect(summaryCount("In progress")).toHaveText("1");
  await expect(summaryCount("Completed")).toHaveText("0");
  await goto("/learning");
  const secondCard = page.locator(".learning-card").filter({
    has: page.getByRole("heading", { name: secondCourse.title, exact: true }),
  });
  await secondCard
    .getByRole("button", { name: "Leave course", exact: true })
    .click();
  await secondCard
    .getByRole("button", { name: "Keep course", exact: true })
    .click();
  await expect(page.locator(".learning-card")).toHaveCount(2);
  await secondCard
    .getByRole("button", { name: "Leave course", exact: true })
    .click();
  await secondCard
    .getByRole("button", { name: "Confirm leave", exact: true })
    .click();
  await expect(page.locator(".learning-card")).toHaveCount(1);
  console.log("PASS withdrawal cancellation and owner-scoped withdrawal");

  await goto("/attendance");
  await page
    .getByRole("button", { name: "Share location and check in" })
    .click();
  await expect(
    page.getByText("Choose a course before checking in."),
  ).toBeVisible();
  await page.getByLabel("Your course", { exact: true }).selectOption(course.id);
  await context.setGeolocation({ latitude: -33.85, longitude: 151.2093 });
  await page
    .getByRole("button", { name: "Share location and check in" })
    .click();
  await expect(page.getByText(/Move within 250 metres/)).toBeVisible();
  await context.setGeolocation({ latitude: -33.8688, longitude: 151.2093 });
  let releaseCheckIn;
  const saveGate = new Promise((resolve) => {
    releaseCheckIn = resolve;
  });
  await page.route("**/api/attendance/check-in", async (route) => {
    if (route.request().method() === "POST") await saveGate;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Share location and check in" })
    .click();
  try {
    await expect(
      page.getByRole("button", { name: "Saving attendance…", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByLabel("Your course", { exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Saving your check-in…");
  } finally {
    releaseCheckIn();
  }
  await expect(
    page.getByText("Attendance recorded. You are checked in."),
  ).toBeVisible();
  await page.unroute("**/api/attendance/check-in");
  await expect(page.locator(".attendance-history li")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Share location and check in" }),
  ).toBeEnabled();
  await page.screenshot({
    path: `${screenshots}/attendance-desktop.png`,
    fullPage: true,
  });
  await context.clearPermissions();
  await page
    .getByRole("button", { name: "Share location and check in" })
    .click();
  await expect(page.getByText(/Location permission was denied/)).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".attendance-history li")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Share location and check in" }),
  ).toBeEnabled();
  console.log(
    "PASS course selection, pending attendance save, outside venue and denied permission",
  );

  await goto("/admin/learners");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Learners", exact: true }),
  ).toHaveCount(0);

  const learnerToken = await page.evaluate(() =>
    sessionStorage.getItem("waypoint-session"),
  );
  await goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  assert.equal(
    (await apiRequest("/courses/admin", { token: learnerToken })).status,
    403,
  );
  const other = await (
    await apiRequest("/auth/register", {
      method: "POST",
      body: {
        fullName: "Other Learner",
        email: "other@example.test",
        password: accountPassword,
        role: "admin",
      },
    })
  ).json();
  assert.equal(other.user.role, "learner");
  assert.deepEqual(
    (await (await apiRequest("/enrolments/me", { token: other.token })).json())
      .enrolments,
    [],
  );
  assert.deepEqual(
    (await (await apiRequest("/attendance/me", { token: other.token })).json())
      .attendance,
    [],
  );
  assert.equal(
    (
      await apiRequest(`/enrolments/${course.id}/progress`, {
        method: "PATCH",
        token: other.token,
        body: { completedModuleIds: [] },
      })
    ).status,
    404,
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  assert.equal(
    (await apiRequest("/auth/me", { token: learnerToken })).status,
    401,
  );
  await page
    .getByLabel("Email address", { exact: true })
    .fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill(accountPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Manage courses", exact: true }),
  ).toBeVisible();
  console.log("PASS role checks, owner isolation and logout revocation");

  const adminSummary = page.locator(".admin-form .error-summary");
  let adminCreateRequests = 0;
  const countAdminCreates = (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/courses")) {
      adminCreateRequests += 1;
    }
  };
  page.on("request", countAdminCreates);
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await expect(adminSummary).toBeFocused();
  await expect(page.getByLabel("Course ID", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  assert.equal(
    adminCreateRequests,
    0,
    "Invalid courses should not be submitted",
  );
  await adminSummary.getByRole("link", { name: /lowercase course ID/ }).click();
  await expect(page.getByLabel("Course ID", { exact: true })).toBeFocused();
  await page
    .getByLabel("Course ID", { exact: true })
    .fill("browser-test-course");
  await expect(page.getByLabel("Course ID", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "false",
  );
  await expect(
    adminSummary.getByRole("link", { name: /lowercase course ID/ }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Course title", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .getByLabel("Course title", { exact: true })
    .fill("Browser Test Course");
  await page
    .getByLabel("Summary", { exact: true })
    .fill("A temporary test course.");
  await page.getByLabel("Duration", { exact: true }).fill("2 weeks");
  await page
    .getByLabel("Learning outcome", { exact: true })
    .fill("Build a small program.");
  await page.getByLabel("Skills", { exact: true }).fill("Testing, JavaScript");
  await page
    .getByLabel("Modules", { exact: true })
    .fill("first | First module\nfirst | Duplicate module");
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await expect(adminSummary).toBeFocused();
  assert.equal(
    adminCreateRequests,
    0,
    "Duplicate module IDs must be corrected",
  );
  await adminSummary
    .getByRole("link", { name: /unique IDs and titles/ })
    .click();
  await expect(page.getByLabel("Modules", { exact: true })).toBeFocused();
  await page
    .getByLabel("Modules", { exact: true })
    .fill("first | First module\nsecond | Second module");
  await expect(adminSummary).toHaveCount(0);
  await expect(page.getByLabel("Modules", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "false",
  );

  await page.getByLabel("Venue latitude", { exact: true }).fill("-33.8688");
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await expect(adminSummary).toBeFocused();
  await adminSummary
    .getByRole("link", { name: "Provide both venue coordinates." })
    .click();
  await expect(
    page.getByLabel("Venue latitude", { exact: true }),
  ).toBeFocused();
  for (const label of ["Venue latitude", "Venue longitude"]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute(
      "aria-describedby",
      /admin-venue-error/,
    );
  }
  await page.locator(".admin-form").screenshot({
    path: `${screenshots}/admin-validation.png`,
  });
  await page.getByLabel("Venue longitude", { exact: true }).fill("151.2093");
  await expect(adminSummary).toHaveCount(0);
  await expect(page.locator("#admin-venue-error")).toHaveCount(0);
  await expect(
    page.getByLabel("Venue latitude", { exact: true }),
  ).toHaveAttribute("aria-invalid", "false");

  await page.route("**/api/courses", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          json: { message: "Course service temporarily unavailable." },
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await expect(adminSummary).toBeFocused();
  await expect(adminSummary).toContainText(
    "Course service temporarily unavailable.",
  );
  await expect(page.getByLabel("Course title", { exact: true })).toHaveValue(
    "Browser Test Course",
  );
  await expect(page.locator(".admin-course-list li")).toHaveCount(10);
  await expect(
    page.getByRole("button", { name: "Save course", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Summary", { exact: true })
    .fill("A temporary browser test course.");
  await expect(adminSummary).toHaveCount(0);
  await page.unroute("**/api/courses");
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await expect(page.getByText("Course saved.", { exact: true })).toBeVisible();
  await expect(page.locator(".admin-course-list li")).toHaveCount(11);
  page.off("request", countAdminCreates);
  console.log(
    "PASS administrator validation, error focus and failed-save recovery",
  );
  await page
    .getByLabel("Course title", { exact: true })
    .fill("Updated Test Course");
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Updated Test Course" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/admin-desktop.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Delete Updated Test Course", exact: true })
    .click();
  const deletePanel = page.locator(".confirm-panel");
  await expect(deletePanel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Confirm delete", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Delete Updated Test Course",
      exact: true,
    }),
  ).toBeFocused();
  await expect(deletePanel).toHaveCount(0);
  await expect(page.locator(".admin-course-list li")).toHaveCount(11);
  await page
    .getByRole("button", { name: "Delete Updated Test Course", exact: true })
    .click();
  await page.route("**/api/courses/browser-test-course", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 503,
          json: { message: "Course deletion temporarily unavailable." },
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(deletePanel).toContainText(
    "Course deletion temporarily unavailable.",
  );
  await expect(deletePanel).toBeFocused();
  await expect(adminSummary).toHaveCount(0);
  await expect(page.locator(".admin-course-list li")).toHaveCount(11);
  await expect(
    page.getByRole("button", { name: "Confirm delete", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/courses/browser-test-course");

  let releaseDelete;
  const deleteGate = new Promise((resolve) => {
    releaseDelete = resolve;
  });
  await page.route("**/api/courses/browser-test-course", async (route) => {
    if (route.request().method() === "DELETE") await deleteGate;
    await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Confirm delete", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Deleting…", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save course", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "New course", exact: true }),
    ).toBeDisabled();
    await expect(deletePanel).not.toContainText(
      "Course deletion temporarily unavailable.",
    );
  } finally {
    releaseDelete();
  }
  await expect(
    page.getByText("Course deleted.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/courses/browser-test-course");
  await expect(
    page.getByRole("button", { name: "New course", exact: true }),
  ).toBeFocused();
  await expect(deletePanel).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Add a course", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Course ID", { exact: true })).toHaveValue("");
  await expect(page.locator(".admin-course-list li")).toHaveCount(10);
  console.log(
    "PASS administrator CRUD, keyboard delete cancellation and failed-delete recovery",
  );

  await checkLearnerDashboard({
    page,
    goto,
    pool,
    course,
    origin,
    screenshots,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/learning",
    "/progress",
    "/attendance",
    "/admin",
  ]) {
    await goto(route);
    await expect(page.locator("h1")).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `Horizontal overflow at ${route}`,
    );
  }
  await page.screenshot({
    path: `${screenshots}/admin-mobile.png`,
    fullPage: true,
  });
  await goto("/learning");
  await expect(
    page.getByRole("heading", { name: "Your learning list is empty" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("learner@example.test");
  await page.getByLabel("Password", { exact: true }).fill(accountPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(firstModule).toBeChecked();
  await goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Progress by course" }),
  ).toBeVisible();
  await expect(summaryCount("Enrolled")).toHaveText("1");
  await expect(summaryCount("Not started")).toHaveText("0");
  await expect(summaryCount("In progress")).toHaveText("1");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "Progress summary overflows the mobile viewport",
  );
  await page.screenshot({
    path: `${screenshots}/progress-mobile.png`,
    fullPage: true,
  });
  await goto("/attendance");
  await expect(page.locator(".attendance-history li")).toHaveCount(1);
  await page.screenshot({
    path: `${screenshots}/attendance-mobile.png`,
    fullPage: true,
  });

  await page.route("**/api/courses", (route) => route.abort());
  await goto("/");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/courses");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".course-card")).toHaveCount(10);

  await pool.query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 day'");
  await goto("/learning");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  console.log(
    "PASS mobile layouts, account switching, API failure/retry and session expiry",
  );
  assert.deepEqual(pageErrors, []);

  await closePool();
  await database.stop();
  await database.start();
  pool = new pg.Pool({ connectionString: databaseUrl });
  configurePool(pool);
  const persisted = (
    await pool.query(
      "SELECT completed_module_ids FROM enrolments JOIN users ON users.id = enrolments.user_id WHERE users.email = 'learner@example.test'",
    )
  ).rows[0];
  assert.deepEqual(persisted.completed_module_ids, [course.modules[0].id]);
  assert.equal(
    (await pool.query("SELECT COUNT(*) FROM attendance")).rows[0].count,
    "1",
  );
  console.log(
    "PASS PostgreSQL restart preserves enrolment, progress and attendance",
  );
  await pool.query("DELETE FROM courses WHERE id = $1", [secondCourse.id]);
  await pool.query(
    "UPDATE courses SET title = 'Preserved course edit' WHERE id = $1",
    [course.id],
  );
  await prepareDatabase({ ...env, ADMIN_EMAIL: "other@example.test" });
  assert.equal(
    (
      await pool.query(
        "SELECT role FROM users WHERE email = 'other@example.test'",
      )
    ).rows[0].role,
    "learner",
  );
  assert.equal(
    (await pool.query("SELECT COUNT(*) FROM courses")).rows[0].count,
    "9",
  );
  assert.equal(
    (await pool.query("SELECT title FROM courses WHERE id = $1", [course.id]))
      .rows[0].title,
    "Preserved course edit",
  );
  console.log(
    "PASS hosted restart preserves course edits/deletions and cannot promote a learner",
  );
  console.log(`Browser checks passed. Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  await frontend?.close();
  if (apiServer) {
    apiServer.closeAllConnections();
    await new Promise((resolve) => apiServer.close(resolve));
  }
  await closePool();
  await database.stop();
  console.log("Test servers and database stopped.");
}
