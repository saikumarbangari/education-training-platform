# ICT930 Assessment 2 Website Plan

## 1. Assessment interpretation

Build and deploy a production-quality frontend application in a team of three using React or Vue. The website is only one part of the submission: the team must also provide the repository, ZIP, README, screenshots, reflection, contribution statement, meaningful Git history, public deployment, APA references, and an AI-use declaration where applicable.

Target: satisfy every mandatory requirement and make the High Distinction rubric behaviours directly demonstrable without adding speculative features.

Due: Sunday, 6 September 2026, 11:59 pm.

## 2. Topic choice

### Options compared

| Topic | Effort | Risk | Fit to mandatory features | Decision |
| --- | --- | --- | --- | --- |
| Smart Services Dashboard | Low-medium | Requires inventing a service model and useful management workflow | Good for dashboards, forms, filters, and shared state | Viable, but more product decisions are needed |
| Health & Wellbeing Web App | Medium | Health/privacy expectations and sensitive copy increase design risk | Good for tracking and appointments | Avoid unnecessary domain risk |
| Education / Training Platform | **Low** | Familiar, non-sensitive data; brief already names the main tasks | **Direct fit: discovery, enrolment, progress, routing, async data, forms, filters** | **Selected** |
| Custom Proposal | High | Requires lecturer approval and more justification | Unknown until approved | Not the easiest path |

### Selected product

**Waypoint Learning** - a small course-discovery and progress-tracking app for adults building practical digital skills.

Audience: busy adult learners who want to find a short course, enrol, and see what to study next.

Single product job: help a learner move from discovering a suitable course to tracking its completion.

Why this is the easiest compliant topic:

- The scenario itself supplies the content model: courses, enrolments, and progress.
- Three natural views satisfy multi-view navigation without filler pages.
- Course search/filter provides meaningful local state and dynamic updates.
- Enrolments and progress provide shared state and clear user feedback.
- A validated enrolment form fits the domain without authentication or a backend.
- Local JSON provides deterministic asynchronous data with loading, error, and retry states.

## 3. Scope

### Build

1. **Discover** (`/`)
   - Asynchronously load courses from local JSON.
   - Display skeleton/loading status, error message, and retry action.
   - Search by title or skill.
   - Filter by category and level.
   - Show an accessible empty-results state.
   - Link each course to its details.

2. **Course details** (`/courses/:courseId`)
   - Show course summary, level, duration, skills, modules, and expected outcome.
   - Provide a clear enrol action or an already-enrolled status.
   - Handle an unknown course ID with a useful not-found state.

3. **Enrol** (`/courses/:courseId/enrol`)
   - Form fields: full name, email, study goal, and agreement checkbox.
   - Use semantic labels, instructions, required indicators, and inline errors.
   - Validate required values and email format.
   - On success, add the enrolment to shared state and show a clear confirmation.

4. **My learning** (`/learning`)
   - List enrolled courses.
   - Show current module and completion percentage.
   - Let the learner mark modules complete with accessible checkboxes.
   - Update progress immediately and persist it with `localStorage`.
   - Show a directed empty state when there are no enrolments.

5. **Progress overview** (`/progress`)
   - Summarise enrolled, in-progress, and completed courses.
   - Use semantic text and CSS progress bars rather than a chart library.
   - Show the next recommended module based on the learner's existing enrolments.

6. **Fallback route** (`*`)
   - Friendly 404 message and link back to Discover.

### Explicitly skip

- Login, accounts, payments, backend/database, admin tools, certificates, chat, recommendations powered by AI, and a third-party API.
- A global state library; React Context and hooks are enough for this app.
- A charting library; native HTML and CSS cover the required progress visualisation.
- A modal; routing, filters, checkboxes, form feedback, and progress updates already satisfy meaningful interactions.

Add any skipped feature only if the lecturer explicitly requires it.

## 4. Technical plan

### Stack

