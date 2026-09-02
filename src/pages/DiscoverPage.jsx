import { useMemo, useState } from "react";
import CourseCard from "../components/CourseCard.jsx";
import Feedback from "../components/Feedback.jsx";
import { useLearning } from "../context/LearningContext.jsx";
import { filterCourses } from "../utils/courses.js";

export default function DiscoverPage({ courses, loading, error, onRetry }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [level, setLevel] = useState("All");
  const { enrolments } = useLearning();

  const filteredCourses = useMemo(
    () => filterCourses(courses, query, category, level),
    [courses, query, category, level],
  );
  const categories = [...new Set(courses.map((course) => course.category))];

  function clearFilters() {
    setQuery("");
    setCategory("All");
    setLevel("All");
  }

  function showCourses() {
    document.getElementById("course-finder")?.scrollIntoView();
  }

  return (
    <>
      <section className="hero" aria-labelledby="discover-heading">
        <div className="hero-copy">
          <p className="eyebrow">Short courses. Practical outcomes.</p>
          <h1 id="discover-heading">Pick one skill. Keep moving.</h1>
          <p>
            Find a manageable course, follow three clear modules, and keep your
            progress in one place.
          </p>
          <button className="button" type="button" onClick={showCourses}>
            Browse courses
          </button>
        </div>
        <div className="mini-trail" aria-label="How Waypoint works">
          <p>Your learning route</p>
          <ol>
            <li>
              <span>1</span>
              Find a course
            </li>
            <li>
              <span>2</span>
              Join the course
            </li>
            <li>
              <span>3</span>
              Track each module
            </li>
          </ol>
        </div>
      </section>

      <section id="course-finder" className="course-section" aria-labelledby="courses-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Course finder</p>
            <h2 id="courses-heading">Choose your next course</h2>
          </div>
          <p>All courses are short enough to fit around work and study.</p>
        </div>

        <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
          <div className="field field--search">
            <label htmlFor="course-search">Search by course or skill</label>
            <input
              id="course-search"
              name="courseSearch"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Python or JavaScript…"
            />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              autoComplete="off"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>All</option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="level">Level</label>
            <select
              id="level"
              name="level"
              autoComplete="off"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option>All</option>
              <option>Beginner</option>
              <option>Intermediate</option>
            </select>
          </div>
        </form>

        {loading && (
          <Feedback title="Loading courses">
            <p>The course list is on its way.</p>
          </Feedback>
        )}

        {error && (
          <Feedback
            tone="error"
            title="Course list unavailable"
            action={
              <button className="button button--small" type="button" onClick={onRetry}>
                Try again
              </button>
            }
          >
            <p>{error}</p>
          </Feedback>
        )}

        {!loading && !error && (
          <>
            <div className="result-note" role="status" aria-live="polite">
              <strong>{filteredCourses.length}</strong>{" "}
              {filteredCourses.length === 1 ? "course" : "courses"} found
            </div>
            {filteredCourses.length ? (
              <div className="course-grid">
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrolled={enrolments.some((item) => item.courseId === course.id)}
                  />
                ))}
              </div>
            ) : (
              <Feedback
                title="No courses match those filters"
                action={
                  <button className="button button--small" type="button" onClick={clearFilters}>
                    Clear filters
                  </button>
                }
              >
                <p>Try another skill, category, or level.</p>
              </Feedback>
            )}
          </>
        )}
      </section>
    </>
  );
}
