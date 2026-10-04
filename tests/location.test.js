import test from "node:test";
import assert from "node:assert/strict";
import { locate } from "../src/utils/location.js";

const position = { coords: { latitude: -33.8688, longitude: 151.2093 } };

test("location uses a bounded precise request and requires a fresh position", async () => {
  const geolocation = {
    getCurrentPosition(success, failure, options) {
      assert.deepEqual(options, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
      success(position);
    },
  };
  assert.equal(await locate({ geolocation }), position);
});

test("timeout and unavailable position each retry once with normal accuracy", async () => {
  for (const code of [2, 3]) {
    const attempts = [];
    let retries = 0;
    const geolocation = {
      getCurrentPosition(success, failure, options) {
        attempts.push(options);
        if (options.enableHighAccuracy) failure({ code });
        else success(position);
      },
    };
    assert.equal(
      await locate({
        geolocation,
        onRetry: () => {
          retries += 1;
        },
      }),
      position,
    );
    assert.equal(attempts.length, 2);
    assert.equal(retries, 1);
    assert.equal(attempts[1].enableHighAccuracy, false);
    assert.equal(attempts[1].timeout, 20000);
  }
});

test("denied permission does not trigger another request", async () => {
  let attempts = 0;
  const geolocation = {
    getCurrentPosition(success, failure) {
      attempts += 1;
      failure({ code: 1 });
    },
  };
  await assert.rejects(
    locate({ geolocation }),
    /Location permission was denied/,
  );
  assert.equal(attempts, 1);
});

test("two failed attempts stop and explain that attendance was not saved", async () => {
  let attempts = 0;
  const geolocation = {
    getCurrentPosition(success, failure) {
      attempts += 1;
      failure({ code: 3 });
    },
  };
  await assert.rejects(
    locate({ geolocation }),
    /two attempts.*No attendance was saved/,
  );
  assert.equal(attempts, 2);
});

test("unsupported browsers receive a useful error", async () => {
  await assert.rejects(
    locate({ geolocation: null }),
    /browser cannot share location/,
  );
});

test("cancelling discards a late position and does not start a fallback", async () => {
  const controller = new AbortController();
  let succeed,
    attempts = 0;
  const geolocation = {
    getCurrentPosition(success) {
      attempts += 1;
      succeed = success;
    },
  };
  const pending = locate({ geolocation, signal: controller.signal });
  controller.abort();
  succeed(position);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(attempts, 1);
});

test("an already cancelled request never asks for location", async () => {
  const controller = new AbortController();
  controller.abort();
  const geolocation = {
    getCurrentPosition() {
      assert.fail("Unexpected location request");
    },
  };
  await assert.rejects(locate({ geolocation, signal: controller.signal }), {
    name: "AbortError",
  });
});
