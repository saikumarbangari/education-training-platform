import { query } from "../db.js";
import { hashToken } from "../lib/security.js";

function bearerToken(header = "") {
  return /^Bearer ([a-f0-9]{64})$/i.exec(header)?.[1] || "";
}

export async function requireAuth(request, response, next) {
  try {
    const token = bearerToken(request.get("authorization"));
    if (!token)
      return response.status(401).json({ message: "Sign in to continue." });

    const tokenHash = hashToken(token);
    const { rows } = await query(
      `SELECT users.id, users.full_name AS "fullName", users.email, users.role
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
      [tokenHash],
    );

    if (!rows[0])
      return response
        .status(401)
        .json({ message: "Your session has expired." });
    request.user = rows[0];
    request.tokenHash = tokenHash;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== "admin") {
    return response
      .status(403)
      .json({ message: "Administrator access is required." });
  }
  next();
}
