import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../../lib/auth.jsx";
import { getDashboardPathForUser } from "../../lib/routeMap.js";

const publicLinks = [
  { to: "/#home", label: "Home" },
  { to: "/login", label: "Login" },
  { to: "/#about", label: "About" },
  { to: "/#notice", label: "Notice" },
];

const isLinkActive = (location, to) => {
  const [targetPathRaw, targetHashRaw] = to.split("#");

  const targetPath = targetPathRaw || "/";
  const targetHash = targetHashRaw ? `#${targetHashRaw}` : "";

  if (location.pathname !== targetPath) return false;

  if (targetHash) {
    return location.hash === targetHash;
  }

  return location.hash === "";
};

function ScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
        });
      }
    }
  }, [location]);

  return null;
}

export default function AppHeader({
  isDashboardRoute,
  mobileNavOpen,
  onToggleMobileMenu,
}) {
  const { user } = useAuth();

  const location = useLocation();

  const dashboardPath = getDashboardPathForUser(user);

  const ctaLink = user ? dashboardPath : "/register";
  const ctaLabel = user ? "Dashboard" : "Create Account";

  const links = user
    ? [
        { to: "/#home", label: "Home" },
        { to: dashboardPath, label: "Dashboard" },
      ]
    : publicLinks;

  return (
    <>
      <ScrollToHash />

      <header className="tpl-public-header">
        <div className="app-container tpl-public-header-inner">
          <Link
            to="/#home"
            className="tpl-public-brand"
            aria-label="Go to home"
          >
            <span className="tpl-public-brand-icon">
              <img src="/logo.jpg" alt="Logo" />
            </span>

            <span className="tpl-public-brand-text">
              <span className="tpl-public-brand-top">
                S.B. Jain Institute
              </span>

              <span className="tpl-public-brand-main">
                Incentive Portal
              </span>
            </span>
          </Link>

          {!isDashboardRoute && (
            <nav className="tpl-public-nav">
              {links.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`tpl-public-nav-link ${
                    isLinkActive(location, item.to)
                      ? "is-active"
                      : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              <Link
                to={ctaLink}
                className="tpl-public-cta"
              >
                {ctaLabel}
              </Link>
            </nav>
          )}

          <div className="tpl-public-right">
            {isDashboardRoute && (
              <Link
                to="/#home"
                className="tpl-public-back-home"
              >
                Home
              </Link>
            )}

            <button
              type="button"
              className="tpl-public-menu-btn"
              onClick={onToggleMobileMenu}
              aria-label={
                isDashboardRoute
                  ? "Toggle menu"
                  : "Toggle navigation"
              }
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {mobileNavOpen && !isDashboardRoute && (
          <div className="app-container tpl-public-mobile-nav-wrap">
            <div className="tpl-public-mobile-nav">
              {links.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`tpl-public-mobile-link ${
                    isLinkActive(location, item.to)
                      ? "is-active"
                      : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              <Link
                to={ctaLink}
                className="tpl-public-mobile-cta"
              >
                {ctaLabel}
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}