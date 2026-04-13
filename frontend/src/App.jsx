import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import Register from "./pages/Register.jsx";
import AdminRegister from "./pages/AdminRegister.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
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
  if (pathname.startsWith("/forgot-password")) {
    return {
      title: "Forgot Password | Incentive Claim Portal",
      description: "Verify your email with OTP and reset your portal password securely."
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
      title: "Student Portal | Incentive Claim Portal",
      description: "Student portal for application submission, tracking, and profile updates."
    };
  }
  if (pathname.startsWith("/faculty")) {
    return {
      title: "Faculty Portal | Incentive Claim Portal",
      description: "Faculty portal for incentive application submission and status tracking."
    };
  }
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin Portal | Incentive Claim Portal",
      description: "Admin panel to manage users, applications, and authority registrations."
    };
  }
  if (pathname.startsWith("/authority")) {
    return {
      title: "Authority Portal | Incentive Claim Portal",
      description: "Authority portal for reviewing and processing incentive applications."
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 md:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between gap-4">
              {/* Logo and Institution */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#1E3A8A]/20 to-[#1E3A8A]/5 blur-sm"></div>
                  <img
                    src="/logo.jpg"
                    alt="SB Jain Institute"
                    className="relative h-12 w-12 rounded-full border-2 border-white bg-white object-contain shadow-lg sm:h-14 sm:w-14"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#1E3A8A]/60 sm:text-xs">
                    S.B. Jain Institute
                  </div>
                  <div className="truncate text-sm font-semibold text-[#1E3A8A] sm:text-base md:text-lg">
                    Technology Management and Research
                  </div>
                </div>
              </div>

              {/* Mobile Menu Button */}
              {isDashboardRoute && (
                <button
                  type="button"
                  className="rounded-lg border border-black/10 bg-white/80 p-2 text-black/60 transition-all hover:bg-white hover:text-black lg:hidden"
                  onClick={toggleMobileMenu}
                  aria-label="Toggle menu"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                  </svg>
                </button>
              )}

              {/* Badge */}
              <div className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-[#1E3A8A]/5 to-[#1E3A8A]/10 px-4 py-2 sm:flex">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#1E3A8A]">
                  Incentive Portal
                </span>
              </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileNavOpen && !isDashboardRoute && (
              <div className="mt-3 rounded-xl border border-black/10 bg-white/90 px-4 py-3 backdrop-blur-sm sm:hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#1E3A8A]">
                    Incentive Portal
                  </span>
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register-authority" element={<Navigate to="/register" replace />} />
            <Route path="/register-admin" element={<AdminRegister />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
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

        {/* Footer */}
        <footer className="mt-auto border-t border-black/5 bg-white/80 px-4 py-4 backdrop-blur-sm sm:px-6 md:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
              {/* Left Section */}
              <div className="flex items-center gap-3">
                <img
                  src="/logo.jpg"
                  alt="SB Jain"
                  className="h-8 w-8 rounded-full border border-[#1E3A8A]/15 bg-white object-contain shadow-sm sm:h-10 sm:w-10"
                />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#1E3A8A]/60 sm:text-xs">
                    Incentive Claim System
                  </div>
                  <div className="text-[9px] text-black/40 sm:text-[10px]">
                    Version 1.0
                  </div>
                </div>
              </div>

              {/* Center Section */}
              <div className="text-center text-[10px] uppercase tracking-wider text-black/50 sm:text-xs">
                Developed by{" "}
                <span className="font-semibold text-[#1E3A8A] transition-colors hover:text-[#1E3A8A]/80">
                  Vinay Ninave
                </span>
              </div>

              {/* Right Section */}
              <div className="text-[10px] text-black/40 sm:text-xs">
                © {new Date().getFullYear()} All rights reserved
              </div>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
