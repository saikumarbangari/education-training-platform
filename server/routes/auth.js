import { Router } from "express";
import { query, transaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
} from "../lib/security.js";
import { validateLogin, validateRegistration } from "../validation.js";

const router = Router();

function sessionExpiry() {
  const days = Number.parseInt(process.env.SESSION_DAYS || "7", 10);
  return new Date(
    Date.now() + (Number.isFinite(days) && days > 0 ? days : 7) * 86_400_000,
  );
}

async function startSession(userId, runQuery = query) {
  const { token, tokenHash } = createSessionToken();
  await runQuery(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [tokenHash, userId, sessionExpiry()],
  );
  return token;
}

router.post("/register", async (request, response) => {
  const errors = validateRegistration(request.body);
  if (Object.keys(errors).length) return response.status(400).json({ errors });

  try {
    const passwordHash = await hashPassword(request.body.password);
    const { user, token } = await transaction(async (runQuery) => {
      const { rows } = await runQuery(
        `INSERT INTO users (full_name, email, password_hash)
         VALUES ($1, LOWER($2), $3)
         RETURNING id, full_name AS "fullName", email, role`,
        [request.body.fullName.trim(), request.body.email.trim(), passwordHash],
      );
      const user = rows[0];
      const token = await startSession(user.id, runQuery);
      return { user, token };
    });
    response.status(201).json({ token, user });
  } catch (error) {
    if (error.code === "23505") {
      return response
        .status(409)
        .json({ message: "An account already uses that email." });
    }
    throw error;
  }
});

router.post("/login", async (request, response) => {
  const errors = validateLogin(request.body);
  if (Object.keys(errors).length) return response.status(400).json({ errors });

  const { rows } = await query(
    `SELECT id, full_name AS "fullName", email, role, password_hash AS "passwordHash"
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [request.body.email.trim()],
  );
  const user = rows[0];
  if (
    !user ||
    !(await verifyPassword(request.body.password, user.passwordHash))
  ) {
    return response
      .status(401)
      .json({ message: "Email or password is incorrect." });
  }

  delete user.passwordHash;
  const token = await startSession(user.id);
  response.json({ token, user });
});

router.get("/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});

router.post("/logout", requireAuth, async (request, response) => {
  await query("DELETE FROM sessions WHERE token_hash = $1", [
    request.tokenHash,
  ]);
  response.status(204).end();
});

export default router;
