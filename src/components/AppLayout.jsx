import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navClass = ({ isActive }) => (isActive ? "nav-link is-active" : "nav-link");

export default function AppLayout() {
  const { pathname } = useLocation();

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
            </ul>
          </nav>
        </div>
      </header>

      <main id="main-content" className="site-main" tabIndex="-1">
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
