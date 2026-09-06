# Education / Training Platform

Waypoint Learning is the product created for this Education / Training Platform project. It is a small React frontend for discovering short digital-skills courses, enrolling, and tracking module progress. It was designed for ICT930 Assessment 2.

## Main features

- Multi-view navigation with React Router.
- Ten programming courses loaded asynchronously from local JSON.
- Search plus category and level filters.
- Course detail pages and a validated enrolment form.
- Shared enrolment/progress state using React Context.
- Progress saved to the browser with `localStorage`.
- Loading, error, retry, empty, success, validation, and not-found feedback.
- Responsive layouts and keyboard-accessible controls.

## Technology stack

- React with functional components and hooks.
- Vite.
- React Router.
- Plain CSS.
- Node's built-in test runner.

There is no backend, UI framework, state library, chart library, or external image service.

## Run the project

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local address shown in the terminal.

To run the checks:

```bash
npm test
npm run build
```

To preview the production build:

```bash
npm run preview
```

## How the code works

1. `App.jsx` fetches `public/data/courses.json` and keeps the loading or error state.
2. React Router sends that course data to the current page.
3. `DiscoverPage` keeps search and filter values as local state.
4. `LearningContext` keeps enrolments and completed module IDs as shared state.
5. The Context saves each state change to `localStorage` so it survives a refresh.
6. Utility functions handle filtering, validation, and progress calculations. They are covered by the small test file.

## Folder guide

```text
public/data/       Course JSON fetched by the app
src/components/    Reused layout and interface pieces
src/context/       Shared enrolment and progress state
src/pages/         One component for each main view
src/utils/         Small testable logic functions
tests/             Node-based logic checks
```

## Design decisions

The interface uses the visual language of a student project folder: worksheet panels, course tabs, ruled lines, clear module markers, and a highlighter accent. The learning trail is the main visual feature because it also communicates real progress.

Native HTML elements were preferred where possible. The app uses `<progress>`, labelled form controls, checkboxes, semantic landmarks, and ordinary links rather than recreating those behaviours in JavaScript.

Hash-based routing keeps every view usable on simple static hosting without server rewrite rules.

## Deployment

Deployed application URL: [https://saikumarbangari.github.io/education-training-platform/](https://saikumarbangari.github.io/education-training-platform/)

Build the site with `npm run build`, deploy the `dist` folder, and then test every route, form, data state, and mobile layout on the public URL.