- React with functional components and hooks.
- Vite for development and production builds.
- React Router for client-side routing.
- Plain CSS with custom properties and responsive media queries.
- Local JSON plus `fetch()` for asynchronous course data.
- React Context for shared enrolment/progress state.
- `useState` for local search, filter, and form state.
- Browser `localStorage` for lightweight persistence.
- ESLint and Prettier only if already included by the chosen Vite setup; avoid extra tooling that does not improve the assessed result.
- Node's built-in test runner for one focused check of filtering/validation logic; no test framework dependency.

### Small, assessable folder structure

```text
src/
  components/
    AppLayout.jsx
    CourseCard.jsx
    Feedback.jsx
    ProgressBar.jsx
  context/
    LearningContext.jsx
  data/
    courses.json
  pages/
    DiscoverPage.jsx
    CoursePage.jsx
    EnrolPage.jsx
    LearningPage.jsx
    ProgressPage.jsx
    NotFoundPage.jsx
  utils/
    courses.js
    validation.js
  App.jsx
  main.jsx
  styles.css
tests/
  app-logic.test.js
```

Create only components that are reused or meaningfully separate layout, interface, and feature concerns. Keep page-specific markup in its page.

### State and data flow

- `DiscoverPage` owns search and filter state locally.
- A data-loading hook in `App` or a single shared provider fetches `courses.json` once and exposes `courses`, `loading`, `error`, and `retry`.
- `LearningContext` owns enrolments and module completion, initialises from `localStorage`, and persists changes.
- Route pages consume the smallest state they need through props/context.
- Derived values such as percentages and counts are calculated from existing state rather than stored twice.
- Stable IDs in JSON connect courses, modules, enrolments, and progress.

## 5. Content model

Use 6 realistic short courses across three categories, enough to make search/filter useful without producing unnecessary content.

Each course contains:

- `id`, `title`, `category`, `level`, `duration`, `summary`, and `outcome`.
- A short `skills` array.
- Three modules with stable IDs and titles.

Use original concise copy. Any external factual claims or sourced content must be recorded for APA referencing.

## 6. Visual and interaction direction

### Concept

A practical student project folder for adult learners: organised, direct, and progress-oriented rather than a generic corporate dashboard.

### Design tokens

- **Ink** `#172132` - main text and navigation.
- **Worksheet** `#FBFCFE` - main reading surface.
- **Desk** `#E7EDF3` - cool page background.
- **Binder blue** `#264E86` - navigation, links, focus, and primary actions.
- **Highlighter** `#F2B84B` - selected filters and active progress moments.
- **Complete green** `#2F7456` - success and completed modules.

Typography:

- Display: `Trebuchet MS`, used for page titles and course names.
- Body: system UI stack for readable controls and paragraphs.
- Utility/data: `Consolas`, with monospace fallbacks, for duration, level, and progress labels.

Layout:

```text
Desktop
+----------------------------------------------------------------+
| WAYPOINT       Discover   My learning   Progress                |
+----------------------------------------------------------------+
| Page thesis / short guidance             Learning trail marker  |
+----------------------------------------------------------------+
| Search                   | Category | Level                     |
+----------------------------------------------------------------+
| Course card              | Course card                         |
| Course card              | Course card                         |
+----------------------------------------------------------------+

Mobile
+---------------------------+
| WAYPOINT       Menu       |
+---------------------------+
| Page title                |
| Guidance                  |
| Trail marker              |
+---------------------------+
| Search                    |
| Category        Level     |
+---------------------------+
| Course card               |
| Course card               |
+---------------------------+
```

Signature element: a responsive **learning trail** - a ruled course-planning line with module markers that shows where the learner is now and what comes next. It becomes a vertical trail on narrow screens. Course cards use small subject-folder tabs so their category is recognisable before reading the details.

Uniqueness review: the visual language comes from project folders, worksheet margins, course tabs, ruled learning paths, and completion marks. The earlier warm paper and serif combination was removed because it resembled a common website template. Avoid gradient stat cards, floating glass panels, and decorative charts.

Motion:

- One short progress-fill transition after a module is completed.
- No scattered entrance animations.
- Respect `prefers-reduced-motion`.

## 7. Complete requirement traceability

