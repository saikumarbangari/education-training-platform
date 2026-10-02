import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import Feedback from "../components/Feedback.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { useLearning } from "../context/LearningContext.jsx";
import { courseProgress } from "../utils/courses.js";

export default function LearningPage({ courses, loading, error, onRetry }) {
  const location = useLocation();
  const { enrolments, toggleModule, withdraw, pending } = useLearning();
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [leaving, setLeaving] = useState("");

  async function changeProgress(course, moduleId) {
    setSaveError("");
    setNotice("");
    try {
      await toggleModule(course, moduleId);
      setNotice("Progress saved to your account.");
    } catch (error) {
      setSaveError(error.message);
    }
  }

  async function leave(courseId) {
    setSaveError("");
    try {
      await withdraw(courseId);
      setLeaving("");
      setNotice("Course removed from My learning.");
    } catch (error) {
      setSaveError(error.message);
    }
  }

  if (loading) {
    return (
      <Feedback title="Loading your courses…" headingLevel="h1">
        <p>Getting your learning list ready.</p>
      </Feedback>
    );
  }

  if (error) {
    return (
      <Feedback
        tone="error"
        title="Learning list unavailable"
        headingLevel="h1"
        action={
          <button
            className="button button--small"
            type="button"
            onClick={onRetry}
          >
            Try again
          </button>
        }
      >
        <p>{error}</p>
      </Feedback>
    );
  }

  const enrolledCourses = enrolments
    .map((enrolment) => ({
      enrolment,
      course: courses.find((course) => course.id === enrolment.courseId),
    }))
    .filter((item) => item.course);

  return (
    <div className="learning-page">
      <header className="page-heading">
        <p className="eyebrow">My learning</p>
        <h1>Your current courses</h1>
        <p>
          Tick off a module when you finish it. Your progress saves to your
          account.
        </p>
      </header>
      {saveError && (
        <p role="alert" className="error-summary">
          Changes were not saved. {saveError}
        </p>
      )}
      {notice && (
        <p role="status" className="success-note">
          {notice}
        </p>
      )}

      {location.state?.notice && (
        <Feedback tone="success" title="Enrolment confirmed">
          <p>{location.state.notice}</p>
        </Feedback>
      )}

      {!enrolledCourses.length ? (
        <Feedback
          title="Your learning list is empty"
          action={
            <Link className="button button--small" to="/">
              Find a course
            </Link>
          }
        >
          <p>Choose a short course and it will appear here.</p>
        </Feedback>
      ) : (
        <div className="learning-list">
          {enrolledCourses.map(({ course, enrolment }) => {
            const progress = courseProgress(course, enrolment);
            return (
              <article className="learning-card" key={course.id}>
                <header>
                  <div>
                    <p className="eyebrow">{course.category}</p>
                    <h2>{course.title}</h2>
                  </div>
                  <Link className="text-link" to={`/courses/${course.id}`}>
                    Course details
                  </Link>
                </header>
                <ProgressBar value={progress} label="Course progress" />
                <fieldset disabled={pending.includes(course.id)}>
                  <legend>Modules</legend>
                  <div className="module-checklist">
                    {course.modules.map((module, index) => {
                      const checked = enrolment.completedModules.includes(
                        module.id,
                      );
                      return (
                        <label
                          className={
                            checked ? "module-row is-complete" : "module-row"
                          }
                          key={module.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => changeProgress(course, module.id)}
                          />
                          <span className="module-number">{index + 1}</span>
                          <span>{module.title}</span>
                          <strong>{checked ? "Done" : "To do"}</strong>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <p className="goal-note">
                  <strong>Your goal:</strong> {enrolment.goal}
                </p>
                <div className="button-row">
                  <Link className="text-link" to="/attendance">
                    Record attendance
                  </Link>
                  <button
                    className="text-link"
                    disabled={pending.includes(course.id)}
                    onClick={() => setLeaving(course.id)}
                  >
                    Leave course
                  </button>
                </div>
                {leaving === course.id && (
                  <div className="confirm-panel">
                    <p>
                      Leave {course.title}? Your module progress will be
                      removed. Past attendance stays in your history.
                    </p>
                    <div className="button-row">
                      <button
                        className="button button--small"
                        disabled={pending.includes(course.id)}
                        onClick={() => leave(course.id)}
                      >
                        Confirm leave
                      </button>
                      <button
                        className="button button--secondary button--small"
                        onClick={() => setLeaving("")}
                      >
                        Keep course
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
