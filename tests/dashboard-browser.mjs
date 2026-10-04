import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function checkLearnerDashboard({
  page,
  goto,
  pool,
  course,
  origin,
  screenshots,
}) {
  const learner = (
    await pool.query(
      "SELECT id FROM users WHERE email = 'learner@example.test'",
    )
  ).rows[0];
  const privatePath = `/admin/learners/${learner.id}`;
  const failure = {
    status: 503,
    contentType: "application/json",
    headers: { "access-control-allow-origin": origin },
    body: JSON.stringify({ message: "Records are temporarily unavailable." }),
  };

  await page.route(
    "**/api/admin/learners?*",
    (route) => route.fulfill(failure),
    { times: 1 },
  );
  await page.getByRole("link", { name: "Learners", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Learners unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".learner-list > li")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Manage courses", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Learners", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const insertedIds = [];
  const attendanceIds = [];
  try {
    for (let index = 0; index < 25; index += 1) {
      const { rows } = await pool.query(
        "INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, 'test-only-hash') RETURNING id",
        [
          `Dashboard Test ${String(index).padStart(2, "0")}`,
          `dashboard-check-${index}@example.test`,
        ],
      );
      insertedIds.push(rows[0].id);
    }
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.locator(".learner-list > li")).toHaveCount(25);
    const pagination = page.getByRole("navigation", { name: "Learner pages" });
    await pagination.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".learner-list > li")).toHaveCount(2);
    await expect(page.locator("#learner-results-heading")).toBeFocused();
    await expect(
      pagination.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();

    const search = page.getByLabel("Search by name or email");
    await search.fill("nobody-matches-this");
    await search.press("Enter");
    await expect(page.getByText(/No learners found/)).toBeVisible();
    await search.fill("LEARNER@EXAMPLE.TEST");
    await search.press("Enter");
    await expect(page.locator(".learner-list > li")).toHaveCount(1);
    await expect(page.locator(".learner-list")).toContainText("Test Learner");
    await page.screenshot({
      path: `${screenshots}/learners-desktop.png`,
      fullPage: true,
    });

    await page.route(
      `**/api${privatePath}?*`,
      (route) => route.fulfill(failure),
      { times: 1 },
    );
    await page
      .getByRole("link", { name: "View records for Test Learner" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Learner records unavailable" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Test Learner", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Enrolled courses (1)", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "value",
      String(Math.round(100 / course.modules.length)),
    );
    await expect(page.locator(".learner-enrolments")).toContainText(
      "Build and test a useful small programming project.",
    );
    await expect(page.locator(".attendance-history li")).toHaveCount(1);
    await expect(page.locator(".attendance-history")).toContainText(
      "0 m from the venue",
    );
    await expect(page.locator("main")).not.toContainText("other@example.test");
    await page.screenshot({
      path: `${screenshots}/learner-record-desktop.png`,
      fullPage: true,
    });

    for (let index = 0; index < 25; index += 1) {
      const { rows } = await pool.query(
        "INSERT INTO attendance (user_id, course_id, distance_metres) VALUES ($1, $2, 10) RETURNING id",
        [learner.id, course.id],
      );
      attendanceIds.push(rows[0].id);
    }
    await page
      .getByRole("button", { name: "Refresh records", exact: true })
      .click();
    await expect(page.locator(".attendance-history li")).toHaveCount(25);
    await page
      .getByRole("navigation", { name: "Attendance pages" })
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await expect(page.locator(".attendance-history li")).toHaveCount(1);
    await expect(page.locator("#learner-attendance")).toBeFocused();
    for (const id of attendanceIds)
      await pool.query("DELETE FROM attendance WHERE id = $1", [id]);
    attendanceIds.length = 0;
    await page
      .getByRole("button", { name: "Refresh records", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Attendance history (1)",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".attendance-history li")).toHaveCount(1);
    await expect(
      page.getByRole("navigation", { name: "Attendance pages" }),
    ).toHaveCount(0);

    // Search wildcard characters must be treated literally in real PostgreSQL.
    await pool.query(
      "UPDATE users SET full_name = 'Literal%_Name' WHERE id = $1",
      [insertedIds[0]],
    );
    await page.getByRole("link", { name: "Back to learners" }).click();
    for (const term of ["%", "_"]) {
      await search.fill(term);
      await search.press("Enter");
      await expect(page.locator(".learner-list > li")).toHaveCount(1);
      await expect(page.locator(".learner-list")).toContainText(
        "Literal%_Name",
      );
    }
    await search.fill("other@example.test");
    await search.press("Enter");
    await page
      .getByRole("link", { name: "View records for Other Learner" })
      .click();
    await expect(page.getByText("No current enrolments.")).toBeVisible();
    await expect(page.getByText("No check-ins to show.")).toBeVisible();
    await goto("/admin/learners/999999");
    await expect(
      page.getByText("Learner not found.", { exact: true }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await goto(privatePath);
    await expect(
      page.getByRole("heading", { name: "Test Learner", exact: true }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Learner detail overflows mobile",
    );
    await page.screenshot({
      path: `${screenshots}/learner-record-mobile.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "Back to learners" }).click();
    await expect(page.locator(".learner-list > li")).toHaveCount(25);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Learner list overflows mobile",
    );
    await page.screenshot({
      path: `${screenshots}/learners-mobile.png`,
      fullPage: true,
    });
  } finally {
    for (const id of attendanceIds)
      await pool.query("DELETE FROM attendance WHERE id = $1", [id]);
    for (const id of insertedIds)
      await pool.query("DELETE FROM users WHERE id = $1", [id]);
    await page.setViewportSize({ width: 1366, height: 900 });
  }
  await goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Manage courses", exact: true }),
  ).toBeVisible();
  console.log(
    "PASS learner search, pagination, safe detail, empty records, retries and mobile layouts",
  );
}
