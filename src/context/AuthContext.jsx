import { createContext, useContext, useEffect, useState } from "react";
import { api, SESSION_KEY } from "../api/client.js";

const AuthContext = createContext(null);
function savedToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(savedToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* Storage may be blocked. */
    }
    setToken("");
    setUser(null);
    setLoading(false);
    setError("");
  }

  useEffect(() => {
    const expired = (event) => {
      if (event.detail === token) clearSession();
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api("/auth/me", { token, signal: controller.signal })
      .then(({ user }) => {
        if (!controller.signal.aborted) setUser(user);
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.status !== 401)
          setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, revision]);

  async function signIn(mode, values) {
    const result = await api(`/auth/${mode}`, { method: "POST", body: values });
    try {
      sessionStorage.setItem(SESSION_KEY, result.token);
    } catch {
      /* Works until refresh if storage is blocked. */
    }
    setUser(result.user);
    setError("");
    setToken(result.token);
  }

  async function signOut() {
    // Keep the session if the network failed: the server has not confirmed logout.
    try {
      await api("/auth/logout", { method: "POST", token, body: {} });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    clearSession();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        signIn,
        signOut,
        clearSession,
        retry: () => setRevision((n) => n + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
