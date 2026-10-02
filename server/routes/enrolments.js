import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateEnrolment } from "../validation.js";

const router = Router();

router.use(requireAuth);

router.get("/me", async (request, response) => {
  const { rows } = await query(
    `SELECT course_id AS "courseId", goal,
            completed_module_ids AS "completedModules", enrolled_at AS "enrolledAt"
     FROM enrolments WHERE user_id = $1 ORDER BY enrolled_at DESC`,
    [request.user.id],
  );
  response.json({ enrolments: rows });
});

router.post("/", async (request, response) => {
  const errors = validateEnrolment(request.body);
  if (Object.keys(errors).length) return response.status(400).json({ errors });

  try {
    const { rows } = await query(
      `INSERT INTO enrolments (user_id, course_id, goal)
       VALUES ($1, $2, $3)
       RETURNING course_id AS "courseId", goal,
                 completed_module_ids AS "completedModules", enrolled_at AS "enrolledAt"`,
      [request.user.id, request.body.courseId.trim(), request.body.goal.trim()],
    );
    response.status(201).json({ enrolment: rows[0] });
  } catch (error) {
    if (error.code === "23503") {
      return response.status(404).json({ message: "Course not found." });
    }
    if (error.code === "23505") {
      return response
        .status(409)
        .json({ message: "You are already enrolled in this course." });
    }
    throw error;
  }
});

router.patch("/:courseId/progress", async (request, response) => {
  const completedModuleIds = request.body.completedModuleIds;
  if (
    !Array.isArray(completedModuleIds) ||
    completedModuleIds.some((id) => typeof id !== "string")
  ) {
    return response
      .status(400)
      .json({ message: "completedModuleIds must be a list of module IDs." });
  }

  const uniqueIds = [...new Set(completedModuleIds)];
  const { rows: courseRows } = await query(
    "SELECT modules FROM courses WHERE id = $1",
    [request.params.courseId],
  );
  if (!courseRows[0])
    return response.status(404).json({ message: "Course not found." });

  const availableIds = new Set(
    courseRows[0].modules.map((module) => module.id),
  );
  if (uniqueIds.some((id) => !availableIds.has(id))) {
    return response
      .status(400)
      .json({ message: "Progress contains an unknown module." });
  }

  const { rows } = await query(
    `UPDATE enrolments SET completed_module_ids = $3::jsonb
     WHERE user_id = $1 AND course_id = $2
     RETURNING course_id AS "courseId", goal,
               completed_module_ids AS "completedModules", enrolled_at AS "enrolledAt"`,
    [request.user.id, request.params.courseId, JSON.stringify(uniqueIds)],
  );
  if (!rows[0])
    return response.status(404).json({ message: "Enrolment not found." });
  response.json({ enrolment: rows[0] });
});

router.delete("/:courseId", async (request, response) => {
  const result = await query(
    "DELETE FROM enrolments WHERE user_id = $1 AND course_id = $2",
    [request.user.id, request.params.courseId],
  );
  if (!result.rowCount)
    return response.status(404).json({ message: "Enrolment not found." });
  response.status(204).end();
});

export default router;
