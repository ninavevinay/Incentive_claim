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
import LandingPage from "./pages/LandingPage.jsx";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { getDashboardPathForUser, slugifyDepartment } from "./lib/routeMap.js";
import { AppHeader, AppFooter } from "./components/layout/index.js";

function getSeoForPath(pathname) {
  if (pathname === "/") {
    return {
      title: "SBJIT NPTEL Reimburse",
      description: "Digital portal for incentive applications, review workflows, and approval tracking."
    };
  }
  if (pathname.startsWith("/login")) {
    return {
      title: "Login | SBJIT NPTEL Reimburse",
      description: "Sign in to submit, review, and track incentive applications."
    };
  }
  if (pathname.startsWith("/forgot-password")) {
    return {
      title: "Forgot Password | SBJIT NPTEL Reimburse",
      description: "Verify your email with OTP and reset your portal password securely."
    };
  }
  if (pathname.startsWith("/register-admin")) {
    return {
      title: "Admin Registration | SBJIT NPTEL Reimburse",
      description: "Create an admin account for system-wide user and application management."
    };
  }
  if (pathname.startsWith("/register")) {
    return {
      title: "Register | SBJIT NPTEL Reimburse",
      description: "Create a student or faculty account to apply for incentives."
    };
  }
  if (pathname.startsWith("/student")) {
    return {
      title: "Student Portal | SBJIT NPTEL Reimburse",
      description: "Student portal for application submission, tracking, and profile updates."
    };
  }
  if (pathname.startsWith("/faculty")) {
    return {
      title: "Faculty Portal | SBJIT NPTEL Reimburse",
      description: "Faculty portal for incentive application submission and status tracking."
    };
  }
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin Portal | SBJIT NPTEL Reimburse",
      description: "Admin panel to manage users, applications, and authority registrations."
    };
  }
  if (pathname.startsWith("/authority")) {
    return {
      title: "Authority Portal | SBJIT NPTEL Reimburse",
      description: "Authority portal for reviewing and processing incentive applications."
    };
  }
  return {
    title: "SBJIT NPTEL Reimburse",
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

function HomeEntry() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to={getDashboardPathForUser(user)} replace />;
  return <LandingPage />;
}

export default function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const isLandingRoute = location.pathname === "/";
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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <AuthProvider>
      <div className={`app-shell min-h-screen flex flex-col ${isDashboardRoute ? "app-shell--dashboard" : ""}`}>
        <AppHeader
          isDashboardRoute={isDashboardRoute}
          mobileNavOpen={mobileNavOpen}
          onToggleMobileMenu={toggleMobileMenu}
        />

        {/* Main Content */}
        <main className="flex-1 min-h-0 flex flex-col">
          <Routes>
            <Route path="/" element={<HomeEntry />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <AppFooter useElearningFooter={isLandingRoute} />
      </div>
    </AuthProvider>
  );
}
