import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { query } from "./db.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import attendanceRoutes from "./routes/attendance.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import enrolmentRoutes from "./routes/enrolments.js";

const app = express();
const allowedOrigins = (
  process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim());

app.disable("x-powered-by");
// Set only to the known number of reverse proxies used by the API host.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
app.use((request, response, next) => {
  response.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use((request, response, next) => {
  if (
    ["POST", "PUT", "PATCH"].includes(request.method) &&
    request.path !== "/api/auth/logout" &&
    (!request.body ||
      typeof request.body !== "object" ||
      Array.isArray(request.body))
  ) {
    return response
      .status(400)
      .json({ message: "Send a JSON object in the request body." });
  }
  next();
});
app.use(
  ["/api/auth/login", "/api/auth/register"],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (request) => request.method !== "POST",
    message: {
      message: "Too many sign-in attempts. Please try again in 15 minutes.",
    },
  }),
);

app.get("/api/health", async (request, response) => {
  await query("SELECT 1");
  response.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrolments", enrolmentRoutes);
app.use("/api/attendance", attendanceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
