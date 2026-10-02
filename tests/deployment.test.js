import test from "node:test";
import assert from "node:assert/strict";
import viteConfig from "../vite.config.js";

test("Pages builds retain the repository path and require an HTTPS API", () => {
  const names = ["GITHUB_ACTIONS", "VITE_BASE_PATH", "VITE_API_URL"];
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    process.env.GITHUB_ACTIONS = "true";
    process.env.VITE_BASE_PATH = "/education-training-platform/";
    for (const url of [
      "",
      "/api",
      "http://localhost:3000/api",
      "https://",
      "https://api.example.test",
      "https://user:password@api.example.test/api",
    ]) {
      process.env.VITE_API_URL = url;
      assert.throws(
        () => viteConfig({ mode: "production" }),
        /public HTTPS backend URL/,
      );
    }
    process.env.VITE_API_URL = "https://api.example.test/api";
    assert.equal(
      viteConfig({ mode: "production" }).base,
      "/education-training-platform/",
    );
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
