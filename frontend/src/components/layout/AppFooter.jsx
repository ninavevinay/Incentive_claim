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
      <footer className="mt-auto tpl-dashboard-footer app-chrome">
        <div className="app-container">
          <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="SB Jain"
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
              />
              <div>
                <div className="text-xs font-semibold text-slate-700">SBJIT NPTEL Reimburse</div>
                <div className="text-[10px] text-slate-400">Enterprise Portal v1.0</div>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Developed by{" "}
              <span className="font-semibold text-[color:var(--primary)]">Vinay Ninave</span>
            </div>
            <div className="text-[11px] text-slate-400">
              &copy; {new Date().getFullYear()} S.B. Jain Institute. All rights reserved.
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
              <p>+91 7517635226</p>
              <p>npteladmin@sbjit.edu.in</p>
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
            &copy; {new Date().getFullYear()} SBJIT NPTEL Reimburse. All Rights Reserved.
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
