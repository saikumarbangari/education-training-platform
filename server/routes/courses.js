import { Router } from "express";
import { query } from "../db.js";
import { validCoordinates } from "../lib/geo.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { validateCourse } from "../validation.js";

const router = Router();
const PUBLIC_COURSE_FIELDS = `
  id, title, summary, category, level, duration, outcome, skills, modules,
  venue_name AS "venueName", check_in_radius_metres AS "checkInRadiusMetres"`;
const ADMIN_COURSE_FIELDS = `
  id, title, summary, category, level, duration, outcome, skills, modules,
  venue_name AS "venueName", venue_latitude AS "venueLatitude",
  venue_longitude AS "venueLongitude", check_in_radius_metres AS "checkInRadiusMetres"`;

function courseValues(body, id = body.id) {
  return {
    id: id.trim(),
    title: body.title.trim(),
    summary: body.summary.trim(),
    category: body.category.trim(),
    level: body.level,
    duration: body.duration.trim(),
    outcome: body.outcome.trim(),
    skills: body.skills.map((skill) => String(skill).trim()).filter(Boolean),
    modules: body.modules.map((module) => ({
      id: String(module.id).trim(),
      title: String(module.title).trim(),
    })),
    venueName: body.venueName?.trim() || null,
    venueLatitude:
      body.venueLatitude == null || body.venueLatitude === ""
        ? null
        : Number(body.venueLatitude),
    venueLongitude:
      body.venueLongitude == null || body.venueLongitude === ""
        ? null
        : Number(body.venueLongitude),
    checkInRadiusMetres: Number(body.checkInRadiusMetres ?? 250),
  };
}

function courseErrors(body) {
  const errors = validateCourse(body);
  if (
    body.venueName != null &&
    (typeof body.venueName !== "string" || body.venueName.length > 120)
  ) {
    errors.venueName = "Use a venue name of no more than 120 characters.";
  }
  const hasLatitude =
    body.venueLatitude !== null &&
    body.venueLatitude !== undefined &&
    body.venueLatitude !== "";
  const hasLongitude =
    body.venueLongitude !== null &&
    body.venueLongitude !== undefined &&
    body.venueLongitude !== "";
  if (hasLatitude !== hasLongitude) {
    errors.venue = "Provide both venue coordinates.";
  } else if (
    hasLatitude &&
    (typeof body.venueLatitude !== "number" ||
      typeof body.venueLongitude !== "number" ||
      !validCoordinates(body.venueLatitude, body.venueLongitude))
  ) {
    errors.venue = "Provide valid venue coordinates.";
  }
  const radius = Number(body.checkInRadiusMetres ?? 250);
  if (!Number.isInteger(radius) || radius < 25 || radius > 5000) {
    errors.checkInRadiusMetres =
      "Use a check-in radius between 25 and 5000 metres.";
  }
  return errors;
}

async function findCourse(id, includeCoordinates = false) {
  const fields = includeCoordinates
    ? ADMIN_COURSE_FIELDS
    : PUBLIC_COURSE_FIELDS;
  const { rows } = await query(`SELECT ${fields} FROM courses WHERE id = $1`, [
    id,
  ]);
  return rows[0];
}

router.get("/", async (request, response) => {
  const { rows } = await query(
    `SELECT ${PUBLIC_COURSE_FIELDS} FROM courses ORDER BY title`,
  );
  response.json({ courses: rows });
});

router.get("/admin", requireAuth, requireAdmin, async (request, response) => {
  const { rows } = await query(
    `SELECT ${ADMIN_COURSE_FIELDS} FROM courses ORDER BY title`,
  );
  response.json({ courses: rows });
});

router.get("/:courseId", async (request, response) => {
  const course = await findCourse(request.params.courseId);
  if (!course)
    return response.status(404).json({ message: "Course not found." });
  response.json({ course });
});

router.post("/", requireAuth, requireAdmin, async (request, response) => {
  const errors = courseErrors(request.body);
  if (Object.keys(errors).length) return response.status(400).json({ errors });
  const course = courseValues(request.body);

  try {
    await query(
      `INSERT INTO courses (
         id, title, summary, category, level, duration, outcome, skills, modules,
         venue_name, venue_latitude, venue_longitude, check_in_radius_metres
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13)`,
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
        course.venueName,
        course.venueLatitude,
        course.venueLongitude,
        course.checkInRadiusMetres,
      ],
    );
    response.status(201).json({ course: await findCourse(course.id, true) });
  } catch (error) {
    if (error.code === "23505") {
      return response
        .status(409)
        .json({ message: "That course ID is already in use." });
    }
    throw error;
  }
});

router.put(
  "/:courseId",
  requireAuth,
  requireAdmin,
  async (request, response) => {
    const values = { ...request.body, id: request.params.courseId };
    const errors = courseErrors(values);
    if (Object.keys(errors).length)
      return response.status(400).json({ errors });
    const course = courseValues(values, request.params.courseId);
    const result = await query(
      `UPDATE courses SET
       title = $2, summary = $3, category = $4, level = $5, duration = $6,
       outcome = $7, skills = $8::jsonb, modules = $9::jsonb, venue_name = $10,
       venue_latitude = $11, venue_longitude = $12, check_in_radius_metres = $13,
       updated_at = NOW()
     WHERE id = $1`,
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
        course.venueName,
        course.venueLatitude,
        course.venueLongitude,
        course.checkInRadiusMetres,
      ],
    );
    if (!result.rowCount)
      return response.status(404).json({ message: "Course not found." });
    response.json({ course: await findCourse(course.id, true) });
  },
);

router.delete(
  "/:courseId",
  requireAuth,
  requireAdmin,
  async (request, response) => {
    const result = await query("DELETE FROM courses WHERE id = $1", [
      request.params.courseId,
    ]);
    if (!result.rowCount)
      return response.status(404).json({ message: "Course not found." });
    response.status(204).end();
  },
);

export default router;
