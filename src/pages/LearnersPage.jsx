import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import RecordPagination from "../components/RecordPagination.jsx";
import useAdminRecords from "../hooks/useAdminRecords.js";

export default function LearnersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminRecords(
    `/admin/learners?q=${encodeURIComponent(filter)}&page=${page}`,
  );
  const results = useRef(null);
  const focusResults = useRef(false);

  useEffect(() => {
    if (data)
      setPage((current) =>
        Math.min(current, Math.max(1, Math.ceil(data.total / data.pageSize))),
      );
  }, [data]);

  useEffect(() => {
    if (!loading && data && focusResults.current) {
      results.current?.focus();
      focusResults.current = false;
    }
  }, [loading, data]);

  function findLearners(event) {
    event.preventDefault();
    focusResults.current = true;
    setFilter(search.trim());
    setPage(1);
    reload();
  }

  return (
    <div className="learners-page">
      <header className="page-heading">
        <p className="eyebrow">Administration</p>
        <h1>Learners</h1>
        <p>
          Find a learner to view their enrolled courses, progress and
          attendance. Records are read-only.
        </p>
      </header>
      <form
        className="learner-search"
        onSubmit={findLearners}
        role="search"
        aria-label="Find learners"
      >
        <div className="field">
          <label htmlFor="learner-search">Search by name or email</label>
          <input
            id="learner-search"
            type="search"
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button className="button" disabled={loading}>
          Search
        </button>
        <button
          className="text-link"
          type="button"
          disabled={loading}
          onClick={() => {
            setSearch("");
            setFilter("");
            setPage(1);
            reload();
          }}
        >
          Clear search
        </button>
        <button
          className="text-link"
          type="button"
          disabled={loading}
          onClick={reload}
        >
          Refresh
        </button>
      </form>
      {loading ? (
        <Feedback title="Loading learners…" />
      ) : error ? (
        <Feedback
          tone="error"
          title="Learners unavailable"
          action={
            <button className="button" onClick={reload}>
              Try again
            </button>
          }
        >
          <p>{error}</p>
        </Feedback>
      ) : (
        <section aria-labelledby="learner-results-heading">
          <h2 id="learner-results-heading" ref={results} tabIndex="-1">
            {data.total} {data.total === 1 ? "learner" : "learners"}
            {filter ? " found" : " registered"}
          </h2>
          {!data.learners.length ? (
            <p>
              No learners found. Try another name or email, or clear the search.
            </p>
          ) : (
            <ul className="learner-list">
              {data.learners.map((learner) => (
                <li key={learner.id}>
                  <div>
                    <h3>{learner.fullName}</h3>
                    <p>{learner.email}</p>
                    <p className="field-hint">
                      Joined{" "}
                      <time dateTime={learner.createdAt}>
                        {new Date(learner.createdAt).toLocaleDateString(
                          "en-AU",
                        )}
                      </time>
                    </p>
                  </div>
                  <Link
                    className="button button--small"
                    to={`/admin/learners/${learner.id}`}
                    aria-label={`View records for ${learner.fullName}`}
                  >
                    View records
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <RecordPagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            label="Learner pages"
            onChange={(next) => {
              focusResults.current = true;
              setPage(next);
            }}
          />
        </section>
      )}
      <p className="field-hint">
        Administrator access only. Do not share learner details on a public
        screen or device.
      </p>
    </div>
  );
}
