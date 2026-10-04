import { Router } from "express";
import { query } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();
const PAGE_SIZE = 25;
const LEARNER_FIELDS =
  'id, full_name AS "fullName", email, created_at AS "createdAt"';

router.use(requireAuth, requireAdmin);

function readPage(value = "1") {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return null;
  return Number(value);
}

router.get("/", async (request, response) => {
  const page = readPage(request.query.page);
  const search = request.query.q ?? "";
  if (!page || typeof search !== "string" || search.length > 100) {
    return response
      .status(400)
      .json({
        message: "Use a valid page and a search of up to 100 characters.",
      });
  }

  // Escape LIKE wildcards so names and emails are searched as literal text.
  const pattern = `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`;
  const filter = "role = 'learner' AND (full_name ILIKE $1 OR email ILIKE $1)";
  const count = await query(
    `SELECT COUNT(*) AS total FROM users WHERE ${filter}`,
    [pattern],
  );
  const { rows } = await query(
    `SELECT ${LEARNER_FIELDS} FROM users WHERE ${filter}
     ORDER BY LOWER(full_name), id LIMIT $2 OFFSET $3`,
    [pattern, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  response.json({
    learners: rows,
    total: Number(count.rows[0].total),
    page,
    pageSize: PAGE_SIZE,
  });
});

router.get("/:learnerId", async (request, response) => {
  const { learnerId } = request.params;
  const page = readPage(request.query.page);
  if (
    !/^[1-9]\d{0,18}$/.test(learnerId) ||
    BigInt(learnerId) > 9223372036854775807n ||
    !page
  ) {
    return response
      .status(400)
      .json({ message: "Use a valid learner ID and page." });
  }
  const { rows: learners } = await query(
    `SELECT ${LEARNER_FIELDS} FROM users WHERE id = $1 AND role = 'learner'`,
    [learnerId],
  );
  if (!learners[0])
    return response.status(404).json({ message: "Learner not found." });

  const { rows: enrolments } = await query(
    `SELECT enrolments.course_id AS "courseId", courses.title AS "courseTitle",
            enrolments.goal, enrolments.enrolled_at AS "enrolledAt",
            enrolments.completed_module_ids AS "completedModules", courses.modules
     FROM enrolments JOIN courses ON courses.id = enrolments.course_id
     WHERE enrolments.user_id = $1 ORDER BY enrolments.enrolled_at DESC, courses.id`,
    [learnerId],
  );
  const count = await query(
    "SELECT COUNT(*) AS total FROM attendance WHERE user_id = $1",
    [learnerId],
  );
  const { rows: attendance } = await query(
    `SELECT attendance.id, attendance.course_id AS "courseId", courses.title AS "courseTitle",
            attendance.distance_metres AS "distanceMetres", attendance.checked_in_at AS "checkedInAt"
     FROM attendance JOIN courses ON courses.id = attendance.course_id
     WHERE attendance.user_id = $1
     ORDER BY attendance.checked_in_at DESC, attendance.id DESC LIMIT $2 OFFSET $3`,
    [learnerId, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );

  response.json({
    learner: learners[0],
    enrolments: enrolments.map(
      ({ modules, completedModules, ...enrolment }) => {
        // Removed modules and duplicate completion IDs must not inflate progress.
        const completedCount = modules.filter((module) =>
          completedModules.includes(module.id),
        ).length;
        return {
          ...enrolment,
          completedCount,
          totalModules: modules.length,
          progress: modules.length
            ? Math.round((completedCount / modules.length) * 100)
            : 0,
        };
      },
    ),
    attendance,
    attendanceTotal: Number(count.rows[0].total),
    page,
    pageSize: PAGE_SIZE,
  });
});

export default router;
