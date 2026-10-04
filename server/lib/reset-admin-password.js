import { hashPassword } from "./security.js";
import { validateRegistration } from "../validation.js";

// Call inside a transaction so the password, sessions and completion marker agree.
export async function resetAdministratorPassword(runQuery, env = process.env) {
  const requestId = env.ADMIN_PASSWORD_RESET_REQUEST;
  if (!requestId) return false;

  const email = env.ADMIN_PASSWORD_RESET_EMAIL?.trim().toLowerCase();
  const errors = validateRegistration({
    fullName: "Course administrator",
    email,
    password: env.ADMIN_PASSWORD,
  });
  if (
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId) ||
    Object.keys(errors).length
  ) {
    throw Object.assign(new Error("Invalid administrator reset settings."), {
      code: "ADMIN_RESET_SETTINGS_INVALID",
    });
  }

  // One request can run only once, including during simultaneous restarts.
  const marker = await runQuery(
    `INSERT INTO application_setup (name) VALUES ($1)
     ON CONFLICT DO NOTHING RETURNING name`,
    [`admin-password-reset:${requestId.toLowerCase()}`],
  );
  if (!marker.rowCount) return false;

  const { rows } = await runQuery(
    "SELECT id FROM users WHERE LOWER(email) = $1 AND role = 'admin' FOR UPDATE",
    [email],
  );
  if (rows.length !== 1) {
    throw Object.assign(
      new Error("The existing administrator was not found."),
      {
        code: "ADMIN_RESET_ACCOUNT_NOT_FOUND",
      },
    );
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await runQuery("UPDATE users SET password_hash = $2 WHERE id = $1", [
    rows[0].id,
    passwordHash,
  ]);
  await runQuery("DELETE FROM sessions WHERE user_id = $1", [rows[0].id]);
  return true;
}
