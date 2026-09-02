import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { useLearning } from "../context/LearningContext.jsx";
import { validateEnrolment } from "../utils/validation.js";

const emptyForm = { fullName: "", email: "", goal: "", agreed: false };

export default function EnrolPage({ courses, loading, error, onRetry }) {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const { enrolments, enrol } = useLearning();
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const course = courses.find((item) => item.id === courseId);

  if (loading) {
    return (
      <Feedback title="Loading enrolment form…" headingLevel="h1">
        <p>Getting the course details ready.</p>
      </Feedback>
    );
  }

  if (error) {
    return (
      <Feedback
        tone="error"
        title="Enrolment unavailable"
        headingLevel="h1"
        action={
          <button className="button button--small" type="button" onClick={onRetry}>
            Try again
          </button>
        }
      >
        <p>{error}</p>
      </Feedback>
    );
  }

  if (!course) {
    return (
      <Feedback
        tone="error"
        title="Course not found"
        headingLevel="h1"
        action={
          <Link className="button button--small" to="/">
            Browse courses
          </Link>
        }
      >
        <p>Choose an available course before enrolling.</p>
      </Feedback>
    );
  }

  if (enrolments.some((item) => item.courseId === course.id)) {
    return (
      <Feedback
        tone="success"
        title="You are already enrolled"
        headingLevel="h1"
        action={
          <Link className="button button--small button--success" to="/learning">
            Go to my learning
          </Link>
        }
      >
        <p>{course.title} is ready in your learning list.</p>
      </Feedback>
    );
  }

  function updateField(event) {
    const { name, type, checked, value } = event.target;
    setValues((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: "" }));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateEnrolment(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    enrol(course.id, {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      goal: values.goal.trim(),
    });
    navigate("/learning", {
      state: { notice: `You are enrolled in ${course.title}.` },
    });
  }

  return (
    <div className="enrol-page">
      <Link className="back-link" to={`/courses/${course.id}`}>
        <span aria-hidden="true">←</span> Back to course
      </Link>

      <div className="enrol-grid">
        <header>
          <p className="eyebrow">Course enrolment</p>
          <h1>Join {course.title}</h1>
          <p className="lead">
            Tell us who is learning and what you want to achieve. You can start
            the first module straight away.
          </p>
          <div className="course-slip">
            <span>{course.level}</span>
            <span>{course.duration}</span>
            <span>{course.modules.length} modules</span>
          </div>
        </header>

        <form className="enrol-form" onSubmit={handleSubmit} noValidate>
          <div className="form-heading">
            <span aria-hidden="true">01</span>
            <div>
              <h2>Your details</h2>
              <p>All fields are required.</p>
            </div>
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="error-summary" ref={summaryRef} tabIndex="-1" role="alert">
              <strong>Check the highlighted fields.</strong>
              <p>There are {Object.keys(errors).length} items to fix.</p>
            </div>
          )}

          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              name="fullName"
              autoComplete="name"
              value={values.fullName}
              onChange={updateField}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
            />
            {errors.fullName && (
              <span className="field-error" id="fullName-error">
                {errors.fullName}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck="false"
              value={values.email}
              onChange={updateField}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : "email-hint"}
            />
            <span className="field-hint" id="email-hint">
              Used only for this project demonstration.
            </span>
            {errors.email && (
              <span className="field-error" id="email-error">
                {errors.email}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="goal">What do you want to achieve?</label>
            <textarea
              id="goal"
              name="goal"
              rows="4"
              autoComplete="off"
              value={values.goal}
              onChange={updateField}
              aria-invalid={Boolean(errors.goal)}
              aria-describedby={errors.goal ? "goal-error" : "goal-hint"}
            />
            <span className="field-hint" id="goal-hint">
              For example: I want to build a portfolio page for internships.
            </span>
            {errors.goal && (
              <span className="field-error" id="goal-error">
                {errors.goal}
              </span>
            )}
          </div>

          <label className="checkbox-field" htmlFor="agreed">
            <input
              id="agreed"
              name="agreed"
              type="checkbox"
              checked={values.agreed}
              onChange={updateField}
              aria-invalid={Boolean(errors.agreed)}
              aria-describedby={errors.agreed ? "agreed-error" : undefined}
            />
            <span>
              I want to add this course to My learning.
            </span>
          </label>
          {errors.agreed && (
            <span className="field-error" id="agreed-error">
              {errors.agreed}
            </span>
          )}

          <button className="button" type="submit">
            Confirm enrolment
          </button>
        </form>
      </div>
    </div>
  );
}
