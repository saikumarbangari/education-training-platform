import { Link, useParams } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { useLearning } from "../context/LearningContext.jsx";

export default function CoursePage({ courses, loading, error, onRetry }) {
  const { courseId } = useParams();
  const { enrolments } = useLearning();
  const course = courses.find((item) => item.id === courseId);

  if (loading) {
    return (
      <Feedback title="Loading course…" headingLevel="h1">
        <p>Getting the course outline ready.</p>
      </Feedback>
    );
  }

  if (error) {
    return (
      <Feedback
        tone="error"
        title="Course unavailable"
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
        <p>The course address may be out of date.</p>
      </Feedback>
    );
  }

  const enrolled = enrolments.some((item) => item.courseId === course.id);

  return (
    <article className="course-page">
      <Link className="back-link" to="/">
        <span aria-hidden="true">←</span> Back to courses
      </Link>

      <header className="course-header">
        <div>
          <p className="eyebrow">{course.category}</p>
          <h1>{course.title}</h1>
          <p className="lead">{course.summary}</p>
        </div>
        <dl className="course-facts">
          <div>
            <dt>Level</dt>
            <dd>{course.level}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{course.duration}</dd>
          </div>
          <div>
            <dt>Modules</dt>
            <dd>{course.modules.length}</dd>
          </div>
        </dl>
      </header>

      <div className="course-page__grid">
        <section aria-labelledby="route-heading">
          <p className="eyebrow">Course route</p>
          <h2 id="route-heading">What you will work through</h2>
          <ol className="learning-trail">
            {course.modules.map((module, index) => (
              <li key={module.id}>
                <span>{index + 1}</span>
                <div>
                  <small>Module {index + 1}</small>
                  <strong>{module.title}</strong>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="outcome-note" aria-labelledby="outcome-heading">
          <p className="eyebrow">Your outcome</p>
          <h2 id="outcome-heading">Finish with something useful</h2>
          <p>{course.outcome}</p>
          <h3>Skills covered</h3>
          <ul className="skill-list">
            {course.skills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
          {enrolled ? (
            <Link className="button button--success" to="/learning">
              Continue learning
            </Link>
          ) : (
            <Link className="button" to={`/courses/${course.id}/enrol`}>
              Enrol in this course
            </Link>
          )}
        </aside>
      </div>
    </article>
  );
}
