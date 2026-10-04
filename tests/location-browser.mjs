import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function forceLocationFallback(page) {
  await page.evaluate(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(
      navigator.geolocation,
    );
    window.locationAttempts = [];
    navigator.geolocation.getCurrentPosition = (success, failure, options) => {
      window.locationAttempts.push(options.enableHighAccuracy);
      if (options.enableHighAccuracy) failure({ code: 3 });
      else original(success, failure, options);
    };
  });
}

export async function checkLocationFailures({ page, goto, pool }) {
  let checkInRequests = 0;
  const countCheckIns = (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/attendance/check-in")
    )
      checkInRequests += 1;
  };
  page.on("request", countCheckIns);
  try {
    await page.evaluate(() => {
      window.locationAttempts = [];
      navigator.geolocation.getCurrentPosition = (
        success,
        failure,
        options,
      ) => {
        window.locationAttempts.push(options.enableHighAccuracy);
        failure({ code: 3 });
      };
    });
    await page
      .getByRole("button", { name: "Share location and check in" })
      .click();
    await expect(
      page.getByText(/did not provide a location after two attempts/),
    ).toBeVisible();
    assert.deepEqual(await page.evaluate(() => window.locationAttempts), [
      true,
      false,
    ]);
    await expect(page.locator(".attendance-history li")).toHaveCount(1);

    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        window.deliverLocation = success;
      };
    });
    await page
      .getByRole("button", { name: "Share location and check in" })
      .click();
    await page.getByRole("button", { name: "Cancel location check" }).click();
    await expect(
      page.getByText("Location check cancelled. No attendance was saved.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.evaluate(() =>
      window.deliverLocation({
        coords: { latitude: -33.8688, longitude: 151.2093 },
      }),
    );
    await expect(
      page.getByRole("button", { name: "Share location and check in" }),
    ).toBeEnabled();

    await page
      .getByRole("button", { name: "Share location and check in" })
      .click();
    await page.getByRole("link", { name: "Discover", exact: true }).click();
    await expect(page.locator(".course-card")).toHaveCount(10);
    await page.evaluate(() =>
      window.deliverLocation({
        coords: { latitude: -33.8688, longitude: 151.2093 },
      }),
    );
    assert.equal(
      checkInRequests,
      0,
      "Failed or cancelled location sent an attendance request",
    );
    assert.equal(
      (await pool.query("SELECT COUNT(*) FROM attendance")).rows[0].count,
      "1",
    );
    console.log(
      "PASS two location timeouts, cancellation and leaving the page without saving attendance",
    );
  } finally {
    page.off("request", countCheckIns);
    await page.evaluate(() => {
      delete navigator.geolocation.getCurrentPosition;
      delete window.deliverLocation;
      delete window.locationAttempts;
    });
  }
}
