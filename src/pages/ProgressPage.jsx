import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { useLearning } from "../context/LearningContext.jsx";
import { courseProgress } from "../utils/courses.js";

export default function ProgressPage({ courses, loading, error, onRetry }) {
  const { enrolments } = useLearning();

  if (loading) {
    return (
      <Feedback title="Calculating progress…" headingLevel="h1">
        <p>Reading your completed modules.</p>
      </Feedback>
    );
  }

  if (error) {
    return (
      <Feedback
        tone="error"
        title="Progress unavailable"
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

  const records = enrolments
    .map((enrolment) => {
      const course = courses.find((item) => item.id === enrolment.courseId);
      return course ? { course, enrolment, progress: courseProgress(course, enrolment) } : null;
    })
    .filter(Boolean);
  const completed = records.filter((record) => record.progress === 100).length;
  const inProgress = records.filter(
    (record) => record.progress > 0 && record.progress < 100,
  ).length;
  const nextRecord = records.find((record) => record.progress < 100);
  const nextModule = nextRecord?.course.modules.find(
    (module) => !nextRecord.enrolment.completedModules.includes(module.id),
  );

  return (
    <div className="progress-page">
      <header className="page-heading">
        <p className="eyebrow">Progress overview</p>
        <h1>See where you are up to</h1>
        <p>A simple summary of the courses and modules saved on this device.</p>
      </header>

      {!records.length ? (
        <Feedback
          title="There is no progress to show yet"
          action={
            <Link className="button button--small" to="/">
              Browse courses
            </Link>
          }
        >
          <p>Enrol in a course, then complete a module to start your record.</p>
        </Feedback>
      ) : (
        <>
          <section className="progress-ledger" aria-labelledby="summary-heading">
            <div>
              <p className="eyebrow">Your record</p>
              <h2 id="summary-heading">Learning summary</h2>
            </div>
            <dl>
              <div>
                <dt>Enrolled</dt>
                <dd>{records.length}</dd>
              </div>
              <div>
                <dt>In progress</dt>
                <dd>{inProgress}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{completed}</dd>
              </div>
            </dl>
          </section>

          {nextRecord && nextModule && (
            <section className="next-step" aria-labelledby="next-heading">
              <span className="next-step__number" aria-hidden="true">
                →
              </span>
              <div>
                <p className="eyebrow">Suggested next step</p>
                <h2 id="next-heading">{nextModule.title}</h2>
                <p>Continue {nextRecord.course.title} from your learning list.</p>
              </div>
              <Link className="button button--small" to="/learning">
                Open my learning
              </Link>
            </section>
          )}

          <section className="progress-courses" aria-labelledby="course-progress-heading">
            <h2 id="course-progress-heading">Progress by course</h2>
            {records.map(({ course, progress }) => (
              <article key={course.id}>
                <div>
                  <p className="eyebrow">{course.category}</p>
                  <h3>{course.title}</h3>
                </div>
                <ProgressBar value={progress} label={`${course.title} progress`} />
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
