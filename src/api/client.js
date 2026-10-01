const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
export const SESSION_KEY = "waypoint-session";

export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function api(path, { method = "GET", body, token, signal } = {}) {
  let response;
  // A free API host can take about a minute to wake after being idle.
  const timeout = AbortSignal.timeout(method === "GET" ? 90000 : 20000);
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      "Cannot reach the server. It may be waking up; wait a minute and try again. Check your connection if the problem continues.",
      0,
    );
  }
  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "The server returned an unexpected response. Please try again.",
      response.status,
    );
  }
  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(
        new CustomEvent("session-expired", { detail: token }),
      );
    }
    throw new ApiError(
      data.message || "Please check the highlighted fields.",
      response.status,
      data.errors,
    );
  }
  return data;
}
