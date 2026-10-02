import { Router } from "express";
import { query } from "../db.js";
import { distanceMetres, validCoordinates } from "../lib/geo.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/me", async (request, response) => {
  const { rows } = await query(
    `SELECT attendance.id, attendance.course_id AS "courseId",
            attendance.distance_metres AS "distanceMetres",
            attendance.checked_in_at AS "checkedInAt", courses.title AS "courseTitle"
     FROM attendance JOIN courses ON courses.id = attendance.course_id
     WHERE attendance.user_id = $1 ORDER BY attendance.checked_in_at DESC`,
    [request.user.id],
  );
  response.json({ attendance: rows });
});

router.post("/check-in", async (request, response) => {
  if (
    typeof request.body.courseId !== "string" ||
    !request.body.courseId.trim()
  ) {
    return response.status(400).json({ message: "Choose an enrolled course." });
  }
  if (
    typeof request.body.latitude !== "number" ||
    typeof request.body.longitude !== "number"
  ) {
    return response
      .status(400)
      .json({ message: "Device coordinates are required." });
  }
  const latitude = Number(request.body.latitude);
  const longitude = Number(request.body.longitude);
  if (!validCoordinates(latitude, longitude)) {
    return response
      .status(400)
      .json({ message: "Valid device coordinates are required." });
  }

  const { rows } = await query(
    `SELECT courses.title, courses.venue_name AS "venueName",
            courses.venue_latitude AS "venueLatitude",
            courses.venue_longitude AS "venueLongitude",
            courses.check_in_radius_metres AS "checkInRadiusMetres"
     FROM courses JOIN enrolments ON enrolments.course_id = courses.id
     WHERE courses.id = $1 AND enrolments.user_id = $2`,
    [request.body.courseId, request.user.id],
  );
  const course = rows[0];
  if (!course)
    return response.status(404).json({ message: "Enrolment not found." });
  if (course.venueLatitude == null || course.venueLongitude == null) {
    return response
      .status(409)
      .json({ message: "This course does not have a check-in location." });
  }

  const distance = distanceMetres(
    { latitude, longitude },
    { latitude: course.venueLatitude, longitude: course.venueLongitude },
  );
  if (distance > course.checkInRadiusMetres) {
    return response.status(422).json({
      message: `Move within ${course.checkInRadiusMetres} metres of ${course.venueName || "the venue"}.`,
      distanceMetres: distance,
    });
  }

  const result = await query(
    `INSERT INTO attendance (user_id, course_id, distance_metres)
     VALUES ($1, $2, $3)
     RETURNING id, course_id AS "courseId", distance_metres AS "distanceMetres",
               checked_in_at AS "checkedInAt"`,
    [request.user.id, request.body.courseId, distance],
  );
  response.status(201).json({ attendance: result.rows[0] });
});

export default router;