| Brief requirement | Planned evidence |
| --- | --- |
| Team of 3 | Contribution statement names all three people and their responsibilities |
| Collaborative planning/design/implementation/testing/documentation | GitHub issues/board or agreed task list, shared reviews, test checklist, and contribution statement |
| Meaningful contribution from each member | Each member owns features and makes regular attributable commits |
| GitHub with regular commits from all members | Repository history checked before submission |
| React functional components and hooks or Vue 3 | React functional components and hooks |
| Multi-page/multi-view navigation | React Router with Discover, Course, Enrol, My learning, Progress, and 404 routes |
| Reusable component architecture | Layout, UI, and feature components separated only where useful |
| Local state | Search, filters, and form fields |
| Shared state | Learning Context for enrolments and completion |
| Mock data or public API | Local `courses.json` |
| Asynchronous data loading | `fetch()` of course JSON |
| Loading state | Visible loading/skeleton feedback |
| Error state | Error explanation and Retry button |
| Forms with validation | Enrolment form with required, email, goal, and consent validation |
| Dynamic UI updates | Search, category/level filters, enrolment status, module checkboxes, progress updates |
| Desktop and mobile layouts | Responsive navigation, grids, forms, and learning trail |
| Clear hierarchy | Consistent page headings, landmarks, card titles, metadata, and action priority |
| Consistent visual language | Shared tokens, type roles, spacing, controls, feedback patterns |
| Semantic HTML | Header, nav, main, sections, headings, lists, form controls, buttons |
| Contrast | Verify text, controls, focus, success, and error colours against WCAG AA |
| Labels | Visible labels and accessible names for every form/control |
| Keyboard access | Logical focus order, no keyboard traps, visible `:focus-visible` styles |
| Inclusive design | Plain language, non-colour status cues, reduced motion, large touch targets |
| Meaningful feedback | Loading, errors, empty states, validation messages, enrolment confirmation, progress status |
| Clean layout and spacing | Tokenised spacing and visual screenshot review |
| Public deployment | Deploy final build and verify its working URL |
| Deployed version matches source | Build from submitted commit and compare key flows |
| Test deployed routing/data/forms | Production smoke-test checklist on the public URL |
| Modular/readable/well-named code | Small focused files, direct names, no speculative abstractions |
| Logical folder structure/separation of concerns | Pages, components, context, data, and utilities as shown above |
| Avoid unnecessary re-renders | Keep state near consumers, derive values, verify with React behaviour; do not add memoisation without evidence |
| Clear README | Overview, stack, install, features, decisions, and deployed URL |
| Meaningful commits | Small commits named for working increments, from all members |
| ZIP file | Final clean project ZIP excluding `node_modules` and temporary files |
| GitHub repository link | Included in submission and README |
| Working public URL | Included in submission and README |
| At least 6 key screens, desktop + mobile | Capture Discover, Course, and My learning at desktop and mobile widths (6 total); add Enrol and Progress if useful |
| Reflection, 1500-2000 words | Team-authored architectural choices, challenges/solutions, industry relevance, and individual reflection |
| Contribution statement, 1-2 pages | Roles/responsibilities and a factual summary of each member's work |
| APA referencing | Cite any external research, content, assets, or claims consistently |
| AI use declaration | Accurately declare the AI assistance used in the Research Log/Reflection |
| All team members listed; one submits | Final handoff checklist records submitter and all three names |

## 8. High Distinction rubric strategy

### Architecture and component design - 20%

- Show clear layout/UI/feature separation with genuinely reusable components.
- Keep state ownership and data flow easy to explain.
- Avoid both duplicated UI and premature abstractions.

### Functionality, routing, state, and data - 25%

- Make every route and mandatory interaction reliable.
- Demonstrate local and shared state clearly.
- Include real asynchronous loading, failure recovery, validation, and empty states.
- Test direct navigation and browser refresh for every deployed route.

### UI, UX, and accessibility - 20%

- Use complete keyboard navigation, semantic landmarks, visible labels, focus styles, AA contrast, and non-colour status cues.
- Keep copy task-focused and feedback immediate.
- Run a final accessibility and UX audit after implementation.

