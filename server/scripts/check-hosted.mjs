// Read-only checks of a deployed API. Does not create accounts or enrolments.
const [url] = process.argv.slice(2);
let base;
try {
  base = new URL(url);
} catch {
  throw new Error("Provide the public HTTPS API URL ending in /api.");
}
if (
  base.protocol !== "https:" ||
  base.username ||
  base.password ||
  base.search ||
  base.hash ||
  !base.pathname.replace(/\/$/, "").endsWith("/api")
) {
  throw new Error(
    "Provide the public HTTPS API URL ending in /api, without credentials or query parameters.",
  );
}
const origin = "https://saikumarbangari.github.io";
const root = base.href.replace(/\/$/, "");
async function check(path, { method = "GET", headers = {} } = {}) {
  return fetch(`${root}${path}`, {
    method,
    headers: { Origin: origin, ...headers },
    signal: AbortSignal.timeout(90000),
  });
}
const health = await check("/health");
if (!health.ok || (await health.json()).status !== "ok")
  throw new Error("API/database health check failed.");
if (health.headers.get("access-control-allow-origin") !== origin)
  throw new Error("CORS does not allow the existing GitHub Pages origin.");
const courses = await check("/courses");
if (!courses.ok || !Array.isArray((await courses.json()).courses))
  throw new Error("The course catalogue is not available.");
const protectedRoute = await check("/enrolments/me");
if (protectedRoute.status !== 401)
  throw new Error("The enrolment route must require sign-in.");
const preflight = await check("/auth/login", {
  method: "OPTIONS",
  headers: {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type,authorization",
  },
});
if (
  !preflight.ok ||
  preflight.headers.get("access-control-allow-origin") !== origin
)
  throw new Error("The login preflight is not allowed for GitHub Pages.");
console.log(
  "PASS: HTTPS API health, catalogue, Pages CORS, protected route and login preflight.",
);
