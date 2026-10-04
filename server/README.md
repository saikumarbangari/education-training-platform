# Waypoint API

The backend is an Express REST API backed by PostgreSQL. It provides authentication,
course management, enrolments, module progress, and location-based attendance.

## Local setup

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` only when creating or resetting the demo administrator.
4. Run `pnpm db:migrate`.
5. Run `pnpm db:seed`.
6. Start the API with `pnpm dev:api`.

The API listens on `http://localhost:3000` by default. Run the Vite frontend separately
with `pnpm dev`.

If PostgreSQL is not installed, `pnpm dev:local` runs a portable development database,
the API and Vite together. It binds locally, keeps data in ignored `.local-db`, and stops
when the terminal receives Ctrl+C. `pnpm dev:local --check` performs a startup check and exits.
The seed command inserts missing courses without overwriting administrator edits.
The seeded Sydney venue is demonstration data; set the real venue in Manage courses before
using attendance with a class.

## GitHub Pages connection

The frontend stays at the existing GitHub Pages URL. Deploy only the API on a Node host
with a separate PostgreSQL database. Set `CLIENT_ORIGIN=https://saikumarbangari.github.io`.
Set the repository Actions variable `VITE_API_URL` to the API's HTTPS URL plus `/api`.
Never put server secrets in the frontend build. Changing that variable requires a new
Pages build; changing API-side settings requires restarting the API.

The root `render.yaml` is configured for a Free Render API with Neon PostgreSQL and
manual deploys from the integration branch. Run `pnpm start:hosted` on this host: it
prepares the schema and initial catalogue before listening. The `application_setup`
marker makes this different from running the demo seed on every restart. Administrator
creation is insert-only during hosted startup; existing learner accounts are never promoted.
The Free Render tier does not provide a separate pre-deploy job, so setup happens in the
start command. `pnpm check:hosted <HTTPS-API-URL>` performs read-only deployment checks.
After merging, the service can be switched to `main` deliberately in the Blueprint;
automatic deploys remain off until enabled by the project owner.

For a remote PostgreSQL provider, use `DATABASE_SSL=true` with a trusted certificate;
`DATABASE_CA` can contain a provider CA in PEM format if needed. Do not add `sslmode=no-verify`
or disable certificate verification. Follow the provider's verified-TLS connection settings.
For a trusted reverse proxy, set `TRUST_PROXY_HOPS` to that deployment's exact proxy count,
not a blanket `true`. This makes the sign-in rate limit use the correct client address.
The in-process rate limiter is for a single API instance; scaling to multiple instances
requires a shared limiter store. Database backups and credential rotation are host responsibilities.

## Main routes

| Method | Route                                | Access    | Purpose                                  |
| ------ | ------------------------------------ | --------- | ---------------------------------------- |
| GET    | `/api/health`                        | Public    | Check API and database availability      |
| POST   | `/api/auth/register`                 | Public    | Create a learner account and session     |
| POST   | `/api/auth/login`                    | Public    | Sign in and create a session             |
| GET    | `/api/auth/me`                       | Signed in | Read the current user                    |
| POST   | `/api/auth/logout`                   | Signed in | End the current session                  |
| GET    | `/api/courses`                       | Public    | List courses                             |
| GET    | `/api/courses/:courseId`             | Public    | Read one course                          |
| GET    | `/api/courses/admin`                 | Admin     | List courses with venue coordinates      |
| POST   | `/api/courses`                       | Admin     | Create a course                          |
| PUT    | `/api/courses/:courseId`             | Admin     | Update a course                          |
| DELETE | `/api/courses/:courseId`             | Admin     | Delete a course                          |
| GET    | `/api/enrolments/me`                 | Signed in | List the learner's enrolments            |
| POST   | `/api/enrolments`                    | Signed in | Enrol in a course                        |
| PATCH  | `/api/enrolments/:courseId/progress` | Signed in | Replace completed module IDs             |
| DELETE | `/api/enrolments/:courseId`          | Signed in | Leave a course                           |
| GET    | `/api/attendance/me`                 | Signed in | List attendance records                  |
| POST   | `/api/attendance/check-in`           | Signed in | Validate device coordinates and check in |
| GET    | `/api/admin/learners`                | Admin     | Search learner names and emails          |
| GET    | `/api/admin/learners/:learnerId`     | Admin     | View enrolments, progress and attendance |

The Learners dashboard is read-only. The list accepts `q` (up to 100 characters)
and `page`; learner details accept `page` for attendance history. Lists contain
25 records per page. Administrator accounts are not included. These responses
never include password hashes, session tokens or venue coordinates. Attendance
history may include courses a learner has left; deleting a course removes its
enrolments and attendance through the existing database rules.

Attendance requests first try a precise location, then retry once with normal
accuracy after a timeout or unavailable position. Each attempt waits up to 20 seconds
and requires a fresh position so a previous location is not reused. Denied permission is not
retried. Cancelling or leaving the page during location lookup prevents a check-in
request. The server still checks enrolment and distance from the configured venue.

Protected routes use `Authorization: Bearer <token>`. The database stores only a SHA-256
hash of each random token. Passwords use a unique salt and Node's `scrypt` function. Device
coordinates are used transiently to calculate venue distance; raw learner coordinates are
not saved in PostgreSQL.

The browser keeps its session token in session storage, not persistent local storage.
Sign out on shared laptops. Tokens are accessible to same-origin scripts, so avoid third-party
scripts and untrusted HTML. No HTML from users is injected into the page. Authentication
attempts are limited to 30 per 15 minutes per client IP. Expiry is checked on every protected
request. A failed network save does not update the displayed module state.

## Checks

Run `pnpm test:server` for backend logic and API integration tests. The integration test
uses an in-memory PostgreSQL-compatible database and does not need a local database.
Run `pnpm test:e2e` for sequential Chrome checks against real PostgreSQL, including restart
persistence, cross-account isolation and a build under `/education-training-platform/`.
