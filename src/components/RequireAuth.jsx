import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Feedback from "./Feedback.jsx";

export default function RequireAuth({ children, admin = false }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading)
    return <Feedback headingLevel="h1" title="Checking your session…" />;
  if (auth.error)
    return (
      <Feedback
        headingLevel="h1"
        tone="error"
        title="Cannot check your session"
        action={
          <div className="button-row">
            <button className="button" onClick={auth.retry}>
              Try again
            </button>
            <button
              className="button button--secondary"
              onClick={auth.clearSession}
            >
              Return to sign in
            </button>
          </div>
        }
      >
        <p>{auth.error}</p>
      </Feedback>
    );
  if (!auth.user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && auth.user.role !== "admin")
    return (
      <Feedback
        headingLevel="h1"
        tone="error"
        title="Administrator access required"
        action={
          <Link to="/" className="button">
            Browse courses
          </Link>
        }
      >
        <p>
          Your account can enrol in courses and record progress, but cannot edit
          courses.
        </p>
      </Feedback>
    );
  return children;
}
