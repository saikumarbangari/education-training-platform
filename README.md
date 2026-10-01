# Education / Training Platform

Waypoint Learning is a full-stack community training and attendance platform for discovering short courses, enrolling, tracking module progress, and checking in to an in-person session.

## Main features

- Multi-view navigation with React Router.
- Ten programming courses loaded asynchronously through a REST API.
- Search plus category and level filters.
- Course detail pages and a validated enrolment form.
- PostgreSQL-backed course, enrolment, progress, and attendance records.
- Learner registration/login with expiring token sessions.
- Administrator course CRUD with role checks.
- Permission-based geolocation attendance with no raw learner coordinates stored.
- Loading, error, retry, empty, success, validation, and not-found feedback.
- Responsive layouts and keyboard-accessible controls.

## Technology stack

- React with functional components and hooks.
- Vite.
- React Router.
- Plain CSS.
- Express 5.
- PostgreSQL through `pg`.
- Node's built-in test runner.

## Run the project

Use Node.js 24 and pnpm. The simplest local setup starts a portable PostgreSQL database,
the API and the frontend in one foreground terminal:

```powershell
pnpm install
pnpm dev:local
```

Open `http://127.0.0.1:5173`. Press Ctrl+C to stop the servers. Your local records remain
in the ignored `.local-db` folder. This is a development database, not a production host.
Register your own learner account in the app. The original device-only enrolments are
not automatically copied to an account because they have no verified owner.

For course management, copy `.env.example` to `.env`, set a valid `ADMIN_EMAIL` and a
unique 10–128 character `ADMIN_PASSWORD`, then run `pnpm dev:local`. Remove `ADMIN_PASSWORD`
from `.env` after the account is created; leaving it set resets that account's password on startup.
Never put `.env` or `.local-db` in a source ZIP or commit.

Alternatively, use an existing PostgreSQL database. Set `DATABASE_URL` in `.env` first:

```bash
pnpm install
Copy-Item .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

In a second terminal, start the frontend with `pnpm dev`. See `server/README.md` for the
environment settings and API routes.

To run the checks:

```bash
pnpm test
pnpm build
```

To preview the production build:

```bash
pnpm preview
```

## How the code works

1. React pages call the Express API and display loading, success, validation, and error states.
2. Express routes validate input and apply authentication or administrator role checks.
3. Parameterised SQL reads and writes PostgreSQL records.
4. The browser geolocation sensor supplies temporary coordinates for attendance distance checks.
5. PostgreSQL stores only the calculated distance and check-in time, not raw learner coordinates.
6. Node tests cover logic and API behaviour. A separate browser test uses real PostgreSQL and a production frontend build.

## Folder guide

```text
public/data/       Seed course data
server/db/         PostgreSQL schema
server/routes/     REST API endpoints
server/lib/        Password, token, and geolocation helpers
src/components/    Reused layout and interface pieces
src/context/       Shared enrolment and progress state
src/pages/         One component for each main view
src/utils/         Small testable logic functions
tests/             Frontend logic and backend API checks
```

## Design decisions

The interface uses the visual language of a student project folder: worksheet panels, course tabs, ruled lines, clear module markers, and a highlighter accent. The learning trail is the main visual feature because it also communicates real progress.

Native HTML elements were preferred where possible. The app uses `<progress>`, labelled form controls, checkboxes, semantic landmarks, and ordinary links rather than recreating those behaviours in JavaScript.

Hash-based routing keeps every view usable on simple static hosting without server rewrite rules.

## Deployment

Existing frontend URL: [https://saikumarbangari.github.io/education-training-platform/](https://saikumarbangari.github.io/education-training-platform/)

The full-stack frontend stays on this GitHub Pages site. Pages serves static files; the
Express API and PostgreSQL database must be hosted separately. These local changes do
not update the live site until they are pushed and deployed.

### Free hosting setup: Neon and Render

1. Create a Free account at [Neon](https://console.neon.tech) and a Free workspace at
   [Render](https://dashboard.render.com). Do not choose a paid upgrade or add payment
   details for this assessment deployment.
2. Create a Neon project named `education-training-platform`, preferably in the Singapore
   region if available. Keep PostgreSQL authentication; the app manages its own learner
   accounts and does not need Neon Auth. Use the project's Connect dialog to obtain the
   PostgreSQL connection string. It contains a password: keep it out of Git, screenshots,
   the report and chat. Enter it only in the backend host's `DATABASE_URL` setting.
3. After the integration branch is pushed to the existing repository, create a Render
   Blueprint from it. The checked-in `render.yaml` selects a Free Node web service in
   Singapore, uses the `codex/assessment-3-full-stack` branch and disables automatic
   deployments. This lets the backend be tested before merging the frontend to `main`.
4. Enter the Neon connection string when Render requests `DATABASE_URL`. No database,
   persistent disk, cron job or paid service is defined in the Blueprint. Confirm the
   service plan is Free before creating it. If either provider requires payment, stop.
5. To create a course administrator, add your chosen `ADMIN_EMAIL` and a unique
   `ADMIN_PASSWORD` (10–128 characters) in Render's private environment settings and
   deploy. Use a separate email that has not registered as a learner. The hosted startup
   creates an administrator only if that email does not already exist. It never promotes
   an existing learner or resets a password. Remove `ADMIN_PASSWORD` afterwards.
6. Copy the service's actual HTTPS URL from Render; do not guess the hostname. Run
   `pnpm check:hosted https://YOUR-SERVICE.onrender.com/api` to verify health, catalogue,
   protected routes and CORS without writing test records.
