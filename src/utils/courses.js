export function filterCourses(courses, query = "", category = "All", level = "All") {
  const term = query.trim().toLowerCase();

  return courses.filter((course) => {
    const matchesText =
      !term ||
      [course.title, course.summary, ...course.skills]
        .join(" ")
        .toLowerCase()
        .includes(term);
    return (
      matchesText &&
      (category === "All" || course.category === category) &&
      (level === "All" || course.level === level)
    );
  });
}

export function courseProgress(course, enrolment) {
  if (!course || !enrolment || course.modules.length === 0) return 0;
  return Math.round(
    (enrolment.completedModules.length / course.modules.length) * 100,
  );
}
