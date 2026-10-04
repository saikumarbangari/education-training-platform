# Education / Training Platform

Waypoint Learning lets users find programming courses, enrol, track their progress and check in to in-person sessions.

[Open the website](https://saikumarbangari.github.io/education-training-platform/)

## Features

- Ten programming courses with search and filters.
- Learner accounts, course enrolment and module progress.
- A progress summary showing not-started, ongoing and completed courses.
- Location-based attendance with the learner's permission.
- Administrator tools to add, edit and delete courses.
- A read-only Learners dashboard for administrators to search accounts and view enrolments, progress and attendance.
- Responsive layouts for desktop and mobile.

Built with React, Vite, React Router, Express and PostgreSQL.

## Run locally

Use Node.js 24 and pnpm.

```powershell
pnpm install --frozen-lockfile
pnpm dev:local
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). This starts the frontend, API and a local PostgreSQL database. Press Ctrl+C to stop them; local records stay in `.local-db`.

Register a learner account in the app. For administrator setup or an existing PostgreSQL database, see the [backend guide](server/README.md).

Keep `.env` and `.local-db` out of Git and shared ZIP files. Remove `ADMIN_PASSWORD` after local administrator setup: leaving it set lets the local seed reset that password on startup.

## Checks

```powershell
pnpm check
pnpm test:e2e
```

`pnpm check` runs the tests and production build. The browser checks use installed Chrome and a temporary PostgreSQL database, which stops when the run finishes. Location is simulated in these checks; real-device GPS still needs to be tested separately.

## Hosting

The frontend runs on GitHub Pages, the API on Render, and the database on Neon PostgreSQL.

Updates to `main` run the checks and publish the frontend. Backend updates are deployed manually from `main`. The free backend may take a short time to wake after inactivity.

Keep database credentials on the backend only. Never put secrets in `VITE_` variables because they are included in the public frontend.
