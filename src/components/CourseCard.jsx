import { Link } from "react-router-dom";

export default function CourseCard({ course, enrolled }) {
  return (
    <article className="course-card">
      <div className="course-card__tab">{course.category}</div>
      <div className="course-card__body">
        <div className="course-meta">
          <span>{course.level}</span>
          <span aria-hidden="true">/</span>
          <span>{course.duration}</span>
        </div>
        <h2>{course.title}</h2>
        <p>{course.summary}</p>
        <ul className="skill-list" aria-label={`${course.title} skills`}>
          {course.skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      </div>
      <div className="course-card__footer">
        {enrolled && <span className="status-tag">Enrolled</span>}
        <Link className="text-link" to={`/courses/${course.id}`}>
          View course <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
