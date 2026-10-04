import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import Feedback from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { validateCourse } from "../../server/validation.js";

const blank = {
  id: "",
  title: "",
  summary: "",
  category: "Programming",
  level: "Beginner",
  duration: "",
  outcome: "",
  skills: "",
  modules: "",
  venueName: "",
  venueLatitude: "",
  venueLongitude: "",
  checkInRadiusMetres: "250",
};
const fields = [
  [
    "id",
    "Course ID",
    "text",
    "Use lowercase letters, numbers and hyphens. The ID cannot be changed later.",
  ],
  ["title", "Course title"],
  ["summary", "Summary", "textarea"],
  ["category", "Category"],
  ["duration", "Duration"],
  ["outcome", "Learning outcome", "textarea"],
  ["skills", "Skills", "text", "Separate skills with commas."],
  [
    "modules",
    "Modules",
    "textarea",
    "One module per line: module-id | Module title. Keep existing IDs when renaming modules so learner progress is preserved.",
  ],
  [
    "venueName",
    "Venue name",
    "text",
    "Venue fields are optional for online-only courses.",
  ],
  ["venueLatitude", "Venue latitude", "number"],
  ["venueLongitude", "Venue longitude", "number"],
  [
    "checkInRadiusMetres",
    "Check-in radius (metres)",
    "number",
    "Between 25 and 5000 metres.",
  ],
];
const coordinateFields = ["venueLatitude", "venueLongitude"];

function toForm(course) {
  return {
    ...blank,
    ...course,
    skills: course.skills.join(", "),
    modules: course.modules
      .map((module) => `${module.id} | ${module.title}`)
      .join("\n"),
    venueName: course.venueName ?? "",
    venueLatitude: course.venueLatitude ?? "",
    venueLongitude: course.venueLongitude ?? "",
  };
}