### Responsive design, performance, and technical quality - 15%

- Verify desktop, tablet, and mobile widths; test overflow and touch targets.
- Keep the bundle small and avoid unnecessary state propagation/re-renders.
- Require a clean production build and no console errors.

### Code quality, maintainability, version control, documentation - 10%

- Use direct naming, consistent formatting, a compact folder structure, and a complete README.
- Maintain frequent, meaningful commits by every team member.

### Reflection, collaboration, writing, and referencing - 10%

- The team must write its own evidence-based reflection and individual sections.
- Record decisions and challenges during development so the final reflection is truthful rather than reconstructed.
- Apply APA referencing and declare AI assistance accurately.

## 9. Implementation phases and gates

### Phase 0 - Team setup

- Confirm three members, roles, repository access, communication channel, and task allocation.
- Create the repository and protect the agreed main-branch workflow.
- Record the site's agreed scope and start the AI-use log.

Gate: all members can clone, run, branch, commit, and open/review work.

### Phase 1 - Foundation

- Create the minimal Vite React app.
- Add React Router, global tokens, layout, navigation, routes, and 404.
- Add the course JSON and asynchronous loader.

Gate: every route opens directly; loading, success, error, and 404 states are demonstrable.

### Phase 2 - Core learning flows

- Build Discover search/filter, Course details, and the validated Enrol flow.
- Add Learning Context and persistence.
- Build My learning module completion and Progress overview.

Gate: a learner can discover, inspect, enrol, complete a module, refresh, and retain progress.

### Phase 3 - Design and accessibility

- Apply the notebook/trail visual system and responsive layouts.
- Add focus, reduced-motion, feedback, empty, and validation states.
- Audit semantics, names, contrast, keyboard use, overflow, and touch targets.

Gate: all functionality works at desktop, tablet, and mobile widths with keyboard-only use.

### Phase 4 - Verification and documentation

- Run the focused logic test, lint if configured, and production build.
- Test navigation, direct URLs, async data, form validation, persistence, and error handling.
- Write the README and deploy from the exact submitted commit.
- Smoke-test the public deployment and capture at least six required screenshots.

Gate: no console errors, broken routes, missing states, visual defects, or README omissions.

### Phase 5 - Submission package

- Team members write and verify the 1500-2000 word reflection and 1-2 page contribution statement.
- Add APA references and accurate AI-use acknowledgement.
- Verify all three names and contributions against GitHub history.
- Prepare a clean ZIP and submit it with the GitHub link and deployed URL.

Gate: one final checklist confirms every item in Section 7 is present and opens correctly.

## 10. Team allocation template

Keep work equitable and overlapping enough for genuine collaboration:

- Member A: app foundation, routing, asynchronous data, deployment.
- Member B: Discover/course views, filtering, responsive course cards.
- Member C: enrolment form, shared learning state, progress views.
- Everyone: design review, accessibility testing, code reviews, documentation, screenshots, and reflection.

Each member should make multiple meaningful commits. Do not manufacture commit history after the work is complete.

## 11. Verification checklist

- Install from a clean checkout using README instructions.
- Run the production build successfully.
- Open every route through navigation and by direct URL.
- Confirm course loading, error, retry, and empty-results states.
- Confirm every form error and the valid submission path.
- Confirm enrolment and progress persist after refresh.
- Navigate the full app using only the keyboard.
- Check accessible names, heading order, landmarks, focus visibility, contrast, and reduced motion.
- Check desktop, tablet, and mobile layouts for clipping, overflow, readability, and touch targets.
- Confirm no browser console errors.
- Repeat the critical flow on the deployed public URL.
- Verify ZIP, repository, README, screenshots, reflection, contribution statement, APA references, team names, deployment URL, and AI declaration.

## 12. AI-use submission note

AI assistance will not block this project. Record the assistance used and include an accurate declaration in the Research Log/Reflection so the submission package still addresses the brief's disclosure requirement. The team should understand, test, and be able to explain the completed application.
