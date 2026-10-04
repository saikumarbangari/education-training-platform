import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import RecordPagination from "../components/RecordPagination.jsx";
import useAdminRecords from "../hooks/useAdminRecords.js";

export default function LearnerPage() {
  const { learnerId } = useParams();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminRecords(
    `/admin/learners/${encodeURIComponent(learnerId)}?page=${page}`,
  );
  const historyHeading = useRef(null);
  const focusHistory = useRef(false);

  useEffect(() => {
    if (data)
      setPage((current) =>
        Math.min(
          current,
          Math.max(1, Math.ceil(data.attendanceTotal / data.pageSize)),
        ),
      );
  }, [data]);

  useEffect(() => {
    setPage(1);
  }, [learnerId]);
  useEffect(() => {
    if (!loading && data && focusHistory.current) {
      historyHeading.current?.focus();
      focusHistory.current = false;
    }
  }, [loading, data]);

  return (
    <div className="learner-record-page">
      <div className="button-row">
        <Link className="text-link" to="/admin/learners">
          Back to learners
        </Link>
        <button className="text-link" disabled={loading} onClick={reload}>
          Refresh records
        </button>
      </div>
      {loading ? (
        <Feedback headingLevel="h1" title="Loading learner records…" />
      ) : error ? (
        <Feedback
          headingLevel="h1"
          title="Learner records unavailable"
          tone="error"
          action={
            <button className="button" onClick={reload}>
              Try again
            </button>
          }
        >
          <p>{error}</p>
        </Feedback>
      ) : (
        <>
          <header className="page-heading">
            <p className="eyebrow">Learner record</p>
            <h1>{data.learner.fullName}</h1>
            <p>{data.learner.email}</p>
            <p>
              Joined{" "}
              <time dateTime={data.learner.createdAt}>
                {new Date(data.learner.createdAt).toLocaleDateString("en-AU")}
              </time>
              . Read-only view.
            </p>
          </header>
          <div className="learner-record-grid">
            <section
              className="history-panel"
              aria-labelledby="learner-enrolments"
            >
              <h2 id="learner-enrolments">
                Enrolled courses ({data.enrolments.length})
              </h2>
              {!data.enrolments.length ? (
                <p>No current enrolments.</p>
              ) : (
                <ul className="learner-enrolments">
                  {data.enrolments.map((enrolment) => (
                    <li key={enrolment.courseId}>
                      <h3>{enrolment.courseTitle}</h3>
                      <p>
                        <strong>Learning goal:</strong> {enrolment.goal}
                      </p>
                      <p className="field-hint">
                        Enrolled{" "}
                        <time dateTime={enrolment.enrolledAt}>
                          {new Date(enrolment.enrolledAt).toLocaleDateString(
                            "en-AU",
                          )}
                        </time>
                      </p>
                      <ProgressBar
                        value={enrolment.progress}
                        label={`${enrolment.courseTitle} progress`}
                      />
                      <p>
                        {enrolment.completedCount} of {enrolment.totalModules}{" "}
                        modules completed
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section
              className="history-panel"
              aria-labelledby="learner-attendance"
            >
              <h2 id="learner-attendance" ref={historyHeading} tabIndex="-1">
                Attendance history ({data.attendanceTotal})
              </h2>
              <p className="field-hint">
                Check-in times use this device’s local time. History can include
                courses the learner has since left.
              </p>
              {!data.attendance.length ? (
                <p>No check-ins to show.</p>
              ) : (
                <ol className="attendance-history">
                  {data.attendance.map((record) => (
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
              <RecordPagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.attendanceTotal}
                label="Attendance pages"
                onChange={(next) => {
                  focusHistory.current = true;
                  setPage(next);
                }}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
