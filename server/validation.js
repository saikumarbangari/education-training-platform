const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const LEVELS = new Set(["Beginner", "Intermediate", "Advanced"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateRegistration(values = {}) {
  values ??= {};
  const errors = {};
  const fullName = text(values.fullName);
  const email = text(values.email);
  if (fullName.length < 2 || fullName.length > 100) {
    errors.fullName = "Enter a name between 2 and 100 characters.";
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (
    typeof values.password !== "string" ||
    values.password.length < 10 ||
    values.password.length > 128
  ) {
    errors.password = "Use between 10 and 128 characters.";
  }
  return errors;
}

export function validateLogin(values = {}) {
  values ??= {};
  const errors = {};
  const email = text(values.email);
  if (email.length > 254 || !EMAIL_PATTERN.test(email))
    errors.email = "Enter a valid email address.";
  if (!text(values.password) || values.password.length > 128)
    errors.password = "Enter your password.";
  return errors;
}

export function validateCourse(values = {}) {
  values ??= {};
  const errors = {};
  if (!/^[a-z0-9-]{3,80}$/.test(text(values.id))) {
    errors.id = "Use a lowercase course ID with letters, numbers, or hyphens.";
  }
  for (const field of ["title", "summary", "category", "duration", "outcome"]) {
    if (!text(values[field])) errors[field] = `${field} is required.`;
  }
  if (text(values.title).length > 120)
    errors.title = "Use no more than 120 characters.";
  if (text(values.summary).length > 500)
    errors.summary = "Use no more than 500 characters.";
  if (text(values.category).length > 80)
    errors.category = "Use no more than 80 characters.";
  if (text(values.duration).length > 80)
    errors.duration = "Use no more than 80 characters.";
  if (text(values.outcome).length > 500)
    errors.outcome = "Use no more than 500 characters.";
  if (!LEVELS.has(values.level)) errors.level = "Choose a valid level.";
  if (
    !Array.isArray(values.skills) ||
    values.skills.length === 0 ||
    values.skills.length > 20 ||
    values.skills.some((skill) => !text(skill) || text(skill).length > 60)
  ) {
    errors.skills = "Add 1 to 20 skills of no more than 60 characters each.";
  }
  const modulesValid =
    Array.isArray(values.modules) &&
    values.modules.length > 0 &&
    values.modules.length <= 30 &&
    values.modules.every(
      (module) =>
        /^[a-z0-9-]{1,80}$/.test(text(module?.id)) &&
        text(module?.title).length > 0 &&
        text(module?.title).length <= 120,
    );
  const moduleIds = modulesValid
    ? values.modules.map((module) => text(module.id))
    : [];
  if (!modulesValid || new Set(moduleIds).size !== moduleIds.length) {
    errors.modules = "Add 1 to 30 modules with unique IDs and titles.";
  }
  return errors;
}

export function validateEnrolment(values = {}) {
  values ??= {};
  const errors = {};
  if (!text(values.courseId)) errors.courseId = "Choose a course.";
  if (text(values.goal).length < 10 || text(values.goal).length > 500) {
    errors.goal = "Describe your goal in 10 to 500 characters.";
  }
  return errors;
}