7. Set the GitHub repository Actions variable `VITE_API_URL` to that HTTPS URL ending in
   `/api`. Review and merge the integration branch only after the backend check passes.
   The existing Pages workflow then publishes the frontend at the unchanged website URL.

The hosted entry point runs the schema and initial seed in a transaction. A database
marker prevents later restarts from restoring deliberately deleted courses. A failed
setup rolls back and stops startup instead of serving a half-initialised application.
The explicit `pnpm db:seed` maintenance command is different: it restores missing demo
courses and can reset the administrator configured in the environment.

Render Free services sleep after 15 minutes without traffic and can take about a minute
to wake. Read requests allow for this delay; writes are not automatically retried. Neon
Free also has usage and storage limits. Neither tier promises uninterrupted availability.
Check the current [Render limits](https://render.com/docs/free) and
[Neon limits](https://neon.com/docs/introduction/plans) before the demonstration. A real
phone location test and live sign-in/progress test remain necessary after deployment.

### Other API/database hosts

1. Provision a PostgreSQL database and an HTTPS Node.js API host. No paid service is required
   by the code, but free-tier availability, expiry and sleeping limits depend on the provider.
2. Configure the API host with `DATABASE_URL`, `NODE_ENV=production`, `SESSION_DAYS=7` and
   `CLIENT_ORIGIN=https://saikumarbangari.github.io` (origin only, no repository path).
   Use verified database TLS as described in `server/README.md`.
3. Install production dependencies with `pnpm install --prod --frozen-lockfile`; run
   `pnpm db:migrate` and `pnpm db:seed`, then start with `pnpm start:api`. Set the administrator
   credentials only for the seed operation. Check `/api/health` over HTTPS.
4. In the existing GitHub repository, open Settings → Secrets and variables → Actions →
   Variables. Add `VITE_API_URL` with the public API URL ending in `/api`, for example
   `https://your-api-host.example/api`. This is a public URL, not a secret. Never add a database
   URL or password to a `VITE_` variable: these values are included in the browser bundle.
5. Keep Pages configured to use GitHub Actions. Once the integration is reviewed and merged
   to `main`, the existing workflow tests, builds and publishes `dist`. A missing HTTPS API
   URL stops the build before deployment, preserving the last published site.
6. Verify sign-in, admin access, saving progress and phone check-in on the live URL. The
  hash router and `/education-training-platform/` asset path are retained.

For a local Pages-shaped build, set `VITE_BASE_PATH=/education-training-platform/` and
`VITE_API_URL` to the deployed HTTPS API before running `pnpm build`. A normal local build
uses `/api`; `pnpm dev:local` supplies the development proxy.

## Browser verification

```powershell
pnpm test:e2e
```

This sequential check uses installed Chrome, a temporary real PostgreSQL database and
the production build at the same repository subpath as Pages. It tests registration,
guarded routes, enrolment, saved progress, network failure/retry, location outcomes,
administrator CRUD, account isolation, logout, session expiry and mobile overflow.
It also restarts PostgreSQL and checks that progress and attendance persist. All test
servers stop at the end. Screenshots are saved under ignored `output/e2e`.
If Chrome is unavailable, use installed Edge with `$env:BROWSER_CHANNEL = 'msedge'`.

Location inputs are simulated in browser tests. Real GPS accuracy, mobile permissions,
hosted HTTPS/CORS and deployment availability still require a real-device/live check.
No payment, email verification, password reset, timetable management or trainer approval
workflow is included. Check-ins record visits; location can be spoofed and is not proof of identity.
