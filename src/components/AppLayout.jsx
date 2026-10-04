import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const navClass = ({ isActive }) =>
  isActive ? "nav-link is-active" : "nav-link";

export default function AppLayout() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setLogoutError("");
    try {
      await signOut();
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  function skipToMain(event) {
    event.preventDefault();
    document.getElementById("main-content")?.focus();
  }

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={skipToMain}>
        Skip to main content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <NavLink className="brand" to="/" aria-label="Waypoint Learning home">
            <span className="brand-mark" aria-hidden="true">
              W
            </span>
            <span>
              <strong>Waypoint</strong>
              <small>Learning</small>
            </span>
          </NavLink>
          <nav aria-label="Main navigation">
            <ul className="nav-list">
              <li>
                <NavLink className={navClass} to="/" end>
                  Discover
                </NavLink>
              </li>
              <li>
                <NavLink className={navClass} to="/learning">
                  My learning
                </NavLink>
              </li>
              <li>
                <NavLink className={navClass} to="/progress">
                  Progress
                </NavLink>
              </li>
              <li>
                <NavLink className={navClass} to="/attendance">
                  Attendance
                </NavLink>
              </li>
              {user?.role === "admin" && (
                <li>
                  <NavLink className={navClass} to="/admin" end>
                    Manage courses
                  </NavLink>
                </li>
              )}
              {user?.role === "admin" && (
                <li>
                  <NavLink className={navClass} to="/admin/learners">
                    Learners
                  </NavLink>
                </li>
              )}
              {!user && (
                <li>
                  <NavLink className={navClass} to="/login">
                    Sign in
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main-content" className="site-main" tabIndex="-1">
        {user && (
          <div className="account-bar">
            <span>
              Signed in as <strong>{user.fullName}</strong>
            </span>
            <button className="text-link" onClick={logout} disabled={busy}>
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
        {logoutError && (
          <p className="error-summary" role="alert">
            Sign-out failed. {logoutError} Please try again before leaving this
            shared device.
          </p>
        )}
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <strong>Education / Training Platform</strong>
          <span> Waypoint Learning · ICT930.</span>
        </div>
      </footer>
    </>
  );
}
