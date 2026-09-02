export function validateEnrolment(values) {
  const errors = {};

  if (!values.fullName.trim()) errors.fullName = "Enter your full name.";
  if (!values.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Enter an email address in the format name@example.com.";
  }
  if (values.goal.trim().length < 10) {
    errors.goal = "Describe your study goal in at least 10 characters.";
  }
  if (!values.agreed) errors.agreed = "Confirm that you want to join this course.";

  return errors;
}