export default function AdminPage({ onChange }) {
  const { token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [values, setValues] = useState(blank);
  const [editing, setEditing] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const heading = useRef(null);
  const summary = useRef(null);
  const deleteSummary = useRef(null);

  useEffect(() => {
    if (deleting) deleteSummary.current?.focus();
  }, [deleting]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    api("/courses/admin", { token, signal: controller.signal })
      .then(({ courses }) => {
        if (!controller.signal.aborted) setCourses(courses);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, revision]);

  function edit(course) {
    setValues(course ? toForm(course) : blank);
    setEditing(course?.id || "");
    setErrors({});
    setSaveError("");
    setMessage("");
    setDeleting(null);
    requestAnimationFrame(() => heading.current?.focus());
  }

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setSaveError("");
    setMessage("");
    setErrors((current) => {
      const remaining = { ...current };
      delete remaining[name];
      if (coordinateFields.includes(name)) delete remaining.venue;
      return remaining;
    });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setSaveError("");
    setMessage("");
    const body = {
      ...values,
      skills: values.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      modules: values.modules
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const separator = line.indexOf("|");
          return {
            id: separator < 0 ? "" : line.slice(0, separator).trim(),
            title: separator < 0 ? line : line.slice(separator + 1).trim(),
          };
        }),
      venueLatitude:
        values.venueLatitude === "" ? null : Number(values.venueLatitude),
      venueLongitude:
        values.venueLongitude === "" ? null : Number(values.venueLongitude),
      checkInRadiusMetres: Number(values.checkInRadiusMetres),
    };
    const nextErrors = validateCourse(body);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setBusy(true);
    try {
      const { course } = await api(
        editing ? `/courses/${editing}` : "/courses",
        { method: editing ? "PUT" : "POST", token, body },
      );
      setCourses((current) =>
        [...current.filter((item) => item.id !== course.id), course].sort(
          (a, b) => a.title.localeCompare(b.title),
        ),
      );
      setValues(toForm(course));
      setEditing(course.id);
      setMessage("Course saved.");
      onChange();
    } catch (error) {
      setSaveError(error.message);
      setErrors(error.errors || {});
      requestAnimationFrame(() => summary.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !deleting) return;
    setBusy(true);
    setSaveError("");
    setMessage("");
    try {
      await api(`/courses/${deleting.id}`, { method: "DELETE", token });
      setCourses((current) =>
        current.filter((course) => course.id !== deleting.id),
      );
      if (editing === deleting.id) {
        setValues(blank);
        setEditing("");
      }
      setDeleting(null);
      setMessage("Course deleted.");
      onChange();
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="page-heading">
        <p className="eyebrow">Administrator</p>
        <h1>Manage courses</h1>
        <p>
          Update course outlines and check-in venues. Changes apply to all
          learners.
        </p>
      </header>
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      <div className="admin-grid">
        <section aria-labelledby="course-list-heading">
          <div className="section-heading">
            <h2 id="course-list-heading">Course list</h2>
            <button
              className="button button--small"
              disabled={busy}
              onClick={() => edit(null)}
            >
              New course
            </button>
          </div>
          {loading ? (
            <p role="status">Loading courses…</p>
          ) : loadError ? (
            <Feedback
              title="Course list unavailable"
              tone="error"
              action={
                <button
                  className="button"
                  onClick={() => setRevision((n) => n + 1)}
                >
                  Try again
                </button>
              }
            >
              <p>{loadError}</p>
            </Feedback>
          ) : !courses.length ? (
            <p>No courses yet. Add the first course using the form.</p>
          ) : (
            <ul className="admin-course-list">
              {courses.map((course) => (
                <li key={course.id}>
                  <h3>{course.title}</h3>
                  <p>
                    {course.modules.length} modules · {course.level}
                  </p>
                  <div className="button-row">
                    <button
                      className="text-link"
                      disabled={busy}
                      aria-label={`Edit ${course.title}`}
                      onClick={() => edit(course)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-link danger-link"
                      disabled={busy}
                      aria-label={`Delete ${course.title}`}
                      onClick={() => {
                        setDeleting(course);
                        setSaveError("");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {deleting && (
            <div
              className="confirm-panel"
              role="alert"
              tabIndex="-1"
              ref={deleteSummary}
            >
              <h3>Delete {deleting.title}?</h3>
              <p>
                This also removes every enrolment and attendance record for this
                course. This cannot be undone from the app.
              </p>
              {saveError && <p className="field-error">{saveError}</p>}
              <div className="button-row">
                <button
                  className="button button--small"
                  disabled={busy}
                  onClick={remove}
                >
                  Confirm delete
                </button>
                <button
                  className="button button--secondary button--small"
                  disabled={busy}
                  onClick={() => setDeleting(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
        <form className="enrol-form admin-form" onSubmit={save} noValidate>
          <h2 tabIndex="-1" ref={heading}>
            {editing ? "Edit course" : "Add a course"}
          </h2>
          {(saveError || Object.keys(errors).length > 0) && (
            <div
              className="error-summary"
              role="alert"
              tabIndex="-1"
              ref={summary}
            >
              <strong>{saveError || "Check the highlighted fields."}</strong>
              {Object.keys(errors).length > 0 && (
                <ul>
                  {Object.entries(errors).map(([field, error]) => {
                    const target = field === "venue" ? "venueLatitude" : field;
                    return (
                      <li key={field}>
                        <a
                          href={`#admin-${target}`}
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById(`admin-${target}`)?.focus();
                          }}
                        >
                          {error}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          {fields.map(([name, label, type = "text", hint]) => {
            const Tag = type === "textarea" ? "textarea" : "input";
            const venueError =
              coordinateFields.includes(name) && Boolean(errors.venue);
            const descriptions = [
              hint && `admin-${name}-hint`,
              errors[name] && `admin-${name}-error`,
              venueError && "admin-venue-error",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div className="field" key={name}>
                <label htmlFor={`admin-${name}`}>{label}</label>
                <Tag
                  id={`admin-${name}`}
                  type={type === "textarea" ? undefined : type}
                  rows={type === "textarea" ? 3 : undefined}
                  step={type === "number" ? "any" : undefined}
                  value={values[name]}
                  readOnly={name === "id" && Boolean(editing)}
                  disabled={busy}
                  onChange={(event) => updateField(name, event.target.value)}
                  aria-invalid={Boolean(errors[name]) || venueError}
                  aria-describedby={descriptions || undefined}
                />
                {hint && (
                  <span className="field-hint" id={`admin-${name}-hint`}>
                    {hint}
                  </span>
                )}
                {errors[name] && (
                  <span className="field-error" id={`admin-${name}-error`}>
                    {errors[name]}
                  </span>
                )}
              </div>
            );
          })}
          {errors.venue && (
            <p className="field-error" id="admin-venue-error">
              {errors.venue}
            </p>
          )}
          <div className="field">
            <label htmlFor="admin-level">Level</label>
            <select
              id="admin-level"
              value={values.level}
              disabled={busy}
              onChange={(event) => updateField("level", event.target.value)}
              aria-invalid={Boolean(errors.level)}
              aria-describedby={errors.level ? "admin-level-error" : undefined}
            >
              {["Beginner", "Intermediate", "Advanced"].map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
            {errors.level && (
              <span className="field-error" id="admin-level-error">
                {errors.level}
              </span>
            )}
          </div>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save course"}
          </button>
        </form>
      </div>
    </div>
  );
}
