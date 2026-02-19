import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import Register from "./pages/Register.jsx";
import AdminRegister from "./pages/AdminRegister.jsx";
import Login from "./pages/Login.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import FacultyDashboard from "./pages/FacultyDashboard.jsx";
import AuthorityDashboard from "./pages/AuthorityDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { getDashboardPathForUser, slugifyDepartment } from "./lib/routeMap.js";

function getSeoForPath(pathname) {
  if (pathname.startsWith("/login")) {
    return {
      title: "Login | Incentive Claim Portal",
      description: "Sign in to submit, review, and track incentive applications."
    };
  }
  if (pathname.startsWith("/register-admin")) {
    return {
      title: "Admin Registration | Incentive Claim Portal",
      description: "Create an admin account for system-wide user and application management."
    };
  }
  if (pathname.startsWith("/register")) {
    return {
      title: "Register | Incentive Claim Portal",
      description: "Create a student or faculty account to apply for incentives."
    };
  }
  if (pathname.startsWith("/student")) {
    return {
      title: "Student Dashboard | Incentive Claim Portal",
      description: "Student dashboard for application submission, tracking, and profile updates."
    };
  }
  if (pathname.startsWith("/faculty")) {
    return {
      title: "Faculty Dashboard | Incentive Claim Portal",
      description: "Faculty dashboard for incentive application submission and status tracking."
    };
  }
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin Dashboard | Incentive Claim Portal",
      description: "Admin panel to manage users, applications, and authority registrations."
    };
  }
  if (pathname.startsWith("/authority")) {
    return {
      title: "Authority Dashboard | Incentive Claim Portal",
      description: "Authority dashboard for reviewing and processing incentive applications."
    };
  }
  return {
    title: "Incentive Claim Portal",
    description: "Portal for submitting and managing institutional incentive applications."
  };
}

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) return <Navigate to={getDashboardPathForUser(user)} replace />;
  }
  return children;
}

function AuthorityProtected({ children, role, departmentScoped = false }) {
  const { user, loading } = useAuth();
  const { departmentSlug } = useParams();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={getDashboardPathForUser(user)} replace />;

  if (departmentScoped) {
    const expectedDepartmentSlug = slugifyDepartment(user.department);
    if (!expectedDepartmentSlug || departmentSlug !== expectedDepartmentSlug) {
      return <Navigate to={getDashboardPathForUser(user)} replace />;
    }
  }

  return children;
}

function AuthorityEntryRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getDashboardPathForUser(user)} replace />;
}

export default function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const isDashboardRoute =
    location.pathname.startsWith("/student") ||
    location.pathname.startsWith("/faculty") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/authority");

  const toggleMobileMenu = () => {
    if (isDashboardRoute) {
      window.dispatchEvent(new Event("portal:toggle-dashboard-menu"));
      return;
    }
    setMobileNavOpen((prev) => !prev);
  };

  useEffect(() => {
    const seo = getSeoForPath(location.pathname);
    document.title = seo.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag) {
      descriptionTag.setAttribute("content", seo.description);
    }
  }, [location.pathname]);

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 px-3 py-4 backdrop-blur-md sm:px-4 md:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-7xl lg:max-w-none">
            <div className="panel px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src="/logo.jpg"
                  alt="SB Jain"
                  className="h-12 w-12 rounded-full border border-[#10202c]/20 bg-white object-contain shadow-[0_8px_18px_rgba(27,26,23,0.16)]"
                />
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.3em] text-black/40">Institution</div>
                  <div className="mt-1 truncate text-base font-semibold font-display text-[#10202c] sm:text-xl">
                    S.B. Jain Institute of Technology Management and Research
                  </div>
                </div>
              </div>
              {isDashboardRoute && (
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-2 md:hidden"
                  onClick={toggleMobileMenu}
                  aria-label="Toggle menu"
                  aria-expanded={false}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <div className="hidden rounded-full border border-[#10202c]/15 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-black/50 sm:block">
                Incentive Portal
              </div>
            </div>
            {mobileNavOpen && !isDashboardRoute && (
                <div className="mt-3 rounded-2xl border border-[#10202c]/15 bg-white/70 px-3 py-2 text-xs uppercase tracking-[0.2em] text-black/50 sm:hidden">
                  Incentive Portal
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 page lg:pb-24">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register-authority" element={<Navigate to="/register" replace />} />
            <Route path="/register-admin" element={<AdminRegister />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <Protected role="admin">
                  <AdminDashboard />
                </Protected>
              }
            />
            <Route
              path="/student"
              element={
                <Protected role="student">
                  <StudentDashboard />
                </Protected>
              }
            />
            <Route
              path="/faculty"
              element={
                <Protected role="faculty">
                  <FacultyDashboard />
                </Protected>
              }
            />
            <Route path="/authority" element={<AuthorityEntryRedirect />} />
            <Route
              path="/authority/department-coordinator"
              element={
                <AuthorityProtected role="department_coordinator">
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route
              path="/authority/department-coordinator/:departmentSlug"
              element={
                <AuthorityProtected role="department_coordinator" departmentScoped>
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route
              path="/authority/department-hod"
              element={
                <AuthorityProtected role="department_hod">
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route
              path="/authority/department-hod/:departmentSlug"
              element={
                <AuthorityProtected role="department_hod" departmentScoped>
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route
              path="/authority/institution-coordinator"
              element={
                <AuthorityProtected role="institution_coordinator">
                  <AuthorityDashboard />
                </AuthorityProtected>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
        <footer className="lg:sticky lg:bottom-0 lg:z-20 px-3 py-4 backdrop-blur-md sm:px-4 md:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-7xl lg:max-w-none">
            <div className="panel px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo.jpg"
                    alt="SB Jain"
                    className="h-10 w-10 rounded-full border border-[#10202c]/15 bg-white object-contain shadow-[0_8px_18px_rgba(27,26,23,0.12)]"
                  />
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-black/40">Incentive Claim</div>
                  </div>
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-black/50">
                  Developed by{" "}
                  <span className="font-semibold text-black/80">Vinay Ninave</span>
                </div>
                <div className="text-xs text-black/60">All rights reserved.</div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
