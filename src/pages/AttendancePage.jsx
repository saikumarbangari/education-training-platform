import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import Feedback from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLearning } from "../context/LearningContext.jsx";
import { locate } from "../utils/location.js";

export default function AttendancePage({ courses, loading, error, onRetry }) {
  const { token } = useAuth();
  const { enrolments } = useLearning();
  const [records, setRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [revision, setRevision] = useState(0);
  const [courseId, setCourseId] = useState("");
  const [message, setMessage] = useState("");
  const [checkError, setCheckError] = useState("");
  const [stage, setStage] = useState("");
  const busy = stage !== "";
  const active = useRef(false);
  const mounted = useRef(true);
  const locationRequest = useRef(null);
  const enrolledCourses = courses.filter((course) =>
    enrolments.some((item) => item.courseId === course.id),
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      locationRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    api("/attendance/me", { token, signal: controller.signal })
      .then(({ attendance }) => {
        if (!controller.signal.aborted) setRecords(attendance);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setHistoryError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [token, revision]);

  async function checkIn(event) {
    event.preventDefault();
    if (active.current) return;
    setMessage("");
    setCheckError("");
    if (!courseId) {
      setCheckError("Choose a course before checking in.");
      return;
    }
    active.current = true;
    setStage("locating");
    const controller = new AbortController();
    locationRequest.current = controller;
    try {
      const position = await locate({
        signal: controller.signal,
        onRetry: () => {
          if (mounted.current) setStage("retrying");
        },
      });
      if (!mounted.current || controller.signal.aborted) return;
      setStage("saving");
      await api("/attendance/check-in", {
        method: "POST",
        token,
        body: {
          courseId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      });
      if (!mounted.current) return;
      setMessage("Attendance recorded. You are checked in.");
      setRevision((n) => n + 1);
    } catch (error) {
      if (mounted.current) {
        if (error.name === "AbortError")
          setMessage("Location check cancelled. No attendance was saved.");
        else setCheckError(error.message);
      }
    } finally {
      active.current = false;
      if (mounted.current) setStage("");
    }
  }

  if (loading)
    return <Feedback headingLevel="h1" title="Loading attendance…" />;
  if (error)
    return (
      <Feedback
        headingLevel="h1"
        title="Courses unavailable"
        tone="error"
        action={
          <button className="button" onClick={onRetry}>
            Try again
          </button>
        }
      >
        <p>{error}</p>
      </Feedback>
    );

  return (
    <div className="attendance-page">
      <header className="page-heading">
        <p className="eyebrow">In-person learning</p>
        <h1>Attendance</h1>
        <p>Check in when you arrive at your course venue.</p>
      </header>
      <div className="attendance-grid">
        <section className="enrol-form" aria-labelledby="check-in-heading">
          <h2 id="check-in-heading">Check in to a course</h2>
          {enrolledCourses.length ? (
            <form onSubmit={checkIn}>
              <div className="field">
                <label htmlFor="attendance-course">Your course</label>
                <select
                  id="attendance-course"
                  value={courseId}
                  onChange={(event) => {
                    setCourseId(event.target.value);
                    setMessage("");
                    setCheckError("");
                  }}
                  disabled={busy}
                >
                  <option value="">Choose a course</option>
                  {enrolledCourses.map((course) => (
                    <option value={course.id} key={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
              {courseId && (
                <p className="venue-note">
                  Venue:{" "}
                  {courses.find((course) => course.id === courseId)
                    ?.venueName || "Ask your trainer for the venue details."}
                </p>
              )}
              <p className="field-hint">
                When you select the button below, your browser will ask to share
                your current location. The server checks your distance from the
                venue. It saves the distance and time, not your coordinates.
              </p>
              <button className="button" disabled={busy}>
                {stage === "saving"
                  ? "Saving attendance…"
                  : busy
                    ? "Checking location…"
                    : "Share location and check in"}
              </button>
              {(stage === "locating" || stage === "retrying") && (
                <button
                  className="text-link cancel-location"
                  type="button"
                  onClick={() => locationRequest.current?.abort()}
                >
                  Cancel location check
                </button>
              )}
              {busy && (
                <p className="field-hint" role="status">
                  {stage === "saving"
                    ? "Saving your check-in…"
                    : stage === "retrying"
                      ? "A precise location was not available. Trying another location method…"
                      : "Reading your device location… Allow location when your browser asks. This can take up to 40 seconds after permission is granted."}
                </p>
              )}
            </form>
          ) : (
            <p>
              <Link className="text-link" to="/">
                Enrol in a course
              </Link>{" "}
              to check in.
            </p>
          )}
          {checkError && (
            <p className="error-summary" role="alert">
              {checkError}
            </p>
          )}
          {message && (
            <p className="success-note" role="status">
              {message}
            </p>
          )}
          <p className="field-hint">
            If location is slow, turn on your device’s Location services and
            Wi-Fi. Try again near the venue, preferably on a phone. A check-in
            is only saved after the server accepts your location.
          </p>
          <p className="field-hint">
            Location sharing is optional. If it is unavailable or you prefer not
            to share it, ask your trainer to record attendance separately. This
            does not create an app check-in.
          </p>
        </section>
        <section className="history-panel" aria-labelledby="attendance-history">
          <p className="eyebrow">Your record</p>
          <h2 id="attendance-history">Attendance history</h2>
          {historyLoading ? (
            <p role="status">Loading attendance history…</p>
          ) : historyError ? (
            <Feedback
              title="History unavailable"
              tone="error"
              action={
                <button
                  className="button button--small"
                  onClick={() => setRevision((n) => n + 1)}
                >
                  Retry history
                </button>
              }
            >
              <p>{historyError}</p>
            </Feedback>
          ) : !records.length ? (
            <p>No check-ins yet.</p>
          ) : (
            <ol className="attendance-history">
              {records.map((record) => (
                <li key={record.id}>
                  <strong>{record.courseTitle}</strong>
                  <time dateTime={record.checkedInAt}>
                    {new Date(record.checkedInAt).toLocaleString("en-AU")}
                  </time>
                  <span>{record.distanceMetres} m from the venue</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
