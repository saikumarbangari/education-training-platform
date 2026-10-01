import { readFile } from "node:fs/promises";
import { hashPassword } from "./security.js";
import { validCoordinates } from "./geo.js";
import { validateRegistration } from "../validation.js";

export async function seedCourses(runQuery, env = process.env) {
  const courses = JSON.parse(
    await readFile(
      new URL("../../public/data/courses.json", import.meta.url),
      "utf8",
    ),
  );
  const venueName = env.DEMO_VENUE_NAME || "Sydney Training Hub";
  const latitude = Number(env.DEMO_VENUE_LATITUDE || "-33.8688");
  const longitude = Number(env.DEMO_VENUE_LONGITUDE || "151.2093");
  if (!validCoordinates(latitude, longitude))
    throw new Error("The demo venue coordinates are invalid.");
  let inserted = 0;
  for (const course of courses) {
    const result = await runQuery(
      `INSERT INTO courses (
         id, title, summary, category, level, duration, outcome, skills, modules,
         venue_name, venue_latitude, venue_longitude, check_in_radius_metres
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, 250)
       ON CONFLICT (id) DO NOTHING`,
      [
        course.id,
        course.title,
        course.summary,
        course.category,
        course.level,
        course.duration,
        course.outcome,
        JSON.stringify(course.skills),
        JSON.stringify(course.modules),
        venueName,
        latitude,
        longitude,
      ],
    );
    inserted += result.rowCount;
  }
  return inserted;
}

export async function seedAdministrator(
  runQuery,
  { resetExisting = false, env = process.env } = {},
) {
  if (!env.ADMIN_PASSWORD) return;
  const email = env.ADMIN_EMAIL?.trim();
  const errors = validateRegistration({
    fullName: "Course administrator",
    email,
    password: env.ADMIN_PASSWORD,
  });
  if (Object.keys(errors).length)
    throw new Error(
      "Provide a valid ADMIN_EMAIL and a 10–128 character ADMIN_PASSWORD.",
    );
  const existing = await runQuery(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
    [email],
  );
  // Hosted restarts must not reset a password or promote an existing learner.
  if (existing.rowCount && !resetExisting) return;
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  if (existing.rowCount) {
    await runQuery(
      "UPDATE users SET password_hash = $2, role = 'admin' WHERE id = $1",
      [existing.rows[0].id, passwordHash],
    );
  } else {
    await runQuery(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ('Course administrator', LOWER($1), $2, 'admin') ON CONFLICT DO NOTHING`,
      [email, passwordHash],
    );
  }
}
