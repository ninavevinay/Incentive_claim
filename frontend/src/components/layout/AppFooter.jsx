import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { getDashboardPathForUser } from "../../lib/routeMap.js";

const galleryImages = [
  "/elearning/course-1.jpg",
  "/elearning/course-2.jpg",
  "/elearning/course-3.jpg",
  "/elearning/course-2.jpg",
  "/elearning/course-3.jpg",
  "/elearning/course-1.jpg"
];

export default function AppFooter({ useElearningFooter = false }) {
  const { user } = useAuth();
  const dashboardPath = getDashboardPathForUser(user);
  const quickLinks = user
    ? [
        { to: "/", label: "Home" },
        { to: dashboardPath, label: "Dashboard" },
        { to: "/login", label: "Switch Account" }
      ]
    : [
        { to: "/", label: "Home" },
        { to: "/login", label: "Login" },
        { to: "/register", label: "Register" }
      ];

  if (!useElearningFooter) {
    return (
      <footer className="mt-auto glass app-chrome border-t border-[color:var(--border-subtle)] py-[20px]">
        <div className="app-container">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="SB Jain"
                className="h-8 w-8 rounded-xl border border-[color:var(--border-subtle)] bg-white object-contain shadow-sm sm:h-9 sm:w-9"
              />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--primary)] sm:text-[11px]">
                  Incentive Claim System
                </div>
                <div className="text-[9px] text-black/35 sm:text-[10px]">
                  Version 1.0
                </div>
              </div>
            </div>
            <div className="text-center text-[10px] uppercase tracking-wider text-black/45 sm:text-[11px]">
              Developed by{" "}
              <span className="font-bold text-[color:var(--primary)] transition-colors hover:text-[color:var(--primary-deep)]">
                Vinay Ninave
              </span>
            </div>
            <div className="text-[10px] text-black/35 sm:text-[11px]">
              &copy; {new Date().getFullYear()} All rights reserved
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="tpl-public-footer">
      <div className="app-container">
        <div className="tpl-public-footer-grid">
          <div>
            <h4>Quick Link</h4>
            <div className="tpl-public-footer-links">
              {quickLinks.map((item) => (
                <Link key={item.to} to={item.to}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4>Contact</h4>
            <div className="tpl-public-footer-copy">
              <p>SB Jain Institute of Technology Management &amp; Research, Nagpur</p>
              <p>+91 00000 00000</p>
              <p>incentive-portal@sbjit.edu.in</p>
            </div>
          </div>

          <div>
            <h4>Gallery</h4>
            <div className="tpl-public-footer-gallery">
              {galleryImages.map((src, index) => (
                <img key={`${src}-${index}`} src={src} alt="" loading="lazy" />
              ))}
            </div>
          </div>

          <div>
            <h4>Portal Access</h4>
            <div>
              <p className="tpl-public-footer-copy">
                Register and track incentive claim approvals with department-level review workflow.
              </p>
              {!user && (
                <div className="mt-3">
                  <Link to="/register" className="tpl-public-footer-cta">
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="tpl-public-footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} SBJIT Incentive Portal. All Rights Reserved.
            <span className="ml-2">Developed by Vinay Ninave</span>
          </div>
          <div className="tpl-public-footer-menu">
            <Link to="/">Home</Link>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
